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
export const BROWN = "#7A6548";
export const BROWN_GOLD = "#6B4A10";
export const BROWN_NOTE = "#4A3010";
export const MUTED = "#948872";
export const MUTED_2 = "#756A58";
export const MUTED_3 = "#686050";
export const CLAY = "#B09060";
export const BG_DARK = "radial-gradient(130% 80% at 50% -5%, rgba(214,170,80,0.10) 0%, rgba(214,170,80,0) 55%), linear-gradient(160deg, #171208 0%, #1C1509 50%, #14110A 100%) #14110A";
export const PANEL = "#141210";
export const PANEL_2 = "#1A1612";

// Шкала скруглений интерфейса. Значения совпадают с исторически сложившимися
// в приложении — используем в новых компонентах вместо «магических чисел»:
// sm — варианты ответов и поля, md — кнопки и карточки-строки,
// lg — стеклянные плашки, xl — крупные карточки, pill — капсулы/чипсы.
export const RADIUS = { sm: 12, md: 14, lg: 18, xl: 22, pill: 999 };
