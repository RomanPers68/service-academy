// lib/say-check.js — «А теперь — вслух» по-настоящему (Доп. 300).
// Сравниваем, что распознал микрофон, с фразой: ключевые слова (от 4 букв, кроме
// служебных) засчитываются по основе — «уточню»/«уточнить», «секунду»/«секунды».
// Порядок слов и мелкие оговорки не важны: проверяем смысл, а не диктант.

const STOP = new Set(["это", "этот", "эта", "эти", "того", "тому", "чтобы", "если", "когда", "только", "очень", "есть",
  "будет", "может", "можно", "нужно", "пожалуйста", "сейчас", "здесь", "вашего", "ваша", "ваше", "ваши", "ваш"]);
const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9\s-]/g, " ");
const stem = (w) => (w.length > 5 ? w.slice(0, Math.max(4, w.length - 2)) : w.slice(0, 4));

export function phraseWords(phrase) {
  const out = [];
  String(phrase || "").split(/(\s+)/).forEach((tok) => {
    const clean = norm(tok).trim();
    const key = clean.length >= 4 && !STOP.has(clean) ? stem(clean) : null;
    out.push({ text: tok, key });
  });
  return out;
}

// → { words: [{text, key, hit}], hits, total, ratio, ok }
export function checkSaid(phrase, heard) {
  const words = phraseWords(phrase);
  const heardStems = new Set(norm(heard).split(/\s+/).filter((w) => w.length >= 3).map(stem));
  const heardList = [...heardStems];
  const isHit = (k) => heardStems.has(k) || heardList.some((h) => h.length >= 4 && (h.startsWith(k) || k.startsWith(h)));
  let hits = 0, total = 0;
  const seen = new Set();
  const out = words.map((w) => {
    if (!w.key) return { ...w, hit: null };
    const hit = isHit(w.key);
    if (!seen.has(w.key)) { seen.add(w.key); total++; if (hit) hits++; }
    return { ...w, hit };
  });
  const ratio = total ? hits / total : 0;
  return { words: out, hits, total, ratio, ok: total > 0 && ratio >= 0.7 };
}
