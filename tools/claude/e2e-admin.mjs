// e2e-admin.mjs — «Управление данными»: строки, поиск, свайп, лист действий (правка 182)
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = "/home/claude/preview/site", PORT = 5252;
const { HINTS, HINTS_VERSION } = await import("/home/claude/work/service-academy/data/hints.js");
const server = http.createServer((q, r) => { const p = decodeURIComponent(q.url.split("?")[0]); let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  r.writeHead(200, { "Content-Type": { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" }[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const results = []; const check = (n, c, x = "") => results.push(`${c ? "✓" : "✗"} ${n}${x ? " — " + x : ""}`);
const people = [["Иван", "Иванов", "waiter", 0, 0], ["Кристина", "Кочнева", "hostess", 3, 0], ["Дмитрий", "Блеклов", "bartender", 7, 0],
  ["Екатерина", "Лучко", "waiter", 2, 20], ["Марк", "Финке", "hostess", 0, 0]];
const scores = []; let sid = 0;
people.forEach(([n, s, pos, cnt, d]) => { for (let j = 0; j < cnt; j++) scores.push({ id: ++sid, name: n, surname: s, restaurant: "Два моря, Океан",
  role: "spg", position: pos, quiz_id: "q" + j, score: 9, total: 10, updated_at: new Date(Date.now() - d * 86400000).toISOString() }); });
const profiles = people.map(([n, s, pos], i) => ({ id: "u" + i, name: n, surname: s, restaurant: "Два моря, Океан", position: pos }));
const calls = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route("**/*", async (route) => {
  const req = route.request(), u = req.url();
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
  const m = u.match(/\/rpc\/([a-z_0-9]+)/);
  if (m) { calls.push({ fn: m[1], body: JSON.parse(req.postData() || "{}") }); if (m[1] === "whoami") return route.abort();
    // v32: с этапа 21 приложение берёт команду и результаты через team_scores / team_profiles
    if (m[1] === "team_scores") return json({ ok: true, rows: scores });
    if (m[1] === "team_profiles") return json({ ok: true, rows: profiles, scope: "restaurant" });
    return json({ ok: true, rows: 2 }); }
  if (u.includes("/rest/v1/scores")) return json(scores);
  if (u.includes("/rest/v1/profiles")) return json(profiles);
  if (u.includes("/rest/v1/")) return json([]);
  return route.abort();
});
const seed = { sa_session_token: "p", sa_a11y: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_last_role: JSON.stringify("spg"),
  sa_profile: JSON.stringify({ id: "adm", name: "Роман", surname: "Переверзев", restaurant: "Два моря, Океан", position: "senior", is_admin: true }),
  sa_admin_swipe_seen: "1" };   // подсказка-приоткрытие не должна мешать замеру
for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
await ctx.addInitScript((s) => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
const page = await ctx.newPage(); const errors = [];
page.on("pageerror", e => errors.push("сбой: " + e.message));
page.on("dialog", d => d.accept());
const text = () => page.evaluate(() => document.body.innerText);
await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(1700);
await page.evaluate(() => window.__saNav && window.__saNav("stats")); await page.waitForTimeout(1600);
await page.evaluate(() => { const el = [...document.querySelectorAll("div")].find(d => (d.innerText || "").trim().startsWith("УПРАВЛЕНИЕ ДАННЫМИ")); if (el) el.scrollIntoView({ block: "start" }); const r = document.getElementById("root"); if (r) r.scrollTop -= 60; });
await page.waitForTimeout(500);
let t = await text();
check("строки со сводкой: должность, тесты, средний балл", /Кристина Кочнева/.test(t) && /Хостес · 3 теста · 90%/.test(t) && /Иван Иванов/.test(t) && /Официант · не начинал/.test(t), (t.match(/Кристина[^\n]*\n[^\n]*/) || [""])[0]);
check("метки: «НОВЫЙ» у не начавших, «дн.» у уснувших", /НОВЫЙ/.test(t) && /20 ДН\./i.test(t), (t.match(/[^\n]*ДН\.[^\n]*/i) || [""])[0]);
// поиск
await page.fill('input[placeholder="Найти сотрудника"]', "блекл"); await page.waitForTimeout(400); t = await text();
check("поиск оставляет одного", /Дмитрий Блеклов/.test(t) && !/Кристина/.test(t));
await page.fill('input[placeholder="Найти сотрудника"]', ""); await page.waitForTimeout(300);
// фильтр «Не начали»
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => (x.innerText || "").trim() === "Не начали"); if (b) b.click(); });
await page.waitForTimeout(400); t = await text();
check("фильтр «Не начали»: только они", /Иван Иванов/.test(t) && /Марк Финке/.test(t) && !/Дмитрий Блеклов/.test(t));
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => (x.innerText || "").trim() === "Все"); if (b) b.click(); });
await page.waitForTimeout(400);
// свайп настоящим перетаскиванием
const box = await page.evaluate(() => { const r = document.querySelector('[data-row="player"]'); window.__row = r; if (!r) return null; const b = r.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
check("строка на месте", !!box);
if (box) {
  await page.mouse.move(box.x + box.w * 0.45, box.y + box.h / 2);
  await page.mouse.down();
  for (const dx of [10, 40, 90, 140]) { await page.mouse.move(box.x + box.w * 0.45 - dx, box.y + box.h / 2); await page.waitForTimeout(40); }
  await page.mouse.up(); await page.waitForTimeout(500);
  const moved = await page.evaluate(() => (window.__row ? getComputedStyle(window.__row).transform : ""));
  check("свайп сдвигает строку и открывает действия", /matrix\(1, 0, 0, 1, -1[0-9][0-9]/.test(moved), moved);
  await page.screenshot({ path: "/home/claude/preview/shots/adm-swipe.png" });
  await page.evaluate(() => { const el = [...document.querySelectorAll("div")].filter(d => /ТЕСТЫ/.test(d.innerText || "") && d.getBoundingClientRect().width < 120).pop(); if (el) el.click(); });
  await page.waitForTimeout(600);
  check("кнопка «Тесты» зовёт разблокировку", calls.some(c => c.fn === "admin_unlock_quiz"), JSON.stringify(calls.map(c => c.fn)));
}
// лист действий
// нажимаем «⋯» как пальцем: строка тоже слушает нажатия и раньше перехватывала их
const mb = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].filter(x => (x.innerText || "").trim() === "⋯")[1]; if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
check("кнопка «⋯» на месте", !!mb);
await page.mouse.move(mb.x, mb.y); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
await page.waitForTimeout(700); t = await text();
check("нажатие «⋯» открывает лист, а не уводит на карточку", /Карточка обучения/.test(t) && /УПРАВЛЕНИЕ ДАННЫМИ/.test(t), t.slice(0, 90).replace(/\s+/g, " "));
check("«⋯» открывает лист со всеми действиями", /Карточка обучения/.test(t) && /Разблокировать тесты/.test(t) && /Сбросить прогресс/.test(t) && /Удалить сотрудника/.test(t));
await page.evaluate(() => { const el = [...document.querySelectorAll("div")].filter(d => d.children.length <= 2 && /Сбросить прогресс/.test(d.innerText || "")).pop(); if (el) el.click(); });
await page.waitForTimeout(400); t = await text();
check("сброс спрашивает подтверждение", /Точно сбросить прогресс\?/.test(t));
await page.evaluate(() => { const el = [...document.querySelectorAll("div")].filter(d => d.children.length <= 2 && /Точно сбросить прогресс/.test(d.innerText || "")).pop(); if (el) el.click(); });
await page.waitForTimeout(700);
check("после подтверждения зовётся сброс", calls.some(c => c.fn === "admin_reset_player"), JSON.stringify(calls.map(c => c.fn)));
check("ошибок страницы нет", errors.length === 0, errors.slice(0, 2).join(" | "));
console.log(results.join("\n"));
await browser.close(); server.close();
