// lib/learning-sync.js — Доп. 309: копия «телефонных» данных на сервер для отчёта руководителя.
//
// «Работа над ошибками», экзамены, журнал дня, серия, разминки, навыки по PIN и «Гость
// недели» жили только в телефоне сотрудника — руководитель их не видел. Теперь телефон
// присылает их компактной копией (RPC sa_learning_push, этап 23 в Supabase): не чаще раза
// в пару минут и только когда что-то изменилось. Нет сети или этапа 23 — тихо, без ошибок;
// приложение работает как раньше.

import { rpc, saToken, rpcMissing } from "../api/supabase";
import { ACTIVITY_FIELDS, mergeLife } from "./activity";

const SENT_KEY = "sa_learn_sync";      // отпечаток последней отправленной копии (по сотруднику)
const MIN_GAP = 2 * 60 * 1000;         // не чаще раза в 2 минуты
const KEEP_DAYS = 90;
let missing = false;                   // этапа 23 на сервере нет — до перезапуска не стучимся
let timer = 0;
let inflight = false;

const readJSON = (storage, key, fallback) => {
  try { const v = JSON.parse(storage.getItem(key) || "null"); return v == null ? fallback : v; } catch (e) { return fallback; }
};
const cut = (s, n) => String(s == null ? "" : s).slice(0, n);
const dayKey = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };

// Компактная копия: только то, что нужно отчёту
export function learningSnapshot(uk, profile, storage, now = new Date()) {
  const st = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!st) return null;
  const mistakesRaw = readJSON(st, "sa_mistakes" + uk, []);
  const mistakes = (Array.isArray(mistakesRaw) ? mistakesRaw : []).slice(-200).map((m) => {
    const right = Array.isArray(m && m.options) && typeof m.correct === "number" ? m.options[m.correct] : "";
    const o = { q: cut(m && m.q, 300), a: cut(right, 200), st: Number(m && m.stage) || 0, due: Number(m && m.due) || 0 };
    if (m && m.lessonId) o.l = cut(m.lessonId, 60);
    if (m && m.lessonTitle) o.t = cut(m.lessonTitle, 120);
    if (m && (m.kind || m.from)) o.k = cut(m.kind || m.from, 20);
    return o;
  }).filter((m) => m.q);
  const examsRaw = readJSON(st, "sa_exam" + uk, {});
  const exams = {};
  if (examsRaw && typeof examsRaw === "object" && !Array.isArray(examsRaw)) {
    Object.keys(examsRaw).slice(0, 12).forEach((r) => {
      const e = examsRaw[r] || {};
      exams[cut(r, 30)] = { passed: !!e.passed, score: Number(e.score) || 0, correct: Number(e.correct) || 0, total: Number(e.total) || 0, date: cut(e.date, 30) };
    });
  }
  const sk = readJSON(st, "sa_streak" + uk, {});
  const streak = { count: Number(sk && sk.count) || 0, best: Number(sk && sk.best) || 0, last: cut(sk && sk.last, 10) };
  // v30 (Свеча на двоих): дни занятий и выходные по графику за 5 недель — сервер сверяет пару
  const dayList = (v) => (Array.isArray(v) ? v : []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d))).sort().slice(-35);
  if (sk && (Array.isArray(sk.days) || Array.isArray(sk.frozen))) { streak.days = dayList(sk.days); streak.frozen = dayList(sk.frozen); }
  const actRaw = readJSON(st, "sa_activity" + uk, {});
  const edge = new Date(now.getTime()); edge.setDate(edge.getDate() - KEEP_DAYS);
  const edgeKey = dayKey(edge);
  const activity = {};
  if (actRaw && typeof actRaw === "object" && !Array.isArray(actRaw)) {
    Object.keys(actRaw).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k >= edgeKey).sort().forEach((k) => {
      const r = actRaw[k] || {}; const o = {};
      ACTIVITY_FIELDS.forEach((f) => { const v = Number(r[f]) || 0; if (v) o[f] = v; });   // v30: и экзамен, гость, радио, свежесть, золото, зачёт
      if (Object.keys(o).length) activity[k] = o;
    });
  }
  let goal = 2; try { const g = parseInt(st.getItem("sa_goal" + uk) || "", 10); if (g >= 1 && g <= 3) goal = g; } catch (e) {}
  const skillsKey = `sa_skills_${(profile && profile.name) || "guest"}|${(profile && profile.surname) || ""}`.toLowerCase();
  const skRaw = readJSON(st, skillsKey, {});
  const skills = {};
  if (skRaw && typeof skRaw === "object" && !Array.isArray(skRaw)) {
    Object.keys(skRaw).slice(0, 80).forEach((id) => {
      const r = skRaw[id] || {};
      skills[cut(id, 40)] = { by: cut(r.mentor, 60), date: cut(r.date, 10), hall: !!r.hall, pin: !!r.verified && !r.hall, label: cut(r.label, 80) };
    });
  }
  const comp = readJSON(st, "sa_completed" + uk, {});
  const weekly = comp && typeof comp === "object" ? Object.keys(comp).filter((k) => /^weekly_/.test(k)).length : 0;
  let warm = ""; try { warm = cut(st.getItem("sa_warmup" + uk) || "", 10); } catch (e) {}
  // v30: свежесть тем, зачёты на опыт, золотые темы, «Живой гость», закрытые квесты смены
  const mapOf = (key, max, pick) => {
    const raw = readJSON(st, key + uk, {}); const out = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) Object.keys(raw).slice(0, max).forEach((id) => { const v = pick(raw[id] || {}); if (v) out[cut(id, 60)] = v; });
    return out;
  };
  const fresh = mapOf("sa_fresh", 160, (r) => (Number(r.t) ? { t: Number(r.t), n: Number(r.n) || 0 } : null));
  const credits = mapOf("sa_credit", 120, (r) => (r.d ? { d: cut(r.d, 10), s: Number(r.s) || 0, t: Number(r.t) || 0 } : null));
  const gold = mapOf("sa_gold", 120, (r) => (r.d ? { d: cut(r.d, 10), w: Number(r.w) || 0, sec: Number(r.sec) || 0 } : null));
  const gr = readJSON(st, "sa_guest_runs" + uk, []);
  const guests = (Array.isArray(gr) ? gr : []).slice(-20).map((g) => ({ d: cut(g && g.d, 10), s: Number(g && g.s) || 0, p: cut(g && g.p, 40), ai: !!(g && g.ai), fix: cut(g && g.fix, 160) })).filter((g) => g.d);
  const qd = readJSON(st, "sa_quest_done" + uk, []);
  const quests = (Array.isArray(qd) ? qd : []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d))).slice(-60);
  const snap = { v: 2, mistakes, exams, streak, activity, goal, skills, weekly, warm, fresh, credits, gold, guests, quests };
  const mastery = masterySnap(readJSON(st, "sa_life" + uk, null), readJSON(st, "sa_mastery_sum" + uk, null), actRaw);
  if (mastery) snap.mastery = mastery;   // v40: нет данных «Пути мастера» — поля нет вовсе
  return snap;
}

