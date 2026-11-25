// e2e-v195.mjs — v195 (Доп. 520): где ещё верный ответ мог уйти ошибкой. Голова — как в e2e-v194.mjs: обычный сайт
// (tools/claude/build.mjs), вызовы сервера перехватывает сам сценарий.
//   E2E_SITE=/home/claude/preview/site E2E_SRC=<исходники> node tools/claude/e2e-v195.mjs [MISTAKES CUSTOM]
// Разделы:
//   MISTAKES — «Работа над ошибками», вход как по кнопке «Разобрать ошибку» из Telegram: выбран верный ответ, через 8 с
//              приходит ответ из чата (банк меняется) — варианты остаются на местах, кнопка «Верно, убрать ✓», вопрос
//              уходит на следующий интервал (раньше варианты перемешивались под ответом и верный мог уйти ошибкой);
//   CUSTOM   — свой тест из редактора: два одинаковых варианта и номер верного строкой — на экране один вариант, оба
//              ответа «тем же» текстом засчитаны верными, итог 2/2, в аналитику ушло «верно».
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const { chromium } = require(G + "/playwright");
const SRC = process.env.E2E_SRC || "/home/claude/service-academy";
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", OUT = process.env.E2E_OUT || "/home/claude/preview/shots195";
const PORT = Number(process.env.E2E_PORT) || 5295;
const ONLY = process.argv.slice(2);
const want = (s) => !ONLY.length || ONLY.includes(s);
mkdirSync(OUT, { recursive: true });
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise((r) => server.listen(PORT, r));

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 600) : "")); } };
const UK = "_Анна_Смирнова";
const STAFF = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "hostess", is_admin: false };
const OKFN = new Set(["log_quiz_answer", "log_quiz_pick", "log_quiz_skip", "save_score", "save_quiz_done", "save_progress", "log_quiz_key", "quiz_key_rank", "qday_push"]);
const RANK = { ok: true, mine: 1, leader: 3, players: 4, place: 2, tied: false };

async function session(prof, rows, extraSeed, body) {
  const browser = await chromium.launch();
  const seed = { sa_session_token: "preview", sa_profile: JSON.stringify(prof), sa_a11y: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all",
    sa_last_role: JSON.stringify("spg"), sa_hint_mistakes: "1", sa_hint_analytics: "1", ...(extraSeed || {}) };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: "block", locale: "ru-RU", timezoneId: "Europe/Moscow" });
  const calls = [];
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (!m) return route.abort();
    const fn = m[1], c = { fn, body: JSON.parse(route.request().postData() || "{}"), at: Date.now() };
    calls.push(c);
    if (rows && rows[fn] !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(typeof rows[fn] === "function" ? rows[fn](c) : rows[fn]) });
    if (OKFN.has(fn)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(/key/.test(fn) ? RANK : { ok: true }) });
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "PGRST202", message: "нет функции" }) });
  });
  await ctx.addInitScript((seed) => { if (localStorage.getItem("__seeded")) return; localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); localStorage.setItem("__seeded", "1"); }, seed);
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  const t0 = Date.now();
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 20000 }).catch(() => {});
  try { await body({ page, calls, t0 }); }
  catch (e) { errors.push("сбой: " + e.message.split("\n")[0]); }
  ok("ошибок страницы нет", errors.length === 0, errors.join(" | "));
  await ctx.close(); await browser.close();
}
const opts = (page) => page.evaluate(() => [...document.querySelectorAll(".sa-opt")].filter((e) => e.offsetParent !== null)
  .map((e) => ({ t: (e.innerText || "").trim(), m: e.getAttribute("data-lens-opt") || "" })));
const clickOpt = (page, text) => page.evaluate((text) => { const el = [...document.querySelectorAll(".sa-opt")].filter((e) => e.offsetParent !== null)
  .find((e) => (e.innerText || "").trim().endsWith(text)); if (el) { el.click(); return true; } return false; }, text);
const bankOf = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), "sa_mistakes" + UK);

