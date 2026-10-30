// e2e v74 (Доп. 387): «без примет нейросети» — тексты интерфейса и сообщения бота.
// Разделы:
//   DASH    — на 30 экранах (сотрудник и руководитель, 393 px): на экранах интерфейса видимых строк «слово — слово» почти нет
//             (связки и определения — можно; глоссарий, колода, отзывы и сценарии — содержание, их проход — вместе с уроками),
//             общих мотивационных фраз нет, «не X, а Y» нет; гид — все пункты раскрыты; без прокрутки вбок и ошибок в консоли;
//   WELCOME — приветствие при первом входе: четыре карточки без тире-ритма;
//   REMIND  — «Напоминания в Telegram» (скриншот владельца): нет «/* v58 (Доп. 371) */» на экране, пример — как новое сообщение
//             бота (без «✦ SERVICE ACADEMY» и звёздочек, кнопка «Разминка»), «Включено: за час до смены», подписи без тире;
//   MASTERS — «Путь мастера» без мастеров: «Пока никого. Первым мастером в заведении можешь стать ты» (без «знак ✦»);
//   LIGHT   — то же в светлой теме и на 320 px: без прокрутки вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v74.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5273, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v74";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { SEASONAL_MODULES } = await import(SRC + "/data/modules-seasonal.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));

const R0 = "Два моря, Океан";
const STAFF = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const ADMIN = { id: "u-admin", name: "Роман", surname: "Петров", restaurant: R0, position: "manager", is_admin: true };
const NOW = new Date("2026-10-23T02:20:00Z");   // 23.10, 14:20 по Камчатке
const ymd = (d) => "2026-10-" + String(d).padStart(2, "0");
const doneMap = (...mods) => { const c = {}, q = {}; mods.forEach(m => m.lessons.forEach(l => { if (l.type === "quiz") q[l.id] = true; else if (l.type !== "result") c[l.id] = true; })); return { c, q }; };
const S = (id) => SEASONAL_MODULES.find(m => m.id === id);
const DONE = doneMap(S("s0"), S("s1"));
const TEAM_MENU = [
  { id: "t1", name: "Тартар из гребешка с юдзу", cat: "Закуски", ingredients: ["гребешок", "юдзу", "кунжут"], allergens: ["Моллюски и ракообразные", "Кунжут"] },
  { id: "t2", name: "Чизкейк с солёной карамелью и фундуком", cat: "Десерты", ingredients: ["сливочный сыр", "карамель", "фундук"], allergens: ["Молоко", "Орехи", "Глютен"] },
];
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function open({ who = "staff", light = false, w = 393, h = 852, fs = false, tg = false, role = "seasonal", menu = false, extra = {}, welcome = false } = {}) {
  const prof = who === "admin" ? ADMIN : STAFF;
  const uk = "_" + prof.name + "_" + prof.surname;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 900, hasTouch: w < 900, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const mock = { whoami: { ok: true, employee: prof }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: who === "admin" ? [] : Object.keys(DONE.q), lessons: who === "admin" ? [] : Object.keys(DONE.c), stars: {}, roles: [], last_role: role },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] },
        schedule_load: { ok: false, error: "auth" }, menu_get: menu ? TEAM_MENU : [], ...extra };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: welcome ? "0" : "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(prof), sa_ai_fab: "1", ["sa_last_role" + uk]: JSON.stringify(role), ["sa_ach_pioneer" + uk]: "1" };
  if (who !== "admin") { seed["sa_completed" + uk] = JSON.stringify(DONE.c); seed["sa_quiz_done" + uk] = JSON.stringify(DONE.q); seed["sa_mastery" + uk] = JSON.stringify({ tiers: {}, fw: false, master: {} }); }
  if (menu) seed.sa_menu_shared = JSON.stringify({ [R0]: TEAM_MENU });
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript(([seed, fs, tg, light]) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (!fs && !tg) return;
    const ev = {}, W = { platform: "ios", version: "9.6", initData: "", initDataUnsafe: {}, colorScheme: light ? "light" : "dark", themeParams: {}, isFullscreen: false, isActive: true,
      safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 }, contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
      isVersionAtLeast() { return !!fs; }, onEvent(n, f) { (ev[n] = ev[n] || []).push(f); }, offEvent(n, f) { ev[n] = (ev[n] || []).filter((g) => g !== f); },
      ready() {}, expand() {}, close() {}, setHeaderColor() {}, setBackgroundColor() {}, setBottomBarColor() {}, disableVerticalSwipes() {}, enableVerticalSwipes() {},
      requestFullscreen() { if (W.isFullscreen) return; setTimeout(() => { W.isFullscreen = true; W.safeAreaInset = { top: 62, bottom: 34, left: 0, right: 0 }; W.contentSafeAreaInset = { top: 46, bottom: 0, left: 0, right: 0 };
        ["fullscreenChanged", "safeAreaChanged", "contentSafeAreaChanged"].forEach((n) => (ev[n] || []).forEach((f) => f.call(W))); }, 50); },
      exitFullscreen() { W.isFullscreen = false; W.safeAreaInset = { top: 0, bottom: 0, left: 0, right: 0 }; W.contentSafeAreaInset = { top: 0, bottom: 0, left: 0, right: 0 };
        ["fullscreenChanged", "safeAreaChanged", "contentSafeAreaChanged"].forEach((n) => (ev[n] || []).forEach((f) => f.call(W))); },
      HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} }, BackButton: { isVisible: false, show() {}, hide() {}, onClick() {}, offClick() {} },
      MainButton: { show() {}, hide() {}, setText() {}, onClick() {}, offClick() {}, setParams() {} },
      showAlert(m, cb) { if (cb) cb(); }, showConfirm(m, cb) { if (cb) cb(true); }, openLink() {}, openTelegramLink() {}, requestWriteAccess(cb) { if (cb) cb(false); } };
    window.Telegram = { WebApp: W };
  }, [seed, fs, tg, light]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}
