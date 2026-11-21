// e2e v188 (Доп. 513): сетка мельче (сдвиг стола в четверть клетки) и стены с фото (сервер с этапом 56, floor-scan 6).
// Владелец: «Как ещё удобнее и красивее мы можем сделать рассадку?» и «Давай все». Третья сборка из трёх.
// Разделы:
//   FINE    — редактор, сервер с этапом 56 (fine: true): у стола «Точнее» — стрелки на четверть клетки; дальше половины —
//             в соседнюю клетку; упёрся в соседа — понятная ошибка; «Ровно»; «Шаг назад» снимает все сдвиги разом;
//             «Сохранить схему» — fine: true и ox, oy у стола;
//   DRAG    — перетащить пальцем на полторы клетки вправо и на четверть вниз — стол там же, где отпустили;
//   SETTLE  — стол со сдвигом вправо, в соседнюю клетку ставят новый — сдвиг уходит, внахлёст нет;
//   BOARD   — доска смены рисует столы со сдвигом;
//   SCAN    — распознавание: функция версии 6 отвечает стенами — на схеме стены по линиям сетки, в итоге «и стены»;
//             столы точнее клетки (сдвиги в четвертях, внахлёст нет);
//   OLD     — сервер без этапа 56: «Точнее» нет, перетаскивание по клеткам, сохранение без fine;
//   LOOK    — карточка стола с «Точнее» в тёмной и светлой теме, 360 точек без прокрутки вбок, снимки.
// Голова сценария — как в e2e-v185.mjs.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v188.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5388, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v188";
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

// сервер в памяти: seat_board (fine — этап 56), floor_save, floor-scan (первый проход со стенами и второй — места)
function fineServer({ fine = true, plan = null, rows = [], scan = null } = {}) {
  const B = { plan, rows, saves: [], scans: [] };
  B.rpc = (fn, body) => {
    if (fn === "seat_board") return { ok: true, floor: 2, tall: true, sides: true, ...(fine ? { seat2: true, fine: true, wait: [] } : {}), day: "2026-11-20", now: NOW.toISOString(), lead: true, plan: B.plan, staff: SEATSTAFF, tables: B.rows };
    if (fn === "floor_save") { B.saves.push(body.p_plan); B.plan = body.p_plan; return { ok: true, v: 2, tables: (body.p_plan.tables || []).length }; }
    if (fn === "floor-scan") { B.scans.push(body); return body.mode === "seats" ? { ok: true, v: 6, mode: "seats", seats: (body.crops || []).map(() => null), sides: (body.crops || []).map(() => null), model: "anthropic/claude-haiku-5.5" } : scan; }
    return undefined;
  };
  return B;
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const PLAN = { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [
  { id: "t1", n: "1", seats: 4, shape: "sq", x: 2, y: 1, z: "z1" }, { id: "t2", n: "2", seats: 4, shape: "sq", x: 4, y: 1, z: "z1" }] };
async function editor(o) { await sleep(1200); await nav(o.page, "seat", 1800); await o.page.locator("[data-floor-edit]").first().click(); await sleep(400); return o.page.locator("[data-floor-editor]"); }
// где стол на схеме — в клетках (по кнопке: отступ pad = 3% клетки)
const pos = (page, id) => page.evaluate((id) => {
  const fl = document.querySelector("[data-floor-editor] [data-floor]") || document.querySelector("[data-floor]"), cell = fl.clientWidth / 8, e = fl.querySelector('[data-table="' + id + '"]');
  if (!e) return null;
  const pad = Math.max(1, cell * 0.03);
  return { x: Math.round(((parseFloat(e.style.left) - pad) / cell) * 100) / 100, y: Math.round(((parseFloat(e.style.top) - pad) / cell) * 100) / 100, cell };
}, id);
const pick = async (ed, id) => { await ed.locator(`[data-floor] [data-table="${id}"]`).click(); await sleep(150); };
const nud = async (ed, k) => { await ed.locator(`[data-fine-btn="${k}"]`).click(); await sleep(120); };
const viewOf = (t) => { const w = t.shape === "long" ? 2 : 1, h = t.shape === "tall" ? 2 : 1, ox = t.ox || 0, oy = t.oy || 0; return [t.x + ox, t.y + oy, t.x + ox + w, t.y + oy + h]; };
const overlaps = (ts) => { const out = []; for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) { const a = viewOf(ts[i]), b = viewOf(ts[j]); if ((ts[i].z || "z1") === (ts[j].z || "z1") && Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 0.01 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0.01) out.push(ts[i].n + "/" + ts[j].n); } return out; };

