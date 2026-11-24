// e2e v193 (Доп. 518): меню в ежедневном повторе — все семь идей владельца («Давай по классике. Все»). Сайт — демо целиком
// (tools/claude/demo-app/build.mjs: сервер в странице). Время в демо — localStorage.__demo_t (до смены, на смене, после,
// завтра); у Анны сегодня и завтра дневная смена 12:00–20:00. __demo_no59 = "1" — сервер без этапа 59, __demo_qday = "1" —
// «Вопрос дня» на главной.
// Разделы:
//   WARM   — до смены «3 ситуации и 2 блюда»; после ситуаций — блюда: «Блюдо 1 из 2», вспомни → «Показать состав» → состав
//            и аллергены → «Знаю» / «Не уверена»; в чеке «Блюда: знаю 1 из 2» и «Повторим ещё»; «Знаю?» и журнал разминок на
//            телефоне, копия на сервере (menu_know_set);
//   SENT   — бот назвал блюда в напоминании: в разминке — они же («из напоминания»); ссылка «Разминка» (?go=warmup) — тоже;
//   BREAK  — на смене «В перерыв: одно блюдо за 20 секунд»: под карточкой, состав, «Знаю», «Ещё одно» — другое, «Не уверена»,
//            «Закрыть»;
//   ASKED  — после смены «Спросили о блюде?»: поиск, отметить, «Повторим завтра: «…»»; завтра — первым в разминке («спрашивали»);
//   QDAY   — «Вопрос дня» о блюде («· Меню»), ошибка — «Блюдо придёт в разминку», блюдо к повтору; очередь — через один;
//   RHYTHM — «Напоминания» → «Блюда в разминке»: пример сообщения с блюдами, «Через смену», «3 блюда», «Не нужно» — блюд нет
//            ни в разминке, ни в перерыве, на сервере ритм «off»;
//   TEAM   — Мария: «Меню» → «Как команда знает меню»: прислали, слабые блюда по порядку, «В разминку команде», «В фокус
//            смены», «Сейчас просите», «Снять»; брифинг — блюдо в «Фокусе смены»; Анна — блюдо в разминке («просит руководитель»);
//   NO59   — сервер без этапа 59: разминка и перерыв с блюдами, у Марии — понятная надпись, пример сообщения без блюд;
//   LOOK   — 320 px и «Для чтения»: карточка блюда, перерыв, «Спросили о блюде?», сводка — без прокрутки вбок, кнопки с линзой.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v193.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo193", PORT = Number(process.env.E2E_PORT) || 5793, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v193";
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
const R0 = "Два моря, Океан";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 300) : "")); } };
const browser = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ready(page, errs) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1300);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    document.querySelectorAll("[data-badge-new] [data-lens-x], [data-shelf-new] button[aria-label='Закрыть']").forEach((x) => x.click());
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
}
// время демо: hour по местному времени, day — сдвиг в днях от сегодня (настоящее время — performance.timeOrigin)
const setClock = (page, hour, day = 0) => page.evaluate(([hr, dd]) => {
  const n = performance.timeOrigin + performance.now(), d = new Date(n);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + dd, hr, 0, 0).getTime();
  localStorage.setItem("__demo_t", JSON.stringify({ off: t - n, at: n }));
}, [hour, day]);
async function open({ who = "anna", hour = 11, day = 0, light = false, width = 390, height = 844, no59 = false, qday = false, url = "" } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, n59, q]) => { localStorage.clear(); localStorage.setItem("__demo_who", w); if (n59) localStorage.setItem("__demo_no59", "1"); if (q) localStorage.setItem("__demo_qday", "1"); }, [who, no59, qday]);
  await setClock(page, hour, day);
  await page.goto(URL0 + url, { waitUntil: "load" });
  await ready(page, errs);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
async function reopen(page, errs, { who = null, hour = null, day = 0, url = "" } = {}) {
  if (who) await page.evaluate((w) => localStorage.setItem("__demo_who", w), who);
  if (hour != null) await setClock(page, hour, day);
  await page.goto(URL0 + url, { waitUntil: "load" });
  await ready(page, errs);
}
const nav = async (page, s, ms = 1800) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms);
  await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); await page.waitForTimeout(250); };
