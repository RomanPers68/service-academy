// v207 (Доп. 533): винная карта, помощник уроков и поиск в интернете — через функцию Supabase app-api, Vercel — запасной.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { makeApiFetch, edgeName, EDGE_API } from "../lib/api-fetch.js";

const rd = (f) => readFileSync(f, "utf8");

// функция app-api на стенде: заглушка Deno (окружение и serve)
globalThis.Deno = { serve() {}, env: { toObject: () => ({ APP_API_SHIM_TEST: "da" }), get: () => undefined } };
const app = await import("../supabase/functions/app-api/entry.js");

describe("v207 · версия и журнал", () => {
  it("сборка v207, Дополнение 533 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(207);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 533 — .*\(v207\)/);
    const part = c.slice(c.indexOf("# Дополнение 533"));
    for (const w of ["Да, давай исправим", "app-api", "lib/api-fetch.js", "tools/claude/edge-build.mjs", "запасной"]) expect(part, w).toContain(w);
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v207 · собранный файл функции свежий", () => {
  it("в шапке — все источники и их отпечаток; он совпадает с файлами в репозитории", () => {
    const src = rd("supabase/functions/app-api/index.ts");
    expect(src.startsWith("// @ts-nocheck\n")).toBe(true);
    const files = [...src.matchAll(/^\/\/ {3}(\S+)$/gm)].map((m) => m[1]);
    for (const f of ["api/wine-import.js", "api/lesson-assist.js", "api/web-answer.js", "api/_auth.js", "api/_web.js",
      "supabase/functions/app-api/entry.js", "supabase/functions/app-api/shim.js"]) expect(files, f).toContain(f);
    const h = createHash("sha256");
    for (const f of files) { h.update(f + "\n"); h.update(rd(f)); }
    const want = /^\/\/ sources-sha256: ([0-9a-f]{64})$/m.exec(src)[1];
    expect(h.digest("hex"), "обработчик правили без пересборки: node tools/claude/edge-build.mjs, потом развернуть app-api").toBe(want);
    expect([...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]).sort()).toEqual(["node:buffer", "node:zlib"]);
  });
});

describe("v207 · переходник app-api: Request → req/res обработчиков", () => {
  beforeEach(() => { process.env.OPENROUTER_API_KEY = "sk-or-test"; });
  const call = async (path, init = {}) => {
    const res = await app.handle(new Request("https://sb.test/functions/v1/app-api/" + path, init));
    let j = null; const t = await res.text(); try { j = JSON.parse(t); } catch (e) {}
    return { status: res.status, j, t, cors: res.headers.get("Access-Control-Allow-Origin"), type: res.headers.get("Content-Type") };
  };

  it("три функции по имени из адреса; process.env берётся из окружения Supabase", () => {
    expect(Object.keys(app.ROUTES).sort()).toEqual(["lesson-assist", "web-answer", "wine-import"]);
    expect(EDGE_API.slice().sort()).toEqual(Object.keys(app.ROUTES).sort());
    expect(app.routeOf("https://x.supabase.co/functions/v1/app-api/wine-import?a=1")).toBe("wine-import");
    expect(process.env.APP_API_SHIM_TEST).toBe("da");
  });

  it("OPTIONS — CORS; неизвестное имя — 404 словами", async () => {
    const o = await app.handle(new Request("https://sb.test/functions/v1/app-api/wine-import", { method: "OPTIONS" }));
    expect(o.status).toBe(200);
    expect(o.headers.get("Access-Control-Allow-Headers")).toBe("authorization, apikey, content-type");
    const u = await call("nope", { method: "POST", body: "{}" });
    expect(u).toMatchObject({ status: 404, j: { error: "Нет такой функции: nope" }, cors: "*" });
  });

  it("тело, метод и параметры доходят до обработчика; его status/json/setHeader — ответом; сбой — 500 словами", async () => {
    app.ROUTES["t-echo"] = async (req, res) => { res.setHeader("X-T", "1"); return res.status(201).json({ got: req.body, m: req.method, q: req.query }); };
    app.ROUTES["t-boom"] = async () => { throw new Error("бах"); };
    try {
      const r = await call("t-echo?x=1", { method: "POST", body: JSON.stringify({ a: "Борщ" }) });
      expect(r).toMatchObject({ status: 201, j: { got: { a: "Борщ" }, m: "POST", q: { x: "1" } }, cors: "*", type: "application/json" });
      const b = await call("t-boom", { method: "POST", body: "{}" });
      expect(b).toMatchObject({ status: 500, j: { error: "Сбой функции t-boom: бах" } });
    } finally { delete app.ROUTES["t-echo"]; delete app.ROUTES["t-boom"]; }
  });

  it("настоящие обработчики: без сессии — 401 их же словами, до модели дело не доходит", async () => {
    const l = await call("lesson-assist", { method: "POST", body: JSON.stringify({ mode: "lesson" }) });
    expect(l).toMatchObject({ status: 401, j: { ok: false, error: "Сессия не найдена — войди в приложение заново" } });
    const w = await call("wine-import", { method: "POST", body: JSON.stringify({}) });
    expect(w.status).toBe(401);
    const a = await call("web-answer", { method: "POST", body: JSON.stringify({ question: "Что такое Чавыча?" }) });
    expect(a).toMatchObject({ status: 401, j: { ok: false, error: "auth" } });
  });
});

