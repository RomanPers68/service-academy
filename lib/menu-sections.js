// lib/menu-sections.js — разделы меню: порядок, группировка, поиск (Доп. 156).
// Чистые функции без React — их проверяют тесты и использует тренажёр меню.
// Канонический порядок разделов; остальные — по алфавиту после них; без раздела — в конце.
export const CAT_ORDER = ["Холодные закуски", "Закуски", "Горячие закуски", "Салаты", "Супы", "Горячие блюда", "Стейки", "Гриль", "Паста", "Роллы", "Сашими", "Крабы", "Морепродукты", "Гарниры", "Десерты", "Напитки"];
export const normCat = (c) => String(c || "").trim();
export const NO_CAT = "Без раздела";
const catRank = (c) => { const n = normCat(c); if (!n || n === NO_CAT) return 999; const i = CAT_ORDER.findIndex(x => x.toLowerCase() === n.toLowerCase()); return i < 0 ? 500 : i; };
export function groupByCat(dishes) {
  const map = new Map();
  for (const d of dishes) { const k = normCat(d.cat) || NO_CAT; if (!map.has(k)) map.set(k, []); map.get(k).push(d); }
  return [...map.entries()].sort((a, b) => catRank(a[0]) - catRank(b[0]) || a[0].localeCompare(b[0], "ru")).map(([cat, items]) => ({ cat, items }));
}
export const dishMatches = (d, q) => {
  const s = q.trim().toLowerCase().replace(/ё/g, "е"); if (!s) return true;
  const hay = [d.name, d.cat, d.desc, d.note, d.pairing, ...(d.ingredients || []), ...(d.allergens || [])].join(" ").toLowerCase().replace(/ё/g, "е");
  return hay.includes(s);
};

// ── Доп. 163: подсказки аллергенов по составу ─────────────────────────────────
// Ключевые слова → аллерген из списка приложения. Не заменяют менеджера — подсвечивают, что проверить.
export const ALLERGEN_HINTS = {
  "Глютен": ["пшениц", "мука", "мук", "хлеб", "паст", "лапш", "панировк", "булк", "тест", "кускус", "булгур", "ячмен", "ржан", "овс", "сухар", "гренк", "тортиль", "лаваш", "пельмен", "равиол", "нудл", "круассан", "бриош", "пирог", "тарт"],
  "Рыба": ["лосос", "тунец", "тунц", "форел", "сибас", "дорад", "треск", "палтус", "скумбри", "сельд", "анчоус", "рыб", "икр", "угор", "судак", "окун", "камбал", "кет", "нерк", "горбуш", "сёмг", "семг", "ворчестер", "вустер", "нам пла", "рыбный соус"],
  "Моллюски и ракообразные": ["креветк", "краб", "устриц", "миди", "кальмар", "осьминог", "гребеш", "лангуст", "омар", "лобстер", "ракообраз", "моллюск", "вонгол", "морепродукт", "улитк", "устричн"],
  "Яйца": ["яйц", "яич", "майонез", "меренг", "безе", "айоли", "голландез", "карбонар", "омлет", "тартар соус"],
  "Молоко": ["молок", "сливк", "сыр", "сливочн", "творог", "йогурт", "сметан", "пармезан", "моцарелл", "маскарпон", "фета", "бри", "страчател", "буррат", "рикотт", "кефир", "бешамель", "чеддер", "горгонзол", "дорблю", "сулугун", "брынз", "халлуми", "панир", "гхи", "молочн"],
  "Орехи": ["орех", "миндал", "фундук", "кешью", "фисташк", "пекан", "грецк", "арахис", "песто", "кедров", "макадам", "марципан", "пралине", "нутелл"],
  "Соя": ["соя", "соев", "тофу", "эдамам", "мисо", "терияки", "темпе"],
  "Кунжут": ["кунжут", "сезам", "тахини", "хумус", "гомасио"],
};
export function suggestAllergens(ingredients, chosen = []) {
  const text = (Array.isArray(ingredients) ? ingredients.join(" ") : String(ingredients || "")).toLowerCase().replace(/ё/g, "е");
  const out = [];
  for (const [al, keys] of Object.entries(ALLERGEN_HINTS)) {
    if (chosen.includes(al)) continue;
    const hit = keys.find(k => text.includes(k.replace(/ё/g, "е")));
    if (hit) out.push({ allergen: al, because: hit });
  }
  return out;
}

/**
 * v195 (Доп. 520): каких аллергенов в блюде точно нет — для вопросов и ответов «нет». Не отмечен, не подсказан ни
 * составом, ни названием, ни описанием («Сырники» — молоко, «Паста» — глютен), и о блюде вообще что-то записано
 * (отмечен хоть один аллерген или есть состав). Иначе «нет» — догадка по пустой карточке: верное «есть» засчиталось бы
 * ошибкой, а гостю ушёл бы неверный ответ.
 */
export function safeAbsentAllergens(d, list = Object.keys(ALLERGEN_HINTS)) {
  if (!d) return [];
  const als = Array.isArray(d.allergens) ? d.allergens.filter(Boolean) : [];
  const ings = Array.isArray(d.ingredients) ? d.ingredients.filter((x) => String(x || "").trim()) : [];
  if (!als.length && !ings.length) return [];
  const hinted = new Set(suggestAllergens([d.name, ...ings, d.desc, d.note, d.short].filter(Boolean), []).map((h) => h.allergen));
  return (list || []).filter((a) => !als.includes(a) && !hinted.has(a));
}

