// lib/taste.js — v132 (Доп. 445): «Вкус по шкалам» у вина и крепкого. Без React и без импортов.
//
// Владелец (03.11): «Как мы сомелье можем сделать умнее?» — на одиннадцать предложений «Берём все». Сомелье подбирает пару
// по строению вина: тело, кислотность, танины, сладость, дуб (у крепкого — тело, сладость, дым, дуб, пряность), от 1 до 5;
// 0 — не знаем. ИИ заполняет шкалы для всей карты (api/wine-import, mode "taste"), руководитель проверяет: у шкал от ИИ
// пометка ai, правка руками или «Верно» её снимает. Пометка живёт внутри taste и не делает вино «непроверенным» —
// команда учит его, как раньше.
export const WINE_AXES = [["body", "Тело", "лёгкое", "плотное"], ["acid", "Кислотность", "мягкая", "яркая"], ["tannin", "Танины", "мягкие", "терпкие"],
  ["sweet", "Сладость", "сухое", "сладкое"], ["oak", "Дуб", "без дуба", "много дуба"]];
export const SPIRIT_AXES = [["body", "Тело", "лёгкое", "плотное"], ["sweet", "Сладость", "сухой", "сладкий"], ["smoke", "Дым", "без дыма", "дымный"],
  ["oak", "Дуб", "без дуба", "много дуба"], ["spice", "Пряность", "мягкий", "пряный"]];
export const axesOf = (kind) => (kind === "spirit" ? SPIRIT_AXES : WINE_AXES);
const lvl = (v) => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : 0; };

/** Шкалы из чего угодно (форма, ответ ИИ, запись): { body: 1..5 | 0, …, ai?: 1 }; ничего не известно — null. */
export function normTaste(t, kind = "wine") {
  if (!t || typeof t !== "object") return null;
  const out = {};
  let any = false;
  for (const [k] of axesOf(kind)) { out[k] = lvl(t[k]); if (out[k]) any = true; }
  if (!any) return null;
  if (t.ai) out.ai = 1;
  return out;
}
/** Сколько шкал известно. */
export const tasteN = (t, kind = "wine") => (t ? axesOf(kind).filter(([k]) => lvl(t[k])).length : 0);
/** Для Наставника и подписи: «тело 4/5 · кислотность 3/5 · танины 4/5». */
export function tasteLine(t, kind = "wine") {
  if (!t) return "";
  return axesOf(kind).filter(([k]) => lvl(t[k])).map(([k, ru]) => ru.toLowerCase() + " " + lvl(t[k]) + "/5").join(" · ");
}
/** Шкала словами: 1–2 — левое слово, 4–5 — правое, 3 — «средн…». */
export function axisWord(kind, key, v) {
  const a = axesOf(kind).find(([k]) => k === key); const n = lvl(v);
  if (!a || !n) return "";
  return n <= 2 ? a[2] : n >= 4 ? a[3] : "средне";
}
/** Правка руками или «Верно» снимает пометку ИИ. */
export const tasteConfirmed = (t) => { if (!t) return t; const { ai, ...rest } = t; return rest; };
