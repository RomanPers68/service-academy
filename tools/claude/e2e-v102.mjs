// e2e v102 (Доп. 415): «Линза» на всех экранах. Владелец (29.10): «правильно будет добавить эффект линзы по всему
// приложению, чтобы визуально приложение было едино?» — «Да, давай». Линзой стало то, что на экранах уже круглое:
// кнопка «назад» (data-lens="back"), поиск в верхней строке, стрелки графика, кружки значков SOS (красные), сертификатов,
// книги отзывов, номера навыков наставника, аватарки (data-lens="disc" | "sos" | "avatar"). Разделы:
//   BACK   — на десяти экранах кнопка «назад» — круглая линза 32 px (стекло, ободок, кольцо снаружи ::after), стрелка
//            видна, ничего не выезжает вбок; тап — назад; «Назад» Telegram находит её, как раньше (по «‹»);
//   DISC   — SOS: красные линзы (шапка и семь пунктов); сертификаты: линзы с оттенком роли; наставник: номера —
//            линзы, подтверждённый — прежний зелёный; статистика и аккаунт: аватарки; поиск в верхней строке — круглый;
//   CALM   — значки в списках «Смены», «Команды» и «Я» без кружков (плашки убраны в v78), чек-лист и переключатели прежние;
//   NOW    — «как сейчас» (sa_home_look = "now"): класса sa-lens нет, «назад» — прежняя стрелка без кружка;
//   LIGHT  — «Для чтения»: стекло и стрелка — тёмным золотом;   NARROW — 320 px: шапки с линзой без прокрутки вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v102.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5301, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v102";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".webp": "image/webp", ".css": "text/css" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise((r) => server.listen(PORT, r));

const R0 = "Два моря, Океан";
const ANNA = { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const MARIA = { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false };
const OWNER = { id: "u-own", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true };
const NOW = new Date("2026-10-28T23:00:00Z");   // 29.10, 11:00 по Камчатке
const TODAY = "2026-10-29", YDAY = "2026-10-28";
const DONE = { "s0-1": true, "s0-2": true, "s0-3": true };
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };

async function open({ who = ANNA, light = false, w = 393, h = 852, look = null, scores = [], safe = 0, init = null } = {}) {
  const uk = "_" + who.name + "_" + (who.surname || "");
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 900, hasTouch: w < 900, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const mock = {
        whoami: { ok: true, employee: who }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: Object.keys(DONE), stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: scores }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] },
        schedule_load: { ok: false, error: "auth" }, menu_get: [],
      };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_quest_open: "1",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(who), ["sa_last_role" + uk]: JSON.stringify("seasonal"), ["sa_completed" + uk]: JSON.stringify(DONE), ["sa_goal" + uk]: "2",
    ["sa_activity" + uk]: JSON.stringify({ [YDAY]: { st: 2, l: 2 } }), ["sa_streak" + uk]: JSON.stringify({ count: 3, best: 5, last: YDAY, days: [YDAY] }),
    sa_today_shift: JSON.stringify({ date: TODAY, label: "День · 12:00–20:00" }), ...(look ? { sa_home_look: look } : {}) };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } }, seed);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  // вырез снизу как у iPhone (env(safe-area-inset-bottom)): меню выше на 34 px
  if (safe) { const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: safe, left: 0, right: 0 } }); }
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(2000);
  return { ctx, page, errors };
}

const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nav = async (page, s, wait = 1300) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };

