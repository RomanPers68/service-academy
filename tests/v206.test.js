// v206 (Доп. 532): импорт меню из PDF — через функцию Supabase menu-import (как Наставник); /api/menu-import — запасной.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import * as lib from "../lib/menu-import.js";
import * as api from "../api/menu-import.js";

const rd = (f) => readFileSync(f, "utf8");

// ── функция menu-import на стенде (заглушки Deno, базы и OpenRouter) ──
const ENV = {};
globalThis.Deno = { serve() {}, env: { get: (k) => ENV[k] } };
const fn = await import("../supabase/functions/menu-import/index.ts");
let NET;
const send = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith("/rest/v1/rpc/whoami")) { NET.who.push(init.headers); return send(NET.emp ? { ok: true, employee: NET.emp } : { ok: false }); }
  if (u === "https://openrouter.ai/api/v1/chat/completions") {
    const body = JSON.parse(init.body);
    NET.bodies.push(body);
    if (NET.hang) return new Promise((_, no) => init.signal.addEventListener("abort", () => no(new Error("aborted"))));
    const r = NET.replies.length ? NET.replies.shift() : "[]";
    if (r && typeof r === "object" && r.status) return send({ error: { message: r.msg || "down", code: r.status } }, r.status);
    return send({ model: body.model, choices: [{ message: { content: r } }] });
  }
  return send(null, 404);
};
const call = async (payload, method = "POST") => {
  const res = await fn.handle(new Request("https://fn.test/menu-import", method === "POST"
    ? { method, body: JSON.stringify({ token: "tok", pdfBase64: "JVBERi0xLjQK", ...payload }) } : { method }));
  let j = null; try { j = await res.json(); } catch (e) {}
  return { status: res.status, j, cors: res.headers.get("Access-Control-Allow-Origin") };
};

