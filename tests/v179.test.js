// v179 (Доп. 504): схема зала удобнее и красивее; план зала по фото.
// Владелец (20.11): «Давай улучшим рассадку, сделаем ее более удобной и красивой. Из неудобного, как мне показалось, это
// само составление столов. Может добавим добавление плана зала по фото или что-то вроде этого?»
//   • lib/seating.js — виды столов (TABLE_KINDS), «Ещё такой» (copyTable), «Пронумеровать по порядку» (renumber);
//   • lib/floor-art.js + ui/table-art.jsx — стол сверху: столешница и стулья, у гостей закрашено по числу гостей;
//   • lib/floor-scan.js — ответ ИИ на сетку 8 клеток (обрезка, поворот, масштаб и сдвиг, номера с плана), запрос к функции;
//   • lib/floor-photo.js — фото плана на телефоне (IndexedDB); ui/floor-tools.jsx — палитра, «Шаг назад», фото;
//   • supabase/functions/floor-scan — новая функция: фото → столы (модель с фото через OpenRouter).
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v179.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { GRID_W, MAX_TABLES, TABLE_KINDS, kindOf, addTable, copyTable, renumber, numberedInOrder, canRenumber, nearestSpot, planProblem, boardMap, withZones, addZone, addBar } from "../lib/seating.js";
import { sideCounts, tableGeom, filledChairs, CHAIRS_MAX } from "../lib/floor-art.js";
import { fitBg, box4, tableNo, cleanScan, snap, bestFit, layoutScan, scanFloor, scanErrorText, scanSummary } from "../lib/floor-scan.js";
import { memoryBgBackend, setBgBackend, bgGet, bgPut, bgDrop, bgKey, okBg, okAt } from "../lib/floor-photo.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const P2 = (tables, items = []) => ({ v: 2, zones: [{ id: "z1", name: "Зал" }], items, tables: tables.map((t) => ({ z: "z1", ...t })) });

describe("v179 · версия и журнал", () => {
  it("сборка v179, Дополнение 504, слова владельца, сценарий в браузере, где развернуть функцию", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(179);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 504 — .*\(v179\)/);
    const part = c.slice(c.indexOf("# Дополнение 504")).replace(/\s+/g, " ");
    for (const w of ["Давай улучшим рассадку, сделаем ее более удобной и красивой", "само составление столов",
      "Может добавим добавление плана зала по фото или что-то вроде этого"]) expect(part, w).toContain(w);
    for (const line of c.slice(c.indexOf("# Дополнение 504")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v179.mjs");
    expect(rd("supabase/README.md")).toContain("### v179 — без SQL: схема зала по фото (новая функция `floor-scan`)");
    expect(rd("supabase/AI-SETUP.md")).toContain("## v179: схема зала по фото (функция `floor-scan`)");
  });
});

