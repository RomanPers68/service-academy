// v219 (Доп. 545): сколько людей нужно по часам — «Часы пик». Третье из пяти предложений по графику («И все 5 по
// предложениям»): потребность была на день целиком, а людей нужно в часы — обед, полный зал вечером.
//   • lib/schedule-hours.js — строки часов пик (config.hourNeed), расчёт смен дня (hourCover, hourPlan), сколько стоит в
//     часы пик (hourHave), «Часы пик не закрыты» (hourHolesIn);
//   • lib/schedule-gen.js — hourPlanOf: слоты дня по часам пик; lib/schedule-attn.js — дыру закрывает смена часов пик;
//   • ui/schedule.jsx — «Часы пик» в «Сколько людей нужно», строки в листе дня, «Часы пик не закрыты» в «Требует внимания».
// В браузере: tools/claude/e2e-v219.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { span, covers, hourRows, hourCover, hourPlan, defaultBy, haveAt, hourHave, hourGaps, hourHolesIn, hoursLabel } from "../lib/schedule-hours.js";
import { dayLevel, dayNeed, dayHours } from "../lib/schedule-days.js";
import { generateSchedule } from "../lib/schedule-gen.js";
import { holeShiftOf } from "../lib/schedule-attn.js";

const rd = (f) => readFileSync(f, "utf8");
const U = { k: "У", name: "Утро", from: 11, to: 19 }, D = { k: "Д", name: "День", from: 12, to: 20 }, V = { k: "В", name: "Вечер", from: 16, to: 24 };
// январь 2027: 1-е — пятница; дни недели с понедельника
const dow = (d) => (d + 3) % 7;
const iso = (d) => "2027-01-" + String(d).padStart(2, "0");
const RULES = { peakDows: [4, 5], highDows: [], closedDows: [0], holidayPeak: false, maxRow: 5, minOff: 2, minRest: 11, normMode: "floor" };
const ctx = (dates = {}) => ({ rules: RULES, days: {}, dates, iso, dow, holName: () => null, levels: 2 });

