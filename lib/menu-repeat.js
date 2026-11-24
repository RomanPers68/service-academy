// lib/menu-repeat.js — v193 (Доп. 518): меню в ежедневном повторе, ненавязчиво.
//
// Владелец (24.11): «Мы можем сделать так, чтобы оно ненавязчиво советовало повторить несколько блюд? Может перед сменой,
// или же во время. В общем и целом меню вживить в ежедневный или же не ежедневный повтор». Из семи предложенных идей —
// «Давай по классике. Все»:
//   1) блюда в разминке до смены: 2–3 карточки «вспомни и переверни», «Знаю» / «Не уверен» (ui/dish-step.jsx);
//   2) одно блюдо в перерыв: строка на главной карточке «на смене», карточка тут же, без меню (ui/dish-moments.jsx);
//   3) каждый второй «Вопрос дня» — из меню; ошибка — в повтор (lib/qday.js, lib/menu-pack.js);
//   4) новинки сами встают в повтор, пока не отметишь «Знаю»;
//   5) после смены: «Спросили о блюде, а ты не знал?» — завтра оно первым в разминке;
//   6) свой ритм в «Напоминаниях»: каждую смену, через смену, раз в неделю или не нужно; 2 или 3 блюда;
//   7) руководителю «Как команда знает меню»: слабые блюда, «В разминку команде», «В фокус смены» (этап 59).
// Здесь — чистые функции и ключи телефона, без данных меню и React: их читают App, стол разминки, сервер-демо и тесты.
// «Знаю?» — тот же счёт, что в «Колоде меню» (ui/menu-deck.jsx): ступени 1 → 3 → 7 → 30 дней, на телефоне, по заведению.
// «.js» в путях — модуль читают и тесты в Node.

import { qdayKey } from "./qday.js";

export const SR_DAYS = [1, 3, 7, 30];
export const NEW_DAYS = 30;          // новинка — добавлена за 30 дней (как «Новые позиции» в тренажёре и брифинг)
export const ASK_DAYS = 7;           // «спросили, а не знал» ждёт в разминке неделю, пока не отметишь «Знаю»
export const NEXT_MAX = 6;           // своя очередь для сервера (напоминание за час до смены)
export const KNOW_MAX = 400;         // блюд в «Знаю?» для сервера
export const MENU_SR_EVENT = "sa-menu-sr";   // поменялся «Знаю?», ритм, «спросили» или просьба руководителя
const DAY = 864e5;

const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } };
const emit = () => { try { window.dispatchEvent(new Event(MENU_SR_EVENT)); } catch (e) { /* без окна (тесты) */ } };
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
const nrm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
export const dishWord = (n) => plural(n, "блюдо", "блюда", "блюд");