const nav = async (page, to, wait = 1500) => { await page.evaluate((to) => window.__saNav(to), to); await sleep(wait); };
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const noSide = (p) => p.evaluate(() => { const r = document.getElementById("root"); return document.documentElement.scrollWidth <= innerWidth + 1 && (!r || r.scrollWidth <= r.clientWidth + 1); });

const SCREENS = ["roleSelect", "shift", "teamHub", "me", "home", "reference", "glossary", "menuTrainer", "cocktails", "guestbook", "mastery", "cellar",
  "stats", "league", "leaderboard", "mentor", "search", "daily", "checklist", "onboarding", "guide", "offline", "mistakes", "certificates",
  "weeklyGuest", "analytics", "team", "candidate", "contentEditor", "profile"];
// экраны с учебным содержанием (термины глоссария, истории коктейлей, отзывы гостей, сценарии) — отдельный проход вместе с уроками
const CONTENT = new Set(["glossary", "cocktails", "reference", "guestbook", "weeklyGuest"]);
const GENERIC = ["маленькие шаги", "большой результат", "учишься в моменте", "только начало пути", "самое время", "впереди большее", "всё изменит", "твой компас", "твой спортзал"];
// видимые строки «слово — слово» (тире с пробелами); девиз и подписи «— Гость, …» — можно
const dashLines = (p) => p.evaluate(() => {
  const out = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    const t = n.textContent.replace(/\s+/g, " ").trim(); if (!t || !/[А-Яа-яЁё»)]\s—\s[А-Яа-яЁё«]/.test(t)) continue;
    const el = n.parentElement; if (!el) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight * 3 || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
    if (/^«Сервис — это забота»$/.test(t)) continue;
    out.push(t.slice(0, 90));
  }
  return [...new Set(out)];
});
const visText = (p) => p.evaluate(() => document.body.innerText);

