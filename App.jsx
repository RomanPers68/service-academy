import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import React from "react";

// ── Вынесенные модули ──────────────────────────────────────────────
import { SUPABASE_URL, SUPABASE_KEY, rpc, saToken, rpcSync, flushQueue, supabase } from "./api/supabase";
import { MODULES, loadRoleModules, loadAllModules, loadSpgModules, allLessonIds, roleOfLessonId } from "./data/modules";
import { useContentVersion } from "./lib/use-content";
import { HubScreen, ShiftHero, TeamHero, MeHero } from "./ui/home-hubs";
import { GuideScreen } from "./ui/guide";
import { OfflineScreen } from "./ui/offline";
import { LiquidTabBar } from "./ui/tabbar";
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
const CocktailsScreen = lazy(() => import("./ui/cocktails").then(m => ({ default: m.CocktailsScreen })));
const GuestBookScreen = lazy(() => import("./ui/guestbook").then(m => ({ default: m.GuestBookScreen })));
const MentorScreen = lazy(() => import("./ui/mentor").then(m => ({ default: m.MentorScreen })));
const SOSScreen = lazy(() => import("./ui/sos").then(m => ({ default: m.SOSScreen })));
const TrainingCardScreen = lazy(() => import("./ui/training-card").then(m => ({ default: m.TrainingCardScreen })));
const ReferenceSection = lazy(() => import("./ui/ReferenceSection").then(m => ({ default: m.ReferenceSection })));
const CandidateScreen = lazy(() => import("./ui/candidate").then(m => ({ default: m.CandidateScreen })));
const AssistantScreen = lazy(() => import("./ui/assistant").then(m => ({ default: m.AssistantScreen })));
const ScheduleScreen = lazy(() => import("./ui/schedule").then(m => ({ default: m.ScheduleScreen })));
const BuildRunner = lazy(() => import("./ui/build").then(m => ({ default: m.BuildRunner })));

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
  text: "Стеклянная кнопка в правом нижнем углу — AI-наставник. Он знает Справочник и меню твоего ресторана: спроси про жалобу гостя, состав блюда или аллергены — ответит как старший коллега и кнопкой отведёт в нужный раздел.",
};

// Новые фичи большого обновления — карточки для всех
const WELCOME_BUILD_CARD = {
  icon: (c) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h14l-7 8zM12 12v6M8 21h8" /><path d="M8.2 7h7.6" opacity="0.6" />
    </svg>
  ),
  title: "Тренажёры — твой спортзал",
  text: "В «Сборке» собираешь коктейли шаг за шагом: ошибся — напиток испорчен, как за настоящей стойкой; за чистый прогон — звёзды и печать в Книгу. Тренажёр меню гоняет по составам и аллергенам, диалоги — по разговору с гостем. Ошибаться здесь бесплатно.",
};
const WELCOME_REF_CARD = {
  icon: (c) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2.2 5-5 2.2 2.2-5z" /><circle cx="12" cy="12" r="0.8" />
    </svg>
  ),
  title: "Справочник и поиск",
  text: "Курсы для всей команды: сервировка, вино, кофе, Колода бармена с историями коктейлей. Все возможности приложения расписаны в гиде во вкладке «Я». Строка поиска найдёт что угодно: главу, термин, блюдо. А «глава дня» в Заданиях читает Справочник за тебя — по странице в день.",
};
const WELCOME_SCHED_CARD = {
  icon: (c) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M8 14.5h3M8 17.5h5" opacity="0.7" />
    </svg>
  ),
  title: "График смен — в кармане",
  text: "Свои смены, часы и заработок — без скриншотов из чатов. Тапни день: кто в смене с тобой, личная заметка, кнопки «попросить выходной» и «не смогу выйти». Имя в капсуле с трубкой — звонок старшему в один тап. Кнопка ниже сохранит месяц картинкой.",
};

// Менеджерам и руководству: график в режиме редактора
const WELCOME_SCHEDIT_CARD = {
  icon: (c) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M14.5 17.5l2-2 2 2M16.5 15.5v4" opacity="0" /><path d="M9 16.8l1.6 1.6 3.4-3.9" />
    </svg>
  ),
  title: "График: режим редактора",
  text: "Настрой смены, правила и оплату — и жми «Заполнить черновик»: генератор закроет дыры, не тронув расставленное, продолжит ритм 2/2 из прошлого месяца и учтёт просьбы команды. «Факт часов» делает зарплату честной, секции внизу считают фонд. Экспорт — в чат или листом А4.",
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
    text: "Учись по шагам: уроки открываются по порядку, а приложение само подскажет, куда дальше. Кнопка «ДАЛЬШЕ» на главной — твой компас. В тестах ответ подсвечивается сразу — учишься в моменте." },
  { icon: (c) => UI_SVG.target(c, 28), title: "Ошибки — это план",
    text: "Неверный ответ — не приговор: вопрос попадёт в «Работу над ошибками» и вернётся сам — через день, три, неделю. Бейдж покажет, когда пора." },
  { icon: (c) => UI_SVG.sparkle(c, 28), title: "Команда видит твой рост",
    text: "«Рейтинг» показывает прогресс всех — фильтр должностей сверху, стеклянную линзу можно таскать пальцем. За ступени и собранные коктейли — печати в «Книге отзывов». А если в смене жарко — красная кнопка SOS даст шпаргалку за секунды." },
];

