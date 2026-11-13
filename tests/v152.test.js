// v152 (Доп. 476): выход в интернет. Владелец (13.11): «Мы можем дать моему ассистенту выход в интернет, что бы он мог
// просмотреть или найти инфу которую он к примеру не знает? И сколько это будет стоить?» — «Да, давай сделаем😉. И то есть,
// к примеру ассистент может после этого сам проверить инфу по алкоголю в сети, и оттуда взять, верно?».
// Ассистент: вопрос о марке напитка, которой нет в «Барной карте», и «найди в интернете…» — в /api/web-answer (модель ищет,
// если не уверена, ответ со ссылками), под ответом о напитке — «Проверить в интернете». Барная карта: «Поискать в интернете»
// для позиций, о которых AI своих знаний не хватило, — найденное с пометкой «AI» и ссылками. Поиск — api/_web.js
// (OpenRouter, openrouter:web_search; запасной путь — web_search Claude API). Экран — tools/claude/e2e-v152.mjs.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { WINE, SPIRIT, BULK_SKIP, bulkAsk, bulkApply, bulkMerge, webAsk, webQueue, webPlan, webMerge, webApply } from "../lib/drinks";
import { normWine } from "../lib/wine";
import { normSpirit } from "../lib/spirit";
import { aiWebOf, siteOf } from "../lib/ai-web";

const rd = (p) => readFileSync(p, "utf8");
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() }; };

describe("v152: api/_web.js — поиск в интернете", () => {
  let W;
  const real = globalThis.fetch;
  let calls = [], plan = [];
  beforeAll(async () => { W = await import("../api/_web.js"); });
  beforeEach(() => { calls = []; plan = []; });
  afterAll(() => { globalThis.fetch = real; delete process.env.OPENROUTER_WEB_ENGINE; });
  const mock = () => { globalThis.fetch = async (url, init = {}) => { const body = JSON.parse(init.body); calls.push({ url, body }); const step = plan.shift() || { ok: true };
    if (step.status) return { ok: false, status: step.status, json: async () => ({ error: { message: step.msg || "x", code: step.status } }) };
    if (/anthropic\.com/.test(url)) return { ok: true, status: 200, json: async () => step.an };
    return { ok: true, status: 200, json: async () => step.or }; }; };

  it("ссылки: только http(s), без повторов (хвост #, ?, / не в счёт), не больше max; строки и объекты", () => {
    expect(W.sourcesOf(["https://a.ru/x", "https://a.ru/x/", "https://a.ru/x?utm=1", "javascript:alert(1)", "ftp://b", { url: "http://c.com", title: "  C  сайт " }, { u: "https://d.com", t: "D" }], 3))
      .toEqual([{ url: "https://a.ru/x", title: "" }, { url: "http://c.com", title: "C сайт" }, { url: "https://d.com", title: "D" }]);
    expect(W.sourcesOf(null)).toEqual([]);
  });
  it("OpenRouter: ссылки — annotations url_citation; Claude API — citations, иначе найденные страницы", () => {
    expect(W.orCitations({ choices: [{ message: { annotations: [{ type: "url_citation", url_citation: { url: "https://x.com/a", title: "X" } }, { type: "other" }] } }] }))
      .toEqual([{ url: "https://x.com/a", title: "X" }]);
    expect(W.anCitations({ content: [{ type: "web_search_tool_result", content: [{ url: "https://r.com", title: "R" }] }, { type: "text", text: "a", citations: [{ url: "https://c.com", title: "C" }] }] }))
      .toEqual([{ url: "https://c.com", title: "C" }]);
    expect(W.anCitations({ content: [{ type: "web_search_tool_result", content: [{ url: "https://r.com", title: "R" }] }, { type: "text", text: "a" }] }))
      .toEqual([{ url: "https://r.com", title: "R" }]);
  });
  it("запрос OpenRouter: инструмент openrouter:web_search (Exa, 5 результатов, выдержки до 2000 знаков), не больше 3 поисков; ответ — текст, ссылки, число поисков", async () => {
    mock();
    plan = [{ or: { model: "m1", choices: [{ finish_reason: "stop", message: { content: "Ответ", annotations: [{ type: "url_citation", url_citation: { url: "https://x.com", title: "X" } }] } }], usage: { server_tool_use_details: { web_search_requests: 2 } } } }];
    const out = await W.webCall({ orKey: "k", models: ["m1", "m2"], system: "S", user: "U", history: [{ role: "user", content: "раньше" }, { role: "system", content: "нет" }] });
    expect(out).toMatchObject({ ok: true, text: "Ответ", sources: [{ url: "https://x.com", title: "X" }], searches: 2, model: "m1" });
    const b = calls[0].body;
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    // v154: ещё max_uses — у Chat Completions поиски ограничивает он
    expect(b.tools).toEqual([{ type: "openrouter:web_search", parameters: { engine: "exa", max_results: 5, max_characters: 2000, max_uses: 3 } }]);
    expect(b.max_tool_calls).toBe(3);
    expect(b.messages.map((m) => m.role)).toEqual(["system", "user", "user"]);
    process.env.OPENROUTER_WEB_ENGINE = "parallel";
    expect(W.webTool(3)).toEqual({ type: "openrouter:web_search", parameters: { engine: "parallel", max_results: 3, max_characters: 2000, max_uses: 3 } });
  });
  it("первая модель с ошибкой — следующая; 402 — «закончились кредиты»; без ключей — понятная ошибка", async () => {
    mock();
    plan = [{ status: 404, msg: "No endpoints" }, { or: { choices: [{ message: { content: "Второй" } }] } }];
    expect((await W.webCall({ orKey: "k", models: ["m1", "m2"], user: "U" })).text).toBe("Второй");
    plan = [{ status: 402 }];
    expect((await W.webCall({ orKey: "k", models: ["m1"], user: "U" })).error).toContain("закончились кредиты");
    expect((await W.webCall({ models: ["m1"], user: "U" })).error).toContain("OPENROUTER_API_KEY");
  });
  it("Claude API (без OpenRouter): инструмент web_search, текст из текстовых блоков, ссылки из citations", async () => {
    mock();
    plan = [{ an: { model: "claude-sonnet-4-6", content: [{ type: "server_tool_use" }, { type: "text", text: "Да", citations: [{ url: "https://s.com", title: "S" }] }], usage: { server_tool_use: { web_search_requests: 1 } } } }];
    const out = await W.webCall({ anKey: "a", system: "S", user: "U" });
    expect(out).toMatchObject({ ok: true, text: "Да", sources: [{ url: "https://s.com", title: "S" }], searches: 1 });
    expect(calls[0].body.tools).toEqual([{ type: "web_search_20250305", name: "web_search", max_uses: 3 }]);
    plan = [{ an: { content: [{ type: "text", text: "Да" }] } }];
    await W.webCall({ anKey: "a", user: "U", maxSearches: 2 });
    expect(calls[1].body.tools[0].max_uses).toBe(2);
    expect(calls[0].body.system).toBe("S");
  });
});

