// Индекс глав для «главы дня» совпадает со справочником (лёгкий старт).
// Упал — значит, главы справочника поменялись: запусти node scripts/gen-reference-index.mjs
import { describe, it, expect } from "vitest";
import * as REF from "../data/reference";
import { REFERENCE_DAILY_INDEX } from "../data/reference-index";
import { buildReferenceIndex } from "../lib/reference-index-build";
import { referenceDailyTask } from "../ui/reference-daily";

describe("reference index", () => {
  it("индекс глав совпадает со справочником", () => {
    expect(JSON.stringify(REFERENCE_DAILY_INDEX)).toBe(JSON.stringify(buildReferenceIndex(REF)));
  });
  it("глава дня — та же, что выбиралась по полному справочнику", () => {
    // прежний пул: все главы, кроме глав руководителей из «Гида по приложению»
    const pool = [...REF.REFERENCE_COURSE.lessons, ...REF.REFERENCE_WINE_COURSE.lessons, ...REF.REFERENCE_COFFEE_COURSE.lessons,
      ...REF.REFERENCE_BAR_COURSE.lessons, ...REF.REFERENCE_APP_COURSE.lessons.filter(l => !l.leaderOnly)];
    for (let seed = 0; seed < pool.length * 2; seed++) {
      expect(referenceDailyTask(seed).id).toBe(pool[seed % pool.length].id);
    }
    const t = referenceDailyTask(3, ["Подача вина и температура"]);
    expect(!!t && !!t.id && !!t.course).toBe(true);
  });
});
