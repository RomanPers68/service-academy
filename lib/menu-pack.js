// lib/menu-pack.js — v193 (Доп. 518): меню для повтора — отдельным куском. Меню заведения (меню команды и примеры) тянет
// данные меню и коктейлей, викторина — разбор состава; главная грузит это после старта (import()), а не в главном коде.
//   menuNow(restaurant) — блюда заведения (то же правило, что «Колода меню» и поиск: lib/menu-dishes.js), только еда;
//   menuQday(...)       — вопросы о блюдах для «Вопроса дня» (каждый второй — из меню, lib/qday.js): сначала о тех блюдах,
//                         что пора повторить (prefer — порядок разминки), вопрос и порядок вариантов — свои на каждый день.
import { menuDishesFromStorage } from "./menu-dishes";
import { buildMenuQuiz } from "./menu-quiz";
import { safeAbsentAllergens } from "./menu-sections";   // v195 (Доп. 520)
import { allergenLabel } from "./deck-extras";
import { isFood } from "./menu-repeat";

export function menuNow(restaurant) {
  try { return restaurant ? menuDishesFromStorage(restaurant).filter(isFood) : []; } catch (e) { return []; }
}

/** Карточка блюда для разминки и перерыва: фото, раздел, состав строкой, аллергены подписями, как рассказать гостю (одна-две
 *  фразы описания, до 170 знаков). */
export function dishBrief(d) {
  if (!d) return null;
  const text = String(d.desc || d.short || "").replace(/\s+/g, " ").trim();
  let desc = "";
  for (const s of text.match(/[^.!?…]+[.!?…]*/g) || []) { if ((desc + " " + s).trim().length > 170 && desc) break; desc = (desc + " " + s.trim()).trim(); }
  if (desc.length > 170) desc = desc.slice(0, 169).replace(/\s+\S*$/, "") + "…";
  return { img: typeof d.img === "string" ? d.img : "", cat: String(d.cat || "").trim(),
    comp: (Array.isArray(d.ingredients) ? d.ingredients : []).map((x) => String(x).trim()).filter(Boolean).join(", "),
    al: (Array.isArray(d.allergens) ? d.allergens : []).filter(Boolean).map((a) => allergenLabel(a)), desc };
}

// «случай» от строки: один и тот же весь день у одного человека (FNV-1a + mulberry32)
export function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BIG8 = ["Глютен", "Рыба", "Моллюски и ракообразные", "Яйца", "Молоко", "Орехи", "Соя", "Кунжут"];
// «Есть ли в блюде «X» орехи?» — да, если аллерген отмечен; нет — только у блюда, где отмечено три и больше (меню
// размечали внимательно) и состав на него не намекает: спорить о незамеченных сливках незачем
export function allergenQuestion(d, R = Math.random) {
  const als = (d && Array.isArray(d.allergens) ? d.allergens : []).filter(Boolean);
  if (!als.length) return null;
  // v195 (Доп. 520): «нет» — только то, что не подсказывают ни состав, ни название, ни описание
  const absent = als.length >= 3 ? safeAbsentAllergens(d, BIG8) : [];
  const yes = !absent.length || R() < 0.5;
  const al = yes ? als[Math.floor(R() * als.length)] : absent[Math.floor(R() * absent.length)];
  const options = ["Да, есть", "Нет"];
  return { type: "F", dish: d.id, q: `Есть ли в блюде «${String(d.name).trim()}» ${String(al).toLowerCase()}?`, options, correct: yes ? 0 : 1,
    explanation: `${String(d.name).trim()}: аллергены ${als.join(", ").toLowerCase()}.` };
}

/**
 * Вопросы о блюдах для «Вопроса дня»: главный ингредиент, в каком блюде, какого аллергена нет, есть ли аллерген. По одному
 * на блюдо; блюда из prefer (порядок разминки: спросили, просьба руководителя, гоу-лист, новинки, пора повторить) —
 * первыми. Ответ — как вопрос теста: { q, options, correct, explanation, lessonTitle: "Меню", dish }.
 */
export function menuQday({ dishes = [], prefer = [], seed = "", max = 4 } = {}) {
  const live = (dishes || []).filter((d) => isFood(d) && !d.stop);
  if (live.length < 4) return [];
  const R = seeded(seed || "sa");
  const quiz = buildMenuQuiz(live, { total: Math.min(live.length, 40), rnd: R }).filter((q) => q.type === "A" || q.type === "B" || q.type === "C");
  const byDish = new Map();
  for (const q of quiz) if (!byDish.has(String(q.dish))) byDish.set(String(q.dish), q);
  for (const d of live) {
    const id = String(d.id);
    const f = allergenQuestion(d, R);
    if (f && (!byDish.has(id) || R() < 0.35)) byDish.set(id, f);
  }
  const rank = new Map((prefer || []).map((id, i) => [String(id), i]));
  const order = live.map((d) => String(d.id)).filter((id) => byDish.has(id));
  const first = order.filter((id) => rank.has(id)).sort((a, b) => rank.get(a) - rank.get(b));
  const rest = order.filter((id) => !rank.has(id));
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return [...first, ...rest].slice(0, max).map((id) => { const q = byDish.get(id); return { q: q.q, options: q.options, correct: q.correct, explanation: q.explanation || "", lessonTitle: "Меню", dish: q.dish }; });
}
