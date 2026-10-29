// lib/chat-smart.js — v93 (Доп. 406): умный чат. Сообщение-карточка делает дело в приложении: смена (отдать или
// поменяться), задание (пройти урок или тест), «поделиться» (блюдо, коктейль, справочник, урок), опрос, стоп-лист,
// брифинг; Наставник отвечает прямо в переписке; подсказки по тексту. Здесь — чистый расчёт (подписи, состояние
// карточек, голоса, подсказки), экран — ui/chat-cards.jsx, сервер — этап 38 (chat_card_*, chat_shift_*, chat_ai_post).

import { lateSummary } from "./late.js";   // v99 (Доп. 412): «Опаздываю»
import { newbieCardSum } from "./newbie.js";   // v107 (Доп. 420): карточки новичка

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

// v97 (Доп. 410): должность словами — как у сервера (_sa_chat_spos, _sa_chat_spos_acc): «официант», «официанты»,
// кого ищем — «официанта», «2 официантов»
const SPOS = { manager: ["менеджер", "менеджеры", "менеджера", "менеджеров"], host: ["хостес", "хостес", "хостес", "хостес"],
  call: ["колл-центр", "операторы колл-центра", "оператора колл-центра", "операторов колл-центра"], bar: ["бар", "бармены", "бармена", "барменов"],
  barback: ["барбек", "барбеки", "барбека", "барбеков"], waiter: ["официант", "официанты", "официанта", "официантов"], runner: ["раннер", "раннеры", "раннера", "раннеров"] };
export const posWord = (k, many = false) => { const p = SPOS[k]; return p ? p[many ? 1 : 0] : many ? "коллеги той же должности" : ""; };
export const posAcc = (k, n = 1) => { const p = SPOS[k], m = Math.max(1, Number(n) || 1); return m <= 1 ? (p ? p[2] : "человека") : m + " " + (p ? p[3] : "человек"); };
const MON_N = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
/** Месяц словами: «2026-11» → «ноябрь». */
export const monthWord = (mk) => { const m = /^\d{4}-(\d{2})$/.exec(String(mk || "")); return m && +m[1] >= 1 && +m[1] <= 12 ? MON_N[+m[1] - 1] : ""; };

/**
 * Карточка смены глазами человека. card: { mode: "give" | "swap" | "need", date, label, time, from, fromName,
 * want: [даты], st: "open" | "done" | "off", by, byName, byDate, byLabel, can, why }. can и why — от сервера: может ли
 * этот человек забрать, поменяться или выйти и почему нет (та же должность по графику, свободен в этот день, правила
 * графика). v97: mode "need" — «Ищем в смену» из графика руководителя: posKey, n (сколько человек), took ([{ id, name }]
 * — кто уже выходит), instead ({ sid, name } — вместо кого).
 */
