// e2e v187 (Доп. 512): объединить столы, пересадить гостей, лист ожидания (сервер с этапом 56).
// Владелец: «Как ещё удобнее и красивее мы можем сделать рассадку?» и «Давай все».
// Разделы:
//   JOIN  — карточка стола с гостями: «Приставить стол» — над схемой подсказка, свободные рядом подсвечены; нажать —
//           приставлен: перемычка, на приставленном «к 1», гости по стульям обоих столов; нажать на приставленный —
//           карточка главного: «Вместе со столом 2», «Счёт» у главного — и у приставленного; отделить — на уборку;
//   PARTY — «Посадить: 7+», одного стола нет: «Можно объединить: 3+4 · 8 мест»; нажать — карточка 3 с 8 гостями и
//           «Посадим за столы 3 и 4»; «Посадить» — seat_set и seat_join, на схеме компания за двумя столами;
//   MOVE  — «Пересадить» компанию 1+2: занятый стол не принимает, свободный 3 — гости там, 1 и 2 на уборке;
//           «Перенести бронь» 6 → 7: бронь на 7, 6 свободен;
//   WAIT  — «Ждут 1» в сводке, строка листа со временем и свободными столами; «＋ Записать» Ильиных на 4 с заметкой;
//           «Посадить» — подсказка над схемой, подсвечены столы на 4, карточка стола с 4 гостями и «Из листа
//           ожидания»; «Посадить» — из листа убраны; «Ушли» — тоже;
//   OLD   — сервер без этапа 56: ни листа, ни кнопок в карточке; руководителю совет про этап 56;
//   LOOK  — тёмная и светлая тема, 360 точек без прокрутки вбок, снимки.
// Голова сценария — как в e2e-v186.mjs.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v187.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5387, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v187";
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

