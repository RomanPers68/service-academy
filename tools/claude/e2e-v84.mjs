// e2e v84 (Доп. 397): «спасибо» от гостей по QR.
// Разделы:
//   GUEST   — страница гостя ?thanks=код: имя, должность, заведение; приложение не грузится (ни whoami, ни бутстрапа);
//             отметки и пара слов → guest_thanks_send (номер браузера гостя); «Спасибо передано»; повтор — «уже
//             отправлено»; битый и неизвестный код — «ссылка не работает»; 320 px; светлая тема телефона не мешает;
//   STAFF   — «Я» → «Спасибо от гостей»: QR на экране читается камерой (OpenCV) и ведёт на ?thanks=код; «Картинка для
//             печати» — PNG с тем же QR; «Поделиться ссылкой»; счётчики и последние спасибо; «Сменить QR» двумя
//             нажатиями → thanks_rotate и новый QR; подпись пункта «Я» — по my_thanks;
//   LEAD    — «Команда» → «Спасибо от гостей»: кого и за что благодарят, «Скрыть» → thanks_hide; вкладка «Мой QR»;
//   BRIEF   — брифинг смены: блок «Спасибо от гостей», строка в тексте для Telegram;
//   MISSING — нет этапа 34: экран говорит об этом, пункт «Я» пропадает у того, кто экран открывал; страница гостя —
//             «ссылка не работает»;
//   LINK    — ?go=thanks из сообщения бота открывает свой QR;
//   PREFS   — строка «Спасибо от гостей» → notify_set thanks.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v84.mjs [разделы]
// Чтение QR — tools/claude/qr-check.py (нужны python3 и OpenCV).
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5284, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v84";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

const R0 = "Два моря, Океан";
const LEAD = { id: "u-lead", name: "Мария", surname: "Ким", restaurant: R0, position: "senior", is_admin: false };
const STAFF = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const ukOf = (p) => "_" + p.name + "_" + p.surname;
const NOW = new Date("2026-10-23T02:20:00Z");
const CODE = "8457ea0e0b", CODE2 = "1c0ffee123";
const MINE = (code) => ({ ok: true, code, name: "Анна", restaurant: R0, week: 3, month: 5, total: 9, items: [
  { id: 7, tags: ["care", "advice"], text: "Спасибо за совет с вином", at: "2026-10-22T10:00:00Z" },
  { id: 6, tags: [], text: "", at: "2026-10-21T10:00:00Z" },
] });
const TEAM = { ok: true, rows: [{ emp_id: "u-staff", name: "Анна", week: 4, month: 9, tags: { care: 3, advice: 1 } }, { emp_id: "u-ilya", name: "Илья", week: 1, month: 2, tags: { speed: 1 } }],
  items: [{ id: 11, emp_id: "u-staff", name: "Анна", tags: ["care"], text: "Очень внимательная", hidden: false, at: "2026-10-22T10:00:00Z" },
    { id: 12, emp_id: "u-ilya", name: "Илья", tags: [], text: "грубое слово", hidden: false, at: "2026-10-22T09:00:00Z" }] };
const ABORT = Symbol("abort");
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const qrReads = (png, want) => { try { execFileSync("python3", [SRC + "/tools/claude/qr-check.py", png, want], { stdio: "pipe" }); return true; } catch (e) { return String((e.stdout || "") + (e.stderr || "")).trim().slice(0, 200) || false; } };

async function open({ who = STAFF, rpcs = () => undefined, calls = [], light = false, w = 393, h = 852, path = "/", seedExtra = {}, guest = false, scheme = "dark" } = {}) {
  const UK = who ? ukOf(who) : "";
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce", colorScheme: scheme, acceptDownloads: true });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      calls.push({ fn: m[1], body, t: Date.now() });
      const own = rpcs(m[1], body);
      if (own === ABORT) return route.abort();
      if (own !== undefined) return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own) });
      const mock = { whoami: { ok: true, employee: who }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] }, schedule_load: { ok: false, error: "auth" }, menu_get: [],
        qday_inbox: { ok: true, items: [] }, brief_today: { ok: true, brief: null }, case_list: { ok: true, lead: false, team: 0, fresh: 0, inbox: 0, mine_new: 0, top: null } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = {};
  if (!guest) {
    Object.assign(seed, { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
      sa_session_token: "tok-preview", sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
      ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }) });
    for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
    seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  }
  Object.assign(seed, seedExtra);
  await ctx.addInitScript((seed) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
  }, seed);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(ORIGIN + path, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors, calls, UK };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const toTab = async (page, s) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(1400); };

