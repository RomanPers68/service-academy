// v220 (Доп. 546): состав смены и честный график — четвёртое и пятое из пяти предложений по графику.
//   • «Новичок» у сотрудника (staff[].newbie); правило «Новичок не один» (rules.newbieAlone): в его часы рядом опытный
//     той же должности — генератор ставит опытных первыми, «Проверка», лист дня и «Требует внимания» показывают нарушения;
//   • «Пиковые дни поровну» (rules.peakFair): по доле от своей нормы, полставочнику меньше;
//   • «Выходные парами» (rules.pairOff): выходной одним днём между сменами — реже.
// Расчёты — lib/schedule-team.js. В браузере: tools/claude/e2e-v220.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { overlap, ruleOn, aloneOn, aloneDays, peakCounts, peakUneven, singleOffs } from "../lib/schedule-team.js";
import { generateSchedule } from "../lib/schedule-gen.js";
import { dayLevel, dayNeed } from "../lib/schedule-days.js";

const rd = (f) => readFileSync(f, "utf8");
const D = { k: "Д", name: "День", from: 12, to: 20 }, V = { k: "В", name: "Вечер", from: 16, to: 24 }, U = { k: "У", name: "Утро", from: 9, to: 15 },
  K = { k: "К", name: "Кейтеринг", from: 10, to: 22, extra: 1 };
const SH = [D, V, U, K], shiftOf = (k) => SH.find((x) => x.k === k);
// декабрь 2026: 1-е — вторник; дни недели с понедельника
const first = (new Date(2026, 11, 1).getDay() + 6) % 7, dow = (d) => (first + d - 1) % 7;
const ALL = [...Array(31)].map((_, i) => i + 1);

