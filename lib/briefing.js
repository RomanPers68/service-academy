// lib/briefing.js — v82 (Доп. 395): брифинг смены из того, что приложение уже знает.
//
// Руководитель перед сменой собирает пятиминутку за минуту: кто сегодня в графике, стоп-лист и новинки меню
// (опубликованное меню команды), фокус смены — вопросы, на которых команда чаще всего ошибается за 30 дней
// (quiz_hard_questions), вопрос команде вслух, «спасибо» лидерам недели (league_week) и своё — банкеты, гости, события.
// Здесь только расчёт: экран — ui/briefing.jsx, отправка команде — этап 32 (brief_publish).
import { isBarcard } from "./deck-extras";
import { DEFAULT_SHIFTS } from "./schedule-sync";
import { reservations } from "./seating";

export const BRIEF_ORDER = ["roster", "res", "stop", "fresh", "focus", "ask", "case", "thanks", "guests", "note"];   // v83: + «Случай из зала», v84: + «Спасибо от гостей», v85: + «Брони сегодня»
export const BRIEF_TITLE = { roster: "Кто сегодня", res: "Брони сегодня", stop: "Стоп-лист", fresh: "Новинки меню", focus: "Фокус смены", ask: "Вопрос команде", case: "Случай из зала", thanks: "Спасибо", guests: "Спасибо от гостей", note: "Своё" };
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
// Как POS в ui/schedule.jsx (сверяет tests/v82.test.js): порядок — как в графике
export const BRIEF_POS = [["manager", "Менеджер"], ["host", "Хостес"], ["call", "Колл-центр"], ["bar", "Бар"], ["barback", "Барбек"], ["waiter", "Официант"], ["runner", "Раннер"]];

const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export const briefDayLabel = (d) => d.getDate() + " " + MONTHS[d.getMonth()];
const isItem = (d) => !!(d && d.id && d.name && !d.archived && !isBarcard(d));
const isDish = (d) => isItem(d) && d.kind !== "cocktail";
const nrm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
/** Часы смены, как в графике: 16:00–24:00, ночная 20:00–8:00, до двух ночи 12:00–2:00. */
export const briefHours = (sh) => { const h = (x) => (Number(x) > 24 ? Number(x) - 24 : Number(x)); return h(sh.from) + ":00–" + h(sh.to) + ":00"; };

/** Стоп-лист: блюда и коктейли «сегодня нет». */
export function briefStop(menu) {
  return (menu || []).filter((d) => isItem(d) && d.stop).map((d) => String(d.name).trim()).slice(0, 12);
}

/** Новинки меню за 30 дней (не в стопе); voice — кто записал о блюде (v80): "chef", "som", "both" или false. */
export function briefFresh(menu, now = new Date()) {
  const t = now.getTime();
  const has = (d, k) => !!(d.voice && d.voice[k] && d.voice[k].url);
  return (menu || []).filter((d) => isDish(d) && !d.stop && d.isNew && d.addedAt && t - d.addedAt < 30 * 864e5 && t >= d.addedAt - 864e5)
    .sort((a, b) => b.addedAt - a.addedAt).slice(0, 5)
    .map((d) => { const ch = has(d, "chef"), so = has(d, "som");
      return { id: d.id, name: String(d.name).trim(), cat: d.cat || "", voice: ch && so ? "both" : ch ? "chef" : so ? "som" : false }; });
}
/** «голос шефа», «голос сомелье», «голос шефа и сомелье» (true — как шеф: так писал первый черновик) */
export const voiceLabel = (v) => (v === "both" ? "голос шефа и сомелье" : v === "som" ? "голос сомелье" : v ? "голос шефа" : "");

/** Вопрос теста по тексту — во всей программе (все роли). */
export function findQuestion(programs, text) {
  const key = nrm(text);
  if (!key) return null;
  for (const [roleId, mods] of Object.entries(programs || {})) {
    for (const m of mods || []) for (const l of (m && m.lessons) || []) {
      if (!l || l.type !== "quiz" || !Array.isArray(l.questions)) continue;
      const q = l.questions.find((x) => x && nrm(x.q) === key);
      if (q && Array.isArray(q.options) && Number.isInteger(q.correct) && q.options[q.correct] != null) {
        return { q: String(q.q).trim(), options: q.options.map(String), correct: q.correct, explanation: String(q.explanation || "").trim(), topic: l.title || m.title || "", roleId };
      }
    }
  }
  return null;
}

/** Фокус смены: самые трудные вопросы команды (доля ошибок за 30 дней), с верным ответом и разбором. */
export function briefFocus(hard, programs, max = 2) {
  const out = [];
  for (const r of hard || []) {
    if (out.length >= max) break;
    const q = r && findQuestion(programs, r.question);
    if (!q || out.some((x) => x.q === q.q)) continue;
    out.push({ q: q.q, right: q.options[q.correct], why: q.explanation, topic: q.topic, pct: Number(r.fail_pct) || 0, n: Number(r.total) || 0 });
  }
  return out;
}

