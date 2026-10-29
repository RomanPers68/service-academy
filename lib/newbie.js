// lib/newbie.js — v107 (Доп. 420): новичок. Его «Первая неделя» (план по дням и темы с собеседования), наставник из
// команды, памятка заведения, сообщение бота накануне первой смены, карточки «Знакомьтесь» и «Первая самостоятельная
// смена» в «Вся команда». Сервер — этап 40 нет, этап 41 (supabase-stage41-newbie.sql: newbie_me, newbie_list, …); здесь —
// разбор ответов, план для экрана и тексты бота (те же, что у сервера в _sa_nb_eve_text и _sa_nb_buddy_text: демо
// показывает их как сообщения в Telegram, проверки сверяют с сервером).
//
// Ответ newbie_me (новичок): { newbie, emp, name, pos, rest, day (сегодня по часам заведения), started, days,
//   first: { day, k, name, from, to } | null — первая смена по графику, memo — памятка, buddy: { id, name, pos } | null,
//   focus: [{ topic }] — темы с собеседования, checked: { шаг: когда }, confirm: { шаг: { by, name, at } },
//   hello: { msg, n } | null, solo: { at, by, name } | null }; у всех — buddy_of: [{ emp, name }] — кого ведёшь.
// Ответ newbie_list (руководитель — все новички заведения, наставник — свои): { lead, day, memo, list: [...], team, cands,
//   led }. У руководителя в focus ещё и баллы (score), cand — какое собеседование.
import { isFemaleName } from "./utils.js";
import { dLong, dShort, hh, nm, upFirst, plural, isoAdd } from "./morning.js";
import { moduleDone } from "./freshness.js";

// план первой недели — тот же, что был (ui/screens-admin.jsx, DEFAULT_ONBOARDING), id шагов прежние
export const NB_PLAN = [
  { key: "d1", day: "ДЕНЬ 1", steps: [
    { id: "d1a", text: "Познакомиться с командой и наставником" },
    { id: "d1b", text: "Изучить меню и сегодняшний стоп-лист" },
    { id: "d1c", text: "Внешний вид по стандарту" },
    { id: "d1d", text: "Урок «Добро пожаловать»" },
  ] },
  { key: "d2", day: "ДНИ 2–3", steps: [
    { id: "d2a", text: "Сервировка стола по стандарту" },
    { id: "d2b", text: "Работа с подносом" },
    { id: "d2c", text: "5 столов под присмотром наставника" },
    { id: "d2d", text: "Глоссарий: первые 10 терминов" },
  ] },
  { key: "d3", day: "К КОНЦУ НЕДЕЛИ", steps: [
    { id: "d3a", text: "Пройти тест роли «Новичок»" },
    { id: "d3b", text: "Отработать смену самостоятельно" },
  ] },
];
export const NB_STEP_IDS = NB_PLAN.flatMap((p) => p.steps.map((s) => s.id));
export const NB_BUDDY_STEPS = ["d2c", "d3b"];   // подтверждает наставник или руководитель
export const NB_SOLO = "d3b";                   // подтвердили — «Первая самостоятельная смена» в «Вся команда»
export const NB_FOCUS_MAX = 3;                  // тем с собеседования — не больше трёх, слабые первыми
export const NB_WEAK = 70;                      // балл AI-интервью ниже — тема слабая; в обычном тесте — меньше 70% верных
export const NB_ARRIVE = [0, 10, 15, 20, 30];   // за сколько минут до смены приходить
export const NB_ARRIVE0 = 15;
export const NB_MEMO_MAX = { addr: 200, dress: 200, meet: 100, extra: 300 };
export const NB_KEEP_DAYS = 14;                 // после самостоятельной смены ещё две недели в «Новичках»

