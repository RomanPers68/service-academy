// lib/situation-icons.js — какой значок показать у ситуации вместо эмодзи (Доп. 295).
// Эмодзи на iPhone и Android рисуются по-разному и спорят с золотыми иконками
// приложения. В данных эмодзи остаются, а на экране вместо них — линейный значок в стиле приложения:
// формат «у стола», с v75 (Доп. 388) и классический вид практики, и тексты уроков (iconForEmoji).

const BY_EMOJI = {
  "🍷": "glass", "🥂": "glass", "🍾": "glass",
  "🍽️": "dish", "🥗": "dish", "🥩": "dish", "🐟": "dish", "🛒": "dish",
  "⚠️": "alert", "🚨": "alert", "🔥": "alert", "🚗": "alert", "🎒": "alert", "🌾": "alert",
  "🆘": "sos", "😶": "sos", "😮‍💨": "sos",
  "💰": "bill", "💵": "bill", "🧾": "bill", "⚖️": "bill", "💳": "card",
  "⏱️": "clock",
  "💬": "speech", "🗣️": "speech", "📢": "speech",
  "💭": "thought", "🧠": "thought",
  "📋": "clipboard", "📝": "clipboard", "📊": "clipboard", "📐": "clipboard", "🔎": "search",
  "🌱": "sprout", "👨‍🏫": "sprout", "🧭": "sprout",
  "🔄": "team", "😴": "team",
  "🧹": "broom", "🧽": "broom",
  "🧊": "thermo", "🌡️": "thermo", "🤧": "thermo",
  "👀": "eye", "🚶": "eye",
  "⭐": "star", "🌟": "star", "🎯": "star",
  "😤": "upset", "😡": "upset", "😠": "upset", "🔴": "upset", "🟠": "upset", "😕": "upset",
  "😰": "worry", "😳": "worry", "😬": "worry", "🙂": "smile",
  "👨‍👩‍👧": "family",
  "🃏": "cards", "🔍": "search", "🔗": "link", "🎭": "mask", "⚡": "bolt",
  // Доп. 310: значки из редактора своих разделов
  "🙋": "guest", "🙋‍♀️": "guest", "🙋‍♂️": "guest", "🤝": "team",
  // v75 (Доп. 388): эмодзи в текстах уроков — строки-«стикеры» и значки в начале строки
  "🛡️": "shield", "👣": "steps", "🦶": "steps", "👋": "guest", "🧘": "smile", "🤦": "worry", "🤯": "worry", "🧼": "broom",
};
const BY_GENRE = { truefalse: "cards", find: "search", complete: "link", empathy: "mask", timer: "bolt", action: "guest", quiz: "clipboard" };

const norm = (e) => String(e || "").replace(/️/g, "").trim();
const TABLE = Object.fromEntries(Object.entries(BY_EMOJI).map(([k, v]) => [norm(k), v]));

export const SIT_ICON_KEYS = [...new Set([...Object.values(BY_EMOJI), ...Object.values(BY_GENRE)])];

// Эмодзи в начале строки урока: первое (с вариантом и склейкой через ZWJ) — по нему значок; срезаются все подряд
const EM_ONE = "\\p{Extended_Pictographic}\\uFE0F?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*";
export const LEAD_EMOJI_RE = new RegExp("^(" + EM_ONE + ")(?:\\s*" + EM_ONE + ")*\\s*", "u");
export const ONE_EMOJI_RE = new RegExp("^" + EM_ONE, "u");

// Значок для эмодзи в тексте урока или null — тогда эмодзи просто не рисуется (v75: эмодзи на экране нет)
export function iconForEmoji(e) {
  return TABLE[norm(e)] || null;
}

export function iconForSituation(sit) {
  if (!sit) return "guest";
  const hit = TABLE[norm(sit.emoji)];
  if (hit) return hit;
  return BY_GENRE[sit.genre || sit.type || "action"] || "guest";
}
