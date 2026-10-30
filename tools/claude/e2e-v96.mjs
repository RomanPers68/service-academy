// e2e v96 (Доп. 409): клавиатура на iPhone — ровный ход; Наставник прикладывает только то блюдо, о котором спросили.
// Запись владельца (v95, 60 кадров в секунду): строка ввода дрожала относительно клавиатуры на 8–15 px (отступ, который
// код менял каждый кадр, на iPhone в Telegram доходит до экрана неровно) и трогалась позже неё (2 кадра под клавиатурой
// при открытии, щель до 95 px при закрытии). Теперь ход ведёт браузер (Web Animations, transform у ленты, строки ввода и
// листов), раскладка меняется один раз и в тот же кадр покрывается трансформом и прокруткой (зазор ленты до низа тот же);
// ход — по кривой клавиатуры с записи, с момента нажатия. Telegram на iPhone — по его исходникам (как в e2e-v94 и
// e2e-v95): высота сразу, окно сжимается через 0,4 с и растёт сразу, «молча».
// Замер — после отрисовки кадра (rAF → задача), время — метка кадра (по ней браузер ставит анимации); замер, перед
// которым окно сменило размер уже после кадра, не в счёт (на экране его не было). «Без рывков» — не быстрее 2,2 % пути
// за мс: клавиатура в самом быстром месте — 1,7 %, плюс догон, когда опоздали.
// Разделы:
//   OPEN   — фокус: строка ввода трогается в первом же кадре (высота с прошлого раза), до сообщения Telegram; едет
//            анимацией браузера, а не отступом (отступ меняется один раз, в конце); в каждом кадре там же, где
//            клавиатура (±10 %), вверх без возвратов и рывков; последнее сообщение не отрывается от строки ни в одном
//            кадре; в конце строка над клавиатурой, сообщение над строкой; окно сжалось молча — ни на кадр;
//   CLOSE  — клавиатура ушла после сжатия окна: строка трогается с ростом окна, догоняет клавиатуру за 0,06 с, вниз без
//            возвратов и рывков, через 0,3 с внизу, лента у низа; ушла сразу (до сжатия) — строка трогается в первом же
//            кадре и идёт по кривой клавиатуры;
//   FIRST  — первый раз (высоты ещё нет): ждём Telegram и догоняем клавиатуру за 50 мс; высота запомнена (sa_kb_k);
//   HIST   — история пролистана вверх: сообщения едут вместе со строкой весь путь и не прыгают, когда меняется раскладка;
//   SHEET  — лист «Опрос» с полем: едет вместе с клавиатурой по её кривой, в конце над ней; ничто не едет дважды;
//   AI     — Наставник: то же (и когда экран ещё въезжает); лента уходит под шапку, не налезая на неё;
//   CALM   — «Уменьшить движение»: без анимаций и переходов, сразу на месте, ни кадра в промежуточном положении;
//   NARROW — 320 px, обе темы: в пути и в конце ничего не выезжает вбок;
//   CARDS  — «что входит в салат два моря»: одна карточка, сам салат (без «Морской ёж», «Мороженое», «Краб стригун»),
//            в чате и на экране «Наставник»; «что входит в морского ежа» — карточка «Морской ёж».
// v98 (Доп. 411): строка трогается не с фокуса, а с сообщения Telegram о высоте (клавиатура поехала за 20 мс до него):
// в OPEN до сообщения строка стоит, сверка с кривой — со второго кадра после него; в FIRST высоту больше не запоминаем;
// догон за 20 мс — «без рывков» теперь не быстрее 3 % пути за мс. Пауза Telegram и вырез снизу — в e2e-v98.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v96.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5296, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v96";
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
  window.__tgViewport = (h) => { vh = h; (ev.viewportChanged || []).slice().forEach((f) => { try { f({ isStateStable: true }); } catch (e) { /* */ } }); };
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


