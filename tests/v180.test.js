// v180 (Доп. 505): длинные столы вертикально на схеме зала.
// Владелец (20.11), распознав план зала по фото: «Ну вроде работает. Но почему то не учитывает длинные столы по
// вертикали, а только горизонт».
//   • этап 54 (supabase/supabase-stage54-tall-tables.sql): форма tall в floor_save (две клетки в глубину), tall: true в
//     seat_board, _sa_floor_shapes — по ней экран «Сервер» видит этап; на PostgreSQL — tools/claude/sql/test54.sh;
//   • lib/seating.js — cellsOf и spanOf, виды 6tall и 8tall, «Повернуть» (rotateTable), копия и место у края;
//   • lib/floor-art.js — у вертикального стола стулья вдоль левой и правой стороны, торцы сверху и снизу;
//   • lib/floor-scan.js — вытянутый вверх стол с плана встаёт вертикальным; без этапа 54 — квадратным, с пометкой;
//   • ui — палитра, «Повернуть», «Длинный» у квадратного (не влезает — вертикально), сохранение без этапа 54.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v180.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { GRID_H, cellsOf, spanOf, fits, kindOf, TABLE_KINDS, addTable, rotateTable, copyTable, updateTable, gridRows, planProblem, boardMap } from "../lib/seating.js";
import { sideCounts, tableGeom } from "../lib/floor-art.js";
import { snap, bestFit, layoutScan, scanSummary } from "../lib/floor-scan.js";
import { STAGES } from "../lib/server-check.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const P2 = (tables, items = []) => ({ v: 2, zones: [{ id: "z1", name: "Зал" }], items, tables: tables.map((t) => ({ z: "z1", ...t })) });
const T = (id, shape, x, y, seats = 6, n = id.slice(1)) => ({ id, n, seats, shape, x, y });

describe("v180 · версия и журнал", () => {
  it("сборка v180, Дополнение 505, слова владельца, сценарии, этап 54", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(180);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 505 — .*\(v180\)/);
    const part = c.slice(c.indexOf("# Дополнение 505")).replace(/\s+/g, " ");
    for (const w of ["Ну вроде работает", "Но почему то не учитывает длинные столы по вертикали, а только горизонт"]) expect(part, w).toContain(w);
    for (const line of c.slice(c.indexOf("# Дополнение 505")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v180.mjs");
    expect(rd("tools/claude/README.md")).toContain("test54.sh");
    expect(existsSync("tools/claude/sql/test54.sh")).toBe(true);
    const sb = rd("supabase/README.md");
    expect(sb).toContain("### Этап 54 (v180) — длинные столы вертикально");
    expect(sb).toContain("| 63 | `supabase-stage54-tall-tables.sql` | **Длинные столы вертикально** (v180)");
  });
});

describe("v180 · этап 54 на сервере", () => {
  const sql = rd("supabase/supabase-stage54-tall-tables.sql");
  it("floor_save: форма tall, две клетки в глубину (y до 28), обе клетки — в проверке наложений", () => {
    expect(sql).toContain("not in ('sq', 'rd', 'long', 'tall')");
    expect(sql).toContain("> case when t->>'shape' = 'tall' then 28 else 29 end");
    expect(sql).toContain("lateral generate_series(0, case when t->>'shape' = 'tall' then 1 else 0 end) as v(dy)");
    expect(sql).toContain("(t->>'y')::int + v.dy as cy");
    // остальное — как в этапе 37: залы, предметы, старое приложение
    expect(sql).toContain("return jsonb_build_object('ok', false, 'error', 'old_app');");
    expect(sql).toContain("'items', coalesce((select jsonb_agg(case it->>'kind'");
  });
  it("seat_board отдаёт tall: true; признак этапа — _sa_floor_shapes; права; без этапа 37 — понятная ошибка", () => {
    expect(sql).toContain("return jsonb_build_object('ok', true, 'floor', 2, 'tall', true,");
    expect(sql).toContain("create or replace function _sa_floor_shapes() returns text[]");
    expect(sql).toContain("revoke all on function _sa_floor_shapes() from public, anon, authenticated;");
    expect(sql).toContain("grant execute on function floor_save(text, jsonb) to anon, authenticated;");
    expect(sql).toContain("grant execute on function seat_board(text) to anon, authenticated;");
    expect(sql).toContain("raise exception 'Сначала этап 37 (supabase-stage37-halls-qday.sql): нужны залы и стены на схеме зала';");
    expect(STAGES[STAGES.length - 1]).toEqual({ n: "54", file: "supabase-stage54-tall-tables.sql", what: "Длинные столы вертикально на схеме зала", fn: "_sa_floor_shapes" });
  });
});

