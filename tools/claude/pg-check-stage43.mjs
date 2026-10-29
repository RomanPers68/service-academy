// tools/claude/pg-check-stage43.mjs — v109 (Доп. 422): этап 43 («Что дало обучение») на настоящем Postgres против сервера
// демо. Одни и те же данные — команда, журнал занятий по дням (как присылают телефоны), ответы в тестах, «спасибо» гостей и
// коллег, новички, вышедшие на самостоятельную смену, — идут в сервер демо (tools/claude/demo-app/fake-server.js) и в базу с
// этапами; итог месяца (этот и прошлый, «по умолчанию»), текст бота и «Прислать в Telegram» должны совпасть. Демо и e2e ходят
// в сервер демо — так видно, что он ведёт себя как этап.
// База — макет Supabase из tools/claude/sql: копия satest25 (сначала bash tools/claude/sql/run25.sh), сюда — этапы 26, 31,
// 32, 34–39, 41, 42 и 43; люди демо — со своими uuid, в ответах сервера они заменяются обратно на id демо. PGHOST и PGPORT —
// как у tools/claude/sql (по умолчанию /tmp/pgsock и 5433).
// Запуск: PGHOST=<папка сокета> PGPORT=<порт> E2E_SRC=<исходники> node tools/claude/pg-check-stage43.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SRC = process.env.E2E_SRC || process.cwd();
const HOST = process.env.PGHOST || "/tmp/pgsock", PORT = process.env.PGPORT || "5433", BASE = process.env.PG_BASE || "satest25", DB = "sa_check43", TZ = "Asia/Kamchatka";
const { makeServer } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { gainText, gainKb } = await import(SRC + "/lib/gain.js");

const psql = (args, input) => execFileSync("psql", ["-h", HOST, "-p", PORT, "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", ...args], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const jlit = (o) => lit(JSON.stringify(o)) + "::jsonb";
try { psql(["-d", "postgres", "-c", "drop database if exists " + DB, "-c", "create database " + DB + " template " + BASE]); }
catch (e) { console.log("✗ нет базы " + BASE + " — сначала bash tools/claude/sql/run25.sh\n" + String(e.stderr || e.message).slice(0, 400)); process.exit(1); }
const q1 = (sql) => psql(["-d", DB, "-At", "-c", sql]).trim();
const TODAY = q1(`select to_char((now() at time zone '${TZ}')::date, 'YYYY-MM-DD')`);
const dOff = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(TODAY + "T00:00:00Z")) / 864e5);
const M0 = TODAY.slice(0, 8) + "01";
const M1 = new Date(Date.UTC(+TODAY.slice(0, 4), +TODAY.slice(5, 7) - 2, 1)).toISOString().slice(0, 10);
const dayOf = (m1, n) => { const d = new Date(Date.UTC(+m1.slice(0, 4), +m1.slice(5, 7) - 1, n)).toISOString().slice(0, 10); return d.slice(0, 7) === m1.slice(0, 7) && d <= TODAY ? d : null; };

