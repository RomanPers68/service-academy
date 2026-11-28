// v215 (Доп. 541): очередь составляет хостес по приходу, очередь в чате и в «Рассадке», колокольчики по состоянию
// вызова и «На месте». Владелец: «может сделаем так, что бы хостес или же менеджер составлял ее сам», «когда хостес
// выбирал/а стол, сотрудник подсвечивался исходя из очереди», «Когда человек нажимает «иду», он меняет цвет?», «Давай
// не будем делать переход через 2 мин автоматически» и «официант подходит сразу не нажимая «иду»».
//   • этап 69 переделан на месте (на сервер ещё не применён): очередь сама не собирается, others — по началу смены,
//     seat_set двигает очередь, chat_call_state и chat_call_done;
//   • lib/call-queue.js — «Сегодня по графику», «Все по графику», строка очереди; lib/call-series.js — метки колокольчиков
//     по состоянию; ui — правка очереди, строка в чате, кнопки «На месте» и «Передать следующему», «Рассадка».
// В браузере: tools/claude/e2e-v215.mjs; этап на базе — tools/claude/sql/test69.sh.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { queueOf, queueLive, queueEmpty, queueToday, queueBySchedule, fromLabel, queueLine, queueAfterCall, queueOrd, canPass, passErrText } from "../lib/call-queue.js";
import { markOf, tableMarks, markLine, markIds, callStates, LATE_MS } from "../lib/call-series.js";
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
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const fnBody = (sql, name) => { const i = sql.indexOf("create or replace function " + name + "("); if (i < 0) return ""; const o = sql.indexOf("$$", i); return sql.slice(i, sql.indexOf("$$;", o + 2) + 3); };

const T0 = Date.parse("2026-11-28T12:00:00Z");
const EMPTY = { ok: true, day: "2026-11-28", edit: true, list: [],
  others: [{ id: "p", name: "Пётр Орлов", from: 10 }, { id: "v", name: "Вера Соколова", from: 12 }, { id: "a", name: "Анна Смирнова", from: 16 }, { id: "d", name: "Дина Белова", from: null }] };

