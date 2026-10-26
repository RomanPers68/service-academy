// e2e v87 (Доп. 400): красивее — рисунки золотой линией, «Как было у нас» плашкой, страница гостя, печать QR, «Смена» под роль.
// Разделы:
//   ART     — рисунки золотой линией там, где пусто: спасибо (сердце), случаи (поднос), схема зала (стол), голоса
//             (микрофон), «Как произносить» (реплика), брифинг (колокольчик); только украшение (aria-hidden);
//   CASE    — «стол» случаев: после ответа плашка «Как было у нас» и подпись рассказчика рукописным шрифтом; в «Работе
//             над ошибками» разбор с «Как было у нас: …»;
//   GUEST   — страница гостя кремовая (фон, полоса браузера, заставка без тёмной вспышки), сердце рисуется линией и один
//             раз «бьётся», кнопки отзывов — после сердца; с выключенной анимацией сердце сразу целиком; 320 px;
//   PRINT   — «Картинка для печати»: выбор из четырёх видов с предпросмотром, «Сохранить картинку» скачивает PNG нужного
//             размера, QR читается камерой (OpenCV) на каждом, у домика — с обеих половин; светлая тема и 320 px;
//   ROLE    — «Смена» под роль: хостес — зал сейчас (полоса, легенда, ближайшая бронь) → рассадка; руководитель —
//             «Брифинг на сегодня ещё не отправлен» → «Собрать», строка зала; брифинг отправлен — только зал;
//             официант — кружки своих столов; нет столов или нет этапа 35 — карточки нет;
//   ROSTER  — брифинг смены: удалённая из графика крестиком хостес (till — прошлый месяц) со сменой в плане и заведённая
//             на следующий месяц (since) в «Кто сегодня» не попадают, как и в таблице графика.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v87.mjs [разделы]
// Чтение QR — tools/claude/qr-check.py (нужны python3 и OpenCV).
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5287, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v87";
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
const CODE = "a1b2c3d4e5";
const MINE = (items = []) => ({ ok: true, code: CODE, name: "Анна", restaurant: R0, week: 0, month: 0, total: 0, items });
// случаи из зала: один опубликованный
const CASE = { id: 31, at: iso(60), author: "Илья Бармен", sit: { scene: "Гость за баром просит коктейль не из карты.", question: "Как поступить?",
  options: ["Предложить похожий из карты", "Сказать, что такого нет"], correct: 0, why: "Гость пришёл за вкусом, а не за названием", real: "Предложили «Апероль шприц»", show_author: true } };
const cases = (team) => (fn, body) => (fn === "case_list" ? (body.p_mode === "counts" ? { ok: true, lead: false, team: team.length, fresh: team.length, inbox: 0, mine_new: 0, top: team[0] || null }
  : { ok: true, lead: false, team, mine: [] }) : undefined);
const rgb = (s) => (String(s).match(/\d+(\.\d+)?/g) || []).map(Number);

