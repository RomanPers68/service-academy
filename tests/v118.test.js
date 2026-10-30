// v118 (Доп. 431): две старые e2e-проверки падали в последний день месяца. В общем графике тестов (buildFx) предложение
// смены ставилось «через пять дней, но не дальше конца месяца»: 31-го это был сам сегодняшний день, и у Анны строкой ниже
// стиралась сегодняшняя смена — e2e-v59 QUEST «в день смены» видел выходной, e2e-v56 BEFORE не находил «Дальше» на
// «сейчас». Теперь в последний день месяца предложение — вчера, сегодняшняя смена Анны на месте; в остальные дни — как было.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const FIX = "  const offerDay = T0 < DAYS ? Math.min(DAYS, T0 + 5) : T0 - 1;";
const OLD = "  const offerDay = Math.min(DAYS, T0 + 5);";
// тот же расчёт, что в наборах: день предложения при сегодняшнем T0 и числе дней в месяце
const offerOf = (T0, DAYS) => (T0 < DAYS ? Math.min(DAYS, T0 + 5) : T0 - 1);

describe("v118: день предложения смены в общем графике e2e не совпадает с сегодняшним", () => {
  it("e2e-v56 и e2e-v59 (в общем прогоне, там важна сегодняшняя смена Анны): новый расчёт, прежнего нет", () => {
    for (const v of ["56", "59"]) {
      const s = rd(`tools/claude/e2e-v${v}.mjs`);
      expect(s, v).toContain(FIX);
      expect(s, v).not.toContain(OLD);
      // строкой ниже — по-прежнему: в день предложения у Анны пусто, у Ксении — дневная
      expect(s, v).toContain('plan[9][offerDay] = ""; plan[10] = { ...(plan[10] || {}), [offerDay]: "Д" };');
    }
  });
  it("расчёт: в любой день любого месяца предложение не на сегодня; до последнего дня — как раньше", () => {
    for (const DAYS of [28, 29, 30, 31]) for (let T0 = 1; T0 <= DAYS; T0++) {
      const d = offerOf(T0, DAYS);
      expect(d, T0 + "/" + DAYS).not.toBe(T0);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(DAYS);
      if (T0 < DAYS) expect(d).toBe(Math.min(DAYS, T0 + 5));
    }
  });
  it("остальные наборы с тем же графиком не тронуты: сегодняшняя смена Анны там не важна (e2e-v46 и v47 к тому же проверяют само предложение)", () => {
    for (const v of ["46", "47", "48", "49", "50", "57", "58", "61", "64"]) expect(rd(`tools/claude/e2e-v${v}.mjs`), v).toContain(OLD);
  });
  it("метка — v118", () => {
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v118</span>");
  });
});
