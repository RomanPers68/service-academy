// lib/freshness.js — Доп. 313: «Свежесть тем».
//
// Пройденная тема со временем «выдыхается», как открытое вино: номер темы в оглавлении трека
// бледнеет, в меню темы — «Освежить за минуту». Прогресс НЕ отнимается: тема остаётся
// пройденной, меняется только свежесть. Освежил (3 задания, хотя бы 2 верно) — тема снова
// свежая, а следующий срок длиннее: 3 → 7 → 14 → 30 → 60 дней (как повторение в «Работе над
// ошибками»). Верный ответ в разминке по теме тоже освежает её (срок не растёт).
// Свой раздел обновили в редакторе после того, как его освежали, — пометка «обновлено».
// Узнаём по отпечатку текста раздела (mod.rev, lib/custom-modules.js): он запоминается, когда
// тему впервые увидели пройденной и когда её освежили целиком (ревью v30: дат правки у
// разделов нет, и раньше пометка не появлялась никогда).
//
// Хранится на телефоне: sa_fresh<uk> = { [id темы]: { t: когда освежали (мс), n: сколько раз, h?: отпечаток } }.
// Отсчёт начинается с момента, когда приложение впервые увидело тему пройденной: старых дат
// прохождения у приложения нет, и выдумывать их не будем.

export const FRESH_KEY = "sa_fresh";
export const INTERVALS = [3, 7, 14, 30, 60];   // дни
const DAY = 86400000;

const ls = (storage) => storage || (typeof localStorage !== "undefined" ? localStorage : null);

export function readFresh(uk, storage) {
  try { const s = ls(storage); const v = JSON.parse((s && s.getItem(FRESH_KEY + (uk || ""))) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
}
export function saveFresh(uk, map, storage) {
  try { const s = ls(storage); if (s) s.setItem(FRESH_KEY + (uk || ""), JSON.stringify(map || {})); } catch (e) {}
  return map;
}

const realSteps = (m) => ((m && m.lessons) || []).filter((l) => l && l.type !== "result");
export function moduleDone(m, completed = {}, quizDone = {}) {
  const st = realSteps(m);
  return st.length > 0 && st.every((l) => (l.type === "quiz" ? !!quizDone[l.id] : !!completed[l.id]));
}

// Пройденные темы без записи получают отсчёт «с сегодня». → { map, changed }
export function syncFresh(map, modules, completed, quizDone, now = Date.now()) {
  const out = { ...(map || {}) };
  let changed = false;
  (modules || []).forEach((m) => {
    if (!m || !m.id) return;
    const cur = out[m.id];
    // запись без отпечатка (сделана раньше) — запоминаем текущий молча, без «обновлено»
    if (cur) { if (m.rev && !cur.h) { out[m.id] = { ...cur, h: m.rev }; changed = true; } return; }
    if (moduleDone(m, completed, quizDone)) { out[m.id] = m.rev ? { t: now, n: 0, h: m.rev } : { t: now, n: 0 }; changed = true; }
  });
  return { map: out, changed };
}

// Свежесть записи: fresh — свежая; fading — выдыхается; faded — выдохлась. k — насколько яркий номер (1…0.4)
export function freshOf(rec, now = Date.now()) {
  if (!rec || !Number(rec.t)) return null;
  const n = Math.max(0, Number(rec.n) || 0);
  const interval = INTERVALS[Math.min(n, INTERVALS.length - 1)] * DAY;
  const el = Math.max(0, now - Number(rec.t));
  const days = Math.floor(el / DAY);
  if (el < interval) return { level: "fresh", k: 1, days, interval: interval / DAY, dueIn: Math.ceil((interval - el) / DAY) };
  if (el < interval * 2) return { level: "fading", k: Math.round((1 - 0.45 * ((el - interval) / interval)) * 100) / 100, days, interval: interval / DAY, dueIn: 0 };
  return { level: "faded", k: 0.4, days, interval: interval / DAY, dueIn: 0 };
}

// Освежил тему целиком: срок растёт. Верный ответ в разминке: light — только отсчёт заново.
// rev — отпечаток текста раздела: целиком освежённая тема снова «как сейчас в редакторе»;
// разминка отпечаток не трогает (пометка «обновлено» остаётся до настоящего повтора).
export function touchFresh(map, id, now = Date.now(), light = false, rev = null) {
  if (!id) return map || {};
  const cur = (map || {})[id] || { t: now, n: 0 };
  const h = !light && rev ? rev : cur.h;
  return { ...(map || {}), [id]: { t: now, n: light ? (Number(cur.n) || 0) : (Number(cur.n) || 0) + 1, ...(h ? { h } : {}) } };
}

// Свой раздел изменили в редакторе после того, как тема была свежей
export function updatedAfter(mod, rec) {
  if (!mod || !rec) return false;
  if (mod.rev && rec.h && mod.rev !== rec.h) return true;
  if (!mod.updatedAt || !Number(rec.t)) return false;
  const u = Date.parse(mod.updatedAt);
  return Number.isFinite(u) && u > Number(rec.t);
}

// Состояние темы для оглавления и меню: null — тема не пройдена (свежесть не считается)
export function topicFreshness(mod, map, completed, quizDone, now = Date.now()) {
  if (!mod || !moduleDone(mod, completed, quizDone)) return null;
  const rec = (map || {})[mod.id];
  const f = freshOf(rec, now) || { level: "fresh", k: 1, days: 0, interval: INTERVALS[0], dueIn: INTERVALS[0] };
  if (updatedAfter(mod, rec)) return { ...f, level: f.level === "fresh" ? "fading" : f.level, k: Math.min(f.k, 0.7), updated: true };
  return f;
}

// Выдыхающиеся темы — самые бледные первыми
export function fadedList(map, modules, completed, quizDone, now = Date.now()) {
  return (modules || []).map((m) => ({ mod: m, f: topicFreshness(m, map, completed, quizDone, now) }))
    .filter((x) => x.f && x.f.level !== "fresh")
    .sort((a, b) => (a.f.k - b.f.k) || (b.f.days - a.f.days));
}

// v31: «уровень вина» в бокале под номером темы: 1 — свежая (полный), к донышку — пора освежить
export function wineLevel(f) {
  if (!f) return null;
  if (f.level === "fresh" && !f.updated) return 1;
  if (f.level === "faded") return 0.12;
  const k = Math.max(0.55, Math.min(1, Number(f.k) || 0.55));
  return Math.round((0.25 + 0.5 * ((k - 0.55) / 0.45)) * 100) / 100;
}

// Подпись для меню темы и подсказки над номером
export function freshLabel(f) {
  if (!f) return "";
  if (f.updated) return "обновлено, освежи";
  if (f.level === "faded") return "выдохлась · " + f.days + " " + plural(f.days, "день", "дня", "дней") + " без повтора";
  if (f.level === "fading") return "выдыхается, пора освежить";
  return "свежая" + (f.dueIn ? " · ещё " + f.dueIn + " " + plural(f.dueIn, "день", "дня", "дней") : "");
}

function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b; return c; }