// ── v96: ход по кадрам — после отрисовки кадра (rAF → задача), как видит человек ──
// bar — строка ввода (или лист), glue — последний элемент ленты: расстояние до строки не должно меняться ни в одном кадре.
// Ход смотрим по верху строки (bt): низ строки с вырезом снизу (34 px) в пути под клавиатурой, а в конце, когда вырез
// убирается, меняется только эта скрытая часть; видимая — поле и верх строки — стоит.
const { KB_OPEN, KB_CLOSE, kbCurve } = await import(SRC + "/ui/keyboard.js");
const startTrack = (page, { act = "", ms = 480, bar = ".ch-bar", root = "[data-chat]", glue = "[data-chat-msg]", tgAt = 18, kh = KH, h = H, input = "[data-chat-input]" } = {}) =>
  page.evaluate(({ act, ms, bar, root, glue, tgAt, kh, h, input }) => {
    const out = []; window.__trk = out; window.__trkDone = false;
    const t0 = performance.now();
    const q = (s) => document.querySelector(s);
    const rr = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10 }; };
    // ft — время кадра (метка requestAnimationFrame): по нему браузер ставит анимации и рисует клавиатуру; t — когда замерили
    const f = (ts) => {
      const ft = Math.round(ts - t0), ih0 = window.innerHeight;
      setTimeout(() => {
        const b = q(bar), rt = q(root), gs = glue ? document.querySelectorAll(glue) : [], g = window.__glueEl || (gs.length ? gs[gs.length - 1] : null);
        const br = rr(b), gr = rr(g);
        out.push({ t: Math.round(performance.now() - t0), ft, bt: br && br.top, bb: br && br.bottom, gb: gr && gr.bottom, gt: gr && gr.top,
          pad: rt ? parseFloat(getComputedStyle(rt).paddingBottom) || 0 : null, an: b && b.getAnimations ? b.getAnimations().filter((a) => a.playState === "running").length : 0,
          ih: window.innerHeight, ih0, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth });
      }, 0);
      if (performance.now() - t0 < ms) requestAnimationFrame(f); else setTimeout(() => { window.__trkDone = true; }, 40);
    };
    requestAnimationFrame(f);
    // действие — в тот же миг, что и начало замера
    // v98: когда сообщение Telegram пришло на самом деле (под нагрузкой таймер опаздывает) — от него и считается ход
    window.__tgRel = null;
    if (act === "open" || act === "open-late") { const ta = q(input); ta.focus(); setTimeout(() => { window.__tgViewport(h - kh); window.__tgRel = Math.round(performance.now() - t0); }, tgAt); }
    if (act === "blur") { const a = document.activeElement; if (a && a.blur) a.blur(); }
    if (act === "blur-tg") { const a = document.activeElement; if (a && a.blur) a.blur(); setTimeout(() => window.__tgViewport(h), 10); }
  }, { act, ms, bar, root, glue, tgAt, kh, h, input });
// окно сменило размер уже после кадра, до замера: замер показал бы раскладку, которой на экране не было (кадр нарисован
// со старым окном, а ResizeObserver сработает в следующем кадре, до его отрисовки) — такие замеры не в счёт
const endTrack = async (page) => { await until(() => page.evaluate(() => window.__trkDone), 4000, 50); return page.evaluate(() => window.__trk.filter((x) => x.bb != null && x.ih === x.ih0)); };
// v98: начало хода клавиатуры — за 20 мс до сообщения Telegram (KB_LAG_OPEN), но не раньше фокуса
const kbAt0 = async (page) => Math.max(0, ((await page.evaluate(() => window.__tgRel)) || 0) - 20);
// ход: только в одну сторону; без рывков — не быстрее 2,2 % пути за мс (клавиатура в самом быстром месте — 1,7 %,
// плюс догон, когда опоздали). Скорость — по времени кадров: в безголовом Chromium кадры иногда пропускаются
const steps = (s, from = 0) => { const st = []; for (let i = Math.max(1, from); i < s.length; i++) st.push(s[i].bt - s[i - 1].bt); return st; };
const oneWay = (st, dir) => st.every((d) => (dir < 0 ? d <= 0.6 : d >= -0.6));
const vmax = (s, key = "bt") => { let v = 0; for (let i = 1; i < s.length; i++) { const dt = s[i].ft - s[i - 1].ft, d = Math.abs(s[i][key] - s[i - 1][key]); v = Math.max(v, dt >= 8 ? d / dt : d / 8); } return Math.round(v * 100) / 100; };
// v98: догон за 20 мс (KB_CATCH), а не за 50 — не быстрее 3 % пути за мс (клавиатура и сама в первом кадре проходит треть)
const smoothOk = (s, trav, key = "bt") => vmax(s, key) <= Math.abs(trav) * 0.03;
const glued = (s) => { const g = s.filter((x) => x.gb != null).map((x) => x.bt - x.gb); return g.length ? Math.round((Math.max(...g) - Math.min(...g)) * 10) / 10 : 0; };
// в покое: последнее сообщение прямо над строкой ввода (не под ней и не далеко над)
const restGap = (page, bar = ".ch-bar", glue = "[data-chat-msg]") => page.evaluate(({ bar, glue }) => new Promise((res) => requestAnimationFrame(() => {
  const b = document.querySelector(bar), gs = document.querySelectorAll(glue), g = gs[gs.length - 1];
  res(b && g ? Math.round(b.getBoundingClientRect().top - g.getBoundingClientRect().bottom) : null);
})), { bar, glue });
const gapOk = (g) => g != null && g >= 0 && g <= 40;
const seedKb = (w = 393, h = H, k = KH) => ({ sa_kb_k: JSON.stringify({ w, h, k }) });
const fill = async (C, n) => { for (let i = 1; i <= n; i++) C.rpc("chat_send", { p_token: "tok-anna", p_chat: 1, p_body: "Сообщение " + i + ": банкет на веранде, столы 5 и 6 сдвигаем к окну" }); };

