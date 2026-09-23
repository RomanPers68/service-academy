// ui/tokens.js
// Единый источник палитры. Меняешь цвет здесь — он меняется везде, где используется токен.
// Значения 1:1 с прежними инлайновыми, поэтому вид не меняется.
export const GOLD = "#C8A96E";
export const GOLD_LOGO = "#C8A050";
export const GOLD_SOFT = "#D4A85A";
export const GREEN = "#5DBB8A";
export const GREEN_DARK = "#2A6B45";
export const RED = "#E07878";
export const RED_DARK = "#8B3020";
export const CREAM = "#F0E8D8";
export const CREAM_SOFT = "#F2EAD8";
export const SAND = "#E8DEC8";
export const SAND_DEEP = "#DDD4C4";
export const PAPER = "#FBF5E8";
export const INK = "#2A1F0E";
export const INK_DEEP = "#1A1008";
export const BROWN = "#735F44";
export const BROWN_GOLD = "#6B4A10";
export const BROWN_NOTE = "#4A3010";
export const MUTED = "#948872";
export const MUTED_2 = "#918879";
export const MUTED_3 = "#A29679";   // контраст 4,5 на карточках (правка 170; было #686050 — 2,5)
export const CLAY = "#B09060";
export const BG_DARK = "#14110A";
export const PANEL = "#141210";
export const PANEL_2 = "#1A1612";

// Шкала скруглений интерфейса. Значения совпадают с исторически сложившимися
// в приложении — используем в новых компонентах вместо «магических чисел»:
// sm — варианты ответов и поля, md — кнопки и карточки-строки,
// lg — стеклянные плашки, xl — крупные карточки, pill — капсулы/чипсы.
export const RADIUS = { sm: 12, md: 14, lg: 18, xl: 22, pill: 999 };

// Цвет инструмента — один на иконку в ленте «под рукой» и на экран, который
// она открывает. Пока цвет задавался в двух местах, кнопка обещала сиреневый
// глоссарий, а открывался золотой. Здесь и только здесь.
export const TOOL_COLOR = {
  sp:   { dark: GOLD,      light: "#7A5D2A" },   // Справочник
  menu: { dark: "#8FB890", light: "#4E7A58" },   // Меню
  gl:   { dark: "#9B8FC4", light: "#5F5490" },   // Глоссарий
};
export const toolColor = (key, a11y) =>
  (TOOL_COLOR[key] || TOOL_COLOR.sp)[a11y ? "light" : "dark"];

// Золото как ЦВЕТ НАДПИСИ (правка 170): на креме #C8A96E даёт контраст 1,7–1,9 —
// в светлой теме берём тёмное золото. Для иконок, рамок и полос цвет прежний.
export const goldText = (light) => light ? "#7A5A1E" : GOLD;
