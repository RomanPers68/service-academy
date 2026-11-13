// v155 (Доп. 479): запасной путь поиска в интернете и «кто отказал». Владелец (13.11, снимок: «Не получилось поискать в
// интернете: сервер ответил кодом 403. Попробуй ещё раз»): «Теперь 403 😑». 403 наша функция не отвечает никогда — запрос
// отказал хостинг (Vercel) или что-то перед ним. Теперь ответ не от нашей функции (не JSON) — тот же запрос через
// /api/wine-import (via: "web-answer"), этот маршрут давно работает у барной карты; не помогло — в ошибке видно, кто отказал
// (x-vercel-error, x-vercel-mitigated, server, первые слова страницы). Экран — tools/claude/e2e-v155.mjs.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { httpWhy, webPost, webErrText, packWeb, unpackWeb, slimHistory, splitWebLine } from "../lib/ai-web";
import { webAsked, webMore, topicWords, foodInMenu } from "../lib/reference-context";
import { mentorContext } from "../lib/chat-smart";

const rd = (p) => readFileSync(p, "utf8");
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() }; };
const hdr = (o) => new Map(Object.entries(o));

describe("v155: кто ответил вместо нашей функции (lib/ai-web.js: httpWhy)", () => {
  it("заголовки Vercel, server и заголовок страницы; без них — первые слова текста", () => {
    expect(httpWhy(hdr({ "x-vercel-mitigated": "deny", server: "Vercel", "x-vercel-error": "" }), "<html><head><title>403: FORBIDDEN</title></head><body><script>x()</script>Нет</body></html>"))
      .toBe("x-vercel-mitigated: deny; server: Vercel; «403: FORBIDDEN»");
    expect(httpWhy(hdr({ server: "nginx" }), "<html><body><h1>403 Forbidden</h1><hr><center>nginx/1.24</center></body></html>")).toBe("server: nginx; «403 Forbidden nginx/1.24»");
    expect(httpWhy(null, "")).toBe("");
    expect(httpWhy({ "x-vercel-error": "FUNCTION_INVOCATION_TIMEOUT" }, "An error occurred with your deployment &nbsp; FUNCTION_INVOCATION_TIMEOUT")).toBe("x-vercel-error: FUNCTION_INVOCATION_TIMEOUT; «An error occurred with your deployment FUNCTION_INVOCATION_TIMEOUT»");
  });
  it("текст ошибки: код, кто отказал и что ответил запасной путь", () => {
    expect(webErrText({ ok: false, error: "http", status: 403, why: "server: Vercel; «403: FORBIDDEN»", alt: 403 }))
      .toBe("Не получилось поискать в интернете: сервер ответил кодом 403 (server: Vercel; «403: FORBIDDEN»), запасной путь — кодом 403. Попробуй ещё раз");
    expect(webErrText({ ok: false, error: "http", status: 502 })).toBe("Не получилось поискать в интернете: сервер ответил кодом 502. Попробуй ещё раз");
  });
});

