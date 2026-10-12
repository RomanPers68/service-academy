// lib/activity.js — журнал дня и цель дня (Доп. 298).
// По дням (локальная дата): шаги (уроки, практики, тесты, диалоги, сборки, разминки),
// ситуации, исправленные ошибки. Из него — стакан «цель дня» и «чек недели».
// Хранится у сотрудника на телефоне (sa_activity<uk>), последние 75 дней (v31: было 60 — «Итогам
// месяца» для сравнения с прошлым месяцем нужен прошлый месяц целиком, а это до 63 дней назад).

import { ymd } from "./streak";

const KEY = "sa_activity";
const GOAL_KEY = "sa_goal";
const KEEP_DAYS = 75;
export const ACTIVITY_KEEP_DAYS = KEEP_DAYS;
// что считается шагом к цели дня
// Доп. 310: шаг — и тренажёры (колоды меню и бара, «Сборка руками», спринт аллергенов), и экзамен
// v30: шаг — и «Живой гость», выпуск «Радио в дорогу», освежённая тема, раунд мастера, зачёт на опыт
const STEP_KINDS = { lesson: "l", practice: "p", quiz: "q", dialogue: "d", build: "b", warmup: "w", trainer: "m", exam: "x",
  guest: "g", radio: "r", refresh: "u", gold: "o", credit: "k" };
const OTHER_KINDS = { sit: "s", fix: "f", check: "c" };
// все буквы журнала — для копии на сервер и отчётов
export const ACTIVITY_FIELDS = ["st", "l", "p", "q", "d", "b", "w", "m", "x", "g", "r", "u", "o", "k", "s", "f", "c"];

