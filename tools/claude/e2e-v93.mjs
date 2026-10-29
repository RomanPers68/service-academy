// e2e v93 (Доп. 406): умный чат внутри приложения. Сервер чата, графика и меню — в памяти скрипта (как этап 38 v93),
// Наставник (ai-chat) — ответ сценария.
// Разделы:
//   SHIFT  — «+» по ролям; «Отдать смену»: мои смены из графика, записка, карточка-билет; у официантки, свободной в этот
//            день, — «Забрать», у хостес — почему нельзя; забрала — график поменялся сразу, руководитель видит строку в
//            «Руководителях»; кто не успел — «Смену уже забрали»; «Отменить» своё предложение;
//   SWAP   — «Поменяться»: дни взамен; у коллеги со сменой в эти дни — «Поменяться» и его смены на выбор, у остальных —
//            почему нет; обмен — в графике у обоих, руководитель видит;
//   TASK   — задание: урок из приложения, срок, «прошёл 1 из 5», «Напомнить», «Кто не прошёл»; «Открыть урок» открывает
//            урок; прошедший видит «Пройдено»; тема — «Открыть тему»;
//   POLL   — подсказки по тексту («Сделать опрос» с вопросом и вариантами), голоса, снять свой;
//   STOP   — подсказка «В стоп-лист», блюдо из меню заведения; в Меню у всех «в стопе», своя копия блюда у руководителя
//            берёт стоп с сервера; «Вернуть в меню»;
//   AI     — «@Наставник …»: печатает, ответ в переписке с карточкой блюда (в ai-chat — вопрос без обращения и подсказка
//            про общий чат); у коллеги тоже; карточка открывает Меню; 30 в день — словами, без ИИ; плитка «Наставник»;
//   SHARE  — «Поделиться»: коктейль и глава Справочника открываются у коллеги; брифинг дня карточкой;
//   SAVE   — график у руководителя: пока правил, в чате передали смену — «Сохранить» сводит с сервером;
//   NARROW — 320 px: лента с карточками и «+» без прокрутки вбок, обе темы.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v93.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5293, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v93";
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

async function open({ who = ANNA, token = "tok-anna", rpcs = () => undefined, calls = [], light = false, w = 393, h = 852, path = "/", seedExtra = {}, ai = null, lessons = [], brief = null } = {}) {
  const UK = ukOf(who);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: TZ, reducedMotion: "reduce" });
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
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
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