describe("v155: запрос с запасным путём (lib/ai-web.js: webPost)", () => {
  const real = globalThis.fetch;
  let calls = [], plan = {};
  beforeEach(() => {
    calls = []; plan = {};
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url, body: JSON.parse(init.body) });
      const p = plan[url] || { json: { ok: true, reply: "Ответ" } };
      if (p.throws) throw new Error("offline");
      return { status: p.status || 200, headers: hdr(p.headers || {}), text: async () => (p.html != null ? p.html : JSON.stringify(p.json)) };
    };
  });
  afterAll(() => { globalThis.fetch = real; });
  it("ответ нашей функции (JSON, и с ошибкой) — как есть, без второго запроса", async () => {
    plan["/api/web-answer"] = { status: 200, json: { ok: false, error: "server", message: "Ошибка OpenRouter: …" } };
    expect(await webPost({ token: "t", question: "q" })).toEqual({ ok: false, error: "server", message: "Ошибка OpenRouter: …" });
    expect(calls.map((c) => c.url)).toEqual(["/api/web-answer"]);
  });
  it("хостинг отказал (403, не JSON) — тот же запрос через /api/wine-import с via: \"web-answer\", его ответ", async () => {
    plan["/api/web-answer"] = { status: 403, html: "<title>403: FORBIDDEN</title>", headers: { server: "Vercel" } };
    plan["/api/wine-import"] = { json: { ok: true, reply: "Нашёл.", sources: [] } };
    expect(await webPost({ token: "t", mode: "desc", dish: { name: "Борщ" } })).toEqual({ ok: true, reply: "Нашёл.", sources: [] });
    expect(calls.map((c) => [c.url, Object.keys(c.body).sort().join(",")])).toEqual([["/api/web-answer", "token,z"], ["/api/wine-import", "token,via,z"]]);
    expect(await unpackWeb(calls[1].body)).toEqual({ mode: "desc", dish: { name: "Борщ" }, token: "t", via: "web-answer" });
  });
  it("отказал и запасной путь — ошибка первого с кодом второго; нет связи — net", async () => {
    plan["/api/web-answer"] = { status: 403, html: "<title>403: FORBIDDEN</title>", headers: { "x-vercel-mitigated": "deny" } };
    plan["/api/wine-import"] = { status: 403, html: "Forbidden" };
    expect(await webPost({ token: "t" })).toEqual({ ok: false, error: "http", status: 403, why: "x-vercel-mitigated: deny; «403: FORBIDDEN»", alt: 403, altWhy: "«Forbidden»" });
    plan["/api/web-answer"] = { throws: true };
    expect(await webPost({ token: "t" })).toEqual({ ok: false, error: "net" });
  });
});

describe("v155: запрос упакован — фильтр хостинга видит только буквы и цифры (lib/ai-web.js, api/web-answer.js)", () => {
  it("packWeb: { token, z } — сжатый JSON; unpackWeb и unpack на сервере читают обратно; открытый JSON — как есть", async () => {
    const body = { token: "t1", question: "Что за вино Château Margaux? Maker's Mark [[go:menu|Открыть меню]] <b>", check: "ответ ".repeat(300), context: "Ресторан: Два моря." };
    const p = await packWeb(body);
    expect(Object.keys(p).sort()).toEqual(["token", "z"]);
    expect(p.z).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(p.z.length).toBeLessThan(JSON.stringify(body).length / 3);
    const W = await import("../api/web-answer.js");
    const { token, ...rest } = body;
    expect(W.unpack(p)).toEqual({ ...rest, token: "t1" });
    expect(await unpackWeb({ ...p, via: "web-answer" })).toEqual({ ...rest, token: "t1", via: "web-answer" });
    const plain = { token: "t2", p: Buffer.from(JSON.stringify({ question: "Шабли?" }), "utf8").toString("base64") };
    expect(W.unpack(plain)).toEqual({ question: "Шабли?", token: "t2" });
    expect(W.unpack({ token: "t3", question: "открытый JSON" })).toEqual({ token: "t3", question: "открытый JSON" });
    expect(W.unpack({ token: "t4", z: "это не base64 и не deflate" })).toEqual({ token: "t4", bad: true });
  });
  it("история для поиска: последние 4 реплики, без служебных меток, по 400 знаков", () => {
    const h = slimHistory([{ role: "user", content: "раз" }, { role: "assistant", content: "два" }, { role: "user", content: "три" },
      { role: "assistant", content: "Ответ [[go:menu|Открыть меню]]  и [[lesson:l1|Урок]] " + "я".repeat(500) }, { role: "user", content: "пять" }]);
    expect(h.length).toBe(4);
    expect(h[0]).toEqual({ role: "assistant", content: "два" });
    expect(h[2].content.startsWith("Ответ и яяя")).toBe(true);
    expect(h[2].content.length).toBe(400);
  });
});

