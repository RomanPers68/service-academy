// e2e v56 (Доп. 369): главная — «что сейчас» по смене, «С возвращением», первый день без нулей, логотип меньше.
// Голова — из e2e-v55. FIRST — новичок: «Первый день» вместо нулей, одно главное действие (без плашек), логотип 152×121;
// BEFORE — до смены разминка (тап — разминка, «Дальше» — урок); DURING — на смене ошибки или SOS; AFTER — «как прошла
// смена?»: пять лиц, ответ → sa_mood + save_mood, «Рассказать» — Наставник с вопросом, «Не сейчас» — карточка трека;
// BACK — «С возвращением» (и после перезахода в тот же день; заходил вчера — нет); NONE — без графика как было;
// ROLE — сменил трек — не «первый день»;
// LIGHT, WIDE (844×390, 1440×900), TG.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v56.mjs [разделы]
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





// ════════════════════════════ v56 ════════════════════════════
const dismissToasts = async (page) => { for (let i = 0, quiet = 0; i < 24 && quiet < 3; i++) {
  const x = page.locator('[data-ms-toast] button[aria-label="Закрыть"]');
  if (await x.count()) { await x.first().click().catch(() => {}); quiet = 0; } else quiet++;
  await sleep(400); } };
const W6 = 393, H6 = 852;
const DONE6 = { "s0-1": true, "s0-2": true, "s0-3": true };
const ymd6 = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const ago6 = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd6(d); };
const TODAY6 = ymd6(new Date());
const recent = { "sa_activity{uk}": { [ago6(1)]: { st: 2, l: 2 } }, "sa_last_open{uk}": ago6(1) };
const cacheWith = (k) => ({ ...SCHED_CACHE, plan: { s1: { [new Date().getDate()]: k }, s2: { 1: "Д" } }, ts: Date.now() });
// v58: сервер (schedule_load) отвечает тем же, что и копия на телефоне — иначе смена из FX (вечер) перекрывала кэш,
// и сценарии «после утренней смены» зависели от того, успел ли ответить сервер
const fxWith = (k) => { const fx = clone(FX); fx.plan[9] = { ...(fx.plan[9] || {}), [FX.today]: k }; return fx; };
// v68 (Доп. 381): карточка «сейчас» и карточка трека — одна карточка «Приглашение». Без «сейчас» она в режиме
// data-now-card="track" — для проверок ниже это прежнее «карточки «сейчас» нет» (mode: null); плашки «Разминка» и
// «Шаг дня» стали строками карточки (data-now-row="warm" / "step"); тег — «До смены 2 ч 40 мин», «На смене до 24:00»
const nowInfo = (p) => p.evaluate(() => {
  const c = document.querySelector("[data-now-card]");
  const logo = document.querySelector("[data-home-logo]"); const lb = logo ? logo.getBoundingClientRect() : null;
  const m = c ? c.getAttribute("data-now-card") : null;
  return { mode: m === "track" ? null : m, text: c ? c.innerText.replace(/\s+/g, " ") : "", tag: c && c.querySelector("[data-now-tag]") ? c.querySelector("[data-now-tag]").innerText : "",
    first: !!document.querySelector("[data-first-day]"), pills: !!document.querySelector('[data-now-row="warm"], [data-now-row="step"]'), next: !!document.querySelector("[data-now-next]"),
    hello: (document.body.innerText.match(/(Доброе утро|Добрый день|Добрый вечер|Доброй ночи|С возвращением), [^\n]+/) || [""])[0],
    logo: lb ? [Math.round(lb.width), Math.round(lb.height)] : null, over: (() => { const r = document.getElementById("root"); return r.scrollWidth - r.clientWidth; })(),
    fitK: (() => { const r = document.querySelector("[data-home-look]"); return r ? Number(r.getAttribute("data-home-fit") || 0) : 0; })() };
});
const openHome = async (opts) => {
  const o = await open({ profile: prof, w: W6, h: H6, dsf: 1, rpcs: schedRpcs(FX, null), ...opts });
  await dismissToasts(o.page);
  await o.page.evaluate(() => window.__saNav("roleSelect")); await sleep(1500);
  return o;
};