if (want("ART")) {
  // спасибо: пока пусто — сердце
  const o = await open({ who: STAFF, rpcs: (fn) => (fn === "my_thanks" ? MINE() : undefined) });
  await sleep(1200); await nav(o.page, "thanks", 1800);
  const heart = o.page.locator('[data-thanks-empty] [data-line-art="heart"]');
  ok("ART: «Спасибо от гостей», пока пусто — сердце золотой линией", (await heart.count()) === 1 && (await heart.getAttribute("aria-hidden")) === "true" && (await heart.getAttribute("stroke")) === "#D2A85A");
  await shot(o.page, "art-thanks");
  await o.ctx.close();
  // случаи: ни одного — поднос с клошем
  const o2 = await open({ who: STAFF, rpcs: cases([]) });
  await sleep(1200); await nav(o2.page, "cases", 1800);
  ok("ART: случаи из зала, пока ни одного — поднос с клошем", (await o2.page.locator('[data-case-train] [data-line-art="tray"]').count()) === 1, await txt(o2.page.locator("[data-case-train]")));
  await shot(o2.page, "art-cases");
  await o2.ctx.close();
  // схема зала: руководителю, пока не нарисована — стол сверху
  const o3 = await open({ who: LEAD, rpcs: (fn) => (fn === "seat_board" ? { ok: true, day: "2026-10-23", now: NOW.toISOString(), lead: true, plan: { v: 1, tables: [] }, staff: SEATSTAFF, tables: [] } : undefined) });
  await sleep(1200); await nav(o3.page, "seat", 1800);
  ok("ART: схема зала ещё не нарисована — стол сверху", (await o3.page.locator('[data-line-art="table"]').count()) >= 1, await txt(o3.page.locator(".sa-screen")));
  await shot(o3.page, "art-seat");
  await o3.ctx.close();
  // голоса и «Как произносить»: внизу короткого списка
  const o4 = await open({ who: STAFF, menu: MENU_V });
  await sleep(1200); await nav(o4.page, "menuTrainer", 1800);
  await o4.page.locator('[data-menu-mode="voices"]').first().click(); await sleep(900);
  const mic = o4.page.locator('[data-line-art="mic"]');
  ok("ART: голоса шефа и сомелье — микрофон внизу списка", (await mic.count()) === 1 && Number(await mic.evaluate((e) => getComputedStyle(e).opacity)) < 0.6);
  await mic.scrollIntoViewIfNeeded(); await shot(o4.page, "art-voices");
  await o4.page.locator("[data-sa-back], button[aria-label='Вернуться']").first().click(); await sleep(700);
  await o4.page.locator('[data-menu-mode="say"]').first().click(); await sleep(1100);
  ok("ART: «Как произносить» — реплика со слогами внизу короткого списка", (await o4.page.locator('[data-line-art="say"]').count()) === 1);
  await o4.ctx.close();
  // брифинг у сотрудника: колокольчик после блоков
  const o5 = await open({ who: STAFF, rpcs: (fn) => (fn === "brief_today" ? todayOf(false) : fn === "brief_reads" ? { ok: true, brief: true, me: false, n: 0, rows: [], lead: false } : undefined) });
  await sleep(1200); await nav(o5.page, "shift");
  await o5.page.locator("[data-brief-card]").click(); await sleep(900);
  ok("ART: брифинг смены — колокольчик после блоков", (await o5.page.locator('[data-brief-view] [data-line-art="bell"]').count()) === 1);
  ok("ART: без ошибок в консоли", ![o, o2, o3, o4, o5].some((x) => x.errors.length), [o, o2, o3, o4, o5].flatMap((x) => x.errors).slice(0, 3).join(" | "));
  await o5.ctx.close();
}