describe("v179 · виды столов, «Ещё такой», нумерация (lib/seating.js)", () => {
  it("шесть видов: на 2, 4 (квадрат и круг), 6 (круг и длинный), 8 (длинный); по умолчанию — на 4, квадрат", () => {
    // v180 (Доп. 505): за ними — длинные вертикально (6tall, 8tall), только с этапом 54
    expect(TABLE_KINDS.filter((q) => q.shape !== "tall").map((q) => q.k + ":" + q.seats + q.shape)).toEqual(["2sq:2sq", "4sq:4sq", "4rd:4rd", "6rd:6rd", "6long:6long", "8long:8long"]);
    expect(kindOf("").k).toBe("4sq");
    expect(kindOf("8long")).toEqual({ k: "8long", seats: 8, shape: "long" });
    expect(kindOf("zzz").k).toBe("4sq");
  });
  it("стол выбранного вида; без вида — как раньше (4 места, квадрат); длинный у края — на клетку левее", () => {
    const a = addTable(null, 1, 1, "z1", kindOf("6rd"));
    expect(a.tables[0]).toMatchObject({ n: "1", seats: 6, shape: "rd", x: 1, y: 1 });
    expect(addTable(null, 0, 0).tables[0]).toMatchObject({ seats: 4, shape: "sq" });
    const b = addTable(a, 7, 3, "z1", kindOf("8long"));
    expect(b.tables[1]).toMatchObject({ seats: 8, shape: "long", x: 6, y: 3 });
    // слева занято — некуда
    const c = addTable(P2([{ id: "t1", n: "1", seats: 2, shape: "sq", x: 6, y: 0 }]), 7, 0, "z1", kindOf("6long"));
    expect(c.tables.length).toBe(1);
    // чужой вид не ломает: форма неизвестна — квадрат на 4
    expect(addTable(null, 0, 0, "z1", { shape: "hex", seats: 9 }).tables[0]).toMatchObject({ seats: 4, shape: "sq" });
    expect(addTable(null, 0, 0, "z1", { shape: "sq", seats: 50 }).tables[0].seats).toBe(20);
  });
  it("«Ещё такой»: справа, иначе снизу, слева, сверху, иначе ближайшая свободная; номер — следующий", () => {
    let p = P2([{ id: "t1", n: "1", seats: 6, shape: "long", x: 0, y: 0 }]);
    let r = copyTable(p, "t1");
    expect(r.plan.tables[1]).toMatchObject({ seats: 6, shape: "long", x: 2, y: 0, n: "2", z: "z1" });
    expect(r.id).toBe(r.plan.tables[1].id);
    p = P2([{ id: "t1", n: "1", seats: 2, shape: "sq", x: 7, y: 0 }]);
    expect(copyTable(p, "t1").plan.tables[1]).toMatchObject({ x: 7, y: 1 });
    p = P2([{ id: "t1", n: "1", seats: 2, shape: "sq", x: 7, y: 0 }, { id: "t2", n: "2", seats: 2, shape: "sq", x: 7, y: 1 }]);
    expect(copyTable(p, "t1").plan.tables[2]).toMatchObject({ x: 6, y: 0, n: "3" });
    expect(copyTable(p, "nope")).toBe(null);
    const full = P2(Array.from({ length: MAX_TABLES }, (_, i) => ({ id: "t" + i, n: String(i + 1), seats: 2, shape: "sq", x: i % 8, y: Math.floor(i / 8) })));
    expect(copyTable(full, "t0")).toBe(null);
  });
  it("ближайшая свободная клетка: ближе — раньше, при равенстве — в том же ряду", () => {
    const p = P2([{ id: "t1", n: "1", seats: 2, shape: "sq", x: 3, y: 3 }]);
    expect(nearestSpot(p, { id: "x", shape: "sq", z: "z1" }, 3, 3, 2)).toEqual([2, 3]);
    expect(nearestSpot(p, { id: "x", shape: "long", z: "z1" }, 3, 3, 2)).toEqual([4, 3]);   // 2:3 — на стол 3:3
    expect(nearestSpot(P2(Array.from({ length: 8 }, (_, i) => ({ id: "t" + i, n: String(i), seats: 2, shape: "sq", x: i, y: 0 }))), { id: "x", shape: "sq", z: "z1" }, 3, 0, 0)).toBe(null);
  });
  it("«Пронумеровать по порядку»: по залам, в зале по рядам; id прежние (гости и брони остаются на своих столах)", () => {
    const r0 = addZone(P2([{ id: "a", n: "7", seats: 2, shape: "sq", x: 5, y: 2 }, { id: "b", n: "1", seats: 2, shape: "sq", x: 0, y: 4 }]), "Веранда");
    const p = { ...r0.plan, tables: [...r0.plan.tables, { id: "c", n: "В1", seats: 2, shape: "sq", x: 0, y: 0, z: r0.id }, { id: "d", n: "3", seats: 2, shape: "sq", x: 1, y: 2 , z: "z1" }] };
    const q = renumber(p);
    expect(q.tables.map((t) => t.id + "=" + t.n)).toEqual(["a=2", "b=3", "c=4", "d=1"]);
    expect(numberedInOrder(p)).toBe(false);
    expect(numberedInOrder(q)).toBe(true);
    expect(planProblem(q)).toBe("");
    expect(boardMap([{ tid: "a", status: "seat", cnt: 2 }]).a.cnt).toBe(2);
  });
  it("кнопку «Пронумеровать» предлагаем, только если номера — цифры и идут не по порядку («В1» у веранды не трогаем)", () => {
    const num = P2([{ id: "a", n: "2", seats: 2, shape: "sq", x: 0, y: 0 }, { id: "b", n: "1", seats: 2, shape: "sq", x: 1, y: 0 }]);
    expect(canRenumber(num)).toBe(true);
    expect(canRenumber(renumber(num))).toBe(false);
    expect(canRenumber(P2([{ id: "a", n: "В2", seats: 2, shape: "sq", x: 0, y: 0 }, { id: "b", n: "В1", seats: 2, shape: "sq", x: 1, y: 0 }]))).toBe(false);
    expect(canRenumber(P2([{ id: "a", n: "5", seats: 2, shape: "sq", x: 0, y: 0 }]))).toBe(false);
  });
});

describe("v179 · стол сверху (lib/floor-art.js)", () => {
  it("стулья по сторонам: квадрат — по кругу, длинный — вдоль и по торцам с пяти мест", () => {
    expect([1, 2, 3, 4, 6, 8].map((n) => sideCounts("sq", n).join(""))).toEqual(["1000", "1100", "1110", "1111", "2211", "2222"]);
    expect([2, 4, 5, 6, 7, 8, 10].map((n) => sideCounts("long", n).join(""))).toEqual(["1100", "2200", "2210", "2211", "3310", "3311", "4411"]);
    expect(sideCounts("sq", 40).reduce((a, b) => a + b, 0)).toBe(CHAIRS_MAX.sq);
    expect(sideCounts("long", 40).reduce((a, b) => a + b, 0)).toBe(CHAIRS_MAX.long);
  });
  it("геометрия: стульев столько, сколько мест, и все внутри рамки; круглый — по кругу", () => {
    for (const [shape, seats, W, H] of [["sq", 4, 40, 40], ["rd", 6, 40, 40], ["long", 8, 82, 40], ["sq", 2, 30, 30], ["rd", 1, 44, 44]]) {
      const g = tableGeom(shape, seats, W, H);
      expect(g.chairs.length, shape + seats).toBe(seats);
      for (const c of g.chairs) {
        // полуразмеры повёрнутого стула по осям
        const a = (c.rot * Math.PI) / 180, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
        const ex = (c.w / 2) * cs + (c.h / 2) * sn, ey = (c.w / 2) * sn + (c.h / 2) * cs;
        expect(c.cx - ex >= -0.01 && c.cx + ex <= W + 0.01 && c.cy - ey >= -0.01 && c.cy + ey <= H + 0.01, shape + seats + " " + JSON.stringify(c)).toBe(true);
      }
    }
    const rd6 = tableGeom("rd", 6, 40, 40);
    expect(rd6.top.kind).toBe("circle");
    const dist = rd6.chairs.map((c) => Math.hypot(c.cx - 20, c.cy - 20));
    expect(Math.max(...dist) - Math.min(...dist)).toBeLessThan(0.001);
    expect(rd6.chairs[0].cy).toBeLessThan(20);   // первый стул — сверху
    const sq = tableGeom("sq", 4, 40, 40);
    expect(sq.top.kind).toBe("rect");
    expect(sq.top.w).toBeGreaterThan(20);
  });
  it("закрашено: гости, счёт и бронь — по числу гостей (не больше стульев); свободный и уборка — ничего", () => {
    expect([filledChairs("seat", 3, 4), filledChairs("bill", 9, 4), filledChairs("res", 2, 6), filledChairs("free", 3, 4), filledChairs("clean", 4, 4), filledChairs("seat", "x", 4)]).toEqual([3, 4, 2, 0, 0, 0]);
  });
});

