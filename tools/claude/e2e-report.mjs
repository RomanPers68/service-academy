// e2e v29: «Отчёты по сотрудникам» — список, карточка, Excel и PDF (в браузере и через Telegram)
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { execSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = "/home/claude/preview/site", PORT = 5233, OUT = "/home/claude/preview/shots-report";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff": "font/woff" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const F = await import(new URL("./report-fixture.mjs", import.meta.url).href);
const manager = { id: "m1", name: "Пётр", surname: "Иванов", restaurant: "Два моря, Океан", position: "manager", is_admin: false };
const waiter = { id: "a4", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false };
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const people = [
  { id: "a4", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", self: false, last_role: "seasonal", lessons: 7, quiz: 1, wrong30: 4, learning_at: new Date().toISOString(), mistakes: 3, due: 2, days14: 8, seen: new Date().toISOString() },
  { id: "b2", name: "Иван", surname: "Петров", restaurant: "Два моря, Океан", position: "bartender", self: false, last_role: "bar", lessons: 2, quiz: 0, wrong30: 0, learning_at: null, mistakes: 0, due: 0, days14: 0, seen: new Date(Date.now() - 12 * 86400000).toISOString() },
  { id: "m1", name: "Пётр", surname: "Иванов", restaurant: "Два моря, Океан", position: "manager", self: true, last_role: "manager", lessons: 30, quiz: 4, wrong30: 1, learning_at: new Date().toISOString(), mistakes: 0, due: 0, days14: 5, seen: new Date().toISOString() },
];
const petr = { ...F.ivan, person: { id: "m1", name: "Пётр", surname: "Иванов", restaurant: "Два моря, Океан", position: "manager" }, last_role: "manager", seen: new Date().toISOString(), learning_at: new Date().toISOString(), learning: { streak: { count: 2, best: 5 } } };
const byId = { a4: F.anna, b2: F.ivan, m1: petr };
async function open({ profile, telegram = false, stage23 = true }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", acceptDownloads: true });
  const calls = [];
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const fn = m[1]; let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      calls.push({ fn, body });
      const missing = { code: "PGRST202", message: "Could not find the function" };
      const lead = profile.position === "manager";
      const R = {
        whoami: { ok: true, employee: profile }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, my_mentors: { ok: true, rows: [] }, schedule_load: { ok: false, error: "auth" }, menu_get: [],
        report_people: !stage23 ? missing : lead ? { ok: true, scope: "restaurant", restaurant: "Два моря, Океан", rows: people } : { ok: true, scope: "self", restaurant: "Два моря, Океан", rows: [{ ...people[0], self: true }] },
        report_person: !stage23 ? missing : { ok: true, data: byId[body.p_emp] || F.anna },
        report_team: !stage23 ? missing : lead ? { ok: true, scope: "restaurant", restaurant: "Два моря, Океан", people: [F.anna, F.ivan, petr] } : { ok: false, error: "forbidden" },
        report_ticket: { ok: true, ticket: "a".repeat(64) },
        sa_learning_push: { ok: true },
      };
      const r = R[fn] !== undefined ? R[fn] : null;
      return route.fulfill({ status: r && r.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(r) });
    }
    return route.abort();
  });
  const seed = { sa_session_token: "tok", sa_profile: JSON.stringify(profile), sa_a11y: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_last_role: JSON.stringify("seasonal"), sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_track_swiped: "1" };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  await ctx.addInitScript(([seed, telegram]) => {
    if (!sessionStorage.getItem("__s")) { sessionStorage.setItem("__s", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (telegram) {
      window.__dl = [];
      window.Telegram = { WebApp: { initData: "query_id=x&user=%7B%22id%22%3A1%7D&auth_date=1&hash=abc", platform: "ios", initDataUnsafe: {}, ready() {}, expand() {}, setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {},
        downloadFile(p, cb) { window.__dl.push(p); setTimeout(() => cb && cb(true), 30); }, openLink() {},
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
        BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} } } };
    }
  }, [seed, telegram]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load|net::|ERR_/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/"); await page.waitForTimeout(2200);
  return { ctx, page, errors, calls };
}
const text = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));

