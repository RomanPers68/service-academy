// wide-walk (v50, Доп. 363): обход экранов в портрете / горизонтали / на компьютере. Голова — из e2e-v49.
// e2e v49 (Доп. 362): график руководителя. PICK — лист смены подсказывает до выбора (у каждой смены «подходит · станет
// N из M ч» или причина; капсулы: покрытие позиции в этот день, пожелания; «Кто может выйти в этот день ›»; «Выходной» —
// «в позиции станет …»). DAY — тап по числу: день по часам (силуэт «людей в зале», полосы по позициям, дыры с «Кто может
// выйти?», тап по человеку — его смена, заметка, картинка дня; «Сегодня по часам»). STRIP — месяц полоской, «‹ неделя ›»,
// «неделя / месяц»; строки про месяц ушли из «Сегодня». WEEK — неделя во всю высоту, числа прилипают, влезает на 393/360/320.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v49.mjs [разделы]
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
async function open({ fresh = false, noToken = false, mobile = true, dsf = 2, storage = {}, telegram = false, light = false, w = 390, h = 844, url = "/", schedule = null, fixedTime = null, chat = [], rpcs = null, profile = prof, calls = [], ai = "guest", tts = null, ttsCalls = [], stream = false, assistant = null, motion = "no-preference", clockInstall = null, colorScheme = "dark" }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", locale: "ru-RU", reducedMotion: motion, colorScheme });
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
  if (!fresh) for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  if (fresh) { delete seed.sa_welcome_seen_v11; delete seed.sa_hint_mistakes; delete seed.sa_mode_hint; delete seed.sa_quest_open; delete seed.sa_sfx; }
  if (noToken) { delete seed.sa_session_token; delete seed.sa_profile; }
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



// ════════════════════════════ v50: сценарии со слоями (уроки, разминка, радио, листы графика…) ════════════════════════════
// WALK_VP=land,desk · WALK_ONLY=… — имена сценариев
const VPS = { port: { w: 393, h: 852, mobile: true }, land: { w: 844, h: 390, mobile: true }, desk: { w: 1440, h: 900, mobile: false },
  tab: { w: 820, h: 1180, mobile: true }, se: { w: 667, h: 375, mobile: true }, lpro: { w: 932, h: 430, mobile: true }, lap: { w: 1280, h: 720, mobile: false } };
const vpList = (process.env.WALK_VP || "land,desk").split(",");
const onlyScr = (process.env.WALK_ONLY || "").split(",").filter(Boolean);
const QUIET = { "sa_mastery{uk}": { tiers: Object.fromEntries(["track","tests","table","dialogue","fresh","gold","warmup","radio","guest","fixes","decks","streak","quest","hall"].map((k) => [k, 3])), fw: true, master: {} } };
const dismissToasts = async (page) => { for (let i = 0, quiet = 0; i < 24 && quiet < 3; i++) {
  const x = page.locator('[data-ms-toast] button[aria-label="Закрыть"]');
  if (await x.count()) { await x.first().click().catch(() => {}); quiet = 0; } else quiet++;
  await sleep(350); } };
const geo = (page) => page.evaluate(() => {
  const iw = innerWidth, ih = innerHeight, bad = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest(".sa-hscroll, .sa-schedgrid, svg, [aria-hidden='true']")) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    if (r.right > iw + 1.5 || r.left < -1.5) { const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (own || el.tagName === "BUTTON") bad.push((el.textContent || "").trim().slice(0, 18) + "@" + Math.round(r.left) + "→" + Math.round(r.right)); }
  }
  return { out: bad.slice(0, 5), outN: bad.length };
});
// ════════════════════════════ v52: экраны компьютера — сценарии ════════════════════════════
const CMS = [
  { id: "c1", role: "seasonal", module: "Наше вино", title: "Белые по бокалам", content: "**Что наливаем**\nШардоне, Совиньон блан, Рислинг.\n\n- Шардоне — к рыбе и курице\n- Совиньон — к салатам и козьему сыру\n- Рислинг — к острому", questions: [{ q: "Что к острому?", options: ["Рислинг", "Шардоне"], correct: 0 }], sort: 1 },
  { id: "c2", role: "seasonal", module: "Наше вино", title: "Красные по бокалам", content: "Пино нуар и Мальбек. Пино — к утке, Мальбек — к стейку.", questions: [], sort: 2 },
  { id: "c3", role: "seasonal", module: "Стандарты зала", title: "Сервировка банкета", content: "Приборы — в 1 см от края стола.", questions: [], sort: 1 },
  { id: "c4", role: "bar", module: "Барные заготовки", title: "Сиропы", content: "Сахарный сироп 1:1, хранить до 14 дней в холоде.", questions: [], sort: 1 },
];
const cmsRpcs = (fn, body) => fn === "cms_list_lessons" ? CMS : schedRpcs(FX, null)(fn, body);
const fillEditor = async (p) => {
  await p.locator("text=Новый урок").first().click(); await sleep(1200);
  await p.locator('input[placeholder^="Напр. «Базовые"]').fill("Подача игристого");
  await p.locator("textarea").first().fill("**Температура**\nИгристое подаём охлаждённым до 6–8 °C.\n\n- Бутылку держим за донышко\n- Пробку выпускаем с тихим вздохом, без хлопка\n- Наливаем в два приёма, по стенке бокала\n\n**Бокал**\nФлюте или тюльпан — пузырьки держатся дольше.");
  await sleep(500);
};


