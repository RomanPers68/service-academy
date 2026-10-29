// tools/claude/pg-check-stage41.mjs — v107 (Доп. 420): этап 41 («Новичок») на настоящем Postgres против сервера демо.
// Одни и те же данные (заведение, график с первой сменой новичка завтра, собеседования «Берём», памятка, новички, наставник)
// идут в сервер демо (tools/claude/demo-app/fake-server.js) и в базу с этапами; newbie_me и newbie_list у новичка,
// наставника и руководителя, «Представить команде», «Поздороваться», подтверждения наставника и «самостоятельная смена»,
// текст бота накануне первой смены должны совпасть. Демо и e2e ходят в сервер демо — так видно, что он ведёт себя как этап.
// База — макет Supabase из tools/claude/sql: копия satest25 (сначала bash tools/claude/sql/run25.sh), сюда — этапы 8, 26, 31,
// 32, 34–39 и 41; люди демо — со своими uuid, в ответах сервера они заменяются обратно на id демо. PGHOST и PGPORT — как у
// tools/claude/sql (по умолчанию /tmp/pgsock и 5433).
// Запуск: PGHOST=<папка сокета> PGPORT=<порт> E2E_SRC=<исходники> node tools/claude/pg-check-stage41.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SRC = process.env.E2E_SRC || process.cwd();
const HOST = process.env.PGHOST || "/tmp/pgsock", PORT = process.env.PGPORT || "5433", BASE = process.env.PG_BASE || "satest25", DB = "sa_check41", TZ = "Asia/Kamchatka";
const { makeServer } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { eveText, eveBuddyText } = await import(SRC + "/lib/newbie.js");

const psql = (args, input) => execFileSync("psql", ["-h", HOST, "-p", PORT, "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", ...args], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const jlit = (o) => lit(JSON.stringify(o)) + "::jsonb";
try { psql(["-d", "postgres", "-c", "drop database if exists " + DB, "-c", "create database " + DB + " template " + BASE]); }
catch (e) { console.log("✗ нет базы " + BASE + " — сначала bash tools/claude/sql/run25.sh\n" + String(e.stderr || e.message).slice(0, 400)); process.exit(1); }
const q1 = (sql) => psql(["-d", DB, "-At", "-c", sql]).trim();
const TODAY = q1(`select to_char((now() at time zone '${TZ}')::date, 'YYYY-MM-DD')`);
const addD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const D = (n) => addD(TODAY, n);

// ── заведение (как демо: tools/claude/demo-app/boot.js) ──
const R0 = "Два моря, Океан";
const PEOPLE = [
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender", is_admin: false },
  { id: "e-ksenia", name: "Ксения", surname: "Миронова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-timur", name: "Тимур", surname: "Ахметов", restaurant: R0, position: "bartender", is_admin: false },
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const UID = Object.fromEntries(PEOPLE.map((p, i) => [p.id, "00000000-0000-4000-8041-" + String(i + 1).padStart(12, "0")]));
const TUID = Object.fromEntries(PEOPLE.map((p, i) => ["tok-" + p.id, "10000000-0000-4000-8041-" + String(i + 1).padStart(12, "0")]));
const U = (id) => UID[id] || id, TK = (t) => lit(TUID[t] || t);
const back = (txt) => Object.entries(UID).reduce((s, [id, u]) => s.split(u).join(id), String(txt));
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager" }, { id: 2, name: "Смирнова Анна", pos: "waiter" }, { id: 3, name: "Соколова Вера", pos: "waiter" },
  { id: 4, name: "Белов Илья", pos: "bar" }, { id: 5, name: "Миронова Ксения", pos: "waiter" }, { id: 6, name: "Ахметов Тимур", pos: "bar" }];
const SHIFTS = [{ k: "У", name: "Утро", from: 10, to: 18 }, { k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }];
const CFG = { shifts: SHIFTS, staff: SSTAFF };
const plan = {};
for (let i = -8; i <= 8; i++) {
  const set = (sid, k) => { (plan[sid] = plan[sid] || {})[i] = k; };
  set(1, "Д"); set(2, i % 2 ? "В" : "Д"); set(3, "В"); set(4, "Д");
  if (i >= 1) set(5, i === 2 ? "О" : "Д");   // Ксения: первая смена завтра
  if (i >= -5) set(6, "В");                   // Тимур: с прошлой недели
}
const NEWBIES = [{ emp: "e-ksenia", started: -1, checked: ["d1c"] }, { emp: "e-timur", started: -6, buddy: "e-ilya", buddyBy: "u-maria", checked: ["d1a", "d1b"],
  confirm: { d2c: { by: "e-ilya", name: "Илья Белов", at: -2 } } }];
const MEMO = { addr: "Служебный вход со двора", arrive: 15, dress: "Чёрный верх, тёмные брюки", meet: "", extra: "Обед для команды в 15:30" };
const CANDS = [{ id: 501, name: "Ксения Миронова", at: -6, decision: "hire", aiScores: { "Сервис и гость": 78, "Конфликты и сложные ситуации": 45, "Честность и деньги": 62, "Команда": 85 } },
  { id: 502, name: "Глеб Соколов", at: -2, decision: "hire", topics: [{ topic: "Сервис и гость", ok: 1, n: 3 }, { topic: "Команда", ok: 2, n: 2 }] }];
const LINKED = ["e-ksenia", "e-anna", "u-maria"];
const srv = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan, menu: [], tgLinked: LINKED, newbies: NEWBIES, nbMemo: MEMO, cands: CANDS });

