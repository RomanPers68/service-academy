// e2e-v194.mjs — v194 (Доп. 519): «что выбрал» в тесте уходит только после записи ответа; плашка ошибки без
// «Выбрал» = «Верно». Голова — как в e2e-loophole.mjs: обычный сайт (tools/claude/build.mjs), вызовы сервера
// перехватывает сам сценарий.
//   E2E_SITE=/home/claude/preview/site E2E_SRC=<исходники> node tools/claude/e2e-v194.mjs [ORDER OFFLINE DROP PLATE]
// Разделы:
//   ORDER   — сервер записывает ответ 0,8 с: «что выбрал» уходит только после; верный и неверный ответы;
//   OFFLINE — нет сети на ответе: оба вызова в очереди телефона по порядку, «что выбрал» не ушёл; сеть вернулась —
//             очередь уходит, ответ раньше своего «что выбрал»;
//   DROP    — сервер отверг ответ (нет функции): «что выбрал» не шлём и в очередь не кладём;
//   PLATE   — «Аналитика → Люди»: у ошибки «Выбрал», совпавшее с «Верно», не показано; другое — как раньше.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const { chromium } = require(G + "/playwright");
const SRC = process.env.E2E_SRC || "/home/claude/service-academy";
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", OUT = process.env.E2E_OUT || "/home/claude/preview/shots194";
const PORT = Number(process.env.E2E_PORT) || 5294;
const ONLY = process.argv.slice(2);
const want = (s) => !ONLY.length || ONLY.includes(s);
mkdirSync(OUT, { recursive: true });

const spg = await import(SRC + "/data/modules-spg.js");
const quiz = Object.values(spg).flat().filter((x) => x && x.lessons).flatMap((m) => m.lessons).find((l) => l.id === "spg-0-q");
const MAP = {}; for (const q of quiz.questions) MAP[q.q] = { right: q.options[q.correct], options: q.options };
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
const OWNER = { id: "u-owner", name: "Роман", surname: "Владелец", restaurant: "Два моря, Океан", position: "owner", is_admin: true };
const OKFN = new Set(["log_quiz_answer", "log_quiz_pick", "log_quiz_skip", "save_score", "save_quiz_done", "save_progress", "log_quiz_key", "quiz_key_rank"]);
const RANK = { ok: true, mine: 1, leader: 3, players: 4, place: 2, tied: false };