await run("SHIFT", async () => {
  const C = chatServer();
  const v = await open({ who: VERA, token: "tok-vera", rpcs: C.rpc });
  await openChat(v.page);
  await plus(v.page);
  const tw = await acts(v.page);
  ok("SHIFT: «+» у официанта — Фото, Отдать смену, Поменяться, Поделиться, Опрос, Наставник", tw.filter((x) => x !== "late" && x !== "thx").join(",") === "photo,give,swap,share,poll,ai", tw.join(","));   // v99: и «Опаздываю» (e2e-v99); v108: и «Спасибо коллеге» (e2e-v108)
  await shot(v.page, "shift-plus");
  await v.page.locator('[data-chat-act="give"]').click(); await sleep(1100);
  const mine = await v.page.locator("[data-chat-myshift]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chat-myshift")));
  ok("SHIFT: «Отдать смену» — мои смены из графика на месяц вперёд, по порядку", mine.join(",") === [D(0), D(1), D(3), D(6)].join(","), mine.join(","));
  ok("SHIFT: пока смена не выбрана, «Предложить смену» не нажимается", await v.page.locator("[data-chat-shiftgo]").isDisabled());
  await v.page.locator(`[data-chat-myshift="${D(1)}"]`).click(); await sleep(200);
  await v.page.locator("[data-chat-shiftnote]").fill("Сестра выходит замуж");
  await shot(v.page, "shift-sheet");
  await v.page.locator("[data-chat-shiftgo]").click(); await sleep(1300);
  const offer = C.S.msgs.find((m) => m.kind === "card" && m.card.t === "shift");
  ok("SHIFT: на сервере — смена Веры: вечер (В), её строка графика, официант, записка, открыта", !!offer && offer.card.k === "В" && offer.card.sid === "6" && offer.card.posKey === "waiter" && offer.card.note === "Сестра выходит замуж" && offer.card.st === "open" && offer.card.mode === "give", JSON.stringify(offer && offer.card));
  const vc = card(v.page, "shift"), [y1, m1, d1] = D(1).split("-").map(Number);
  ok("SHIFT: у Веры — билет: «Вечер 16:00–24:00», «завтра · официант», записка, «Ждём, кто заберёт», «Отменить»",
    (await tc(vc.locator("[data-chat-shift-when]"))) === "Вечер 16:00–24:00" && /завтра · официант/.test(await tc(vc)) && /«Сестра выходит замуж»/.test(await tc(vc)) && /Ждём, кто заберёт/.test(await tc(vc)) && (await vc.locator("[data-chat-shift-cancel]").count()) === 1, await tc(vc));
  ok("SHIFT: корешок билета — день недели, число и месяц смены", (await tc(vc.locator(".ch-card-tile"))) === WD_S[dowOf(D(1))] + d1 + MON_S[m1 - 1], (await tc(vc.locator(".ch-card-tile"))) + " " + y1);
  await shot(v.page, "shift-card-mine");
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await openChat(a.page);
  const ac = card(a.page, "shift");
  ok("SHIFT: у Анны (официант, в этот день без смены) — «Можешь забрать…» и «Забрать»", /Можешь забрать: в этот день у тебя нет смены по графику/.test(await tc(ac)) && (await ac.locator("[data-chat-take]").count()) === 1, await tc(ac));
  await shot(a.page, "shift-card-take");
  const o = await open({ who: OLGA, token: "tok-olga", rpcs: C.rpc });
  await openChat(o.page);
  const oc = card(o.page, "shift");
  ok("SHIFT: у хостес — «Забрать могут официанты, свободные в этот день», кнопки нет", /Забрать могут официанты, свободные в этот день/.test(await tc(oc)) && !(await oc.locator("button").count()), await tc(oc));
  const p = await open({ who: PETR, token: "tok-petr", rpcs: C.rpc });
  await openChat(p.page);
  ok("SHIFT: у Петра (тоже официант, свободен) — тоже «Забрать»", (await card(p.page, "shift").locator("[data-chat-take]").count()) === 1);
  await freeze(p.page);
  await ac.locator("[data-chat-take]").click(); await sleep(1200);
  ok("SHIFT: Анна забрала — «Смена твоя, график обновлён»", (await toast(a.page)) === "Смена твоя, график обновлён", await toast(a.page));
  ok("SHIFT: у Анны карточка закрыта: «Анна С. забирает смену · график обновлён», кнопок нет", (await card(a.page, "shift").locator('[data-chat-shift-st="done"]').count()) === 1 && /Анна С\. забирает смену · график обновлён/.test(await tc(card(a.page, "shift"))) && !(await card(a.page, "shift").locator("button").count()), await tc(card(a.page, "shift")));
  const mo = monOf(C.S, D(1));
  ok("SHIFT: график поменялся сразу: у Веры завтра пусто, у Анны — «В», обе клетки под замком", !mo.plan["6"][dayN(D(1))] && mo.plan["3"][dayN(D(1))] === "В" && mo.locks["6"][dayN(D(1))] === true && mo.locks["3"][dayN(D(1))] === true, JSON.stringify([mo.plan["6"], mo.plan["3"]]));
  await shot(a.page, "shift-card-done");
  await p.page.locator("[data-chat-take]").last().click(); await sleep(1200);
  ok("SHIFT: Пётр нажал позже — «Смену уже забрали.», карточка у него тоже закрылась", (await toast(p.page)) === "Смену уже забрали." && (await card(p.page, "shift").locator('[data-chat-shift-st="done"]').count()) === 1, await toast(p.page));
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc });
  await openChat(m.page, "leads");
  const log = await txt(m.page.locator('[data-chat-sys="log"]'));
  ok("SHIFT: руководитель видит в «Руководителях»: «Передача смены …, вечер: отдаёт Вера С., забирает Анна С. · график обновлён»", log === "Передача смены " + dshort(D(1)) + ", вечер: отдаёт Вера С., забирает Анна С. · график обновлён", log);
  await shot(m.page, "shift-leads-log");
  ok("SHIFT: у Веры (через опрос переписки) — тоже закрыта, «Отменить» пропало", await until(async () => (await card(v.page, "shift").locator('[data-chat-shift-st="done"]').count()) === 1 && !(await card(v.page, "shift").locator("[data-chat-shift-cancel]").count())));
  // отменить своё: Вера предлагает +3 и передумывает
  await plus(v.page, "give");
  const mine2 = await v.page.locator("[data-chat-myshift]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chat-myshift")));
  ok("SHIFT: в «Отдать смену» отданной смены больше нет", mine2.join(",") === [D(0), D(3), D(6)].join(","), mine2.join(","));
  await v.page.locator(`[data-chat-myshift="${D(3)}"]`).click(); await v.page.locator("[data-chat-shiftgo]").click(); await sleep(1300);
  await plus(v.page, "give");
  const mine3 = await v.page.locator("[data-chat-myshift]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chat-myshift")));
  ok("SHIFT: предложенная смена в списке не повторяется", mine3.join(",") === [D(0), D(6)].join(","), mine3.join(","));
  await v.page.locator("[data-chat-shiftsheet] [data-sa-back]").click(); await sleep(400);
  await card(v.page, "shift").locator("[data-chat-shift-cancel]").click(); await sleep(1100);
  ok("SHIFT: «Отменить» — «Предложение отменено», билет погас", (await card(v.page, "shift").locator('[data-chat-shift-st="off"]').count()) === 1 && /Предложение отменено/.test(await tc(card(v.page, "shift"))) && /done/.test(await card(v.page, "shift").getAttribute("class")));
  const [e1, e2] = noErr(v, a, o, p, m);
  ok("SHIFT: без ошибок в консоли", e1, e2);
  for (const x of [v, a, o, p, m]) await x.ctx.close();
});