if (want("MISTAKES")) {
  const Q1 = { q: "Гость-молчун ничего не просит и почти не реагирует. Тактика:", options: ["Работаю чётко и быстро, без лишних вопросов",
    "Завожу лёгкий разговор, чтобы он расслабился", "Подхожу реже: раз молчит, ему ничего не нужно", "Зову менеджера посмотреть на гостя"], correct: 0,
    explanation: "Молчуну нужен сервис без лишних слов.", lessonTitle: "Тест: поведение в зале", lessonId: "s2-q", stage: 0, due: 1 };
  const Q2 = { q: "Гость торопится. Что важнее всего сказать при рекомендации?", options: ["Называю быстрые блюда и время их готовки", "Называю фирменное блюдо: его хвалят все",
    "Советую подождать десерт"], correct: 0, explanation: "", lessonTitle: "Тест: поведение в зале", lessonId: "s2-q", stage: 0, due: 1 };
  const TG = { id: 9501, q: "Вопрос из чата: куда ставим хлебную тарелку?", o: ["Слева от гостя", "Справа от гостя"], c: 0, e: "", t: "Сервировка",
    answer: 1, correct: false, at: new Date().toISOString() };
  // две попытки: при старом коде порядок четырёх вариантов совпадал бы с прежним в 1 случае из 24
  for (let run = 1; run <= 2; run++) {
    await session(STAFF, { qday_inbox: { ok: true, items: [TG] }, qday_today: { ok: true, item: null } },
      { ["sa_mistakes" + UK]: JSON.stringify([Q1, Q2]) }, async ({ page, t0 }) => {
        await page.evaluate(() => window.__saNav("mistakes")); await page.waitForTimeout(900);   // как по кнопке «Разобрать ошибку»
        const before = await opts(page);
        ok(`MISTAKES ${run}: открыт первый вопрос, четыре варианта`, before.length === 4 && (await page.evaluate(() => document.body.innerText)).includes(Q1.q), before);
        await clickOpt(page, Q1.options[0]); await page.waitForTimeout(400);
        const picked = await opts(page);
        ok(`MISTAKES ${run}: выбран верный — подсвечен верным`, picked.find((o) => o.t.endsWith(Q1.options[0]))?.m === "ok", picked);
        // ждём ответ из чата: в банке появляется вопрос из Telegram (через 8 с после старта)
        let arrived = false;
        for (let i = 0; i < 40 && !arrived; i++) { await page.waitForTimeout(500); arrived = (await bankOf(page)).some((m) => m && m.q === TG.q); }
        ok(`MISTAKES ${run}: ответ из чата пришёл, банк поменялся (${Math.round((Date.now() - t0) / 1000)} с)`, arrived);
        await page.waitForTimeout(700);
        const after = await opts(page);
        ok(`MISTAKES ${run}: варианты на тех же местах`, JSON.stringify(after.map((o) => o.t)) === JSON.stringify(before.map((o) => o.t)), { before: before.map((o) => o.t), after: after.map((o) => o.t) });
        ok(`MISTAKES ${run}: подсветка та же — выбранный верный зелёный`, after.find((o) => o.t.endsWith(Q1.options[0]))?.m === "ok", after);
        const label = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Верно, убрать|Дальше →/.test(x.innerText || "")); return b ? b.innerText.trim() : ""; });
        ok(`MISTAKES ${run}: кнопка — «Верно, убрать ✓»`, label === "Верно, убрать ✓", label);
        await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Верно, убрать|Дальше →/.test(x.innerText || "")); if (b) b.click(); });
        await page.waitForTimeout(700);
        const it = (await bankOf(page)).find((m) => m && m.q === Q1.q);
        ok(`MISTAKES ${run}: вопрос ушёл на следующий интервал (этап 1, срок завтра)`, !!it && it.stage === 1 && it.due > Date.now() + 12 * 3600e3, it && { stage: it.stage, due: it.due });
        if (run === 1) await page.screenshot({ path: OUT + "/mistakes.png" });
      });
  }
}

if (want("CUSTOM")) {
  const SEC = "Свой раздел 520";
  const LESSONS = [{ id: 520, role: "spg", module: SEC, title: "Кто главный в смене", content: "Старший смены отвечает за зал, пока менеджера нет.", sort: 1,
    questions: [
      { q: "Кто главный в смене без менеджера?", options: ["Старший смены", "Повар", "Старший смены."], correct: 2, explanation: "Старший отвечает за зал." },
      { q: "Сколько гостей садим за стол на четверых?", options: ["Двоих", "Четверых"], correct: "1", explanation: "Стол на четверых — четверо гостей." },
    ] }];
  await session(STAFF, { cms_list_lessons: LESSONS }, {}, async ({ page, calls }) => {
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__saNav("home")); await page.waitForTimeout(1800);
    const has = await page.evaluate((s) => { const b = document.querySelector(`.tbp-num[aria-label*="${s}"]`); if (b) { b.click(); return true; } return false; }, SEC);
    await page.waitForTimeout(1300);
    ok("CUSTOM: свой раздел в треке", has);
    const opened = await page.evaluate((t) => { const el = [...document.querySelectorAll("button, div, span")].filter((e) => e.offsetParent !== null && (e.innerText || "").trim() === t).pop();
      if (el) { (el.closest("button") || el).click(); return true; } return false; }, "Тест: " + SEC);
    await page.waitForTimeout(1500);
    ok("CUSTOM: тест раздела открыт", opened);
    const answers = [];
    for (let k = 0; k < 2; k++) {
      const shown = await opts(page);
      const q = await page.evaluate(() => { const t = document.body.innerText; return /Кто главный/.test(t) ? 1 : /Сколько гостей/.test(t) ? 2 : 0; });
      if (q === 1) {
        ok("CUSTOM: «Старший смены» — один вариант, а не два", shown.length === 2 && shown.filter((o) => /Старший смены/.test(o.t)).length === 1, shown.map((o) => o.t));
        await clickOpt(page, "Старший смены");
      } else if (q === 2) {
        ok("CUSTOM: номер верного строкой — вариантов два", shown.length === 2, shown.map((o) => o.t));
        await clickOpt(page, "Четверых");
      }
      await page.waitForTimeout(250);
      const mk = await opts(page);
      answers.push({ q, mark: (mk.find((o) => o.m) || {}).m || "", picked: mk.find((o) => o.m === "ok" || o.m === "bad") });
      await page.waitForTimeout(1600);
    }
    ok("CUSTOM: оба ответа «тем же» текстом засчитаны верными (зелёным)", answers.length === 2 && answers.every((a) => a.mark === "ok") && answers.map((a) => a.q).sort().join() === "1,2", answers);
    const t = await page.evaluate(() => document.body.innerText);
    ok("CUSTOM: итог теста 2/2", /2\s*\/\s*2/.test(t) && /правильно/.test(t), t.slice(0, 200));
    const logged = calls.filter((c) => c.fn === "log_quiz_answer");
    ok("CUSTOM: в аналитику — оба «верно»", logged.length === 2 && logged.every((c) => c.body.p_correct === true), logged.map((c) => c.body));
    await page.screenshot({ path: OUT + "/custom.png" });
  });
}

server.close();
console.log(`\nпроверок: ${pass + fail}, прошло ${pass}, упало ${fail}`);
process.exit(fail ? 1 : 0);