// v40 («Путь мастера», lib/mastery.js): счётчики за всё время (sa_life — не меньше журнала дня)
// и итог значков (sa_mastery_sum: ступени, сколько, бронза, первые шаги, роли мастера, шаг дня).
// Только числа и короткие строки, всё в разумных пределах.
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
const famMap = (o, max) => {
  const out = {};
  if (isObj(o)) Object.keys(o).filter((k) => /^[a-z_]{1,20}$/.test(k)).slice(0, 24).forEach((k) => { const v = int(o[k], max); if (v) out[k] = v; });
  return out;
};
function masterySnap(lifeRaw, sumRaw, actRaw) {
  if (!isObj(lifeRaw) && !isObj(sumRaw)) return null;
  const out = {};
  if (isObj(lifeRaw)) {
    const m = mergeLife(lifeRaw, isObj(actRaw) ? actRaw : {});
    const life = {};
    ACTIVITY_FIELDS.forEach((f) => { const v = int(m[f], 10000000); if (v) life[f] = v; });
    if (m.since) life.since = m.since;
    out.life = life;
  }
  if (isObj(sumRaw)) {
    out.tiers = famMap(sumRaw.tiers, 3);
    out.vals = famMap(sumRaw.vals, 10000000);
    out.bronze = int(sumRaw.bronze, 99);
    out.fw = !!sumRaw.fw;
    out.master = (Array.isArray(sumRaw.master) ? sumRaw.master : []).filter((r) => typeof r === "string" && /^[a-z0-9_-]{1,30}$/i.test(r)).slice(0, 12);
    const step = sumRaw.step;
    if (isObj(step) && step.t) out.step = { day: /^\d{4}-\d{2}-\d{2}$/.test(String(step.day)) ? step.day : "", t: cut(step.t, 160) };
  }
  return out;
}

