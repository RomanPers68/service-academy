// Контекст ассистента: находит коктейль и блюдо, укладывается в лимит сервера.
import { describe, it, expect, beforeAll } from "vitest";
import { withRefContext, cocktailAssistantContext, menuAssistantContext, dishesOf } from "../lib/reference-context";

const store = {};
beforeAll(() => {
  globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
  store.sa_menu_shared = JSON.stringify({ "Океан": [{ id: "srv1", name: "Том ям с креветками", cat: "Супы", ingredients: ["креветки"], allergens: ["Моллюски и ракообразные"] }] });
});

describe("reference-context", () => {
  const profile = { restaurant: "Океан", position: "waiter" };

  it("коктейль по названию: спек и id в карточке", () => {
    const ctx = cocktailAssistantContext("Как сделать негрони?");
    expect(ctx).toMatch(/Негрони/);
    expect(ctx).toMatch(/\[id: /);
    expect(ctx).toMatch(/Спек:/);
  });
  it("коктейль по паре: «что налить к тако»", () => {
    expect(cocktailAssistantContext("Что налить к тако?")).toBeTruthy();
  });
  it("меню команды с сервера видно ассистенту, короткое название находится", () => {
    expect(dishesOf("Океан").some(d => d.id === "srv1")).toBe(true);
    expect(menuAssistantContext("Есть ли в том яме морепродукты?", "Океан")).toMatch(/Том ям/);
  });
  it("обогащённое сообщение ≤ 2000 символов (лимит сервера ai-chat)", () => {
    const out = withRefContext([{ role: "user", content: "Расскажи про негрони, том ям и как встречать гостя у входа" }], profile, null);
    expect(out[0].content.length).toBeLessThanOrEqual(2000);
  });
  it("нейтральный вопрос не обогащается", () => {
    const msgs = [{ role: "user", content: "привет" }];
    const out = withRefContext(msgs, profile, null);
    expect(out[0].content.startsWith("привет")).toBe(true);
    expect(out[0].content).not.toMatch(/\[Данные из разделов/);
  });
});
