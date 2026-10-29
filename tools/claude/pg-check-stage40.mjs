// tools/claude/pg-check-stage40.mjs — v106 (Доп. 419): этап 40 («Утро руководителя») на настоящем Postgres.
// Одни и те же данные (заведение демо: график, опоздание, стоп-лист, «спасибо» гостей, занятия, брифинг, карточки смен)
// идут в сервер демо (tools/claude/demo-app/fake-server.js) и в базу с этапами 4–40; сводка _sa_morning_at, текст
// _sa_morning_text и кнопки _sa_morning_kb должны совпасть с демо и lib/morning.js до символа. Плюс RPC приложения
// (morning_brief, morning_set, morning_send_now, morning_nudge) и рассылка по расписанию (_sa_morning_due) — что ушло бы в
// Telegram (pg_net подменён таблицей net.sent_log).
// База — макет Supabase из tools/claude/sql: копия satest25 (сначала bash tools/claude/sql/run25.sh), сюда — этапы 26, 31,
// 32, 34, 35, 36, 37, 38, 39 и 40 из исходников; люди демо — со своими uuid (в макете id сотрудника — uuid), в ответах
// сервера они заменяются обратно на id демо. Сервер — PGHOST и PGPORT, как у tools/claude/sql (по умолчанию /tmp/pgsock
// и 5433), пользователь postgres.
// Запуск: PGHOST=<папка сокета> PGPORT=<порт> E2E_SRC=<исходники> node tools/claude/pg-check-stage40.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SRC = process.env.E2E_SRC || process.cwd();
const HOST = process.env.PGHOST || "/tmp/pgsock", PORT = process.env.PGPORT || "5433", BASE = process.env.PG_BASE || "satest25", DB = "sa_check40";
const { makeServer } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { morningText, morningKb, morningModel } = await import(SRC + "/lib/morning.js");
const { RESTAURANT_MENUS } = await import(SRC + "/data/menu.js");

