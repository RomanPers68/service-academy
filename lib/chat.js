// lib/chat.js — v90 (Доп. 403): чат смены. Здесь только расчёт (без сети и React): подписи, время, группировка
// сообщений, вызовы «Позвать» и их текст, прочтения. Экран — ui/chat.jsx, сервер — этап 38 (chat_*).
//
// Чаты заведения: «Вся команда» (все сотрудники заведения), «Старшие» (руководители и старшие) и личные — с любым
// коллегой своего заведения; «Руководители сети» — руководители всех заведений сразу. Сообщение — текст до 1000 знаков или фото с подписью, можно ответить с цитатой, своё —
// поправить в течение суток, на любое — поставить реакцию; в группе одно сообщение можно закрепить. Вызов — карточка
// «Ольга зовёт хостес: к столу 5» с кнопкой «Иду» у тех, кого зовут. Переписка хранится 30 дней.

export const CHAT_MAX = 1000;
export const CHAT_KEEP_DAYS = 30;
export const CALL_OWN_MAX = 80;
export const CALL_TTL_MIN = 10;      // вызов без ответа «гаснет» через 10 минут
export const POLL_OPEN_MS = 4000;    // открытая переписка спрашивает новое раз в 4 секунды
export const POLL_HOT_MS = 1500;     // 20 секунд после своего сообщения или вызова — раз в полторы (ответ виден сразу)
export const POLL_APP_MS = 20000;    // остальное приложение — раз в 20 секунд (непрочитанные и вызовы)
export const EDIT_HOURS = 24;        // своё сообщение можно поправить в течение суток
export const QUOTE_MAX = 120;        // цитата в ответе и в закрепе — до 120 знаков

/** Реакции: id → подпись. Значки рисуются линией (ui/chat.jsx), без эмодзи: как везде в приложении. */
export const REACTS = [["ok", "Принято"], ["like", "Класс"], ["heart", "Сердце"], ["lol", "Смешно"], ["wow", "Ого"], ["fire", "Огонь"]];
const REACT_IDS = REACTS.map((r) => r[0]);
export const reactName = (r) => (REACTS.find((x) => x[0] === r) || [0, ""])[1];

