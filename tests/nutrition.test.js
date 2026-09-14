// КБЖУ по названию (Доп. 264): выгрузка «БЖУК Камчатка» ↔ названия меню.
import { describe, it, expect } from "vitest";
import { nutritionOf, nutritionLine, dishNutrition } from "../lib/nutrition";
import { NUTRITION } from "../data/nutrition";

describe("КБЖУ по названию", () => {
  it("таблица цела: у всех позиций есть выход и разумные числа", () => {
    expect(NUTRITION.length).toBeGreaterThan(100);
    for (const r of NUTRITION) {
      expect(typeof r.n).toBe("string");
      expect(r.kcal >= 0 && r.kcal < 3000).toBe(true);
      expect(r.p >= 0 && r.f >= 0 && r.c >= 0).toBe(true);
    }
  });
  it("точные названия находятся как есть", () => {
    const a = nutritionOf("Ассорти паштетов из морепродуктов");
    expect(a && a.kcal).toBe(212);
    expect(nutritionOf("Устрица Стелла Марис").out).toBe(60);
  });
  it("расхождения в названии не мешают: число, тире, служебные хвосты, лишние слова", () => {
    expect(nutritionOf("Креветка темпура").n).toMatch(/Креветк. темпура/);   // множественное ↔ единственное
    expect(nutritionOf("Тыквенный крем-суп с крабом").kcal).toBe(158);        // дефис
    expect(nutritionOf("Пончик с крабом").kcal).toBe(305);                    // хвост «ОКЕАН БЛЮДО» снят
    expect(nutritionOf("Кальмар в азиатском стиле").n).toMatch(/кальмара в азиатском стиле/);
  });
  it("чужого не выдумывает", () => {
    expect(nutritionOf("Мохито")).toBe(null);
    expect(nutritionOf("Рибай стейк")).toBe(null);
    expect(nutritionOf("")).toBe(null);
    expect(nutritionOf("Суп")).toBe(null);            // слишком общее — несколько кандидатов вровень
    expect(nutritionOf("Уха")).toBe(null);            // одно слово — только точное совпадение
    expect(nutritionOf("Чай")).toBe(null);
    expect(nutritionOf("Стейк")).toBe(null);
    expect(nutritionOf("   ")).toBe(null);
  });
  it("строка для карточки читается", () => {
    expect(nutritionLine(nutritionOf("Пончик с крабом"))).toMatch(/^180 г · 305 ккал · Б .* · Ж .* · У /);
    expect(nutritionLine(null)).toBe("");
  });
});

describe("свои цифры менеджера (Доп. 266)", () => {
  it("вписанные вручную важнее ведомости", () => {
    const d = { name: "Пончик с крабом", kcal: 410, out: 200, prot: 14, fat: 22, carb: 30 };
    const n = dishNutrition(d);
    expect(n.kcal).toBe(410); expect(n.own).toBe(true);
    expect(nutritionLine(n)).toMatch(/^200 г · 410 ккал/);
  });
  it("без своих цифр берётся ведомость, а мусор игнорируется", () => {
    expect(dishNutrition({ name: "Пончик с крабом" }).kcal).toBe(305);
    expect(dishNutrition({ name: "Пончик с крабом", kcal: "" }).kcal).toBe(305);
    expect(dishNutrition({ name: "Пончик с крабом", kcal: "не знаю" }).kcal).toBe(305);
    expect(dishNutrition({ name: "Пончик с крабом", kcal: 0 }).kcal).toBe(305);
    expect(dishNutrition({ name: "Своё блюдо", kcal: "320,5" }).kcal).toBe(321);   // запятая как в жизни
    expect(dishNutrition({ name: "Чужое блюдо" })).toBe(null);
    expect(dishNutrition(null)).toBe(null);
  });
});