const txt = async (loc) => ((await loc.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
const body = (page) => txt(page.locator("body"));
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });
const overflowX = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
const until = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(150); } return null; };
const ls = (page, k) => page.evaluate((x) => { try { return JSON.parse(localStorage.getItem(x) || "null"); } catch (e) { return null; } }, k);
const UK = "_Анна_Смирнова";
const srv = (page, fn) => page.evaluate(fn);
const menu = (page) => page.evaluate(() => window.__demo.srv.S.menu.filter((d) => d && d.name && !d.kind && !d.archived).map((d) => ({ id: String(d.id), name: d.name, stop: !!d.stop })));
const live = (M) => M.filter((x) => !x.stop);   // стоп в разминку и перерыв не идёт
const nowCard = (page) => page.evaluate(() => { const c = document.querySelector("[data-now-card]"); return c ? { mode: c.getAttribute("data-now-card"), text: c.innerText.replace(/\s+/g, " ") } : null; });
const lensMiss = (page) => page.evaluate(() => [...document.querySelectorAll(".sa-screen button, .sa-screen input, .sa-screen textarea, .sa-screen select")]
  .filter((e) => e.getClientRects().length && e.type !== "checkbox" && e.type !== "file")
  .filter((e) => ![...e.attributes].some((a) => a.name.startsWith("data-lens"))).map((e) => (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 30)));

// разминка: ситуации — любым ответом (ошибка — «Дальше без этого»), до первого блюда или чека; вернёт, сколько было ситуаций
async function sitsUntilDish(page) {
  let n = 0;
  for (let i = 0; i < 12; i++) {
    if (await page.locator(".tb [data-warm-dish]").count()) return n;
    if (await page.locator(".tb .tb-receipt").count()) return n;
    const k = await txt(page.locator(".tb .tb-k b").first());
    const opt = page.locator(".tb .tb-actc, .tb .tb-reply, .tb .tb-chip2, .tb .tb-myth button").first();
    if (await opt.count()) { await opt.click().catch(() => {}); if (!/Напоследок/.test(k)) n++; }
    await page.waitForTimeout(1300);
    const ghost = page.locator(".tb .tb-ghost", { hasText: "Дальше без этого" });
    if (await ghost.count()) { await ghost.click(); await page.waitForTimeout(500); continue; }
    const main = page.locator(".tb .tb-foot .tb-main");
    if (await main.count()) { await main.first().click().catch(() => {}); await page.waitForTimeout(500); }
  }
  return n;
}
async function dishStep(page, okBtn = true) {
  const head = await txt(page.locator(".tb .tb-k b").first());
  const where = await txt(page.locator(".tb [data-warm-dish] .tb-where").first());
  const card = page.locator(".tb [data-warm-dish]").first();
  const id = await card.getAttribute("data-warm-dish");
  const front = await txt(card);
  await page.locator(".tb [data-dish-flip]").click();
  await page.waitForTimeout(400);
  const back = await txt(page.locator(".tb [data-dish-back]").first());
  const unsure = await txt(page.locator(".tb [data-dish-unsure]").first());
  await page.locator(okBtn ? ".tb [data-dish-know]" : ".tb [data-dish-unsure]").click();
  await page.waitForTimeout(700);
  return { head, where, id, front, back, unsure };
}
async function finishToReceipt(page) {
  for (let i = 0; i < 6 && !(await page.locator(".tb .tb-receipt").count()); i++) {
    const opt = page.locator(".tb .tb-chip2").first();
    if (await opt.count()) { await opt.click().catch(() => {}); await page.waitForTimeout(900); }
    const main = page.locator(".tb .tb-foot .tb-main");
    if (await main.count()) { await main.first().click().catch(() => {}); await page.waitForTimeout(700); }
  }
  return txt(page.locator(".tb .tb-receipt").first());
}
const openWarm = async (page) => { await page.locator("[data-now-card]").first().click(); return until(async () => (await page.locator(".tb").count()) > 0, 6000); };

