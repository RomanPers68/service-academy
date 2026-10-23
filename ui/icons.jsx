// ui/icons.jsx
// SVG-иконки и наборы: MM, Mm, ROLE_SVG, UI_SVG, POS_SVG, MOD_SVG, GAME_SVG,
// NAV_ICONS и регэксп MARKER_RE. Из App.jsx (4219–4233 и 4259–4569). Содержит JSX.

import React from "react";
import { Sign, SIGN_KEYS } from "./signs";

// Картинки-эмоции уроков лежат отдельно (ui/mm-images.js) и грузятся по требованию.
// MM наполняется после загрузки — старые проверки MM[id] продолжают работать.
export const MM = {};
const MM_KEYS = new Set(["star_eyes", "wave", "thumbs_up", "thumbs_down", "fingers_cross2", "serious", "pensive", "idea"]);
let _mmP = null;
export const loadMM = () => _mmP || (_mmP = import("./mm-images").then(m => { Object.assign(MM, m.MM_IMAGES); return MM; }).catch(e => { _mmP = null; throw e; }));
export function Mm({ id, size = 48, style = {} }) {
  const [, bump] = React.useState(0);
  const known = MM_KEYS.has(id);
  React.useEffect(() => { if (known && !MM[id]) { let alive = true; loadMM().then(() => { if (alive) bump(x => x + 1); }).catch(() => {}); return () => { alive = false; }; } }, [id, known]);
  if (!known) return null;
  const box = { display: "inline-block", verticalAlign: "middle", ...style };
  // пока картинка едет — пустое место того же размера, чтобы строка не прыгала
  return MM[id] ? <img src={MM[id]} width={size} height={size} decoding="async" alt="" style={box} /> : <span aria-hidden="true" style={{ ...box, width: size, height: size }} />;
}

// Вибрация — тактильная обратная связь

export const ROLE_SVG = {
  bar: (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.6 4.4h16.8L12 13.2 3.6 4.4z" />
      <path d="M12 13.2V20" />
      <path d="M8.2 20h7.6" />
      <path d="M16.6 7.4l1.9-3.6" />
      <circle cx="18.9" cy="3.2" r="1.25" />
    </svg>
  ),
  seasonal: (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21.5V13" />
      <path d="M12 13C12 9.2 9.3 6.8 4.8 6.8c0 4.4 2.7 6.2 7.2 6.2z" />
      <path d="M12 10.5c0-3.3 2.4-5.7 6.7-5.7 0 3.9-2.4 5.7-6.7 5.7z" />
    </svg>
  ),
  core: (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinejoin="round">
      <path d="M12 3.2l2.7 5.5 6.05.88-4.38 4.27 1.03 6.03L12 17.05l-5.4 2.83 1.03-6.03L3.25 9.58 9.3 8.7z" />
    </svg>
  ),
  manager: (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="3.8" />
      <circle cx="12" cy="12" r="0.8" fill={c} stroke="none" />
      <path d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4" />
    </svg>
  ),
  service_manager: (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L4 8h16z" />
      <path d="M5 10.5h14" />
      <path d="M6.5 10.5V18M12 10.5V18M17.5 10.5V18" />
      <path d="M4.5 20.5h15" />
    </svg>
  ),
  spg: (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5a7.5 7.5 0 0 1 15 0" />
      <path d="M2.5 16.5h19" />
      <path d="M5 19.5h14" />
      <path d="M12 9V6.6" />
      <circle cx="12" cy="5.3" r="1.3" />
    </svg>
  ),
  lock: (c, s=26) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="11" width="13" height="9" rx="2.2" />
      <path d="M8.5 11V8.2a3.5 3.5 0 0 1 7 0V11" />
    </svg>
  ),
};


