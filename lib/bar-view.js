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