const psql = (args, input) => execFileSync("psql", ["-h", HOST, "-p", PORT, "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", ...args], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const q1 = (sql) => psql(["-d", DB, "-At", "-c", sql]).trim();
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const jlit = (o) => lit(JSON.stringify(o)) + "::jsonb";

// ── заведение демо (как tools/claude/demo-app/boot.js) ──
const TODAY = "2026-10-29", NOW = "2026-10-28T21:05:00Z";   // четверг, 9:05 по Камчатке
const R0 = "Два моря, Океан";
const PEOPLE = [
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-olga", name: "Ольга", surname: "Ли", restaurant: R0, position: "hostess", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-darya", name: "Дарья", surname: "Лебедева", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender", is_admin: false },
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
// в макете Supabase id сотрудника и токен — uuid: у каждого человека демо свой, в ответах сервера — обратно id демо
const UID = Object.fromEntries(PEOPLE.map((p, i) => [p.id, "00000000-0000-4000-8040-" + String(i + 1).padStart(12, "0")]));
const TUID = Object.fromEntries(PEOPLE.map((p, i) => ["tok-" + p.id, "10000000-0000-4000-8040-" + String(i + 1).padStart(12, "0")]));
const U = (id) => UID[id] || id, TK = (t) => lit(TUID[t] || t);
const back = (txt) => Object.entries(UID).reduce((s, [id, u]) => s.split(u).join(id), String(txt));
const SSTAFF = [
  { id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Ли Ольга", pos: "host", norm: 160 },
  { id: 3, name: "Смирнова Анна", pos: "waiter", norm: 160 }, { id: 4, name: "Орлов Пётр", pos: "waiter", norm: 160 },
  { id: 5, name: "Соколова Вера", pos: "waiter", norm: 160 }, { id: 6, name: "Лебедева Дарья", pos: "waiter", norm: 160 },
  { id: 7, name: "Белов Илья", pos: "bar", norm: 160 },
];
const SHIFTS = [{ k: "У", name: "Утро", from: 10, to: 18 }, { k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }];
const CFG = { hours: Array.from({ length: 7 }, () => [12, 24]), shifts: SHIFTS, need: { 1: { waiter: 2 }, 2: { waiter: 2 }, 3: { waiter: 3 } }, split: {},
  rules: { peakDows: [4, 5], highDows: [3, 6], maxRow: 5, minOff: 2, minRest: 11, holidayPeak: true, wishDeadline: 0, autoFill: false, normMode: "floor" },
  posRules: {}, dayShift: "Д", staff: SSTAFF };
const NEAR = { 3: "ДД-ВВ--ДД-ВВ--", 4: "В-ДД-ВВ-ДД-ВВ-", 5: "-ВВ-ДД-В-ДД-ВВ", 6: "Д--Д--Д-В--Д-Д" };
function planOf() {
  const out = {};
  for (let i = -30; i <= 45; i++) {
    const set = (sid, k) => { if (k && k !== "-") (out[sid] = out[sid] || {})[i] = k; };
    const c2 = ((i % 4) + 4) % 4;
    set(1, c2 < 2 ? "Д" : ""); set(2, c2 >= 2 ? "Д" : ""); set(7, c2 === 1 || c2 === 2 ? "В" : "");
    if (i % 7 === 3 || i % 7 === -4) set(7, "Д");
    for (const sid of [3, 4, 5, 6]) { const row = NEAR[sid]; set(sid, i >= 0 && i < row.length ? row[i] : row[((i % row.length) + row.length) % row.length]); }
  }
  return out;
}
const MENU = JSON.parse(JSON.stringify(RESTAURANT_MENUS[R0] || []));
const STOP = MENU.filter((d) => d && d.name).slice(2, 5).map((d) => d.id);
MENU.forEach((d) => { if (STOP.includes(d.id)) Object.assign(d, { stop: { since: Date.parse(NOW), by: "Мария Ким" }, stopAt: Date.parse(NOW) }); });
const THANKS = [{ emp: "e-anna", at: -1, time: "19:40", text: "Анна подсказала с вином, всё было идеально" }, { emp: "e-anna", at: -1, time: "21:10", text: "Спасибо за внимательность!" },
  { emp: "e-petr", at: -1, time: "20:05", text: "Быстро и вежливо, спасибо" }, { emp: "e-vera", at: -1, time: "18:30", text: "" },
  { emp: "e-ilya", at: -2, time: "20:00", text: "Лучший негрони в городе" }, { emp: "e-olga", at: -1, time: "19:00", text: "скрытое", hidden: true }];
const LEARN = { "e-anna": [-1, -2, -3], "e-petr": [-9], "e-vera": [-1], "e-olga": [-2], "e-ilya": [-1], "u-maria": [-1] };   // Дарья — ни разу
const BRIEF_READS = { "-1": ["e-anna", "e-petr", "e-olga", "u-maria", "e-ilya"] };
const LINKED = ["u-maria", "u-roman", "e-anna", "e-petr"];

const addD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const D = (n) => addD(TODAY, n);
let clockMs = Date.parse(NOW);
const pings = [];
const srv = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu: MENU, clock: () => clockMs,
  thanks: THANKS, learn: LEARN, briefDays: BRIEF_READS, tgLinked: LINKED, ping: (...a) => pings.push(a) });
// опоздание Дарьи сегодня, карточки смен: Вера отдаёт (через 2 дня), Мария ищет официанта (через 6), Пётр меняется (через 9 — не неделя)
srv.S.late["e-darya|" + TODAY] = { emp: "e-darya", name: "Дарья Лебедева", rest: R0, day: TODAY, min: 20, eta: "12:20", note: null, msg: null, ok: null, at: "2026-10-28T21:00:00Z" };
const give = srv.bot.offer("e-vera", D(2), "give", "Нужно к врачу");
const need = srv.bot.need("u-maria", D(6), "waiter", "В", 1);
const swap = srv.bot.offer("e-petr", D(9), "swap", "");
const fails = [];
const ok = (name, cond, extra = "") => { console.log((cond ? "✓ " : "✗ ") + name + (cond || !extra ? "" : " — " + extra)); if (!cond) fails.push(name); };
ok("демо: карточки смен созданы", give && give.ok && need && need.ok && swap && swap.ok, JSON.stringify([give, need, swap]).slice(0, 300));

const fake = srv.rpc("morning_brief", { p_token: "tok-u-maria" });
ok("демо: morning_brief для руководителя", fake && fake.ok === true && fake.sched === true, JSON.stringify(fake).slice(0, 200));
ok("демо: сотруднику — нельзя", srv.rpc("morning_brief", { p_token: "tok-e-anna" }).error === "forbidden");

// ── та же база в Postgres ──
try { psql(["-d", "postgres", "-c", "drop database if exists " + DB, "-c", "create database " + DB + " template " + BASE]); }
catch (e) { console.log("✗ нет базы " + BASE + " — сначала bash tools/claude/sql/run25.sh\n" + String(e.stderr || e.message).slice(0, 400)); process.exit(1); }
for (const n of ["26-mastery", "31-qday", "32-briefing", "34-guest-thanks", "35-seating", "36-comfort", "37-halls-qday", "38-chat", "39-everyday", "40-morning"]) {
  psql(["-d", DB, "-f", SRC + "/supabase/supabase-stage" + n + ".sql"]);
}
const L = ["set client_min_messages = warning;",
  // люди макета (seed.sql, seed24.sql, seed25.sql) — из того же заведения: убираем, чтобы имена в графике узнавались однозначно
  "delete from tg_links; delete from sessions; delete from employees; delete from schedule_months; delete from schedule_venues;",
  "create table if not exists restaurant_menu (restaurant text primary key, dishes jsonb not null default '[]', updated_by text, updated_at timestamptz default now());"];
for (const p of PEOPLE) L.push(`insert into employees (id, name, surname, restaurant, position, is_admin) values (${lit(U(p.id))}, ${lit(p.name)}, ${lit(p.surname)}, ${lit(p.restaurant)}, ${lit(p.position)}, ${p.is_admin});`);
for (const [t, id] of Object.entries(TOK)) L.push(`insert into sessions (token, employee_id) values (${TK(t)}, ${lit(U(id))});`);
L.push(`insert into schedule_venues (restaurant, venue_key, title, config) values (${lit(R0)}, 'main', ${lit(R0)}, ${jlit(CFG)});`);
for (const [mk, pl] of Object.entries(srv.S.months)) L.push(`insert into schedule_months (restaurant, venue_key, month, payload) values (${lit(R0)}, 'main', ${lit(mk)}, ${jlit(pl)});`);
L.push(`insert into sa_late (emp_id, day, restaurant, emp_name, min, eta, at) values (${lit(U("e-darya"))}, ${lit(TODAY)}, ${lit(R0)}, 'Дарья Лебедева', 20, '12:20', '2026-10-28T21:00:00Z');`);
L.push(`insert into restaurant_menu (restaurant, dishes) values (${lit(R0)}, ${jlit(MENU)});`);
for (const t of THANKS) L.push(`insert into sa_guest_thanks (emp_id, restaurant, text, hidden, created_at) values (${lit(U(t.emp))}, ${lit(R0)}, ${lit(t.text)}, ${!!t.hidden}, (${lit(D(t.at) + " " + t.time)}::timestamp at time zone 'Asia/Kamchatka'));`);
for (const p of PEOPLE) {
  const act = Object.fromEntries((LEARN[p.id] || []).map((n) => [D(n), { st: 2, l: 1 }]));
  L.push(`insert into emp_learning (emp_id, emp_name, restaurant, data) values (${lit(U(p.id))}, ${lit(p.name + " " + p.surname)}, ${lit(R0)}, ${jlit({ v: 2, activity: act })});`);
}
L.push(`insert into sa_briefs (restaurant, day, data, text, author_id, author_name) values (${lit(R0)}, ${lit(D(-1))}, '{}'::jsonb, '', ${lit(U("u-maria"))}, 'Мария Ким');`);
for (const id of BRIEF_READS["-1"]) L.push(`insert into sa_brief_reads (restaurant, day, emp_id) values (${lit(R0)}, ${lit(D(-1))}, ${lit(U(id))});`);
for (const c of srv.S.chats) L.push(`insert into sa_chats (id, restaurant, kind) values (${c.id}, ${lit(c.rest || "")}, ${lit(c.kind)});`);
for (const m of srv.S.msgs) L.push(`insert into sa_chat_msgs (id, chat_id, emp_id, emp_name, emp_rest, body, kind, card) values (${m.id}, ${m.chat}, ${lit(U(m.emp))}, ${lit(m.name)}, ${lit(m.rest || "")}, ${lit(m.body || "")}, ${lit(m.kind)}, ${m.card ? jlit(m.card) : "null"});`);
LINKED.forEach((id, i) => L.push(`insert into tg_links (emp_id, chat_id, restaurant, full_name, remind) values (${lit(U(id))}, ${700001 + i}, ${lit(R0)}, '', true);`));
L.push(`insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST') on conflict (name) do update set decrypted_secret = excluded.decrypted_secret;`);
L.push(`insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value;`);
const dir = mkdtempSync(join(tmpdir(), "pg40-"));
writeFileSync(join(dir, "fx.sql"), L.join("\n"));
psql(["-d", DB, "-f", join(dir, "fx.sql")]);

// ── сводка: Postgres = демо ──
const pg = JSON.parse(back(q1(`select _sa_morning_at(${lit(U("u-maria"))}, ${lit(NOW)})`)));
const norm = (b) => JSON.parse(JSON.stringify(morningModel(b)));
const A = norm(pg), B = norm(fake);
for (const k of Object.keys(B)) ok("сводка: «" + k + "» — как в демо", JSON.stringify(A[k]) === JSON.stringify(B[k]), "\n   pg:   " + JSON.stringify(A[k]) + "\n   демо: " + JSON.stringify(B[k]));
ok("сводка: есть что проверять (смены, дыры, заявки, стоп, «спасибо», брифинг, занятия, давно не занимались, опоздание)",
  A.shifts.length >= 2 && A.holes.length > 0 && A.open.length === 2 && A.stop.n === 3 && A.thanks && A.thanks.n === 4 && A.ybrief && A.learn && A.idle.list.length >= 2 && A.late.length === 1,
  JSON.stringify({ s: A.shifts.length, h: A.holes.length, o: A.open.length, st: A.stop.n, t: A.thanks, y: A.ybrief, l: A.learn, i: A.idle, late: A.late }));
// ── текст и кнопки: Postgres = lib/morning.js ──
const tpg = q1(`select _sa_morning_text(${jlit(pg)}, 'Мария')`), tjs = morningText(pg, "Мария");
ok("текст сообщения — как lib/morning.js", tpg === tjs, "\n---pg---\n" + tpg + "\n---js---\n" + tjs);
console.log("\n" + tjs + "\n");
const kpg = JSON.parse(q1(`select _sa_morning_kb(${jlit(pg)})`));
const kjs = morningKb(pg).map((row) => row.map((x) => x.text + "→" + x.go));
ok("кнопки — как lib/morning.js, адрес приложения с ?go=", JSON.stringify(kpg.map((row) => row.map((x) => x.text + "→" + String(x.web_app && x.web_app.url).split("?go=")[1]))) === JSON.stringify(kjs)
  && kpg[0][0].web_app.url === "https://app.example/?go=morning", JSON.stringify(kpg));
// пустой день: ничего нет — короткое сообщение без пустых заголовков
const empty = { ok: true, day: TODAY, rest: R0, sched: false, shifts: [], count: 0, holes: [], open: [], stop: { n: 0, names: [] }, thanks: null, ybrief: null, learn: null, idle: { list: [], more: 0 }, brief: { done: true, at: "10:00" }, late: [] };
ok("пустой день — две строки приветствия, без заголовков", q1(`select _sa_morning_text(${jlit(empty)}, 'Мария')`) === morningText(empty, "Мария") && morningText(empty, "Мария").split("\n").length === 2, morningText(empty, "Мария"));
const esc = { ...empty, sched: true, count: 1, rest: "Бар <&>", shifts: [{ k: "Д", name: "День", from: 12, to: 20, people: [{ id: null, n: "Анна <b>С.", late: null }] }], stop: { n: 9, names: ["A&B", "C", "D", "E", "F", "G", "H", "I"] } };
ok("экранирование HTML и «и ещё» — как lib/morning.js", q1(`select _sa_morning_text(${jlit(esc)}, 'Мария')`) === morningText(esc, "Мария") && /Анна &lt;b&gt;С\./.test(morningText(esc, "Мария")) && /и ещё 3$/m.test(morningText(esc, "Мария")), morningText(esc, "Мария"));

// ── приложение: RPC ──
const call = (fn, args) => JSON.parse(back(q1(`select ${fn}(${args})`)));
ok("morning_brief: руководитель — сводка и настройки", (() => { const r = call("morning_brief", TK("tok-u-maria")); return r.ok && r.prefs && r.prefs.on === true && r.prefs.hour === 9 && r.prefs.linked === true && r.prefs.bot === true; })());
ok("morning_brief: сотрудник — forbidden, без токена — auth", call("morning_brief", TK("tok-e-anna")).error === "forbidden" && call("morning_brief", "'nope'").error === "auth");
ok("morning_set: час 8 и выключить; 13 часов — ошибка", (() => { const a = call("morning_set", TK("tok-u-maria") + ", null, 8"), b = call("morning_set", TK("tok-u-maria") + ", false, null"), c = call("morning_set", TK("tok-u-maria") + ", null, 13");
  return a.ok && a.prefs.hour === 8 && a.prefs.on === true && b.ok && b.prefs.on === false && b.prefs.hour === 8 && c.error === "hour"; })());
psql(["-d", DB, "-c", `update sa_notify_prefs set morning = true, morning_hour = 9 where emp_id = ${lit(U("u-maria"))}; delete from net.sent_log;`]);
ok("morning_send_now: уходит в Telegram с кнопками; второй раз в ту же минуту — too_fast", (() => { const a = call("morning_send_now", TK("tok-u-maria")), b = call("morning_send_now", TK("tok-u-maria"));
  const sent = JSON.parse(q1("select coalesce(jsonb_agg(body order by id), '[]') from net.sent_log"));
  return a.ok && b.error === "too_fast" && sent.length === 1 && sent[0].chat_id === 700001 && sent[0].parse_mode === "HTML" && /^<b>Доброе утро, Мария<\/b>/.test(sent[0].text)
    && sent[0].reply_markup.inline_keyboard[0][0].text === "Открыть утро"; })());
ok("morning_send_now: Ольга (не руководитель) — forbidden; без Telegram — not_linked", (() => {
  psql(["-d", DB, "-c", `update tg_links set remind = false where emp_id = ${lit(U("u-roman"))};`]);
  const r = call("morning_send_now", TK("tok-u-roman")); psql(["-d", DB, "-c", `update tg_links set remind = true where emp_id = ${lit(U("u-roman"))};`]);
  return call("morning_send_now", TK("tok-e-olga")).error === "forbidden" && r.error === "not_linked"; })());
psql(["-d", DB, "-c", "delete from net.sent_log;"]);
ok("morning_nudge: Петру уходит «напоминает про разминку» с кнопкой; второй раз за день — already; Дарье без Telegram — no_tg; чужому — not_found", (() => {
  const a = call("morning_nudge", TK("tok-u-maria") + ", " + lit(U("e-petr"))), b = call("morning_nudge", TK("tok-u-roman") + ", " + lit(U("e-petr"))),
    c = call("morning_nudge", TK("tok-u-maria") + ", " + lit(U("e-darya"))), d = call("morning_nudge", TK("tok-u-maria") + ", 'zzz'"), e = call("morning_nudge", TK("tok-e-anna") + ", " + lit(U("e-petr")));
  const sent = JSON.parse(q1("select coalesce(jsonb_agg(body order by id), '[]') from net.sent_log"));
  return a.ok && b.error === "already" && c.error === "no_tg" && d.error === "not_found" && e.error === "forbidden" && sent.length === 1 && sent[0].chat_id === 700004
    && sent[0].text === "Мария К. напоминает про разминку: 2 минуты, три ситуации из зала." && sent[0].reply_markup.inline_keyboard[0][0].text === "Разминка"; })(), q1("select coalesce(jsonb_agg(body), '[]') from net.sent_log"));
// ── по расписанию ──
psql(["-d", DB, "-c", "delete from net.sent_log; delete from tg_sent;"]);
const due = (iso) => JSON.parse(back(q1(`select _sa_morning_due(false, ${lit(iso)})`)));
ok("расписание: 8:55 — ещё рано, 9:05 — Марии и Роману (руководители с Telegram), Анне и Петру — нет", due("2026-10-28T20:55:00Z").length === 0
  && JSON.stringify(due(NOW).map((x) => x.emp).sort()) === JSON.stringify(["u-maria", "u-roman"]), JSON.stringify(due(NOW).map((x) => x.emp)));
ok("расписание: в 12:05 уже не шлём (окно три часа)", due("2026-10-29T00:05:00Z").length === 0);
psql(["-d", DB, "-c", `update sa_notify_prefs set morning = false where emp_id = ${lit(U("u-maria"))}; insert into sa_notify_prefs (emp_id, morning_hour) values (${lit(U("u-roman"))}, 10) on conflict (emp_id) do update set morning_hour = 10;`]);
ok("расписание: выключила — не шлём; Роман поставил 10:00 — в 9:05 ещё рано, в 10:05 пора", due(NOW).length === 0 && due("2026-10-28T22:05:00Z").map((x) => x.emp).join() === "u-roman");
psql(["-d", DB, "-c", "update sa_notify_prefs set morning = true, morning_hour = 9;"]);
const sent1 = JSON.parse(q1(`select _sa_morning_due(true, ${lit(NOW)})`)), sent2 = JSON.parse(q1(`select _sa_morning_due(true, ${lit("2026-10-28T21:15:00Z")})`));
ok("расписание: отправка — по одной в день (второй тик молчит), в Telegram ушло 2 сообщения", sent1.length === 2 && sent2.length === 0 && Number(q1("select count(*) from net.sent_log")) === 2);
ok("sa_morning_tick и sa_morning_preview работают", /^\d+$/.test(q1("select sa_morning_tick()")) && q1("select jsonb_typeof(sa_morning_preview())") === "array");
// ── этап можно запустить ещё раз ──
psql(["-d", DB, "-f", SRC + "/supabase/supabase-stage40-morning.sql"]);
ok("повторный запуск этапа — без ошибок, настройки целы", q1(`select morning_hour from sa_notify_prefs where emp_id = ${lit(U("u-roman"))}`) === "9");
psql(["-d", "postgres", "-c", "drop database if exists " + DB]);
console.log(`\n${fails.length ? "✗ не прошло: " + fails.length : "всё сошлось"}`);
process.exit(fails.length ? 1 : 0);