// Доп. 139: четыре вкладки — карточки в попапе приветствия (вместо отдельного тура)
const WELCOME_TABS_CARDS = [
  { icon: (c) => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>),
    title: "Четыре вкладки внизу",
    text: "Приложение стало проще: Учусь · Смена · Команда · Я. Всё, что было, на месте — просто у каждого раздела теперь свой дом. Прокрути и посмотри, где что." },
  { icon: (c) => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7M8 11h5"/></svg>),
    title: "Учусь — твоя программа",
    text: "Карточка «Твой трек» ведёт к следующему уроку. Ниже — Справочник (в нём же Колода бармена), SOS, Меню и Глоссарий, а дальше вся программа роли с галочками пройденного." },
  { icon: (c) => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>),
    title: "Смена — рабочий день",
    text: "График, чек-листы, задание дня и Гость недели. Открывай перед сменой — здесь всё, что пригодится сегодня." },
  { icon: (c) => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 19c0-2.5 2-4.5 4.5-4.5S23 16.5 23 19"/></svg>),
    title: "Команда и Я",
    text: "В «Команде» — рейтинг, наставничество, новички и работа над ошибками, менеджеру — аналитика и найм. В «Я» — прогресс, сертификаты, роли и настройки, включая крупный шрифт." },
];

// Доп. 140: то, чего в попапе не хватало — по замечанию владельца
const WELCOME_MORE_CARDS = [
  { icon: (c) => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17h18M5 17a7 7 0 0 1 14 0"/><path d="M12 8V6M10 6h4"/><path d="M19 3l-2 6h4l-2-6z" opacity="0.7"/></svg>),
    title: "Меню и Колода бармена",
    text: "Колода меню — как у бара: свайп по разделам, переворот, поиск, указатель, «Знаю?». Красная лента «Сегодня нет» — блюдо в стопе. Колода бармена: полсотни коктейлей, спек в мл, история и фраза гостю — и сноски, как наливают у нас." },
  { icon: (c) => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h12l4 4v12H4z"/><path d="M8 12h8M8 16h5"/><circle cx="16" cy="8" r="0.5"/></svg>),
    title: "Книга отзывов и Гость недели",
    text: "Книга — твоя летопись: страницы за роли, печати за испытания. Гость недели — живой диалог с непростым гостем, новый каждую неделю; за успех — печать." },
  { icon: (c) => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>),
    title: "SOS, чек-листы и голос",
    text: "Красная плитка SOS — шпаргалка на экстренный случай за секунду. Чек-листы смены — по пунктам с отметками. Наставнику и AI HR можно говорить голосом — микрофон в поле ввода." },
  { icon: (c) => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>),
    title: "Гид всегда под рукой",
    text: "Забыл, где что? Вкладка «Я» → «Гид по приложению»: каждая функция с объяснением и кнопкой «Открыть». Этот попап больше не покажется, гид — останется." },
];

// Доп. 169: карточка менеджера про редактор меню
const WELCOME_MENUEDIT_CARD = {
  icon: (c) => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17h18M5 17a7 7 0 0 1 14 0"/><path d="M12 8V6M10 6h4"/><path d="M4 20l1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1z" opacity="0.6"/></svg>),
  title: "Меню: редактор, стоп-лист, архив",
  text: "Меню → Редактор: импорт из PDF с проверкой аллергенов, три AI-варианта описания, предпросмотр «как увидит официант». «В стоп» — один тап, и команда видит «Сегодня нет». Удалённое — в архив, вернуть к сезону одним тапом. «Опубликовать · N» отправляет всё официантам.",
};