// ── A. Менеджер: список, карточка, файлы в браузере ──
{
  const tag = "A";
  const { ctx, page, errors, calls } = await open({ profile: manager });
  await page.evaluate(() => window.__saNav("teamHub")); await sleep(1100);
  ok(tag + ": в «Команде» — «Отчёты по сотрудникам»", /Отчёты по сотрудникам/.test(await text(page)));
  await page.locator(".sa-card", { hasText: "Отчёты по сотрудникам" }).first().click(); await sleep(1500);
  let t = await text(page);
  ok(tag + ": список: ресторан и 3 сотрудника, внимание — 1", /Два моря, Океан/.test(t) && /3 сотрудника/.test(t) && /требуют внимания: 1/.test(t), t.slice(0, 200));
  ok(tag + ": первым — кто требует внимания (Иван, 12 дней)", (await page.locator(".rp-row").first().innerText()).includes("Иван Петров"));
  ok(tag + ": в строке Анны — ошибки, повтор, дни", /ошибок за 30 дней 4/.test(t) && /на повтор 2/.test(t) && /дней из 14 8/.test(t));
  await page.screenshot({ path: OUT + "/A1-list.png" });
  await page.locator(".rp-row", { hasText: "Анна Смирнова" }).click(); await sleep(1300);
  t = await text(page);
  ok(tag + ": карточка Анны: трек, тесты, ошибки, повтор", /Трек «Новичок»/.test(t) && /63%/.test(t) && /Ждут повтора/.test(t) && /Где ошибается/.test(t), t.slice(0, 220));
  ok(tag + ": где ошибается — что выбрал и как верно", /Ответил: Сзади гостя/.test(t) && /Верно: Со стороны гостя/.test(t) && /потом ответил верно/.test(t));
  ok(tag + ": с чем работать, что не пройдено, навыки, дни", /С чем работать/.test(t) && /Мышление сервиса/.test(t) && /Что не пройдено/.test(t) && /в зале ✓/.test(t) && /по PIN ✓/.test(t) && /Дни занятий/.test(t));
  await page.screenshot({ path: OUT + "/A2-person.png", fullPage: true });
  const [d1] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.locator(".rp-btn", { hasText: "PDF-карточка" }).click()]);
  const pdfPath = OUT + "/anna.pdf"; await d1.saveAs(pdfPath);
  const pdfText = execSync("pdftotext -layout " + pdfPath + " -").toString();
  ok(tag + ": PDF-карточка скачалась и читается", /Анна Смирнова/.test(pdfText) && /Где ошибается/.test(pdfText) && /Со стороны гостя/.test(pdfText), d1.suggestedFilename());
  await sleep(400);
  ok(tag + ": сообщение «файл скачан»", /файл скачан/.test(await text(page)));
  await page.locator("button.rp-back").click(); await sleep(700);
  ok(tag + ": «Назад» — снова список", (await page.locator(".rp-row").count()) === 3);
  const [d2] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.locator(".rp-btn", { hasText: "Excel по команде" }).click()]);
  const xPath = OUT + "/team.xlsx"; await d2.saveAs(xPath);
  const xl = execSync(`python3 -c "import openpyxl,sys; wb=openpyxl.load_workbook('${xPath}'); print('|'.join(ws.title+':'+str(ws.max_row) for ws in wb.worksheets))"`).toString().trim();
  ok(tag + ": Excel по команде — 6 листов, в сводке 3 человека", /^Сводка:4\|Где ошибается:\d+\|С чем работать:\d+\|Что не пройдено:\d+\|Ждут повтора:\d+\|Навыки:\d+$/.test(xl), xl);
  const [d3] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.locator(".rp-btn", { hasText: "PDF всех карточек" }).click()]);
  const tp = OUT + "/team.pdf"; await d3.saveAs(tp);
  const pages = execSync("pdfinfo " + tp + " | grep Pages").toString();
  ok(tag + ": PDF всех карточек — обложка и карточки", /Pages:\s+([4-9]|\d\d)/.test(pages) && /ОТЧЁТ ПО КОМАНДЕ/.test(execSync("pdftotext " + tp + " -").toString()), pages.trim());
  ok(tag + ": данные — через report_people/report_person/report_team", ["report_people", "report_person", "report_team"].every(f => calls.some(c => c.fn === f)));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── B. Telegram: файл уходит через билет и downloadFile ──
{
  const tag = "B";
  const { ctx, page, errors, calls } = await open({ profile: manager, telegram: true });
  await page.evaluate(() => window.__saNav("analytics")); await sleep(1300);
  ok(tag + ": в «Аналитике» — карточка «Отчёт по сотруднику»", /Отчёт по сотруднику/.test(await text(page)));
  await page.getByRole("button", { name: /Отчёт по сотруднику/ }).click(); await sleep(1400);
  await page.locator(".rp-btn", { hasText: "Excel по команде" }).click(); await sleep(1200);
  const dl = await page.evaluate(() => window.__dl);
  const tk = calls.find(c => c.fn === "report_ticket");
  ok(tag + ": билет на Excel с готовым отчётом", !!tk && tk.body.p_kind === "team_xlsx" && tk.body.p_payload && tk.body.p_payload.kind === "team" && tk.body.p_payload.people.length === 3);
  ok(tag + ": Telegram получил ссылку /api/report?t=… и имя файла", dl.length === 1 && /\/api\/report\?t=a{64}$/.test(dl[0].url) && /\.xlsx$/.test(dl[0].file_name), JSON.stringify(dl));
  ok(tag + ": подсказка «файл уходит в Telegram»", /Файл уходит в Telegram/.test(await text(page)));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── C. Сотрудник: «Мой отчёт» — сразу своя карточка, без командных кнопок ──
{
  const tag = "C";
  const { ctx, page, errors } = await open({ profile: waiter });
  await page.evaluate(() => window.__saNav("me")); await sleep(1100);
  ok(tag + ": во вкладке «Я» — «Мой отчёт»", /Мой отчёт/.test(await text(page)));
  await page.locator(".sa-card", { hasText: "Мой отчёт" }).first().click(); await sleep(1600);
  const t = await text(page);
  ok(tag + ": сразу своя карточка", /МОЙ ОТЧЁТ/i.test(t) && /Анна Смирнова/.test(t) && /PDF-карточка/.test(t) && !/Excel по команде/.test(t), t.slice(0, 160));
  await page.locator("button.rp-back").click(); await sleep(800);
  ok(tag + ": «Назад» — во вкладку «Я»", /Мой отчёт/.test(await text(page)) && (await page.locator(".rp").count()) === 0);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── D. Без этапа 23 — честное сообщение ──
{
  const tag = "D";
  const { ctx, page, errors } = await open({ profile: manager, stage23: false });
  await page.evaluate(() => window.__saNav("teamHub")); await sleep(1000);
  await page.locator(".sa-card", { hasText: "Отчёты по сотрудникам" }).first().click(); await sleep(1400);
  ok(tag + ": нет этапа 23 — объясняем, что применить", /supabase-stage23-reports\.sql/.test(await text(page)));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── E. Светлая тема ──
{
  const { ctx, page, errors } = await open({ profile: manager });
  await page.evaluate(() => { localStorage.setItem("sa_a11y", "1"); });
  await page.reload(); await sleep(2000);
  await page.evaluate(() => window.__saNav("teamHub")); await sleep(1000);
  await page.locator(".sa-card", { hasText: "Отчёты по сотрудникам" }).first().click(); await sleep(1300);
  await page.screenshot({ path: OUT + "/E1-list-light.png" });
  await page.locator(".rp-row", { hasText: "Анна Смирнова" }).click(); await sleep(1300);
  await page.screenshot({ path: OUT + "/E2-person-light.png", fullPage: true });
  ok("E: светлая тема без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log(results.join("\n"));
console.log(`\nИтого: ${results.filter(r => r.startsWith("✓")).length} из ${results.length}`);
await browser.close(); server.close();