// что на экране линзой: «назад», кружки, аватарки — и прокрутка вбок
const lensProbe = (p) => p.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
  const cs = (e, pe) => getComputedStyle(e, pe || null);
  const one = (el) => { const r = el.getBoundingClientRect(), a = cs(el, "::after"), s = cs(el);
    return { w: Math.round(r.width), h: Math.round(r.height), br: s.borderTopLeftRadius, bg: s.backgroundColor, shadow: s.boxShadow.slice(0, 120), color: s.color,
      after: a.content, inset: a.top, ring: a.borderTopWidth + " " + a.borderTopColor, txt: (el.textContent || "").trim().slice(0, 4) }; };
  const pick = (sel) => [...document.querySelectorAll(sel)].filter(vis).map(one);
  return {
    lens: document.documentElement.classList.contains("sa-lens"),
    back: pick('[data-lens="back"]'), disc: pick('[data-lens="disc"]:not([data-top-search])'), sos: pick('[data-lens="sos"]'), avatar: pick('[data-lens="avatar"]'),
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});
const isLensBack = (b, gold = "rgb(200, 169, 110)") => b && b.w === 32 && b.h === 32 && b.br === "50%" && b.after === '""' && b.inset === "-3.5px" && /^1px rgba\(214, 178, 102, 0\.44\)$/.test(b.ring) && b.color === gold && /rgba\(214, 178, 102, 0\.45\) 0px 0px 0px 1px inset/.test(b.shadow) && b.txt === "‹";

if (want("BACK")) {
  const o = await open({ who: MARIA });
  const screens = ["glossary", "leaderboard", "stats", "certificates", "mentor", "guestbook", "league", "mistakes", "daily", "checklist"];
  const bad = [];
  for (const s of screens) {
    await nav(o.page, s);
    const pr = await lensProbe(o.page);
    if (!pr.lens || pr.back.length !== 1 || !isLensBack(pr.back[0]) || pr.hscroll) bad.push(s + ": " + JSON.stringify(pr.back[0] || null).slice(0, 160));
    if (s === "mentor") await shot(o.page, "back-mentor");
  }
  ok("BACK: на 10 экранах «назад» — круглая линза 32 px: стекло, ободок, кольцо снаружи, стрелка «‹» золотом, без прокрутки вбок", !bad.length, bad.join(" | "));
  // тап по линзе — назад
  await nav(o.page, "roleSelect", 900); await nav(o.page, "glossary");
  await o.page.locator('[data-lens="back"]').first().click(); await sleep(900);
  const after = await o.page.evaluate(() => !!document.querySelector("[data-home-look]"));
  ok("BACK: тап по линзе — на главную, как раньше", after);
  // «Назад» Telegram: clickScreenBack ищет помеченное, потом «‹» по тексту — у линзы текст прежний
  await nav(o.page, "glossary");
  const tg = await o.page.evaluate(() => { const marked = [...document.querySelectorAll('[data-sa-back], [aria-label="Назад"]')].filter((e) => e.getClientRects().length).length;
    const byText = [...document.querySelectorAll('button, [role="button"]')].filter((el) => (el.textContent || "").replace(/\s+/g, " ").trim() === "‹" && el.getClientRects().length).length; return { marked, byText }; });
  ok("BACK: «Назад» Telegram находит «‹» шапки по тексту, помеченных нет — как до v102", tg.marked === 0 && tg.byText === 1, JSON.stringify(tg));
  ok("BACK: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("DISC")) {
  const o = await open({ who: MARIA });
  await nav(o.page, "sos");
  let pr = await lensProbe(o.page);
  ok("DISC: SOS — шапка и пункты красными линзами (ободок 0,62, кольцо 0,42)", pr.sos.length >= 6 && pr.sos.every((d) => /rgba\(234, 140, 140, 0\.62\) 0px 0px 0px 1px inset/.test(d.shadow) && d.after === '""' && /rgba\(234, 140, 140, 0\.42\)/.test(d.ring)), JSON.stringify(pr.sos[0]).slice(0, 200));
  await shot(o.page, "disc-sos");
  await nav(o.page, "certificates");
  pr = await lensProbe(o.page);
  ok("DISC: сертификаты — кружки ролей линзами (стекло, кольцо), оттенок роли снизу", pr.disc.length >= 5 && pr.disc.every((d) => d.bg === "rgba(200, 169, 110, 0.12)" && d.after === '""' && /inset/.test(d.shadow)), JSON.stringify(pr.disc[0]).slice(0, 200));
  await nav(o.page, "mentor");
  pr = await lensProbe(o.page);
  ok("DISC: допуск наставника — номера навыков линзами", pr.disc.length >= 5 && pr.disc.every((d) => /^\d$/.test(d.txt) && d.bg === "rgba(200, 169, 110, 0.12)"), JSON.stringify(pr.disc.map((d) => d.txt)));
  await nav(o.page, "stats");
  pr = await lensProbe(o.page);
  ok("DISC: статистика — аватарка линзой", pr.disc.some((d) => d.w === 48 && d.after === '""'), JSON.stringify(pr.disc).slice(0, 200));
  await nav(o.page, "profile");
  pr = await lensProbe(o.page);
  ok("DISC: аккаунт — аватарка с кольцом (золото прежнее), «Карта обучения» — линза", pr.avatar.some((a) => a.w === 54 && a.after === '""') && pr.disc.some((d) => d.w === 34), JSON.stringify({ a: pr.avatar[0], d: pr.disc[0] }).slice(0, 220));
  await shot(o.page, "disc-profile");
  await nav(o.page, "stats");   // в «Аккаунте» верхней строки нет
  const top = await o.page.evaluate(() => { const b = document.querySelector("[data-top-search]"); if (!b) return null; const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), br: getComputedStyle(b).borderTopLeftRadius }; });
  ok("DISC: поиск в верхней строке — круглая линза 28 px", top && top.w === 28 && top.h === 28 && top.br === "50%", JSON.stringify(top));
  ok("DISC: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("CALM")) {
  const o = await open({ who: MARIA });
  const hubs = [];
  for (const s of ["shift", "teamHub", "me"]) { await nav(o.page, s); hubs.push(await o.page.evaluate(() => document.querySelectorAll("[data-hub-ic] [data-lens], [data-hub-ic][data-lens], [data-hub-compact] [data-lens]").length)); }
  ok("CALM: значки в списках «Смены», «Команды» и «Я» — без кружков (плашки убраны в v78)", hubs.every((n) => n === 0), JSON.stringify(hubs));
  await nav(o.page, "checklist");
  const ck = await o.page.evaluate(() => document.querySelectorAll("[data-lens]").length);
  ok("CALM: чек-лист — кружки-галочки прежние (линза только у «назад» и поиска)", ck === 2, String(ck));
  await o.ctx.close();
}

