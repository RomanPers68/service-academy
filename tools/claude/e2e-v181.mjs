// e2e v181 (Доп. 506): места с фото — второй проход по каждому столу; между соседними столами проход.
// Владелец: «И можно сделать так, что бы он и места переносил с фото?» и «И что бы он близко к фото делал рассадку.
// А то очень кучно делает».
// Разделы:
//   SEATS — «Расставить столы по фото»: первый проход (места неточные) → второй: в floor-scan уходят картинки столов
//           (mode "seats", по одной на стол, JPEG до 224 точек, плотные рамки) → места на схеме — из второго прохода;
//           пока идёт второй — «Считаю стулья у каждого стола»;
//   OLDFN — функция прежней версии (ответ без v: 2) — второго прохода нет, места первого; второй проход не ответил —
//           места первого и пометка в итоге;
//   LOOK  — зал как у владельца (22 стола почти вплотную): между соседними столами проход, подписи на круглых
//           на месте; обе темы и узкий телефон (360 точек), снимки.
// Голова сценария — как в e2e-v180.mjs (и e2e-v179.mjs).
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v181.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5381, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v181";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

const R0 = "Два моря, Океан";
const LEAD = { id: "u-lead", name: "Мария", surname: "Ким", restaurant: R0, position: "senior", is_admin: false };
const ukOf = (p) => "_" + p.name + "_" + p.surname;
const NOW = new Date("2026-11-20T07:20:00Z");   // 20.11, 19:20 по Камчатке
const iso = (minAgo) => new Date(NOW.getTime() - minAgo * 60000).toISOString();
const SEATSTAFF = [{ id: "e-anna", name: "Анна", surname: "Смирнова", position: "waiter" }, { id: "e-petr", name: "Пётр", surname: "Орлов", position: "waiter" }];

const ABORT = Symbol("abort");
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── план зала для фото: 800 × 600, белый лист, стены, 4 квадратных, 3 круглых, 2 длинных стола, бар и вход ──
const PLAN_TABLES = [
  ...[10, 32, 54, 76].map((x, i) => ({ b: [x, 15, x + 8, 25], shape: "square", seats: 4, n: String(i + 1) })),
  ...[15, 45, 75].map((x, i) => ({ b: [x, 44, x + 8, 54], shape: "round", seats: 2, n: String(i + 5) })),
  ...[10, 55].map((x, i) => ({ b: [x, 75, x + 30, 85], shape: "rect", seats: 8, n: String(i + 8) })),
];
const SCAN_OK = { ok: true, v: 1, plan: true, box: [3, 3, 97, 97], tables: PLAN_TABLES, bars: [[88, 6, 96, 38]], doors: [[50, 96]], note: "", model: "anthropic/claude-haiku-5.5", remaining: 19 };
async function drawPng(page, w, h, draw) {
  const url = await page.evaluate(({ w, h, draw }) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.fillStyle = "#000";
    // eslint-disable-next-line no-new-func
    new Function("g", "w", "h", draw)(g, w, h);
    return c.toDataURL("image/png");
  }, { w, h, draw });
  return Buffer.from(url.split(",")[1], "base64");
}
const PLAN_DRAW = `
  const P = (x, y) => [x * w / 100, y * h / 100];
  g.lineWidth = 5; g.strokeRect(...P(3, 3), 94 * w / 100, 94 * h / 100); g.lineWidth = 3; g.font = "bold 22px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  [10, 32, 54, 76].forEach((x, i) => { g.strokeRect(...P(x, 15), 8 * w / 100, 10 * h / 100); g.fillText(String(i + 1), ...P(x + 4, 20)); });
  [15, 45, 75].forEach((x, i) => { g.beginPath(); g.ellipse(...P(x + 4, 49), 4 * w / 100, 5 * h / 100, 0, 0, 7); g.stroke(); g.fillText(String(i + 5), ...P(x + 4, 49)); });
  [10, 55].forEach((x, i) => { g.strokeRect(...P(x, 75), 30 * w / 100, 10 * h / 100); g.fillText(String(i + 8), ...P(x + 15, 80)); });
  g.fillStyle = "#ddd"; g.fillRect(...P(88, 6), 8 * w / 100, 32 * h / 100); g.strokeRect(...P(88, 6), 8 * w / 100, 32 * h / 100); g.fillStyle = "#000"; g.fillText("БАР", ...P(92, 22));
  g.fillText("вход", ...P(50, 93));`;