// ── дни по местному календарю: номер дня с 1970 года (сервер считает так же — по часам заведения) ──
export const localDay = (ms) => { const d = new Date(Number(ms) || 0); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); };
export const isoDay = (iso) => { if (!ISO.test(String(iso || ""))) return 0; const [y, m, d] = String(iso).split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
export const isoOf = (n) => new Date(Number(n) * DAY).toISOString().slice(0, 10);
/** Понедельник недели дня «ГГГГ-ММ-ДД». */
export function mondayOf(iso) { const n = isoDay(iso); if (!n) return ""; const dow = (new Date(n * DAY).getUTCDay() + 6) % 7; return isoOf(n - dow); }

// ── «Знаю?» по заведению: { id: { stage, due, t } } (t — когда отмечали; m — когда ошибся или спросили, а не знал) ──
export const srKey = (restaurant) => "sa_menu_sr_" + (restaurant || "x");
export const readSr = (restaurant) => obj(load(srKey(restaurant), null)) || {};
export function writeSr(restaurant, sr) { save(srKey(restaurant), sr || {}); emit(); }
/** Знаю — следующая ступень (1, 3, 7, 30 дней), не уверен — к повтору сейчас. */
export function srMark(sr, id, ok, now = Date.now()) {
  const cur = (sr && sr[id]) || { stage: 0 };
  const stage = ok ? Math.min((Number(cur.stage) || 0) + 1, SR_DAYS.length) : 0;
  return { ...(sr || {}), [id]: { stage, due: now + (ok ? SR_DAYS[stage - 1] * DAY : 0), t: now } };
}
/** Ошибся в «Вопросе дня» или гость спросил, а не знал: к повтору сейчас, с отметкой. */
export const srMiss = (sr, id, now = Date.now()) => ({ ...(sr || {}), [id]: { stage: 0, due: now, t: now, m: now } });
/** Пора повторить: ни разу не отмечали или срок подошёл. */
export const srDue = (sr, id, now = Date.now()) => { const r = sr && sr[id]; return !r || !r.due || r.due <= now; };
/** Знает: отмечал «Знаю» и срок повтора ещё не подошёл. */
export const srKnown = (sr, id, now = Date.now()) => { const r = sr && sr[id]; return !!(r && r.stage > 0 && r.due > now); };
/** Отметить на телефоне и сообщить App (повтор на сервер, разминка, перерыв). */
export function markDish(restaurant, id, ok, now = Date.now()) { const next = srMark(readSr(restaurant), id, ok, now); writeSr(restaurant, next); return next; }
export function missDish(restaurant, id, now = Date.now()) { const next = srMiss(readSr(restaurant), id, now); writeSr(restaurant, next); return next; }
/** Верный ответ в «Вопросе дня» — как «Знаю», но только когда блюдо и так пора повторить (ступени не прыгают). */
export function answerDish(restaurant, id, correct, now = Date.now()) {
  const sr = readSr(restaurant);
  if (correct) { if (!srDue(sr, id, now)) return sr; const next = srMark(sr, id, true, now); writeSr(restaurant, next); return next; }
  const next = srMiss(sr, id, now); writeSr(restaurant, next); return next;
}

// ── ритм (идея 6): каждую смену, через смену, раз в неделю, не нужно; 2 или 3 блюда ──
export const RHYTHMS = [["each", "Каждую смену"], ["every2", "Через смену"], ["week", "Раз в неделю"], ["off", "Не нужно"]];
export const COUNTS = [2, 3];
export const RHYTHM_DEFAULT = { r: "each", n: 2 };
const RH_KEY = "sa_menu_rhythm";
export function normRhythm(v) {
  const o = obj(v) || {};
  return { r: RHYTHMS.some(([k]) => k === o.r) ? o.r : RHYTHM_DEFAULT.r, n: COUNTS.includes(Number(o.n)) ? Number(o.n) : RHYTHM_DEFAULT.n };
}
export const readRhythm = (uk) => normRhythm(load(RH_KEY + (uk || ""), null));
export function saveRhythm(uk, v) { const x = normRhythm(v); save(RH_KEY + (uk || ""), x); emit(); return x; }
export const rhythmLabel = (r) => (RHYTHMS.find(([k]) => k === r) || RHYTHMS[0])[1];

// ── какие разминки с блюдами: last — последний день, когда разминка была с блюдами; prev — последняя разминка; had — были ли
// в ней блюда. Через смену: в прошлой разминке были блюда — сегодня без них. Раз в неделю: первая разминка недели. ──
const LOG_KEY = "sa_menu_warmlog";
export function readWarmLog(uk) {
  const o = obj(load(LOG_KEY + (uk || ""), null)) || {};
  return { last: ISO.test(o.last || "") ? o.last : null, prev: ISO.test(o.prev || "") ? o.prev : null, had: !!o.had };
}
export const noteWarm = (log, day, had) => ({ last: had ? day : (log && log.last) || null, prev: day, had: !!had });
export function saveWarmLog(uk, log) { save(LOG_KEY + (uk || ""), log); emit(); return log; }
export function isDishDay(r, log, day) {
  const l = log || {};
  if (r === "off") return false;
  if (r === "every2") return l.prev === day ? !!l.had : !(l.prev && l.prev < day && l.had);
  if (r === "week") return l.last === day || !(l.last && l.last >= mondayOf(day) && l.last < day);
  return true;
}

// ── «спросили о блюде, а ты не знал» (идея 5): по человеку и заведению, неделю или до «Знаю» ──
const ASK_KEY = "sa_menu_asked";
export function readAsked(uk, restaurant) {
  const all = obj(load(ASK_KEY + (uk || ""), null)) || {};
  const list = Array.isArray(all[restaurant]) ? all[restaurant] : [];
  return list.filter((x) => x && x.id != null && Number(x.at) > 0).map((x) => ({ id: String(x.id), at: Number(x.at) }));
}
export function addAsked(uk, restaurant, id, now = Date.now()) {
  const all = obj(load(ASK_KEY + (uk || ""), null)) || {};
  const list = [{ id: String(id), at: now }, ...readAsked(uk, restaurant).filter((x) => x.id !== String(id) && now - x.at < ASK_DAYS * DAY)].slice(0, 10);
  save(ASK_KEY + (uk || ""), { ...all, [restaurant]: list });
  emit();
  return list;
}
/** Открытые «спросили»: за неделю и после них не отмечал «Знаю». Новые — первыми. */
export function openAsked(list, sr, now = Date.now()) {
  return (list || []).filter((x) => x && now - x.at < ASK_DAYS * DAY && now >= x.at - DAY)
    .filter((x) => { const r = sr && sr[x.id]; return !(r && r.stage > 0 && Number(r.t) > x.at); })
    .sort((a, b) => b.at - a.at).map((x) => x.id);
}
/** Сегодня уже отметил (для строки после смены): «спросили» с сегодняшним днём. */
export const askedToday = (list, now = Date.now()) => (list || []).filter((x) => localDay(x.at) === localDay(now)).map((x) => x.id);

// ── блюда меню ──
const NON_FOOD = new Set(["cocktail", "wine", "spirit"]);
export const isFood = (d) => !!(d && d.id != null && String(d.name || "").trim() && !d.archived && !NON_FOOD.has(d.kind) && d.id !== "__barcard__");
export const isNewDish = (d, now = Date.now()) => !!(d && d.isNew && d.addedAt && now - d.addedAt < NEW_DAYS * DAY && now >= d.addedAt - DAY);

/**
 * Своя очередь блюд (без гоу-листа и просьбы руководителя): спросили, а не знал → новинки, пока не «Знаю» → пора
 * повторить (у кого подошёл срок, раньше — первыми) → ни разу не отмечал (в порядке меню). Стоп и архив не повторяем.
 * why: asked | new | due | fresh.
 */
export function personalQueue({ dishes = [], sr = {}, asked = [], now = Date.now(), max = NEXT_MAX } = {}) {
  const live = (dishes || []).filter((d) => isFood(d) && !d.stop);
  const byId = new Map(live.map((d) => [String(d.id), d]));
  const out = [], seen = new Set();
  const add = (d, why) => { if (!d || out.length >= max || seen.has(String(d.id))) return; seen.add(String(d.id)); out.push({ id: String(d.id), name: String(d.name).trim(), why }); };
  openAsked(asked, sr, now).forEach((id) => add(byId.get(id), "asked"));
  live.filter((d) => isNewDish(d, now) && !srKnown(sr, d.id, now)).sort((a, b) => b.addedAt - a.addedAt).forEach((d) => add(d, "new"));
  live.filter((d) => sr[d.id] && srDue(sr, d.id, now)).sort((a, b) => (Number(sr[a.id].due) || 0) - (Number(sr[b.id].due) || 0)).forEach((d) => add(d, "due"));
  live.filter((d) => !sr[d.id]).forEach((d) => add(d, "fresh"));
  return out;
}

/**
 * Блюда разминки (n): спросили, а не знал → просьба руководителя (пока не отметил «Знаю» в день просьбы или позже) →
 * гоу-лист смены (пока не отметил «Знаю» сегодня) → своя очередь. В том же порядке их выбирает сервер (этап 59) для
 * напоминания за час до смены: focus — просьбы руководителя ({ id, kind: "warm", day }), go — гоу-лист дня.
 * Ответ: [{ id, name, why, say, dish }] (say — фраза гостю из гоу-листа).
 */
export function warmPlan({ dishes = [], sr = {}, asked = [], focus = [], go = [], n = 2, now = Date.now(), skipToday = false } = {}) {
  const live = (dishes || []).filter((d) => isFood(d) && !d.stop);
  const byId = new Map(live.map((d) => [String(d.id), d]));
  const byName = new Map(live.map((d) => [nrm(d.name), d]));
  const today = localDay(now);
  const markedToday = (d) => { const r = sr[d.id]; return !!(r && r.t && localDay(r.t) === today); };
  const out = [], seen = new Set();
  const add = (d, why, say = "") => {
    if (!d || out.length >= n || seen.has(String(d.id))) return;
    if (skipToday && markedToday(d)) return;
    seen.add(String(d.id)); out.push({ id: String(d.id), name: String(d.name).trim(), why, say: String(say || ""), dish: d });
  };
  const mine = personalQueue({ dishes: live, sr, asked, now, max: 40 });
  mine.filter((x) => x.why === "asked").forEach((x) => add(byId.get(x.id), "asked"));
  (focus || []).filter((f) => f && f.kind === "warm").forEach((f) => {
    const d = byId.get(String(f.id)), r = d && sr[d.id];
    if (r && r.stage > 0 && r.t && localDay(r.t) >= (Number(f.day) || 0)) return;
    add(d, "focus");
  });
  (go || []).filter((g) => g && (g.kind || "dish") === "dish").forEach((g) => {
    const d = byId.get(String(g.id)) || byName.get(nrm(g.name)), r = d && sr[d.id];
    if (r && r.stage > 0 && r.t && localDay(r.t) === today) return;
    add(d, "go", g.say);
  });
  mine.filter((x) => x.why !== "asked").forEach((x) => add(byId.get(x.id), x.why));
  return out;
}
/** Блюдо в перерыв (идея 2): первое из того же порядка, что сегодня ещё не отмечал. */
export const breakPick = (args) => warmPlan({ ...args, n: 1, skipToday: true })[0] || null;
/** Блюда, которые сервер уже назвал в напоминании сегодня: в разминке — они (что ещё есть в меню и не в стопе). */
export function sentPlan(sent, dishes, today) {
  if (!sent || sent.day !== today || !Array.isArray(sent.ids) || !sent.ids.length) return null;
  const byId = new Map((dishes || []).filter((d) => isFood(d) && !d.stop).map((d) => [String(d.id), d]));
  const out = sent.ids.map((id) => byId.get(String(id))).filter(Boolean).map((d) => ({ id: String(d.id), name: String(d.name).trim(), why: "sent", say: "", dish: d }));
  return out.length ? out : null;
}

// ── для сервера (этап 59) ──
/** «Знаю?» блюд меню: { id: [ступень 0–4, день повтора, день отметки] } (дни — по местному календарю, 0 — не отмечал). */
export function knowData(sr, dishes, now = Date.now()) {
  const ids = new Set((dishes || []).filter(isFood).map((d) => String(d.id)));
  const out = {};
  let n = 0;
  for (const [id, r] of Object.entries(sr || {})) {
    if (n >= KNOW_MAX || !ids.has(id) || !obj(r)) continue;
    const s = Math.max(0, Math.min(SR_DAYS.length, Math.floor(Number(r.stage) || 0)));
    out[id] = [s, Number(r.due) > 0 ? localDay(r.due) : localDay(now), Number(r.t) > 0 ? localDay(r.t) : 0];
    n++;
  }
  return out;
}
/** Ритм и своя очередь — сервер решает, звать ли блюда в напоминании и какие. */
export function warmData({ rhythm, log, next } = {}) {
  const rh = normRhythm(rhythm), l = log || {};
  return { r: rh.r, n: rh.n, last: l.last || null, prev: l.prev || null, had: !!l.had,
    next: (next || []).slice(0, NEXT_MAX).map((x) => ({ id: String(x.id).slice(0, 80), name: String(x.name).replace(/\s+/g, " ").trim().slice(0, 60), why: x.why })) };
}

// ── просьбы руководителя и что сервер назвал в напоминании: копия на телефоне, по человеку ──
const FC_KEY = "sa_menu_focus";
const normFocus = (arr) => (Array.isArray(arr) ? arr : []).filter((f) => f && f.id != null && (f.kind === "warm" || f.kind === "brief"))
  .map((f) => ({ id: String(f.id), kind: f.kind, name: String(f.name || "").trim(), note: String(f.note || "").trim(), until: String(f.until || ""), day: Number(f.day) || 0, by: String(f.by || "").trim() }));
const normSent = (s) => (obj(s) && ISO.test(s.day || "") && Array.isArray(s.ids) ? { day: s.day, ids: s.ids.map(String).slice(0, 3), names: (Array.isArray(s.names) ? s.names : []).map(String).slice(0, 3) } : null);
export function readFocus(uk, restaurant) {
  const v = obj(load(FC_KEY + (uk || ""), null));
  return v && v.r === restaurant ? { r: restaurant, at: Number(v.at) || 0, focus: normFocus(v.focus), sent: normSent(v.sent) } : { r: restaurant, at: 0, focus: [], sent: null };
}
export function saveFocus(uk, restaurant, res) {
  if (!res || !res.ok) return null;
  const v = { r: restaurant, at: Date.now(), focus: normFocus(res.focus), sent: normSent(res.sent) };
  save(FC_KEY + (uk || ""), v); emit();
  return v;
}

// ── «Вопрос дня» из меню: какой вопрос о каком блюде (ответ из Telegram приходит текстом вопроса) ──
const QM_KEY = "sa_qday_menu";
export function rememberQdayMenu(uk, restaurant, items) {
  const prev = obj(load(QM_KEY + (uk || ""), null)) || {};
  const add = {};
  for (const x of items || []) if (x && x.q && x.dish != null) add[qdayKey(x.q)] = { id: String(x.dish), r: restaurant };
  const next = { ...prev, ...add };
  const keys = Object.keys(next);
  if (keys.length > 80) keys.slice(0, keys.length - 80).forEach((k) => delete next[k]);
  save(QM_KEY + (uk || ""), next);
  return next;
}
export function qdayMenuOf(uk, q) { const m = obj(load(QM_KEY + (uk || ""), null)) || {}; const x = m[qdayKey(q)]; return x && x.id ? x : null; }
/** Ответы «Вопроса дня» о блюдах — в «Знаю?»: ошибка — к повтору сейчас (и первым в разминке), верно — как «Знаю». */
export function applyQdayMenu(uk, answers, now = Date.now()) {
  const out = [];
  for (const a of answers || []) {
    const m = a && qdayMenuOf(uk, a.q);
    if (!m) continue;
    answerDish(m.r, m.id, !!a.correct, now);
    out.push({ id: m.id, r: m.r, correct: !!a.correct });
  }
  return out;
}

// ── руководителю: «Как команда знает меню» (ответ menu_know_team) ──
/** Слабые блюда: не уверены (или ошиблись) — больше, знают — меньше; только блюда меню. */
export function teamWeak(res, dishes, max = 12) {
  const live = (dishes || []).filter((d) => isFood(d));
  const order = new Map(live.map((d, i) => [String(d.id), i]));
  const byId = new Map(((res && res.dishes) || []).filter((x) => x && x.id != null).map((x) => [String(x.id), x]));
  const n = Math.max(0, Number(res && res.n) || 0);
  return live.map((d) => { const x = byId.get(String(d.id)) || {}; return { id: String(d.id), name: String(d.name).trim(), cat: d.cat || "", stop: !!d.stop,
    known: Number(x.known) || 0, weak: Number(x.weak) || 0, seen: Number(x.seen) || 0, n }; })
    .filter((r) => r.weak > 0 || r.known < n)
    .sort((a, b) => b.weak - a.weak || a.known - b.known || order.get(a.id) - order.get(b.id))
    .slice(0, max);
}
/** «не уверены 2 · знают 1 из 5» */
export function weakLine(r) {
  const parts = [];
  if (r.weak) parts.push("не уверены " + r.weak);
  parts.push("знают " + r.known + " из " + r.n);
  return parts.join(" · ");
}

// ── тексты ──
// fresh (ещё не отмечал) — без подписи: просто «меню»
export const WHY_LABEL = { asked: "спрашивали", focus: "просит руководитель", go: "гоу-лист смены", new: "новинка", due: "пора повторить", fresh: "", sent: "из напоминания" };
/** «ситуации и 2 блюда» (карточка разминки: «2 минуты, 3 ситуации и 2 блюда»). */
export const warmWhat = (what, n) => (n > 0 ? what + " и " + n + " " + dishWord(n) : what);
/** Строка разминки в напоминании бота: как у сервера (этап 59 дописывает её в сообщение этапов 22б, 26, 29). */
export const REMIND_PLAIN = "Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!";
export function remindLine(names) {
  const list = (names || []).map((s) => String(s || "").trim()).filter(Boolean);
  if (!list.length) return REMIND_PLAIN;
  return "Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл, и " + list.length + " " + dishWord(list.length) + " из меню: " + list.join(", ") + ". Хорошей смены!";
}
