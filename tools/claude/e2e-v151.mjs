// e2e v151 (Доп. 475): «Дописать пустое» — вся барная карта за раз. Сайт — демо целиком (tools/claude/demo-app/build.mjs: сервер
// в странице, AI карты — догадки по названию, mode "gaps"; экран открывает window.__saNav).
// Разделы: BULK (Мария: кнопка в сводке «Дописать пустое · N» = вина + крепкое; вопрос — что впишет и что не тронет; итог:
// дописано, «AI не нашёл» — своя настойка, «Скопировать названия»; в карте: год, объём, цены, порции и вписанное — как были,
// новое — с пометкой «AI», что AI не знал — aiTried; «Проверка подряд» открывается; второй раз кнопки нет), OTHER («Проверить
// крепкое ›» — редактор крепкого сразу в «Проверке подряд»), STOP («Остановить» — готовое сохранено, остальное — кнопкой
// ещё раз), FAIL (AI не ответил по винам — «не ответил по N», вина не тронуты, крепкое дописано; ещё раз — допишет вина),
// LIGHT («Для чтения»), NARROW (320 px).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v151.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5351, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v151";
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
  // пачки «Дописать пустое»: задержка (STOP) и отказ AI по виду напитка (FAIL) — обёрткой поверх fetch демо
  await page.evaluate(() => {
    const f = window.fetch; window.__gapsDelay = 0; window.__gapsFail = ""; window.__gapsCalls = [];
    window.fetch = (u, init) => {
      if (/\/api\/wine-import/.test(String(u)) && init && /"mode":"gaps"/.test(String(init.body))) {
        const b = JSON.parse(init.body), kind = b.kind || "wine";
        window.__gapsCalls.push({ kind, n: (b.items || []).length, missing: (b.items || []).map((x) => x.missing) });
        if (window.__gapsFail === kind) return new Promise((ok) => setTimeout(() => ok(new Response("<html>timeout</html>", { status: 504 })), 300));
        if (window.__gapsDelay) return new Promise((ok) => setTimeout(ok, window.__gapsDelay)).then(() => f(u, init));
      }
      return f(u, init);
    };
  });
  return { ctx, page, errs };
}
const editor = async (page) => { await page.evaluate(() => window.__saNav("wineEditor")); await page.waitForTimeout(2200); };
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

