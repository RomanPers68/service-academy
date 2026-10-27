// ui/share-chat.jsx — v97 (Доп. 410): значок «в чат» для кнопок «Поделиться в чат» (Колода меню, Колода бармена,
// Справочник, урок) — тот же, что у чата (облачко со стрелкой), линией, без эмодзи.
import React from "react";

export const CHAT_SHARE_IC = (color, s = 15) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6.5L3.5 21.5V11.5A7.5 7.5 0 0 1 11 4h1.5" /><path d="M15.5 3.5h5v5M20.5 3.5l-6 6" />
  </svg>);
