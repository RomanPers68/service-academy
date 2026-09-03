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
