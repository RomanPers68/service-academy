// lib/sommelier.js — v131 (Доп. 444): «Сомелье» в «Барной карте». Без React.
//
// Владелец (02.11): «как ты смотришь на то, что бы добавить AI-Сомелье?» — на концепт «Да делаем». Официант пишет или
// говорит, что хочет гость («к рибаю, сухое красное, до 5 000», «что-то как Шабли, но бокалом», «к десерту»). Здесь:
// • что понято из просьбы (somAsk): бюджет, «бокалом», цвет и сладость, вид крепкого, блюдо из меню, «похоже на…», повод;
// • кто из карты годится (somShortlist): не в стопе и не в архиве, в бюджете, бокалом — если просили; лучшие сверху;
// • просьба Наставнику (somPrompt): до 2000 знаков, только наш список под номерами — других вин он не назовёт;
// • разбор ответа (parseSom): только номера из списка, к каждой позиции «почему» и фраза гостю;
// • подбор без Наставника (localPicks): лимит на сегодня, нет связи, ИИ не подключён — по совпадению с просьбой.
// Экран — ui/bar-sommelier.jsx. Лимит общий с Наставником: подбор считается как вопрос.
import { WINE, SPIRIT } from "./drinks.js";
import { titleParts, sweetOf, budgetSteps } from "./bar-view.js";
import { cocktailBase } from "./bar-card.js";
import { GLASS_RU } from "./bar-lab.js";
import { COCKTAIL_STORIES } from "../data/cocktail-stories.js";
import { tasteLine } from "./taste.js";   // v132: вкус по шкалам

