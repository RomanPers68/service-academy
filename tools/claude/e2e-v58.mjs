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
async function open({ fresh = false, noToken = false, mobile = true, dsf = 2, storage = {}, telegram = false, light = false, w = 390, h = 844, url = "/", schedule = null, fixedTime = null, chat = [], rpcs = null, profile = prof, calls = [], ai = "guest", tts = null, ttsCalls = [], stream = false, assistant = null, motion = "no-preference", clockInstall = null }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", locale: "ru-RU", reducedMotion: motion });
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


// ════════════════════════════ v58 (Доп. 371): неудобства из аудита ════════════════════════════
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v58.mjs [ROLE WELCOME EMPTY TEXT CUT SERVER WIDE]
const ANNA = { ...prof, id: "u-new", name: "Анна", surname: "Новикова", position: "waiter", is_admin: false };
const HOST = { ...prof, id: "u-host", name: "Лена", surname: "Кравец", position: "hostess", is_admin: false };
const OWN = { id: "u-own2", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "owner", is_admin: true };
const MGR = { id: "u-mgr", name: "Марина", surname: "Волкова", restaurant: "Два моря, Океан", position: "manager", is_admin: false };
const RA8 = { ...prof, id: "u-own", name: "Роман", surname: "Смирнов", position: "manager", is_admin: true };
const W = 393, H = 852;
const NOW8 = at(14, 20).getTime();
const ago8 = (d, h = 12) => { const x = new Date(NOW8 - d * 864e5); x.setHours(h, 0, 0, 0); return x.toISOString(); };
const R8 = "Два моря, Океан";
const SCORES8 = [["Ангелина", "Токарева", 10], ["Ангелина", "Токарева", 9], ["Константин", "Петров", 7], ["Константин", "Петров", 6], ["Анна", "Смирнова", 6], ["Анна", "Смирнова", 5]]
  .map(([name, surname, score], i) => ({ id: "s" + i, name, surname, restaurant: R8, role: "seasonal", position: "waiter", quiz_id: "s" + (i % 3) + "-q", score, total: 10, updated_at: ago8(i % 3) }));
const baseRpcs = (extra = null) => (fn, b) => { if (extra) { const r = extra(fn, b); if (r !== undefined) return r; } if (fn === "team_scores") return { ok: true, rows: SCORES8 }; return schedRpcs(FX, null)(fn, b); };
const HINTS_SEEN = Object.fromEntries(Object.keys(HINTS).map((k) => ["sa_hint_v" + HINTS_VERSION + "_" + k, "1"]));
const roleInfo = (p) => p.evaluate(() => {
  const line = document.querySelector("[data-role-line]"), auto = document.querySelector("[data-role-auto]"), tt = document.querySelector("[data-tracks-title]");
  const head = [...document.querySelectorAll("div")].find((d) => /^(Треки обучения|Выбери свою роль)$/.test((d.textContent || "").trim()) && d.children.length === 0);
  return { role: line ? line.innerText.replace(/\s+/g, " ").trim() : null, auto: auto ? auto.innerText.replace(/\s+/g, " ").trim() : null, head: head ? head.textContent.trim() : null,
    ttTop: tt ? Math.round(tt.getBoundingClientRect().top) : null, lastRole: localStorage.getItem("sa_last_role_Анна_Новикова") || localStorage.getItem("sa_last_role") /* v59: ключ личный */, screenText: document.body.innerText.replace(/\s+/g, " ").slice(0, 300) };
});

if (want("ROLE")) {
  // новичок-официант без выбранной роли: трек подставлен по должности, «сменить» рядом; на сервер — ничего, пока не принят
  const calls = [];
  const o = await open({ fresh: true, profile: ANNA, storage: { __role: null, ...HINTS_SEEN }, w: W, h: H, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20), calls });
  const p = o.page; await sleep(1500);
  await p.locator("button", { hasText: /^Пропустить$/ }).last().click().catch(() => {}); await sleep(1200); await dismissToasts(p);
  let r = await roleInfo(p);
  ok("ROLE: официанту без выбранной роли подставлен «Новичок» — «по должности · сменить»; заголовок — «Треки обучения»", r.role && /Новичок/.test(r.role) && /по должности · сменить/.test(r.auto || "") && r.head === "Треки обучения", JSON.stringify(r));
  ok("ROLE: главная карточка — «Начать» (первый урок трека)", /Начать/.test(r.screenText) && /Первый день/.test(r.screenText), r.screenText.slice(0, 200));
  ok("ROLE: подставленный трек на сервер не уходит, пока не принят", !calls.some((c) => c.fn === "save_last_role"), calls.filter((c) => c.fn === "save_last_role").map((c) => JSON.stringify(c.body)).join(","));
  await shot(p, "role-auto");
  await p.locator("[data-role-change]").click(); await sleep(900);
  r = await roleInfo(p);
  ok("ROLE: «сменить» прокручивает к списку треков (заголовок у верха экрана)", r.ttTop !== null && r.ttTop >= 0 && r.ttTop < 160, "top=" + r.ttTop);
  await shot(p, "role-change");
  // принят: открыл урок — роль ушла на сервер и запомнилась; «по должности» больше не пишем
  await p.evaluate(() => { document.getElementById("root").scrollTop = 0; }); await sleep(300);
  await p.evaluate(() => { const el = [...document.querySelectorAll("div")].find((d) => d.children.length === 0 && d.textContent.trim() === "Начать" && d.closest("[data-home-logo]") === null); let c = el; while (c && !c.onclick && !c.getAttribute("tabindex")) c = c.parentElement; (c || el).click(); }); await sleep(1800);
  const saved = calls.filter((c) => c.fn === "save_last_role");
  ok("ROLE: открыл урок — трек принят: save_last_role(seasonal) и sa_last_role на телефоне", saved.length >= 1 && saved.every((c) => c.body.p_role === "seasonal") && (await p.evaluate(() => localStorage.getItem("sa_last_role_Анна_Новикова") || localStorage.getItem("sa_last_role"))) === '"seasonal"', JSON.stringify(saved.map((c) => c.body)));
  await p.evaluate(() => window.__saNav("roleSelect")); await sleep(1200);
  r = await roleInfo(p);
  ok("ROLE: после принятия — просто роль, без «по должности»", r.role && /Новичок/.test(r.role) && !r.auto, JSON.stringify(r));
  ok("ROLE: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
  // хостес — «Хостес»; владелец (должность без трека) — выбор, как раньше
  const h = await open({ profile: HOST, storage: { __role: null }, w: W, h: H, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20) });
  await sleep(1400); await dismissToasts(h.page);
  r = await roleInfo(h.page);
  ok("ROLE: хостес — трек «Хостес» по должности", r.role && /Хостес/.test(r.role) && r.auto, JSON.stringify(r));
  await h.ctx.close();
  const w = await open({ profile: OWN, storage: { __role: null }, w: W, h: H, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20) });
  await sleep(1400); await dismissToasts(w.page);
  r = await roleInfo(w.page);
  ok("ROLE: у владельца своего трека нет — «Выбери свою роль», как раньше", !r.role && r.head === "Выбери свою роль", JSON.stringify(r));
  await w.ctx.close();
  // роль, выбранная раньше (сервер), главнее подставленной — и без прыжка на другой экран
  const s = await open({ profile: ANNA, storage: { __role: null }, w: W, h: H, dsf: 1, fixedTime: at(14, 20),
    rpcs: baseRpcs((fn) => fn === "my_state" ? { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: "spg" } : undefined) });
  await sleep(1800); await dismissToasts(s.page);
  r = await roleInfo(s.page);
  const onHome = await s.page.evaluate(() => !!document.querySelector("[data-home-logo]"));
  ok("ROLE: на сервере выбрана «Хостес» — она главнее подставленного «Новичка»; человек остаётся на главной", r.role && /Хостес/.test(r.role) && !r.auto && onHome && r.lastRole === '"spg"', JSON.stringify(r) + " home=" + onHome);
  await s.ctx.close();
}

