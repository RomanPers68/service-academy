// tools/claude/pg-check-stage42.mjs — v108 (Доп. 421): этап 42 («Спасибо коллеге», дни рождения и годовщины) на настоящем
// Postgres против сервера демо. Одни и те же данные (заведение, график с «Д.р.» и «В команде с», новичок, пришедший год
// назад, «спасибо» прошлых дней) идут в сервер демо (tools/claude/demo-app/fake-server.js) и в базу с этапами; «спасибо» в
// профиле и за неделю, «спасибо» в карточке коллеги, новое «спасибо» и «Тоже спасибо», ошибки, праздники дня (карточки,
// сводки, сообщения бота) и «Поздравить» должны совпасть. Демо и e2e ходят в сервер демо — так видно, что он ведёт себя как
// этап.
// База — макет Supabase из tools/claude/sql: копия satest25 (сначала bash tools/claude/sql/run25.sh), сюда — этапы 26, 31,
// 32, 34–39, 41 и 42; люди демо — со своими uuid, в ответах сервера они заменяются обратно на id демо. PGHOST и PGPORT — как
// у tools/claude/sql (по умолчанию /tmp/pgsock и 5433).
// Запуск: PGHOST=<папка сокета> PGPORT=<порт> E2E_SRC=<исходники> node tools/claude/pg-check-stage42.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SRC = process.env.E2E_SRC || process.cwd();
const HOST = process.env.PGHOST || "/tmp/pgsock", PORT = process.env.PGPORT || "5433", BASE = process.env.PG_BASE || "satest25", DB = "sa_check42", TZ = "Asia/Kamchatka";
const { makeServer } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { cheerDm } = await import(SRC + "/lib/team-warm.js");

const psql = (args, input) => execFileSync("psql", ["-h", HOST, "-p", PORT, "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", ...args], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const jlit = (o) => lit(JSON.stringify(o)) + "::jsonb";
try { psql(["-d", "postgres", "-c", "drop database if exists " + DB, "-c", "create database " + DB + " template " + BASE]); }
catch (e) { console.log("✗ нет базы " + BASE + " — сначала bash tools/claude/sql/run25.sh\n" + String(e.stderr || e.message).slice(0, 400)); process.exit(1); }
const q1 = (sql) => psql(["-d", DB, "-At", "-c", sql]).trim();
const TODAY = q1(`select to_char((now() at time zone '${TZ}')::date, 'YYYY-MM-DD')`);
const addD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const D = (n) => addD(TODAY, n);
const dDiff = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const DM = TODAY.slice(8, 10) + "." + TODAY.slice(5, 7), Y = Number(TODAY.slice(0, 4));
const YEAR_AGO = TODAY.slice(5) === "02-29" ? (Y - 1) + "-02-28" : (Y - 1) + TODAY.slice(4);

// ── заведение (как демо): у Ильи сегодня день рождения, Вера два года в команде, Ксения пришла через «Новички» год назад ──
const R0 = "Два моря, Океан";
const PEOPLE = [
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender", is_admin: false },
  { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ksenia", name: "Ксения", surname: "Миронова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const UID = Object.fromEntries(PEOPLE.map((p, i) => [p.id, "00000000-0000-4000-8042-" + String(i + 1).padStart(12, "0")]));
const TUID = Object.fromEntries(PEOPLE.map((p, i) => ["tok-" + p.id, "10000000-0000-4000-8042-" + String(i + 1).padStart(12, "0")]));
const U = (id) => UID[id] || id, TK = (t) => lit(TUID[t] || t);
const back = (txt) => Object.entries(UID).reduce((s, [id, u]) => s.split(u).join(id), String(txt));
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager", bday: "14.02", joined: "01.03.2022" }, { id: 2, name: "Смирнова Анна", pos: "waiter", bday: "21.11" },
  { id: 3, name: "Соколова Вера", pos: "waiter", joined: DM + "." + (Y - 2) }, { id: 4, name: "Белов Илья", pos: "bar", bday: DM, joined: "12.05.2024" },
  { id: 5, name: "Орлов Пётр", pos: "waiter", joined: TODAY }];
const CFG = { shifts: [{ k: "Д", name: "День", from: 12, to: 20 }], staff: SSTAFF };
const NEWBIES = [{ emp: "e-ksenia", started: dDiff(TODAY, YEAR_AGO) }];
// «спасибо» прошлых дней — по времени (как в чате): вчера Мария Анне (Пётр присоединился), сегодня утром Вера Петру
const THX = [{ from: "u-maria", to: "e-anna", text: "выручила с банкетом на веранде", at: -1, time: "21:50", plus: ["e-petr"] },
  { from: "e-vera", to: "e-petr", text: "подменил в субботу", at: 0, time: "08:30", plus: [] }];
const LINKED = ["e-anna", "e-ilya", "e-vera", "u-maria"];
const pings = [];
const srv = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: {}, menu: [], tgLinked: LINKED, newbies: NEWBIES, peerThanks: THX,
  ping: (to, text) => pings.push({ to, text }) });