describe("v180 · вертикальный стол в расчётах (lib/seating.js)", () => {
  it("клетки и размер: две клетки в глубину; в последний ряд не встаёт", () => {
    expect(cellsOf(T("t1", "tall", 3, 4))).toEqual([[3, 4], [3, 5]]);
    expect([spanOf(T("a", "tall", 0, 0)), spanOf(T("b", "long", 0, 0)), spanOf(T("c", "rd", 0, 0))]).toEqual([[1, 2], [2, 1], [1, 1]]);
    const p = P2([]);
    expect(fits(p, T("x", "tall", 0, GRID_H - 2), 0, GRID_H - 2)).toBe(true);
    expect(fits(p, T("x", "tall", 0, GRID_H - 1), 0, GRID_H - 1)).toBe(false);
    expect(planProblem(P2([T("t1", "tall", 2, 2), T("t2", "sq", 2, 3, 2)]))).toBe("Стол 1 наезжает на другой или выходит за край");
    expect(gridRows(P2([T("t1", "tall", 0, 5)]), 1)).toBe(8);
  });
  it("виды: на 6 и 8 мест вертикально; без этапа 54 — такие же горизонтальные", () => {
    expect(TABLE_KINDS.slice(-2)).toEqual([{ k: "6tall", seats: 6, shape: "tall" }, { k: "8tall", seats: 8, shape: "tall" }]);
    expect(kindOf("8tall")).toEqual({ k: "8tall", seats: 8, shape: "tall" });
    expect(kindOf("8tall", false)).toEqual({ k: "8long", seats: 8, shape: "long" });
    expect(kindOf("4rd", false).k).toBe("4rd");
  });
  it("поставить: вертикальный в последнем ряду и над занятым — на клетку выше", () => {
    expect(addTable(P2([]), 4, GRID_H - 1, "z1", kindOf("6tall")).tables[0]).toMatchObject({ shape: "tall", x: 4, y: GRID_H - 2, seats: 6 });
    const p = addTable(P2([T("t1", "sq", 2, 5, 2)]), 2, 4, "z1", kindOf("8tall"));
    expect(p.tables[1]).toMatchObject({ shape: "tall", x: 2, y: 3, seats: 8 });
  });
  it("«Повернуть»: длинный ↔ вертикальный на своём месте; не влезает — выше или левее; некуда — как было", () => {
    const a = rotateTable(P2([T("t1", "long", 2, 2)]), "t1");
    expect(a.tables[0]).toMatchObject({ shape: "tall", x: 2, y: 2 });
    expect(rotateTable(a, "t1").tables[0]).toMatchObject({ shape: "long", x: 2, y: 2 });
    // снизу занято — вертикальный встаёт выше
    const b = rotateTable(P2([T("t1", "long", 2, 2), T("t2", "sq", 2, 3, 2)]), "t1");
    expect(b.tables[0]).toMatchObject({ shape: "tall", x: 2, y: 1 });
    // у правого края вертикальный → длинный левее
    const c = rotateTable(P2([T("t1", "tall", 7, 0)]), "t1");
    expect(c.tables[0]).toMatchObject({ shape: "long", x: 6, y: 0 });
    // квадратный не поворачивается; вокруг всё занято — как было
    const sq = P2([T("t1", "sq", 0, 0)]);
    expect(rotateTable(sq, "t1")).toBe(sq);
    const tight = P2([T("t1", "long", 0, 0), T("t2", "long", 2, 0), T("t3", "long", 0, 1), T("t4", "long", 2, 1)]);
    expect(rotateTable(tight, "t1")).toBe(tight);
  });
  it("«Ещё такой» у вертикального: справа, иначе снизу через две клетки", () => {
    const r = copyTable(P2([T("t1", "tall", 0, 0)]), "t1");
    expect(r.plan.tables[1]).toMatchObject({ shape: "tall", x: 1, y: 0, n: "2" });
    const r2 = copyTable(P2([T("t1", "tall", 7, 0)]), "t1");
    expect(r2.plan.tables[1]).toMatchObject({ shape: "tall", x: 7, y: 2 });
  });
  it("форма «Длинный» у квадратного: справа нет места — сервер с этапом 54 даёт вертикальный (так делает редактор)", () => {
    const p = P2([T("t1", "sq", 7, 0, 4)]);
    expect(updateTable(p, "t1", { shape: "long" })).toBe(p);
    expect(updateTable(p, "t1", { shape: "tall" }).tables[0]).toMatchObject({ shape: "tall", x: 7, y: 0 });
  });
});

