// e2e v85 (Доп. 398): рассадка для хостес.
// Разделы:
//   DRAW    — руководитель без схемы: «Нарисовать схему» → пустая клетка — новый стол (сразу выбран), номер, места
//             (−/+), форма (длинный — если справа есть место), «Передвинуть» → клетка; повтор номера не сохраняется;
//             «Сохранить схему» → floor_save; сотрудник без схемы — «Руководитель ещё не нарисовал»;
//   BOARD   — хостес: сводка, статусы столов, «4·25м» у стола с гостями, брони списком, «Официанты»: у кого какие
//             столы и кто в графике без столов; «Посадить: 3–4» — подходящие свободные столы; в карточке стола сразу
//             выбрано обычное следующее (свободный и бронь — гости, гости — уборка, уборка — свободен); гостей — по
//             компании; официанты: кто в графике, остальные — «Ещё»; seat_set; «Бронь» без времени — подсказка;
//             доска обновляется сама (другая хостес посадила гостей) раз в 15 секунд; крестик закрывает карточку;
//   LEAD    — «Очистить доску» двумя нажатиями → seat_clear (без второго за 4 секунды — отбой); «Схема зала ›»;
//   BRIEF   — брифинг смены: блок «Брони сегодня» и строка в тексте для Telegram;
//   MISSING — нет этапа 35: экран говорит об этом, пункт «Рассадка» в «Смене» пропадает;
//   LINK    — ?go=seat из сообщения бота открывает рассадку;
//   PREFS   — строка «Рассадка» → notify_set seat;
//   NARROW  — 320 px: доска и карточка стола без прокрутки вбок.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v85.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5285, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v85";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));

const R0 = "Два моря, Океан";
const LEAD = { id: "u-lead", name: "Мария", surname: "Ким", restaurant: R0, position: "senior", is_admin: false };
const HOST = { id: "u-host", name: "Ольга", surname: "Ли", restaurant: R0, position: "hostess", is_admin: false };
const ukOf = (p) => "_" + p.name + "_" + p.surname;
const NOW = new Date("2026-10-23T07:20:00Z");   // 23.10, 19:20 по Камчатке
const iso = (minAgo) => new Date(NOW.getTime() - minAgo * 60000).toISOString();
const PLAN = { v: 1, tables: [
  { id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }, { id: "t2", n: "2", seats: 4, shape: "rd", x: 2, y: 0 },
  { id: "t3", n: "3", seats: 2, shape: "sq", x: 4, y: 0 }, { id: "t4", n: "4", seats: 2, shape: "sq", x: 0, y: 2 },
  { id: "t5", n: "5", seats: 6, shape: "long", x: 2, y: 2 },
] };
const STAFF = [{ id: "e-anna", name: "Анна", surname: "Смирнова", position: "waiter" }, { id: "e-petr", name: "Пётр", surname: "Орлов", position: "waiter" }, { id: "e-ilya", name: "Илья", surname: "Белов", position: "bartender" }];
const ROWS = () => [
  { tid: "t2", status: "seat", cnt: 4, name: "", rtime: "", since: iso(25), waiter_id: "e-petr", waiter_name: "Пётр Орлов", updated_name: "Ольга Ли", updated_at: iso(25) },
  { tid: "t3", status: "res", cnt: 4, name: "Иванов", rtime: "19:30", since: null, waiter_id: null, waiter_name: "", updated_name: "Ольга Ли", updated_at: iso(60) },
  { tid: "t4", status: "clean", cnt: 0, name: "", rtime: "", since: null, waiter_id: null, waiter_name: "", updated_name: "Пётр Орлов", updated_at: iso(3) },
];
const SCHED = { ok: true, venues: [{ venue_key: "main", config: { staff: [{ id: 1, name: "Анна Смирнова", pos: "waiter" }, { id: 2, name: "Ольга Ли", pos: "host" }],
  shifts: [{ k: "В", name: "Вечер", from: 16, to: 24 }] } }], months: [{ venue_key: "main", month: "2026-10", payload: { plan: { 1: { 23: "В" }, 2: { 23: "В" } } } }] };
