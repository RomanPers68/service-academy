// tools/claude/demo-app/check.mjs — v99 (Доп. 412): проверка демо (сборка build.mjs) в Chromium, как его откроет владелец:
// Анна (время 11:00, «Опаздываю?», уведомление бота об упоминании, лист «Опаздываю», «Принято» от Марии, «@» и подсветка,
// черновик, поиск, календарь и страница подписки), Мария (уведомление «Дарья Л. опаздывает» с «Принято», «Сегодня» в
// «Графике»), Роман («Сервер», «Подключить бота», страница бота), новый телефон (вход через Telegram без кода).
// Запуск: node tools/claude/demo-app/check.mjs <папка демо> <папка снимков> [anna,maria,roman,phone]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const ROOT = process.argv[2], OUT = process.argv[3], PORT = 5432, ONLY = process.argv[4] || "";
mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/" || p === "") p = "/index.html";
  const f = join(ROOT, p);
  try { if (!statSync(f).isFile()) throw 0; res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); }
  catch (e) { res.writeHead(404); res.end("nf"); }
}).listen(PORT);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Europe/Moscow" });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
const res = [];
const ok = (name, v, extra = "") => { const l = (v ? "✓ " : "✗ ") + name + (extra ? " · " + extra : ""); res.push(l); console.log(l); };
const shot = (n) => page.screenshot({ path: OUT + "/" + n + ".png" });
const boot = async () => { await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла")); await page.waitForTimeout(1800); };
const txt = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const tap = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(500); };

