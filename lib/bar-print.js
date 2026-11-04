// lib/bar-print.js — v130 (Доп. 443): «Барная карта» на бумагу. Без React.
//
// Владелец (02.11): «Давай в барную карту добавим возможность распечатать информацию. Имею ввиду, как в меню» — на восемь
// предложений «Да, давай все». Здесь — что из карточки попадает на лист и в текст: разделы как в карте (вина по цвету,
// крепкое по виду, коктейли по основе), у позиции то же, что в карточке. «Сегодня нет» на бумагу не идёт: стоп меняется
// каждый день, а лист висит неделями. То, что дописал AI и ещё не проверили, — с пометкой «Не проверено: …».
// Страницы — под А4 (paginate): позиция целиком на одной странице. Лист рисует ui/bar-print.jsx.
// v136 (Доп. 449): у вина и крепкого — look (вид, цвет вина, вид крепкого): где нет фото, на листе нарисованная бутылка, как в карте.
import { WINE, SPIRIT } from "./drinks.js";
import { groupByBase } from "./bar-card.js";
import { titleParts } from "./bar-view.js";
import { buildScenario, GLASS_RU, GARNISH_RU } from "./bar-lab.js";
import { cocktailSpirits, spiritCocktails } from "./spirit-cocktails.js";
import { COCKTAILS } from "../data/cocktails.js";
import { COCKTAIL_STORIES } from "../data/cocktail-stories.js";

export const PRINT_KINDS = [["cocktail", "Коктейли"], ["wine", "Вина"], ["spirit", "Крепкое"]];
export const KIND_RU = Object.fromEntries(PRINT_KINDS);
const NB = " ";
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
export const posWord = (n) => n + " " + plural(n, "позиция", "позиции", "позиций");
// граммовка: число и единица неразрывно (на листе не разъедутся по строкам); «доверху» — без числа
const amount = (i) => (i[1] === "" || i[1] == null ? "" : i[2] === "доверху" ? "доверху" : i[1] + NB + (i[2] || "мл"));
const pct = (v) => (v ? String(v).replace(".", ",") + "%" : "");

/** Коктейль на лист (как договорились: бокал в его цвете, метод, бокал, гарниш, состав с граммовкой, шаги приготовления,
 *  крепкое из нашей карты, фраза гостю). Шаги — рецептом («Всё в рокс с крупным льдом», «Стир 20 секунд»…), а не по
 *  движениям лаборатории: те повторяют состав и растягивают лист втрое; рецепта нет — шаги лаборатории. art — сам коктейль. */
export function cocktailRow(c, ctx = {}) {
  const ing = (c.ing || []).filter((i) => Array.isArray(i) && i[0]);
  const own = (c.steps || []).filter(Boolean);
  const how = own.length ? own : !c.house ? buildScenario(c, COCKTAILS).steps.map((s) => s.label) : [];
  const garnish = c.garnish && c.garnish !== "none" && GARNISH_RU[c.garnish] ? GARNISH_RU[c.garnish] : "";
  const ours = cocktailSpirits(c, ctx.spirits || []);
  const story = COCKTAIL_STORIES[c.id] || null;
  const guest = story && story.guest ? story.guest : c.house && c.short ? c.short : "";
  const lines = [];
  if (ing.length) lines.push(["line", ing.map((i) => i[0] + (amount(i) ? " " + amount(i) : "")).join(" · ")]);
  if (how.length) lines.push(["dim", "Как готовить: " + how.map((s, k) => k + 1 + ". " + s).join("  →  ")]);
  if (ours.length) lines.push(["faint", "Из нашей карты: " + ours.map((w) => SPIRIT.title(w)).join(", ")]);
  if (guest) lines.push(["guest", "Гостю: «" + guest + "»"]);
  return { kind: "cocktail", id: String(c.id), title: c.name || "", tag: c.house ? "свой" : "", orig: "", meta: [c.method, GLASS_RU[c.glass] || "", garnish].filter(Boolean).join(" · "), lines, img: "", art: c };
}

/** Вино или крепкое на лист: название и оригинал, производитель; откуда, сорт, стиль; цена; ноты; подача; фраза гостю; в
 *  каких коктейлях нашего бара (крепкое); к каким блюдам; что не проверено. img — фото бутылки (рисуется, если включено). */