const WIDE_DRAW = `
  g.lineWidth = 5; g.strokeRect(10, 10, w - 20, h - 20); g.lineWidth = 3;
  [60, 200, 340].forEach((y) => { for (let i = 0; i < 10; i++) g.strokeRect(40 + i * 112, y, 70, 90); });`;
// столы вытянутого плана 1200 × 500: 3 ряда по 10
const WIDE_TABLES = [];
[60, 200, 340].forEach((y) => { for (let i = 0; i < 10; i++) { const x = 40 + i * 112; WIDE_TABLES.push({ b: [x / 12, y / 5, (x + 70) / 12, (y + 90) / 5], shape: "square", seats: 4, n: "" }); } });
// размер JPEG из байтов (маркер SOF)
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

async function open({ who = LEAD, rpcs = () => undefined, calls = [], light = false, w = 393, h = 852, seedExtra = {} } = {}) {
  const UK = who ? ukOf(who) : "";
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\/floor-scan/.test(u)) {
      calls.push({ fn: "floor-scan", body, t: Date.now() });
      const own = rpcs("floor-scan", body);
      if (own === ABORT || own === undefined) return route.abort();
      if (own && own.__status) return route.fulfill({ status: own.__status, contentType: "application/json", body: JSON.stringify(own.body || {}) });
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
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] }, schedule_load: { ok: false, error: "auth" }, menu_get: [],
        qday_inbox: { ok: true, items: [] }, brief_today: { ok: true, brief: null }, case_list: { ok: true, lead: false, team: 0, fresh: 0, inbox: 0, mine_new: 0, top: null }, menu_progress_team: { ok: true, rows: [] } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_menu_shared: JSON.stringify({ [R0]: [] }), ...seedExtra };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
  }, seed);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(ORIGIN + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors, calls, UK };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const fits = (page, sel) => page.evaluate((sel) => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).length; return { W, sw: document.documentElement.scrollWidth, over }; }, sel);
// схема в памяти: seat_board / floor_save; floor2 — сервер с этапом 37
function floorServer({ has37 = true, has54 = true, plan = null, rows = [], scan = () => SCAN_OK } = {}) {
  const B = { plan, rows, saves: [], scans: [] };
  B.rpc = (fn, body) => {
    if (fn === "seat_board") return { ok: true, ...(has37 ? { floor: 2 } : {}), ...(has37 && has54 ? { tall: true } : {}), day: "2026-11-20", now: NOW.toISOString(), lead: true, plan: B.plan, staff: SEATSTAFF, tables: B.rows };
    if (fn === "floor_save") {
      B.saves.push(body.p_plan);
      if (!has54 && (body.p_plan.tables || []).some((t) => t.shape === "tall")) return { ok: false, error: "bad_plan" };   // как сервер без этапа 54
      B.plan = body.p_plan; return { ok: true, v: has37 ? 2 : undefined, tables: (body.p_plan.tables || []).length };
    }
    if (fn === "floor-scan") { B.scans.push(body); return scan(body, B.scans.length); }
    return undefined;
  };
  return B;
}
const tableBox = (page, id) => page.locator(`[data-floor] [data-table="${id}"]`).evaluate((e) => ({ x: parseFloat(e.style.left), y: parseFloat(e.style.top), w: parseFloat(e.style.width), h: parseFloat(e.style.height) }));
const cellBox = (page, k) => page.locator(`[data-floor] [data-cell="${k}"]`).evaluate((e) => ({ x: parseFloat(e.style.left), y: parseFloat(e.style.top), w: parseFloat(e.style.width) }));
// стол в клетке x:y — по положению кнопки (отступ стола от края клетки — меньше трети клетки)
const tablesAt = (page) => page.evaluate(() => {
  const fl = document.querySelector("[data-floor-editor] [data-floor]") || document.querySelector("[data-floor]");
  const cell = fl.clientWidth / 8;
  return [...fl.querySelectorAll("[data-table]")].map((e) => ({ id: e.getAttribute("data-table"), x: Math.round((parseFloat(e.style.left) - cell * 0.03) / cell), y: Math.round((parseFloat(e.style.top) - cell * 0.03) / cell),
    wide: parseFloat(e.style.width) > cell * 1.5, high: parseFloat(e.style.height) > cell * 1.5, chairs: e.querySelectorAll("[data-chair]").length, on: e.querySelectorAll('[data-chair="on"]').length, n: (e.querySelector("span > span") || {}).textContent || "" }));
});


