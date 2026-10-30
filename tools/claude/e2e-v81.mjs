// e2e v81 (Доп. 394): «Вопрос дня» в Telegram — приложение.
// Разделы:
//   QUEUE   — через ~8 с после старта: сначала ответы (qday_inbox), потом очередь (qday_push): ошибки из тестов к повтору
//             первыми, ошибка практики — нет, дальше пройденные темы роли; до семи, у каждого 2–4 варианта; в тот же
//             день повторно не шлём;
//   INBOX   — ответы из Telegram: новая ошибка — в «Работу над ошибками», верный ответ на вопрос из банка — следующий
//             интервал; ответ сегодня — свеча (журнал дня); при следующем запуске — не второй раз;
//   MISSING — на сервере нет этапа 31: очередь не шлём;
//   PREFS   — «Напоминания в Telegram»: строка «Вопрос дня» с часом от сервера, переключатель → notify_set qday.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v81.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5281, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v81";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { SEASONAL_MODULES } = await import(SRC + "/data/modules-seasonal.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));

const R0 = "Два моря, Океан";
const STAFF = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const UK = "_Анна_Смирнова";
const NOW = new Date("2026-10-23T02:20:00Z");   // 23.10, 14:20 по Камчатке
const doneMap = (...mods) => { const c = {}, q = {}; mods.forEach(m => m.lessons.forEach(l => { if (l.type === "quiz") q[l.id] = true; else if (l.type !== "result") c[l.id] = true; })); return { c, q }; };
const S = (id) => SEASONAL_MODULES.find(m => m.id === id);
const DONE = doneMap(S("s0"), S("s1"));
const qOf = (m) => m.lessons.filter((l) => l.type === "quiz").flatMap((l) => l.questions.map((q) => ({ ...q, lessonTitle: l.title })));
const fits = (x) => x && !x.img && Array.isArray(x.options) && x.options.length >= 2 && x.options.length <= 4 && x.options.every((o) => String(o).length <= 200) && String(x.q).length <= 400;
const POOL = [...qOf(S("s0")), ...qOf(S("s1"))].filter(fits);
const M1 = POOL[0], M2 = POOL[1];
const T = NOW.getTime();
const BANK = [
  { q: M2.q, options: M2.options, correct: M2.correct, explanation: M2.explanation || "", lessonTitle: M2.lessonTitle, lessonId: "", img: null, stage: 0, due: T - 2 * 3600e3 },
  { q: M1.q, options: M1.options, correct: M1.correct, explanation: M1.explanation || "", lessonTitle: M1.lessonTitle, lessonId: "", img: null, stage: 0, due: T - 3600e3 },
  { q: "Ситуация практики: гость просит пересадить", options: ["Пересадить", "Отказать"], correct: 0, explanation: "", lessonTitle: "", lessonId: "", img: null, stage: 0, due: T - 5 * 3600e3, from: "practice" },
];
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function open({ rpcs = () => undefined, calls = [], telegram = false, light = false, w = 393, h = 852, seedExtra = {}, path = "/" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      calls.push({ fn: m[1], body, t: Date.now() });
      const own = rpcs(m[1], body);
      if (own !== undefined) return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own) });
      const mock = { whoami: { ok: true, employee: STAFF }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: Object.keys(DONE.q), lessons: Object.keys(DONE.c), stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] }, schedule_load: { ok: false, error: "auth" }, menu_get: [] };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(STAFF), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_completed" + UK]: JSON.stringify(DONE.c), ["sa_quiz_done" + UK]: JSON.stringify(DONE.q), ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }),
    ["sa_mistakes" + UK]: JSON.stringify(BANK) };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  Object.assign(seed, seedExtra);
  await ctx.addInitScript(([seed, telegram]) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (telegram) {
      window.Telegram = { WebApp: { initData: "query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc", platform: "ios", initDataUnsafe: {}, ready() {}, expand() {}, setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {},
        openTelegramLink() {}, requestWriteAccess(cb) { setTimeout(() => cb && cb(true), 30); },
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
        BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} } } };
    }
  }, [seed, telegram]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + path, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors, calls };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const bank = (page) => page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]"), UK);
const actToday = (page) => page.evaluate((uk) => { const a = JSON.parse(localStorage.getItem("sa_activity" + uk) || "{}"); return a["2026-10-23"] || {}; }, UK);

