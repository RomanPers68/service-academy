// e2e v55 (Доп. 368): быстро и твёрдо. Голова — из e2e-v54.
// START — профиль на телефоне: главная до ответа whoami; сессия отозвана → вход; поменялся ресторан → на лету;
// поменяли имя → один перезапуск; профиля нет → ждём сервер; нет сети → профиль телефона. SCROLL — короткие экраны
// не листаются, на экранах с кнопкой AI в самом низу ничего не под кнопкой; HEAD — заголовок без пустой полосы;
// MARGIN — без полей браузера; SKEL — силуэты вместо «Загрузка…»; LIGHT — тема «Для чтения»; WIDE — лёжа и компьютер;
// TG — Telegram; PRE — соединение с Supabase заранее.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v55.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5260, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v46";
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
async function open({ ua = null, scr = null, tgSafe = null, mobile = true, dsf = 2, storage = {}, telegram = false, light = false, w = 390, h = 844, url = "/", schedule = null, fixedTime = null, chat = [], rpcs = null, profile = prof, calls = [], ai = "guest", tts = null, ttsCalls = [], stream = false, assistant = null, motion = "no-preference", clockInstall = null }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", locale: "ru-RU", reducedMotion: motion, ...(ua ? { userAgent: ua } : {}), ...(scr ? { screen: scr } : {}) });
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
        my_state: { ok: true, v: 2, quiz: Object.keys(storage["sa_quiz_done{uk}"] || {}), lessons: Object.keys(storage["sa_completed{uk}"] || {}), stars: {}, roles: [], last_role: ("__role" in storage ? storage.__role : "seasonal") },
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
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(profile), sa_a11y: light ? "1" : "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_last_role: JSON.stringify("__role" in storage ? storage.__role : "seasonal"), sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0",
    // v32: квест смены по умолчанию свёрнут — здешние проверки писались для раскрытого
    sa_quest_open: "1" };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  const ukx = "_" + profile.name + "_" + (profile.surname || "");
  for (const [k, v] of Object.entries(storage)) seed[k.replace("{uk}", ukx).replace("{mkey}", MKEY)] = typeof v === "string" ? v : JSON.stringify(v);
  if (tgSafe) await ctx.addInitScript((s) => { window.__tgSafe = s; }, tgSafe);
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
        BackButton: { show() { window.__bb.visible = true; }, hide() { window.__bb.visible = false; }, onClick(h) { handlers.add(h); }, offClick(h) { handlers.delete(h); } },
        safeAreaInset: window.__tgSafe || { top: 0, bottom: 0, left: 0, right: 0 }, onEvent() {}, offEvent() {} } };
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
  if (clockInstall) await page.clock.install({ time: clockInstall });
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
const S3 = SEASONAL_MODULES.find(m => m.id === "s3");
const ymdD = (d) => ymdL(d);

// ════════════════════════════ v40: «Путь мастера» в приложении ════════════════════════════
const TODAY = today;
const DAYS_AGO = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymdL(d); };
const lsGet = (page, k) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return localStorage.getItem(k); } }, k);
const NOT_FIRST = { tiers: {}, fw: false, master: {} };
const stepRec = (o) => ({ day: TODAY, base: 0, at: Date.now() - 60000, payload: null, ...o });
const STEP_RADIO = stepRec({ id: "try:radio", kind: "try", fam: "radio", text: "Попробуй: Радио в дорогу", sub: "Включи «Радио в дорогу» по пути на смену — три коротких выпуска из твоих уроков.", go: "radio" });
const closeTb = async (page) => {
  const x = page.locator('.tb [aria-label="Закрыть"], .tb button[data-sa-back]');
  if (await x.count()) { await x.first().click().catch(() => {}); await sleep(600); }
  const leave = page.locator(".tb button", { hasText: /^Выйти$/ });
  if (await leave.count()) { await leave.first().click().catch(() => {}); await sleep(600); }
};
const hubBadge = (page, label) => page.evaluate((label) => {
  const card = document.querySelector('.sa-card[aria-label="' + label + '"]');
  if (!card) return null;
  const spans = [...card.querySelectorAll(":scope > span")];
  const last = spans[spans.length - 1];
  return last ? last.textContent.trim() : "";
}, label);
const ALL_DONE = doneMap(...SEASONAL_MODULES);

// ════════════════════════════ v41: главная снова минималистичная ════════════════════════════
// Отзыв: «новая функция немного рушит изначальный минимализм». «Шаг дня» — тонкая строка в карточке трека,
// «Путь мастера» — чип рядом со свечой и стаканом; карточки под треком больше нет.
const BASE41 = (since = 40) => { const { c, q } = doneMap(S0, S1); return { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_mastery{uk}": NOT_FIRST,
  "sa_fresh{uk}": { s0: { t: Date.now() - 40 * DAY, n: 0 }, s1: { t: Date.now() - DAY, n: 1 } }, "sa_life{uk}": { st: 12, l: 8, q: 2, w: 1, since: DAYS_AGO(since) } }; };
const STEP_FRESH = stepRec({ id: "fresh:s0", kind: "fresh", fam: "fresh", text: "Освежи тему «" + S0.title + "»", sub: "3 ситуации · 1 мин — тема снова свежая", go: "refresh", payload: { mod: "s0" } });
const homeGeo = (page) => page.evaluate(() => {
  const cta = [...document.querySelectorAll("div")].find((d) => /^(Дальше|Начать)$/.test((d.textContent || "").trim()) && d.children.length === 0);
  let card = cta; while (card && !(card.style && card.style.borderRadius === "18px")) card = card.parentElement;   // карточка трека
  const line = document.querySelector("[data-ms-line]"), chip = document.querySelector("[data-ms-chip]");
  const sched = [...document.querySelectorAll("*")].find((e) => e.childElementCount === 0 && /^Мой график$/.test((e.textContent || "").trim()));
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const chips = chip ? [...chip.parentElement.children].filter((e) => e.tagName === "SPAN").map((e) => Math.round(r(e).top)) : [];
  return { hasCard: !!document.querySelector("[data-ms-home]"), lineInCard: !!(card && line && card.contains(line)), chip: chip ? chip.textContent.trim() : null, chipAria: chip ? chip.getAttribute("aria-label") : null,
    chipNew: !!document.querySelector("[data-ms-chip-new]"), ring: chip && chip.querySelector("[data-ms-ring]") ? chip.querySelector("[data-ms-ring]").getAttribute("data-ms-ring") : null, chipsOneRow: chips.length >= 3 && Math.max(...chips) - Math.min(...chips) <= 2,
    gap: card && sched ? Math.round(r(sched).top - r(card).bottom) : null, cardH: card ? Math.round(r(card).height) : 0, schedY: sched ? Math.round(r(sched).top + scrollY) : 0,
    pills: [...document.querySelectorAll("div,span,button")].filter((e) => e.childElementCount === 0 && /^Сделать$/i.test((e.textContent || "").trim()) && parseFloat(getComputedStyle(e).paddingTop) >= 6).length,
    sw: document.documentElement.scrollWidth, iw: innerWidth };
});
const smallText = (page, sel, min = 13) => page.evaluate(([sel, min]) => {
  const root = document.querySelector(sel); if (!root) return "нет " + sel;
  const bad = [];
  [root, ...root.querySelectorAll("*")].forEach((el) => {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!own) return;
    const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize);
    const mono = /mono|Menlo|Consolas/i.test(cs.fontFamily);
    if (fs < (mono ? 11 : min) - 0.01) bad.push(el.textContent.trim().slice(0, 24) + ":" + fs);
  });
  return bad.length ? bad.slice(0, 5).join(", ") : "";
}, [sel, min]);