describe("v219 · версия и журнал", () => {
  it("сборка v219, Дополнение 545, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(219);
    const part = rd("CHANGES.md").slice(rd("CHANGES.md").indexOf("# Дополнение 545"));
    expect(part).toMatch(/^# Дополнение 545 — .*\(v219\)/);
    for (const w of ["«Часы пик»", "config.hourNeed", "lib/schedule-hours.js", "e2e-v219.mjs", "Утренняя сводка"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v219 · часы смены и строки часов пик", () => {
  it("смена через полночь, какой час закрывает смена", () => {
    expect([span(12, 20), span(18, 2), span(20, 8)]).toEqual([[12, 20], [18, 26], [20, 32]]);
    expect([covers(D, 12), covers(D, 19), covers(D, 20), covers({ from: 18, to: 2 }, 25), covers({ from: 18, to: 2 }, 26)]).toEqual([true, true, false, true, false]);
  });
  it("строки должности на день недели: пустые дни — все, плохие строки отброшены", () => {
    const cfg = { hourNeed: { waiter: [{ from: 19, to: 22, n: 6, dows: [4, 5] }, { from: 12, to: 15, n: 3, dows: [] }, { from: 12, to: 12, n: 2 }, { from: 10, to: 14, n: 0 }, null, { from: "19", to: 22, n: 2 }] } };
    expect(hourRows(cfg, "waiter", 4)).toEqual([{ from: 19, to: 22, n: 6 }, { from: 12, to: 15, n: 3 }]);
    expect(hourRows(cfg, "waiter", 1)).toEqual([{ from: 12, to: 15, n: 3 }]);
    expect(hourRows(cfg, "bar", 1)).toEqual([]);
    expect(hoursLabel(22, 26)).toBe("с 22 до 2");
  });
});

describe("v219 · кого в какую смену (hourCover)", () => {
  const shifts = [U, D, V];
  it("вечер с 19 до 22 — шестеро: день кончается в 20, значит все шестеро вечером", () => {
    expect(hourCover({ shifts, rows: [{ from: 19, to: 22, n: 6 }], base: 6, dayK: "Д" })).toEqual({ total: 6, by: { "В": 6 }, ok: true });
  });
  it("плюс обед с 12 до 15 — трое: людей больше потребности дня (9), обед — днём", () => {
    expect(hourCover({ shifts, rows: [{ from: 19, to: 22, n: 6 }, { from: 12, to: 15, n: 3 }], base: 6, dayK: "Д" })).toEqual({ total: 9, by: { "Д": 3, "В": 6 }, ok: true });
  });
  it("часы пик только поправляют обычную расстановку: 6 в день, вечером нужно трое — трое уходят в вечер", () => {
    expect(hourCover({ shifts, rows: [{ from: 19, to: 22, n: 3 }], base: 6, dayK: "Д" })).toEqual({ total: 6, by: { "Д": 3, "В": 3 }, ok: true });
    const full = { k: "Д", from: 12, to: 24 };
    expect(hourCover({ shifts: [full, V], rows: [{ from: 19, to: 22, n: 4 }], base: 6, dayK: "Д" })).toEqual({ total: 6, by: { "Д": 6 }, ok: true });
    expect(hourCover({ shifts: [full, V], rows: [{ from: 19, to: 22, n: 8 }], base: 6, dayK: "Д" })).toEqual({ total: 8, by: { "Д": 6, "В": 2 }, ok: true });
  });
  it("с разбивкой (Д:5, В:1) — ближе к ней; часы вне работы дня не в счёт; час, где нет ни одной смены, — ok: false", () => {
    expect(hourCover({ shifts, rows: [{ from: 19, to: 22, n: 2 }], base: 6, dayK: "Д", dflt: { "Д": 5, "В": 1 } })).toEqual({ total: 6, by: { "Д": 4, "В": 2 }, ok: true });
    expect(hourCover({ shifts: [D, V], rows: [{ from: 9, to: 11, n: 2 }, { from: 19, to: 23, n: 4 }], base: 4, dayK: "Д", open: [12, 24] })).toEqual({ total: 4, by: { "В": 4 }, ok: true });
    expect(hourCover({ shifts: [D, V], rows: [{ from: 22, to: 2, n: 2 }], base: 4, dayK: "Д" })).toEqual({ total: 4, by: { "Д": 2, "В": 2 }, ok: false });
    expect(hourCover({ shifts: [D], rows: [], base: 4 })).toBe(null);
  });
  it("обычная расстановка: разбивка по типу дня или одна; остаток — в основную", () => {
    const cfg = { split: { waiter: { "1": { "У": 1 }, "3": { "Д": 5, "В": 2 } }, bar: { "В": 1 } } };
    expect(defaultBy(cfg, "waiter", 1, 4, [U, D, V], "Д")).toEqual({ "У": 4 });   // как daySlots: главная буква разбивки добирает остаток
    expect(defaultBy(cfg, "waiter", 3, 6, [U, D, V], "Д")).toEqual({ "В": 2, "Д": 4 });
    expect(defaultBy(cfg, "bar", 1, 2, [U, D, V], "Д")).toEqual({ "В": 2 });
    expect(defaultBy({}, "host", 1, 1, [U, D, V], "Д")).toEqual({ "Д": 1 });
  });
});

describe("v219 · часы пик дня (hourPlan)", () => {
  const cfg = { shifts: [U, D, V, { k: "К", name: "Кейтеринг", from: 10, to: 22, extra: 1 }], dayShift: "Д", rules: RULES,
    need: { 1: { waiter: 4 }, 3: { waiter: 6 } }, hours: [[12, 24], [12, 24], [12, 24], [12, 24], [12, 26], [12, 26], [12, 24]],
    hourNeed: { waiter: [{ from: 19, to: 22, n: 6, dows: [4, 5] }, { from: 13, to: 15, n: 2 }] } };
  it("пятница — вечер на шестерых и обед на двоих; вторник — только обед; понедельник закрыт", () => {
    expect(hourPlan(ctx(), cfg, 8).waiter).toMatchObject({ total: 8, by: { "Д": 2, "В": 6 }, ok: true });
    expect(hourPlan(ctx(), cfg, 5).waiter).toMatchObject({ total: 4, by: { "Д": 4 } });
    expect(hourPlan(ctx(), cfg, 4)).toEqual({});
    expect(hourPlan(ctx(), { ...cfg, hourNeed: {} }, 8)).toEqual({});
  });
  it("особый день с 16: только вечер, обед вне часов работы не в счёт", () => {
    const x = ctx({ "2027-01-02": { hours: [16, 24] } });
    expect(dayHours(x, 2)).toEqual([16, 24]);
    expect(hourPlan(x, cfg, 2).waiter).toMatchObject({ total: 6, by: { "В": 6 }, ok: true });
  });
  it("сколько стоит в часы пик; где не хватает", () => {
    const staff = [1, 2, 3].map((i) => ({ id: "s" + i, pos: "waiter" })).concat([{ id: "b", pos: "bar" }]);
    const plan = { s1: { 8: "Д" }, s2: { 8: "В" }, s3: { 8: "В" }, b: { 8: "В" } };
    const shiftOf = (k) => cfg.shifts.find((x) => x.k === k);
    const c = { staff, plan, shiftOf };
    expect([haveAt(c, 8, "waiter", 13), haveAt(c, 8, "waiter", 17), haveAt(c, 8, "waiter", 21)]).toEqual([1, 3, 2]);
    expect(hourHave(c, 8, "waiter", { from: 19, to: 22, n: 6 }, [12, 26])).toBe(2);
    expect(hourHave(c, 8, "waiter", { from: 9, to: 11, n: 6 }, [12, 26])).toBe(null);
    expect(hourGaps(c, 8, "waiter", [{ from: 19, to: 22, n: 6 }, { from: 13, to: 15, n: 1 }], [12, 26])).toEqual([{ from: 19, to: 22, n: 6, have: 2 }]);
    const POS = [{ id: "waiter", t: "Официант" }, { id: "bar", t: "Бар" }];
    expect(hourHolesIn([5, 8], { staff, plan, shiftOf, POS, planOf: (d) => hourPlan(ctx(), cfg, d), openOf: () => [12, 26] }))
      .toEqual([{ pos: "waiter", title: "Официант", days: [{ d: 5, from: 13, to: 15, miss: 2 }, { d: 8, from: 19, to: 22, miss: 4 }] }]);
  });
  it("дыру закрывает смена часов пик", () => {
    const shiftOf = (k) => cfg.shifts.find((x) => x.k === k);
    const z = holeShiftOf({ d: 8, pos: "waiter", cfg, lvlOf: () => 3, staff: [{ id: "a", pos: "waiter" }], plan: { a: { 8: "Д" } }, shiftOf, hourBy: { "Д": 1, "В": 6 } });
    expect(z.k).toBe("В");
    expect(holeShiftOf({ d: 8, pos: "waiter", cfg, lvlOf: () => 3, staff: [], plan: {}, shiftOf }).k).toBe("Д");
  });
});

describe("v219 · генератор по часам пик", () => {
  const cfg = { shifts: [D, V], dayShift: "Д", split: { waiter: { "Д": 3 } }, rules: { ...RULES, closedDows: [] }, need: { 1: { waiter: 3 }, 3: { waiter: 4 } },
    posRules: { waiter: { pattern: "even" } }, hours: [[12, 24], [12, 24], [12, 24], [12, 24], [12, 24], [12, 24], [12, 24]],
    hourNeed: { waiter: [{ from: 20, to: 23, n: 3, dows: [4, 5] }] },
    staff: ["Аня", "Боря", "Вера", "Гена", "Дима", "Ева", "Жора"].map((n, i) => ({ id: "s" + i, name: n, pos: "waiter", norm: 150, off: [] })) };
  const x = { ...ctx(), rules: cfg.rules };
  const col = (res, d) => Object.values(res.plan).map((r) => r[d] || "").filter(Boolean).sort().join("");
  it("пятницы и субботы: трое вечером с 20 до 23 и ещё один днём (потребность пика 4); будни — трое днём", () => {
    const run = (hp) => generateSchedule({ cfg, DAYS: 31, dow, lvlOf: (d) => dayLevel(x, d), needOf: (d) => { const n = dayNeed(x, cfg, d), h = hourPlan(x, cfg, d); Object.keys(h).forEach((p) => { n[p] = h[p].total; }); return n; },
      hourPlanOf: hp ? (d) => hourPlan(x, cfg, d) : null, plan: {}, locks: {}, POS: [{ id: "waiter" }], mkey: "2027-01", restarts: 4, seed: 11 });
    const res = run(true);
    for (const d of [1, 2, 8, 9, 15, 16]) expect(col(res, d), "день " + d).toBe("ВВВД");
    for (const d of [4, 5, 6, 7, 11]) expect(col(res, d), "день " + d).toBe("ДДД");
    expect(res.shortage).toBe(0);
    const old = run(false);
    expect(col(old, 8)).toBe("ДДДД");                                              // без часов пик — по разбивке, все днём
  });
});

describe("v219 · экран графика", () => {
  const S = rd("ui/schedule.jsx");
  it("настройки: hourNeed; потребность дня — с часами пик; генератору — hourPlanOf", () => {
    expect(S).toContain("hourNeed: {},");
    expect(S).toContain('if (!out.hourNeed || typeof out.hourNeed !== "object" || Array.isArray(out.hourNeed)) out.hourNeed = {};   // v219');
    expect(S).toContain("const hourPlanOfD = d => (cfg ? hourPlan(dayCtx, cfg, d) : {});");
    expect(S).toContain("Object.keys(hp).forEach(pos => { n[pos] = hp[pos].total; }); return n; };");
  });
  it("«Часы пик» в «Сколько людей нужно»: строки, дни недели, пример расчёта, добавить", () => {
    for (const s of ['<div data-hour-list="">', "data-hour-row={pos + \":\" + i}", 'data-hour-del={pos + ":" + i}', '"data-hour-dow": wi', '<div data-hour-preview=""',
      ">+ час пик", "Часть часов пик не попадает ни в одну смену", " · часы пик: ", "Сколько людей нужно в часы, когда зал полный: обед, вечер."]) expect(S, s).toContain(s);
    expect(S).toContain("c.hourNeed = { ...(c.hourNeed || {}), [pos]: [...(c.hourNeed?.[pos] || []), { from: 19, to: 22, n: n0, dows: [] }] }; })}>");
  });
  it("лист дня — строки часов пик; «Требует внимания» — «Часы пик не закрыты»", () => {
    expect(S).toContain('<div data-day-hours="" style={{ marginTop:8, display:"flex", flexDirection:"column", gap:2 }}>');
    expect(S).toContain("Час пик {hoursLabel(r.from, r.to)} · {posName(pos).toLowerCase()}: {have} из {r.n}");
    expect(S).toContain('data-attn-row="hour"');
    expect(S).toContain("Часы пик не закрыты: {h.title.toLowerCase()}");
    expect(S).toContain("const calm = !confl.length && !holes.length && !hourHoles.length && !waiting.length && !tk103;");
  });
});
