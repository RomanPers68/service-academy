// e2e v199 (Доп. 524): у каждого заведения своя статистика, руководство сети смотрит по заведениям. Демо целиком
// (tools/claude/demo-app/build.mjs): сервер демо отвечает, как этап 62; __demo_net = "1" — в сети второе заведение «Порт»
// с двумя сданными тестами; __demo_no62 = "1" — сервер без этапа 62.
//   OWNER — владелец: «Аналитика» — лента «Вся сеть · Два моря, Океан · своё · Порт», «Охват: вся сеть», карточка
//           «Рестораны · средний результат» с обоими; нажал «Порт» в карточке — «Охват: Порт», карточки нет, в ленте
//           «Порт»; «Что дало обучение» открылось по «Порту» (выбор общий): без «1-го числа в Telegram»; своё — блок на
//           месте; «Новички» по «Порту» — без «Добавить новичка»; «Отчёты» — заведения чипами, по «Порту» только его
//           люди, «Вся сеть» — все; «Собеседование» и «График» — с лентой; в графике выбрали «Порт» — график «Порта» (пустой, без людей «Океана»);
//   STAFF — Анна (официант): в рейтинге только своё заведение (ни Игоря, ни Лены, нет «во всей сети»); в меню без вкладок;
//   MANAGER — Мария (менеджер): в аналитике и итоге месяца ленты нет, «Охват: Два моря, Океан», карточки ресторанов нет;
//   NOSTAGE — без этапа 62: у владельца «Что дало обучение» по «Порту» — «нужен этап базы 62»; у Анны в рейтинге всё
//           равно только своё заведение.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v199.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5699, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v199";
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

