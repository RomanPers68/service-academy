// lib/practice-round.js — новый раунд практики (Доп. 290).
// Вынесено из экрана практики без изменения логики, чтобы «Сыграть ещё раз»
// одинаково работал в обоих видах — классическом и «у стола»:
// сначала ситуации, которых ещё не было; когда показали все — история с нуля.
import { pickRandom, shuffleSituationOptions } from "./utils";

export const sitKey = (s) => s.scene || s.statement || s.question || JSON.stringify(s).slice(0, 60);

export function practiceRound(pool, usedIds) {
  const list = pool || [];
  const shownKeys = new Set(usedIds || []);
  const fresh = list.filter((s) => !shownKeys.has(sitKey(s)));
  const sourcePool = fresh.length >= 6 ? fresh : list;
  const shuffled = pickRandom([...sourcePool], 6).map(shuffleSituationOptions);
  const newUsedIds = [...shownKeys];
  shuffled.forEach((s) => { const k = sitKey(s); if (!newUsedIds.includes(k)) newUsedIds.push(k); });
  const finalUsedIds = newUsedIds.length >= list.length ? [] : newUsedIds;
  return { step: 0, choice: null, results: [], done: false, lives: 3, score: 0, combo: 0, situations: shuffled, flash: null, timerActive: false, timeLeft: 10, inputVal: "", usedIds: finalUsedIds };
}
