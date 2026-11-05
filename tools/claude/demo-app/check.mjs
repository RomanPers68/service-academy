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
// v111 (Доп. 424): «Утро» у Марии в виде «Линза» — кружки строк и «Собрать брифинг» с кольцом линзы.
// v121 (Доп. 434): Мария — AI-интервью в демо (вопросы без нейросети), поле, микрофон и волна по одной линии.
// v122 (Доп. 435): Мария — винная карта с фото бутылок, «Импорт» → «Фото бутылок» (этикетки и фото без сервера).
// v128 (Доп. 441): Мария — «Барная карта»: проверка, «Подобрать гостю», шапка не уезжает, «Колода» и «Лаборатория» рядом,
// карточка коктейля здесь же, «следующее ›», поиск сверху находит вино, после «Сохранить» — снова карточка.
// v129 (Доп. 442): Мария — подсказка первого входа в «Барную карту», строка «Учить», «Показаны: …», «Нашлось во вкладке».
// v131 (Доп. 444): Мария — «Сомелье»: к блюду и бокалом, ответ с «почему» и фразой гостю, карточка и «назад» к подбору.
// v132 (Доп. 445): Мария — «Сомелье» умнее: ответ в режиме сервера, «Гость взял», «На стол», итог и вкус по шкалам через ИИ.
// v136 (Доп. 449): Мария — «Барная карта» удобнее и красивее: «Цена» и «Кратко», «★ Советуем», нарисованные бутылки, карточка
// вина («Сегодня нет. Предложи вместо», «Как сказать», «Похожие»), коктейли («стир · рокс · Hendrick's», «Как готовить» свёрнуто).
// v137 (Доп. 450): Мария — уведомления на телефон (разрешение, пробное, «Только телефон», упоминание, касание — чат); Роман —
// «Сервер» → «Уведомления на телефон».
// Запуск: node tools/claude/demo-app/check.mjs <папка демо> <папка снимков> [anna,maria,roman,ksenia,phone]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const sharp = require("/home/claude/.npm-global/lib/node_modules/sharp");   // v122: снимки «бутылок» для импорта
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
// v127 (Доп. 440): вина и крепкое — вкладки «Барной карты» (открывается та, где был в прошлый раз)
const toBar = async (tab, ms = 1500) => { await page.evaluate(() => window.__saNav && window.__saNav("reference")); await page.waitForTimeout(300);   // заново: карточка и тренировка закрыты
  await page.evaluate(() => window.__saNav && window.__saNav("wines")); await page.waitForTimeout(ms);
  await page.locator(`[data-bar-tab="${tab}"]`).click().catch(() => {}); await page.waitForTimeout(600); };

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
  // v137 (Доп. 451): просто текст боту после сообщения о переписке — в эту переписку; «Ушло в «Вся команда».», «Отменить»
  await page.locator("[data-demo-tg-reply]").click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator("[data-demo-tg-input]").fill("Возьму, буду к 18:00").catch(() => {});
  await page.locator("[data-demo-tg-send]").click().catch(() => {}); await page.waitForTimeout(400);
  const tq = (await page.locator("#demo-tg").innerText().catch(() => "")).replace(/\s+/g, " ");
  const sent = await page.evaluate(() => { const D = window.__demo, id = Number(document.getElementById("demo-tg").getAttribute("data-demo-tg-sent")), m = D.srv.msgOf(id), q = m && m.reply ? D.srv.msgOf(m.reply) : null;
    return m ? { body: m.body, emp: m.emp, chat: m.chat, quote: q ? q.emp : null } : null; }).catch(() => null);
  ok("Telegram: ответил боту просто текстом — ушло в «Вся команда» ответом на Марию; бот: «Ушло…», «Отменить», «Открыть чат»",
    /Ушло в «Вся команда»\. Отменить Открыть чат/.test(tq) && sent && sent.body === "Возьму, буду к 18:00" && sent.emp === "e-anna" && sent.quote === "u-maria", tq + " " + JSON.stringify(sent));
  await shot("a2b-tg-quick");
  await page.locator("[data-demo-tg-undo]").click().catch(() => {}); await page.waitForTimeout(300);
  ok("«Отменить»: «Отменено: в чат не ушло.», сообщения в чате нет", /Отменено: в чат не ушло\./.test(await page.locator("#demo-tg").innerText().catch(() => ""))
    && await page.evaluate(() => { const D = window.__demo, id = Number(document.getElementById("demo-tg").getAttribute("data-demo-tg-sent")); return !!D.srv.msgOf(id).del; }).catch(() => false));
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
  // v136: в стопе два блюда и «Совиньон блан» (в его карточке «Предложи вместо»)
  ok("Марии: «Утро руководителя» в Telegram — смена, неделя, стоп-лист, вчера, кнопки", /^Доброе утро, Мария/.test(mo) && /Сегодня в смене \d/.test(mo) && /Стоп-лист: 3/.test(mo)
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
  await page.locator("#demo-tg .a button").first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(800);
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
  // v111 (Доп. 424): в виде «Линза» (по умолчанию) кружки строк — линзы с кольцом, «Собрать брифинг» — плашка с кольцом
  const lz = await page.evaluate(() => { const g = document.querySelector("[data-mo-row] [data-glyph]"), b = document.querySelector("[data-mo-brief]");
    const ring = (e) => (e ? getComputedStyle(e, "::after").content : "none");
    return { lens: document.documentElement.classList.contains("sa-lens"), g: ring(g), b: b ? ring(b) : "нет" }; });
  ok("«Утро» в виде «Линза»: кружки строк и «Собрать брифинг» — с кольцом линзы", lz.lens && lz.g === '""' && lz.b !== "none", JSON.stringify(lz));
  await shot("m9-morning-glyphs");
  // v121 (Доп. 434): AI-интервью в демо — вопросы без нейросети (boot.js, demoHr); поле, микрофон и волна по одной линии
  // (владелец: «В AI HR увидел неровность. Ответ голосом съехал вниз»)
  await page.evaluate(() => window.__saNav && window.__saNav("candidate")); await page.waitForTimeout(1500);
  const bt = (t) => page.locator("button", { hasText: t }).first();
  await bt("Начать собеседование").click().catch(() => {}); await page.waitForTimeout(450);
  await page.locator('input[placeholder="Имя кандидата"]').fill("Сергей").catch(() => {}); await page.waitForTimeout(120);
  await bt("Дальше: анкета опыта").click().catch(() => {}); await page.waitForTimeout(450);
  await page.locator(".sa-btn", { hasText: "До года" }).first().click().catch(() => {}); await page.waitForTimeout(150);
  await bt(/^Дальше$/).click().catch(() => {}); await page.waitForTimeout(450);
  await bt(/^AI-интервью/).click().catch(() => {});
  await page.waitForFunction(() => /Здравствуйте!/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  const hr = await page.evaluate(() => { const row = document.querySelector("[data-hr-inrow]"); if (!row) return null;
    const cy = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return Math.round(((r.top + r.bottom) / 2) * 10) / 10; };
    return { ta: cy(row.querySelector("textarea")), mic: cy(row.querySelector('button[aria-label="Сказать голосом"]')), talk: cy(row.querySelector("[data-talk-open]")), step: (document.querySelector("[data-hr-step]") || {}).textContent || "" }; });
  ok("AI-интервью в демо: первый вопрос, «Тема 1 из 5»; поле, микрофон и волна по одной линии", !!hr && /1 из 5/.test(hr.step) && hr.talk != null && Math.abs(hr.mic - hr.ta) <= 0.6 && Math.abs(hr.talk - hr.ta) <= 0.6, JSON.stringify(hr));
  await shot("m10-ai-interview");
  // v122 (Доп. 435): винная карта с фото бутылок; «Импорт» → «Фото бутылок» — этикетки «читаются» без нейросети, фото
  // остаётся в записи (хранилища в демо нет): Гави — новым вином, у «Шабли» появляется фото
  // v129 (Доп. 442): первый вход в «Барную карту» — подсказка в три шага (в демо она не отмечена прочитанной); пока она на
  // экране, касание мимо её закрывает — вкладку выбираем после неё
  await page.evaluate(() => window.__saNav && window.__saNav("reference")); await page.waitForTimeout(300);
  await page.evaluate(() => window.__saNav && window.__saNav("wines"));
  await page.waitForSelector(".sa-hintin", { timeout: 6000 }).catch(() => {});
  const hn = [];
  for (let i = 0; i < 3; i++) {
    hn.push(await page.evaluate(() => { const h = [...document.querySelectorAll(".sa-hintin")].pop(); return h ? h.innerText.replace(/\s+/g, " ").trim() : ""; }));
    if (i === 0) await shot("m11a-bar-hint");
    await page.evaluate(() => { const h = [...document.querySelectorAll(".sa-hintin")].pop(); const b = h && [...h.querySelectorAll('[data-lens-btn="main"]')].pop(); if (b) b.click(); }); await page.waitForTimeout(800);
  }
  ok("«Барная карта»: первый вход — подсказка в три шага (вкладки, строка и карточка, «Учить»)", /Три вкладки/.test(hn[0]) && /Коснись строки/.test(hn[1]) && /Учить можно прямо отсюда/.test(hn[2]) && !(await page.locator(".sa-hintin").count()), JSON.stringify(hn));
  await page.locator('[data-bar-tab="wine"]').click().catch(() => {}); await page.waitForTimeout(600);
  const th = await page.evaluate(() => [...document.querySelectorAll("[data-wine-row] [data-wine-thumb]")].map((t) => t.getAttribute("data-wine-thumb")));
  ok("Винная карта в демо: у всех строк миниатюры, у пяти вин — фото бутылки", th.length === 8 && th.filter((x) => x === "photo").length === 5, JSON.stringify(th));
  await shot("m11-wines-photos");
  await page.locator("[data-wine-edit]").click().catch(() => {}); await page.waitForTimeout(1500);
  await page.locator("[data-wine-import-open]").click().catch(() => {}); await page.waitForTimeout(400);
  const shotJpg = await sharp({ create: { width: 480, height: 640, channels: 3, background: { r: 60, g: 44, b: 24 } } }).jpeg().toBuffer();
  await page.setInputFiles("[data-wine-bottles-input]", [{ name: "b1.jpg", mimeType: "image/jpeg", buffer: shotJpg }, { name: "b2.jpg", mimeType: "image/jpeg", buffer: shotJpg }]).catch(() => {});
  await page.waitForSelector('[data-wine-import="review"]', { timeout: 12000 }).catch(() => {});
  const plans = await page.evaluate(() => [...document.querySelectorAll("[data-wine-bottle-row]")].map((r) => r.getAttribute("data-wine-plan")).join(","));
  ok("«Фото бутылок» в демо: Гави — новое вино, «Шабли» — фото к вину из карты", plans === "new,attach", plans);
  await shot("m12-bottles-review");
  await page.locator("[data-wine-add]").click().catch(() => {});
  await page.waitForFunction(() => !document.querySelector("[data-wine-import]"), null, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => [...document.querySelectorAll("[data-wine-erow] [data-wine-thumb]")].map((t) => t.getAttribute("data-wine-thumb")));
  ok("После «Сохранить 2 вина»: девять вин, у семи — фото", after.length === 9 && after.filter((x) => x === "photo").length === 7, JSON.stringify(after));
  await shot("m13-bottles-saved");
  // v123 (Доп. 436): тренировка по винам (владелец: «их учить очень сложно, особенно для новичка»): «Учить вина» над
  // картой, новые вина, путь новичка, колода, викторина; не проверенное — «Проверка подряд»
  await toBar("wine", 1800);
  // v129: «Учить» — строкой: новые вина первыми и подсвечены, «Ещё» — тренировка целиком
  const en = await page.evaluate(() => { const e = document.querySelector("[data-wine-train-open]"), n = document.querySelector('[data-bar-learn="new"]'); return e ? { hi: e.getAttribute("data-wine-train-open"), row: (document.querySelector("[data-bar-learn-row]") || { getAttribute: () => "" }).getAttribute("data-bar-learn-row"), t: n ? n.innerText.replace(/\s+/g, " ") : "" } : null; });
  ok("Винная карта: «Учить» над картой, два новых вина первыми и подсвечены", !!en && en.hi === "new" && /^new,/.test(en.row) && /Новые вина 2 вина за месяц/.test(en.t), JSON.stringify(en));
  await page.locator("[data-wine-train-open]").click().catch(() => {}); await page.waitForTimeout(800);
  const hubRows = await page.evaluate(() => [...document.querySelectorAll("[data-wine-train]")].map((e) => e.getAttribute("data-wine-train")).join(","));
  ok("Тренировка: новые вина, «С чего начать: вина бокалом», колода, викторина, «Вино к блюду», «Опиши за 60 секунд», «Как произносить», «Кто выучил новые вина»; «Проверить подряд»", hubRows === "new,glass,deck,quiz,pair,say60,pron,team" && (await page.locator("[data-wine-review-open]").count()) === 1, hubRows);
  await shot("m14-wine-train");
  await page.locator('[data-wine-train="deck"]').click().catch(() => {}); await page.waitForTimeout(900);
  await page.locator("[data-wine-deck-card]").click().catch(() => {}); await page.waitForTimeout(1200);
  const flip = await page.evaluate(() => (document.querySelector("[data-wine-flip]") || { getAttribute: () => "" }).getAttribute("data-wine-flip"));
  ok("Колода вин: карточка переворачивается", flip === "back", flip);
  await shot("m15-wine-deck");
  await page.locator('[data-lens="back"]').first().click().catch(() => {}); await page.waitForTimeout(700);
  await page.locator('[data-wine-train="quiz"]').click().catch(() => {}); await page.waitForTimeout(900);
  await page.locator('[data-wine-opt="0"]').click().catch(() => {}); await page.waitForTimeout(400);
  const qz = await page.evaluate(() => ({ ok: document.querySelectorAll('[data-lens-opt="ok"]').length, why: !!document.querySelector("[data-wine-why]") }));
  ok("Викторина по винам: после ответа — верный вариант и пояснение", qz.ok === 1 && qz.why, JSON.stringify(qz));
  await shot("m16-wine-quiz");
  await page.locator('[data-lens="back"]').first().click().catch(() => {}); await page.waitForTimeout(700);
  await page.locator("[data-wine-review-open]").click().catch(() => {}); await page.waitForTimeout(1800);
  const rv = await page.evaluate(() => ({ at: (document.querySelector("[data-wine-review-screen]") || { getAttribute: () => "" }).getAttribute("data-wine-review-screen"), ai: document.querySelectorAll('[data-wine-rrow-ai="1"]').length }));
  ok("«Проверить подряд»: вино на экран, что дописал AI, подсвечено", /^0\/\d+$/.test(rv.at) && rv.ai > 0, JSON.stringify(rv));
  await shot("m17-wine-review");
  // v124 (Доп. 437), владелец: «как мы сам редактор можем сделать более удобнее и красивее?» — сводка и «Что дописать»,
  // форма по разделам с подсказками; в тренировке «Вино к блюду» и «Опиши за 60 секунд»
  await toBar("wine", 1500);
  await page.locator("[data-wine-edit]").click().catch(() => {}); await page.waitForTimeout(1500);
  const sm = await page.evaluate(() => ({ line: (document.querySelector("[data-wine-sum-line]") || {}).textContent || "", gaps: [...document.querySelectorAll("[data-wine-gap]")].map((e) => e.getAttribute("data-wine-gap")).join(",") }));
  ok("Редактор вин: сводка сверху и «Что дописать» (без фото, без блюд…)", /^\d+ вин/.test(sm.line) && /nophoto/.test(sm.gaps), JSON.stringify(sm));
  await shot("m18-wine-editor-summary");
  await page.locator("[data-wine-new]").click().catch(() => {}); await page.waitForTimeout(600);
  const parts = await page.evaluate(() => [...document.querySelectorAll("[data-wine-part]")].map((e) => e.getAttribute("data-wine-part")).join(","));
  ok("Новое вино: форма по разделам, подсказки страны из карты", parts === "origin,serve,guest,pair" && (await page.locator('[data-wine-hints="country"] [data-wine-hint]').count()) >= 4, parts);
  await shot("m19-wine-form-parts");
  await toBar("wine", 1500);
  await page.locator("[data-wine-train-open]").click().catch(() => {}); await page.waitForTimeout(800);
  await page.locator('[data-wine-train="pair"]').click().catch(() => {}); await page.waitForTimeout(900);
  await page.locator('[data-wine-popt="0"]').click().catch(() => {}); await page.waitForTimeout(300);
  const pq = await page.evaluate(() => ({ ok: document.querySelectorAll('[data-lens-opt="ok"]').length, why: ((document.querySelector("[data-wine-pwhy]") || {}).textContent || "").slice(0, 60) }));
  ok("«Вино к блюду»: после ответа — верное вино и «К нему в карте…»", pq.ok === 1 && /^К нему в карте: /.test(pq.why), JSON.stringify(pq));
  await shot("m20-wine-pair");
  await page.locator('[data-lens="back"]').first().click().catch(() => {}); await page.waitForTimeout(700);
  await page.locator('[data-wine-train="say60"]').click().catch(() => {}); await page.waitForTimeout(800);
  await page.locator("[data-wine-say60-go]").click().catch(() => {}); await page.waitForTimeout(400);
  await page.locator("[data-wine-say60-stop]").click().catch(() => {}); await page.waitForTimeout(400);
  const sp = await page.evaluate(() => Number((document.querySelector("[data-wine-say60-points]") || { getAttribute: () => "0" }).getAttribute("data-wine-say60-points")));
  ok("«Опиши за 60 секунд»: после минуты — сверка с карточкой", sp >= 3, String(sp));
  await shot("m21-wine-say60");
  // v125 (Доп. 438): «Кто выучил новые вина» — команда по этапу 44 (в демо — сервер в памяти)
  await page.locator('[data-lens="back"]').first().click().catch(() => {}); await page.waitForTimeout(700);
  await page.locator('[data-wine-train="team"]').click().catch(() => {}); await page.waitForTimeout(1200);
  const tm = await page.evaluate(() => ({ n: document.querySelectorAll("[data-wine-team-row]").length, states: [...document.querySelectorAll("[data-wine-team-row]")].map((e) => e.getAttribute("data-wine-team-row") + ":" + e.getAttribute("data-wine-team-state")).join(","),
    line: (document.querySelector("[data-wine-team-line]") || {}).textContent || "" }));
  ok("«Кто выучил новые вина»: Анна выучила, Вера и Илья учат, Пётр не открывал, остальные не занимались", /^e-anna:passed,/.test(tm.states) && /e-vera:opened/.test(tm.states) && /e-ilya:opened/.test(tm.states) && /e-petr:notnew/.test(tm.states) && /выучили 1 из \d+ · учат 2 · не открывали 1 · не занимались \d+/.test(tm.line), JSON.stringify(tm));
  await shot("m22-wine-team");
  // v127 (Доп. 440): «Барная карта» — коктейли, вина и крепкое под одной кнопкой; у крепкого всё, как у вин
  await page.evaluate(() => window.__saNav && window.__saNav("reference")); await page.waitForTimeout(1500);
  const bc = await page.evaluate(() => { const e = document.querySelector('[data-ref-card="barcard"]'); return e ? e.innerText.replace(/\s+/g, " ") : ""; });
  ok("Справочник: «Барная карта» вместо «Нашей винной карты» и «Бар: коктейли»", /^Барная карта Коктейли \d+ · вина 9 · крепкое 11/.test(bc) && !(await page.locator('[data-ref-card="winelist"], [data-ref-card="cocktails"]').count()), bc);
  await page.locator('[data-ref-card="barcard"]').click().catch(() => {}); await page.waitForTimeout(1500);
  await page.locator('[data-bar-tab="cocktail"]').click().catch(() => {}); await page.waitForTimeout(600);
  const ck = await page.evaluate(() => ({ tabs: (document.querySelector("[data-bar-tabs]") || { getAttribute: () => "" }).getAttribute("data-bar-tabs"),
    groups: [...document.querySelectorAll("[data-bar-ck-group]")].map((e) => e.getAttribute("data-bar-ck-group")).join(","),
    neg: ((document.querySelector('[data-bar-ck="negroni"] [data-bar-ck-spirits]') || {}).textContent || "") }));
  ok("Коктейли нашего бара по основе; у «Негрони» — что из нашей карты в нём", ck.tabs === "cocktail,wine,spirit" && /^Джин,Водка,Ром/.test(ck.groups) && /Hendrick's/.test(ck.neg) && /Campari/.test(ck.neg), JSON.stringify(ck));
  await shot("m23-bar-cocktails");
  await page.locator('[data-bar-tab="spirit"]').click().catch(() => {}); await page.waitForTimeout(900);
  const sl = await page.evaluate(() => ({ kind: (document.querySelector("[data-drink-kind]") || { getAttribute: () => "" }).getAttribute("data-drink-kind"), rows: document.querySelectorAll("[data-wine-row]").length,
    hi: (document.querySelector("[data-wine-train-open]") || { getAttribute: () => "" }).getAttribute("data-wine-train-open"), t: ((document.querySelector('[data-bar-learn="new"]') || {}).textContent || "").replace(/\s+/g, " ") }));
  ok("Крепкое: одиннадцать позиций по видам (v134: и «Аберфелди 12»), в «Учить» — две новинки первыми", sl.kind === "spirit" && sl.rows === 11 && sl.hi === "new" && /Новинки ?2 позиции за месяц/.test(sl.t), JSON.stringify(sl));
  await shot("m24-bar-spirits");
  await page.locator('[data-wine-row="sp-demo-3"]').click().catch(() => {}); await page.waitForTimeout(900);
  const card = await page.evaluate(() => ({ price: ((document.querySelector("[data-wine-card]") || {}).textContent || "").replace(/\u00a0/g, " ").includes("40 мл 550"), ck: [...document.querySelectorAll("[data-spirit-cocktail]")].map((e) => e.textContent.trim()).join(",") }));
  ok("Карточка «Maker's Mark»: цена порции и «В коктейлях нашего бара» (на бурбоне)", card.price && /Олд фэшн/.test(card.ck) && !/Манхэттен/.test(card.ck), JSON.stringify(card));
  await shot("m25-spirit-card");
  await toBar("spirit", 1500);
  await page.locator("[data-wine-train-open]").click().catch(() => {}); await page.waitForTimeout(800);
  const sh = await page.evaluate(() => [...document.querySelectorAll("[data-wine-train]")].map((e) => e.getAttribute("data-wine-train")).join(","));
  ok("Учить крепкое: новинки, «С чего начать: ходовое», колода, викторина, «Крепкое к блюду», «Опиши за 60 секунд», «Как произносить», «Кто выучил»", sh === "new,glass,deck,quiz,pair,say60,pron,team", sh);   // путь новичка — тот же пункт, что у вин
  await shot("m26-spirit-train");
  await page.locator('[data-wine-train="quiz"]').click().catch(() => {}); await page.waitForTimeout(900);
  await page.locator('[data-wine-opt="0"]').click().catch(() => {}); await page.waitForTimeout(400);
  const sq = await page.evaluate(() => ({ ok: document.querySelectorAll('[data-lens-opt="ok"]').length, why: !!document.querySelector("[data-wine-why]") }));
  ok("Викторина по крепкому: после ответа — верный вариант и пояснение", sq.ok === 1 && sq.why, JSON.stringify(sq));
  await page.locator('[data-lens="back"]').first().click().catch(() => {}); await page.waitForTimeout(700);
  await page.locator('[data-wine-train="team"]').click().catch(() => {}); await page.waitForTimeout(1200);
  const st = await page.evaluate(() => [...document.querySelectorAll("[data-wine-team-row]")].map((e) => e.getAttribute("data-wine-team-row") + ":" + e.getAttribute("data-wine-team-state")).join(","));
  ok("«Кто выучил новинки крепкого»: Илья выучил, Анна учит, Вера не открывала новинки", /^e-ilya:passed,/.test(st) && /e-anna:opened/.test(st) && /e-vera:notnew/.test(st), st);
  await shot("m27-spirit-team");
  await toBar("spirit", 1500);
  await page.locator("[data-wine-edit]").click().catch(() => {}); await page.waitForTimeout(1500);
  const se = await page.evaluate(() => ({ line: (document.querySelector("[data-wine-sum-line]") || {}).textContent || "", rev: !!document.querySelector("[data-wine-review-start]") }));
  ok("Редактор крепкого: «11 позиций», две ждут «Проверки подряд»", /^11 позиций/.test(se.line) && se.rev, JSON.stringify(se));
  await page.locator("[data-wine-new]").click().catch(() => {}); await page.waitForTimeout(600);
  const sf = await page.evaluate(() => ({ parts: [...document.querySelectorAll("[data-wine-part]")].map((e) => e.getAttribute("data-wine-part")).join(","), cats: document.querySelectorAll("[data-wine-cat]").length,
    portions: [...document.querySelectorAll("[data-wine-portion]")].map((e) => e.getAttribute("data-wine-portion")).join(",") }));
  ok("Новая позиция: вид чипами, порция 25, 40, 50 мл или своя", sf.parts === "origin,serve,guest,pair" && sf.cats === 9 && sf.portions === "25,40,50", JSON.stringify(sf));
  await page.locator('[data-wine-part="serve"]').click().catch(() => {}); await page.waitForTimeout(400);
  await shot("m28-spirit-form");
  // v128 (Доп. 441): «Барная карта» удобнее, проще, красивее
  await toBar("wine", 1500);
  const v8 = await page.evaluate(() => ({ banner: ((document.querySelector("[data-wine-check-banner]") || {}).textContent || ""),
    orig: ((document.querySelector('[data-wine-row="wn-demo-4"] [data-wine-orig]') || {}).textContent || ""), sec: [...document.querySelectorAll("[data-wine-sec-ok]")].map((e) => e.getAttribute("data-wine-sec-ok")) }));
  ok("Винная карта: руководителю — сколько ждёт проверки; «Русское / Original» — в две строки", /^\d+ вин[оа]? (ждут|ждёт) проверки/.test(v8.banner) && v8.orig === "Riesling Kabinett" && v8.sec.length > 0, JSON.stringify(v8));
  await shot("m29-wines-check");
  await page.locator("[data-wine-sec-ok]").first().click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator("[data-wine-sec-ok]").first().click().catch(() => {}); await page.waitForTimeout(1200);
  const cm = await page.evaluate(() => (document.querySelector("[data-wine-check-msg]") || {}).textContent || "");
  ok("«Верно для раздела»: второе касание — раздел проверен", /^Проверено: \d+ вин/.test(cm), cm);
  await page.locator("[data-wine-pick-open]").click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator('[data-wine-budget="1"]').click().catch(() => {}); await page.waitForTimeout(300);
  const pk = await page.evaluate(() => ({ n: (document.querySelector("[data-wine-pick-n]") || {}).textContent || "", b: document.querySelectorAll("[data-wine-budget]").length }));
  ok("«Подобрать гостю»: бюджет тремя ступенями по ценам карты, «Нашлось: …»", pk.b === 3 && /^Нашлось: \d+ вин/.test(pk.n), JSON.stringify(pk));
  await shot("m30-wines-pick");
  await page.locator("[data-wine-pick-reset]").click().catch(() => {}); await page.waitForTimeout(200);
  await page.evaluate(() => { const r = document.getElementById("root"); r.scrollTop = r.scrollHeight; }); await page.waitForTimeout(700);
  const pn = await page.evaluate(() => { const p = document.querySelector("[data-bar-pin]"); return p ? p.querySelectorAll("[data-bar-pin-tab]").length : 0; });
  ok("Шапка не уезжает: внизу карты сверху — вкладки, разделы, поиск и «наверх»", pn === 3, String(pn));
  await shot("m31-wines-pin");
  await toBar("cocktail", 1500);
  const ckv = await page.evaluate(() => { const d = document.querySelector('[data-bar-learn="deck"]'), l = document.querySelector('[data-bar-learn="lab"]');
    return { row: !!(d && l) && Math.abs(d.getBoundingClientRect().top - l.getBoundingClientRect().top) < 2, art: document.querySelectorAll("[data-bar-ck] [data-bar-ck-art] svg").length, rows: document.querySelectorAll("[data-bar-ck]").length }; });
  ok("Коктейли: «Колода» и «Лаборатория» — две кнопки в одну строку, у каждого коктейля — бокал в его цвете", ckv.row && ckv.rows > 50 && ckv.art === ckv.rows, JSON.stringify(ckv));
  await shot("m32-cocktails-art");
  // затем владелец: «Делаешь лишние движения» — «Да, давай»: карточка коктейля здесь же, листать подряд, поиск находит вина
  await page.locator('[data-bar-ck="negroni"]').click().catch(() => {}); await page.waitForTimeout(700);
  // v136: «Как готовить» в карточке свёрнуто (состав уже сверху) — раскрыть касанием
  const howClosed = await page.evaluate(() => (document.querySelector("[data-bar-ck-how-toggle]") || { getAttribute: () => "" }).getAttribute("data-bar-ck-how-toggle") === "closed" && !document.querySelector("[data-bar-ck-how]"));
  await page.locator("[data-bar-ck-how-toggle]").click().catch(() => {}); await page.waitForTimeout(300);
  const cc = await page.evaluate(() => { const c = document.querySelector("[data-bar-ck-card]"); return c ? { id: c.getAttribute("data-bar-ck-card"), ing: c.querySelectorAll("[data-bar-ck-ing] > div").length,
    how: c.querySelectorAll("[data-bar-ck-how] li").length, learn: !!c.querySelector("[data-bar-ck-learn]"), build: !!c.querySelector("[data-bar-ck-build]") } : null; });
  ok("Карточка коктейля в «Барной карте»: состав с граммовкой, как готовить, «Учить в колоде», «Собрать руками»", !!cc && cc.id === "negroni" && cc.ing === 3 && howClosed && cc.how === 7 && cc.learn && cc.build, JSON.stringify({ howClosed, ...cc }));
  await shot("m33-cocktail-card");
  await page.evaluate(() => { const r = document.getElementById("root"); r.scrollTop = r.scrollHeight; }); await page.waitForTimeout(400);
  await shot("m34-card-steps");
  await page.locator('[data-card-step="next"]').click().catch(() => {}); await page.waitForTimeout(600);
  const nx = await page.evaluate(() => ({ id: (document.querySelector("[data-bar-ck-card]") || { getAttribute: () => "" }).getAttribute("data-bar-ck-card"), at: (document.querySelector("[data-card-steps]") || { getAttribute: () => "" }).getAttribute("data-card-steps") }));
  ok("«следующее ›» — следующий коктейль списка", !!nx.id && nx.id !== "negroni" && /^\d+\/\d+$/.test(nx.at), JSON.stringify(nx));
  await page.evaluate(() => window.__saNav && window.__saNav("search")); await page.waitForTimeout(900);
  await page.locator("input").first().fill("кьянти").catch(() => {}); await page.waitForTimeout(700);
  const sw = await page.evaluate(() => [...document.querySelectorAll("[data-search-drink]")].map((e) => e.getAttribute("data-search-drink")));
  ok("Поиск сверху находит вино: «кьянти»", sw.length === 1, JSON.stringify(sw));
  await shot("m35-search-wine");
  await page.locator("[data-search-drink]").first().click().catch(() => {}); await page.waitForTimeout(1500);
  ok("Касание — карточка вина в «Барной карте»", (await page.locator("[data-wine-card]").count()) === 1);
  await page.locator("[data-wine-edit]").click().catch(() => {}); await page.waitForTimeout(1500);
  await page.locator("[data-wine-save]").click().catch(() => {}); await page.waitForTimeout(1500);
  const sv = await page.evaluate(() => ({ card: !!document.querySelector("[data-wine-card]"), note: (document.querySelector("[data-wine-saved]") || {}).textContent || "" }));
  ok("«Править» → «Сохранить» — снова карточка вина, «Сохранено…»", sv.card && sv.note === "Сохранено: в карте у всех", JSON.stringify(sv));
  await shot("m36-wine-saved");
  // v129: «Показаны: …», конец списка, поиск находит в других вкладках
  await toBar("wine", 1500);
  await page.locator('[data-wine-only="red"]').click().catch(() => {}); await page.waitForTimeout(400);
  const fl = await page.evaluate(() => ({ note: ((document.querySelector("[data-wine-list] [data-bar-filter] span") || {}).textContent || ""), end: ((document.querySelector("[data-bar-end]") || {}).innerText || "").replace(/\s+/g, " ") }));
  ok("Раздел «Красные»: «Показаны: Красные, N из M» и в конце «Это весь раздел «Красные»»", /^Показаны: Красные, \d+ из \d+$/.test(fl.note) && /^Это весь раздел «Красные» Показать все вина/.test(fl.end), JSON.stringify(fl));
  await shot("m37-wines-filter");
  await page.locator("[data-bar-end-all]").click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator('[data-bar-tab="cocktail"]').click().catch(() => {}); await page.waitForTimeout(700);
  await page.locator('[data-bar-cocktails] input[type="search"]').fill("кьянти").catch(() => {}); await page.waitForTimeout(500);
  const ew = await page.evaluate(() => ({ none: (document.querySelector("[data-bar-ck-none]") || {}).textContent || "", tabs: (document.querySelector("[data-bar-elsewhere]") || { getAttribute: () => "" }).getAttribute("data-bar-elsewhere") }));
  ok("Поиск в коктейлях «кьянти» — «Здесь не нашлось.» и «Нашлось во вкладке «Вина»»", ew.none === "Здесь не нашлось." && ew.tabs === "wine", JSON.stringify(ew));
  await shot("m38-search-elsewhere");
  await page.locator("[data-bar-search-clear]").click().catch(() => {}); await page.waitForTimeout(300);
  // v130: печать «Барной карты», как у меню, и «Поделиться в чат» из карточки вина
  await page.locator('[data-bar-tab="wine"]').click().catch(() => {}); await page.waitForTimeout(700);
  await page.evaluate(() => { const b = document.querySelector("[data-bar-print-open]"); if (b) b.click(); }); await page.waitForTimeout(900);
  const bp = await page.evaluate(() => ({ kinds: [...document.querySelectorAll("[data-bar-print-kind]")].map((e) => e.getAttribute("data-bar-print-kind")).join(","),
    on: (document.querySelector('[data-bar-print-kind][aria-pressed="true"]') || { getAttribute: () => "" }).getAttribute("data-bar-print-kind"), photo: (document.querySelector("[data-bar-print-photo]") || { getAttribute: () => "" }).getAttribute("data-bar-print-photo") }));
  ok("«Печать» под вкладками — «Барная карта для печати»: коктейли, вина, крепкое, вся карта; выбраны вина, с фото бутылок", bp.kinds === "cocktail,wine,spirit,all" && bp.on === "wine" && bp.photo === "on", JSON.stringify(bp));
  await shot("m39-bar-print");
  await page.locator("[data-bar-print-go]").click().catch(() => {});
  await page.waitForSelector("[data-bar-print-pages]", { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  const bpg = await page.evaluate(() => { const i = document.querySelector("[data-bar-print-img]"); return { n: +((document.querySelector("[data-bar-print-pages]") || { getAttribute: () => 0 }).getAttribute("data-bar-print-pages")), w: i ? i.naturalWidth : 0, h: i ? i.naturalHeight : 0 }; });
  ok("«Картинкой» — страницы под А4 (1520 × 2148), листаются", bpg.n >= 1 && bpg.w === 1520 && bpg.h === 2148, JSON.stringify(bpg));
  await page.evaluate(() => { const i = document.querySelector("[data-bar-print-pages]"); if (i) i.scrollIntoView({ block: "start" }); }); await page.waitForTimeout(400);
  await shot("m40-bar-print-page");
  await page.locator('[data-lens="back"]').first().click().catch(() => {}); await page.waitForTimeout(700);
  await page.locator("[data-wine-row]").first().click().catch(() => {}); await page.waitForTimeout(800);
  await page.locator("[data-share-chat^='wine:']").click().catch(() => {}); await page.waitForTimeout(1000);
  ok("В карточке вина — «Поделиться в чат»: лист с вином", (await page.locator("[data-chat-shareto^='wine:']").count()) === 1);
  await page.locator("[data-chat-shareto-chat='team']").click().catch(() => {}); await page.waitForTimeout(1800);
  const wc = await page.evaluate(() => { const c = [...document.querySelectorAll('[data-chat-card="share"]')].pop(); return c ? c.innerText.replace(/\s+/g, " ").trim() : ""; });
  ok("В «Вся команда» — карточка «Вино» и «Открыть в Барной карте»", /^вино/i.test(wc) && /Открыть в Барной карте/.test(wc), wc.slice(0, 120));
  await shot("m41-share-wine");
  for (let i = 0; i < 3 && (await page.locator("[data-chat]").count()); i++) { await page.locator("[data-chat] .ch-back").first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700); }
  // v131 (Доп. 444): «Сомелье» — просьба одним касанием (к блюду, бокалом), ответ с «почему» и фразой гостю; карточка и «назад» к подбору
  await toBar("wine");
  await page.evaluate(() => { const b = document.querySelector("[data-bar-som-open]"); if (b) b.click(); }); await page.waitForTimeout(800);
  ok("«Сомелье» под вкладками «Барной карты»: экран подбора, выбрано «Вино»", (await page.locator('[data-som="wine"]').count()) === 1);
  await shot("m42-som");
  await page.locator('[data-som-chip="dish"]').click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator('[data-som-sub="dish"] [data-som-opt]').first().click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator('[data-som-chip="glass"]').click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator("[data-som-go]").click().catch(() => {});
  await page.waitForSelector('[data-som-res="ai"]', { timeout: 9000 }).catch(() => {}); await page.waitForTimeout(400);
  const smr = await page.evaluate(() => ({ n: document.querySelectorAll("[data-som-pick]").length, why: document.querySelectorAll("[data-som-why]").length, say: document.querySelectorAll("[data-som-say]").length,
    left: (document.querySelector("[data-som-left]") || { getAttribute: () => "" }).getAttribute("data-som-left"), text: (document.querySelector("[data-som-text]") || {}).value || "" }));
  ok("«К блюду» и «Бокалом» — фраза в поле; «Подобрать»: вина из нашей карты, у каждого «Почему» и «Гостю», у Наставника осталось 17 вопросов",
    /^к «.+», бокалом$/.test(smr.text) && smr.n >= 2 && smr.n <= 3 && smr.why === smr.n && smr.say === smr.n && smr.left === "17", JSON.stringify(smr));
  await page.evaluate(() => { const r = document.querySelector("[data-som-res]"); if (r) r.scrollIntoView({ block: "start" }); }); await page.waitForTimeout(300);
  await shot("m43-som-res");
  await page.locator("[data-som-open]").first().click().catch(() => {}); await page.waitForTimeout(900);
  ok("Касание — карточка вина, сверху «Из подбора Сомелье»", /Из подбора Сомелье/.test(await txt()));
  await shot("m44-som-card");
  await page.locator('[data-lens="back"]').first().click().catch(() => {}); await page.waitForTimeout(700);
  ok("«Назад» — к подбору: просьба и ответ на месте", (await page.locator('[data-som-res="ai"]').count()) === 1);
  // v132 (Доп. 445): «Сомелье» умнее — ответ в режиме «Сомелье» (подача, как сказать, фраза на выбор, уточнения, «Гость взял»),
  // «На стол» с бокалом к каждому блюду, настройка руководителя (что берут, вкус по шкалам через ИИ)
  await page.locator("[data-som-text]").fill("к «Кальмар в азиатском стиле»").catch(() => {});
  await page.locator("[data-som-go]").click().catch(() => {}); await page.waitForTimeout(2000);
  const j1 = await page.evaluate(() => ({ n: document.querySelectorAll("[data-som-pick]").length, serve: document.querySelectorAll("[data-som-serve]").length, vars: document.querySelectorAll("[data-som-var]").length,
    name: (document.querySelector("[data-som-name]") || { getAttribute: () => "" }).getAttribute("data-som-name"), refine: [...document.querySelectorAll("[data-som-refine]")].map((e) => e.getAttribute("data-som-refine")).join(",") }));
  ok("Сомелье в режиме сервера: у позиций подача, «Как сказать: Ри́слинг», фраза коротко, обычно и с историей, уточнения после ответа",
    j1.n >= 2 && j1.serve === j1.n && j1.vars >= 3 && j1.name === "Ри́слинг" && /up/.test(j1.refine), JSON.stringify(j1));
  await page.locator('[data-som-pick] [data-som-mark="taken"]').first().click().catch(() => {}); await page.waitForTimeout(600);
  ok("«Гость взял» — отмечено", (await page.locator('[data-som-pick][data-som-marked="taken"]').count()) === 1);
  await page.evaluate(() => { const r = document.querySelector("[data-som-res]"); if (r) r.scrollIntoView({ block: "start" }); }); await page.waitForTimeout(300);
  await shot("m45-som-json");
  await page.locator("[data-som-text]").fill("").catch(() => {});
  await page.locator('[data-som-chip="table"]').click().catch(() => {}); await page.waitForTimeout(300);
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-som-sub="table"] [data-som-opt]')]; if (b[0]) b[0].click(); }); await page.waitForTimeout(200);
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-som-sub="table"] [data-som-opt]')]; if (b[3]) b[3].click(); }); await page.waitForTimeout(200);
  await page.locator('[data-som-opt="стол:each"]').click().catch(() => {}); await page.waitForTimeout(200);
  await page.locator("[data-som-go]").click().catch(() => {}); await page.waitForTimeout(2000);
  const tgs = await page.evaluate(() => [...document.querySelectorAll("[data-som-group]")].map((g) => { let n = 0, e = g.nextElementSibling; while (e && e.hasAttribute("data-som-pick")) { n++; e = e.nextElementSibling; } return n; }));
  ok("«На стол», бокал к каждому: два блюда, к каждому своя позиция", tgs.length === 2 && tgs.every((n) => n === 1), JSON.stringify(tgs));
  await page.evaluate(() => { const r = document.querySelector("[data-som-res]"); if (r) r.scrollIntoView({ block: "start" }); }); await page.waitForTimeout(300);
  await shot("m46-som-table");
  await page.evaluate(() => { const r = document.querySelector("[data-som-admin]"); if (r) r.scrollIntoView({ block: "start" }); }); await page.waitForTimeout(300);
  const adm = await page.evaluate(() => ((document.querySelector("[data-som-stats]") || {}).innerText || "").replace(/\s+/g, " "));
  ok("Руководителю — что берут гости: «Чаще всего берут: Рислинг Кабинетт 2021…»", /^За 90 дней: подборов \d+, гости взяли \d+, не взяли \d+\. Чаще всего берут: Рислинг Кабинетт 2021/.test(adm), adm);
  await page.locator("[data-som-taste-fill]").click().catch(() => {}); await page.waitForTimeout(5000);
  const fm = await page.evaluate(() => ((document.querySelector("[data-som-taste-msg]") || {}).innerText || ""));
  ok("«Вкус по шкалам: заполнить через ИИ» — шкалы у остальных позиций, помечены «от ИИ»", /^Готово: шкалы у \d+ позиц/.test(fm), fm);
  await shot("m47-som-admin");
  // v134 (Доп. 447): «Заполнить по названию» дописывает к тому, что уже есть. Владелец (03.11): «если уже что-то заполнено, то AI
  // не может дополнить?». «Аберфелди 12» из карты: вид, страна, выдержка, порция и цена есть, остальное AI дописывает
  await toBar("spirit", 1500);
  await page.locator("[data-wine-edit]").click().catch(() => {}); await page.waitForTimeout(1500);
  await page.locator('[data-wine-erow="sp-demo-11"] [role="button"]').click().catch(() => {}); await page.waitForTimeout(900);
  const ab0 = await page.evaluate(() => [...document.querySelectorAll("[data-wine-form] span")].map((e) => e.textContent).find((t) => /AI допишет/.test(t)) || "");
  await page.locator("[data-wine-fill]").click().catch(() => {}); await page.waitForTimeout(1700);
  const ab = await page.evaluate(() => { const v = (k) => (document.querySelector('[data-wine-field="' + k + '"]') || {}).value || ""; return { note: ((document.querySelector("[data-wine-ai-note]") || {}).textContent || ""), producer: v("producer"), region: v("region"), country: v("country"), age: v("age"),
    check: ((document.querySelector("[data-wine-check]") || {}).textContent || "") }; });
  ok("«Аберфелди 12»: «AI допишет пустые поля, заполненное не тронет»; дописаны производитель, стиль, регион, ноты и рассказ; страна и выдержка из карты на месте",
    /AI допишет пустые поля, заполненное не тронет/.test(ab0) && /^Дописано: производитель, стиль, регион, крепость/.test(ab.note) && /о напитке$/.test(ab.note)
    && ab.producer === "Aberfeldy" && ab.region === "Хайленд" && ab.country === "Шотландия" && ab.age === "12 лет" && /^AI дописал: вид, страна, выдержка, порция, цена порции, производитель/.test(ab.check), JSON.stringify({ ab0, ab }));
  await shot("m48-spirit-fill");
  await page.locator("[data-wine-fill]").click().catch(() => {}); await page.waitForTimeout(1700);
  const ab2 = await page.evaluate(() => ((document.querySelector("[data-wine-ai-note]") || {}).textContent || ""));
  ok("Ещё раз: «AI не знает об этой позиции больше, чем уже вписано»", ab2 === "AI не знает об этой позиции больше, чем уже вписано", ab2);
  // v136 (Доп. 449): «Барная карта» удобнее и красивее. Владелец (04.11): «Как думаешь, ещё удобнее и красивее барную карту
  // можно сделать?» — «Давай все». Руководитель отметил «★ Советуем первым» Пино Нуар, Glenfiddich и Негрони; Совиньон блан сегодня закончился
  await toBar("wine", 1500);
  const v6vb = await page.evaluate(() => ({ view: (document.querySelector("[data-bar-view]") || { getAttribute: () => "" }).getAttribute("data-bar-view"),
    sorts: [...document.querySelectorAll("[data-bar-sort]")].map((e) => e.getAttribute("data-bar-sort")).join(","),
    art: [...document.querySelectorAll("[data-wine-row]")].filter((r) => (r.querySelector("[data-wine-thumb]") || { getAttribute: () => "" }).getAttribute("data-wine-thumb") === "art").map((r) => r.getAttribute("data-wine-row")).join(","),
    thumbs: document.querySelectorAll("[data-wine-row] [data-wine-thumb]").length, rows: document.querySelectorAll("[data-wine-row]").length,
    prio: [...document.querySelectorAll("[data-wine-row]")].filter((r) => r.querySelector("[data-wine-prio]")).map((r) => r.getAttribute("data-wine-row")).join(","),
    chip: !!document.querySelector('[data-wine-only="prio"]'), filter: ((document.querySelector("[data-wine-pick-open]") || {}).textContent || "").trim() }));
  ok("Вина: «Разделы · Цена · А–Я» и «Подробно · Кратко»; без фото — нарисованная бутылка; «★ советуем» у Пино Нуар; кнопка «Фильтр»",
    v6vb.view === "sec" && v6vb.sorts === "sec,price,az" && /wn-demo-3/.test(v6vb.art) && /wn-demo-5/.test(v6vb.art) && v6vb.thumbs === v6vb.rows && v6vb.prio === "wn-demo-6" && v6vb.chip && /^Фильтр/.test(v6vb.filter), JSON.stringify(v6vb));
  await page.locator('[data-bar-sort="price"]').click().catch(() => {}); await page.waitForTimeout(400);
  const v6pz = await page.evaluate(() => ({ flat: (document.querySelector("[data-wine-flat]") || { getAttribute: () => "" }).getAttribute("data-wine-flat"),
    rows: [...document.querySelectorAll("[data-wine-flat] [data-wine-row]")].map((r) => r.getAttribute("data-wine-row")) }));
  ok("«Цена»: одним списком от недорогих, первым «Москато д’Асти»", v6pz.flat === "price" && v6pz.rows.length === 9 && v6pz.rows[0] === "wn-demo-8", JSON.stringify(v6pz));
  await shot("m49-wines-price");
  await page.locator('[data-bar-sort="sec"]').click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator('[data-bar-short="on"]').click().catch(() => {}); await page.waitForTimeout(400);
  const v6sr = await page.evaluate(() => ({ n: document.querySelectorAll("[data-wine-short]").length, price: ((document.querySelector('[data-wine-row="wn-demo-2"] [data-wine-short-price]') || {}).textContent || "").replace(/\u00a0/g, " "),
    glass: !!document.querySelector('[data-wine-row="wn-demo-2"] [data-wine-short-glass]'), stop: ((document.querySelector('[data-wine-row="wn-demo-3"]') || {}).textContent || "").includes("сегодня нет") }));
  ok("«Кратко»: строка в одну линию: название, значок «бокалом», цена бутылки; «сегодня нет» на месте", v6sr.n === 9 && v6sr.price === "5 200 ₽" && v6sr.glass && v6sr.stop, JSON.stringify(v6sr));
  await shot("m50-wines-short");
  await page.locator('[data-bar-short="off"]').click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator('[data-wine-row="wn-demo-3"]').click().catch(() => {}); await page.waitForTimeout(900);
  const v6sv = await page.evaluate(() => { const b = document.querySelector("[data-wine-instead]"); return { t: b ? b.innerText.replace(/\s+/g, " ").slice(0, 40) : "",
    go: [...document.querySelectorAll("[data-wine-instead] [data-wine-similar-go]")].map((e) => e.getAttribute("data-wine-similar-go")).join(","), art: !!document.querySelector("[data-wine-hero] [data-wine-art]") }; });
  ok("«Совиньон блан» сегодня нет: «Предложи вместо» первыми Шабли и Рислинг; в шапке нарисованная бутылка", /^Сегодня нет\. Предложи вместо:/.test(v6sv.t) && /^wn-demo-2,wn-demo-4/.test(v6sv.go) && v6sv.art, JSON.stringify(v6sv));
  await shot("m51-wine-instead");
  await page.locator('[data-wine-instead] [data-wine-similar-go="wn-demo-2"]').click().catch(() => {}); await page.waitForTimeout(900);
  const v6ch = await page.evaluate(() => ({ title: (document.querySelector("h1, [data-wine-card] h2") || {}).textContent || "", say: (document.querySelector("[data-bar-say]") || { getAttribute: () => "" }).getAttribute("data-bar-say"),
    photo: !!document.querySelector("[data-wine-hero] [data-wine-photo-big]"), sim: (document.querySelector("[data-wine-similar]") || { getAttribute: () => "" }).getAttribute("data-wine-similar") }));
  ok("Касание — карточка Шабли: фото бутылки в шапке, «Как сказать: Шабли́ · Шардоне́», «Похожие в нашей карте»", v6ch.say === "Шабли,Шардоне" && v6ch.photo && Number(v6ch.sim) >= 2, JSON.stringify(v6ch));
  await shot("m52-wine-chablis");
  await page.locator("[data-wine-photo-big]").click().catch(() => {}); await page.waitForTimeout(400);
  const v6big = await page.locator("[data-wine-photo-full] img").count();
  await page.locator("[data-wine-photo-full]").click().catch(() => {}); await page.waitForTimeout(300);
  ok("Фото бутылки крупно — касанием, второе касание закрывает", v6big === 1 && !(await page.locator("[data-wine-photo-full]").count()), String(v6big));
  await page.locator('[data-lens="back"]').first().click().catch(() => {}); await page.waitForTimeout(800);
  await page.locator('[data-wine-row="wn-demo-6"]').click().catch(() => {}); await page.waitForTimeout(900);
  const v6p0 = await page.evaluate(() => (document.querySelector("[data-bar-prio]") || { getAttribute: () => "" }).getAttribute("data-bar-prio"));
  await page.locator("[data-bar-prio]").click().catch(() => {}); await page.waitForTimeout(900);
  const v6p1 = await page.evaluate(() => (document.querySelector("[data-bar-prio]") || { getAttribute: () => "" }).getAttribute("data-bar-prio"));
  await page.locator("[data-bar-prio]").click().catch(() => {}); await page.waitForTimeout(900);
  const v6p2 = await page.evaluate(() => (document.querySelector("[data-bar-prio]") || { getAttribute: () => "" }).getAttribute("data-bar-prio"));
  ok("Руководителю в карточке: «★ Советуем первым» снимается и ставится (та же отметка, что в «Сомелье»)", v6p0 === "on" && v6p1 === "off" && v6p2 === "on", [v6p0, v6p1, v6p2].join(","));
  await shot("m53-wine-prio");
  await toBar("cocktail", 1500);
  const v6ck = await page.evaluate(() => ({ neg: ((document.querySelector('[data-bar-ck="negroni"]') || {}).innerText || "").replace(/\s+/g, " "), chip: !!document.querySelector('[data-bar-ck-only="prio"]'),
    dots: document.querySelectorAll("[data-bar-ck-group] [data-bar-dot]").length }));
  ok("Коктейли: «Негрони ★ советуем», в одной строке «стир · рокс · Hendrick's, Campari»; у разделов цветные точки", /★ советуем/.test(v6ck.neg) && /стир · рокс · Hendrick's, Campari/.test(v6ck.neg) && v6ck.chip && v6ck.dots >= 5, JSON.stringify(v6ck));
  await page.locator('[data-bar-ck-only="prio"]').click().catch(() => {}); await page.waitForTimeout(400);
  const v6ckp = await page.evaluate(() => [...document.querySelectorAll("[data-bar-ck]")].map((e) => e.getAttribute("data-bar-ck")).join(","));
  ok("Раздел «★ Советуем» — только отмеченные", v6ckp === "negroni", v6ckp);
  await shot("m54-cocktails-prio");
  await page.locator('[data-bar-ck-only="all"]').click().catch(() => {}); await page.waitForTimeout(300);
  await toBar("spirit", 1500);
  const v6sp = await page.evaluate(() => ({ prio: [...document.querySelectorAll("[data-wine-row]")].filter((r) => r.querySelector("[data-wine-prio]")).map((r) => r.getAttribute("data-wine-row")).join(","),
    art: [...document.querySelectorAll("[data-wine-row] [data-wine-thumb]")].filter((t) => t.getAttribute("data-wine-thumb") === "art").length }));
  ok("Крепкое: «★ советуем» у Glenfiddich; без фото — бутылка по виду (виски, коньяк, джин…)", v6sp.prio === "sp-demo-1" && v6sp.art >= 6, JSON.stringify(v6sp));
  await shot("m55-spirits-art");
  // v137 (Доп. 450): уведомления на телефон — как на iPhone с экрана «Домой»: разрешение, пробное, «Только телефон», касание
  await page.evaluate(() => window.__saNav && window.__saNav("me")); await page.waitForTimeout(1200);
  await openGroups("Помощь и настройки");
  await page.locator('.sa-card[aria-label="Уведомления на телефон"]').first().click().catch(() => {}); await page.waitForTimeout(1600);
  ok("«Я» → «Уведомления на телефон»: окно «Напоминания», «Включить уведомления»", await page.locator('[role="dialog"][aria-label="Напоминания"] [data-push-enable]').count() === 1);
  await page.locator("[data-push-enable]").click().catch(() => {}); await page.waitForTimeout(700);
  ok("телефон спрашивает разрешение: «Не разрешать» · «Разрешить»", /«Service Academy» хочет присылать уведомления/.test(await page.locator("#demo-perm").innerText().catch(() => "")));
  await shot("m56-push-permission");
  await page.locator('[data-demo-perm="yes"]').click().catch(() => {}); await page.waitForTimeout(1300);
  ok("включено: «✓ Включено на этом телефоне», «Куда присылать»", await page.locator('[data-push-block="on"]').count() === 1 && await page.locator("[data-push-channel]").count() === 1);
  await page.locator("[data-push-test]").click().catch(() => {}); await page.waitForTimeout(900);
  const pb = (await page.locator("#demo-push").innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("«Проверить» — баннер сверху: «Уведомления работают»", /SERVICE ACADEMY сейчас Уведомления работают Так будут приходить сообщения: чат, смены, вопрос дня\./.test(pb), pb);
  await shot("m57-push-test");
  await page.locator('[data-push-ch="push"]').click().catch(() => {}); await page.waitForTimeout(700);
  ok("«Только телефон» выбран", await page.locator('[data-push-ch="push"][aria-pressed="true"]').count() === 1);
  await page.locator('[role="dialog"] [data-sa-back]').click().catch(() => {}); await page.waitForTimeout(500);
  await page.evaluate(() => { const D = window.__demo; D.srv.S.seen = {}; D.srv.bot.say("e-petr", "@Мария, на банкет нужен ещё один стол. Ставим к окну?"); D.save(); });
  await page.waitForTimeout(1000);
  const mp = (await page.locator("#demo-push").innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("упоминание — уведомлением на телефон, как в мессенджере (Доп. 451): «Вся команда», «Пётр О.: …»; Telegram молчит", /^SERVICE ACADEMY сейчас Вся команда( · \d+ нов(ых|ое))? Пётр О\.: @Мария, на банкет нужен ещё один стол/.test(mp) && await page.locator("#demo-tg").count() === 0, mp);
  await shot("m58-push-mention");
  await page.locator("#demo-push").click().catch(() => {}); await page.waitForTimeout(2200);
  ok("касание уведомления — чат на этом сообщении", await page.locator("[data-chat]").count() > 0 && /на банкет нужен ещё один стол/.test(await page.locator("[data-chat]").innerText().catch(() => "")));
  ok("Доп. 451: касание — сразу ответ на это сообщение (цитата над строкой ввода)", await page.locator("[data-chat-noreply]").count() === 1
    && /на банкет нужен ещё один стол/.test(await page.locator(".ch-bar").innerText().catch(() => "")));
  await shot("m59-push-tap-chat");
  for (let i = 0; i < 5 && await page.locator("[data-chat]").count(); i++) { await page.evaluate(() => { const b = document.querySelector("[data-chat] [data-sa-back]"); if (b) b.click(); }); await page.waitForTimeout(450); }
  // v137 (Доп. 451): Android — кнопки под уведомлением: «Ответить» (поле прямо в уведомлении) и «Прочитано»; «Принято»
  await page.evaluate(() => { localStorage.setItem("__demo_android", "1"); const D = window.__demo, S = D.srv.S; S.seen = {};
    const dm = D.srv.rpc("chat_dm", { p_token: D.srv.tokOf("e-anna"), p_emp: "u-maria" }).chat.id;
    D.srv.rpc("chat_send", { p_token: D.srv.tokOf("e-anna"), p_chat: dm, p_body: "Мария, можно поменяться сменой в субботу? Мне к врачу." }); D.save(); });
  await page.waitForTimeout(900);
  const ad = (await page.locator("#demo-push").innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("Android: личное — «Анна Смирнова» и текст, кнопки «Ответить» и «Прочитано»", /Анна Смирнова Мария, можно поменяться сменой в субботу\? Мне к врачу\. Ответить Прочитано/.test(ad), ad);
  await shot("m60-push-android-dm");
  await page.locator('[data-demo-push-act="reply"]').click().catch(() => {}); await page.waitForTimeout(300);
  await page.locator("[data-demo-push-reply]").fill("Да, давай. Возьму твою субботу").catch(() => {});
  await shot("m61-push-android-reply");
  await page.locator("[data-demo-push-send]").click().catch(() => {}); await page.waitForTimeout(300);
  const ar = (await page.locator("#demo-push").innerText().catch(() => "")).replace(/\s+/g, " ");
  const dmLast = await page.evaluate(() => { const D = window.__demo, m = D.srv.S.msgs.filter((x) => x.emp === "u-maria").at(-1); return m ? m.body : ""; });
  ok("«Ответить» прямо в уведомлении: ушло в личную переписку", /Ушло в личную переписку\./.test(ar) && dmLast === "Да, давай. Возьму твою субботу", ar + " · " + dmLast);
  await shot("m62-push-android-sent");
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const D = window.__demo; D.srv.S.seen = {}; D.srv.rpc("chat_late", { p_token: D.srv.tokOf("e-vera"), p_chat: null, p_min: 15, p_note: "пробка на мосту" }); D.save(); });
  await page.waitForTimeout(900);
  const al = (await page.locator("#demo-push").innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("Android: опоздание — «Вера … опаздывает на 15 минут», ниже подробности, кнопка «Принято»", /Вера [А-ЯЁ]\. опаздывает на 15 минут Будет в \d\d:\d\d.* · «пробка на мосту» Принято$/.test(al), al);
  await shot("m63-push-android-late");
  await page.locator('[data-demo-push-act="cl"]').click().catch(() => {}); await page.waitForTimeout(300);
  ok("«Принято» под уведомлением: «Принято.», на карточке опоздания — принято", /Принято\./.test(await page.locator("#demo-push").innerText().catch(() => ""))
    && await page.evaluate(() => { const D = window.__demo, m = D.srv.S.msgs.filter((x) => x.kind === "card" && x.card && x.card.t === "late" && x.emp === "e-vera").at(-1); return !!(m && m.card.ok); }));
  await page.evaluate(() => localStorage.removeItem("__demo_android"));
  await page.waitForTimeout(2600);
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
  // v137: «Уведомления на телефон» — функция на месте, включили Пётр, Ольга и Вера
  const sp = (await page.locator("[data-srv-push]").innerText().catch(() => "")).replace(/\s+/g, " ");
  // Пётр, Ольга и Вера — сразу; Мария — если её раздел шёл раньше (сервер демо общий)
  ok("«Сервер» → «Уведомления на телефон»: функция push-send на месте, 3–4 человека с телефонами", /Функция push-send: на месте/.test(sp) && /Уведомления включили: [34] человека, телефонов: [34]/.test(sp), sp.slice(0, 160));
  await page.evaluate(() => { const e = document.querySelector("[data-srv-push]"); if (e) e.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(300);
  await shot("r5-server-push");
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
