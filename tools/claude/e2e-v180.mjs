// e2e v180 (Доп. 505): длинные столы вертикально на схеме зала (сервер — этап 54: seat_board отдаёт tall: true).
// Владелец: «Но почему то не учитывает длинные столы по вертикали, а только горизонт».
// Разделы:
//   TALL  — редактор: в выборе вида восемь столов (и вертикальные на 6 и 8 мест); вертикальный — две клетки в высоту,
//           стулья по бокам; «Повернуть» длинный ↔ вертикальный; перетаскивание за нижнюю половину; «Ещё такой» —
//           справа; «Длинный» у квадратного у правого края — вертикальный; floor_save с формой tall; доска;
//   SCAN  — «Расставить столы по фото»: вытянутые вверх столы плана — вертикальные, без пометки про этап 54;
//   NO54  — сервер без этапа 54: шесть видов и подсказка про этап 54, «Повернуть» нет, «Длинный» у края — ошибка;
//           вертикальные столы с фото — квадратными, итог говорит про этап 54;
//   LOOK  — доска с вертикальными столами (гости, бронь), обе темы.
// Голова сценария — как в e2e-v179.mjs.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v180.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5380, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v180";
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

// ── TALL: редактор с этапом 54 ──
if (want("TALL")) {
  const B = floorServer({ plan: { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t2", n: "2", seats: 6, shape: "long", x: 2, y: 0, z: "z1" }] } });
  const o = await open({ rpcs: B.rpc });
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(500);
  const ed = o.page.locator("[data-floor-editor]");
  const kinds = await ed.locator("[data-kinds] [data-kind]").evaluateAll((a) => a.map((e) => e.getAttribute("data-kind")));
  ok("TALL: восемь видов стола — и вертикальные на 6 и 8 мест; подсказки про этап 54 нет", kinds.join(",") === "2sq,4sq,4rd,6rd,6long,8long,6tall,8tall" && !(await ed.locator("[data-need54]").count()), kinds.join(","));
  await ed.locator('[data-kind="6tall"]').click(); await sleep(100);
  await ed.locator('[data-cell="4:2"]').click(); await sleep(150);
  let at = await tablesAt(o.page);
  let v = at.find((q) => q.x === 4 && q.y === 2);
  ok("TALL: вертикальный на 6 мест — две клетки в высоту, шесть стульев, выбран", !!v && v.high && !v.wide && v.chairs === 6 && (await ed.locator(`[data-table-edit="${v.id}"]`).count()) === 1, JSON.stringify(v));
  ok("TALL: у выбранного вертикального — «Повернуть», форма «Длинный» горит", (await ed.locator("[data-edit-turn]").count()) === 1 && (await ed.locator('[data-edit-shape="long"]').getAttribute("data-lens-btn")) === "tab");
  await shot(o.page, "tall-editor");
  // «Повернуть» длинный стол 2: встаёт вертикально на своё место и обратно
  await ed.locator('[data-floor] [data-table="t2"]').click(); await sleep(120);
  await ed.locator("[data-edit-turn]").click(); await sleep(150);
  at = await tablesAt(o.page);
  let t2 = at.find((q) => q.id === "t2");
  ok("TALL: «Повернуть» — длинный стол 2 вертикально в 2:0", !!t2 && t2.x === 2 && t2.y === 0 && t2.high && !t2.wide, JSON.stringify(t2));
  await ed.locator("[data-edit-turn]").click(); await sleep(150);
  t2 = (await tablesAt(o.page)).find((q) => q.id === "t2");
  ok("TALL: ещё раз — снова горизонтально", !!t2 && t2.wide && !t2.high && t2.x === 2 && t2.y === 0, JSON.stringify(t2));
  // перетащить вертикальный за нижнюю половину: клетка под пальцем — нижняя
  const vt = ed.locator(`[data-floor] [data-table="${v.id}"]`), bb = await vt.boundingBox();
  const from = { x: bb.x + bb.width / 2, y: bb.y + bb.height * 0.75 }, to = await center(ed.locator('[data-cell="1:4"]'));
  await o.page.mouse.move(from.x, from.y); await o.page.mouse.down(); await o.page.mouse.move(to.x, to.y, { steps: 8 }); await sleep(120);
  const ghost = await ed.locator("[data-drag-ghost]").evaluate((e) => ({ ok: e.getAttribute("data-drag-ghost"), h: parseFloat(e.style.height), w: parseFloat(e.style.width) })).catch(() => null);
  await o.page.mouse.up(); await sleep(300);
  v = (await tablesAt(o.page)).find((q) => q.id === v.id);
  ok("TALL: перетаскивание за нижнюю половину — тень в два ряда, стол встал в 1:3 (нижняя клетка — 1:4)", !!ghost && ghost.ok === "ok" && ghost.h > ghost.w * 1.6 && v.x === 1 && v.y === 3, JSON.stringify({ ghost, v }));
  await ed.locator("[data-edit-copy]").click(); await sleep(150);
  at = await tablesAt(o.page);
  const cp = at.find((q) => q.x === 2 && q.y === 3);
  ok("TALL: «Ещё такой» — вертикальный справа (2:3)", !!cp && cp.high && cp.chairs === 6, JSON.stringify(cp));
  // квадратный у правого края: «Длинный» — вертикально
  await ed.locator('[data-kind="4sq"]').click(); await ed.locator('[data-cell="7:5"]').click(); await sleep(150);
  await ed.locator('[data-edit-shape="long"]').click(); await sleep(150);
  const sq = (await tablesAt(o.page)).find((q) => q.x === 7 && q.y === 5);
  ok("TALL: «Длинный» у квадратного у правого края — вертикальный, ошибки нет", !!sq && sq.high && !(await ed.locator('[role="alert"]').count()), JSON.stringify(sq));
  await ed.locator("[data-floor-save]").click(); await sleep(800);
  const sv = B.saves[0] || {};
  const tall = (sv.tables || []).filter((t) => t.shape === "tall").map((t) => t.x + ":" + t.y).sort().join(",");
  ok("TALL: floor_save — вертикальные столы с формой tall (1:3, 2:3, 7:5)", tall === "1:3,2:3,7:5", tall);
  const board = await tablesAt(o.page);
  ok("TALL: на доске вертикальные — в два ряда", board.filter((q) => q.high).length === 3, JSON.stringify(board.map((q) => q.n + (q.high ? "↕" : ""))));
  await shot(o.page, "tall-board");
  ok("TALL: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

// ── SCAN: вертикальные столы с фото ──
if (want("SCAN")) {
  const B = floorServer({ plan: null, scan: () => SCAN_TALL });
  const o = await open({ rpcs: B.rpc });
  const png = await drawPng(o.page, 800, 1000, TALL_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed = o.page.locator("[data-floor-editor]");
  await ed.locator("[data-floor-file]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png }); await sleep(900);
  await ed.locator("[data-scan]").click(); await sleep(1500);
  const at = await tablesAt(o.page), by = Object.fromEntries(at.map((q) => [q.n, q]));
  ok("SCAN: 19, 18 и 30 — вертикальные, 1–3 — квадратные", at.length === 6 && ["19", "18", "30"].every((n) => by[n] && by[n].high) && ["1", "2", "3"].every((n) => by[n] && !by[n].high && !by[n].wide), JSON.stringify(at.map((q) => q.n + "@" + q.x + ":" + q.y + (q.high ? "↕" : ""))));
  ok("SCAN: места с плана — 8, 8 и 12", by["19"].chairs === 8 && by["18"].chairs === 8 && by["30"].chairs === 12);
  ok("SCAN: итог без пометки про этап 54", /^Расставил 6 столов по фото\./.test(await txt(ed.locator("[data-editor-note]"))) && !/этап/.test(await txt(ed.locator("[data-editor-note]"))), await txt(ed.locator("[data-editor-note]")));
  await ed.locator("[data-floor]").screenshot({ path: OUT + "/scan-floor.png" });
  await ed.locator("[data-floor-save]").click(); await sleep(800);
  ok("SCAN: сохранено — три вертикальных", ((B.saves[0] || {}).tables || []).filter((t) => t.shape === "tall").length === 3);
  ok("SCAN: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

// ── NO54: сервер без этапа 54 ──
if (want("NO54")) {
  const B = floorServer({ has54: false, plan: { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [{ id: "t1", n: "1", seats: 6, shape: "long", x: 0, y: 0, z: "z1" }] }, scan: () => SCAN_TALL });
  const o = await open({ rpcs: B.rpc, seedExtra: { sa_floor_kind: "8tall" } });
  const png = await drawPng(o.page, 800, 1000, TALL_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed = o.page.locator("[data-floor-editor]");
  const kinds = await ed.locator("[data-kinds] [data-kind]").evaluateAll((a) => a.map((e) => e.getAttribute("data-kind") + (e.getAttribute("aria-checked") === "true" ? "*" : "")));
  ok("NO54: шесть видов; запомненный «вертикальный на 8» — как «длинный на 8»; подсказка про этап 54", kinds.join(",") === "2sq,4sq,4rd,6rd,6long,8long*" && /этап 54 \(supabase-stage54-tall-tables\.sql\)/.test(await txt(ed.locator("[data-need54]"))), kinds.join(","));
  await ed.locator('[data-cell="3:3"]').click(); await sleep(150);
  ok("NO54: на клетку встал длинный горизонтальный", (await tablesAt(o.page)).some((q) => q.x === 3 && q.y === 3 && q.wide));
  await ed.locator('[data-floor] [data-table="t1"]').click(); await sleep(120);
  ok("NO54: у длинного стола «Повернуть» нет", !(await ed.locator("[data-edit-turn]").count()));
  await ed.locator('[data-kind="4sq"]').click(); await ed.locator('[data-cell="7:5"]').click(); await sleep(150);
  await ed.locator('[data-edit-shape="long"]').click(); await sleep(150);
  ok("NO54: «Длинный» у правого края — «Справа нет места для длинного стола»", /Справа нет места для длинного стола/.test(await txt(ed.locator('[role="alert"]'))));
  await ed.locator("[data-floor-file]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png }); await sleep(900);
  await ed.locator("[data-scan]").click(); await sleep(250);
  await ed.locator('[data-scan-mode="replace"]').click(); await sleep(1500);
  const at = await tablesAt(o.page);
  ok("NO54: столы с фото — вертикальных нет, итог про этап 54", at.length === 6 && !at.some((q) => q.high) && /3 длинных стола стоят на плане вертикально: поставил квадратными, вертикальные появятся с этапом 54 на сервере\./.test(await txt(ed.locator("[data-editor-note]"))), await txt(ed.locator("[data-editor-note]")));
  await shot(o.page, "no54-editor");
  ok("NO54: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

// ── LOOK: доска с вертикальными столами ──
if (want("LOOK")) {
  const PLAN = { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [
    { id: "t1", n: "19", seats: 8, shape: "tall", x: 6, y: 0, z: "z1" }, { id: "t2", n: "18", seats: 8, shape: "tall", x: 6, y: 3, z: "z1" },
    { id: "t3", n: "30", seats: 12, shape: "tall", x: 7, y: 5, z: "z1" }, { id: "t4", n: "1", seats: 4, shape: "sq", x: 0, y: 1, z: "z1" },
    { id: "t5", n: "2", seats: 6, shape: "long", x: 2, y: 1, z: "z1" }, { id: "t6", n: "3", seats: 4, shape: "rd", x: 4, y: 1, z: "z1" }] };
  const ROWS = [{ tid: "t1", status: "seat", cnt: 6, name: "", rtime: "", since: iso(35), waiter_id: "e-anna", waiter_name: "Анна Смирнова" },
    { tid: "t3", status: "res", cnt: 10, name: "Банкет", rtime: "20:00", since: null, waiter_id: null, waiter_name: "" }];
  for (const light of [false, true]) {
    const tag = "LOOK" + (light ? " светлая" : "");
    const B = floorServer({ plan: PLAN, rows: ROWS });
    const o = await open({ light, rpcs: B.rpc });
    await sleep(1200); await nav(o.page, "seat", 1800);
    const at = await tablesAt(o.page), by = Object.fromEntries(at.map((q) => [q.n, q]));
    ok(tag + ": вертикальные 19, 18, 30 — в два ряда, стульев 8, 8, 12; закрашено: гости 6, бронь 10", ["19", "18", "30"].every((n) => by[n].high) && [by["19"].chairs, by["18"].chairs, by["30"].chairs].join() === "8,8,12" && by["19"].on === 6 && by["30"].on === 10,
      JSON.stringify(at.map((q) => q.n + ":" + q.chairs + "/" + q.on)));
    await o.page.locator('[data-party="8"]').click(); await sleep(250);
    ok(tag + ": «Посадить: 7+» — подходит вертикальный 18 (8 мест)", (await o.page.locator('[data-floor] [data-table="t2"]').getAttribute("data-hi")) === "1");
    await o.page.locator("[data-floor]").screenshot({ path: OUT + "/look-floor" + (light ? "-light" : "") + ".png" });
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
