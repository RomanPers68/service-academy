// lib/warmup.js — «Разминка до смены» (Доп. 301): три ситуации из того, что уже начал.
// Источник — практика разделов, где пройден хотя бы один шаг (новое не подсовываем);
// ничего не начато — первый раздел. Выбор стабилен на день (зерно — дата и человек):
// открыл, вышел, вернулся — те же ситуации. Жанры по возможности разные.
import { practicePool, quizPool } from "./table-pick";

export function warmupPool(modules, completed = {}, quizDone = {}) {
  const mods = (modules || []).filter((m) => m && Array.isArray(m.lessons));
  const isDone = (l) => (l.type === "quiz" ? !!quizDone[l.id] : !!completed[l.id]);
  const started = mods.filter((m) => m.lessons.some(isDone));
  const pick = (list) => list.flatMap((m) => practicePool(m));
  let pool = pick(started);
  if (!pool.length) pool = pick(mods.slice(0, 1));
  if (!pool.length) pool = pick(mods);
  if (!pool.length) {
    // Доп. 310: в треке нет практики (бар, хостес) — вопросы сданных тестов, иначе начатых тем
    const passed = new Set(Object.keys(quizDone || {}).filter((k) => quizDone[k]));
    pool = mods.flatMap((m) => quizPool(m, passed));
    if (!pool.length) pool = (started.length ? started : mods.slice(0, 1)).flatMap((m) => quizPool(m));
  }
  return pool;
}

function rng(seedStr) {
  let h = 1779033703 ^ String(seedStr).length;
  for (let i = 0; i < String(seedStr).length; i++) { h = Math.imul(h ^ String(seedStr).charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// v30 (Доп. 313): prefer — темы, которые «выдыхаются»: до двух заданий берём из них первыми
export function pickWarmup(pool, n = 3, seed = "", prefer = null) {
  const list = (pool || []).slice();
  const r = rng(seed || "sa");
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const out = [];
  const genre = (s) => s.genre || s.type || "action";
  const pref = prefer && prefer.size ? list.filter((s) => prefer.has(s._mod)) : [];
  for (const s of pref) { if (out.length >= Math.min(2, n)) break; if (!out.some((x) => genre(x) === genre(s))) out.push(s); }
  for (const s of list) { if (out.length >= n) break; if (out.indexOf(s) < 0 && !out.some((x) => genre(x) === genre(s))) out.push(s); }
  for (const s of list) { if (out.length >= n) break; if (out.indexOf(s) < 0) out.push(s); }
  return out;
}

// v30: «Освежить тему» — три задания из этой темы (ситуации практики, иначе вопросы теста)
export function refreshPick(pool, n = 3, seed = "") { return pickWarmup(pool, n, seed); }
