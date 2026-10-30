// e2e v89 (Доп. 402): «Вопрос дня» после ответа уходит с главной.
// Разделы:
//   HIDE    — ответ на карточке: разбор виден, справа «Понятно» → карточки нет (и места под неё нет); перезапуск (ответ
//             уже на сервере) — карточки нет; верный ответ → ушёл с главной и вернулся — карточки нет; Enter на
//             «Понятно»; ответил раньше в Telegram — карточки нет с первого показа; до ответа — карточка целиком;
//             экран не съезжает вбок; обе темы;
//   NARROW  — 320 px: разбор с «Понятно» без прокрутки вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v89.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5289, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v89";
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

async function open({ who = STAFF, rpcs = () => undefined, calls = [], light = false, w = 393, h = 852, path = "/", menu = [], tts = false, seedExtra = {}, motion = "reduce", init = null } = {}) {
  const UK = who ? ukOf(who) : "";
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: motion, acceptDownloads: true });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\/radio-tts/.test(u)) {
      calls.push({ fn: "radio-tts", body, t: Date.now() });
      if (body.probe) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, configured: tts, talk: tts }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tts ? { ok: true, url: URL_D + "?tts=" + calls.length, cached: false } : { ok: false, error: "not_configured" }) });
    }
    // v88: Наставник (ai-chat) и распознавание речи (stt) — ответы сценария
    if (/\/functions\/v1\/(ai-chat|stt)/.test(u)) {
      const fn = /ai-chat/.test(u) ? "ai-chat" : "stt";
      calls.push({ fn, body, t: Date.now() });
      const own = rpcs(fn, body);
      if (own === ABORT || own === undefined) return route.abort();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(own) });
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
  const seed = who ? { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
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
  if (init) await ctx.addInitScript(init);
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
// ── «Вопрос дня» — сервер в памяти: после ответа qday_today отдаёт итог ──
const QITEM = { id: 7, q: "Через сколько секунд гостя нужно поприветствовать?", o: ["До 30 секунд", "Через 5 минут", "Когда сядет за стол"], t: "Встреча гостя", r: "Официант", day: "2026-10-23", via: "app", answer: null, correct: null, at: null };
const answered = (i) => ({ ...QITEM, answer: i, correct: i === 0, c: 0, e: "Первый контакт до 30 секунд: гость видит, что его заметили.", at: NOW.toISOString() });
const qdayServer = ({ pre = null } = {}) => {
  const Q = { answers: [], item: pre == null ? QITEM : answered(pre) };
  Q.rpc = (fn, body) => {
    if (fn === "qday_today") return { ok: true, day: "2026-10-23", hour: 12, streak: Q.item.answer == null ? 2 : 3, item: Q.item };
    if (fn === "qday_answer") {
      Q.answers.push(body);
      if (Q.item.answer != null) return { ok: false, error: "again", item: Q.item, streak: 3 };
      Q.item = answered(body.p_answer);
      return { ok: true, item: Q.item, streak: 3 };
    }
    return undefined;
  };
  return Q;
};
const card = (page) => page.locator("[data-qday-card]");
// кнопку у нижнего края закрывает нижнее меню: сначала в середину экрана (иначе Playwright прокручивает «до упора»
// и вбок — экран на снимке съезжает, у человека так не бывает)
const tap = async (loc) => { await loc.evaluate((e) => e.scrollIntoView({ block: "center", inline: "nearest" })); await sleep(120); await loc.click(); };
const noShift = (page) => page.evaluate(() => [...document.querySelectorAll("*")].filter((e) => e.scrollLeft > 0).length === 0);

if (want("HIDE")) {
  for (const light of [false, true]) {
    const tag = "HIDE" + (light ? " светлая" : "");
    const Q = qdayServer({});
    const o = await open({ who: STAFF, light, rpcs: Q.rpc });
    await sleep(2400);
    const c = card(o.page);
    ok(tag + ": до ответа — карточка целиком: вопрос и три варианта, «Понятно» нет", (await c.getAttribute("data-qday-card")) === "ask" && (await c.locator("[data-qday-opt]").count()) === 3 && !(await c.locator("[data-qday-hide]").count()));
    await tap(c.locator('[data-qday-opt="2"]')); await sleep(900);
    const res = await txt(c.locator("[data-qday-result]"));
    ok(tag + ": ответил — разбор и справа «Понятно»", (await c.getAttribute("data-qday-card")) === "bad" && /^Неверно\. Верный ответ: А\. Первый контакт до 30 секунд: гость видит, что его заметили\. Вопрос ждёт в «Работе над ошибками»\. Следующий вопрос завтра\. Понятно$/.test(res), res);
    await c.locator("[data-qday-hide]").evaluate((e) => e.scrollIntoView({ block: "center" })); await sleep(150);
    await shot(o.page, "answered" + (light ? "-light" : ""));
    await tap(c.locator("[data-qday-hide]")); await sleep(400);
    ok(tag + ": «Понятно» — карточки нет, и места под неё нет", !(await o.page.locator("[data-qday-card]").count()) && !(await o.page.locator("[data-qday-slot]").count()));
    ok(tag + ": экран не съехал вбок", await noShift(o.page));
    await shot(o.page, "hidden" + (light ? "-light" : ""));
    // перезапуск — ответ на сервере: карточки нет
    await o.page.reload({ waitUntil: "load" }); await sleep(2600);
    ok(tag + ": перезапуск — карточки нет, второй раз вопрос не отвечается", !(await o.page.locator("[data-qday-card]").count()) && Q.answers.length === 1 && o.calls.filter((x) => x.fn === "qday_today").length >= 2);
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
  // верный ответ: ушёл с главной и вернулся — карточки нет
  const Q2 = qdayServer({});
  const o2 = await open({ who: STAFF, rpcs: Q2.rpc });
  await sleep(2400);
  await tap(card(o2.page).locator('[data-qday-opt="0"]')); await sleep(900);
  ok("HIDE: верный ответ — «Верно.», разбор, «Следующий вопрос завтра.» и «Понятно»", /^Верно\. Первый контакт до 30 секунд: гость видит, что его заметили\. Следующий вопрос завтра\. Понятно$/.test(await txt(card(o2.page).locator("[data-qday-result]"))), await txt(card(o2.page).locator("[data-qday-result]")));
  await nav(o2.page, "shift", 1200); await nav(o2.page, "roleSelect", 1500);
  ok("HIDE: ушёл с главной и вернулся — карточки нет", !(await o2.page.locator("[data-qday-card]").count()));
  await o2.ctx.close();
  // клавиатура: Enter на «Понятно»
  const Q3 = qdayServer({});
  const o3 = await open({ who: STAFF, rpcs: Q3.rpc });
  await sleep(2400);
  await tap(card(o3.page).locator('[data-qday-opt="1"]')); await sleep(900);
  await o3.page.locator("[data-qday-hide]").focus(); await o3.page.keyboard.press("Enter"); await sleep(400);
  ok("HIDE: Enter на «Понятно» — карточки нет", !(await o3.page.locator("[data-qday-card]").count()));
  await o3.ctx.close();
  // ответил раньше в Telegram — карточки нет с первого показа
  const Q4 = qdayServer({ pre: 1 });
  const o4 = await open({ who: STAFF, rpcs: Q4.rpc, seedExtra: { ["sa_qday_seen" + ukOf(STAFF)]: JSON.stringify([7]) } });
  await sleep(2600);
  ok("HIDE: ответил раньше в Telegram — карточки нет с первого показа, ответа из приложения нет", !(await o4.page.locator("[data-qday-card]").count()) && !Q4.answers.length && o4.calls.some((x) => x.fn === "qday_today"));
  ok("HIDE: без ошибок в консоли (верный, клавиатура, Telegram)", !o2.errors.length && !o3.errors.length && !o4.errors.length, [...o2.errors, ...o3.errors, ...o4.errors].slice(0, 3).join(" | "));
  await o4.ctx.close();
}

if (want("NARROW")) {
  const Q = qdayServer({});
  const o = await open({ who: STAFF, w: 320, h: 640, rpcs: Q.rpc });
  await sleep(2400);
  await tap(card(o.page).locator('[data-qday-opt="2"]')); await sleep(900);
  const a = await fits(o.page, "[data-qday-card] *");
  ok("NARROW: 320 px — разбор с «Понятно» без прокрутки вбок", a.sw <= a.W && a.over === 0 && (await noShift(o.page)), JSON.stringify(a));
  await o.page.locator("[data-qday-hide]").evaluate((e) => e.scrollIntoView({ block: "center" })); await sleep(150);
  await shot(o.page, "narrow-answered");
  await o.ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
