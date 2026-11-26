// lib/live-check.js — v200 (Доп. 525): живая проверка. Те же правила, что у этапа 63 (ступени должностей, кто кого
// проверяет, процент и «зачтено»), и расчёты для экрана: курсы человека, что пройдено в приложении, последние итоги.
// Без сети и React: это берут и экран (ui/live-check.jsx), и сервер демо в Node.
//
// Владелец (26.11): «официанта проверяет менеджер, управляющий (если менеджер не может). Менеджера проверяет
// управляющий. И так далее по возрастанию».
import { POS_TRACK } from "./position-track.js";

export const LC_PASS = 75;                       // зачтено от 75%
export const LC_TRACKS = ["seasonal", "core", "spg", "bar", "manager", "service_manager"];
/** Отметка за вопрос: 2 — ответил, 1 — частично, 0 — не ответил */
export const LC_MARKS = [{ v: 2, label: "Ответил" }, { v: 1, label: "Частично" }, { v: 0, label: "Не ответил" }];

/** Ступень: линейные 10, старший бармен 20, менеджер 30, «старше менеджера» (управляющий) 35, руководящий состав 50,
 *  владелец 60. ups — id своих должностей, отмеченных «старше» */
export function lcLevel(p, ups = []) {
  if (!p) return 0;
  const pos = String(p.position || "").toLowerCase();
  if (p.is_admin || pos === "owner" || pos === "admin") return 60;
  if (pos === "senior") return 50;
  if (pos === "head") return 35;
  if (pos === "manager" || pos === "service_manager") return p.title && (ups || []).includes(p.title) ? 35 : 30;
  if (pos === "senior_bartender") return 20;
  return 10;
}
/** Линия: ниже менеджера проверяют только свою (старший бармен — барменов) */
export const lcFamily = (pos) => ({ bartender: "bar", senior_bartender: "bar", hostess: "host", waiter: "hall" }[String(pos || "").toLowerCase()] || "other");
/** Сеть: владелец и руководящий состав — проверяют в любом заведении */
export const lcNet = (p) => !!p && (!!p.is_admin || String(p.position || "").toLowerCase() === "senior");

/** Может ли checker проверить target: { id, position, title, is_admin, restaurant, status } у обоих */
export function lcCan(checker, target, ups = []) {
  if (!checker || !target) return false;
  if ((target.status || "active") !== "active" || String(checker.id) === String(target.id)) return false;
  const cl = lcLevel(checker, ups), tl = lcLevel(target, ups);
  if (cl <= tl) return false;
  if (!lcNet(checker) && (checker.restaurant || "") !== (target.restaurant || "")) return false;
  return cl >= 30 || lcFamily(checker.position) === lcFamily(target.position);
}

/** Отметки → процент и «зачтено» (как live_check_save) */
export function lcScore(marks) {
  const m = Array.isArray(marks) ? marks : [];
  if (!m.length || m.some((v) => v !== 0 && v !== 1 && v !== 2)) return null;   // как этап 63: только числа 0, 1, 2
  const score = Math.round((m.reduce((a, v) => a + v, 0) * 100) / (2 * m.length));
  return { score, passed: score >= LC_PASS };
}

/** Курсы человека по должности: официант — «Новичок» и «Ядро», остальные — свой */
export function tracksOf(position) {
  const pos = String(position || "").toLowerCase();
  if (pos === "waiter") return ["seasonal", "core"];
  const t = POS_TRACK[pos];
  return t ? [t] : [];
}

/** Последняя проверка по каждому модулю: { [module]: { m, t, s, p, at, by, … } } */
export function lastByModule(checks) {
  const out = {};
  for (const c of Array.isArray(checks) ? checks : []) {
    const m = c && c.m; if (!m) continue;
    if (!out[m] || String(c.at || "") > String(out[m].at || "")) out[m] = c;
  }
  return out;
}

/** Что пройдено в приложении по модулю: уроки (type lesson) и тест */
export function moduleApp(mod, lessons, quiz) {
  const ls = (mod && mod.lessons || []).filter((l) => l.type === "lesson");
  const L = lessons instanceof Set ? lessons : new Set(lessons || []), Q = quiz instanceof Set ? quiz : new Set(quiz || []);
  const done = ls.filter((l) => L.has(l.id)).length;
  const q = (mod && mod.lessons || []).find((l) => l.type === "quiz");
  const quizDone = !!(q && Q.has(q.id));
  const state = (done === ls.length && ls.length) || quizDone ? "done" : done > 0 ? "part" : "none";
  return { lessons: ls.length, done, quizDone, state };
}

/** Итог по курсу: сколько модулей зачтено и сколько проверяли */
export function trackSummary(mods, last) {
  const ids = (mods || []).map((m) => m.id);
  const checked = ids.filter((id) => last && last[id]);
  return { total: ids.length, checked: checked.length, passed: checked.filter((id) => last[id].p).length };
}

/** Уроки, которые стоит повторить: по вопросам с отметкой 0 или 1, без повторов */
export function lessonsToRepeat(questions, marks) {
  const out = [];
  (questions || []).forEach((q, i) => { const v = Number((marks || [])[i]); if (q && q.l && (v === 0 || v === 1) && !out.includes(q.l)) out.push(q.l); });
  return out;
}

/** Дата для списка: «26.11» */
export function lcDate(at) {
  const d = at ? new Date(at) : null;
  if (!d || isNaN(d)) return "";
  return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0");
}

/** Ответы сервера → текст для человека */
export function lcErr(code, admin = false) {
  if (code === "stage") return admin ? "Живая проверка заработает после этапа базы 63: подскажет экран «Сервер»." : "Живая проверка появится, когда владелец обновит сервер.";
  if (code === "forbidden") return "Проверяют руководители: менеджер свою команду, управляющий ещё и менеджеров, старший бармен барменов.";
  if (code === "not_found") return "Этого сотрудника уже нет в списке. Обнови экран.";
  if (code === "bad_request") return "Отметь ответ на каждый вопрос.";
  if (code === "auth") return "Вход устарел. Войди заново.";
  return "Нет связи. Попробуй ещё раз.";
}
