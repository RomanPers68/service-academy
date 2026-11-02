// lib/bar-card.js — v127 (Доп. 440): «Барная карта» — коктейли, вина и крепкое нашего бара в одном месте. Без React.
//
// Владелец (01.11): «стоит ли сделать одну общую кнопку «Барное меню» или «Барная карта», и закинуть туда вина, коктейли,
// крепыш?» и «Да, делаем». Коктейли нашего бара — свои (записи kind:"cocktail" и коктейли из меню, houseCocktails) и
// классика из «Карты бара» (если её не настраивали — вся классика), как в «Колоде бармена» (ui/cocktails.jsx: inCard).
import { COCKTAILS } from "../data/cocktails";
import { readBarcard, houseCocktails } from "./deck-extras";
import { wineRecords } from "./wine.js";
import { spiritRecords } from "./spirit.js";

// основа коктейля — по первому ингредиенту, как в «Колоде бармена»
export const BAR_BASES = ["Джин", "Водка", "Ром", "Текила", "Виски", "Бренди", "Другое"];
export function cocktailBase(c) {
  const f = String((c && c.ing && c.ing[0] && c.ing[0][0]) || "").toLowerCase();
  if (f.includes("джин")) return "Джин";
  if (f.includes("водк")) return "Водка";
  if (f.includes("ром")) return "Ром";
  if (f.includes("текил")) return "Текила";
  if (f.includes("виски") || f.includes("бурбон") || f.includes("скотч")) return "Виски";
  if (f.includes("коньяк") || f.includes("бренди")) return "Бренди";
  return "Другое";
}
// стакан коротко (как в «Бар-лаборатории»)
export const GLASS_SHORT = { rocks: "рокс", highball: "хайбол", martini: "купе", sour: "сауэр", flute: "флюте", hurricane: "харрикейн", shot: "шот", irish: "айриш-кофе", margarita: "маргарита", red: "винный бокал", white: "винный бокал" };

/** Коктейли нашего бара: свои — первыми, потом классика из «Карты бара» (не настроена — вся классика); без архива. */
export function ourCocktails(shared) {
  const card = readBarcard(shared), house = houseCocktails(shared || []);
  return [...house, ...COCKTAILS.filter((c) => (card ? card.includes(c.id) : true))];
}
const normQ = (t) => String(t || "").toLowerCase().replace(/ё/g, "е").trim();
/** Поиск коктейля: по названию и ингредиентам. */
export const findCocktails = (list, q) => { const t = normQ(q); return !t ? list || [] : (list || []).filter((c) => normQ(c.name).includes(t) || (c.ing || []).some((i) => normQ(Array.isArray(i) ? i[0] : "").includes(t))); };
/** По основам — в порядке BAR_BASES, внутри — свои первыми, потом по алфавиту. */
export function groupByBase(list) {
  const by = {};
  for (const c of list || []) (by[cocktailBase(c)] = by[cocktailBase(c)] || []).push(c);
  for (const k of Object.keys(by)) by[k].sort((a, b) => (b.house ? 1 : 0) - (a.house ? 1 : 0) || String(a.name).localeCompare(String(b.name), "ru", { numeric: true }));   // v128: «Вино 2» раньше «Вино 10», 12 лет раньше 18
  return BAR_BASES.filter((k) => by[k]).map((k) => [k, by[k]]);
}
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
export const cocktailsWord = (n) => n + " " + plural(n, "коктейль", "коктейля", "коктейлей");
/** Сколько чего в карте: { cocktails, wines, spirits } (вина и крепкое — без архива). */
export function barCounts(shared) {
  return { cocktails: ourCocktails(shared).length, wines: wineRecords(shared).filter((w) => !w.archived).length, spirits: spiritRecords(shared).filter((w) => !w.archived).length };
}
/** Подпись карточки в Справочнике: «Коктейли 24 · вина 140 · крепкое 60». */
export function barLine(counts) {
  const c = counts || {};
  const parts = [c.cocktails ? "коктейли " + c.cocktails : "", c.wines ? "вина " + c.wines : "", c.spirits ? "крепкое " + c.spirits : ""].filter(Boolean);
  const t = parts.join(" · ");
  return t ? t[0].toUpperCase() + t.slice(1) : "Коктейли, вина и крепкое нашего бара";
}