const fails = [];
const ok = (name, cond, extra = "") => { console.log((cond ? "✓ " : "✗ ") + name + (cond || !extra ? "" : " — " + extra)); if (!cond) fails.push(name); };

// ── та же база в Postgres ──
for (const n of ["26-mastery", "31-qday", "32-briefing", "34-guest-thanks", "35-seating", "36-comfort", "37-halls-qday", "38-chat", "39-everyday", "41-newbie", "42-thanks"])
  psql(["-d", DB, "-f", SRC + "/supabase/supabase-stage" + n + ".sql"]);
const L = ["set client_min_messages = warning;",
  "delete from tg_links; delete from sessions; delete from sa_newbies; delete from sa_peer_thanks; delete from sa_cheers; delete from employees; delete from schedule_months; delete from schedule_venues;"];
for (const p of PEOPLE) L.push(`insert into employees (id, name, surname, restaurant, position, is_admin) values (${lit(U(p.id))}, ${lit(p.name)}, ${lit(p.surname)}, ${lit(p.restaurant)}, ${lit(p.position)}, ${p.is_admin});`);
for (const [t, id] of Object.entries(TOK)) L.push(`insert into sessions (token, employee_id) values (${TK(t)}, ${lit(U(id))});`);
L.push(`delete from sa_newbies;`);
L.push(`insert into sa_newbies (emp_id, restaurant, started_at) values (${lit(U("e-ksenia"))}, ${lit(R0)}, (${lit(YEAR_AGO)}::date + time '10:00') at time zone '${TZ}');`);
L.push(`insert into schedule_venues (restaurant, venue_key, title, config) values (${lit(R0)}, 'main', ${lit(R0)}, ${jlit(CFG)});`);
LINKED.forEach((id, i) => L.push(`insert into tg_links (emp_id, chat_id, restaurant, full_name, remind) values (${lit(U(id))}, ${810001 + i}, ${lit(R0)}, '', true);`));
L.push(`insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST') on conflict (name) do update set decrypted_secret = excluded.decrypted_secret;`);
L.push(`insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value;`);
L.push(`insert into sa_chats (restaurant, kind) values (${lit(R0)}, 'team') on conflict do nothing;`);
// «спасибо» прошлых дней — те же карточки и записи, что засеял сервер демо (время — по часам заведения)
const team = srv.teamOf(R0);
for (const m of srv.S.msgs.filter((x) => x.chat === team.id && x.card && x.card.t === "thx")) {
  const card = JSON.parse(back(JSON.stringify(m.card)).replace(/"(e-|u-)[a-z]+"/g, (s) => JSON.stringify(U(JSON.parse(s)))));
  L.push(`insert into sa_chat_msgs (id, chat_id, emp_id, emp_name, emp_rest, body, kind, card, created_at) values (${m.id}, (select id from sa_chats where restaurant = ${lit(R0)} and kind = 'team'), ${lit(U(m.emp))}, ${lit(m.name)}, ${lit(R0)}, ${lit(m.body)}, 'card', ${jlit(card)}, ${lit(m.at)}::timestamp at time zone '${TZ}');`);
}
for (const x of srv.S.thx) L.push(`insert into sa_peer_thanks (msg_id, restaurant, from_id, from_name, to_id, to_name, text, own, created_at) values (${x.msg}, ${lit(R0)}, ${lit(U(x.from))}, ${lit(x.fromName)}, ${lit(U(x.to))}, ${lit(x.toName)}, ${lit(x.text)}, ${x.own}, ${lit(x.at)}::timestamp at time zone '${TZ}');`);
L.push(`select setval('sa_chat_msgs_id_seq', 1000);`);
const dir = mkdtempSync(join(tmpdir(), "pg42-"));
writeFileSync(join(dir, "fx.sql"), L.join("\n"));
psql(["-d", DB, "-f", join(dir, "fx.sql")]);

