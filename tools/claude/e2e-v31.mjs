// e2e v31 («берём все»): кнопка ИИ уезжает при листании, погреб тем (освежить всё, проверка по
// треку), правила зачёта и раунда мастера, рекорд заведения, квест («Спасибо команде», позвать на
// разминку), свеча на двоих (подтолкнуть, вехи), лига (подиум, стрелки, прошлая неделя), итоги месяца
// (сравнение, картинка), радио (названия, вся дорога, живые голоса), живой гость (стол сверху,
// настроение, шёпот, поток, было/стало, свои гости), что присылать в Telegram, ссылки ?go=, Наставник.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5199, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v31";
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

// ответы «Живого гостя» (Доп. 312): три реплики гостя, на третьей — уходит; чек разбора — JSON
function guestAi(body, mode) {
  if (mode === "off") return { ok: false, error: "not_configured" };
  if (body.finish) return { ok: true, remaining: 30, reply: "Вот разбор: " + JSON.stringify({ score: 4, scores: { contact: 5, menu: 4, care: 3, sales: 4, calm: 5 },
    good: ["Тепло встретил и сразу предложил воду", "Назвал время ожидания честно"], fix: ["Не спросил про аллергии до заказа"], phrase: "Есть ли у вас аллергии или что-то, чего вы не едите?", lessons: ["s0-2", "нет-такого"] }) };
  const mine = (body.messages || []).filter((m) => m.role === "user").length;
  const replies = ["Да, мне бы что-нибудь побыстрее — у меня поезд. Что посоветуете? [[mood:3]]", "Отлично, это подходит. И чай, пожалуйста. [[mood:4]]", "Спасибо, всё было быстро. Можно счёт? До свидания! [[mood:5]]\n[[end]]"];
  return { ok: true, remaining: 30 - mine, reply: replies[Math.min(mine - 2, replies.length - 1)] || replies[0] };
}
async function open({ storage = {}, telegram = false, light = false, w = 390, h = 844, url = "/", schedule = null, fixedTime = null, chat = [], rpcs = null, profile = prof, calls = [], ai = "guest", tts = null, ttsCalls = [], stream = false, assistant = null }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    if (/\/functions\/v1\/radio-tts/.test(u)) {
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      ttsCalls.push(body);
      if (!tts) return route.abort();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tts(body)) });
    }
    if (/\/functions\/v1\/ai-chat/.test(u)) {
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      chat.push(body);
      // v31: ответ гостя потоком (SSE), как его отдаёт новый ai-chat
      if (body.mode === "guest" && stream && body.stream && !body.finish && ai !== "off") {
        const r = guestAi(body, ai); const words = String(r.reply || "").split(/(?<= )/);
        const sse = words.map((w) => "data: " + JSON.stringify({ t: w }) + "\n\n").join("") + "data: " + JSON.stringify({ done: true, remaining: r.remaining }) + "\n\n";
        return route.fulfill({ status: 200, contentType: "text/event-stream; charset=utf-8", body: sse });
      }
      if (body.mode === "guest") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(guestAi(body, ai)) });
      if (assistant) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reply: assistant, remaining: 18 }) });
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
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(profile), sa_a11y: light ? "1" : "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_last_role: JSON.stringify("seasonal"), sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0",
    // v32: квест смены по умолчанию свёрнут — здешние проверки писались для раскрытого
    sa_quest_open: "1" };
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
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd|Blocked call to navigator\.vibrate/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + url, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1600);
  return { ctx, page, errors };
}

const text = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const tbText = (page) => page.evaluate(() => { const el = document.querySelector(".tb"); return el ? el.innerText.replace(/\s+/g, " ") : ""; });
const only = process.argv.slice(2);
const want = (tag) => !only.length || only.includes(tag);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const ALL_Q = SEASONAL_MODULES.flatMap(m => m.lessons).filter(l => l.type === "quiz").flatMap(l => l.questions || []);
async function correctText(page) {
  const info = await page.evaluate(() => {
    const t = (sel) => { const el = document.querySelector(".tb " + sel); return el ? el.innerText.trim() : ""; };
    return { scene: t(".tb-scene p"), claim: t(".tb-claim"), cloze: t(".tb-note.cloze p"), q: t(".tb-q") };
  });
  let s = null;
  if (info.scene) s = ALL_SITS.find(x => x.scene && x.scene.trim() === info.scene);
  else if (info.claim && /правда или миф/i.test(info.claim)) s = ALL_SITS.find(x => x.statement && info.claim.includes(x.statement.replace(/^«|»$/g, "").slice(0, 30)));
  else if (info.cloze) s = ALL_SITS.find(x => x.start && info.cloze.startsWith(x.start.trim().slice(0, 25)));
  if (!s && info.q) { const q = ALL_Q.find(x => x.q && x.q.trim() === info.q); if (q) return q.options[q.correct]; }
  if (!s && info.claim) { const q = ALL_Q.find(x => x.q && info.claim.includes(x.q.trim().slice(0, 40))); if (q) return q.options[q.correct]; }
  if (!s) return null;
  const right = s.options[s.correct];
  if ((s.genre || s.type) === "truefalse") return /невер|❌/i.test(right) ? "Миф" : "Правда";
  return right;
}
async function pickOption(page, wantText, good = true) {
  const btns = page.locator(".tb .tb-actc, .tb .tb-reply, .tb .tb-chip2, .tb .tb-myth button");
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const t = (await btns.nth(i).innerText()).trim().replace(/\s+/g, " ");
    const hit = t.startsWith(wantText.replace(/\s+/g, " ").slice(0, 20)) || (wantText.length <= 6 && t.startsWith(wantText));
    if (good ? hit : !hit) { await btns.nth(i).click(); return t; }
  }
  return null;
}
async function answer(page, good = true) {
  const w = await correctText(page);
  if (!w) return false;
  const r = await pickOption(page, w, good);
  await sleep(1300);
  return !!r;
}
async function nextStep(page) {
  const b = page.locator(".tb .tb-foot .tb-main");
  if (await b.count()) { await b.first().click(); await sleep(650); return true; }
  return false;
}
// пройти все задания стола: good — верно, иначе первое неверное
async function playAll(page, good = true, max = 12) {
  let n = 0;
  for (let i = 0; i < max; i++) {
    const res = await page.locator(".tb .tb-receipt").count();
    if (res) break;
    const ok1 = await answer(page, good);
    if (!ok1) { const b = page.locator(".tb .tb-chip2").first(); if (await b.count()) { await b.click(); await sleep(1200); } else break; }
    n++;
    await nextStep(page);
  }
  return n;
}
const S0 = SEASONAL_MODULES.find(m => m.id === "s0"), S1 = SEASONAL_MODULES.find(m => m.id === "s1"), S2 = SEASONAL_MODULES.find(m => m.id === "s2");
const doneMap = (...mods) => { const c = {}, q = {}; mods.forEach(m => m.lessons.forEach(l => { if (l.type === "quiz") q[l.id] = true; else if (l.type !== "result") c[l.id] = true; })); return { c, q }; };
const DAY = 86400000;
const S3 = SEASONAL_MODULES.find(m => m.id === "s3");
const ymdD = (d) => ymdL(d);
const silentWav = (() => { const n = 1600, b = Buffer.alloc(44 + n); b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write("data", 36); b.writeUInt32LE(n, 40); b.fill(128, 44); return "data:audio/wav;base64," + b.toString("base64"); })();

