// v183 (Доп. 508): стулья по сторонам стола и диван.
// Владелец (20.11): «А мы можем добавить возможность передвигать стулья за столом? Имею ввиду добавить возможность
// выбирать с какой стороны будет стул?»
//   • lib/floor-art.js — SIDE_MAX, okSides, seatsOfSides; tableGeom рисует стулья по сторонам и диван (подушки, спинка);
//   • lib/seating.js — sidesOf, sideStep, toggleSofa, resetSides, sidesForSeats; места — всего по сторонам; «Повернуть»
//     поворачивает стороны, другая форма — стулья снова по местам;
//   • ui/floor-tools.jsx — ChairSides «Стулья по сторонам»; ui/table-art.jsx — диван; ui/seating.jsx — блок в карточке
//     стола (сервер с этапом 55), признак sides: true при сохранении, доска рисует свои стороны;
//   • supabase/supabase-stage55-chair-sides.sql — floor_save хранит sides, seat_board — sides: true.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v183.mjs, на сервере: tools/claude/sql/test55.sh.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { SIDE_MAX, okSides, seatsOfSides, tableGeom } from "../lib/floor-art.js";
import { sidesOf, sideStep, toggleSofa, resetSides, sidesForSeats, updateTable, rotateTable, copyTable, boardMap } from "../lib/seating.js";
import { STAGES } from "../lib/server-check.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const PLAN = (tables) => ({ v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: tables.map((t) => ({ z: "z1", ...t })) });
const T = (p, id) => p.tables.find((q) => q.id === id);

describe("v183 · версия и журнал", () => {
  it("сборка v183, Дополнение 508, слова владельца, сценарии, этап 55", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(183);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 508 — .*\(v183\)/);
    const part = c.slice(c.indexOf("# Дополнение 508")).replace(/\s+/g, " ");
    expect(part).toContain("А мы можем добавить возможность передвигать стулья за столом? Имею ввиду добавить возможность выбирать с какой стороны будет стул?");
    for (const line of c.slice(c.indexOf("# Дополнение 508")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v183.mjs");
    expect(rd("tools/claude/README.md")).toContain("bash sql/test55.sh");
    expect(rd("supabase/README.md")).toContain("### Этап 55 (v183) — стулья по сторонам стола и диваны");
    expect(STAGES.find((q) => q.n === "55")).toEqual({ n: "55", file: "supabase-stage55-chair-sides.sql", what: "Стулья по сторонам стола и диваны на схеме зала", fn: "_sa_floor_sides" });
  });
});

describe("v183 · стулья по сторонам: что годится", () => {
  it("пределы на сторону: квадрат — 3, длинный — 8 вдоль и 2 у торцов, вертикальный — наоборот; у круглого сторон нет", () => {
    expect(SIDE_MAX).toEqual({ sq: [3, 3, 3, 3], long: [8, 8, 2, 2], tall: [2, 2, 8, 8] });
    expect(okSides("sq", [1, 0, 1, -1])).toEqual([1, 0, 1, -1]);
    expect(okSides("sq", [4, 0, 0, 0])).toBe(null);
    expect(okSides("long", [8, -8, 2, -2])).toEqual([8, -8, 2, -2]);
    expect(okSides("long", [0, 0, 3, 0])).toBe(null);
    expect(okSides("tall", [2, 2, 8, -8])).toEqual([2, 2, 8, -8]);
    expect(okSides("tall", [3, 0, 0, 0])).toBe(null);
    expect(okSides("rd", [1, 1, 1, 1])).toBe(null);
    expect(okSides("sq", [0, 0, 0, 0])).toBe(null);                    // хоть одно место
    expect(okSides("long", [8, -8, 2, 2])).toEqual([8, -8, 2, 2]);     // 20 мест — больше у длинного и не встанет
    expect(okSides("sq", [1.5, 0, 0, 0])).toBe(null);
    expect(okSides("sq", ["1", 0, 0, 0])).toBe(null);
    expect(okSides("sq", [1, 1, 1])).toBe(null);
    expect(okSides("sq", null)).toBe(null);
    expect(seatsOfSides([2, -3, 0, 1])).toBe(6);
  });
  it("рисунок: стулья по своим сторонам, диван — подушки по местам (после стульев) и спинка снаружи; всё в рамке", () => {
    const W = 80, H = 40, g = tableGeom("long", 4, W, H, [2, -2, 0, 0]), t = g.top;
    const chairs = g.chairs.filter((c) => !c.sofa), cushions = g.chairs.filter((c) => c.sofa);
    expect([chairs.length, cushions.length, g.backs.length]).toEqual([2, 2, 1]);
    expect(g.chairs.slice(0, 2).every((c) => !c.sofa)).toBe(true);    // гости садятся сначала на стулья
    expect(chairs.every((c) => c.cy < t.y)).toBe(true);                // стулья сверху
    expect(cushions.every((c) => c.cy > t.y + t.h)).toBe(true);        // диван снизу
    const b = g.backs[0];
    expect(b.y).toBeGreaterThan(Math.max(...cushions.map((c) => c.cy)));   // спинка — снаружи подушек
    expect(b.w).toBeGreaterThan(t.w);                                    // во всю длину стола
    for (const c of g.chairs) expect(c.cy + c.h / 2 <= H + 0.6 && c.cy - c.h / 2 >= -0.6).toBe(true);
    expect(b.y + b.h).toBeLessThanOrEqual(H + 0.6);
    // слева стул, справа диван — у квадратного
    const q = tableGeom("sq", 2, 40, 40, [0, 0, 1, -1]);
    expect(q.chairs.find((c) => !c.sofa).cx).toBeLessThan(q.top.x);
    expect(q.chairs.find((c) => c.sofa).cx).toBeGreaterThan(q.top.x + q.top.w);
    expect(q.backs[0].x).toBeGreaterThan(q.top.x + q.top.w);
    // без своих сторон — как раньше, по местам; у круглого стороны не действуют
    expect(tableGeom("long", 4, W, H).chairs.map((c) => Math.sign(c.cy - 20))).toEqual(tableGeom("long", 4, W, H, null).chairs.map((c) => Math.sign(c.cy - 20)));
    expect(tableGeom("long", 4, W, H).backs).toEqual([]);
    expect(tableGeom("rd", 4, 40, 40, [1, 1, 1, 1]).chairs.length).toBe(4);
  });
});

