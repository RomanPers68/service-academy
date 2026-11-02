// tools/claude/pg-check-stage47.mjs — v132 (Доп. 445): этап 47 («Сомелье» учится: «Гость взял / Не взял») на настоящем
// Postgres против сервера демо. Владелец (03.11): «Как мы сомелье можем сделать умнее?» — «Берём все». Одни и те же
// отметки (подбор, взял, не взял, исправление за 10 минут, чужая позиция, плохой вход, другое заведение) идут в сервер демо
// (tools/claude/demo-app/fake-server.js) и в базу; сводки som_stats совпадают; до этапа функции нет (демо с opts.noStage47 —
// так же, 404); этап можно запускать повторно; таблица закрыта.
// База — макет Supabase из tools/claude/sql: копия satest25 (сначала bash tools/claude/sql/run25.sh). PGHOST и PGPORT —
// как у tools/claude/sql (по умолчанию /tmp/pgsock и 5433).
// Запуск: PGHOST=<папка сокета> PGPORT=<порт> E2E_SRC=<исходники> node tools/claude/pg-check-stage47.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SRC = process.env.E2E_SRC || process.cwd();
const HOST = process.env.PGHOST || "/tmp/pgsock", PORT = process.env.PGPORT || "5433", BASE = process.env.PG_BASE || "satest25", DB = "sa_check47";
const { makeServer } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const psql = (args, input) => execFileSync("psql", ["-h", HOST, "-p", PORT, "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", ...args], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
try { psql(["-d", "postgres", "-c", "drop database if exists " + DB, "-c", "create database " + DB + " template " + BASE]); }
catch (e) { console.log("✗ нет базы " + BASE + " — сначала bash tools/claude/sql/run25.sh\n" + String(e.stderr || e.message).slice(0, 400)); process.exit(1); }
const q1 = (sql) => psql(["-d", DB, "-At", "-c", sql]).trim();

const R0 = "Два моря, Океан", R1 = "Два моря, Порт";
const PEOPLE = [
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender", is_admin: false },
  { id: "e-oleg", name: "Олег", surname: "Нов", restaurant: R1, position: "waiter", is_admin: false },
];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const UID = Object.fromEntries(PEOPLE.map((p, i) => [p.id, "00000000-0000-4000-8047-" + String(i + 1).padStart(12, "0")]));
const TUID = Object.fromEntries(PEOPLE.map((p, i) => ["tok-" + p.id, "10000000-0000-4000-8047-" + String(i + 1).padStart(12, "0")]));
const TK = (t) => lit(TUID[t] || t);
const srv0 = makeServer({ today: "2026-11-03", rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, noStage47: true });
const srv = makeServer({ today: "2026-11-03", rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false });

const fails = [];
const ok = (name, cond, extra = "") => { console.log((cond ? "✓ " : "✗ ") + name + (cond || !extra ? "" : " — " + extra)); if (!cond) fails.push(name); };
const L = ["set client_min_messages = warning;", "delete from sessions; delete from employees;"];
for (const p of PEOPLE) L.push(`insert into employees (id, name, surname, restaurant, position, is_admin) values (${lit(UID[p.id])}, ${lit(p.name)}, ${lit(p.surname)}, ${lit(p.restaurant)}, ${lit(p.position)}, ${p.is_admin});`);
for (const [t, id] of Object.entries(TOK)) L.push(`insert into sessions (token, employee_id) values (${TK(t)}, ${lit(UID[id])});`);
const dir = mkdtempSync(join(tmpdir(), "pg47-"));
writeFileSync(join(dir, "fx.sql"), L.join("\n"));
psql(["-d", DB, "-f", join(dir, "fx.sql")]);

const arr = (a) => "array[" + (a || []).map(lit).join(", ") + "]::text[]";
const pgAdd = (tok, ev, item = "", dishes = [], ask = "") => JSON.parse(q1(`select som_log_add(${TK(tok)}, ${lit(ev)}, ${lit(item)}, ${arr(dishes)}, ${lit(ask)})`));
const fkAdd = (s, tok, ev, item = "", dishes = [], ask = "") => s.rpc("som_log_add", { p_token: tok, p_ev: ev, p_item: item, p_dishes: dishes, p_ask: ask });
const pgStats = (tok) => JSON.parse(q1(`select som_stats(${TK(tok)})`));
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

// ── до этапа 47: функции нет (и в демо без этапа — 404) ──
let before = "";
try { q1(`select som_log_add(${TK("tok-e-anna")}, 'run')`); } catch (e) { before = String(e.stderr || e.message); }
const d0 = fkAdd(srv0, "tok-e-anna", "run");
ok("до этапа 47 функции som_log_add нет; в демо без этапа — 404 (PGRST202)", /som_log_add/.test(before) && d0 && d0.code === "PGRST202", before.slice(0, 160) + " " + JSON.stringify(d0));

// ── этап 47 — дважды (можно запускать повторно) ──
let out1 = "", out2 = "";
try { out1 = psql(["-d", DB, "-At", "-f", SRC + "/supabase/supabase-stage47-sommelier.sql"]); out2 = psql(["-d", DB, "-At", "-f", SRC + "/supabase/supabase-stage47-sommelier.sql"]); } catch (e) { out1 = "ОШИБКА " + String(e.stderr || e.message).slice(0, 400); }
ok("этап 47 запускается и повторно: «сомелье: журнал «взял / не взял» готов»", /сомелье: журнал «взял \/ не взял» готов · записей 0/.test(out1) && /записей 0/.test(out2), out1 + " | " + out2);

// ── одни и те же отметки в базе и в демо ──
const STEPS = [
  ["tok-e-anna", "run", "", ["ok2601"], "к рибаю, сухое красное"],
  ["tok-e-anna", "taken", "wine:w-mal", ["ok2601"], "к рибаю, сухое красное"],
  ["tok-e-anna", "declined", "wine:w-bdx", ["ok2601"], "к рибаю, сухое красное"],
  ["tok-e-anna", "declined", "wine:w-pin", ["ok2601"], ""],
  ["tok-e-anna", "taken", "wine:w-pin", ["ok2601"], ""],   // передумал за 10 минут: остаётся «взял»
  ["tok-u-maria", "taken", "wine:w-mal", ["ok2601", "ok2609", "", " "], "на стол"],
  ["tok-e-ilya", "run", "", [], "аперитив"],
  ["tok-e-ilya", "taken", "cocktail:negroni", [], "аперитив"],
  ["tok-e-oleg", "taken", "wine:w-mal", ["ok2601"], "другое заведение"],
];
const res = STEPS.map(([t, ev, it, ds, ask]) => [pgAdd(t, ev, it, ds, ask), fkAdd(srv, t, ev, it, ds, ask)]);
ok("отметки: в базе и в демо — ok", res.every(([a, b]) => a.ok === true && b.ok === true), JSON.stringify(res));
const bad = [["tok-e-anna", "liked", "wine:w-mal"], ["tok-e-anna", "taken", "плохо"], ["tok-e-anna", "taken", ""], ["tok-nobody", "run", ""]];
const br = bad.map(([t, ev, it]) => [pgAdd(t, ev, it), fkAdd(srv, t, ev, it)]);
ok("плохой вид, чужая позиция, пустая позиция, нет входа — ev, item, item, auth (одинаково)", canon(br.map(([a]) => a.error)) === canon(["ev", "item", "item", "auth"]) && canon(br.map(([a]) => a)) === canon(br.map(([, b]) => b)), JSON.stringify(br));

// ── сводка ──
const a = pgStats("tok-e-anna"), b = srv.rpc("som_stats", { p_token: "tok-e-anna" });
ok("сводка заведения: подборов 2, взяли 4, не взяли 1", a.ok === true && a.runs === 2 && a.taken === 4 && a.declined === 1 && a.days === 90, JSON.stringify(a));
ok("по позициям: Мальбек взяли 2, Пино 1 (исправление за 10 минут — одна отметка), Негрони 1, Бордо не взяли 1",
  canon(a.items) === canon([{ item: "wine:w-mal", taken: 2, declined: 0 }, { item: "cocktail:negroni", taken: 1, declined: 0 }, { item: "wine:w-pin", taken: 1, declined: 0 }, { item: "wine:w-bdx", taken: 0, declined: 1 }]), JSON.stringify(a.items));
ok("пары «блюдо — позиция»: к рибаю Мальбек 2, Пино 1; к крабовой котлете Мальбек 1 (пустые блюда не пишутся)",
  canon(a.pairs) === canon([{ dish: "ok2601", item: "wine:w-mal", taken: 2 }, { dish: "ok2601", item: "wine:w-pin", taken: 1 }, { dish: "ok2609", item: "wine:w-mal", taken: 1 }]), JSON.stringify(a.pairs));
ok("сводка демо совпадает с базой", canon(a) === canon(b), "\n   pg:   " + canon(a) + "\n   демо: " + canon(b));
const o = pgStats("tok-e-oleg");
ok("другое заведение видит только своё", o.restaurant === R1 && o.taken === 1 && o.runs === 0 && o.items.length === 1, JSON.stringify(o));
ok("сводку видит и официант, и руководитель (одна и та же)", canon(pgStats("tok-u-maria")) === canon(a));
ok("плохой вход — auth", pgStats("tok-nobody").error === "auth");
ok("таблица закрыта: anon не читает sa_som_log", q1("select has_table_privilege('anon', 'sa_som_log', 'select')") === "f");
ok("функции открыты приложению (anon)", q1("select has_function_privilege('anon', 'som_stats(text, int)', 'execute') and has_function_privilege('anon', 'som_log_add(text, text, text, text[], text)', 'execute')") === "t");
// больше 300 за сутки — limit
q1(`insert into sa_som_log (restaurant, emp_id, ev) select ${lit(R0)}, ${lit(UID["e-ilya"])}, 'run' from generate_series(1, 300)`);
ok("больше 300 записей сотрудника за сутки — limit", pgAdd("tok-e-ilya", "run").error === "limit");

psql(["-d", "postgres", "-c", "drop database if exists " + DB]);
console.log(fails.length ? "\n✗ " + fails.length + " не сошлось" : "\nэтап 47: всё сошлось");
process.exit(fails.length ? 1 : 0);