// ═══ WARM ═══
if (want("WARM")) {
  const { ctx, page, errs } = await open({ who: "anna", hour: 11 });
  const nc = await until(() => nowCard(page), 8000);
  ok("WARM: до смены — «3 ситуации и 2 блюда»", nc && nc.mode === "before" && /3 ситуации и 2 блюда · 2 мин/.test(nc.text), nc);
  const M = await menu(page);
  await shot(page, "warm-home");
  ok("WARM: разминка открылась", await openWarm(page));
  const sits = await sitsUntilDish(page);
  ok("WARM: сначала ситуации (2–3)", sits >= 2 && sits <= 3, sits);
  await shot(page, "warm-dish-front");
  const d1 = await dishStep(page, true);
  ok("WARM: «Блюдо 1 из 2», подпись «меню · …», блюдо из меню", d1.head === "Блюдо 1 из 2" && /^меню( · .+)?$/.test(d1.where) && M.some((x) => x.id === d1.id), d1);
  ok("WARM: сначала только вспомнить: название, «Вспомни, что в составе…», состава нет", /Вспомни, что в составе и какие аллергены/.test(d1.front) && !/Аллергены/.test(d1.front), d1.front);
  ok("WARM: перевернул — состав, аллергены, кнопки «Знаю» и «Не уверена»", /Состав/.test(d1.back) && /Аллергены/.test(d1.back) && d1.unsure === "Не уверена", d1.back.slice(0, 120));
  ok("WARM: блюда — по порядку меню, пока ничего не отмечено (подпись — просто «меню»), стоп — мимо", d1.id === live(M)[0].id && d1.where === "меню", [d1.id, live(M)[0].id, d1.where]);
  const head2 = await txt(page.locator(".tb .tb-k b").first());
  await page.locator(".tb [data-dish-flip]").click(); await page.waitForTimeout(500);
  await shot(page, "warm-dish-back");
  const id2 = await page.locator(".tb [data-warm-dish]").first().getAttribute("data-warm-dish");
  const name2 = (M.find((x) => x.id === id2) || {}).name || "";
  await page.locator(".tb [data-dish-unsure]").click(); await page.waitForTimeout(700);
  ok("WARM: второе блюдо — «Блюдо 2 из 2», другое", head2 === "Блюдо 2 из 2" && id2 && id2 !== d1.id, [head2, id2]);
  const rc = await finishToReceipt(page);
  await shot(page, "warm-receipt");
  ok("WARM: чек — «Разминка готова», «Блюда: знаю 1 из 2», «Повторим ещё: «…»»", /Разминка готова/.test(rc) && /Блюда: знаю 1 из 2/.test(rc) && rc.includes("Повторим ещё: «" + name2 + "»"), rc.slice(0, 300));
  const sr = await ls(page, "sa_menu_sr_" + R0);
  ok("WARM: «Знаю?» на телефоне: первое — ступень 1, второе — к повтору; у отметок есть день", sr && sr[d1.id] && sr[d1.id].stage === 1 && sr[id2] && sr[id2].stage === 0 && sr[d1.id].t > 0, sr);
  const today = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); });
  const log = await ls(page, "sa_menu_warmlog" + UK);
  ok("WARM: журнал разминок — сегодня с блюдами", log && log.last === today && log.prev === today && log.had === true, log);
  await page.locator(".tb .tb-foot .tb-main").first().click(); await page.waitForTimeout(900);
  const nc2 = await nowCard(page);
  ok("WARM: разминка сделана — карточка больше не зовёт", !nc2 || nc2.mode !== "before", nc2);
  const k = await until(() => srv(page, () => { const x = window.__demo.srv.S.mk.know["e-anna"]; return x && Object.keys(x.data || {}).length ? x : null; }), 22000);
  ok("WARM: копия на сервере: «Знаю?» и ритм с журналом", k && k.data[d1.id] && k.data[d1.id][0] === 1 && k.data[id2] && k.data[id2][0] === 0 && k.warm && k.warm.r === "each" && k.warm.had === true && k.warm.last === today, k);
  ok("WARM: без ошибок в странице", !errs.length, errs);
  await ctx.close();
}