/** Кого позвать: id → [подпись в кнопке, кого в тексте, должности]. */
export const CALL_WHO = [
  ["lead", "Менеджера", "менеджера", ["manager", "senior", "service_manager", "owner", "admin"]],
  ["host", "Хостес", "хостес", ["hostess"]],
  ["bar", "Бар", "бар", ["bartender", "senior_bartender"]],
  ["waiter", "Официанта", "официанта", ["waiter"]],
];
/** Зачем: id → [подпись, текст]. «К столу» — с номером, «Своими словами» — свой текст. */
export const CALL_WHY = [
  ["table", "К столу", "к столу"],
  ["help", "Нужна помощь", "нужна помощь"],
  ["come", "Подойди", "подойди ко мне"],
  ["guest", "Гость ждёт", "гость ждёт"],
  ["own", "Своими словами", ""],
];
const WHO = Object.fromEntries(CALL_WHO.map((w) => [w[0], w]));
const WHY = Object.fromEntries(CALL_WHY.map((w) => [w[0], w]));

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const pad = (n) => String(n).padStart(2, "0");
const clip = (s, n) => { const t = String(s || ""); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const toDate = (x) => (x instanceof Date ? x : new Date(x || 0));
const valid = (d) => !Number.isNaN(d.getTime());

/** «Анна Смирнова» → «АС»; одно слово — одна буква. */
export const chatInitials = (name) => {
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  return w.length ? (w[0][0] + (w[1] ? w[1][0] : "")).toUpperCase() : "?";
};
/** Подпись в пузыре группы: «Мария Ким» → «Мария К.». */
export const bubbleName = (name) => {
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  return w.length ? w[0] + (w[1] ? " " + w[1][0].toUpperCase() + "." : "") : "";
};
export const hhmm = (iso) => { const d = toDate(iso); return valid(d) ? pad(d.getHours()) + ":" + pad(d.getMinutes()) : ""; };
const dayKey = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
/** Разделитель дней в переписке: «Сегодня», «Вчера», «24 октября». */
export function dayLabel(iso, now = new Date()) {
  const d = toDate(iso);
  if (!valid(d)) return "";
  const t = toDate(now), y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
  if (dayKey(d) === dayKey(t)) return "Сегодня";
  if (dayKey(d) === dayKey(y)) return "Вчера";
  return d.getDate() + " " + MONTHS[d.getMonth()] + (d.getFullYear() !== t.getFullYear() ? " " + d.getFullYear() : "");
}
/** Время в списке чатов: сегодня — «19:42», вчера — «вчера», раньше — «24.10». */
export function listTime(iso, now = new Date()) {
  const d = toDate(iso);
  if (!valid(d)) return "";
  const l = dayLabel(d, now);
  return l === "Сегодня" ? hhmm(d) : l === "Вчера" ? "вчера" : pad(d.getDate()) + "." + pad(d.getMonth() + 1);
}

/** Текст вызова: «к столу 5», «нужна помощь», своё. */
export function callWhyText(call) {
  const c = call || {};
  if (c.why === "own") return String(c.text || "").trim();
  const w = WHY[c.why];
  if (!w) return "";
  return c.why === "table" ? w[2] + (c.table ? " " + String(c.table).trim() : "") : w[2];
}
/**
 * Имя в винительном падеже — кого зовут: Анна → Анну, Мария → Марию, Илья → Илью, Роман → Романа, Пётр → Петра,
 * Андрей → Андрея, Игорь → Игоря; несклоняемые (на о, е, и, у, ю) — как есть. Как _sa_chat_acc на сервере (этап 38).
 */
const ACC_SPECIAL = { "пётр": "Петра", "петр": "Петра", "павел": "Павла", "лев": "Льва", "любовь": "Любовь", "нинель": "Нинель", "мишель": "Мишель", "рашель": "Рашель" };
export function accName(name) {
  const n = String(name || "").trim();
  if (!n) return "";
  const l = n.toLowerCase();
  if (ACC_SPECIAL[l]) return ACC_SPECIAL[l];
  if (/ия$/.test(l)) return n.slice(0, -1) + "ю";
  if (/я$/.test(l)) return n.slice(0, -1) + "ю";
  if (/а$/.test(l)) return n.slice(0, -1) + "у";
  if (/й$/.test(l)) return n.slice(0, -1) + "я";
  if (/ь$/.test(l)) return n.slice(0, -1) + "я";
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(l)) return n + "а";
  return n;
}
/** Кого звали: «хостес», «менеджера» или имя (вызов человеку): «Анну». Имя — to_name от сервера или toName из листа. */
export const callWhoText = (call) => (call && call.who === "person" ? accName(String(call.toName || call.to_name || "").trim().split(/\s+/)[0]) || "коллегу" : (WHO[call && call.who] || [0, 0, "коллегу"])[2]);
/** Строка вызова: «Ольга зовёт хостес: к столу 5»; мне — «Ольга зовёт тебя: …». */
export function callLine(msg, meId) {
  const c = (msg && msg.call) || {};
  const forMe = c.who === "person" && meId != null && String(c.emp) === String(meId);
  const who = forMe ? "тебя" : callWhoText(c);
  const why = callWhyText(c);
  return bubbleName(msg && msg.name).split(" ")[0] + " зовёт " + who + (why ? ": " + why : "");
}
/** Зовут ли меня: по должности (кроме меня самого) или лично. */
export function isCallForMe(msg, me) {
  const c = msg && msg.call;
  if (!c || !me || String(msg.emp) === String(me.id)) return false;
  if (c.who === "person") return String(c.emp) === String(me.id);
  const w = WHO[c.who];
  return !!w && w[3].includes(String(me.pos || ""));
}
/** Состояние вызова: идут (кто), ждёт (сколько минут), погас (без ответа больше 10 минут). */
export function callState(msg, now = Date.now()) {
  const c = (msg && msg.call) || {};
  const going = Array.isArray(c.going) ? c.going : [];
  if (going.length) return { st: "going", going };
  const min = Math.max(0, Math.floor((now - toDate(msg && msg.at).getTime()) / 60000));
  return min >= CALL_TTL_MIN ? { st: "stale", min } : { st: "wait", min };
}
/** Проверка вызова перед отправкой: что не так или "". */
export function callProblem(call) {
  const c = call || {};
  if (!(c.who === "person" ? c.emp : WHO[c.who])) return "Выбери, кого позвать";
  if (!WHY[c.why]) return "Выбери, зачем";
  if (c.why === "table" && !/^[0-9A-Za-zА-Яа-яЁё]{1,6}$/.test(String(c.table || "").trim())) return "Укажи номер стола";
  if (c.why === "own" && !String(c.text || "").trim()) return "Напиши, зачем зовёшь";
  if (c.why === "own" && String(c.text).trim().length > CALL_OWN_MAX) return "Короче, до " + CALL_OWN_MAX + " знаков";
  return "";
}

