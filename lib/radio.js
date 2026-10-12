// lib/radio.js — Доп. 319: «Радио в дорогу».
//
// Выпуск на 3–4 минуты из урока твоего трека: ведущий читает главное из урока, потом сценка
// у стола (гость → как ответить → почему так) и два вопроса на закрепление. Слушать — по пути
// на смену. Плейлист на сегодня: следующий урок трека, выдохшаяся тема (освежить на слух)
// и пройденная тема на повтор. Озвучка — голосом телефона (speechSynthesis), без сети.
import { practicePool, quizPool } from "./table-pick";

const WORDS_MAX = 330;      // ≈ 2,5 минуты ведущего
const DONE_KEY = "sa_radio_done";

// Строка урока → фраза для чтения вслух: без разметки, эмодзи и служебных меток
export function cleanLine(t) {
  return String(t || "")
    .replace(/\[mm:[^\]]*\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/^[\s•\-–—*]+/, "")
    .replace(/^[1-9]️?⃣\s*/u, "")
    .replace(/[\p{Extended_Pictographic}️‍⃣]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
const words = (s) => String(s || "").split(/\s+/).filter(Boolean).length;

// Главное из урока: заголовки и фразы подряд, пока не наберётся ~330 слов
export function lessonSegments(content, max = WORDS_MAX) {
  const out = [];
  let n = 0;
  for (const raw of String(content || "").split("\n")) {
    const t = raw.trim();
    if (!t) continue;
    const head = /^\*\*.*\*\*:?$/.test(t);
    const text = cleanLine(t);
    if (!text || text.length < 3) continue;
    const w = words(text);
    if (n + w > max && out.length) break;
    out.push({ who: "host", text: head ? text.replace(/:$/, "") + "." : /[.!?…»"]$/.test(text) ? text : text + ".", head });
    n += w;
  }
  return out;
}

function rng(seed) {
  let h = 2166136261 >>> 0; const s = String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pickOne = (list, r) => (list.length ? list[Math.floor(r() * list.length)] : null);

// Сценка у стола из ситуации практики: что видим, что сказать, почему
function sceneOf(sit) {
  if (!sit) return [];
  const right = Array.isArray(sit.options) && typeof sit.correct === "number" ? String(sit.options[sit.correct] || "") : "";
  if (!right || sit.genre === "truefalse" || sit.genre === "complete") return [];
  const segs = [{ who: "host", text: "Сценка у стола.", head: true }];
  if (sit.scene) segs.push({ who: "host", text: cleanLine(sit.scene) });
  if (sit.guestThought) segs.push({ who: "guest", text: cleanLine(sit.guestThought) });
  if (sit.question) segs.push({ who: "host", text: cleanLine(sit.question) });
  segs.push({ who: "staff", text: cleanLine(right.replace(/^[«"“]|[»"”]$/g, "")) });
  const why = cleanLine(String(sit.win || "").replace(/^🎯\s*/u, ""));
  if (why) segs.push({ who: "host", text: why });
  return segs;
}

// Выпуск по уроку темы. kind: next — следующий урок, fresh — освежить, repeat — повтор
export function buildEpisode(mod, lesson, kind = "repeat", seed = "") {
  if (!mod || !lesson) return null;
  const r = rng(seed + lesson.id);
  const intro = kind === "next" ? "Следующий урок твоего трека" : kind === "fresh" ? "Освежаем тему, которая начала выдыхаться" : "Повторяем пройденное";
  const segs = [
    { who: "host", text: "Радио в дорогу. " + intro + ": «" + cleanLine(lesson.title) + "». Тема — «" + cleanLine(mod.title) + "».", head: true },
    ...lessonSegments(lesson.content),
  ];
  const sit = pickOne(practicePool(mod).filter((s) => s.genre !== "truefalse" && s.genre !== "complete"), r);
  segs.push(...sceneOf(sit));
  const qs = quizPool(mod).slice();
  for (let i = qs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [qs[i], qs[j]] = [qs[j], qs[i]]; }
  const quiz = qs.slice(0, 2);
  segs.push({ who: "host", text: quiz.length ? "И два вопроса на закрепление — ответь на экране." : "Вот и весь выпуск. Хорошей смены!", head: true });
  const total = segs.reduce((a, s) => a + words(s.text), 0);
  return { id: lesson.id, modId: mod.id, kind, title: cleanLine(lesson.title), topic: cleanLine(mod.title), segs, quiz, mins: Math.max(1, Math.round(total / 140)) };
}

const isDone = (l, completed, quizDone) => (l.type === "quiz" ? !!quizDone[l.id] : !!completed[l.id]);
const textLessons = (m) => ((m && m.lessons) || []).filter((l) => l && l.type === "lesson" && String(l.content || "").length > 200);

// Плейлист на сегодня: следующий урок, выдохшаяся тема, повтор пройденного
export function playlist({ modules = [], completed = {}, quizDone = {}, faded = [], seed = "" } = {}) {
  const r = rng("pl" + seed);
  const out = [];
  const seen = new Set();
  const push = (mod, lesson, kind) => { if (!mod || !lesson || seen.has(lesson.id)) return; const e = buildEpisode(mod, lesson, kind, seed); if (e) { seen.add(lesson.id); out.push(e); } };
  // следующий текстовый урок трека
  for (const m of modules) { const l = textLessons(m).find((x) => !isDone(x, completed, quizDone)); if (l) { push(m, l, "next"); break; } }
  // выдохшаяся тема
  const fm = (faded || []).map((id) => modules.find((m) => m.id === id)).find((m) => m && textLessons(m).length);
  if (fm) push(fm, pickOne(textLessons(fm), r), "fresh");
  // повтор пройденного
  const passed = modules.flatMap((m) => textLessons(m).filter((l) => isDone(l, completed, quizDone)).map((l) => ({ m, l })));
  const p = pickOne(passed.filter((x) => !seen.has(x.l.id)), r);
  if (p) push(p.m, p.l, "repeat");
  // мало — добираем уроками начала трека
  for (const m of modules) { if (out.length >= 3) break; for (const l of textLessons(m)) { if (out.length >= 3) break; push(m, l, "repeat"); } }
  return out.slice(0, 3);
}

// Выпуск засчитан (раз в день на выпуск) — журнал дня получает шаг «радио»
export function radioCounted(uk, id, day, storage) {
  try { const s = storage || localStorage; const m = JSON.parse(s.getItem(DONE_KEY + (uk || "")) || "{}") || {}; return m[id] === day; } catch (e) { return false; }
}
export function markRadio(uk, id, day, storage) {
  try {
    const s = storage || localStorage;
    const m = JSON.parse(s.getItem(DONE_KEY + (uk || "")) || "{}") || {};
    const keep = {}; Object.keys(m).filter((k) => m[k] >= day.slice(0, 8) + "01" || m[k] === day).slice(-60).forEach((k) => { keep[k] = m[k]; });
    keep[id] = day; s.setItem(DONE_KEY + (uk || ""), JSON.stringify(keep));
  } catch (e) {}
}

// Голоса: ведущий, гость и сотрудник звучат по-разному (разные голоса, если их несколько, иначе — тон)
export function voiceFor(who, voices) {
  const ru = (voices || []).filter((v) => /^ru/i.test(v.lang || ""));
  const base = { rate: 1, pitch: 1, voice: ru[0] || null };
  if (who === "guest") return { ...base, voice: ru[1] || ru[0] || null, pitch: ru[1] ? 1 : 1.18, rate: 0.98 };
  if (who === "staff") return { ...base, voice: ru[2] || ru[0] || null, pitch: ru[2] ? 1 : 0.86, rate: 1.03 };
  return base;
}