if (want("FIRST")) {
  const o = await openHome({ storage: { __role: "seasonal" }, fixedTime: at(14, 20) });
  const g = await nowInfo(o.page);
  ok("FIRST: новичок — «Первый день» вместо трёх нулей, без карточки «сейчас»", g.first && !g.mode, JSON.stringify(g));
  const zeros = await o.page.evaluate(() => /0\s*дней/i.test(document.body.innerText));
  ok("FIRST: на главной нет «0 дней»", !zeros);
  ok("FIRST: одно главное действие — первый урок, без плашек «Разминка» и «Шаг дня»", !g.pills && /Начать/.test(await o.page.evaluate(() => document.querySelector("[data-day-chips]") ? document.body.innerText : "")), JSON.stringify(g));
  // v101 (Доп. 414): главная целиком на экране — если девиз уходил под меню, логотип ужат (те же пропорции, не мельче 90×72)
  ok("FIRST: логотип на четверть меньше — 152×121 (было 198×158; v101: ужат под экран — в тех же пропорциях)",
    g.logo && (g.fitK ? g.logo[1] < 121 && g.logo[1] >= 72 && Math.abs(g.logo[0] / g.logo[1] - 152 / 121) < 0.03 : g.logo[0] === 152 && g.logo[1] === 121), JSON.stringify({ logo: g.logo, k: g.fitK }));
  await shot(o.page, "first");
  ok("FIRST: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("ROLE")) {
  // сменил трек (руководитель открыл «Хостес», там ещё ничего не пройдено) — это не первый день: плашки и табличка на месте
  const o = await open({ profile: RA, storage: { ...ROMAN44(), __role: "spg" }, w: W6, h: H6, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(10, 0) });
  await dismissToasts(o.page);
  await o.page.evaluate(() => window.__saNav("roleSelect")); await sleep(1500);
  const g = await nowInfo(o.page);
  const t = await o.page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  // v58: смены Романа в сетке — генератор 2/2 по дням месяца: в его выходной карточки «сейчас» нет (и не должно быть)
  const romanDay = ((FX.plan[1] || {})[FX.today] || "") === "Д";
  ok("ROLE: новый трек у опытного сотрудника — не «первый день»: табличка дня на месте" + (romanDay ? ", карточка «сейчас» (до дневной смены 2 ч)" : " (сегодня у Романа выходной — «сейчас» нет)"),
    !g.first && (romanDay ? g.mode === "before" && /Дальше:/.test(g.text) : g.mode === null && g.pills), JSON.stringify(g));
  await o.ctx.close();
}
{
  const o = await open({ profile: RA, storage: { ...ROMAN44(), __role: "spg" }, w: W6, h: H6, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(7, 0) });
  await dismissToasts(o.page);
  await o.page.evaluate(() => window.__saNav("roleSelect")); await sleep(1500);
  const g = await nowInfo(o.page);
  const t = await o.page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  ok("ROLE: в 7:00 (до смены 5 ч) — карточка трека «Начать» и плашки, как было", !g.first && !g.mode && g.pills && /Начать/.test(t), JSON.stringify(g));
  ok("ROLE: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("BEFORE")) {
  const o = await openHome({ storage: { __role: "seasonal", "sa_completed{uk}": DONE6, ...recent, "sa_sched_cache_main_{mkey}": cacheWith("В") }, fixedTime: at(13, 20) });
  let g = await nowInfo(o.page);
  ok("BEFORE: за 2 ч 40 мин до вечерней смены — «До смены 2 ч 40 мин», разминка", g.mode === "before" && g.tag === "До смены 2 ч 40 мин" && /Разминка перед сменой/.test(g.text) && /Начать/.test(g.text), JSON.stringify(g));
  ok("BEFORE: трек не пропал — строка «Дальше …» внизу карточки; плашек нет", g.next && /Дальше:/.test(g.text) && !g.pills, g.text);
  await shot(o.page, "before");
  await o.page.locator("[data-now-card]").click(); await sleep(1500);
  const warm = await o.page.evaluate(() => /Разминка до смены/.test(document.body.innerText));
  ok("BEFORE: тап — открылась разминка", warm);
  await o.page.keyboard.press("Escape").catch(() => {});
  await o.ctx.close();
  // «Дальше» — урок
  const q = await openHome({ storage: { __role: "seasonal", "sa_completed{uk}": DONE6, ...recent, "sa_sched_cache_main_{mkey}": cacheWith("В") }, fixedTime: at(13, 20) });
  await q.page.locator("[data-now-next]").click(); await sleep(1500);
  const t = await q.page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 300));
  ok("BEFORE: «Дальше» открывает следующий урок трека", /Shadow/.test(t) && !/До смены/i.test(t), t.slice(0, 120));
  ok("BEFORE: без ошибок", !q.errors.length, q.errors.join(" | "));
  await q.ctx.close();
}