await run("SWAP", async () => {
  const C = chatServer();
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await openChat(a.page);
  await plus(a.page, "swap");
  ok("SWAP: «Поменяться сменой» — мои смены", (await a.page.locator('[data-chat-shiftsheet="swap"] [data-chat-myshift]').count()) === 2);
  await a.page.locator(`[data-chat-myshift="${D(5)}"]`).click(); await sleep(300);
  ok("SWAP: дни взамен — «Любой день» и две недели вперёд без дня самой смены", (await a.page.locator('[data-chat-want="any"][aria-pressed="true"]').count()) === 1 && (await a.page.locator("[data-chat-want]").count()) === 14 && !(await a.page.locator(`[data-chat-want="${D(5)}"]`).count()));
  await a.page.locator(`[data-chat-want="${D(4)}"]`).click(); await sleep(150);
  ok("SWAP: выбран день — «Любой день» снят", (await a.page.locator('[data-chat-want="any"][aria-pressed="false"]').count()) === 1 && (await a.page.locator(`[data-chat-want="${D(4)}"][aria-pressed="true"]`).count()) === 1);
  await shot(a.page, "swap-sheet");
  await a.page.locator("[data-chat-shiftgo]").click(); await sleep(1300);
  const ac = card(a.page, "shift");
  ok("SWAP: билет «Меняю смену»: «Взамен: …», «Ждём, кто поменяется»", /Взамен: /.test(await tc(ac.locator("[data-chat-shift-want]"))) && (await tc(ac.locator("[data-chat-shift-want]"))) === "Взамен: " + dshort(D(4)) && /Ждём, кто поменяется/.test(await tc(ac)) && /Меняю смену/i.test(await tc(ac)), await tc(ac));
  const p = await open({ who: PETR, token: "tok-petr", rpcs: C.rpc });
  await openChat(p.page);
  const pc = card(p.page, "shift");
  ok("SWAP: у Петра (официант, в этот день без смены, в просимый день — смена) — «Поменяться»", /Можешь поменяться на свою смену/.test(await tc(pc)) && (await pc.locator("[data-chat-swap]").count()) === 1, await tc(pc));
  const v = await open({ who: VERA, token: "tok-vera", rpcs: C.rpc });
  await openChat(v.page);
  ok("SWAP: у Веры (в просимый день смены нет) — «В эти дни у тебя нет смен взамен»", /В эти дни у тебя нет смен взамен/.test(await tc(card(v.page, "shift"))) && !(await card(v.page, "shift").locator("button").count()), await tc(card(v.page, "shift")));
  await pc.locator("[data-chat-swap]").click(); await sleep(1100);
  const opts = await p.page.locator("[data-chat-swapwith]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chat-swapwith")));
  ok("SWAP: лист «Поменяться» — смена Анны и моя взамен (только подходящая)", opts.join(",") === D(4) && /Анна С\. меняет: /.test(await txt(p.page.locator("[data-chat-swapsheet] .ch-quote"))), opts.join(","));
  await shot(p.page, "swap-pick");
  await p.page.locator(`[data-chat-swapwith="${D(4)}"]`).click(); await sleep(1300);
  ok("SWAP: поменялись — «Поменялись, график обновлён», билет: «Поменялись: Анна С. и Пётр О. (… и …) · график обновлён»",
    (await toast(p.page)) === "Поменялись, график обновлён" && (await tc(card(p.page, "shift").locator("[data-chat-shift-st]"))) === "Поменялись: Анна С. и Пётр О. (" + dshort(D(5)) + " и " + dshort(D(4)) + ") · график обновлён", await tc(card(p.page, "shift")));
  const m5 = monOf(C.S, D(5)), m4 = monOf(C.S, D(4));
  ok("SWAP: в графике у обоих: Анна выходит в день Петра, Пётр — в день Анны", !m5.plan["3"][dayN(D(5))] && m5.plan["4"][dayN(D(5))] === "Д" && !m4.plan["4"][dayN(D(4))] && m4.plan["3"][dayN(D(4))] === "Д");
  await shot(p.page, "swap-done");
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc });
  await openChat(m.page, "leads");
  ok("SWAP: руководитель видит обмен: «Обмен сменами: Анна С. (…) и Пётр О. (…) · график обновлён»", (await txt(m.page.locator('[data-chat-sys="log"]'))) === "Обмен сменами: Анна С. (" + dshort(D(5)) + ") и Пётр О. (" + dshort(D(4)) + ") · график обновлён", await txt(m.page.locator('[data-chat-sys="log"]')));
  const [e1, e2] = noErr(a, p, v, m);
  ok("SWAP: без ошибок в консоли", e1, e2);
  for (const x of [a, p, v, m]) await x.ctx.close();
});

