// e2e v183 (Доп. 508): стулья по сторонам стола и диван.
// Владелец: «А мы можем добавить возможность передвигать стулья за столом? Имею ввиду добавить возможность выбирать с
// какой стороны будет стул?»
// Разделы:
//   SIDES — редактор, сервер с этапом 55: у длинного стола диван снизу (на сколько стульев сверху), диван на троих,
//           «Как было»; у квадратного стул снизу переносится влево, справа диван; места стола — всего по сторонам;
//           «Мест +» прибавляет место на диване; «Повернуть» — диван уходит влево, назад — снова снизу; «Шаг назад»;
//           у круглого блока нет; «Сохранить схему» — sides у столов и признак sides: true;
//   OLD   — сервер без этапа 55: блока нет, в схему признак не пишется;
//   BOARD — доска смены: стол с диваном, гости садятся сначала на стулья, потом на диван; подпись мест;
//   LOOK  — карточка стола с блоком в тёмной и светлой теме, телефон 360 точек без прокрутки вбок, снимки.
// Голова сценария — как в e2e-v182.mjs.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v183.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5383, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v183";
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
function floorServer({ has37 = true, has54 = true, has55 = true, plan = null, rows = [], scan = () => SCAN_OK } = {}) {
  const B = { plan, rows, saves: [], scans: [] };
  B.rpc = (fn, body) => {
    if (fn === "seat_board") return { ok: true, ...(has37 ? { floor: 2 } : {}), ...(has37 && has54 ? { tall: true } : {}), ...(has37 && has54 && has55 ? { sides: true } : {}), day: "2026-11-20", now: NOW.toISOString(), lead: true, plan: B.plan, staff: SEATSTAFF, tables: B.rows };
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


const PLAN = { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [
  { id: "t1", n: "1", seats: 4, shape: "long", x: 0, y: 0, z: "z1" }, { id: "t2", n: "6", seats: 2, shape: "sq", x: 3, y: 0, z: "z1" },
  { id: "t3", n: "15", seats: 5, shape: "rd", x: 5, y: 0, z: "z1" }] };
const clone = (x) => JSON.parse(JSON.stringify(x));
async function editor(o) {
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  return o.page.locator("[data-floor-editor]");
}
const pick = async (ed, id) => { await ed.locator(`[data-floor] [data-table="${id}"]`).click(); await sleep(150); };
const side = (ed, i) => ed.locator(`[data-chair-sides] [data-side="${i}"]`);
const sideN = async (ed, i) => Number(await txt(side(ed, i).locator("[data-side-n]")));
const art = (page, id) => page.evaluate((id) => {
  const e = document.querySelector('[data-floor] [data-table="' + id + '"]');
  if (!e) return null;
  const all = [...e.querySelectorAll("[data-chair]")];
  return { chairs: all.filter((x) => !x.hasAttribute("data-sofa")).length, cushions: all.filter((x) => x.hasAttribute("data-sofa")).length, backs: e.querySelectorAll("[data-sofa-back]").length,
    on: e.querySelectorAll('[data-chair="on"]').length, sub: (e.querySelectorAll("span > span")[1] || {}).textContent || "" };
}, id);

if (want("SIDES")) {
  const B = floorServer({ plan: clone(PLAN) });
  const o = await open({ rpcs: B.rpc });
  const ed = await editor(o);
  await pick(ed, "t1");
  ok("SIDES: у длинного стола — «Стулья по сторонам»: сверху 2, справа 0, снизу 2, слева 0 (как по местам), без «Как было»",
    (await ed.locator("[data-chair-sides]").count()) === 1 && [await sideN(ed, 0), await sideN(ed, 3), await sideN(ed, 1), await sideN(ed, 2)].join(",") === "2,0,2,0" && !(await ed.locator("[data-sides-reset]").count()));
  await side(ed, 1).locator("[data-side-sofa]").click(); await sleep(150);
  let a = await art(o.page, "t1");
  ok("SIDES: «Снизу: диван» — на месте двух стульев диван на двоих: 2 стула, 2 подушки, спинка; мест 4; «Как было» появилось",
    a.chairs === 2 && a.cushions === 2 && a.backs === 1 && (await side(ed, 1).locator("[data-side-sofa]").getAttribute("aria-pressed")) === "true" && (await txt(ed.locator("[data-seats]"))) === "4" && (await ed.locator("[data-sides-reset]").count()) === 1, JSON.stringify(a));
  await side(ed, 1).locator("[data-side-plus]").click(); await sleep(150);
  a = await art(o.page, "t1");
  ok("SIDES: «Снизу: больше» у дивана — диван на троих, мест 5", a.cushions === 3 && (await sideN(ed, 1)) === 3 && (await txt(ed.locator("[data-seats]"))) === "5", JSON.stringify(a));
  await ed.locator("[data-seats-plus]").click(); await sleep(150);
  ok("SIDES: «Мест +» со своими сторонами — место прибавилось на диване (на четверых)", (await sideN(ed, 1)) === 4 && (await txt(ed.locator("[data-seats]"))) === "6");
  await ed.locator("[data-seats-minus]").click(); await sleep(150);
  // повернуть: вертикальный — диван слева; назад — снова снизу
  await ed.locator("[data-edit-turn]").click(); await sleep(200);
  const t1v = (await tablesAt(o.page)).find((q) => q.id === "t1");
  ok("SIDES: «Повернуть» — стол вертикально, диван теперь слева, стулья справа", !!t1v && t1v.high && (await sideN(ed, 2)) === 3 && (await side(ed, 2).locator("[data-side-sofa]").getAttribute("aria-pressed")) === "true" && (await sideN(ed, 3)) === 2,
    JSON.stringify(t1v));
  await ed.locator("[data-edit-turn]").click(); await sleep(200);
  ok("SIDES: «Повернуть» ещё раз — как было: диван снизу на троих, стулья сверху", (await sideN(ed, 1)) === 3 && (await side(ed, 1).locator("[data-side-sofa]").getAttribute("aria-pressed")) === "true" && (await sideN(ed, 0)) === 2);
  // квадратный: стул снизу — влево, справа диван (на столько, сколько стульев напротив)
  await pick(ed, "t2");
  await side(ed, 1).locator("[data-side-minus]").click(); await sleep(120);
  await side(ed, 2).locator("[data-side-plus]").click(); await sleep(120);
  a = await art(o.page, "t2");
  ok("SIDES: квадратный — стул снизу перенесён влево: сверху 1, слева 1; мест по-прежнему 2", (await sideN(ed, 0)) === 1 && (await sideN(ed, 1)) === 0 && (await sideN(ed, 2)) === 1 && a.chairs === 2 && (await txt(ed.locator("[data-seats]"))) === "2", JSON.stringify(a));
  await side(ed, 3).locator("[data-side-sofa]").click(); await sleep(150);
  a = await art(o.page, "t2");
  ok("SIDES: «Справа: диван» — на столько, сколько стульев напротив (1): мест 3, подпись «3 м.»", a.cushions === 1 && a.chairs === 2 && (await txt(ed.locator("[data-seats]"))) === "3" && /3 м\./.test(a.sub), JSON.stringify(a));
  // последний стул не убирается: минус выключен, когда за столом одно место
  ok("SIDES: у стороны без стульев минус выключен", await side(ed, 1).locator("[data-side-minus]").isDisabled());
  // «Шаг назад» — диван справа снят
  await ed.locator("[data-undo]").click(); await sleep(150);
  ok("SIDES: «Шаг назад» — дивана справа нет, мест 2", !(await art(o.page, "t2")).cushions && (await txt(ed.locator("[data-seats]"))) === "2");
  await side(ed, 3).locator("[data-side-sofa]").click(); await sleep(150);
  // круглый — блока нет
  await pick(ed, "t3");
  ok("SIDES: у круглого стола блока нет (стулья вокруг)", !(await ed.locator("[data-chair-sides]").count()) && (await ed.locator('[data-table-edit="t3"]').count()) === 1);
  await pick(ed, "t1");
  await shot(o.page, "sides-editor");
  await ed.locator("[data-floor-save]").click(); await sleep(700);
  const saved = B.saves[B.saves.length - 1] || {};
  const by = Object.fromEntries((saved.tables || []).map((t) => [t.n, t]));
  ok("SIDES: сохранено — признак sides: true; у 1: [2, −3, 0, 0] на 5, у 6: [1, 0, 1, −1] на 3, у 15 sides нет",
    saved.sides === true && JSON.stringify(by["1"] && by["1"].sides) === "[2,-3,0,0]" && by["1"].seats === 5 && JSON.stringify(by["6"] && by["6"].sides) === "[1,0,1,-1]" && by["6"].seats === 3 && by["15"] && !("sides" in by["15"]),
    JSON.stringify(saved.tables || []));
  ok("SIDES: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("OLD")) {
  const B = floorServer({ has55: false, plan: clone(PLAN) });
  const o = await open({ rpcs: B.rpc });
  const ed = await editor(o);
  await pick(ed, "t1");
  ok("OLD: сервер без этапа 55 — блока «Стулья по сторонам» нет", !(await ed.locator("[data-chair-sides]").count()) && (await ed.locator('[data-table-edit="t1"]').count()) === 1);
  await ed.locator("[data-seats-plus]").click(); await sleep(120);
  await ed.locator("[data-floor-save]").click(); await sleep(700);
  const saved = B.saves[B.saves.length - 1] || {};
  ok("OLD: сохранение — без признака sides и без sides у столов", saved.tables && !("sides" in saved) && saved.tables.every((t) => !("sides" in t)), JSON.stringify(saved).slice(0, 300));
  ok("OLD: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("BOARD")) {
  const P = clone(PLAN);
  P.tables[0].sides = [2, -2, 0, 0];
  P.tables[1].sides = [0, 0, 1, -1];
  const ROWS = [{ tid: "t1", status: "seat", cnt: 3, name: "", rtime: "", since: iso(20), waiter_id: "e-anna", waiter_name: "Анна Смирнова" }];
  for (const light of [false, true]) {
    const tag = "BOARD" + (light ? " светлая" : "");
    const B = floorServer({ plan: P, rows: ROWS });
    const o = await open({ light, rpcs: B.rpc });
    await sleep(1200); await nav(o.page, "seat", 1800);
    const a1 = await art(o.page, "t1"), a2 = await art(o.page, "t2");
    ok(tag + ": длинный — 2 стула сверху и диван на двоих; гостей 3 — закрашены два стула и одна подушка", a1.chairs === 2 && a1.cushions === 2 && a1.backs === 1 && a1.on === 3, JSON.stringify(a1));
    ok(tag + ": квадратный — стул слева и диван справа, подпись «2 м.»", a2.chairs === 1 && a2.cushions === 1 && a2.on === 0 && /2 м\./.test(a2.sub), JSON.stringify(a2));
    await o.page.locator("[data-floor]").screenshot({ path: OUT + "/board" + (light ? "-light" : "") + ".png" });
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("LOOK")) {
  for (const [light, w] of [[false, 393], [true, 393], [false, 360]]) {
    const tag = "LOOK" + (light ? " светлая" : "") + (w !== 393 ? " " + w : "");
    const P = clone(PLAN); P.tables[0].sides = [2, -2, 0, 0];
    const B = floorServer({ plan: P });
    const o = await open({ light, w, rpcs: B.rpc });
    const ed = await editor(o);
    await pick(ed, "t1");
    const f = await fits(o.page, "[data-floor-editor] *");
    ok(tag + ": карточка стола с «Стулья по сторонам» — без прокрутки вбок", f.over === 0 && f.sw <= f.W, JSON.stringify(f));
    await ed.locator("[data-chair-sides]").scrollIntoViewIfNeeded(); await sleep(150);
    await ed.locator('[data-table-edit="t1"]').screenshot({ path: OUT + "/card" + (light ? "-light" : "") + (w !== 393 ? "-" + w : "") + ".png" });
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
