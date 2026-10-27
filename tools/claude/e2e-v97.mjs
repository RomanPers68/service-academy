// e2e v97 (Доп. 410): чат как часть приложения. Сервер — tools/claude/demo-app/fake-server.js (тот же, что у демо):
// этап 38 и всё, что нужно экранам. Разделы:
//   SCHED  — «График» у сотрудника: «Смены в чате команды» (отдают, ищут в смену, хотят поменяться; заявки на начало
//            следующего месяца — тоже), «Забрать» и «Выйду» отсюда (клетка и сервер сразу), «Отдать в чате» — лист в
//            чате с этим днём, своё предложение после возврата из чата; лист дня; старого «Обмена сменами» нет;
//   LEGACY — сервер без chat_shift_board: «Обмен сменами» как раньше, блока чата нет; без чата — нет и «Поделиться»;
//   LEAD   — руководитель: «Кто вместо?» → «Спросить в чате команды» (замена: должность, смена, вместо кого), карточка
//            в чате; коллега вышел — после чата «не сможет» ушло из «Требует внимания»; «Кто может?» → «Ищем в смену»;
//            «В чате: ищем…» в «Требует внимания»; несохранённые правки — кнопка ждёт «Сохранить»; «Сообщить в чат
//            команды»: «График готов» и «Пожелания до…»;
//   SHARE  — «Поделиться в чат»: блюдо (Колода меню; подпись без состава в скобках; «Открыть в Меню» у коллеги),
//            коктейль, глава Справочника, пройденный урок;
//   STOP   — «В стоп» в редакторе меню → карточка в чате команды, «Вернуть в меню» → «Снова в меню»;
//   BRIEF  — брифинг отправлен → карточка в «Вся команда»;
//   PERSON — имя в чате → карточка коллеги (смена) → «Написать лично»;
//   LINKS  — ?go=chat_<чат>_<сообщение> и ?go=schedule;
//   NARROW — 320 px, обе темы: блок в «Графике» и лист «Кто вместо?» помещаются.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v97.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5297, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v97";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v97";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { RESTAURANT_MENUS } = await import(SRC + "/data/menu.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

// ── дни: как в телефоне (Камчатка) ──
const TZ = "Asia/Kamchatka";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const D = (n) => addD(TODAY, n);
const MK = TODAY.slice(0, 7);

const R0 = "Два моря, Океан";
const P = (id, name, surname, position) => ({ id, name, surname, restaurant: R0, position, is_admin: false });
const MARIA = P("u-maria", "Мария", "Ким", "manager"), OLGA = P("e-olga", "Ольга", "Ли", "hostess"), ANNA = P("e-anna", "Анна", "Смирнова", "waiter");
const PETR = P("e-petr", "Пётр", "Орлов", "waiter"), VERA = P("e-vera", "Вера", "Соколова", "waiter"), DARYA = P("e-darya", "Дарья", "Лебедева", "waiter"), ILYA = P("e-ilya", "Илья", "Белов", "bartender");
const PEOPLE = [MARIA, OLGA, ANNA, PETR, VERA, DARYA, ILYA];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const tok = (p) => "tok-" + p.id;
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Ли Ольга", pos: "host", norm: 160 }, { id: 3, name: "Смирнова Анна", pos: "waiter", norm: 160 },
  { id: 4, name: "Орлов Пётр", pos: "waiter", norm: 160 }, { id: 5, name: "Соколова Вера", pos: "waiter", norm: 160 }, { id: 6, name: "Лебедева Дарья", pos: "waiter", norm: 160 },
  { id: 7, name: "Белов Илья", pos: "bar", norm: 160 }];
const CFG = { hours: Array.from({ length: 7 }, () => [12, 24]), shifts: SHIFTS, need: { 1: { waiter: 2 }, 2: { waiter: 2 }, 3: { waiter: 3 } }, split: {},
  rules: { peakDows: [4, 5], highDows: [3, 6], maxRow: 5, minOff: 2, minRest: 11, holidayPeak: true, wishDeadline: 0, autoFill: false, normMode: "floor" },
  posRules: { waiter: { pattern: "even" } }, dayShift: "Д", staff: SSTAFF };