const fails = [];
const ok = (name, cond, extra = "") => { console.log((cond ? "✓ " : "✗ ") + name + (cond || !extra ? "" : " — " + extra)); if (!cond) fails.push(name); };

// ── та же база в Postgres ──
for (const n of ["8-candidates", "26-mastery", "31-qday", "32-briefing", "34-guest-thanks", "35-seating", "36-comfort", "37-halls-qday", "38-chat", "39-everyday", "41-newbie"])
  psql(["-d", DB, "-f", SRC + "/supabase/supabase-stage" + n + ".sql"]);
const L = ["set client_min_messages = warning;",
  "delete from tg_links; delete from sessions; delete from sa_newbies; delete from employees; delete from schedule_months; delete from schedule_venues;"];
for (const p of PEOPLE) L.push(`insert into employees (id, name, surname, restaurant, position, is_admin) values (${lit(U(p.id))}, ${lit(p.name)}, ${lit(p.surname)}, ${lit(p.restaurant)}, ${lit(p.position)}, ${p.is_admin});`);
for (const [t, id] of Object.entries(TOK)) L.push(`insert into sessions (token, employee_id) values (${TK(t)}, ${lit(U(id))});`);
L.push(`delete from sa_newbies;`);   // триггер добавил всех — новички только те, что в демо
L.push(`insert into schedule_venues (restaurant, venue_key, title, config) values (${lit(R0)}, 'main', ${lit(R0)}, ${jlit(CFG)});`);
for (const [mk, pl] of Object.entries(srv.S.months)) L.push(`insert into schedule_months (restaurant, venue_key, month, payload) values (${lit(R0)}, 'main', ${lit(mk)}, ${jlit({ plan: pl.plan })});`);
LINKED.forEach((id, i) => L.push(`insert into tg_links (emp_id, chat_id, restaurant, full_name, remind) values (${lit(U(id))}, ${800001 + i}, ${lit(R0)}, '', true);`));
L.push(`insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST') on conflict (name) do update set decrypted_secret = excluded.decrypted_secret;`);
L.push(`insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value;`);
L.push(`insert into sa_newbie_memo (restaurant, data) values (${lit(R0)}, ${jlit(MEMO)});`);
for (const c of CANDS) { const { id, at, ...pl } = c; L.push(`insert into candidate_results (id, restaurant, payload, created_at) values (${id}, ${lit(R0)}, ${jlit(pl)}, (${lit(D(at))}::date + time '12:00') at time zone '${TZ}');`); }
for (const n of NEWBIES) {
  const checked = Object.fromEntries((n.checked || []).map((x) => [x, D(n.started) + "T10:00:00Z"]));
  const confirm = Object.fromEntries(Object.entries(n.confirm || {}).map(([k, v]) => [k, { by: U(v.by), name: v.name, at: D(v.at) + "T21:00:00Z" }]));
  L.push(`insert into sa_newbies (emp_id, restaurant, started_at, buddy_id, buddy_by, checked, confirm) values (${lit(U(n.emp))}, ${lit(R0)}, (${lit(D(n.started))}::date + time '10:00') at time zone '${TZ}', ${n.buddy ? lit(U(n.buddy)) : "null"}, ${n.buddyBy ? lit(U(n.buddyBy)) : "null"}, ${jlit(checked)}, ${jlit(confirm)});`);
}
const dir = mkdtempSync(join(tmpdir(), "pg41-"));
writeFileSync(join(dir, "fx.sql"), L.join("\n"));
psql(["-d", DB, "-f", join(dir, "fx.sql")]);

