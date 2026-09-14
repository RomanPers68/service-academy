// lib/menu-quiz.js — викторина по меню: главные ингредиенты и аллергены без спорных вариантов (Доп. 192).
// Чистые функции без React — под тесты. Используется тренажёром меню.
import { normCat } from "./menu-sections";
import { suggestAllergens } from "./menu-sections";

const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").trim();
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

// Слишком общие ингредиенты — не спрашиваем как «главное»
const GENERIC = ["соль", "перец", "масло", "оливковое масло", "растительное масло", "сливочное масло", "лук", "чеснок", "зелень", "вода", "сахар", "сироп", "соус", "специи", "пряности", "лимон", "лимонный сок", "уксус", "мука", "яйцо", "яйца", "сливки", "сметана", "укроп", "петрушка", "кинза", "микрозелень", "зелёное масло", "зеленое масло", "пудра", "кунжут", "кунжут ким чи", "крошка", "чипсы", "хлеб"];

/** Имя ингредиента без пояснений в скобках и количеств: «Паштет из осьминога (осьминог, лук)» → «Паштет из осьминога» */
export const ingName = (s) => String(s || "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\d+\s*(г|гр|мл|шт)\b/gi, "").replace(/\s+/g, " ").trim();

/** Главные ингредиенты блюда: первые 3 непустых, не общие, не длиннее 3 слов */
export function keyIngredients(d) {
  const out = [];
  const dn = norm(d.name);
  for (const raw of d.ingredients || []) {
    let n = ingName(raw);
    // «Паштет из осьминога (осьминог, лук, сливки)» у блюда «Паштет из осьминога» — главное внутри скобок
    if (norm(n) && (norm(n) === dn || dn.includes(norm(n)) || norm(n).includes(dn))) {
      const inner = (String(raw).match(/\(([^)]*)\)/) || [])[1];
      const first = inner ? inner.split(",").map(x => x.trim()).filter(Boolean).find(x => !GENERIC.some(g => norm(x) === g)) : null;
      if (first) n = first;
    }
    const k = norm(n);
    if (!n || n.split(" ").length > 3 || n.length > 28) continue;
    if (GENERIC.some(g => k === g || k.startsWith(g + " "))) continue;
    if (out.some(x => norm(x) === k)) continue;
    out.push(n);
    if (out.length >= 3) break;
  }
  return out;
}

/** Главный ингредиент назван в самом названии блюда («Сельдь олюторская» → сельдь): спрашивать очевидное не надо */
export const mainInName = (d, ing) => { const dn = norm(d.name); const w = norm(ing); return !!w && (dn.includes(stemOf(w.split(" ")[0])) ); };

/** Есть ли слово где-либо в блюде (состав целиком, включая скобки, название, описание) */
const stemOf = (w) => w.length > 6 ? w.slice(0, -2) : w.length > 4 ? w.slice(0, -1) : w;
const dishHas = (d, phrase) => {
  const text = norm([d.name, ...(d.ingredients || []), d.desc, d.note].filter(Boolean).join(" · "));
  const words = norm(phrase).split(/[^а-яa-z0-9]+/).filter(w => w.length >= 4);
  if (!words.length) return true;
  // любое значимое слово фразы встречается в блюде → фраза не годится как «неправильный» вариант
  return words.some(w => text.includes(stemOf(w)));
};

/**
 * Собирает викторину. Типы вопросов:
 *  A «Главный ингредиент блюда „X“?» — правильный: первый ключевой ингредиент; неправильные — ключевые
 *    ингредиенты ДРУГИХ блюд (лучше — того же раздела), которых нигде нет в блюде X.
 *  B «В каком блюде главный ингредиент — „Y“?» — обратный; неправильные — блюда без Y где бы то ни было.
 *  C «Какого аллергена НЕТ в „X“?» — только блюда с ≥3 отмеченными аллергенами; «отсутствующий» аллерген
 *    не отмечен И не подсказывается составом (ALLERGEN_HINTS), чтобы не спорить про незамеченные сливки.
 *  D «В каком разделе меню „X“?» — для новичков, немного.
 *  E «К какому блюду рекомендуем „…“?» — только конкретные сочетания (не «подаётся отдельно»), уникальные.
 * Квоты: A×4, B×3, C×2, D×1 (E — если не хватает). Одно блюдо — не чаще одного раза за викторину.
 */