if (want("WELCOME")) {
  const o = await open({ fresh: true, profile: ANNA, storage: { __role: null, ...HINTS_SEEN }, w: W, h: H, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20) });
  const p = o.page; await sleep(1500);
  let t = await text(p);
  ok("WELCOME: первая карточка — «Учусь — уроки и тесты твоей роли…», без «стало проще»", /Учусь — уроки и тесты твоей роли/.test(t) && !/стало проще/.test(t), t.slice(0, 200));
  await p.locator("button", { hasText: /^Дальше$/ }).last().click(); await sleep(600);
  t = await text(p);
  ok("WELCOME: «Твой трек» — «сначала «Начать», потом «Дальше»»", /сначала «Начать», потом «Дальше»/.test(t), t.slice(0, 200));
  await p.locator("button", { hasText: /^Дальше$/ }).last().click(); await sleep(600);
  await p.locator("button", { hasText: /^Дальше$/ }).last().click(); await sleep(600);
  t = await text(p);
  ok("WELCOME: последняя карточка — «Это окно больше не покажется», без слова «попап»", /Это окно больше не покажется/.test(t) && !/попап/i.test(t), t.slice(0, 200));
  await shot(p, "welcome-4");
  await o.ctx.close();
}

if (want("EMPTY")) {
  const o = await open({ profile: ANNA, storage: { __role: "seasonal" }, w: W, h: H, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20) });
  const p = o.page; await sleep(1400); await dismissToasts(p);
  await p.evaluate(() => window.__saNav("mistakes")); await sleep(1200);
  let t = await text(p);
  ok("EMPTY: «Работа над ошибками» без тестов — «Пока пусто», без конфетти", (await p.locator('[data-mistakes-empty="new"]').count()) === 1 && /Пока пусто/.test(t) && !/🎉|Ошибок нет/.test(t), t.slice(0, 160));
  await shot(p, "mistakes-new");
  await p.evaluate(() => window.__saNav("stats")); await sleep(1300);
  t = await text(p);
  ok("EMPTY: «Статистика» без прогресса — «Здесь появятся твои баллы» и кнопка, без плиток с нулями", (await p.locator("[data-stats-empty]").count()) === 1 && /Здесь появятся твои баллы/.test(t) && !/Средний балл/.test(t), t.slice(0, 200));
  await shot(p, "stats-empty");
  await p.locator("[data-stats-start]").click(); await sleep(1800);
  t = await text(p);
  ok("EMPTY: «К первому уроку» открывает первый урок трека", /Первый день: нормально бояться/.test(t) && !/Здесь появятся твои баллы/.test(t), t.slice(0, 200));
  await p.evaluate(() => window.__saNav("daily")); await sleep(1300);
  const d = await p.evaluate(() => { const el = document.querySelector("[data-daily-date]"); return el ? el.textContent : null; });
  const WD8 = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"], MG8 = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const dd = at(14, 20), expDate = WD8[dd.getDay()] + ", " + dd.getDate() + " " + MG8[dd.getMonth()];
  ok("EMPTY: «Задания дня» — дата словами («Воскресенье, 18 октября»)", d === expDate && !/\d{2}\.\d{2}\.\d{4}/.test(await text(p)), d + " ≠ " + expDate);
  await shot(p, "daily-date");
  ok("EMPTY: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
  // у кого тесты уже были — «Ошибок нет» с праздником, как и раньше
  const q = await open({ profile: ANNA, storage: { ...ROMAN44(), __role: "seasonal", "sa_mistakes{uk}": [] }, w: W, h: H, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20) });
  await sleep(1400); await dismissToasts(q.page);
  await q.page.evaluate(() => window.__saNav("mistakes")); await sleep(1200);
  t = await text(q.page);
  ok("EMPTY: тесты были, ошибок нет — по-прежнему «Ошибок нет» 🎉", /Ошибок нет/.test(t) && (await q.page.locator('[data-mistakes-empty="new"]').count()) === 0, t.slice(0, 160));
  await q.page.evaluate(() => window.__saNav("stats")); await sleep(1300);
  t = await text(q.page);
  ok("EMPTY: с прогрессом — плитки на месте, «0 тестов» склоняется верно", /Средний балл/.test(t) && !/0 теста/.test(t) && (await q.page.locator("[data-stats-empty]").count()) === 0, t.slice(0, 200));
  await q.ctx.close();
}