describe("v155: /api/wine-import передаёт via: \"web-answer\" функции поиска", () => {
  const real = globalThis.fetch;
  let A, bodies = [];
  beforeAll(async () => {
    process.env.OPENROUTER_API_KEY = "k";
    globalThis.fetch = async (url, init = {}) => {
      if (/rpc\/whoami/.test(url)) return { ok: true, json: async () => ({ ok: true, employee: { id: "u1" } }) };
      const b = JSON.parse(init.body); bodies.push(b);
      return { ok: true, status: 200, json: async () => ({ model: b.model, choices: [{ message: { content: "Ответ из интернета.", annotations: [{ type: "url_citation", url_citation: { url: "https://w.example/a", title: "W" } }] } }] }) };
    };
    A = await import("../api/wine-import.js");
  });
  afterAll(() => { globalThis.fetch = real; delete process.env.OPENROUTER_API_KEY; });
  const call = (body) => new Promise((ok) => { const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); return this; } }; A.default({ method: "POST", body }, res); });
  it("вопрос ассистенту через запасной путь — ответ как у /api/web-answer (ссылки, правила наставника)", async () => {
    bodies = [];
    const r = await call({ via: "web-answer", token: "t155", question: "Что за вино Château Margaux?", context: "Ресторан: Два моря." });
    expect(r).toMatchObject({ code: 200, j: { ok: true, reply: "Ответ из интернета.", sources: [{ url: "https://w.example/a", title: "W" }] } });
    expect(bodies[0].messages[0].content).toContain("Ты — «Наставник» академии сервиса");
  });
  it("упакованный запрос через запасной путь — тоже читается", async () => {
    bodies = [];
    const p = await packWeb({ token: "t155b", question: "Что за виски Ardbeg?", context: "" });
    const r = await call({ ...p, via: "web-answer" });
    expect(r.j).toMatchObject({ ok: true, reply: "Ответ из интернета." });
    expect(bodies[0].messages[bodies[0].messages.length - 1].content).toContain("Вопрос сотрудника: Что за виски Ardbeg?");
  });
  it("без via — как раньше (поиск ассистента сюда не попадает)", async () => {
    const r = await call({ token: "t155", mode: "fill" });
    expect(r.code).toBe(400);
    expect(r.j).toEqual({ error: "Нет названия" });
  });
});

describe("v155: экраны и демо", () => {
  it("ассистент, переписка и описания блюд — через webPost; демо отвечает и на запасном пути", () => {
    expect(rd("ui/assistant.jsx")).toContain("const askWeb = (body) => webPost({ token: saToken(), ...body });");
    expect(rd("ui/assistant.jsx")).toContain("askWeb({ question: text, history: slimHistory(next.slice(0, -1)), context: webContextOf(text) })");
    expect(rd("ui/assistant.jsx")).toContain("askWeb({ question: q, check: cleanReply(parseCards(parseNav(a).clean).clean).slice(0, 1500), context: webContextOf(q) })");
    expect(rd("api/web-answer.js")).toContain("const b = unpack(req.body || {});");
    expect(rd("lib/chat-ai.js")).toContain("const w = await webPost({ token: saToken(), question: q, context, chat: true, history: slimHistory(ctx, 4, 700) });");
    expect(rd("ui/menu-trainer.jsx")).toContain('webPost({ token: saToken(), mode: "desc", restaurant, round, seen, dish }).then(w => {');
    expect(rd("api/wine-import.js")).toContain('if (req.body && req.body.via === "web-answer") return webAnswer(req, res);');
    expect(rd("tools/claude/demo-app/boot.js")).toContain('if (b.via === "web-answer") return b.mode === "desc" ? demoDesc(b) : demoWebAnswer(b);');
  });
});

describe("v155: метка и журнал", () => {
  it("метка «сборка v155», Дополнение 479 со словами владельца, e2e-v155 в README", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    expect(n[0]).toBeGreaterThanOrEqual(155);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 479 — .*\(v155\)/);
    expect(c).toContain("Теперь 403 😑");
    expect(rd("tools/claude/README.md")).toContain("`e2e-v155.mjs` — v155 (Доп. 479)");
  });
});

