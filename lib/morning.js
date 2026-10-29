// lib/morning.js — v106 (Доп. 419): «Утро руководителя». Каждое утро бот присылает руководителю сводку заведения на
// сегодня; в приложении та же сводка — экран «Утро» (ui/morning.jsx). Сводку собирает сервер (этап 40, morning_brief);
// здесь — разбор ответа для экрана, текст сообщения бота (тот же, что у сервера в _sa_morning_text: демо показывает его
// как сообщение в Telegram, проверки сверяют с сервером) и кнопки под ним.
//
// Ответ сервера (brief):
//   day «ГГГГ-ММ-ДД» (сегодня по часам заведения), rest, sched (график есть),
//   shifts [{ k, name, from, to, people: [{ id, n «Анна С.», late: { min, eta } | null }] }] — кто сегодня в смене,
//   count — сколько человек, holes [{ day, pos, miss }] — где не хватает людей сегодня и шесть дней вперёд,
//   open [{ id, chat, mode give | swap | need, day, who, pos, n }] — карточки смен в чате, которые ещё ищут человека,
//   stop { n, names } — стоп-лист, thanks { n, people: [{ id, n, k }], quote, by } — вчерашние «спасибо» гостей,
//   ybrief { reads, of } — вчерашний брифинг прочитали, learn { done, of } — вчера занимались из тех, кто был в смене,
//   idle { list: [{ id, n, days | null, tg }], more } — давно не занимались (из тех, у кого на неделе смены),
//   brief { done, at } — брифинг на сегодня, late [{ id, n, min, eta }] — опаздывают сегодня.
import { MONTH_GEN, WEEKDAY, WEEKDAY_SHORT } from "./dates.js";

export const MORNING_HOURS = [7, 8, 9, 10, 11, 12];
export const MORNING_HOUR = 9;
export const IDLE_DAYS = 6;   // «давно не занимались» — шесть дней и больше без единого занятия

const str = (v, n = 200) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

export function isoAdd(iso, n) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const dow = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
/** «сб 1» */
export const dShort = (iso) => (isIso(iso) ? WEEKDAY_SHORT[dow(iso)] + " " + Number(iso.slice(8)) : "");
/** «четверг, 30 октября» */
export const dLong = (iso) => (isIso(iso) ? WEEKDAY[dow(iso)] + ", " + Number(iso.slice(8)) + " " + MONTH_GEN[Number(iso.slice(5, 7)) - 1] : "");
/** «10:00», «24:00», «02:30» */
export function hh(v) {
  const x = num(v), h = Math.floor(x), m = Math.round((x - h) * 60);
  return (x === 24 ? "24" : String(h % 24).padStart(2, "0")) + ":" + String(m).padStart(2, "0");
}
export function plural(n, a, b, c) {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c;
}
/** «a», «a и b», «a, b и c» */
export const joinAnd = (xs) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " и " + xs[xs.length - 1]);
/** имя коротко: «Анна С.» (первое слово и буква второго) */
export function nm(s) {
  const w = str(s, 80).split(" ").filter(Boolean);
  return w.length >= 2 ? w[0] + " " + w[1][0] + "." : w[0] || "";
}
/** кого не хватает или ищут: «официанта», «2 официантов» (как _sa_chat_spos_acc на сервере) */
export function posAcc(pos, n = 1) {
  const one = { manager: "менеджера", host: "хостес", call: "оператора колл-центра", bar: "бармена", barback: "барбека", waiter: "официанта", runner: "раннера" };
  const many = { manager: "менеджеров", host: "хостес", call: "операторов колл-центра", bar: "барменов", barback: "барбеков", waiter: "официантов", runner: "раннеров" };
  return n <= 1 ? one[pos] || "человека" : n + " " + (many[pos] || "человек");
}
export const hourLabel = (h) => h + ":00";
export const upFirst = (s) => { const t = String(s || ""); return t.charAt(0).toUpperCase() + t.slice(1); };
export const daysText = (n) => n + " " + plural(n, "день", "дня", "дней");

