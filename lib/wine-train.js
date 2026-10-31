// lib/wine-train.js — v123 (Доп. 436): тренировка по винной карте. Без React.
//
// Владелец (31.10): «Вин будет достаточно и, к большому сожалению, их учить очень сложно, особенно для новичка. Может,
// сделаем как в меню, с тренировками, викторинами и т. д.?». В тренировку идут только проверенные вина (без пометок AI):
// новичок не должен учить то, что AI мог перепутать. Колода с интервальным повторением (как у меню и бара: 1 → 3 → 7 →
// 30 дней), путь новичка — сначала вина бокалом, «Новые вина» — добавленные за 30 дней, викторина — вопросы по своей
// карте: откуда, какой сорт, какой стиль, есть ли бокалом, к какому блюду, какое вино по фразе гостю.
import { COLOR_RU, unchecked, wineTitle, wineLine, normName } from "./wine.js";

export const SR_DAYS = [1, 3, 7, 30];
export const NEW_DAYS = 30;
const DAY = 864e5;

/** В тренировку — живые (не в архиве), с названием и проверенные. */
export const trainable = (wines) => (wines || []).filter((w) => w && w.name && !w.archived && !unchecked(w));
/** Новое вино: добавлено за последние 30 дней (addedAt ставит редактор при добавлении). */
export const isNewWine = (w, now = Date.now()) => !!(w && w.addedAt && now - w.addedAt < NEW_DAYS * DAY);
/** «Новые вина» — проверенные и добавленные за 30 дней, но только когда в карте есть и прежние: карту, которую только
 *  что завели целиком, учат с начала («С чего начать», колода), а не как 140 новинок. */
export function newWines(wines, now = Date.now()) {
  const list = trainable(wines);
  return list.some((w) => !isNewWine(w, now)) ? list.filter((w) => isNewWine(w, now)) : [];
}
// «Выучил новые вина» — на телефоне, по ресторану: какие вина были в выученной волне. Добавили вино — оно не в списке,
// и «Новые вина» снова ждут; вино через 30 дней выходит из новых — выученное не сбрасывается.
export const learnedKey = (restaurant) => "sa_wine_learned_" + (restaurant || "x");
export const allLearned = (list, ids) => !!(list && list.length) && list.every((w) => (ids || []).includes(w.id));

// ── «Знаю?»: интервальное повторение, прогресс — на телефоне, по ресторану ──
export const srKey = (restaurant) => "sa_wine_sr_" + (restaurant || "x");
/** Отметить карточку: знал — следующая ступень (1, 3, 7, 30 дней), не знал — к повтору сейчас. */
export function srMark(sr, id, ok, now = Date.now()) {
  const cur = (sr && sr[id]) || { stage: 0 };
  const stage = ok ? Math.min((cur.stage || 0) + 1, SR_DAYS.length) : 0;
  return { ...(sr || {}), [id]: { stage, due: now + (ok ? SR_DAYS[stage - 1] * DAY : 0) } };
}
/** Пора повторить: ни разу не отмечали или срок подошёл. */
export const srDue = (sr, id, now = Date.now()) => { const r = sr && sr[id]; return !r || !r.due || r.due <= now; };
/** Выучено: знал хотя бы раз и срок повтора ещё не подошёл. */
export const srKnown = (sr, id, now = Date.now()) => { const r = sr && sr[id]; return !!(r && r.stage > 0 && r.due > now); };
/** Путь новичка: сначала вина бокалом (их спрашивают чаще всего), выучено N из M. «Сегодня нет» не считается: в повтор
 *  оно не идёт (как у меню), и путь не застревает на нём. */
export function glassPath(wines, sr, now = Date.now()) {
  const list = trainable(wines).filter((w) => w.byGlass && !w.stop);
  return { list, known: list.filter((w) => srKnown(sr, w.id, now)).length, total: list.length };
}

// ── колода ──
/** «Наоборот»: описание без названия — так гость и просит («что-нибудь белое, сухое, минеральное»). Без производителя
 *  и года: они почти всегда в названии. Меньше двух подсказок — карточка в «Наоборот» не идёт. */
export function reverseClues(w) {
  if (!w) return [];
  return [[w.country, w.region].filter(Boolean).join(", "), (w.grapes || []).join(", "),
    [w.color && COLOR_RU[w.color] ? COLOR_RU[w.color].toLowerCase() : "", w.sweet].filter(Boolean).join(" "),
    (w.notes || []).slice(0, 4).join(", ")].filter(Boolean);
}
export const reversible = (w) => reverseClues(w).length >= 2;