// Интерфейсные SVG-иконки — карточки, бейджи, плитки статистики
export const UI_SVG = {
  calendar: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.4" y="5" width="17.2" height="15.6" rx="2.2" />
      <path d="M3.4 9.6h17.2M8 3.4v3.2M16 3.4v3.2" />
    </svg>
  ),
  shaker: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.2 2.5h3.6v1.8h-3.6z"/>
      <path d="M8.8 4.3h6.4l-.5 3.2H9.3l-.5-3.2z"/>
      <path d="M9 7.5h6l1.3 11.2a1.9 1.9 0 0 1-1.9 2.1H9.6a1.9 1.9 0 0 1-1.9-2.1L9 7.5z"/>
      <path d="M8.4 12.5h7.2"/>
    </svg>
  ),
  crown: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 15.5L3.6 7.6l4.9 3.3L12 5l3.5 5.9 4.9-3.3L19 15.5z" /><path d="M5 18.5h14" />
    </svg>
  ),
  pencil: (c, s=17) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1z" /><path d="M14.5 6.5l3 3" />
    </svg>
  ),
  building: (c, s=13) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L4 8h16z" /><path d="M5 10.5h14" /><path d="M6.5 10.5V18M12 10.5V18M17.5 10.5V18" /><path d="M4.5 20.5h15" />
    </svg>
  ),
  cloche: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round">
      <path d="M4.5 16.5a7.5 7.5 0 0 1 15 0" /><path d="M2.5 16.5h19" /><path d="M12 9V7.2" /><circle cx="12" cy="6" r="1.1" />
    </svg>
  ),
  book: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.2C10.2 4.7 7.8 4.2 5 4.2v14.6c2.8 0 5.2.5 7 2 1.8-1.5 4.2-2 7-2V4.2c-2.8 0-5.2.5-7 2z" /><path d="M12 6.2v14.6" />
    </svg>
  ),
  quiz: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" />
    </svg>
  ),
  gamepad: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.8" y="8" width="18.4" height="9.6" rx="4.8" /><path d="M8 10.8v3.2M6.4 12.4h3.2" />
      <circle cx="15.6" cy="11.2" r="0.85" fill={c} stroke="none" /><circle cx="18" cy="13.6" r="0.85" fill={c} stroke="none" />
    </svg>
  ),
  dialog: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.2V16.5H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z" />
      <circle cx="8.5" cy="11" r="0.9" fill={c} stroke="none" /><circle cx="12" cy="11" r="0.9" fill={c} stroke="none" /><circle cx="15.5" cy="11" r="0.9" fill={c} stroke="none" />
    </svg>
  ),
  diamond: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21L3.2 9.5 6.7 4h10.6l3.5 5.5z" /><path d="M3.2 9.5h17.6" /><path d="M8.6 9.5L12 21l3.4-11.5" />
    </svg>
  ),
  trophy: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8v6a4 4 0 0 1-8 0z" /><path d="M8 5.5H4.3a3.7 3.7 0 0 0 3.8 3.8M16 5.5h3.7a3.7 3.7 0 0 1-3.8 3.8" />
      <path d="M12 14v3.5" /><path d="M8.5 20.5h7" /><path d="M9.5 17.5h5" />
    </svg>
  ),
  gradcap: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4L2.5 9 12 14l9.5-5z" /><path d="M6.5 11.4v4.4c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.4" /><path d="M21.5 9.2v4.8" />
    </svg>
  ),
  checkCircle: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.8" /><path d="M8.2 12.3l2.6 2.6 5-5.4" />
    </svg>
  ),
  eye: (c, s=13) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" />
    </svg>
  ),
  moon: (c, s=13) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4 8.5 8.5 0 1 0 20 13.5z" />
    </svg>
  ),
  checkSquare: (c, s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" /><path d="M8.3 12.2l2.5 2.5 4.9-5.2" />
    </svg>
  ),
  xCircle: (c, s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.8" /><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" />
    </svg>
  ),
  ban: (c, s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.8" /><path d="M5.9 5.9l12.2 12.2" />
    </svg>
  ),
  pin: (c, s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4.2L6 21V4.5a1 1 0 0 1 1-1z" />
    </svg>
  ),
  target: (c, s=20) => ROLE_SVG.manager(c, s),
  star: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1-5.4-2.9-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8z" />
    </svg>
  ),
  // v75 (Доп. 388): значок-искра «sparkle» (две четырёхлучевые звёздочки) убран — примета сгенерированных
  // интерфейсов; вместо него «ai» (Наставник, ассистент), «laurel», «party», «cloche» — ui/signs.jsx
  rocket: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
  bell: (c, s=20) => ROLE_SVG.spg(c, s),
  chartLine: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><polyline points="6.5 15 11 10.5 14 13.5 20 7" /><polyline points="15.5 7 20 7 20 11.5" />
    </svg>
  ),
  barChart: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="20" x2="6" y2="13" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="18" y1="20" x2="18" y2="10" /><path d="M3 20h18" />
    </svg>
  ),
  trash: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><line x1="10" y1="11" x2="10" y2="16.5" /><line x1="14" y1="11" x2="14" y2="16.5" />
    </svg>
  ),
  lockOpen: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9.5" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.6-1.7" />
    </svg>
  ),
  inbox: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12.5h-5.5l-2 3h-5l-2-3H2" /><path d="M5.4 5.5h13.2l3.4 7v4.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V12.5z" />
    </svg>
  ),
  bulb: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.3 1.4 1.5 2.2h4.2c.2-.8.7-1.6 1.5-2.2A6 6 0 0 0 12 3z" /><path d="M9.5 19h5" /><path d="M10.5 21.5h3" />
    </svg>
  ),
  // v56 (Доп. 369): «до смены» в карточке «что сейчас» на главной
  clock: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.6 1.8" /><path d="M9.5 2.8h5" /><path d="M18.6 5.6l1.5 1.5" />
    </svg>
  ),
};
// v75 (Доп. 388): свои значки из ui/signs.jsx — тем же видом (c, s), что UI_SVG. Так их находят все места,
// где значок берут по имени (ачивки, статистика, карточка «что сейчас»): laurel, master, ai, lock, party…
for (const k of SIGN_KEYS) if (!UI_SVG[k]) UI_SVG[k] = (c, s = 20) => <Sign n={k} c={c} s={s} />;
// Иконки должностей
export const POS_SVG = { waiter: UI_SVG.cloche, hostess: (c,s)=>ROLE_SVG.spg(c,s), bartender: (c,s)=>ROLE_SVG.bar(c,s), manager: (c,s)=>ROLE_SVG.manager(c,s), senior: (c,s)=>ROLE_SVG.service_manager(c,s) };

