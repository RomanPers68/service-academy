// e2e v88 (Доп. 401): залы и стены на схеме зала, перетаскивание стола; «Вопрос дня» на главной; случаи голосом и
// «Черновик от ИИ».
// Разделы:
//   FLOOR   — руководитель (сервер с этапом 37): «＋ Зал», название зала, инструменты «Столы · Стены · Бар · Вход»: стена
//             по двум точкам, бар по двум клеткам, вход; стол перетаскивается мышью и пальцем (тень: встанет или нет),
//             на бар не встаёт; «Сохранить схему» → floor_save v2 (залы, столы с залом, предметы); доска: вкладки залов со
//             свободными, стены, бар и вход на схеме, подбор компании по всем залам; обе темы;
//   OLD     — сервер без этапа 37: в редакторе подсказка про этап 37, инструментов нет, сохраняется схема v1; сервер
//             с новой схемой отвечает old_app — понятное сообщение;
//   QDAY    — главная: карточка «Вопрос дня» с серией; ответ → qday_answer, верный золотом, мой неверный, разбор, «Работа
//             над ошибками» (переход), вопрос в банке ошибок и в учтённых; «уже ответил в Telegram» (again); без этапа 37 —
//             карточки нет; «Напоминания» → «Во сколько» → notify_qday_hour_set (час заведения → null);
//   CASES   — «Рассказать случай»: микрофоны у полей; руководитель: «Черновик от ИИ» → ai-chat → поля заполнены, «Вернуть
//             как было»; лимит Наставника на день — понятная ошибка;
//   NARROW  — 320 px: редактор схемы с залами и инструментами, карточка «Вопрос дня» — без прокрутки вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v88.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5288, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v88";
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
// ── схема зала в памяти (этап 37 — floor: 2) ──
function floorServer({ has37 = true, plan = null, rows = [], saveError = "" } = {}) {
  const B = { plan, rows, saves: [] };
  B.rpc = (fn, body) => {
    if (fn === "seat_board") return { ok: true, ...(has37 ? { floor: 2 } : {}), day: "2026-10-23", now: NOW.toISOString(), lead: true, plan: B.plan, staff: SEATSTAFF, tables: B.rows };
    if (fn === "floor_save") { B.saves.push(body.p_plan); if (saveError) return { ok: false, error: saveError }; B.plan = body.p_plan; return { ok: true, v: has37 ? 2 : undefined, tables: (body.p_plan.tables || []).length }; }
    return undefined;
  };
  return B;
}
const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

