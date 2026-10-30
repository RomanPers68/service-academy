// e2e: формат «у стола» в приложении (v27) — меню раздела, практика, проверка после урока,
// повтор ошибки, продолжение с места, классический вид, кнопка «Назад» Telegram.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = "/home/claude/preview/site", PORT = 5194, OUT = "/home/claude/preview/shots-table2";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { SEASONAL_MODULES } = await import(SRC + "/data/modules-seasonal.js");
const ALL_SITS = SEASONAL_MODULES.flatMap(m => m.lessons).filter(l => l.type === "practice").flatMap(l => l.situations);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const prof = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false };
const uk = `_${prof.name}_${prof.surname}`;
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function open({ storage = {}, telegram = false, light = false, w = 390, h = 844 }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const fn = m[1];
      const mock = {
        whoami: { ok: true, employee: { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false } },
        my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: Object.keys(storage["sa_completed{uk}"] || {}), stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "none" },
      };
      if (mock[fn] !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[fn]) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    }
    return route.abort();
  });
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(prof), sa_a11y: light ? "1" : "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_last_role: JSON.stringify("seasonal"), sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0" };
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
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

const text = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
async function toModule(page, title = "Психология первого дня") {
  await page.evaluate(() => window.__saNav("home")); await sleep(1500);
  // v28 (Доп. 307): трек — меню тем, листаются; тема выбирается номером в оглавлении
  await page.locator('.tbp-num[aria-label*="' + title + '"]').first().click({ timeout: 5000 });
  await sleep(900);
}
// какой вариант верный — по тексту ситуации на экране
async function correctText(page) {
  const info = await page.evaluate(() => {
    const t = (sel) => { const el = document.querySelector(".tb " + sel); return el ? el.innerText.trim() : ""; };
    return { scene: t(".tb-scene p"), claim: t(".tb-claim"), cloze: t(".tb-note.cloze p") };
  });
  let s = null;
  if (info.scene) s = ALL_SITS.find(x => x.scene && x.scene.trim() === info.scene);
  else if (info.claim) s = ALL_SITS.find(x => x.statement && info.claim.includes(x.statement.replace(/^«|»$/g, "").slice(0, 30)));
  else if (info.cloze) s = ALL_SITS.find(x => x.start && info.cloze.startsWith(x.start.trim().slice(0, 25)));
  if (!s) return null;
  const right = s.options[s.correct];
  if ((s.genre || s.type) === "truefalse") return /невер|❌/i.test(right) ? "Миф" : "Правда";
  return right;
}
async function pickOption(page, want, good = true) {
  const btns = page.locator(".tb .tb-actc, .tb .tb-reply, .tb .tb-chip2, .tb .tb-myth button");
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const t = (await btns.nth(i).innerText()).trim().replace(/\s+/g, " ");
    const hit = t.startsWith(want.replace(/\s+/g, " ").slice(0, 20)) || (want.length <= 6 && t.startsWith(want));
    if (good ? hit : !hit) { await btns.nth(i).click(); return t; }
  }
  return null;
}
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });


