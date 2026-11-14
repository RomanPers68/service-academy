// lib/lesson-done.js — v158 (Доп. 483): что сказать человеку сразу после «Урок пройден».
//
// Владелец (14.11) на «что ещё заметил»: «Давай все пять». Первое из пяти: кнопка после урока молча менялась на
// «Далее», а вспышка «Цель дня ✓» бывает только в ту секунду, когда цель уже выполнена. Теперь под кнопкой — тихая
// строка: бокал цели дня («1 из 2», наполняется на глазах) и сколько шагов осталось до конца раздела. Без шторок и
// затемнений (Доп. 205): урок остаётся на месте, кнопка там же, где была.
import { plural } from "./quest";

/**
 * goal — { steps, goal }: шагов сегодня (уже с этим уроком) и цель дня; left — сколько шагов раздела ещё не пройдено
 * (null — урок открыт не из раздела).
 * → { goal: { reached, steps, of, pct, from, text } | null, left: { n, text } | null } или null, если сказать нечего.
 *   pct — насколько налит бокал сейчас, from — насколько был налит до этого урока (бокал доливается на глазах).
 */
export function doneNote(goal, left = null) {
  const of = Math.max(0, Math.floor(Number(goal && goal.goal) || 0));
  const st = Math.max(0, Math.floor(Number(goal && goal.steps) || 0));
  const g = of > 0 ? {
    reached: st >= of, steps: Math.min(st, of), of,
    pct: Math.min(1, st / of), from: Math.min(1, Math.max(0, st - 1) / of),
    text: st >= of ? "Цель дня есть" : "Цель дня: " + st + " из " + of,
  } : null;
  const ln = left == null || left === "" ? NaN : Number(left);
  const n = Number.isFinite(ln) ? Math.max(0, Math.floor(ln)) : null;
  const l = n === null ? null : { n, text: n === 0 ? "Раздел пройден" : "До конца раздела " + n + " " + plural(n, "шаг", "шага", "шагов") };
  return g || l ? { goal: g, left: l } : null;
}