// ═══ SENT ═══
if (want("SENT")) {
  const { ctx, page, errs } = await open({ who: "anna", hour: 11 });
  const M = live(await menu(page));
  const pick = [M[3], M[5]];
  await srv(page, () => true);
  await page.evaluate(([ids, names]) => { const S = window.__demo.srv.S; const d = new Date(); const day = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    S.mk.know["e-anna"] = { data: {}, warm: null, sent: { day, ids, names }, at: new Date().toISOString() }; window.__demo.save(); }, [pick.map((x) => x.id), pick.map((x) => x.name)]);
  await reopen(page, errs, { url: "?go=warmup" });
  const opened = await until(async () => (await page.locator(".tb").count()) > 0, 9000);
  ok("SENT: ссылка «Разминка» из Telegram открыла разминку", opened);
  await sitsUntilDish(page);
  const d1 = await dishStep(page, true);
  const d2 = await dishStep(page, true);
  ok("SENT: в разминке — блюда из напоминания, по порядку, подпись «из напоминания»", d1.id === pick[0].id && d2.id === pick[1].id && d1.where === "меню · из напоминания", [d1.id, d2.id, d1.where, pick]);
  ok("SENT: без ошибок", !errs.length, errs);
  await ctx.close();
}

// ═══ BREAK ═══
if (want("BREAK")) {
  const { ctx, page, errs } = await open({ who: "anna", hour: 14 });
  const nc = await until(() => nowCard(page), 8000);
  ok("BREAK: на смене — строка «В перерыв: одно блюдо за 20 секунд»", nc && nc.mode === "during" && /В перерыв: одно блюдо за 20 секунд/.test(nc.text), nc);
  const M = await menu(page);
  await page.locator('[data-now-row="dish"]').click(); await page.waitForTimeout(600);
  const panel = page.locator("[data-break-dish]").first();
  const id1 = await panel.getAttribute("data-break-dish");
  ok("BREAK: блюдо прямо под карточкой, строка ушла, меню не открылось", id1 && M.some((x) => x.id === id1) && !(await page.locator('[data-now-row="dish"]').count()) && (await page.evaluate(() => window.__saScreen())) === "roleSelect", id1);
  ok("BREAK: «Блюдо в перерыв», название, «Вспомни…», «Показать состав»", /Блюдо в перерыв/.test(await txt(panel)) && /Вспомни состав и аллергены/.test(await txt(panel)) && (await page.locator("[data-break-open]").count()) === 1);
  await shot(page, "break-front");
  await page.locator("[data-break-open]").click(); await page.waitForTimeout(400);
  ok("BREAK: состав и аллергены, «Знаю» и «Не уверена»", /Аллерген/.test(await txt(page.locator("[data-break-back]"))) && (await txt(page.locator("[data-break-unsure]"))) === "Не уверена");
  await shot(page, "break-back");
  await page.locator("[data-break-know]").click(); await page.waitForTimeout(500);
  ok("BREAK: «Отметила «Знаю». Повторим, когда подойдёт срок.»", /Отметила «Знаю»\. Повторим, когда подойдёт срок\./.test(await txt(page.locator('[data-break-done="ok"]'))));
  const sr = await ls(page, "sa_menu_sr_" + R0);
  ok("BREAK: отметка в «Знаю?»", sr && sr[id1] && sr[id1].stage === 1, sr);
  await page.locator("[data-break-more]").click(); await page.waitForTimeout(500);
  const id2 = await page.locator("[data-break-dish]").first().getAttribute("data-break-dish");
  ok("BREAK: «Ещё одно» — другое блюдо, отмеченное сегодня не повторяется", id2 && id2 !== id1, [id1, id2]);
  await page.locator("[data-break-open]").click(); await page.waitForTimeout(300);
  await page.locator("[data-break-unsure]").click(); await page.waitForTimeout(400);
  ok("BREAK: «Не уверена» — «Блюдо вернётся в разминку»", /Блюдо вернётся в разминку/.test(await txt(page.locator('[data-break-done="again"]'))));
  await page.locator("[data-break-close]").click(); await page.waitForTimeout(400);
  ok("BREAK: «Закрыть» — панель ушла, строка снова на месте", !(await page.locator("[data-break-dish]").count()) && (await page.locator('[data-now-row="dish"]').count()) === 1);
  ok("BREAK: без ошибок", !errs.length, errs);
  await ctx.close();
}

