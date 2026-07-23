import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import React from "react";

// ── Вынесенные модули ──────────────────────────────────────────────
import { SUPABASE_URL, SUPABASE_KEY, rpc, saToken, rpcSync, flushQueue, supabase } from "./api/supabase";
import { MODULES, loadSpgModules } from "./data/modules";
import { loadDialogues } from "./data/dialogues-lazy";
import { ROLES, RESTAURANTS } from "./data/roles";
import { GLOSSARY } from "./data/glossary";
import { LOGO_SRC, LOGO_SRC_DARK } from "./assets/logo";
import { normSurname, shuffleArray, dedupeBestScores, pickRandom, shuffleSituationOptions, vibrate, onActivate, shuffleLessonQuestions } from "./lib/utils";

// ── Ленивые экраны: код и данные подгружаются при первом открытии ──
// (тренажёр меню, книга, SOS, наставничество, поиск, справочник,
//  карта обучения и собеседование не входят в стартовый бандл)
const SearchScreen = lazy(() => import("./ui/search").then(m => ({ default: m.SearchScreen })));
const MenuTrainerScreen = lazy(() => import("./ui/menu-trainer").then(m => ({ default: m.MenuTrainerScreen })));
const GuestBookScreen = lazy(() => import("./ui/guestbook").then(m => ({ default: m.GuestBookScreen })));
const MentorScreen = lazy(() => import("./ui/mentor").then(m => ({ default: m.MentorScreen })));
const SOSScreen = lazy(() => import("./ui/sos").then(m => ({ default: m.SOSScreen })));
const TrainingCardScreen = lazy(() => import("./ui/training-card").then(m => ({ default: m.TrainingCardScreen })));
const ReferenceSection = lazy(() => import("./ui/ReferenceSection").then(m => ({ default: m.ReferenceSection })));
const CandidateScreen = lazy(() => import("./ui/candidate").then(m => ({ default: m.CandidateScreen })));
const AssistantScreen = lazy(() => import("./ui/assistant").then(m => ({ default: m.AssistantScreen })));

// Заглушка на время подгрузки ленивого экрана
function ScreenLoader({ T }) {
  // Скелетон-макет будущего экрана: фирменное стекло, ступенчатое появление,
  // мерцающие строки «текста» и пульсирующий знак SA внизу.
  const glass = {
    background: T.lessGlass?.bg || "rgba(255,250,238,0.05)",
    border: T.lessGlass?.border || "1px solid rgba(150,112,42,0.38)",
    borderTop: T.lessGlass?.borderTop || "1px solid rgba(215,170,68,0.46)",
    boxShadow: T.lessGlass?.shadow || "0 6px 22px rgba(0,0,0,0.50), 0 2px 0 rgba(200,160,60,0.18) inset",
    borderRadius: 18, padding: 16, marginBottom: 12,
  };
  // Режим «для чтения»: реальные тексты там крупнее (заголовки 19, абзацы 15),
  // поэтому и полоски-заготовки выше — контент не «прыгает» после загрузки.
  const up = T.a11y ? 3 : 0;
  const line = (w, h = 12, last = false) => ({ height: h + up, width: w, borderRadius: 7, marginBottom: last ? 0 : 10 + up / 2 });
  const later = (i) => ({ animationDelay: (i * 0.09) + "s" });
  const headW = ["62%", "48%", "70%"], tailW = ["76%", "84%", "58%"];
  return (
    <div style={{ ...T.screen, padding: "18px 16px" }} className="sa-screen">
      <div className="sa-pagein" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, ...later(0) }}>
        <div className="sa-skel" style={{ width: 36, height: 36, borderRadius: 18, flexShrink: 0 }} />
        <div className="sa-skel" style={line("46%", 16, true)} />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="sa-pagein" style={{ ...glass, ...later(i) }}>
          <div className="sa-skel" style={line(headW[i - 1], 14)} />
          <div className="sa-skel" style={line("94%")} />
          <div className="sa-skel" style={line(tailW[i - 1], 12, true)} />
        </div>
      ))}
      <div className="sa-pagein" style={{ textAlign: "center", marginTop: 22, ...later(4) }}>
        <span className="sa-pulse" style={{ color: T.a11y ? "#8B6A30" : "#C8A96E", fontFamily: "monospace", fontSize: T.a11y ? 13 : 11, letterSpacing: 4 }}>✦ SA</span>
      </div>
    </div>
  );
}

// ── Первое знакомство: три карточки при самом первом входе в жизни ──
// Показывается один раз (sa_welcome_seen), листается свайпом и кнопкой.
// Задача — снять тревогу «куда я попал», а не обучить: детали человек
// узнает по контекстным подсказкам в момент, когда они станут нужны.
// Карточка AI-наставника — для всех, флагманская фича
const WELCOME_AI_CARD = {
  icon: (c) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8 8 0 0 1-8 8H6l-3 2.5v-10a8 8 0 0 1 8-8h2a8 8 0 0 1 8 7.5z"/>
      <text x="12" y="14.2" textAnchor="middle" fontSize="7.5" fontWeight="bold" fontFamily="Georgia, serif" letterSpacing="0.3" fill={c} stroke="none">AI</text>
    </svg>
  ),
  title: "Наставник всегда рядом",
  text: "Стеклянная кнопка в правом нижнем углу — AI-наставник. Спроси про жалобу гостя, запару или подачу — ответит по стандартам академии, как старший коллега. Любой вопрос — нормальный вопрос.",
};

// Карточка AI-собеседования — менеджерам и руководству
const WELCOME_HIRE_CARD = {
  icon: (c) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M16 3.5a4 4 0 0 1 0 7"/><path d="M19 8h4M21 6v4"/>
    </svg>
  ),
  title: "AI-собеседование",
  text: "В жетоне «Собеседование» живёт ИИ-интервьюер: дай кандидату телефон — он задаст рабочие ситуации и вернёт оценку по компетенциям с вердиктом. Решение о найме всегда за тобой.",
};

// Карточка для менеджеров и руководства — добавляется четвёртой
const WELCOME_ADMIN_CARD = {
  icon: (c) => NAV_ICONS.team(c, 28),
  title: "Твой штаб — «Команда»",
  text: "Сотрудники и коды входа, аналитика прогресса, чек-листы смен и собеседование кандидатов — всё управление живёт во вкладке «Команда».",
};

const WELCOME_CARDS = [
  { icon: (c) => UI_SVG.cloche(c, 28), title: "Твой трек",
    text: "Учись по шагам: уроки открываются по порядку, а приложение само подскажет, куда дальше. Кнопка «ДАЛЬШЕ» на главной — твой компас." },
  { icon: (c) => UI_SVG.target(c, 28), title: "Ошибки — это план",
    text: "Неверный ответ — не приговор: вопрос попадёт в «Работу над ошибками» и вернётся сам — через день, три, неделю. Бейдж покажет, когда пора." },
  { icon: (c) => UI_SVG.sparkle(c, 28), title: "Инструменты рядом",
    text: "В нижней панели живут тренажёр меню, книга твоего пути, SOS-шпаргалки для смены и поиск по всему приложению." },
];

