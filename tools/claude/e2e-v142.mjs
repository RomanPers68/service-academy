// e2e v142 (Доп. 460–461): тема «Приём и хранение: ЕГАИС, «Честный знак», марки» у бара (Урок 7) и у менеджера (Урок 8) — по
// «Стандартам холдинга», модуль 17. Владелец (07.11): «Ок» на предложение. Сервер — демо в памяти (fake-server.js).
// Разделы: BAR (трек «Бар»: тема восьмой, значок приложения, урок «Приёмка» — термины ЕГАИС и ТТН из глоссария, урок
// «Хранение» с «В приложении»), BUILD («Сборка: приёмка поставки»: пять стадий, верный путь), DIALOG (живой диалог «Экспедитор
// торопит»: верный путь — Олег доволен; худший — «Олег уехал»), MANAGER (трек «Менеджер»: тема девятой, урок «Контроль» —
// журнал по стандарту), CARD («Барная карта»: «Хранение» у вина, игристого, креплёного, ликёра и крепкого), CHECK («Чек-листы»:
// новые пункты в «Открытии» и «Закрытии», семь из семи — готово), MORNING («Утро руководителя»: что вчера не отмечено), MENTOR
// (Наставник: к вопросу о приёмке — стандарт холдинга, к вопросу о вине к блюду — нет), LIGHT (светлая тема: урок, карточка, утро).
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v142.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5342, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v142";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v127";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { DIALOGUES_DATA } = await import(SRC + "/data/dialogues.js");
const { normWine } = await import(SRC + "/lib/wine.js");
const { normSpirit } = await import(SRC + "/lib/spirit.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp", ".css": "text/css" };
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
const R0 = "Два моря, Океан";
const P = (id, name, surname, position, x = {}) => ({ id, name, surname, restaurant: R0, position, is_admin: false, ...x });
const MARIA = P("u-maria", "Мария", "Ким", "manager"), ANNA = P("e-anna", "Анна", "Смирнова", "waiter"), PETR = P("e-petr", "Пётр", "Орлов", "bartender");
const PEOPLE = [MARIA, ANNA, PETR];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const tok = (p) => "tok-" + p.id;
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Смирнова Анна", pos: "waiter", norm: 160 }, { id: 3, name: "Орлов Пётр", pos: "bartender", norm: 160 }];
const CFG = { hours: Array.from({ length: 7 }, () => [12, 24]), shifts: SHIFTS, need: { 1: { waiter: 1 } }, split: {}, rules: { peakDows: [], highDows: [] }, staff: SSTAFF };
const plan = () => { const o = {}; for (let i = -3; i <= 20; i++) for (const sid of [1, 2, 3]) if (sid === 1 || (i + sid) % 2) (o[sid] = o[sid] || {})[i] = "Д"; return o; };
const W = (id, x) => normWine({ producer: "Дом", country: "Италия", sweet: "сухое", priceBottle: 5000, ...x }, { id });
const MENU = [
  { id: "d1", name: "Тартар из говядины", cat: "Закуски", desc: "Нежный, с лёгким дымком.", price: 690 },
  W("wn-red", { name: "Пино Нуар", color: "red", byGlass: true, priceGlass: 1100 }),
  W("wn-spark", { name: "Просекко", color: "sparkling", sweet: "брют", byGlass: true, priceGlass: 900 }),
  W("wn-port", { name: "Порто Тони", color: "fortified", sweet: "сладкое" }),
  normSpirit({ name: "Campari", cat: "bitter", country: "Италия", abv: 25, portion: 40, pricePortion: 400 }, { id: "sp-bit" }),
  normSpirit({ name: "Амаретто", cat: "liqueur", country: "Италия", abv: 28, portion: 40, pricePortion: 380 }, { id: "sp-liq" }),
  { id: "__barcard__", cocktails: ["negroni"] },
];
const srvOf = (x = {}) => {
  const s = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: plan(), menu: JSON.parse(JSON.stringify(MENU)), tgLinked: ["u-maria"],
    push: () => {}, ping: () => {}, checklists: x.checklists || {} });
  s.calls = [];
  return s;
};

