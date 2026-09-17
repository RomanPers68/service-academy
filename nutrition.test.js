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
      // порция должна сходиться со «100 г», умноженными на выход
      if (r.out && r.k100) expect(Math.abs(r.kcal - r.k100 * r.out / 100) / Math.max(1, r.kcal) < 0.15).toBe(true);
      // штучные позиции: выход в штуках, «на 100 г» ведомость не даёт — не выдумываем
      if (r.unit) { expect(r.out).toBe(0); expect(r.k100 === undefined).toBe(true); }
      else expect(r.out > 0).toBe(true);
    }
  });
  it("точные названия находятся как есть", () => {
    const a = nutritionOf("Ассорти паштетов из морепродуктов");
    expect(a.kcal).toBe(446);          // на порцию 210 г
    expect(a.k100).toBe(212);          // и на 100 г — как в ведомости
    expect(nutritionOf("Устрица Стелла Марис").out).toBe(60);
  });
  it("расхождения в названии не мешают: число, тире, служебные хвосты, лишние слова", () => {
    expect(nutritionOf("Креветка темпура").n).toMatch(/Креветк. темпура/);   // множественное ↔ единственное
    expect(nutritionOf("Тыквенный крем-суп с крабом").k100).toBe(158);       // дефис
    expect(nutritionOf("Пончик с крабом").kcal).toBe(550);                    // хвост «ОКЕАН БЛЮДО» снят; 305 ккал — это на 100 г
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
  it("штучные позиции подписаны штукой, а не граммами", () => {
    const o = nutritionOf("Императорская устрица");
    expect(o.unit).toBe("1 шт"); expect(o.kcal).toBe(53);
    expect(nutritionLine(o)).toMatch(/^1 шт · 53 ккал/);
  });
  it("строка для карточки читается", () => {
    expect(nutritionLine(nutritionOf("Пончик с крабом"))).toMatch(/^180 г · 550 ккал · Б .* · Ж .* · У /);
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
    expect(dishNutrition({ name: "Пончик с крабом" }).kcal).toBe(550);
    expect(dishNutrition({ name: "Пончик с крабом", kcal: "" }).kcal).toBe(550);
    expect(dishNutrition({ name: "Пончик с крабом", kcal: "не знаю" }).kcal).toBe(550);
    expect(dishNutrition({ name: "Пончик с крабом", kcal: 0 }).kcal).toBe(550);
    expect(dishNutrition({ name: "Своё блюдо", kcal: "320,5" }).kcal).toBe(321);   // запятая как в жизни
    expect(dishNutrition({ name: "Чужое блюдо" })).toBe(null);
    expect(dishNutrition(null)).toBe(null);
  });
});

describe("названия меню «Два моря, Океан» (Доп. 275)", () => {
  it("находит блюда, названные в ведомости иначе", () => {
    const pairs = [
      ["Брауни", "Шоколадный брауни"],
      ["Анадара", 'Сахалинская мактра "Анадара"'],
      ["Краб стригун", "Живой краб-стригун"],
      ["Куриные нагетсы", "Куриные наггетсы с картофелем фри и кетчупом"],   // две «г»
      ["Пельмени с лосятиной", "Пельмени из лося"],
      ["Запеченый краб стригун в панцире под сырной корочкой", "Запеченный крабстригун в панцире под пикантной сырной корочкой"], // слипшиеся слова
      ["Салат с лососем", "Салат с подкопченным лососем"],
      ["Устрица Хасанская", "Хасанская устрица"],                            // порядок слов
      ["Мороженое иван-чай", "Мороженое ИВАН ЧАЙ"],
    ];
    for (const [q, expected] of pairs) { const r = nutritionOf(q); expect(!!r).toBe(true); expect(r.n).toBe(expected); }
  });
  it("не путает похожие блюда и общие слова", () => {
    expect(nutritionOf("Краб стригун").n).not.toMatch(/Салат/);      // не «Салат с крабом стригуном»
    // Папоротника два: с луком (120 г) и острый азиатский (200 г) — не путаются
    expect(nutritionOf("Жареный папоротник орляк с луком").kcal).toBe(89);
    expect(nutritionOf("Папоротник орляк в азиатском стиле").kcal).toBe(649);
    expect(nutritionOf("Камчатский краб").n).toBe("Живой камчатский краб");   // решено владельцем: в баре — живой
    expect(nutritionOf("Камчатский краб").kcal).toBe(155);
    for (const w of ["Суп", "Салат", "Стейк", "Уха", "Чай"]) expect(nutritionOf(w)).toBe(null);
    expect(nutritionOf("Салат с лососем").n).not.toMatch(/лосят|лося/);
  });
});

