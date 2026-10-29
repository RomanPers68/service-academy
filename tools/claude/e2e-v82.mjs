// e2e v82 (Доп. 395): брифинг смены из приложения.
// Разделы:
//   LEAD    — руководитель: «Смена» → «Брифинг смены»; блоки собраны из графика, меню, трудных вопросов и лиги недели;
//             выключатель и «Своё»; «Провести» — по одному блоку, секундомер, ответ на вопрос команде по кнопке;
//             «Отправить команде» → brief_publish (выключенное не уходит, вопрос команде без ответа); после — «Отправить
//             правку», карточка брифинга в «Смене», подпись пункта «Сегодня отправлен»;
//   STAFF   — сотрудник: карточка брифинга вверху «Смены» (непрочитанная — с точкой), чтение по блокам, ответ по кнопке;
//             «Назад» Telegram закрывает чтение; пункта «Брифинг смены» у сотрудника нет;
//   LINK    — кнопка «Брифинг смены» из Telegram (?go=brief): «Смена» и сразу чтение; брифинга нет — просто «Смена»;
//   MISSING — на сервере нет этапа 32: у сотрудника карточки нет, у руководителя «Отправить» честно об этом говорит,
//             а «Провести» работает;
//   PREFS   — «Напоминания в Telegram»: строка «Брифинг смены», переключатель → notify_set brief;
//   NARROW  — 320 px: экран брифинга и показ без горизонтальной прокрутки, кнопки внизу целиком видны.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v82.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5282, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v82";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { SEASONAL_MODULES } = await import(SRC + "/data/modules-seasonal.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));

const R0 = "Два моря, Океан";
const LEAD = { id: "u-lead", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false };
const STAFF = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const ukOf = (p) => "_" + p.name + "_" + p.surname;
const NOW = new Date("2026-10-23T02:20:00Z");   // 23.10, 14:20 по Камчатке
const T = NOW.getTime();
const qOf = (m) => m.lessons.filter((l) => l.type === "quiz").flatMap((l) => l.questions.map((q) => ({ ...q, lessonTitle: l.title })));
const fits = (x) => x && !x.img && Array.isArray(x.options) && x.options.length >= 2 && x.options.length <= 4 && Number.isInteger(x.correct);
const POOL = SEASONAL_MODULES.flatMap(qOf).filter(fits);
const M1 = POOL[0], M2 = POOL[1];
const M3 = POOL.slice(2).find((x) => String(x.explanation || "").trim().length > 20);
const HARD = [
  { question: M1.q, lesson_id: "x1", total: 10, fails: 6, fail_pct: 60 },
  { question: "Вопроса больше нет в программе", lesson_id: "x0", total: 9, fails: 8, fail_pct: 88 },
  { question: M2.q, lesson_id: "x2", total: 8, fails: 4, fail_pct: 50 },
  { question: M3.q, lesson_id: "x3", total: 6, fails: 2, fail_pct: 33 },
];
const MENU = [
  { id: "d1", name: "Борщ с уткой", cat: "Супы", desc: "Борщ", ingredients: ["свёкла", "утка"], stop: { since: T - 3600e3 } },
  { id: "d2", name: "Тартар из тунца", cat: "Закуски", desc: "Тунец", ingredients: ["тунец"], isNew: true, addedAt: T - 2 * 864e5, voice: { chef: { url: "https://example.com/v.m4a", by: "Шеф Алексей", at: T - 864e5, sec: 12 } } },
  { id: "d3", name: "Паста с крабом", cat: "Горячее", desc: "Паста", ingredients: ["паста", "краб"], isNew: true, addedAt: T - 5 * 864e5 },
  { id: "d4", name: "Цезарь", cat: "Салаты", desc: "Салат", ingredients: ["курица"] },
];
const SCHED = { ok: true, venues: [{ venue_key: "main", config: {
  staff: [{ id: 1, name: "Мария Ким", pos: "manager" }, { id: 2, name: "Анна Смирнова", pos: "waiter" }, { id: 3, name: "Пётр Орлов", pos: "waiter" }, { id: 4, name: "Илья Белов", pos: "bar" }, { id: 5, name: "Ольга Ли", pos: "host" }],
  shifts: [{ k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }] } }],
  months: [{ venue_key: "main", month: "2026-10", payload: { plan: { 1: { 23: "Д" }, 2: { 23: "Д" }, 3: { 23: "В" }, 4: { 23: "В" }, 5: { 23: "Д" } } } }] };