// ── заведение: Анна и Вера выросли, Илья занимался меньше, Мария исправляла ошибки, Пётр и Дарья не занимались, Ксения
// пришла в этом месяце (в прошлом её в команде нет); Ольга и Ксения — новички с самостоятельной сменой ──
const R0 = "Два моря, Океан";
const PEOPLE = [
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender", is_admin: false },
  { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-darya", name: "Дарья", surname: "Лебедева", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-olga", name: "Ольга", surname: "Ли", restaurant: R0, position: "hostess", is_admin: false },
  { id: "e-ksenia", name: "Ксения", surname: "Миронова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const UID = Object.fromEntries(PEOPLE.map((p, i) => [p.id, "00000000-0000-4000-8043-" + String(i + 1).padStart(12, "0")]));
const TUID = Object.fromEntries(PEOPLE.map((p, i) => ["tok-" + p.id, "10000000-0000-4000-8043-" + String(i + 1).padStart(12, "0")]));
const U = (id) => UID[id] || id, TK = (t) => lit(TUID[t] || t);
const back = (txt) => Object.entries(UID).reduce((s, [id, u]) => s.split(u).join(id), String(txt));
const full = (id) => { const p = PEOPLE.find((x) => x.id === id); return (p.name + " " + p.surname).trim(); };
// журнал: дни прошлого (p) и этого (c) месяца → запись дня
const PLAN = {
  "e-anna": { p: [3, 10, 17], c: [2, 4, 6, 8, 9, 11], r: { st: 3, l: 2, q: 1 } },
  "e-vera": { p: [5], c: [3, 5, 7, 9], r: { st: 2, l: 1, q: 1, x: 1 } },
  "e-ilya": { p: [4, 6, 8, 12, 14, 20], c: [2], r: { st: 2, l: 1, q: 1, g: 1 } },
  "u-maria": { p: [], c: [5, 6], r: { st: 0, f: 2 } },
  "e-olga": { p: [9, 16], c: [10], r: { st: 1, l: 1, p: 1 } },
  "e-ksenia": { p: [2], c: [6, 7], r: { st: 2, l: 2 } },   // в прошлом месяце её ещё не было: запись есть, в итог не идёт
};
const ACTIVITY = {}, QUIZ = [];
const LESSONS = ["s4-q", "s1-q", "s3-q", "s-prod-q"];
let k = 0;
for (const [id, a] of Object.entries(PLAN)) {
  for (const [list, m1, cur] of [[a.p, M1, 0], [a.c, M0, 1]]) for (const n of list) {
    const iso = dayOf(m1, n); if (!iso) continue;
    (ACTIVITY[id] = ACTIVITY[id] || {})[dOff(iso)] = { ...a.r };
    if (a.r.q) QUIZ.push({ emp: id, lesson: LESSONS[k++ % LESSONS.length], at: dOff(iso), time: "13:00", n: 5, w: cur ? (k % 3 ? 0 : 1) : 2 });
  }
}
const THANKS = [];
[[M1, [2, 6, 9, 15, 22]], [M0, [1, 3, 4, 7, 8, 10, 12]]].forEach(([m1, ns], j) => ns.forEach((n, i) => {
  const iso = dayOf(m1, n); if (iso) THANKS.push({ emp: ["e-anna", "e-vera", "e-ilya"][(i + j) % 3], at: dOff(iso), time: "20:15", text: i % 2 ? "Спасибо" : "", hidden: i === 3 });
}));
const PEER = [];
for (const [m1, n, from, to] of [[M1, 7, "e-vera", "e-anna"], [M0, 3, "u-maria", "e-vera"], [M0, 6, "e-anna", "e-ilya"]]) {
  const iso = dayOf(m1, n); if (iso && dOff(iso) < 0) PEER.push({ from, to, text: "выручил", at: dOff(iso), time: "21:30", plus: [] });
}
const NEWBIES = [];
const nb = (emp, m1, a, b) => { const s0 = dayOf(m1, a), s1 = dayOf(m1, b); if (s0 && s1) NEWBIES.push({ emp, started: dOff(s0), solo: dOff(s1) }); else if (s0) NEWBIES.push({ emp, started: dOff(s0) }); };
nb("e-olga", M1, 2, 13);     // в прошлом месяце: за 11 дней
nb("e-ksenia", M0, 1, 6);    // в этом: за 5 дней (если 6-е уже было)

const LINKED = ["u-maria", "e-anna"];
const pings = [];
const srv = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], tgLinked: LINKED, newbies: NEWBIES, peerThanks: PEER,
  thanks: THANKS, activity: ACTIVITY, quiz: QUIZ, cheers: false, ping: (to, text, acts, chat, msg, o) => pings.push({ to, text, kb: o && o.kb }) });

const fails = [];
const ok = (name, cond, extra = "") => { console.log((cond ? "✓ " : "✗ ") + name + (cond || !extra ? "" : " — " + extra)); if (!cond) fails.push(name); };

// ── та же база в Postgres ──
for (const n of ["26-mastery", "31-qday", "32-briefing", "34-guest-thanks", "35-seating", "36-comfort", "37-halls-qday", "38-chat", "39-everyday", "41-newbie", "42-thanks", "43-gain"])
  psql(["-d", DB, "-f", SRC + "/supabase/supabase-stage" + n + ".sql"]);