/** Ответ morning_brief → сводка с нужными полями (старая версия сервера, мусор — пустые места, а не падение). */
export function morningModel(raw) {
  const r = obj(raw) || {};
  const day = isIso(r.day) ? r.day : "";
  const person = (p) => { const o = obj(p) || {}; return { id: o.id == null ? null : String(o.id), n: str(o.n, 60) }; };
  const late1 = (x) => { const o = obj(x); return o && num(o.min) > 0 ? { min: Math.round(num(o.min)), eta: str(o.eta, 5) } : null; };
  const shifts = arr(r.shifts).map((g) => obj(g)).filter(Boolean).map((g) => ({ k: str(g.k, 4), name: str(g.name, 30), from: num(g.from), to: num(g.to),
    people: arr(g.people).map((p) => ({ ...person(p), late: late1(obj(p) && obj(p).late) })).filter((p) => p.n) })).filter((g) => g.people.length);
  const holes = arr(r.holes).map((h) => obj(h)).filter((h) => h && isIso(h.day) && num(h.miss) > 0).map((h) => ({ day: h.day, pos: str(h.pos, 20), miss: Math.round(num(h.miss)) }));
  const open = arr(r.open).map((c) => obj(c)).filter((c) => c && ["give", "swap", "need"].includes(c.mode) && isIso(c.day))
    .map((c) => ({ id: num(c.id) || null, chat: num(c.chat) || null, mode: c.mode, day: c.day, who: str(c.who, 60), pos: str(c.pos, 20), n: Math.max(1, Math.round(num(c.n)) || 1) }));
  const st = obj(r.stop) || {};
  const names = arr(st.names).map((x) => str(x, 80)).filter(Boolean);
  const th = obj(r.thanks);
  const thanks = th && num(th.n) > 0 ? { n: Math.round(num(th.n)), people: arr(th.people).map((p) => ({ ...person(p), k: Math.max(1, Math.round(num(obj(p) && obj(p).k)) || 1) })).filter((p) => p.n),
    quote: str(th.quote, 160), by: str(th.by, 60) } : null;
  const yb = obj(r.ybrief), ln = obj(r.learn), id = obj(r.idle) || {}, br = obj(r.brief) || {};
  return {
    ok: r.ok !== false, day, rest: str(r.rest, 80), sched: !!r.sched, shifts, count: Math.round(num(r.count)) || shifts.reduce((s, g) => s + g.people.length, 0),
    holes, open, stop: { n: Math.max(Math.round(num(st.n)), names.length), names },
    thanks, ybrief: yb && num(yb.reads) > 0 ? { reads: Math.round(num(yb.reads)), of: Math.round(num(yb.of)) } : null,
    learn: ln && num(ln.of) > 0 ? { done: Math.round(num(ln.done)), of: Math.round(num(ln.of)) } : null,
    idle: { list: arr(id.list).map((x) => obj(x)).filter(Boolean).map((x) => ({ ...person(x), days: x.days == null ? null : Math.round(num(x.days)), tg: !!x.tg })).filter((x) => x.n),
      more: Math.max(0, Math.round(num(id.more))) },
    brief: { done: !!br.done, at: str(br.at, 5) },
    late: arr(r.late).map((x) => obj(x)).filter((x) => x && num(x.min) > 0).map((x) => ({ ...person(x), min: Math.round(num(x.min)), eta: str(x.eta, 5) })).filter((x) => x.n),
  };
}