const S1P = SEASONAL_MODULES.find(m => m.id === "s1").lessons.find(l => l.type === "practice");
const S0P = SEASONAL_MODULES.find(m => m.id === "s0").lessons.find(l => l.type === "practice");
const tIdx = S1P.situations.findIndex(s => (s.genre || s.type) === "timer");
const ymdL = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const yest = new Date(); yest.setDate(yest.getDate() - 1);
// раунд s1-p, где вторая ситуация — «быстрое решение», первая уже сыграна
const sits = [S1P.situations[0], S1P.situations[tIdx], ...S1P.situations.filter((_, i) => i !== 0 && i !== tIdx).slice(0, 4)];
const round = { step: 1, choice: null, isAnswered: false, results: [true], done: false, lives: 3, score: 10, combo: 1, situations: sits, flash: null, usedIds: [] };
const { ctx, page, errors } = await open({ telegram: true, storage: {
  "sa_completed{uk}": { "s0-1": true },
  "sa_practice_resume{uk}": { "s1-p": { at: Date.now(), ps: round } },
  "sa_streak{uk}": { count: 6, best: 6, last: ymdL(yest), days: [ymdL(yest)] },
} });
const tag = "rv";
// (5) пройденный урок не «продолжается»
await toModule(page);
await page.locator(".tbm-node:not(.tbp-side *)", { hasText: "Первый день: нормально бояться" }).first().click(); await sleep(1000);
await page.locator("span", { hasText: /^›$/ }).last().click(); await sleep(350);
await page.locator("span", { hasText: /^›$/ }).last().click(); await sleep(350);
await page.evaluate(() => window.__bb.press()); await sleep(900);
await page.locator(".tbm-node:not(.tbp-side *)", { hasText: "Первый день: нормально бояться" }).first().click(); await sleep(1000);
ok(tag + ": пройденный урок открывается с начала", !/Продолжаем с того же места/i.test(await text(page)));
await page.evaluate(() => window.__bb.press()); await sleep(900);
// (1) открыть практику s0-p и выйти — сохранённый раунд s1-p не пропадает
await page.locator(".tbm-node:not(.tbp-side *)", { hasText: "Практика: первый день" }).first().click(); await sleep(1200);
await page.locator(".tb-x").click(); await sleep(900);
const saved = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_practice_resume" + uk) || "{}"), uk);
ok(tag + ": открыл другую практику — раунд s1-p на месте", !!saved["s1-p"], Object.keys(saved).join(","));
// (2) таймер стоит, пока открыт вопрос «Выйти?»
await toModule(page, "Мышление сервиса");
await page.locator(".tbm-node:not(.tbp-side *)", { hasText: S1P.title }).first().click(); await sleep(1300);
let t = await text(page);
ok(tag + ": раунд s1-p продолжился со 2-й ситуации (быстрое решение)", /Ситуация 2 из/i.test(t) && /быстрое решение/i.test(t), t.slice(0, 120));
await page.evaluate(() => window.__bb.press()); await sleep(400);
ok(tag + ": «Назад» открыл «Выйти из практики?»", /Выйти из практики\?/i.test(await text(page)));
await sleep(13500);
t = await text(page);
ok(tag + ": под вопросом время не вышло (тарелки целы)", !/время вышло/i.test(t) && (await page.locator(".tb .tb-plate.broken").count()) === 0);
await page.evaluate(() => window.__bb.press()); await sleep(500);
ok(tag + ": «Остаться» — вопрос закрыт", !/Выйти из практики\?/i.test(await text(page)));
await sleep(7000);
ok(tag + ": через 7 с после «Остаться» время ещё идёт", !/время вышло/i.test(await text(page)));
await sleep(6500);
t = await text(page);
ok(tag + ": отсчёт заново — через 12 с «время вышло»", /время вышло/i.test(t) && (await page.locator(".tb .tb-plate.broken").count()) === 1);
const bank1 = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]"), uk);
ok(tag + ": «время вышло» попало в «Работу над ошибками»", bank1.some(m => m.from === "practice"), String(bank1.length));
// (3) классический вид: промах тоже в банк
await page.locator(".tb-foot .tb-main").click(); await sleep(500);
await page.locator("[aria-label='Классический вид практики']").click(); await sleep(600);
const n0 = (await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]"), uk)).length;
const scene = await page.evaluate(() => { const ps = [...document.querySelectorAll("div")].map(d => d.innerText).filter(x => x && x.length > 20); return ps; });
// выбрать заведомо неверный: ищем ситуацию по тексту и жмём вариант не равный верному
const cur = sits.find(s => (s.scene || s.statement || s.start) && scene.some(x => x.includes((s.scene || s.statement || s.start).slice(0, 30))));
let clicked = false;
if (cur) {
  const right = cur.options[cur.correct];
  const opts = page.locator(".sa-opt");
  const n = await opts.count();
  for (let i = 0; i < n; i++) { const tx = (await opts.nth(i).innerText()).trim(); if (tx && !tx.includes(right.slice(0, 15))) { await opts.nth(i).click(); clicked = true; break; } }
}
await sleep(700);
const n1 = (await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]"), uk)).length;
ok(tag + ": классический вид — промах тоже в «Работе над ошибками»", clicked && n1 === n0 + 1, n0 + " → " + n1);
await page.locator("[aria-label='Вид «у стола»']").click(); await sleep(500);
// (7) доигрываем: серия отмечена в момент итога, ещё до «Продолжить»
for (let i = 0; i < 16; i++) {
  if (/Практика пройдена|Раунд окончен/i.test(await text(page))) break;
  const main = page.locator(".tb-foot .tb-main");
  if (await main.count()) { await main.click(); await sleep(450); continue; }
  const want = await correctText(page);
  const r = await pickOption(page, want || "", true);
  if (!r) { const any = page.locator(".tb .tb-actc, .tb .tb-chip2, .tb .tb-myth button, .tb .tb-reply"); if (await any.count()) await any.first().click(); }
  await sleep(500);
}
await sleep(900);
const st7 = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_streak" + uk) || "null"), uk);
ok(tag + ": итог раунда — серия уже продлена (7 дней), без «Продолжить»", st7 && st7.count === 7 && st7.last === ymdL(new Date()), JSON.stringify(st7 && { c: st7.count, l: st7.last }));
// (6) вспышка «Серия 7 дней» — поверх слоя урока
const celeb = await page.evaluate(() => { const el = document.querySelector(".sa-celeb"); if (!el) return null; return { parentIsBody: el.parentElement === document.body, z: getComputedStyle(el).zIndex, txt: el.innerText }; });
ok(tag + ": вспышка «Серия 7 дней» поверх урока", !!celeb && celeb.parentIsBody && +celeb.z > 1000 && /Серия 7 дней/.test(celeb.txt), JSON.stringify(celeb));
await shot(page, tag + "-celeb");
ok(tag + ": чек показывает серию 7 со свечой", /Серия\s+7 дней/i.test(await text(page)));
ok(tag + ": ошибок страницы нет", errors.length === 0, errors.join(" | "));
await ctx.close();
console.log(results.join("\n"));
console.log("\nИтого: " + results.filter(r => r.startsWith("✓")).length + " ✓, " + results.filter(r => r.startsWith("✗")).length + " ✗");
await browser.close(); server.close();