const L = ["set client_min_messages = warning;",
  "delete from tg_links; delete from sessions; delete from sa_newbies; delete from sa_peer_thanks; delete from sa_guest_thanks; delete from quiz_events; delete from emp_learning;",
  "delete from employees; delete from schedule_months; delete from schedule_venues;"];
for (const p of PEOPLE) L.push(`insert into employees (id, name, surname, restaurant, position, is_admin, created_at) values (${lit(U(p.id))}, ${lit(p.name)}, ${lit(p.surname)}, ${lit(p.restaurant)}, ${lit(p.position)}, ${p.is_admin}, '2025-01-01 10:00+12');`);
L.push("delete from sa_newbies;");   // этап 41: новых сотрудников он сам добавляет в «Новички» — здесь новички свои
for (const [t, id] of Object.entries(TOK)) L.push(`insert into sessions (token, employee_id) values (${TK(t)}, ${lit(U(id))});`);
LINKED.forEach((id, i) => L.push(`insert into tg_links (emp_id, chat_id, restaurant, full_name, remind) values (${lit(U(id))}, ${830001 + i}, ${lit(R0)}, '', true);`));
L.push(`insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST') on conflict (name) do update set decrypted_secret = excluded.decrypted_secret;`);
L.push(`insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value;`);
// журнал занятий — тот, что видит сервер демо (свои записи и дни «Утра»)
for (const p of PEOPLE) {
  const a = srv.actOf(p.id);
  if (Object.keys(a).length) L.push(`insert into emp_learning (emp_id, emp_name, restaurant, data) values (${lit(U(p.id))}, ${lit(full(p.id))}, ${lit(R0)}, ${jlit({ activity: a })});`);
}
for (const q of srv.S.quiz) L.push(`insert into quiz_events (restaurant, employee, role_id, lesson_id, question, correct, ts) values (${lit(q.rest)}, ${lit(full(q.emp))}, 'seasonal', ${lit(q.lesson)}, 'В', ${q.ok}, ${lit(q.at)}::timestamp at time zone '${TZ}');`);
for (const t of srv.S.thanks) L.push(`insert into sa_guest_thanks (emp_id, restaurant, text, hidden, created_at) values (${lit(U(t.emp))}, ${lit(R0)}, ${lit(t.text)}, ${t.hidden}, ${lit(t.at)}::timestamp at time zone '${TZ}');`);
for (const x of srv.S.thx) L.push(`insert into sa_peer_thanks (msg_id, restaurant, from_id, from_name, to_id, to_name, text, own, created_at) values (${x.msg}, ${lit(R0)}, ${lit(U(x.from))}, ${lit(x.fromName)}, ${lit(U(x.to))}, ${lit(x.toName)}, ${lit(x.text)}, ${x.own}, ${lit(x.at)}::timestamp at time zone '${TZ}');`);
for (const [emp, n] of Object.entries(srv.S.nb)) L.push(`insert into sa_newbies (emp_id, restaurant, started_at, solo_at) values (${lit(U(emp))}, ${lit(R0)}, (${lit(n.started)}::date + time '10:00') at time zone '${TZ}', ${n.solo ? `(${lit(n.solo.slice(0, 10))}::date + time '12:00') at time zone '${TZ}'` : "null"}) on conflict (emp_id) do update set started_at = excluded.started_at, solo_at = excluded.solo_at;`);
const dir = mkdtempSync(join(tmpdir(), "pg43-"));
writeFileSync(join(dir, "fx.sql"), L.join("\n"));
psql(["-d", DB, "-f", join(dir, "fx.sql")]);

