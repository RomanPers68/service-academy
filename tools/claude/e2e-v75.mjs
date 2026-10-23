// e2e v75 (Доп. 388): свои значки вместо эмодзи и звёздочек ✦.
// Разделы:
//   EMOJI   — на 30 экранах (сотрудник и руководитель, тёмная и светлая тема, 393 px) в видимом тексте нет эмодзи
//             (символов, которые телефон рисует цветной картинкой), звёздочек ✦ ✧ ✨ и знаков ⚠ ❄;
//   LESSON  — урок «9 шагов безупречного сервиса»: строки «🦶 1. Встреча…» — значком маршрута, без эмодзи в тексте;
//   SIGNS   — знак мастера у имени (рейтинг) и в «Мастерах заведения» — медаль (svg), без ✦;
//   OWN     — свои разделы ресторана в оглавлении трека — домик и номер (svg), «монета» — data-own, словами «свой раздел»;
//   DIALOG  — живой диалог хостес: у Наставника «AI», у гостя — буква имени, реакция и настроение — лица (svg), в окне нет эмодзи;
//   LIGHT   — светлая тема и 320 px: без прокрутки вбок и ошибок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v75.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5275, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v75";
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
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: welcome ? "0" : "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0",
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
// эмодзи на экране: то, что телефон рисует картинкой (Emoji_Presentation или с U+FE0F), и наши «приметы»: ✦ ✧ ✨ ⚠ ❄
const EMOJI_SRC = "\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F|[\\u2726\\u2727\\u2728\\u26A0\\u2744]";
const emojiOn = (p, sel = "body") => p.evaluate(([sel, src]) => {
  const re = new RegExp(src, "u"), out = [];
  const root = document.querySelector(sel) || document.body;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    const t = n.textContent; if (!t || !re.test(t)) continue;
    const el = n.parentElement; if (!el || el.closest("script,style,noscript")) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.width < 1 || r.height < 1 || cs.visibility === "hidden" || cs.display === "none") continue;
    out.push(t.replace(/\s+/g, " ").trim().slice(0, 60));
  }
  return [...new Set(out)];
}, [sel, EMOJI_SRC]);
const R0b = "Два моря, Причал";

