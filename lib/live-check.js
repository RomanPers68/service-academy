// lib/live-check.js — v200 (Доп. 525): живая проверка. Те же правила, что у этапа 63 (ступени должностей, кто кого
// проверяет, процент и «зачтено»), и расчёты для экрана: курсы человека, что пройдено в приложении, последние итоги.
// Без сети и React: это берут и экран (ui/live-check.jsx), и сервер демо в Node.
//
// Владелец (26.11): «официанта проверяет менеджер, управляющий (если менеджер не может). Менеджера проверяет
// управляющий. И так далее по возрастанию».
import { POS_TRACK } from "./position-track.js";

export const LC_PASS = 75;                       // зачтено от 75%
export const LC_TRACKS = ["seasonal", "core", "spg", "bar", "manager", "service_manager"];
/** Отметка за вопрос: 2 — ответил, 1 — частично, 0 — не ответил */
export const LC_MARKS = [{ v: 2, label: "Ответил" }, { v: 1, label: "Частично" }, { v: 0, label: "Не ответил" }];

/** Ступень: линейные 10, старший бармен 20, менеджер 30, «старше менеджера» (управляющий) 35, руководящий состав 50,
 *  владелец 60. ups — id своих должностей, отмеченных «старше» */
export function lcLevel(p, ups = []) {
  if (!p) return 0;
  const pos = String(p.position || "").toLowerCase();
  if (p.is_admin || pos === "owner" || pos === "admin") return 60;
  if (pos === "senior") return 50;
  if (pos === "head") return 35;
  if (pos === "manager" || pos === "service_manager") return p.title && (ups || []).includes(p.title) ? 35 : 30;
  if (pos === "senior_bartender") return 20;
  return 10;
}
/** Линия: ниже менеджера проверяют только свою (старший бармен — барменов) */
export const lcFamily = (pos) => ({ bartender: "bar", senior_bartender: "bar", hostess: "host", waiter: "hall" }[String(pos || "").toLowerCase()] || "other");
/** Сеть: владелец и руководящий состав — проверяют в любом заведении */
export const lcNet = (p) => !!p && (!!p.is_admin || String(p.position || "").toLowerCase() === "senior");

/** Может ли checker проверить target: { id, position, title, is_admin, restaurant, status } у обоих */
export function lcCan(checker, target, ups = []) {
  if (!checker || !target) return false;
  if ((target.status || "active") !== "active" || String(checker.id) === String(target.id)) return false;
  const cl = lcLevel(checker, ups), tl = lcLevel(target, ups);
  if (cl <= tl) return false;
  if (!lcNet(checker) && (checker.restaurant || "") !== (target.restaurant || "")) return false;
  return cl >= 30 || lcFamily(checker.position) === lcFamily(target.position);
}

/** Отметки → процент и «зачтено» (как live_check_save) */
export function lcScore(marks) {
  const m = Array.isArray(marks) ? marks : [];
  if (!m.length || m.some((v) => v !== 0 && v !== 1 && v !== 2)) return null;   // как этап 63: только числа 0, 1, 2
  const score = Math.round((m.reduce((a, v) => a + v, 0) * 100) / (2 * m.length));
  return { score, passed: score >= LC_PASS };
}

/** Курсы человека по должности: официант — «Новичок» и «Ядро», остальные — свой */
export function tracksOf(position) {
  const pos = String(position || "").toLowerCase();
  if (pos === "waiter") return ["seasonal", "core"];
  const t = POS_TRACK[pos];
  return t ? [t] : [];
}

/** Последняя проверка по каждому модулю: { [module]: { m, t, s, p, at, by, … } } */
export function lastByModule(checks) {
  const out = {};
  for (const c of Array.isArray(checks) ? checks : []) {
    const m = c && c.m; if (!m) continue;
    if (!out[m] || String(c.at || "") > String(out[m].at || "")) out[m] = c;
  }
  return out;
}

