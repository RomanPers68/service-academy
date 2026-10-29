// tools/claude/demo-app/fake-server.js — v97 (Доп. 410): сервер приложения в памяти: для демо целиком (в странице, вместо
// Supabase) и для e2e-v97 (в скрипте проверки). Те же ответы, что у этапов на сервере: вход по токену (whoami, my_state),
// меню (menu_get, menu_set), график (schedule_load, schedule_save_month), брифинг (brief_today, brief_publish) и чат
// (этап 38: переписка, смены — отдать, поменяться, «Ищем в смену», заявки на месяц для «Графика», карточка коллеги,
// задания, «Поделиться», опросы, стоп-лист из чата и из Меню, брифинг и «График готов» карточкой).
// v99 (Доп. 412): этап 39: вход через Telegram (tg_login), упоминания (mentions, ment в списке чатов, бот упомянутым),
// поиск (chat_search), «Опаздываю» (chat_late, chat_late_ok, late_month), календарь (cal_key, cal_feed) и «Сервер»
// (server_check, owner_tg_setup). Сообщения бота в Telegram — через opts.ping (демо показывает их как уведомление).
// Чего здесь нет, на то ответ «функции нет» (PGRST202): приложение прячет это, как без SQL-этапа.
// Состояние — обычный объект (JSON): демо хранит его в localStorage и переживает смену человека и перезагрузку.
import { cardSummary, shiftLogLine } from "../../../lib/chat-smart.js";
import { mentionNames } from "../../../lib/chat-mention.js";
import { lateMinText } from "../../../lib/late.js";
import { morningText, morningKb } from "../../../lib/morning.js";   // v106: «Утро руководителя» — текст, как у сервера

