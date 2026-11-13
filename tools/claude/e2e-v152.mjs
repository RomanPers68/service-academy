// e2e v152 (Доп. 476): выход в интернет. Сайт — демо целиком (tools/claude/demo-app/build.mjs: сервер в странице; «интернет»
// в демо — ответы-примеры со ссылками на example.com; экран открывает window.__saNav).
// Разделы: WEB (Мария: после «Дописать пустое» — «Поискать в интернете · 2» в итоге и в сводке; вопрос — сколько, откуда
// возьмёт, что не тронет, сколько стоит; итог: кальвадос нашёлся — поля с «AI» и ссылка, настойка — «не нашлось и в
// интернете»; порция и цена — как были; запросы по одной позиции с web: true; «Проверка подряд» крепкого — «Нашлось в
// интернете: example.com», ссылка открывается; второй раз кнопки нет), FAIL (поиск не ответил — «AI не ответил по 2
// позициям», позиции не помечены, кнопка осталась), ASSIST (Анна: «Château Margaux» — ответ с поиском, «Ищу в интернете…»,
// «Нашёл в интернете: example.com»; «Расскажи про Шабли» — обычный ответ и «Проверить в интернете» → «Проверил в интернете»;
// «найди в интернете…» — с поиском; «Как закрыть смену?» — без интернета и без кнопки; интернет не ответил — обычный ответ;
// ссылки сохраняются в чате), LIGHT («Для чтения»), NARROW (320 px).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v152.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5352, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v152";
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
const CAL = "https://example.com/demo/calvados-pays-d-auge";

async function open({ who = "maria", light = false, width = 390, height = 844, keep = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  if (!keep) await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  await prep(page, errs, light);
  return { ctx, page, errs };
}
// поверх демо: закрыть всплывашки, спрятать «Телеграм», записывать запросы AI; отказ поиска (FAIL) и интернета ассистента
async function prep(page, errs, light) {
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  await page.evaluate(() => {
    const f = window.fetch; window.__gaps = []; window.__web = []; window.__chat = 0; window.__webFail = false; window.__answerFail = false; window.__opened = [];
    window.open = (u) => { window.__opened.push(String(u)); return null; };
    window.fetch = (u, init) => {
      const url = String(u);
      if (/\/api\/wine-import/.test(url) && init && /"mode":"gaps"/.test(String(init.body))) {
        const b = JSON.parse(init.body);
        window.__gaps.push({ kind: b.kind || "wine", web: b.web === true, n: (b.items || []).length, names: (b.items || []).map((x) => x.name), missing: (b.items || []).map((x) => x.missing) });
        if (b.web && window.__webFail) return new Promise((ok) => setTimeout(() => ok(new Response("<html>timeout</html>", { status: 504 })), 300));
      }
      if (/\/api\/web-answer/.test(url)) {   // v155: запрос упакован — читаем через window.__demoUnpack (демо)
        return window.__demoUnpack(JSON.parse((init && init.body) || "{}")).then((b) => {
          window.__web.push({ question: b.question, check: b.check || "", context: b.context || "", token: !!b.token, history: (b.history || []).length });
          if (window.__answerFail) return new Promise((ok) => setTimeout(() => ok(new Response(JSON.stringify({ ok: false, error: "server", message: "сбой" }), { status: 200, headers: { "Content-Type": "application/json" } })), 900));
          return f(u, init);
        });
      }
      if (/\/functions\/v1\/ai-chat/.test(url)) window.__chat++;
      return f(u, init);
    };
  });
}
const editor = async (page) => { await page.evaluate(() => window.__saNav("wineEditor")); await page.waitForTimeout(2200); };
const assistant = async (page) => { await page.evaluate(() => window.__saNav("assistant")); await page.waitForTimeout(1800); };
const bar = (page) => page.evaluate(() => {
  const m = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}"), all = Object.values(m).find((x) => Array.isArray(x) && x.some((d) => d && (d.kind === "wine" || d.kind === "spirit"))) || [];
  return all.filter((d) => d && (d.kind === "wine" || d.kind === "spirit"));
});
const click = (page, sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
const textOf = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; }, sel);
const attr = (page, sel, a) => page.evaluate(([s, n]) => { const e = document.querySelector(s); return e ? e.getAttribute(n) : null; }, [sel, a]);
const waitDone = (page, ms = 30000) => page.waitForSelector("[data-wine-bulk-done]", { timeout: ms }).then(() => true).catch(() => false);
const has = (v) => (Array.isArray(v) ? v.length > 0 : v !== "" && v != null && v !== false);
const KEEP = ["vintage", "volume", "byGlass", "priceGlass", "priceBottle", "portion", "pricePortion"];
// «Дописать пустое» до конца: после него AI своих знаний не хватило у настойки и кальвадоса
const gapsFirst = async (page) => { await click(page, "[data-wine-bulk]"); await page.waitForTimeout(400); await click(page, "[data-wine-bulk-go]"); return waitDone(page); };
// ассистент: вопрос в поле и кнопка отправки (последняя кнопка поля)
const send = async (page, q) => {
  await page.fill("textarea", q); await page.waitForTimeout(150);
  await page.evaluate(() => { const t = document.querySelector("textarea"); const b = t && t.closest("[data-lens-field]") && [...t.closest("[data-lens-field]").querySelectorAll("button")].pop(); if (b) b.click(); });
};
// ответ пришёл: нет «Ищу в интернете…» и точек «печатает»
const idle = (page, ms = 15000) => page.waitForFunction(() => !document.querySelector("[data-ai-web-busy]") && !document.querySelector(".sa-pulse"), null, { timeout: ms }).catch(() => {});
const demoReplies = (page) => page.evaluate(() => (document.body.innerText.match(/Это демо: Наставник здесь не подключён/g) || []).length);
const bubbles = (page) => page.evaluate(() => [...document.querySelectorAll("[data-ai-web]")].map((b) => b.innerText.replace(/\s+/g, " ").trim()));