describe("v155: «Заполнить по названию» ничего не дописал — «Поискать в интернете» (ui/wine-editor.jsx, api/wine-import.js)", () => {
  const real = globalThis.fetch;
  let A, reply = "[]";
  beforeAll(async () => {
    process.env.OPENROUTER_API_KEY = "k";
    globalThis.fetch = async (url) => {
      if (/rpc\/whoami/.test(url)) return { ok: true, json: async () => ({ ok: true, employee: { id: "u1" } }) };
      return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ finish_reason: "stop", message: { content: reply } }] }) };
    };
    A = await import("../api/wine-import.js");
  });
  afterAll(() => { globalThis.fetch = real; delete process.env.OPENROUTER_API_KEY; });
  const call = (body) => new Promise((ok) => { const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); return this; } }; A.default({ method: "POST", body }, res); });
  it("сервер: в карточке есть факты, а дописать нечего — 200 «нечего дописать», а не «не узнала»; пустая карточка — 422 как раньше", async () => {
    reply = "[]";
    const known = await call({ token: "tf", mode: "fill", kind: "spirit", name: "ДЖЕК ДЭНИЕЛС / JACK DANIELS", known: { producer: "Jack Daniel Distillery", cat: "whisky", country: "США" } });
    expect(known).toEqual({ code: 200, j: { wines: [], nothing: true, model: "m" } });
    const blank = await call({ token: "tf", mode: "fill", kind: "spirit", name: "Неизвестная настойка", known: {} });
    expect(blank).toEqual({ code: 422, j: { error: "Модель не узнала этот напиток: заполни руками" } });
  });
  it("экран: что осталось пустым — словами; «Поискать в интернете» с ценой; поиск — одна позиция через «gaps» с web; найденное — с «AI» и ссылками", () => {
    const E = rd("ui/wine-editor.jsx");
    expect(E).toContain('setAiNote(left ? "По названию AI больше ничего не знает: пусто — " + left + ". Можно поискать в интернете" : "AI не знает об этой позиции больше, чем уже вписано");');
    expect(E).toContain("setWebOffer(/не узнала/.test(String(e.message)) && !!emptyRu(formRef.current || form));");
    expect(E).toContain('askAiK({ mode: "gaps", web: true, items: [{ name, known, missing }] })');
    expect(E).toContain("setForm((x) => ({ ...K.mergeAi(x, fields), aiWeb: { at: Date.now(), src: (Array.isArray(src) ? src : []).slice(0, 3) } }));");
    expect(E).toContain('data-wine-fill-web="" onClick={webFill}');
    expect(E).toContain("около 3–6 ₽ с баланса OpenRouter; найденное — с «AI» и ссылками");
    expect(E).toContain('setAiNote("В интернете ничего подходящего не нашлось: заполни руками");');
  });
});

describe("v155: в строке ссылок — по одной на сайт (lib/ai-web.js: oneSite)", () => {
  it("две статьи aif.ru — одна ссылка; порядок — как был", async () => {
    const { oneSite } = await import("../lib/ai-web");
    expect(oneSite([{ url: "https://ru.wikipedia.org/a" }, { url: "https://aif.ru/1" }, { url: "https://www.aif.ru/2" }, { url: "https://seafood-shop.ru/x" }, null, { url: "" }]).map((x) => x.url))
      .toEqual(["https://ru.wikipedia.org/a", "https://aif.ru/1", "https://seafood-shop.ru/x"]);
    for (const f of ["ui/assistant.jsx", "ui/chat-cards.jsx", "ui/wine-editor.jsx", "ui/menu-trainer.jsx"]) expect(rd(f)).toContain("oneSite(");
  });
});

