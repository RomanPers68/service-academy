// e2e v141 (Доп. 457–459): урок 7 менеджера «Админ на смене», гоу-лист в брифинге смены и его итог (этап 50), «Распорядок
// смены» и напоминание «Графика» по ТК РФ, ст. 103. Владелец (06.11): «Главное, чтобы это было дополнением к имеющемуся. И
// чтобы все функции приложения с этим взаимодействовали»; «Админ — это и есть менеджер». Сервер — демо в памяти (fake-server.js).
// Разделы: COMPOSE (Мария: блок «Гоу-лист», выбор из меню и «Барной карты», стоп не выбрать, поиск, три строки из карточки,
// «Подсказать фразы», «Линза», отправка: данные и текст Telegram), TEAM (Анна: превью карточки, брифинг, метка «гоу-лист» в
// меню и «Барной карте», Наставник знает гоу-лист), RESULT (итог за сегодня, «Записано», «· продано» у команды), AGAIN («Как
// вчера» с сервера, позиция в стопе не уходит, итог за вчера; без этапа 50 — с этого телефона), MORNING («Утро руководителя»:
// «итог не записан» → итог за вчера; записан — сколько продано), ROUTINE («Распорядок смены»: шаги отмечаются сами, каждый
// открывает свой экран; у официанта и в выходной карточки нет), SCHED («График»: следующий месяц пуст — строка ТК РФ, ст. 103,
// «Открыть ›»; составлен — строки нет; сотруднику — нет), LESSON (урок 7 в треке, сборка «Открытие смены», живой диалог),
// NOSTAGE (без этапа 50: брифинг с гоу-листом уходит, итог честно просит этап), LIGHT (светлая тема: экраны без ошибок).
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v141.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5341, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v141";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v127";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { normWine } = await import(SRC + "/lib/wine.js");
const { normSpirit } = await import(SRC + "/lib/spirit.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

const TZ = "Asia/Kamchatka";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const [TY, TM, TD] = TODAY.split("-").map(Number);
const DIM = new Date(TY, TM, 0).getDate();   // дней в этом месяце
const MONTHS_N = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const NEXT_N = MONTHS_N[TM % 12];
const R0 = "Два моря, Океан";
const P = (id, name, surname, position, x = {}) => ({ id, name, surname, restaurant: R0, position, is_admin: false, ...x });
const MARIA = P("u-maria", "Мария", "Ким", "manager"), ANNA = P("e-anna", "Анна", "Смирнова", "waiter"), PETR = P("e-petr", "Пётр", "Орлов", "waiter");
const PEOPLE = [MARIA, ANNA, PETR];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const tok = (p) => "tok-" + p.id;
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Смирнова Анна", pos: "waiter", norm: 160 }, { id: 3, name: "Орлов Пётр", pos: "waiter", norm: 160 }];
const CFG = { hours: Array.from({ length: 7 }, () => [12, 24]), shifts: SHIFTS, need: { 1: { waiter: 1 } }, split: {}, rules: { peakDows: [], highDows: [] }, staff: SSTAFF };
// график: по умолчанию — только этот месяц (следующий пуст); next — и следующий месяц
const planOf = ({ next = false, mariaOff = false } = {}) => {
  const o = {};
  for (let i = -(TD - 1); i <= (next ? DIM - TD + 31 : DIM - TD); i++) for (const sid of [1, 2, 3]) {
    if (sid === 1 && mariaOff && i === 0) continue;
    if (sid === 1 || (i + sid) % 2) (o[sid] = o[sid] || {})[i] = "Д";
  }
  return o;
};
const WINE = normWine({ name: "Пино Нуар", producer: "Louis Jadot", country: "Франция", region: "Бургундия", grapes: ["пино нуар"], color: "red", sweet: "сухое", byGlass: true, priceGlass: 1100,
  priceBottle: 6100, notes: ["вишня", "земля", "специи"], short: "Лёгкое красное: к тартару и птице.", pair: ["d1"] }, { id: "wn-1" });
const MENU = [
  { id: "d1", name: "Тартар из говядины", cat: "Закуски", desc: "Нежный, с лёгким дымком. Порция на одного.", pairing: "Пино нуар или лимонад с розмарином", ingredients: ["говядина", "желток", "каперсы"], price: 690 },
  { id: "d2", name: "Борщ с пампушками", cat: "Супы", desc: "Наваристый, на говяжьем бульоне.", stop: { at: Date.now() }, price: 450 },
  { id: "d3", name: "Сибас на гриле", cat: "Горячие блюда", desc: "Целый сибас с лимоном и травами. Отлично к белому вину.", pairing: "Совиньон блан", price: 1290 },
  WINE,
  normSpirit({ name: "Campari", producer: "Campari", cat: "bitter", style: "аперитив", country: "Италия", abv: 25, portion: 40, pricePortion: 400, serve: ["со льдом", "в коктейле"], glass: "рокс",
    notes: ["горький апельсин", "травы"], short: "Горький апельсин и травы: в «Негрони» или со льдом и содовой." }, { id: "sp-1" }),
  { id: "__barcard__", cocktails: ["negroni", "daiquiri", "aperol-spritz"] },
];
const GO_Y = [
  { id: "d1", name: "Тартар из говядины", kind: "dish", why: "Нежный, с дымком", pair: "Пино нуар", say: "Сегодня советую тартар: шеф сам коптит желток" },
  { id: "d2", name: "Борщ с пампушками", kind: "dish", why: "Наваристый", pair: "Пампушки с чесноком", say: "Борщ сегодня особенно хорош" },
  { id: "negroni", name: "Негрони", kind: "cocktail", why: "Горьковатый и честный", pair: "К закускам", say: "Аперитив графа Негрони" },
];
const srvOf = (x = {}) => {
  const pings = [];
  const yd = x.yday ? { "-1": { reads: [], author: "Мария Ким", data: { v: 1, day: "", on: { go: true }, blocks: { go: x.ydayGo || GO_Y } }, go_sold: x.ydaySold || null, go_by: x.ydaySold ? "Мария Ким" : null } } : {};
  const s = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: x.sstaff || SSTAFF, cfg: x.sstaff ? { ...CFG, staff: x.sstaff } : CFG, plan: x.plan || planOf(), menu: JSON.parse(JSON.stringify(MENU)),
    tgLinked: ["u-maria", "e-anna"], progress: { "e-anna": ["s0-1"] }, ping: (to, text, acts, chat, msg, o) => pings.push({ to, text, o }), push: () => {},
    briefDays: yd, checklists: x.checklists || {}, noStage50: !!x.noStage50 });
  if (x.yday) s.S.briefDays[s.D(-1)].data.day = s.D(-1);
  s.calls = []; s.pings = pings;
  return s;
};

