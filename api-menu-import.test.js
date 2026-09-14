// Серверная функция импорта меню: перебор моделей, разбор JSON, санитизация аллергенов.
import { describe, it, expect, beforeEach } from "vitest";

const mkRes = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };

describe("api/menu-import", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes("whoami")) return { ok: true, status: 200, json: async () => ({ ok: true, employee: { name: "Т" } }) };
      const body = JSON.parse(opts.body);
      if (body.model === "anthropic/claude-sonnet-4.6") return { ok: false, status: 500, json: async () => ({ error: { code: 500, message: "down" } }) };
      return { ok: true, status: 200, json: async () => ({ model: body.model, choices: [{ message: { content:
        "```json\n[{\"name\":\"Том ям\",\"cat\":\"Супы\",\"ingredients\":[\"креветки\"],\"allergens\":[\"Моллюски и ракообразные\",\"Арахис\"]},{\"name\":\"\"}]\n```" } }] }) };
    };
  });
  it("падение основной модели → запасная; JSON вытащен из ```; лишние аллергены отфильтрованы", async () => {
    const { default: handler } = await import("../api/menu-import.js");
    const res = mkRes();
    await handler({ method: "POST", body: { pdfBase64: "JVBERi0xLjQK", token: "t1" } }, res);
    expect(res.code).toBe(200);
    expect(res.body.dishes.length).toBe(1);
    expect(res.body.dishes[0].allergens).toEqual(["Моллюски и ракообразные"]);
    expect(res.body.model).toBe("google/gemini-2.5-flash");
  });
  it("без ключа — понятная ошибка 500", async () => {
    delete process.env.OPENROUTER_API_KEY; delete process.env.ANTHROPIC_API_KEY;
    const { default: handler } = await import("../api/menu-import.js");
    const res = mkRes();
    await handler({ method: "POST", body: { pdfBase64: "x", token: "t2" } }, res);
    expect(res.code).toBe(500);
    expect(res.body.error).toMatch(/OPENROUTER_API_KEY/);
  });
});