if (want("DURING")) {
  // настоящие вопросы программы: выдуманные банк ошибок убирает сам (вопросов, которых нет в программе, не держит)
  const due = ALL_Q.slice(0, 2).map((x) => ({ ...x, stage: 0, due: 0, img: null, explanation: "", lessonTitle: "Тема", lessonId: "s0-2" }));
  const o = await openHome({ storage: { __role: "seasonal", "sa_completed{uk}": DONE6, ...recent, "sa_sched_cache_main_{mkey}": cacheWith("В"), "sa_mistakes{uk}": due }, fixedTime: at(19, 5) });
  let g = await nowInfo(o.page);
  ok("DURING: на смене — «На смене до 24:00», в перерыв повторить ошибки (2 вопроса ждут)", g.mode === "during" && g.tag === "На смене до 24:00" && /повтори ошибки/.test(g.text) && /2 вопроса ждут/.test(g.text), JSON.stringify(g));
  await shot(o.page, "during-mistakes");
  await o.page.locator("[data-now-card]").click(); await sleep(1300);
  ok("DURING: тап — «Работа над ошибками»", await o.page.evaluate(() => /Работа над ошибками/.test(document.body.innerText)));
  await o.ctx.close();
  const q = await openHome({ storage: { __role: "seasonal", "sa_completed{uk}": DONE6, ...recent, "sa_sched_cache_main_{mkey}": cacheWith("В") }, fixedTime: at(19, 5) });
  g = await nowInfo(q.page);
  ok("DURING: ошибок нет — «Если в зале жарко — SOS»", g.mode === "during" && /SOS/.test(g.text) && /Открыть/.test(g.text), JSON.stringify(g));
  await q.page.locator("[data-now-card]").click(); await sleep(1300);
  ok("DURING: тап — шпаргалка SOS", await q.page.evaluate(() => /SOS/.test(document.body.innerText) && !document.querySelector("[data-now-card]")));
  ok("DURING: без ошибок", !q.errors.length, q.errors.join(" | "));
  await q.ctx.close();
}

