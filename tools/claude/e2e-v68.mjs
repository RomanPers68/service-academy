// e2e v68 (Доп. 381): главная карточка «Приглашение» и свеча, которая не спорит с бокалом.
// Владелец (хостес, «Два моря, Океан», 22.10 в 10:34 по Камчатке, смена «День» 11–24): «0 дней подряд» рядом с «цель
// дня 1/1». Разделы:
//   HEAL   — шаг сегодня есть, а свеча не горит — зажигается сама, «1 день подряд»; серия сохранилась на телефоне;
//   LOGIN  — вход по коду без перезапуска: серия с телефона (7 дней), а не ноль; шаг продолжает её — 8;
//   DARK   — тёмная: чёрная карта, линза как у кнопки AI, «Начать»; тап — разминка; «Дальше» — следующий урок;
//   LIGHT  — светлая: белая бумага, сургучная печать; тап — разминка;
//   TRACK  — выходной: приглашение к следующему шагу трека; тап — урок; строка «Шаг дня» — шаг (не урок);
//   ROWS   — графика нет: строки «Разминка» и «Шаг дня»; тап по «Разминке» — разминка;
//   TG     — в Telegram: «Напоминать в Telegram за час до смены» — под карточкой;
//   MOOD   — после смены: лица, ответ «Хорошо» — разбор и «Не сейчас» — приглашение к треку;
//   DURING — на смене: SOS — шпаргалка;  BACK — после перерыва: «С возвращением» — разминка;
//   FIRST  — первый день: первый урок, без строк;  HINT — подсказка главной показывает на карточку;
//   WIDE   — лёжа и на компьютере;  NARROW — 360 px: карточка не шире экрана, корешок на месте.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v68.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5268, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v68";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { SPG_MODULES } = await import(SRC + "/data/modules-spg.js");
// вопросы теста «Философия сервиса» (spg-0-q): тест берёт часть из них — экран теста узнаём по любому
const QUIZ = (() => { const seen = new Set(); let found = null;
  const walk = (o) => { if (!o || typeof o !== "object" || seen.has(o) || found) return; seen.add(o); if (o.id === "spg-0-q") { found = o; return; } for (const v of Object.values(o)) walk(v); };
  walk(SPG_MODULES); return found ? found.questions.map((x) => x.q) : []; })();
if (!QUIZ.length) throw new Error("нет вопросов теста spg-0-q");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const OWNER = { id: "u-own", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "owner", is_admin: true };
const uk = "_" + OWNER.name + "_";
const NOW = new Date("2026-10-21T22:34:00Z");        // 22.10 10:34 по Камчатке
const TODAY = "2026-10-22", YDAY = "2026-10-21";
const DONE = { "spg-0-1": true, "spg-0-2": true, "spg-0-3": true, "spg-0-4": true, "spg-0-d": true };
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sched = (k) => JSON.stringify({ cfg: { staff: [{ id: "s1", name: "Роман" }], shifts: [{ k: "Д", name: "День", from: 11, to: 24 }, { k: "У", name: "Утро", from: 8, to: 10 }] },
  plan: { s1: k ? { 22: k, 23: "Д" } : { 23: "Д", 24: "Д" } }, ts: NOW.getTime() });