// зерно «день + заведение»: один и тот же вопрос весь день
function pick(arr, seed) {
  if (!arr.length) return null;
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return arr[h % arr.length];
}

/** Вопрос команде вслух: следующий трудный (не из фокуса), иначе — вопрос программы ролей команды, свой на каждый день. */
export function briefAsk(hard, programs, focus, day, restaurant, roles = ["seasonal", "core"]) {
  const used = new Set((focus || []).map((f) => f.q));
  for (const r of hard || []) {
    const q = r && findQuestion(programs, r.question);
    if (q && !used.has(q.q) && q.options.length <= 4) return { q: q.q, options: q.options, correct: q.correct, why: q.explanation, topic: q.topic, from: "hard" };
  }
  const pool = [];
  for (const rid of roles) for (const m of (programs || {})[rid] || []) for (const l of (m && m.lessons) || []) {
    if (!l || l.type !== "quiz" || !Array.isArray(l.questions)) continue;
    for (const x of l.questions) if (x && !x.img && Array.isArray(x.options) && x.options.length >= 2 && x.options.length <= 4 && Number.isInteger(x.correct)) pool.push({ x, topic: l.title || "" });
  }
  const p = pick(pool, day + "|" + restaurant);
  return p ? { q: String(p.x.q).trim(), options: p.x.options.map(String), correct: p.x.correct, why: String(p.x.explanation || "").trim(), topic: p.topic, from: "program" } : null;
}

/** Кто сегодня в графике: смены по времени начала, в каждой — люди по позициям (как в графике). Нет графика — null. */
export function briefRoster(sched, now = new Date()) {
  if (!sched || sched.ok !== true) return null;
  const v = (sched.venues || []).find((x) => x && x.venue_key === "main") || (sched.venues || [])[0];
  const vk = (v && v.venue_key) || "main";
  const m = (sched.months || []).find((x) => x && x.venue_key === vk);
  const cfg = (v && v.config) || {};
  const plan = (m && m.payload && m.payload.plan) || {};
  const staff = Array.isArray(cfg.staff) ? cfg.staff : [];
  const shifts = Array.isArray(cfg.shifts) && cfg.shifts.length ? cfg.shifts : DEFAULT_SHIFTS;
  const day = String(now.getDate());
  const by = {};
  for (const s of staff) {
    const k = s && s.id != null && plan[s.id] && plan[s.id][day];
    const name = s && String(s.name || "").trim();
    if (!k || !name || !shifts.some((sh) => sh.k === k)) continue;
    (by[k] = by[k] || []).push({ name, pos: s.pos || "" });
  }
  const order = (p) => { const i = BRIEF_POS.findIndex((x) => x[0] === p); return i < 0 ? BRIEF_POS.length : i; };
  const out = shifts.filter((sh) => by[sh.k] && by[sh.k].length).map((sh) => {
    const ppl = by[sh.k].sort((a, b) => (order(a.pos) - order(b.pos)) || a.name.localeCompare(b.name, "ru"));
    const groups = [];
    for (const p of ppl) {
      const t = (BRIEF_POS.find((x) => x[0] === p.pos) || [0, ""])[1];
      const g = groups[groups.length - 1];
      if (g && g.t === t) g.names.push(p.name); else groups.push({ t, names: [p.name] });
    }
    return { k: sh.k, name: String(sh.name || sh.k), from: Number(sh.from) || 0, to: Number(sh.to) || 0, people: ppl.map((p) => p.name), groups };
  }).sort((a, b) => (a.from - b.from) || a.name.localeCompare(b.name, "ru"));
  return out.length ? out : null;
}

/** v83: случай из зала для брифинга — самый свежий опубликованный за две недели (case_list counts → top, этап 33). */
export function briefCase(top) {
  const s = top && top.sit;
  if (!s || !String(s.scene || "").trim() || !Array.isArray(s.options) || s.options.length < 2 || s.options.length > 4 || !Number.isInteger(s.correct) || s.options[s.correct] == null) return null;
  return { id: top.id, q: String(s.scene).trim(), question: String(s.question || "").trim() || "Как поступить?", options: s.options.map(String), correct: s.correct,
    why: String(s.why || "").trim(), real: String(s.real || "").trim(), author: top.author ? String(top.author).trim() : "" };
}

/** v85: брони на сегодня с доски рассадки (seat_board, этап 35): время, на кого, сколько, стол. */
export function briefRes(board) {
  if (!board || board.ok !== true || !board.plan) return [];
  return reservations(board.plan, board.tables || []).slice(0, 12).map((r) => ({ t: r.rtime, name: r.name, cnt: r.cnt, n: String(r.n) }));
}

/** v84: спасибо от гостей по QR за неделю (thanks_team, этап 34): трое, кого благодарили чаще, и за что. */
export function briefGuests(team, max = 3) {
  if (!team || team.ok !== true) return [];
  return (team.rows || []).filter((r) => r && Number(r.week) > 0 && String(r.name || "").trim())
    .sort((a, b) => Number(b.week) - Number(a.week)).slice(0, max)
    .map((r) => ({ name: String(r.name).trim(), n: Number(r.week), tags: guestTags(r.tags) }));
}
const GUEST_TAG = { care: "внимание", speed: "быстро", advice: "совет по меню", smile: "улыбка", special: "помощь с просьбой" };
function guestTags(tags) {
  return Object.entries(tags || {}).filter(([k, n]) => GUEST_TAG[k] && Number(n) > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => GUEST_TAG[k]);
}

