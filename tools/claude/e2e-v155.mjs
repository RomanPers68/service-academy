// e2e v155 (Доп. 479): запасной путь поиска в интернете. Сайт — демо целиком (tools/claude/demo-app/build.mjs; запасной путь
// /api/wine-import с via: "web-answer" в демо отвечает, как /api/web-answer). Поверх fetch: /api/web-answer отказывает
// страницей 403 (как хостинг), а в режиме BOTH — и запасной путь.
// Разделы: CHECK (Анна: «Проверить в интернете» — через запасной путь, «Проверил в интернете: example.com», без ошибки),
// ASK («Château Margaux» — ответ из интернета через запасной путь), CHAT («@Наставник» в переписке — со ссылкой), FOOD
// («@Наставник что за рыба такая Чавыча» — с поиском; «найди в сети подробнее» — про чавычу: прошлая пара уходит историей;
// блюдо из меню — без интернета, с прошлой парой; ассистент — так же и «а подробнее?» в интернет), DESC
// (Мария: пять вариантов описания с «Идеями из интернета»), BOTH (отказали оба — ошибка с кодом, кто отказал и кодом
// запасного пути), EDIT (Мария, правка позиции крепкого: «Заполнить по названию» ничего не дописал — что пусто и «Поискать в
// интернете»; кальвадос — нашлось, с «AI» и ссылкой; «Модель не узнала» — тоже с поиском; настойка — не нашлось), NARROW (320 px).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v155.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5355, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v155";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(extra).slice(0, 600) : "")); } };
const browser = await chromium.launch();

async function open({ who = "anna", width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
  // /api/web-answer всегда — страница 403, как у хостинга; в режиме BOTH отказывает и запасной путь
  await page.evaluate(() => {
    const f = window.fetch; window.__calls = []; window.__both = false;
    const deny = () => new Promise((ok) => setTimeout(() => ok(new Response("<html><head><title>403: FORBIDDEN</title></head><body>Forbidden</body></html>",
      { status: 403, headers: { "Content-Type": "text/html", "x-vercel-mitigated": "deny" } })), 300));
    window.fetch = (u, init) => {
      const url = String(u), raw = /\/api\//.test(url) && init && init.body ? JSON.parse(init.body) : {};
      if (/\/api\/web-answer/.test(url)) { window.__calls.push("web-answer"); window.__keys = Object.keys(raw).sort().join(","); window.__plainText = /question|check|context|history/.test(String(init.body)); return deny(); }
      // v155: запрос упакован ({ token, z, via }) — что внутри, читаем через window.__demoUnpack (демо)
      if (/\/api\/wine-import/.test(url) && raw.via === "web-answer") return window.__demoUnpack(raw).then((b) => {
        window.__calls.push("wine-import:" + (b.mode || (b.chat ? "chat" : b.check ? "check" : "ask")) + (raw.z || raw.p ? "" : ":plain"));
        (window.__bodies = window.__bodies || []).push(b);   // FOOD: что ушло (история)
        return window.__both ? deny() : f(u, init);
      });
      if (/\/functions\/v1\/ai-chat/.test(url)) { try { (window.__aichat = window.__aichat || []).push(JSON.parse(init.body).messages || []); } catch (e) { /* */ } }
      return f(u, init);
    };
  });
  return { ctx, page, errs };
}
const txt = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; }, sel);
const calls = (page) => page.evaluate(() => window.__calls.slice());
const assistant = async (page) => { await page.evaluate(() => window.__saNav("assistant")); await page.waitForTimeout(1800); };
const send = async (page, q) => {
  await page.fill("textarea", q); await page.waitForTimeout(150);
  await page.evaluate(() => { const t = document.querySelector("textarea"); const b = t && t.closest("[data-lens-field]") && [...t.closest("[data-lens-field]").querySelectorAll("button")].pop(); if (b) b.click(); });
};
const idle = (page, ms = 15000) => page.waitForFunction(() => !document.querySelector("[data-ai-web-busy]") && !document.querySelector(".sa-pulse"), null, { timeout: ms }).catch(() => {});
const inView = (page, sel) => page.evaluate((s) => { const all = [...document.querySelectorAll(s)]; return all.length > 0 && all.every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; }); }, sel);
const ov = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);

