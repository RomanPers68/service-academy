import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import React from "react";

// ── Вынесенные модули ──────────────────────────────────────────────
import { rpc, saToken, rpcSync, flushQueue, rpcMissing, startBoot } from "./api/supabase";   // v59: без открытого ключа; v64 (Доп. 377): startBoot — старт одним запросом
import { customIcon, TRACK_COLOR } from "./lib/tracks";
import { buildCustomModules } from "./lib/custom-modules";
import { setCustomProgram } from "./data/modules";
import { setCustomBook } from "./data/reviews";
import { loopTrack, loopExit, loopOpen, loopPassed, loopUnseen, loopSeen, skipPayload, LoopholeCard, LoopholeBanner } from "./ui/loophole";
import { MODULES, loadRoleModules, loadAllModules, loadOpenModules, loadSpgModules, allLessonIds, roleOfLessonId } from "./data/modules";
import { useContentVersion } from "./lib/use-content";
import { HubScreen, ShiftHero, TeamHero, MeHero, frostOf, MastersBanner, TeamFeed } from "./ui/home-hubs";
import { buildFeed, quizTitles } from "./lib/team-feed";   // v57 (Доп. 370): «Жизнь команды»
import { MODULES_INDEX } from "./data/modules-index";
import { nextLessonOf, TRACK_GROUPS } from "./ui/screens-roleselect";
import { OfflineScreen } from "./ui/offline";
import { modeOfDay, dailyCount, dailyStreak } from "./lib/day-mode";
import { nextStreak, fresherStreak, liveStreak, dayOffFromSchedule, myShiftOn, shiftLabel, ymd } from "./lib/streak";
import { readActivity, bumpActivity, stepsOn, readGoal, saveGoal, weekSummary, ACTIVITY_EVENT } from "./lib/activity";
import { nowMode, nowCardText, daysAway, dayDiff } from "./lib/now-card";   // v56 (Доп. 369): «что сейчас» на главной
import { trackForPosition } from "./lib/position-track";   // v58 (Доп. 371): трек по должности
import { startTgScreen } from "./lib/tg-screen";   // v69 (Доп. 382): полноэкранный Telegram на телефоне
import { themeAutoOn, setThemeAuto, systemLight, watchSystemTheme } from "./lib/theme";   // v59 (Доп. 372): тема как в системе
import { UpdateToast } from "./ui/update-toast";   // v59 (Доп. 372)
import { pushLearning, scheduleLearningPush, scheduleDayPush, cancelDayPush } from "./lib/learning-sync";
import { warmupPool, pickWarmup, refreshPick } from "./lib/warmup";
import { readFresh, saveFresh, syncFresh, touchFresh, fadedList, moduleDone, INTERVALS } from "./lib/freshness";
import { layersReducer, layerData } from "./lib/layers";
import { useFreshMarks, useDayBrief, pairLineOf } from "./lib/use-day";
import { readCredits, readGold, saveCredit, saveGold, creditTriedToday, markCreditTry, creditPool, goldPool, creditPassed, goldPassed, canRefresh, canCredit, canGold, GOLD_TIMER, GOLD_N, CREDIT_PASS, CREDIT_N } from "./lib/marks";
// v40: «Путь мастера» — значки за привычки, «Мастер роли», шаг дня, первая неделя в академии
import { masteryFacts, masteryState, stepOfDay, stepLineText, readEarned, saveEarned, newlyEarned, mergeEarned, saveSummary, syncLife, readSeen, markSeen, newTools, isNewTool, mastersIndex, restoreFromCopy, TIERS, MASTER_NEED } from "./lib/mastery";
import { BadgeToast, StepLine, masteryChip } from "./ui/mastery-card";
import { tablePool } from "./lib/table-pick";
import { tasksFor, markQuestDone, questDays } from "./lib/quest";
import { playlist } from "./lib/radio";
import { readGuestRuns, guestSub } from "./lib/guest-lite";   // v79: лёгкая часть «Живого гостя» — без персонажей и сцен
import { recapMonth, monthRecap, MONTH } from "./lib/month-recap";
import { Flame } from "./ui/day-emblems";   // v70 (Доп. 383): пламя в строке напарника (была свеча из ./ui/table-bits)
import { DayChips, WarmupCard, RemindSheet, readRemindFlag, inTelegramApp } from "./ui/day-cards";
import { syncMySchedule } from "./lib/schedule-sync";
import { practiceQuestionTexts, mistakeFromSituation } from "./lib/practice-mistake";
import { LiquidTabBar, NavRail } from "./ui/tabbar";
import { useViewport, colWidthOf, homeTwoCols, RAIL_W } from "./ui/viewport";   // v50 (Доп. 363): горизонталь и компьютер
import { loadDialogues } from "./data/dialogues-lazy";
import { ROLES, RESTAURANTS } from "./data/roles";
import { LOGO_SRC, LOGO_SRC_DARK } from "./assets/logo";
import { normSurname, shuffleArray, dedupeBestScores, pickRandom, shuffleSituationOptions, vibrate, onActivate, shuffleLessonQuestions, isFemaleName, isTelegram, clickScreenBack } from "./lib/utils";

// ── Ленивые экраны: код и данные подгружаются при первом открытии ──
// (тренажёр меню, книга, SOS, наставничество, поиск, справочник,
//  карта обучения и собеседование не входят в стартовый бандл)
// Доп. 245: ленивый чанк на плохой связи — повторяем сами (3 попытки), а не роняем экран
const retryImport = (loader, tries = 3, delay = 600) => loader().catch(err => { if (tries <= 1 || (typeof navigator !== "undefined" && navigator.onLine === false && tries <= 2)) throw err; return new Promise(r => setTimeout(r, delay)).then(() => retryImport(loader, tries - 1, delay * 2)); });
const SearchScreen = lazy(() => retryImport(() => import("./ui/search")).then(m => ({ default: m.SearchScreen })));
const MenuTrainerScreen = lazy(() => retryImport(() => import("./ui/menu-trainer")).then(m => ({ default: m.MenuTrainerScreen })));
const CocktailsScreen = lazy(() => retryImport(() => import("./ui/cocktails")).then(m => ({ default: m.CocktailsScreen })));
const GuestBookScreen = lazy(() => retryImport(() => import("./ui/guestbook")).then(m => ({ default: m.GuestBookScreen })));
const MentorScreen = lazy(() => retryImport(() => import("./ui/mentor")).then(m => ({ default: m.MentorScreen })));
const SOSScreen = lazy(() => retryImport(() => import("./ui/sos")).then(m => ({ default: m.SOSScreen })));
const TrainingCardScreen = lazy(() => retryImport(() => import("./ui/training-card")).then(m => ({ default: m.TrainingCardScreen })));
const ReferenceSection = lazy(() => retryImport(() => import("./ui/ReferenceSection")).then(m => ({ default: m.ReferenceSection })));
const CandidateScreen = lazy(() => retryImport(() => import("./ui/candidate")).then(m => ({ default: m.CandidateScreen })));
const AssistantScreen = lazy(() => retryImport(() => import("./ui/assistant")).then(m => ({ default: m.AssistantScreen })));
// Доп. 309: отчёты по сотрудникам (Excel и PDF) — грузятся только руководителю и по кнопке
const ReportScreen = lazy(() => retryImport(() => import("./ui/report")).then(m => ({ default: m.ReportScreen })));
const LiveGuestScreen = lazy(() => retryImport(() => import("./ui/live-guest")).then(m => ({ default: m.LiveGuestScreen })));   // v30: Доп. 312
const QuestCard = lazy(() => retryImport(() => import("./ui/together")).then(m => ({ default: m.QuestCard })));   // Доп. 314
const PairSheet = lazy(() => retryImport(() => import("./ui/together")).then(m => ({ default: m.PairSheet })));   // Доп. 318
const LeagueScreen = lazy(() => retryImport(() => import("./ui/league")).then(m => ({ default: m.LeagueScreen })));   // Доп. 317
const RadioScreen = lazy(() => retryImport(() => import("./ui/radio")).then(m => ({ default: m.RadioScreen })));   // Доп. 319
const MonthRecap = lazy(() => retryImport(() => import("./ui/month-recap")).then(m => ({ default: m.MonthRecap })));   // Доп. 320
const CellarScreen = lazy(() => retryImport(() => import("./ui/cellar")).then(m => ({ default: m.CellarScreen })));   // v31: «Погреб тем»
const MasteryScreen = lazy(() => retryImport(() => import("./ui/mastery")).then(m => ({ default: m.MasteryScreen })));   // v40: «Путь мастера»
const ScheduleScreen = lazy(() => retryImport(() => import("./ui/schedule")).then(m => ({ default: m.ScheduleScreen })));
const BuildRunner = lazy(() => retryImport(() => import("./ui/build")).then(m => ({ default: m.BuildRunner })));
const BarLabScreen = lazy(() => retryImport(() => import("./ui/bar-lab")).then(m => ({ default: m.BarLabScreen }))); // Доп. 218: лениво, как остальные экраны
const CocktailEditor = lazy(() => retryImport(() => import("./ui/cocktail-editor")).then(m => ({ default: m.CocktailEditor }))); // Доп. 240
const BarCardPrint = lazy(() => retryImport(() => import("./ui/bar-card-print")).then(m => ({ default: m.BarCardPrint })));
const GuideScreen = lazy(() => retryImport(() => import("./ui/guide")).then(m => ({ default: m.GuideScreen })));   // Доп. 280: 73 КБ мимо старта // Доп. 244
// Лёгкий старт: редактор контента нужен только руководителю — грузится при открытии
const ContentEditorScreen = lazy(() => retryImport(() => import("./ui/content-editor")).then(m => ({ default: m.ContentEditorScreen })));

// v79 (Доп. 392): бережная или медленная сеть (экономия трафика, 2G) — фоновые загрузки не делаем
const thriftyNet = () => { try { const c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ""))); } catch (e) { return false; } };
// профиль с телефона: фоновые загрузки идут после показа главной, а эффект запуска видит профиль ещё пустым
const storedProfile = () => { try { return JSON.parse(localStorage.getItem("sa_profile") || "null"); } catch (e) { return null; } };

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
        <span className="sa-pulse" style={{ color: T.a11y ? "#7A5D2A" : "#C8A96E", fontFamily: "Georgia, serif", fontSize: T.a11y ? 15 : 14, letterSpacing: 3 }}>SA</span>
      </div>
    </div>
  );
}

// ── Первое знакомство: три карточки при самом первом входе в жизни ──
// Показывается один раз (sa_welcome_seen_v10), листается свайпом и кнопкой.
// Номер в ключе — версия: подняли, и карточки показываются заново всем.
// Задача — снять тревогу «куда я попал», а не обучить: детали человек
// узнает по контекстным подсказкам в момент, когда они станут нужны.
// v74 (Доп. 387): остались только четыре карточки, которые показывает WelcomeIntro. Остальные (тренажёры,
// справочник, график, найм, «Команда», печать, редактор меню — Доп. 139/140/169/214/267) давно не показывались
// и описывали экраны, которых уже нет; их рассказывают контекстные подсказки и гид.
// Карточка AI-наставника — для всех, флагманская фича
const WELCOME_AI_CARD = {
  icon: (c) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8 8 0 0 1-8 8H6l-3 2.5v-10a8 8 0 0 1 8-8h2a8 8 0 0 1 8 7.5z"/>
      <text x="12" y="14.2" textAnchor="middle" fontSize="7.5" fontWeight="bold" fontFamily="Georgia, serif" letterSpacing="0.3" fill={c} stroke="none">AI</text>
    </svg>
  ),
  title: "Наставник всегда рядом",
  text: "Круглая кнопка «AI» посередине нижнего меню (на компьютере в меню слева) открывает Наставника. Он знает Справочник и меню твоего ресторана: спроси про жалобу гостя, состав блюда или аллергены. Ответит как старший коллега и кнопкой отведёт в нужный раздел.",
};

// Четыре вкладки внизу — карта приложения
const WELCOME_TABS_CARD = { icon: (c) => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>),
    title: "Четыре вкладки внизу",
    // v58 (Доп. 371): карточки видит новичок (один раз на телефоне) — «стало проще» ему не с чем сравнить
    text: "«Учусь»: уроки и тесты твоей роли. «Смена»: рабочий день, график и чек-листы. «Команда»: коллеги и рейтинг. «Я»: твой прогресс и настройки." };

// Твой трек: учись по шагам
const WELCOME_TRACK_CARD = { icon: (c) => UI_SVG.cloche(c, 28), title: "Твой трек",
    // v58 (Доп. 371): на главной у новичка «НАЧАТЬ», потом «ДАЛЬШЕ» — про кнопку «ДАЛЬШЕ» в первый день было непонятно
    text: "Учись по шагам: уроки открываются по порядку, а приложение само подскажет, куда дальше. Большая карточка на главной ведёт к следующему шагу: сначала «Начать», потом «Дальше». В тестах верный ответ подсвечивается сразу." };

// Где искать ответы дальше
const WELCOME_GUIDE_CARD = { icon: (c) => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>),
    title: "Гид всегда под рукой",
    text: "Забыл, где что? Вкладка «Я» → «Гид по приложению»: каждая функция с объяснением и кнопкой «Открыть». Это окно больше не покажется, а гид останется." };

