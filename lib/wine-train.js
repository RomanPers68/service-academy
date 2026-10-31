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
// ── v124 (Доп. 437): «Вино к блюду» — гость заказал блюдо, что предложить из вина ──
/** Блюда меню, к которым в карте есть проверенные вина (по полю «к блюдам» у вина): [{ dish, wines }]. */
export function dishPairs(wines, dishes) {
  const list = trainable(wines);
  return (dishes || []).filter((d) => d && d.id && d.name).map((d) => ({ dish: d, wines: list.filter((w) => (w.pair || []).includes(d.id)) })).filter((x) => x.wines.length);
}
/** Вопросы: блюдо → одно из его вин среди трёх-четырёх вариантов из карты. Другие вина к этому блюду в варианты не идут
 *  (иначе верных было бы два); сначала — вина другого цвета, чем верное: красное к стейку не спорит с другим красным.
 *  Пояснение — все вина к блюду и что сомелье написал о верном. До n вопросов, блюда не повторяются. */
export function pairQuiz(wines, dishes, { n = 8, seed = Date.now() } = {}) {
  const list = trainable(wines), rnd = rng(seed);
  const out = [];
  for (const { dish, wines: rightAll } of shuffle(dishPairs(wines, dishes), rnd)) {
    if (out.length >= n) break;
    const right = rightAll[Math.floor(rnd() * rightAll.length)];
    const others = shuffle(list.filter((w) => !rightAll.includes(w)), rnd);
    const wrong = [...others.filter((w) => w.color !== right.color), ...others.filter((w) => w.color === right.color)].slice(0, 3);
    if (!wrong.length) continue;
    const opts = shuffle([right, ...wrong], rnd);
    out.push({ id: dish.id, dish: dish.name, img: dish.img || "", q: `Гость заказал «${dish.name}». Что предложить из вина?`, options: opts.map(wineTitle), wines: opts.map((w) => w.id),
      answer: opts.indexOf(right), why: "К нему в карте: " + rightAll.map(wineTitle).join(", ") + (right.pairNote ? ". О «" + wineTitle(right) + "»: " + right.pairNote : "") });
  }
  return out;
}
// ── «Опиши за 60 секунд»: что сказать гостю о вине — по чему сверяться после минуты ──
/** Пункты сверки: откуда, сорт, стиль, ноты, к чему подать, фраза гостю (только заполненные в карточке). */
export function describePoints(w, dishes = []) {
  if (!w) return [];
  const dishName = (id) => ((dishes || []).find((d) => d && d.id === id) || {}).name || "";
  const pairs = (w.pair || []).map(dishName).filter(Boolean);
  return [["place", "Откуда", [w.country, w.region].filter(Boolean).join(", ")], ["grape", "Сорт", (w.grapes || []).join(", ")],
    ["style", "Стиль", [w.color && COLOR_RU[w.color] ? COLOR_RU[w.color].toLowerCase() : "", w.sweet].filter(Boolean).join(" ")],
    ["notes", "Ноты", (w.notes || []).join(", ")], ["pair", "К чему подать", pairs.join(", ") || w.pairNote || ""], ["short", "Фраза гостю", w.short ? "«" + w.short + "»" : ""]]
    .filter(([, , v]) => v).map(([key, label, value]) => ({ key, label, value }));
}
/** Вино для «Опиши за 60 секунд»: из проверенных, где есть что сверить (хотя бы три пункта); не то же, что сейчас. */
export function describePick(wines, dishes, notId = "", rnd = Math.random) {
  const ok = trainable(wines).filter((w) => w.id !== notId && describePoints(w, dishes).length >= 3);
  return ok.length ? ok[Math.floor(rnd() * ok.length)] : null;
}

// ── v125 (Доп. 438): «Кто выучил новые вина» — телефон присылает тренировку на сервер (этап 44), руководитель видит команду ──
/** Счёт «Знаю?» для сервера: сколько проверенных вин выучено из скольких; путь новичка — вина бокалом. */
export function wineStats(wines, sr, now = Date.now()) {
  const list = trainable(wines), g = glassPath(wines, sr, now);
  return { known: list.filter((w) => srKnown(sr, w.id, now)).length, total: list.length, glassKnown: g.known, glassTotal: g.total };
}
/** Строка сотрудника у руководителя. state по ТЕКУЩИМ новым винам (fresh): passed — выучил все; opened — открывал или
 *  выучил часть; notnew — занимался винами, новые не открывал; active — новых вин нет, но занимался; none — ничего не
 *  присылал. left — сколько новых ещё не выучено. */