// план зала из e2e: фото 800 × 600, рамка зала, 4 квадратных, 3 круглых, 2 длинных, бар справа, вход снизу
const PLAN_TABLES = [
  ...[10, 32, 54, 76].map((x, i) => ({ b: [x, 15, x + 8, 25], shape: "square", seats: 4, n: String(i + 1) })),
  ...[15, 45, 75].map((x, i) => ({ b: [x, 44, x + 8, 54], shape: "round", seats: 2, n: String(i + 5) })),
  ...[10, 55].map((x, i) => ({ b: [x, 75, x + 30, 85], shape: "rect", seats: 8, n: String(i + 8) })),
];
const SCAN = { ok: true, v: 1, plan: true, box: [3, 3, 97, 97], tables: PLAN_TABLES, bars: [[88, 6, 96, 38]], doors: [[50, 96]], note: "" };
const IMG = { w: 800, h: 600 };
const rowsOf = (plan) => {
  const m = {};
  for (const t of plan.tables) (m[t.y] = m[t.y] || []).push(t);
  return Object.keys(m).map(Number).sort((a, b) => a - b).map((y) => m[y].sort((a, b) => a.x - b.x));
};

describe("v179 · ответ ИИ на сетку (lib/floor-scan.js)", () => {
  it("ответ функции чистится: рамки по порядку и в пределах, форма, места 1–20, номер с плана", () => {
    expect(box4([30, 40, 10, 20])).toEqual([10, 20, 30, 40]);
    expect(box4([-5, 0, 120, "50"])).toEqual([0, 0, 100, 50]);
    expect(box4([1, 1, 1, 1])).toBe(null);
    expect(box4(["a", 1, 2, 3])).toBe(null);
    expect([tableNo("№5"), tableNo("Стол 12"), tableNo("В3"), tableNo(7), tableNo("1234567"), tableNo(null)]).toEqual(["5", "12", "В3", "7", "", ""]);
    const s = cleanScan({ plan: true, tables: [{ b: [1, 1, 5, 5], shape: "Круглый", seats: 4, n: "№2" }, { b: [1, 1], shape: "rect" }, { b: [5, 5, 15, 9], shape: "long", seats: 30 }, null],
      bars: [[1, 2, 3, 4], "x"], doors: [[50, 101], [1]], note: "  размыто\n  " });
    expect(s.tables).toEqual([{ b: [1, 1, 5, 5], shape: "round", seats: 4, n: "2" }, { b: [5, 5, 15, 9], shape: "rect", seats: 0, n: "" }]);
    expect(s.bars).toEqual([[1, 2, 3, 4]]);
    expect(s.doors).toEqual([[50, 100]]);
    expect(s.note).toBe("размыто");
    expect(cleanScan({ plan: false, tables: [] }).plan).toBe(false);
    expect(cleanScan(null)).toBe(null);
  });
  it("фото под сеткой: во всю ширину, вытянутое вверх — уже, чтобы влезло в 30 рядов", () => {
    expect(fitBg(800, 600)).toEqual({ wc: 8, x0: 0, rows: 6 });
    const tall = fitBg(100, 500);
    expect(tall.wc).toBeCloseTo(6, 5);
    expect(tall.x0).toBeCloseTo(1, 5);
    expect(tall.rows).toBeCloseTo(30, 5);
  });
  it("стол с плана → клетка: вытянутый — длинный на две клетки, круглый — круглый, высокий узкий — квадратный", () => {
    expect(snap({ shape: "rect", seats: 8 }, [0.7, 4.5, 3.2, 5.1])).toMatchObject({ shape: "long", x: 1, y: 4 });
    expect(snap({ shape: "round", seats: 2 }, [1.1, 2.6, 1.9, 3.4])).toMatchObject({ shape: "rd", x: 1, y: 3 });
    expect(snap({ shape: "rect", seats: 6 }, [2.1, 1.0, 2.9, 3.0])).toMatchObject({ shape: "sq", x: 2, y: 2 });
    expect(snap({ shape: "square", seats: 4 }, [2, 2, 3, 3]).res).toBe(0);
  });
  it("масштаб и сдвиг: столы не налезают друг на друга, если можно — по центрам клеток", () => {
    // два стола в одной клетке при f = 1 — разводятся
    const fit = bestFit([{ t: { shape: "square" }, b: [1.0, 1.0, 1.4, 1.4] }, { t: { shape: "square" }, b: [1.6, 1.0, 2.0, 1.4] }], new Set(), [0, 8]);
    expect(fit.cost).toBeLessThan(1000);
    const one = bestFit([{ t: { shape: "square" }, b: [3.2, 2.2, 3.8, 2.8] }], new Set(), [0, 8]);
    expect(one.cost).toBeLessThan(0.05);
    expect(bestFit([], new Set())).toEqual({ f: 1, ox: 0, oy: 0, cost: 0 });
  });
  it("план из e2e: 9 столов в три ряда по порядку, номера и места с плана, бар и вход; без наложений", () => {
    const r = layoutScan(SCAN, IMG, P2([]), "z1", { mode: "add", items: true });
    expect(r.added).toBe(9);
    expect(r.skipped + r.moved).toBe(0);
    expect(r.rot).toBe(0);
    const rows = rowsOf(r.plan);
    expect(rows.map((q) => q.map((t) => t.n).join(","))).toEqual(["1,2,3,4", "5,6,7", "8,9"]);
    expect(rows.map((q) => q.map((t) => t.shape).join(","))).toEqual(["sq,sq,sq,sq", "rd,rd,rd", "long,long"]);
    expect(rows[2].map((t) => t.seats)).toEqual([8, 8]);
    expect(rows[1].every((t) => t.seats === 2)).toBe(true);
    expect(r.plan.items.map((i) => i.kind).sort()).toEqual(["bar", "door"]);
    expect(planProblem(r.plan)).toBe("");
    expect(r.crop[0]).toBeCloseTo(1.5, 5);
    expect(r.crop[3]).toBeCloseTo(98.5, 5);
    expect(okAt(r.at)).toBe(true);
    expect(r.at[2]).toBeGreaterThan(7);   // план почти во всю ширину: мельче — только чтобы развести столы
    expect(scanSummary(r)).toBe("Расставил 9 столов по фото, бар и вход. Проверь номера и места. Если не так, нажми «Шаг назад».");
  });
  it("«Вместо них» и «Добавить»: прежние столы зала уходят или остаются; номера не повторяются", () => {
    const old = P2([{ id: "t1", n: "1", seats: 4, shape: "sq", x: 3, y: 9 }]);
    const rep = layoutScan(SCAN, IMG, old, "z1", { mode: "replace" });
    expect(rep.added).toBe(9);
    expect(rep.plan.tables.some((t) => t.x === 3 && t.y === 9)).toBe(false);
    const add = layoutScan(SCAN, IMG, old, "z1", { mode: "add" });
    expect(add.plan.tables.length).toBe(10);
    expect(new Set(add.plan.tables.map((t) => t.n)).size).toBe(10);
    expect(add.plan.tables.find((t) => t.x === 3 && t.y === 9).n).toBe("1");
    expect(planProblem(add.plan)).toBe("");
  });
  it("сервер без этапа 37 — без бара и входа; бар в зале уже есть — второй не ставится", () => {
    const r = layoutScan(SCAN, IMG, { v: 1, tables: [] }, "z1", { items: false });
    expect(r.plan.items).toBe(undefined);
    expect(r.bars + r.doors).toBe(0);
    const withBar = addBar(withZones(P2([])), "z1", 0, 20, 2, 20);
    const r2 = layoutScan(SCAN, IMG, withBar, "z1", { items: true });
    expect(r2.plan.items.filter((i) => i.kind === "bar").length).toBe(1);
    expect(r2.doors).toBe(1);
  });
  it("вытянутый в ширину план, 30 столов по 10 в ряд: фото поворачивается, все столы на сетке", () => {
    const T = [];
    [60, 200, 340].forEach((y) => { for (let i = 0; i < 10; i++) { const x = 40 + i * 112; T.push({ b: [x / 12, y / 5, (x + 70) / 12, (y + 90) / 5], shape: "square", seats: 4, n: "" }); } });
    const r = layoutScan({ plan: true, box: [0.8, 2, 99.2, 98], tables: T }, { w: 1200, h: 500 }, null, "z1");
    expect(r.rot).toBe(90);
    expect(r.added).toBe(30);
    expect(r.skipped).toBe(0);
    expect(planProblem(r.plan)).toBe("");
    expect(r.plan.tables.map((t) => t.n).sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => String(i + 1)));
  });
  it("на фото не план; столов нет; мусор — схема не меняется", () => {
    const p = P2([]);
    expect(layoutScan({ plan: false, tables: [] }, IMG, p, "z1")).toMatchObject({ notPlan: true, plan: p, added: 0 });
    expect(layoutScan({ plan: true, tables: [] }, IMG, p, "z1")).toMatchObject({ empty: true, plan: p, added: 0 });
    expect(layoutScan(null, IMG, p, "z1")).toMatchObject({ empty: true, plan: p });
  });
  it("тесно: столы, которым нет места, не ставятся, итог это говорит", () => {
    const T = Array.from({ length: 40 }, (_, i) => ({ b: [(i % 20) * 5, Math.floor(i / 20) * 5, (i % 20) * 5 + 4, Math.floor(i / 20) * 5 + 4], shape: "square", seats: 2, n: "" }));
    const r = layoutScan({ plan: true, tables: T }, { w: 1000, h: 1000 }, null, "z1");
    expect(r.added + r.skipped).toBe(40);
    expect(planProblem(r.plan)).toBe("");
    if (r.skipped) expect(scanSummary(r)).toMatch(/не поместил(ся|ись) на сетке: поставь вручную/);
  });
  it("слова: ошибки по-человечески; итог с числом", () => {
    expect(scanErrorText("daily_limit")).toBe("На сегодня распознаваний больше нет. Завтра можно снова, а пока расставь столы поверх фото вручную.");
    expect(scanErrorText("no_function")).toContain("На сервере ещё нет функции floor-scan.");
    expect(scanErrorText("no_vision")).toContain("anthropic/claude-haiku-5.5");
    expect(scanErrorText("???")).toBe("ИИ не справился с этим фото. Попробуй ещё раз или расставь столы поверх фото вручную.");
    expect(scanSummary({ added: 1, moved: 1, skipped: 2, bars: 0, doors: 2 })).toBe("Расставил 1 стол по фото, входы. 1 стол встал на соседнюю клетку: рядом было занято. 2 не поместились на сетке: поставь вручную. Проверь номера и места. Если не так, нажми «Шаг назад».");
    expect(scanSummary({ added: 22, moved: 0, skipped: 0 })).toMatch(/^Расставил 22 стола по фото\./);
  });
});

