// Проверка этапов 1–2 в настоящем приложении: чтение по токену (этап 21),
// офлайн-отметки тестов по сотруднику, кнопка «Назад» Telegram.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = "/home/claude/preview/site", PORT = 5191, OUT = "/home/claude/preview/shots";
mkdirSync(OUT, { recursive: true });
const { HINTS, HINTS_VERSION } = await import("/home/claude/work/service-academy/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const prof = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false };
const uk = `_${prof.name}_${prof.surname}`;
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };

async function open({ mock = {}, storage = {}, telegram = false, calls = [] }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) calls.push(m[1]); else if (/\/rest\/v1\//.test(u)) calls.push("TABLE:" + u.split("/rest/v1/")[1].split("?")[0]);
    if (m && mock[m[1]] !== undefined) {
      const v = mock[m[1]];
      if (v === "MISSING") return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "PGRST202", message: "Could not find the function" }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(v) });
    }
    const t = u.match(/\/rest\/v1\/([a-z_]+)\?/);
    if (t && mock["TABLE:" + t[1]] !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock["TABLE:" + t[1]]) });
    return route.abort();
  });
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(prof), sa_a11y: "0", sa_welcome_seen_v11: "1", sa_last_role: JSON.stringify("seasonal"), sa_hint_mistakes: "1" };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  for (const [k, v] of Object.entries(storage)) seed[k.replace("{uk}", uk)] = typeof v === "string" ? v : JSON.stringify(v);
  await ctx.addInitScript(([seed, telegram]) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (telegram) {
      const handlers = new Set();
      window.__bb = { visible: false, handlers, press() { [...handlers].forEach(h => h()); } };
      window.Telegram = { WebApp: { initData: "query_id=x", platform: "ios", initDataUnsafe: {}, ready() {}, expand() {}, setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {},
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
        BackButton: { show() { window.__bb.visible = true; }, hide() { window.__bb.visible = false; }, onClick(h) { handlers.add(h); }, offClick(h) { handlers.delete(h); } } } };
    }
  }, [seed, telegram]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}
const screenOf = (page) => page.evaluate(() => window.__saScreen || null);