describe("v207 · приложение: apiFetch — сначала Supabase, функции нет — Vercel", () => {
  const fake = (answers) => {
    const calls = [];
    const f = async (url, o = {}) => {
      calls.push({ url, headers: o.headers });
      const a = answers.length ? answers.shift() : { status: 200, j: { ok: true } };
      if (a === "net") throw new Error("offline");
      const resp = { ok: a.status < 300, status: a.status, json: async () => a.j, text: async () => JSON.stringify(a.j) };
      resp.clone = () => resp;
      return resp;
    };
    return { f, calls };
  };

  it("имя функции из пути: только три переехавшие", () => {
    expect(edgeName("/api/wine-import")).toBe("wine-import");
    expect(edgeName("/api/lesson-assist?x=1")).toBe("lesson-assist");
    expect(edgeName("/api/web-answer")).toBe("web-answer");
    expect(edgeName("/api/menu-import")).toBe("");
    expect(edgeName("/api/report?t=1")).toBe("");
    expect(edgeName("https://x/api/wine-import")).toBe("");
  });

  it("переехавшие — в app-api с ключом (свои заголовки целы, параметры адреса тоже); остальные — как есть", async () => {
    const { f, calls } = fake([]);
    const af = makeApiFetch({ supabaseUrl: "https://sb.test/", supabaseKey: "eyJanon", fetchFn: f });
    await af("/api/wine-import?k=1", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await af("/api/report?t=1");
    expect(calls[0]).toEqual({ url: "https://sb.test/functions/v1/app-api/wine-import?k=1",
      headers: { "Content-Type": "application/json", apikey: "eyJanon", Authorization: "Bearer eyJanon" } });
    expect(calls[1].url).toBe("/api/report?t=1");
  });

  it("функции нет в Supabase (404 NOT_FOUND) — этот и следующие запросы в Vercel; нет связи — ошибка, без Vercel", async () => {
    const { f, calls } = fake([{ status: 404, j: { code: "NOT_FOUND", message: "Requested function was not found" } }, { status: 200, j: { ok: true } }]);
    const af = makeApiFetch({ supabaseUrl: "https://sb.test", supabaseKey: "sb_publishable_x", fetchFn: f });
    const r = await af("/api/lesson-assist", { method: "POST", body: "{}" });
    expect(r.status).toBe(200);
    await af("/api/web-answer", { method: "POST", body: "{}" });
    expect(calls.map((c) => c.url)).toEqual(["https://sb.test/functions/v1/app-api/lesson-assist", "/api/lesson-assist", "/api/web-answer"]);
    expect(calls[0].headers).toEqual({ apikey: "sb_publishable_x" });
    const n = fake(["net"]);
    const af2 = makeApiFetch({ supabaseUrl: "https://sb.test", supabaseKey: "k", fetchFn: n.f });
    await expect(af2("/api/wine-import", { method: "POST", body: "{}" })).rejects.toThrow("offline");
    expect(n.calls.length).toBe(1);
  });

  it("ответ самой функции с ошибкой — как есть, на Vercel не уходим", async () => {
    const { f, calls } = fake([{ status: 401, j: { ok: false, error: "auth" } }]);
    const af = makeApiFetch({ supabaseUrl: "https://sb.test", supabaseKey: "k", fetchFn: f });
    expect((await af("/api/web-answer", { method: "POST", body: "{}" })).status).toBe(401);
    expect(calls.length).toBe(1);
  });

  it("в приложении к трём функциям ходят только через apiFetch", () => {
    const files = [...readdirSync("ui").map((f) => "ui/" + f), ...readdirSync("lib").map((f) => "lib/" + f), "App.jsx"]
      .filter((f) => /\.(js|jsx)$/.test(f));
    for (const f of files) expect(rd(f), f).not.toMatch(/\bfetch\(\s*"\/api\/(wine-import|lesson-assist|web-answer)/);
    for (const f of ["ui/bar-sommelier.jsx", "ui/content-editor.jsx", "ui/wine-editor.jsx", "ui/live-check-editor.jsx", "lib/concept-ai.js"]) {
      expect(rd(f), f).toMatch(/apiFetch\("\/api\/(wine-import|lesson-assist)"/);
    }
    expect(rd("ui/ref-assist.jsx")).toContain("r = await apiFetch(REF_AI_URL, ");
    expect(rd("lib/ai-web.js")).toContain("const r = await apiFetch(url, ");
  });

  it("документы: функция в таблице Supabase, сборка — в инструментах", () => {
    expect(rd("supabase/README.md")).toMatch(/\| `app-api` \|/);
    expect(rd("tools/claude/README.md")).toContain("edge-build.mjs");
  });
});