/** где не хватает людей в день iso: «2 официантов и бармена» (пусто — хватает) */
export const holesText = (b, iso) => joinAnd(b.holes.filter((h) => h.day === iso).map((h) => posAcc(h.pos, h.miss)));
/** дни недели (после сегодня), где не хватает людей, по порядку */
export const weekHoleDays = (b) => [...new Set(b.holes.filter((h) => h.day > b.day).map((h) => h.day))].sort();
/** строки «Отдают смену: …», «Ищут обмен: …», «Ищем в смену: …» */
export function openLines(b) {
  const by = (m) => b.open.filter((c) => c.mode === m).sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0));
  const out = [];
  const give = by("give"), swap = by("swap"), need = by("need");
  if (give.length) out.push("Отдают смену: " + give.map((c) => c.who + " (" + dShort(c.day) + ")").join(", "));
  if (swap.length) out.push("Ищут обмен: " + swap.map((c) => c.who + " (" + dShort(c.day) + ")").join(", "));
  if (need.length) out.push("Ищем в смену: " + need.map((c) => posAcc(c.pos, c.n) + " на " + dShort(c.day)).join("; "));
  return out;
}
/** «Анна С. (2), Пётр О.» */
export const thanksPeople = (t) => t.people.map((p) => p.n + (p.k > 1 ? " (" + p.k + ")" : "")).join(", ");
/** «Пётр О. (9 дней), Дарья Л. (ещё ни разу)» и «и ещё 2» */
export const idleText = (id) => id.list.map((x) => x.n + " (" + (x.days == null ? "ещё ни разу" : daysText(x.days)) + ")").join(", ") + (id.more ? " и ещё " + id.more : "");
/** сколько дел ждёт руководителя: дыры сегодня и на неделе (по дням), заявки, несобранный брифинг */
export function attnCount(b) {
  const days = new Set(b.holes.map((h) => h.day));
  return days.size + b.open.length + (b.brief.done ? 0 : 1);
}

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Текст сообщения бота (Telegram, parse_mode HTML) — как у сервера (_sa_morning_text, этап 40). name — имя руководителя. */
export function morningText(raw, name = "") {
  const b = raw && raw.holes && raw.idle ? raw : morningModel(raw);
  const first = str(name, 60).split(" ")[0];
  const L = ["<b>Доброе утро" + (first ? ", " + esc(first) : "") + "</b>", upFirst(dLong(b.day)) + (b.rest ? " · " + esc(b.rest) : "")];
  if (b.sched) {
    L.push("", b.count ? "<b>Сегодня в смене " + b.count + "</b>" : "<b>Сегодня по графику смен нет</b>");
    for (const g of b.shifts) L.push(esc(g.name) + " " + hh(g.from) + "–" + hh(g.to) + ": " + esc(g.people.map((p) => p.n).join(", ")));
    const today = holesText(b, b.day);
    if (today) L.push("Не хватает: " + today);
    if (b.late.length) L.push((b.late.length === 1 ? "Опаздывает: " : "Опаздывают: ") + esc(b.late.map((x) => x.n + ", будет в " + x.eta).join("; ")));
    const week = weekHoleDays(b).map((d) => dShort(d) + ": не хватает " + holesText(b, d)).concat(openLines(b).map(esc));
    if (week.length) L.push("", "<b>На неделе</b>", ...week);
    else L.push("На неделе людей хватает");
  }
  if (b.stop.n) L.push("", "<b>Стоп-лист: " + b.stop.n + "</b>", esc(b.stop.names.slice(0, 6).join(", ")) + (b.stop.n > Math.min(6, b.stop.names.length) ? " и ещё " + (b.stop.n - Math.min(6, b.stop.names.length)) : ""));
  const y = [];
  if (b.thanks) {
    y.push(b.thanks.n === 1 ? "Гость сказал спасибо: " + esc(thanksPeople(b.thanks)) : "Гости сказали спасибо " + b.thanks.n + " " + plural(b.thanks.n, "раз", "раза", "раз") + ": " + esc(thanksPeople(b.thanks)));
    if (b.thanks.quote) y.push("«" + esc(b.thanks.quote) + "»");
  }
  if (b.ybrief) y.push("Брифинг прочитали " + b.ybrief.reads + (b.ybrief.of ? " из " + b.ybrief.of : ""));
  if (b.learn) y.push("Занимались " + b.learn.done + " из " + b.learn.of + ", кто был в смене");
  if (y.length) L.push("", "<b>Вчера</b>", ...y);
  if (b.idle.list.length) L.push("", "<b>Давно не занимались</b>", esc(idleText(b.idle)));
  if (!b.brief.done) L.push("", "Брифинг на сегодня ещё не собран");
  return L.join("\n");
}
/** Кнопки под сообщением: [[{ text, go }]] — «Открыть утро»; «Собрать брифинг», если не собран; «График», если где-то не хватает людей. */
export function morningKb(raw) {
  const b = raw && raw.holes && raw.idle ? raw : morningModel(raw);
  const row2 = [];
  if (!b.brief.done) row2.push({ text: "Собрать брифинг", go: "briefing" });
  if (b.holes.length || b.open.length) row2.push({ text: "График", go: "schedule" });
  return row2.length ? [[{ text: "Открыть утро", go: "morning" }], row2] : [[{ text: "Открыть утро", go: "morning" }]];
}