if (want("EMOJI")) {
  for (const who of ["staff", "admin"]) for (const light of [false, true]) {
    const tag = "EMOJI " + who + (light ? " светлая" : "");
    const o = await open({ who, light, menu: true });
    const found = {};
    for (const s of SCREENS) {
      await nav(o.page, s, 1300);
      const e = await emojiOn(o.page); if (e.length) found[s] = e;
      if (!light && ["me", "teamHub", "shift"].includes(s)) await shot(o.page, who + "-" + s);
    }
    ok(tag + ": на " + SCREENS.length + " экранах эмодзи и ✦ в тексте нет", !Object.keys(found).length, JSON.stringify(found).slice(0, 600));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("LESSON")) {
  // открыты темы s0–s7: урок «9 шагов безупречного сервиса» (s7-1)
  const all = doneMap(...["s0", "s1", "s2", "s3", "s4", "s5", "s6"].map(S));
  const o = await open({ extra: { my_state: { ok: true, v: 2, quiz: Object.keys(all.q), lessons: Object.keys(all.c), stars: {}, roles: [], last_role: "seasonal" } } });
  await o.page.evaluate(([c, q]) => { const uk = "_Анна_Смирнова"; localStorage.setItem("sa_completed" + uk, JSON.stringify(c)); localStorage.setItem("sa_quiz_done" + uk, JSON.stringify(q)); }, [all.c, all.q]);
  await o.page.reload({ waitUntil: "load" }); await sleep(2200);
  await nav(o.page, "home", 1500);
  await o.page.locator('.tbp-num[aria-label*="9 шагов"]').first().click({ timeout: 6000 }).catch(() => {});
  await sleep(900);
  await o.page.locator(".tbm-node:not(.tbp-side *)", { hasText: "9 шагов безупречного сервиса" }).first().click({ timeout: 6000 }).catch(() => {});
  await sleep(1500);
  // урок может открыться карточками — листаем до строк «🦶 …»
  let leads = [];
  for (let i = 0; i < 14; i++) {
    leads = await o.page.evaluate(() => [...document.querySelectorAll("[data-lesson-lead]")].map((d) => ({ ic: d.getAttribute("data-lesson-lead"), svg: !!d.querySelector("svg"), t: d.innerText.trim().slice(0, 40) })));
    if (leads.length) break;
    const next = o.page.locator('[aria-label="Следующая карточка"]');
    if (!(await next.count())) break;
    await next.first().click().catch(() => {}); await sleep(450);
  }
  await shot(o.page, "lesson-steps");
  const steps = leads.filter((x) => x.ic === "steps");
  ok("LESSON: строки «9 шагов» — значком маршрута (svg), текст без эмодзи", steps.length >= 1 && steps.every((x) => x.svg && /^\d\./.test(x.t)), JSON.stringify(leads.slice(0, 4)));
  const e = await emojiOn(o.page);
  ok("LESSON: в уроке нет эмодзи в тексте", !e.length, e.join(" | "));
  ok("LESSON: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("SIGNS")) {
  const rows = [{ who: "Анна Смирнова", name: "Анна", role: "core", at: "2026-10-20T10:00:00Z", me: true }, { who: "Иван Петров", name: "Иван", role: "seasonal", at: "2026-10-18T10:00:00Z", me: false }];
  const lb = [{ name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", role: "core", quiz_id: "c1-q", score: 8, total: 8, pct: 100, updated_at: "2026-10-20T10:00:00Z" },
    { name: "Иван", surname: "Петров", restaurant: R0, position: "waiter", role: "seasonal", quiz_id: "s0-q", score: 7, total: 8, pct: 88, updated_at: "2026-10-19T10:00:00Z" },
    { name: "Ольга", surname: "Белова", restaurant: R0, position: "waiter", role: "seasonal", quiz_id: "s0-q", score: 6, total: 8, pct: 75, updated_at: "2026-10-19T10:00:00Z" }];
  for (const light of [false, true]) {
    const tag = "SIGNS" + (light ? " светлая" : "");
    const o = await open({ light, extra: { mastery_list: { ok: true, rows, prize: null, can_prize: false }, team_scores: { ok: true, rows: lb } } });
    await nav(o.page, "mastery", 1800);
    const ms = await o.page.evaluate(() => [...document.querySelectorAll("[data-ms-master]")].map((r) => ({ svg: r.querySelectorAll("svg").length, star: r.innerText.includes("✦") })));
    await o.page.evaluate(() => { const b = document.querySelector("[data-ms-masters]"); if (b) b.scrollIntoView({ block: "center" }); }); await sleep(300);
    if (!light) await shot(o.page, "masters-list");
    ok(tag + ": «Мастера заведения» — у каждого медаль (svg), без ✦", ms.length === 2 && ms.every((r) => r.svg >= 1 && !r.star), JSON.stringify(ms));
    await nav(o.page, "leaderboard", 1800);
    const mk = await o.page.evaluate(() => [...document.querySelectorAll("[data-master-mark]")].map((m) => ({ t: m.getAttribute("title"), svg: !!m.querySelector("svg"), txt: m.textContent })));
    if (!light) await shot(o.page, "leaderboard-masters");
    ok(tag + ": рейтинг — знак мастера у Анны и Ивана медалью (svg), без текста", mk.length >= 2 && mk.every((m) => m.svg && !m.txt.trim()), JSON.stringify(mk));
    const e = await emojiOn(o.page);
    ok(tag + ": в рейтинге нет эмодзи и ✦", !e.length, e.join(" | "));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("OWN")) {
  const long = (s) => s + " " + "Текст урока для проверки, чтобы он был не короче нужного. ".repeat(6);
  const CMS = [
    { id: 901, role: "seasonal", module: "Наш зал", title: "Как устроен зал", content: long("Зал делится на три зоны."), questions: [], sort: 1 },
    { id: 902, role: "seasonal", module: "Наши вина", title: "Вина дома", content: long("Подаём белое при 8–10°."), questions: [], sort: 1 },
  ];
  const o = await open({ extra: { cms_list_lessons: CMS } });
  await nav(o.page, "home", 1800);
  const g = await o.page.evaluate(() => {
    const nums = [...document.querySelectorAll(".tbp-strip .tbp-num .n")].map((n) => ({ svg: !!n.querySelector("svg"), t: n.textContent.trim() }));
    const coin = [...document.querySelectorAll(".tbp-ind-row span")].map((s) => ({ n: s.getAttribute("data-n"), own: s.hasAttribute("data-own") }));
    return { nums, coin, star: document.body.innerText.includes("✦") };
  });
  const own = g.nums.filter((n) => n.svg);
  await o.page.evaluate(() => { const s = document.querySelector(".tbp-strip"); if (s) s.scrollLeft = s.scrollWidth; }); await sleep(300);
  await shot(o.page, "own-strip");
  ok("OWN: свои разделы в оглавлении — домик и номер «1», «2» (svg), цифры тем — как были", own.length === 2 && own.map((n) => n.t).join() === "1,2" && g.nums.filter((n) => !n.svg).every((n) => /^\d+$/.test(n.t)), JSON.stringify(g.nums.slice(-4)));
  ok("OWN: «монета» — у своих разделов data-own и номер", g.coin.filter((c) => c.own).map((c) => c.n).join() === "1,2", JSON.stringify(g.coin.slice(-3)));
  ok("OWN: ✦ на экране нет", !g.star);
  // меню своего раздела: «Дальше: …» и закладки соседних тем словами — «свой раздел»
  await o.page.locator(".tbp-strip .tbp-num").last().click(); await sleep(900);
  const lab = await o.page.evaluate(() => [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).filter((a) => /свой раздел/.test(a)));
  ok("OWN: подписи для экранного диктора — «свой раздел 1/2»", lab.some((a) => /свой раздел [12]/.test(a)), lab.slice(0, 3).join(" | "));
  ok("OWN: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("DIALOG")) {
  const o = await open({ role: "spg" });
  await nav(o.page, "home", 1500);
  await o.page.locator('.tbp-num[aria-label*="Знакомство"]').first().click({ timeout: 6000 }).catch(() => {});
  await sleep(900);
  await o.page.locator(".tbm-node:not(.tbp-side *)", { hasText: "Живой диалог: первая встреча" }).first().click({ timeout: 6000 }).catch(() => {});
  await o.page.waitForSelector(".sa-dlg[data-dlg]", { timeout: 8000 }).catch(() => {});
  await sleep(800);
  const intro = await o.page.evaluate(() => ({ ava: (document.querySelector(".dc-ava.big") || {}).textContent, chip: !!document.querySelector("[data-dlg-msg=intro] .dc-chip svg"),
    head: (document.querySelector(".dc-head .dc-ava") || {}).textContent, st: !!document.querySelector(".dc-st-e svg") }));
  ok("DIALOG: аватар гостя — одна буква имени, в шапке тоже", /^[А-ЯЁA-Z]$/.test(intro.ava || "") && intro.ava === intro.head, JSON.stringify(intro));
  ok("DIALOG: настроение — лицом (svg) в карточке и в шапке", intro.chip && intro.st, JSON.stringify(intro));
  await shot(o.page, "dialog-intro");
  // первый ответ: реакция гостя и шёпот Наставника
  await o.page.waitForSelector("[data-dlg-reply]:not([disabled])", { timeout: 25000 }).catch(() => {});
  await o.page.locator("[data-dlg-reply]").first().click().catch(() => {});
  await sleep(4500);
  const r = await o.page.evaluate(() => ({ react: [...document.querySelectorAll(".dc-react")].map((x) => ({ svg: !!x.querySelector("svg"), lab: x.getAttribute("aria-label"), txt: x.textContent })),
    av: [...document.querySelectorAll(".dc-coach-av")].map((x) => x.textContent) }));
  await shot(o.page, "dialog-reply");
  ok("DIALOG: реакция гостя — лицо (svg) и подпись словами", r.react.length >= 1 && r.react.every((x) => x.svg && !x.txt.trim() && /^Реакция гостя: [а-яё]+$/.test(x.lab)), JSON.stringify(r.react));
  ok("DIALOG: у Наставника в кружке «AI»", r.av.length >= 1 && r.av.every((x) => x === "AI"), JSON.stringify(r.av));
  const e = await emojiOn(o.page, ".sa-dlg");
  ok("DIALOG: в окне диалога нет эмодзи и ✦", !e.length, e.join(" | "));
  ok("DIALOG: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("LIGHT")) {
  for (const [w, light] of [[393, true], [320, false]]) {
    const o = await open({ light, w });
    const side = [];
    for (const s of ["roleSelect", "shift", "teamHub", "me", "mastery", "leaderboard", "cellar", "guestbook"]) { await nav(o.page, s); if (!(await noSide(o.page))) side.push(s); }
    ok("LIGHT " + (light ? "светлая " : "") + w + ": без прокрутки вбок", !side.length, side.join(", "));
    ok("LIGHT " + (light ? "светлая " : "") + w + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
