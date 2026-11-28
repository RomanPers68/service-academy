// v186 (Доп. 511): время за столом полоской и официант цветом.
// Владелец спросил: «Как ещё удобнее и красивее мы можем сделать рассадку?» — из семи предложений ответил «Давай все».
// Первая часть, без SQL:
//   • lib/seating.js — sitProgress (90 минут — вся полоска, с часа жёлтая, с полутора красная), WAITER_COLORS,
//     waiterColorIndex (кто в графике — первыми, потом остальные со столами; цвета не меняются за смену), waiterTids;
//   • ui/table-art.jsx — progress: полоска по краю столешницы с подложкой (у круглого дуга от 12 часов), mark — рамка
//     вокруг стола цветом официанта;
//   • ui/seating.jsx — на доске полоски и рамки (в редакторе нет), диктор слышит «сидят …» и официанта; подсказка под
//     легендой; в «Официантах» кружки цветов, нажать на имя — его столы подсвечены; в карточке стола кружки у имён.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v186.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { sitProgress, SIT_NORM, SIT_WARN, WAITER_COLORS, waiterColorIndex, waiterTids, boardMap } from "../lib/seating.js";
import { tableGeom } from "../lib/floor-art.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const NOW = Date.parse("2026-11-20T07:20:00Z");
const ago = (m) => new Date(NOW - m * 60000).toISOString();
const row = (tid, status, min, waiter = null, cnt = 2) => ({ tid, status, cnt, name: "", rtime: status === "res" ? "20:00" : "", since: ago(min),
  waiter_id: waiter ? waiter[0] : null, waiter_name: waiter ? waiter[1] : "" });