// ── BULK ───────────────────────────────────────────────────────────────────────────────────────
if (want("BULK")) {
  const { ctx, page, errs } = await open();
  await editor(page);
  const before = await bar(page);
  const n0 = Number(await attr(page, "[data-wine-bulk]", "data-wine-bulk"));
  const btn = await textOf(page, "[data-wine-bulk]");
  ok("BULK: в сводке «Дописать пустое · N» — вина и крепкое вместе", n0 >= 15 && btn === "Дописать пустое · " + n0, JSON.stringify({ n0, btn }));
  await page.screenshot({ path: join(OUT, "bulk-1-list.png") });
  await click(page, "[data-wine-bulk]"); await page.waitForTimeout(500);
  const ask = await textOf(page, "[data-wine-bulk-ask]");
  const plan = await textOf(page, "[data-wine-bulk-plan]");
  const pm = String(plan).match(/вина — (\d+), крепкое — (\d+)/);
  ok("BULK: вопрос — сколько позиций (вина — …, крепкое — …), что впишет", !!ask && ask.includes("AI допишет пустые поля у " + n0 + " позиций") && !!pm && Number(pm[1]) + Number(pm[2]) === n0 && /Что впишет/.test(ask), JSON.stringify({ ask, plan }));
  ok("BULK: «Не трогает: год урожая, объём, цены и порции. Уже вписанное не меняет»; про тренировку", /Год урожая, объём, цены и порции\. Уже вписанное не меняет\./.test(ask) && /пока не проверишь, позиция не идёт в тренировку/.test(ask), ask);
  await page.screenshot({ path: join(OUT, "bulk-2-ask.png") });
  await click(page, "[data-wine-bulk-go]");
  await page.waitForTimeout(400);
  const work = await textOf(page, "[data-wine-bulk-work]");
  ok("BULK: работа — «AI дописывает вина», счётчик «0 из N», «Остановить»", !!work && /AI дописывает (вина|крепкое)/.test(work) && /\d+ из \d+/.test(work) && !!(await textOf(page, "[data-wine-bulk-stop]")), work);
  const done = await waitDone(page);
  const sum = await textOf(page, "[data-wine-bulk-sum]");
  const doneAttr = String(await attr(page, "[data-wine-bulk-done]", "data-wine-bulk-done") || "").split("/").map(Number);
  ok("BULK: итог — «Готово», «Дописано у N позиций, полей: …» с разбивкой по видам", done && /^Дописано у \d+ позиций, полей: \d+ \(вина — \d+, крепкое — \d+\)\.$/.test(String(sum)) && doneAttr[0] >= 14, JSON.stringify({ sum, doneAttr }));
  const none = await textOf(page, "[data-wine-bulk-none]");
  // v152: в демо ещё кальвадос, которого AI не знает (его находит «Поискать в интернете»), — «не нашёл» не меньше одной
  ok("BULK: «AI не нашёл, что дописать» — своя настойка; «Скопировать названия»", !!none && none.includes("Настойка «Облепиха с мёдом», своя") && doneAttr[1] >= 1 && !!(await textOf(page, "[data-wine-bulk-copy]")), none);
  await click(page, "[data-wine-bulk-copy]"); await page.waitForTimeout(300);
  ok("BULK: «Скопировать названия» → «Скопировано ✓»", (await textOf(page, "[data-wine-bulk-copy]")) === "Скопировано ✓");
  await page.screenshot({ path: join(OUT, "bulk-3-done.png") });
  const after = await bar(page);
  const byId = Object.fromEntries(after.map((d) => [d.id, d]));
  const kept = before.every((b) => { const a = byId[b.id]; return a && KEEP.every((f) => JSON.stringify(a[f] ?? "") === JSON.stringify(b[f] ?? "")); });
  // служебное: отметки проверки и сохранения; v152 — aiNone (AI своих знаний не хватило) и aiWeb (поиск в интернете)
  const SERVICE = ["ai", "aiTried", "aiNone", "aiWeb", "checkedAt", "checkedBy", "updatedAt", "updatedBy", "taste"];
  const diffs = [];
  before.forEach((b) => { const a = byId[b.id]; if (!a) { diffs.push(b.name + ": нет"); return; }
    Object.keys(b).filter((f) => !SERVICE.includes(f) && has(b[f])).forEach((f) => { if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) diffs.push(b.name + "." + f); }); });
  ok("BULK: год, объём, цены, порции и «бокалом» — как были у всех позиций", kept && after.length === before.length);
  ok("BULK: вписанное раньше не изменилось ни в одной позиции", !diffs.length, diffs.slice(0, 6).join(", "));
  const fresh = after.map((a) => { const b = before.find((x) => x.id === a.id) || {}; const add = Object.keys(a).filter((f) => !SERVICE.includes(f) && has(a[f]) && !has(b[f])); return { a, add }; });
  const marked = fresh.every(({ a, add }) => add.every((f) => (a.ai || []).includes(f)));
  ok("BULK: всё новое — с пометкой «AI» (ждёт проверки)", marked && fresh.some((x) => x.add.length), JSON.stringify(fresh.filter((x) => x.add.length).slice(0, 2).map((x) => ({ n: x.a.name, add: x.add, ai: x.a.ai }))));
  const ab = byId["sp-demo-11"] || after.find((d) => /ABERFELDY/.test(d.name));
  ok("BULK: «Аберфелди 12» — производитель, стиль, регион, ноты, рассказ; выдержка, порция и цена — как были", !!ab && ab.producer === "Aberfeldy" && ab.region === "Хайленд" && !!ab.story && ab.age === "12 лет" && ab.portion === 40 && ab.pricePortion === 700, JSON.stringify(ab && { p: ab.producer, r: ab.region, age: ab.age, portion: ab.portion }));
  const tin = after.find((d) => /Облепиха/.test(d.name));
  ok("BULK: своя настойка — ничего не выдумано, спрошенное запомнено (aiTried)", !!tin && !has(tin.story) && !has(tin.cat) && (tin.aiTried || []).includes("story") && !(tin.aiTried || []).includes("pricePortion"), JSON.stringify(tin));
  const calls = await page.evaluate(() => window.__gapsCalls);
  ok("BULK: пачки по 4, у вин не спрашивали год и объём, у крепкого — порцию и цены", calls.length >= 5 && calls.every((c) => c.n <= 4) && calls.every((c) => c.missing.flat().every((f) => !KEEP.includes(f))), JSON.stringify(calls.map((c) => c.kind + ":" + c.n)));
  const rv = Number(await attr(page, "[data-wine-bulk-review]", "data-wine-bulk-review"));
  await click(page, "[data-wine-bulk-review]"); await page.waitForTimeout(700);
  const revScreen = await attr(page, "[data-wine-review-screen]", "data-wine-review-screen");
  ok("BULK: «Проверка подряд · N» — сразу проверка дописанного", rv >= 8 && !!revScreen && revScreen.endsWith("/" + rv), JSON.stringify({ rv, revScreen }));
  await page.evaluate(() => { const b = document.querySelector('[data-lens="back"]'); if (b) b.click(); }); await page.waitForTimeout(600);
  ok("BULK: второй раз дописывать нечего — кнопки нет (что AI не знал, не спрашиваем снова)", !(await page.$("[data-wine-bulk]")) && !!(await page.$("[data-wine-sum-card]")));
  ok("BULK: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── OTHER ──────────────────────────────────────────────────────────────────────────────────────
if (want("OTHER")) {
  const { ctx, page, errs } = await open();
  await editor(page);
  await click(page, "[data-wine-bulk]"); await page.waitForTimeout(400);
  await click(page, "[data-wine-bulk-go]");
  await waitDone(page);
  const other = await textOf(page, "[data-wine-bulk-other]");
  ok("OTHER: в итоге — «Проверить крепкое · N ›»", /^Проверить крепкое · \d+ ›$/.test(String(other)), other);
  await click(page, "[data-wine-bulk-other]"); await page.waitForTimeout(1500);
  const head = await page.evaluate(() => (document.querySelector("[data-wine-review-screen]") || {}).innerText || "");
  ok("OTHER: открылся редактор крепкого сразу в «Проверке подряд»", /Барная карта · Крепкое/.test(head) && /Проверка подряд/.test(head), head.slice(0, 120));
  await page.screenshot({ path: join(OUT, "bulk-4-spirit-review.png") });
  ok("OTHER: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── STOP ───────────────────────────────────────────────────────────────────────────────────────
if (want("STOP")) {
  const { ctx, page, errs } = await open();
  await editor(page);
  const n0 = Number(await attr(page, "[data-wine-bulk]", "data-wine-bulk"));
  await page.evaluate(() => { window.__gapsDelay = 1200; });
  await click(page, "[data-wine-bulk]"); await page.waitForTimeout(300);
  await click(page, "[data-wine-bulk-go]"); await page.waitForTimeout(500);
  await click(page, "[data-wine-bulk-stop]"); await page.waitForTimeout(200);
  const stopping = await textOf(page, "[data-wine-bulk-work]");
  ok("STOP: «Остановить» — «Останавливаю…», кнопка неактивна", /Останавливаю…/.test(String(stopping)) && (await page.evaluate(() => document.querySelector("[data-wine-bulk-stop]").disabled)), stopping);
  await waitDone(page);
  const card = await textOf(page, "[data-wine-bulk-done]");
  ok("STOP: итог «Остановлено», остальное — «Дописать пустое» ещё раз", /^Остановлено/.test(String(card)) && /Остальное допишется, если нажать «Дописать пустое» ещё раз/.test(String(card)), card);
  const saved = (await bar(page)).filter((d) => (d.ai || []).includes("story")).length;
  await click(page, "[data-wine-bulk-end]"); await page.waitForTimeout(500);
  const n1 = Number(await attr(page, "[data-wine-bulk]", "data-wine-bulk"));
  ok("STOP: готовое сохранено, на кнопке — только оставшееся", saved >= 4 && n1 > 0 && n1 < n0, JSON.stringify({ n0, n1, saved }));
  ok("STOP: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── FAIL ───────────────────────────────────────────────────────────────────────────────────────
if (want("FAIL")) {
  const { ctx, page, errs } = await open();
  await editor(page);
  const before = await bar(page);
  await page.evaluate(() => { window.__gapsFail = "wine"; });
  await click(page, "[data-wine-bulk]"); await page.waitForTimeout(300);
  await click(page, "[data-wine-bulk-go]");
  await waitDone(page);
  const failed = await textOf(page, "[data-wine-bulk-failed]");
  ok("FAIL: AI не ответил по винам — «AI не ответил по 8 позициям: … код 504 …»", /^AI не ответил по 8 позициям: AI не успел ответить: сервер перестал ждать \(код 504\)/.test(String(failed)) && /возьмёт только оставшееся/.test(String(failed)), failed);
  const after = await bar(page);
  const winesSame = before.filter((d) => d.kind === "wine").every((b) => JSON.stringify(after.find((a) => a.id === b.id)) === JSON.stringify(b));
  const spiritsDone = after.filter((d) => d.kind === "spirit" && (d.ai || []).includes("story")).length;
  ok("FAIL: вина не тронуты, крепкое дописано", winesSame && spiritsDone >= 8, JSON.stringify({ winesSame, spiritsDone }));
  await page.evaluate(() => { window.__gapsFail = ""; });
  await click(page, "[data-wine-bulk-end]"); await page.waitForTimeout(500);
  const n1 = Number(await attr(page, "[data-wine-bulk]", "data-wine-bulk"));
  await click(page, "[data-wine-bulk]"); await page.waitForTimeout(300);
  const plan = await textOf(page, "[data-wine-bulk-plan]");
  await click(page, "[data-wine-bulk-go]");
  await waitDone(page);
  const sum = await textOf(page, "[data-wine-bulk-sum]");
  ok("FAIL: ещё раз — только вина («вина — 8»), дописаны", n1 === 8 && plan === "вина — 8" && /^Дописано у 8 позиций/.test(String(sum)), JSON.stringify({ n1, plan, sum }));
  ok("FAIL: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── LIGHT ──────────────────────────────────────────────────────────────────────────────────────
if (want("LIGHT")) {
  const { ctx, page, errs } = await open({ light: true });
  await editor(page);
  await click(page, "[data-wine-bulk]"); await page.waitForTimeout(400);
  const st = await page.evaluate(() => { const go = document.querySelector("[data-wine-bulk-go]"), t = document.querySelector("[data-wine-bulk-keep]"); return { go: go && getComputedStyle(go).color, keep: t && getComputedStyle(t).fontSize }; });
  ok("LIGHT: «Для чтения» — вопрос читается (текст 14 px), «Дописать» на месте", !!st.go && st.keep === "14px", JSON.stringify(st));
  await page.screenshot({ path: join(OUT, "bulk-light-ask.png") });
  await click(page, "[data-wine-bulk-go]");
  await waitDone(page);
  await page.screenshot({ path: join(OUT, "bulk-light-done.png") });
  ok("LIGHT: итог на месте", !!(await textOf(page, "[data-wine-bulk-sum]")));
  ok("LIGHT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── NARROW ─────────────────────────────────────────────────────────────────────────────────────
if (want("NARROW")) {
  const { ctx, page, errs } = await open({ width: 320, height: 700 });
  await editor(page);
  const ov = () => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  const inView = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; }), sel);
  ok("NARROW: 320 px — кнопка «Дописать пустое» в экране", (await inView("[data-wine-bulk]")) && (await ov()) <= 1);
  await click(page, "[data-wine-bulk]"); await page.waitForTimeout(400);
  ok("NARROW: 320 px — вопрос и кнопки в экране, без прокрутки вбок", (await inView("[data-wine-bulk-ask], [data-wine-bulk-go], [data-wine-bulk-cancel]")) && (await ov()) <= 1);
  await click(page, "[data-wine-bulk-go]");
  await waitDone(page);
  ok("NARROW: 320 px — итог и кнопки в экране", (await inView("[data-wine-bulk-done], [data-wine-bulk-review], [data-wine-bulk-other], [data-wine-bulk-end]")) && (await ov()) <= 1);
  await page.screenshot({ path: join(OUT, "bulk-320-done.png") });
  ok("NARROW: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`итог: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