describe("v152: api/wine-import.js — «Поискать в интернете» (gaps с web)", () => {
  const real = globalThis.fetch;
  let A, bodies = [], reply = "[]", annotations = [];
  beforeAll(async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    globalThis.fetch = async (url, init = {}) => {
      if (/rpc\/whoami/.test(url)) return { ok: true, json: async () => ({ ok: true, employee: { id: "u1" } }) };
      const body = JSON.parse(init.body); bodies.push(body);
      return { ok: true, status: 200, json: async () => ({ model: body.model, choices: [{ finish_reason: "stop", message: { content: reply, annotations } }], usage: { server_tool_use_details: { web_search_requests: 1 } } }) };
    };
    A = await import("../api/wine-import.js");
  });
  afterAll(() => { globalThis.fetch = real; delete process.env.OPENROUTER_API_KEY; });
  const call = (body) => new Promise((ok) => { const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); return this; } }; A.default({ method: "POST", body }, res); });

  it("до 2 позиций за раз, не больше 2 поисков; подсказка — искать на сайтах производителей и в справочниках, src — откуда взято", () => {
    expect(A.GAP_WEB_MAX).toBe(2);
    expect(A.GAP_WEB_SEARCHES).toBe(2);
    expect(A.gapItems([{ name: "a", missing: ["story"] }, { name: "b", missing: ["story"] }, { name: "c", missing: ["story"] }], true, A.GAP_WEB_MAX).length).toBe(2);
    const p = A.gapsPrompt(A.gapItems([{ name: "Кальвадос", missing: ["story", "region"] }], true), true, true);
    expect(p).toContain("найди каждую в интернете — сайт производителя, импортёра или дистрибьютора");
    expect(p).toContain('"src" — до 3 адресов страниц, откуда взял');
    expect(A.gapsPrompt(A.gapItems([{ name: "Кальвадос", missing: ["story"] }], true), true)).not.toContain("интернет");
  });
  it("разбор: ссылки из ответа и (при одной позиции) из annotations — не больше 3, только недостающие поля", () => {
    const items = A.gapItems([{ name: "Кальвадос", missing: ["region"] }], true);
    expect(A.gapsPick([{ i: 0, region: "Нормандия", portion: 50, src: ["https://a.com/1", "bad"] }], items, true, { web: true, cites: [{ url: "https://b.com", title: "B" }, { url: "https://a.com/1" }] }))
      .toEqual([{ i: 0, name: "Кальвадос", region: "Нормандия", src: [{ url: "https://a.com/1", title: "" }, { url: "https://b.com", title: "B" }] }]);
    expect(A.gapsPick([{ i: 0, region: "Нормандия" }], items, true)).toEqual([{ i: 0, name: "Кальвадос", region: "Нормандия" }]);   // без web — без src
  });
  it("обработчик: web: true — запрос с инструментом поиска, до 2 позиций; ответ — поля, src и число поисков", async () => {
    reply = JSON.stringify([{ i: 0, name: "Кальвадос", region: "Нормандия", src: ["https://drouin.example/pays-d-auge"] }]);
    annotations = [{ type: "url_citation", url_citation: { url: "https://guide.example/calvados", title: "Гид" } }];
    bodies = [];
    const r = await call({ token: "t", mode: "gaps", kind: "spirit", web: true, items: [{ name: "Кальвадос", known: { portion: 40 }, missing: ["region", "story"] }, { name: "x", missing: ["story"] }, { name: "y", missing: ["story"] }] });
    expect(r.code).toBe(200);
    // позиций две — ссылки, приложенные ко всему ответу, ни к одной не пишем: только свои src
    expect(r.j.wines).toEqual([{ i: 0, name: "Кальвадос", region: "Нормандия", src: [{ url: "https://drouin.example/pays-d-auge", title: "" }] }]);
    expect(r.j.searches).toBe(1);
    expect(bodies[0].tools[0].type).toBe("openrouter:web_search");
    expect(bodies[0].max_tool_calls).toBe(2);   // у барной карты — не больше двух поисков на позицию
    expect(bodies[0].messages[0].content).toContain("1. «x»");   // две позиции из трёх
    expect(bodies[0].messages[0].content).not.toContain("«y»");
    expect(bodies[0].messages[0].content).toContain("Своих знаний о них не хватило: найди каждую в интернете");
  });
  it("одна позиция — к её src добавляются ссылки ответа; без web — запрос как раньше, без поиска", async () => {
    bodies = [];
    const r = await call({ token: "t", mode: "gaps", kind: "spirit", web: true, items: [{ name: "Кальвадос", missing: ["region"] }] });
    expect(r.j.wines[0].src).toEqual([{ url: "https://drouin.example/pays-d-auge", title: "" }, { url: "https://guide.example/calvados", title: "Гид" }]);
    bodies = [];
    const plain = await call({ token: "t", mode: "gaps", items: [{ name: "Шабли", missing: ["story"] }] });
    expect(bodies[0].tools).toBeUndefined();
    expect("searches" in plain.j).toBe(false);
  });
});