// план как у владельца: колонка вертикальных длинных столов справа, квадратные слева
const TALL_TABLES = [
  { b: [70, 5, 80, 35], shape: "rect", seats: 8, n: "19" }, { b: [70, 40, 80, 70], shape: "rect", seats: 8, n: "18" },
  { b: [86, 50, 96, 95], shape: "rect", seats: 12, n: "30" },
  ...[10, 30, 50].map((x, i) => ({ b: [x, 20, x + 9, 30], shape: "square", seats: 4, n: String(i + 1) })),
];
const SCAN_TALL = { ok: true, v: 1, plan: true, box: [2, 2, 98, 98], tables: TALL_TABLES, bars: [], doors: [], note: "", model: "anthropic/claude-haiku-5.5", remaining: 19 };
const TALL_DRAW = `
  const P = (x, y) => [x * w / 100, y * h / 100];
  g.lineWidth = 5; g.strokeRect(...P(2, 2), 96 * w / 100, 96 * h / 100); g.lineWidth = 3; g.font = "bold 24px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  [[70, 5, 80, 35, "19"], [70, 40, 80, 70, "18"], [86, 50, 96, 95, "30"], [10, 20, 19, 30, "1"], [30, 20, 39, 30, "2"], [50, 20, 59, 30, "3"]].forEach(([a, b, c, d, n]) => {
    g.strokeRect(...P(a, b), (c - a) * w / 100, (d - b) * h / 100); g.fillText(n, ...P((a + c) / 2, (b + d) / 2)); });`;
const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };


// первый проход: столы плана из e2e-v179 (PLAN_DRAW), места неточные; второй проход — верные
const PASS1 = { ...SCAN_OK, v: 2, tables: PLAN_TABLES.map((t, i) => ({ ...t, seats: i < 4 ? 2 : i < 7 ? 5 : 6 })) };
const TRUE_SEATS = [4, 4, 4, 4, 2, 2, 2, 8, 8];
function seatsServer({ v = 2, seats = () => ({ ok: true, v: 2, mode: "seats", seats: TRUE_SEATS, model: "anthropic/claude-haiku-5.5" }), delay = 700 } = {}) {
  const S = { calls: [] };
  const B = floorServer({ plan: null });
  S.B = B;
  S.rpc = (fn, body) => {
    if (fn !== "floor-scan") return B.rpc(fn, body);
    S.calls.push(body);
    if (body.mode === "seats") return seats(body);
    return { ...PASS1, v };
  };
  return S;
}

