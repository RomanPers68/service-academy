// v135 (Доп. 448): «разжижает» вместо «разрежет». Владелец (03.11, снимок «Практики ситуаций» «Продукта», «собери
// правило»): «Нашел неверную формулировку. Вместо «разжижает», «разрежет»». data/modules-seasonal.js — все пять мест, где
// жир «разрезали»; e2e — tools/claude/e2e-v135.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SEASONAL_MODULES } from "../data/modules-seasonal.js";

const rd = (f) => readFileSync(f, "utf8");
const prod = SEASONAL_MODULES.find((m) => m.id === "s-prod");
const lesson = (id) => prod.lessons.find((l) => l.id === id);

describe("v135: «разжижает» вместо «разрежет» (раздел «Продукт: как знать и продавать меню»)", () => {
  it("урок «Логика сочетаний»: «Они «разжижают» жир.»", () => {
    expect(lesson("s-prod-5").content).toContain("к жирной рыбе — что-то кислотное. Они «разжижают» жир.");
  });
  it("«Практика ситуаций»: вариант «он «разжижает» жир» (он и верный), подсказки к нему и к стейку", () => {
    const sit = lesson("s-prod-p").situations;
    const rule = sit.find((s) => s.genre === "complete" && /К жирному насыщенному блюду/.test(s.start));
    expect(rule.options[rule.correct]).toBe("кислотный или танинный: он «разжижает» жир");
    expect(rule.fail).toContain("Жир «разжижают» кислотность и танин.");
    expect(sit.find((s) => /жирный стейк/.test(s.scene || "")).fail).toContain("жир «разжижают» танин и кислотность");
  });
  it("«Тест: продукт и меню»: верный ответ — «Кислотность и танины «разжижают» жир»", () => {
    const q = lesson("s-prod-q").questions.find((x) => /Базовый принцип сочетаний с жирным блюдом/.test(x.q));
    expect(q.options[q.correct]).toBe("Кислотность и танины «разжижают» жир");
  });
  it("«разрезают» и «разрежет» нигде в программе не осталось; метка, e2e, CHANGES", () => {
    for (const f of ["data/modules-seasonal.js", "data/modules-core.js", "data/modules-bar.js", "data/modules-manager.js", "data/modules-service_manager.js", "data/modules-spg.js"]) {
      expect(rd(f), f).not.toMatch(/«разреза|разреж/);
    }
    expect(Number((rd("ui/menu-trainer.jsx").match(/· сборка v(\d+)<\/span>/) || [])[1])).toBeGreaterThanOrEqual(135);
    expect(rd("tools/claude/e2e-v135.mjs")).toContain('ok("PRACTICE: «собери правило» — «кислотный или танинный: он «разжижает» жир»"');
    expect(rd("CHANGES.md")).toContain("# Дополнение 448 — «разжижает» вместо «разрежет» (v135)");
  });
});