const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra && !cond ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";

async function open({ who = ANNA, srv, light = false, role = "seasonal", ai = null }) {
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
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reply: ai ? ai(last) : "Хороший вопрос." }) });
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
    sa_session_token: tok(who), sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify(role), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_boot_missing: String(Date.now()), sa_hub_open: "all" };
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
const topics = (page) => page.evaluate(() => [...document.querySelectorAll(".tbp-num")].map((e) => e.getAttribute("aria-label") || ""));
const TOPIC = "Приём и хранение";
// урок трека: главная → номер темы (по названию) → шаг в меню темы (как в e2e-v140)
async function toLesson(page, topic, lesson) {
  await nav(page, "home", 1500);
  await page.locator('.tbp-num[aria-label*="' + topic + '"]').first().click({ timeout: 6000 });
  await sleep(900);
  await page.locator(".tbm-node:not(.tbp-side *)", { hasText: lesson }).first().click({ timeout: 6000 });
  await sleep(1300);
}
const feed = (page) => page.evaluate(() => { const b = document.querySelector('[aria-label="Читать лентой"]'); if (b) b.click(); });
const dotted = (page, term) => page.evaluate((term) => [...document.querySelectorAll("span")].some((s) => s.textContent.trim().toLowerCase() === term.toLowerCase()
  && getComputedStyle(s).borderBottomStyle === "dotted"), term);
const dlgId = (page) => page.evaluate(() => { const d = document.querySelector(".sa-dlg[data-dlg]"); return d ? d.getAttribute("data-dlg") : null; });
async function playDialogue(page, how) {
  const id = await dlgId(page);
  const D = DIALOGUES_DATA.find((d) => d.id === id);
  if (!D) return { id, err: "сценарий не найден: " + id };
  await page.evaluate(() => { window.__tap = setInterval(() => { const c = document.querySelector(".dc-chat"); if (c) c.click(); }, 120); });
  for (let n = 0; n < 40; n++) {
    await page.waitForSelector("[data-dlg-reply]:not([disabled]), [data-dlg-next]", { timeout: 25000 });
    if (await page.locator("[data-dlg-next]").count()) break;
    await sleep(150);
    const idx = Number(await page.getAttribute("[data-dlg-kb]", "data-dlg-kb"));
    const o = how(D.steps[idx]);
    const texts = await page.evaluate(() => [...document.querySelectorAll("[data-dlg-reply] .dc-opt-t")].map((e) => e.textContent));
    await page.locator(`[data-dlg-reply="${texts.indexOf(o.text)}"]`).click();
  }
  await page.waitForSelector("[data-dlg-next]", { timeout: 25000 });
  await page.evaluate(() => clearInterval(window.__tap));
  await sleep(700);
  return { id, ...(await page.evaluate(() => {
    const rv = document.querySelector("[data-dlg-review]");
    return { review: rv ? rv.getAttribute("data-dlg-review") : null, title: rv ? (rv.querySelector(".dc-rv-t") || {}).textContent : null, walk: !!document.querySelector("[data-dlg-msg=walk]") };
  })) };
}
const right = (step) => step.options.find((o) => o.correct);
const worst = (step) => step.options.filter((o) => !o.correct).sort((a, b) => (Number(a.moodDelta) || 0) - (Number(b.moodDelta) || 0))[0];
// карточка «Барной карты»: вкладка и строка позиции
async function card(page, tab, id) {
  await nav(page, "reference", 400); await nav(page, "wines", 2200);
  await page.locator(`[data-bar-tab="${tab}"]`).click().catch(() => {}); await sleep(800);
  await page.locator(`[data-wine-row="${id}"]`).first().click(); await sleep(1100);
  return { store: await txt(page.locator("[data-wine-store]")), kind: await page.locator("[data-wine-store]").getAttribute("data-wine-store").catch(() => null),
    open: await txt(page.locator("[data-wine-open]")), sticker: await txt(page.locator("[data-wine-sticker]")) };
}