// ═══ ASKED ═══
if (want("ASKED")) {
  const { ctx, page, errs } = await open({ who: "anna", hour: 21 });
  const nc = await until(() => nowCard(page), 8000);
  ok("ASKED: после смены — «Спросили о блюде? Отметь»", nc && nc.mode === "after" && /Спросили о блюде\? Отметь/.test(nc.text), nc);
  const M = await menu(page);
  await page.locator('[data-now-row="asked"]').click(); await page.waitForTimeout(500);
  const sheet = page.locator("[data-asked-sheet]");
  ok("ASKED: окно «О каком блюде спросили?» со списком блюд", (await sheet.count()) === 1 && /О каком блюде спросили\?/.test(await txt(sheet)) && (await page.locator("[data-asked-dish]").count()) === M.length);
  await shot(page, "asked-sheet");
  await page.locator("[data-asked-sheet] input").fill("крем");
  await page.waitForTimeout(300);
  const found = await page.locator("[data-asked-dish]").evaluateAll((els) => els.map((e) => e.textContent));
  ok("ASKED: поиск по названию и составу", found.length >= 1 && found.length < M.length && found.some((t) => /Тыквенный крем-суп с крабом/.test(t)), found);
  const target = M.find((x) => /Тыквенный крем-суп/.test(x.name));
  await page.locator('[data-asked-dish="' + target.id + '"]').click(); await page.waitForTimeout(400);
  ok("ASKED: отмечено — «✓ завтра в разминке»", /завтра в разминке/.test(await txt(page.locator('[data-asked-dish="' + target.id + '"]'))));
  await page.locator("[data-asked-sheet] [data-sa-back]").click(); await page.waitForTimeout(500);
  const nc2 = await nowCard(page);
  ok("ASKED: строка — «Повторим завтра: «Тыквенный крем-суп с крабом»»", nc2 && nc2.text.includes("Повторим завтра: «" + target.name + "»"), nc2);
  const asked = await ls(page, "sa_menu_asked" + UK);
  const sr = await ls(page, "sa_menu_sr_" + R0);
  ok("ASKED: на телефоне — «спросили» и блюдо к повтору (с отметкой)", asked && asked[R0] && asked[R0][0].id === target.id && sr && sr[target.id] && sr[target.id].stage === 0 && sr[target.id].m > 0, [asked, sr]);
  await reopen(page, errs, { hour: 11, day: 1 });
  const nc3 = await until(() => nowCard(page), 8000);
  ok("ASKED: завтра до смены — разминка с блюдами", nc3 && nc3.mode === "before" && /и 2 блюда/.test(nc3.text), nc3);
  await openWarm(page);
  await sitsUntilDish(page);
  const d1 = await dishStep(page, true);
  ok("ASKED: завтра первым — это блюдо, подпись «спрашивали»", d1.id === target.id && d1.where === "меню · спрашивали", d1);
  ok("ASKED: без ошибок", !errs.length, errs);
  await ctx.close();
}

// ═══ QDAY ═══
if (want("QDAY")) {
  // день с нечётным номером (с 1970 года) — первым вопрос о блюде; сегодня чётный — берём завтра
  const odd = (() => { const d = new Date(); const n = Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); return n % 2 === 1; })();
  const { ctx, page, errs } = await open({ who: "anna", hour: 11, day: odd ? 0 : 1, qday: true });
  const card = await until(async () => (await page.locator("[data-qday-card]").count()) ? page.locator("[data-qday-card]").first() : null, 20000);
  ok("QDAY: на главной «Вопрос дня · Меню»", card && /Вопрос дня/.test(await txt(card)) && /· Меню/.test(await txt(card)), card ? await txt(card) : "нет");
  const q = await srv(page, () => window.__demo.srv.S.qd["e-anna"]);
  ok("QDAY: очередь через один: о блюде, из уроков, о блюде…", q && q.sent[0].t === "Меню" && q.queue.length >= 2 && q.queue[0].t !== "Меню" && q.queue[1].t === "Меню", q && [q.sent.map((x) => x.t), q.queue.map((x) => x.t)]);
  await shot(page, "qday-card");
  const wrong = q.sent[0].c === 0 ? 1 : 0;
  await page.locator('[data-qday-opt="' + wrong + '"]').click(); await page.waitForTimeout(1200);
  const t2 = await txt(page.locator("[data-qday-card]").first());
  ok("QDAY: ошибка — «Вопрос ждёт в «Работе над ошибками». Блюдо придёт в разминку.»", /Работе над ошибками»\. Блюдо придёт в разминку\./.test(t2), t2);
  const map = await ls(page, "sa_qday_menu" + UK);
  const k = Object.keys(map || {}).find((x) => map[x] && map[x].r === R0);
  const sr = await ls(page, "sa_menu_sr_" + R0);
  const dishId = (() => { for (const [kk, v] of Object.entries(map || {})) { if (v && sr && sr[v.id] && sr[v.id].m) return v.id; } return null; })();
  ok("QDAY: блюдо из вопроса — к повтору сейчас (с отметкой ошибки)", !!k && !!dishId && sr[dishId].stage === 0, [map, sr]);
  await shot(page, "qday-wrong");
  ok("QDAY: без ошибок", !errs.length, errs);
  await ctx.close();
}