/** Спасибо: лидеры недели своего заведения (очки лиги с понедельника). */
export function briefThanks(league, restaurant, max = 3) {
  if (!league || league.ok !== true) return [];
  return (league.rows || []).filter((r) => r && r.restaurant === restaurant && Number(r.pts) > 0)
    .sort((a, b) => Number(b.pts) - Number(a.pts)).slice(0, max)
    .map((r) => ({ name: String(r.name || "").trim(), surname: String(r.surname || "").trim(), pts: Number(r.pts) || 0 }));
}

/** Брифинг целиком. Блок с данными включён, пустой — выключен (его можно включить и дописать «Своё»). */
export function buildBrief({ menu = [], hard = [], programs = {}, sched = null, league = null, caseTop = null, guests = null, seat = null, restaurant = "", author = "", note = "", now = new Date() } = {}) {
  const day = ymd(now);
  const focus = briefFocus(hard, programs);
  const blocks = {
    roster: briefRoster(sched, now),
    res: briefRes(seat),
    stop: briefStop(menu),
    fresh: briefFresh(menu, now),
    focus,
    ask: briefAsk(hard, programs, focus, day, restaurant),
    case: briefCase(caseTop),
    thanks: briefThanks(league, restaurant),
    guests: briefGuests(guests),
    note: String(note || "").trim(),
  };
  const has = (k) => { const b = blocks[k]; return Array.isArray(b) ? b.length > 0 : !!b; };
  const on = {};
  BRIEF_ORDER.forEach((k) => { on[k] = has(k); });
  return { v: 1, day, dayLabel: briefDayLabel(now), restaurant, author, blocks, on };
}

/** Есть ли что показать в блоке (с учётом выключателя). */
export function briefShown(brief, k) {
  if (!brief || !brief.on || !brief.on[k]) return false;
  const b = brief.blocks && brief.blocks[k];
  return Array.isArray(b) ? b.length > 0 : !!(typeof b === "string" ? b.trim() : b);
}

/** Люди смены одной строкой: «Менеджер: Иван · Официант: Анна, Борис» (без позиций — просто имена). */
export const rosterLine = (s) => ((s && s.groups) || []).map((g) => (g.t ? g.t + ": " : "") + g.names.join(", ")).join(" · ") || ((s && s.people) || []).join(", ");

const guestsWord = (n) => { const m10 = n % 10, m100 = n % 100; return n + " " + (m10 === 1 && m100 !== 11 ? "гость" : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? "гостя" : "гостей"); };

const cut = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t; };

/** Текст для Telegram: коротко, без разметки, вопрос команде — без ответа (ответ — в приложении). */
export function briefText(brief) {
  if (!brief) return "";
  const b = brief.blocks || {};
  const L = ["Брифинг смены · " + (brief.dayLabel || brief.day || "") + (brief.author ? "\nот " + brief.author : "")];
  if (briefShown(brief, "roster")) L.push("Кто сегодня:\n" + b.roster.map((s) => s.name + " " + briefHours(s) + ". " + rosterLine(s)).join("\n"));
  if (briefShown(brief, "res")) L.push("Брони сегодня: " + b.res.map((r) => r.t + " " + (r.name ? r.name + ", " : "") + guestsWord(r.cnt) + ", стол " + r.n).join("; "));
  if (briefShown(brief, "stop")) L.push("Стоп-лист: " + b.stop.join(", "));
  if (briefShown(brief, "fresh")) L.push("Новинки: " + b.fresh.map((d) => d.name + (d.voice ? " (есть " + voiceLabel(d.voice) + ")" : "")).join(", "));
  if (briefShown(brief, "focus")) b.focus.forEach((f, i) => L.push((i ? "" : "Фокус смены: ") + "«" + cut(f.q, 160) + "» Верно: " + cut(f.right, 120) + (f.why ? ". " + cut(f.why, 200) : "")));
  if (briefShown(brief, "ask")) L.push("Вопрос команде: «" + cut(b.ask.q, 200) + "» Ответ в приложении.");
  if (briefShown(brief, "case")) L.push("Случай из зала: «" + cut(b.case.q, 240) + "» " + (b.case.question || "Как поступить?") + " Разбор в приложении.");
  if (briefShown(brief, "thanks")) L.push("Спасибо: " + b.thanks.map((t) => t.name + (t.surname ? " " + t.surname : "") + " (" + t.pts + ")").join(", "));
  if (briefShown(brief, "guests")) L.push("Гости сказали спасибо за неделю: " + b.guests.map((g) => g.name + " (" + g.n + ")").join(", "));
  if (briefShown(brief, "note")) L.push(cut(b.note, 600));
  return L.join("\n\n").slice(0, 3500);
}
