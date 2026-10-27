// lib/late.js — v99 (Доп. 412): «Опаздываю» одним нажатием. Выбрал «на 15 минут» (и, если хочешь, причину): в «Вся
// команда» — карточка «Буду в 10:15», руководителю в смене пишет бот с кнопкой «Принято», в «Графике» у этого дня —
// отметка. До начала смены «на 15 минут» считается от начала смены, после — от сейчас (как на сервере, этап 39,
// chat_late). Здесь только расчёт: минуты словами, время прихода, когда предлагать «Опаздываю», вид карточки.

export const LATE_MINS = [5, 10, 15, 20, 30, 45, 60, 90];
export const LATE_NOTE_MAX = 80;
export const LATE_BEFORE_H = 3;   // за сколько часов до начала смены предлагать «Опаздываю»
export const LATE_AFTER_H = 2;    // и сколько часов после начала

const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };
const pad = (n) => String(n).padStart(2, "0");

/** «15 минут», «1 минуту», «час», «полтора часа», «2 часа» (как _sa_late_min на сервере). */
export function lateMinText(n) {
  const m = Math.round(Number(n) || 0);
  if (m === 60) return "час";
  if (m === 90) return "полтора часа";
  if (m > 0 && m % 60 === 0) { const h = m / 60; return h + " " + pl(h, "час", "часа", "часов"); }
  return m + " " + pl(m, "минуту", "минуты", "минут");
}
/** Подпись на кнопке выбора: «15 мин», «1 ч», «1,5 ч». */
export const lateChip = (n) => { const m = Number(n) || 0; return m < 60 ? m + " мин" : m % 60 ? String(m / 60).replace(".", ",") + " ч" : m / 60 + " ч"; };
/** «10:15» из часов графика: 10.25 → «10:15», 24 → «00:00». */
export const hhmmOf = (h) => { const v = ((Number(h) || 0) % 24 + 24) % 24, hh = Math.floor(v), mm = Math.round((v - hh) * 60); return pad(hh) + ":" + pad(mm); };

/**
 * Время прихода: смена сегодня с from (часы, как в графике) — от её начала, если оно ещё не наступило, иначе от сейчас;
 * без смены — от сейчас. now — Date (местное время заведения на телефоне). → «10:15».
 */
export function lateEta(from, min, now = new Date()) {
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = typeof from === "number" && isFinite(from) ? Math.round(from * 60) : null;
  const base = start != null ? Math.max(start, cur) : cur;
  return hhmmOf((base + (Number(min) || 0)) / 60);
}

/**
 * Предлагать ли «Опаздываю» на главной и во вкладке «Смена»: сегодня смена (shift: { off, from } — lib/streak.js
 * myShiftOn) и сейчас от 3 часов до начала до 2 часов после.
 */
export function lateWindow(shift, now = new Date()) {
  if (!shift || shift.off || typeof shift.from !== "number") return false;
  const h = now.getHours() + now.getMinutes() / 60;
  return h >= shift.from - LATE_BEFORE_H && h <= shift.from + LATE_AFTER_H;
}

/**
 * Карточка глазами человека: card — { min, eta, from, label, note, ok: { id, name } }. → { title, sub, note, ok — кто
 * ответил «Принято», act — "ok" (кнопка «Принято» у руководителя) или null, wait — автору: ждём ответа }.
 */
export function lateView(card, me, author) {
  const c = card || {}, mine = me && author != null && String(me.id) === String(author);
  const nm = (s) => { const w = String(s || "").trim().split(/\s+/); return w[1] ? w[0] + " " + w[1][0] + "." : w[0] || ""; };
  const sub = [c.from ? "смена" + (c.label ? " «" + c.label + "»" : "") + " с " + c.from : "", "опоздание на " + lateMinText(c.min)].filter(Boolean).join(" · ");
  const ok = c.ok && c.ok.name ? nm(c.ok.name) : "";
  return { title: "Буду в " + (c.eta || "…"), sub: sub.charAt(0).toUpperCase() + sub.slice(1), note: c.note || "", ok,
    act: !ok && !mine && me && me.lead ? "ok" : null, wait: !ok && mine };
}

/** Коротко для списка чатов и цитаты (как текст карточки на сервере). */
export const lateSummary = (c) => "Опаздываю на " + lateMinText(c && c.min) + ": буду в " + ((c && c.eta) || "…") + (c && c.note ? ". " + c.note : "");
