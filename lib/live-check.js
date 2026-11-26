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