// ── FAB. Кнопка ИИ уезжала при листании; с v64 её нет (Наставник в нижнем меню) ──
if (want("FAB")) {
  const tag = "FAB";
  const { c, q } = doneMap(S0);
  const { ctx, page, errors } = await open({ storage: { "sa_completed{uk}": c, "sa_quiz_done{uk}": q } });
  await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1200);
  // v64 (Доп. 377): плавающей кнопки больше нет — Наставник в нижнем меню; проверяем, что она не вернулась
  ok(tag + ": плавающей кнопки ИИ нет, Наставник в нижнем меню", (await page.locator('[data-fab]').count()) === 0);
  await page.evaluate(() => window.__saNav("me")); await sleep(700);
  ok(tag + ": и на другом экране её нет", (await page.locator('[data-fab]').count()) === 0);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── CEL. Погреб тем: освежить всё выдохшееся, проверка по треку ──
if (want("CEL")) {
  const tag = "CEL";
  const { c, q } = doneMap(S0, S1);
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_fresh{uk}": { s0: { t: Date.now() - 40 * DAY, n: 0 }, s1: { t: Date.now() - DAY, n: 1 } } };
  const st = { ok: true, v: 2, quiz: Object.keys(q), lessons: Object.keys(c), stars: {}, roles: [], last_role: "seasonal" };
  const { ctx, page, errors } = await open({ storage, rpcs: (fn) => (fn === "my_state" ? st : undefined) });
  await page.evaluate(() => window.__saNav("me")); await sleep(1000);
  let t = await text(page);
  ok(tag + ": в «Я» — «Погреб тем»", /Погреб тем/.test(t), (t.match(/Погреб тем.{0,60}/) || [""])[0]);
  await page.locator('.sa-card[aria-label="Погреб тем"]').first().click(); await sleep(1000);
  t = await text(page);
  ok(tag + ": сводка — свежие, выдыхаются, золото; две кнопки", /Твой погреб/.test(t) && /Освежить всё выдохшееся/.test(t) && /Проверка по треку/.test(t), t.slice(0, 260));
  await shot(page, "cel1");
  await page.locator('button[aria-pressed]', { hasText: "Освежить" }).first().click(); await sleep(400);
  t = await text(page);
  ok(tag + ": фильтр «Освежить» — выдохшаяся тема", /Психология первого дня/.test(t) && !/Встреча гостя/.test(t.slice(t.indexOf("Какие темы") >= 0 ? t.indexOf("Какие темы") : 0)), "");
  await page.locator("button", { hasText: "Освежить всё выдохшееся" }).click(); await sleep(1300);
  t = await tbText(page);
  ok(tag + ": стол «освежить всё» открылся", (await page.locator(".tb").count()) === 1 && /(Задание|Ситуация) 1 из 3/i.test(t), t.slice(0, 160));
  await playAll(page, true);
  t = await tbText(page);
  ok(tag + ": чек — «Темы освежены», список тем", /Темы освежены/.test(t) && (await page.locator(".tb .r-topics li").count()) === 1 && /освежена ✓/.test(t), t.slice(0, 300));
  await shot(page, "cel2-freshall");
  const fr = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_fresh" + uk) || "{}"), uk);
  ok(tag + ": свежесть темы обновлена", fr.s0 && fr.s0.t > Date.now() - 600000 && fr.s0.n >= 1, JSON.stringify(fr.s0));
  await page.locator(".tb .tb-foot .tb-main").click(); await sleep(800);
  t = await text(page);
  ok(tag + ": вернулись в погреб — выдохшихся нет", /Всё свежее, освежать нечего/.test(t) || !/Освежить всё выдохшееся/.test(t), t.slice(0, 200));
  await page.locator("button", { hasText: "Проверка по треку" }).click(); await sleep(1200);
  t = await tbText(page);
  ok(tag + ": проверка по треку — сначала правила", /Проверка по треку/.test(t) && /По 2 задания из каждой непройденной темы/.test(t) && (await page.locator(".tb .tb-intro").count()) === 1, t.slice(0, 200));
  await page.locator(".tb .tb-main", { hasText: "Начать проверку" }).click(); await sleep(700);
  await playAll(page, true, 20);
  t = await tbText(page);
  ok(tag + ": чек «Твой уровень» — темы и «Зачёт» у сильных", /Твой уровень/.test(t) && (await page.locator(".tb .r-topics li").count()) >= 2 && (await page.locator(".tb .r-topics li button", { hasText: "Зачёт" }).count()) >= 1, t.slice(0, 300));
  await shot(page, "cel3-probe");
  await page.locator(".tb .r-topics li button", { hasText: "Зачёт" }).first().click(); await sleep(1200);
  t = await tbText(page);
  ok(tag + ": «Зачёт» из проверки открывает правила зачёта", /Начать зачёт/.test(t) && /Нужно 6 из 7/.test(t), t.slice(0, 200));
  await page.locator(".tb .tb-ghost", { hasText: "Не сейчас" }).click(); await sleep(700);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── CR. Правила зачёта: «Не сейчас» попытку не тратит ──
if (want("CR")) {
  const tag = "CR";
  const { c, q } = doneMap(S0);
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q };
  const st = { ok: true, v: 2, quiz: Object.keys(q), lessons: Object.keys(c), stars: {}, roles: [], last_role: "seasonal" };
  const { ctx, page, errors } = await open({ storage, rpcs: (fn) => (fn === "my_state" ? st : undefined) });
  await page.evaluate(() => window.__saNav("home")); await sleep(1400);
  await page.locator(".tbp-strip .tbp-num").nth(1).click(); await sleep(900);
  await page.locator(".tbp-cur .tbm-act", { hasText: "зачёт на опыт" }).click(); await sleep(1100);
  ok(tag + ": правила зачёта", (await page.locator(".tb .tb-intro").count()) === 1);
  await page.locator(".tb .tb-ghost", { hasText: "Не сейчас" }).click(); await sleep(800);
  ok(tag + ": «Не сейчас» — зачёт сегодня ещё доступен", (await page.locator(".tbp-cur .tbm-act[disabled]", { hasText: "завтра" }).count()) === 0 && (await page.locator(".tbp-cur .tbm-act", { hasText: "зачёт на опыт" }).count()) === 1);
  await page.locator(".tbp-cur .tbm-act", { hasText: "зачёт на опыт" }).click(); await sleep(1100);
  await page.locator(".tb .tb-main", { hasText: "Начать зачёт" }).click(); await sleep(700);
  await answer(page, true);
  await page.locator(".tb .tb-x").first().click(); await sleep(600);
  const leave = page.locator(".tb .tb-sheet .tb-ghost, .tb .tb-sheet button", { hasText: /Выйти|Закончить|Уйти/ });
  if (await leave.count()) { await leave.first().click(); await sleep(700); }
  const tried = await page.evaluate((uk) => localStorage.getItem("sa_credit_try" + uk) || "", uk);
  ok(tag + ": после первого ответа попытка потрачена", /s1/.test(tried) || (await page.locator(".tbp-cur .tbm-act[disabled]", { hasText: "завтра" }).count()) === 1, tried);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── GR. Раунд мастера: запасная свеча, рекорд заведения ──
if (want("GR")) {
  const tag = "GR";
  const { c, q } = doneMap(S0);
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q };
  const st = { ok: true, v: 2, quiz: Object.keys(q), lessons: Object.keys(c), stars: {}, roles: [], last_role: "seasonal" };
  const calls = [];
  const rpcs = (fn) => fn === "my_state" ? st : fn === "gold_records" ? { ok: true, best: { sec: 38, w: 0, name: "Пётр", initial: "Л", me: false }, mine: { sec: 300, w: 1 }, n: 3 } : undefined;
  const { ctx, page, errors } = await open({ storage, rpcs, calls });
  await page.evaluate(() => window.__saNav("home")); await sleep(1400);
  await page.locator(".tbp-strip .tbp-num").first().click(); await sleep(900);
  await page.locator(".tbp-cur .tbm-act.gold").click(); await sleep(1300);
  let t = await tbText(page);
  ok(tag + ": в правилах — рекорд заведения и твой", /Рекорд заведения: 0:38 \(Пётр Л\.\)/.test(t) && /твой: 5:00/.test(t), t.slice(0, 300));
  ok(tag + ": запрос рекордов по теме", calls.some((x) => x.fn === "gold_records" && x.body.p_mod === "s0"));
  // v75 (Доп. 388): значки правил — свои (секундомер, крестик, свеча, корона), не эмодзи и не ✦
  const rulesIc = await page.evaluate(() => [...document.querySelectorAll(".tb .tb-intro li > span:first-child")].map((s) => ({ svg: !!s.querySelector("svg"), t: s.textContent.trim() })));
  ok(tag + ": значки правил — svg, без текста-эмодзи", rulesIc.length === 4 && rulesIc.every((x) => x.svg && !x.t), JSON.stringify(rulesIc));
  await page.locator(".tb .tb-main", { hasText: "Начать раунд" }).click(); await sleep(700);
  ok(tag + ": запасная свеча в шапке", (await page.locator(".tb .tb-spare").count()) === 1);
  await playAll(page, true);
  t = await tbText(page);
  ok(tag + ": в чеке — «Твой рекорд» (новый) и «Рекорд заведения»", /Твой рекорд/.test(t) && /\(новый\)/.test(t) && /Рекорд заведения/.test(t) && /Пётр Л\./.test(t), t.slice(0, 400));
  await shot(page, "gr1-receipt");
  ok(tag + ": печать «Золото» в чеке — с короной (svg), без ✦", (await page.locator(".tb .r-goldseal svg").count()) === 1 && !/✦/.test(await page.locator(".tb .r-goldseal").innerText().catch(() => "✦")));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── QT. Квест смены: сводка дня, «Спасибо команде», позвать на разминку ──
if (want("QT")) {
  const tag = "QT";
  const calls = [];
  let thanked = false, called = false;
  const people = () => [
    { id: "u-staff", name: "Анна", initial: "С", position: "waiter", me: true, steps: 3, warm: 1, guest: 1, synced: true, tg: true },
    { id: "x2", name: "Илья", initial: "Б", position: "bartender", me: false, steps: 2, warm: 1, guest: 0, synced: true, tg: true },
    { id: "x3", name: "Мария", initial: "К", position: "waiter", me: false, steps: 0, warm: 0, guest: 0, synced: false, tg: true, called },
    { id: "x4", name: "Пётр", initial: "Л", position: "waiter", me: false, steps: 0, warm: 0, guest: 0, synced: false, tg: false },
  ];
  const quest = () => ({ ok: true, date: today, restaurant: "Два моря, Океан", known: true, me_on: true, people: people(), lead: true, tg: true,
    goal: { warm: 3, steps: 6, guest: 1 }, done: { warm: 2, steps: 5, guest: 1 }, complete: false, thanks: thanked ? [{ me: true, name: "Анна" }, { name: "Илья", initial: "Б" }] : [{ name: "Илья", initial: "Б" }] });
  const rpcs = (fn) => {
    if (fn === "day_brief") return { ok: true, quest: quest(), pair: { ok: true, pair: null, invites: [], outgoing: null }, league: { pts: 85, rank_rest: 2, rank_net: 4, n_rest: 5, n_net: 12 } };
    if (fn === "quest_today") return quest();
    if (fn === "quest_thanks") { thanked = true; return { ok: true }; }
    if (fn === "quest_call") { called = true; return { ok: true, sent: 1, no_tg: 1 }; }
    return undefined;
  };
  const { ctx, page, errors } = await open({ rpcs, calls, profile: { ...prof, position: "senior" }, storage: { "sa_sched_cache_main_{mkey}": SCHED_CACHE } });
  await page.evaluate(() => window.__saNav("shift")); await sleep(1600);
  let t = await text(page);
  ok(tag + ": квест из сводки дня (один запрос)", calls.some((x) => x.fn === "day_brief") && /Смена вместе/.test(t) && /4 человека в смене/.test(t), (t.match(/Квест.{0,120}/) || [""])[0]);
  ok(tag + ": «Спасибо команде» и кто уже сказал", /Спасибо команде/.test(t) && /Спасибо от Илья Б\./.test(t), (t.match(/Спасибо.{0,80}/) || [""])[0]);
  ok(tag + ": старшему — кто не начал и «Позвать на разминку»", /Ещё не начали: Мария К\., Пётр Л\./.test(t) && /Без Telegram: Пётр Л\./.test(t) && (await page.locator("[data-quest] .tg-chipbtn", { hasText: "Позвать на разминку" }).count()) === 1, (t.match(/Ещё не начали.{0,80}/) || [""])[0]);
  await page.locator("[data-quest] .tg-chipbtn", { hasText: "Спасибо команде" }).click(); await sleep(1200);
  t = await text(page);
  ok(tag + ": спасибо — на сервер и в строку", calls.some((x) => x.fn === "quest_thanks") && /Ты сказал\(а\) спасибо ✓/.test(t) && /Спасибо от тебя, Илья Б\./.test(t), (t.match(/Спасибо от.{0,40}/) || [""])[0]);
  await page.locator("[data-quest] .tg-chipbtn", { hasText: "Позвать на разминку" }).click(); await sleep(1200);
  t = await text(page);
  ok(tag + ": позвали — сообщение и «(позвали)»", calls.some((x) => x.fn === "quest_call") && /Позвали 1 человека через Telegram\. Без Telegram: 1/.test(t) && /Мария К\. \(позвали\)/.test(t), (t.match(/Позвали.{0,80}/) || [""])[0]);
  await shot(page, "qt1-quest");
  await page.evaluate(() => window.__saNav("teamHub")); await sleep(900);
  t = await text(page);
  ok(tag + ": в «Команде» — место в лиге из сводки", /2-е место в заведении из 5 · 85 очков · в сети 4-е/.test(t), (t.match(/Лига недели.{0,80}/) || [""])[0]);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── PN. Свеча на двоих: подтолкнуть, вехи ──
if (want("PN")) {
  const tag = "PN";
  const calls = [];
  let nudged = false;
  const days = [6, 5, 4, 3, 2, 1, 0].map((n) => { const d = new Date(); d.setDate(d.getDate() - n); return { d: ymdL(d), me: n === 0 ? 2 : 2, partner: n === 0 ? 0 : 2 }; });
  const pair = () => ({ ok: true, today, pair: { id: 7, since: days[0].d, inviter: true, partner: { id: "x2", name: "Аня", surname: "Ким", position: "waiter" }, partner_today: { steps: 0, warm: 0, state: 0 }, me_today: { steps: 2, state: 2 }, streak: 30, days, nudged }, invites: [], outgoing: null });
  const rpcs = (fn) => fn === "pair_status" ? pair() : fn === "pair_nudge" ? (nudged ? { ok: false, error: "already" } : (nudged = true, { ok: true })) : undefined;
  const { ctx, page, errors } = await open({ rpcs, calls });
  await page.evaluate(() => window.__saNav("me")); await sleep(1200);
  await page.locator('.sa-card[aria-label="Свеча на двоих"]').first().click(); await sleep(1300);
  let t = await text(page);
  ok(tag + ": вехи — 7 и 30 взяты", /Ты и Аня · 30 дней вместе/.test(t) && (await page.locator(".tg-ms span.got").count()) === 2, (t.match(/Ты и.{0,60}/) || [""])[0]);
  ok(tag + ": веха месяца — поздравление", /Месяц вместе/.test(t));
  ok(tag + ": «Подтолкнуть: Аня получит сообщение»", (await page.locator("button", { hasText: "Подтолкнуть: Аня получит сообщение" }).count()) === 1);
  await page.locator("button", { hasText: "Подтолкнуть" }).click(); await sleep(1000);
  t = await text(page);
  ok(tag + ": подтолкнули — на сервер ушло", calls.some((x) => x.fn === "pair_nudge") && /Аня получит сообщение в Telegram/.test(t), (t.match(/Аня получит.{0,60}/) || [""])[0]);
  await shot(page, "pn1-pair");
  await page.locator(".tg-sheet .tg-ghost", { hasText: "Закрыть" }).click(); await sleep(500);
  await page.locator('.sa-card[aria-label="Свеча на двоих"]').first().click(); await sleep(1200);
  t = await text(page);
  ok(tag + ": второй раз — без поздравления, «ещё 70 дней до вехи «100 дней»»", !/Месяц вместе/.test(t) && /ещё 70 дней до вехи «100 дней»/.test(t), (t.match(/до вехи.{0,40}/) || [""])[0]);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── LGP. Лига: подиум, стрелки, «до места — это …», прошлая неделя, история кубка ──
if (want("LGP")) {
  const tag = "LGP";
  const prevWs = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7); return ymdL(d); })();
  const prev2 = (() => { const d = new Date(prevWs + "T12:00:00"); d.setDate(d.getDate() - 7); return ymdL(d); })();
  const L = { ok: true, week_start: today, today, restaurant: "Два моря, Океан", verified: true, rows: [
    { id: "p2", name: "Иван", surname: "Петров", restaurant: "Два моря, Океан", position: "waiter", pts: 140, days: 3, me: false, prev_rest: 2, prev_net: 3 },
    { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", pts: 100, days: 2, me: true, prev_rest: 1, prev_net: 1 },
    { id: "p4", name: "Ольга", surname: "Белова", restaurant: "Два моря, Океан", position: "waiter", pts: 30, days: 1, me: false, prev_rest: 3, prev_net: 5 },
    { id: "p1", name: "Пётр", surname: "Л.", restaurant: "Два моря, Причал", position: "waiter", pts: 120, days: 3, me: false, prev_net: 2 },
  ], me_prev: { rank_rest: 1, rank_net: 1, pts: 210 }, wins: { rest: 2, net: 1 },
  cup: [{ restaurant: "Два моря, Причал", people: 3, active: 2, pts: 150, avg: 50, mine: false, prev_rank: 2 }, { restaurant: "Два моря, Океан", people: 4, active: 3, pts: 270, avg: 67.5, mine: true, prev_rank: 1 }],
  cup_hist: [{ week_start: prevWs, restaurant: "Два моря, Океан" }, { week_start: prev2, restaurant: "Два моря, Океан" }] };
  const storage = { "sa_activity{uk}": { [today]: { st: 2, l: 1 } } };
  const { ctx, page, errors } = await open({ storage, rpcs: (fn) => fn === "league_week" ? L : fn === "team_scores" ? { ok: true, rows: [] } : undefined });
  await page.evaluate(() => window.__saNav("league")); await sleep(1500);
  let t = await text(page);
  ok(tag + ": «до 1-го места не хватает 41 очка: это …»", /До 1-го места не хватает 41 очка: это 3 живых гостя или 5 уроков\./.test(t), (t.match(/До \d.{0,80}/) || [""])[0]);
  ok(tag + ": прошлая неделя и победы", /Прошлая неделя: 1-е место в заведении, 1-е в сети · 210 очков/.test(t) && /Побед недели в заведении: 2, в сети: 1/.test(t), (t.match(/Прошлая неделя.{0,120}/) || [""])[0]);
  ok(tag + ": подиум из трёх", (await page.locator('[aria-label="Подиум недели"] > div').count()) === 3);
  ok(tag + ": стрелки — Иван ▲1, ты ▼1", (await page.locator('[aria-label="выше на 1"]').count()) >= 1 && (await page.locator('[aria-label="ниже на 1"]').count()) >= 1);
  ok(tag + ": кубок — серия и история", /Кубок у «Два моря, Океан» 2 недели подряд/.test(t) && /История кубка:/.test(t), (t.match(/Кубок у.{0,60}/) || [""])[0]);
  await page.getByText("За что очки ›").click(); await sleep(300);
  ok(tag + ": уроки и тесты сверяются с сервером", /сверяются с записями сервера/.test(await text(page)));
  await shot(page, "lgp1");
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── MO. Итоги месяца: сравнение с прошлым, подписи с числом, картинка ──
if (want("MO")) {
  const tag = "MO";
  const act = {};
  const now = new Date();
  for (let n = 0; n < now.getDate(); n++) { const d = new Date(); d.setDate(d.getDate() - n); act[ymdL(d)] = { st: 3, l: 2, w: 1 }; }
  const pm = new Date(now.getFullYear(), now.getMonth() - 1, 2); act[ymdL(pm)] = { st: 1, l: 1 };
  const storage = { "sa_activity{uk}": act };
  const { ctx, page, errors } = await open({ storage });
  await page.evaluate(() => window.__saNav("me")); await sleep(900);
  await page.locator('.sa-card[aria-label="Итоги месяца"]').first().click(); await sleep(900);
  ok(tag + ": на обложке — рисунок", (await page.locator(".mr-body .mr-art svg").count()) === 1);
  const seen = [];
  for (let k = 0; k < 10; k++) {
    seen.push(await page.evaluate(() => (document.querySelector(".mr-body") || {}).innerText || ""));
    if (await page.locator(".mr-btn").count()) break;
    await page.locator('.mr-nav button[aria-label="Дальше"]').click(); await sleep(450);
  }
  const all = seen.join(" | ").replace(/\s+/g, " ");
  const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
  const nl = now.getDate() * 2, nw = now.getDate();
  ok(tag + ": шаги — «N уроков · N разминок» с правильными окончаниями", all.includes(nl + " " + pl(nl, "урок", "урока", "уроков")) && all.includes(nw + " " + pl(nw, "разминка", "разминки", "разминок")), (all.match(/ШАГИ.{0,160}/i) || [""])[0]);
  // v109: в последние дни месяца (сегодняшнее число не меньше, чем дней в прошлом месяце) прошлый сравнивается целиком —
  // «К прошлому месяцу» (lib/month-recap.js, partial); 30 октября проверка ждала «к 30-му числу» и падала
  const pDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate(), cmpRe = now.getDate() < pDays ? /к \d+-му числу/i : /к прошлому месяцу/i;
  ok(tag + ": карточка сравнения — к прошлому числу (в последние дни месяца — к прошлому месяцу)", cmpRe.test(all) && /Шагов больше, чем в/.test(all), (all.match(/к (\d+-му|прошлому).{0,140}/i) || [""])[0]);
  await shot(page, "mo1-end");
  await page.locator(".mr-btn[data-recap-pic]").click(); await sleep(2200);
  ok(tag + ": картинкой — просмотр с «Скачать картинку»", (await page.locator(".mr-pv img").count()) === 1 && (await page.locator(".mr-pv a.mr-btn[download]").count()) === 1);
  const dims = await page.evaluate(() => { const im = document.querySelector(".mr-pv img"); return im ? im.naturalWidth + "x" + im.naturalHeight : ""; });
  ok(tag + ": картинка 1080×1350", dims === "1080x1350", dims);
  await shot(page, "mo2-picture");
  await page.locator(".mr-pv .mr-ghost", { hasText: "Готово" }).click(); await sleep(400);
  ok(tag + ": «Готово» закрывает просмотр, итоги на месте", (await page.locator(".mr-pv").count()) === 0 && (await page.locator(".mr").count()) === 1);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── RDV. Радио: названия во вкладках, «Вся дорога», живые голоса ──
if (want("RDV")) {
  const tag = "RDV";
  const { c, q } = doneMap(S0);
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_fresh{uk}": { s0: { t: Date.now() - 20 * DAY, n: 0 } } };
  const { ctx, page, errors } = await open({ storage });
  await page.evaluate(() => window.__saNav("shift")); await sleep(1000);
  await page.locator('.sa-card[aria-label="Радио в дорогу"]').first().click(); await sleep(1500);
  const tabs = await page.locator(".tb .rd-tab span").allInnerTexts();
  ok(tag + ": во вкладках — названия уроков, а не «Повтор / Повтор»", tabs.length === 3 && new Set(tabs).size === 3 && tabs.every((x) => x.length > 6), JSON.stringify(tabs));
  ok(tag + ": переключатель «Вся дорога», живых голосов нет без сервера", (await page.locator("[data-radio-road]").count()) === 1 && (await page.locator("[data-radio-live]").count()) === 0);
  await page.locator("[data-radio-road]").click(); await sleep(200);
  ok(tag + ": «Вся дорога» запомнилась", (await page.evaluate(() => localStorage.getItem("sa_radio_road"))) === "1");
  await page.locator(".tb .rd-ctl .play").click();
  let hops = 0;
  for (let i = 0; i < 90; i++) { await sleep(500); const ph = await page.locator(".tb .rd-q").count(); if (ph) break; hops = i; }
  const sel = await page.locator(".tb .rd-tab.on").count() ? await page.locator(".tb .rd-tab").evaluateAll((els) => els.findIndex((e) => e.classList.contains("on"))) : -1;
  let t = await tbText(page);
  ok(tag + ": вся дорога — три выпуска подряд, вопросы в конце", (await page.locator(".tb .rd-q").count()) >= 1 && sel === 2, "вкладка " + sel + " · " + t.slice(0, 120));
  // ответить на вопросы последнего выпуска
  for (let round = 0; round < 3; round++) {
    const qn = await page.locator(".tb .rd-q").count();
    for (let k = 0; k < qn; k++) { await page.locator(".tb .rd-q").nth(k).locator("button").first().click(); await sleep(250); }
    await sleep(900);
    const more = page.locator(".tb .tb-main", { hasText: "Вопросы к" });
    if (await more.count()) { await more.click(); await sleep(600); } else break;
  }
  t = await tbText(page);
  ok(tag + ": после дороги — отложенные вопросы пройдены, «Дальше в плейлисте» — дослушано", /Дальше в плейлисте/i.test(t) && (await page.locator(".tb .rd-next .dn").count()) === 2, t.slice(0, 300));
  const act = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_activity" + uk) || "{}"), uk);
  ok(tag + ": все три выпуска засчитаны", ((act[today] || {}).r || 0) === 3, JSON.stringify(act[today] || {}));
  await shot(page, "rdv1-done");
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
  // живые голоса: сервер настроен — переключатель, фразы с сервера; ошибка — дальше голос телефона
  const ttsCalls = [];
  let fail = false;
  const tts = (b) => b.probe ? { ok: true, configured: true } : fail ? { ok: false, error: "daily_limit" } : { ok: true, url: silentWav, cached: true };
  const r2 = await open({ storage: { ...storage, sa_radio_road: "0" }, tts, ttsCalls });
  await r2.page.evaluate(() => window.__saNav("shift")); await sleep(1000);
  await r2.page.locator('.sa-card[aria-label="Радио в дорогу"]').first().click(); await sleep(1500);
  ok(tag + ": «Живые голоса» — есть и включены", (await r2.page.locator('[data-radio-live][aria-checked="true"]').count()) === 1);
  await r2.page.locator(".tb .rd-ctl .play").click(); await sleep(2500);
  const asked = ttsCalls.filter((x) => !x.probe);
  ok(tag + ": фразы просит у сервера (ведущий, по голосам)", asked.length >= 2 && asked[0].who === "host" && /Радио в дорогу/.test(asked[0].text || ""), JSON.stringify(asked.slice(0, 2)).slice(0, 200));
  const spokenBefore = await r2.page.evaluate(() => (window.__spoken || []).filter((x) => String(x).trim()).length);
  ok(tag + ": голос телефона не нужен, пока сервер отвечает", spokenBefore === 0, String(spokenBefore));
  fail = true;
  await r2.page.locator('.tb button[aria-label="Дальше на фразу"]').click(); await sleep(2500);
  t = await tbText(r2.page);
  const spokenAfter = await r2.page.evaluate(() => (window.__spoken || []).filter((x) => String(x).trim()).length);
  ok(tag + ": лимит — «дальше читает телефон», голос телефона подхватил", /Живые голоса на сегодня закончились\. Дальше читает телефон/.test(t) && spokenAfter >= 1, spokenAfter + " · " + t.slice(0, 160));
  await shot(r2.page, "rdv2-live");
  ok(tag + ": без ошибок (живые голоса)", r2.errors.length === 0, r2.errors.slice(0, 3).join(" | "));
  await r2.ctx.close();
}

// ── GU. Живой гость: стол сверху, настроение, шёпот, поток, было/стало, свои гости ──
if (want("GU")) {
  const tag = "GU";
  const { c, q } = doneMap(S0);
  const own = [{ id: "c-abc123abc123", place: "hall", name: "Пётр", age: 40, mood: 3, who: "Бизнес-ланч с коллегами", occasion: "деловой обед", hidden: "Не ест мясо", open: "Добрый день! Что у вас без мяса?", whisper: "Спроси про ограничения в еде", tags: ["вегетарианец"], custom: true }];
  const saved = [];
  const rpcs = (fn, body) => {
    if (fn === "guest_personas") return { ok: true, rows: own.slice(), can_edit: true };
    if (fn === "guest_persona_save") { const row = { ...body.p_data, id: body.p_data.id || "c-new000000001", custom: true }; saved.push(row); own.push(row); return { ok: true, row }; }
    return undefined;
  };
  const chat = [];
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_guest_runs{uk}": [{ d: today, s: 3, p: "zzz", ai: true }] };
  const { ctx, page, errors } = await open({ storage, chat, rpcs, stream: true, profile: { ...prof, position: "senior" } });
  await page.evaluate(() => window.__saNav("shift")); await sleep(1100);
  await page.locator('.sa-card[aria-label="Живой гость"]').first().click(); await sleep(1600);
  ok(tag + ": на карточке — стол сверху", (await page.locator(".tb .lg-card svg.lg-top").count()) === 1);
  ok(tag + ": старшему — «Гости заведения: 1 · Изменить»", /Гости заведения: 1/.test(await tbText(page)) && (await page.locator("[data-persona-open]").count()) === 1);
  await shot(page, "gu1-card");
  // редактор: добавить своего гостя
  await page.locator("[data-persona-open]").click(); await sleep(500);
  ok(tag + ": редактор — список своих гостей", (await page.locator("[data-persona-editor] li").count()) === 1 && /Пётр/.test(await tbText(page)));
  await page.locator("[data-persona-editor] .tb-main", { hasText: "Добавить гостя" }).click(); await sleep(300);
  await page.locator('[data-persona-editor] input[placeholder="Например, Пётр"]').fill("Зоя");
  await page.locator('[data-persona-editor] textarea[placeholder^="Добрый день!"]').fill("Здравствуйте, нам столик на двоих у окна.");
  await page.locator('[data-persona-editor] input[placeholder="вегетарианец, торопится"]').fill("у окна, юбилей");
  await page.locator('[data-persona-editor] input[placeholder="Спроси про время и предпочтения"]').fill("Спроси про повод и предложи тихий стол");
  await page.locator("[data-persona-editor] .tb-main", { hasText: "Сохранить" }).click(); await sleep(700);
  ok(tag + ": сохранено на сервер — имя, первая фраза, шёпот, метки", saved.length === 1 && saved[0].name === "Зоя" && /у окна/.test(saved[0].open) && /тихий стол/.test(saved[0].whisper) && JSON.stringify(saved[0].tags) === JSON.stringify(["у окна", "юбилей"]), JSON.stringify(saved[0] || {}).slice(0, 200));
  ok(tag + ": новый гость в списке", (await page.locator("[data-persona-editor] li").count()) === 2);
  await shot(page, "gu2-editor");
  await page.locator("[data-persona-editor] li", { hasText: "Зоя" }).locator("button", { hasText: "Сыграть" }).click(); await sleep(600);
  let t = await tbText(page);
  ok(tag + ": «Сыграть» — карточка своего гостя с меткой", /Зоя/.test(t) && /гость заведения/i.test(t), t.slice(0, 200));
  // разговор: настроение, шёпот, поток
  await page.locator(".tb .tb-main").click(); await sleep(700);
  ok(tag + ": крупное настроение гостя", (await page.locator(".tb .lg-mood[data-mood]").count()) === 1);
  ok(tag + ": «Шёпот наставника» — есть", (await page.locator(".tb [data-whisper]").count()) === 1);
  await page.locator(".tb [data-whisper]").click(); await sleep(300);
  t = await tbText(page);
  ok(tag + ": шёпот — один раз", /Шёпот наставника/.test(t) && (await page.locator(".tb [data-whisper][disabled]").count()) === 1, t.slice(-200));
  await page.locator(".tb .lg-in").fill("Добрый вечер! Столик у окна свободен, присаживайтесь.");
  await page.locator(".tb .lg-send").click(); await sleep(1300);
  const sent = chat[chat.length - 1] || {};
  ok(tag + ": реплика потоком (stream) и свой гость по номеру", sent.stream === true && sent.guest && sent.guest.id === saved[0].id, JSON.stringify({ stream: sent.stream, id: sent.guest && sent.guest.id }));
  t = await tbText(page);
  ok(tag + ": ответ гостя собран из потока, метки скрыты", (await page.locator(".tb .lg-g").count()) === 2 && !/\[\[/.test(t) && /поезд/.test(t), t.slice(-200));
  ok(tag + ": «живых реплик сегодня» — видно всегда", (await page.locator(".tb [data-left]").count()) === 1, t.slice(-120));
  await page.locator(".tb .lg-in").fill("Подадим за 10 минут. Чай чёрный или зелёный?");
  await page.locator(".tb .lg-send").click(); await sleep(1300);
  ok(tag + ": настроение выросло — «стало лучше ↑»", (await page.locator('.tb .lg-mood[data-mood="4"]').count()) === 1 && /стало лучше ↑/.test(await tbText(page)));
  await page.locator(".tb .lg-in").fill("Счёт сейчас принесу. Спасибо!");
  await page.locator(".tb .lg-send").click(); await sleep(1300);
  await page.locator(".tb .tb-main", { hasText: "Получить чек разбора" }).click(); await sleep(1500);
  t = await tbText(page);
  ok(tag + ": в чеке — линия настроения", (await page.locator(".tb .lg-line").count()) === 1 && /НАСТРОЕНИЕ ГОСТЯ/.test(t), t.slice(0, 300));
  ok(tag + ": было/стало — прошлый разговор 3 → 4 ▲", /ПРОШЛЫЙ РАЗГОВОР/.test(t) && /3 \/ 5 → 4 \/ 5 ▲/.test(t));
  ok(tag + ": шёпот отмечен в чеке", /с шёпотом наставника/.test(t));
  const runs = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_guest_runs" + uk) || "[]"), uk);
  ok(tag + ": разговор сохранён с шёпотом и линией настроения", runs.length === 2 && runs[1].w === 1 && Array.isArray(runs[1].m) && runs[1].m.length >= 3, JSON.stringify(runs[1] || {}));
  await shot(page, "gu3-receipt");
  await page.locator(".tb [data-guest-again]").click(); await sleep(700);
  ok(tag + ": «Ещё раз с этим гостем» — тот же гость, разговор с начала", (await page.locator(".tb .lg-g").count()) === 1 && /Зоя/.test(await tbText(page)) && (await page.locator(".tb [data-whisper]:not([disabled])").count()) === 1);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── RM. Напоминания: что ещё присылать ──
if (want("RM")) {
  const tag = "RM";
  const calls = [];
  let prefs = { ok: true, bot: true, linked: true, remind: true, pair: true, quest: true, league: false, fresh: true, month: true };
  const rpcs = (fn, body) => {
    if (fn === "tg_status") return { ok: true, bot: true, linked: true, remind: true, minutes: 60 };
    if (fn === "notify_prefs") return prefs;
    if (fn === "notify_set") { prefs = { ...prefs, [body.p_kind]: !!body.p_on }; return prefs; }
    return undefined;
  };
  const { ctx, page, errors } = await open({ rpcs, calls, telegram: true });
  await page.evaluate(() => window.__saNav("shift")); await sleep(1000);
  await page.locator('.sa-card[aria-label="Напоминания в Telegram"]').first().click(); await sleep(1200);
  const t = await text(page);
  ok(tag + ": включено — и «Что ещё присылать» с пятью переключателями", /Включено: за час до смены/.test(t) && /Что ещё присылать/i.test(t) && (await page.locator('[data-notify-prefs] [role="switch"]').count()) === 5, t.slice(0, 200));
  const lg = page.locator('[data-notify-prefs] [role="switch"]', { hasText: "Лига недели" });
  ok(tag + ": «Лига недели» выключена", (await lg.getAttribute("aria-checked")) === "false");
  await lg.click(); await sleep(700);
  ok(tag + ": включили — на сервер и в переключатель", calls.some((x) => x.fn === "notify_set" && x.body.p_kind === "league" && x.body.p_on === true) && (await lg.getAttribute("aria-checked")) === "true");
  await shot(page, "rm1");
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── DL. Ссылки из сообщений бота: ?go=… ──
if (want("DL")) {
  const tag = "DL";
  const { c, q } = doneMap(S0);
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_fresh{uk}": { s0: { t: Date.now() - 40 * DAY, n: 0 } }, "sa_activity{uk}": { [today]: { st: 2, l: 2 } } };
  for (const [go, check] of [["cellar", async (p) => /Твой погреб/.test(await text(p))], ["month", async (p) => (await p.locator(".mr").count()) === 1], ["league", async (p) => /Лига недели/.test(await text(p)) && /у тебя/.test(await text(p))]]) {
    const { ctx, page, errors } = await open({ storage, url: "/?go=" + go });
    await sleep(1500);
    ok(tag + ": ?go=" + go + " — открылось", await check(page));
    ok(tag + ": ?go=" + go + " — без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── AS. Наставник ведёт в погреб тем ──
if (want("AS")) {
  const tag = "AS";
  const { c, q } = doneMap(S0);
  const { ctx, page, errors } = await open({ storage: { "sa_completed{uk}": c, "sa_quiz_done{uk}": q }, assistant: "Освежи бледные темы — это пара минут.\n[[go:cellar|Погреб тем]]" });
  await page.evaluate(() => window.__saNav("assistant")); await sleep(1200);
  await page.locator('textarea[placeholder="Спроси наставника…"]').fill("Где посмотреть, какие темы выдохлись?");
  await page.locator('textarea[placeholder="Спроси наставника…"]').press("Enter").catch(() => {});
  await sleep(300);
  const sendBtn = page.locator("button:has(svg path[d='M22 2L11 13'])");
  if (await sendBtn.count()) { await sendBtn.first().click().catch(() => {}); }
  await sleep(1800);
  ok(tag + ": кнопка «Погреб тем» в ответе", (await page.locator("button", { hasText: "Погреб тем" }).count()) >= 1, (await text(page)).slice(-200));
  await page.locator("button", { hasText: "Погреб тем" }).last().click(); await sleep(1000);
  ok(tag + ": переход в погреб", /Твой погреб/.test(await text(page)));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
process.exit(bad ? 1 : 0);