/** Сообщение к отправке: без пробелов по краям, не пустое, не длиннее 1000 знаков (обрезается). */
export const cleanBody = (s) => String(s || "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, CHAT_MAX);

/** Последнее сообщение в списке чатов: «Ты: …», «Мария: …», «Вызов: хостес к столу 5», «Фото», «Сообщение удалено». */
export function previewText(msg, meId, group = true) {
  if (!msg) return "";
  if (msg.del) return "Сообщение удалено";
  const mine = meId != null && String(msg.emp) === String(meId);
  if (msg.kind === "call") return "Вызов: " + callWhoText(msg.call) + (callWhyText(msg.call) ? ", " + callWhyText(msg.call) : "");
  if (msg.kind === "sys") return String(msg.body || "");
  const who = mine ? "Ты: " : group ? bubbleName(msg.name).split(" ")[0] + ": " : "";
  const body = String(msg.body || "").replace(/\s+/g, " ").trim();
  if (msg.kind === "photo") return who + "Фото" + (body ? ": " + body : "");
  return who + body;
}

/**
 * Цитата (в ответе, в закрепе, в листе сообщения): «Фото», «Фото: подпись», строка вызова, «Сообщение удалено» или
 * текст до 120 знаков в одну строку. m — сообщение или цитата от сервера ({ id, emp, name, kind, body, photo, del }).
 */
export function quoteText(m, meId) {
  if (!m) return "";
  if (m.del) return "Сообщение удалено";
  if (m.kind === "call") return clip(m.call ? callLine(m, meId) : String(m.body || "").trim(), QUOTE_MAX);
  const body = clip(String(m.body || "").replace(/\s+/g, " ").trim(), QUOTE_MAX);
  if (m.kind === "photo") return body ? "Фото: " + body : "Фото";
  return body;
}
/** Цитата для ответа из сообщения ленты: то, что сервер отдаёт в reply. */
export const replyOf = (m) => (m ? { id: m.id, emp: m.emp, name: m.name, kind: m.kind || "text", body: String(m.body || ""), photo: m.kind === "photo", del: !!m.del, call: m.call } : null);

/** Можно ли поправить: своё, текст или фото (подпись), не удалено и не старше суток. */
export function canEdit(msg, meId, now = Date.now()) {
  if (!msg || msg.del || meId == null || String(msg.emp) !== String(meId)) return false;
  if (!(msg.kind === "text" || msg.kind === "photo" || !msg.kind)) return false;
  const t = toDate(msg.at).getTime();
  return !Number.isNaN(t) && now - t < EDIT_HOURS * 3600000;
}
/** Закреплять может: в «Старших» и «Руководителях сети» — каждый, в «Вся команда» — руководитель и старший; в личной — нет. */
export const canPin = (chat, me) => !!chat && (chat.kind === "leads" || chat.kind === "net" || ((chat.kind === "team" || chat.kind === "group") && !!(me && me.lead)));
/** Удалить чужое: в группе заведения — руководитель и старший, в «Руководителях сети» — владелец и руководящий состав. */
export const canDelOthers = (chat, me) => !!chat && !!me && (chat.kind === "net" ? !!me.network : (chat.kind === "team" || chat.kind === "leads" || chat.kind === "group") && !!me.lead);
/** v92 (Доп. 405): свой чат заводят руководитель и старший; переименовать, добавить, убрать, удалить — они же из участников. */
export const canGroup = (me) => !!(me && me.lead);
export const canManage = (chat, me) => !!chat && chat.kind === "group" && canGroup(me);
/** Название своего чата: одна строка, до 40 знаков (как на сервере). */
export const GROUP_TITLE_MAX = 40;
export const groupTitle = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, GROUP_TITLE_MAX);
/** v91 (Доп. 404): очистить чат целиком у всех — кто удаляет чужое в группе; личную переписку — любой из двоих. */
export const canClear = (chat, me) => !!chat && !!me && (chat.kind === "dm" || canDelOthers(chat, me));
/** v91: чат очищали после того, как его открыли (метка cleared с сервера сменилась) — переписку перечитать. */
export const clearedChanged = (was, now) => (Date.parse(was || "") || 0) !== (Date.parse(now || "") || 0);
/** Заведение коротко (в «Руководителях сети»): «Два моря, Океан» → «Океан». */
export const restShort = (rest) => { const s = String(rest || "").trim(); const i = s.lastIndexOf(","); return i >= 0 ? s.slice(i + 1).trim() || s : s; };
/** Закрепить можно текст и фото (не вызов, не служебное, не удалённое). */
export const pinnable = (m) => !!m && !m.del && (m.kind === "text" || m.kind === "photo" || !m.kind);