const clone = (x) => JSON.parse(JSON.stringify(x));
const PLAN = { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [
  { id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t2", n: "2", seats: 4, shape: "sq", x: 1, y: 0, z: "z1" },
  { id: "t3", n: "3", seats: 6, shape: "long", x: 3, y: 0, z: "z1" }, { id: "t4", n: "4", seats: 2, shape: "sq", x: 5, y: 0, z: "z1" },
  { id: "t5", n: "5", seats: 4, shape: "rd", x: 7, y: 0, z: "z1" }, { id: "t6", n: "6", seats: 2, shape: "sq", x: 0, y: 2, z: "z1" },
  { id: "t7", n: "7", seats: 2, shape: "sq", x: 2, y: 2, z: "z1" }] };
const ANNA = ["e-anna", "Анна Смирнова"], PETR = ["e-petr", "Пётр Орлов"];
const row = (tid, status, cnt, min, w = null, extra = {}) => ({ tid, status, cnt, name: "", rtime: "", since: status === "seat" || status === "bill" ? iso(min) : null,
  waiter_id: w ? w[0] : null, waiter_name: w ? w[1] : "", main: null, joined: [], ...extra });
// сервер в памяти: доска, стол, объединение, пересадка, лист ожидания — как этап 56
function seatServer({ seat2 = true, plan = clone(PLAN), rows = [], wait = [] } = {}) {
  const B = { plan, rows: clone(rows), wait: clone(wait), done: [], next: 100 };
  const get = (tid) => B.rows.find((r) => r.tid === tid);
  const put = (r) => { B.rows = B.rows.filter((x) => x.tid !== r.tid).concat([r]); return r; };
  const blank = (tid, status = "free") => ({ tid, status, cnt: 0, name: "", rtime: "", since: null, waiter_id: null, waiter_name: "", main: null, joined: [] });
  const nameOf = (id) => { const e = SEATSTAFF.find((x) => x.id === id); return e ? e.name + " " + e.surname : ""; };
  const freeT = (tid) => { const r = get(tid); return !r || (r.status === "free" && !r.main); };
  const follow = (m) => (m.joined || []).forEach((j) => put({ ...blank(j, m.status), rtime: m.rtime, since: m.since, waiter_id: m.waiter_id, waiter_name: m.waiter_name, main: m.tid }));
  const reset = (tids, st) => tids.forEach((t) => put(blank(t, st)));
  const pick = (tids) => B.rows.filter((x) => tids.includes(x.tid));
  B.rpc = (fn, b) => {
    if (fn === "seat_board") return { ok: true, floor: 2, tall: true, sides: true, ...(seat2 ? { seat2: true, fine: true, wait: B.wait } : {}), day: "2026-11-20", now: NOW.toISOString(), lead: true, plan: B.plan, staff: SEATSTAFF, tables: B.rows };
    if (!seat2 && /^(seat_join|seat_unjoin|seat_move|wait_add|wait_done)$/.test(fn)) return { code: "PGRST202" };
    if (fn === "seat_set") {
      const old = { ...(get(b.p_tid) || blank(b.p_tid)) }, touched = [b.p_tid];
      if (old.main) { const m = get(old.main); put({ ...m, joined: m.joined.filter((x) => x !== b.p_tid) }); touched.push(old.main); old.status = "free"; old.since = null; old.joined = []; }
      const st = b.p_status, busy = st === "seat" || st === "bill", kept = ["seat", "bill", "res"].includes(st) ? old.joined || [] : [];
      const r = put({ tid: b.p_tid, status: st, cnt: busy || st === "res" ? b.p_cnt : 0, name: st === "res" ? b.p_name : "", rtime: st === "res" ? b.p_rtime : "",
        since: busy ? (old.status === "seat" || old.status === "bill" ? old.since : NOW.toISOString()) : null, waiter_id: busy ? b.p_waiter : null,
        waiter_name: busy && b.p_waiter ? nameOf(b.p_waiter) : "", main: null, joined: kept });
      if ((old.joined || []).length) { touched.push(...old.joined); if (kept.length) follow(r); else reset(old.joined, st); }
      return { ok: true, table: r, tables: pick(touched) };
    }
    if (fn === "seat_join") {
      const m = get(b.p_tid);
      if (!m || !["seat", "bill", "res"].includes(m.status)) return { ok: false, error: "not_busy" };
      const busyT = b.p_with.find((t) => !freeT(t));
      if (busyT) return { ok: false, error: "busy", tid: busyT };
      const r = put({ ...m, joined: [...m.joined, ...b.p_with] }); follow(r);
      return { ok: true, tables: pick([b.p_tid, ...b.p_with]) };
    }
    if (fn === "seat_unjoin") {
      const x = get(b.p_tid);
      if (!x || (!x.main && !(x.joined || []).length)) return { ok: false, error: "not_joined" };
      const mt = x.main || x.tid, ws = x.main ? [x.tid] : x.joined, m = get(mt);
      put({ ...m, joined: x.main ? m.joined.filter((t) => t !== x.tid) : [] });
      reset(ws, x.status === "seat" || x.status === "bill" ? "clean" : "free");
      return { ok: true, tables: pick([mt, ...ws]) };
    }
    if (fn === "seat_move") {
      let a = get(b.p_from);
      if (a && a.main) a = get(a.main);
      if (!a || !["seat", "bill", "res"].includes(a.status)) return { ok: false, error: "not_busy" };
      if (!freeT(b.p_to)) return { ok: false, error: "busy", tid: b.p_to };
      const r = put({ ...a, tid: b.p_to, main: null, joined: [] }), ws = [a.tid, ...(a.joined || [])];
      reset(ws, a.status === "res" ? "free" : "clean");
      return { ok: true, table: r, tables: pick([b.p_to, ...ws]) };
    }
    if (fn === "wait_add") { const item = { id: B.next++, name: b.p_name, cnt: b.p_cnt, note: b.p_note, at: NOW.toISOString(), by: "Мария Ким" }; B.wait.push(item); return { ok: true, item }; }
    if (fn === "wait_done") {
      const i = B.wait.findIndex((w) => w.id === b.p_id);
      if (i < 0) return { ok: false, error: "not_found" };
      B.done.push({ id: b.p_id, how: b.p_how, tid: b.p_tid }); B.wait.splice(i, 1); return { ok: true };
    }
    return undefined;
  };
  return B;
}
async function board(o) { await sleep(1200); await nav(o.page, "seat", 1800); }
const T = (page, id) => page.locator(`[data-floor] [data-table="${id}"]`);
const tap = async (page, id, ms = 350) => { await T(page, id).click(); await sleep(ms); };
const st = (page, id) => T(page, id).getAttribute("data-status");
const sub = (page, id) => page.evaluate((id) => { const e = document.querySelector('[data-floor] [data-table="' + id + '"]'); return e ? (e.querySelectorAll("span > span")[1] || {}).textContent || "" : null; }, id);
const on = (page, id) => page.evaluate((id) => document.querySelectorAll('[data-floor] [data-table="' + id + '"] [data-chair="on"]').length, id);
const msg = (page) => txt(page.locator('[role="status"]').filter({ hasNotText: "Отмена" }).first());
const calls = (o, fn) => o.calls.filter((x) => x.fn === fn).map((x) => x.body);
const save = async (page) => { await page.locator("[data-sheet-save]").click(); await sleep(700); };

if (want("JOIN")) {
  const B = seatServer({ rows: [row("t1", "seat", 7, 30, ANNA)] });
  const o = await open({ rpcs: B.rpc });
  await board(o);
  await tap(o.page, "t1");
  const sheet = o.page.locator('[data-table-sheet="t1"]');
  ok("JOIN: в карточке стола с гостями — «Пересадить» и «Приставить стол»", (await sheet.locator("[data-sheet-move]").count()) === 1 && (await txt(sheet.locator("[data-sheet-join]"))) === "Приставить стол");
  await sheet.locator("[data-sheet-join]").click(); await sleep(350);
  const banner = await txt(o.page.locator("[data-pick-banner]"));
  ok("JOIN: карточка закрылась, над схемой — какой стол приставить; подсвечены свободные рядом (2 и 6)", !(await o.page.locator("[data-table-sheet]").count()) && /^Какой стол приставить к столу 1\? Свободные рядом подсвечены\. Отмена$/.test(banner)
    && (await T(o.page, "t2").getAttribute("data-hi")) === "1" && (await T(o.page, "t6").getAttribute("data-hi")) === "1" && (await T(o.page, "t3").getAttribute("data-hi")) === "0", banner);
  ok("JOIN: выбор стола — без подбора компании (вместо него подсказка)", !(await o.page.locator("[data-party]").count()));
  await tap(o.page, "t2", 700);
  const j = calls(o, "seat_join")[0] || {};
  ok("JOIN: нажать на 2 — seat_join(1, [2])", j.p_tid === "t1" && JSON.stringify(j.p_with) === '["t2"]', JSON.stringify(j));
  ok("JOIN: подсказка ушла, сообщение «Стол 2 приставили к столу 1: вместе 8 мест.»", !(await o.page.locator("[data-pick-banner]").count()) && (await msg(o.page)) === "Стол 2 приставили к столу 1: вместе 8 мест.", await msg(o.page));
  ok("JOIN: на схеме перемычка 1–2, на 2 — «к 1», статус «гости»", (await o.page.locator('[data-floor] [data-link="t1:t2"]').count()) === 1 && (await sub(o.page, "t2")) === "к 1" && (await st(o.page, "t2")) === "seat");
  ok("JOIN: 7 гостей по стульям: у 1 — 4, у 2 — 3; полоска времени только у главного", (await on(o.page, "t1")) === 4 && (await on(o.page, "t2")) === 3
    && (await o.page.locator('[data-floor] [data-table="t1"] [data-sit-bar]').count()) === 1 && !(await o.page.locator('[data-floor] [data-table="t2"] [data-sit-bar]').count()));
  ok("JOIN: диктор — «приставлен к столу 1» и у главного «вместе со столом 2»", /^Стол 2, 4 места: приставлен к столу 1, гости$/.test(await T(o.page, "t2").getAttribute("aria-label"))
    && /, вместе со столом 2$/.test(await T(o.page, "t1").getAttribute("aria-label")), await T(o.page, "t2").getAttribute("aria-label"));
  ok("JOIN: в «Официантах» — «Анна С.: стол 1+2 · 7 гостей»", /Анна С\.: стол 1\+2 · 7 гостей/.test(await txt(o.page.locator("[data-waiters]"))), await txt(o.page.locator("[data-waiters]")));
  await o.page.locator("[data-floor]").screenshot({ path: OUT + "/join-board.png" });
  await tap(o.page, "t2");
  const sh1 = o.page.locator('[data-table-sheet="t1"]');
  ok("JOIN: нажать на приставленный 2 — карточка главного 1: «Вместе со столом 2: всего 8 мест.», отделить 2", (await sh1.count()) === 1 && /Вместе со столом 2: всего 8 мест\./.test(await txt(sh1.locator("[data-sheet-note]")))
    && (await sh1.locator('[data-sheet-unjoin="t2"]').count()) === 1);
  await sh1.screenshot({ path: OUT + "/join-sheet.png" });
  await sh1.locator('[data-sheet-status="bill"]').click(); await sleep(150);
  await save(o.page);
  ok("JOIN: «Счёт» у 1 — и у 2 (по ответу сервера)", (await st(o.page, "t1")) === "bill" && (await st(o.page, "t2")) === "bill");
  await tap(o.page, "t1");
  await o.page.locator('[data-table-sheet="t1"] [data-sheet-unjoin="t2"]').click(); await sleep(600);
  ok("JOIN: отделить 2 — на уборку, перемычки нет, «Стол 2 отделили, он на уборке.»", (await st(o.page, "t2")) === "clean" && !(await o.page.locator("[data-floor] [data-link]").count())
    && (await msg(o.page)) === "Стол 2 отделили, он на уборке." && calls(o, "seat_unjoin")[0].p_tid === "t2", await msg(o.page));
  ok("JOIN: в карточке 1 больше нет «Вместе со столом»", !(await o.page.locator('[data-table-sheet="t1"] [data-sheet-group]').count()));
  await o.page.locator('[data-table-sheet="t1"] [data-sa-back]').click(); await sleep(300);
  // «Отмена» выбора
  await tap(o.page, "t1"); await o.page.locator('[data-table-sheet="t1"] [data-sheet-join]').click(); await sleep(300);
  await o.page.locator("[data-pick-cancel]").click(); await sleep(250);
  ok("JOIN: «Отмена» — подсказки нет, подбор компании снова на месте", !(await o.page.locator("[data-pick-banner]").count()) && (await o.page.locator("[data-party]").count()) === 4);
  ok("JOIN: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("PARTY")) {
  const B = seatServer({ rows: [row("t1", "seat", 3, 20, ANNA)] });
  const o = await open({ rpcs: B.rpc });
  await board(o);
  await o.page.locator('[data-party="8"]').click(); await sleep(250);
  const chips = await o.page.locator("[data-join-suggest] [data-join-sug]").allInnerTexts();
  ok("PARTY: 7+ — одного стола нет; «Можно объединить: 3+4 · 8 мест», 3+2 · 10 мест, 3+2+4 · 12 мест", chips.join(" | ") === "3+4 · 8 мест | 3+2 · 10 мест | 3+2+4 · 12 мест", chips.join(" | "));
  await o.page.locator('[data-join-sug="t3"]').first().click(); await sleep(400);
  const sh = o.page.locator('[data-table-sheet="t3"]');
  ok("PARTY: карточка 3 — «Посадим за столы 3 и 4: всего 8 мест. Столы приставим.», гостей 8", (await sh.count()) === 1 && (await txt(sh.locator("[data-sheet-note]"))) === "Посадим за столы 3 и 4: всего 8 мест. Столы приставим."
    && (await txt(sh.locator("[data-cnt]"))) === "8", await txt(sh.locator("[data-sheet-note]")));
  await sh.locator('[data-waiter="e-petr"]').click(); await sleep(100);
  await save(o.page); await sleep(300);
  const s1 = calls(o, "seat_set").pop() || {}, j1 = calls(o, "seat_join").pop() || {};
  ok("PARTY: «Посадить» — seat_set(3, гости, 8, Пётр), потом seat_join(3, [4])", s1.p_tid === "t3" && s1.p_cnt === 8 && s1.p_waiter === "e-petr" && j1.p_tid === "t3" && JSON.stringify(j1.p_with) === '["t4"]',
    JSON.stringify([s1, j1]));
  ok("PARTY: на схеме 3 и 4 вместе, сообщение — посадили и приставили", (await o.page.locator('[data-floor] [data-link="t3:t4"]').count()) === 1 && (await sub(o.page, "t4")) === "к 3"
    && (await msg(o.page)) === "Стол 3: посадили. Стол 4 приставили к столу 3: вместе 8 мест.", await msg(o.page));
  // закрыли карточку без «Посадить» — объединение не делается
  await o.page.locator('[data-party="8"]').click(); await sleep(250);
  const left = await o.page.locator("[data-join-suggest] [data-join-sug]").count();
  ok("PARTY: свободных пар на 8 больше нет (2 и 6, 7 малы) — подсказки объединить нет", left === 0, String(left));
  ok("PARTY: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("MOVE")) {
  const B = seatServer({ rows: [row("t1", "seat", 3, 25, ANNA, { joined: ["t2"] }), row("t2", "seat", 0, 25, ANNA, { main: "t1" }), row("t5", "seat", 2, 5, PETR),
    { ...row("t6", "res", 2, 0), rtime: "19:30", name: "Ким" }] });
  const o = await open({ rpcs: B.rpc });
  await board(o);
  await tap(o.page, "t1");
  await o.page.locator('[data-table-sheet="t1"] [data-sheet-move]').click(); await sleep(300);
  const banner = await txt(o.page.locator("[data-pick-banner]"));
  ok("MOVE: «Пересадить» — над схемой «Куда пересадить гостей со стола 1+2?»; свободные подсвечены, свои — нет", /^Куда пересадить гостей со стола 1\+2\? Нажми на свободный стол\. Отмена$/.test(banner)
    && (await T(o.page, "t3").getAttribute("data-hi")) === "1" && (await T(o.page, "t2").getAttribute("data-hi")) === "0" && (await T(o.page, "t5").getAttribute("data-hi")) === "0", banner);
  await tap(o.page, "t5");
  ok("MOVE: нажать на занятый 5 — «Стол 5 занят. Выбери свободный.», выбор продолжается", (await msg(o.page)) === "Стол 5 занят. Выбери свободный." && (await o.page.locator("[data-pick-banner]").count()) === 1 && !calls(o, "seat_move").length);
  await tap(o.page, "t3", 700);
  const mv = calls(o, "seat_move")[0] || {};
  ok("MOVE: нажать на 3 — seat_move(1 → 3)", mv.p_from === "t1" && mv.p_to === "t3", JSON.stringify(mv));
  ok("MOVE: за 3 — гости (3), 1 и 2 на уборке, перемычки нет", (await st(o.page, "t3")) === "seat" && (await on(o.page, "t3")) === 3 && (await st(o.page, "t1")) === "clean" && (await st(o.page, "t2")) === "clean"
    && !(await o.page.locator("[data-floor] [data-link]").count()));
  ok("MOVE: сообщение «Гостей со столов 1, 2 пересадили за стол 3. Столы 1, 2 на уборке.»", (await msg(o.page)) === "Гостей со столов 1, 2 пересадили за стол 3. Столы 1, 2 на уборке.", await msg(o.page));
  await tap(o.page, "t6");
  const sh6 = o.page.locator('[data-table-sheet="t6"]');
  ok("MOVE: у брони — «Перенести бронь» и что переедет", (await txt(sh6.locator("[data-sheet-move]"))) === "Перенести бронь" && /Бронь переедет за другой стол вместе со временем и именем\./.test(await txt(sh6.locator("[data-sheet-more]"))));
  await sh6.locator("[data-sheet-move]").click(); await sleep(300);
  await tap(o.page, "t7", 700);
  ok("MOVE: бронь на 7 (19:30), 6 свободен; «Бронь со стола 6 перенесли на стол 7.»", (await st(o.page, "t7")) === "res" && (await sub(o.page, "t7")) === "19:30" && (await st(o.page, "t6")) === "free"
    && (await msg(o.page)) === "Бронь со стола 6 перенесли на стол 7.", await msg(o.page));
  ok("MOVE: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("WAIT")) {
  const B = seatServer({ rows: [row("t1", "seat", 3, 20, ANNA)], wait: [{ id: 7, name: "Петровы", cnt: 2, note: "у бара", at: iso(15), by: "Анна Смирнова" }] });
  const o = await open({ rpcs: B.rpc });
  await board(o);
  ok("WAIT: в сводке «Ждут 1»", (await txt(o.page.locator("[data-wait-sum]"))) === "Ждут 1");
  const it7 = o.page.locator('[data-wait-item="7"]');
  ok("WAIT: строка листа — кто, сколько, сколько ждут, заметка, какие столы свободны", /^Петровы · 2 гостя · ждут 15 мин у бара Свободны столы 4, 6, 7 Посадить Ушли$/.test(await txt(it7)), await txt(it7));
  await o.page.locator("[data-wait-add]").click(); await sleep(250);
  const form = o.page.locator("[data-wait-form]");
  await form.locator("[data-wait-name]").fill("Ильины");
  await form.locator("[data-wait-plus]").click(); await form.locator("[data-wait-plus]").click();
  await form.locator("[data-wait-note]").fill("с коляской");
  await form.locator("[data-wait-save]").click(); await sleep(600);
  const add = calls(o, "wait_add")[0] || {};
  ok("WAIT: «Записать» — wait_add(Ильины, 4, «с коляской»); формы нет, в сводке «Ждут 2»", add.p_name === "Ильины" && add.p_cnt === 4 && add.p_note === "с коляской" && !(await o.page.locator("[data-wait-form]").count())
    && (await txt(o.page.locator("[data-wait-sum]"))) === "Ждут 2", JSON.stringify(add));
  ok("WAIT: сообщение «Записали в лист ожидания: Ильины, 4 гостя.»", (await msg(o.page)) === "Записали в лист ожидания: Ильины, 4 гостя.", await msg(o.page));
  await o.page.locator("[data-wait]").screenshot({ path: OUT + "/wait.png" });
  await o.page.locator('[data-wait-seat="100"]').click(); await sleep(300);
  const banner = await txt(o.page.locator("[data-pick-banner]"));
  ok("WAIT: «Посадить» — над схемой «Куда посадить: Ильины, 4 гостя?», подсвечены 2 и 5", /^Куда посадить: Ильины, 4 гостя\? Подходящие столы подсвечены\. Отмена$/.test(banner)
    && (await T(o.page, "t2").getAttribute("data-hi")) === "1" && (await T(o.page, "t5").getAttribute("data-hi")) === "1" && (await T(o.page, "t4").getAttribute("data-hi")) === "0", banner);
  await tap(o.page, "t2");
  const sh = o.page.locator('[data-table-sheet="t2"]');
  ok("WAIT: карточка стола 2 — «Из листа ожидания: Ильины, 4 гостя.», гостей 4", (await txt(sh.locator("[data-sheet-note]"))) === "Из листа ожидания: Ильины, 4 гостя." && (await txt(sh.locator("[data-cnt]"))) === "4");
  await save(o.page); await sleep(300);
  const d = B.done[0] || {};
  ok("WAIT: «Посадить» — за 2 гости (4), в листе отмечено «посадили» за 2; «Ждут 1»", (await st(o.page, "t2")) === "seat" && d.id === 100 && d.how === "seat" && d.tid === "t2"
    && (await txt(o.page.locator("[data-wait-sum]"))) === "Ждут 1" && !(await o.page.locator('[data-wait-item="100"]').count()), JSON.stringify(d));
  await o.page.locator('[data-wait-left="7"]').click(); await sleep(500);
  ok("WAIT: «Ушли» — из листа убраны, отмечено left; сводка без «Ждут»; совет вместо пустого списка", (B.done[1] || {}).how === "left" && !(await o.page.locator("[data-wait-item]").count()) && !(await o.page.locator("[data-wait-sum]").count())
    && /Нет свободного стола\? Запиши гостей/.test(await txt(o.page.locator("[data-wait]"))));
  ok("WAIT: сообщение «Убрали из листа: Петровы, ушли.»", (await msg(o.page)) === "Убрали из листа: Петровы, ушли.", await msg(o.page));
  ok("WAIT: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("OLD")) {
  const B = seatServer({ seat2: false, rows: [row("t1", "seat", 3, 20, ANNA)] });
  const o = await open({ rpcs: B.rpc });
  await board(o);
  ok("OLD: сервер без этапа 56 — листа ожидания нет, руководителю совет про этап 56", !(await o.page.locator("[data-wait]").count())
    && /этап 56 \(supabase-stage56-join-move-wait\.sql\)/.test(await txt(o.page.locator("[data-seat2-hint]"))));
  await tap(o.page, "t1");
  ok("OLD: в карточке стола с гостями нет «Пересадить» и «Приставить стол»", (await o.page.locator('[data-table-sheet="t1"]').count()) === 1 && !(await o.page.locator("[data-sheet-more]").count()));
  await o.page.locator('[data-table-sheet="t1"] [data-sa-back]').click(); await sleep(250);
  await o.page.locator('[data-party="8"]').click(); await sleep(250);
  ok("OLD: «7+» — подсказки объединить нет", !(await o.page.locator("[data-join-suggest]").count()));
  ok("OLD: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("LOOK")) {
  const ROWS = [row("t1", "seat", 7, 70, ANNA, { joined: ["t2"] }), row("t2", "seat", 0, 70, ANNA, { main: "t1" }), { ...row("t3", "res", 8, 0, null, { joined: ["t4"] }), rtime: "20:00", name: "Ильины" },
    { ...row("t4", "res", 0, 0, null, { main: "t3" }), rtime: "20:00" }, row("t5", "bill", 3, 95, PETR)];
  const WAIT = [{ id: 7, name: "Петровы", cnt: 2, note: "у бара", at: iso(15), by: "Анна Смирнова" }, { id: 8, name: "", cnt: 6, note: "", at: iso(4), by: "Анна Смирнова" }];
  for (const [light, w] of [[false, 393], [true, 393], [false, 360]]) {
    const tag = "LOOK" + (light ? " светлая" : "") + (w !== 393 ? " " + w : "");
    const B = seatServer({ rows: ROWS, wait: WAIT });
    const o = await open({ light, w, rpcs: B.rpc });
    await board(o);
    const f = await fits(o.page, "[data-floor] *, [data-wait] *, [data-waiters] *, [data-res-list] *");
    ok(tag + ": доска, лист ожидания и брони без прокрутки вбок", f.over === 0 && f.sw <= f.W, JSON.stringify(f));
    ok(tag + ": в сводке бронь за двумя столами — одна: «Брони 1», «Ждут 2»", /Брони 1 · Ждут 2$/.test(await txt(o.page.locator("[data-seat-summary]"))), await txt(o.page.locator("[data-seat-summary]")));
    ok(tag + ": в бронях — «стол 3+4», приставленный отдельно не значится", /Ильины · 8 гостей стол 3\+4/.test(await txt(o.page.locator("[data-res-list]"))) && (await o.page.locator("[data-res-list] > div[role=button]").count()) === 1,
      await txt(o.page.locator("[data-res-list]")));
    const sfx = (light ? "-light" : "") + (w !== 393 ? "-" + w : "");
    await o.page.locator("[data-floor]").screenshot({ path: OUT + "/board" + sfx + ".png" });
    await o.page.locator("[data-wait]").scrollIntoViewIfNeeded(); await sleep(150);
    await o.page.screenshot({ path: OUT + "/look" + sfx + ".png" });
    await tap(o.page, "t1");
    const f2 = await fits(o.page, '[data-table-sheet="t1"] *');
    ok(tag + ": карточка с «Пересадить», «Приставить стол» и «Вместе со столом» — без прокрутки вбок", f2.over === 0 && (await o.page.locator('[data-table-sheet="t1"] [data-sheet-more]').count()) === 1, JSON.stringify(f2));
    await o.page.locator('[data-table-sheet="t1"] [data-sheet-more]').scrollIntoViewIfNeeded(); await sleep(150);
    await o.page.screenshot({ path: OUT + "/sheet" + sfx + ".png" });
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
