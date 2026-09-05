// Викторина по меню: вопросы о главных ингредиентах и аллергенах, без спорных вариантов.
import { describe, it, expect } from "vitest";
import { buildMenuQuiz, keyIngredients, ingName } from "../lib/menu-quiz";

const dishes = [
  { id: 1, name: "Салат с креветкой", cat: "Салаты", ingredients: ["креветка", "салат ромейн", "медово-горчичная заправка", "томаты черри", "огурец свежий", "водоросли нори"], allergens: ["Моллюски и ракообразные", "Кунжут"] },
  { id: 2, name: "Салат с крабом", cat: "Салаты", ingredients: ["краб стригун", "огурец", "авокадо", "соус понзу"], allergens: ["Моллюски и ракообразные", "Соя", "Яйца", "Молоко"] },
  { id: 3, name: "Том ям", cat: "Супы", ingredients: ["креветки", "кокосовое молоко", "лемонграсс", "грибы"], allergens: ["Моллюски и ракообразные", "Рыба"] },
  { id: 4, name: "Стейк рибай", cat: "Горячие блюда", ingredients: ["говядина", "соль", "розмарин", "сливочное масло"], allergens: ["Молоко"] },
  { id: 5, name: "Тирамису", cat: "Десерты", ingredients: ["маскарпоне", "савоярди", "эспрессо", "какао"], allergens: ["Глютен", "Молоко", "Яйца"] },
  { id: 6, name: "Паштет из осьминога", cat: "Холодные закуски", ingredients: ["Паштет из осьминога (осьминог, лук, сливки)", "гречневые чипсы", "маринованная брусника"], allergens: ["Моллюски и ракообразные", "Молоко"] },
  { id: 7, name: "Сельдь олюторская", cat: "Холодные закуски", ingredients: ["сельдь", "картофель", "лук красный"], allergens: ["Рыба"] },
];

describe("menu quiz", () => {
  it("имя ингредиента без скобок; общие слова не считаются главными", () => {
    expect(ingName("Паштет из осьминога (осьминог, лук, сливки)")).toBe("Паштет из осьминога");
    expect(keyIngredients(dishes[3])).toEqual(["говядина", "розмарин"]);
    expect(keyIngredients(dishes[5])[0]).toBe("осьминог");
  });
  it("если главное — в названии, спрашиваем про гарнир, а не очевидное", () => {
    for (let k = 0; k < 10; k++) for (const q of buildMenuQuiz(dishes)) {
      if (q.dish === 7 && q.type === "A") { expect(q.q.startsWith("Что подаём")).toBe(true); expect(q.options[q.correct]).toBe("картофель"); }
      if (q.dish === 7) expect(q.type).not.toBe("B");
    }
  });
  it("правильный ответ всегда один и присутствует; неправильные ингредиенты не встречаются в блюде", () => {
    for (let k = 0; k < 20; k++) {
      const qs = buildMenuQuiz(dishes, { total: 10 });
      expect(qs.length > 0).toBe(true);
      for (const q of qs) {
        expect(q.options.length).toBe(4);
        expect(new Set(q.options.map(o => o.toLowerCase())).size).toBe(4);
        expect(q.correct >= 0 && q.correct < 4).toBe(true);
        if (q.type === "A") {
          const d = dishes.find(x => x.id === q.dish); const text = (d.ingredients.join(" ") + " " + d.name).toLowerCase();
          q.options.forEach((o, i) => { if (i !== q.correct) { const words = o.toLowerCase().split(/[^а-яa-zё0-9]+/).filter(w => w.length >= 4); expect(words.some(w => text.includes(w.slice(0, Math.max(4, w.length - 2))))).toBe(false); } });
          expect(q.options[q.correct].toLowerCase()).not.toBe(d.name.toLowerCase());
        }
        if (q.type === "C") {
          const d = dishes.find(x => x.id === q.dish);
          expect(d.allergens.includes(q.options[q.correct])).toBe(false);
        }
      }
      // одно блюдо — не чаще одного раза
      const ids = qs.map(q => q.dish); expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it("блюда в стопе и архиве в викторину не попадают", () => {
    const qs = buildMenuQuiz(dishes.map((d, i) => i === 0 ? { ...d, stop: { since: 1 } } : d));
    expect(qs.some(q => q.dish === 1)).toBe(false);
  });
});
