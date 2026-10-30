// e2e v98 (Доп. 411): клавиатура на iPhone без подскока и без обгона — по записи владельца с v96 (60 кадров в секунду).
// Что было на записи: после нажатия Telegram ~0,1 с ничего не рисует; строка ввода (ход считался с нажатия) в первом же
// кадре оказывалась почти наверху и ждала клавиатуру; через 0,12 с после сообщения Telegram о клавиатуре вырез снизу
// (полоска «домой») у приложения становился 0 — строка проседала на 16–20 px, а в конце хода подпрыгивала на 20 px; при
// закрытии строка убегала вниз раньше клавиатуры и посреди пути подскакивала на 10–12 px. Модель Telegram здесь та же:
// сообщение о высоте приходит после паузы, клавиатура поехала за 20 мс до него; пока клавиатура на экране,
// safeAreaInset.bottom = 0 (событие safeAreaChanged); окно сжимается и растёт «молча» (как в e2e-v95). Замер — после
// отрисовки кадра, время — метка кадра; замер, перед которым окно сменило размер уже после кадра, не в счёт.
// Разделы:
//   OPEN     — пауза 90 мс: до сообщения Telegram строка стоит; дальше в каждом кадре там же, где клавиатура (±10 %);
//              только вверх, ни кадра вниз; в конце без подскока; вырез снизу у приложения тот же (21 px); последнее
//              сообщение не отрывается от строки; окно сжалось молча — ни на кадр;
//   CLOSE    — фокус снят: клавиатура поехала сразу, окно выросло и Telegram сообщил через 33 мс — строка только вниз, не
//              обгоняет клавиатуру, без подскока, внизу; вырез снизу тот же; второй круг — так же;
//   QUICK    — фокус снят до сжатия окна (Telegram сообщил сразу) — вниз по кривой с первого кадра;
//   MISMATCH — Telegram сообщил высоту на 20 px меньше настоящей, окно сжалось по настоящей — строка доезжает
//              плавно (ни одного шага больше 8 px), только вверх, у клавиатуры;
//   MIDWAY   — окно сжалось посреди хода — строка дальше едет за клавиатурой, без прыжка;
//   SHEET    — лист «Опрос»: то же с паузой и вырезом;
//   AI       — Наставник: то же; лента уходит под шапку;
//   CALM     — «Уменьшить движение»: сразу на месте, ни кадра в промежуточном положении;
//   NARROW   — 320 px, обе темы: ничего не выезжает вбок, сообщения не отрываются.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v98.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5298, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v98";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { RESTAURANT_MENUS } = await import(SRC + "/data/menu.js");
const { cardSummary } = await import(SRC + "/lib/chat-smart.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

// ── дни: как в телефоне (Камчатка) ──
const TZ = "Asia/Kamchatka";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const D = (n) => addD(TODAY, n);
const dowOf = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const WD_S = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"], MON_S = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const dshort = (iso) => WD_S[dowOf(iso)] + " " + Number(iso.slice(8));
const dayN = (iso) => String(Number(iso.slice(8)));

const R0 = "Два моря, Океан";
const ANNA = { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const MARIA = { id: "u-lead", name: "Мария", surname: "Ким", restaurant: R0, position: "senior", is_admin: false };
const OLGA = { id: "u-host", name: "Ольга", surname: "Ли", restaurant: R0, position: "hostess", is_admin: false };
const PETR = { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: R0, position: "waiter", is_admin: false };
const ILYA = { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender", is_admin: false };
const VERA = { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: R0, position: "waiter", is_admin: false };
const IRINA = { id: "u-irina", name: "Ирина", surname: "Портова", restaurant: "Порт", position: "manager", is_admin: false };
const STAFF = [ANNA, MARIA, OLGA, PETR, ILYA, VERA, IRINA, { id: "e-ivan", name: "Иван", surname: "Петров", restaurant: "Порт", position: "waiter" }];
const TOK = { "tok-anna": ANNA, "tok-maria": MARIA, "tok-olga": OLGA, "tok-petr": PETR, "tok-ilya": ILYA, "tok-vera": VERA, "tok-irina": IRINA };
const ukOf = (p) => "_" + p.name + "_" + p.surname;
const full = (p) => p.name + " " + p.surname;
const LEADS = ["manager", "senior", "owner", "admin", "service_manager", "head"];
const isLead = (p) => !!p.is_admin || LEADS.includes(p.position);
const clone = (x) => JSON.parse(JSON.stringify(x));
const MENU = clone(RESTAURANT_MENUS[R0]);

// ── график заведения (этап 9): смены, люди, план по дням ──
const SHIFTS = [{ k: "У", name: "Утро", from: 10, to: 18 }, { k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }];
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Ли Ольга", pos: "host", norm: 160 }, { id: 3, name: "Смирнова Анна", pos: "waiter", norm: 160 },
  { id: 4, name: "Орлов Пётр", pos: "waiter", norm: 160 }, { id: 5, name: "Белов Илья", pos: "bar", norm: 160 }, { id: 6, name: "Соколова Вера", pos: "waiter", norm: 160 }];
const CFG = { shifts: SHIFTS, staff: SSTAFF, rules: { minRest: 11, maxRow: 5 } };
// Вера: сегодня, завтра, +3, +6; Анна: +2, +5; Пётр: +4; Мария: сегодня, завтра; Ольга и Илья: завтра
const BASE = { 6: { 0: "В", 1: "В", 3: "Д", 6: "В" }, 3: { 2: "Д", 5: "Д" }, 4: { 4: "Д" }, 1: { 0: "Д", 1: "Д" }, 2: { 1: "Д" }, 5: { 1: "В" } };
const SPOS = { manager: ["менеджер", "менеджеры"], host: ["хостес", "хостес"], bar: ["бар", "бармены"], waiter: ["официант", "официанты"] };
const toks = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").split(/\s+/).filter(Boolean).sort().join(" ");
const nm = (s) => { const w = String(s || "").trim().split(/\s+/); return w[1] ? w[0] + " " + w[1][0] + "." : w[0] || ""; };
const hh = (v) => String(v > 24 ? v - 24 : v).padStart(2, "0") + ":00";

// ── сервер чата в памяти: те же ответы, что у этапа 38 (v92 — свои чаты; v93 — умный чат) ──
function chatServer() {
  const S = { chats: [{ id: 1, kind: "team", rest: R0, pin: null }, { id: 2, kind: "leads", rest: R0, pin: null }, { id: 3, kind: "net", rest: "", pin: null }, { id: 4, kind: "team", rest: "Порт", pin: null }],
    msgs: [], reads: {}, photos: {}, seq: 100, pseq: 500, log: [], votes: {}, progress: {}, quizzes: {}, tg: new Set(), menu: clone(MENU), aiExtra: 0, months: {}, saved: [] };
  for (const [sid, row] of Object.entries(BASE)) for (const [n, k] of Object.entries(row)) { const iso = D(Number(n)); const mo = monOf(S, iso); (mo.plan[sid] = mo.plan[sid] || {})[dayN(iso)] = k; }
  const now = () => new Date().toISOString();
  const visible = (c, p) => !!c && (c.kind === "net" ? isLead(p) : c.kind === "dm" || c.kind === "group" ? c.members.includes(p.id) && (c.kind === "dm" || c.rest === p.restaurant)
    : c.rest === p.restaurant && (c.kind === "team" || isLead(p)));
  const members = (c) => STAFF.filter((e) => (c.kind === "net" ? isLead(e) : c.kind === "dm" || c.kind === "group" ? c.members.includes(e.id) : e.restaurant === c.rest && (c.kind === "team" || isLead(e))));
  const rd = (c, e) => ((S.reads[c.id] || {})[e] || 0);
  const setRead = (c, e, v) => { S.reads[c.id] = S.reads[c.id] || {}; S.reads[c.id][e] = Math.max(rd(c, e), v); };
  const msgOf = (id) => S.msgs.find((m) => m.id === Number(id));
  const quote = (q) => (q ? { id: q.id, emp: q.emp, name: q.name, kind: q.kind, body: q.del ? "" : q.body, photo: q.kind === "photo", del: q.del } : null);
  const J = (m) => ({ id: m.id, chat: m.chat, emp: m.emp, name: m.name, rest: m.rest, body: m.del ? "" : m.body, kind: m.kind, call: m.kind === "call" && !m.del ? m.call : null,
    photo: m.kind === "photo" && !m.del ? m.photo : null, reply: m.reply && !m.del ? quote(msgOf(m.reply)) : null, reacts: m.del ? [] : m.reacts.map((x) => ({ ...x })),
    at: m.at, edited: !!m.edited && !m.del, del: m.del, card: ["card", "ai", "sys"].includes(m.kind) && !m.del && m.card ? clone(m.card) : null });
  const put = (c, p, body, extra = {}) => { const t = now(); const m = { id: ++S.seq, chat: c.id, emp: p.id, name: full(p), rest: p.restaurant, body, kind: "text", call: null, photo: null, reply: null, reacts: [], edited: false, del: false, at: t, upd: t, ...extra }; S.msgs.push(m); setRead(c, p.id, m.id); return m; };
  const touch = (m) => { m.upd = now(); };
  const unread = (c, p) => S.msgs.filter((m) => m.chat === c.id && !m.del && m.emp !== p.id && m.id > rd(c, p.id)).length;
  const callFor = (m, p) => m.kind === "call" && !m.del && m.emp !== p.id && (m.call.who === "person" ? m.call.emp === p.id : m.call.who === "lead" ? isLead(p) : ({ host: ["hostess"], bar: ["bartender"], waiter: ["waiter"] }[m.call.who] || []).includes(p.position));
  const calls = (p) => S.msgs.filter((m) => callFor(m, p) && !(m.call.going || []).length && Date.now() - Date.parse(m.at) < 600000).map(J);
  const view = (c, p) => {
    const last = [...S.msgs].reverse().find((m) => m.chat === c.id && !m.del);
    const peer = c.kind === "dm" ? STAFF.find((e) => e.id === c.members.find((x) => x !== p.id)) : null;
    return { id: c.id, kind: c.kind, members: members(c).length, shift: c.kind === "team" || c.kind === "leads" ? 3 : null, peer: peer ? { id: peer.id, name: full(peer), pos: peer.position, shift: true } : null,
      last: last ? J(last) : null, unread: unread(c, p), cleared: c.cleared || null, title: c.kind === "group" ? c.title : null, owner: c.kind === "group" ? c.owner : null };
  };
  const whyText = (k) => ({ who: { lead: "менеджера", host: "хостес", bar: "бар", waiter: "официанта" }[k.who] || (k.to_name || "").split(" ")[0], why: { table: "к столу " + (k.table || ""), help: "нужна помощь", come: "подойди ко мне", guest: "гость ждёт", own: k.text || "" }[k.why] });
  // ── v93: график — буква в клетке, почему нельзя, может ли взять, варианты обмена, запись ──
  const code = (sid, iso, over = {}) => { const key = iso + "|" + sid; if (key in over) return over[key] || ""; return ((monOf(S, iso).plan[sid] || {})[dayN(iso)]) || ""; };
  const def = (k) => SHIFTS.find((x) => k && x.k === k) || null;
  const staffOf = (empId) => { const e = STAFF.find((x) => x.id === empId); if (!e) return null; const t = toks(full(e)); return SSTAFF.find((s) => toks(s.name) === t) || null; };
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
  const apply = (list) => { for (const x of list) { const mo = monOf(S, x.date), d = dayN(x.date); mo.plan[x.sid] = { ...(mo.plan[x.sid] || {}) }; if (x.k) mo.plan[x.sid][d] = x.k; else delete mo.plan[x.sid][d]; mo.locks[x.sid] = { ...(mo.locks[x.sid] || {}), [d]: true }; } };
  const shLine = (c) => (c.mode === "swap" ? "Обмен сменами: " + nm(c.fromName) + " (" + dshort(c.date) + ") и " + nm(c.byName) + " (" + dshort(c.byDate) + ") · график обновлён"
    : "Передача смены " + dshort(c.date) + ", " + String(c.label).toLowerCase() + ": отдаёт " + nm(c.fromName) + ", забирает " + nm(c.byName) + " · график обновлён");
  const done = (c, m, p) => { const lc = S.chats.find((x) => x.rest === c.rest && x.kind === "leads"); if (lc && lc.id !== c.id) put(lc, p, shLine(m.card), { kind: "sys", card: { t: "log", mode: m.card.mode } }); };
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
    if (c.t === "shift" && c.st === "open" && c.from !== p.id) { const k = check(c, p.id); c.can = !!k.can; c.why = k.why || ""; }
    if (c.t === "task") Object.assign(c, taskInfo(S.chats.find((y) => y.id === m.chat), c, m.emp, isLead(p)));
    if (c.t === "poll") c.votes = (S.votes[m.id] || []).map((v) => ({ o: v.o, emp: v.emp, name: v.name }));
    return x;
  };
  const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
  const cut = (s, n) => { const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
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
  const rpc = (fn, b) => {
    if (fn === "menu_get") return clone(S.menu);
    if (fn === "schedule_load") { const mk = b.p_month || TODAY.slice(0, 7); return { ok: true, venues: [{ venue_key: "main", config: clone(CFG) }], months: [{ venue_key: "main", payload: clone(monOf(S, mk + "-01")) }] }; }
    if (fn === "schedule_save_month") { let pl = null; try { pl = JSON.parse(b.p_payload); } catch (e) {} if (!pl) return { ok: false, error: "bad_request" }; S.months[b.p_month] = pl; S.saved.push({ month: b.p_month, payload: clone(pl) }); return { ok: true }; }
    if (fn === "schedule_wishes_get") return { ok: true, wishes: [] };
    if (fn === "swap_list") return { ok: true, swaps: [] };
    if (!/^chat_/.test(fn)) return undefined;
    S.log.push({ fn, b });
    const p = TOK[b.p_token];
    if (!p) return { ok: false, error: "auth" };
    const chat = (id) => S.chats.find((c) => c.id === Number(id));
    if (fn === "chat_list") {
      const list = S.chats.filter((c) => visible(c, p) && (c.kind !== "dm" || S.msgs.some((m) => m.chat === c.id && !m.del))).map((c) => view(c, p));
      list.sort((x, y) => ({ team: 0, leads: 1, net: 2, group: 3, dm: 4 })[x.kind] - ({ team: 0, leads: 1, net: 2, group: 3, dm: 4 })[y.kind]);
      return { ok: true, me: { id: p.id, name: full(p), pos: p.position, lead: isLead(p), network: !!p.is_admin || p.position === "senior", restaurant: p.restaurant }, chats: list,
        unread: list.reduce((s, c) => s + c.unread, 0), calls: calls(p) };
    }
    if (fn === "chat_unread") return { ok: true, unread: S.chats.filter((c) => visible(c, p)).reduce((s, c) => s + unread(c, p), 0), calls: calls(p) };
    if (fn === "chat_open") {
      const c = chat(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
      let list = S.msgs.filter((m) => m.chat === c.id), more = false;
      if (b.p_before) { list = list.filter((m) => m.id < b.p_before && !m.del); more = list.length > 40; list = list.slice(-40); }
      else if (b.p_after) list = list.filter((m) => m.id > b.p_after || (b.p_since && Date.parse(m.upd) >= Date.parse(b.p_since) - 5000));
      else { list = list.filter((m) => !m.del); more = list.length > 60; list = list.slice(-60); }
      const pin = c.pin ? msgOf(c.pin) : null;
      return { ok: true, chat: view(c, p), msgs: list.map((m) => smart(m, p)), members: members(c).map((e) => ({ id: e.id, name: full(e), pos: e.position, rest: e.restaurant, read: rd(c, e.id) })), more,
        pin: c.kind !== "dm" && pin && !pin.del ? J(pin) : null, now: now() };
    }
    if (fn === "chat_read") { const c = chat(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" }; setRead(c, p.id, Math.min(Number(b.p_last) || 0, S.seq)); return { ok: true }; }
    if (fn === "chat_send" || fn === "chat_photo_send") {
      const c = chat(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
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
    if (fn === "chat_react") {
      const m = msgOf(b.p_msg); if (!m || m.del || !visible(chat(m.chat), p)) return { ok: false, error: "not_found" };
      m.reacts = m.reacts.filter((x) => x.emp !== p.id); if (b.p_r) m.reacts.push({ r: b.p_r, emp: p.id, name: full(p) }); touch(m); return { ok: true, msg: smart(m, p) };
    }
    if (fn === "chat_people") return { ok: true, people: STAFF.filter((e) => e.id !== p.id && e.restaurant === p.restaurant).map((e) => ({ id: e.id, name: full(e), pos: e.position, shift: e.id !== "e-petr" })) };
    if (fn === "chat_delete") {
      const m = msgOf(b.p_msg); if (!m) return { ok: false, error: "not_found" };
      const mc = chat(m.chat);
      if (m.emp !== p.id && !(mc.kind === "net" ? !!p.is_admin || p.position === "senior" : mc.kind !== "dm" && isLead(p))) return { ok: false, error: "forbidden" };
      if (m.kind === "card" && m.card && m.card.t === "shift" && m.card.st === "open") m.card.st = "off";
      m.del = true; m.body = ""; m.photo = null; m.reacts = []; touch(m); S.chats.forEach((c) => { if (c.pin === m.id) c.pin = null; });
      return { ok: true };
    }
    // ── v93: смены ──
    const shiftMsg = () => { const m = msgOf(b.p_msg); return m && !m.del && m.kind === "card" && m.card.t === "shift" && visible(chat(m.chat), p) ? m : null; };
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
      const c = chat(b.p_chat); if (!c || c.kind === "net" || !visible(c, p)) return { ok: false, error: "not_found" };
      if (!["give", "swap"].includes(b.p_mode)) return { ok: false, error: "bad_request" };
      const s = staffOf(p.id); if (!s) return { ok: false, error: "not_in_schedule" };
      const k = code(String(s.id), b.p_date), sh = def(k); if (!sh) return { ok: false, error: "no_shift" };
      if (S.msgs.some((m) => m.emp === p.id && m.kind === "card" && !m.del && m.card.t === "shift" && m.card.st === "open" && m.card.date === b.p_date)) return { ok: false, error: "already" };
      const want = b.p_mode === "swap" ? [...new Set((b.p_want || []).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= TODAY && x !== b.p_date))].sort().slice(0, 14) : [];
      const card = { t: "shift", mode: b.p_mode, date: b.p_date, k, label: sh.name, time: hh(sh.from) + "–" + hh(sh.to), pos: SPOS[s.pos][0], posKey: s.pos, from: p.id, fromName: full(p), sid: String(s.id), want, note: cut(b.p_note, 120), st: "open" };
      return { ok: true, msg: smart(cardMsg(c, p, card), p) };
    }
    if (fn === "chat_shift_take" || fn === "chat_shift_swap") {
      const m = shiftMsg(); if (!m) return { ok: false, error: "not_found" };
      if (m.card.st !== "open") return { ok: false, error: "taken", msg: smart(m, p) };
      const swap = fn === "chat_shift_swap";
      if (m.card.mode !== (swap ? "swap" : "give") || m.card.from === p.id) return { ok: false, error: "bad_request" };
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
      touch(m); done(chat(m.chat), m, p);
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
    // ── задание, поделиться, опрос, брифинг ──
    if (fn === "chat_card_send") {
      const c = chat(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
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
        const q = cut(pc.q, 200), opts = (Array.isArray(pc.opts) ? pc.opts : []).map((o) => cut(o, 60)).filter(Boolean);
        if (q.length < 3 || opts.length < 2 || opts.length > 6 || new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return { ok: false, error: "bad_request" };
        card = { t: "poll", q, opts };
      } else if (t === "brief") {
        if (!isLead(p)) return { ok: false, error: "forbidden" };
        if (c.kind !== "team") return { ok: false, error: "bad_request" };
        const lines = (Array.isArray(pc.lines) ? pc.lines : []).map((l) => cut(l, 140)).filter(Boolean);
        if (!lines.length) return { ok: false, error: "bad_request" };
        card = { t: "brief", date: TODAY, title: cut(pc.title, 80) || "Брифинг смены", lines: lines.slice(0, 8) };
      } else return { ok: false, error: "bad_request" };
      return { ok: true, msg: smart(cardMsg(c, p, card), p) };
    }
    if (fn === "chat_task_remind") {
      const m = msgOf(b.p_msg); if (!m || m.del || m.kind !== "card" || m.card.t !== "task" || !visible(chat(m.chat), p)) return { ok: false, error: "not_found" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      if (m.card.reminded && Date.now() - Date.parse(m.card.reminded) < 3 * 3600e3) return { ok: false, error: "too_fast" };
      const w = taskWho(chat(m.chat), m.card, m.emp), dn = doneOf(w.map((x) => x.id), m.card.item), left = w.filter((x) => !dn.includes(x.id));
      m.card.reminded = now(); touch(m);
      return { ok: true, n: left.length, sent: left.filter((x) => S.tg.has(x.id)).length, msg: smart(m, p) };
    }
    if (fn === "chat_poll_vote") {
      const m = msgOf(b.p_msg); if (!m || m.del || m.kind !== "card" || m.card.t !== "poll" || !visible(chat(m.chat), p)) return { ok: false, error: "not_found" };
      if (!(b.p_o >= 0 && b.p_o < m.card.opts.length)) return { ok: false, error: "bad_request" };
      const vs = S.votes[m.id] || [], was = vs.find((x) => x.emp === p.id);
      S.votes[m.id] = was && was.o === b.p_o ? vs.filter((x) => x.emp !== p.id) : [...vs.filter((x) => x.emp !== p.id), { o: b.p_o, emp: p.id, name: full(p), at: now() }];
      touch(m); return { ok: true, msg: smart(m, p) };
    }
    // ── стоп-лист: блюдо меню заведения ──
    if (fn === "chat_stop_set") {
      const c = chat(b.p_chat); if (!c || !["team", "leads", "group"].includes(c.kind) || !visible(c, p)) return { ok: false, error: "not_found" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      const ms = Date.now();
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
    // ── Наставник в переписке ──
    if (fn === "chat_ai_post") {
      const c = chat(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
      const q = msgOf(b.p_reply), low = String(q ? q.body : "").toLowerCase();
      if (!q || q.chat !== c.id || q.del || q.kind !== "text" || q.emp !== p.id || Date.now() - Date.parse(q.at) > 600000
        || !(/(^|[^а-яёa-z0-9_])@наставник([^а-яёa-z0-9_]|$)/.test(low) || /^\s*наставник\s*[,:]/.test(low))) return { ok: false, error: "bad_request" };
      if (S.msgs.some((y) => y.chat === c.id && y.kind === "ai" && y.reply === q.id)) return { ok: false, error: "already" };
      const used = S.msgs.filter((y) => y.kind === "ai" && y.rest === p.restaurant).length + S.aiExtra;
      if (used >= 30) return { ok: false, error: "ai_limit" };
      if (b.p_body == null) return { ok: true, check: true, left: 30 - used };
      const body = String(b.p_body).trim().slice(0, 2000); if (!body) return { ok: false, error: "bad_request" };
      const cards = (Array.isArray(b.p_cards) ? b.p_cards : []).slice(0, 3).map((x) => item(x, ["dish", "cocktail", "ref", "lesson", "quiz", "module"])).filter(Boolean);
      const m = put(c, { id: "ai", name: "Наставник", surname: "", restaurant: p.restaurant }, body, { kind: "ai", reply: q.id, card: { t: "ai", cards } });
      m.name = "Наставник";
      return { ok: true, msg: smart(m, p) };
    }
    return { ok: false, error: "bad_request" };
  };
  // утро: Мария написала команде
  put(S.chats[0], MARIA, "Доброе утро! Сегодня банкет на 12 человек в 19:00 на веранде.");
  return { S, rpc, D };
}
function monOf(S, iso) { const mk = iso.slice(0, 7); return S.months[mk] || (S.months[mk] = { plan: {}, locks: {}, days: {}, facts: {} }); }

const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra && !cond ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ who = ANNA, token = "tok-anna", rpcs = () => undefined, calls = [], light = false, w = 393, h = 852, path = "/", seedExtra = {}, ai = null, lessons = [], brief = null, init = null, motion = "reduce" } = {}) {
  const UK = ukOf(who);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: TZ, reducedMotion: motion });
  if (init) await ctx.addInitScript(init);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN }).catch(() => {});
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\/ai-chat/.test(u) && ai) { calls.push({ fn: "ai-chat", body, t: Date.now() }); const r = await ai(body); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r) }); }
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      calls.push({ fn: m[1], body, t: Date.now() });
      const own = rpcs(m[1], body);
      if (own !== undefined) return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own) });
      const mock = { whoami: { ok: true, employee: who }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons, stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] }, schedule_load: { ok: false, error: "auth" }, menu_get: [],
        qday_inbox: { ok: true, items: [] }, brief_today: { ok: true, brief }, brief_reads: { ok: true, brief: null }, case_list: { ok: true, lead: false, team: 0, fresh: 0, inbox: 0, mine_new: 0, top: null }, menu_progress_team: { ok: true, rows: [] } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: token, sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_menu_shared: JSON.stringify({ [R0]: MENU }), ...seedExtra };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1"; seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(ORIGIN + path, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors, calls };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const tc = async (loc) => ((await loc.count()) ? ((await loc.first().textContent()) || "").replace(/\s+/g, " ").trim() : "");
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const fits = (page, sel) => page.evaluate((sel) => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1) && !e.closest(".ch-ticks") && !e.closest(".ch-sugg"); }).map((e) => e.className || e.tagName); return { W, sw: document.documentElement.scrollWidth, over: over.length, what: over.slice(0, 3) }; }, sel);
const until = async (fn, ms = 9000, step = 250) => { const t0 = Date.now(); for (;;) { let v = false; try { v = await fn(); } catch (e) { v = false; } if (v || Date.now() - t0 > ms) return v; await sleep(step); } };
const openDock = async (page) => { await page.locator("[data-chat-dock]").click(); await sleep(900); };
// чат закрыт и круга нет (урок, Меню, Колода) — сначала на главную вкладку
const openChat = async (page, kind = "team") => {
  if (!(await page.locator("[data-chat]").count())) { if (!(await page.locator("[data-chat-dock]").count())) await nav(page, "roleSelect", 1200); await openDock(page); }
  await page.locator(`[data-chat-item="${kind}"]`).click(); await sleep(1300);
};
const card = (page, t) => page.locator(`[data-chat-card="${t}"]`).last();
const plus = async (page, act = null) => { await page.locator("[data-chat-attach]").click(); await sleep(450); if (act) { await page.locator(`[data-chat-act="${act}"]`).click(); await sleep(900); } };
const acts = (page) => page.locator("[data-chat-act]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chat-act")));
const toast = (page) => txt(page.locator("[data-chat-toast]"));
const chatGone = async (page) => !(await page.locator("[data-chat]").count());
const body = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
// приложение не на виду: открытая переписка не спрашивает новое (проверка «уже забрали»)
const freeze = (page) => page.evaluate(() => Object.defineProperty(document, "hidden", { configurable: true, get: () => true }));
const noErr = (...xs) => [ !xs.some((x) => x.errors.length), xs.flatMap((x) => x.errors).slice(0, 3).join(" | ") ];
// раздел упал — записать и идти дальше (снимок — для разбора)
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String(e && e.message || e).split("\n")[0].slice(0, 200)); } };