/** Что пройдено в приложении по модулю: уроки (type lesson) и тест */
export function moduleApp(mod, lessons, quiz) {
  const ls = (mod && mod.lessons || []).filter((l) => l.type === "lesson");
  const L = lessons instanceof Set ? lessons : new Set(lessons || []), Q = quiz instanceof Set ? quiz : new Set(quiz || []);
  const done = ls.filter((l) => L.has(l.id)).length;
  const q = (mod && mod.lessons || []).find((l) => l.type === "quiz");
  const quizDone = !!(q && Q.has(q.id));
  const state = (done === ls.length && ls.length) || quizDone ? "done" : done > 0 ? "part" : "none";
  return { lessons: ls.length, done, quizDone, state };
}

/** Итог по курсу: сколько модулей зачтено и сколько проверяли */
export function trackSummary(mods, last) {
  const ids = (mods || []).map((m) => m.id);
  const checked = ids.filter((id) => last && last[id]);
  return { total: ids.length, checked: checked.length, passed: checked.filter((id) => last[id].p).length };
}

/** Уроки, которые стоит повторить: по вопросам с отметкой 0 или 1, без повторов */
export function lessonsToRepeat(questions, marks) {
  const out = [];
  (questions || []).forEach((q, i) => { const v = Number((marks || [])[i]); if (q && q.l && (v === 0 || v === 1) && !out.includes(q.l)) out.push(q.l); });
  return out;
}

/** Дата для списка: «26.11» */
export function lcDate(at) {
  const d = at ? new Date(at) : null;
  if (!d || isNaN(d)) return "";
  return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0");
}

/** Ответы сервера → текст для человека */
export function lcErr(code, admin = false) {
  if (code === "stage") return admin ? "Живая проверка заработает после этапа базы 63: подскажет экран «Сервер»." : "Живая проверка появится, когда владелец обновит сервер.";
  if (code === "forbidden") return "Проверяют руководители: менеджер свою команду, управляющий ещё и менеджеров, старший бармен барменов.";
  if (code === "not_found") return "Этого сотрудника уже нет в списке. Обнови экран.";
  if (code === "bad_request") return "Отметь ответ на каждый вопрос.";
  if (code === "auth") return "Вход устарел. Войди заново.";
  return "Нет связи. Попробуй ещё раз.";
}

// ── v201 (Доп. 526): по пунктам, случайные вопросы, блиц, «Сегодня», пометки ───────────────────────────────────────
// Владелец (26.11) на десять предложений, как сделать живую проверку удобнее и точнее: «Да, давай сделаем все».

export const LC_PICK = 4;           // вопросов в проверке модуля (в банке по восемь)
export const LC_BLITZ = 3;          // вопросов в блице
export const LC_RECENT_DAYS = 30;   // не повторять вопросы, заданные за это время
export const LC_RETAKE_DAYS = 3;    // не зачтён и не пересдан столько дней — «пересдача»
export const LC_RECHECK_DAYS = 30;  // зачтён так давно — «пора повторить»
const DAY = 864e5;
const ageDays = (at, now) => { const t = Date.parse(at || ""); return Number.isNaN(t) ? 0 : (Number(now) - t) / DAY; };

/** Ключ вопроса: «модуль#номер» — по нему сервер копит, какие вопросы чаще не сдают */
export const qKey = (mod, q) => String(mod) + "#" + (q && q.n);
export const isSituation = (q) => /^Ситуация:/.test(String((q && q.q) || ""));

/** Процент по пунктам: items [{ g: названо, o: всего }] → { score, passed } (как этап 64) или null */
export function pointsScore(items) {
  const it = Array.isArray(items) ? items : [];
  if (!it.length || it.some((x) => !x || !Number.isInteger(x.g) || !Number.isInteger(x.o) || x.o < 1 || x.g < 0 || x.g > x.o)) return null;
  const g = it.reduce((a, x) => a + x.g, 0), o = it.reduce((a, x) => a + x.o, 0);
  const score = Math.round((g * 100) / o);
  return { score, passed: score >= LC_PASS };
}
/** Отметки 0/1/2 для экранов до v201: всё назвал — 2, что-то — 1, ничего — 0 */
export const marksOf = (items) => (Array.isArray(items) ? items : []).map((x) => (x.g === x.o ? 2 : x.g > 0 ? 1 : 0));