// ── CHECK ──────────────────────────────────────────────────────────────────────────────────────
if (want("CHECK")) {
  const { ctx, page, errs } = await open();
  await assistant(page);
  await send(page, "Расскажи про Шабли");
  await page.waitForSelector("[data-ai-web-check]", { timeout: 15000 }).catch(() => {});
  await idle(page);
  await page.evaluate(() => { const b = document.querySelector("[data-ai-web-check]"); if (b) b.click(); });
  await page.waitForSelector("[data-ai-web]", { timeout: 15000 }).catch(() => {});
  await idle(page);
  ok("CHECK: хостинг отказал (403) — через запасной путь: «Проверил в интернете: example.com», без ошибки", (await txt(page, "[data-ai-web]")) === "Проверил в интернете: example.com" && !(await page.$("[data-ai-error]")));
  ok("CHECK: запросы — /api/web-answer, потом /api/wine-import с via: \"web-answer\"", JSON.stringify(await calls(page)) === JSON.stringify(["web-answer", "wine-import:check"]), JSON.stringify(await calls(page)));
  ok("CHECK: запрос упакован — в теле только token и z (сжато), ни вопроса, ни ответа открытым текстом", (await page.evaluate(() => window.__keys)) === "token,z" && !(await page.evaluate(() => window.__plainText)),
    await page.evaluate(() => window.__keys));
  await page.screenshot({ path: join(OUT, "check.png") });
  ok("CHECK: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── ASK ────────────────────────────────────────────────────────────────────────────────────────
if (want("ASK")) {
  const { ctx, page, errs } = await open();
  await assistant(page);
  await send(page, "Что за вино Château Margaux?");
  await page.waitForSelector("[data-ai-web]", { timeout: 15000 }).catch(() => {});
  await idle(page);
  ok("ASK: «Château Margaux» — ответ из интернета через запасной путь, без «Ответ без интернета»", (await txt(page, "[data-ai-web]")) === "Нашёл в интернете: example.com" && !(await page.$("[data-ai-web-miss]")));
  ok("ASK: запросы — web-answer → wine-import", JSON.stringify(await calls(page)) === JSON.stringify(["web-answer", "wine-import:ask"]), JSON.stringify(await calls(page)));
  ok("ASK: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── CHAT ───────────────────────────────────────────────────────────────────────────────────────
if (want("CHAT")) {
  const { ctx, page, errs } = await open();
  await page.locator("[data-chat-disc]").first().click(); await page.waitForTimeout(1300);
  await page.locator('[data-chat-item="team"]').first().click(); await page.waitForTimeout(1600);
  await page.locator("textarea.ch-input").fill("@Наставник что за вино Château Margaux?"); await page.waitForTimeout(300);
  await page.locator("[data-chat-send]").click();
  await page.waitForSelector("[data-chat-ai-web]", { timeout: 15000 }).catch(() => {});
  ok("CHAT: «@Наставник» — ответ со ссылкой через запасной путь", (await txt(page, "[data-chat-ai-web]")) === "Нашёл в интернете: example.com" && JSON.stringify(await calls(page)) === JSON.stringify(["web-answer", "wine-import:chat"]), JSON.stringify(await calls(page)));
  ok("CHAT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── FOOD ───────────────────────────────────────────────────────────────────────────────────────
// Владелец, снимок переписки: «@Наставник Подскажи, что за рыба такая Чавыча😉» — ответ без интернета; «@Наставник а ты можешь
// подробную информацию найти в сети?» — ответ про вино. Теперь: продукт не из меню — с поиском; уточнение — с прошлой парой.
const aiMsgs = (page) => page.evaluate(() => [...document.querySelectorAll("[data-chat-ai]")].map((m) => ({ tx: ((m.querySelector(".ch-tx") || {}).innerText || "").replace(/\s+/g, " ").trim(),
  web: m.querySelector("[data-chat-ai-web]") ? m.querySelector("[data-chat-ai-web]").innerText.replace(/\s+/g, " ").trim() : "" })));
const waitAi = (page, n, ms = 15000) => page.waitForFunction((k) => document.querySelectorAll("[data-chat-ai]").length >= k, n, { timeout: ms }).then(() => true).catch(() => false);
const chatAsk = async (page, q) => { await page.locator("textarea.ch-input").fill(q); await page.waitForTimeout(300); await page.locator("[data-chat-send]").click(); };
const lastWebReply = (page) => page.evaluate(() => { const w = [...document.querySelectorAll("[data-ai-web]")].pop(); const b = w && w.closest(".dlg-in"); return b ? b.innerText.replace(/\s+/g, " ").trim() : ""; });
if (want("FOOD")) {
  const { ctx, page, errs } = await open();
  await page.locator("[data-chat-disc]").first().click(); await page.waitForTimeout(1300);
  await page.locator('[data-chat-item="team"]').first().click(); await page.waitForTimeout(1600);
  await chatAsk(page, "@Наставник Подскажи, что за рыба такая Чавыча😉");
  ok("FOOD: ответ Наставника пришёл", await waitAi(page, 1));
  const m1 = (await aiMsgs(page))[0] || {};
  ok("FOOD: «что за рыба такая Чавыча» (в меню нет) — из интернета, «Нашёл в интернете: example.com»", /^Чавыча — самый крупный из тихоокеанских лососей/.test(m1.tx) && m1.web === "Нашёл в интернете: example.com", JSON.stringify(m1));
  ok("FOOD: запрос — в интернет (web-answer → запасной путь), вопрос без «@Наставник»", JSON.stringify(await calls(page)) === JSON.stringify(["web-answer", "wine-import:chat"])
    && (await page.evaluate(() => window.__bodies[0].question)) === "Подскажи, что за рыба такая Чавыча😉", JSON.stringify(await calls(page)));
  await chatAsk(page, "@Наставник а ты можешь подробную информацию найти в сети?");
  await waitAi(page, 2);
  const m2 = (await aiMsgs(page))[1] || {};
  ok("FOOD: «найди в сети подробнее» — про чавычу, а не про вино: прошлая пара ушла историей", /^Подробнее о чавыче/.test(m2.tx) && m2.web === "Нашёл в интернете: example.com", JSON.stringify(m2));
  const h = await page.evaluate(() => window.__bodies[1].history || []);
  ok("FOOD: история — прошлый вопрос и ответ Наставника, без строки ссылок", h.length === 2 && h[0].role === "user" && h[0].content === "Подскажи, что за рыба такая Чавыча😉"
    && h[1].role === "assistant" && /^Чавыча — самый крупный/.test(h[1].content) && !/Нашёл в интернете|https?:/.test(h[1].content), JSON.stringify(h));
  await page.screenshot({ path: join(OUT, "food-chat.png") });
  await chatAsk(page, "@Наставник Что за закуска Креветка темпура?");
  await waitAi(page, 3);
  const ai = await page.evaluate(() => window.__aichat || []);
  ok("FOOD: блюдо из меню («Креветка темпура») — без интернета (ai-chat), перед вопросом — прошлая пара Наставника", (await calls(page)).length === 4 && ai.length === 1
    && ai[0].length === 3 && ai[0][0].role === "user" && ai[0][1].role === "assistant" && /^Подробнее о чавыче/.test(ai[0][1].content) && /^Что за закуска Креветка темпура\?/.test(ai[0][2].content), JSON.stringify([await calls(page), ai.map((x) => x.map((y) => y.role + ":" + String(y.content).slice(0, 30)))]));
  ok("FOOD: переписка без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
  // ассистент: тот же вопрос — с поиском; «а подробнее?» — тоже в интернет, с историей
  const o = await open();
  await assistant(o.page);
  await send(o.page, "Что за рыба такая Чавыча?");
  await o.page.waitForSelector("[data-ai-web]", { timeout: 15000 }).catch(() => {});
  await idle(o.page);
  ok("FOOD: ассистент — «что за рыба такая Чавыча?» из интернета", /Чавыча — самый крупный/.test(await lastWebReply(o.page)) && (await txt(o.page, "[data-ai-web]")) === "Нашёл в интернете: example.com", await lastWebReply(o.page));
  await send(o.page, "а подробнее?");
  await o.page.waitForFunction(() => document.querySelectorAll("[data-ai-web]").length >= 2, null, { timeout: 15000 }).catch(() => {});
  await idle(o.page);
  ok("FOOD: ассистент — «а подробнее?» тоже в интернет, тема из прошлого вопроса", /^Подробнее о чавыче/.test(await lastWebReply(o.page))
    && JSON.stringify(await calls(o.page)) === JSON.stringify(["web-answer", "wine-import:ask", "web-answer", "wine-import:ask"]), JSON.stringify([await calls(o.page), await lastWebReply(o.page)]));
  await o.page.screenshot({ path: join(OUT, "food-assistant.png") });
  ok("FOOD: ассистент без ошибок страницы", !o.errs.length, o.errs.join(" | "));
  await o.ctx.close();
}

// ── DESC ───────────────────────────────────────────────────────────────────────────────────────
if (want("DESC")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  await page.evaluate(() => window.__saNav("menuTrainer")); await page.waitForTimeout(1800);
  await page.locator("text=Редактор меню").first().click(); await page.waitForTimeout(1300);
  await page.locator("[data-menu-edit]").first().click(); await page.waitForTimeout(1200);
  const btn = page.locator("[data-menu-desc-ai]"); await btn.scrollIntoViewIfNeeded(); await btn.click();
  await page.waitForSelector("[data-menu-desc-web]", { timeout: 15000 }).catch(() => {});
  ok("DESC: пять вариантов с «Идеями из интернета» через запасной путь, без «Без интернета»", (await page.locator("[data-menu-desc-variant]").count()) === 5
    && (await txt(page, "[data-menu-desc-web]")) === "Идеи из интернета: example.com" && !(await page.$("[data-menu-desc-miss]")));
  ok("DESC: запросы — web-answer → wine-import (desc)", JSON.stringify(await calls(page)) === JSON.stringify(["web-answer", "wine-import:desc"]), JSON.stringify(await calls(page)));
  ok("DESC: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── BOTH ───────────────────────────────────────────────────────────────────────────────────────
if (want("BOTH")) {
  const { ctx, page, errs } = await open();
  await assistant(page);
  await send(page, "Расскажи про Шабли");
  await page.waitForSelector("[data-ai-web-check]", { timeout: 15000 }).catch(() => {});
  await idle(page);
  await page.evaluate(() => { window.__both = true; });
  await page.evaluate(() => { const b = document.querySelector("[data-ai-web-check]"); if (b) b.click(); });
  await page.waitForSelector("[data-ai-error]", { timeout: 10000 }).catch(() => {});
  const e = await txt(page, "[data-ai-error]");
  ok("BOTH: отказали оба — «сервер ответил кодом 403 (x-vercel-mitigated: deny; «403: FORBIDDEN»), запасной путь — кодом 403»",
    e === "Не получилось поискать в интернете: сервер ответил кодом 403 (x-vercel-mitigated: deny; «403: FORBIDDEN»), запасной путь — кодом 403. Попробуй ещё раз", e);
  await page.screenshot({ path: join(OUT, "both.png") });
  ok("BOTH: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── EDIT ───────────────────────────────────────────────────────────────────────────────────────
if (want("EDIT")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  // «Заполнить по названию»: ответ сервера — «нечего дописать» (fill) или «не узнала» (fillUnknown); поиск — как в демо
  await page.evaluate(() => {
    const f = window.fetch; window.__fill = "nothing"; window.__gapsWeb = [];
    window.fetch = (u, init) => {
      const url = String(u), b = /\/api\/wine-import/.test(url) && init && init.body ? JSON.parse(init.body) : {};
      if (b.mode === "fill" && window.__fill === "nothing") return Promise.resolve(new Response(JSON.stringify({ wines: [], nothing: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
      if (b.mode === "fill" && window.__fill === "unknown") return Promise.resolve(new Response(JSON.stringify({ error: "Модель не узнала этот напиток: заполни руками" }), { status: 422, headers: { "Content-Type": "application/json" } }));
      if (b.mode === "gaps" && b.web) window.__gapsWeb.push({ kind: b.kind, n: (b.items || []).length, missing: ((b.items || [])[0] || {}).missing || [] });
      return f(u, init);
    };
  });
  await page.evaluate(() => window.__saNav("wines")); await page.waitForTimeout(2000);
  await page.evaluate(() => { const b = document.querySelector('[data-bar-tab="spirit"]'); if (b) b.click(); }); await page.waitForTimeout(800);
  await page.evaluate(() => { const b = document.querySelector("[data-wine-edit]"); if (b) b.click(); }); await page.waitForTimeout(2000);
  const openRow = (n) => page.evaluate((x) => { const r = [...document.querySelectorAll("[data-wine-erow]")].find((e) => e.innerText.includes(x)); const b = r && r.querySelector("[role=button]"); if (b) b.click(); return !!b; }, n);
  const note = () => txt(page, "[data-wine-ai-note]");
  ok("EDIT: в списке крепкого — кальвадос", await openRow("Кальвадос")); await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector("[data-wine-fill]").click()); await page.waitForTimeout(800);
  const n1 = await note();
  ok("EDIT: «Заполнить по названию» ничего не дописал — что пусто словами и «Можно поискать в интернете»", /^По названию AI больше ничего не знает: пусто — .*регион.*\. Можно поискать в интернете$/.test(String(n1)), n1);
  ok("EDIT: рядом — «Поискать в интернете» и цена", (await txt(page, "[data-wine-fill-web]")) === "Поискать в интернете" && /около 3–6 ₽ с баланса OpenRouter/.test(String(await txt(page, "[data-wine-fill-web-cost]"))));
  await page.screenshot({ path: join(OUT, "edit-1-offer.png") });
  await page.evaluate(() => document.querySelector("[data-wine-fill-web]").click()); await page.waitForTimeout(400);
  ok("EDIT: пока ищет — «Ищу в интернете…»", (await txt(page, "[data-wine-fill]")) === "Ищу в интернете…");
  await page.waitForFunction(() => /Нашлось|не нашлось/.test((document.querySelector("[data-wine-ai-note]") || {}).innerText || ""), null, { timeout: 15000 }).catch(() => {});
  const n2 = await note(), region = await page.evaluate(() => { const i = document.querySelector('[data-wine-field="region"]'); return i ? i.value : null; });
  ok("EDIT: кальвадос — «Нашлось в интернете: …», поля вписаны (регион — Нормандия)", /^Нашлось в интернете: .*регион.*Проверь и подтверди$/.test(String(n2)) && /Нормандия/.test(String(region)), JSON.stringify({ n2, region }));
  ok("EDIT: в форме — ссылка «Нашлось в интернете: example.com», кнопки поиска больше нет", (await txt(page, "[data-wine-web-src]")) === "Нашлось в интернете: example.com" && !(await page.$("[data-wine-fill-web]")));
  const gw = await page.evaluate(() => window.__gapsWeb);
  ok("EDIT: запрос — одна позиция, крепкое, web: true, без года, объёма, цен и порции", gw.length === 1 && gw[0].kind === "spirit" && gw[0].n === 1 && gw[0].missing.includes("region")
    && gw[0].missing.every((f) => !["vintage", "volume", "byGlass", "priceGlass", "priceBottle", "portion", "pricePortion"].includes(f)), JSON.stringify(gw));
  await page.screenshot({ path: join(OUT, "edit-2-found.png") });
  // «Модель не узнала» — тоже предлагает поиск; настойку интернет не знает
  await page.evaluate(() => { const b = document.querySelector('[data-lens="back"]'); if (b) b.click(); }); await page.waitForTimeout(900);
  await page.evaluate(() => { window.__fill = "unknown"; });
  await openRow("Облепиха"); await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector("[data-wine-fill]").click()); await page.waitForTimeout(800);
  ok("EDIT: «Модель не узнала этот напиток» — и сразу «Поискать в интернете»", /Модель не узнала этот напиток/.test(String(await page.evaluate(() => (document.querySelector("[role=alert]") || {}).innerText))) && !!(await page.$("[data-wine-fill-web]")));
  await page.evaluate(() => document.querySelector("[data-wine-fill-web]").click());
  await page.waitForFunction(() => /не нашлось/.test((document.querySelector("[data-wine-ai-note]") || {}).innerText || ""), null, { timeout: 15000 }).catch(() => {});
  ok("EDIT: настойка — «В интернете ничего подходящего не нашлось: заполни руками», поля не тронуты", (await note()) === "В интернете ничего подходящего не нашлось: заполни руками" && !(await page.$("[data-wine-web-src]")));
  ok("EDIT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── NARROW ─────────────────────────────────────────────────────────────────────────────────────
if (want("NARROW")) {
  const { ctx, page, errs } = await open({ width: 320, height: 700 });
  await assistant(page);
  await page.evaluate(() => { window.__both = true; });
  await send(page, "Расскажи про Шабли");
  await page.waitForSelector("[data-ai-web-check]", { timeout: 15000 }).catch(() => {});
  await idle(page);
  await page.evaluate(() => { const b = document.querySelector("[data-ai-web-check]"); if (b) b.click(); });
  await page.waitForSelector("[data-ai-error]", { timeout: 10000 }).catch(() => {});
  ok("NARROW: 320 px — длинная ошибка с причиной в экране, без прокрутки вбок", (await inView(page, "[data-ai-error]")) && (await ov(page)) <= 1);
  ok("NARROW: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`итог: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
