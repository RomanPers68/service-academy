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

// ── v86 (Доп. 399): по слогам — «бур-РА-та» ─────────────────────────────────────
// Слог — одна гласная. Одна согласная между гласными уходит к следующему слогу («ба-ра»), «й» остаётся с прежним.
// Из двух и больше: двойная делится пополам («про-сек-ко», «кар-пач-чо»); «й» и сонорная (р, л, м, н) первой остаются
// с прежним слогом («шам-пан-ско-е»); к следующему слогу уходит последняя согласная или привычная пара («тр», «бл»,
// «ск»…: «эс-прес-со», «ге-вюрц-тра-ми-нер», «ша-бли»), остальное — к прежнему («рис-линг», «гре-беш-ка»).
// «ь» и «ъ» держатся своей согласной. Ударный слог — заглавными.
const SON = "рлмнй";
const ONSET2 = new Set(["дз", "дж", "бр", "вр", "гр", "др", "жр", "зр", "кр", "пр", "тр", "фр", "хр", "бл", "вл", "гл", "зл", "кл", "пл", "фл", "хл", "тв", "дв", "кв", "св", "ск", "ст", "сп"]);
function cutCluster(C) {   // C — согласные между двумя гласными (по буквам с «ь»); → сколько из них остаётся с прежним слогом
  const n = C.length;
  if (n <= 1) return n === 1 && C[0].ch === "й" ? 1 : 0;
  if (C[0].ch === C[1].ch) return 1;
  const i = SON.includes(C[0].ch) ? 1 : 0, rest = n - i;
  const onset = rest >= 2 && ONSET2.has(C[n - 2].ch + C[n - 1].ch) && !C[n - 2].txt.endsWith("ь") ? 2 : rest >= 1 ? 1 : 0;
  return n - onset;
}
function sylWord(w) {
  const m = w.match(/^([^А-Яа-яЁё́]*)([А-Яа-яЁё́]+)([^А-Яа-яЁё́]*)$/);
  if (!m) return w;
  const [, pre, core, post] = m;
  const units = [];
  for (const ch of core) {
    if (ch === ACUTE) { if (units.length) units[units.length - 1].stress = true; continue; }
    const low = ch.toLowerCase();
    const last = units[units.length - 1];
    if ((low === "ь" || low === "ъ") && last && !isVow(last.ch)) { last.txt += low; continue; }
    units.push({ ch: low, txt: low, stress: false });
  }
  if (!units.some((u) => u.stress)) { const yo = units.find((u) => u.ch === "ё"); if (yo) yo.stress = true; }   // «ё» ударная сама
  const vi = units.map((u, i) => (isVow(u.ch) ? i : -1)).filter((i) => i >= 0);
  if (vi.length < 2) return pre + units.map((u) => u.txt).join("") + post;
  const cuts = [];
  for (let k = 0; k < vi.length - 1; k++) { const a = vi[k], b = vi[k + 1]; cuts.push(a + 1 + cutCluster(units.slice(a + 1, b))); }
  const parts = [];
  let s0 = 0;
  for (const c of cuts) { parts.push(units.slice(s0, c)); s0 = c; }
  parts.push(units.slice(s0));
  return pre + parts.map((p) => { const t = p.map((u) => u.txt).join(""); return p.some((u) => u.stress) ? t.toUpperCase() : t; }).join("-") + post;
}
/** Слова по слогам с ударным слогом заглавными: «Бурр+ата» → «бур-РА-та». Без русских букв или в один слог — "". */
export function syllables(s) {
  const t = stressText(s);
  if (!/[а-яё]/i.test(t)) return "";
  const out = t.split(/(\s+)/).map((w) => (/^\s+$/.test(w) ? w : w.split("-").map((p) => p.split(/([’'])/).map((x) => (/^[’']$/.test(x) ? x : sylWord(x))).join("")).join("-"))).join("");
  return out.toLowerCase() === plainText(s).toLowerCase() ? "" : out;
}
