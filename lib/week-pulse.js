// lib/week-pulse.js — v159 (Доп. 484): «Пульс недели» на главной владельца — сколько тестов сдано с понедельника,
// сколько человек в игре и кто лидер (больше всех очков за неделю). Раньше счёт жил прямо в разметке главной
// (ui/screens-roleselect.jsx); вынесен, чтобы у лидера были не только имя, но и заведение: по ним находится его фото.
// scores — строки team_scores: { name, surname, restaurant, score, updated_at }.

/** Понедельник этой недели, 00:00 по часам телефона (мс). */
export function weekStart(now = new Date()) {
  const d = new Date(now);
  const dw = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dw);
  return d.getTime();
}

/** → { tests, people, leader: { full, name, surname, restaurant, sum } } или null, если на этой неделе тестов не было. */
export function weekPulse(scores, now = new Date()) {
  const ws = weekStart(now);
  const wk = (Array.isArray(scores) ? scores : []).filter((q) => q && q.updated_at && new Date(q.updated_at).getTime() >= ws);
  if (!wk.length) return null;
  const by = new Map();
  for (const q of wk) {
    const k = q.name + " " + (q.surname || "");
    const e = by.get(k) || { full: k.trim(), name: String(q.name || ""), surname: String(q.surname || ""), restaurant: String(q.restaurant || ""), sum: 0 };
    e.sum += q.score || 0;
    by.set(k, e);
  }
  // при равенстве — тот, кто встретился раньше (как было: сортировка устойчивая)
  const leader = [...by.values()].sort((a, b) => b.sum - a.sum)[0] || null;
  return { tests: wk.length, people: by.size, leader };
}