await run("TASK", async () => {
  const C = chatServer();
  C.S.progress["e-petr"] = ["s1-1"]; C.S.tg.add("e-anna");
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc });
  await openChat(m.page);
  await plus(m.page);
  const tl = await acts(m.page);
  ok("TASK: «+» у старшей — все девять: и Задание, Стоп-лист, Брифинг", tl.filter((x) => x !== "late" && x !== "thx").join(",") === "photo,give,swap,task,share,poll,stop,brief,ai", tl.join(","));   // v99: и «Опаздываю»; v108: и «Спасибо коллеге»
  await shot(m.page, "task-plus");
  await m.page.locator('[data-chat-act="task"]').click(); await sleep(900);
  await m.page.locator("[data-chat-picksearch]").fill("Что такое сервис"); await sleep(400);
  ok("TASK: поиск по урокам приложения — «Что такое сервис?» первым", (await m.page.locator("[data-chat-pick]").first().getAttribute("data-chat-pick")) === "lesson:s1-1");
  await m.page.locator('[data-chat-pick="lesson:s1-1"]').click(); await sleep(400);
  ok("TASK: срок — по умолчанию «До пятницы»", (await m.page.locator('[data-chat-due="fri"][aria-pressed="true"]').count()) === 1);
  await m.page.locator('[data-chat-due="tomorrow"]').click(); await sleep(150);
  await shot(m.page, "task-sheet");
  await m.page.locator("[data-chat-taskgo]").click(); await sleep(1300);
  const sent = C.S.msgs.find((x) => x.kind === "card" && x.card.t === "task");
  ok("TASK: на сервере — урок (id, название), срок завтра", !!sent && sent.card.item.kind === "lesson" && sent.card.item.id === "s1-1" && sent.card.item.title === "Что такое сервис?" && sent.card.due === D(1), JSON.stringify(sent && sent.card));
  const mc = card(m.page, "task");
  ok("TASK: карточка у старшей: «Урок «Что такое сервис?»», «до завтра», кольцо 1/5, «прошёл 1 из 5»", /Урок «Что такое сервис\?»/.test(await tc(mc)) && /до завтра/.test(await tc(mc)) && (await tc(mc.locator(".ch-tl-r b"))) === "1/5" && (await tc(mc.locator("[data-chat-task-n]"))) === "прошёл 1 из 5", await tc(mc));
  await mc.locator("[data-chat-task-who]").click(); await sleep(300);
  ok("TASK: «Кто не прошёл» — «Ещё не прошли: Анна С., Вера С., Илья Б., Ольга Л.»", (await tc(mc.locator("[data-chat-task-left]"))) === "Ещё не прошли: Анна С., Вера С., Илья Б., Ольга Л.", await tc(mc.locator("[data-chat-task-left]")));
  await mc.locator("[data-chat-remind]").click(); await sleep(1100);
  ok("TASK: «Напомнить» — «Напомнили в Telegram: 1 из 4», кнопка — «Напомнили»", (await toast(m.page)) === "Напомнили в Telegram: 1 из 4" && (await tc(mc.locator("[data-chat-remind]"))) === "Напомнили" && (await mc.locator("[data-chat-remind]").isDisabled()), await toast(m.page));
  ok("TASK: список «Ещё не прошли» не закрылся, когда карточка обновилась", (await mc.locator("[data-chat-task-left]").count()) === 1);
  await shot(m.page, "task-card-lead");
  const p = await open({ who: PETR, token: "tok-petr", rpcs: C.rpc, lessons: ["s1-1"] });
  await openChat(p.page);
  ok("TASK: у Петра (урок пройден) — «Пройдено», без «Открыть урок» и «Напомнить»", (await card(p.page, "task").locator("[data-chat-task-done]").count()) === 1 && !(await card(p.page, "task").locator("[data-chat-open], [data-chat-remind]").count()));
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await openChat(a.page);
  const ac = card(a.page, "task");
  ok("TASK: у Анны — «Открыть урок», без «Напомнить» и «Кто не прошёл»", (await tc(ac.locator('[data-chat-open="lesson"]'))) === "Открыть урок" && !(await ac.locator("[data-chat-remind], [data-chat-task-who]").count()));
  await shot(a.page, "task-card-staff");
  await ac.locator('[data-chat-open="lesson"]').click(); await sleep(2600);
  ok("TASK: «Открыть урок» — чат закрылся, открыт урок «Что такое сервис?»", (await chatGone(a.page)) && /Что такое сервис\?/.test(await body(a.page)), (await body(a.page)).slice(0, 160));
  await shot(a.page, "task-lesson");
  // тема: «Психология первого дня»
  await plus(m.page, "task");
  await m.page.locator("[data-chat-picksearch]").fill("Психология первого дня"); await sleep(400);
  await m.page.locator('[data-chat-pick="module:s0"]').click(); await sleep(300);
  await m.page.locator('[data-chat-due="none"]').click(); await m.page.locator("[data-chat-taskgo]").click(); await sleep(1300);
  const mod = C.S.msgs.filter((x) => x.kind === "card" && x.card.t === "task").pop();
  ok("TASK: тема — с уроками и тестами (по ним считается «прошёл»), без срока", mod.card.item.kind === "module" && mod.card.item.lessons.includes("s0-1") && mod.card.item.quizzes.length >= 1 && !mod.card.due, JSON.stringify(mod.card.item).slice(0, 200));
  await openChat(a.page);
  await card(a.page, "task").locator('[data-chat-open="module"]').click(); await sleep(2600);
  ok("TASK: «Открыть тему» — тема открылась на первом непройденном уроке (как с главной): «Первый день: нормально бояться»", (await chatGone(a.page)) && /‹ Первый день: нормально бояться 1 из \d+/.test(await body(a.page)), (await body(a.page)).slice(0, 160));
  const [e1, e2] = noErr(m, p, a);
  ok("TASK: без ошибок в консоли", e1, e2);
  for (const x of [m, p, a]) await x.ctx.close();
});