// ════════════════════════════ v44: главная компактнее ════════════════════════════
const RA = { ...prof, id: "u-own", name: "Роман", surname: "Смирнов", position: "manager", is_admin: true };
const OWNER = { id: "u-own2", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "senior", is_admin: true };
const STEP_QUEST = stepRec({ id: "try:quest", kind: "try", fam: "quest", text: "Попробуй: Квест смены", sub: "Закройте с командой общий квест смены.", go: "quest" });
const iso = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const SCORES = [["Ангелина", "Токарева", 8], ["Ангелина", "Токарева", 9], ["Ангелина", "Токарева", 7], ["Ангелина", "Токарева", 9],
  ["Иван", "Петров", 6], ["Иван", "Петров", 7], ["Иван", "Петров", 5], ["Анна", "Смирнова", 6], ["Анна", "Смирнова", 4]]
  .map(([name, surname, score], i) => ({ id: "s" + i, name, surname, restaurant: "Два моря, Океан", role: "seasonal", position: "waiter", quiz_id: "q" + i, score, total: 10, updated_at: iso(Math.max(0, new Date().getHours() - 1)) }));
const rpcs = (fn) => (fn === "team_scores" ? { ok: true, rows: SCORES } : undefined);
const ROMAN44 = (extra = {}) => { const b = BASE41(); b["sa_life{uk}"] = { ...b["sa_life{uk}"], w: 3, d: 1, g: 1, r: 3 };
  return { ...b, __role: "spg", "sa_streak{uk}": { count: 1, last: DAYS_AGO(1) }, "sa_goal{uk}": "3", "sa_step{uk}": STEP_QUEST,
    sa_today_shift: { date: TODAY, label: "Вечер · 17:00–24:00" }, ...extra }; };
const homeV44 = (page) => page.evaluate(() => {
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const q = (s) => document.querySelector(s);
  const greet = q('div[style*="2px 20px"]'), panel = q("[data-day-panel]"), pills = q("[data-day-pills]"), pulse = q("[data-pulse]"),
    tiles = q("[data-home-tiles]"), roleLine = q("[data-role-line]"), wish = q("[data-shift-wish]");
  const head = [...document.querySelectorAll("div")].find((d) => /^(Треки обучения|Выбери свою роль)$/.test((d.textContent || "").trim()) && d.children.length === 0);
  const sos = [...document.querySelectorAll("span")].find((e) => e.textContent.trim() === "SOS");
  const tools = sos ? sos.closest("div[style*='border-radius: 999px']") : null;
  let card = pills; while (card && !(card.style && card.style.borderRadius === "18px")) card = card.parentElement;
  const rest = greet ? [...greet.querySelectorAll("div")].find((d) => /^Два моря/i.test(d.textContent.trim())) : null;
  const within = (inner, outer) => inner && outer && inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;
  // в рамке — всё, кроме нарочно выступающего: бейдж непрочитанных и ляссе стоят absolute
  const fits = (el) => !!el && [...el.querySelectorAll("*")].every((k) => { const kr = r(k); return kr.width === 0 || getComputedStyle(k).position === "absolute" || k.closest("[style*='position: absolute']") !== null && k.closest("[style*='position: absolute']") !== el || within(kr, r(el)); });
  const pillEls = pills ? [...pills.querySelectorAll("[data-pill]")] : [];
  const tileEls = tiles ? [...tiles.querySelectorAll("[data-tile]")] : [];
  const top = (el) => (el ? Math.round(r(el).top + scrollY) : null);
  return {
    order: [greet, panel, card, pulse, tiles, tools, head].map(top), y: { greet: top(greet), toolsBottom: tools ? Math.round(r(tools).bottom + scrollY) : null },
    roleLine: roleLine ? roleLine.innerText.replace(/\s+/g, " ").trim() : null, wishRight: wish && rest ? Math.abs(r(wish).right - r(rest).right) < 1.5 && r(wish).top > r(rest).top : null,
    pills: pillEls.map((e) => ({ k: e.getAttribute("data-pill"), top: Math.round(r(e).top), fits: fits(e), text: e.innerText.replace(/\s+/g, " ").trim() })), pillsInCard: !!(pills && card && within(r(pills), r(card))),
    tiles: tileEls.map((e) => ({ k: e.getAttribute("data-tile"), top: Math.round(r(e).top), w: Math.round(r(e).width), fits: fits(e), text: e.innerText.replace(/\s+/g, " ").trim() })),
    pulseLabel: pulse ? getComputedStyle(pulse.querySelector("span")).color : null, sw: document.documentElement.scrollWidth, iw: innerWidth,
  };
});


