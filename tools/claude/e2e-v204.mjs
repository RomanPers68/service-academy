// e2e v204 (Доп. 530): импорт меню из PDF по частям. Демо целиком (tools/claude/demo-app/build.mjs), Мария — руководитель.
//   OK    — «Из PDF»: запрос списка, потом подробности пачками 4 + 2; пока читает — «Читаю PDF… N из 6»; превью «Нашёл
//           блюд: 6» без пометок «не дочитал»; «Добавить» — шесть блюд в своих, служебных пометок в блюдах нет;
//   SHORT — подробности одной позиции «модель» не находит: её спросили ещё раз отдельно; в превью — «Подробности не
//           дочитались: 1» и пометка у этого блюда;
//   SLOW  — запрос списка не дождался (страница хостинга, код 504): «AI не успел прочитать меню… (код 504)…», а не
//           «Сеть недоступна…»;
//   BIG   — PDF больше 3 МБ: «PDF больше 3 МБ…» сразу, запросов нет.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v204.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5713, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v204";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  const buf = readFileSync(f);
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream", "Content-Length": buf.length }); res.end(buf);
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 600) : "")); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const R0 = "Два моря, Океан";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
const DEMO_NAMES = ["Паштет из утиной печени с брусникой", "Гёдза с томлёной говядиной", "Салат с уткой и хурмой", "Лосось Веллингтон", "Трайфл «Вишня в шоколаде»", "Коктейль «Иней» б/а"];

async function prep(page) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => {});
  await sleep(1300);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg,#demo-strip,#demo-tgchat,#demo-push{display:none!important}" });
}
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
await page.goto(URL0, { waitUntil: "load" });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__demo_who", "maria"); localStorage.setItem("sa_lesson_cards", "1"); });
await page.goto(URL0, { waitUntil: "load" });
await prep(page);