describe("v152: api/web-answer.js — ассистент с интернетом", () => {
  const real = globalThis.fetch;
  let H, bodies = [], whoOk = true, reply = "Ответ";
  beforeAll(async () => {
    globalThis.fetch = async (url, init = {}) => {
      if (/rpc\/whoami/.test(url)) return { ok: whoOk, json: async () => (whoOk ? { ok: true, employee: { id: "u1" } } : {}) };
      const body = JSON.parse(init.body); bodies.push(body);
      return { ok: true, status: 200, json: async () => ({ model: body.model, choices: [{ message: { content: reply, annotations: [{ type: "url_citation", url_citation: { url: "https://w.example/a", title: "W" } }] } }], usage: { server_tool_use_details: { web_search_requests: 1 } } }) };
    };
    H = await import("../api/web-answer.js");
  });
  afterAll(() => { globalThis.fetch = real; delete process.env.OPENROUTER_API_KEY; });
  const call = (body) => new Promise((ok) => { const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); return this; } }; H.default({ method: "POST", body }, res); });

  it("без ключа — not_configured; пустой вопрос — 400; без сессии — auth", async () => {
    delete process.env.OPENROUTER_API_KEY; delete process.env.ANTHROPIC_API_KEY;
    expect((await call({ token: "t", question: "Что за вино?" })).j).toMatchObject({ ok: false, error: "not_configured" });
    process.env.OPENROUTER_API_KEY = "k";
    expect((await call({ token: "t", question: "  " })).code).toBe(400);
    whoOk = false;
    expect((await call({ token: "t", question: "Что за вино?" })).j).toMatchObject({ ok: false, error: "auth" });
    whoOk = true;
  });
  it("ответ: текст и ссылки; модель — с поиском, правила наставника; данные приложения и проверка прошлого ответа — в сообщении", async () => {
    bodies = [];
    const r = await call({ token: "t2", question: "Что за вино Château Margaux?", context: "Ресторан: Два моря.", history: [{ role: "user", content: "привет" }, { role: "assistant", content: "Привет!" }], check: "Это Бордо." });
    expect(r.j).toMatchObject({ ok: true, reply: "Ответ", sources: [{ url: "https://w.example/a", title: "W" }], searched: 1 });
    const b = bodies[0];
    expect(b.model).toBe(H.WEB_MODELS()[0]);
    expect(H.WEB_MODELS()).toContain("anthropic/claude-sonnet-4.6");
    expect(b.tools[0].type).toBe("openrouter:web_search");
    expect(b.messages[0]).toEqual({ role: "system", content: H.SYSTEM });
    expect(H.SYSTEM).toContain("Поищи в интернете хотя бы раз, даже если ответ кажется");   // v155: ищет всегда, раз позвали
    expect(H.SYSTEM).toContain("Цены, наличие, скидки и правила ресторана называй только из данных приложения");
    const last = b.messages[b.messages.length - 1].content;
    expect(last).toContain("Данные приложения:\nРесторан: Два моря.");
    expect(last).toContain("Вопрос сотрудника: Что за вино Château Margaux?");
    expect(last).toContain("Проверь в интернете ответ, который ты дал раньше, и поправь, если в нём ошибка: «Это Бордо.»");
    expect(b.messages.slice(1, -1).map((m) => m.role)).toEqual(["user", "assistant"]);
  });
  it("лимит: 20 поисков в час на сотрудника", async () => {
    let last;
    for (let i = 0; i < 21; i++) last = await call({ token: "t-limit", question: "Что за виски?" });
    expect(last.j).toMatchObject({ ok: false, error: "rate_limit" });
  });
});