const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra && !cond ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";

async function open({ who = ANNA, srv, light = false, extra = {}, ai = null }) {
  const UK = "_" + who.name + "_" + who.surname;
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU",
    timezoneId: TZ, reducedMotion: "reduce", userAgent: IPHONE, colorScheme: light ? "light" : "dark" });
  const aiCalls = [];
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\/ai-chat/.test(u)) {
      aiCalls.push(body);
      const last = String((body.messages || []).slice(-1)[0]?.content || "");
      const reply = ai ? ai(last) : "Хороший вопрос.";
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reply }) });
    }
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      srv.calls.push({ fn: m[1], body });
      const own = srv.rpc(m[1], body);
      return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own === undefined ? null : own) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: tok(who), sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify(who === MARIA ? "manager" : "seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_boot_missing: String(Date.now()), sa_hub_open: "all", ...extra };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1"; seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } }, seed);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(ORIGIN + "/", { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await sleep(900);
  return { ctx, page, errors, aiCalls };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const until = async (fn, ms = 9000, step = 250) => { const t0 = Date.now(); for (;;) { let v = false; try { v = await fn(); } catch (e) { v = false; } if (v || Date.now() - t0 > ms) return v; await sleep(step); } };
const noErr = (...xs) => [!xs.some((x) => x.errors.length), xs.flatMap((x) => x.errors).slice(0, 3).join(" | ")];
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String(e && e.message || e).split("\n")[0].slice(0, 200)); } };
const nav = async (page, s, ms = 1400) => { await page.evaluate((x) => window.__saNav && window.__saNav(x), s); await sleep(ms); };
const txt = async (loc) => ((await loc.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
const body = (page) => txt(page.locator("body"));
const last = (srv, fn) => [...srv.calls].reverse().find((c) => c.fn === fn) || null;
const into = (page, sel) => page.evaluate((q) => { const el = document.querySelector(q); if (el) el.scrollIntoView({ block: "center" }); }, sel);
const inView = (page, sel) => page.evaluate((q) => { const el = document.querySelector(q); if (!el) return false; const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }, sel);
// «Линза»: видимые кнопки и поля внутри блока без меток data-lens-* (вкладки в капсуле — линзу даёт капсула)
const lensMiss = (page, root) => page.evaluate((q) => [...document.querySelectorAll(q + " button, " + q + " input, " + q + " textarea")]
  .filter((e) => e.getClientRects().length && !e.matches("[data-lens-seg] > button") && !e.matches("[data-go-remove]") && e.getAttribute("role") !== "switch")   // выключатель блока — как у остальных блоков брифинга
  .filter((e) => ![...e.attributes].some((a) => a.name.startsWith("data-lens")))
  .map((e) => (e.getAttribute("aria-label") || e.innerText || e.tagName).trim().slice(0, 24)), root);
const steps = (page) => page.locator("[data-routine-step]").evaluateAll((els) => els.map((e) => e.getAttribute("data-routine-step") + ":" + e.getAttribute("data-done") + e.getAttribute("data-skip")).join(",")).catch(() => "");
const AI_GO = "Чем хорошо: Нежный, с дымком и каперсами\nС чем предложить: С бокалом пино нуар\nФраза гостю: Советую тартар, шеф сам коптит желток\n[[go:menu|Меню]]";

// Мария собирает гоу-лист из меню и отправляет брифинг; помощник — для TEAM и RESULT
const compose = async (o, srv, { ai = true } = {}) => {
  const before = srv.calls.filter((c) => c.fn === "brief_publish").length;
  await nav(o.page, "brief", 2600);
  await o.page.locator("[data-go-add]").click(); await sleep(700);
  await o.page.locator('[data-go-opt="d1"]').click(); await sleep(250);
  await o.page.locator('[data-go-tab="cocktail"]').click(); await sleep(400);
  await o.page.locator('[data-go-opt="negroni"]').click(); await sleep(250);
  await o.page.locator("[data-go-done]").click(); await sleep(600);
  if (ai) { await o.page.locator('[data-go-ai="d1"]').click(); await until(async () => /каперсами/.test(await o.page.locator('[data-go-edit="d1"] [data-go-field="why"]').inputValue()), 6000); }
  await o.page.locator("[data-brief-publish]").click();
  await until(() => srv.calls.filter((c) => c.fn === "brief_publish").length > before, 6000); await sleep(900);
};

await run("COMPOSE", async () => {
  const srv = srvOf();
  const o = await open({ who: MARIA, srv, ai: (q) => (/Гоу-лист смены ресторана/.test(q) ? AI_GO : "Хороший вопрос.") });
  await nav(o.page, "brief", 2600);
  const blk = o.page.locator('[data-brief-block="go"]');
  ok("COMPOSE: в брифинге блок «Гоу-лист» после «Новинок меню», кнопка «Выбрать из меню»", (await blk.count()) === 1 && /Выбрать из меню/.test(await txt(o.page.locator("[data-go-add]")))
    && (await o.page.locator("[data-brief-block]").evaluateAll((els) => { const k = els.map((e) => e.getAttribute("data-brief-block")); return k.indexOf("go") > (k.includes("fresh") ? k.indexOf("fresh") : k.indexOf("stop")); })));
  ok("COMPOSE: «Как вчера» нет (вчера гоу-листа не было)", (await o.page.locator("[data-go-again]").count()) === 0);
  await o.page.locator("[data-go-add]").click(); await sleep(700);
  const tabs = await o.page.locator("[data-go-tab]").evaluateAll((els) => els.map((e) => e.getAttribute("data-go-tab")).join(","));
  ok("COMPOSE: выбор — вкладки «Блюда», «Коктейли», «Вина», «Крепкое»", tabs === "dish,cocktail,wine,spirit", tabs);
  ok("COMPOSE: борщ в стопе — выбрать нельзя", (await o.page.locator('[data-go-opt="d2"]').isDisabled()) && /стоп/i.test(await txt(o.page.locator('[data-go-opt="d2"]'))), await txt(o.page.locator('[data-go-opt="d2"]')));
  await o.page.locator("[data-go-search]").fill("тар"); await sleep(400);
  ok("COMPOSE: поиск «тар» — только тартар", (await o.page.locator("[data-go-opt]").evaluateAll((els) => els.map((e) => e.getAttribute("data-go-opt")).join(","))) === "d1");
  await o.page.locator('[data-go-opt="d1"]').click(); await sleep(250);
  await o.page.locator("[data-go-search]").fill(""); await sleep(200);
  await o.page.locator('[data-go-tab="cocktail"]').click(); await sleep(400);
  const ck = await o.page.locator("[data-go-opt]").evaluateAll((els) => els.map((e) => e.getAttribute("data-go-opt")).join(","));
  ok("COMPOSE: «Коктейли» — классика из «Барной карты» (негрони, дайкири, апероль)", ck === "negroni,daiquiri,aperol-spritz", ck);
  await o.page.locator('[data-go-opt="negroni"]').click(); await sleep(250);
  ok("COMPOSE: счётчик «2 из 3»", /2 из 3/.test(await txt(o.page.locator("[data-go-count]"))));
  const missP = await lensMiss(o.page, "[data-go-picker]");
  ok("COMPOSE: «Линза» — в выборе у кнопок, поиска и вкладок метки", !missP.length, JSON.stringify(missP));
  await shot(o.page, "compose-picker");
  await o.page.locator("[data-go-done]").click(); await sleep(600);
  const why = await o.page.locator('[data-go-edit="d1"] [data-go-field="why"]').inputValue(), pair = await o.page.locator('[data-go-edit="d1"] [data-go-field="pair"]').inputValue();
  const say = await o.page.locator('[data-go-edit="negroni"] [data-go-field="say"]').inputValue();
  ok("COMPOSE: три строки из карточки: у тартара «чем хорошо» и «с чем», у негрони — фраза гостю", why === "Нежный, с лёгким дымком" && pair === "Пино нуар или лимонад с розмарином" && /итальянский граф/.test(say), JSON.stringify([why, pair, say]));
  await o.page.locator('[data-go-ai="d1"]').click();
  const aiOk = await until(async () => /каперсами/.test(await o.page.locator('[data-go-edit="d1"] [data-go-field="why"]').inputValue()), 6000);
  const q = o.aiCalls.length ? String(o.aiCalls[o.aiCalls.length - 1].messages.slice(-1)[0].content) : "";
  ok("COMPOSE: «Подсказать фразы»: вопрос по карточке, три строки заменились ответом Наставника", aiOk && /Гоу-лист смены ресторана «Два моря, Океан»: блюдо «Тартар из говядины»\. Из карточки: Нежный, с лёгким дымком/.test(q)
    && (await o.page.locator('[data-go-edit="d1"] [data-go-field="say"]').inputValue()) === "Советую тартар, шеф сам коптит желток", q.slice(0, 160));
  const missE = await lensMiss(o.page, '[data-brief-block="go"]');
  ok("COMPOSE: «Линза» — в блоке у полей и кнопок метки", !missE.length, JSON.stringify(missE));
  await into(o.page, '[data-brief-block="go"]'); await shot(o.page, "compose-block");
  await o.page.locator("[data-brief-publish]").click();
  await until(() => last(srv, "brief_publish"), 6000); await sleep(800);
  const pb = last(srv, "brief_publish");
  const d = pb && pb.body.p_data;
  ok("COMPOSE: отправлен: on.go, две позиции с тремя строками", d && d.on.go === true && d.blocks.go.map((g) => g.id).join(",") === "d1,negroni" && d.blocks.go[0].pair === "С бокалом пино нуар", JSON.stringify(d && d.blocks.go).slice(0, 200));
  const tg = pb ? String(pb.body.p_text) : "";
  ok("COMPOSE: текст Telegram: «Гоу-лист:» с позициями по строкам", tg.includes("Гоу-лист:\n1. Тартар из говядины. Чем хорошо: Нежный, с дымком и каперсами. С чем предложить: С бокалом пино нуар. Фраза гостю: «Советую тартар, шеф сам коптит желток»\n2. Негрони. Чем хорошо: Три равные части, горьковатый и честный. С чем предложить:"), tg.slice(tg.indexOf("Гоу-лист"), tg.indexOf("Гоу-лист") + 220));
  ok("COMPOSE: под брифингом — «Итог гоу-листа» за сегодня", !!(await until(() => o.page.locator(`[data-go-result="${TODAY}"]`).count(), 5000)));
  const [e1, e2] = noErr(o); ok("COMPOSE: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("TEAM", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv, ai: () => AI_GO });
  await compose(m, srv);
  await m.ctx.close();
  const o = await open({ who: ANNA, srv, ai: (q) => "Начните с тартара: шеф коптит желток.\n[[go:menu|Открыть меню]]" });
  await nav(o.page, "shift", 2400);
  const pv = await txt(o.page.locator("[data-brief-preview]"));
  ok("TEAM: Анна — карточка брифинга: «гоу-лист: Тартар из говядины, Негрони»", /гоу-лист: Тартар из говядины, Негрони/.test(pv), pv);
  await o.page.locator("[data-brief-card]").click(); await sleep(1400);
  const gb = await txt(o.page.locator('[data-brief-block="go"]'));
  ok("TEAM: в брифинге — «Гоу-лист»: позиции, «Чем хорошо», «С чем предложить», фраза гостю", /Тартар из говядины/.test(gb) && /Чем хорошо/.test(gb) && /С чем предложить/.test(gb) && /«Советую тартар, шеф сам коптит желток»/.test(gb), gb.slice(0, 200));
  await into(o.page, '[data-brief-block="go"]'); await shot(o.page, "team-brief");
  await o.page.locator('[data-brief-view] [aria-label="Закрыть"]').click().catch(() => {}); await sleep(400);
  await nav(o.page, "menuTrainer", 2000);
  await o.page.getByText("Колода меню").first().click().catch(() => {}); await sleep(1600);
  await until(() => o.page.locator("[data-go-badge]").count(), 4000);
  const badges = await o.page.locator("[data-go-badge]").count();
  ok("TEAM: в меню — метка «гоу-лист» (тартар)", badges >= 1 && /гоу-лист/i.test(await txt(o.page.locator("[data-go-badge]").first())), "меток: " + badges);
  await shot(o.page, "team-menu");
  await nav(o.page, "reference", 400); await nav(o.page, "wines", 2200);
  await o.page.locator('[data-bar-tab="cocktail"]').click().catch(() => {}); await sleep(900);
  ok("TEAM: «Барная карта» → «Коктейли»: у негрони метка «гоу-лист»", !!(await until(() => o.page.locator("[data-go-badge]").count(), 4000)));
  await shot(o.page, "team-bar");
  await nav(o.page, "assistant", 1600);
  await o.page.locator(".sa-layer textarea").fill("Что посоветовать гостю на ужин?");
  await o.page.locator('.sa-layer button:has(path[d="M22 2L11 13"])').click();
  await until(() => o.aiCalls.length, 8000); await sleep(1000);
  const sent = o.aiCalls.length ? String(o.aiCalls[o.aiCalls.length - 1].messages.slice(-1)[0].content) : "";
  ok("TEAM: Наставник знает гоу-лист дня, когда спрашивают, что посоветовать (строкой, с фразами гостю)", sent.includes("[Гоу-лист смены на сегодня: Тартар из говядины (фраза гостю: «Советую тартар, шеф сам коптит желток»); Негрони (фраза гостю: «Аперитив, который открыл сто лет назад итальянский граф»). Советуя гостю, начни с него.]")
    && sent.length <= 2100, sent.length + " " + (sent.includes("Гоу-лист") ? sent.slice(sent.indexOf("Гоу-лист") - 10, sent.indexOf("Гоу-лист") + 300) : sent.slice(-500)));
  const [e1, e2] = noErr(o); ok("TEAM: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("RESULT", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv, ai: () => AI_GO });
  await compose(m, srv, { ai: false });
  const res = m.page.locator(`[data-go-result="${TODAY}"]`);
  await into(m.page, `[data-go-result="${TODAY}"]`);
  ok("RESULT: «Итог гоу-листа · сегодня»: поле на каждую позицию, «Записать итог» пока недоступна", (await res.locator("[data-go-sold-input]").count()) === 2 && (await res.locator("[data-go-save]").isDisabled()));
  await res.locator('[data-go-sold-input="d1"]').fill("12абв"); await sleep(150);
  ok("RESULT: в поле только цифры", (await res.locator('[data-go-sold-input="d1"]').inputValue()) === "12");
  await res.locator('[data-go-sold-input="negroni"]').fill("7");
  await res.locator("[data-go-save]").click();
  await until(() => last(srv, "brief_go_save"), 5000); await sleep(900);
  const sv = last(srv, "brief_go_save");
  ok("RESULT: brief_go_save: сегодня, { d1: 12, negroni: 7 }", sv && sv.body.p_day === TODAY && JSON.stringify(sv.body.p_sold) === '{"d1":12,"negroni":7}', JSON.stringify(sv && sv.body));
  const saved = await txt(m.page.locator(`[data-go-result="${TODAY}"] [data-go-saved]`));
  ok("RESULT: «Записано в …· Мария Ким: Тартар из говядины: 12 · Негрони: 7», кнопка — «Обновить итог»", /^Записано в \d\d:\d\d · Мария Ким: Тартар из говядины: 12 · Негрони: 7$/.test(saved)
    && /Обновить итог/.test(await txt(m.page.locator(`[data-go-result="${TODAY}"] [data-go-save]`))), saved);
  await into(m.page, `[data-go-result="${TODAY}"]`); await shot(m.page, "result-saved");
  const [e1, e2] = noErr(m); ok("RESULT: без ошибок у Марии", e1, e2);
  await m.ctx.close();
  const o = await open({ who: ANNA, srv });
  await nav(o.page, "shift", 2400);
  await o.page.locator("[data-brief-card]").click(); await sleep(1600);
  ok("RESULT: Анна в брифинге видит «· продано 12» и «· продано 7»", /продано 12/.test(await txt(o.page.locator('[data-go-sold="d1"]'))) && /продано 7/.test(await txt(o.page.locator('[data-go-sold="negroni"]'))));
  ok("RESULT: Анна итог не записывает (сервер — forbidden)", srv.rpc("brief_go_save", { p_token: tok(ANNA), p_day: TODAY, p_sold: { d1: 1 } }).error === "forbidden");
  const [e3, e4] = noErr(o); ok("RESULT: без ошибок у Анны", e3, e4);
  await o.ctx.close();
});

await run("AGAIN", async () => {
  const srv = srvOf({ yday: true });
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "brief", 2600);
  const again = m.page.locator("[data-go-again]");
  ok("AGAIN: «Как вчера» — с сервера (этап 50, вчерашний брифинг)", /^Как вчера$/.test(await txt(again)) && srv.calls.some((c) => c.fn === "brief_go_get" && c.body.p_day === srv.D(-1)));
  await again.click(); await sleep(600);
  ok("AGAIN: три позиции вчерашнего, борщ — «В стопе: в брифинг не уйдёт»", (await m.page.locator("[data-go-edit]").count()) === 3 && /В стопе: в брифинг не уйдёт/.test(await txt(m.page.locator('[data-go-stop="d2"]'))));
  await into(m.page, '[data-brief-block="go"]'); await shot(m.page, "again-stop");
  const yres = m.page.locator(`[data-go-result="${srv.D(-1)}"]`);
  ok("AGAIN: «Итог гоу-листа · вчера» — ещё не записан", (await yres.count()) === 1 && /вчера/.test(await txt(yres)) && (await yres.locator("[data-go-sold-input]").count()) === 3);
  await m.page.locator("[data-brief-publish]").click();
  await until(() => last(srv, "brief_publish"), 6000); await sleep(700);
  const d = last(srv, "brief_publish").body.p_data;
  ok("AGAIN: в брифинг ушли тартар и негрони, борщ (в стопе) — нет", d.blocks.go.map((g) => g.id).join(",") === "d1,negroni", d.blocks.go.map((g) => g.id).join(","));
  await yres.locator('[data-go-sold-input="d1"]').fill("10"); await yres.locator('[data-go-sold-input="negroni"]').fill("4");
  await yres.locator("[data-go-save]").click();
  await until(() => last(srv, "brief_go_save"), 5000); await sleep(900);
  ok("AGAIN: итог за вчера: p_day — вчера; карточка осталась с «Записано»", last(srv, "brief_go_save").body.p_day === srv.D(-1)
    && /Записано/.test(await txt(m.page.locator(`[data-go-result="${srv.D(-1)}"] [data-go-saved]`))));
  const [e1, e2] = noErr(m); ok("AGAIN: без ошибок", e1, e2);
  await m.ctx.close();
  // без этапа 50: «Как вчера» — последний гоу-лист, отправленный с этого телефона
  const s2 = srvOf({ noStage50: true });
  const yd = s2.D(-1);
  const m2 = await open({ who: MARIA, srv: s2, extra: { sa_go_last: JSON.stringify({ [R0]: { day: yd, items: [GO_Y[0]] } }) } });
  await nav(m2.page, "brief", 2600);
  ok("AGAIN: без этапа 50 — «Как вчера» с этого телефона", /^Как вчера$/.test(await txt(m2.page.locator("[data-go-again]"))));
  const [e3, e4] = noErr(m2); ok("AGAIN: без этапа 50 — без ошибок", e3, e4);
  await m2.ctx.close();
});

await run("MORNING", async () => {
  const srv = srvOf({ yday: true, ydayGo: [GO_Y[0], GO_Y[2]] });
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "morning", 2800);
  const row = m.page.locator('[data-mo-row="go"]');
  const t = await txt(row);
  ok("MORNING: «Вчера» — «Гоу-лист: итог не записан», позиции и «отчёт iiko по блюдам»", (await row.getAttribute("data-mo-kind")) === "warn" && /Гоу-лист: итог не записан/.test(t) && /Тартар из говядины, Негрони/.test(t) && /отчёте iiko по блюдам/.test(t), t);
  await into(m.page, '[data-mo-row="go"]'); await shot(m.page, "morning-warn");
  await row.click(); await sleep(2600);
  const sel = `[data-go-result="${srv.D(-1)}"]`;
  ok("MORNING: касание — брифинг, «Итог гоу-листа · вчера» на экране", (await m.page.locator(sel).count()) === 1 && !!(await until(() => inView(m.page, sel), 3000)));
  await m.page.locator(sel + ' [data-go-sold-input="d1"]').fill("9"); await m.page.locator(sel + ' [data-go-sold-input="negroni"]').fill("5");
  await m.page.locator(sel + " [data-go-save]").click(); await sleep(1200);
  await nav(m.page, "morning", 2600);
  const t2 = await txt(m.page.locator('[data-mo-row="go"]'));
  ok("MORNING: записан — «Гоу-лист: Тартар из говядины: 9 · Негрони: 5», «Записал(а): Мария Ким»", (await m.page.locator('[data-mo-row="go"]').getAttribute("data-mo-kind")) === "ok"
    && /Гоу-лист: Тартар из говядины: 9 · Негрони: 5/.test(t2) && /Записал\(а\): Мария Ким/.test(t2), t2);
  const [e1, e2] = noErr(m); ok("MORNING: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("ROUTINE", async () => {
  const T9 = TODAY + "T09:05:00+12:00";
  const srv = srvOf({ checklists: { 0: { open: { checked: ["o1", "o2", "o3", "o4", "o5", "o6"], done_at: T9, by_name: "Мария К." } } } });
  const m = await open({ who: MARIA, srv, ai: () => AI_GO });
  await nav(m.page, "shift", 2600);
  const card = m.page.locator("[data-routine]");
  ok("ROUTINE: у Марии в «Смене» — «Распорядок смены»: открытие сделано, итог пропущен (гоу-листа нет)", (await card.count()) === 1 && (await steps(m.page)) === "open:10,brief:00,close:00,go:01", await steps(m.page));
  ok("ROUTINE: подписи: «готово в 09:05», «не отправлен», «не начат», «нет гоу-листа»; «Дальше: брифинг с гоу-листом»",
    (await m.page.locator("[data-routine-sub]").evaluateAll((els) => els.map((e) => e.innerText).join("|"))) === "готово в 09:05|не отправлен|не начат|нет гоу-листа"
    && /Дальше: брифинг с гоу-листом/.test(await txt(m.page.locator("[data-routine-next]"))), await m.page.locator("[data-routine-sub]").evaluateAll((els) => els.map((e) => e.innerText).join("|")));
  const missR = await lensMiss(m.page, "[data-routine]");
  ok("ROUTINE: карточка — линза (data-lens-card), кружки — кнопки с подписью для диктора", (await m.page.locator("[data-routine][data-lens-card]").count()) === 1
    && /Открытие: сделано, готово в 09:05/.test(await m.page.locator('[data-routine-step="open"]').getAttribute("aria-label")), JSON.stringify(missR));
  await into(m.page, "[data-routine]"); await shot(m.page, "routine-start");
  await m.page.locator('[data-routine-step="close"]').click(); await sleep(1600);
  let t = await body(m.page);
  ok("ROUTINE: «Закрытие» — чек-листы на закрытии", /Касса сведена/.test(t) && !/Свет, музыка, климат включены/.test(t));
  await nav(m.page, "shift", 1600);
  await m.page.locator('[data-routine-step="open"]').click(); await sleep(1600);
  t = await body(m.page);
  ok("ROUTINE: «Открытие» — чек-листы на открытии", /Свет, музыка, климат включены/.test(t));
  await nav(m.page, "shift", 1600);
  await m.page.locator("[data-routine-next]").click(); await sleep(2400);
  ok("ROUTINE: «Дальше» — экран брифинга", (await m.page.locator('[data-brief-block="go"]').count()) === 1);
  await compose(m, srv, { ai: false });
  await nav(m.page, "shift", 2400);
  ok("ROUTINE: брифинг с гоу-листом — отмечен сам; «гоу-лист: 2»; «Дальше: чек-лист закрытия»", (await steps(m.page)) === "open:10,brief:10,close:00,go:00"
    && /гоу-лист: 2/.test(await txt(m.page.locator('[data-routine-sub="brief"]'))) && /Дальше: чек-лист закрытия/.test(await txt(m.page.locator("[data-routine-next]"))), await steps(m.page));
  srv.rpc("checklist_check", { p_token: tok(MARIA), p_day: TODAY, p_kind: "close", p_checked: ["c1", "c2", "c3", "c4", "c5", "c6"], p_total: 6 });
  await nav(m.page, "home", 600); await nav(m.page, "shift", 2400);
  ok("ROUTINE: закрытие отмечено; «Дальше: итог гоу-листа»", (await steps(m.page)) === "open:10,brief:10,close:10,go:00" && /Дальше: итог гоу-листа/.test(await txt(m.page.locator("[data-routine-next]"))), await steps(m.page));
  await m.page.locator('[data-routine-step="go"]').click(); await sleep(2600);
  const sel = `[data-go-result="${TODAY}"]`;
  ok("ROUTINE: «Итог» — брифинг, «Итог гоу-листа» на экране", !!(await until(() => inView(m.page, sel), 3000)));
  await m.page.locator(sel + ' [data-go-sold-input="d1"]').fill("3"); await m.page.locator(sel + ' [data-go-sold-input="negroni"]').fill("2");
  await m.page.locator(sel + " [data-go-save]").click(); await sleep(1200);
  await nav(m.page, "shift", 2400);
  ok("ROUTINE: все шаги сделаны: «Все шаги распорядка на сегодня сделаны»", (await steps(m.page)) === "open:10,brief:10,close:10,go:10" && /Все шаги распорядка на сегодня сделаны/.test(await txt(m.page.locator("[data-routine-next]"))), await steps(m.page));
  await into(m.page, "[data-routine]"); await shot(m.page, "routine-done");
  const [e1, e2] = noErr(m); ok("ROUTINE: без ошибок", e1, e2);
  await m.ctx.close();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "shift", 2200);
  ok("ROUTINE: у официанта карточки нет", (await a.page.locator("[data-routine]").count()) === 0);
  await a.ctx.close();
  // выходной: Марии нет в графике сегодня (сводка экрана графика — «выходной»)
  const s2 = srvOf({ sstaff: SSTAFF.slice(1), plan: planOf() });
  const off = await open({ who: MARIA, srv: s2, extra: { sa_today_shift: JSON.stringify({ date: TODAY, label: "выходной" }) } });
  await nav(off.page, "shift", 2200);
  ok("ROUTINE: в выходной у руководителя карточки нет", (await off.page.locator("[data-routine]").count()) === 0);
  await off.ctx.close();
});

await run("SCHED", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "schedule", 3200);
  const row = m.page.locator('[data-attn-row="tk103"]');
  await until(() => row.count(), 5000);
  const t = await txt(row);
  ok("SCHED: следующий месяц пуст — «" + NEXT_N + " пока пустой», ТК РФ, ст. 103, «Открыть ›»", new RegExp("^" + NEXT_N + " пока пустой ТК РФ, ст\\. 103: график сменности доводят до сотрудников не позже чем за месяц до начала Открыть ›$").test(t), t);
  ok("SCHED: следующий месяц запрошен тихо (schedule_load за него)", srv.calls.some((c) => c.fn === "schedule_load" && c.body.p_month === (TM === 12 ? (TY + 1) + "-01" : TY + "-" + String(TM + 1).padStart(2, "0"))));
  ok("SCHED: строки «На ближайшие 7 дней всё закрыто» при этом нет", (await m.page.locator('[data-attn-row="calm"]').count()) === 0);
  await into(m.page, '[data-attn-row="tk103"]'); await shot(m.page, "sched-tk103");
  await row.locator("[data-attn-next]").click(); await sleep(2400);
  ok("SCHED: «Открыть ›» — следующий месяц в шапке, строки больше нет", new RegExp(NEXT_N + " \\d{4}").test(await body(m.page)) && (await m.page.locator('[data-attn-row="tk103"]').count()) === 0);
  const [e1, e2] = noErr(m); ok("SCHED: без ошибок", e1, e2);
  await m.ctx.close();
  const s2 = srvOf({ plan: planOf({ next: true }) });
  const m2 = await open({ who: MARIA, srv: s2 });
  await nav(m2.page, "schedule", 3200); await sleep(1200);
  ok("SCHED: следующий месяц составлен — строки нет", (await m2.page.locator("[data-attn]").count()) === 1 && (await m2.page.locator('[data-attn-row="tk103"]').count()) === 0);
  await m2.ctx.close();
  const a = await open({ who: ANNA, srv });
  await nav(a.page, "schedule", 3000);
  ok("SCHED: у сотрудника строки нет", (await a.page.locator('[data-attn-row="tk103"]').count()) === 0);
  await a.ctx.close();
});