// ── v155: владелец, снимок переписки: «@Наставник Подскажи, что за рыба такая Чавыча😉» — ответ без интернета; «@Наставник а ты
// можешь подробную информацию найти в сети?» — ответ про вино. «И в чате наставник не использует поиск в сети🥺».
describe("v155: вопрос о продукте не из меню — с поиском в интернете (lib/reference-context.js: webAsked)", () => {
  beforeAll(() => {
    globalThis.localStorage = memStore();
    localStorage.setItem("sa_menu_shared", JSON.stringify({ "Тест-бар": [{ id: "t-1", name: "Стейк из нерки", cat: "Горячее", ingredients: ["Нерка", "Лимон"] }] }));
  });
  afterAll(() => { delete globalThis.localStorage; });
  it("«что за рыба / сыр / специя / сорт …» о том, чего нет ни в меню, ни в карте, — в интернет", () => {
    for (const q of ["Подскажи, что за рыба такая Чавыча😉", "Чавыча — что за рыба?", "Что за сыр Бри?", "Расскажи про сыр Бри", "что за специя зира", "Что за порода Вагю?"])
      expect([q, webAsked(q, "Тест-бар")]).toEqual([q, true]);
    expect(topicWords("Подскажи, что за рыба такая Чавыча😉")).toEqual(["чавыча"]);
  });
  it("есть в меню — ответ по карточке блюда (ai-chat); вид без названия, вопросы о работе и об одной марке — без интернета", () => {
    expect(foodInMenu("что за рыба нерка?", "Тест-бар")).toBe(true);
    for (const q of ["что за рыба нерка?", "что за рыба такая?", "что такое рыба", "Что такое upsell?", "Что такое Юдзу?", "Что за гость Иван Петрович?", "Что за специальное предложение?",
      "что за шум на кухне", "Что за продукты пришли на приёмку?", "Что за рыба сегодня в стоп-листе?", "что за закуска сегодня в комплимент", "Как закрыть смену?", "Что такое сервировка?"])
      expect([q, webAsked(q, "Тест-бар")]).toEqual([q, false]);
  });
  it("«а подробнее?» после вопроса, на который отвечали из интернета, — тоже в интернет; после вопроса о работе — нет", () => {
    expect(webMore("а подробнее?", "Что за рыба такая Чавыча", "Тест-бар")).toBe(true);
    expect(webMore("расскажи больше про неё", "Что за сыр Бри?", "Тест-бар")).toBe(true);
    expect(webMore("а подробнее?", "как закрыть смену", "Тест-бар")).toBe(false);
    expect(webMore("а подробнее?", "", "Тест-бар")).toBe(false);
    expect(webMore("спасибо!", "Что за сыр Бри?", "Тест-бар")).toBe(false);
  });
});

describe("v155: Наставник в переписке помнит свой прошлый ответ (lib/chat-smart.js: mentorContext)", () => {
  const q1 = { id: 10, kind: "text", emp: "u1", body: "@Наставник Подскажи, что за рыба такая Чавыча😉", at: "2026-11-13T10:00:00Z" };
  const a1 = { id: 11, kind: "ai", body: "Чавыча — крупный тихоокеанский лосось.\n\nНашёл в интернете: https://ru.wikipedia.org/wiki/Chinook", at: "2026-11-13T10:00:20Z", reply: { id: 10, body: q1.body } };
  const q2 = { id: 12, kind: "text", emp: "u1", body: "@Наставник а ты можешь подробную информацию найти в сети?", at: "2026-11-13T10:02:00Z" };
  it("прошлая пара «вопрос — ответ» Наставника: вопрос без «@Наставник», ответ без строки ссылок", () => {
    expect(mentorContext([q1, a1, q2], q2)).toEqual([{ role: "user", content: "Подскажи, что за рыба такая Чавыча😉" }, { role: "assistant", content: "Чавыча — крупный тихоокеанский лосось." }]);
  });
  it("старше 30 минут, удалён, позже вопроса или ответов нет — без прошлого; вопрос удалён — только ответ", () => {
    expect(mentorContext([q1, a1, { ...q2, at: "2026-11-13T10:40:00Z" }], { ...q2, at: "2026-11-13T10:40:00Z" })).toEqual([]);
    expect(mentorContext([q1, { ...a1, del: true }, q2], q2)).toEqual([]);
    expect(mentorContext([q1, q2, { ...a1, id: 13 }], q2)).toEqual([]);
    expect(mentorContext([q1, q2], q2)).toEqual([]);
    expect(mentorContext([q1, { ...a1, reply: { id: 10, del: true } }, q2], q2)).toEqual([{ role: "assistant", content: "Чавыча — крупный тихоокеанский лосось." }]);
  });
});