describe("v152: барная карта — кого AI не знал, и что нашлось в интернете (lib/drinks.js)", () => {
  const sp = (o) => SPIRIT.norm({ name: "Кальвадос Drouin", portion: 40, pricePortion: 690, ...o });
  it("«Дописать пустое» ничего не дописал — позиция помечена aiNone; дописал — пометки нет", () => {
    const none = bulkMerge(SPIRIT, sp({ id: "sp-1" }), null, bulkAsk(SPIRIT, sp({})).missing).rec;
    expect(none.aiNone).toBe(true);
    const got = bulkMerge(SPIRIT, none, { story: "Яблочный бренди" }, ["story"]).rec;
    expect("aiNone" in got).toBe(false);
  });
  it("очередь поиска: только aiNone без aiWeb; спрашиваем всё пустое (и то, чего AI не знал), кроме года, объёма, цен, порции", () => {
    const menu = [sp({ id: "sp-1", aiNone: true, aiTried: ["story", "region"] }), sp({ id: "sp-2" }), sp({ id: "sp-3", aiNone: true, aiWeb: { at: 1, src: [] } }), WINE.norm({ id: "wn-1", name: "Шабли", aiNone: true })];
    expect(webQueue(SPIRIT, menu).map((r) => r.id)).toEqual(["sp-1"]);
    expect(webPlan(menu, "spirit")).toEqual([{ kind: "spirit", ids: ["sp-1"] }, { kind: "wine", ids: ["wn-1"] }]);
    const m = webAsk(SPIRIT, menu[0]).missing;
    expect(m).toContain("story");
    expect(m).toContain("region");
    for (const f of BULK_SKIP) expect(m).not.toContain(f);
  });
  it("нашлось: поля с «AI», ссылки в aiWeb, aiNone снят; порция и цена — как были, даже если поиск их прислал", () => {
    const rec = sp({ id: "sp-1", aiNone: true });
    const r = webMerge(SPIRIT, { ...rec, stopAt: 7 }, { region: "Нормандия", portion: 50, pricePortion: 1, src: [{ url: "https://a.example/x", title: "A" }, { url: "bad" }] }, ["region", "story"], 42);
    expect(r.added).toEqual(["region"]);
    expect([r.rec.region, r.rec.portion, r.rec.pricePortion, r.rec.stopAt]).toEqual(["Нормандия", 40, 690, 7]);
    expect(r.rec.ai).toEqual(["region"]);
    expect(r.rec.aiWeb).toEqual({ at: 42, src: [{ url: "https://a.example/x", title: "A" }] });
    expect("aiNone" in r.rec).toBe(false);
    expect(r.rec.aiTried).toEqual(["story"]);
  });
  it("не нашлось: aiNone остаётся, aiWeb без ссылок — второй раз позиция в поиск не идёт; webApply — список «не нашлось»", () => {
    const menu = [sp({ id: "sp-1", aiNone: true }), { id: "d1", name: "Борщ" }];
    const r = webApply(SPIRIT, menu, [{ id: "sp-1", missing: ["story"] }], [], 9);
    const rec = SPIRIT.records(r.shared)[0];
    expect(r.none).toEqual(["Кальвадос Drouin"]);
    expect([rec.aiNone, rec.aiWeb]).toEqual([true, { at: 9, src: [] }]);
    expect(webQueue(SPIRIT, r.shared)).toEqual([]);
    expect(r.shared[1]).toEqual({ id: "d1", name: "Борщ" });
    const ok = webApply(SPIRIT, menu, [{ id: "sp-1", missing: ["story"] }], [{ i: 0, story: "Найдено", src: [{ url: "https://b.example/p", title: "B" }] }], 9);
    expect(ok.added).toEqual([{ id: "sp-1", name: "Кальвадос Drouin", fields: ["story"], src: [{ url: "https://b.example/p", title: "B" }] }]);
    expect(ok.none).toEqual([]);
    expect(SPIRIT.records(ok.shared)[0].aiWeb).toEqual({ at: 9, src: [{ url: "https://b.example/p", title: "B" }] });
  });
  it("запись: aiNone — только true; aiWeb — время и до 3 ссылок http(s); старые записи — без новых полей", () => {
    expect(aiWebOf({ at: 5, src: [{ url: "https://a.ru" }, { url: "javascript:x" }, { url: "https://b.ru", title: "B" }, { url: "https://c.ru" }, { url: "https://d.ru" }] }))
      .toEqual({ at: 5, src: [{ url: "https://a.ru", title: "" }, { url: "https://b.ru", title: "B" }, { url: "https://c.ru", title: "" }] });
    expect(aiWebOf({ src: [] })).toBe(null);
    expect(aiWebOf({ at: 1, src: [" https://e.ru/x ", "ftp://f"] })).toEqual({ at: 1, src: [{ url: "https://e.ru/x", title: "" }] });
    expect(normWine({ name: "x", aiNone: true, aiWeb: { at: 3, src: [] } })).toMatchObject({ aiNone: true, aiWeb: { at: 3, src: [] } });
    expect(normSpirit({ name: "x", aiNone: "yes" }).aiNone).toBeUndefined();
    const plain = normWine({ name: "x" });
    expect("aiNone" in plain || "aiWeb" in plain).toBe(false);
    expect(siteOf("https://www.vivino.com/wines/1")).toBe("vivino.com");
  });
});