// ═══ RHYTHM ═══
if (want("RHYTHM")) {
  const { ctx, page, errs } = await open({ who: "anna", hour: 11 });
  await until(() => srv(page, () => window.__demo.srv.S.mk.know["e-anna"]), 15000);   // просьбы и «что назвал бот» уже пришли
  await reopen(page, errs, { url: "?go=remind" });
  const box = await until(async () => (await page.locator("[data-dish-rhythm]").count()) ? page.locator("[data-dish-rhythm]") : null, 8000);
  ok("RHYTHM: «Напоминания» → «Блюда в разминке»: каждую смену, 2 блюда", box && (await box.getAttribute("data-dish-rhythm")) === "each" && (await box.getAttribute("data-dish-n")) === "2" && (await page.locator("[data-rhythm]").count()) === 4);
  const ex = await txt(page.locator("[data-remind-dishes]").first());
  ok("RHYTHM: пример сообщения называет два блюда", /и 2 блюда из меню: .+, .+\. Хорошей смены!/.test(ex), ex);
  await shot(page, "rhythm-sheet");
  await page.locator('[data-rhythm="every2"]').click(); await page.locator('[data-rhythm-n="3"]').click(); await page.waitForTimeout(300);
  ok("RHYTHM: «Через смену» и «3 блюда» — на телефоне, пример — три блюда", JSON.stringify(await ls(page, "sa_menu_rhythm" + UK)) === '{"r":"every2","n":3}' && /и 3 блюда из меню/.test(await txt(page.locator("[data-remind-dishes]").first())));
  await page.locator('[data-rhythm="off"]').click(); await page.waitForTimeout(300);
  ok("RHYTHM: «Не нужно» — сколько блюд не спрашиваем, пример без блюд", !(await page.locator("[data-rhythm-n]").count()) && !(await page.locator("[data-remind-dishes]").count()));
  await page.locator('[aria-label="Напоминания"] [data-sa-back]').click(); await page.waitForTimeout(600);
  const nc = await nowCard(page);
  ok("RHYTHM: на главной разминка без блюд", nc && nc.mode === "before" && /3 ситуации · 2 мин/.test(nc.text) && !/блюд/.test(nc.text), nc);
  const w = await until(() => srv(page, () => { const x = window.__demo.srv.S.mk.know["e-anna"]; return x && x.warm && x.warm.r === "off" ? x.warm : null; }), 22000);
  ok("RHYTHM: на сервере ритм «off» (бот блюда не назовёт)", !!w, w);
  await reopen(page, errs, { hour: 14 });
  const nc2 = await until(() => nowCard(page), 8000);
  ok("RHYTHM: «Не нужно» — и в перерыв блюда нет", nc2 && nc2.mode === "during" && !/В перерыв/.test(nc2.text), nc2);
  ok("RHYTHM: без ошибок", !errs.length, errs);
  await ctx.close();
}