if (want("CASE")) {
  const o = await open({ who: STAFF, rpcs: cases([CASE]) });
  await sleep(1200); await nav(o.page, "cases", 1800);
  await o.page.locator("[data-case-play]").click(); await sleep(1500);
  await o.page.locator(".tb .tb-actc", { hasText: "Сказать, что такого нет" }).first().click(); await sleep(1600);
  const pq = o.page.locator(".tb [data-case-real]");
  const t = await txt(pq);
  ok("CASE: после ответа — плашка «Как было у нас» и подпись рассказчика", (await pq.count()) === 1 && t === "Как было у нас Предложили «Апероль шприц». рассказал(а) Илья Бармен", t);
  const note = await txt(o.page.locator(".tb .tb-note"));
  ok("CASE: разбор над плашкой — только «почему так» (история не повторяется)", /Гость пришёл за вкусом, а не за названием\./.test(note) && (note.match(/Апероль/g) || []).length === 1, note.slice(0, 300));
  const st = await pq.evaluate((e) => ({ by: getComputedStyle(e.querySelector(".by")).fontFamily, p: getComputedStyle(e.querySelector("p")).fontStyle, bl: getComputedStyle(e).borderLeftWidth }));
  ok("CASE: подпись — рукописным (Marck Script), история — курсивом, слева золотая черта", /Marck Script/.test(st.by) && st.p === "italic" && st.bl === "3px", JSON.stringify(st));
  await pq.scrollIntoViewIfNeeded(); await shot(o.page, "case-plaque");
  for (let i = 0; i < 6; i++) {
    if (await o.page.locator(".tb .tb-receipt").count()) break;
    const foot = o.page.locator(".tb .tb-foot .tb-main");
    if (await foot.count()) { await foot.first().click(); await sleep(900); continue; }
    const any = o.page.locator(".tb .tb-actc").first(); if (await any.count()) { await any.click(); await sleep(1400); }
  }
  const bank = await o.page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]"), o.UK);
  const m = bank.find((x) => x.lessonId === "case-31");
  ok("CASE: в «Работе над ошибками» — разбор с «Как было у нас: …»", !!m && m.explanation === "Гость пришёл за вкусом, а не за названием. Как было у нас: Предложили «Апероль шприц».", JSON.stringify(m && m.explanation));
  ok("CASE: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("GUEST")) {
  const LINKS = [{ kind: "yandex", url: "https://yandex.ru/maps/org/dva_morya/1234567890/reviews/" }, { kind: "2gis", url: "https://2gis.ru/petropavlovsk/firm/70000001012345678" }];
  const guestRpc = (fn) => (fn === "guest_thanks_card" ? { ok: true, name: "Анна", pos: "waiter", restaurant: R0 } : fn === "guest_thanks_send" ? { ok: true } : fn === "guest_review_links" ? { ok: true, links: LINKS } : undefined);
  const SPLASH = () => { document.addEventListener("DOMContentLoaded", () => { const s = document.getElementById("sa-splash"); window.__splash = s ? s.className || "dark" : "нет"; }); };
  // с анимацией
  const o = await open({ who: null, path: "/?thanks=" + CODE, rpcs: guestRpc, motion: "no-preference", init: SPLASH });
  await sleep(1300);
  const look = await o.page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, theme: (document.querySelector('meta[name="theme-color"]') || {}).content, scheme: document.documentElement.style.colorScheme, splash: window.__splash,
    card: getComputedStyle(document.querySelector(".gt-card")).backgroundImage, name: getComputedStyle(document.querySelector("[data-guest-name]")).color }));
  ok("GUEST: страница кремовая: фон, полоса браузера, светлые поля ввода", look.body === "rgb(244, 234, 213)" && look.theme === "#F4EAD5" && look.scheme === "light" && /linear-gradient/.test(look.card), JSON.stringify(look));
  ok("GUEST: заставка по ссылке ?thanks= — светлая (без тёмной вспышки)", look.splash === "light", String(look.splash));
  ok("GUEST: имя — тёмными чернилами по бумаге", look.name === "rgb(42, 31, 14)", look.name);
  await shot(o.page, "guest-form");
  await o.page.locator('[data-guest-tag="advice"]').click();
  const pressed = await o.page.locator('[data-guest-tag="advice"]').evaluate((e) => getComputedStyle(e).backgroundImage);
  ok("GUEST: выбранная отметка — золотом", /linear-gradient/.test(pressed), pressed);
  await o.page.locator("[data-guest-send]").click();
  const t0 = Date.now();
  await o.page.waitForSelector("[data-guest-heart]", { timeout: 5000 });
  const frame = () => o.page.evaluate(() => { const cs = (s) => getComputedStyle(document.querySelector(s)); const rv = document.querySelector("[data-guest-reviews]");
    return { dash: parseFloat(cs(".gt-draw").strokeDashoffset), fill: Number(cs(".gt-fill").opacity), spark: Number(cs(".gt-spark.s1").opacity), rv: rv ? Number(getComputedStyle(rv).opacity) : -1 }; });
  await sleep(Math.max(0, 450 - (Date.now() - t0)));
  const f1 = await frame();
  await sleep(Math.max(0, 3200 - (Date.now() - t0)));
  const f2 = await frame();
  ok("GUEST: сердце рисуется линией: сначала контур не дорисован, заливки и искр нет", f1.dash > 0.3 && f1.fill < 0.1 && f1.spark < 0.1, JSON.stringify(f1));
  ok("GUEST: через три секунды сердце целиком, с заливкой и искрами", f2.dash === 0 && f2.fill === 1 && f2.spark > 0.8, JSON.stringify(f2));
  ok("GUEST: кнопки отзывов проявляются после сердца", f1.rv >= 0 && f1.rv < 0.3 && f2.rv === 1, JSON.stringify([f1.rv, f2.rv]));
  await shot(o.page, "guest-done");
  ok("GUEST: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
  // анимация выключена в телефоне
  const o2 = await open({ who: null, path: "/?thanks=" + CODE, rpcs: guestRpc });
  await sleep(1300);
  await o2.page.locator("[data-guest-send]").click(); await sleep(300);
  const g = await o2.page.evaluate(() => { const cs = (s) => getComputedStyle(document.querySelector(s)); return { dash: parseFloat(cs(".gt-draw").strokeDashoffset), fill: Number(cs(".gt-fill").opacity), beat: cs(".gt-beat").animationName }; });
  ok("GUEST: анимация выключена — сердце сразу целиком, без «биения»", g.dash === 0 && g.fill === 1 && g.beat === "none", JSON.stringify(g));
  await o2.ctx.close();
  // 320 px
  const o3 = await open({ who: null, path: "/?thanks=" + CODE, rpcs: guestRpc, w: 320, h: 640 });
  await sleep(1300);
  const a = await fits(o3.page, "[data-guest-thanks] *");
  await o3.page.locator("[data-guest-send]").click(); await sleep(2000);
  const b = await fits(o3.page, "[data-guest-thanks] *");
  ok("GUEST: 320 px — форма и «Спасибо передано» с кнопками отзывов без прокрутки вбок", a.sw <= a.W && a.over === 0 && b.sw <= b.W && b.over === 0, JSON.stringify([a, b]));
  await shot(o3.page, "guest-done-320");
  await o3.ctx.close();
}