// темы собеседования (компетенции AI HR и обычного теста) → тема трека, с которой начать. Нет темы — разобрать с
// наставником на смене. «Свой раздел: …» — урок заведения с тем же названием (если есть).
export const NB_COMP_MODULES = {
  seasonal: { "Сервис и гость": "s1", "Конфликты и сложные ситуации": "s4", "Приоритеты и организация": "s2", "Честность и деньги": "s-mn",
    "Расчёт и деньги": "s-pos", "Команда": "s0", "Команда и люди": "s0", "Гигиена и безопасность": "s-hy", "Гигиена и стандарты": "s-hy",
    "Продукт и подача": "s-prod", "Общие стандарты": "s7" },
  spg: { "Сервис и гость": "spg-m2", "Конфликты и сложные ситуации": "spg-m6", "Приоритеты и организация": "spg-m3", "Команда": "spg-m0",
    "Команда и люди": "spg-m0", "Общие стандарты": "spg-m1", "Гигиена и безопасность": "spg-m9" },
  bar: { "Сервис и гость": "bar4", "Конфликты и сложные ситуации": "bar4", "Приоритеты и организация": "bar0", "Команда": "bar0",
    "Команда и люди": "bar0", "Гигиена и стандарты": "bar1", "Гигиена и безопасность": "bar1", "Общие стандарты": "bar1", "Продукт и подача": "bar3" },
  manager: { "Команда и люди": "m3", "Команда": "m3", "Конфликты и сложные ситуации": "m4", "Приоритеты и организация": "m1", "Общие стандарты": "m2",
    "Гигиена и безопасность": "m5", "Сервис и гость": "m1" },
};
// должность словом, как у сервера (_sa_nb_posw)
export const NB_POSW = { waiter: "официант", hostess: "хостес", bartender: "бармен", senior_bartender: "старший бармен", manager: "менеджер",
  senior: "руководящий состав", service_manager: "сервис-менеджер", chef: "повар", owner: "владелец", admin: "владелец", runner: "раннер", barback: "барбек" };
export const posWord = (p) => NB_POSW[String(p || "").toLowerCase()] || "";

const str = (v, n = 200) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** сколько дней от a до b (даты «ГГГГ-ММ-ДД») */
export const dayDiff = (a, b) => (isIso(a) && isIso(b) ? Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8))) / 864e5) : 0);

/** памятка заведения: что задано, остальное — пусто; приходить — за 15 минут, если не сказано иначе */
export function memoOf(raw) {
  const m = obj(raw) || {};
  const a = Math.round(num(m.arrive));
  return { addr: str(m.addr, NB_MEMO_MAX.addr), arrive: m.arrive == null || m.arrive === "" || !NB_ARRIVE.includes(a) ? NB_ARRIVE0 : a,
    dress: str(m.dress, NB_MEMO_MAX.dress), meet: str(m.meet, NB_MEMO_MAX.meet), extra: str(m.extra, NB_MEMO_MAX.extra) };
}
/** к какому времени приходить: начало смены минус arrive минут → «11:45» */
export const arriveAt = (from, arrive) => hh(Math.max(0, num(from) - num(arrive) / 60));
/** смена словами: «День 12:00–20:00» */
export const shiftLabel = (f) => (f ? str(f.name, 30) + " " + hh(f.from) + "–" + hh(f.to) : "");
/** когда: «сегодня», «завтра», «послезавтра», дальше — «пт 31» */
export function whenWord(day, today) {
  const n = dayDiff(today, day);
  return n === 0 ? "сегодня" : n === 1 ? "завтра" : n === 2 ? "послезавтра" : dShort(day);
}
/** «С нами 3 дня» → «3 дня»; первый день — «первый день» */
export const withUs = (days) => (days <= 0 ? "первый день" : days + " " + plural(days, "день", "дня", "дней"));

function firstOf(v) {
  const f = obj(v);
  return f && isIso(f.day) ? { day: f.day, k: str(f.k, 4), name: str(f.name, 30) || str(f.k, 4), from: num(f.from), to: num(f.to) } : null;
}
function personOf(v) {
  const p = obj(v);
  return p && p.id != null && str(p.name, 80) ? { id: String(p.id), name: str(p.name, 80), pos: str(p.pos, 30) } : null;
}
const stepMap = (v) => { const o = obj(v) || {}; const out = {}; for (const [k, x] of Object.entries(o)) if (/^(d\d[a-z]|f:.{1,60})$/.test(k) && x) out[k] = x; return out; };
const confMap = (v) => { const o = obj(v) || {}; const out = {}; for (const [k, x] of Object.entries(o)) { const c = obj(x); if (NB_BUDDY_STEPS.includes(k) && c) out[k] = { by: str(c.by, 60), name: str(c.name, 80), at: str(c.at, 40) }; } return out; };
const focusOf = (v) => arr(v).map((t) => obj(t)).filter((t) => t && str(t.topic, 80)).slice(0, NB_FOCUS_MAX)
  .map((t) => ({ topic: str(t.topic, 80), ...(t.score == null || t.score === "" ? {} : { score: Math.round(num(t.score)) }) }));