const LEAGUE = { ok: true, week_start: "2026-10-19", restaurant: R0, rows: [
  { id: "e2", name: "Анна", surname: "Смирнова", restaurant: R0, pts: 48 }, { id: "e3", name: "Пётр", surname: "Орлов", restaurant: R0, pts: 31 },
  { id: "e9", name: "Гость", surname: "Х.", restaurant: "Порт", pts: 99 }, { id: "u-lead", name: "Мария", surname: "Ким", restaurant: R0, pts: 12, me: true },
], cup: [], cup_hist: [] };
const BRIEF_DATA = { v: 1, day: "2026-10-23", dayLabel: "23 октября", restaurant: R0, author: "Мария Ким",
  blocks: {
    roster: [{ k: "Д", name: "День", from: 12, to: 20, people: ["Мария Ким", "Анна Смирнова"], groups: [{ t: "Менеджер", names: ["Мария Ким"] }, { t: "Официант", names: ["Анна Смирнова"] }] }],
    stop: ["Борщ с уткой"],
    fresh: [{ id: "d2", name: "Тартар из тунца", cat: "Закуски", voice: true }],
    focus: [{ q: M1.q, right: M1.options[M1.correct], why: String(M1.explanation || ""), topic: M1.lessonTitle, pct: 60, n: 10 }],
    ask: { q: M3.q, options: M3.options, correct: M3.correct, why: String(M3.explanation || ""), topic: M3.lessonTitle, from: "hard" },
    thanks: [{ name: "Анна", surname: "Смирнова", pts: 48 }],
    note: "Банкет на 12 человек в 19:00",
  },
  on: { roster: true, stop: true, fresh: true, focus: true, ask: true, thanks: false, note: true } };
const TODAY = { ok: true, day: "2026-10-23", brief: { data: BRIEF_DATA, author: "Мария Ким", mine: false, sent: 4, at: "2026-10-23T01:50:00Z" } };

const ABORT = Symbol("abort");
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function open({ who = STAFF, rpcs = () => undefined, calls = [], telegram = false, light = false, w = 393, h = 852, path = "/" } = {}) {
  const UK = ukOf(who);
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
      if (own === ABORT) return route.abort();   // нет связи
      if (own !== undefined) return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own) });
      const mock = { whoami: { ok: true, employee: who }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] }, schedule_load: { ok: false, error: "auth" }, menu_get: [],
        qday_inbox: { ok: true, items: [] } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }) };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript(([seed, telegram]) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (telegram) {
      window.Telegram = { WebApp: { initData: "query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc", platform: "ios", initDataUnsafe: {}, ready() {}, expand() {}, setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {},
        openTelegramLink() {}, requestWriteAccess(cb) { setTimeout(() => cb && cb(true), 30); },
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
        BackButton: { show() { window.__tgBackShown = true; }, hide() { window.__tgBackShown = false; }, onClick(fn) { window.__tgBack = fn; }, offClick() {} } } };
    }
  }, [seed, telegram]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + path, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors, calls, UK };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const toShift = async (page) => { await page.evaluate(() => window.__saNav("shift")); await sleep(1400); };