await run("BAR", async () => {
  const srv = srvOf();
  const o = await open({ who: PETR, srv, role: "bar" });
  await nav(o.page, "home", 1600);
  const tp = await topics(o.page);
  // v143: дальше — девятая «Инвентарь и оборудование бара»
  ok("BAR: трек «Бар» — восьмая тема «Приём и хранение: ЕГАИС, «Честный знак», марки»", tp.length >= 8 && /Приём и хранение: ЕГАИС, «Честный знак», марки/.test(tp[7] || ""), JSON.stringify(tp.slice(6)));
  await o.page.locator('.tbp-num[aria-label*="' + TOPIC + '"]').first().click(); await sleep(1100);
  // значок темы — рисунок приложения (коробка с отметкой «принято», ui/icons.jsx), не эмодзи
  ok("BAR: у темы значок приложения — коробка с отметкой, эмодзи на экране нет", (await o.page.locator('svg path[d="M14.4 15.3l1.6 1.5 2.7-3.1"]').count()) >= 1
    && !/📦/.test(await body(o.page)));
  ok("BAR: в теме шесть уроков, сборка, живой диалог, практика и тест", /Урок 7 · 10 шагов/.test(await body(o.page)), (await body(o.page)).slice(0, 160));
  await shot(o.page, "bar-track");
  await toLesson(o.page, TOPIC, "Приёмка: накладная, марки, ответ в ЕГАИС");
  await feed(o.page); await sleep(600);
  const t1 = await body(o.page);
  ok("BAR: урок «Приёмка»: скан каждой марки, срок ответа на ТТН, сбой УТМ", /Сканируем марку каждой бутылки/.test(t1) && /не позднее следующего рабочего дня/.test(t1) && /Сбой УТМ или интернета/.test(t1), t1.slice(0, 200));
  ok("BAR: «ЕГАИС» и «ТТН» — термины глоссария (пунктир)", (await dotted(o.page, "ЕГАИС")) && (await dotted(o.page, "ТТН")));
  await shot(o.page, "bar-lesson1");
  await toLesson(o.page, TOPIC, "Хранение: лицензия, условия, вскрытые бутылки");
  await feed(o.page); await sleep(600);
  const t5 = await body(o.page);
  ok("BAR: урок «Хранение»: адрес из лицензии, 10–14 °C, тихое вино 3 суток, «В приложении» — «Барная карта» и «Чек-листы»", /только в месте, указанном в лицензии/.test(t5) && /10–14 °C/.test(t5)
    && /Тихое вино — 3 суток/.test(t5) && /«Барная карта» → карточка вина или крепкого → «Хранение»/.test(t5) && /«Вскрытые бутылки: стикеры и сроки»/.test(t5), t5.slice(0, 200));
  await shot(o.page, "bar-lesson5");
  const [e1, e2] = noErr(o); ok("BAR: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("BUILD", async () => {
  const srv = srvOf();
  const o = await open({ who: PETR, srv, role: "bar" });
  await toLesson(o.page, TOPIC, "Сборка: приёмка поставки");
  const t = await body(o.page);
  ok("BUILD: «Сборка: приёмка поставки» — пять стадий: Накладная, Марки, ЕГАИС, УПД, Хранение", /Приёмка поставки/.test(t)
    && (await o.page.locator(".sa-bld-fnm").allInnerTexts()).join(",") === "Накладная,Марки,ЕГАИС,УПД,Хранение", JSON.stringify(await o.page.locator(".sa-bld-fnm").allInnerTexts()));
  ok("BUILD: первый шаг — экспедитор с шестью коробками", /Экспедитор занёс шесть коробок/.test(t));
  await shot(o.page, "build-start");
  const [e1, e2] = noErr(o); ok("BUILD: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("DIALOG", async () => {
  const srv = srvOf();
  const o = await open({ who: PETR, srv, role: "bar" });
  await toLesson(o.page, TOPIC, "Живой диалог");
  await o.page.waitForSelector(".sa-dlg[data-dlg]", { timeout: 8000 }).catch(() => {});
  ok("DIALOG: живой диалог — сценарий «Экспедитор торопит» (bar-b7-1)", (await dlgId(o.page)) === "bar-b7-1");
  await shot(o.page, "dialog-start");
  const good = await playDialogue(o.page, right);
  ok("DIALOG: верный путь — Олег доволен (настроение 5)", good.review === "5" && !good.walk, JSON.stringify(good));
  await shot(o.page, "dialog-end");
  await o.ctx.close();
  const o2 = await open({ who: PETR, srv, role: "bar" });
  await toLesson(o2.page, TOPIC, "Живой диалог");
  await o2.page.waitForSelector(".sa-dlg[data-dlg]", { timeout: 8000 }).catch(() => {});
  const bad = await playDialogue(o2.page, worst);
  ok("DIALOG: худший путь — «Олег уехал»", bad.walk && /Олег уехал/.test(bad.title || ""), JSON.stringify(bad));
  const [e1, e2] = noErr(o2); ok("DIALOG: без ошибок", e1, e2);
  await o2.ctx.close();
});

await run("MANAGER", async () => {
  const srv = srvOf();
  const o = await open({ who: MARIA, srv, role: "manager" });
  await nav(o.page, "home", 1600);
  const tp = await topics(o.page);
  // v143: дальше — десятая «Инвентарь и оборудование бара»
  ok("MANAGER: трек «Менеджер»: восьмая «Админ на смене», девятая «Приём и хранение»", tp.length >= 9 && /Админ на смене/.test(tp[7] || "") && /Приём и хранение/.test(tp[8] || ""), JSON.stringify(tp.slice(7)));
  await toLesson(o.page, TOPIC, "Контроль: смена, месяц, документы");
  await feed(o.page); await sleep(600);
  const t = await body(o.page);
  ok("MANAGER: урок «Контроль»: ответственный в каждой смене, сверка трёх систем, журнал — как в стандарте холдинга", /Ответственный в каждой смене/.test(t) && /Сверка остатков iiko, ЕГАИС и «Честного знака»/.test(t)
    && /решает юрист холдинга/.test(t) && /журнал не отменяем/.test(t), t.slice(0, 200));
  await shot(o.page, "manager-control");
  await toLesson(o.page, TOPIC, "Сборка: приёмка поставки");
  ok("MANAGER: та же сборка «Приёмка поставки» в треке менеджера", (await o.page.locator(".sa-bld-fnm").allInnerTexts()).join(",") === "Накладная,Марки,ЕГАИС,УПД,Хранение");
  const [e1, e2] = noErr(o); ok("MANAGER: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("CARD", async () => {
  const srv = srvOf();
  const o = await open({ who: PETR, srv, role: "bar" });
  let c = await card(o.page, "wine", "wn-red");
  ok("CARD: Пино Нуар — «Хранение»: 10–14 °C лёжа; вскрытая — 3 суток с вакуумной пробкой; стикер", c.kind === "wine" && /^10–14 °C, бутылки с пробкой лёжа/.test(c.store)
    && c.open === "Вскрытая: 3 суток с вакуумной пробкой, в холодильнике при 4–6 °C" && /^Стикер на бутылке: дата и время вскрытия, «годен до», подпись$/.test(c.sticker), JSON.stringify(c));
  await into(o.page, "[data-wine-store]"); await shot(o.page, "card-wine");
  c = await card(o.page, "wine", "wn-spark");
  ok("CARD: Просекко — вскрытая 1 сутки", /^Вскрытая: 1 сутки с пробкой для игристого/.test(c.open), JSON.stringify(c));
  c = await card(o.page, "wine", "wn-port");
  ok("CARD: Порто — вскрытая 14 суток", /^Вскрытая: 14 суток с плотной пробкой/.test(c.open), JSON.stringify(c));
  c = await card(o.page, "spirit", "sp-liq");
  ok("CARD: Амаретто (ликёр) — 15–20 °C, срок по маркировке и стикер", c.kind === "spirit" && /^15–20 °C, стоя/.test(c.store) && /по маркировке/.test(c.open) && !!c.sticker, JSON.stringify(c));
  c = await card(o.page, "spirit", "sp-bit");
  ok("CARD: Campari — 15–20 °C, без срока и стикера", /^15–20 °C, стоя/.test(c.store) && !c.open && !c.sticker, JSON.stringify(c));
  await into(o.page, "[data-wine-store]"); await shot(o.page, "card-spirit");
  const [e1, e2] = noErr(o); ok("CARD: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("CHECK", async () => {
  const srv = srvOf();
  const o = await open({ who: MARIA, srv, role: "manager" });
  await nav(o.page, "checklist", 2000);
  let t = await body(o.page);
  ok("CHECK: «Открытие» — семь пунктов, «Вскрытые бутылки: стикеры и сроки» после бара", /Кофемашина и бар готовы Вскрытые бутылки: стикеры и сроки Касса открыта/.test(t) && /0\/7/.test(t), t.slice(0, 240));
  await shot(o.page, "check-open");
  await o.page.getByText("Закрытие", { exact: true }).first().click(); await sleep(900);
  t = await body(o.page);
  // v143 (Доп. 463): за ЕГАИС — «Бар: кофемашина, стаканомойка, краны, блендер», пунктов восемь
  ok("CHECK: «Закрытие» — «ЕГАИС и ЭДО: накладные, УПД, акты за день» после кассы", /Касса сведена ЕГАИС и ЭДО: накладные, УПД, акты за день Бар: кофемашина, стаканомойка, краны, блендер Техника и свет выключены/.test(t) && /0\/8/.test(t), t.slice(0, 240));
  for (const s of ["Столы убраны, зал готов на завтра", "Касса сведена", "ЕГАИС и ЭДО: накладные, УПД, акты за день", "Бар: кофемашина, стаканомойка, краны, блендер", "Техника и свет выключены", "Стоп-лист обновлён", "Уборка завершена", "Закрытие и сигнализация"]) {
    await o.page.getByText(s, { exact: true }).first().click(); await sleep(350);
  }
  await sleep(900);
  const ck = [...srv.calls].reverse().find((c) => c.fn === "checklist_check" && c.body.p_kind === "close");
  ok("CHECK: восемь из восьми — «Закрытие: всё готово», на сервер ушло p_total 8 и c7", /«Закрытие»: всё готово/.test(await body(o.page)) && !!ck && ck.body.p_total === 8 && ck.body.p_checked.includes("c7"), JSON.stringify(ck && ck.body));
  await shot(o.page, "check-close");
  await nav(o.page, "shift", 2200);
  const st = await o.page.locator('[data-routine-sub="close"]').innerText().catch(() => "");
  ok("CHECK: «Распорядок смены»: закрытие — «готово»", /^готово/.test(st), st);
  const [e1, e2] = noErr(o); ok("CHECK: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("MORNING", async () => {
  const srv = srvOf({ checklists: { "-1": { open: { checked: ["o1", "o2", "o3", "o4", "o5", "o7", "o6"], done_at: TODAY + "T09:52:00", by_name: "Ольга Л." },
    close: { checked: ["c1", "c2", "c3", "c4", "c8"], done_at: null } } } });   // v143: c8 «Бар: …» отмечен
  const o = await open({ who: MARIA, srv, role: "manager" });
  await nav(o.page, "morning", 2800);
  const cl = await txt(o.page.locator('[data-mo-row="cl-close"]'));
  ok("MORNING: «Закрытие: отмечено 5 из 8» и что не отмечено: «ЕГАИС и ЭДО…», «Уборка завершена» и ещё 1", /Закрытие: отмечено 5 из 8/.test(cl)
    && /Не отмечено: «ЕГАИС и ЭДО: накладные, УПД, акты за день», «Уборка завершена» и ещё 1/.test(cl), cl);
  ok("MORNING: у законченного «Открытия» строки «Не отмечено» нет, у неначатой «Предсменки» — тоже", !/Не отмечено/.test(await txt(o.page.locator('[data-mo-row="cl-open"]')))
    && !/Не отмечено/.test(await txt(o.page.locator('[data-mo-row="cl-preshift"]'))));
  await into(o.page, '[data-mo-row="cl-close"]'); await shot(o.page, "morning");
  const [e1, e2] = noErr(o); ok("MORNING: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("MENTOR", async () => {
  const srv = srvOf();
  const o = await open({ who: PETR, srv, role: "bar", ai: (q) => (q.includes("[Стандарт холдинга, приём и хранение") ? "Без марки не принимаем: в ЕГАИС — «принято с расхождениями» и акт." : "Хороший вопрос.") });
  const ask = async (q) => {
    const n = o.aiCalls.length;
    await o.page.locator(".sa-layer textarea").fill(q);
    await o.page.locator('.sa-layer button:has(path[d="M22 2L11 13"])').click();
    await until(() => o.aiCalls.length > n, 8000); await sleep(900);
    return o.aiCalls.length > n ? String(o.aiCalls[o.aiCalls.length - 1].messages.slice(-1)[0].content) : "";
  };
  await nav(o.page, "assistant", 1600);
  const s1 = await ask("Что делать, если у бутылки нет марки?");
  ok("MENTOR: вопрос о бутылке без марки — к нему стандарт холдинга (приёмка, ТТН, кега, списание, лицензия, вскрытая бутылка), в пределах 2000 знаков",
    s1.includes("[Стандарт холдинга, приём и хранение: до подписи пересчёт и скан марки каждой бутылки") && /тихое вино 3 суток, игристое 1, креплёное 14\.\]/.test(s1) && s1.length <= 2000, s1.length + " " + s1.slice(-300));
  ok("MENTOR: ответ Наставника на экране", /Без марки не принимаем/.test(await body(o.page)));
  await shot(o.page, "mentor");
  const s2 = await ask("Какое вино посоветовать к тартару?");
  ok("MENTOR: вопрос о вине к блюду — без стандарта приёмки", !!s2 && !s2.includes("[Стандарт холдинга, приём и хранение"), s2.slice(-200));
  const [e1, e2] = noErr(o); ok("MENTOR: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("LIGHT", async () => {
  const srv = srvOf({ checklists: { "-1": { close: { checked: ["c1", "c2"], done_at: null } } } });
  const o = await open({ who: MARIA, srv, role: "manager", light: true });
  await toLesson(o.page, TOPIC, "«Честный знак»: пиво, кеги, вода, соки, молоко");
  await feed(o.page); await sleep(500);
  ok("LIGHT: урок «Честный знак» в светлой теме: кега — не позднее следующего рабочего дня, у молока с 1 ноября 2026 года — номер партии", /не позднее следующего рабочего дня после подключения/.test(await body(o.page))
    && /С 1 ноября 2026 года у молока и сливок/.test(await body(o.page)) && /номер партии/.test(await body(o.page)));
  await shot(o.page, "light-lesson");
  await card(o.page, "wine", "wn-red"); await into(o.page, "[data-wine-store]"); await shot(o.page, "light-card");
  await nav(o.page, "morning", 2600); await into(o.page, '[data-mo-row="cl-close"]'); await shot(o.page, "light-morning");
  const [e1, e2] = noErr(o); ok("LIGHT: без ошибок", e1, e2);
  await o.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} ✓, ${bad} ✗`);
process.exit(bad ? 1 : 0);