if (want("TEXT")) {
  const o = await open({ profile: RA8, storage: { ...ROMAN44(), __role: "spg" }, w: W, h: H, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20), motion: "reduce" });
  const p = o.page; await sleep(1400); await dismissToasts(p);
  // v64: круг Наставника посередине меню — без подписи, не считаем
  const tabFs = await p.evaluate(() => [...document.querySelectorAll("#sa-tabbar [role=button]:not([data-tab-ai])")].map((b) => { const l = [...b.querySelectorAll("div")].pop(); return l ? parseFloat(getComputedStyle(l).fontSize) : 0; }));
  ok("TEXT: подписи вкладок — 11 px (были 9)", tabFs.length === 4 && tabFs.every((v) => v === 11), JSON.stringify(tabFs));
  const SCR = ["roleSelect", "home", "shift", "teamHub", "me", "glossary", "leaderboard", "stats", "daily", "guestbook", "cellar", "menuTrainer", "cocktails", "reference", "mentor", "profile", "analytics", "report"];
  const tiny = {};
  for (const s of SCR) {
    await p.evaluate((s) => window.__saNav(s), s); await sleep(1200); await dismissToasts(p);
    const r = await p.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest("svg")) continue;
        const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
        if (!own) continue;
        const b = el.getBoundingClientRect(); if (b.width < 2 || b.height < 2 || b.bottom < 0 || b.top > innerHeight) continue;
        const cs = getComputedStyle(el); if (cs.visibility === "hidden" || +cs.opacity === 0) continue;
        const fs = parseFloat(cs.fontSize);
        if (fs < 10.5 - 0.01) bad.push(fs + "px «" + own.slice(0, 24) + "»");
      }
      return bad;
    });
    if (r.length) tiny[s] = r;
  }
  ok("TEXT: на 18 экранах нет надписей мельче 10,5 px (аудит: было 118 мельче 10)", !Object.keys(tiny).length, JSON.stringify(tiny).slice(0, 400));
  ok("TEXT: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("CUT")) {
  const o = await open({ profile: ANNA, storage: { ...ROMAN44(), __role: "seasonal" }, w: W, h: H, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20), motion: "reduce" });
  const p = o.page; await sleep(1400); await dismissToasts(p);
  await p.evaluate(() => window.__saNav("cellar")); await sleep(1300); await dismissToasts(p);
  const cel = await p.evaluate(() => [...document.querySelectorAll("[data-cellar-title]")].map((t) => { const row = t.closest("[role=listitem]"); const btn = row && row.querySelector("[data-cellar-action]");
    return { text: t.innerText, lines: Math.round(t.getBoundingClientRect().height / 18.75), cut: t.scrollHeight > t.clientHeight + 2, btnW: btn ? Math.round(btn.getBoundingClientRect().width) : 0, btn: btn ? btn.innerText.replace(/\s+/g, " ") : "" }; }));
  const psy = cel.find((c) => /Психология первого дня/.test(c.text));
  const sec = cel.filter((c) => /Зачёт|Раунд/.test(c.btn));
  ok("CUT: погреб — «Психология первого дня» целиком (две строки); «Зачёт на опыт» / «Раунд мастера» не шире 96 px", psy && !psy.cut && psy.lines <= 2 && cel.every((c) => !c.cut) && sec.length >= 2 && sec.every((c) => c.btnW <= 97), JSON.stringify(cel.slice(0, 4)));
  await shot(p, "cellar");
  await p.evaluate(() => window.__saNav("guestbook")); await sleep(1500); await dismissToasts(p);
  const gb = await p.evaluate(() => { const more = document.querySelector("[data-seg-more]"); const track = more ? more.parentElement.querySelector(".sa-hscroll") : document.querySelector(".sa-gbbook") && null;
    const tabs = document.querySelector("[data-seg-more]") ? [...document.querySelector("[data-seg-more]").parentElement.querySelectorAll("button")] : [];
    return { more: !!more, fs: tabs.length ? parseFloat(getComputedStyle(tabs[0]).fontSize) : 0, n: tabs.length }; });
  ok("CUT: вкладки «Книги отзывов» — 11,5 px, у правого края намёк «листай» (›)", gb.more && gb.fs === 11.5 && gb.n >= 7, JSON.stringify(gb));
  await shot(p, "guestbook-tabs");
  await p.evaluate(() => { const m = document.querySelector("[data-seg-more]"); const tr = m.parentElement.querySelector(".sa-hscroll"); tr.scrollLeft = tr.scrollWidth; }); await sleep(500);
  ok("CUT: долистал до конца — намёк пропал", (await p.locator("[data-seg-more]").count()) === 0);
  await o.ctx.close();
  const r = await open({ profile: RA8, storage: { ...ROMAN44(), __role: "spg" }, w: W, h: H, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20) });
  await sleep(1400); await dismissToasts(r.page);
  await r.page.evaluate(() => window.__saNav("teamHub")); await sleep(1600); await dismissToasts(r.page);
  const ld = await r.page.evaluate(() => [...document.querySelectorAll("[data-leader-name]")].map((e) => ({ t: e.textContent, cut: e.scrollWidth > e.clientWidth + 1 })));
  ok("CUT: лидеры ресторана — имена целиком («Ангелина», «Константин»)", ld.length === 3 && ld.every((x) => !x.cut) && ld.some((x) => x.t === "Константин"), JSON.stringify(ld));
  await shot(r.page, "leaders");
  await r.page.evaluate(() => window.__saNav("menuTrainer")); await sleep(1500);
  const mh = await r.page.evaluate(() => { const h = document.querySelector(".sa-screen > div:first-child"); return h ? h.innerText.replace(/\s+/g, " ").trim() : ""; });
  const mt = await text(r.page);
  ok("CUT: «Меню» — заголовок «Меню», название ресторана — один раз, во вкладке", mh === "‹ Меню" && (mt.match(/Два моря, Океан/g) || []).length === 1, mh + " | " + mt.slice(0, 120));
  await shot(r.page, "menu-head");
  await r.ctx.close();
}