/** Какие вопросы спрашивали недавно: ключи из пунктов; у проверок до v201 — первые вопросы модуля по числу отметок */
export function recentKeys(checks, now = Date.now(), days = LC_RECENT_DAYS) {
  const out = new Set();
  for (const c of Array.isArray(checks) ? checks : []) {
    if (!c || ageDays(c.at, now) > days) continue;
    if (Array.isArray(c.it) && c.it.length) c.it.forEach((x) => x && x.k && out.add(x.k));
    else if (c.m && c.m !== "blitz" && Array.isArray(c.marks)) c.marks.forEach((_, i) => out.add(c.m + "#" + (i + 1)));
  }
  return out;
}

const shuffle = (arr, rng) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** Четыре вопроса модуля: сначала те, что недавно не спрашивали; уроки разные; ситуация, если есть, — последней */
export function pickQuestions(qs, mod, recent = new Set(), rng = Math.random, count = LC_PICK) {
  const all = (Array.isArray(qs) ? qs : []).filter((q) => q && q.n && q.q && Array.isArray(q.a));
  if (all.length <= count) return all.map((q) => ({ ...q, m: mod, k: qKey(mod, q) }));
  const order = shuffle(all, rng);
  const fresh = order.filter((q) => !recent.has(qKey(mod, q))), stale = order.filter((q) => recent.has(qKey(mod, q)));
  const sit = fresh.find(isSituation) || stale.find(isSituation) || null;
  const room = count - (sit ? 1 : 0), picked = [], lessons = new Set();
  // сначала свежие (разные уроки, потом любые), потом недавние так же; ситуации — только та одна, последней
  const fill = (arr) => {
    for (const q of arr) if (picked.length < room && !isSituation(q) && !lessons.has(q.l)) { picked.push(q); lessons.add(q.l); }
    for (const q of arr) if (picked.length < room && !isSituation(q) && !picked.includes(q)) picked.push(q);
  };
  fill(fresh); fill(stale);
  for (const q of [...fresh, ...stale]) if (picked.length < room && q !== sit && !picked.includes(q)) picked.push(q);
  if (sit) picked.push(sit);
  return picked.slice(0, count).map((q) => ({ ...q, m: mod, k: qKey(mod, q) }));
}

/** Блиц: три вопроса из разных модулей, которые человек уже прошёл (mods — id модулей), недавно не заданные */
export function blitzPick(bank, mods, recent = new Set(), rng = Math.random, count = LC_BLITZ) {
  const ms = shuffle([...new Set(Array.isArray(mods) ? mods : [])].filter((m) => Array.isArray(bank && bank[m]) && bank[m].length), rng);
  const out = [], used = new Set();
  const take = (onlyFresh, newModule) => {
    for (const m of ms) {
      if (out.length >= count) return;
      if (newModule && used.has(m)) continue;
      const q = shuffle(bank[m], rng).find((x) => !out.some((o) => o.k === qKey(m, x)) && (!onlyFresh || !recent.has(qKey(m, x))));
      if (q) { out.push({ ...q, m, k: qKey(m, q) }); used.add(m); }
    }
  };
  take(true, true); take(false, true); take(true, false); take(false, false);
  return out.slice(0, count);
}

/** Уроки, которые стоит повторить: вопросы, где назвали не всё (без повторов, не больше шести) */
export function repeatFromItems(qs, got) {
  const out = [];
  (Array.isArray(qs) ? qs : []).forEach((q, i) => {
    const g = got && got[i] ? got[i].length : 0;
    if (q && q.l && g < (q.a || []).length && !out.includes(q.l)) out.push(q.l);
  });
  return out.slice(0, 6);
}

/** id теста модуля в приложении (урок с типом quiz) */
export const quizOf = (mod) => { const q = ((mod && mod.lessons) || []).find((l) => l.type === "quiz"); return q ? q.id : null; };

/** Пометки модуля: тест в приложении сдан, а вживую не зачтено; пора повторить; пересдача */
export function moduleFlags(mod, last, { quiz = [], tests = {}, now = Date.now() } = {}) {
  const qid = quizOf(mod), pct = qid && tests && Number.isFinite(Number(tests[qid])) ? Number(tests[qid]) : null;
  const testOk = !!qid && (quiz.includes(qid) || (pct != null && pct >= LC_PASS));
  return {
    testPct: pct,
    gap: !!(last && !last.p && testOk),                                        // «тест сдал, вживую нет»
    retake: !!(last && !last.p && ageDays(last.at, now) >= LC_RETAKE_DAYS),   // не пересдан три дня
    recheck: !!(last && last.p && ageDays(last.at, now) > LC_RECHECK_DAYS),   // зачтён больше месяца назад
    ready: !last && testOk,                                                    // прошёл в приложении, вживую не проверяли
  };
}