/** Ответ newbie_me или строка newbie_list → новичок с нужными полями (мусор и старая версия сервера — пустые места). */
export function newbieModel(raw) {
  const r = obj(raw) || {};
  const hello = obj(r.hello), solo = obj(r.solo), cand = obj(r.cand);
  return {
    newbie: r.newbie !== false, emp: r.emp == null ? "" : String(r.emp), name: str(r.name, 80), pos: str(r.pos, 30), rest: str(r.rest, 80),
    day: isIso(r.day) ? r.day : "", started: isIso(r.started) ? r.started : "", days: Math.max(0, Math.round(num(r.days))),
    first: firstOf(r.first), memo: memoOf(r.memo), buddy: personOf(r.buddy), focus: focusOf(r.focus),
    checked: stepMap(r.checked), confirm: confMap(r.confirm),
    hello: hello && num(hello.msg) > 0 ? { msg: num(hello.msg), n: Math.max(0, Math.round(num(hello.n))), at: str(hello.at, 40) } : null,
    solo: solo && str(solo.at, 40) ? { at: str(solo.at, 40), by: str(solo.by, 60), name: str(solo.name, 80) } : null,
    cand: cand && num(cand.id) > 0 ? { id: num(cand.id), name: str(cand.name, 80), date: str(cand.date, 10), how: cand.how === "set" ? "set" : "auto" } : null,
    noCand: !!r.no_cand, tg: !!r.tg,
    buddyOf: arr(r.buddy_of).map((x) => obj(x)).filter((x) => x && x.emp != null && str(x.name, 80)).map((x) => ({ emp: String(x.emp), name: str(x.name, 80) })),
  };
}

/** Модуль трека для темы собеседования: { id, title, tag } или null. modules — темы текущего трека (как в приложении). */
export function focusModule(topic, track, modules = []) {
  const t = str(topic, 80), mods = arr(modules);
  const own = /^Свой раздел:\s*(.+)$/.exec(t);
  const id = own ? null : ((NB_COMP_MODULES[track] || {})[t] || null);
  const m = own ? mods.find((x) => x && str(x.title, 120).toLowerCase() === own[1].trim().toLowerCase()) : id ? mods.find((x) => x && x.id === id) : null;
  return m ? m : null;
}

/** Темы с собеседования шагами плана: { id: "f:тема", topic, text, sub, module, done, auto } */
export function focusSteps(nb, { track = "", modules = [], completed = {}, quizDone = {} } = {}) {
  return (nb.focus || []).map((f) => {
    const m = focusModule(f.topic, track, modules);
    const auto = !!(m && moduleDone(m, completed, quizDone));
    const id = "f:" + f.topic;
    return { id, topic: f.topic, text: f.topic.replace(/^Свой раздел:\s*/, ""), sub: m ? (m.tag ? m.tag + " · " : "") + "«" + str(m.title, 120) + "»" : "Разбери с наставником на смене",
      module: m ? m.id : null, auto, done: auto || !!nb.checked[id], buddy: false };
  });
}

/** План для экрана: секции «С собеседования» (если есть) и дни; сделано и всего. */
export function planOf(nb, opts = {}) {
  const fs = focusSteps(nb, opts);
  const sections = [];
  if (fs.length) sections.push({ key: "focus", title: "С СОБЕСЕДОВАНИЯ", steps: fs });
  for (const p of NB_PLAN) {
    sections.push({ key: p.key, title: p.day, steps: p.steps.map((s) => {
      const buddy = NB_BUDDY_STEPS.includes(s.id), c = nb.confirm[s.id] || null;
      return { id: s.id, text: s.text, buddy, conf: c, done: buddy ? !!c : !!nb.checked[s.id] };
    }) });
  }
  const all = sections.flatMap((s) => s.steps);
  return { sections, done: all.filter((s) => s.done).length, total: all.length };
}