// ответы: id людей — как в демо; время отметок и номера сообщений — не сравниваем (у сервера свои)
const pg = (fn, args) => JSON.parse(back(q1(`select ${fn}(${args})`)));
const strip = (x) => {
  if (Array.isArray(x)) return x.map(strip);
  if (!x || typeof x !== "object") return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) {
    if (["at", "msg", "id"].includes(k) && typeof v !== "object") continue;
    if (k === "checked") { o[k] = Object.keys(v || {}).sort(); continue; }
    if (k === "hello") { o[k] = v ? { n: v.n } : v; continue; }
    if (k === "solo") { o[k] = v ? { by: v.by, name: v.name } : v; continue; }
    if (k === "greet") { o[k] = (v || []).map((g) => g.id); continue; }
    o[k] = strip(v);
  }
  return o;
};
const canon = (v) => JSON.stringify(strip(v), (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const same = (name, a, b) => ok(name, canon(a) === canon(b), "\n   pg:   " + canon(a) + "\n   демо: " + canon(b));
const fk = (fn, tok, args = {}) => srv.rpc(fn, { p_token: tok, ...args });

const meK = pg("newbie_me", TK("tok-e-ksenia")), lsM = pg("newbie_list", TK("tok-u-maria")), meI = pg("newbie_me", TK("tok-e-ilya"));
// сравнивать есть что: первая смена завтра, две темы с собеседования, у руководителя оба новичка и оба «Берём», Илья ведёт Тимура
ok("есть что сравнивать: Ксения — новичок, первая смена завтра, темы «Конфликты…» и «Честность…»",
  meK.newbie === true && meK.first && meK.first.day === D(1) && (meK.focus || []).map((f) => f.topic).join("|") === "Конфликты и сложные ситуации|Честность и деньги", JSON.stringify(meK).slice(0, 300));
ok("есть что сравнивать: у Марии два новичка, Ксения нашлась по собеседованию сама, «Берём» — двое, Илья ведёт одного",
  (lsM.list || []).length === 2 && lsM.list[0].cand && lsM.list[0].cand.how === "auto" && (lsM.cands || []).length === 2 && (lsM.team || []).some((t) => t.id === "e-ilya" && t.leads === 1)
  && (meI.buddy_of || []).length === 1, JSON.stringify(lsM).slice(0, 300));
same("newbie_me новичка (Ксения): первая смена, памятка, темы без баллов", meK, fk("newbie_me", "tok-e-ksenia"));
same("newbie_me новичка с наставником (Тимур): подтверждено «5 столов»", pg("newbie_me", TK("tok-e-timur")), fk("newbie_me", "tok-e-timur"));
same("newbie_me наставника (Илья): кого ведёт", meI, fk("newbie_me", "tok-e-ilya"));
same("newbie_me руководителя: не новичок", pg("newbie_me", TK("tok-u-maria")), fk("newbie_me", "tok-u-maria"));
same("newbie_list руководителя: новички, собеседования, кого назначить, «Берём»", lsM, fk("newbie_list", "tok-u-maria"));
same("newbie_list наставника: только свои", pg("newbie_list", TK("tok-e-ilya")), fk("newbie_list", "tok-e-ilya"));
same("newbie_list сотрудника: пусто", pg("newbie_list", TK("tok-e-vera")), fk("newbie_list", "tok-e-vera"));

// действия — одинаково на обеих сторонах
const both = (fn, tok, args, sqlArgs) => [pg(fn, TK(tok) + (sqlArgs ? ", " + sqlArgs : "")), fk(fn, tok, args)];
let [a, b] = both("newbie_set", "tok-u-maria", { p_emp: "e-ksenia", p_buddy: "e-anna", p_hello: true }, `${lit(U("e-ksenia"))}, ${lit(U("e-anna"))}, null, true`);
same("«Наставник: Анна» и «Представить команде»: новичок у руководителя", a.item, b.item);
same("карточка «Знакомьтесь»: кто, должность, первая смена, наставник", a.msg && a.msg.card, b.msg && b.msg.card);
ok("«Знакомьтесь» — в «Вся команда», от Марии, коротко — как в демо", a.msg && b.msg && a.msg.emp === "u-maria" && b.msg.emp === "u-maria" && a.msg.body === b.msg.body && a.msg.body === "Знакомьтесь: Ксения Миронова, официант",
  JSON.stringify([a.msg && a.msg.body, b.msg && b.msg.body]));
const pm = a.msg.id, fm = b.msg.id;
same("«Поздороваться» Веры", pg("chat_greet", `${TK("tok-e-vera")}, ${pm}`).msg.card, fk("chat_greet", "tok-e-vera", { p_msg: fm }).msg.card);
same("второй раз — то же", pg("chat_greet", `${TK("tok-e-vera")}, ${pm}`).msg.card, fk("chat_greet", "tok-e-vera", { p_msg: fm }).msg.card);
ok("сама Ксения — self", pg("chat_greet", `${TK("tok-e-ksenia")}, ${pm}`).error === "self" && fk("chat_greet", "tok-e-ksenia", { p_msg: fm }).error === "self");
[a, b] = both("newbie_check", "tok-e-ksenia", { p_steps: ["d1a", "d2c", "f:Честность и деньги"], p_on: true }, `array['d1a', 'd2c', 'f:Честность и деньги'], true`);
same("свои шаги новичка (шаг наставника — нет)", a, b);
[a, b] = both("newbie_confirm", "tok-e-anna", { p_emp: "e-ksenia", p_step: "d2c" }, `${lit(U("e-ksenia"))}, 'd2c', true`);
same("наставник подтверждает «5 столов»", a.item, b.item);
[a, b] = both("newbie_confirm", "tok-e-vera", { p_emp: "e-ksenia", p_step: "d2c" }, `${lit(U("e-ksenia"))}, 'd2c', true`);
ok("не наставник — forbidden", a.error === "forbidden" && b.error === "forbidden", JSON.stringify([a, b]));
[a, b] = both("newbie_confirm", "tok-u-maria", { p_emp: "e-timur", p_step: "d3b" }, `${lit(U("e-timur"))}, 'd3b', true`);
same("руководитель подтверждает самостоятельную смену Тимура", a.item, b.item);
const pgSolo = JSON.parse(back(q1(`select card from sa_chat_msgs where card->>'t' = 'solo' order by id desc limit 1`)));
const fkSolo = srv.S.msgs.filter((m) => m.card && m.card.t === "solo").pop().card;
same("карточка «самостоятельная смена»: за сколько дней с первой смены, наставник", pgSolo, fkSolo);
same("«Наставник новичков» у Ильи", pg("chat_newbie_mark", `${TK("tok-e-vera")}, ${lit(U("e-ilya"))}`), fk("chat_newbie_mark", "tok-e-vera", { p_emp: "e-ilya" }));
[a, b] = both("newbie_memo_set", "tok-u-maria", { p_memo: { addr: "  Двор  ", arrive: 20, dress: "", extra: "x" } }, `${jlit({ addr: "  Двор  ", arrive: 20, dress: "", extra: "x" })}`);
same("памятка: как сохранилась", a, b);
[a, b] = both("newbie_add", "tok-u-maria", { p_emp: "e-vera", p_on: true }, `${lit(U("e-vera"))}, true`);
ok("добавить в «Новички» коллегу, пришедшую раньше (сегодня — первый день)", a.item && b.item && a.item.days === 0 && b.item.days === 0 && a.item.emp === "e-vera", JSON.stringify([a.item && a.item.days, b.item && b.item.days]));

// накануне первой смены: что ушло бы Ксении — тот же текст, что пишет приложение по ответу newbie_me
const due = JSON.parse(back(q1(`select _sa_nb_due(false, ('${TODAY}'::date + time '19:30') at time zone '${TZ}')`)));
const dk = due.find((x) => x.emp === "e-ksenia");
ok("сервер: сегодня в 19:30 — памятка Ксении (первая смена завтра) и её наставнику", !!dk && !!dk.buddy_text, JSON.stringify(due).slice(0, 300));
const me = fk("newbie_me", "tok-e-ksenia");
ok("текст памятки — как lib/newbie.js по ответу демо", dk && dk.text === eveText(me), "\n---pg---\n" + (dk && dk.text) + "\n---js---\n" + eveText(me));
ok("текст наставнику — как lib/newbie.js", dk && dk.buddy_text === eveBuddyText(me), "\n" + (dk && dk.buddy_text) + "\n" + eveBuddyText(me));
console.log("\n" + eveText(me) + "\n");
psql(["-d", "postgres", "-c", "drop database if exists " + DB]);
console.log(fails.length ? "✗ не прошло: " + fails.length : "всё сошлось");
process.exit(fails.length ? 1 : 0);