const until = async (fn, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch (e) { /* */ } await sleep(120); } return null; };
const body = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const calls = () => page.evaluate(() => (window.__demoMenuCalls || []).map((c) => ({ mode: c.mode, n: c.names ? c.names.length : 0, names: c.names })));
const shot = (name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const run = async (key, fn) => { if (!want(key)) return; try { await fn(); } catch (e) { ok(key + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };
const openEditor = async () => {
  await page.evaluate(() => window.__saNav("menuTrainer")); await sleep(1800);
  await page.locator("text=Редактор меню").first().click(); await sleep(1300);
};
const pick = (file) => page.setInputFiles('input[accept="application/pdf"] >> nth=0', file);
const reset = (flags) => page.evaluate((f) => { window.__demoMenuCalls = []; localStorage.removeItem("__demo_menu_504"); localStorage.removeItem("__demo_menu_short");
  for (const [k, v] of Object.entries(f || {})) localStorage.setItem(k, v); }, flags);

await openEditor();

await run("OK", async () => {
  await reset();
  const seen = new Set();
  const watch = setInterval(() => { page.evaluate(() => [...document.querySelectorAll("label")].map((l) => l.textContent.trim()).filter((t) => /^Читаю PDF/.test(t))).then((a) => a.forEach((t) => seen.add(t))).catch(() => {}); }, 80);
  await pick({ name: "zima.pdf", mimeType: "application/pdf", buffer: PDF });
  const got = await until(async () => /Нашёл блюд: 6/.test(await body()), 15000);
  clearInterval(watch);
  ok("OK: превью — «AI разобрал PDF», «Нашёл блюд: 6»", got === true && /AI разобрал PDF · проверь до добавления/.test(await body()));
  const cs = await calls();
  ok("OK: сначала список, потом подробности пачками 4 и 2", cs.length === 3 && cs[0].mode === "names" && cs.slice(1).every((c) => c.mode === "details")
    && cs.slice(1).map((c) => c.n).sort().join(",") === "2,4", cs);
  ok("OK: пока читает — «Читаю PDF… N из 6»", [...seen].some((t) => /^Читаю PDF… \d из 6$/.test(t)), [...seen]);
  ok("OK: пометок «не дочитал» нет", (await page.locator("[data-import-short], [data-import-short-dish]").count()) === 0);
  ok("OK: старой фразы «Сеть недоступна…» нет", !/Сеть недоступна/.test(await body()));
  await shot("1-preview");
  await page.locator("text=Добавить (6) ✓").first().click(); await sleep(900);
  const saved = await page.evaluate((r) => { try { return JSON.parse(localStorage.getItem("sa_menu_custom") || "{}")[r] || []; } catch (e) { return []; } }, R0);
  const names = saved.map((d) => d.name);
  ok("OK: «Добавить» — шесть блюд в своих, по порядку меню, новинки", DEMO_NAMES.every((n) => names.includes(n)) && saved.filter((d) => DEMO_NAMES.includes(d.name)).every((d) => d.isNew === true),
    names);
  ok("OK: служебных пометок импорта (short, ask) в блюдах нет", saved.every((d) => !("short" in d) && !("ask" in d)), saved.map((d) => Object.keys(d).join(",")).slice(0, 2));
  await shot("2-added");
});

await run("SHORT", async () => {
  await reset({ __demo_menu_short: "Лосось Веллингтон" });
  await pick({ name: "zima.pdf", mimeType: "application/pdf", buffer: PDF });
  const got = await until(async () => (await page.locator("[data-import-short]").count()) === 1, 15000);
  ok("SHORT: в превью — «Подробности не дочитались: 1»", got === true && (await page.locator("[data-import-short]").getAttribute("data-import-short")) === "1"
    && /Подробности не дочитались: 1\. Эти блюда добавятся с названием и разделом, остальное заполни по PDF\./.test(await body()));
  ok("SHORT: пометка «AI не дочитал описание — заполни по PDF» — у одного блюда", (await page.locator("[data-import-short-dish]").count()) === 1
    && (await page.locator("[data-import-short-dish]").first().textContent()) === "AI не дочитал описание — заполни по PDF");
  const cs = await calls();
  ok("SHORT: недочитанную позицию спросили ещё раз отдельно", cs.filter((c) => c.mode === "details" && (c.names || []).includes("Лосось Веллингтон")).length === 2
    && cs.some((c) => c.mode === "details" && c.n === 1 && c.names[0] === "Лосось Веллингтон"), cs);
  ok("SHORT: в превью все шесть", /Нашёл блюд: 6/.test(await body()));
  await page.locator('[data-import-short-dish]').first().scrollIntoViewIfNeeded(); await sleep(300);
  await shot("3-short");
  await page.locator("text=Отмена").first().click(); await sleep(700);
});

await run("SLOW", async () => {
  await reset({ __demo_menu_504: "1" });
  await pick({ name: "zima.pdf", mimeType: "application/pdf", buffer: PDF });
  const msg = "AI не успел прочитать меню: сервер перестал ждать (код 504). Нажми «Из PDF» ещё раз";
  const got = await until(async () => (await body()).includes(msg), 12000);
  ok("SLOW: страница хостинга вместо ответа — «AI не успел прочитать меню… (код 504)…»", got === true);
  ok("SLOW: не «Сеть недоступна…»", !/Сеть недоступна/.test(await body()));
  ok("SLOW: подробности не спрашивали", (await calls()).every((c) => c.mode === "names"), await calls());
  await page.locator(`text=${msg}`).first().scrollIntoViewIfNeeded(); await sleep(200);
  await shot("4-slow");
});

await run("BIG", async () => {
  await reset();
  await pick({ name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.concat([PDF, Buffer.alloc(3 * 1024 * 1024 + 100, 32)]) });
  const got = await until(async () => (await body()).includes("PDF больше 3 МБ: сервер такой не примет. Сожми файл или раздели меню на части."), 6000);
  ok("BIG: PDF больше 3 МБ — сразу понятные слова", got === true);
  ok("BIG: запросов к серверу нет", (await calls()).length === 0, await calls());
});

ok("без ошибок страницы", !errs.length, errs.join(" | "));
await browser.close(); server.close();
console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
process.exit(fail ? 1 : 0);