export function drinkRow(K, w, ctx = {}) {
  const tp = titleParts(K, w);
  let price = K.price(w);
  if (K.kind === "wine" && w.byGlass && !w.priceGlass) price = ["бокалом", price].filter(Boolean).join(" · ");
  const line = [K.line(w), K.kind === "wine" ? pct(w.abv) : ""].filter(Boolean).join(" · ");
  const pairs = (w.pair || []).map((id) => (ctx.dishName ? ctx.dishName(id) : "")).filter(Boolean);
  const inCk = K.kind === "spirit" ? spiritCocktails(w, ctx.cocktails || []) : [];
  const lines = [];
  if (line) lines.push(["line", line]);
  if (price) lines.push(["price", price]);
  if ((w.notes || []).length) lines.push(["dim", "Ноты: " + w.notes.join(", ")]);
  const serve = K.cardServe(w);
  if (serve) lines.push(["dim", "Подача: " + serve]);
  if (w.short) lines.push(["guest", "Гостю: «" + w.short + "»"]);
  if (inCk.length) lines.push(["faint", "В коктейлях: " + inCk.map((c) => c.name).join(", ")]);
  if (pairs.length) lines.push(["faint", "К блюдам: " + pairs.join(", ")]);
  if (w.pairNote) lines.push(["faint", w.pairNote]);
  if (Array.isArray(w.ai) && w.ai.length) lines.push(["warn", "Не проверено: " + w.ai.map((f) => K.FIELD_RU[f] || f).join(", ")]);
  return { kind: K.kind, id: String(w.id), title: tp.main, tag: "", orig: tp.orig, meta: w.producer || "", lines, img: w.img || "", art: null,
    look: { kind: K.kind, color: w.color || "", cat: w.cat || "" } };
}

/** Разделы, как в карте: коктейли по основе, вина по цвету, крепкое по виду. */
export function printSections(kind, items, ctx = {}) {
  const live = (items || []).filter((x) => x && !x.archived);
  if (kind === "cocktail") return groupByBase(live).map(([k, list]) => ({ key: k, label: k, rows: list.map((c) => cocktailRow(c, ctx)) }));
  const K = kind === "spirit" ? SPIRIT : WINE;
  return K.groups(live).map(([k, list]) => ({ key: k, label: K.GROUP[k] || K.GROUP.other, rows: list.map((w) => drinkRow(K, w, ctx)) }));
}
export const rowsCount = (sections) => (sections || []).reduce((n, s) => n + s.rows.length, 0);

/** «Текстом»: тот же лист простым текстом, вставить в чат команды. parts — [{ label, sections }]. */
export function printText({ restaurant = "", parts = [], date = new Date() } = {}) {
  const out = [("Барная карта" + (restaurant ? " · " + restaurant : "")).toUpperCase(), date.toLocaleDateString("ru-RU")];
  for (const p of parts) {
    out.push("", "", (p.label + " · " + posWord(rowsCount(p.sections))).toUpperCase());
    for (const s of p.sections) {
      out.push("", s.label.toUpperCase());
      for (const r of s.rows) {
        out.push("", r.title + (r.orig ? " (" + r.orig + ")" : "") + (r.tag ? " · " + r.tag : ""));
        if (r.meta) out.push(r.meta);
        for (const [, t] of r.lines) out.push(t);
      }
    }
  }
  return out.join("\n").replace(/ /g, " ").trim() + "\n";
}

// ── страницы под А4 ──
// Лист 760 точек в ширину (×2 на холсте); высота 1074 — чуть меньше 760 × √2: картинка печатается на А4 без полей и не
// переползает на вторую страницу. Шапка (ресторан, что и сколько, дата, номер страницы) и подвал — на каждой странице.
export const PAGE = { W: 760, H: 1074, PAD: 28, HEAD: 100, FOOT: 54, SEC: 22 };
/** Позиции по страницам: каждая целиком; заголовок раздела (sec) — в начале страницы и там, где раздел сменился. Позиция выше
 *  страницы встаёт одна (на листе её строки уже ограничены). rows — [{ h, sec }]. */
export function paginate(rows, avail = PAGE.H - PAGE.HEAD - PAGE.FOOT, secH = PAGE.SEC) {
  const pages = [];
  let cur = [], used = 0, last = null;
  for (const r of rows || []) {
    const need = r.h + (r.sec !== last ? secH : 0);
    if (cur.length && used + need > avail) { pages.push(cur); cur = []; used = 0; last = null; }
    used += r.h + (r.sec !== last ? secH : 0); last = r.sec; cur.push(r);
  }
  if (cur.length) pages.push(cur);
  return pages;
}