// ответы: id людей — как в демо; время и номера сообщений и чатов — не сравниваем (у сервера свои)
const pg = (fn, args) => JSON.parse(back(q1(`select ${fn}(${args})`)));
const strip = (x) => {
  if (Array.isArray(x)) return x.map(strip);
  if (!x || typeof x !== "object") return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) {
    if (["at", "msg", "id", "chat", "upd"].includes(k) && typeof v !== "object") continue;
    if (k === "at" && Array.isArray(v)) { o[k] = v.length; continue; }
    if (k === "plus" || k === "greet") { o[k] = (v || []).map((g) => (g && typeof g === "object" ? g.n : g)); continue; }
    o[k] = strip(v);
  }
  return o;
};
const canon = (v) => JSON.stringify(strip(v), (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const same = (name, a, b) => ok(name, canon(a) === canon(b), "\n   pg:   " + canon(a) + "\n   демо: " + canon(b));
const fk = (fn, tok, args = {}) => srv.rpc(fn, { p_token: tok, ...args });

// праздники дня: сервер демо поставил их при запуске, Postgres — в 10:00 по часам заведения
const fkCheer = srv.S.msgs.filter((m) => m.card && (m.card.t === "bday" || m.card.t === "anniv")).map((m) => ({ emp: m.emp, name: m.name, body: m.body, card: m.card }));
const n = Number(q1(`select jsonb_array_length(_sa_ty_due(true, (${lit(TODAY)}::date + time '10:00') at time zone '${TZ}'))`));
const pgCheer = JSON.parse(back(q1(`select coalesce(jsonb_agg(jsonb_build_object('emp', emp_id, 'name', emp_name, 'body', body, 'card', card) order by id), '[]') from sa_chat_msgs where card->>'t' in ('bday', 'anniv')`)));
ok("есть что сравнивать: сегодня день рождения у Ильи, Вера два года в команде, Ксения год (по «Новичкам»); Пётр пришёл сегодня — нет",
  n === 3 && pgCheer.map((x) => x.card.t + ":" + x.card.name + ":" + (x.card.years || "")).join(",") === "anniv:Вера Соколова:2,bday:Илья Белов:,anniv:Ксения Миронова:1", JSON.stringify(pgCheer).slice(0, 400));
same("карточки праздников: от «Академии», сводки, кто, должность, сколько лет, с какого дня", pgCheer, fkCheer);
const sent = JSON.parse(back(q1(`select coalesce(jsonb_agg(body->>'text' order by id), '[]') from net.sent_log where body->>'text' like '%поздравляют%'`)));
const fkSent = pings.filter((x) => /поздравляют/.test(x.text)).map((x) => x.text);
ok("бот — самому: Вере и Илье (у Ксении нет Telegram); тексты — как у сервера демо и lib/team-warm.js", sent.length === 2 && sent.join("|") === fkSent.join("|")
  && sent.join("|") === fkCheer.filter((x) => LINKED.includes(x.card.emp)).map((x) => cheerDm(x.card)).join("|"), JSON.stringify([sent, fkSent]));
same("просмотр владельца — всё отмечено", JSON.parse(back(q1(`select sa_cheer_preview()`))).map((x) => [x.kind, x.name, x.posted]), srv.cheerDue(false, null, true).map((x) => [x.kind, x.name, x.posted]));
const pb = pgCheer.find((x) => x.card.t === "bday"), fb = srv.S.msgs.find((m) => m.card && m.card.t === "bday");
const pbid = q1(`select id from sa_chat_msgs where card->>'t' = 'bday'`);
same("«Поздравить» Илью: Мария", pg("chat_cheer", `${TK("tok-u-maria")}, ${pbid}`).msg.card, fk("chat_cheer", "tok-u-maria", { p_msg: fb.id }).msg.card);
ok("сам Илья — self", pg("chat_cheer", `${TK("tok-e-ilya")}, ${pbid}`).error === "self" && fk("chat_cheer", "tok-e-ilya", { p_msg: fb.id }).error === "self" && !!pb);
const peerA = pg("thanks_peer", TK("tok-e-anna"));
ok("есть что сравнивать: у Анны вчерашнее «спасибо» от Марии, Пётр присоединился", peerA.total === 2 && (peerA.items || []).length === 1 && peerA.items[0].plus.length === 1, JSON.stringify(peerA).slice(0, 300));
same("«Спасибо от коллег» у Анны: неделя, месяц, всего, карточки", peerA, fk("thanks_peer", "tok-e-anna"));
same("«Спасибо от коллег» у Петра", pg("thanks_peer", TK("tok-e-petr")), fk("thanks_peer", "tok-e-petr"));
same("«спасибо» за неделю для «Сотрудника недели»", pg("thanks_week", TK("tok-e-vera")), fk("thanks_week", "tok-e-vera"));
same("в карточке коллеги: у Анны", pg("thanks_of", `${TK("tok-e-ilya")}, ${lit(U("e-anna"))}`), fk("thanks_of", "tok-e-ilya", { p_emp: "e-anna" }));

// новое «спасибо» и «Тоже спасибо» — одинаково на обеих сторонах
const both = (fn, tok, args, sqlArgs) => [pg(fn, TK(tok) + (sqlArgs ? ", " + sqlArgs : "")), fk(fn, tok, args)];
let [a, b] = both("chat_thanks", "tok-e-vera", { p_to: "e-ilya", p_text: "  помог с гостями   у бара " }, `${lit(U("e-ilya"))}, '  помог с гостями   у бара '`);
same("Вера говорит спасибо Илье: карточка, сводка, бот написал", { card: a.msg && a.msg.card, body: a.msg && a.msg.body, tg: a.tg, ok: a.ok }, { card: b.msg && b.msg.card, body: b.msg && b.msg.body, tg: b.tg, ok: b.ok });
const pm = a.msg.id, fm = b.msg.id;
same("второй раз за день — again", (([x, y]) => [x.error, y.error])(both("chat_thanks", "tok-e-vera", { p_to: "e-ilya", p_text: "x" }, `${lit(U("e-ilya"))}, 'x'`)), ["again", "again"]);
[a, b] = both("chat_thanks", "tok-e-vera", { p_to: "e-vera", p_text: "x" }, `${lit(U("e-vera"))}, 'x'`);
ok("себе — self", a.error === "self" && b.error === "self", JSON.stringify([a, b]));
same("Анна присоединяется", pg("chat_cheer", `${TK("tok-e-anna")}, ${pm}`).msg.card, fk("chat_cheer", "tok-e-anna", { p_msg: fm }).msg.card);
[a, b] = [pg("chat_cheer", `${TK("tok-e-ilya")}, ${pm}`), fk("chat_cheer", "tok-e-ilya", { p_msg: fm })];
ok("Илья (кому спасибо) — self, Вера (автор) — own", a.error === "self" && b.error === "self" && pg("chat_cheer", `${TK("tok-e-vera")}, ${pm}`).error === "own" && fk("chat_cheer", "tok-e-vera", { p_msg: fm }).error === "own");
same("после — «Спасибо от коллег» у Ильи", pg("thanks_peer", TK("tok-e-ilya")), fk("thanks_peer", "tok-e-ilya"));

psql(["-d", "postgres", "-c", "drop database if exists " + DB]);
console.log(fails.length ? "✗ не прошло: " + fails.length : "всё сошлось");
process.exit(fails.length ? 1 : 0);