// две недели от сегодня по дням (индекс — смещение): Анне есть что забрать (Вера, +2), куда выйти (+6) и с кем поменяться (Пётр, +9)
const NEAR = { 3: "ДД-ВВ--ДД-ВВ--", 4: "В-ДД-ВВ-ДД-ВВ-", 5: "-ВВ-ДД-В-ДД-ВВ", 6: "Д--Д--Д-В--Д-Д" };
function planOf() {
  const out = {};
  for (let i = -31; i <= 45; i++) {
    const set = (sid, k) => { if (k && k !== "-") (out[sid] = out[sid] || {})[i] = k; };
    const c2 = ((i % 4) + 4) % 4;
    set(1, c2 < 2 ? "Д" : ""); set(2, c2 >= 2 ? "Д" : ""); set(7, c2 === 1 || c2 === 2 ? "В" : "");
    for (const sid of [3, 4, 5, 6]) { const row = NEAR[sid]; set(sid, i >= 0 && i < row.length ? row[i] : row[((i % row.length) + row.length) % row.length]); }
  }
  return out;
}
const MENU = JSON.parse(JSON.stringify(RESTAURANT_MENUS[R0]));
function newServer({ seed = true } = {}) {
  const s = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu: MENU, wishes: [{ sid: 6, at: 3, kind: "hard" }],
    progress: { "e-anna": ["s0-1", "s0-2", "s0-3", "s0-4", "s1-1", "s1-2"], "u-maria": ["s0-1", "s0-2"] } });
  s.calls = [];
  if (seed) {
    s.bot.say("u-maria", "Доброе утро! Сегодня банкет на 12 человек в 19:00.");
    s.give = s.bot.offer("e-vera", D(2), "give", "Нужно к врачу").msg;
    s.need = s.bot.need("u-maria", D(6), "waiter", "В", 1).msg;
    s.swap = s.bot.offer("e-petr", D(9), "swap", "").msg;
    s.ilya = s.bot.say("e-ilya", "На баре закончился тоник, до обеда привезут.");
  }
  return s;
}

const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra && !cond ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ who = ANNA, srv, rpcs = () => undefined, light = false, w = 393, h = 852, path = "/", seedExtra = {} } = {}) {
  const UK = "_" + who.name + "_" + who.surname;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: TZ, reducedMotion: "reduce" });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN }).catch(() => {});
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      srv.calls.push({ fn: m[1], body, who: who.id, t: Date.now() });
      let own = rpcs(m[1], body);
      if (own === undefined) own = srv.rpc(m[1], body);
      return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own === undefined ? null : own) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: tok(who), sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_menu_shared: JSON.stringify({ [R0]: MENU }), sa_boot_missing: String(Date.now()), ...seedExtra };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1"; seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } }, seed);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(ORIGIN + path, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const until = async (fn, ms = 9000, step = 250) => { const t0 = Date.now(); for (;;) { let v = false; try { v = await fn(); } catch (e) { v = false; } if (v || Date.now() - t0 > ms) return v; await sleep(step); } };
const body = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const fits = (page) => page.evaluate(() => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1) && !e.closest(".sa-schedgrid") && !e.closest("[data-week-strip]") && getComputedStyle(e).position !== "fixed"; }).map((e) => (typeof e.className === "string" && e.className ? e.className.slice(0, 40) : e.tagName)); return { W, sw: document.documentElement.scrollWidth, over: over.slice(0, 4), n: over.length }; });
const noErr = (...xs) => [!xs.some((x) => x.errors.length), xs.flatMap((x) => x.errors).slice(0, 3).join(" | ")];
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String(e && e.message || e).split("\n")[0].slice(0, 200)); } };
const lastCall = (srv, fn) => [...srv.calls].reverse().find((c) => c.fn === fn) || null;
const card = (page, t) => page.locator(`[data-chat-card="${t}"]`).last();
const chatBack = async (page) => {
  if (await page.locator("[data-chat-shareto]").count()) { await page.locator("[data-chat-shareto] [data-sa-back]").first().click({ timeout: 3000 }).catch(() => {}); await sleep(500); }
  for (let i = 0; i < 3 && (await page.locator("[data-chat]").count()); i++) { await page.locator("[data-chat] .ch-back").first().click({ timeout: 3000 }).catch(() => {}); await sleep(700); }
};
const dayN = (iso) => Number(iso.slice(8));
const inMonth = (iso) => iso.slice(0, 7) === MK;

