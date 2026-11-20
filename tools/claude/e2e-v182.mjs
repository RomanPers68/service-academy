// e2e v182 (Доп. 507): места по стульям, а не по номеру на столе.
// Владелец: «Он не ориентируется по количеству на фото. Делает совсем неправильно», «Он нумерацию столов определил как
// количество гостей».
// Разделы:
//   MASK   — план как из кассы (тёмный фон, цветные столы, белые номера, стулья, диваны): первый проход принял номера за
//            места (как у владельца), второй насчитал стулья. В картинках второго прохода номеров нет (белых точек
//            почти нет, у исходной вырезки — сотни), стулья целы; на схеме — номера с плана и места по стульям;
//   RENAME — номер с плана уже есть в другом зале: стол получил следующий свободный, итог говорит какой и что делать.
// Голова сценария — как в e2e-v181.mjs.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v182.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5382, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v182";
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

// ── план как из кассы: 1000 × 700, тёмный фон; столы цветные, номера белые, стулья светлые, диваны ──
// px → проценты: x / 10, y / 7
const POS_DRAW = `
  g.fillStyle = "#151515"; g.fillRect(0, 0, w, h);
  const chair = (x, y, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, 11, 9, 0, 0, 7); g.fill(); };
  const label = (t, x, y, px) => { g.fillStyle = "#fff"; g.font = "bold " + px + "px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, x, y); };
  // круглый 15: центр 200, 210, радиус 60, пять стульев
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; chair(200 + 80 * Math.cos(a), 210 + 80 * Math.sin(a), "#8fdc8f"); }
  g.fillStyle = "#3cb043"; g.beginPath(); g.arc(200, 210, 60, 0, 7); g.fill(); label("15", 200, 210, 46);
  // длинный 2: два стула сверху, диван снизу (три подушки)
  chair(450, 136, "#f3a0b0"); chair(550, 136, "#f3a0b0");
  g.fillStyle = "#e88aa0"; g.fillRect(392, 256, 216, 34); g.strokeStyle = "#b85870"; g.lineWidth = 2; [464, 536].forEach((x) => { g.beginPath(); g.moveTo(x, 258); g.lineTo(x, 288); g.stroke(); });
  g.fillStyle = "#d8304f"; g.fillRect(400, 150, 200, 100); label("2", 500, 185, 46); label("48 мин", 500, 226, 22);
  // вертикальный 19: по четыре стула с боков
  [95, 165, 235, 305].forEach((y) => { chair(746, y, "#8fdc8f"); chair(854, y, "#8fdc8f"); });
  g.fillStyle = "#3cb043"; g.fillRect(760, 60, 80, 280); label("19", 800, 200, 46);
  // квадратный 6: стул слева, диван справа
  chair(386, 465, "#f3a0b0"); g.fillStyle = "#e88aa0"; g.fillRect(494, 410, 34, 110);
  g.fillStyle = "#d8304f"; g.fillRect(400, 420, 90, 90); label("6", 445, 465, 46);`;
const POS_B = { 15: [14, 150 / 7, 26, 270 / 7], 2: [40, 150 / 7, 60, 250 / 7], 19: [76, 60 / 7, 84, 340 / 7], 6: [40, 60, 49, 510 / 7] };
const POS_SHAPE = { 15: "round", 2: "rect", 19: "rect", 6: "square" };
const POS_ORDER = ["15", "2", "19", "6"];
// первый проход как у владельца: номера ушли в места, номеров нет
const PASS1_BAD = { ok: true, v: 3, plan: true, box: [2, 2, 98, 98], tables: POS_ORDER.map((n) => ({ b: POS_B[n], shape: POS_SHAPE[n], seats: Number(n), n: "" })), bars: [], doors: [], note: "", model: "anthropic/claude-haiku-5.5", remaining: 19 };
// первый проход как надо: номера прочитаны, места по стульям
const PASS1_GOOD = { ...PASS1_BAD, tables: POS_ORDER.map((n, i) => ({ b: POS_B[n], shape: POS_SHAPE[n], seats: [5, 4, 8, 2][i], n })) };
const COUNTS = [5, 4, 8, 2];

// белые точки (цифры) и точки стульев на картинке; to — вырезать из исходного фото ту же область без пятен
const pixStats = (page, src, crop = null) => page.evaluate(async ({ src, crop }) => {
  const img = new Image(); img.src = src; await img.decode();
  let w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
  if (crop) { sx = crop[0] / 100 * w; sy = crop[1] / 100 * h; sw = (crop[2] - crop[0]) / 100 * w; sh = (crop[3] - crop[1]) / 100 * h; const k = 224 / Math.max(sw, sh); w = Math.round(sw * k); h = Math.round(sh * k); }
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  let white = 0, chair = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    if (r > 215 && gg > 215 && b > 215) white++;
    else if ((gg > 190 && r > 110 && r < 175 && b > 110 && b < 175) || (r > 225 && gg > 140 && gg < 185 && b > 155 && b < 200)) chair++;
  }
  return { w, h, white, chair };
}, { src, crop });
const cropOf = (b) => { const bw = b[2] - b[0], bh = b[3] - b[1], p = Math.max(0.5 * Math.min(bw, bh), 2); return [Math.max(0, b[0] - p), Math.max(0, b[1] - p), Math.min(100, b[2] + p), Math.min(100, b[3] + p)]; };

