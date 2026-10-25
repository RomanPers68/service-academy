// lib/pronounce.js — v80 (Доп. 393): ударения и «как произносить».
//
// Ударение в тексте пишут двумя способами — оба понимаем:
//   «+» перед ударной гласной (как в разметке голосовых движков): «бурр+ата»;
//   заглавная ударная гласная внутри слова (так пишут от руки): «буррАта», «АмарОне».
// На экране — обычные буквы со знаком ударения над гласной (U+0301). Голосу (radio-tts) уходит то же самое.
import { PRONOUNCE } from "../data/pronounce";

const ACUTE = "\u0301";
const VOW = "аеёиоуыэюя";
const isVow = (ch) => VOW.includes(String(ch).toLowerCase());
const isUp = (ch) => ch !== ch.toLowerCase() && ch === ch.toUpperCase();

// Одно слово с заглавной ударной гласной: «буррАта», «АмарОне» → строчная гласная со знаком ударения.
// Заглавная первая буква — это просто начало имени, ударения она не значит; всё слово капсом — тоже не разметка.
function capWord(word) {
  const letters = [...word];
  if (letters.length < 2 || letters.every((ch) => !/[а-яё]/i.test(ch) || isUp(ch))) return word;
  const ups = [];
  letters.forEach((ch, i) => { if (i > 0 && isVow(ch) && isUp(ch)) ups.push(i); });
  if (ups.length !== 1) return word;
  const i = ups[0];
  return letters.map((ch, k) => (k === i ? ch.toLowerCase() + ACUTE : ch)).join("");
}

/** Текст с разметкой ударения → текст со знаком ударения (для экрана и для голоса). */
export function stressText(s) {
  const t = String(s || "");
  if (t.includes("+")) return t.replace(/\+([аеёиоуыэюяАЕЁИОУЫЭЮЯ])/g, (_, v) => v + ACUTE).replace(/\+/g, "");
  return t.replace(/[А-Яа-яЁё]+/g, capWord);
}

/** Без знаков ударения и «+»: для поиска и для голоса телефона (он знак ударения читает плохо). */
export function plainText(s) {
  return stressText(s).replace(/\u0301/g, "");
}

/** Есть ли в тексте разметка ударения (чтобы не показывать «как произносить», если ударения нет). */
export function hasStress(s) {
  return stressText(s).includes(ACUTE) || /ё/i.test(String(s || ""));
}

const norm = (s) => plainText(s).toLowerCase().replace(/ё/g, "е").replace(/[’'`]/g, "’");
const words = (s) => norm(s).split(/[^a-zа-я’]+/i).filter(Boolean);

// Слово из меню совпадает со словом словаря: то же слово или его падежная форма
// («бурратой» — «буррата»: общая основа, разница в окончании до трёх букв)
function sameWord(a, b) {
  if (a === b) return true;
  const stem = b.length > 4 ? b.replace(/[аеиоуыэюяь]+$/, "") : b;
  return stem.length >= 4 && a.startsWith(stem) && a.length - stem.length <= 3;
}

/** Словарные слова, которые встречаются в названии блюда (по-русски или в оригинале). До `max` штук. */
export function findPronounce(name, max = 2) {
  const nw = words(name);
  if (!nw.length) return [];
  const out = [];
  for (const e of PRONOUNCE) {
    const ru = words(e.w), orig = words(e.o);
    const hit = (seq) => seq.length && nw.some((_, i) => seq.every((w, k) => nw[i + k] && sameWord(nw[i + k], w)));
    if (hit(ru) || hit(orig)) { out.push(e); if (out.length >= max) break; }
  }
  return out;
}

/** Поиск по словарю: по-русски или в оригинале, без учёта ударений и регистра. */
export function searchPronounce(q, cat) {
  const s = norm(q).trim();
  return PRONOUNCE.filter((e) => (!cat || e.cat === cat) && (!s || norm(e.w).includes(s) || norm(e.o).includes(s)));
}
