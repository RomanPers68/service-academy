// e2e v172 (Доп. 497): «Бар» — в ленте главной, рядом с «Меню»; в «Справочнике» остаются основы. В браузере, на демо целиком
// (tools/claude/demo-app/build.mjs).
//   HOME  — владелец (телефон 402 px): шесть значков, «Бар» сразу за «Меню», подписи ездят, ряд не вылезает; значок открывает
//           «Барную карту» (в шапке заведение, а не «Справочник»), «назад» — на главную, вкладка запоминается; сотрудник —
//           пять значков, кружки прежние; 360 и 320 px, светлая тема, 1280 px;
//   REF   — в «Справочнике» карточки «Барная карта» нет, четвёртым раздел «Бар: Основы» с витражом: шесть глав, глава читается;
//   DECK  — в «Колоде бармена» нет «Основы ›»; путь главная → «Бар» → «Колода» и обратно;
//   EDIT  — редактор справочника: «Бар: Основы» в общем списке, со стрелками, блока «Отдельно» нет; перестановка видна команде;
//   COVER — обложка, поставленная прежней «Барной карте», стоит на карточке «Бар: Основы».
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_ONLY="HOME"] node e2e-v172.mjs
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5672, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v172";
const ONLY = (process.env.E2E_ONLY || "").split(/\s+/).filter(Boolean);
const on = (name) => !ONLY.length || ONLY.includes(name);
mkdirSync(OUT, { recursive: true });
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
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 900) : "")); } };
const same = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const browser = await chromium.launch();

async function ready(page, errs) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.evaluate(() => { if (window.__e2eTidy) return; window.__e2eTidy = setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    document.querySelectorAll("[data-badge-new] [data-lens-x], [data-shelf-new] button[aria-label='Закрыть']").forEach((x) => x.click());
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" }).catch(() => {});
  await page.waitForTimeout(1100);
}
async function open({ who = "roman", light = false, width = 440, height = 956, flags = {} } = {}) {
  const mobile = width < 900;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 200)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, f]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__demo_who", w); for (const [k, v] of Object.entries(f)) localStorage.setItem(k, v); }, [who, flags]);
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1100); }
  return { ctx, page, errs };
}
// другой человек в той же вкладке: сервер демо (и правки справочника в нём) остаётся
async function switchTo(page, errs, who) {
  await page.evaluate((w) => { window.__demo.save(); localStorage.setItem("__demo_who", w); localStorage.removeItem("__demo_me"); }, who);
  await page.goto(URL0 + "#" + who, { waitUntil: "load" });
  await page.reload({ waitUntil: "load" });
  await ready(page, errs);
}
const shot = async (page, n) => { await page.waitForTimeout(300); await page.screenshot({ path: OUT + "/" + n + ".png" }).catch(() => {}); };
const tap = async (page, sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(320); };
const nav = async (page, screen, sel) => { await page.evaluate((s) => window.__saNav(s), screen); if (sel) await page.waitForSelector(sel, { timeout: 15000 }); await page.waitForTimeout(350); };
const attrs = (page, a) => page.evaluate((x) => [...document.querySelectorAll("[" + x + "]")].map((el) => el.getAttribute(x)), a);
const has = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const txt = (page, sel = "#root") => page.evaluate((s) => { const el = document.querySelector(s); return el ? el.innerText.replace(/\s+/g, " ") : ""; }, sel);
const rows = (page) => page.evaluate(() => Object.values(window.__demo.srv.S.rb.items).map((x) => [x.id, x.kind, x.parent, x.title, x.hidden, x.sort]));
const photosOnServer = (page) => page.evaluate(() => Object.entries(window.__demo.srv.S.lp).filter(([, v]) => v).map(([k]) => k));
const blur = (page) => page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
// выделить строки текста главы с номера a по номер b (с нуля)
const selLines = (page, a, b) => page.evaluate(([x, y]) => { const t = document.querySelector("[data-re-ch-body]"); const ls = t.value.split("\n"); let s = 0; for (let i = 0; i < x; i++) s += ls[i].length + 1;
  let e = s; for (let i = x; i <= y; i++) e += ls[i].length + (i < y ? 1 : 0); t.focus(); t.setSelectionRange(s, e); }, [a, b]);