const H = 852;
const box = (loc) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; });
const pad = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("[data-chat]")).paddingBottom));
// клавиатура на K: окно сжалось само (shrink) и/или видимая часть короче (vvLess) — как сообщает телефон
const keyboard = async (page, { h = H, w = 393, shrink = 0, vvLess = 0 }) => {
  await page.evaluate((h0) => { Object.defineProperty(window, "innerHeight", { configurable: true, get: () => h0 }); }, h);
  if (shrink) await page.setViewportSize({ width: w, height: h - shrink });
  await page.evaluate((less) => {
    const vv = window.visualViewport;
    const real = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(vv), "height");
    Object.defineProperty(vv, "height", { configurable: true, get: () => real.get.call(vv) - less });
    vv.dispatchEvent(new Event("resize"));
  }, vvLess);
  await sleep(700);
};
const unkeyboard = async (page, { h = H, w = 393 } = {}) => {
  await page.evaluate(() => { const vv = window.visualViewport; delete vv.height; document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.visualViewport.dispatchEvent(new Event("resize")));
  await sleep(700);
};
const toPeople = async (page) => { await openDock(page); await page.locator("[data-chat-write]").click(); await sleep(900); };


// ── Telegram на iPhone, по исходникам Telegram iOS (WebAppController.swift, WebAppWebView.swift) ──
// Клавиатура поехала: viewport_changed с высотой над ней (окно то же, WebKit о клавиатуре не знает). Через 0,4 с Telegram
// спрашивает, где поле ввода, и прокручивает к нему всю страницу, если поле ниже края клавиатуры (запас 44 px): так
// экран падал вниз и ехал обратно. Потом окно сжимается. Клавиатура уходит: окно растёт сразу, а visualViewport в WebKit
// ещё ~0,4 с прежний (строка ввода висела над пустым местом, запись владельца).
const TG_IOS = () => {
  const ev = {}; let vh = false; const nop = () => {};
  const WebApp = {
    platform: "ios", version: "8.0", initData: "", initDataUnsafe: {}, colorScheme: "dark", themeParams: {}, isExpanded: true, isFullscreen: true,
    safeAreaInset: { top: 0, bottom: 34, left: 0, right: 0 }, contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    get viewportHeight() { return vh === false ? window.innerHeight : vh; },
    get viewportStableHeight() { return vh === false ? window.innerHeight : vh; },
    onEvent(n, f) { (ev[n] = ev[n] || []).push(f); }, offEvent(n, f) { ev[n] = (ev[n] || []).filter((x) => x !== f); },
    ready: nop, expand: nop, close: nop, disableVerticalSwipes: nop, enableVerticalSwipes: nop, requestFullscreen: nop, exitFullscreen: nop, lockOrientation: nop,
    setHeaderColor: nop, setBackgroundColor: nop, setBottomBarColor: nop, isVersionAtLeast: () => true, openLink: nop, openTelegramLink: nop, downloadFile: nop,
    showAlert: (m, cb) => { if (cb) cb(); }, showConfirm: (m, cb) => { if (cb) cb(true); }, requestWriteAccess: (cb) => { if (cb) cb(false); },
    BackButton: { show: nop, hide: nop, onClick: nop, offClick: nop, isVisible: false },
    MainButton: { show: nop, hide: nop, setText: nop, onClick: nop, offClick: nop, setParams: nop },
    HapticFeedback: { impactOccurred: nop, notificationOccurred: nop, selectionChanged: nop },
  };
  window.Telegram = { WebApp };
  // v95: «молчащее» окно: эти слушатели встают первыми (до приложения) и, пока __muted, не пускают resize дальше
  const hush = (e) => { if (window.__muted) e.stopImmediatePropagation(); };
  window.addEventListener("resize", hush); window.addEventListener("resize", hush, true);
  if (window.visualViewport) { window.visualViewport.addEventListener("resize", hush); window.visualViewport.addEventListener("scroll", hush); }
  // v98: как Telegram на iPhone в полноэкранном режиме (запись владельца, v96): вырез снизу 21 px, а пока клавиатура на
  // экране — 0 (safeAreaChanged вместе с viewportChanged). __tgAt — когда пришло последнее сообщение (мс, performance.now)
  WebApp.safeAreaInset = { top: 0, bottom: 21, left: 0, right: 0 };
  window.__tgViewport = (h) => {
    vh = h; window.__tgAt = performance.now();
    const kbOn = h < (window.__H0 || 852) - 80;
    WebApp.safeAreaInset = { top: 0, bottom: kbOn ? 0 : 21, left: 0, right: 0 };
    (ev.viewportChanged || []).slice().forEach((f) => { try { f({ isStateStable: true }); } catch (e) { /* */ } });
    (ev.safeAreaChanged || []).slice().forEach((f) => { try { f(); } catch (e) { /* */ } });
  };
};
const KH = 336;   // клавиатура iPhone с подсказками
// фокус и клавиатура: ход поля по кадрам 400 мс, затем вопрос Telegram «где поле» (scrollToActiveElement)
const tgShow = (page, sel, frameH) => page.evaluate(({ sel, frameH }) => new Promise((res) => {
  const ta = document.querySelector(sel); ta.focus();
  window.__tgViewport(frameH);
  const out = [], t0 = performance.now();
  const f = () => {
    const r = ta.getBoundingClientRect(); out.push({ t: Math.round(performance.now() - t0), top: Math.round(r.top), bottom: Math.round(r.bottom) });
    if (performance.now() - t0 < 400) { requestAnimationFrame(f); return; }
    const a = document.activeElement, q = a.getBoundingClientRect(), y = q.top + window.scrollY, conv = y - window.scrollY;
    res({ out, at: Math.round(conv), scroll: conv < 0 || conv + 44 > frameH, by: Math.max(0, Math.round(y + 60 - frameH)) });
  };
  requestAnimationFrame(f);
}), { sel, frameH });
const rectNow = (page, sel) => page.evaluate((sel) => new Promise((res) => requestAnimationFrame(() => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); res({ top: Math.round(r.top), bottom: Math.round(r.bottom) }); })), sel);
const kbVar = (page, root) => page.evaluate((root) => { const e = document.querySelector(root); return e ? (parseFloat(getComputedStyle(e).paddingBottom) || 0) : -1; }, root);
// окно сжалось (через 0,4 с): поле на экране не двигается ни в первом кадре, ни дальше
// v95: окно меняется «молча», как на iPhone в Telegram (запись владельца): resize окна и visualViewport до хука не доходят
const mute = (page, on) => page.evaluate((on) => { window.__muted = !!on; window.__hushed = on ? 0 : window.__hushed; }, on);
const tgShrink = async (page, sel, frameH, w = 393, quiet = false) => {
  const b0 = await rectNow(page, sel);
  if (quiet) await mute(page, true);
  // замер — после отрисовки кадра (rAF → задача): то, что видит человек; в самом rAF ResizeObserver этого кадра ещё не сработал
  // v98: и высота окна в кадре (ih0): окно сжалось уже после кадра, до замера — замер показал бы раскладку, которой на
  // экране не было (ResizeObserver сработает в следующем кадре, до его отрисовки) — не в счёт (как в e2e-v95 с v97)
  await page.evaluate((sel) => { window.__trk = []; const t0 = performance.now(); const f = () => { const ih0 = window.innerHeight; setTimeout(() => { const r = document.querySelector(sel).getBoundingClientRect(); window.__trk.push({ t: Math.round(performance.now() - t0), bottom: Math.round(r.bottom), ih: window.innerHeight, ih0 }); }, 0); if (performance.now() - t0 < 500) requestAnimationFrame(f); }; requestAnimationFrame(f); }, sel);
  await page.setViewportSize({ width: w, height: frameH });
  await sleep(650);
  if (quiet) await mute(page, false);
  const trk = await page.evaluate(() => window.__trk);
  const after = trk.filter((x) => x.ih === frameH && x.ih0 === x.ih);
  return { b0, after: after.length, moved: Math.max(0, ...after.map((x) => Math.abs(x.bottom - b0.bottom))) };
};
// клавиатура уходит: фокус снят, окно растёт сразу, visualViewport в WebKit ещё 0,45 с прежний
const tgHide = async (page, sel, H0, w = 393, quiet = false) => {
  if (quiet) await mute(page, true);
  await page.evaluate(({ sel, kH }) => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const vv = window.visualViewport, real = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(vv), "height"), until = performance.now() + 450;
    Object.defineProperty(vv, "height", { configurable: true, get: () => (performance.now() < until ? kH : real.get.call(vv)) });
    setTimeout(() => { delete vv.height; vv.dispatchEvent(new Event("resize")); }, 470);
    window.__trk = []; const t0 = performance.now();
    const f = () => { setTimeout(() => { const e = document.querySelector(sel); const r = e ? e.getBoundingClientRect() : null; window.__trk.push({ t: Math.round(performance.now() - t0), bottom: r ? Math.round(r.bottom) : null, ih: window.innerHeight }); }, 0); if (performance.now() - t0 < 900) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }, { sel, kH: window_kH(H0) });
  // v95: «молча» — как на iPhone: Telegram сообщает высоту раньше, чем окно выросло, а resize не приходит
  if (quiet) { await page.evaluate((h) => window.__tgViewport(h), H0); await page.setViewportSize({ width: w, height: H0 }); }
  else { await page.setViewportSize({ width: w, height: H0 }); await page.evaluate((h) => window.__tgViewport(h), H0); }
  await sleep(1000);
  if (quiet) await mute(page, false);
  const trk = (await page.evaluate(() => window.__trk)).filter((x) => x.bottom != null);
  const i0 = trk.findIndex((x) => x.ih === H0), t0 = i0 >= 0 ? trk[i0].t : 0, aft = i0 >= 0 ? trk.slice(i0) : [];
  const fin = aft.length ? aft[aft.length - 1].bottom : null;
  let up = 0, step = 0; for (let i = 1; i < aft.length; i++) { up = Math.max(up, aft[i - 1].bottom - aft[i].bottom); step = Math.max(step, Math.abs(aft[i].bottom - aft[i - 1].bottom)); }
  // первый кадр после роста окна — тоже шаг: строка ввода не должна прыгнуть вниз разом
  if (i0 > 0) step = Math.max(step, Math.abs(trk[i0].bottom - trk[i0 - 1].bottom));
  const at300 = aft.find((x) => x.t - t0 >= 300);
  return { fin, up, step, at300: at300 ? at300.bottom : null, n: aft.length };
};
const window_kH = (H0) => H0 - KH;



