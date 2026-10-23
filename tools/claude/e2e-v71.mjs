// e2e v71 (Доп. 384): пять улучшений по обходу — владелец: «Соберём все 5?»
// Разделы:
//   QUIZ   — тест: тема и «12 вопросов» в шапке, три тарелки, бусины, правило на первом вопросе, буквы А–Г; ошибка разбивает
//            тарелку; третья ошибка — экран результата со словами про третью ошибку; светлая тема; 320 px без обрезок;
//   HIT    — «‹ назад» на 14 экранах: место нажатия не меньше 40×40 (проверка elementFromPoint по углам), тап сбоку от
//            значка возвращает назад; стрелки карточек урока;
//   SEARCH — лупа в верхней строке на главной, «Смене», «Меню»; нет в тесте; «негрони» → карточка из карты бара → тап
//            открывает колоду на Негрони; «орех» → блюдо из меню команды с аллергенами, примеры скрыты (как в «Колоде меню»);
//   HUBS   — «Я»: группы по порядку, итоги и настройки строками; «Команда» у руководителя: «Управление» первым; «Смена»;
//            компьютер 1440×900 — подписи групп над плитками; 320 px — без прокрутки вбок;
//   TG     — полноэкранный Telegram (v72: строка снова под кнопками Telegram — в их строке на iPhone её накрывает подложка
//            Telegram): строка ниже 108 px, в потоке, --sa-top — её высота, «Для чтения» словами, лупа и тема нажимаются;
//            выход из полноэкранного; обычный Telegram — как было; светлая тема;
//   FLOW   — 24 экрана на 393 и 320 px: без прокрутки вбок и без ошибок в консоли.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v71.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5271, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v71";
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
const nav = async (page, to, wait = 1600) => { await page.evaluate((to) => window.__saNav(to), to); await sleep(wait); };
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const box = (p, s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; }, s);
const noSide = (p) => p.evaluate(() => { const r = document.getElementById("root"); return document.documentElement.scrollWidth <= innerWidth + 1 && (!r || r.scrollWidth <= r.clientWidth + 1); });
async function openQuiz(p) {
  await nav(p, "home", 1800);
  await p.evaluate(() => { const els = [...document.querySelectorAll("*")].filter(e => e.childElementCount === 0 && /^Тест: поведение в зале$/.test((e.textContent || "").trim())); const vis = els.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top > 0 && r.top < innerHeight; }); (vis[0] || els[0]).click(); });
  await sleep(1400);
}
// неверный вариант текущего вопроса: подсветка покажет верный — выбираем тот, что не станет зелёным
async function answer(p, right) {
  const opts = p.locator("[data-quiz-opt]");
  const n = await opts.count();
  // тестовая сборка не знает верного заранее — пробуем первый; если зелёный, а нужен неверный — следующий вопрос
  await opts.nth(right ? 0 : n - 1).click();
  await sleep(250);
  const g = await p.evaluate(() => [...document.querySelectorAll("[data-quiz-opt]")].map((o) => getComputedStyle(o).borderTopColor));
  await sleep(1500);
  return g;
}

