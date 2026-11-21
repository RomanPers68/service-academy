// v188 (Доп. 513): сетка мельче и стены с фото — третья сборка по ответу владельца «Давай все».
//   • lib/seating.js — сдвиг стола от клетки в четверть клетки (ox, oy): offOf, withOff, viewBox, clearOf, fineSpot,
//     moveFine, nudgeTable, unFine, settleFine (столы внахлёст не встают), moveTable — ровно в клетку; wallsFromSegs —
//     стены с фото на линии сетки;
//   • lib/floor-scan.js — seg4, cleanScan (walls), place: сдвиг по центру стола на плане (fine) и стены; scanSummary
//     «и стены»;
//   • ui/floor-tools.jsx — FineNudge «Точнее»; ui/seating.jsx — стол со сдвигом на схеме, перетаскивание с точностью до
//     четверти, в карточке стола стрелки и «Ровно», сохранение с fine: true (этап 56);
//   • supabase/functions/floor-scan (версия 6) — первый проход отвечает и стенами.
// SQL не нужен: этап 56 (v187) уже принимает ox, oy. Разметки JSX в файле нет (Доп. 482). В браузере: e2e-v188.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { FINE, FINE_MAX, offOf, withOff, viewBox, clearOf, fineSpot, moveFine, nudgeTable, unFine, settleFine, noFine, moveTable, wallsFromSegs, addBar } from "../lib/seating.js";
import { seg4, cleanScan, layoutScan, scanSummary } from "../lib/floor-scan.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const ENV = { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE_KEY: "svc", OPENROUTER_API_KEY: "or-key", OPENROUTER_MODEL: "anthropic/claude-haiku-5.5" };
globalThis.Deno = { serve() {}, env: { get: (k) => ENV[k] } };
const fn = await import("../supabase/functions/floor-scan/index.ts");
const Z = [{ id: "z1", name: "Зал" }, { id: "z2", name: "Терраса" }];
const P = (tables, items = []) => ({ v: 2, zones: Z, items, tables: tables.map((t) => ({ z: "z1", ...t })) });
const T = (id, x, y, extra = {}) => ({ id, n: id.slice(1), seats: 4, shape: "sq", x, y, ...extra });
const at = (p, id) => { const t = p.tables.find((q) => q.id === id); return [t.x, t.y, t.ox || 0, t.oy || 0]; };

describe("v188 · версия и журнал", () => {
  it("сборка v188, Дополнение 513, слова владельца, сценарий, функция версии 6", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(188);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 513 — .*\(v188\)/);
    const part = c.slice(c.indexOf("# Дополнение 513")).replace(/\s+/g, " ");
    expect(part).toContain("Давай все");
    for (const line of c.slice(c.indexOf("# Дополнение 513")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v188.mjs");
    expect(rd("supabase/README.md")).toContain("### v188 — без SQL: функцию `floor-scan` развернуть заново (версия 6)");
    expect(rd("supabase/AI-SETUP.md")).toContain("## v188: стены и перегородки с фото (`floor-scan` версии 6)");
    expect(fn.FLOOR_SCAN_V).toBe(6);
  });
});

