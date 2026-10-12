// lib/marks.js — Доп. 315–316: «Зачёт на опыт» и «Золотая тема».
//
// Зачёт на опыт: опытный сотрудник сдаёт тему сразу — 7 заданий без подсказок (вопросы теста
// темы и ситуации её практики), от 80% (6 из 7) — тема засчитана с пометкой «по опыту».
// Одна попытка на тему в день: зачёт — проверка, а не перебор вариантов.
// Золотая тема: после прохождения — «раунд мастера»: 8 заданий на время, без подсказок,
// не больше одной ошибки — номер темы в оглавлении становится золотым, в «Книге отзывов» печать.
//
// Хранится на телефоне и уходит в отчёт руководителя (копия этапа 23):
//   sa_credit<uk> = { [id темы]: { d: "ГГГГ-ММ-ДД", s: верных, t: всего } }
//   sa_gold<uk>   = { [id темы]: { d, w: ошибок, sec: секунд } }
//   sa_credit_try<uk> = { [id темы]: "ГГГГ-ММ-ДД" } — когда была последняя попытка зачёта
import { practicePool, quizPool, tablePool } from "./table-pick";

export const CREDIT_N = 7, CREDIT_PASS = 6;
export const GOLD_N = 8, GOLD_MAX_WRONG = 1, GOLD_TIMER = 20;

const ls = (storage) => storage || (typeof localStorage !== "undefined" ? localStorage : null);
const readMap = (key, storage) => { try { const s = ls(storage); const v = JSON.parse((s && s.getItem(key)) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } };
const writeMap = (key, map, storage) => { try { const s = ls(storage); if (s) s.setItem(key, JSON.stringify(map || {})); } catch (e) {} return map; };

export const readCredits = (uk, storage) => readMap("sa_credit" + (uk || ""), storage);
export const readGold = (uk, storage) => readMap("sa_gold" + (uk || ""), storage);
export function saveCredit(uk, id, rec, storage) { const m = readCredits(uk, storage); m[id] = rec; return writeMap("sa_credit" + (uk || ""), m, storage); }
export function saveGold(uk, id, rec, storage) {
  const m = readGold(uk, storage);
  const prev = m[id];
  // лучший результат остаётся: меньше ошибок, при равенстве — быстрее
  if (!prev || (rec.w < prev.w) || (rec.w === prev.w && rec.sec < prev.sec)) m[id] = rec;
  return writeMap("sa_gold" + (uk || ""), m, storage);
}
export function creditTriedToday(uk, id, day, storage) { return readMap("sa_credit_try" + (uk || ""), storage)[id] === day; }
export function markCreditTry(uk, id, day, storage) { const m = readMap("sa_credit_try" + (uk || ""), storage); m[id] = day; writeMap("sa_credit_try" + (uk || ""), m, storage); }

function rng(seed) {
  let h = 2166136261 >>> 0; const s = String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(list, seed) {
  const a = list.slice(); const r = rng(seed);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// вопросы теста темы и ситуации её практики вперемешку: сначала поровну, потом чем есть
function mix(mod, n, quizShare, seed) {
  const q = shuffle(quizPool(mod), seed + "q"), p = shuffle(practicePool(mod), seed + "p");
  const wantQ = Math.min(q.length, Math.max(n - p.length, Math.round(n * quizShare)));
  const out = q.slice(0, wantQ).concat(p.slice(0, n - wantQ));
  return shuffle(out, seed + "m").slice(0, n);
}

export const creditPool = (mod, seed = Date.now()) => mix(mod, CREDIT_N, 5 / 7, "c" + seed);
export const goldPool = (mod, seed = Date.now()) => mix(mod, GOLD_N, 0.5, "g" + seed);
// хватает ли заданий в теме: зачёт — от 5, раунд мастера — от 6
export const canCredit = (mod) => quizPool(mod).length + practicePool(mod).length >= 5;
export const canGold = (mod) => quizPool(mod).length + practicePool(mod).length >= 6;
// освежать есть чем: хотя бы 2 задания «у стола» (ситуации практики или вопросы теста).
// В темах из одних уроков свежесть не ведём — «Освежить» там открыл бы пустой стол (ревью v30)
export const canRefresh = (mod) => tablePool(mod).length >= 2;

// итог зачёта: сколько нужно из скольких
export function creditPassed(firstOk, total) { return total > 0 && firstOk >= Math.ceil(total * CREDIT_PASS / CREDIT_N); }
export function goldPassed(firstOk, total) { return total > 0 && total - firstOk <= GOLD_MAX_WRONG; }