await run("OPEN", async () => {
  const C = chatServer(); await fill(C, 12);
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, init: TG_IOS, motion: "no-preference", seedExtra: seedKb() });
  await openChat(a.page, "team");
  const rest = await rectNow(a.page, ".ch-bar");
  await startTrack(a.page, { act: "open" });
  const s = await endTrack(a.page);
  const run0 = s.filter((x) => x.t < 250), fin = s[s.length - 1];
  // v98: строка трогается не с фокуса, а с сообщения Telegram о высоте (здесь — через 18 мс): клавиатура поехала до него
  const tgO = (await a.page.evaluate(() => window.__tgRel)) || 18;
  const f1 = s.find((x) => x.ft >= tgO + 8), f0 = s.filter((x) => x.t < tgO);
  ok("OPEN: до сообщения Telegram строка стоит, с первым кадром после него — трогается (v98)", s.length > 10 && f0.every((x) => Math.abs(x.bt - rest.top) <= 1) && !!f1 && f1.ft <= tgO + 50 && rest.top - f1.bt >= 20, JSON.stringify({ tgO, rest, first: s.slice(0, 3) }));
  ok("OPEN: едет анимацией браузера (Web Animations), а не отступом: в пути отступ слоя 0, анимация идёт", run0.filter((x) => x.an > 0).length >= run0.length - 2 && run0.every((x) => x.pad === 0), JSON.stringify(run0.map((x) => [x.t, x.pad, x.an]).slice(0, 8)));
  ok("OPEN: раскладка меняется один раз — в конце (отступ = высоте клавиатуры), анимации сняты", fin.pad === KH && fin.an === 0 && new Set(s.map((x) => x.pad)).size === 2, JSON.stringify({ pads: [...new Set(s.map((x) => x.pad))], fin }));
  const st = steps(s);
  ok("OPEN: только вверх, без возвратов и рывков", oneWay(st, -1) && smoothOk(s, rest.top - fin.bt), JSON.stringify({ st: st.map((d) => Math.round(d)), v: vmax(s), cap: (rest.top - fin.bt) * 0.03 }));
  const K0 = await kbAt0(a.page), trav = rest.top - fin.bt, ms = s.filter((x) => x.ft >= K0 + 36 && x.ft <= 200);   // v98: со второго кадра после сообщения Telegram
  ok("OPEN: в каждом кадре — там же, где клавиатура в этот миг (по кривой KB_OPEN, ±10 %)", ms.length >= 3 && ms.every((x) => Math.abs((rest.top - x.bt) / trav - kbCurve(KB_OPEN, x.ft - K0)) <= 0.10), JSON.stringify({ K0, f: ms.map((x) => [x.ft, Math.round((rest.top - x.bt) / trav * 100), Math.round(kbCurve(KB_OPEN, x.ft - K0) * 100)]) }));
  const tail = s.filter((x) => x.ft >= 330), near = s.filter((x) => x.ft < 330 && x.ft > 250).slice(-1)[0];
  ok("OPEN: когда вырез снизу убран (конец пути), видимая часть не сдвинулась: верх строки на месте", tail.length >= 2 && !!near && Math.max(...tail.map((x) => x.bt)) - Math.min(...tail.map((x) => x.bt)) <= 1 && Math.abs(tail[0].bt - near.bt) <= 2, JSON.stringify(s.slice(-6).map((x) => [x.ft, x.bt, x.bb, x.pad])));
  ok("OPEN: последнее сообщение не отрывается от строки ввода ни в одном кадре (и когда меняется раскладка)", glued(s) <= 2, String(glued(s)));
  ok("OPEN: в конце строка ввода прямо над клавиатурой", fin.bb <= H - KH && fin.bb >= H - KH - 14, JSON.stringify(fin));
  const g0 = await restGap(a.page);
  ok("OPEN: и последнее сообщение прямо над ней (лента у низа, как была)", gapOk(g0), String(g0));
  const sh = await tgShrink(a.page, ".ch-bar", H - KH, 393, true);
  ok("OPEN: окно сжалось молча — строка ввода не сдвинулась ни на кадр, отступ 0", sh.after > 3 && sh.moved <= 1 && (await kbVar(a.page, "[data-chat]")) === 0, JSON.stringify(sh));
  const g1 = await restGap(a.page);
  ok("OPEN: и сообщения не сдвинулись (зазор до строки тот же)", gapOk(g1) && Math.abs(g1 - g0) <= 1, JSON.stringify({ g0, g1 }));
  await shot(a.page, "open-end");
  const [e1, e2] = noErr(a);
  ok("OPEN: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("CLOSE", async () => {
  const C = chatServer(); await fill(C, 12);
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, init: TG_IOS, motion: "no-preference", seedExtra: seedKb() });
  await openChat(a.page, "team");
  const rest = await rectNow(a.page, ".ch-bar");
  await startTrack(a.page, { act: "open" }); await endTrack(a.page);
  await tgShrink(a.page, ".ch-bar", H - KH, 393, true);
  const up = await rectNow(a.page, ".ch-bar");
  // после сжатия окна: фокус ушёл, через кадр окно растёт «молча», Telegram сообщает высоту
  await startTrack(a.page, { act: "blur", ms: 620 });
  await sleep(16);
  await mute(a.page, true);
  await a.page.evaluate((h) => window.__tgViewport(h), H);
  await a.page.setViewportSize({ width: 393, height: H });
  await sleep(760);
  await mute(a.page, false);
  const s = await endTrack(a.page);
  const ig = s.findIndex((x) => x.ih === H), aft = ig >= 0 ? s.slice(ig) : [], pre = ig > 0 ? s.slice(0, ig) : [];
  const st = steps(s, Math.max(1, ig));
  ok("CLOSE: пока окно не выросло, строка ввода стоит у клавиатуры (низ окна ещё там)", pre.length >= 1 && pre.every((x) => Math.abs(x.bt - up.top) <= 1), JSON.stringify({ up, pre }));
  ok("CLOSE: окно выросло — в тот же кадр раскладка без клавиатуры (отступ 0), а строка не падает вниз разом (≤ 12 px)", aft.length > 5 && aft.every((x) => x.pad === 0) && aft[0].bt - up.top <= 12, JSON.stringify({ before: pre.slice(-1), first: aft.slice(0, 3) }));
  ok("CLOSE: вниз без возвратов и рывков: догоняет клавиатуру, а не прыгает разом", oneWay(st, 1) && smoothOk(aft, rest.top - up.top), JSON.stringify({ st: st.map((d) => Math.round(d)), v: vmax(aft), cap: (rest.top - up.top) * 0.03 }));
  const tr = rest.top - up.top, catchAt = aft.length ? aft[0].ft + 60 : 1e9, cs = aft.filter((x) => x.ft >= catchAt && x.ft <= 220);
  ok("CLOSE: опоздала на кадр — через 0,06 с идёт вровень с клавиатурой (±10 %)", cs.length >= 2 && cs.every((x) => Math.abs((x.bt - up.top) / tr - kbCurve(KB_CLOSE, x.ft)) <= 0.10), JSON.stringify(cs.map((x) => [x.ft, Math.round((x.bt - up.top) / tr * 100), Math.round(kbCurve(KB_CLOSE, x.ft) * 100)])));
  const at = aft.find((x) => x.t >= 320);
  ok("CLOSE: через 0,32 с после ухода фокуса строка внизу, анимации сняты", !!at && Math.abs(at.bt - rest.top) <= 2 && Math.abs(at.bb - rest.bottom) <= 2 && s[s.length - 1].an === 0, JSON.stringify({ at, rest }));
  ok("CLOSE: последнее сообщение не отрывается от строки ни в одном кадре (и в кадр, когда окно выросло)", glued(s) <= 2, String(glued(s)));
  const g2 = await restGap(a.page);
  ok("CLOSE: внизу последнее сообщение прямо над строкой (лента у низа)", gapOk(g2), String(g2));
  // ушла сразу, до сжатия окна (Telegram ещё не сжал): строка трогается в тот же кадр
  await startTrack(a.page, { act: "open" }); await endTrack(a.page);
  const up2 = await rectNow(a.page, ".ch-bar");
  await startTrack(a.page, { act: "blur-tg", ms: 420 });
  const s2 = await endTrack(a.page);
  const st2 = steps(s2);
  const g3 = await restGap(a.page);
  ok("CLOSE: открыли снова — последнее сообщение опять прямо над строкой", gapOk(g3), String(g3));
  const f2 = s2.find((x) => x.ft >= 8);
  ok("CLOSE: клавиатура ушла до сжатия окна — строка трогается в первом же кадре, вниз без возвратов и рывков, через 0,3 с внизу", !!f2 && f2.ft <= 40 && f2.bt - up2.top >= 4 && oneWay(st2, 1) && smoothOk(s2, rest.top - up2.top) && !!s2.find((x) => x.ft >= 300 && Math.abs(x.bt - rest.top) <= 2), JSON.stringify({ up2, first: s2.slice(0, 3), st: st2.map((d) => Math.round(d)), v: vmax(s2) }));
  const m2 = s2.filter((x) => x.ft >= 8 && x.ft <= 220), tr2 = rest.top - up2.top;
  ok("CLOSE: и в каждом кадре там же, где клавиатура (по кривой KB_CLOSE, ±10 %)", m2.length >= 8 && m2.every((x) => Math.abs((x.bt - up2.top) / tr2 - kbCurve(KB_CLOSE, x.ft)) <= 0.10), JSON.stringify(m2.map((x) => [x.ft, Math.round((x.bt - up2.top) / tr2 * 100), Math.round(kbCurve(KB_CLOSE, x.ft) * 100)])));
  ok("CLOSE: и тут сообщения не отрываются от строки", glued(s2) <= 2, String(glued(s2)));
  const g4 = await restGap(a.page);
  ok("CLOSE: и внизу последнее сообщение прямо над строкой", gapOk(g4), String(g4));
  const [e1, e2] = noErr(a);
  ok("CLOSE: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("FIRST", async () => {
  const C = chatServer(); await fill(C, 12);
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, init: TG_IOS, motion: "no-preference" });
  await openChat(a.page, "team");
  const rest = await rectNow(a.page, ".ch-bar");
  ok("FIRST: высоты клавиатуры ещё нет (sa_kb_k пусто)", (await a.page.evaluate(() => localStorage.getItem("sa_kb_k"))) == null);
  await startTrack(a.page, { act: "open-late", tgAt: 40 });
  const s = await endTrack(a.page);
  const pre = s.filter((x) => x.ft < 34), fin = s[s.length - 1];
  const K0F = await kbAt0(a.page), at = s.find((x) => x.ft >= K0F + 55 && x.ft <= K0F + 110);   // v98: от сообщения Telegram
  ok("FIRST: до сообщения Telegram строка стоит (высоты не знаем — не выдумываем)", pre.length >= 1 && pre.every((x) => Math.abs(x.bt - rest.top) <= 0.6), JSON.stringify(pre));
  const travT = rest.top - fin.bt;
  // v98: клавиатура поехала за 20 мс до сообщения Telegram (KB_LAG_OPEN) — с ней и сверяем
  ok("FIRST: после — догоняет клавиатуру: к 0,1 с идёт с ней вровень (±10 %)", !!at && Math.abs((rest.top - at.bt) / travT - kbCurve(KB_OPEN, at.ft - K0F)) <= 0.10, JSON.stringify({ K0F, at, p: at && (rest.top - at.bt) / travT, kb: at && kbCurve(KB_OPEN, at.ft - K0F) }));
  const st = steps(s);
  ok("FIRST: только вверх, без рывков (догон за 0,02 с); в конце над клавиатурой; сообщения не отрываются", oneWay(st, -1) && smoothOk(s, travT) && fin.bb <= H - KH && fin.bb >= H - KH - 14 && glued(s) <= 2, JSON.stringify({ st: st.map((d) => Math.round(d)), v: vmax(s), cap: travT * 0.03, fin, g: glued(s) }));
  // v98: высоту «с прошлого раза» больше не помним — ход всё равно ждёт сообщения Telegram
  ok("FIRST: высоту клавиатуры не запоминаем (sa_kb_k не пишется, v98)", (await a.page.evaluate(() => localStorage.getItem("sa_kb_k"))) == null);
  const [e1, e2] = noErr(a);
  ok("FIRST: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("HIST", async () => {
  const C = chatServer(); await fill(C, 60);
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, init: TG_IOS, motion: "no-preference", seedExtra: seedKb() });
  await openChat(a.page, "team");
  // история выше: пролистали на 900 px; следим за сообщением посреди экрана
  await a.page.evaluate(() => { const f = document.querySelector("[data-chat-feed]"); f.scrollTop = Math.max(0, f.scrollTop - 900); });
  await sleep(500);
  const g0 = await a.page.evaluate(() => { const ms = [...document.querySelectorAll("[data-chat-msg]")]; window.__glueEl = ms.find((m) => m.getBoundingClientRect().top > 300) || ms[0]; return window.__glueEl.getBoundingClientRect().top; });
  const rest = await rectNow(a.page, ".ch-bar");
  await startTrack(a.page, { act: "open" });
  const s = await endTrack(a.page);
  const fin = s[s.length - 1], trav = rest.top - fin.bt;
  ok("HIST: сообщение посреди истории прошло весь путь вместе со строкой ввода (не осталось на месте и не убежало)", trav > 250 && Math.abs((g0 - fin.gt) - trav) <= 2, JSON.stringify({ g0, gEnd: fin.gt, trav }));
  const d = s.map((x) => x.bt - x.gt), spread = Math.round((Math.max(...d) - Math.min(...d)) * 10) / 10;
  ok("HIST: сообщение в истории едет вместе со строкой ввода и не прыгает, когда меняется раскладка (расстояние то же, ±2 px)", spread <= 2, JSON.stringify({ spread, d: d.map(Math.round).slice(0, 6) }));
  const gt = s.map((x) => x.gt), st = []; for (let i = 1; i < gt.length; i++) st.push(gt[i] - gt[i - 1]);
  ok("HIST: в пути только вверх, без рывков", st.every((x) => x <= 0.6) && smoothOk(s, trav, "gt"), JSON.stringify({ st: st.map(Math.round), v: vmax(s, "gt") }));
  await startTrack(a.page, { act: "blur-tg", ms: 420 });
  const s2 = await endTrack(a.page);
  const d2 = s2.map((x) => x.bt - x.gt), spread2 = Math.round((Math.max(...d2) - Math.min(...d2)) * 10) / 10;
  ok("HIST: клавиатура ушла — то же: сообщение едет со строкой вниз, без прыжка", spread2 <= 2, JSON.stringify({ spread2 }));
  const [e1, e2] = noErr(a);
  ok("HIST: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("SHEET", async () => {
  const C = chatServer();
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, init: TG_IOS, motion: "no-preference", seedExtra: seedKb() });
  await openChat(a.page, "team");
  await plus(a.page, "poll");
  const nested = await a.page.evaluate(() => document.querySelectorAll("[data-kbm] [data-kbm]").length);
  ok("SHEET: ничто не едет дважды: внутри того, что едет с клавиатурой (затемнение с листом), нет второго такого же", nested === 0, String(nested));
  const rest = await rectNow(a.page, ".ch-sheet");
  await startTrack(a.page, { act: "open", bar: ".ch-sheet", glue: "", input: "[data-chat-pollq]" });
  const s = await endTrack(a.page);
  const fin = s[s.length - 1], st = steps(s);
  const K0S = await kbAt0(a.page), f1 = s.find((x) => x.ft >= K0S + 28), trS = rest.top - fin.bt, msS = s.filter((x) => x.ft >= K0S + 36 && x.ft <= 200);   // v98: с сообщения Telegram
  ok("SHEET: лист «Опрос» трогается в первом кадре после сообщения Telegram, вверх без возвратов и рывков", !!f1 && f1.ft <= K0S + 70 && rest.top - f1.bt >= 20 && oneWay(st, -1) && smoothOk(s, trS), JSON.stringify({ first: s.slice(0, 3), st: st.map((d) => Math.round(d)), v: vmax(s) }));
  ok("SHEET: в каждом кадре — там же, где клавиатура (по кривой KB_OPEN, ±10 %)", msS.length >= 3 && msS.every((x) => Math.abs((rest.top - x.bt) / trS - kbCurve(KB_OPEN, x.ft - K0S)) <= 0.10), JSON.stringify({ K0S, f: msS.map((x) => [x.ft, Math.round((rest.top - x.bt) / trS * 100), Math.round(kbCurve(KB_OPEN, x.ft - K0S) * 100)]) }));
  ok("SHEET: в конце лист над клавиатурой (низ листа у её края), анимации сняты", Math.abs(fin.bb - (H - KH)) <= 2 && fin.an === 0, JSON.stringify(fin));
  await shot(a.page, "sheet-end");
  const [e1, e2] = noErr(a);
  ok("SHEET: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("AI", async () => {
  const a = await open({ init: TG_IOS, motion: "no-preference", seedExtra: seedKb() });
  await nav(a.page, "assistant", 1600);
  const BAR = ".sa-layer .sa-ai-bar", ROOT = ".sa-layer";
  const rest = await rectNow(a.page, BAR);
  const wrapOk = await a.page.evaluate(() => { const l = document.querySelector(".sa-layer [data-kbm-scroll]"); const w = l && l.parentElement; return !!w && getComputedStyle(w).overflow === "hidden" && getComputedStyle(l).position === "absolute"; });
  ok("AI: лента Наставника — в рамке (overflow: hidden): едет трансформом и уходит под шапку", wrapOk);
  await startTrack(a.page, { act: "open", bar: BAR, root: ROOT, glue: "", input: ".sa-layer textarea" });
  // посреди пути шапка не перекрыта лентой: в точке заголовка — шапка
  await sleep(60);
  // в точке заголовка — шапка, а не лента, хотя лента уже уехала под неё (её верх выше низа шапки)
  const head = await a.page.evaluate(() => {
    const t = [...document.querySelectorAll(".sa-layer div")].find((d) => d.childNodes[0] && d.childNodes[0].nodeType === 3 && d.childNodes[0].textContent.trim() === "Наставник");
    const list = document.querySelector(".sa-layer [data-kbm-scroll]");
    if (!t || !list) return null;
    const r = t.getBoundingClientRect(), hb = t.parentElement.getBoundingClientRect().bottom;
    const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { under: list.getBoundingClientRect().top < hb - 20, covered: !!e && list.contains(e), e: e && e.tagName };
  });
  const s = await endTrack(a.page);
  const fin = s[s.length - 1], st = steps(s);
  const K0A = await kbAt0(a.page), f1 = s.find((x) => x.ft >= K0A + 28), trA = rest.top - fin.bt, msA = s.filter((x) => x.ft >= K0A + 36 && x.ft <= 200);   // v98: с сообщения Telegram
  ok("AI: в каждом кадре — там же, где клавиатура (по кривой KB_OPEN, ±10 %)", msA.length >= 3 && msA.every((x) => Math.abs((rest.top - x.bt) / trA - kbCurve(KB_OPEN, x.ft - K0A)) <= 0.10), JSON.stringify({ K0A, f: msA.map((x) => [x.ft, Math.round((rest.top - x.bt) / trA * 100), Math.round(kbCurve(KB_OPEN, x.ft - K0A) * 100)]) }));
  ok("AI: посреди пути заголовок «Наставник» виден: лента уходит под шапку, а не поверх неё", !!head && head.under && !head.covered, JSON.stringify(head));
  ok("AI: строка трогается в первом кадре после сообщения Telegram, вверх без возвратов и рывков; отступ меняется один раз", !!f1 && f1.ft <= K0A + 70 && rest.top - f1.bt >= 20 && oneWay(st, -1) && smoothOk(s, rest.top - fin.bt) && new Set(s.map((x) => x.pad)).size === 2, JSON.stringify({ first: s.slice(0, 2), st: st.map((d) => Math.round(d)), pads: [...new Set(s.map((x) => x.pad))] }));
  ok("AI: в конце поле над клавиатурой", fin.bb <= H - KH && fin.bb >= H - KH - 16, JSON.stringify(fin));
  await startTrack(a.page, { act: "blur-tg", bar: BAR, root: ROOT, glue: "", ms: 420 });
  const s2 = await endTrack(a.page), st2 = steps(s2);
  ok("AI: клавиатура ушла — вниз без возвратов и рывков, через 0,3 с внизу", oneWay(st2, 1) && smoothOk(s2, rest.top - fin.bt) && !!s2.find((x) => x.ft >= 300 && Math.abs(x.bt - rest.top) <= 2), JSON.stringify({ st2: st2.map((d) => Math.round(d)), last: s2[s2.length - 1] }));
  const [e1, e2] = noErr(a);
  ok("AI: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("CALM", async () => {
  const C = chatServer(); await fill(C, 12);
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, init: TG_IOS, motion: "reduce", seedExtra: seedKb() });
  await openChat(a.page, "team");
  const rest = await rectNow(a.page, ".ch-bar");
  await startTrack(a.page, { act: "open" });
  const s = await endTrack(a.page);
  const end = s[s.length - 1], mids = s.filter((x) => Math.abs(x.bt - rest.top) > 1 && Math.abs(x.bt - end.bt) > 1);
  ok("CALM: «Уменьшить движение» — без анимаций, строка сразу на месте (промежуточных положений нет)", s.every((x) => x.an === 0) && mids.length === 0 && s[s.length - 1].bb <= H - KH, JSON.stringify({ mids: mids.slice(0, 3), last: s[s.length - 1] }));
  const [e1, e2] = noErr(a);
  ok("CALM: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await run("NARROW", async () => {
  for (const light of [false, true]) {
    const tag = light ? "светлая" : "тёмная";
    const C = chatServer(); await fill(C, 12);
    const a = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, w: 320, h: 640, light, init: TG_IOS, motion: "no-preference", seedExtra: seedKb(320, 640, 260) });
    await openChat(a.page, "team");
    await startTrack(a.page, { act: "open", kh: 260, h: 640 });
    const s = await endTrack(a.page), fin = s[s.length - 1];
    ok("NARROW " + tag + ": 320 px — в пути и в конце ничего не выезжает вбок, строка над клавиатурой, сообщения не отрываются", s.every((x) => x.sw <= x.cw + 1) && fin.bb <= 640 - 260 && fin.bb >= 640 - 260 - 14 && glued(s) <= 2, JSON.stringify({ fin, g: glued(s) }));
    await shot(a.page, "narrow-" + (light ? "light" : "dark"));
    const [e1, e2] = noErr(a);
    ok("NARROW " + tag + ": без ошибок в консоли", e1, e2);
    await a.ctx.close();
  }
});