function WelcomeIntro({ T, a11y, isAdmin, canHire, onClose }) {
  const cards = [
    ...WELCOME_CARDS.slice(0, 2), WELCOME_AI_CARD, ...WELCOME_CARDS.slice(2),
    ...(canHire ? [WELCOME_HIRE_CARD] : []),
    ...(isAdmin ? [WELCOME_ADMIN_CARD] : []),
  ];
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState("r");      // направление листания — карточка въезжает с нужной стороны
  const [leaving, setLeaving] = useState(false); // плавное закрытие вместо резкого исчезновения
  const touchX = useRef(null);
  const go = (delta) => {
    vibrate("light");
    setDir(delta > 0 ? "r" : "l");
    setIdx(i => i + delta);
  };
  const close = () => {
    if (leaving) return;
    vibrate("light");
    setLeaving(true);
    setTimeout(onClose, 280);
  };
  const gold = a11y ? "#8B6A30" : "#C8A96E";
  const last = idx === cards.length - 1;
  const card = cards[idx];
  const glass = {
    background: T.lessGlass?.bg || "rgba(255,250,238,0.05)",
    border: T.lessGlass?.border || "1px solid rgba(150,112,42,0.38)",
    borderTop: T.lessGlass?.borderTop || "1px solid rgba(215,170,68,0.46)",
    boxShadow: T.lessGlass?.shadow || "0 6px 22px rgba(0,0,0,0.50)",
    borderRadius: 22, padding: "26px 22px",
  };
  return (
    <div className="sa-fadein" style={{ position: "fixed", inset: 0, zIndex: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        background: a11y ? "rgba(90,70,40,0.35)" : "rgba(10,7,3,0.72)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        opacity: leaving ? 0 : 1, transition: "opacity .28s ease" }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchX.current == null) return;
        const d = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (d < -40 && !last) go(1);
        if (d > 40 && idx > 0) go(-1);
      }}>
      <div key={idx} className={dir === "l" ? "sa-cardpage-l" : "sa-cardpage-r"}
        style={{ ...glass, maxWidth: 400, width: "100%",
          transform: leaving ? "translateY(10px) scale(0.98)" : undefined, transition: "transform .28s ease" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div className="sa-pop" style={{ width: 58, height: 58, borderRadius: 29, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(200,169,110,0.12)", border: `1px solid ${gold}55`, animationDelay: "0.08s" }}>{card.icon(gold)}</div>
        </div>
        <div style={{ color: T.lessHeadTitle?.color || "#F0E8D8", fontFamily: ACCENT_SERIF, fontSize: a11y ? 21 : 19, fontWeight: "bold", textAlign: "center", marginBottom: 10 }}>{card.title}</div>
        <div style={{ color: T.modSub?.color || "#C8B898", fontSize: a11y ? 15 : 13.5, lineHeight: 1.7, textAlign: "center", marginBottom: 18 }}>{card.text}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 7, marginBottom: 18 }}>
          {cards.map((_, i) => (
            <span key={i} style={{ width: i === idx ? 20 : 7, height: 7, borderRadius: 4,
              background: i === idx ? gold : "rgba(160,130,80,0.35)", transition: "all .25s ease" }} />
          ))}
        </div>
        <button className="sa-btn" onClick={() => { if (last) close(); else go(1); }}
          style={{ padding: "14px", borderRadius: 14, border: "none", width: "100%", fontSize: 16, fontFamily: "Georgia, serif",
            fontWeight: "bold", cursor: "pointer", color: "#fff",
            background: "linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)", boxShadow: "0 4px 18px rgba(200,160,80,0.25)" }}>
          {last ? "Начать" : "Дальше"}
        </button>
        {!last && (
          <button className="sa-btn" onClick={close}
            style={{ marginTop: 8, padding: "11px", borderRadius: 14, width: "100%", cursor: "pointer", border: "none",
              background: "transparent", color: T.modSub?.color || "#9A8C74", fontSize: 13, fontFamily: "Georgia, serif" }}>
            Пропустить
          </button>
        )}
      </div>
    </div>
  );
}

// ── Плавающая кнопка AI-ассистента: стеклянная линза в правом нижнем углу.
// Живёт на основных экранах поверх контента, над навбаром. До первого
// открытия пульсирует золотым кольцом-приглашением, после — спокойная.
function AiFab({ a11y, onClick }) {
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem("sa_ai_fab") === "1"; } catch (e) { return true; }
  });
  const gold = a11y ? "#8B6A30" : "#C8A96E";
  const tap = () => {
    try { localStorage.setItem("sa_ai_fab", "1"); } catch (e) {}
    setSeen(true);
    vibrate("light");
    onClick();
  };
  return (
    <div className="sa-pop" onClick={tap} {...onActivate(tap)} role="button" aria-label="AI-ассистент"
      style={{ position: "fixed", right: 14, bottom: "calc(122px + env(safe-area-inset-bottom, 0px))", zIndex: 350,
        width: 58, height: 58, borderRadius: 29, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: a11y ? "rgba(139,106,48,0.12)" : "rgba(200,169,110,0.12)",
        boxShadow: `inset 0 0 0 1px ${a11y ? "rgba(139,106,48,0.5)" : "rgba(214,178,102,0.42)"}, inset 0 0 18px ${a11y ? "rgba(255,255,255,0.45)" : "rgba(255,230,170,0.10)"}, inset 0 1.5px 0 ${a11y ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.18)"}, 0 8px 24px rgba(0,0,0,${a11y ? 0.18 : 0.45})` }}>
      {!seen && (
        <span className="sa-pulse" style={{ position: "absolute", inset: -5, borderRadius: 34,
          border: `1.5px solid ${gold}`, pointerEvents: "none" }} />
      )}
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8 8 0 0 1-8 8H6l-3 2.5v-10a8 8 0 0 1 8-8h2a8 8 0 0 1 8 7.5z"/>
        <text x="12" y="14.2" textAnchor="middle" fontSize="7.5" fontWeight="bold" fontFamily="Georgia, serif" letterSpacing="0.3" fill={gold} stroke="none">AI</text>
      </svg>
    </div>
  );
}
import { injectStyles } from "./ui/css";
import { MM, Mm, ROLE_SVG, UI_SVG, POS_SVG, MOD_SVG, MARKER_RE, GAME_SVG, NAV_ICONS } from "./ui/icons";
import { S, A, ACCENT_SERIF } from "./ui/styles";
import { NewPageBanner } from "./ui/guestbook-lite";
import { weeklyDialogueId, weeklyLessonId } from "./data/reviews";
import { Confetti, TimerBar, SayAloud } from "./ui/widgets";
import { crownIcon, flameIcon, trophyIcon, faceIcon } from "./ui/icons-extra";
import { StreakCard, MoodCheckCard, TeamMoodCard, moodPalette } from "./ui/mood-cards";
import { BG_DARK, CREAM, GOLD, GOLD_LOGO, SAND } from "./ui/tokens";
import {
  AchievementPopup,
  RoleCompleteScreen,
  WeekStar,
  LeaderboardScreen,
  DailyScreen,
  PlayerDetailScreen,
  PlayerResetCard,
  StatsScreen,
  PS,
  ProfileScreen,
  APP_SHARE_URL,
  POS_LABELS,
  TeamScreen,
  CodeLoginScreen,
  AccountScreen,
  RoleSelect,
  DEFAULT_CHECKLISTS,
  CL_KINDS,
  _clYmd,
  _clId,
  ChecklistScreen,
  DEFAULT_ONBOARDING,
  ONB_TOTAL,
  OnboardingScreen,
  AnalyticsScreen,
  ContentEditorScreen,
  MistakesScreen,
  HomeScreen,
  ModuleScreen,
  LessonScreen,
  GlossaryScreen,
  LiveDialogue,
  ExamScreen,
  CertificateScreen,
  CertificatesScreen
} from "./ui/screens";













injectStyles();



// #2 — Фича «Сертификаты и экзамен» полностью готова в коде, но временно скрыта из интерфейса.
// Чтобы вернуть: поставь true — снова появятся плитка «Сертификаты» и вход к экзамену.
const CERTIFICATES_ENABLED = true;

// Этап 1 — интервальное повторение: через сколько дней вопрос возвращается после верного ответа
const SR_DAYS = [1, 3, 7, 30];