describe("v155: Наставник в переписке — с прошлой парой и поиском о продуктах (lib/chat-ai.js: chatAi)", () => {
  const real = globalThis.fetch;
  let C, calls = [];
  beforeAll(async () => {
    globalThis.localStorage = memStore();
    localStorage.setItem("sa_session_token", "tok");
    globalThis.fetch = async (url, init = {}) => {
      const body = JSON.parse(init.body || "{}"); calls.push({ url: String(url), body });
      const resp = (j) => ({ status: 200, headers: new Map(), json: async () => j, text: async () => JSON.stringify(j) });
      if (/\/api\/web-answer/.test(url)) return resp({ ok: true, reply: "Чавыча — королевский лосось.", sources: [{ url: "https://w.example/chinook" }], searched: 1 });
      return resp({ ok: true, reply: "Обычный ответ Наставника." });
    };
    C = await import("../lib/chat-ai");
  });
  afterAll(() => { globalThis.fetch = real; delete globalThis.localStorage; });
  const prof = { restaurant: "Тест-бар" };
  const ctx = [{ role: "user", content: "Подскажи, что за рыба такая Чавыча😉" }, { role: "assistant", content: "Чавыча — крупный тихоокеанский лосось." }];
  it("«что за рыба такая Чавыча» — из интернета, со строкой ссылок", async () => {
    calls = [];
    const a = await C.chatAi("Подскажи, что за рыба такая Чавыча😉", prof, {});
    expect(a.text).toBe("Чавыча — королевский лосось.\n\nНашёл в интернете: https://w.example/chinook");
    expect(calls.map((c) => c.url)).toEqual(["/api/web-answer"]);
  });
  it("«найди в сети подробнее» — в интернет, и прошлая пара уходит историей: модель знает, о чём речь", async () => {
    calls = [];
    await C.chatAi("а ты можешь подробную информацию найти в сети?", prof, {}, ctx);
    const sent = await unpackWeb(calls[0].body);
    expect(sent.question).toBe("а ты можешь подробную информацию найти в сети?");
    expect(sent.history).toEqual(ctx);
    calls = [];
    expect(splitWebLine((await C.chatAi("а подробнее?", prof, {}, ctx)).text).src).toEqual([{ url: "https://w.example/chinook" }]);
    expect(calls.map((c) => c.url)).toEqual(["/api/web-answer"]);
  });
  it("обычный вопрос — ai-chat, и прошлая пара перед вопросом; пара не с вопроса — без неё", async () => {
    calls = [];
    expect((await C.chatAi("а как её подать гостю?", prof, {}, ctx)).text).toBe("Обычный ответ Наставника.");
    const m = calls[0].body.messages;
    expect(/functions\/v1\/ai-chat/.test(calls[0].url)).toBe(true);
    expect(m.slice(0, 2)).toEqual(ctx);
    expect(m[2].role).toBe("user");
    expect(m[2].content.startsWith("а как её подать гостю?")).toBe(true);
    calls = [];
    await C.chatAi("а как её подать гостю?", prof, {}, [ctx[1]]);
    expect(calls[0].body.messages.length).toBe(1);
  });
  it("переписка, приложение и ассистент: пара — из ленты; ассистент тоже ищет на «а подробнее?»; правило модели — искать, раз позвали", () => {
    expect(rd("ui/chat.jsx")).toContain("api.aiAsk(chat.id, m.id, aiQuestion(body), mentorContext(msgsRef.current, m))");
    expect(rd("lib/chat-api.js")).toContain("try { a = await ai(question, ctx); }");
    expect(rd("App.jsx")).toContain('chatAiRef.current = (q, ctx) => import("./lib/chat-ai").then((m) => m.chatAi(q, profile, assistantLearner(), ctx));');
    expect(rd("ui/assistant.jsx")).toContain("if (!webAsked(text, profile?.restaurant) && !webMore(text, prevQ, profile?.restaurant)) { chat(); return; }");
    expect(rd("api/web-answer.js")).toContain("Поищи в интернете хотя бы раз, даже если ответ кажется");
    expect(rd("api/web-answer.js")).not.toContain("Если уверенно знаешь ответ — отвечай без поиска");
  });
});