// ── Наставник: карточки блюд (запись владельца: спросил «что входит в салат два моря» — пришёл и «Морской ёж») ──
const SEAS = { id: "sl9", name: "Салат два моря", cat: "Салаты", desc: "Салат с кальмаром и крабом.", ingredients: ["Сливочный крем на основе креметто, сливок и самодельного песто", "Огурец свежий", "Кальмар", "Краб Стригун", "Микс для заправки: растительное масло, соль, перец", "Соус руй: майонез со свит чили", "Кнелли с икрой: сливочный крем, вакаме и икра трески"], allergens: ["Молоко", "Яйца", "Моллюски и ракообразные", "Рыба"] };
const URCHIN = { id: "rb3", name: "Морской ёж", cat: "Row-bar", desc: "Морской ёж с желтком перепелиного яйца.", ingredients: ["Морской ёж (икра)", "Желток перепелиный", "Лимон"], allergens: ["Моллюски и ракообразные", "Яйца"] };
const CRAB = { id: "rb7", name: "Краб стригун", cat: "Row-bar", desc: "Краб стригун с икрой тобико и лаймом.", ingredients: ["Краб стригун", "Икра тобико", "Лайм"], allergens: ["Моллюски и ракообразные", "Рыба"] };
const ICE = { id: "ds2", name: "Мороженое", cat: "Десерты", desc: "Три шарика на выбор.", ingredients: ["Сливки", "Сахар"], allergens: ["Молоко"] };
const SEAS_REPLY = "Роман, вот состав салата «Два моря» из раздела «Меню» (порция 200 г, 338 ккал):\n\n1. Сливочный крем на основе креметто, сливок и самодельного песто\n2. Огурец свежий\n3. Кальмар\n4. Краб Стригун\n5. Микс для заправки: растительное масло, соль, перец\n6. Соус руй: майонез со свит чили\n7. Кнелли с икрой: сливочный крем, вакаме и икра трески\n\nАллергены: молоко, яйца, моллюски и ракообразные, рыба.";
const URCHIN_REPLY = "Морской ёж подаём с желтком перепелиного яйца и лимоном. В составе: икра морского ежа, желток, лимон.";
await run("CARDS", async () => {
  const C = chatServer();
  const menu = [URCHIN, ICE, CRAB, SEAS, ...MENU];
  const a = await open({ who: MARIA, token: "tok-maria", rpcs: (fn, b) => (fn === "menu_get" ? menu : C.rpc(fn, b)), seedExtra: { sa_menu_shared: JSON.stringify({ [R0]: menu }) },
    ai: async (body) => { await sleep(400); const q = JSON.stringify(body || {}); return { ok: true, reply: /ежа/.test(q) ? URCHIN_REPLY : SEAS_REPLY, model: "test" }; } });
  await openChat(a.page, "team");
  const ask = async (q, n) => {
    await a.page.locator("[data-chat-input]").fill(q);
    await a.page.locator("[data-chat-send]").click();
    await until(async () => (await a.page.locator("[data-chat-ai]").count()) === n, 9000);
    await sleep(300);
    return a.page.locator("[data-chat-ai]").nth(n - 1).locator('.ch-mini[data-chat-open="dish"] .ch-mini-t').allTextContents();
  };
  const t1 = await ask("@Наставник напомнишь что входит в салат два моря, океан?", 1);
  ok("CARDS: чат: «что входит в салат два моря» — под ответом одна карточка, сам салат (без «Морской ёж»: «моря» и «морской» — разные слова)", t1.length === 1 && t1[0] === "Салат два моря", JSON.stringify(t1));
  await shot(a.page, "cards-chat");
  const t2 = await ask("@Наставник что входит в морского ежа?", 2);
  ok("CARDS: чат: «что входит в морского ежа» — карточка «Морской ёж» (слова в любой форме по-прежнему узнаются)", t2.length === 1 && t2[0] === "Морской ёж", JSON.stringify(t2));
  // экран «Наставник»: тот же вопрос про салат
  await a.page.locator("[data-chat] [data-sa-back]").first().click(); await sleep(600);
  await a.page.locator("[data-chat] [data-sa-back]").first().click(); await sleep(900);
  await nav(a.page, "assistant", 1500);
  await a.page.locator(".sa-layer textarea").fill("напомнишь что входит в салат два моря, океан?");
  await a.page.locator('.sa-layer button.sa-btn:has(svg path[d="M22 2L11 13"])').click();
  ok("CARDS: Наставник: ответ пришёл", await until(async () => /Роман, вот состав салата/.test(await a.page.locator(".sa-layer").innerText()), 9000));
  await sleep(400);
  const lab = async (n) => a.page.locator('.sa-layer [aria-label="' + n + '"]').count();
  const [cS, cU, cI, cC] = [await lab("Салат два моря"), await lab("Морской ёж"), await lab("Мороженое"), await lab("Краб стригун")];
  ok("CARDS: Наставник: одна карточка «Салат два моря», без «Морской ёж», «Мороженое» и «Краб стригун»", cS === 1 && !cU && !cI && !cC, JSON.stringify({ cS, cU, cI, cC }));
  await shot(a.page, "cards-mentor");
  const [e1, e2] = noErr(a);
  ok("CARDS: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
