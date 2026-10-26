// e2e v86 (Доп. 399): удобнее — брифинг «Прочитал(а)», рассадка «Счёт» и «Твои столы», QR на весь экран и отзывы,
// плеер голосов, «медленно» и слоги, настройки сообщений группами и тихие часы.
// Разделы:
//   BRIEF   — сотрудник: карточка в «Смене» с главным («Стоп-лист: … · новинка: … · …»), в чтении «Отправил(а): …»,
//             голос шефа к новинке играет прямо в брифинге, «Прочитал(а)» → brief_read и чтение закрывается; второй раз —
//             «Понятно» и «Отметка уже стоит»; руководитель: «Прочитали 1 из 2 в графике. Ещё не отметили: …» на экране
//             брифинга и на карточке; без этапа 36 — «Понятно», brief_read не зовём;
//   SEAT    — стол со «Счётом»: терракота, «счёт» на столе, сводка «Занято 3 · … · Счёт 1», подбор «Скоро освободится»;
//             у стола с гостями сразу «Счёт» → seat_set bill (гости и официант те же); со «Счётом» — сразу «Уборка»;
//             без этапа 36 — «Статус «Счёт» появится…»; официанту в «Смене» — «Твои столы: 1, 5 · 5 гостей · счёт: 1»;
//   THANKS  — «Показать гостю на весь экран»: QR на светлом фоне читается камерой (OpenCV), экран не гаснет (Wake Lock),
//             крестик закрывает; руководитель: «Отзывы о заведении» — чужая ссылка не сохраняется, Яндекс Карты и 2ГИС →
//             review_links_set; гость после «Спасибо передано» видит «Отзыв на Яндекс Картах», «Отзыв в 2ГИС»;
//             без ссылок или без этапа 36 — ничего лишнего;
//   VOICES  — «Слушать подряд» → плеер внизу: блюдо, кто, 1/3, пауза и дальше, скорость 1,5× (помнит телефон и
//             следующий звук идёт с ней), после всех записей — «прослушано» у каждой и «Прослушано 3 из 3»;
//             новая запись — «Только новые · 1»;
//   SAY     — «Как произносить»: слово по слогам («бур-РА-та»), «медленно»: живой голос на 0,7, голос телефона на 0,55;
//   PREFS   — «Что ещё присылать» группами: «Учёба», «Смена», «Команда»; «Тихие часы» → notify_quiet_set 23–9;
//             без этапа 36 — тихих часов нет;
//   NARROW  — 320 px: карточка стола с пятью статусами, плеер голосов, QR на весь экран — без прокрутки вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v86.mjs [разделы]
// Чтение QR — tools/claude/qr-check.py (нужны python3 и OpenCV).
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5286, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v86";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp", ".wav": "audio/wav" };
// короткие звуки: 0,8 с тона, 16 кГц моно
const tone = (hz, sec = 0.8, rate = 16000) => {
  const n = Math.round(rate * sec), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin(2 * Math.PI * hz * i / rate)), 44 + i * 2);
  return b;
};
const WAVS = { "/v-a.wav": tone(440), "/v-b.wav": tone(660), "/v-c.wav": tone(550), "/v-d.wav": tone(330) };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  if (WAVS[p]) { res.writeHead(200, { "Content-Type": "audio/wav" }); res.end(WAVS[p]); return; }
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;
const qrReads = (png, want) => { try { execFileSync("python3", [SRC + "/tools/claude/qr-check.py", png, want], { stdio: "pipe" }); return true; } catch (e) { return String((e.stdout || "") + (e.stderr || "")).trim().slice(0, 200) || false; } };