// SVG-иконки модулей — ключ это эмодзи из данных, рисуем в цвет модуля; нет в карте — показываем эмодзи
export const MOD_SVG = {
  "🍸": (c, s=28) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.6 4.4h16.8L12 13.2 3.6 4.4z" />
      <path d="M12 13.2V20" /><path d="M8.2 20h7.6" />
      <path d="M16.6 7.4l1.9-3.6" /><circle cx="18.9" cy="3.2" r="1.25" />
    </svg>
  ),
  "🧊": (c, s=28) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.8l7.2 4.1v8.2L12 21.2l-7.2-4.1V6.9L12 2.8z" />
      <path d="M12 11.1l7.2-4.2M12 11.1L4.8 6.9M12 11.1v10.1" />
    </svg>
  ),
  "🥃": (c, s=28) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.2 5.5h11.6l-1.1 13a1.9 1.9 0 0 1-1.9 1.7H9.2a1.9 1.9 0 0 1-1.9-1.7L6.2 5.5z" />
      <path d="M7 13.2h10" />
      <path d="M10.2 9.4l1.6-1.6 1.6 1.6-1.6 1.6-1.6-1.6z" />
    </svg>
  ),
  "🍋": (c, s=28) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.4 12.6h17.2A8.6 8.6 0 0 1 12 21.2a8.6 8.6 0 0 1-8.6-8.6z" />
      <path d="M12 12.6v8.6M7.1 13.4l2.6 6.9M16.9 13.4l-2.6 6.9" />
    </svg>
  ),
  // Книга — для своих разделов из редактора контента (правка 154): раньше там было
  // эмодзи «📘», которого в наборе не было, и карточка выпадала из ряда SVG-иконок.
  "📘": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.6C10.2 5.3 7.8 4.7 4.4 4.9v13.2c3.4-.2 5.8.4 7.6 1.7 1.8-1.3 4.2-1.9 7.6-1.7V4.9c-3.4-.2-5.8.4-7.6 1.7z" />
      <path d="M12 6.6v13.2" /><path d="M7 8.6c1.2 0 2.3.2 3.2.6M7 11.8c1.2 0 2.3.2 3.2.6M16.9 8.6c-1.2 0-2.3.2-3.2.6" />
    </svg>
  ),
  "🧭": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.7" /><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" />
    </svg>
  ),
  "🧠": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.3 4.2c-1.6 0-2.9 1-3.3 2.3-1.5.2-2.7 1.5-2.7 3.1 0 .6.2 1.2.5 1.7-.5.6-.8 1.3-.8 2.1 0 1.5 1.1 2.8 2.6 3.1.3 1.6 1.7 2.8 3.4 2.8h.3V4.2z" />
      <path d="M12.7 4.2c1.6 0 2.9 1 3.3 2.3 1.5.2 2.7 1.5 2.7 3.1 0 .6-.2 1.2-.5 1.7.5.6.8 1.3.8 2.1 0 1.5-1.1 2.8-2.6 3.1-.3 1.6-1.7 2.8-3.4 2.8h-.3V4.2z" />
    </svg>
  ),
  "🚶": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.4" cy="4.3" r="1.8" />
      <path d="M13 7.5l-2 4.3 2.2 3.4-1 5.8" /><path d="M11 11.8l-1.7 3.6-2.3 2.4" />
      <path d="M13 8.2l3 1.8 1.8 2.6" /><path d="M12.6 8.5l-3.2 1.4-1.6 2.8" />
    </svg>
  ),
  "🤝": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="5" width="12" height="15.5" rx="2" /><path d="M9.5 5a2.5 2.5 0 0 1 5 0" /><path d="M9 11.5h6M9 15h4" />
    </svg>
  ),
  "🛡️": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 2.6v5c0 4.6-3 8.6-7 10.2-4-1.6-7-5.6-7-10.2v-5z" /><path d="M9.2 11.8l2.1 2.1 3.7-4" />
    </svg>
  ),
  "🚨": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4L2.8 19.5h18.4z" /><path d="M12 10.2v4.3" /><circle cx="12" cy="17" r="0.8" fill={c} stroke="none" />
    </svg>
  ),
  "👣": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round">
      <circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8.2 18H14a4 4 0 0 0 0-8h-3.5" />
    </svg>
  ),
  "🌟": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinejoin="round">
      <path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" />
    </svg>
  ),
  "🔥": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  ),
  "💬": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
    </svg>
  ),
  "🤲": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8.5" r="3.2" /><path d="M4 20c.7-3.3 3.2-5 6-5s5.3 1.7 6 5" />
      <path d="M18 3.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  ),
  "💼": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="7.5" width="17" height="12.5" rx="2" /><path d="M9 7.5V6a2.5 2.5 0 0 1 2.5-2.5h1A2.5 2.5 0 0 1 15 6v1.5" /><path d="M3.5 12.5h17" />
    </svg>
  ),
  "🍷": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3.5h8c0 5-1.5 7.8-4 7.8s-4-2.8-4-7.8z" /><path d="M12 11.3v7.7" /><path d="M8.5 20.5h7" />
    </svg>
  ),
  "👥": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round">
      <circle cx="9" cy="8.5" r="3" /><path d="M3.5 19.5c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7" />
      <circle cx="16.7" cy="9.5" r="2.4" /><path d="M16.3 14.9c2.3.2 4 1.7 4.4 4.1" />
    </svg>
  ),
  "⚖️": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4.5V19" /><path d="M9 19.5h6" /><path d="M6 7h12" />
      <path d="M6 7l-2.4 5.6a2.7 2.7 0 0 0 4.8 0z" /><path d="M18 7l-2.4 5.6a2.7 2.7 0 0 0 4.8 0z" />
    </svg>
  ),
  "📐": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20.5L20.5 4v16.5z" /><path d="M9 20.5v-2.3M13.5 20.5v-2.3M20.5 15.5h-2.3M20.5 11h-2.3" />
    </svg>
  ),
  "🔗": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 14a4 4 0 0 0 6 .4l2.4-2.4a4 4 0 1 0-5.6-5.7l-1.3 1.3" /><path d="M14 10a4 4 0 0 0-6-.4l-2.4 2.4a4 4 0 1 0 5.6 5.7l1.3-1.3" />
    </svg>
  ),
  "⚡": (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2.5L4.5 13.5h6L9 21.5l8.5-11h-6z" />
    </svg>
  ),
  "🌱": (c, s=30) => ROLE_SVG.seasonal(c, s),
  "⭐": (c, s=30) => ROLE_SVG.core(c, s),
  "🏛️": (c, s=30) => ROLE_SVG.service_manager(c, s),
  "🎓": (c, s=30) => UI_SVG.gradcap(c, s),
};