if (want("SERVER")) {
  const calls = [];
  const fail = (fn) => (fn === "team_achievements" || fn === "achievements_list") ? { ok: false, error: "boom" } : undefined;
  const o = await open({ profile: ANNA, storage: { ...ROMAN44(), __role: "seasonal" }, w: W, h: H, dsf: 1, rpcs: baseRpcs(fail), fixedTime: at(14, 20), calls });
  const p = o.page; await sleep(1400); await dismissToasts(p);
  await p.evaluate(() => window.__saNav("leaderboard")); await sleep(1800); await dismissToasts(p);
  let t = await text(p);
  ok("SERVER: «Рейтинг» — «Рекорды не загрузились · Ещё раз» вместо «Нужен stage14 на сервере»", /Рекорды не загрузились · Ещё раз/.test(t) && !/stage/.test(t), t.slice(0, 300));
  const n0 = calls.filter((c) => c.fn === "team_achievements").length;
  await p.locator("[data-rec-retry]").click(); await sleep(900);
  ok("SERVER: «Ещё раз» повторяет запрос рекордов", calls.filter((c) => c.fn === "team_achievements").length > n0, n0 + " → " + calls.filter((c) => c.fn === "team_achievements").length);
  await shot(p, "records-retry");
  await o.ctx.close();
  // аналитика: менеджер без прав владельца — без скрипта; владелец — со скриптом
  const m = await open({ profile: MGR, storage: { ...ROMAN44(), __role: "manager" }, w: W, h: H, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20) });
  await sleep(1400); await dismissToasts(m.page);
  await m.page.evaluate(() => window.__saNav("analytics")); await sleep(1500);
  await m.page.locator("button", { hasText: /^Люди$/ }).first().click().catch(() => {}); await sleep(1400);
  t = await text(m.page);
  ok("SERVER: аналитика у менеджера — «Сотрудники и их ошибки появятся, когда владелец обновит сервер», без supabase-stage", /Сотрудники и их ошибки появятся, когда владелец обновит сервер\./.test(t) && !/supabase-stage|Серверная часть/.test(t), t.slice(0, 300));
  await m.page.locator("button", { hasText: /^Вопросы$/ }).first().click().catch(() => {}); await sleep(1400);
  t = await text(m.page);
  ok("SERVER: «Вопросы» — тоже по-человечески", /Вопросы с наибольшим процентом ошибок появятся, когда владелец обновит сервер\./.test(t) && !/supabase-stage/.test(t), t.slice(t.indexOf("Сводка"), t.indexOf("Сводка") + 300));
  await shot(m.page, "analytics-mgr");
  await m.ctx.close();
  const a = await open({ profile: RA8, storage: { ...ROMAN44(), __role: "spg" }, w: W, h: H, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20) });
  await sleep(1400); await dismissToasts(a.page);
  await a.page.evaluate(() => window.__saNav("analytics")); await sleep(1500);
  await a.page.locator("button", { hasText: /^Люди$/ }).first().click().catch(() => {}); await sleep(1400);
  t = await text(a.page);
  ok("SERVER: владельцу — то же плюс «Для владельца: примени supabase-stage15-quiz-retries.sql»", /появятся, когда владелец обновит сервер\. Для владельца: примени supabase-stage15-quiz-retries\.sql в Supabase → SQL Editor\./.test(t), t.slice(0, 300));
  await a.ctx.close();
}