if (want("AFTER")) {
  const calls = [];
  const o = await openHome({ calls, storage: { __role: "seasonal", "sa_completed{uk}": DONE6, ...recent, "sa_sched_cache_main_{mkey}": cacheWith("У") }, fixedTime: at(19, 30), rpcs: schedRpcs(fxWith("У"), calls) });
  let g = await nowInfo(o.page);
  const faces = await o.page.locator("[data-now-moods] button").count();
  ok("AFTER: после утренней смены (до 18:00), в 19:30 — «Как прошла смена?», пять лиц", g.mode === "after" && /Как прошла смена/.test(g.text) && faces === 5, JSON.stringify(g));
  await shot(o.page, "after");
  await o.page.locator('[data-now-moods] button[aria-label="Хорошо"]').click(); await sleep(800);
  g = await nowInfo(o.page);
  const stored = await o.page.evaluate((k) => localStorage.getItem("sa_mood_" + k), TODAY6);
  const sent = calls.find((c) => c.fn === "save_mood");
  ok("AFTER: «Хорошо» — ответ «Хорошая смена ✦» и «Рассказать»; настрой записан (sa_mood) и ушёл на сервер (save_mood 4)", g.mode === "reply" && /Хорошая смена/.test(g.text) && /Рассказать/.test(g.text) && stored === "4" && sent && sent.body.p_mood === 4, JSON.stringify({ g: g.text, stored, sent: sent && sent.body }));
  await shot(o.page, "after-reply");
  await o.page.locator("[data-now-card]").click(); await sleep(1500);
  const chat = await o.page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  ok("AFTER: «Рассказать» — Наставник с готовым вопросом про смену", /хорошая смена/i.test(chat) && /Наставник/.test(chat), chat.slice(0, 160));
  await o.ctx.close();
  // «Не сейчас» — карточка трека; на списке трека «Как настрой сегодня?» уже «записан»
  const q = await openHome({ storage: { __role: "seasonal", "sa_completed{uk}": DONE6, ...recent, "sa_sched_cache_main_{mkey}": cacheWith("У") }, fixedTime: at(19, 30) , rpcs: schedRpcs(fxWith("У"), null) });
  await q.page.locator('[data-now-moods] button[aria-label="Тяжело"]').click(); await sleep(700);
  g = await nowInfo(q.page);
  ok("AFTER: «Тяжело» — «бывает», разбор спокойно", g.mode === "reply" && /Тяжёлая смена/.test(g.text) && /Разобрать/.test(g.text), g.text);
  await q.page.locator("[data-now-later]").click(); await sleep(700);
  g = await nowInfo(q.page);
  ok("AFTER: «Не сейчас» — снова карточка трека («Дальше»), вопрос больше не задаётся", !g.mode && /Дальше/.test(await q.page.evaluate(() => document.body.innerText)), JSON.stringify(g));
  await q.page.evaluate(() => window.__saNav("home")); await sleep(1500);
  await q.page.evaluate(() => { document.getElementById("root").scrollTop = 1e6; }); await sleep(600);
  ok("AFTER: на странице трека «Как настрой сегодня?» — уже «Настрой записан» (одна запись на день)", await q.page.evaluate(() => /Настрой записан/.test(document.body.innerText)));
  ok("AFTER: без ошибок", !q.errors.length, q.errors.join(" | "));
  await q.ctx.close();
}

if (want("BACK")) {
  const st = { __role: "seasonal", "sa_completed{uk}": DONE6, "sa_activity{uk}": { [ago6(6)]: { st: 2, l: 2 } }, "sa_last_open{uk}": ago6(6) };
  const o = await openHome({ storage: st, fixedTime: at(11, 0), rpcs: (fn, b) => (fn === "schedule_load" ? { ok: false, error: "auth" } : schedRpcs(FX, null)(fn, b)) });
  let g = await nowInfo(o.page);
  ok("BACK: 6 дней без занятий и заходов — «С возвращением, Анна», «Освежим за 2 минуты»", /^С возвращением, Анна/.test(g.hello) && g.mode === "back" && /Освежим за 2 минуты/.test(g.text), JSON.stringify(g));
  await shot(o.page, "back");
  await o.page.reload({ waitUntil: "load" }); await sleep(2500); await dismissToasts(o.page);
  await o.page.evaluate(() => window.__saNav("roleSelect")); await sleep(1200);
  g = await nowInfo(o.page);
  ok("BACK: перезашёл в тот же день — приветствие держится", /^С возвращением/.test(g.hello) && g.mode === "back", JSON.stringify(g));
  await o.page.locator("[data-now-card]").click(); await sleep(1500);
  ok("BACK: тап — разминка по пройденному", await o.page.evaluate(() => /Разминка/.test(document.body.innerText)));
  await o.ctx.close();
  const q = await openHome({ storage: { ...st, "sa_last_open{uk}": ago6(1) }, fixedTime: at(11, 0), rpcs: (fn, b) => (fn === "schedule_load" ? { ok: false, error: "auth" } : schedRpcs(FX, null)(fn, b)) });
  g = await nowInfo(q.page);
  ok("BACK: заходил вчера (просто не учился) — без «С возвращением»", !/С возвращением/.test(g.hello) && g.mode !== "back", JSON.stringify(g));
  ok("BACK: без ошибок", !q.errors.length, q.errors.join(" | "));
  await q.ctx.close();
}