async function open({ who = "roman", net = true, no62 = false, dsf = 2 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, n, s]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__demo_who", w); if (n) localStorage.setItem("__demo_net", "1");
    if (s) localStorage.setItem("__demo_no62", "1"); localStorage.setItem("sa_lesson_cards", "1"); }, [who, net, no62]);
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
const body = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const lensOf = async (page) => (await attrs(page, "[data-venue-lens]", "data-venue-lens"))[0] || null;
const picks = (page) => texts(page, "[data-venue-lens] [data-venue-pick]");
const pick = async (page, v, wait = 1200) => { await page.locator('[data-venue-lens] [data-venue-pick="' + v + '"]').first().click(); await sleep(wait); };
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const run = async (key, fn) => { if (!want(key)) return; try { await fn(); } catch (e) { ok(key + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };

// ── OWNER: владелец смотрит по заведениям ──────────────────────────────────────────────────────────────────────────
await run("OWNER", async () => {
  const { ctx, page, errs } = await open({ dsf: 3 });
  await nav(page, "analytics", 2200);
  ok("OWNER: аналитика — лента «Вся сеть · Два моря, Океан · своё · Порт», выбрана «Вся сеть»",
    JSON.stringify(await picks(page)) === JSON.stringify(["Вся сеть", "Два моря, Океан · своё", "Порт"]) && (await lensOf(page)) === "*", [await picks(page), await lensOf(page)]);
  ok("OWNER: «Охват: вся сеть», карточка ресторанов — оба заведения", (await body(page)).includes("Охват: вся сеть")
    && JSON.stringify((await attrs(page, "[data-an-rest]", "data-an-rest")).sort()) === JSON.stringify(["Два моря, Океан", "Порт"]), await attrs(page, "[data-an-rest]", "data-an-rest"));
  await shot(page, "owner-1-analytics-net");
  await page.locator('[data-an-rest="Порт"]').click(); await sleep(1200);
  ok("OWNER: нажал «Порт» в карточке — «Охват: Порт», в ленте «Порт», карточки ресторанов нет",
    (await body(page)).includes("Охват: Порт") && (await lensOf(page)) === "Порт" && !(await page.locator("[data-an-rests]").count()), [await lensOf(page)]);
  await shot(page, "owner-2-analytics-port");
  await nav(page, "gain", 2400);
  ok("OWNER: «Что дало обучение» открылось по «Порту» (выбор общий), без «1-го числа в Telegram»",
    !!(await until(async () => (await lensOf(page)) === "Порт" && (await page.locator("[data-gain=ready]").count()) > 0)) && !(await page.locator('[data-gain-sec="tg"]').count()),
    [await lensOf(page), await attrs(page, "[data-gain]", "data-gain")]);
  ok("OWNER: в итоге месяца ленты нет «Вся сеть» — только заведения", JSON.stringify(await picks(page)) === JSON.stringify(["Два моря, Океан · своё", "Порт"]), await picks(page));
  await shot(page, "owner-3-gain-port");
  await pick(page, "Два моря, Океан", 2000);
  ok("OWNER: своё заведение — блок «1-го числа в Telegram» на месте", !!(await until(async () => (await page.locator('[data-gain-sec="tg"]').count()) > 0)) && (await lensOf(page)) === "Два моря, Океан");
  await pick(page, "Порт", 1600);
  await nav(page, "newbies", 2200);
  ok("OWNER: «Новички» по «Порту» — только посмотреть: без «Добавить новичка» и «Изменить» памятки",
    !!(await until(async () => (await lensOf(page)) === "Порт" && (await page.locator("[data-newbies=ready]").count()) > 0))
    && !(await page.locator("[data-nbl-add]").count()) && !(await page.locator("[data-nbl-memo-edit]").count()), await attrs(page, "[data-newbies]", "data-newbies"));
  await pick(page, "Два моря, Океан", 1800);
  ok("OWNER: свои новички — «Добавить новичка» есть", !!(await until(async () => (await page.locator("[data-nbl-add]").count()) > 0)));
  // отчётов в сервере демо нет: список сотрудников сети подставляем в странице (как report_people у сети)
  await page.evaluate(() => { const f0 = window.fetch; const now = new Date().toISOString();
    const row = (id, name, surname, restaurant) => ({ id, name, surname, restaurant, position: "waiter", last_role: "seasonal", seen: now, lessons: 3, quiz: 1 });
    window.fetch = async (u, init) => (String(u).includes("/rpc/report_people")
      ? new Response(JSON.stringify({ ok: true, scope: "all", restaurant: "Два моря, Океан", rows: [row("e-anna", "Анна", "Смирнова", "Два моря, Океан"),
          row("e-petr", "Пётр", "Орлов", "Два моря, Океан"), row("p-igor", "Игорь", "Портов", "Порт")] }), { status: 200, headers: { "Content-Type": "application/json" } })
      : f0(u, init)); });
  await nav(page, "report", 2200);
  const rpRows = () => texts(page, ".rp .rp-row .rp-rn b");
  ok("OWNER: «Отчёты по сотрудникам» — заведения чипами «Вся сеть», «Два моря, Океан», «Порт»; открыто своё (выбор общий)",
    JSON.stringify(await attrs(page, "[data-rp-venue]", "data-rp-venue")) === JSON.stringify(["*", "Два моря, Океан", "Порт"])
    && JSON.stringify(await rpRows()) === JSON.stringify(["Анна Смирнова", "Пётр Орлов"]), [await attrs(page, "[data-rp-venue]", "data-rp-venue"), await rpRows()]);
  await page.locator('[data-rp-venue="Порт"]').click(); await sleep(700);
  ok("OWNER: отчёты по «Порту» — только Игорь, заголовок «Порт»", JSON.stringify(await rpRows()) === JSON.stringify(["Игорь Портов"])
    && (await texts(page, ".rp .rp-h"))[0] === "Порт", [await rpRows(), await texts(page, ".rp .rp-h")]);
  await page.locator('[data-rp-venue="*"]').click(); await sleep(700);
  ok("OWNER: «Вся сеть» — все трое", (await rpRows()).length === 3, await rpRows());
  await shot(page, "owner-4-report");
  await nav(page, "candidate", 2000);
  ok("OWNER: «Собеседование» — с лентой заведений", JSON.stringify(await picks(page)) === JSON.stringify(["Два моря, Океан · своё", "Порт"]), await picks(page));
  await shot(page, "owner-5-candidate");
  await nav(page, "schedule", 2600);
  ok("OWNER: «График» — лента под месяцем, своё заведение", (await lensOf(page)) === "Два моря, Океан", await lensOf(page));
  await pick(page, "Порт", 2400);
  ok("OWNER: выбрали «Порт» — график «Порта»: в нём нет людей «Океана» (Дарьи Лебедевой)",
    (await lensOf(page)) === "Порт" && !(await body(page)).includes("Загружаю график") && !(await body(page)).includes("Лебедева"), [await lensOf(page), (await body(page)).slice(0, 300)]);
  await shot(page, "owner-6-schedule-port");
  ok("OWNER: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── STAFF: официант видит только своё заведение ───────────────────────────────────────────────────────────────────
await run("STAFF", async () => {
  const { ctx, page, errs } = await open({ who: "anna" });
  await nav(page, "leaderboard", 2400);
  const t = await body(page);
  ok("STAFF: рейтинг у Анны — только своё заведение: ни Игоря, ни Лены из «Порта», нет «во всей сети»",
    t.includes("Анна") && !/Игорь|Лена М|Портов|Морская/.test(t) && !t.includes("во всей сети"), t.slice(0, 300));
  ok("STAFF: ленты заведений нет", !(await page.locator("[data-venue-lens]").count()));
  await shot(page, "staff-1-leaderboard");
  await nav(page, "menuTrainer", 2400);
  const m = await page.evaluate(() => document.body.innerText.split("Блюд в базе")[0]);
  ok("STAFF: меню — сразу своё заведение, вкладки «Порт» нет", !m.includes("Порт"), m.slice(0, 200));
  ok("STAFF: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── MANAGER: менеджер — только своё заведение ──────────────────────────────────────────────────────────────────────
await run("MANAGER", async () => {
  const { ctx, page, errs } = await open({ who: "maria" });
  await nav(page, "analytics", 2200);
  ok("MANAGER: аналитика без ленты, «Охват: Два моря, Океан», карточки ресторанов нет",
    !(await page.locator("[data-venue-lens]").count()) && (await body(page)).includes("Охват: Два моря, Океан") && !(await page.locator("[data-an-rests]").count()));
  await shot(page, "manager-1-analytics");
  await nav(page, "gain", 2200);
  ok("MANAGER: итог месяца — своё заведение, без ленты, блок Telegram на месте",
    !!(await until(async () => (await page.locator("[data-gain=ready]").count()) > 0)) && !(await page.locator("[data-venue-lens]").count()) && (await page.locator('[data-gain-sec="tg"]').count()) > 0);
  await nav(page, "menuTrainer", 2400);
  const m = await page.evaluate(() => document.body.innerText.split("Блюд в базе")[0]);
  ok("MANAGER: меню — только своё заведение", !m.includes("Порт"), m.slice(0, 200));
  ok("MANAGER: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── NOSTAGE: сервер без этапа 62 ───────────────────────────────────────────────────────────────────────────────────
await run("NOSTAGE", async () => {
  const { ctx, page, errs } = await open({ no62: true });
  await nav(page, "gain", 2200);
  await pick(page, "Порт", 2000);
  ok("NOSTAGE: «Что дало обучение» по «Порту» — подсказка владельцу: нужен этап базы 62",
    !!(await until(async () => (await texts(page, "[data-lens-note]")).join("").includes("нужен этап базы 62"))), await texts(page, "[data-lens-note]"));
  await shot(page, "nostage-1-gain");
  await ctx.close();
  const a = await open({ who: "anna", no62: true });
  await nav(a.page, "leaderboard", 2400);
  const t = await body(a.page);
  ok("NOSTAGE: у Анны в рейтинге всё равно только своё заведение (сервер прислал всю сеть)", t.includes("Анна") && !/Игорь|Портов|Морская/.test(t), t.slice(0, 300));
  ok("NOSTAGE: без ошибок страницы", errs.length === 0 && a.errs.length === 0, [...errs, ...a.errs]);
  await a.ctx.close();
});

await browser.close();
server.close();
console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
process.exit(fail ? 1 : 0);