describe("v180 · стол сверху (lib/floor-art.js)", () => {
  it("стулья вертикального: вдоль левой и правой стороны, с пяти мест — ещё сверху и снизу", () => {
    expect([2, 4, 6, 8, 12].map((n) => sideCounts("tall", n).join(""))).toEqual(["0011", "0022", "1122", "1133", "1155"]);
    expect(sideCounts("tall", 40).reduce((a, b) => a + b, 0)).toBe(20);
  });
  it("геометрия: столешница стоя, стулья все внутри рамки", () => {
    const g = tableGeom("tall", 8, 40, 82);
    expect(g.top.kind).toBe("rect");
    expect(g.top.h).toBeGreaterThan(g.top.w * 2);
    expect(g.chairs.length).toBe(8);
    for (const c of g.chairs) {
      const a = (c.rot * Math.PI) / 180, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
      const ex = (c.w / 2) * cs + (c.h / 2) * sn, ey = (c.w / 2) * sn + (c.h / 2) * cs;
      expect(c.cx - ex >= -0.01 && c.cx + ex <= 40.01 && c.cy - ey >= -0.01 && c.cy + ey <= 82.01, JSON.stringify(c)).toBe(true);
    }
    // три стула слева — по высоте, повёрнуты вдоль стороны
    const left = g.chairs.filter((c) => c.cx < 10);
    expect(left.length).toBe(3);
    expect(left.every((c) => c.rot === 90)).toBe(true);
  });
});