describe("v179 · запрос к функции (scanFloor)", () => {
  const json = (data, status = 200) => Promise.resolve({ ok: status < 300, status, json: async () => data });
  it("ответ как есть; 404 без JSON-ошибки — функции нет; сбой сети и долгий ответ — свои ошибки", async () => {
    let seen = null;
    const r = await scanFloor("data:image/jpeg;base64,AAAA", { url: "https://sb.test/", key: "k", token: "tok", fetchImpl: (u, init) => { seen = { u, init }; return json({ ok: true, tables: [] }); } });
    expect(r).toEqual({ ok: true, tables: [] });
    expect(seen.u).toBe("https://sb.test/functions/v1/floor-scan");
    expect(JSON.parse(seen.init.body)).toEqual({ token: "tok", image: "data:image/jpeg;base64,AAAA" });
    expect(seen.init.headers.apikey).toBe("k");
    expect(await scanFloor("x", { url: "u", fetchImpl: () => json({ code: "NOT_FOUND", message: "Requested function was not found" }, 404) })).toEqual({ ok: false, error: "no_function" });
    expect(await scanFloor("x", { url: "u", fetchImpl: () => json({ ok: false, error: "daily_limit" }, 200) })).toEqual({ ok: false, error: "daily_limit" });
    expect(await scanFloor("x", { url: "u", fetchImpl: () => Promise.reject(new TypeError("Failed to fetch")) })).toEqual({ ok: false, error: "network" });
    expect(await scanFloor("x", { url: "u", fetchImpl: () => Promise.resolve({ ok: false, status: 502, json: async () => { throw new Error("html"); } }) })).toEqual({ ok: false, error: "http" });
    const slow = (u, init) => new Promise((res, rej) => { init.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e); }); });
    expect(await scanFloor("x", { url: "u", timeoutMs: 20, fetchImpl: slow })).toEqual({ ok: false, error: "timeout" });
  });
});