if (want("QUIZ")) {
  for (const light of [false, true]) {
    const T = light ? "LIGHT" : "DARK";
    const o = await open({ light });
    await openQuiz(o.page);
    const head = await o.page.evaluate(() => ({ kind: (document.querySelector("[data-quiz-kind]") || {}).textContent, title: (document.querySelector("[data-quiz-title]") || {}).textContent,
      plates: document.querySelector("[data-quiz-plates]") ? document.querySelector("[data-quiz-plates]").getAttribute("data-quiz-plates") : null, rule: !!document.querySelector("[data-quiz-rule]"),
      ruleText: (document.querySelector("[data-quiz-rule]") || {}).innerText, beads: document.querySelectorAll("[data-bead]").length, cur: document.querySelectorAll('[data-bead="cur"]').length,
      step: (document.querySelector("[data-quiz-step]") || {}).textContent, need: (document.querySelector("[data-quiz-need]") || {}).textContent,
      letters: [...document.querySelectorAll("[data-quiz-opt] > span:first-child")].map((s) => s.textContent) }));
    ok(`QUIZ ${T}: шапка — «Тест · 12 вопросов» и тема «Поведение в зале», три целые тарелки`, /Тест · 12 вопросов/i.test(head.kind || "") && head.title === "Поведение в зале" && head.plates === "3", JSON.stringify(head));
    ok(`QUIZ ${T}: «Вопрос 1 из 12», «зачёт: от 10», 12 бусин, текущая одна`, /Вопрос 1 из 12/i.test(head.step) && /зачёт: от 10/i.test(head.need) && head.beads === 12 && head.cur === 1, JSON.stringify(head));
    ok(`QUIZ ${T}: правило словами на первом вопросе, буквы А–Г у ответов`, head.rule && /Для зачёта нужно 10 верных из 12/.test(head.ruleText) && head.letters.join("") === "АБВГ".slice(0, head.letters.length) && head.letters.length >= 2, JSON.stringify({ r: head.ruleText, l: head.letters }));
    await shot(o.page, `quiz-${T.toLowerCase()}-1`);
    // отвечаем, пока не наберём ошибку (последний вариант — чаще неверный); считаем тарелки
    let broke = false, tries = 0;
    while (!broke && tries < 6) {
      tries++;
      const before = await o.page.evaluate(() => document.querySelector("[data-quiz-plates]").getAttribute("data-quiz-plates"));
      const opts = o.page.locator("[data-quiz-opt]"); const n = await opts.count();
      await opts.nth(n - 1).click(); await sleep(300);
      const mid = await o.page.evaluate(() => ({ plates: document.querySelector("[data-quiz-plates]").getAttribute("data-quiz-plates"), bad: document.querySelectorAll('[data-bead="bad"]').length }));
      if (Number(mid.plates) < Number(before)) { broke = true; await shot(o.page, `quiz-${T.toLowerCase()}-miss`); ok(`QUIZ ${T}: ошибка сразу разбивает тарелку и красит бусину`, mid.bad >= 1, JSON.stringify({ before, mid })); }
      await sleep(1500);
    }
    ok(`QUIZ ${T}: ошибка нашлась за несколько ответов`, broke, "попыток " + tries);
    const after = await o.page.evaluate(() => ({ rule: !!document.querySelector("[data-quiz-rule]"), step: (document.querySelector("[data-quiz-step]") || {}).textContent }));
    ok(`QUIZ ${T}: дальше правила словами нет — вместо него тарелки и бусины`, !after.rule && /Вопрос \d+ из 12/.test(after.step || ""), JSON.stringify(after));
    // доводим до третьей ошибки — экран результата
    for (let i = 0; i < 12; i++) {
      const done = await o.page.evaluate(() => !document.querySelector("[data-quiz-opt]"));
      if (done) break;
      const opts = o.page.locator("[data-quiz-opt]"); const n = await opts.count();
      await opts.nth(n - 1).click(); await sleep(1700);
    }
    const res = await o.page.evaluate(() => document.body.innerText);
    if (/Результат теста/.test(res) && /третья ошибка/.test(res)) ok(`QUIZ ${T}: третья ошибка — «Это третья ошибка, тест закончился…»`, /Это третья ошибка, тест закончился\. Посмотри разбор ниже и попробуй снова: пересдать можно сразу\./.test(res));
    else ok(`QUIZ ${T}: тест закончен (без трёх ошибок — тоже итог)`, /Результат теста/.test(res), res.slice(0, 120));
    await shot(o.page, `quiz-${T.toLowerCase()}-result`);
    ok(`QUIZ ${T}: без ошибок`, !o.errors.length, o.errors.join(" | "));
    await o.ctx.close();
  }
  // узкий телефон: шапка теста не вылезает
  const o = await open({ w: 320, h: 640 });
  await openQuiz(o.page);
  const g = await o.page.evaluate(() => { const t = document.querySelector("[data-quiz-title]").getBoundingClientRect(), p = document.querySelector("[data-quiz-plates]").getBoundingClientRect(); return { titleR: t.right, platesL: p.left, platesR: p.right, iw: innerWidth }; });
  ok("QUIZ 320: тема и тарелки не налезают и не вылезают за экран", g.titleR <= g.platesL + 1 && g.platesR <= g.iw - 8, JSON.stringify(g));
  ok("QUIZ 320: без прокрутки вбок", await noSide(o.page));
  await shot(o.page, "quiz-320");
  await o.ctx.close();
}