describe("v188 · сдвиг стола в четверть клетки", () => {
  it("сдвиг: в четвертях, ноль — без поля; где стол на схеме", () => {
    expect([FINE, FINE_MAX]).toEqual([0.25, 0.5]);
    expect(offOf(T("t1", 1, 1))).toEqual([0, 0]);
    expect(withOff(T("t1", 1, 1), 0.3, -0.1)).toEqual({ ...T("t1", 1, 1), ox: 0.25 });   // −0.1 → 0, без поля
    expect(withOff(T("t1", 1, 1, { ox: 0.5, oy: 0.25 }), 0, 0)).toEqual(T("t1", 1, 1));
    expect(viewBox(T("t1", 2, 3, { ox: -0.25, oy: 0.5 }))).toEqual([1.75, 3.5, 2.75, 4.5]);
    expect(viewBox({ ...T("t1", 2, 3), shape: "long", ox: 0.5 })).toEqual([2.5, 3, 4.5, 4]);
    expect(viewBox({ ...T("t1", 2, 3), shape: "tall", oy: -0.5 })).toEqual([2, 2.5, 3, 4.5]);
  });
  it("внахлёст — только столы того же зала; вплотную можно", () => {
    const p = P([T("t1", 0, 0, { ox: 0.5 }), T("t2", 1, 0), T("t3", 2, 0, { z: "z2" })]);
    expect(clearOf(p, p.tables[1])).toBe(false);
    expect(clearOf(p, withOff(p.tables[0], 0, 0))).toBe(true);
    expect(clearOf(p, { ...p.tables[2], ox: -0.5 })).toBe(true);   // другой зал
    expect(clearOf(P([T("t1", 0, 0, { ox: 0.5 }), T("t2", 2, 0, { ox: -0.5 })]), T("t2", 2, 0, { ox: -0.5 }))).toBe(true);   // вплотную
  });
  it("поставить в точку: клетка из ближайших свободных, сдвиг — остаток до половины; некуда — null", () => {
    const p = P([T("t1", 2, 1), T("t2", 4, 1)]);
    expect(fineSpot(p, p.tables[0], 2.3, 1.1)).toEqual({ ...p.tables[0], ox: 0.25 });   // к четверти
    expect(fineSpot(p, p.tables[0], 2.75, 1)).toEqual({ ...p.tables[0], x: 3, ox: -0.25 });
    expect(fineSpot(p, p.tables[0], 3.5, 1)).toBeNull();   // клетка 3 с полклетки вправо налезет на 2, клетка 4 занята
    expect(fineSpot(p, p.tables[1], 5.5, 1.25)).toEqual({ ...p.tables[1], x: 6, ox: -0.5, oy: 0.25 });
    expect(fineSpot(p, p.tables[1], 7.75, 1)).toBeNull();   // за край сетки
    const pb = P([T("t1", 0, 0)], [{ id: "i1", kind: "bar", x: 1, y: 0, w: 1, h: 2, z: "z1" }]);
    expect(fineSpot(pb, pb.tables[0], 1, 0)).toBeNull();   // на бар — нет
    expect(fineSpot(pb, pb.tables[0], 0.5, 0)).toBeNull();   // и наполовину на бар — нет
    expect(fineSpot(pb, pb.tables[0], 0, 0.25)).toEqual({ ...pb.tables[0], oy: 0.25 });
  });
  it("перетащить точнее и «Точнее» стрелками; «Ровно»; в клетку — ровно", () => {
    let p = P([T("t1", 2, 1), T("t2", 4, 1)]);
    p = nudgeTable(p, "t1", 1, 0);
    expect(at(p, "t1")).toEqual([2, 1, 0.25, 0]);
    p = nudgeTable(nudgeTable(p, "t1", 1, 0), "t1", 1, 0);
    expect(at(p, "t1")).toEqual([3, 1, -0.25, 0]);   // дальше половины — в соседнюю клетку
    p = nudgeTable(nudgeTable(p, "t1", 1, 0), "t1", 0, 1);
    expect(at(p, "t1")).toEqual([3, 1, 0, 0.25]);
    expect(nudgeTable(p, "t1", 1, 0)).toBe(p);   // мешает стол 2
    expect(nudgeTable(p, "t9", 1, 0)).toBe(p);
    expect(at(unFine(p, "t1"), "t1")).toEqual([3, 1, 0, 0]);
    expect(moveFine(p, "t1", 3, 1.25)).toBe(p);   // туда же — без изменений
    expect(at(moveTable(p, "t1", 0, 0), "t1")).toEqual([0, 0, 0, 0]);   // «Передвинуть» в клетку — без сдвига
  });
  it("столы внахлёст после правки — сдвиги уменьшаются, сначала у того, кого трогали", () => {
    const p = P([T("t1", 0, 0, { ox: 0.5 }), T("t2", 1, 0)]);
    expect(at(settleFine(p), "t1")).toEqual([0, 0, 0, 0]);
    const q = P([T("t1", 0, 0, { ox: 0.5 }), T("t2", 1, 0, { ox: 0.5 }), T("t3", 3, 0)]);
    const s = settleFine(q, "t2");
    expect([at(s, "t1"), at(s, "t2")]).toEqual([[0, 0, 0.5, 0], [1, 0, 0.5, 0]]);   // 1.5–2.5 и 0.5–1.5 не налезают: нечего менять
    const w = P([T("t1", 0, 0, { ox: 0.5 }), T("t2", 1, 0, { ox: -0.25 })]);
    const ws = settleFine(w, "t2");
    expect(at(ws, "t2")).toEqual([1, 0, 0, 0]);   // сначала у t2 (его трогали), потом у t1
    expect(at(ws, "t1")).toEqual([0, 0, 0, 0]);
    const door = P([T("t1", 0, 0, { ox: 0.5 })], [{ id: "i1", kind: "door", x: 1, y: 0, z: "z1" }]);
    expect(at(settleFine(door), "t1")).toEqual([0, 0, 0, 0]);   // налез на вход — сдвиг ушёл
    const nothing = P([T("t1", 0, 0), T("t2", 1, 0)]);
    expect(settleFine(nothing)).toBe(nothing);
    expect(noFine(nothing)).toBe(nothing);
    expect(noFine(p).tables.every((t) => !("ox" in t) && !("oy" in t))).toBe(true);
  });
});

