// v189 (Доп. 514): «Позвать» → «К столу» — стол выбирают на схеме зала, а не вписывают номер.
// Владелец: «Слушай, а может мы в функции «позвать официанта», добавим возможность выбора стола, к которому нужно
// подойти?»; посмотрел пример — «давай схему сделаем».
//   • ui/call-table.jsx — CallTables: схема из «Рассадки» (Floor) с залами вкладками, выбранный стол — золотом, под схемой
//     что за ним и кто официант; «Позвать только Анну С.» — вызов официанту этого стола лично; «Вписать номер»;
//     pickedLine, ownWaiter;
//   • ui/chat.jsx — CallSheet грузит seat_board (lib/chat-api.js, board) и при «К столу» показывает схему; схемы нет —
//     поле номера, как раньше. Сервер не меняется: номер стола уходит в chat_call, как и раньше.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v189.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { pickedLine, ownWaiter, CallTables } from "../ui/call-table.jsx";
import { chatApi } from "../lib/chat-api.js";
import { boardMap } from "../lib/seating.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/\u00a0/g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const NOW = Date.parse("2026-11-21T01:00:00Z");
const ago = (m) => new Date(NOW - m * 60000).toISOString();
const row = (tid, status, cnt, extra = {}) => ({ tid, status, cnt, name: "", rtime: "", since: status === "seat" || status === "bill" ? ago(25) : null, waiter_id: null, waiter_name: "", ...extra });
const PLAN = { v: 2, zones: [{ id: "z1", name: "Основной зал" }, { id: "z2", name: "Веранда" }], items: [], tables: [
  { id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t5", n: "5", seats: 4, shape: "rd", x: 2, y: 0, z: "z1" },
  { id: "t21", n: "21", seats: 6, shape: "long", x: 0, y: 0, z: "z2" }] };
const ROWS = [row("t5", "seat", 3, { waiter_id: "e-anna", waiter_name: "Анна Смирнова" }), row("t21", "res", 6, { rtime: "20:00", name: "Ильины" })];
const BOARD = { ok: true, now: new Date(NOW).toISOString(), plan: PLAN, tables: ROWS };

describe("v189 · версия и журнал", () => {
  it("сборка v189, Дополнение 514, слова владельца, сценарий", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(189);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 514 — .*\(v189\)/);
    const part = c.slice(c.indexOf("# Дополнение 514")).replace(/\s+/g, " ");
    expect(part).toContain("Слушай, а может мы в функции «позвать официанта», добавим возможность выбора стола, к которому нужно подойти?");
    expect(part).toContain("Не, давай схему сделаем");
    for (const line of c.slice(c.indexOf("# Дополнение 514")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v189.mjs");
  });
});

describe("v189 · что за столом и кто его официант", () => {
  const map = boardMap(ROWS);
  it("строка под схемой: места, что за столом, сколько сидят, официант (имя с инициалом не рвётся)", () => {
    expect(pickedLine(PLAN.tables[1], map.t5, NOW)).toBe("Стол 5 · 4 места · гости, 3 гостя, 25 мин · официант Анна\u00a0С.");
    expect(pickedLine(PLAN.tables[2], map.t21, NOW)).toBe("Стол 21 · 6 мест · бронь на 20:00");
    expect(pickedLine(PLAN.tables[0], undefined, NOW)).toBe("Стол 1 · 4 места · свободен");
    expect(pickedLine(PLAN.tables[0], row("t1", "clean", 0), NOW)).toBe("Стол 1 · 4 места · уборка");
    expect(pickedLine(PLAN.tables[0], row("t1", "bill", 2), NOW)).toBe("Стол 1 · 4 места · счёт, 2 гостя, 25 мин");
    expect(pickedLine(null, null, NOW)).toBe("");
  });
  it("«Позвать только …» — когда у стола с гостями есть свой официант; имя в винительном", () => {
    expect(ownWaiter(map.t5)).toEqual({ id: "e-anna", name: "Анна Смирнова", label: "Позвать только Анну С." });
    expect(ownWaiter(row("t1", "bill", 2, { waiter_id: 7, waiter_name: "Пётр Орлов" }))).toEqual({ id: "7", name: "Пётр Орлов", label: "Позвать только Петра О." });
    expect(ownWaiter(row("t1", "seat", 2, { waiter_id: "e-1", waiter_name: "Илья" })).label).toBe("Позвать только Илью");
    expect(ownWaiter(map.t21)).toBeNull();   // бронь
    expect(ownWaiter(row("t1", "seat", 2))).toBeNull();   // без официанта
    expect(ownWaiter(undefined)).toBeNull();
  });
});

describe("v189 · схема в «Позвать»", () => {
  const base = { a11y: false, board: BOARD, onPick: () => {}, onWaiter: () => {}, onManual: () => {} };
  it("«Какой стол», залы вкладками, схема; пока не выбран — подсказка; «Вписать номер»", () => {
    const html = R(h(CallTables, { ...base, tid: null, who: "waiter" }));
    expect(html).toContain(">Какой стол</div>");
    expect((html.match(/data-call-zone="/g) || []).length).toBe(2);
    expect(html).toMatch(/data-call-zone="z1"[^>]*>Основной зал<\/button>/);
    expect(html).toContain("data-call-floor");
    expect(html).toContain('data-table="t1"');
    expect(html).not.toContain('data-table="t21"');   // веранда — на своей вкладке
    expect(html).toContain('role="status" aria-live="polite"');
    expect(html).toContain(">Нажми на стол на схеме.</span>");
    expect(html).toMatch(/data-call-manual=""[^>]*>Стола нет на схеме\? Вписать номер<\/button>/);
  });
  it("выбран стол 5: подсвечен, строка что за ним, «Позвать только Анну С.» — только когда зовут официанта", () => {
    const w = R(h(CallTables, { ...base, tid: "t5", who: "waiter" }));
    expect(w).toMatch(/data-table="t5"[^>]*data-hi="1"|data-hi="1"[^>]*data-table="t5"/);
    expect(w).toContain("Стол 5 · 4 места · гости, 3 гостя, 25 мин · официант Анна С.");
    expect(w).toMatch(/data-call-own="e-anna"[^>]*>Позвать только Анну С\.<\/button>/);
    expect(w).toContain("Вызов уйдёт только официанту этого стола.");
    expect(R(h(CallTables, { ...base, tid: "t5", who: "lead" }))).not.toContain("data-call-own");
    expect(R(h(CallTables, { ...base, tid: "t21", who: "waiter" }))).toMatch(/aria-selected="true"[^>]*data-call-zone="z2"/);   // стол на веранде — вкладка веранды
  });
  it("выбранный стол на веранде — схема открывается на веранде", () => {
    const v = R(h(CallTables, { ...base, tid: "t21", who: "waiter" }));
    expect(v).toContain('data-table="t21"');
    expect(v).not.toContain('data-table="t1"');
    expect(v).toContain("Стол 21 · 6 мест · бронь на 20:00");
    expect(v).not.toContain("data-call-own");
  });
  it("один зал — без вкладок", () => {
    const one = { ...BOARD, plan: { ...PLAN, zones: [PLAN.zones[0]], tables: PLAN.tables.slice(0, 2) } };
    expect(R(h(CallTables, { ...base, board: one, tid: null, who: "waiter" }))).not.toContain("data-call-zone");
  });
});

describe("v189 · лист «Позвать» в чате", () => {
  it("сервер: доска из «Рассадки» — seat_board; вызов — chat_call, как раньше", async () => {
    const calls = [];
    const api = chatApi((fn, args) => { calls.push([fn, args]); return Promise.resolve({ ok: true }); });
    await api.board();
    await api.call({ who: "person", emp: "e-anna", why: "table", table: "5", text: "" });
    expect(calls).toEqual([["seat_board", {}], ["chat_call", { p_who: "person", p_emp: "e-anna", p_why: "table", p_table: "5", p_text: null }]]);
  });
  it("«К столу»: есть схема — она, нет — поле номера; «Позвать только…» не раскрывает список людей", () => {
    const s = rd("ui/chat.jsx");   // без code(): в файле есть accept="image/*", а это похоже на начало комментария
    expect(s).toContain('const CallTables = React.lazy(() => import("./call-table").then((m) => ({ default: m.CallTables })));');
    expect(s).toContain("if (api && api.board) Promise.resolve(api.board()).then((r) => { if (on && r && r.ok && r.plan && Array.isArray(r.plan.tables) && r.plan.tables.length) setBoard(r); }).catch(() => {});");
    expect(s).toContain('{why === "table" && board && !manual ? <div ref={pickRef}');
    expect(s).toContain('{why === "table" && !(board && !manual) ? <input className="ch-field num sa-field"');
    expect(s).toContain("onPick={(t) => { setTid(t.id); setTable(String(t.n)); setErr(\"\"); }}");
    expect(s).toContain('onWaiter={(p) => { setWho("person"); setPerson({ id: p.id, name: p.name }); setViaTable(true); setErr(""); }}');
    expect(s).toContain('onManual={() => { setManual(true); setTid(null); setTable(""); }}');
    expect(s).toContain('{who === "person" && !viaTable ? <div');
    expect((s.match(/<CallSheet a11y=\{a11y\} me=\{me\}/g) || []).length).toBe(2);   // из списка чатов и из переписки
  });
});

describe("v189 · тексты", () => {
  it("без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["ui/call-table.jsx", "ui/chat.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
    }
    expect(code(rd("ui/call-table.jsx"))).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