await run("LESSON", async () => {
  const srv = srvOf();
  const m = await open({ who: MARIA, srv });
  await nav(m.page, "home", 2200);
  const tp = await m.page.evaluate(() => [...document.querySelectorAll(".tbp-num")].map((e) => e.getAttribute("aria-label") || ""));
  ok("LESSON: у Марии («Менеджер») последняя тема — «Админ на смене: от открытия до планёрки»", /Админ на смене/.test(tp[tp.length - 1] || ""), tp.length + " · " + (tp[tp.length - 1] || ""));
  await nav(m.page, "search", 1200);
  await m.page.locator("input").first().fill("Гоу-лист: что смена"); await sleep(900);
  const les = m.page.locator(".sa-card").filter({ hasText: "Гоу-лист: что смена продаёт сегодня" }).first();
  ok("LESSON: поиск находит урок «Гоу-лист: что смена продаёт сегодня»", (await les.count()) === 1);
  await les.click(); await sleep(1800);
  const t = await body(m.page);
  ok("LESSON: урок открыт (листается): «две-три позиции», «Что ставим в гоу-лист»", /две-три позиции/.test(t) && /Что ставим в гоу-лист/.test(t));
  await shot(m.page, "lesson-golist");
  const [e1, e2] = noErr(m); ok("LESSON: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("NOSTAGE", async () => {
  const srv = srvOf({ noStage50: true, yday: true });
  const m = await open({ who: MARIA, srv, ai: () => AI_GO });
  await compose(m, srv, { ai: false });
  ok("NOSTAGE: брифинг с гоу-листом ушёл и без этапа 50", !!last(srv, "brief_publish") && last(srv, "brief_publish").body.p_data.on.go === true);
  ok("NOSTAGE: «Итог гоу-листа» за сегодня есть (вчерашнего с сервера нет)", (await m.page.locator(`[data-go-result="${TODAY}"]`).count()) === 1 && (await m.page.locator(`[data-go-result="${srv.D(-1)}"]`).count()) === 0);
  const sel = `[data-go-result="${TODAY}"]`;
  await m.page.locator(sel + ' [data-go-sold-input="d1"]').fill("3"); await m.page.locator(sel + " [data-go-save]").click(); await sleep(1200);
  ok("NOSTAGE: «Записать итог» — «На сервере ещё нет этапа 50 …»", /На сервере ещё нет этапа 50 \(supabase-stage50-golist\.sql\)/.test(await txt(m.page.locator(sel))));
  await nav(m.page, "morning", 2600);
  ok("NOSTAGE: в «Утре» строки гоу-листа нет", (await m.page.locator('[data-mo-row="go"]').count()) === 0);
  await nav(m.page, "shift", 2400);
  ok("NOSTAGE: «Распорядок»: брифинг отмечен, итог не записан", /^open:00,brief:10,close:00,go:00$/.test(await steps(m.page)), await steps(m.page));
  const [e1, e2] = noErr(m); ok("NOSTAGE: без ошибок", e1, e2);
  await m.ctx.close();
});

await run("LIGHT", async () => {
  const srv = srvOf({ yday: true });
  const m = await open({ who: MARIA, srv, light: true, ai: () => AI_GO });
  await nav(m.page, "shift", 2400);
  await into(m.page, "[data-routine]"); await shot(m.page, "light-routine");
  await nav(m.page, "brief", 2600);
  await m.page.locator("[data-go-again]").click(); await sleep(500);
  await into(m.page, '[data-go-stop="d2"]'); await shot(m.page, "light-golist");
  await m.page.locator('[data-go-remove="d2"]').click().catch(() => {}); await sleep(300);   // три из трёх: борщ в стопе — убрать, тогда выбор откроется
  await m.page.locator("[data-go-add]").click().catch(() => {}); await sleep(700);
  await shot(m.page, "light-picker");
  const bg = await m.page.evaluate(() => { const el = document.querySelector("[data-go-picker]"); return el ? getComputedStyle(el).backgroundColor : ""; });
  ok("LIGHT: выбор из меню — светлый фон", /^rgb\((2[0-5]\d), (2[0-5]\d|1[89]\d), (1[5-9]\d|2\d\d)\)$/.test(bg), bg);
  await m.page.locator("[data-go-done]").click().catch(() => {}); await sleep(400);
  await nav(m.page, "schedule", 3000); await into(m.page, '[data-attn-row="tk103"]'); await shot(m.page, "light-sched");
  const [e1, e2] = noErr(m); ok("LIGHT: экраны без ошибок", e1, e2);
  await m.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} ✓, ${bad} ✗`);
process.exit(bad ? 1 : 0);