if (want("FINE")) {
  const B = fineServer({ plan: clone(PLAN) });
  const o = await open({ rpcs: B.rpc });
  const ed = await editor(o);
  await pick(ed, "t1");
  ok("FINE: у стола — «Точнее»: четыре стрелки, «Ровно» нет (стол ровно в клетке)", (await ed.locator("[data-fine] [data-fine-btn]").count()) === 4 && !(await ed.locator("[data-fine-reset]").count()));
  ok("FINE: подсказка — на четверть клетки, пальцем тоже", /На четверть клетки за нажатие\. Пальцем по схеме стол тоже встаёт точнее клетки\./.test(await txt(ed.locator("[data-fine]"))));
  await nud(ed, "right");
  let p = await pos(o.page, "t1");
  ok("FINE: «→» — стол на четверть клетки правее (2.25), «Ровно» появилось", p.x === 2.25 && p.y === 1 && (await ed.locator("[data-fine-reset]").count()) === 1, JSON.stringify(p));
  await nud(ed, "right"); await nud(ed, "right");
  p = await pos(o.page, "t1");
  ok("FINE: ещё два раза — 2.75 (клетка 3, сдвиг влево на четверть)", p.x === 2.75, JSON.stringify(p));
  await nud(ed, "right"); await nud(ed, "down");
  p = await pos(o.page, "t1");
  ok("FINE: ровно в клетке 3 и на четверть ниже", p.x === 3 && p.y === 1.25, JSON.stringify(p));
  await nud(ed, "right");
  p = await pos(o.page, "t1");
  ok("FINE: дальше вправо мешает стол 2 — стол на месте, понятная ошибка", p.x === 3 && /Дальше не сдвинуть: мешает стол, бар, вход или край схемы\./.test(await txt(ed.locator('[role="alert"]'))), JSON.stringify(p));
  await ed.locator("[data-fine-reset]").click(); await sleep(150);
  p = await pos(o.page, "t1");
  ok("FINE: «Ровно» — ровно в клетке 3, «Ровно» пропало", p.x === 3 && p.y === 1 && !(await ed.locator("[data-fine-reset]").count()), JSON.stringify(p));
  await ed.locator("[data-undo]").click(); await sleep(150);
  p = await pos(o.page, "t1");
  ok("FINE: «Шаг назад» — снова 3 и на четверть ниже", p.x === 3 && p.y === 1.25, JSON.stringify(p));
  await ed.locator("[data-undo]").click(); await sleep(150);
  p = await pos(o.page, "t1");
  ok("FINE: ещё «Шаг назад» — все сдвиги стрелками разом, стол как был (2, 1)", p.x === 2 && p.y === 1, JSON.stringify(p));
  await nud(ed, "left"); await nud(ed, "up");
  await ed.locator("[data-floor-save]").click(); await sleep(700);
  const sv = B.saves[B.saves.length - 1] || {}, t1 = (sv.tables || []).find((t) => t.id === "t1") || {};
  ok("FINE: «Сохранить схему» — fine: true, у стола 1 ox −0.25, oy −0.25, у стола 2 сдвига нет", sv.fine === true && t1.x === 2 && t1.ox === -0.25 && t1.oy === -0.25 && !("ox" in ((sv.tables || [])[1] || {})), JSON.stringify(sv.tables));
  ok("FINE: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("DRAG")) {
  const B = fineServer({ plan: clone(PLAN) });
  const o = await open({ rpcs: B.rpc });
  const ed = await editor(o);
  const el = ed.locator('[data-floor] [data-table="t2"]'), bx = await el.boundingBox(), cell = (await pos(o.page, "t2")).cell;
  const sx = bx.x + bx.width / 2, sy = bx.y + bx.height / 2;
  await o.page.mouse.move(sx, sy); await o.page.mouse.down();
  for (let i = 1; i <= 10; i++) { await o.page.mouse.move(sx + (1.5 * cell * i) / 10, sy + (0.25 * cell * i) / 10); await sleep(25); }
  const ghost = await ed.locator("[data-drag-ghost]").getAttribute("data-drag-ghost").catch(() => null);
  await o.page.mouse.up(); await sleep(400);
  const p = await pos(o.page, "t2");
  ok("DRAG: тень при перетаскивании — «можно»", ghost === "ok", String(ghost));
  ok("DRAG: на полторы клетки вправо и четверть вниз — стол там, где отпустили (5.5, 1.25)", p.x === 5.5 && p.y === 1.25, JSON.stringify(p));
  await ed.locator("[data-floor-save]").click(); await sleep(700);
  const t2 = ((B.saves[B.saves.length - 1] || {}).tables || []).find((t) => t.id === "t2") || {};
  ok("DRAG: в схеме — клетка 6, ox −0.5, oy 0.25", t2.x === 6 && t2.y === 1 && t2.ox === -0.5 && t2.oy === 0.25, JSON.stringify(t2));
  ok("DRAG: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("SETTLE")) {
  const P = clone(PLAN); P.tables[0] = { ...P.tables[0], x: 0, y: 0, ox: 0.5 }; P.tables[1] = { ...P.tables[1], x: 5, y: 3 };
  const B = fineServer({ plan: P });
  const o = await open({ rpcs: B.rpc });
  const ed = await editor(o);
  ok("SETTLE: стол 1 сдвинут на полклетки вправо (0.5)", (await pos(o.page, "t1")).x === 0.5);
  await ed.locator('[data-floor] [data-cell="1:0"]').click(); await sleep(250);
  const p1 = await pos(o.page, "t1"), n = await ed.locator("[data-floor] [data-table]").count();
  ok("SETTLE: в соседнюю клетку поставили новый стол — сдвиг у 1 ушёл, внахлёст нет", n === 3 && p1.x === 0, JSON.stringify(p1));
  ok("SETTLE: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("BOARD")) {
  const P = clone(PLAN); P.tables[0] = { ...P.tables[0], ox: 0.5, oy: 0.25 };
  const B = fineServer({ plan: P, rows: [{ tid: "t1", status: "seat", cnt: 2, name: "", rtime: "", since: iso(10), waiter_id: null, waiter_name: "", main: null, joined: [] }] });
  const o = await open({ rpcs: B.rpc });
  await sleep(1200); await nav(o.page, "seat", 1800);
  const p = await pos(o.page, "t1");
  ok("BOARD: доска смены рисует стол со сдвигом (2.5, 1.25)", p && p.x === 2.5 && p.y === 1.25, JSON.stringify(p));
  await o.page.locator("[data-floor]").screenshot({ path: OUT + "/board.png" });
  ok("BOARD: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("SCAN")) {
  const WALL_DRAW = PLAN_DRAW + `
  g.lineWidth = 6; g.strokeStyle = "#000"; g.beginPath(); g.moveTo(...P(50, 62)); g.lineTo(...P(50, 95)); g.stroke();
  g.beginPath(); g.moveTo(...P(3, 35)); g.lineTo(...P(30, 35)); g.stroke();`;
  const scan = { ...SCAN_OK, v: 6, walls: [[50, 62, 50, 95], [3, 35, 30, 35.5], [60, 10, 60.2, 10.1]] };
  const B = fineServer({ plan: { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [] }, scan });
  const o = await open({ rpcs: B.rpc });
  const png = await drawPng(o.page, 800, 600, WALL_DRAW);
  await sleep(1200); await nav(o.page, "seat", 1800);
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(400);
  const ed = o.page.locator("[data-floor-editor]");
  await ed.locator("[data-floor-file]").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: png }); await sleep(900);
  await ed.locator("[data-scan]").click(); await sleep(2600);
  const note = await txt(ed.locator("[data-editor-note]"));
  ok("SCAN: итог — «бар, вход и стены»", /^Расставил 9 столов по фото, бар, вход и стены\./.test(note), note);
  const walls = await ed.locator('[data-floor] [data-walls] [data-kind="wall"]').count();
  ok("SCAN: на схеме две стены (точка — не стена)", walls === 2, String(walls));
  await shot(o.page, "scan");
  await ed.locator("[data-floor-save]").click(); await sleep(700);
  const sv = B.saves[B.saves.length - 1] || {}, ws = (sv.items || []).filter((i) => i.kind === "wall"), ts = sv.tables || [];
  ok("SCAN: стены по линиям сетки — по горизонтали или вертикали, целыми узлами", ws.length === 2 && ws.every((w) => [w.x, w.y, w.x2, w.y2].every(Number.isInteger) && (w.x === w.x2) !== (w.y === w.y2)), JSON.stringify(ws));
  const offs = ts.filter((t) => t.ox || t.oy);
  ok("SCAN: столы точнее клетки — у части сдвиг, все сдвиги в четвертях до половины клетки", offs.length >= 2 && ts.every((t) => [t.ox || 0, t.oy || 0].every((v) => Math.abs(v) <= 0.5 && Number.isInteger(v * 4))), JSON.stringify(ts.map((t) => [t.n, t.x, t.y, t.ox || 0, t.oy || 0])));
  ok("SCAN: внахлёст ни одного стола", !overlaps(ts).length, overlaps(ts).join(", "));
  ok("SCAN: сохранено с fine: true", sv.fine === true);
  ok("SCAN: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("OLD")) {
  const B = fineServer({ fine: false, plan: clone(PLAN) });
  const o = await open({ rpcs: B.rpc });
  const ed = await editor(o);
  await pick(ed, "t1");
  ok("OLD: сервер без этапа 56 — «Точнее» нет", !(await ed.locator("[data-fine]").count()) && (await ed.locator('[data-table-edit="t1"]').count()) === 1);
  const el = ed.locator('[data-floor] [data-table="t2"]'), bx = await el.boundingBox(), cell = (await pos(o.page, "t2")).cell;
  const sx = bx.x + bx.width / 2, sy = bx.y + bx.height / 2;
  await o.page.mouse.move(sx, sy); await o.page.mouse.down();
  for (let i = 1; i <= 10; i++) { await o.page.mouse.move(sx + (1.6 * cell * i) / 10, sy); await sleep(25); }
  await o.page.mouse.up(); await sleep(400);
  const p = await pos(o.page, "t2");
  ok("OLD: перетаскивание — по целым клеткам (6, 1)", p.x === 6 && p.y === 1, JSON.stringify(p));
  await ed.locator("[data-floor-save]").click(); await sleep(700);
  const sv = B.saves[B.saves.length - 1] || {};
  ok("OLD: сохранение без признака fine и без сдвигов", !("fine" in sv) && (sv.tables || []).every((t) => !("ox" in t) && !("oy" in t)), JSON.stringify(sv).slice(0, 300));
  ok("OLD: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("LOOK")) {
  for (const [light, w] of [[false, 393], [true, 393], [false, 360]]) {
    const tag = "LOOK" + (light ? " светлая" : "") + (w !== 393 ? " " + w : "");
    const P = clone(PLAN); P.tables[0] = { ...P.tables[0], ox: 0.25 };
    const B = fineServer({ plan: P });
    const o = await open({ light, w, rpcs: B.rpc });
    const ed = await editor(o);
    await pick(ed, "t1");
    const f = await fits(o.page, "[data-floor-editor] *");
    ok(tag + ": карточка стола с «Точнее» — без прокрутки вбок", f.over === 0 && f.sw <= f.W, JSON.stringify(f));
    await ed.locator("[data-fine]").scrollIntoViewIfNeeded(); await sleep(150);
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