if (want("WIDE")) {
  const o = await open({ fresh: true, profile: ANNA, storage: { __role: null, ...HINTS_SEEN, sa_welcome_seen_v11: "1" }, w: 844, h: 390, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20) });
  await sleep(1600); await dismissToasts(o.page);
  let r = await roleInfo(o.page);
  ok("WIDE: лёжа (844×390) — «по должности · сменить» на месте", r.role && /Новичок/.test(r.role) && /сменить/.test(r.auto || ""), JSON.stringify(r));
  await shot(o.page, "wide-land");
  await o.ctx.close();
  const d = await open({ fresh: true, profile: ANNA, storage: { __role: null, ...HINTS_SEEN, sa_welcome_seen_v11: "1" }, w: 1440, h: 900, dsf: 1, mobile: false, rpcs: baseRpcs(), fixedTime: at(14, 20) });
  await sleep(1600); await dismissToasts(d.page);
  r = await roleInfo(d.page);
  const two = await d.page.evaluate(() => !!document.querySelector("[data-home2-title][data-tracks-title]"));
  ok("WIDE: компьютер (1440×900) — две колонки, заголовок треков с якорем; «сменить» есть", two && /сменить/.test(r.auto || ""), JSON.stringify(r) + " two=" + two);
  await d.page.locator("[data-role-change]").click(); await sleep(900);
  await shot(d.page, "wide-desk");
  await d.ctx.close();
  // мышью на компьютере вкладки-«линзы» (с перетаскиванием линзы) переключаются — раньше click уходил на дорожку
  const k = await open({ profile: RA8, storage: { ...ROMAN44(), __role: "spg" }, w: 1440, h: 900, dsf: 1, mobile: false, rpcs: baseRpcs(), fixedTime: at(14, 20) });
  await sleep(1500); await dismissToasts(k.page);
  await k.page.evaluate(() => window.__saNav("analytics")); await sleep(1500); await dismissToasts(k.page);
  const segOf = () => k.page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => /^(Люди|Вопросы|Лазейки|Сводка)$/.test(b.textContent.trim())).map((b) => b.textContent.trim() + ":" + getComputedStyle(b).opacity));
  const segBefore = await segOf();
  await k.page.locator("button", { hasText: /^Вопросы$/ }).first().click(); await sleep(800);
  const segAfter = await segOf();
  ok("WIDE: вкладки-«линзы» переключаются мышью (аналитика → «Вопросы»)", segAfter.includes("Вопросы:1") && !segBefore.includes("Вопросы:1") && /ЧАЩЕ ВСЕГО МИМО/.test(await text(k.page)), JSON.stringify({ segBefore, segAfter }));
  await k.page.keyboard.press("Tab");
  await k.ctx.close();

  const l = await open({ light: true, profile: ANNA, storage: { __role: "seasonal" }, w: W, h: H, dsf: 1, rpcs: baseRpcs(), fixedTime: at(14, 20) });
  await sleep(1400); await dismissToasts(l.page);
  await l.page.evaluate(() => window.__saNav("stats")); await sleep(1300);
  const col = await l.page.evaluate(() => { const e = document.querySelector("[data-stats-empty]"); return e ? getComputedStyle(e.querySelector("div:nth-child(2)")).color : ""; });
  ok("WIDE: «Для чтения» — пустая статистика тёмным текстом", /rgb\(/.test(col) && col.match(/\d+/g).slice(0, 3).every((v) => +v < 120), col);
  await shot(l.page, "light-stats");
  await l.ctx.close();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - fails} из ${results.length}`);
await browser.close(); server.close();