describe("v152: когда ассистенту искать в интернете (lib/reference-context.js)", () => {
  let R;
  beforeAll(async () => {
    globalThis.localStorage = memStore();
    localStorage.setItem("sa_menu_shared", JSON.stringify({ "Два моря": [
      WINE.norm({ id: "wn-1", name: "Шабли", producer: "Domaine Laroche", color: "white" }),
      WINE.norm({ id: "wn-2", name: "Розе Côtes de Provence", producer: "Château d’Esclans", color: "rose" }),
      SPIRIT.norm({ id: "sp-1", name: "АБЕРФЕЛДИ 12 ЛЕТ / ABERFELDY 12 YEARS", cat: "whisky" }) ] }));
    R = await import("../lib/reference-context");
  });
  it("марка напитка, которой нет в карте, — в интернет; есть в карте — как раньше; общие слова («Château», «вино») — не марка", () => {
    expect(R.webAsked("Что за вино Château Margaux?", "Два моря")).toBe(true);
    expect(R.drinkInCard("Что за вино Château Margaux?", "Два моря")).toBe(false);
    expect(R.webAsked("А Шабли бокалом есть?", "Два моря")).toBe(false);
    expect(R.webAsked("Какой виски «Аберфелди» у нас?", "Два моря")).toBe(false);
    expect(R.webAsked("Есть ли виски «Lagavulin 16»?", "Два моря")).toBe(true);
  });
  it("общие вопросы без марки — без интернета; «найди в интернете…» — всегда в интернет", () => {
    expect(R.webAsked("Что такое мерло?", "Два моря")).toBe(false);
    expect(R.webAsked("Посоветуй вино к стейку", "Два моря")).toBe(false);
    expect(R.webAsked("Найди в интернете, что такое кальвадос", "Два моря")).toBe(true);
    expect(R.askedForWeb("проверь в сети крепость Hennessy")).toBe(true);
    expect(R.askedForWeb("Проверь, пожалуйста, стол 5")).toBe(false);
  });
  it("«Проверить в интернете» — под ответом о напитке или о марке", () => {
    expect(R.webCheckable("Посоветуй вино к стейку")).toBe(true);
    expect(R.webCheckable("А что за Lagavulin 8?")).toBe(true);
    expect(R.webCheckable("Как закрыть смену?")).toBe(false);
    expect(R.webCheckable("")).toBe(false);
  });
});