/** Сколько сделано (для списка руководителя — по ответу сервера, без модулей): шаги плана, подтверждения и отмеченные темы. */
export function doneCount(nb) {
  let n = 0;
  for (const id of NB_STEP_IDS) if (NB_BUDDY_STEPS.includes(id) ? nb.confirm[id] : nb.checked[id]) n++;
  for (const f of nb.focus || []) if (nb.checked["f:" + f.topic]) n++;
  return n;
}
export const totalCount = (nb) => NB_STEP_IDS.length + (nb.focus || []).length;

/** «Первая смена: завтра, 12:00» / «Первая смена была 30 октября» / «В графике смен пока нет» */
export function firstLine(nb) {
  const f = nb.first;
  if (!f) return "В графике смен пока нет";
  const n = dayDiff(nb.day, f.day);
  if (n < 0) return "Первая смена была " + dLong(f.day).split(", ")[1];
  return "Первая смена: " + whenWord(f.day, nb.day) + ", " + hh(f.from);
}

/** темы собеседования строкой для руководителя: «конфликты и сложные ситуации 45, честность и деньги 62» */
export const focusLine = (focus, scores = true) => (focus || []).map((f) => f.topic.replace(/^Свой раздел:\s*/, "").toLowerCase() + (scores && f.score != null ? " " + f.score : "")).join(", ");

/** Текст бота новичку накануне первой смены (parse_mode HTML) — как у сервера (_sa_nb_eve_text, этап 41). */
export function eveText(x) {
  const f = firstOf(x && x.first);
  if (!f) return "";
  const m = memoOf(x.memo), b = personOf(x.buddy);
  const L = ["<b>Завтра твоя первая смена</b>", esc(upFirst(dLong(f.day)) + " · " + shiftLabel(f))];
  if (str(x.rest, 80)) L.push(esc(str(x.rest, 80)));
  L.push("", "Приходи к " + arriveAt(f.from, m.arrive));
  if (m.addr) L.push(esc("Как найти: " + m.addr));
  if (m.dress) L.push(esc("Форма: " + m.dress));
  L.push(esc(b ? "Тебя встретит " + nm(b.name) + ", твой наставник" : m.meet ? "Тебя встретит: " + m.meet : "Тебя встретит менеджер смены"));
  if (m.extra) L.push(esc(m.extra));
  L.push("", "В «Первой неделе» план и с чего начать.");
  return L.join("\n");
}
/** Текст бота наставнику накануне первой смены новичка — как у сервера (_sa_nb_buddy_text). */
export function eveBuddyText(x) {
  const f = firstOf(x && x.first);
  if (!f) return "";
  const m = memoOf(x.memo), pw = posWord(x.pos);
  return ["<b>Завтра первая смена у новичка</b>", esc(nm(x.name) + (pw ? ", " + pw : "") + " · " + shiftLabel(f)),
    "Ты наставник: встреть к " + arriveAt(f.from, m.arrive) + " и покажи, где что."].join("\n");
}
export const eveKb = () => [[{ text: "Первая неделя", go: "newbie" }]];
export const eveBuddyKb = () => [[{ text: "Новички", go: "newbies" }]];

