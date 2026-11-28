// v217 (Доп. 543): очередь к столам по часам смены из графика.
// Владелец: «Он же учитывает в очереди людей, которые работают с вечера? Имею ввиду он не будет давать стол человеку
// которого нет в период с 11 до 17? В общем он будет опираться на часы работы официанта, смотря на график?».
//   • lib/call-queue.js — from, to, stay, min; смена кончилась — не следующий (queueNext, queuePos, queueLine);
//     «Все, кто на смене» — только у кого смена началась (queueDue), вечерние — позже (queueLater); «Остался»;
//   • ui/call-queue.jsx — бледная кнопка «до 19:00», «Остался» вместо «Перерыв», «Позже по графику», «По графику уже на
//     смене» под очередью и в строке чата;
//   • этап 73 — часы смены в queue_get, «Остался», _sa_queue_next пропускает закончивших, день заведения с 6 утра.
// В браузере: tools/claude/e2e-v217.mjs; этап на базе — tools/claude/sql/test69.sh (раздел этапа 73).
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { queueOf, queueNow, shiftOver, shiftLater, toLabel, fromLabel, queueOn, queueNext, queuePos, queueLine, queueToday, queueDue, queueLater,
  queueBySchedule, queueAfterCall, queueFlag, queueAdd, queueOrd, DAY_START } from "../lib/call-queue.js";
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
// Глеб — утро 10–18, Вера — день 12–20, Ольга — вечер 16–24, Дина — не в графике
const Q = (min, list, others = []) => queueOf({ ok: true, day: "2026-11-28", edit: true, min, list, others }, AT);
const G = { id: "g", name: "Глеб Орлов", from: 10, to: 18 }, V = { id: "v", name: "Вера Соколова", from: 12, to: 20 },
  O = { id: "o", name: "Ольга Ли", from: 16, to: 24 }, D = { id: "d", name: "Дина Белова", from: null, to: null };

