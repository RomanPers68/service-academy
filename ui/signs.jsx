// ui/signs.jsx — v75 (Доп. 388): свои значки вместо эмодзи и звёздочек ✦.
// Владелец (23.10): план из трёх версий «без примет нейросети» — v73 шрифт и украшения, v74 тексты,
// v75 эмодзи и знаки-звёздочки → свои значки. Здесь — знаки, которых не было в наборах ui/icons.jsx
// и ui/table-bits.jsx: знак мастера (медаль на ленте), свой раздел ресторана (домик), корона золота,
// лавровая ветвь, Наставник («AI» в облачке, как кнопка в нижнем меню), дверь, замок, жизнь (сердце),
// песочные часы, телефон, облако, бокалы праздника, веточка гарниша, секундомер.
// Линия 1,7, скруглённые концы, 24×24 — как у остальных значков приложения. Цвет — currentColor
// или проп c; обводка задаётся на самом <svg>, CSS не нужен.
import React from "react";

const P = {
  // медаль на ленте: знак «Мастер роли» у имени, в списке мастеров и в «Пути мастера»
  master: <><circle cx="12" cy="9.2" r="6.3" /><circle cx="12" cy="9.2" r="2.3" style={{ fill: "currentColor", stroke: "none" }} /><path d="M8.6 14.5L7.1 21.3l4.9-2.3 4.9 2.3-1.5-6.8" /></>,
  // свой раздел ресторана — домик (в оглавлении трека «⌂1», «⌂2»…)
  own: <><path d="M3.6 11.2L12 4.2l8.4 7" /><path d="M6.2 9.4V19.8h11.6V9.4" /><path d="M10.2 19.8v-4.9h3.6v4.9" /></>,
  // корона: «Раунд мастера», золотая тема, печать «Золото»
  crown: <><path d="M4.6 16.6L3.3 7.9l4.9 3.6L12 5.6l3.8 5.9 4.9-3.6-1.3 8.7z" /><path d="M5 19.8h14" /></>,
  // лавровая ветвь: «Легенда» в книге отзывов, «Бог сервиса», «Легенда зала»
  // две ветви по дуге, листья залиты (на маленьком размере читается силуэтом венка)
  laurel: <>
    <path d="M10.02 18.32A7.2 7.2 0 0 1 7.37 5.88M13.98 18.32A7.2 7.2 0 0 0 16.63 5.88" />
    <path style={{ fill: "currentColor" }} strokeWidth="1" d="M7.57 17.07Q5.4 15.43 3.17 16.99Q5.34 18.63 7.57 17.07ZM5.53 14.56Q4.3 12.13 1.61 12.55Q2.84 14.98 5.53 14.56ZM4.8 11.4Q4.76 8.68 2.16 7.88Q2.2 10.6 4.8 11.4ZM5.53 8.24Q6.69 5.78 4.7 3.92Q3.54 6.38 5.53 8.24ZM7.37 5.88Q9.87 5.78 10.41 3.34Q7.91 3.45 7.37 5.88ZM16.43 17.07Q18.66 18.63 20.83 16.99Q18.6 15.43 16.43 17.07ZM18.47 14.56Q21.16 14.98 22.39 12.55Q19.7 12.13 18.47 14.56ZM19.2 11.4Q21.8 10.6 21.84 7.88Q19.24 8.68 19.2 11.4ZM18.47 8.24Q20.46 6.38 19.3 3.92Q17.31 5.78 18.47 8.24ZM16.63 5.88Q16.09 3.45 13.59 3.34Q14.13 5.78 16.63 5.88Z" />
  </>,
  // гость ушёл — дверь
  door: <><path d="M6.4 20.6V4.6a1.2 1.2 0 0 1 1.2-1.2h8.8a1.2 1.2 0 0 1 1.2 1.2v16" /><path d="M4 20.6h16" /><path d="M14.2 12.2v.6" /></>,
  lock: <><rect x="5" y="10.2" width="14" height="10.4" rx="2.2" /><path d="M8.2 10.2V7.4a3.8 3.8 0 0 1 7.6 0v2.8" /><path d="M12 14.2v2.4" /></>,
  heart: <path d="M12 20.2s-7.6-4.6-7.6-10a4.2 4.2 0 0 1 7.6-2.5 4.2 4.2 0 0 1 7.6 2.5c0 5.4-7.6 10-7.6 10z" />,
  heartFull: <path style={{ fill: "currentColor" }} d="M12 20.2s-7.6-4.6-7.6-10a4.2 4.2 0 0 1 7.6-2.5 4.2 4.2 0 0 1 7.6 2.5c0 5.4-7.6 10-7.6 10z" />,
  hourglass: <><path d="M6.6 3.4h10.8M6.6 20.6h10.8" /><path d="M7.8 3.4c0 4.2 4.2 5.4 4.2 8.6s-4.2 4.4-4.2 8.6M16.2 3.4c0 4.2-4.2 5.4-4.2 8.6s4.2 4.4 4.2 8.6" /><path d="M9.6 18.4h4.8" /></>,
  phone: <><rect x="7" y="2.8" width="10" height="18.4" rx="2.2" /><path d="M10.6 18.2h2.8" /></>,
  cloud: <path d="M7.2 18.6a4.2 4.2 0 0 1-.6-8.4 5.6 5.6 0 0 1 10.8-1.4 4.6 4.6 0 0 1-.6 9.8z" />,
  plug: <><path d="M9 2.8v4.4M15 2.8v4.4" /><path d="M6.6 7.2h10.8v3.6a5.4 5.4 0 0 1-10.8 0z" /><path d="M12 16.2v5" /></>,
  // праздник — два бокала-флюте чокаются
  party: <>
    <g transform="rotate(13 6.8 18)"><path d="M4.6 3.4h4.4" /><path d="M4.6 3.4l.5 6a1.7 1.7 0 0 0 3.4 0l.5-6" /><path d="M6.8 11.1v6.9M4.5 18h4.6" /></g>
    <g transform="rotate(-13 17.2 18)"><path d="M15 3.4h4.4" /><path d="M15 3.4l.5 6a1.7 1.7 0 0 0 3.4 0l.5-6" /><path d="M17.2 11.1v6.9M14.9 18h4.6" /></g>
  </>,
  // гарниш — долька цитруса
  garnish: <><path d="M3.4 7.8a8.6 8.6 0 0 0 17.2 0z" /><path d="M5.4 7.8a6.6 6.6 0 0 0 13.2 0" /><path d="M12 7.8l4 4M12 7.8v5.7M12 7.8l-4 4" /></>,
  stopwatch: <><circle cx="12" cy="13.4" r="7.4" /><path d="M12 13.4V9.6M10 2.8h4M12 2.8v3.2M18.2 7.2l1.4-1.4" /></>,
  // Наставник: облачко с «AI», как круглая кнопка в нижнем меню (ui/tabbar.jsx AiDisc)
  ai: <><path d="M21 11.5a8 8 0 0 1-8 8H6l-3 2.5v-10a8 8 0 0 1 8-8h2a8 8 0 0 1 8 7.5z" /><text x="12" y="14.2" textAnchor="middle" fontSize="7.5" fontWeight="bold" fontFamily="Georgia, serif" letterSpacing="0.3" style={{ fill: "currentColor", stroke: "none" }}>AI</text></>,
  // строка «пройдено»/«верно», крестик, звёзды оценки (пятиконечные — не искра ✦)
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  checkC: <><circle cx="12" cy="12" r="8.8" /><path d="M8.2 12.3l2.6 2.6 5-5.4" /></>,
  xC: <><circle cx="12" cy="12" r="8.8" /><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" /></>,
  star: <path style={{ fill: "currentColor" }} strokeWidth="1" d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.4l-5.4 3 1.2-6.1-4.5-4.2 6.1-.7z" />,
  starLine: <path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1-5.4-2.9-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8z" />,
  // свеча — серия дней (как значок «Свеча» в «Пути мастера»)
  candle: <><path d="M12 2.4c1.7 2 2.6 3.3 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.3.9-2.6 2.6-4.6z" /><path d="M12 9.6v1.4" /><rect x="8.4" y="11" width="7.2" height="9.6" rx="1.3" /><path d="M5.6 21.4h12.8" /></>,
  flame: <path d="M12.6 2.6c.3 3.1-1.7 4.6-1.7 7.2 0 1 .7 1.7 1.6 1.7s1.7-.8 1.6-2.4c1.9 1.5 3.4 3.7 3.4 6.1A5.6 5.6 0 0 1 12 20.8a5.6 5.6 0 0 1-5.6-5.6c0-4.8 4.4-6.8 6.2-12.6z" />,
  // дальше — те же линии, что в ui/icons.jsx (UI_SVG, MOD_SVG) и ui/table-bits.jsx (Ic): здесь они
  // нужны значком с currentColor рядом с текстом
  target: <><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="3.8" /><circle cx="12" cy="12" r="0.8" style={{ fill: "currentColor", stroke: "none" }} /><path d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4" /></>,
  shaker: <><path d="M10.2 2.5h3.6v1.8h-3.6z" /><path d="M8.8 4.3h6.4l-.5 3.2H9.3l-.5-3.2z" /><path d="M9 7.5h6l1.3 11.2a1.9 1.9 0 0 1-1.9 2.1H9.6a1.9 1.9 0 0 1-1.9-2.1L9 7.5z" /><path d="M8.4 12.5h7.2" /></>,
  ice: <><path d="M12 2.8l7.2 4.1v8.2L12 21.2l-7.2-4.1V6.9L12 2.8z" /><path d="M12 11.1l7.2-4.2M12 11.1L4.8 6.9M12 11.1v10.1" /></>,
  pencil: <><path d="M4 20l1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1z" /><path d="M14.5 6.5l3 3" /></>,
  moon: <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4 8.5 8.5 0 1 0 20 13.5z" />,
  rocket: <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></>,
  bulb: <><path d="M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.3 1.4 1.5 2.2h4.2c.2-.8.7-1.6 1.5-2.2A6 6 0 0 0 12 3z" /><path d="M9.5 19h5" /><path d="M10.5 21.5h3" /></>,
  dialog: <><path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.2V16.5H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z" /><circle cx="8.5" cy="11" r="0.9" style={{ fill: "currentColor", stroke: "none" }} /><circle cx="12" cy="11" r="0.9" style={{ fill: "currentColor", stroke: "none" }} /><circle cx="15.5" cy="11" r="0.9" style={{ fill: "currentColor", stroke: "none" }} /></>,
  cloche: <><path d="M4.5 16.5a7.5 7.5 0 0 1 15 0" /><path d="M2.5 16.5h19" /><path d="M12 9V7.2" /><circle cx="12" cy="6" r="1.1" /></>,
  book: <><path d="M12 6.2C10.2 4.7 7.8 4.2 5 4.2v14.6c2.8 0 5.2.5 7 2 1.8-1.5 4.2-2 7-2V4.2c-2.8 0-5.2.5-7 2z" /><path d="M12 6.2v14.6" /></>,
  gradcap: <><path d="M12 4L2.5 9 12 14l9.5-5z" /><path d="M6.5 11.4v4.4c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.4" /><path d="M21.5 9.2v4.8" /></>,
  trophy: <><path d="M8 4h8v6a4 4 0 0 1-8 0z" /><path d="M8 5.5H4.3a3.7 3.7 0 0 0 3.8 3.8M16 5.5h3.7a3.7 3.7 0 0 1-3.8 3.8" /><path d="M12 14v3.5" /><path d="M8.5 20.5h7" /><path d="M9.5 17.5h5" /></>,
  chart: <><path d="M6 20v-7M12 20V6M18 20v-10" /><path d="M3 20h18" /></>,
  refresh: <><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" /><path d="M3.5 3.5v5h5" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>,
  speech: <path d="M4.2 5.5h15.6a1.7 1.7 0 0 1 1.7 1.7v8.2a1.7 1.7 0 0 1-1.7 1.7H10.4l-4.6 3.4v-3.4H4.2a1.7 1.7 0 0 1-1.7-1.7V7.2a1.7 1.7 0 0 1 1.7-1.7z" />,
  alert: <><path d="M12 3.6l9.2 16.2H2.8z" /><path d="M12 9.8v4.6M12 17.1v.2" /></>,
  dish: <><path d="M3 17.5h18" /><path d="M5 16.5a7 7 0 0 1 14 0" /><path d="M12 9.5V8M10.4 7.8h3.2" /><path d="M5.5 20.3h13" /></>,
  search: <><circle cx="10.4" cy="10.4" r="6.2" /><path d="M15 15l5.6 5.6" /></>,
  snow: <><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" /><path d="M9.6 4.6L12 7l2.4-2.4M9.6 19.4L12 17l2.4 2.4" /></>,
  bolt: <path style={{ fill: "currentColor", stroke: "none" }} d="M13.4 2.5L4.8 13.6h6.1l-1.2 7.9 8.7-11.3h-6.2z" />,
  flag: <><path d="M5.5 21V3.6" /><path d="M5.5 4.2h11.6l-2.2 3.6 2.2 3.6H5.5" /></>,
};