/** Что предложить по человеку (из списка): пересдача, тест сдал — вживую нет, пора повторить, прошёл — не проверяли */
export function suggestFor(person, modsByTrack, now = Date.now()) {
  const tracks = tracksOf(person && person.position);
  const last = lastByModule(((person && person.checks) || []).filter((c) => c.k !== "blitz" && c.m !== "blitz"));
  const quiz = Array.isArray(person && person.quiz) ? person.quiz : [];
  const out = { retake: [], gap: [], recheck: [], ready: [] };
  for (const t of tracks) for (const m of (modsByTrack && modsByTrack[t]) || []) {
    const f = moduleFlags(m, last[m.id], { quiz, now });
    const row = { t, m: m.id, title: m.title, s: last[m.id] ? last[m.id].s : null, at: last[m.id] ? last[m.id].at : null };
    if (f.retake) out.retake.push(row); else if (f.gap) out.gap.push(row);
    if (f.recheck) out.recheck.push(row);
    if (f.ready) out.ready.push(row);
  }
  const top = out.retake[0] ? { kind: "retake", ...out.retake[0] } : out.gap[0] ? { kind: "gap", ...out.gap[0] }
    : out.ready[0] ? { kind: "ready", ...out.ready[0] } : out.recheck[0] ? { kind: "recheck", ...out.recheck[0] } : null;
  return { ...out, top };
}
/** Подпись подсказки: «пересдача: Мышление сервиса» */
export function suggestText(s) {
  if (!s) return "";
  if (s.kind === "retake") return "пересдача: «" + s.title + "», " + s.s + "%";
  if (s.kind === "gap") return "тест сдал, вживую нет: «" + s.title + "»";
  if (s.kind === "ready") return "прошёл в приложении: «" + s.title + "»";
  return "пора повторить: «" + s.title + "»";
}

const nrm = (x) => String(x || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const toks = (x) => new Set(nrm(x).split(" ").filter(Boolean));
/** Кто сегодня на смене по графику: ответ schedule_load → id людей из списка (по имени и фамилии, как «График») */
export function onShiftToday(sched, people, date = new Date()) {
  const out = new Set();
  try {
    const v = ((sched && sched.venues) || []).find((x) => x && x.venue_key === "main") || ((sched && sched.venues) || [])[0];
    const mo = ((sched && sched.months) || []).find((x) => x && x.venue_key === ((v && v.venue_key) || "main")) || ((sched && sched.months) || [])[0];
    const cfg = (v && v.config) || {}, plan = (mo && mo.payload && mo.payload.plan) || {};
    const shifts = Array.isArray(cfg.shifts) ? cfg.shifts : [];
    const day = date.getDate();
    const working = (cfg.staff || []).filter((st) => {
      const k = st && plan[st.id] && plan[st.id][day];
      const sh = k ? shifts.find((x) => x.k === k) : null;
      return !!k && !(sh && sh.extra);
    });
    for (const p of Array.isArray(people) ? people : []) {
      const pt = toks((p.name || "") + " " + (p.surname || ""));
      if (!pt.size) continue;
      if (working.some((st) => { const et = toks(st.name); return et.size && [...et].every((w) => pt.has(w)) && [...pt].every((w) => et.has(w) || pt.size > et.size); })) out.add(p.id);
    }
  } catch (e) { /* */ }
  return out;
}

/** Ответ сервера → текст (v201): этап 64 */
export function lcErr64(code, admin = false) {
  if (code === "stage64") return admin ? "Блиц и сводка заработают после этапа базы 64: подскажет экран «Сервер»." : "Это появится, когда владелец обновит сервер.";
  return lcErr(code, admin);
}

// ── v202 (Доп. 527): живая проверка в смене ───────────────────────────────────────────────────────────────────────────
// Владелец (27.11) на предложения, как ещё упростить живую проверку: «Давай все, кроме 10-го и 2-го». Брифинг, просьбы,
// меню заведения, «Работа над ошибками», свои вопросы, допуск к залу, план и сверка проверяющих (этап 65).

/** Проверка модуля (не блиц и не вопрос на брифинге) */
export const isModuleCheck = (c) => !!c && c.k !== "blitz" && c.k !== "brief" && c.m !== "blitz" && c.m !== "brief";
export const LC_MENU = "menu";       // модуль «Меню заведения»: вопросы о блюдах из карточек меню
export const LC_BRIEF = 3;           // людей в проверке на брифинге
export const PLAN_DAYS = [14, 30, 60, 90];

/** Банк вопросов с правками руководства (этап 65): rows [{ m, n, q, a, l, h }] поверх data/live-check.js. n — номер вопроса
 *  из приложения (правка формулировки и пунктов или «спрятан») или «c12» — свой вопрос */
export function mergeBank(base, rows) {
  const out = {};
  for (const [m, qs] of Object.entries(base || {})) out[m] = Array.isArray(qs) ? qs.slice() : [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !r.m || r.n == null || r.n === "") continue;
    const m = String(r.m), n = String(r.n);
    const list = out[m] || (out[m] = []);
    const i = list.findIndex((q) => String(q.n) === n);
    const a = Array.isArray(r.a) ? r.a.filter((x) => typeof x === "string" && x.trim()) : null;
    if (r.h) { if (i >= 0) list.splice(i, 1); continue; }
    if (i >= 0) list[i] = { ...list[i], ...(r.q ? { q: r.q } : {}), ...(a && a.length ? { a } : {}), ...(r.l ? { l: r.l } : {}), edited: true };
    else if (/^c\d+$/.test(n) && r.q && a && a.length) list.push({ n, l: r.l || "", q: r.q, a, own: true });
  }
  return out;
}