describe("v183 · стулья по сторонам: правка стола", () => {
  const P0 = PLAN([{ id: "t1", n: "1", seats: 4, shape: "long", x: 0, y: 0 }, { id: "t2", n: "6", seats: 2, shape: "sq", x: 3, y: 0 }, { id: "t3", n: "15", seats: 5, shape: "rd", x: 5, y: 0 }]);
  it("что стоит сейчас: свои стороны или как по местам (в пределах стороны); у круглого — null", () => {
    expect(sidesOf(T(P0, "t1"))).toEqual([2, 2, 0, 0]);
    expect(sidesOf(T(P0, "t2"))).toEqual([1, 1, 0, 0]);
    expect(sidesOf(T(P0, "t3"))).toBe(null);
    expect(sidesOf({ shape: "long", seats: 20 })).toEqual([8, 8, 1, 1]);   // по местам вышло бы 9 вдоль — в пределах 8
    expect(sidesOf({ shape: "sq", seats: 2, sides: [0, 0, 2, 0] })).toEqual([0, 0, 2, 0]);
  });
  it("плюс и минус у стороны: стулья от 0 до предела, у дивана — места от 1; последнее место не убирается; места — всего", () => {
    let p = sideStep(P0, "t2", 1, -1);
    expect([T(p, "t2").sides, T(p, "t2").seats]).toEqual([[1, 0, 0, 0], 1]);
    expect(sideStep(p, "t2", 0, -1)).toBe(p);                          // последнее место за столом
    expect(sideStep(p, "t2", 1, -1)).toBe(p);                          // меньше нуля нельзя
    p = sideStep(sideStep(sideStep(p, "t2", 2, 1), "t2", 2, 1), "t2", 2, 1);
    expect([T(p, "t2").sides, T(p, "t2").seats]).toEqual([[1, 0, 3, 0], 4]);
    expect(sideStep(p, "t2", 2, 1)).toBe(p);                           // больше трёх с одной стороны квадрата — нет
    expect(sideStep(P0, "t3", 0, 1)).toBe(P0);                         // круглый
    const s = toggleSofa(P0, "t1", 1);
    expect(sideStep(sideStep(s, "t1", 1, -1), "t1", 1, -1)).toEqual(sideStep(s, "t1", 1, -1));   // диван — хотя бы на одного
  });
  it("диван: вместо стульев — на столько же; на пустой стороне — как стульев напротив, нет и там — на двоих; снова — стулья", () => {
    let p = toggleSofa(P0, "t1", 1);
    expect([T(p, "t1").sides, T(p, "t1").seats]).toEqual([[2, -2, 0, 0], 4]);
    p = toggleSofa(p, "t1", 1);
    expect([T(p, "t1").sides, T(p, "t1").seats]).toEqual([[2, 2, 0, 0], 4]);
    // квадратный 6 как у владельца: стул слева, справа диван — на двоих место всего
    const q = toggleSofa(sideStep(sideStep(sideStep(P0, "t2", 0, -1), "t2", 2, 1), "t2", 1, -1), "t2", 3);
    expect([T(q, "t2").sides, T(q, "t2").seats]).toEqual([[0, 0, 1, -1], 2]);
    // 5: стульев нет — только диван справа, на двоих
    let five = PLAN([{ id: "t5", n: "5", seats: 1, shape: "sq", x: 0, y: 0, sides: [1, 0, 0, 0] }]);
    five = sideStep(toggleSofa(five, "t5", 3), "t5", 0, -1);
    expect([T(five, "t5").sides, T(five, "t5").seats]).toEqual([[0, 0, 0, -2], 2]);
  });
  it("«Мест ±» со своими сторонами: плюс — на диван, иначе стул туда, где меньше; минус — с дивана, иначе стул оттуда, где больше", () => {
    expect(sidesForSeats("long", [2, -2, 0, 0], 5)).toEqual([2, -3, 0, 0]);
    expect(sidesForSeats("long", [2, -3, 0, 0], 3)).toEqual([2, -1, 0, 0]);
    expect(sidesForSeats("long", [2, -1, 0, 0], 2)).toEqual([1, -1, 0, 0]);
    expect(sidesForSeats("long", [3, 1, 0, 0], 6)).toEqual([3, 3, 0, 0]);
    expect(sidesForSeats("long", [8, 8, 2, 1], 20)).toEqual([8, 8, 2, 2]);
    expect(sidesForSeats("long", [8, 8, 2, 2], 21)).toBe(null);
    expect(sidesForSeats("tall", [0, 0, 1, 1], 3)).toEqual([0, 0, 2, 1]);   // у вертикального сначала вдоль
    let p = updateTable(toggleSofa(P0, "t1", 1), "t1", { seats: 5 });
    expect([T(p, "t1").sides, T(p, "t1").seats]).toEqual([[2, -3, 0, 0], 5]);
    p = updateTable(p, "t1", { seats: 1 });
    expect([T(p, "t1").sides, T(p, "t1").seats]).toEqual([[0, -1, 0, 0], 1]);
    // другая форма — стулья снова по местам
    const r = updateTable(toggleSofa(P0, "t2", 1), "t2", { shape: "rd" });
    expect(T(r, "t2")).toEqual({ id: "t2", n: "6", seats: 2, shape: "rd", x: 3, y: 0, z: "z1" });
  });
  it("«Повернуть»: в вертикальный — по часовой (диван снизу уходит влево), назад — как было; «Ещё такой» — с теми же сторонами", () => {
    const p = toggleSofa(P0, "t1", 1);
    const v = rotateTable(p, "t1");
    expect([T(v, "t1").shape, T(v, "t1").sides]).toEqual(["tall", [0, 0, -2, 2]]);
    expect(T(rotateTable(v, "t1"), "t1").sides).toEqual([2, -2, 0, 0]);
    const cp = copyTable(p, "t1");
    expect(T(cp.plan, cp.id).sides).toEqual([2, -2, 0, 0]);
    expect(T(rotateTable(P0, "t1"), "t1")).not.toHaveProperty("sides");
  });
  it("«Как было» — своих сторон нет, места те же", () => {
    const p = resetSides(toggleSofa(P0, "t1", 1), "t1");
    expect(T(p, "t1")).toEqual({ id: "t1", n: "1", seats: 4, shape: "long", x: 0, y: 0, z: "z1" });
    expect(resetSides(P0, "t1").tables[0]).toBe(P0.tables[0]);
  });
});

