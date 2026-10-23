// e2e v73 (Доп. 386): «без примет нейросети» — шрифт и украшения.
// Владелец: «мы можем сделать так, чтобы это не выглядело нейрослопом?» → подписи-метки курсивом с засечками в обычном
// регистре вместо моноширинного капса вразрядку, без декоративных звёздочек ✦, без косых бликов и цветных полосок слева.
// Разделы:
//   MONO  — на 30 экранах (сотрудник и руководитель, тёмная и светлая): моноширинным набраны только цифры и единицы
//           («3/12», «11:00–24:00», «5 мин», «30 мл»), SOS-печать и картинки-предметы; слов моноширинным нет;
//   STAR  — звёздочка ✦ видна только там, где она пока — сам знак (знак мастера у имени, свой раздел, аватар
//           наставника, печати и искры праздника) — их заменят свои значки в v75; декоративных ✦ нет;
//   SHEEN — у плиток вкладок нет косого блика; у карточек треков и разделов нет цветной полоски слева;
//   MOTTO — девиз владельца «Сервис — это забота» (был «…не обслуживание, а забота» — шаблон «не X, а Y»);
//   FLOW  — экраны на 393 и 320 px: без прокрутки вбок и без ошибок в консоли.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v73.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5273, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v73";
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

async function open({ who = "staff", light = false, w = 393, h = 852, fs = false, tg = false, role = "seasonal", menu = false } = {}) {
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
        schedule_load: { ok: false, error: "auth" }, menu_get: menu ? TEAM_MENU : [] };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0",
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
  "stats", "league", "leaderboard", "mentor", "sos", "search", "daily", "checklist", "onboarding", "guide", "offline", "mistakes", "certificates",
  "weeklyGuest", "analytics", "team", "candidate", "contentEditor"];
// единицы и знаки, которым моноширинный положен рядом с цифрами
const UNITS = new Set(["SOS", "мин", "сек", "мл", "дн", "ч", "г", "кг", "ккал", "из", "ИЗ", "ок", "вс"]);
// моноширинные слова на видимой части экрана (текстовые узлы, а не коробки)
const monoWords = (p) => p.evaluate((units) => {
  const UNITS = new Set(units);
  const out = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (!el) continue;
    if (el.closest("input,textarea,select,[data-ai-model],svg,canvas,[aria-hidden='true'] svg")) continue;
    const cs = getComputedStyle(el);
    if (!/monospace|Menlo|SF Mono|Consolas/i.test(cs.fontFamily)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
    const words = (t.match(/[A-Za-zА-Яа-яЁё]{2,}/g) || []).filter((w) => !UNITS.has(w));
    if (words.length) out.push(t.slice(0, 40));
  }
  return [...new Set(out)];
}, [...UNITS]);
// видимые ✦ вне знаков, которые заменят свои значки (v75)
const stars = (p) => p.evaluate(() => {
  const out = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    if (!n.textContent.includes("✦")) continue;
    const el = n.parentElement; if (!el) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
    if (el.closest("[data-master-mark],.c-spark,.sa-celeb,[data-seal],[data-avatar],[aria-hidden='true']")) continue;
    if (n.textContent.trim() === "✦" && el.closest("button,[role=button],[data-ms-badge],[data-topic-no]")) continue;   // знак-значок в кружке
    if (/знак\s✦/.test(n.textContent)) continue;   // текст, который объясняет сам знак мастера («носят знак ✦ у имени»)
    out.push(n.textContent.trim().slice(0, 40));
  }
  return [...new Set(out)];
});

if (want("MONO") || want("STAR") || want("FLOW")) {
  for (const [w, light] of [[393, false], [393, true], [320, false]]) {
    for (const who of ["staff", "admin"]) {
      const o = await open({ who, light, w, h: 852 });
      const badMono = {}, badStar = {}, side = [];
      for (const s of SCREENS) {
        await nav(o.page, s);
        await o.page.addStyleTag({ content: ".ms-toast-pos{display:none!important}" }).catch(() => {});
        if (w === 393 && !light && ["roleSelect", "shift", "teamHub", "me", "home", "menuTrainer", "cocktails", "mastery"].includes(s)) await shot(o.page, who + "-" + s);
        if (want("MONO")) { const m = await monoWords(o.page); if (m.length) badMono[s] = m; }
        if (want("STAR")) { const st = await stars(o.page); if (st.length) badStar[s] = st; }
        if (want("FLOW") && !(await noSide(o.page))) side.push(s);
      }
      const tag = (light ? "LIGHT " : "") + w + " " + who;
      if (want("MONO")) ok("MONO " + tag + ": моноширинным — только цифры и единицы", !Object.keys(badMono).length, JSON.stringify(badMono).slice(0, 700));
      if (want("STAR")) ok("STAR " + tag + ": декоративных ✦ нет", !Object.keys(badStar).length, JSON.stringify(badStar).slice(0, 500));
      if (want("FLOW")) ok("FLOW " + tag + ": " + SCREENS.length + " экранов без прокрутки вбок", !side.length, side.join(", "));
      if (want("FLOW")) ok("FLOW " + tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
      await o.ctx.close();
    }
  }
}

if (want("SHEEN")) {
  const o = await open({ who: "admin" });
  await nav(o.page, "teamHub");
  const sheen = await o.page.evaluate(() => [...document.querySelectorAll(".sa-card *")].filter((e) => /linear-gradient\(118deg/.test(e.style.background || "")).length);
  ok("SHEEN: у плиток «Команды» нет косого блика", sheen === 0, "слоёв: " + sheen);
  await nav(o.page, "roleSelect");
  await o.page.evaluate(() => { const b = document.querySelector("[data-tracks-toggle]"); if (b) b.click(); });
  await sleep(900);
  const rails = await o.page.evaluate(() => [...document.querySelectorAll("[data-tracks-list] .sa-card > div")].filter((e) => { const cs = getComputedStyle(e); return cs.position === "absolute" && parseFloat(cs.width) <= 4 && parseFloat(cs.left) === 0; }).length);
  ok("SHEEN: у карточек треков нет цветной полоски слева", rails === 0, "полосок: " + rails);
  await nav(o.page, "menuTrainer");
  const mrails = await o.page.evaluate(() => [...document.querySelectorAll(".sa-screen *")].filter((e) => { const cs = getComputedStyle(e); return parseFloat(cs.borderLeftWidth) >= 3 && cs.borderLeftColor !== cs.borderTopColor; }).length);
  ok("SHEEN: в «Меню» у карточек нет цветной полоски слева", mrails === 0, "полосок: " + mrails);
  await o.ctx.close();
}

if (want("MOTTO")) {
  for (const light of [false, true]) {
    const o = await open({ light });
    await nav(o.page, "roleSelect");
    const m = await o.page.evaluate(() => { const q = document.querySelector("[data-tracks-quote]"); return q ? q.textContent.trim() : null; });
    ok("MOTTO" + (light ? " LIGHT" : "") + ": девиз «Сервис — это забота»", m === "«Сервис — это забота»", String(m));
    const lbl = await o.page.evaluate(() => { const e = [...document.querySelectorAll("[data-sa-topbar] span")][0]; const cs = e && getComputedStyle(e); return e ? { t: e.textContent, f: cs.fontFamily } : null; });
    ok("MOTTO" + (light ? " LIGHT" : "") + ": в верхней строке «SA» шрифтом с засечками, без ✦", !!lbl && lbl.t === "SA" && /Georgia/.test(lbl.f), JSON.stringify(lbl));
    await o.ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
