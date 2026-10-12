// e2e v30: рейтинг «Моё заведение / Вся сеть», Живой гость, свежесть тем, квест смены,
// Лига недели и Кубок заведений, Свеча на двоих, Зачёт на опыт, Золотая тема, Радио в дорогу,
// Итоги месяца.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = "/home/claude/preview/site", PORT = 5197, OUT = "/home/claude/preview/shots-v30";
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
async function open({ storage = {}, telegram = false, light = false, w = 390, h = 844, url = "/", schedule = null, fixedTime = null, chat = [], rpcs = null, profile = prof, calls = [], ai = "guest" }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    if (/\/functions\/v1\/ai-chat/.test(u)) {
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      chat.push(body);
      if (body.mode === "guest") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(guestAi(body, ai)) });
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

// ── R. Рейтинг: заведение и сеть (Доп. 311) ──
if (want("R")) {
  const tag = "R";
  const nowIso = new Date().toISOString();
  const row = (name, surname, restaurant, quiz_id, score, position = "waiter") => ({ id: name + quiz_id, name, surname, restaurant, role: "seasonal", position, quiz_id, score, total: 10, updated_at: nowIso });
  const rows = [
    row("Анна", "Смирнова", "Два моря, Океан", "s0-q", 8), row("Анна", "Смирнова", "Два моря, Океан", "s1-q", 9),
    row("Иван", "Петров", "Два моря, Океан", "s0-q", 9), row("Ольга", "Белова", "Два моря, Океан", "s0-q", 6),
    row("Пётр", "Лис", "Два моря, Причал", "s0-q", 10), row("Вера", "Ким", "Два моря, Причал", "s0-q", 10),
    row("Кира", "Ли", "Два моря, Причал", "s0-q", 5), row("Олег", "Ру", "Два моря, Причал", "s0-q", 9, "bartender"),
  ];
  const rpcs = (fn) => fn === "team_scores" ? { ok: true, rows } : undefined;
  for (const light of [false, true]) {
    const t2 = tag + (light ? "-light" : "");
    const { ctx, page, errors } = await open({ rpcs, light, storage: { "sa_hint_v5_leaderboard_scope": "0" } });
    await page.evaluate(() => window.__saNav("leaderboard")); await sleep(1200);
    let t = await text(page);
    ok(t2 + ": «Твоё место» — два числа", /ТВОЁ МЕСТО · ОФИЦИАНТЫ/.test(t) && /в заведении/.test(t) && /во всей сети/.test(t), t.slice(0, 220));
    const halves = await page.locator('[aria-label="Какой рейтинг показать"] button').allInnerTexts();
    ok(t2 + ": в заведении 2-я из 3, в сети 4-я из 6", /^2\s*из 3/.test(halves[0] || "") && /^4\s*из 6/.test(halves[1] || ""), JSON.stringify(halves));
    const names = await page.evaluate(() => [...document.querySelectorAll("div")].filter(d => /^(Анна|Иван|Ольга|Пётр|Вера|Кира) /.test(d.textContent || "") && d.children.length === 0).map(d => d.textContent));
    ok(t2 + ": по умолчанию — список своего заведения", names.includes("Иван Петров") && !names.includes("Пётр Лис"), names.join(","));
    ok(t2 + ": подсказка про два числа — один раз", /два числа: в своём заведении и во всей сети/.test(t));
    await page.screenshot({ path: OUT + "/r-rest" + (light ? "-l" : "") + ".png" });
    await page.locator('[aria-label="Какой рейтинг показать"] button', { hasText: "во всей сети" }).click(); await sleep(500);
    const names2 = await page.evaluate(() => [...document.querySelectorAll("div")].filter(d => /^(Анна|Иван|Ольга|Пётр|Вера|Кира|Олег) /.test(d.textContent || "") && d.children.length === 0).map(d => d.textContent));
    // v31: коллеги других заведений — имя и первая буква фамилии
    ok(t2 + ": тап по «во всей сети» — сеть, бармен — в своей вкладке", names2.includes("Пётр Л.") && names2.includes("Вера К.") && !names2.some((x) => /^Олег/.test(x)) && !names2.includes("Пётр Лис"), names2.join(","));
    ok(t2 + ": выбор запомнился", (await page.evaluate(() => localStorage.getItem("sa_lb_scope"))) === "net");
    await page.screenshot({ path: OUT + "/r-net" + (light ? "-l" : "") + ".png" });
    await page.evaluate(() => window.__saNav("teamHub")); await sleep(900);
    t = await text(page);
    ok(t2 + ": «Команда» — место в ресторане и в сети (все должности)", /ты — 2-й · в сети 5-й/.test(t), (t.match(/ЛИДЕРЫ РЕСТОРАНА.{0,60}/) || [""])[0]);
    ok(t2 + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
  // одно заведение — переключателя нет, как раньше
  {
    const one = rows.filter(r => r.restaurant === "Два моря, Океан");
    const { ctx, page, errors } = await open({ rpcs: (fn) => fn === "team_scores" ? { ok: true, rows: one } : undefined });
    await page.evaluate(() => window.__saNav("leaderboard")); await sleep(1100);
    const t = await text(page);
    ok(tag + ": одно заведение — без «Твоё место», как раньше", !/ТВОЁ МЕСТО/.test(t) && /Иван Петров/.test(t));
    await page.evaluate(() => window.__saNav("teamHub")); await sleep(800);
    ok(tag + ": одно заведение — в «Команде» без «в сети»", !/в сети/.test(await text(page)));
    ok(tag + ": без ошибок (одно заведение)", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── F. Свежесть тем (Доп. 313) ──
if (want("F")) {
  const tag = "F";
  const { c, q } = doneMap(S0, S1);
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_fresh{uk}": { s0: { t: Date.now() - 10 * DAY, n: 0 }, s1: { t: Date.now() - 4 * DAY, n: 0 } } };
  const { ctx, page, errors } = await open({ storage, rpcs: (fn) => (fn === "my_state" ? { ok: true, v: 2, quiz: Object.keys(q), lessons: Object.keys(c), stars: {}, roles: [], last_role: "seasonal" } : undefined) });
  await page.evaluate(() => window.__saNav("home")); await sleep(1400);
  const cls = await page.evaluate(() => [...document.querySelectorAll(".tbp-strip .tbp-num")].slice(0, 3).map(b => b.className));
  ok(tag + ": s0 выдохлась (fade2), s1 выдыхается (fade1)", /fade2/.test(cls[0] || "") && /fade1/.test(cls[1] || "") && !/fade/.test(cls[2] || ""), JSON.stringify(cls));
  await page.locator(".tbp-strip .tbp-num").first().click(); await sleep(900);
  let t = await text(page);
  ok(tag + ": в меню темы — «тема выдохлась» и «Освежить»", /тема выдохлась/i.test(t) && (await page.locator(".tbp-cur .tbm-act.hot", { hasText: "Освежить" }).count()) === 1, (t.match(/тема[^·]{0,40}/i) || [""])[0]);
  await shot(page, "f1-faded");
  await page.locator(".tbp-cur .tbm-act", { hasText: "Освежить" }).click(); await sleep(1200);
  t = await text(page);
  ok(tag + ": открылся стол «Освежить тему»", /Освежить тему/.test(t) && /Психология первого дня/.test(t));
  await shot(page, "f2-refresh");
  await playAll(page, true);
  t = await text(page);
  ok(tag + ": чек — «Тема освежена», следующий повтор через 7 дней", /Тема освежена/.test(t) && /через 7 дней/.test(t), t.slice(0, 300));
  await shot(page, "f3-receipt");
  const fr = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_fresh" + uk) || "{}"), uk);
  ok(tag + ": запись свежести — n=1, отсчёт с сейчас", fr.s0 && fr.s0.n === 1 && Date.now() - fr.s0.t < 120000, JSON.stringify(fr.s0));
  const act = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_activity" + uk) || "{}"), uk);
  ok(tag + ": в журнале дня — «освежено» (u)", Object.values(act).some(r => r.u >= 1));
  await page.locator(".tb .tb-foot .tb-main").click(); await sleep(700);
  const cls2 = await page.evaluate(() => (document.querySelector(".tbp-strip .tbp-num") || {}).className || "");
  ok(tag + ": номер темы снова яркий", !/fade/.test(cls2), cls2);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── C. Зачёт на опыт (Доп. 315) ──
if (want("C")) {
  const tag = "C";
  const { c, q } = doneMap(S0);
  const calls = [];
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q };
  const st = { ok: true, v: 2, quiz: Object.keys(q), lessons: Object.keys(c), stars: {}, roles: [], last_role: "seasonal" };
  const { ctx, page, errors } = await open({ storage, calls, rpcs: (fn) => (fn === "my_state" ? st : undefined) });
  await page.evaluate(() => window.__saNav("home")); await sleep(1400);
  await page.locator(".tbp-strip .tbp-num").nth(1).click(); await sleep(900);
  ok(tag + ": в непройденной теме — «Я это умею — зачёт на опыт»", (await page.locator(".tbp-cur .tbm-act", { hasText: "зачёт на опыт" }).count()) === 1);
  await page.locator(".tbp-cur .tbm-act", { hasText: "зачёт на опыт" }).click(); await sleep(1200);
  let t = await tbText(page);
  // v31: сначала правила, попытка — с первого ответа
  ok(tag + ": правила перед зачётом — 7 заданий, нужно 6, попытка с первого ответа", /Нужно 6 из 7/.test(t) && /начнётся с первого ответа/.test(t) && (await page.locator(".tb .tb-intro").count()) === 1, t.slice(0, 200));
  await page.locator(".tb .tb-main", { hasText: "Начать зачёт" }).click(); await sleep(700);
  t = await tbText(page);
  ok(tag + ": стол «Зачёт на опыт», без подсказок, 7 заданий", /Зачёт на опыт/i.test(t) && /без подсказок/i.test(t) && /Задание 1 из 7/i.test(t) && (await page.locator('.tb [aria-label="Подсмотреть в уроке"]').count()) === 0, t.slice(0, 200));
  await shot(page, "c1-credit");
  await playAll(page, true);
  t = await text(page);
  ok(tag + ": «Зачёт сдан», засчитано «по опыту»", /Зачёт сдан/.test(t) && /по опыту/.test(t), t.slice(0, 300));
  await shot(page, "c2-receipt");
  const comp = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_completed" + uk) || "{}"), uk);
  const qd = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_quiz_done" + uk) || "{}"), uk);
  ok(tag + ": все шаги темы отмечены (уроки, практика, тест)", S1.lessons.filter(l => l.type !== "result").every(l => l.type === "quiz" ? qd[l.id] : comp[l.id]));
  ok(tag + ": на сервер — save_progress и save_quiz_done, балл теста — нет", calls.some(x => x.fn === "save_progress" && x.body.p_lesson_id === "s1-1") && calls.some(x => x.fn === "save_quiz_done" && x.body.p_quiz_id === "s1-q") && !calls.some(x => x.fn === "save_score" && x.body.p_quiz_id === "s1-q"));
  const cr = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_credit" + uk) || "{}"), uk);
  ok(tag + ": отметка «по опыту» сохранена", cr.s1 && cr.s1.t === 7 && cr.s1.s >= 6, JSON.stringify(cr));
  await page.locator(".tb .tb-foot .tb-main").click(); await sleep(800);
  t = await text(page);
  ok(tag + ": в меню темы — «зачтено по опыту»", /зачтено по опыту/i.test(t));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
  // провал: неверные ответы → «Не в этот раз», зачёт — завтра
  const r2 = await open({ storage, rpcs: (fn) => (fn === "my_state" ? st : undefined) });
  await r2.page.evaluate(() => window.__saNav("home")); await sleep(1400);
  await r2.page.locator(".tbp-strip .tbp-num").nth(1).click(); await sleep(900);
  await r2.page.locator(".tbp-cur .tbm-act", { hasText: "зачёт на опыт" }).click(); await sleep(1200);
  await r2.page.locator(".tb .tb-main", { hasText: "Начать зачёт" }).click(); await sleep(700);
  await playAll(r2.page, false);
  t = await text(r2.page);
  ok(tag + ": провал — «Не в этот раз», нужно 6 из 7", /Не в этот раз/.test(t) && /Нужно 6 из 7/.test(t), t.slice(0, 260));
  const bank = await r2.page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]"), uk);
  ok(tag + ": ошибки зачёта — в «Работу над ошибками»", bank.length >= 5, String(bank.length));
  await r2.page.locator(".tb .tb-foot .tb-main").click(); await sleep(800);
  ok(tag + ": повторная попытка — завтра", (await r2.page.locator(".tbp-cur .tbm-act[disabled]", { hasText: "завтра" }).count()) === 1);
  ok(tag + ": без ошибок (провал)", r2.errors.length === 0, r2.errors.slice(0, 3).join(" | "));
  await r2.ctx.close();
}

// ── G. Золотая тема (Доп. 316) ──
if (want("G")) {
  const tag = "G";
  const { c, q } = doneMap(S0);
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q };
  const st = { ok: true, v: 2, quiz: Object.keys(q), lessons: Object.keys(c), stars: {}, roles: [], last_role: "seasonal" };
  const { ctx, page, errors } = await open({ storage, rpcs: (fn) => (fn === "my_state" ? st : undefined) });
  await page.evaluate(() => window.__saNav("home")); await sleep(1400);
  await page.locator(".tbp-strip .tbp-num").first().click(); await sleep(900);
  ok(tag + ": в пройденной теме — «Раунд мастера ✦»", (await page.locator(".tbp-cur .tbm-act.gold", { hasText: "Раунд мастера" }).count()) === 1);
  await page.locator(".tbp-cur .tbm-act.gold").click(); await sleep(1200);
  let t = await tbText(page);
  ok(tag + ": правила раунда — запасная свеча, тиканье", /запасная свеча/.test(t) && /последние 5 тикают/.test(t), t.slice(0, 200));
  await page.locator(".tb .tb-main", { hasText: "Начать раунд" }).click(); await sleep(700);
  t = await tbText(page);
  ok(tag + ": стол «Раунд мастера», на время, 8 заданий, таймер", /Раунд мастера/i.test(t) && /на время/i.test(t) && /Задание 1 из 8/i.test(t) && (await page.locator(".tb .tb-timer").count()) === 1, t.slice(0, 200));
  await shot(page, "g1-gold");
  await playAll(page, true);
  t = await text(page);
  ok(tag + ": «Золотая тема», печать «ЗОЛОТО» на чеке", /Золотая тема/.test(t) && (await page.locator(".tb .r-goldseal").count()) === 1, t.slice(0, 200));
  await shot(page, "g2-receipt");
  const gd = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_gold" + uk) || "{}"), uk);
  ok(tag + ": золото сохранено (ошибок 0)", gd.s0 && gd.s0.w === 0, JSON.stringify(gd));
  await page.locator(".tb .tb-foot .tb-main").click(); await sleep(800);
  const cls = await page.evaluate(() => (document.querySelector(".tbp-strip .tbp-num") || {}).className || "");
  ok(tag + ": номер темы — золотой", /gold/.test(cls), cls);
  ok(tag + ": в меню — «золотая тема» и «Золото ✦ · ещё раз»", /золотая тема/i.test(await text(page)) && (await page.locator(".tbp-cur .tbm-act.gold.got").count()) === 1);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── L. Живой гость (Доп. 312) ──
if (want("L")) {
  const tag = "L";
  const { c, q } = doneMap(S0);
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_menu_custom": { "Два моря, Океан": [{ id: "d1", name: "Борщ с говядиной", allergens: ["сельдерей"] }, { id: "d2", name: "Салат с орехами", allergens: ["орехи"], stop: { since: Date.now() } }] } };
  const chat = [];
  const { ctx, page, errors } = await open({ storage, chat });
  await page.evaluate(() => window.__saNav("shift")); await sleep(1100);
  await page.locator('.sa-card[aria-label="Живой гость"]').first().click(); await sleep(1500);
  let t = await tbText(page);
  ok(tag + ": карточка гостя — стол, имя, теги", /СТОЛ \d+|БАРНАЯ|ВХОД/i.test(t) && (await page.locator(".tb .lg-card h2").count()) === 1 && (await page.locator(".tb .lg-tags span").count()) >= 1, t.slice(0, 200));
  await shot(page, "l1-card");
  await page.locator(".tb .tb-main").click(); await sleep(700);
  ok(tag + ": гость начинает разговор", (await page.locator(".tb .lg-g").count()) === 1);
  await page.locator(".tb .lg-in").fill("Добрый вечер! Меня зовут Анна. Подскажу, что у нас быстрое.");
  await page.locator(".tb .lg-send").click(); await sleep(1300);
  ok(tag + ": гость ответил, метки скрыты", (await page.locator(".tb .lg-g").count()) === 2 && !/\[\[/.test(await tbText(page)));
  const sent = chat[chat.length - 1] || {};
  ok(tag + ": в запросе — режим гостя, меню и стоп-лист", sent.mode === "guest" && sent.guest && Array.isArray(sent.guest.menu) && sent.guest.menu.some((x) => /Борщ/.test(x)) && (sent.guest.stop || []).includes("Салат с орехами") && sent.messages[0].role === "user", JSON.stringify(sent.guest || {}).slice(0, 200));
  await page.locator(".tb .lg-in").fill("Рекомендую борщ — подадим за 10 минут. Чай чёрный или зелёный?");
  await page.locator(".tb .lg-send").click(); await sleep(1300);
  await page.locator(".tb .lg-in").fill("Счёт сейчас принесу. Спасибо, что пришли!");
  await page.locator(".tb .lg-send").click(); await sleep(1300);
  t = await tbText(page);
  ok(tag + ": гость ушёл — «Получить чек разбора»", /разговор окончен/i.test(t) && /Получить чек разбора/i.test(t), t.slice(-200));
  await shot(page, "l2-talk");
  await page.locator(".tb .tb-main", { hasText: "Получить чек разбора" }).click(); await sleep(1500);
  t = await tbText(page);
  ok(tag + ": чек разбора — 5 оценок, итог, получилось/поправить/фраза", /Чек разбора/i.test(t) && /ИТОГ\s*4 \/ 5/i.test(t) && /ПОЛУЧИЛОСЬ/i.test(t) && /ПОПРАВИТЬ/i.test(t) && /МОЖНО БЫЛО СКАЗАТЬ/i.test(t) && (await page.locator(".tb .lg-crit li").count()) === 5, t.slice(0, 300));
  ok(tag + ": урок для повтора — только из карты (лишний отброшен)", (await page.locator(".tb .lg-les button").count()) === 1);
  await shot(page, "l3-receipt");
  const bank = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]"), uk);
  ok(tag + ": вопрос по уроку — в «Работу над ошибками»", bank.some((m) => m.from === "guest" && m.lessonId === "s0-q"), JSON.stringify(bank.map((m) => m.lessonId)));
  const act = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_activity" + uk) || "{}"), uk);
  ok(tag + ": шаг «живой гость» в журнале дня", Object.values(act).some((r) => r.g === 1));
  const runs = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_guest_runs" + uk) || "[]"), uk);
  ok(tag + ": разговор сохранён (для отчёта и итогов)", runs.length === 1 && runs[0].s === 4 && runs[0].ai === true);
  await page.locator(".tb .lg-les button").first().click(); await sleep(1300);
  ok(tag + ": «Повторить» открывает урок", (await page.locator(".tb").count()) === 0 && (await page.locator("[data-sa-contents]").count()) === 1);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
  // ИИ не подключён — гость по сценарию
  const r2 = await open({ storage, ai: "off" });
  await r2.page.evaluate(() => window.__saNav("shift")); await sleep(1100);
  await r2.page.locator('.sa-card[aria-label="Живой гость"]').first().click(); await sleep(1400);
  await r2.page.locator(".tb .tb-main").click(); await sleep(500);
  await r2.page.locator(".tb .lg-in").fill("Здравствуйте!");
  await r2.page.locator(".tb .lg-send").click(); await sleep(1000);
  t = await tbText(r2.page);
  ok(tag + ": без ИИ — понятное сообщение и «Гость по сценарию»", /сыграем по сценарию/i.test(t) && (await r2.page.locator(".tb .tb-ghost", { hasText: "Гость по сценарию" }).count()) === 1, t.slice(-200));
  await r2.page.locator(".tb .tb-ghost", { hasText: "Гость по сценарию" }).click(); await sleep(1200);
  t = await tbText(r2.page);
  ok(tag + ": сценарий — стол «Живой гость» с ситуациями", /Живой гость/i.test(t) && /Ситуация 1 из 4/i.test(t), t.slice(0, 200));
  await playAll(r2.page, true);
  t = await tbText(r2.page);
  ok(tag + ": по сценарию — «Гость рассчитался»", /Гость рассчитался/i.test(t), t.slice(0, 200));
  await shot(r2.page, "l4-script");
  const runs2 = await r2.page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_guest_runs" + uk) || "[]"), uk);
  ok(tag + ": сценарий тоже засчитан (ai: false)", runs2.length === 1 && runs2[0].ai === false);
  ok(tag + ": без ошибок (сценарий)", r2.errors.length === 0, r2.errors.slice(0, 3).join(" | "));
  await r2.ctx.close();
}

// ── Q. Квест смены (Доп. 314) ──
if (want("Q")) {
  const tag = "Q";
  const { c, q } = doneMap(S0);
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_sched_cache_main_{mkey}": SCHED_CACHE,
    "sa_mistakes{uk}": (() => { const qq = S0.lessons.find((l) => l.type === "quiz").questions[0]; return [{ q: qq.q, options: qq.options, correct: qq.correct, explanation: qq.explanation || "", due: Date.now() - 1000, lessonId: "s0-q", lessonTitle: "Тест", stage: 0 }]; })(),
    "sa_fresh{uk}": { s0: { t: Date.now() - 20 * DAY, n: 0 } } };
  let complete = false;
  const people = () => [
    { id: "u-staff", name: "Анна", initial: "С", position: "waiter", me: true, steps: complete ? 3 : 1, warm: complete ? 1 : 0, guest: complete ? 1 : 0, synced: true },
    { id: "x2", name: "Илья", initial: "Б", position: "bartender", me: false, steps: 2, warm: 1, guest: 0, synced: true },
    { id: "x3", name: "Мария", initial: "К", position: "senior", me: false, steps: complete ? 1 : 0, warm: complete ? 1 : 0, guest: 0, synced: false },
  ];
  const rpcs = (fn) => fn === "quest_today" ? { ok: true, date: today, restaurant: "Два моря, Океан", known: true, me_on: true, people: people(),
    goal: { warm: 3, steps: 6, guest: 1 }, done: complete ? { warm: 3, steps: 6, guest: 1 } : { warm: 1, steps: 3, guest: 0 }, complete } : undefined;
  const { ctx, page, errors } = await open({ storage, rpcs });
  await page.evaluate(() => window.__saNav("shift")); await sleep(1500);
  let t = await text(page);
  ok(tag + ": карточка квеста — цель смены и прогресс", /КВЕСТ СМЕНЫ/.test(t) && /Смена вместе/.test(t) && /3 разминки · 6 шагов · 1 живой гость/.test(t) && (await page.locator("[data-quest] .tg-bar").count()) === 3, (t.match(/КВЕСТ.{0,160}/) || [""])[0]);
  // v31: люди — свёрнутой строкой «3 человека в смене · ты 1 шаг», по касанию — с вкладом каждого
  ok(tag + ": люди смены — строкой, раскрываются по касанию", /3 человека в смене · ты 1 шаг/.test(t) && (await page.locator("[data-quest] .tg-p").count()) === 0, (t.match(/\d человек.{0,40}/) || [""])[0]);
  await page.locator("[data-quest] .tg-who").first().click(); await sleep(400);
  ok(tag + ": люди смены с вкладом, я — «ты»", (await page.locator("[data-quest] .tg-p").count()) === 3 && /ты\s*1/.test(await text(page)));
  ok(tag + ": твоя часть — 3 задания (ошибки, выдохшаяся тема, разминка)", (await page.locator("[data-quest] .tg-task").count()) === 3 && /Повтори вопрос из «Работы над ошибками»/.test(t) && /Освежи тему «Психология первого дня»/.test(t) && /Разминка до смены/.test(t), t.slice(t.indexOf("ТВОЯ ЧАСТЬ"), t.indexOf("ТВОЯ ЧАСТЬ") + 200));
  await shot(page, "q1-quest");
  await page.locator("[data-quest] .tg-task", { hasText: "Освежи тему" }).click(); await sleep(1200);
  ok(tag + ": задание «Освежи тему» открывает стол освежения", /Освежить тему/i.test(await tbText(page)));
  await playAll(page, true);
  await page.locator(".tb .tb-foot .tb-main").click(); await sleep(700);
  await page.evaluate(() => window.__saNav("shift")); await sleep(900);
  ok(tag + ": задание засчитано само (по журналу дня)", (await page.locator("[data-quest] .tg-task.done", { hasText: "Освежи тему" }).count()) === 1);
  complete = true;
  await page.evaluate(() => window.__saNav("me")); await sleep(500);
  await page.evaluate(() => window.__saNav("shift")); await sleep(1500);
  t = await text(page);
  ok(tag + ": квест закрыт — «Смена отработана ✦» и печать", /Смена отработана ✦/.test(t) && /СМЕНА ОТРАБОТАНА/.test(t));
  await shot(page, "q2-complete");
  const qd = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_quest_done" + uk) || "[]"), uk);
  ok(tag + ": день записан в «закрытые квесты»", qd.includes(today), JSON.stringify(qd));
  await page.evaluate(() => window.__saNav("me")); await sleep(700);
  await page.locator('.sa-card[aria-label="Чек недели"]').first().click(); await sleep(1200);
  t = await tbText(page);
  ok(tag + ": в «Чеке недели» — «Квест смены закрыт» и штамп", /Квест смены закрыт/i.test(t) && /СМЕНА ОТРАБОТАНА/i.test(t), t.slice(0, 400));
  await shot(page, "q3-week");
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
  // без этапа 24 — только личные задания
  const r2 = await open({ storage, rpcs: (fn) => fn === "quest_today" ? { code: "PGRST202", message: "Could not find the function" } : undefined });
  await r2.page.evaluate(() => window.__saNav("shift")); await sleep(1400);
  t = await text(r2.page);
  ok(tag + ": без этапа 24 — личные задания без ошибок", (await r2.page.locator("[data-quest] .tg-task").count()) === 3 && !/Смена вместе/.test(t));
  ok(tag + ": без ошибок (нет этапа)", r2.errors.length === 0, r2.errors.slice(0, 3).join(" | "));
  await r2.ctx.close();
  // ревью v30: в выходной смену видно, но закрытый квест себе не засчитывается
  const r3 = await open({ storage, rpcs: (fn) => fn === "quest_today" ? { ok: true, date: today, restaurant: "Два моря, Океан", known: true, me_on: false,
    people: people().filter((p) => !p.me), goal: { warm: 2, steps: 4, guest: 1 }, done: { warm: 2, steps: 4, guest: 1 }, complete: true } : undefined });
  await r3.page.evaluate(() => window.__saNav("shift")); await sleep(1600);
  t = await text(r3.page);
  const qd3 = await r3.page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_quest_done" + uk) || "[]"), uk);
  ok(tag + ": выходной — смена отработана, но себе не засчитано", /Смена отработана ✦/.test(t) && !qd3.includes(today), JSON.stringify(qd3));
  ok(tag + ": без ошибок (выходной)", r3.errors.length === 0, r3.errors.slice(0, 3).join(" | "));
  await r3.ctx.close();
}

// ── LG. Лига недели (Доп. 317) ──
if (want("LG")) {
  const tag = "LG";
  const L = { ok: true, week_start: today, today, restaurant: "Два моря, Океан", rows: [
    { id: "p1", name: "Пётр", surname: "Лис", restaurant: "Два моря, Причал", position: "waiter", pts: 120, days: 3, me: false },
    { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", pts: 85, days: 2, me: true },
    { id: "p2", name: "Иван", surname: "Петров", restaurant: "Два моря, Океан", position: "waiter", pts: 40, days: 1, me: false },
    { id: "p3", name: "Вера", surname: "Ким", restaurant: "Два моря, Причал", position: "bartender", pts: 30, days: 1, me: false },
  ], cup: [{ restaurant: "Два моря, Причал", people: 3, active: 2, pts: 150, avg: 50, mine: false }, { restaurant: "Два моря, Океан", people: 4, active: 2, pts: 125, avg: 31.3, mine: true }] };
  const storage = { "sa_activity{uk}": { [today]: { st: 2, l: 1, w: 1 } }, "sa_hint_v5_leaderboard_scope": "1" };
  const { ctx, page, errors } = await open({ storage, rpcs: (fn) => fn === "league_week" ? L : fn === "team_scores" ? { ok: true, rows: [] } : undefined });
  await page.evaluate(() => window.__saNav("teamHub")); await sleep(900);
  await page.locator('.sa-card[aria-label="Лига недели"]').first().click(); await sleep(1500);
  let t = await text(page);
  ok(tag + ": мои очки, неделя, «за что очки»", /Лига недели/.test(t) && /85 очков у тебя/.test(t) && /ДО ФИНАЛА|ФИНАЛ СЕГОДНЯ/.test(t), (t.match(/НЕДЕЛЯ.{0,140}/) || [""])[0]);
  const halves = await page.locator('[aria-label="Какой рейтинг показать"] button').allInnerTexts();
  ok(tag + ": место — 1 в заведении, 2 в сети", /^1\s*из 2/.test(halves[0] || "") && /^2\s*из 4/.test(halves[1] || ""), JSON.stringify(halves));
  ok(tag + ": кубок заведений — Причал первый, наш отмечен", /КУБОК ЗАВЕДЕНИЙ/.test(t) && /Два моря, Океан · ваше/.test(t) && /31,3/.test(t));
  await shot(page, "lg1-league");
  await page.locator('[aria-label="Какой рейтинг показать"] button', { hasText: "во всей сети" }).click(); await sleep(500);
  t = await text(page);
  ok(tag + ": вся сеть — с заведением у каждого", /Пётр Лис/.test(t) && /Два моря, Причал/.test(t));
  await page.getByText("За что очки ›").click(); await sleep(300);
  ok(tag + ": «за что очки» раскрывается", /живой гость\s*\+20/.test(await text(page)) && /Не больше 200 очков в день/.test(await text(page)));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── P. Свеча на двоих (Доп. 318) ──
if (want("P")) {
  const tag = "P";
  let state = "none";
  const calls = [];
  const days = [6, 5, 4, 3, 2, 1, 0].map((n) => { const d = new Date(); d.setDate(d.getDate() - n); return { d: ymdL(d), me: n === 0 ? 0 : 2, partner: n === 4 ? 1 : 2 }; });
  const rpcs = (fn, body) => {
    if (fn === "pair_status" && state === "ghost") return { ok: true, today, pair: { id: 7, since: days[0].d, inviter: true, partner: null, partner_today: { steps: 0, warm: 0, state: 0 }, me_today: { steps: 0, state: 0 }, streak: 5, days }, invites: [], outgoing: null };
    if (fn === "pair_status") return state === "active"
      ? { ok: true, today, pair: { id: 7, since: days[0].d, inviter: true, partner: { id: "x2", name: "Аня", surname: "Ким", position: "waiter" }, partner_today: { steps: 2, warm: 1, state: 2 }, me_today: { steps: 0, state: 0 }, streak: 5, days }, invites: [], outgoing: null }
      : state === "invited" ? { ok: true, today, pair: null, invites: [], outgoing: { id: 7, to: { id: "x2", name: "Аня", surname: "Ким" } } }
      : { ok: true, today, pair: null, invites: [{ id: 3, from: { id: "x9", name: "Олег", surname: "Ру", position: "bartender" } }], outgoing: null };
    if (fn === "pair_candidates") return { ok: true, rows: [{ id: "x2", name: "Аня", surname: "Ким", position: "waiter", lead: false, busy: false }, { id: "x3", name: "Мария", surname: "Ли", position: "senior", lead: true, busy: true }] };
    if (fn === "pair_invite") { state = "invited"; return { ok: true, id: 7, status: "invited" }; }
    if (fn === "pair_answer") return { ok: true, status: "declined" };
    return undefined;
  };
  const { ctx, page, errors } = await open({ rpcs, calls, storage: { "sa_sched_cache_main_{mkey}": SCHED_CACHE, "sa_completed{uk}": { "s0-1": true, "s0-2": true } } });
  await page.evaluate(() => window.__saNav("me")); await sleep(1200);
  let t = await text(page);
  ok(tag + ": в «Я» — «Свеча на двоих», приглашение со счётчиком", /Свеча на двоих/.test(t) && /Тебя зовут в пару/.test(t));
  await page.locator('.sa-card[aria-label="Свеча на двоих"]').first().click(); await sleep(1300);
  t = await text(page);
  ok(tag + ": лист — приглашение Олега и коллеги", /Олег Р\. зовёт тебя/.test(t) && /Аня Ким/.test(t) && /уже в паре/.test(t), (t.match(/СВЕЧА НА ДВОИХ.{0,300}/) || [""])[0]);
  await shot(page, "p1-sheet");
  await page.locator(".tg-row", { hasText: "Аня Ким" }).locator("button").click(); await sleep(900);
  t = await text(page);
  ok(tag + ": позвал — «ждём ответа»", /Приглашение отправлено/.test(t) && /Ты позвал\(а\) Аня К\. — ждём ответа/.test(t), (t.match(/Ты позвал.{0,60}/) || [""])[0]);
  ok(tag + ": на сервер ушло приглашение Ане", calls.some((x) => x.fn === "pair_invite" && x.body.p_emp === "x2"));
  await page.locator(".tg-sheet .tg-ghost", { hasText: "Закрыть" }).click(); await sleep(500);
  state = "active";
  await page.evaluate(() => window.__saNav("shift")); await sleep(300);
  await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1400);
  // статус перечитывается не чаще раза в минуту — поторопим
  await page.evaluate(() => window.__saNav("me")); await sleep(300);
  await page.evaluate(() => window.__saNav("roleSelect")); await sleep(500);
  await page.locator(".sa-card", { hasText: "Свеча на двоих" }).count();
  await page.evaluate(() => window.__saNav("me")); await sleep(600);
  await page.locator('.sa-card[aria-label="Свеча на двоих"]').first().click(); await sleep(1300);
  t = await text(page);
  // v31: «Ты и Аня · 5 дней вместе», крупные свечи, неделя строками «ты» и «Аня»
  ok(tag + ": пара — серия 5 дней, две свечи, неделя", /Ты и Аня · 5 дней вместе/.test(t) && (await page.locator(".tg-two .candle").count()) === 2 && (await page.locator(".tg-week .dc").count()) === 14, (t.match(/Ты и.{0,80}/) || [""])[0]);
  ok(tag + ": подсказка — «Аня уже размялась — твоя очередь»", /Аня уже размялась — твоя очередь/.test(t));
  await shot(page, "p2-pair");
  await page.locator(".tg-sheet .tg-ghost", { hasText: "Закрыть" }).click(); await sleep(600);
  await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1000);
  t = await text(page);
  ok(tag + ": на главной — строка «Аня уже размялась — твоя очередь»", /Аня уже размялась — твоя очередь/.test(t));
  await shot(page, "p3-home");
  // ревью v30: строку напарника удалили из команды (старый ответ сервера без partner) — экран не падает
  state = "ghost";
  await page.evaluate(() => window.__saNav("me")); await sleep(700);
  await page.locator('.sa-card[aria-label="Свеча на двоих"]').first().click(); await sleep(1300);
  t = await text(page);
  ok(tag + ": напарника нет в команде — лист открылся без падения", /Ты и напарник · 5 дней вместе/.test(t) && /С напарником · 5 дней вместе/.test(t), (t.match(/Ты и.{0,40}/) || [""])[0] + " | " + (t.match(/С напар.{0,30}/) || [""])[0]);
  await page.locator(".tg-sheet .tg-ghost", { hasText: "Закрыть" }).click(); await sleep(400);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── RD. Радио в дорогу (Доп. 319) ──
if (want("RD")) {
  const tag = "RD";
  const { c, q } = doneMap(S0);
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_fresh{uk}": { s0: { t: Date.now() - 20 * DAY, n: 0 } } };
  const { ctx, page, errors } = await open({ storage });
  await page.evaluate(() => window.__saNav("shift")); await sleep(1000);
  await page.locator('.sa-card[aria-label="Радио в дорогу"]').first().click(); await sleep(1500);
  let t = await tbText(page);
  ok(tag + ": плейлист — следующий урок, освежить, повтор", (await page.locator(".tb .rd-tab").count()) === 3 && /Дальше по треку/.test(t) && /Освежить/.test(t), t.slice(0, 200));
  ok(tag + ": выпуск начинается с ведущего", /Радио в дорогу\. Следующий урок твоего трека/.test(t));
  await shot(page, "rd1-air");
  await page.locator(".tb .rd-ctl .play").click(); await sleep(2500);
  const spoken = await page.evaluate(() => (window.__spoken || []).length);
  ok(tag + ": читает по фразам", spoken >= 3, String(spoken));
  await page.locator(".tb .tb-main", { hasText: "К вопросам" }).click(); await sleep(600);
  ok(tag + ": два вопроса на закрепление", (await page.locator(".tb .rd-q").count()) === 2);
  for (let k = 0; k < 2; k++) {
    const qtext = (await page.locator(".tb .rd-q h3").nth(k).innerText()).replace(/^\d+\.\s*/, "").trim();
    const qq = ALL_Q.find((x) => x.q.trim() === qtext);
    const right = qq ? qq.options[qq.correct] : null;
    const btns = page.locator(".tb .rd-q").nth(k).locator("button");
    const n = await btns.count();
    for (let i = 0; i < n; i++) { const bt = (await btns.nth(i).innerText()).trim(); if (k === 0 ? bt === right : bt !== right) { await btns.nth(i).click(); break; } }
    await sleep(400);
  }
  await sleep(900);
  t = await tbText(page);
  ok(tag + ": выпуск дослушан — 1 из 2, ошибка в повтор", /Выпуск дослушан/.test(t) && /Верно 1 из 2/.test(t), t.slice(0, 300));
  const act = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_activity" + uk) || "{}"), uk);
  ok(tag + ": шаг «радио» в журнале дня", Object.values(act).some((r) => r.r === 1));
  const bank = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_mistakes" + uk) || "[]"), uk);
  ok(tag + ": ошибка — в «Работе над ошибками»", bank.some((m) => m.from === "radio"));
  await shot(page, "rd2-done");
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── M. Итоги месяца (Доп. 320) ──
if (want("M")) {
  const tag = "M";
  const act = {}; for (let n = 0; n < 9; n++) { const d = new Date(); d.setDate(d.getDate() - n); if (d.getMonth() === new Date().getMonth()) act[ymdL(d)] = { st: 2 + (n % 3), l: 1, w: n % 2, g: n === 2 ? 1 : 0 }; }
  const storage = { "sa_activity{uk}": act, "sa_guest_runs{uk}": [{ d: today, s: 5, p: "rush", ai: true }], "sa_gold{uk}": { s0: { d: today, w: 0, sec: 40 } }, "sa_quest_done{uk}": [today] };
  const { ctx, page, errors } = await open({ storage });
  await page.evaluate(() => window.__saNav("me")); await sleep(1000);
  let t = await text(page);
  ok(tag + ": в «Я» — «Итоги месяца» с днями в деле", /Итоги месяца/.test(t) && /дн(ей|я|ь) в деле/.test(t));
  await page.locator('.sa-card[aria-label="Итоги месяца"]').first().click(); await sleep(900);
  t = await page.evaluate(() => (document.querySelector(".mr") || {}).innerText || "");
  ok(tag + ": обложка месяца", /в академии/.test(t) && /Анна Смирнова/.test(t), t.slice(0, 160));
  await shot(page, "m1-cover");
  const seen = [];
  for (let k = 0; k < 9; k++) {
    const tt = await page.evaluate(() => (document.querySelector(".mr-body") || {}).innerText || "");
    seen.push(tt.replace(/\s+/g, " ").slice(0, 40));
    if (await page.locator(".mr-btn").count()) break;
    await page.locator('.mr-nav button[aria-label="Дальше"]').click(); await sleep(450);
    if (k === 1) await shot(page, "m2-days");
  }
  const all = seen.join(" | ");
  ok(tag + ": карточки — дни, шаги, лучшее, живой гость, темы, квест", /ДНИ В ДЕЛЕ/i.test(all) && /ШАГИ/i.test(all) && /ЖИВОЙ ГОСТЬ/i.test(all) && /ТЕМЫ/i.test(all) && /КВЕСТ СМЕНЫ/i.test(all), all);
  // v31: картинкой (главная) и текстом (как раньше)
  ok(tag + ": в конце — «Поделиться картинкой» и «Поделиться текстом»", (await page.locator(".mr-btn", { hasText: "Поделиться картинкой" }).count()) === 1 && (await page.locator(".mr-ghost", { hasText: "Поделиться текстом" }).count()) === 1);
  await shot(page, "m3-end");
  await page.locator(".mr-ghost", { hasText: "Закрыть" }).click(); await sleep(400);
  ok(tag + ": закрылось", (await page.locator(".mr").count()) === 0);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── RV. Находки ревью v30: свежесть только где есть чем освежать, «обновлено» по отпечатку,
// радио без вопросов засчитывается ──
if (want("RV")) {
  const tag = "RV";
  const { sectionKey } = await import(SRC + "/lib/custom-modules.js");
  const long = (t) => t + " " + "Гость замечает каждую мелочь: как ты подошёл, как держишь паузу, как называешь блюда и как прощаешься. ".repeat(4);
  const CMS = [
    { id: 901, role: "seasonal", module: "Наш зал", title: "Как устроен зал", content: long("Зал делится на три зоны."), questions: [], sort: 1 },
    { id: 902, role: "seasonal", module: "Наши вина", title: "Вина дома", content: long("Подаём белое при 8–10°."), sort: 1, questions: [
      { kind: "situation", genre: "action", scene: "Гость просит белое вино", question: "Какая температура подачи?", options: ["8–10°", "18–20°"], correct: 0, win: "Верно", fail: "Холоднее" },
      { kind: "situation", genre: "action", scene: "Гость просит красное", question: "Какая температура подачи?", options: ["16–18°", "4–6°"], correct: 0, win: "Верно", fail: "Теплее" }] },
    { id: 903, role: "seasonal", module: "Наш бар", title: "Как мы встречаем у бара", content: long("У бара здороваемся первыми."), questions: [], sort: 1 },
  ];
  const kZal = sectionKey("seasonal", "Наш зал"), kVina = sectionKey("seasonal", "Наши вина"), kBar = sectionKey("seasonal", "Наш бар");
  ALL_SITS.push(...CMS[1].questions.map(({ kind, ...x }) => x));   // чтобы помощник знал верные ответы своих ситуаций
  const { c, q } = doneMap(...SEASONAL_MODULES);
  Object.assign(c, { "cms-l-901": true, "cms-l-902": true, "cms-p-902": true });
  const storage = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_fresh{uk}": { [kVina]: { t: Date.now() - 3600e3, n: 1, h: "rOld" } } };
  const { ctx, page, errors } = await open({ storage, rpcs: (fn) => fn === "cms_list_lessons" ? CMS : undefined });
  await sleep(800);
  let fr = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_fresh" + uk) || "{}"), uk);
  ok(tag + ": тема из одних уроков — без свежести; темы с заданиями — со свежестью", !(kZal in fr) && !(kBar in fr) && ("s0" in fr) && fr[kVina] && fr[kVina].h === "rOld", JSON.stringify(Object.keys(fr)));
  await page.evaluate(() => window.__saNav("shift")); await sleep(1500);
  let t = await text(page);
  ok(tag + ": свой раздел изменили — в квесте «Освежи тему «Наши вина»»", /Освежи тему «Наши вина»/.test(t), (t.match(/ТВОЯ ЧАСТЬ.{0,200}/) || [""])[0]);
  await page.locator("[data-quest] .tg-task", { hasText: "Освежи тему" }).click(); await sleep(1200);
  ok(tag + ": открылся стол освежения по разделу", /Освежить тему/i.test(await tbText(page)));
  await playAll(page, true);
  await page.locator(".tb .tb-foot .tb-main").click(); await sleep(700);
  fr = await page.evaluate((uk) => JSON.parse(localStorage.getItem("sa_fresh" + uk) || "{}"), uk);
  ok(tag + ": освежил — запомнен новый отпечаток, срок вырос", fr[kVina] && fr[kVina].h && fr[kVina].h !== "rOld" && fr[kVina].n === 2, JSON.stringify(fr[kVina]));
  await page.evaluate(() => window.__saNav("shift")); await sleep(1000);
  await page.locator('.sa-card[aria-label="Радио в дорогу"]').first().click(); await sleep(1500);
  t = await tbText(page);
  ok(tag + ": радио — следующий урок из своего раздела без вопросов", /Как мы встречаем у бара/.test(t) && /Выпуск дослушан/.test(t) && !/К вопросам/.test(t), t.slice(0, 220));
  await page.locator(".tb .rd-ctl .play").click(); await sleep(4000);
  t = await tbText(page);
  const rd = await page.evaluate((uk) => ({ done: JSON.parse(localStorage.getItem("sa_radio_done" + uk) || "{}"), act: JSON.parse(localStorage.getItem("sa_activity" + uk) || "{}") }), uk);
  ok(tag + ": выпуск без вопросов дослушан — засчитан, шаг «радио» в журнале", /Выпуск дослушан ✦/.test(t) && rd.done["cms-l-903"] === today && ((rd.act[today] || {}).r || 0) === 1, JSON.stringify(rd.done) + " " + JSON.stringify(rd.act[today]));
  await shot(page, "rv1-radio");
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── K. Контраст новых экранов в обеих темах (WCAG AA) ──
if (want("K")) {
  const tag = "K";
  const auditSrc = (() => { const t = readFileSync("/home/claude/preview/contrast-audit.mjs", "utf8"); const a = t.indexOf("const AUDIT = () => {"); const b = t.indexOf("\n};\n", a); return t.slice(a + "const AUDIT = ".length, b + 2); })();
  const audit = async (page, label, sel = null) => {
    const bad = await page.evaluate(`(${auditSrc})()`);
    return bad.map((b) => label + ": " + b.color + " на " + b.bg + " " + b.ratio + "/" + b.need + " «" + b.text + "»");
  };
  const { c, q } = doneMap(S0);
  const days = [6, 5, 4, 3, 2, 1, 0].map((n) => { const d = new Date(); d.setDate(d.getDate() - n); return { d: ymdL(d), me: n === 0 ? 0 : 2, partner: n === 4 ? 1 : 2 }; });
  const rpcs = (fn) => fn === "quest_today" ? { ok: true, date: today, known: true, me_on: true, people: [{ id: "u-staff", name: "Анна", initial: "С", me: true, steps: 1, warm: 0, guest: 0, synced: true }, { id: "x", name: "Илья", initial: "Б", steps: 2, warm: 1, guest: 1, synced: false }], goal: { warm: 2, steps: 4, guest: 1 }, done: { warm: 1, steps: 3, guest: 1 }, complete: false }
    : fn === "league_week" ? { ok: true, week_start: today, today, rows: [{ id: "u-staff", name: "Анна", surname: "С", restaurant: "Два моря, Океан", position: "waiter", pts: 40, days: 2, me: true }, { id: "p", name: "Пётр", surname: "Л", restaurant: "Два моря, Причал", position: "waiter", pts: 30, days: 1 }], cup: [{ restaurant: "Два моря, Океан", people: 3, active: 1, pts: 40, avg: 13.3, mine: true }, { restaurant: "Два моря, Причал", people: 2, active: 1, pts: 30, avg: 15 }] }
    : fn === "pair_status" ? { ok: true, today, pair: { id: 1, since: days[0].d, partner: { id: "x2", name: "Аня", surname: "Ким" }, partner_today: { steps: 1, warm: 1, state: 2 }, me_today: { steps: 0, state: 0 }, streak: 4, days }, invites: [], outgoing: null }
    : fn === "my_state" ? { ok: true, v: 2, quiz: Object.keys(q), lessons: Object.keys(c), stars: {}, roles: [], last_role: "seasonal" } : undefined;
  const all = [];
  for (const light of [false, true]) {
    const th = light ? "light" : "dark";
    const { ctx, page, errors } = await open({ light, rpcs, storage: { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_fresh{uk}": { s0: { t: Date.now() - 20 * DAY, n: 0 } }, "sa_gold{uk}": {}, "sa_hint_v5_league": "1", "sa_hint_v5_leaderboard_scope": "1" } });
    await page.evaluate(() => window.__saNav("home")); await sleep(1300);
    await page.locator(".tbp-strip .tbp-num").first().click(); await sleep(700);
    all.push(...await audit(page, th + " трек/меню темы"));
    await page.evaluate(() => window.__saNav("shift")); await sleep(1400);
    all.push(...await audit(page, th + " квест"));
    await page.evaluate(() => window.__saNav("league")); await sleep(1300);
    all.push(...await audit(page, th + " лига"));
    await page.evaluate(() => window.__saNav("me")); await sleep(900);
    await page.locator('.sa-card[aria-label="Свеча на двоих"]').first().click(); await sleep(1200);
    all.push(...await audit(page, th + " свеча на двоих"));
    await page.locator(".tg-sheet .tg-ghost", { hasText: "Закрыть" }).click(); await sleep(400);
    await page.evaluate(() => window.__saNav("shift")); await sleep(800);
    await page.locator('.sa-card[aria-label="Живой гость"]').first().click(); await sleep(1300);
    all.push(...await audit(page, th + " живой гость: карточка"));
    await page.locator(".tb .tb-main").click(); await sleep(500);
    await page.locator(".tb .lg-in").fill("Добрый вечер!"); await page.locator(".tb .lg-send").click(); await sleep(1200);
    all.push(...await audit(page, th + " живой гость: разговор"));
    await page.locator(".tb .lg-in").fill("Рекомендую борщ."); await page.locator(".tb .lg-send").click(); await sleep(1200);
    await page.locator(".tb .tb-ghost", { hasText: "Рассчитать гостя" }).click(); await sleep(1500);
    all.push(...await audit(page, th + " живой гость: чек"));
    await page.locator(".tb .tb-ghost", { hasText: "Готово" }).click(); await sleep(400);
    await page.locator('.sa-card[aria-label="Радио в дорогу"]').first().click(); await sleep(1300);
    all.push(...await audit(page, th + " радио"));
    ok(tag + "-" + th + ": без ошибок страницы", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
  // «ЧИТАТЬ ›» в плашке «Книга отзывов» — светлый текст на золотой градиентной кнопке (прежний элемент):
  // проверка измеряет фон без градиента, это ложное срабатывание
  const uniq = [...new Set(all)].filter((x) => !/«ЧИТАТЬ ›»/.test(x));
  ok(tag + ": контраст новых экранов по норме", uniq.length === 0, uniq.slice(0, 12).join(" || "));
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter(r => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
process.exit(bad ? 1 : 0);