const pg = (fn, args) => JSON.parse(back(q1(`select ${fn}(${args})`)));
const canon = (v) => JSON.stringify(v, (key, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const same = (name, a, b) => ok(name, canon(a) === canon(b), "\n   pg:   " + canon(a) + "\n   демо: " + canon(b));
const fk = (fn, tok, args = {}) => srv.rpc(fn, { p_token: tok, ...args });

const cur = TODAY.slice(0, 7), prev = M1.slice(0, 7);
const g0 = pg("gain_month", TK("tok-u-maria")), gc = pg("gain_month", TK("tok-u-maria") + ", " + lit(cur)), gp = pg("gain_month", TK("tok-u-maria") + ", " + lit(prev));
ok("есть что сравнивать: в этом месяце занимались, в прошлом тоже; тесты, «спасибо», выросшие и не занимавшиеся",
  gp.ok && gp.learn.days > 0 && gp.quiz && gp.quiz.n >= 10 && gp.thanks.n > 0 && gp.idle.length > 0 && (gc.learn.days > 0 || Number(TODAY.slice(8)) <= 2), JSON.stringify(gp).slice(0, 400));
same("итог «по умолчанию» (первые семь дней — прошлый месяц, дальше этот)", g0, fk("gain_month", "tok-u-maria"));
same("итог этого месяца: занятия, тесты, темы, «спасибо», новички, выросли, не занимались", gc, fk("gain_month", "tok-u-maria", { p_month: cur }));
same("итог прошлого месяца — весь месяц против позапрошлого", gp, fk("gain_month", "tok-u-maria", { p_month: prev }));
ok("в прошлом месяце Ксении в команде нет, в этом — есть", !gp.idle.some((x) => x.id === "e-ksenia") && gp.team === gc.team - 1, gp.team + " " + gc.team);
same("ошибки: сотруднику — forbidden, позапрошлый месяц и мусор — month, без входа — auth",
  [pg("gain_month", TK("tok-e-anna")).error, pg("gain_month", TK("tok-u-maria") + ", " + lit(new Date(Date.UTC(+TODAY.slice(0, 4), +TODAY.slice(5, 7) - 3, 1)).toISOString().slice(0, 7))).error,
    pg("gain_month", TK("tok-u-maria") + ", 'x'").error, pg("gain_month", "'nope'").error],
  [fk("gain_month", "tok-e-anna").error, fk("gain_month", "tok-u-maria", { p_month: new Date(Date.UTC(+TODAY.slice(0, 4), +TODAY.slice(5, 7) - 3, 1)).toISOString().slice(0, 7) }).error,
    fk("gain_month", "tok-u-maria", { p_month: "x" }).error, fk("gain_month", "nope").error]);
// текст бота: Postgres пишет его сам (_sa_gain_text), сервер демо — lib/gain.js
for (const [nm, g, m] of [["этот месяц", gc, cur], ["прошлый месяц", gp, prev]]) {
  const t = back(q1(`select _sa_gain_text(_sa_gain_at(${lit(R0)}, ${lit(m + "-01")}, ${lit(TODAY)}))`));
  same("текст бота за " + nm + " — как lib/gain.js", t, gainText(g));
}
// «Прислать в Telegram»: Postgres отправил в чат Марии, сервер демо — уведомлением; текст и кнопка — те же
const s1 = pg("gain_send_now", TK("tok-u-maria") + ", " + lit(prev)), f1 = fk("gain_send_now", "tok-u-maria", { p_month: prev });
const sent = JSON.parse(back(q1(`select jsonb_build_object('text', body->>'text', 'btn', body->'reply_markup'->'inline_keyboard'->0->0) from net.sent_log where body->>'chat_id' = '830001' order by id desc limit 1`)));
const ping = pings.filter((x) => x.to === "u-maria").pop() || {};
ok("«Прислать в Telegram»: ушло обоим, текст тот же, кнопка «Открыть итог» за прошлый месяц",
  s1.ok && f1.ok && sent.text === ping.text && sent.btn.text === "Открыть итог" && String(sent.btn.web_app && sent.btn.web_app.url).endsWith("?go=" + gainKb(gp)[0][0].go)
  && ping.kb && ping.kb[0][0].go === "gain_" + prev, JSON.stringify([s1, f1, sent.btn, ping.kb]));
same("второй раз в ту же минуту — too_fast; сотруднику — forbidden; без Telegram — not_linked",
  [pg("gain_send_now", TK("tok-u-maria")).error, pg("gain_send_now", TK("tok-e-anna")).error, pg("gain_send_now", TK("tok-u-roman")).error],
  [fk("gain_send_now", "tok-u-maria").error, fk("gain_send_now", "tok-e-anna").error, fk("gain_send_now", "tok-u-roman").error]);

console.log(fails.length ? "\nрасхождения: " + fails.length : "\nвсё сошлось");
process.exit(fails.length ? 1 : 0);