if (want("NONE")) {
  const o = await openHome({ storage: { __role: "seasonal", "sa_completed{uk}": DONE6, ...recent }, fixedTime: at(14, 20), rpcs: (fn, b) => (fn === "schedule_load" ? { ok: false, error: "auth" } : schedRpcs(FX, null)(fn, b)) });
  const g = await nowInfo(o.page);
  const t = await o.page.evaluate(() => document.body.innerText);
  ok("NONE: графика нет — главная как была: карточка трека «Дальше» и плашки", !g.mode && /Дальше/.test(t) && g.pills && !g.first, JSON.stringify(g));
  ok("NONE: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("LIGHT")) {
  const o = await openHome({ light: true, storage: { __role: "seasonal", "sa_completed{uk}": DONE6, ...recent, "sa_sched_cache_main_{mkey}": cacheWith("В") }, fixedTime: at(13, 20) });
  const g = await nowInfo(o.page);
  const col = await o.page.evaluate(() => { const t = document.querySelector("[data-now-title]"); return t ? getComputedStyle(t).color : ""; });
  ok("LIGHT: «Для чтения» — карточка «сейчас» на месте, заголовок тёмный", g.mode === "before" && /rgb\((\d+), (\d+), (\d+)\)/.test(col) && col.match(/\d+/g).slice(0, 3).every((v) => +v < 120), JSON.stringify({ mode: g.mode, col }));
  await shot(o.page, "light-before");
  await o.ctx.close();
}

if (want("WIDE")) {
  for (const [nm, w, h, mobile] of [["land", 844, 390, true], ["desk", 1440, 900, false]]) {
    const o = await open({ profile: prof, w, h, mobile, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(13, 20), storage: { __role: "seasonal", "sa_completed{uk}": DONE6, ...recent, "sa_sched_cache_main_{mkey}": cacheWith("В") } });
    await dismissToasts(o.page);
    await o.page.evaluate(() => window.__saNav("roleSelect")); await sleep(1500);
    const g = await nowInfo(o.page);
    const fit = await o.page.evaluate(() => { const c = document.querySelector("[data-now-card]"); if (!c) return null; const b = c.getBoundingClientRect(), col = document.querySelector(".sa-col").getBoundingClientRect(); return b.left >= col.left - 1 && b.right <= col.right + 1; });
    ok("WIDE: " + nm + " — карточка «сейчас» в колонке, без прокрутки вбок, логотип " + (nm === "land" ? "118×94 (как был)" : "152×121"), g.mode === "before" && fit && g.over <= 1 && (nm === "land" ? g.logo && g.logo[0] === 118 : g.logo && g.logo[0] === 152), JSON.stringify({ mode: g.mode, fit, over: g.over, logo: g.logo }));
    await shot(o.page, "wide-" + nm);
    ok("WIDE: " + nm + " — без ошибок", !o.errors.length, o.errors.join(" | "));
    await o.ctx.close();
  }
}

if (want("TG")) {
  const o = await openHome({ telegram: true, storage: { __role: "seasonal", "sa_completed{uk}": DONE6, ...recent, "sa_sched_cache_main_{mkey}": cacheWith("В") }, fixedTime: at(19, 5) });
  const g = await nowInfo(o.page);
  ok("TG: в Telegram — «на смене», без ошибок", g.mode === "during" && !o.errors.length, JSON.stringify(g) + " " + o.errors.join(" | "));
  await o.ctx.close();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - fails} из ${results.length}`);
await browser.close(); server.close();