describe("v180 · вертикальные столы с фото (lib/floor-scan.js)", () => {
  it("вытянутый вверх прямоугольник: с этапом 54 — вертикальный, без — квадратный с пометкой", () => {
    const t = { shape: "rect", seats: 8 };
    expect(snap(t, [3.1, 1.6, 3.9, 3.4], true)).toMatchObject({ shape: "tall", x: 3, y: 2, upright: false });
    expect(snap(t, [3.1, 1.6, 3.9, 3.4], false)).toMatchObject({ shape: "sq", x: 3, y: 2, upright: true });
    expect(snap({ shape: "square", seats: 8 }, [3.1, 1.6, 3.9, 3.4], true).shape).toBe("tall");   // 8 мест и стоя — длинный
    expect(snap({ shape: "round", seats: 8 }, [3.1, 1.6, 3.9, 3.4], true).shape).toBe("rd");
    expect(snap(t, [3.1, 1.0, 3.9, 1.9], true).shape).toBe("sq");   // короткий — квадратный
    expect(snap(t, [3.1, 1.1, 3.9, 2.9], true)).toMatchObject({ shape: "tall", x: 3, y: 1 });
    expect(snap(t, [3.1, 1.1, 3.9, 2.9], true).res).toBeCloseTo(0, 5);   // центр стола — ровно между его клетками
  });
  it("масштаб и сдвиг: вертикальный занимает обе клетки — нижняя тоже не встаёт на занятое", () => {
    const tb = { t: { shape: "rect", seats: 8 }, b: [1.1, 1.1, 1.9, 2.9] };
    const free = bestFit([tb], new Set(), [0, 8], true);
    expect(free.cost).toBeLessThan(0.05);
    const fit = bestFit([tb], new Set(["1:2"]), [0, 8], true);
    expect(fit.cost).toBeLessThan(1000);
    const q = snap(tb.t, tb.b.map((v, i) => v * fit.f + (i % 2 ? fit.oy : fit.ox)), true);
    expect(q.shape).toBe("tall");
    expect([q.x + ":" + q.y, q.x + ":" + (q.y + 1)]).not.toContain("1:2");
    // и рядом квадратный под ним — без наложения
    expect(bestFit([tb, { t: { shape: "square", seats: 2 }, b: [1.1, 3.1, 1.9, 3.9] }], new Set(), [0, 8], true).cost).toBeLessThan(1000);
  });
  // план как у владельца: колонка вертикальных длинных столов справа, квадратные слева
  const SCAN = { plan: true, box: [2, 2, 98, 98], tables: [
    { b: [70, 5, 80, 35], shape: "rect", seats: 8, n: "19" }, { b: [70, 40, 80, 70], shape: "rect", seats: 8, n: "18" },
    { b: [86, 50, 96, 95], shape: "rect", seats: 12, n: "30" },
    ...[10, 30, 50].map((x, i) => ({ b: [x, 20, x + 9, 30], shape: "square", seats: 4, n: String(i + 1) })),
  ], bars: [], doors: [] };
  const IMG = { w: 800, h: 1000 };
  it("с этапом 54: вертикальные столы с плана — вертикальные, без наложений, номера с плана", () => {
    const r = layoutScan(SCAN, IMG, P2([]), "z1", { tall: true });
    expect(r.added).toBe(6);
    expect(r.upright).toBe(0);
    const by = Object.fromEntries(r.plan.tables.map((t) => [t.n, t]));
    expect([by["19"].shape, by["18"].shape, by["30"].shape, by["1"].shape]).toEqual(["tall", "tall", "tall", "sq"]);
    expect([by["19"].seats, by["30"].seats]).toEqual([8, 12]);
    expect(by["18"].y).toBeGreaterThan(by["19"].y + 1);
    expect(planProblem(r.plan)).toBe("");
    expect(scanSummary(r)).toBe("Расставил 6 столов по фото. Проверь номера и места. Если не так, нажми «Шаг назад».");
  });
  it("без этапа 54: те же столы квадратными, итог говорит, что вертикальные появятся с этапом 54", () => {
    const r = layoutScan(SCAN, IMG, P2([]), "z1", { tall: false });
    expect(r.added).toBe(6);
    expect(r.plan.tables.every((t) => t.shape === "sq")).toBe(true);
    expect(r.upright).toBe(3);
    expect(scanSummary(r)).toContain("3 длинных стола стоят на плане вертикально: поставил квадратными, вертикальные появятся с этапом 54 на сервере.");
    expect(scanSummary({ added: 5, upright: 1 })).toContain(" 1 длинный стол стоит на плане вертикально:");
  });
});