const fnv = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
/** Ключ блюда для вопроса «menu#…»: латиница, цифры, «-», «_», до 40 знаков; другое — с хвостом от названия */
export function dishKey(d) {
  const raw = String((d && (d.id != null && d.id !== "" ? d.id : d.name)) || "").trim().toLowerCase();
  if (!raw) return "";
  if (/^[a-z0-9_-]{1,40}$/.test(raw)) return raw;
  const s = raw.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  return ((s ? s + "-" : "d") + fnv(raw).toString(36)).slice(0, 40);
}
const clip = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t; };
const firstSentence = (s) => { const m = String(s || "").replace(/\s+/g, " ").trim().match(/^[^.!?…]+[.!?…]?/); return m ? m[0].trim() : ""; };

/** Вопросы о блюдах меню заведения (модуль «menu»): что в составе (до трёх главного), аллергены, как рассказать гостю.
 *  dishes — блюда (lib/menu-pack.js, menuNow), label — подпись аллергена. Вопрос есть, если пунктов хотя бы два */
export function menuQuestions(dishes, { label = (x) => x, max = 60 } = {}) {
  const out = [], seen = new Set();
  for (const d of Array.isArray(dishes) ? dishes : []) {
    if (!d || !d.name || d.archived) continue;
    const n = dishKey(d);
    if (!n || seen.has(n)) continue;
    const comp = (Array.isArray(d.ingredients) ? d.ingredients : []).map((x) => clip(String(x).replace(/\s*\([^)]*\)/g, ""), 60)).filter(Boolean).slice(0, 3);
    const al = [...new Set((Array.isArray(d.allergens) ? d.allergens : []).filter(Boolean).map((x) => String(label(x) || x).trim().toLowerCase()).filter(Boolean))];
    const desc = clip(firstSentence(d.desc || d.short || ""), 140);
    const a = [...comp, ...(al.length ? ["Аллергены: " + al.join(", ")] : []), ...(desc ? ["Как рассказать: " + desc] : [])].slice(0, 6);
    if (a.length < 2) continue;
    const ask = [comp.length ? "что в составе" : "", al.length ? "какие аллергены" : "", desc ? "как расскажешь гостю" : ""].filter(Boolean);
    const q = "Блюдо «" + clip(d.name, 70) + "»: " + (ask.length > 1 ? ask.slice(0, -1).join(", ") + " и " + ask[ask.length - 1] : ask[0]) + "?";
    seen.add(n);
    out.push({ n, l: "", q, a, m: LC_MENU, k: LC_MENU + "#" + n, dish: String(d.name), cat: String(d.cat || "") });
    if (out.length >= max) break;
  }
  return out;
}