describe("v183 · экран", () => {
  it("«Стулья по сторонам»: по часовой — сверху, справа, снизу, слева; диван нажат; минус выключен там, где нельзя; «Как было» — у своих", async () => {
    const { ChairSides } = await import("../ui/floor-tools.jsx");
    const c = { gold: "#c8a96e", sub: "#999", text: "#eee", line: "#555" };
    const t = { id: "t1", n: "1", seats: 4, shape: "long", sides: [2, -2, 0, 0] };
    const html = R(h(ChairSides, { c, a11y: false, t, sides: t.sides, own: true, onStep() {}, onSofa() {}, onReset() {} }));
    expect(html).toContain('role="group" aria-label="Стулья по сторонам"');
    expect([...html.matchAll(/data-side="(\d)"/g)].map((m) => m[1])).toEqual(["0", "3", "1", "2"]);
    expect([...html.matchAll(/<span data-side-n="" [^>]*>(\d+)<\/span>/g)].map((m) => m[1])).toEqual(["2", "0", "2", "0"]);
    expect(html).toMatch(/aria-pressed="true" aria-label="Снизу: диван"/);
    expect(html).toMatch(/aria-label="Справа: меньше" disabled=""/);
    expect(html).toContain("data-sides-reset");
    expect(html).toContain("Цифра: сколько стульев с этой стороны. «Диван» ставит диван вместо стульев, тогда плюс и минус меняют, на сколько он человек.");
    expect((html.match(/data-sofa=""/g) || []).length).toBe(2);   // рисунок стола в блоке
    const auto = R(h(ChairSides, { c, a11y: false, t: { ...t, sides: undefined }, sides: [2, 2, 0, 0], own: false, onStep() {}, onSofa() {}, onReset() {} }));
    expect(auto).not.toContain("data-sides-reset");
    // одно место за столом — его минус выключен
    const one = R(h(ChairSides, { c, a11y: false, t: { ...t, seats: 1 }, sides: [1, 0, 0, 0], own: true, onStep() {}, onSofa() {}, onReset() {} }));
    expect(one).toMatch(/aria-label="Сверху: меньше" disabled=""/);
  });
  it("доска рисует свои стороны: диван — подушки и спинка; гости — сначала на стулья", async () => {
    const { Floor } = await import("../ui/seating.jsx");
    const plan = PLAN([{ id: "t1", n: "1", seats: 4, shape: "long", x: 0, y: 0, sides: [2, -2, 0, 0] }, { id: "t2", n: "6", seats: 2, shape: "sq", x: 3, y: 0, sides: [0, 0, 1, -1] }]);
    const html = R(h(Floor, { a11y: false, plan, map: boardMap([{ tid: "t1", status: "seat", cnt: 3, since: null }]), now: 0 }));
    const part = (id) => html.slice(html.indexOf(`data-table="${id}"`), html.indexOf("</button>", html.indexOf(`data-table="${id}"`)));
    expect((part("t1").match(/data-sofa=""/g) || []).length).toBe(2);
    expect((part("t1").match(/data-sofa-back=""/g) || []).length).toBe(1);
    expect((part("t1").match(/data-chair="on"/g) || []).length).toBe(3);
    expect(part("t1")).toMatch(/data-chair="on" data-sofa=""/);   // третий гость — на диване
    expect((part("t2").match(/data-chair=/g) || []).length).toBe(2);
  });
  it("редактор: блок — у не круглого стола и только с этапом 55; сохранение с признаком sides: true; шаги — в «Шаг назад»", () => {
    const s = rd("ui/seating.jsx");
    expect(s).toContain('{sidesOn && t.shape !== "rd" ? <ChairSides c={c} a11y={a11y} t={t} sides={sidesOf(t)} own={!!okSides(t.shape, t.sides)}');
    expect(s).toContain('commit(sideStep(planRef.current, t.id, i, d), "sd:" + t.id + ":" + i)');
    expect(s).toContain("const sent = sidesOn ? { ...body, sides: true } : body;");
    expect(s).toContain('rpc("floor_save", { p_token: saToken(), p_plan: sent })');
    expect(s).toContain("sidesOn={!!st.sides}");
    expect(s).toContain("const g = tableGeom(t.shape, t.seats, aw, ah, t.sides)");
  });
});

