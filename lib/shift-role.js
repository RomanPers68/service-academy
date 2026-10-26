// lib/shift-role.js — v87 (Доп. 400): «Смена» под роль. Под сменой дня — карточка о том, что важно именно тебе:
//   руководителю — отправлен ли брифинг и как зал; хостес — зал сейчас (свободно, гости, счёт, уборка, брони) и
//   ближайшая бронь; официанту — его столы (сколько гостей, сколько сидят, у кого счёт).
// Данные — та же доска рассадки (seat_board, этап 35), что «Смена» уже спрашивает раз в минуту (v86), и брифинг дня.
import { summary, reservations, isBusy, guestsWord, minutesSince } from "./seating";

const tablesOf = (plan) => (plan && Array.isArray(plan.tables) ? plan.tables : []);

/** Роль для карточки: lead — руководитель и старший, host — хостес, staff — остальные. */
export function shiftRoleOf(profile) {
  if (!profile) return "staff";
  if (profile.is_admin || ["manager", "senior"].includes(profile.position)) return "lead";
  if (["hostess", "host"].includes(profile.position)) return "host";
  return "staff";
}

/** Сводка зала по доске: { total, free, seat, bill, clean, res, guests }; схемы нет или в ней нет столов — null. */
export function hallOf(board) {
  if (!board || board.ok !== true || !board.plan) return null;
  const s = summary(board.plan, board.tables || []);
  return s.total ? { ...s, bill: s.bill || 0 } : null;
}
/** «Свободно 4 из 12» */
export const hallHead = (h) => (h ? "Свободно " + (h.free || 0) + " из " + h.total : "");
/** Состояния столов для полосы и подписи — только те, что есть; порядок как в легенде рассадки. */
export const HALL_PARTS = [["seat", "Гости"], ["bill", "Счёт"], ["clean", "Уборка"], ["res", "Бронь"], ["free", "Свободно"]];
export function hallParts(h) {
  return h ? HALL_PARTS.map(([k, t]) => ({ k, t, n: Number(h[k]) || 0 })).filter((p) => p.n > 0) : [];
}
/** Строка для руководителя: «Зал: свободно 4 из 12 · 18 гостей · счёт: 2». */
export function hallLine(h) {
  if (!h) return "";
  return ["Зал: свободно " + (h.free || 0) + " из " + h.total, h.guests ? guestsWord(h.guests) : "", h.bill ? "счёт: " + h.bill : ""].filter(Boolean).join(" · ");
}

const hm = (d) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
/** Ближайшая бронь: время не раньше, чем 15 минут назад (гости могут чуть опоздать); без времени — после всех. */
export function nextRes(board, now = new Date()) {
  if (!board || board.ok !== true || !board.plan) return null;
  const list = reservations(board.plan, board.tables || []);
  const from = hm(new Date(now.getTime() - 15 * 60e3));
  return list.find((r) => r.rtime && r.rtime >= from) || list.find((r) => !r.rtime) || null;
}
/** «19:30 · Иванов · 4 гостя · стол 7» */
export const resLine = (r) => (r ? [r.rtime, r.name || "Без имени", r.cnt ? guestsWord(r.cnt) : "", "стол " + r.n].filter(Boolean).join(" · ") : "");

/** Столы официанта: [{ tid, n, status, cnt, min }] по номеру; кому не посадили — пусто. */
export function myTablesList(board, empId) {
  if (!board || board.ok !== true || !board.plan || empId == null || empId === "") return [];
  const byId = Object.fromEntries(tablesOf(board.plan).map((t) => [t.id, t]));
  const me = String(empId);
  return (board.tables || []).filter((r) => isBusy(r) && String(r.waiter_id || "") === me && byId[r.tid])
    .map((r) => ({ tid: r.tid, n: String(byId[r.tid].n), status: r.status, cnt: Number(r.cnt) || 0, min: minutesSince(r.since, board.now) }))
    .sort((a, b) => a.n.localeCompare(b.n, "ru", { numeric: true }));
}
/** Подпись стола: «3 гостя · 25 мин», со счётом — «счёт · 1 ч 05 мин». */
export function tableChip(t) {
  const time = t.min < 60 ? t.min + " мин" : Math.floor(t.min / 60) + " ч " + String(t.min % 60).padStart(2, "0") + " мин";
  return [t.status === "bill" ? "счёт" : t.cnt ? guestsWord(t.cnt) : "", time].filter(Boolean).join(" · ");
}

/** Что показать: null — карточки нет. brief: "none" — руководителю напомнить собрать брифинг (только в день смены). */
export function roleCard({ role, board, empId, briefKnown = false, briefSent = false, dayOff = false, now = new Date() }) {
  const hall = hallOf(board);
  if (role === "lead") {
    const brief = briefKnown && !briefSent && !dayOff ? "none" : "";
    return brief || hall ? { role, brief, hall } : null;
  }
  if (role === "host") return hall ? { role, hall, res: nextRes(board, now) } : null;
  const mine = myTablesList(board, empId);
  return mine.length ? { role: "staff", mine } : null;
}