function WelcomeIntro({ T, a11y, isAdmin, canHire, onClose }) {
  // Порядок — путь новичка: учёба → ошибки → тренажёры → знания → наставник
  // → график → признание; менеджерам и руководству — их инструменты в конце.
  // Порядок — по вкладкам: что это → четыре вкладки → Учусь → Смена → Команда → гид
  // Было 16 карточек у новичка, 19 у менеджера и 20 у владельца — лекция
  // до того, как человек увидел хоть один экран. Столько никто не запомнит.
  // Осталось четыре на ориентацию: где я, как устроено приложение, что тут
  // есть особенного и где искать ответы. Всё остальное рассказывают
  // контекстные подсказки — в разделе и в тот момент, когда вопрос возник.
  // Карточки руководителя тоже убраны: редактор графика и меню объясняются
  // подсказкой при первом входе туда, а не заранее и не всем подряд.
  const cards = [
    WELCOME_TABS_CARD,       // четыре вкладки — карта приложения
    WELCOME_TRACK_CARD,      // твой трек: учись по шагам
    WELCOME_AI_CARD,         // наставник — то, чего сам не найдёшь
    WELCOME_GUIDE_CARD,      // где искать ответы дальше
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
  const gold = a11y ? "#7A5D2A" : "#C8A96E";
  const last = idx === cards.length - 1;
  const card = cards[idx];
  const glass = {
    background: T.lessGlass?.bg || (a11y ? "rgba(250,242,222,0.60)" : "rgba(226,186,116,0.11)"),
    border: T.lessGlass?.border || (a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)"),
    borderTop: T.lessGlass?.borderTop || (a11y ? "1px solid rgba(255,252,240,0.9)" : "1px solid rgba(255,255,255,0.20)"),
    boxShadow: T.lessGlass?.shadow || (a11y ? "inset 0 0 22px rgba(255,250,235,0.5), 0 6px 20px rgba(120,90,30,0.10)" : "inset 0 0 22px rgba(255,248,230,0.07), 0 6px 20px rgba(0,0,0,0.35)"),
    borderRadius: 22, padding: "26px 22px",
  };
  return (
    <div className="sa-fadein" style={{ position: "fixed", inset: 0, zIndex: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, paddingTop: "max(20px, var(--sa-st, 0px))",
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
            background: "linear-gradient(135deg, #C8A96E 0%, #7A5D2A 100%)", boxShadow: "0 4px 18px rgba(200,160,80,0.25)" }}>
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
// v31: подпись «Лиги недели» в «Команде» — место и очки из сводки дня (этап 25)
function leagueSub(brief) {
  const lg = brief && brief.league;
  if (!lg || !(Number(lg.pts) > 0) || !lg.rank_rest) return null;
  const pts = Number(lg.pts), m10 = pts % 10, m100 = pts % 100;
  const w = m10 === 1 && m100 !== 11 ? "очко" : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? "очка" : "очков";
  return lg.rank_rest + "-е место в заведении" + (lg.n_rest ? " из " + lg.n_rest : "") + " · " + pts + " " + w + (lg.rank_net ? " · в сети " + lg.rank_net + "-е" : "");
}

// v31: кнопка не закрывает собой строки списка — при листании вниз уезжает за край,
// при листании вверх (или у самого верха экрана) возвращается. Экраны листаются
// своими контейнерами, поэтому слушаем «scroll» всего документа на перехвате.
function useHideOnScroll(resetKey) {
  const [hid, setHid] = useState(false);
  useEffect(() => { setHid(false); }, [resetKey]);
  useEffect(() => {
    const last = new WeakMap();
    const h = (e) => {
      const t = e.target && e.target.nodeType === 1 ? e.target : document.scrollingElement;
      if (!t || typeof t.scrollTop !== "number") return;
      const y = t.scrollTop, prev = last.has(t) ? last.get(t) : y;
      last.set(t, y);
      if (y < 40) setHid(false);
      else if (y - prev > 6) setHid(true);
      else if (y - prev < -6) setHid(false);
    };
    document.addEventListener("scroll", h, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", h, { capture: true });
  }, []);
  return hid;
}

function AiFab({ a11y, onClick, screen }) {
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem("sa_ai_fab") === "1"; } catch (e) { return true; }
  });
  const hid = useHideOnScroll(screen);
  const gold = a11y ? "#7A5D2A" : "#C8A96E";
  const tap = () => {
    try { localStorage.setItem("sa_ai_fab", "1"); } catch (e) {}
    setSeen(true);
    vibrate("light");
    onClick();
  };
  return (
    <div className={"sa-fab" + (hid ? " hid" : "")} data-fab={hid ? "hid" : "on"} aria-hidden={hid ? "true" : undefined}
      style={{ position: "fixed", right: 14, bottom: "calc(122px + env(safe-area-inset-bottom, 0px))", zIndex: 350 }}>
    <div className="sa-pop" onClick={tap} {...onActivate(tap)} role="button" aria-label="AI-ассистент" tabIndex={hid ? -1 : 0}
      style={{ position: "relative",
        width: 58, height: 58, borderRadius: 29, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: a11y ? "rgba(139,106,48,0.10)" : "rgba(200,169,110,0.10)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        boxShadow: `inset 0 0 0 1px ${a11y ? "rgba(139,106,48,0.5)" : "rgba(214,178,102,0.40)"}, inset 0 0 18px ${a11y ? "rgba(255,255,255,0.45)" : "rgba(255,230,170,0.10)"}, inset 0 1.5px 0 ${a11y ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.18)"}, 0 8px 24px rgba(0,0,0,${a11y ? 0.18 : 0.45})` }}>
      {!seen && (
        <span className="sa-pulse" style={{ position: "absolute", inset: -5, borderRadius: 34,
          border: `1.5px solid ${gold}`, pointerEvents: "none" }} />
      )}
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8 8 0 0 1-8 8H6l-3 2.5v-10a8 8 0 0 1 8-8h2a8 8 0 0 1 8 7.5z"/>
        <text x="12" y="14.2" textAnchor="middle" fontSize="7.5" fontWeight="bold" fontFamily="Georgia, serif" letterSpacing="0.3" fill={gold} stroke="none">AI</text>
      </svg>
    </div>
    </div>
  );
}
import { injectStyles } from "./ui/css";
import { MM, Mm, ROLE_SVG, UI_SVG, POS_SVG, MOD_SVG, MARKER_RE, GAME_SVG } from "./ui/icons";
import { S, A, ACCENT_SERIF } from "./ui/styles";
import { NewPageBanner } from "./ui/guestbook-lite";
import { weeklyDialogueIdFrom, weeklyLessonId } from "./data/reviews";
import { Confetti, TimerBar, SayAloud } from "./ui/widgets";
import { crownIcon, flameIcon, trophyIcon, faceIcon } from "./ui/icons-extra";
import { Sign } from "./ui/signs";   // v75 (Доп. 388): свои значки вместо эмодзи и ✦
import { StreakCard, MoodCheckCard, TeamMoodCard, moodPalette, readMood, recordMood } from "./ui/mood-cards";
import { BG_DARK, CREAM, GOLD, GOLD_LOGO, SAND, toolColor, labelStyle } from "./ui/tokens";
import { hintsFor, hintKey } from "./data/hints";
// v79 (Доп. 392): на старте — только то, что нужно главной и уроку. Раньше всё шло через ui/screens.jsx, и в стартовый
// файл попадали экраны руководителя, «Команды», экзамена, рейтинга и живого диалога (около 250 КБ кода); теперь они
// грузятся при первом открытии, а фоновый прогрев (ниже) подтягивает их заранее, когда главная уже на экране.
import { RoleSelect } from "./ui/screens-roleselect";
import { MistakesScreen, HomeScreen, ModuleScreen, LessonScreen, GlossaryScreen, loadTable, useTableModule } from "./ui/screens-learning";
import { APP_SHARE_URL } from "./lib/app-url";
import { buildQdayQueue, qdayNeedsPush, qdayMarkPushed, newQdayAnswers, markQdaySeen, applyQdayToBank } from "./lib/qday";   // v81: вопрос дня в Telegram
import { casesSub, isCaseMistake, markPlayed, readSince, markSince } from "./lib/cases";   // v83: случаи из нашего зала
import { thanksSub } from "./lib/guest-thanks";   // v84: спасибо от гостей по QR
const lazyOf = (load, name) => lazy(() => retryImport(load).then(m => ({ default: m[name] })));
const loadGamification = () => import("./ui/screens-gamification");
const loadTeamScreens = () => import("./ui/screens-team");
const loadAdminScreens = () => import("./ui/screens-admin");
const loadExamScreens = () => import("./ui/screens-exam");
const loadDialogueScreen = () => import("./ui/screens-dialogue");
const AchievementPopup = lazyOf(loadGamification, "AchievementPopup");
const RoleCompleteScreen = lazyOf(loadGamification, "RoleCompleteScreen");
const LeaderboardScreen = lazyOf(loadGamification, "LeaderboardScreen");
const DailyScreen = lazyOf(loadGamification, "DailyScreen");
const PlayerDetailScreen = lazyOf(loadGamification, "PlayerDetailScreen");
const StatsScreen = lazyOf(loadGamification, "StatsScreen");
const TeamScreen = lazyOf(loadTeamScreens, "TeamScreen");
const CodeLoginScreen = lazyOf(loadTeamScreens, "CodeLoginScreen");
const AccountScreen = lazyOf(loadTeamScreens, "AccountScreen");
const ChecklistScreen = lazyOf(loadAdminScreens, "ChecklistScreen");
const OnboardingScreen = lazyOf(loadAdminScreens, "OnboardingScreen");
const AnalyticsScreen = lazyOf(loadAdminScreens, "AnalyticsScreen");
const ExamScreen = lazyOf(loadExamScreens, "ExamScreen");
const CertificateScreen = lazyOf(loadExamScreens, "CertificateScreen");
const CertificatesScreen = lazyOf(loadExamScreens, "CertificatesScreen");
const LiveDialogue = lazyOf(loadDialogueScreen, "LiveDialogue");
const loadBriefing = () => import("./ui/briefing");   // v82 (Доп. 395): брифинг смены
const BriefScreen = lazyOf(loadBriefing, "BriefScreen");
const BriefCard = lazyOf(loadBriefing, "BriefCard");
const BriefView = lazyOf(loadBriefing, "BriefView");
const CasesScreen = lazyOf(() => import("./ui/cases"), "CasesScreen");   // v83 (Доп. 396): случаи из нашего зала
const ThanksScreen = lazyOf(() => import("./ui/thanks"), "ThanksScreen");   // v84 (Доп. 397): спасибо от гостей по QR
const SeatingScreen = lazyOf(() => import("./ui/seating"), "SeatingScreen");   // v85 (Доп. 398): рассадка для хостес













injectStyles();



// #2 — Фича «Сертификаты и экзамен» полностью готова в коде, но временно скрыта из интерфейса.
// Чтобы вернуть: поставь true — снова появятся плитка «Сертификаты» и вход к экзамену.
const CERTIFICATES_ENABLED = true;

// Этап 1 — интервальное повторение: через сколько дней вопрос возвращается после верного ответа
const SR_DAYS = [1, 3, 7, 30];
const PRACTICE_RESUME_KEY = "sa_practice_resume";   // Доп. 293

function ServiceAcademy() {
  const [screen, setScreen] = useState("roleSelect");
  // Дополнение 134: история навигации — стек вместо одного шага.
  // prevScreen — вершина стека (старый код читает его как раньше), setPrevScreen — push,
  // navigate(to) — push текущего + переход, goBack() — pop. Вкладки сбрасывают стек.
  const [navStack, setNavStack] = useState([]);
  const navRef = useRef([]);                 // источник истины для push/pop
  const screenRef = useRef("roleSelect");    // текущий экран для императивных переходов
  useEffect(() => { screenRef.current = screen; if (screen !== "menuTrainer") { setMenuStart(null); setMenuMode(null); } if (screen !== "barLab") setLabStart(null); if (screen !== "ckEditor") setCkEdit(null); }, [screen]);
  const commitStack = useCallback((arr) => { navRef.current = arr; setNavStack(arr); }, []);
  const prevScreen = navStack.length ? navStack[navStack.length - 1] : null;
  const setPrevScreen = useCallback((x) => { if (x) commitStack([...navRef.current, x].slice(-24)); }, [commitStack]);
  const TAB_SCREENS = ["roleSelect", "shift", "teamHub", "me"];
  const [lessonLockMsg, setLessonLockMsg] = useState(null); // мягкое сообщение о закрытом уроке (Вариант В)
  const [bookFocus, setBookFocus] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = React.useState(null);
  const [profile, setProfile] = useState(null);
  // Лазейка в тестах (ui/loophole.jsx): ключ сотрудника и запись выхода на сервер.
  // Объявлены здесь, выше handleQuiz: там loopUk стоит в зависимостях, а они
  // вычисляются при отрисовке — объявление ниже роняло бы приложение.
  const loopUk = profile ? `_${profile.name}_${profile.surname || ""}` : "";
  const logSkip = (lessonId, sk) => { try { rpcSync("log_quiz_skip", { p_token: saToken(), p_lesson: lessonId, ...skipPayload(sk) }); } catch (e) {} };
  const [scores, setScores] = useState([]);
  const [practiceStars, setPracticeStars] = useState({}); // { "name|surname": { "lesson_id": stars } }
  const [allProfiles, setAllProfiles] = useState([]); // все пользователи из таблицы profiles
  const [newAchievement, setNewAchievement] = useState(null); // { icon, label } для popup
  const [quizDone, setQuizDone] = useState({});
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [role, setRole] = useState(null);
  const roleRef = useRef(null); roleRef.current = role;   // текущая роль для ответов сервера, пришедших позже
  // v58 (Доп. 371): трек подставлен по должности (не выбран самим) — роль с сервера главнее, «сменить» на главной
  const [roleAuto, setRoleAuto] = useState(false);
  const roleAutoRef = useRef(false); roleAutoRef.current = roleAuto;
  const [roleChecked, setRoleChecked] = useState(false);   // my_state ответил: выбранной раньше роли на сервере нет — или есть
  // v59 (Доп. 372): «Сменить» из шапки трека — главная открывается с развёрнутым списком треков (иначе он свёрнут)
  const [tracksWanted, setTracksWanted] = useState(false);
  useEffect(() => { if (screen !== "roleSelect" && tracksWanted) setTracksWanted(false); }, [screen, tracksWanted]);
  const [activeModule, setActiveModule] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [refStart, setRefStart] = useState(null);
  // Дополнение 123: Справочник и Колода бармена ходят друг в друга, а история
  // навигации хранит один шаг — назад из Справочника вело обратно в Колоду по
  // кругу. Запоминаем экран, с которого зашли в эту пару, и выходим на него.
  const [ckStart, setCkStart] = useState(null);
  const [menuStart, setMenuStart] = useState(null);
  const [labStart, setLabStart] = useState(null); // Доп. 208: открыть Сборку руками на коктейле
  const [ckEdit, setCkEdit] = useState(null); // Доп. 240: редактор коктейлей — открыть на записи
  // Доп. 246: ссылка ?print=bar из Telegram — сразу карта бара для печати
  useEffect(() => { try { if (new URLSearchParams(location.search).get("print") === "bar") navigate("barPrint"); } catch (e) {} }, []);
  const [menuMode, setMenuMode] = useState(null); // Доп. 210: режим дня → тренажёр меню
  const [ckMode, setCkMode] = useState(null);
  useEffect(() => { try { window.__saUk = profile ? `_${profile.name}_${profile.surname || ""}` : ""; } catch (e) {} }, [profile]);
  const [lessonDone, setLessonDone] = useState(null); // Доп. 205: { next } — урок дочитан, кнопка стала «Далее»
  // Доп. 173: индикатор сети — полоска сверху, когда связи нет
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  // v50 (Доп. 363): телефон лёжа и компьютер. Шире 600 px — меню слева вместо нижней панели, колонка
  // экрана шире и по центру свободного места; главная — в две колонки, когда хватает места. Портрет не
  // меняется. Классы на <html> и переменные --sa-rail / --sa-colw читают правила в ui/css.js.
  const vp = useViewport();
  const NAV_SCREENS = ["roleSelect","home","module","leaderboard","glossary","stats","daily","playerDetail","team","shift","teamHub","me"];
  const navOn = NAV_SCREENS.includes(screen) && !!profile;
  const railOn = vp.wide && navOn;
  const colW = colWidthOf(vp, screen, railOn, vp.safe);
  const homeCols = screen === "roleSelect" && homeTwoCols(vp, railOn, vp.safe);
  React.useLayoutEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("sa-wide", vp.wide); el.classList.toggle("sa-short", vp.short);
    el.classList.toggle("sa-desk", vp.desk); el.classList.toggle("sa-railon", railOn);
    // v51 (Доп. 364): вырезы экрана — из замера env() и из Telegram (у него окно лёжа идёт под «остров»)
    el.style.setProperty("--sa-sl", vp.safe.l + "px"); el.style.setProperty("--sa-sr", vp.safe.r + "px");
    el.style.setProperty("--sa-sb", vp.safe.b + "px");
    el.style.setProperty("--sa-rail", (railOn ? RAIL_W + vp.safe.l : vp.safe.l) + "px");
    el.style.setProperty("--sa-colw", colW + "px");
  }, [vp.wide, vp.short, vp.desk, railOn, colW, vp.safe.l, vp.safe.r, vp.safe.b]);
  const offlineHelp = { key:"offline", icon:"mistakes", label:"Без сети", sub: online ? "Как открывать приложение без связи" : "Сейчас без связи, работаем на сохранённом", onClick:() => navigate("offline") }; // Доп. 170: открыть Колоду меню на блюде (карточка в ответе Наставника)
  const [completed, setCompleted] = useState({});
  const [completedRoles, setCompletedRoles] = useState(new Set());
  const [quizState, setQuizState] = useState({ step: 0, answers: [], done: false, mistakes: 0 });
  const [practiceState, setPracticeState] = useState({ step: 0, choice: null, isAnswered: false, results: [], done: false, lives: 3, score: 0, combo: 0, situations: [], flash: null, usedIds: [] });
  const [gameKey, setGameKey] = useState(0);
  // v59 (Доп. 372): «Тема как в системе» — светлая тема телефона/Telegram включает «Для чтения» (lib/theme.js)
  const [themeAuto, setThemeAutoState] = useState(() => themeAutoOn());
  const [a11y, setA11yState] = useState(() => { try { return themeAutoOn() ? systemLight() : localStorage.getItem("sa_a11y") === "1"; } catch (e) { return false; } });
  const setA11y = useCallback((v) => { setA11yState(v); setThemeAuto(false); setThemeAutoState(false); }, []);   // выбор руками снимает автоматику
  const setAutoTheme = useCallback((on) => { setThemeAuto(on); setThemeAutoState(on); if (on) setA11yState(systemLight()); }, []);
  useEffect(() => { if (!themeAuto) return undefined; return watchSystemTheme((light) => setA11yState(light)); }, [themeAuto]);
  const [streak, setStreak] = useState({ count: 0, best: 0, last: "", days: [] });
  const [mistakeBank, setMistakeBank] = useState([]); // #5/#6 — заваленные вопросы для повтора
  const [customLessons, setCustomLessons] = useState([]);
  const [customLoaded, setCustomLoaded] = useState(false);   // список своих уроков пришёл (правка 166)
  // Сброс прогресса дочищает следы (этап 20): аналитика, выходы, ключи лазейки,
  // прогресс по меню и ачивки привязаны к «Имя Фамилия» и сбросом не убирались.
  const wipeLocalProgressRef = React.useRef(null);
  const wipeTraces = useCallback((name, surname) =>
    rpc("admin_wipe_traces", { p_token: saToken(), p_name: name, p_surname: surname || "" })
      .then(res => {
        // сбросил себя — телефон чистим сразу, не дожидаясь перезапуска (правка 179)
        if (profile && name === profile.name && (surname || "") === (profile.surname || "") && wipeLocalProgressRef.current) {
          try { wipeLocalProgressRef.current(`_${profile.name}_${profile.surname || ""}`); } catch (e) {}
        }
        return res;
      }).catch(() => {}), [profile]); // свой контент (редактор)
  const [saved, setSaved] = useState({}); // #5 — избранные термины и заметки: { termKey: { fav?: bool, note?: string } }
  const [examResults, setExamResults] = useState({}); // #2 — результаты экзаменов: { roleId: { passed, score, correct, total, date } }
  // Празднование побед: золотая вспышка с конфетти на большие моменты (экзамен).
  // null | текст; живёт полторы секунды и гаснет сама.
  const [celebrate, setCelebrate] = useState(null);
  const cheer = useCallback((text) => {
    setCelebrate(text);
    try { vibrate && vibrate("success"); } catch (e) {}
    setTimeout(() => setCelebrate(null), 1500);
  }, []);
  const [examRole, setExamRole] = useState(null); // #2 — для какой роли открыт экзамен/сертификат
  // Доп. 288: серия знает график. Выходной по графику (офлайн-копия экрана «График»)
  // серию не сжигает — такие дни помечаются «замороженными». Отметить день умеют
  // урок, практика, «у стола» и «Работа над ошибками». Значение считается от
  // актуальной серии (ref), а не внутри setState: вспышка 7/30 не задваивается.
  const streakRef = useRef(streak); streakRef.current = streak;
  const touchStreak = useCallback(() => {
    try {
      const uk = profile ? `_${profile.name}_${profile.surname||""}` : "";
      // v68 (Доп. 381): от более свежей из двух — в памяти или на телефоне. Серия в памяти могла отстать (вход по коду
      // без перезапуска, второе окно) — и шаг начинал серию заново поверх настоящей.
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem("sa_streak" + uk) || "null"); } catch(e) { saved = null; }
      const prev = fresherStreak(streakRef.current, saved);
      const next = nextStreak(prev, new Date(), (d) => dayOffFromSchedule(profile, d));
      if (!next) return prev;
      if (next === prev) { if (prev !== streakRef.current) { streakRef.current = prev; setStreak(prev); } return prev; }
      streakRef.current = next;
      setStreak(next);
      try { localStorage.setItem("sa_streak"+uk, JSON.stringify(next)); } catch(e) {}
      // Серия — повод для золотой вспышки (7 и 30 дней)
      if (next.count === 7 || next.count === 30) setTimeout(() => cheer("Серия " + next.count + " дней"), 500);
      return next;
    } catch(e) { return streakRef.current; }
  }, [profile, cheer]);
  // Доп. 298: журнал дня и цель дня (стакан). Шаг — урок, практика, тест, диалог,
  // сборка или разминка; дошёл до цели — короткая вспышка «Цель дня ✓».
  const ukP = profile ? `_${profile.name}_${profile.surname || ""}` : "";
  const [activity, setActivity] = useState({});
  const [goal, setGoalState] = useState(2);
  // v40 («Путь мастера»): тик пересчёта значков — когда запись на телефоне меняется мимо состояния
  // (отпразднованный значок, открытый инструмент, сброс)
  const [masteryVer, setMasteryVer] = useState(0);
  React.useEffect(() => { setActivity(readActivity(ukP)); setGoalState(readGoal(ukP)); }, [ukP]);
  const logActivity = useCallback((kind, n = 1) => {
    try {
      const day = ymd(new Date());
      const before = stepsOn(readActivity(ukP), day);
      const next = bumpActivity(ukP, kind, n);
      setActivity(next);
      // v31: квест смены и свеча на двоих видят занятие через секунды (этап 25: sa_day_push)
      if (profile) scheduleDayPush({ uk: ukP, profile });
      const g = readGoal(ukP);
      if (before < g && stepsOn(next, day) >= g) setTimeout(() => cheer("Цель дня ✓"), 700);
    } catch (e) {}
  }, [ukP, cheer, profile]);
  const setGoal = useCallback((g) => { setGoalState(saveGoal(ukP, g)); }, [ukP]);
  const todayKey = ymd(new Date());
  const todaySteps = stepsOn(activity, todayKey);
  // v68 (Доп. 381): свеча и бокал говорят одно. Сегодня в журнале дня уже есть шаг (или работа над ошибками), а свеча
  // не зажжена — зажигаем: шаг засчитан в цель дня, значит, и в серию. Так чинится и то, что уже разошлось на телефоне.
  const todayRec = activity ? activity[todayKey] : null;
  const todayLit = !!(todayRec && ((Number(todayRec.st) || 0) > 0 || (Number(todayRec.f) || 0) > 0));
  React.useEffect(() => {
    if (!profile || !storageLoaded || !todayLit) return;
    if (streak && streak.last === todayKey) return;
    touchStreak();
  }, [profile, storageLoaded, todayLit, todayKey, streak, touchStreak]);
  // табличка на главной — серия «на сейчас»: прервалась — 0, а не прежнее число (lib/streak.js liveStreak)
  const streakLive = useMemo(() => {
    const lv = liveStreak(streak, new Date(), (d) => dayOffFromSchedule(profile, d));
    return lv.count === ((streak && streak.count) || 0) ? streak : { ...streak, count: lv.count };
  }, [streak, todayKey, profile]);   // eslint-disable-line react-hooks/exhaustive-deps

  // v69 (Доп. 382): на телефоне — полноэкранный режим Telegram: шапки Telegram нет, сверху только его кнопки
  // «Закрыть», «Свернуть» и «…»; смахнуть вниз нельзя. Отступ под кнопки (--sa-st) — по событиям Telegram
  React.useEffect(() => startTgScreen(window.Telegram && window.Telegram.WebApp), []);

  // Инициализация Telegram WebApp: убираем серые рамки, красим шапку и фон под тему
  React.useEffect(() => {
    try {
      try { localStorage.setItem("sa_a11y", a11y ? "1" : "0"); } catch (e) {}
      // Класс темы на корне: позволяет CSS красить псевдоэлементы
      // (плейсхолдеры, каретки) под тему во всём приложении разом
      try { document.documentElement.classList.toggle("sa-light", a11y); } catch (e) {}
      const tg = window.Telegram?.WebApp;
      const bg = a11y ? "#E8DEC8" : "#14110A";
      // Сцена: фиксированный слой-фон под всем приложением. Не зависит от
      // высоты контента и капризов body — разнотемье исключено.
      const scene = a11y
        ? "radial-gradient(130% 80% at 50% -5%, rgba(255,251,240,0.9) 0%, rgba(255,251,240,0) 55%), #E8DEC8"
        : "radial-gradient(130% 80% at 50% -5%, rgba(214,170,80,0.10) 0%, rgba(214,170,80,0) 55%), linear-gradient(160deg, #171208 0%, #1C1509 50%, #14110A 100%)";
      try {
        let sc = document.getElementById("sa-scene");
        if (!sc) {
          sc = document.createElement("div");
          sc.id = "sa-scene";
          sc.style.cssText = "position:fixed;inset:0;z-index:-1;pointer-events:none;";
          document.body.prepend(sc);
        }
        sc.style.background = scene;
      } catch (e) {}
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

  // Загрузка из хранилища: сессия → профиль телефона (v55: whoami — фоном, после показа) → прогресс
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

    // v55 (Доп. 368): сверка входа с сервером — фоном, уже после показа приложения.
    // Тот же разбор ответа, что был при старте: вход подтверждён — свежий профиль; сессия
    // отозвана (сброс кода / деактивация) — на вход; нет сети — работаем с профилем телефона.
    const verifyLater = (token, cached) => {
      rpc("whoami", { p_token: token }).then((res) => {
        if (res && res.ok && res.employee) {
          const emp = res.employee;
          const prof = { id: emp.id, name: emp.name, surname: normSurname(emp.surname || ""), restaurant: emp.restaurant, position: emp.position, is_admin: !!emp.is_admin };
          const fresh = JSON.stringify(prof);
          if (fresh === JSON.stringify(cached)) return;   // ничего не поменялось — экран не трогаем
          let saved = false;
          try { localStorage.setItem("sa_profile", fresh); saved = localStorage.getItem("sa_profile") === fresh; } catch(e) {}
          // Поменяли имя или фамилию — прогресс на телефоне лежит под другими личными ключами:
          // перечитываем приложение начисто (один раз — профиль уже сохранён свежим)
          if (saved && (prof.name !== cached.name || (prof.surname || "") !== (cached.surname || ""))) { try { window.location.reload(); } catch(e) {} return; }
          setProfile(prof);   // ресторан, должность, права — сразу
        } else if (res && res.ok === false) {
          try { localStorage.removeItem("sa_session_token"); } catch(e) {}
          setProfile(null); setScreen("login");
        }
      }).catch(() => {});
    };

    (async () => {
      let p = null;
      let verify = null;
      try {
        let token = null;
        try { token = localStorage.getItem("sa_session_token"); } catch(e) {}
        if (!token) { clearTimeout(fallback); setStorageLoaded(true); setScreen("login"); return; }
        startBoot(token);   // v64 (Доп. 377): один запрос за всем стартовым — whoami, my_state, day_brief… (api/supabase.js)

        let cached = null;
        try { const c = localStorage.getItem("sa_profile"); if (c) cached = JSON.parse(c); } catch(e) {}

        if (cached && typeof cached === "object" && cached.id && cached.name) {
          // v55 (Доп. 368): быстрый старт — профиль уже на телефоне, открываемся сразу,
          // а сервер подтверждает вход фоном (verifyLater). Раньше старт ждал ответа whoami:
          // на мобильной сети новое соединение — это DNS, TCP, TLS и сам запрос, секунда и больше.
          setProfile(cached);
          p = { value: JSON.stringify(cached) };
          verify = { token, cached };
        } else {
          // Первый вход на этом телефоне (профиля ещё нет) — ждём сервер, как раньше
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
          } else { clearTimeout(fallback); setStorageLoaded(true); setScreen("login"); return; }
        }
      } catch(e) { clearTimeout(fallback); setStorageLoaded(true); setScreen("login"); return; }
      try { const s = await storageGet("sa_scores"); if (s) { const saved = JSON.parse(s.value); setScores(prev => { const ids = new Set(saved.map(x => x.id)); return [...prev.filter(x => !ids.has(x.id)), ...saved]; }); } } catch(e) {}
      // Сданные тесты — сначала с телефона (личный ключ), потом сервер уточнит (my_state ниже).
      // Раньше они читались только с сервера: без сети пройденные тесты выглядели несданными.
      // Общий ключ "sa_quiz_done" прежних версий не читаем: на общем телефоне он мог
      // принадлежать другому сотруднику, а сданный тест закрывается для пересдачи.
      try { const ukQ = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; if (ukQ) { const qd = await storageGet("sa_quiz_done" + ukQ); if (qd) { const obj = JSON.parse(qd.value); if (obj && typeof obj === "object" && !Array.isArray(obj)) setQuizDone(obj); } } } catch(e) {}
      try { const uk2 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const cr = await storageGet("sa_completed_roles"+uk2) || await storageGet("sa_completed_roles"); if (cr) setCompletedRoles(new Set(JSON.parse(cr.value))); } catch(e) {}
      try { const uk3 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const sc = await storageGet("sa_completed"+uk3) || await storageGet("sa_completed"); if (sc) setCompleted(JSON.parse(sc.value)); } catch(e) {}
      // v59 (Доп. 372): роль — личный ключ (sa_last_role<uk>), как уроки и ошибки: на общем планшете следующий человек
      // не получал бы роль предыдущего. Старый общий ключ не читаем (мог быть чужим) — роль придёт с сервера (my_state)
      // или подставится по должности; общий ключ подчищаем.
      try { const ukR = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const lr = ukR ? await storageGet("sa_last_role" + ukR) : null; if (lr) setRole(JSON.parse(lr.value)); } catch(e) {}
      try { localStorage.removeItem("sa_last_role"); } catch(e) {}
      try { const ps = await storageGet("sa_practice_stars"); if (ps) setPracticeStars(JSON.parse(ps.value)); } catch(e) {}
      try { const uk4 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const st = await storageGet("sa_streak"+uk4); if (st) setStreak(JSON.parse(st.value)); } catch(e) {}
      // Банк ошибок — персональный ключ. Раньше был общий "sa_mistakes":
      // на общем устройстве (планшет на баре) ошибки одного сотрудника
      // доставались другому. Старый ключ читаем один раз как миграцию.
      try {
        const ukM = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : "";
        const mb = await storageGet("sa_mistakes" + ukM) || await storageGet("sa_mistakes");
        if (mb) { const arr = JSON.parse(mb.value); if (Array.isArray(arr)) setMistakeBank(arr); }
      } catch(e) {}
      try { const uk5 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const sv = await storageGet("sa_saved"+uk5); if (sv) { const obj = JSON.parse(sv.value); if (obj && typeof obj === "object" && !Array.isArray(obj)) setSaved(obj); } } catch(e) {}
      try { const uk6 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const ex = await storageGet("sa_exam"+uk6); if (ex) { const obj = JSON.parse(ex.value); if (obj && typeof obj === "object" && !Array.isArray(obj)) setExamResults(obj); } } catch(e) {}
      clearTimeout(fallback);
      setStorageLoaded(true);
      if (verify) verifyLater(verify.token, verify.cached);   // v55: сервер подтверждает вход уже после показа
    })();
  }, []);

  // Список сотрудников для «Управления данными» (этап 21): по токену и только руководителю —
  // сети все, ресторана свои. v59 (Доп. 372): запасное чтение таблицы profiles открытым ключом убрано —
  // этап 21 давно на сервере, а таблицы закрыты (21б); без функции список просто пуст.
  React.useEffect(() => {
    if (!profile) return;
    rpc("team_profiles", { p_token: saToken() }).then(res => {
      if (res && res.ok && Array.isArray(res.rows)) { if (res.rows.length > 0) setAllProfiles(res.rows); }
    }).catch(() => {});
  }, [profile]);

  // Загрузка рейтинга из Supabase (этап 21: только по токену — team_scores;
  // без этапа 21 на сервере — по-старому, напрямую из таблицы)
  React.useEffect(() => {
    if (!profile) return;
    const applyScores = (data) => {
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
                setNewAchievement({ icon: "rocket", label: "Первопроходец" });
                vibrate("heavy");
                try { localStorage.setItem(`sa_ach_pioneer_${profile.name}_${normSurname(profile.surname)}`, "1"); } catch(e) {}
                setTimeout(() => setNewAchievement(null), 3000);
              }, 1500);
            }
          }
        }
      }
    };
    rpc("team_scores", { p_token: saToken() }).then(res => {
      if (res && res.ok && Array.isArray(res.rows)) applyScores(res.rows);   // v59: без запасного чтения таблицы scores открытым ключом
    }).catch(() => {});
  }, [profile]);

  // Версия очистки телефона после сброса: растёт, когда в список добавляется новое
  // v30: новые записи (свежесть тем, зачёты, золото, живой гость, квесты, радио, итоги)
  // добавлены в список ниже, но версия НЕ поднята: они появились уже после любого
  // прошлого сброса, значит «старых» данных в них нет. Подъём версии стёр бы заново
  // всё, что человек успел пройти после давнего сброса (находка ревью v30).
  const WIPE_VERSION = 3;
  // Очистка телефона после сброса (этап 20): всё, что относится к прогрессу человека.
  // Вынесена отдельно, чтобы звать и при сбросе самого себя — сразу, без перезапуска.
  const wipeLocalProgress = useCallback((uk) => {
    // включая записи секретной ачивки: иначе после сброса она считала «какой это раз»
    // с прежнего числа, хотя тайный зачёт на сервере уже обнулён (правка 175)
    ["sa_completed", "sa_completed_roles", "sa_quiz_done", "sa_scores", "sa_practice_stars", "sa_mistakes", "sa_exam", "sa_streak", "sa_saved",
     "sa_book_read", "sa_book_dates", "sa_loopholes", "sa_qskip", "sa_qtry",
     // ачивки и рекорды тренажёров — тоже личный прогресс (правка 178)
     "sa_achv", "sa_bar_mastery", "sa_bar_rush_best", "sa_bar_station_best", "sa_daily5", "sa_cocktail_sr",
     // Доп. 293: место в уроке и незаконченный раунд практики; Доп. 289: сколько раз проверялся урок у стола
     "sa_card_pos", "sa_practice_resume", "sa_tb_runs",
     // Доп. 298–305: журнал дня, разминка, чек недели, печати разделов
     "sa_activity", "sa_warmup", "sa_week_seen", "sa_seal_seen",
     // v30 (Доп. 312–320): свежесть тем, зачёт на опыт, золото, живой гость, квест смены, радио, итоги месяца
     "sa_fresh", "sa_credit", "sa_credit_try", "sa_gold", "sa_guest_runs", "sa_quest_tasks", "sa_quest_done", "sa_radio_done", "sa_recap_seen",
     // v40 («Путь мастера»): счётчики за всё время, отпразднованные значки, итог для отчёта, шаг дня,
     // открытые инструменты («новое»), заявка «Мастер роли» на сервер. Версию очистки не поднимаем —
     // как и у v30: этих записей не было ни при одном прошлом сбросе
     "sa_life", "sa_mastery", "sa_mastery_sum", "sa_step", "sa_tools_seen", "sa_master_claim"]
      .forEach(k => { try { localStorage.removeItem(k + uk); localStorage.removeItem(k); } catch (e) {} });
    // ключи с хвостом: рекорд спринта, «выучено» по волнам, повторения меню, снимок рейтинга
    try {
      Object.keys(localStorage)
        .filter(k => /^sa_(al_sprint_best|menu_learned_|menu_sr_|rank_snap_)/.test(k))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    try { localStorage.removeItem("sa_quiz_done"); } catch (e) {}
    setCompleted({}); setQuizDone({}); setScores([]); setPracticeStars({}); setMistakeBank([]);
    setCompletedRoles(new Set()); setExamResults({}); setStreak({ count: 0, best: 0, last: "", days: [] });
    // v68 (Доп. 381): и журнал дня в памяти — иначе после сброса бокал показывал прежние шаги рядом с погасшей свечой
    setActivity({}); setWarmDone("");
    setLoophole(null); setLoopView(null); setLoopRank(null);
    setMasteryVer((v) => v + 1);   // v40: значки и шаг дня — заново от пустого
  }, []);
  wipeLocalProgressRef.current = wipeLocalProgress;
  // для сквозных проверок: сброс самого себя одной командой
  React.useEffect(() => { if (!profile) return; window.__saResetSelf = async () => {
    try { await rpc("admin_reset_player", { p_token: saToken(), p_name: profile.name, p_surname: profile.surname || "" }); } catch (e) {}
    await wipeTraces(profile.name, profile.surname);
  }; }, [profile, wipeTraces]);

  // Сброс руководителем (этап 20): прогресс живёт и на телефоне, поэтому сервер
  // ставит метку времени, а приложение сотрудника по ней стирает своё. По «пустому
  // ответу» так делать нельзя: сбой сети стёр бы живой прогресс.
  React.useEffect(() => {
    if (!profile) return;
    const uk = `_${profile.name}_${profile.surname || ""}`;
    rpc("my_reset_at", { p_token: saToken() }).then(res => {
      const ts = res && res.ok ? res.reset_at : null;
      if (!ts) return;
      // К метке добавлен номер версии очистки (правка 176): если список стираемого
      // пополнился, телефон приберётся ещё раз сам — без нового сброса.
      const mark = String(ts) + "|v" + WIPE_VERSION;
      if ((localStorage.getItem("sa_reset_seen" + uk) || "") === mark) return;
      wipeLocalProgress(uk);
      try { localStorage.setItem("sa_reset_seen" + uk, mark); } catch (e) {}
    }).catch(() => {});
  }, [profile]);

  // v59 (Доп. 372): loadLegacyProgress (прогресс напрямую из таблиц открытым ключом, до этапа 21) удалён:
  // этап 21 на сервере, таблицы закрыты (21б) — единственный источник прогресса теперь my_state.

  // Точный ответ сервера по токену (этап 20в, расширен в этапе 21): сданные тесты,
  // пройденные уроки, а теперь и звёзды практики, пройденные роли и последняя роль.
  // Пустой список здесь означает именно «пусто», поэтому приложение может убрать
  // с телефона лишнее — например, после «Открыть тест заново». Раньше то же самое
  // читалось пятью запросами напрямую к таблицам открытым ключом.
  React.useEffect(() => {
    if (!profile || !storageLoaded) return;
    const uk = `_${profile.name}_${profile.surname || ""}`;
    setRoleChecked(false);
    rpc("my_state", { p_token: saToken() }).then(res => {
      if (!res || !res.ok || !Array.isArray(res.quiz) || !Array.isArray(res.lessons)) return;
      const done = {}; res.quiz.forEach(id => { if (id) done[id] = true; });
      const comp = {}; res.lessons.forEach(id => { if (id) comp[id] = true; });
      setQuizDone(prev => (JSON.stringify(prev) === JSON.stringify(done) ? prev : done));
      setCompleted(prev => (JSON.stringify(prev) === JSON.stringify(comp) ? prev : comp));
      // Сданные тесты — личный ключ, как у ошибок и уроков: без сети они не «забываются»,
      // а на общем телефоне не достаются следующему сотруднику
      try { localStorage.setItem("sa_quiz_done" + uk, JSON.stringify(done)); } catch (e) {}
      try { localStorage.setItem("sa_completed" + uk, JSON.stringify(comp)); } catch (e) {}
      if (res.stars === undefined) return;   // my_state без звёзд и ролей (до этапа 21) — дальше нечего читать
      if (res.stars && typeof res.stars === "object" && Object.keys(res.stars).length) {
        const userKey = `${profile.name}|${profile.surname || ""}`;
        setPracticeStars(prev => {
          const updated = { ...prev, [userKey]: res.stars };
          try { localStorage.setItem("sa_practice_stars", JSON.stringify(updated)); } catch (e) {}
          return updated;
        });
      }
      if (Array.isArray(res.roles) && res.roles.length) {
        const roles = new Set(res.roles);
        setCompletedRoles(roles);
        try { localStorage.setItem("sa_completed_roles" + uk, JSON.stringify([...roles])); } catch (e) {}
      }
      if (res.last_role && (!roleRef.current || roleAutoRef.current)) {
        // v58 (Доп. 371): трек, подставленный по должности, уступает выбранному раньше (новый телефон) —
        // без перехода: человек уже на главной, карточка трека просто сменится
        const wasAuto = roleAutoRef.current;
        setRole(res.last_role); setRoleAuto(false);
        try { localStorage.setItem("sa_last_role" + uk, JSON.stringify(res.last_role)); } catch (e) {}
        if (!wasAuto) setScreen("home");
      }
    }).catch(() => {}).then(() => setRoleChecked(true));   // v58: сервер ответил (или нет) про роль — трек по должности можно запоминать
  }, [profile, storageLoaded]);

  // v58 (Доп. 371): трек по должности. Роль не выбрана ни на телефоне, ни (пока) на сервере — подставляем трек
  // должности из профиля: официанту «Новичок», хостес «Хостес», бармену «Бар». На главной под именем —
  // «по должности · сменить». Роль, выбранная раньше (сервер, my_state выше), главнее. Должность сменилась,
  // а трек так и не выбран самим — трек следует за должностью. Должность без трека — выбор, как раньше.
  useEffect(() => {
    if (!profile || !storageLoaded) return;
    if (roleRef.current && !roleAutoRef.current) return;
    const t = trackForPosition(profile);
    if (!t) { if (roleAutoRef.current) { setRole(null); setRoleAuto(false); } return; }
    if (roleRef.current !== t) setRole(t);
    if (!roleAutoRef.current) setRoleAuto(true);
  }, [profile, storageLoaded]);
  // Принят: человек открыл программу или урок трека — роль запоминается, как выбранная (и на сервере: её видит руководитель)
  useEffect(() => {
    if (!roleAuto || !role || !profile || !roleChecked) return;
    if (screen !== "home" && screen !== "module" && screen !== "lesson") return;
    setRoleAuto(false);
    try { localStorage.setItem("sa_last_role" + ukP, JSON.stringify(role)); } catch (e) {}
    rpcSync("save_last_role", { p_token: saToken(), p_role: role });
  }, [roleAuto, role, screen, profile, roleChecked, ukP]);

  // Доп. 303: подпись в записках у стола — настоящий наставник ресторана (старший или
  // менеджер, по имени). Этап 22: my_mentors. Нет этапа или сети — «наставник», как было.
  const [mentors, setMentors] = useState([]);
  React.useEffect(() => {
    if (!profile || !storageLoaded) return;
    const uk = `_${profile.name}_${profile.surname || ""}`;
    try { const c = JSON.parse(localStorage.getItem("sa_mentors" + uk) || "null"); if (Array.isArray(c)) setMentors(c); } catch (e) {}
    rpc("my_mentors", { p_token: saToken() }).then(res => {
      if (!res || !res.ok || !Array.isArray(res.rows)) return;
      const rows = res.rows.map(r => ({ name: String((r && r.name) || "").trim() })).filter(r => r.name).slice(0, 6);
      setMentors(rows);
      try { localStorage.setItem("sa_mentors" + uk, JSON.stringify(rows)); } catch (e) {}
    }).catch(() => {});
  }, [profile, storageLoaded]);
  const mentorName = mentors.length ? mentors[new Date().getDate() % mentors.length].name : "";

  // Доп. 132: уроки роли приезжают лениво — грузим при смене роли, мемо зависит от версии контента
  const contentVer = useContentVersion();
  useEffect(() => { if (role) loadRoleModules(role).catch(() => {}); }, [role]);
  const modules = useMemo(() => role ? (MODULES[role] || []) : [], [role, contentVer]);

  // ── Свой контент (редактор) ──
  const loadCustomLessons = useCallback(async () => {
    const t = saToken();
    if (!t) { setCustomLessons([]); return; }
    // Копия своих уроков на телефоне (правка 167): без сети свои разделы не пропадают — как
    // штатные, встроенные в приложение. Пока свежий список не пришёл, ничего не считается удалённым.
    const ck = "sa_cms_cache_" + (((JSON.parse(localStorage.getItem("sa_profile") || "{}") || {}).restaurant) || "");
    try { const c = JSON.parse(localStorage.getItem(ck) || "null"); if (Array.isArray(c)) setCustomLessons(prev => prev.length ? prev : c); } catch (e) {}
    try { const res = await rpc("cms_list_lessons", { p_token: t }); if (Array.isArray(res)) { setCustomLessons(res); setCustomLoaded(true); try { localStorage.setItem(ck, JSON.stringify(res)); } catch (e) {} } } catch(e) {}
  }, []);
  React.useEffect(() => { if (profile) loadCustomLessons(); }, [profile, loadCustomLessons]);
  // Свои разделы: иконка и цвет трека — lib/tracks.js (общие с редактором контента)
  // Свои разделы для текущей роли: все уроки раздела подряд, потом общая практика,
  // диалоги, сборки и один тест раздела — lib/custom-modules.js (правка 161)
  const customModules = useMemo(() => buildCustomModules(customLessons, role, { color: TRACK_COLOR[role] || GOLD, icon: customIcon }), [customLessons, role]);
  const customSkills = useMemo(() => customModules.flatMap(m => m.skills || []), [customModules]);   // Доп. 310
  // Программа роли — штатные модули и свои разделы вместе (правка 165): по ней считаются процент
  // трека, «пройдено N из M», завершение роли, «Задания дня» — свои уроки как родные
  const programModules = useMemo(() => [...modules, ...customModules], [modules, customModules]);
  // свои разделы по всем ролям — для «Учусь» (проценты треков) и экзамена
  const customByRole = useMemo(() => Object.fromEntries(ROLES.map(r => [r.id, buildCustomModules(customLessons, r.id, { color: TRACK_COLOR[r.id] || GOLD, icon: customIcon })])), [customLessons]);
  // книга отзывов видит свои разделы с отзывом (правка 166)
  useMemo(() => { setCustomBook(customByRole); setCustomProgram(customByRole); }, [customByRole]);
  // Живые свои шаги (правка 166): что удалено в редакторе — не видно нигде. Пока список своих
  // уроков не загрузился, ничего не считаем удалённым (офлайн, сбой сети).
  const liveCms = useMemo(() => new Set(Object.values(customByRole).flat().flatMap(m => m.lessons.map(l => l.id))), [customByRole]);
  const deadCms = useCallback((id) => customLoaded && /^cms-/.test(String(id || "")) && !liveCms.has(id), [customLoaded, liveCms]);
  const liveScores = useMemo(() => scores.filter(s => !deadCms(s.quiz_id)), [scores, deadCms]);
  const liveStars = useMemo(() => Object.fromEntries(Object.entries(practiceStars || {}).map(([u, o]) => [u, Object.fromEntries(Object.entries(o || {}).filter(([k]) => !deadCms(k)))])), [practiceStars, deadCms]);
  const liveCompleted = useMemo(() => Object.fromEntries(Object.entries(completed || {}).filter(([k]) => !deadCms(k))), [completed, deadCms]);
  const liveQuizDone = useMemo(() => Object.fromEntries(Object.entries(quizDone || {}).filter(([k]) => !deadCms(k))), [quizDone, deadCms]);
  // Банк ошибок: вопросы, которых больше нет нигде (удалённый свой урок, вопрос, убранный из
  // программы) — убираем. Только когда загружена вся программа и список своих уроков.
  // v79 (Доп. 392): для этого нужна программа всех ролей (сотни КБ), и раньше её грузили на каждом запуске, вместе
  // с главной. Теперь уборка — только если в банке есть ошибки, не чаще раза в день, через 6 с и не на бережной сети;
  // программу всех ролей после главной подтягивает фоновый прогрев (не успел — уборка ждёт тот же промис).
  const hasMistakes = mistakeBank.length > 0;
  React.useEffect(() => {
    if (!customLoaded || !hasMistakes) return; let alive = true;
    const day = ymd(new Date()), key = "sa_mb_clean" + ukP;
    try { if (localStorage.getItem(key) === day) return; } catch (e) {}
    if (thriftyNet()) return;
    const t = setTimeout(() => loadAllModules().then(() => {
      if (!alive) return;
      const allMods = [...Object.values(MODULES).flat(), ...Object.values(customByRole).flat()];
      const liveQ = new Set(allMods.flatMap(m => (m.lessons || []).filter(l => l.type === "quiz").flatMap(l => (l.questions || []).map(q => q.q))));
      if (liveQ.size < 50) return;   // программа загрузилась не вся — лучше не трогать
      // Доп. 291: ошибки практики живут, пока такая ситуация есть в программе
      const livePQ = practiceQuestionTexts(allMods);
      // v83: ошибка из случая зала (lessonId case-…) в программе не значится — живёт, пока не исправлена
      setMistakeBank(prev => { const next = prev.filter(m => (isCaseMistake(m) || (m.from === "practice" ? livePQ.has(m.q) : liveQ.has(m.q)))); return next.length === prev.length ? prev : next; });
      try { localStorage.setItem(key, day); } catch (e) {}
    }).catch(() => {}), 6000);
    return () => { alive = false; clearTimeout(t); };
  }, [customLoaded, customByRole, hasMistakes, ukP]);
  // Гость недели: свои живые диалоги трека — в том же пуле, что штатные (правка 168)
  const weeklyOwn = useMemo(() => (customModules || []).filter(m => !m.hidden).flatMap(m => m.lessons.filter(l => l.type === "dialogue" && l.dialogue)), [customModules]);
  const weeklyId = useMemo(() => weeklyDialogueIdFrom(weeklyOwn.map(l => l.dialogue.id)), [weeklyOwn]);
  const weeklyInline = useMemo(() => (weeklyOwn.find(l => l.dialogue.id === weeklyId) || {}).dialogue || null, [weeklyOwn, weeklyId]);
  const examExtra = useMemo(() => (customByRole[examRole] || []).flatMap(m => m.lessons.filter(l => l.type === "quiz").flatMap(l => l.questions || [])), [customByRole, examRole]);
  const totalLessons = useMemo(() => programModules.reduce((a, m) => a + m.lessons.filter(l => l.type !== "result").length, 0), [programModules]);
  const roleLesonIds = useMemo(() => new Set(programModules.flatMap(m => m.lessons.filter(l => l.type !== "result").map(l => l.id))), [programModules]);
  const roleQuizIds = useMemo(() => new Set(programModules.flatMap(m => m.lessons.filter(l => l.type === "quiz").map(l => l.id))), [programModules]);
  const doneCount = useMemo(() => {
    const lessonsDone = Object.keys(completed).filter(k => completed[k] && roleLesonIds.has(k) && !roleQuizIds.has(k)).length;
    const quizzesDone = Object.keys(quizDone).filter(k => quizDone[k] && roleQuizIds.has(k)).length;
    return lessonsDone + quizzesDone;
  }, [completed, quizDone, roleLesonIds, roleQuizIds]);
  const progress = useMemo(() => totalLessons ? Math.round((doneCount / totalLessons) * 100) : 0, [doneCount, totalLessons]);

  // ── Доп. 301: «Разминка до смены» — три ситуации из уже начатого, в день смены ──
  const tbMod = useTableModule();
  // v31: слои поверх вкладок — один за раз (lib/layers.js); Наставник — поверх слоя
  const [layers, dispatchLayers] = React.useReducer(layersReducer, []);
  const layerSet = useMemo(() => {
    const set = (kind) => (v) => dispatchLayers(v != null && v !== false ? { type: "open", kind, data: v } : { type: "close", kind });
    return { warmup: set("warmup"), radio: set("radio"), recap: set("recap"), guest: set("guest"), special: set("special"),
      week: set("week"), mentor: set("mentor"), remind: set("remind"), pair: set("pair"), brief: set("brief") };
  }, []);
  const warmupOpen = layerData(layers, "warmup") != null, setWarmupOpen = layerSet.warmup;
  const [warmDone, setWarmDone] = useState("");
  const [schedTick, setSchedTick] = useState(0);
  React.useEffect(() => { try { setWarmDone(localStorage.getItem("sa_warmup" + ukP) || ""); } catch (e) { setWarmDone(""); } }, [ukP]);
  // график подтягивается тихо раз в день — разминка и серия знают смену, даже если
  // экран «График» в этом месяце не открывали (lib/schedule-sync.js)
  React.useEffect(() => {
    if (!profile || !storageLoaded || !profile.restaurant) return undefined;
    let alive = true;
    syncMySchedule(rpc, saToken(), profile).then((changed) => { if (alive && changed) setSchedTick((x) => x + 1); }).catch(() => {});
    return () => { alive = false; };
  }, [profile, storageLoaded]);
  // смена сегодня: своя копия графика, потом сводка sa_today_shift (её пишет экран графика)
  const shiftToday = useMemo(() => {
    if (!profile) return null;
    const sh = myShiftOn(profile, new Date());
    if (sh) return sh;
    try {
      const r = JSON.parse(localStorage.getItem("sa_today_shift") || "null");
      if (r && r.date === todayKey && r.label) return r.label === "выходной" ? { off: true } : { off: false, label: r.label };
    } catch (e) {}
    return null;
  }, [profile, todayKey, screen, schedTick]);   // eslint-disable-line react-hooks/exhaustive-deps
  const shiftText = shiftToday && !shiftToday.off ? (shiftToday.label || shiftLabel(shiftToday)) : "";
  // ── v30 (Доп. 313, 315, 316): свежесть тем, зачёт на опыт, золотая тема — на телефоне ──
  // v31: логика вынесена в хук lib/use-day.js (useFreshMarks)
  const { marks, bumpMarks, freshMods, fadedIds, marksVer } = useFreshMarks({ profile, storageLoaded, ukP, programModules, completed, quizDone });
  const warmSits = useMemo(() => (role ? pickWarmup(warmupPool(programModules, completed, quizDone), 3, todayKey + ukP, fadedIds) : []),
    [role, programModules, completed, quizDone, todayKey, ukP, fadedIds]);
  // показываем в день смены (и когда график неизвестен); в выходной и после конца смены — нет
  const warmShow = !!profile && warmSits.length >= 2 && !(shiftToday && shiftToday.off)
    && !(shiftToday && typeof shiftToday.to === "number" && new Date().getHours() >= shiftToday.to);
  const finishWarmup = useCallback((res) => {
    try { localStorage.setItem("sa_warmup" + ukP, todayKey); } catch (e) {}
    setWarmDone(todayKey);
    touchStreak();
    logActivity("warmup");
    // v30: верный ответ с первого раза освежает тему (срок повтора не растёт)
    if (res && Array.isArray(res.okMods) && res.okMods.length) {
      let m = readFresh(ukP);
      new Set(res.okMods).forEach((id) => { if (m[id]) m = touchFresh(m, id, Date.now(), true); });
      saveFresh(ukP, m); bumpMarks();
    }
  }, [ukP, todayKey, touchStreak, logActivity]);
  // ── v30 (Доп. 319–320): «Радио в дорогу» и «Итоги месяца» — слои поверх вкладки ──
  const radioList = layerData(layers, "radio"), setRadioList = layerSet.radio;
  const recapKey = layerData(layers, "recap"), setRecapKey = layerSet.recap;
  // ── v30 (Доп. 312): «Живой гость» — слой поверх вкладки ──
  const guestOpen = layerData(layers, "guest") != null, setGuestOpen = layerSet.guest;
  const openGuest = useCallback(() => { vibrate("light"); loadTable(); setGuestOpen(true); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // ── v30: «Освежить тему», «Зачёт на опыт», «Раунд мастера» — тот же стол поверх трека ──
  const special = layerData(layers, "special"), setSpecial = layerSet.special;   // { mode, mod, sits, timer, verdict, key }
  const specialRef = useRef(null); specialRef.current = special;
  const pl3 = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
  const openTopicRun = useCallback((mode, mod) => {
    if (!mod) return;
    vibrate("light"); loadTable();
    if (mode === "credit") {
      if (creditTriedToday(ukP, mod.id, todayKey)) return;
      // задания зачёта — одни и те же весь день: открыть-закрыть, чтобы перебрать вопросы, не выйдет (ревью v31)
      const sits = creditPool(mod, todayKey + "|" + mod.id + "|" + ukP);
      if (sits.length < 5) return;
      const need = Math.ceil(sits.length * CREDIT_PASS / CREDIT_N);
      // v31: сначала правила; попытка дня тратится только с первым ответом (раньше — при открытии)
      setSpecial({ mode, mod, sits, key: Date.now(), verdict: {
        ok: "Тема засчитана с пометкой «по опыту», руководитель увидит это в отчёте.",
        bad: "Нужно " + need + " из " + sits.length + ". Пройди тему по урокам или попробуй зачёт завтра." },
        intro: { title: "Зачёт на опыт", sub: mod.title, cta: "Начать зачёт",
          lines: [sits.length + " " + pl3(sits.length, "задание", "задания", "заданий") + ": вопросы теста и ситуации из практики темы",
            "Без подсказок и второго шанса, как на смене", "Нужно " + need + " из " + sits.length + ", тогда тема засчитана с пометкой «по опыту». Её видно в отчёте",
            "Одна попытка в день. Она начнётся с первого ответа, а открыть и закрыть можно без потерь"],
          icons: ["pencil", "x", "check", "moon"] },
        onBegin: () => { markCreditTry(ukP, mod.id, todayKey); bumpMarks(); } });
    } else if (mode === "gold") {
      const key = Date.now();
      // v40: в правилах — столько заданий, сколько на самом деле в раунде (в маленькой теме их меньше 8,
      // и плитка темы уже показывает настоящее число)
      const gSits = goldPool(mod);
      const gN = gSits.length || GOLD_N;
      setSpecial({ mode, mod, sits: gSits, timer: GOLD_TIMER, key, verdict: {
        ok: "Номер темы в треке теперь золотой, а в «Книге отзывов» стоит печать.",
        bad: "Для золота нужно не больше одной ошибки. Можно сразу ещё раз." },
        intro: { title: "Раунд мастера", sub: mod.title, cta: "Начать раунд",
          lines: [gN + " " + pl3(gN, "задание", "задания", "заданий") + ", на каждое " + GOLD_TIMER + " секунд (последние 5 тикают)", "Без подсказок", "Одна ошибка в запасе: это запасная свеча",
            "Если получится, номер темы станет золотым, а в «Книге отзывов» появится печать"],
          icons: ["stopwatch", "x", "candle", "crown"] } });
      // v31: рекорд заведения по теме (этап 25) — в правилах и в чеке
      rpc("gold_records", { p_token: saToken(), p_mod: mod.id }).then((r) => {
        const cur = specialRef.current;
        if (!r || !r.ok || !cur || cur.key !== key) return;
        const b = r.best;
        setSpecial({ ...cur, record: r, intro: cur.intro ? { ...cur.intro,
          note: b && b.sec ? "Рекорд заведения: " + Math.floor(b.sec / 60) + ":" + String(b.sec % 60).padStart(2, "0") + " (" + (b.me ? "твой" : b.name + (b.initial ? " " + b.initial + "." : "")) + ")" + (r.mine && r.mine.sec && !b.me ? " · твой: " + Math.floor(r.mine.sec / 60) + ":" + String(r.mine.sec % 60).padStart(2, "0") : "") : "" } : cur.intro });
      }).catch(() => {});
    } else {
      if (!canRefresh(mod)) return;
      const rec = readFresh(ukP)[mod.id];
      const nd = INTERVALS[Math.min(((rec && rec.n) || 0) + 1, INTERVALS.length - 1)];
      setSpecial({ mode: "refresh", mod, sits: refreshPick(tablePool(mod), 3, String(Date.now())), key: Date.now(), verdict: {
        ok: "Тема снова свежая. Следующий повтор через " + nd + " " + pl3(nd, "день", "дня", "дней") + ".",
        bad: "Нужно хотя бы 2 верных ответа, а пока тема бледная." } });
    }
  }, [ukP, todayKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  // v31: «Освежить всё выдохшееся» — 2–3 темы за один заход (по 2 задания, одна тема — 3)
  const openFreshAll = useCallback(() => {
    const list = fadedList(marks.fresh, freshMods, completed, quizDone).slice(0, 3);
    if (!list.length) return;
    vibrate("light"); loadTable();
    const per = list.length === 1 ? 3 : 2;
    const seed = String(Date.now());
    const sits = list.flatMap((x, i) => refreshPick(tablePool(x.mod), per, seed + i).map((sit) => ({ ...sit, _mod: x.mod.id })));
    const mods = list.map((x) => x.mod);
    setSpecial({ mode: "freshall", mods, sits, key: Date.now(), verdict: {
      name: mods.length + " " + pl3(mods.length, "тема", "темы", "тем"),
      ok: "Освежённые темы снова полные, а следующий повтор будет позже, чем в прошлый раз.",
      bad: "Тема считается освежённой, если верно хотя бы половина её заданий." },
      extra: ({ okMods, sits: used }) => {
        const per2 = {}, ok = {};
        (used || []).forEach((x) => { if (x && x._mod) per2[x._mod] = (per2[x._mod] || 0) + 1; });
        (okMods || []).forEach((id) => { ok[id] = (ok[id] || 0) + 1; });
        return <ul className="r-topics">{mods.map((m) => { const good = (ok[m.id] || 0) >= Math.ceil((per2[m.id] || 1) / 2); return <li key={m.id}><span className="t">«{m.title}»</span><span className={"v" + (good ? " ok" : "")}>{good ? "освежена ✓" : "ещё раз"}</span></li>; })}</ul>;
      } });
  }, [marks, freshMods, completed, quizDone]);   // eslint-disable-line react-hooks/exhaustive-deps
  // v31: «Проверка по треку» для опытных — по 2 задания из каждой непройденной темы (до 8 тем)
  const probeMods = useMemo(() => programModules.filter((m) => !moduleDone(m, completed, quizDone) && canCredit(m)).slice(0, 8), [programModules, completed, quizDone]);
  const openProbe = useCallback(() => {
    if (probeMods.length < 2) return;
    vibrate("light"); loadTable();
    const seed = Date.now();
    const sits = probeMods.flatMap((m, i) => creditPool(m, seed + i).slice(0, 2));
    const mods = probeMods;
    setSpecial({ mode: "probe", mods, sits, key: seed, verdict: {
      name: mods.length + " " + pl3(mods.length, "тема", "темы", "тем") + " · " + sits.length + " " + pl3(sits.length, "задание", "задания", "заданий"),
      ok: "Если оба ответа по теме верные, она тебе знакома: сдай её на опыт (7 заданий без подсказок). Остальные проходи по урокам." },
      intro: { title: "Проверка по треку", sub: "для тех, кто уже работал в сервисе", cta: "Начать проверку",
        lines: ["По 2 задания из каждой непройденной темы, всего " + sits.length + " " + pl3(sits.length, "задание", "задания", "заданий") + ", минут 10",
          "Без подсказок, чтобы честно понять, что уже знаешь", "В конце будет видно, какие темы можно сдать на опыт, а какие пройти по урокам",
          "Ничего не засчитывается само и ничего не теряется"],
        icons: ["pencil", "x", "check", "moon"] },
      extra: ({ okMods, sits: used }) => {
        const per2 = {}, ok = {};
        (used || []).forEach((x) => { if (x && x._mod) per2[x._mod] = (per2[x._mod] || 0) + 1; });
        (okMods || []).forEach((id) => { ok[id] = (ok[id] || 0) + 1; });
        return <ul className="r-topics">{mods.map((m) => {
          const n = ok[m.id] || 0, t = per2[m.id] || 0, strong = t > 0 && n >= t;
          const can = strong && canCredit(m) && !creditTriedToday(ukP, m.id, todayKey);
          return <li key={m.id}><span className="t">«{m.title}»</span><span className={"v" + (strong ? " ok" : "")}>{n} из {t}</span>{can ? <button type="button" onClick={() => openTopicRun("credit", m)}>Зачёт</button> : null}</li>;
        })}</ul>;
      } });
  }, [probeMods, ukP, todayKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  const topicActs = useMemo(() => ({ refresh: (m) => openTopicRun("refresh", m), credit: (m) => openTopicRun("credit", m), gold: (m) => openTopicRun("gold", m),
    tried: (id) => creditTriedToday(ukP, id, todayKey), cellar: () => navigate("cellar") }), [openTopicRun, ukP, todayKey, marksVer]);   // eslint-disable-line react-hooks/exhaustive-deps
  const openWarmup = useCallback(() => { vibrate("light"); loadTable(); setWarmupOpen(true); }, []);
  // ── v56 (Доп. 369): «что сейчас» — главная подсказывает одно действие по времени и смене (lib/now-card.js):
  // до смены — разминка, на смене — в перерыв ошибки или SOS, после смены — «как прошла?», после перерыва в
  // занятиях — «С возвращением». Часы обновляются раз в минуту, пока приложение открыто.
  // «как прошла смена» — та же шкала и та же запись, что «Как настрой сегодня?» (ui/mood-cards.jsx): уже ответил сегодня —
  // не спрашиваем; ответ уходит в пульс команды руководителю (save_mood)
  const [shiftMood, setShiftMood] = useState(null);
  React.useEffect(() => { setShiftMood(readMood(todayKey)); }, [todayKey, screen]);
  const saveShiftMood = useCallback((lvl) => { recordMood(lvl, todayKey); setShiftMood(String(lvl)); }, [todayKey]);
  // когда заходил в приложение в прошлый раз: «С возвращением» — только если и не заходил 3+ дня (не просто не учился);
  // в день возвращения приветствие держится до вечера (sa_back_day)
  const [openAway, setOpenAway] = useState(0);
  React.useEffect(() => {
    if (!profile || !ukP) return;
    let prev = null, back = null;
    try { prev = localStorage.getItem("sa_last_open" + ukP); back = localStorage.getItem("sa_back_day" + ukP); } catch (e) {}
    let gap = prev ? dayDiff(prev, todayKey) : 99;
    if (back === todayKey) gap = 99;
    else if (gap >= 3) { try { localStorage.setItem("sa_back_day" + ukP, todayKey); } catch (e) {} }
    try { localStorage.setItem("sa_last_open" + ukP, todayKey); } catch (e) {}
    setOpenAway(gap);
  }, [ukP, todayKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [nowTick, setNowTick] = useState(0);
  React.useEffect(() => { const t = setInterval(() => setNowTick((x) => x + 1), 60000); return () => clearInterval(t); }, []);
  const dueNow = mistakeBank.filter((m) => !m.due || m.due <= Date.now()).length;
  // самый первый день: ничего не пройдено ни в одном треке, серии нет, сегодня ни шага — одно главное действие
  // (первый урок), табличка дня — «Первый день». Сменил трек — это не первый день: плашки и «сейчас» остаются.
  const firstDay = !Object.keys(completed || {}).length && !Object.keys(quizDone || {}).length && !(streak && streak.count) && !todaySteps;
  const nowCtx = useMemo(() => (profile && role ? nowMode({ now: new Date(), shift: shiftToday, started: !firstDay, warmReady: warmSits.length >= 2, warmDone: warmDone === todayKey,
    due: dueNow, away: daysAway(activity, todayKey), openAway, stepsToday: todaySteps, mood: shiftMood }) : null),
    [profile, role, shiftToday, firstDay, warmSits, warmDone, todayKey, dueNow, activity, openAway, todaySteps, shiftMood, nowTick]);   // eslint-disable-line react-hooks/exhaustive-deps
  const nowCard = nowCtx ? { ...nowCtx, ...nowCardText(nowCtx, { warmN: warmSits.length, warmWhat: warmSits.some((x) => x.genre !== "quiz") ? "ситуации" : "вопроса" }) } : null;
  // обработчики — отдельно: ответ «как прошла смена» показывается и после того, как карточка «сейчас» уже ушла
  const nowOn = { warmup: openWarmup, mistakes: () => navigate("mistakes"), sos: () => navigate("sos"), mood: saveShiftMood, ask: (q) => askMentor(q) };   // askMentor и navigate объявлены ниже — зовём при нажатии
  // Доп. 304: напоминание из Telegram (?go=warmup или startapp=go_warmup) открывает разминку сразу
  const warmLinkRef = useRef(null);
  if (warmLinkRef.current === null) {
    try {
      const q = new URLSearchParams(location.search).get("go");
      const sp = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.start_param;
      warmLinkRef.current = q === "warmup" || sp === "go_warmup";
    } catch (e) { warmLinkRef.current = false; }
  }
  React.useEffect(() => {
    // v32: ждём и прогресс с телефона — без него пул разминки пуст, и ссылка уводила в трек
    // (гонка: модуль стола иногда подгружался раньше, чем читался сохранённый прогресс)
    if (!warmLinkRef.current || !profile || !tbMod || !storageLoaded) return;
    if (warmSits.length < 2) {
      // Доп. 310: разминать пока нечего (уроки трека ещё не приехали — подождём; приехали, а
      // заданий нет) — ссылка из напоминания не молчит, а открывает трек.
      // v33 (Доп. 342): «приехали» — по тому же списку уроков, из которого собрана разминка
      // (modules), а не по общему MODULES: уроки уже загрузились, а разминка ещё считалась по
      // пустому списку — и ссылка иногда уводила в трек вместо разминки
      if (role && modules.length) { warmLinkRef.current = false; navigate("home"); }
      return;
    }
    warmLinkRef.current = false;
    setWarmupOpen(true);
  }, [profile, tbMod, warmSits.length, role, storageLoaded, modules.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Доп. 305: чек недели — что сделано за 7 дней, можно отправить команде ──
  const weekOpen = layerData(layers, "week"), setWeekOpen = layerSet.week;   // null | "last7" | "prev"
  const [reportSelf, setReportSelf] = useState(false);   // Доп. 309: «Мой отчёт» — сразу своя карточка
  const [weekSeen, setWeekSeen] = useState("");
  React.useEffect(() => { try { setWeekSeen(localStorage.getItem("sa_week_seen" + ukP) || ""); } catch (e) { setWeekSeen(""); } }, [ukP]);
  const prevWeekEnd = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; }, [todayKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  const prevWeek = useMemo(() => weekSummary(activity, streak, prevWeekEnd), [activity, streak, prevWeekEnd]);
  // по понедельникам на главной — карточка «Чек недели готов» за прошлую неделю (пн–вс)
  const weekCardShow = !!profile && new Date().getDay() === 1 && weekSeen !== todayKey && prevWeek.activeDays > 0;
  const openWeek = useCallback((kind) => {
    vibrate("light"); loadTable(); setWeekOpen(kind || "last7");
    if (kind === "prev") { try { localStorage.setItem("sa_week_seen" + ukP, todayKey); } catch (e) {} setWeekSeen(todayKey); }
  }, [ukP, todayKey]);

  // ── Доп. 302: «Разобрать с Наставником» — чат поверх ситуации, вопрос уже задан ──
  const mentorAsk = layerData(layers, "mentor"), setMentorAsk = layerSet.mentor;
  const askMentor = useCallback((q) => { if (q) setMentorAsk(String(q)); }, []);

  // ── Доп. 304: напоминания в Telegram за час до смены (этап 22б) ──
  const remindOpen = layerData(layers, "remind") != null, setRemindOpen = layerSet.remind;
  const [tgRemind, setTgRemind] = useState(false);
  React.useEffect(() => { setTgRemind(readRemindFlag(ukP)); }, [ukP]);
  // ── Доп. 303: подтверждение в зале — сколько запросов ждут старшего (этап 22) ──
  const isLead = !!profile && (!!profile.is_admin || ["manager", "senior"].includes(profile.position));
  const [hallInbox, setHallInbox] = useState(0);
  React.useEffect(() => {
    if (!isLead || !storageLoaded || !["teamHub", "roleSelect"].includes(screen)) return undefined;
    let alive = true;
    rpc("skill_requests_inbox", { p_token: saToken() }).then((res) => {
      if (alive && res && res.ok && Array.isArray(res.rows)) setHallInbox(res.rows.length);
    }).catch(() => {});
    return () => { alive = false; };
  }, [isLead, storageLoaded, screen]);
  // ссылка из сообщения бота: ?go=mentor / startapp=go_mentor — сразу в «Наставничество»
  const mentorLinkRef = useRef(null);
  if (mentorLinkRef.current === null) {
    try {
      const q = new URLSearchParams(location.search).get("go");
      const sp = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.start_param;
      mentorLinkRef.current = q === "mentor" || sp === "go_mentor";
    } catch (e) { mentorLinkRef.current = false; }
  }
  React.useEffect(() => {
    if (!mentorLinkRef.current || !profile || !storageLoaded) return;
    mentorLinkRef.current = false;
    navigate("mentor");
  }, [profile, storageLoaded]);   // eslint-disable-line react-hooks/exhaustive-deps
  const navigate = useCallback((to, opts) => {
    const cur = screenRef.current;
    if (TAB_SCREENS.includes(to)) commitStack([]);                          // вкладка — новая ветка, назад некуда
    else if (opts && opts.replace) { /* Доп. 158: замена экрана — текущий в историю не пишем (диалог → Книга) */ }
    else if (cur !== to) commitStack([...navRef.current, cur].slice(-24));  // push, без дублей при повторе
    screenRef.current = to; setScreen(to); setLessonDone(null);
  }, [commitStack]);
  // Новый экран и новый урок открываются СВЕРХУ. Прокручиваемых контейнеров
  // два — корень приложения и тело урока, — и оба сохраняли позицию при смене
  // содержимого. Из-за этого, дочитав длинный урок до конца и нажав «Дальше»,
  // человек попадал на следующий сразу в его конец. Горизонтальные ленты
  // не трогаем: там позиция осмысленна и её сбрасывать не нужно.
  useEffect(() => {
    const top = (el) => {
      if (!el) return;
      try { el.scrollTop = 0; } catch (e) {}
    };
    top(document.getElementById("root"));
    top(document.scrollingElement);
    // Внутренние вертикальные скроллеры экранов (тело урока, справочника и пр.)
    try {
      document.querySelectorAll("div").forEach(el => {
        if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight
            && el.scrollWidth <= el.clientWidth + 1) top(el);
      });
    } catch (e) {}
  }, [screen, activeLesson?.id]);

  const goBack = useCallback((fallback = "roleSelect") => {
    const st = navRef.current.slice();
    let to = st.pop();
    while (to === screenRef.current && st.length) to = st.pop(); // защита от петель
    commitStack(st);
    const dest = to || fallback; screenRef.current = dest; setScreen(dest);
  }, [commitStack]);
  const openRadio = useCallback(() => {
    vibrate("light"); loadTable();
    setRadioList(playlist({ modules: programModules, completed, quizDone, faded: [...fadedIds], seed: todayKey + ukP }));
  }, [programModules, completed, quizDone, fadedIds, todayKey, ukP]);   // eslint-disable-line react-hooks/exhaustive-deps
  const recapWhich = useMemo(() => recapMonth(activity), [activity]);
  const openRecap = useCallback((key) => { vibrate("light"); setRecapKey(key || recapWhich.key); try { localStorage.setItem("sa_recap_seen" + ukP, recapWhich.key); } catch (e) {} }, [recapWhich, ukP]);
  // ── v30 (Доп. 314): «Квест смены» — общая цель смены (сервер) и три личных задания на день ──
  const [questTick, setQuestTick] = useState(0);
  const [questVer, setQuestVer] = useState(0);
  // задания выбираются, когда человек впервые за день открыл «Смену» (данные уже загружены) — и до вечера не меняются
  const onShiftTab = screen === "shift";
  const questTasks = useMemo(() => {
    if (!profile || !storageLoaded || !onShiftTab || !programModules.length) return [];
    const nx = nextLessonOf(programModules, completed, quizDone);
    return tasksFor(ukP, {
      day: todayKey, dueMistakes: mistakeBank.filter((m) => !m.due || m.due <= Date.now()).length,
      faded: fadedList(marks.fresh, freshMods, completed, quizDone).slice(0, 1).map((x) => ({ id: x.mod.id, title: x.mod.title })),
      warm: warmShow && warmDone !== todayKey, next: nx && nx.lesson ? { title: nx.lesson.title } : null, guest: true,
    });
  }, [profile, ukP, todayKey, programModules.length, storageLoaded, onShiftTab]);   // eslint-disable-line react-hooks/exhaustive-deps
  const onQuestTask = useCallback((t) => {
    if (!t) return;
    if (t.go === "mistakes") navigate("mistakes");
    else if (t.go === "refresh") { const m = programModules.find((x) => x.id === t.mod); if (m) openTopicRun("refresh", m); else navigate("home"); }
    else if (t.go === "warmup") { if (warmSits.length >= 2) openWarmup(); else navigate("home"); }
    else if (t.go === "guest") openGuest();
    else navigate("home");
  }, [programModules, openTopicRun, warmSits.length, openWarmup, openGuest, navigate]);
  const onQuestComplete = useCallback((day) => { const before = questDays(ukP).length; const after = markQuestDone(ukP, day).length; if (after > before) { vibrate("success"); setQuestVer((v) => v + 1); } }, [ukP]);
  // ── v30 (Доп. 318): «Свеча на двоих» — статус пары; v31: сводка дня одним запросом (этап 25) ──
  const pairOpen = layerData(layers, "pair") != null, setPairOpen = layerSet.pair;
  const { brief, briefStatus, pairInfo, setPairInfo, refreshDay } = useDayBrief({ profile, storageLoaded, screen, activity });
  const refreshPair = refreshDay;
  // квест: без этапа 25 карточка грузит сама — перечитать при входе во вкладку «Смена» и после занятий
  useEffect(() => { if (screen === "shift") setQuestTick((t) => t + 1); }, [screen]);
  useEffect(() => {
    if (screen !== "shift") return undefined;
    const t = setTimeout(() => setQuestTick((x) => x + 1), 25000);
    return () => clearTimeout(t);
  }, [activity, screen]);
  const pairLine = pairLineOf(pairInfo);
  // v82 (Доп. 395): брифинг смены от руководителя (этап 32: brief_today). Карточка — в «Смене», пока брифинг дня есть;
  // спрашиваем при входе во вкладку, не чаще раза в пять минут; без этапа 32 — больше не спрашиваем до перезапуска.
  const [teamBrief, setTeamBrief] = useState(null);   // { data, author, mine, sent, at } | null
  const [briefSeen, setBriefSeen] = useState("");
  const briefView = layerData(layers, "brief"), setBriefView = layerSet.brief;
  const briefAskRef = useRef({ at: 0, off: false, open: false });
  const briefKeyOf = (b) => (b && b.data ? (b.data.day || "") + "|" + (b.at || "") : "");
  React.useEffect(() => { try { setBriefSeen(localStorage.getItem("sa_brief_seen" + ukP) || ""); } catch (e) { setBriefSeen(""); } }, [ukP]);
  const loadTeamBrief = useCallback((force) => {
    const st = briefAskRef.current;
    if (!profile || !profile.restaurant || st.off || (!force && Date.now() - st.at < 5 * 60e3)) return;
    st.at = Date.now();
    rpc("brief_today", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) { st.off = true; return; }
      if (r && r.ok) setTeamBrief(r.brief && r.brief.data ? r.brief : null);
    }).catch(() => { st.at = 0; });
  }, [profile]);
  useEffect(() => { if (screen === "shift" && storageLoaded) loadTeamBrief(false); }, [screen, storageLoaded, loadTeamBrief]);
  const openTeamBrief = useCallback(() => {
    if (!teamBrief) return;
    vibrate("light");
    const k = briefKeyOf(teamBrief);
    setBriefSeen(k); try { localStorage.setItem("sa_brief_seen" + ukP, k); } catch (e) {}
    setBriefView(true);
  }, [teamBrief, ukP, setBriefView]);   // eslint-disable-line react-hooks/exhaustive-deps
  // v83 (Доп. 396): случаи из нашего зала — числа для пункта «Смены» (этап 33, case_list counts): ждут разбора, новые,
  // ответ на свой. Как брифинг: при входе во вкладку, не чаще раза в пять минут; без этапа 33 пункта нет.
  const [caseCounts, setCaseCounts] = useState(null);
  const [casesOn, setCasesOn] = useState(true);
  const [casesPlayed, setCasesPlayed] = useState(0);   // раунд случаев закончился — экран пересчитывает «новые»
  const caseAskRef = useRef({ at: 0, off: false });
  const loadCaseCounts = useCallback((force) => {
    const st = caseAskRef.current;
    if (!profile || !profile.restaurant || st.off || (!force && Date.now() - st.at < 5 * 60e3)) return;
    st.at = Date.now();
    rpc("case_list", { p_token: saToken(), p_mode: "counts", p_since: readSince(ukP) || null }).then((r) => {
      if (rpcMissing(r)) { st.off = true; setCasesOn(false); return; }
      if (r && r.ok) setCaseCounts(r);
    }).catch(() => { st.at = 0; });
  }, [profile, ukP]);
  useEffect(() => { if (screen === "shift" && storageLoaded) loadCaseCounts(false); }, [screen, storageLoaded, loadCaseCounts]);
  const openCases = useCallback((sits) => {
    if (!sits || !sits.length) return;
    loadTable();
    const n = sits.length;
    setSpecial({ mode: "cases", sits, key: Date.now(),
      mod: { id: "cases", title: ((profile && profile.restaurant) || "Наш зал") + " · " + n + " " + pl3(n, "случай", "случая", "случаев"), lessons: sits.map((s) => ({ id: s._from })) } });
  }, [profile]);   // eslint-disable-line react-hooks/exhaustive-deps
  const casesOpened = useCallback(() => { markSince(ukP, new Date().toISOString()); setCaseCounts((c) => (c ? { ...c, fresh: 0, mine_new: 0 } : c)); }, [ukP]);
  // v84 (Доп. 397): спасибо от гостей — пункт в «Я» (свой QR) и в «Команде» у руководителя. Числа для подписи — my_thanks,
  // но только у тех, кто уже открывал экран (иначе код создавался бы каждому, кто заглянул во вкладку «Я»).
  const [thanksInfo, setThanksInfo] = useState(null);
  const [thanksOn, setThanksOn] = useState(true);
  const [thanksTab, setThanksTab] = useState("mine");
  const thanksAskRef = useRef({ at: 0, off: false });
  const thanksUsed = () => { try { return localStorage.getItem("sa_thanks_on" + ukP) === "1"; } catch (e) { return false; } };
  useEffect(() => {
    const st = thanksAskRef.current;
    if (screen !== "me" || !storageLoaded || !profile || st.off || !thanksUsed() || Date.now() - st.at < 5 * 60e3) return;
    st.at = Date.now();
    rpc("my_thanks", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) { st.off = true; setThanksOn(false); return; }
      if (r && r.ok) setThanksInfo(r);
    }).catch(() => { st.at = 0; });
  }, [screen, storageLoaded, profile, ukP]);   // eslint-disable-line react-hooks/exhaustive-deps
  const openThanks = (tab) => { vibrate("light"); setThanksTab(tab); navigate("thanks"); };
  // v85 (Доп. 398): рассадка — пункт в «Смене»; без этапа 35 (экран ответил, что его нет) пункт пропадает до перезапуска
  const [seatOn, setSeatOn] = useState(true);
  // ссылка «Брифинг смены» из Telegram (?go=brief): открыть, как только брифинг пришёл
  useEffect(() => { if (briefAskRef.current.open && teamBrief) { briefAskRef.current.open = false; openTeamBrief(); } }, [teamBrief, openTeamBrief]);
  // v31: ссылки из подталкиваний бота: ?go=pair|league|cellar|month|shift|radio|guest|probe (или startapp=go_…)
  const goLinkRef = useRef(null);
  if (goLinkRef.current === null) {
    try {
      const q = new URLSearchParams(location.search).get("go");
      const sp = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.start_param;
      const v = q || (sp && /^go_/.test(sp) ? String(sp).slice(3) : "");
      goLinkRef.current = ["pair", "league", "cellar", "month", "shift", "quest", "radio", "guest", "probe", "mastery", "mistakes", "brief", "cases", "thanks", "seat"].includes(v) ? v : "";   // v40: mastery — бот «… стал мастером роли»; v81: mistakes — «Разобрать ошибку» под вопросом дня; v82: brief — «Брифинг смены»
    } catch (e) { goLinkRef.current = ""; }
  }
  React.useEffect(() => {
    const g = goLinkRef.current;
    if (!g || !profile || !storageLoaded) return;
    if (["cellar", "radio", "probe"].includes(g) && !programModules.length) return;   // ждём уроки трека
    if (g === "mastery" && role && !modules.length) return;                         // v40: значки считаются по урокам роли
    goLinkRef.current = "";
    if (g === "pair") setPairOpen(true);
    else if (g === "league") navigate("league");
    else if (g === "cellar") navigate("cellar");
    else if (g === "month") openRecap();
    else if (g === "shift" || g === "quest") navigate("shift");
    else if (g === "radio") openRadio();
    else if (g === "guest") openGuest();
    else if (g === "probe") { navigate("cellar"); openProbe(); }
    else if (g === "mastery") openMastery();
    else if (g === "mistakes") navigate("mistakes");
    else if (g === "brief") { navigate("shift"); briefAskRef.current.open = true; loadTeamBrief(true); }
    else if (g === "cases") navigate("cases");   // v83: «Разобрать» / «Открыть» из сообщений о случаях
    else if (g === "thanks") { setThanksTab("mine"); navigate("thanks"); }   // v84: «Гость сказал тебе спасибо»
    else if (g === "seat") navigate("seat");   // v85: «Стол 6: посадили…»
  }, [profile, storageLoaded, programModules.length, modules.length]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Кнопка «Назад» Telegram в шапке мини-приложения: на вкладках и на входе её нет, на
  // остальных экранах она делает то же, что стрелка «‹» на самом экране (включая запись
  // выхода из теста). Стрелки нет — шаг назад по истории переходов.
  useEffect(() => {
    if (!isTelegram()) return;
    const bb = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.BackButton;
    if (!bb) return;
    // Доп. 301–305: поверх вкладки открыт слой (разминка, чек недели, Наставник) — кнопка
    // «Назад» есть и закрывает верхний слой (его крестик или стрелку)
    const overlay = layers.length > 0;   // v31: любой слой поверх вкладки (lib/layers.js)
    const atRoot = (TAB_SCREENS.includes(screen) || screen === "login") && !overlay;
    try { if (atRoot) bb.hide(); else bb.show(); } catch (e) {}
    if (atRoot) return;
    const onTgBack = () => { if (!clickScreenBack()) goBack(); };
    try { bb.onClick(onTgBack); } catch (e) {}
    return () => { try { bb.offClick(onTgBack); } catch (e) {} };
  }, [screen, goBack, layers]);
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
  // Доп. 310: экзамен — тоже занятие (свеча, цель дня, чек недели); результат — в отчёт руководителя
  const recordExam = useCallback((roleId, result) => { setExamResults(prev => ({ ...prev, [roleId]: result })); try { touchStreak(); logActivity("exam"); } catch (e) {} }, [touchStreak, logActivity]);
  const openExam = useCallback((roleId) => { setExamRole(roleId); navigate("exam"); }, [navigate]);
  const openCertificate = useCallback((roleId) => { setExamRole(roleId); navigate("certificate"); }, [navigate]);
  // v68 (Доп. 381): личное с телефона — как при запуске (серия, ошибки, избранное, экзамены, уроки, роль). Раньше после
  // входа по коду без перезапуска приложения это не перечитывалось: серия оставалась нулём (или прежнего человека на
  // общем телефоне), а цель дня читалась заново — на главной «0 дней подряд» рядом с «цель дня 1/1».
  const loadLocalFor = useCallback((prof) => {
    const uk = prof ? `_${prof.name}_${prof.surname || ""}` : "";
    const get = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
    const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
    setQuizDone(obj(get("sa_quiz_done" + uk)) || {});
    const cr = get("sa_completed_roles" + uk);
    setCompletedRoles(new Set(Array.isArray(cr) ? cr : []));
    setCompleted(obj(get("sa_completed" + uk)) || {});
    const lr = get("sa_last_role" + uk);
    if (lr) setRole(lr);
    const st = obj(get("sa_streak" + uk)) || { count: 0, best: 0, last: "", days: [] };
    streakRef.current = st; setStreak(st);
    const mb = get("sa_mistakes" + uk);
    setMistakeBank(Array.isArray(mb) ? mb : []);
    setSaved(obj(get("sa_saved" + uk)) || {});
    setExamResults(obj(get("sa_exam" + uk)) || {});
  }, []);
  const handleLogin = useCallback((token, emp) => {
    const prof = { id: emp.id, name: emp.name, surname: normSurname(emp.surname || ""), restaurant: emp.restaurant, position: emp.position, is_admin: !!emp.is_admin };
    try {
      localStorage.setItem("sa_session_token", token || "demo");
      localStorage.setItem("sa_profile", JSON.stringify(prof));
    } catch(e) {}
    loadLocalFor(prof);   // v68: серия, ошибки, избранное — с телефона, как при запуске
    startBoot(token || "demo");   // v64: после входа — тоже одним запросом
    setProfile(prof);
    setScreen("roleSelect");
  }, [loadLocalFor]);
  const handleLogout = useCallback(() => {
    cancelDayPush();   // v31: отметка дня прошлого человека не уходит после выхода
    try {
      localStorage.removeItem("sa_session_token");
      localStorage.removeItem("sa_profile");
      localStorage.removeItem("sa_last_role");
    } catch(e) {}
    setProfile(null);
    setRole(null); setRoleAuto(false);
    setScreen("login");
  }, []);
  const selectRole = useCallback((r) => {
    setRole(r); setRoleAuto(false);   // v58: выбран самим — уже не «по должности»
    try { localStorage.setItem("sa_last_role" + (profile ? `_${profile.name}_${profile.surname || ""}` : ""), JSON.stringify(r)); } catch(e) {}
    // Сохраняем выбранную роль в Supabase
    if (profile) {
      rpcSync("save_last_role", { p_token: saToken(), p_role: r });
    }
    setScreen("home");
  }, [profile]);
  // Доп. 306: тема открывается сразу на тексте следующего непройденного урока — без лишней
  // ступеньки. Если следующий шаг — тест, практика, диалог или сборка, сначала содержание
  // раздела: там видно, на что подписываешься, и кнопка «Начать». Тема пройдена — содержание
  // (выбрать, что повторить). Содержание из урока — кнопка «1 из 6» в шапке.
  const openLessonRef = useRef(null);
  const openModule = useCallback((m) => {
    setActiveModule(m);
    const isDoneL = (l) => (l.type === "quiz" ? !!quizDone[l.id] : !!completed[l.id]);
    const step = ((m && m.lessons) || []).find((l) => l && l.type !== "result" && !isDoneL(l));
    if (step && step.type === "lesson" && openLessonRef.current) { openLessonRef.current(step); return; }
    setScreen("module");
  }, [completed, quizDone]);
  const openLesson = (l) => {
    setLessonDone(null); // Доп. 205: новый урок — кнопка снова «Урок пройден ✓»
    if (l.type === "quiz" && quizDone[l.id]) return;
    if (l.type === "quiz" && profile) { try { const sk = loopOpen(loopUk, l.id); if (sk) logSkip(l.id, sk); } catch (e) {} }
    if (l.type === "dialogue") { setActiveLesson(l); setGameKey(k => k + 1); navigate("lesson"); return; }
    if (l.type === "build") { setActiveLesson(l); setGameKey(k => k + 1); navigate("lesson"); return; }
    const originalLesson = (Object.values(MODULES).flat().flatMap(m => m.lessons || []).find(lesson => lesson.id === l.id)) || l;
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
    // Доп. 293: незаконченный раунд практики (ушёл к гостю, позвонили) — продолжаем с той же
    // ситуации, если вернулся в течение 12 часов. Законченный или старый — новый раунд, как раньше.
    let resumed = null;
    if (l.type === "practice") {
      try {
        const map = JSON.parse(localStorage.getItem(PRACTICE_RESUME_KEY + (profile ? `_${profile.name}_${profile.surname||""}` : "")) || "{}") || {};
        const r = map[l.id];
        if (r && Date.now() - (r.at || 0) < 12 * 3600 * 1000 && r.ps && Array.isArray(r.ps.situations) && r.ps.situations.length && !r.ps.done && (r.ps.lives || 0) > 0) resumed = { ...r.ps, flash: null, resumed: true };
      } catch (e) {}
    }
    if (resumed) setPracticeState(resumed);
    else {
      const shuffled = pickRandom(pool, 6).map(shuffleSituationOptions);
      const firstUsedIds = shuffled.map(s => s.scene || s.statement || s.question || JSON.stringify(s).slice(0,60));
      setPracticeState({ step: 0, choice: null, isAnswered: false, results: [], done: false, lives: 3, score: 0, combo: 0, situations: shuffled, flash: null, usedIds: firstUsedIds });
    }
    setGameKey(k => k + 1);
    navigate("lesson");
  };
  openLessonRef.current = openLesson;
  const ROLE_ORDER = ["seasonal", "core", "manager", "service_manager"];
  // Результат «Сборки» → звёзды практики: тот же контур (practice_stars), что и у
  // игровых практик — попадает в лидерборд и статистику без отдельного хранилища.
  // Шкала едина: без ошибок → 3, одна → 2, больше → 1. Сохраняется только улучшение.
  const recordBuildResult = useCallback((right, total) => {
    if (!profile || !activeLesson || !total) return;
    const missed = total - right;
    const stars = missed === 0 ? 3 : missed === 1 ? 2 : 1;
    const userKey = `${profile.name}|${profile.surname}`;
    const userStars = practiceStars[userKey] || {};
    const prevBest = userStars[activeLesson.id] || 0;
    if (stars <= prevBest) return; // хуже или так же — не трогаем лучший результат
    const nx = { ...practiceStars, [userKey]: { ...userStars, [activeLesson.id]: stars } };
    try { localStorage.setItem("sa_practice_stars", JSON.stringify(nx)); } catch(e) {}
    setPracticeStars(nx);
    rpcSync("save_practice_stars", { p_token: saToken(), p_lesson_id: activeLesson.id, p_stars: stars });
  }, [profile, activeLesson, practiceStars]);
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
    if (allRolesDone && allPerfect) achieved.push({ icon:"laurel", label:"Бог сервиса", key:"god" });

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

      // Стрик: отмечаем активность за сегодня (Доп. 288: с учётом графика — lib/streak.js)
      touchStreak();
      logActivity(["lesson", "quiz", "practice", "dialogue", "build"].includes(activeLesson.type) ? activeLesson.type : "lesson");   // Доп. 298

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
          try { localStorage.setItem("sa_quiz_done" + uk, JSON.stringify(newQuizDone)); } catch(e) {}
          setQuizDone(newQuizDone);
          rpcSync("save_quiz_done", { p_token: saToken(), p_quiz_id: activeLesson.id });
          try { const rec = loopPassed(loopUk, activeLesson); if (rec) {
            setLoophole(rec); setLoopRank(null); setLoopView("banner");
            // Ключ тайного зачёта — сразу на сервер; ответ — место в зачёте. Нет связи
            // или нет этапа 16 — ключ ждёт в очереди, карточка покажется без зачёта.
            const kp = { p_token: saToken(), p_lesson: rec.lessonId };
            rpc("log_quiz_key", kp).then(r => { if (r && r.ok) setLoopRank(r); else rpcSync("log_quiz_key", kp); })
              .catch(() => { try { rpcSync("log_quiz_key", kp); } catch (e) {} });
          } } catch (e) {}
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
      const allLessons = [...(MODULES[role] || []), ...(customModules || [])].flatMap(m => m.lessons).filter(l => l.type !== "result");   // свои — как родные (правка 165)
      const allDone = allLessons.length > 0 && allLessons.every(l => l.type === "quiz" ? newQuizDone[l.id] : newCompleted[l.id]); // Доп. 132: пустой список — не «всё пройдено»
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
        // Доп. 205: текстовый урок — остаёмся на месте, кнопка превращается в «Далее: …»;
        // тест, диалог, практика, Сборка — у них свои экраны результата, возвращаемся в модуль
        // Доп. 206: «Далее» в уроке — буквально следующий по порядку (после текущего), а не первый непройденный в роли
        // Свои разделы — в той же последовательности (правка 164): раньше урок своего раздела в
        // ней не находился, и «Дальше» уводило в штатную программу, в другую тему
        const seq = [...(MODULES[role] || []), ...(customModules || [])].flatMap(m => m.lessons.filter(l => l.type !== "result").map(l => ({ mod: m, lesson: l })));
        const cur = seq.findIndex(x => x.lesson.id === activeLesson.id);
        const nx = cur >= 0 ? (seq[cur + 1] || null) : nextLessonOf([...(MODULES[role] || []), ...(customModules || [])], newCompleted, newQuizDone);
        if (activeLesson.type === "lesson") {
          // Доп. 207: подсказка, а не принуждение — первое непройденное ПОЗАДИ текущего
          const isDone = (l) => l.type === "quiz" ? !!newQuizDone[l.id] : !!newCompleted[l.id];
          // Внутри своего раздела «позади» — только его шаги (правка 164): свои разделы стоят после
          // всей штатной программы, и подсказка звала назад к «85 непройденным» штатным урокам
          const behind = cur > 0 ? seq.slice(0, cur).filter(x => !(activeModule && activeModule.custom) || x.mod.id === activeModule.id) : [];
          const skipped = behind.find(x => !isDone(x.lesson)) || null;
          const skippedCount = behind.filter(x => !isDone(x.lesson)).length;
          setLessonDone({ next: nx ? { ...nx, other: nx.mod && activeModule && nx.mod.id !== activeModule.id, done: isDone(nx.lesson) } : null, skipped: skipped ? { ...skipped, count: skippedCount } : null });
        } else {
          setTimeout(() => setScreen("module"), 50);
        }
      }
    } catch(e) {
      console.error("completeLesson error:", e);
      setScreen("module");
    }
  }, [activeLesson, profile, quizState.answers, role, practiceState, scores, practiceStars, completed, quizDone, completedRoles, checkAndShowAchievements, customModules, touchStreak, logActivity]);
  // ── v30 (Доп. 315): «Зачёт на опыт» сдан — шаги темы засчитаны (тест — без балла: рейтинг не трогаем) ──
  const creditModule = useCallback((mod, res) => {
    if (!mod || !profile) return;
    const uk = `_${profile.name}_${profile.surname || ""}`;
    const steps = (mod.lessons || []).filter((l) => l.type !== "result");
    const newCompleted = { ...completed }; const newQuizDone = { ...quizDone };
    steps.forEach((l) => {
      if (l.type === "quiz") {
        if (!newQuizDone[l.id]) { newQuizDone[l.id] = true; rpcSync("save_quiz_done", { p_token: saToken(), p_quiz_id: l.id }); }
      } else if (!newCompleted[l.id]) {
        newCompleted[l.id] = true; rpcSync("save_progress", { p_token: saToken(), p_lesson_id: l.id, p_role: role });
      }
    });
    try { localStorage.setItem("sa_completed" + uk, JSON.stringify(newCompleted)); } catch (e) {}
    try { localStorage.setItem("sa_quiz_done" + uk, JSON.stringify(newQuizDone)); } catch (e) {}
    setCompleted(newCompleted); setQuizDone(newQuizDone);
    saveCredit(uk, mod.id, { d: ymd(new Date()), s: res.firstOk, t: res.total });
    bumpMarks();
    // роль пройдена целиком — как после последнего урока (completeLesson)
    const allLessons = [...(MODULES[role] || []), ...(customModules || [])].flatMap((m) => m.lessons).filter((l) => l.type !== "result");
    const allDone = allLessons.length > 0 && allLessons.every((l) => (l.type === "quiz" ? newQuizDone[l.id] : newCompleted[l.id]));
    const roleIdx = ROLE_ORDER.indexOf(role);
    const nextRole = roleIdx >= 0 ? ROLE_ORDER[roleIdx + 1] : undefined;
    const firstCompletion = nextRole ? !completedRoles.has(nextRole) : !completedRoles.has(role);
    if (allDone && firstCompletion) {
      const updatedRoles = new Set([...completedRoles, role]);
      if (nextRole) updatedRoles.add(nextRole);
      try { localStorage.setItem("sa_completed_roles" + uk, JSON.stringify([...updatedRoles])); } catch (e) {}
      setCompletedRoles(updatedRoles);
      [role, nextRole].filter(Boolean).forEach((r) => rpcSync("save_completed_role", { p_token: saToken(), p_role: r }));
      setTimeout(() => setScreen("roleComplete"), 50);
    }
  }, [profile, completed, quizDone, role, customModules, completedRoles]);
  const finishSpecial = useCallback((res) => {
    const sp = special; if (!sp || !res) return;
    const { mode, mod } = sp;
    if (mode === "refresh") {
      if (res.firstOk >= Math.min(2, res.total)) { saveFresh(ukP, touchFresh(readFresh(ukP), mod.id, Date.now(), false, mod.rev)); bumpMarks(); touchStreak(); logActivity("refresh"); }
    } else if (mode === "credit") {
      if (creditPassed(res.firstOk, res.total)) { creditModule(mod, res); touchStreak(); logActivity("credit"); }
    } else if (mode === "freshall") {
      // тема освежена, если верно хотя бы половина её заданий
      const per = {}, ok = {};
      (sp.sits || []).forEach((x) => { if (x && x._mod) per[x._mod] = (per[x._mod] || 0) + 1; });
      (res.okMods || []).forEach((id) => { ok[id] = (ok[id] || 0) + 1; });
      let m = readFresh(ukP), n = 0;
      (sp.mods || []).forEach((md) => { if ((ok[md.id] || 0) >= Math.ceil((per[md.id] || 1) / 2)) { m = touchFresh(m, md.id, Date.now(), false, md.rev); n++; } });
      if (n) { saveFresh(ukP, m); bumpMarks(); touchStreak(); logActivity("refresh", n); }
    } else if (mode === "cases") {   // v83: сыгранные случаи — «не новые» на этом телефоне
      markPlayed(ukP, (sp.sits || []).map((x) => x && x._case)); setCasesPlayed((v) => v + 1); touchStreak();
    } else if (mode === "gold") {
      if (goldPassed(res.firstOk, res.total)) {
        saveGold(ukP, mod.id, { d: todayKey, w: res.wrongN, sec: res.secs });
        if (canRefresh(mod)) saveFresh(ukP, touchFresh(readFresh(ukP), mod.id, Date.now(), false, mod.rev));
        bumpMarks(); touchStreak(); logActivity("gold");
      }
    }
  }, [special, ukP, todayKey, creditModule, touchStreak, logActivity]);
  const handleQuiz = useCallback((idx) => {
    if (quizState.blocked) return;
    const q = activeLesson.questions[quizState.step];
    const isCorrect = idx === q.correct;
    // Аналитика вопросов (stage 7): очередь тихо отбросит вызов, если RPC ещё не создан
    try { rpcSync("log_quiz_answer", { p_token: saToken(), p_role: role, p_lesson: activeLesson.id, p_question: (q.q || "").slice(0, 300), p_correct: isCorrect }); } catch(e) {}
    // Этап 15: что выбрал и что было верно — для «Аналитика → Люди». Идёт следом в той же
    // очереди и дописывается к записи выше; без этапа 15 тихо отклоняется, запись выше цела.
    try { rpcSync("log_quiz_pick", { p_token: saToken(), p_lesson: activeLesson.id, p_question: (q.q || "").slice(0, 300), p_answer: String((q.options || [])[idx] ?? "").slice(0, 300), p_right: String((q.options || [])[q.correct] ?? "").slice(0, 300) }); } catch(e) {}
    const newMistakes = quizState.mistakes + (isCorrect ? 0 : 1);
    const answers = [...quizState.answers, { idx, isCorrect }];
    const done = quizState.step + 1 >= activeLesson.questions.length;
    if (isCorrect) vibrate("light");
    else {
      vibrate("error");
      const _qe = { q: q.q, options: q.options, correct: q.correct, explanation: q.explanation || "", img: q.img || null, lessonTitle: (activeLesson && activeLesson.title) || "", lessonId: (activeLesson && activeLesson.id) || "", stage: 0, due: Date.now() };
      setMistakeBank(prev => {
        if (prev.some(m => m.q === q.q)) return prev;
        return [...prev, _qe].slice(-200);
      });
    }
    // Лазейка: помним попытку до «Продолжить ✓». Официальный конец — "pass" (70%+)
    // или "fail" (меньше 70% или три ошибки): провал — честная пересдача, не лазейка.
    try { if (profile) {
      const blockedNow = newMistakes >= 3 && !isCorrect;
      const passNow = !blockedNow && answers.filter(a => a.isCorrect).length >= activeLesson.questions.length * 0.7;
      loopTrack(loopUk, activeLesson, q, idx, (blockedNow || done) ? (passNow ? "pass" : "fail") : undefined);
    } } catch (e) {}
    if (newMistakes >= 3 && !isCorrect) {
      setQuizState({ step: quizState.step, answers, done: true, mistakes: newMistakes, blocked: true });
      return;
    }
    setQuizState({ step: done ? quizState.step : quizState.step + 1, answers, done, mistakes: newMistakes, blocked: false });
  }, [quizState, activeLesson, role, profile, loopUk]);
  // Верный ответ: вопрос уходит на следующий интервал (1→3→7→30 дней). После 4 верных подряд — закреплён и удаляется.
  const resolveMistake = useCallback((qText) => {
    setMistakeBank(prev => prev.map(m => {
      if (m.q !== qText) return m;
      const stage = (m.stage || 0) + 1;
      if (stage > SR_DAYS.length) return null; // вопрос закреплён
      return { ...m, stage, due: Date.now() + SR_DAYS[stage - 1] * 24 * 3600 * 1000 };
    }).filter(Boolean));
    touchStreak();   // Доп. 288: повтор ошибок — тоже занятие, свеча загорается
    logActivity("fix");
  }, [touchStreak, logActivity]);
  // Неверный ответ при повторе: прогресс сгорает, вопрос снова доступен сразу
  const failMistake = useCallback((qText) => {
    setMistakeBank(prev => prev.map(m => m.q === qText ? { ...m, stage: 0, due: Date.now() } : m));
    touchStreak();
  }, [touchStreak]);
  // Доп. 291: ошибки практики и «у стола» тоже попадают в «Работу над ошибками» —
  // тем же форматом, что вопросы тестов ({ q, options, correct, explanation, … }).
  const addMistakes = useCallback((items) => {
    const list = (items || []).filter(x => x && x.q && Array.isArray(x.options) && x.options.length > 1);
    if (!list.length) return;
    setMistakeBank(prev => {
      const have = new Set(prev.map(m => m.q));
      const add = [];
      list.forEach(x => { if (!have.has(x.q)) { have.add(x.q); add.push({ stage: 0, due: Date.now(), img: null, explanation: "", lessonTitle: "", lessonId: "", ...x }); } });
      return add.length ? [...prev, ...add].slice(-200) : prev;
    });
  }, []);
  // Единая точка сохранения банка ошибок (персональный ключ) — как у saved/examResults.
  // Раньше три колбэка писали общий "sa_mistakes" внутри setState-апдейтеров:
  // на общем устройстве банк перетекал между сотрудниками, а в StrictMode писался дважды.
  React.useEffect(() => {
    if (!storageLoaded || !profile) return;
    try { const uk = `_${profile.name}_${profile.surname||""}`; localStorage.setItem("sa_mistakes"+uk, JSON.stringify(mistakeBank)); } catch(e) {}
  }, [mistakeBank, storageLoaded, profile]);
  // v81 (Доп. 394): «Вопрос дня» в Telegram. Ответы из чата (этап 31: qday_inbox) — в банк ошибок, ответ сегодня
  // зажигает свечу; раз в день — очередь своих вопросов на сервер (qday_push): ошибки к повтору, потом пройденные темы.
  // Через 8 с после старта, чтобы не мешать главной; нет этапа 31 — до перезапуска не спрашиваем.
  const mistakeBankRef = useRef(mistakeBank); mistakeBankRef.current = mistakeBank;
  const quizDoneRef = useRef(quizDone); quizDoneRef.current = quizDone;
  const qdayOffRef = useRef(false);
  const progCount = programModules.length;
  React.useEffect(() => {
    if (!profile || !storageLoaded || !role || qdayOffRef.current || !saToken()) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await rpc("qday_inbox", { p_token: saToken() });
        if (!alive) return;
        if (rpcMissing(r)) { qdayOffRef.current = true; return; }
        const fresh = r && r.ok ? newQdayAnswers(ukP, r.items) : [];
        if (fresh.length) {
          setMistakeBank((prev) => applyQdayToBank(prev, fresh, SR_DAYS));
          markQdaySeen(ukP, fresh.map((a) => a.id));
          const today = ymd(new Date());
          const n = fresh.filter((a) => a.at && ymd(new Date(a.at)) === today).length;
          if (n) logActivity("fix", n);   // ответ в чате сегодня — как работа над ошибками: свеча горит
        }
      } catch (e) {}
      if (!alive || !progCount) return;
      try {
        const day = ymd(new Date());
        const label = (ROLES.find((x) => x.id === role) || {}).label || "";
        const items = buildQdayQueue({ mistakeBank: mistakeBankRef.current, programModules, quizDone: quizDoneRef.current, roleLabel: label, day, uk: ukP });
        if (items.length && qdayNeedsPush(ukP, day, items)) {
          const r2 = await rpc("qday_push", { p_token: saToken(), p_items: items });
          if (r2 && r2.ok) qdayMarkPushed(ukP, day, items);
          else if (rpcMissing(r2)) qdayOffRef.current = true;
        }
      } catch (e) {}
    }, 8000);
    return () => { alive = false; clearTimeout(t); };
  }, [profile, storageLoaded, role, ukP, todayKey, progCount]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Доп. 309: копия «телефонных» данных (ошибки, экзамены, дни занятий, разминки, навыки)
  // уходит на сервер для отчёта руководителя — через 20 с после изменений и при сворачивании.
  // Нет этапа 23 или сети — тихо, ничего не ломается.
  React.useEffect(() => {
    if (!storageLoaded || !profile) return;
    scheduleLearningPush({ uk: ukP, profile }, 20000);
  }, [storageLoaded, profile, ukP, mistakeBank, examResults, streak, activity, goal]);
  // Доп. 310: занятия в тренажёрах (колоды, «Сборка руками», спринт) приходят событием
  React.useEffect(() => {
    if (!profile) return undefined;
    const on = (e) => { try { const k = (e && e.detail && e.detail.kind) || "trainer"; touchStreak(); logActivity(k); } catch (err) {} };
    window.addEventListener(ACTIVITY_EVENT, on);
    return () => window.removeEventListener(ACTIVITY_EVENT, on);
  }, [profile, touchStreak, logActivity]);
  React.useEffect(() => {
    if (!profile) return undefined;
    const onHide = () => { try { if (document.visibilityState === "hidden") pushLearning({ uk: ukP, profile, force: true }); } catch (e) {} };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [profile, ukP]);
  // Доп. 293: незаконченный раунд практики помним до 12 часов (см. openLesson)
  // Раунды хранятся по урокам: открыть другую практику — не значит потерять эту.
  useEffect(() => {
    if (screen !== "lesson" || !activeLesson || activeLesson.type !== "practice") return;
    try {
      const k = PRACTICE_RESUME_KEY + (profile ? `_${profile.name}_${profile.surname||""}` : "");
      let map = {};
      try { map = JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { map = {}; }
      if (typeof map !== "object" || Array.isArray(map) || map.id) map = {};
      const now = Date.now();
      Object.keys(map).forEach(id => { if (!map[id] || now - (map[id].at || 0) > 12 * 3600 * 1000) delete map[id]; });
      const fresh = !practiceState.isAnswered && practiceState.step === 0;
      if (practiceState.done || fresh || !(practiceState.situations || []).length) delete map[activeLesson.id];
      else map[activeLesson.id] = { at: now, ps: { ...practiceState, flash: null } };
      if (Object.keys(map).length) localStorage.setItem(k, JSON.stringify(map)); else localStorage.removeItem(k);
    } catch (e) {}
  }, [practiceState, activeLesson, screen, profile]);
  // Доп. 288: раунд практики доигран — день засчитан в серию (в обоих видах), даже если
  // человек сыграет ещё раз и уйдёт без «Продолжить»
  useEffect(() => {
    if (screen === "lesson" && activeLesson && activeLesson.type === "practice" && practiceState.done) touchStreak();
  }, [practiceState.done]);   // eslint-disable-line react-hooks/exhaustive-deps
  const flashTimerRef = useRef(null);
  const practiceRef = useRef(practiceState); practiceRef.current = practiceState;
  const activeLessonRef = useRef(activeLesson); activeLessonRef.current = activeLesson;
  const handlePracticeChoice = useCallback((idx) => {
    // Доп. 291: промах практики (и в классическом виде, и «у стола») — в «Работу над ошибками»
    try {
      const p0 = practiceRef.current;
      const sit0 = p0 && !p0.isAnswered ? (p0.situations || [])[p0.step] : null;
      if (sit0) logActivity("sit");
      if (sit0 && idx !== sit0.correct) { const m = mistakeFromSituation(sit0, activeLessonRef.current); if (m) addMistakes([m]); }
    } catch (e) {}
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
  }, [addMistakes, logActivity]);
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

  // v50 (Доп. 363): телефон лёжа — шапки экранов ниже: сверху нет строки состояния, а высоты экрана мало
  const T0 = a11y ? A : S;
  const T = useMemo(() => (vp.short ? { ...T0, modHead: { ...T0.modHead, padding: "14px 18px 12px" },
    lessHead: { ...T0.lessHead, padding: "12px 18px 10px" }, homeHead: { ...T0.homeHead, padding: "14px 18px 8px" } } : T0), [T0, vp.short]);

  // Тяжёлые данные (СПГ-модули, живые диалоги) догружаются после первой
  // отрисовки — старт приложения их не ждёт. Тик состояния перерисовывает
  // интерфейс, когда данные готовы.
  // ── Онбординг: приветствие один раз в жизни + подсказка о повторении ──
  const [welcome, setWelcome] = useState(false);
  // Секретная ачивка «Находчивая жопка» (ui/loophole.jsx): карточка, пока не просмотрена
  const [loophole, setLoophole] = useState(null);
  // Сначала выезжает баннер-загадка, по тапу — карточка (решение владельца)
  const [loopView, setLoopView] = useState(null);   // "banner" | "card" | null
  const [loopRank, setLoopRank] = useState(null);   // место в тайном зачёте (этап 16)
  // Сервер — главный по ключам (правка 177): счёт «какой это раз» ачивка вела по своему
  // списку на телефоне и после чистки продолжал расти. Теперь при запуске сверяем список
  // с тайным зачётом: на сервере ключей меньше — подрезаем и перенумеровываем.
  React.useEffect(() => {
    if (!profile || !storageLoaded) return;
    rpc("quiz_key_rank", { p_token: saToken() }).then(r => {
      if (!r || !r.ok) return;
      const mine = Math.max(0, Number(r.mine) || 0);
      const key = "sa_loopholes" + loopUk;
      let recs = []; try { recs = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { return; }
      if (!Array.isArray(recs) || recs.length <= mine) return;
      const keep = recs.slice(recs.length - mine).map((x, i) => ({ ...x, n: i + 1 }));
      try { localStorage.setItem(key, JSON.stringify(keep)); } catch (e) {}
      if (!keep.length) { setLoophole(null); setLoopView(null); }
    }).catch(() => {});
  }, [profile, storageLoaded, loopUk]);
  useEffect(() => { if (profile && storageLoaded) { try { const r = loopUnseen(loopUk); if (r) { setLoophole(r); setLoopView("banner"); } } catch (e) {} } }, [profile, storageLoaded]);
  const [mistakeHint, setMistakeHint] = useState(false);
  useEffect(() => {
    if (!profile || !storageLoaded) return;
    // v3: тур большого обновления — разово покажется и давним пользователям
    try { if (localStorage.getItem("sa_welcome_seen_v11") !== "1") setWelcome(true); } catch (e) {}
  }, [profile, storageLoaded]);
  const closeWelcome = () => {
    try { localStorage.setItem("sa_welcome_seen_v11", "1"); } catch (e) {}
    vibrate("light");
    setWelcome(false);
  };

  // ══ v40: «Путь мастера» (lib/mastery.js) — значки за привычки (бронза, серебро, золото у каждого
  //    инструмента), «Мастер роли», «Шаг дня», «Первая неделя в академии». Всё считается на
  //    телефоне из того, что приложение уже хранит; сервер (этап 26) — только мастера заведения,
  //    приз руководителя и сообщение команде. Без этапа 26 всё, кроме этого, работает. ══
  // счётчики за всё время сверяются с журналом дня (он держит 75 дней) — один раз при входе.
  // Новый телефон (или очищенный Telegram): «Путь мастера» — из копии на сервере (этап 23: своя карточка
  // report_person), если она свежее сброса руководителем (my_reset_at) — стёртое сбросом не возвращаем
  // «чистый» ли телефон — запоминаем при первой проверке на человека: syncLife сразу пишет sa_life,
  // и повторный проход эффекта (или двойной в StrictMode) уже не отличил бы новый телефон
  const restoreRef = useRef({});
  React.useEffect(() => {
    if (!profile || !storageLoaded) return;
    if (restoreRef.current[ukP] === undefined) {
      let fresh = false;
      try { fresh = localStorage.getItem("sa_life" + ukP) == null && localStorage.getItem("sa_mastery" + ukP) == null; } catch (e) {}
      restoreRef.current[ukP] = fresh ? "fresh" : "no";
    }
    try { syncLife(ukP); } catch (e) {}
    if (restoreRef.current[ukP] !== "fresh" || !saToken()) return;
    restoreRef.current[ukP] = "asked";
    const u = ukP;
    Promise.all([rpc("report_person", { p_token: saToken(), p_emp: "" }), rpc("my_reset_at", { p_token: saToken() })]).then(([rp, rr]) => {
      if (!rp || !rp.ok || !rp.data) return;
      const d = rp.data, ms = d.learning && d.learning.mastery;
      const resetAt = rr && rr.ok && rr.reset_at ? Date.parse(rr.reset_at) || 0 : 0;
      const copyAt = d.learning_at ? Date.parse(d.learning_at) || 0 : 0;
      if (resetAt && (!copyAt || resetAt >= copyAt)) return;   // копия старше сброса — стёртое не возвращаем
      if (restoreFromCopy(u, ms)) setMasteryVer((v) => v + 1);
    }).catch(() => {});
  }, [profile, storageLoaded, ukP]);
  // свои результаты тестов: в scores — рейтинг всей команды
  const myScores = useMemo(() => (profile ? scores.filter((s) => s && s.name === profile.name && normSurname(s.surname || "") === normSurname(profile.surname || "")) : []), [scores, profile]);
  // факты считаются, когда прогресс с телефона прочитан и уроки роли приехали (иначе «0 из 0 разделов»)
  const mFacts = useMemo(() => {
    // ждём уроки самой роли: свои разделы ресторана приезжают из копии раньше — по ним одним шаг дня и
    // значки посчитались бы неверно (и запомнились бы на весь день)
    if (!profile || !storageLoaded || (role && !modules.length)) return null;
    // без трека (руководитель без роли) — значки инструментов и приз заведения всё равно доступны
    try { return masteryFacts({ uk: ukP, role, modules: role ? programModules : [], completed, quizDone, scores: myScores, profile, now: new Date() }); } catch (e) { return null; }
  }, [profile, storageLoaded, role, modules, programModules, completed, quizDone, myScores, ukP, activity, streak, marksVer, questVer, mistakeBank, schedTick, todayKey, masteryVer, screen]);   // eslint-disable-line react-hooks/exhaustive-deps
  const mState = useMemo(() => (mFacts ? masteryState(mFacts, role) : null), [mFacts, role]);
  const mSeen = useMemo(() => (profile ? readSeen(ukP) : {}), [profile, ukP, masteryVer]);   // eslint-disable-line react-hooks/exhaustive-deps
  // «новое» не зовёт туда, где делать нечего: освежать нечего — свежесть не «новая», раунд мастера
  // сыграть не по чему — золото тоже
  const goldReady = useMemo(() => programModules.some((m) => canGold(m) && moduleDone(m, completed, quizDone) && !(marks.gold || {})[m.id]), [programModules, completed, quizDone, marks]);
  const mSeenShown = useMemo(() => ({ ...mSeen, ...(fadedIds.size ? {} : { fresh: mSeen.fresh || "—" }), ...(goldReady ? {} : { gold: mSeen.gold || "—" }) }), [mSeen, fadedIds, goldReady]);
  const mNew = useMemo(() => (mState ? newTools(mState, mSeenShown) : new Set()), [mState, mSeenShown]);
  const mFam = (id) => (mState ? mState.families.find((f) => f.id === id) || null : null);
  const isNewFam = (id) => !!mState && isNewTool(mFam(id), mSeenShown);
  // Показ: значки не отнимаются — ступень не ниже отпразднованной (кроме «Трека»: он по своей роли),
  // «Мастер роли» — если уже был (новые уроки в роли или новый телефон его не снимают)
  const mEarned = useMemo(() => (profile ? readEarned(ukP) : null), [profile, ukP, masteryVer]);   // eslint-disable-line react-hooks/exhaustive-deps
  const mShown = useMemo(() => {
    if (!mState) return null;
    const e = mEarned || { tiers: {}, master: {} };
    const families = mState.families.map((f) => {
      const t = Math.min(3, (e.tiers && e.tiers[f.id]) || 0);
      if (f.id === "track" || t <= f.tier) return f;
      const next = t < f.tiers.length ? f.tiers[t] : null, from = f.tiers[t - 1] || 0;
      return { ...f, tier: t, tierName: TIERS[t], next, from, left: next == null ? null : Math.max(0, next - f.value),
        pct: next == null ? 1 : next > from ? Math.max(0, Math.min(1, (f.value - from) / (next - from))) : 0 };
    });
    const bronze = families.filter((f) => f.tier >= 1).length;
    const parts = mState.master.parts.map((p) => (p.id === "bronze" ? { ...p, value: Math.min(bronze, MASTER_NEED.bronze), done: bronze >= MASTER_NEED.bronze } : p));
    const have = parts.reduce((a, p) => a + (p.id === "bronze" ? p.value : p.done ? 1 : 0), 0);
    const ok = mState.master.ok || parts.every((p) => p.done) || !!(role && e.master && e.master[role]);
    return { ...mState, families, bronze, master: { ...mState.master, parts, have, ok } };
  }, [mState, mEarned, role]);
  // «Практика у стола» и «Живой диалог» из шага дня: в текущей теме (где следующий урок), иначе —
  // первая непройденная, иначе любая (диалога нет нигде — «Гость недели»)
  const lessonTarget = useCallback((type) => {
    const has = (l) => !!l && l.type === type && (type !== "practice" || (l.situations || []).length > 0);
    const nx = nextLessonOf(programModules, completed, quizDone);
    if (nx && nx.mod) { const l = (nx.mod.lessons || []).find(has); if (l) return { mod: nx.mod, lesson: l }; }
    for (const m of programModules) { const l = (m.lessons || []).find((x) => has(x) && !completed[x.id]); if (l) return { mod: m, lesson: l }; }
    for (const m of programModules) { const l = (m.lessons || []).find(has); if (l) return { mod: m, lesson: l }; }
    return null;
  }, [programModules, completed, quizDone]);
  // «Шаг дня»: выбирается при первом показе за день и до вечера не меняется (sa_step<uk>);
  // avail — куда сейчас можно позвать (разминать нечего — шаг дня в разминку не зовёт)
  const mStep = useMemo(() => {
    if (!mState || !mFacts || !role) return null;
    try {
      const faded = fadedList(marks.fresh, freshMods, completed, quizDone);
      const goldable = programModules.filter((m) => moduleDone(m, completed, quizDone) && canGold(m) && !(marks.gold || {})[m.id]);
      const due = mistakeBank.filter((m) => !m.due || m.due <= Date.now()).length;
      return stepOfDay({ state: mState, facts: mFacts, faded, goldable, next: nextLessonOf(programModules, completed, quizDone), uk: ukP, day: todayKey, role,
        avail: { warmup: warmSits.length >= 2, practice: !!lessonTarget("practice"), mistakes: due > 0 } });
    } catch (e) { return null; }
  }, [mState, mFacts, ukP, todayKey, role]);   // eslint-disable-line react-hooks/exhaustive-deps
  // в маленькой теме раунд мастера короче 8 заданий — подпись шага как на плитке темы
  const mStepShown = useMemo(() => {
    if (!mStep || mStep.done || mStep.kind !== "gold" || !mStep.payload || !mStep.payload.mod) return mStep;
    const m = programModules.find((x) => x.id === mStep.payload.mod);
    const n = m ? goldPool(m).length : 0;
    return n && n !== GOLD_N ? { ...mStep, sub: n + " " + pl3(n, "задание", "задания", "заданий") + " → тема золотая" } : mStep;
  }, [mStep, programModules]);   // eslint-disable-line react-hooks/exhaustive-deps
  // итог для копии на сервер (отчёт руководителя, «Шаг дня» в напоминании бота) — при изменении
  const mSumRef = useRef("");
  React.useEffect(() => {
    if (!mState || !profile) return;
    try {
      // в копию (и в напоминание бота) — шаг дня, пока он не сделан, одной строкой: «попробуй «Радио в дорогу»»
      const sig = JSON.stringify(saveSummary(ukP, mState, mStep && !mStep.done ? { ...mStep, text: stepLineText(mStep) } : null));
      if (sig !== mSumRef.current) { mSumRef.current = sig; scheduleLearningPush({ uk: ukP, profile }, 20000); }
    } catch (e) {}
  }, [mState, mStep, ukP, profile]);
  // Праздники: через 6 с после входа (сервер успевает прислать прогресс и тесты), по одному,
  // не поверх урока и слоёв. Первый запуск v40 — всё заработанное раньше запоминается молча.
  // готовность: прошло 6 с и пришёл список своих уроков (или прошло 20 с — без связи он не придёт)
  const [mT, setMT] = useState(0);
  React.useEffect(() => {
    setMT(0);
    if (!profile || !storageLoaded) return undefined;
    const a = setTimeout(() => setMT(1), 6000), b = setTimeout(() => setMT(2), 20000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [profile, storageLoaded, ukP]);
  const mReady = mT >= 2 || (mT >= 1 && customLoaded);
  const mPending = useMemo(() => {
    if (!mReady || !mState || !profile) return [];
    try {
      const earned = readEarned(ukP);
      const news = newlyEarned(mState, earned);
      // «Мастер роли» не прячем и при первом запуске: его празднуют всегда
      if (earned.first) { saveEarned(ukP, mergeEarned(earned, news.filter((n) => n.kind !== "master"), todayKey)); return news.filter((n) => n.kind === "master"); }
      return news;
    } catch (e) { return []; }
  }, [mReady, mState, profile, ukP, todayKey, masteryVer]);   // eslint-disable-line react-hooks/exhaustive-deps
  // только на спокойных экранах (вкладки, трек, рейтинг…), не посреди урока, теста, колоды или работы над ошибками
  const mToast = mPending.length && layers.length === 0 && !welcome && !newAchievement && !celebrate && !loopView && !lessonLockMsg
    && ["roleSelect", "home", "module", "shift", "teamHub", "me", "stats", "leaderboard", "league", "cellar", "guestbook", "guide"].includes(screen) ? mPending[0] : null;
  const ackBadge = useCallback((it) => {
    try { saveEarned(ukP, mergeEarned(readEarned(ukP), [it], todayKey)); } catch (e) {}
    setMasteryVer((v) => v + 1);
  }, [ukP, todayKey]);
  // Мастера заведения (этап 26: mastery_list) — для экрана, рейтинга, лиги и баннера в «Команде»
  const [masters, setMasters] = useState(null);
  const m26Ref = useRef({ list: false, claim: false, busy: false });   // этапа 26 нет — не спрашиваем снова до перезапуска
  const loadMasters = useCallback(() => {
    if (!profile) return;
    if (m26Ref.current.list) { setMasters({ status: "missing", rows: [] }); return; }
    const ck = "sa_masters_cache" + ukP;
    setMasters((m) => {
      if (m && m.status === "ok") return m;
      try { const c = JSON.parse(localStorage.getItem(ck) || "null"); if (c && Array.isArray(c.rows)) return { status: "ok", rows: c.rows, prize: c.prize || null, can_prize: !!c.can_prize, cached: true }; } catch (e) {}
      return { status: "loading", rows: [] };
    });
    rpc("mastery_list", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) { m26Ref.current.list = true; setMasters({ status: "missing", rows: [] }); return; }
      if (r && r.ok) {
        const v = { status: "ok", rows: Array.isArray(r.rows) ? r.rows : [], prize: r.prize || null, can_prize: !!r.can_prize };
        setMasters(v);
        try { localStorage.setItem(ck, JSON.stringify({ rows: v.rows.slice(0, 60), prize: v.prize, can_prize: v.can_prize })); } catch (e) {}
      } else setMasters((m) => (m && m.status === "ok" ? m : { status: "error", rows: [] }));
    }).catch(() => setMasters((m) => (m && m.status === "ok" ? m : { status: "offline", rows: [] })));
  }, [profile, ukP]);
  React.useEffect(() => {
    if (profile && storageLoaded && ["mastery", "teamHub", "leaderboard", "league"].includes(screen)) loadMasters();
  }, [screen, profile, storageLoaded]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { setMasters(null); }, [ukP]);
  const mastersIdx = useMemo(() => (masters && masters.status === "ok" ? mastersIndex(masters.rows) : null), [masters]);
  // ── v57 (Доп. 370): «Жизнь команды» на вкладке «Команда» (lib/team-feed.js): рекорды и печати — team_achievements
  // (подгружаются на вкладке, копия на телефоне — лента видна сразу), тесты — team_scores, мастера — mastery_list,
  // «спасибо команде» — квест дня из day_brief. Новых функций на сервере нет.
  const [teamAch, setTeamAch] = useState([]);
  React.useEffect(() => {
    if (!ukP) { setTeamAch([]); return; }
    try { const v = JSON.parse(localStorage.getItem("sa_team_ach" + ukP) || "null"); setTeamAch(Array.isArray(v) ? v : []); } catch (e) { setTeamAch([]); }
  }, [ukP]);
  React.useEffect(() => {
    if (screen !== "teamHub" || !profile || !storageLoaded) return undefined;
    let alive = true;
    rpc("team_achievements", { p_token: saToken() }).then((res) => {
      if (!alive || !res || !res.ok || !Array.isArray(res.rows)) return;
      setTeamAch(res.rows);
      try { localStorage.setItem("sa_team_ach" + ukP, JSON.stringify(res.rows.slice(0, 200))); } catch (e) {}
    }).catch(() => {});
    return () => { alive = false; };
  }, [screen, profile, storageLoaded, ukP]);
  const feedTitleOf = useMemo(() => quizTitles(MODULES_INDEX, customModules), [customModules]);
  const teamFeed = useMemo(() => (screen === "teamHub" && profile ? buildFeed({ now: Date.now(), me: profile, restaurant: profile.restaurant,
    masters: masters && masters.status === "ok" ? masters.rows : [], scores, achievements: teamAch,
    thanks: brief && brief.quest && Array.isArray(brief.quest.thanks) ? brief.quest.thanks : [], titleOf: feedTitleOf }) : []),
    [screen, profile, masters, scores, teamAch, brief, feedTitleOf]);
  const setMasterPrize = useCallback((text) => rpc("mastery_prize_set", { p_token: saToken(), p_text: String(text || "") }).then((r) => {
    if (rpcMissing(r)) return { ok: false, error: "missing" };
    if (r && r.ok) {
      setMasters((m) => (m ? { ...m, prize: r.prize || null } : m));
      try { const ck = "sa_masters_cache" + ukP; const c = JSON.parse(localStorage.getItem(ck) || "null"); if (c && typeof c === "object") localStorage.setItem(ck, JSON.stringify({ ...c, prize: r.prize || null })); } catch (e) {}
      return { ok: true, prize: r.prize || null };
    }
    return { ok: false, error: (r && r.error) || "error" };
  }).catch(() => ({ ok: false, error: "offline" })), [ukP]);
  // «Мастер роли» — сообщаем серверу один раз на роль (коллегам уходит сообщение в Telegram).
  // Нет сети или этапа 26 — попробуем при следующем входе.
  React.useEffect(() => {
    if (!mReady || !mState || !profile || !role) return;
    let earnedM = {};
    try { earnedM = readEarned(ukP).master || {}; } catch (e) { earnedM = {}; }
    if (!mState.master.ok && !earnedM[role]) return;
    const key = "sa_master_claim" + ukP;
    let sent = {};
    try { sent = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { sent = {}; }
    if (sent[role] || m26Ref.current.claim || m26Ref.current.busy) return;
    const need = mState.master.need || 13;
    m26Ref.current.busy = true;
    rpc("mastery_claim", { p_token: saToken(), p_role: role, p_have: Math.max(need, mState.master.have | 0), p_need: need }).then((r) => {
      m26Ref.current.busy = false;
      if (rpcMissing(r)) { m26Ref.current.claim = true; return; }
      if (!r || !r.ok) return;
      try { localStorage.setItem(key, JSON.stringify({ ...sent, [role]: ymd(new Date()) })); } catch (e) {}
      if (r.new) loadMasters();
    }).catch(() => { m26Ref.current.busy = false; });
  }, [mReady, mState && mState.master.ok, role, profile, ukP]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Открыть «Путь мастера»: focus — значок (id семейства) или "certificate"
  const [masteryFocus, setMasteryFocus] = useState(null);
  const openMastery = useCallback((focus) => {
    setMasteryFocus(focus || null);
    try { markSeen(ukP, "mastery"); } catch (e) {}
    setMasteryVer((v) => v + 1);
    navigate("mastery");
  }, [ukP, navigate]);
  // Переходы «Пути мастера» (шаг дня, «Показать ›», первая неделя) — ключи из lib/mastery.js
  const runMasteryGo = useCallback((go, payload) => {
    const p = payload || {};
    const modBy = (id) => programModules.find((m) => m.id === id) || null;
    const seen = (id) => { try { markSeen(ukP, id); } catch (e) {} setMasteryVer((v) => v + 1); };
    const openTarget = (t) => { setActiveModule(t.mod); openLesson(t.lesson); };
    const home = () => navigate(role ? "home" : "roleSelect");   // без трека — выбор роли (трек без роли не открыть)
    setMasteryFocus(null);   // вернёмся назад на «Путь мастера» — без повторно открытого листа
    switch (go) {
      case "refresh": { const m = p.mod ? modBy(p.mod) : null; if (m && canRefresh(m)) { openTopicRun("refresh", m); seen("fresh"); } else if (fadedIds.size) { openFreshAll(); seen("fresh"); } else navigate("cellar"); return; }
      case "gold": { const m = p.mod ? modBy(p.mod) : null; if (m && canGold(m) && moduleDone(m, completed, quizDone)) { openTopicRun("gold", m); seen("gold"); } else navigate("cellar"); return; }
      case "warmup": if (warmSits.length >= 2) { openWarmup(); seen("warmup"); } else home(); return;
      case "radio": openRadio(); seen("radio"); return;
      case "guest": openGuest(); seen("guest"); return;
      case "mistakes": navigate("mistakes"); seen("fixes"); return;
      case "menu": navigate("menuTrainer"); seen("decks"); return;
      case "quest": navigate("shift"); seen("quest"); return;
      case "mentor": navigate("mentor"); seen("hall"); return;
      case "practice": { const t = lessonTarget("practice"); if (t) { openTarget(t); seen("table"); } else home(); return; }
      case "dialogue": { const t = lessonTarget("dialogue"); if (t) openTarget(t); else navigate("weeklyGuest"); seen("dialogue"); return; }
      case "mastery": openMastery(); return;
      default: {
        // «track»: следующий урок из шага дня — сразу он (тест, уже сданный, не открываем)
        const m = p.mod ? modBy(p.mod) : null;
        const l = m && p.lesson ? (m.lessons || []).find((x) => x.id === p.lesson) : null;
        if (m && l && !(l.type === "quiz" && quizDone[l.id])) { openTarget({ mod: m, lesson: l }); return; }
        home();
      }
    }
  }, [programModules, ukP, role, completed, quizDone, fadedIds, warmSits.length, lessonTarget, openTopicRun, openFreshAll, openWarmup, openRadio, openGuest, openMastery, navigate]);   // eslint-disable-line react-hooks/exhaustive-deps
  // «новое» гаснет, как только инструмент открыли — откуда угодно, не только из «Пути мастера»
  React.useEffect(() => {
    if (!profile) return;
    const ids = [];
    if (radioList) ids.push("radio");
    if (guestOpen) ids.push("guest");
    if (warmupOpen) ids.push("warmup");
    if (special && (special.mode === "refresh" || special.mode === "freshall")) ids.push("fresh");
    if (special && special.mode === "gold") ids.push("gold");
    const bySc = { menuTrainer: "decks", cocktails: "decks", barLab: "decks", mistakes: "fixes", mentor: "hall", weeklyGuest: "dialogue", shift: "quest", cellar: "cellar" }[screen];
    if (bySc) ids.push(bySc);
    if (screen === "lesson" && activeLesson && activeLesson.type === "dialogue") ids.push("dialogue");
    if (screen === "lesson" && activeLesson && activeLesson.type === "practice") ids.push("table");
    const fresh = ids.filter((id) => !mSeen[id]);
    if (!fresh.length) return;
    try { fresh.forEach((id) => markSeen(ukP, id)); } catch (e) {}
    setMasteryVer((v) => v + 1);
  }, [screen, radioList, guestOpen, warmupOpen, special, activeLesson, profile, ukP]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Контекстная подсказка: появляется в момент, когда впервые есть что повторить
  // «Дальше» под меню раздела и конец программы (Доп. 196–197) — вынесено из экрана раздела без
  // изменений: тем же пользуется листаемый трек (Доп. 307)
  const inPages = (m) => !!m && programModules.some((x) => x.id === m.id);
  const moduleNextFor = (m) => {
    // «Дальше» внизу своего раздела — сначала непройденный шаг этого раздела (правка 163);
    // раньше вела по штатной программе даже внутри незаконченного своего раздела
    if (m && m.custom) {
      const l = (m.lessons || []).find(x => x.type !== "result" && !(x.type === "quiz" ? quizDone[x.id] : completed[x.id]));
      if (l) return { mod: m, lesson: l };
    }
    return nextLessonOf(programModules, completed, quizDone);   // штатная пройдена — дальше свои разделы
  };
  const moduleOnNext = (n) => { if (!n) return; if (n.mod && n.mod.id !== activeModule?.id) setActiveModule(n.mod); openLesson(n.lesson); };
  const moduleFinishFor = () => {
    // Доп. 197: конец роли — экзамен ступени → сертификат → следующая ступень трека → другие треки
    const passed = !!(examResults[role] && examResults[role].passed);
    const group = TRACK_GROUPS.find(g => g.members.includes(role));
    const nextRoleId = group ? group.members[group.members.indexOf(role) + 1] : null;
    const nextRole = nextRoleId ? ROLES.find(r => r.id === nextRoleId) : null;
    if (!passed) return { eyebrow: "Все уроки пройдены", title: "Экзамен ступени", sub: "10 вопросов из тестов роли, для сдачи нужно 80%. За сданный экзамен получишь сертификат и печать в Книге.", cta: "Сдать ›", onGo: () => openExam(role) };
    if (nextRole) return { eyebrow: "Экзамен сдан", title: `Следующая ступень: ${nextRole.label}`, sub: nextRole.desc || nextRole.sublabel || "Трек продолжается, новые модули уже ждут", cta: "Перейти ›", onGo: () => { selectRole(nextRole.id); commitStack([]); }, // selectRole сам открывает программу новой роли
      secondary: CERTIFICATES_ENABLED ? { label: "Открыть сертификат", onGo: () => openCertificate(role) } : null };
    return { eyebrow: "Экзамен сдан", title: "Трек пройден до конца", sub: "Можно открыть новый трек или держать форму: «Задание дня» и «Гость недели» во вкладке «Смена».", cta: "Другие треки ›", onGo: () => navigate("roleSelect"),
      secondary: CERTIFICATES_ENABLED ? { label: "Открыть сертификат", onGo: () => openCertificate(role) } : null };
  };
  // Что Наставник знает о сотруднике (роль, прогресс, ошибки, смена) — вынесено из экрана
  // «Наставник» без изменений: тот же контекст нужен чату поверх ситуации (Доп. 302)
  const assistantLearner = () => ({ position: profile?.position, roleTitle: (ROLES.find(r => r.id === role) || {}).title,
    customLessons: (customModules || []).flatMap(m => m.lessons.filter(l => l.type === "lesson").map(l => ({ id: l.id, title: l.title, section: m.title }))),
    done: doneCount, total: totalLessons, dueMistakes,
    // Доп. 310: ритм дня — Наставник знает про свечу, стакан и разминку
    streak: (streak && streak.count) || 0, steps: todaySteps || 0, goal: goal || 0,
    warmup: warmShow ? (warmDone === todayKey ? "done" : "open") : "",
    topics: mistakeBank.filter(m => !m.due || m.due <= Date.now()).slice(0, 3).map(m => m.lessonTitle).filter(Boolean),
    // v40: «Путь мастера» — Наставник знает значки, шаг дня и первую неделю, ведёт кнопкой [[go:mastery]]
    mastery: mShown ? { bronze: mShown.bronze, total: mShown.total, have: mShown.master.have, need: mShown.master.need, master: !!mShown.master.ok,
      step: mStep && !mStep.done ? mStep.text : "", fw: { done: mShown.firstWeek.done, total: mShown.firstWeek.total, active: !!mShown.firstWeek.active } } : null,
    todayShift: (() => { try {
      const r = JSON.parse(localStorage.getItem("sa_today_shift") || "null");
      const t = new Date();
      const key = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
      return (r && r.date === key && r.label) ? r.label : null;
    } catch (e) { return null; } })() });
  // Переходы из ответа Наставника (карточки блюд и коктейлей, уроки, разделы). Вынесено из
  // экрана «Наставник» без изменений, чтобы тем же путём ходил и чат поверх ситуации
  // «Разобрать с Наставником» (Доп. 302): там текущий экран просто уходит в историю.
  const assistantNavigate = (dest, overlay = false) => {
    const jump = (to) => {
      if (overlay) { navigate(to); return; }
      setPrevScreen(prevScreen && prevScreen !== "assistant" ? prevScreen : "roleSelect"); setScreen(to);
    };
    // Карточка блюда в ответе → Колода меню на этом блюде (Доп. 170)
    if (dest && typeof dest === "object" && dest.dish) {
      setMenuStart(dest.dish);
      jump("menuTrainer");
      return;
    }
    // Карточка коктейля в ответе → колода на этом коктейле (Доп. 130)
    if (dest && typeof dest === "object" && dest.cocktail) {
      setCkStart(dest.cocktail);
      jump("cocktails");
      return;
    }
    // Переход на урок по id: [[lesson:ID]]
    if (dest && typeof dest === "object" && dest.lesson) {
      // Роли, доступные сотруднику: его текущая + все пройденные.
      // Вариант В: урок закрытой роли не открываем, мягко сообщаем.
      const myRoles = new Set([role, ...completedRoles]);
      // спг/сезонник — базовый уровень, всегда доступен как основа
      const roleOfLesson = (lid) => roleOfLessonId(lid); // Доп. 132: по индексу, без ожидания загрузки
      const lessonRole = roleOfLesson(dest.lesson);
      const inCustom = (customModules || []).some(m => (m.lessons || []).some(x => x.id === dest.lesson));
      // FAIL-SAFE: блокируем ТОЛЬКО когда роль урока определена ОДНОЗНАЧНО и она
      // среди закрытых. Любая неясность (роль не найдена, урок в custom, я админ) →
      // урок ОТКРЫВАЕТСЯ. Лучше пропустить, чем случайно заблокировать доступное.
      const iamAdmin = !!profile?.is_admin;
      const knownRole = lessonRole && ["seasonal","core","manager","service_manager","spg","bar"].includes(lessonRole);
      const blocked = !iamAdmin && knownRole && !myRoles.has(lessonRole) && !inCustom;

      if (blocked) {
        setLessonLockMsg("Этот урок из трека, который откроется позже, когда дойдёшь до него по программе. Спрашивай меня по теме сколько угодно, а по порядку изучишь его на своём уровне.");
        return;
      }

      (lessonRole ? loadRoleModules(lessonRole).catch(() => {}) : Promise.resolve()).then(() => {
        const everyMod = [...Object.values(MODULES).flat(), ...(customModules || [])];
        let foundMod = null, foundLesson = null;
        for (const m of everyMod) {
          const l = (m.lessons || []).find(x => x.id === dest.lesson);
          if (l) { foundMod = m; foundLesson = l; break; }
        }
        if (foundLesson) {
          if (!overlay) setPrevScreen("roleSelect");
          setActiveModule(foundMod); openLesson(foundLesson);
        } else {
          jump("roleSelect");
        }
      });
      return;
    }
    // Переход в раздел: [[go:key]]
    // Ключ кнопки ассистента → экран (правка 153: ключи в нижнем регистре, новые
    // разделы, stats = «Мой прогресс», analytics = «Аналитика»)
    const GO = { sos: "sos", glossary: "glossary", leaderboard: "leaderboard", profile: "profile", daily: "daily",
      checklist: "checklist", reference: "reference", stats: "stats", guestbook: "guestbook", mentor: "mentor",
      menu: "menuTrainer", cocktails: "cocktails", barlab: "barLab", schedule: "schedule", mistakes: "mistakes",
      certificates: "certificates", guide: "guide", onboarding: "onboarding", weeklyguest: "weeklyGuest",
      shift: "shift", team: "teamHub", me: "me", analytics: "analytics", candidate: "candidate", staff: "team" };
    const boss = !!(profile?.is_admin || ["manager", "senior"].includes(profile?.position));
    const k = String(dest || "").toLowerCase();
    // Доп. 310: разделы v28–v29 — разминка, чек недели и напоминания открываются поверх экрана,
    // отчёты — экраном (сотруднику — только свой)
    if (k === "warmup") { if (warmSits.length >= 2) openWarmup(); else jump("home"); return; }
    if (k === "week") { openWeek("last7"); return; }
    if (k === "remind") { setRemindOpen(true); return; }
    if (k === "track") { jump("home"); return; }
    if (k === "guest") { openGuest(); return; }   // v30
    if (k === "league") { jump("league"); return; }
    if (k === "pair") { setPairOpen(true); return; }
    if (k === "quest") { jump("shift"); return; }
    if (k === "radio") { openRadio(); return; }
    if (k === "month") { openRecap(); return; }
    // v31: «Погреб тем», «Освежить всё выдохшееся», «Проверка по треку»
    if (k === "cellar") { jump("cellar"); return; }
    if (k === "freshall") { if (fadedIds.size) openFreshAll(); else jump("cellar"); return; }
    if (k === "probe") { if (probeMods.length >= 2) { jump("cellar"); openProbe(); } else jump("cellar"); return; }
    // v40: «Путь мастера»
    if (k === "mastery") { if (!mState) { jump("me"); return; } setMasteryFocus(null); try { markSeen(ukP, "mastery"); } catch (e) {} setMasteryVer((v) => v + 1); jump("mastery"); return; }
    if (k === "report" || k === "myreport") {
      if (k === "report" && !boss) return;
      setReportSelf(k === "myreport"); jump("report"); return;
    }
    if (!GO[k]) return;
    if ((k === "analytics" || k === "candidate") && !boss) return;   // разделы руководителей
    if (k === "staff" && !profile?.is_admin) return;
    jump(GO[k]);
  };
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
    // Доп. 280: диалоги (полмегабайта) нужны только на практике — не держим их на старте
    Promise.all([role ? loadRoleModules(role) : Promise.resolve()]).then(() => bumpLazyData(x => x + 1));
    // 2) Затем тихо прогреваем ленивые экраны: пока человек смотрит на главную,
    //    их код доезжает фоном — и первое открытие любого раздела мгновенно,
    //    скелетон остаётся только для очень медленной сети в первые секунды.
    // Доп. 280: на бережной или медленной сети фоновый прогрев не делаем вовсе —
    // экраны доедут по требованию, зато трафик человека остаётся при нём.
    // v79 (Доп. 392): прогрев начинается, когда главная уже на экране (карточка «Дальше» с названием урока; нет её —
    // не позже 12 с), через 1,5 с и в свободную минуту браузера. Раньше — через 1,5 с после запуска, и на медленной
    // сети прогрев отнимал канал у самой главной. Профиль — с телефона (эффект запуска видит его ещё пустым):
    // открытые роли и собеседование (только руководителям) — по нему. Экраны, которые v79 убрала со старта
    // (рейтинг, статистика, «Команда», экзамен, чек-листы, живой диалог), тоже прогреваются — для работы без сети.
    let warm = null, alive = true;
    const startWarm = () => {
      if (!alive) return;
      const pf = storedProfile();
      const boss = !!(pf && (pf.is_admin || ["manager", "senior"].includes(pf.position)));
      [
        () => loadDialogues().then(() => bumpLazyData(x => x + 1)),
        () => loadOpenModules(pf), // Доп. 280: сначала — роли, открытые этому человеку
        // v79 (Доп. 392): затем остальные. Книга отзывов, её плитка («N/всего», звание), статистика и карточка сотрудника
        // считают по программе всех ролей; до v79 её на каждом старте подтягивала уборка банка ошибок — вместе с главной.
        // Теперь — после главной; на бережной сети прогрева нет, такие экраны догружают роли сами (lib/use-content.js)
        () => loadAllModules(),
        () => loadDialogueScreen(),
        () => loadGamification(),
        () => loadAdminScreens(),
        () => loadTeamScreens(),
        () => loadExamScreens(),
        () => import("./ui/menu-trainer"),
        () => import("./ui/guestbook"),
        () => import("./ui/ReferenceSection"),
        () => import("./ui/search"),
        () => import("./ui/sos"),
        () => import("./ui/mentor"),
        () => import("./ui/training-card"),
        boss && (() => import("./ui/candidate")),
        () => import("./ui/assistant"),
        () => import("./ui/mm-images"),   // картинки-эмоции уроков — для работы без сети
        () => import("./ui/table"),       // Доп. 289: формат «у стола» — практика и проверка после урока
      ].filter(Boolean).reduce((p, load) => p.then(() => (alive ? load().catch(() => {}) : null)), Promise.resolve());
    };
    const t0 = Date.now();
    const waitHome = () => {
      if (!alive) return;
      const shown = !document.getElementById("sa-splash") && !!document.querySelector("[data-now-title]");
      if (!shown && Date.now() - t0 < 12000) { warm = setTimeout(waitHome, 400); return; }
      warm = setTimeout(() => { const ric = typeof window !== "undefined" && window.requestIdleCallback; if (ric) ric(startWarm, { timeout: 2000 }); else startWarm(); }, 1500);
    };
    if (!thriftyNet()) warm = setTimeout(waitHome, 400);
    return () => { alive = false; if (warm) clearTimeout(warm); };
  }, []);

  // v55 (Доп. 368): экраны «твёрдые» — не листаются, если всё помещается.
  // Высота верхней строки «SA · Для чтения» → --sa-top: экран вычитает её из своей минимальной высоты
  // (ui/styles.js, screen). Кнопка AI на экране → класс sa-fabon: снизу запас под кнопку (владелец: «Кнопка AI
  // пусть останется как есть, просто сделай отступ») — последние карточки поднимаются выше неё.
  const saBarRef = useRef(null);
  const barOn = storageLoaded && !["profile", "login"].includes(screen);
  // v64 (Доп. 377): кнопка Наставника переехала в нижнее меню — круг посередине, между «Сменой» и «Командой»
  // (ui/tabbar.jsx: onAi). Владелец: «AI как-то не вписывается в новый дизайн… может в навбар?» — выбрали по кадрам
  // из трёх мест. Плавающая кнопка (AiFab) больше не нужна там, где есть меню: она закрывала содержимое (v62: «AI
  // закрывает бар»). На компьютере и лёжа Наставник, как и раньше, — в меню слева (NavRail).
  const fabOn = false;
  const tabsOn = navOn && !vp.wide;   // внизу панель вкладок (в портрете): обёртке экрана нужен отступ под неё
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const el = saBarRef.current;
    // v71: строка в position: fixed места у экрана не занимает (v72: в полноэкранном Telegram она снова в потоке, под его кнопками)
    const set = () => { let h = 0; try { h = el && getComputedStyle(el).position !== "fixed" ? Math.round(el.getBoundingClientRect().height) : 0; } catch (e) {} root.style.setProperty("--sa-top", h + "px"); };
    set();
    let ro = null;
    try { if (el && typeof ResizeObserver === "function") { ro = new ResizeObserver(set); ro.observe(el); } } catch (e) {}
    return () => { if (ro) ro.disconnect(); };
  }, [barOn, a11y]);
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("sa-fabon", fabOn);
    root.classList.toggle("sa-navon", tabsOn);
    return () => { root.classList.remove("sa-fabon"); root.classList.remove("sa-navon"); };
  }, [fabOn, tabsOn]);

  if (!storageLoaded) return (
    <div style={{ ...T.app, alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:18 }}>
        <img src={LOGO_SRC_DARK} alt="" decoding="sync" style={{ width:150, animation:'logoPulse 1.6s ease-in-out infinite', filter:"brightness(0) saturate(100%) invert(95%) sepia(10%) saturate(400%) hue-rotate(340deg) brightness(98%)" }} />
        <div style={{ ...labelStyle(13.5), color:'#9A8C74' }}>Загрузка…</div>
      </div>
    </div>
  );

  return (
    <div style={T.app}>
      {/* 🏆 Achievement popup */}
      {newAchievement && (
        <Suspense fallback={null}><AchievementPopup ach={newAchievement} a11y={a11y} onClose={() => setNewAchievement(null)} /></Suspense>
      )}
      {/* v40: новый значок «Пути мастера» или «Мастер роли» — по одному, не поверх урока и слоёв */}
      {mToast ? <BadgeToast a11y={a11y} item={mToast} state={mState}
        onOpen={(it) => { ackBadge(it); openMastery(it && it.kind === "master" ? "certificate" : it && it.kind === "tier" ? it.id : null); }}
        onClose={(it) => ackBadge(it)} /> : null}

      <div style={T.phone} className="sa-col">
        {!["profile","login"].includes(screen) && (
          <div style={T.a11yBar} ref={saBarRef} data-sa-topbar="">
            {/* v73 (Доп. 386): «SA» — шрифтом с засечками, без звёздочки ✦ и моноширинного */}
            <span style={{ ...T.a11yLabel, color: a11y ? "#765E2F" : GOLD_LOGO, fontSize:14, letterSpacing:2.5, fontFamily:"Georgia, serif" }}>SA</span>
            <span style={{ flex: 1 }} data-sa-topspace="" />
            {/* v71: поиск с любого экрана — меню и аллергены, карта бара, глоссарий, справочник, уроки */}
            {/* в тесте, на экзамене и в собеседовании кандидата поиска нет: он стал бы подсказкой (и обходом учёта «лазеек») */}
            {profile && !["search", "exam", "certificate", "candidate"].includes(screen) && !(screen === "lesson" && activeLesson && activeLesson.type === "quiz") ? (
              <button className="sa-btn sa-hit" data-top-search aria-label="Поиск: блюдо, аллерген, коктейль, термин" onClick={() => { vibrate("light"); navigate("search"); }}
                style={{ width: 28, height: 26, marginRight: 10, borderRadius: 11, border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
                  background: a11y ? "rgba(139,106,48,0.12)" : "rgba(200,169,110,0.10)",
                  boxShadow: a11y ? "inset 0 0 0 1px rgba(139,106,48,0.5), inset 0 1px 0 rgba(255,255,255,0.8)" : "inset 0 0 0 1px rgba(214,178,102,0.40), inset 0 1px 0 rgba(255,255,255,0.16)" }}>
                {GAME_SVG.search(a11y ? "#6B4E1A" : "#D2A85A", 13)}
              </button>
            ) : null}
            <button style={{ ...T.a11yBtn,
              // Капелька-канон (рецепт AI-кнопки): золото вместо светофора
              background: a11y ? "rgba(139,106,48,0.12)" : "rgba(200,169,110,0.10)",
              color: a11y ? "#6B4E1A" : "#D2A85A",
              boxShadow: a11y
                ? "inset 0 0 0 1px rgba(139,106,48,0.5), inset 0 0 14px rgba(255,255,255,0.4), inset 0 1px 0 rgba(255,255,255,0.8)"
                : "inset 0 0 0 1px rgba(214,178,102,0.40), inset 0 0 14px rgba(255,230,170,0.10), inset 0 1px 0 rgba(255,255,255,0.16)" }}
              onClick={() => setA11y(!a11y)} aria-label={a11y ? "Тёмная тема" : "Для чтения: светлая тема и крупный текст"}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}>{a11y ? UI_SVG.moon("currentColor", 12) : UI_SVG.eye("currentColor", 12)}<span className="sa-topbar-lbl">{a11y ? "Тёмная" : "Для чтения"}</span></span>
            </button>
          </div>
        )}

        {/* Ключ по экрану: каждый переход мягко въезжает (см. .sa-pagein в css.js) */}
        {/* Ключ включает тему: переключение «Тёмная/Для чтения» перерисовывает
            экран начисто — лечит iOS-призраки старого рендера под стеклом.
            Исключение — «Собеседование»: там живёт прогресс интервью,
            перемонтаж его уничтожил бы (тема переключается без пересборки) */}
        {/* Доп. 301: разминка до смены — слой «у стола» поверх вкладки */}
        {warmupOpen && tbMod && warmSits.length ? (
          <tbMod.TableCheck mode="warmup" situations={warmSits} modules={programModules} shift={shiftText}
            color={TRACK_COLOR[role] || "#C8A96E"} a11y={a11y} profile={profile} streak={streak} mistakeBank={mistakeBank}
            mentorName={mentorName} goal={{ steps: todaySteps, goal }} onFinish={finishWarmup} onActivity={logActivity}
            onMistakes={addMistakes} onResolveMistake={resolveMistake} onFailMistake={failMistake} onAskMentor={askMentor}
            onClose={() => setWarmupOpen(false)} />
        ) : null}
        {/* v30: освежить тему, зачёт на опыт, раунд мастера — тот же стол поверх трека */}
        {special && tbMod ? (
          <tbMod.TableCheck key={special.key} mode={special.mode} mod={special.mod} situations={special.sits} modules={programModules} timer={special.timer || 0}
            intro={special.intro || null} record={special.record || null} extra={special.extra || null} onBegin={special.onBegin || null}
            color={TRACK_COLOR[role] || "#C8A96E"} a11y={a11y} profile={profile} streak={streak} mistakeBank={mistakeBank} mentorName={mentorName}
            goal={{ steps: todaySteps, goal }} verdict={special.verdict} onFinish={finishSpecial} onActivity={logActivity}
            onMistakes={addMistakes} onResolveMistake={resolveMistake} onFailMistake={failMistake} onAskMentor={askMentor}
            onAgain={special.mode === "credit" || special.mode === "probe" || special.mode === "cases" ? null : special.mode === "freshall" ? openFreshAll : () => openTopicRun(special.mode, special.mod)}
            onClose={() => setSpecial(null)} />
        ) : null}
        {/* v30 (Доп. 319): «Радио в дорогу» */}
        {radioList && profile ? (
          <Suspense fallback={null}><RadioScreen a11y={a11y} uk={ukP} color={TRACK_COLOR[role] || "#C8A96E"} episodes={radioList}
            onMistakes={addMistakes} onActivity={logActivity} onTouch={touchStreak} onClose={() => setRadioList(null)} /></Suspense>
        ) : null}
        {/* v30 (Доп. 320): «Итоги месяца» */}
        {recapKey && profile ? (
          <Suspense fallback={null}><MonthRecap a11y={a11y} profile={profile} month={recapKey} shareUrl={APP_SHARE_URL}
            data={{ act: activity, streak, quests: questDays(ukP), guests: readGuestRuns(ukP), gold: marks.gold, credits: marks.credit, fresh: marks.fresh }}
            onClose={() => setRecapKey(null)} /></Suspense>
        ) : null}
        {/* v30 (Доп. 318): «Свеча на двоих» */}
        {pairOpen && profile ? (
          <Suspense fallback={null}><PairSheet a11y={a11y} profile={profile} onChange={setPairInfo} onClose={() => { setPairOpen(false); refreshPair(true); }}
            onGo={(d) => { setPairOpen(false); if (d === "warmup" && warmSits.length >= 2) openWarmup(); else navigate("home"); }} /></Suspense>
        ) : null}
        {/* v30 (Доп. 312): «Живой гость» */}
        {guestOpen && profile ? (
          <Suspense fallback={null}><LiveGuestScreen a11y={a11y} profile={profile} role={role} uk={ukP} color={TRACK_COLOR[role] || "#C8A96E"}
            track={programModules} modules={[...programModules, ...Object.values(MODULES).flat()]} mistakeBank={mistakeBank}
            onMistakes={addMistakes} onActivity={logActivity} onTouch={touchStreak}
            onOpenLesson={(id) => { setGuestOpen(false); assistantNavigate({ lesson: id }, true); }}
            onClose={() => setGuestOpen(false)} /></Suspense>
        ) : null}
        {/* Доп. 305: чек недели */}
        {weekOpen && tbMod && tbMod.WeekReceipt ? (
          <tbMod.WeekReceipt a11y={a11y} profile={profile} streak={streak} goal={goal} shareUrl={APP_SHARE_URL} quests={questDays(ukP)}
            summary={weekOpen === "prev" ? prevWeek : weekSummary(activity, streak)} prev={weekOpen === "prev"}
            onClose={() => setWeekOpen(null)} />
        ) : null}
        {/* v82: брифинг смены, который отправил руководитель */}
        {briefView && teamBrief ? <Suspense fallback={null}><BriefView a11y={a11y} brief={teamBrief} onClose={() => setBriefView(null)} /></Suspense> : null}
        {/* Доп. 304: напоминания в Telegram */}
        {remindOpen ? <RemindSheet a11y={a11y} uk={ukP} lead={isLead} admin={!!profile?.is_admin} shift={shiftText} step={mStep && !mStep.done ? stepLineText(mStep) : ""} onChange={setTgRemind} onClose={() => setRemindOpen(false)} /> : null}
        {/* Доп. 302: «Разобрать с Наставником» — чат поверх ситуации (выше слоёв «у стола») */}
        {mentorAsk != null ? (
          <Suspense fallback={null}><AssistantScreen T={T} a11y={a11y} profile={profile} learner={assistantLearner()}
            initialAsk={mentorAsk} z={1100} onBack={() => setMentorAsk(null)}
            onNavigate={(dest) => {
              // v30 (ревью): переход из ответа Наставника закрывает и новые слои — иначе урок
              // открывался бы под столом «Освежить»/«Раунда мастера», живым гостем или радио
              setMentorAsk(null); setWarmupOpen(false); setWeekOpen(null);
              setSpecial(null); setGuestOpen(false); setRadioList(null); setRecapKey(null); setPairOpen(false);
              assistantNavigate(dest, true);
            }} /></Suspense>
        ) : null}
        {/* Доп. 288: вспышка — порталом в body, поверх слоёв урока «у стола» (z-index 1000) */}
        {celebrate ? createPortal(
          <div className="sa-celeb">
            <div className="c-core">
              {[[-96,-74],[92,-80],[-120,18],[118,26],[-58,-108],[64,96],[0,-118],[-10,104]].map(([dx, dy], i) => (
                <span key={i} className={"c-spark k" + (i % 3)} aria-hidden="true" style={{ "--dx": dx + "px", "--dy": dy + "px", animationDelay: (i * 0.04) + "s" }} />
              ))}
              {celebrate}
            </div>
          </div>, document.body) : null}
        <div key={screen + (screen === "candidate" ? "" : (a11y ? "|r" : "|d"))} className="sa-pagein">
        {screen === "login" && <Suspense fallback={<ScreenLoader T={S} />}><CodeLoginScreen T={S} onSuccess={handleLogin} /></Suspense>}
        {/* ── Книга отзывов ── */}
        {screen === "guestbook" && <Suspense fallback={<ScreenLoader T={T} />}><GuestBookScreen T={T} a11y={a11y} profile={profile} role={role} completed={completed} quizDone={quizDone} examResults={examResults} practiceStars={practiceStars} focusId={bookFocus} onBack={() => { setBookFocus(null); goBack(); }} onWeekly={() => navigate("weeklyGuest")} /></Suspense>}
        {/* «Гость недели»: живой диалог из книги; завершение = страница в книге */}
        {screen === "weeklyGuest" && <Suspense fallback={<ScreenLoader T={T} />}><LiveDialogue key={weeklyLessonId()} dialogueId={weeklyId} inline={weeklyInline} hintKey="weeklyGuest" T={T} color={"#C8A96E"} onClose={(finished) => {
          try {
            const uk = profile ? `_${profile.name}_${profile.surname||""}` : "";
            const wid = weeklyLessonId();
            // Испытание засчитывается только если диалог реально доведён до конца (и гость не ушёл)
            if (finished === true && !completed[wid]) {
              const nc = { ...completed, [wid]: true };
              setCompleted(nc);
              try { localStorage.setItem("sa_completed"+uk, JSON.stringify(nc)); } catch(e) {}
            }
            // Доп. 310: доведённый до конца диалог с гостем недели — занятие (свеча, цель, чек недели)
            if (finished === true) { touchStreak(); logActivity("dialogue"); }
          } catch(e) {}
          // Доп. 158: успех — показать печать в Книге, но диалог из истории убрать (иначе Книга ↔ диалог по кругу);
          // вышел без финала — просто назад, откуда пришёл
          if (finished === true) navigate("guestbook", { replace: true }); else goBack();
        }} pro={true} /></Suspense>}
        {screen === "schedule" && <Suspense fallback={<ScreenLoader T={T} />}>
          <ScheduleScreen T={T} a11y={a11y} profile={profile} onBack={() => goBack()}
            dueCount={dueMistakes} onMistakes={() => navigate("mistakes")} onChecklist={() => navigate("checklist")} />
        </Suspense>}
        {screen === "team" && profile?.is_admin && <Suspense fallback={<ScreenLoader T={T} />}><TeamScreen T={T} profile={profile} a11y={a11y} onCandidate={() => navigate("candidate")} /></Suspense>}
        {screen === "candidate" && (profile?.is_admin || ["manager","senior"].includes(profile?.position)) && <Suspense fallback={<ScreenLoader T={T} />}><CandidateScreen T={T} a11y={a11y} profile={profile} customLessons={customLessons} onBack={() => navigate(profile?.is_admin ? "team" : "roleSelect")} /></Suspense>}
        {screen === "checklist" && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><ChecklistScreen T={T} a11y={a11y} profile={profile} onBack={() => navigate("roleSelect")} /></Suspense></div>}
        {screen === "onboarding" && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><OnboardingScreen T={T} a11y={a11y} profile={profile} role={role} onBack={() => navigate("roleSelect")} /></Suspense></div>}
        {screen === "report" && profile && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><ReportScreen a11y={a11y} profile={profile} customLessons={customLessons} startSelf={reportSelf}
          onBack={() => goBack(reportSelf ? "me" : "teamHub")} /></Suspense></div>}
        {screen === "analytics" && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><AnalyticsScreen T={T} a11y={a11y} profile={profile} scores={scores} onBack={() => navigate("roleSelect")} onReport={() => { setReportSelf(false); navigate("report"); }} /></Suspense></div>}
        {screen === "contentEditor" && <Suspense fallback={<ScreenLoader T={T} />}><ContentEditorScreen T={T} a11y={a11y} onBack={() => { loadCustomLessons(); navigate("roleSelect"); }} /></Suspense>}
        {screen === "profile" && <Suspense fallback={<ScreenLoader T={T} />}><AccountScreen profile={profile} T={T} a11y={a11y} onA11y={setA11y} themeAuto={themeAuto} onThemeAuto={setAutoTheme} onBack={() => goBack()} onLogout={handleLogout} onTrainingCard={() => navigate("trainingCard")} /></Suspense>}
        {screen === "playerDetail" && selectedPlayer && <Suspense fallback={<ScreenLoader T={T} />}><PlayerDetailScreen player={selectedPlayer} T={T} onBack={() => navigate("stats")} /></Suspense>}
        {screen === "stats" && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><StatsScreen T={T} a11y={a11y} profile={profile} onStart={() => { const nx = nextLessonOf(programModules, completed, quizDone); if (nx && nx.lesson) { setActiveModule(nx.mod); openLesson(nx.lesson); } else navigate("roleSelect"); }} scores={liveScores} completedRoles={completedRoles} completed={liveCompleted} quizDone={liveQuizDone} examResults={examResults} practiceStars={liveStars} allProfiles={allProfiles} onBack={() => navigate("roleSelect")}
          onDeleteEmployee={isAdmin ? async (name, surname) => {
            // Удаление сотрудника из «Управления данными»: находим его id в
            // списке доступа по имени, себя удалить нельзя. Серверная функция
            // та же, что в «Команде» (admin_delete_employee).
            try {
              // Карточки живут по ПРОФИЛЯМ (как человек записал себя сам),
              // а удаление ищет в СПИСКЕ ДОСТУПА (как записал руководитель).
              // «Заяц Екатерина» против «Екатерина Заяц», ё/е, пробелы —
              // поэтому сравниваем МНОЖЕСТВА токенов имени, без порядка.
              const norm = (x) => String(x || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
              const toks = (a, b) => new Set(norm(a + " " + b).split(" ").filter(Boolean));
              const isSub = (A, B) => [...A].every(x => B.has(x));
              const target = toks(name, surname);
              if (!target.size) return { ok: false, msg: "Пустое имя. Удали через «Команду»" };
              const me = toks(profile?.name, profile?.surname);
              if (me.size && (isSub(target, me) || isSub(me, target))) {
                return { ok: false, msg: "Себя удалить нельзя. Попроси другого руководителя" };
              }
              const list = await rpc("admin_list_employees", { p_token: saToken() });
              if (!Array.isArray(list)) return { ok: false, msg: "Не получил список сотрудников. Проверь связь" };
              const hits = list.filter(e => {
                const et = toks(e.name, e.surname);
                return et.size && (isSub(target, et) || isSub(et, target));
              });
              if (hits.length === 0) {
                // Призрак-профиль: зарегистрировался, но в «Команде» не создан
                // (или уже удалён оттуда). Доступа нет — стираем записи.
                try { await rpc("admin_reset_player", { p_token: saToken(), p_name: name, p_surname: surname || "" }); await wipeTraces(name, surname); } catch (e2) {}
                setScores(prev => prev.filter(x => !(x.name === name && x.surname === surname)));
                setPracticeStars(prev => { const nx = { ...prev }; delete nx[name + "|" + (surname || "")]; return nx; });
                setAllProfiles(prev => (prev || []).filter(x => !(x.name === name && x.surname === surname)));
                return { ok: true, note: "Доступа в списке не было (профиль-призрак), записи и результаты стёрты" };
              }
              if (hits.length > 1) return { ok: false, msg: "Нашёл несколько похожих: " + hits.slice(0, 3).map(e => (e.name + " " + (e.surname || "")).trim()).join(", ") + ". Удали точечно через «Команду»" };
              const emp = hits[0];
              const res = await rpc("admin_delete_employee", { p_token: saToken(), p_employee_id: emp.id });
          await wipeTraces(emp.name, emp.surname);   // следы по имени остаются и после удаления (этап 20)
              if (!(res && res.ok)) return { ok: false, msg: "Сервер не подтвердил удаление" };
              // «Удалил — значит удалил ВСЁ»: следом стираем результаты той же
              // функцией, что под кнопкой «Сбросить». Чистим ОБЕ личности —
              // профильную (карточка) и из списка доступа, если написания
              // разошлись (урок Доп. 75). Сбой зачистки удаление не отменяет.
              try { await rpc("admin_reset_player", { p_token: saToken(), p_name: name, p_surname: surname || "" }); await wipeTraces(name, surname); } catch (e) {}
              if (norm(emp.name + " " + (emp.surname || "")) !== norm(name + " " + (surname || ""))) {
                try { await rpc("admin_reset_player", { p_token: saToken(), p_name: emp.name, p_surname: emp.surname || "" }); await wipeTraces(emp.name, emp.surname); } catch (e) {}
              }
              setScores(prev => prev.filter(x => !(x.name === name && x.surname === surname)));
              setPracticeStars(prev => { const nx = { ...prev }; delete nx[name + "|" + (surname || "")]; return nx; });
              setAllProfiles(prev => (prev || []).filter(x => !(x.name === name && x.surname === surname)));
              return { ok: true };
            } catch (e) { return { ok: false, msg: "Нет связи. Попробуй ещё раз" }; }
          } : undefined}
          onResetPlayer={isAdmin ? (name, surname) => {
            setScores(prev => prev.filter(s => !(s.name === name && s.surname === surname)));
            if (profile && profile.name === name && profile.surname === surname) {
              setCompleted({});
              setQuizDone({});
              setCompletedRoles(new Set());
              setRole(null); setRoleAuto(false);
              try { const uk = `_${name}_${surname||""}`; localStorage.removeItem("sa_completed"+uk); localStorage.removeItem("sa_completed_roles"+uk); localStorage.removeItem("sa_last_role" + uk); } catch(e) {}
              try { localStorage.removeItem("sa_quiz_done"); localStorage.removeItem("sa_quiz_done" + `_${name}_${surname||""}`); } catch(e) {}
              try { localStorage.removeItem("sa_scores"); } catch(e) {}
              try { localStorage.removeItem("sa_practice_stars"); } catch(e) {}
            }
            rpc("admin_reset_player", { p_token: saToken(), p_name: name, p_surname: surname || "" }).then(() => wipeTraces(name, surname)).catch(() => {});
           
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
            // Раньше ошибка сервера проглатывалась и выглядело как «кнопка не работает» (правка 181)
            const say = (m) => { try { if (window.Telegram?.WebApp?.showAlert) window.Telegram.WebApp.showAlert(m); else alert(m); } catch (e) { alert(m); } };
            rpc("admin_unlock_quiz", { p_token: saToken(), p_name: name, p_surname: surname || "" }).then(res => {
              if (res && res.ok === false) {
                say(res.error === "forbidden" ? "Недостаточно прав." : `Не получилось: ${res.error || "сервер отказал"}`);
                return;
              }
              if (profile && profile.name === name && (profile.surname || "") === (surname || "")) {
                setQuizDone({});
                try { localStorage.removeItem("sa_quiz_done"); localStorage.removeItem("sa_quiz_done" + `_${name}_${surname || ""}`); } catch (e) {}
              }
              const n = res && typeof res.rows === "number" ? ` (снято отметок: ${res.rows})` : "";
              say(`Тесты для ${name} ${surname} разблокированы${n}`);
            }).catch(e => say("Не получилось: нет связи с сервером" + (e && e.message ? ` (${e.message})` : "")));
          } : null}
          onViewPlayer={(p) => { setSelectedPlayer(p); navigate("playerDetail"); }}
        /></Suspense></div>}
        {screen === "daily" && <Suspense fallback={<ScreenLoader T={T} />}><DailyScreen a11y={a11y} mistakeTopics={mistakeBank.filter(mm => !mm.due || mm.due <= Date.now()).map(mm => mm.lessonTitle).filter(Boolean)} T={T} profile={profile} completed={completed} quizDone={quizDone} role={role} modules={programModules} onBack={() => navigate("roleSelect")} onReferenceLesson={(id) => { setRefStart(id); navigate("reference"); }} onLesson={(lesson, mod) => { setActiveModule(mod); openLesson(lesson); }} /></Suspense>}
        {screen === "roleSelect" && <div className={vp.wide ? "sa-tabpad sa-tabpad-w" : "sa-tabpad"}><RoleSelect learnOnly wide={vp.wide} wideCols={homeCols} wideColW={homeCols ? colW : 0} short={vp.short} hintsReady={!welcome} customByRole={customByRole} dayMode={(() => { const md = modeOfDay(new Date(), role); return { ...md, count: dailyCount(profile ? `_${profile.name}_${profile.surname || ""}` : ""), streak: dailyStreak(profile ? `_${profile.name}_${profile.surname || ""}` : ""), go: () => { if (md.go === "menu") { setMenuMode(md.key); setMenuStart(null); navigate("menuTrainer"); } else if (md.go === "cocktails") { setCkStart(null); navigate("cocktails"); } else { setLabStart(null); navigate("barLab"); } } }; })()} onCocktails={() => { setRefStart(null); setCkStart(null); navigate("cocktails"); }} scores={scores} onSchedule={() => navigate("schedule")} onSelect={selectRole} T={T} a11y={a11y} profile={profile} completedRoles={completedRoles} onLeaderboard={() => navigate("leaderboard")} onProfile={() => navigate("profile")} onStats={() => navigate("stats")} onDaily={() => navigate("daily")} onGlossary={() => navigate("glossary")} role={role} onChecklist={() => navigate("checklist")} onOnboarding={() => navigate("onboarding")} onAnalytics={() => navigate("analytics")} onReference={() => { setRefStart(null); navigate("reference"); }} onContentEditor={() => navigate("contentEditor")} onCertificates={CERTIFICATES_ENABLED ? () => navigate("certificates") : undefined} onMenuTrainer={() => navigate("menuTrainer")} onMentor={() => navigate("mentor")} onSOS={() => navigate("sos")} onAssistant={() => navigate("assistant")} onCandidate={(profile?.is_admin || ["manager","senior"].includes(profile?.position)) ? () => navigate("candidate") : null} onGuestBook={() => { setBookFocus(null); navigate("guestbook"); }} completed={completed} quizDone={quizDone} examResults={examResults} mistakeBank={mistakeBank} onContinueLesson={(l, m) => { setActiveModule(m); openLesson(l); }} onMistakes={() => navigate("mistakes")}
          dayStrip={profile ? <DayChips a11y={a11y} streak={streakLive} steps={todaySteps} goal={goal} onGoal={setGoal} today={todayKey}
            firstDay={firstDay}
            /* v41 (Доп. 354): «Путь мастера» — чипом рядом со свечой и стаканом, а не карточкой под треком */
            mastery={role && mShown ? masteryChip(mShown, mNew.size, a11y) : null} onMastery={() => openMastery()} /> : null}
          /* v41 (Доп. 354): «Шаг дня» — тонкой строкой в карточке трека, без второй большой кнопки (v40 —
             карточкой MasteryHomeCard под треком: «рушит изначальный минимализм»). Строки нет, если шаг сделан,
             если он и есть следующий урок трека (это и так «Дальше») или разминка, когда строка разминки уже есть. */
          stepLine={profile && role && mShown && mStepShown && !mStepShown.done && mStepShown.kind !== "next" && mStepShown.kind !== "track"
            && !(mStepShown.go === "warmup" && warmShow && warmDone !== todayKey)
            ? <StepLine a11y={a11y} step={mStepShown} onStep={(s) => runMasteryGo(s.go, s.payload)} /> : null}
          dayNote={profile && pairLine ? (
            /* v30 (Доп. 318): напарник уже занимался сегодня — твоя очередь; v31 — своей строкой */
            <div role="button" tabIndex={0} className="sa-pairline" onClick={() => { vibrate("light"); if (pairLine.warm && warmSits.length >= 2) openWarmup(); else setPairOpen(true); }}
              {...onActivate(() => { if (pairLine.warm && warmSits.length >= 2) openWarmup(); else setPairOpen(true); })}
              style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 4px 9px", padding: "7px 11px", borderRadius: 12, fontSize: 12.5, cursor: "pointer",
                color: a11y ? "#6B4E1A" : "#D9B87C", border: `1px solid ${a11y ? "rgba(139,106,48,0.32)" : "rgba(214,178,102,0.28)"}`, background: a11y ? "rgba(255,250,238,0.5)" : "rgba(214,178,102,0.06)" }}>
              {/* v70 (Доп. 383), владелец: «свечка некрасивая, в обеих темах одинаковая палитра» — свеча стояла вне «стола» (.tbv)
                  и не получала цветов темы (тёмный воск). Из показанного выбрано «пламя» — как у серии на табличке выше */}
              <Flame lit s={18} a11y={a11y} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pairLine.text}</span><span aria-hidden="true">›</span></div>) : null}
          nowCard={nowCard} nowOn={nowOn} firstDay={firstDay} roleAuto={roleAuto} tracksOpen={tracksWanted}   /* v56 (Доп. 369): «что сейчас» — главная карточка по времени и смене */
          warmupCard={warmShow ? <WarmupCard compact a11y={a11y} shift={shiftText} known={!!shiftToday} done={warmDone === todayKey} onStart={openWarmup} what={warmSits.some((s) => s.genre !== "quiz") ? "ситуации" : "вопроса"}>
            {!tgRemind && inTelegramApp() ? <div role="button" tabIndex={0} onClick={() => setRemindOpen(true)} {...onActivate(() => setRemindOpen(true))}
              style={{ margin: "6px 4px 0", fontSize: 12, color: a11y ? "#7A5D2A" : "#D9B87C", cursor: "pointer" }}>Напоминать в Telegram за час до смены ›</div> : null}
          </WarmupCard> : null} /></div>}
        {screen === "glossary" && <div className="sa-tabpad"><GlossaryScreen T={T} a11y={a11y} onBack={() => navigate("roleSelect")} color={toolColor("gl", a11y)} saved={saved} onToggleFav={toggleFav} onSetNote={setNote} /></div>}
        {screen === "leaderboard" && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><LeaderboardScreen T={T} leaderboard={leaderboard} scores={liveScores} profile={profile} practiceStars={liveStars} masters={mastersIdx} onBack={() => navigate("roleSelect")} onLeague={() => navigate("league")} /></Suspense></div>}
        {screen === "seat" && profile && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><SeatingScreen T={T} a11y={a11y} profile={profile}
          onMissing={() => setSeatOn(false)} onBack={() => goBack("shift")} /></Suspense></div>}
        {screen === "thanks" && profile && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><ThanksScreen T={T} a11y={a11y} profile={profile} lead={isLead} startTab={thanksTab}
          onLoaded={(r) => { setThanksInfo(r); setThanksOn(true); try { localStorage.setItem("sa_thanks_on" + ukP, "1"); } catch (e) {} }}
          onBack={() => goBack(thanksTab === "team" ? "teamHub" : "me")} /></Suspense></div>}
        {screen === "cases" && profile && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><CasesScreen T={T} a11y={a11y} profile={profile} uk={ukP} playedVer={casesPlayed}
          onPlay={openCases} onOpened={casesOpened} onBack={() => { caseAskRef.current.at = 0; goBack("shift"); }} /></Suspense></div>}
        {screen === "brief" && profile && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><BriefScreen T={T} a11y={a11y} profile={profile}
          onSent={() => loadTeamBrief(true)} onBack={() => goBack("shift")} /></Suspense></div>}
        {screen === "league" && profile && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><LeagueScreen T={T} a11y={a11y} profile={profile} activity={activity} masters={mastersIdx} onBack={() => goBack("teamHub")} /></Suspense></div>}
        {/* v31: «Погреб тем» — свежесть, золото и зачёты всех тем трека */}
        {screen === "cellar" && profile && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><CellarScreen T={T} a11y={a11y} modules={programModules} completed={completed} quizDone={quizDone} marks={marks}
          tried={(id) => creditTriedToday(ukP, id, todayKey)} onBack={() => goBack("me")} onOpenTopic={(m) => { setActiveModule(m); navigate("module"); }}
          onRefresh={(m) => openTopicRun("refresh", m)} onGold={(m) => openTopicRun("gold", m)} onCredit={(m) => openTopicRun("credit", m)}
          onFreshAll={openFreshAll} onProbe={openProbe} probeCount={probeMods.length} /></Suspense></div>}
        {/* v40: «Путь мастера» — значки, «Мастер роли», шаг дня, первая неделя в академии, мастера заведения */}
        {screen === "mastery" && profile && (mShown
          ? <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><MasteryScreen T={T} a11y={a11y} profile={profile} role={role} state={mShown} step={mStepShown}
              earned={mEarned || readEarned(ukP)} seen={mSeenShown} masters={masters} focus={masteryFocus} shareUrl={APP_SHARE_URL}
              onGo={(go, payload) => runMasteryGo(go, payload)} onPrize={setMasterPrize} onReloadMasters={loadMasters} onBack={() => goBack("me")} /></Suspense></div>
          : <ScreenLoader T={T} />)}
        {/* ═══ Доп. 133: вкладки-хабы. Ничего нового — только адресация существующих экранов ═══ */}
        {screen === "shift" && profile && <div className="sa-tabpad"><HubScreen T={T} a11y={a11y} title="Смена" /* v78 (Доп. 391): без слогана под названием */
          hintKey={hintKey("shift", !!profile?.is_admin || ["manager","senior"].includes(profile?.position))}
          hintSteps={hintsFor(hintKey("shift", !!profile?.is_admin || ["manager","senior"].includes(profile?.position)))} hero={<><ShiftHero a11y={a11y} shift={shiftToday} onOpen={() => navigate("schedule")} />
            {/* v82 (Доп. 395): брифинг смены от руководителя */}
            {teamBrief ? <Suspense fallback={null}><BriefCard a11y={a11y} brief={teamBrief} seen={!!teamBrief.mine || briefSeen === briefKeyOf(teamBrief)} onOpen={openTeamBrief} /></Suspense> : null}
            {/* v30 (Доп. 314): квест смены и твоя часть */}
            <Suspense fallback={null}><QuestCard a11y={a11y} tasks={questTasks} todayRec={activity[todayKey] || {}} tick={questTick} lead={isLead} shift={shiftText} off={!!(shiftToday && shiftToday.off)}
              data={briefStatus === "ok" ? (brief && brief.quest) || { ok: false } : briefStatus === "pending" ? null : undefined} onReload={() => refreshDay(true)}
              onTask={onQuestTask} onComplete={onQuestComplete} /></Suspense></>} items={[
          // v71: группами — «На смене» (дело) и «Потренироваться» (две минуты на практику)
          isLead && { key:"brief", group:"На смене", icon:"brief", label:"Брифинг смены", sub: teamBrief ? "Сегодня отправлен" + (teamBrief.author && !teamBrief.mine ? ": " + teamBrief.author : "") + ". Можно поправить" : "Пять минут перед сменой: график, стоп-лист, фокус по ошибкам команды", onClick:() => navigate("brief") },   // v82
          seatOn && { key:"seat", group:"На смене", icon:"seat", label:"Рассадка", sub:"Схема зала: кто где сидит, брони и уборка", onClick:() => navigate("seat") },   // v85
          { key:"sch", group:"На смене", icon:"schedule", label:"График", sub:"Смены, обмены, публикации", onClick:() => navigate("schedule") },
          { key:"cl", group:"На смене", icon:"checklist", label:"Чек-листы", sub:"Открытие, предсменка, закрытие", onClick:() => navigate("checklist") },
          { key:"remind", group:"На смене", icon:"bell", label:"Напоминания в Telegram", sub: tgRemind ? "Включено: за час до смены зовёт на разминку" : "Разминка в 2 минуты за час до смены", onClick:() => setRemindOpen(true) },
          { key:"daily", group:"Потренироваться", icon:"daily", label:"Задание дня", sub:"Короткая практика на сегодня", onClick:() => navigate("daily") },
          casesOn && { key:"cases", group:"Потренироваться", icon:"cases", label:"Случаи из нашего зала", sub: casesSub(caseCounts, isLead),   // v83
            badge: caseCounts && isLead && caseCounts.inbox ? String(caseCounts.inbox) : caseCounts && (caseCounts.fresh || caseCounts.mine_new) ? "новое" : null, onClick:() => navigate("cases") },
          { key:"lg", group:"Потренироваться", icon:"guestai", label:"Живой гость", sub: guestSub(role, profile?.position), onClick: openGuest, badge: isNewFam("guest") ? "новое" : null },   // v30: Доп. 312; v40: «новое», пока не пробовал; v42: подпись — по роли
          { key:"wg", group:"Потренироваться", icon:"guest", label:"Гость недели", sub:"Живой диалог с гостем", onClick:() => navigate("weeklyGuest"), badge: isNewFam("dialogue") ? "новое" : null },
          { key:"rd", group:"Потренироваться", icon:"radio", label:"Радио в дорогу", sub:"Три коротких выпуска из твоих уроков, чтобы слушать по пути на смену", onClick: openRadio, badge: isNewFam("radio") ? "новое" : null },   // Доп. 319
          role === "seasonal" && { key:"ob", group:"Первая неделя", icon:"onboarding", label:"Первая неделя", sub:"Твой план адаптации по дням", onClick:() => navigate("onboarding") },
        ]} /></div>}
        {screen === "teamHub" && profile && (() => {
          const staff = !!profile?.is_admin || ["manager","senior"].includes(profile?.position);
          const dueM = (mistakeBank || []).filter(m => !m.due || m.due <= Date.now()).length;
          return <div className="sa-tabpad"><HubScreen T={T} a11y={a11y} title="Команда" hintKey={hintKey("team", staff)}
            hintSteps={hintsFor(hintKey("team", staff))} /* v78: без слогана под названием */ hero={<><TeamHero a11y={a11y} leaderboard={leaderboard} profile={profile} onOpen={() => navigate("leaderboard")} />
              {/* v40: коллега стал мастером роли за последнюю неделю — команда видит */}
              <MastersBanner a11y={a11y} rows={masters && masters.status === "ok" ? masters.rows : []} onOpen={() => openMastery()} />
              {/* v57 (Доп. 370): «Жизнь команды» — тесты, мастера, рекорды и «спасибо» коллег за две недели */}
              <TeamFeed a11y={a11y} items={teamFeed} /></>} items={[
            // v71: у руководителя «Управление» — сразу под лентой, строками в одной карточке (было в самом низу)
            staff && { key:"an", group:"Управление", icon:"analytics", label:"Аналитика", sub:"Сводка по команде и резервная копия", onClick:() => navigate("analytics") },
            profile?.is_admin && { key:"tm", group:"Управление", icon:"team", label:"Сотрудники", sub:"Карточки, коды, роли", onClick:() => navigate("team") },
            staff && { key:"hire", group:"Управление", icon:"hire", label:"Собеседование", sub:"Кандидаты и AI HR", onClick:() => navigate("candidate") },
            staff && { key:"rep", group:"Управление", icon:"report", label:"Отчёты по сотрудникам", sub:"Кто где ошибается и что не прошёл, в Excel и PDF", onClick:() => { setReportSelf(false); navigate("report"); } },
            staff && { key:"ce", group:"Управление", icon:"edit", label:"Редактор контента", sub:"Уроки и материалы команды", onClick:() => navigate("contentEditor") },
            staff && thanksOn && { key:"thanksTeam", group:"Команда", icon:"thanks", label:"Спасибо от гостей", sub:"Кого и за что благодарят гости по QR", onClick:() => openThanks("team") },   // v84
            { key:"lb", group:"Команда", icon:"trophy", label:"Рейтинг", sub:"Очки, звёзды, место в команде", onClick:() => navigate("leaderboard") },
            { key:"lg", group:"Команда", icon:"league", label:"Лига недели", sub: leagueSub(brief) || "Очки за занятия с понедельника: в заведении и в сети", onClick:() => navigate("league") },   // v30: Доп. 317; v31: место из сводки дня
            { key:"mt", group:"Команда", icon:"mentor", label:"Наставничество", sub: isLead && hallInbox ? `${hallInbox} ${hallInbox % 10 === 1 && hallInbox % 100 !== 11 ? "запрос ждёт" : "запроса ждут"} подтверждения в зале` : "Допуски и подтверждение навыков", badge: isLead && hallInbox ? String(hallInbox) : null, onClick:() => navigate("mentor") },
            role !== "seasonal" && { key:"ob", group:"Команда", icon:"onboarding", label:"Новички", sub:"План первой недели и прогресс новых сотрудников", onClick:() => navigate("onboarding") },
            { key:"mis", group:"Моё обучение", icon:"mistakes", label:"Работа над ошибками", sub: dueM ? `${dueM} к повторению` : "Вопросы, где ошибался", badge: dueM ? String(dueM) : null, onClick:() => navigate("mistakes") },
          ]} compactGroups={["Управление"]} /></div>;
        })()}
        {screen === "guide" && profile && <Suspense fallback={<ScreenLoader T={T} />}><GuideScreen T={T} a11y={a11y} profile={profile} onBack={() => goBack("me")} onOpen={(dest) => {
          if (dest === "menu") navigate("menuTrainer");
          else if (dest === "reference") { setRefStart(null); navigate("reference"); }
          else if (dest === "cocktails") { setRefStart(null); setCkStart(null); navigate("cocktails"); }
          else if (dest === "guestbook") { setBookFocus(null); navigate("guestbook"); }
          else if (dest === "report" || dest === "myreport") { setReportSelf(dest === "myreport"); navigate("report"); }   // Доп. 309
          else if (dest === "guest") openGuest();   // v30
          else if (dest === "radio") openRadio();
          else if (dest === "month") openRecap();
          else if (dest === "pair") setPairOpen(true);
          else if (dest === "mastery") openMastery();   // v40
          else if (dest === "thanks") openThanks("mine");   // v84
          else navigate(dest);
        }} /></Suspense>}
        {screen === "me" && profile && <div className="sa-tabpad"><HubScreen T={T} a11y={a11y}
          hintKey="me"
          hintSteps={hintsFor("me")}
          title={profile.name} subtitle={profile.restaurant || "Service Academy"}
          hero={<MeHero a11y={a11y} streak={streak} roleLabel={ROLES.find(r => r.id === role)?.label} total={totalLessons}
            done={programModules.reduce((a, m) => a + m.lessons.filter(l => l.type !== "result" && (l.type === "quiz" ? quizDone[l.id] : completed[l.id])).length, 0)}
            onOpen={() => navigate("stats")} />} items={[
          // v40: «Путь мастера» — значки и главная награда; «новое», пока не открывали
          // v71: группами; итоги и настройки — строками в одной карточке
          thanksOn && { key:"thanks", group:"Мой путь", icon:"thanks", label:"Спасибо от гостей", sub: thanksSub(thanksInfo), onClick:() => openThanks("mine") },   // v84
          mShown && { key:"mastery", group:"Мой путь", icon:"mastery", label:"Путь мастера",
            sub: mShown.master.ok
              ? "Мастер роли · " + mShown.bronze + " из " + mShown.total + " значков"
              : mShown.bronze + " из " + mShown.total + " значков · до «Мастера роли» " + mShown.master.have + " из " + mShown.master.need,
            badge: !mSeen.mastery ? "новое" : null, onClick:() => openMastery() },
          { key:"guide", group:"Помощь и настройки", icon:"book", label:"Гид по приложению", sub:"Что где и зачем, с кнопками «Открыть»", onClick:() => navigate("guide") },
          { key:"st", group:"Мой путь", icon:"stats", label:"Мой прогресс", sub:"Роли, уроки, экзамены", onClick:() => navigate("stats") },
          // Доп. 306: по понедельникам — чек прошлой недели (с главной сюда, чтобы главная была лёгкой)
          weekCardShow
            ? { key:"week", group:"Итоги и документы", icon:"receipt", label:"Чек недели", sub:`Прошлая неделя: в деле ${prevWeek.activeDays} из 7. Можно отправить команде`, badge:"новый", onClick:() => openWeek("prev") }
            : { key:"week", group:"Итоги и документы", icon:"receipt", label:"Чек недели", sub:"Что сделано за 7 дней. Можно отправить команде", onClick:() => openWeek("last7") },
          // v30 (Доп. 320): итоги месяца; первые три дня месяца — итоги прошлого с отметкой «новые»
          (() => {
            const seenR = (() => { try { return localStorage.getItem("sa_recap_seen" + ukP) || ""; } catch (e) { return ""; } })();
            const rc = monthRecap({ act: activity, streak, month: recapWhich.key });
            const fresh = recapWhich.prev && seenR !== recapWhich.key;
            return { key:"month", group:"Итоги и документы", icon:"month", label:"Итоги месяца", sub: (recapWhich.prev ? "Итоги: " : "") + MONTH[rc.month - 1] + (recapWhich.prev ? "" : " пока") + ": " + rc.active + " " + pl3(rc.active, "день", "дня", "дней") + " в деле, карточки и «поделиться»",
              badge: fresh ? "новые" : null, onClick:() => openRecap(recapWhich.key) };
          })(),
          // v31: «Погреб тем» — свежесть, золото и зачёты всех тем трека
          { key:"cellar", group:"Мой путь", icon:"cellar", label:"Погреб тем", sub: (() => { const g = Object.keys(marks.gold || {}).length; const f = fadedIds.size; return (f ? f + " " + pl3(f, "тема выдыхается", "темы выдыхаются", "тем выдыхаются") : "Всё свежее") + (g ? ", золотых " + g : ""); })(),   // v78: без перечня «освежить, раунд мастера, зачёт»
            // v40: «новое» — если освежать или играть раунд мастера уже есть что, а ни разу не пробовал
            badge: fadedIds.size >= 3 ? String(fadedIds.size) : (isNewFam("fresh") || isNewFam("gold")) && !mSeen.cellar ? "новое" : null, onClick:() => navigate("cellar") },
          { key:"myrep", group:"Итоги и документы", icon:"report", label:"Мой отчёт", sub:"Что пройдено, где ошибаюсь, что повторить (PDF)", onClick:() => { setReportSelf(true); navigate("report"); } },
          // v30 (Доп. 318): свеча на двоих
          { key:"pair", group:"Вместе", icon:"pair", label:"Свеча на двоих",
            sub: pairInfo && pairInfo.pair ? "С " + ((pairInfo.pair.partner && pairInfo.pair.partner.name) || "напарником") + " · " + pairInfo.pair.streak + " " + pl3(pairInfo.pair.streak, "день", "дня", "дней") + " вместе"
              : pairInfo && pairInfo.invites && pairInfo.invites.length ? "Тебя зовут в пару. Ответь" : "Общая серия с напарником или наставником",
            badge: pairInfo && pairInfo.invites && pairInfo.invites.length ? String(pairInfo.invites.length) : null, onClick:() => { vibrate("light"); setPairOpen(true); } },
          CERTIFICATES_ENABLED && { key:"cert", group:"Итоги и документы", icon:"cert", label:"Сертификаты", sub:"Пройденные роли с печатью", onClick:() => navigate("certificates") },
          { key:"acc", group:"Помощь и настройки", icon:"profile", label:"Аккаунт и настройки", sub:"Карта обучения, «Для чтения», выход", onClick:() => navigate("profile") },
          { key:"roles", group:"Мой путь", icon:"roles", label:"Мои роли", sub:"Сменить трек или открыть новый", onClick:() => navigate("roleSelect") },
          { ...offlineHelp, group:"Помощь и настройки" },
        ]} groupOrder={["Мой путь", "Итоги и документы", "Вместе", "Помощь и настройки"]} compactGroups={["Итоги и документы", "Помощь и настройки"]} /></div>}
        {screen === "offline" && <OfflineScreen T={T} a11y={a11y} onBack={() => goBack("me")} />}
        {screen === "barLab" && <Suspense fallback={<ScreenLoader T={T} />}><BarLabScreen T={T} a11y={a11y} profile={profile} startId={labStart} onBack={() => goBack("reference")} onOpenDeck={(id) => { setRefStart(null); setCkStart(id); navigate("cocktails"); }} /></Suspense>}
        {screen === "ckEditor" && <Suspense fallback={<ScreenLoader T={T} />}><CocktailEditor T={T} a11y={a11y} profile={profile} startEditId={ckEdit} onBack={() => goBack("cocktails")} onOpenCard={(id) => { setRefStart(null); setCkStart(id); navigate("cocktails"); }} /></Suspense>}
        {screen === "barPrint" && <Suspense fallback={<ScreenLoader T={T} />}><BarCardPrint T={T} a11y={a11y} profile={profile} onBack={() => goBack("cocktails")} /></Suspense>}
        {screen === "home" && !MODULES[role] && <ScreenLoader T={T} />}
        {/* Экран трека — когда модули роли приехали (правка 163): при первом входе с нового устройства и на медленной сети он открывался раньше и падал */}
        {/* Доп. 307: трек и раздел — один экран: меню темы, темы листаются свайпом. Раздел из чужой
            роли (открыт через Наставника) — прежним отдельным экраном ниже */}
        {(screen === "home" || (screen === "module" && inPages(activeModule))) && MODULES[role] && <div className="sa-tabpad"><HomeScreen role={ROLES.find(r=>r.id===role)} modules={modules} completed={completed} quizDone={quizDone} progress={progress} doneCount={doneCount} totalLessons={totalLessons} onModule={openModule} onChangeRole={() => { setTracksWanted(true); navigate("roleSelect"); }} T={T} streak={streak} a11y={a11y} profile={profile} onChecklist={() => navigate("checklist")} onOnboarding={() => navigate("onboarding")} onAnalytics={() => navigate("analytics")} mistakeBank={mistakeBank} onMistakes={() => navigate("mistakes")} customModules={customModules} onSearch={() => navigate("search")} dayGoal={{ steps: todaySteps, goal }} marks={marks} topicActs={topicActs}
          focusId={activeModule ? activeModule.id : null} pagerOnly={screen === "module"} onPage={setActiveModule}
          onLesson={(l, m) => { if (m && m.id !== (activeModule && activeModule.id)) setActiveModule(m); openLesson(l); }}
          nextFor={moduleNextFor} onNext={moduleOnNext} finish={moduleFinishFor()} onBookPage={(m) => { setBookFocus((m && m.id) || null); navigate("guestbook"); }} /></div>}
        {screen === "mistakes" && <MistakesScreen T={T} a11y={a11y} mistakeBank={mistakeBank} noTests={!myScores.length && !Object.keys(quizDone || {}).length} onResolve={resolveMistake} onFail={failMistake} onBack={() => goBack("home")} />}
        {screen === "search" && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><SearchScreen T={T} a11y={a11y} role={ROLES.find(r=>r.id===role)} profile={profile} modules={[...(MODULES[role] || []), ...(customModules || [])]} onOpen={(m, l) => { setActiveModule(m); openLesson(l); }} onReferenceLesson={(id) => { setRefStart(id); navigate("reference"); }} onCocktail={(id) => { setRefStart(null); setCkStart(id); navigate("cocktails"); }} onBack={() => goBack("home")} /></Suspense></div>}
        {screen === "menuTrainer" && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><MenuTrainerScreen accent={toolColor("menu", a11y)} role={role} startDishId={menuStart} startMode={menuMode} onOpenCocktail={(id) => { setRefStart(null); setCkStart(id); navigate("cocktails"); }} T={T} a11y={a11y} profile={profile} onBack={() => goBack()} /></Suspense></div>}
        {screen === "cocktails" && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><CocktailsScreen onLab={() => { setLabStart(null); navigate("barLab"); }} onEdit={(id) => { setCkEdit(id || null); navigate("ckEditor"); }} onPrint={() => navigate("barPrint")} profile={profile} onOpenDish={(id) => { setMenuStart(id); navigate("menuTrainer"); }} onBuild={(id) => { setLabStart(id); navigate("barLab"); }} T={T} a11y={a11y} startId={ckStart} onBack={() => { setRefStart(null); setCkStart(null); goBack(); }} onBasics={(id) => { setRefStart(id); navigate("reference"); }} /></Suspense></div>}
        {screen === "trainingCard" && <Suspense fallback={<ScreenLoader T={T} />}><TrainingCardScreen T={T} a11y={a11y} profile={profile} completed={completed} quizDone={quizDone} examResults={examResults} onBack={() => navigate("profile")} /></Suspense>}
        {screen === "sos" && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><SOSScreen T={T} a11y={a11y} onBack={() => goBack()} /></Suspense></div>}
        {lessonLockMsg && (
          <div onClick={() => setLessonLockMsg(null)} style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.45)" }}>
            <div onClick={e => e.stopPropagation()} style={{ maxWidth: 340, borderRadius: 20, padding: "22px 20px", textAlign: "center",
              background: a11y ? "rgba(250,242,222,0.96)" : "rgba(28,20,8,0.96)",
              border: a11y ? "1px solid rgba(139,106,48,0.4)" : "1px solid rgba(255,255,255,0.16)",
              boxShadow: a11y ? "inset 0 0 26px rgba(255,250,235,0.6), 0 12px 40px rgba(70,50,15,0.3)" : "inset 0 0 26px rgba(255,248,230,0.08), 0 12px 40px rgba(0,0,0,0.55)" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: a11y ? "#7A5D2A" : "#C8A96E" }}><Sign n="lock" s={30} /></div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.6, color: a11y ? "#3A2E1C" : "#EFE6D2", marginBottom: 16 }}>{lessonLockMsg}</div>
              <button onClick={() => setLessonLockMsg(null)} style={{ padding: "10px 24px", borderRadius: 999, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #C8A96E, #7A5D2A)", color: "#fff", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold" }}>Понятно</button>
            </div>
          </div>
        )}
        {screen === "assistant" && <Suspense fallback={<ScreenLoader T={T} />}><AssistantScreen T={T} a11y={a11y} profile={profile}
          learner={assistantLearner()} onBack={() => goBack()} onNavigate={(dest) => assistantNavigate(dest, false)} /></Suspense>}
        {screen === "mentor" && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><MentorScreen T={T} a11y={a11y} profile={profile} role={role} roleObj={ROLES.find(r=>r.id===role)} onBack={() => goBack()} onInbox={setHallInbox} extraSkills={customSkills} /></Suspense></div>}
        {screen === "module" && !(inPages(activeModule) && MODULES[role]) && <div className="sa-tabpad"><NewPageBanner T={T} mod={activeModule} completed={completed} quizDone={quizDone} onOpen={() => { setBookFocus(activeModule?.id || null); navigate("guestbook"); }} /><ModuleScreen mod={activeModule} completed={completed} quizDone={quizDone} onBack={() => navigate("home")} onLesson={openLesson} T={T} a11y={a11y}
          next={moduleNextFor(activeModule)} onNext={moduleOnNext} finish={moduleFinishFor()} /></div>}
        {/* Урок-диалог: порталом в body — внутри анимируемой обёртки переходов
            WebKit ломает position:fixed у шторки (см. фикс пути из поппапа) */}
        {screen === "lesson" && activeLesson?.type === "dialogue" && createPortal(
          <Suspense fallback={<ScreenLoader T={T} />}><LiveDialogue key={"dlg-" + gameKey} dialogueId={activeLesson.dialogueId} inline={activeLesson.dialogue} T={T} color={activeModule?.color} pro={true}
            onClose={(finished, st) => {
              // v37: урок засчитывается, когда разговор дошёл до конца (и когда гость ушёл — как раньше).
              // Вышел посреди разговора — стрелкой в шапке или кнопкой «Назад» Telegram — просто назад,
              // без отметки (ревью v37: «Назад» Telegram теперь жмёт стрелку диалога и засчитывал урок)
              if (finished === true || (st && st.done)) completeLesson(); else goBack("module");
            }} /></Suspense>
        , document.body)}
        {screen === "lesson" && activeLesson?.type === "build" && createPortal(
          <Suspense fallback={<ScreenLoader T={T} />}>
            <BuildRunner key={"bld-" + gameKey} buildId={activeLesson.buildId} inline={activeLesson.build} mod={activeLesson.mod || activeModule?.id} role={activeLesson.role || role}
              T={T} color={activeModule?.color} onClose={completeLesson} onResult={recordBuildResult} />
          </Suspense>
        , document.body)}
        {screen === "lesson" && activeLesson?.type !== "dialogue" && activeLesson?.type !== "build" && <LessonScreen key={gameKey} lesson={activeLesson} color={activeModule?.color} onBack={() => { if (activeLesson?.type === "quiz" && profile) { try { const sk = loopExit(loopUk, activeLesson.id); if (sk) logSkip(activeLesson.id, sk); } catch (e) {} } goBack("module"); /* Доп. 306: туда, откуда пришёл */ }} onComplete={completeLesson} done={!!lessonDone} next={lessonDone ? lessonDone.next : undefined} onToModule={() => navigate("module")} skipped={lessonDone ? lessonDone.skipped : null} onSkipped={() => { const sk = lessonDone && lessonDone.skipped; if (!sk) return; setLessonDone(null); if (sk.mod && sk.mod.id !== activeModule?.id) setActiveModule(sk.mod); openLesson(sk.lesson); }} onNext={() => { const nx = lessonDone && lessonDone.next; setLessonDone(null); if (nx) { if (nx.mod && nx.mod.id !== activeModule?.id) setActiveModule(nx.mod); openLesson(nx.lesson); } else { navigate("module"); } }} quizState={quizState} onQuiz={handleQuiz} practiceState={practiceState} setPracticeState={setPracticeState} onPracticeChoice={handlePracticeChoice} onPracticeNext={handlePracticeNext} T={T}
          mod={activeModule} profile={profile} streak={streak} mistakeBank={mistakeBank} onMistakes={addMistakes} onResolveMistake={resolveMistake} onFailMistake={failMistake}
          wasCompleted={!!(activeLesson && completed[activeLesson.id])}
          modules={programModules} mentorName={mentorName} goal={{ steps: todaySteps, goal }} onAskMentor={askMentor} onActivity={logActivity}
          onContents={activeModule ? () => navigate("module") : undefined} />}
        {screen === "roleComplete" && <Suspense fallback={<ScreenLoader T={T} />}><RoleCompleteScreen role={ROLES.find(r=>r.id===role)} nextRole={ROLE_ORDER.indexOf(role) >= 0 ? ROLES.find(r=>r.id===ROLE_ORDER[ROLE_ORDER.indexOf(role)+1]) : undefined} T={T} onNext={() => navigate("roleSelect")} onExam={CERTIFICATES_ENABLED ? () => openExam(role) : undefined} /></Suspense>}
        {screen === "reference" && <Suspense fallback={<ScreenLoader T={T} />}><ReferenceSection accent={toolColor("sp", a11y)} onBarLab={() => { setLabStart(null); navigate("barLab"); }} key={refStart || "hub"} T={T} a11y={a11y} profile={profile} startLessonId={refStart} onExit={() => goBack()} onCocktails={() => { setRefStart(null); setCkStart(null); navigate("cocktails"); }} /></Suspense>}
        {screen === "certificates" && <Suspense fallback={<ScreenLoader T={T} />}><CertificatesScreen T={T} a11y={a11y} profile={profile} completedRoles={completedRoles} examResults={examResults} completed={completed} quizDone={quizDone} onExam={openExam} onCertificate={openCertificate} onExit={() => navigate("roleSelect")} /></Suspense>}
        {screen === "exam" && <Suspense fallback={<ScreenLoader T={T} />}><ExamScreen T={T} a11y={a11y} roleObj={ROLES.find(r=>r.id===examRole)} roleId={examRole} extraQuestions={examExtra} onFinish={(id, result) => { recordExam(id, result); if (result.passed) { cheer("Экзамен сдан"); openCertificate(id); } }} onExit={() => navigate("certificates")} /></Suspense>}
        {screen === "certificate" && <Suspense fallback={<ScreenLoader T={T} />}><CertificateScreen T={T} a11y={a11y} profile={profile} roleObj={ROLES.find(r=>r.id===examRole)} result={examResults[examRole]} onExit={() => navigate("certificates")} onShare={() => { const ro = ROLES.find(r=>r.id===examRole); const txt = `Я сдал(а) экзамен на роль «${ro?.label||""}» в Service Academy! ${APP_SHARE_URL}`; try { if (navigator.share) { navigator.share({ text: txt, url: APP_SHARE_URL }); } else if (navigator.clipboard) { navigator.clipboard.writeText(txt); } } catch(e) {} }} /></Suspense>}
        </div>

        {/* Онбординг: приветствие при первом входе */}
        {loophole && !welcome && loopView === "banner" && (
          <LoopholeBanner a11y={a11y} n={loophole.n || 1} female={isFemaleName(profile?.name, profile?.surname)}
            onOpen={() => {
              setLoopView("card");
              if (!loopRank) { try { rpc("quiz_key_rank", { p_token: saToken() }).then(r => { if (r && r.ok) setLoopRank(r); }).catch(() => {}); } catch (e) {} }
            }}
            onHide={() => setLoopView(null)} />
        )}
        {loophole && !welcome && loopView === "card" && (
          <LoopholeCard rec={loophole} rank={loopRank} a11y={a11y} female={isFemaleName(profile?.name, profile?.surname)}
            onClose={() => { try { loopSeen(loopUk, loophole); } catch (e) {} setLoophole(null); setLoopView(null); setLoopRank(null); }}
            onMistakes={() => { try { loopSeen(loopUk, loophole); } catch (e) {} setLoophole(null); setLoopView(null); setLoopRank(null); navigate("mistakes"); }} />
        )}
        {welcome && <WelcomeIntro T={T} a11y={a11y} isAdmin={!!profile?.is_admin} canHire={!!profile?.is_admin || ["manager","senior"].includes(profile?.position)} onClose={closeWelcome} />}
        {/* Контекстная подсказка о повторении — над навбаром, показывается один раз */}
        {mistakeHint && !welcome && (
          <div className="sa-hintin" style={{ position: "fixed", left: 16, right: 16, bottom: vp.wide ? 24 : 104, zIndex: 400,
              maxWidth: 420, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 16,
              opacity: hintLeaving ? 0 : 1, transform: hintLeaving ? "translateY(14px)" : undefined,
              transition: "opacity .24s ease, transform .24s ease",
              background: a11y ? "rgba(250,246,236,0.94)" : "rgba(30,22,10,0.94)",
              backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
              border: a11y ? "1px solid rgba(139,106,48,0.45)" : "1px solid rgba(200,160,80,0.42)",
              boxShadow: a11y
                ? "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 30px rgba(70,50,15,0.25)"
                : "inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 30px rgba(0,0,0,0.5)" }}>
            <span className="sa-pulse" style={{ display: "flex", flexShrink: 0 }}>{UI_SVG.target(a11y ? "#7A5D2A" : "#C8A96E", 18)}</span>
            <div onClick={() => closeMistakeHint(true)} {...onActivate(() => closeMistakeHint(true))}
              style={{ flex: 1, cursor: "pointer", color: T.modSub?.color || "#C8B898", fontSize: a11y ? 14 : 12.5, lineHeight: 1.5 }}>
              Появились вопросы на повторение. Загляни в «Работу над ошибками»
            </div>
            <button className="sa-btn" onClick={() => closeMistakeHint(false)}
              style={{ border: "none", background: "transparent", color: T.modSub?.color || "#9A8C74", fontSize: 15, cursor: "pointer", padding: 4, flexShrink: 0 }}>✕</button>
          </div>
        )}

        {/* Плавающий AI-ассистент — главный вход во флагманскую фичу */}
        {/* v50: в широкой раскладке кнопка Наставника — в меню слева (NavRail), не над содержимым */}
        {profile ? <UpdateToast a11y={a11y} /> : null}   {/* v59 (Доп. 372): «Готова новая версия · Обновить» вместо перезагрузки посреди работы */}
        {fabOn && (
          <AiFab a11y={a11y} screen={screen} onClick={() => navigate("assistant")} />
        )}

        {/* Нижняя навигация — только на основных экранах */}
        {!online && (
          // v69 (Доп. 382): отступ под строку состояния — сверху (был снизу: под вырезом экрана текст прятался)
          <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:500, padding:"calc(6px + var(--sa-st, env(safe-area-inset-top, 0px))) 12px 6px", textAlign:"center", fontSize:12, letterSpacing:0.5,
            background: a11y ? "rgba(139,106,48,0.92)" : "rgba(60,44,16,0.92)", color:"#EFE4C8", backdropFilter:"blur(6px)" }}>
            Без сети. Работаем на сохранённом и синхронизируем, когда появится связь
          </div>
        )}
        {/* Доп. 133: четыре вкладки. Экран внутри раздела подсвечивает свою вкладку. */}
        {navOn && (() => {
          const activeId = ({ roleSelect:"roleSelect", home:"roleSelect", module:"roleSelect", glossary:"roleSelect", daily:"shift", shift:"shift",
                         leaderboard:"teamHub", team:"teamHub", playerDetail:"teamHub", teamHub:"teamHub", stats:"me", me:"me" })[screen] || screen;
          const tabs = [
            { id:"roleSelect", icon:"home",  label:"Учусь" },
            { id:"shift",      icon:"daily", label:"Смена" },
            { id:"teamHub",    icon:"team",  label:"Команда" },
            { id:"me",         icon:"stats", label:"Я" },
          ];
          // v50 (Доп. 363): шире 600 px — меню слева (телефон лёжа, планшет, компьютер); в портрете — как было
          return vp.wide
            ? <NavRail a11y={a11y} activeId={activeId} tabs={tabs} compact={vp.short} onTab={(id) => navigate(id)} onAi={() => navigate("assistant")} />
            : <LiquidTabBar a11y={a11y} activeId={activeId} onTab={(id) => { if (screen !== id) vibrate("light"); navigate(id); }} tabs={tabs}
                onAi={() => navigate("assistant")} aiMode="center" />;
        })()}
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
    this.state = { hasError: false, updating: false, offline: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errMsg: String(error && (error.message || error)) };
  }
  componentDidCatch(error, info) {
    // Доп. 218: перекос деплоя — старый HTML тянет чанк, которого уже нет. Один раз перезагружаемся сами.
    // Доп. 226/245: чанк не загрузился. Нет сети — это обрыв связи: показываем «Повторить» без перезагрузки.
    // Сеть есть — скорее всего перекос деплоя: перезагружаемся, не чаще раза в 30 секунд.
    try { const msg = String((error && error.message) || ""); if (/Importing a module script failed|Loading chunk|dynamically imported module|Failed to fetch dynamically/i.test(msg)) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) { this.setState({ offline: true }); return; }
      const last = Number(sessionStorage.getItem("sa_chunk_reload_at") || 0);
      if (Date.now() - last > 30000) { sessionStorage.setItem("sa_chunk_reload_at", String(Date.now())); this.setState({ updating: true }); setTimeout(() => window.location.reload(), 600); }
      else this.setState({ offline: true }); // уже перезагружались только что — значит, дело в связи
    } } catch (e) {}
    console.error("ServiceAcademy crashed:", error, info);
    // Экран ошибки обязан быть ВИДЕН: если краш случился до снятия
    // брендовой заставки, она (z-index 9999, вне #root) закрыла бы бокал
    // вина — и снаружи это выглядело бы «вечной загрузкой» без диагноза
    try { const sp = document.getElementById("sa-splash"); if (sp) sp.remove(); } catch (e) {}
    try { this.setState({ errStack: String((info && info.componentStack || "").split("\n").slice(0, 4).join(" · ")) }); } catch (e) {}
  }
  handleReload = () => {
    try { window.location.reload(); } catch (e) { this.setState({ hasError: false }); }
  };
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "calc(100vh - var(--sa-st, 0px))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", background: "linear-gradient(160deg, #14100A 0%, #1C1509 50%, #14110A 100%)", fontFamily: "Georgia, serif" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>{ROLE_SVG.bar("#C8A96E", 44)}</div>
          <div style={{ color: CREAM, fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>{this.state.updating ? "Приложение обновилось" : this.state.offline ? "Экран не докачался" : "Что-то пошло не так"}</div>
          <div style={{ color: "#7A654C", fontSize: 14, lineHeight: 1.7, maxWidth: 320, marginBottom: 24 }}>
            {this.state.updating ? "Вышла новая версия. Перезагружаю, секунду…" : this.state.offline ? "Похоже, связь оборвалась на полпути. Прогресс на месте. Проверь интернет и нажми «Повторить»." : "Произошёл сбой при загрузке экрана. Прогресс сохранён, перезагрузи приложение."}
          </div>
          <button onClick={this.handleReload} style={{ background: "linear-gradient(135deg, #C8A96E 0%, #7A5D2A 100%)", color: "#fff", border: "none", borderRadius: 14, padding: "14px 28px", fontSize: 16, fontFamily: "Georgia, serif", cursor: "pointer", boxShadow: "0 4px 18px rgba(200,160,80,0.3)" }}>
            Перезагрузить
          </button>
          {/* Диагностика: текст ошибки для скриншота в поддержку */}
          {(this.state.errMsg || this.state.errStack) && (
            <div style={{ marginTop: 22, maxWidth: 330, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(140,106,38,0.3)", background: "rgba(0,0,0,0.25)" }}>
              <div style={{ ...labelStyle(13), color: "#918879", marginBottom: 5 }}>Для поддержки · сделай скриншот</div>
              <div style={{ color: "#7A654C", fontSize: 10.5, fontFamily: "monospace", lineHeight: 1.6, wordBreak: "break-word" }}>{this.state.errMsg}{this.state.errStack ? " | " + this.state.errStack : ""}</div>
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
