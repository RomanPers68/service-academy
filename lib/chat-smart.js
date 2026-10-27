// lib/chat-smart.js — v93 (Доп. 406): умный чат. Сообщение-карточка делает дело в приложении: смена (отдать или
// поменяться), задание (пройти урок или тест), «поделиться» (блюдо, коктейль, справочник, урок), опрос, стоп-лист,
// брифинг; Наставник отвечает прямо в переписке; подсказки по тексту. Здесь — чистый расчёт (подписи, состояние
// карточек, голоса, подсказки), экран — ui/chat-cards.jsx, сервер — этап 38 (chat_card_*, chat_shift_*, chat_ai_post).

const WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const WD_S = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MON_G = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const ymdOf = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/** «суббота, 2 ноября»; сегодня и завтра — словом. */
export function dayLong(iso, now = new Date()) {
  const d = ymdOf(iso);
  if (!d) return "";
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate()), diff = Math.round((d - t) / 86400000);
  const base = d.getDate() + " " + MON_G[d.getMonth()];
  return (diff === 0 ? "сегодня" : diff === 1 ? "завтра" : WD[d.getDay()]) + ", " + base;
}
/** День по частям для плитки карточки: { wd: "сб", d: 2, mon: "ноя" }. */
const MON_S = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const dayParts = (iso) => { const d = ymdOf(iso); return d ? { wd: WD_S[d.getDay()], d: d.getDate(), mon: MON_S[d.getMonth()] } : { wd: "", d: "", mon: "" }; };
/** «сб 2» — коротко, для дней на выбор. */
export const dayShort = (iso) => { const d = ymdOf(iso); return d ? WD_S[d.getDay()] + " " + d.getDate() : ""; };
/** Ближайшие n дней от завтра (для «какие дни взамен»). */
export const nextDays = (n = 14, now = new Date()) => Array.from({ length: n }, (_, i) => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 + i)));

/** Смена в одну строку: «суббота, 2 ноября · вечер 18:00–24:00». */
export const shiftLine = (s, now = new Date()) => (s ? [dayLong(s.date, now), [String(s.label || "").toLowerCase(), s.time].filter(Boolean).join(" ")].filter(Boolean).join(" · ") : "");
const nm = (s) => { const p = String(s || "").trim().split(/\s+/); return p[1] ? p[0] + " " + p[1][0] + "." : p[0] || ""; };

/**
 * Карточка смены глазами человека. card: { mode: "give" | "swap", date, label, time, from, fromName, want: [даты],
 * st: "open" | "done" | "off", by, byName, byDate, byLabel, can, why }. can и why — от сервера: может ли этот человек
 * забрать или поменяться и почему нет (та же должность по графику, свободен в этот день, правила графика).
 */
export function shiftState(card, me) {
  const c = card || {}, meId = me && me.id != null ? String(me.id) : "";
  const mine = String(c.from) === meId, swap = c.mode === "swap";
  const head = swap ? "Меняю смену" : "Отдаю смену";
  if (c.st === "done") {
    return { mine, head, done: true, act: null, line: swap
      ? "Поменялись: " + nm(c.fromName) + " и " + nm(c.byName) + (c.byDate ? " (" + dayShort(c.date) + " и " + dayShort(c.byDate) + ")" : "") + " · график обновлён"
      : nm(c.byName) + " забирает смену · график обновлён" };
  }
  if (c.st === "off") return { mine, head, done: true, act: null, line: "Предложение отменено" };
  if (mine) return { mine, head, done: false, act: "cancel", line: swap ? "Ждём, кто поменяется" : "Ждём, кто заберёт" };
  if (c.can) return { mine, head, done: false, act: swap ? "swap" : "take", line: swap ? "Можешь поменяться на свою смену" : "Можешь забрать: в этот день у тебя нет смены по графику" };
  return { mine, head, done: false, act: null, line: c.why || (swap ? "Поменяться могут коллеги той же должности" : "Забрать могут коллеги той же должности, свободные в этот день") };
}
/** «Взамен: пн 4, ср 6» или «Взамен: любой день». */
export const wantLine = (want) => "Взамен: " + ((want || []).length ? want.map(dayShort).join(", ") : "любой день");
/**
 * Строка для руководителей (в «Старших» и ботом): смена переходит без подтверждения, но руководитель видит каждую
 * передачу и обмен. «Передача смены пт 30, вечер: отдаёт Вера С., забирает Пётр О. · график обновлён».
 */