function ServiceAcademy() {
  const [screen, setScreen] = useState("roleSelect");
  const [prevScreen, setPrevScreen] = useState(null);
  const [bookFocus, setBookFocus] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = React.useState(null);
  const [profile, setProfile] = useState(null);
  const [scores, setScores] = useState([]);
  const [practiceStars, setPracticeStars] = useState({}); // { "name|surname": { "lesson_id": stars } }
  const [allProfiles, setAllProfiles] = useState([]); // все пользователи из таблицы profiles
  const [newAchievement, setNewAchievement] = useState(null); // { icon, label } для popup
  const [quizDone, setQuizDone] = useState({});
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [role, setRole] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [refStart, setRefStart] = useState(null);
  const [completed, setCompleted] = useState({});
  const [completedRoles, setCompletedRoles] = useState(new Set());
  const [quizState, setQuizState] = useState({ step: 0, answers: [], done: false, mistakes: 0 });
  const [practiceState, setPracticeState] = useState({ step: 0, choice: null, isAnswered: false, results: [], done: false, lives: 3, score: 0, combo: 0, situations: [], flash: null, usedIds: [] });
  const [gameKey, setGameKey] = useState(0);
  const [a11y, setA11y] = useState(() => { try { return localStorage.getItem("sa_a11y") === "1"; } catch (e) { return false; } });
  const [streak, setStreak] = useState({ count: 0, best: 0, last: "", days: [] });
  const [mistakeBank, setMistakeBank] = useState([]); // #5/#6 — заваленные вопросы для повтора
  const [customLessons, setCustomLessons] = useState([]); // свой контент (редактор)
  const [saved, setSaved] = useState({}); // #5 — избранные термины и заметки: { termKey: { fav?: bool, note?: string } }
  const [examResults, setExamResults] = useState({}); // #2 — результаты экзаменов: { roleId: { passed, score, correct, total, date } }
  const [examRole, setExamRole] = useState(null); // #2 — для какой роли открыт экзамен/сертификат

  // Инициализация Telegram WebApp: убираем серые рамки, красим шапку и фон под тему
  React.useEffect(() => {
    try {
      try { localStorage.setItem("sa_a11y", a11y ? "1" : "0"); } catch (e) {}
      // Класс темы на корне: позволяет CSS красить псевдоэлементы
      // (плейсхолдеры, каретки) под тему во всём приложении разом
      try { document.documentElement.classList.toggle("sa-light", a11y); } catch (e) {}
      const tg = window.Telegram?.WebApp;
      const bg = a11y ? SAND : BG_DARK;
      document.documentElement.style.background = bg;
      document.body.style.background = bg;
      if (!tg) return;
      tg.ready?.();
      // Этап 3 — напоминания: запоминаем Telegram ID и отправляем на сервер.
      // Если RPC sa_set_tg ещё не создан (см. docs/UPGRADE_NOTES.md) — очередь безвредно отбросит вызов.
      const _tgId = tg.initDataUnsafe?.user?.id;
      if (_tgId) {
        try {
          if (localStorage.getItem("sa_tg_id") !== String(_tgId)) {
            localStorage.setItem("sa_tg_id", String(_tgId));
            if (saToken()) rpcSync("sa_set_tg", { p_token: saToken(), p_tg_id: _tgId });
          }
        } catch (e) {}
      }
      tg.expand?.();
      tg.setBackgroundColor?.(bg);
      tg.setHeaderColor?.(bg);
      tg.setBottomBarColor?.(bg);
    } catch (e) {}
  }, [a11y]);
  const isAdmin = !!profile?.is_admin;

  // Гасим брендовый сплэш из index.html, когда приложение готово к показу
  React.useEffect(() => {
    if (!storageLoaded) return;
    const el = document.getElementById("sa-splash");
    if (!el) return;
    el.style.opacity = "0";
    const t = setTimeout(() => { try { el.remove(); } catch (e) {} }, 380);
    return () => clearTimeout(t);
  }, [storageLoaded]);

  // Офлайн-очередь: досылаем несохранённые записи при старте, возврате сети и раз в минуту
  React.useEffect(() => {
    flushQueue();
    const onOnline = () => flushQueue();
    window.addEventListener("online", onOnline);
    const iv = setInterval(flushQueue, 60000);
    return () => { window.removeEventListener("online", onOnline); clearInterval(iv); };
  }, []);

  // Загрузка из хранилища: сессия → whoami → профиль
  React.useEffect(() => {
    // Таймаут — если что-то зависнет, показываем экран входа
    const fallback = setTimeout(() => {
      setStorageLoaded(true);
      setScreen("login");
    }, 4000);

    const storageGet = (key) => {
      try {
        const val = localStorage.getItem(key);
        return Promise.resolve(val ? { value: val } : null);
      } catch(e) {
        return Promise.resolve(null);
      }
    };

    (async () => {
      let p = null;
      try {
        let token = null;
        try { token = localStorage.getItem("sa_session_token"); } catch(e) {}
        if (!token) { clearTimeout(fallback); setStorageLoaded(true); setScreen("login"); return; }

        let cached = null;
        try { const c = localStorage.getItem("sa_profile"); if (c) cached = JSON.parse(c); } catch(e) {}

        let res = null;
        try { res = await rpc("whoami", { p_token: token }); } catch(e) { res = null; }

        if (res && res.ok) {
          const emp = res.employee;
          const prof = { id: emp.id, name: emp.name, surname: normSurname(emp.surname || ""), restaurant: emp.restaurant, position: emp.position, is_admin: !!emp.is_admin };
          try { localStorage.setItem("sa_profile", JSON.stringify(prof)); } catch(e) {}
          setProfile(prof);
          p = { value: JSON.stringify(prof) };
        } else if (res && res.ok === false) {
          // Сессия отозвана (сброс кода / деактивация) — на вход
          try { localStorage.removeItem("sa_session_token"); } catch(e) {}
          clearTimeout(fallback); setStorageLoaded(true); setScreen("login"); return;
        } else if (cached) {
          // Сеть недоступна — работаем с кэшем профиля (офлайн-режим)
          setProfile(cached);
          p = { value: JSON.stringify(cached) };
        } else { clearTimeout(fallback); setStorageLoaded(true); setScreen("login"); return; }
      } catch(e) { clearTimeout(fallback); setStorageLoaded(true); setScreen("login"); return; }
      try { const s = await storageGet("sa_scores"); if (s) { const saved = JSON.parse(s.value); setScores(prev => { const ids = new Set(saved.map(x => x.id)); return [...prev.filter(x => !ids.has(x.id)), ...saved]; }); } } catch(e) {}
      // quizDone загружается из Supabase ниже
      try { const uk2 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const cr = await storageGet("sa_completed_roles"+uk2) || await storageGet("sa_completed_roles"); if (cr) setCompletedRoles(new Set(JSON.parse(cr.value))); } catch(e) {}
      try { const uk3 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const sc = await storageGet("sa_completed"+uk3) || await storageGet("sa_completed"); if (sc) setCompleted(JSON.parse(sc.value)); } catch(e) {}
      try { const lr = await storageGet("sa_last_role"); if (lr) setRole(JSON.parse(lr.value)); } catch(e) {}
      try { const ps = await storageGet("sa_practice_stars"); if (ps) setPracticeStars(JSON.parse(ps.value)); } catch(e) {}
      try { const uk4 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const st = await storageGet("sa_streak"+uk4); if (st) setStreak(JSON.parse(st.value)); } catch(e) {}
      try { const mb = await storageGet("sa_mistakes"); if (mb) { const arr = JSON.parse(mb.value); if (Array.isArray(arr)) setMistakeBank(arr); } } catch(e) {}
      try { const uk5 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const sv = await storageGet("sa_saved"+uk5); if (sv) { const obj = JSON.parse(sv.value); if (obj && typeof obj === "object" && !Array.isArray(obj)) setSaved(obj); } } catch(e) {}
      try { const uk6 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const ex = await storageGet("sa_exam"+uk6); if (ex) { const obj = JSON.parse(ex.value); if (obj && typeof obj === "object" && !Array.isArray(obj)) setExamResults(obj); } } catch(e) {}
      clearTimeout(fallback);
      setStorageLoaded(true);
    })();
  }, []);

  // Загрузка всех профилей из Supabase
  React.useEffect(() => {
    const h = { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY };
    fetch(`${SUPABASE_URL}/rest/v1/profiles?select=name,surname,restaurant,position,last_role`, { headers: h })
      .then(r => r.json()).then(data => {
        if (Array.isArray(data) && data.length > 0) setAllProfiles(data);
      }).catch(() => {});
  }, []);

  // Загрузка рейтинга из Supabase
  React.useEffect(() => {
    supabase.from("scores").select("*").then(({ data }) => {
      if (data && data.length > 0) {
        const mapped = data.map(s => ({
          id: s.id, name: s.name, surname: s.surname || "",
          restaurant: s.restaurant, role: s.role, position: s.position || "waiter",
          quizTitle: "", quiz_id: s.quiz_id, score: s.score, total: s.total,
          pct: s.total > 0 ? Math.round(s.score / s.total * 100) : 0,
          date: new Date(s.updated_at).toLocaleDateString("ru-RU"),
          updated_at: s.updated_at,
        }));
        setScores(mapped);

        // Проверяем ачивку «Первопроходец» — первый кто появился в системе
        if (profile) {
          const myScores = mapped.filter(s => s.name === profile.name && s.surname === normSurname(profile.surname));
          if (myScores.length > 0) {
            const allDates = mapped.map(s => s.updated_at).sort();
            const myDates = myScores.map(s => s.updated_at).sort();
            const alreadyShown = localStorage.getItem(`sa_ach_pioneer_${profile.name}_${normSurname(profile.surname)}`);
            if (!alreadyShown && myDates[0] === allDates[0] && mapped.length > myScores.length) {
              setTimeout(() => {
                setNewAchievement({ icon: "🚀", label: "Первопроходец" });
                vibrate("heavy");
                try { localStorage.setItem(`sa_ach_pioneer_${profile.name}_${normSurname(profile.surname)}`, "1"); } catch(e) {}
                setTimeout(() => setNewAchievement(null), 3000);
              }, 1500);
            }
          }
        }
      }
    }).catch(() => {});
  }, [profile]);

  // Загрузка progress из Supabase и синхронизация с completed
  React.useEffect(() => {
    if (!profile) return;
    fetch(`${SUPABASE_URL}/rest/v1/progress?user_id=eq.${encodeURIComponent(profile.id)}`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    }).then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return; // ошибка от Supabase — не трогаем state
      if (data.length === 0) return; // пусто — не обнуляем
      {
        // Восстанавливаем completed из Supabase — авторитетный источник
        const allValidIds = new Set(
          Object.values(MODULES).flatMap(modules =>
            modules.flatMap(m => m.lessons.map(l => l.id))
          )
        );
        const seen = new Set();
        const validRows = data.filter(row => {
          if (!allValidIds.has(row.lesson_id)) return false;
          if (seen.has(row.lesson_id)) return false;
          seen.add(row.lesson_id);
          return true;
        });
        const merged = {};
        validRows.forEach(row => { merged[row.lesson_id] = true; });
        setCompleted(merged);
        try { const uk = `_${profile.name}_${profile.surname||""}`; localStorage.setItem("sa_completed"+uk, JSON.stringify(merged)); } catch(e) {}
      }
    }).catch(() => {});
  }, [profile]);

  // Загрузка quizDone из Supabase — авторитетный источник
  React.useEffect(() => {
    if (!profile) return;
    fetch(`${SUPABASE_URL}/rest/v1/quiz_done?user_id=eq.${encodeURIComponent(profile.id)}`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    }).then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return; // ошибка от Supabase — не трогаем state
      if (data.length === 0) return; // пусто — не обнуляем
      const done = {};
      data.forEach(row => { if (row.quiz_id) done[row.quiz_id] = true; });
      setQuizDone(done);
      try { localStorage.setItem("sa_quiz_done", JSON.stringify(done)); } catch(e) {}
    }).catch(() => {});
  }, [profile]);

  // Загрузка last_role из Supabase если localStorage не дал роль
  React.useEffect(() => {
    if (!profile || role) return; // уже есть роль — не нужно
    fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(profile.id)}&select=last_role`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    }).then(r => r.json()).then(data => {
      if (data && data.length > 0 && data[0].last_role) {
        setRole(data[0].last_role);
        try { localStorage.setItem("sa_last_role", JSON.stringify(data[0].last_role)); } catch(e) {}
        setScreen("home");
      }
    }).catch(() => {});
  }, [profile, role]);

  // Загрузка practiceStars из Supabase — авторитетный источник
  React.useEffect(() => {
    if (!profile) return;
    const userKey = `${profile.name}|${profile.surname || ""}`;
    fetch(`${SUPABASE_URL}/rest/v1/practice_stars?user_id=eq.${encodeURIComponent(profile.id)}`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    }).then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return; // ошибка — не трогаем
      if (data.length === 0) return; // пусто — не обнуляем, оставляем как есть
      const starsObj = {};
      data.forEach(row => { starsObj[row.lesson_id] = row.stars; });
      setPracticeStars(prev => {
        const updated = { ...prev, [userKey]: starsObj };
        try { localStorage.setItem("sa_practice_stars", JSON.stringify(updated)); } catch(e) {}
        return updated;
      });
    }).catch(() => {});
  }, [profile]);

  // Загрузка completedRoles из Supabase — авторитетный источник
  React.useEffect(() => {
    if (!profile) return;
    fetch(`${SUPABASE_URL}/rest/v1/completed_roles?user_id=eq.${encodeURIComponent(profile.id)}`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    }).then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return; // ошибка — не трогаем
      if (data.length === 0) return; // пусто — не обнуляем
      const roles = new Set(data.map(row => row.role));
      setCompletedRoles(roles);
      try { const uk = `_${profile.name}_${profile.surname||""}`; localStorage.setItem("sa_completed_roles"+uk, JSON.stringify([...roles])); } catch(e) {}
    }).catch(() => {});
  }, [profile]);

  const modules = useMemo(() => role ? MODULES[role] : [], [role]);
  const totalLessons = useMemo(() => modules.reduce((a, m) => a + m.lessons.filter(l => l.type !== "result").length, 0), [modules]);
  const roleLesonIds = useMemo(() => new Set(modules.flatMap(m => m.lessons.filter(l => l.type !== "result").map(l => l.id))), [modules]);
  const roleQuizIds = useMemo(() => new Set(modules.flatMap(m => m.lessons.filter(l => l.type === "quiz").map(l => l.id))), [modules]);
  const doneCount = useMemo(() => {
    const lessonsDone = Object.keys(completed).filter(k => completed[k] && roleLesonIds.has(k) && !roleQuizIds.has(k)).length;
    const quizzesDone = Object.keys(quizDone).filter(k => quizDone[k] && roleQuizIds.has(k)).length;
    return lessonsDone + quizzesDone;
  }, [completed, quizDone, roleLesonIds, roleQuizIds]);
  const progress = useMemo(() => totalLessons ? Math.round((doneCount / totalLessons) * 100) : 0, [doneCount, totalLessons]);

  // ── Свой контент (редактор) ──
  const loadCustomLessons = useCallback(async () => {
    const t = saToken();
    if (!t) { setCustomLessons([]); return; }
    try { const res = await rpc("cms_list_lessons", { p_token: t }); if (Array.isArray(res)) setCustomLessons(res); } catch(e) {}
  }, []);
  React.useEffect(() => { if (profile) loadCustomLessons(); }, [profile, loadCustomLessons]);
  // Свои разделы для текущей роли (синтетические модули: урок + тест)
  const customModules = useMemo(() => {
    if (!role) return [];
    const mine = customLessons.filter(c => c.role === role);
    const groups = {};
    mine.forEach(c => { const k = ((c.module || "").trim()) || "Свой раздел"; (groups[k] = groups[k] || []).push(c); });
    return Object.entries(groups).map(([name, list], mi) => ({
      id: "cms-" + role + "-" + mi, tag: "Своё", title: name, subtitle: "Раздел вашего ресторана",
      icon: "📘", color: GOLD, custom: true,
      lessons: list.flatMap(c => {
        const out = [{ id: "cms-l-" + c.id, title: c.title || "Урок", type: "lesson", content: c.content || "" }];
        if (Array.isArray(c.questions) && c.questions.length) out.push({ id: "cms-q-" + c.id, title: "Тест: " + (c.title || ""), type: "quiz", questions: c.questions });
        return out;
      }),
    }));
  }, [customLessons, role]);
  const navigate = useCallback((to) => { setScreen(prev => { setPrevScreen(prev); return to; }); }, []);
  // #5 — избранное/заметки: переключение и сохранение, с очисткой пустых записей
  const toggleFav = useCallback((k) => setSaved(prev => {
    const cur = prev[k] || {}; const next = { ...prev, [k]: { ...cur, fav: !cur.fav } };
    if (!next[k].fav && !next[k].note) delete next[k];
    return next;
  }), []);
  const setNote = useCallback((k, text) => setSaved(prev => {
    const cur = prev[k] || {}; const next = { ...prev, [k]: { ...cur, note: text } };
    if (!next[k].fav && !next[k].note) delete next[k];
    return next;
  }), []);
  React.useEffect(() => {
    if (!storageLoaded || !profile) return;
    try { const uk = `_${profile.name}_${profile.surname||""}`; localStorage.setItem("sa_saved"+uk, JSON.stringify(saved)); } catch(e) {}
  }, [saved, storageLoaded, profile]);
  React.useEffect(() => {
    if (!storageLoaded || !profile) return;
    try { const uk = `_${profile.name}_${profile.surname||""}`; localStorage.setItem("sa_exam"+uk, JSON.stringify(examResults)); } catch(e) {}
  }, [examResults, storageLoaded, profile]);
  const recordExam = useCallback((roleId, result) => setExamResults(prev => ({ ...prev, [roleId]: result })), []);
  const openExam = useCallback((roleId) => { setExamRole(roleId); navigate("exam"); }, [navigate]);
  const openCertificate = useCallback((roleId) => { setExamRole(roleId); navigate("certificate"); }, [navigate]);
  const handleLogin = useCallback((token, emp) => {
    const prof = { id: emp.id, name: emp.name, surname: normSurname(emp.surname || ""), restaurant: emp.restaurant, position: emp.position, is_admin: !!emp.is_admin };
    try {
      localStorage.setItem("sa_session_token", token || "demo");
      localStorage.setItem("sa_profile", JSON.stringify(prof));
    } catch(e) {}
    setProfile(prof);
    setScreen("roleSelect");
  }, []);
  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem("sa_session_token");
      localStorage.removeItem("sa_profile");
      localStorage.removeItem("sa_last_role");
    } catch(e) {}
    setProfile(null);
    setRole(null);
    setScreen("login");
  }, []);
  const selectRole = useCallback((r) => {
    setRole(r);
    try { localStorage.setItem("sa_last_role", JSON.stringify(r)); } catch(e) {}
    // Сохраняем выбранную роль в Supabase
    if (profile) {
      rpcSync("save_last_role", { p_token: saToken(), p_role: r });
    }
    setScreen("home");
  }, [profile]);
  const openModule = useCallback((m) => { setActiveModule(m); setScreen("module"); }, []);
  const openLesson = (l) => {
    if (l.type === "quiz" && quizDone[l.id]) return;
    if (l.type === "dialogue") { setActiveLesson(l); setGameKey(k => k + 1); navigate("lesson"); return; }
    const originalLesson = role ? (MODULES[role] || []).flatMap(m => m.lessons).find(lesson => lesson.id === l.id) || l : l;
    let initQuestions = originalLesson.questions || [];
    let lessonToOpen = originalLesson;
    if (originalLesson.type === "quiz" && initQuestions.length > 0) {
      const SHOW = 12;
      const picked = pickRandom(initQuestions, Math.min(SHOW, initQuestions.length));
      const withShuffled = picked.map(q => {
        const opts = q.options.map((o, i) => ({ text: o, isCorrect: i === q.correct }));
        const shuffledOpts = shuffleArray(opts);
        return { ...q, options: shuffledOpts.map(o => o.text), correct: shuffledOpts.findIndex(o => o.isCorrect) };
      });
      initQuestions = withShuffled;
      lessonToOpen = { ...originalLesson, questions: withShuffled };
    }
    setActiveLesson(lessonToOpen);
    setQuizState({ step: 0, answers: [], done: false, mistakes: 0, blocked: false, questions: initQuestions });
    const pool = l.situations || [];
    const shuffled = pickRandom(pool, 6).map(shuffleSituationOptions);
    const firstUsedIds = shuffled.map(s => s.scene || s.statement || s.question || JSON.stringify(s).slice(0,60));
    setPracticeState({ step: 0, choice: null, isAnswered: false, results: [], done: false, lives: 3, score: 0, combo: 0, situations: shuffled, flash: null, usedIds: firstUsedIds });
    setGameKey(k => k + 1);
    navigate("lesson");
  };
  const ROLE_ORDER = ["seasonal", "core", "manager", "service_manager"];
  const checkAndShowAchievements = useCallback((newScores, newPracticeStars, newCompletedRoles) => {
    if (!profile) return;
    const key = `${profile.name}|${profile.surname}`;
    const myScores = newScores.filter(s => s.name === profile.name && s.surname === profile.surname);
    const myStarsObj = newPracticeStars[key] || {};
    const myStars = Object.values(myStarsObj).reduce((a, b) => a + b, 0);
    const maxStars = Math.max(...Object.keys(newPracticeStars).map(k => Object.values(newPracticeStars[k] || {}).reduce((a, b) => a + b, 0)), 0);

    const achieved = [];

    // 🌟 Бог сервиса — все 4 роли пройдены + все тесты 100%
    const allRolesDone = ROLE_ORDER.every(r => newCompletedRoles.has(r));
    const allPerfect = myScores.length > 0 && myScores.every(s => s.pct === 100);
    if (allRolesDone && allPerfect) achieved.push({ icon:"sparkle", label:"Бог сервиса", key:"god" });

    // 🏆 Мастер практики — больше всех звёздочек
    if (myStars > 0 && myStars === maxStars && Object.keys(newPracticeStars).length > 1) {
      achieved.push({ icon:"trophy", label:"Мастер практики", key:"master" });
    }

    // ⭐ Ядро команды — лучший средний % в роли core
    const coreScores = dedupeBestScores(newScores).filter(s => s.role === "core");
    if (coreScores.length > 0) {
      const myCore = coreScores.filter(s => s.name === profile.name && s.surname === profile.surname);
      const myAvg = myCore.length > 0 ? myCore.reduce((sum, s) => sum + s.pct, 0) / myCore.length : 0;
      const allAvgs = [...new Set(newScores.map(s => `${s.name}|${s.surname}`))].map(k => {
        const ps = coreScores.filter(s => `${s.name}|${s.surname}` === k);
        return ps.length > 0 ? ps.reduce((sum, s) => sum + s.pct, 0) / ps.length : 0;
      });
      const maxAvg = Math.max(...allAvgs, 0);
      if (myAvg > 0 && myAvg === maxAvg && allAvgs.filter(a => a > 0).length > 1) {
        achieved.push({ icon:"star", label:"Ядро команды", key:"core" });
      }
    }

    // Показываем только те что ещё не показывали
    const toShow = achieved.filter(a => {
      try { return !localStorage.getItem(`sa_ach_${a.key}_${profile.name}_${profile.surname||""}`); } catch(e) { return true; }
    });

    if (toShow.length > 0) {
      toShow.forEach((a, i) => {
        setTimeout(() => {
          setNewAchievement(a);
          vibrate("heavy");
          try { localStorage.setItem(`sa_ach_${a.key}_${profile.name}_${profile.surname||""}`, "1"); } catch(e) {}
        }, i * 3500);
        setTimeout(() => setNewAchievement(null), i * 3500 + 3000);
      });
    }
  }, [profile]);

  const completeLesson = useCallback(() => {
    try {
      if (!activeLesson) { setScreen("module"); return; }
      const uk = profile ? `_${profile.name}_${profile.surname||""}` : "";

      // 1. Урок пройден
      const newCompleted = { ...completed, [activeLesson.id]: true };
      try { localStorage.setItem("sa_completed"+uk, JSON.stringify(newCompleted)); } catch(e) {}
      setCompleted(newCompleted);

      // Стрик: отмечаем активность за сегодня
      try {
        const _ymd = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
        const _today = _ymd(new Date());
        setStreak(prev => {
          if (prev.last === _today) return prev;
          const _y = new Date(); _y.setDate(_y.getDate() - 1);
          const _yest = _ymd(_y);
          const count = prev.last === _yest ? (prev.count || 0) + 1 : 1;
          const best = Math.max(prev.best || 0, count);
          const days = [...new Set([...(prev.days || []), _today])].slice(-21);
          const next = { count, best, last: _today, days };
          try { localStorage.setItem("sa_streak"+uk, JSON.stringify(next)); } catch(e) {}
          return next;
        });
      } catch(e) {}

      // Прогресс урока в Supabase — только при первом прохождении
      if (profile && activeLesson.type !== "quiz" && !completed[activeLesson.id]) {
        rpcSync("save_progress", { p_token: saToken(), p_lesson_id: activeLesson.id, p_role: role });
      }

      // 2. Квиз → результат + отметка о прохождении (считаем свежие значения, чтобы передать их дальше)
      let newScores = scores;
      let newQuizDone = quizDone;
      if (activeLesson.type === "quiz" && profile) {
        const sc = quizState.answers.filter(a => a.isCorrect).length;
        const newScore = {
          id: Date.now(), name: profile.name, surname: normSurname(profile.surname),
          restaurant: profile.restaurant, role, position: profile.position || "waiter",
          quizTitle: activeLesson.title, quiz_id: activeLesson.id, score: sc, total: activeLesson.questions.length,
          pct: Math.round(sc / activeLesson.questions.length * 100),
          date: new Date().toLocaleDateString("ru-RU"),
        };
        rpcSync("save_score", { p_token: saToken(), p_quiz_id: activeLesson.id, p_role: role, p_score: sc, p_total: activeLesson.questions.length });

        newScores = [...scores, newScore];
        try { localStorage.setItem("sa_scores", JSON.stringify(newScores.filter(s => s.id > 900))); } catch(e) {}
        setScores(newScores);

        if (!quizDone[activeLesson.id]) {
          newQuizDone = { ...quizDone, [activeLesson.id]: true };
          try { localStorage.setItem("sa_quiz_done", JSON.stringify(newQuizDone)); } catch(e) {}
          setQuizDone(newQuizDone);
          rpcSync("save_quiz_done", { p_token: saToken(), p_quiz_id: activeLesson.id });
        }
      }

      // 3. Звёздочки практики — лучший результат по каждой практике
      let newPracticeStars = practiceStars;
      if (activeLesson.type === "practice" && profile) {
        const stars = practiceState.score >= 60 ? 3 : practiceState.score >= 30 ? 2 : 1;
        const userKey = `${profile.name}|${profile.surname}`;
        const userStars = practiceStars[userKey] || {};
        const prevBest = userStars[activeLesson.id] || 0;
        if (stars > prevBest) { // обновляем только если результат лучше
          newPracticeStars = { ...practiceStars, [userKey]: { ...userStars, [activeLesson.id]: stars } };
          try { localStorage.setItem("sa_practice_stars", JSON.stringify(newPracticeStars)); } catch(e) {}
          setPracticeStars(newPracticeStars);
          rpcSync("save_practice_stars", { p_token: saToken(), p_lesson_id: activeLesson.id, p_stars: stars });
        }
      }

      // 4. Пройдена ли вся роль? (используем СВЕЖИЕ newCompleted / newQuizDone)
      const allLessons = (MODULES[role] || []).flatMap(m => m.lessons).filter(l => l.type !== "result");
      const allDone = allLessons.every(l => l.type === "quiz" ? newQuizDone[l.id] : newCompleted[l.id]);
      const roleIdx = ROLE_ORDER.indexOf(role);
      const nextRole = roleIdx >= 0 ? ROLE_ORDER[roleIdx + 1] : undefined; // роли вне лестницы (напр. СПГ) — без следующей ступени
      const firstCompletion = nextRole ? !completedRoles.has(nextRole) : !completedRoles.has(role);
      if (allDone && firstCompletion) { // роль пройдена впервые (для ролей вне лестницы nextRole может отсутствовать)
        const updatedRoles = new Set([...completedRoles, role]);
        if (nextRole) updatedRoles.add(nextRole); // разблокируем следующую, если есть
        try { localStorage.setItem("sa_completed_roles"+uk, JSON.stringify([...updatedRoles])); } catch(e) {}
        setCompletedRoles(updatedRoles);
        if (profile) {
          const newRoles = [role, nextRole].filter(Boolean);
          newRoles.forEach(r => {
            rpcSync("save_completed_role", { p_token: saToken(), p_role: r });
          });
        }
        setTimeout(() => checkAndShowAchievements(newScores, newPracticeStars, updatedRoles), 500);
        vibrate("heavy");
        setTimeout(() => setScreen("roleComplete"), 50);
      } else {
        vibrate("success");
        setTimeout(() => setScreen("module"), 50);
      }
    } catch(e) {
      console.error("completeLesson error:", e);
      setScreen("module");
    }
  }, [activeLesson, profile, quizState.answers, role, practiceState, scores, practiceStars, completed, quizDone, completedRoles, checkAndShowAchievements]);
  const handleQuiz = useCallback((idx) => {
    if (quizState.blocked) return;
    const q = activeLesson.questions[quizState.step];
    const isCorrect = idx === q.correct;
    // Аналитика вопросов (stage 7): очередь тихо отбросит вызов, если RPC ещё не создан
    try { rpcSync("log_quiz_answer", { p_token: saToken(), p_role: role, p_lesson: activeLesson.id, p_question: (q.q || "").slice(0, 300), p_correct: isCorrect }); } catch(e) {}
    const newMistakes = quizState.mistakes + (isCorrect ? 0 : 1);
    const answers = [...quizState.answers, { idx, isCorrect }];
    const done = quizState.step + 1 >= activeLesson.questions.length;
    if (isCorrect) vibrate("light");
    else {
      vibrate("error");
      const _qe = { q: q.q, options: q.options, correct: q.correct, explanation: q.explanation || "", img: q.img || null, lessonTitle: (activeLesson && activeLesson.title) || "", stage: 0, due: Date.now() };
      setMistakeBank(prev => {
        if (prev.some(m => m.q === q.q)) return prev;
        const nx = [...prev, _qe].slice(-200);
        try { localStorage.setItem("sa_mistakes", JSON.stringify(nx)); } catch(e) {}
        return nx;
      });
    }
    if (newMistakes >= 3 && !isCorrect) {
      setQuizState({ step: quizState.step, answers, done: true, mistakes: newMistakes, blocked: true });
      return;
    }
    setQuizState({ step: done ? quizState.step : quizState.step + 1, answers, done, mistakes: newMistakes, blocked: false });
  }, [quizState, activeLesson, role]);
  // Верный ответ: вопрос уходит на следующий интервал (1→3→7→30 дней). После 4 верных подряд — закреплён и удаляется.
  const resolveMistake = useCallback((qText) => {
    setMistakeBank(prev => {
      const next = prev.map(m => {
        if (m.q !== qText) return m;
        const stage = (m.stage || 0) + 1;
        if (stage > SR_DAYS.length) return null; // вопрос закреплён
        return { ...m, stage, due: Date.now() + SR_DAYS[stage - 1] * 24 * 3600 * 1000 };
      }).filter(Boolean);
      try { localStorage.setItem("sa_mistakes", JSON.stringify(next)); } catch(e) {}
      return next;
    });
  }, []);
  // Неверный ответ при повторе: прогресс сгорает, вопрос снова доступен сразу
  const failMistake = useCallback((qText) => {
    setMistakeBank(prev => {
      const next = prev.map(m => m.q === qText ? { ...m, stage: 0, due: Date.now() } : m);
      try { localStorage.setItem("sa_mistakes", JSON.stringify(next)); } catch(e) {}
      return next;
    });
  }, []);
  const flashTimerRef = useRef(null);
  const handlePracticeChoice = useCallback((idx) => {
    let vibratePattern = null;
    setPracticeState(p => {
      if (p.isAnswered) return p;
      const sit = p.situations[p.step];
      if (!sit) return p;
      const isCorrect = idx === sit.correct;
      const newCombo = isCorrect ? p.combo + 1 : 0;
      const pts = isCorrect ? (newCombo >= 2 ? 20 : 10) : 0;
      vibratePattern = isCorrect ? (newCombo >= 2 ? "medium" : "light") : "error";
      return { ...p, choice: idx, isAnswered: true, lives: isCorrect ? p.lives : p.lives - 1, score: p.score + pts, combo: newCombo, flash: isCorrect ? "win" : "fail" };
    });
    if (vibratePattern) vibrate(vibratePattern);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setPracticeState(p => ({ ...p, flash: null })), 600);
  }, []);
  const handlePracticeNext = useCallback(() => {
    setPracticeState(p => {
      const sit = p.situations[p.step];
      if (!sit) return p;
      const isCorrect = p.choice === sit.correct;
      const results = [...p.results, isCorrect];
      const nextStep = p.step + 1;
      const gameover = p.lives <= 0 && !isCorrect;
      if (nextStep >= p.situations.length || gameover) {
        return { ...p, results, done: true, isAnswered: false };
      }
      return { ...p, step: nextStep, choice: null, isAnswered: false, results, flash: null, timerUrgent: false };
    });
  }, []);

  const leaderboard = useMemo(() => Object.values(
    dedupeBestScores(scores).reduce((acc, s) => {
      const key = `${s.name}|${s.surname}|${s.restaurant}`;
      if (!acc[key]) acc[key] = { name: s.name, surname: s.surname, restaurant: s.restaurant, role: s.role, position: s.position || "waiter", total: 0, sum: 0 };
      acc[key].total++; acc[key].sum += s.pct;
      return acc;
    }, {})
  ).map(p => ({ ...p, avg: Math.round(p.sum / p.total) })).sort((a, b) => b.avg - a.avg), [scores]);

  const T = a11y ? A : S;

  // Тяжёлые данные (СПГ-модули, живые диалоги) догружаются после первой
  // отрисовки — старт приложения их не ждёт. Тик состояния перерисовывает
  // интерфейс, когда данные готовы.
  // ── Онбординг: приветствие один раз в жизни + подсказка о повторении ──
  const [welcome, setWelcome] = useState(false);
  const [mistakeHint, setMistakeHint] = useState(false);
  useEffect(() => {
    if (!profile || !storageLoaded) return;
    try { if (localStorage.getItem("sa_welcome_seen_v2") !== "1") setWelcome(true); } catch (e) {}
  }, [profile, storageLoaded]);
  const closeWelcome = () => {
    try { localStorage.setItem("sa_welcome_seen_v2", "1"); } catch (e) {}
    vibrate("light");
    setWelcome(false);
  };
  // Контекстная подсказка: появляется в момент, когда впервые есть что повторить
  const dueMistakes = mistakeBank.filter(m => !m.due || m.due <= Date.now()).length;
  useEffect(() => {
    if (welcome || !profile) return;
    if (dueMistakes > 0 && ["home", "roleSelect"].includes(screen)) {
      try { if (localStorage.getItem("sa_hint_mistakes") !== "1") setMistakeHint(true); } catch (e) {}
    }
  }, [dueMistakes, screen, welcome, profile]);
  const [hintLeaving, setHintLeaving] = useState(false);
  const closeMistakeHint = (go) => {
    if (hintLeaving) return;
    try { localStorage.setItem("sa_hint_mistakes", "1"); } catch (e) {}
    if (go) vibrate("light");
    setHintLeaving(true); // плавный уход вниз, затем размонтирование
    setTimeout(() => {
      setMistakeHint(false);
      setHintLeaving(false);
      if (go) navigate("mistakes");
    }, 240);
  };

  const [, bumpLazyData] = useState(0);
  useEffect(() => {
    // 1) Сначала данные, без которых главные экраны неполные
    Promise.all([loadSpgModules(), loadDialogues()]).then(() => bumpLazyData(x => x + 1));
    // 2) Затем тихо прогреваем ленивые экраны: пока человек смотрит на главную,
    //    их код доезжает фоном — и первое открытие любого раздела мгновенно,
    //    скелетон остаётся только для очень медленной сети в первые секунды.
    const warm = setTimeout(() => {
      [
        () => import("./ui/menu-trainer"),
        () => import("./ui/guestbook"),
        () => import("./ui/ReferenceSection"),
        () => import("./ui/search"),
        () => import("./ui/sos"),
        () => import("./ui/mentor"),
        () => import("./ui/training-card"),
        () => import("./ui/candidate"),
        () => import("./ui/assistant"),
      ].reduce((p, load) => p.then(() => load().catch(() => {})), Promise.resolve());
    }, 1500);
    return () => clearTimeout(warm);
  }, []);

  if (!storageLoaded) return (
    <div style={{ ...T.app, alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:18 }}>
        <img src={LOGO_SRC_DARK} alt="" style={{ width:150, animation:'logoPulse 1.6s ease-in-out infinite', filter:"brightness(0) saturate(100%) invert(95%) sepia(10%) saturate(400%) hue-rotate(340deg) brightness(98%)" }} />
        <div style={{ color:'#9A8C74', fontSize:11, fontFamily:'monospace', letterSpacing:3 }}>ЗАГРУЗКА</div>
      </div>
    </div>
  );

  return (
    <div style={T.app}>
      {/* 🏆 Achievement popup */}
      {newAchievement && (
        <AchievementPopup ach={newAchievement} a11y={a11y} onClose={() => setNewAchievement(null)} />
      )}

      <div style={T.phone}>
        {!["profile","login"].includes(screen) && (
          <div style={T.a11yBar}>
            <span style={{ ...T.a11yLabel, color:GOLD_LOGO, fontSize:13, letterSpacing:3, fontFamily:"monospace" }}>✦ SA</span>
            <button style={{ ...T.a11yBtn, background: a11y ? "#7C9E87" : "#E8A020" }} onClick={() => setA11y(!a11y)}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}>{a11y ? UI_SVG.moon("currentColor", 12) : UI_SVG.eye("currentColor", 12)}{a11y ? "Тёмная" : "Для чтения"}</span>
            </button>
          </div>
        )}

        {/* Ключ по экрану: каждый переход мягко въезжает (см. .sa-pagein в css.js) */}
        {/* Ключ включает тему: переключение «Тёмная/Для чтения» перерисовывает
            экран начисто — лечит iOS-призраки старого рендера под стеклом.
            Исключение — «Собеседование»: там живёт прогресс интервью,
            перемонтаж его уничтожил бы (тема переключается без пересборки) */}
        <div key={screen + (screen === "candidate" ? "" : (a11y ? "|r" : "|d"))} className="sa-pagein">
        {screen === "login" && <CodeLoginScreen T={S} onSuccess={handleLogin} />}
        {/* ── Книга отзывов ── */}
        {screen === "guestbook" && <Suspense fallback={<ScreenLoader T={T} />}><GuestBookScreen T={T} a11y={a11y} profile={profile} role={role} completed={completed} quizDone={quizDone} examResults={examResults} focusId={bookFocus} onBack={() => { setBookFocus(null); navigate(prevScreen && prevScreen !== "weeklyGuest" && prevScreen !== "guestbook" ? prevScreen : "roleSelect"); }} onWeekly={() => navigate("weeklyGuest")} /></Suspense>}
        {/* «Гость недели»: живой диалог из книги; завершение = страница в книге */}
        {screen === "weeklyGuest" && <LiveDialogue key={weeklyLessonId()} dialogueId={weeklyDialogueId()} T={T} color={"#C8A96E"} onClose={(finished) => {
          try {
            const uk = profile ? `_${profile.name}_${profile.surname||""}` : "";
            const wid = weeklyLessonId();
            // Испытание засчитывается только если диалог реально доведён до конца (и гость не ушёл)
            if (finished === true && !completed[wid]) {
              const nc = { ...completed, [wid]: true };
              setCompleted(nc);
              try { localStorage.setItem("sa_completed"+uk, JSON.stringify(nc)); } catch(e) {}
            }
          } catch(e) {}
          navigate("guestbook");
        }} pro={true} />}
        {screen === "team" && profile?.is_admin && <TeamScreen T={T} profile={profile} a11y={a11y} onCandidate={() => navigate("candidate")} />}
        {screen === "candidate" && (profile?.is_admin || ["manager","senior"].includes(profile?.position)) && <Suspense fallback={<ScreenLoader T={T} />}><CandidateScreen T={T} a11y={a11y} profile={profile} customLessons={customLessons} onBack={() => navigate(profile?.is_admin ? "team" : "roleSelect")} /></Suspense>}
        {screen === "checklist" && <div style={{paddingBottom:88}}><ChecklistScreen T={T} a11y={a11y} profile={profile} onBack={() => navigate("roleSelect")} /></div>}
        {screen === "onboarding" && <div style={{paddingBottom:88}}><OnboardingScreen T={T} a11y={a11y} profile={profile} role={role} onBack={() => navigate("roleSelect")} /></div>}
        {screen === "analytics" && <div style={{paddingBottom:88}}><AnalyticsScreen T={T} a11y={a11y} profile={profile} scores={scores} onBack={() => navigate("roleSelect")} /></div>}
        {screen === "contentEditor" && <ContentEditorScreen T={T} a11y={a11y} onBack={() => { loadCustomLessons(); navigate("roleSelect"); }} />}
        {screen === "profile" && <AccountScreen profile={profile} T={T} onBack={() => navigate(prevScreen || "roleSelect")} onLogout={handleLogout} onTrainingCard={() => navigate("trainingCard")} />}
        {screen === "playerDetail" && selectedPlayer && <PlayerDetailScreen player={selectedPlayer} T={T} onBack={() => navigate("stats")} />}
        {screen === "stats" && <div style={{paddingBottom:88}}><StatsScreen T={T} profile={profile} scores={scores} completedRoles={completedRoles} completed={completed} quizDone={quizDone} examResults={examResults} practiceStars={practiceStars} allProfiles={allProfiles} onBack={() => navigate("roleSelect")}
          onResetPlayer={isAdmin ? (name, surname) => {
            setScores(prev => prev.filter(s => !(s.name === name && s.surname === surname)));
            if (profile && profile.name === name && profile.surname === surname) {
              setCompleted({});
              setQuizDone({});
              setCompletedRoles(new Set());
              setRole(null);
              try { const uk = `_${name}_${surname||""}`; localStorage.removeItem("sa_completed"+uk); localStorage.removeItem("sa_completed_roles"+uk); localStorage.removeItem("sa_last_role"); } catch(e) {}
              try { localStorage.removeItem("sa_quiz_done"); } catch(e) {}
              try { localStorage.removeItem("sa_scores"); } catch(e) {}
              try { localStorage.removeItem("sa_practice_stars"); } catch(e) {}
            }
            rpc("admin_reset_player", { p_token: saToken(), p_name: name, p_surname: surname || "" }).catch(() => {});
            // Сразу обнуляем звёзды в state и localStorage
            setPracticeStars(prev => { const n = {...prev}; delete n[`${name}|${surname||""}`]; return n; });
            try { localStorage.removeItem("sa_practice_stars"); } catch(e) {}
            // practice_stars / completed_roles / profiles на сервере уже удалены через admin_reset_player выше
            // Очищаем localStorage для любого пользователя
            try { const uk = `_${name}_${surname||""}`; localStorage.removeItem("sa_completed"+uk); localStorage.removeItem("sa_completed_roles"+uk); } catch(e) {}
            // Ачивки тоже сбрасываем
            try { ["god","master","core","pioneer"].forEach(k => localStorage.removeItem(`sa_ach_${k}_${name}_${surname||""}`)); } catch(e) {}
            navigate("roleSelect");
          } : null}
          onUnlockQuiz={isAdmin ? (name, surname) => {
            rpc("admin_unlock_quiz", { p_token: saToken(), p_name: name, p_surname: surname || "" }).then(() => {
              if (profile && profile.name === name && profile.surname === surname) {
                setQuizDone({});
                try { localStorage.removeItem("sa_quiz_done"); } catch(e) {}
              }
              const msg = `Тесты для ${name} ${surname} разблокированы!`;
              if (window.Telegram?.WebApp?.showAlert) window.Telegram.WebApp.showAlert(msg); else alert(msg);
            }).catch(() => {});
          } : null}
          onViewPlayer={(p) => { setSelectedPlayer(p); navigate("playerDetail"); }}
        /></div>}
        {screen === "daily" && <DailyScreen T={T} profile={profile} completed={completed} quizDone={quizDone} role={role} modules={modules} onBack={() => navigate("roleSelect")} onReferenceLesson={(id) => { setRefStart(id); navigate("reference"); }} onLesson={(lesson, mod) => { setActiveLesson(shuffleLessonQuestions(lesson)); setActiveModule(mod); navigate("lesson"); }} />}
        {screen === "roleSelect" && <div style={{paddingBottom:88}}><RoleSelect onSelect={selectRole} T={T} a11y={a11y} profile={profile} completedRoles={completedRoles} onLeaderboard={() => navigate("leaderboard")} onProfile={() => navigate("profile")} onStats={() => navigate("stats")} onDaily={() => navigate("daily")} onGlossary={() => navigate("glossary")} role={role} onChecklist={() => navigate("checklist")} onOnboarding={() => navigate("onboarding")} onAnalytics={() => navigate("analytics")} onReference={() => { setRefStart(null); navigate("reference"); }} onContentEditor={() => navigate("contentEditor")} onCertificates={CERTIFICATES_ENABLED ? () => navigate("certificates") : undefined} onMenuTrainer={() => navigate("menuTrainer")} onMentor={() => navigate("mentor")} onSOS={() => navigate("sos")} onAssistant={() => navigate("assistant")} onCandidate={(profile?.is_admin || ["manager","senior"].includes(profile?.position)) ? () => navigate("candidate") : null} onGuestBook={() => { setBookFocus(null); navigate("guestbook"); }} completed={completed} quizDone={quizDone} examResults={examResults} mistakeBank={mistakeBank} onContinueLesson={(l, m) => { setActiveLesson(shuffleLessonQuestions(l)); setActiveModule(m); navigate("lesson"); }} onMistakes={() => navigate("mistakes")} /></div>}
        {screen === "glossary" && <div style={{paddingBottom:88}}><GlossaryScreen T={T} a11y={a11y} onBack={() => navigate("roleSelect")} color="#C8A96E" saved={saved} onToggleFav={toggleFav} onSetNote={setNote} /></div>}
        {screen === "leaderboard" && <div style={{paddingBottom:88}}><LeaderboardScreen T={T} leaderboard={leaderboard} scores={scores} profile={profile} practiceStars={practiceStars} onBack={() => navigate("roleSelect")} /></div>}
        {screen === "home" && <div style={{paddingBottom:88}}><HomeScreen role={ROLES.find(r=>r.id===role)} modules={MODULES[role]} completed={completed} quizDone={quizDone} progress={progress} doneCount={doneCount} totalLessons={totalLessons} onModule={openModule} onChangeRole={() => navigate("roleSelect")} T={T} streak={streak} a11y={a11y} profile={profile} onChecklist={() => navigate("checklist")} onOnboarding={() => navigate("onboarding")} onAnalytics={() => navigate("analytics")} mistakeBank={mistakeBank} onMistakes={() => navigate("mistakes")} customModules={customModules} onSearch={() => navigate("search")} /></div>}
        {screen === "mistakes" && <MistakesScreen T={T} a11y={a11y} mistakeBank={mistakeBank} onResolve={resolveMistake} onFail={failMistake} onBack={() => navigate(prevScreen || "home")} />}
        {screen === "search" && <div style={{paddingBottom:88}}><Suspense fallback={<ScreenLoader T={T} />}><SearchScreen T={T} a11y={a11y} role={ROLES.find(r=>r.id===role)} profile={profile} modules={[...(MODULES[role] || []), ...(customModules || [])]} onOpen={(m, l) => { setActiveModule(m); openLesson(l); }} onReferenceLesson={(id) => { setRefStart(id); navigate("reference"); }} onBack={() => navigate(prevScreen || "home")} /></Suspense></div>}
        {screen === "menuTrainer" && <div style={{paddingBottom:88}}><Suspense fallback={<ScreenLoader T={T} />}><MenuTrainerScreen T={T} a11y={a11y} profile={profile} onBack={() => navigate(prevScreen || "roleSelect")} /></Suspense></div>}
        {screen === "trainingCard" && <Suspense fallback={<ScreenLoader T={T} />}><TrainingCardScreen T={T} a11y={a11y} profile={profile} completed={completed} quizDone={quizDone} examResults={examResults} onBack={() => navigate("profile")} /></Suspense>}
        {screen === "sos" && <div style={{paddingBottom:88}}><Suspense fallback={<ScreenLoader T={T} />}><SOSScreen T={T} a11y={a11y} onBack={() => navigate(prevScreen || "roleSelect")} /></Suspense></div>}
        {screen === "assistant" && <Suspense fallback={<ScreenLoader T={T} />}><AssistantScreen T={T} a11y={a11y} profile={profile} onBack={() => navigate(prevScreen || "roleSelect")} /></Suspense>}
        {screen === "mentor" && <div style={{paddingBottom:88}}><Suspense fallback={<ScreenLoader T={T} />}><MentorScreen T={T} a11y={a11y} profile={profile} role={role} roleObj={ROLES.find(r=>r.id===role)} onBack={() => navigate(prevScreen || "roleSelect")} /></Suspense></div>}
        {screen === "module" && <div style={{paddingBottom:88}}><NewPageBanner T={T} mod={activeModule} completed={completed} quizDone={quizDone} onOpen={() => { setBookFocus(activeModule?.id || null); navigate("guestbook"); }} /><ModuleScreen mod={activeModule} completed={completed} quizDone={quizDone} onBack={() => navigate("home")} onLesson={openLesson} T={T} /></div>}
        {/* Урок-диалог: порталом в body — внутри анимируемой обёртки переходов
            WebKit ломает position:fixed у шторки (см. фикс пути из поппапа) */}
        {screen === "lesson" && activeLesson?.type === "dialogue" && createPortal(
          <LiveDialogue key={"dlg-" + gameKey} dialogueId={activeLesson.dialogueId} T={T} color={activeModule?.color} onClose={completeLesson} pro={true} />
        , document.body)}
        {screen === "lesson" && activeLesson?.type !== "dialogue" && <LessonScreen key={gameKey} lesson={activeLesson} color={activeModule?.color} onBack={() => navigate("module")} onComplete={completeLesson} quizState={quizState} onQuiz={handleQuiz} practiceState={practiceState} setPracticeState={setPracticeState} onPracticeChoice={handlePracticeChoice} onPracticeNext={handlePracticeNext} T={T} />}
        {screen === "roleComplete" && <RoleCompleteScreen role={ROLES.find(r=>r.id===role)} nextRole={ROLE_ORDER.indexOf(role) >= 0 ? ROLES.find(r=>r.id===ROLE_ORDER[ROLE_ORDER.indexOf(role)+1]) : undefined} T={T} onNext={() => navigate("roleSelect")} onExam={CERTIFICATES_ENABLED ? () => openExam(role) : undefined} />}
        {screen === "reference" && <Suspense fallback={<ScreenLoader T={T} />}><ReferenceSection key={refStart || "hub"} T={T} a11y={a11y} startLessonId={refStart} onExit={() => navigate(prevScreen || "roleSelect")} /></Suspense>}
        {screen === "certificates" && <CertificatesScreen T={T} a11y={a11y} profile={profile} completedRoles={completedRoles} examResults={examResults} completed={completed} quizDone={quizDone} onExam={openExam} onCertificate={openCertificate} onExit={() => navigate("roleSelect")} />}
        {screen === "exam" && <ExamScreen T={T} a11y={a11y} roleObj={ROLES.find(r=>r.id===examRole)} roleId={examRole} onFinish={(id, result) => { recordExam(id, result); if (result.passed) openCertificate(id); }} onExit={() => navigate("certificates")} />}
        {screen === "certificate" && <CertificateScreen T={T} a11y={a11y} profile={profile} roleObj={ROLES.find(r=>r.id===examRole)} result={examResults[examRole]} onExit={() => navigate("certificates")} onShare={() => { const ro = ROLES.find(r=>r.id===examRole); const txt = `Я сдал(а) экзамен на роль «${ro?.label||""}» в Service Academy! ${APP_SHARE_URL}`; try { if (navigator.share) { navigator.share({ text: txt, url: APP_SHARE_URL }); } else if (navigator.clipboard) { navigator.clipboard.writeText(txt); } } catch(e) {} }} />}
        </div>

        {/* Онбординг: приветствие при первом входе */}
        {welcome && <WelcomeIntro T={T} a11y={a11y} isAdmin={!!profile?.is_admin} canHire={!!profile?.is_admin || ["manager","senior"].includes(profile?.position)} onClose={closeWelcome} />}
        {/* Контекстная подсказка о повторении — над навбаром, показывается один раз */}
        {mistakeHint && !welcome && (
          <div className="sa-hintin" style={{ position: "fixed", left: 16, right: 16, bottom: 104, zIndex: 400,
              maxWidth: 420, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 16,
              opacity: hintLeaving ? 0 : 1, transform: hintLeaving ? "translateY(14px)" : undefined,
              transition: "opacity .24s ease, transform .24s ease",
              background: a11y ? "rgba(250,246,236,0.94)" : "rgba(30,22,10,0.94)",
              backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
              border: a11y ? "1px solid rgba(139,106,48,0.45)" : "1px solid rgba(200,160,80,0.42)",
              boxShadow: a11y
                ? "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 30px rgba(70,50,15,0.25)"
                : "inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 30px rgba(0,0,0,0.5)" }}>
            <span className="sa-pulse" style={{ display: "flex", flexShrink: 0 }}>{UI_SVG.target(a11y ? "#8B6A30" : "#C8A96E", 18)}</span>
            <div onClick={() => closeMistakeHint(true)} {...onActivate(() => closeMistakeHint(true))}
              style={{ flex: 1, cursor: "pointer", color: T.modSub?.color || "#C8B898", fontSize: a11y ? 14 : 12.5, lineHeight: 1.5 }}>
              Появились вопросы на повторение — загляни в «Работу над ошибками»
            </div>
            <button className="sa-btn" onClick={() => closeMistakeHint(false)}
              style={{ border: "none", background: "transparent", color: T.modSub?.color || "#9A8C74", fontSize: 15, cursor: "pointer", padding: 4, flexShrink: 0 }}>✕</button>
          </div>
        )}

        {/* Плавающий AI-ассистент — главный вход во флагманскую фичу */}
        {["roleSelect","home","module","leaderboard","glossary","stats","daily","playerDetail","team"].includes(screen) && profile && !welcome && !mistakeHint && (
          <AiFab a11y={a11y} onClick={() => navigate("assistant")} />
        )}

        {/* Нижняя навигация — только на основных экранах */}
        {["roleSelect","home","module","leaderboard","glossary","stats","daily","playerDetail","team"].includes(screen) && profile && (
          <LiquidTabBar
            a11y={a11y}
            activeId={screen}
            onTab={(id) => { if (screen !== id) vibrate("light"); navigate(id); }}
            tabs={[
              { id:"roleSelect", icon:"home",        label:"Главная" },
              { id:"daily",      icon:"daily",       label:"Задания" },
              { id:"glossary",   icon:"glossary",    label:"Глоссарий" },
              { id:"leaderboard",icon:"leaderboard", label:"Рейтинг" },
              ...(profile?.is_admin ? [{ id:"team", icon:"team", label:"Команда" }] : []),
              { id:"stats",      icon:"stats",       label:"Профиль" },
            ]}
          />
        )}
      </div>
    </div>
  );
}

// ── НИЖНЯЯ НАВИГАЦИЯ: «ЖИДКОЕ СТЕКЛО» ───────────────────────────────
// Плавающий пилл + прозрачная стеклянная «линза» в размер бара.
// Линзу можно тянуть пальцем — она следует за пальцем и с пружиной
// прилипает к ближайшей вкладке. При нажатии вкладка под линзой плавно
// увеличивается (без слоя-копии — ничего не двоится).
function LiquidTabBar({ tabs, activeId, onTab, a11y }) {
  const n = tabs.length;
  const activeIdx = tabs.findIndex(t => t.id === activeId);
  const lastIdxRef = useRef(activeIdx >= 0 ? activeIdx : 0);
  if (activeIdx >= 0) lastIdxRef.current = activeIdx;
  const restIdx = activeIdx >= 0 ? activeIdx : lastIdxRef.current;

  const barRef = useRef(null);
  const [barW, setBarW] = useState(0);
  useEffect(() => {
    const m = () => { if (barRef.current) setBarW(barRef.current.clientWidth); };
    m();
    window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, []);

  const [dragX, setDragX] = useState(null); // x центра линзы, пока её тянут пальцем
  const [pressed, setPressed] = useState(false); // палец на баре
  const drag = useRef(null);

  const BAR_H = 58;
  const cellW = barW > 0 ? barW / n : 0;
  const lensW = cellW ? Math.max(44, cellW - 6) : 0; // компактнее ячейки
  const rawC = dragX !== null ? dragX : (restIdx + 0.5) * cellW;
  const cx = cellW ? Math.max(lensW / 2 + 4, Math.min(barW - lensW / 2 - 4, rawC)) : 0;
  const litIdx = dragX !== null
    ? Math.max(0, Math.min(n - 1, Math.floor(dragX / cellW)))
    : activeIdx; // -1 — ничего не подсвечено (экран вне вкладок)
  const lensVisible = cellW > 0 && (dragX !== null || activeIdx >= 0);

  const accent = a11y ? "#6B4E1A" : GOLD;
  const dim = a11y ? "#5C3D10" : "#9A8060";
  const spring = "cubic-bezier(0.3,1.3,0.45,1)";

  const evX = (e) => {
    const r = barRef.current ? barRef.current.getBoundingClientRect() : { left: 0 };
    return (e.clientX != null ? e.clientX : 0) - r.left;
  };
  const onDown = (e) => {
    if (!cellW) return;
    setPressed(true);
    drag.current = { x0: evX(e), moved: false, last: null };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const x = evX(e);
    if (!drag.current.moved && Math.abs(x - drag.current.x0) < 6) return;
    drag.current.moved = true;
    setDragX(x);
    const hi = Math.max(0, Math.min(n - 1, Math.floor(x / cellW)));
    if (drag.current.last !== null && drag.current.last !== hi) vibrate("light");
    drag.current.last = hi;
  };
  const onUp = (e) => {
    if (!drag.current) return;
    const x = evX(e);
    drag.current = null;
    setDragX(null);
    setPressed(false);
    const i = Math.max(0, Math.min(n - 1, Math.floor(x / cellW)));
    if (tabs[i]) onTab(tabs[i].id);
  };
  const onCancel = () => { drag.current = null; setDragX(null); setPressed(false); };

  return (
    <div style={{ position:"fixed", left:10, right:10, zIndex:200,
      bottom:"calc(max(env(safe-area-inset-bottom, 0px), 8px) + 8px)" }}>
      {/* Разрешаем горизонтальный жест на баре: обходим глобальные touch-action и JS-блокировку свайпов */}
      <style>{`.sa-lensbar.sa-hscroll, .sa-lensbar.sa-hscroll * { touch-action: none !important; }`}</style>
      {/* Плавающий пилл */}
      <div ref={barRef} className="sa-lensbar sa-hscroll"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
        style={{ position:"relative", height:BAR_H, borderRadius:999, display:"flex", alignItems:"stretch",
          background: a11y ? "rgba(255,252,244,0.30)" : "rgba(255,250,238,0.06)",
          border: a11y ? "1px solid rgba(139,106,48,0.32)" : "1px solid rgba(255,255,255,0.14)",
          boxShadow: a11y
            ? "inset 0 0 22px rgba(255,255,255,0.5), inset 0 1px 0 rgba(255,255,255,0.85), 0 6px 20px rgba(120,90,30,0.14)"
            : "inset 0 0 22px rgba(255,248,230,0.06), inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 30px rgba(0,0,0,0.5)",

          userSelect:"none", WebkitUserSelect:"none" }}>
        {tabs.map((tab, i) => {
          const lit = i === litIdx;
          return (
            <div key={tab.id} role="button" tabIndex={0} aria-label={tab.label}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTab(tab.id); } }}
              style={{ flex:1, minWidth:0, height:"100%", display:"flex", alignItems:"center",
                justifyContent:"center", cursor:"pointer", outline:"none" }}>
              {/* при нажатии вкладка под линзой плавно растёт */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, maxWidth:"100%",
                transform: (pressed && lit) ? "scale(1.16)" : "scale(1)",
                transition:`transform 0.3s ${spring}` }}>
                <div style={{ height:24, display:"flex", alignItems:"center", justifyContent:"center",
                  opacity: lit ? 1 : 0.62, transition:"opacity 0.25s ease" }}>
                  {NAV_ICONS[tab.icon](lit ? accent : dim)}
                </div>
                <div style={{ fontSize:9.5, fontFamily:"Georgia, serif", letterSpacing:0.3, fontWeight:"bold",
                  whiteSpace:"nowrap", overflow:"hidden", maxWidth:"100%", textOverflow:"ellipsis",
                  color: lit ? accent : dim, opacity: lit ? 1 : 0.72,
                  transition:"color 0.25s ease, opacity 0.25s ease" }}>{tab.label}</div>
              </div>
            </div>
          );
        })}
        {/* Прозрачная линза в размер бара — те же стили, что в сегментах */}
        {lensVisible && (
          <div aria-hidden style={{
            position:"absolute", top:5, left: cx - lensW/2, width: lensW, height:BAR_H - 10,
            zIndex:2, pointerEvents:"none",
            transition: dragX !== null ? "none" : `left 0.5s ${spring}`,
          }}>
            <div style={{
              position:"relative", width:"100%", height:"100%", borderRadius:999, overflow:"hidden",
              transform: pressed ? "scale(1.04)" : "scale(1)",
              transition:"transform 0.25s ease",
              background: a11y
                ? "linear-gradient(180deg, rgba(139,106,48,0.15), rgba(139,106,48,0.07))"
                : "linear-gradient(180deg, rgba(200,169,110,0.16), rgba(200,169,110,0.08))",
              boxShadow: a11y
                ? "inset 0 1px 1px rgba(255,255,255,0.40), 0 2px 6px rgba(0,0,0,0.08), 0 0 0 1px rgba(107,78,26,0.15)"
                : "inset 0 0 0 1px rgba(255,255,255,0.13), inset 0 1px 0 rgba(255,255,255,0.10), 0 3px 10px rgba(0,0,0,0.22)",
            }}>
              {/* хроматическая (радужная) кромка */}
              <div style={{
                position:"absolute", inset:0, borderRadius:999, padding:1.5, opacity: a11y ? 0.4 : 0.3,
                background:"conic-gradient(from 210deg, rgba(255,90,90,0.6), rgba(255,205,70,0.55), rgba(120,235,160,0.5), rgba(95,175,255,0.6), rgba(200,125,255,0.55), rgba(255,90,90,0.6))",
                WebkitMask:"linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite:"xor", maskComposite:"exclude",
                filter:"blur(0.6px)",
              }} />
              {/* тонкая световая кромка сверху */}
              <div style={{ position:"absolute", top:1, left:"12%", right:"12%", height:1.5, borderRadius:999,
                background:`linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,${a11y ? 0.4 : 0.18}), rgba(255,255,255,0))` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── КОНФЕТТИ ──────────────────────────────────────────────────────────
// ── ЭКРАН ЗАВЕРШЕНИЯ РОЛИ ────────────────────────────────────────────

// ── Ежедневные задания ─────────────────────────────────────
// ── Личная статистика ──────────────────────────────────────

// ── Детальная статистика сотрудника ───────────────────────
// ── Страница регистрации ───────────────────────────────────
// Статичные объекты стилей вне компонента — не пересоздаются при каждом рендере


// ── Команда: админка управления сотрудниками ─────────────────
// ── Вход по коду-приглашению ─────────────────────────────────
// ── Аккаунт: кто я + выход ───────────────────────────────────
// ── Редактор контента («Свой контент») — этап 1: CRUD уроков (бэкенд cms_*) ──
// ── Работа над ошибками (#5) + Слабые темы (#6) — общая копилка sa_mistakes ──


// ─── ПАЛИТРА (ТЁПЛАЯ) ──────────────────────────────────────
// BG:     #1C1510  тёмный тёплый — обожжённое дерево
// Card:   #251C14  немного светлее
// Lift:   #2F2318  карточки
// Gold:   #D4A85A  акцент
// Text:   #F0EAE0  тёплый белый
// Sub:    #8A7E70  вторичный текст
// Green:  #5DBB8A  успех
// Red:    #E07070  ошибка
// ────────────────────────────────────────────────────────────

// ── Глоссарий терминов ────────────────────────────────────


// ── Данные живых диалогов ─────────────────────────────────


// Тёмная тема: глубокий антрацит + тёплые золотые акценты
// BG:     #18181C  (почти чёрный, чуть тёплый)
// Card:   #222228  (чуть светлее BG)
// Lift:   #2A2A32  (карточки, поднятые элементы)
// Gold:   #D4A85A  (основной акцент)
// GoldS:  #B8903E  (приглушённое золото)
// Text:   #F0EBE0  (тёплый белый)
// Sub:    #9A9080  (подписи, вторичный текст)
// Green:  #5DBB8A  (успех)
// Red:    #E07070  (ошибка/запрет)
// ────────────────────────────────────────────────────────────



// ── Error Boundary — ловит любые ошибки рендера и показывает дружелюбный экран ──
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errMsg: String(error && (error.message || error)) };
  }
  componentDidCatch(error, info) {
    console.error("ServiceAcademy crashed:", error, info);
    try { this.setState({ errStack: String((info && info.componentStack || "").split("\n").slice(0, 4).join(" · ")) }); } catch (e) {}
  }
  handleReload = () => {
    try { window.location.reload(); } catch (e) { this.setState({ hasError: false }); }
  };
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", background: "linear-gradient(160deg, #14100A 0%, #1C1509 50%, #14110A 100%)", fontFamily: "Georgia, serif" }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🍷</div>
          <div style={{ color: CREAM, fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>Что-то пошло не так</div>
          <div style={{ color: "#9A8060", fontSize: 14, lineHeight: 1.7, maxWidth: 320, marginBottom: 24 }}>
            Произошёл сбой при загрузке экрана. Ваш прогресс сохранён — просто перезагрузите приложение.
          </div>
          <button onClick={this.handleReload} style={{ background: "linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)", color: "#fff", border: "none", borderRadius: 14, padding: "14px 28px", fontSize: 16, fontFamily: "Georgia, serif", cursor: "pointer", boxShadow: "0 4px 18px rgba(200,160,80,0.3)" }}>
            Перезагрузить
          </button>
          {/* Диагностика: текст ошибки для скриншота в поддержку */}
          {(this.state.errMsg || this.state.errStack) && (
            <div style={{ marginTop: 22, maxWidth: 330, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(140,106,38,0.3)", background: "rgba(0,0,0,0.25)" }}>
              <div style={{ color: "#756A58", fontSize: 9, letterSpacing: 2, fontFamily: "monospace", marginBottom: 5 }}>ДЛЯ ПОДДЕРЖКИ · СДЕЛАЙ СКРИНШОТ</div>
              <div style={{ color: "#9A8060", fontSize: 10.5, fontFamily: "monospace", lineHeight: 1.6, wordBreak: "break-word" }}>{this.state.errMsg}{this.state.errStack ? " | " + this.state.errStack : ""}</div>
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ServiceAcademy />
    </ErrorBoundary>
  );
}