const ABORT = Symbol("abort");
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function open({ who = HOST, rpcs = () => undefined, calls = [], light = false, w = 393, h = 852, path = "/" } = {}) {
  const UK = ukOf(who);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      calls.push({ fn: m[1], body, t: Date.now() });
      const own = rpcs(m[1], body);
      if (own === ABORT) return route.abort();
      if (own !== undefined) return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own) });
      const mock = { whoami: { ok: true, employee: who }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] }, schedule_load: SCHED, menu_get: [],
        qday_inbox: { ok: true, items: [] }, brief_today: { ok: true, brief: null }, case_list: { ok: true, lead: false, team: 0, fresh: 0, inbox: 0, mine_new: 0, top: null } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }) };
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
  await page.goto("http://localhost:" + PORT + path, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors, calls, UK };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const nav = async (page, s) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(1500); };
// доска в памяти: seat_board / seat_set / seat_clear / floor_save
function board({ plan = PLAN, rows = ROWS(), lead = false } = {}) {
  const B = { plan, rows, lead, sets: [], saves: [], clears: 0, boards: 0 };
  B.rpc = (fn, body) => {
    if (fn === "seat_board") { B.boards++; if (B.onBoard) B.onBoard(B); return { ok: true, day: "2026-10-23", now: NOW.toISOString(), lead: B.lead, plan: B.plan, staff: STAFF, tables: B.rows }; }
    if (fn === "seat_set") {
      B.sets.push(body);
      const w = STAFF.find((e) => e.id === body.p_waiter);
      const row = { tid: body.p_tid, status: body.p_status, cnt: body.p_status === "seat" || body.p_status === "res" ? body.p_cnt : 0, name: body.p_status === "res" ? body.p_name : "", rtime: body.p_status === "res" ? body.p_rtime : "",
        since: body.p_status === "seat" ? NOW.toISOString() : null, waiter_id: body.p_status === "seat" && w ? w.id : null, waiter_name: body.p_status === "seat" && w ? w.name + " " + w.surname : "", updated_name: "Ольга Ли", updated_at: NOW.toISOString() };
      B.rows = [...B.rows.filter((r) => r.tid !== body.p_tid), row];
      return { ok: true, table: row };
    }
    if (fn === "seat_clear") { B.clears++; B.rows = []; return { ok: true, cleared: 3 }; }
    if (fn === "floor_save") { B.saves.push(body); B.plan = body.p_plan; return { ok: true, tables: body.p_plan.tables.length }; }
    return undefined;
  };
  return B;
}

