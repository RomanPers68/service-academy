// tools/claude/pg-check-stage44.mjs — v125 (Доп. 438): этап 44 («Кто выучил новые вина») на настоящем Postgres против
// сервера демо. Одни и те же вызовы — телефоны присылают тренировку по винам (открыл и выучил новые вина, счёт «Знаю?»,
// викторина, мусор и чужие права), руководитель и владелец смотрят команду — идут в сервер демо
// (tools/claude/demo-app/fake-server.js) и в базу с этапом; ответы должны совпасть (время — только «есть или нет»).
// База — макет Supabase из tools/claude/sql: копия satest25 (сначала bash tools/claude/sql/run25.sh), сюда — этап 44; люди
// демо — со своими uuid, в ответах сервера они заменяются обратно на id демо. PGHOST и PGPORT — как у tools/claude/sql
// (по умолчанию /tmp/pgsock и 5433).
// Запуск: PGHOST=<папка сокета> PGPORT=<порт> E2E_SRC=<исходники> node tools/claude/pg-check-stage44.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SRC = process.env.E2E_SRC || process.cwd();
const HOST = process.env.PGHOST || "/tmp/pgsock", PORT = process.env.PGPORT || "5433", BASE = process.env.PG_BASE || "satest25", DB = "sa_check44";
const { makeServer } = await import(SRC + "/tools/claude/demo-app/fake-server.js");

