// e2e v153 (Доп. 477): интернет — Наставнику в переписке и «вкусным описаниям» блюд. Сайт — демо целиком
// (tools/claude/demo-app/build.mjs: сервер в странице — chat_ai_post как на сервере; «интернет» в демо — ответы-примеры со
// ссылками на example.com; экран открывает window.__saNav).
// Разделы: CHAT (Анна, «Вся команда»: «@Наставник что за вино Château Margaux?» — ответ с поиском, строка «Нашёл в интернете:
// example.com» — именем сайта, касание открывает страницу; «@Наставник как закрыть смену?» — обычный ответ без ссылок;
// интернет не ответил — обычный ответ), DESC (Мария, редактор меню: «Пять вариантов описания» — «Ищу идеи в интернете…»,
// пять вариантов с подписями углов, «Идеи из интернета: example.com»; «Ещё пять вариантов» — другие углы, показанное
// уходит в запрос; «→ в описание», «→ одной фразой»; без интернета — Наставник), LIGHT («Для чтения»), NARROW (320 px).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v153.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5353, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v153";
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
const ANGLES0 = ["Вкус и текстура", "Откуда блюдо", "Коротко и игриво", "Если гость сомневается", "Главный ингредиент"];
const ANGLES1 = ["Как готовим", "Под настроение", "Простыми словами", "Для гурмана", "Интересный факт"];

async function open({ who = "maria", light = false, width = 390, height = 844 } = {}) {
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
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  // запросы AI — в журнал; отказ интернета (FAIL); открытые ссылки
  await page.evaluate(() => {
    const f = window.fetch; window.__web = []; window.__chat = []; window.__webFail = false; window.__opened = [];
    window.open = (u) => { window.__opened.push(String(u)); return null; };
    window.fetch = (u, init) => {
      const url = String(u);
      if (/\/api\/web-answer/.test(url)) {
        const b = JSON.parse((init && init.body) || "{}"); window.__web.push(b);
        if (window.__webFail) return new Promise((ok) => setTimeout(() => ok(new Response(JSON.stringify({ ok: false, error: "server", message: "сбой" }), { status: 200, headers: { "Content-Type": "application/json" } })), 500));
      }
      if (/\/functions\/v1\/ai-chat/.test(url)) { const b = JSON.parse((init && init.body) || "{}"); window.__chat.push(String(((b.messages || []).slice(-1)[0] || {}).content || "")); }
      return f(u, init);
    };
  });
  return { ctx, page, errs };
}
const txt = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; }, sel);
const inView = (page, sel) => page.evaluate((s) => { const all = [...document.querySelectorAll(s)]; return all.length > 0 && all.every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; }); }, sel);
const ov = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
// переписка «Вся команда» и вопрос Наставнику
const team = async (page) => { await page.locator("[data-chat-disc]").first().click(); await page.waitForTimeout(1300); await page.locator('[data-chat-item="team"]').first().click(); await page.waitForTimeout(1600); };
const ask = async (page, q) => { await page.locator("textarea.ch-input").fill(q); await page.waitForTimeout(300); await page.locator("[data-chat-send]").click(); };
const aiMsgs = (page) => page.evaluate(() => [...document.querySelectorAll("[data-chat-ai]")].map((m) => ({ tx: ((m.querySelector(".ch-tx") || {}).innerText || "").replace(/\s+/g, " ").trim(),
  web: m.querySelector("[data-chat-ai-web]") ? m.querySelector("[data-chat-ai-web]").innerText.replace(/\s+/g, " ").trim() : "" })));
