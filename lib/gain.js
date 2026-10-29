// lib/gain.js — v109 (Доп. 422): «Что дало обучение». Итог месяца для владельца и руководителей: чему команда училась и
// что за это время изменилось в зале, по сравнению с прошлым месяцем. Экран — ui/gain.jsx («Команда» → «Управление»),
// 1-го числа итог прошлого месяца присылает бот. Итог собирает сервер (этап 43, gain_month); здесь — разбор ответа для
// экрана, строки сравнения, текст сообщения бота (тот же, что у сервера в _sa_gain_text: демо показывает его как сообщение
// в Telegram, проверки сверяют с сервером) и кнопка под ним.
//
// Ответ сервера:
//   rest, month «ГГГГ-ММ», from/to — дни месяца в итоге (месяц идёт — по сегодня), partial — месяц ещё идёт,
//   pfrom/pto — с чем сравниваем (прошлый месяц; пока месяц идёт — те же дни прошлого месяца), team — сколько человек
//   в команде (без владельца), learn/plearn { people — занимались, lessons, tests, practice, guest, days } — по журналу
//   занятий с телефонов (plearn — null, если прошлый месяц уже не виден: телефон хранит журнал 75 дней), quiz/pquiz { n — ответов в тестах, wrong — неверных } (нет этапа 7 — null), topics [{ id — урок
//   с тестом, n — человек, a — ответов, w — неверных }] и topicsN — по скольким урокам сдавали тесты, thanks/peer { n, prev }
//   — «спасибо» гостей и коллег (нет этапа — null), newbies { n, days, pn, pdays } — сколько новичков вышли на
//   самостоятельную смену и за сколько дней в среднем (нет этапа 41 — null), grew [{ id, n, pts, ppts, lessons, tests, qn,
//   qw, pqn, pqw, plessons, ptests }] — больше всех выросли, idle [{ id, n }] и idleMore — ни разу не занимались.
import { MONTH_NOM, MONTH_GEN, MONTH_PREP, MONTH_INS } from "./dates.js";
import { plural, joinAnd, daysText } from "./morning.js";

export const GAIN_BACK = 1;          // сколько прошлых месяцев можно открыть: журнал занятий на телефоне хранит 75 дней
export const GAIN_EARLY = 7;         // первые семь дней месяца экран открывает прошлый, уже полный месяц
export const GAIN_HOUR = 10;         // 1-го числа бот присылает итог прошлого месяца с 10:00 по часам заведения
export const GAIN_MIN_ANSWERS = 10;  // долю ошибок показываем, когда в тестах хотя бы 10 ответов
export const GAIN_GREW_MIN = 50;     // «выросли» — кто набрал за месяц хотя бы 50 очков занятий и больше, чем в прошлом
export const GAIN_IDLE_MAX = 5;      // «не занимались» — пять имён и «и ещё N»

const str = (v, n = 200) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const int = (v) => Math.max(0, Math.round(num(v)));
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
export const isMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ""));

/** «2026-10», -1 → «2026-09» */
export function monthAdd(m, n) {
  const y = Number(String(m).slice(0, 4)), mo = Number(String(m).slice(5, 7)) - 1 + n;
  const d = new Date(Date.UTC(y, mo, 1));
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}
export const monthOf = (iso) => String(iso || "").slice(0, 7);
const mi = (m) => Number(String(m).slice(5, 7)) - 1;
/** «Октябрь», «октябрь», «октября», «в октябре», «с сентябрём» */
export const monthNom = (m) => (isMonth(m) ? MONTH_NOM[mi(m)] : "");
export const monthLow = (m) => monthNom(m).toLowerCase();
export const monthGen = (m) => (isMonth(m) ? MONTH_GEN[mi(m)] : "");
export const monthPrep = (m) => (isMonth(m) ? MONTH_PREP[mi(m)] : "");
export const monthIns = (m) => (isMonth(m) ? MONTH_INS[mi(m)] : "");
/** какой месяц открыть: первые семь дней — прошлый (уже полный), дальше — текущий */
export function gainDefaultMonth(today) {
  if (!isIso(today)) return "";
  return Number(today.slice(8)) <= GAIN_EARLY ? monthAdd(monthOf(today), -1) : monthOf(today);
}
/** месяцы, которые можно открыть: текущий и два прошлых */
export const gainMonths = (today) => (isIso(today) ? Array.from({ length: GAIN_BACK + 1 }, (_, i) => monthAdd(monthOf(today), -i)) : []);
/** «1–30 октября», «1 октября», «28 сентября – 3 октября» не бывает: период всегда внутри месяца */
export function periodLabel(from, to) {
  if (!isIso(from) || !isIso(to)) return "";
  const a = Number(from.slice(8)), b = Number(to.slice(8)), g = MONTH_GEN[Number(to.slice(5, 7)) - 1];
  return a === b ? a + " " + g : a + "–" + b + " " + g;
}

