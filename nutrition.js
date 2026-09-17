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
  if (x.length < 3) x = w;
  for (const [from, to] of ALIAS) if (x.startsWith(from)) return to;   // «лосятина» → «лос», но «лосось» остаётся «лосос»
  return x;
};
const toks = (s) => norm(s).split(" ").filter(w => w && !STOP.has(w)).map(stem);

// Слова-категории: если они есть в строке ведомости, но не в названии блюда, это другое блюдо
// («Краб стригун» — не «Салат с крабом стригуном»).
const CATEGORY = ["салат", "суп", "буль", "борщ", "уха", "паст", "пельм", "вареник", "ролл", "морож", "десерт", "хлеб", "ассорт", "котлет", "стейк", "пицц", "сэндв", "бургер", "гедз", "димсам", "конфет", "пирог", "тарт", "торт"];
const SEAFOOD = ["краб", "кревет", "гребеш", "кальмар", "мидии", "трубач", "устриц", "осьмин", "мактр", "кукумар"];
const SEA = new Set(["морепродукт", "морепро", "морск"]);
// Домашние синонимы: в меню и в ведомости одно и то же зовут по-разному
const ALIAS = [["лосят", "лос"], ["нагге", "нагет"], ["гедз", "гедз"], ["оленин", "олен"], ["олене", "олен"]];
/** Мягкое сравнение слов: приставка, склейка («крабстригун») и одна опечатка («наггетсы») */
function wordHit(q, rt) {
  for (const w of rt) {
    if (w === q) return true;
    if (q.length >= 4 && w.length >= 4 && (w.startsWith(q) || q.startsWith(w))) return true;
    if (q.length >= 4 && w.length > q.length && w.includes(q)) return true;   // слова слиплись
    if (q.length >= 5 && Math.abs(w.length - q.length) <= 1) {                // одна опечатка
      let d = 0, i = 0, j = 0;
      while (i < q.length && j < w.length && d <= 1) { if (q[i] === w[j]) { i++; j++; } else { d++; if (q.length === w.length) { i++; j++; } else if (q.length > w.length) i++; else j++; } }
      if (d + (q.length - i) + (w.length - j) <= 1) return true;
    }
  }
  return false;
}

// Доп. 276: решения владельца там, где по названию не выбрать.
// «Камчатский краб» в ROW-BAR — это живой краб, а не «с маслом нуазет» и не «с перлотто».
const DISH_ALIAS = {
  "камчатский краб": "Живой камчатский краб",
  // Папоротника два: с луком и чесноком — одно блюдо, острый азиатский — другое.
  // В ведомости у первого опечатка в названии («с лком»), сам по себе он не находится.
  "жареный папоротник орляк с луком": "Жареный папоротник с лком и чесноком",
  "жареный папоротник с луком": "Жареный папоротник с лком и чесноком",
  "папоротник орляк с луком": "Жареный папоротник с лком и чесноком",
  "папоротник с луком и чесноком": "Жареный папоротник с лком и чесноком",
};

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
  const fixed = DISH_ALIAS[norm(name)];
  if (fixed) { const r = NUTRITION.find(x => x.n === fixed); if (r) return { ...r, score: 1 }; }
  const exact = EXACT.get(t.slice().sort().join(" "));
  if (exact) return { ...exact, score: 1 };

  // Доп. 275: меню и ведомость называют одно и то же по-разному — «Брауни» против
  // «Шоколадный брауни», «Краб стригун» против «Живой краб-стригун». Поэтому сперва
  // ищем строки, где НАЙДЕНЫ ВСЕ слова блюда, и берём самую близкую по лишним словам.
  // Название состоит из одних общих слов («Суп», «Салат», «Стейк») — не угадываем
  if (t.every(w => CATEGORY.some(c => w.startsWith(c)))) return null;
  const covered = (rt) => t.every(w => wordHit(w, rt) || (SEA.has(w) && rt.some(x => SEAFOOD.some(sf => x.startsWith(sf)))));
  const noCatClash = (rt) => !rt.some(w => CATEGORY.some(c => w.startsWith(c)) && !t.some(q => q.startsWith(w.slice(0, 4))));
  const full = INDEX.filter(({ t: rt }) => covered(rt) && noCatClash(rt))
    .map(({ r, t: rt }) => ({ r, extra: rt.filter(w => !t.some(q => wordHit(q, [w]))).length }))
    .sort((a, b) => a.extra - b.extra);
  if (full.length && (full.length === 1 || full[0].extra < full[1].extra)) return { ...full[0].r, score: 0.9 };
  if (t.length < 2) return null;                 // одно слово и без полного совпадения — не гадаем

  const mine = new Set(t);
  const scored = INDEX.map(({ r, t: rt }) => {
    if (!noCatClash(rt)) return null;            // «Чай» не должен тянуть «Мороженое ИВАН ЧАЙ»
    const rs = new Set(rt);
    let inter = 0; mine.forEach(w => { if (rs.has(w)) inter++; });
    if (!inter) return null;
    const cover = inter / mine.size;              // сколько слов блюда нашлось в таблице
    const noise = inter / rs.size;                // и наоборот — нет ли лишнего в таблице
    return { r, s: cover * 0.7 + noise * 0.3 };
  }).filter(Boolean).sort((a, b) => b.s - a.s);
  if (!scored.length) return null;
  const best = scored[0], next = scored[1];
  if (best.s < 0.72) return null;                               // Доп. 275: порог поднят — «Жареный папоротник орляк
                                                                //   с луком» цеплял азиатский вариант (0,68). Лучше пусто, чем чужие цифры.
  if (next && best.s - next.s < 0.06 && best.s < 0.9) return null; // два кандидата вровень — не угадываем
  return { ...best.r, score: Math.round(best.s * 100) / 100 };
}

/** Короткая строка: «210 г · 446 ккал · Б 24 · Ж 31 · У 19» (на порцию) */
export function nutritionLine(n) {
  if (!n) return "";
  const g = (v) => (Math.round(v * 10) / 10).toString().replace(".0", "");
  const head = n.out ? n.out + " г" : (n.unit || "порция");
  return `${head} · ${n.kcal} ккал · Б ${g(n.p)} · Ж ${g(n.f)} · У ${g(n.c)}`;
}

/**
 * КБЖУ блюда: свои цифры менеджера важнее ведомости (Доп. 266).
 * @returns {{n,out,kcal,p,f,c,score,own?:true}|null}
 */
export function dishNutrition(d) {
  if (!d) return null;
  const num = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return isFinite(x) && x > 0 ? x : 0; };
  const kcal = num(d.kcal);
  if (kcal) {
    const out = Math.round(num(d.out));                            // свои цифры менеджера — всегда на порцию
    const r = { n: d.name, out, kcal: Math.round(kcal), p: num(d.prot), f: num(d.fat), c: num(d.carb), score: 1, own: true };
    return r;
  }
  return nutritionOf(d.name);
}