describe("v152: экраны", () => {
  const A = rd("ui/assistant.jsx"), E = rd("ui/wine-editor.jsx");
  it("ассистент: в интернет — /api/web-answer, не вышло — обычный ответ; ссылки под ответом; «Проверить в интернете»; «Ищу в интернете…»", () => {
    // v155: запрос — webPost (lib/ai-web.js): /api/web-answer, хостинг отказал — запасной путь через /api/wine-import
    expect(A).toContain("const askWeb = (body) => webPost({ token: saToken(), ...body });");
    expect(A).toContain("if (!webAsked(text, profile?.restaurant) && !webMore(text, prevQ, profile?.restaurant)) { chat(); return; }");   // v155: и «а подробнее?»
    expect(A).toContain("updMsgsOf(sid, [...next, { role: \"assistant\", content: w.reply, t: Date.now(), web: w.sources || [], viaWeb: true }]);");
    expect(A).toContain('{m.check ? "Проверил в интернете:" : "Нашёл в интернете:"}');
    expect(A).toContain('data-ai-web-check=""');
    expect(A).toContain("Ищу в интернете…");
    expect(A).toContain("m.role === \"assistant\" && !m.viaWeb && i === msgs.length - 1 && !sending && webCheckable(");
  });
  it("барная карта: «Поискать в интернете · N» в сводке и в итоге «Дописать пустое»; по одной позиции; цена — на экране вопроса; ссылки в проверке и форме", () => {
    expect(E).toContain("data-wine-web={webN}");
    expect(E).toContain("data-wine-bulk-web={webN}");
    expect(E).toContain("jobs = bulkJobs(pl, web ? 1 : BULK_BATCH)");
    expect(E).toContain("...(web ? { web: true } : {})");
    expect(E).toContain("a = web ? webApply(KK, cur, r.items, r.got, Date.now()) : bulkApply(KK, cur, r.items, r.got)");
    expect(E).toContain("Поиск стоит денег: около 3–6 ₽ за позицию, с баланса OpenRouter.");
    expect(E).toContain("{webLine(cur, { marginTop: 4 })}");
    expect(E).toContain("{webLine(form)}");
    expect(E).toContain('onClick={() => runBulk(web ? "web" : "gaps")}');
  });
});

describe("v152: метка и журнал", () => {
  it("метка «сборка v152», Дополнение 476 со словами владельца, e2e-v152 в README", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    expect(n[0]).toBeGreaterThanOrEqual(152);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 476 — .*\(v152\)/);
    expect(c).toContain("Мы можем дать моему ассистенту выход в интернет");
    expect(c).toContain("сам проверить инфу по алкоголю в сети");
    expect(rd("tools/claude/README.md")).toContain("`e2e-v152.mjs` — v152 (Доп. 476)");
  });
});