await run("POLL", async () => {
  const C = chatServer();
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await openChat(a.page);
  await a.page.locator("[data-chat-input]").fill("Кто может выйти в субботу на банкет?"); await sleep(300);
  const sg = await a.page.locator("[data-chat-sg]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chat-sg") + ":" + e.textContent.trim()));
  ok("POLL: подсказки по тексту — «Отдать смену» и «Сделать опрос»", sg.join(",") === "give:Отдать смену,poll:Сделать опрос", sg.join(","));
  await shot(a.page, "poll-sugg");
  await a.page.locator('[data-chat-sg="poll"]').click(); await sleep(600);
  ok("POLL: опрос — вопрос из сообщения, варианты «Я смогу» и «Не смогу»", (await a.page.locator("[data-chat-pollq]").inputValue()) === "Кто может выйти в субботу на банкет?" && (await a.page.locator('[data-chat-pollo="0"]').inputValue()) === "Я смогу" && (await a.page.locator('[data-chat-pollo="1"]').inputValue()) === "Не смогу");
  await a.page.locator("[data-chat-polladd]").click(); await a.page.locator('[data-chat-pollo="2"]').fill("Смогу до 22:00"); await sleep(150);
  await shot(a.page, "poll-sheet");
  await a.page.locator("[data-chat-pollgo]").click(); await sleep(1300);
  ok("POLL: опрос в ленте, строка ввода пуста, подсказок нет", (await a.page.locator('[data-chat-card="poll"]').count()) === 1 && (await a.page.locator("[data-chat-input]").inputValue()) === "" && !(await a.page.locator("[data-chat-sugg]").count()));
  const pm = C.S.msgs.find((x) => x.kind === "card" && x.card.t === "poll");
  ok("POLL: на сервере — вопрос и три варианта", !!pm && pm.card.q === "Кто может выйти в субботу на банкет?" && pm.card.opts.join("|") === "Я смогу|Не смогу|Смогу до 22:00");
  const p = await open({ who: PETR, token: "tok-petr", rpcs: C.rpc });
  await openChat(p.page);
  await card(p.page, "poll").locator('[data-chat-vote="0"]').click(); await sleep(1000);
  ok("POLL: голос Петра — сразу на карточке: 1 голос, «Пётр О.» под вариантом", (await tc(card(p.page, "poll").locator(".ch-card-tile"))) === "1голос" && /Пётр О\./.test(await tc(card(p.page, "poll").locator('[data-chat-vote="0"]'))) && (await card(p.page, "poll").locator('[data-chat-vote="0"][aria-pressed="true"]').count()) === 1, await tc(card(p.page, "poll").locator(".ch-card-tile")));
  await card(a.page, "poll").locator('[data-chat-vote="2"]').click(); await sleep(1000);
  ok("POLL: у Анны — 2 голоса (свой и Петра, пришёл опросом переписки)", await until(async () => (await card(a.page, "poll").locator('[data-chat-poll-total="2"]').count()) === 1));
  await shot(a.page, "poll-card");
  await card(a.page, "poll").locator('[data-chat-vote="2"]').click(); await sleep(1000);
  ok("POLL: повторное нажатие на свой вариант — голос снят (1 голос)", (await card(a.page, "poll").locator('[data-chat-poll-total="1"]').count()) === 1 && (C.S.votes[pm.id] || []).length === 1);
  const [e1, e2] = noErr(a, p);
  ok("POLL: без ошибок в консоли", e1, e2);
  for (const x of [a, p]) await x.ctx.close();
});

await run("STOP", async () => {
  const C = chatServer();
  const own = { ...clone(MENU.find((d) => d.id === "ok2608")), stopAt: 0 };   // своя копия блюда у руководителя (правил в Меню)
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, seedExtra: { sa_menu_custom: JSON.stringify({ [R0]: [own] }) } });
  await openChat(m.page);
  await m.page.locator("[data-chat-input]").fill("Пончики с крабом закончились"); await sleep(300);
  ok("STOP: подсказка руководителю — «В стоп-лист»", (await m.page.locator("[data-chat-sg]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chat-sg")))).join(",") === "stop");
  await m.page.locator('[data-chat-sg="stop"]').click(); await sleep(700);
  ok("STOP: лист — блюда меню заведения (10)", (await m.page.locator('[data-chat-stopsheet] [data-chat-pick^="dish:"]').count()) === 10);
  await m.page.locator("[data-chat-picksearch]").fill("пончик"); await sleep(300);
  await m.page.locator('[data-chat-pick="dish:ok2608"]').click(); await sleep(300);
  await shot(m.page, "stop-sheet");
  await m.page.locator("[data-chat-stopgo]").click(); await sleep(1300);
  const sd = C.S.menu.find((d) => d.id === "ok2608");
  ok("STOP: на сервере — блюдо в стопе (кто и когда), stopAt", !!sd.stop && sd.stop.by === "Мария Ким" && sd.stopAt > 0, JSON.stringify(sd.stop));
  const mc = card(m.page, "stop");
  ok("STOP: карточка: «Стоп-лист», «Пончик с крабом», «В Меню у всех помечено «в стопе»», «Открыть в Меню» и «Вернуть в меню»", /Пончик с крабом/.test(await tc(mc)) && /В Меню у всех помечено «в стопе»/.test(await tc(mc)) && (await mc.locator('[data-chat-open="dish"]').count()) === 1 && (await mc.locator("[data-chat-unstop]").count()) === 1 && /stopc/.test(await mc.getAttribute("class")), await tc(mc));
  await shot(m.page, "stop-card");
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await openChat(a.page);
  ok("STOP: у официанта — без «Вернуть в меню»", (await card(a.page, "stop").locator("[data-chat-unstop]").count()) === 0 && (await card(a.page, "stop").locator('[data-chat-open="dish"]').count()) === 1);
  await card(a.page, "stop").locator('[data-chat-open="dish"]').click(); await sleep(2600);
  const ab = await body(a.page);
  ok("STOP: «Открыть в Меню» — Колода меню на этом блюде, «сегодня нет»", (await chatGone(a.page)) && /Пончик с крабом/.test(ab) && /СЕГОДНЯ НЕТ|В СТОПЕ/i.test(ab), ab.slice(0, 200));
  await shot(a.page, "stop-menu");
  // своя копия у руководителя: Меню берёт стоп с сервера (он новее), иначе публикация меню стёрла бы его
  await mc.locator('[data-chat-open="dish"]').click(); await sleep(2600);
  const ownNow = await m.page.evaluate(() => { try { return JSON.parse(localStorage.getItem("sa_menu_custom"))["Два моря, Океан"].find((d) => d.id === "ok2608"); } catch (e) { return null; } });
  ok("STOP: своя копия блюда у руководителя — тоже в стопе (стоп из чата новее)", !!ownNow && !!ownNow.stop && ownNow.stopAt === sd.stopAt, JSON.stringify(ownNow && { stop: ownNow.stop, stopAt: ownNow.stopAt }));
  await openChat(m.page);
  await card(m.page, "stop").locator("[data-chat-unstop]").click(); await sleep(1200);
  ok("STOP: «Вернуть в меню» — «Снова в меню», «Снова можно предлагать гостям · Мария К.», на сервере стопа нет", /Снова можно предлагать гостям · Мария К\./.test(await tc(card(m.page, "stop"))) && /Снова в меню/i.test(await tc(card(m.page, "stop"))) && !C.S.menu.find((d) => d.id === "ok2608").stop, await tc(card(m.page, "stop")));
  await shot(m.page, "stop-off");
  const [e1, e2] = noErr(m, a);
  ok("STOP: без ошибок в консоли", e1, e2);
  for (const x of [m, a]) await x.ctx.close();
});