function WelcomeIntro({ T, a11y, isAdmin, canHire, onClose }) {
  // Порядок — путь новичка: учёба → ошибки → тренажёры → знания → наставник
  // → график → признание; менеджерам и руководству — их инструменты в конце.
  // Порядок — по вкладкам: что это → четыре вкладки → Учусь → Смена → Команда → гид
  const cards = [
    ...WELCOME_CARDS.slice(0, 2),
    ...WELCOME_TABS_CARDS,
    WELCOME_BUILD_CARD, WELCOME_REF_CARD, WELCOME_MORE_CARDS[0], WELCOME_AI_CARD,
    WELCOME_SCHED_CARD, WELCOME_MORE_CARDS[1], WELCOME_MORE_CARDS[2],
    ...WELCOME_CARDS.slice(2),
    ...(canHire ? [WELCOME_SCHEDIT_CARD, WELCOME_MENUEDIT_CARD, WELCOME_HIRE_CARD] : []),
    ...(isAdmin ? [WELCOME_ADMIN_CARD] : []),
    WELCOME_MORE_CARDS[3],
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
    background: T.lessGlass?.bg || (a11y ? "rgba(250,242,222,0.60)" : "rgba(226,186,116,0.11)"),
    border: T.lessGlass?.border || (a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)"),
    borderTop: T.lessGlass?.borderTop || (a11y ? "1px solid rgba(255,252,240,0.9)" : "1px solid rgba(255,255,255,0.20)"),
    boxShadow: T.lessGlass?.shadow || (a11y ? "inset 0 0 22px rgba(255,250,235,0.5), 0 6px 20px rgba(120,90,30,0.10)" : "inset 0 0 22px rgba(255,248,230,0.07), 0 6px 20px rgba(0,0,0,0.35)"),
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
  // Дополнение 134: история навигации — стек вместо одного шага.
  // prevScreen — вершина стека (старый код читает его как раньше), setPrevScreen — push,
  // navigate(to) — push текущего + переход, goBack() — pop. Вкладки сбрасывают стек.
  const [navStack, setNavStack] = useState([]);
  const navRef = useRef([]);                 // источник истины для push/pop
  const screenRef = useRef("roleSelect");    // текущий экран для императивных переходов
  useEffect(() => { screenRef.current = screen; if (screen !== "menuTrainer") setMenuStart(null); }, [screen]);
  const commitStack = useCallback((arr) => { navRef.current = arr; setNavStack(arr); }, []);
  const prevScreen = navStack.length ? navStack[navStack.length - 1] : null;
  const setPrevScreen = useCallback((x) => { if (x) commitStack([...navRef.current, x].slice(-24)); }, [commitStack]);
  const TAB_SCREENS = ["roleSelect", "shift", "teamHub", "me"];
  const [lessonLockMsg, setLessonLockMsg] = useState(null); // мягкое сообщение о закрытом уроке (Вариант В)
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
  // Дополнение 123: Справочник и Колода бармена ходят друг в друга, а история
  // навигации хранит один шаг — назад из Справочника вело обратно в Колоду по
  // кругу. Запоминаем экран, с которого зашли в эту пару, и выходим на него.
  const [ckStart, setCkStart] = useState(null);
  const [menuStart, setMenuStart] = useState(null);
  // Доп. 173: индикатор сети — полоска сверху, когда связи нет
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const offlineHelp = { key:"offline", icon:"mistakes", label:"Без сети", sub: online ? "Как открывать приложение без связи" : "Сейчас без связи — работаем на сохранённом", onClick:() => navigate("offline") }; // Доп. 170: открыть Колоду меню на блюде (карточка в ответе Наставника)
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
  // Празднование побед: золотая вспышка ✦ на большие моменты (экзамен).
  // null | текст; живёт полторы секунды и гаснет сама.
  const [celebrate, setCelebrate] = useState(null);
  const cheer = useCallback((text) => {
    setCelebrate(text);
    try { vibrate && vibrate("success"); } catch (e) {}
    setTimeout(() => setCelebrate(null), 1500);
  }, []);
  const [examRole, setExamRole] = useState(null); // #2 — для какой роли открыт экзамен/сертификат

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
    // Сначала ждём ленивые СПГ-модули: их уроки должны попасть в allValidIds ниже,
    // иначе при быстром ответе сервера прогресс роли СПГ отфильтруется как «неизвестные id»
    // и перезапишет localStorage без этих уроков (гонка загрузок).
    Promise.resolve().then(() =>
    fetch(`${SUPABASE_URL}/rest/v1/progress?user_id=eq.${encodeURIComponent(profile.id)}`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    })).then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return; // ошибка от Supabase — не трогаем state
      if (data.length === 0) return; // пусто — не обнуляем
      {
        // Восстанавливаем completed из Supabase — авторитетный источник
        // Доп. 132: id всех уроков всех ролей — из лёгкого индекса, ленивая загрузка ролей не влияет
        const allValidIds = new Set(allLessonIds());
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

  // Доп. 132: уроки роли приезжают лениво — грузим при смене роли, мемо зависит от версии контента
  const contentVer = useContentVersion();
  useEffect(() => { if (role) loadRoleModules(role).catch(() => {}); }, [role]);
  const modules = useMemo(() => role ? (MODULES[role] || []) : [], [role, contentVer]);
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
  const navigate = useCallback((to, opts) => {
    const cur = screenRef.current;
    if (TAB_SCREENS.includes(to)) commitStack([]);                          // вкладка — новая ветка, назад некуда
    else if (opts && opts.replace) { /* Доп. 158: замена экрана — текущий в историю не пишем (диалог → Книга) */ }
    else if (cur !== to) commitStack([...navRef.current, cur].slice(-24));  // push, без дублей при повторе
    screenRef.current = to; setScreen(to);
  }, [commitStack]);
  const goBack = useCallback((fallback = "roleSelect") => {
    const st = navRef.current.slice();
    let to = st.pop();
    while (to === screenRef.current && st.length) to = st.pop(); // защита от петель
    commitStack(st);
    const dest = to || fallback; screenRef.current = dest; setScreen(dest);
  }, [commitStack]);
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
    const shuffled = pickRandom(pool, 6).map(shuffleSituationOptions);
    const firstUsedIds = shuffled.map(s => s.scene || s.statement || s.question || JSON.stringify(s).slice(0,60));
    setPracticeState({ step: 0, choice: null, isAnswered: false, results: [], done: false, lives: 3, score: 0, combo: 0, situations: shuffled, flash: null, usedIds: firstUsedIds });
    setGameKey(k => k + 1);
    navigate("lesson");
  };
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
          // Серия — повод для золотой вспышки (7 и 30 дней)
          if (count === 7 || count === 30) setTimeout(() => cheer("Серия " + count + " дней"), 500);
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
        return [...prev, _qe].slice(-200);
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
    setMistakeBank(prev => prev.map(m => {
      if (m.q !== qText) return m;
      const stage = (m.stage || 0) + 1;
      if (stage > SR_DAYS.length) return null; // вопрос закреплён
      return { ...m, stage, due: Date.now() + SR_DAYS[stage - 1] * 24 * 3600 * 1000 };
    }).filter(Boolean));
  }, []);
  // Неверный ответ при повторе: прогресс сгорает, вопрос снова доступен сразу
  const failMistake = useCallback((qText) => {
    setMistakeBank(prev => prev.map(m => m.q === qText ? { ...m, stage: 0, due: Date.now() } : m));
  }, []);
  // Единая точка сохранения банка ошибок (персональный ключ) — как у saved/examResults.
  // Раньше три колбэка писали общий "sa_mistakes" внутри setState-апдейтеров:
  // на общем устройстве банк перетекал между сотрудниками, а в StrictMode писался дважды.
  React.useEffect(() => {
    if (!storageLoaded || !profile) return;
    try { const uk = `_${profile.name}_${profile.surname||""}`; localStorage.setItem("sa_mistakes"+uk, JSON.stringify(mistakeBank)); } catch(e) {}
  }, [mistakeBank, storageLoaded, profile]);
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
    // v3: тур большого обновления — разово покажется и давним пользователям
    try { if (localStorage.getItem("sa_welcome_seen_v6") !== "1") setWelcome(true); } catch (e) {}
  }, [profile, storageLoaded]);
  const closeWelcome = () => {
    try { localStorage.setItem("sa_welcome_seen_v6", "1"); } catch (e) {}
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
    Promise.all([role ? loadRoleModules(role) : Promise.resolve(), loadDialogues()]).then(() => bumpLazyData(x => x + 1));
    // 2) Затем тихо прогреваем ленивые экраны: пока человек смотрит на главную,
    //    их код доезжает фоном — и первое открытие любого раздела мгновенно,
    //    скелетон остаётся только для очень медленной сети в первые секунды.
    const warm = setTimeout(() => {
      [
        () => loadAllModules(), // Доп. 132: остальные роли — фоном, пока человек на главной
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
            <button style={{ ...T.a11yBtn,
              // Капелька-канон (рецепт AI-кнопки): золото вместо светофора
              background: a11y ? "rgba(139,106,48,0.12)" : "rgba(200,169,110,0.10)",
              color: a11y ? "#6B4E1A" : "#D2A85A",
              boxShadow: a11y
                ? "inset 0 0 0 1px rgba(139,106,48,0.5), inset 0 0 14px rgba(255,255,255,0.4), inset 0 1px 0 rgba(255,255,255,0.8)"
                : "inset 0 0 0 1px rgba(214,178,102,0.40), inset 0 0 14px rgba(255,230,170,0.10), inset 0 1px 0 rgba(255,255,255,0.16)" }}
              onClick={() => setA11y(!a11y)}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}>{a11y ? UI_SVG.moon("currentColor", 12) : UI_SVG.eye("currentColor", 12)}{a11y ? "Тёмная" : "Для чтения"}</span>
            </button>
          </div>
        )}

        {/* Ключ по экрану: каждый переход мягко въезжает (см. .sa-pagein в css.js) */}
        {/* Ключ включает тему: переключение «Тёмная/Для чтения» перерисовывает
            экран начисто — лечит iOS-призраки старого рендера под стеклом.
            Исключение — «Собеседование»: там живёт прогресс интервью,
            перемонтаж его уничтожил бы (тема переключается без пересборки) */}
        {celebrate ? (
          <div className="sa-celeb">
            <div className="c-core">
              {[[-96,-74],[92,-80],[-120,18],[118,26],[-58,-108],[64,96],[0,-118],[-10,104]].map(([dx, dy], i) => (
                <span key={i} className="c-spark" style={{ "--dx": dx + "px", "--dy": dy + "px", animationDelay: (i * 0.04) + "s" }}>✦</span>
              ))}
              <span style={{ color:"#D2A85A" }}>✦</span> {celebrate}
            </div>
          </div>
        ) : null}
        <div key={screen + (screen === "candidate" ? "" : (a11y ? "|r" : "|d"))} className="sa-pagein">
        {screen === "login" && <CodeLoginScreen T={S} onSuccess={handleLogin} />}
        {/* ── Книга отзывов ── */}
        {screen === "guestbook" && <Suspense fallback={<ScreenLoader T={T} />}><GuestBookScreen T={T} a11y={a11y} profile={profile} role={role} completed={completed} quizDone={quizDone} examResults={examResults} practiceStars={practiceStars} focusId={bookFocus} onBack={() => { setBookFocus(null); goBack(); }} onWeekly={() => navigate("weeklyGuest")} /></Suspense>}
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
          // Доп. 158: успех — показать печать в Книге, но диалог из истории убрать (иначе Книга ↔ диалог по кругу);
          // вышел без финала — просто назад, откуда пришёл
          if (finished === true) navigate("guestbook", { replace: true }); else goBack();
        }} pro={true} />}
        {screen === "schedule" && <Suspense fallback={<ScreenLoader T={T} />}>
          <ScheduleScreen T={T} a11y={a11y} profile={profile} onBack={() => goBack()}
            dueCount={dueMistakes} onMistakes={() => navigate("mistakes")} onChecklist={() => navigate("checklist")} />
        </Suspense>}
        {screen === "team" && profile?.is_admin && <TeamScreen T={T} profile={profile} a11y={a11y} onCandidate={() => navigate("candidate")} />}
        {screen === "candidate" && (profile?.is_admin || ["manager","senior"].includes(profile?.position)) && <Suspense fallback={<ScreenLoader T={T} />}><CandidateScreen T={T} a11y={a11y} profile={profile} customLessons={customLessons} onBack={() => navigate(profile?.is_admin ? "team" : "roleSelect")} /></Suspense>}
        {screen === "checklist" && <div style={{paddingBottom:88}}><ChecklistScreen T={T} a11y={a11y} profile={profile} onBack={() => navigate("roleSelect")} /></div>}
        {screen === "onboarding" && <div style={{paddingBottom:88}}><OnboardingScreen T={T} a11y={a11y} profile={profile} role={role} onBack={() => navigate("roleSelect")} /></div>}
        {screen === "analytics" && <div style={{paddingBottom:88}}><AnalyticsScreen T={T} a11y={a11y} profile={profile} scores={scores} onBack={() => navigate("roleSelect")} /></div>}
        {screen === "contentEditor" && <ContentEditorScreen T={T} a11y={a11y} onBack={() => { loadCustomLessons(); navigate("roleSelect"); }} />}
        {screen === "profile" && <AccountScreen profile={profile} T={T} onBack={() => goBack()} onLogout={handleLogout} onTrainingCard={() => navigate("trainingCard")} />}
        {screen === "playerDetail" && selectedPlayer && <PlayerDetailScreen player={selectedPlayer} T={T} onBack={() => navigate("stats")} />}
        {screen === "stats" && <div style={{paddingBottom:88}}><StatsScreen T={T} profile={profile} scores={scores} completedRoles={completedRoles} completed={completed} quizDone={quizDone} examResults={examResults} practiceStars={practiceStars} allProfiles={allProfiles} onBack={() => navigate("roleSelect")}
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
              if (!target.size) return { ok: false, msg: "Пустое имя — удали через «Команду»" };
              const me = toks(profile?.name, profile?.surname);
              if (me.size && (isSub(target, me) || isSub(me, target))) {
                return { ok: false, msg: "Себя удалить нельзя — попроси другого руководителя" };
              }
              const list = await rpc("admin_list_employees", { p_token: saToken() });
              if (!Array.isArray(list)) return { ok: false, msg: "Не получил список сотрудников — проверь связь" };
              const hits = list.filter(e => {
                const et = toks(e.name, e.surname);
                return et.size && (isSub(target, et) || isSub(et, target));
              });
              if (hits.length === 0) {
                // Призрак-профиль: зарегистрировался, но в «Команде» не создан
                // (или уже удалён оттуда). Доступа нет — стираем записи.
                try { await rpc("admin_reset_player", { p_token: saToken(), p_name: name, p_surname: surname || "" }); } catch (e2) {}
                setScores(prev => prev.filter(x => !(x.name === name && x.surname === surname)));
                setPracticeStars(prev => { const nx = { ...prev }; delete nx[name + "|" + (surname || "")]; return nx; });
                setAllProfiles(prev => (prev || []).filter(x => !(x.name === name && x.surname === surname)));
                return { ok: true, note: "Доступа в списке не было (профиль-призрак) — записи и результаты стёрты" };
              }
              if (hits.length > 1) return { ok: false, msg: "Нашёл несколько похожих: " + hits.slice(0, 3).map(e => (e.name + " " + (e.surname || "")).trim()).join(", ") + " — удали точечно через «Команду»" };
              const emp = hits[0];
              const res = await rpc("admin_delete_employee", { p_token: saToken(), p_employee_id: emp.id });
              if (!(res && res.ok)) return { ok: false, msg: "Сервер не подтвердил удаление" };
              // «Удалил — значит удалил ВСЁ»: следом стираем результаты той же
              // функцией, что под кнопкой «Сбросить». Чистим ОБЕ личности —
              // профильную (карточка) и из списка доступа, если написания
              // разошлись (урок Доп. 75). Сбой зачистки удаление не отменяет.
              try { await rpc("admin_reset_player", { p_token: saToken(), p_name: name, p_surname: surname || "" }); } catch (e) {}
              if (norm(emp.name + " " + (emp.surname || "")) !== norm(name + " " + (surname || ""))) {
                try { await rpc("admin_reset_player", { p_token: saToken(), p_name: emp.name, p_surname: emp.surname || "" }); } catch (e) {}
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
        {screen === "daily" && <DailyScreen mistakeTopics={mistakeBank.filter(mm => !mm.due || mm.due <= Date.now()).map(mm => mm.lessonTitle).filter(Boolean)} T={T} profile={profile} completed={completed} quizDone={quizDone} role={role} modules={modules} onBack={() => navigate("roleSelect")} onReferenceLesson={(id) => { setRefStart(id); navigate("reference"); }} onLesson={(lesson, mod) => { setActiveModule(mod); openLesson(lesson); }} />}
        {screen === "roleSelect" && <div style={{paddingBottom:88}}><RoleSelect learnOnly onCocktails={() => { setRefStart(null); setCkStart(null); navigate("cocktails"); }} scores={scores} onSchedule={() => navigate("schedule")} onSelect={selectRole} T={T} a11y={a11y} profile={profile} completedRoles={completedRoles} onLeaderboard={() => navigate("leaderboard")} onProfile={() => navigate("profile")} onStats={() => navigate("stats")} onDaily={() => navigate("daily")} onGlossary={() => navigate("glossary")} role={role} onChecklist={() => navigate("checklist")} onOnboarding={() => navigate("onboarding")} onAnalytics={() => navigate("analytics")} onReference={() => { setRefStart(null); navigate("reference"); }} onContentEditor={() => navigate("contentEditor")} onCertificates={CERTIFICATES_ENABLED ? () => navigate("certificates") : undefined} onMenuTrainer={() => navigate("menuTrainer")} onMentor={() => navigate("mentor")} onSOS={() => navigate("sos")} onAssistant={() => navigate("assistant")} onCandidate={(profile?.is_admin || ["manager","senior"].includes(profile?.position)) ? () => navigate("candidate") : null} onGuestBook={() => { setBookFocus(null); navigate("guestbook"); }} completed={completed} quizDone={quizDone} examResults={examResults} mistakeBank={mistakeBank} onContinueLesson={(l, m) => { setActiveModule(m); openLesson(l); }} onMistakes={() => navigate("mistakes")} /></div>}
        {screen === "glossary" && <div style={{paddingBottom:88}}><GlossaryScreen T={T} a11y={a11y} onBack={() => navigate("roleSelect")} color="#C8A96E" saved={saved} onToggleFav={toggleFav} onSetNote={setNote} /></div>}
        {screen === "leaderboard" && <div style={{paddingBottom:88}}><LeaderboardScreen T={T} leaderboard={leaderboard} scores={scores} profile={profile} practiceStars={practiceStars} onBack={() => navigate("roleSelect")} /></div>}
        {/* ═══ Доп. 133: вкладки-хабы. Ничего нового — только адресация существующих экранов ═══ */}
        {screen === "shift" && profile && <div style={{paddingBottom:88}}><HubScreen T={T} a11y={a11y} title="Смена" subtitle="Всё для рабочего дня" hero={<ShiftHero a11y={a11y} onOpen={() => navigate("schedule")} />} items={[
          { key:"sch", icon:"schedule", label:"График", sub:"Смены, обмены, публикации", onClick:() => navigate("schedule") },
          { key:"cl", icon:"checklist", label:"Чек-листы", sub:"Открытие, смена, закрытие", onClick:() => navigate("checklist") },
          { key:"daily", icon:"daily", label:"Задание дня", sub:"Короткая практика на сегодня", onClick:() => navigate("daily") },
          { key:"wg", icon:"guest", label:"Гость недели", sub:"Живой диалог с гостем", onClick:() => navigate("weeklyGuest") },
          role === "seasonal" && { key:"ob", icon:"onboarding", label:"Первая неделя", sub:"Твой план адаптации по дням", onClick:() => navigate("onboarding") },
        ]} /></div>}
        {screen === "teamHub" && profile && (() => {
          const staff = !!profile?.is_admin || ["manager","senior"].includes(profile?.position);
          const dueM = (mistakeBank || []).filter(m => !m.due || m.due <= Date.now()).length;
          return <div style={{paddingBottom:88}}><HubScreen T={T} a11y={a11y} title="Команда" subtitle={staff ? "Люди, цифры и найм" : "Рейтинг и наставничество"} hero={<TeamHero a11y={a11y} leaderboard={leaderboard} profile={profile} onOpen={() => navigate("leaderboard")} />} items={[
            { key:"lb", icon:"trophy", label:"Рейтинг", sub:"Очки, звёзды, место в команде", onClick:() => navigate("leaderboard") },
            { key:"mt", icon:"mentor", label:"Наставничество", sub:"Допуски и подтверждение навыков", onClick:() => navigate("mentor") },
            role !== "seasonal" && { key:"ob", icon:"onboarding", label:"Новички", sub:"План первой недели и прогресс новых сотрудников", onClick:() => navigate("onboarding") },
            { key:"mis", icon:"mistakes", label:"Работа над ошибками", sub: dueM ? `${dueM} к повторению` : "Вопросы, где ошибался", badge: dueM ? String(dueM) : null, onClick:() => navigate("mistakes") },
            staff && { key:"an", icon:"analytics", label:"Аналитика", sub:"Сводка по команде и резервная копия", onClick:() => navigate("analytics") },
            profile?.is_admin && { key:"tm", icon:"team", label:"Сотрудники", sub:"Карточки, коды, роли", onClick:() => navigate("team") },
            staff && { key:"hire", icon:"hire", label:"Собеседование", sub:"Кандидаты и AI HR", onClick:() => navigate("candidate") },
            staff && { key:"ce", icon:"edit", label:"Редактор контента", sub:"Уроки и материалы команды", onClick:() => navigate("contentEditor") },
          ]} /></div>;
        })()}
        {screen === "guide" && profile && <GuideScreen T={T} a11y={a11y} profile={profile} onBack={() => goBack("me")} onOpen={(dest) => {
          if (dest === "menu") navigate("menuTrainer");
          else if (dest === "reference") { setRefStart(null); navigate("reference"); }
          else if (dest === "cocktails") { setRefStart(null); setCkStart(null); navigate("cocktails"); }
          else if (dest === "guestbook") { setBookFocus(null); navigate("guestbook"); }
          else navigate(dest);
        }} />}
        {screen === "me" && profile && <div style={{paddingBottom:88}}><HubScreen T={T} a11y={a11y} title={profile.name} subtitle={profile.restaurant || "Service Academy"}
          hero={<MeHero a11y={a11y} streak={streak} roleLabel={ROLES.find(r => r.id === role)?.label} total={totalLessons}
            done={modules.reduce((a, m) => a + m.lessons.filter(l => l.type !== "result" && (l.type === "quiz" ? quizDone[l.id] : completed[l.id])).length, 0)}
            onOpen={() => navigate("stats")} />} items={[
          { key:"guide", icon:"book", label:"Гид по приложению", sub:"Что где и зачем — с кнопками «Открыть»", onClick:() => navigate("guide") },
          { key:"st", icon:"stats", label:"Мой прогресс", sub:"Роли, уроки, экзамены", onClick:() => navigate("stats") },
          CERTIFICATES_ENABLED && { key:"cert", icon:"cert", label:"Сертификаты", sub:"Пройденные роли — с печатью", onClick:() => navigate("certificates") },
          { key:"acc", icon:"profile", label:"Аккаунт и настройки", sub:"Тренировочная карточка, крупный шрифт, выход", onClick:() => navigate("profile") },
          { key:"roles", icon:"roles", label:"Мои роли", sub:"Сменить трек или открыть новый", onClick:() => navigate("roleSelect") },
          offlineHelp,
        ]} /></div>}
        {screen === "offline" && <OfflineScreen T={T} a11y={a11y} onBack={() => goBack("me")} />}
        {screen === "home" && <div style={{paddingBottom:88}}><HomeScreen role={ROLES.find(r=>r.id===role)} modules={MODULES[role]} completed={completed} quizDone={quizDone} progress={progress} doneCount={doneCount} totalLessons={totalLessons} onModule={openModule} onChangeRole={() => navigate("roleSelect")} T={T} streak={streak} a11y={a11y} profile={profile} onChecklist={() => navigate("checklist")} onOnboarding={() => navigate("onboarding")} onAnalytics={() => navigate("analytics")} mistakeBank={mistakeBank} onMistakes={() => navigate("mistakes")} customModules={customModules} onSearch={() => navigate("search")} /></div>}
        {screen === "mistakes" && <MistakesScreen T={T} a11y={a11y} mistakeBank={mistakeBank} onResolve={resolveMistake} onFail={failMistake} onBack={() => goBack("home")} />}
        {screen === "search" && <div style={{paddingBottom:88}}><Suspense fallback={<ScreenLoader T={T} />}><SearchScreen T={T} a11y={a11y} role={ROLES.find(r=>r.id===role)} profile={profile} modules={[...(MODULES[role] || []), ...(customModules || [])]} onOpen={(m, l) => { setActiveModule(m); openLesson(l); }} onReferenceLesson={(id) => { setRefStart(id); navigate("reference"); }} onBack={() => goBack("home")} /></Suspense></div>}
        {screen === "menuTrainer" && <div style={{paddingBottom:88}}><Suspense fallback={<ScreenLoader T={T} />}><MenuTrainerScreen startDishId={menuStart} T={T} a11y={a11y} profile={profile} onBack={() => goBack()} /></Suspense></div>}
        {screen === "cocktails" && <div style={{paddingBottom:88}}><Suspense fallback={<ScreenLoader T={T} />}><CocktailsScreen T={T} a11y={a11y} startId={ckStart} onBack={() => { setRefStart(null); setCkStart(null); goBack(); }} onBasics={(id) => { setRefStart(id); navigate("reference"); }} /></Suspense></div>}
        {screen === "trainingCard" && <Suspense fallback={<ScreenLoader T={T} />}><TrainingCardScreen T={T} a11y={a11y} profile={profile} completed={completed} quizDone={quizDone} examResults={examResults} onBack={() => navigate("profile")} /></Suspense>}
        {screen === "sos" && <div style={{paddingBottom:88}}><Suspense fallback={<ScreenLoader T={T} />}><SOSScreen T={T} a11y={a11y} onBack={() => goBack()} /></Suspense></div>}
        {lessonLockMsg && (
          <div onClick={() => setLessonLockMsg(null)} style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.45)" }}>
            <div onClick={e => e.stopPropagation()} style={{ maxWidth: 340, borderRadius: 20, padding: "22px 20px", textAlign: "center",
              background: a11y ? "rgba(250,242,222,0.96)" : "rgba(28,20,8,0.96)",
              border: a11y ? "1px solid rgba(139,106,48,0.4)" : "1px solid rgba(255,255,255,0.16)",
              boxShadow: a11y ? "inset 0 0 26px rgba(255,250,235,0.6), 0 12px 40px rgba(70,50,15,0.3)" : "inset 0 0 26px rgba(255,248,230,0.08), 0 12px 40px rgba(0,0,0,0.55)" }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>🔒</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.6, color: a11y ? "#3A2E1C" : "#EFE6D2", marginBottom: 16 }}>{lessonLockMsg}</div>
              <button onClick={() => setLessonLockMsg(null)} style={{ padding: "10px 24px", borderRadius: 999, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #C8A96E, #8B6A30)", color: "#fff", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold" }}>Понятно</button>
            </div>
          </div>
        )}
        {screen === "assistant" && <Suspense fallback={<ScreenLoader T={T} />}><AssistantScreen T={T} a11y={a11y} profile={profile}
          learner={{ position: profile?.position, roleTitle: (ROLES.find(r => r.id === role) || {}).title,
            done: doneCount, total: totalLessons, dueMistakes,
            topics: mistakeBank.filter(m => !m.due || m.due <= Date.now()).slice(0, 3).map(m => m.lessonTitle).filter(Boolean),
            todayShift: (() => { try {
              const r = JSON.parse(localStorage.getItem("sa_today_shift") || "null");
              const t = new Date();
              const key = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
              return (r && r.date === key && r.label) ? r.label : null;
            } catch (e) { return null; } })() }} onBack={() => goBack()} onNavigate={(dest) => {
          // Карточка блюда в ответе → Колода меню на этом блюде (Доп. 170)
          if (dest && typeof dest === "object" && dest.dish) {
            setMenuStart(dest.dish);
            setPrevScreen(prevScreen && prevScreen !== "assistant" ? prevScreen : "roleSelect");
            setScreen("menuTrainer");
            return;
          }
          // Карточка коктейля в ответе → колода на этом коктейле (Доп. 130)
          if (dest && typeof dest === "object" && dest.cocktail) {
            setCkStart(dest.cocktail);
            setPrevScreen(prevScreen && prevScreen !== "assistant" ? prevScreen : "roleSelect");
            setScreen("cocktails");
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
              setLessonLockMsg("Этот урок из трека, который откроется позже — когда дойдёшь до него по программе. Спрашивай меня по теме сколько угодно, а систематически изучишь его на своём уровне 😊");
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
                setPrevScreen("roleSelect"); setActiveModule(foundMod); openLesson(foundLesson);
              } else {
                setPrevScreen(prevScreen && prevScreen !== "assistant" ? prevScreen : "roleSelect");
                setScreen("roleSelect");
              }
            });
            return;
          }
          // Переход в раздел: [[go:key]]
          const ok = ["sos","glossary","leaderboard","profile","daily","checklist","reference","stats","candidate","guestbook","mentor","menu","cocktails"];
          if (ok.includes(dest)) { setPrevScreen(prevScreen && prevScreen !== "assistant" ? prevScreen : "roleSelect"); setScreen(dest === "menu" ? "menuTrainer" : dest); }
        }} /></Suspense>}
        {screen === "mentor" && <div style={{paddingBottom:88}}><Suspense fallback={<ScreenLoader T={T} />}><MentorScreen T={T} a11y={a11y} profile={profile} role={role} roleObj={ROLES.find(r=>r.id===role)} onBack={() => goBack()} /></Suspense></div>}
        {screen === "module" && <div style={{paddingBottom:88}}><NewPageBanner T={T} mod={activeModule} completed={completed} quizDone={quizDone} onOpen={() => { setBookFocus(activeModule?.id || null); navigate("guestbook"); }} /><ModuleScreen mod={activeModule} completed={completed} quizDone={quizDone} onBack={() => navigate("home")} onLesson={openLesson} T={T} /></div>}
        {/* Урок-диалог: порталом в body — внутри анимируемой обёртки переходов
            WebKit ломает position:fixed у шторки (см. фикс пути из поппапа) */}
        {screen === "lesson" && activeLesson?.type === "dialogue" && createPortal(
          <LiveDialogue key={"dlg-" + gameKey} dialogueId={activeLesson.dialogueId} T={T} color={activeModule?.color} onClose={completeLesson} pro={true} />
        , document.body)}
        {screen === "lesson" && activeLesson?.type === "build" && createPortal(
          <Suspense fallback={<ScreenLoader T={T} />}>
            <BuildRunner key={"bld-" + gameKey} buildId={activeLesson.buildId} mod={activeLesson.mod || activeModule?.id} role={activeLesson.role || role}
              T={T} color={activeModule?.color} onClose={completeLesson} onResult={recordBuildResult} />
          </Suspense>
        , document.body)}
        {screen === "lesson" && activeLesson?.type !== "dialogue" && activeLesson?.type !== "build" && <LessonScreen key={gameKey} lesson={activeLesson} color={activeModule?.color} onBack={() => navigate("module")} onComplete={completeLesson} quizState={quizState} onQuiz={handleQuiz} practiceState={practiceState} setPracticeState={setPracticeState} onPracticeChoice={handlePracticeChoice} onPracticeNext={handlePracticeNext} T={T} />}
        {screen === "roleComplete" && <RoleCompleteScreen role={ROLES.find(r=>r.id===role)} nextRole={ROLE_ORDER.indexOf(role) >= 0 ? ROLES.find(r=>r.id===ROLE_ORDER[ROLE_ORDER.indexOf(role)+1]) : undefined} T={T} onNext={() => navigate("roleSelect")} onExam={CERTIFICATES_ENABLED ? () => openExam(role) : undefined} />}
        {screen === "reference" && <Suspense fallback={<ScreenLoader T={T} />}><ReferenceSection key={refStart || "hub"} T={T} a11y={a11y} profile={profile} startLessonId={refStart} onExit={() => goBack()} onCocktails={() => { setRefStart(null); setCkStart(null); navigate("cocktails"); }} /></Suspense>}
        {screen === "certificates" && <CertificatesScreen T={T} a11y={a11y} profile={profile} completedRoles={completedRoles} examResults={examResults} completed={completed} quizDone={quizDone} onExam={openExam} onCertificate={openCertificate} onExit={() => navigate("roleSelect")} />}
        {screen === "exam" && <ExamScreen T={T} a11y={a11y} roleObj={ROLES.find(r=>r.id===examRole)} roleId={examRole} onFinish={(id, result) => { recordExam(id, result); if (result.passed) { cheer("Экзамен сдан"); openCertificate(id); } }} onExit={() => navigate("certificates")} />}
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
        {["roleSelect","home","module","leaderboard","glossary","stats","daily","playerDetail","team","shift","teamHub","me"].includes(screen) && profile && !welcome && !mistakeHint && (
          <AiFab a11y={a11y} onClick={() => navigate("assistant")} />
        )}

        {/* Нижняя навигация — только на основных экранах */}
        {!online && (
          <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:500, padding:"6px 12px calc(6px + env(safe-area-inset-top, 0px))", textAlign:"center", fontSize:12, letterSpacing:0.5,
            background: a11y ? "rgba(139,106,48,0.92)" : "rgba(60,44,16,0.92)", color:"#EFE4C8", backdropFilter:"blur(6px)" }}>
            Без сети — работаем на сохранённом, синхронизируем при появлении связи
          </div>
        )}
        {/* Доп. 133: четыре вкладки. Экран внутри раздела подсвечивает свою вкладку. */}
        {["roleSelect","home","module","leaderboard","glossary","stats","daily","playerDetail","team","shift","teamHub","me"].includes(screen) && profile && (
          <LiquidTabBar
            a11y={a11y}
            activeId={({ roleSelect:"roleSelect", home:"roleSelect", module:"roleSelect", glossary:"roleSelect", daily:"shift", shift:"shift",
                         leaderboard:"teamHub", team:"teamHub", playerDetail:"teamHub", teamHub:"teamHub", stats:"me", me:"me" })[screen] || screen}
            onTab={(id) => { if (screen !== id) vibrate("light"); navigate(id); }}
            tabs={[
              { id:"roleSelect", icon:"home",  label:"Учусь" },
              { id:"shift",      icon:"daily", label:"Смена" },
              { id:"teamHub",    icon:"team",  label:"Команда" },
              { id:"me",         icon:"stats", label:"Я" },
            ]}
          />
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
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", background: "linear-gradient(160deg, #14100A 0%, #1C1509 50%, #14110A 100%)", fontFamily: "Georgia, serif" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>{ROLE_SVG.bar("#C8A96E", 44)}</div>
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