const seedBook = (page, items) => page.evaluate((it) => { const r = window.__demo.srv.rpc("ref_book_save", { p_token: "demo-u-roman", p_items: it, p_del: [] }); window.__demo.save(); return r; }, items);
const R = (id, kind, more = {}) => ({ id, kind, parent: "", title: null, sub: null, body: null, hidden: false, sort: null, ...more });
// ничего не вылезает за край и шрифт не мельче 10.5 px
const look = (page) => page.evaluate(() => {
  const root = document.querySelector("[data-re-screen]") || document.getElementById("root");
  const vw = document.documentElement.clientWidth;
  let small = null, wide = null;
  for (const el of root.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.right > vw + 1 && !wide) wide = el.tagName + " " + Math.round(r.right) + " > " + vw + " " + (el.textContent || "").slice(0, 40);
    if (el.closest("svg")) continue;   // буквы внутри значка (знак «AI») — рисунок, а не текст
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) { const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 10.5 && !small) small = fs + "px «" + el.textContent.trim().slice(0, 40) + "»"; }
  }
  return { small, wide, scroll: document.documentElement.scrollWidth <= vw + 1 };
});
// картинка для загрузки: рисуем в странице, отдаём файлом
async function photoFile(page, name) {
  const b64 = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 1200; c.height = 800; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 1200, 800);
    g.addColorStop(0, "#3a2a14"); g.addColorStop(1, "#c8a96e"); x.fillStyle = g; x.fillRect(0, 0, 1200, 800); x.fillStyle = "#fff"; x.font = "80px serif"; x.fillText("Зал утром", 380, 420); return c.toDataURL("image/jpeg", 0.9).split(",")[1]; });
  const p = join(tmpdir(), name);
  writeFileSync(p, Buffer.from(b64, "base64"));
  return p;
}
const BASE_CARDS = ["serving", "wine", "coffee", "bar"];   // v172 (Доп. 497): четвёртым — «Бар: Основы» (была карточка «Барная карта»)
// «Команда»: группа «Управление» свёрнута кнопкой — раскрыть и вернуть подписи её строк
async function management(page) {
  await nav(page, "teamHub", "[data-hub-group]");
  if (await has(page, "[data-hub-group='Управление'][data-hub-open='0']")) await tap(page, "[data-hub-toggle='Управление']");
  await page.waitForTimeout(350);
  return txt(page, "[data-hub-group='Управление']");
}