// ════════════════════════════ v46: график ════════════════════════════
const { generateSchedule } = await import(SRC + "/lib/schedule-gen.js");
// Правдоподобный ресторан на 19 человек; расстановка — тем же генератором, что у руководителя
function buildFx() {
  const Y = now.getFullYear(), M = now.getMonth(), mkey = MKEY, DAYS = new Date(Y, M + 1, 0).getDate();
  const fd = (new Date(Y, M, 1).getDay() + 6) % 7, dow = (d) => (fd + d - 1) % 7;
  const POS = [{ id: "manager" }, { id: "host" }, { id: "call" }, { id: "bar" }, { id: "barback" }, { id: "waiter" }, { id: "runner" }];
  const rules = { peakDows: [4, 5], highDows: [3, 6], maxRow: 5, minOff: 2, minRest: 11, holidayPeak: true, wishDeadline: 20, autoFill: false, normMode: "floor", levels: 3 };
  const lvlOf = (d) => (rules.peakDows.includes(dow(d)) ? 3 : rules.highDows.includes(dow(d)) ? 2 : 1);
  let id = 0; const P = (name, pos, extra = {}) => ({ id: ++id, name, pos, norm: 160, ...extra });
  const staff = [
    P("Смирнов Роман", "manager", { rate: 95000, rateMode: "month", phone: "+7 914 000-11-22" }), P("Волкова Мария", "manager", { rate: 85000, rateMode: "month", phone: "+7 914 000-33-44" }),
    P("Токарева Ангелина", "host", { rate: 230, phone: "+7 914 000-55-66" }), P("Ким Дарья", "host", { rate: 230 }),
    P("Петров Иван", "bar", { rate: 280, phone: "+7 914 000-77-88" }), P("Белов Артём", "bar", { rate: 280 }), P("Орлов Никита", "bar", { rate: 260, norm: 120 }),
    P("Лисин Егор", "barback", { rate: 200 }),
    P("Смирнова Анна", "waiter", { rate: 220 }), P("Морозова Ксения", "waiter", { rate: 220 }), P("Соколов Дмитрий", "waiter", { rate: 220 }), P("Фёдорова Алина", "waiter", { rate: 220 }),
    P("Зайцева Полина", "waiter", { rate: 220, vacs: { [mkey]: [[20, 26]] } }), P("Ершов Максим", "waiter", { rate: 220, norm: 120 }), P("Лебедева София", "waiter", { rate: 220 }),
    P("Новиков Кирилл", "waiter", { rate: 220 }), P("Павлова Виктория", "waiter", { rate: 220, off: [0] }),
    P("Гусев Тимур", "runner", { rate: 200 }), P("Карпов Олег", "runner", { rate: 200 }),
  ];
  const cfg = { hours: [[12, 24], [12, 24], [12, 24], [12, 24], [12, 26], [12, 26], [12, 24]],
    shifts: [{ k: "У", name: "Утро", from: 10, to: 18 }, { k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }, { k: "К", name: "Кейтеринг", from: 10, to: 22, extra: 1 }],
    need: { 1: { manager: 1, host: 1, bar: 1, barback: 1, waiter: 4, runner: 1 }, 2: { manager: 1, host: 1, bar: 1, barback: 1, waiter: 5, runner: 1 }, 3: { manager: 1, host: 1, bar: 2, barback: 1, waiter: 6, runner: 2 } },
    split: { waiter: { "Д": 3, "В": 1 } }, rules,
    posRules: { manager: { pattern: "2x2" }, host: { pattern: "2x2" }, call: { pattern: "2x2" }, bar: { pattern: "even" }, barback: { pattern: "even" }, waiter: { pattern: "even" }, runner: { pattern: "2x2" } },
    dayShift: "Д", evening: { pos: "waiter", shift: "В", dows: [], count: 0 }, staff };
  const wishes = { 9: [24, 25].filter((d) => d <= DAYS), 12: [3, 4], 15: [27] }, hardOff = { 9: [30].filter((d) => d <= DAYS) };
  const r = generateSchedule({ cfg, DAYS, dow, lvlOf, plan: {}, locks: {}, POS, mkey, wishes, hardOff, prevTail: {}, freezeBefore: 0, restarts: 24, repairSweeps: 2, seed: 20261017 });
  const plan = r.plan || {}, T0 = now.getDate();
  plan[9] = { ...(plan[9] || {}), [T0]: "В" };
  const offerDay = Math.min(DAYS, T0 + 5);
  plan[9][offerDay] = ""; plan[10] = { ...(plan[10] || {}), [offerDay]: "Д" };
  // обмен «Соколов → Новиков» через два дня: у Соколова в этот день смена, Новиков свободен — при любой дате прогона
  const swapDay = Math.min(DAYS, T0 + 2);
  plan[11] = { ...(plan[11] || {}), [swapDay]: "Д" }; plan[16] = { ...(plan[16] || {}), [swapDay]: "" };
  return { mkey, today: T0, DAYS, dow, cfg, plan, offerDay,
    days: { [Math.min(DAYS, T0 + 7)]: { note: "Банкет · 40 гостей" } }, facts: {},
    wishes: [...Object.entries(wishes).flatMap(([s, ds]) => ds.map((d) => ({ staff_id: +s, day: d, kind: "off" }))), ...Object.entries(hardOff).flatMap(([s, ds]) => ds.map((d) => ({ staff_id: +s, day: d, kind: "hard" })))],
    swaps: [{ id: 1, from_staff: "10", from_name: "Морозова Ксения", day: offerDay, k: "Д", status: "open" },
      { id: 2, from_staff: "11", from_name: "Соколов Дмитрий", to_staff: "16", to_name: "Новиков Кирилл", day: Math.min(DAYS, T0 + 2), k: "Д", status: "taken" }] };
}
const FX = buildFx();
const DOWL = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"], DOWF = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
const MONTHS_R = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const at = (hh, mm = 0) => { const d = new Date(); d.setHours(hh, mm, 0, 0); return d; };
const schedRpcs = (fx, calls) => (fn, body) => {
  if (calls) calls.push({ fn, body });
  if (fn === "schedule_load") return { ok: true, venues: [{ venue_key: "main", config: fx.cfg }], months: [{ venue_key: "main", payload: { plan: fx.plan, locks: {}, days: fx.days, facts: fx.facts } }] };
  if (fn === "schedule_wishes_get") return { ok: true, wishes: fx.wishes };
  if (fn === "swap_list") return { ok: true, swaps: fx.swaps };
  if (fn === "swap_resolve" || fn === "swap_create" || fn === "swap_take" || fn === "swap_cancel" || fn === "schedule_wish_set") return { ok: true };
  if (fn === "schedule_save_month") return { ok: true };
  if (fn === "team_scores") return { ok: true, rows: SCORES };
  return undefined;
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const openSched = async ({ fx = FX, light = false, w = 393, profile = prof, storage = {}, time = at(14, 20), calls = null } = {}) => {
  const o = await open({ storage: { ...ROMAN44(), __role: profile === prof ? "seasonal" : "spg", ...storage }, profile, light, w, h: 852, rpcs: schedRpcs(fx, calls), fixedTime: time });
  await o.page.evaluate(() => window.__saNav("schedule")); await sleep(2400);
  return o;
};
const GOLD_DK = "rgb(226, 196, 132)", GOLD_LT = "rgb(122, 90, 34)";
const staffGeo = (page) => page.evaluate(() => {
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const hero = document.querySelector("[data-sched-hero]"), med = document.querySelector("[data-sched-medals]");
  const pg = hero && hero.querySelector("[data-sched-page]"), day = hero && hero.querySelector("[data-sched-day]"), time = hero && hero.querySelector("[data-hero-time]");
  const wrap = document.querySelector(".sa-schedwrap");
  const inside = (el) => { const b = r(el), wr = r(wrap); return !b || (b.left >= wr.left - 0.5 && b.right <= wr.right + 0.5); };
  const all = (el) => !el || [...el.querySelectorAll("*")].every((k) => { const kr = r(k); return kr.width === 0 || inside(k); });
  return {
    hero: hero ? { status: hero.getAttribute("data-hero-status"), h: Math.round(r(hero).height), clip: hero.scrollHeight - hero.clientHeight, text: hero.innerText.replace(/\s+/g, " ").trim(), top: Math.round(r(hero).top + wrap.scrollTop),
      page: pg ? { w: Math.round(r(pg).width), h: Math.round(r(pg).height) } : null, day: day ? day.textContent : null, timeColor: time ? getComputedStyle(time).color : null,
      thread: !!hero.querySelector("[data-sched-thread]"), lead: !!hero.querySelector("[data-hero-lead]"), check: !!hero.querySelector("[data-hero-checklist]"),
      mates: hero.querySelector("[data-hero-mates]") ? hero.querySelector("[data-hero-mates]").textContent : null, due: hero.querySelector("[data-hero-due]") ? hero.querySelector("[data-hero-due]").innerText.replace(/\s+/g, " ") : null, fits: all(hero) } : null,
    med: med ? { h: Math.round(r(med).height), top: Math.round(r(med).top + wrap.scrollTop), cells: [...med.querySelectorAll("[data-medal-cell]")].map((c) => ({ k: c.getAttribute("data-medal-cell"), t: c.innerText.replace(/\s+/g, " ").trim() })),
      note: med.querySelector("[data-medal-note]") ? med.querySelector("[data-medal-note]").textContent : null, fits: all(med) } : null,
    body: wrap ? wrap.innerText.replace(/\s+/g, " ") : "", sw: document.documentElement.scrollWidth, iw: innerWidth,
  };
});


// ════════════════════════════ v48: карточка сотрудника ════════════════════════════
const OUT8 = process.env.E2E_OUT || "/home/claude/preview/shots-v49";
mkdirSync(OUT8, { recursive: true });
const toGrid = (page) => page.evaluate(() => { const w = document.querySelector(".sa-schedwrap"), g = document.querySelector(".sa-schedgrid"); if (g) w.scrollTop = g.getBoundingClientRect().top + w.scrollTop - 220; });
const inView = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect();
  return { top: Math.round(b.top), bottom: Math.round(b.bottom), ih: innerHeight, ok: b.top >= -1 && b.bottom <= innerHeight + 1 && b.height > 40 }; }, sel);