/** Реакции под сообщением: по видам, больше — первыми; mine — есть ли моя; names — кто поставил. */
export function reactGroups(reacts, meId) {
  const g = new Map();
  (reacts || []).forEach((x) => {
    if (!x || !REACT_IDS.includes(x.r)) return;
    const k = g.get(x.r) || { r: x.r, n: 0, mine: false, names: [] };
    k.n += 1; k.names.push(String(x.name || "")); if (meId != null && String(x.emp) === String(meId)) k.mine = true;
    g.set(x.r, k);
  });
  return [...g.values()].sort((a, b) => b.n - a.n || REACT_IDS.indexOf(a.r) - REACT_IDS.indexOf(b.r));
}
/** Моя реакция на сообщение или "". */
export const myReact = (msg, meId) => { const x = ((msg && msg.reacts) || []).find((y) => String(y.emp) === String(meId)); return x ? x.r : ""; };
/** Реакции после моего нажатия (сразу, до ответа сервера): r — новая (null — снять). У человека одна реакция. */
export function withReact(reacts, r, me) {
  const rest = (reacts || []).filter((x) => String(x.emp) !== String(me && me.id));
  return r && REACT_IDS.includes(r) ? [...rest, { r, emp: me && me.id, name: (me && me.name) || "" }] : rest;
}

/** Фото: длинная сторона — не больше max, пропорции те же (сжатие перед отправкой). */
export function fitSize(w, h, max) {
  const W = Math.max(1, Math.round(Number(w) || 1)), H = Math.max(1, Math.round(Number(h) || 1));
  const k = Math.min(1, max / Math.max(W, H));
  return { w: Math.max(1, Math.round(W * k)), h: Math.max(1, Math.round(H * k)) };
}
/** Фото в пузыре: вписано в maxW × maxH, пропорции те же; совсем узкое — не уже 120 (края обрезаются). */
export function photoBox(w, h, maxW = 260, maxH = 320) {
  const W = Number(w) || 0, H = Number(h) || 0;
  if (W <= 0 || H <= 0) return { w: maxW, h: Math.round(maxW * 0.75) };
  const k = Math.min(maxW / W, maxH / H);
  return { w: Math.max(120, Math.round(W * k)), h: Math.max(90, Math.round(H * k)) };
}

/**
 * Лента переписки: разделители дней и пузыри с отметками, как в мессенджере: подряд от одного человека — один
 * «столбик» (same — не первый, cont — не последний, tail — с хвостиком), имя — над первым пузырём (в группе, не у
 * своих). Вызовы и служебные — посередине.
 */
export function feedRows(msgs, meId, group = true, now = new Date()) {
  const out = [];
  let day = "";
  // v93: карточки (смена, задание, опрос…) — посередине, как вызов; ответ Наставника — слева, как от коллеги
  const side = (m) => (!m || m.kind === "call" || m.kind === "sys" || m.kind === "card" ? "mid" : m.kind === "ai" ? "in" : String(m.emp) === String(meId) ? "out" : "in");
  const list = (msgs || []).filter((m) => m && !m.del);   // v91: удалённое исчезает целиком, без «Сообщение удалено»
  list.forEach((m, i) => {
    const d = dayLabel(m.at, now);
    if (d && d !== day) { out.push({ type: "day", key: "d" + d + i, label: d }); day = d; }
    const s = side(m), prev = list[i - 1], next = list[i + 1];
    const sameDay = (a, b) => a && b && dayLabel(a.at, now) === dayLabel(b.at, now);
    const same = !!prev && side(prev) === s && String(prev.emp) === String(m.emp) && sameDay(prev, m) && s !== "mid";
    const cont = !!next && side(next) === s && String(next.emp) === String(m.emp) && sameDay(next, m) && s !== "mid";
    out.push({ type: "msg", key: "m" + m.id, m, side: s, same, cont, showName: group && s === "in" && !same });
  });
  return out;
}

/** Сколько коллег прочитали моё сообщение: у кого последнее прочитанное — не раньше него. reads: { emp: lastId }. */
export function readBy(msg, reads, meId) {
  if (!msg) return [];
  return Object.entries(reads || {}).filter(([emp, last]) => String(emp) !== String(meId) && Number(last) >= Number(msg.id)).map(([emp]) => emp);
}
/** Всего непрочитанных в списке чатов. */
export const unreadTotal = (chats) => (chats || []).reduce((s, c) => s + (Number(c && c.unread) || 0), 0);
/** Подпись непрочитанных на значке: 1…99, дальше «99+». */
export const badge = (n) => (Number(n) > 99 ? "99+" : Number(n) > 0 ? String(Number(n)) : "");

const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
/** «12 человек», «3 человека». */
export const peopleWord = (n) => n + " " + pl(Number(n) || 0, "человек", "человека", "человек");
/** «прочитали 3 из 7» под своим последним сообщением в группе; в личном — «прочитано». */
export function readLine(count, total, group = true) {
  if (!group) return count > 0 ? "прочитано" : "";
  return total > 0 ? "прочитали " + count + " из " + total : "";
}