// net: { fn: "ok" | "slow" | "offline" | "drop" } — как сервер отвечает; rows — ответы отчётов
async function session(prof, net, rows, body) {
  const browser = await chromium.launch();
  const seed = { sa_session_token: "preview", sa_profile: JSON.stringify(prof), sa_a11y: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all",
    sa_last_role: JSON.stringify("spg"), sa_hint_mistakes: "1", sa_hint_analytics: "1" };
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
    const how = net[fn];
    if (how === "offline") { c.res = "offline"; return route.abort("internetdisconnected"); }
    if (how === "drop") { c.res = "drop"; return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "PGRST202", message: "нет функции" }) }); }
    if (how === "slow") await new Promise((r) => setTimeout(r, 800));
    c.done = Date.now(); c.res = "ok";
    if (rows && rows[fn] !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows[fn]) });
    if (OKFN.has(fn)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(/key/.test(fn) ? RANK : { ok: true }) });
    // прочего на этом «сервере» нет — как настоящий сервер без этапа: «нет функции» (не обрыв сети, иначе всё ляжет в очередь)
    c.res = "missing";
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "PGRST202", message: "нет функции" }) });
  });
  await ctx.addInitScript((seed) => { if (localStorage.getItem("__seeded")) return; localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); localStorage.setItem("__seeded", "1"); }, seed);
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  const clickText = async (t) => { const r = await page.evaluate((t) => { const els = [...document.querySelectorAll("button, div, span")]
      .filter((e) => e.offsetParent !== null && (e.innerText || "").trim() === t); const el = els[els.length - 1]; if (el) { el.click(); return true; } return false; }, t);
    await page.waitForTimeout(1200); return r; };
  const toTest = async () => { await page.evaluate(() => window.__saNav("home")); await page.waitForTimeout(1500);
    await page.evaluate(() => { const b = document.querySelector('.tbp-num[aria-label*="Знакомство"]'); if (b) b.click(); }); await page.waitForTimeout(800);
    return clickText("Тест: философия сервиса"); };
  // ответ засчитывается через 0,6 с (верный) или 1,4 с (неверный)
  const answer = async (correct, wait) => { const r = await page.evaluate(({ MAP, correct }) => {
      const txt = document.body.innerText; const q = Object.keys(MAP).find((k) => txt.includes(k)); if (!q) return { err: "нет вопроса" };
      const target = correct ? MAP[q].right : MAP[q].options.find((o) => o !== MAP[q].right);
      const els = [...document.querySelectorAll(".sa-opt")].filter((e) => e.offsetParent !== null && (e.innerText || "").trim().endsWith(target));
      const el = els[els.length - 1]; if (!el) return { err: "нет варианта" }; el.click(); return { q, target }; }, { MAP, correct });
    await page.waitForTimeout(wait ?? (correct ? 900 : 1700)); return r; };
  // очередь записей телефона: только вызовы теста
  const queue = async () => JSON.parse((await page.evaluate(() => localStorage.getItem("sa_sync_queue"))) || "[]").filter((x) => /^log_quiz_/.test(x.fn));
  try { await body({ page, calls, net, clickText, toTest, answer, queue }); }
  catch (e) { errors.push("сбой: " + e.message.split("\n")[0]); }
  ok("ошибок страницы нет", errors.length === 0, errors.join(" | "));
  await ctx.close(); await browser.close();
}
const of = (calls, fn, q) => calls.filter((c) => c.fn === fn && (!q || c.body.p_question === q));

if (want("ORDER")) await session(STAFF, { log_quiz_answer: "slow" }, null, async ({ page, calls, toTest, answer }) => {
  ok("ORDER: тест открылся", await toTest());
  const a1 = await answer(true, 2200), a2 = await answer(false, 3000);
  ok("ORDER: ответил верно и неверно", !a1.err && !a2.err, [a1, a2]);
  for (const [a, right] of [[a1, true], [a2, false]]) {
    const ans = of(calls, "log_quiz_answer", a.q)[0], pick = of(calls, "log_quiz_pick", a.q)[0];
    ok(`ORDER: ${right ? "верный" : "неверный"} — ответ записан (0,8 с), «что выбрал» ушёл после`, !!ans && !!pick && ans.done && pick.at >= ans.done,
      { ans: ans && { at: ans.at, done: ans.done }, pick: pick && pick.at });
    ok(`ORDER: ${right ? "верный" : "неверный"} — что выбрал и что верно`, !!pick && pick.body.p_answer === a.target && pick.body.p_right === MAP[a.q].right
      && (pick.body.p_answer === pick.body.p_right) === right && ans.body.p_correct === right, pick && pick.body);
  }
  await page.screenshot({ path: OUT + "/order.png" });
});

if (want("OFFLINE")) await session(STAFF, { log_quiz_answer: "offline" }, null, async ({ page, calls, net, toTest, answer, queue }) => {
  ok("OFFLINE: тест открылся", await toTest());
  const a1 = await answer(true, 1600);
  const q1 = await queue();
  ok("OFFLINE: нет сети — «что выбрал» не ушёл", of(calls, "log_quiz_pick").length === 0, calls.map((c) => c.fn));
  ok("OFFLINE: в очереди телефона оба, ответ первым", q1.map((x) => x.fn).join(",") === "log_quiz_answer,log_quiz_pick"
    && q1[0].params.p_question === a1.q && q1[1].params.p_question === a1.q && q1[1].params.p_answer === a1.target, q1.map((x) => [x.fn, x.params.p_question]));
  net.log_quiz_answer = "ok";
  const a2 = await answer(true, 2500);
  const order = calls.filter((c) => c.res === "ok" && /log_quiz_(answer|pick)/.test(c.fn)).map((c) => c.fn + ":" + (c.body.p_question === a1.q ? 1 : c.body.p_question === a2.q ? 2 : 0));
  ok("OFFLINE: сеть вернулась — очередь ушла, ответ раньше своего «что выбрал»", order.indexOf("log_quiz_answer:1") >= 0 && order.indexOf("log_quiz_pick:1") > order.indexOf("log_quiz_answer:1")
    && order.indexOf("log_quiz_pick:2") > order.indexOf("log_quiz_answer:2"), order);
  ok("OFFLINE: очередь пуста", (await queue()).length === 0, await queue());
});

