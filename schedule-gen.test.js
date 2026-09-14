// Генератор графика: объяснение отказов (Доп. 247) — те же правила, что применяются.
import { describe, it, expect } from "vitest";
import { generateSchedule } from "../lib/schedule-gen";

const DAYS = 30;
const dow = (d) => (d + 2) % 7;                       // произвольная привязка дней недели
const lvlOf = () => 1;
const POS = [{ id: "waiter" }];
const base = {
  hours: Array.from({ length: 7 }, () => [12, 24]),
  shifts: [{ k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }],
  need: { 1: { waiter: 2 } }, split: {}, rules: { peakDows: [], highDows: [], maxRow: 5, minOff: 2, minRest: 11, normMode: "floor" },
  posRules: { waiter: { pattern: "even" } }, dayShift: "Д",
  staff: [
    { id: "a", name: "Аня", pos: "waiter", norm: 160, off: [] },
    { id: "b", name: "Боря", pos: "waiter", norm: 160, off: [] },
  ],
};
const run = (cfg, extra = {}) => generateSchedule({ cfg, DAYS, dow, lvlOf, plan: {}, locks: {}, POS, mkey: "2026-09", restarts: 2, ...extra });

describe("генератор графика", () => {
  it("расставляет смены и возвращает объяснялку отказов", () => {
    const res = run(base);
    expect(!!res.plan).toBe(true);
    expect(typeof res.whyNot).toBe("function");
  });
  it("отпуск, «не смогу», выходной дня недели и смена не по времени объясняются словами", () => {
    const cfg = { ...base, staff: [{ ...base.staff[0], vac: [5, 9, "2026-09"], off: [0] }, base.staff[1]] };
    const res = run(cfg, { hardOff: { a: [11] } });   // 11-е — не воскресенье при этой привязке
    const why = res.whyNot, empty = { a: {}, b: {} };
    expect(why(empty, cfg.staff[0], 7, "Д")).toMatch(/отпуск/i);
    expect(why(empty, cfg.staff[0], 11, "Д")).toMatch(/не смогу/i);
    const sunday = (() => { for (let d = 1; d <= DAYS; d++) if (dow(d) === 0 && !(d >= 5 && d <= 9)) return d; })();
    expect(why(empty, cfg.staff[0], sunday, "Д")).toMatch(/выходной/i);
    const late = { ...cfg, staff: [{ ...cfg.staff[0], vac: null, notBefore: 16 }, cfg.staff[1]] };
    expect(run(late).whyNot(empty, late.staff[0], 3, "Д")).toMatch(/только с 16/);
  });
  it("отдых между сменами и «подряд» объясняются числами из правил", () => {
    const strict = { ...base, rules: { ...base.rules, minRest: 14 } };
    const pm = { a: { 3: "В" }, b: {} };                 // вчера вечер до 24:00, сегодня день с 12:00 — 12 ч
    expect(run(strict).whyNot(pm, base.staff[0], 4, "Д")).toMatch(/отдых/i);
    const row = { a: { 1: "Д", 2: "Д", 3: "Д", 4: "Д", 5: "Д" }, b: {} };
    expect(run(base).whyNot(row, base.staff[0], 6, "Д")).toMatch(/подряд/);
  });
});

describe("ремонт обменом (Доп. 249)", () => {
  // Тесный месяц: людей ровно столько, сколько нужно, плюс жёсткие запреты —
  // жадный проход оставляет дыры, обмен днями часть из них закрывает.
  const tight = {
    hours: Array.from({ length: 7 }, () => [12, 24]),
    shifts: [{ k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }],
    need: { 1: { waiter: 3 } }, split: {}, rules: { peakDows: [], highDows: [], maxRow: 4, minOff: 2, minRest: 11, normMode: "floor" },
    posRules: { waiter: { pattern: "even" } }, dayShift: "Д",
    staff: ["Аня", "Боря", "Вера", "Гена", "Дима"].map((n, i) => ({ id: "s" + i, name: n, pos: "waiter", norm: 165, off: [] })),
  };
  const hardOff = { s0: [7, 8, 14, 15], s1: [7, 8], s2: [14, 15] };
  it("с обменом дыр не больше, чем без него", () => {
    const args = { cfg: tight, DAYS: 30, dow: (d) => (d + 2) % 7, lvlOf: () => 1, plan: {}, locks: {}, POS: [{ id: "waiter" }], mkey: "2026-09", hardOff, restarts: 4 };
    const withSwap = generateSchedule(args);
    const noRepair = generateSchedule({ ...args, repairSweeps: 0 });
    expect(withSwap.shortage).toBeLessThanOrEqual(noRepair.shortage);
  });
  it("обмен не ломает правила: ни у кого не больше maxRow смен подряд", () => {
    const res = generateSchedule({ cfg: tight, DAYS: 30, dow: (d) => (d + 2) % 7, lvlOf: () => 1, plan: {}, locks: {}, POS: [{ id: "waiter" }], mkey: "2026-09", hardOff, restarts: 4 });
    for (const s of tight.staff) {
      let run = 0, max = 0;
      for (let d = 1; d <= 30; d++) { if (res.plan[s.id][d]) { run++; max = Math.max(max, run); } else run = 0; }
      expect(max).toBeLessThanOrEqual(tight.rules.maxRow);
      for (const d of (hardOff[s.id] || [])) expect(!!res.plan[s.id][d]).toBe(false);
    }
  });
});
