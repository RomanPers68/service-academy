// v154 (Доп. 478): поиск в интернете — надёжнее и с причиной ошибки. Владелец (13.11, снимок «Наставника»: под ответом о
// «Стейке из дальневосточного лосося» нажата «Проверить в интернете», ниже — «Не получилось поискать в интернете. Попробуй
// ещё раз»): «Пишет, что не получилось подключиться 🥺». Причины приложение не показывало.
// Сервер (api/_web.js): OpenRouter не принял запрос (400, 422) — та же модель проще: инструмент без настроек, потом старый
// плагин web; потом — следующая модель. Поиски ограничивает max_uses инструмента. Ответа хватает «думающим» моделям
// (max_tokens 1800 и 2500). Причина — в тексте ошибки и в журнале Vercel ([web-search]). Приложение: ошибка — с причиной
// (lib/ai-web.js: webErrText); поиск не вышел — под ответом «Ответ без интернета…», в описаниях — «Без интернета…».
// Экран — tools/claude/e2e-v154.mjs.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { WEB_ERR, webErrText } from "../lib/ai-web";

const rd = (p) => readFileSync(p, "utf8");

describe("v154: api/_web.js — запрос проще, если OpenRouter не принял", () => {
  let W, calls = [], plan = [], logs = [];
  const real = globalThis.fetch, realErr = console.error;
  beforeAll(async () => { W = await import("../api/_web.js"); console.error = (m) => logs.push(String(m)); });
  afterAll(() => { globalThis.fetch = real; console.error = realErr; });
  beforeEach(() => {
    calls = []; plan = []; logs = [];
    globalThis.fetch = async (url, init = {}) => {
      calls.push(JSON.parse(init.body)); const step = plan.shift() || {};
      if (step.html) return { ok: false, status: step.html, json: async () => { throw new Error("Unexpected token <"); } };
      if (step.status) return { ok: false, status: step.status, json: async () => ({ error: { message: step.msg || "bad", code: step.status, ...(step.raw ? { metadata: { raw: step.raw } } : {}) } }) };
      return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ finish_reason: step.fin || "stop", message: { content: step.text == null ? "Ответ" : step.text, annotations: [] } }] }) };
    };
  });

  it("три вида запроса к одной модели: инструмент с настройками (max_uses), без настроек, старый плагин web", () => {
    const a = W.orAsks("m1", { max_tokens: 10, messages: [] }, 5, 2);
    expect(a.map((x) => x.via)).toEqual(["tool", "tool-plain", "plugin"]);
    expect(a[0].body).toEqual({ max_tokens: 10, messages: [], model: "m1", tools: [{ type: "openrouter:web_search", parameters: { engine: "exa", max_results: 5, max_characters: 2000, max_uses: 2 } }], max_tool_calls: 2 });
    expect(a[1].body).toEqual({ max_tokens: 10, messages: [], model: "m1", tools: [{ type: "openrouter:web_search" }] });
    expect(a[2].body).toEqual({ max_tokens: 10, messages: [], model: "m1", plugins: [{ id: "web", max_results: 5 }] });
  });
  it("400 — та же модель без настроек, снова 400 — плагином; ответ пришёл — какой путь сработал", async () => {
    plan = [{ status: 400, msg: "Invalid parameter max_characters" }, { status: 422, msg: "Unknown tool" }, { text: "Нашёл." }];
    const out = await W.webCall({ orKey: "k", models: ["m1", "m2"], user: "U" });
    expect(out).toMatchObject({ ok: true, text: "Нашёл.", via: "plugin" });
    expect(calls.map((c) => [c.model, c.plugins ? "plugin" : c.tools[0].parameters ? "tool" : "tool-plain"])).toEqual([["m1", "tool"], ["m1", "tool-plain"], ["m1", "plugin"]]);
    expect(logs[0]).toBe("[web-search] m1 (tool): Invalid parameter max_characters");
  });
  it("не про запрос (404, 5xx, страница вместо JSON, пусто) — сразу следующая модель; причина — в ошибке", async () => {
    plan = [{ status: 404, msg: "No endpoints found" }, { html: 504 }, { text: "", fin: "length" }];
    const out = await W.webCall({ orKey: "k", models: ["m1", "m2", "m3"], user: "U" });
    expect(calls.map((c) => c.model)).toEqual(["m1", "m2", "m3"]);
    expect(out).toEqual({ ok: false, status: 502, error: "Ошибка OpenRouter: m3: пустой ответ (length)" });
    expect(logs).toEqual(["[web-search] m1 (tool): No endpoints found", "[web-search] m2: HTTP 504, ответ не JSON", "[web-search] m3: пустой ответ (length)"]);
    logs = [];
    plan = [{ status: 400, msg: "Provider returned error", raw: "{\"error\":\"tools not supported\"}" }, { status: 400, msg: "x" }, { status: 400, msg: "y" }];
    const one = await W.webCall({ orKey: "k", models: ["m1"], user: "U" });
    expect(one.error).toBe("Ошибка OpenRouter: m1 (plugin): y");
    expect(logs[0]).toBe('[web-search] m1 (tool): Provider returned error — {"error":"tools not supported"}');
  });
  it("401 и 402 — сразу понятной фразой, без перебора", async () => {
    plan = [{ status: 402 }];
    expect((await W.webCall({ orKey: "k", models: ["m1", "m2"], user: "U" })).error).toBe("На OpenRouter закончились кредиты (402): пополни баланс на openrouter.ai → Credits.");
    expect(calls.length).toBe(1);
  });
});