// ═══ TEAM ═══
if (want("TEAM")) {
  const { ctx, page, errs } = await open({ who: "maria", hour: 11 });
  await nav(page, "menuTrainer", 2200);
  ok("TEAM: в «Меню» у руководителя «Как команда знает меню»", (await page.locator("[data-menu-know]").count()) === 1);
  await page.locator("[data-menu-know]").click(); await page.waitForTimeout(1500);
  const sum = await txt(page.locator("[data-know-sum]"));
  ok("TEAM: «прислали 4 из 9»", /прислали 4 из 9/.test(sum), sum);
  const rows = await page.locator("[data-know-dish]").evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ")));
  ok("TEAM: слабые блюда — суп и креветка сверху, с подписью «не уверены 2 · знают …»", /^Тыквенный крем-суп с крабом.*не уверены 2 · знают 0 из 4/.test(rows[0] || "") && /^Креветка темпура.*не уверены 2 · знают 1 из 4/.test(rows[1] || ""), rows.slice(0, 3));
  await shot(page, "team-know");
  const M = await menu(page);
  const shrimp = M.find((x) => /Креветка темпура/.test(x.name)), soup = M.find((x) => /Тыквенный/.test(x.name));
  await page.locator('[data-know-warm="' + shrimp.id + '"]').click(); await page.waitForTimeout(700);
  ok("TEAM: «В разминку команде» — «В разминке команды ✓», что сделали — словами", (await txt(page.locator('[data-know-warm="' + shrimp.id + '"]'))) === "В разминке команды ✓" && /придёт в разминку каждому, пока не отметит «Знаю»\. Неделю\./.test(await txt(page.locator("[data-know-msg]"))));
  await page.locator('[data-know-brief="' + soup.id + '"]').click(); await page.waitForTimeout(700);
  const asked = await page.locator("[data-know-asked]").evaluateAll((els) => els.map((e) => e.getAttribute("data-know-asked") + "|" + e.innerText.replace(/\s+/g, " ")));
  ok("TEAM: «Сейчас просите»: в разминке и в фокусе смены, до какого числа, кто", asked.length === 2 && asked.some((a) => a.startsWith("warm:" + shrimp.id) && /в разминке команды до \d+ \S+ · Мария Ким/.test(a)) && asked.some((a) => a.startsWith("brief:" + soup.id) && /в фокусе смены до/.test(a)), asked);
  const ppl = await page.locator("[data-know-person]").evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ")));
  ok("TEAM: «Кто как знает меню»: Пётр знает и не уверен, Анна ещё не повторяла", ppl.some((p) => /Пётр Орлов знает 2 блюда · не уверен: 2/.test(p)) && ppl.some((p) => /Анна Смирнова ещё не повторял/.test(p)), ppl);
  ok("TEAM: кнопки с линзой, без прокрутки вбок", !(await lensMiss(page)).length && (await overflowX(page)) <= 0, await lensMiss(page));
  await shot(page, "team-asked");
  await nav(page, "brief", 3000);
  const fb = await until(async () => (await page.locator('[data-brief-dish="' + soup.id + '"]').count()) ? txt(page.locator('[data-brief-dish="' + soup.id + '"]')) : null, 8000);
  ok("TEAM: брифинг — блюдо в «Фокусе смены»: название, состав, «Меню · не уверены…»", fb && /Блюдо «Тыквенный крем-суп с крабом»/.test(fb) && /Состав:/.test(fb) && /Меню · не уверены 2 · знают 0 из 4/.test(fb), fb);
  await page.locator('[data-brief-dish="' + soup.id + '"]').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, "team-brief");
  await reopen(page, errs, { who: "anna" });
  const nc = await until(() => nowCard(page), 8000);
  ok("TEAM: у Анны разминка с блюдами", nc && nc.mode === "before" && /и 2 блюда/.test(nc.text), nc);
  await openWarm(page);
  await sitsUntilDish(page);
  const d1 = await dishStep(page, true);
  ok("TEAM: первым — просьба руководителя («просит руководитель»)", d1.id === shrimp.id && d1.where === "меню · просит руководитель", d1);
  await reopen(page, errs, { who: "maria" });
  await nav(page, "menuTrainer", 2200);
  await page.locator("[data-menu-know]").click(); await page.waitForTimeout(1500);
  await page.locator('[data-know-off="warm:' + shrimp.id + '"]').click(); await page.waitForTimeout(700);
  ok("TEAM: «Снять» — просьба ушла", !(await page.locator('[data-know-asked="warm:' + shrimp.id + '"]').count()) && /Просьбу сняли/.test(await txt(page.locator("[data-know-msg]"))));
  ok("TEAM: без ошибок", !errs.length, errs);
  await ctx.close();
}