if (want("DASH")) {
  for (const who of ["staff", "admin"]) {
    const o = await open({ who, w: 393, h: 852 });
    const found = {}, side = [], gen = {}, nea = {};
    for (const s of SCREENS) {
      await nav(o.page, s);
      if (["roleSelect", "shift", "me", "guide", "league"].includes(s)) await shot(o.page, who + "-" + s);
      const d = CONTENT.has(s) ? [] : await dashLines(o.page); if (d.length) found[s] = d;
      const t = await visText(o.page);
      const g = GENERIC.filter((x) => t.toLowerCase().includes(x)); if (g.length) gen[s] = g;
      const ne = CONTENT.has(s) ? null : t.match(/,\s*а не\s[^.\n]{0,40}|\bне\s[^,.;:!?«»\n]{1,40},\s*а\s[^.\n]{0,30}/g); if (ne) nea[s] = ne.slice(0, 3);
      if (!(await noSide(o.page))) side.push(s);
    }
    const lines = Object.values(found).flat();
    ok("DASH " + who + ": на " + (SCREENS.length - [...CONTENT].filter((c) => SCREENS.includes(c)).length) + " экранах интерфейса строк «слово — слово» не больше 3 (связки и определения)", lines.length <= 3, JSON.stringify(found).slice(0, 900));
    ok("DASH " + who + ": общих мотивационных фраз нет", !Object.keys(gen).length, JSON.stringify(gen));
    ok("DASH " + who + ": «не X, а Y» на экранах нет", !Object.keys(nea).length, JSON.stringify(nea).slice(0, 500));
    ok("DASH " + who + ": без прокрутки вбок", !side.length, side.join(", "));
    ok("DASH " + who + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    // гид: все пункты раскрыты — тире только в связках
    await nav(o.page, "guide");
    // пункты раскрываются по одному: открыть каждый и прочитать объяснение
    const nItems = await o.page.evaluate(() => document.querySelectorAll(".sa-screen [aria-expanded]").length);
    const texts = [];
    for (let i = 0; i < nItems; i++) {
      const t = await o.page.evaluate((i) => { const el = document.querySelectorAll(".sa-screen [aria-expanded]")[i]; if (!el) return ""; el.click(); return ""; }, i);
      await sleep(120);
      texts.push(await o.page.evaluate((i) => { const el = document.querySelectorAll(".sa-screen [aria-expanded]")[i]; const box = el && el.nextElementSibling; return box ? box.innerText : ""; }, i));
    }
    const gd = texts.filter((t) => /[А-Яа-яЁё»)]\s—\s[А-Яа-яЁё«]/.test(t));
    ok("DASH " + who + ": гид — все " + nItems + " пунктов раскрыты, тире между словами — не больше чем в 10", nItems >= 40 && texts.filter(Boolean).length === nItems && gd.length <= 10,
      nItems + " пунктов, с тире " + gd.length + ": " + gd.map((t) => (t.match(/.{0,40}\s—\s.{0,30}/) || [""])[0]).slice(0, 5).join(" | "));
    await o.ctx.close();
  }
}

if (want("WELCOME")) {
  const o = await open({ welcome: true });
  const cards = [];
  for (let i = 0; i < 4; i++) {
    const c = await o.page.evaluate(() => { const el = document.querySelector(".sa-cardpage-r, .sa-cardpage-l"); return el ? el.innerText.replace(/\s+/g, " ").trim() : null; });
    cards.push(c);
    if (i === 0) await shot(o.page, "welcome-1");
    const moved = await o.page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /^(Дальше|Далее)/.test(x.textContent.trim())); if (b) { b.click(); return true; } return false; });
    if (!moved) break;
    await sleep(700);
  }
  ok("WELCOME: четыре карточки", cards.filter(Boolean).length === 4, cards.map((c) => (c || "").slice(0, 30)).join(" | "));
  ok("WELCOME: первая — «Учусь»: уроки…, без тире-ритма", !!cards[0] && cards[0].includes("«Учусь»: уроки и тесты твоей роли.") && !/Учусь — /.test(cards[0]), (cards[0] || "").slice(0, 160));
  ok("WELCOME: в карточках нет «слово — слово»", cards.every((c) => !c || !/[А-Яа-яЁё»)]\s—\s[А-Яа-яЁё«]/.test(c)), cards.join(" || ").slice(0, 400));
  ok("WELCOME: «Наставник» — «открывает Наставника», без «учишься в моменте»", cards.join(" ").includes("открывает Наставника") && !cards.join(" ").includes("в моменте"));
  await o.ctx.close();
}