const psql = (args, input) => execFileSync("psql", ["-h", HOST, "-p", PORT, "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", ...args], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const jlit = (o) => lit(JSON.stringify(o)) + "::jsonb";
try { psql(["-d", "postgres", "-c", "drop database if exists " + DB, "-c", "create database " + DB + " template " + BASE]); }
catch (e) { console.log("✗ нет базы " + BASE + " — сначала bash tools/claude/sql/run25.sh\n" + String(e.stderr || e.message).slice(0, 400)); process.exit(1); }
const q1 = (sql) => psql(["-d", DB, "-At", "-c", sql]).trim();

const R0 = "Два моря, Океан", R1 = "Порт";
const PEOPLE = [
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender", is_admin: false },
  { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-oleg", name: "Олег", surname: "Ушёл", restaurant: R0, position: "waiter", is_admin: false, status: "fired" },
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
  { id: "u-irina", name: "Ирина", surname: "Портова", restaurant: R1, position: "manager", is_admin: false },
  { id: "e-ivan", name: "Иван", surname: "Петров", restaurant: R1, position: "waiter", is_admin: false },
];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const UID = Object.fromEntries(PEOPLE.map((p, i) => [p.id, "00000000-0000-4000-8044-" + String(i + 1).padStart(12, "0")]));
const TUID = Object.fromEntries(PEOPLE.map((p, i) => ["tok-" + p.id, "10000000-0000-4000-8044-" + String(i + 1).padStart(12, "0")]));
const U = (id) => UID[id] || id, TK = (t) => lit(TUID[t] || t);
const back = (txt) => Object.entries(UID).reduce((s, [id, u]) => s.split(u).join(id), String(txt));
const srv = makeServer({ today: q1("select to_char(now()::date, 'YYYY-MM-DD')"), rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false });

const fails = [];
const ok = (name, cond, extra = "") => { console.log((cond ? "✓ " : "✗ ") + name + (cond || !extra ? "" : " — " + extra)); if (!cond) fails.push(name); };

// ── та же база в Postgres: этап 44, люди и их входы ──
psql(["-d", DB, "-f", SRC + "/supabase/supabase-stage44-wines.sql"]);
psql(["-d", DB, "-f", SRC + "/supabase/supabase-stage44-wines.sql"]);   // повторный запуск — без ошибок
const L = ["set client_min_messages = warning;", "delete from sessions; delete from employees; delete from sa_wine_progress;"];
for (const p of PEOPLE) L.push(`insert into employees (id, name, surname, restaurant, position, is_admin, status, created_at) values (${lit(U(p.id))}, ${lit(p.name)}, ${lit(p.surname)}, ${lit(p.restaurant)}, ${lit(p.position)}, ${p.is_admin}, ${lit(p.status || "active")}, '2025-01-01 10:00+12');`);
for (const [t, id] of Object.entries(TOK)) L.push(`insert into sessions (token, employee_id) values (${TK(t)}, ${lit(U(id))});`);
const dir = mkdtempSync(join(tmpdir(), "pg44-"));
writeFileSync(join(dir, "fx.sql"), L.join("\n"));
psql(["-d", DB, "-f", join(dir, "fx.sql")]);

// время: в ответах — только «есть или нет» (у Postgres и у демо оно своё)
const TS = /^(passedAt|openedAt|statsAt|quizAt|at)$/;
const norm = (v) => JSON.parse(JSON.stringify(v, (k, x) => (TS.test(k) ? x != null : x)));
const canon = (v) => JSON.stringify(norm(v), (key, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const same = (name, a, b) => ok(name, canon(a) === canon(b), "\n   pg:   " + canon(a) + "\n   демо: " + canon(b));
// вызов от имени anon, как у приложения
const pg = (fn, args) => JSON.parse(back(psql(["-d", DB, "-At"], `set role anon;\nselect ${fn}(${args});`).trim().split("\n").pop()));
const fk = (fn, tok, args = {}) => srv.rpc(fn, { p_token: tok, ...args });
const set = (tok, kind, data) => [pg("wine_progress_set", `${TK(tok)}, ${lit(kind)}, ${jlit(data)}`), fk("wine_progress_set", tok, { p_kind: kind, p_data: data })];
const team = (tok, rest) => [pg("wine_progress_team", `${TK(tok)}, ${rest == null ? "null" : lit(rest)}`), fk("wine_progress_team", tok, { p_restaurant: rest })];

// ── пусто: никто ничего не присылал ──
const [t0, f0] = team("tok-u-maria", null);
same("руководитель, пока никто не учил: вся команда заведения (без владельца и уволенного), по имени", t0, f0);
ok("в команде — пять человек, у всех пусто", t0.ok && t0.rows.length === 5 && t0.rows.every((r) => r.at == null && !r.passed.length) && t0.rows.map((r) => r.id).join() === "e-anna,e-vera,e-ilya,u-maria,e-petr", JSON.stringify(t0.rows.map((r) => r.id)));

// ── телефоны присылают ──
const steps = [
  ["Анна открыла «Новые вина» (повторы и мусор в списке — мимо)", "tok-e-anna", "opened", { ids: ["w-pro", "w-cha", "w-pro", "", 7, "  w-gav  "], stats: { known: 2, total: 6, glassKnown: 1, glassTotal: 3 } }],
  ["Анна выучила новые вина; «выучено» больше «из скольких» — не больше", "tok-e-anna", "passed", { ids: ["w-pro", "w-cha"], stats: { known: 9, total: 6, glassKnown: 5, glassTotal: 3 } }],
  ["Анна прошла викторину: верных больше вопросов — не больше", "tok-e-anna", "quiz", { quiz: { right: 12, of: 8 } }],
  ["Вера открыла «Новые вина», счёт без «выучено» — ноль", "tok-e-vera", "opened", { ids: ["w-pro"], stats: { total: 6 } }],
  ["Илья — только счёт «Знаю?», дробное и отрицательное — целые и не меньше нуля", "tok-e-ilya", "stats", { stats: { known: 2.7, total: 6, glassKnown: -3, glassTotal: 3 } }],
  ["Пётр: викторина без «из скольких» — quiz, ничего не пишется", "tok-e-petr", "quiz", { quiz: { right: 3 } }],
  ["Пётр: неизвестное — kind", "tok-e-petr", "learned", {}],
  ["без входа — auth", "nope", "stats", { stats: { total: 1 } }],
  ["Иван из «Порта» — своё заведение", "tok-e-ivan", "passed", { ids: ["p-1"] }],
  ["данные не объектом — как пустые", "tok-e-vera", "stats", ["x"]],
];
for (const [name, tok, kind, data] of steps) { const [a, b] = set(tok, kind, data); same(name, a, b); }

const [t1, f1] = team("tok-u-maria", null);
same("руководитель: кто прислал — выше, дальше по имени; что прислал — как у демо", t1, f1);
const anna = t1.rows.find((r) => r.id === "e-anna"), vera = t1.rows.find((r) => r.id === "e-vera"), ilya = t1.rows.find((r) => r.id === "e-ilya"), petr = t1.rows.find((r) => r.id === "e-petr");
ok("Анна: открывала три, выучила две; «Знаю?» 6 из 6, бокалом 3 из 3; викторина 8 из 8",
  anna.opened.join() === "w-pro,w-cha,w-gav" && anna.passed.join() === "w-pro,w-cha" && anna.known === 6 && anna.total === 6 && anna.glassKnown === 3 && anna.glassTotal === 3 && anna.quizRight === 8 && anna.quizOf === 8 && !!anna.quizAt, JSON.stringify(anna));
ok("Вера: открыла одно, «Знаю?» 0 из 6, бокалом — пусто", vera.opened.join() === "w-pro" && vera.known === 0 && vera.total === 6 && vera.glassKnown == null && !!vera.at, JSON.stringify(vera));
ok("Илья: 2 из 6, бокалом 0 из 3; Пётр — ничего (строки нет)", ilya.known === 2 && ilya.glassKnown === 0 && ilya.glassTotal === 3 && petr.at == null, JSON.stringify([ilya, petr]));
ok("порядок: Анна, Вера, Илья (прислали), потом Мария, Пётр", t1.rows.map((r) => r.id).join() === "e-anna,e-vera,e-ilya,u-maria,e-petr", t1.rows.map((r) => r.id).join());

for (const [name, tok, rest] of [["официант — forbidden", "tok-e-anna", null], ["руководитель — чужое заведение — forbidden", "tok-u-maria", R1],
  ["владелец — другое заведение можно", "tok-u-roman", R1], ["руководитель «Порта» — своё", "tok-u-irina", null], ["без входа — auth", "nope", null]]) {
  const [a, b] = team(tok, rest); same(name, a, b);
}
const [tp] = team("tok-u-roman", R1);
ok("в «Порту» — Ирина и Иван, Иван выучил своё", tp.ok && tp.rows.map((r) => r.id).join() === "e-ivan,u-irina" && tp.rows[0].passed.join() === "p-1", JSON.stringify(tp.rows));
ok("таблица закрыта: anon её не читает", (() => { try { psql(["-d", DB, "-At"], "set role anon;\nselect count(*) from sa_wine_progress;"); return false; } catch (e) { return /permission denied/.test(String(e.stderr || e.message)); } })());
ok("служебные функции закрыты для anon", (() => { try { psql(["-d", DB, "-At"], "set role anon;\nselect _sa_wp_ids('[]'::jsonb);"); return false; } catch (e) { return /permission denied/.test(String(e.stderr || e.message)); } })());

console.log(fails.length ? `\n✗ расхождений: ${fails.length}` : "\nвсё совпало");
process.exit(fails.length ? 1 : 0);