if (want("NOW")) {
  const o = await open({ who: MARIA, look: "now" });
  await nav(o.page, "glossary");
  const pr = await lensProbe(o.page);
  ok("NOW: «как сейчас» — класса sa-lens нет, «назад» — прежняя стрелка без кружка", !pr.lens && pr.back.length === 1 && pr.back[0].w < 20 && pr.back[0].after === "none", JSON.stringify(pr.back[0]).slice(0, 160));
  await o.ctx.close();
}

if (want("LIGHT")) {
  const o = await open({ who: MARIA, light: true });
  await nav(o.page, "mentor");
  const pr = await lensProbe(o.page);
  ok("LIGHT: «Для чтения» — «назад» линзой тёмного золота, номера — светлым стеклом", pr.back.length === 1 && isLensBack({ ...pr.back[0], ring: pr.back[0].ring.replace("rgba(139, 106, 48, 0.32)", "rgba(214, 178, 102, 0.44)"), shadow: pr.back[0].shadow.replace("rgba(139, 106, 48, 0.48)", "rgba(214, 178, 102, 0.45)") }, "rgb(122, 93, 42)") && pr.disc.every((d) => d.bg === "rgba(139, 106, 48, 0.09)"), JSON.stringify(pr.back[0]).slice(0, 200));
  await shot(o.page, "light-mentor");
  ok("LIGHT: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("NARROW")) {
  const o = await open({ who: MARIA, w: 320, h: 640 });
  const bad = [];
  for (const s of ["certificates", "leaderboard", "guestbook", "mentor", "sos", "stats"]) { await nav(o.page, s); const pr = await lensProbe(o.page); if (pr.hscroll) bad.push(s); }
  ok("NARROW 320: шапки с линзой и кружки — без прокрутки вбок", !bad.length, bad.join(","));
  await shot(o.page, "narrow-stats");
  await o.ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок пройдено`);
process.exit(bad ? 1 : 0);