export const SIGN_KEYS = Object.keys(P);

// <Sign n="master" s={14} c="#C8A96E" /> — без c берёт цвет текста (currentColor)
export function Sign({ n, s = 18, c, sw = 1.7, title, style, className }) {
  const body = P[n];
  if (!body) return null;
  const a11yProps = title ? { role: "img", "aria-label": title } : { "aria-hidden": "true", focusable: "false" };
  return (
    <svg className={className} width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" {...a11yProps}
      style={{ display: "inline-block", flexShrink: 0, verticalAlign: "-0.15em", color: c || "currentColor", ...style }}>
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  );
}

// Тот же значок строкой для CSS (mask-image / background-image): нужен там, где номер темы рисуется
// псевдоэлементом (::before { content: attr(data-n) }) — домик ставится маской, цвет берёт от текста.
const SVG_STR = {
  own: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 11.2L12 4.2l8.4 7"/><path d="M6.2 9.4V19.8h11.6V9.4"/></svg>',
};
export const signUrl = (n) => (SVG_STR[n] ? 'url("data:image/svg+xml;utf8,' + encodeURIComponent(SVG_STR[n]) + '")' : "none");

// Номер темы в оглавлении трека: цифра или домик своего раздела с номером (если своих разделов несколько).
// Текстом (для aria-label, «Дальше: …») — «свой раздел 2».
export function TopicNo({ label }) {
  const s = String(label == null ? "" : label);
  if (!s.startsWith("own")) return s;
  const n = s.slice(3);
  return <span className="sa-own-no" style={{ display: "inline-flex", alignItems: "center", gap: 1, whiteSpace: "nowrap" }}><Sign n="own" s="0.95em" sw={2.1} style={{ verticalAlign: "-0.1em" }} />{n}</span>;
}
export const topicNoText = (label) => {
  const s = String(label == null ? "" : label);
  return s.startsWith("own") ? "свой раздел" + (s.slice(3) ? " " + s.slice(3) : "") : s;
};