export function shiftLogLine(c) {
  if (!c || c.st !== "done") return "";
  return c.mode === "swap"
    ? "Обмен сменами: " + nm(c.fromName) + " (" + dayShort(c.date) + ") и " + nm(c.byName) + " (" + dayShort(c.byDate) + ") · график обновлён"
    : "Передача смены " + dayShort(c.date) + (c.label ? ", " + String(c.label).toLowerCase() : "") + ": отдаёт " + nm(c.fromName) + ", забирает " + nm(c.byName) + " · график обновлён";
}

const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
/** Задание: «прошли 3 из 8», срок — «до пятницы, 1 ноября» или пусто. */
export const taskLine = (card) => { const n = Number(card && card.n) || 0, of = Number(card && card.of) || 0; return of ? (n === of ? "прошли все " + of : pl(n, "прошёл", "прошли", "прошли") + " " + n + " из " + of) : ""; };
export const dueLine = (due, now = new Date()) => { if (!due) return ""; const d = ymdOf(due); if (!d) return ""; const l = dayLong(due, now); return "до " + (l.startsWith("сегодня") ? "конца дня" : l.startsWith("завтра") ? "завтра" : WD_ACC[d.getDay()] + ", " + d.getDate() + " " + MON_G[d.getMonth()]); };
const WD_ACC = ["воскресенья", "понедельника", "вторника", "среды", "четверга", "пятницы", "субботы"];
/** Сроки на выбор для задания: сегодня, завтра, до пятницы (ближайшей), через неделю, без срока. */
export function dueChoices(now = new Date()) {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const add = (n) => ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n));
  const fri = (5 - t.getDay() + 7) % 7 || 7;
  return [["today", "Сегодня", add(0)], ["tomorrow", "Завтра", add(1)], ["fri", "До пятницы", add(fri)], ["week", "Неделя", add(7)], ["none", "Без срока", null]];
}

/** Опрос: варианты с голосами, процентами и именами; мой выбор; всего голосов (людей). */
export function pollView(card, meId) {
  const c = card || {}, votes = Array.isArray(c.votes) ? c.votes : [];
  const people = new Set(votes.map((v) => String(v.emp)));
  const opts = (c.opts || []).map((text, i) => {
    const vs = votes.filter((v) => Number(v.o) === i);
    return { i, text, n: vs.length, pct: people.size ? Math.round((vs.length / people.size) * 100) : 0, mine: vs.some((v) => String(v.emp) === String(meId)), names: vs.map((v) => nm(v.name)) };
  });
  return { total: people.size, opts, voted: opts.some((o) => o.mine) };
}
/** Голос: один вариант на человека (повторное нажатие на свой — снять). */
export function withVote(votes, i, me) {
  const id = String(me && me.id), was = (votes || []).find((v) => String(v.emp) === id);
  const rest = (votes || []).filter((v) => String(v.emp) !== id);
  return was && Number(was.o) === i ? rest : [...rest, { o: i, emp: id, name: (me && me.name) || "" }];
}
export const POLL_MAX = 6;
/** Вопрос и варианты: вопрос 3–200 знаков, 2–6 непустых вариантов до 60 знаков, без повторов. */
export function pollProblem(q, opts) {
  const qq = String(q || "").trim(), oo = (opts || []).map((o) => String(o || "").trim()).filter(Boolean);
  if (qq.length < 3) return "Напиши вопрос";
  if (oo.length < 2) return "Нужно хотя бы два варианта";
  if (new Set(oo.map((o) => o.toLowerCase())).size !== oo.length) return "Варианты повторяются";
  if (oo.some((o) => o.length > 60)) return "Вариант длиннее 60 знаков";
  return "";
}