if (want("DRAW")) {
  const B = board({ plan: null, rows: [], lead: true });
  const o = await open({ who: LEAD, rpcs: B.rpc });
  await sleep(1200); await nav(o.page, "seat");
  ok("DRAW: схемы нет — руководителю «Нарисовать схему»", /Схемы зала ещё нет\. Нарисуй её/.test(await txt(o.page.locator("[data-floor-empty]"))));
  await o.page.locator("[data-floor-edit]").first().click(); await sleep(500);
  ok("DRAW: редактор — сетка 8 клеток в ширину", (await o.page.locator('[data-floor-editor] [data-cell^="7:"]').count()) > 0 && !(await o.page.locator('[data-floor-editor] [data-cell^="8:"]').count()));
  for (const c of ["0:0", "2:0", "4:1"]) { await o.page.locator('[data-floor-editor] [data-cell="' + c + '"]').click(); await sleep(150); }
  const ids = await o.page.locator("[data-floor-editor] [data-table]").evaluateAll((els) => els.map((e) => e.getAttribute("data-table")));
  ok("DRAW: пустая клетка — новый стол, номера 1, 2, 3; последний сразу выбран", ids.length === 3 && /^1 /.test(await txt(o.page.locator('[data-table="' + ids[0] + '"]'))) && /^3 /.test(await txt(o.page.locator('[data-table="' + ids[2] + '"]')))
    && (await o.page.locator("[data-table-edit]").getAttribute("data-table-edit")) === ids[2], ids.join(","));
  // третий: длинный, 6 мест, номер 6
  await o.page.locator('[data-edit-shape="long"]').click(); await o.page.locator("[data-seats-plus]").click(); await o.page.locator("[data-seats-plus]").click();
  await o.page.locator("[data-edit-n]").fill("6"); await sleep(100);
  ok("DRAW: места −/+ — 6", (await txt(o.page.locator("[data-seats]"))) === "6");
  // длинный к правому краю не передвинуть
  await o.page.locator("[data-edit-move]").click(); await sleep(100);
  ok("DRAW: «Передвинуть» — подсказка, куда нажать", /Нажми на пустую клетку: туда встанет стол 6\./.test(await txt(o.page.locator("[data-floor-editor]"))));
  await o.page.locator('[data-floor-editor] [data-cell="7:0"]').click(); await sleep(150);
  ok("DRAW: длинный к правому краю — «Сюда стол не встаёт»", /Сюда стол не встаёт/.test(await txt(o.page.locator('[data-floor-editor] [role="alert"]'))));
  // второй передвинуть в 6:3
  await o.page.locator('[data-floor-editor] [data-table="' + ids[1] + '"]').click(); await sleep(150);
  await o.page.locator("[data-edit-move]").click(); await o.page.locator('[data-floor-editor] [data-cell="6:3"]').click(); await sleep(150);
  ok("DRAW: стол 2 передвинут, «Передвинуть» отжалась", (await o.page.locator("[data-edit-move]").getAttribute("aria-pressed")) === "false" && (await o.page.locator("[data-floor-editor] [data-table]").count()) === 3);
  // первый — в 7:5, длинным у правого края не стать
  await o.page.locator('[data-floor-editor] [data-table="' + ids[0] + '"]').click(); await sleep(150);
  await o.page.locator("[data-edit-move]").click(); await o.page.locator('[data-floor-editor] [data-cell="7:5"]').click(); await sleep(150);
  await o.page.locator('[data-edit-shape="long"]').click(); await sleep(150);
  ok("DRAW: длинный стол у правого края — «Справа нет места»", /Справа нет места для длинного стола/.test(await txt(o.page.locator('[data-floor-editor] [role="alert"]'))));
  await o.page.locator("[data-edit-n]").fill("6"); await sleep(100);
  await o.page.locator("[data-floor-save]").click(); await sleep(300);
  ok("DRAW: повтор номера — «Номер 6 повторяется», на сервер не уходит", /Номер 6 повторяется/.test(await txt(o.page.locator('[data-floor-editor] [role="alert"]'))) && !B.saves.length);
  await o.page.locator("[data-edit-n]").fill("1");
  await shot(o.page, "draw-editor");
  await o.page.locator("[data-floor-save]").click(); await sleep(900);
  const sv = (B.saves[0] || {}).p_plan || {};
  const byN = Object.fromEntries((sv.tables || []).map((t) => [t.n, t]));
  ok("DRAW: floor_save — три стола: 1 (7:5, квадрат), 2 (6:3), 6 (длинный, 6 мест, 4:1)", (sv.tables || []).length === 3 && byN["1"] && byN["1"].x === 7 && byN["1"].y === 5 && byN["1"].shape === "sq"
    && byN["2"] && byN["2"].x === 6 && byN["2"].y === 3 && byN["6"] && byN["6"].shape === "long" && byN["6"].seats === 6 && byN["6"].x === 4 && byN["6"].y === 1, JSON.stringify(sv.tables));
  ok("DRAW: схема сохранена — доска со столами", /Схема сохранена: её видит вся смена\./.test(await txt(o.page.locator('[role="status"]'))) && (await o.page.locator("[data-floor] [data-table]").count()) === 3);
  ok("DRAW: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
  const o2 = await open({ who: HOST, rpcs: board({ plan: null, rows: [] }).rpc });
  await sleep(1200); await nav(o2.page, "seat");
  ok("DRAW: сотрудник без схемы — «Руководитель ещё не нарисовал схему зала», кнопки нет", /Руководитель ещё не нарисовал схему зала\./.test(await txt(o2.page.locator("[data-floor-empty]"))) && !(await o2.page.locator("[data-floor-edit]").count()));
  await o2.ctx.close();
}

if (want("BOARD")) {
  for (const light of [false, true]) {
    const tag = "BOARD" + (light ? " светлая" : "");
    const B = board({});
    const o = await open({ who: HOST, light, rpcs: B.rpc });
    await sleep(1200); await nav(o.page, "shift");
    const it = o.page.locator('.sa-card[aria-label="Рассадка"]');
    ok(tag + ": «Смена» → «На смене» → «Рассадка»", /Схема зала: кто где сидит, брони и уборка/.test(await txt(it)));
    await it.first().click(); await sleep(1600);
    const sum = await txt(o.page.locator("[data-seat-summary]"));
    ok(tag + ": сводка — свободно 2 из 5, занято 1, гостей 4, брони 1, уборка 1", /^Свободно 2 из 5 · Занято 1 · Гостей 4 · Брони 1 · Уборка 1$/.test(sum), sum);
    const st = await o.page.locator("[data-floor] [data-table]").evaluateAll((els) => els.map((e) => e.getAttribute("data-table") + ":" + e.getAttribute("data-status")).join(","));
    ok(tag + ": статусы столов", st === "t1:free,t2:seat,t3:res,t4:clean,t5:free", st);
    ok(tag + ": стол с гостями — «4·25м», свободный — места, уборка — веник", (await txt(o.page.locator('[data-table="t2"]'))) === "2 4·25м" && (await txt(o.page.locator('[data-table="t1"]'))) === "1 4 м."
      && (await txt(o.page.locator('[data-table="t4"]'))) === "4" && (await o.page.locator('[data-table="t4"] [data-broom]').count()) === 1, await txt(o.page.locator('[data-table="t2"]')));
    ok(tag + ": бронь на столе — время; брони списком", (await txt(o.page.locator('[data-table="t3"]'))) === "3 19:30" && /Брони сегодня 19:30 Иванов · 4 гостя стол 3/.test(await txt(o.page.locator("[data-res-list]"))));
    ok(tag + ": «Официанты» — у Петра стол 2, Анна в графике без столов", /^Официанты Пётр О\.: стол 2 · 4 гостя В графике, без столов: Анна С\.$/.test(await txt(o.page.locator("[data-waiters]"))), await txt(o.page.locator("[data-waiters]")));
    ok(tag + ": стол 2 озвучен для экранного диктора", (await o.page.locator('[data-table="t2"]').getAttribute("aria-label")) === "Стол 2, 4 места: гости, гостей 4");
    // бронь из списка → карточка: гости пришли, 4 из брони
    await o.page.locator("[data-res-list] [role=button]").first().click(); await sleep(300);
    const sh3 = o.page.locator('[data-table-sheet="t3"]');
    ok(tag + ": бронь из списка — карточка стола 3: сразу «Гости», 4 гостя из брони, «Посадить»", (await sh3.locator('[data-sheet-status="seat"]').getAttribute("aria-checked")) === "true"
      && (await txt(sh3.locator("[data-cnt]"))) === "4" && /сейчас: бронь на 19:30/.test(await txt(sh3)) && (await txt(sh3.locator("[data-sheet-save]"))) === "Посадить");
    await sh3.locator("[data-sa-back]").click(); await sleep(250);
    await shot(o.page, "board" + (light ? "-light" : ""));
    await o.page.locator('[data-party="4"]').click(); await sleep(300);
    ok(tag + ": «Посадить: 3–4» — свободные столы, где хватает мест, меньший запас первым", /Подойдут: стол 1, стол 5/.test(await txt(o.page.locator("[data-suggest]")))
      && (await o.page.locator('[data-table="t1"]').getAttribute("data-hi")) === "1" && (await o.page.locator('[data-table="t3"]').getAttribute("data-hi")) === "0");
    // посадить за 1
    await o.page.locator('[data-table="t1"]').click(); await sleep(400);
    const sheet = o.page.locator('[data-table-sheet="t1"]');
    ok(tag + ": карточка стола: «Стол 1», 4 места, сейчас свободен; выбрано «Гости», гостей — по компании (4)", /Стол 1 4 места · сейчас: свободен/.test(await txt(sheet))
      && (await sheet.locator('[data-sheet-status="seat"]').getAttribute("aria-checked")) === "true" && (await txt(sheet.locator("[data-cnt]"))) === "4");
    ok(tag + ": официанты: сначала кто в графике, остальные — «Ещё 2»", /^Не назначен Анна С\. Ещё 2$/.test(await txt(sheet.locator("[data-waiters-pick]"))), await txt(sheet.locator("[data-waiters-pick]")));
    await sheet.locator("[data-waiter-more]").click(); await sleep(150);
    ok(tag + ": «Ещё» — не в графике: Илья, Пётр (у него 1 стол)", /Сегодня не в графике Илья Б\. Пётр О\. · 1/.test(await txt(sheet)), await txt(sheet));
    await sheet.locator("[data-cnt-minus]").click(); await sheet.locator('[data-waiter="e-anna"]').click();
    await shot(o.page, "sheet" + (light ? "-light" : ""));
    await sheet.locator("[data-sheet-save]").click(); await sleep(700);
    const s1 = B.sets[0] || {};
    ok(tag + ": seat_set — стол 1, гости 3, официант Анна", s1.p_tid === "t1" && s1.p_status === "seat" && s1.p_cnt === 3 && s1.p_waiter === "e-anna", JSON.stringify(s1));
    ok(tag + ": стол 1 — гости, «Стол 1: посадили.», подсветка сброшена", (await o.page.locator('[data-table="t1"]').getAttribute("data-status")) === "seat" && /Стол 1: посадили\./.test(await txt(o.page.locator('[role="status"]'))) && !(await o.page.locator("[data-suggest]").count()));
    ok(tag + ": «Официанты» — Анна: стол 1, 3 гостя; без столов никого", /^Официанты Анна С\.: стол 1 · 3 гостя Пётр О\.: стол 2 · 4 гостя$/.test(await txt(o.page.locator("[data-waiters]"))), await txt(o.page.locator("[data-waiters]")));
    // бронь за 5
    await o.page.locator('[data-table="t5"]').click(); await sleep(300);
    const sh5 = o.page.locator('[data-table-sheet="t5"]');
    await sh5.locator('[data-sheet-status="res"]').click(); await sh5.locator("[data-sheet-save]").click(); await sleep(200);
    ok(tag + ": бронь без времени — «Укажи время брони»", /Укажи время брони/.test(await txt(sh5.locator('[role="alert"]'))) && B.sets.length === 1);
    await sh5.locator("[data-res-time]").fill("20:30"); await sh5.locator("[data-res-name]").fill("Петровы");
    await sh5.locator("[data-sheet-save]").click(); await sleep(700);
    const s2 = B.sets[1] || {};
    ok(tag + ": seat_set — бронь 20:30 на Петровых, 2 гостя", s2.p_tid === "t5" && s2.p_status === "res" && s2.p_rtime === "20:30" && s2.p_name === "Петровы" && s2.p_cnt === 2 && !s2.p_waiter, JSON.stringify(s2));
    // уборка → свободен
    await o.page.locator('[data-table="t4"]').click(); await sleep(300);
    const sh4 = o.page.locator('[data-table-sheet="t4"]');
    ok(tag + ": стол на уборке — сразу «Свободен», кнопка «Освободить стол»", (await sh4.locator('[data-sheet-status="free"]').getAttribute("aria-checked")) === "true" && (await txt(sh4.locator("[data-sheet-save]"))) === "Освободить стол");
    await sh4.locator("[data-sheet-save]").click(); await sleep(700);
    ok(tag + ": «Освободить стол» → seat_set free", (B.sets[2] || {}).p_status === "free" && (await o.page.locator('[data-table="t4"]').getAttribute("data-status")) === "free");
    // стол с гостями: сразу «Счёт» (v86; было «Уборка»); крестик закрывает карточку
    await o.page.locator('[data-table="t2"]').click(); await sleep(300);
    ok(tag + ": стол с гостями — сразу «Счёт», в шапке гостей и сколько сидят", (await o.page.locator('[data-table-sheet="t2"] [data-sheet-status="bill"]').getAttribute("aria-checked")) === "true"
      && /сейчас: гости, 4 гостя, 25 мин/.test(await txt(o.page.locator('[data-table-sheet="t2"]'))) && (await txt(o.page.locator('[data-table-sheet="t2"] [data-sheet-save]'))) === "Попросили счёт");
    await o.page.locator('[data-table-sheet="t2"] [data-sa-back]').click(); await sleep(300);
    ok(tag + ": крестик закрывает карточку без изменений", !(await o.page.locator("[data-table-sheet]").count()) && B.sets.length === 3);
    if (!light) {
      // другая хостес посадила гостей за 3 — доска обновится сама
      B.onBoard = (b) => { if (b.boards >= 2) b.rows = [...b.rows.filter((r) => r.tid !== "t3"), { tid: "t3", status: "seat", cnt: 2, name: "", rtime: "", since: NOW.toISOString(), waiter_id: null, waiter_name: "", updated_name: "Ирина", updated_at: NOW.toISOString() }]; };
      const before = B.boards;
      await sleep(16500);
      ok("BOARD: доска обновляется сама раз в 15 секунд (стол 3 занят с другого телефона)", B.boards > before && (await o.page.locator('[data-table="t3"]').getAttribute("data-status")) === "seat", String(B.boards - before));
    }
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("LEAD")) {
  const B = board({ lead: true });
  const o = await open({ who: LEAD, rpcs: B.rpc });
  await sleep(1200); await nav(o.page, "seat");
  const cl = o.page.locator("[data-seat-clear]");
  await cl.click(); await sleep(200);
  ok("LEAD: «Очистить доску» — сначала предупреждает", /Все столы станут свободными\. Нажми ещё раз/.test(await txt(cl)) && !B.clears);
  await sleep(4400);
  ok("LEAD: без второго нажатия через 4 секунды — снова «Очистить доску»", (await txt(cl)) === "Очистить доску" && !B.clears);
  await cl.click(); await sleep(200); await cl.click(); await sleep(900);
  ok("LEAD: второе нажатие → seat_clear, все свободны", B.clears === 1 && /Доска очищена\./.test(await txt(o.page.locator('[role="status"]')))
    && (await o.page.locator('[data-floor] [data-table][data-status="free"]').count()) === 5);
  await o.page.locator("[data-floor-edit]").click(); await sleep(400);
  ok("LEAD: «Схема зала ›» — редактор с текущими столами", (await o.page.locator("[data-floor-editor] [data-table]").count()) === 5);
  ok("LEAD: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("BRIEF")) {
  const B = board({ lead: true });
  let published = null;
  const o = await open({ who: LEAD, rpcs: (fn, body) => {
    if (fn === "brief_publish") { published = body; return { ok: true, sent: 0, again: false, bot: true }; }
    if (fn === "league_week") return { ok: true, rows: [] };
    if (fn === "quiz_hard_questions") return [];
    return B.rpc(fn, body);
  } });
  await sleep(1200); await nav(o.page, "brief"); await sleep(1200);
  const b = await txt(o.page.locator('[data-brief-block="res"]'));
  ok("BRIEF: блок «Брони сегодня» после «Кто сегодня»: время, на кого, гостей, стол", /Брони сегодня 19:30 Иванов · 4 гостя · стол 3/.test(b) && (await o.page.locator('[data-brief-block="res"]').getAttribute("data-on")) === "1", b);
  const order = await o.page.locator("[data-brief-block]").evaluateAll((els) => els.map((e) => e.getAttribute("data-brief-block")).slice(0, 2).join(","));
  ok("BRIEF: порядок — «Кто сегодня», потом «Брони сегодня»", order === "roster,res", order);
  await o.page.locator("[data-brief-publish]").click(); await sleep(900);
  ok("BRIEF: в тексте для Telegram — «Брони сегодня: 19:30 Иванов, 4 гостя, стол 3»", String((published && published.p_text) || "").includes("Брони сегодня: 19:30 Иванов, 4 гостя, стол 3"), String((published && published.p_text) || "").slice(0, 200));
  ok("BRIEF: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("MISSING")) {
  const miss = { code: "PGRST202", message: "Could not find the function" };
  const o = await open({ who: HOST, rpcs: (fn) => (/^(seat_|floor_)/.test(fn) ? miss : undefined) });
  await sleep(1200); await nav(o.page, "seat");
  ok("MISSING: экран — «На сервере ещё нет этапа 35»", /На сервере ещё нет этапа 35 \(supabase-stage35-seating\.sql\)/.test(await txt(o.page.locator("body"))));
  await nav(o.page, "shift");
  ok("MISSING: пункт «Рассадка» в «Смене» пропал", !(await o.page.locator('.sa-card[aria-label="Рассадка"]').count()) && (await o.page.locator('.sa-card[aria-label="График"]').count()) === 1);
  ok("MISSING: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("LINK")) {
  const o = await open({ who: HOST, path: "/?go=seat", rpcs: board({}).rpc });
  await sleep(2600);
  ok("LINK: ?go=seat — рассадка", (await o.page.locator("[data-floor] [data-table]").count()) === 5);
  ok("LINK: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("PREFS")) {
  let prefs = { ok: true, bot: true, linked: true, remind: true, pair: true, quest: true, league: true, fresh: true, month: true, master: true, qday: true, qday_hour: 12, brief: true, cases: true, thanks: true, seat: true };
  const o = await open({ who: HOST, rpcs: (fn, body) => {
    if (fn === "tg_status") return { ok: true, bot: true, linked: true, remind: true, minutes: 60 };
    if (fn === "notify_prefs") return prefs;
    if (fn === "notify_set") { prefs = { ...prefs, [body.p_kind]: !!body.p_on }; return prefs; }
    return undefined;
  } });
  await sleep(1500); await nav(o.page, "shift");
  await o.page.locator('.sa-card[aria-label="Напоминания в Telegram"]').first().click(); await sleep(1400);
  const row = o.page.locator('[data-notify-prefs] [role="switch"]', { hasText: "Рассадка" });
  // v86: строки группами — «Рассадка» в группе «Смена»
  ok("PREFS: строка «Рассадка» — в группе «Смена», включена", /Рассадка когда тебе посадили гостей за стол/.test(await txt(row)) && (await row.getAttribute("aria-checked")) === "true"
    && (await o.page.locator('[data-notify-group="shift"] [role="switch"]', { hasText: "Рассадка" }).count()) === 1, await txt(row));
  await row.click(); await sleep(700);
  const set = o.calls.filter((c) => c.fn === "notify_set").map((c) => c.body);
  ok("PREFS: переключатель — notify_set seat выкл", set.length === 1 && set[0].p_kind === "seat" && set[0].p_on === false, JSON.stringify(set));
  await o.ctx.close();
}

if (want("NARROW")) {
  const o = await open({ who: HOST, w: 320, h: 640, rpcs: board({}).rpc });
  await sleep(1200); await nav(o.page, "seat");
  const fit = () => o.page.evaluate(() => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll("[data-floor] [data-table], [data-seat-summary], [data-table-sheet] *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).length; return { W, sw: document.documentElement.scrollWidth, over }; });
  const a = await fit();
  ok("NARROW: 320 px — доска без прокрутки вбок", a.sw <= a.W && a.over === 0, JSON.stringify(a));
  await o.page.locator('[data-table="t1"]').click(); await sleep(400);
  const b = await fit();
  ok("NARROW: 320 px — карточка стола без прокрутки вбок", b.sw <= b.W && b.over === 0, JSON.stringify(b));
  await shot(o.page, "narrow-sheet");
  ok("NARROW: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
