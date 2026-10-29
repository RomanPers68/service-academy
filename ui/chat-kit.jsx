// ui/chat-kit.jsx — v93 (Доп. 406): общее для экрана чата (ui/chat.jsx) и умных карточек (ui/chat-cards.jsx): значки
// линией, реакции значками, должности, мелкие помощники. Вынесено из ui/chat.jsx без изменений, чтобы карточки не
// тянули весь экран (и не было круговых импортов).
import React from "react";

export const svg = (body, s = 22, sw = 2) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{body}</svg>);

export const IC = {
  back: svg(<path d="M15 5l-7 7 7 7" />, 26),
  pen: svg(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></>, 21),
  send: svg(<path d="M5 12h13M12 5l7 7-7 7" />, 20, 2.3),
  check: svg(<path d="M5 12.5l4.2 4.2L19 7" />, 21, 2.4),
  bell: svg(<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>, 21),
  down: svg(<path d="M6 9l6 6 6-6" />, 20),
  x: svg(<path d="M6 6l12 12M18 6L6 18" />, 20),
  team: svg(<><circle cx="9" cy="9" r="3" /><circle cx="16.5" cy="10" r="2.5" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 18.5a4 4 0 0 1 7 0" /></>, 22),
  star: svg(<path d="M12 4l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 15.9 7.4 18.3l.9-5.2-3.8-3.6 5.2-.7z" />, 21),
  // v108 (Доп. 421): «Спасибо коллеге» — сердце; день рождения — подарок
  thx: svg(<path d="M12 20.2s-7.6-4.6-7.6-10a4.2 4.2 0 0 1 7.6-2.5 4.2 4.2 0 0 1 7.6 2.5c0 5.4-7.6 10-7.6 10z" />, 21),
  gift: svg(<><rect x="4" y="9.5" width="16" height="10.5" rx="1.6" /><path d="M3.2 9.5h17.6M12 9.5V20" /><path d="M12 9.5C10.6 6.2 6.8 5.6 6.8 7.9S10.4 9.5 12 9.5zM12 9.5c1.4-3.3 5.2-3.9 5.2-1.6S13.6 9.5 12 9.5z" /></>, 22),
  net: svg(<><circle cx="12" cy="5.6" r="2.4" /><circle cx="5.4" cy="17.6" r="2.4" /><circle cx="18.6" cy="17.6" r="2.4" /><path d="M10.8 7.7l-4.2 7.7M13.2 7.7l4.2 7.7M7.9 17.6h8.2" /></>, 21),
  copy: svg(<><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M5 15V6a1 1 0 0 1 1-1h9" /></>, 20),
  trash: svg(<><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></>, 20),
  eye: svg(<><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.6" /></>, 20),
  reply: svg(<><path d="M10 8L5 12.5 10 17" /><path d="M5.5 12.5H14a5 5 0 0 1 5 5V19" /></>, 20),
  pin: svg(<><path d="M9.5 4h5l-.8 5.2 3.3 3.3H7l3.3-3.3z" /><path d="M12 12.5V20" /></>, 20),
  pinS: svg(<><path d="M9.5 4h5l-.8 5.2 3.3 3.3H7l3.3-3.3z" /><path d="M12 12.5V20" /></>, 14, 2.1),
  photo: svg(<><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.7" /><path d="M20.5 15.5l-4.6-4.6-8.4 8.1" /></>, 21),
  save: svg(<><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19.5h14" /></>, 21),
  plus: svg(<path d="M12 5v14M5 12h14" />, 22),
  // v93: умные действия
  more: svg(<><circle cx="12" cy="12" r="8.6" /><path d="M12 8v8M8 12h8" /></>, 22),
  give: svg(<><rect x="3.5" y="5" width="13" height="14" rx="2" /><path d="M3.5 9.5h13M7.5 3.5v3M12.5 3.5v3" /><path d="M15 15.5h6.5M18.8 12.8l2.7 2.7-2.7 2.7" /></>, 22),
  swap: svg(<><path d="M5 8.5h13M14.5 5l3.5 3.5-3.5 3.5" /><path d="M19 15.5H6M9.5 12L6 15.5 9.5 19" /></>, 22),
  task: svg(<><path d="M9 6h10M9 12h10M9 18h10" /><path d="M3.8 6.2l1.3 1.3 2.2-2.4M3.8 12.2l1.3 1.3 2.2-2.4" /><circle cx="5.3" cy="18" r="1.4" /></>, 22),
  share: svg(<><path d="M12 15V4M8 7.5L12 4l4 3.5" /><path d="M7 10.5H6a1.5 1.5 0 0 0-1.5 1.5v6.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5h-1" /></>, 22),
  poll: svg(<><path d="M5 20V12M10 20V5M15 20v-9M20 20v-5" /></>, 22),
  stop: svg(<><circle cx="12" cy="12" r="8.6" /><path d="M6 6l12 12" /></>, 22),
  brief: svg(<><rect x="5" y="4.5" width="14" height="16" rx="2" /><path d="M9 4.5V3.5h6v1M8.5 10h7M8.5 13.5h7M8.5 17h4.5" /></>, 22),
  ai: svg(<><path d="M21 11.5a8 8 0 0 1-8 8H6l-3 2.5v-10a8 8 0 0 1 8-8h2a8 8 0 0 1 8 7.5z" /><text x="12" y="14.2" textAnchor="middle" fontSize="7.5" fontWeight="bold" fontFamily="Georgia, serif" fill="currentColor" stroke="none">AI</text></>, 22, 1.7),
  dish: svg(<><path d="M4 16.5h16M5.5 16.5a6.5 6.5 0 0 1 13 0" /><path d="M12 8.5v1.5M10.5 8.5h3M3.5 19.5h17" /></>, 22),
  glass: svg(<><path d="M6 4.5h12l-6 7.5z" /><path d="M12 12v7M8.5 19.5h7" /></>, 22),
  book: svg(<><path d="M12 6.5c-2-1.6-5-2-8-1.5v13c3-.5 6-.1 8 1.5 2-1.6 5-2 8-1.5V5c-3-.5-6-.1-8 1.5z" /><path d="M12 6.5v13" /></>, 22),
  play: svg(<><circle cx="12" cy="12" r="8.6" /><path d="M10.2 8.6l5 3.4-5 3.4z" /></>, 22),
  clock: svg(<><circle cx="12" cy="12" r="8.6" /><path d="M12 7.5V12l3 2" /></>, 18),
  spark: svg(<><path d="M12 3.5l1.6 4.9 4.9 1.6-4.9 1.6L12 16.5l-1.6-4.9-4.9-1.6 4.9-1.6z" /><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>, 18),
  // v97 (Доп. 410): график («График готов», «Открыть график»), «Ищем в смену», карточка коллеги, «в чат»
  cal: svg(<><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M8 14h3M13 14h3M8 17h3" /></>, 22),
  need: svg(<><circle cx="10" cy="8" r="3.4" /><path d="M3.8 19.5a6.2 6.2 0 0 1 12.4 0" /><path d="M19 8v6M16 11h6" /></>, 22),
  person: svg(<><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></>, 22),
  tochat: svg(<><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6.5L3.5 21.5V11.5A7.5 7.5 0 0 1 11 4h1.5" /><path d="M15.5 3.5h5v5M20.5 3.5l-6 6" /></>, 22),
  // v99 (Доп. 412): поиск по переписке, упоминание, «Опаздываю»
  search: svg(<><circle cx="10.8" cy="10.8" r="6.3" /><path d="M15.6 15.6l4.6 4.6" /></>, 21),
  at: svg(<><circle cx="12" cy="12" r="3.4" /><path d="M15.4 12v1.3a2.5 2.5 0 0 0 5 0V12a8.4 8.4 0 1 0-3.3 6.7" /></>, 20),
  late: svg(<><circle cx="13.5" cy="12.5" r="7.2" /><path d="M13.5 8.6v4.1l2.6 1.6" /><path d="M2.8 9.2h2.7M1.8 12.5h2.7M2.8 15.8h2.7" /></>, 22),
};
// реакции — линией, как остальные значки (без эмодзи)
export const RP = {
  ok: <><circle cx="12" cy="12" r="8.8" /><path d="M8.2 12.3l2.6 2.6 5-5.4" /></>,
  like: <><path d="M7.6 10.6v9.2" /><path d="M14.3 6.7l-.7 3.6h4.9a1.8 1.8 0 0 1 1.7 2.3l-1.8 6a1.8 1.8 0 0 1-1.7 1.3H5.1a1.5 1.5 0 0 1-1.5-1.5v-6.1a1.5 1.5 0 0 1 1.5-1.5h2.1a1.5 1.5 0 0 0 1.3-.8l2.7-5.3a2 2 0 0 1 3.1 2z" /></>,
  heart: <path d="M12 20.2s-7.6-4.6-7.6-10a4.2 4.2 0 0 1 7.6-2.5 4.2 4.2 0 0 1 7.6 2.5c0 5.4-7.6 10-7.6 10z" />,
  lol: <><circle cx="12" cy="12" r="8.8" /><path d="M7.7 10.2l1.6-1.6 1.6 1.6M13.1 10.2l1.6-1.6 1.6 1.6" /><path d="M7.4 13.3h9.2a4.6 4.6 0 0 1-9.2 0z" /></>,
  wow: <><circle cx="12" cy="12" r="8.8" /><path d="M9.2 9.4v.8M14.8 9.4v.8" /><circle cx="12" cy="15.3" r="2.2" /></>,
  fire: <path d="M12.6 2.6c.3 3.1-1.7 4.6-1.7 7.2 0 1 .7 1.7 1.6 1.7s1.7-.8 1.6-2.4c1.9 1.5 3.4 3.7 3.4 6.1A5.6 5.6 0 0 1 12 20.8a5.6 5.6 0 0 1-5.6-5.6c0-4.8 4.4-6.8 6.2-12.6z" />,
};
export const ric = (r, s = 15) => (RP[r] ? svg(RP[r], s, s > 18 ? 1.8 : 2) : null);

export const POSN = { waiter: "Официант", hostess: "Хостес", bartender: "Бармен", senior_bartender: "Старший бармен", manager: "Менеджер", senior: "Руководящий состав",
  service_manager: "Сервис-менеджер", owner: "Владелец", admin: "Владелец", chef: "Повар" };
export const posName = (p) => POSN[p] || "";
export const stop = (e) => e.stopPropagation();