const learn1 = (v) => { const o = obj(v) || {}; return { people: int(o.people), lessons: int(o.lessons), tests: int(o.tests), practice: int(o.practice), guest: int(o.guest), days: int(o.days) }; };
const quiz1 = (v) => { const o = obj(v); return o ? { n: int(o.n), wrong: Math.min(int(o.wrong), int(o.n)) } : null; };
const pair1 = (v) => { const o = obj(v); return o ? { n: int(o.n), prev: int(o.prev) } : null; };

/** Ответ gain_month → итог с нужными полями (старая версия сервера, мусор — пустые места, а не падение). */
export function gainModel(raw) {
  const r = obj(raw) || {};
  const month = isMonth(r.month) ? r.month : "";
  const nb = obj(r.newbies);
  const person = (p) => { const o = obj(p) || {}; return { id: o.id == null ? null : String(o.id), n: str(o.n, 60) }; };
  return {
    ok: r.ok !== false, rest: str(r.rest, 80), month,
    from: isIso(r.from) ? r.from : "", to: isIso(r.to) ? r.to : "", partial: !!r.partial,
    pfrom: isIso(r.pfrom) ? r.pfrom : "", pto: isIso(r.pto) ? r.pto : "",
    months: arr(r.months).filter(isMonth).slice(0, GAIN_BACK + 1),
    team: int(r.team), learn: learn1(r.learn), plearn: obj(r.plearn) ? learn1(r.plearn) : null,
    quiz: quiz1(r.quiz), pquiz: quiz1(r.pquiz),
    topics: arr(r.topics).map((t) => obj(t)).filter((t) => t && str(t.id, 80)).slice(0, 5)
      .map((t) => ({ id: str(t.id, 80), n: int(t.n), a: int(t.a), w: Math.min(int(t.w), int(t.a)) })),
    topicsN: int(r.topicsN),
    thanks: pair1(r.thanks), peer: pair1(r.peer),
    newbies: nb ? { n: int(nb.n), days: int(nb.days), pn: int(nb.pn), pdays: int(nb.pdays) } : null,
    grew: arr(r.grew).map((g) => obj(g)).filter(Boolean).map((g) => ({ ...person(g), pts: int(g.pts), ppts: int(g.ppts), lessons: int(g.lessons), tests: int(g.tests),
      plessons: int(g.plessons), ptests: int(g.ptests), qn: int(g.qn), qw: int(g.qw), pqn: int(g.pqn), pqw: int(g.pqw) })).filter((g) => g.n).slice(0, 3),
    idle: arr(r.idle).map(person).filter((p) => p.n).slice(0, GAIN_IDLE_MAX), idleMore: int(r.idleMore),
  };
}
const modelOf = (raw) => (raw && raw.learn && "plearn" in raw && Array.isArray(raw.grew) && Array.isArray(raw.idle) ? raw : gainModel(raw));

/** доля ошибок, %: меньше 10 ответов — не считаем (null) */
export const wrongPct = (q) => (q && q.n >= GAIN_MIN_ANSWERS ? Math.round((100 * q.wrong) / q.n) : null);
/** есть что показать: занятия, тесты, «спасибо», новички */
export const gainHas = (raw) => { const m = modelOf(raw); return !!(m.learn.days || m.learn.people || (m.quiz && m.quiz.n) || (m.thanks && m.thanks.n) || (m.peer && m.peer.n) || (m.newbies && m.newbies.n)); };

/**
 * Строки «Чему учились» и «Что изменилось в зале»: { key, label, now, was (null — сравнить не с чем), text — значение
 * словами, wasText, better: "up" | "down" — что лучше, good: true | false | null }.
 */