/** Карточка «Знакомьтесь» в чате → что показать. me — { id }. Поздороваться можно один раз (кнопка уходит). */
export function helloView(card, me) {
  const c = obj(card) || {}, f = firstOf(c.first), b = personOf(c.buddy);
  const greet = arr(c.greet).map((g) => obj(g)).filter((g) => g && g.id != null);
  const meId = me && me.id != null ? String(me.id) : "";
  const self = !!meId && String(c.emp) === meId, mine = greet.some((g) => String(g.id) === meId);
  const names = greet.map((g) => (String(g.id) === meId ? "ты" : nm(g.n || ""))).filter(Boolean);
  const sub = [upFirst(posWord(c.pos)), f ? "первая смена: " + dShort(f.day) + ", " + hh(f.from) : "", b ? "наставник " + nm(b.name) : ""].filter(Boolean).join(" · ");
  return { title: "Знакомьтесь: " + str(c.name, 80), sub, self, mine, n: greet.length,
    line: greet.length ? (self ? "С тобой поздоровались: " : "Поздоровались: ") + names.join(", ") : self ? "Тебя представили команде" : "Пока никто не поздоровался",
    act: self || mine ? null : "greet", btn: "Поздороваться" };
}
/** Карточка «Первая самостоятельная смена» → что показать. Поздравить — один раз. */
export function soloView(card, me) {
  const c = obj(card) || {}, b = personOf(c.buddy);
  const greet = arr(c.greet).map((g) => obj(g)).filter((g) => g && g.id != null);
  const meId = me && me.id != null ? String(me.id) : "";
  const self = !!meId && String(c.emp) === meId, mine = greet.some((g) => String(g.id) === meId);
  const parts = str(c.name, 80).split(" "), first = parts[0] || "", female = isFemaleName(first, parts[1] || "");
  const names = greet.map((g) => (String(g.id) === meId ? "ты" : nm(g.n || ""))).filter(Boolean);
  const days = Math.round(num(c.days));
  return { title: (self ? "Ты" : first) + " " + (female ? "вышла" : "вышел") + " на самостоятельную смену",
    sub: [b ? "наставник " + nm(b.name) : "", days > 0 ? days + " " + plural(days, "день", "дня", "дней") + " с первой смены" : ""].filter(Boolean).join(" · "),
    self, mine, n: greet.length,
    line: greet.length ? (self ? "Тебя поздравили: " : "Поздравили: ") + names.join(", ") : self ? "Карточку видит вся команда" : "Пока никто не поздравил",
    act: self || mine ? null : "greet", btn: "Поздравить" };
}
/** Коротко о карточке — для списка чатов (как _sa_nb_card_sum на сервере). */
export function newbieCardSum(card) {
  const c = obj(card) || {};
  if (c.t === "hello") return "Знакомьтесь: " + str(c.name, 80) + (posWord(c.pos) ? ", " + posWord(c.pos) : "");
  if (c.t === "solo") return "Первая самостоятельная смена: " + str(c.name, 80);
  return "";
}

/** Слабые темы собеседования из записи (как _sa_nb_focus на сервере): AI-интервью — баллы ниже 70, обычный тест — меньше
 *  70% верных; слабые первыми, не больше трёх. → [{ topic, score }] */
export function focusFromPayload(p) {
  const o = obj(p) || {};
  let rows = [];
  const sc = obj(o.aiScores);
  if (sc) rows = Object.entries(sc).map(([topic, s]) => ({ topic: str(topic, 80), score: Math.round(num(s)) }));
  else rows = arr(o.topics).map((t) => obj(t)).filter((t) => t && num(t.n) > 0).map((t) => ({ topic: str(t.topic, 80), score: Math.round((num(t.ok) / num(t.n)) * 100) }));
  return rows.filter((r) => r.topic && r.score < NB_WEAK).sort((a, b) => a.score - b.score || (a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0)).slice(0, NB_FOCUS_MAX);
}

/** «Наставник новичков · ведёт: Ксения М. · вышли на самостоятельную смену: Тимур А.» (пусто — не наставник) */
export function mentorLine(mark) {
  const m = obj(mark) || {}, now = arr(m.now).map((x) => nm(obj(x) && obj(x).name)).filter(Boolean), led = arr(m.led).map((x) => nm(obj(x) && obj(x).name)).filter(Boolean);
  if (!now.length && !led.length) return "";
  return ["Наставник новичков", now.length ? "ведёт: " + now.join(", ") : "", led.length ? "вышли на самостоятельную смену: " + led.join(", ") : ""].filter(Boolean).join(" · ");
}

/** через сколько дней после первой смены вышел самостоятельно (для карточки и «Что дало обучение») */
export const soloDays = (firstDay, soloDay) => (isIso(firstDay) && isIso(soloDay) ? Math.max(0, dayDiff(firstDay, soloDay)) : 0);
export { isoAdd };
