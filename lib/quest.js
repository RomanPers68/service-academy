// lib/quest.js — Доп. 314: «Квест смены».
//
// Общая цель для тех, кто сегодня в графике заведения (сервер, этап 24: quest_today) —
// разминки, шаги, живые гости; вклад каждого виден точками. И «твоя часть» — три личных
// задания на день из слабых мест: повторить ошибки, освежить выдохшуюся тему, разминка,
// живой гость, следующий шаг трека. Задания выбираются утром и не меняются до конца дня;
// прогресс считается сам — по журналу дня. Закрытый квест — печать «Смена отработана»
// в «Чеке недели» (sa_quest_done<uk> — даты закрытых квестов).

export const TASKS_KEY = "sa_quest_tasks";
export const DONE_KEY = "sa_quest_done";

const ls = (storage) => storage || (typeof localStorage !== "undefined" ? localStorage : null);
const read = (key, d, storage) => { try { const s = ls(storage); const v = JSON.parse((s && s.getItem(key)) || "null"); return v == null ? d : v; } catch (e) { return d; } };
const write = (key, v, storage) => { try { const s = ls(storage); if (s) s.setItem(key, JSON.stringify(v)); } catch (e) {} };

// Три личных задания. ctx: { day, dueMistakes, faded: [{ id, title }], warm: bool (сегодня смена и разминка не сделана),
// next: { title } | null, guest: bool (живой гость доступен) }
export function pickTasks(ctx) {
  const out = [];
  const add = (t) => { if (out.length < 3 && !out.some((x) => x.id === t.id)) out.push(t); };
  if (ctx.dueMistakes > 0) add({ id: "fix", need: Math.min(2, ctx.dueMistakes), label: ctx.dueMistakes >= 2 ? "Повтори 2 вопроса из «Работы над ошибками»" : "Повтори вопрос из «Работы над ошибками»", f: "f", go: "mistakes" });
  if (ctx.faded && ctx.faded.length) add({ id: "fresh", need: 1, label: "Освежи тему «" + ctx.faded[0].title + "»", f: "u", go: "refresh", mod: ctx.faded[0].id });
  if (ctx.warm) add({ id: "warm", need: 1, label: "Разминка до смены — 2 минуты", f: "w", go: "warmup" });
  if (ctx.guest) add({ id: "guest", need: 1, label: "Обслужи живого гостя", f: "g", go: "guest" });
  if (ctx.next) add({ id: "step", need: 1, label: "Следующий шаг: «" + ctx.next.title + "»", f: "l", alt: ["p", "q", "d", "b"], go: "track" });
  add({ id: "steps", need: 2, label: "Два шага обучения за день", f: "st", go: "track" });
  return out;
}

// Задания на сегодня: выбранные утром остаются до конца дня
export function tasksFor(uk, ctx, storage) {
  const cur = read(TASKS_KEY + (uk || ""), null, storage);
  if (cur && cur.day === ctx.day && Array.isArray(cur.tasks) && cur.tasks.length) return cur.tasks;
  const tasks = pickTasks(ctx);
  write(TASKS_KEY + (uk || ""), { day: ctx.day, tasks }, storage);
  return tasks;
}

// Прогресс задания по записи журнала за сегодня
export function taskProgress(task, rec) {
  const r = rec || {};
  let have = Number(r[task.f]) || 0;
  (task.alt || []).forEach((k) => { have += Number(r[k]) || 0; });
  return { have: Math.min(have, task.need), need: task.need, done: have >= task.need };
}

// Квест закрыт — запомнить день (один раз)
export function markQuestDone(uk, day, storage) {
  const list = read(DONE_KEY + (uk || ""), [], storage);
  const arr = Array.isArray(list) ? list : [];
  if (arr.indexOf(day) >= 0) return arr;
  const next = arr.concat([day]).slice(-90);
  write(DONE_KEY + (uk || ""), next, storage);
  return next;
}
export function questDays(uk, storage) { const v = read(DONE_KEY + (uk || ""), [], storage); return Array.isArray(v) ? v : []; }

// Подписи целей квеста
export const GOAL_WORDS = {
  warm: ["разминка", "разминки", "разминок"],
  steps: ["шаг", "шага", "шагов"],
  guest: ["живой гость", "живых гостя", "живых гостей"],
};
export function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b; return c; }
export const goalLine = (goal) => ["warm", "steps", "guest"].filter((k) => goal && goal[k]).map((k) => goal[k] + " " + plural(goal[k], ...GOAL_WORDS[k])).join(" · ");