const personGeo = (page) => page.evaluate(() => {
  const sh = document.querySelector("[data-person-sheet]"); if (!sh) return null;
  const b = sh.getBoundingClientRect(), t = (sel) => { const el = sh.querySelector(sel); return el ? el.innerText.replace(/\s+/g, " ").trim() : null; };
  const days = [...sh.querySelectorAll("[data-person-day]")];
  return { id: sh.getAttribute("data-person-sheet"), top: Math.round(b.top), bottom: Math.round(b.bottom), ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth,
    name: t("[data-person-name]"), sub: t("[data-person-sub]"), cells: [...sh.querySelectorAll("[data-medal-cell]")].map((c) => ({ k: c.getAttribute("data-medal-cell"), t: c.innerText.replace(/\s+/g, " ").trim() })),
    note: t("[data-medal-note]"), wishes: t("[data-person-wishes]"), days: days.length, k: Object.fromEntries(days.map((x) => [x.getAttribute("data-person-day"), x.getAttribute("data-person-k")])),
    icon: Object.fromEntries(days.map((x) => [x.getAttribute("data-person-day"), !!x.querySelector("svg")])), clash: days.filter((x) => x.querySelector("[data-person-clash]")).map((x) => +x.getAttribute("data-person-day")),
    call: !!sh.querySelector("[data-call-round]"), setupColor: sh.querySelector("[data-person-setup]") ? getComputedStyle(sh.querySelector("[data-person-setup]")).color : null,
    medalsFit: [...sh.querySelectorAll("[data-medal-cell]")].every((c) => { const cb = c.getBoundingClientRect(); return [...c.querySelectorAll("*")].every((k) => { const kb = k.getBoundingClientRect(); return kb.width === 0 || (kb.left >= cb.left - 0.5 && kb.right <= cb.right + 0.5); }); }),
    todayRing: days.filter((x) => /0px 0px 0px 2px/.test(x.style.boxShadow)).map((x) => +x.getAttribute("data-person-day")), text: sh.innerText.replace(/\s+/g, " ") };
});
// заработок в медальоне «досчитывается» (как у сотрудника) — ждём, пока число встанет
const openPerson = async (page, id) => { await toGrid(page); await sleep(250); await page.locator(`[data-person-open="${id}"]`).click(); await sleep(1300); };


