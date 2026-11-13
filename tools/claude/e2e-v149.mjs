// e2e v149 (Доп. 473): советы в уроках — органично и удобно. Сайт — демо целиком (tools/claude/demo-app/build.mjs: сервер
// в странице, люди демо; урок по id открывает window.__saLesson).
// Разделы: SYNC (через 5 с после старта тихая подгрузка: сводка меню и бара, этапы «Случаев» и «Спасибо от гостей», схема
// зала; в демо нет записей шефа, схемы зала и этапа «Спасибо от гостей»), AVAIL (совет молчит там, где пусто: «Голоса
// шефа» → «Как произносить», «Спасибо от гостей» и «Рассадка» — тишина; вина и крепкое есть — «Барная карта» и «Сомелье»
// говорят), GO (новые дороги кнопки: «Спасибо коллеге» — лист в чате, «Наоборот» — колода меню без названий и «Колода
// бармена», «Пищевая ценность» — колода на блюде с КБЖУ и панель на обороте, «Звонок в один тап» — сотруднику лист «С тобой
// в смене», «Опаздываю» — пункт «Гида»; следы на телефоне), LEAD (Мария: «Редактор меню» и «Стоп-лист» — редактор, «Меню
// для печати» — лист, «Звонок в один тап» — «Сегодня» раскрыто), NARROW (320 px: кнопка и «Не сейчас» в карточке),
// LIGHT («Для чтения»).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v149.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5349, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v149";
const SRC = process.env.E2E_SRC || new URL("../..", import.meta.url).pathname;
const { LESSON_TIPS, TIP_FEATURES } = await import(join(SRC, "data/lesson-tips.js"));
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(extra).slice(0, 500) : "")); } };
const browser = await chromium.launch();
const UK = { anna: "_Анна_Смирнова", maria: "_Мария_Ким" };
const R0 = "Два моря, Океан";