async function open({ light = false, w = 393, h = 852, dsf = 2, at = null, shift = "day", steps = 1, streak = null, fresh = false, noToken = false, telegram = false, hints = false, act = null, lastOpen = null, rpcs = null, calls = [], extra = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: w < 900, hasTouch: w < 900, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const fn = m[1];
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      calls.push({ fn, body });
      if (rpcs) { const r = rpcs(fn, body); if (r !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r) }); }
      const mock = {
        whoami: { ok: true, employee: OWNER }, redeem_code: { ok: true, token: "tok-new", employee: OWNER },
        my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: fresh ? [] : Object.keys(DONE), stars: {}, roles: [], last_role: "spg" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] },
        schedule_load: { ok: false, error: "auth" }, menu_get: [],
      };
      if (mock[fn] !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[fn]) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    }
    if (/\/functions\/v1\/ai-chat/.test(u)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reply: "Разберём по шагам.", remaining: 18 }) });
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_quest_open: "1",
    ...(noToken ? {} : { sa_session_token: "tok-preview", sa_profile: JSON.stringify(OWNER) }),
    ["sa_last_role" + uk]: JSON.stringify("spg"),
    ...(fresh ? {} : { ["sa_completed" + uk]: JSON.stringify(DONE), ["sa_goal" + uk]: "1",
      ["sa_activity" + uk]: JSON.stringify(act || (steps ? { [TODAY]: { st: steps, l: steps }, [YDAY]: { st: 2, l: 2 } } : { [YDAY]: { st: 2, l: 2 } })),
      ["sa_life" + uk]: JSON.stringify({ st: 3, l: 3, since: YDAY }) }),
    ...(lastOpen ? { ["sa_last_open" + uk]: lastOpen } : {}),
    ...(streak ? { ["sa_streak" + uk]: JSON.stringify(streak) } : {}),
    ...(shift === "none" ? {} : { sa_today_shift: JSON.stringify({ date: TODAY, label: shift === "off" ? "выходной" : shift === "morning" ? "Утро · 08:00–10:00" : "День · 11:00–24:00" }),
      "sa_sched_cache_main_2026-10": sched(shift === "off" ? null : shift === "morning" ? "У" : "Д") }),
    ...extra };
  if (!hints) { for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1"; seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1"; }
  await ctx.addInitScript(([seed, telegram]) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (telegram) window.Telegram = { WebApp: { initData: "query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc", platform: "ios", initDataUnsafe: {}, ready() {}, expand() {}, setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {},
      HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} }, BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} }, safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 }, onEvent() {}, offEvent() {} } };
  }, [seed, telegram]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(at || NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(2000);
  return { ctx, page, errors, calls };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const card = (p) => p.evaluate(() => {
  const c = document.querySelector("[data-now-card]");
  if (!c) return null;
  const q = (s) => { const e = c.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; };
  const r = c.getBoundingClientRect(), stub = c.querySelector("[data-now-stub]"), sr = stub ? stub.getBoundingClientRect() : null;
  return { mode: c.getAttribute("data-now-card"), hero: c.getAttribute("data-hero"), tag: q("[data-now-tag]"), title: q("[data-now-title]"), cta: q("[data-now-cta]"),
    lens: !!c.querySelector("[data-now-lens]"), seal: !!c.querySelector("[data-now-seal]"), rows: [...c.querySelectorAll("[data-now-row]")].map((e) => e.getAttribute("data-now-row") + ":" + e.innerText.replace(/\s+/g, " ").trim()),
    moods: c.querySelectorAll("[data-now-moods] button").length, w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right), vw: window.innerWidth,
    stubIn: !!(sr && sr.right <= r.right + 1 && sr.left >= r.left), text: c.innerText.replace(/\s+/g, " ") };
});
const chips = (p) => p.evaluate(() => { const e = document.querySelector("[data-day-panel]"); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; });
const body = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
// открыт тест «Философия сервиса»: «Тест 1 / N» и вопрос из spg-0-q; карточки главной нет
const onQuiz = async (p) => { const t = await body(p); return /Тест 1 \/ \d+/.test(t) && QUIZ.some((q) => t.includes(q)) && !(await p.$("[data-now-card]")); };
const warmOpen = (p) => p.evaluate(() => /Разминка до смены/.test(document.body.innerText));

if (want("HEAL")) {
  const o = await open({ steps: 1, streak: null });
  const c = await chips(o.page);
  const st = await o.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), "sa_streak" + uk);
  ok("HEAL: шаг сегодня есть (цель 1/1), свечи не было — горит «1 день подряд»", /^1 ДЕНЬ/.test(c || "") && /1\/1/.test(c || ""), c);
  ok("HEAL: серия записана на телефон — 1 день, последний — сегодня", st && st.count === 1 && st.last === TODAY, JSON.stringify(st));
  ok("HEAL: пламя горит", await o.page.evaluate(() => !!document.querySelector('[data-emb="flame"][data-lit="1"]')));
  await shot(o.page, "heal");
  ok("HEAL: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
  // вчера — 6 дней подряд; сегодня шаг есть, а свеча не обновилась — 7, а не 1
  const q = await open({ steps: 1, streak: { count: 6, best: 6, last: YDAY, days: [YDAY] } });
  ok("HEAL: вчера было 6 дней подряд — сегодня 7", /^7 ДНЕЙ/.test(await chips(q.page) || ""), await chips(q.page));
  await q.ctx.close();
  // прервалась (последний день 5 дней назад, графика нет) — табличка честно показывает 0, без шагов сегодня
  const b = await open({ steps: 0, shift: "none", streak: { count: 5, best: 5, last: "2026-10-17", days: ["2026-10-17"] } });
  ok("HEAL: серия прервалась — 0, а не прежние 5", /^0 ДНЕЙ/.test(await chips(b.page) || ""), await chips(b.page));
  await b.ctx.close();
}

