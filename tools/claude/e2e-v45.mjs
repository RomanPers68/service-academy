// e2e v45 (Доп. 358): плитка «График смен» — листок календаря и нить суток. TILE — вид на 320 / 360 / 375 / 393 /
// 430 px в обеих темах: листок с сегодняшним числом, жирный заголовок, «Вечер · 17:00–24:00» (время золотом, на 393+
// в одну строку, в узкой плитке — строкой ниже без точки в начале строки), нить суток с отрезком смены и риской
// «сейчас», вровень с «Книгой отзывов», всё в рамке, без прокрутки вбок. STATES — выходной, нет графика, ночная смена,
// утро до смены, сотрудник («Мой график»). TAPS — нажатие и Enter открывают график. MINUTE — риска едет со временем.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5260, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v45";
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
async function open({ storage = {}, telegram = false, light = false, w = 390, h = 844, url = "/", schedule = null, fixedTime = null, chat = [], rpcs = null, profile = prof, calls = [], ai = "guest", tts = null, ttsCalls = [], stream = false, assistant = null, motion = "no-preference", clockInstall = null }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", reducedMotion: motion });
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
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(profile), sa_a11y: light ? "1" : "0", sa_welcome_seen_v11: "1", sa_last_role: JSON.stringify("__role" in storage ? storage.__role : "seasonal"), sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0",
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

// ════════════════════════════ v45: плитка «График смен» ════════════════════════════
const at = (hh, mm = 0) => { const d = new Date(); d.setHours(hh, mm, 0, 0); return d; };
const GOLD_DK = "rgb(226, 196, 132)", GOLD_LT = "rgb(122, 90, 34)", SUB_DK = "rgb(169, 155, 126)", SUB_LT = "rgb(107, 91, 64)";
const tileV45 = (page) => page.evaluate(() => {
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const t = document.querySelector('[data-tile="schedule"]'), b = document.querySelector('[data-tile="book"]');
  if (!t) return null;
  const tr = r(t), pg = t.querySelector("[data-sched-page]"), day = t.querySelector("[data-sched-day]"), when = t.querySelector("[data-when]");
  const time = t.querySelector("[data-when-time]"), dot = t.querySelector("[data-when-dot]"), thread = t.querySelector("[data-sched-thread]");
  const name = when && when.querySelector("span");
  const within = (k) => { const kr = r(k); return kr.width === 0 || (kr.left >= tr.left - 0.5 && kr.right <= tr.right + 0.5 && kr.top >= tr.top - 3.5 && kr.bottom <= tr.bottom + 3.5); };
  const segs = thread ? [...thread.querySelectorAll("[data-seg]")].map((s) => ({ k: s.getAttribute("data-seg"), l: +(((r(s).left - r(thread).left) / r(thread).width) * 100).toFixed(1), w: +((r(s).width / r(thread).width) * 100).toFixed(1) })) : [];
  const now = thread ? thread.querySelector("[data-now]") : null;
  const title = t.querySelector('div[style*="font-weight: bold"]');
  const lh = when ? parseFloat(getComputedStyle(when).lineHeight) : 0;
  const clip = when ? r(when) : null, dr = dot ? r(dot) : null;
  const star = when && when.getAttribute("data-when") === "off" ? when.querySelector("span") : null;
  return {
    h: Math.round(tr.height), bookH: b ? Math.round(r(b).height) : null, sameRow: b ? Math.abs(r(b).top - tr.top) < 1 : null, w: Math.round(tr.width),
    aria: t.getAttribute("aria-label"), role: t.getAttribute("role"), tab: t.getAttribute("tabindex"),
    page: pg ? { w: Math.round(r(pg).width), h: Math.round(r(pg).height), left: Math.round(r(pg).left - tr.left) } : null,
    day: day ? day.textContent.trim() : null, dayColor: day ? getComputedStyle(day).color : null,
    title: title ? title.textContent.trim() : null, titleW: title ? getComputedStyle(title).fontWeight : null,
    when: when ? when.getAttribute("data-when") : null, whenText: when ? when.innerText.replace(/\s+/g, " ").trim() : null,
    lines: when && lh ? Math.round(r(when).height / lh) : null,
    timeColor: time ? getComputedStyle(time).color : null, timeOneLine: time ? r(time).height <= lh + 1 : null,
    // точка-разделитель: на одной строке — между словом и временем; время строкой ниже — точка за левым краем (срезана)
    dot: dr && clip && name && time ? { between: dr.left >= r(name).right - 0.5 && dr.right <= r(time).left + 0.5 && Math.abs(r(time).top - r(name).top) < 2, hidden: dr.right <= clip.left + 0.5, wrapped: r(time).top > r(name).top + 2 } : null,
    star: star ? { left: Math.round(r(star).left - clip.left), top: Math.round(r(star).top - clip.top) } : null,
    thread: thread ? { bottomGap: Math.round(tr.bottom - r(thread).bottom), h: +r(thread).height.toFixed(1), full: Math.abs(r(thread).width - (tr.width - 2)) < 2 } : null,
    segs, now: now ? { on: now.getAttribute("data-now"), l: +(((r(now).left + r(now).width / 2 - r(thread).left) / r(thread).width) * 100).toFixed(1) } : null,
    fits: [...t.querySelectorAll("*")].every(within), sw: document.documentElement.scrollWidth, iw: innerWidth,
  };
});
const tileShot = async (page, name) => { const tb = await page.evaluate(() => { const x = document.querySelector("[data-home-tiles]").getBoundingClientRect(); return { y: x.top, h: x.height, w: innerWidth }; });
  await page.screenshot({ path: OUT + "/" + name + ".png", clip: { x: 0, y: Math.max(0, tb.y - 14), width: tb.w, height: Math.round(tb.h) + 16 } }); };
const home45 = async (opts) => { const o = await open({ profile: RA, rpcs, fixedTime: at(19, 30), ...opts }); await o.page.evaluate(() => window.__saNav("roleSelect")); await sleep(1600);
  await o.page.evaluate(() => { const t = document.querySelector("[data-home-tiles]"); if (t) window.scrollTo(0, Math.max(0, t.getBoundingClientRect().top + scrollY - 300)); }); await sleep(250); return o; };

// ── TILE. Вид на всех ширинах в обеих темах ──
if (want("TILE")) {
  const TODAY_N = String(new Date().getDate());
  for (const w of [320, 360, 375, 393, 430]) for (const light of [false, true]) {
    const nm = "TILE " + w + (light ? " светлая" : " тёмная");
    const { ctx, page, errors } = await home45({ storage: ROMAN44(), light, w });
    const g = await tileV45(page);
    if (!g) { ok(nm + ": плитка есть", false); await ctx.close(); continue; }
    ok(nm + ": листок календаря 31×34 слева, на нём сегодняшнее число золотом", g.page && g.page.w === 31 && g.page.h === 34 && g.page.left <= 12 && g.day === TODAY_N && g.dayColor === (light ? GOLD_LT : GOLD_DK), JSON.stringify([g.page, g.day, g.dayColor]));
    ok(nm + ": заголовок «График смен» — жирный", g.title === "График смен" && (g.titleW === "700" || g.titleW === "bold"), g.title + " " + g.titleW);
    ok(nm + ": подпись — «Вечер · 17:00–24:00», время золотом и не рвётся", g.when === "shift" && /^Вечер ?· ?17:00–24:00$/.test(g.whenText) && g.timeColor === (light ? GOLD_LT : GOLD_DK) && g.timeOneLine, JSON.stringify([g.whenText, g.timeColor, g.timeOneLine]));
    if (w >= 393) ok(nm + ": подпись — в одну строку, точка между словом и временем", g.lines === 1 && g.dot && g.dot.between && !g.dot.wrapped, JSON.stringify([g.lines, g.dot]));
    else ok(nm + ": " + (g.dot && g.dot.wrapped ? "время строкой ниже, точка в начале строки срезана" : "подпись в одну строку, точка между словом и временем"), g.dot && (g.dot.wrapped ? g.dot.hidden && g.lines === 2 : g.dot.between && g.lines === 1), JSON.stringify([g.lines, g.dot]));
    ok(nm + ": нить суток по нижнему краю во всю ширину, отрезок 17–24 справа, риска 19:30 горит", g.thread && g.thread.bottomGap <= 1.5 && g.thread.full && g.segs.length === 1 && g.segs[0].k === "17-24" && Math.abs(g.segs[0].l - 70.8) <= 1 && Math.abs(g.segs[0].w - 29.2) <= 1
      && g.now && g.now.on === "on" && Math.abs(g.now.l - 81.3) <= 1.2, JSON.stringify([g.thread, g.segs, g.now]));
    const side = w >= 360;
    ok(nm + ": " + (side ? "в ряду с «Книгой отзывов», вровень" : "плитки друг под другом"), side ? g.sameRow && g.h === g.bookH : g.sameRow === false, JSON.stringify([g.sameRow, g.h, g.bookH]));
    if (w >= 393) ok(nm + ": плитка невысокая — не выше 60 px", g.h <= 60, String(g.h));
    ok(nm + ": всё в рамке, без прокрутки вбок", g.fits && g.sw <= g.iw, JSON.stringify([g.fits, g.sw, g.iw]));
    ok(nm + ": скринридер — «График смен. Сегодня: Вечер, 17:00–24:00», кнопка", g.aria === "График смен. Сегодня: Вечер, 17:00–24:00" && g.role === "button" && g.tab === "0", g.aria);
    if (light) { const sm = await smallText(page, '[data-tile="schedule"]', 11); ok(nm + ": в плитке мелкого текста нет (от 11 px)", sm === "", sm); }
    await tileShot(page, "tile-" + (light ? "light" : "dark") + "-" + w);
    ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── STATES. Выходной, нет графика, ночная смена, утро до смены, сотрудник ──
if (want("STATES")) {
  for (const light of [false, true]) {
    const th = light ? " светлая" : " тёмная";
    { const { ctx, page, errors } = await home45({ storage: ROMAN44({ sa_today_shift: { date: TODAY, label: "выходной" } }), light, w: 393 });
      const g = await tileV45(page);
      ok("STATES выходной" + th + ": «Сегодня выходной ✦», звезда не одна в строке", g.when === "off" && g.whenText === "Сегодня выходной ✦" && g.star && g.star.left > 30, JSON.stringify([g.whenText, g.star]));
      ok("STATES выходной" + th + ": число приглушено, нить без отрезка, риска не горит", g.dayColor === (light ? SUB_LT : SUB_DK) && g.thread && g.segs.length === 0 && g.now && g.now.on === "off", JSON.stringify([g.dayColor, g.segs, g.now]));
      ok("STATES выходной" + th + ": скринридер, рамка, без ошибок", g.aria === "График смен. Сегодня выходной" && g.fits && errors.length === 0, g.aria + " " + errors.slice(0, 2).join(" | "));
      await tileShot(page, "state-off-" + (light ? "light" : "dark")); await ctx.close(); }
    { const st = ROMAN44(); delete st.sa_today_shift;
      const { ctx, page, errors } = await home45({ storage: st, light, w: 393 });
      const g = await tileV45(page);
      ok("STATES без графика" + th + ": прежняя подпись, без нити, число золотом", g.when === "none" && g.whenText === "Составить, проверить и опубликовать" && !g.thread && g.dayColor === (light ? GOLD_LT : GOLD_DK), JSON.stringify([g.whenText, g.thread, g.dayColor]));
      ok("STATES без графика" + th + ": рамка, без ошибок", g.fits && errors.length === 0, errors.slice(0, 2).join(" | "));
      await tileShot(page, "state-none-" + (light ? "light" : "dark")); await ctx.close(); }
  }
  { const { ctx, page, errors } = await home45({ storage: ROMAN44({ sa_today_shift: { date: TODAY, label: "Ночь · 22:00–6:00" } }), w: 393, fixedTime: at(2, 30) });
    const g = await tileV45(page);
    ok("STATES ночная 22–6 в 2:30: два отрезка — 22–24 и 0–6, риска горит на 0–6", g.segs.length === 2 && g.segs.some((s) => s.k === "22-24" && Math.abs(s.l - 91.7) <= 1) && g.segs.some((s) => s.k === "0-6" && s.l <= 0.5 && Math.abs(s.w - 25) <= 1)
      && g.now && g.now.on === "on" && Math.abs(g.now.l - 10.4) <= 1.2, JSON.stringify([g.segs, g.now]));
    ok("STATES ночная: подпись «Ночь · 22:00–6:00», без ошибок", /^Ночь ?· ?22:00–6:00$/.test(g.whenText) && errors.length === 0, g.whenText + " " + errors.slice(0, 2).join(" | "));
    await tileShot(page, "state-night"); await ctx.close(); }
  { const { ctx, page, errors } = await home45({ storage: ROMAN44({ sa_today_shift: { date: TODAY, label: "Утро · 10:00–18:00" } }), w: 393, fixedTime: at(8, 0) });
    const g = await tileV45(page);
    ok("STATES утро 10–18 в 8:00: риска левее отрезка и не горит", g.segs.length === 1 && g.segs[0].k === "10-18" && g.now && g.now.on === "off" && g.now.l < g.segs[0].l && Math.abs(g.now.l - 33.3) <= 1.2, JSON.stringify([g.segs, g.now]));
    ok("STATES утро: без ошибок", errors.length === 0, errors.slice(0, 2).join(" | "));
    await tileShot(page, "state-morning"); await ctx.close(); }
  { const { ctx, page, errors } = await home45({ storage: { ...ROMAN44(), __role: "seasonal" }, profile: { ...prof }, w: 393 });
    const g = await tileV45(page);
    ok("STATES сотрудник: «Мой график», подпись смены, нить", g && g.title === "Мой график" && g.when === "shift" && g.segs.length === 1 && g.aria === "Мой график. Сегодня: Вечер, 17:00–24:00", JSON.stringify(g && [g.title, g.when, g.aria]));
    ok("STATES сотрудник: без ошибок", errors.length === 0, errors.slice(0, 2).join(" | "));
    await ctx.close(); }
}

// ── TAPS. Нажатие и Enter с клавиатуры открывают график ──
if (want("TAPS")) {
  for (const how of ["click", "enter"]) {
    const { ctx, page, errors } = await home45({ storage: ROMAN44(), w: 393 });
    if (how === "click") await page.locator('[data-tile="schedule"]').click();
    else { await page.locator('[data-tile="schedule"]').focus(); await page.keyboard.press("Enter"); }
    await sleep(1500);
    const res = await page.evaluate(() => !document.querySelector("[data-day-panel]") && /график/i.test(document.body.innerText));
    ok("TAPS: " + (how === "click" ? "нажатие" : "Enter") + " открывает график", res);
    ok("TAPS: " + how + " — без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── MINUTE. Риска «сейчас» едет со временем: 19:30 → 20:30 (часы страницы — вперёд на час) ──
if (want("MINUTE")) {
  const { ctx, page, errors } = await open({ storage: ROMAN44(), profile: RA, rpcs, w: 393, clockInstall: at(19, 30) });
  await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1600);
  const a = await tileV45(page);
  await page.clock.fastForward("01:00:00"); await sleep(600);
  const b = await tileV45(page);
  ok("MINUTE: риска была на 19:30 (≈81 %), через час — на 20:30 (≈85 %)", a && b && a.now && b.now && Math.abs(a.now.l - 81.3) <= 1.5 && Math.abs(b.now.l - 85.4) <= 1.5, JSON.stringify([a && a.now, b && b.now]));
  ok("MINUTE: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