// ════════════════════════════ v59 (Доп. 372): что заметил на обходе ════════════════════════════
// ═══════════════════════════ v61 (Доп. 374): ряд треков под свёрнутым списком ═══════════════════════════
// v64 (Доп. 377): ряд не перестраивается — кружки на местах, панель трека под рядом (язычок к кружку), компактная;
// страница едет вместе с панелью; Наставник — круг посередине нижнего меню (плавающей кнопки нет).
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v61.mjs [ROW TAP MOTION HINT MORE LIGHT WIDE AI]
const ANNA = { ...prof, id: "u-new", name: "Анна", surname: "Новикова", position: "waiter", is_admin: false };
const RA9 = { ...prof, id: "u-own", name: "Роман", surname: "Смирнов", position: "manager", is_admin: true };
const W = 393, H = 852;
const MET = {};   // v62: отметки первого захода больше нет (подсказка вместо раскрытой карточки)
const rowState = (p) => p.evaluate(() => {
  const row = document.querySelector("[data-tracks-row]"); const r = row ? row.getBoundingClientRect() : null;
  const chips = [...document.querySelectorAll("[data-track-chip]")].map((b) => { const q = b.getBoundingClientRect(); return { id: b.getAttribute("data-track-chip"), l: Math.round(q.left), r: Math.round(q.right), w: Math.round(q.width), t: Math.round(q.top), cx: Math.round(q.left + q.width / 2), cy: Math.round((q.top - (r ? r.top : 0)) + q.height / 2), b: Math.round(q.bottom), locked: b.hasAttribute("data-track-locked"), sel: b.hasAttribute("data-track-sel") }; });
  const open = document.querySelector("[data-track-open]"); const panel = document.querySelector("[data-track-panel]"); const notch = document.querySelector("[data-track-notch]");
  const pr = panel ? panel.getBoundingClientRect() : null, nr = notch ? notch.getBoundingClientRect() : null;
  return { row: !!row, rowL: r ? Math.round(r.left) : null, rowR: r ? Math.round(r.right) : null, chips, open: open ? open.getAttribute("data-track-open") : null,
    openText: panel ? panel.innerText.replace(/\s+/g, " ").trim() : "", panelTop: pr ? Math.round(pr.top) : null, panelH: pr ? Math.round(pr.height) : null, notchX: nr ? Math.round(nr.left + nr.width / 2) : null,
    pct: [...document.querySelectorAll("[data-track-pct]")].map((e) => e.innerText),
    toggle: document.querySelector("[data-tracks-toggle]")?.innerText.replace(/\s+/g, " "), list: !!document.querySelector("[data-tracks-list]"), quote: !!document.querySelector("[data-tracks-quote]") };
});
// тап пальцем в центр элемента (а не locator.click: тот, если точку что-то закрыло, сам прокручивает страницу —
// в том числе вбок, — чего палец не делает). Точка закрыта чужим элементом — ошибка теста, а не тихий промах.
const tap = async (p, sel) => {
  const c = await p.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return { err: "нет " + sel };
    const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y);
    return { x, y, ok: !!hit && (hit === el || el.contains(hit)), hit: hit ? hit.tagName + "." + String(hit.className).slice(0, 30) : null }; }, sel);
  if (c.err || !c.ok) throw new Error("тап мимо " + sel + ": " + JSON.stringify(c));
  await p.mouse.click(c.x, c.y);
};
// кружки на своих местах: центры (относительно ряда) те же, что до тапа
const samePlaces = (a, b) => a.chips.length === 6 && b.chips.length === 6 && a.chips.every((c, i) => c.id === b.chips[i].id && Math.abs(c.cx - b.chips[i].cx) <= 1 && Math.abs(c.cy - b.chips[i].cy) <= 1);