await page.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "load" });
await page.evaluate(() => { localStorage.clear(); });
await page.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "load" });
await boot();
const clock = await page.evaluate(() => { const d = new Date(); return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"); });
ok("время в демо — 11:00", /^11:0\d$/.test(clock), clock);
if (!ONLY || ONLY.includes("anna")) {
  await shot("a1-home");
  let t = await txt();
  ok("Анна: на главной «Опаздываю?»", t.includes("Опаздываю?"));
  // упоминание через 15 с — уведомление бота
  await page.waitForSelector("#demo-tg", { timeout: 20000 }).catch(() => {});
  const tg = await page.locator("#demo-tg").count() ? await page.locator("#demo-tg").innerText() : "";
  ok("уведомление: Мария упоминает Анну", /Мария К\. упоминает тебя в «Вся команда»/.test(tg), tg.replace(/\s+/g, " ").slice(0, 120));
  await shot("a2-toast");
  await page.locator("#demo-tg").click().catch(() => {});
  // «Опаздываю?» → чат с листом
  await page.getByText("Опаздываю?").first().click(); await page.waitForTimeout(1500);
  ok("лист «Опаздываю» открылся в чате", await page.locator("[data-chat-latesheet]").count() > 0);
  const sh = await page.locator("[data-chat-late-shift]").getAttribute("data-chat-late-shift").catch(() => "");
  ok("в листе смена сегодня 12:00–20:00", sh === "12:00–20:00", sh);
  await tap('[data-chat-latemin="15"]');
  await page.locator("[data-chat-latenote]").fill("пробка на мосту");
  const pv = await page.locator("[data-chat-late-preview]").innerText();
  ok("предпросмотр: буду в 12:15", pv.includes("буду в 12:15"), pv);
  await shot("a3-latesheet");
  await tap("[data-chat-latego]"); await page.waitForTimeout(1200);
  const eta = await page.locator("[data-chat-late-eta]").last().getAttribute("data-chat-late-eta").catch(() => "");
  ok("карточка «Буду в 12:15»", eta === "12:15", eta);
  ok("автор ждёт ответа", await page.locator("[data-chat-late-wait]").count() > 0);
  await page.waitForTimeout(8500);
  const okTxt = await page.locator("[data-chat-late-ok]").last().innerText().catch(() => "");
  ok("Мария ответила «Принято»", /Принято: Мария К\./.test(okTxt), okTxt);
  await shot("a4-latecard");
  // упоминание: «@Ма» → подсказка → вставка
  const inp = page.locator("textarea.ch-input");
  await inp.click(); await inp.fill(""); await inp.type("@Ма", { delay: 40 }); await page.waitForTimeout(500);
  const sug = await page.locator("[data-chat-mentions] [data-chat-mention]").allInnerTexts().catch(() => []);
  ok("подсказки по «@Ма»: Мария", sug.some((s) => /Мария/.test(s)), sug.join(" | ").replace(/\s+/g, " "));
  await shot("a5-mention-suggest");
  await page.locator('[data-chat-mention="u-maria"]').click(); await page.waitForTimeout(300);
  const v1 = await inp.inputValue();
  ok("вставлено «@Мария »", v1 === "@Мария ", JSON.stringify(v1));
  await inp.type("проверь, пожалуйста, стол 7", { delay: 10 });
  await page.keyboard.press("Enter").catch(() => {});
  await page.waitForTimeout(400);
  const sendBtn = page.locator("[data-chat-send]");
  if (await inp.inputValue()) { if (await sendBtn.count()) await sendBtn.click(); }
  await page.waitForTimeout(6500);
  const atMe = await page.locator(".ch-at.me").count();
  ok("Мария ответила с «@Анна», имя подсвечено", atMe > 0, "ch-at.me=" + atMe);
  await shot("a6-mention-reply");
  // черновик
  await inp.fill("Недописанное сообщение про банкет");
  await page.waitForTimeout(700);
  await page.locator('.ch [data-sa-back], .ch [aria-label="Назад"], .ch [aria-label="К списку чатов"]').first().click().catch(() => {});
  await page.waitForTimeout(900);
  const dr = await page.locator("[data-chat-draft]").count();
  ok("в списке чатов «Черновик:»", dr > 0);
  await shot("a7-draft");
  // поиск
  await tap("[data-chat-searchbtn]");
  await page.locator("[data-chat-q]").fill("банкет"); await page.waitForTimeout(1500);
  const nres = await page.locator("[data-chat-sr]").count();
  ok("поиск «банкет»: нашлось", nres >= 2, "n=" + nres);
  await shot("a8-search");
  console.log("SR-DBG", await page.evaluate(() => [...document.querySelectorAll("[data-chat-sr]")].map((b) => { const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return [Math.round(r.y), Math.round(r.height), el && (el.className || el.tagName), b.closest("[data-chat-results]") ? b.closest("[data-chat-results]").getAttribute("data-chat-results") : "-"]; })));
  await page.locator("[data-chat-sr]").first().click({ timeout: 4000 }).catch((e) => res.push("✗ клик по результату: " + String(e.message).split("\n")[0]));
  await page.waitForTimeout(1500);
  await shot("a9-search-jump");
  // календарь
  for (let i = 0; i < 5 && await page.locator("[data-chat]").count(); i++) { await page.evaluate(() => { const b = document.querySelector('[data-chat] [data-sa-back]'); if (b) b.click(); }); await page.waitForTimeout(450); }
  ok("чат закрыт кнопкой «Назад»", (await page.locator("[data-chat]").count()) === 0);
  await page.evaluate(() => window.__saNav && window.__saNav("shift")); await page.waitForTimeout(1500);
  t = await txt();
  ok("«Смена»: «Опаздываю» и «Смены в календаре телефона»", t.includes("Опаздываю") && t.includes("Смены в календаре телефона"));
  await shot("a10-shift");
  await page.getByText("Смены в календаре телефона").first().click(); await page.waitForTimeout(1200);
  ok("лист календаря: ближайшие смены", (await page.locator("[data-cal-next]").getAttribute("data-cal-next").catch(() => "0")) === "3");
  await shot("a11-calsheet");
  await tap("[data-cal-sub]"); await page.waitForTimeout(1200);
  ok("страница «Подписаться» поверх приложения", await page.locator("#demo-page iframe").count() > 0);
  await shot("a12-calpage");
  const fr = page.frameLocator("#demo-page iframe");
  await fr.locator("a.btn").click(); await page.waitForTimeout(600);
  ok("в демо: пояснение после «Добавить в календарь»", /В демо подписки нет/.test(await page.locator("#demo-page .note").innerText().catch(() => "")));
  await shot("a13-calpage-note");
  await page.locator("#demo-page .bar button").click(); await page.waitForTimeout(400);
  await page.locator("[data-cal-sheet] [data-sa-back]").click().catch(() => {}); await page.waitForTimeout(500);
  await page.getByText("Смены в календаре телефона").first().click(); await page.waitForTimeout(1200);
  ok("после подписки: «Подписка работает»", /Подписка работает/.test(await txt()));
  await shot("a14-cal-used");
}
if (!ONLY || ONLY.includes("maria")) {
  await page.evaluate(() => { localStorage.setItem("__demo_who", "maria"); localStorage.removeItem("__demo_me"); });
  await page.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "load" }); await boot();
  await shot("m1-home");
  await page.waitForFunction(() => { const t = document.getElementById("demo-tg"); return t && /опаздывает/.test(t.innerText); }, null, { timeout: 40000 }).catch(() => {});
  const tg = await page.locator("#demo-tg").innerText().catch(() => "");
  ok("Марии: уведомление «Дарья Л. опаздывает» с «Принято»", /Дарья Л\. опаздывает на 20 минут: будет в 12:20 \(смена с 12:00\)/.test(tg) && /Принято/.test(tg), tg.replace(/\s+/g, " ").slice(0, 160));
  await shot("m2-toast-late");
  await page.locator("#demo-tg button").click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(800);
  ok("«Принято» из уведомления", /Принято: на карточке/.test(await page.locator("#demo-tg").innerText().catch(() => "")));
  await page.evaluate(() => window.__saNav && window.__saNav("schedule")); await page.waitForTimeout(2500);
  await shot("m3-schedule");
  const marks = await page.locator("[data-today-lates]").count(); const ltxt = await page.locator("[data-today-lates]").first().innerText().catch(() => "");
  ok("в «Графике» «Сегодня»: опаздывает Дарья (принято)", marks > 0 && /Лебедева Дарья к 12:20 \(принято\)/.test(ltxt), ltxt);
  await page.locator("[data-today-lates]").first().click().catch(() => {}); await page.waitForTimeout(700); await shot("m4-today-open");
  ok("раскрыто: у Дарьи «опоздает, к 12:20»", /опоздает, к 12:20/.test(await txt()));
}
if (!ONLY || ONLY.includes("roman")) {
  await page.evaluate(() => { localStorage.setItem("__demo_who", "roman"); localStorage.removeItem("__demo_me"); });
  await page.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "load" }); await boot();
  await page.evaluate(() => window.__saNav && window.__saNav("teamHub")); await page.waitForTimeout(1200);
  ok("«Команда»: пункт «Сервер»", /Этапы базы, бот Telegram, расписания/.test(await txt()));
  await shot("r1-team");
  await page.getByText("Этапы базы, бот Telegram, расписания").first().click(); await page.waitForTimeout(1800);
  await shot("r2-server");
  const t = await txt();
  ok("«Сервер»: всё по этапам, бот без вебхука", /Все этапы на месте/.test(t) && /не подключены/.test(t), t.slice(0, 200));
  await page.locator("[data-srv-tgsetup]").click(); await page.waitForTimeout(1200);
  const pre = await page.locator("#demo-page pre").innerText().catch(() => "");
  ok("страница бота: «Готово», кнопка «Академия», команды", /^Готово/.test(pre) && /«Академия»/.test(pre) && /\/smena/.test(pre), pre.slice(0, 80).replace(/\s+/g, " "));
  await shot("r3-botpage");
  await page.locator("#demo-page .bar button").click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(4800);
  ok("после подключения: «Кнопки и ответы в чат: подключены»", /Кнопки и ответы в чат: подключены/.test(await txt()));
  await shot("r4-server-after");
}
if (!ONLY || ONLY.includes("phone")) {
  await page.evaluate(() => { localStorage.setItem("__demo_who", "anna"); localStorage.setItem("__demo_newphone", "1"); localStorage.removeItem("__demo_me"); });
  await page.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => {});
  await page.waitForSelector('[data-tg-login="try"]', { timeout: 8000 }).catch(() => {});
  ok("новый телефон: «Узнаю тебя по Telegram…»", await page.locator('[data-tg-login="try"]').count() > 0);
  await shot("p1-tglogin");
  await page.waitForTimeout(3500);
  const t = await txt();
  ok("вошла без кода: главная Анны", /Анна/.test(t) && !/Введи код доступа/.test(t), t.slice(0, 120));
  await shot("p2-in");
}
console.log("---");
console.log("errors:", JSON.stringify(errs.slice(0, 12), null, 1));
await browser.close(); server.close();
