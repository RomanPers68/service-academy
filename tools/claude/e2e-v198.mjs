// e2e v198 (Доп. 523): заведения и должности — свои списки у владельца. Демо целиком (tools/claude/demo-app/build.mjs):
// сервер демо отвечает, как этап 61 (lib/org-model.js); __demo_no61 = "1" — сервер без этапа 61.
//   ORG   — «Команда» у владельца: «Заведения и должности» (1 в списке); видно «Два моря, Океан», «Скрытые · 4»;
//           «+ Заведение» → «Алёнка» (подсказки «Вернуть скрытое»), «+ Должность» → «Бариста» как бармен (подсказка, что
//           даёт); в списках сразу; снимки для владельца;
//   FORM  — «+ Добавить»: заведения и должности из списков, пунктирные «+»; «+ Заведение» → вернуть «Порт» — он сразу
//           выбран; Кира — «Бариста» в «Порту»: код, в списке команды «Бариста»;
//   MOVE  — карточка Анны → «Заведение и должность» → «Алёнка», «Бариста»: в карточке «Алёнка · Бариста»;
//   MENU  — меню у владельца: вкладки «Два моря, Океан», «Алёнка», «Порт»; скрыли «Алёнку» — вкладки нет;
//   STAFF — Анна (официант): в меню только своё заведение, без вкладок; «Аккаунт» — «Официант»;
//   NOSTAGE — без этапа 61: «нужен этап 61», в форме прежние пять заведений и шесть должностей, «+» нет; экран — подсказка.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v198.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5698, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v198";
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
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 700) : "")); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();