const boot = async (page, errs, cards = false) => {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  await page.evaluate((c) => localStorage.setItem("sa_lesson_cards", c ? "1" : "0"), cards);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
};
// тихая подгрузка (lib/tip-sync.js) идёт через 5 с после старта — ждём её следов
const waitSync = (page) => page.waitForFunction(() => !!localStorage.getItem("sa_tip_avail") && !!localStorage.getItem("sa_tip_stage") && !!localStorage.getItem("sa_tip_sync"), null, { timeout: 20000 }).then(() => true).catch(() => false);
async function open({ who = "anna", light = false, width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await boot(page, errs);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
const reload = async (page, errs) => { await page.goto(URL0, { waitUntil: "load" }); await boot(page, errs); };
const today = (page) => page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
const tipState = (page, who = "anna") => page.evaluate((uk) => { try { return JSON.parse(localStorage.getItem("sa_tips_" + uk) || "null"); } catch (e) { return null; } }, UK[who]);
const setTipState = (page, v, who = "anna") => page.evaluate(([uk, val]) => { if (val == null) localStorage.removeItem("sa_tips_" + uk); else localStorage.setItem("sa_tips_" + uk, JSON.stringify(val)); }, [UK[who], v]);
const lesson = async (page, id, ms = 1800) => { const r = await page.evaluate((x) => window.__saLesson ? window.__saLesson(x) : false, id); await page.waitForTimeout(ms); return r; };
const tipInfo = (page) => page.evaluate(() => {
  const el = document.querySelector("[data-lesson-tip]");
  if (!el) return null;
  const r = el.getBoundingClientRect(), go = el.querySelector("[data-tip-go]"), later = el.querySelector("[data-tip-later]");
  const g = go ? go.getBoundingClientRect() : null, l = later ? later.getBoundingClientRect() : null;
  return { id: el.getAttribute("data-lesson-tip"), label: (el.querySelector("[data-tip-label]") || {}).textContent || "", text: ((el.querySelector("[data-tip-text]") || {}).textContent || "").replace(/ /g, " "),
    cta: go ? go.textContent : "", left: r.left, right: r.right, top: r.top, bottom: r.bottom,
    goBox: g ? { left: g.left, right: g.right, top: g.top, bottom: g.bottom } : null, laterBox: l ? { left: l.left, right: l.right, top: l.top, bottom: l.bottom } : null };
});
const scrollTip = async (page) => { await page.evaluate(() => { const el = document.querySelector("[data-lesson-tip]"); if (el) el.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(900); };
const bodyText = (page) => page.evaluate(() => document.body.innerText || "");
const lsGet = (page, k) => page.evaluate((x) => localStorage.getItem(x), k);
const avail = (page) => page.evaluate((r) => { try { return (JSON.parse(localStorage.getItem("sa_tip_avail") || "{}") || {})[r] || null; } catch (e) { return null; } }, R0);
// только этот совет урока ещё не «использован» — так проверяется именно он
const only = async (page, L, f, who = "anna") => {
  const day = await today(page);
  await setTipState(page, { used: Object.fromEntries(LESSON_TIPS[L].map(([x]) => x).filter((x) => x !== f).map((x) => [x, day])) }, who);
};
const goTip = async (page, L, f, who = "anna") => {
  await only(page, L, f, who);
  await lesson(page, L);
  const t = await tipInfo(page);
  if (!t || t.id !== f) return { t, opened: false };
  await scrollTip(page);
  await page.locator("[data-tip-go]").first().click();
  await page.waitForTimeout(2300);
  return { t, opened: true };
};

// ── SYNC + AVAIL ────────────────────────────────────────────────────────────────────────────
if (want("SYNC") || want("AVAIL")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  ok("SYNC: тихая подгрузка прошла (сводка, этапы, отметка дня)", await waitSync(page));
  const a = await avail(page);
  ok("SYNC: сводка меню и бара: меню есть, вина и крепкое есть, записей шефа нет, КБЖУ — id блюда", !!a && a.menu === true && a.wines === true && a.spirits === true && a.voices === false && typeof a.kbju === "string" && a.kbju.length > 0, JSON.stringify(a));
  const stages = JSON.parse((await lsGet(page, "sa_tip_stage")) || "{}");
  ok("SYNC: этапы: «Случаи» есть, «Спасибо от гостей» в демо нет", stages.cases === "1" && stages.thanks === "0", JSON.stringify(stages));
  const seat = JSON.parse((await lsGet(page, "sa_seat_plan")) || "{}");
  ok("SYNC: «Рассадки» в демо нет — схемы не знаем", !seat[R0], JSON.stringify(seat));
  ok("SYNC: отметка дня — день и заведение", ((await lsGet(page, "sa_tip_sync")) || "") === (await today(page)) + "|" + R0, await lsGet(page, "sa_tip_sync"));
  // AVAIL
  await setTipState(page, null);
  await lesson(page, "s-prod-4");
  const t1 = await tipInfo(page);
  ok("AVAIL: «Рыба и свежесть» — записей шефа нет, вместо «Голосов» совет «Как произносить»", !!t1 && t1.id === "say", JSON.stringify(t1));
  await reload(page, errs); await setTipState(page, null);
  await only(page, "s-prod-2", "voices");
  await lesson(page, "s-prod-2");
  ok("AVAIL: «Как вкусно описать блюдо» — «Голоса шефа» молчат, пустого списка нет", (await tipInfo(page)) === null);
  await setTipState(page, null);
  await lesson(page, "s-mn-4");
  ok("AVAIL: «Счёт, расчёт, чаевые» — этапа «Спасибо от гостей» нет, совета нет (было: «Мой QR» → «нет этапа 34»)", (await tipInfo(page)) === null);
  await lesson(page, "s-pos-2");
  ok("AVAIL: «Жизненный цикл стола» — «Рассадки» нет, совета нет", (await tipInfo(page)) === null);
  await reload(page, errs); await setTipState(page, null);
  await lesson(page, "c6-1");
  const t2 = await tipInfo(page);
  ok("AVAIL: «Вино: стиль за десять секунд» — вина в карте есть, «Барная карта» на месте", !!t2 && t2.id === "barcard", JSON.stringify(t2));
  await reload(page, errs); await setTipState(page, null);
  await lesson(page, "s-prod-5");
  const t3 = await tipInfo(page);
  ok("AVAIL: «Логика сочетаний» — «Сомелье» на месте", !!t3 && t3.id === "sommelier", JSON.stringify(t3));
  await reload(page, errs);
  await only(page, "s1-3", "cases");
  await lesson(page, "s1-3");
  const t4 = await tipInfo(page);
  ok("AVAIL: «Работа с ошибками» — «Случаи» есть на сервере, совет на месте", !!t4 && t4.id === "cases", JSON.stringify(t4));
  ok("SYNC/AVAIL: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── GO ───────────────────────────────────────────────────────────────────────────────────────
if (want("GO")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await waitSync(page);
  const used = async (f) => { const st = await tipState(page); return !!(st && st.used && st.used[f]); };
  // «Спасибо коллеге» — лист в «Вся команда»
  let r = await goTip(page, "s7-3", "peerThanks");
  const thx = await page.evaluate(() => { const el = document.querySelector("[data-chat-thxsheet]"); return el ? el.getAttribute("data-chat-thxsheet") : null; });
  ok("GO peerThanks: «Сказать спасибо ›» — сразу лист «Спасибо коллеге» (выбор коллеги)", r.opened && r.t.cta === "Сказать спасибо ›" && thx === "pick" && await used("peerThanks"), JSON.stringify({ t: r.t, thx }));
  ok("GO peerThanks: лист оставил след на телефоне", (await lsGet(page, "sa_thx_seen")) === "1");
  await page.screenshot({ path: join(OUT, "go-peer-thx.png") });
  // «Наоборот» в «Колоде меню»
  await reload(page, errs);
  r = await goTip(page, "s-prod-1", "reverse");
  let b = await bodyText(page);
  ok("GO reverse: «Попробовать ›» — «Колода меню» сразу без названия («Что это?», «название по тапу»)", r.opened && /Что это\?/.test(b) && /название по тапу/.test(b), JSON.stringify(r.t));
  ok("GO reverse: след «Наоборот» на телефоне", (await lsGet(page, "sa_reverse_on")) === "1");
  await page.screenshot({ path: join(OUT, "go-reverse-menu.png") });
  // «Пищевая ценность» — колода на блюде с КБЖУ, на обороте панель
  await reload(page, errs);
  const a = await avail(page);
  const kName = await page.evaluate(async (id) => { const all = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}"); for (const arr of Object.values(all)) { const d = (arr || []).find((x) => String(x.id) === String(id)); if (d) return d.name; } return ""; }, a && a.kbju);
  r = await goTip(page, "s-prod-1", "kbju");
  const front = await page.evaluate(() => { const f = document.querySelector(".sa-ck-front"); return f ? f.innerText : ""; });
  ok("GO kbju: «Показать ›» — колода сразу на блюде, у которого есть КБЖУ", r.opened && !!kName && front.includes(kName), JSON.stringify({ t: r.t, kName, front: front.slice(0, 120) }));
  await page.locator(".sa-ck-wrap").first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const back = await page.evaluate(() => { const f = document.querySelector(".sa-ck-back"); return f ? f.innerText : document.body.innerText; });
  ok("GO kbju: на обороте — «Пищевая ценность»; след на телефоне", /Пищевая ценность/.test(back) && (await lsGet(page, "sa_kbju_seen")) === "1", back.slice(0, 200));
  await page.evaluate(() => { const el = [...document.querySelectorAll("div")].find((x) => x.textContent === "Пищевая ценность"); if (el) el.scrollIntoView({ block: "center" }); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "go-kbju.png") });
  // «Звонок в один тап» — сотруднику сразу «Кто со мной»: лист «С тобой в смене», тап по лицу — позвонить
  await reload(page, errs);
  await page.evaluate(() => localStorage.removeItem("sa_call_seen"));
  r = await goTip(page, "s-dg-3", "call");
  await page.waitForTimeout(1200);
  const sh = await page.evaluate(() => { const el = document.querySelector("[data-day-sheet]"); if (!el) return null; const q = el.getBoundingClientRect(); return { text: el.innerText, faces: el.querySelectorAll("[data-sheet-face]").length, top: q.top, h: innerHeight }; });
  ok("GO call: «Кто в смене ›» — «График смен» и сразу лист «С тобой в смене» с лицами коллег", r.opened && r.t.cta === "Кто в смене ›" && !!sh && /С тобой в смене/.test(sh.text) && sh.faces > 0 && sh.top < sh.h, JSON.stringify({ t: r.t, sh: sh && { ...sh, text: sh.text.slice(0, 80) } }));
  ok("GO call: след на телефоне", (await lsGet(page, "sa_call_seen")) === "1");
  await page.screenshot({ path: join(OUT, "go-call-mates.png") });
  await page.locator("[data-sheet-face]").first().click().catch(() => {});
  await page.waitForTimeout(600);
  ok("GO call: тап по лицу — строка «позвонить»", /позвонить|телефона нет/.test((await page.evaluate(() => (document.querySelector("[data-day-sheet]") || {}).innerText || ""))));
  // чат смены (второй совет урока)
  await reload(page, errs);
  r = await goTip(page, "s-dg-3", "chat");
  b = await bodyText(page);
  ok("GO chat: «Открыть чат ›» — чат смены", r.opened && /Вся команда/.test(b) && await used("chat"), JSON.stringify(r.t));
  // «Опаздываю» — пункт «Гида»
  await reload(page, errs);
  r = await goTip(page, "c2-4", "late");
  const g = await page.evaluate(() => { const el = document.querySelector('[data-guide-key="late"]'); if (!el) return null; const q = el.getBoundingClientRect(); return { exp: el.getAttribute("aria-expanded"), top: q.top, h: innerHeight, text: (el.parentElement || el).innerText }; });
  ok("GO late: «Как это работает ›» — «Гид», пункт «Опаздываю» раскрыт и на экране", r.opened && r.t.cta === "Как это работает ›" && !!g && g.exp === "true" && g.top > 0 && g.top < g.h && /За 3 часа до смены/.test(g.text), JSON.stringify({ t: r.t, g }));
  await page.screenshot({ path: join(OUT, "go-late-guide.png") });
  await page.locator('[data-guide-key="late"]').locator("xpath=..").getByText("Открыть ›").first().click().catch(() => {});
  await page.waitForTimeout(1500);
  ok("GO late: из «Гида» «Открыть ›» — вкладка «Смена»", /Смена|Сегодня/.test(await bodyText(page)));
  // «Наоборот» у бармена — «Колода бармена» (след «Наоборот» один на обе колоды — для проверки стираем)
  await reload(page, errs);
  await page.evaluate(() => localStorage.removeItem("sa_reverse_on"));
  r = await goTip(page, "bar2-2", "reverse");
  b = await bodyText(page);
  ok("GO reverse (бар): значок шейкера, «Колода бармена» без названий («Что это?»)", r.opened && /Что это\?/.test(b), JSON.stringify(r.t));
  await page.screenshot({ path: join(OUT, "go-reverse-bar.png") });
  ok("GO: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── LEAD ─────────────────────────────────────────────────────────────────────────────────────
if (want("LEAD")) {
  const { ctx, page, errs } = await open({ who: "maria" });
  await waitSync(page);
  let r = await goTip(page, "m5-3", "menuEdit", "maria");
  let b = await bodyText(page);
  ok("LEAD menuEdit: «К редактору ›» — редактор меню (было: «Знаю?»)", r.opened && r.t.cta === "К редактору ›" && /Опубликовать|Свои блюда|Архив/.test(b) && !/Знаю\?/.test(b.slice(0, 200)), JSON.stringify({ t: r.t, b: b.slice(0, 200) }));
  await page.screenshot({ path: join(OUT, "lead-menu-edit.png") });
  await reload(page, errs);
  r = await goTip(page, "m7-2", "stop", "maria");
  b = await bodyText(page);
  ok("LEAD stop: «Стоп-лист» — тот же редактор, где «В стоп»", r.opened && /В стоп/.test(b), JSON.stringify({ t: r.t, b: b.slice(0, 200) }));
  await reload(page, errs);
  r = await goTip(page, "m3-1", "menuprint", "maria");
  b = await bodyText(page);
  ok("LEAD menuprint: «Открыть ›» — «Меню для печати»; след на телефоне", r.opened && /С фото|Без фото|Отправить/.test(b) && (await lsGet(page, "sa_menu_print")) === "1", JSON.stringify({ t: r.t, b: b.slice(0, 200) }));
  await page.screenshot({ path: join(OUT, "lead-menu-print.png") });
  // руководителю «Звонок в один тап» — «Сегодня» в графике раскрыто и на экране
  await reload(page, errs);
  r = await goTip(page, "m7-1", "call", "maria");
  await page.waitForTimeout(1500);
  const td = await page.evaluate(() => { const el = document.querySelector("[data-sched-today]"); if (!el) return null; const q = el.getBoundingClientRect(); return { st: el.getAttribute("data-sched-today"), top: q.top, bottom: q.bottom, h: innerHeight, faces: el.innerText.length }; });
  ok("LEAD call: Мария — «Сегодня» раскрыто и на экране", r.opened && !!td && td.st === "open" && td.top < td.h && td.bottom > 0, JSON.stringify({ t: r.t, td }));
  await page.screenshot({ path: join(OUT, "lead-call-today.png") });
  await reload(page, errs);
  const a = await avail(page);
  await only(page, "m6-1", "barcardEdit", "maria");
  await lesson(page, "m6-1");
  const t = await tipInfo(page);
  ok("LEAD barcardEdit: «Своя карта бара» — только пока она не настроена", a && a.barcard ? t === null || t.id !== "barcardEdit" : !!t && t.id === "barcardEdit", JSON.stringify({ barcard: a && a.barcard, t }));
  ok("LEAD: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── NARROW ───────────────────────────────────────────────────────────────────────────────────
if (want("NARROW")) {
  const { ctx, page, errs } = await open({ who: "anna", width: 320, height: 640 });
  await waitSync(page);
  await page.waitForTimeout(1500);   // чат отвечает через 4 с после старта — «Опаздываю» ждёт и его
  await only(page, "c2-4", "late");
  await lesson(page, "c2-4");
  await scrollTip(page);
  const t = await tipInfo(page);
  const sw = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  ok("NARROW: 320 px — совет «Опаздываю» на месте, карточка в экране", !!t && t.id === "late" && t.left >= 0 && t.right <= 320.5, JSON.stringify(t));
  ok("NARROW: длинная кнопка «Как это работает ›» и «Не сейчас» — в карточке, без вылезания", !!t && !!t.goBox && !!t.laterBox && t.goBox.right <= t.right && t.laterBox.right <= t.right + 0.5 && sw <= 321, JSON.stringify({ t, sw }));
  await page.screenshot({ path: join(OUT, "tip-late-320.png") });
  ok("NARROW: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── LIGHT ────────────────────────────────────────────────────────────────────────────────────
if (want("LIGHT")) {
  const { ctx, page, errs } = await open({ who: "anna", light: true, width: 360, height: 760 });
  await waitSync(page);
  await only(page, "s-prod-1", "kbju");
  await lesson(page, "s-prod-1");
  await scrollTip(page);
  const t = await tipInfo(page);
  const sz = await page.evaluate(() => { const el = document.querySelector("[data-lesson-tip] [data-tip-text]"); return el ? getComputedStyle(el).fontSize : ""; });
  ok("LIGHT: «Для чтения» — «Пищевая ценность» крупно (16 px), кнопка и «Не сейчас» в карточке", !!t && t.id === "kbju" && sz === "16px" && !!t.goBox && t.goBox.right <= t.right && t.right <= 360.5, JSON.stringify({ t, sz }));
  await page.screenshot({ path: join(OUT, "tip-kbju-light.png") });
  ok("LIGHT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`итог: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