// ── ход по кадрам (как в e2e-v96): bt — верх строки ввода (или листа), gb — низ последнего сообщения ──
const { KB_OPEN, KB_CLOSE, kbCurve } = await import(SRC + "/ui/keyboard.js");
const LAG = 20;   // клавиатура поехала за столько мс до сообщения Telegram (модель)
const startTrack = (page, { act = "", ms = 600, bar = ".ch-bar", root = "[data-chat]", glue = "[data-chat-msg]", tgAt = 90, kh = KH, h = H, off = 0, input = "[data-chat-input]" } = {}) =>
  page.evaluate(({ act, ms, bar, root, glue, tgAt, kh, h, off, input }) => {
    const out = []; window.__trk = out; window.__trkDone = false; window.__H0 = h;
    const t0 = performance.now(); window.__t0 = t0; window.__tgRel = null;
    const q = (s) => document.querySelector(s);
    const rr = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10 }; };
    const f = (ts) => {
      const ft = Math.round(ts - t0), ih0 = window.innerHeight;
      setTimeout(() => {
        const b = q(bar), rt = q(root), gs = glue ? document.querySelectorAll(glue) : [], g = window.__glueEl || (gs.length ? gs[gs.length - 1] : null);
        const br = rr(b), gr = rr(g);
        out.push({ t: Math.round(performance.now() - t0), ft, bt: br && br.top, bb: br && br.bottom, gb: gr && gr.bottom, gt: gr && gr.top,
          pad: rt ? parseFloat(getComputedStyle(rt).paddingBottom) || 0 : null, sb: getComputedStyle(document.documentElement).getPropertyValue("--sa-sb").trim(),
          ih: window.innerHeight, ih0, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth });
      }, 0);
      if (performance.now() - t0 < ms) requestAnimationFrame(f); else setTimeout(() => { window.__trkDone = true; }, 40);
    };
    requestAnimationFrame(f);
    const tgSend = (hh) => { window.__tgViewport(hh); window.__tgRel = Math.round(window.__tgAt - t0); };
    if (act === "open") { q(input).focus(); setTimeout(() => tgSend(h - kh + off), tgAt); }
    if (act === "blur") { const a = document.activeElement; if (a && a.blur) a.blur(); }
    if (act === "blur-tg") { const a = document.activeElement; if (a && a.blur) a.blur(); setTimeout(() => tgSend(h), tgAt); }
  }, { act, ms, bar, root, glue, tgAt, kh, h, off, input });