const waitAi = (page, n, ms = 15000) => page.waitForFunction((k) => document.querySelectorAll("[data-chat-ai]").length >= k, n, { timeout: ms }).then(() => true).catch(() => false);
// редактор меню: первое блюдо
const dishForm = async (page) => {
  await page.evaluate(() => window.__saNav("menuTrainer")); await page.waitForTimeout(1800);
  await page.locator("text=Редактор меню").first().click(); await page.waitForTimeout(1300);
  await page.locator("[data-menu-edit]").first().click(); await page.waitForTimeout(1200);
};
const variants = (page) => page.evaluate(() => [...document.querySelectorAll("[data-menu-desc-variant]")].map((v) => ({ angle: v.getAttribute("data-menu-desc-variant"),
  label: ((v.querySelector("[data-menu-desc-angle]") || {}).innerText || "").trim(), text: v.innerText.replace(/\s+/g, " ").trim() })));
const descBtn = (page) => page.locator("[data-menu-desc-ai]");
const waitVariants = (page, ms = 15000) => page.waitForFunction(() => !!document.querySelector("[data-menu-desc-variants]") && !document.querySelector('[data-menu-desc-ai="web"], [data-menu-desc-ai="ai"]'), null, { timeout: ms }).then(() => true).catch(() => false);