function posServer({ pass1, plan = null }) {
  const S = { calls: [] };
  const B = floorServer({ plan });
  S.B = B;
  S.rpc = (fn, body) => {
    if (fn !== "floor-scan") return B.rpc(fn, body);
    S.calls.push(body);
    if (body.mode === "seats") return { ok: true, v: 3, mode: "seats", seats: COUNTS.slice(0, (body.crops || []).length), model: "anthropic/claude-haiku-5.5" };
    return pass1;
  };
  return S;
}
async function scanIn(o, { zone = "" } = {}) {
  const png = await drawPng(o.page, 1000, 700, POS_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed = o.page.locator("[data-floor-editor]");
  if (zone) { await ed.locator(`[data-zone-tab="${zone}"]`).click(); await sleep(300); }
  await ed.locator("[data-floor-file]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png }); await sleep(900);
  await ed.locator("[data-scan]").click(); await sleep(2200);
  return { ed, png };
}

if (want("MASK")) {
  const S = posServer({ pass1: PASS1_BAD });
  const o = await open({ rpcs: S.rpc });
  const { ed, png } = await scanIn(o);
  const sc = S.calls.find((b) => b.mode === "seats") || {};
  const crops = sc.crops || [];
  ok("MASK: второй проход — 4 картинки столов", crops.length === 4, String(crops.length));
  const src = "data:image/png;base64," + png.toString("base64");
  const rows = [];
  for (let i = 0; i < crops.length; i++) {
    const n = POS_ORDER[i];
    const sent = await pixStats(o.page, crops[i]), orig = await pixStats(o.page, src, cropOf(POS_B[n]));
    rows.push({ n, sent, orig });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(OUT + "/crop-" + n + ".jpg", Buffer.from(String(crops[i]).split(",")[1] || "", "base64"));
  }
  ok("MASK: в исходной вырезке номер виден (сотни белых точек), в отправленной — закрыт (белых почти нет)",
    rows.length === 4 && rows.every((q) => q.orig.white > 150 && q.sent.white <= Math.max(6, q.orig.white * 0.03)), JSON.stringify(rows.map((q) => [q.n, q.orig.white, q.sent.white])));
  ok("MASK: стулья целы — точек стульев не меньше 85% исходных", rows.length === 4 && rows.every((q) => q.orig.chair > 40 && q.sent.chair >= q.orig.chair * 0.85), JSON.stringify(rows.map((q) => [q.n, q.orig.chair, q.sent.chair])));
  const at = await tablesAt(o.page), by = Object.fromEntries(at.map((q) => [q.n, q]));
  ok("MASK: на схеме номера с плана (15, 2, 19, 6), места — по стульям (5, 4, 8, 2)", at.length === 4 && POS_ORDER.every((n, i) => by[n] && by[n].chairs === COUNTS[i]), JSON.stringify(at.map((q) => q.n + ":" + q.chairs)));
  ok("MASK: вертикальный 19 — вертикально", !!by["19"] && by["19"].high && !by["19"].wide, JSON.stringify(by["19"] || {}));
  const note = await txt(ed.locator("[data-editor-note]"));
  ok("MASK: итог без «уже есть на схеме» и без «по общему плану»", /^Расставил 4 стола по фото\./.test(note) && !/уже есть на схеме|по общему плану/.test(note), note);
  await shot(o.page, "mask-editor");
  ok("MASK: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("RENAME")) {
  // в «Зал 1» уже есть стол 15; план распознаём в «Зал 2»
  const PLAN = { v: 2, zones: [{ id: "z1", name: "Зал 1" }, { id: "z2", name: "Зал 2" }], items: [], tables: [{ id: "t1", n: "15", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }] };
  const S = posServer({ pass1: PASS1_GOOD, plan: PLAN });
  const o = await open({ rpcs: S.rpc });
  const { ed } = await scanIn(o, { zone: "z2" });
  const at = await tablesAt(o.page), nums = at.map((q) => q.n).sort((a, b) => a - b);
  ok("RENAME: в «Зал 2» стол с плана «15» получил 20 (15 — в «Зал 1»), остальные — свои номера", JSON.stringify(nums) === JSON.stringify(["2", "6", "19", "20"]), JSON.stringify(nums));
  const note = await txt(ed.locator("[data-editor-note]"));
  // v185: что делать — кнопка «Взять номера с фото» под итогом (подробно — e2e-v185.mjs)
  ok("RENAME: итог — «Номер 15 уже есть на схеме: у этого стола теперь 20» и кнопка «Взять номера с фото»",
    note.includes("Номер 15 уже есть на схеме: у этого стола теперь 20.") && (await ed.locator("[data-take-btn]").count()) === 1, note);
  await shot(o.page, "rename-editor");
  ok("RENAME: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

await browser.close();
server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