// ── WEB ────────────────────────────────────────────────────────────────────────────────────────
if (want("WEB")) {
  const { ctx, page, errs } = await open();
  await editor(page);
  ok("WEB: в начале «Поискать в интернете» нет — AI ещё никого не спрашивали", !(await page.$("[data-wine-web]")) && !!(await page.$("[data-wine-bulk]")));
  const before = await bar(page);
  ok("WEB: «Дописать пустое» до конца", await gapsFirst(page));
  const bw = await textOf(page, "[data-wine-bulk-web]");
  ok("WEB: в итоге — «Поискать в интернете · 2» (настойка и кальвадос: AI своих знаний не хватило)", bw === "Поискать в интернете · 2" && (await attr(page, "[data-wine-bulk-web]", "data-wine-bulk-web")) === "2", bw);
  const mid = await bar(page);
  const calM = mid.find((d) => /Кальвадос/.test(d.name)), tinM = mid.find((d) => /Облепиха/.test(d.name));
  ok("WEB: после «Дописать пустое» обе позиции помечены aiNone, без aiWeb", !!calM && !!tinM && calM.aiNone === true && tinM.aiNone === true && !calM.aiWeb && !tinM.aiWeb, JSON.stringify({ c: calM && calM.aiNone, t: tinM && tinM.aiNone }));
  await click(page, "[data-wine-bulk-end]"); await page.waitForTimeout(600);
  const sumBtn = await textOf(page, "[data-wine-web]");
  ok("WEB: в сводке — «Поискать в интернете · 2» под «Дописать пустое»", sumBtn === "Поискать в интернете · 2", sumBtn);
  await page.screenshot({ path: join(OUT, "web-1-list.png") });
  await click(page, "[data-wine-web]"); await page.waitForTimeout(500);
  const head = await page.evaluate(() => (document.querySelector("[data-wine-bulk-screen]") || {}).innerText || "");
  const ask = await textOf(page, "[data-wine-bulk-ask]");
  ok("WEB: вопрос — «Поискать в интернете», «AI поищет в интернете 2 позиции», «крепкое — 2»", (await attr(page, "[data-wine-bulk-screen]", "data-wine-bulk-mode")) === "web" && /Поискать в интернете/.test(head)
    && !!ask && ask.startsWith("AI поищет в интернете 2 позиции") && (await textOf(page, "[data-wine-bulk-plan]")) === "крепкое — 2", ask);
  ok("WEB: откуда возьмёт — сайты производителей и справочники, ссылки сохранятся в позиции", /Поищет на сайтах производителей, импортёров и в винных и барных справочниках/.test(ask) && /Ссылки на страницы сохранятся в позиции/.test(ask), ask);
  ok("WEB: не трогает год, объём, цены и порции; цена поиска — «около 3–6 ₽ за позицию»", /Год урожая, объём, цены и порции\. Уже вписанное не меняет\./.test(ask)
    && (await textOf(page, "[data-wine-web-cost]")) === "Поиск стоит денег: около 3–6 ₽ за позицию, с баланса OpenRouter.", ask);
  ok("WEB: кнопка — «Искать»", (await textOf(page, "[data-wine-bulk-go]")) === "Искать");
  await page.screenshot({ path: join(OUT, "web-2-ask.png") });
  await click(page, "[data-wine-bulk-go]"); await page.waitForTimeout(450);
  const work = await textOf(page, "[data-wine-bulk-work]");
  ok("WEB: работа — «AI ищет в интернете: крепкое», «0 из 2»", !!work && /AI ищет в интернете: крепкое/.test(work) && /\d из 2/.test(work), work);
  ok("WEB: поиск закончился", await waitDone(page));
  const sum = await textOf(page, "[data-wine-bulk-sum]"), found = await textOf(page, "[data-wine-web-found]"), none = await textOf(page, "[data-wine-bulk-none]");
  ok("WEB: итог — «Нашлось в интернете у 1 позиции, полей: …», кальвадос — с сайтом", /^Нашлось в интернете у 1 позиции, полей: \d+\.$/.test(String(sum)) && found === "Кальвадос Pays d’Auge, Christian Drouin: example.com", JSON.stringify({ sum, found }));
  ok("WEB: «Не нашлось и в интернете» — своя настойка, «Их можно заполнить руками»", !!none && none.startsWith("Не нашлось и в интернете у 1 позиции: Настойка «Облепиха с мёдом», своя.") && /Их можно заполнить руками/.test(none), none);
  ok("WEB: после поиска второй раз искать не предлагает", !(await page.$("[data-wine-bulk-web]")));
  await page.screenshot({ path: join(OUT, "web-3-done.png") });
  const after = await bar(page);
  const cal = after.find((d) => /Кальвадос/.test(d.name)), tin = after.find((d) => /Облепиха/.test(d.name)), calB = before.find((d) => /Кальвадос/.test(d.name));
  const fresh = Object.keys(cal || {}).filter((f) => !["ai", "aiTried", "aiWeb", "aiNone", "updatedAt", "updatedBy", "checkedAt", "checkedBy", "taste"].includes(f) && has(cal[f]) && !has(calB[f]));
  ok("WEB: кальвадос — регион, рассказ и др. с пометкой «AI»; ссылка в aiWeb; aiNone снят", !!cal && cal.region === "Нормандия, Пеи д’Ож" && has(cal.story) && fresh.length >= 6 && fresh.every((f) => (cal.ai || []).includes(f))
    && !!cal.aiWeb && cal.aiWeb.src.length === 1 && cal.aiWeb.src[0].url === CAL && !("aiNone" in cal), JSON.stringify({ fresh, ai: cal && cal.ai, web: cal && cal.aiWeb }));
  ok("WEB: у кальвадоса порция и цена — как были (40 мл, 690 ₽)", !!cal && KEEP.every((f) => JSON.stringify(cal[f] ?? "") === JSON.stringify(calB[f] ?? "")) && cal.portion === 40 && cal.pricePortion === 690, JSON.stringify({ p: cal && cal.portion, pp: cal && cal.pricePortion }));
  ok("WEB: настойка — ничего не выдумано, aiNone остался, aiWeb без ссылок (второй раз не ищется)", !!tin && !has(tin.story) && !has(tin.cat) && tin.aiNone === true && !!tin.aiWeb && tin.aiWeb.src.length === 0, JSON.stringify(tin && { s: tin.story, n: tin.aiNone, w: tin.aiWeb }));
  const others = after.filter((d) => !/Кальвадос|Облепиха/.test(d.name)), midBy = Object.fromEntries(mid.map((d) => [d.id, d]));
  ok("WEB: остальные позиции поиск не тронул", others.every((d) => JSON.stringify(d) === JSON.stringify(midBy[d.id])));
  const calls = (await page.evaluate(() => window.__gaps)).filter((c) => c.web);
  ok("WEB: запросы — по одной позиции, крепкое, web: true; спрашивали и то, чего AI не знал, без года, объёма, цен и порции", calls.length === 2 && calls.every((c) => c.n === 1 && c.kind === "spirit")
    && calls.every((c) => c.missing.flat().every((f) => !KEEP.includes(f))) && calls.some((c) => /Кальвадос/.test(c.names[0]) && c.missing[0].includes("story") && c.missing[0].includes("region")), JSON.stringify(calls));
  // «Проверка подряд» крепкого: у кальвадоса — откуда взято, ссылка открывается
  const other = await textOf(page, "[data-wine-bulk-other]");
  await click(page, "[data-wine-bulk-other]"); await page.waitForTimeout(1500);
  for (let k = 0; k < 20; k++) { if (await page.$("[data-wine-review] [data-wine-web-src]")) break; await click(page, "[data-wine-review-skip]"); await page.waitForTimeout(250); }
  const rl = await textOf(page, "[data-wine-review] [data-wine-web-src]");
  ok("WEB: «" + other + "» → в «Проверке подряд» у кальвадоса «Нашлось в интернете: example.com»", rl === "Нашлось в интернете: example.com", rl);
  await page.screenshot({ path: join(OUT, "web-4-review.png") });
  await click(page, "[data-wine-review] [data-wine-web-link]"); await page.waitForTimeout(300);
  ok("WEB: ссылка открывает страницу в браузере", JSON.stringify(await page.evaluate(() => window.__opened)) === JSON.stringify([CAL]), JSON.stringify(await page.evaluate(() => window.__opened)));
  await page.evaluate(() => { const b = document.querySelector('[data-lens="back"]'); if (b) b.click(); }); await page.waitForTimeout(700);
  ok("WEB: в редакторе крепкого «Поискать в интернете» больше нет — искать некого", !(await page.$("[data-wine-web]")) && !!(await page.$("[data-wine-sum-card]")));
  ok("WEB: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── FAIL ───────────────────────────────────────────────────────────────────────────────────────
if (want("FAIL")) {
  const { ctx, page, errs } = await open();
  await editor(page);
  await gapsFirst(page);
  const mid = await bar(page);
  await page.evaluate(() => { window.__webFail = true; });
  await click(page, "[data-wine-bulk-web]"); await page.waitForTimeout(400);
  await click(page, "[data-wine-bulk-go]");
  await waitDone(page);
  const failed = await textOf(page, "[data-wine-bulk-failed]");
  ok("FAIL: поиск не ответил — «AI не ответил по 2 позициям: … код 504», «Поискать в интернете» ещё раз", /^AI не ответил по 2 позициям: AI не успел ответить: сервер перестал ждать \(код 504\)/.test(String(failed)) && /Нажми «Поискать в интернете» ещё раз/.test(String(failed)), failed);
  ok("FAIL: итог — «В интернете ничего подходящего не нашлось»", (await textOf(page, "[data-wine-bulk-sum]")) === "В интернете ничего подходящего не нашлось.");
  const after = await bar(page);
  ok("FAIL: позиции не тронуты и не помечены как искавшиеся", JSON.stringify(after) === JSON.stringify(mid) && after.every((d) => !d.aiWeb));
  await page.screenshot({ path: join(OUT, "web-fail.png") });
  await page.evaluate(() => { window.__webFail = false; });
  await click(page, "[data-wine-bulk-end]"); await page.waitForTimeout(500);
  ok("FAIL: кнопка осталась — «Поискать в интернете · 2»", (await textOf(page, "[data-wine-web]")) === "Поискать в интернете · 2");
  await click(page, "[data-wine-web]"); await page.waitForTimeout(300); await click(page, "[data-wine-bulk-go]");
  await waitDone(page);
  ok("FAIL: ещё раз — нашлось у кальвадоса", /^Нашлось в интернете у 1 позиции/.test(String(await textOf(page, "[data-wine-bulk-sum]"))));
  ok("FAIL: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── ASSIST ─────────────────────────────────────────────────────────────────────────────────────
if (want("ASSIST")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await assistant(page);
  await send(page, "Что за вино Château Margaux?");
  await page.waitForTimeout(450);
  const busy = await textOf(page, "[data-ai-web-busy]");
  ok("ASSIST: «Château Margaux» (в карте нет) — «Ищу в интернете…»", busy === "Ищу в интернете…", busy);
  await page.waitForSelector("[data-ai-web]", { timeout: 15000 }).catch(() => {});
  await idle(page);
  const b1 = await bubbles(page);
  const reply1 = await page.evaluate(() => { const w = document.querySelector("[data-ai-web]"); const box = w && w.parentElement; return box ? box.innerText.replace(/\s+/g, " ") : ""; });
  ok("ASSIST: ответ — из интернета, под ним «Нашёл в интернете: example.com»", b1.length === 1 && b1[0] === "Нашёл в интернете: example.com" && /Château Margaux — первое гран крю/.test(reply1), JSON.stringify({ b1, reply1: reply1.slice(0, 120) }));
  const w1 = await page.evaluate(() => window.__web);
  ok("ASSIST: запрос — /api/web-answer с вопросом, ресторан в данных приложения, с токеном; ai-chat не спрашивали", w1.length === 1 && w1[0].question === "Что за вино Château Margaux?" && /^Ресторан: /.test(w1[0].context) && w1[0].token && (await page.evaluate(() => window.__chat)) === 0, JSON.stringify(w1));
  ok("ASSIST: под ответом из интернета «Проверить в интернете» нет", !(await page.$("[data-ai-web-check]")));
  await page.screenshot({ path: join(OUT, "ai-1-web.png") });
  await send(page, "Расскажи про Шабли");
  await page.waitForSelector("[data-ai-web-check]", { timeout: 15000 }).catch(() => {});
  const chk = await textOf(page, "[data-ai-web-check]");
  ok("ASSIST: «Расскажи про Шабли» — обычный ответ (ai-chat), под ним «Проверить в интернете»", chk === "Проверить в интернете" && (await page.evaluate(() => window.__chat)) === 1 && (await page.evaluate(() => window.__web.length)) === 1, chk);
  await page.screenshot({ path: join(OUT, "ai-2-check-chip.png") });
  await click(page, "[data-ai-web-check]"); await page.waitForTimeout(450);
  ok("ASSIST: «Проверить в интернете» — «Ищу в интернете…», кнопка ушла", (await textOf(page, "[data-ai-web-busy]")) === "Ищу в интернете…" && !(await page.$("[data-ai-web-check]")));
  await page.waitForFunction(() => document.querySelectorAll("[data-ai-web]").length >= 2, null, { timeout: 15000 }).catch(() => {});
  await idle(page);
  const b2 = await bubbles(page), w2 = await page.evaluate(() => window.__web);
  ok("ASSIST: новый ответ — «Проверил в интернете: example.com»", b2.length === 2 && b2[1] === "Проверил в интернете: example.com", JSON.stringify(b2));
  // v155: проверке история не нужна — вопрос и сам ответ
  ok("ASSIST: проверка — вопрос «Расскажи про Шабли» и прошлый ответ (check), без истории", w2.length === 2 && w2[1].question === "Расскажи про Шабли" && w2[1].check.length > 20 && w2[1].history === 0, JSON.stringify(w2[1]));
  await page.screenshot({ path: join(OUT, "ai-3-checked.png") });
  await page.evaluate(() => { const b = [...document.querySelectorAll("[data-ai-web-src]")].pop(); if (b) b.click(); }); await page.waitForTimeout(300);
  ok("ASSIST: ссылка открывает страницу в браузере", JSON.stringify(await page.evaluate(() => window.__opened)) === JSON.stringify(["https://example.com/demo/check"]), JSON.stringify(await page.evaluate(() => window.__opened)));
  await send(page, "Найди в интернете, что такое кальвадос");
  await page.waitForFunction(() => window.__web.length >= 3, null, { timeout: 8000 }).catch(() => {});
  await idle(page);
  ok("ASSIST: «Найди в интернете…» — с поиском", (await page.evaluate(() => window.__web.length)) === 3 && (await page.evaluate(() => window.__chat)) === 1);
  await send(page, "Как закрыть смену?");
  await page.waitForFunction(() => window.__chat >= 2, null, { timeout: 8000 }).catch(() => {});
  await idle(page); await page.waitForTimeout(300);
  ok("ASSIST: «Как закрыть смену?» — без интернета и без «Проверить в интернете»", (await page.evaluate(() => window.__web.length)) === 3 && (await page.evaluate(() => window.__chat)) === 2 && !(await page.$("[data-ai-web-check]")));
  // интернет не ответил — обычный ответ ассистента, без ошибки
  await page.evaluate(() => { window.__answerFail = true; });
  const n0 = await page.evaluate(() => document.querySelectorAll("[data-ai-web]").length), r0 = await demoReplies(page);
  await send(page, "Есть ли у нас виски Ardbeg Uigeadail?");
  await page.waitForTimeout(400);
  const busyF = await textOf(page, "[data-ai-web-busy]");
  await page.waitForFunction(() => window.__chat >= 3, null, { timeout: 8000 }).catch(() => {});
  await idle(page); await page.waitForTimeout(300);
  const st = { web: await page.evaluate(() => window.__web.map((w) => w.question)), chat: await page.evaluate(() => window.__chat), lines: await page.evaluate(() => document.querySelectorAll("[data-ai-web]").length), replies: await demoReplies(page), busyF };
  ok("ASSIST: «Ardbeg Uigeadail» (в карте нет) — сначала поиск («Ищу в интернете…»); интернет не ответил — обычный ответ (ai-chat), без ошибки и без ссылок", st.web.length === 4 && st.web[3] === "Есть ли у нас виски Ardbeg Uigeadail?"
    && busyF === "Ищу в интернете…" && st.chat === 3 && st.replies === r0 + 1 && st.lines === n0 && !/Не получилось поискать/.test(await page.evaluate(() => document.body.innerText)), JSON.stringify(st));
  ok("ASSIST: под обычным ответом о виски — «Проверить в интернете»", !!(await page.$("[data-ai-web-check]")));
  await page.evaluate(() => { window.__answerFail = false; });
  ok("ASSIST: без ошибок страницы", !errs.length, errs.join(" | "));
  // ссылки — часть чата: после перезагрузки на месте
  await page.goto(URL0, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await prep(page, errs, false);
  await assistant(page);
  const b3 = await bubbles(page);
  ok("ASSIST: после перезагрузки ссылки под ответами на месте", b3.length === 2 && b3[0] === "Нашёл в интернете: example.com" && b3[1] === "Проверил в интернете: example.com", JSON.stringify(b3));
  await ctx.close();
}

// ── LIGHT ──────────────────────────────────────────────────────────────────────────────────────
if (want("LIGHT")) {
  const { ctx, page, errs } = await open({ who: "anna", light: true });
  await assistant(page);
  await send(page, "Что за вино Château Margaux?");
  await page.waitForSelector("[data-ai-web]", { timeout: 15000 }).catch(() => {});
  await idle(page);
  const st = await page.evaluate(() => { const w = document.querySelector("[data-ai-web]"), a = document.querySelector("[data-ai-web-src]");
    return { fs: w && getComputedStyle(w).fontSize, link: a && getComputedStyle(a).color, line: w && getComputedStyle(w).color }; });
  ok("LIGHT: «Для чтения» — строка ссылок 14 px, ссылка тёмным золотом", st.fs === "14px" && !!st.link && st.link !== "rgb(214, 178, 102)" && st.link !== "rgb(200, 169, 110)", JSON.stringify(st));
  await page.screenshot({ path: join(OUT, "light-ai.png") });
  ok("LIGHT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
  const m = await open({ light: true });
  await editor(m.page); await gapsFirst(m.page);
  await click(m.page, "[data-wine-bulk-web]"); await m.page.waitForTimeout(400);
  const cost = await m.page.evaluate(() => { const e = document.querySelector("[data-wine-web-cost]"); return e && { fs: getComputedStyle(e).fontSize, c: getComputedStyle(e).color }; });
  ok("LIGHT: вопрос «Поискать в интернете» читается (цена — 13 px)", !!cost && cost.fs === "13px", JSON.stringify(cost));
  await m.page.screenshot({ path: join(OUT, "light-web-ask.png") });
  ok("LIGHT: без ошибок страницы (барная карта)", !m.errs.length, m.errs.join(" | "));
  await m.ctx.close();
}

// ── NARROW ─────────────────────────────────────────────────────────────────────────────────────
if (want("NARROW")) {
  const ov = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  const inView = (page, sel) => page.evaluate((s) => { const all = [...document.querySelectorAll(s)]; return all.length > 0 && all.every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; }); }, sel);
  const { ctx, page, errs } = await open({ width: 320, height: 700 });
  await editor(page); await gapsFirst(page);
  ok("NARROW: 320 px — «Поискать в интернете · 2» в экране", (await inView(page, "[data-wine-bulk-web]")) && (await ov(page)) <= 1);
  await click(page, "[data-wine-bulk-web]"); await page.waitForTimeout(400);
  ok("NARROW: 320 px — вопрос, цена и кнопки в экране", (await inView(page, "[data-wine-bulk-ask], [data-wine-web-cost], [data-wine-bulk-go], [data-wine-bulk-cancel]")) && (await ov(page)) <= 1);
  await click(page, "[data-wine-bulk-go]"); await waitDone(page);
  ok("NARROW: 320 px — итог поиска в экране", (await inView(page, "[data-wine-bulk-done], [data-wine-web-found], [data-wine-bulk-end]")) && (await ov(page)) <= 1);
  await page.screenshot({ path: join(OUT, "web-320-done.png") });
  ok("NARROW: без ошибок страницы (барная карта)", !errs.length, errs.join(" | "));
  await ctx.close();
  const a = await open({ who: "anna", width: 320, height: 700 });
  await assistant(a.page);
  await send(a.page, "Что за вино Château Margaux?");
  await a.page.waitForSelector("[data-ai-web]", { timeout: 15000 }).catch(() => {});
  await idle(a.page);
  await send(a.page, "Расскажи про Шабли");
  await a.page.waitForSelector("[data-ai-web-check]", { timeout: 15000 }).catch(() => {});
  ok("NARROW: 320 px — ссылки и «Проверить в интернете» в экране, без прокрутки вбок", (await inView(a.page, "[data-ai-web], [data-ai-web-check]")) && (await ov(a.page)) <= 1);
  await a.page.screenshot({ path: join(OUT, "ai-320.png") });
  ok("NARROW: без ошибок страницы (ассистент)", !a.errs.length, a.errs.join(" | "));
  await a.ctx.close();
}

await browser.close(); server.close();
console.log(`итог: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
