// v213 (Доп. 539): очередь официантов к столам и «Занят, передать дальше».
// Владелец: «Столы у нас не закрепляются за официантом, так как работает система очередности» и «Бывает такое, что
// официант чуть дольше принимает заказ, так как гость задает много вопросов. В общем, нужно что-то добавить в виде
// передачи стола дальше по очереди».
//   • этап 69 (supabase-stage69-waiter-queue.sql): sa_queue, queue_get, queue_set, chat_pass; chat_call — позвали к столу,
//     в конец очереди; Telegram — «Иду» и «Занят, передать дальше»; демо-сервер — так же;
//   • lib/call-queue.js — очередь и правки, передача дальше словами; ui/call-queue.jsx — «Кого · по очереди» и правка
//     в листе «Позвать»; баннер и карточка вызова — «Занят, передать дальше»; «Смена» — «Очередь к столам».
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v213.mjs; этап на базе — tools/claude/sql/test69.sh.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { queueOf, queueLive, queueNext, queuePos, queueAfterCall, queueMove, queueFlag, queueAdd, queueOrd, queueLabels, canPass, passedLine, fromLine, passErrText } from "../lib/call-queue.js";
import { callState } from "../lib/chat.js";
import { chatApi } from "../lib/chat-api.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const memStore = () => {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};
globalThis.localStorage = memStore();
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, head: { appendChild() {} }, getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const fnBody = (sql, name) => { const i = sql.indexOf("create or replace function " + name + "("); if (i < 0) return ""; const o = sql.indexOf("$$", i); return sql.slice(i, sql.indexOf("$$;", o + 2) + 3); };

const Q0 = { ok: true, day: "2026-11-28", edit: true,
  list: [{ id: "a", name: "Анна Смирнова", away: false, out: false }, { id: "v", name: "Вера Соколова", away: true, out: false },
    { id: "p", name: "Пётр Орлов", away: false, out: false }, { id: "g", name: "Глеб Орлов", away: false, out: true }, { id: "a", name: "Анна Смирнова" }],
  others: [{ id: "d", name: "Дина Белова" }, { id: "p", name: "Пётр Орлов" }] };
const ids = (q) => queueLive(q).map((x) => x.id + (x.away ? "·п" : "")).join(",");