if (want("DROP")) await session(STAFF, { log_quiz_answer: "drop" }, null, async ({ calls, toTest, answer, queue }) => {
  ok("DROP: тест открылся", await toTest());
  await answer(false, 2200); await answer(true, 1400);
  ok("DROP: сервер отверг ответ — «что выбрал» не отправлен", of(calls, "log_quiz_answer").length === 2 && of(calls, "log_quiz_pick").length === 0, calls.map((c) => c.fn));
  ok("DROP: и в очередь не лёг", (await queue()).length === 0, await queue());
});

if (want("PLATE")) {
  const Q1 = "Гость-молчун ничего не просит и почти не реагирует. Тактика:", R1 = "Работаю чётко и быстро, без лишних вопросов";
  const Q2 = "Гость торопится. Что важнее всего сказать при рекомендации?", R2 = "Называю быстрые блюда и время их готовки", W2 = "Называю фирменное блюдо: его хвалят все";
  const row = (question, fails, last_answer, right_answer) => ({ employee: "Анна Смирнова", restaurant: "Два моря, Океан", emp_position: "waiter", lesson_id: "s2-q",
    question, fails, total: fails + 1, last_answer, right_answer, last_ts: new Date().toISOString() });
  await session(OWNER, {}, { quiz_people: [row(Q2, 2, W2, R2), row(Q1, 1, R1, R1)], quiz_skips_list: [], quiz_hard_questions: [] }, async ({ page }) => {
    await page.evaluate(() => window.__saNav("analytics")); await page.waitForTimeout(2500);
    ok("PLATE: «Люди» — Анна Смирнова в списке", await page.evaluate(() => /Анна Смирнова/.test(document.body.innerText)));
    await page.evaluate(() => { const n = [...document.querySelectorAll("span")].find((e) => e.textContent.trim() === "Анна Смирнова"); if (n) n.closest("[data-lens-edge]").firstElementChild.click(); });
    await page.waitForTimeout(1200);
    const plates = await page.evaluate(({ Q1, Q2 }) => [Q1, Q2].map((q) => { const t = [...document.querySelectorAll("div")].find((d) => d.textContent.trim() === q && d.children.length === 0);
      const box = t && t.parentElement && t.parentElement.parentElement; return box ? box.innerText.replace(/\s+/g, " ").trim() : null; }), { Q1, Q2 });
    ok("PLATE: у «Гость-молчун» нет «Выбрал», «Верно» на месте", !!plates[0] && !/Выбрал/.test(plates[0]) && plates[0].includes("Верно") && plates[0].includes(R1), plates[0]);
    ok("PLATE: где «Выбрал» другое — оба, как раньше, и ×2", !!plates[1] && /Выбрал\s*Называю фирменное блюдо: его хвалят все/.test(plates[1]) && /Верно\s*Называю быстрые блюда и время их готовки/.test(plates[1]) && plates[1].includes("×2"), plates[1]);
    const box = await page.evaluate((q) => { const t = [...document.querySelectorAll("div")].find((d) => d.textContent.trim() === q && d.children.length === 0);
      const el = t && t.parentElement && t.parentElement.parentElement; if (!el) return null; el.scrollIntoView({ block: "center" }); return true; }, Q1);
    if (box) { await page.waitForTimeout(400); await page.screenshot({ path: OUT + "/plate.png" }); }
  });
}

server.close();
console.log(`\nпроверок: ${pass + fail}, прошло ${pass}, упало ${fail}`);
process.exit(fail ? 1 : 0);