describe("v179 · фото плана на телефоне (lib/floor-photo.js)", () => {
  const PIC = "data:image/jpeg;base64,/9j/AAAA";
  beforeEach(() => setBgBackend(memoryBgBackend()));
  it("своё у каждого зала; прозрачность в пределах; место на сетке после распознавания — если правдоподобное", async () => {
    expect(bgKey("Два моря, Океан", "z2")).toBe("Два моря, Океан|z2");
    expect(await bgPut("R", "z1", { data: PIC, w: 800, h: 600, op: 2, at: [0.5, 0.2, 7.5] })).toBe(true);
    expect(await bgGet("R", "z1")).toEqual({ data: PIC, w: 800, h: 600, op: 0.85, at: [0.5, 0.2, 7.5] });
    expect(await bgGet("R", "z2")).toBe(null);
    await bgPut("R", "z2", { data: PIC, w: 10, h: 20, at: [0, 0, 99] });
    expect(await bgGet("R", "z2")).toEqual({ data: PIC, w: 10, h: 20, op: 0.5 });
    expect(await bgDrop("R", "z1")).toBe(true);
    expect(await bgGet("R", "z1")).toBe(null);
  });
  it("мусор не кладётся; не легло в IndexedDB — фото живёт до закрытия приложения", async () => {
    expect(okBg({ data: "http://x/y.jpg", w: 1, h: 1 })).toBe(false);
    expect(okBg({ data: PIC, w: 0, h: 1 })).toBe(false);
    expect(await bgPut("R", "z1", { data: "nope", w: 1, h: 1 })).toBe(false);
    setBgBackend({ get: () => Promise.resolve(null), put: () => Promise.resolve(false), del: () => Promise.resolve(false) });
    expect(await bgPut("R", "z9", { data: PIC, w: 4, h: 3 })).toBe(true);
    expect((await bgGet("R", "z9")).w).toBe(4);
    await bgDrop("R", "z9");
    expect(await bgGet("R", "z9")).toBe(null);
  });
});