await run("AI", async () => {
  const C = chatServer();
  const REPLY = "В **креветке темпура**: моллюски и ракообразные, орехи, глютен, яйца, молоко и рыба. Если у гостя аллергия на орехи, уточни у шефа про масло для фритюра. [[dish:ok2602]] [[go:menu|Меню]]";
  const aiCalls = [];
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc, calls: aiCalls, ai: async () => { await sleep(1600); return { ok: true, reply: REPLY, model: "test" }; } });
  await openChat(a.page);
  await plus(a.page, "ai"); await sleep(200);
  ok("AI: плитка «Наставник» — в строке ввода «@Наставник »", (await a.page.locator("[data-chat-input]").inputValue()) === "@Наставник ");
  await a.page.locator("[data-chat-input]").fill("@Наставник, какие аллергены в креветке темпура?");
  await a.page.locator("[data-chat-send]").click();
  ok("AI: пока ждём ответ — «Наставник печатает»", await until(async () => (await a.page.locator("[data-chat-ai-typing]").count()) === 1, 4000, 100));
  await shot(a.page, "ai-typing");
  ok("AI: ответ в переписке — от Наставника, на вопрос Анны, текстом без меток и звёздочек", await until(async () => (await a.page.locator("[data-chat-ai]").count()) === 1, 9000));
  const am = a.page.locator("[data-chat-ai]");
  ok("AI: текст ответа и строка «ты: какие аллергены…»", (await tc(am.locator(".ch-tx"))) === "В креветке темпура: моллюски и ракообразные, орехи, глютен, яйца, молоко и рыба. Если у гостя аллергия на орехи, уточни у шефа про масло для фритюра." && (await tc(am.locator("[data-chat-ai-q]"))) === "ты: какие аллергены в креветке темпура?", await tc(am));
  ok("AI: карточка блюда в ответе — «Креветка темпура»", (await tc(am.locator('.ch-mini[data-chat-open="dish"] .ch-mini-t'))) === "Креветка темпура");
  ok("AI: «печатает» пропало", !(await a.page.locator("[data-chat-ai-typing]").count()));
  await shot(a.page, "ai-answer");
  const ac = aiCalls.filter((c) => c.fn === "ai-chat"), posts = C.S.log.filter((x) => x.fn === "chat_ai_post");
  const lastUser = ac.length ? [...ac[0].body.messages].reverse().find((x) => x.role === "user") : null;
  ok("AI: в ai-chat — вопрос без обращения и подсказка «ответ увидит вся команда», с токеном", ac.length === 1 && ac[0].body.token === "tok-anna" && !!lastUser && /^какие аллергены в креветке темпура\?/.test(lastUser.content) && /Вопрос задан в общем чате смены, ответ увидит вся команда/.test(lastUser.content) && !/@Наставник/i.test(lastUser.content), JSON.stringify(lastUser).slice(0, 200));
  ok("AI: сервер — сначала проверка (без текста), потом ответ с карточкой блюда", posts.length === 2 && posts[0].b.p_body === null && /^В креветке темпура/.test(posts[1].b.p_body) && posts[1].b.p_cards.length === 1 && posts[1].b.p_cards[0].id === "ok2602", JSON.stringify(posts.map((x) => x.b.p_cards)));
  const o = await open({ who: OLGA, token: "tok-olga", rpcs: C.rpc });
  await openChat(o.page);
  ok("AI: у Ольги — тот же ответ и «Анна С.: какие аллергены…»", (await o.page.locator("[data-chat-ai]").count()) === 1 && (await tc(o.page.locator("[data-chat-ai-q]"))) === "Анна С.: какие аллергены в креветке темпура?");
  await o.page.locator('[data-chat-ai] .ch-mini[data-chat-open="dish"]').click(); await sleep(2600);
  ok("AI: карточка в ответе открывает Колоду меню на «Креветке темпура»", (await chatGone(o.page)) && /Креветка темпура/.test(await body(o.page)));
  // лимит дня: ИИ не зовём, причина словами
  C.S.aiExtra = 30;
  await a.page.locator("[data-chat-input]").fill("Наставник, а что предложить к вину?");
  await a.page.locator("[data-chat-send]").click(); await sleep(1600);
  ok("AI: 30 ответов за день — «Наставник на сегодня ответил уже 30 раз. Завтра снова.», в ai-chat не ходили", (await toast(a.page)) === "Наставник на сегодня ответил уже 30 раз. Завтра снова." && aiCalls.filter((c) => c.fn === "ai-chat").length === 1, await toast(a.page));
  const [e1, e2] = noErr(a, o);
  ok("AI: без ошибок в консоли", e1, e2);
  for (const x of [a, o]) await x.ctx.close();
});