describe("v213 · версия и журнал", () => {
  it("сборка v213, Дополнение 539 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(213);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 539 — .*\(v213\)/);
    const part = c.slice(c.indexOf("# Дополнение 539"));
    for (const w of ["«Столы у нас не закрепляются за официантом", "передачи стола дальше по очереди", "supabase-stage69-waiter-queue.sql", "queue_get", "queue_set",
      "chat_pass", "«Занят, передать дальше»", "lib/call-queue.js", "ui/call-queue.jsx", "test69.sh", "e2e-v213.mjs"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v213 · этап 69", () => {
  const sql = rd("supabase/supabase-stage69-waiter-queue.sql");
  it("без этапа 68 — понятная ошибка; таблица закрыта; права; итог", () => {
    expect(sql).toContain("raise exception 'Сначала этап 68 (supabase-stage68-call-series.sql): «Позвать» подряд';");
    expect(sql).toContain("create table if not exists sa_queue (");
    expect(sql).toContain("primary key (restaurant, day),");
    expect(sql).toContain("alter table sa_queue enable row level security;");
    expect(sql).toContain("revoke all on table sa_queue from public, anon, authenticated;");
    // v215 (Доп. 541): и колокольчики (chat_call_state), «На месте» (chat_call_done), «Рассадка» (seat_set)
    expect(sql).toContain("grant execute on function queue_get(text), queue_set(text, jsonb), chat_pass(text, bigint), chat_call(text, text, text, text, text, text), chat_go(text, bigint),\n  chat_call_state(text, bigint[]), chat_call_done(text, bigint), seat_set(text, text, text, int, text, text, text) to anon, authenticated;");
    expect(sql).toMatch(/revoke all on function _sa_queue_day\(text\), [\s\S]*_sa_chat_pass_do\(jsonb, sa_chat_msgs\), _sa_chat_calls\(jsonb\), _sa_chat_tg_cb\(jsonb\), _sa_queue_from\(text, text\) from public, anon, authenticated;/);
    expect(sql).toContain("notify pgrst, 'reload schema';");
  });
  it("очередь дня: по графику (нет графика — все официанты), по имени; позже вышедшие — в конец; старше недели — стирается", () => {
    // v215 (Доп. 541): сама очередь не собирается — её составляет хостес по приходу; здесь только чистка
    const f = fnBody(sql, "_sa_queue_ord");
    expect(f).not.toContain("_sa_chat_today");
    expect(f).toContain("from jsonb_array_elements(q) with ordinality x(e, o) where _sa_queue_waiter(p_rest, x.e->>'id')");
    expect(fnBody(sql, "_sa_queue_waiter")).toContain("lower(coalesce(e.position, '')) = 'waiter'");
    expect(f).toContain("delete from sa_queue where restaurant = p_rest and day < d - 7;");
    expect(fnBody(sql, "_sa_queue_day")).toContain("select (now() at time zone _sa_tz(p_rest))::date");
  });
  it("менять — руководитель, старший, хостес; повторы и чужие отброшены, не присланные остаются в конце", () => {
    expect(fnBody(sql, "_sa_queue_can")).toContain("lower(coalesce(c->>'position', '')) in ('hostess', 'senior')");
    const f = fnBody(sql, "queue_set");
    expect(f).toContain("if not _sa_queue_can(c) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;");
    expect(f).toContain("row_number() over (partition by y.e->>'id' order by y.o) as k");
    expect(f).toContain("where not exists (select 1 from jsonb_array_elements(nq) z where z->>'id' = y.e->>'id')");
  });
  it("позвали лично к столу — в конец очереди; в Telegram у такого вызова — «Иду» и «Занят, передать дальше»", () => {
    const f = fnBody(sql, "chat_call");
    expect(f).toContain("if p_who = 'person' and p_why = 'table' then perform _sa_queue_move(rest, p_emp, false); end if;");
    expect(f).toContain("_sa_chat_call_kb(m.id, ch.id, p_who = 'person' and p_why = 'table')");
    expect(f).toContain("return jsonb_build_object('ok', false, 'error', 'already', 'msg', _sa_chat_msg_json(prev));");   // этап 68 на месте
    expect(fnBody(sql, "_sa_chat_call_kb")).toContain("jsonb_build_object('text', 'Занят, передать дальше', 'callback_data', 'cg:' || p_msg || ':1')");
  });
  it("передать дальше: занятый — первым, следующий — в конец; кто может; ошибки; новый вызов от позвавшего", () => {
    const f = fnBody(sql, "_sa_chat_pass_do");
    expect(f).toContain("if not by_target and m.emp_id <> c->>'id' and not coalesce((c->>'lead')::boolean, false) then");
    for (const e of ["'passed'", "'going'", "'stale'", "'nobody'", "'forbidden'", "'bad_request'"]) expect(f, e).toContain("'error', " + e);
    expect(f).toContain("perform _sa_queue_move(ch.restaurant, target, true);");
    expect(f).toContain("perform _sa_queue_move(ch.restaurant, nxt, false);");
    expect(f).toContain("values (m.chat_id, m.emp_id, m.emp_name, m.emp_rest, line, 'call', call2) returning * into m2;");
    expect(f).toContain("case when by_target then ' передаёт этот стол тебе.' else ' не отвечает, стол передали тебе.' end");
    expect(f).toContain("' передаёт стол ' || coalesce(m.call->>'table', '') || ' дальше: позвали '");
    expect(fnBody(sql, "_sa_chat_calls")).toContain("and not (m.call ? 'passed')");
    expect(fnBody(sql, "chat_go")).toContain("if m.call ? 'passed' then return jsonb_build_object('ok', false, 'error', 'passed', 'msg', _sa_chat_msg_json(m)); end if;");
  });
  it("кнопки бота: cg:<вызов>:1 — передать; «Иду» на переданный стол — нет; остальное — как в этапе 38", () => {
    const f = fnBody(sql, "_sa_chat_tg_cb");
    expect(f).toContain("if m.kind = 'call' and mm[3] = '1' then\n      r := _sa_chat_pass_do(c, m);");
    expect(f).toContain("'Передать некому: остальные в очереди на перерыве или уже передали этот стол.'");
    expect(f).toContain("elsif m.call ? 'passed' then\n      ok := false; done := 'Этот стол уже передали дальше.'; tip := done;");
    expect(f).toContain("E'\\n\\n(Ты идёшь|Стол передан|Этот стол уже|На этот вызов|Вызов устарел|Смена твоя|");
    expect(f).toContain("r := _sa_sh_take_do(c, m.id);");   // «Забрать» смену — как было
    expect(f).toContain("m := _sa_poll_vote_do(c, m, o, false);");   // голос в опросе — как было
  });
  it("журнал этапов и SQL-проверки знают этап 69", () => {
    expect(rd("supabase/README.md")).toContain("`supabase-stage69-waiter-queue.sql`");
    expect(rd("tools/claude/README.md")).toContain("sql/test69.sh");
    expect(rd("tools/claude/sql/test69.sh")).toContain("S69=supabase-stage69-waiter-queue.sql");
  });
});

describe("v213 · очередь на телефоне (lib/call-queue.js)", () => {
  it("ответ сервера: повторы убраны, others — без тех, кто в очереди; не очередь — null", () => {
    const q = queueOf(Q0);
    expect(q.list.map((x) => x.id)).toEqual(["a", "v", "p", "g"]);
    expect(q.others).toEqual([{ id: "d", name: "Дина Белова", from: null, to: null }]);   // v215: from — начало смены сегодня; v217: to — конец
    expect([q.edit, q.day]).toEqual([true, "2026-11-28"]);
    expect([queueOf({ ok: false, error: "missing" }), queueOf(null), queueOf({ ok: true })]).toEqual([null, null, null]);
  });
  it("кто в очереди, следующий (не на перерыве, не пропущенный), место", () => {
    const q = queueOf(Q0);
    expect(ids(q)).toBe("a,v·п,p");
    expect(queueNext(q).id).toBe("a");
    expect(queueNext(q, ["a"]).id).toBe("p");   // Вера на перерыве
    expect(queueNext(q, ["a", "p"])).toBe(null);
    expect([queuePos(q, "p"), queuePos(q, "g"), queuePos(q, "x")]).toEqual([3, 0, 0]);
    expect(queueNext(null)).toBe(null);
  });
  it("позвали к столу — в конец; с перерыва, из убранных и из others — тоже; не официант — как было", () => {
    const q = queueOf(Q0);
    expect(ids(queueAfterCall(q, "a"))).toBe("v·п,p,a");
    expect(ids(queueAfterCall(q, "v"))).toBe("a,p,v");
    expect(ids(queueAfterCall(q, "g"))).toBe("a,v·п,p,g");
    const d = queueAfterCall(q, "d");   // v215: кого нет в очереди — не дописываем, дописывает хостес
    expect([ids(d), d.others.length, d === q]).toEqual(["a,v·п,p", 1, true]);
    expect(queueAfterCall(q, "x")).toBe(q);
  });
  it("правки: выше и ниже (убранные стоят на месте), перерыв, убрать и вернуть (в конец), добавить; для queue_set", () => {
    const q = queueOf(Q0);
    expect(ids(queueMove(q, "p", -1))).toBe("a,p,v·п");
    expect(queueMove(q, "p", -1).list.map((x) => x.id)).toEqual(["a", "p", "v", "g"]);
    expect(queueMove(q, "a", -1)).toBe(q);
    expect(ids(queueFlag(q, "v", "away", false))).toBe("a,v,p");
    expect(ids(queueFlag(q, "a", "out", true))).toBe("v·п,p");
    expect(ids(queueFlag(q, "g", "out", false))).toBe("a,v·п,p,g");
    expect(queueFlag(q, "a", "bogus", true)).toBe(q);
    const add = queueAdd(q, "d");
    expect([ids(add), add.others.length]).toEqual(["a,v·п,p,d", 0]);
    // v217: и stay — «Остался» после смены
    expect(queueOrd(add)).toEqual([{ id: "a", away: false, out: false, stay: false }, { id: "v", away: true, out: false, stay: false }, { id: "p", away: false, out: false, stay: false },
      { id: "g", away: false, out: true, stay: false }, { id: "d", away: false, out: false, stay: false }]);
    expect(queueLabels([{ name: "Анна Смирнова" }, { name: "Анна Сидорова" }, { name: "Пётр Орлов" }])).toEqual(["Анна Смирнова", "Анна Сидорова", "Пётр О."]);
  });
  it("можно ли передать: лично к столу, без ответа, не передан, моложе 10 минут; тот, кого звали, кто звал, руководитель", () => {
    const now = Date.parse("2026-11-28T10:00:00Z");
    const m = { id: 5, kind: "call", emp: "o", at: new Date(now - 60e3).toISOString(), call: { who: "person", emp: "a", why: "table", table: "13", going: [] } };
    expect([canPass(m, { id: "a" }, now), canPass(m, { id: "o" }, now), canPass(m, { id: "x", lead: true }, now), canPass(m, { id: "p" }, now)]).toEqual([true, true, true, false]);
    expect(canPass({ ...m, call: { ...m.call, why: "help" } }, { id: "a" }, now)).toBe(false);
    expect(canPass({ ...m, call: { ...m.call, who: "waiter" } }, { id: "a" }, now)).toBe(false);
    expect(canPass({ ...m, call: { ...m.call, going: [{ id: "a" }] } }, { id: "a" }, now)).toBe(false);
    expect(canPass({ ...m, call: { ...m.call, passed: { to: "p" } } }, { id: "a" }, now)).toBe(false);
    expect(canPass({ ...m, at: new Date(now - 11 * 60e3).toISOString() }, { id: "a" }, now)).toBe(false);
    expect(canPass({ ...m, del: true }, { id: "a" }, now)).toBe(false);
  });
  it("тексты: кому передали, от кого пришло, ошибки", () => {
    expect(passedLine({ emp: "a", to_name: "Анна Смирнова", passed: { by: "a", by_name: "Анна Смирнова", to: "p", to_name: "Пётр Орлов" } })).toBe("Анна передаёт стол дальше: позвали Петра");
    expect(passedLine({ emp: "a", to_name: "Анна Смирнова", passed: { by: "o", by_name: "Ольга Ли", to: "v", to_name: "Вера Соколова" } })).toBe("Стол передан дальше: позвали Веру");
    expect(passedLine({})).toBe("");
    expect(fromLine({ from: { id: "a", name: "Анна Смирнова", self: true } })).toBe("Анна передаёт этот стол");
    expect(fromLine({ from: { id: "v", name: "Вера Соколова", self: false } })).toBe("Вера не отвечает, стол передали");
    expect(fromLine({})).toBe("");
    expect(passErrText({ error: "nobody" })).toBe("Передать некому: остальные в очереди на перерыве или уже передали этот стол.");
    expect([passErrText({ error: "going" }), passErrText({ error: "passed" }), passErrText({ error: "stale" }), passErrText({ error: "net" }), passErrText(null)])
      .toEqual(["На этот вызов уже идут.", "Этот стол уже передали дальше.", "Вызов устарел.", "Нет связи. Попробуй ещё раз.", "Не получилось. Проверь связь и попробуй ещё раз."]);
    expect(passErrText({ error: "missing" })).toBe("Передать дальше пока нельзя: на сервере нет очереди официантов.");
  });
  it("состояние вызова «передан» — раньше всех; запросы к серверу", async () => {
    expect(callState({ at: new Date().toISOString(), call: { going: [{ id: "x" }], passed: { to: "p", to_name: "Пётр" } } })).toEqual({ st: "passed", passed: { to: "p", to_name: "Пётр" } });
    expect(callState({ at: new Date().toISOString(), call: { going: [] } }).st).toBe("wait");
    const calls = [];
    const api = chatApi((fn, args) => { calls.push([fn, args]); return Promise.resolve({ ok: true }); });
    await api.queue(); await api.queueSet([{ id: "a", away: false, out: false }]); await api.pass(7);
    expect(calls).toEqual([["queue_get", {}], ["queue_set", { p_ord: [{ id: "a", away: false, out: false }] }], ["chat_pass", { p_msg: 7 }]]);
  });
});

describe("v213 · демо-сервер — как этап 69", () => {
  const P = [{ id: "u-host", name: "Ольга", surname: "Ли", restaurant: "R", position: "hostess" }, { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter" },
    { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: "R", position: "waiter" }, { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: "R", position: "waiter" },
    { id: "u-m", name: "Мария", surname: "Ким", restaurant: "R", position: "manager" }];
  const t = Date.parse("2026-11-28T09:00:00");
  const mk = (o = {}) => makeServer({ today: "2026-11-28", clock: () => t, rest: "R", people: P, tok: { th: "u-host", ta: "e-anna", tv: "e-vera", tp: "e-petr", tm: "u-m" },
    sstaff: [], cfg: { shifts: [], staff: [] }, plan: {}, menu: [], cheers: false, ...o });
  const names = (s, tok = "th") => s.rpc("queue_get", { p_token: tok }).list.filter((x) => !x.out).map((x) => x.name.split(" ")[0] + (x.away ? "·п" : "")).join(",");
  it("очередь: утром пустая, составляет хостес; менять — хостес и руководитель; позвали к столу — в конец", () => {
    const s = mk();
    expect(names(s)).toBe("");   // v215: сама не собирается
    expect(s.rpc("queue_get", { p_token: "th" }).others.map((x) => x.name.split(" ")[0])).toEqual(["Анна", "Вера", "Пётр"]);
    expect(s.rpc("queue_get", { p_token: "ta" }).edit).toBe(false);
    expect(s.rpc("queue_set", { p_token: "ta", p_ord: [] }).error).toBe("forbidden");
    s.rpc("queue_set", { p_token: "th", p_ord: [{ id: "e-anna" }, { id: "e-vera" }, { id: "e-petr" }] });
    expect(names({ rpc: (fn, b) => s.rpc(fn, b) }, "ta")).toBe("Анна,Вера,Пётр");
    s.rpc("queue_set", { p_token: "th", p_ord: [{ id: "e-petr" }, { id: "e-anna", away: true }, { id: "e-petr" }, { id: "u-m" }] });
    expect(names(s)).toBe("Пётр,Анна·п,Вера");
    s.rpc("queue_set", { p_token: "th", p_ord: [{ id: "e-anna" }, { id: "e-vera" }, { id: "e-petr" }] });
    s.rpc("chat_call", { p_token: "th", p_who: "person", p_emp: "e-anna", p_why: "table", p_table: "5" });
    expect(names(s)).toBe("Вера,Пётр,Анна");
    s.rpc("chat_call", { p_token: "th", p_who: "person", p_emp: "e-vera", p_why: "help" });
    expect(names(s)).toBe("Вера,Пётр,Анна");
  });
  it("передать дальше: следующему в очереди, занятый — первым; повтор — passed; «Иду» на переданный — passed; некому — nobody", () => {
    const s = mk();
    s.rpc("queue_set", { p_token: "th", p_ord: [{ id: "e-anna" }, { id: "e-vera" }, { id: "e-petr" }] });   // v215: очередь составила хостес
    const c1 = s.rpc("chat_call", { p_token: "th", p_who: "person", p_emp: "e-anna", p_why: "table", p_table: "9" }).msg;
    expect(s.rpc("chat_pass", { p_token: "tp", p_msg: c1.id }).error).toBe("forbidden");
    const r = s.rpc("chat_pass", { p_token: "ta", p_msg: c1.id });
    expect([r.ok, r.msg.call.passed.to, r.next.call.emp, r.next.call.from.name, r.next.call.from.self, r.next.emp]).toEqual([true, "e-vera", "e-vera", "Анна Смирнова", true, "u-host"]);
    expect(names(s)).toBe("Анна,Пётр,Вера");
    expect(s.rpc("chat_pass", { p_token: "ta", p_msg: c1.id }).error).toBe("passed");
    expect(s.rpc("chat_go", { p_token: "ta", p_msg: c1.id }).error).toBe("passed");
    expect(s.rpc("chat_unread", { p_token: "ta" }).calls.some((m) => m.id === c1.id)).toBe(false);
    expect(s.rpc("chat_unread", { p_token: "tv" }).calls.some((m) => m.id === r.next.id)).toBe(true);
    const r2 = s.rpc("chat_pass", { p_token: "th", p_msg: r.next.id });
    expect([r2.next.call.emp, r2.next.call.skip, r2.next.call.from.self]).toEqual(["e-petr", ["e-vera", "e-anna"], false]);
    expect(s.rpc("chat_pass", { p_token: "tp", p_msg: r2.next.id }).error).toBe("nobody");
    s.rpc("chat_go", { p_token: "tp", p_msg: r2.next.id });
    expect(s.rpc("chat_pass", { p_token: "tp", p_msg: r2.next.id }).error).toBe("going");
  });
  it("без этапа 69 — функций нет, очередь не двигается", () => {
    const s = mk({ noStage69: true });
    expect(s.rpc("queue_get", { p_token: "th" }).code).toBe("PGRST202");
    expect(s.rpc("chat_pass", { p_token: "ta", p_msg: 1 }).code).toBe("PGRST202");
    expect(s.rpc("chat_call", { p_token: "th", p_who: "person", p_emp: "e-anna", p_why: "table", p_table: "5" }).ok).toBe(true);
  });
});

describe("v213 · экран", () => {
  it("«Кого · по очереди»: номера, выбранный, перерыв, «Пропустить Анну», «Изменить очередь»", async () => {
    const { QueueChips } = await import("../ui/call-queue.jsx");
    const q = queueOf(Q0);
    const html = R(h(QueueChips, { q, picked: "a", auto: true, edit: true, editing: false, onPick() {}, onSkip() {}, onEdit() {} }));
    expect([...html.matchAll(/data-call-qperson="([a-z])"/g)].map((m) => m[1])).toEqual(["a", "v", "p"]);
    expect(html).toMatch(/role="radio" aria-checked="true" class="ch-chip" data-call-qperson="a" aria-label="1\. Анна Смирнова"/);
    expect(html).toMatch(/class="ch-chip away" data-call-qperson="v" aria-label="2\. Вера Соколова, на перерыве"/);
    expect(html).toMatch(/data-call-skip="a">Пропустить Анну: позвать следующего</);
    expect(html).toMatch(/data-queue-open=""[^>]*>Изменить очередь</);
    const manual = R(h(QueueChips, { q, picked: "p", auto: false, edit: false, editing: false, onPick() {}, onSkip() {}, onEdit() {} }));
    expect(manual).not.toContain("data-call-skip");
    expect(manual).not.toContain("data-queue-open");
  });
  it("правка очереди: выше и ниже, перерыв, убрать; вернуть и добавить; подсказка", async () => {
    const { QueuePanel } = await import("../ui/call-queue.jsx");
    const html = R(h(QueuePanel, { q: queueOf(Q0), onChange() {} }));
    expect((html.match(/data-queue-row="/g) || []).length).toBe(3);
    expect(html).toMatch(/aria-label="Выше: Анна Смирнова" data-queue-up="a" disabled=""/);
    expect(html).toMatch(/aria-label="Ниже: Пётр Орлов" data-queue-down="p" disabled=""/);
    expect(html).toMatch(/aria-pressed="true" data-queue-pause="v"[^>]*>Вернуть</);
    expect(html).toMatch(/data-queue-back="g"[^>]*>\+ Глеб О\.</);   // v215: коротко, как в очереди
    expect(html).toMatch(/data-queue-add="d"[^>]*>\+ Дина Б\.</);
    expect(html).toContain("Позвали к столу или посадили гостей: официант уходит в конец. Занят и передал стол: остаётся первым.");   // v215: и «Рассадка»
  });
  it("«Смена»: «Очередь к столам», «Ты в очереди: 3 из 3», на перерыве — так и пишем", async () => {
    const { QueueCard } = await import("../ui/shift-role.jsx");
    const q = queueOf(Q0);
    const me = R(h(QueueCard, { a11y: false, q, meId: "p" }));
    expect(me).toContain("Очередь к столам");
    expect(me).toContain("Ты в очереди: 3 из 3");
    expect(R(h(QueueCard, { a11y: false, q, meId: "v" }))).toContain("Ты на перерыве: очередь тебя пропускает");
    expect(R(h(QueueCard, { a11y: false, q, meId: "x" }))).not.toContain("Ты в очереди");
    expect(R(h(QueueCard, { a11y: false, q: queueOf({ ok: true, list: [] }), meId: "x" }))).toBe("");
  });
  it("баннер вызова: «Занят, передать дальше» и объяснение; номер стола не отрывается", async () => {
    const { CallBanner } = await import("../ui/chat.jsx");
    const call = { id: 7, emp: "o", name: "Ольга Ли", kind: "call", call: { who: "person", emp: "me", toName: "Анна", why: "table", table: "13" } };
    const html = renderToString(h(CallBanner, { a11y: false, me: { id: "me" }, call, onGo() {}, onClose() {}, onPass() {}, note: "Передать некому" }));
    expect(html).toContain("Ольга зовёт тебя: к столу 13");
    expect(html).toMatch(/data-chat-banner-pass="">Занят, передать дальше</);
    expect(html).toMatch(/data-chat-banner-note="">Передать некому</);
    expect(renderToString(h(CallBanner, { a11y: false, me: { id: "me" }, call, onGo() {}, onClose() {} }))).not.toContain("data-chat-banner-pass");
  });
  it("в коде: лист «Позвать» с очередью, карточка вызова с «передать», App — баннер и «Смена»", () => {
    const s = rd("ui/call-sheet.jsx");
    expect(s).toContain("const useQ = qOn && !queueEmpty(q);");   // v215: пустая очередь — «не составлена · Составить»
    expect(s).toContain("if (n) { setWho(\"person\"); setPerson({ id: n.id, name: n.name }); setAuto(true); }");
    expect(s).toContain("if (c.who === \"person\" && c.why === \"table\" && !res.again) { setQ((qq) => queueAfterCall(qq, c.emp)); setSkip([]); }");
    expect(s).toContain("Promise.resolve(api.queueSet(queueOrd(nq)))");
    const c = rd("ui/chat.jsx");
    expect(c).toContain("{!m.del && onPass && canPass(m, me, now) ? <button type=\"button\" className=\"ch-pass\" data-chat-pass={m.id}");
    expect(c).toContain("? \"Занят, передать дальше\" : \"Передать дальше по очереди\"");
    expect(c).toContain("{st.st === \"passed\" ? passedLine(m.call)");
    expect(c).toContain("Promise.resolve(api.pass(m.id)).then((r) => {");
    const a = rd("App.jsx");
    expect(a).toContain("onPass={canPass(myCall, chatMe) ? callPass : null} note={callNote}");
    expect(a).toContain("chatApiObj.pass(id).then((r) => {");
    expect(a).toContain("{queueInfo && queueWho && (queueLive(queueInfo).length || (queueInfo.edit && callHost)) ? <QueueCard a11y={a11y} q={queueInfo} meId={profile.id}");   // v215
    expect(a).toContain("if (r && r.error === \"missing\") { queueOffRef.current = true; setQueueInfo(null); return; }");
  });
});

describe("v213 · тексты", () => {
  it("без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["lib/call-queue.js", "ui/call-queue.jsx", "ui/call-sheet.jsx", "ui/shift-role.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect([f, /\p{Extended_Pictographic}/u.test(src)]).toEqual([f, false]);
    }
  });
});