if (want("ROW")) {
  const o = await open({ profile: ANNA, storage: { ...ROMAN44(), ...MET, __role: "seasonal" }, w: W, h: H, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  const p = o.page; await sleep(1500); await dismissToasts(p);
  const s = await rowState(p);
  const ws = s.chips.map((c) => c.w);
  ok("ROW: шесть узлов в ряд, одного размера, ровно по ширине ряда (первый у левого края, последний у правого), панель не раскрыта",
    s.row && s.chips.length === 6 && !s.open && Math.max(...ws) - Math.min(...ws) <= 1 && Math.abs(s.chips[0].l - s.rowL) <= 1 && Math.abs(s.chips[5].r - s.rowR) <= 1 && new Set(s.chips.map((c) => c.t)).size === 1,
    JSON.stringify({ n: s.chips.length, ws, l: [s.chips[0].l, s.rowL], r: [s.chips[5].r, s.rowR] }));
  ok("ROW: узлы крупные — 52 px на телефоне 393 (ряду больше не нужно уступать кнопке AI)", ws[0] >= 50, ws[0] + " px");
  ok("ROW: у Анны-официанта три трека закрыты (Ядро, Менеджер, Сервис-менеджер) — с замком", s.chips.filter((c) => c.locked).map((c) => c.id).join(",") === "core,manager,service_manager", JSON.stringify(s.chips.filter((c) => c.locked).map((c) => c.id)));
  const rowText = await p.evaluate(() => document.querySelector("[data-tracks-row]").innerText);
  ok("ROW: плашка процента — только у начатых треков (Новичок 14 %), слова «сейчас» нет", s.pct.length === 1 && /14/.test(s.pct[0]) && !/сейчас/i.test(rowText), JSON.stringify(s.pct));
  ok("ROW: строка над рядом — «Треки обучения · подробнее», девиз внизу на месте", /подробнее/.test(s.toggle || "") && s.quote && !s.list, s.toggle);
  const styles = await p.evaluate(() => { const el = document.querySelector('[data-track-chip="seasonal"] span > span[aria-hidden]'); const cs = el ? getComputedStyle(el) : null; return cs ? { bg: cs.backgroundImage, bf: cs.backdropFilter || cs.webkitBackdropFilter } : null; });
  ok("ROW: стекло плоское — без радиального блика, с размытием фона (как кнопка AI)", !!styles && !/radial/.test(styles.bg) && /blur/.test(styles.bf || ""), JSON.stringify(styles));
  await shot(p, "row-rest");
  await o.ctx.close();
}

if (want("TAP")) {
  const o = await open({ profile: ANNA, storage: { ...ROMAN44(), ...QUIET, __role: "seasonal" }, w: W, h: H, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  const p = o.page; await sleep(1500); await dismissToasts(p);
  const before = await rowState(p);
  await tap(p, '[data-track-chip="spg"]'); await sleep(800);
  let s = await rowState(p);
  const spg = s.chips.find((c) => c.id === "spg");
  ok("TAP: тап по «Хостес» — кружки остаются на своих местах (ничего не подменяется), «Хостес» выделен", s.open === "spg" && samePlaces(before, s) && spg.sel && s.chips.filter((c) => c.sel).length === 1,
    JSON.stringify({ open: s.open, same: samePlaces(before, s), sel: s.chips.filter((c) => c.sel).map((c) => c.id) }));
  ok("TAP: панель — под рядом, язычок указывает на выбранный кружок", s.panelTop > Math.max(...s.chips.map((c) => c.b)) && Math.abs(s.notchX - spg.cx) <= 3, JSON.stringify({ top: s.panelTop, bottom: Math.max(...s.chips.map((c) => c.b)), notch: s.notchX, cx: spg.cx }));
  ok("TAP: компактная панель — три строки: «Хостес · Служба приёма гостей», описание, «Приём гостей · не начат · Открыть ›»",
    /Хостес/.test(s.openText) && /Служба приёма гостей/.test(s.openText) && /От хостес до амбассадора/.test(s.openText) && /Приём гостей/i.test(s.openText) && /не начат/.test(s.openText) && /Открыть ›/.test(s.openText) && s.panelH <= 92,
    JSON.stringify({ h: s.panelH, t: s.openText.slice(0, 140) }));
  const lines = await p.evaluate(() => { const pn = document.querySelector("[data-track-panel] .sa-panel-in"); return pn ? [...pn.children].map((c) => Math.round(c.getBoundingClientRect().height)) : []; });
  ok("TAP: каждая строка панели — в одну строку (описание не переносится)", lines.length === 3 && lines.every((h) => h <= 24), JSON.stringify(lines));
  await shot(p, "row-open");
  await tap(p, '[data-track-chip="bar"]'); await sleep(800);
  s = await rowState(p);
  const bar = s.chips.find((c) => c.id === "bar");
  ok("TAP: тап по другому кружку — панель сменилась на «Бар», язычок переехал, кружки на местах", s.open === "bar" && /Бар/.test(s.openText) && Math.abs(s.notchX - bar.cx) <= 3 && samePlaces(before, s) && bar.sel && !s.chips.find((c) => c.id === "spg").sel,
    JSON.stringify({ open: s.open, notch: s.notchX, cx: bar.cx }));
  await tap(p, '[data-track-chip="core"]'); await sleep(800);
  s = await rowState(p);
  ok("TAP: закрытый «Ядро» — «Ступень 2/4», замок и «Пройди «Новичок», чтобы открыть», без «Открыть ›»", s.open === "core" && /Пройди «Новичок», чтобы открыть/.test(s.openText) && /Ступень 2\/4/i.test(s.openText) && !/Открыть ›/.test(s.openText), s.openText.slice(0, 140));
  await shot(p, "row-locked");
  await tap(p, "[data-track-panel]"); await sleep(600);
  s = await rowState(p);
  ok("TAP: тап по панели закрытого трека — ничего не открывает (ряд на месте)", s.open === "core" && s.row, JSON.stringify({ open: s.open, row: s.row }));
  await tap(p, '[data-track-chip="core"]'); await sleep(800);
  s = await rowState(p);
  ok("TAP: повторный тап по выбранному кружку — панель свернулась, выделения нет", !s.open && s.chips.length === 6 && !s.chips.some((c) => c.sel), JSON.stringify({ open: s.open }));
  await tap(p, '[data-track-chip="seasonal"]'); await sleep(800);
  s = await rowState(p);
  ok("TAP: свой «Новичок» — метка «твой», «Ступень 1/4», 14 %", s.open === "seasonal" && /твой/i.test(s.openText) && /Ступень 1\/4/i.test(s.openText) && /14%/.test(s.openText), s.openText.slice(0, 140));
  await tap(p, "[data-track-close]"); await sleep(800);
  s = await rowState(p);
  ok("TAP: «×» — панель свернулась, шесть кружков на местах", !s.open && samePlaces(before, s), JSON.stringify({ open: s.open, b: before.chips.map((c) => [c.cx, c.cy]), a: s.chips.map((c) => [c.cx, c.cy]) }));
  await tap(p, '[data-track-chip="spg"]'); await sleep(700);
  await tap(p, "[data-track-panel]"); await sleep(1400);
  const t2 = await p.evaluate(() => ({ hub: !!document.querySelector("[data-tracks-title]"), head: document.body.innerText.slice(0, 160).replace(/\s+/g, " ") }));
  ok("TAP: тап по панели открытого трека — открылся трек «Хостес»", !t2.hub && /Хостес/.test(t2.head), t2.head.slice(0, 80));
  ok("TAP: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("MOTION")) {
  // страница у нижнего края: при раскрытии поднимается вместе с панелью (не после), при сворачивании опускается
  // вместе с ней и не дёргается, когда панель убирается; кружки во время движения не сдвигаются относительно ряда
  const o = await open({ profile: ANNA, storage: { ...ROMAN44(), ...QUIET, __role: "seasonal" }, w: W, h: H, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(23, 25) });
  const p = o.page; await sleep(1500); await dismissToasts(p);
  await p.mouse.move(200, 500); await p.mouse.wheel(0, 3000); await sleep(900);
  const rec = () => p.evaluate(() => {
    const row = document.querySelector("[data-tracks-row]");
    let sc = row.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    sc = sc || document.scrollingElement;
    window.__mv = []; const t0 = performance.now();
    const tick = () => { const pn = document.querySelector("[data-track-open]"), ch = document.getElementById("sa-orb-bar");
      window.__mv.push({ t: Math.round(performance.now() - t0), s: Math.round(sc.scrollTop * 10) / 10, h: pn ? Math.round(pn.getBoundingClientRect().height) : null, dy: Math.round(ch.getBoundingClientRect().top - row.getBoundingClientRect().top) });
      if (performance.now() - t0 < 900) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await rec(); await tap(p, '[data-track-chip="spg"]'); await sleep(1100);
  const op = await p.evaluate(() => window.__mv);
  const s0 = op[0].s, hEnd = op[op.length - 1].h, sEnd = op[op.length - 1].s;
  const firstMove = op.find((f) => f.s > s0 + 0.5);
  ok("MOTION: раскрытие у нижнего края — страница начинает подниматься, пока панель ещё растёт, и встаёт, когда панель раскрылась",
    sEnd > s0 && !!firstMove && firstMove.h !== null && firstMove.h < hEnd - 10 && op.filter((f) => f.h === hEnd).every((f, i, arr) => i === 0 || Math.abs(f.s - arr[0].s) <= 1 || f.s >= arr[i - 1].s),
    JSON.stringify({ s0, sEnd, firstMove, hEnd }));
  ok("MOTION: кружки во время раскрытия не двигаются относительно ряда", new Set(op.map((f) => f.dy)).size === 1, JSON.stringify([...new Set(op.map((f) => f.dy))]));
  await rec(); await tap(p, '[data-track-chip="spg"]'); await sleep(1100);
  const cl = await p.evaluate(() => window.__mv);
  const withPanel = cl.filter((f) => f.h !== null), after = cl.filter((f) => f.h === null);
  const lastP = withPanel[withPanel.length - 1], firstA = after[0];
  const jumps = cl.slice(1).map((f, i) => Math.abs(f.s - cl[i].s));
  ok("MOTION: сворачивание — страница опускается вместе с панелью: когда панель убралась, прокрутка уже на месте (без рывка после)",
    !!lastP && !!firstA && Math.abs(firstA.s - lastP.s) <= 1 && Math.max(...jumps) <= 8 && cl[0].s > firstA.s,
    JSON.stringify({ start: cl[0].s, lastP, firstA, maxJump: Math.max(...jumps), seq: cl.map((f) => f.s + "/" + f.h).join(" ") }));
  ok("MOTION: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("HINT")) {
  // v62: первый вход — подсказка у своего кружка; v63: не системный пузырь, а ярлычок над кружком с хвостиком,
  // кружок «дышит» золотом; тап по ярлычку или кружку открывает карточку и убирает подсказку. Стенд помечает все
  // подсказки v5 прочитанными — track_orb снимаем отдельно (бывалый пользователь после обновления).
  const o = await open({ profile: ANNA, storage: { ...ROMAN44(), __role: "seasonal", sa_hint_v5_track_orb: "0" }, w: W, h: H, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  const p = o.page; await sleep(2200); await dismissToasts(p);
  const hs = () => p.evaluate(() => {
    const tag = document.querySelector('[data-track-nudge="tag"]'); const t = tag ? tag.getBoundingClientRect() : null;
    const title = document.querySelector("[data-tracks-title]")?.getBoundingClientRect(); const orb = document.getElementById("sa-orb-seasonal")?.getBoundingClientRect();
    const disc = document.querySelector("#sa-orb-seasonal .sa-orb-nudge");
    return { tag: !!tag, text: tag ? tag.innerText.replace(/\s+/g, " ") : "", key: localStorage.getItem("sa_hint_v5_track_orb"), open: document.querySelector("[data-track-open]")?.getAttribute("data-track-open") || null,
      dim: !![...document.querySelectorAll("div")].find((d) => /9999px/.test(getComputedStyle(d).boxShadow)), breathe: !!disc,
      clearOfTitle: t && title ? t.top >= title.bottom - 1 : null, aboveOrb: t && orb ? t.bottom <= orb.top + 2 : null, inRow: t ? t.left >= 0 && t.right <= innerWidth : null };
  });
  let s = await hs();
  ok("HINT: бывалый после обновления — над своим кружком ярлычок «Твоя роль. Тапни», без затемнения, кружок дышит, карточка не раскрыта", s.tag && /Твоя роль\. Тапни/.test(s.text) && !s.dim && s.breathe && !s.open && s.key !== "1", JSON.stringify(s));
  ok("HINT: ярлычок стоит над кружком, не закрывает строку «Треки обучения» и не выходит за экран", s.clearOfTitle && s.aboveOrb && s.inRow, JSON.stringify({ c: s.clearOfTitle, a: s.aboveOrb, r: s.inRow }));
  await shot(p, "hint-tag");
  await p.locator('[data-track-nudge="tag"]').click(); await sleep(900);
  s = await hs();
  ok("HINT: тап по ярлычку — подсказка ушла и запомнена, карточка трека открылась", !s.tag && s.key === "1" && s.open === "seasonal", JSON.stringify(s));
  await p.reload({ waitUntil: "load" }); await sleep(2000); await dismissToasts(p);
  s = await hs();
  ok("HINT: следующий заход — ярлычка нет, ряд свёрнут", !s.tag && !s.open, JSON.stringify(s));
  await o.ctx.close();
  // тап по самому кружку — тоже закрывает подсказку
  const o2 = await open({ profile: ANNA, storage: { ...ROMAN44(), __role: "seasonal", sa_hint_v5_track_orb: "0" }, w: W, h: H, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  await sleep(2200); await dismissToasts(o2.page);
  await o2.page.locator('[data-track-chip="seasonal"]').click(); await sleep(900);
  const s2 = await o2.page.evaluate(() => ({ tag: !!document.querySelector('[data-track-nudge="tag"]'), open: document.querySelector("[data-track-open]")?.getAttribute("data-track-open") || null, key: localStorage.getItem("sa_hint_v5_track_orb") }));
  ok("HINT: тап по кружку — то же: карточка открыта, подсказка запомнена", !s2.tag && s2.open === "seasonal" && s2.key === "1", JSON.stringify(s2));
  await o2.ctx.close();
  // ушёл с главной, не тапнув (ярлычок постоял ≥ 4 с) — больше не навязываемся
  const o3 = await open({ profile: ANNA, storage: { ...ROMAN44(), __role: "seasonal", sa_hint_v5_track_orb: "0" }, w: W, h: H, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  await sleep(4600); await o3.page.evaluate(() => window.__saNav("shift")); await sleep(800);
  const k3 = await o3.page.evaluate(() => localStorage.getItem("sa_hint_v5_track_orb"));
  ok("HINT: ушёл с главной, не тапнув, — подсказка считается показанной", k3 === "1", String(k3));
  await o3.ctx.close();
  // новая хостес (трек по должности): сначала тур главной, сразу за ним — ярлычок у кружка «Хостес»
  const HOST = { ...prof, id: "u-host", name: "Лена", surname: "Иванова", position: "hostess", is_admin: false };
  const h = await open({ profile: HOST, storage: { __role: null }, fresh: true, w: W, h: H, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  await sleep(3000);
  let steps = 0;
  for (let i = 0; i < 8; i++) {
    if (await h.page.evaluate(() => !!document.querySelector('[data-track-nudge="tag"]'))) break;
    const nxt = h.page.locator("button", { hasText: /^(Дальше|Понятно|Начать|Готово)$/ }).first();
    if (await nxt.count()) { await nxt.click(); steps++; await sleep(700); } else break;
  }
  const hh = await h.page.evaluate(() => { const tag = document.querySelector('[data-track-nudge="tag"]'); const orb = document.getElementById("sa-orb-spg"); const t = tag?.getBoundingClientRect(), r = orb?.getBoundingClientRect();
    return { tag: !!tag, orb: !!orb, open: document.querySelector("[data-track-open]")?.getAttribute("data-track-open") || null, overOrb: t && r ? Math.abs((t.left + t.width / 2) - (r.left + r.width / 2)) < 90 : null }; });
  ok("HINT: новая хостес — после тура главной ярлычок стоит над кружком «Хостес» (трек по должности), карточка не навязана", hh.tag && hh.orb && !hh.open && hh.overOrb && steps >= 1, JSON.stringify({ ...hh, steps }));
  await shot(h.page, "hint-fresh-hostess");
  await h.ctx.close();
}

if (want("MORE")) {
  const o = await open({ profile: ANNA, storage: { ...ROMAN44(), ...MET, __role: "seasonal" }, w: W, h: H, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  const p = o.page; await sleep(1500); await dismissToasts(p);
  await p.locator("[data-tracks-toggle]").click(); await sleep(700);
  let s = await rowState(p);
  ok("MORE: «подробнее» — полный список с описаниями, ряд спрятан, строка говорит «Свернуть»", s.list && !s.row && /Свернуть/.test(s.toggle || ""), JSON.stringify({ list: s.list, row: s.row, toggle: s.toggle }));
  await p.locator("[data-tracks-toggle]").click(); await sleep(700);
  s = await rowState(p);
  ok("MORE: «Свернуть» — ряд вернулся", s.row && !s.list && s.chips.length === 6, JSON.stringify({ row: s.row, n: s.chips.length }));
  await o.ctx.close();
}

if (want("LIGHT")) {
  const l = await open({ light: true, profile: ANNA, storage: { ...ROMAN44(), ...MET, __role: "seasonal" }, w: W, h: H, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  const p = l.page; await sleep(1500); await dismissToasts(p);
  await p.locator('[data-track-chip="spg"]').click(); await sleep(800);
  const s = await rowState(p);
  ok("LIGHT: «Для чтения» — ряд и панель на месте, без ошибок", s.row && s.open === "spg" && s.chips.length === 6 && /Хостес/.test(s.openText) && !l.errors.length, JSON.stringify({ open: s.open, n: s.chips.length, err: l.errors.length }));
  await shot(p, "row-light");
  await l.ctx.close();
  // «спокойный режим» — без анимаций, но всё работает
  const c = await open({ profile: ANNA, storage: { ...ROMAN44(), ...MET, __role: "seasonal" }, w: W, h: H, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20), motion: "reduce" });
  await sleep(1500); await dismissToasts(c.page);
  await c.page.locator('[data-track-chip="bar"]').click(); await sleep(60);
  const cs = await rowState(c.page);
  await sleep(600);
  const cs2 = await rowState(c.page);
  ok("LIGHT: «уменьшить движение» — панель сразу в полный рост, без анимации", cs.open === "bar" && cs.panelH === cs2.panelH && cs.chips.length === 6 && !c.errors.length, JSON.stringify({ open: cs.open, h: [cs.panelH, cs2.panelH] }));
  await c.page.locator('[data-track-chip="bar"]').click(); await sleep(80);
  const cs3 = await rowState(c.page);
  ok("LIGHT: «уменьшить движение» — свернулась сразу", !cs3.open, JSON.stringify({ open: cs3.open }));
  await c.ctx.close();
}

if (want("WIDE")) {
  const o = await open({ profile: ANNA, storage: { ...ROMAN44(), ...MET, __role: "seasonal" }, w: 1440, h: 900, dsf: 1, mobile: false, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  await sleep(1500); await dismissToasts(o.page);
  const s = await o.page.evaluate(() => ({ row: !!document.querySelector("[data-tracks-row]"), list: !!document.querySelector("[data-tracks-list]"), two: !!document.querySelector("[data-home2-title]"),
    rail: !!document.querySelector("[data-rail-ai]"), tabAi: !!document.querySelector("[data-tab-ai]"), fab: !!document.querySelector(".sa-fab") }));
  ok("WIDE: компьютер — ряда нет, список треков в правой колонке, как был", !s.row && s.list && s.two, JSON.stringify(s));
  ok("WIDE: компьютер — Наставник в меню слева, как был; в нижнем меню и плавающей кнопки нет", s.rail && !s.tabAi && !s.fab, JSON.stringify(s));
  await o.ctx.close();
  // узкий телефон 360 — шесть узлов по-прежнему в один ряд
  const n = await open({ profile: ANNA, storage: { ...ROMAN44(), ...MET, __role: "seasonal" }, w: 360, h: 780, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  await sleep(1500); await dismissToasts(n.page);
  const ns = await rowState(n.page);
  ok("WIDE: узкий телефон 360 — шесть узлов в один ряд во всю ширину", ns.chips.length === 6 && new Set(ns.chips.map((c) => c.t)).size === 1 && Math.abs(ns.chips[5].r - ns.rowR) <= 1 && ns.chips[0].w >= 44, JSON.stringify({ n: ns.chips.length, w: ns.chips[0].w }));
  await n.page.locator('[data-track-chip="bar"]').click(); await sleep(800);
  const nb = await rowState(n.page);
  const lines = await n.page.evaluate(() => { const pn = document.querySelector("[data-track-panel] .sa-panel-in"); return pn ? [...pn.children].map((c) => Math.round(c.getBoundingClientRect().height)) : []; });
  ok("WIDE: 360 — панель «Бар» влезает: три строки, ничего не переносится", nb.open === "bar" && lines.length === 3 && lines.every((h) => h <= 24), JSON.stringify(lines));
  await shot(n.page, "row-360");
  await n.ctx.close();
}

if (want("AI")) {
  // v64: Наставник — круг посередине нижнего меню (между «Сменой» и «Командой»); плавающей кнопки нет
  const BAR = { ...prof, id: "u-bar", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "bartender", is_admin: true };
  const o = await open({ profile: BAR, storage: { ...ROMAN44(), ...MET, __role: "bar" }, w: W, h: H, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  const p = o.page; await sleep(2200); await dismissToasts(p);
  const st = () => p.evaluate(() => {
    const ai = document.querySelector("[data-tab-ai]")?.getBoundingClientRect(); const bar = document.getElementById("sa-tabbar")?.getBoundingClientRect();
    const labels = [...document.querySelectorAll("#sa-tabbar [role=button][aria-label]")].map((b) => { const q = b.getBoundingClientRect(); return { l: b.getAttribute("aria-label"), x: Math.round(q.left + q.width / 2) }; }).sort((a, b) => a.x - b.x).map((x) => x.l);
    const row = document.querySelector("[data-tracks-row]");
    return { fab: !!document.querySelector(".sa-fab"), ai: !!ai, aiCx: ai ? Math.round(ai.left + ai.width / 2) : null, barCx: bar ? Math.round(bar.left + bar.width / 2) : null, labels,
      pulse: !!document.querySelector("[data-ai-pulse]"), shy: document.documentElement.classList.contains("sa-fab-shy"), avoid: row?.getAttribute("data-tracks-avoid") || null, seen: localStorage.getItem("sa_ai_fab") };
  });
  let s = await st();
  ok("AI: плавающей кнопки нет; круг AI — посередине нижнего меню", !s.fab && s.ai && Math.abs(s.aiCx - s.barCx) <= 6, JSON.stringify(s));
  ok("AI: порядок — Учусь, Смена, AI, Команда, Я", s.labels.join(",") === "Учусь,Смена,AI-наставник,Команда,Я", s.labels.join(","));
  ok("AI: ряду треков ничего не мешает — «ушка» и уступки нет", !s.shy && !s.avoid, JSON.stringify({ shy: s.shy, avoid: s.avoid }));
  await shot(p, "ai-center");
  await p.locator("[data-tab-ai]").click(); await sleep(1400);
  const aiText = await p.evaluate(() => document.body.innerText.slice(0, 400).replace(/\s+/g, " "));
  const aiOpen = await p.evaluate(() => !document.querySelector("[data-tracks-row]"));
  ok("AI: тап по кругу открывает AI-наставника", aiOpen && /Наставник|наставник|AI/.test(aiText), aiText.slice(0, 80));
  await o.ctx.close();
  // новичок: пульс «ещё не открывали» — на круге; после первого открытия — пропадает
  const n = await open({ profile: ANNA, storage: { ...ROMAN44(), ...MET, __role: "seasonal" }, w: W, h: H, dsf: 1, rpcs: schedRpcs(FX, null), fixedTime: at(14, 20) });
  await sleep(1800); await dismissToasts(n.page);
  const n1 = await n.page.evaluate(() => ({ pulse: !!document.querySelector("[data-ai-pulse]"), seen: localStorage.getItem("sa_ai_fab") }));
  // перетащить линзу с «Учусь» на круг AI — тоже открывает Наставника
  const geo = await n.page.evaluate(() => { const a = document.querySelector("#sa-tabbar [aria-label='Учусь']").getBoundingClientRect(), b = document.querySelector("[data-tab-ai]").getBoundingClientRect(); return { ax: a.left + a.width / 2, ay: a.top + a.height / 2, bx: b.left + b.width / 2, by: b.top + b.height / 2 }; });
  await n.page.mouse.move(geo.ax, geo.ay); await n.page.mouse.down(); await n.page.mouse.move(geo.bx, geo.by, { steps: 8 }); await n.page.mouse.up(); await sleep(1400);
  const n2 = await n.page.evaluate(() => ({ row: !!document.querySelector("[data-tracks-row]"), seen: localStorage.getItem("sa_ai_fab"), head: document.body.innerText.slice(0, 200).replace(/\s+/g, " ") }));
  await n.page.evaluate(() => window.__saNav("roleSelect")); await sleep(1200);
  const n3 = await n.page.evaluate(() => ({ pulse: !!document.querySelector("[data-ai-pulse]") }));
  ok("AI: новичок — на круге золотой пульс; линзу перетащили на круг — открылся Наставник; после этого пульса нет",
    n1.pulse && n1.seen !== "1" && !n2.row && n2.seen === "1" && /Наставник|наставник|AI/.test(n2.head) && !n3.pulse, JSON.stringify({ n1, n2: { row: n2.row, seen: n2.seen }, n3 }));
  ok("AI: без ошибок", !o.errors.length && !n.errors.length, [...o.errors, ...n.errors].join(" | "));
  await n.ctx.close();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - fails} из ${results.length}`);
await browser.close(); server.close();