const seenBy = (page) => page.evaluate(() => [...document.querySelectorAll("[data-ref-chapter]")].map((el) => el.getAttribute("aria-label")));
// лента инструментов главной: подписи значков по порядку, размер кружка, ездят ли подписи, не вылезает ли ряд и капсула
const dock = (page) => page.evaluate(() => {
  const row = document.querySelector("[data-tools-row]"); if (!row) return null;
  const cap = document.querySelector("[data-tools-capsule]").getBoundingClientRect(), vw = document.documentElement.clientWidth;
  return { titles: [...row.children].map((c) => c.getAttribute("title")), ring: Number(row.getAttribute("data-tools-ring")), labels: row.getAttribute("data-tools-labels"), over: row.scrollWidth - row.clientWidth, in: cap.left >= 0 && cap.right <= vw + 0.5 };
});
const home = async (page) => { await nav(page, "roleSelect", "[data-tools-row]"); await page.waitForTimeout(900); };
const openLabel = (page) => page.evaluate(() => { const r = document.querySelector("[data-tools-row]"); const c = r && [...r.children].find((x) => x.getBoundingClientRect().width > 50); return c ? c.getAttribute("title") : null; });
// подпись ездит по очереди раз в четыре секунды: какие раскрылись и вылезал ли ряд хоть при одной
async function labelsSeen(page, n, shotAt = null) {
  const seen = new Set(); let worst = -99;
  for (let k = 0; k < n + 2 && seen.size < n; k++) {
    const d = await dock(page), on = await openLabel(page); worst = Math.max(worst, d ? d.over : 99);
    if (on && !seen.has(on)) { seen.add(on); if (shotAt && on === shotAt[0]) await shot(page, shotAt[1]); }
    await page.waitForTimeout(4000);
  }
  return { seen: [...seen], worst };
}
const tapTool = async (page, title) => { await page.locator('[data-tools-row] [title="' + title + '"]').click(); await page.waitForTimeout(500); };
const barOpen = (page) => page.waitForSelector("[data-bar-cocktails], [data-wine-list]", { timeout: 15000 }).then(() => true).catch(() => false);
// шапка «Барной карты»: строка над названием и само название
const barHead = (page) => page.evaluate(() => { const b = document.querySelector('[data-bar-cocktails] [data-lens="back"], [data-wine-list] [data-lens="back"]'); const d = b && b.nextElementSibling; return d ? [...d.children].slice(0, 2).map((x) => x.textContent.trim()) : null; });
const backBtn = async (page) => { await page.evaluate(() => { const b = document.querySelector('[data-bar-cocktails] [data-lens="back"], [data-wine-list] [data-lens="back"], [data-lens="back"]'); if (b) b.click(); }); await page.waitForTimeout(700); };
// подсказка первого входа в «Барную карту» (в демо она не закрыта заранее) перехватывает касания — отмечаем её виденной
const skipHints = (page) => page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^sa_hint_v\d+_/.test(x)); if (k) localStorage.setItem(k.replace(/^(sa_hint_v\d+_).*/, "$1") + "barCard", "1"); });