// ════════════════════════════ v49 ════════════════════════════
const pickGeo = (page) => page.evaluate(() => {
  const ctxEl = document.querySelector("[data-pick-ctx]");
  if (!ctxEl) return null;
  const box = ctxEl.parentElement, b = box.getBoundingClientRect();   // лист смены: капсулы — прямо в нём
  const rows = [...box.querySelectorAll("button")].filter((x) => x.querySelector("[data-pick-status]") || /Выходной/.test(x.textContent));
  return { top: Math.round(b.top), bottom: Math.round(b.bottom), ih: innerHeight, hours: (box.querySelector("[data-pick-hours]") || {}).innerText,
    ctx: box.querySelector("[data-pick-ctx]").innerText.replace(/\s+/g, " ").trim(),
    rows: rows.map((x) => ({ t: x.innerText.replace(/\s+/g, " ").trim(), st: (x.querySelector("[data-pick-status]") || { getAttribute: () => null }).getAttribute("data-pick-status"),
      color: x.querySelector("[data-pick-status]") ? getComputedStyle(x.querySelector("[data-pick-status]")).color : null })),
    fill: !!box.querySelector("[data-pick-fill]"), text: box.innerText.replace(/\s+/g, " ") };
});
const openCell = async (page, name, d) => { await toGrid(page); await sleep(200);
  const ok3 = await page.evaluate(([nm, d]) => { const tr = [...document.querySelectorAll(".sa-schedgrid tr")].find((r) => r.querySelector("td.sa-schednm[title='" + nm + "']")); if (!tr) return "no row";
    const heads = [...document.querySelectorAll(".sa-schedgrid tr:first-child th")].slice(1).map((th) => Number((th.querySelector("b") || {}).textContent)); const i = heads.indexOf(d); if (i < 0) return "no day";
    const td = tr.querySelectorAll("td")[i + 1]; td.scrollIntoView({ block: "center" }); td.click(); return "ok"; }, [name, d]);
  await sleep(700); return ok3; };



// ════════════════════════════ v50 ════════════════════════════
const QUIET = { "sa_mastery{uk}": { tiers: Object.fromEntries(["track","tests","table","dialogue","fresh","gold","warmup","radio","guest","fixes","decks","streak","quest","hall"].map((k) => [k, 3])), fw: true, master: {} } };
const ASSIST = "Разберём по шагам. **Первое** — признай: «Понимаю, вы ждали другого». Второе — предложи замену. Третье — проверь через пять минут.";
const openW = (o) => open({ ua: o.ua || null, scr: o.scr || null, tgSafe: o.tgSafe || null, telegram: !!o.tgSafe, storage: { ...ROMAN44(), ...QUIET, ...(o.storage || {}) }, profile: o.profile || RA, rpcs: o.rpcs || schedRpcs(FX, o.calls || null), fixedTime: at(14, 20), w: o.w, h: o.h, mobile: o.mobile !== false, dsf: 1, motion: "reduce", light: !!o.light, assistant: ASSIST });
const nav = async (page, s, ms = 1400) => { await page.evaluate((s) => window.__saNav(s), s); await sleep(ms); };
const lay = (page) => page.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const root = document.getElementById("root"), cl = document.documentElement.classList;
  const rail = document.querySelector("[data-nav-rail]"), bar = document.querySelector("#sa-tabbar:not([data-nav-rail])");
  return { wide: cl.contains("sa-wide"), short: cl.contains("sa-short"), desk: cl.contains("sa-desk"), railon: cl.contains("sa-railon"),
    rail: r(rail), bar: r(bar), col: r(document.querySelector(".sa-col")), fab: !!document.querySelector("[data-fab]"), railAi: !!document.querySelector("[data-rail-ai]"),
    over: root ? root.scrollWidth - root.clientWidth : 0, iw: innerWidth, ih: innerHeight,
    active: (document.querySelector("[data-rail-tab][aria-current='page']") || { getAttribute: () => null }).getAttribute("data-rail-tab") };
});
const outside = (page) => page.evaluate(() => {
  const iw = innerWidth, bad = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest(".sa-hscroll, .sa-schedgrid, svg, [aria-hidden='true']")) continue;
    const b = el.getBoundingClientRect(); if (b.width < 2 || b.height < 2) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if ((own || el.tagName === "BUTTON") && (b.right > iw + 1.5 || b.left < -1.5)) bad.push((el.textContent || "").trim().slice(0, 16) + "@" + Math.round(b.left) + "→" + Math.round(b.right));
  }
  return bad.slice(0, 4);
});
const SCREENS = ["roleSelect", "home", "shift", "teamHub", "me", "glossary", "leaderboard", "stats", "daily", "league", "guestbook", "checklist", "report", "analytics",
  "contentEditor", "profile", "cellar", "mastery", "guide", "offline", "barLab", "mistakes", "search", "menuTrainer", "cocktails", "trainingCard", "sos", "mentor", "reference", "certificates", "candidate"];
const NAVS = ["roleSelect", "home", "shift", "teamHub", "me", "glossary", "leaderboard", "stats", "daily"];





// ════════════════════════════ v55 ════════════════════════════
// всплывашки новых значков — закрыть, чтобы не закрывали экраны (из wide-walk)
const dismissToasts = async (page) => { for (let i = 0, quiet = 0; i < 24 && quiet < 3; i++) {
  const x = page.locator('[data-ms-toast] button[aria-label="Закрыть"]');
  if (await x.count()) { await x.first().click().catch(() => {}); quiet = 0; } else quiet++;
  await sleep(400); } };
const W5 = 393, H5 = 852;
// Старт «как на телефоне»: whoami с задержкой / отказом / другим ответом; заставку и перезагрузки отмечаем в странице
async function openStart({ seedProfile = true, who = { ok: true, employee: prof }, whoDelay = 0, whoFail = false, profile = prof, w = W5, h = H5 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  const calls = [];
  const state = { who };
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const fn = m[1]; calls.push({ fn, t: Date.now() });
      if (fn === "whoami") {
        if (whoDelay) await sleep(whoDelay);
        calls.push({ fn: "whoami-answered", t: Date.now() });
        if (whoFail) return route.abort().catch(() => {});
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.who) }).catch(() => {});
      }
      const r = schedRpcs(FX, null)(fn, {});
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r !== undefined ? r : null) }).catch(() => {});
    }
    return route.abort().catch(() => {});
  });
  const seed = { sa_session_token: "tok-preview", sa_a11y: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_last_role: JSON.stringify("seasonal"), sa_sfx: "0", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_quest_open: "1" };
  if (seedProfile) seed.sa_profile = JSON.stringify(profile);
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  await ctx.addInitScript((seed) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    sessionStorage.setItem("__loads", String(Number(sessionStorage.getItem("__loads") || 0) + 1));
    window.__t = {};
    new MutationObserver(() => {
      const sp = document.getElementById("sa-splash"); if (sp) window.__t.seen = 1;
      if (window.__t.seen && (!sp || sp.style.opacity === "0") && window.__t.off == null) window.__t.off = Math.round(performance.now());
    }).observe(document, { subtree: true, childList: true, attributes: true });
  }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (mm) => { if (mm.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(mm.text())) errors.push("console: " + mm.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  return { ctx, page, calls, errors, state };
}
const splashOff = (p, ms = 15000) => p.waitForFunction(() => window.__t && window.__t.off != null, null, { timeout: ms }).then(() => p.evaluate(() => window.__t.off)).catch(() => null);
const loads = (p) => p.evaluate(() => Number(sessionStorage.getItem("__loads") || 0));
const bodyText = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));