const shortName = (p) => String((p && p.name) || "").trim() || String((p && p.surname) || "").trim();
/** Вопрос человеку на брифинге: из модуля-подсказки (пересдача, тест сдал — вживую нет, прошёл — не проверяли), иначе из
 *  пройденного в приложении, иначе из первых модулей курса; menu — о блюде. exclude — ключи, которые не повторять */
export function briefQuestion(p, { modsByTrack = {}, bank = {}, menuQs = [], menu = false, now = Date.now(), rng = Math.random, exclude = new Set() } = {}) {
  if (menu && menuQs.length) {
    const left = menuQs.filter((q) => !exclude.has(q.k || LC_MENU + "#" + q.n));
    const q = (left.length ? left : menuQs)[Math.floor(rng() * (left.length ? left.length : menuQs.length))];
    if (q) return { ...q, m: LC_MENU, k: q.k || LC_MENU + "#" + q.n };
  }
  const tracks = tracksOf(p && p.position);
  const mods = tracks.flatMap((t) => (modsByTrack[t] || []).map((m) => ({ ...m, t })));
  const s = suggestFor(p, modsByTrack, now);
  const top = s.top && s.top.kind !== "recheck" ? s.top.m : null;
  const quiz = new Set(Array.isArray(p && p.quiz) ? p.quiz : []);
  const last = lastByModule(((p && p.checks) || []).filter(isModuleCheck));
  const done = mods.filter((m) => quiz.has(quizOf(m)) || (last[m.id] && last[m.id].p)).map((m) => m.id);
  const pools = [top ? [top] : [], done, mods.slice(0, 3).map((m) => m.id)];
  for (const ids of pools) {
    const okIds = ids.filter((id) => (bank[id] || []).some((q) => !exclude.has(qKey(id, q))));
    const q = blitzPick(bank, okIds, exclude, rng, 1)[0];
    if (q && !exclude.has(q.k)) return q;
  }
  return null;
}

/** Проверка на брифинге: двое-трое со смены (onShift — Set id или null), сначала те, кому пора; по вопросу каждому, одному
 *  из людей — о блюде, если вопросы о меню есть. → [{ emp, name, short, track, q }] */
export function briefPick({ people = [], onShift = null, modsByTrack = {}, bank = {}, menuQs = [], now = Date.now(), rng = Math.random, count = LC_BRIEF } = {}) {
  const pool = (Array.isArray(people) ? people : []).filter((p) => p && p.id && tracksOf(p.position).length && (!onShift || onShift.has(p.id)));
  const weight = (p) => {
    const s = suggestFor(p, modsByTrack, now);
    const ch = ((p && p.checks) || []).filter((c) => c && c.at);
    const lastAt = ch.reduce((a, c) => Math.max(a, Date.parse(c.at) || 0), 0);
    const age = lastAt ? Math.min(1, (Number(now) - lastAt) / (30 * DAY)) : 1.2;
    return (s.retake.length ? 3 : 0) + (s.gap.length ? 2 : 0) + (s.ready.length ? 1 : 0) + age;
  };
  const ranked = shuffle(pool, rng).map((p) => ({ p, w: weight(p) })).sort((a, b) => b.w - a.w).map((x) => x.p).slice(0, count);
  const used = new Set(), out = [];
  ranked.forEach((p, i) => {
    const menu = menuQs.length > 0 && ranked.length > 1 && i === ranked.length - 1;
    const q = briefQuestion(p, { modsByTrack, bank, menuQs, menu, now, rng, exclude: used });
    if (!q) return;
    used.add(q.k);
    out.push({ emp: p.id, name: ((p.name || "") + " " + (p.surname || "")).trim(), short: shortName(p), track: tracksOf(p.position)[0] || "seasonal", q });
  });
  return out;
}