export function buildMenuQuiz(dishesIn, opts = {}) {
  const total = opts.total || 10;
  const dishes = (dishesIn || []).filter(d => d && d.name && !d.stop && !d.archived);
  if (dishes.length < 4) return [];
  const cats = new Map(); dishes.forEach(d => { const c = normCat(d.cat) || "—"; if (!cats.has(c)) cats.set(c, []); cats.get(c).push(d); });
  const keyOf = new Map(dishes.map(d => [d.id, keyIngredients(d)]));
  const A = [], B = [], C = [], D = [], E = [];

  for (const d of shuffle(dishes)) {
    const keys = keyOf.get(d.id); if (!keys.length) continue;
    const main = keys[0];
    const obvious = mainInName(d, main);              // «Сельдь олюторская» → сельдь: вместо этого спросим про гарнир
    const aTarget = obvious ? keys[1] : main;
    // кандидаты-обманки: ключевые ингредиенты других блюд, сначала своего раздела
    const same = (cats.get(normCat(d.cat) || "—") || []).filter(x => x.id !== d.id);
    const rest = dishes.filter(x => x.id !== d.id && !same.includes(x));
    const pool = [...shuffle(same), ...shuffle(rest)].flatMap(x => keyOf.get(x.id) || []);
    const seen = new Set([norm(main)]); const wrong = [];
    for (const w of pool) { const k = norm(w); if (seen.has(k) || dishHas(d, w)) continue; seen.add(k); wrong.push(w); if (wrong.length === 3) break; }
    if (aTarget && wrong.length === 3) {
      const options = shuffle([aTarget, ...wrong]);
      A.push({ type: "A", dish: d.id, q: obvious ? `Что подаём в блюде «${d.name}» кроме ${main.toLowerCase()}?` : `Главный ингредиент блюда «${d.name}»?`, options, correct: options.indexOf(aTarget),
        explanation: `${d.name}: ${keys.join(", ")}${(d.allergens || []).length ? ` · аллергены: ${d.allergens.join(", ")}` : ""}` });
    }
    // B: обратный — блюда, где этого ингредиента нет нигде
    if (obvious) { /* «в каком блюде главный — сельдь» → ответ в названии; пропускаем */ }
    const others = obvious ? [] : shuffle(dishes.filter(x => x.id !== d.id && !dishHas(x, main)));
    const sameFirst = [...others.filter(x => normCat(x.cat) === normCat(d.cat)), ...others.filter(x => normCat(x.cat) !== normCat(d.cat))].slice(0, 3);
    if (sameFirst.length === 3) {
      const options = shuffle([d, ...sameFirst]);
      B.push({ type: "B", dish: d.id, q: `В каком блюде главный ингредиент — «${main}»?`, options: options.map(x => x.name), correct: options.indexOf(d),
        explanation: `${d.name}: ${keys.join(", ")}` });
    }
    // C: какого аллергена нет
    const als = d.allergens || [];
    if (als.length >= 3) { // три отмеченных + один отсутствующий = четыре варианта
      const hinted = new Set(suggestAllergens(d.ingredients || [], []).map(h => h.allergen));
      const absent = shuffle(["Глютен", "Рыба", "Моллюски и ракообразные", "Яйца", "Молоко", "Орехи", "Соя", "Кунжут"].filter(a => !als.includes(a) && !hinted.has(a)));
      if (absent.length) {
        const present = shuffle(als).slice(0, 3); const miss = absent[0];
        const options = shuffle([miss, ...present]);
        C.push({ type: "C", dish: d.id, q: `Какого аллергена НЕТ в блюде «${d.name}»?`, options, correct: options.indexOf(miss),
          explanation: `${d.name} — аллергены: ${als.join(", ")}. «${miss}» в составе нет.` });
      }
    }
    // D: раздел
    const otherCats = shuffle([...cats.keys()].filter(c => c !== (normCat(d.cat) || "—") && c !== "—")).slice(0, 3);
    if (normCat(d.cat) && otherCats.length === 3) {
      const options = shuffle([normCat(d.cat), ...otherCats]);
      D.push({ type: "D", dish: d.id, q: `В каком разделе меню «${d.name}»?`, options, correct: options.indexOf(normCat(d.cat)), explanation: `${d.name} — раздел «${normCat(d.cat)}»` });
    }
    // E: конкретное сочетание
    const p = String(d.pairing || "").trim();
    if (p.length > 12 && !/подаётся отдельно|подается отдельно|нет|—/i.test(p)) {
      const foreign = shuffle(dishes.filter(x => x.id !== d.id && String(x.pairing || "").trim() && norm(x.pairing) !== norm(p))).slice(0, 3);
      if (foreign.length === 3) {
        const options = shuffle([d, ...foreign]);
        E.push({ type: "E", dish: d.id, q: `К какому блюду рекомендуем: «${p}»?`, options: options.map(x => x.name), correct: options.indexOf(d), explanation: d.desc || d.short || "" });
      }
    }
  }

  // Квоты + одно блюдо не чаще раза
  const used = new Set(); const out = [];
  const take = (arr, n) => { for (const q of arr) { if (out.length >= total || n <= 0) break; if (used.has(q.dish)) continue; used.add(q.dish); out.push(q); n--; } };
  take(A, 4); take(B, 3); take(C, 2); take(D, 1);
  if (out.length < total) take([...A, ...B, ...C, ...E, ...D], total - out.length);
  return shuffle(out).slice(0, total);
}