const ANNA = ["e-anna", "Анна Смирнова"], PETR = ["e-petr", "Пётр Орлов"], OLGA = ["e-olga", "Ольга Белова"], IVAN = ["e-ivan", "Иван Зуев"];
const STAFF = [ANNA, PETR, OLGA, IVAN].map(([id, nm]) => ({ id, name: nm.split(" ")[0], surname: nm.split(" ")[1], position: "waiter" }));
const PLAN = { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [
  { id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t2", n: "2", seats: 6, shape: "long", x: 2, y: 0, z: "z1" },
  { id: "t3", n: "3", seats: 4, shape: "rd", x: 5, y: 0, z: "z1" }, { id: "t4", n: "4", seats: 2, shape: "sq", x: 0, y: 3, z: "z1" },
  { id: "t5", n: "5", seats: 4, shape: "sq", x: 2, y: 3, z: "z1" }] };
const ROWS = [row("t1", "seat", 20, ANNA, 3), row("t2", "seat", 70, PETR, 5), row("t3", "bill", 100, ANNA), row("t4", "res", 5)];

describe("v186 · версия и журнал", () => {
  it("сборка v186, Дополнение 511, слова владельца, сценарий", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(186);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 511 — .*\(v186\)/);
    const part = c.slice(c.indexOf("# Дополнение 511")).replace(/\s+/g, " ");
    expect(part).toContain("Как ещё удобнее и красивее мы можем сделать рассадку?");
    expect(part).toContain("Давай все");
    for (const line of c.slice(c.indexOf("# Дополнение 511")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v186.mjs");
  });
});

describe("v186 · время за столом", () => {
  it("полоска только у стола с гостями и со «Счётом»; без времени посадки — нет", () => {
    expect(sitProgress(row("t1", "seat", 30), NOW)).not.toBeNull();
    expect(sitProgress(row("t1", "bill", 30), NOW)).not.toBeNull();
    for (const st of ["free", "res", "clean"]) expect(sitProgress(row("t1", st, 30), NOW), st).toBeNull();
    expect(sitProgress({ ...row("t1", "seat", 30), since: null }, NOW)).toBeNull();
    expect(sitProgress(null, NOW)).toBeNull();
  });
  it("90 минут — вся полоска; с часа жёлтая, с полутора красная; дольше — не больше всей", () => {
    expect([SIT_NORM, SIT_WARN]).toEqual([90, 60]);
    const at = (m) => sitProgress(row("t1", "seat", m), NOW);
    expect(at(0)).toEqual({ p: 0, level: 0, min: 0 });
    expect(at(45).p).toBeCloseTo(0.5, 5);
    expect([at(59).level, at(60).level, at(89).level, at(90).level, at(240).level]).toEqual([0, 1, 1, 2, 2]);
    expect(at(240).p).toBe(1);
    expect(at(240).min).toBe(240);
  });
});

describe("v186 · официант цветом", () => {
  it("по семь цветов в тёмной и светлой теме, без повторов и без цветов состояний стола", () => {
    for (const k of ["dark", "light"]) {
      const p = WAITER_COLORS[k];
      expect(p.length, k).toBe(7);
      expect(new Set(p.map((x) => x.toLowerCase())).size, k).toBe(7);
      for (const x of p) expect(x, k).toMatch(/^#[0-9A-F]{6}$/);
    }
    const src = rd("ui/seating.jsx");
    for (const st of ["#E4C88C", "#EBA595", "#8FBCE0", "#8B6A30", "#A0412F", "#3C6E9F", "#F2B84B", "#FF7A66", "#A86A0C", "#B3362A"]) {
      expect(src).toContain(st);   // цвета состояний и полоски на месте…
      expect([...WAITER_COLORS.dark, ...WAITER_COLORS.light]).not.toContain(st);   // …и официантам не достались
    }
  });
  it("порядок: кто сегодня в графике — по имени; потом остальные со столами — по имени; без столов и не в графике — без цвета", () => {
    const on = { "e-petr": true, "e-ivan": true };
    const rows = [row("t1", "seat", 20, ANNA), row("t2", "seat", 20, OLGA), row("t3", "clean", 5, ANNA)];
    expect(waiterColorIndex(STAFF, on, rows)).toEqual({ "e-ivan": 0, "e-petr": 1, "e-anna": 2, "e-olga": 3 });
    // без графика — только те, у кого столы с гостями; уборка и бронь не в счёт
    expect(waiterColorIndex(STAFF, {}, [row("t1", "clean", 5, ANNA), row("t2", "bill", 50, PETR), row("t3", "seat", 5, OLGA)])).toEqual({ "e-olga": 0, "e-petr": 1 });
    expect(waiterColorIndex([], null, null)).toEqual({});
  });
  it("цвет не меняется, когда у официанта освободились столы, если он в графике", () => {
    const on = { "e-anna": true, "e-petr": true };
    const a = waiterColorIndex(STAFF, on, [row("t1", "seat", 20, ANNA), row("t2", "seat", 20, PETR)]);
    const b = waiterColorIndex(STAFF, on, [row("t2", "seat", 20, PETR)]);
    expect(b["e-petr"]).toBe(a["e-petr"]);
  });
  it("столы официанта — с гостями и со «Счётом»", () => {
    const rows = [row("t1", "seat", 20, ANNA), row("t2", "bill", 20, ANNA), row("t3", "clean", 5, ANNA), row("t4", "seat", 5, PETR)];
    expect(waiterTids(rows, "e-anna")).toEqual(["t1", "t2"]);
    expect(waiterTids(rows, "e-olga")).toEqual([]);
    expect(waiterTids(null, "e-anna")).toEqual([]);
  });
});

describe("v186 · рисунок стола", () => {
  it("прямоугольный: полоска по нижнему краю столешницы, с подложкой; длина — доля от края до края без скруглений", async () => {
    const { TableArt } = await import("../ui/table-art.jsx");
    const g = tableGeom("long", 6, 100, 50);
    const html = R(h(TableArt, { g, W: 100, H: 50, top: "#333", stroke: "#999", chair: { fill: "#000", stroke: "#999" }, chairOn: "#ccc",
      progress: { p: 0.5, level: 1, color: "#F2B84B", casing: "rgba(0,0,0,0.9)" } }));
    const t = g.top, k = Math.min(t.r, Math.min(t.w, t.h) / 2);
    expect(html).toContain('data-sit-bar="1"');
    expect(html).toContain("data-sit-case");
    expect(html.indexOf("data-sit-case")).toBeLessThan(html.indexOf("data-sit-bar"));   // подложка под полоской
    const m = /data-sit-bar="1" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/.exec(html);
    expect(m).not.toBeNull();
    expect(Number(m[2])).toBeCloseTo(t.y + t.h, 3);
    expect(Number(m[3]) - Number(m[1])).toBeCloseTo((t.w - 2 * k) * 0.5, 3);
    expect(html.indexOf("data-table-top")).toBeLessThan(html.indexOf("data-sit-bar"));   // поверх столешницы
  });
  it("вертикальный — по левому краю; круглый — дуга от 12 часов; ноль — ничего", async () => {
    const { TableArt } = await import("../ui/table-art.jsx");
    const base = { top: "#333", stroke: "#999", chair: { fill: "#000", stroke: "#999" }, chairOn: "#ccc" };
    const gt = tableGeom("tall", 6, 50, 100);
    const tall = R(h(TableArt, { g: gt, W: 50, H: 100, ...base, progress: { p: 0.25, level: 0, color: "#fff" } }));
    const m = /data-sit-bar="0" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/.exec(tall);
    expect(Number(m[1])).toBeCloseTo(gt.top.x, 3);
    expect(Number(m[3])).toBeCloseTo(gt.top.x, 3);
    expect(tall).not.toContain("data-sit-case");   // без подложки — без неё
    const gr = tableGeom("rd", 4, 60, 60);
    const rd0 = R(h(TableArt, { g: gr, W: 60, H: 60, ...base, progress: { p: 1, level: 2, color: "#FF7A66" } }));
    const len = (2 * Math.PI * gr.top.r).toFixed(2);
    expect(rd0).toContain(`stroke-dasharray="${len} ${len}"`);
    expect(rd0).toContain(`transform="rotate(-90 ${gr.top.cx.toFixed(2)} ${gr.top.cy.toFixed(2)})"`);
    expect(R(h(TableArt, { g: gr, W: 60, H: 60, ...base, progress: { p: 0, level: 0, color: "#fff" } }))).not.toContain("data-sit-bar");
  });
  it("рамка официанта — вокруг всего стола со стульями, первой (под остальным)", async () => {
    const { TableArt } = await import("../ui/table-art.jsx");
    const base = { top: "#333", stroke: "#999", chair: { fill: "#000", stroke: "#999" }, chairOn: "#ccc" };
    const sq = R(h(TableArt, { g: tableGeom("sq", 4, 40, 40), W: 40, H: 40, ...base, mark: "#4FD1C5", glow: { fill: "none", stroke: "#fff" } }));
    expect(sq).toMatch(/<rect data-waiter-ring="" x="-0.9" y="-0.9" width="41.8" height="41.8" rx="[\d.]+" fill="none" stroke="#4FD1C5"/);
    expect(sq.indexOf("data-waiter-ring")).toBeLessThan(sq.indexOf("data-table-glow"));
    const rd1 = R(h(TableArt, { g: tableGeom("rd", 4, 40, 40), W: 40, H: 40, ...base, mark: "#B39DFF" }));
    expect(rd1).toContain('<circle data-waiter-ring="" cx="20" cy="20" r="20.9" fill="none" stroke="#B39DFF"');
    expect(R(h(TableArt, { g: tableGeom("rd", 4, 40, 40), W: 40, H: 40, ...base }))).not.toContain("data-waiter-ring");
  });
});

describe("v186 · доска смены", () => {
  it("полоски у столов с гостями и со «Счётом», рамки — у столов с официантом; диктор слышит время и официанта", async () => {
    const { Floor } = await import("../ui/seating.jsx");
    const colors = { "e-anna": "#4FD1C5", "e-petr": "#B39DFF" };
    const html = R(h(Floor, { a11y: false, plan: PLAN, map: boardMap(ROWS), now: NOW, wcolor: (id) => colors[id] || null }));
    expect((html.match(/data-sit-bar="/g) || []).length).toBe(3);
    expect(html).toContain('data-sit-bar="0"');
    expect(html).toContain('data-sit-bar="1" ');
    expect(html).toContain('data-sit-bar="2" ');
    expect((html.match(/data-waiter-ring=""/g) || []).length).toBe(3);
    expect((html.match(/stroke="#4FD1C5"/g) || []).length).toBe(2);
    expect(html).toContain('aria-label="Стол 1, 4 места: гости, гостей 3, сидят 20 мин, официант Анна С."');
    expect(html).toContain('aria-label="Стол 2, 6 мест: гости, гостей 5, сидят 1 ч 10 мин, официант Пётр О."');
    expect(html).toContain('aria-label="Стол 4, 2 места: бронь, на 20:00"');
    expect(html).toContain('aria-label="Стол 5, 4 места: свободен"');
  });
  it("без цветов официантов — без рамок; в редакторе ни полосок, ни рамок", async () => {
    const { Floor } = await import("../ui/seating.jsx");
    const plain = R(h(Floor, { a11y: true, plan: PLAN, map: boardMap(ROWS), now: NOW }));
    expect(plain).not.toContain("data-waiter-ring");
    expect(plain).toContain('data-sit-bar="2" ');
    expect(plain).toContain('stroke="#B3362A"');   // светлая тема — свой красный
    const ed = R(h(Floor, { a11y: false, plan: PLAN, map: boardMap(ROWS), now: NOW, edit: true, wcolor: () => "#4FD1C5" }));
    expect(ed).not.toContain("data-sit-bar");
    expect(ed).not.toContain("data-waiter-ring");
  });
  it("экран: цвета по графику, подсветка столов по имени, подбор компании её снимает; кружки в карточке стола", () => {
    const s = code(rd("ui/seating.jsx"));
    expect(s).toContain("const wIdx = React.useMemo(() => waiterColorIndex(st.staff || [], shiftMap, ok ? st.tables : []), [st, shiftMap]);");
    expect(s).toContain('const wPal = WAITER_COLORS[a11y ? "light" : "dark"];');
    expect(s).toContain("const wOn = wsel && !party && team.busy.some((x) => x.id === wsel) ? wsel : null;");
    expect(s).toContain("party ? hi : hiW}");   // v187: перед этим — выбор стола на схеме (pick ? pickHi : …)
    expect(s).toContain("wcolor={wcolor}");
    expect(s).toContain('data-party={n} onClick={() => { vibrate("light"); setWsel(null); setParty(party === n ? 0 : n); }}');
    expect(s).toContain('data-waiter-row={x.id} aria-pressed={on} onClick={() => { vibrate("light"); setParty(0); setWsel(on ? null : x.id); }}');
    expect(s).toContain("Полоска по краю стола: сколько сидят гости, через час она");
    expect(s).toContain("Рамка вокруг стола цветом официанта.");
    expect(s).toContain('"Столы официанта подсвечены. Нажми на имя ещё раз, чтобы снять." : "Нажми на имя: подсветятся столы официанта."');
    expect(s).toContain("onClose={() => setSel(null)} wcolor={wcolor} onCall={");   // v212: и «Позвать к столу» из карточки
    expect(s).toContain("{wcolor && wcolor(e.id) ? <span data-waiter-dot=\"\"");
  });
  it("карточка стола: кружок цвета у официанта, у кого цвет есть", async () => {
    const { TableSheet } = await import("../ui/seating.jsx");
    const map = boardMap(ROWS);
    const s = R(h(TableSheet, { a11y: false, t: PLAN.tables[4], row: { tid: "t5", status: "free", cnt: 0 }, staff: [{ id: "e-anna", name: "Анна", surname: "Смирнова" }, { id: "e-olga", name: "Ольга", surname: "Белова" }],
      now: NOW, onSave: async () => true, onClose: () => {}, wcolor: (id) => (id === "e-anna" ? "#4FD1C5" : null) }));
    expect((s.match(/data-waiter-dot=""/g) || []).length).toBe(1);
    expect(s).toContain("border:2px solid #4FD1C5");
    expect(map.t1.status).toBe("seat");
  });
});

describe("v186 · тексты", () => {
  it("без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["lib/seating.js", "ui/table-art.jsx", "ui/seating.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