if (want("PRINT")) {
  const SIZE = { card: [1080, 1440, "spasibo-kartochka.png"], tent: [1240, 1754, "spasibo-domik-a4.png"], insert: [1000, 2000, "spasibo-vkladysh.png"], sticker: [1000, 1000, "spasibo-nakleyka.png"] };
  const want1 = ORIGIN + "/?thanks=" + CODE;
  for (const light of [false, true]) {
    const tag = "PRINT" + (light ? " светлая" : "");
    const o = await open({ who: STAFF, light, rpcs: (fn) => (fn === "my_thanks" ? MINE() : undefined) });
    await sleep(1200); await nav(o.page, "thanks", 1800);
    const pr = o.page.locator("[data-thanks-print]");
    await pr.click(); await sleep(300);
    const box = o.page.locator("[data-thanks-layouts]");
    const radios = await box.locator('[role="radio"]').evaluateAll((es) => es.map((e) => e.getAttribute("data-thanks-layout") + ":" + e.getAttribute("aria-checked")));
    ok(tag + ": «Картинка для печати» — выбор из четырёх видов, карточка выбрана", (await pr.getAttribute("aria-expanded")) === "true" && radios.join() === "card:true,tent:false,insert:false,sticker:false"
      && /Что напечатать\? Карточка на стойку или в рамку Домик на стол лист A4, согнуть пополам В папку для счёта узкий вкладыш Наклейка на бейдж, кассу или бар/.test(await txt(box)), radios.join() + " | " + (await txt(box)).slice(0, 200));
    for (const k of ["card", "tent", "insert", "sticker"]) {
      if (k !== "card") await box.locator('[data-thanks-layout="' + k + '"]').click();
      await o.page.waitForSelector('[data-thanks-preview="' + k + '"] img', { timeout: 8000 }).catch(() => {});
      const nat = await box.locator("[data-thanks-preview] img").evaluate((e) => [e.naturalWidth, e.naturalHeight, e.getAttribute("alt")]).catch(() => []);
      if (!light) await box.scrollIntoViewIfNeeded().then(() => shot(o.page, "print-" + k));
      const dl = o.page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
      await box.locator("[data-thanks-save]").click();
      const d = await dl;
      let r = "нет скачивания";
      if (d) {
        const p = OUT + "/" + (light ? "light-" : "") + d.suggestedFilename();
        await d.saveAs(p);
        r = k === "tent" ? [qrReads(p + "@top", want1), qrReads(p + "@bottom", want1)].every((x) => x === true) || "домик: не обе половины" : qrReads(p, want1);
      }
      ok(tag + ": " + k + " — предпросмотр " + SIZE[k][0] + "×" + SIZE[k][1] + ", файл " + SIZE[k][2] + ", QR читается" + (k === "tent" ? " с обеих половин" : ""),
        nat[0] === SIZE[k][0] && nat[1] === SIZE[k][1] && !!d && d.suggestedFilename() === SIZE[k][2] && r === true, JSON.stringify([nat, d && d.suggestedFilename(), r]));
    }
    ok(tag + ": после сохранения — что делать с распечаткой", /Сохранено\. Распечатай на бумаге для наклеек и вырежи по пунктиру\./.test(await txt(o.page.locator('[role="status"]'))), await txt(o.page.locator('[role="status"]')));
    await pr.click(); await sleep(250);
    ok(tag + ": второе нажатие прячет выбор", !(await o.page.locator("[data-thanks-layouts]").count()) && (await pr.getAttribute("aria-expanded")) === "false");
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
  const o2 = await open({ who: STAFF, w: 320, h: 640, rpcs: (fn) => (fn === "my_thanks" ? MINE() : undefined) });
  await sleep(1200); await nav(o2.page, "thanks", 1800);
  await o2.page.locator("[data-thanks-print]").click(); await sleep(300);
  await o2.page.locator('[data-thanks-layout="tent"]').click();
  await o2.page.waitForSelector('[data-thanks-preview="tent"] img', { timeout: 8000 }).catch(() => {});
  const f = await fits(o2.page, "[data-thanks-layouts] *");
  ok("PRINT: 320 px — выбор вида и предпросмотр без прокрутки вбок", f.sw <= f.W && f.over === 0, JSON.stringify(f));
  await o2.page.locator("[data-thanks-layouts]").scrollIntoViewIfNeeded(); await shot(o2.page, "print-320");
  await o2.ctx.close();
}

if (want("ROLE")) {
  const RROWS = () => [...SROWS(), { tid: "t3", status: "res", cnt: 4, name: "Иванов", rtime: "20:00", since: null, waiter_id: null, waiter_name: "", updated_name: "Ольга Ли", updated_at: iso(30) }];
  const seat = (rows) => (fn) => (fn === "seat_board" ? { ok: true, day: "2026-10-23", now: NOW.toISOString(), lead: false, plan: PLAN, staff: SEATSTAFF, tables: rows } : undefined);
  // карточка смены дня («Сегодня · …») и сразу за ней — карточка под роль
  const order = (page) => page.evaluate(() => { const hero = [...document.querySelectorAll(".sa-card")].find((e) => /^Сегодня ·/.test(e.innerText.trim())), role = document.querySelector("[data-shift-role]");
    return !!(hero && role && hero.nextElementSibling === role); });
  // хостес
  for (const light of [false, true]) {
    const o = await open({ who: HOST, light, rpcs: seat(RROWS()) });
    await sleep(1200); await nav(o.page, "shift", 2200);
    const card = o.page.locator('[data-shift-role="host"]');
    const t = await txt(card);
    ok("ROLE: хостес" + (light ? " (светлая)" : "") + " — «Зал сейчас: свободно 0 из 5 · 9 гостей», легенда и ближайшая бронь", /^Зал сейчас Свободно 0 из 5 · 9 гостей Гости 1 Счёт 2 Уборка 1 Бронь 1 Ближайшая бронь: 20:00 · Иванов · 4 гостя · стол 3$/.test(t), t);
    const parts = await card.locator("[data-hall-bar] [data-part]").evaluateAll((es) => es.map((e) => e.getAttribute("data-part") + ":" + Math.round(e.getBoundingClientRect().width)));
    ok("ROLE: хостес — полоса зала цветами схемы, ширина по числу столов", parts.length === 4 && parts.map((p) => p.split(":")[0]).join() === "seat,bill,clean,res"
      && Number(parts[1].split(":")[1]) > Number(parts[0].split(":")[1]) * 1.6, parts.join());
    if (!light) ok("ROLE: карточка — сразу под сменой дня", await order(o.page));
    await shot(o.page, "role-host" + (light ? "-light" : ""));
    if (!light) {
      await card.click(); await sleep(1300);
      ok("ROLE: хостес — нажатие открывает рассадку", (await o.page.locator("[data-seat-summary]").count()) === 1);
    }
    ok("ROLE: хостес — без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
  // руководитель: брифинга нет
  const o2 = await open({ who: LEAD, rpcs: (fn, body) => (fn === "brief_today" ? { ok: true, day: "2026-10-23", brief: null } : fn === "quiz_hard_questions" ? [] : fn === "league_week" ? { ok: true, rows: [] } : seat(RROWS())(fn, body)) });
  await sleep(1200); await nav(o2.page, "shift", 2200);
  const lc = o2.page.locator('[data-shift-role="lead"]');
  ok("ROLE: руководитель — «Брифинг на сегодня ещё не отправлен» и строка зала", /^Руководителю смены Брифинг на сегодня ещё не отправлен Пять минут: приложение соберёт его само Собрать Зал: свободно 0 из 5 · 9 гостей · счёт: 2$/.test(await txt(lc)), await txt(lc));
  await shot(o2.page, "role-lead");
  await lc.locator("[data-role-brief]").click(); await sleep(2200);
  ok("ROLE: «Собрать» открывает брифинг смены", (await o2.page.locator("[data-brief-present]").count()) === 1);
  ok("ROLE: руководитель — без ошибок в консоли", !o2.errors.length, o2.errors.slice(0, 3).join(" | "));
  await o2.ctx.close();
  // руководитель: брифинг отправлен — только зал (о брифинге говорит его карточка)
  const o3 = await open({ who: LEAD, rpcs: (fn, body) => (fn === "brief_today" ? todayOf(true) : fn === "brief_reads" ? { ok: true, brief: true, me: false, n: 1, rows: [], lead: true } : seat(RROWS())(fn, body)) });
  await sleep(1200); await nav(o3.page, "shift", 2200);
  ok("ROLE: брифинг отправлен — в карточке только зал, брифинг — своей карточкой", !(await o3.page.locator("[data-role-brief]").count()) && (await o3.page.locator("[data-role-hall]").count()) === 1 && (await o3.page.locator("[data-brief-card]").count()) === 1);
  await o3.ctx.close();
  // официант
  const o4 = await open({ who: STAFF, rpcs: seat(RROWS()) });
  await sleep(1200); await nav(o4.page, "shift", 2200);
  const sc = o4.page.locator('[data-shift-role="staff"]');
  const chips = await sc.locator("[data-my-table]").evaluateAll((es) => es.map((e) => e.getAttribute("data-my-table") + "/" + e.getAttribute("data-status") + "/" + e.innerText.replace(/\s+/g, " ").trim()));
  ok("ROLE: официант — свои столы кружками: «1 · 3 гостя · 40 мин», «5 · счёт · 1 ч 10 мин»", chips.join("|") === "1/seat/1 3 гостя · 40 мин|5/bill/5 счёт · 1 ч 10 мин" && /^Твои столы/.test(await txt(sc)), chips.join("|"));
  ok("ROLE: официант — в пункте «Рассадка» по-прежнему «Твои столы: 1, 5 · 5 гостей · счёт: 1»", /Твои столы: 1, 5 · 5 гостей · счёт: 1/.test(await txt(o4.page.locator('.sa-card[aria-label="Рассадка"]'))));
  await shot(o4.page, "role-staff");
  await sc.click(); await sleep(1300);
  ok("ROLE: официант — нажатие открывает рассадку", (await o4.page.locator("[data-seat-summary]").count()) === 1);
  ok("ROLE: официант — без ошибок в консоли", !o4.errors.length, o4.errors.slice(0, 3).join(" | "));
  await o4.ctx.close();
  // официант без столов и хостес без этапа 35 — карточки нет
  const o5 = await open({ who: { ...STAFF, id: "e-ilya", name: "Илья", surname: "Бармен" }, rpcs: seat(RROWS()) });
  await sleep(1200); await nav(o5.page, "shift", 2200);
  ok("ROLE: официант без столов — карточки нет", !(await o5.page.locator("[data-shift-role]").count()));
  await o5.ctx.close();
  const o6 = await open({ who: HOST, rpcs: (fn) => (fn === "seat_board" ? { code: "PGRST202", message: "Could not find the function" } : undefined) });
  await sleep(1200); await nav(o6.page, "shift", 2200);
  ok("ROLE: без этапа 35 — карточки нет, ошибок нет", !(await o6.page.locator("[data-shift-role]").count()) && !o6.errors.length, o6.errors.slice(0, 2).join(" | "));
  await o6.ctx.close();
  // 320 px
  const o7 = await open({ who: HOST, w: 320, h: 640, rpcs: seat(RROWS()) });
  await sleep(1200); await nav(o7.page, "shift", 2200);
  const f = await fits(o7.page, "[data-shift-role] *");
  ok("ROLE: 320 px — карточка зала без прокрутки вбок", f.sw <= f.W && f.over === 0, JSON.stringify(f));
  await shot(o7.page, "role-320");
  await o7.ctx.close();
}

// Из зала (26.10): «в брифинге вторая хостес, хотя в графике одна». ✕ у сотрудника закрывает его прошлым месяцем (till),
// а смены этого месяца остаются в плане: таблица графика его не показывает — брифинг тоже не должен.
if (want("ROSTER")) {
  const SCHED = { ok: true, venues: [{ venue_key: "main", config: {
    staff: [{ id: 1, name: "Мария Ким", pos: "manager" }, { id: 2, name: "Ольга Ли", pos: "host" }, { id: 3, name: "Дутова Анна", pos: "host", till: "2026-09" },
      { id: 4, name: "Новикова Вера", pos: "host", since: "2026-11" }, { id: 5, name: "Анна Смирнова", pos: "waiter" }],
    shifts: [{ k: "Д", name: "День", from: 11, to: 24 }] } }],
    months: [{ venue_key: "main", month: "2026-10", payload: { plan: { 1: { 23: "Д" }, 2: { 23: "Д" }, 3: { 22: "Д", 23: "Д" }, 4: { 23: "Д" }, 5: { 23: "Д" } } } }] };
  const o = await open({ who: LEAD, rpcs: (fn) => (fn === "schedule_load" ? SCHED : undefined) });
  await sleep(1200); await nav(o.page, "brief", 2600);
  const roster = await txt(o.page.locator('[data-brief-block="roster"]'));
  ok("ROSTER: «Кто сегодня» — одна хостес, как в графике; удалённой крестиком и заведённой на ноябрь нет",
    /День · 11:00–24:00 Менеджер: Мария Ким Хостес: Ольга Ли Официант: Анна Смирнова/.test(roster) && !/Дутова|Новикова/.test(roster), roster);
  await o.page.locator('[data-brief-block="roster"]').scrollIntoViewIfNeeded(); await shot(o.page, "roster");
  ok("ROSTER: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