const endTrack = async (page) => {
  await until(() => page.evaluate(() => window.__trkDone), 5000, 50);
  return page.evaluate(() => ({ s: window.__trk.filter((x) => x.bb != null && x.ih === x.ih0), tg: window.__tgRel }));
};
const steps = (s) => { const st = []; for (let i = 1; i < s.length; i++) st.push(s[i].bt - s[i - 1].bt); return st; };
const oneWay = (st, dir) => st.every((d) => (dir < 0 ? d <= 0.6 : d >= -0.6));
const glued = (s) => { const g = s.filter((x) => x.gb != null).map((x) => x.bt - x.gb); return g.length ? Math.round((Math.max(...g) - Math.min(...g)) * 10) / 10 : 0; };
const pct = (x, from, trav) => Math.round(Math.abs(x.bt - from) / trav * 100);
const seq = (s) => JSON.stringify(s.map((x) => [x.ft, Math.round(x.bt)]));
const fill = async (C, n) => { for (let i = 1; i <= n; i++) C.rpc("chat_send", { p_token: "tok-anna", p_chat: 1, p_body: "Сообщение " + i + ": банкет на веранде, столы 5 и 6 сдвигаем к окну" }); };
const sbNow = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sa-sb").trim());
// окно растёт «молча» через wait мс после начала замера, Telegram сообщает высоту в тот же миг
const growQuiet = async (page, wait, h = H, w = 393) => { await sleep(wait); await mute(page, true); await page.evaluate((hh) => window.__tgViewport(hh), h); await page.setViewportSize({ width: w, height: h }); };
// открыть: пауза, сообщение Telegram, конец хода; общие проверки
const openRun = async (a, tag, { bar = ".ch-bar", root = "[data-chat]", glue = "[data-chat-msg]", input = "[data-chat-input]", tgAt = 90, kh = KH, h = H, off = 0 } = {}) => {
  const rest = await rectNow(a.page, bar), sb0 = await sbNow(a.page);
  await startTrack(a.page, { act: "open", bar, root, glue, input, tgAt, kh, h, off, ms: 650 });
  const { s, tg } = await endTrack(a.page);
  const fin = s[s.length - 1], trav = rest.top - fin.bt, K0 = (tg == null ? tgAt : tg) - LAG;
  // до сообщения — замеры, сделанные раньше него (под нагрузкой замер кадра бывает уже после сообщения)
  const pre = s.filter((x) => tg != null && x.t < tg);
  ok(tag + ": до сообщения Telegram строка стоит (клавиатуры ещё нет, Telegram ничего не рисует)", tg != null && pre.length >= 2 && pre.every((x) => Math.abs(x.bt - rest.top) <= 1), JSON.stringify({ tg, pre: pre.slice(-3).map((x) => [x.ft, x.bt]) }));
  const mid = s.filter((x) => tg != null && x.ft >= tg + 18 && x.ft <= tg + 230);
  ok(tag + ": дальше в каждом кадре там же, где клавиатура (±10 %)", mid.length >= 3 && mid.every((x) => Math.abs(pct(x, rest.top, trav) / 100 - kbCurve(KB_OPEN, x.ft - K0)) <= 0.10), JSON.stringify(mid.map((x) => [x.ft, pct(x, rest.top, trav), Math.round(kbCurve(KB_OPEN, x.ft - K0) * 100)])));
  ok(tag + ": только вверх: ни кадра вниз (вырез снизу не проседает)", oneWay(steps(s), -1), seq(s));
  const tail = s.filter((x) => tg != null && x.ft >= tg + 300);
  ok(tag + ": в конце без подскока: строка стоит на месте", tail.length >= 2 && Math.max(...tail.map((x) => x.bt)) - Math.min(...tail.map((x) => x.bt)) <= 1, seq(s.slice(-10)));
  ok(tag + ": вырез снизу у приложения тот же, что без клавиатуры (" + sb0 + ")", s.every((x) => x.sb === sb0), JSON.stringify([...new Set(s.map((x) => x.sb))]));
  return { rest, fin, trav, s, tg };
};
const closeRun = async (a, tag, { bar = ".ch-bar", root = "[data-chat]", glue = "[data-chat-msg]", wait = 33, rest } = {}) => {
  const up = await rectNow(a.page, bar), sb0 = await sbNow(a.page);
  await startTrack(a.page, { act: "blur", bar, root, glue, ms: 650 });
  await growQuiet(a.page, wait);
  await sleep(750); await mute(a.page, false);
  const { s } = await endTrack(a.page);
  const tr = rest.top - up.top;
  ok(tag + ": только вниз: ни кадра вверх", oneWay(steps(s), 1), seq(s));
  const lead = s.filter((x) => x.ft > 0 && x.ft < 260).map((x) => [x.ft, pct(x, up.top, tr), Math.round(kbCurve(KB_CLOSE, x.ft) * 100)]);
  ok(tag + ": не обгоняет клавиатуру (ниже её края не больше 4 %)", lead.every(([, p, k]) => p <= k + 4), JSON.stringify(lead));
  const late = s.filter((x) => x.ft >= wait + 70 && x.ft <= 230).map((x) => [x.ft, pct(x, up.top, tr), Math.round(kbCurve(KB_CLOSE, x.ft) * 100)]);
  ok(tag + ": окно выросло на 2 кадра позже — к 0,1 с идёт вровень с клавиатурой (±10 %)", late.length >= 2 && late.every(([, p, k]) => Math.abs(p - k) <= 10), JSON.stringify(late));
  ok(tag + ": внизу, на месте", Math.abs(s[s.length - 1].bt - rest.top) <= 1, JSON.stringify(s.slice(-2)));
  ok(tag + ": вырез снизу тот же (" + sb0 + ")", s.every((x) => x.sb === sb0), JSON.stringify([...new Set(s.map((x) => x.sb))]));
  return s;
};