describe("v217 · версия и журнал", () => {
  it("сборка v217, Дополнение 543 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(217);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 543 — .*\(v217\)/);
    const part = c.slice(c.indexOf("# Дополнение 543"));
    for (const w of ["которого нет в период с 11 до 17", "«Остался»", "«Все, кто на смене»", "lib/call-queue.js",
      "supabase-stage73-queue-hours.sql", "test69.sh", "e2e-v217.mjs", "6 утра"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v217 · очередь по часам смены (lib/call-queue.js)", () => {
  it("ответ сервера: часы смены, «Остался», минуты дня заведения; плохие значения — null", () => {
    const q = Q(660, [{ ...G, stay: true }, { id: "x", name: "X", from: "10", to: 99 }], [D, { ...O, to: 0 }]);
    expect(q.list.map((x) => [x.id, x.from, x.to, x.stay])).toEqual([["g", 10, 18, true], ["x", null, null, false]]);
    expect(q.others.map((x) => [x.id, x.from, x.to])).toEqual([["d", null, null], ["o", 16, null]]);
    expect([q.min, q.at]).toEqual([660, AT]);
    expect(queueOf({ ok: true, list: [], min: -5 }).min).toBe(null);
    expect(queueOf({ ok: true, list: [], min: 3000 }).min).toBe(null);
  });
  it("минуты дня заведения: с сервера и сколько прошло; без сервера — по часам телефона, до 6 утра — вчерашний день", () => {
    const q = Q(660, []);
    expect([queueNow(q, AT), queueNow(q, AT + 59e3), queueNow(q, AT + 61e3), queueNow(q, AT + 3600e3), queueNow(q, AT - 60e3)]).toEqual([660, 660, 661, 720, 660]);
    expect(DAY_START).toBe(6);
    expect(queueNow(null, new Date(2026, 10, 28, 14, 30).getTime())).toBe(870);
    expect(queueNow(null, new Date(2026, 10, 29, 1, 15).getTime())).toBe(1515);
    expect(queueNow({ min: null }, new Date(2026, 10, 28, 6, 0).getTime())).toBe(360);
  });
  it("смена кончилась, ещё не началась; подписи часов", () => {
    expect([shiftOver(G, 1079), shiftOver(G, 1080), shiftOver({ ...G, stay: true }, 1200), shiftOver(D, 2000), shiftOver(null, 0)]).toEqual([false, true, false, false, false]);
    expect([shiftLater(O, 959), shiftLater(O, 960), shiftLater(D, 0)]).toEqual([true, false, false]);
    expect([toLabel(G), toLabel({ to: 24 }), toLabel({ to: 26 }), toLabel(D), toLabel(null)]).toEqual(["до 18:00", "до 24:00", "до 2:00", "", ""]);
    expect(fromLabel(O)).toBe("с 16:00");
  });
  it("следующий: у кого смена кончилась — мимо, пока не «Остался»; место и строка — среди тех, кому дают столы", () => {
    const q = Q(18 * 60 + 5, [G, O, V]);
    expect(queueOn(q, 1085).map((x) => x.id)).toEqual(["o", "v"]);
    expect(queueNext(q, [], 1085).id).toBe("o");
    expect(queueNext(q, [], 1079).id).toBe("g");
    expect(queueNext(q, ["o"], 1230)).toBe(null);                          // 20:30: Вера тоже закончила
    expect(queueNext(q).id).toBe("o");                                      // минуты — с сервера
    expect([queuePos(q, "o", 1085), queuePos(q, "g", 1085)]).toEqual([1, 0]);
    const st = queueFlag(q, "g", "stay", true);
    expect(queueNext(st, [], 1085).id).toBe("g");
    expect(queueOrd(st)[0]).toEqual({ id: "g", away: false, out: false, stay: true, here: false });   // v218: here
    expect(queueLine(q, "g", 1085)).toMatchObject({ names: ["Ольга Л.", "Вера С."], pos: 0, n: 2, over: 1, meOver: true });
    expect(queueLine(q, "o", 1085)).toMatchObject({ pos: 1, meOver: false });
    expect(queueLine(Q(1470, [G, V]), "v", 1470)).toMatchObject({ names: [], n: 0, over: 2, meOver: true });
  });
  it("«Все, кто на смене»: только у кого смена началась или начнётся в полчаса; вечерние — позже; закончившие — нет", () => {
    const q = Q(11 * 60, [], [G, V, O, D]);
    expect(queueToday(q).map((x) => x.id)).toEqual(["g", "v", "o"]);
    expect(queueDue(q).map((x) => x.id)).toEqual(["g"]);
    expect(queueDue(q, 11 * 60 + 30).map((x) => x.id)).toEqual(["g", "v"]);   // Вера к 12 — уже пора
    expect(queueLater(q).map((x) => x.id)).toEqual(["v", "o"]);
    const all = queueBySchedule(q);
    expect(all.list.map((x) => x.id)).toEqual(["g"]);
    expect(all.others.map((x) => x.id)).toEqual(["v", "o", "d"]);
    expect(queueBySchedule(q, 16 * 60).list.map((x) => x.id)).toEqual(["g", "v", "o"]);
    expect(queueToday(q, 18 * 60).map((x) => x.id)).toEqual(["v", "o"]);   // у Глеба смена кончилась
    // v218: добавили до смены — «Пришёл» сразу
    expect(queueAdd(q, "o").list[0]).toEqual({ id: "o", name: "Ольга Ли", away: false, out: false, stay: false, here: true, from: 16, to: 24 });
  });
  it("позвали к столу — в конец, часы и «Остался» остаются", () => {
    const q = queueFlag(Q(1085, [G, O, V]), "g", "stay", true);
    const after = queueAfterCall(q, "g");
    expect(after.list.map((x) => x.id)).toEqual(["o", "v", "g"]);
    expect(after.list[2]).toEqual({ id: "g", name: "Глеб Орлов", away: false, out: false, stay: true, here: false, from: 10, to: 18 });
  });
});

describe("v217 · экран (ui/call-queue.jsx)", () => {
  it("кнопки «Кого»: закончивший — бледный «до 18:00», пришедший раньше «с 20:00»; «По графику уже на смене» у хостес", async () => {
    const { QueueChips } = await import("../ui/call-queue.jsx");
    const q = Q(18 * 60 + 5, [G, { id: "a", name: "Анна Смирнова", from: 20, to: 24 }, V], [{ id: "p", name: "Пётр Орлов", from: 18, to: 26 }, D]);
    const html = R(h(QueueChips, { q, picked: "v", auto: true, edit: true, editing: false, onPick() {}, onSkip() {}, onEdit() {}, onAdd() {} }));
    expect(html).toMatch(/class="ch-chip over" data-call-qperson="g" data-call-qover="1" aria-label="1\. Глеб Орлов, смена закончилась"/);
    expect(html).toMatch(/data-call-qperson="g"[^>]*>.*?Глеб О\.<span class="ch-q-pause" aria-hidden="true"> · до 18:00<\/span>/);
    // v218: до смены больше получаса — тоже бледная, «ещё не пришёл»
    expect(html).toMatch(/class="ch-chip over" data-call-qperson="a" data-call-qearly="1" aria-label="2\. Анна Смирнова, смена с 20:00, ещё не пришёл"[^>]*>.*?Анна С\.<span class="ch-q-pause" aria-hidden="true"> · с 20:00<\/span>/);
    expect(html).toMatch(/aria-label="3\. Вера Соколова"[^>]*>.*?Вера С\.<\/button>/);
    expect(html).toMatch(/data-queue-due="call"[\s\S]*По графику уже на смене:[\s\S]*data-queue-due-add="p"[^>]*>\+ Пётр О\.<span class="ch-q-from"> · с 18:00<\/span>/);
    expect(R(h(QueueChips, { q, picked: "v", auto: true, edit: false, editing: false, onPick() {}, onSkip() {}, onEdit() {}, onAdd() {} }))).not.toContain("data-queue-due");
    expect(R(h(QueueChips, { q, picked: "v", auto: true, edit: true, editing: true, onPick() {}, onSkip() {}, onEdit() {}, onAdd() {} }))).not.toContain("data-queue-due");
  });
  it("правка: «Остался» вместо «Перерыв» у закончивших, «смена с …» у пришедших раньше, «Позже по графику»", async () => {
    const { QueuePanel } = await import("../ui/call-queue.jsx");
    const q = Q(18 * 60 + 5, [G, { ...V, stay: true, to: 18 }, { id: "a", name: "Анна Смирнова", from: 20, to: 24 }], [O, { id: "p", name: "Пётр Орлов", from: 20, to: 26 }, { id: "k", name: "Карина Ким", from: 10, to: 17 }, D]);
    const html = R(h(QueuePanel, { q, onChange() {} }));
    expect(html).toMatch(/data-queue-row="g"[\s\S]*?<span class="ch-q-away" data-queue-ended="1">смена до 18:00 закончилась<\/span>[\s\S]*?aria-pressed="false" data-queue-stay="g"[^>]*>Остался</);
    expect(html).toMatch(/data-queue-row="v"[\s\S]*?data-queue-ended="stay">остался после смены<\/span>[\s\S]*?aria-pressed="true" data-queue-stay="v"/);
    // v218: до смены больше получаса — «Пришёл» вместо «Перерыв»
    expect(html).toMatch(/data-queue-row="a"[\s\S]*?data-queue-early="1">смена с 20:00, ещё не пришёл<\/span>[\s\S]*?aria-pressed="false" data-queue-here="a"[^>]*>Пришёл</);
    expect(html).toMatch(/Пришёл ещё кто-то из графика\? Нажми<\/span><\/div><div class="ch-chips sub" data-queue-today=""><button[^>]*data-queue-add="o"/);
    expect(html).toMatch(/Позже по графику: добавь, когда придёт<\/div><div class="ch-chips sub" data-queue-later=""><button[^>]*data-queue-add="p"[^>]*>\+ Пётр О\.<span class="ch-q-from"> · с 20:00<\/span>/);
    expect(html).toMatch(/Не в графике сегодня[\s\S]*data-queue-rest=""[\s\S]*data-queue-add="k"[^>]*>\+ Карина К\.<\/button>[\s\S]*data-queue-add="d"/);   // у Карины смена кончилась
    expect(html).toContain("Вне смены по графику столы не идут: до смены, пока не нажмёшь «Пришёл», и после, пока не нажмёшь «Остался».");
    expect(html).not.toContain("data-queue-all");                                   // на смене один — кнопки «Все» нет
  });
  it("строка в чате: «смена закончилась», «у всех смена закончилась», «По графику уже на смене» в строке", () => {
    const S = rd("ui/call-queue.jsx");
    expect(S).toContain('const mine = line && line.meOver ? "смена закончилась" : line && line.meEarly ? "смена " + line.meFrom : line && line.pos ? (line.away ? "ты на перерыве" : "ты " + line.pos + "-й") : "";');
    expect(S).toContain('line.over && !line.early ? "у всех смена закончилась"');
    expect(S).toContain('{due.length ? <DueChips due={due} busy={busy} onAdd={(x) => save(queueAdd(q, x.id))} mark="strip" /> : null}');
    expect(S).toContain("const due = q.edit && line ? queueDue(q, m) : [];");
    expect(rd("ui/call-sheet.jsx")).toContain("onAdd={(x) => saveQ(queueAdd(q, x.id))} busy={qBusy} />");
    const css = rd("ui/chat.jsx");
    for (const s of [".ch-chip.over{opacity:.5}", ".ch-q-due{display:flex;flex-wrap:wrap;", ".ch-qs .ch-q-due{"]) expect(css, s).toContain(s);
  });
});

describe("v217 · этап 73 и сервер демо", () => {
  const sql = rd("supabase/supabase-stage73-queue-hours.sql");
  it("день заведения с 6 утра, минуты дня, часы смены (после полуночи +24), «Остался», следующий без закончивших", () => {
    expect(sql).toContain("raise exception 'Сначала этап 71 (supabase-stage71-queue-by-schedule.sql): официанты в очереди по графику';");
    expect(fnBody(sql, "_sa_queue_day")).toContain("select ((now() at time zone _sa_tz(p_rest)) - interval '6 hours')::date");
    expect(fnBody(sql, "_sa_queue_now")).toContain("extract(epoch from (now() at time zone _sa_tz(p_rest)) - _sa_queue_day(p_rest)::timestamp) / 60");
    expect(fnBody(sql, "_sa_queue_hrs")).toContain("if t is not null and t <= f then t := t + 24; end if;");
    expect(fnBody(sql, "_sa_queue_over")).toContain("select not coalesce(e->>'stay' = 'true', false) and coalesce((_sa_queue_hrs(p_rest, e->>'id')->>'to')::int * 60 <= m, false)");
    expect(fnBody(sql, "_sa_queue_next")).toContain("and not _sa_queue_over(p_rest, x.e, _sa_queue_now(p_rest))");
    expect(fnBody(sql, "_sa_queue_move")).toContain("e := jsonb_build_object('id', p_emp, 'away', false, 'out', false, 'stay', coalesce(e->>'stay' = 'true', false));");
    expect(fnBody(sql, "_sa_queue_ord")).toContain("'stay', coalesce(cur.e->>'stay' = 'true', false)");
    expect(fnBody(sql, "queue_set")).toContain("'stay', coalesce(x.e->>'stay' = 'true', false)) order by x.o)");
    const j = fnBody(sql, "_sa_queue_json");
    expect(j).toContain("'min', _sa_queue_now(p_rest)");
    expect(j).toContain("|| coalesce(_sa_queue_hrs(p_rest, x.e->>'id'), '{}'::jsonb) order by x.o)");
    expect(j).toContain("and _sa_queue_waiter(p_rest, e.id::text)");                 // этап 71 на месте
    expect(sql).toContain("_sa_queue_ord(text), _sa_queue_move(text, text, boolean), _sa_queue_next(text, text[]), _sa_queue_json(jsonb, text, jsonb) from public, anon, authenticated;");
    expect(rd("tools/claude/sql/test69.sh")).toContain("supabase-stage73-queue-hours.sql");
  });
  it("сервер демо: часы смены и min в queue_get, «Остался» в queue_set, передать дальше — мимо закончивших", () => {
    const P = [{ id: "u-host", name: "Ольга", surname: "Ли", restaurant: "R", position: "hostess" },
      { id: "e-gleb", name: "Глеб", surname: "Орлов", restaurant: "R", position: "waiter" }, { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: "R", position: "waiter" }];
    let clock = new Date(2026, 10, 28, 18, 5).getTime();
    const s = makeServer({ today: "2026-11-28", clock: () => clock, rest: "R", people: P, tok: { th: "u-host", tg: "e-gleb" },
      sstaff: [{ id: 1, name: "Орлов Глеб", pos: "waiter" }, { id: 2, name: "Соколова Вера", pos: "waiter" }],
      cfg: { shifts: [{ k: "У", name: "Утро", from: 10, to: 18 }, { k: "В", name: "Вечер", from: 18, to: 2 }], staff: [] }, plan: { 1: { 0: "У" }, 2: { 0: "В" } }, menu: [], cheers: false });
    const r0 = s.rpc("queue_get", { p_token: "th" });
    expect(r0.min).toBe(18 * 60 + 5);
    expect(r0.others.map((x) => x.id + ":" + x.from + "-" + x.to)).toEqual(["e-gleb:10-18", "e-vera:18-26"]);
    const r1 = s.rpc("queue_set", { p_token: "th", p_ord: [{ id: "e-gleb", stay: true }, { id: "e-vera" }] });
    expect(r1.list.map((x) => x.id + ":" + x.stay)).toEqual(["e-gleb:true", "e-vera:false"]);
    s.rpc("queue_set", { p_token: "th", p_ord: [{ id: "e-gleb" }, { id: "e-vera" }] });
    const call = s.rpc("chat_call", { p_token: "th", p_who: "person", p_emp: "e-vera", p_why: "table", p_table: "5" });
    const pass = s.rpc("chat_pass", { p_token: "th", p_msg: (call.msg || call).id });
    expect(pass.ok ? "есть" : pass.error).toBe("nobody");                       // Глебу передать нельзя: смена кончилась
    clock = new Date(2026, 10, 29, 1, 30).getTime();
    expect(s.rpc("queue_get", { p_token: "th" }).min).toBe(25 * 60 + 30);
  });
});