export function learnRows(raw) {
  const m = modelOf(raw), L = m.learn, P = m.plearn, prev = !!P;
  const row = (key, label, now, was) => ({ key, label, now, was: prev ? was : null, text: String(now), wasText: prev ? String(was) : "", better: "up",
    good: prev ? (now > was ? true : now < was ? false : null) : null });
  return [
    row("lessons", "Уроков", L.lessons, prev ? P.lessons : 0),
    row("tests", "Тестов", L.tests, prev ? P.tests : 0),
    { ...row("people", "Занимались", L.people, prev ? P.people : 0), text: L.people + (m.team ? " из " + m.team : "") },
  ];
}
export function hallRows(raw) {
  const m = modelOf(raw), out = [];
  const add = (key, label, now, was, unit, better) => out.push({ key, label, now, was, better,
    text: unit === "%" ? now + "%" : unit === "d" ? daysText(now) : String(now), wasText: was == null ? "" : unit === "%" ? was + "%" : String(was),
    good: was == null || now === was ? null : better === "up" ? now > was : now < was });
  // «спасибо» — когда они вообще есть (этап на сервере, но QR-кодов в зале нет — строка «0, было 0» ни о чём)
  if (m.thanks && (m.thanks.n || m.thanks.prev)) add("thanks", "«Спасибо» от гостей", m.thanks.n, m.thanks.prev, "", "up");
  const q = wrongPct(m.quiz), pq = wrongPct(m.pquiz);
  if (q != null) add("quiz", "Ошибок в тестах", q, pq, "%", "down");
  if (m.newbies && m.newbies.n) add("newbies", "Новички до самостоятельной смены", m.newbies.days, m.newbies.pn ? m.newbies.pdays : null, "d", "down");
  if (m.peer && (m.peer.n || m.peer.prev)) add("peer", "«Спасибо» от коллег", m.peer.n, m.peer.prev, "", "up");
  return out;
}
/** «Уроков: 46, было 30» — одна строка сравнения (для бота и подписей) */
export const rowLine = (x) => x.label + ": " + x.text + (x.wasText ? ", было " + x.wasText : "");
/** «Анна С., Пётр О. и Вера С.» */
export const grewNames = (raw) => joinAnd(modelOf(raw).grew.map((g) => g.n));
/** почему вырос: «14 уроков и 9 тестов, было 4 и 2; ошибок 6%, было 21%» */
export function grewWhy(g) {
  const L = g.lessons > 0 || g.plessons > 0, T = g.tests > 0 || g.ptests > 0;
  const now = [L ? g.lessons + " " + plural(g.lessons, "урок", "урока", "уроков") : "", T ? g.tests + " " + plural(g.tests, "тест", "теста", "тестов") : ""].filter(Boolean);
  let s = now.length ? joinAnd(now) + ", было " + [L ? g.plessons : null, T ? g.ptests : null].filter((x) => x != null).join(" и ") : "больше занятий, чем месяцем раньше";
  const a = g.qn >= GAIN_MIN_ANSWERS ? Math.round((100 * g.qw) / g.qn) : null, b = g.pqn >= GAIN_MIN_ANSWERS ? Math.round((100 * g.pqw) / g.pqn) : null;
  if (a != null && b != null && a < b) s += "; ошибок " + a + "%, было " + b + "%";
  return s;
}
/** название темы по уроку теста: «Тест: работа с жалобами» → «Работа с жалобами»; неизвестный урок — "" */
export function topicTitle(id, titles) {
  const t = str(titles && titles[id], 120).replace(/^тест\s*[:.]\s*/i, "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}
/** «тест проходили 5 человек, ошибок 12%» */
export function topicLine(t) {
  const who = "тест " + (t.n === 1 ? "проходил 1 человек" : "проходили " + t.n + " " + plural(t.n, "человек", "человека", "человек"));
  return who + (t.a >= GAIN_MIN_ANSWERS ? ", ошибок " + Math.round((100 * t.w) / t.a) + "%" : "");
}
/** не занимались: «Дарья Л. и Олег С.»; больше пяти — «Дарья Л., Олег С., … и ещё 2» */
export const idleLine = (raw) => { const m = modelOf(raw), ns = m.idle.map((p) => p.n); return m.idleMore ? ns.join(", ") + " и ещё " + m.idleMore : joinAnd(ns); };
/** с чем сравниваем: «сравниваем с сентябрём»; месяц идёт — «1–30 октября, сравниваем с 1–30 сентября» */
export function compareLabel(raw) {
  const m = modelOf(raw);
  if (!m.month) return "";
  if (!m.pfrom || !m.pto) return m.partial ? periodLabel(m.from, m.to) : "";
  return m.partial ? periodLabel(m.from, m.to) + ", сравниваем с " + periodLabel(m.pfrom, m.pto) : "сравниваем с " + monthIns(monthOf(m.pfrom));
}

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Текст сообщения бота (Telegram, parse_mode HTML) — как у сервера (_sa_gain_text, этап 43). */
export function gainText(raw) {
  const m = modelOf(raw);
  const cmp = compareLabel(m);
  const L = ["<b>Что дало обучение · " + monthLow(m.month) + "</b>"];
  if (m.rest || cmp) L.push([esc(m.rest), cmp].filter(Boolean).join(" · "));
  L.push("", "<b>Чему учились</b>", ...learnRows(m).map(rowLine));
  const hall = hallRows(m);
  if (hall.length) L.push("", "<b>Что изменилось в зале</b>", ...hall.map(rowLine));
  if (m.grew.length) L.push("", "<b>Больше всех выросли</b>", esc(grewNames(m)));
  if (m.idle.length) L.push("", "<b>Не занимались</b>", esc(idleLine(m)));
  return L.join("\n");
}
/** Кнопка под сообщением: «Открыть итог» — этот месяц на экране «Что дало обучение». */
export const gainKb = (raw) => [[{ text: "Открыть итог", go: "gain_" + modelOf(raw).month }]];