await run("OPEN", async () => {
  const C = chatServer(); await fill(C, 12);
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, init: TG_IOS, motion: "no-preference" });
  await openChat(a.page, "team");
  const o = await openRun(a, "OPEN");
  ok("OPEN: последнее сообщение не отрывается от строки ни в одном кадре", glued(o.s) <= 2, String(glued(o.s)));
  ok("OPEN: в конце строка ввода прямо над клавиатурой", o.fin.bb <= H - KH && o.fin.bb >= H - KH - 14, JSON.stringify(o.fin));
  const sh = await tgShrink(a.page, ".ch-bar", H - KH, 393, true);
  ok("OPEN: окно сжалось молча — строка ввода не сдвинулась ни на кадр", sh.after > 3 && sh.moved <= 1, JSON.stringify(sh));
  await shot(a.page, "open-end");
  const s2 = await closeRun(a, "CLOSE", { rest: o.rest });
  ok("CLOSE: последнее сообщение не отрывается от строки", glued(s2) <= 2, String(glued(s2)));
  // второй круг: так же
  const o2 = await openRun(a, "OPEN-2");
  await tgShrink(a.page, ".ch-bar", H - KH, 393, true);
  await closeRun(a, "CLOSE-2", { rest: o2.rest });
  const [e1, e2] = noErr(a);
  ok("OPEN: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("QUICK", async () => {
  const C = chatServer(); await fill(C, 12);
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, init: TG_IOS, motion: "no-preference" });
  await openChat(a.page, "team");
  const o = await openRun(a, "QUICK-OPEN");
  const up = await rectNow(a.page, ".ch-bar");
  await startTrack(a.page, { act: "blur-tg", tgAt: 10, ms: 450 });
  const { s } = await endTrack(a.page), tr = o.rest.top - up.top;
  const ms = s.filter((x) => x.ft >= 16 && x.ft <= 220).map((x) => [x.ft, pct(x, up.top, tr), Math.round(kbCurve(KB_CLOSE, x.ft) * 100)]);
  ok("QUICK: фокус снят до сжатия окна — вниз по кривой клавиатуры с первого кадра (±10 %)", ms.length >= 3 && ms.every(([, p, k]) => Math.abs(p - k) <= 10), JSON.stringify(ms));
  ok("QUICK: только вниз, внизу", oneWay(steps(s), 1) && Math.abs(s[s.length - 1].bt - o.rest.top) <= 1, seq(s));
  const [e1, e2] = noErr(a);
  ok("QUICK: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("MISMATCH", async () => {
  const C = chatServer(); await fill(C, 12);
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, init: TG_IOS, motion: "no-preference" });
  await openChat(a.page, "team");
  // Telegram сообщил высоту над клавиатурой на 20 px больше настоящей: настоящий край клавиатуры — H − KH, а Telegram
  // сказал H − KH + 20 (строка встала на 20 px ниже края, под клавиатурой)
  const rest = await rectNow(a.page, ".ch-bar");
  await startTrack(a.page, { act: "open", off: 20, ms: 420 });
  await endTrack(a.page);
  const before = await rectNow(a.page, ".ch-bar");
  await mute(a.page, true);
  await a.page.evaluate(() => { window.__trk = []; const t0 = performance.now(); window.__trkDone = false;
    const f = (ts) => { const ft = Math.round(ts - t0), ih0 = window.innerHeight; setTimeout(() => { const r = document.querySelector(".ch-bar").getBoundingClientRect(); window.__trk.push({ ft, bt: Math.round(r.top * 10) / 10, bb: Math.round(r.bottom * 10) / 10, ih: window.innerHeight, ih0 }); }, 0);
      if (performance.now() - t0 < 500) requestAnimationFrame(f); else setTimeout(() => { window.__trkDone = true; }, 40); };
    requestAnimationFrame(f); });
  await a.page.setViewportSize({ width: 393, height: H - KH });   // окно сжалось по настоящей клавиатуре
  await until(() => a.page.evaluate(() => window.__trkDone), 4000, 50);
  await mute(a.page, false);
  const s = (await a.page.evaluate(() => window.__trk)).filter((x) => x.ih === x.ih0);
  // скорость — по времени кадров (пропущенный под нагрузкой кадр — не рывок): не быстрее 0,5 px за мс (8 px за кадр)
  const st = steps(s), fin = s[s.length - 1];
  let big = 0; for (let i = 1; i < s.length; i++) big = Math.max(big, Math.abs(s[i].bt - s[i - 1].bt) / Math.max(16.7, s[i].ft - s[i - 1].ft) * 16.7);
  big = Math.round(big * 10) / 10;
  ok("MISMATCH: до сжатия строка там, где сказал Telegram (на 20 px ниже настоящего края)", Math.abs(before.bottom - (H - KH + 20)) <= 2, JSON.stringify({ rest, before }));
  ok("MISMATCH: окно сжалось по настоящей клавиатуре — строка доезжает плавно (не больше 8 px за кадр), только вверх", s.length >= 6 && big <= 8 && oneWay(st, -1), JSON.stringify({ big, st: st.map((d) => Math.round(d * 10) / 10), ft: s.map((x) => x.ft) }));
  ok("MISMATCH: и встаёт прямо над клавиатурой", Math.abs(fin.bb - (H - KH)) <= 1, JSON.stringify(fin));
  const [e1, e2] = noErr(a);
  ok("MISMATCH: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("MIDWAY", async () => {
  const C = chatServer(); await fill(C, 12);
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, init: TG_IOS, motion: "no-preference" });
  await openChat(a.page, "team");
  const rest = await rectNow(a.page, ".ch-bar");
  await startTrack(a.page, { act: "open", tgAt: 40, ms: 600 });
  await sleep(40 + 150); await mute(a.page, true);
  await a.page.setViewportSize({ width: 393, height: H - KH });   // окно сжалось, когда клавиатура ещё в пути
  const { s, tg } = await endTrack(a.page);
  await mute(a.page, false);
  const st = steps(s), K0 = tg - LAG, fin = s[s.length - 1], trav = rest.top - fin.bt;
  ok("MIDWAY: окно сжалось посреди хода — строка дальше едет за клавиатурой: только вверх, без прыжка (≤ 3,5 % пути за мс)", oneWay(st, -1) && s.every((x, i) => i === 0 || Math.abs(x.bt - s[i - 1].bt) <= trav * 0.035 * Math.max(8, x.ft - s[i - 1].ft)), seq(s));
  const mid = s.filter((x) => x.ft >= tg + 18 && x.ft <= tg + 230);
  ok("MIDWAY: в каждом кадре там же, где клавиатура (±10 %)", mid.length >= 3 && mid.every((x) => Math.abs(pct(x, rest.top, trav) / 100 - kbCurve(KB_OPEN, x.ft - K0)) <= 0.10), JSON.stringify(mid.map((x) => [x.ft, pct(x, rest.top, trav), Math.round(kbCurve(KB_OPEN, x.ft - K0) * 100)])));
  ok("MIDWAY: в конце над клавиатурой", fin.bb <= H - KH && fin.bb >= H - KH - 14, JSON.stringify(fin));
  const [e1, e2] = noErr(a);
  ok("MIDWAY: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("SHEET", async () => {
  const C = chatServer();
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, init: TG_IOS, motion: "no-preference" });
  await openChat(a.page, "team");
  await plus(a.page, "poll");
  const o = await openRun(a, "SHEET", { bar: ".ch-sheet", glue: "", input: "[data-chat-pollq]" });
  ok("SHEET: в конце лист над клавиатурой", Math.abs(o.fin.bb - (H - KH)) <= 2, JSON.stringify(o.fin));
  await shot(a.page, "sheet-end");
  const [e1, e2] = noErr(a);
  ok("SHEET: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("AI", async () => {
  const a = await open({ init: TG_IOS, motion: "no-preference" });
  await nav(a.page, "assistant", 1600);
  const BAR = ".sa-layer .sa-ai-bar", ROOT = ".sa-layer";
  const o = await openRun(a, "AI", { bar: BAR, root: ROOT, glue: "", input: ".sa-layer textarea" });
  ok("AI: в конце поле над клавиатурой", o.fin.bb <= H - KH && o.fin.bb >= H - KH - 16, JSON.stringify(o.fin));
  await tgShrink(a.page, BAR, H - KH, 393, true);
  await closeRun(a, "AI-CLOSE", { bar: BAR, root: ROOT, glue: "", rest: o.rest });
  const [e1, e2] = noErr(a);
  ok("AI: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("CALM", async () => {
  const C = chatServer(); await fill(C, 12);
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, init: TG_IOS, motion: "reduce" });
  await openChat(a.page, "team");
  const rest = await rectNow(a.page, ".ch-bar"), sb0 = await sbNow(a.page);
  await startTrack(a.page, { act: "open", ms: 500 });
  const { s } = await endTrack(a.page), end = s[s.length - 1];
  const mids = s.filter((x) => Math.abs(x.bt - rest.top) > 1 && Math.abs(x.bt - end.bt) > 1);
  ok("CALM: «Уменьшить движение» — сразу на месте, ни кадра в промежуточном положении; вырез снизу тот же", mids.length === 0 && end.bb <= H - KH && s.every((x) => x.sb === sb0), JSON.stringify({ mids: mids.slice(0, 3), end, sb: [...new Set(s.map((x) => x.sb))] }));
  const [e1, e2] = noErr(a);
  ok("CALM: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("NARROW", async () => {
  for (const light of [false, true]) {
    const tag = light ? "светлая" : "тёмная";
    const C = chatServer(); await fill(C, 12);
    const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, w: 320, h: 640, light, init: TG_IOS, motion: "no-preference" });
    await openChat(a.page, "team");
    await startTrack(a.page, { act: "open", kh: 260, h: 640, ms: 500 });
    const { s } = await endTrack(a.page), fin = s[s.length - 1];
    ok("NARROW " + tag + ": 320 px — ничего не выезжает вбок, строка над клавиатурой, сообщения не отрываются", s.every((x) => x.sw <= x.cw + 1) && fin.bb <= 640 - 260 && fin.bb >= 640 - 260 - 14 && glued(s) <= 2, JSON.stringify({ fin, g: glued(s) }));
    await shot(a.page, "narrow-" + (light ? "light" : "dark"));
    const [e1, e2] = noErr(a);
    ok("NARROW " + tag + ": без ошибок в консоли", e1, e2);
    await a.ctx.close();
  }
});

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
