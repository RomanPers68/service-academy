// e2e v144 (Доп. 464–465): «Урок 7» и «Урок 8» бара — для ознакомления и без юридического слоя; вычитка v140–v143.
// Владелец (08.11): «Ок» на план. Сервер — демо в памяти (fake-server.js).
// Разделы: TRACK (трек «Бар»: «N из M» без тем для ознакомления, у номеров 7 и 8 — «для ознакомления», в меню темы — пометка и
// записка, шестой урок — «Шесть правил и три проверки», тест — «самопроверка»; список тем; «Дальше:» из «Урока 6» не ведёт в тему
// для ознакомления), LESSON (урок «Расхождения» и «Уход» у бармена — без штрафов и пунктов), QUIZ (самопроверка: ответы не уходят
// в аналитику, ошибки — не в «Работу над ошибками», балла в рейтинг нет, отметка «пройдено» есть, прогресс трека не меняется),
// ROLE (последний урок обычной программы — «Бар пройден» без тем для ознакомления; потом — карточка экзамена, не «Дальше»),
// MANAGER (у менеджера темы обычные: штрафы, статьи, пункты; «Тест»; «Смена целиком»: касса сразу после обхода), LIGHT.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v144.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5344, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v144";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v127";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const { DIALOGUES_DATA } = await import(SRC + "/data/dialogues.js");
const { BUILDS } = await import(SRC + "/data/builds.js");
const { BAR_MODULES } = await import(SRC + "/data/modules-bar.js");
const { MANAGER_MODULES } = await import(SRC + "/data/modules-manager.js");
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
const MENU = [
  { id: "d1", name: "Тартар из говядины", cat: "Закуски", desc: "Нежный, с лёгким дымком.", price: 690 },
  { id: "__barcard__", cocktails: ["negroni"] },
];
// понедельник: ближайший после сегодня (не сегодня) и первый понедельник следующего месяца; вторник — день без строк
const addD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
const dowOf = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const MON = (() => { for (let n = 1; n <= 28; n++) { const d = addD(TODAY, n); if (dowOf(d) === 1 && Number(d.slice(8)) > 7) return d; } return null; })();
const MON1 = (() => { const [y, m] = TODAY.split("-").map(Number); const f = new Date(Date.UTC(m === 12 ? y + 1 : y, m % 12, 1)).toISOString().slice(0, 10); for (let n = 0; n < 7; n++) if (dowOf(addD(f, n)) === 1) return addD(f, n); return f; })();
const TUE = addD(MON, 1);
const srvOf = (x = {}) => {
  const s = makeServer({ today: x.today || TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: plan(), menu: JSON.parse(JSON.stringify(MENU)), tgLinked: ["u-maria"],
    push: () => {}, ping: () => {}, checklists: x.checklists || {}, progress: x.progress || {}, quizzes: x.quizzes || {} });
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



const steps = (m) => m.lessons.filter((l) => l.type !== "result");
const REG = BAR_MODULES.filter((m) => !m.info);
const REG_N = REG.reduce((a, m) => a + steps(m).length, 0);
const RECV = "Приём и хранение", EQP = "Инвентарь и оборудование бара";
const quizOf = (id) => [...BAR_MODULES, ...MANAGER_MODULES].flatMap((m) => m.lessons).find((l) => l.id === id);
// ответить на вопрос теста: текст вопроса — над вариантами; верный — по данным (варианты перемешаны при показе)
async function answer(page, quiz, good) {
  const q = await page.evaluate(() => { const o = document.querySelector("[data-quiz-opt]"); return o && o.previousElementSibling ? o.previousElementSibling.textContent.trim() : ""; });
  const Q = quiz.questions.find((x) => x.q === q);
  if (!Q) return "нет вопроса: " + q;
  const want = Q.options[Q.correct];
  const texts = await page.evaluate(() => [...document.querySelectorAll("[data-quiz-opt]")].map((o) => o.textContent || ""));
  let i = texts.findIndex((t) => t.includes(want));
  if (!good) i = texts.findIndex((t) => !t.includes(want));
  await page.locator('[data-quiz-opt="' + i + '"]').click();
  await sleep(good ? 900 : 1700);
  return "";
}
const readCards = async (page) => { for (let i = 0; i < 24; i++) { if (await page.locator("button:has-text('Урок пройден')").count()) return true; await page.locator("span[aria-label='Следующая карточка']").last().click({ timeout: 3000 }).catch(() => {}); await sleep(300); } return false; };

await run("TRACK", async () => {
  const srv = srvOf();
  const o = await open({ who: PETR, srv, role: "bar" });
  await nav(o.page, "home", 1600);
  const tp = await topics(o.page);
  ok("TRACK: девять тем; у седьмой и восьмой — «для ознакомления», у остальных — нет", tp.length === 9 && /Приём и хранение.*для ознакомления/.test(tp[7] || "")
    && /Инвентарь и оборудование бара.*для ознакомления/.test(tp[8] || "") && tp.slice(0, 7).every((t) => !/для ознакомления/.test(t)), JSON.stringify(tp.slice(6)));
  ok("TRACK: номера 7 и 8 — с пометкой info, остальные — без", (await o.page.locator(".tbp-strip .tbp-num.info").count()) === 2
    && (await o.page.locator(".tbp-strip .tbp-num:not(.info)").count()) === 7);
  const hd = await body(o.page);
  ok("TRACK: шапка — «0 из " + REG_N + "»: шаги тем для ознакомления не считаются", hd.includes("0 из " + REG_N + " ·"), hd.slice(0, 160));
  await o.page.locator('.tbp-num[aria-label*="' + RECV + '"]').first().click(); await sleep(1100);
  const t7 = await txt(o.page.locator(".tbp-cur"));
  ok("TRACK: меню темы — «Урок 7 · 10 шагов» и записка «Тема для ознакомления: в прогресс трека и отчёт руководителя не входит»",
    /Урок 7 · 10 шагов/.test(t7) && /Тема для ознакомления: в прогресс трека и отчёт руководителя не входит/.test(t7), t7.slice(0, 220));
  ok("TRACK: шестой урок — «Шесть правил и три проверки», урока «Ответственность: штрафы…» у бара нет", /Шесть правил и три проверки/.test(t7) && !/Ответственность: штрафы/.test(t7));
  ok("TRACK: последний шаг — «Самопроверка: приём и хранение» (шаг 10 · самопроверка)", /Самопроверка: приём и хранение/.test(t7) && /шаг 10 · самопроверка/.test(t7), t7.slice(-260));
  ok("TRACK: у темы для ознакомления нет «Освежить», «Зачёт на опыт» и «Раунда мастера»", !/Освежить|Зачёт на опыт|Раунд мастера|Я это умею/.test(t7));
  await shot(o.page, "track-topic7");
  // «Дальше:» внизу «Урока 6» — тем обычной программы дальше нет, ссылки нет; у «Урока 5» — на «Урок 6»
  await o.page.locator(".tbp-strip .tbp-num").nth(6).click(); await sleep(1000);
  const n6 = await o.page.locator(".tbp-cur .tbp-nextlink").count();
  await o.page.locator(".tbp-strip .tbp-num").nth(5).click(); await sleep(1000);
  const l5 = await txt(o.page.locator(".tbp-cur .tbp-nextlink"));
  ok("TRACK: тихая ссылка «Дальше:» — у «Урока 5» на «Урок 6», у «Урока 6» её нет (в тему для ознакомления не зовёт)", n6 === 0 && /Дальше: 6 · /.test(l5), n6 + " / " + l5);
  // «К уроку» на чужой теме ведёт в обычную программу
  await o.page.locator('.tbp-num[aria-label*="' + EQP + '"]').first().click(); await sleep(1000);
  const go = await txt(o.page.locator(".tbp-go"));
  ok("TRACK: на теме для ознакомления «К уроку» ведёт в «Урок 0»", /К уроку: Виды баров/.test(go), go);
  await o.page.locator('[aria-label="Все темы списком"]').first().click(); await sleep(900);
  const lst = await body(o.page);
  ok("TRACK: список тем — «Урок 7 · для ознакомления», «Урок 8 · для ознакомления»; карточка «Начать» — «Урок 0»", /Урок 7 · для ознакомления · ≈/.test(lst) && /Урок 8 · для ознакомления · ≈/.test(lst)
    && /Виды баров: одна основа, разные миры/.test(lst), lst.slice(0, 240));
  await shot(o.page, "track-list");
  await o.page.locator('[aria-label="Листать темы по одной"]').first().click().catch(() => {}); await sleep(600);
  const [e1, e2] = noErr(o); ok("TRACK: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("LESSON", async () => {
  const srv = srvOf();
  const o = await open({ who: PETR, srv, role: "bar" });
  await toLesson(o.page, RECV, "Расхождения: недовоз, бой, бутылка без марки");
  await feed(o.page); await sleep(600);
  const t2 = await body(o.page);
  ok("LESSON: «Расхождения» у бармена — практическое правило без штрафа: «Бутылку без марки ЕГАИС не знает»; «подписываем вдвоём»", /Бутылку без марки ЕГАИС не знает/.test(t2)
    && /подписываем вдвоём/.test(t2) && !/штраф|млн ₽/.test(t2), t2.slice(0, 200));
  await shot(o.page, "lesson-recv2");
  await toLesson(o.page, RECV, "Шесть правил и три проверки");
  await feed(o.page); await sleep(600);
  const t6 = await body(o.page);
  ok("LESSON: «Шесть правил и три проверки» — без штрафов и статей", /Не принимаем бутылку без марки или с повреждённой маркой/.test(t6) && /Три проверки/.test(t6) && !/штраф|КоАП|ст\. \d/.test(t6), t6.slice(0, 200));
  await toLesson(o.page, EQP, "Инвентарь: мерка, совок, полотенца");
  await feed(o.page); await sleep(600);
  const e1t = await body(o.page);
  ok("LESSON: «Инвентарь» — «порцию отмеряет джиггер», «Лёд, гарнир, доска», без ПП и СанПиН", /порцию отмеряет джиггер/.test(e1t) && /Лёд, гарнир, доска/.test(e1t) && !/ПП РФ|СанПиН/.test(e1t), e1t.slice(0, 200));
  await shot(o.page, "lesson-eqp1");
  const [e1, e2] = noErr(o); ok("LESSON: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("QUIZ", async () => {
  const srv = srvOf();
  const o = await open({ who: PETR, srv, role: "bar" });
  const quiz = quizOf("bar7-q");
  await toLesson(o.page, RECV, "Самопроверка: приём и хранение");
  await o.page.waitForSelector("[data-quiz-opt]", { timeout: 8000 }).catch(() => {});
  const kind = await txt(o.page.locator("[data-quiz-kind]")), title = await txt(o.page.locator("[data-quiz-title]"));
  const nQ = Number((kind.match(/· (\d+) вопрос/) || [])[1]) || 0;   // самопроверка берёт часть вопросов темы, как тест
  ok("QUIZ: шапка — «Самопроверка · N вопросов», тема — «Приём и хранение» без приставки", /^Самопроверка · \d+ вопрос/.test(kind) && nQ >= 10 && /^Приём и хранение/.test(title), kind + " / " + title);
  const rule = await txt(o.page.locator("[data-quiz-rule]"));
  ok("QUIZ: правило словами — «на третьей ошибке самопроверка закончится. Пройти заново можно сразу.»", /на третьей ошибке самопроверка закончится\. Пройти заново можно сразу\./.test(rule), rule);
  await shot(o.page, "quiz-start");
  const errs = [];
  errs.push(await answer(o.page, quiz, false));   // первая — ошибка
  for (let i = 1; i < 30 && (await o.page.locator("[data-quiz-opt]").count()); i++) errs.push(await answer(o.page, quiz, true));
  await sleep(600);
  const res = await body(o.page);
  ok("QUIZ: прошёл все вопросы (" + nQ + ")", errs.length === nQ && errs.every((e) => !e), errs.length + ": " + errs.filter(Boolean).join("; "));
  ok("QUIZ: итог — «Результат самопроверки», «Самопроверка пройдена, ошибки разобраны ниже»", /Результат самопроверки/.test(res) && /Самопроверка пройдена, ошибки разобраны ниже/.test(res), res.slice(0, 200));
  const logged = srv.calls.filter((c) => c.fn === "log_quiz_answer" || c.fn === "log_quiz_pick").length;
  const mist = await o.page.evaluate(() => JSON.parse(localStorage.getItem("sa_mistakes_Пётр_Орлов") || "[]"));
  ok("QUIZ: ответы самопроверки не ушли в аналитику, ошибка — не в «Работу над ошибками»", logged === 0 && !mist.some((m) => m.lessonId === "bar7-q"), logged + " / " + JSON.stringify(mist).slice(0, 120));
  await shot(o.page, "quiz-result");
  await o.page.locator("button", { hasText: "Продолжить" }).first().click(); await sleep(1500);
  const sc = last(srv, "save_score"), qd = last(srv, "save_quiz_done");
  ok("QUIZ: балл в рейтинг не ушёл (save_score нет), отметка «пройдено» — да (save_quiz_done bar7-q)", !sc && !!qd && qd.body.p_quiz_id === "bar7-q", JSON.stringify([sc && sc.body, qd && qd.body]));
  await nav(o.page, "home", 1500);
  const hd = await body(o.page);
  ok("QUIZ: прогресс трека не изменился — «0 из " + REG_N + "»", hd.includes("0 из " + REG_N + " ·"), hd.slice(0, 160));
  const sc2 = await o.page.evaluate(() => JSON.parse(localStorage.getItem("sa_scores") || "[]"));
  ok("QUIZ: на телефоне результата самопроверки среди тестов нет", !sc2.some((s) => s.quiz_id === "bar7-q"));
  const [e1, e2] = noErr(o); ok("QUIZ: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("ROLE", async () => {
  // вся обычная программа бара пройдена, кроме одного урока; темы для ознакомления не начаты
  const ids = REG.flatMap(steps);
  const lessons = ids.filter((l) => l.type !== "quiz" && l.id !== "bar6-5").map((l) => l.id), quizzes = ids.filter((l) => l.type === "quiz").map((l) => l.id);
  const srv = srvOf({ progress: { "e-petr": lessons }, quizzes: { "e-petr": quizzes } });
  const o = await open({ who: PETR, srv, role: "bar" });
  await nav(o.page, "home", 1800);
  const hd = await body(o.page);
  ok("ROLE: шапка — «" + (REG_N - 1) + " из " + REG_N + "»", hd.includes((REG_N - 1) + " из " + REG_N + " ·"), hd.slice(0, 160));
  const t6 = BAR_MODULES.find((m) => m.id === "bar6").lessons.find((l) => l.id === "bar6-5").title;
  await toLesson(o.page, "Конфликты", t6);
  const has = await readCards(o.page);
  await o.page.locator("button", { hasText: "Урок пройден" }).first().click().catch(() => {}); await sleep(1800);
  const t = await body(o.page);
  const cr = last(srv, "save_completed_role");
  ok("ROLE: последний урок обычной программы — «Бар пройден», роль ушла на сервер (темы для ознакомления не нужны)", has && /Бар пройден/.test(t) && !!cr && cr.body.p_role === "bar", (has ? "" : "нет кнопки; ") + t.slice(0, 160));
  await shot(o.page, "role-complete");
  await nav(o.page, "home", 1600);
  const hd2 = await body(o.page);
  ok("ROLE: шапка — «" + REG_N + " из " + REG_N + " · пройдено»", hd2.includes(REG_N + " из " + REG_N + " · пройдено"), hd2.slice(0, 160));
  await o.page.locator(".tbp-strip .tbp-num").nth(6).click(); await sleep(1100);
  const fin = await txt(o.page.locator('[data-next-card]'));
  ok("ROLE: под «Уроком 6» — карточка экзамена, а не «Дальше · Приём и хранение»", /Экзамен ступени|Экзамен сдан|Все уроки пройдены/.test(fin) && !/Приём и хранение/.test(fin), fin.slice(0, 160));
  ok("ROLE: «К уроку» не зовёт в тему для ознакомления", (await o.page.locator(".tbp-go").count()) === 0);
  await shot(o.page, "role-finish");
  const [e1, e2] = noErr(o); ok("ROLE: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("MANAGER", async () => {
  const srv = srvOf();
  const o = await open({ who: MARIA, srv, role: "manager" });
  await nav(o.page, "home", 1600);
  const tp = await topics(o.page);
  ok("MANAGER: у тем менеджера пометки «для ознакомления» нет", tp.length >= 10 && tp.every((t) => !/для ознакомления/.test(t)), JSON.stringify(tp.slice(7)));
  await o.page.locator('.tbp-num[aria-label*="' + RECV + '"]').first().click(); await sleep(1100);
  const t8 = await txt(o.page.locator(".tbp-cur"));
  ok("MANAGER: «Урок 8 · 11 шагов», урок «Ответственность: штрафы и шесть правил», «Тест»", /Урок 8 · 11 шагов/.test(t8) && /Ответственность: штрафы и шесть правил/.test(t8)
    && /шаг 11 · тест/.test(t8) && !/для ознакомления/.test(t8), t8.slice(0, 200));
  await toLesson(o.page, RECV, "Ответственность: штрафы и шесть правил");
  await feed(o.page); await sleep(600);
  const r6 = await body(o.page);
  ok("MANAGER: штрафы и статьи у менеджера на месте (КоАП РФ, ст. 15.12, ч. 4)", /КоАП РФ, ст\. 15\.12, ч\. 4/.test(r6) && /1–1,5 млн ₽/.test(r6), r6.slice(0, 200));
  await toLesson(o.page, EQP, "Инвентарь: мерка, совок, полотенца");
  await feed(o.page); await sleep(600);
  const i1 = await body(o.page);
  ok("MANAGER: «Инвентарь» — ПП РФ № 1515, п. 18 и СанПиН на месте", /ПП РФ № 1515, п\. 18/.test(i1) && /СанПиН 2\.3\/2\.4\.4282-26, п\. 40, 48/.test(i1), i1.slice(0, 200));
  await toLesson(o.page, "Админ на смене", "Смена целиком");
  await feed(o.page); await sleep(600);
  const s1 = await body(o.page);
  ok("MANAGER: «Смена целиком»: касса сразу после обхода, «Порядок замещения…»", /Сразу после обхода — кассовая смена под своей учётной записью/.test(s1)
    && /Порядок замещения, часы работы и перерывы/.test(s1) && /итог гоу-листа; сделанное отмечается само/.test(s1), s1.slice(0, 200));
  await shot(o.page, "manager-shift");
  const [e1, e2] = noErr(o); ok("MANAGER: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("LIGHT", async () => {
  const srv = srvOf();
  const o = await open({ who: PETR, srv, role: "bar", light: true });
  await nav(o.page, "home", 1600);
  await o.page.locator('.tbp-num[aria-label*="' + EQP + '"]').first().click(); await sleep(1100);
  const note = o.page.locator(".tbp-cur .tbm-infonote");
  const st = await note.evaluate((e) => ({ c: getComputedStyle(e).color, t: e.textContent })).catch(() => null);
  ok("LIGHT: записка «для ознакомления» в светлой теме — тёмным цветом", !!st && st.c === "rgb(110, 92, 60)" && /Тема для ознакомления/.test(st.t), JSON.stringify(st));
  await shot(o.page, "light-topic8");
  const [e1, e2] = noErr(o); ok("LIGHT: без ошибок", e1, e2);
  await o.ctx.close();
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} ✓, ${bad} ✗`);
process.exit(bad ? 1 : 0);