// Эмодзи-маркеры строк урока — убираются из текста и заменяются SVG при рендере
export const MARKER_RE = /^(?:☑|🚫|✅|❌|📌|🌟|🔹|[1-9]️⃣|🔵|🟢|🟡|🟠|🔴)\s*/u;

// SVG-иконки жанров практики и игровых элементов
export const GAME_SVG = {
  clap: (c, s=11) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="9.5" width="17" height="10" rx="2" /><path d="M3.5 9.5l2-5 15 2.5-1 2.5" /><path d="M8.5 5.3L10 9M13 6L14.5 9.7" />
    </svg>
  ),
  search: (c, s=11) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.3 15.3L20.5 20.5" />
    </svg>
  ),
  cards: (c, s=11) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="6.5" width="10" height="14" rx="2" transform="rotate(-8 9 13.5)" /><path d="M13 4.5l5.5 1.5-3.2 12" />
    </svg>
  ),
  mask: (c, s=11) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4.5h16v7c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9z" /><path d="M8 9.5c.7-.8 2-.8 2.7 0M13.3 9.5c.7-.8 2-.8 2.7 0" /><path d="M9 14.5c1.8 1.6 4.2 1.6 6 0" />
    </svg>
  ),
  thought: (c, s=13) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round">
      <ellipse cx="12.5" cy="8.8" rx="7.5" ry="5.6" /><circle cx="7" cy="17" r="1.5" /><circle cx="4.3" cy="20.3" r="0.9" />
    </svg>
  ),
  clock: (c, s=14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.6" /><path d="M12 7.5V12l3 2.2" />
    </svg>
  ),
  flag: (c, s=13) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 21V3.5" /><path d="M5.5 4.5h11.5L14.3 8l2.7 3.5H5.5" />
    </svg>
  ),
};