async function open({ who = "roman", no61 = false, dsf = 2 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, n]) => { localStorage.clear(); localStorage.setItem("__demo_who", w); if (n) localStorage.setItem("__demo_no61", "1"); localStorage.setItem("sa_lesson_cards", "1"); }, [who, no61]);
  await page.goto(URL0, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await sleep(1300);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg,#demo-strip,#demo-tgchat,#demo-push{display:none!important}" });
  return { ctx, page, errs };
}
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch (e) { /* */ } await sleep(150); } return null; };
const texts = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((x) => x.textContent.replace(/\s+/g, " ").trim()), sel);
const attrs = (page, sel, a) => page.evaluate(([s, k]) => [...document.querySelectorAll(s)].map((x) => x.getAttribute(k)), [sel, a]);
const click = async (page, sel, wait = 500) => { await page.locator(sel).first().click(); await sleep(wait); };
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const run = async (key, fn) => { if (!want(key)) return; try { await fn(); } catch (e) { ok(key + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };
const tabs = (page) => page.evaluate(() => [...document.querySelectorAll("[data-liquid-seg] [data-liquid-item], [data-liquid-seg] button")].map((x) => x.textContent.trim()).filter(Boolean));

// ── ORG: экран «Заведения и должности» ───────────────────────────────────────────────────────────────────────
await run("ORG", async () => {
  const { ctx, page, errs } = await open({ dsf: 3 });
  await nav(page, "team", 2200);
  ok("ORG: в «Команде» у владельца — «Заведения и должности», 1 в списке", !!(await until(async () => (await texts(page, "[data-team-org]")).join("").includes("1 в списке"))), await texts(page, "[data-team-org]"));
  await click(page, "[data-team-org]", 900);
  ok("ORG: экран открыт, в списке «Два моря, Океан», скрытых 4", (await texts(page, "[data-org-list=venue] [data-org-rename]")).length === 1
    && (await texts(page, "[data-org-hidden=venue]"))[0] === "▸ Скрытые · 4", [await attrs(page, "[data-org-rename]", "data-org-rename"), await texts(page, "[data-org-hidden]")]);
  await click(page, "[data-org-open=venue]", 600);
  ok("ORG: «+ Заведение» — окно, подсказки «Вернуть скрытое»: четыре прежних", JSON.stringify(await attrs(page, "[data-org-sheet=venue] [data-org-return]", "data-org-return")) === JSON.stringify(["Марико", "Мясник", "Порт", "Камчадал"]),
    await attrs(page, "[data-org-return]", "data-org-return"));
  await page.locator("[data-org-sheet=venue] [data-org-name]").fill("  Алёнка ");
  await shot(page, "owner-2-new-venue");
  await click(page, "[data-org-sheet=venue] [data-org-save]", 900);
  ok("ORG: «Алёнка» добавлена — окно закрыто, сообщение, в списке после «Два моря, Океан»",
    !(await page.locator("[data-org-sheet]").count()) && (await texts(page, "[data-org-msg=ok]"))[0] === "Заведение «Алёнка» добавлено: уже есть в меню и в выборе."
    && JSON.stringify(await attrs(page, "[data-org-list=venue] [data-org-rename]", "data-org-rename")) === JSON.stringify(["Два моря, Океан", "Алёнка"]),
    [await texts(page, "[data-org-msg]"), await attrs(page, "[data-org-list=venue] [data-org-rename]", "data-org-rename")]);
  await click(page, "[data-org-open=position]", 600);
  await page.locator("[data-org-sheet=position] [data-org-name]").fill("Бариста");
  await click(page, "[data-org-sheet=position] [data-org-base=bartender]", 300);
  ok("ORG: «+ Должность» — «работает как» шесть, подсказка у бармена", (await attrs(page, "[data-org-sheet=position] [data-org-base]", "data-org-base")).length === 6
    && (await texts(page, "[data-org-sheet=position] [data-org-hint]"))[0] === "Права сотрудника зала, курс «Бар», чат бара", await texts(page, "[data-org-hint]"));
  await shot(page, "owner-3-new-position");
  await click(page, "[data-org-sheet=position] [data-org-save]", 900);
  const pos = await texts(page, "[data-org-list=position] > div");
  ok("ORG: «Бариста» в должностях — «как бармен»", pos.some((t) => /^Бариста.*как бармен/.test(t)), pos);
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
  await shot(page, "owner-1-org");
  ok("ORG: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── FORM, MOVE, MENU: форма с «+», перевод, вкладки меню (один телефон — одни данные демо) ─────────────────────
await run("FORM", async () => {
  const { ctx, page, errs } = await open({ dsf: 3 });
  await nav(page, "team", 2200);
  await click(page, "[data-team-org]", 900);
  await click(page, "[data-org-open=venue]", 500);
  await page.locator("[data-org-sheet=venue] [data-org-name]").fill("Алёнка");
  await click(page, "[data-org-sheet=venue] [data-org-save]", 800);
  await click(page, "[data-org-open=position]", 500);
  await page.locator("[data-org-sheet=position] [data-org-name]").fill("Бариста");
  await click(page, "[data-org-sheet=position] [data-org-base=bartender]", 200);
  await click(page, "[data-org-sheet=position] [data-org-save]", 800);
  await page.evaluate(() => window.__saBack && window.__saBack()); await sleep(400);
  if (!(await page.locator("button:has-text('+ Добавить')").count())) { await click(page, "[data-lens=back]", 700); }
  await click(page, "button:has-text('+ Добавить')", 900);
  ok("FORM: заведения из списка — «Два моря, Океан», «Алёнка»; пунктирный «+ Заведение»",
    JSON.stringify(await attrs(page, "[data-team-venue]", "data-team-venue")) === JSON.stringify(["Два моря, Океан", "Алёнка"]) && (await page.locator("[data-org-add=venue]").count()) === 1,
    await attrs(page, "[data-team-venue]", "data-team-venue"));
  const posT = await texts(page, "[data-team-pos]");
  // v200: сервер демо с этапом 63 — ещё «Управляющий» (как менеджер, старше менеджера), его добавляет этап 63
  ok("FORM: должности — шесть прежних, «Управляющий» и «Бариста»; «+ Должность»", posT.length === 8 && posT[6] === "Управляющий" && posT[7] === "Бариста"
    && (await page.locator("[data-org-add=position]").count()) === 1, posT);
  await shot(page, "owner-4-form");
  await click(page, "[data-org-add=venue]", 500);
  await click(page, "[data-org-sheet=venue] [data-org-return=\"Порт\"]", 900);
  ok("FORM: вернули «Порт» из окна — он в ряду и сразу выбран", (await attrs(page, "[data-team-venue].sa-chip-on", "data-team-venue"))[0] === "Порт" && !(await page.locator("[data-org-sheet]").count()),
    await attrs(page, "[data-team-venue].sa-chip-on", "data-team-venue"));
  await page.locator("input[placeholder='Имя']").fill("Кира");
  await page.locator("input[placeholder='Фамилия']").fill("Новикова");
  await click(page, "[data-team-pos]:has-text('Бариста')", 300);
  await click(page, "button:has-text('Создать и получить код')", 1400);
  ok("FORM: Кира создана — код и заведение на экране", !!(await until(async () => (await page.locator("text=/ДЕМО-\\d{4}/").count()) > 0, 5000)) && (await page.locator("text=Порт").count()) > 0);
  await click(page, "button:has-text('Готово')", 1400);
  const kira = await until(async () => { const t = await texts(page, "div.sa-btn[data-lens-card]"); return t.find((x) => x.includes("Кира Новикова") && /Бариста ·/.test(x)); }, 8000);
  ok("FORM: в списке команды Кира — «Бариста»", !!kira, (await texts(page, "div.sa-btn[data-lens-card]")).filter((x) => x.includes("Кира")));

  // MOVE
  if (want("MOVE")) {
    await page.locator("div.sa-btn[data-lens-card]:has-text('Анна Смирнова')").first().click(); await sleep(900);
    await click(page, "[data-team-move]", 600);
    await click(page, "[data-place-venue=\"Алёнка\"]", 200);
    await click(page, "[data-place-pos]:has-text('Бариста')", 200);
    await shot(page, "owner-5-move");
    await click(page, "[data-place-save]", 1000);
    const line = (await texts(page, "div[style*='C8A96E']")).find((t) => t.includes("·")) || (await page.evaluate(() => document.body.innerText.match(/Алёнка · Бариста/)?.[0] || ""));
    ok("MOVE: Анна — «Алёнка · Бариста» в карточке", /Алёнка · Бариста/.test(line || "") || (await page.locator("text=Алёнка · Бариста").count()) > 0, line);
  }

  // MENU
  if (want("MENU")) {
    await nav(page, "menuTrainer", 2200);
    const t1 = await until(async () => { const t = await page.evaluate(() => document.body.innerText); return /Алёнка/.test(t) && /Порт/.test(t) ? t : null; }, 6000);
    ok("MENU: у владельца вкладки — «Два моря, Океан», «Алёнка», «Порт»", !!t1 && !/Марико|Мясник|Камчадал/.test(t1.split("Блюд в базе")[0]), (t1 || "").slice(0, 300));
    await shot(page, "owner-6-menu");
    await nav(page, "team", 1800);
    await click(page, "[data-team-org]", 900);
    await click(page, "[data-org-hide=\"Алёнка\"]", 900);
    ok("MENU: скрыли «Алёнку» — сообщение, в «Скрытых» она есть", (await texts(page, "[data-org-msg=ok]"))[0] === "«Алёнка» скрыто. Вернуть можно в «Скрытых».", await texts(page, "[data-org-msg]"));
    await nav(page, "menuTrainer", 2000);
    const t2 = await page.evaluate(() => document.body.innerText.split("Блюд в базе")[0]);
    ok("MENU: вкладки «Алёнка» больше нет", !/Алёнка/.test(t2) && /Порт/.test(t2), t2.slice(0, 300));
  }
  ok("FORM: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── STAFF: сотрудник — только своё заведение, должность словами ────────────────────────────────────────────────
await run("STAFF", async () => {
  const { ctx, page, errs } = await open({ who: "anna" });
  await nav(page, "menuTrainer", 2400);
  const t = await page.evaluate(() => document.body.innerText.split("Блюд в базе")[0]);
  ok("STAFF: в меню у Анны — сразу меню своего заведения, без чужих вкладок", !/Марико|Мясник|Порт|Камчадал/.test(t) && (await page.locator("text=Блюд в базе").count()) > 0, t.slice(0, 300));
  await nav(page, "profile", 1800);
  ok("STAFF: «Аккаунт» — «Официант»", (await page.locator("text=Официант").count()) > 0);
  ok("STAFF: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── NOSTAGE: сервер без этапа 61 — всё как до v198 ─────────────────────────────────────────────────────────────
await run("NOSTAGE", async () => {
  const { ctx, page, errs } = await open({ no61: true });
  await nav(page, "team", 2200);
  ok("NOSTAGE: «Заведения и должности» — «нужен этап 61»", !!(await until(async () => (await texts(page, "[data-team-org]")).join("").includes("нужен этап 61"))), await texts(page, "[data-team-org]"));
  await click(page, "button:has-text('+ Добавить')", 900);
  ok("NOSTAGE: в форме прежние пять заведений и шесть должностей, «+» нет",
    JSON.stringify(await attrs(page, "[data-team-venue]", "data-team-venue")) === JSON.stringify(["Два моря, Океан", "Марико", "Мясник", "Порт", "Камчадал"])
    && (await page.locator("[data-team-pos]").count()) === 6 && !(await page.locator("[data-org-add]").count()), await attrs(page, "[data-team-venue]", "data-team-venue"));
  await click(page, "[data-lens=back]", 700);
  await click(page, "[data-team-org]", 900);
  ok("NOSTAGE: экран — подсказка про этап, править нечем", (await page.locator("[data-org-nostage]").count()) === 1 && !(await page.locator("[data-org-open]").count()));
  ok("NOSTAGE: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