describe("v188 · стены с фото", () => {
  it("концы — к узлам сетки, по горизонтали или вертикали, подряд — одним отрезком", () => {
    const p = P([]);
    expect(wallsFromSegs(p, "z1", [[0.2, 3.1, 2.4, 2.8]])).toEqual([[0, 3, 2, 3]]);
    expect(wallsFromSegs(p, "z1", [[4.1, 3.6, 3.9, 6.2]])).toEqual([[4, 4, 4, 6]]);
    expect(wallsFromSegs(p, "z1", [[0, 1, 2, 1], [2, 1, 5, 1], [1, 1, 3, 1]])).toEqual([[0, 1, 5, 1]]);   // продолжение и повтор
    expect(wallsFromSegs(p, "z1", [[3, 3, 3.3, 3.2], [-2, 40, 10, 40]])).toEqual([[0, 30, 8, 30]]);   // точка — нет; за краем — к краю
    expect(wallsFromSegs(p, "z1", [[1, 1, NaN, 2], "x", null])).toEqual([]);
  });
  it("внутри длинного стола (между его клетками) стены нет", () => {
    const p = P([{ ...T("t1", 2, 0), shape: "long" }, { ...T("t2", 5, 2), shape: "tall" }]);
    expect(wallsFromSegs(p, "z1", [[3, 0, 3, 2]])).toEqual([[3, 1, 3, 2]]);   // кусок 3:0–3:1 — середина длинного
    expect(wallsFromSegs(p, "z1", [[4, 3, 7, 3]])).toEqual([[4, 3, 5, 3], [6, 3, 7, 3]]);   // 5–6 на высоте 3 — середина вертикального
    expect(wallsFromSegs(P([{ ...T("t1", 2, 0), shape: "long", z: "z2" }]), "z1", [[3, 0, 3, 2]])).toEqual([[3, 0, 3, 2]]);   // другой зал
  });
  it("ответ функции: стены — отрезки в процентах, короче половины процента — нет, до 30", () => {
    expect(seg4([10, 20, 10, 60])).toEqual([10, 20, 10, 60]);
    expect(seg4([10, 20, 10.2, 20.1])).toBeNull();
    expect(seg4(["5", "5", "50", 120])).toEqual([5, 5, 50, 100]);
    expect(seg4([1, 2, 3])).toBeNull();
    const s = cleanScan({ plan: true, tables: [{ b: [10, 10, 20, 20], shape: "square", seats: 4, n: "1" }], walls: [[50, 0, 50, 40], [1, 1, 1.1, 1.1], "x", ...Array.from({ length: 40 }, (_, i) => [0, i, 90, i])] });
    expect(s.walls[0]).toEqual([50, 0, 50, 40]);
    expect(s.walls.length).toBe(30);
    expect(cleanScan({ plan: true, tables: [] }).walls).toEqual([]);
  });
  it("распознавание: стены — на схеме по сетке, столы — точнее клетки, без нахлёста; итог «и стены»", () => {
    const scan = { plan: true, box: [0, 0, 100, 100], tables: [
      { b: [3, 3, 13, 13], shape: "square", seats: 4, n: "1" }, { b: [18, 3, 28, 13], shape: "square", seats: 4, n: "2" },
      { b: [40, 50, 52, 62], shape: "round", seats: 4, n: "3" }], bars: [], doors: [], walls: [[0, 30, 40, 30], [70, 40, 70, 90]] };
    const r = layoutScan(scan, { w: 1000, h: 1000 }, P([]), "z1", { fine: true });
    expect(r.walls).toBe(2);
    const ws = r.plan.items.filter((i) => i.kind === "wall");
    expect(ws.every((w) => (w.x === w.x2) !== (w.y === w.y2) && [w.x, w.y, w.x2, w.y2].every(Number.isInteger))).toBe(true);
    const ts = r.plan.tables;
    expect(ts.every((t) => [t.ox || 0, t.oy || 0].every((v) => Math.abs(v) <= 0.5 && Number.isInteger(v * 4)))).toBe(true);
    expect(ts.some((t) => t.ox || t.oy)).toBe(true);
    expect(r.shifted).toBeGreaterThan(0);
    expect(ts.every((t) => clearOf(r.plan, t))).toBe(true);
    // без fine (сервер без этапа 56) — без сдвигов; стены — если в зале их нет
    const r0 = layoutScan(scan, { w: 1000, h: 1000 }, P([]), "z1", {});
    expect(r0.plan.tables.every((t) => !("ox" in t) && !("oy" in t))).toBe(true);
    const had = layoutScan(scan, { w: 1000, h: 1000 }, P([], [{ id: "i1", kind: "wall", x: 0, y: 0, x2: 1, y2: 0, z: "z1" }]), "z1", { fine: true });
    expect(had.walls).toBe(0);
    expect(layoutScan(scan, { w: 1000, h: 1000 }, P([]), "z1", { items: false }).walls).toBe(0);   // без этапа 37 — ни бара, ни стен
    expect(scanSummary({ added: 9, bars: 1, doors: 1, walls: 2 })).toMatch(/^Расставил 9 столов по фото, бар, вход и стены\./);
    expect(scanSummary({ added: 3, walls: 1 })).toMatch(/^Расставил 3 стола по фото, стену\./);
    expect(scanSummary({ added: 3, bars: 1, doors: 2 })).toMatch(/^Расставил 3 стола по фото, бар и входы\./);
    void addBar;
  });
});