describe("v179 · экран: стол со стульями, редактор, фото", () => {
  it("доска: у стола стульев по числу мест, у гостей закрашено по числу гостей; подходящие — подсветка", async () => {
    const { Floor } = await import("../ui/seating.jsx");
    const plan = P2([{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }, { id: "t2", n: "2", seats: 6, shape: "rd", x: 2, y: 0 }, { id: "t3", n: "3", seats: 8, shape: "long", x: 4, y: 0 }]);
    const html = R(h(Floor, { a11y: false, plan, map: boardMap([{ tid: "t2", status: "seat", cnt: 5, since: "2026-11-20T07:00:00Z" }]), now: Date.parse("2026-11-20T07:20:00Z"), hi: ["t3"] }));
    const part = (id) => html.slice(html.indexOf(`data-table="${id}"`), html.indexOf("</button>", html.indexOf(`data-table="${id}"`)));
    expect((part("t1").match(/data-chair="/g) || []).length).toBe(4);
    expect((part("t2").match(/data-chair="on"/g) || []).length).toBe(5);
    expect((part("t2").match(/data-chair="off"/g) || []).length).toBe(1);
    expect(part("t2")).toContain("<circle data-table-top");
    expect((part("t3").match(/data-chair="/g) || []).length).toBe(8);
    expect(part("t3")).toContain("data-table-glow");
    expect(part("t1")).not.toContain("data-table-glow");
    expect(part("t2")).toContain(">5·20м</span>");
  });
  it("редактор: фото под сеткой — сетка не короче фото; после распознавания фото лежит там, где его столы", async () => {
    const { Floor } = await import("../ui/seating.jsx");
    const plan = P2([{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }]);
    const PIC = "data:image/jpeg;base64,/9j/AAAA";
    const a = R(h(Floor, { a11y: true, plan, map: {}, now: 0, edit: true, bg: { data: PIC, w: 400, h: 1000, op: 0.4 } }));
    expect((a.match(/data-cell="/g) || []).length).toBe(GRID_W * 20);   // 8 × 20 клеток: фото 400 × 1000 во всю ширину
    expect(a).toContain("data-floor-bg");
    expect(a).toMatch(/<img src="data:image\/jpeg;base64,\/9j\/AAAA"[^>]*opacity:0.4/);
    const b = R(h(Floor, { a11y: true, plan, map: {}, now: 0, edit: true, bg: { data: PIC, w: 800, h: 600, op: 0.5, at: [0.5, 1, 7] } }));
    expect((b.match(/data-cell="/g) || []).length).toBe(GRID_W * 7);   // 1 + 7 × 600 / 800 = 6,25 → 7 рядов
    expect(b).toMatch(/left:22\.5px;top:45px;width:315px/);
    const c = R(h(Floor, { a11y: true, plan, map: {}, now: 0, bg: { data: PIC, w: 800, h: 600, op: 0.5 } }));
    expect(c).not.toContain("data-floor-bg");   // на доске смены фото нет
  });
  it("палитра, «Шаг назад», карточки фото — подписи и метки", async () => {
    const { KindPalette, EditorActions, StartCard, PhotoCard, RenumberBtn, CopyBtn, kindLabel } = await import("../ui/floor-tools.jsx");
    const c = { gold: "#D2A85A", text: "#EFE4C8", sub: "#A99A7C", line: "rgba(0,0,0,0.2)", red: "#E08A7A", frost: {} };
    const pal = R(h(KindPalette, { c, a11y: false, kind: "6rd", onKind() {} }));
    expect((pal.match(/data-kind="/g) || []).length).toBe(6);
    expect(pal).toContain('aria-checked="true" aria-label="Круглый на 6 мест" data-kind="6rd"');
    expect(TABLE_KINDS.filter((q) => q.shape !== "tall").map(kindLabel)).toEqual(["Квадратный на 2 места", "Квадратный на 4 места", "Круглый на 4 места", "Круглый на 6 мест", "Длинный на 6 мест", "Длинный на 8 мест"]);
    const act = R(h(EditorActions, { c, a11y: false, canUndo: false, onUndo() {}, hasPhoto: true, photoBusy: false, onPhoto() {} }));
    expect(act).toMatch(/data-undo=""[^>]*disabled=""/);
    expect(act).toContain("Шаг назад");
    expect(act).toContain("Другое фото");
    expect(R(h(StartCard, { c, onPhoto() {} }))).toContain("Сфотографировать план");
    const rec = { data: "data:image/jpeg;base64,/9j/AAAA", w: 8, h: 6, op: 0.45 };
    const pc = R(h(PhotoCard, { c, a11y: false, rec, scanBusy: false, ask: false, nTables: 0, onOp() {}, onScan() {}, onAnswer() {}, onRotate() {}, onDrop() {}, onPhoto() {} }));
    expect(pc).toContain(">Расставить столы по фото</button>");
    expect(pc).toContain('value="45"');
    expect(pc).toContain("лежит только на этом телефоне");
    const ask = R(h(PhotoCard, { c, a11y: false, rec, scanBusy: false, ask: true, nTables: 3, onOp() {}, onScan() {}, onAnswer() {}, onRotate() {}, onDrop() {}, onPhoto() {} }));
    expect(ask).toContain("В зале уже 3 стола. Поставить столы с фото вместо них или добавить к ним?");
    const busy = R(h(PhotoCard, { c, a11y: false, rec, scanBusy: true, ask: false, nTables: 0, onOp() {}, onScan() {}, onAnswer() {}, onRotate() {}, onDrop() {}, onPhoto() {} }));
    expect(busy).toContain("Смотрю на план и расставляю столы. Обычно это 10–30 секунд.");
    expect(busy).not.toContain("data-scan=");
    expect(R(h(RenumberBtn, { c, sure: true, onClick() {} }))).toContain("Номера станут 1, 2, 3… по залам и рядам. Нажми ещё раз");
    expect(R(h(CopyBtn, { c, onClick() {} }))).toContain(">Ещё такой</button>");
  });
  it("редактор в коде: шаг назад, переспрос при выходе, фото плана и распознавание", () => {
    const s = rd("ui/seating.jsx");
    expect(s).toContain('<FloorEditor c={c} a11y={a11y} plan0={plan} floor2={st.floor === 2} restaurant={restaurant} photo0={photo0} guard={guard}');
    expect(s).toContain("onClick={() => { if (edit) { if (!guard.current || guard.current()) setEdit(false); } else onBack(); }}>‹</button>");
    expect(s).toContain('<button type="button" onClick={() => { if (tryLeave()) onCancel(); }} data-lens-btn="soft"');
    expect(s).toContain("const out = layoutScan(res, ai, planRef.current, zz, { mode, items: floor2, tall });");   // v180: и вертикальные
    expect(s).toContain("const kd = kindOf(kind, tall), p = addTable(plan, x, y, z, kd);");   // v180: вид с учётом этапа 54
    expect(s).toContain('React.useEffect(() => { live.current = true; return () => { live.current = false; clearTimeout(opTimer.current); }; }, []);');
    expect(s).toContain('<input ref={fileRef} type="file" accept="image/*" data-floor-file=""');
    expect(s).toContain('data-floor-file-board=""');
    // шаг назад — правки одного поля подряд одним шагом
    for (const k of ['"s:" + t.id', '"n:" + t.id', '"zn:" + z']) expect(s).toContain(k);
  });
  it("тексты новых файлов: без тире между словами, без восклицаний и эмодзи, без мелких шрифтов", () => {
    for (const f of ["ui/floor-tools.jsx", "ui/table-art.jsx", "ui/seating.jsx", "lib/floor-scan.js", "lib/floor-photo.js", "lib/floor-art.js", "lib/seating.js"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(src, f).not.toMatch(/fontSize:\s*(8|8\.5|9|9\.5)(?=\s*[,}\s])/);
    }
  });
});

// ── функция floor-scan на стенде (заглушки Deno, базы и OpenRouter) ──
const ENV = { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE_KEY: "svc", OPENROUTER_API_KEY: "or-key", OPENROUTER_MODEL: "anthropic/claude-haiku-5.5" };
globalThis.Deno = { serve() {}, env: { get: (k) => ENV[k] } };
const fn = await import("../supabase/functions/floor-scan/index.ts");
const chat = await import("../supabase/functions/ai-chat/index.ts");
let NET = { who: null, used: 0, bodies: [], replies: [], models: [], usagePosts: [] };
const send = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data, text: async () => (typeof data === "string" ? data : JSON.stringify(data)) });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith("/rest/v1/rpc/whoami")) return send(NET.who ? { ok: true, employee: NET.who } : { ok: false });
  if (u.includes("/rest/v1/ai_usage?id=eq.")) return send([{ count: NET.used }]);
  if (u.endsWith("/rest/v1/ai_usage")) { NET.usagePosts.push(JSON.parse(init.body)); return send(null, 201); }
  if (u === "https://openrouter.ai/api/v1/models") return send({ data: NET.models });
  if (u === "https://openrouter.ai/api/v1/chat/completions") {
    const body = JSON.parse(init.body);
    NET.bodies.push(body);
    const r = NET.replies.length ? NET.replies.shift() : JSON.stringify({ plan: true, tables: [] });
    if (r && typeof r === "object" && r.status) return send(r.text || { error: { message: "down" } }, r.status);
    return send({ model: body.model, choices: [{ message: { content: r } }] });
  }
  return send(null, 404);
};
const IMG64 = "data:image/jpeg;base64," + "A".repeat(400);
const call = async (payload) => { const res = await fn.handle(new Request("https://fn.test/floor-scan", { method: "POST", body: JSON.stringify({ token: "tok", image: IMG64, ...payload }) })); return { status: res.status, ...(await res.json()) }; };
const MANAGER = { id: "e1", name: "Ольга", restaurant: "Два моря, Океан", position: "manager", is_admin: false };

describe("v179 · функция floor-scan", () => {
  beforeEach(() => { NET = { who: MANAGER, used: 0, bodies: [], replies: [], models: [], usagePosts: [] }; ENV.OPENROUTER_MODEL = "anthropic/claude-haiku-5.5"; delete ENV.FLOOR_MODEL; ENV.OPENROUTER_API_KEY = "or-key"; });
  it("модель с фото: картинка в сообщении, размышления лёгкие (Haiku 5.5), ответ чистый", async () => {
    NET.replies.push("```json\n" + JSON.stringify({ plan: true, box: [2, 2, 98, 98], tables: [{ b: [10, 10, 20, 20], shape: "round", seats: "4", n: "№3" }, { b: [1, 2] }], bars: [], doors: [[50, 99]], note: "" }) + "\n```");
    const r = await call({});
    expect(r).toMatchObject({ status: 200, ok: true, v: 1, plan: true, model: "anthropic/claude-haiku-5.5", remaining: 19 });
    expect(r.tables).toEqual([{ b: [10, 10, 20, 20], shape: "round", seats: 4, n: "№3" }]);
    expect(r.doors).toEqual([[50, 99]]);
    const b = NET.bodies[0];
    expect(b.model).toBe("anthropic/claude-haiku-5.5");
    expect(b.max_tokens).toBe(Math.ceil(3000 * 1.35) + 4000);
    expect(b.reasoning).toEqual({ effort: "low", exclude: true });
    expect(b.temperature).toBe(undefined);
    expect(b.messages[0]).toMatchObject({ role: "system" });
    expect(b.messages[1].content[1]).toEqual({ type: "image_url", image_url: { url: IMG64 } });
    expect(NET.usagePosts[0]).toMatchObject({ id: expect.stringMatching(/^e1_\d{4}-\d{2}-\d{2}_f$/), count: 1 });
  });
  it("подсказка: сетка через 10%, рамки в процентах, JSON; FLOOR_MODEL — первой", async () => {
    expect(fn.SCAN_SYSTEM).toContain("линии через каждые 10% ширины и высоты");
    expect(fn.SCAN_SYSTEM).toContain("[лево, верх, право, низ]");
    expect(fn.SCAN_SYSTEM).toContain('"plan": false');
    ENV.FLOOR_MODEL = "google/gemini-x";
    NET.replies.push(JSON.stringify({ plan: true, tables: [] }));
    await call({});
    expect(NET.bodies[0].model).toBe("google/gemini-x");
    expect(NET.bodies[0].temperature).toBe(0.2);
  });
  it("права и лимиты: вход, руководитель, ключ, 20 в день (админу — без счёта), размер фото", async () => {
    expect(await call({ token: "" })).toMatchObject({ status: 400, error: "bad_request" });
    expect(await call({ image: "data:text/plain;base64,AAAA" })).toMatchObject({ status: 400, error: "bad_request" });
    expect(await call({ image: "data:image/jpeg;base64," + "A".repeat(fn.MAX_IMAGE) })).toMatchObject({ status: 413, error: "too_large" });
    NET.who = null;
    expect(await call({})).toMatchObject({ status: 401, error: "auth" });
    NET.who = { ...MANAGER, position: "waiter" };
    expect(await call({})).toMatchObject({ status: 403, error: "forbidden" });
    NET.who = { ...MANAGER, position: "hostess", is_admin: true };
    NET.replies.push(JSON.stringify({ plan: true, tables: [] }));
    expect(await call({})).toMatchObject({ ok: true, remaining: -1 });
    expect(NET.usagePosts.length).toBe(0);
    NET.who = MANAGER; NET.used = 20;
    expect(await call({})).toMatchObject({ ok: false, error: "daily_limit", limit: 20 });
    NET.used = 0; delete ENV.OPENROUTER_API_KEY;
    expect(await call({})).toMatchObject({ ok: false, error: "not_configured" });
  });
  it("модель из секрета фото не принимает — бесплатные модели с фото; ответ не JSON — ошибка parse", async () => {
    ENV.OPENROUTER_MODEL = "deepseek/deepseek-chat";
    NET.models = [{ id: "meta/llama-text:free", architecture: { input_modalities: ["text"] } }, { id: "google/gemma-v:free", architecture: { input_modalities: ["text", "image"] } },
      { id: "google/gemini-flash:free", architecture: { input_modalities: ["image", "text"] } }, { id: "paid/vision", architecture: { input_modalities: ["image"] } }];
    NET.replies.push({ status: 404, text: { error: { message: "No endpoints found that support image input" } } }, JSON.stringify({ plan: true, tables: [{ b: [1, 1, 9, 9], shape: "square" }] }));
    const r = await call({});
    expect(NET.bodies.map((b) => b.model)).toEqual(["deepseek/deepseek-chat", "google/gemini-flash:free"]);
    expect(r).toMatchObject({ ok: true, model: "google/gemini-flash:free" });
    NET.bodies = []; NET.replies.push("не знаю");
    ENV.OPENROUTER_MODEL = "anthropic/claude-haiku-5.5";
    expect(await call({})).toMatchObject({ ok: false, error: "parse" });
  });
  it("разбор ответа модели и правила моделей — те же, что у Наставника", () => {
    expect(fn.extractJson('Вот: {"a":1} готово')).toEqual({ a: 1 });
    expect(fn.extractJson("[1,2]")).toBe(null);
    expect(fn.cleanReply({ tables: [{ b: [5, 5, 1, 1], shape: "oval", seats: 30 }], bars: [[0, 0, 0, 0]], plan: true })).toMatchObject({ tables: [{ b: [1, 1, 5, 5], shape: "round", seats: null }], bars: [] });
    for (const m of ["anthropic/claude-haiku-5.5", "anthropic/claude-sonnet-5.5", "anthropic/claude-haiku-4.5", "deepseek/deepseek-chat:free", "anthropic/claude-opus-4.7"])
      for (const [mt, t] of [[180, 0.8], [3000, 0.2]]) for (const k of ["off", "low", "medium"]) expect(fn.genOpts(m, mt, t, k)).toEqual(chat.genOpts(m, mt, t, k));
    expect(fn.LEAD_POS).toEqual(["manager", "senior", "owner", "head", "admin", "service_manager"]);
  });
});

describe("v179 · ничего не сломано", () => {
  it("старые места рассадки: доска, подбор, карточка стола, сохранение схемы", () => {
    const s = rd("ui/seating.jsx");
    for (const k of ['const TOOLS = [["table", "Столы"], ["wall", "Стены"], ["bar", "Бар"], ["door", "Вход"]];', "const body = floor2 ? withZones(plan) : planV1(plan);",
      'else if (r && r.error === "overlap") setErr("Стол стоит на баре или входе.");', 'data-floor-save="" onClick={save} disabled={busy} data-lens-btn="main"',
      "rememberSeatPlan(restaurant, { ok: true, plan: p });"]) expect(s, k).toContain(k);
    // фото в localStorage не кладём
    expect(rd("lib/floor-photo.js")).not.toMatch(/localStorage\.setItem/);
  });
});