describe("v215 · версия и журнал", () => {
  it("сборка v215, Дополнение 541 со словами владельца, строки не длиннее 120", () => {
    expect(Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1])).toBeGreaterThanOrEqual(215);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 541 — .*\(v215\)/);
    const part = c.slice(c.indexOf("# Дополнение 541"));
    for (const w of ["хостес или же менеджер составлял ее сам", "в какое время сотрудник зашел на работу", "подходит сразу не нажимая «иду»",
      "chat_call_state", "chat_call_done", "seat_set", "QueueStrip", "test69.sh", "e2e-v215.mjs", "«На месте»"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v215 · этап 69 после переделки", () => {
  const sql = rd("supabase/supabase-stage69-waiter-queue.sql");
  it("нужен этап 56; очередь сама не собирается; двигается только тот, кто в ней", () => {
    expect(sql).toContain("raise exception 'Сначала этап 56 (supabase-stage56-join-move-wait.sql): объединить столы, пересадить гостей, лист ожидания';");
    expect(sql).toContain("-- Нужны этапы 38, 56 и 68. Безвреден повторно.");
    const ord = fnBody(sql, "_sa_queue_ord");
    expect(ord).not.toContain("_sa_chat_today");
    expect(ord).not.toContain("fresh");
    expect(fnBody(sql, "_sa_queue_move")).toContain("if not exists (select 1 from jsonb_array_elements(q) x where x->>'id' = p_emp) then return; end if;");
  });
  it("others — по началу смены сегодня (from), потом по имени", () => {
    const f = fnBody(sql, "_sa_queue_from");
    expect(f).toContain("s := _sa_sh_staff(cfg, p_emp, to_char(d, 'YYYY-MM'));");
    expect(f).toContain("def := _sa_sh_def(cfg, _sa_sh_code(p_rest, s->>'id', d));");
    expect(fnBody(sql, "_sa_queue_json")).toContain("jsonb_build_object('id', w.id, 'name', w.nm, 'from', w.f) order by w.f is null, w.f, w.nm, w.id");
  });
  it("seat_set — этап 56 слово в слово, плюс очередь", () => {
    const f56 = fnBody(rd("supabase/supabase-stage56-join-move-wait.sql"), "seat_set"), f = fnBody(sql, "seat_set");
    const tail = "  return jsonb_build_object('ok', true, 'table', _sa_seat_json(r), 'tables', _sa_seat_rows(rest, ld, touched));";
    expect(f.slice(0, f.indexOf("  -- этап 69: посадили"))).toBe(f56.slice(0, f56.indexOf(tail)));
    expect(f).toContain("if st = 'seat' and wid is not null and (coalesce(old.status, '') not in ('seat', 'bill') or old.waiter_id is distinct from wid) then\n    perform _sa_queue_move(rest, wid, false);");
  });
  it("колокольчики: последний в цепочке передач, ждём · идёт · на месте · погас; «На месте» — кто может и что меняет", () => {
    const st = fnBody(sql, "chat_call_state");
    expect(st).toContain("returns jsonb language plpgsql volatile security definer");
    expect(st).toContain("while m.call ? 'passed' and hops < 8 loop");
    expect(st).toContain("if p_ids is null or cardinality(p_ids) > 40 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;");
    expect(st).toContain("if not _sa_chat_ok(c, ch) then continue; end if;");
    const dn = fnBody(sql, "chat_call_done");
    expect(dn).toContain("if m.emp_id <> c->>'id' and not _sa_queue_can(c) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;");
    expect(dn).toContain("jsonb_build_object('done', jsonb_build_object('by', c->>'id', 'by_name', coalesce(c->>'who', ''), 'at', now()))");
    expect(fnBody(sql, "_sa_chat_calls")).toContain("and not (m.call ? 'passed') and not (m.call ? 'done')");
    expect(fnBody(sql, "_sa_chat_pass_do")).toContain("if coalesce(jsonb_array_length(m.call->'going'), 0) > 0 or m.call ? 'done' then");
    expect(sql).toContain("chat_call_state(text, bigint[]), chat_call_done(text, bigint), seat_set(text, text, text, int, text, text, text) to anon, authenticated;");
  });
});

describe("v215 · очередь по приходу (lib/call-queue.js)", () => {
  it("пустая утром; «Сегодня по графику» — по началу смены; кто не в графике — отдельно", () => {
    const q = queueOf(EMPTY);
    expect([queueEmpty(q), queueLive(q).length]).toEqual([true, 0]);
    expect(queueToday(q).map((x) => x.id + ":" + x.from)).toEqual(["p:10", "v:12", "a:16"]);
    expect(q.others.find((x) => x.id === "d").from).toBe(null);
    expect([fromLabel({ from: 16 }), fromLabel({ from: 26 }), fromLabel({ from: null }), fromLabel(null)]).toEqual(["с 16:00", "с 2:00", "", ""]);
    expect(queueOf({ ...EMPTY, others: [{ id: "x", name: "X", from: "10" }, { id: "y", name: "Y", from: 99 }] }).others.map((x) => x.from)).toEqual([null, null]);
  });
  it("«Все по графику» — в конец, по началу смены; уже в очереди и убранные остаются; позвали не из очереди — не дописываем", () => {
    // v217: «Все, кто на смене» — тех, кто по графику уже на смене; вечер, 23:00, — на смене все
    const q = queueOf({ ...EMPTY, min: 23 * 60, list: [{ id: "v", name: "Вера Соколова" }], others: EMPTY.others.filter((x) => x.id !== "v") });
    const all = queueBySchedule(q);
    expect(queueOrd(all).map((x) => x.id)).toEqual(["v", "p", "a"]);
    expect(all.others.map((x) => x.id)).toEqual(["d"]);
    expect(queueBySchedule(queueOf({ ...EMPTY, others: [EMPTY.others[3]] })).list.length).toBe(0);
    expect(queueAfterCall(q, "a")).toBe(q);
    expect(queueOrd(queueAfterCall(all, "v")).map((x) => x.id)).toEqual(["p", "a", "v"]);
  });
  it("строка очереди: имена коротко, моё место, перерыв; пустая — null", () => {
    const q = queueOf({ ...EMPTY, list: [{ id: "a", name: "Анна Смирнова" }, { id: "v", name: "Вера Соколова", away: true }, { id: "p", name: "Пётр Орлов" }], others: [] });
    expect(queueLine(q, "p")).toEqual({ names: ["Анна С.", "Вера С.", "Пётр О."], next: { id: "a", name: "Анна Смирнова", away: false, out: false, stay: false, here: false, from: null, to: null },
      pos: 3, away: false, n: 3, over: 0, early: 0, meOver: false, meEarly: false, meFrom: "" });   // v217: часы смены, over и meOver; v218: here, early
    expect(queueLine(q, "v").away).toBe(true);
    expect(queueLine(q, "x").pos).toBe(0);
    expect(queueLine(queueOf(EMPTY), "a")).toBe(null);
  });
  it("«На месте» — передать уже нельзя; вызов в чате — «done»", () => {
    const msg = { kind: "call", emp: "host", at: new Date(T0).toISOString(), call: { who: "person", why: "table", emp: "a", going: [], done: { by: "host", by_name: "Ольга Ли", at: "x" } } };
    expect(canPass(msg, { id: "a" }, T0 + 1000)).toBe(false);
    expect(canPass({ ...msg, call: { ...msg.call, done: undefined } }, { id: "a" }, T0 + 1000)).toBe(true);
    expect(callState(msg, T0 + 1000)).toEqual({ st: "done", done: msg.call.done });
    expect(callState({ ...msg, call: { ...msg.call, going: [{ id: "a", name: "Анна" }] } }, T0).st).toBe("going");
    expect(passErrText({ error: "nobody" })).toBe("Передать некому: остальные в очереди на перерыве или уже передали этот стол.");
  });
});

describe("v215 · колокольчики (lib/call-series.js)", () => {
  const r13 = { tid: "t13", table: "13", who: "person", emp: "a", toName: "Анна Смирнова", why: "table", at: T0, msg: 501 };
  const at = (ms) => new Date(T0 + ms).toISOString();
  it("ждём → молчит через две минуты; «Иду» и «На месте» — зелёные; погас — метки нет", () => {
    expect(LATE_MS).toBe(120000);
    expect(markOf(r13, null, T0 + 30e3)).toMatchObject({ st: "wait", label: "позвали Анну, ждём", msg: 501, who: "person", emp: "a" });
    expect(markOf(r13, null, T0 + 125e3)).toMatchObject({ st: "late", label: "Анна не отвечает" });
    expect(markOf({ ...r13, who: "waiter", toName: "" }, null, T0 + 125e3).label).toBe("Никто не ответил");
    expect(markOf(r13, { st: "going", msg: 501, who: "person", name: "Анна Смирнова", by: "Анна Смирнова", at: at(0), going_at: at(40e3) }, T0 + 300e3))
      .toMatchObject({ st: "going", label: "Анна идёт", at: T0 + 40e3 });
    expect(markOf(r13, { st: "done", msg: 501, who: "person", name: "Анна Смирнова", by: "Ольга Ли", at: at(0), going_at: at(200e3) }, T0 + 300e3))
      .toMatchObject({ st: "done", label: "Анна на месте", at: T0 + 200e3 });
    expect(markOf(r13, { st: "gone" }, T0)).toBe(null);
  });
  it("передали дальше — метка про следующего: кого зовут и ждём ли", () => {
    const s = { st: "wait", msg: 777, who: "person", emp: "v", name: "Вера Соколова", at: at(150e3), hops: 1 };
    expect(markOf(r13, s, T0 + 160e3)).toMatchObject({ st: "wait", label: "позвали Веру, ждём", msg: 777, emp: "v", hops: 1 });
    expect(markOf(r13, s, T0 + 290e3)).toMatchObject({ st: "late", label: "Вера не отвечает" });
  });
  it("метки на схеме по ответу сервера; строка под схемой; id для опроса", () => {
    const plan = { tables: [{ id: "t13", n: "13" }, { id: "t7", n: "7" }] };
    const recent = [r13, { tid: null, table: "7", who: "person", emp: "v", toName: "Вера Соколова", why: "table", at: T0, msg: 502 }, { why: "help", who: "lead", at: T0, msg: 503 }];
    const states = callStates({ ok: true, list: [{ id: 501, msg: 501, st: "going", who: "person", name: "Анна Смирнова", by: "Анна Смирнова", at: at(0), going_at: at(10e3) },
      { id: 502, msg: 502, st: "gone" }] });
    const marks = tableMarks(recent, plan, states, T0 + 60e3);
    expect(Object.keys(marks)).toEqual(["t13"]);
    expect(markLine(marks.t13, T0 + 30e3)).toBe("Анна идёт, только что");
    expect(markLine(marks.t13, T0 + 190e3)).toBe("Анна идёт · 3 мин назад");
    expect(markLine({ st: "late", label: "Вера не отвечает", at: T0 }, T0 + 185e3)).toBe("Вера не отвечает 3 мин");
    expect(markLine({ st: "wait", label: "позвали Петра, ждём", at: T0 }, T0 + 70e3)).toBe("позвали Петра, ждём · 1 мин");
    expect(markIds([...recent, { ...r13 }, { why: "table", msg: null }])).toEqual([501, 502]);
    expect(callStates({ ok: false })).toEqual({});
  });
  it("API: колокольчики и «На месте»", async () => {
    const got = [];
    const api = chatApi((fn, args) => { got.push([fn, args]); return Promise.resolve({ ok: true }); });
    await api.callState([501, "502", 0, -3]); await api.callDone(501);
    expect(got).toEqual([["chat_call_state", { p_ids: [501, 502] }], ["chat_call_done", { p_msg: 501 }]]);
  });
});

describe("v215 · демо-сервер", () => {
  const P = [{ id: "u-host", name: "Ольга", surname: "Ли", restaurant: "R", position: "hostess" }, { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter" },
    { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: "R", position: "waiter" }, { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: "R", position: "waiter" }];
  const t = Date.parse("2026-11-28T09:00:00");
  let clock = t;
  const mk = () => makeServer({ today: "2026-11-28", clock: () => clock, rest: "R", people: P, tok: { th: "u-host", ta: "e-anna", tv: "e-vera", tp: "e-petr" },
    sstaff: [{ id: 1, name: "Смирнова Анна", pos: "waiter" }, { id: 2, name: "Соколова Вера", pos: "waiter" }],
    cfg: { shifts: [{ k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }], staff: [] }, plan: { 1: { 0: "В" }, 2: { 0: "Д" } }, menu: [], cheers: false });
  it("утром пусто; others — по началу смены (Вера 12, Анна 16), Пётр не в графике", () => {
    const s = mk(), r = s.rpc("queue_get", { p_token: "th" });
    expect(r.list).toEqual([]);
    expect(r.others.map((x) => x.id + ":" + x.from)).toEqual(["e-vera:12", "e-anna:16", "e-petr:null"]);
    s.rpc("chat_call", { p_token: "th", p_who: "person", p_emp: "e-anna", p_why: "table", p_table: "5" });
    expect(s.rpc("queue_get", { p_token: "th" }).list).toEqual([]);
  });
  it("колокольчики: ждём, «Иду», «На месте», передали — по последнему в цепочке; погас через 10 минут", () => {
    clock = t;
    const s = mk();
    // v218: Анна (вечер, с 16) пришла раньше — «Пришёл», иначе до смены стол ей не передают
    s.rpc("queue_set", { p_token: "th", p_ord: [{ id: "e-anna", here: true }, { id: "e-vera" }, { id: "e-petr" }] });
    const c1 = s.rpc("chat_call", { p_token: "th", p_who: "person", p_emp: "e-anna", p_why: "table", p_table: "5" }).msg;
    const c2 = s.rpc("chat_call", { p_token: "th", p_who: "person", p_emp: "e-vera", p_why: "table", p_table: "6" }).msg;
    const c3 = s.rpc("chat_call", { p_token: "th", p_who: "person", p_emp: "e-petr", p_why: "table", p_table: "7" }).msg;
    s.rpc("chat_go", { p_token: "ta", p_msg: c1.id });
    expect(s.rpc("chat_call_done", { p_token: "ta", p_msg: c2.id }).error).toBe("forbidden");
    expect(s.rpc("chat_call_done", { p_token: "th", p_msg: c2.id }).msg.call.done.by_name).toBe("Ольга Ли");
    expect(s.rpc("chat_unread", { p_token: "tv" }).calls.some((m) => m.id === c2.id)).toBe(false);
    expect(s.rpc("chat_pass", { p_token: "th", p_msg: c2.id }).error).toBe("going");
    const ps = s.rpc("chat_pass", { p_token: "th", p_msg: c3.id });
    const st = s.rpc("chat_call_state", { p_token: "th", p_ids: [c1.id, c2.id, c3.id] }).list.map((x) => x.st + ":" + x.name.split(" ")[0] + ":" + x.hops);
    expect([ps.ok, st]).toEqual([true, ["going:Анна:0", "done:Вера:0", "wait:Анна:1"]]);
    clock = t + 11 * 60e3;
    expect(s.rpc("chat_call_state", { p_token: "th", p_ids: [ps.next.id] }).list[0].st).toBe("gone");
  });
});

describe("v215 · экран", () => {
  it("правка очереди: пустая — подсказка, «Сегодня по графику» с часом, «Все по графику», кто не в графике", async () => {
    const { QueuePanel } = await import("../ui/call-queue.jsx");
    // v217: вечер (23:00) — по графику на смене все; кнопка — «Все, кто на смене»
    const html = R(h(QueuePanel, { q: queueOf({ ...EMPTY, min: 23 * 60 }), onChange() {} }));
    expect(html).toContain("Отмечай официантов по приходу: кто пришёл первым, тот и первый в очереди.");
    expect(html).toMatch(/Сейчас на смене по графику, по началу смены<\/span><button[^>]*data-queue-all=""[^>]*>Все, кто на смене</);
    expect(html).toMatch(/data-queue-add="p"[^>]*>\+ Пётр О\.<span class="ch-q-from"> · с 10:00<\/span>/);
    expect(html).toMatch(/Не в графике сегодня[\s\S]*data-queue-rest=""[\s\S]*data-queue-add="d"[^>]*>\+ Дина Б\.</);
    expect(html.indexOf('data-queue-add="p"')).toBeLessThan(html.indexOf('data-queue-add="v"'));
    expect(html).toContain("Позвали к столу или посадили гостей: официант уходит в конец.");
  });
  it("схема: красный колокольчик — «На месте» и «Передать следующему по очереди»; у идущего — зелёный, кнопок нет", async () => {
    const { CallTables } = await import("../ui/call-table.jsx");
    const BOARD = { ok: true, plan: { v: 2, zones: [{ id: "z1", name: "Зал" }], tables: [{ id: "t13", n: "13", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }] }, tables: [], now: new Date().toISOString() };
    const now = Date.now();
    const late = R(h(CallTables, { a11y: false, board: BOARD, tid: "t13", who: "", marks: { t13: { st: "late", label: "Анна не отвечает", at: now - 185e3, msg: 9, who: "person" } },
      onPick() {}, onWaiter() {}, onManual() {}, onPass() {}, onHere() {} }));
    expect(late).toMatch(/data-table-mark="late"/);
    expect(late).not.toContain("sa-bell-ring");
    expect(late).toMatch(/data-call-picked-mark="late"[^>]*> · Анна не отвечает 3 мин</);
    expect(late).toMatch(/data-call-here-mark="9"[^>]*>На месте</);
    expect(late).toMatch(/data-call-pass-mark="9"[^>]*>Передать следующему по очереди</);
    const wait = R(h(CallTables, { a11y: false, board: BOARD, tid: null, who: "", marks: { t13: { st: "wait", label: "позвали Анну, ждём", at: now, msg: 9, who: "person" } }, onPick() {}, onWaiter() {}, onManual() {} }));
    expect(wait).toMatch(/data-table-mark="wait" class="sa-bell-ring"/);
    const going = R(h(CallTables, { a11y: true, board: BOARD, tid: "t13", who: "", marks: { t13: { st: "going", label: "Анна идёт", at: now, msg: 9, who: "person" } }, onPick() {}, onWaiter() {}, onManual() {}, onPass() {}, onHere() {} }));
    expect(going).toMatch(/data-table-mark="going"[^>]*style="[^"]*background:#2C6B48/);
    expect(going).toContain('<path d="M5 12.5l4.5 4.5L19 7.5"></path>');
    expect(going).not.toContain("data-call-here-mark");
  });
  it("в коде: опрос колокольчиков, «На месте» и «Передать», пустая очередь в листе, строка в чате, «Рассадка», «Смена»", () => {
    const s = rd("ui/call-sheet.jsx");
    expect(s).toContain("const t = setInterval(() => { try { if (!document.hidden) { load(); setTick((k) => k + 1); } } catch (e) { /* */ } }, 5000);");
    expect(s).toContain("Promise.resolve(api.callDone(mk.msg)).then((r) => {");
    expect(s).toContain("Promise.resolve(api.pass(mk.msg)).then((r) => {");
    expect(s).toContain('{qOn && !useQ && q.edit ? <div className="ch-lbl ch-q-lbl" data-queue-none=""><span>Очередь к столам не составлена</span>');
    expect(s).toContain("const [qEdit, setQEdit] = React.useState(!!(init && init.queue));");
    const c = rd("ui/chat.jsx");
    expect(c).toContain('{chat.kind === "team" && api.queue ? <QueueStrip api={api} me={me} /> : null}');
    expect(c).toContain('st.st === "done" ? "На месте"');
    const st = rd("ui/seating.jsx");
    expect(st).toContain("const qNext = !isBusy(row) && queue ? queueNext(queue) : null;");
    expect(st).toContain("React.useEffect(() => { if (qNextId && !touched.current) setWaiter(qNextId); }, [qNextId]);");
    expect(st).toContain('if (f.status === "seat" && f.waiter) { setQueue((qq) => queueAfterCall(qq, f.waiter)); loadQueue(); }');
    expect(st).toContain("queue={queue} now={now} onSave={saveTable}");
    expect(rd("App.jsx")).toContain("onOpen={callHost ? () => openCall({ queue: true }) : null}");
    expect(rd("ui/shift-role.jsx")).toContain('data-queue-card="none"');
    const css = rd("ui/css.js");
    expect(css).toContain(".sa-bell-ring { animation: saBellRing 1.8s ease-in-out infinite; transform-origin: 50% 12%; }");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .sa-bell-ring { animation: none; } }");
  });
});

describe("v215 · тексты", () => {
  it("без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["lib/call-queue.js", "lib/call-series.js", "ui/call-queue.jsx", "ui/call-sheet.jsx", "ui/call-table.jsx", "ui/shift-role.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect([f, /\p{Extended_Pictographic}/u.test(src)]).toEqual([f, false]);
    }
  });
});