// ═══ NO59 ═══
if (want("NO59")) {
  const { ctx, page, errs } = await open({ who: "anna", hour: 11, no59: true });
  const nc = await until(() => nowCard(page), 8000);
  ok("NO59: без этапа 59 разминка всё равно с блюдами", nc && nc.mode === "before" && /и 2 блюда/.test(nc.text), nc);
  await openWarm(page); await sitsUntilDish(page);
  const d1 = await dishStep(page, true);
  ok("NO59: блюдо в разминке и отметка на телефоне", !!d1.id && ((await ls(page, "sa_menu_sr_" + R0)) || {})[d1.id].stage === 1, d1);
  await reopen(page, errs, { url: "?go=remind" });
  await until(async () => (await page.locator("[data-dish-rhythm]").count()) > 0, 8000);
  ok("NO59: ритм есть, а пример сообщения — без блюд (бот их не назовёт)", (await page.locator("[data-dish-rhythm]").count()) === 1 && !(await page.locator("[data-remind-dishes]").count()));
  await reopen(page, errs, { who: "maria" });
  await nav(page, "menuTrainer", 2200);
  await page.locator("[data-menu-know]").click(); await page.waitForTimeout(1500);
  ok("NO59: у руководителя — «Сводка по меню появится, когда владелец обновит сервер»", /Сводка по меню появится, когда владелец обновит сервер\./.test(await txt(page.locator("[data-know-missing]"))));
  ok("NO59: без ошибок", !errs.length, errs);
  await ctx.close();
}

// ═══ LOOK ═══
if (want("LOOK")) {
  for (const light of [false, true]) {
    const tag = light ? "light" : "dark";
    const { ctx, page, errs } = await open({ who: "anna", hour: 11, width: 320, height: 700, light });
    await openWarm(page); await sitsUntilDish(page);
    await shot(page, "look-" + tag + "-dish-front");
    await page.locator(".tb [data-dish-flip]").click(); await page.waitForTimeout(500);
    await shot(page, "look-" + tag + "-dish-back");
    ok("LOOK " + tag + ": карточка блюда в 320 px — без прокрутки вбок", (await overflowX(page)) <= 0);
    await ctx.close();
    const b = await open({ who: "anna", hour: 14, width: 320, height: 700, light });
    await until(() => nowCard(b.page), 8000);
    await b.page.locator('[data-now-row="dish"]').click(); await b.page.waitForTimeout(500);
    await b.page.locator("[data-break-open]").click(); await b.page.waitForTimeout(400);
    await b.page.locator("[data-break-dish]").scrollIntoViewIfNeeded();
    await shot(b.page, "look-" + tag + "-break");
    const bm = await b.page.evaluate(() => [...document.querySelectorAll("[data-break-dish] button")].filter((e) => ![...e.attributes].some((a) => a.name.startsWith("data-lens"))).map((e) => e.textContent));
    ok("LOOK " + tag + ": перерыв в 320 px — без прокрутки вбок, кнопки с линзой", (await overflowX(b.page)) <= 0 && !bm.length, bm);
    await b.ctx.close();
    const c = await open({ who: "anna", hour: 21, width: 320, height: 700, light });
    await until(() => nowCard(c.page), 8000);
    await c.page.locator('[data-now-row="asked"]').click(); await c.page.waitForTimeout(500);
    await shot(c.page, "look-" + tag + "-asked");
    ok("LOOK " + tag + ": «О каком блюде спросили?» в 320 px", (await overflowX(c.page)) <= 0 && (await c.page.locator("[data-asked-sheet]").count()) === 1);
    await c.ctx.close();
    const m = await open({ who: "maria", hour: 11, width: 320, height: 700, light });
    await nav(m.page, "menuTrainer", 2200);
    await m.page.locator("[data-menu-know]").click(); await m.page.waitForTimeout(1500);
    await shot(m.page, "look-" + tag + "-team");
    ok("LOOK " + tag + ": сводка в 320 px — без прокрутки вбок, кнопки с линзой", (await overflowX(m.page)) <= 0 && !(await lensMiss(m.page)).length, await lensMiss(m.page));
    ok("LOOK " + tag + ": без ошибок", !errs.length && !b.errs.length && !c.errs.length && !m.errs.length, [...errs, ...b.errs, ...c.errs, ...m.errs]);
    await m.ctx.close();
  }
}

await browser.close(); server.close();
console.log("\nитого: " + pass + " ✓, " + fail + " ✗");
process.exit(fail ? 1 : 0);