export function teamRow(r, fresh) {
  const passed = Array.isArray(r && r.passed) ? r.passed : [], opened = Array.isArray(r && r.opened) ? r.opened : [];
  const ids = (fresh || []).map((w) => w.id);
  const state = !(r && r.at) ? "none" : !ids.length ? "active" : ids.every((id) => passed.includes(id)) ? "passed"
    : ids.some((id) => passed.includes(id) || opened.includes(id)) ? "opened" : "notnew";
  return { ...r, passed, opened, state, left: ids.filter((id) => !passed.includes(id)).length };
}
const STATE_ORDER = { passed: 0, opened: 1, notnew: 2, active: 2, none: 3 };
/** Команда для экрана: выучившие новые вина — выше, потом учат, потом не открывали, потом не занимались; внутри — по имени. */
export const teamRows = (rows, fresh) => (rows || []).filter((r) => r && r.id).map((r) => teamRow(r, fresh))
  .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || String(a.name || "").localeCompare(String(b.name || ""), "ru"));
/** Итог одной строкой: сколько выучили новые вина, учат, не открывали, не занимались. */
export function teamSummary(rows) {
  const n = (k) => rows.filter((r) => r.state === k).length;
  return { total: rows.length, passed: n("passed"), opened: n("opened"), notnew: n("notnew"), active: n("active"), none: n("none") };
}

// ── v126 (Доп. 439): выученное до v125 — на сервер. До v125 «Выучил новые вина ✓» и «Знаю?» жили только на телефоне;
// теперь телефон досылает их сам, один раз (что ушло — помнит), и только если на телефоне не входили другие люди ──
export const syncKey = (restaurant) => "sa_wine_sync_" + (restaurant || "x");
/** Что досылать. learned — выученная волна на телефоне, sr — «Знаю?», sent — что уже ушло ({ passed: "id,id", stats: 1 }):
 *  волна, которой сервер не видел, — "passed" (со счётом «Знаю?»); иначе счёт, если тренировался, а он не уходил. */
export function catchUpPlan(learned, sr, sent) {
  const ids = (Array.isArray(learned) ? learned : []).filter((x) => typeof x === "string" && x);
  const s = sent && typeof sent === "object" && !Array.isArray(sent) ? sent : {};
  if (ids.length && s.passed !== ids.join(",")) return { kind: "passed", ids };
  if (sr && typeof sr === "object" && !Array.isArray(sr) && Object.keys(sr).length && !s.stats) return { kind: "stats", ids: [] };
  return null;
}
/** Что ушло после сообщения kind: выученная волна (у "passed") и счёт «Знаю?» — он идёт с каждым сообщением. */
export const sentAfter = (sent, kind, ids) => ({ ...(sent && typeof sent === "object" && !Array.isArray(sent) ? sent : {}),
  ...(kind === "passed" ? { passed: (Array.isArray(ids) ? ids : []).join(",") } : {}), stats: 1 });
/** Кто ещё входил на этом телефоне: личные ключи роли и серии других людей (sa_last_role_Имя_Фамилия, sa_streak_Имя_…).
 *  «Выучил» и «Знаю?» на телефоне общие для заведения: на общем телефоне не узнать, чьи они, и досылать их нельзя. */
export function otherUsers(uk, keys) {
  const re = /^sa_(?:last_role|streak)(_.*)$/;
  return [...new Set((keys || []).map((k) => (String(k).match(re) || [])[1]).filter((x) => x && x !== uk))];
}

/** Итог: сколько верно и какие вина повторить (по разу). */
export function quizScore(questions, picks) {
  const wrong = [];
  let right = 0;
  (questions || []).forEach((q, i) => { if (picks && picks[i] === q.answer) right++; else if (!wrong.includes(q.wine)) wrong.push(q.wine); });
  return { right, total: (questions || []).length, wrong };
}
