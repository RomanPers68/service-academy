// lib/nutrition.js — КБЖУ по названию блюда (Дополнение 264).
// Меню ресторана живёт на сервере и правится менеджером, поэтому связь с таблицей —
// не по id, а по названию: работает и для встроенных примеров, и для своих блюд.

import { NUTRITION } from "../data/nutrition";

const STOP = new Set(["с", "со", "из", "в", "во", "и", "на", "по", "для", "от", "до", "под", "а", "the"]);
const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е")
  .replace(/["«»„“”'`]/g, " ")
  .replace(/\s*\((?:[^)]*)\)\s*/g, " ")              // «(с косточками)» — уточнение, не имя
  .replace(/\s*(океан блюдо|океан|блюдо)\s*$/g, " ")  // служебные хвосты выгрузки
  .replace(/[^а-яa-z0-9]+/g, " ").trim();
/** Основа слова: «креветки» и «креветка» — одно; «картофельным» и «картофель» — одно */
const stem = (w) => {
  let x = w.replace(/(ами|ями|ого|его|ому|ему|ыми|ими|ая|яя|ое|ее|ые|ие|ой|ей|ом|ем|ах|ях|ов|ев|ий|ый|а|я|ы|и|у|ю|е|о|ь)$/g, "");
  return x.length >= 3 ? x : w;
};
const toks = (s) => norm(s).split(" ").filter(w => w && !STOP.has(w)).map(stem);

const INDEX = NUTRITION.map(r => ({ r, t: toks(r.n), k: toks(r.n).slice().sort().join(" ") }));
const EXACT = new Map(INDEX.map(x => [x.k, x.r]));

/**
 * Ищет КБЖУ по названию блюда.
 * Точное совпадение по набору основ — сразу; иначе лучший по перекрытию,
 * но только если он уверенно лучше следующего (иначе «Салат с кальмаром» и
 * «Салат с кальмаром и крабом» перетягивали бы друг друга).
 * @returns {{n,out,kcal,p,f,c,score}|null}
 */
export function nutritionOf(name) {
  const t = toks(name);
  if (!t.length) return null;
  const exact = EXACT.get(t.slice().sort().join(" "));
  if (exact) return { ...exact, score: 1 };
  // Одно слово («Уха», «Чай», «Стейк») подходит слишком многим — берём только точное
  // совпадение, иначе «Чай» притягивал «Мороженое ИВАН ЧАЙ».
  if (t.length < 2) return null;
  const mine = new Set(t);
  const scored = INDEX.map(({ r, t: rt }) => {
    const rs = new Set(rt);
    let inter = 0; mine.forEach(w => { if (rs.has(w)) inter++; });
    if (!inter) return null;
    const cover = inter / mine.size;              // сколько слов блюда нашлось в таблице
    const noise = inter / rs.size;                // и наоборот — нет ли лишнего в таблице
    return { r, s: cover * 0.7 + noise * 0.3 };
  }).filter(Boolean).sort((a, b) => b.s - a.s);
  if (!scored.length) return null;
  const best = scored[0], next = scored[1];
  if (best.s < 0.62) return null;                               // слабое совпадение — лучше промолчать
  if (next && best.s - next.s < 0.06 && best.s < 0.9) return null; // два кандидата вровень — не угадываем
  return { ...best.r, score: Math.round(best.s * 100) / 100 };
}

/** Короткая строка для карточки: «220 г · 212 ккал · Б 11 · Ж 15 · У 9» */
export function nutritionLine(n) {
  if (!n) return "";
  const g = (v) => (Math.round(v * 10) / 10).toString().replace(".0", "");
  return `${n.out ? n.out + " г · " : ""}${n.kcal} ккал · Б ${g(n.p)} · Ж ${g(n.f)} · У ${g(n.c)}`;
}

/**
 * КБЖУ блюда: свои цифры менеджера важнее ведомости (Доп. 266).
 * @returns {{n,out,kcal,p,f,c,score,own?:true}|null}
 */
export function dishNutrition(d) {
  if (!d) return null;
  const num = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return isFinite(x) && x > 0 ? x : 0; };
  const kcal = num(d.kcal);
  if (kcal) return { n: d.name, out: Math.round(num(d.out)), kcal: Math.round(kcal), p: num(d.prot), f: num(d.fat), c: num(d.carb), score: 1, own: true };
  return nutritionOf(d.name);
}