/** Наставник в переписке: «@Наставник …» где угодно или «Наставник, …» в начале. */
export const AI_NAME = "Наставник";
export const askAi = (text) => /(^|[^а-яёa-z0-9_])@наставник([^а-яёa-z0-9_]|$)/i.test(String(text || "")) || /^\s*наставник\s*[,:]/i.test(String(text || ""));
/** Вопрос Наставнику без обращения. */
export const aiQuestion = (text) => String(text || "").replace(/@наставник[,:]?\s*/ig, "").replace(/^\s*наставник\s*[,:]\s*/i, "").trim();
/** Сколько вопросов Наставнику в день на заведение (ответ ИИ стоит денег). */
export const AI_DAY_LIMIT = 30;

/**
 * Подсказки по тексту — без ИИ (бесплатно): «кто может выйти в субботу?» — отдать смену, поменяться, опрос;
 * «тартар закончился» (руководителю) — стоп-лист; вопрос про блюдо или стандарт — Наставник. До трёх, по порядку.
 */
export function intents(text, me, kind = "team") {
  const t = String(text || "").toLowerCase().replace(/ё/g, "е");
  if (t.trim().length < 6 || askAi(t)) return [];
  const out = [];
  const shift = /(смен|выйти|выйдет|выход|подмен|подменит|отработа|отпроси|не смогу)/.test(t);
  if (shift && /(отда|подмен|не смогу|не выйду|отпроси|кто\s+(может|сможет|выйдет|возьм))/.test(t)) out.push("give");
  if (shift && /(помен|обмен|махн)/.test(t)) out.push("swap");
  if (/(кто\s+(может|сможет|выйдет|за|против|будет|придет|идет)|голосу|опрос|как\s+думаете|давайте\s+решим)/.test(t) && kind !== "dm") out.push("poll");
  if (me && me.lead && /(закончил|законч|кончил|нет\s+больше|в\s*стоп|стоп-?лист|убираем\s+из\s+меню)/.test(t)) out.push("stop");
  if (/\?\s*$/.test(t) && /(аллерген|состав|подач|как\s+правильно|стандарт|сколько\s+калор|что\s+посоветовать|сочета|какое\s+вино|коктейл|блюд)/.test(t)) out.push("ai");
  return [...new Set(out)].slice(0, 3);
}
export const INTENT_LABEL = { give: "Отдать смену", swap: "Поменяться сменой", poll: "Сделать опрос", stop: "В стоп-лист", ai: "Спросить Наставника" };

/** Коротко о карточке — для списка чатов, цитаты и бота. */
export function cardSummary(card, now = new Date()) {
  const c = card || {};
  if (c.t === "shift") return (c.mode === "swap" ? "Меняю смену: " : "Отдаю смену: ") + shiftLine(c, now);
  if (c.t === "task") return "Задание: " + ((c.item && c.item.title) || "") + (c.due ? ", " + dueLine(c.due, now) : "");
  if (c.t === "share") return ({ dish: "Блюдо", cocktail: "Коктейль", ref: "Справочник", lesson: "Урок", quiz: "Тест" }[c.item && c.item.kind] || "Карточка") + ": " + ((c.item && c.item.title) || "");
  if (c.t === "poll") return "Опрос: " + (c.q || "");
  if (c.t === "stop") return (c.st === "off" ? "Снова в меню: " : "В стоп-листе: ") + ((c.dish && c.dish.name) || "");
  if (c.t === "brief") return "Брифинг смены" + (c.date ? ", " + dayLong(c.date, now) : "");
  return "";
}

/** Что умеет «+» в строке ввода: кто и где видит плитку. */
export function actTiles(me, chat) {
  const lead = !!(me && me.lead), kind = chat && chat.kind;
  return [
    ["photo", "Фото", true],
    ["give", "Отдать смену", kind !== "net"],
    ["swap", "Поменяться", kind !== "net"],
    ["task", "Задание", lead],
    ["share", "Поделиться", true],
    ["poll", "Опрос", kind !== "dm"],
    ["stop", "Стоп-лист", lead && kind !== "dm" && kind !== "net"],
    ["brief", "Брифинг", lead && kind === "team"],
    ["ai", AI_NAME, true],
  ].filter((x) => x[2]).map(([id, label]) => ({ id, label }));
}