if (want("GUEST")) {
  for (const [w, scheme] of [[393, "dark"], [320, "light"]]) {
    const tag = "GUEST " + w + (scheme === "light" ? " (светлая тема телефона)" : "");
    let sent = null;
    const o = await open({ guest: true, who: null, w, scheme, path: "/?thanks=" + CODE, rpcs: (fn, body) => {
      if (fn === "guest_thanks_card") return body.p_code === CODE ? { ok: true, name: "Анна", pos: "waiter", restaurant: R0 } : { ok: false, error: "not_found" };
      if (fn === "guest_thanks_send") { const dup = !!sent; sent = sent || body; return dup ? { ok: true, dup: true, name: "Анна" } : { ok: true, name: "Анна" }; }
      return undefined;
    } });
    await sleep(1500);
    const form = await txt(o.page.locator("[data-guest-form]"));
    ok(tag + ": гостю — заведение, имя и должность, «За что спасибо?»", /^Два моря, Океан Анна Официант За что спасибо\?/.test(form), form.slice(0, 120));
    ok(tag + ": приложение не грузится: ни входа, ни whoami, ни бутстрапа, ни вкладок", !o.calls.some((c) => /^(whoami|app_bootstrap|my_state)$/.test(c.fn)) && !(await o.page.locator(".sa-card").count())
      && !(await o.page.locator('button:has-text("Войти")').count()), o.calls.map((c) => c.fn).join(","));
    const W = await o.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth }));
    ok(tag + ": без прокрутки вбок", W.sw <= W.w, JSON.stringify(W));
    await o.page.locator('[data-guest-tag="care"]').click(); await o.page.locator('[data-guest-tag="advice"]').click();
    await o.page.locator('[data-guest-tag="smile"]').click(); await o.page.locator('[data-guest-tag="smile"]').click();   // включил и передумал
    await o.page.locator("[data-guest-text]").fill("  Спасибо за совет с вином  ");
    await shot(o.page, "guest-form-" + w);
    await o.page.locator("[data-guest-send]").click(); await sleep(800);
    ok(tag + ": guest_thanks_send — код, отметки, текст, номер браузера", !!sent && sent.p_code === CODE && JSON.stringify(sent.p_tags) === '["care","advice"]' && sent.p_text === "Спасибо за совет с вином" && /^[A-Za-z0-9_-]{8,64}$/.test(sent.p_device || ""), JSON.stringify(sent));
    const dn = await txt(o.page.locator("[data-guest-done]"));
    ok(tag + ": «Спасибо передано. Анна увидит его в приложении.»", /Спасибо передано Анна увидит его в приложении\. Будем рады видеть вас снова\. Два моря, Океан/.test(dn), dn);
    await shot(o.page, "guest-done-" + w);
    const dev = await o.page.evaluate(() => localStorage.getItem("sa_guest_dev"));
    ok(tag + ": номер браузера гостя сохранён (тот же при следующем спасибо)", dev === (sent && sent.p_device), String(dev));
    await o.page.reload({ waitUntil: "load" }); await sleep(1300);
    await o.page.locator("[data-guest-send]").click(); await sleep(800);
    ok(tag + ": второй раз с того же телефона — «Спасибо уже отправлено»", /Спасибо уже отправлено С этого телефона его отправляли сегодня\. Анна увидит его в приложении\./.test(await txt(o.page.locator('[data-guest-done="dup"]'))));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
  for (const [path, what] of [["/?thanks=" + CODE2, "неизвестный код"], ["/?thanks=<script>", "битый код"]]) {
    const o = await open({ guest: true, who: null, path, rpcs: (fn) => (fn === "guest_thanks_card" ? { ok: false, error: "not_found" } : undefined) });
    await sleep(1300);
    ok("GUEST: " + what + " — «Эта ссылка не работает», просьба взять новый QR", /Эта ссылка не работает Попросите у сотрудника новый QR-код/.test(await txt(o.page.locator("[data-guest-gone]")))
      && (what !== "битый код" || !o.calls.some((c) => c.fn === "guest_thanks_card")));
    ok("GUEST: " + what + " — без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("STAFF")) {
  for (const light of [false, true]) {
    const tag = "STAFF" + (light ? " светлая" : "");
    let code = CODE, rotated = 0;
    const o = await open({ who: STAFF, light, rpcs: (fn) => {
      if (fn === "my_thanks") return MINE(code);
      if (fn === "thanks_rotate") { rotated++; code = CODE2; return { ok: true, code }; }
      return undefined;
    } });
    await o.ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
    await sleep(1200); await toTab(o.page, "me");
    const it = o.page.locator('.sa-card[aria-label="Спасибо от гостей"]');
    ok(tag + ": «Я» → «Мой путь»: «Спасибо от гостей» (ещё не открывали — my_thanks не зовём)", /Твой QR: гости говорят спасибо лично тебе/.test(await txt(it)) && !o.calls.some((c) => c.fn === "my_thanks"), await txt(it));
    await it.first().click(); await sleep(1600);
    const svg = o.page.locator("[data-thanks-qr] svg");
    await svg.screenshot({ path: OUT + "/staff-qr" + (light ? "-light" : "") + ".png" });
    const want1 = ORIGIN + "/?thanks=" + CODE;
    const r1 = qrReads(OUT + "/staff-qr" + (light ? "-light" : "") + ".png", want1);
    ok(tag + ": QR на экране читается камерой и ведёт на страницу гостя (" + want1 + ")", r1 === true, String(r1));
    const qv = Number(await o.page.locator("[data-thanks-qr]").getAttribute("data-qr-version"));
    ok(tag + ": QR — маленькая версия (крупные модули): здесь " + qv + ", на сервере приложения — 4", qv >= 1 && qv <= 4, String(qv));
    const stats = await txt(o.page.locator("[data-thanks-stats]"));
    ok(tag + ": счётчики: 3 за неделю, 5 за месяц, 9 всего", /3 за неделю 5 за месяц 9 всего/.test(stats), stats);
    ok(tag + ": последние спасибо — отметки и слова гостя; без слов — так и сказано", /22 октября · внимание к нам, отличный совет «Спасибо за совет с вином»/.test(await txt(o.page.locator('[data-thanks-item="7"]')))
      && /Спасибо без слов/.test(await txt(o.page.locator('[data-thanks-item="6"]'))));
    await shot(o.page, "staff-screen" + (light ? "-light" : ""));
    // картинка для печати. v87 (Доп. 400): сначала выбор вида с предпросмотром (карточка — первой), потом «Сохранить картинку»
    await o.page.locator("[data-thanks-print]").click();
    await o.page.waitForSelector('[data-thanks-preview="card"]', { timeout: 8000 }).catch(() => {});
    const dl = o.page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await o.page.locator("[data-thanks-save]").click();
    const d = await dl;
    let r2 = "нет скачивания";
    if (d) { const p = OUT + "/print-card" + (light ? "-light" : "") + ".png"; await d.saveAs(p); r2 = qrReads(p, want1); }
    ok(tag + ": «Картинка для печати» — PNG, QR на нём читается", r2 === true, String(r2));
    await o.page.locator("[data-thanks-share]").click(); await sleep(500);
    const clip = await o.page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
    ok(tag + ": «Поделиться ссылкой» — ссылка в буфере (или системное меню)", clip === want1 || /Ссылка скопирована/.test(await txt(o.page.locator('[role="status"]'))), clip);
    // сменить QR
    const rot = o.page.locator("[data-thanks-rotate]");
    await rot.click(); await sleep(200);
    ok(tag + ": «Сменить QR» — сначала предупреждает", /Старый QR перестанет работать\. Нажми ещё раз/.test(await txt(rot)) && !rotated);
    await rot.click(); await sleep(1200);
    await svg.screenshot({ path: OUT + "/staff-qr2.png" });
    const r3 = qrReads(OUT + "/staff-qr2.png", ORIGIN + "/?thanks=" + CODE2);
    ok(tag + ": второе нажатие — thanks_rotate и новый QR", rotated === 1 && r3 === true, String(r3));
    // назад в «Я» — подпись по my_thanks
    await o.page.locator('button[aria-label="Вернуться"]').first().click(); await sleep(1200);
    ok(tag + ": в «Я» — «3 раза за неделю гости сказали спасибо · твой QR»", /3 раза за неделю гости сказали спасибо · твой QR/.test(await txt(o.page.locator('.sa-card[aria-label="Спасибо от гостей"]'))));
    ok(tag + ": открывал экран — отметка на телефоне (дальше подпись спрашиваем при входе в «Я»)", (await o.page.evaluate((uk) => localStorage.getItem("sa_thanks_on" + uk), o.UK)) === "1");
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("LEAD")) {
  const hides = [];
  let team = JSON.parse(JSON.stringify(TEAM));
  const o = await open({ who: LEAD, rpcs: (fn, body) => {
    if (fn === "thanks_team") return team;
    if (fn === "thanks_hide") { hides.push(body); team.items = team.items.map((x) => (x.id === body.p_id ? { ...x, hidden: body.p_hidden } : x)); return { ok: true, hidden: body.p_hidden }; }
    if (fn === "my_thanks") return { ...MINE(CODE), name: "Мария" };
    return undefined;
  } });
  await sleep(1200); await toTab(o.page, "teamHub");
  const it = o.page.locator('.sa-card[aria-label="Спасибо от гостей"]');
  ok("LEAD: «Команда» → «Спасибо от гостей» у руководителя", /Кого и за что благодарят гости по QR/.test(await txt(it)), await txt(it));
  await it.first().click(); await sleep(1600);
  ok("LEAD: открывается вкладка «Команда»", (await o.page.locator('[data-thanks-tab="team"]').getAttribute("aria-selected")) === "true");
  const row = await txt(o.page.locator('[data-thanks-row="u-staff"]'));
  ok("LEAD: Анна — 4 за неделю, 9 за месяц, за что чаще", /Анна внимание к нам 3 · отличный совет 1 4 за неделю · 9 за месяц/.test(row), row);
  await shot(o.page, "lead-team");
  await o.page.locator('[data-thanks-hide="12"]').click(); await sleep(900);
  ok("LEAD: «Скрыть» → thanks_hide, текст скрыт с пояснением, можно «Вернуть»", hides.length === 1 && hides[0].p_id === 12 && hides[0].p_hidden === true
    && (await o.page.locator('[data-thanks-titem="12"]').getAttribute("data-hidden")) === "1" && /Скрыто: не видно сотруднику и не считается\./.test(await txt(o.page.locator('[data-thanks-titem="12"]')))
    && /Вернуть/.test(await txt(o.page.locator('[data-thanks-hide="12"]'))), JSON.stringify(hides));
  await o.page.locator('[data-thanks-tab="mine"]').click(); await sleep(1200);
  ok("LEAD: вкладка «Мой QR» — свой QR руководителя", (await o.page.locator("[data-thanks-qr]").count()) === 1 && /Мария/.test(await txt(o.page.locator("[data-thanks-qr]"))));
  ok("LEAD: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("BRIEF")) {
  let published = null;
  const o = await open({ who: LEAD, rpcs: (fn, body) => {
    if (fn === "thanks_team") return TEAM;
    if (fn === "brief_publish") { published = body; return { ok: true, sent: 0, again: false, bot: true }; }
    if (fn === "league_week") return { ok: true, rows: [] };
    if (fn === "quiz_hard_questions") return [];
    return undefined;
  } });
  await sleep(1200); await toTab(o.page, "brief"); await sleep(1400);
  const b = await txt(o.page.locator('[data-brief-block="guests"]'));
  ok("BRIEF: блок «Спасибо от гостей» — кому за неделю и за что", /Спасибо от гостей Анна · 4 за неделю · внимание, совет по меню Илья · 1 за неделю · быстро/.test(b) && (await o.page.locator('[data-brief-block="guests"]').getAttribute("data-on")) === "1", b);
  await o.page.locator("[data-brief-publish]").click(); await sleep(900);
  ok("BRIEF: в тексте для Telegram — «Гости сказали спасибо за неделю: Анна (4), Илья (1)»", String((published && published.p_text) || "").includes("Гости сказали спасибо за неделю: Анна (4), Илья (1)"));
  ok("BRIEF: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("MISSING")) {
  const miss = { code: "PGRST202", message: "Could not find the function" };
  {
    const o = await open({ who: STAFF, rpcs: (fn) => (/thanks/.test(fn) ? miss : undefined) });
    await sleep(1200); await toTab(o.page, "thanks"); await sleep(600);
    ok("MISSING: экран — «На сервере ещё нет этапа 34»", /На сервере ещё нет этапа 34 \(supabase-stage34-guest-thanks\.sql\)/.test(await txt(o.page.locator("body"))));
    ok("MISSING: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
  {
    const o = await open({ who: STAFF, seedExtra: { ["sa_thanks_on" + ukOf(STAFF)]: "1" }, rpcs: (fn) => (/thanks/.test(fn) ? miss : undefined) });
    await sleep(1200); await toTab(o.page, "me"); await sleep(800);
    ok("MISSING: кто экран открывал — в «Я» пункт пропадает (этапа нет)", !(await o.page.locator('.sa-card[aria-label="Спасибо от гостей"]').count()) && (await o.page.locator('.sa-card[aria-label="Мой прогресс"]').count()) === 1);
    await o.ctx.close();
  }
  {
    const o = await open({ guest: true, who: null, path: "/?thanks=" + CODE, rpcs: (fn) => (/thanks/.test(fn) ? miss : undefined) });
    await sleep(1300);
    ok("MISSING: страница гостя — «Эта ссылка не работает»", /Эта ссылка не работает/.test(await txt(o.page.locator("[data-guest-gone]"))));
    await o.ctx.close();
  }
}

if (want("LINK")) {
  const o = await open({ who: STAFF, path: "/?go=thanks", rpcs: (fn) => (fn === "my_thanks" ? MINE(CODE) : undefined) });
  await sleep(2500);
  ok("LINK: ?go=thanks — свой QR", (await o.page.locator("[data-thanks-qr]").count()) === 1);
  ok("LINK: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("PREFS")) {
  let prefs = { ok: true, bot: true, linked: true, remind: true, pair: true, quest: true, league: true, fresh: true, month: true, master: true, qday: true, qday_hour: 12, brief: true, cases: true, thanks: true };
  const o = await open({ who: STAFF, rpcs: (fn, body) => {
    if (fn === "tg_status") return { ok: true, bot: true, linked: true, remind: true, minutes: 60 };
    if (fn === "notify_prefs") return prefs;
    if (fn === "notify_set") { prefs = { ...prefs, [body.p_kind]: !!body.p_on }; return prefs; }
    return undefined;
  } });
  await sleep(1500); await toTab(o.page, "shift");
  await o.page.locator('.sa-card[aria-label="Напоминания в Telegram"]').first().click(); await sleep(1400);
  const row = o.page.locator('[data-notify-prefs] [role="switch"]', { hasText: "Спасибо от гостей" });
  // v86: строки группами — «Спасибо от гостей» последней в группе «Команда»
  ok("PREFS: строка «Спасибо от гостей» — в группе «Команда», включена", /Спасибо от гостей когда гость сказал тебе спасибо по QR \(первые три за день\)/.test(await txt(row)) && (await row.getAttribute("aria-checked")) === "true"
    && (await o.page.locator('[data-notify-group="team"] [role="switch"]').last().innerText()).includes("Спасибо от гостей"), await txt(row));
  await row.click(); await sleep(700);
  const set = o.calls.filter((c) => c.fn === "notify_set").map((c) => c.body);
  ok("PREFS: переключатель — notify_set thanks выкл", set.length === 1 && set[0].p_kind === "thanks" && set[0].p_on === false, JSON.stringify(set));
  ok("PREFS: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
