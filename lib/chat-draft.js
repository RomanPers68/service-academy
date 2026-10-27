// lib/chat-draft.js — v99 (Доп. 412): черновик в чате не пропадает. Начал писать и вышел из переписки, свернул
// Telegram или приложение перезапустилось — текст (и на что отвечал) ждёт в строке ввода, а в списке чатов —
// «Черновик: …», как в Telegram. Хранится на этом телефоне, отдельно для каждого человека и чата, неделю.
// Все обращения к хранилищу — в try: в приватном окне и при очищенных данных его может не быть.

export const DRAFT_DAYS = 7;
const PFX = "sa_chat_draft:";
const key = (me, chat) => PFX + String(me) + ":" + String(chat);
const store = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (e) { return null; } };

/** Черновик: { t — текст, r — на какое сообщение ответ (id) } или null (нет, пустой, старше недели). */
export function draftGet(me, chat, now = Date.now(), ls = store()) {
  if (me == null || chat == null || !ls) return null;
  try {
    const d = JSON.parse(ls.getItem(key(me, chat)) || "null");
    if (!d || typeof d !== "object") return null;
    if (!(Number(d.at) > now - DRAFT_DAYS * 86400000)) { ls.removeItem(key(me, chat)); return null; }
    const t = typeof d.t === "string" ? d.t : "";
    if (!t.trim() && d.r == null) return null;
    return { t, r: d.r == null ? null : d.r };
  } catch (e) { return null; }
}

/** Записать: пустой текст без ответа — стереть. Не больше 1200 знаков. */
export function draftSet(me, chat, text, reply = null, now = Date.now(), ls = store()) {
  if (me == null || chat == null || !ls) return;
  try {
    const t = String(text || "").slice(0, 1200);
    if (!t.trim() && reply == null) { ls.removeItem(key(me, chat)); return; }
    ls.setItem(key(me, chat), JSON.stringify({ t, r: reply == null ? null : reply, at: now }));
  } catch (e) { /* */ }
}

export function draftClear(me, chat, ls = store()) {
  if (me == null || chat == null || !ls) return;
  try { ls.removeItem(key(me, chat)); } catch (e) { /* */ }
}

/** Для списка чатов: «Черновик: …» — текст в одну строку (пусто — не показывать). */
export function draftLine(me, chat, now = Date.now(), ls = store()) {
  const d = draftGet(me, chat, now, ls);
  return d ? String(d.t).replace(/\s+/g, " ").trim() : "";
}