if (want("FLOOR")) {
  for (const light of [false, true]) {
    const tag = "FLOOR" + (light ? " светлая" : "");
    const B = floorServer({ plan: { v: 1, tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }, { id: "t2", n: "2", seats: 2, shape: "sq", x: 2, y: 0 }] } });
    const o = await open({ who: LEAD, light, rpcs: B.rpc });
    await sleep(1200); await nav(o.page, "seat", 1800);
    await o.page.locator("[data-floor-edit]").first().click(); await sleep(500);
    const ed = o.page.locator("[data-floor-editor]");
    ok(tag + ": редактор — вкладка зала «Зал», «＋ Зал», инструменты «Столы · Стены · Бар · Вход»", /^Зал ＋ Зал$/.test(await txt(ed.locator("[data-zone-tabs]"))) && (await txt(ed.locator("[data-tools]"))) === "Столы Стены Бар Вход"
      && (await ed.locator('[data-tool="table"]').getAttribute("aria-checked")) === "true", await txt(ed.locator("[data-zone-tabs]")));
    // перетащить стол 2 мышью в клетку 5:3
    const t2 = ed.locator('[data-table="t2"]'), cell = ed.locator('[data-cell="5:3"]');
    const a = await center(t2), b = await center(cell);
    await o.page.mouse.move(a.x, a.y); await o.page.mouse.down(); await o.page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
    await o.page.mouse.move(b.x, b.y, { steps: 4 }); await sleep(150);
    const ghost = await ed.locator("[data-drag-ghost]").getAttribute("data-drag-ghost").catch(() => "");
    await o.page.mouse.up(); await sleep(300);
    const pos = await t2.evaluate((e) => [e.style.left, e.style.top]);
    const cpos = await cell.evaluate((e) => [parseFloat(e.style.left), parseFloat(e.style.top)]);
    ok(tag + ": стол перетаскивается: тень «встанет», стол в клетке 5:3, выбран", ghost === "ok" && Math.abs(parseFloat(pos[0]) - cpos[0]) < 6 && Math.abs(parseFloat(pos[1]) - cpos[1]) < 6
      && (await ed.locator('[data-table-edit="t2"]').count()) === 1, JSON.stringify({ ghost, pos, cpos }));
    // стена: две точки по прямой; не по прямой — подсказка
    await ed.locator('[data-tool="wall"]').click(); await sleep(150);
    ok(tag + ": «Стены» — подсказка и точки сетки (9 в ряду)", /Нажми на точку, где стена начинается/.test(await txt(ed.locator("[data-editor-hint]"))) && (await ed.locator('[data-node^="8:"]').count()) > 0 && !(await ed.locator('[data-node^="9:"]').count()));
    await ed.locator('[data-node="0:2"]').click(); await ed.locator('[data-node="3:4"]').click(); await sleep(100);
    ok(tag + ": стена не по прямой — подсказка, новая первая точка", /Стена идёт по прямой/.test(await txt(ed.locator('[role="alert"]'))) && (await ed.locator('[data-node="3:4"]').getAttribute("aria-pressed")) === "true");
    await ed.locator('[data-node="8:4"]').click(); await sleep(150);
    ok(tag + ": стена 3:4 → 8:4 — линия на схеме и «Стена 1» в списке", (await ed.locator('[data-walls] [data-kind="wall"]').count()) === 1 && /Стена 1/.test(await txt(ed.locator("[data-items]"))));
    // бар: два угла; на столе — нет
    await ed.locator('[data-tool="bar"]').click(); await sleep(100);
    await ed.locator('[data-cell="0:0"]').click(); await ed.locator('[data-cell="1:0"]').click(); await sleep(100);
    ok(tag + ": бар на столе — «Бар не встаёт»", /Бар не встаёт: на пути стол или вход\./.test(await txt(ed.locator('[role="alert"]'))));
    await ed.locator('[data-cell="5:0"]').click(); await ed.locator('[data-cell="7:0"]').click(); await sleep(150);
    ok(tag + ": бар 5:0 → 7:0 — три клетки с подписью «Бар»", (await txt(ed.locator('[data-kind="bar"]'))) === "Бар" && /Бар/.test(await txt(ed.locator("[data-items]"))));
    await ed.locator('[data-tool="door"]').click(); await sleep(100);
    await ed.locator('[data-cell="7:5"]').click(); await sleep(150);
    ok(tag + ": вход в клетке 7:5", (await ed.locator('[data-kind="door"]').count()) === 1);
    // стол на бар не перетаскивается
    await ed.locator('[data-tool="table"]').click(); await sleep(100);
    const t1 = ed.locator('[data-table="t1"]'), barCell = ed.locator('[data-cell="6:0"]');
    const a1 = await center(t1), b1 = await center(barCell);
    await o.page.mouse.move(a1.x, a1.y); await o.page.mouse.down(); await o.page.mouse.move(b1.x, b1.y, { steps: 6 }); await sleep(120);
    const ghost2 = await ed.locator("[data-drag-ghost]").getAttribute("data-drag-ghost").catch(() => "");
    await o.page.mouse.up(); await sleep(250);
    ok(tag + ": на бар стол не встаёт: тень «нет», стол на месте, «Сюда стол не встаёт»", ghost2 === "no" && (await t1.evaluate((e) => parseFloat(e.style.left))) < 20 && /Сюда стол не встаёт/.test(await txt(ed.locator('[role="alert"]'))), ghost2);
    // пальцем (касание, как на телефоне): стол 1 в клетку 1:5, страница не прокручивается
    const cdp = await o.ctx.newCDPSession(o.page);
    const touch = (type, p) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
    const ta = await center(t1), tb = await center(ed.locator('[data-cell="1:5"]'));
    const sy0 = await o.page.evaluate(() => window.scrollY);
    await touch("touchStart", ta);
    for (let i = 1; i <= 8; i++) { await touch("touchMove", { x: ta.x + (tb.x - ta.x) * i / 8, y: ta.y + (tb.y - ta.y) * i / 8 }); await sleep(25); }
    const ghost3 = await ed.locator("[data-drag-ghost]").getAttribute("data-drag-ghost").catch(() => "");
    await touch("touchEnd", null); await sleep(300);
    const p1 = await t1.evaluate((e) => [parseFloat(e.style.left), parseFloat(e.style.top)]), c15 = await ed.locator('[data-cell="1:5"]').evaluate((e) => [parseFloat(e.style.left), parseFloat(e.style.top)]);
    ok(tag + ": пальцем: тень «встанет», стол 1 в клетке 1:5, страница на месте, ошибки нет", ghost3 === "ok" && Math.abs(p1[0] - c15[0]) < 6 && Math.abs(p1[1] - c15[1]) < 6
      && (await o.page.evaluate(() => window.scrollY)) === sy0 && !(await ed.locator('[role="alert"]').count()), JSON.stringify({ ghost3, p1, c15 }));
    // второй зал
    await ed.locator("[data-zone-add]").click(); await sleep(200);
    ok(tag + ": «＋ Зал» — вкладка «Зал 2» выбрана, поле названия", (await ed.locator('[data-zone-tab="z2"]').getAttribute("aria-selected")) === "true" && (await ed.locator("[data-zone-name]").inputValue()) === "Зал 2");
    await ed.locator("[data-zone-name]").fill("Веранда"); await sleep(100);
    await ed.locator('[data-cell="1:1"]').click(); await sleep(150);
    await ed.locator("[data-edit-n]").fill("В1"); await sleep(100);
    ok(tag + ": в «Веранде» свой стол, столов основного зала не видно", (await ed.locator("[data-floor] [data-table]").count()) === 1 && (await txt(ed.locator("[data-zone-tabs]"))) === "Зал Веранда ＋ Зал");
    await ed.locator('[data-zone-tab="z1"]').click(); await sleep(150);
    await ed.locator("[data-zone-name]").fill("Основной"); await sleep(100);
    await shot(o.page, "floor-editor" + (light ? "-light" : ""));
    await ed.locator("[data-floor-save]").click(); await sleep(800);
    const sv = B.saves[B.saves.length - 1] || {};
    const zs = (sv.zones || []).map((z) => z.id + ":" + z.name).join(",");
    const tz = (sv.tables || []).map((t) => t.n + "@" + t.z + "@" + t.x + ":" + t.y).sort().join(",");
    const its = (sv.items || []).map((i) => i.kind + "@" + i.z + (i.kind === "wall" ? "@" + [i.x, i.y, i.x2, i.y2].join(":") : i.kind === "bar" ? "@" + [i.x, i.y, i.w, i.h].join(":") : "@" + i.x + ":" + i.y)).join(",");
    ok(tag + ": floor_save v2 — залы, столы с залом, стена, бар, вход", sv.v === 2 && zs === "z1:Основной,z2:Веранда" && tz === "1@z1@1:5,2@z1@5:3,В1@z2@1:1" && its === "wall@z1@3:4:8:4,bar@z1@5:0:3:1,door@z1@7:5", JSON.stringify({ zs, tz, its }));
    // доска
    const tabs = o.page.locator("[data-board-zones]");
    ok(tag + ": доска — вкладки залов со свободными: «Основной 2», «Веранда 1»", (await txt(tabs)) === "Основной 2 Веранда 1" && (await o.page.locator("[data-floor] [data-table]").count()) === 2, await txt(tabs));
    ok(tag + ": на схеме стена, бар и вход", (await o.page.locator('[data-floor] [data-walls] line').count()) === 1 && (await o.page.locator('[data-floor] [data-kind="bar"]').count()) === 1 && (await o.page.locator('[data-floor] [data-kind="door"]').count()) === 1);
    await shot(o.page, "floor-board" + (light ? "-light" : ""));
    // подбор компании — по всем залам: здесь стол 2 (2 места) и стол 1, на веранде — В1
    await o.page.locator('[data-party="2"]').click(); await sleep(250);
    ok(tag + ": «Посадить: 1–2» — подходящие и здесь, и на веранде", (await txt(o.page.locator("[data-suggest]"))) === "Подойдут: стол 2, стол 1. Они подсвечены. Ещё в зале «Веранда»: стол В1.", await txt(o.page.locator("[data-suggest]")));
    ok(tag + ": на вкладке «Веранда» — точка: там есть подходящий стол", (await o.page.locator('[data-board-zone="z2"] [data-zone-hi]').count()) === 1);
    await o.page.locator('[data-board-zone="z2"]').click(); await sleep(250);
    ok(tag + ": вкладка «Веранда» — свой стол В1, выбор запомнен", (await o.page.locator('[data-floor] [data-table]').count()) === 1 && (await o.page.evaluate(() => localStorage.getItem("sa_seat_zone"))) === "z2");
    await o.page.locator('[data-floor] [data-table]').first().click(); await sleep(400);
    ok(tag + ": карточка стола — «Стол В1 · Веранда»", /^Стол В1 · Веранда/.test(await txt(o.page.locator("[data-table-sheet]"))), (await txt(o.page.locator("[data-table-sheet]"))).slice(0, 40));
    await o.page.locator("[data-table-sheet] [data-sa-back]").click(); await sleep(250);
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("OLD")) {
  const B = floorServer({ has37: false, plan: { v: 1, tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }] } });
  const o = await open({ who: LEAD, rpcs: B.rpc });
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed = o.page.locator("[data-floor-editor]");
  ok("OLD: без этапа 37 — подсказка про этап 37, ни залов, ни инструментов", /Залы, стены, бар и вход появятся, когда на сервер добавят этап 37/.test(await txt(ed.locator("[data-need37]"))) && !(await ed.locator("[data-tools]").count()) && !(await ed.locator("[data-zone-tabs]").count()));
  await ed.locator('[data-cell="3:2"]').click(); await sleep(150);
  await ed.locator("[data-floor-save]").click(); await sleep(700);
  const sv = B.saves[0] || {};
  ok("OLD: сохраняется схема v1 (без залов и предметов)", sv.v === 1 && !sv.zones && !sv.items && (sv.tables || []).length === 2 && sv.tables.every((t) => !("z" in t)), JSON.stringify(sv).slice(0, 200));
  await o.ctx.close();
  const B2 = floorServer({ saveError: "old_app", plan: { v: 1, tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }] } });
  const o2 = await open({ who: LEAD, rpcs: B2.rpc });
  await sleep(1200); await nav(o2.page, "seat", 1800);
  await o2.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  await o2.page.locator("[data-floor-save]").click(); await sleep(700);
  ok("OLD: сервер ответил old_app — «На сервере схема новее: обнови приложение.»", /На сервере схема новее: обнови приложение\./.test(await txt(o2.page.locator('[data-floor-editor] [role="alert"]'))));
  ok("OLD: без ошибок в консоли", !o.errors.length && !o2.errors.length, [...o.errors, ...o2.errors].slice(0, 3).join(" | "));
  await o2.ctx.close();
}

