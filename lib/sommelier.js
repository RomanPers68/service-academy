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
  // остальные слова — к нотам и описанию
  const used = new Set([...(ask.like ? wordsOf(ask.like) : []), ...ask.dishes.flatMap((d) => wordsOf(d.name))]);
  ask.words = words.filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !STOP.has(w) && !used.has(w)
    && ![...COLOR_W, ...SWEET_W, ...CAT_W, ...OCC_W].some(([, re]) => re.test(w)) && !WINE_W.test(w) && !SPIRIT_W.test(w) && !CK_W.test(w)
    && ![...used].some((u) => w.startsWith(stem(u)) || u.startsWith(stem(w)))).slice(0, 8);
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
      img: w.img || "", checked: !(w.ai || []).length, hay: norm([tp.main, tp.orig, w.producer, WINE.line(w), (w.notes || []).join(" "), w.short, w.pairNote].join(" ")), rec: w });
  }
  for (const w of spirits || []) if (w && !w.archived && !w.stop) {
    const tp = titleParts(SPIRIT, w);
    out.push({ kind: "spirit", id: String(w.id), title: tp.main, orig: tp.orig, line: SPIRIT.line(w), priceText: SPIRIT.price(w), portion: priceN(w.pricePortion), bottle: priceN(w.priceBottle),
      cat: w.cat || "", place: norm([w.country, w.region].join(" ")), notes: w.notes || [], say: w.short || "", pair: (w.pair || []).map(String), img: w.img || "", checked: !(w.ai || []).length,
      hay: norm([tp.main, tp.orig, w.producer, SPIRIT.line(w), w.style, w.age, (w.notes || []).join(" "), (w.serve || []).join(" "), w.short, w.pairNote].join(" ")), rec: w });
  }
  for (const c of cocktails || []) if (c && !c.archived && !c.stop) {
    const ing = (c.ing || []).map((i) => (Array.isArray(i) ? i[0] : i)).filter(Boolean);
    out.push({ kind: "cocktail", id: String(c.id), title: c.name || "", orig: "", line: [cocktailBase(c), c.method, GLASS_RU[c.glass] || ""].filter(Boolean).join(" · "), priceText: c.price ? rub(c.price) : "",
      price: priceN(c.price), ing, strength: Number(c.strength) || 0, sweetN: Number(c.sweet) || 0, method: norm(c.method), say: ckSay(c), house: !!c.house, img: "", checked: true,
      hay: norm([c.name, ing.join(" "), c.method, GLASS_RU[c.glass], cocktailBase(c), ckSay(c)].join(" ")), rec: c });
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
