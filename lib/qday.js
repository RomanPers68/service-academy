// lib/qday.js — v81 (Доп. 394): «Вопрос дня» в Telegram — очередь вопросов и ответы из чата.
//
// Сервер содержимого уроков не хранит. Приложение раз в день кладёт ему очередь своих вопросов (qday_push, этап 31):
// сначала ошибки из теста, которые пора повторить, потом вопросы из пройденных тестов своей роли; новичку без
// пройденного — первые вопросы программы. Бот присылает следующий в 12:00 по часам заведения, с кнопками-буквами.
// Ответы приложение забирает (qday_inbox): ошибка из Telegram — в «Работу над ошибками», верный ответ на вопрос из
// банка ошибок двигает его повтор (1 → 3 → 7 → 30 дней), ответ сегодня зажигает свечу.

export const QDAY_MAX = 7;
const LIM = { q: 400, o: 200, e: 500, t: 120 };
const PUSH_KEY = "sa_qday_push";   // + uk: { day, sig } — что и когда отправлено
const SEEN_KEY = "sa_qday_seen";   // + uk: номера ответов, уже учтённых в банке ошибок

/** Ключ вопроса: хэш текста (FNV-1a, 32 бита) — один и тот же на телефоне и в базе. */
export function qdayKey(q) {
  let h = 0x811c9dc5;
  const s = String(q || "").trim();
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return "q" + h.toString(16).padStart(8, "0");
}

/** Годится ли вопрос для чата: текст без картинки, 2–4 варианта, верный — один из них, всё в пределах длины. */
export function qdayFits(x) {
  if (!x || !String(x.q || "").trim() || x.img) return false;
  const o = x.options;
  if (!Array.isArray(o) || o.length < 2 || o.length > 4) return false;
  if (!Number.isInteger(x.correct) || x.correct < 0 || x.correct >= o.length) return false;
  if (String(x.q).trim().length > LIM.q) return false;
  return o.every((s) => typeof s === "string" && s.trim() && s.trim().length <= LIM.o);
}

const toItem = (x, r) => ({
  k: qdayKey(x.q), q: String(x.q).trim(), o: x.options.map((s) => String(s).trim()), c: x.correct,
  e: String(x.explanation || "").trim().slice(0, LIM.e), t: String(x.lessonTitle || "").trim().slice(0, LIM.t), r: String(r || "").slice(0, 40),
});

// один и тот же порядок весь день для одного человека (перемешивание с зерном «день + человек»)
function shuffled(arr, seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Очередь «Вопроса дня» (до семи): ошибки из тестов, которые пора повторить (в ближайшие полтора дня, по сроку, до
 * четырёх), потом вопросы из пройденных тестов своей роли; если пройденного нет — первые вопросы программы роли.
 * Ошибки практики и «у стола» (from) в чат не идут: у них своя проверка в приложении.
 */
export function buildQdayQueue({ mistakeBank = [], programModules = [], quizDone = {}, roleLabel = "", day = "", uk = "", now = Date.now() } = {}) {
  const out = [], seen = new Set();
  const add = (x) => {
    if (out.length >= QDAY_MAX || !qdayFits(x)) return;
    const it = toItem(x, roleLabel);
    if (seen.has(it.k)) return;
    seen.add(it.k); out.push(it);
  };
  const soon = now + 36 * 3600e3;
  (mistakeBank || []).filter((m) => m && !m.from && (Number(m.due) || 0) <= soon)
    .sort((a, b) => (Number(a.due) || 0) - (Number(b.due) || 0)).slice(0, 4).forEach(add);
  const quizzes = (programModules || []).flatMap((m) => ((m && m.lessons) || [])
    .filter((l) => l && l.type === "quiz" && Array.isArray(l.questions))
    .map((l) => ({ done: !!(quizDone || {})[l.id], qs: l.questions.map((q) => ({ ...q, lessonTitle: l.title })) })));
  shuffled(quizzes.filter((x) => x.done).flatMap((x) => x.qs), day + uk).forEach(add);
  if (!out.length) quizzes.slice(0, 2).flatMap((x) => x.qs).forEach(add);
  return out;
}

/** Нужно ли отправлять очередь: новый день или другие вопросы. */
export function qdayNeedsPush(uk, day, items) {
  const sig = (items || []).map((x) => x.k).join(",");
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem(PUSH_KEY + (uk || "")) || "null"); } catch (e) { prev = null; }
  return !(prev && prev.day === day && prev.sig === sig);
}
export function qdayMarkPushed(uk, day, items) {
  try { localStorage.setItem(PUSH_KEY + (uk || ""), JSON.stringify({ day, sig: (items || []).map((x) => x.k).join(",") })); } catch (e) {}
}

/** Ответы из Telegram, которых приложение ещё не учло. */
export function newQdayAnswers(uk, items) {
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY + (uk || "")) || "[]"); } catch (e) { seen = []; }
  const s = new Set(Array.isArray(seen) ? seen : []);
  return (items || []).filter((x) => x && x.id != null && !s.has(x.id) && Number.isInteger(x.answer) && String(x.q || "").trim() && Array.isArray(x.o));
}
export function markQdaySeen(uk, ids) {
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY + (uk || "")) || "[]"); } catch (e) { seen = []; }
  const next = [...new Set([...(Array.isArray(seen) ? seen : []), ...(ids || [])])].slice(-300);
  try { localStorage.setItem(SEEN_KEY + (uk || ""), JSON.stringify(next)); } catch (e) {}
}

/**
 * Банк ошибок после ответов из Telegram. Неверно: вопрос в банке — повтор сначала (сегодня), нет — добавить.
 * Верно: вопрос из банка уходит на следующий интервал (srDays), после последнего — закреплён и убирается.
 */
export function applyQdayToBank(bank, answers, srDays, now = Date.now()) {
  let next = (bank || []).slice();
  for (const a of answers || []) {
    const i = next.findIndex((m) => m && m.q === a.q);
    if (a.correct) {
      if (i < 0) continue;
      const stage = (Number(next[i].stage) || 0) + 1;
      next[i] = stage > srDays.length ? null : { ...next[i], stage, due: now + srDays[stage - 1] * 864e5 };
      next = next.filter(Boolean);
    } else if (i >= 0) {
      next[i] = { ...next[i], stage: 0, due: now };
    } else {
      next.push({ q: a.q, options: a.o, correct: a.c, explanation: a.e || "", img: null, lessonTitle: a.t || "", lessonId: "", stage: 0, due: now, tg: true });
    }
  }
  return next.slice(-200);
}
