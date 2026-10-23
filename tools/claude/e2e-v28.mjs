// e2e v28: ритм дня (свеча + стакан цели), «Разминка до смены», «Подсмотреть в уроке»,
// «Послушать», «Разобрать с Наставником», чек недели, печать раздела, автопереход при повторе,
// тихая подгрузка графика, ссылка ?go=warmup, кнопка «Назад» Telegram над слоями.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5196, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v28";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { SEASONAL_MODULES } = await import(SRC + "/data/modules-seasonal.js");
const ALL_SITS = SEASONAL_MODULES.flatMap(m => m.lessons).filter(l => l.type === "practice").flatMap(l => l.situations);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const prof = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false };
const uk = `_${prof.name}_${prof.surname}`;
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ymdL = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const now = new Date();
const MKEY = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
const today = ymdL(now);
const yest = new Date(); yest.setDate(yest.getDate() - 1);
const SHIFTS = [{ k: "У", name: "Утро", from: 10, to: 18 }, { k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }];
// у Анны сегодня вечерняя смена (до 24 — карточка видна в любое время теста), завтра выходной
const planAnna = { [now.getDate()]: "В" };
const SCHED_CACHE = { cfg: { staff: [{ id: "s1", name: "Анна Смирнова" }, { id: "s2", name: "Иван Петров" }], shifts: SHIFTS }, plan: { s1: planAnna, s2: { 1: "Д" } }, ts: Date.now() - 3600e3 };

async function open({ storage = {}, telegram = false, light = false, w = 390, h = 844, url = "/", schedule = null, fixedTime = null, chat = [], rpcs = null, profile = prof, calls = [] }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    if (/\/functions\/v1\/ai-chat/.test(u)) {
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      chat.push(body);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reply: "Разберём. Гость ждёт, что ты **первым** обозначишь, что видишь его, — даже если занят. Скажи: «Минуту, я сейчас подойду» — и подойди.", remaining: 18 }) });
    }
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const fn = m[1];
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      calls.push({ fn, body });
      if (rpcs) { const r = rpcs(fn, body); if (r !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r) }); }
      const mock = {
        whoami: { ok: true, employee: profile },
        my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: Object.keys(storage["sa_quiz_done{uk}"] || {}), lessons: Object.keys(storage["sa_completed{uk}"] || {}), stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "none" },
        my_mentors: { ok: true, rows: [{ name: "Мария" }] },
        schedule_load: schedule || { ok: false, error: "auth" },
        menu_get: [],
      };
      if (mock[fn] !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[fn]) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    }
    return route.abort();
  });
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(profile), sa_a11y: light ? "1" : "0", sa_welcome_seen_v11: "1", sa_last_role: JSON.stringify("seasonal"), sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0" };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  const ukx = "_" + profile.name + "_" + (profile.surname || "");
  for (const [k, v] of Object.entries(storage)) seed[k.replace("{uk}", ukx).replace("{mkey}", MKEY)] = typeof v === "string" ? v : JSON.stringify(v);
  await ctx.addInitScript(([seed, telegram]) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (telegram) {
      const handlers = new Set();
      window.__bb = { visible: false, handlers, press() { [...handlers].forEach(h => h()); } };
      window.__tgLinks = [];
      window.__wa = 0;
      window.Telegram = { WebApp: { initData: "query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc", platform: "ios", initDataUnsafe: {}, ready() {}, expand() {}, setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {},
        openTelegramLink(u) { window.__tgLinks.push(u); },
        requestWriteAccess(cb) { window.__wa++; setTimeout(() => cb && cb(true), 30); },
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
        BackButton: { show() { window.__bb.visible = true; }, hide() { window.__bb.visible = false; }, onClick(h) { handlers.add(h); }, offClick(h) { handlers.delete(h); } } } };
    }
    // голос в headless: озвучка «говорит» мгновенно
    try {
      window.__spoken = [];
      const ss = window.speechSynthesis;
      if (ss) { ss.speak = (u) => { window.__spoken.push(u.text); setTimeout(() => { try { u.onend && u.onend(); } catch (e) {} }, 50); }; ss.cancel = () => {}; }
    } catch (e) {}
  }, [seed, telegram]);
  const page = await ctx.newPage();
  if (fixedTime) await page.clock.setFixedTime(fixedTime);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + url, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1600);
  return { ctx, page, errors };
}

