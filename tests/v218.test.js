// v218 (Доп. 544): очередь к столам и до начала смены — «Пришёл».
// Владелец спрашивал: «он не будет давать стол человеку которого нет в период с 11 до 17?». После этапа 73 очередь
// пропускала закончивших, а в живой очереди с утра стоял вечерний официант (добавили раньше) — до 17:00 ему всё ещё
// могли дать стол.
//   • lib/call-queue.js — here («Пришёл»); shiftEarly — до смены больше получаса и не «Пришёл»; shiftOff — вне смены;
//     queueOn, queueNext, queueLine — без тех, кто вне смены; queueAdd из «Позже по графику» ставит here сразу;
//   • ui/call-queue.jsx — бледная кнопка «с 17:00», «ещё не пришёл»; в правке «Пришёл» вместо «Перерыв»; в строке
//     чата у официанта «смена с 17:00»;
//   • этап 74 — _sa_queue_over: вне смены и до неё; here в очереди, queue_set, _sa_queue_move, _sa_queue_json.
// В браузере: tools/claude/e2e-v218.mjs; этап на базе — tools/claude/sql/test69.sh (раздел этапа 74).
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { queueOf, shiftEarly, shiftOff, shiftOver, queueOn, queueNext, queueLine, queueAdd, queueFlag, queueOrd, queueAfterCall, EARLY_MIN } from "../lib/call-queue.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const memStore = () => {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};
globalThis.localStorage = globalThis.localStorage || memStore();
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, head: { appendChild() {} }, getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const fnBody = (sql, name) => { const i = sql.indexOf("create or replace function " + name + "("); if (i < 0) return ""; const o = sql.indexOf("$$", i); return sql.slice(i, sql.indexOf("$$;", o + 2) + 3); };

const AT = 1_800_000_000_000;
const Q = (min, list, others = []) => queueOf({ ok: true, day: "2026-11-28", edit: true, min, list, others }, AT);
const P = { id: "p", name: "Пётр Орлов", from: 10, to: 18 }, V = { id: "v", name: "Вера Соколова", from: 12, to: 20 }, A = { id: "a", name: "Анна Смирнова", from: 17, to: 24 };