// v88: qday_today — карточка «Вопрос дня» на главной (её проверяет e2e-v88); здесь — только очередь для Telegram
const QCALL = /^qday_(inbox|push)$/;
if (want("QUEUE")) {
  const o = await open({ rpcs: (fn) => (fn === "qday_inbox" ? { ok: true, hour: 12, queued: 0, items: [] } : fn === "qday_push" ? { ok: true, queued: 7, hour: 12 } : undefined) });
  const t0 = Date.now();
  await sleep(4000);
  const early = o.calls.filter((c) => QCALL.test(c.fn)).map((c) => c.fn);
  await sleep(7000);
  const q = o.calls.filter((c) => QCALL.test(c.fn));
  const push = q.find((c) => c.fn === "qday_push");
  const items = push ? push.body.p_items : [];
  ok("QUEUE: в первые секунды — ни одного запроса «Вопроса дня» (не мешаем главной)", !early.length, early.join(","));
  ok("QUEUE: потом сначала ответы, затем очередь", q.map((c) => c.fn).join(",") === "qday_inbox,qday_push", q.map((c) => c.fn).join(","));
  // M2 ждёт повтора дольше (срок на час раньше) — он первый
  ok("QUEUE: первыми — ошибки из тестов по сроку, ошибки практики нет", items.length >= 2 && items[0].q === M2.q && items[1].q === M1.q && !items.some((x) => /Ситуация практики/.test(x.q)), JSON.stringify(items.slice(0, 2).map((x) => x.q)));
  ok("QUEUE: семь вопросов, у каждого 2–4 варианта, верный среди них, роль «Новичок», ключи разные",
    items.length === 7 && items.every((x) => x.o.length >= 2 && x.o.length <= 4 && x.c >= 0 && x.c < x.o.length && x.r === "Новичок" && /^q[0-9a-f]{8}$/.test(x.k)) && new Set(items.map((x) => x.k)).size === 7, JSON.stringify(items.map((x) => [x.k, x.o.length, x.c, x.r])));
  ok("QUEUE: после ошибок — вопросы пройденных тестов роли", items.slice(2).every((x) => POOL.some((p) => p.q === x.q)));
  ok("QUEUE: токен сессии в запросе", push && push.body.p_token === "tok-preview");
  // тот же день — повторно не шлём
  o.calls.length = 0;
  await o.page.reload({ waitUntil: "load" }); await sleep(11000);
  const again = o.calls.filter((c) => QCALL.test(c.fn)).map((c) => c.fn);
  ok("QUEUE: перезапуск в тот же день — ответы спрашиваем, очередь не шлём", again.join(",") === "qday_inbox", again.join(","));
  ok("QUEUE: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("INBOX")) {
  const NEWQ = { q: "Что сказать гостю, если блюдо задерживается?", o: ["Ничего", "Предупредить и предложить комплимент", "Сослаться на кухню"], c: 1 };
  const items = [
    { id: 11, k: "qnew", q: NEWQ.q, o: NEWQ.o, c: 1, e: "Предупредить — значит позаботиться.", t: "Сервис", day: "2026-10-23", answer: 0, correct: false, at: NOW.toISOString() },
    { id: 12, k: "qm1", q: M1.q, o: M1.options, c: M1.correct, e: "", t: M1.lessonTitle, day: "2026-10-23", answer: M1.correct, correct: true, at: NOW.toISOString() },
    { id: 13, k: "qold", q: M2.q, o: M2.options, c: M2.correct, e: "", t: M2.lessonTitle, day: "2026-10-20", answer: (M2.correct + 1) % M2.options.length, correct: false, at: "2026-10-20T00:30:00Z" },
  ];
  const o = await open({ rpcs: (fn) => (fn === "qday_inbox" ? { ok: true, hour: 12, queued: 3, items } : fn === "qday_push" ? { ok: true, queued: 7 } : undefined) });
  await sleep(11000);
  const b = await bank(o.page);
  const nw = b.find((m) => m.q === NEWQ.q), m1 = b.find((m) => m.q === M1.q), m2 = b.find((m) => m.q === M2.q);
  ok("INBOX: неверный ответ на новый вопрос — в «Работе над ошибками», к повтору сейчас", !!nw && nw.tg === true && nw.stage === 0 && nw.correct === 1 && nw.options.length === 3 && nw.explanation === "Предупредить — значит позаботиться." && nw.due <= T + 1000, JSON.stringify(nw));
  ok("INBOX: верный ответ на вопрос из банка — следующий интервал (через день)", !!m1 && m1.stage === 1 && Math.abs(m1.due - (T + 864e5)) < 60e3, JSON.stringify(m1 && { stage: m1.stage, due: m1.due - T }));
  ok("INBOX: неверный ответ на вопрос из банка — повтор сначала", !!m2 && m2.stage === 0, JSON.stringify(m2 && { stage: m2.stage }));
  const a = await actToday(o.page);
  ok("INBOX: два ответа сегодня — свеча (журнал дня: работа над ошибками ×2), позавчерашний не в счёт", a.f === 2, JSON.stringify(a));
  await shot(o.page, "inbox-home");
  await o.page.reload({ waitUntil: "load" }); await sleep(11000);
  const b2 = await bank(o.page), a2 = await actToday(o.page);
  ok("INBOX: следующий запуск — те же ответы второй раз не учитываются", b2.length === b.length && b2.find((m) => m.q === M1.q).stage === 1 && a2.f === 2, JSON.stringify({ n: [b.length, b2.length], f: a2.f }));
  // «Работа над ошибками»: тема вопроса из Telegram — в «Слабых темах», вопросов к повтору — два (новый и сброшенный)
  await o.page.evaluate(() => window.__saNav("mistakes")); await sleep(1500);
  const txt = await o.page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  ok("INBOX: в «Работе над ошибками» — тема вопроса из Telegram и два вопроса на повторе", /Слабые темы.*Сервис 1/.test(txt) && /Сейчас на повторе: 2/.test(txt), txt.slice(0, 220));
  await shot(o.page, "inbox-mistakes");
  ok("INBOX: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("LINK")) {
  // кнопка «Разобрать ошибку» под неверным ответом в Telegram открывает приложение со ссылкой ?go=mistakes
  const o = await open({ path: "/?go=mistakes", rpcs: (fn) => (fn === "qday_inbox" ? { ok: true, hour: 12, queued: 0, items: [] } : undefined) });
  await sleep(2500);
  const txt = await o.page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const back = await o.page.locator('button[aria-label="Вернуться"]').count();
  ok("LINK: ?go=mistakes открывает «Работу над ошибками» (кнопка «Разобрать ошибку» под вопросом дня)", back > 0 && /Работа над ошибками/.test(txt) && /Слабые темы/.test(txt), txt.slice(0, 160));
  await shot(o.page, "link-mistakes");
  ok("LINK: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("MISSING")) {
  const o = await open({ rpcs: (fn) => (fn === "qday_inbox" || fn === "qday_push" ? { code: "PGRST202", message: "Could not find the function" } : undefined) });
  await sleep(11000);
  const q = o.calls.filter((c) => QCALL.test(c.fn)).map((c) => c.fn);
  ok("MISSING: этапа 31 нет — один вопрос серверу, очередь не шлём", q.join(",") === "qday_inbox", q.join(","));
  // ошибку практики уборка банка (v79) убирает сама — её ситуации нет в программе; ошибки тестов — как были
  const bb = await bank(o.page);
  ok("MISSING: ошибки тестов в банке как были", [M1, M2].every((m) => { const x = bb.find((y) => y.q === m.q); return x && x.stage === 0 && !x.tg; }) && !bb.some((x) => x.tg), JSON.stringify(bb.map((x) => [x.q.slice(0, 20), x.stage])));
  ok("MISSING: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("PREFS")) {
  for (const light of [false, true]) {
    const tag = "PREFS" + (light ? " светлая" : "");
    let prefs = { ok: true, bot: true, linked: true, remind: true, pair: true, quest: true, league: true, fresh: true, month: true, master: true, qday: true, qday_hour: 11 };
    const o = await open({ light, telegram: true, rpcs: (fn, body) => {
      if (fn === "tg_status") return { ok: true, bot: true, linked: true, remind: true, minutes: 60 };
      if (fn === "notify_prefs") return prefs;
      if (fn === "notify_set") { prefs = { ...prefs, [body.p_kind]: !!body.p_on }; return prefs; }
      if (fn === "qday_inbox") return { ok: true, items: [] };
      return undefined;
    } });
    await sleep(1500);
    await o.page.evaluate(() => window.__saNav("shift")); await sleep(1000);
    await o.page.locator('.sa-card[aria-label="Напоминания в Telegram"]').first().click(); await sleep(1400);
    const row = o.page.locator('[data-notify-prefs] [role="switch"]', { hasText: "Вопрос дня" });
    const t = (await row.count()) ? (await row.innerText()).replace(/\s+/g, " ") : "";
    ok(tag + ": строка «Вопрос дня» — час от сервера и откуда вопросы", /Вопрос дня в 11:00 вопрос с кнопками ответа: из твоих ошибок и пройденных тем/.test(t), t);
    ok(tag + ": включено", (await row.getAttribute("aria-checked")) === "true");
    await row.scrollIntoViewIfNeeded(); await shot(o.page, "prefs" + (light ? "-light" : ""));
    await row.click(); await sleep(700);
    const set = o.calls.filter((c) => c.fn === "notify_set").map((c) => c.body);
    ok(tag + ": переключатель — notify_set qday выкл", set.length === 1 && set[0].p_kind === "qday" && set[0].p_on === false && (await row.getAttribute("aria-checked")) === "false", JSON.stringify(set));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