if (want("LEAD")) {
  for (const light of [false, true]) {
    const tag = "LEAD" + (light ? " светлая" : "");
    let published = null;
    const o = await open({ who: LEAD, light, rpcs: (fn, body) => {
      if (fn === "menu_get") return MENU;
      if (fn === "quiz_hard_questions") return HARD;
      if (fn === "schedule_load") return SCHED;
      if (fn === "league_week") return LEAGUE;
      if (fn === "brief_today") return published ? { ok: true, day: "2026-10-23", brief: { data: published.p_data, author: "Мария Ким", mine: true, sent: 3, at: "2026-10-23T02:20:00Z" } } : { ok: true, day: "2026-10-23", brief: null };
      if (fn === "brief_publish") { published = body; return { ok: true, day: "2026-10-23", sent: 3, again: false, bot: true }; }
      return undefined;
    } });
    await sleep(1200);
    await toShift(o.page);
    const item = o.page.locator('.sa-card[aria-label="Брифинг смены"]');
    const itemTxt = await txt(item);
    // v106 (Доп. 419): первым в «На смене» — «Утро руководителя», брифинг — сразу за ним
    ok(tag + ": в «Смене» у руководителя пункт «Брифинг смены» в «На смене», первым (с v106 — сразу за «Утро руководителя»)", /Пять минут перед сменой: график, стоп-лист, фокус по ошибкам команды/.test(itemTxt)
      && (await o.page.evaluate(() => {
        const is = (el, l) => !!el && (el.getAttribute("aria-label") === l || !!el.querySelector('[aria-label="' + l + '"]'));
        const g = document.querySelector('[data-hub-group="На смене"]'); let c = g && g.nextElementSibling;
        if (is(c, "Утро руководителя")) c = c.nextElementSibling;
        return is(c, "Брифинг смены"); })), itemTxt);
    ok(tag + ": брифинга сегодня ещё нет — карточки в «Смене» нет", !(await o.page.locator("[data-brief-card]").count()));
    await item.first().click(); await sleep(2600);
    const block = (k) => o.page.locator(`[data-brief-block="${k}"]`);
    const roster = await txt(block("roster"));
    ok(tag + ": «Кто сегодня» — по сменам и позициям, как в графике", /День · 12:00–20:00 Менеджер: Мария Ким Хостес: Ольга Ли Официант: Анна Смирнова Вечер · 16:00–24:00 Бар: Илья Белов Официант: Пётр Орлов/.test(roster), roster);
    // v86: вместо пометки «есть голос шефа» — сама запись, послушать прямо в брифинге
    ok(tag + ": стоп-лист и новинки (с голосом шефа)", /Борщ с уткой/.test(await txt(block("stop"))) && /Тартар из тунца Шеф 0:12 Паста с крабом/.test(await txt(block("fresh")))
      && (await block("fresh").locator('[data-brief-voices="d2"] [data-voice="chef"]').count()) === 1, await txt(block("fresh")));
    const focus = await txt(block("focus"));
    ok(tag + ": фокус смены — два трудных вопроса из программы с верным ответом и долей ошибок; вопроса не из программы нет",
      focus.includes(M1.q.replace(/\s+/g, " ").trim()) && focus.includes("Верно: " + String(M1.options[M1.correct]).replace(/\s+/g, " ").trim()) && /Ошибаются 60% · ответов за 30 дней: 10/.test(focus)
      && focus.includes(M2.q.replace(/\s+/g, " ").trim()) && /Ошибаются 50%/.test(focus) && !/Вопроса больше нет/.test(focus), focus.slice(0, 200));
    const ask = await txt(block("ask"));
    ok(tag + ": вопрос команде — следующий трудный, с вариантами А, Б…", ask.includes(M3.q.replace(/\s+/g, " ").trim()) && /А\. /.test(ask) && /Б\. /.test(ask), ask.slice(0, 160));
    ok(tag + ": «Спасибо» — лидеры недели своего заведения", /Анна Смирнова · 48 очков за неделю Пётр Орлов · 31 очко за неделю Мария Ким · 12 очков за неделю/.test(await txt(block("thanks"))) && !/Гость/.test(await txt(block("thanks"))), await txt(block("thanks")));
    await shot(o.page, "lead-brief" + (light ? "-light" : ""));
    // выключить «Спасибо», дописать своё
    await block("thanks").locator('[role="switch"]').click(); await sleep(300);
    ok(tag + ": выключатель — блок погашен", (await block("thanks").getAttribute("data-on")) === "0" && (await block("thanks").locator('[role="switch"]').getAttribute("aria-checked")) === "false");
    await block("note").locator("textarea").fill("Банкет на 12 человек в 19:00"); await sleep(400);
    const barY = () => o.page.evaluate(() => { const r = document.querySelector("[data-brief-bar]").getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), innerHeight]; });
    const typingY = await barY();
    await block("note").locator("textarea").blur(); await sleep(450);
    const restY = await barY();
    ok(tag + ": полоса кнопок — у нижнего края окна; пока печатаешь «Своё», уезжает вниз", typingY[0] >= typingY[2] - 2 && restY[1] <= restY[2] + 1 && restY[0] < restY[2] - 40, JSON.stringify({ typingY, restY }));
    // провести
    await o.page.locator("[data-brief-present]").click(); await sleep(500);
    const show = o.page.locator("[data-brief-show]");
    const pages = [];
    for (let i = 0; i < 8; i++) {
      pages.push(await show.locator("[data-brief-page]").getAttribute("data-brief-page"));
      if (pages[pages.length - 1] === "ask") {
        const before = await txt(show);
        const why = String(M3.explanation || "").replace(/\s+/g, " ").trim().slice(0, 30);
        await show.locator("[data-brief-reveal]").click(); await sleep(250);
        const after = await txt(show);
        ok(tag + ": «Провести», вопрос команде: ответ и разбор — только по кнопке «Показать ответ»", /Показать ответ/.test(before) && !before.includes(why) && after.includes(why) && !/Показать ответ/.test(after), why);
        await shot(o.page, "lead-show-ask" + (light ? "-light" : ""));
      }
      if (!(await show.locator("[data-brief-next]").count())) break;
      await show.locator("[data-brief-next]").click(); await sleep(250);
    }
    ok(tag + ": «Провести» — по одному блоку, выключенного «Спасибо» нет", pages.join(",") === "roster,stop,fresh,focus,ask,note", pages.join(","));
    ok(tag + ": последний блок — «Своё» и «Хорошей смены»", /Банкет на 12 человек в 19:00/.test(await txt(show)) && /Хорошей смены/.test(await txt(show)));
    const t0 = await txt(show.locator("[data-brief-timer]")); await sleep(2300); const t1 = await txt(show.locator("[data-brief-timer]"));
    ok(tag + ": секундомер идёт", /^0:0\d$/.test(t0) && /^0:0\d$/.test(t1) && t1 !== t0, t0 + " → " + t1);
    await show.locator("[data-sa-back]").click(); await sleep(300);
    ok(tag + ": показ закрывается", !(await o.page.locator("[data-brief-show]").count()));
    // отправить
    await o.page.locator("[data-brief-publish]").click(); await sleep(1200);
    const p = published || {};
    const d = p.p_data || {}, tx = String(p.p_text || "");
    ok(tag + ": brief_publish — токен, блоки и выключатели как на экране, своё", p.p_token === "tok-preview" && d.v === 1 && d.day === "2026-10-23" && d.on && d.on.thanks === false && d.on.roster === true && d.blocks && d.blocks.note === "Банкет на 12 человек в 19:00" && Array.isArray(d.blocks.focus) && d.blocks.focus.length === 2, JSON.stringify(d.on));
    ok(tag + ": текст для Telegram — блоки по порядку, без «Спасибо», вопрос команде без ответа",
      tx.startsWith("Брифинг смены · 23 октября\nОтправил(а): Мария Ким\n\nКто сегодня:\nДень 12:00–20:00. Менеджер: Мария Ким · Хостес: Ольга Ли · Официант: Анна Смирнова") && !/Спасибо:/.test(tx)
      && tx.includes("Вопрос команде: «") && tx.includes("» Ответ в приложении.") && !tx.includes(String(M3.explanation || "").trim().slice(0, 30)) && tx.endsWith("Банкет на 12 человек в 19:00"), tx.slice(0, 260));
    const st = await txt(o.page.locator('[role="status"]'));
    ok(tag + ": итог отправки — сколько получили в Telegram", /Отправлено: брифинг в «Смене» у всей команды\. В Telegram ушло 3 сотрудникам\./.test(st), st);
    ok(tag + ": после отправки — «Отправить правку» и пометка «Сегодня уже отправлен»", /Отправить правку/.test(await txt(o.page.locator("[data-brief-publish]"))) && (await o.page.locator("[data-brief-sent]").count()) === 1);
    await shot(o.page, "lead-sent" + (light ? "-light" : ""));
    // назад в «Смену»
    await o.page.locator('button[aria-label="Вернуться"]').first().click(); await sleep(1500);
    const item2 = await txt(o.page.locator('.sa-card[aria-label="Брифинг смены"]'));
    const card = o.page.locator("[data-brief-card]");
    ok(tag + ": в «Смене» — карточка отправленного брифинга (своя, без точки) и «Сегодня отправлен» у пункта",
      (await card.count()) === 1 && (await card.getAttribute("data-seen")) === "1" && /Брифинг смены · Мария Ким/.test(await txt(card)) && /Сегодня отправлен\. Можно поправить/.test(item2), item2);
    await shot(o.page, "lead-shift" + (light ? "-light" : ""));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("STAFF")) {
  for (const light of [false, true]) {
    const tag = "STAFF" + (light ? " светлая" : "");
    const o = await open({ who: STAFF, light, telegram: true, rpcs: (fn) => (fn === "brief_today" ? TODAY : undefined) });
    await sleep(1200);
    await toShift(o.page);
    const card = o.page.locator("[data-brief-card]");
    // v86: на карточке — главное из брифинга, а не названия блоков
    ok(tag + ": вверху «Смены» — карточка брифинга: от кого и главное, непрочитанная",
      (await card.count()) === 1 && (await card.getAttribute("data-seen")) === "0" && /Брифинг смены · Мария Ким Стоп-лист: Борщ с уткой · новинка: Тартар из тунца · Банкет на 12 человек в 19:00/.test(await txt(card)), await txt(card));
    ok(tag + ": пункта «Брифинг смены» у сотрудника нет", !(await o.page.locator('.sa-card[aria-label="Брифинг смены"]').count()));
    const pos = await o.page.evaluate(() => { const c = document.querySelector("[data-brief-card]"); const q = [...document.querySelectorAll("*")].find((e) => /Квест смены|Твоя часть/.test(e.textContent || "") && e.children.length === 0); return c && q ? !!(c.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING) : null; });
    ok(tag + ": карточка — над квестом смены", pos !== false, String(pos));
    await shot(o.page, "staff-shift" + (light ? "-light" : ""));
    await card.click(); await sleep(700);
    const view = o.page.locator("[data-brief-view]");
    const ks = await view.locator("[data-brief-block]").evaluateAll((els) => els.map((e) => e.getAttribute("data-brief-block")));
    ok(tag + ": чтение — включённые блоки по порядку («Спасибо» выключено)", ks.join(",") === "roster,stop,fresh,focus,ask,note", ks.join(","));
    const v1 = await txt(view);
    const why = String(M3.explanation || "").replace(/\s+/g, " ").trim().slice(0, 30);
    ok(tag + ": от кого, верный ответ фокуса виден, ответ на вопрос команде — по кнопке", /Брифинг смены · 23 октября Отправил\(а\): Мария Ким/.test(v1) && v1.includes("Верно: " + String(M1.options[M1.correct]).replace(/\s+/g, " ").trim()) && /Показать ответ/.test(v1) && !v1.includes(why), v1.slice(0, 120));
    await shot(o.page, "staff-view" + (light ? "-light" : ""));
    await view.locator("[data-brief-reveal]").click(); await sleep(250);
    ok(tag + ": «Показать ответ» — разбор", (await txt(view)).includes(why));
    ok(tag + ": кнопка «Назад» Telegram видна над чтением", await o.page.evaluate(() => window.__tgBackShown === true));
    await o.page.evaluate(() => window.__tgBack && window.__tgBack()); await sleep(500);
    ok(tag + ": «Назад» Telegram закрывает чтение, «Смена» на месте", !(await o.page.locator("[data-brief-view]").count()) && (await o.page.locator("[data-brief-card]").count()) === 1);
    const seen = await o.page.evaluate((uk) => localStorage.getItem("sa_brief_seen" + uk), o.UK);
    ok(tag + ": прочитано — точки больше нет (и после перезапуска)", (await card.getAttribute("data-seen")) === "1" && seen === "2026-10-23|2026-10-23T01:50:00Z", String(seen));
    ok(tag + ": brief_today — один запрос за вход в «Смену»", o.calls.filter((c) => c.fn === "brief_today").length === 1, String(o.calls.filter((c) => c.fn === "brief_today").length));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("LINK")) {
  {
    const o = await open({ who: STAFF, path: "/?go=brief", rpcs: (fn) => (fn === "brief_today" ? TODAY : undefined) });
    await sleep(2500);
    const view = o.page.locator("[data-brief-view]");
    ok("LINK: ?go=brief — сразу чтение брифинга", (await view.count()) === 1 && /Отправил\(а\): Мария Ким/.test(await txt(view)));
    await view.locator("[data-sa-back]").click(); await sleep(600);
    ok("LINK: под ним — «Смена» с карточкой (уже прочитанной)", (await o.page.locator("[data-brief-card]").getAttribute("data-seen")) === "1");
    await shot(o.page, "link-brief");
    ok("LINK: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
  {
    const o = await open({ who: STAFF, path: "/?go=brief", rpcs: (fn) => (fn === "brief_today" ? { ok: true, day: "2026-10-23", brief: null } : undefined) });
    await sleep(2500);
    ok("LINK: брифинга нет — просто «Смена», без чтения и карточки", !(await o.page.locator("[data-brief-view]").count()) && !(await o.page.locator("[data-brief-card]").count())
      && (await o.page.locator('.sa-card[aria-label="График"]').count()) === 1);
    ok("LINK: без брифинга — без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("MISSING")) {
  const miss = { code: "PGRST202", message: "Could not find the function" };
  {
    const o = await open({ who: STAFF, rpcs: (fn) => (fn === "brief_today" ? miss : undefined) });
    await sleep(1200); await toShift(o.page);
    ok("MISSING: сотрудник — карточки нет, «Смена» как была", !(await o.page.locator("[data-brief-card]").count()) && (await o.page.locator('.sa-card[aria-label="График"]').count()) === 1);
    ok("MISSING: сотрудник — без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
  {
    // график и лига не пришли (нет связи): блоки говорят, что пусто, «Отправить» не ждёт вечно
    const o = await open({ who: LEAD, rpcs: (fn) => (fn === "brief_today" || fn === "brief_publish" ? miss : fn === "menu_get" ? MENU : fn === "quiz_hard_questions" ? HARD : fn === "schedule_load" || fn === "league_week" ? ABORT : undefined) });
    await sleep(1200); await toShift(o.page);
    await o.page.locator('.sa-card[aria-label="Брифинг смены"]').first().click(); await sleep(2600);
    const rs = await txt(o.page.locator('[data-brief-block="roster"]')), th = await txt(o.page.locator('[data-brief-block="thanks"]'));
    ok("MISSING: график и лига не пришли — блоки пустые с пояснением, не «Собираю…», «Отправить» доступна",
      /график не заполнен или выходной/.test(rs) && /очков пока нет/.test(th) && !(await o.page.locator("[data-brief-publish]").isDisabled()), rs + " | " + th);
    await o.page.locator("[data-brief-publish]").click(); await sleep(900);
    const st = await txt(o.page.locator('[role="status"]'));
    ok("MISSING: руководитель — «Отправить» говорит, что этапа 32 нет, и что провести можно", /На сервере ещё нет этапа 32 \(supabase-stage32-briefing\.sql\)\. Провести брифинг можно и без него\./.test(st), st);
    await o.page.locator("[data-brief-present]").click(); await sleep(400);
    ok("MISSING: «Провести» без сервера работает", (await o.page.locator("[data-brief-show] [data-brief-page]").count()) === 1);
    await shot(o.page, "missing-lead");
    ok("MISSING: руководитель — без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("NARROW")) {
  const o = await open({ who: LEAD, w: 320, h: 640, rpcs: (fn) => (fn === "menu_get" ? MENU : fn === "quiz_hard_questions" ? HARD : fn === "schedule_load" ? SCHED : fn === "league_week" ? LEAGUE : fn === "brief_today" ? { ok: true, brief: null } : undefined) });
  await sleep(1200); await toShift(o.page);
  await o.page.locator('.sa-card[aria-label="Брифинг смены"]').first().click(); await sleep(2600);
  const fit = () => o.page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const over = [...document.querySelectorAll("[data-brief-block], [data-brief-show] *, [data-brief-present], [data-brief-publish]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).length;
    return { W, sw: document.documentElement.scrollWidth, over };
  });
  const a = await fit();
  const btns = await o.page.evaluate(() => ["[data-brief-present]", "[data-brief-publish]"].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 && r.width > 80; }));
  ok("NARROW: 320 px — экран без прокрутки вбок, «Провести» и «Отправить команде» видны целиком", a.sw <= a.W && a.over === 0 && btns.every(Boolean), JSON.stringify({ ...a, btns }));
  await shot(o.page, "narrow-lead");
  await o.page.locator("[data-brief-present]").click(); await sleep(400);
  for (let i = 0; i < 3; i++) { await o.page.locator("[data-brief-next]").click(); await sleep(200); }
  const b = await fit();
  const nav = await o.page.evaluate(() => { const r = document.querySelector("[data-brief-next]").getBoundingClientRect(); return r.bottom <= innerHeight && r.width > 80; });
  ok("NARROW: 320 px — показ без прокрутки вбок, «Дальше» на экране", b.sw <= b.W && b.over === 0 && nav, JSON.stringify({ ...b, nav }));
  await shot(o.page, "narrow-show");
  ok("NARROW: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("PREFS")) {
  let prefs = { ok: true, bot: true, linked: true, remind: true, pair: true, quest: true, league: true, fresh: true, month: true, master: true, qday: true, qday_hour: 12, brief: true };
  const o = await open({ who: STAFF, telegram: true, rpcs: (fn, body) => {
    if (fn === "tg_status") return { ok: true, bot: true, linked: true, remind: true, minutes: 60 };
    if (fn === "notify_prefs") return prefs;
    if (fn === "notify_set") { prefs = { ...prefs, [body.p_kind]: !!body.p_on }; return prefs; }
    if (fn === "brief_today") return { ok: true, brief: null };
    return undefined;
  } });
  await sleep(1500);
  await toShift(o.page);
  await o.page.locator('.sa-card[aria-label="Напоминания в Telegram"]').first().click(); await sleep(1400);
  const row = o.page.locator('[data-notify-prefs] [role="switch"]', { hasText: "Брифинг смены" });
  const t = await txt(row);
  // v86: строки группами — «Брифинг смены» в группе «Смена» (раньше была последней в общем списке)
  ok("PREFS: строка «Брифинг смены» — в группе «Смена», включена", /Брифинг смены когда руководитель отправляет брифинг команде/.test(t) && (await row.getAttribute("aria-checked")) === "true"
    && (await o.page.locator('[data-notify-group="shift"] [role="switch"]', { hasText: "Брифинг смены" }).count()) === 1, t);
  await row.scrollIntoViewIfNeeded(); await shot(o.page, "prefs");
  await row.click(); await sleep(700);
  const set = o.calls.filter((c) => c.fn === "notify_set").map((c) => c.body);
  ok("PREFS: переключатель — notify_set brief выкл", set.length === 1 && set[0].p_kind === "brief" && set[0].p_on === false && (await row.getAttribute("aria-checked")) === "false", JSON.stringify(set));
  ok("PREFS: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