// SVG-иконки навбара — единый стиль линий, одинаковы на любом устройстве и перекрашиваются в цвет темы
// SVG-иконки формата «Сборка» (ui/build.jsx): стадии цепочки и гарниш.
// Тот же линейный стиль, что у ROLE_SVG/MOD_SVG — viewBox 24, обводка 1.7.
export const BUILD_SVG = {
  ice: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.8l7.2 4.1v8.2L12 21.2l-7.2-4.1V6.9L12 2.8z" />
      <path d="M12 11.1l7.2-4.2M12 11.1L4.8 6.9M12 11.1v10.1" />
    </svg>
  ),
  scoop: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.6 9.4a4.6 4.6 0 1 1-6.5 6.5l6.5-6.5z" />
      <path d="M15.4 8.6l4.8-4.8" />
    </svg>
  ),
  bin: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.6 6.4h14.8l-1.6 12.4a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L4.6 6.4z" />
      <path d="M7.4 6.4a4.6 4.6 0 0 1 9.2 0" />
    </svg>
  ),
  glass: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.2 5.5h11.6l-1.1 13a1.9 1.9 0 0 1-1.9 1.7H9.2a1.9 1.9 0 0 1-1.9-1.7L6.2 5.5z" />
      <path d="M7 13.2h10" />
    </svg>
  ),
  citrus: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.4 12.6h17.2A8.6 8.6 0 0 1 12 21.2a8.6 8.6 0 0 1-8.6-8.6z" />
      <path d="M12 12.6v8.6M7.1 13.4l2.6 6.9M16.9 13.4l-2.6 6.9" />
    </svg>
  ),
  sponge: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.4 9.6a3.4 3.4 0 0 1 3.4-3.4h8.4a3.4 3.4 0 0 1 3.4 3.4v4.8a3.4 3.4 0 0 1-3.4 3.4H7.8a3.4 3.4 0 0 1-3.4-3.4V9.6z" />
      <path d="M4.4 13.4h15.2" />
    </svg>
  ),
  wipe: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.6 14.4l6.2-6.2 4.6 4.6-6.2 6.2H4.6v-4.6z" />
      <path d="M13.2 5.8l2.2-2.2 5 5-2.2 2.2" />
    </svg>
  ),
  clipboard: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.6 4.4H6.8a1.8 1.8 0 0 0-1.8 1.8v12.6a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8V6.2a1.8 1.8 0 0 0-1.8-1.8h-1.8" />
      <path d="M9.4 2.8h5.2v3.2H9.4z" />
      <path d="M8.8 11.4h6.4M8.8 15.2h4.2" />
    </svg>
  ),
  eye: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.8 12S5.4 5.4 12 5.4 22.2 12 22.2 12 18.6 18.6 12 18.6 1.8 12 1.8 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  ),
  guest: (c, s=30) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7.4" r="3.6" />
      <path d="M4.8 20.6c0-3.8 3.2-6.4 7.2-6.4s7.2 2.6 7.2 6.4" />
    </svg>
  ),
  water: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4.2h10l-1.2 15a1.8 1.8 0 0 1-1.8 1.6h-4a1.8 1.8 0 0 1-1.8-1.6L7 4.2z" />
      <path d="M7.7 12.4h8.6" />
    </svg>
  ),
  wineglass: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.6 3.4h10.8v4.2a5.4 5.4 0 0 1-10.8 0V3.4z" />
      <path d="M12 13v7.4M8.4 20.4h7.2" />
    </svg>
  ),
  beerglass: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.4 7.2h9.2l-1 12.4a1.8 1.8 0 0 1-1.8 1.6h-3.6a1.8 1.8 0 0 1-1.8-1.6L7.4 7.2z" />
      <path d="M7.4 7.2c0-2.2 1.6-3.6 3.4-3.2 1-1.2 3-1.2 4 .2 1.6-.2 2.6 1 2.4 3h-9.8z" />
    </svg>
  ),
  bottle: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.4 2.6h3.2v4l2 2.6v10.6a1.6 1.6 0 0 1-1.6 1.6h-4a1.6 1.6 0 0 1-1.6-1.6V9.2l2-2.6v-4z" />
      <path d="M8.4 13.4h7.2" />
    </svg>
  ),
  box: (c, s=20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.4 7.6L12 3.4l8.6 4.2v9L12 20.8 3.4 16.6v-9z" />
      <path d="M3.4 7.6L12 11.8l8.6-4.2M12 11.8v9" />
    </svg>
  ),
  mint: (c, s=26) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21.4V9.6" />
      <path d="M12 12.4C12 8.8 9.4 6.6 5.2 6.6c0 4.2 2.6 5.8 6.8 5.8z" />
      <path d="M12 9.8c0-3.2 2.4-5.4 6.6-5.4 0 3.7-2.4 5.4-6.6 5.4z" />
    </svg>
  ),
  twist: (c, s=26) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 3.6a8.4 8.4 0 0 0 0 16.8" />
      <path d="M12 7.2a4.8 4.8 0 0 1 0 9.6" />
    </svg>
  ),
};

export const NAV_ICONS = {
  team: (c) => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="9" cy="8.5" r="3" /><path d="M3.5 19.5c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7" />
      <circle cx="16.7" cy="9.5" r="2.4" /><path d="M16.3 14.9c2.3.2 4 1.7 4.4 4.1" />
    </svg>
  ),
  home: (c) => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5" /><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5" />
    </svg>
  ),
  daily: (c) => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill={c} />
    </svg>
  ),
  glossary: (c) => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.2C10.2 4.7 7.8 4.2 5 4.2v14.6c2.8 0 5.2.5 7 2 1.8-1.5 4.2-2 7-2V4.2c-2.8 0-5.2.5-7 2z" /><path d="M12 6.2v14.6" />
    </svg>
  ),
  leaderboard: (c) => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <path d="M5.5 20v-7" /><path d="M12 20V4.5" /><path d="M18.5 20v-10" />
    </svg>
  ),
  stats: (c) => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="3.6" /><path d="M5 20.2c.9-3.7 3.7-5.6 7-5.6s6.1 1.9 7 5.6" />
    </svg>
  ),
};
