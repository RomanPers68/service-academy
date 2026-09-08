// Сборка руками: сценарии из спеков, проверка действий, мастерство.
import { describe, it, expect } from "vitest";
import { buildScenario, checkAction, recordRun, tierOf, dailyPick } from "../lib/bar-lab";
import { COCKTAILS } from "../data/cocktails";

describe("bar lab", () => {
  it("у каждого из 56 коктейлей есть сценарий: бокал первым, гарниш последним, все ингредиенты внутри", () => {
    for (const c of COCKTAILS) {
      const sc = buildScenario(c, COCKTAILS);
      expect(sc.steps[0].kind).toBe("glass");
      if (c.garnish && c.garnish !== "none") expect(sc.steps[sc.steps.length - 1].kind).toBe("garnish");
      const names = sc.steps.filter(s => s.kind === "ing").map(s => s.name);
      for (const i of c.ing) expect(names).toContain(i[0]);
      expect(sc.station.ings.length).toBeGreaterThanOrEqual(c.ing.length + 1);
      expect(sc.station.glasses).toContain(c.glass);
    }
  });
  it("Негрони: правильная последовательность проходит, лишний ингредиент и ранний гарниш — нет", () => {
    const c = COCKTAILS.find(x => x.id === "negroni"); const sc = buildScenario(c, COCKTAILS);
    let done = [];
    const go = (a) => { const r = checkAction(sc, done, a); if (r.ok) done = r.doneIdx; return r; };
    expect(go({ kind: "garnish", id: "peel" }).ok).toBe(false);
    expect(go({ kind: "glass", id: "rocks" }).ok).toBe(true);
    expect(go({ kind: "ing", name: "Кампари", amount: 30 }).ok).toBe(true);    // порядок внутри фазы свободный
    expect(go({ kind: "ing", name: "Джин", amount: 45 }).ok).toBe(false);       // не тот объём
    expect(go({ kind: "ing", name: "Джин", amount: 30 }).ok).toBe(true);
    expect(go({ kind: "ing", name: "Лимонный сок", amount: 30 }).ok).toBe(false); // чужой
    expect(go({ kind: "ing", name: "Красный вермут", amount: 30 }).ok).toBe(true);
    expect(go({ kind: "tool", id: "stir" }).ok).toBe(false); // сначала лёд в стакан
    expect(go({ kind: "ice", id: "cube" }).ok).toBe(true);
    expect(go({ kind: "tool", id: "stir" }).ok).toBe(true);
    expect(go({ kind: "ice", id: "cube" }).ok).toBe(true);
    expect(go({ kind: "tool", id: "strain" }).ok).toBe(true);
    const last = go({ kind: "garnish", id: "peel" });
    expect(last.ok && last.done).toBe(true);
  });
  it("мастерство: подсказки → 1, по памяти → 2, три чистых подряд → 3, ошибка сбрасывает серию", () => {
    let m = recordRun({}, "x", "hint", true); expect(m.x.level).toBe(1);
    m = recordRun(m, "x", "memory", true); expect(m.x.level).toBe(2);
    m = recordRun(m, "x", "memory", true); m = recordRun(m, "x", "memory", true); expect(m.x.level).toBe(3);
    m = recordRun(m, "x", "memory", false); expect(m.x.streak).toBe(0); expect(m.x.level).toBe(3);
  });
  it("лестница и коктейль дня", () => {
    expect(tierOf({ ing: [1, 2] })).toBe(1); expect(tierOf({ ing: [1, 2, 3, 4] })).toBe(2); expect(tierOf({ ing: [1, 2, 3, 4, 5] })).toBe(3);
    expect(dailyPick(COCKTAILS, new Date(2026, 8, 9))).toBe(dailyPick(COCKTAILS, new Date(2026, 8, 9)));
    expect(dailyPick(COCKTAILS, new Date(2026, 8, 9))).not.toBe(dailyPick(COCKTAILS, new Date(2026, 8, 10)));
  });
});