// Отпечаток копии — чтобы не слать одно и то же
export function snapshotHash(obj) {
  const s = JSON.stringify(obj || {});
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ":" + s.length;
}

// Отправить, если изменилось и прошло 2 минуты (force — не ждать паузу, но и не слать одинаковое)
export async function pushLearning({ uk, profile, force = false, storage } = {}) {
  if (missing || inflight || !profile) return false;
  const st = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  const token = saToken();
  if (!st || !token) return false;
  const snap = learningSnapshot(uk, profile, st);
  if (!snap) return false;
  const h = snapshotHash(snap);
  const sent = readJSON(st, SENT_KEY + uk, {});
  if (sent && sent.h === h) return false;
  if (!force && sent && sent.at && Date.now() - sent.at < MIN_GAP) return false;
  inflight = true;
  try {
    const res = await rpc("sa_learning_push", { p_token: token, p_data: snap });
    if (rpcMissing(res)) { missing = true; return false; }
    if (res && res.ok) {
      try { st.setItem(SENT_KEY + uk, JSON.stringify({ h, at: Date.now() })); } catch (e) {}
      return true;
    }
    return false;
  } catch (e) {
    return false;   // нет сети — пришлём в следующий раз
  } finally {
    inflight = false;
  }
}

// Отложенная отправка: после занятия — через 20 секунд (несколько событий подряд — одна отправка)
export function scheduleLearningPush(args, delay = 20000) {
  clearTimeout(timer);
  timer = setTimeout(() => { pushLearning(args); }, delay);
}

// ── v31 (этап 25): быстрая отметка дня ──────────────────────────────────────────
// Полная копия уходит не чаще раза в 2 минуты — для квеста смены и свечи на двоих это долго:
// коллега видел «0 разминок», хотя ты уже размялся. Теперь после занятия через ~6 секунд
// уходит одна запись — сегодняшний день журнала (sa_day_push). Сервер берёт наибольшее.
// Нет этапа 25 или сети — тихо, полная копия всё равно придёт.
let dayMissing = false;
let dayTimer = 0;
let dayInflight = false;
export function dayRecord(uk, storage, now = new Date()) {
  const st = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!st) return null;
  const act = readJSON(st, "sa_activity" + uk, {});
  const key = dayKey(now);
  const r = (act && typeof act === "object" && act[key]) || {};
  const rec = {};
  ACTIVITY_FIELDS.forEach((f) => { const v = Math.floor(Number(r[f]) || 0); if (v > 0) rec[f] = Math.min(1000, v); });
  return Object.keys(rec).length ? { day: key, rec } : null;
}
export async function pushDay({ uk, profile, storage, now } = {}) {
  if (dayMissing || dayInflight || !profile) return false;
  const token = saToken();
  const d = dayRecord(uk, storage, now || new Date());
  if (!token || !d) return false;
  dayInflight = true;
  try {
    const res = await rpc("sa_day_push", { p_token: token, p_day: d.day, p_rec: d.rec });
    if (rpcMissing(res)) { dayMissing = true; return false; }
    return !!(res && res.ok);
  } catch (e) {
    return false;
  } finally {
    dayInflight = false;
  }
}
export function scheduleDayPush(args, delay = 6000) {
  if (dayMissing) return;
  clearTimeout(dayTimer);
  // токен — на момент занятия: вышел и зашёл другой человек за эти секунды — день прошлого
  // не уходит под чужим токеном (ревью v31)
  const tok = saToken();
  dayTimer = setTimeout(() => { if (saToken() === tok) pushDay(args); }, delay);
}
export function cancelDayPush() { clearTimeout(dayTimer); dayTimer = 0; }

// для тестов
export function _resetLearningSync() { missing = false; inflight = false; clearTimeout(timer); dayMissing = false; dayInflight = false; clearTimeout(dayTimer); }