describe("v220 · версия и журнал", () => {
  it("сборка v220, Дополнение 546, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(220);
    const c = rd("CHANGES.md"), part = c.slice(c.indexOf("# Дополнение 546"));
    expect(part).toMatch(/^# Дополнение 546 — .*\(v220\)/);
    for (const w of ["«Новичок не один»", "«Пиковые дни поровну»", "«Выходные парами»", "lib/schedule-team.js", "e2e-v220.mjs"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v220 · состав смены (lib/schedule-team.js)", () => {
  it("пересечение смен по часам, правила по умолчанию включены", () => {
    expect([overlap(D, V), overlap(U, V), overlap(U, D), overlap({ from: 18, to: 2 }, { from: 0, to: 6 }), overlap(null, D)]).toEqual([true, false, true, false, false]);
    expect([ruleOn(undefined, "pairOff"), ruleOn({}, "pairOff"), ruleOn({ pairOff: false }, "pairOff"), ruleOn({ pairOff: true }, "pairOff")]).toEqual([true, true, false, true]);
  });
  it("новичок один: рядом нет опытного той же должности в его часы; кейтеринг и другая должность не в счёт", () => {
    const staff = [{ id: "a", name: "Анна", pos: "waiter" }, { id: "n", name: "Ника", pos: "waiter", newbie: true }, { id: "m", name: "Мария", pos: "manager" },
      { id: "o", name: "Олег", pos: "waiter", newbie: true }];
    const plan = { a: { 1: "Д", 2: "У", 3: "К" }, n: { 1: "В", 2: "В", 3: "Д", 4: "Д" }, m: { 4: "Д" }, o: { 4: "Д" } };
    const ctx = { staff, plan, shiftOf };
    expect(aloneOn(1, ctx)).toEqual([]);                                    // День и Вечер пересекаются
    expect(aloneOn(2, ctx)).toEqual([{ id: "n", name: "Ника", pos: "waiter", k: "В" }]);   // утро с 9 до 15 — не рядом
    expect(aloneOn(3, ctx).map((x) => x.id)).toEqual(["n"]);                // у Анны кейтеринг
    expect(aloneOn(4, ctx).map((x) => x.id)).toEqual(["n", "o"]);           // два новичка и менеджер — все равно одни
    expect(aloneDays([1, 2, 3, 4], ctx).map((x) => x.d + x.id)).toEqual(["2n", "3n", "4n", "4o"]);
  });
  it("генератор: с правилом новичков одних нет, без правила — бывают", () => {
    const run = (rules) => {
      const cfg = { shifts: [D, V], dayShift: "Д", split: {}, need: { 1: { waiter: 2 }, 3: { waiter: 2 } },
        rules: { peakDows: [4, 5], highDows: [], closedDows: [], maxRow: 5, minOff: 2, minRest: 11, normMode: "floor", ...rules }, posRules: { waiter: { pattern: "even" } },
        staff: ["Анна", "Борис", "Ника", "Олег"].map((n, i) => ({ id: "s" + i, name: n, pos: "waiter", norm: 120, newbie: i >= 2 })) };
      const ctx = { rules: cfg.rules, days: {}, dates: {}, iso: (d) => "2026-12-" + String(d).padStart(2, "0"), dow, holName: () => null, levels: 2 };
      const res = generateSchedule({ cfg, DAYS: 31, dow, lvlOf: (d) => dayLevel(ctx, d), needOf: (d) => dayNeed(ctx, cfg, d), plan: {}, locks: {}, POS: [{ id: "waiter" }], mkey: "2026-12", seed: 7 });
      return { res, alone: aloneDays(ALL, { staff: cfg.staff, plan: res.plan, shiftOf }).length };
    };
    const on = run({}), off = run({ newbieAlone: false });
    expect([on.res.shortage, on.alone]).toEqual([0, 0]);
    expect(off.alone).toBeGreaterThan(0);
  });
});

describe("v220 · честный график", () => {
  const mk = (rules) => ({ shifts: [{ k: "У", name: "Утро", from: 11, to: 19 }, { k: "Д", name: "День", from: 12, to: 24 }, { k: "В", name: "Вечер", from: 16, to: 24 }], dayShift: "Д",
    need: { 1: { waiter: 3 }, 3: { waiter: 5 } }, split: { waiter: { "Д": 2, "У": 1 } },
    rules: { peakDows: [4, 5], highDows: [], closedDows: [], maxRow: 5, minOff: 2, minRest: 11, holidayPeak: true, normMode: "floor", ...rules }, posRules: { waiter: { pattern: "even" } },
    staff: ["Анна", "Борис", "Вера", "Глеб", "Дина", "Егор", "Жанна", "Зоя"].map((n, i) => ({ id: "s" + i, name: n, pos: "waiter", norm: i === 7 ? 90 : 165, newbie: i >= 6 })) });
  const run = (rules) => {
    const cfg = mk(rules), ctx = { rules: cfg.rules, days: {}, dates: {}, iso: (d) => "2026-12-" + String(d).padStart(2, "0"), dow, holName: () => null, levels: 2 };
    const res = generateSchedule({ cfg, DAYS: 31, dow, lvlOf: (d) => dayLevel(ctx, d), needOf: (d) => dayNeed(ctx, cfg, d), plan: {}, locks: {}, POS: [{ id: "waiter" }], mkey: "2026-12", seed: 3 });
    const sh = (k) => cfg.shifts.find((x) => x.k === k);
    const t = { staff: cfg.staff, plan: res.plan, shiftOf: sh, lvlOf: (d) => dayLevel(ctx, d), DAYS: 31 };
    return { res, t, singles: cfg.staff.map((s) => singleOffs(s, t)).reduce((a, b) => a + b, 0) };
  };
  it("пиковые дни поровну по доле от нормы: полставочнице меньше; без правила — неровно", () => {
    const on = run({}), off = run({ newbieAlone: false, peakFair: false, pairOff: false });
    expect(on.res.shortage).toBe(0);
    expect(peakUneven(on.t)).toEqual([]);
    const zoya = peakCounts(on.t).find((x) => x.name === "Зоя"), anna = peakCounts(on.t).find((x) => x.name === "Анна");
    expect(zoya.peak).toBeLessThan(anna.peak);
    expect(peakUneven(off.t).length).toBe(1);
  });
  it("выходные парами: одиночных выходных заметно меньше", () => {
    const on = run({}), off = run({ newbieAlone: false, peakFair: false, pairOff: false });
    expect(on.singles).toBeLessThan(off.singles / 1.5);
  });
  it("одиночный выходной: между двумя сменами; отпуск и закрытый день — не в счёт", () => {
    const plan = { a: { 1: "Д", 3: "Д", 4: "Д", 6: "Д", 7: "Д", 8: "", 9: "Д" } };
    const c = { plan, shiftOf, DAYS: 10 };
    expect(singleOffs({ id: "a" }, c)).toBe(3);                              // 2, 5, 8
    expect(singleOffs({ id: "a" }, { ...c, skip: (s, d) => d === 5 })).toBe(2);
  });
  it("пиковые дни неровно: по должности, с расхождением больше полутора смен", () => {
    const staff = [{ id: "a", name: "Анна", pos: "waiter" }, { id: "b", name: "Борис", pos: "waiter" }, { id: "m", name: "Мария", pos: "manager" }];
    const plan = { a: {}, b: {}, m: {} };
    // пиковые — 4, 5, 11, 12, 18, 19 (пт, сб)
    [4, 5, 11, 12, 18, 19].forEach((d) => { plan.a[d] = "Д"; });
    [1, 2, 3, 8, 9, 10].forEach((d) => { plan.b[d] = "Д"; });
    [1, 2, 3, 4].forEach((d) => { plan.m[d] = "Д"; });
    const t = { staff, plan, shiftOf, lvlOf: (d) => ([4, 5].includes(dow(d)) ? 3 : 1), DAYS: 31 };
    expect(peakCounts(t).map((x) => x.name + x.peak + "/" + x.work)).toEqual(["Анна6/6", "Борис0/6", "Мария1/4"]);
    expect(peakUneven(t)).toEqual([{ pos: "waiter", most: { name: "Анна", peak: 6 }, least: { name: "Борис", peak: 0 } }]);
  });
});

describe("v220 · экран графика", () => {
  const S = rd("ui/schedule.jsx");
  it("правила по умолчанию и переключатели в «Правилах смен»", () => {
    expect(S).toContain("newbieAlone:true, peakFair:true, pairOff:true,");
    expect(S).toContain('<div data-team-rules="" style={{ display:"flex", flexDirection:"column", gap:8 }}>');
    for (const s of ['"Новичок не один"', '"Пиковые дни поровну"', '"Выходные парами"', 'attrs={{ "data-team-rule": k, "aria-pressed": ruleOn(cfg.rules, k) }}',
      "onClick={() => patch(c => { c.rules[k] = !ruleOn(c.rules, k); })}>{t}</Pill>"]) expect(S, s).toContain(s);
  });
  it("«Новичок» у сотрудника; в строке — «· новичок»; в листе дня — «нов.» и предупреждение", () => {
    expect(S).toContain('attrs={{ "data-emp-newbie": sf.id, "aria-pressed": !!sf.newbie }}');
    expect(S).toContain("onClick={() => patch(c => { if (c.staff[i].newbie) delete c.staff[i].newbie; else c.staff[i].newbie = true; })}>Новичок</Pill>");
    expect(S).toContain('{posName(sf.pos)} · {sf.norm} ч{sf.newbie ? " · новичок" : ""}');
    expect(S).toContain('<span data-day-newbie="" title="новичок"');
    expect(S).toContain("{shortName(x.name)}, новичок, один: рядом нет опытного ({posName(x.pos).toLowerCase()}). Поставь к нему кого-то из опытных.");
  });
  it("«Требует внимания» — «Новичок один в смене»; «Проверка» — новичок один, пиковые дни неровно, выходные без пары", () => {
    expect(S).toContain('data-attn-row="alone"');
    expect(S).toContain("Новичок один в смене: {shortName(x.name)}");
    expect(S).toContain("новичок, один в смене: рядом нет опытного");
    expect(S).toContain("Пиковые дни неровно (${posName(x.pos).toLowerCase()}): у ${shortName(x.most.name)} ${x.most.peak}, у ${shortName(x.least.name)} ${x.least.peak}");
    expect(S).toContain('одним днём, без пары`);');
  });
});
