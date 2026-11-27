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

// v204 (Доп. 530): импорт по частям — список позиций, подробности для части списка, время и свой счёт подробностей
describe("api/menu-import · v204 по частям", () => {
  let sent;
  const answer = (content) => async (url, opts) => {
    if (String(url).includes("whoami")) return { ok: true, status: 200, json: async () => ({ ok: true, employee: { name: "Т" } }) };
    sent.push(JSON.parse(opts.body));
    return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content } }] }) };
  };
  beforeEach(() => { process.env.OPENROUTER_API_KEY = "sk-or-test"; delete process.env.MENU_AI_EACH_MS; delete process.env.MENU_AI_TOTAL_MS; sent = []; });

  it("names: только список, без повторов; короткий ответ модели", async () => {
    globalThis.fetch = answer('[{"name":"Том ям","cat":"Супы"},{"name":"том ям"},{"name":"Пад тай","cat":"Горячие блюда"}]');
    const { default: handler } = await import("../api/menu-import.js");
    const res = mkRes();
    await handler({ method: "POST", body: { mode: "names", pdfBase64: "JVBERi0xLjQK", token: "n1" } }, res);
    expect(res.code).toBe(200);
    expect(res.body.names).toEqual([{ name: "Том ям", cat: "Супы" }, { name: "Пад тай", cat: "Горячие блюда" }]);
    expect(res.body.dishes).toBeUndefined();
    expect(sent[0].max_tokens).toBe(3000);
    expect(sent[0].messages[0].content[0].text).toMatch(/Перечисли ВСЕ позиции меню по порядку/);
  });
  it("details: подсказка называет позиции; в ответе — только они, по порядку, остальное — missing", async () => {
    globalThis.fetch = answer('[{"name":"Пад тай","allergens":["Арахис"]},{"name":"Том ям","ingredients":["креветки"],"allergens":["Моллюски и ракообразные"]}]');
    const { default: handler } = await import("../api/menu-import.js");
    const res = mkRes();
    await handler({ method: "POST", body: { mode: "details", names: ["Том ям", "Борщ"], pdfBase64: "JVBERi0xLjQK", token: "d1" } }, res);
    expect(res.code).toBe(200);
    expect(res.body.dishes.map((d) => [d.name, d.ask])).toEqual([["Том ям", "Том ям"]]);
    expect(res.body.dishes[0].allergens).toEqual(["Моллюски и ракообразные"]);
    expect(res.body.missing).toEqual(["Борщ"]);
    expect(sent[0].max_tokens).toBe(4000);
    expect(sent[0].messages[0].content[0].text).toContain("Верни записи ТОЛЬКО для этих позиций меню, в этом порядке: «Том ям», «Борщ»");
  });
  it("details без названий или слишком много — 400 словами, модель не зовём", async () => {
    globalThis.fetch = answer("[]");
    const { default: handler } = await import("../api/menu-import.js");
    for (const names of [undefined, [], ["a", "b", "c", "d", "e", "f", "g"]]) {
      const res = mkRes();
      await handler({ method: "POST", body: { mode: "details", names, pdfBase64: "JVBE", token: "d2" } }, res);
      expect(res.code).toBe(400);
      expect(res.body.error).toMatch(/какие блюда читать/);
    }
    expect(sent.length).toBe(0);
  });
  it("модель молчит дольше, чем можно ждать, — 504 словами, а не страница хостинга", async () => {
    process.env.MENU_AI_EACH_MS = "80"; process.env.MENU_AI_TOTAL_MS = "3050";
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes("whoami")) return { ok: true, status: 200, json: async () => ({ ok: true, employee: {} }) };
      return new Promise((_, bad) => opts.signal.addEventListener("abort", () => bad(new Error("aborted"))));
    };
    const { default: handler } = await import("../api/menu-import.js");
    const res = mkRes();
    const t0 = Date.now();
    await handler({ method: "POST", body: { mode: "names", pdfBase64: "JVBE", token: "s1" } }, res);
    expect(res.code).toBe(504);
    expect(res.body.error).toMatch(/AI не успел прочитать меню/);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
  it("импортов — 8 в час (запрос списка), подробности считаются отдельно", async () => {
    globalThis.fetch = answer('[{"name":"Том ям"}]');
    const { default: handler } = await import("../api/menu-import.js");
    const call = async (body) => { const res = mkRes(); await handler({ method: "POST", body: { pdfBase64: "JVBE", token: "rl1", ...body } }, res); return res.code; };
    for (let i = 0; i < 8; i++) expect(await call({ mode: "names" })).toBe(200);
    expect(await call({ mode: "names" })).toBe(429);
    expect(await call({ mode: "details", names: ["Том ям"] })).toBe(200);
  });
  it("в Runtime Logs Vercel — строка на запрос: режим, ответ, время, сколько позиций", async () => {
    globalThis.fetch = answer('[{"name":"Том ям","cat":"Супы"},{"name":"Пад тай"}]');
    const { default: handler } = await import("../api/menu-import.js");
    const res = mkRes(); let fin = null; res.on = (ev, f) => { if (ev === "finish") fin = f; };
    await handler({ method: "POST", body: { mode: "names", pdfBase64: "JVBE", token: "log1" } }, res);
    const was = console.log, lines = [];
    console.log = (...a) => lines.push(a.join(" "));
    try { res.statusCode = res.code; fin(); } finally { console.log = was; }
    expect(lines[0]).toMatch(/^menu-import names 200 \d+ms names=2 m$/);
  });
});