describe("v154: /api/web-answer — ответа хватает «думающим» моделям", () => {
  const real = globalThis.fetch;
  let H, bodies = [];
  beforeAll(async () => {
    globalThis.fetch = async (url, init = {}) => {
      if (/rpc\/whoami/.test(url)) return { ok: true, json: async () => ({ ok: true, employee: { id: "u1" } }) };
      const b = JSON.parse(init.body); bodies.push(b);
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify([{ text: "Достаточно длинный вариант описания блюда." }]) } }] }) };
    };
    process.env.OPENROUTER_API_KEY = "k";
    H = await import("../api/web-answer.js");
  });
  afterAll(() => { globalThis.fetch = real; delete process.env.OPENROUTER_API_KEY; });
  const call = (body) => new Promise((ok) => { const res = { status() { return this; }, json(j) { ok(j); return this; } }; H.default({ method: "POST", body }, res); });
  it("вопрос ассистенту — до 1800 токенов, описания блюда — до 2500", async () => {
    bodies = [];
    await call({ token: "t154", question: "Что за вино Château Margaux?" });
    await call({ token: "t154", mode: "desc", dish: { name: "Борщ" } });
    expect(bodies.map((b) => b.max_tokens)).toEqual([1800, 2500]);
  });
});

describe("v154: ошибка поиска — с причиной (lib/ai-web.js)", () => {
  it("известные — своими словами; остальные — с текстом сервера или кодом ответа", () => {
    expect(webErrText({ ok: false, error: "rate_limit" })).toBe(WEB_ERR.rate_limit);
    expect(webErrText({ ok: false, error: "net" })).toBe("Нет связи с сервером: проверь интернет и нажми ещё раз");
    expect(webErrText({ ok: false, error: "server", message: "На OpenRouter закончились кредиты (402): пополни баланс на openrouter.ai → Credits." }))
      .toBe("Не получилось поискать в интернете: На OpenRouter закончились кредиты (402): пополни баланс на openrouter.ai → Credits. Попробуй ещё раз".replace("Credits. Попробуй", "Credits. Попробуй"));
    expect(webErrText({ ok: false, error: "http", status: 504 })).toBe("Не получилось поискать в интернете: сервер ответил кодом 504. Попробуй ещё раз");
    expect(webErrText(null)).toBe("Не получилось поискать в интернете. Попробуй ещё раз");
    expect(webErrText({ ok: false, error: "server", message: "x".repeat(400) }).length).toBeLessThan(300);
  });
});

describe("v154: экраны", () => {
  const A = rd("ui/assistant.jsx"), M = rd("ui/menu-trainer.jsx");
  it("ассистент: страница вместо JSON и нет связи — тоже с причиной; ошибка «Проверить в интернете» — webErrText; поиск не вышел — «Ответ без интернета»", () => {
    // v155: страница вместо JSON и нет связи — в webPost (lib/ai-web.js), с запасным путём
    expect(A).toContain("const askWeb = (body) => webPost({ token: saToken(), ...body });");
    expect(A).toContain("setError(webErrText(w));");
    expect(A).toContain("chat(webErrText(w));");
    expect(A).toContain("...(miss ? { webMiss: miss } : {})");
    expect(A).toContain("<span>Ответ без интернета: поиск сейчас не ответил</span>");
    expect(A).not.toContain('"Не получилось поискать в интернете. Попробуй ещё раз"');
  });
  it("описания блюда: без интернета — «Без интернета: поиск сейчас не ответил (причина)»", () => {
    // v155: и кто отказал (w.why)
    expect(M).toContain('else plain(String((w && (w.message || (w.status ? "сервер ответил кодом " + w.status + (w.why ? " (" + w.why + ")" : "") : w.error))) || "поиск не ответил"));');
    expect(M).toContain("Без интернета: поиск сейчас не ответил ({aiMiss.replace(");
  });
});

describe("v154: метка и журнал", () => {
  it("метка «сборка v154», Дополнение 478 со словами владельца, e2e-v154 в README", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    expect(n[0]).toBeGreaterThanOrEqual(154);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 478 — .*\(v154\)/);
    expect(c).toContain("Пишет, что не получилось подключиться");
    expect(rd("tools/claude/README.md")).toContain("`e2e-v154.mjs` — v154 (Доп. 478)");
  });
});