if (want("LOGIN")) {
  // на телефоне — серия 7 дней (вчера); вход по коду без перезапуска приложения
  const o = await open({ noToken: true, steps: 0, streak: { count: 7, best: 7, last: YDAY, days: [YDAY] } });
  ok("LOGIN: без входа — экран кода", !!(await o.page.$('input[placeholder="Введите код"]')));
  await o.page.fill('input[placeholder="Введите код"]', "ROMAN-1");
  await o.page.locator("button.sa-btn-pulse").click(); await sleep(2500);
  const c = await chips(o.page);
  ok("LOGIN: после входа — серия с телефона: «7 дней», а не 0", /^7 ДНЕЙ/.test(c || ""), c);
  // шаг (тренажёр) — серия продолжается: 8
  await o.page.evaluate(() => window.dispatchEvent(new CustomEvent("sa:activity", { detail: { kind: "trainer" } }))); await sleep(800);
  const st = await o.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), "sa_streak" + uk);
  ok("LOGIN: шаг после входа продолжает серию — 8, а не 1", st && st.count === 8 && st.last === TODAY, JSON.stringify(st));
  ok("LOGIN: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("DARK")) {
  const o = await open({});
  let g = await card(o.page);
  ok("DARK: до смены — чёрная карта: «До смены 26 мин», «Разминка перед сменой»", g && g.mode === "before" && g.hero === "black" && g.tag === "До смены 26 мин" && g.title === "Разминка перед сменой", JSON.stringify(g));
  ok("DARK: на корешке — линза, как кнопка AI, и «Начать»; сургуча нет", g && g.lens && !g.seal && g.cta === "Начать" && g.stubIn, JSON.stringify(g));
  // v69 (Доп. 382): под тем же стеклом — тон панели меню (кнопка AI стоит на ней), иначе линза выходила темнее
  const lens = await o.page.evaluate(() => { const a = document.querySelector("[data-now-lens]"), b = document.querySelector("[data-ai-disc]"); const s = (e) => e ? getComputedStyle(e) : null; return { a: s(a) && [s(a).backgroundImage, s(a).boxShadow], b: s(b) && [s(b).backgroundColor, s(b).boxShadow] }; });
  ok("DARK: линза — то же стекло, что у кнопки AI (стекло и кромки; под стеклом — тон панели меню)", lens.a && lens.b && lens.a[0].includes(lens.b[0]) && lens.a[1] === lens.b[1], JSON.stringify(lens));
  ok("DARK: строка «Дальше: Тест «Философия сервиса»»", g && g.rows.length === 1 && /^next:Дальше: Тест «Философия сервиса»/.test(g.rows[0]), JSON.stringify(g && g.rows));
  await shot(o.page, "dark-before");
  const was = await warmOpen(o.page);
  await o.page.locator("[data-now-card]").click(); await sleep(1500);
  ok("DARK: тап по карточке — разминка (до тапа её не было)", !was && await warmOpen(o.page));
  await o.ctx.close();
  const q = await open({});
  await q.page.locator('[data-now-row="next"]').click(); await sleep(1500);
  const t = await body(q.page);
  ok("DARK: «Дальше» — следующий урок трека (тест «Философия сервиса»), а не разминка", (await onQuiz(q.page)) && !/Разминка до смены/.test(t), t.slice(0, 140));
  ok("DARK: без ошибок", !o.errors.length && !q.errors.length, [...o.errors, ...q.errors].join(" | "));
  await q.ctx.close();
}