if (want("START")) {
  // a) профиль на телефоне, сервер отвечает через 2,5 с — главная раньше
  {
    const o = await openStart({ whoDelay: 2500 });
    const off = await splashOff(o.page);
    const answered = o.calls.find((c) => c.fn === "whoami-answered");
    ok("START: профиль на телефоне — заставка гаснет до ответа сервера (whoami 2,5 с)", off != null && off < 2000 && !answered, "заставка " + off + " мс, ответ " + (answered ? "уже был" : "ещё нет"));
    const t = await bodyText(o.page);
    ok("START: на экране главная с именем, не экран входа", /Добр(ое|ый|ой) .*Анна/.test(t) && !/Вход по приглашению/.test(t), t.slice(0, 120));
    await sleep(3200);
    const t2 = await bodyText(o.page);
    // в сборке для разработки React (StrictMode) запускает эффекты дважды — там whoami два раза; в «как в проде» — один
    const nWho = o.calls.filter((c) => c.fn === "whoami").length, nLoads = await loads(o.page);
    ok("START: сервер подтвердил — экран тот же, whoami " + (process.env.E2E_PROD === "1" ? "один раз" : "один раз (в dev — два: StrictMode)") + ", без перезапуска",
      /Анна/.test(t2) && !/Вход по приглашению/.test(t2) && nWho <= (process.env.E2E_PROD === "1" ? 1 : 2) && nWho >= 1 && nLoads === 1, "whoami " + nWho + " · загрузок " + nLoads);
    await shot(o.page, "start-cached");
    ok("START: без ошибок", !o.errors.length, o.errors.join(" | "));
    await o.ctx.close();
  }
  // b) сессия отозвана — на вход, токен стёрт
  {
    const o = await openStart({ whoDelay: 700, who: { ok: false, error: "revoked" } });
    const off = await splashOff(o.page);
    ok("START: отозванная сессия — сначала главная из памяти (заставка без ожидания)", off != null && off < 1500, off + " мс");
    await o.page.waitForFunction(() => /Вход по приглашению/.test(document.body.innerText), null, { timeout: 6000 }).catch(() => {});
    const t = await bodyText(o.page);
    const tok = await o.page.evaluate(() => localStorage.getItem("sa_session_token"));
    ok("START: …и после ответа сервера — экран входа, токен стёрт", /Вход по приглашению/.test(t) && tok === null, t.slice(0, 80) + " · токен " + tok);
    await shot(o.page, "start-revoked");
    ok("START: отозванная — без ошибок", !o.errors.length, o.errors.join(" | "));
    await o.ctx.close();
  }
  // c) поменялся ресторан — на лету, без перезапуска
  {
    const o = await openStart({ whoDelay: 500, who: { ok: true, employee: { ...prof, restaurant: "Марико" } } });
    await splashOff(o.page);
    await o.page.waitForFunction(() => /Марико/i.test(document.body.innerText), null, { timeout: 6000 }).catch(() => {});
    const t = await bodyText(o.page);
    const sp = await o.page.evaluate(() => JSON.parse(localStorage.getItem("sa_profile") || "{}"));
    ok("START: ресторан поменяли — профиль обновился на лету (экран и память телефона), без перезапуска", /Марико/i.test(t) && sp.restaurant === "Марико" && (await loads(o.page)) === 1, "загрузок " + (await loads(o.page)) + " · " + sp.restaurant);
    ok("START: ресторан — без ошибок", !o.errors.length, o.errors.join(" | "));
    await o.ctx.close();
  }
  // d) поменяли имя — один перезапуск, потом без петли
  {
    const o = await openStart({ whoDelay: 400, who: { ok: true, employee: { ...prof, name: "Анастасия" } } });
    await o.page.waitForFunction(() => Number(sessionStorage.getItem("__loads")) >= 2, null, { timeout: 8000 }).catch(() => {});
    await o.page.waitForFunction(() => /Анастасия/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
    await sleep(2500);
    const n = await loads(o.page);
    const t = await bodyText(o.page);
    ok("START: имя поменяли — приложение перечиталось один раз и показывает новое имя", n === 2 && /Анастасия/.test(t), "загрузок " + n + " · " + t.slice(0, 80));
    ok("START: имя — без ошибок", !o.errors.length, o.errors.join(" | "));
    await o.ctx.close();
  }
  // e) профиля на телефоне нет — ждём сервер, как раньше
  {
    const o = await openStart({ seedProfile: false, whoDelay: 1500 });
    await sleep(900);
    const early = await o.page.evaluate(() => !!document.getElementById("sa-splash") && document.getElementById("sa-splash").style.opacity !== "0");
    const off = await splashOff(o.page);
    const t = await bodyText(o.page);
    ok("START: профиля нет — заставка ждёт сервер (как раньше), потом главная", early && off != null && off >= 1400 && /Анна/.test(t), "заставка " + off + " мс");
    await o.ctx.close();
  }
  // f) нет сети — профиль телефона
  {
    const o = await openStart({ whoFail: true });
    const off = await splashOff(o.page);
    await sleep(1500);
    const t = await bodyText(o.page);
    ok("START: нет сети — главная из памяти телефона, не экран входа", off != null && off < 1500 && /Анна/.test(t) && !/Вход по приглашению/.test(t), off + " мс");
    await o.ctx.close();
  }
}

// прокрутка и что под кнопкой AI / панелью в самом низу
const scrollGeo = (p) => p.evaluate(async () => {
  const root = document.getElementById("root");
  const fixedUp = (el) => { for (let x = el; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.position === "fixed" || cs.position === "sticky") return true; } return false; };
  const leaves = () => [...root.querySelectorAll("*")].filter((el) => {
    if (el.closest("svg") && el.tagName !== "svg") return false;
    if (el.children.length && el.tagName !== "svg") { if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false; }
    const b = el.getBoundingClientRect(); if (b.width < 2 || b.height < 2) return false;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || +cs.opacity === 0) return false;
    return !fixedUp(el);
  });
  root.scrollTop = 0; await new Promise((r) => setTimeout(r, 80));
  const scroll = root.scrollHeight - root.clientHeight;
  root.scrollTop = 1e6; await new Promise((r) => setTimeout(r, 150));
  const fabOn = document.documentElement.classList.contains("sa-fabon");
  const tab = document.getElementById("sa-tabbar");
  const edge = Math.min(tab ? tab.getBoundingClientRect().top : innerHeight, fabOn ? innerHeight - 180 : innerHeight);
  const under = [];
  for (const el of leaves()) { const b = el.getBoundingClientRect(); if (b.bottom > edge + 1 && b.top < innerHeight) under.push((el.textContent || el.tagName).trim().slice(0, 18) + "@" + Math.round(b.top)); }
  root.scrollTop = 0;
  return { scroll, fabOn, under: under.slice(0, 3), top: getComputedStyle(document.documentElement).getPropertyValue("--sa-top").trim() };
});
const SHORT = ["daily", "mistakes", "search", "league", "checklist", "onboarding", "candidate", "profile", "analytics", "report", "contentEditor", "menuTrainer", "mentor", "reference", "certificates", "barLab", "offline", "team"];
const LONG = ["roleSelect", "home", "shift", "teamHub", "me", "stats", "leaderboard", "cellar", "mastery", "guide"];
if (want("SCROLL")) {
  const o = await open({ profile: RA, storage: { ...ROMAN44(), __role: "spg" }, w: W5, h: H5, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  const p = o.page; await dismissToasts(p);
  const still = [], moving = [], hidden = [];
  for (const s of [...SHORT, ...LONG]) {
    await p.evaluate((s) => window.__saNav(s), s); await sleep(1200);
    const g = await scrollGeo(p);
    if (SHORT.includes(s) && g.scroll > 0) moving.push(s + ":" + g.scroll);
    if (SHORT.includes(s) && g.scroll === 0) still.push(s);
    if (g.under.length) hidden.push(s + " → " + g.under.join(", "));
  }
  ok("SCROLL: короткие экраны не листаются вовсе (было 43–131 px)", !moving.length, "листаются: " + moving.join(" ") + " · стоят: " + still.length);
  ok("SCROLL: в самом низу ни одна строка не под кнопкой AI и не под панелью вкладок", !hidden.length, hidden.join(" | "));
  // кнопка AI — на месте и того же размера
  await p.evaluate(() => window.__saNav("teamHub")); await sleep(1200);
  // v64 (Доп. 377): плавающей кнопки больше нет — Наставник кругом посередине нижнего меню; запаса под кнопку (sa-fabon) нет
  const fab = await p.evaluate(() => ({ fab: !!document.querySelector("[data-fab]"), tabAi: !!document.querySelector("#sa-tabbar [data-tab-ai]"), fabon: document.documentElement.classList.contains("sa-fabon") }));
  ok("SCROLL: кнопки AI над содержимым нет — Наставник в нижнем меню, запаса под кнопку нет", !fab.fab && fab.tabAi && !fab.fabon, JSON.stringify(fab));
  // «Рейтинг»: в покое кнопка закрывает строку — прокрутка поднимает её выше кнопки
  await p.evaluate(() => window.__saNav("leaderboard")); await sleep(1300);
  const lb = await scrollGeo(p);
  ok("SCROLL: «Рейтинг» листается ровно настолько, чтобы последняя строка встала выше кнопки", lb.scroll > 0 && lb.scroll < 140 && !lb.under.length, JSON.stringify(lb));
  ok("SCROLL: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
  // новичок: главная и вкладки
  const q = await open({ profile: { ...prof, id: "u-new", name: "Анна", surname: "Новикова" }, storage: { __role: "seasonal" }, w: W5, h: H5, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  await dismissToasts(q.page);
  const hid2 = [];
  for (const s of ["roleSelect", "home", "shift", "me", "stats", "daily", "glossary"]) {
    await q.page.evaluate((s) => window.__saNav(s), s); await sleep(1200);
    const g = await scrollGeo(q.page); if (g.under.length) hid2.push(s + " → " + g.under.join(", "));
  }
  ok("SCROLL: новичок — внизу вкладок ничего не прячется под кнопкой", !hid2.length, hid2.join(" | "));
  await q.page.evaluate(() => { document.getElementById("root").scrollTop = 1e6; }); await sleep(400);
  await shot(q.page, "scroll-glossary-bottom");
  await q.page.evaluate(() => window.__saNav("roleSelect")); await sleep(1500);
  await q.page.evaluate(() => { document.getElementById("root").scrollTop = 1e6; }); await sleep(500);
  await shot(q.page, "scroll-home-bottom");
  await q.ctx.close();
}

if (want("HEAD") || want("MARGIN")) {
  const o = await open({ profile: RA, storage: { ...ROMAN44(), __role: "spg" }, w: W5, h: H5, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  const p = o.page; await dismissToasts(p);
  const gaps = [];
  for (const s of ["daily", "mistakes", "search", "leaderboard", "cellar", "guestbook", "mentor", "glossary"]) {
    await p.evaluate((s) => window.__saNav(s), s); await sleep(1100);
    gaps.push(s + ":" + await p.evaluate(() => {
      const bar = [...document.querySelectorAll("body *")].find((e) => e.children.length === 0 && /^✦\s*SA$/.test((e.textContent || "").trim()));
      let x = bar; for (let k = 0; k < 4 && x && x.parentElement; k++) { x = x.parentElement; if (x.getBoundingClientRect().width > 300) break; }
      const back = [...document.querySelectorAll("button")].find((e) => (e.textContent || "").trim() === "‹" || e.getAttribute("aria-label") === "Назад");
      return x && back ? Math.round(back.getBoundingClientRect().top - x.getBoundingClientRect().bottom) : -99;
    }));
  }
  const big = gaps.filter((g) => { const v = +g.split(":")[1]; return v < 0 || v > 20; });
  ok("HEAD: заголовок экрана сразу под верхней строкой (было 44 px пустоты)", !big.length, gaps.join(" "));
  const m = await p.evaluate(() => ({ margin: getComputedStyle(document.body).margin, col: Math.round(document.querySelector(".sa-col").getBoundingClientRect().width), left: Math.round(document.querySelector(".sa-col").getBoundingClientRect().left), top: getComputedStyle(document.documentElement).getPropertyValue("--sa-top").trim() }));
  ok("MARGIN: без полей браузера — колонка во всю ширину 393, от края 0", m.margin === "0px" && m.col === 393 && m.left === 0, JSON.stringify(m));
  ok("MARGIN: --sa-top = высота верхней строки (43 px)", m.top === "43px", m.top);
  await p.evaluate(() => window.__saNav("profile")); await sleep(1000);
  const tp = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sa-top").trim());
  ok("MARGIN: на «Аккаунте» верхней строки нет — --sa-top 0", tp === "0px", tp);
  await p.evaluate(() => window.__saNav("daily")); await sleep(1000);
  await shot(p, "head-daily");
  await o.ctx.close();
}

if (want("SKEL")) {
  const CASES = [["team", "admin_list_employees"], ["analytics", "quiz_people"], ["contentEditor", "cms_list_lessons"], ["leaderboard", "team_achievements"], ["onboarding", "onboarding_list"]];
  for (const [scr, fn] of CASES) {
    const o = await open({ profile: RA, storage: { ...ROMAN44(), __role: "spg" }, w: W5, h: H5, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
    const p = o.page; await dismissToasts(p);
    await p.route("**/rest/v1/rpc/**", (route) => { if (route.request().url().endsWith("/" + fn)) return; return route.fallback(); });
    await p.evaluate((s) => window.__saNav(s), scr); await sleep(1400);
    const g = await p.evaluate(() => ({ skel: document.querySelectorAll("[data-skel]").length, shim: document.querySelectorAll("[data-skel] .sa-skel").length,
      text: /Загрузка|Загружаю|Загружаем/.test([...document.querySelectorAll("body *")].filter((e) => !e.closest("[data-skel]") && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => e.textContent).join(" ")),
      sr: [...document.querySelectorAll("[data-skel] span")].map((s) => s.textContent).join(",") }));
    ok("SKEL: " + scr + " — пока данные едут, силуэты карточек, а не надпись «Загрузка…»", g.skel >= 1 && g.shim >= 1 && !g.text, JSON.stringify(g));
    if (scr === "team" || scr === "analytics") await shot(p, "skel-" + scr);
    await o.ctx.close();
  }
}

if (want("LIGHT")) {
  const o = await open({ profile: RA, storage: { ...ROMAN44(), __role: "spg" }, w: W5, h: H5, dsf: 1, light: true, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  const p = o.page; await dismissToasts(p);
  const moving = [];
  for (const s of ["daily", "mistakes", "search", "league", "checklist", "analytics"]) { await p.evaluate((s) => window.__saNav(s), s); await sleep(1100); const g = await scrollGeo(p); if (g.scroll > 0) moving.push(s + ":" + g.scroll); }
  const top = await p.evaluate(() => { const v = getComputedStyle(document.documentElement).getPropertyValue("--sa-top").trim(); const bar = [...document.querySelectorAll("body *")].find((e) => e.children.length === 0 && /^✦\s*SA$/.test((e.textContent || "").trim())); let x = bar; for (let k = 0; k < 4 && x && x.parentElement; k++) { x = x.parentElement; if (x.getBoundingClientRect().width > 300) break; } return v + " / " + Math.round(x.getBoundingClientRect().height) + "px"; });
  ok("LIGHT: «Для чтения» — короткие экраны стоят, --sa-top = высоте строки", !moving.length && top.split(" / ")[0] === top.split(" / ")[1], moving.join(" ") + " · " + top);
  await o.ctx.close();
}

if (want("WIDE")) {
  for (const [nm, w, h, mobile] of [["land", 844, 390, true], ["desk", 1440, 900, false]]) {
    const o = await open({ profile: RA, storage: { ...ROMAN44(), __role: "spg" }, w, h, mobile, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
    const p = o.page; await dismissToasts(p);
    const cls = await p.evaluate(() => ({ fab: document.documentElement.classList.contains("sa-fabon"), nav: document.documentElement.classList.contains("sa-navon"), wide: document.documentElement.classList.contains("sa-wide") }));
    ok("WIDE: " + nm + " — меню слева, классы низа (sa-fabon, sa-navon) не ставятся", cls.wide && !cls.fab && !cls.nav, JSON.stringify(cls));
    const pads = {};
    for (const s of ["roleSelect", "leaderboard", "analytics"]) { await p.evaluate((s) => window.__saNav(s), s); await sleep(1200); pads[s] = await p.evaluate(() => { const t = document.querySelector(".sa-tabpad"); return t ? getComputedStyle(t).paddingBottom : "—"; }); }
    ok("WIDE: " + nm + " — отступы обёрток как в v54 (главная 24, остальные 88)", pads.roleSelect === "24px" && pads.leaderboard === "88px" && pads.analytics === "88px", JSON.stringify(pads));
    const over = await p.evaluate(() => { const r = document.getElementById("root"); return r.scrollWidth - r.clientWidth; });
    ok("WIDE: " + nm + " — без прокрутки вбок", over <= 1, String(over));
    ok("WIDE: " + nm + " — без ошибок", !o.errors.length, o.errors.join(" | "));
    await o.ctx.close();
  }
}

if (want("TG")) {
  const o = await open({ telegram: true, profile: { ...prof, id: "u-new", name: "Анна", surname: "Новикова" }, storage: { __role: "seasonal" }, w: W5, h: H5, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  const p = o.page; await dismissToasts(p);
  const t = await bodyText(p);
  const g = await scrollGeo(p);
  ok("TG: в Telegram главная на месте, внизу ничего не под кнопкой", /Анна/.test(t) && !g.under.length, JSON.stringify(g));
  await p.evaluate(() => window.__saNav("mistakes")); await sleep(1000);
  const g2 = await scrollGeo(p);
  ok("TG: короткий экран не листается", g2.scroll === 0, String(g2.scroll));
  ok("TG: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("PRE")) {
  const o = await open({ profile: RA, storage: { ...ROMAN44(), __role: "spg" }, w: W5, h: H5, dsf: 1, rpcs: schedRpcs(FX, null) });
  const pre = await o.page.evaluate(() => [...document.querySelectorAll("link[rel=preconnect], link[rel=dns-prefetch]")].map((l) => l.rel + ":" + l.href + (l.crossOrigin ? "+" + l.crossOrigin : "")).join(" "));
  ok("PRE: соединение с Supabase открывается заранее (preconnect с crossorigin + dns-prefetch)", /preconnect:https:\/\/gvxhgdynjuaisswplroh\.supabase\.co\/\+anonymous/.test(pre) && /dns-prefetch:https:\/\/gvxhgdynjuaisswplroh\.supabase\.co/.test(pre), pre);
  await o.ctx.close();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - fails} из ${results.length}`);
await browser.close(); server.close();