if (want("REMIND")) {
  const extra = { tg_status: { ok: true, bot: true, linked: true, remind: true, minutes: 60 }, notify_prefs: { ok: true, pair: true, quest: true, league: true, fresh: true, month: true, master: true } };
  for (const light of [false, true]) {
    const o = await open({ light, tg: true, extra });
    await nav(o.page, "shift");
    const clicked = await o.page.evaluate(() => { const el = [...document.querySelectorAll("[role=button], button")].find((x) => /Напоминания в Telegram/.test(x.textContent)); if (el) { el.click(); return true; } return false; });
    await sleep(1200);
    const tag = light ? "REMIND LIGHT" : "REMIND";
    ok(tag + ": окно открылось из «Смены»", clicked);
    const sheet = await o.page.evaluate(() => { const d = document.querySelector('[role=dialog][aria-label="Напоминания в Telegram"]'); return d ? d.innerText : null; });
    if (!light) await shot(o.page, "remind-sheet");
    ok(tag + ": служебной пометки «/* v58 (Доп. 371) */» на экране нет", !!sheet && !sheet.includes("/*") && !sheet.includes("Доп. 371"), (sheet || "").slice(0, 200));
    ok(tag + ": пример — без «✦ SERVICE ACADEMY» и звёздочек", !!sheet && !sheet.includes("SERVICE ACADEMY") && !sheet.includes("✦"));
    ok(tag + ": пример — «Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!» и кнопка «Разминка»",
      !!sheet && sheet.includes("Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!") && /\nРазминка\n/.test("\n" + sheet + "\n"));
    ok(tag + ": «✓ Включено: за час до смены», «итоги недели по понедельникам», «а ты ещё нет»",
      !!sheet && sheet.includes("Включено: за час до смены") && sheet.includes("итоги недели по понедельникам") && sheet.includes("а ты ещё нет"));
    ok(tag + ": в окне нет «слово — слово»", !!sheet && !/[А-Яа-яЁё»)]\s—\s[А-Яа-яЁё«]/.test(sheet), (sheet || "").match(/.{0,30}\s—\s.{0,30}/g)?.slice(0, 3).join(" | ") || "");
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("MASTERS")) {
  const o = await open({ extra: { mastery_list: { ok: true, rows: [], prize: null, can_prize: false } } });
  await nav(o.page, "mastery", 1800);
  const t = await visText(o.page);
  await o.page.evaluate(() => { const b = document.querySelector("[data-ms-masters]"); if (b) b.scrollIntoView({ block: "center" }); });
  await sleep(400);
  await shot(o.page, "mastery-masters");
  ok("MASTERS: «Пока никого. Первым мастером в заведении можешь стать ты»", t.includes("Пока никого. Первым мастером в заведении можешь стать ты"), t.match(/Мастера заведения[\s\S]{0,120}/)?.[0] || "");
  ok("MASTERS: «Первый знак ✦» больше нет", !t.includes("Первый знак"));
  await o.ctx.close();
}

if (want("LIGHT")) {
  for (const [w, light] of [[393, true], [320, false]]) {
    const o = await open({ light, w });
    const side = [];
    for (const s of ["roleSelect", "shift", "teamHub", "me", "guide", "league", "mastery", "offline"]) { await nav(o.page, s); if (!(await noSide(o.page))) side.push(s); }
    ok("LIGHT " + (light ? "светлая " : "") + w + ": без прокрутки вбок", !side.length, side.join(", "));
    ok("LIGHT " + (light ? "светлая " : "") + w + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