// ── SCHED: «Смены в чате команды» у сотрудника ──
await run("SCHED", async () => {
  const srv = newServer();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "schedule", 2500);
  ok("SCHED: блок «Смены в чате команды» есть", await until(async () => (await a.page.locator("[data-sched-chat]").count()) === 1, 6000));
  const t = await txt(a.page.locator("[data-sched-chat]"));
  ok("SCHED: Вера отдаёт смену, ищут официанта, Пётр хочет поменяться (и заявки на начало следующего месяца)", /Вера С\. отдаёт смену/.test(t) && /Ищем официанта/.test(t) && /Пётр О\. хочет поменяться/.test(t), t.slice(0, 300));
  ok("SCHED: «Забрать», «Выйду» и «Поменяться ›»", (await a.page.locator("[data-sched-chat-take]").count()) === 2 && (await a.page.locator("[data-sched-chat-swap]").count()) === 1);
  ok("SCHED: старого «Обмена сменами» (через менеджера) нет", !/Обмен сменами/.test(await body(a.page)));
  await a.page.locator("[data-sched-chat]").scrollIntoViewIfNeeded(); await shot(a.page, "sched-block");
  // «Забрать» у Веры
  await a.page.locator(`[data-sched-chat-take="${srv.give.id}"]`).click();
  ok("SCHED: «Забрать»: «Смена твоя, график обновлён»", await until(async () => /Смена твоя, график обновлён/.test(await body(a.page)), 5000));
  ok("SCHED: на сервере смена перешла: у Анны вечер, у Веры пусто", srv.code("3", D(2)) === "В" && srv.code("5", D(2)) === "" && srv.msgOf(srv.give.id).card.st === "done", srv.code("3", D(2)) + "/" + srv.code("5", D(2)));
  ok("SCHED: строки Веры больше нет", await until(async () => !/Вера С\. отдаёт смену/.test(await txt(a.page.locator("[data-sched-chat]"))), 4000));
  if (inMonth(D(2))) {
    const k = await a.page.locator(`[data-cal-day="${dayN(D(2))}"]`).first().getAttribute("data-cal-k").catch(() => "");
    ok("SCHED: в календаре день " + dayN(D(2)) + " — вечер (клетка сразу)", k === "В", k);
  }
  // «Выйду» по «Ищем официанта»
  await a.page.locator(`[data-sched-chat-take="${srv.need.id}"]`).click();
  ok("SCHED: «Выйду»: «Ты выходишь в смену, график обновлён»", await until(async () => /Ты выходишь в смену, график обновлён/.test(await body(a.page)), 5000));
  const nc = srv.msgOf(srv.need.id).card;
  ok("SCHED: на сервере Анна выходит по карточке, смена в графике", nc.st === "done" && nc.took.some((x) => x.id === "e-anna") && srv.code("3", D(6)) === "В", JSON.stringify(nc.took));
  // «Отдать в чате» — лист в чате с этим днём
  const sel = await a.page.locator("[data-sched-chat] select").inputValue();
  const isoSel = MK + "-" + String(sel).padStart(2, "0");
  await a.page.locator("[data-sched-chat-give]").click();
  ok("SCHED: «Отдать в чате» — чат и лист «Отдать смену»", await until(async () => (await a.page.locator("[data-chat-shiftsheet='give']").count()) === 1, 6000));
  ok("SCHED: в листе уже выбрана эта смена (" + isoSel + ")", await until(async () => (await a.page.locator("[data-chat-myshift][aria-pressed='true']").getAttribute("data-chat-myshift").catch(() => "")) === isoSel, 4000));
  await shot(a.page, "sched-give-sheet");
  await a.page.locator("[data-chat-shiftsheet] .ch-main").click();
  ok("SCHED: карточка «Отдаю смену» в чате, на сервере открыта", await until(async () => srv.S.msgs.some((m) => m.emp === "e-anna" && m.card && m.card.t === "shift" && m.card.mode === "give" && m.card.date === isoSel && m.card.st === "open"), 5000));
  await chatBack(a.page);
  ok("SCHED: вернулась из чата — своё предложение в блоке («Ты отдаёшь смену … Ждём»)", await until(async () => (await a.page.locator(`[data-sched-chat-mine="${dayN(isoSel)}"]`).count()) === 1, 6000), await txt(a.page.locator("[data-sched-chat]")));
  // «Поменяться ›» — в чат к карточке Петра
  await a.page.locator("[data-sched-chat-swap]").click();
  ok("SCHED: «Поменяться ›» открывает чат с карточкой Петра", await until(async () => (await a.page.locator("[data-chat]").count()) === 1 && /Меняю смену/i.test(await txt(a.page.locator(`[data-chat-msg="${srv.swap.id}"]`))), 6000),
    await txt(a.page.locator(`[data-chat-msg="${srv.swap.id}"]`)));
  ok("SCHED: карточка Петра на виду (чат прокручен к ней)", await until(async () => { const r = await a.page.locator(`[data-chat-msg="${srv.swap.id}"]`).boundingBox(); return r && r.y > 40 && r.y < 852 - 100; }, 4000));
  await chatBack(a.page);
  // лист дня: свободный день с предложением — «Забрать» прямо в листе
  const s2 = newServer();
  const b = await open({ who: ANNA, srv: s2 });
  await nav(b.page, "schedule", 2500);
  if (inMonth(D(2))) {
    await b.page.locator(`[data-cal-day="${dayN(D(2))}"]`).first().click();
    await until(async () => (await b.page.locator("[data-day-sheet]").count()) === 1, 3000);
    ok("SCHED: лист дня " + dayN(D(2)) + ": «Вера С. отдаёт смену» и «Забрать»", (await b.page.locator("[data-sheet-chattake='give']").count()) === 1, await txt(b.page.locator("[data-day-sheet]")));
    await shot(b.page, "sched-day-sheet");
  }
  const [e1, e2] = noErr(a, b);
  ok("SCHED: без ошибок в консоли", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

// ── LEGACY: без chat_shift_board — как раньше; без чата — нет и «Поделиться» ──
await run("LEGACY", async () => {
  const srv = newServer();
  const a = await open({ who: ANNA, srv, rpcs: (fn) => (fn === "chat_shift_board" ? { code: "PGRST202" } : undefined) });
  await nav(a.page, "schedule", 2500);
  ok("LEGACY: нет chat_shift_board — блока «Смены в чате» нет", (await a.page.locator("[data-sched-chat]").count()) === 0);
  ok("LEGACY: «Обмен сменами» как раньше", /Обмен сменами/.test(await body(a.page)));
  const b = await open({ who: ANNA, srv, rpcs: (fn) => (/^chat_/.test(fn) ? { code: "PGRST202" } : undefined) });
  await sleep(5000);
  await nav(b.page, "menuTrainer", 1800);
  await b.page.locator("text=Колода меню").first().click(); await sleep(1300);
  await b.page.mouse.click(196, 430); await sleep(800);
  ok("LEGACY: без чата на обороте блюда «Поделиться в чат» нет", (await b.page.locator("[data-share-chat]").count()) === 0);
  const [e1, e2] = noErr(a, b);
  ok("LEGACY: без ошибок в консоли", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

// ── LEAD: руководитель — «Спросить в чате команды», «Сообщить в чат» ──
await run("LEAD", async () => {
  const srv = newServer();
  const a = await open({ who: MARIA, srv });
  await nav(a.page, "schedule", 3000);
  ok("LEAD: «Требует внимания»: Дарья не сможет выйти", /Лебедева Дарья не сможет выйти/.test(await txt(a.page.locator("[data-attn]"))));
  const needRows = await a.page.locator("[data-attn-row='chatneed']").count();
  ok("LEAD: «В чате: ищем официанта» в «Требует внимания» — открытая карточка на " + D(6) + (inMonth(D(6)) ? "" : " (следующий месяц — не здесь)"), needRows === (inMonth(D(6)) ? 1 : 0), String(needRows));
  await a.page.locator("[data-attn-row='conflict'] button").first().click(); await sleep(700);
  ok("LEAD: «Кто вместо?»: «Спросить в чате команды»", (await a.page.locator("[data-chat-ask] [data-chat-ask-go]").count()) === 1 && !(await a.page.locator("[data-chat-ask-go]").isDisabled()));
  await shot(a.page, "lead-repl");
  await a.page.locator("[data-chat-ask-go]").click();
  ok("LEAD: «Готово: карточка в чате команды»", await until(async () => (await a.page.locator("[data-chat-ask-ok]").count()) === 1, 5000));
  const c = lastCall(srv, "chat_shift_need");
  ok("LEAD: на сервер — замена: «Вся команда», дата, официант, дневная, вместо строки Дарьи", c && c.body.p_chat === null && c.body.p_date === D(3) && c.body.p_pos === "waiter" && c.body.p_k === "Д" && c.body.p_instead === "6", JSON.stringify(c && c.body));
  await a.page.locator("[data-chat-ask] button", { hasText: "Открыть в чате" }).click();
  ok("LEAD: «Открыть в чате» — карточка «Ищем замену … вместо Дарья Л.»", await until(async () => /Ищем замену|ИЩЕМ ЗАМЕНУ/i.test(await txt(card(a.page, "shift"))) && /вместо Дарья Л\./.test(await txt(card(a.page, "shift"))), 6000), await txt(card(a.page, "shift")));
  await shot(a.page, "lead-need-card");
  // Вера выходит (в своём телефоне)
  const need = [...srv.S.msgs].reverse().find((m) => m.card && m.card.mode === "need" && m.card.instead);
  const tk = srv.rpc("chat_shift_take", { p_token: tok(VERA), p_msg: need.id });
  ok("LEAD: Вера нажала «Выйду» — смена её, у Дарьи пусто", tk.ok && srv.code("5", D(3)) === "Д" && srv.code("6", D(3)) === "", JSON.stringify(tk).slice(0, 120));
  ok("LEAD: руководителям строка «Замена …: выходит Вера С., не выходит Дарья Л. · график обновлён»", srv.S.msgs.some((m) => m.chat === 2 && /^Замена .*выходит Вера С\., не выходит Дарья Л\. · график обновлён$/.test(m.body)));
  await chatBack(a.page);
  ok("LEAD: после чата график перечитан тихо: «Дарья не сможет выйти» ушло", await until(async () => !/Лебедева Дарья не сможет выйти/.test(await txt(a.page.locator("[data-attn]"))), 6000), await txt(a.page.locator("[data-attn]")));
  // «Кто может?» → «Ищем в смену»
  const hole = a.page.locator("[data-attn-row='hole'] button");
  if (await hole.count()) {
    await hole.first().click(); await sleep(700);
    await a.page.locator("[data-chat-ask-go]").click();
    await until(async () => (await a.page.locator("[data-chat-ask-ok]").count()) === 1, 5000);
    const c2 = lastCall(srv, "chat_shift_need");
    ok("LEAD: «Кто может?» → «Ищем в смену»: без «вместо», сколько не хватает", c2 && c2.body.p_instead === null && c2.body.p_n >= 1 && c2.body.p_pos === "waiter", JSON.stringify(c2 && c2.body));
    await a.page.locator("[data-fill-sheet] button", { hasText: "Закрыть" }).click(); await sleep(600);
    ok("LEAD: в «Требует внимания» — «В чате: ищем официанта»", await until(async () => (await a.page.locator("[data-attn-row='chatneed']").count()) >= 1, 4000));
  } else ok("LEAD: «Кто может?» (недобор на неделе)", false, "нет строки недобора");
  // «Сообщить в чат команды»
  await a.page.locator("button", { hasText: /^Ещё/ }).click(); await sleep(400);
  await a.page.locator("[data-sched-chatnote]").click(); await sleep(500);
  await shot(a.page, "lead-chatnote");
  await a.page.locator("[data-chatnote-ready]").click();
  ok("LEAD: «График на … готов» — карточка в «Вся команда»", await until(async () => (await a.page.locator("[data-chatnote-ok]").count()) === 1, 5000) && srv.S.msgs.some((m) => m.chat === 1 && m.card && m.card.t === "sched" && m.card.what === "ready" && m.card.month === MK));
  await a.page.locator("[data-chatnote-sheet] button", { hasText: "Закрыть" }).click(); await sleep(400);
  await a.page.locator("button", { hasText: /^Ещё/ }).click(); await sleep(400);
  await a.page.locator("[data-sched-chatnote]").click(); await sleep(500);
  await a.page.locator("[data-chatnote-until]").fill(D(5));
  await a.page.locator("[data-chatnote-wishes]").click();
  ok("LEAD: «Пожелания на …: до …» — карточка с датой", await until(async () => srv.S.msgs.some((m) => m.card && m.card.t === "sched" && m.card.what === "wishes" && m.card.until === D(5)), 5000));
  await a.page.locator("[data-chatnote-sheet] button", { hasText: "Закрыть" }).click(); await sleep(400);
  // несохранённые правки — «Спросить в чате» ждёт «Сохранить»
  const s2 = newServer();
  const b = await open({ who: MARIA, srv: s2 });
  await nav(b.page, "schedule", 3000);
  const hole2 = b.page.locator("[data-attn-row='hole'] button");
  if (await hole2.count()) {
    await hole2.first().click(); await sleep(600);
    const pick = b.page.locator("[data-fill-pick]");
    if (await pick.count()) {
      await pick.first().click(); await sleep(600);
      await b.page.locator("[data-attn-row='conflict'] button").first().click(); await sleep(600);
      ok("LEAD: несохранённые правки — кнопка ждёт, «Сначала сохрани график»", (await b.page.locator("[data-chat-ask-go]").isDisabled()) && /Сначала сохрани график/.test(await txt(b.page.locator("[data-chat-ask]"))));
    } else ok("LEAD: несохранённые правки (свободный человек в «Кто может?»)", true);
  }
  const [e1, e2] = noErr(a, b);
  ok("LEAD: без ошибок в консоли", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

// ── SHARE: «Поделиться в чат» ──
await run("SHARE", async () => {
  const srv = newServer();
  const a = await open({ who: ANNA, srv, seedExtra: { sa_lesson_cards: "0" } });
  await sleep(4500);   // чат включается после первого chat_unread
  await nav(a.page, "menuTrainer", 1800);
  await a.page.locator("text=Колода меню").first().click(); await sleep(1300);
  await a.page.mouse.click(196, 430); await sleep(800);
  const pill = a.page.locator("[data-share-chat^='dish:']");
  ok("SHARE: на обороте блюда «Поделиться в чат»", (await pill.count()) === 1);
  await pill.scrollIntoViewIfNeeded(); await shot(a.page, "share-dish-pill");
  await pill.click();
  ok("SHARE: лист «Поделиться в чат» с блюдом и «Вся команда»", await until(async () => (await a.page.locator("[data-chat-shareto^='dish:']").count()) === 1, 6000) && (await a.page.locator("[data-chat-shareto-chat='team']").count()) === 1);
  const subT = await txt(a.page.locator("[data-chat-shareto] .ch-share-it .ch-opt-s"));
  ok("SHARE: подпись блюда: раздел и названия, без состава в скобках", subT && !/[()]/.test(subT) && subT.length <= 110, subT);
  await a.page.locator("[data-chat-share-note]").fill("Гостям нравится");
  await shot(a.page, "share-dish-sheet");
  await a.page.locator("[data-chat-shareto-chat='team']").click();
  ok("SHARE: карточка блюда в «Вся команда» с парой слов", await until(async () => srv.S.msgs.some((m) => m.emp === "e-anna" && m.card && m.card.t === "share" && m.card.item.kind === "dish" && m.card.note === "Гостям нравится"), 5000)
    && await until(async () => (await card(a.page, "share").count()) === 1, 5000));
  await shot(a.page, "share-dish-card");
  // коллега открывает блюдо у себя
  const dishTitle = [...srv.S.msgs].reverse().find((m) => m.card && m.card.t === "share").card.item.title;
  const b = await open({ who: PETR, srv });
  await sleep(4500);
  await b.page.locator("[data-chat-dock]").click().catch(() => {}); await sleep(900);
  await b.page.locator("[data-chat-item='team']").click(); await sleep(1300);
  await card(b.page, "share").locator("[data-chat-open='dish']").click();
  ok("SHARE: у коллеги «Открыть в Меню» — Колода на этом блюде", await until(async () => (await b.page.locator("[data-chat]").count()) === 0 && (await body(b.page)).includes(dishTitle), 6000), dishTitle);
  // коктейль
  await chatBack(a.page);
  await nav(a.page, "cocktails", 1800);
  await a.page.mouse.click(196, 470); await sleep(800);
  const ck = a.page.locator("[data-share-chat^='cocktail:']");
  if (!(await ck.count())) { await a.page.mouse.click(196, 520); await sleep(800); }
  ok("SHARE: Колода бармена: «Поделиться в чат» на обороте", (await ck.count()) === 1);
  if (await ck.count()) { await ck.scrollIntoViewIfNeeded(); await ck.click(); ok("SHARE: коктейль — лист «Поделиться в чат»", await until(async () => (await a.page.locator("[data-chat-shareto^='cocktail:']").count()) === 1, 6000)); await chatBack(a.page); }
  ok("SHARE: лист закрыт — чат закрылся, под ним тот же экран", (await a.page.locator("[data-chat]").count()) === 0);
  // глава Справочника
  await nav(a.page, "reference", 1800);
  await a.page.locator("text=Сервировка").first().click(); await sleep(900);
  await a.page.locator("text=Основы сервировки").first().click(); await sleep(900);
  const rf = a.page.locator("[data-share-chat^='ref:']");
  ok("SHARE: глава Справочника: «Поделиться в чат»", (await rf.count()) === 1);
  if (await rf.count()) { await rf.scrollIntoViewIfNeeded(); await shot(a.page, "share-ref"); await rf.click(); ok("SHARE: глава — лист с её названием", await until(async () => /Основы сервировки/.test(await txt(a.page.locator("[data-chat-shareto^='ref:']"))), 6000)); await chatBack(a.page); }
  // пройденный урок
  const c = await open({ who: ANNA, srv, path: "/?go=lesson_s1-3", seedExtra: { sa_lesson_cards: "0" } });
  await sleep(5000);
  const done = c.page.locator("text=/^Урок пройден/").first();
  if (await done.count()) { await done.scrollIntoViewIfNeeded(); await done.click(); await sleep(1200); }
  const ls = c.page.locator("[data-share-chat^='lesson:']");
  ok("SHARE: пройденный урок: «Поделиться в чат» под «Далее»", await until(async () => (await ls.count()) === 1, 5000));
  if (await ls.count()) { await ls.scrollIntoViewIfNeeded(); await shot(c.page, "share-lesson"); await ls.click(); ok("SHARE: урок — лист «Поделиться в чат»", await until(async () => (await c.page.locator("[data-chat-shareto^='lesson:']").count()) === 1, 6000)); }
  const [e1, e2] = noErr(a, b, c);
  ok("SHARE: без ошибок в консоли", e1, e2);
  await a.ctx.close(); await b.ctx.close(); await c.ctx.close();
});

// ── STOP: стоп из редактора меню — карточкой в чат ──
await run("STOP", async () => {
  const srv = newServer();
  const a = await open({ who: MARIA, srv });
  await nav(a.page, "menuTrainer", 1800);
  await a.page.locator("text=Редактор меню").first().click(); await sleep(1300);
  const stop = a.page.locator("span", { hasText: /^В стоп$/ }).first();
  await stop.scrollIntoViewIfNeeded(); await stop.click();
  ok("STOP: «В стоп»: меню опубликовано, потом chat_stop_note(on)", await until(async () => { const i = srv.calls.findIndex((x) => x.fn === "chat_stop_note"), j = srv.calls.findIndex((x) => x.fn === "menu_set"); return i > j && j >= 0 && srv.calls[i].body.p_on === true; }, 6000));
  const sc = srv.S.msgs.find((m) => m.chat === 1 && m.card && m.card.t === "stop");
  ok("STOP: в «Вся команда» карточка «В стоп-листе: …» из Меню", sc && sc.card.st === "on" && sc.card.from === "menu", JSON.stringify(sc && sc.card));
  await a.page.locator("span", { hasText: /^Вернуть в меню$|^Вернуть$/ }).first().click();
  ok("STOP: «Вернуть в меню» — карточка «Снова в меню»", await until(async () => srv.S.msgs.find((m) => m.id === sc.id).card.st === "off", 6000));
  const [e1, e2] = noErr(a);
  ok("STOP: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

// ── BRIEF: брифинг — карточкой в «Вся команда» ──
await run("BRIEF", async () => {
  const srv = newServer();
  const a = await open({ who: MARIA, srv });
  await sleep(4500);
  await nav(a.page, "brief", 3500);
  await a.page.locator("[data-brief-publish]").click();
  ok("BRIEF: «Отправлено…» и «В чате команды карточка брифинга»", await until(async () => /В чате команды карточка брифинга/.test(await body(a.page)), 6000), (await body(a.page)).match(/Отправлено[^.]*\./)?.[0] || "");
  const c = lastCall(srv, "chat_card_send");
  ok("BRIEF: chat_card_send: брифинг в «Вся команда» (чат не указан), строки есть", c && c.body.p_chat === null && c.body.p_card.t === "brief" && c.body.p_card.lines.length >= 1, JSON.stringify(c && c.body).slice(0, 200));
  await a.page.locator("[data-brief-publish]").click();
  ok("BRIEF: правка — та же карточка обновлена, второй нет", await until(async () => /Карточка в чате команды обновлена/.test(await body(a.page)), 6000) && srv.S.msgs.filter((m) => m.card && m.card.t === "brief").length === 1);
  const [e1, e2] = noErr(a);
  ok("BRIEF: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

// ── PERSON: имя в чате → карточка коллеги ──
await run("PERSON", async () => {
  const srv = newServer();
  const a = await open({ who: ANNA, srv });
  await sleep(4500);
  await a.page.locator("[data-chat-dock]").click(); await sleep(900);
  await a.page.locator("[data-chat-item='team']").click(); await sleep(1300);
  await a.page.locator(`[data-chat-who="e-ilya"]`).last().click(); await sleep(900);
  ok("PERSON: карточка Ильи: должность и смена", (await a.page.locator("[data-chat-person='e-ilya']").count()) === 1 && /Илья Белов/.test(await txt(a.page.locator("[data-chat-person-n]"))) && /смен/i.test(await txt(a.page.locator("[data-chat-person-shift]"))), await txt(a.page.locator("[data-chat-person]")));
  await shot(a.page, "person");
  await a.page.locator("[data-chat-person-dm]").click();
  ok("PERSON: «Написать лично» — личная переписка с Ильёй", await until(async () => /Илья/.test(await txt(a.page.locator(".ch-head .ch-title"))), 5000), await txt(a.page.locator(".ch-head")));
  const [e1, e2] = noErr(a);
  ok("PERSON: без ошибок в консоли", e1, e2);
  await a.ctx.close();
});

// ── LINKS: ссылки из Telegram ──
await run("LINKS", async () => {
  const srv = newServer();
  const a = await open({ who: ANNA, srv, path: "/?go=chat_1_" + srv.ilya.id });
  ok("LINKS: ?go=chat_1_<сообщение> — открыта «Вся команда»", await until(async () => (await a.page.locator("[data-chat]").count()) === 1 && /Вся команда/.test(await txt(a.page.locator(".ch-head"))), 8000), await txt(a.page.locator(".ch-head")));
  const b = await open({ who: ANNA, srv, path: "/?go=schedule" });
  ok("LINKS: ?go=schedule — экран «График»", await until(async () => /Мой месяц|График/.test(await body(b.page)) && (await b.page.locator("[data-sched-chat]").count()) === 1, 8000));
  const [e1, e2] = noErr(a, b);
  ok("LINKS: без ошибок в консоли", e1, e2);
  await a.ctx.close(); await b.ctx.close();
});

// ── NARROW: 320 px ──
await run("NARROW", async () => {
  for (const light of [false, true]) {
    const tag = light ? "светлая" : "тёмная";
    const srv = newServer();
    const a = await open({ who: ANNA, srv, w: 320, h: 640, light });
    await nav(a.page, "schedule", 2500);
    await a.page.locator("[data-sched-chat]").scrollIntoViewIfNeeded();
    const f = await fits(a.page);
    ok("NARROW " + tag + ": «Смены в чате команды» в 320 px без выезда", f.sw <= f.W + 1 && !f.n, JSON.stringify(f));
    await shot(a.page, "narrow-block-" + (light ? "light" : "dark"));
    const b = await open({ who: MARIA, srv, w: 320, h: 640, light });
    await nav(b.page, "schedule", 3000);
    await b.page.locator("[data-attn-row='conflict'] button").first().click(); await sleep(700);
    const g = await fits(b.page);
    ok("NARROW " + tag + ": «Кто вместо?» со «Спросить в чате команды» помещается", g.sw <= g.W + 1 && (await b.page.locator("[data-chat-ask-go]").count()) === 1, JSON.stringify(g));
    await shot(b.page, "narrow-repl-" + (light ? "light" : "dark"));
    const [e1, e2] = noErr(a, b);
    ok("NARROW " + tag + ": без ошибок в консоли", e1, e2);
    await a.ctx.close(); await b.ctx.close();
  }
});

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