// Доп. 314: очки «Лиги недели» — за занятия, а не за стаж. Те же числа считает сервер (этап 24).
// Предел в день — чтобы тренажёр по кругу не заменял учёбу.
export const POINTS = { l: 10, p: 10, q: 15, d: 15, b: 10, w: 10, m: 5, x: 30, g: 20, r: 5, u: 10, o: 25, k: 15, f: 3, s: 1, c: 2 };
export const DAY_CAP = 200;
export function pointsOf(rec) {
  let p = 0;
  Object.keys(POINTS).forEach((k) => { p += (Number(rec && rec[k]) || 0) * POINTS[k]; });
  return Math.min(DAY_CAP, Math.max(0, Math.round(p)));
}
// понедельник текущей недели (локальная дата)
export function weekStart(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
// очки с понедельника по сегодня
export function weekPoints(act, now = new Date()) {
  const from = ymd(weekStart(now)), to = ymd(now);
  let p = 0;
  Object.keys(act || {}).forEach((k) => { if (k >= from && k <= to) p += pointsOf(act[k]); });
  return p;
}

const ls = (storage) => storage || (typeof localStorage !== "undefined" ? localStorage : null);

export function readActivity(uk, storage) {
  try { const s = ls(storage); const v = JSON.parse((s && s.getItem(KEY + (uk || ""))) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
}

function prune(act, now) {
  const keep = new Date(now.getTime()); keep.setDate(keep.getDate() - KEEP_DAYS);
  const edge = ymd(keep);
  const out = {};
  Object.keys(act).forEach((k) => { if (k >= edge) out[k] = act[k]; });
  return out;
}

// Отметить событие. Возвращает новый журнал (и сохраняет его).
export function bumpActivity(uk, kind, n = 1, now = new Date(), storage) {
  const act = readActivity(uk, storage);
  const day = ymd(now);
  const rec = { ...(act[day] || {}) };
  const f = STEP_KINDS[kind] || OTHER_KINDS[kind];
  if (!f) return act;
  rec[f] = (rec[f] || 0) + n;
  if (STEP_KINDS[kind]) rec.st = (rec.st || 0) + n;
  const next = prune({ ...act, [day]: rec }, now);
  try { const s = ls(storage); if (s) s.setItem(KEY + (uk || ""), JSON.stringify(next)); } catch (e) {}
  return next;
}

export function stepsOn(act, day) { return ((act && act[day]) || {}).st || 0; }

export function readGoal(uk, storage) {
  try { const s = ls(storage); const v = parseInt((s && s.getItem(GOAL_KEY + (uk || ""))) || "", 10); return v >= 1 && v <= 3 ? v : 2; } catch (e) { return 2; }
}
export function saveGoal(uk, v, storage) {
  const g = Math.max(1, Math.min(3, v | 0 || 2));
  try { const s = ls(storage); if (s) s.setItem(GOAL_KEY + (uk || ""), String(g)); } catch (e) {}
  return g;
}

// Чек недели: последние 7 дней (сегодня включительно), серия и выходные по графику
export function weekSummary(act, streak, now = new Date()) {
  const days = [];
  const tot = { st: 0, l: 0, p: 0, q: 0, d: 0, b: 0, w: 0, m: 0, x: 0, g: 0, r: 0, u: 0, o: 0, k: 0, s: 0, f: 0 };
  const active = new Set((streak && streak.days) || []);
  const frozen = new Set((streak && streak.frozen) || []);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime()); d.setDate(d.getDate() - i);
    const key = ymd(d);
    const r = (act && act[key]) || {};
    Object.keys(tot).forEach((k) => { tot[k] += r[k] || 0; });
    days.push({ key, dow: (d.getDay() + 6) % 7, steps: r.st || 0, active: active.has(key) || (r.st || 0) > 0 || (r.s || 0) > 0 || (r.f || 0) > 0, frozen: frozen.has(key) });
  }
  const best = days.reduce((b, x) => (x.steps > (b ? b.steps : 0) ? x : b), null);
  return { from: days[0].key, to: days[6].key, days, totals: tot, activeDays: days.filter((x) => x.active).length, best };
}

// Текст для «поделиться» — без личных данных, кроме имени, которое человек и так показывает команде
export function weekShareText(sum, streak, name) {
  const t = sum.totals;
  const parts = [];
  if (t.l) parts.push(t.l + " " + pl(t.l, "урок", "урока", "уроков"));
  if (t.p) parts.push(t.p + " " + pl(t.p, "практика", "практики", "практик"));
  if (t.q) parts.push(t.q + " " + pl(t.q, "тест", "теста", "тестов"));
  if (t.d) parts.push(t.d + " " + pl(t.d, "диалог", "диалога", "диалогов") + " с гостем");
  if (t.b) parts.push(t.b + " " + pl(t.b, "сборка", "сборки", "сборок"));
  if (t.m) parts.push(t.m + " " + pl(t.m, "тренировка", "тренировки", "тренировок") + " в тренажёрах");
  if (t.x) parts.push(t.x + " " + pl(t.x, "экзамен", "экзамена", "экзаменов"));
  if (t.g) parts.push(t.g + " " + pl(t.g, "живой гость", "живых гостя", "живых гостей"));
  if (t.r) parts.push(t.r + " " + pl(t.r, "выпуск", "выпуска", "выпусков") + " радио");
  if (t.u) parts.push(t.u + " " + pl(t.u, "тема освежена", "темы освежены", "тем освежено"));
  if (t.o) parts.push(t.o + " " + pl(t.o, "золотая тема", "золотые темы", "золотых тем"));
  if (t.k) parts.push(t.k + " " + pl(t.k, "зачёт", "зачёта", "зачётов") + " на опыт");
  if (t.s) parts.push(t.s + " " + pl(t.s, "ситуация", "ситуации", "ситуаций") + " у стола");
  if (t.w) parts.push(t.w + " " + pl(t.w, "разминка", "разминки", "разминок") + " до смены");
  if (t.f) parts.push(t.f + " " + pl(t.f, "ошибка исправлена", "ошибки исправлены", "ошибок исправлено"));
  const c = (streak && streak.count) || 0;
  return "✦ Чек недели" + (name ? " — " + name : "") + "\n" +
    (parts.length ? parts.join(" · ") : "неделя отдыха") +
    "\nДней в деле: " + sum.activeDays + " из 7" + (c ? " · серия " + c + " " + pl(c, "день", "дня", "дней") : "") +
    "\nService Academy";
}

// Доп. 310: занятие в тренажёре или другом экране без доступа к App — событием; App отмечает
// его в журнале дня и в свече (lib/day-mode, «Сборка руками», спринт аллергенов)
export const ACTIVITY_EVENT = "sa:activity";
export function emitActivity(kind) {
  try { if (typeof window !== "undefined" && window.dispatchEvent) window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT, { detail: { kind } })); } catch (e) {}
}

function pl(n, a, b, c) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b; return c; }