describe("v188 · функция floor-scan версии 6", () => {
  it("подсказка первого прохода просит стены, ответ чистится: отрезки в процентах, короткие — нет", () => {
    expect(fn.SCAN_SYSTEM).toContain("- walls — стены и перегородки, отрезки [x1, y1, x2, y2] в процентах:");
    expect(fn.SCAN_SYSTEM).toContain("Внешнюю рамку прямоугольного зала не перечисляй: она уже в box.");
    expect(fn.SCAN_SYSTEM).toContain('"walls":[[50,0,50,40]]');
    const o = fn.cleanReply({ plan: true, tables: [], walls: [[50, 0, 50, 40], [1, 1, 1, 1.2], [-5, 10, 120, 10], "x"] });
    expect(o.walls).toEqual([[50, 0, 50, 40], [0, 10, 100, 10]]);
    expect(fn.cleanReply({ plan: true, tables: [] }).walls).toEqual([]);
    expect(fn.scanRequest("anthropic/claude-haiku-5.5", "data:image/jpeg;base64,AAA").max_tokens).toBe(Math.ceil(3600 * 1.35) + 4000);   // стенам место в ответе
  });
});

describe("v188 · экран", () => {
  it("«Точнее»: четыре стрелки с подписями для диктора, «Ровно» — только когда есть сдвиг", async () => {
    const { FineNudge } = await import("../ui/floor-tools.jsx");
    const c = { gold: "#D2A85A", text: "#EFE4C8", sub: "#A99A7C", line: "rgba(214,178,102,0.22)" };
    const a = R(h(FineNudge, { c, a11y: false, off: [0, 0], onNudge: () => {}, onReset: () => {} }));
    expect((a.match(/data-fine-btn="/g) || []).length).toBe(4);
    for (const l of ["Влево", "Вверх", "Вниз", "Вправо"]) expect(a).toContain('aria-label="' + l + ' на четверть клетки"');
    expect(a).toContain('role="group" aria-label="Сдвинуть точнее"');
    expect(a).not.toContain("data-fine-reset");
    expect(R(h(FineNudge, { c, off: [0.25, 0], onNudge: () => {}, onReset: () => {} }))).toMatch(/data-fine-reset=""[^>]*>Ровно<\/button>/);
  });
  it("схема: стол со сдвигом, перетаскивание в четверть, тень по fineSpot", () => {
    const s = code(rd("ui/seating.jsx"));
    expect(s).toContain("left: (t.x + offOf(t)[0]) * cell + pad, top: (t.y + offOf(t)[1]) * cell + pad");
    expect(s).toContain("if (fine) { const [fx, fy] = fineAt(e, d); onDrop(d.t, fx, fy); return; }");
    expect(s).toContain("const nt = fineSpot(plan, d.t, fx, fy), v = nt ? viewBox(nt) : [fx, fy];");
    expect(s).toContain("const [vx, vy] = viewBox(t), g = tableGeom(");   // перемычка компании — тоже со сдвигом
  });
  it("редактор: сдвиги не дают налезать; стрелки и «Ровно»; сохранение с fine; ИИ ставит сдвиги; доска передаёт признак", () => {
    const s = code(rd("ui/seating.jsx"));
    expect(s).toContain("if (next && fineOn && next !== cur) next = settleFine(next, sel);");
    expect(s).toContain("const p = fineOn ? moveFine(plan, q.id, x, y) : moveTable(plan, q.id, x, y);");
    expect(s).toContain('commit(p, "f:" + t.id);');
    expect(s).toContain("{fineOn ? <FineNudge c={c} a11y={a11y} off={offOf(t)} onNudge={nudge}");
    expect(s).toContain("if (fineOn) body.fine = true;");
    expect(s).toContain("{ mode, items: floor2, tall, sides: sidesOn, fine: fineOn }");
    expect(s).toContain("onDrop={drop} fine={fineOn}");
    expect(s).toContain("fineOn={!!st.fine}");
  });
});

describe("v188 · тексты", () => {
  it("без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["lib/seating.js", "lib/floor-scan.js", "ui/floor-tools.jsx", "ui/seating.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
