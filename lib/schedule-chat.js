// lib/schedule-chat.js — v97 (Доп. 410): смены из чата команды на экране «График» (chat_shift_board, этап 38).
// Сотруднику: свои предложения (ждут, кто заберёт) и что можно забрать, выйти или поменяться; руководителю — открытые
// «Ищем в смену» и «Ищем замену». Здесь только расчёт строк: экран — ui/schedule.jsx, карточки — ui/chat-cards.jsx.
import { posAcc } from "./chat-smart";

// «Вера Смирнова» → «Вера С.» (как в карточках чата)
const nm = (s) => { const p = String(s || "").trim().split(/\s+/).filter(Boolean); return p.length > 1 ? p[0] + " " + p[1][0] + "." : p[0] || ""; };

/** День месяца → «2026-11-07». */
export const isoDay = (mkey, d) => mkey + "-" + String(d).padStart(2, "0");
/** «2026-11-07» → 7, если это месяц mkey; иначе 0. */
export const dayOfIso = (mkey, iso) => { const s = String(iso || ""); return s.slice(0, 7) === mkey && /^\d{4}-\d{2}-\d{2}$/.test(s) ? +s.slice(8, 10) : 0; };

function rowOf(o, mkey) {
  const c = o && o.card;
  if (!c || c.st !== "open" || !["give", "swap", "need"].includes(c.mode)) return null;
  const day = dayOfIso(mkey, c.date);
  if (!day || o.msg == null || o.chat == null) return null;
  const n = Math.max(1, Number(c.n) || 1), took = Array.isArray(c.took) ? c.took : [];
  return { msg: o.msg, chat: o.chat, mode: c.mode, day, k: String(c.k || ""), pos: String(c.posKey || ""), who: nm(c.fromName),
    n, took: took.length, left: Math.max(0, n - took.length), instead: c.instead && c.instead.name ? nm(c.instead.name) : "",
    sid: c.mode === "need" ? String((c.instead && c.instead.sid) || "") : String(c.sid || ""), can: !!c.can, mine: !!o.mine };
}

/**
 * Предложения месяца глазами сотрудника: mine — свои (ждут), take — что этот человек может взять, выйти или
 * поменяться (сервер уже проверил: та же должность, свободен в этот день, правила графика). По дням, потом по порядку.
 */
export function boardRows(offers, mkey) {
  const mine = [], take = [];
  (Array.isArray(offers) ? offers : []).forEach((o) => {
    const r = rowOf(o, mkey);
    if (!r) return;
    if (r.mine) { if (r.mode !== "need") mine.push(r); }
    else if (r.can) take.push(r);
  });
  const by = (a, b) => a.day - b.day || Number(a.msg) - Number(b.msg);
  return { mine: mine.sort(by), take: take.sort(by) };
}

/** Открытые «Ищем в смену» и «Ищем замену» месяца (для руководителя), по дням. */
export function boardNeeds(offers, mkey) {
  return (Array.isArray(offers) ? offers : []).map((o) => rowOf(o, mkey)).filter((r) => r && r.mode === "need")
    .sort((a, b) => a.day - b.day || Number(a.msg) - Number(b.msg));
}

/** Кто и что: «Вера С. отдаёт смену», «Вера С. хочет поменяться», «Ищем 2 официантов», «Ищем замену». */
export function boardWho(r) {
  if (!r) return "";
  if (r.mode === "need") return r.instead ? "Ищем замену" : "Ищем " + posAcc(r.pos, r.left || r.n);
  return (r.who || "Коллега") + (r.mode === "swap" ? " хочет поменяться" : " отдаёт смену");
}

/** Своё предложение: «Ты отдаёшь смену», «Ты предлагаешь обмен». */
export const mineWho = (r) => (r && r.mode === "swap" ? "Ты предлагаешь обмен" : "Ты отдаёшь смену");

/** Для руководителя: «выходит 1 из 2», «пока никто» и т. п. */
export function needProgress(r) {
  if (!r) return "";
  if (r.n > 1) return r.took ? "вышли " + r.took + " из " + r.n : "пока никто из " + r.n;
  return r.instead ? "вместо " + r.instead + ", пока никто" : "пока никто";
}

/** Ответ сервера → строка для сотрудника (как в чате). */
export function boardErr(r) {
  const e = r && r.error;
  if (r && r.why) return r.why;
  if (e === "taken") return "Смену уже забрали";
  if (e === "not_allowed") return "Эту смену тебе взять нельзя";
  if (e === "no_schedule") return "Графика в приложении нет";
  if (e === "already") return "На этот день предложение уже есть";
  if (e === "forbidden") return "Искать в чате может руководитель";
  if (e === "too_fast") return "Слишком часто. Подожди пару секунд";
  if (e === "net") return "Нет связи";
  return "Не получилось. Попробуй ещё раз";
}
