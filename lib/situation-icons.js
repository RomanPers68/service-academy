// lib/situation-icons.js — какой значок показать у ситуации вместо эмодзи (Доп. 295).
// Эмодзи на iPhone и Android рисуются по-разному и спорят с золотыми иконками
// приложения. В данных эмодзи остаются (классический вид их показывает), а формат
// «у стола» рисует вместо них линейный значок в стиле приложения.

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
};
const BY_GENRE = { truefalse: "cards", find: "search", complete: "link", empathy: "mask", timer: "bolt", action: "guest", quiz: "clipboard" };

const norm = (e) => String(e || "").replace(/️/g, "").trim();
const TABLE = Object.fromEntries(Object.entries(BY_EMOJI).map(([k, v]) => [norm(k), v]));

export const SIT_ICON_KEYS = [...new Set([...Object.values(BY_EMOJI), ...Object.values(BY_GENRE)])];

export function iconForSituation(sit) {
  if (!sit) return "guest";
  const hit = TABLE[norm(sit.emoji)];
  if (hit) return hit;
  return BY_GENRE[sit.genre || sit.type || "action"] || "guest";
}
