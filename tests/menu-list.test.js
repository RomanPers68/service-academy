// Меню по разделам: порядок разделов и поиск.
import { describe, it, expect } from "vitest";

import { groupByCat, CAT_ORDER, dishMatches, suggestAllergens } from "../lib/menu-sections";

describe("menu list", () => {
  it("разделы идут в каноническом порядке, неизвестные — после, без раздела — в конце", () => {
    const g = groupByCat([
      { id: 1, name: "Тирамису", cat: "Десерты" },
      { id: 2, name: "Том ям", cat: "Супы" },
      { id: 3, name: "Хумус", cat: "Мезе" },
      { id: 4, name: "Вода", cat: "" },
      { id: 5, name: "Цезарь", cat: "Салаты" },
    ]);
    expect(g.map(x => x.cat)).toEqual(["Салаты", "Супы", "Десерты", "Мезе", "Без раздела"]);
    expect(CAT_ORDER.indexOf("Салаты") < CAT_ORDER.indexOf("Супы")).toBe(true);
  });
  it("поиск по составу и аллергенам, без учёта ё/регистра", () => {
    const d = { name: "Том ям", ingredients: ["Креветки", "лемонграсс"], allergens: ["Моллюски и ракообразные"] };
    expect(dishMatches(d, "креветк")).toBe(true);
    expect(dishMatches(d, "МОЛЛЮСК")).toBe(true);
    expect(dishMatches(d, "лосось")).toBe(false);
  });
  it("подсказки аллергенов по составу, уже выбранные не повторяются", () => {
    const h = suggestAllergens(["Креветки тигровые", "сливки", "мука"], ["Молоко"]);
    expect(h.map(x => x.allergen)).toEqual(["Глютен", "Моллюски и ракообразные"]);
    expect(suggestAllergens(["огурец", "помидор"]).length).toBe(0);
  });
});