describe("v218 · версия и журнал", () => {
  it("сборка v218, Дополнение 544, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(218);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 544 — .*\(v218\)/);
    const part = c.slice(c.indexOf("# Дополнение 544"));
    for (const w of ["которого нет в период с 11 до 17", "«Пришёл»", "lib/call-queue.js", "supabase-stage74-queue-early.sql", "test69.sh", "e2e-v218.mjs"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v218 · до начала смены (lib/call-queue.js)", () => {
  it("рано — больше получаса до смены и не «Пришёл»; вне смены — рано или кончилась", () => {
    expect(EARLY_MIN).toBe(30);
    expect([shiftEarly(A, 989), shiftEarly(A, 990), shiftEarly({ ...A, here: true }, 600), shiftEarly({ id: "d", from: null }, 0), shiftEarly(null, 0)]).toEqual([true, false, false, false, false]);
    expect([shiftOff(A, 940), shiftOff(A, 1000), shiftOff(A, 1440), shiftOff({ ...A, stay: true }, 1500), shiftOff({ ...A, here: true }, 940)]).toEqual([true, false, true, false, false]);
    expect(shiftOver({ ...A, here: true }, 1440)).toBe(true);                     // «Пришёл» не значит «Остался»
  });
  it("следующий и строка: Анна (с 17) в очереди с утра — в 15:40 её не предлагают; «Пришёл» — предлагают", () => {
    const q = Q(940, [A, P, V]);
    expect(queueOn(q).map((x) => x.id)).toEqual(["p", "v"]);
    expect(queueNext(q).id).toBe("p");
    expect(queueNext(q, ["p", "v"])).toBe(null);
    expect(queueLine(q, "a")).toMatchObject({ names: ["Пётр О.", "Вера С."], pos: 0, early: 1, over: 0, meEarly: true, meFrom: "с 17:00", meOver: false });
    const h1 = queueFlag(q, "a", "here", true);
    expect(queueNext(h1).id).toBe("a");
    expect(queueOrd(h1)[0]).toEqual({ id: "a", away: false, out: false, stay: false, here: true });
    expect(queueAfterCall(h1, "a").list[2]).toMatchObject({ id: "a", here: true });
    expect(queueLine(Q(940, [A]), "p")).toMatchObject({ names: [], n: 0, early: 1, over: 0 });
  });
  it("добавила из «Позже по графику» — «Пришёл» сразу; «на смене» (за полчаса) — без него", () => {
    const q = Q(660, [], [P, V, A]);
    expect(queueAdd(q, "a").list[0].here).toBe(true);
    expect(queueAdd(q, "p").list[0].here).toBe(false);
    expect(queueAdd(q, "v", 700).list[0].here).toBe(false);                        // 11:40 — Вере к 12, уже на смене
    expect(queueAdd(q, "v", 680).list[0].here).toBe(true);
  });
});

describe("v218 · экран (ui/call-queue.jsx)", () => {
  it("кнопка «ещё не пришёл», «Пришёл» в правке, «смена с 17:00» в строке", async () => {
    const { QueueChips, QueuePanel } = await import("../ui/call-queue.jsx");
    const q = Q(940, [P, V, A, { ...A, id: "a2", name: "Алла Белова", here: true }]);
    const chips = R(h(QueueChips, { q, picked: "p", auto: true, edit: true, editing: false, onPick() {}, onSkip() {}, onEdit() {}, onAdd() {} }));
    expect(chips).toMatch(/class="ch-chip over" data-call-qperson="a" data-call-qearly="1" aria-label="3\. Анна Смирнова, смена с 17:00, ещё не пришёл"/);
    expect(chips).toMatch(/class="ch-chip" data-call-qperson="a2" aria-label="4\. Алла Белова, смена с 17:00"/);
    const panel = R(h(QueuePanel, { q, onChange() {} }));
    expect(panel).toMatch(/data-queue-row="a"[\s\S]*?data-queue-early="1">смена с 17:00, ещё не пришёл<\/span>[\s\S]*?aria-pressed="false" data-queue-here="a"[^>]*>Пришёл</);
    expect(panel).toMatch(/data-queue-row="a2"[\s\S]*?data-queue-early="here">пришёл раньше смены<\/span>[\s\S]*?aria-pressed="true" data-queue-here="a2"/);
    expect(panel).toMatch(/data-queue-row="v"[\s\S]*?data-queue-pause="v"[^>]*>Перерыв</);
    expect(panel).toContain("Вне смены по графику столы не идут: до смены, пока не нажмёшь «Пришёл», и после, пока не нажмёшь «Остался».");
    const S = rd("ui/call-queue.jsx");
    expect(S).toContain('line && line.meEarly ? "смена " + line.meFrom');
    expect(S).toContain(': line.early && !line.over ? "смена ещё не началась" : "сейчас по графику никого";');
  });
});

describe("v218 · этап 74 и сервер демо", () => {
  const sql = rd("supabase/supabase-stage74-queue-early.sql");
  it("вне смены — и до неё; here в очереди, queue_set, _sa_queue_move, ответе", () => {
    expect(sql).toContain("raise exception 'Сначала этап 73 (supabase-stage73-queue-hours.sql): очередь по часам смены';");
    const o = fnBody(sql, "_sa_queue_over");
    expect(o).toContain("or (not coalesce(e->>'here' = 'true', false) and (z.h->>'from')::int * 60 - 30 > m), false)");
    expect(o).toContain("from (select _sa_queue_hrs(p_rest, e->>'id') as h) z");
    expect(fnBody(sql, "_sa_queue_ord")).toContain("'here', coalesce(cur.e->>'here' = 'true', false)) order by cur.o)");
    expect(fnBody(sql, "_sa_queue_move")).toContain("'stay', coalesce(e->>'stay' = 'true', false), 'here', coalesce(e->>'here' = 'true', false));");
    expect(fnBody(sql, "queue_set")).toContain("'stay', coalesce(x.e->>'stay' = 'true', false), 'here', coalesce(x.e->>'here' = 'true', false)) order by x.o)");
    expect(fnBody(sql, "_sa_queue_json")).toContain("'here', coalesce(x.e->>'here' = 'true', false))");
    expect(rd("tools/claude/sql/test69.sh")).toContain("supabase-stage74-queue-early.sql");
    expect(rd("supabase/README.md")).toContain("supabase-stage74-queue-early.sql");
    expect(rd("tools/claude/README.md")).toContain("e2e-v218.mjs");
  });
  it("сервер демо: «Пришёл» в queue_set и ответе; до смены передать некому", () => {
    const PP = [{ id: "u-host", name: "Ольга", surname: "Ли", restaurant: "R", position: "hostess" },
      { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: "R", position: "waiter" }, { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter" }];
    const s = makeServer({ today: "2026-11-28", clock: () => new Date(2026, 10, 28, 15, 40).getTime(), rest: "R", people: PP, tok: { th: "u-host" },
      sstaff: [{ id: 1, name: "Орлов Пётр", pos: "waiter" }, { id: 2, name: "Смирнова Анна", pos: "waiter" }],
      cfg: { shifts: [{ k: "Д", name: "День", from: 10, to: 18 }, { k: "В", name: "Вечер", from: 17, to: 24 }], staff: [] }, plan: { 1: { 0: "Д" }, 2: { 0: "В" } }, menu: [], cheers: false });
    s.rpc("queue_set", { p_token: "th", p_ord: [{ id: "e-petr" }, { id: "e-anna" }] });
    const call = s.rpc("chat_call", { p_token: "th", p_who: "person", p_emp: "e-petr", p_why: "table", p_table: "5" }).msg;
    expect(s.rpc("chat_pass", { p_token: "th", p_msg: call.id }).error).toBe("nobody");   // Анна с 17, ещё не пришла
    const r = s.rpc("queue_set", { p_token: "th", p_ord: [{ id: "e-anna", here: true }, { id: "e-petr" }] });
    expect(r.list.map((x) => x.id + ":" + x.here)).toEqual(["e-anna:true", "e-petr:false"]);
    const call2 = s.rpc("chat_call", { p_token: "th", p_who: "person", p_emp: "e-petr", p_why: "table", p_table: "6" }).msg;
    expect(s.rpc("chat_pass", { p_token: "th", p_msg: call2.id }).next.call.emp).toBe("e-anna");
  });
});