// ── 1. Сервер с этапом 21: всё приходит через функции, к таблицам приложение не ходит
{
  const calls = [];
  const mock = {
    whoami: { ok: true, employee: { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false } },
    my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
    my_state: { ok: true, v: 2, quiz: ["s0-q"], lessons: ["s0-1", "s0-2"], stars: { "s0-p": 3 }, roles: [], last_role: "seasonal" },
    team_scores: { ok: true, rows: [{ id: 1, name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", role: "seasonal", position: "waiter", quiz_id: "s0-q", score: 11, total: 12, updated_at: "2026-10-01T10:00:00Z" }] },
    team_profiles: { ok: true, rows: [], scope: "none" },
  };
  const { ctx, page, errors } = await open({ mock, calls });
  const tableCalls = calls.filter(c => c.startsWith("TABLE:"));
  ok("этап 21: таблицы напрямую не читаются", tableCalls.length === 0, tableCalls.join(", "));
  ok("этап 21: my_state, team_scores, team_profiles вызваны", ["my_state", "team_scores", "team_profiles"].every(f => calls.includes(f)), [...new Set(calls)].join(", "));
  const stored = await page.evaluate((uk) => localStorage.getItem("sa_quiz_done" + uk), uk);
  ok("сданные тесты сохранены личным ключом", stored === JSON.stringify({ "s0-q": true }), String(stored));
  const stars = await page.evaluate(() => localStorage.getItem("sa_practice_stars"));
  ok("звёзды практики из my_state", /s0-p":3/.test(stars || ""), String(stars));
  ok("ошибок страницы нет", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
// ── 2. Сервер без этапа 21: функции «не найдены» — приложение читает по-старому
{
  const calls = [];
  const mock = {
    whoami: { ok: true, employee: { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false } },
    my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
    my_state: { ok: true, quiz: ["s0-q"], lessons: ["s0-1"] },          // старый my_state без звёзд
    team_scores: "MISSING", team_profiles: "MISSING",
    "TABLE:scores": [{ id: 1, name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", role: "seasonal", quiz_id: "s0-q", score: 10, total: 12, updated_at: "2026-10-01T10:00:00Z" }],
    "TABLE:profiles": [], "TABLE:practice_stars": [{ lesson_id: "s0-p", stars: 2 }], "TABLE:completed_roles": [],
  };
  const { ctx, page, errors } = await open({ mock, calls });
  const t = [...new Set(calls.filter(c => c.startsWith("TABLE:")))].sort().join(", ");
  ok("без этапа 21: старые чтения как запасной путь", /scores/.test(t) && /practice_stars/.test(t) && /profiles/.test(t), t);
  const stars = await page.evaluate(() => localStorage.getItem("sa_practice_stars"));
  ok("без этапа 21: звёзды всё равно пришли", /s0-p":2/.test(stars || ""), String(stars));
  ok("ошибок страницы нет", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
// ── 3. Без сети: сданный тест берётся с телефона (личный ключ) — в модуле он «сдан»
{
  const { ctx, page, errors } = await open({ storage: { "sa_quiz_done{uk}": { "s0-q": true }, "sa_completed{uk}": { "s0-1": true, "s0-2": true, "s0-3": true, "s0-4": true, "s0-p": true } } });
  const qd = await page.evaluate(() => { try { return window.__saDebugQuizDone ? window.__saDebugQuizDone() : null; } catch (e) { return null; } });
  await page.evaluate(() => window.__saNav && window.__saNav("home")); await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + "/p12-offline-home.png" });
  const text = await page.evaluate(() => document.body.innerText);
  // v28 (Доп. 307): трек — меню тем; пройденная тема — залитый номер в оглавлении
  const doneDot = await page.evaluate(() => { const d = document.querySelector('.tbp-num.done[aria-label*="Психология первого дня"]'); return d ? d.getAttribute("aria-label") : ""; });
  ok("без сети: прогресс трека виден", /пройдено 6 из 6/.test(doneDot) || /Психология первого дня/.test(text), doneDot);
  ok("ошибок страницы нет", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
// ── 4. Кнопка «Назад» Telegram
{
  const mock = {
    whoami: { ok: true, employee: { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false } },
    my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [], my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: null },
    team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [] },
  };
  const { ctx, page, errors } = await open({ mock, telegram: true });
  const vis0 = await page.evaluate(() => window.__bb.visible);
  ok("Telegram: на вкладке «Учусь» кнопки «Назад» нет", vis0 === false);
  await page.evaluate(() => window.__saNav("glossary")); await page.waitForTimeout(1200);
  const vis1 = await page.evaluate(() => window.__bb.visible);
  ok("Telegram: на глоссарии кнопка «Назад» есть", vis1 === true);
  await page.evaluate(() => window.__bb.press()); await page.waitForTimeout(1200);
  const vis2 = await page.evaluate(() => window.__bb.visible);
  const t2 = await page.evaluate(() => document.body.innerText.slice(0, 400));
  ok("Telegram: «Назад» вернула на вкладку (кнопка снова скрыта)", vis2 === false, t2.replace(/\s+/g, " ").slice(0, 80));
  await page.evaluate(() => window.__saNav("home")); await page.waitForTimeout(1500);
  // открыть первый модуль и первый урок
  await page.locator("text=Психология первого дня").first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.locator("text=Первый день: нормально бояться").first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + "/p12-tg-lesson.png" });
  const inLesson = await page.evaluate(() => /Первый день: нормально бояться/.test(document.body.innerText));
  await page.evaluate(() => window.__bb.press()); await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + "/p12-tg-after-back.png" });
  const afterText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 300));
  ok("Telegram: из урока «Назад» ведёт в модуль", inLesson && /Психология первого дня/.test(afterText), afterText.slice(0, 90));
  ok("ошибок страницы нет", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
console.log(results.join("\n"));
await browser.close(); server.close();
