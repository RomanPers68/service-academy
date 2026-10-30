// tools/claude/demo-app/check.mjs — v99 (Доп. 412): проверка демо (сборка build.mjs) в Chromium, как его откроет владелец:
// Анна (время 11:00, «Опаздываю?», уведомление бота об упоминании, лист «Опаздываю», «Принято» от Марии, «@» и подсветка,
// черновик, поиск, календарь и страница подписки), Мария (уведомление «Дарья Л. опаздывает» с «Принято», «Сегодня» в
// «Графике»), Роман («Сервер», «Подключить бота», страница бота), новый телефон (вход через Telegram без кода).
// v106 (Доп. 419): Марии и Роману при открытии — «Утро руководителя» в Telegram; «Открыть утро» — экран «Утро», «Напомнить».
// v107 (Доп. 420): Ксения — новичок: памятка бота накануне первой смены, «Первая неделя», её карточка «Знакомьтесь» в чате;
// Мария — «Новички»; Анна — наставник Ксении.
// v108 (Доп. 421): Анна — день рождения Ильи и годовщина Веры в «Вся команда» («Поздравить»), «Спасибо коллеге» (двое
// присоединяются), «Я» → «Спасибо от коллег»; Мария — в «Сегодня» «Графика» день рождения и годовщина.
// v109 (Доп. 422): Мария — «Команда» → «Что дало обучение» (итог месяца), «Прислать этот итог в Telegram» — сообщение бота,
// его кнопка «Открыть итог» ведёт на экран.
// v110 (Доп. 423): вкладки одним видом — все группы строками в одной карточке; Мария — значки в «Утре», «Новички» (сначала
// новички, поиск в листе «Наставник»), итог с главным одной строкой; Ксения — «Первая неделя» карточкой с прогрессом.
// Запуск: node tools/claude/demo-app/check.mjs <папка демо> <папка снимков> [anna,maria,roman,ksenia,phone]
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
// v110 (Доп. 423): группы вкладок — кнопками, свёрнуты; открыть все (или одну по названию)
const openGroups = async (name = null) => { await page.evaluate((n) => document.querySelectorAll('[data-hub-toggle][aria-expanded="false"]').forEach((b) => { if (!n || b.getAttribute("data-hub-toggle") === n) b.click(); }), name); await page.waitForTimeout(500); };
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
  const fold0 = await page.evaluate(() => [...document.querySelectorAll("[data-hub-toggle]")].map((b) => b.getAttribute("data-hub-toggle") + ":" + b.getAttribute("aria-expanded")));
  ok("«Смена»: группы — кнопками «На смене» и «Потренироваться», свёрнуты", fold0.join(",") === "На смене:false,Потренироваться:false", fold0.join(","));
  await shot("a09-shift-folded");
  await openGroups("На смене");
  t = await txt();
  ok("«На смене» развернулась: «Опаздываю» и «Смены в календаре телефона»", t.includes("Опаздываю") && t.includes("Смены в календаре телефона"));
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
  // v107 (Доп. 420): Анна — наставник Ксении: «Команда» → «Новички»
  await page.locator("[data-cal-sheet] [data-sa-back]").click().catch(() => {}); await page.waitForTimeout(500);
  await page.evaluate(() => window.__saNav && window.__saNav("teamHub")); await page.waitForTimeout(1500);
  await openGroups();
  ok("Анна: «Команда» → «Новички»: «Ты наставник: Ксения М.»", /Ты наставник: Ксения М\./.test(await txt()));
  await page.getByText("Ты наставник: Ксения М.").first().click(); await page.waitForTimeout(1800);
  await page.locator('[data-nbl-item="e-ksenia"] [role=button]').first().click().catch(() => {}); await page.waitForTimeout(600);
  const nb = await page.locator('[data-nbl-open="e-ksenia"]').innerText().catch(() => "");
  ok("Анна: у Ксении «Встретить к 11:45, сегодня», темы для занятий, «Подтвердить»", /Встретить к 11:45, сегодня/.test(nb) && /Темы для занятий: конфликты/.test(nb) && /Подтвердить/.test(nb), nb.replace(/\s+/g, " ").slice(0, 160));
  await shot("a15-newbies");
  // v108 (Доп. 421): тепло в команде — в «Вся команда» день рождения Ильи и годовщина Веры, «Спасибо коллеге»,
  // «Я» → «Спасибо от коллег»
  await page.evaluate(() => window.__saNav && window.__saNav("home")); await page.waitForTimeout(1200);
  await page.locator("[data-chat-disc]").first().click(); await page.waitForTimeout(1300);
  await page.locator('[data-chat-item="team"]').first().click(); await page.waitForTimeout(1800);
  const bd = page.locator('[data-chat-card="bday"]').last(), an = page.locator('[data-chat-card="anniv"]').last();
  await bd.scrollIntoViewIfNeeded().catch(() => {});
  const bt = (await bd.innerText().catch(() => "")).replace(/\s+/g, " "), at = (await an.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("Анна: в «Вся команда» «У Ильи сегодня день рождения», Пётр и Ольга уже поздравили, «Поздравить»", /У Ильи сегодня день рождения/.test(bt) && /Поздравили: Пётр О\., Ольга Л\./.test(bt)
    && (await bd.locator("[data-chat-cheer-go]").count()) === 1, bt.slice(0, 160));
  ok("Анна: «Вера год с нами», «Поздравить»", /Вера год с нами/.test(at) && (await an.locator("[data-chat-cheer-go]").count()) === 1, at.slice(0, 160));
  await shot("a16-cheer");
  await bd.locator("[data-chat-cheer-go]").click().catch(() => {}); await page.waitForTimeout(900);
  ok("«Поздравить»: «Поздравили: Пётр О., Ольга Л., ты», кнопки нет", /Поздравили: Пётр О\., Ольга Л\., ты/.test(await bd.innerText().catch(() => "")) && !(await bd.locator("[data-chat-cheer-go]").count()));
  await tap("[data-chat-attach]");
  await tap('[data-chat-act="thx"]'); await page.waitForTimeout(800);
  ok("«+» → «Спасибо коллеге»: кому — коллеги", (await page.locator('[data-chat-thxsheet="pick"] [data-chat-person]').count()) >= 6);
  await shot("a17-thx-pick");
  await tap('[data-chat-thxsheet] [data-chat-person="e-petr"]');
  await tap('[data-chat-thx-chip="подменил"]');
  await shot("a18-thx-write");
  await tap("[data-chat-thx-go]"); await page.waitForTimeout(1200);
  const tc = page.locator('[data-chat-card="thx"]').last();
  const t1 = (await tc.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("карточка «Спасибо»: Пётр Орлов, «Подменил»", /Пётр Орлов/.test(t1) && /«Подменил»/.test(t1), t1.slice(0, 160));
  await page.waitForTimeout(5800);
  const t2 = (await tc.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("через 5 секунд присоединились: «Ещё спасибо: Вера С., Ольга Л.»", /Ещё спасибо: Вера С\., Ольга Л\./.test(t2), t2.slice(0, 160));
  await shot("a19-thx-card");
  for (let i = 0; i < 5 && await page.locator("[data-chat]").count(); i++) { await page.evaluate(() => { const b = document.querySelector('[data-chat] [data-sa-back]'); if (b) b.click(); }); await page.waitForTimeout(450); }
  await page.evaluate(() => window.__saNav && window.__saNav("me")); await page.waitForTimeout(1800);
  await openGroups();
  const pi = page.locator('.sa-card[aria-label="Спасибо от коллег"]').first();
  const ps = (await pi.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("«Я»: «Спасибо от коллег» — 3 спасибо", /3 раза за неделю коллеги сказали спасибо|Всего спасибо от коллег: 3/.test(ps), ps);
  await pi.click().catch(() => {}); await page.waitForTimeout(1800);
  const pt = (await page.locator("[data-peer-item]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("«Спасибо от коллег»: вчера Мария К., «Выручила с банкетом на веранде», ещё Пётр О. и Ольга Л.", (await page.locator('[data-peer="ok"]').count()) === 1 && /вчера · Мария К\./i.test(pt)
    && /Выручила с банкетом на веранде/.test(pt) && /Ещё спасибо: Пётр О\., Ольга Л\./.test(pt), pt.slice(0, 160));
  await shot("a20-peer");
}
if (!ONLY || ONLY.includes("maria")) {
  await page.evaluate(() => { localStorage.setItem("__demo_who", "maria"); localStorage.removeItem("__demo_me"); });
  await page.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "load" }); await boot();
  // v106 (Доп. 419): при открытии демо Марии бот уже прислал «Утро руководителя» — чат с ботом поверх приложения
  await page.waitForSelector("#demo-tgchat", { timeout: 8000 }).catch(() => {});
  const mo = await page.locator("#demo-tgchat .t").innerText().catch(() => "");
  const btns = await page.locator("#demo-tgchat .kb button").allInnerTexts().catch(() => []);
  ok("Марии: «Утро руководителя» в Telegram — смена, неделя, стоп-лист, вчера, кнопки", /^Доброе утро, Мария/.test(mo) && /Сегодня в смене \d/.test(mo) && /Стоп-лист: 2/.test(mo)
    && /Гости сказали спасибо 4 раза/.test(mo) && /Давно не занимались/.test(mo) && btns[0] === "Открыть утро", mo.replace(/\s+/g, " ").slice(0, 160) + " · " + btns.join("|"));
  await shot("m0-morning-tg");
  await page.locator('#demo-tgchat [data-demo-tgbtn="morning"]').click().catch(() => {}); await page.waitForTimeout(2200);
  const ms = await page.locator("[data-morning]").getAttribute("data-morning").catch(() => "");
  ok("«Открыть утро» — экран «Утро»: сегодня, неделя, стоп-лист, вчера и чек-листы, давно не занимались, Telegram", ms === "ready"
    && (await page.locator('[data-mo-sec="today"], [data-mo-sec="week"], [data-mo-sec="stop"], [data-mo-sec="yday"], [data-mo-sec="idle"], [data-mo-sec="tg"]').count()) === 6
    && (await page.locator('[data-mo-row="cl-close"]').count()) === 1, ms);
  await shot("m0b-morning");
  await page.locator("[data-mo-nudge]").first().click().catch(() => {}); await page.waitForTimeout(700);
  ok("«Напомнить»: отправлено", /Напомнили/.test(await page.locator("[data-mo-nudge]").first().innerText().catch(() => "")));
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
  // v108 (Доп. 421): в «Сегодня» — день рождения и годовщина (даты — «Настройки» → «Сотрудники»)
  ok("в «Сегодня»: «День рождения: Белов Илья», «Годовщина: Соколова Вера (год)»", /День рождения: Белов Илья/.test(await txt()) && /Годовщина: Соколова Вера \(год\)/.test(await txt()));
  // v107 (Доп. 420): «Команда» → «Новички»: Ксения (наставник Анна, представлена) и Тимур (наставник Илья)
  await page.evaluate(() => window.__saNav && window.__saNav("teamHub")); await page.waitForTimeout(1500);
  await openGroups();
  await page.getByText("Наставники, памятка и темы с собеседования").first().click().catch(() => {}); await page.waitForTimeout(1800);
  const ids = await page.evaluate(() => [...document.querySelectorAll("[data-nbl-item]")].map((e) => e.getAttribute("data-nbl-item")).join(","));
  const ks = await page.locator('[data-nbl-item="e-ksenia"]').innerText().catch(() => "");
  ok("Марии: «Новички» — Ксения и Тимур, у Ксении наставник Анна, представлена, поздоровались 3", ids === "e-ksenia,e-timur" && /Наставник: Анна С\./.test(ks) && /Представлена команде · поздоровались 3/.test(ks)
    && (await page.locator("[data-nbl-memo]").count()) === 1, ids + " · " + ks.replace(/\s+/g, " ").slice(0, 160));
  await shot("m5-newbies");
  // v109 (Доп. 422): «Команда» → «Что дало обучение»: итог месяца; «Прислать этот итог в Telegram» — как 1-го числа
  await page.evaluate(() => window.__saNav && window.__saNav("teamHub")); await page.waitForTimeout(1500);
  await openGroups();
  await page.getByText("Чему учились и что изменилось в зале").first().click().catch(() => {});
  await page.waitForSelector('[data-gain="ready"]', { timeout: 9000 }).catch(() => {}); await page.waitForTimeout(600);
  const secs = await page.evaluate(() => [...document.querySelectorAll("[data-gain-sec]")].map((e) => e.getAttribute("data-gain-sec")).join(","));
  const les = await page.locator('[data-gain-stat="lessons"]').innerText().catch(() => "");
  ok("Марии: «Что дало обучение» — чему учились (с «было»), что изменилось в зале, темы, кто вырос, кто не занимался, Telegram",
    secs === "learn,hall,topics,grew,idle,tg" && /было \d+/.test(les.replace(/\s+/g, " ")) && (await page.locator('[data-gain-sec="hall"] [data-gain-row]').count()) >= 3, secs + " · " + les.replace(/\s+/g, " "));
  await shot("m6-gain");
  await page.locator("[data-gain-send]").click().catch(() => {});
  await page.waitForSelector("#demo-tgchat", { timeout: 8000 }).catch(() => {});
  const gt = await page.locator("#demo-tgchat .t").innerText().catch(() => "");
  const gb = await page.locator("#demo-tgchat .kb button").allInnerTexts().catch(() => []);
  ok("«Прислать этот итог в Telegram»: сообщение бота «Что дало обучение · …», «Чему учились», «Что изменилось в зале», кнопка «Открыть итог»",
    /^Что дало обучение · [а-я]+/.test(gt) && /Чему учились/.test(gt) && /Что изменилось в зале/.test(gt) && gb[0] === "Открыть итог", gt.replace(/\s+/g, " ").slice(0, 160) + " · " + gb.join("|"));
  await shot("m7-gain-tg");
  const go = await page.locator("#demo-tgchat [data-demo-tgbtn]").first().getAttribute("data-demo-tgbtn").catch(() => "");
  await page.locator("#demo-tgchat [data-demo-tgbtn]").first().click().catch(() => {}); await page.waitForTimeout(1800);
  ok("«Открыть итог» — экран итога за этот месяц", /^gain_\d{4}-\d{2}$/.test(go || "") && (await page.locator('[data-gain="ready"]').count()) === 1
    && (await page.locator(`[data-gain-month="${String(go).slice(5)}"][aria-pressed="true"]`).count()) === 1, go);
  // v110 (Доп. 423): итог — главное одной строкой; вкладки — группы строками; «Утро» — значки по смыслу
  ok("итог: главное одной строкой и разница цифрой", /^Команда прошла \d+ урок/.test(await page.locator("[data-gain-head-learn]").innerText().catch(() => ""))
    && (await page.locator("[data-gain-delta]").count()) >= 3);
  await page.evaluate(() => window.__saNav && window.__saNav("shift")); await page.waitForTimeout(1500);
  const hub = await page.evaluate(() => ({ g: document.querySelectorAll("[data-hub-toggle]").length, b: (document.querySelector('[data-hub-group="На смене"] [data-hub-badge]') || { getAttribute: () => "" }).getAttribute("data-hub-badge") }));
  ok("«Смена» у Марии: «На смене» и «Потренироваться» кнопками, на «На смене» — счётчик чата", hub.g === 2 && /^\d+$/.test(hub.b || ""), JSON.stringify(hub));
  await openGroups("На смене");
  ok("«На смене» развернулась строками", (await page.locator('[data-hub-group="На смене"] [data-hub-compact] .sa-card').count()) >= 6);
  await shot("m8-shift-rows");
  await page.evaluate(() => window.__saNav && window.__saNav("morning")); await page.waitForTimeout(2000);
  const gl = await page.evaluate(() => [...document.querySelectorAll("[data-mo-row] [data-glyph]")].map((e) => e.getAttribute("data-glyph")));
  ok("«Утро»: у строк значки по смыслу (солнце, брифинг, стоп-лист…)", gl.includes("sun") && gl.includes("brief") && gl.includes("stop") && !gl.includes(""), gl.join(","));
  await shot("m9-morning-glyphs");
}
if (!ONLY || ONLY.includes("roman")) {
  await page.evaluate(() => { localStorage.setItem("__demo_who", "roman"); localStorage.removeItem("__demo_me"); });
  await page.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "load" }); await boot();
  // v106: Роману тоже пришло «Утро руководителя» — закрыть чат с ботом
  await page.waitForSelector("#demo-tgchat", { timeout: 8000 }).catch(() => {});
  ok("Роману: «Утро руководителя» в Telegram", /^Доброе утро, Роман/.test(await page.locator("#demo-tgchat .t").innerText().catch(() => "")));
  await page.locator("#demo-tgchat .done").click().catch(() => {}); await page.waitForTimeout(400);
  await page.evaluate(() => window.__saNav && window.__saNav("teamHub")); await page.waitForTimeout(1200);
  await openGroups("Управление");
  ok("«Команда» → «Управление»: пункт «Сервер»", /Этапы базы, бот Telegram, расписания/.test(await txt()));
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
if (!ONLY || ONLY.includes("ksenia")) {
  // v107 (Доп. 420): Ксения — новичок: вчера бот прислал памятку, сегодня первая смена, её представили команде
  await page.evaluate(() => { localStorage.setItem("__demo_who", "ksenia"); localStorage.removeItem("__demo_me"); });
  await page.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "load" }); await boot();
  await page.waitForSelector("#demo-tgchat", { timeout: 8000 }).catch(() => {});
  const ev = await page.locator("#demo-tgchat .t").innerText().catch(() => "");
  const day = await page.locator("#demo-tgchat .day").innerText().catch(() => "");
  const btns = await page.locator("#demo-tgchat .kb button").allInnerTexts().catch(() => []);
  ok("Ксении: вчера бот прислал памятку — к 11:45, как найти, форма, наставник Анна, «Первая неделя»", /^Завтра твоя первая смена/.test(ev) && /Приходи к 11:45/.test(ev) && /Как найти: Служебный вход/.test(ev)
    && /Тебя встретит Анна С\., твой наставник/.test(ev) && day === "Вчера" && btns[0] === "Первая неделя", day + " · " + ev.replace(/\s+/g, " ").slice(0, 160) + " · " + btns.join("|"));
  await shot("k1-eve-tg");
  await page.locator('#demo-tgchat [data-demo-tgbtn="newbie"]').click().catch(() => {}); await page.waitForTimeout(2400);
  const wk = await page.locator("[data-newbie]").innerText().catch(() => "");
  ok("«Первая неделя» из памятки: смена сегодня, наставник Анна, первыми темы с собеседования", (await page.locator('[data-newbie="ready"]').count()) === 1 && /Сегодня, День 12:00–20:00/.test(wk)
    && (await page.locator('[data-nb-buddy="e-anna"]').count()) === 1 && (await page.locator('[data-nb-sec="focus"]').count()) === 1, wk.replace(/\s+/g, " ").slice(0, 200));
  await shot("k2-week");
  await page.locator("[data-nb-team] [data-nb-chat]").click().catch(() => {}); await page.waitForTimeout(2000);
  const hc = await page.locator('[data-chat-card="hello"]').last().innerText().catch(() => "");
  ok("«Открыть чат»: в «Вся команда» её карточка — с ней поздоровались", /Ксения Миронова/.test(hc) && /С тобой поздоровались: .*Пётр О\./.test(hc.replace(/\s+/g, " ")), hc.replace(/\s+/g, " ").slice(0, 200));
  await page.waitForFunction(() => { const c = [...document.querySelectorAll('[data-chat-card="hello"]')].pop(); return c && /Ольга Л\./.test(c.innerText); }, null, { timeout: 15000 }).catch(() => {});
  ok("через несколько секунд здоровается Ольга", /Ольга Л\./.test(await page.locator('[data-chat-card="hello"]').last().innerText().catch(() => "")));
  await shot("k3-hello");
  for (let i = 0; i < 5 && await page.locator("[data-chat]").count(); i++) { await page.evaluate(() => { const b = document.querySelector('[data-chat] [data-sa-back]'); if (b) b.click(); }); await page.waitForTimeout(450); }
  await page.evaluate(() => window.__saNav && window.__saNav("shift")); await page.waitForTimeout(1600);
  const first = await page.evaluate(() => { const c = [...document.querySelectorAll(".sa-card.sa-pagein[aria-label]")].filter((e) => e.getClientRects().length); return c.length ? c[0].innerText.replace(/\s+/g, " ") : ""; });
  // v110 (Доп. 423): карточкой с прогрессом под сменой: «Первая неделя · сделано 1 из 12 · Первая смена: сегодня, 12:00»
  ok("«Смена»: первым — «Первая неделя» с прогрессом и первой сменой сегодня", /^Первая неделя сделано \d+ из \d+ Первая смена: сегодня, 12:00/.test(first), first);
  await shot("k4-shift");
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