describe("v183 · этап 55", () => {
  it("floor_save хранит sides (проверка пределов и мест), старое приложение их не стирает; seat_board — sides: true; признак этапа закрыт", () => {
    const q = rd("supabase/supabase-stage55-chair-sides.sql");
    expect(q).toContain("raise exception 'Сначала этап 54 (supabase-stage54-tall-tables.sql): нужны длинные столы вертикально';");
    expect(q).toContain("knows := coalesce(p_plan->'sides' = 'true'::jsonb, false);");
    expect(q).toContain("> case when t->>'shape' = 'sq' then 3 when (t->>'shape' = 'long') = (k <= 2) then 8 else 2 end)");
    expect(q).toContain("when not knows and not (t ? 'sides') and jsonb_typeof(old->'tables') = 'array' then");
    expect(q).toContain("'tall', true, 'sides', true,");
    expect(q).toContain("revoke all on function _sa_floor_sides() from public, anon, authenticated;");
    expect(q).toMatch(/select 'стулья по сторонам: ' \|\|/);
    expect(rd("tools/claude/sql/test55.sh")).toContain("bash run25.sh && bash test55.sh");
  });
});

describe("v183 · тексты", () => {
  it("без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["ui/floor-tools.jsx", "ui/seating.jsx", "ui/table-art.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