const R0 = "Два моря, Океан";
const LEAD = { id: "u-lead", name: "Мария", surname: "Ким", restaurant: R0, position: "senior", is_admin: false };
const STAFF = { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const HOST = { id: "u-host", name: "Ольга", surname: "Ли", restaurant: R0, position: "hostess", is_admin: false };
const ukOf = (p) => "_" + p.name + "_" + p.surname;
const NOW = new Date("2026-10-23T07:20:00Z");   // 23.10, 19:20 по Камчатке
const iso = (minAgo) => new Date(NOW.getTime() - minAgo * 60000).toISOString();
const URL_A = ORIGIN + "/v-a.wav", URL_B = ORIGIN + "/v-b.wav", URL_C = ORIGIN + "/v-c.wav", URL_D = ORIGIN + "/v-d.wav";

// брифинг дня: сегодня в графике Мария (автор), Анна и Пётр
const BRIEF_DATA = { v: 1, day: "2026-10-23", dayLabel: "23 октября", restaurant: R0, author: "Мария Ким",
  blocks: {
    roster: [{ k: "Д", name: "День", from: 12, to: 20, people: ["Мария Ким", "Анна Смирнова"], groups: [{ t: "Менеджер", names: ["Мария Ким"] }, { t: "Официант", names: ["Анна Смирнова"] }] },
      { k: "В", name: "Вечер", from: 16, to: 24, people: ["Пётр Орлов"], groups: [{ t: "Официант", names: ["Пётр Орлов"] }] }],
    stop: ["Борщ с уткой", "Негрони", "Паста с крабом"],
    fresh: [{ id: "d2", name: "Тартар из тунца", cat: "Закуски", voice: "chef", voices: [{ kind: "chef", url: URL_A, sec: 1, name: "Алексей" }] }],
    note: "Банкет на 12 человек в 19:00",
  },
  on: { roster: true, stop: true, fresh: true, note: true } };
const todayOf = (mine) => ({ ok: true, day: "2026-10-23", brief: { data: BRIEF_DATA, author: "Мария Ким", mine, sent: 4, at: "2026-10-23T01:50:00Z" } });

// рассадка
const PLAN = { v: 1, tables: [
  { id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }, { id: "t2", n: "2", seats: 4, shape: "rd", x: 2, y: 0 },
  { id: "t3", n: "3", seats: 2, shape: "sq", x: 4, y: 0 }, { id: "t4", n: "4", seats: 2, shape: "sq", x: 0, y: 2 },
  { id: "t5", n: "5", seats: 6, shape: "long", x: 2, y: 2 },
] };
const SEATSTAFF = [{ id: "e-anna", name: "Анна", surname: "Смирнова", position: "waiter" }, { id: "e-petr", name: "Пётр", surname: "Орлов", position: "waiter" }];
const SROWS = () => [
  { tid: "t1", status: "seat", cnt: 3, name: "", rtime: "", since: iso(40), waiter_id: "e-anna", waiter_name: "Анна Смирнова", updated_name: "Ольга Ли", updated_at: iso(40) },
  { tid: "t2", status: "bill", cnt: 4, name: "", rtime: "", since: iso(95), waiter_id: "e-petr", waiter_name: "Пётр Орлов", updated_name: "Пётр Орлов", updated_at: iso(2) },
  { tid: "t5", status: "bill", cnt: 2, name: "", rtime: "", since: iso(70), waiter_id: "e-anna", waiter_name: "Анна Смирнова", updated_name: "Анна Смирнова", updated_at: iso(5) },
  { tid: "t4", status: "clean", cnt: 0, name: "", rtime: "", since: null, waiter_id: null, waiter_name: "", updated_name: "Ольга Ли", updated_at: iso(1) },
];
function board({ has36 = true } = {}) {
  const B = { rows: SROWS(), sets: [] };
  B.rpc = (fn, body) => {
    if (fn === "seat_board") return { ok: true, day: "2026-10-23", now: NOW.toISOString(), lead: false, plan: PLAN, staff: SEATSTAFF, tables: B.rows };
    if (fn === "seat_set") {
      B.sets.push(body);
      if (body.p_status === "bill" && !has36) return { ok: false, error: "bad_request" };
      const old = B.rows.find((r) => r.tid === body.p_tid) || {};
      const busy = body.p_status === "seat" || body.p_status === "bill";
      const w = SEATSTAFF.find((e) => e.id === body.p_waiter);
      const row = { tid: body.p_tid, status: body.p_status, cnt: busy || body.p_status === "res" ? body.p_cnt : 0, name: "", rtime: body.p_status === "res" ? body.p_rtime : "",
        since: busy ? (old.status === "seat" || old.status === "bill" ? old.since : NOW.toISOString()) : null, waiter_id: busy && w ? w.id : null, waiter_name: busy && w ? w.name + " " + w.surname : "",
        updated_name: "Ольга Ли", updated_at: NOW.toISOString() };
      B.rows = [...B.rows.filter((r) => r.tid !== body.p_tid), row];
      return { ok: true, table: row };
    }
    return undefined;
  };
  return B;
}

// голоса меню
const MENU_V = [
  { id: "m1", name: "Буррата с томатами", cat: "Закуски", ingredients: ["буррата", "томаты"], allergens: ["Молоко"], say: "Бурр+ата с томатами",
    voice: { chef: { url: URL_A, sec: 1, name: "Алексей", at: 1 }, som: { url: URL_B, sec: 1, name: "Мария", at: 1 } } },
  { id: "m2", name: "Тартар из гребешка", cat: "Закуски", ingredients: ["гребешок"], allergens: [], voice: { chef: { url: URL_C, sec: 1, name: "Алексей", at: 1 } } },
];

const ABORT = Symbol("abort");
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ who = STAFF, rpcs = () => undefined, calls = [], light = false, w = 393, h = 852, path = "/", menu = [], tts = false, seedExtra = {} } = {}) {
  const UK = who ? ukOf(who) : "";
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce", acceptDownloads: true });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\/radio-tts/.test(u)) {
      calls.push({ fn: "radio-tts", body, t: Date.now() });
      if (body.probe) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, configured: tts, talk: tts }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tts ? { ok: true, url: URL_D + "?tts=" + calls.length, cached: false } : { ok: false, error: "not_configured" }) });
    }
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      calls.push({ fn: m[1], body, t: Date.now() });
      const own = rpcs(m[1], body);
      if (own === ABORT) return route.abort();
      if (own !== undefined) return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own) });
      const mock = { whoami: { ok: true, employee: who }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] }, schedule_load: { ok: false, error: "auth" }, menu_get: menu,
        qday_inbox: { ok: true, items: [] }, brief_today: { ok: true, brief: null }, case_list: { ok: true, lead: false, team: 0, fresh: 0, inbox: 0, mine_new: 0, top: null }, menu_progress_team: { ok: true, rows: [] } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = who ? { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_menu_shared: JSON.stringify({ [R0]: menu }), ...seedExtra } : { ...seedExtra };
  if (who) { for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1"; seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1"; }
  await ctx.addInitScript((seed) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    window.__ss = [];
    try { const ss = window.speechSynthesis; if (ss) { ss.speak = (u) => { window.__ss.push({ text: u.text, lang: u.lang, rate: u.rate }); setTimeout(() => { try { u.onend && u.onend(); } catch (e) {} }, 30); }; ss.cancel = () => {}; } } catch (e) {}
    // какие звуки запускались и с какой скоростью
    window.__played = [];
    const P = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { try { window.__played.push({ src: String(this.src || this.currentSrc || ""), rate: this.defaultPlaybackRate, now: this.playbackRate }); } catch (e) {} return P.apply(this, arguments); };
    // «не гаснуть»: сколько раз просили и отпускали
    window.__wake = { req: 0, rel: 0 };
    try { Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: () => { window.__wake.req++; const l = { released: false, _h: [], addEventListener(t, f) { this._h.push(f); }, release() { window.__wake.rel++; this.released = true; this._h.forEach((f) => { try { f(); } catch (e) {} }); return Promise.resolve(); } }; return Promise.resolve(l); } } }); } catch (e) {}
  }, seed);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(ORIGIN + path, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors, calls, UK };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const fits = (page, sel) => page.evaluate((sel) => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).length; return { W, sw: document.documentElement.scrollWidth, over }; }, sel);