export function shiftState(card, me) {
  const c = card || {}, meId = me && me.id != null ? String(me.id) : "";
  const mine = String(c.from) === meId, swap = c.mode === "swap";
  if (c.mode === "need") return needState(c, meId, mine);
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
// v97: «Ищем в смену» и «Ищем замену» — кто уже выходит, сколько ещё нужно, «Выйду» у тех, кто может
function needState(c, meId, mine) {
  const took = Array.isArray(c.took) ? c.took : [], n = Math.max(1, Number(c.n) || 1), inst = c.instead && c.instead.name;
  const head = inst ? "Ищем замену" : "Ищем в смену", names = took.map((t) => nm(t && t.name)).filter(Boolean);
  const meIn = took.some((t) => t && String(t.id) === meId), left = Math.max(0, n - took.length);
  const went = names.length ? (names.length > 1 ? "Выходят: " : "Выходит ") + names.join(", ") : "";
  if (c.st === "done") return { mine, head, done: true, act: null, line: went + " · график обновлён" };
  if (c.st === "off") return { mine, head, done: true, act: null, line: "Больше не ищем" };
  const more = went ? went + (left ? " · нужно ещё " + left : "") : "";
  if (meIn) return { mine, head, done: false, act: null, line: "Ты выходишь · график обновлён" };
  if (mine) return { mine, head, done: false, act: "cancel", line: more || (n > 1 ? "Ждём, кто выйдет: нужно " + n : "Ждём, кто выйдет") };
  if (c.can) return { mine, head, done: false, act: "need", line: "Можешь выйти: в этот день у тебя нет смены по графику" };
  return { mine, head, done: false, act: null, line: c.why || "Выйти могут " + posWord(c.posKey, true) + ", свободные в этот день" };
}
/**
 * v97: карточка коллеги (chat_person) — смена одной строкой: «Сегодня в смене: день 11:00–24:00», «Ближайшая смена:
 * пятница, 30 октября · вечер 18:00–24:00», «В графике на две недели вперёд смен нет».
 */
export function personShiftLine(p, now = new Date()) {
  const s = (x) => [String((x && x.label) || "").toLowerCase(), x && x.time].filter(Boolean).join(" ");
  if (p && p.today) return "Сегодня в смене: " + s(p.today);
  if (p && p.next) return "Ближайшая смена: " + [dayLong(p.next.date, now), s(p.next)].filter(Boolean).join(" · ");
  return "В графике на две недели вперёд смен нет";
}
/** «Вместо Анны С.» — у замены. */
export const insteadLine = (c) => (c && c.instead && c.instead.name ? "вместо " + nm(c.instead.name) : "");
/** «Взамен: пн 4, ср 6» или «Взамен: любой день». */
export const wantLine = (want) => "Взамен: " + ((want || []).length ? want.map(dayShort).join(", ") : "любой день");
/**
 * Строка для руководителей (в «Старших» и ботом): смена переходит без подтверждения, но руководитель видит каждую
 * передачу и обмен. «Передача смены пт 30, вечер: отдаёт Вера С., забирает Пётр О. · график обновлён».
 */
export function shiftLogLine(c) {
  if (!c || c.st !== "done") return "";
  // v97: «Смена пт 30, вечер (официант): выходит Пётр О. · график обновлён»; замена — «…, не выходит Анна С.»
  if (c.mode === "need") {
    const took = Array.isArray(c.took) ? c.took : [], last = took.length ? took[took.length - 1] : null, inst = c.instead && c.instead.name;
    return (inst ? "Замена " : "Смена ") + dayShort(c.date) + (c.label ? ", " + String(c.label).toLowerCase() : "") + (posWord(c.posKey) ? " (" + posWord(c.posKey) + ")" : "") +
      ": выходит " + nm(last && last.name) + (inst ? ", не выходит " + nm(inst) : "") + " · график обновлён";
  }
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
  if (c.t === "shift" && c.mode === "need") return (c.instead && c.instead.name ? "Ищем замену: " : "Ищем " + posAcc(c.posKey, c.n) + ": ") + shiftLine(c, now) +
    (c.instead && c.instead.name && posWord(c.posKey) ? " (" + posWord(c.posKey) + ")" : "");
  if (c.t === "shift") return (c.mode === "swap" ? "Меняю смену: " : "Отдаю смену: ") + shiftLine(c, now);
  if (c.t === "task") return "Задание: " + ((c.item && c.item.title) || "") + (c.due ? ", " + dueLine(c.due, now) : "");
  if (c.t === "share") return ({ dish: "Блюдо", cocktail: "Коктейль", ref: "Справочник", lesson: "Урок", quiz: "Тест" }[c.item && c.item.kind] || "Карточка") + ": " + ((c.item && c.item.title) || "");
  if (c.t === "poll") return "Опрос: " + (c.q || "");
  if (c.t === "stop") return (c.st === "off" ? "Снова в меню: " : "В стоп-листе: ") + ((c.dish && c.dish.name) || "");
  if (c.t === "brief") return "Брифинг смены" + (c.date ? ", " + dayLong(c.date, now) : "");
  if (c.t === "sched") return schedView(c).sum;
  if (c.t === "late") return lateSummary(c);   // v99
  if (c.t === "hello" || c.t === "solo") return newbieCardSum(c);   // v107: «Знакомьтесь» и «Первая самостоятельная смена»
  return "";
}

/**
 * v97: «График на ноябрь готов» и «Пожелания на декабрь: до 20 ноября» — карточка руководителя в «Вся команда».
 * → { head, title, sub, btn, sum }.
 */
export function schedView(card) {
  const c = card || {}, mon = monthWord(c.month) || "месяц";
  if (c.what === "wishes") {
    const u = ymdOf(c.until), till = u ? u.getDate() + " " + MON_G[u.getMonth()] : "";
    return { head: "Пожелания", title: "Пожелания на " + mon, sub: till ? "Отметь в графике до " + till + ": когда не можешь и когда хочешь выйти" : "Отметь в графике, когда не можешь и когда хочешь выйти",
      btn: "Указать пожелания", sum: "Пожелания на " + mon + (till ? ": до " + till : "") };
  }
  return { head: "График", title: "График на " + mon + " готов", sub: "Проверь свои смены", btn: "Открыть график", sum: "График на " + mon + " готов" };
}

/** Что умеет «+» в строке ввода: кто и где видит плитку. */
export function actTiles(me, chat) {
  const lead = !!(me && me.lead), kind = chat && chat.kind;
  return [
    ["photo", "Фото", true],
    ["late", "Опаздываю", kind === "team" || kind === "group"],   // v99 (Доп. 412)
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