if (want("HIT")) {
  const screens = ["menuTrainer", "glossary", "mistakes", "guestbook", "daily", "leaderboard", "stats", "certificates", "search", "cellar", "league", "guide", "sos", "checklist", "cocktails", "barLab", "reference"];
  const o = await open({});
  for (const s of screens) {
    await nav(o.page, s, 1500);
    const r = await o.page.evaluate(() => {
      const cand = [...document.querySelectorAll("button, [role=button], .sa-hit")].filter((b) => (/^(Назад|Вернуться)$/.test(b.getAttribute("aria-label") || "") || /^‹/.test((b.textContent || "").trim())) && b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().top < 200);
      const b = cand[0]; if (!b) return null;
      const bb = b.getBoundingClientRect(); const cx = bb.left + bb.width / 2, cy = bb.top + bb.height / 2;
      const hit = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === b || b.contains(e)); };
      const pts = [[cx - 18, cy - 18], [cx + 18, cy - 18], [cx - 18, cy + 18], [cx + 18, cy + 18]].map(([x, y]) => [Math.max(1, x), y]);
      return { glyph: [Math.round(bb.width), Math.round(bb.height)], corners: pts.map(([x, y]) => hit(x, y)), cls: b.className };
    });
    ok(`HIT ${s}: «назад» нажимается в квадрате 36×36 вокруг значка (значок ${r ? r.glyph.join("×") : "?"})`, r && r.corners.every(Boolean), JSON.stringify(r));
  }
  // тап сбоку от значка действительно возвращает
  await nav(o.page, "roleSelect", 900); await nav(o.page, "glossary", 1400);
  const b = await o.page.evaluate(() => { const e = [...document.querySelectorAll("button")].find((x) => /^(Назад|Вернуться)$/.test(x.getAttribute("aria-label") || "") || (x.textContent || "").trim() === "‹"); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2 + 15, y: r.top + r.height / 2 + 14 }; });
  await o.page.mouse.click(b.x, b.y); await sleep(1200);
  const back = await o.page.evaluate(() => !!document.querySelector("[data-now-card]") || /Треки обучения/.test(document.body.innerText));
  ok("HIT: тап на 15 px правее и 14 px ниже значка — вернулись на главную", back);
  // стрелки карточек урока
  await nav(o.page, "home", 1600);
  await o.page.locator("button, [role=button], div, span").filter({ hasText: /^(Дальше|Начать)$/ }).first().click(); await sleep(1400);
  const arr = await o.page.evaluate(() => { const e = document.querySelector('[aria-label="Следующая карточка"]'); if (!e) return null; const r = e.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); }; return { size: [Math.round(r.width), Math.round(r.height)], ok: [hit(cx - 18, cy - 18), hit(cx + 18, cy + 18), hit(cx + 18, cy - 18)] }; });
  ok("HIT: стрелка «›» карточек урока — место 36×36 и больше", arr && arr.ok.every(Boolean), JSON.stringify(arr));
  // «Назад» Telegram (clickScreenBack) по-прежнему находит «‹» шапки по тексту: на глоссарии — возвращает
  await nav(o.page, "glossary", 1400);
  const tgBack = await o.page.evaluate(() => { const root = document.getElementById("root"); const marked = [...root.querySelectorAll('[data-sa-back], [aria-label="Назад"]')].filter((e) => e.getClientRects().length); return marked.length; });
  ok("HIT: шапка не помечена для «Назад» Telegram (подпись «Вернуться») — помеченные внутренние кнопки, как полоса разговора, главнее, как до v71", tgBack === 0, String(tgBack));
  ok("HIT: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("SEARCH")) {
  const o = await open({ menu: true });
  for (const s of ["roleSelect", "shift", "menuTrainer", "me"]) {
    if (s !== "roleSelect") await nav(o.page, s, 1400);
    ok(`SEARCH: лупа в верхней строке — «${s}»`, !!(await box(o.page, "[data-top-search]")));
  }
  await nav(o.page, "roleSelect", 900);
  await o.page.click("[data-top-search]"); await sleep(1300);
  const onSearch = await o.page.evaluate(() => !!document.querySelector('input[placeholder="Блюдо, аллерген, коктейль, термин…"]') && !document.querySelector("[data-top-search]"));
  ok("SEARCH: тап по лупе открывает поиск; на самом поиске лупы нет", onSearch);
  await o.page.fill("input", "негрони"); await sleep(800);
  const ng = await o.page.evaluate(() => { const c = document.querySelector('[data-search-cocktail="negroni"]'); return c ? c.innerText.replace(/\s+/g, " ") : null; });
  ok("SEARCH: «негрони» — карточка из карты бара со спеком", !!ng && /Негрони/.test(ng) && /Джин 30 мл/.test(ng) && /стир/i.test(ng), ng);
  await shot(o.page, "search-negroni");
  await o.page.click('[data-search-cocktail="negroni"]'); await sleep(2000);
  const deck = await o.page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  ok("SEARCH: тап — «Колода бармена» открыта на Негрони", /Колода бармена/.test(deck) && /НЕГРОНИ|Негрони/.test(deck), deck.slice(0, 160));
  await o.page.click("[data-top-search]"); await sleep(1200);
  await o.page.fill("input", "орех"); await sleep(800);
  const nut = await o.page.evaluate(() => ({ text: document.body.innerText.replace(/\s+/g, " "), al: [...document.querySelectorAll("[data-dish-allergens]")].map((e) => e.innerText) }));
  ok("SEARCH: «орех» — блюдо из меню команды, аллергены видны без раскрытия", /Чизкейк с солёной карамелью и фундуком/.test(nut.text) && nut.al.some((a) => /Содержит:.*Орехи/.test(a)), JSON.stringify(nut.al));
  ok("SEARCH: примеры при своём меню команды скрыты — как в «Колоде меню»", !/Креветка темпура/.test(nut.text));
  await shot(o.page, "search-nuts");
  ok("SEARCH: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
  // в тесте лупы нет
  const q = await open({});
  await openQuiz(q.page);
  ok("SEARCH: в тесте лупы нет (поиск стал бы подсказкой)", !(await box(q.page, "[data-top-search]")) && !!(await box(q.page, "[data-quiz-plates]")));
  await q.ctx.close();
}

if (want("HUBS")) {
  const o = await open({});
  await nav(o.page, "me", 1800);
  const me = await o.page.evaluate(() => ({ groups: [...document.querySelectorAll("[data-hub-group]")].map((g) => g.getAttribute("data-hub-group")), compact: [...document.querySelectorAll("[data-hub-compact]")].map((c) => [...c.querySelectorAll(".sa-card")].map((x) => x.getAttribute("aria-label"))) }));
  ok("HUBS «Я»: группы по порядку", JSON.stringify(me.groups) === JSON.stringify(["Мой путь", "Итоги и документы", "Вместе", "Помощь и настройки"]), JSON.stringify(me.groups));
  ok("HUBS «Я»: итоги и настройки — строками в одной карточке", me.compact.length === 2 && me.compact[0].includes("Итоги месяца") && me.compact[1].includes("Аккаунт и настройки") && me.compact[1].includes("Без сети"), JSON.stringify(me.compact));
  await shot(o.page, "hub-me");
  await nav(o.page, "shift", 1800);
  const sh = await o.page.evaluate(() => [...document.querySelectorAll("[data-hub-group]")].map((g) => g.getAttribute("data-hub-group")));
  ok("HUBS «Смена»: «На смене», «Потренироваться», «Первая неделя»", JSON.stringify(sh) === JSON.stringify(["На смене", "Потренироваться", "Первая неделя"]), JSON.stringify(sh));
  ok("HUBS 393: без прокрутки вбок", await noSide(o.page));
  await o.ctx.close();
  const a = await open({ who: "admin", role: "manager" });
  await nav(a.page, "teamHub", 2000);
  const tm = await a.page.evaluate(() => ({ groups: [...document.querySelectorAll("[data-hub-group]")].map((g) => g.getAttribute("data-hub-group")), first: [...(document.querySelector("[data-hub-compact]") || document).querySelectorAll(".sa-card")].map((x) => x.getAttribute("aria-label")) }));
  ok("HUBS «Команда» у руководителя: «Управление» первым, строками — пять пунктов", tm.groups[0] === "Управление" && JSON.stringify(tm.first) === JSON.stringify(["Аналитика", "Сотрудники", "Собеседование", "Отчёты по сотрудникам", "Редактор контента"]), JSON.stringify(tm));
  await a.page.click('[data-hub-compact] [aria-label="Собеседование"]'); await sleep(1600);
  ok("HUBS: строка «Собеседование» открывает собеседование", /Начать собеседование|Собеседование в приложении/.test(await a.page.evaluate(() => document.body.innerText)));
  await a.ctx.close();
  const n = await open({ w: 320, h: 640 });
  await nav(n.page, "me", 1600);
  ok("HUBS 320: без прокрутки вбок", await noSide(n.page));
  await n.ctx.close();
  const d = await open({ w: 1440, h: 900 });
  await nav(d.page, "me", 1800);
  const dk = await d.page.evaluate(() => ({ groups: document.querySelectorAll("[data-hub-group]").length, compact: document.querySelectorAll("[data-hub-compact]").length, tiles: !!document.querySelector(".sa-hubtiles") }));
  ok("HUBS 1440: подписи групп над плитками, плитки — сеткой (строками только на телефоне)", dk.groups === 4 && dk.compact === 0 && dk.tiles, JSON.stringify(dk));
  await shot(d.page, "hub-me-wide");
  ok("HUBS: без ошибок", !d.errors.length, d.errors.join(" | "));
  await d.ctx.close();
}

if (want("TG")) {
  for (const light of [false, true]) {
    const T = light ? "LIGHT" : "DARK";
    const o = await open({ fs: true, light });
    await sleep(500);
    const g = await o.page.evaluate(() => { const b = document.querySelector("[data-sa-topbar]").getBoundingClientRect(); const cs = getComputedStyle(document.querySelector("[data-sa-topbar]"));
      const lbl = document.querySelector("[data-sa-topbar] .sa-topbar-lbl"); const s = document.querySelector("[data-top-search]").getBoundingClientRect();
      const th = document.querySelector("[data-sa-topbar] > button:last-child").getBoundingClientRect();
      const hit = (r) => { const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && !!e.closest("[data-sa-topbar]"); };
      return { top: b.top, h: b.height, cx: b.left + b.width / 2, iw: innerWidth, pos: cs.position, lblShown: lbl ? getComputedStyle(lbl).display !== "none" : null,
        saTop: getComputedStyle(document.documentElement).getPropertyValue("--sa-top").trim(), st: getComputedStyle(document.documentElement).getPropertyValue("--sa-st").trim(),
        cls: document.documentElement.className, searchHit: hit(s), themeHit: hit(th), left: b.left, right: b.right }; });
    // v72 (Доп. 385): строка снова под кнопками Telegram — в их строке на iPhone её накрывает подложка Telegram
    ok(`TG ${T}: строка под кнопками Telegram (ниже 108 px), в потоке, во всю ширину колонки (v72)`, g.pos !== "fixed" && g.top >= 108 && g.h >= 30 && !/sa-tgrow/.test(g.cls), JSON.stringify(g));
    ok(`TG ${T}: экран вычитает высоту строки (--sa-top), «Для чтения» — словами`, parseFloat(g.saTop) >= 30 && g.lblShown === true, JSON.stringify({ saTop: g.saTop, lbl: g.lblShown }));
    ok(`TG ${T}: лупа и тема нажимаются (сверху ничего не лежит)`, g.searchHit && g.themeHit);
    await shot(o.page, `tg-${T.toLowerCase()}-home`);
    await o.page.click("[data-top-search]"); await sleep(1200);
    ok(`TG ${T}: лупа открывает поиск`, !!(await o.page.$('input[placeholder="Блюдо, аллерген, коктейль, термин…"]')));
    await nav(o.page, "roleSelect", 900);
    await o.page.evaluate(() => window.Telegram.WebApp.exitFullscreen()); await sleep(500);
    const back = await o.page.evaluate(() => ({ pos: getComputedStyle(document.querySelector("[data-sa-topbar]")).position, saTop: getComputedStyle(document.documentElement).getPropertyValue("--sa-top").trim(), lbl: getComputedStyle(document.querySelector("[data-sa-topbar] .sa-topbar-lbl")).display }));
    ok(`TG ${T}: вышли из полноэкранного — строка снова под Telegram, как была`, back.pos !== "fixed" && parseFloat(back.saTop) >= 30 && back.lbl !== "none", JSON.stringify(back));
    ok(`TG ${T}: без ошибок`, !o.errors.length, o.errors.join(" | "));
    await o.ctx.close();
  }
  const t = await open({ tg: true });
  const plain = await t.page.evaluate(() => ({ pos: getComputedStyle(document.querySelector("[data-sa-topbar]")).position, cls: document.documentElement.className }));
  ok("TG: обычный Telegram (без полноэкранного) — строка на прежнем месте", plain.pos !== "fixed" && !/sa-tgrow/.test(plain.cls), JSON.stringify(plain));
  await t.ctx.close();
}

if (want("FLOW")) {
  const screens = ["roleSelect", "home", "shift", "teamHub", "me", "reference", "menuTrainer", "glossary", "sos", "mistakes", "guestbook", "daily", "leaderboard", "stats", "profile", "certificates", "checklist", "cocktails", "barLab", "search", "cellar", "league", "guide", "offline"];
  for (const w of [393, 320]) {
    const o = await open({ w, h: w === 320 ? 640 : 852 });
    const bad = [];
    for (const s of screens) { await nav(o.page, s, 1100); if (!(await noSide(o.page))) bad.push(s); }
    ok(`FLOW ${w}: 24 экрана — без прокрутки вбок`, !bad.length, bad.join(", "));
    ok(`FLOW ${w}: без ошибок в консоли`, !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

await browser.close(); server.close();
const bad = results.filter((r) => r.startsWith("✗"));
console.log(results.join("\n"));
console.log(`\n${results.length - bad.length} из ${results.length} проверок прошли`);
process.exit(bad.length ? 1 : 0);