if (want("SEATS")) {
  const S = seatsServer();
  const o = await open({ rpcs: S.rpc });
  const png = await drawPng(o.page, 800, 600, PLAN_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed = o.page.locator("[data-floor-editor]");
  await ed.locator("[data-floor-file]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png }); await sleep(900);
  // второй ответ задерживаем, чтобы увидеть надпись
  await o.ctx.route("**/functions/v1/floor-scan", async (route) => {
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    S.calls.push(body);
    if (body.mode === "seats") { await sleep(1500); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, v: 2, mode: "seats", seats: TRUE_SEATS }) }); }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PASS1) });
  });
  await ed.locator("[data-scan]").click();
  await o.page.waitForFunction(() => /Считаю стулья у каждого стола/.test((document.querySelector("[data-scan-busy]") || {}).textContent || ""), null, { timeout: 8000 }).catch(() => {});
  const busy = await txt(ed.locator("[data-scan-busy]"));
  ok("SEATS: пока идёт второй проход — «Считаю стулья у каждого стола»", /Считаю стулья у каждого стола\. Ещё 10–20 секунд\./.test(busy), busy);
  await sleep(2200);
  const sc = S.calls.find((b) => b.mode === "seats") || {};
  const sizes = (sc.crops || []).map((d) => { const s = jpegSize(Buffer.from(String(d).split(",")[1] || "", "base64")) || {}; return Math.max(s.w || 0, s.h || 0); });
  ok("SEATS: второй проход — 9 картинок столов (JPEG, длинная сторона 224), вход тот же", (sc.crops || []).length === 9 && sizes.every((x) => x === 224) && sc.token === "tok-preview" && (sc.crops || []).every((d) => /^data:image\/jpeg;base64,/.test(d)), JSON.stringify(sizes));
  const at = await tablesAt(o.page), by = Object.fromEntries(at.map((q) => [q.n, q]));
  ok("SEATS: места — из второго прохода (квадратные на 4, круглые на 2, длинные на 8)", ["1", "2", "3", "4"].every((n) => by[n].chairs === 4) && ["5", "6", "7"].every((n) => by[n].chairs === 2) && ["8", "9"].every((n) => by[n].chairs === 8),
    JSON.stringify(at.map((q) => q.n + ":" + q.chairs)));
  ok("SEATS: итог без пометки", !/по общему плану/.test(await txt(ed.locator("[data-editor-note]"))), await txt(ed.locator("[data-editor-note]")));
  // картинка стола: сам стол в середине, вокруг запас под стулья — снимок первой
  const first = Buffer.from(String((sc.crops || [""])[0]).split(",")[1] || "", "base64");
  if (first.length) { const { writeFileSync } = await import("node:fs"); writeFileSync(OUT + "/crop-1.jpg", first); }
  ok("SEATS: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("OLDFN")) {
  // функция прежней версии (v1): второго прохода нет
  const S1 = seatsServer({ v: 1 });
  const o = await open({ rpcs: S1.rpc });
  const png = await drawPng(o.page, 800, 600, PLAN_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed = o.page.locator("[data-floor-editor]");
  await ed.locator("[data-floor-file]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png }); await sleep(900);
  await ed.locator("[data-scan]").click(); await sleep(1600);
  const at = await tablesAt(o.page);
  ok("OLDFN: функция версии 1 — второго прохода нет, места первого (2 у квадратных)", !S1.calls.some((b) => b.mode === "seats") && at.length === 9 && at.filter((q) => !q.wide && q.chairs === 2).length >= 4, JSON.stringify(at.map((q) => q.n + ":" + q.chairs)));
  await o.ctx.close();
  // второй проход не ответил — места первого и пометка
  const S2 = seatsServer({ seats: () => ABORT });
  const o2 = await open({ rpcs: S2.rpc });
  const png2 = await drawPng(o2.page, 800, 600, PLAN_DRAW);
  await sleep(1200); await nav(o2.page, "seat", 1800);
  await o2.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed2 = o2.page.locator("[data-floor-editor]");
  await ed2.locator("[data-floor-file]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png2 }); await sleep(900);
  await ed2.locator("[data-scan]").click(); await sleep(1800);
  ok("OLDFN: второй проход не ответил — столы стоят, места первого, итог: «Места посчитаны по общему плану»", (await tablesAt(o2.page)).length === 9 && /Места посчитаны по общему плану: пересчитать у каждого стола не вышло\./.test(await txt(ed2.locator("[data-editor-note]"))) && !(await ed2.locator('[role="alert"]').count()),
    await txt(ed2.locator("[data-editor-note]")));
  ok("OLDFN: без ошибок в консоли", !o.errors.length && !o2.errors.length, [...o.errors, ...o2.errors].slice(0, 3).join(" | "));
  await o2.ctx.close();
}

// ── LOOK: зал как у владельца — 22 стола почти вплотную ──
if (want("LOOK")) {
  const T = (id, n, shape, x, y, seats) => ({ id, n, seats, shape, x, y, z: "z1" });
  const PLAN = { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [
    T("a20", "20", "sq", 0, 0, 2), T("a21", "21", "sq", 1, 0, 2), T("a19", "19", "tall", 5, 0, 8),
    T("a17", "17", "rd", 1, 1, 6), T("a16", "16", "rd", 2, 1, 6), T("a15", "15", "rd", 3, 1, 6), T("a14", "14", "rd", 4, 1, 6),
    T("a18", "18", "tall", 5, 2, 8), T("a11", "11", "rd", 1, 4, 4), T("a12", "12", "rd", 2, 4, 4), T("a13", "13", "sq", 3, 4, 2),
    T("a10", "10", "rd", 1, 5, 6), T("a9", "9", "rd", 2, 5, 6), T("a8", "8", "rd", 3, 5, 6), T("a7", "7", "rd", 4, 5, 6),
    T("a6", "6", "sq", 5, 4, 2), T("a5", "5", "sq", 5, 5, 4), T("a30", "30", "tall", 6, 4, 12),
    T("a1", "1", "sq", 1, 6, 4), T("a2", "2", "sq", 2, 6, 4), T("a3", "3", "long", 3, 6, 6), T("a4", "4", "sq", 5, 6, 2)] };
  const ROWS = [{ tid: "a16", status: "seat", cnt: 4, name: "", rtime: "", since: iso(30), waiter_id: "e-anna", waiter_name: "Анна Смирнова" },
    { tid: "a9", status: "bill", cnt: 5, name: "", rtime: "", since: iso(70), waiter_id: "e-petr", waiter_name: "Пётр Орлов" },
    { tid: "a18", status: "res", cnt: 8, name: "", rtime: "20:00", since: null, waiter_id: null, waiter_name: "" }];
  for (const [light, w] of [[false, 393], [true, 393], [false, 360]]) {
    const tag = "LOOK" + (light ? " светлая" : "") + (w !== 393 ? " " + w : "");
    const B = floorServer({ plan: PLAN, rows: ROWS });
    const o = await open({ light, w, rpcs: B.rpc });
    await sleep(1200); await nav(o.page, "seat", 1800);
    // проход: между рисунками соседних столов (их svg) — не меньше 5 точек
    const gaps = await o.page.evaluate(() => {
      const box = (id) => document.querySelector('[data-floor] [data-table="' + id + '"] svg').getBoundingClientRect();
      const h = (a, b) => box(b).left - box(a).right, v = (a, b) => box(b).top - box(a).bottom;
      return { h1716: h("a17", "a16"), h1514: h("a15", "a14"), v101: v("a10", "a1"), v1110: v("a11", "a10") };
    });
    ok(tag + ": между соседними столами проход (не меньше 5 точек) — и в ряду, и между рядами", Object.values(gaps).every((g) => g >= 5), JSON.stringify(gaps));
    // круглые столы: рисунок меньше клетки, а подпись под номером на месте — гости и минуты, «счёт», места
    const sub = async (id) => txt(o.page.locator(`[data-floor] [data-table="${id}"]`));
    const subs = { a16: await sub("a16"), a9: await sub("a9"), a17: await sub("a17"), a11: await sub("a11") };
    ok(tag + ": на круглых подписи на месте: «4·30м», «счёт», «6 м.», «4 м.»", /4·30м/.test(subs.a16) && /счёт/.test(subs.a9) && /6 м\./.test(subs.a17) && /4 м\./.test(subs.a11), JSON.stringify(subs));
    const at = await tablesAt(o.page);
    ok(tag + ": 22 стола, у каждого стулья по местам", at.length === 22 && at.every((q) => q.chairs === Number(PLAN.tables.find((t) => t.id === q.id).seats)));
    await o.page.locator("[data-floor]").screenshot({ path: OUT + "/look-dense" + (light ? "-light" : "") + (w !== 393 ? "-" + w : "") + ".png" });
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

await browser.close();
server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