const QITEM = { id: 7, q: "Через сколько секунд гостя нужно поприветствовать?", o: ["До 30 секунд", "Через 5 минут", "Когда сядет за стол"], t: "Встреча гостя", r: "Официант", day: "2026-10-23", via: "app", answer: null, correct: null, at: null };
const qdayServer = ({ has37 = true, again = false } = {}) => {
  const Q = { answers: [], hours: [], item: QITEM, prefs: { ok: true, bot: true, linked: true, remind: true, pair: true, quest: true, league: true, fresh: true, month: true, master: true, qday: true, qday_hour: 12, qday_hour_default: 12, qday_hour_mine: null, brief: true, cases: true, thanks: true, seat: true } };
  Q.rpc = (fn, body) => {
    // сервер помнит ответ: после него qday_today отдаёт итог (с верным вариантом и разбором)
    if (fn === "qday_today") return has37 ? { ok: true, day: "2026-10-23", hour: 12, streak: Q.item.answer == null ? 2 : 3, item: Q.item } : { code: "PGRST202", message: "Could not find the function" };
    if (fn === "qday_answer") {
      Q.answers.push(body);
      if (Q.item.answer != null && !again) return { ok: false, error: "again", item: Q.item, streak: 3 };
      const item = { ...QITEM, answer: again ? 0 : body.p_answer, correct: (again ? 0 : body.p_answer) === 0, c: 0, e: "Первый контакт до 30 секунд: гость видит, что его заметили.", at: NOW.toISOString() };
      Q.item = item;
      return again ? { ok: false, error: "again", item, streak: 3 } : { ok: true, item, streak: 3 };
    }
    if (fn === "tg_status") return { ok: true, bot: true, linked: true, remind: true, minutes: 60 };
    if (fn === "notify_prefs") return Q.prefs;
    if (fn === "notify_quiet") return { ok: true, from: null, to: null };
    if (fn === "notify_qday_hour_set") { Q.hours.push(body.p_hour); Q.prefs = { ...Q.prefs, qday_hour: body.p_hour == null ? 12 : body.p_hour, qday_hour_mine: body.p_hour }; return Q.prefs; }
    return undefined;
  };
  return Q;
};