// ── HOME ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("HOME")) {
  {
    const { ctx, page, errs } = await open({ who: "roman", width: 402, height: 874 });
    await home(page);
    const d = await dock(page);
    same("HOME: у владельца шесть значков, «Бар» сразу за «Меню»", d && d.titles, ["Справочник", "Меню", "Бар", "Глоссарий", "Чек-листы", "AI-интервью"]);
    ok("HOME: на телефоне 402 px подписи ездят, кружки 30 px, ряд и капсула не вылезают", !!d && d.labels === "on" && d.ring === 30 && d.over <= 0 && d.in, d);
    const tint = await page.evaluate(() => { const disc = document.querySelector('[data-tools-row] [title="Бар"] [data-tool-disc]'); return disc ? getComputedStyle(disc).getPropertyValue("--tint").trim() : ""; });
    ok("HOME: у «Бара» свой цвет — медь трека «Бар»; значок — бокал", /^#D2875A55$/i.test(tint) && (await page.locator('[data-tools-row] [title="Бар"] svg path').count()) === 4, tint);
    await page.locator("[data-tools-capsule]").scrollIntoViewIfNeeded();
    const ls = await labelsSeen(page, 6, ["Бар", "home-owner-bar"]);
    ok("HOME: раскрываются все шесть подписей по очереди, и «Бар» тоже; ряд не вылезает ни при одной", ls.seen.length === 6 && ls.seen.includes("Бар") && ls.seen.includes("AI-интервью") && ls.worst <= 0, ls);
    // значок открывает «Барную карту»
    await skipHints(page);
    await tapTool(page, "Бар");
    ok("HOME: значок «Бар» открывает «Барную карту»", await barOpen(page));
    const hd = await barHead(page);
    ok("HOME: в шапке карты над названием — заведение, слова «Справочник» нет", !!hd && hd[1] === "Барная карта" && hd[0] === "Два моря, Океан" && !/Справочник/.test(hd.join(" ")), hd);
    await shot(page, "bar-card");
    // вкладку карта помнит сама: ушёл на «Вина», вернулся на главную, открыл снова
    await page.evaluate(() => { const b = document.querySelector('[data-bar-tab="wine"]'); if (b) b.click(); }); await page.waitForTimeout(700);
    ok("HOME: вкладка «Вина» открыта", (await page.evaluate(() => { const b = document.querySelector('[data-bar-tab="wine"]'); return b && b.getAttribute("aria-selected"); })) === "true");
    await backBtn(page);
    ok("HOME: «назад» из карты — на главную", (await has(page, "[data-tools-row]")) && !(await has(page, "[data-bar-cocktails], [data-wine-list]")));
    await tapTool(page, "Бар");
    await barOpen(page);
    ok("HOME: карта открылась там, где был: на «Винах»", (await page.evaluate(() => { const b = document.querySelector('[data-bar-tab="wine"]'); return b && b.getAttribute("aria-selected"); })) === "true");
    await backBtn(page);
    ok("HOME: и снова «назад» — на главную", await has(page, "[data-tools-row]"));
    same("HOME: владелец — ошибок на странице нет", errs, []);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await open({ who: "anna", width: 402, height: 874 });
    await home(page);
    const d = await dock(page);
    same("HOME: у сотрудника пять значков, «Бар» за «Меню»", d && d.titles, ["Справочник", "Меню", "Бар", "Глоссарий", "Чек-листы"]);
    ok("HOME: у сотрудника кружки прежние, 36 px, подписи ездят", !!d && d.ring === 36 && d.labels === "on" && d.over <= 0 && d.in, d);
    await page.locator("[data-tools-capsule]").scrollIntoViewIfNeeded();
    await shot(page, "home-staff");
    await skipHints(page);
    await tapTool(page, "Бар");
    ok("HOME: у сотрудника значок открывает «Барную карту»", await barOpen(page));
    await backBtn(page);
    ok("HOME: сотрудник — «назад» на главную", await has(page, "[data-tools-row]"));
    same("HOME: сотрудник — ошибок на странице нет", errs, []);
    await ctx.close();
  }
  {
    // Ксения в демо — второй день в команде, первый урок у неё уже пройден: лента полная, с «Баром». Правило «новичку до
    // первого урока — только справочник и SOS» проверяет юнит-тест (tests/v172.test.js)
    const { ctx, page, errs } = await open({ who: "ksenia", width: 402, height: 874 });
    await home(page);
    const d = await dock(page);
    same("HOME: у новенькой после первого урока лента полная, с «Баром»", d && d.titles, ["Справочник", "Меню", "Бар", "Глоссарий", "Чек-листы"]);
    same("HOME: новенькая — ошибок на странице нет", errs, []);
    await ctx.close();
  }
  for (const [w, hh, ring] of [[360, 780, 34], [320, 640, null]]) {
    const { ctx, page, errs } = await open({ who: "roman", width: w, height: hh });
    await home(page);
    const d = await dock(page);
    ok("HOME: владелец на " + w + " px — шесть значков без подписей, ряд и капсула не вылезают", !!d && d.titles.length === 6 && d.labels === "off" && (ring ? d.ring === ring : d.ring >= 26) && d.over <= 0 && d.in, d);
    const fit = await page.evaluate(() => { const r = document.querySelector("[data-tools-row]").getBoundingClientRect(); return [...document.querySelectorAll("[data-tools-row] [data-tool-disc]")].every((x) => { const b = x.getBoundingClientRect(); return b.left >= r.left - 0.5 && b.right <= r.right + 0.5; }); });
    ok("HOME: на " + w + " px все шесть кружков целиком в ряду", fit);
    if (w === 360) { await page.locator("[data-tools-capsule]").scrollIntoViewIfNeeded(); await shot(page, "home-owner-360"); }
    same("HOME: " + w + " px — ошибок на странице нет", errs, []);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await open({ who: "roman", width: 402, height: 874, light: true });
    await home(page);
    const d = await dock(page);
    ok("HOME: светлая тема — те же шесть значков, ряд не вылезает", !!d && d.titles.length === 6 && d.over <= 0 && d.in, d);
    const tint = await page.evaluate(() => { const disc = document.querySelector('[data-tools-row] [title="Бар"] [data-tool-disc]'); return disc ? getComputedStyle(disc).getPropertyValue("--tint").trim() : ""; });
    ok("HOME: светлая тема — у «Бара» тёмная медь, как у трека «Бар»", /^#93500F55$/i.test(tint), tint);
    await page.locator("[data-tools-capsule]").scrollIntoViewIfNeeded();
    await shot(page, "home-owner-light");
    same("HOME: светлая тема — ошибок на странице нет", errs, []);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await open({ who: "roman", width: 1280, height: 900 });
    await home(page);
    const d = await dock(page);
    ok("HOME: широкий экран — шесть значков, ряд не вылезает", !!d && d.titles.join() === "Справочник,Меню,Бар,Глоссарий,Чек-листы,AI-интервью" && d.over <= 0, d);
    await tapTool(page, "Бар");
    ok("HOME: широкий экран — значок открывает «Барную карту»", await barOpen(page));
    await shot(page, "bar-card-1280");
    same("HOME: широкий экран — ошибок на странице нет", errs, []);
    await ctx.close();
  }
}

// ── REF ────────────────────────────────────────────────────────────────────────────────────────────────
if (on("REF")) {
  const { ctx, page, errs } = await open({ who: "anna", width: 402, height: 874 });
  await nav(page, "reference", "[data-ref-card]");
  same("REF: в справочнике четыре раздела: «Сервировка», «Вина», «Кофе», «Бар: Основы»", await attrs(page, "data-ref-card"), ["serving", "wine", "coffee", "bar"]);
  const card = await txt(page, "[data-ref-card='bar']"), all = await txt(page);
  ok("REF: карточка «Бар: Основы», шесть глав; «Барной карты» в справочнике нет", /^Бар: Основы 6 глав/.test(card) && !/Барная карта/.test(all), card);
  ok("REF: у «Бар: Основы» витраж с бокалом, обложка — рисунок", (await page.locator("[data-ref-card='bar'] [data-ref-art='cocktails'] svg").count()) === 1 && (await page.getAttribute("[data-ref-card='bar']", "data-ref-cover")) === "art");
  const hs = await page.evaluate(() => [...document.querySelectorAll("[data-ref-card]")].map((c) => Math.round(c.getBoundingClientRect().height)));
  ok("REF: карточки одной высоты", new Set(hs).size === 1, hs);
  await page.locator("[data-ref-card='bar']").scrollIntoViewIfNeeded();
  await shot(page, "ref-hub");
  await tap(page, "[data-ref-card='bar']");
  await page.waitForSelector("[data-ref-chapter]", { timeout: 10000 });
  const chs = await seenBy(page);
  ok("REF: в разделе шесть глав, первая — «Классика как язык бара»", chs.length === 6 && chs[0] === "Классика как язык бара", chs);
  ok("REF: над главами название раздела «Бар: Основы»", /Бар: Основы/.test(await txt(page)));
  await shot(page, "ref-bar-course");
  await tap(page, "[data-ref-chapter='brc-canon']");
  await page.waitForTimeout(600);
  ok("REF: глава открывается и читается", /Классический коктейль — это рецепт, который пережил моду/.test(await txt(page)));
  same("REF: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── DECK ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("DECK")) {
  {
    const { ctx, page, errs } = await open({ who: "roman", width: 402, height: 874 });
    await home(page);
    await skipHints(page);
    await tapTool(page, "Бар");
    await barOpen(page);
    await page.evaluate(() => { const b = document.querySelector('[data-bar-tab="cocktail"]'); if (b) b.click(); }); await page.waitForTimeout(600);
    await page.locator("[data-bar-learn='deck']").first().scrollIntoViewIfNeeded();
    await page.locator("[data-bar-learn='deck']").first().click();
    await page.waitForFunction(() => /Колода бармена/.test(document.getElementById("root").innerText), null, { timeout: 15000 }).catch(() => {});
    await skipHints(page);
    const t = await txt(page);
    ok("DECK: главная → «Бар» → «Колода»: открыта «Колода бармена»", /Колода бармена/.test(t), t.slice(0, 200));
    ok("DECK: у владельца в шапке «Свои ›» и «Сборка ›», а «Основы ›» больше нет", /Свои ›/.test(t) && /Сборка ›/.test(t) && !/Основы ›/.test(t), t.slice(0, 300));
    await shot(page, "deck");
    await page.evaluate(() => { const b = document.querySelector('[data-lens="back"]'); if (b) b.click(); }); await page.waitForTimeout(900);
    ok("DECK: «назад» из колоды — в «Барную карту»", await has(page, "[data-bar-cocktails], [data-wine-list]"));
    await backBtn(page);
    ok("DECK: и ещё раз «назад» — на главную", (await has(page, "[data-tools-row]")) && !(await has(page, "[data-bar-cocktails], [data-wine-list]")));
    same("DECK: владелец — ошибок на странице нет", errs, []);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await open({ who: "anna", width: 402, height: 874 });
    await nav(page, "cocktails");
    await page.waitForFunction(() => /Колода бармена/.test(document.getElementById("root").innerText), null, { timeout: 15000 }).catch(() => {});
    await skipHints(page);
    const t = await txt(page);
    ok("DECK: у сотрудника «Сборка ›» есть, «Своих ›» и «Основ ›» нет", /Колода бармена/.test(t) && /Сборка ›/.test(t) && !/Свои ›/.test(t) && !/Основы ›/.test(t), t.slice(0, 300));
    same("DECK: сотрудник — ошибок на странице нет", errs, []);
    await ctx.close();
  }
}

// ── EDIT ───────────────────────────────────────────────────────────────────────────────────────────────
if (on("EDIT")) {
  const { ctx, page, errs } = await open({ who: "roman", width: 402, height: 874 });
  await nav(page, "refEditor", "[data-re-screen='list']");
  same("EDIT: в редакторе «Бар: Основы» — в общем списке разделов", await attrs(page, "data-re-sec"), ["serving", "wine", "coffee", "bar"]);
  const t = await txt(page);
  ok("EDIT: раздел называется «Бар: Основы», блока «Отдельно» нет, разделов четыре", /Бар: Основы/.test(t) && !/Отдельно/.test(t) && !/из колоды бармена/.test(t) && /4 раздела/.test(t), t.slice(0, 400));
  ok("EDIT: у «Бар: Основы» есть стрелки; он последний — «ниже» не нажимается", await page.evaluate(() => { const up = document.querySelector("[data-re-sec='bar'] [data-re-up]"), dn = document.querySelector("[data-re-sec='bar'] [data-re-down]"); return !!up && !!dn && !up.disabled && dn.disabled; }));
  await shot(page, "edit-list");
  await page.locator("[data-re-sec='bar'] [data-re-up]").click(); await page.waitForTimeout(500);
  same("EDIT: «Бар: Основы» поднят выше «Кофе»", await attrs(page, "data-re-sec"), ["serving", "wine", "bar", "coffee"]);
  await tap(page, "[data-re-sec='bar']");
  await page.waitForSelector("[data-re-screen='sec']");
  ok("EDIT: в разделе шесть глав и кнопка «Обложка раздела»", (await attrs(page, "data-re-ch")).length === 6 && (await has(page, "[data-re-sec-cover]")) && /Обложка раздела/.test(await txt(page, "[data-re-sec-cover]")), await attrs(page, "data-re-ch"));
  ok("EDIT: в поле названия — «Бар: Основы»", (await page.inputValue("[data-re-sec-title]")) === "Бар: Основы");
  await switchTo(page, errs, "anna");
  await nav(page, "reference", "[data-ref-card]");
  same("EDIT: у сотрудника разделы в новом порядке", await attrs(page, "data-ref-card"), ["serving", "wine", "bar", "coffee"]);
  same("EDIT: ошибок на странице нет", errs, []);
  await ctx.close();
}

// ── COVER ──────────────────────────────────────────────────────────────────────────────────────────────
// владелец когда-то поставил обложку карточке «Барная карта» (номер ref:barcard); карточки больше нет — фото достаётся «Бар: Основы»
const seedCover = (page, lesson) => page.evaluate((id) => {
  const c = document.createElement("canvas"); c.width = 900; c.height = 600; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 900, 600);
  g.addColorStop(0, "#3a2a14"); g.addColorStop(1, "#c8a96e"); x.fillStyle = g; x.fillRect(0, 0, 900, 600); x.fillStyle = "#fff"; x.font = "70px serif"; x.fillText("Наш бар", 300, 320);
  const full = c.toDataURL("image/jpeg", 0.85).split(",")[1]; const s = document.createElement("canvas"); s.width = 300; s.height = 200; s.getContext("2d").drawImage(c, 0, 0, 300, 200);
  const r = window.__demo.srv.rpc("lesson_photo_set", { p_token: "demo-u-roman", p_lesson: id, p_scope: "", p_full: full, p_thumb: s.toDataURL("image/jpeg", 0.7).split(",")[1], p_w: 900, p_h: 600 });
  window.__demo.save(); return r && r.ok;
}, lesson);
if (on("COVER")) {
  const { ctx, page, errs } = await open({ who: "roman", width: 402, height: 874 });
  ok("COVER: прежняя обложка «Барной карты» лежит на сервере", await seedCover(page, "ref:barcard"));
  await switchTo(page, errs, "anna");
  await nav(page, "reference", "[data-ref-card]");
  const own = await page.waitForFunction(() => { const c = document.querySelector("[data-ref-card='bar']"); return !!c && c.getAttribute("data-ref-cover") === "own"; }, null, { timeout: 12000 }).then(() => true).catch(() => false);
  ok("COVER: у сотрудника на карточке «Бар: Основы» — фото прежней «Барной карты»", own && (await page.evaluate(() => { const i = document.querySelector("[data-ref-card='bar'] [data-ref-photo]"); return !!i && i.complete && i.naturalWidth > 0; })), await page.getAttribute("[data-ref-card='bar']", "data-ref-cover"));
  await page.locator("[data-ref-card='bar']").scrollIntoViewIfNeeded();
  await shot(page, "cover-legacy");
  await switchTo(page, errs, "roman");
  await nav(page, "reference", "[data-ref-card]");
  ok("COVER: фотоаппарат владельца на карточке правит это же фото", (await has(page, "[data-cover-edit='ref:barcard']")) && !(await has(page, "[data-cover-edit='ref:bar']")));
  await nav(page, "refEditor", "[data-re-screen='list']");
  await tap(page, "[data-re-sec='bar']");
  await page.waitForSelector("[data-re-screen='sec']");
  ok("COVER: в редакторе у раздела — «Сменить обложку»", /Сменить обложку/.test(await txt(page, "[data-re-sec-cover]")), await txt(page, "[data-re-sec-cover]"));
  // владелец поставил разделу свою обложку — встала она
  ok("COVER: своя обложка раздела записана", await seedCover(page, "ref:bar"));
  await switchTo(page, errs, "roman");
  await nav(page, "reference", "[data-ref-card]");
  await page.waitForFunction(() => { const c = document.querySelector("[data-ref-card='bar']"); return !!c && c.getAttribute("data-ref-cover") === "own"; }, null, { timeout: 12000 }).catch(() => {});
  ok("COVER: теперь фотоаппарат правит обложку самого раздела", (await has(page, "[data-cover-edit='ref:bar']")) && !(await has(page, "[data-cover-edit='ref:barcard']")));
  same("COVER: ошибок на странице нет", errs, []);
  await ctx.close();
}

await browser.close();
server.close();
console.log("\nитог: " + pass + " ✓, " + fail + " ✗");
process.exit(fail ? 1 : 0);