/** Допуск к залу (курс «Новичок»): тест в приложении и живая проверка по «Аллергиям» и «ЧП» */
export const ADMIT = ["s5", "s-er"];
export function admission(mods, { quiz = [], tests = {}, checks = [] } = {}) {
  const last = lastByModule((Array.isArray(checks) ? checks : []).filter(isModuleCheck));
  const rows = ADMIT.map((id) => {
    const m = (mods || []).find((x) => x && x.id === id) || { id, title: id, lessons: [] };
    const qid = quizOf(m);
    const pct = qid && tests && Number.isFinite(Number(tests[qid])) ? Number(tests[qid]) : null;
    const l = last[id] || null;
    return { m: id, title: m.title || id, test: !!qid && ((quiz || []).includes(qid) || (pct != null && pct >= LC_PASS)), testPct: pct,
      live: !!(l && l.p), s: l ? l.s : null, at: l ? l.at : null };
  });
  const done = rows.reduce((a, r) => a + (r.test ? 1 : 0) + (r.live ? 1 : 0), 0);
  return { rows, done, total: rows.length * 2, ok: done === rows.length * 2 };
}

/** Можно позвать на проверку: модуль пройден в приложении (уроки или тест), вживую не зачтён; после незачёта — пересдача.
 *  req — открытая просьба по модулю. → { kind: check | retake, sent } или null */
export function askState(mod, last, { lessons = [], quiz = [], tests = {}, req = null } = {}) {
  if (last && last.p) return null;
  if (req) return { kind: req.k === "retake" ? "retake" : "check", sent: true };
  if (last && !last.p) return { kind: "retake", sent: false };
  const a = moduleApp(mod, lessons, new Set(quiz));
  return a.state === "done" || moduleFlags(mod, last, { quiz, tests }).ready ? { kind: "check", sent: false } : null;
}

/** «Работа над ошибками»: вопросы живой проверки и брифинга, где человек назвал не всё, — последний ответ на каждый вопрос;
 *  повторил вслух после этой проверки (done: { ключ: когда }) — уходит. bank — вопросы с правками, menuQs — о блюдах */
export function failedItems(checks, bank = {}, { menuQs = [], done = {}, max = 12 } = {}) {
  const latest = new Map();
  const list = (Array.isArray(checks) ? checks : []).filter((c) => c && Array.isArray(c.it)).sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
  for (const c of list) for (const x of c.it) if (x && x.k) latest.set(x.k, { g: Number(x.g), o: Number(x.o), at: c.at || "", by: c.by || "" });
  const menuBy = new Map((menuQs || []).map((q) => [q.k || LC_MENU + "#" + q.n, q]));
  const out = [];
  for (const [k, v] of latest) {
    if (!(v.g < v.o) || (done && done[k] && String(done[k]) >= String(v.at))) continue;
    const [m, n] = k.split("#");
    const q = m === LC_MENU ? menuBy.get(k) : (bank[m] || []).find((x) => String(x.n) === n);
    if (!q || !q.q || !Array.isArray(q.a) || !q.a.length) continue;
    out.push({ k, m, q: q.q, a: q.a, l: q.l || "", g: v.g, o: v.o, at: v.at, by: v.by });
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, max);
}

/** Модули, зачтённые вживую (последняя проверка модуля) — в «Путь мастера» */
export function livePassed(checks) {
  const last = lastByModule((Array.isArray(checks) ? checks : []).filter(isModuleCheck));
  return Object.keys(last).filter((m) => last[m].p).sort();
}

/** Сверка проверяющих: средний у проверяющего на 15 и больше выше («мягко») или ниже («строго») среднего по сети, если у
 *  него три проверки модулей и больше */
export function calib(checker, netAvg) {
  if (netAvg == null || !checker || !(Number(checker.m) >= 3) || checker.avg == null) return null;
  const d = Number(checker.avg) - Number(netAvg);
  return d >= 15 ? "soft" : d <= -15 ? "hard" : null;
}

/** Ответ сервера → текст (v202): этап 65 */
export function lcErr65(code, admin = false) {
  if (code === "stage65") return admin ? "Это заработает после этапа базы 65: подскажет экран «Сервер»." : "Это появится, когда владелец обновит сервер.";
  if (code === "too_many") return "Позвать на проверку можно сразу не больше чем по десяти модулям.";
  return lcErr64(code, admin);
}