await run("SHARE", async () => {
  const C = chatServer();
  const BRIEF = { data: { day: TODAY, dayLabel: "сегодня", on: { stop: true, res: true, note: true }, blocks: { stop: ["Борщ с уткой"], res: [{ t: "19:00" }, { t: "20:30" }], note: "Банкет на веранде в 19:00" } }, author: "Мария Ким", mine: true, sent: true, at: new Date().toISOString() };
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await openChat(a.page);
  await plus(a.page, "share");
  await a.page.locator("[data-chat-picksearch]").fill("Олд"); await sleep(300);
  await a.page.locator('[data-chat-pick="cocktail:old-fashioned"]').click(); await sleep(1300);
  const ac = card(a.page, "share");
  ok("SHARE: Анна поделилась коктейлем — карточка «Коктейль», «Олд фэшн», «Открыть в Колоде»", /Олд фэшн/.test(await tc(ac)) && (await tc(ac.locator('[data-chat-open="cocktail"]'))) === "Открыть в Колоде", await tc(ac));
  await shot(a.page, "share-card");
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: (fn, b) => (fn === "brief_today" ? { ok: true, brief: BRIEF } : C.rpc(fn, b)) });
  await openChat(m.page);
  await plus(m.page, "share");
  await m.page.locator("[data-chat-picksearch]").fill("Основы сервировки"); await sleep(300);
  await m.page.locator('[data-chat-pick="ref:srv-basics"]').click(); await sleep(1300);
  ok("SHARE: глава Справочника — «Открыть в Справочнике»", (await tc(card(m.page, "share").locator('[data-chat-open="ref"]'))) === "Открыть в Справочнике");
  await plus(m.page, "brief");
  ok("SHARE: брифинг дня — строки брифинга в листе", /Брони сегодня: 2/.test(await tc(m.page.locator("[data-chat-briefsheet]"))) && /Стоп-лист: Борщ с уткой/.test(await tc(m.page.locator("[data-chat-briefsheet]"))) && !(await m.page.locator("[data-chat-nobrief]").count()), await tc(m.page.locator("[data-chat-briefsheet]")));
  await shot(m.page, "brief-sheet");
  await m.page.locator("[data-chat-briefgo]").click(); await sleep(1300);
  const bm = C.S.msgs.find((x) => x.kind === "card" && x.card.t === "brief");
  ok("SHARE: брифинг ушёл карточкой: сегодня, строки", !!bm && bm.card.date === TODAY && bm.card.lines.includes("Банкет на веранде в 19:00") && (await card(m.page, "brief").locator(".ch-brief li").count()) === 3, JSON.stringify(bm && bm.card));
  const p = await open({ who: PETR, token: "tok-petr", rpcs: C.rpc, brief: BRIEF });
  await openChat(p.page);
  await p.page.locator('[data-chat-card="share"]').filter({ hasText: "Олд фэшн" }).locator('[data-chat-open="cocktail"]').click(); await sleep(2600);
  ok("SHARE: у Петра «Открыть в Колоде» — Колода коктейлей на «Олд фэшн»", (await chatGone(p.page)) && /Олд фэшн/.test(await body(p.page)), (await body(p.page)).slice(0, 160));
  await openChat(p.page);
  await p.page.locator('[data-chat-card="share"]').filter({ hasText: "Основы сервировки" }).locator('[data-chat-open="ref"]').click(); await sleep(2600);
  ok("SHARE: «Открыть в Справочнике» — открыта глава «Основы сервировки»", (await chatGone(p.page)) && /Основы сервировки/.test(await body(p.page)), (await body(p.page)).slice(0, 160));
  await openChat(p.page);
  await card(p.page, "brief").locator('[data-chat-open="brief"]').click(); await sleep(2600);
  ok("SHARE: «Открыть брифинг» у официанта — открыт брифинг дня", (await chatGone(p.page)) && /Банкет на веранде в 19:00/.test(await body(p.page)), (await body(p.page)).slice(0, 160));
  const [e1, e2] = noErr(a, m, p);
  ok("SHARE: без ошибок в консоли", e1, e2);
  for (const x of [a, m, p]) await x.ctx.close();
});

