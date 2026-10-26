// lib/chat-api.js — v90 (Доп. 403): чат смены — вызовы сервера (этап 38, chat_*) в том виде, какой ждёт ui/chat.jsx.
// Нет этапа 38 на сервере — { ok: false, error: "missing" }; нет связи — { ok: false, error: "net" }. Фото приходят
// base64 и отдаются экрану готовой ссылкой data:image/jpeg.
import { rpc, saToken, rpcMissing, SUPABASE_URL, SUPABASE_KEY } from "../api/supabase";

/** Распознавание речи для микрофона в строке ввода (функция stt, как в «Случаях»). */
export const chatStt = () => ({ url: SUPABASE_URL + "/functions/v1/stt", headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } });

const ask = (fn, args) => Promise.resolve()
  .then(() => rpc(fn, { p_token: saToken(), ...args }))
  .then((r) => (rpcMissing(r) ? { ok: false, error: "missing" } : r && typeof r === "object" ? r : { ok: false, error: "empty" }))
  .catch(() => ({ ok: false, error: "net" }));

export function chatApi(call = ask) {
  return {
    list: () => call("chat_list", {}),
    unread: () => call("chat_unread", {}),
    open: (chat, { after = 0, before = 0, since = null } = {}) => call("chat_open", { p_chat: chat, p_after: after || 0, p_before: before || 0, p_since: since || null }),
    read: (chat, last) => call("chat_read", { p_chat: chat, p_last: last }),
    send: (chat, body, reply = null) => call("chat_send", { p_chat: chat, p_body: body, p_reply: reply || null }),
    dm: (emp) => call("chat_dm", { p_emp: String(emp) }),
    people: () => call("chat_people", {}),
    call: ({ who, emp, why, table, text }) => call("chat_call", { p_who: who, p_emp: emp ? String(emp) : null, p_why: why, p_table: table || null, p_text: text || null }),
    go: (msg) => call("chat_go", { p_msg: msg }),
    del: (msg) => call("chat_delete", { p_msg: msg }),
    edit: (msg, body) => call("chat_edit", { p_msg: msg, p_body: body }),
    react: (msg, r) => call("chat_react", { p_msg: msg, p_r: r || null }),
    pin: (chat, msg) => call("chat_pin", { p_chat: chat, p_msg: msg || null }),
    photoSend: (chat, { full, thumb, w, h, body = "", reply = null }) => call("chat_photo_send", { p_chat: chat, p_full: full, p_thumb: thumb, p_w: w, p_h: h, p_body: body || "", p_reply: reply || null }),
    photo: (id, full) => call("chat_photo", { p_id: id, p_full: !!full }).then((r) => (r && r.ok && r.data ? { ok: true, url: "data:" + (r.mime || "image/jpeg") + ";base64," + r.data, w: r.w, h: r.h } : r)),
  };
}
