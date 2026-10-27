// lib/chat-api.js — v90 (Доп. 403): чат смены — вызовы сервера (этап 38, chat_*) в том виде, какой ждёт ui/chat.jsx.
// v93 (Доп. 406): умный чат — смены, карточки, опрос, задание, стоп-лист и Наставник. Наставнику отвечает ИИ приложения
// (opts.ai(вопрос) → { text, cards }, App.jsx): сервер сначала проверяет вопрос и лимит дня, потом сохраняет ответ.
// Нет этапа 38 на сервере — { ok: false, error: "missing" }; нет связи — { ok: false, error: "net" }. Фото приходят
// base64 и отдаются экрану готовой ссылкой data:image/jpeg.
import { rpc, saToken, rpcMissing, SUPABASE_URL, SUPABASE_KEY } from "../api/supabase";

/** Распознавание речи для микрофона в строке ввода (функция stt, как в «Случаях»). */
export const chatStt = () => ({ url: SUPABASE_URL + "/functions/v1/stt", headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } });

const ask = (fn, args) => Promise.resolve()
  .then(() => rpc(fn, { p_token: saToken(), ...args }))
  .then((r) => (rpcMissing(r) ? { ok: false, error: "missing" } : r && typeof r === "object" ? r : { ok: false, error: "empty" }))
  .catch(() => ({ ok: false, error: "net" }));

export function chatApi(call = ask, { ai = null } = {}) {
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
    clear: (chat) => call("chat_clear", { p_chat: chat }),   // v91 (Доп. 404): очистить чат целиком у всех
    // v92 (Доп. 405): свои чаты — завести (название и коллеги), поправить (название, добавить, убрать), выйти, удалить
    groupCreate: (title, emps) => call("chat_group_create", { p_title: title, p_emps: (emps || []).map(String) }),
    groupEdit: (chat, { title = null, add = null, remove = null } = {}) => call("chat_group_edit", { p_chat: chat, p_title: title, p_add: add ? add.map(String) : null, p_remove: remove ? remove.map(String) : null }),
    groupLeave: (chat) => call("chat_group_leave", { p_chat: chat }),
    groupDelete: (chat) => call("chat_group_delete", { p_chat: chat }),
    photoSend: (chat, { full, thumb, w, h, body = "", reply = null }) => call("chat_photo_send", { p_chat: chat, p_full: full, p_thumb: thumb, p_w: w, p_h: h, p_body: body || "", p_reply: reply || null }),
    photo: (id, full) => call("chat_photo", { p_id: id, p_full: !!full }).then((r) => (r && r.ok && r.data ? { ok: true, url: "data:" + (r.mime || "image/jpeg") + ";base64," + r.data, w: r.w, h: r.h } : r)),
    // v93: смены по графику — мои, предложить (отдать или поменяться), забрать, варианты обмена, поменяться, отменить
    shiftsMine: () => call("chat_shift_mine", {}),
    shiftOffer: (chat, { date, mode, want = [], note = "" } = {}) => call("chat_shift_offer", { p_chat: chat, p_date: date, p_mode: mode, p_want: (want || []).map(String), p_note: note || "" }),
    shiftTake: (msg) => call("chat_shift_take", { p_msg: msg }),
    shiftSwapOptions: (msg) => call("chat_shift_options", { p_msg: msg }),
    shiftSwap: (msg, date) => call("chat_shift_swap", { p_msg: msg, p_date: date }),
    shiftCancel: (msg) => call("chat_shift_cancel", { p_msg: msg }),
    // задание, «поделиться», опрос, брифинг — одной функцией; голос; напомнить; стоп-лист (до «Вернуть в меню»)
    cardSend: (chat, card) => call("chat_card_send", { p_chat: chat, p_card: card }),
    pollVote: (msg, i) => call("chat_poll_vote", { p_msg: msg, p_o: i }),
    taskRemind: (msg) => call("chat_task_remind", { p_msg: msg }),
    stopSet: (chat, dish, on, _until = null, msg = null) => call("chat_stop_set", { p_chat: chat, p_dish: dish && dish.id != null ? String(dish.id) : null, p_on: !!on, p_msg: msg || null }),
    // v97 (Доп. 410): чат и приложение — «Ищем в смену» из графика (chat null — «Вся команда»; instead — строка графика того,
    // кто не сможет выйти), предложения смен для «Графика», карточка коллеги, стоп-лист из Меню карточкой в чат
    shiftNeed: (chat, { date, pos, k, n = 1, note = "", instead = null } = {}) => call("chat_shift_need", { p_chat: chat == null ? null : chat, p_date: date, p_pos: pos, p_k: k, p_n: n, p_note: note || "", p_instead: instead == null ? null : String(instead) }),
    shiftBoard: (month) => call("chat_shift_board", { p_month: month }),
    person: (emp) => call("chat_person", { p_emp: String(emp) }),
    stopNote: (dish, on) => call("chat_stop_note", { p_dish: String(dish), p_on: !!on }),
    // Наставник: проверка (вопрос и лимит) → ИИ приложения → ответ в переписку
    aiAsk: async (chat, reply, question) => {
      const chk = await call("chat_ai_post", { p_chat: chat, p_reply: reply, p_body: null, p_cards: null });
      if (!chk || !chk.ok) return chk || { ok: false, error: "empty" };
      if (!ai) return { ok: false, error: "no_ai" };
      let a = null;
      try { a = await ai(question); } catch (e) { return { ok: false, error: "ai" }; }
      if (!a || !String(a.text || "").trim()) return { ok: false, error: (a && a.error) || "ai" };
      return call("chat_ai_post", { p_chat: chat, p_reply: reply, p_body: String(a.text).slice(0, 2000), p_cards: Array.isArray(a.cards) ? a.cards.slice(0, 3) : [] });
    },
  };
}