if (want("BRIEF")) {
  // сотрудник
  let me = false; const reads = [];
  const o = await open({ who: STAFF, rpcs: (fn) => {
    if (fn === "brief_today") return todayOf(false);
    if (fn === "brief_reads") return { ok: true, brief: true, me, n: me ? 1 : 0, rows: [], lead: false };
    if (fn === "brief_read") { reads.push(1); me = true; return { ok: true, at: NOW.toISOString() }; }
    return undefined;
  } });
  await sleep(1200); await nav(o.page, "shift");
  const card = o.page.locator("[data-brief-card]");
  ok("BRIEF: карточка в «Смене» — главное: стоп-лист, новинка, «Своё»", /Брифинг смены · Мария Ким Стоп-лист: Борщ с уткой, Негрони и ещё 1 · новинка: Тартар из тунца · Банкет на 12 человек в 19:00/.test(await txt(card)), await txt(card));
  ok("BRIEF: у сотрудника на карточке нет «Прочитали…»", !(await o.page.locator("[data-brief-card-reads]").count()));
  await shot(o.page, "brief-card");
  await card.click(); await sleep(900);
  const view = o.page.locator("[data-brief-view]");
  ok("BRIEF: в чтении — «Отправил(а): Мария Ким» (было «От Мария Ким»)", /Брифинг смены · 23 октября Отправил\(а\): Мария Ким/.test(await txt(view)) && !/От Мария/.test(await txt(view)));
  await view.locator('[data-brief-voices="d2"] [data-voice="chef"]').click(); await sleep(1400);
  const played = await o.page.evaluate(() => window.__played.map((p) => p.src));
  ok("BRIEF: голос шефа к новинке играет прямо в брифинге", played.some((s) => /v-a\.wav/.test(s)), JSON.stringify(played));
  ok("BRIEF: внизу — «Прочитал(а)»", (await view.locator("[data-brief-read]").count()) === 1 && (await txt(view.locator("[data-brief-read]"))) === "Прочитал(а)");
  await shot(o.page, "brief-view");
  await view.locator("[data-brief-read]").click(); await sleep(900);
  ok("BRIEF: «Прочитал(а)» → brief_read, чтение закрылось", reads.length === 1 && !(await o.page.locator("[data-brief-view]").count()));
  await card.click(); await sleep(900);
  ok("BRIEF: второй раз — «Понятно» и «Отметка «Прочитал(а)» уже стоит»", !(await o.page.locator("[data-brief-read]").count()) && /Отметка «Прочитал\(а\)» уже стоит\./.test(await txt(o.page.locator("[data-brief-read-done]"))));
  ok("BRIEF: без ошибок в консоли (сотрудник)", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
  // руководитель
  const READS = { ok: true, brief: true, me: false, n: 1, rows: [{ emp_id: "e-anna", name: "Анна", surname: "Смирнова", at: iso(10) }], lead: true };
  const o2 = await open({ who: LEAD, rpcs: (fn) => {
    if (fn === "brief_today") return todayOf(true);
    if (fn === "brief_reads") return READS;
    if (fn === "league_week") return { ok: true, rows: [] };
    if (fn === "quiz_hard_questions") return [];
    return undefined;
  } });
  await sleep(1200); await nav(o2.page, "shift");
  ok("BRIEF: руководителю на карточке — «Прочитали 1 из 2 в графике»", /Прочитали 1 из 2 в графике/.test(await txt(o2.page.locator("[data-brief-card-reads]"))), await txt(o2.page.locator("[data-brief-card]")));
  await nav(o2.page, "brief", 2200);
  const sent = await txt(o2.page.locator("[data-brief-sent]"));
  ok("BRIEF: экран брифинга — сколько прочитали и кто ещё не отметил (автор не в счёт)", /Прочитали 1 из 2 в графике\. Ещё не отметили: Пётр Орлов\./.test(sent) && /прочитать её нужно будет заново/.test(sent), sent);
  await shot(o2.page, "brief-lead");
  ok("BRIEF: без ошибок в консоли (руководитель)", !o2.errors.length, o2.errors.slice(0, 3).join(" | "));
  await o2.ctx.close();
  // без этапа 36
  const o3 = await open({ who: STAFF, rpcs: (fn) => (fn === "brief_today" ? todayOf(false) : /^brief_read/.test(fn) ? { code: "PGRST202", message: "Could not find the function" } : undefined) });
  await sleep(1200); await nav(o3.page, "shift");
  await o3.page.locator("[data-brief-card]").click(); await sleep(900);
  ok("BRIEF: без этапа 36 — «Понятно», без «Прочитал(а)»", !(await o3.page.locator("[data-brief-read]").count()) && /Понятно/.test(await txt(o3.page.locator("[data-brief-view]"))));
  ok("BRIEF: без этапа 36 brief_read не зовём, ошибок нет", !o3.calls.some((c) => c.fn === "brief_read") && !o3.errors.length, o3.errors.slice(0, 2).join(" | "));
  await o3.ctx.close();
}

if (want("SEAT")) {
  for (const light of [false, true]) {
    const tag = "SEAT" + (light ? " светлая" : "");
    const B = board({});
    const o = await open({ who: HOST, light, rpcs: B.rpc });
    await sleep(1200); await nav(o.page, "seat");
    const sum = await txt(o.page.locator("[data-seat-summary]"));
    ok(tag + ": сводка — занято 3 (со «Счётом»), гостей 9, счёт 2", /^Свободно 1 из 5 · Занято 3 · Гостей 9 · Счёт 2 · Уборка 1$/.test(sum), sum);
    ok(tag + ": стол со «Счётом» — свой цвет и «счёт» на столе", (await o.page.locator('[data-table="t2"]').getAttribute("data-status")) === "bill" && (await txt(o.page.locator('[data-table="t2"]'))) === "2 счёт"
      && (await o.page.locator('[data-table="t2"]').getAttribute("aria-label")) === "Стол 2, 4 места: счёт, гостей 4");
    const bg = await o.page.evaluate(() => { const a = getComputedStyle(document.querySelector('[data-table="t2"]')).backgroundColor, b = getComputedStyle(document.querySelector('[data-table="t1"]')).backgroundColor; return [a, b]; });
    ok(tag + ": «Счёт» и «Гости» — разные цвета", bg[0] !== bg[1], bg.join(" / "));
    await o.page.locator('[data-party="4"]').click(); await sleep(300);
    ok(tag + ": «Посадить: 3–4» — свободных нет, «Скоро освободится: стол 2, стол 5» (дольше сидят — первыми)", /Свободных столов на столько гостей нет\. Скоро освободится: стол 2, стол 5 \(попросили счёт\)\./.test(await txt(o.page.locator("[data-suggest]"))), await txt(o.page.locator("[data-suggest]")));
    await o.page.locator('[data-party="4"]').click(); await sleep(200);
    await shot(o.page, "seat-bill" + (light ? "-light" : ""));
    // стол с гостями → «Счёт»
    await o.page.locator('[data-table="t1"]').click(); await sleep(400);
    const sh = o.page.locator('[data-table-sheet="t1"]');
    ok(tag + ": у стола с гостями сразу «Счёт», кнопка «Попросили счёт»", (await sh.locator('[data-sheet-status="bill"]').getAttribute("aria-checked")) === "true" && (await txt(sh.locator("[data-sheet-save]"))) === "Попросили счёт"
      && /Гости Счёт Уборка Свободен Бронь/.test(await txt(sh.locator('[role="radiogroup"]'))));
    await shot(o.page, "seat-sheet" + (light ? "-light" : ""));
    await sh.locator("[data-sheet-save]").click(); await sleep(700);
    const s1 = B.sets[0] || {};
    ok(tag + ": seat_set bill — гости и официант те же", s1.p_tid === "t1" && s1.p_status === "bill" && s1.p_cnt === 3 && s1.p_waiter === "e-anna", JSON.stringify(s1));
    ok(tag + ": «Стол 1: попросили счёт.»", /Стол 1: попросили счёт\./.test(await txt(o.page.locator('[role="status"]'))) && (await o.page.locator('[data-table="t1"]').getAttribute("data-status")) === "bill");
    // со «Счётом» → сразу «Уборка»
    await o.page.locator('[data-table="t2"]').click(); await sleep(400);
    ok(tag + ": у стола со «Счётом» сразу «Уборка», в шапке гости и время", (await o.page.locator('[data-table-sheet="t2"] [data-sheet-status="clean"]').getAttribute("aria-checked")) === "true"
      && /сейчас: счёт, 4 гостя, 1 ч 35 мин/.test(await txt(o.page.locator('[data-table-sheet="t2"]'))), await txt(o.page.locator('[data-table-sheet="t2"]')));
    await o.page.locator('[data-table-sheet="t2"] [data-sa-back]').click(); await sleep(300);
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
  // без этапа 36: «Счёт» не сохраняется — и честно об этом
  const B2 = board({ has36: false });
  const o2 = await open({ who: HOST, rpcs: B2.rpc });
  await sleep(1200); await nav(o2.page, "seat");
  await o2.page.locator('[data-table="t1"]').click(); await sleep(400);
  await o2.page.locator('[data-table-sheet="t1"] [data-sheet-save]').click(); await sleep(700);
  ok("SEAT: без этапа 36 — «Статус «Счёт» появится, когда на сервер добавят этап 36.»", /Статус «Счёт» появится, когда на сервер добавят этап 36\./.test(await txt(o2.page.locator('[data-table-sheet="t1"] [role="alert"]'))));
  await o2.ctx.close();
  // официант: «Твои столы» в «Смене»
  const B3 = board({});
  const o3 = await open({ who: STAFF, rpcs: B3.rpc });
  await sleep(1200); await nav(o3.page, "shift", 2200);
  const it = o3.page.locator('.sa-card[aria-label="Рассадка"]');
  ok("SEAT: официанту в пункте «Рассадка» — «Твои столы: 1, 5 · 5 гостей · счёт: 1»", /Твои столы: 1, 5 · 5 гостей · счёт: 1/.test(await txt(it)), await txt(it));
  await shot(o3.page, "seat-mine");
  ok("SEAT: без ошибок в консоли (официант)", !o3.errors.length, o3.errors.slice(0, 3).join(" | "));
  await o3.ctx.close();
}

if (want("THANKS")) {
  const CODE = "a1b2c3d4e5";
  const o = await open({ who: STAFF, rpcs: (fn) => (fn === "my_thanks" ? { ok: true, code: CODE, name: "Анна", restaurant: R0, week: 2, month: 5, total: 9, items: [] } : undefined) });
  await sleep(1200); await nav(o.page, "thanks", 1800);
  await o.page.locator("[data-thanks-show]").click(); await sleep(800);
  const full = o.page.locator("[data-thanks-full]");
  ok("THANKS: «Показать гостю на весь экран» — QR, имя, «Наведите камеру…»", (await full.count()) === 1 && /Скажите спасибо Анна Официант Наведите камеру телефона на код/.test(await txt(full)), await txt(full));
  const wk = await o.page.evaluate(() => window.__wake);
  // в сборке для проверки React дважды монтирует эффект (StrictMode): считаем, сколько «не гаснуть» держится сейчас
  ok("THANKS: экран не гаснет — Wake Lock держится", wk.req >= 1 && wk.req - wk.rel === 1, JSON.stringify(wk));
  await shot(o.page, "qr-full");
  const r1 = qrReads(OUT + "/qr-full.png", ORIGIN + "/?thanks=" + CODE);
  ok("THANKS: QR на весь экран читается камерой и ведёт на ?thanks=код", r1 === true, String(r1));
  const bgc = await full.evaluate((e) => getComputedStyle(e).backgroundColor);
  ok("THANKS: фон светлый (так ярче)", /rgb\(247, 240, 225\)/.test(bgc), bgc);
  await full.locator("[data-sa-back]").click(); await sleep(500);
  const wk2 = await o.page.evaluate(() => window.__wake);
  ok("THANKS: крестик закрывает, «не гаснуть» отпущено", !(await o.page.locator("[data-thanks-full]").count()) && wk2.req - wk2.rel === 0, JSON.stringify(wk2));
  ok("THANKS: без ошибок в консоли (сотрудник)", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
  // руководитель: ссылки на отзывы
  let saved = null;
  const YA = "https://yandex.ru/maps/org/dva_morya/1234567890/reviews/", GIS = "https://2gis.ru/petropavlovsk/firm/70000001012345678";
  const o2 = await open({ who: LEAD, rpcs: (fn, body) => {
    if (fn === "my_thanks") return { ok: true, code: CODE, name: "Мария", restaurant: R0, week: 0, month: 0, total: 0, items: [] };
    if (fn === "thanks_team") return { ok: true, rows: [], items: [] };
    if (fn === "review_links") return { ok: true, links: [], lead: true };
    if (fn === "review_links_set") { saved = body; return { ok: true, links: (body.p_links || []).map((u) => ({ kind: /yandex/.test(u) ? "yandex" : "2gis", url: u })) }; }
    return undefined;
  } });
  await sleep(1200); await nav(o2.page, "thanks", 1800);
  await o2.page.locator('[data-thanks-tab="team"]').click(); await sleep(900);
  const rl = o2.page.locator("[data-review-links]");
  ok("THANKS: руководителю — «Отзывы о заведении»", /Отзывы о заведении Ссылка на ваше заведение в Яндекс Картах, 2ГИС или Google Картах/.test(await txt(rl)));
  await rl.locator('[data-review-input="0"]').fill("https://evil.example/yandex.ru/maps"); await rl.locator("[data-review-save]").click(); await sleep(300);
  ok("THANKS: чужая ссылка — подсказка, на сервер не уходит", /Это не страница заведения в Яндекс Картах, 2ГИС или Google Картах/.test(await txt(rl.locator('[role="alert"]'))) && !saved);
  await rl.locator('[data-review-input="0"]').fill(YA); await rl.locator('[data-review-input="1"]').fill(GIS);
  await rl.locator("[data-review-save]").click(); await sleep(700);
  ok("THANKS: Яндекс Карты и 2ГИС → review_links_set", saved && JSON.stringify(saved.p_links) === JSON.stringify([YA, GIS]) && /Сохранено\. После «Спасибо передано» гость увидит: Отзыв на Яндекс Картах, Отзыв в 2ГИС\./.test(await txt(rl.locator('[role="status"]'))), JSON.stringify(saved));
  await rl.scrollIntoViewIfNeeded(); await shot(o2.page, "review-links");
  ok("THANKS: без ошибок в консоли (руководитель)", !o2.errors.length, o2.errors.slice(0, 3).join(" | "));
  await o2.ctx.close();
  // гость
  for (const [tag, links, has36] of [["со ссылками", [{ kind: "yandex", url: YA }, { kind: "2gis", url: GIS }, { kind: "evil", url: "https://evil.example/" }], true], ["без ссылок", [], true], ["без этапа 36", null, false]]) {
    const g = await open({ who: null, path: "/?thanks=" + CODE, rpcs: (fn) => {
      if (fn === "guest_thanks_card") return { ok: true, name: "Анна", pos: "waiter", restaurant: R0 };
      if (fn === "guest_thanks_send") return { ok: true };
      if (fn === "guest_review_links") return has36 ? { ok: true, links } : { code: "PGRST202", message: "Could not find the function" };
      return undefined;
    } });
    await sleep(1200);
    ok("THANKS: гость (" + tag + ") — до отправки отзывов не спрашиваем", !g.calls.some((c) => c.fn === "guest_review_links"));
    await g.page.locator('[data-guest-tag="advice"]').click(); await g.page.locator("[data-guest-send]").click(); await sleep(1200);
    const rv = g.page.locator("[data-guest-reviews]");
    if (links && links.length) {
      const hrefs = await rv.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href") + "|" + a.getAttribute("target") + "|" + a.getAttribute("rel")));
      ok("THANKS: гость после «Спасибо передано» — «Отзыв на Яндекс Картах», «Отзыв в 2ГИС» (чужая ссылка не показана)", /Спасибо передано/.test(await txt(g.page.locator("[data-guest-done]")))
        && /Если хотите, расскажите о нас другим: Отзыв на Яндекс Картах Отзыв в 2ГИС$/.test(await txt(rv)) && hrefs.join(",") === YA + "|_blank|noopener noreferrer," + GIS + "|_blank|noopener noreferrer", hrefs.join(","));
      await shot(g.page, "guest-reviews");
    } else ok("THANKS: гость (" + tag + ") — «Спасибо передано» без кнопок отзывов", /Спасибо передано/.test(await txt(g.page.locator("[data-guest-done]"))) && !(await rv.count()));
    ok("THANKS: гость (" + tag + ") — без ошибок в консоли", !g.errors.length, g.errors.slice(0, 2).join(" | "));
    await g.ctx.close();
  }
}

if (want("VOICES")) {
  const o = await open({ who: STAFF, menu: MENU_V });
  await sleep(1200); await nav(o.page, "menuTrainer", 1800);
  await o.page.locator('[data-menu-mode="voices"]').first().click(); await sleep(900);
  await o.page.locator("[data-voices-all]").click(); await sleep(250);
  const pl = o.page.locator("[data-voices-player]");
  ok("VOICES: «Слушать подряд» — плеер внизу: блюдо, кто, 1/3", (await pl.count()) === 1 && /Буррата с томатами Шеф · Алексей · .* · 1\/3/.test(await txt(pl)), await txt(pl));
  await shot(o.page, "voices-player");
  await pl.locator("[data-voices-pause]").click(); await sleep(250);
  ok("VOICES: пауза — плеер ждёт («Дальше слушать»)", (await pl.getAttribute("data-voices-player")) === "pause" && (await pl.locator("[data-voices-pause]").getAttribute("aria-label")) === "Дальше слушать");
  await pl.locator("[data-voices-rate]").click(); await sleep(150);
  ok("VOICES: скорость 1,5× — на кнопке и в памяти телефона", (await pl.locator("[data-voices-rate]").innerText()) === "1,5×" && (await o.page.evaluate(() => localStorage.getItem("sa_voice_rate"))) === "1.5");
  await pl.locator("[data-voices-pause]").click();
  await o.page.waitForFunction(() => !document.querySelector("[data-voices-player]"), null, { timeout: 12000 }).catch(() => {});
  const pls = await o.page.evaluate(() => window.__played);
  const later = pls.filter((p) => /v-[bc]\.wav/.test(p.src));
  ok("VOICES: очередь дошла до конца; следующие записи — со скоростью 1,5×", !(await o.page.locator("[data-voices-player]").count()) && later.length >= 2 && later.every((p) => p.rate === 1.5), JSON.stringify(pls.map((p) => p.src.replace(/.*\//, "") + "@" + p.rate)));
  ok("VOICES: «прослушано» у каждой записи, «Прослушано 3 из 3»", (await o.page.locator("[data-voice-heard]").count()) === 3 && /Прослушано 3 из 3: всё послушал\(а\)/.test(await txt(o.page.locator("[data-voices-heard]"))));
  await shot(o.page, "voices-heard");
  // одна запись по отдельности — тоже на 1,5×
  await o.page.locator('[data-voices-dish="m2"] [data-voice="chef"]').click(); await sleep(400);
  const last = await o.page.evaluate(() => window.__played[window.__played.length - 1]);
  ok("VOICES: запись по отдельности — со скоростью из памяти (1,5×)", last && /v-c\.wav/.test(last.src) && last.rate === 1.5, JSON.stringify(last));
  ok("VOICES: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
  // новая запись после прослушанных — «Только новые · 1»
  const MENU2 = [MENU_V[0], { ...MENU_V[1], voice: { chef: { url: URL_D, sec: 1, name: "Алексей", at: 2 } } }];
  const heard = { "/v-a.wav": 1, "/v-b.wav": 1, "/v-c.wav": 1 };
  const o2 = await open({ who: STAFF, menu: MENU2, seedExtra: { sa_voice_heard: JSON.stringify(heard) } });
  await sleep(1200); await nav(o2.page, "menuTrainer", 1800);
  await o2.page.locator('[data-menu-mode="voices"]').first().click(); await sleep(900);
  ok("VOICES: перезаписали одну — «Только новые · 1», «Прослушано 2 из 3»", /Только новые · 1/.test(await txt(o2.page.locator("[data-voices-new]"))) && /^Прослушано 2 из 3$/.test(await txt(o2.page.locator("[data-voices-heard]"))));
  await o2.page.locator("[data-voices-new]").click(); await sleep(300);
  ok("VOICES: «Только новые» играет одну новую запись", /Тартар из гребешка .* · 1\/1/.test(await txt(o2.page.locator("[data-voices-player]"))), await txt(o2.page.locator("[data-voices-player]")));
  await o2.ctx.close();
}

if (want("SAY")) {
  for (const tts of [true, false]) {
    const tag = "SAY " + (tts ? "живой голос" : "голос телефона");
    const o = await open({ who: STAFF, menu: MENU_V, tts });
    await sleep(1200); await nav(o.page, "menuTrainer", 1800);
    await o.page.locator('[data-menu-mode="say"]').first().click(); await sleep(1200);
    const first = o.page.locator("[data-pron-item]").first();
    ok(tag + ": под словом — по слогам, ударный слог заглавными («бур-РА-та с то-ма-та-ми»)", (await txt(first.locator("[data-pron-syll]"))) === "бур-РА-та с то-ма-та-ми", await txt(first.locator("[data-pron-syll]")));
    await first.locator('[data-say="slow"]').click(); await sleep(1200);
    if (tts) {
      const pl = await o.page.evaluate(() => window.__played.filter((p) => /v-d\.wav/.test(p.src)));
      ok(tag + ": «медленно» — тот же голос на скорости 0,7", pl.length >= 1 && pl[pl.length - 1].rate === 0.7, JSON.stringify(pl));
    } else {
      const ss = await o.page.evaluate(() => window.__ss);
      ok(tag + ": «медленно» — голос телефона на 0,55", ss.length >= 1 && Math.abs(ss[ss.length - 1].rate - 0.55) < 0.01 && /Буррата с томатами/.test(ss[ss.length - 1].text), JSON.stringify(ss));
    }
    await o.page.locator('[data-pron-cat="wine"]').click(); await sleep(400);
    const w = await o.page.locator("[data-pron-item]").evaluateAll((els) => els.slice(0, 3).map((e) => (e.querySelector("[data-pron-syll]") || {}).textContent || ""));
    ok(tag + ": вино по слогам: «шар-до-НЕ», «со-ви-НЬОН блан»", w[0] === "шар-до-НЕ" && w[1] === "со-ви-НЬОН блан", JSON.stringify(w));
    if (!tts) await shot(o.page, "say-syll");
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("PREFS")) {
  for (const has36 of [true, false]) {
    let prefs = { ok: true, bot: true, linked: true, remind: true, pair: true, quest: true, league: true, fresh: true, month: true, master: true, qday: true, qday_hour: 12, brief: true, cases: true, thanks: true, seat: true };
    let quiet = { ok: true, from: null, to: null };
    const o = await open({ who: STAFF, rpcs: (fn, body) => {
      if (fn === "tg_status") return { ok: true, bot: true, linked: true, remind: true, minutes: 60 };
      if (fn === "notify_prefs") return prefs;
      if (fn === "notify_quiet") return has36 ? quiet : { code: "PGRST202", message: "Could not find the function" };
      if (fn === "notify_quiet_set") { quiet = { ok: true, from: body.p_from, to: body.p_to }; return quiet; }
      return undefined;
    } });
    await sleep(1500); await nav(o.page, "shift");
    await o.page.locator('.sa-card[aria-label="Напоминания в Telegram"]').first().click(); await sleep(1400);
    const groups = await o.page.locator("[data-notify-group]").evaluateAll((gs) => gs.map((g) => g.getAttribute("data-notify-group") + ":" + [...g.querySelectorAll('[role="switch"]')].map((s) => s.innerText.split("\n")[0].trim()).join(",")));
    if (has36) {
      ok("PREFS: группами — Учёба, Смена, Команда", groups.join(" | ") === "study:Свеча на двоих,Вопрос дня,Свежесть тем,Итоги месяца | shift:Квест смены,Брифинг смены,Рассадка,Случаи из зала | team:Лига недели,Мастера заведения,Спасибо от гостей", groups.join(" | "));
      ok("PREFS: подписи групп", /Учёба .* Смена .* Команда/.test(await txt(o.page.locator("[data-notify-prefs]"))));
      const q = o.page.locator("[data-notify-quiet]");
      ok("PREFS: «Тихие часы» — сейчас «Нет»", /Тихие часы В это время бот молчит\. Напоминание о смене приходит всегда\./.test(await txt(q)) && (await q.locator('[data-quiet="Нет"]').getAttribute("aria-pressed")) === "true");
      await q.locator('[data-quiet="23:00–9:00"]').click(); await sleep(700);
      const set = o.calls.filter((c) => c.fn === "notify_quiet_set").map((c) => c.body);
      ok("PREFS: «23:00–9:00» → notify_quiet_set 23–9", set.length === 1 && set[0].p_from === 23 && set[0].p_to === 9 && (await q.locator('[data-quiet="23:00–9:00"]').getAttribute("aria-pressed")) === "true", JSON.stringify(set));
      await q.scrollIntoViewIfNeeded(); await shot(o.page, "prefs-quiet");
    } else ok("PREFS: без этапа 36 — тихих часов нет, группы на месте", !(await o.page.locator("[data-notify-quiet]").count()) && groups.length === 3);
    ok("PREFS: без ошибок в консоли" + (has36 ? "" : " (без этапа 36)"), !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("NARROW")) {
  const B = board({});
  const o = await open({ who: HOST, w: 320, h: 640, rpcs: B.rpc });
  await sleep(1200); await nav(o.page, "seat");
  await o.page.locator('[data-table="t1"]').click(); await sleep(400);
  const a = await fits(o.page, "[data-table-sheet] *");
  ok("NARROW: 320 px — карточка стола с пятью статусами без прокрутки вбок", a.sw <= a.W && a.over === 0, JSON.stringify(a));
  await shot(o.page, "narrow-sheet");
  await o.ctx.close();
  const o2 = await open({ who: STAFF, w: 320, h: 640, menu: MENU_V });
  await sleep(1200); await nav(o2.page, "menuTrainer", 1800);
  await o2.page.locator('[data-menu-mode="voices"]').first().click(); await sleep(900);
  await o2.page.locator("[data-voices-all]").click(); await sleep(300);
  await o2.page.locator("[data-voices-pause]").click(); await sleep(200);
  const b = await fits(o2.page, "[data-voices-player] *");
  ok("NARROW: 320 px — плеер голосов без прокрутки вбок", b.sw <= b.W && b.over === 0, JSON.stringify(b));
  await shot(o2.page, "narrow-player");
  await o2.ctx.close();
  const o3 = await open({ who: STAFF, w: 320, h: 640, rpcs: (fn) => (fn === "my_thanks" ? { ok: true, code: "a1b2c3d4e5", name: "Анна", restaurant: R0, week: 0, month: 0, total: 0, items: [] } : undefined) });
  await sleep(1200); await nav(o3.page, "thanks", 1800);
  await o3.page.locator("[data-thanks-show]").click(); await sleep(600);
  const c = await fits(o3.page, "[data-thanks-full] *");
  ok("NARROW: 320 px — QR на весь экран целиком", c.sw <= c.W && c.over === 0, JSON.stringify(c));
  await shot(o3.page, "narrow-qr");
  await o3.ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