// ── викторина ──
const placeOf = (w) => [w.country, w.region].filter(Boolean).join(", ");
const grapesOf = (w) => (w.grapes || []).join(", ");
const styleOf = (w) => [w.color && COLOR_RU[w.color] ? COLOR_RU[w.color].toLowerCase() : "", w.sweet].filter(Boolean).join(" ");
const rub = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") + "\u00a0₽";   // неразрывные, как в lib/wine.js
/** Детерминированный «случай» (для проверок): mulberry32. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// варианты: верный + до трёх других значений из своей карты, без повторов по смыслу и без «тоже верных»: «Франция» рядом
// с «Франция, Бургундия», «белое» рядом с «белое сухое», бленд с тем же сортом — не варианты (clash)
const words = (v) => normName(v).split(" ").filter(Boolean);
const prefixClash = (a, b) => { const x = words(a), y = words(b), n = Math.min(x.length, y.length); return x.slice(0, n).join(" ") === y.slice(0, n).join(" "); };
const grapeSet = (v) => String(v || "").split(",").map(normName).filter(Boolean);
const grapeClash = (a, b) => { const x = grapeSet(a); return grapeSet(b).some((g) => x.includes(g)); };
function options(right, pool, rnd, n = 4, clash = prefixClash) {
  const seen = [right], other = [];
  for (const v of shuffle(pool, rnd)) { if (!v || seen.some((x) => normName(x) === normName(v) || clash(x, v))) continue; seen.push(v); other.push(v); if (other.length >= n - 1) break; }
  if (!other.length) return null;
  const all = shuffle([right, ...other], rnd);
  return { options: all, answer: all.indexOf(right) };
}

/** Вопросы по своей карте. dishes — блюда меню команды (для «к какому блюду»). До n вопросов, у каждого вина — не больше
 *  двух, виды вопросов чередуются; верный ответ и пояснение — из карточки вина. */
export function makeQuiz(wines, dishes = [], { n = 10, seed = Date.now() } = {}) {
  const list = trainable(wines);
  if (list.length < 2) return [];
  const rnd = rng(seed);
  const dishName = (id) => ((dishes || []).find((d) => d && d.id === id) || {}).name || "";
  // пояснение после ответа — вся строка вина и фраза гостю: запоминается связкой, а не одним фактом
  const card = (w) => [wineLine(w), w.short ? "Гостю: «" + w.short + "»" : ""].filter(Boolean).join(". ");
  const kinds = [
    { k: "place", ok: (w) => !!placeOf(w), q: (w) => `Откуда «${wineTitle(w)}»?`, right: placeOf, pool: () => list.map(placeOf), why: card },
    { k: "grape", ok: (w) => !!grapesOf(w), q: (w) => `Из какого винограда «${wineTitle(w)}»?`, right: grapesOf, pool: () => list.map(grapesOf), clash: grapeClash, why: card },
    { k: "style", ok: (w) => !!styleOf(w), q: (w) => `Какое «${wineTitle(w)}» по стилю?`, right: styleOf, pool: () => list.map(styleOf), why: (w) => [card(w), (w.notes || []).length ? "Ноты: " + w.notes.slice(0, 4).join(", ") : ""].filter(Boolean).join(". ") },
    { k: "phrase", ok: (w) => !!w.short, q: (w) => `Какое вино гостю так и описывают: «${w.short}»?`, right: wineTitle,
      pool: (w) => list.filter((x) => normName(x.short) !== normName(w.short)).map(wineTitle), clash: () => false, why: (w) => wineTitle(w) + (wineLine(w) ? ": " + wineLine(w) : "") },
    { k: "dish", ok: (w) => (w.pair || []).some(dishName), q: (w) => `К какому блюду предложить «${wineTitle(w)}»?`, right: (w) => dishName((w.pair || []).find(dishName)),
      pool: (w) => (dishes || []).filter((d) => d && d.name && !(w.pair || []).includes(d.id)).map((d) => d.name), clash: () => false, why: (w) => "К нему: " + (w.pair || []).map(dishName).filter(Boolean).join(", ") + (w.pairNote ? ". " + w.pairNote : "") },
    { k: "glass", ok: (w) => list.some((x) => x.byGlass) && list.some((x) => !x.byGlass), q: (w) => `Есть ли «${wineTitle(w)}» бокалом?`, right: (w) => (w.byGlass ? "Да, бокалом" : "Только бутылкой"),
      pool: (w) => [w.byGlass ? "Только бутылкой" : "Да, бокалом"], clash: () => false, why: (w) => (w.byGlass ? "Бокалом" + (w.priceGlass ? ", " + rub(w.priceGlass) : "") : "Только бутылкой") + (w.priceBottle ? ", бутылка " + rub(w.priceBottle) : "") },
  ];
  const out = [], used = {};
  let turn = 0;
  for (const w of shuffle(list, rnd).concat(shuffle(list, rnd))) {
    if (out.length >= n) break;
    if ((used[w.id] || 0) >= 2) continue;
    for (let t = 0; t < kinds.length; t++) {
      const kind = kinds[(turn + t) % kinds.length];
      if (!kind.ok(w) || out.some((x) => x.wine === w.id && x.kind === kind.k)) continue;
      const right = kind.right(w);
      const o = right ? options(right, kind.pool(w), rnd, kind.k === "glass" ? 2 : 4, kind.clash || prefixClash) : null;
      if (!o) continue;
      // фото бутылки — подсказка, кроме вопроса «какое вино по фразе»: на этикетке как раз ответ
      out.push({ id: w.id + ":" + kind.k, wine: w.id, kind: kind.k, q: kind.q(w), options: o.options, answer: o.answer, why: kind.why(w), img: kind.k === "phrase" ? "" : w.img || "" });
      used[w.id] = (used[w.id] || 0) + 1; turn = (turn + t + 1) % kinds.length;
      break;
    }
  }
  return out;
}
/** Итог: сколько верно и какие вина повторить (по разу). */
export function quizScore(questions, picks) {
  const wrong = [];
  let right = 0;
  (questions || []).forEach((q, i) => { if (picks && picks[i] === q.answer) right++; else if (!wrong.includes(q.wine)) wrong.push(q.wine); });
  return { right, total: (questions || []).length, wrong };
}
