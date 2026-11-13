// e2e v154 (Доп. 478): поиск в интернете — с причиной ошибки. Сайт — демо целиком (tools/claude/demo-app/build.mjs; «интернет»
// в демо — ответы-примеры; поверх fetch — ответ сервера с ошибкой или страница 504 вместо JSON).
// Разделы: CHECK (Анна: «Расскажи про Шабли» → «Проверить в интернете»; сервер не нашёл модель — ошибка с его текстом;
// страница 504 — «сервер ответил кодом 504»; снова работает — «Проверил в интернете»), MISS («Château Margaux», поиск не
// ответил — обычный ответ и под ним «Ответ без интернета: поиск сейчас не ответил», без красной ошибки; работает — ссылки,
// без этой строки), DESC (Мария, описания блюда без интернета — варианты и «Без интернета: … (причина)»), NARROW (320 px).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v154.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5354, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v154";
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
const WHY = "Ошибка OpenRouter: google/gemini-2.5-flash (tool): No endpoints found";

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
  // /api/web-answer: "" — как в демо; "why" — ответ сервера с ошибкой; "504" — страница Vercel вместо JSON
  await page.evaluate((why) => {
    const f = window.fetch; window.__webMode = ""; window.__web = 0; window.__chat = 0;
    window.fetch = (u, init) => {
      const url = String(u);
      if (/\/api\/web-answer/.test(url)) {
        window.__web++;
        if (window.__webMode === "why") return new Promise((ok) => setTimeout(() => ok(new Response(JSON.stringify({ ok: false, error: "server", message: why }), { status: 200, headers: { "Content-Type": "application/json" } })), 600));
        if (window.__webMode === "504") return new Promise((ok) => setTimeout(() => ok(new Response("<html><body>An error occurred with your deployment. FUNCTION_INVOCATION_TIMEOUT</body></html>", { status: 504, headers: { "Content-Type": "text/html" } })), 600));
      }
      // v155: запасной путь (/api/wine-import с via: "web-answer") в режиме 504 отвечает так же
      if (/\/api\/wine-import/.test(url) && window.__webMode === "504" && /"via":"web-answer"/.test(String((init && init.body) || ""))) return new Promise((ok) => setTimeout(() => ok(new Response("<html><body>An error occurred with your deployment. FUNCTION_INVOCATION_TIMEOUT</body></html>", { status: 504, headers: { "Content-Type": "text/html" } })), 300));
      if (/\/functions\/v1\/ai-chat/.test(url)) window.__chat++;
      return f(u, init);
    };
  }, WHY);
  return { ctx, page, errs };
}
const txt = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; }, sel);
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
  await page.evaluate(() => { window.__webMode = "why"; });
  await page.evaluate(() => { const b = document.querySelector("[data-ai-web-check]"); if (b) b.click(); });
  await page.waitForSelector("[data-ai-error]", { timeout: 10000 }).catch(() => {});
  const e1 = await txt(page, "[data-ai-error]");
  ok("CHECK: сервер не нашёл модель — ошибка с его текстом", e1 === "Не получилось поискать в интернете: " + WHY + ". Попробуй ещё раз", e1);
  await page.screenshot({ path: join(OUT, "check-1-why.png") });
  await page.evaluate(() => { window.__webMode = "504"; });
  await page.evaluate(() => { const b = document.querySelector("[data-ai-web-check]"); if (b) b.click(); });
  await page.waitForFunction(() => /кодом 504/.test((document.querySelector("[data-ai-error]") || {}).innerText || ""), null, { timeout: 10000 }).catch(() => {});
  const e2 = await txt(page, "[data-ai-error]");
  // v155: и кто ответил (первые слова страницы), и код запасного пути
  ok("CHECK: страница 504 вместо ответа — «сервер ответил кодом 504», что на странице и код запасного пути",
    e2 === "Не получилось поискать в интернете: сервер ответил кодом 504 («An error occurred with your deployment. FUNCTION_INVOCATION_TIMEOUT»), запасной путь — кодом 504. Попробуй ещё раз", e2);
  await page.evaluate(() => { window.__webMode = ""; });
  await page.evaluate(() => { const b = document.querySelector("[data-ai-web-check]"); if (b) b.click(); });
  await page.waitForSelector("[data-ai-web]", { timeout: 15000 }).catch(() => {});
  await idle(page);
  ok("CHECK: снова работает — «Проверил в интернете: example.com», ошибки нет", (await txt(page, "[data-ai-web]")) === "Проверил в интернете: example.com" && !(await page.$("[data-ai-error]")));
  ok("CHECK: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── MISS ───────────────────────────────────────────────────────────────────────────────────────
if (want("MISS")) {
  const { ctx, page, errs } = await open();
  await assistant(page);
  await page.evaluate(() => { window.__webMode = "why"; });
  await send(page, "Что за вино Château Margaux?");
  await page.waitForFunction(() => window.__chat >= 1, null, { timeout: 10000 }).catch(() => {});
  await page.waitForSelector("[data-ai-web-miss]", { timeout: 10000 }).catch(() => {});
  await idle(page);
  ok("MISS: поиск не ответил — обычный ответ, под ним «Ответ без интернета: поиск сейчас не ответил»", (await txt(page, "[data-ai-web-miss]")) === "Ответ без интернета: поиск сейчас не ответил"
    && (await page.evaluate(() => [window.__web, window.__chat].join("/"))) === "1/1", await page.evaluate(() => [window.__web, window.__chat].join("/")));
  ok("MISS: причина — в подсказке строки, красной ошибки нет", (await page.evaluate(() => document.querySelector("[data-ai-web-miss]").getAttribute("title"))) === "Не получилось поискать в интернете: " + WHY + ". Попробуй ещё раз"
    && !(await page.$("[data-ai-error]")));
  ok("MISS: под ответом — «Проверить в интернете» (по ней видно причину целиком)", !!(await page.$("[data-ai-web-check]")));
  await page.screenshot({ path: join(OUT, "miss-1.png") });
  await page.evaluate(() => { window.__webMode = ""; });
  await send(page, "А что за вино Château Margaux, ещё раз?");
  await page.waitForSelector("[data-ai-web]", { timeout: 15000 }).catch(() => {});
  await idle(page);
  const last = await page.evaluate(() => { const w = [...document.querySelectorAll("[data-ai-web]")].pop(); const box = w && w.parentElement; return { web: w ? w.innerText.replace(/\s+/g, " ").trim() : "", miss: !!(box && box.querySelector("[data-ai-web-miss]")) }; });
  ok("MISS: поиск работает — ссылки, без строки «без интернета»", last.web === "Нашёл в интернете: example.com" && !last.miss, JSON.stringify(last));
  ok("MISS: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── DESC ───────────────────────────────────────────────────────────────────────────────────────
if (want("DESC")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  await page.evaluate(() => window.__saNav("menuTrainer")); await page.waitForTimeout(1800);
  await page.locator("text=Редактор меню").first().click(); await page.waitForTimeout(1300);
  await page.locator("[data-menu-edit]").first().click(); await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__webMode = "why"; });
  const btn = page.locator("[data-menu-desc-ai]"); await btn.scrollIntoViewIfNeeded(); await btn.click();
  await page.waitForSelector("[data-menu-desc-variants]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  const miss = await txt(page, "[data-menu-desc-miss]");
  ok("DESC: без интернета — варианты Наставника и «Без интернета: поиск сейчас не ответил (причина)»", (await page.locator("[data-menu-desc-variant]").count()) >= 1 && miss === "Без интернета: поиск сейчас не ответил (" + WHY + ")"
    && !(await page.$("[data-menu-desc-web]")), miss);
  await page.locator("[data-menu-desc-variants]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, "desc-miss.png") });
  await page.evaluate(() => { window.__webMode = ""; });
  await btn.click();
  await page.waitForSelector("[data-menu-desc-web]", { timeout: 15000 }).catch(() => {});
  ok("DESC: интернет снова есть — «Идеи из интернета», строки «Без интернета» нет", !!(await page.$("[data-menu-desc-web]")) && !(await page.$("[data-menu-desc-miss]")));
  ok("DESC: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── NARROW ─────────────────────────────────────────────────────────────────────────────────────
if (want("NARROW")) {
  const { ctx, page, errs } = await open({ width: 320, height: 700 });
  await assistant(page);
  await page.evaluate(() => { window.__webMode = "why"; });
  await send(page, "Что за вино Château Margaux?");
  await page.waitForSelector("[data-ai-web-miss]", { timeout: 15000 }).catch(() => {});
  await idle(page);
  await page.evaluate(() => { const b = document.querySelector("[data-ai-web-check]"); if (b) b.click(); });
  await page.waitForSelector("[data-ai-error]", { timeout: 10000 }).catch(() => {});
  ok("NARROW: 320 px — строка «без интернета» и ошибка с причиной в экране", (await inView(page, "[data-ai-web-miss], [data-ai-error]")) && (await ov(page)) <= 1);
  await page.screenshot({ path: join(OUT, "narrow.png") });
  ok("NARROW: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`итог: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
