// ui/line-art.jsx — v87 (Доп. 400): рисунки золотой линией для пустых мест — в стиле логотипа (тонкая линия, без
// заливки, приглушённо). Колокол у брифинга, поднос с клошем у случаев из зала, сердце у «спасибо», стол сверху у
// рассадки, микрофон у голосов шефа и сомелье, реплика со слогами у «Как произносить». Только украшение: aria-hidden.
import React from "react";

const ART = {
  // колокольчик: ручка, купол с отворотом, язычок и звон
  bell: <>
    <rect x="74" y="12" width="12" height="18" rx="6" />
    <path d="M76 30h8M80 30v2" />
    <path d="M54 76c5-2 8-8 8-20 0-15 8-24 18-24s18 9 18 24c0 12 3 18 8 20z" />
    <path d="M68 50c0-7 3-11 8-13" opacity=".6" />
    <circle cx="80" cy="82" r="4" />
    <path d="M110 42a20 20 0 0 1 5 17M118 36a30 30 0 0 1 7 27M50 42a20 20 0 0 0-5 17M42 36a30 30 0 0 0-7 27" opacity=".6" />
  </>,
  // поднос с клошем
  tray: <>
    <path d="M22 82h116" />
    <path d="M28 82c6 7 98 7 104 0" />
    <path d="M36 79h88" />
    <path d="M40 79a40 40 0 0 1 80 0" />
    <path d="M80 39v-4" />
    <circle cx="80" cy="31" r="4" />
    <path d="M54 68a26 26 0 0 1 14-16" opacity=".6" />
    <path d="M126 22v8M122 26h8M36 30v6M33 33h6" opacity=".6" />
  </>,
  // сердце и искры
  heart: <>
    <path d="M80 92s-34-20-34-44a17 17 0 0 1 34-7 17 17 0 0 1 34 7c0 24-34 44-34 44z" />
    <path d="M80 80s-22-13-22-29a11 11 0 0 1 22-5" opacity=".55" />
    <path d="M124 26l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" opacity=".7" />
    <path d="M38 30l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" opacity=".5" />
  </>,
  // стол сверху: четыре стула, тарелки и цветок
  table: <>
    <circle cx="80" cy="56" r="22" />
    <circle cx="80" cy="56" r="3.5" />
    <circle cx="80" cy="56" r="7.5" opacity=".4" />
    <circle cx="80" cy="41" r="4" opacity=".55" /><circle cx="80" cy="71" r="4" opacity=".55" />
    <circle cx="65" cy="56" r="4" opacity=".55" /><circle cx="95" cy="56" r="4" opacity=".55" />
    <rect x="70" y="20" width="20" height="10" rx="5" />
    <rect x="70" y="82" width="20" height="10" rx="5" />
    <rect x="36" y="46" width="10" height="20" rx="5" />
    <rect x="114" y="46" width="10" height="20" rx="5" />
  </>,
  // микрофон и волны голоса
  mic: <>
    <rect x="68" y="16" width="24" height="42" rx="12" />
    <path d="M68 29h24M68 37h24M68 45h24" opacity=".6" />
    <path d="M60 44v4a20 20 0 0 0 40 0v-4" />
    <path d="M80 68v14M66 82h28" />
    <path d="M110 30a14 14 0 0 1 0 20M118 24a24 24 0 0 1 0 32M50 30a14 14 0 0 0 0 20M42 24a24 24 0 0 0 0 32" opacity=".6" />
  </>,
  // реплика: слова по слогам, ударный — жирнее и со знаком ударения
  say: <>
    <path d="M40 26h80a10 10 0 0 1 10 10v30a10 10 0 0 1-10 10H76l-14 12V76H40a10 10 0 0 1-10-10V36a10 10 0 0 1 10-10z" />
    <path d="M48 52h14M98 52h14" opacity=".7" />
    <path d="M70 52h20" strokeWidth="3" />
    <path d="M80 44l6-7" />
  </>,
};
export const LINE_ARTS = Object.keys(ART);

/** Рисунок золотой линией. kind — bell | tray | heart | table | mic | say; color — золото темы. */
export function LineArt({ kind, color = "#D2A85A", size = 150, style }) {
  const p = ART[kind];
  if (!p) return null;
  return (
    <svg data-line-art={kind} width={size} height={Math.round(size * 110 / 160)} viewBox="0 0 160 110" fill="none" stroke={color} strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ display: "block", margin: "0 auto", opacity: 0.55, ...style }}>{p}</svg>
  );
}