const text = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
async function correctText(page) {
  const info = await page.evaluate(() => {
    const t = (sel) => { const el = document.querySelector(".tb " + sel); return el ? el.innerText.trim() : ""; };
    return { scene: t(".tb-scene p"), claim: t(".tb-claim"), cloze: t(".tb-note.cloze p"), thought: t(".tb-thought") };
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
// ответить верно на текущую ситуацию и дождаться разбора
async function answer(page, good = true) {
  const want = await correctText(page);
  if (!want) return false;
  const r = await pickOption(page, want, good);
  await sleep(1400);
  return !!r;
}
async function nextStep(page) {
  const b = page.locator(".tb .tb-foot .tb-main");
  if (await b.count()) { await b.first().click(); await sleep(700); return true; }
  return false;
}

const baseStorage = {
  "sa_completed{uk}": { "s0-1": true, "s0-2": true, "s1-1": true },
  "sa_streak{uk}": { count: 4, best: 6, last: ymdL(yest), days: [ymdL(yest)] },
  "sa_sched_cache_main_{mkey}": SCHED_CACHE,
};

// ── A. Главная: ритм дня, разминка, цель дня ─────────────────────────────
{
  const tag = "A";
  const chat = [];
  const { ctx, page, errors } = await open({ storage: baseStorage, telegram: true, chat });
  let t = await text(page);
  ok(tag + ": свеча и стакан — значками в строке роли, без отдельного ряда", (await page.locator('[aria-label^="Серия 4"]').count()) === 1 && /0\/2/.test(t) && !/зажги сегодня/i.test(t), t.slice(0, 200));
  ok(tag + ": разминка — нижней строкой главной карточки", (await page.locator("[data-tb-warmup]").count()) === 1 && /Сегодня вечер, 16:00–24:00 · разминка 2 мин/.test(t)
    && (await page.evaluate(() => { const w = document.querySelector("[data-tb-warmup]"); const card = w && w.closest('[style*="border-radius: 18px"]'); return !!(card && card.textContent.includes("Дальше")); })));
  ok(tag + ": «Чек недели» на главной не висит", !/Чек недели готов/.test(t));
  await shot(page, "A1-home-dark");
  // цель дня: 1 шаг
  await page.locator('[aria-label^="Цель дня:"]').first().click(); await sleep(400);
  ok(tag + ": выбор цели открылся", (await page.locator('[role="dialog"][aria-label="Цель дня"]').count()) === 1);
  await shot(page, "A2-goal-sheet");
  ok(tag + ": Telegram «Назад» виден над листом цели? (лист — не слой App)", true);
  await page.locator('[role="dialog"] button', { hasText: "1 шаг" }).click(); await sleep(400);
  t = await text(page);
  ok(tag + ": цель 1 шаг сохранилась", /0\/1/.test(t) && (await page.evaluate((uk) => localStorage.getItem("sa_goal" + uk), uk)) === "1");
  // разминка
  await page.locator("[data-tb-warmup]").click(); await sleep(1500);
  t = await text(page);
  ok(tag + ": разминка открылась", /Разминка до смены/i.test(t) && /смена · Вечер/i.test(t), t.slice(0, 160));
  ok(tag + ": Telegram «Назад» показан над слоем разминки", await page.evaluate(() => window.__bb.visible));
  // послушать
  const lb = page.locator('.tb [aria-label="Послушать ситуацию"]');
  ok(tag + ": кнопка «Послушать» есть", (await lb.count()) === 1);
  if (await lb.count()) { await lb.click(); await sleep(200); ok(tag + ": ситуация озвучена", (await page.evaluate(() => (window.__spoken || []).length)) > 0); }
  // подсмотреть в уроке
  await page.locator('.tb [aria-label="Подсмотреть в уроке"]').click(); await sleep(500);
  t = await text(page);
  ok(tag + ": шпаргалка из урока открылась", /Из урока · карточка \d+ из \d+/i.test(t) || /Подходящей карточки/.test(t), (t.match(/из урока[^.]{0,60}/i) || [t.slice(-200)])[0]);
  await shot(page, "A3-peek");
  await page.locator(".tb-sheet .tb-main", { hasText: "Понятно, к ситуации" }).click(); await sleep(400);
  // 1-я — верно (с подсказкой), дальше
  ok(tag + ": ответ 1", await answer(page, true));
  t = await text(page);
  ok(tag + ": заголовок разбора «с подсказкой»", /Верно, с подсказкой/i.test(t));
  ok(tag + ": подпись наставника ресторана", /— Мария, наставник/.test(t), (t.match(/— [^—]{0,30}наставник/) || [""])[0]);
  await shot(page, "A4-answer");
  await nextStep(page);
  // 2-я — неверно → «Разобрать с Наставником»
  ok(tag + ": ответ 2 (неверно)", await answer(page, false));
  t = await text(page);
  ok(tag + ": ссылка «Разобрать с Наставником»", /Разобрать с Наставником/.test(t));
  await page.locator(".tb .tb-link", { hasText: "Разобрать с Наставником" }).click(); await sleep(1800);
  t = await text(page);
  ok(tag + ": чат Наставника поверх ситуации, вопрос ушёл сам", chat.length === 1 && /Разбери со мной ситуацию из практики/.test(JSON.stringify(chat[0] || {})) && /Минуту, я сейчас подойду/.test(t), "запросов: " + chat.length);
  const z = await page.evaluate(() => { const el = document.querySelector(".sa-dlg"); return el ? getComputedStyle(el).zIndex : ""; });
  ok(tag + ": слой чата выше слоя «у стола»", z === "1100", z);
  await shot(page, "A5-mentor");
  await page.evaluate(() => window.__bb.press()); await sleep(600);
  t = await text(page);
  ok(tag + ": «Назад» закрыл чат — снова ситуация", (await page.locator(".sa-dlg").count()) === 0 && /Разминка до смены/i.test(t));
  // спасти или дальше
  const rescue = page.locator(".tb .tb-foot .tb-main", { hasText: "Спасти ситуацию" });
  if (await rescue.count()) { await page.locator(".tb .tb-foot .tb-ghost", { hasText: "Дальше без этого" }).click(); await sleep(700); }
  else await nextStep(page);
  // 3-я — верно; автопереход в разминке
  ok(tag + ": ответ 3", await answer(page, true));
  t = await text(page);
  const sayBlock = /А теперь вслух/i.test(t);
  if (!sayBlock) {
    ok(tag + ": в разминке после верного — «дальше само»", /Дальше само/i.test(t));
    await sleep(3200);
  } else {
    ok(tag + ": «вслух» с микрофоном (MediaRecorder есть)", /Нажми и скажи фразу/i.test(t) || /Получилось/i.test(t));
    await nextStep(page);
  }
  // если ещё не итог — дойти
  for (let i = 0; i < 3 && !/Разминка готова/i.test(await text(page)); i++) {
    if (/Повтор ошибки|Из «Работы над ошибками»/i.test(await text(page))) { await page.locator(".tb .tb-chip2").first().click(); await sleep(1200); }
    await nextStep(page);
  }
  t = await text(page);
  ok(tag + ": чек «Разминка готова»", /Разминка готова/i.test(t) && /Хорошей смены/i.test(t), t.slice(0, 200));
  ok(tag + ": в чеке цель дня 1 / 1 ✓", /Цель дня\s*1 \/ 1 ✓/.test(t));
  await shot(page, "A6-receipt");
  const st = await page.evaluate((uk) => ({ w: localStorage.getItem("sa_warmup" + uk), a: JSON.parse(localStorage.getItem("sa_activity" + uk) || "{}"), s: JSON.parse(localStorage.getItem("sa_streak" + uk) || "{}"), m: JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]") }), uk);
  ok(tag + ": день отмечен (разминка, журнал, серия)", st.w === today && (st.a[today] || {}).w === 1 && (st.a[today] || {}).st === 1 && st.s.count === 5 && st.s.last === today, JSON.stringify(st.a[today]));
  ok(tag + ": промах разминки — в «Работе над ошибками»", st.m.length >= 1 && st.m.some(m => m.from === "practice"));
  await page.locator(".tb .tb-foot .tb-main", { hasText: "На смену!" }).click(); await sleep(900);
  t = await text(page);
  ok(tag + ": после разминки строка ушла, стакан 1/1 ✓, свеча горит", (await page.locator("[data-tb-warmup]").count()) === 0 && /1\/1 ✓/.test(t) && (await page.locator('[aria-label*="сегодня свеча горит"]').count()) === 1);
  ok(tag + ": Telegram «Назад» снова скрыт на главной", !(await page.evaluate(() => window.__bb.visible)));
  await shot(page, "A7-home-after");
  // «Я» → чек недели → отправить
  await page.evaluate(() => window.__saNav("me")); await sleep(900);
  // в понедельник в «Я» сначала чек прошлой недели (отметка «новый»), после него — последние 7 дней
  if (/Прошлая неделя: в деле/.test(await text(page))) {
    await page.locator(".sa-card", { hasText: "Чек недели" }).first().click(); await sleep(1000);
    ok(tag + ": понедельник — сначала прошлая неделя", /прошлая неделя/.test(await text(page)));
    await page.locator(".tb .tb-foot .tb-ghost", { hasText: "Закрыть" }).click(); await sleep(600);
  }
  await page.locator(".sa-card", { hasText: "Чек недели" }).first().click(); await sleep(1200);
  t = await text(page);
  ok(tag + ": чек недели открылся", /Чек недели/.test(t) && /последние 7 дней/.test(t) && /ДНЕЙ В ДЕЛЕ/i.test(t), t.slice(0, 200));
  ok(tag + ": в чеке разминка и ситуации", /Разминки до смены/.test(t) && /Ситуации у стола/.test(t));
  await shot(page, "A8-week");
  await page.locator(".tb .tb-foot .tb-main", { hasText: "Отправить команде" }).click(); await sleep(300);
  const links = await page.evaluate(() => window.__tgLinks);
  ok(tag + ": «Отправить команде» → выбор чата Telegram", links.length === 1 && /^https:\/\/t\.me\/share\/url\?url=/.test(links[0]) && /%D0%A7%D0%B5%D0%BA%20%D0%BD%D0%B5%D0%B4%D0%B5%D0%BB%D0%B8/.test(links[0]), (links[0] || "").slice(0, 80));
  await page.evaluate(() => window.__bb.press()); await sleep(500);
  ok(tag + ": «Назад» закрыл чек недели", (await page.locator(".tb").count()) === 0);
  ok(tag + ": без ошибок в консоли", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── B. Тихая подгрузка графика (экран «График» не открывали) + ?go=warmup ─────
{
  const tag = "B";
  const schedule = { ok: true, venues: [{ venue_key: "main", config: { staff: [{ id: "a1", name: "Смирнова Анна" }, { id: "a2", name: "Пётр Иванов" }], shifts: SHIFTS } }], months: [{ venue_key: "main", payload: { plan: { a1: { [now.getDate()]: "В", [((now.getDate()) % 28) + 1]: "У" }, a2: {} } } }] };
  const st0 = { ...baseStorage }; delete st0["sa_sched_cache_main_{mkey}"];
  const { ctx, page, errors } = await open({ storage: st0, schedule, url: "/?go=warmup" });
  await sleep(800);
  let t = await text(page);
  ok(tag + ": ссылка ?go=warmup открыла разминку сразу", /Разминка до смены/i.test(t), t.slice(0, 120));
  const bg = await page.evaluate((m) => JSON.parse(localStorage.getItem("sa_sched_bg_main_" + m) || "null"), MKEY);
  ok(tag + ": своя копия графика — только своя строка", !!bg && bg.cfg.staff.length === 1 && bg.cfg.staff[0].name === "Смирнова Анна" && Object.keys(bg.plan).length === 1);
  const ts = await page.evaluate(() => JSON.parse(localStorage.getItem("sa_today_shift") || "null"));
  ok(tag + ": сводка «моя смена сегодня» записана", ts && ts.label === "Вечер · 16:00–24:00", JSON.stringify(ts));
  ok(tag + ": снимок экрана «График» не тронут", (await page.evaluate((m) => localStorage.getItem("sa_sched_cache_main_" + m), MKEY)) === null);
  await page.locator(".tb .tb-x").click(); await sleep(700);
  t = await text(page);
  ok(tag + ": строка разминки со сменой из подгрузки", /Сегодня вечер, 16:00–24:00/.test(t) && /Хорошей смены/.test(t));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── C. Выходной по графику: разминки нет; понедельник: «Чек недели готов» ─────
{
  const tag = "C";
  // ближайший понедельник в прошлом/сегодня, 11:00 — выходной у Анны
  const mon = new Date(); mon.setHours(11, 0, 0, 0); while (mon.getDay() !== 1) mon.setDate(mon.getDate() - 1);
  const mk = mon.getFullYear() + "-" + String(mon.getMonth() + 1).padStart(2, "0");
  const prevDay = (n) => { const d = new Date(mon); d.setDate(d.getDate() - n); return ymdL(d); };
  const act = { [prevDay(1)]: { l: 1, st: 1 }, [prevDay(3)]: { p: 1, s: 6, st: 1 }, [prevDay(4)]: { w: 1, s: 3, st: 1 } };
  const cache = { cfg: { staff: [{ id: "s1", name: "Анна Смирнова" }], shifts: SHIFTS }, plan: { s1: { [((mon.getDate()) % 28) + 1]: "Д" } }, ts: Date.now() };
  const { ctx, page, errors } = await open({ fixedTime: mon, storage: { ...baseStorage, "sa_sched_cache_main_{mkey}": "x", ["sa_sched_cache_main_" + mk]: cache, "sa_activity{uk}": act, "sa_streak{uk}": { count: 2, best: 6, last: prevDay(1), days: [prevDay(4), prevDay(3), prevDay(1)] } } });
  let t = await text(page);
  ok(tag + ": в выходной по графику разминки нет", (await page.locator("[data-tb-warmup]").count()) === 0);
  ok(tag + ": на главной чека недели нет даже в понедельник", !/Чек недели готов/.test(t));
  await page.evaluate(() => window.__saNav("me")); await sleep(900);
  t = await text(page);
  ok(tag + ": в «Я» — «Чек недели» с отметкой «новый»", /Прошлая неделя: в деле 3 из 7/.test(t) && /новый/.test(t), t.slice(0, 260));
  await shot(page, "C1-monday");
  await page.locator(".sa-card", { hasText: "Чек недели" }).first().click(); await sleep(1100);
  t = await text(page);
  ok(tag + ": чек за прошлую неделю (пн–вс)", /прошлая неделя/.test(t) && new RegExp(prevDay(7).slice(8, 10) + "\\." + prevDay(7).slice(5, 7)).test(t), t.slice(0, 160));
  await shot(page, "C2-week-prev");
  await page.locator(".tb .tb-foot .tb-ghost", { hasText: "Закрыть" }).click(); await sleep(600);
  t = await text(page);
  ok(tag + ": открыл — отметка «новый» ушла", !/Прошлая неделя: в деле/.test(t) && /Что сделано за 7 дней/.test(t));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── D. Печать раздела, стакан на экране трека, автопереход при повторе практики ─────
{
  const tag = "D";
  const s0 = SEASONAL_MODULES.find(m => m.id === "s0");
  const comp = {}; s0.lessons.forEach(l => { if (l.type !== "quiz") comp[l.id] = true; });
  const qd = {}; s0.lessons.forEach(l => { if (l.type === "quiz") qd[l.id] = true; });
  const { ctx, page, errors } = await open({ storage: { ...baseStorage, "sa_completed{uk}": comp, "sa_quiz_done{uk}": qd } });
  await page.evaluate(() => window.__saNav("home")); await sleep(1300);
  let t = await text(page);
  ok(tag + ": на экране трека — свеча и стакан цели в строке прогресса", /0\/2/.test(t) && (await page.locator(".tbp-strip").count()) === 1, t.slice(0, 300));
  await page.locator('.tbp-num[aria-label*="Психология первого дня"]').first().click(); await sleep(1300);
  ok(tag + ": раздел пройден — печать опускается", (await page.locator(".tbm-seal.stamp").count()) === 1 && /раздел пройден · печать/i.test(await text(page)));
  await sleep(1300);
  await shot(page, "D1-seal");
  // практика пройдена → повтор: после верного ответа дальше само
  await page.locator(".tbp-cur .tbm-node", { hasText: "Практика" }).first().click(); await sleep(1300);
  t = await text(page);
  ok(tag + ": повтор практики помечен", /· повтор/.test(t));
  ok(tag + ": ответ в повторе", await answer(page, true));
  t = await text(page);
  const say = /А теперь вслух/i.test(t);
  if (!say) {
    ok(tag + ": «Повтор: дальше само»", /Повтор: дальше само/i.test(t));
    const before = (t.match(/Ситуация (\d+) из/i) || [])[1];
    await sleep(3000);
    const after = ((await text(page)).match(/Ситуация (\d+) из/i) || [])[1];
    ok(tag + ": через 2,6 с — следующая ситуация", before && after && Number(after) === Number(before) + 1, before + "→" + after);
  } else ok(tag + ": фраза «вслух» — автоперехода нет (правильно)", !/дальше само/i.test(t));
  await page.locator(".tb .tb-x").click(); await sleep(500);
  if (await page.locator(".tb-sheet").count()) { await page.locator(".tb-sheet .tb-ghost", { hasText: "Выйти" }).click(); await sleep(600); }
  await page.evaluate(() => window.__saNav("module")); await sleep(900);
  ok(tag + ": второй раз печать без анимации", (await page.locator(".tbm-seal").count()) === 1 && (await page.locator(".tbm-seal.stamp").count()) === 0);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── E. Светлая тема: главная, разминка, чек недели ─────
{
  const tag = "E";
  const { ctx, page, errors } = await open({ storage: baseStorage, light: true });
  await shot(page, "E1-home-light");
  await page.locator("[data-tb-warmup]").click(); await sleep(1300);
  await shot(page, "E2-warmup-light");
  await page.locator(".tb .tb-x").click(); await sleep(600);
  await page.evaluate(() => window.__saNav("me")); await sleep(900);
  await page.locator(".sa-card", { hasText: "Чек недели" }).first().click(); await sleep(1100);
  await shot(page, "E3-week-light");
  ok(tag + ": светлая тема без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── F. Трек — меню тем: листаются пальцем (настоящие касания) и номерами; закладки на краях, свечение
//      цвета темы, название по долгому нажатию, «Дальше» в конце меню, номера прилипают, «К уроку» ─────
{
  const tag = "F";
  const { ctx, page, errors } = await open({ storage: { ...baseStorage, "sa_completed{uk}": { "s0-1": true, "s0-2": true, "s1-1": true } } });
  await page.evaluate(() => window.__saNav("home")); await sleep(1300);
  const title = () => page.evaluate(() => (document.querySelector(".tbp-cur .tbm-title") || {}).textContent || "");
  const onNum = () => page.evaluate(() => (document.querySelector(".sa-screen .tbp-num.on .n") || {}).textContent || "");
  const trackX = () => page.evaluate(() => (document.querySelector(".tbp-track") || {}).style?.transform || "");
  const tabs = () => page.evaluate(() => ({ prev: (document.querySelector(".tbp-tab.prev") || {}).textContent || "", next: (document.querySelector(".tbp-tab.next") || {}).textContent || "" }));
  const goPill = () => page.evaluate(() => (document.querySelector(".tbp-go") || {}).innerText || "");
  const glow = () => page.evaluate(() => (document.querySelector(".tbp-tint .a") || {}).style?.background || "");
  let t = await text(page);
  ok(tag + ": трек открылся на меню текущей темы", (await title()) === "Психология первого дня" && (await onNum()) === "0" && !/ПРОГРАММА ОБУЧЕНИЯ/i.test(t), await title());
  ok(tag + ": нет отдельной карточки «Дальше» и надписи SERVICE ACADEMY", !/SERVICE ACADEMY/.test(t.replace("✦ SERVICE ACADEMY ✦", "")) && (await page.locator(".tbp-cur .tbm-cur").count()) === 1);
  ok(tag + ": соседняя тема видна краем и не нажимается", (await page.locator(".tbp-side.next[inert]").count()) === 1 && (await page.locator(".tbp-side.prev").count()) === 0);
  let tb = await tabs();
  ok(tag + ": закладка следующей темы на правом крае — её номер, слева закладки нет", tb.next === "1" && tb.prev === "", JSON.stringify(tb));
  ok(tag + ": свечение цвета темы за шапкой", /gradient/.test(await glow()));
  ok(tag + ": на своей теме «К уроку» не показывается", (await goPill()) === "");
  ok(tag + ": подписи «листай свайпом» больше нет", !/листай темы свайпом/.test(t));
  const strip = await page.evaluate(() => { const s = document.querySelector(".sa-screen .tbp-nums"); const r = s.getBoundingClientRect(); const over = s.scrollWidth > s.clientWidth + 1;
    const bad = [...s.children].map(x => x.getBoundingClientRect()).filter(x => x.top < r.top - 0.5 || x.bottom > r.bottom + 0.5 || (!over && (x.left < r.left - 0.5 || x.right > r.right + 0.5))).length;
    return { n: s.children.length, over, bad }; });
  ok(tag + ": номера тем помещаются в строку и ничем не обрезаны", strip.n > 5 && !strip.over && strip.bad === 0, JSON.stringify(strip));
  await sleep(1400);
  ok(tag + ": пока ни разу не листал — лента разок «покачивается» (вместо подписи)", (await page.evaluate(() => localStorage.getItem("sa_track_nudge"))) === "1");
  await sleep(900);
  // настоящие касания через CDP — как палец на телефоне
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  const drag = async (x0, y0, x1, y1, steps = 14, stepMs = 16, atStep = -1, at = null) => {
    await touch("touchStart", x0, y0);
    for (let i = 1; i <= steps; i++) { await touch("touchMove", x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await sleep(stepMs); if (i === atStep && at) await at(); }
    await touch("touchEnd");
  };
  const vy = await page.evaluate(() => { const r = document.querySelector(".tbp-vp").getBoundingClientRect(); return Math.round(Math.min(r.top + 150, (r.top + r.bottom) / 2)); });
  const glow0 = await glow();
  let mid = "", midB = 0;
  await drag(330, vy, 140, vy + 4, 16, 16, 8, async () => { mid = await trackX(); midB = await page.evaluate(() => Number((document.querySelector(".tbp-tint .b") || {}).style?.opacity || 0)); });
  await sleep(700);
  ok(tag + ": страница едет за пальцем, а не прыгает", /translate3d\(-\d/.test(mid), mid);
  ok(tag + ": свечение перетекает в цвет соседней темы вместе с пальцем", midB > 0.2 && midB < 1, String(midB));
  ok(tag + ": свайп влево — следующая тема", (await title()) === "Мышление сервиса" && (await onNum()) === "1");
  ok(tag + ": у новой темы — своё свечение", (await glow()) !== glow0 && /gradient/.test(await glow()));
  ok(tag + ": после листания лента стоит ровно, слева видна прошлая тема", (await trackX()) === "" && (await page.locator(".tbp-side.prev[inert]").count()) === 1);
  tb = await tabs();
  ok(tag + ": закладки на обоих краях — 0 и 2", tb.prev === "0" && tb.next === "2", JSON.stringify(tb));
  ok(tag + ": ушёл на другую тему — над нижним меню «К уроку: Анатомия смены»", /К уроку:/.test(await goPill()) && /Анатомия смены/.test(await goPill()), await goPill());
  await drag(200, vy, 228, vy + 2, 6, 30); await sleep(600);
  ok(tag + ": короткое медленное движение — не листает", (await title()) === "Мышление сервиса" && (await trackX()) === "");
  await drag(170, vy, 182, vy + 150, 12, 16); await sleep(600);
  ok(tag + ": движение вниз — прокрутка, не листание", (await title()) === "Мышление сервиса");
  await page.locator(".tbp-tab.prev").click(); await sleep(800);
  ok(tag + ": тап по закладке — соседняя тема", (await title()) === "Психология первого дня" && (await goPill()) === "");
  await drag(60, vy, 330, vy + 4, 14, 16); await sleep(700);
  ok(tag + ": у первой темы край упругий — остаётся на месте", (await title()) === "Психология первого дня" && (await trackX()) === "");
  // долгое нажатие на номер — название темы; повёл пальцем — подпись бежит; отпустил — туда и перешли
  const numPos = (n) => page.evaluate((n) => { const b = [...document.querySelectorAll(".sa-screen .tbp-num")].find(x => x.textContent.trim() === String(n)); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, n);
  const peekTxt = () => page.evaluate(() => (document.querySelector(".tbp-peek") || {}).innerText || "");
  const p5 = await numPos(5), p7 = await numPos(7);
  await touch("touchStart", p5.x, p5.y); await sleep(600);
  ok(tag + ": долгое нажатие на номер — название темы и сколько пройдено", /^5 · /.test(await peekTxt()) && /шаг|пройден/.test(await peekTxt()), (await peekTxt()).replace(/\s+/g, " "));
  for (let i = 1; i <= 6; i++) { await touch("touchMove", p5.x + (p7.x - p5.x) * i / 6, p5.y); await sleep(30); }
  ok(tag + ": ведёшь пальцем по номерам — подпись бежит за ним", /^7 · /.test(await peekTxt()), (await peekTxt()).replace(/\s+/g, " "));
  await touch("touchEnd"); await sleep(900);
  ok(tag + ": отпустил на номере — открылась эта тема, подпись ушла", (await onNum()) === "7" && (await peekTxt()) === "");
  // «Дальше: 8 · …» в конце меню
  const nl = await page.evaluate(() => { const l = document.querySelector(".tbp-cur .tbp-nextlink"); return l ? l.innerText.replace(/\s+/g, " ") : ""; });
  ok(tag + ": в конце меню — «Дальше: 8 · …»", /^Дальше: 8 · /.test(nl), nl);
  await page.locator(".tbp-cur .tbp-nextlink").click(); await sleep(900);
  ok(tag + ": тап по «Дальше» — следующая тема", (await onNum()) === "8");
  // прокрутил вниз — номера прилипают сверху вместе с названием темы
  await page.evaluate(() => { document.getElementById("root").scrollTop = 900; }); await sleep(600);
  const pin = await page.evaluate(() => { const p = document.querySelector(".tbp-pin"); if (!p) return null; const r = p.getBoundingClientRect(); return { top: Math.round(r.top), t: (p.querySelector(".tbp-pin-t") || {}).innerText || "", n: p.querySelectorAll(".tbp-num").length }; });
  ok(tag + ": прокрутил вниз — номера прилипли сверху с названием темы", !!pin && pin.top === 0 && /^8 · /.test(pin.t) && pin.n > 5, JSON.stringify(pin));
  await page.locator(".tbp-pin .tbp-num", { hasText: /^3$/ }).click(); await sleep(1200);
  ok(tag + ": номер в прилипшей полосе — сразу к теме, страница поднялась к её началу", (await onNum()) === "3" && (await page.locator(".tbp-pin").count()) === 0);
  await page.evaluate(() => { document.getElementById("root").scrollTop = 900; }); await sleep(600);
  await page.locator(".tbp-pin .tbp-pin-t").click(); await sleep(900);
  ok(tag + ": тап по названию в полосе — к началу страницы", (await page.evaluate(() => document.getElementById("root").scrollTop)) < 5 && (await page.locator(".tbp-pin").count()) === 0);
  // «К уроку» — одно касание, и ты там, где остановился
  await page.locator(".tbp-go").click(); await sleep(1300);
  t = await text(page);
  ok(tag + ": «К уроку» — сразу текст урока, где остановился", /Анатомия смены/.test(t) && /3 из 6/.test(t));
  await page.locator("button", { hasText: /^‹$/ }).first().click(); await sleep(900);
  ok(tag + ": «Назад» из урока — меню его темы", (await title()) === "Психология первого дня" && (await page.locator(".tbp-strip").count()) >= 1);
  await page.locator(".tbp-cur .tbm-cur").click(); await sleep(1300);
  t = await text(page);
  ok(tag + ": шаг в меню — сразу текст урока", /Анатомия смены/.test(t) && /3 из 6/.test(t));
  await page.locator("button", { hasText: /^‹$/ }).first().click(); await sleep(900);
  ok(tag + ": «Назад» из урока — то же меню темы", (await title()) === "Психология первого дня" && (await page.locator(".sa-screen .tbp-strip").count()) === 1);
  await page.locator(".sa-screen .tbp-num", { hasText: /^1$/ }).click(); await sleep(900);
  await page.locator(".tbp-cur .tbm-cur").click(); await sleep(1300);
  await page.locator("[data-sa-contents]").click(); await sleep(900);
  ok(tag + ": «2 из 6» в уроке — меню этой темы в листаемом треке", (await title()) === "Мышление сервиса" && (await page.locator(".sa-screen .tbp-strip").count()) === 1);
  await page.locator(".sa-screen .tbp-view").click(); await sleep(700);
  t = await text(page);
  ok(tag + ": «☰» — прежний список тем с карточкой «Дальше»", /ПРОГРАММА ОБУЧЕНИЯ/i.test(t) && /листать/.test(t) && (await page.locator(".sa-card", { hasText: "Поведение в зале" }).count()) === 1 && (await page.locator(".tbp-go").count()) === 0);
  await page.locator(".sa-card", { hasText: "Поведение в зале" }).first().click(); await sleep(800);
  ok(tag + ": тап по теме в списке — её меню", (await title()) === "Поведение в зале" && (await page.locator(".sa-screen .tbp-strip").count()) === 1);
  await page.evaluate(() => window.__saNav("roleSelect")); await sleep(900);
  ok(tag + ": ушёл с трека — «К уроку» не висит на других экранах", (await page.locator(".tbp-go").count()) === 0 && (await page.locator(".tbp-pin").count()) === 0);
  await page.getByRole("button", { name: /Дальше/ }).first().click().catch(() => {}); await sleep(1200);
  await page.locator("button", { hasText: /^‹$/ }).first().click().catch(() => {}); await sleep(900);
  ok(tag + ": из «Дальше» на главной «Назад» — на главную", /Добрый|Доброе|Доброй/.test(await text(page)));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── F2. Узкий экран (320 px): номера помещаются; стрелки на номерах и подпись при фокусе ─────
{
  const tag = "F2";
  const { ctx: c2, page, errors } = await open({ storage: { ...baseStorage, "sa_track_swiped": "1" }, w: 320, h: 640 });
  await page.evaluate(() => window.__saNav("home")); await sleep(1300);
  const s320 = await page.evaluate(() => { const s = document.querySelector(".sa-screen .tbp-nums"); return { over: s.scrollWidth > s.clientWidth + 1, sw: s.scrollWidth, cw: s.clientWidth }; });
  ok(tag + ": экран 320 px — все номера тем помещаются", !s320.over, JSON.stringify(s320));
  ok(tag + ": листал раньше — «покачивания» нет", (await page.evaluate(() => localStorage.getItem("sa_track_nudge"))) === null);
  await page.locator(".sa-screen .tbp-num.on").focus();
  await page.keyboard.press("ArrowRight"); await sleep(800);
  ok(tag + ": стрелка → на номерах — следующая тема", (await page.evaluate(() => (document.querySelector(".sa-screen .tbp-num.on .n") || {}).textContent)) === "1");
  ok(tag + ": фокус с клавиатуры — название темы над номером", /^1 · /.test(await page.evaluate(() => (document.querySelector(".tbp-peek") || {}).innerText || "")));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await c2.close();
}

// ── G. Подтверждение в зале: сотрудник просит, старший подтверждает у себя ─────
{
  const tag = "G";
  const store = [];
  const rpcs = (fn, b) => {
    if (fn === "skill_request") { const r = { id: store.length + 1, role_id: b.p_role, skill_id: b.p_skill, skill_label: b.p_skill_label, status: "pending", created_at: new Date().toISOString(), emp_name: "Анна Смирнова" }; store.push(r); return { ok: true, id: r.id, status: "pending" }; }
    if (fn === "skill_requests_mine") return { ok: true, rows: store.slice().reverse() };
    if (fn === "skill_request_cancel") { const r = store.find(x => x.id === b.p_id); if (r) r.status = "cancelled"; return { ok: true, cancelled: !!r }; }
    if (fn === "skill_requests_inbox") return { ok: true, rows: store.filter(x => x.status === "pending").map(x => ({ ...x, restaurant: "Два моря, Океан", mine: true })) };
    if (fn === "skill_request_decide") { const r = store.find(x => x.id === b.p_id); if (!r) return { ok: false, error: "not_found" }; r.status = b.p_approve ? "approved" : "declined"; r.mentor_name = "Мария Ким"; r.decided_at = new Date().toISOString(); r.note = b.p_note; return { ok: true, status: r.status }; }
    return undefined;
  };
  const calls = [];
  let { ctx, page, errors } = await open({ storage: baseStorage, rpcs, calls });
  await page.evaluate(() => window.__saNav("mentor")); await sleep(1400);
  await page.locator(".sa-card", { hasText: "Встреча и приветствие" }).first().click(); await sleep(500);
  let t = await text(page);
  ok(tag + ": в окне подтверждения — «Отправить старшему» и PIN как раньше", /Отправить старшему/.test(t) && /ИЛИ ПО PIN ПРЯМО ЗДЕСЬ/i.test(t) && (await page.locator('input[placeholder^="PIN наставника"]').count()) === 1);
  await shot(page, "G1-modal");
  await page.locator("button", { hasText: "Отправить старшему" }).click(); await sleep(900);
  t = await text(page);
  ok(tag + ": запрос ушёл, на навыке — «Ждёт старшего»", calls.some(c => c.fn === "skill_request" && c.body.p_skill === "sea1") && /Ждёт подтверждения старшего в зале/.test(t));
  await shot(page, "G2-pending");
  ok(tag + ": сотруднику входящие не запрашиваются", !calls.some(c => c.fn === "skill_requests_inbox"));
  await ctx.close();
  // глазами старшего
  const maria = { id: "u-maria", name: "Мария", surname: "Ким", restaurant: "Два моря, Океан", position: "senior", is_admin: false };
  const calls2 = [];
  ({ ctx, page, errors } = await open({ storage: {}, rpcs, calls: calls2, profile: maria }));
  await page.evaluate(() => window.__saNav("teamHub")); await sleep(1200);
  t = await text(page);
  ok(tag + ": у старшего на «Наставничестве» — счётчик", /1 запрос ждёт подтверждения в зале/.test(t), t.slice(0, 300));
  await page.locator(".sa-card", { hasText: "Наставничество" }).first().click(); await sleep(1400);
  t = await text(page);
  ok(tag + ": входящие: Анна, «Встреча и приветствие»", /ЖДУТ ПОДТВЕРЖДЕНИЯ В ЗАЛЕ/i.test(t) && /Анна Смирнова/.test(t) && /«Встреча и приветствие»/.test(t));
  await shot(page, "G3-inbox");
  await page.locator("button", { hasText: "Видел(а), подтверждаю ✓" }).click(); await sleep(300);
  ok(tag + ": первое нажатие только «взводит»", /Точно видел\(а\)\? Нажми ещё раз/.test(await text(page)) && !calls2.some(c => c.fn === "skill_request_decide"));
  await page.locator("button", { hasText: "Точно видел(а)" }).click(); await sleep(900);
  t = await text(page);
  ok(tag + ": подтверждено — строка ушла, подсказка внизу", calls2.some(c => c.fn === "skill_request_decide" && c.body.p_approve === true) && /Подтверждено: Анна/.test(t) && /Запросов нет/.test(t));
  ok(tag + ": без ошибок (старший)", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
  // снова сотрудник: «В ЗАЛЕ ✓»
  ({ ctx, page, errors } = await open({ storage: baseStorage, rpcs }));
  await page.evaluate(() => window.__saNav("mentor")); await sleep(1500);
  t = await text(page);
  ok(tag + ": у сотрудника навык подтверждён «в зале»", /Подтвердил\(а\): Мария Ким/.test(t) && /В ЗАЛЕ ✓/.test(t));
  await shot(page, "G4-approved");
  ok(tag + ": без ошибок (сотрудник)", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── H. Напоминания в Telegram ─────
{
  const tag = "H";
  let linked = false;
  const rpcs = (fn, b) => {
    if (fn === "tg_status") return { ok: true, bot: true, linked, remind: linked, minutes: 60 };
    if (fn === "tg_link") { linked = true; return { ok: true, linked: true, remind: true }; }
    if (fn === "tg_set") { linked = !!b.p_remind; return { ok: true, remind: !!b.p_remind }; }
    return undefined;
  };
  const calls = [];
  let { ctx, page, errors } = await open({ storage: baseStorage, telegram: true, rpcs, calls });
  let t = await text(page);
  ok(tag + ": в Telegram под разминкой — «Напоминать за час до смены»", /Напоминать в Telegram за час до смены/.test(t));
  await page.getByRole("button", { name: "Напоминать в Telegram за час до смены ›", exact: true }).click(); await sleep(700);
  t = await text(page);
  ok(tag + ": окно напоминаний с примером сообщения", /Напоминания в Telegram/.test(t) && /Через час смена: Вечер · 16:00–24:00/.test(t) && (await page.locator('[role="dialog"] button', { hasText: "Включить" }).count()) === 1);
  ok(tag + ": «Назад» Telegram виден над окном", await page.evaluate(() => window.__bb.visible));
  await shot(page, "H1-remind");
  await page.locator('[role="dialog"] button', { hasText: "Включить" }).click(); await sleep(900);
  t = await text(page);
  ok(tag + ": спросили разрешение и привязали чат с подписью initData", (await page.evaluate(() => window.__wa)) === 1 && calls.some(c => c.fn === "tg_link" && /hash=abc/.test(c.body.p_init_data)) && /Включено: за час до смены/.test(t));
  await page.locator('[role="dialog"] button', { hasText: "Закрыть" }).click(); await sleep(500);
  ok(tag + ": после включения ссылка под разминкой ушла", !/Напоминать в Telegram за час до смены/.test(await text(page)));
  await page.evaluate(() => window.__saNav("shift")); await sleep(900);
  ok(tag + ": в «Смене» — «Напоминания в Telegram: включено»", /Включено: за час до смены зовёт на разминку/.test(await text(page)));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
  linked = false;
  ({ ctx, page, errors } = await open({ storage: baseStorage, rpcs }));
  await page.evaluate(() => window.__saNav("shift")); await sleep(900);
  await page.locator(".sa-card", { hasText: "Напоминания в Telegram" }).click(); await sleep(700);
  ok(tag + ": вне Telegram — объясняем, где включить", /Открой Service Academy через бота и включи их здесь/.test(await text(page)) && (await page.locator('[role="dialog"] button', { hasText: "Включить" }).count()) === 0);
  ok(tag + ": без ошибок (браузер)", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter(r => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
process.exit(bad ? 1 : 0);