if (want("QDAY")) {
  for (const light of [false, true]) {
    const tag = "QDAY" + (light ? " светлая" : "");
    const Q = qdayServer({});
    const o = await open({ who: STAFF, light, rpcs: Q.rpc });
    o.t0 = Date.now();
    await sleep(2400);
    const card = o.page.locator("[data-qday-card]");
    ok(tag + ": на главной — «Вопрос дня» с темой и серией, три варианта", (await card.getAttribute("data-qday-card")) === "ask" && /^Вопрос дня · Встреча гостя серия 2 дня Через сколько секунд гостя нужно поприветствовать\? А До 30 секунд Б Через 5 минут В Когда сядет за стол$/.test(await txt(card)), await txt(card));
    await card.scrollIntoViewIfNeeded(); await shot(o.page, "qday-ask" + (light ? "-light" : ""));
    await card.locator('[data-qday-opt="2"]').click(); await sleep(900);
    ok(tag + ": ответ «В» → qday_answer (номер вопроса и вариант)", Q.answers.length === 1 && Q.answers[0].p_id === 7 && Q.answers[0].p_answer === 2, JSON.stringify(Q.answers));
    ok(tag + ": итог — верный «А» золотом, мой «В» отмечен, разбор, серия 3 дня", (await card.getAttribute("data-qday-card")) === "bad" && (await card.locator('[data-qday-opt="0"]').getAttribute("data-state")) === "right"
      && (await card.locator('[data-qday-opt="2"]').getAttribute("data-state")) === "wrong" && /Неверно\. Верный ответ: А\. Первый контакт до 30 секунд: гость видит, что его заметили\. Вопрос ждёт в «Работе над ошибками»\. Следующий вопрос завтра\./.test(await txt(card.locator("[data-qday-result]")))
      && /серия 3 дня/.test(await txt(card)), await txt(card));
    const st = await o.page.evaluate((uk) => ({ bank: JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]"), seen: JSON.parse(localStorage.getItem("sa_qday_seen" + uk) || "[]") }), o.UK);
    ok(tag + ": вопрос — в «Работе над ошибками», номер учтён (из Telegram второй раз не придёт в банк)", st.bank.some((m) => m.q === QITEM.q && m.correct === 0) && st.seen.includes(7), JSON.stringify(st.seen));
    await card.locator('[data-qday-opt="0"]').click(); await sleep(300);
    ok(tag + ": после ответа варианты не нажимаются", Q.answers.length === 1);
    await shot(o.page, "qday-bad" + (light ? "-light" : ""));
    // через 8 с приложение ещё раз спрашивает qday_today (после очереди): итог на карточке остаётся
    await sleep(Math.max(0, 9500 - (Date.now() - o.t0)));
    ok(tag + ": после повторного qday_today итог на месте", (await card.getAttribute("data-qday-card")) === "bad" && o.calls.filter((c) => c.fn === "qday_today").length >= 2, String(o.calls.filter((c) => c.fn === "qday_today").length));
    await card.locator("[data-qday-mistakes]").click(); await sleep(1200);
    ok(tag + ": «Работе над ошибками» — переход в работу над ошибками", (await txt(o.page.locator('button[aria-label="Вернуться"] + div'))) === "Работа над ошибками" && !(await o.page.locator("[data-qday-card]").count()));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
  // уже ответил в Telegram
  const Q2 = qdayServer({ again: true });
  const o2 = await open({ who: STAFF, rpcs: Q2.rpc, seedExtra: { ["sa_qday_seen" + ukOf(STAFF)]: JSON.stringify([7]) } });
  await sleep(2400);
  await o2.page.locator('[data-qday-card] [data-qday-opt="1"]').click(); await sleep(900);
  const bank2 = await o2.page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]"), o2.UK);
  ok("QDAY: ответил раньше в Telegram — показан засчитанный ответ (верно), в банк второй раз не пишем", (await o2.page.locator("[data-qday-card]").getAttribute("data-qday-card")) === "ok" && /Верно\./.test(await txt(o2.page.locator("[data-qday-result]"))) && !bank2.some((m) => m.q === QITEM.q));
  await o2.ctx.close();
  // без этапа 37
  const Q3 = qdayServer({ has37: false });
  const o3 = await open({ who: STAFF, rpcs: Q3.rpc });
  await sleep(2400);
  ok("QDAY: без этапа 37 — карточки нет, ошибок нет", !(await o3.page.locator("[data-qday-card]").count()) && !o3.errors.length, o3.errors.slice(0, 2).join(" | "));
  await o3.ctx.close();
  // свой час
  const Q4 = qdayServer({});
  const o4 = await open({ who: STAFF, rpcs: Q4.rpc });
  await sleep(1500); await nav(o4.page, "shift");
  await o4.page.locator('.sa-card[aria-label="Напоминания в Telegram"]').first().click(); await sleep(1400);
  const hr = o4.page.locator("[data-qday-hour]");
  ok("QDAY: «Вопрос дня» → «Во сколько»: 8:00…20:00, выбран час заведения 12:00", /^Во сколько: 8:00 10:00 12:00 14:00 16:00 18:00 20:00 Час заведения: 12:00\./.test(await txt(hr)) && (await hr.locator('[data-qday-h="12"]').getAttribute("aria-pressed")) === "true", await txt(hr));
  const qrow = o4.page.locator('[data-notify-prefs] [role="switch"]', { hasText: "Вопрос дня" });
  await hr.locator('[data-qday-h="18"]').click(); await sleep(600);
  ok("QDAY: 18:00 → notify_qday_hour_set 18, подпись «в 18:00 вопрос с кнопками ответа»", JSON.stringify(Q4.hours) === "[18]" && (await o4.page.locator('[data-qday-h="18"]').getAttribute("aria-pressed")) === "true"
    && /в 18:00 вопрос с кнопками ответа/.test(await txt(qrow)), await txt(qrow));
  await o4.page.locator('[data-qday-h="12"]').click(); await sleep(600);
  ok("QDAY: снова 12:00 (час заведения) → null, подпись «в 12:00»", JSON.stringify(Q4.hours) === "[18,null]" && (await o4.page.locator('[data-qday-h="12"]').getAttribute("aria-pressed")) === "true"
    && /в 12:00 вопрос с кнопками ответа/.test(await txt(qrow)), JSON.stringify(Q4.hours));
  await hr.scrollIntoViewIfNeeded(); await shot(o4.page, "qday-hour");
  await o4.ctx.close();
}

const INBOX = [{ id: 41, author: "Анна Смирнова", author_id: "e-anna", anon: false, at: "2026-10-23T01:10:00Z", status: "new", outcome: "bad", note: "",
  story: "Гость за шестым столом попросил пересадить: дует из окна, а свободных столов у окна не было.", did: "Сказала, что мест нет, и ушла." }];
const AI_REPLY = "СЦЕНА: Гость за столом у окна просит пересадить: дует, а свободных столов у окна нет.\nВОПРОС: Как поступить?\nВЕРНО: Извиниться, предложить плед и первый освободившийся стол.\nНЕВЕРНО1: Сказать, что мест нет, и уйти.\nНЕВЕРНО2: Предложить подождать без пледа.\nРАЗБОР: Гостю важно, что о нём позаботились сразу, а не когда освободится стол.\nКАК БЫЛО: Сказали, что мест нет; гость ушёл недовольным.\n[[lesson:s1-1|Открыть урок]]";
if (want("CASES")) {
  // сотрудник: микрофоны
  const o = await open({ who: STAFF, rpcs: (fn, body) => (fn === "case_list" ? (body.p_mode === "counts" ? { ok: true, lead: false, team: 0, fresh: 0, inbox: 0, mine_new: 0, top: null } : { ok: true, lead: false, team: [], mine: [] }) : undefined) });
  await sleep(1200); await nav(o.page, "cases", 1800);
  await o.page.locator("[data-case-tell-open]").click(); await sleep(300);
  ok("CASES: «Рассказать случай» — микрофоны у «Что случилось» и «Что ты сделал(а)»", (await o.page.locator('[data-case-tell] [data-case-mic="story"] button').count()) === 1 && (await o.page.locator('[data-case-tell] [data-case-mic="did"] button').count()) === 1
    && /Можно рассказать голосом: нажми на микрофон\./.test(await txt(o.page.locator("[data-case-tell]"))));
  // подпись — у поля, микрофон — отдельно: нажатие на «Что случилось» ставит курсор в поле и запись не включает
  await o.page.locator('[data-case-tell] label', { hasText: "Что случилось" }).click(); await sleep(200);
  ok("CASES: нажатие на подпись — курсор в поле, запись не включилась", (await o.page.evaluate(() => (document.activeElement || {}).getAttribute && document.activeElement.getAttribute("data-case-field"))) === "story"
    && (await o.page.getByLabel("Что случилось", { exact: true }).getAttribute("data-case-field")) === "story" && (await o.page.locator('[data-case-mic="story"] button').getAttribute("aria-label")) === "Сказать голосом"
    && !(await o.page.locator('[data-case-tell] [role="alert"]').count()));
  await o.page.locator("[data-case-tell]").scrollIntoViewIfNeeded(); await shot(o.page, "cases-tell-mic");
  await o.ctx.close();
  // руководитель: черновик от ИИ
  for (const light of [false, true]) {
    const tag = "CASES" + (light ? " светлая" : "");
    let mode = "ok";
    const o2 = await open({ who: LEAD, light, rpcs: (fn, body) => {
      if (fn === "case_list") return body.p_mode === "counts" ? { ok: true, lead: true, team: 0, fresh: 0, inbox: 1, mine_new: 0, top: null } : { ok: true, lead: true, team: [], mine: [], inbox: INBOX, done: [] };
      if (fn === "ai-chat") return mode === "ok" ? { ok: true, reply: AI_REPLY, model: "test", remaining: 12 } : { ok: false, error: "daily_limit", limit: 20 };
      return undefined;
    } });
    await sleep(1200); await nav(o2.page, "cases", 1800);
    await o2.page.locator('[data-case-inbox="41"]').click(); await sleep(600);
    const rv = o2.page.locator('[data-case-review="41"]');
    ok(tag + ": в разборе — «Черновик от ИИ» и пояснение", (await txt(rv.locator("[data-case-ai-go]"))) === "Черновик от ИИ" && /Наставник разложит рассказ на сцену, вопрос, верный и неверные варианты и разбор/.test(await txt(rv.locator("[data-case-ai-msg]"))));
    const before = await rv.locator('[data-case-field="scene"]').inputValue();
    await rv.locator("[data-case-ai-go]").click(); await sleep(900);
    const ai = o2.calls.filter((c) => c.fn === "ai-chat").map((c) => c.body);
    ok(tag + ": запрос Наставнику — рассказ, что сделали, итог, метки строк", ai.length === 1 && ai[0].token === "tok-preview" && /Рассказ: «Гость за шестым столом попросил пересадить/.test(ai[0].messages[0].content)
      && /Что сделали: «Сказала, что мест нет, и ушла\.»/.test(ai[0].messages[0].content) && /СЦЕНА:/.test(ai[0].messages[0].content), JSON.stringify(ai[0] || {}).slice(0, 200));
    const val = (k) => rv.locator('[data-case-field="' + k + '"]').inputValue();
    ok(tag + ": поля заполнены черновиком: сцена, вопрос, верно, два неверных, разбор, как было", (await val("scene")) === "Гость за столом у окна просит пересадить: дует, а свободных столов у окна нет."
      && (await val("right")) === "Извиниться, предложить плед и первый освободившийся стол." && (await val("wrong0")) === "Сказать, что мест нет, и уйти." && (await val("wrong1")) === "Предложить подождать без пледа."
      && (await val("wrong2")) === "" && /Гостю важно/.test(await val("why")) && (await val("real")) === "Сказали, что мест нет; гость ушёл недовольным.", await val("scene"));
    ok(tag + ": «Черновик готов. Проверь каждое поле…», кнопка — «Ещё вариант от ИИ»", /Черновик готов\. Проверь каждое поле/.test(await txt(rv.locator("[data-case-ai-msg]"))) && (await txt(rv.locator("[data-case-ai-go]"))) === "Ещё вариант от ИИ");
    await rv.locator("[data-case-ai-go]").scrollIntoViewIfNeeded(); await shot(o2.page, "cases-ai" + (light ? "-light" : ""));
    await rv.locator("[data-case-ai-undo]").click(); await sleep(200);
    ok(tag + ": «Вернуть как было» — прежний черновик", (await val("scene")) === before && !(await rv.locator("[data-case-ai-undo]").count()));
    mode = "limit";
    await rv.locator("[data-case-ai-go]").click(); await sleep(800);
    ok(tag + ": лимит Наставника — «На сегодня запросы к Наставнику закончились»", /На сегодня запросы к Наставнику закончились/.test(await txt(rv.locator('[role="alert"]'))) && (await val("scene")) === before);
    ok(tag + ": микрофоны в разборе: сцена, разбор, как было", (await rv.locator("[data-case-mic]").count()) === 3);
    ok(tag + ": без ошибок в консоли", !o2.errors.length, o2.errors.slice(0, 3).join(" | "));
    await o2.ctx.close();
  }
}

if (want("NARROW")) {
  const B = floorServer({ plan: { v: 2, zones: [{ id: "z1", name: "Основной зал" }, { id: "z2", name: "Летняя веранда" }, { id: "z3", name: "Второй этаж" }],
    tables: [{ id: "t1", n: "1", seats: 4, shape: "long", x: 6, y: 0, z: "z1" }], items: [{ id: "i1", kind: "wall", x: 0, y: 2, x2: 8, y2: 2, z: "z1" }, { id: "i2", kind: "bar", x: 0, y: 3, w: 4, h: 1, z: "z1" }] } });
  const o = await open({ who: LEAD, w: 320, h: 640, rpcs: B.rpc });
  await sleep(1200); await nav(o.page, "seat", 1800);
  const a = await fits(o.page, "[data-board-zones] *, [data-floor] *");
  ok("NARROW: 320 px — вкладки залов и схема без прокрутки вбок", a.sw <= a.W && a.over === 0, JSON.stringify(a));
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  await o.page.locator('[data-tool="wall"]').click(); await sleep(150);
  const b = await fits(o.page, "[data-floor-editor] *:not([data-node])");
  ok("NARROW: 320 px — редактор с залами и инструментами без прокрутки вбок", b.sw <= b.W && b.over === 0, JSON.stringify(b));
  await shot(o.page, "narrow-editor");
  await o.ctx.close();
  const Q = qdayServer({});
  const o2 = await open({ who: STAFF, w: 320, h: 640, rpcs: Q.rpc });
  await sleep(2400);
  await o2.page.locator('[data-qday-card] [data-qday-opt="1"]').click(); await sleep(800);
  const c = await fits(o2.page, "[data-qday-card] *");
  ok("NARROW: 320 px — «Вопрос дня» с разбором без прокрутки вбок", c.sw <= c.W && c.over === 0, JSON.stringify(c));
  await o2.page.locator("[data-qday-card]").scrollIntoViewIfNeeded(); await shot(o2.page, "narrow-qday");
  await o2.ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