export const SOM_WHAT = [["all", "Всё"], ["wine", "Вино"], ["spirit", "Крепкое"], ["cocktail", "Коктейли"]];
export const SOM_KIND_RU = { wine: "Вино", spirit: "Крепкое", cocktail: "Коктейль" };
export const SOM_OCC = [["aperitif", "Аперитив"], ["dessert", "К десерту"], ["digestif", "Дижестив"]];
const NB = " ";
const norm = (t) => String(t == null ? "" : t).toLowerCase().replace(/ё/g, "е");
const wordsOf = (t) => norm(t).replace(/(\d)[\s .](?=\d{3}\b)/g, "$1").split(/[^a-zа-я0-9]+/).filter(Boolean);
const rub = (n) => (n ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + "₽" : "");
const cut = (t, n) => { const s = String(t || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
export const posWord = (n) => n + " " + plural(n, "позиция", "позиции", "позиций");
// основа слова для сравнения: «рибаю» и «рибай», «минеральное» и «минеральность»
const stem = (w) => (w.length > 7 ? w.slice(0, w.length - 3) : w.length > 4 ? w.slice(0, w.length - 2) : w);

// ── что понято из просьбы ──
const COLOR_W = [["red", /^красн/], ["white", /^бел(ое|ого|ые|ых|ым|ому|ая|ой)$/], ["rose", /^(розов|розе$|rose$)/], ["orange", /^оранж/],
  ["sparkling", /^(игрист|шампанск|просекко|кава$|креман|брют|пузыр|шипуч)/], ["dessert", /^десертн/], ["fortified", /^(креплен|портвейн|херес|мадер|марсал)/]];
const SWEET_W = [["semidry", /^полусух/], ["semisweet", /^полуслад/], ["dry", /^(сух|брют)/], ["sweet", /^слад/]];
const CAT_W = [["whisky", /^(виски|вискарь|бурбон|скотч|односолод|whisk)/], ["cognac", /^(коньяк|бренди|арманьяк|кальвадос|cognac|brandy)/], ["rum", /^(ром|рома|ромом|ромы|ромчик|rum)$/],
  ["gin", /^(джин|джина|джином|gin)$/], ["agave", /^(текил|мескал|tequila|mezcal)/], ["vodka", /^(водк|vodka)/], ["liqueur", /^(ликер|liqueur)/], ["bitter", /^(биттер|настойк|амаро|bitter)/]];
const OCC_W = [["aperitif", /^(аперитив|аперол|aperitiv)/], ["dessert", /^(десерт(у|а|ом|ы)?$|торт|сладкому|пирожн|тирамису|чизкейк|шоколадн)/], ["digestif", /^(дижестив|digestif)/]];
// v132: тело и стиль, страна
const BODY_LIGHT = /^(легк|легон|воздуш|изящн)/, BODY_FULL = /^(насыщ|плотн|полнотел|мощн|тяжел|густ|концентр)/, FRESH_W = /^(свеж|бодр|кислинк|звонк)/;
const COUNTRY_W = [["франц", /^франц/], ["итал", /^итал/], ["испан", /^испан/], ["герман", /^(герман|немец)/], ["португал", /^португал/], ["австри", /^австри/],
  ["груз", /^груз/], ["аргентин", /^аргентин/], ["чили", /^чилийск/], ["юар", /^(юар|южноафрик)/], ["австрал", /^австрал/], ["зеланд", /^(зеланд|новозеланд)/],
  ["сша", /^(сша|америк|калифорн)/], ["росси", /^(росси|крым|кубан)/], ["шотланд", /^шотланд/], ["ирланд", /^ирланд/], ["япон", /^япон/], ["мексик", /^мексик/], ["куб", /^(кубин|кубы)$/]];
const WINE_W = /^(вин(о|а|у|ом|ам)?$|бокал|сомелье)/, SPIRIT_W = /^(крепк|креп$|шот|порци)/, CK_W = /^коктейл/;
const STOP = new Set("к и а но или что то нибудь чтонибудь чтото что-то гость гостю гостя гости хочет хотят просит просят бы мне нам ему ей для под по из на в во с со до от не очень бокалом бокал бокала бокалу бокалы чем как похоже похожее похож вроде типа стиле рублей руб р тыс тысяч тысячи к что-нибудь лучше хорошее хороший хорошо можно посоветуй посоветуйте подбери подберите есть вкусное интересное около примерно максимум пределах дороже дешевле бюджет после перед ужина ужину обеда".split(" "));
// известные вина словом: «как Шабли» — белое, шардоне, Бургундия (если такого нет в нашей карте)
const LIKE_STYLES = [
  ["шабли", { color: "white", grapes: ["шардоне", "chardonnay"], region: ["бургунд", "шабли", "chablis"] }],
  ["сансер", { color: "white", grapes: ["совиньон", "sauvignon"], region: ["луар", "сансер"] }],
  ["совиньон", { color: "white", grapes: ["совиньон", "sauvignon"] }],
  ["шардоне", { color: "white", grapes: ["шардоне", "chardonnay"] }],
  ["рислинг", { color: "white", grapes: ["рислинг", "riesling"] }],
  ["гевюрц", { color: "white", grapes: ["гевюрц", "gewurz"] }],
  ["альбарин", { color: "white", grapes: ["альбарин", "albari"] }],
  ["пино гри", { color: "white", grapes: ["пино гри", "pinot gri"] }],
  ["гюнер", { color: "white", grapes: ["грюнер", "гюнер", "gruner"] }],
  ["грюнер", { color: "white", grapes: ["грюнер", "gruner"] }],
  ["просекко", { color: "sparkling", grapes: ["глера", "glera"], region: ["венето", "просекко", "prosecco"] }],
  ["шампанск", { color: "sparkling", region: ["шампан", "champagne"] }],
  ["кава", { color: "sparkling", region: ["испан", "каталон", "пенедес", "cava"] }],
  ["ламбруско", { color: "sparkling", grapes: ["ламбруско"] }],
  ["асти", { color: "sparkling", sweet: "sweet", grapes: ["москат", "мускат", "moscato"] }],
  ["москато", { color: "sparkling", sweet: "sweet", grapes: ["москат", "мускат", "moscato"] }],
  ["кьянти", { color: "red", grapes: ["санджовезе", "sangiovese"], region: ["тоскан", "кьянти", "chianti"] }],
  ["бароло", { color: "red", grapes: ["неббиоло", "nebbiolo"], region: ["пьемонт", "бароло"] }],
  ["риох", { color: "red", grapes: ["темпранильо", "tempranillo"], region: ["риох", "rioja"] }],
  ["мальбек", { color: "red", grapes: ["мальбек", "malbec"], region: ["аргентин", "мендос"] }],
  ["пино нуар", { color: "red", grapes: ["пино нуар", "pinot noir"] }],
  ["мерло", { color: "red", grapes: ["мерло", "merlot"] }],
  ["каберне", { color: "red", grapes: ["каберне", "cabernet"] }],
  ["шираз", { color: "red", grapes: ["шираз", "сира", "syrah", "shiraz"] }],
  ["примитиво", { color: "red", grapes: ["примитиво", "зинфандел", "primitivo"] }],
  ["амароне", { color: "red", region: ["вальполичел", "амароне", "венето"] }],
  ["бордо", { color: "red", grapes: ["каберне", "мерло"], region: ["бордо", "bordeaux"] }],
  ["портвейн", { color: "fortified", sweet: "sweet", region: ["порту", "дору", "португал"] }],
  ["херес", { color: "fortified", region: ["херес", "андалус"] }],
  ["токай", { color: "dessert", sweet: "sweet", region: ["токай"] }],
  ["сотерн", { color: "dessert", sweet: "sweet", region: ["сотерн", "бордо"] }],
];
// сумма словами: «5 000», «5000 ₽», «5 тыс», «5к», «1,5 тыс.»
function amountOf(num, unit) {
  const x = Number(String(num).replace(/[\s .]/g, "").replace(",", "."));
  if (!x) return 0;
  return Math.round(/^(к|k|т|тыс|тысяч)/.test(unit || "") ? x * 1000 : x);
}
const BUDGET_RE = /(до|не дороже|не больше|не выше|максимум|в пределах|дешевле|бюджет\S*|за|около|примерно|от|дороже)\s*(\d[\d\s .]*(?:,\d+)?)\s*(к(?![а-я])|k(?![a-z])|тыс\S*|тысяч\S*|т\.?р\.?)?\s*(?:₽|р\.|руб\S*)?/i;
/** Просьба словами → что понято. ctx: { dishes, wines, spirits } — для блюд и «похоже на» из нашей карты. */
export function somAsk(text, ctx = {}) {
  const raw = String(text || "").replace(/\s+/g, " ").trim(), t = norm(raw);
  const words = wordsOf(raw);
  const hit = (re) => words.some((w) => re.test(w));
  const ask = { text: raw, budget: 0, budgetMin: 0, glass: false, colors: [], sweet: "", cats: [], kinds: [], dishes: [], like: "", likeRef: null, likeStyle: null, occasion: "", words: [] };
  // бюджет
  const bm = t.match(BUDGET_RE);
  if (bm) {
    const v = amountOf(bm[2], bm[3]);
    if (v >= 100) {
      if (/^(от|дороже)$/.test(bm[1])) ask.budgetMin = v;
      else ask.budget = /^(около|примерно)$/.test(bm[1]) ? Math.round(v * 1.15) : v;
    }
  }
  ask.glass = /бокал|по бокалу|на розлив/.test(t);
  for (const [k, re] of COLOR_W) if (hit(re)) ask.colors.push(k);
  for (const [k, re] of SWEET_W) if (hit(re) && !ask.sweet) ask.sweet = k;
  for (const [k, re] of CAT_W) if (hit(re)) ask.cats.push(k);
  for (const [k, re] of OCC_W) if (!ask.occasion && hit(re)) ask.occasion = k;
  if (!ask.occasion && /после (ужина|еды|обеда)/.test(t)) ask.occasion = "digestif";
  if (!ask.occasion && /перед (ужином|едой|обедом)|для аппетита/.test(t)) ask.occasion = "aperitif";
  // вид напитка из слов: «красное» — вино, «виски» — крепкое, «коктейль» — коктейль
  if (ask.colors.length || ask.sweet || hit(WINE_W)) ask.kinds.push("wine");
  if (ask.cats.length || hit(SPIRIT_W)) ask.kinds.push("spirit");
  if (hit(CK_W)) ask.kinds.push("cocktail");
  // блюдо из меню: «к рибаю», «к «Рибай»»; больше совпавших слов — точнее
  const dishes = (ctx.dishes || []).filter((d) => d && d.name && !d.archived);
  let best = 0; const found = [];
  for (const d of dishes) {
    const dw = wordsOf(d.name).filter((w) => w.length >= 4 && !STOP.has(w));
    if (!dw.length) continue;
    const n = dw.filter((w) => words.some((x) => x.length >= 4 && (x.startsWith(stem(w)) || w.startsWith(stem(x))))).length;
    if (!n) continue;
    const full = t.includes(norm(d.name)) ? 2 : 0;
    const sc = n / dw.length + full;
    if (sc > best + 1e-9) { best = sc; found.length = 0; found.push(d); } else if (Math.abs(sc - best) < 1e-9) found.push(d);
  }
  ask.dishes = best >= 0.5 ? found.slice(0, 3) : [];
  // «как Шабли», «похоже на Мальбек», «вроде Просекко»
  const lm = t.match(/(?:^|[\s,.;:«(])(?:похож\S*\s+на|как|вроде|типа|в стиле)\s+([a-zа-я0-9][a-zа-я0-9 '’-]{1,40}?)(?=\s*(?:,|\.|;|$|\s+но\s|\s+и\s|\s+только|\s+бокал|\s+до\s|\s+к\s))/);
  if (lm) {
    const term = lm[1].trim();
    if (term && !OCC_W.some(([, re]) => re.test(term)) && !STOP.has(term)) {
      ask.like = term;
      const st = LIKE_STYLES.find(([k]) => term.startsWith(k) || term.includes(k));
      const mine = [...(ctx.wines || []).map((w) => [WINE, w]), ...(ctx.spirits || []).map((w) => [SPIRIT, w])]
        .find(([K, w]) => !w.archived && norm([titleParts(K, w).main, titleParts(K, w).orig, w.name, w.region].join(" ")).includes(term));
      if (mine) ask.likeRef = { kind: mine[0].kind, rec: mine[1] };
      if (st) ask.likeStyle = st[1];
      if (!ask.kinds.length && (st || (mine && mine[0].kind === "wine"))) ask.kinds.push("wine");
      if (!ask.kinds.length && mine && mine[0].kind === "spirit") ask.kinds.push("spirit");
    }
  }
  // v132: тело и стиль словами, страна; «на стол: «A», «B»» — несколько блюд, «бокал к каждому» или одна бутылка на всех
  ask.body = hit(BODY_LIGHT) ? "light" : hit(BODY_FULL) ? "full" : "";
  ask.fresh = hit(FRESH_W);
  ask.oak = /без дуба|не дубов|без бочк/.test(t) ? "no" : /с дубом|дубов|бочк/.test(t) ? "yes" : "";
  ask.countries = COUNTRY_W.filter(([, re]) => hit(re)).map(([k]) => k);
  if (/из чили/.test(t) && !ask.countries.includes("чили")) ask.countries.push("чили");
  ask.table = null;
  const tm = raw.match(/на стол:\s*((?:«[^»]+»\s*,?\s*)+)/i);
  if (tm) {
    const names = [...tm[1].matchAll(/«([^»]+)»/g)].map((m) => norm(m[1]));
    const td = names.map((n) => dishes.find((d) => norm(d.name) === n)).filter(Boolean).slice(0, 4);
    if (td.length) { ask.table = { dishes: td, each: /к каждому/.test(t) }; ask.dishes = [...td, ...ask.dishes.filter((d) => !td.includes(d))].slice(0, 4); }
  }
  ask.prof = dishProfile(ask.dishes);
  // остальные слова — к нотам и описанию
  const used = new Set([...(ask.like ? wordsOf(ask.like) : []), ...ask.dishes.flatMap((d) => wordsOf(d.name))]);
  ask.words = words.filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !STOP.has(w) && !used.has(w)
    && ![...COLOR_W, ...SWEET_W, ...CAT_W, ...OCC_W].some(([, re]) => re.test(w)) && !WINE_W.test(w) && !SPIRIT_W.test(w) && !CK_W.test(w)
    && ![...used].some((u) => w.startsWith(stem(u)) || u.startsWith(stem(w)))
    && !BODY_LIGHT.test(w) && !BODY_FULL.test(w) && !FRESH_W.test(w) && !/^(дуб|бочк|каждом|стол|бутылк|всех)/.test(w) && !COUNTRY_W.some(([, re]) => re.test(w))).slice(0, 8);
  return ask;
}
/** Задано ли что-нибудь: просьба пустая — подбирать не из чего. */
export const askEmpty = (a) => !a || !String(a.text || "").trim();

// ── карта одним списком ──
const ckSay = (c) => { const s = COCKTAIL_STORIES[c.id]; return s && s.guest ? s.guest : c.short || ""; };
const priceN = (v) => Number(v) || 0;
/** Все позиции карты одним видом: вино, крепкое, коктейль. Стоп и архив сюда не попадают: гостю их не предложить. */
export function somPool({ wines = [], spirits = [], cocktails = [] } = {}) {
  const out = [];
  for (const w of wines || []) if (w && !w.archived && !w.stop) {
    const tp = titleParts(WINE, w);
    out.push({ kind: "wine", id: String(w.id), title: tp.main, orig: tp.orig, line: WINE.line(w), priceText: WINE.price(w) || (w.byGlass ? "бокалом" : ""),
      bottle: priceN(w.priceBottle), glassPrice: w.byGlass ? priceN(w.priceGlass) : 0, byGlass: !!w.byGlass, color: w.color || "", sweet: sweetOf(w),
      grapes: (w.grapes || []).map(norm), place: norm([w.country, w.region].join(" ")), notes: w.notes || [], say: w.short || "", pair: (w.pair || []).map(String),
      img: w.img || "", checked: !(w.ai || []).length, hay: norm([tp.main, tp.orig, w.producer, WINE.line(w), (w.notes || []).join(" "), w.short, w.pairNote].join(" ")), rec: w,
      taste: w.taste || null, country: norm(w.country), serve: WINE.cardServe(w), story: w.story || "" });
  }
  for (const w of spirits || []) if (w && !w.archived && !w.stop) {
    const tp = titleParts(SPIRIT, w);
    out.push({ kind: "spirit", id: String(w.id), title: tp.main, orig: tp.orig, line: SPIRIT.line(w), priceText: SPIRIT.price(w), portion: priceN(w.pricePortion), bottle: priceN(w.priceBottle),
      cat: w.cat || "", place: norm([w.country, w.region].join(" ")), notes: w.notes || [], say: w.short || "", pair: (w.pair || []).map(String), img: w.img || "", checked: !(w.ai || []).length,
      hay: norm([tp.main, tp.orig, w.producer, SPIRIT.line(w), w.style, w.age, (w.notes || []).join(" "), (w.serve || []).join(" "), w.short, w.pairNote].join(" ")), rec: w,
      taste: w.taste || null, country: norm(w.country), serve: SPIRIT.cardServe(w), story: w.story || "" });
  }
  for (const c of cocktails || []) if (c && !c.archived && !c.stop) {
    const ing = (c.ing || []).map((i) => (Array.isArray(i) ? i[0] : i)).filter(Boolean);
    out.push({ kind: "cocktail", id: String(c.id), title: c.name || "", orig: "", line: [cocktailBase(c), c.method, GLASS_RU[c.glass] || ""].filter(Boolean).join(" · "), priceText: c.price ? rub(c.price) : "",
      price: priceN(c.price), ing, strength: Number(c.strength) || 0, sweetN: Number(c.sweet) || 0, method: norm(c.method), say: ckSay(c), house: !!c.house, img: "", checked: true,
      hay: norm([c.name, ing.join(" "), c.method, GLASS_RU[c.glass], cocktailBase(c), ckSay(c)].join(" ")), rec: c,
      taste: null, country: "", serve: [GLASS_RU[c.glass] ? "бокал «" + GLASS_RU[c.glass] + "»" : "", c.method].filter(Boolean).join(" · "), story: (COCKTAIL_STORIES[c.id] || {}).story || "" });
  }
  return out;
}
/** Цена для бюджета: вино — бутылка (бокал, если просят бокалом), крепкое — порция, коктейль — своя цена. */
export const somPrice = (c, glass = false) => (c.kind === "wine" ? (glass ? c.glassPrice : c.bottle) : c.kind === "spirit" ? c.portion : c.price) || 0;
const KIND_ORDER = { wine: 0, spirit: 1, cocktail: 2 };
/** Какие виды смотреть: выбран вид — он; «Всё» — что названо в просьбе, а не названо — вся карта (экран сам
 *  переключает вид, когда в просьбе названо одно: «виски» — «Крепкое»). */
export function kindsFor(what, ask) {
  if (what && what !== "all") return [what];
  return ask && ask.kinds.length ? [...new Set(ask.kinds)] : ["wine", "spirit", "cocktail"];
}

// ── оценка: чем ближе к просьбе, тем выше; reasons — «почему» без Наставника ──
const ingHas = (c, re) => c.ing.some((i) => re.test(norm(i)));
function scoreOf(c, ask) {
  let s = 0; const why = [];
  const dishIds = ask.dishes.map((d) => String(d.id));
  const dish = ask.dishes.find((d) => c.pair && c.pair.includes(String(d.id)));
  if (dish) { s += 6; why.push("в нашей карте к «" + dish.name + "»"); }
  else if (dishIds.length && c.kind === "wine" && !ask.kinds.length) s += 1;
  // похоже на…
  const ref = ask.likeRef, st = ask.likeStyle;
  if (ref && ref.kind === c.kind && String(ref.rec.id) === c.id) { s += 5; why.push("оно самое, есть в нашей карте"); }
  else if (ref && ref.kind === c.kind) {
    const r = ref.rec;
    if (c.kind === "wine") {
      if (r.color && r.color === c.color) s += 2;
      const g = (r.grapes || []).map(norm).filter((x) => c.grapes.some((y) => y.includes(stem(x)) || x.includes(stem(y))));
      if (g.length) { s += 3; why.push("тоже " + g[0]); }
      if (r.region && c.place.includes(stem(norm(r.region)))) { s += 2; if (!g.length) why.push("тоже " + r.region); }
    } else if (c.kind === "spirit" && r.cat && r.cat === c.cat) { s += 4; why.push("того же вида, что «" + titleParts(SPIRIT, r).main + "»"); }
  } else if (st && c.kind === "wine") {
    if (st.color && st.color === c.color) s += 2;
    const g = (st.grapes || []).find((x) => c.grapes.some((y) => y.includes(x) || x.includes(stem(y))) || c.hay.includes(x));
    if (g) { s += 3; why.push("по стилю как " + ask.like); }
    const p = (st.region || []).find((x) => c.place.includes(x) || c.hay.includes(x));
    if (p) { s += 2; if (!g) why.push("по месту как " + ask.like); }
    if (st.sweet && st.sweet === c.sweet) s += 1;
  }
  // повод
  const s0 = s;
  if (ask.occasion === "aperitif") {
    if (c.kind === "wine") s += c.color === "sparkling" ? 3 : c.color === "white" || c.color === "rose" ? 1 : 0;
    if (c.kind === "cocktail") s += (c.strength && c.strength <= 2 ? 2 : 0) + (ingHas(c, /апероль|кампари|просекко|игрист|тоник/) ? 2 : ingHas(c, /вермут|биттер/) ? 1 : 0);
    if (c.kind === "spirit") s += c.cat === "bitter" || c.cat === "gin" ? 2 : 0;
    if (s - s0 >= 2 && !why.length) why.push("лёгкое начало вечера");
  } else if (ask.occasion === "dessert") {
    if (c.kind === "wine") s += c.sweet === "sweet" || c.sweet === "semisweet" || c.color === "dessert" ? 3 : c.color === "fortified" ? 2 : 0;
    if (c.kind === "cocktail") s += (c.sweetN >= 3 ? 1 : 0) + (ingHas(c, /сливк|кофе|эспрессо|шоколад|какао|ваниль|мороже|амаретто|бейлиз/) ? 3 : 0);
    if (c.kind === "spirit") s += c.cat === "liqueur" ? 3 : c.cat === "cognac" || c.cat === "rum" ? 2 : 0;
    if (s - s0 >= 2 && !why.length) why.push("к сладкому");
  } else if (ask.occasion === "digestif") {
    if (c.kind === "spirit") s += c.cat === "cognac" || c.cat === "whisky" || c.cat === "bitter" ? 3 : c.cat === "liqueur" || c.cat === "other" ? 2 : 1;
    if (c.kind === "wine") s += c.color === "fortified" || c.color === "dessert" ? 2 : 0;
    if (c.kind === "cocktail") s += c.strength >= 3 && /стир/.test(c.method) ? 1 : 0;
    if (s - s0 >= 2 && !why.length) why.push("после ужина");
  }
  // v132: правила сочетаний по блюду (по шкалам вкуса, а нет — по цвету, сладости и сорту); «почему» — если другого нет
  const pr = ask.prof ? pairRule(c, ask.prof) : null;
  if (pr) { s += pr.s; if (!why.length && pr.why) why.push(pr.why); }
  // v132: тело, свежесть, дуб, страна — из просьбы
  if (ask.body && c.kind !== "cocktail") { const b = bodyOf(c); if (b) s += ask.body === "light" ? (b <= 2 ? 2 : b >= 4 ? -1.5 : 0) : (b >= 4 ? 2 : b <= 2 ? -1.5 : 0); }
  if (ask.fresh && c.kind === "wine") s += acidOf(c) >= 4 ? 1.5 : 0;
  if (ask.oak && c.taste && c.taste.oak) s += ask.oak === "no" ? (c.taste.oak <= 2 ? 1.5 : -1) : (c.taste.oak >= 3 ? 1.5 : -0.5);
  if (ask.countries && ask.countries.length && c.country && ask.countries.some((k) => c.country.includes(k))) { s += 3; if (why.length < 2) why.push("из страны, которую просили"); }
  // v132: «советуем первым», что у нас берут, уточнение после ответа
  const key = c.kind + ":" + c.id;
  if (ask.prio && ask.prio.has(key)) { s += 1.5; if (why.length < 2) why.push("ресторан советует первым"); }
  if (ask.stats) { const sb = statBoost(c, ask); s += sb.s; if (sb.why && why.length < 2) why.push(sb.why); }
  if (ask.refine) s += refineScore(c, ask.refine);
  // слова просьбы в описании: «минеральное», «дымный», «фруктовое»
  let kw = 0;
  for (const w of ask.words) if (c.hay.includes(stem(w))) kw++;
  if (kw) { s += Math.min(3, kw); if (why.length < 2) why.push("в описании: " + ask.words.filter((w) => c.hay.includes(stem(w))).slice(0, 2).join(", ")); }
  // бюджет: гость готов на сумму — ближе к ней лучше, чем самое дешёвое
  const p = somPrice(c, ask.glass);
  if (ask.budget && p && p >= ask.budget * 0.5) s += 1;
  if (ask.glass && c.kind === "wine" && c.byGlass) why.push(c.glassPrice ? "бокал " + rub(c.glassPrice) : "есть бокалом");
  if (c.checked) s += 0.5;
  if (c.say) s += 0.3;
  if (c.notes && c.notes.length) s += 0.2;
  return { s, why };
}
/** Что подходит под просьбу. → { list (лучшие сверху, с оценкой и «почему»), total, none (почему пусто — словами) }.
 *  exclude — уже показанные (для «Ещё варианты»); below — цена ниже этой (для «Подешевле»). */
export function somShortlist(pool, ask, { what = "all", exclude = [], below = 0, limit = 10 } = {}) {
  const kinds = kindsFor(what, ask), ex = new Set(exclude);
  const byKind = (pool || []).filter((c) => kinds.includes(c.kind));
  const fits = (c, relax = "") => {
    if (relax !== "ex" && ex.has(c.kind + ":" + c.id)) return false;
    if (c.kind === "wine") {
      if (ask.glass && !c.byGlass) return false;
      if (ask.colors.length && relax !== "color" && !ask.colors.includes(c.color)) return false;
      if (ask.sweet && relax !== "sweet" && c.sweet && c.sweet !== ask.sweet) return false;
    }
    if (c.kind === "spirit" && ask.cats.length && relax !== "cat" && !ask.cats.includes(c.cat)) return false;
    const p = somPrice(c, ask.glass);
    if (relax !== "budget") {
      if ((ask.budget || ask.budgetMin) && !p) return false;
      if (ask.budget && p > ask.budget) return false;
      if (ask.budgetMin && p < ask.budgetMin) return false;
    }
    if (below && (!p || p >= below)) return false;
    // v132: «Другая страна» — не страны показанного; «Подороже» — дороже показанного, на ступень (до 2,2 раза)
    const r = ask.refine;
    if (r && relax !== "refine") {
      if (r.key === "country" && c.country && r.countries.some((k) => c.country === k)) return false;
      if (r.key === "up" && (!p || p <= r.max || (r.max && p > r.max * 2.2))) return false;
    }
    return true;
  };
  const ok = byKind.filter((c) => fits(c));
  const list = ok.map((c) => ({ ...c, ...scoreOf(c, ask) }))
    .sort((a, b) => b.s - a.s || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (somPrice(a, ask.glass) || 1e9) - (somPrice(b, ask.glass) || 1e9))
    .slice(0, limit);
  let none = "";
  if (!ok.length) {
    const kindRu = kinds.length === 1 ? { wine: "вин", spirit: "крепкого", cocktail: "коктейлей" }[kinds[0]] : "позиций";
    if (!byKind.length) none = "В нашей карте пока нет " + kindRu + " для подбора: всё в стопе или карта пустая.";
    else if (below) none = "Дешевле под эту просьбу в карте ничего нет: показанные и так самые доступные.";
    else if (ask.refine && ask.refine.key === "up" && byKind.some((c) => fits(c, "refine"))) none = "Дороже под эту просьбу в карте ничего нет: показанное и так на верхней ступени.";
    else if (ask.refine && ask.refine.key === "country" && byKind.some((c) => fits(c, "refine"))) none = "Другой страны под эту просьбу в карте нет.";
    else if (ex.size && byKind.some((c) => fits(c, "ex"))) none = "Больше под эту просьбу в карте ничего нет: всё подходящее уже показано.";
    else if (ask.glass && kinds.includes("wine") && !byKind.some((c) => c.kind === "wine" && c.byGlass)) none = "Бокалом в нашей карте вин сейчас нет.";
    else if ((ask.budget || ask.budgetMin) && byKind.some((c) => fits(c, "budget"))) {
      const near = byKind.filter((c) => fits(c, "budget") && somPrice(c, ask.glass)).sort((a, b) => somPrice(a, ask.glass) - somPrice(b, ask.glass));
      const c = ask.budget ? near[0] : near[near.length - 1];
      none = (ask.budget ? "В бюджет до " + rub(ask.budget) : "От " + rub(ask.budgetMin)) + " под эту просьбу ничего нет" + (c ? ": ближе всего «" + c.title + "», " + rub(somPrice(c, ask.glass)) + "." : ".");
    } else if (ask.colors.length && byKind.some((c) => fits(c, "color"))) none = "Такого цвета под эту просьбу в карте нет. Убери цвет из просьбы, и подберу из остального.";
    else if (ask.sweet && byKind.some((c) => fits(c, "sweet"))) none = "С такой сладостью под эту просьбу в карте ничего нет. Попробуй без неё.";
    else if (ask.cats.length && byKind.some((c) => fits(c, "cat"))) none = "Такого крепкого в нашей карте сейчас нет.";
    else none = "Под эту просьбу в нашей карте ничего нет. Попробуй сказать иначе или убрать бюджет.";
  }
  return { list, total: ok.length, none };
}

// ── просьба Наставнику: всё в одном сообщении до 2000 знаков ──
const LIMIT = 1990, LIST_MAX = 10;
const candLine = (c, i) => {
  const notes = (c.notes || []).slice(0, 3).map((x) => cut(x, 24)).join(", ");
  const what = c.kind === "cocktail" ? [c.line, cut(c.ing.slice(0, 4).join(", "), 60)].filter(Boolean).join("; ") : cut(c.line, 70);
  const pairs = (c.pairNames || []).slice(0, 2).map((x) => cut(x, 34)).join(", ");
  const parts = [SOM_KIND_RU[c.kind], cut(c.title + (c.orig ? " (" + c.orig + ")" : ""), 60), what, c.priceText, notes ? "ноты: " + notes : "", pairs ? "к блюдам: " + pairs : ""];
  return cut((i + 1) + ". " + parts.filter(Boolean).join(" · ").replace(/\u00A0/g, " "), 230);
};
/** Сообщение Наставнику. list — из somShortlist (номер в списке = номер в ответе). */
export function somPrompt(ask, list, { restaurant = "", dishName = null } = {}) {
  const dish = ask.dishes.length ? "Блюдо из нашего меню: " + ask.dishes.map((d) => cut([d.name, d.cat, (d.ingredients || []).slice(0, 4).map((x) => (Array.isArray(x) ? x[0] : x)).join(", ")].filter(Boolean).join(", "), 120)).join("; ") + "\n" : "";
  const head = "Сомелье: подбери гостю из «Барной карты»" + (restaurant ? " ресторана «" + restaurant + "»" : "") + ".\n"
    + "Просьба гостя: «" + cut(ask.text, 220) + "»\n" + dish
    + "Ниже всё, что под неё есть в нашей карте (не в стопе" + (ask.budget || ask.budgetMin ? ", в бюджете" : "") + (ask.glass ? ", бокалом" : "") + "). Бери только отсюда, других вин и марок не называй, цены не меняй.\n";
  const n = Math.min(list.length, LIST_MAX);
  const tail = "\n" + (n >= 3 ? "Выбери 2 или 3 лучших." : n === 2 ? "Выбери одну или обе." : "Позиция одна: скажи, подходит ли она.") + " Ответ строго так, по строке на позицию, без вступления, заголовков и кнопок:\n"
    + "[[pick:номер]] Почему: одно короткое предложение. Гостю: «фраза, которую официант скажет гостю»\n"
    + "Если не подходит ничего, напиши одной строкой, чего не хватает.";
  const withPairs = list.map((c) => ({ ...c, pairNames: dishName ? (c.pair || []).map(dishName).filter(Boolean) : [] }));
  let body = "";
  for (let i = 0; i < withPairs.length; i++) {
    const ln = candLine(withPairs[i], i) + "\n";
    if ((head + body + ln + tail).length > LIMIT) break;
    body += ln;
  }
  return head + body.replace(/\n$/, "") + tail;
}
/** Сколько позиций реально ушло Наставнику (остальные не влезли в 2000 знаков). */
export const promptCount = (prompt) => (String(prompt || "").match(/^\d+\. /gm) || []).length;

// ── ответ Наставника ──
const clean = (t) => String(t || "").replace(/\[\[[^\]]*\]\]/g, " ").replace(/\*\*|__|`/g, "").replace(/[ \t]+/g, " ").trim();
function whySay(seg) {
  const s = clean(seg).replace(/^[\s:.\-–—•)]+/, "");
  const m = s.match(/Гост(ю|ям)\s*:\s*/i);
  let why = m ? s.slice(0, m.index) : s, say = m ? s.slice(m.index + m[0].length) : "";
  why = why.replace(/^Почему( подходит)?\s*:\s*/i, "").replace(/[\s;,|]+$/, "").trim();
  say = say.split(/\n/)[0].replace(/^[«"“„']+|[»"”'\s]+$/g, "").replace(/[»"”]+\s*\.?$/, "").trim();
  return { why: cut(why, 240), say: cut(say, 240) };
}
const keyOf = (c) => c.kind + ":" + c.id;
/** → { picks: [{ ...позиция, why, say }], note }. Только из списка: чужой номер или марка — мимо. */
export function parseSom(reply, list) {
  const t = String(reply || "").replace(/\r/g, "");
  const picks = [], seen = new Set();
  const add = (c, seg) => { if (!c || seen.has(keyOf(c))) return; seen.add(keyOf(c)); const ws = whySay(seg); picks.push({ ...c, why: ws.why || "", say: ws.say || "" }); };
  const marks = [...t.matchAll(/\[\[\s*(?:pick\s*:\s*(\d{1,2})|(wine|spirit|cocktail)\s*:\s*([^\]|]+))\s*\]\]/gi)];
  marks.forEach((m, i) => {
    const seg = t.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : t.length);
    const c = m[1] ? list[Number(m[1]) - 1] : list.find((x) => x.kind === m[2].toLowerCase() && x.id === m[3].trim());
    add(c, seg);
  });
  // разметки нет: строки «1. …» или названия из списка
  if (!picks.length) {
    for (const ln of t.split(/\n+/)) {
      const n = ln.match(/^\s*(\d{1,2})[.)]\s+/);
      const c = n ? list[Number(n[1]) - 1] : list.find((x) => x.title.length >= 4 && norm(ln).includes(norm(x.title)));
      if (c) add(c, n ? ln.slice(n[0].length).replace(new RegExp("^" + c.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[:.,]?", "i"), "") : ln);
    }
  }
  const note = picks.length ? "" : cut(clean(t).replace(/\n+/g, " "), 300);
  return { picks: picks.slice(0, 3), note };
}
/** Без Наставника: лучшие по совпадению, «почему» — что совпало, фраза гостю — из карточки. */
export function localPicks(list, n = 3) {
  return (list || []).slice(0, n).map((c) => {
    const w = (c.why || []).filter(Boolean);
    return { ...c, why: w.length ? w[0][0].toUpperCase() + w.join(", ").slice(1) + "." : "", say: c.say || "", local: true };
  });
}
/** «Подешевле»: дешевле самой доступной из показанных; цен нет — нечего сравнивать. */
export function cheaperThan(picks, glass = false) {
  const p = (picks || []).map((c) => somPrice(c, glass)).filter((x) => x > 0);
  return p.length ? Math.min(...p) : 0;
}

// ── быстрые просьбы одним касанием: фраза в поле (видно, что уйдёт Наставнику) ──
const PH = {
  glass: /(?:,\s*)?(?:по\s+)?бокал[а-яё]*/gi,
  budget: /(?:,\s*)?(?:до|от|не дороже|в пределах|около)\s*\d[\d\s .]*(?:,\d+)?\s*(?:к(?![а-я])|тыс\S*|тысяч\S*)?\s*(?:₽|р\.|руб\S*)?/gi,
  dish: /(?:,\s*)?к\s+«[^»]+»/gi,
  like: /(?:,\s*)?похоже на\s+[^,]+/gi,
  occasion: /(?:,\s*)?(?:аперитив|к десерту|дижестив)/gi,
};
const tidy = (t) => String(t || "").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/^\s*,\s*|\s*,\s*$/g, "").replace(/\s{2,}/g, " ").trim();
/** Поставить или убрать быструю просьбу. phrase пустая — убрать; та же, что стоит, — тоже убрать. */
export function somToggle(text, key, phrase = "") {
  const t = String(text || ""), re = PH[key];
  if (!re) return t;
  const had = t.match(re), same = phrase && had && had.some((h) => norm(h).replace(/^,\s*/, "").trim() === norm(phrase));
  const rest = tidy(t.replace(re, ""));
  if (!phrase || same) return rest;
  return rest ? rest + ", " + phrase : phrase;
}
/** Что из быстрых просьб уже в поле — для подсветки. */
export function somOn(text) {
  const t = String(text || ""), on = {};
  for (const k of Object.keys(PH)) { PH[k].lastIndex = 0; on[k] = PH[k].test(t); PH[k].lastIndex = 0; }
  return on;
}
export const budgetPhrase = (i, steps) => (!steps ? "" : i === 2 ? "от " + rub(steps[1]) : "до " + rub(steps[i]));
// круглые суммы, как у «Подобрать гостю»: до 1 000 — по 50 ₽, до 10 000 — по 500 ₽, дальше — по 1 000 ₽
const nice = (x) => { const step = x < 1000 ? 50 : x < 10000 ? 500 : 1000; return Math.max(step, Math.round(x / step) * step); };
/** Ступени бюджета для быстрой просьбы — по ценам того, что подбираем. Цен две-три (бокалом бывает мало) — ступени по ним. */
export function somBudgetSteps(pool, what, glass) {
  const kinds = kindsFor(what, { kinds: [] });
  const ps = (pool || []).filter((c) => kinds.includes(c.kind)).map((c) => somPrice(c, glass && c.kind === "wine")).filter((x) => x > 0).sort((a, b) => a - b);
  const st = budgetSteps(ps);
  if (st || ps.length < 2) return st;
  const t1 = nice(ps[Math.floor(ps.length / 3)]), t2 = nice(ps[Math.floor((2 * ps.length) / 3)]);
  return t2 > t1 ? [t1, t2] : null;
}
/** «К блюду»: сначала блюда, к которым в карте есть пара, потом остальное меню (не больше max). */
export function dishOptions(dishes, pool, max = 10) {
  const live = (dishes || []).filter((d) => d && d.name && !d.archived && !d.stop);
  const cnt = {};
  for (const c of pool || []) for (const id of c.pair || []) cnt[id] = (cnt[id] || 0) + 1;
  return live.map((d, i) => ({ d, n: cnt[String(d.id)] || 0, i })).sort((a, b) => b.n - a.n || a.i - b.i).slice(0, max).map((x) => x.d);
}
/** «Похоже на…»: известные стили, которые в нашей карте узнаются, и сами вина карты с понятным именем. */
const LIKE_NAMES = [["Шабли", ["шабли", "chablis"]], ["Просекко", ["просекко", "prosecco"]], ["Совиньон блан", ["совиньон блан", "sauvignon blanc"]], ["Пино нуар", ["пино нуар", "pinot noir"]],
  ["Мальбек", ["мальбек", "malbec"]], ["Риоха", ["риох", "rioja"]], ["Кьянти", ["кьянти", "chianti"]], ["Рислинг", ["рислинг", "riesling"]], ["Шампанское", ["шампан", "champagne"]], ["Портвейн", ["портвейн", "porto"]]];
export function likeOptions(pool, max = 6) {
  const wines = (pool || []).filter((c) => c.kind === "wine");
  const found = LIKE_NAMES.filter(([, keys]) => wines.some((c) => keys.some((k) => c.hay.includes(k) || c.place.includes(k)))).map(([nm]) => nm);
  return (found.length >= 3 ? found : [...found, ...LIKE_NAMES.map(([nm]) => nm).filter((x) => !found.includes(x))]).slice(0, max);
}

// ═══ v132 (Доп. 445): «Сомелье» умнее. Владелец (03.11): «Как мы сомелье можем сделать умнее?» — на одиннадцать предложений
// «Берём все». Ниже: профиль блюда и правила сочетаний, вкус по шкалам, уточнение после ответа, «советуем первым» и что у нас
// берут, вся подходящая карта Наставнику (режим «Сомелье» на сервере, ответ JSON), стол из нескольких блюд. ═══

// ── блюдо целиком: из названия, раздела, описания и состава — чем оно «звучит» для пары ──
const PROF_W = {
  red: /говядин|стейк|рибай|миньон|баранин|ягнят|оленин|телятин|бургер|антрекот|вырезк|ребр|мясн/, poultry: /курин|куриц|цыпл|индейк|утк|утин|перепел/,
  fish: /рыб|лосос|семг|форел|тунец|сибас|дорадо|треск|минтай|палтус|судак|осетр|скумбри/, sea: /краб|креветк|устриц|мид|кальмар|гребеш|осьминог|лобстер|омар|морепродукт|икр/,
  fat: /сливоч|сливк|сыр|моцарел|пармезан|масл|жирн|бекон|сало|свинин|фуа|майонез|сметан/, spicy: /остр|чили|халапен|кимчи|том ям|васаби|карри|шрирач|аджик/,
  sweet: /десерт|шоколад|карамел|торт|пирожн|мороже|чизкейк|тирамису|брюле|панакот|сладк|ягодн|мёд|медов/, acid: /томат|помидор|лимон|лайм|цитрус|уксус|маринов|квашен|конкасе/,
  fried: /темпур|фритюр|жарен|панир|кляр|хрустящ/, smoky: /грил|копч|углях|мангал|барбекю/, veg: /овощ|салат|зелен|спарж|гриб|тыкв|баклажан|кабач/,
  salty: /солен|оливк|анчоус|каперс|хамон|прошутто/,
};
const ingText = (d) => (d.ingredients || []).map((x) => (Array.isArray(x) ? x[0] : x)).join(" ");
/** Профиль блюда (или стола): мясо, рыба, жирное, острое, сладкое…; heavy / light — вес. */
export function dishProfile(dishes) {
  const list = (dishes || []).filter(Boolean);
  if (!list.length) return null;
  const text = norm(list.map((d) => [d.name, d.cat, d.desc, ingText(d)].join(" ")).join(" "));
  const p = {};
  for (const [k, re] of Object.entries(PROF_W)) p[k] = re.test(text);
  if (list.some((d) => /десерт/.test(norm(d.cat)))) p.sweet = true;
  p.heavy = p.red || (p.fat && (p.poultry || p.smoky));
  p.light = !p.heavy && (p.fish || p.sea || p.veg);
  return p;
}
const isLightRed = (c) => /пино|гаме|гамэ|неррет|дольчетт|лабруск|санджовезе/.test(c.grapes.join(" "));
// мощные сорта: тело и танины выше среднего (пока шкал нет)
const isBigRed = (c) => /неббиол|каберне|шираз|сира|мальбек|таннат|саперави|аглианико|мурведр|примитив|зинфандел|темпранил/.test(c.grapes.join(" "));
const bodyOf = (c) => (c.taste && c.taste.body) || (c.kind === "wine" ? (c.color === "red" ? (isLightRed(c) ? 2 : isBigRed(c) ? 4 : 3) : c.color === "fortified" ? 4 : c.color === "dessert" ? 3 : 2) : c.kind === "spirit" ? 3 : 0);
const acidOf = (c) => (c.taste && c.taste.acid) || (c.color === "sparkling" ? 4 : c.color === "white" || c.color === "rose" ? 3 : 2);
const tanninOf = (c) => (c.taste && c.taste.tannin) || (c.color === "red" ? (isLightRed(c) ? 2 : isBigRed(c) ? 4 : 3) : 1);
const SWEET_LVL = { dry: 1, semidry: 2, semisweet: 3, sweet: 5 };
const sweetLvl = (c) => (c.taste && c.taste.sweet) || (c.kind === "wine" ? SWEET_LVL[c.sweet] || (c.color === "dessert" ? 5 : 1) : c.kind === "cocktail" ? c.sweetN || 2 : 2);
/** Правила сочетаний: сколько добавить и «почему» словами. */
function pairRule(c, p) {
  let s = 0, why = "";
  if (c.kind === "wine") {
    const red = c.color === "red", fresh = ["white", "sparkling", "rose", "orange"].includes(c.color), spark = c.color === "sparkling";
    const tan = tanninOf(c), body = bodyOf(c), acid = acidOf(c), sw = sweetLvl(c);
    if (p.sweet) {
      if (sw >= 4 || c.color === "dessert" || c.color === "fortified") { s += 3; why = "к десерту: вино слаще десерта"; } else s -= 2;
      return { s, why };
    }
    if (p.red || p.smoky) { if (red && tan >= 3) { s += 2.5; why = "к мясу: танины и тело"; } else if (red) s += 1; else if (body >= 4) s += 0.5; else s -= 1; }
    if (p.fish || p.sea) { if (fresh) { s += 2; why = why || "к рыбе и морепродуктам: свежее, без танинов"; } else if (red && tan <= 2) s += 0.5; else s -= 1.5; }
    if (p.poultry && !p.red && ((fresh && body >= 3) || (red && tan <= 2))) { s += 1.5; why = why || "к птице: среднее тело, мягкие танины"; }
    if (p.fat && (spark || acid >= 4)) { s += 1.5; why = why || "к жирному и сливочному: кислотность освежает"; }
    if (p.spicy) {
      if ((sw >= 2 && sw <= 3) || /рислинг|гевюрц|москат|мускат|торронтес/.test(c.grapes.join(" "))) { s += 2; why = why || "к острому: аромат и лёгкая сладость"; }
      if (tan >= 4) s -= 1;
      if (Number(c.rec && c.rec.abv) >= 14) s -= 1;
    }
    if ((p.fried || p.salty) && spark) { s += 2; why = why || "к жареному и солёному: пузырьки"; }
    if (p.acid && acid >= 4) s += 0.5;
    if (p.heavy && body >= 4) s += 1;
    if (p.light && body <= 2) s += 1;
    if (p.light && body >= 5) s -= 1;
  } else if (c.kind === "spirit") {
    if (p.sweet && ["liqueur", "cognac", "rum"].includes(c.cat)) { s += 1.5; why = "к десерту"; }
    if ((p.red || p.smoky) && c.cat === "whisky") { s += 1; why = why || "к мясу на гриле"; }
  } else if (c.kind === "cocktail") {
    if (p.sweet && ingHas(c, /сливк|кофе|эспрессо|шоколад|какао|амаретто|бейлиз/)) { s += 1.5; why = "к десерту"; }
    if ((p.fish || p.sea) && ingHas(c, /джин|тоник|лайм|лимон|просекко|игрист/)) { s += 1; why = why || "к рыбе: свежий и цитрусовый"; }
  }
  return { s, why };
}

// ── что у нас берут: «Гость взял / Не взял» (этап 47 или телефон) ──
/** Сводка сервера (som_stats) или своего телефона → быстрые таблицы: пара «блюдо|позиция» и позиция. */
export function statsIndex(st) {
  const pairs = {}, items = {};
  for (const x of (st && st.pairs) || []) if (x && x.dish && x.item) pairs[String(x.dish) + "|" + x.item] = Number(x.taken) || 0;
  for (const x of (st && st.items) || []) if (x && x.item) items[x.item] = { taken: Number(x.taken) || 0, declined: Number(x.declined) || 0 };
  return { pairs, items, runs: Number(st && st.runs) || 0, taken: Number(st && st.taken) || 0, declined: Number(st && st.declined) || 0 };
}
/** Журнал телефона (пока на сервере нет этапа 47) → та же сводка, что у som_stats. */
export function statsFromLog(log, days = 90, now = Date.now()) {
  const rows = (log || []).filter((r) => r && now - (Number(r.t) || 0) < days * 864e5);
  const by = {}, pb = {};
  for (const r of rows) {
    if (r.ev === "run") continue;
    const x = by[r.item] || (by[r.item] = { item: r.item, taken: 0, declined: 0 }); x[r.ev] = (x[r.ev] || 0) + 1;
    if (r.ev === "taken") for (const d of r.dishes || []) { const k = d + "|" + r.item; (pb[k] = pb[k] || { dish: d, item: r.item, taken: 0 }).taken++; }
  }
  return { ok: true, days, runs: rows.filter((r) => r.ev === "run").length, taken: rows.filter((r) => r.ev === "taken").length, declined: rows.filter((r) => r.ev === "declined").length,
    items: Object.values(by).sort((a, b) => b.taken - a.taken || a.declined - b.declined), pairs: Object.values(pb).sort((a, b) => b.taken - a.taken) };
}
function statBoost(c, ask) {
  const S = ask.stats, key = c.kind + ":" + c.id;
  let s = 0, why = "";
  const n = ask.dishes.reduce((a, d) => a + (S.pairs[String(d.id) + "|" + key] || 0), 0);
  if (n) { s += Math.min(4, 2 * Math.log2(1 + n)); why = "к этому блюду у нас уже брали: " + n + " " + plural(n, "раз", "раза", "раз"); }
  const it = S.items[key];
  if (it) { s += Math.max(-1.5, Math.min(1.5, (it.taken - it.declined) * 0.3)); if (!why && it.taken >= 3) why = "гости часто берут"; }
  return { s, why };
}
/** Для Наставника: что у нас брали к этому блюду и что берут вообще (до 600 знаков). */
export function statsText(ask, idx, pool) {
  if (!idx) return "";
  const title = (k) => { const c = (pool || []).find((x) => x.kind + ":" + x.id === k); return c ? c.title : ""; };
  const parts = [];
  for (const d of ask.dishes || []) {
    const got = Object.entries(idx.pairs).filter(([k]) => k.startsWith(String(d.id) + "|")).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, n]) => [title(k.slice(String(d.id).length + 1)), n]).filter(([t]) => t);
    if (got.length) parts.push("к «" + d.name + "» брали: " + got.map(([t, n]) => t + " (" + n + ")").join(", "));
  }
  const top = Object.entries(idx.items).filter(([, x]) => x.taken > 0).sort((a, b) => b[1].taken - a[1].taken).slice(0, 4).map(([k, x]) => [title(k), x.taken]).filter(([t]) => t);
  if (top.length) parts.push("чаще всего берут: " + top.map(([t, n]) => t + " (" + n + ")").join(", "));
  return cut(parts.join("; "), 600);
}

// ── уточнение после ответа ──
export const SOM_REFINE = [["light", "Полегче"], ["full", "Насыщеннее"], ["dry", "Посуше"], ["sweet", "Послаще"], ["country", "Другая страна"], ["up", "Подороже"]];
export const REFINE_TEXT = {
  light: "гость просит полегче, чем уже предложенное", full: "гость просит насыщеннее и плотнее, чем уже предложенное", dry: "гость просит посуше",
  sweet: "гость просит послаще", country: "гость хочет вино другой страны",
  up: "гость готов на чуть больше: предложи на ступень дороже, фразой без давления, начни её с «Если хочется чего-то особенного»",
};
/** Отправная точка уточнения: тело и сладость показанного (среднее), их страны и самая высокая цена. */
export function refineOf(key, picks, glass = false) {
  const ps = (picks || []).filter(Boolean);
  const avg = (f) => { const v = ps.map(f).filter((x) => x > 0); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; };
  return { key, body: avg(bodyOf), sweet: avg(sweetLvl), countries: [...new Set(ps.map((c) => c.country).filter(Boolean))], max: Math.max(0, ...ps.map((c) => somPrice(c, glass))) };
}
function refineScore(c, r) {
  const b = bodyOf(c), sw = sweetLvl(c);
  if (r.key === "light") return b && r.body ? (b < r.body ? 2.5 : b === r.body ? 0 : -2) : 0;
  if (r.key === "full") return b && r.body ? (b > r.body ? 2.5 : b === r.body ? 0 : -2) : 0;
  if (r.key === "dry") return r.sweet ? (sw < r.sweet ? 2.5 : sw === r.sweet ? 0 : -2) : 0;
  if (r.key === "sweet") return r.sweet ? (sw > r.sweet ? 2.5 : sw === r.sweet ? 0 : -2) : 0;
  return 0;
}
/** Что можно уточнить после ответа: «Полегче» — если есть легче показанного, и так далее. */
export function refineAvail(pool, ask, what, picks, seen) {
  const out = {};
  for (const [k] of SOM_REFINE) {
    const r = refineOf(k, picks, ask.glass);
    if ((k === "light" || k === "full") && !r.body) continue;
    if ((k === "dry" || k === "sweet") && !(picks || []).some((c) => c.kind !== "cocktail")) continue;
    const sl = somShortlist(pool, { ...ask, refine: r }, { what, exclude: seen, limit: 40 });
    out[k] = k === "light" || k === "full" || k === "dry" || k === "sweet" ? sl.list.filter((c) => refineScore(c, r) > 0).length : sl.total;
  }
  return out;
}

// ── не понял, чего хочет гость: сначала один вопрос с кнопками (без запроса к Наставнику) ──
export const needsClarify = (a) => !!a && !askEmpty(a) && !a.dishes.length && !a.colors.length && !a.sweet && !a.cats.length && !a.like && !a.occasion && !a.budget && !a.budgetMin
  && !a.glass && !a.body && !a.fresh && !a.oak && !(a.countries || []).length && !a.kinds.length && !a.words.length;

// ── «советуем первым» и правила дома: одна запись в меню команды (как настройка карты бара) ──
export const SOM_RULES_ID = "__somrules__";
export const isSomRules = (d) => !!(d && d.id === SOM_RULES_ID);
export function readSomRules(shared) {
  const r = (shared || []).find(isSomRules);
  return { text: r ? String(r.text || "").slice(0, 800) : "", prio: r && Array.isArray(r.prio) ? r.prio.map(String).slice(0, 200) : [], by: r ? String(r.by || "") : "", at: r ? Number(r.at) || 0 : 0 };
}
export function withSomRules(shared, rules) {
  const rest = (shared || []).filter((d) => !isSomRules(d));
  const text = String(rules.text || "").replace(/\s+$/g, "").slice(0, 800), prio = [...new Set((rules.prio || []).map(String))].slice(0, 200);
  return text || prio.length ? [...rest, { id: SOM_RULES_ID, kind: "somrules", text, prio, by: String(rules.by || "").slice(0, 60), at: Number(rules.at) || Date.now() }] : rest;
}

// ── стол из нескольких блюд: «бокал к каждому» — к каждому блюду свой список ──
/** Для каждого блюда стола — лучшие позиции к нему (бокалом у вин). → [{ dish, list }] */
export function tableLists(pool, ask, { what = "all", exclude = [], per = 6 } = {}) {
  const t = ask.table;
  if (!t || !t.each) return [];
  return t.dishes.map((d) => {
    const a = { ...ask, dishes: [d], prof: dishProfile([d]), table: null, glass: true };
    return { dish: d, list: somShortlist(pool, a, { what, exclude, limit: per }).list };
  });
}
/** Блюдо стола у позиции: от Наставника (dish), а нет — первое блюдо, в чьём списке она есть и к которому ещё никого нет. */
export function assignTable(picks, groups) {
  const taken = new Set();
  return (picks || []).map((p) => {
    let d = p.dish >= 1 && p.dish <= groups.length ? p.dish : 0;
    if (!d) { const ins = groups.map((g, i) => (g.list.some((x) => keyOf(x) === keyOf(p)) ? i + 1 : 0)).filter(Boolean); d = ins.find((i) => !taken.has(i)) || ins[0] || 1; }
    taken.add(d);
    return { ...p, dish: d };
  });
}
/** Без Наставника: к каждому блюду — лучшая ещё не взятая позиция. */
export function localTable(groups) {
  const used = new Set(), out = [];
  groups.forEach((g, i) => { const c = g.list.find((x) => !used.has(keyOf(x))); if (c) { used.add(keyOf(c)); out.push({ ...localPicks([c], 1)[0], dish: i + 1 }); } });
  return out;
}

// ── вся подходящая карта Наставнику (режим «Сомелье» на сервере) ──
const dishText = (d) => [d.name, d.cat, cut(d.desc, 380), cut(ingText(d), 300), d.pairing ? "в меню к нему советуют: " + cut(d.pairing, 200) : ""].filter(Boolean).join("; ");
/** Строка карты для Наставника: ★, вид, название, откуда и стиль, цена, вкус по шкалам, ноты, к блюдам. */
export function somCardLine(c, { dishName = null, prio = null } = {}) {
  const notes = (c.notes || []).slice(0, 4).join(", "), tl = tasteLine(c.taste, c.kind);
  const pairs = dishName ? (c.pair || []).map(dishName).filter(Boolean).slice(0, 3).join(", ") : "";
  return cut([(prio && prio.has(c.kind + ":" + c.id) ? "★ " : "") + SOM_KIND_RU[c.kind], c.title + (c.orig ? " (" + c.orig + ")" : ""),
    c.kind === "cocktail" ? [c.line, c.ing.slice(0, 5).join(", ")].filter(Boolean).join("; ") : c.line, c.priceText, tl ? "вкус: " + tl : "",
    notes ? "ноты: " + notes : "", pairs ? "к блюдам: " + pairs : ""].filter(Boolean).join(" · ").replace(/ /g, " "), 258);
}
/** Всё для режима «Сомелье» на сервере: просьба, блюдо целиком (или стол), уточнение, что уже предлагали, правила дома,
 *  что у нас берут, карта (всё, что подходит, лучшие сверху). Номер в карте = номер в ответе. */
export function somPayload(ask, list, { dishName = null, rules = "", prev = [], refine = null, stats = "", prio = null, groups = null } = {}) {
  const t = ask.table;
  return {
    ask: cut(ask.text, 400),
    dish: !t && ask.dishes.length ? ask.dishes.map(dishText).join(" || ") : "",
    table: t ? t.dishes.map((d, i) => (i + 1) + ") " + dishText(d)).join(" || ") + (t.each ? ". Бокал к каждому блюду: по одной позиции на блюдо, в поле dish — номер блюда" : ". Одна бутылка на весь стол: подходит ко всем блюдам") : "",
    refine: refine ? REFINE_TEXT[refine.key] || "" : "",
    prev: (prev || []).map((p) => p.title).filter(Boolean).join(", "),
    rules: cut(rules, 800),
    stats: cut(stats, 700),
    card: list.map((c) => somCardLine(c, { dishName, prio }) + (groups ? " · к блюду " + groups.map((g, i) => (g.list.some((x) => keyOf(x) === keyOf(c)) ? i + 1 : 0)).filter(Boolean).join(", ") : "")),
  };
}
/** Ответ сервера в режиме «Сомелье» (JSON) → { picks, note }; не JSON — null (тогда разбор как раньше). */
export function parseSomJson(reply, list, max = 3) {
  const t = String(reply || ""), a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let j; try { j = JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
  if (!j || !Array.isArray(j.picks)) return null;
  // кавычки снаружи — только если фраза в них целиком («Советую…»); «бокал «бургундия»» не трогаем
  const q = (v, n) => { const x = clean(v); return cut(/^[«"“„]/.test(x) && /[»"”]$/.test(x) && (x.match(/[«»]/g) || []).length <= 2 ? x.slice(1, -1) : x, n); };
  const picks = [], seen = new Set();
  for (const p of j.picks) {
    const c = p && list[Number(p.n) - 1];
    if (!c || seen.has(keyOf(c))) continue;
    seen.add(keyOf(c));
    picks.push({ ...c, why: q(p.why, 240), say: q(p.say, 260), short: q(p.short, 120), story: q(p.story, 320), serveAi: q(p.serve, 160), dish: Number(p.dish) || 0 });
  }
  return { picks: picks.slice(0, max), note: q(j.note, 300) };
}