describe("v206 · версия и журнал", () => {
  it("сборка v206, Дополнение 532 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(206);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 532 — .*\(v206\)/);
    const part = c.slice(c.indexOf("# Дополнение 532"));
    for (const w of ["Ошибку выдает", "код 403", "supabase/functions/menu-import", "/api/menu-import", "запасной"]) expect(part, w).toContain(w);
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v206 · функция Supabase menu-import", () => {
  beforeEach(() => {
    for (const k of Object.keys(ENV)) delete ENV[k];
    Object.assign(ENV, { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE_KEY: "eyJsvc", OPENROUTER_API_KEY: "sk-or-test" });
    NET = { emp: { id: "e1", name: "Роман" }, who: [], bodies: [], replies: [], hang: false };
  });

  it("OPTIONS — CORS, GET — 405 словами", async () => {
    const o = await fn.handle(new Request("https://fn.test/menu-import", { method: "OPTIONS" }));
    expect(o.status).toBe(200);
    expect(o.headers.get("Access-Control-Allow-Headers")).toBe("authorization, apikey, content-type");
    const g = await call({}, "GET");
    expect(g).toMatchObject({ status: 405, j: { error: "Только POST" }, cors: "*" });
  });

  it("names: вход через whoami ключом сервиса, список без повторов, подсказка и токены как у /api", async () => {
    NET.replies.push('```json\n[{"name":"Том ям","cat":"Супы"},{"name":"том ям"},{"name":"Пад тай","cat":"Горячие блюда"}]\n```');
    const lines = [], was = console.log;
    console.log = (...a) => lines.push(a.join(" "));
    let r; try { r = await call({ mode: "names", token: "n1" }); } finally { console.log = was; }
    expect(r.status).toBe(200);
    expect(r.j).toEqual({ names: [{ name: "Том ям", cat: "Супы" }, { name: "Пад тай", cat: "Горячие блюда" }], model: "anthropic/claude-sonnet-4.6" });
    expect(NET.who[0]).toMatchObject({ apikey: "eyJsvc", Authorization: "Bearer eyJsvc" });
    const b = NET.bodies[0];
    expect(b.max_tokens).toBe(3000);
    expect(b.messages[0].content[0].text).toBe(api.NAMES_PROMPT);
    expect(b.messages[0].content[1]).toEqual({ type: "file", file: { filename: "menu.pdf", file_data: "data:application/pdf;base64,JVBERi0xLjQK" } });
    expect(lines.find((l) => l.startsWith("menu-import names 200 "))).toMatch(/ms names=2 anthropic\/claude-sonnet-4\.6$/);
  });

  it("details: только спрошенные, по порядку запроса; чего нет — missing; аллергены — строго из списка", async () => {
    NET.replies.push(JSON.stringify([
      { name: "Пад тай", allergens: ["Арахис", "Орехи"] },
      { name: "Том Ям", ingredients: ["креветки"], allergens: ["Моллюски и ракообразные"], extra: "x" },
      { name: "Лишнее блюдо" },
    ]));
    const r = await call({ mode: "details", names: ["Том ям", "Пад тай", "Манго стики райс"] });
    expect(r.status).toBe(200);
    expect(r.j.dishes.map((d) => [d.name, d.ask])).toEqual([["Том Ям", "Том ям"], ["Пад тай", "Пад тай"]]);
    expect(r.j.dishes[1].allergens).toEqual(["Орехи"]);
    expect(r.j.dishes[0].extra).toBeUndefined();
    expect(r.j.missing).toEqual(["Манго стики райс"]);
    expect(NET.bodies[0].max_tokens).toBe(4000);
    expect(NET.bodies[0].messages[0].content[0].text).toBe(api.detailsPrompt(["Том ям", "Пад тай", "Манго стики райс"]));
  });

  it("без mode — всё сразу, как старая сборка", async () => {
    NET.replies.push('[{"name":"Борщ","cat":"Супы","allergens":["Молоко"]}]');
    const r = await call({});
    expect(r.status).toBe(200);
    expect(r.j.dishes).toEqual([{ name: "Борщ", cat: "Супы", desc: "", ingredients: [], allergens: ["Молоко"], note: "", pairing: "" }]);
    expect(NET.bodies[0].messages[0].content[0].text).toBe(api.PROMPT);
    expect(NET.bodies[0].max_tokens).toBe(8000);
  });

  it("чужой — 401 и ни одного запроса к модели; нет ключа — 500 словами; лишний размер — 413", async () => {
    NET.emp = null;
    expect(await call({ mode: "names" })).toMatchObject({ status: 401, j: { error: "Сессия не найдена — войди в приложение заново и повтори импорт" } });
    expect(NET.bodies.length).toBe(0);
    NET.emp = { id: "e1" };
    expect((await call({ mode: "names", pdfBase64: "A".repeat(fn.MAX_B64 + 1) })).status).toBe(413);
    delete ENV.OPENROUTER_API_KEY;
    const k = await call({ mode: "names" });
    expect(k.status).toBe(500);
    expect(k.j.error).toMatch(/OPENROUTER_API_KEY не задан: Supabase → Edge Functions → Secrets/);
  });

  it("лимиты: 8 импортов в час, у подробностей свой счёт", async () => {
    for (let i = 0; i < 8; i++) { NET.replies.push('[{"name":"Борщ"}]'); expect((await call({ mode: "names", token: "rl" })).status).toBe(200); }
    expect((await call({ mode: "names", token: "rl" })).status).toBe(429);
    NET.replies.push('[{"name":"Борщ"}]');
    expect((await call({ mode: "details", token: "rl", names: ["Борщ"] })).status).toBe(200);
  });

  it("ключ OpenRouter не принят — 502 словами про секрет Supabase; модель молчит — 504 словами", async () => {
    NET.replies.push({ status: 401 });
    const k = await call({ mode: "names", token: "k401" });
    expect(k.status).toBe(502);
    expect(k.j.error).toMatch(/Supabase → Edge Functions → Secrets/);
    Object.assign(ENV, { MENU_AI_EACH_MS: "20", MENU_AI_TOTAL_MS: "3500" });
    NET.hang = true;
    const s = await call({ mode: "names", token: "slow" });
    expect(s).toMatchObject({ status: 504, j: { error: fn.SLOW } });
    expect(NET.bodies.map((b) => b.model)).toEqual(["anthropic/claude-sonnet-4.6", "anthropic/claude-sonnet-4.6", "google/gemini-2.5-flash"]);
  });

  it("копия совпадает с /api/menu-import и lib/menu-import.js слово в слово", () => {
    expect(fn.PROMPT).toBe(api.PROMPT);
    expect(fn.NAMES_PROMPT).toBe(api.NAMES_PROMPT);
    expect(fn.ALLERGENS).toEqual(api.ALLERGENS);
    expect(fn.detailsPrompt(["«Иней»", "Борщ"])).toBe(api.detailsPrompt(["«Иней»", "Борщ"]));
    expect(fn.MENU_DETAILS_MAX).toBe(lib.MENU_DETAILS_MAX);
    expect(fn.MENU_NAMES_MAX).toBe(lib.MENU_NAMES_MAX);
    const raw = [{ name: " Том  ям ", cat: "Супы" }, "ТОМ ЯМ", { name: "" }, null, { name: "Ёжик" }, { name: "Пад тай", cat: 5 }];
    expect(fn.cleanNames(raw)).toEqual(lib.cleanNames(raw));
    for (const n of [["Борщ"], [], ["а", "б", "в", "г", "д", "е", "ж"], ["  "], ["Том ям", "Пад тай"]]) expect(fn.askNames(n)).toEqual(lib.askNames(n));
    const ds = [{ name: "Том Ям Кунг" }, { name: "Пад тай" }, { name: "Ёлка" }];
    expect(fn.pickRequested(ds, ["пад тай", "Том ям", "елка", "Нет такого"])).toEqual(lib.pickRequested(ds, ["пад тай", "Том ям", "елка", "Нет такого"]));
    expect(fn.normName("  Коктейль «Морозко»  Ё ")).toBe(lib.normName("  Коктейль «Морозко»  Ё "));
  });
});

describe("v206 · приложение: сначала Supabase, запасной — /api", () => {
  const fake = (answers) => {
    const calls = [];
    const f = async (url, o) => {
      calls.push({ url, headers: o.headers, body: JSON.parse(o.body) });
      const a = answers.length ? answers.shift() : { status: 200, j: { names: [] } };
      if (a === "net") throw new Error("offline");
      return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => { if (a.j === undefined) throw new Error("html"); return a.j; } };
    };
    return { f, calls };
  };

  it("запрос — в функцию Supabase с ключом и токеном", async () => {
    const { f, calls } = fake([{ status: 200, j: { names: [{ name: "Борщ" }] } }]);
    const post = lib.makeMenuPost({ supabaseUrl: "https://sb.test/", supabaseKey: "eyJanon", token: "t1", fetchFn: f });
    const r = await post({ mode: "names", pdfBase64: "JVBE" });
    expect(r).toMatchObject({ ok: true, status: 200, via: "supabase" });
    expect(calls[0].url).toBe("https://sb.test/functions/v1/menu-import");
    expect(calls[0].headers).toEqual({ "Content-Type": "application/json", apikey: "eyJanon", Authorization: "Bearer eyJanon" });
    expect(calls[0].body).toEqual({ mode: "names", pdfBase64: "JVBE", token: "t1" });
  });

  it("функции нет (404) — дальше всё через /api/menu-import; нет связи — без ухода на запасной", async () => {
    const { f, calls } = fake([{ status: 404, j: { code: "NOT_FOUND" } }, { status: 200, j: { names: [] } }, { status: 200, j: { dishes: [] } }]);
    const post = lib.makeMenuPost({ supabaseUrl: "https://sb.test", supabaseKey: "sb_publishable_x", token: "t2", fetchFn: f });
    expect(await post({ mode: "names" })).toMatchObject({ status: 200, via: "vercel" });
    expect(await post({ mode: "details", names: ["Борщ"] })).toMatchObject({ status: 200, via: "vercel" });
    expect(calls.map((c) => c.url)).toEqual(["https://sb.test/functions/v1/menu-import", "/api/menu-import", "/api/menu-import"]);
    expect(calls[0].headers).toEqual({ "Content-Type": "application/json", apikey: "sb_publishable_x" });
    const n = fake(["net"]);
    const p2 = lib.makeMenuPost({ supabaseUrl: "https://sb.test", supabaseKey: "k", token: "t", fetchFn: n.f });
    expect(await p2({ mode: "names" })).toEqual({ ok: false, status: 0, j: null, via: "supabase" });
    expect(n.calls.length).toBe(1);
  });

  it("ответ не JSON с кодом 403 — причина словами, а не «нет связи»", () => {
    expect(lib.menuImportErr({ ok: false, status: 403, j: null })).toBe("Запрос остановили по дороге к серверу (код 403). Нажми «Из PDF» ещё раз");
    expect(lib.menuImportWhy(401)).toMatch(/код 401/);
  });

  it("редактор меню шлёт импорт через makeMenuPost, сам в /api не ходит; демо отвечает на оба адреса", () => {
    const ui = rd("ui/menu-trainer.jsx");
    expect(ui).toContain("const post = makeMenuPost({ supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY, token });");
    expect(ui).not.toContain('fetch("/api/menu-import"');
    expect(rd("tools/claude/demo-app/boot.js")).toContain("/\\/functions\\/v1\\/menu-import|\\/api\\/menu-import/");
    const sbr = rd("supabase/README.md");
    expect(sbr).toMatch(/\| `menu-import` \|/);
    expect(rd("api/menu-import.js")).toContain("v206 (Доп. 532): основной путь импорта теперь — функция Supabase menu-import");
  });
});