await run("SAVE", async () => {
  const C = chatServer();
  const calls = [];
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, calls });
  await nav(m.page, "schedule", 2600);
  // пока руководитель смотрит график, в чате Вера отдала сегодняшнюю смену, Анна забрала
  const off = C.rpc("chat_shift_offer", { p_token: "tok-vera", p_chat: 1, p_date: D(0), p_mode: "give", p_want: [], p_note: "" });
  const tk = C.rpc("chat_shift_take", { p_token: "tok-anna", p_msg: off.msg && off.msg.id });
  ok("SAVE: в чате смена перешла (сервер)", !!tk.ok && monOf(C.S, D(0)).plan["3"][dayN(D(0))] === "В", JSON.stringify(tk).slice(0, 120));
  // руководитель ставит Петру утро сегодня (своя правка) и сохраняет
  const idx = await m.page.evaluate((d) => [...document.querySelectorAll("[data-day-open]")].map((e) => e.getAttribute("data-day-open")).indexOf(d), dayN(D(0)));
  ok("SAVE: сегодняшний день виден в таблице графика", idx >= 0, String(idx));
  await m.page.locator('tr:has([data-person-open="4"]) td.sa-schedcell').nth(Math.max(0, idx)).click(); await sleep(700);
  await m.page.locator("button", { hasText: "Утро" }).first().click(); await sleep(600);
  ok("SAVE: правка — плашка «1 изменение не сохранено»", /1 изменение не сохранено/.test(await txt(m.page.locator("[data-savebar]"))), await txt(m.page.locator("[data-savebar]")));
  await m.page.locator("[data-savebar] button", { hasText: "Сохранить" }).click(); await sleep(1500);
  const saved = C.S.saved.pop(), pl = saved && saved.payload.plan, dd = dayN(D(0));
  ok("SAVE: «Сохранить» свёл с сервером: смена из чата (у Анны «В», у Веры пусто) и своя правка (Пётр «У»)", !!pl && pl["3"][dd] === "В" && !pl["6"][dd] && pl["4"][dd] === "У" && saved.payload.locks["3"][dd] && saved.payload.locks["4"][dd], JSON.stringify(pl && [pl["3"], pl["6"], pl["4"]]));
  const msg = await body(m.page);
  ok("SAVE: сказано: «Сохранено вместе с обменами из чата (" + dd + "-е)»", msg.includes("Сохранено вместе с обменами из чата (" + dd + "-е)"), (msg.match(/Сохран[^.]{0,80}/) || [""])[0]);
  ok("SAVE: перед сохранением график взят с сервера ещё раз", calls.filter((c) => c.fn === "schedule_load").length >= 2);
  await shot(m.page, "save-merged");
  const [e1, e2] = noErr(m);
  ok("SAVE: без ошибок в консоли", e1, e2);
  await m.ctx.close();
});

await run("NARROW", async () => {
  for (const light of [false, true]) {
    const tag = "NARROW" + (light ? " светлая" : "");
    const C = chatServer();
    C.rpc("chat_shift_offer", { p_token: "tok-vera", p_chat: 1, p_date: D(1), p_mode: "give", p_want: [], p_note: "Сестра выходит замуж" });
    C.rpc("chat_shift_offer", { p_token: "tok-anna", p_chat: 1, p_date: D(5), p_mode: "swap", p_want: [D(4), D(6), D(7)], p_note: "" });
    C.rpc("chat_card_send", { p_token: "tok-maria", p_chat: 1, p_card: { t: "task", item: { kind: "lesson", id: "s1-1", title: "Что такое сервис?", sub: "Новичок · Мышление сервиса" }, due: D(1) } });
    C.rpc("chat_card_send", { p_token: "tok-anna", p_chat: 1, p_card: { t: "poll", q: "Кто выйдет на банкет в субботу?", opts: ["Я смогу", "Не смогу", "Смогу до 22:00"] } });
    C.rpc("chat_stop_set", { p_token: "tok-maria", p_chat: 1, p_dish: "ok2608", p_on: true, p_msg: null });
    C.rpc("chat_card_send", { p_token: "tok-anna", p_chat: 1, p_card: { t: "share", item: { kind: "cocktail", id: "old-fashioned", title: "Олд фэшн", sub: "бурбон, сахар, биттер" } } });
    const q = C.rpc("chat_send", { p_token: "tok-olga", p_chat: 1, p_body: "@Наставник, какие аллергены в креветке темпура?", p_reply: null });
    C.rpc("chat_ai_post", { p_token: "tok-olga", p_chat: 1, p_reply: q.msg.id, p_body: "В креветке темпура: моллюски и ракообразные, орехи, глютен, яйца, молоко и рыба.", p_cards: [{ kind: "dish", id: "ok2602", title: "Креветка темпура", sub: "Закуски · креветка, темпура" }] });
    const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, w: 320, h: 640, light });
    await openChat(m.page);
    let f = await fits(m.page, "[data-chat] *");
    ok(tag + ": лента с карточками на 320 px — без прокрутки вбок", f.sw <= f.W && f.over === 0, JSON.stringify(f));
    await shot(m.page, "narrow-feed" + (light ? "-light" : ""));
    await m.page.evaluate(() => { const s = document.querySelector("[data-chat] .ch-scroll, [data-chat] [data-chat-scroll]"); if (s) s.scrollTop = 0; });
    await sleep(300);
    await shot(m.page, "narrow-feed-top" + (light ? "-light" : ""));
    await plus(m.page);
    f = await fits(m.page, "[data-chat] *");
    ok(tag + ": «+» на 320 px — девять плиток без прокрутки вбок", (await m.page.locator("[data-chat-act]:not([data-chat-act='late']):not([data-chat-act='thx'])").count()) === 9 && f.sw <= f.W && f.over === 0, JSON.stringify(f));
    await shot(m.page, "narrow-plus" + (light ? "-light" : ""));
    await m.page.locator('[data-chat-act="swap"]').click(); await sleep(900);
    await m.page.locator("[data-chat-myshift]").first().click(); await sleep(300);
    f = await fits(m.page, "[data-chat] *");
    ok(tag + ": «Поменяться сменой» на 320 px — дни взамен переносятся, без прокрутки вбок", f.sw <= f.W && f.over === 0, JSON.stringify(f));
    await shot(m.page, "narrow-swap" + (light ? "-light" : ""));
    ok(tag + ": без ошибок в консоли", !m.errors.length, m.errors.slice(0, 3).join(" | "));
    await m.ctx.close();
  }
});

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