const clone = (x) => JSON.parse(JSON.stringify(x));
const addD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const dowOf = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const WD_S = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const dshort = (iso) => WD_S[dowOf(iso)] + " " + Number(iso.slice(8));
const dayN = (iso) => String(Number(iso.slice(8)));
const hh = (v) => String(v > 24 ? v - 24 : v).padStart(2, "0") + ":00";
const toks = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").split(/\s+/).filter(Boolean).sort().join(" ");
const nm = (s) => { const w = String(s || "").trim().split(/\s+/); return w[1] ? w[0] + " " + w[1][0] + "." : w[0] || ""; };
const cut = (s, n) => { const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const lowE = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hhmm = (mins) => { const v = ((Math.round(mins) % 1440) + 1440) % 1440; return String(Math.floor(v / 60)).padStart(2, "0") + ":" + String(v % 60).padStart(2, "0"); };
const hex32 = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
export const LEADS = ["manager", "senior", "owner", "admin", "service_manager", "head"];
export const isLead = (p) => !!p && (!!p.is_admin || LEADS.includes(p.position));
export const full = (p) => (p.name + " " + (p.surname || "")).trim();
export const SPOS = { manager: ["менеджер", "менеджеры"], host: ["хостес", "хостес"], bar: ["бар", "бармены"], waiter: ["официант", "официанты"] };
const POS_OF = { manager: "manager", senior: "manager", hostess: "host", bartender: "bar", senior_bartender: "bar", waiter: "waiter" };

export const SHIFTS = [{ k: "У", name: "Утро", from: 10, to: 18 }, { k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }];

/**
 * opts: { today: "ГГГГ-ММ-ДД", rest, people: [сотрудник], tok: { токен: id }, sstaff: [строка графика], cfg, plan: { sid: { смещение дня: буква } },
 *   menu: [блюдо], state (сохранённое S), clock: () => Date.now() }
 */
export function makeServer(opts) {
  const TODAY = opts.today, D = (n) => addD(TODAY, n), R0 = opts.rest;
  const PEOPLE = opts.people, TOK = opts.tok || {}, SSTAFF = opts.sstaff, CFG = opts.cfg;
  const SH = (CFG && CFG.shifts) || SHIFTS;
  const clock = opts.clock || (() => Date.now());
  const ping = opts.ping || (() => {});   // v99: «бот пишет в Telegram»: (кому, текст, кнопки, чат, сообщение)
  const now = () => new Date(clock()).toISOString();
  const S = opts.state || {
    chats: [{ id: 1, kind: "team", rest: R0, pin: null }, { id: 2, kind: "leads", rest: R0, pin: null }, { id: 3, kind: "net", rest: "", pin: null }],
    msgs: [], reads: {}, photos: {}, seq: 100, pseq: 500, votes: {}, progress: clone(opts.progress || {}), quizzes: clone(opts.quizzes || {}), tg: [], menu: clone(opts.menu || []), months: {}, saved: [],
    brief: null, briefSent: 0, log: [], wishes: {},
  };
  // v99: этап 39 (состояние из прошлых версий демо — без этих полей)
  S.late = S.late || {}; S.cal = S.cal || {}; S.seen = S.seen || {}; S.tgAuth = S.tgAuth || {}; S.allAt = S.allAt || {};
  S.srv = S.srv || { hook: false, last: null, app: null, code: null };
  // v106 (этап 40): «Утро руководителя»: настройки, кто подключил Telegram, «спасибо» гостей и занятия по дням (смещения от
  // сегодня), прочтения брифинга прошлых дней, чек-листы по дням. Состояние прошлых версий демо — из opts.
  S.morning = S.morning || {}; S.morningNow = S.morningNow || {}; S.nudged = S.nudged || {};
  S.tgLinked = S.tgLinked || (opts.tgLinked || []).slice();
  S.thanks = S.thanks || (opts.thanks || []).map((t, i) => ({ id: i + 1, emp: t.emp, day: D(t.at), text: t.text || "", hidden: !!t.hidden, at: D(t.at) + "T" + (t.time || "19:00") + ":00" }));
  S.learn = S.learn || Object.fromEntries(Object.entries(opts.learn || {}).map(([id, offs]) => [id, offs.map((n) => D(n))]));
  S.briefDays = S.briefDays || Object.fromEntries(Object.entries(opts.briefDays || {}).map(([n, reads]) => [D(Number(n)), { reads }]));
  S.cl = S.cl || Object.fromEntries(Object.entries(opts.checklists || {}).map(([n, v]) => [D(Number(n)), v]));
  const monOf = (iso) => { const mk = iso.slice(0, 7); return S.months[mk] || (S.months[mk] = { plan: {}, locks: {}, days: {}, facts: {} }); };
  if (!opts.state) for (const [sid, row] of Object.entries(opts.plan || {})) for (const [n, k] of Object.entries(row)) { const iso = D(Number(n)); const mo = monOf(iso); (mo.plan[sid] = mo.plan[sid] || {})[dayN(iso)] = k; }
  // пожелания: { "ГГГГ-ММ": [{ staff_id, day, kind: "off" | "hard" }] }; opts.wishes — смещение дня от сегодня
  if (!opts.state) for (const w of opts.wishes || []) { const iso = D(w.at); (S.wishes[iso.slice(0, 7)] = S.wishes[iso.slice(0, 7)] || []).push({ staff_id: w.sid, day: Number(dayN(iso)), kind: w.kind || "off" }); }
  const who = (id) => PEOPLE.find((e) => e.id === id) || null;
  const visible = (c, p) => !!c && (c.kind === "net" ? isLead(p) : c.kind === "dm" || c.kind === "group" ? c.members.includes(p.id) && (c.kind === "dm" || c.rest === p.restaurant)
    : c.rest === p.restaurant && (c.kind === "team" || isLead(p)));
  const members = (c) => PEOPLE.filter((e) => (c.kind === "net" ? isLead(e) : c.kind === "dm" || c.kind === "group" ? c.members.includes(e.id) : e.restaurant === c.rest && (c.kind === "team" || isLead(e))));
  const rd = (c, e) => ((S.reads[c.id] || {})[e] || 0);
  const setRead = (c, e, v) => { S.reads[c.id] = S.reads[c.id] || {}; S.reads[c.id][e] = Math.max(rd(c, e), v); };
  const msgOf = (id) => S.msgs.find((m) => m.id === Number(id));
  const chatOf = (id) => S.chats.find((c) => c.id === Number(id));
  const teamOf = (rest) => S.chats.find((c) => c.kind === "team" && c.rest === rest) || null;
  const quote = (q) => (q ? { id: q.id, emp: q.emp, name: q.name, kind: q.kind, body: q.del ? "" : q.body, photo: q.kind === "photo", del: q.del } : null);
  const J = (m) => ({ id: m.id, chat: m.chat, emp: m.emp, name: m.name, rest: m.rest, body: m.del ? "" : m.body, kind: m.kind, call: m.kind === "call" && !m.del ? m.call : null,
    photo: m.kind === "photo" && !m.del ? m.photo : null, reply: m.reply && !m.del ? quote(msgOf(m.reply)) : null, reacts: m.del ? [] : m.reacts.map((x) => ({ ...x })),
    at: m.at, edited: !!m.edited && !m.del, del: m.del, card: ["card", "ai", "sys"].includes(m.kind) && !m.del && m.card ? clone(m.card) : null });
  const put = (c, p, body, extra = {}) => { const t = now(); const m = { id: ++S.seq, chat: c.id, emp: p.id, name: full(p), rest: p.restaurant, body, kind: "text", call: null, photo: null, reply: null, reacts: [], edited: false, del: false, at: t, upd: t, ...extra };
    if (m.kind === "text" || m.kind === "photo") m.ment = mentionsOf(c, p, body);
    S.msgs.push(m); setRead(c, p.id, m.id); seenNow(c, p.id); if (m.ment) mentionPings(c, p, m); return m; };
  // v99: упоминания — как _sa_chat_ment_parse: участники чата (кроме автора) и «all» — «@все» руководителя; в личной — никого
  function mentionsOf(c, p, body) {
    if (!c || c.kind === "dm" || String(body || "").indexOf("@") < 0) return null;
    const b = lowE(body), W = "а-яеa-z0-9_", out = [];
    for (const n of mentionNames(members(c).map((e) => ({ id: e.id, name: full(e), pos: e.position })))) {
      if (n.id === p.id) continue;
      if (new RegExp("(^|[^" + W + "])@" + reEsc(lowE(n.disp)) + "($|[^" + W + "])").test(b)) out.push(n.id);
    }
    if (isLead(p) && new RegExp("(^|[^" + W + "])@(все|всем|all)($|[^" + W + "])").test(b)) out.push("all");
    return out.length ? out : null;
  }
  // v99: кто сейчас в чате (открыт минуту назад), тому бот не пишет (как _sa_chat_pingk)
  function seenNow(c, id) { S.seen[c.id + "|" + id] = clock(); }
  function pingK(c, to, text, acts, msg) { if (!to || clock() - (S.seen[c.id + "|" + to] || 0) < 60000) return false; ping(to, text, acts || null, c.id, msg || null); return true; }
  const placeOf = (c) => ({ team: "Вся команда", leads: "Старшие", net: "Руководители сети" }[c.kind] || c.title || "Чат");
  function mentionPings(c, p, m) {
    const what = m.kind === "photo" ? "Фото" + (m.body ? ": " + cut(m.body, 280) : "") : cut(m.body, 300);
    const ids = m.ment.filter((x) => x !== "all" && x !== p.id);
    ids.forEach((x) => pingK(c, x, nm(full(p)) + " упоминает тебя в «" + placeOf(c) + "»:\n" + what, null, m.id));
    if (m.ment.includes("all") && !(clock() - (S.allAt[c.id] || 0) < 600000)) {
      S.allAt[c.id] = clock();
      members(c).filter((e) => e.id !== p.id && !ids.includes(e.id)).forEach((e) => pingK(c, e.id, nm(full(p)) + " пишет всем в «" + placeOf(c) + "»:\n" + what, null, m.id));
    }
  }
  const touch = (m) => { m.upd = now(); };
  const unread = (c, p) => S.msgs.filter((m) => m.chat === c.id && !m.del && m.emp !== p.id && m.id > rd(c, p.id)).length;
  const callFor = (m, p) => m.kind === "call" && !m.del && m.emp !== p.id && (m.call.who === "person" ? m.call.emp === p.id : m.call.who === "lead" ? isLead(p) : ({ host: ["hostess"], bar: ["bartender"], waiter: ["waiter"] }[m.call.who] || []).includes(p.position));
  const calls = (p) => S.msgs.filter((m) => callFor(m, p) && !(m.call.going || []).length && clock() - Date.parse(m.at) < 600000).map(J);
  const view = (c, p) => {
    const last = [...S.msgs].reverse().find((m) => m.chat === c.id && !m.del);
    const peer = c.kind === "dm" ? who(c.members.find((x) => x !== p.id)) : null;
    return { id: c.id, kind: c.kind, members: members(c).length, shift: c.kind === "team" || c.kind === "leads" ? 3 : null, peer: peer ? { id: peer.id, name: full(peer), pos: peer.position, shift: true } : null,
      last: last ? J(last) : null, unread: unread(c, p), cleared: c.cleared || null, title: c.kind === "group" ? c.title : null, owner: c.kind === "group" ? c.owner : null,
      ment: S.msgs.filter((m) => m.chat === c.id && !m.del && m.emp !== p.id && m.id > rd(c, p.id) && m.ment && (m.ment.includes(p.id) || m.ment.includes("all"))).length };
  };
  // ── график: буква в клетке, почему нельзя, может ли взять, варианты обмена, запись ──
  const code = (sid, iso, over = {}) => { const key = iso + "|" + sid; if (key in over) return over[key] || ""; return ((monOf(iso).plan[sid] || {})[dayN(iso)]) || ""; };
  const def = (k) => SH.find((x) => k && x.k === k) || null;
  const staffOf = (empId) => { const e = who(empId); if (!e) return null; const t = toks(full(e)); return SSTAFF.find((s) => toks(s.name) === t) || null; };
  const why = (s, iso, k, over) => {
    const sh = def(k); if (!sh) return "смены нет в графике";
    if (def(code(s.id, iso, over))) return "в этот день уже есть смена";
    const pv = def(code(s.id, addD(iso, -1), over)); if (pv && 24 - pv.to + sh.from < 11) return "мало отдыха после смены накануне (нужно 11 ч)";
    const nx = def(code(s.id, addD(iso, 1), over)); if (nx && 24 - sh.to + nx.from < 11) return "мало отдыха перед сменой назавтра (нужно 11 ч)";
    let run = 1;
    for (let d = addD(iso, -1); run <= 5 && def(code(s.id, d, over)); d = addD(d, -1)) run++;
    for (let d = addD(iso, 1); run <= 5 && def(code(s.id, d, over)); d = addD(d, 1)) run++;
    return run > 5 ? "вышло бы больше 5 смен подряд" : null;
  };
  const check = (c, empId) => {
    if (c.date < TODAY) return { can: false, why: "Этот день уже прошёл" };
    const gs = SSTAFF.find((s) => String(s.id) === String(c.sid)), ts = staffOf(empId);
    if (!ts) return { can: false, why: "Тебя нет в графике" };
    if (!gs || ts.id === gs.id) return { can: false, why: "" };
    if (ts.pos !== gs.pos) return { can: false, why: c.mode === "swap" ? "Поменяться могут " + SPOS[gs.pos][1] : "Забрать могут " + SPOS[gs.pos][1] + ", свободные в этот день" };
    if (code(String(gs.id), c.date) !== c.k) return { can: false, why: "Этой смены уже нет в графике" };
    if (c.mode === "swap") {
      if (def(code(String(ts.id), c.date))) return { can: false, why: "В этот день у тебя своя смена" };
      const days = (c.want || []).length ? c.want.filter((x) => x >= TODAY && x !== c.date) : Array.from({ length: 32 }, (_, i) => D(i)).filter((x) => x !== c.date);
      if (!days.some((x) => def(code(String(ts.id), x)))) return { can: false, why: (c.want || []).length ? "В эти дни у тебя нет смен взамен" : "В ближайший месяц у тебя нет смен взамен" };
      return { can: true, ts, gs };
    }
    const w = why({ id: String(ts.id) }, c.date, c.k, { [c.date + "|" + gs.id]: "" });
    return w ? { can: false, why: "Не получится: " + w } : { can: true, ts, gs };
  };
  // v97: «Ищем в смену»: та же должность по графику, свободен в этот день, правила графика; уже выходит — нет
  const needCheck = (c, empId) => {
    if (c.date < TODAY) return { can: false, why: "Этот день уже прошёл" };
    if ((c.took || []).some((t) => t.id === empId)) return { can: false, why: "Ты выходишь в эту смену" };
    const ts = staffOf(empId);
    if (!ts) return { can: false, why: "Тебя нет в графике" };
    if (ts.pos !== c.posKey) return { can: false, why: "Выйти могут " + (SPOS[c.posKey] ? SPOS[c.posKey][1] : "коллеги той же должности") };
    if (c.instead && String(c.instead.sid) === String(ts.id)) return { can: false, why: "" };
    const w = why({ id: String(ts.id) }, c.date, c.k, {});
    return w ? { can: false, why: "Не получится: " + w } : { can: true, ts };
  };
  const options = (c, empId) => {
    const k0 = check(c, empId); if (!k0.can) return { shifts: [], why: k0.why || "" };
    const ts = String(k0.ts.id), gs = String(k0.gs.id), out = []; let w0 = "";
    const days = (c.want || []).length ? c.want.filter((x) => x >= TODAY && x !== c.date).sort() : Array.from({ length: 32 }, (_, i) => D(i)).filter((x) => x !== c.date);
    for (const x of days) {
      const k2 = code(ts, x), sh = def(k2); if (!sh) continue;
      const w1 = why({ id: ts }, c.date, c.k, { [x + "|" + ts]: "", [c.date + "|" + gs]: "" }), w2 = why({ id: gs }, x, k2, { [c.date + "|" + gs]: "", [x + "|" + ts]: "" });
      if (!w1 && !w2) out.push({ date: x, k: k2, label: sh.name, time: hh(sh.from) + "–" + hh(sh.to) });
      else if (!w0) w0 = dshort(x) + ", " + (w1 || "у коллеги: " + w2);
    }
    return { shifts: out, why: out.length ? "" : w0 ? "Не получится: " + w0 : "Подходящих смен взамен нет" };
  };
  const apply = (list) => { for (const x of list) { const mo = monOf(x.date), d = dayN(x.date); mo.plan[x.sid] = { ...(mo.plan[x.sid] || {}) }; if (x.k) mo.plan[x.sid][d] = x.k; else delete mo.plan[x.sid][d]; mo.locks[x.sid] = { ...(mo.locks[x.sid] || {}), [d]: true }; } };
  // руководителям — строка о каждой передаче, обмене и выходе в смену (как _sa_sh_done)
  const done = (c, m, p) => { const lc = S.chats.find((x) => x.rest === c.rest && x.kind === "leads"); if (lc && lc.id !== c.id) put(lc, p, shiftLogLine(m.card), { kind: "sys", card: { t: "log", mode: m.card.mode } }); };
  // ── задание: кому, кто прошёл ──
  const taskWho = (c, card, author) => members(c).filter((e) => e.id !== author && (c.kind === "leads" || c.kind === "net" || !isLead(e)))
    .map((e) => ({ id: e.id, name: full(e) })).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const doneOf = (ids, it) => {
    const ls = it.kind === "lesson" ? [it.id] : it.kind === "module" ? it.lessons || [] : [], qs = it.kind === "quiz" ? [it.id] : it.kind === "module" ? it.quizzes || [] : [];
    if (!ls.length && !qs.length) return [];
    return ids.filter((u) => ls.every((l) => (S.progress[u] || []).includes(l)) && qs.every((q) => (S.quizzes[u] || []).includes(q)));
  };
  const taskInfo = (c, card, author, lead) => { const w = taskWho(c, card, author), dn = doneOf(w.map((x) => x.id), card.item || {}); const o = { n: dn.length, of: w.length }; if (lead) o.left = w.filter((x) => !dn.includes(x.id)).map((x) => x.name); return o; };
  const smart = (m, p) => {
    const x = J(m);
    if (x.kind !== "card" || !x.card || x.del) return x;
    const c = x.card;
    if (c.t === "shift" && c.st === "open" && c.from !== p.id) { const k = c.mode === "need" ? needCheck(c, p.id) : check(c, p.id); c.can = !!k.can; c.why = k.why || ""; }
    if (c.t === "task") Object.assign(c, taskInfo(chatOf(m.chat), c, m.emp, isLead(p)));
    if (c.t === "poll") c.votes = (S.votes[m.id] || []).map((v) => ({ o: v.o, emp: v.emp, name: v.name }));
    return x;
  };
  const item = (x, kinds) => {
    if (!x || typeof x !== "object" || !kinds.includes(x.kind) || !ID_RE.test(String(x.id || "")) || !cut(x.title, 120)) return null;
    const o = { kind: x.kind, id: String(x.id), title: cut(x.title, 120) };
    if (cut(x.sub, 140)) o.sub = cut(x.sub, 140);
    if (/^[0-9]{1,3}$/.test(String(x.mins == null ? "" : x.mins))) o.mins = Number(x.mins);
    if (/^https:\/\/[^\s"<>]+$/.test(String(x.img || "")) && String(x.img).length <= 600) o.img = x.img;
    if (x.kind === "module" && Array.isArray(x.lessons)) o.lessons = x.lessons.map(String).filter((v) => ID_RE.test(v)).slice(0, 80);
    if (x.kind === "module" && Array.isArray(x.quizzes)) o.quizzes = x.quizzes.map(String).filter((v) => ID_RE.test(v)).slice(0, 80);
    return o;
  };
  const cardMsg = (c, p, card, extra = {}) => put(c, p, cardSummary(card), { kind: "card", card, ...extra });
  const shiftCard = (s, iso, k) => { const sh = def(k); return { date: iso, k, label: sh.name, time: hh(sh.from) + "–" + hh(sh.to), pos: SPOS[s.pos][0], posKey: s.pos }; };

  // ── вход и главные экраны ──
  const stateOf = (p) => ({ ok: true, v: 2, quiz: (S.quizzes[p.id] || []).slice(), lessons: (S.progress[p.id] || []).slice(), stars: {}, roles: [], last_role: "seasonal" });

  function rpc(fn, b) {
    b = b || {};
    const p = PEOPLE.find((e) => e.id === TOK[b.p_token]) || null;
    if (fn === "whoami") return p ? { ok: true, employee: clone(p) } : { ok: false, error: "auth" };
    if (fn === "my_state") return p ? stateOf(p) : { ok: false, error: "auth" };
    if (fn === "my_reset_at") return { ok: true, reset_at: null };
    if (fn === "cms_list_lessons") return [];
    if (fn === "team_scores") return { ok: true, rows: [] };
    if (fn === "team_profiles") return { ok: true, rows: [], scope: "all" };
    if (fn === "my_mentors") return { ok: true, rows: [] };
    if (fn === "qday_inbox") return { ok: true, items: [] };
    if (fn === "menu_progress_team") return { ok: true, rows: [] };
    if (fn === "case_list") return { ok: true, lead: isLead(p), team: 0, fresh: 0, inbox: 0, mine_new: 0, top: null };
    if (fn === "menu_get") return clone(S.menu);
    if (fn === "menu_set") {
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      let ds = b.p_dishes; try { if (typeof ds === "string") ds = JSON.parse(ds); } catch (e) { ds = null; }
      if (!Array.isArray(ds)) return { ok: false, error: "bad_request" };
      S.menu = ds; return { ok: true };
    }
    if (fn === "schedule_load") { const mk = b.p_month || TODAY.slice(0, 7); return { ok: true, venues: [{ venue_key: "main", config: clone(CFG) }], months: [{ venue_key: "main", payload: clone(monOf(mk + "-01")) }] }; }
    if (fn === "schedule_save_month") {
      if (!isLead(p) && !(p && ["senior_bartender"].includes(p.position))) return { ok: false, error: "forbidden" };
      let pl = null; try { pl = typeof b.p_payload === "string" ? JSON.parse(b.p_payload) : b.p_payload; } catch (e) {}
      if (!pl) return { ok: false, error: "bad_request" };
      S.months[b.p_month] = pl; S.saved.push({ month: b.p_month, at: now() }); return { ok: true };
    }
    if (fn === "schedule_wishes_get") return { ok: true, wishes: clone(S.wishes[b.p_month] || []) };
    if (fn === "schedule_wish_set") {
      if (!p) return { ok: false, error: "auth" };
      const mk = String(b.p_month || ""), list = (S.wishes[mk] = (S.wishes[mk] || []).filter((w) => !(String(w.staff_id) === String(b.p_staff_id) && w.day === Number(b.p_day))));
      if (b.p_on) list.push({ staff_id: b.p_staff_id, day: Number(b.p_day), kind: b.p_kind === "hard" ? "hard" : "off" });
      return { ok: true };
    }
    if (fn === "swap_list") return { ok: true, swaps: [] };
    if (fn === "brief_today") return { ok: true, brief: S.brief && S.brief.data && S.brief.data.day === TODAY ? clone(S.brief) : null };
    if (fn === "brief_reads") return { ok: true, brief: null, rows: [], n: 0 };
    if (fn === "brief_publish") {
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      const again = !!(S.brief && S.brief.data && S.brief.data.day === TODAY);
      S.brief = { data: b.p_data, author: full(p), mine: true, sent: 0, at: now() };
      return { ok: true, again, sent: 0, bot: false };
    }
    // ── v99 (этап 39): вход через Telegram, отметки «Опаздываю» в графике, календарь, «Сервер» ──
    if (fn === "tg_login" || fn === "tg_auth_bind" || fn === "tg_auth_off") {
      const init = String(b.p_init_data || ""), um = /(?:^|&)user=([^&]*)/.exec(init);
      let tgId = ""; try { tgId = um ? String(JSON.parse(decodeURIComponent(um[1])).id || "") : ""; } catch (e) { tgId = ""; }
      if (!tgId || !/(?:^|&)hash=/.test(init)) return { ok: false, error: "bad_init" };
      if (fn === "tg_login") {
        const a = S.tgAuth[tgId] || (opts.tgKnown && opts.tgKnown[tgId] ? { emp: opts.tgKnown[tgId], off: false } : null);
        const e = a && !a.off ? who(a.emp) : null;
        if (!e) return { ok: false, error: "not_linked" };
        const tok = Object.keys(TOK).find((k) => TOK[k] === e.id);
        return tok ? { ok: true, token: tok, employee: clone(e), via: "telegram" } : { ok: false, error: "not_linked" };
      }
      if (!p) return { ok: false, error: "auth" };
      if (fn === "tg_auth_bind") { S.tgAuth[tgId] = { emp: p.id, off: false }; return { ok: true }; }
      if (S.tgAuth[tgId] && S.tgAuth[tgId].emp === p.id) S.tgAuth[tgId].off = true; else S.tgAuth[tgId] = { emp: p.id, off: true };
      return { ok: true };
    }
    if (fn === "late_month") {
      if (!p) return { ok: false, error: "auth" };
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(b.p_month || ""))) return { ok: false, error: "bad_request" };
      const rows = Object.values(S.late).filter((l) => l.rest === p.restaurant && l.day.slice(0, 7) === b.p_month && (isLead(p) || l.emp === p.id))
        .sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : x.name.localeCompare(y.name, "ru")))
        .map((l) => { const st = staffOf(l.emp); return { emp: l.emp, name: l.name, ...(st ? { sid: String(st.id) } : {}), day: Number(l.day.slice(8)), min: l.min, eta: l.eta, ...(l.note ? { note: l.note } : {}), ...(l.ok ? { ok: l.ok } : {}) }; });
      return { ok: true, rows };
    }
    if (fn === "cal_key") {
      if (!p) return { ok: false, error: "auth" };
      if (b.p_reset) delete S.cal[p.id];
      const k = S.cal[p.id] || (S.cal[p.id] = { k: hex32(), used: null });
      const sh = empShifts(p, 0, 13);
      return { ok: true, key: k.k, used: k.used, schedule: sh !== null, next: (sh || []).slice(0, 3) };
    }
    if (fn === "cal_feed") {
      const id = Object.keys(S.cal).find((x) => S.cal[x].k === String(b.p_key || "")), e = id ? who(id) : null;
      if (!e) return { ok: false, error: "key" };
      if (!b.p_page) S.cal[id].used = now();   // страница «Подписаться» — ещё не календарь
      return { ok: true, id: e.id, name: full(e), rest: e.restaurant, tz: "Europe/Moscow", schedule: true, shifts: empShifts(e, -31, 62) || [], app: S.srv.app };
    }
    if (fn === "server_check" || fn === "owner_tg_setup") {
      if (!p) return { ok: false, error: "auth" };
      if (!p.is_admin) return { ok: false, error: "forbidden" };
      if (fn === "owner_tg_setup") {
        if (/^https:\/\/[^\s"<>?#]{4,190}$/.test(String(b.p_app || "")) && !S.srv.app) S.srv.app = String(b.p_app).replace(/\/+$/, "");
        S.srv.code = hex32().slice(0, 12);
        return { ok: true, code: S.srv.code, app: S.srv.app };
      }
      return { ok: true, fns: Array.isArray(b.p_fns) ? b.p_fns.slice() : [], buckets: Array.isArray(b.p_buckets) ? b.p_buckets.slice() : [],
        cron: [{ name: "sa-nudges", on: true }, { name: "sa-qday", on: true }, { name: "sa-warmup-reminders", on: true }, { name: "sa-morning", on: true }], pg_net: true,
        tg: { bot: true, name: "akademiya_demo_bot", hook: !!S.srv.hook, last: S.srv.last, linked: 5, auth: Object.values(S.tgAuth).filter((a) => !a.off).length + 2 },
        app: S.srv.app, staff: PEOPLE.length, tz: "Europe/Moscow", now: now() };
    }
    // ── v106 (этап 40): «Утро руководителя» и вчерашние чек-листы для него ──
    if (fn === "morning_brief") {
      if (!p) return { ok: false, error: "auth" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      return { ...morningOf(p), prefs: morningPrefs(p) };
    }
    if (fn === "morning_set") {
      if (!p) return { ok: false, error: "auth" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      if (b.p_hour != null && !(Number(b.p_hour) >= 6 && Number(b.p_hour) <= 12)) return { ok: false, error: "hour" };
      const cur = S.morning[p.id] || { on: true, hour: 9 };
      S.morning[p.id] = { on: b.p_on == null ? cur.on : !!b.p_on, hour: b.p_hour == null ? cur.hour : Math.round(Number(b.p_hour)) };
      return { ok: true, prefs: morningPrefs(p) };
    }
    if (fn === "morning_send_now") {
      if (!p) return { ok: false, error: "auth" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      if (!S.tgLinked.includes(p.id)) return { ok: false, error: "not_linked" };
      if (clock() - (S.morningNow[p.id] || 0) < 60000) return { ok: false, error: "too_fast" };
      S.morningNow[p.id] = clock();
      const mb = morningOf(p);
      ping(p.id, morningText(mb, p.name), null, null, null, { kind: "morning", kb: morningKb(mb) });
      return { ok: true, sent: true };
    }
    if (fn === "morning_nudge") {
      if (!p) return { ok: false, error: "auth" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      const e = who(String(b.p_emp || ""));
      if (!e || e.restaurant !== p.restaurant || e.id === p.id) return { ok: false, error: "not_found" };
      if (!S.tgLinked.includes(e.id)) return { ok: false, error: "no_tg" };
      const k = e.id + "|" + TODAY;
      if (S.nudged[k]) return { ok: false, error: "already" };
      S.nudged[k] = full(p);
      ping(e.id, nm(full(p)) + " напоминает про разминку: 2 минуты, три ситуации из зала.", null);
      return { ok: true, sent: true };
    }
    if (fn === "checklist_get") {
      if (!p) return { ok: false, error: "auth" };
      const day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.p_day || "")) ? b.p_day : TODAY;
      return { ok: true, templates: {}, today: clone(S.cl[day] || {}) };
    }
    if (fn === "checklist_check") {
      if (!p) return { ok: false, error: "auth" };
      const day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.p_day || "")) ? b.p_day : TODAY, kind = String(b.p_kind || "");
      if (!["open", "preshift", "close"].includes(kind)) return { ok: false, error: "bad_request" };
      const checked = Array.isArray(b.p_checked) ? b.p_checked.map(String).slice(0, 40) : [];
      const done = checked.length > 0 && checked.length >= (Number(b.p_total) || 0);
      const cur = (S.cl[day] = S.cl[day] || {})[kind] || {};
      S.cl[day][kind] = { checked, done_at: done ? cur.done_at || now() : null, by_name: done ? cur.by_name || nm(full(p)) : null };
      return { ok: true, done_at: S.cl[day][kind].done_at };
    }
    if (!/^chat_/.test(fn)) return { code: "PGRST202", message: "demo: " + fn };
    S.log.push({ fn, at: now() }); if (S.log.length > 200) S.log.splice(0, S.log.length - 200);
    if (!p) return { ok: false, error: "auth" };
    if (fn === "chat_list") {
      const list = S.chats.filter((c) => visible(c, p) && (c.kind !== "dm" || S.msgs.some((m) => m.chat === c.id && !m.del))).map((c) => view(c, p));
      const ord = { team: 0, leads: 1, net: 2, group: 3, dm: 4 };
      list.sort((x, y) => ord[x.kind] - ord[y.kind]);
      return { ok: true, me: { id: p.id, name: full(p), pos: p.position, lead: isLead(p), network: !!p.is_admin || p.position === "senior", restaurant: p.restaurant }, chats: list,
        unread: list.reduce((s, c) => s + c.unread, 0), calls: calls(p) };
    }
    if (fn === "chat_unread") return { ok: true, unread: S.chats.filter((c) => visible(c, p)).reduce((s, c) => s + unread(c, p), 0), calls: calls(p) };
    if (fn === "chat_open") {
      const c = chatOf(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
      let list = S.msgs.filter((m) => m.chat === c.id), more = false;
      if (b.p_before) { list = list.filter((m) => m.id < b.p_before && !m.del); more = list.length > 40; list = list.slice(-40); }
      else if (b.p_after) list = list.filter((m) => m.id > b.p_after || (b.p_since && Date.parse(m.upd) >= Date.parse(b.p_since) - 5000));
      else { list = list.filter((m) => !m.del); more = list.length > 60; list = list.slice(-60); }
      const pin = c.pin ? msgOf(c.pin) : null;
      seenNow(c, p.id);
      return { ok: true, chat: view(c, p), msgs: list.map((m) => smart(m, p)), members: members(c).map((e) => ({ id: e.id, name: full(e), pos: e.position, rest: e.restaurant, read: rd(c, e.id) })), more,
        pin: c.kind !== "dm" && pin && !pin.del ? J(pin) : null, now: now() };
    }
    if (fn === "chat_read") { const c = chatOf(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" }; setRead(c, p.id, Math.min(Number(b.p_last) || 0, S.seq)); seenNow(c, p.id); return { ok: true }; }
    if (fn === "chat_send" || fn === "chat_photo_send") {
      const c = chatOf(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
      const q = b.p_reply ? msgOf(b.p_reply) : null;
      const body = String(b.p_body || "").trim().slice(0, 1000);
      if (fn === "chat_send" && !body) return { ok: false, error: "bad_request" };
      const extra = { reply: q && q.chat === c.id && !q.del ? q.id : null };
      if (fn === "chat_photo_send") {
        if (!b.p_full || !b.p_thumb || !(b.p_w > 0) || !(b.p_h > 0)) return { ok: false, error: "bad_request" };
        const pid = ++S.pseq; S.photos[pid] = { full: b.p_full, thumb: b.p_thumb, w: b.p_w, h: b.p_h };
        Object.assign(extra, { kind: "photo", photo: { id: pid, w: b.p_w, h: b.p_h } });
      }
      return { ok: true, msg: J(put(c, p, body, extra)) };
    }
    if (fn === "chat_photo") { const ph = S.photos[b.p_id]; return ph ? { ok: true, data: b.p_full ? ph.full : ph.thumb, mime: "image/jpeg", w: ph.w, h: ph.h } : { ok: false, error: "not_found" }; }
    if (fn === "chat_react") {
      const m = msgOf(b.p_msg); if (!m || m.del || !visible(chatOf(m.chat), p)) return { ok: false, error: "not_found" };
      m.reacts = m.reacts.filter((x) => x.emp !== p.id); if (b.p_r) m.reacts.push({ r: b.p_r, emp: p.id, name: full(p) }); touch(m); return { ok: true, msg: smart(m, p) };
    }
    if (fn === "chat_people") return { ok: true, people: PEOPLE.filter((e) => e.id !== p.id && e.restaurant === p.restaurant).map((e) => ({ id: e.id, name: full(e), pos: e.position, shift: !!personToday(e) })) };
    if (fn === "chat_dm") {
      const peer = who(String(b.p_emp)); if (!peer || peer.id === p.id || peer.restaurant !== p.restaurant) return { ok: false, error: "not_found" };
      let c = S.chats.find((x) => x.kind === "dm" && x.members.includes(p.id) && x.members.includes(peer.id));
      if (!c) { c = { id: Math.max(...S.chats.map((x) => x.id)) + 1, kind: "dm", rest: p.restaurant, members: [p.id, peer.id], pin: null }; S.chats.push(c); }
      return { ok: true, chat: view(c, p) };
    }
    if (fn === "chat_delete") {
      const m = msgOf(b.p_msg); if (!m) return { ok: false, error: "not_found" };
      const mc = chatOf(m.chat);
      if (m.emp !== p.id && !(mc.kind === "net" ? !!p.is_admin || p.position === "senior" : mc.kind !== "dm" && isLead(p))) return { ok: false, error: "forbidden" };
      if (m.kind === "card" && m.card && m.card.t === "shift" && m.card.st === "open") m.card.st = "off";
      m.del = true; m.body = ""; m.photo = null; m.reacts = []; touch(m); S.chats.forEach((c) => { if (c.pin === m.id) c.pin = null; });
      return { ok: true };
    }
    if (fn === "chat_edit") {
      const m = msgOf(b.p_msg); if (!m || m.del || m.emp !== p.id || m.kind !== "text") return { ok: false, error: "not_found" };
      const body = String(b.p_body || "").trim().slice(0, 1000); if (!body) return { ok: false, error: "bad_request" };
      m.body = body; m.edited = true; m.ment = mentionsOf(chatOf(m.chat), p, body); touch(m); return { ok: true, msg: smart(m, p) };
    }
    if (fn === "chat_pin") {
      const c = chatOf(b.p_chat); if (!visible(c, p) || c.kind === "dm") return { ok: false, error: "not_found" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      c.pin = b.p_msg ? Number(b.p_msg) : null; return { ok: true, pin: c.pin ? J(msgOf(c.pin)) : null };
    }
    if (fn === "chat_call") {
      const c = chatOf(b.p_chat); if (!visible(c, p) || c.kind !== "team") return { ok: false, error: "not_found" };
      const k = { who: b.p_who || "waiter", why: b.p_why || "help", table: cut(b.p_table, 8), text: cut(b.p_text, 80), emp: b.p_emp || null, going: [] };
      return { ok: true, msg: J(put(c, p, "", { kind: "call", call: k })) };
    }
    if (fn === "chat_go") {
      const m = msgOf(b.p_msg); if (!m || m.kind !== "call") return { ok: false, error: "not_found" };
      m.call.going = [...(m.call.going || []).filter((x) => x.emp !== p.id), { emp: p.id, name: full(p), at: now() }]; touch(m); return { ok: true, msg: J(m) };
    }
    // ── смены ──
    const shiftMsg = () => { const m = msgOf(b.p_msg); return m && !m.del && m.kind === "card" && m.card.t === "shift" && visible(chatOf(m.chat), p) ? m : null; };
    if (fn === "chat_shift_mine") {
      const s = staffOf(p.id), out = [];
      if (s) for (let i = 0; i <= 31; i++) {
        const iso = D(i), sh = def(code(String(s.id), iso));
        if (!sh || S.msgs.some((m) => m.emp === p.id && m.kind === "card" && !m.del && m.card.t === "shift" && m.card.st === "open" && m.card.date === iso)) continue;
        out.push({ date: iso, venue: "main", k: sh.k, label: sh.name, time: hh(sh.from) + "–" + hh(sh.to), pos: SPOS[s.pos][0] });
      }
      return { ok: true, shifts: out, schedule: true };
    }
    if (fn === "chat_shift_offer") {
      const c = chatOf(b.p_chat); if (!c || c.kind === "net" || !visible(c, p)) return { ok: false, error: "not_found" };
      if (!["give", "swap"].includes(b.p_mode)) return { ok: false, error: "bad_request" };
      const s = staffOf(p.id); if (!s) return { ok: false, error: "not_in_schedule" };
      const k = code(String(s.id), b.p_date), sh = def(k); if (!sh) return { ok: false, error: "no_shift" };
      if (S.msgs.some((m) => m.emp === p.id && m.kind === "card" && !m.del && m.card.t === "shift" && m.card.st === "open" && m.card.date === b.p_date)) return { ok: false, error: "already" };
      const want = b.p_mode === "swap" ? [...new Set((b.p_want || []).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= TODAY && x !== b.p_date))].sort().slice(0, 14) : [];
      const card = { t: "shift", mode: b.p_mode, ...shiftCard(s, b.p_date, k), from: p.id, fromName: full(p), sid: String(s.id), want, note: cut(b.p_note, 120), st: "open" };
      return { ok: true, msg: smart(cardMsg(c, p, card), p) };
    }
    if (fn === "chat_shift_need") {
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      const c = b.p_chat == null ? teamOf(p.restaurant) : chatOf(b.p_chat);
      if (!c || !["team", "group"].includes(c.kind) || !visible(c, p)) return { ok: false, error: "not_found" };
      const dt = String(b.p_date || ""), pos = String(b.p_pos || ""), sh = def(b.p_k);
      let n = Number(b.p_n) || 1;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dt) || dt < TODAY || dt > D(45) || !/^[a-z_]{2,20}$/.test(pos) || n < 1 || n > 5) return { ok: false, error: "bad_request" };
      if (!sh) return { ok: false, error: "no_shift" };
      let inst = null;
      if (b.p_instead != null) {
        const row = SSTAFF.find((s) => String(s.id) === String(b.p_instead));
        if (!row || row.pos !== pos || code(String(row.id), dt) !== b.p_k) return { ok: false, error: "bad_request" };
        inst = { sid: String(row.id), name: row.name.split(" ").reverse().join(" ") }; n = 1;
      }
      if (S.msgs.some((m) => m.chat === c.id && m.kind === "card" && !m.del && m.card.t === "shift" && m.card.mode === "need" && m.card.st === "open" && m.card.date === dt
        && m.card.posKey === pos && m.card.k === b.p_k && ((m.card.instead && m.card.instead.sid) || null) === (inst ? inst.sid : null))) return { ok: false, error: "already" };
      const card = { t: "shift", mode: "need", date: dt, k: b.p_k, label: sh.name, time: hh(sh.from) + "–" + hh(sh.to), pos: SPOS[pos] ? SPOS[pos][0] : pos, posKey: pos, n,
        from: p.id, fromName: full(p), ...(cut(b.p_note, 120) ? { note: cut(b.p_note, 120) } : {}), st: "open", ...(inst ? { instead: inst } : {}), took: [] };
      return { ok: true, msg: smart(cardMsg(c, p, card), p) };
    }
    if (fn === "chat_shift_take" || fn === "chat_shift_swap") {
      const m = shiftMsg(); if (!m) return { ok: false, error: "not_found" };
      if (m.card.st !== "open") return { ok: false, error: "taken", msg: smart(m, p) };
      const swap = fn === "chat_shift_swap";
      if (swap ? m.card.mode !== "swap" : !["give", "need"].includes(m.card.mode)) return { ok: false, error: "bad_request" };
      if (m.card.from === p.id) return { ok: false, error: "bad_request" };
      if (m.card.mode === "need") {
        const v = needCheck(m.card, p.id);
        if (!v.can) return { ok: false, error: "not_allowed", why: v.why || "", msg: smart(m, p) };
        const first = !(m.card.took || []).length;
        apply([{ date: m.card.date, sid: String(v.ts.id), k: m.card.k }, ...(first && m.card.instead ? [{ date: m.card.date, sid: String(m.card.instead.sid), k: null }] : [])]);
        m.card.took = [...(m.card.took || []), { id: p.id, name: full(p), sid: String(v.ts.id), at: now() }];
        if (m.card.took.length >= (m.card.n || 1)) Object.assign(m.card, { st: "done", by: p.id, byName: full(p), at: now() });
        touch(m); done(chatOf(m.chat), m, p);
        return { ok: true, msg: smart(m, p) };
      }
      const v = check(m.card, p.id);
      if (!swap) {
        if (!v.can) return { ok: false, error: "not_allowed", why: v.why || "" };
        apply([{ date: m.card.date, sid: String(v.gs.id), k: null }, { date: m.card.date, sid: String(v.ts.id), k: m.card.k }]);
        Object.assign(m.card, { st: "done", by: p.id, byName: full(p), at: now() });
      } else {
        const o = options(m.card, p.id), opt = o.shifts.find((x) => x.date === b.p_date);
        if (!opt) return { ok: false, error: "not_allowed", why: o.why || "Эта смена не подходит для обмена" };
        apply([{ date: m.card.date, sid: String(v.gs.id), k: null }, { date: m.card.date, sid: String(v.ts.id), k: m.card.k }, { date: b.p_date, sid: String(v.ts.id), k: null }, { date: b.p_date, sid: String(v.gs.id), k: opt.k }]);
        Object.assign(m.card, { st: "done", by: p.id, byName: full(p), byDate: b.p_date, byK: opt.k, byLabel: opt.label, at: now() });
      }
      touch(m); done(chatOf(m.chat), m, p);
      return { ok: true, msg: smart(m, p) };
    }
    if (fn === "chat_shift_options") {
      const m = shiftMsg(); if (!m) return { ok: false, error: "not_found" };
      if (m.card.mode !== "swap" || m.card.st !== "open" || m.card.from === p.id) return { ok: false, error: "bad_request" };
      return { ok: true, ...options(m.card, p.id) };
    }
    if (fn === "chat_shift_cancel") {
      const m = shiftMsg(); if (!m) return { ok: false, error: "not_found" };
      if (m.card.from !== p.id) return { ok: false, error: "forbidden" };
      if (m.card.st !== "open") return { ok: false, error: "taken", msg: smart(m, p) };
      m.card.st = "off"; m.card.at = now(); touch(m); return { ok: true, msg: smart(m, p) };
    }
    // v97: заявки на месяц для «Графика»: открытые, с сегодняшнего дня, в чатах заведения, где я есть
    if (fn === "chat_shift_board") {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(b.p_month || ""))) return { ok: false, error: "bad_request" };
      const offers = S.msgs.filter((m) => !m.del && m.kind === "card" && m.card.t === "shift" && m.card.st === "open" && m.card.date.slice(0, 7) === b.p_month && m.card.date >= TODAY
        && ["team", "group"].includes((chatOf(m.chat) || {}).kind) && visible(chatOf(m.chat), p))
        .sort((x, y) => (x.card.date < y.card.date ? -1 : x.card.date > y.card.date ? 1 : x.id - y.id))
        .map((m) => ({ msg: m.id, chat: m.chat, mine: m.card.from === p.id, card: smart(m, p).card }));
      return { ok: true, offers };
    }
    // v97: карточка коллеги (нажатие на имя): должность, смена сегодня и ближайшая (две недели), есть ли личная
    if (fn === "chat_person") {
      const e = who(String(b.p_emp));
      if (!e || !(e.restaurant === p.restaurant || (isLead(p) && isLead(e)))) return { ok: false, error: "not_found" };
      const t = personToday(e), nx = personNext(e);
      const dm = S.chats.find((x) => x.kind === "dm" && x.members.includes(p.id) && x.members.includes(e.id));
      return { ok: true, person: { id: e.id, name: full(e), pos: e.position, rest: e.restaurant, me: e.id === p.id, same: e.restaurant === p.restaurant, today: t, next: t ? null : nx, dm: dm ? dm.id : null } };
    }
    // v97: стоп из Меню — карточка в «Вся команда»; «Вернуть» отмечает все открытые карточки этого блюда
    if (fn === "chat_stop_note") {
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      const c = teamOf(p.restaurant); if (!c) return { ok: false, error: "not_found" };
      const id = String(b.p_dish || ""); if (!id) return { ok: false, error: "bad_request" };
      if (b.p_on) {
        const d = S.menu.find((x) => x && String(x.id) === id && x.kind !== "cocktail"); if (!d) return { ok: false, error: "not_found" };
        const was = [...S.msgs].reverse().find((m) => m.chat === c.id && !m.del && m.kind === "card" && m.card.t === "stop" && m.card.st === "on" && m.card.dish.id === id);
        if (was) return { ok: true, again: true, msg: smart(was, p) };
        return { ok: true, msg: smart(cardMsg(c, p, { t: "stop", st: "on", from: "menu", dish: { id, name: cut(d.name, 120) } }), p) };
      }
      let last = null, n = 0;
      S.msgs.filter((m) => m.rest === p.restaurant && !m.del && m.kind === "card" && m.card.t === "stop" && m.card.st === "on" && m.card.dish.id === id).forEach((m) => {
        Object.assign(m.card, { st: "off", offBy: full(p), offAt: now() }); m.body = cardSummary(m.card); touch(m); last = m; n++; });
      return { ok: true, n, msg: last ? smart(last, p) : null };
    }
    // ── задание, поделиться, опрос, брифинг, «График готов» (p_chat null — «Вся команда») ──
    if (fn === "chat_card_send") {
      const c = b.p_chat == null ? teamOf(p.restaurant) : chatOf(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
      const pc = b.p_card || {}, t = pc.t;
      let card;
      if (t === "task") {
        if (!isLead(p)) return { ok: false, error: "forbidden" };
        if (c.kind === "net") return { ok: false, error: "bad_request" };
        const it = item(pc.item, ["lesson", "quiz", "module"]);
        if (!it || (pc.due != null && !(/^\d{4}-\d{2}-\d{2}$/.test(pc.due) && pc.due >= TODAY && pc.due <= D(60)))) return { ok: false, error: "bad_request" };
        card = { t: "task", item: it, ...(pc.due ? { due: pc.due } : {}), to: "all" };
      } else if (t === "share") {
        const it = item(pc.item, c.kind === "net" ? ["lesson", "quiz", "module", "ref"] : ["dish", "cocktail", "ref", "lesson", "quiz", "module"]);
        if (!it) return { ok: false, error: "bad_request" };
        card = { t: "share", item: it, ...(cut(pc.note, 200) ? { note: cut(pc.note, 200) } : {}) };
      } else if (t === "poll") {
        if (c.kind === "dm") return { ok: false, error: "bad_request" };
        const q = cut(pc.q, 200), op = (Array.isArray(pc.opts) ? pc.opts : []).map((o) => cut(o, 60)).filter(Boolean);
        if (q.length < 3 || op.length < 2 || op.length > 6 || new Set(op.map((o) => o.toLowerCase())).size !== op.length) return { ok: false, error: "bad_request" };
        card = { t: "poll", q, opts: op };
      } else if (t === "brief") {
        if (!isLead(p)) return { ok: false, error: "forbidden" };
        if (c.kind !== "team") return { ok: false, error: "bad_request" };
        const lines = (Array.isArray(pc.lines) ? pc.lines : []).map((l) => cut(l, 140)).filter(Boolean);
        if (!lines.length) return { ok: false, error: "bad_request" };
        card = { t: "brief", date: TODAY, title: cut(pc.title, 80) || "Брифинг смены", lines: lines.slice(0, 8) };
        const was = [...S.msgs].reverse().find((m) => m.chat === c.id && !m.del && m.kind === "card" && m.card.t === "brief" && m.card.date === TODAY);
        if (was) { was.card = card; was.body = cardSummary(card); was.emp = p.id; was.name = full(p); touch(was); return { ok: true, again: true, msg: smart(was, p) }; }
      } else if (t === "sched") {
        if (!isLead(p)) return { ok: false, error: "forbidden" };
        if (c.kind !== "team") return { ok: false, error: "bad_request" };
        const mk = String(pc.month || ""), cur = TODAY.slice(0, 7), max = addD(TODAY.slice(0, 7) + "-01", 100).slice(0, 7);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mk) || mk < cur || mk > max) return { ok: false, error: "bad_request" };
        if (pc.what === "wishes") {
          const u = String(pc.until || "");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(u) || u < TODAY || u > D(62)) return { ok: false, error: "bad_request" };
          card = { t: "sched", what: "wishes", month: mk, until: u };
        } else card = { t: "sched", what: "ready", month: mk };
      } else return { ok: false, error: "bad_request" };
      return { ok: true, msg: smart(cardMsg(c, p, card), p) };
    }
    if (fn === "chat_task_remind") {
      const m = msgOf(b.p_msg); if (!m || m.del || m.kind !== "card" || m.card.t !== "task" || !visible(chatOf(m.chat), p)) return { ok: false, error: "not_found" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      if (m.card.reminded && clock() - Date.parse(m.card.reminded) < 3 * 3600e3) return { ok: false, error: "too_fast" };
      const w = taskWho(chatOf(m.chat), m.card, m.emp), dn = doneOf(w.map((x) => x.id), m.card.item), left = w.filter((x) => !dn.includes(x.id));
      m.card.reminded = now(); touch(m);
      return { ok: true, n: left.length, sent: left.filter((x) => S.tg.includes(x.id)).length, msg: smart(m, p) };
    }
    if (fn === "chat_poll_vote") {
      const m = msgOf(b.p_msg); if (!m || m.del || m.kind !== "card" || m.card.t !== "poll" || !visible(chatOf(m.chat), p)) return { ok: false, error: "not_found" };
      if (!(b.p_o >= 0 && b.p_o < m.card.opts.length)) return { ok: false, error: "bad_request" };
      const vs = S.votes[m.id] || [], was = vs.find((x) => x.emp === p.id);
      S.votes[m.id] = was && was.o === b.p_o ? vs.filter((x) => x.emp !== p.id) : [...vs.filter((x) => x.emp !== p.id), { o: b.p_o, emp: p.id, name: full(p), at: now() }];
      touch(m); return { ok: true, msg: smart(m, p) };
    }
    if (fn === "chat_stop_set") {
      const c = chatOf(b.p_chat); if (!c || !["team", "leads", "group"].includes(c.kind) || !visible(c, p)) return { ok: false, error: "not_found" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      const ms = clock();
      let m = null;
      if (!b.p_on) { m = msgOf(b.p_msg); if (!m || m.chat !== c.id || m.del || m.kind !== "card" || m.card.t !== "stop") return { ok: false, error: "not_found" }; if (m.card.st === "off") return { ok: true, msg: smart(m, p) }; }
      const id = b.p_on ? b.p_dish : m.card.dish.id, d = S.menu.find((x) => x && String(x.id) === String(id) && x.kind !== "cocktail" && !x.archived);
      if (b.p_on) {
        if (!d) return { ok: false, error: "not_found" };
        if (!d.stop || typeof d.stop !== "object") { d.stop = { since: ms, by: full(p) }; d.stopAt = ms; }
        return { ok: true, msg: smart(cardMsg(c, p, { t: "stop", st: "on", dish: { id: String(d.id), name: cut(d.name, 120) } }), p) };
      }
      if (d && d.stop) { d.stop = null; d.stopAt = ms; }
      Object.assign(m.card, { st: "off", offBy: full(p), offAt: now() }); m.body = cardSummary(m.card); touch(m);
      return { ok: true, msg: smart(m, p) };
    }
    // ── v99: поиск по переписке, «Опаздываю» и «Принято» ──
    if (fn === "chat_search") {
      const q = String(b.p_q || "").replace(/\s+/g, " ").trim();
      if (q.length < 2 || q.length > 80) return { ok: false, error: "bad_request" };
      const ids = S.chats.filter((c) => visible(c, p) && (b.p_chat == null || c.id === Number(b.p_chat))).map((c) => c.id), qq = lowE(q);
      const found = S.msgs.filter((m) => ids.includes(m.chat) && !m.del && ["text", "photo", "card", "ai"].includes(m.kind) && lowE(m.body).includes(qq)).sort((x, y) => y.id - x.id).slice(0, 50);
      return { ok: true, q, msgs: found.map(J), more: found.length >= 50 };
    }
    if (fn === "chat_late") {
      const c = b.p_chat == null ? teamOf(p.restaurant) : chatOf(b.p_chat);
      if (!c || !visible(c, p) || !["team", "group"].includes(c.kind) || c.rest !== p.restaurant) return { ok: false, error: "not_found" };
      const min = Number(b.p_min);
      if (!(min >= 5 && min <= 240)) return { ok: false, error: "bad_request" };
      if (S.msgs.some((m) => m.emp === p.id && m.kind === "card" && !m.del && m.card && m.card.t === "late" && clock() - Date.parse(m.at) < 180000)) return { ok: false, error: "too_fast" };
      const t = new Date(clock()), cur = t.getHours() * 60 + t.getMinutes(), st = staffOf(p.id), sh = st ? def(code(String(st.id), TODAY)) : null;
      const eta = hhmm(Math.max(sh ? sh.from * 60 : 0, cur) + min), note = cut(b.p_note, 80);
      const card = { t: "late", min, eta, day: TODAY, ...(sh ? { from: hh(sh.from), label: sh.name.toLowerCase() } : {}), ...(note ? { note } : {}) };
      const m = put(c, p, "Опаздываю на " + lateMinText(min) + ": буду в " + eta + (note ? ". " + note : ""), { kind: "card", card });
      S.late[p.id + "|" + TODAY] = { emp: p.id, name: full(p), rest: p.restaurant, day: TODAY, min, eta, note: note || null, msg: m.id, ok: null };
      // руководители и старшие этого чата, кто сегодня в графике; никого из них в графике — все
      const leads = members(c).filter((e) => e.id !== p.id && isLead(e)), onl = leads.filter((e) => personToday(e)), to = onl.length ? onl : leads;
      const txt = nm(full(p)) + " опаздывает на " + lateMinText(min) + ": будет в " + eta + (sh ? " (смена с " + hh(sh.from) + ")" : "") + "." + (note ? "\n«" + note + "»" : "");
      let sent = 0;
      to.forEach((e) => { if (pingK(c, e.id, txt, [{ text: "Принято", late: m.id }], m.id)) sent++; });
      return { ok: true, msg: smart(m, p), sent, leads: to.length };
    }
    if (fn === "chat_late_ok") {
      const m = msgOf(b.p_msg), c = m ? chatOf(m.chat) : null;
      if (!m || m.del || m.kind !== "card" || !m.card || m.card.t !== "late" || !visible(c, p)) return { ok: false, error: "not_found" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      if (m.card.ok) return { ok: true, again: true, msg: smart(m, p) };
      m.card.ok = { id: p.id, name: full(p), at: now() }; touch(m);
      const l = S.late[m.emp + "|" + m.card.day]; if (l && l.msg === m.id) l.ok = full(p);
      if (m.emp !== p.id) pingK(c, m.emp, nm(full(p)) + ": принято, ждём к " + (m.card.eta || "") + ".", null, m.id);
      return { ok: true, msg: smart(m, p) };
    }
    if (fn === "chat_ai_post") return { ok: false, error: "no_ai" };
    return { code: "PGRST202", message: "demo: " + fn };
  }

  // ── v106 (этап 40): «Утро руководителя» — сводка, как _sa_morning_at на сервере ──
  const MO_POS = ["manager", "host", "call", "bar", "barback", "waiter", "runner"];
  const MO_HOL = ["01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07", "01-08", "02-23", "03-08", "05-01", "05-09", "06-12", "11-04"];
  const MO_NEED = { 1: { manager: 1, host: 1, call: 1, bar: 1, barback: 1, waiter: 6, runner: 1 }, 2: { manager: 1, host: 1, call: 1, bar: 1, barback: 1, waiter: 6, runner: 2 },
    3: { manager: 1, host: 1, call: 1, bar: 2, barback: 1, waiter: 6, runner: 2 } };
  const moCfg = () => ({ ...CFG, rules: { peakDows: [4, 5], highDows: [3, 6], holidayPeak: true, ...((CFG && CFG.rules) || {}) }, need: { ...MO_NEED, ...((CFG && CFG.need) || {}) } });
  function moLvl(cfg, iso) {
    const r = cfg.rules, n = (l, ps) => Number((cfg.need[l] || {})[ps]) || 0;
    const lv = r.levels === 2 || r.levels === 3 ? r.levels : MO_POS.some((ps) => n(2, ps) !== n(1, ps) && n(2, ps) !== n(3, ps)) ? 3 : 2;
    const o = (monOf(iso).days || {})[dayN(iso)];
    if (o && [1, 2, 3].includes(Number(o.lvl))) return Number(o.lvl) === 2 && lv === 2 ? 3 : Number(o.lvl);
    if (MO_HOL.includes(iso.slice(5)) && r.holidayPeak) return 3;
    const w = (dowOf(iso) + 6) % 7;
    if ((r.peakDows || []).includes(w)) return 3;
    if (lv === 3 && (r.highDows || []).includes(w)) return 2;
    return 1;
  }
  const moStaff = (mk) => SSTAFF.filter((s) => (!s.till || mk <= s.till) && (!s.since || mk >= s.since));
  function moHoles(cfg, iso) {
    const mo = monOf(iso), dn = dayN(iso);
    if (!Object.values(mo.plan || {}).some((row) => row && row[dn])) return [];   // день ещё не расписан
    const need = cfg.need[moLvl(cfg, iso)] || {};
    const out = [];
    for (const ps of MO_POS) {
      const n = Number(need[ps]) || 0; if (n <= 0) continue;
      const have = moStaff(iso.slice(0, 7)).filter((s) => s.pos === ps && (() => { const sh = def(code(String(s.id), iso)); return sh && !sh.extra; })()).length;
      if (have < n) out.push({ pos: ps, miss: n - have });
    }
    return out;
  }
  const moEmp = (s) => PEOPLE.find((e) => e.restaurant === R0 && toks(full(e)) === toks(s.name)) || null;
  const moLast = (id) => { const days = S.learn[id] || []; return days.length ? [...days].sort().pop() : null; };
  const dDiff = (a, b) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400e3);
  const onShift = (iso) => moStaff(iso.slice(0, 7)).filter((s) => def(code(String(s.id), iso))).map(moEmp).filter(Boolean).map((e) => e.id);
  function morningOf(p) {
    const cfg = moCfg(), Y = D(-1), lateOf = Object.values(S.late).filter((l) => l.rest === p.restaurant && l.day === TODAY).sort((x, y) => (x.at < y.at ? -1 : 1));
    const shifts = [...SH].sort((x, y) => x.from - y.from || (x.k < y.k ? -1 : 1)).map((sh) => ({ k: sh.k, name: sh.name, from: sh.from, to: sh.to,
      people: moStaff(TODAY.slice(0, 7)).filter((s) => code(String(s.id), TODAY) === sh.k)
        .sort((a, b) => (MO_POS.indexOf(a.pos) + 1 || 99) - (MO_POS.indexOf(b.pos) + 1 || 99) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((s) => { const e = moEmp(s), l = e && lateOf.find((x) => x.emp === e.id); return { id: e ? e.id : null, n: nm(e ? full(e) : s.name), late: l ? { min: l.min, eta: l.eta } : null }; }) }))
      .filter((g) => g.people.length);
    const holes = [];
    for (let i = 0; i <= 6; i++) for (const h of moHoles(cfg, D(i))) holes.push({ ...h, day: D(i) });
    const open = S.msgs.filter((m) => m.kind === "card" && !m.del && m.card && m.card.t === "shift" && m.card.st === "open" && ["give", "swap", "need"].includes(m.card.mode)
      && m.card.date >= TODAY && m.card.date <= D(6) && (chatOf(m.chat) || {}).rest === p.restaurant)
      .sort((x, y) => (x.card.date < y.card.date ? -1 : x.card.date > y.card.date ? 1 : x.id - y.id))
      .map((m) => ({ id: m.id, chat: m.chat, mode: m.card.mode, day: m.card.date, who: nm(m.card.fromName), pos: m.card.posKey || "",
        n: Math.max(1, (Number(m.card.n) || 0) - (Array.isArray(m.card.took) ? m.card.took.length : 0)) }));
    const stopAll = (S.menu || []).filter((d) => d && d.stop && typeof d.stop === "object" && !d.archived && String(d.name || "").trim()).map((d) => String(d.name).trim()).sort();
    const ty = (S.thanks || []).filter((t) => !t.hidden && t.day === Y);
    let thanks = null;
    if (ty.length) {
      const by = {}; ty.forEach((t) => { by[t.emp] = (by[t.emp] || 0) + 1; });
      const people = Object.entries(by).map(([id, k]) => ({ id, n: nm(full(who(id) || { name: "" })), k })).filter((x) => x.n).sort((a, b) => b.k - a.k || (a.n < b.n ? -1 : a.n > b.n ? 1 : 0));
      const len = (t) => String(t.text || "").trim().length;
      const q = [...ty].filter((t) => len(t) >= 12).sort((a, b) => (len(a) <= 160 ? 0 : 1) - (len(b) <= 160 ? 0 : 1) || len(b) - len(a) || (a.at < b.at ? 1 : -1))[0];
      const qt = q ? String(q.text).replace(/\s+/g, " ").trim() : "";
      thanks = { n: ty.length, people, quote: qt.length > 160 ? qt.slice(0, 159) + "…" : qt, by: q ? nm(full(who(q.emp) || { name: "" })) : "" };
    }
    const yon = onShift(Y);
    const yr = S.briefDays[Y];
    const yreads = yr ? yr.reads.filter((id) => !yon.length || yon.includes(id)).length : 0;
    const ybrief = yreads ? { reads: yreads, of: yon.length } : null;
    const learn = yon.length ? { done: yon.filter((id) => (S.learn[id] || []).includes(Y)).length, of: yon.length } : null;
    const week = [...new Set([0, 1, 2, 3, 4, 5, 6].flatMap((i) => onShift(D(i))))];
    const slow = week.map((id) => who(id)).filter((e) => e && !isLead(e)).map((e) => { const last = moLast(e.id); return { id: e.id, n: nm(full(e)), days: last ? dDiff(TODAY, last) : null }; })
      .filter((x) => x.days == null || x.days >= 6)
      .sort((a, b) => (a.days == null ? (b.days == null ? 0 : -1) : b.days == null ? 1 : b.days - a.days) || (a.n < b.n ? -1 : a.n > b.n ? 1 : 0));
    const today = S.brief && S.brief.data && S.brief.data.day === TODAY ? S.brief : null;
    return { ok: true, day: TODAY, rest: p.restaurant, sched: true, shifts, count: shifts.reduce((s, g) => s + g.people.length, 0), holes, open,
      stop: { n: stopAll.length, names: stopAll.slice(0, 8) }, thanks, ybrief, learn,
      idle: { list: slow.slice(0, 3).map((x) => ({ ...x, tg: S.tgLinked.includes(x.id) })), more: Math.max(0, slow.length - 3) },
      brief: today ? { done: true, at: hhmm((Date.parse(today.at) - Date.parse(TODAY + "T00:00:00")) / 60000) } : { done: false },
      late: lateOf.map((l) => ({ id: l.emp, n: nm(l.name), min: l.min, eta: l.eta })) };
  }
  const morningPrefs = (p) => { const m = S.morning[p.id] || { on: true, hour: 9 }; return { on: m.on, hour: m.hour, linked: S.tgLinked.includes(p.id), bot: true }; };
  // v99: смены человека по графику (как _sa_emp_shifts): со смещения from по to от сегодня
  function empShifts(e, from, to) {
    const st = staffOf(e.id); if (!st) return [];
    const out = [];
    for (let i = from; i <= to; i++) { const iso = D(i), k = code(String(st.id), iso), sh = def(k); if (sh) out.push({ date: iso, k, label: sh.name, from: sh.from, to: sh.to, time: hh(sh.from) + "–" + hh(sh.to), pos: SPOS[st.pos][0], sid: String(st.id) }); }
    return out;
  }
  // смена человека сегодня и ближайшая (для «Кто в смене» и карточки коллеги)
  function personToday(e) { const s = staffOf(e.id); const sh = s && def(code(String(s.id), TODAY)); return sh ? { label: sh.name, time: hh(sh.from) + "–" + hh(sh.to) } : null; }
  function personNext(e) { const s = staffOf(e.id); if (!s) return null; for (let i = 1; i <= 14; i++) { const iso = D(i), sh = def(code(String(s.id), iso)); if (sh) return { date: iso, label: sh.name, time: hh(sh.from) + "–" + hh(sh.to) }; } return null; }

  // ── то, что «делают коллеги» в демо: пишут, забирают смену, выходят по «Ищем в смену» ──
  const as = (id) => who(id);
  const bot = {
    say: (id, text, chatId = null) => { const e = as(id); const c = chatId != null ? chatOf(chatId) : teamOf(e.restaurant); return c && e ? J(put(c, e, text)) : null; },
    offer: (id, iso, mode = "give", note = "") => rpc("chat_shift_offer", { p_token: Object.keys(TOK).find((k) => TOK[k] === id), p_chat: teamOf(as(id).restaurant).id, p_date: iso, p_mode: mode, p_want: [], p_note: note }),
    need: (id, iso, pos, k, n = 1, instead = null) => rpc("chat_shift_need", { p_token: Object.keys(TOK).find((x) => TOK[x] === id), p_chat: null, p_date: iso, p_pos: pos, p_k: k, p_n: n, p_instead: instead }),
    take: (id, msg) => rpc("chat_shift_take", { p_token: Object.keys(TOK).find((k) => TOK[k] === id), p_msg: msg }),
    // кто из коллег (не я) может забрать или выйти по карточке
    taker: (m, notId) => PEOPLE.find((e) => e.id !== notId && e.id !== m.card.from && e.restaurant === R0 && (m.card.mode === "need" ? needCheck(m.card, e.id).can : check(m.card, e.id).can)) || null,
  };
  return { S, rpc, D, TODAY, bot, staffOf, code, monOf, msgOf, teamOf, chatOf, tokOf: (id) => Object.keys(TOK).find((k) => TOK[k] === id) || null };
}
