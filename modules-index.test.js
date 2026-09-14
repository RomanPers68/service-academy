// Индекс уроков совпадает с данными ролей; id уроков уникальны.
import { describe, it, expect } from "vitest";
import { MODULES_INDEX } from "../data/modules-index";
import { CORE_MODULES } from "../data/modules-core";
import { BAR_MODULES } from "../data/modules-bar";
import { SEASONAL_MODULES } from "../data/modules-seasonal";
import { MANAGER_MODULES } from "../data/modules-manager";
import { SERVICE_MANAGER_MODULES } from "../data/modules-service_manager";
import { SPG_MODULES } from "../data/modules-spg";

const ROLES = { core: CORE_MODULES, bar: BAR_MODULES, seasonal: SEASONAL_MODULES, manager: MANAGER_MODULES, service_manager: SERVICE_MANAGER_MODULES, spg: SPG_MODULES };

describe("modules-index", () => {
  it("содержит все роли", () => {
    expect(Object.keys(MODULES_INDEX).sort()).toEqual(Object.keys(ROLES).sort());
  });
  for (const [role, mods] of Object.entries(ROLES)) {
    it(`роль ${role}: индекс = данные (id, заголовок, тип)`, () => {
      const idx = MODULES_INDEX[role];
      expect(idx.length).toBe(mods.length);
      mods.forEach((m, i) => {
        expect(idx[i].id).toBe(m.id);
        expect(idx[i].lessons.map(l => l.id)).toEqual((m.lessons || []).map(l => l.id));
        expect(idx[i].lessons.map(l => l.type)).toEqual((m.lessons || []).map(l => l.type));
      });
    });
  }
  it("id уроков уникальны во всех ролях", () => {
    const ids = Object.values(ROLES).flat().flatMap(m => (m.lessons || []).map(l => l.id));
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    expect(dup).toEqual([]);
  });
  it("у каждого квиза есть вопросы с правильным ответом в диапазоне", () => {
    for (const m of Object.values(ROLES).flat()) for (const l of m.lessons || []) {
      if (l.type !== "quiz") continue;
      expect(Array.isArray(l.questions) && l.questions.length > 0).toBe(true);
      for (const q of l.questions) expect(q.correct >= 0 && q.correct < q.options.length).toBe(true);
    }
  });
});