if (want("LIGHT")) {
  const o = await open({ light: true });
  const g = await card(o.page);
  ok("LIGHT: белая бумага, сургучная печать, «Начать»; линзы нет", g && g.hero === "paper" && g.seal && !g.lens && g.cta === "Начать", JSON.stringify(g));
  const bg = await o.page.evaluate(() => getComputedStyle(document.querySelector("[data-now-card] > div")).backgroundImage);
  ok("LIGHT: бумага — белая (#FFFDF8 → #F7EEDC)", /255, 253, 248/.test(bg), bg.slice(0, 160));
  await shot(o.page, "light-before");
  const was = await warmOpen(o.page);
  await o.page.locator("[data-now-stub]").click(); await sleep(1500);
  ok("LIGHT: тап по корешку — разминка (до тапа её не было)", !was && await warmOpen(o.page));
  ok("LIGHT: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("TRACK")) {
  const o = await open({ shift: "off" });
  const g = await card(o.page);
  ok("TRACK: выходной — приглашение к следующему шагу: «Хостес · пройдено 8%», «Тест «Философия сервиса»», «Дальше»", g && g.mode === "track" && g.tag === "Хостес · пройдено 8%" && g.title === "Тест «Философия сервиса»" && g.cta === "Дальше", JSON.stringify(g));
  ok("TRACK: строка «Шаг дня», разминки в выходной нет", g && g.rows.length === 1 && /^step:Шаг дня:/.test(g.rows[0]), JSON.stringify(g && g.rows));
  await shot(o.page, "track-dayoff");
  await o.page.locator('[data-now-row="step"]').click(); await sleep(1500);
  const t = await body(o.page);
  ok("TRACK: «Шаг дня» — сам шаг, а не урок трека", !/20 вопросов/.test(t) && !(await o.page.$('[data-now-card="track"]')), t.slice(0, 140));
  await o.ctx.close();
  const q = await open({ shift: "off" });
  await q.page.locator("[data-now-card]").click(); await sleep(1500);
  const t2 = await body(q.page);
  ok("TRACK: тап по карточке — тест «Философия сервиса»", await onQuiz(q.page), t2.slice(0, 140));
  ok("TRACK: без ошибок", !o.errors.length && !q.errors.length, [...o.errors, ...q.errors].join(" | "));
  await q.ctx.close();
}

if (want("ROWS")) {
  const o = await open({ shift: "none" });
  const g = await card(o.page);
  ok("ROWS: графика нет — строки «Разминка: 2 мин · перед сменой» и «Шаг дня»", g && g.mode === "track" && g.rows.length === 2 && /^warm:Разминка: 2 мин · перед сменой/.test(g.rows[0]) && /^step:Шаг дня:/.test(g.rows[1]), JSON.stringify(g && g.rows));
  const was = await warmOpen(o.page);
  await o.page.locator('[data-now-row="warm"]').click(); await sleep(1500);
  ok("ROWS: «Разминка» — разминка (до тапа её не было)", !was && await warmOpen(o.page));
  ok("ROWS: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("TG")) {
  const o = await open({ shift: "none", telegram: true });
  const r = await o.page.evaluate(() => { const c = document.querySelector("[data-now-card]"); const hint = [...document.querySelectorAll("div")].find((e) => /^Напоминать в Telegram за час до смены/.test(e.innerText || "") && e.children.length === 0);
    return { has: !!hint, below: !!(hint && c && hint.getBoundingClientRect().top >= c.getBoundingClientRect().bottom - 1) }; });
  ok("TG: «Напоминать в Telegram за час до смены» — под карточкой", r.has && r.below, JSON.stringify(r));
  await shot(o.page, "tg-rows");
  ok("TG: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("MOOD")) {
  const calls = [];
  const o = await open({ shift: "morning", calls });
  let g = await card(o.page);
  ok("MOOD: после утренней смены — «Смена позади», «Как прошла смена?», пять лиц, кнопки на корешке нет", g && g.mode === "after" && g.tag === "Смена позади" && g.moods === 5 && !g.cta, JSON.stringify(g));
  await shot(o.page, "mood");
  await o.page.locator('[data-now-moods] button[aria-label="Хорошо"]').click(); await sleep(800);
  g = await card(o.page);
  const sent = calls.find((c) => c.fn === "save_mood");
  ok("MOOD: «Хорошо» — «Хорошая смена ✦», «Рассказать», настрой ушёл на сервер", g && g.mode === "reply" && /Хорошая смена/.test(g.title) && g.cta === "Рассказать" && sent && sent.body.p_mood === 4, JSON.stringify({ g, sent: sent && sent.body }));
  await o.page.locator("[data-now-later]").click(); await sleep(800);
  g = await card(o.page);
  ok("MOOD: «Не сейчас» — приглашение к следующему шагу трека", g && g.mode === "track" && g.title === "Тест «Философия сервиса»", JSON.stringify(g));
  ok("MOOD: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("DURING")) {
  const o = await open({ at: new Date("2026-10-22T01:10:00Z") });   // 13:10
  const g = await card(o.page);
  ok("DURING: на смене — «На смене до 24:00», «Если в зале жарко — SOS», «Открыть»", g && g.mode === "during" && g.tag === "На смене до 24:00" && /SOS/.test(g.title) && g.cta === "Открыть", JSON.stringify(g));
  await o.page.locator("[data-now-card]").click(); await sleep(1500);
  ok("DURING: тап — шпаргалка SOS", await o.page.evaluate(() => /SOS/.test(document.body.innerText) && !document.querySelector("[data-now-card]")));
  ok("DURING: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("BACK")) {
  const o = await open({ shift: "none", steps: 0, act: { "2026-10-16": { st: 2, l: 2 } }, lastOpen: "2026-10-16" });
  const g = await card(o.page);
  ok("BACK: 6 дней без занятий — «С возвращением», «Освежим за 2 минуты», «Начать»", g && g.mode === "back" && g.tag === "С возвращением" && g.title === "Освежим за 2 минуты" && g.cta === "Начать", JSON.stringify(g));
  const was = await warmOpen(o.page);
  await o.page.locator("[data-now-card]").click(); await sleep(1500);
  ok("BACK: тап — разминка (до тапа её не было)", !was && await warmOpen(o.page), (await body(o.page)).slice(0, 160));
  ok("BACK: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("FIRST")) {
  const o = await open({ fresh: true, shift: "none", steps: 0 });
  const g = await card(o.page);
  ok("FIRST: первый день — «Хостес · первый шаг», первый урок, «Начать», без строк", g && g.mode === "track" && g.tag === "Хостес · первый шаг" && /^Урок «Сервис начинается с мышления»$/.test(g.title) && g.cta === "Начать" && !g.rows.length, JSON.stringify(g));
  ok("FIRST: табличка — «Первый день»", /Первый день/.test(await chips(o.page) || ""));
  await shot(o.page, "first");
  ok("FIRST: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("HINT")) {
  const o = await open({ hints: true });
  await sleep(1500);
  const r = await o.page.evaluate(() => {
    const c = document.querySelector("[data-now-card]"), b = document.querySelector(".sa-hintglow");
    const cr = c && c.getBoundingClientRect(), br = b && b.getBoundingClientRect();
    return { card: !!c, bubble: !!b, text: b ? b.innerText.replace(/\s+/g, " ").slice(0, 80) : "", below: !!(cr && br && br.top >= cr.top) };
  });
  ok("HINT: подсказка главной на месте и показывает на карточку: «Карточка сверху — твой следующий шаг…»", r.card && r.bubble && r.below && /Карточка сверху — твой следующий шаг/.test(r.text), JSON.stringify(r));
  await shot(o.page, "hint");
  ok("HINT: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("WIDE")) {
  for (const [w, h, name] of [[844, 390, "landscape"], [1440, 900, "desktop"]]) {
    const o = await open({ w, h, dsf: 1 });
    const g = await card(o.page);
    ok(`WIDE ${name}: карточка на месте, корешок внутри, без ошибок`, g && g.hero === "black" && g.stubIn && !o.errors.length, JSON.stringify({ g: g && [g.w, g.stubIn], e: o.errors }));
    await shot(o.page, "wide-" + name);
    await o.ctx.close();
  }
}

if (want("NARROW")) {
  for (const light of [false, true]) {
    const o = await open({ w: 360, h: 760, light });
    const g = await card(o.page);
    ok(`NARROW 360 ${light ? "светлая" : "тёмная"}: карточка не шире экрана, корешок с кнопкой внутри`, g && g.right <= g.vw && g.left >= 0 && g.stubIn && g.cta === "Начать", JSON.stringify(g && [g.left, g.right, g.vw, g.stubIn]));
    const over = await o.page.evaluate(() => { const r = document.getElementById("root"); return r.scrollWidth - r.clientWidth; });
    ok(`NARROW 360 ${light ? "светлая" : "тёмная"}: нет горизонтальной прокрутки`, over <= 0, String(over));
    await shot(o.page, "narrow-" + (light ? "light" : "dark"));
    await o.ctx.close();
  }
}

console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("✓")).length} ✓ / ${results.filter((r) => r.startsWith("✗")).length} ✗`);
await browser.close();
server.close();