describe("v180 · экран", () => {
  it("доска: вертикальный стол — две клетки в высоту, стулья по сторонам, закрашено по гостям", async () => {
    const { Floor } = await import("../ui/seating.jsx");
    const plan = P2([T("t1", "tall", 2, 0, 8), T("t2", "long", 4, 0, 6)]);
    const html = R(h(Floor, { a11y: false, plan, map: boardMap([{ tid: "t1", status: "seat", cnt: 5, since: "2026-11-20T07:00:00Z" }]), now: Date.parse("2026-11-20T07:20:00Z") }));
    const part = (id) => html.slice(html.indexOf(`data-table="${id}"`), html.indexOf("</button>", html.indexOf(`data-table="${id}"`)));
    // клетка 45 px (ширина 360 / 8), отступ 1,35 px
    expect(part("t1")).toMatch(/left:91\.3\d*px;top:1\.3\d*px;width:42\.3\d*px;height:87\.3\d*px/);
    expect(part("t2")).toMatch(/width:87\.3\d*px;height:42\.3\d*px/);
    expect((part("t1").match(/data-chair="/g) || []).length).toBe(8);
    expect((part("t1").match(/data-chair="on"/g) || []).length).toBe(5);
    expect(part("t1")).toContain('aria-label="Стол 1, 8 мест: гости, гостей 5"');
  });
  it("палитра: с этапом 54 — восемь видов (и вертикальные), без — шесть; «Повернуть»", async () => {
    const { KindPalette, TurnBtn, kindLabel } = await import("../ui/floor-tools.jsx");
    const c = { gold: "#D2A85A", text: "#EFE4C8", sub: "#A99A7C", line: "rgba(0,0,0,0.2)", red: "#E08A7A", frost: {} };
    const on = R(h(KindPalette, { c, a11y: false, kind: "8tall", tall: true, onKind() {} }));
    expect((on.match(/data-kind="/g) || []).length).toBe(8);
    expect(on).toContain('aria-checked="true" aria-label="Длинный вертикальный на 8 мест" data-kind="8tall"');
    const off = R(h(KindPalette, { c, a11y: false, kind: "4sq", onKind() {} }));
    expect((off.match(/data-kind="/g) || []).length).toBe(6);
    expect(off).not.toContain("tall");
    expect(kindLabel(kindOf("6tall"))).toBe("Длинный вертикальный на 6 мест");
    expect(R(h(TurnBtn, { c, onClick() {} }))).toMatch(/data-edit-turn=""[^>]*>.*Повернуть<\/button>/);
  });
  it("редактор в коде: признак этапа 54, «Повернуть», «Длинный» вертикально, сохранение и ИИ", () => {
    const s = rd("ui/seating.jsx");
    expect(s).toContain("tall={!!st.tall} onCancel={() => setEdit(false)}");
    expect(s).toContain("function FloorEditor({ c, a11y, plan0, floor2 = false, tall = false, restaurant = \"\"");
    expect(s).toContain('{tall && (t.shape === "long" || t.shape === "tall") ? <TurnBtn c={c} onClick={turn} /> : null}');
    expect(s).toContain('if (p === planRef.current && tall) p = updateTable(planRef.current, t.id, { shape: "tall" });');
    expect(s).toContain("Вертикальные длинные столы сохранятся, когда на сервер добавят этап 54 (supabase-stage54-tall-tables.sql).");
    expect(s).toContain("Длинные столы вертикально появятся, когда на сервер добавят этап 54 (supabase-stage54-tall-tables.sql).");
    expect(s).toContain('else if (r && r.error === "bad_plan") setErr(');
    expect(s).toContain('dy: Math.max(0, Math.min(cy - t.y, t.shape === "tall" ? 1 : 0))');
    expect(s).toContain("const [cx, cy] = cellAt(e), x = cx - d.dx, y = cy - d.dy;");
    expect(s).toContain("width: spanOf(ghost.t)[0] * cell - 4, height: spanOf(ghost.t)[1] * cell - 4,");
    expect(s).toContain('const kd = kindOf(kind, tall), p = addTable(plan, x, y, z, kd);');
    // «Длинный» горит и у вертикального; чипсов в файле столько же (правило линзы v116)
    expect(s).toContain('data-lens-btn={t.shape === k || (k === "long" && t.shape === "tall") ? "tab" : "soft"} data-lens-ink=""');
    expect(s.split("\n").filter((l) => /chip\(c, /.test(l) && /style=/.test(l)).length).toBe(16);
  });
  it("тексты: без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["ui/floor-tools.jsx", "ui/seating.jsx", "lib/floor-scan.js", "lib/seating.js", "lib/floor-art.js", "ui/table-art.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
