// lib/bar-view.js — v128 (Доп. 441): «Барная карта» удобнее, проще и красивее: как показывать позиции. Без React.
//
// Владелец (01.11): «как мы барную карту можем сделать удобнее, проще, и красивее?» и на предложения — «Делаем все».
// По его записи экрана: 120 вин, «не проверено 118» (команда учит только 2), двуязычные названия в две-три строки,
// «Австрия, Австрия», долго листать вниз и обратно. Здесь — что для этого считается:
//   • название «Русское / Original» — две строки: русское крупно, оригинал мельче (nameParts, titleParts);
//   • страна и регион без повтора (placeText): его берут lib/wine.js, lib/spirit.js и тренировка;
//   • «Подобрать гостю»: бюджет по ценам своей карты (budgetSteps: три ступени, круглые числа) и сладость вина (sweetOf);
//   • сколько ждёт проверки словами (checkWord).
// Ничего не импортирует из lib/wine.js и lib/spirit.js (они берут отсюда placeText): вид напитка K передаётся снаружи.

const norm = (t) => String(t || "").toLowerCase().replace(/ё/g, "е").replace(/[«»"'’`.,:;!?()\-–—]/g, " ").replace(/\s+/g, " ").trim();

/** Страна и регион без повтора: «Австрия» и «Австрия» — «Австрия»; «Франция» и «Франция, Шампань» — «Франция, Шампань». */
export function placeText(country, region) {
  const c = String(country == null ? "" : country).trim(), r = String(region == null ? "" : region).trim();
  if (!r) return c;
  if (!c) return r;
  const nc = norm(c), nr = norm(r);
  if (nr === nc) return c;
  if (nr.startsWith(nc + " ")) return r;
  return c + ", " + r;
}

// русское и оригинал: в одной части кириллица, в другой латиница (бленд «Каберне / Мерло» — одно название, не два)
const cyr = (t) => (String(t).match(/[А-Яа-яЁё]/g) || []).length, lat = (t) => (String(t).match(/[A-Za-zÀ-ÿ]/g) || []).length;
const isRu = (t) => cyr(t) > 0 && cyr(t) >= lat(t), isOrig = (t) => lat(t) > 0 && lat(t) > cyr(t) * 3;
/** Название из карты «Русское / Original» — две строки: main (крупно) и orig (мельче). Не так — orig пустой. */
export function nameParts(name) {
  const s = String(name == null ? "" : name).replace(/\s+/g, " ").trim();
  const i = s.indexOf(" / ");
  if (i <= 0) return { main: s, orig: "" };
  const a = s.slice(0, i).trim(), b = s.slice(i + 3).trim();
  if (a && b && isRu(a) && isOrig(b)) return { main: a, orig: b };
  if (a && b && isOrig(a) && isRu(b)) return { main: b, orig: a };
  return { main: s, orig: "" };
}
/** Заголовок позиции в две строки: год или выдержка — к русскому названию (как у K.title), оригинал — отдельно. */
export function titleParts(K, w) {
  const p = nameParts(w && w.name);
  return p.orig ? { main: K.title({ ...w, name: p.main }), orig: p.orig } : { main: K.title(w), orig: "" };
}

// ── «Подобрать гостю» ──
/** Сладость вина группой: сухое (и брют), полусухое (и экстра сухое игристое), полусладкое, сладкое; не понять — "". */
export const SWEET = [["dry", "сухое"], ["semidry", "полусухое"], ["semisweet", "полусладкое"], ["sweet", "сладкое"]];
export function sweetOf(w) {
  const s = norm(w && w.sweet);
  if (!s) return "";
  if (/полуслад|semi ?sweet|demi ?sec|medium sweet/.test(s)) return "semisweet";
  if (/полусух|semi ?dry|medium dry|экстра сух|экстра драй|extra dry/.test(s)) return "semidry";
  if (/слад|десерт|dulce|doux|sweet/.test(s)) return "sweet";
  if (/сух|брют|brut|dry|натур|natur|zero|зеро|pas dose/.test(s)) return "dry";
  return "";
}
/** Цена для бюджета: у вин — бутылка (в «Бокалом» — бокал), у крепкого — порция. */
export const budgetPrice = (K, w, glass = false) => Number(w && (K.kind === "spirit" ? w.pricePortion : glass ? w.priceGlass : w.priceBottle)) || 0;
// круглые ступени: до 1 000 — по 50 ₽, до 10 000 — по 500 ₽, дальше — по 1 000 ₽
const nice = (x) => { const step = x < 1000 ? 50 : x < 10000 ? 500 : 1000; return Math.max(step, Math.round(x / step) * step); };
/** Три ступени бюджета по ценам своей карты: [до первой трети, до второй] — круглыми числами; цен меньше четырёх — null. */
export function budgetSteps(prices) {
  const p = (prices || []).map(Number).filter((x) => x > 0).sort((a, b) => a - b);
  if (p.length < 4) return null;
  const at = (k) => p[Math.min(p.length - 1, Math.floor(k * p.length))];
  const t1 = nice(at(1 / 3)), t2 = nice(at(2 / 3));
  return t2 > t1 ? [t1, t2] : null;
}
/** b: 0 — любой, 1 — до первой ступени, 2 — до второй, 3 — дороже второй. Без цены в бюджет не попадает. */
export function inBudget(price, b, steps) {
  if (!b || !steps) return true;
  const x = Number(price) || 0;
  if (!x) return false;
  return b === 1 ? x <= steps[0] : b === 2 ? x <= steps[1] : x > steps[1];
}
const rub = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";   // неразрывные, как в карте
export const budgetLabels = (steps) => (steps ? ["до " + rub(steps[0]), "до " + rub(steps[1]), "от " + rub(steps[1])] : []);

/** «118 вин ждут проверки», «1 позиция ждёт проверки». */
export const checkWord = (K, n) => K.word(n) + (n % 10 === 1 && n % 100 !== 11 ? " ждёт проверки" : " ждут проверки");

// ── v136 (Доп. 449): «Барная карта» ещё удобнее и красивее. Владелец (04.11): «Как думаешь, ещё удобнее и красивее барную
// карту можно сделать?» — на десять предложений «Давай все» (первый, «карта сразу на первом экране», пока отложен) ──

/** Цветная точка раздела: у вин — цвет вина, у крепкого — вид, у коктейлей — основа (в кнопке раздела и в заголовке). */
export const DOT = {
  wine: { sparkling: "#D9C27A", white: "#E9E2A0", rose: "#EBA3AE", orange: "#E39A55", red: "#A3303F", dessert: "#D9A24A", fortified: "#8E4A24", other: "#B9A88A" },
  spirit: { whisky: "#C98A3A", cognac: "#B36F2C", rum: "#8A4A1E", gin: "#9CC3CF", agave: "#C9D4A0", vodka: "#DCE6EA", liqueur: "#C25F6E", bitter: "#D8432E", other: "#B9A88A" },
  cocktail: { "Джин": "#9CC3CF", "Водка": "#DCE6EA", "Ром": "#8A4A1E", "Текила": "#C9D4A0", "Виски": "#C98A3A", "Бренди": "#B36F2C", "Другое": "#B9A88A" },
};
export const dotOf = (kind, key) => (DOT[kind] && DOT[kind][key]) || "";

/** Порядок списка: по разделам (как было), по цене (дешевле сначала; в «Бокалом» — по цене бокала; без цены — в конце), по алфавиту. */
export const SORTS = [["sec", "Разделы"], ["price", "Цена"], ["az", "А–Я"]];
const byTitle = (title) => (a, b) => String(title(a)).localeCompare(String(title(b)), "ru", { numeric: true, sensitivity: "base" });
/** price(x) — цена позиции для порядка «Цена» (0 — без цены); title(x) — название для «А–Я». "sec" — как есть. */
export function sortItems(items, mode, { price = () => 0, title = (x) => x.name } = {}) {
  const list = [...(items || [])], t = byTitle(title);
  if (mode === "az") return list.sort(t);
  if (mode === "price") return list.sort((a, b) => { const pa = Number(price(a)) || 0, pb = Number(price(b)) || 0; return (pa ? 0 : 1) - (pb ? 0 : 1) || pa - pb || t(a, b); });
  return list;
}

// вкус по шкалам: средняя разница по осям, известным у обоих (от 1 до 5); осей меньше двух — не знаем
const AXES = { wine: ["body", "acid", "tannin", "sweet", "oak"], spirit: ["body", "sweet", "smoke", "oak", "spice"] };
function tasteDist(a, b, kind) {
  if (!a || !b) return null;
  const d = (AXES[kind] || []).filter((k) => Number(a[k]) > 0 && Number(b[k]) > 0).map((k) => Math.abs(Number(a[k]) - Number(b[k])));
  return d.length >= 2 ? d.reduce((s, x) => s + x, 0) / d.length : null;
}
/** Похожие в нашей карте (и «сегодня нет, предложи вместо»): тот же цвет вина или вид крепкого (+3), вкус по шкалам рядом
 *  (до +3), цена рядом (+2 в пределах 30 %, +1 в пределах 60 %), та же страна (+1), общий сорт (вина) или тот же стиль
 *  (крепкое) (+1), бокалом к бокалом (+0,5). Не она сама, не в стопе и не в архиве; счёт меньше min — не похожа. */
export function similarOf(K, w, all, { n = 3, min = 3.5 } = {}) {
  if (!w) return [];
  const p0 = budgetPrice(K, w), g0 = K.groupKey(w), grapes = new Set((w.grapes || []).map(norm).filter(Boolean)), c0 = norm(w.country), st0 = norm(w.style);
  const out = [];
  for (const x of all || []) {
    if (!x || x.id === w.id || x.archived || x.stop) continue;
    let s = 0;
    if (g0 && K.groupKey(x) === g0) s += 3;
    const td = tasteDist(w.taste, x.taste, K.kind);
    if (td != null) s += Math.max(0, 3 - td);
    const p = budgetPrice(K, x);
    if (p0 && p) { const r = Math.abs(p - p0) / p0; s += r <= 0.3 ? 2 : r <= 0.6 ? 1 : 0; }
    if (c0 && norm(x.country) === c0) s += 1;
    if (K.kind === "wine" && (x.grapes || []).some((g) => grapes.has(norm(g)))) s += 1;
    if (K.kind === "spirit" && st0 && norm(x.style) === st0) s += 1;
    if (K.kind === "wine" && w.byGlass && x.byGlass) s += 0.5;
    if (s >= min) out.push([s, x]);
  }
  return out.sort((a, b) => b[0] - a[0] || String(a[1].name).localeCompare(String(b[1].name), "ru", { numeric: true })).slice(0, n).map(([, x]) => x);
}
