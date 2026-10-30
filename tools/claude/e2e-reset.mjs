// e2e-reset.mjs — сброс руководителем чистит и телефон сотрудника (этап 20)
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = "/home/claude/preview/site", PORT = 5244;
const { HINTS, HINTS_VERSION } = await import("/home/claude/work/service-academy/data/hints.js");
const server = http.createServer((q, r) => { const p = decodeURIComponent(q.url.split("?")[0]); let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  r.writeHead(200, { "Content-Type": { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" }[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const results = []; const check = (n, c, x = "") => results.push(`${c ? "✓" : "✗"} ${n}${x ? " — " + x : ""}`);
const UK = "_Анна_Смирнова";
const RESET_TS = "2026-09-23T10:00:00+00:00";
const calls = []; let keysOnServer = 0; let state = null;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route("**/*", async (route) => {
  const u = route.request().url();
  if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
  const m = u.match(/\/rpc\/([a-z_0-9]+)/); const fn = m && m[1];
  if (fn) calls.push(fn);
  if (fn === "my_reset_at") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reset_at: RESET_TS }) });
  if (fn === "my_state") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state || { ok: false }) });
  if (fn === "quiz_key_rank") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, mine: keysOnServer, place: 1, players: 2, leader: keysOnServer, tied: false }) });
  if (fn === "whoami") return route.abort();
  if (fn) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  return route.abort();
});
const progress = { "spg-m0-l0": true, "spg-m0-l1": true };
const seed = { sa_session_token: "p", sa_a11y: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_last_role: JSON.stringify("spg"),
  sa_profile: JSON.stringify({ id: "u", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter" }),
  ["sa_completed" + UK]: JSON.stringify(progress), ["sa_quiz_done" + UK]: JSON.stringify({ "spg-0-q": true }),   // Доп. 286: ключ личный
  ["sa_mistakes" + UK]: JSON.stringify([{ q: "Старый вопрос?", options: ["a", "b"], correct: 0, lessonTitle: "Тест", stage: 0, due: 1 }]),
  ["sa_scores" + UK]: JSON.stringify([{ quiz_id: "spg-0-q", score: 5, total: 5 }]),
  ["sa_loopholes" + UK]: JSON.stringify({ "spg-0-q": { exits: 2, answered: 4, n: 3 } }),
  ["sa_qskip" + UK]: JSON.stringify({ "spg-0-q": 2 }), ["sa_qtry" + UK]: JSON.stringify({ "spg-0-q": 3 }),
  ["sa_achv" + UK]: JSON.stringify(["first_test", "streak3"]), ["sa_bar_mastery" + UK]: JSON.stringify({ negroni: 3 }),
  ["sa_daily5" + UK]: JSON.stringify({ day: "2026-09-23", done: 5 }), "sa_al_sprint_best_Анна_Смирнова_Два моря": "42",
  "sa_menu_learned_Два моря": "3", "sa_menu_sr_Два моря": JSON.stringify({ x: 1 }), "sa_rank_snap_week": JSON.stringify({ p: 1 }) };
for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
await ctx.addInitScript((s) => { if (localStorage.getItem("__seeded")) return; localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); localStorage.setItem("__seeded", "1"); }, seed);
const page = await ctx.newPage(); const errors = [];
page.on("pageerror", e => errors.push("сбой: " + e.message));
const ls = (k) => page.evaluate((key) => localStorage.getItem(key), k);
await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(3000);
check("приложение спрашивает метку сброса", calls.includes("my_reset_at"));
check("прохождение на телефоне стёрто", !JSON.parse(await ls("sa_completed" + UK) || "{}")["spg-m0-l0"], (await ls("sa_completed" + UK) || "").slice(0, 60));
check("тесты и баллы стёрты", !(await ls("sa_quiz_done" + UK) || "").includes("spg-0-q") && !(await ls("sa_scores" + UK) || "").includes("spg-0-q"));
check("банк ошибок стёрт", !(await ls("sa_mistakes" + UK) || "").includes("Старый вопрос"));
check("записи секретной ачивки стёрты — счёт ключей начнётся заново",
  !(await ls("sa_loopholes" + UK) || "").includes("spg-0-q") && !(await ls("sa_qskip" + UK) || "").includes("spg-0-q") && !(await ls("sa_qtry" + UK) || "").includes("spg-0-q"),
  (await ls("sa_loopholes" + UK) || "пусто").slice(0, 40));
check("ачивки и рекорды тренажёров стёрты", await page.evaluate(() => {
  const left = Object.keys(localStorage).filter(k => /^sa_(achv|bar_mastery|daily5|al_sprint_best|menu_learned_|menu_sr_|rank_snap_)/.test(k));
  return left.length === 0 ? "" : left.join(",");
}) === "", await page.evaluate(() => Object.keys(localStorage).filter(k => /^sa_(achv|bar_|daily5|al_sprint|menu_learned|menu_sr|rank_snap)/.test(k)).join(",")));
check("метка запомнена", (await ls("sa_reset_seen" + UK) || "").includes("2026-09-23"));
// телефон, где очистка уже проходила по старой версии: должен прибраться ещё раз
await page.evaluate((ts) => {
  localStorage.setItem("sa_reset_seen_Анна_Смирнова", ts);          // метка без версии — как было раньше
  localStorage.setItem("sa_loopholes_Анна_Смирнова", JSON.stringify({ "spg-0-q": { exits: 2, n: 4 } }));
  localStorage.setItem("sa_completed_Анна_Смирнова", JSON.stringify({ "spg-m0-l0": true }));
}, RESET_TS);
await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(2500);
check("старая метка без версии — очистка проходит ещё раз", !(await ls("sa_loopholes" + UK) || "").includes("spg-0-q"), (await ls("sa_loopholes" + UK) || "пусто").slice(0, 40));
check("после этого метка с версией запомнена", (await ls("sa_reset_seen" + UK) || "").includes("|v"), await ls("sa_reset_seen" + UK));
// второй вход с той же меткой: свежий прогресс не трогаем
await page.evaluate(() => { localStorage.setItem("sa_completed_Анна_Смирнова", JSON.stringify({ "spg-m0-l0": true })); });
await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(2500);
check("с той же меткой повторно не чистит — новый прогресс на месте", !!JSON.parse(await ls("sa_completed" + UK) || "{}")["spg-m0-l0"]);
// «Открыть тест заново»: на сервере сданных тестов не осталось, на телефоне отметка есть
state = { ok: true, quiz: [], lessons: ["spg-m0-l0"] };
await page.evaluate(() => {
  localStorage.setItem("sa_quiz_done_Анна_Смирнова", JSON.stringify({ "spg-0-q": true }));   // Доп. 286: ключ личный
  localStorage.setItem("sa_completed_Анна_Смирнова", JSON.stringify({ "spg-m0-l0": true, "spg-m0-l9": true }));
});
await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(2600);
check("сервер: сданных тестов нет — отметка на телефоне убрана", (await ls("sa_quiz_done" + UK) || "{}") === "{}", await ls("sa_quiz_done"));
check("сервер: лишний пройденный урок с телефона убран, настоящий остался",
  !(await ls("sa_completed" + UK) || "").includes("spg-m0-l9") && (await ls("sa_completed" + UK) || "").includes("spg-m0-l0"), await ls("sa_completed" + UK));
state = null;
// сервер — главный по ключам: метку не трогаем, а на телефоне записей больше
keysOnServer = 1;
await page.evaluate(() => {
  localStorage.setItem("sa_loopholes_Анна_Смирнова", JSON.stringify([
    { lessonId: "a", n: 10, seen: true }, { lessonId: "b", n: 11, seen: true }, { lessonId: "c", n: 12, seen: true }]));
});
await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(2600);
const recs = JSON.parse(await ls("sa_loopholes" + UK) || "[]");
check("сервер говорит «1 ключ» — список на телефоне подрезан и перенумерован", recs.length === 1 && recs[0].n === 1, JSON.stringify(recs).slice(0, 80));
// сброс самого себя прямо в приложении: телефон чистится сразу, без перезапуска
state = null; keysOnServer = 5;
await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(2200);
await page.evaluate(() => {
  localStorage.setItem("sa_loopholes_Анна_Смирнова", JSON.stringify([{ lessonId: "a", n: 1 }, { lessonId: "b", n: 2 }]));
  localStorage.setItem("sa_completed_Анна_Смирнова", JSON.stringify({ "spg-m0-l0": true }));
  localStorage.setItem("sa_achv_Анна_Смирнова", JSON.stringify(["first"]));
});
const selfReset = await page.evaluate(async () => {
  const fn = window.__saResetSelf; if (!fn) return "нет кнопки";
  await fn(); return "ок";
});
await page.waitForTimeout(1200);
check("сброс самого себя: телефон очищен сразу", selfReset !== "нет кнопки" && !(await ls("sa_loopholes" + UK) || "").includes("lessonId") && !(await ls("sa_achv" + UK) || "").includes("first"),
  selfReset + " · " + (await ls("sa_loopholes" + UK) || "пусто"));
check("ошибок страницы нет", errors.length === 0, errors.slice(0, 2).join(" | "));
console.log(results.join("\n"));
await browser.close(); server.close();