// ── CHAT ───────────────────────────────────────────────────────────────────────────────────────
if (want("CHAT")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await team(page);
  await ask(page, "@Наставник что за вино Château Margaux?");
  ok("CHAT: ответ Наставника пришёл", await waitAi(page, 1));
  const m1 = (await aiMsgs(page))[0] || {};
  ok("CHAT: «Château Margaux» (в карте нет) — ответ из интернета, под ним «Нашёл в интернете: example.com»", /^Château Margaux — первое гран крю/.test(m1.tx) && m1.web === "Нашёл в интернете: example.com", JSON.stringify(m1));
  ok("CHAT: в тексте ответа адресов нет — только имя сайта в строке ссылок", !/https?:\/\//.test(m1.tx) && !/https?:\/\//.test(m1.web), JSON.stringify(m1));
  const w1 = await page.evaluate(() => window.__web);
  ok("CHAT: запрос — /api/web-answer, chat: true, вопрос без «@Наставник», ресторан в данных приложения", w1.length === 1 && w1[0].chat === true && w1[0].question === "что за вино Château Margaux?"
    && /^Ресторан: /.test(w1[0].context || "") && !!w1[0].token && (await page.evaluate(() => window.__chat.length)) === 0, JSON.stringify(w1));
  await page.screenshot({ path: join(OUT, "chat-1-web.png") });
  await page.evaluate(() => { const b = document.querySelector("[data-chat-ai-web-src]"); if (b) b.click(); }); await page.waitForTimeout(300);
  ok("CHAT: касание «example.com» открывает страницу, а не меню сообщения", JSON.stringify(await page.evaluate(() => window.__opened)) === JSON.stringify(["https://example.com/demo/chateau-margaux"])
    && !(await page.$("[data-chat-sheet], .ch-sheet")), JSON.stringify(await page.evaluate(() => window.__opened)));
  await ask(page, "@Наставник как закрыть смену?");
  await waitAi(page, 2);
  const m2 = (await aiMsgs(page))[1] || {};
  ok("CHAT: «Как закрыть смену?» — обычный ответ (ai-chat), без строки ссылок", !!m2.tx && !m2.web && (await page.evaluate(() => window.__web.length)) === 1 && (await page.evaluate(() => window.__chat.length)) === 1, JSON.stringify(m2));
  await page.evaluate(() => { window.__webFail = true; });
  await ask(page, "@Наставник найди в интернете, что такое кальвадос");
  await waitAi(page, 3);
  const m3 = (await aiMsgs(page))[2] || {};
  ok("CHAT: интернет не ответил — сначала поиск, потом обычный ответ без ссылок", !!m3.tx && !m3.web && (await page.evaluate(() => window.__web.length)) === 2 && (await page.evaluate(() => window.__chat.length)) === 2, JSON.stringify(m3));
  await page.screenshot({ path: join(OUT, "chat-2-plain.png") });
  ok("CHAT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── DESC ───────────────────────────────────────────────────────────────────────────────────────
if (want("DESC")) {
  const { ctx, page, errs } = await open();
  await dishForm(page);
  const desc0 = await page.locator('textarea[placeholder="Эталонное «вкусное описание» для гостя"]').inputValue().catch(() => "");
  const btn = descBtn(page); await btn.scrollIntoViewIfNeeded();
  ok("DESC: в форме блюда — «Пять вариантов описания»", (await btn.innerText()) === "Пять вариантов описания");
  await btn.click(); await page.waitForTimeout(400);
  ok("DESC: пока ищет — «Ищу идеи в интернете…»", (await btn.innerText()) === "Ищу идеи в интернете…");
  ok("DESC: варианты пришли", await waitVariants(page));
  const v0 = await variants(page);
  ok("DESC: пять вариантов, у каждого свой угол: вкус, откуда, игриво, если сомневается, главный ингредиент", v0.length === 5 && JSON.stringify(v0.map((v) => v.label)) === JSON.stringify(ANGLES0), JSON.stringify(v0.map((v) => v.label)));
  ok("DESC: «Идеи из интернета: example.com»", (await txt(page, "[data-menu-desc-web]")) === "Идеи из интернета: example.com");
  ok("DESC: кнопка — «Ещё пять вариантов»", (await btn.innerText()) === "Ещё пять вариантов");
  const r0 = (await page.evaluate(() => window.__web))[0] || {};
  ok("DESC: запрос — mode desc, нажатие 0, блюдо с составом, уже вписанное описание — в «показанном»", r0.mode === "desc" && r0.round === 0 && !!(r0.dish && r0.dish.name) && (r0.dish.ingredients || []).length > 0
    && (!desc0 || (r0.seen || []).includes(desc0.trim())), JSON.stringify({ mode: r0.mode, round: r0.round, dish: r0.dish, seen: (r0.seen || []).length }));
  await page.locator("[data-menu-desc-variants]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, "desc-1-variants.png") });
  await page.evaluate(() => { const b = document.querySelector("[data-menu-desc-src]"); if (b) b.click(); }); await page.waitForTimeout(300);
  ok("DESC: ссылка открывает страницу", JSON.stringify(await page.evaluate(() => window.__opened)) === JSON.stringify(["https://example.com/demo/dish-ideas"]));
  await btn.click();
  await waitVariants(page);
  const v1 = await variants(page), r1 = (await page.evaluate(() => window.__web))[1] || {};
  ok("DESC: «Ещё пять вариантов» — другие углы: как готовим, настроение, простыми словами, для гурмана, факт", v1.length === 5 && JSON.stringify(v1.map((v) => v.label)) === JSON.stringify(ANGLES1), JSON.stringify(v1.map((v) => v.label)));
  ok("DESC: второй запрос — нажатие 1, все пять показанных вариантов — в «показанном»", r1.round === 1 && v0.every((v) => (r1.seen || []).some((x) => v.text.includes(x))), JSON.stringify({ round: r1.round, seen: (r1.seen || []).length }));
  ok("DESC: варианты не повторяются", new Set([...v0, ...v1].map((v) => v.text)).size === 10);
  await page.locator('[data-menu-desc-use="desc"]').nth(2).click(); await page.waitForTimeout(250);
  await page.locator('[data-menu-desc-use="short"]').nth(4).click(); await page.waitForTimeout(250);
  const dv = await page.locator('textarea[placeholder="Эталонное «вкусное описание» для гостя"]').inputValue();
  const sv = await page.locator('[placeholder="Одной фразой: первое, что говорит официант (необязательно)"]').inputValue();
  const v1t = await page.evaluate(() => [...document.querySelectorAll("[data-menu-desc-variant]")].map((v) => { const t = v.querySelector("[style*='cursor: pointer']"); return t ? t.innerText.replace(/^\d+\.\s*/, "").trim() : ""; }));
  ok("DESC: «→ в описание» и «→ одной фразой» — в поля формы", dv === v1t[2] && sv === v1t[4], JSON.stringify({ dv, sv, v: [v1t[2], v1t[4]] }));
  await page.screenshot({ path: join(OUT, "desc-2-more.png") });
  // без интернета — Наставник (ai-chat) с теми же правилами и углами
  await page.evaluate(() => { window.__webFail = true; });
  await btn.click();
  await waitVariants(page);
  const c = await page.evaluate(() => window.__chat);
  ok("DESC: интернет не ответил — Наставник без интернета: правила, углы нажатия, «показанное»", c.length === 1 && c[0].startsWith("Напиши «вкусные описания» блюда для гостя") && /Уже показаны/.test(c[0])
    && /1\. про вкус и текстуру/.test(c[0]) && /Упоминай только ингредиенты из состава/.test(c[0]), (c[0] || "").slice(0, 300));
  // v154: под вариантами без интернета — «Без интернета: поиск сейчас не ответил (причина)», ошибки Наставника нет
  ok("DESC: и без интернета вариант на месте, без «Идей из интернета» и без ошибки", (await variants(page)).length >= 1 && !(await page.$("[data-menu-desc-web]"))
    && !/Наставник не ответил|невнятно|Нет связи с Наставником/.test(await page.evaluate(() => document.body.innerText)));
  ok("DESC: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── LIGHT ──────────────────────────────────────────────────────────────────────────────────────
if (want("LIGHT")) {
  const { ctx, page, errs } = await open({ light: true });
  await dishForm(page);
  await descBtn(page).scrollIntoViewIfNeeded(); await descBtn(page).click();
  await waitVariants(page);
  const st = await page.evaluate(() => { const l = document.querySelector("[data-menu-desc-angle]"), a = document.querySelector("[data-menu-desc-src]");
    return { label: l && getComputedStyle(l).color, link: a && getComputedStyle(a).color, fs: l && getComputedStyle(l).fontSize }; });
  ok("LIGHT: «Для чтения» — подписи углов и ссылка тёмным золотом", !!st.label && !!st.link && st.link !== "rgb(214, 178, 102)" && st.label !== "rgb(214, 178, 102)", JSON.stringify(st));
  await page.locator("[data-menu-desc-variants]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, "desc-light.png") });
  ok("LIGHT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── NARROW ─────────────────────────────────────────────────────────────────────────────────────
if (want("NARROW")) {
  const a = await open({ width: 320, height: 700 });
  await dishForm(a.page);
  await descBtn(a.page).scrollIntoViewIfNeeded(); await descBtn(a.page).click();
  await waitVariants(a.page);
  ok("NARROW: 320 px — варианты, подписи и «Идеи из интернета» в экране, без прокрутки вбок", (await inView(a.page, "[data-menu-desc-variant], [data-menu-desc-angle], [data-menu-desc-web]")) && (await ov(a.page)) <= 1);
  await a.page.locator("[data-menu-desc-variants]").scrollIntoViewIfNeeded();
  await a.page.screenshot({ path: join(OUT, "desc-320.png") });
  ok("NARROW: без ошибок страницы (меню)", !a.errs.length, a.errs.join(" | "));
  await a.ctx.close();
  const c = await open({ who: "anna", width: 320, height: 700 });
  await team(c.page);
  await ask(c.page, "@Наставник что за вино Château Margaux?");
  await waitAi(c.page, 1);
  ok("NARROW: 320 px — ответ со строкой ссылок в экране", (await inView(c.page, "[data-chat-ai-web]")) && (await ov(c.page)) <= 1);
  await c.page.screenshot({ path: join(OUT, "chat-320.png") });
  ok("NARROW: без ошибок страницы (переписка)", !c.errs.length, c.errs.join(" | "));
  await c.ctx.close();
}

await browser.close(); server.close();
console.log(`итог: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
