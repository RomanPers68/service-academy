// e2e v49 (Доп. 362): график руководителя. PICK — лист смены подсказывает до выбора (у каждой смены «подходит · станет
// N из M ч» или причина; капсулы: покрытие позиции в этот день, пожелания; «Кто может выйти в этот день ›»; «Выходной» —
// «в позиции станет …»). DAY — тап по числу: день по часам (силуэт «людей в зале», полосы по позициям, дыры с «Кто может
// выйти?», тап по человеку — его смена, заметка, картинка дня; «Сегодня по часам»). STRIP — месяц полоской, «‹ неделя ›»,
// «неделя / месяц»; строки про месяц ушли из «Сегодня». WEEK — неделя во всю высоту, числа прилипают, влезает на 393/360/320.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v49.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
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

if (want("PICK")) for (const light of [false, true]) {
  const nm = "PICK" + (light ? " светлая" : " тёмная");
  const { ctx, page, errors } = await openSched({ light, profile: RA });
  await openCell(page, "Смирнова Анна", 16);
  let g = await pickGeo(page);
  const byK = (k) => g && g.rows.find((r) => r.t.startsWith(k));
  ok(nm + ": Анна, пт 16 — часы «128 из 160 ч», капсула «Официант: в этот день 6 из 6»", g && /^128 из 160 ч$/.test(g.hours) && /✓ Официант: в этот день 6 из 6/.test(g.ctx), JSON.stringify(g && [g.hours, g.ctx]));
  ok(nm + ": утро — «⚠ мало отдыха после вчерашней смены», день и вечер — «✓ подходит · станет 136 из 160 ч», кейтеринг — отдельная", g && byK("У") && byK("У").st === "warn" && /мало отдыха после вчерашней смены/.test(byK("У").t)
    && byK("Д").st === "ok" && /подходит · станет 136 из 160 ч/.test(byK("Д").t) && byK("В").st === "ok" && byK("К").st === "extra", JSON.stringify(g && g.rows.map((r) => [r.st, r.t.slice(0, 60)])));
  ok(nm + ": цвета — зелёный «подходит», красный «⚠»", g && byK("Д").color === (light ? "rgb(44, 107, 72)" : "rgb(138, 216, 175)") && byK("У").color === (light ? "rgb(163, 58, 42)" : "rgb(224, 144, 144)"), JSON.stringify(g && [byK("Д").color, byK("У").color]));
  ok(nm + ": в позиции всё закрыто — кнопки «Кто может выйти» нет; лист на экране", g && !g.fill && g.top >= 0 && g.bottom <= g.ih, JSON.stringify(g && [g.fill, g.top, g.bottom]));
  await page.screenshot({ path: `${OUT8}/pick-anna-${light ? "light" : "dark"}.png` });
  await page.mouse.click(196, 20); await sleep(400);
  // раннер, сб 17: дыра в позиции; у Гусева смена стоит — «стоит сейчас», «Выходной» — «в позиции станет 0 из 2»
  await openCell(page, "Гусев Тимур", 17);
  g = await pickGeo(page);
  ok(nm + ": Гусев, сб 17 — «Раннер: в этот день 1 из 2 — не хватает одного», у его смены «стоит сейчас», у «Выходного» — «в позиции станет 0 из 2»", g && /⚠ Раннер: в этот день 1 из 2 — не хватает одного/.test(g.ctx)
    && g.rows.some((r) => /стоит сейчас · правила соблюдены|⚠/.test(r.t) && r.t.startsWith("Д")) && g.rows.some((r) => /^· Выходной/.test(r.t) && /в позиции станет 0 из 2/.test(r.t)), JSON.stringify(g && [g.ctx, g.rows.map((r) => r.t.slice(0, 70))]));
  ok(nm + ": в позиции дыра — «Кто может выйти в этот день ›»", g && g.fill);
  await page.screenshot({ path: `${OUT8}/pick-gusev-${light ? "light" : "dark"}.png` });
  await page.locator("[data-pick-fill]").click(); await sleep(700);
  const fs = await page.evaluate(() => { const s = document.querySelector("[data-fill-sheet]"); return s ? s.innerText.replace(/\s+/g, " ") : null; });
  ok(nm + ": «Кто может выйти…» — лист «Кто может выйти» на раннера, сб 17", fs && /КТО МОЖЕТ ВЫЙТИ · СБ · 17 ОКТЯБРЯ/.test(fs) && /Раннер/.test(fs), (fs || "").slice(0, 90));
  ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

const dayGeo = (page) => page.evaluate(() => {
  const s = document.querySelector("[data-boss-day]"); if (!s) return null;
  const b = s.getBoundingClientRect(), t = (sel) => { const el = s.querySelector(sel); return el ? el.innerText.replace(/\s+/g, " ").trim() : null; };
  const hours = [...s.querySelectorAll("[data-hour]")].map((x) => [+x.getAttribute("data-hour"), +x.getAttribute("data-count")]);
  return { d: +s.getAttribute("data-boss-day"), top: Math.round(b.top), bottom: Math.round(b.bottom), ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth,
    title: t("[data-day-title]"), miss: t("[data-day-miss]"), hours, now: !!s.querySelector("[data-day-now]"),
    pos: [...s.querySelectorAll("[data-day-pos]")].map((x) => x.getAttribute("data-day-pos")), people: s.querySelectorAll("[data-day-person]").length,
    holes: [...s.querySelectorAll("[data-day-hole]")].map((x) => x.getAttribute("data-day-hole")), note: t("[data-day-note]"), text: s.innerText.replace(/\s+/g, " ") };
});

if (want("DAY")) for (const light of [false, true]) {
  const nm = "DAY" + (light ? " светлая" : " тёмная");
  const { ctx, page, errors } = await openSched({ light, profile: RA });
  await toGrid(page); await sleep(200);
  await page.locator('[data-day-open="17"]').click(); await sleep(700);
  let g = await dayGeo(page);
  const H = g ? Object.fromEntries(g.hours) : {};
  ok(nm + ": тап по «17» — день по часам: «Пиковый день · 11 из 13 человек», «не хватает: барбек, раннер», на экране", g && g.d === 17 && g.title === "Пиковый день · 11 из 13 человек" && /^не хватает: барбек, раннер/.test(g.miss) && g.top >= 0 && g.bottom <= g.ih && g.sw <= g.iw, JSON.stringify(g && [g.title, g.miss, g.top, g.bottom]));
  ok(nm + ": людей в зале по часам — с 12 до 2 ночи; днём 10–11, после 20:00 — один, после полуночи — никого; часы работы подписаны", g && g.hours[0][0] === 12 && g.hours[g.hours.length - 1][0] === 25 && H[14] >= 10 && H[20] === 1 && H[24] === 0 && /открыты 12:00–2:00/.test(g.text), JSON.stringify(g && g.hours));
  ok(nm + ": полосы по позициям — все 11 человек, дыры — барбек и раннер", g && g.people === 11 && g.holes.join() === "barback,runner" && g.pos.includes("waiter") && /ОФИЦИАНТ 6 из 6 ✓/.test(g.text) && /БАРБЕК 0 из 1 · −1/.test(g.text), JSON.stringify(g && [g.people, g.holes, g.pos]));
  await page.screenshot({ path: `${OUT8}/day17-${light ? "light" : "dark"}.png` });
  // тап по человеку — лист его смены поверх дня
  const pid = await page.evaluate(() => document.querySelector("[data-day-person]").getAttribute("data-day-person"));
  await page.locator(`[data-day-person="${pid}"]`).click(); await sleep(600);
  const pk = await pickGeo(page);
  ok(nm + ": тап по человеку — лист его смены на 17-е поверх дня", pk && /СБ · 17 ОКТЯБРЯ/.test(pk.text) && (await page.locator("[data-boss-day]").count()) === 1, pk && pk.text.slice(0, 60));
  await page.mouse.click(196, 20); await sleep(400);   // закрыть лист смены (день остаётся под ним)
  if (!(await page.locator("[data-boss-day]").count())) { await toGrid(page); await page.locator('[data-day-open="17"]').click(); await sleep(600); }
  // дыра — «Кто может выйти?»
  await page.locator('[data-day-hole="runner"]').click(); await sleep(700);
  const fs = await page.evaluate(() => { const s = document.querySelector("[data-fill-sheet]"); return s ? s.innerText.replace(/\s+/g, " ") : null; });
  ok(nm + ": пунктир «Кто может выйти?» — лист «Кто может выйти» на раннера", fs && /КТО МОЖЕТ ВЫЙТИ · СБ · 17 ОКТЯБРЯ/.test(fs), (fs || "").slice(0, 80));
  await page.locator("[data-fill-sheet] button", { hasText: "Закрыть" }).click(); await sleep(400);
  // заметка ко дню — строкой; тап — окошко поверх, «Готово» — заметка в листе дня
  await page.locator("[data-day-note]").click(); await sleep(500);
  await page.locator("[data-note-sheet] input").fill("Банкет · 30 гостей"); await sleep(200);
  await page.locator("[data-note-sheet] button", { hasText: "Готово" }).click(); await sleep(500);
  g = await dayGeo(page);
  ok(nm + ": заметка — окошком поверх дня, после «Готово» — строкой в листе", g && /✎ Банкет · 30 гостей/.test(g.note || ""), g && g.note);
  // картинка дня — карточка смены этого дня, и экран подводит к ней
  await page.locator("[data-day-shot]").click(); await sleep(2600);
  const sh = await inView(page, "[data-shot-card]");
  ok(nm + ": «Картинкой в чат» — карточка смены этого дня, на экране", sh && sh.top < sh.ih && sh.bottom > 0 && !(await page.locator("[data-boss-day]").count()), JSON.stringify(sh));
  // «Сегодня по часам»: риска «сейчас»
  await page.evaluate(() => { const w = document.querySelector(".sa-schedwrap"); w.scrollTop = 0; }); await sleep(300);
  await page.locator("[data-today-hours]").first().click(); await sleep(700);
  g = await dayGeo(page);
  ok(nm + ": «по часам ›» в «Сегодня» — сегодняшний день с риской «сейчас»", g && g.d === FX.today && g.now, JSON.stringify(g && [g.d, g.now]));
  await page.screenshot({ path: `${OUT8}/day-today-${light ? "light" : "dark"}.png` });
  ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

const stripGeo = (page) => page.evaluate(() => {
  const st = document.querySelector("[data-sched-strip]"); if (!st) return null;
  const days = [...st.querySelectorAll("[data-strip-day]")];
  const g = document.querySelector(".sa-schedgrid");
  return { n: days.length, short: days.map((x) => +x.getAttribute("data-strip-short")), sel: (st.querySelector("[data-strip-sel]") || { getAttribute: () => null }).getAttribute("data-strip-sel"),
    pct: (st.querySelector("[data-strip-pct]") || {}).innerText, line: st.firstElementChild.innerText.replace(/\s+/g, " ").trim(),
    week: (st.querySelector("[data-stepper-week]") || {}).innerText || null, sub: st.querySelector("[data-stepper-sub]") ? st.querySelector("[data-stepper-sub]").innerText.replace(/\s+/g, " ").trim() : null,
    heads: [...g.querySelectorAll("tr:first-child th b")].map((b) => +b.textContent), wk: g.classList.contains("sa-wk"),
    mode: [...document.querySelectorAll("[data-sched-weekmode] button")].map((b) => b.textContent + ":" + b.getAttribute("aria-pressed")).join(" "),
    today: (() => { let el = document.querySelector("[data-today-hours]"); while (el && el.parentElement && !el.parentElement.classList.contains("sa-schedwrap")) el = el.parentElement; return el ? el.innerText.replace(/\s+/g, " ") : ""; })(),
    body: document.querySelector(".sa-schedwrap").innerText.replace(/\s+/g, " ") };
});

if (want("STRIP")) for (const light of [false, true]) {
  const nm = "STRIP" + (light ? " светлая" : " тёмная");
  const { ctx, page, errors } = await openSched({ light, profile: RA });
  let g = await stripGeo(page);
  const expShort = Array.from({ length: FX.DAYS }, (_, i) => i + 1).map((d) => [2, 3, 4, 9, 11, 16, 18, 23, 25].includes(d) ? 1 : [10, 17, 24, 30, 31].includes(d) ? 2 : 0);
  ok(nm + ": полоска — весь месяц, красное — где не хватает (по дням как в «Проверке»)", g && g.n === FX.DAYS && JSON.stringify(g.short) === JSON.stringify(expShort), JSON.stringify(g && g.short));
  ok(nm + ": покрытие крупно — «94% покрытие · не хватает 19 смен за месяц»", g && g.pct === "94%" && /94% покрытие · не хватает 19 смен за месяц/.test(g.line), g && g.line);
  ok(nm + ": текущая неделя — в рамке и в таблице; «‹ 12–18 октября ›» и «не хватает 4 смены · тяжелее всего сб 17»", g && g.sel === "12-18" && g.week === "12–18 октября" && g.sub === "не хватает 4 смены · тяжелее всего сб 17" && g.heads.join() === "12,13,14,15,16,17,18" && g.wk, JSON.stringify(g && [g.sel, g.week, g.sub, g.heads]));
  ok(nm + ": «неделя / месяц» — переключатель в заголовке; шести кнопок недель и «весь месяц» нет", g && g.mode === "неделя:true месяц:false" && !/(^| )1–4 5–11 12–18/.test(g.body) && !(await page.locator("button", { hasText: /^весь месяц$/ }).count()), g && g.mode);
  ok(nm + ": в «Сегодня» больше нет «месяц ███» и «на неделе не хватает» — они у полоски", g && /^СЕГОДНЯ · \d+ ОКТЯБРЯ/i.test(g.today) && !/на неделе не хватает/.test(g.today) && !/месяц/.test(g.today) && !/94%/.test(g.today) && /по часам ›/.test(g.today), g && g.today.slice(0, 160));
  await page.evaluate(() => { const w = document.querySelector(".sa-schedwrap"), c = document.querySelector("[data-sched-gridcard]"); w.scrollTop = c.getBoundingClientRect().top + w.scrollTop - 10; }); await sleep(300);
  await page.screenshot({ path: `${OUT8}/strip-${light ? "light" : "dark"}.png` });
  await page.locator('[data-sched-stepper] button[aria-label="Следующая неделя"]').click(); await sleep(600);
  g = await stripGeo(page);
  ok(nm + ": «›» — следующая неделя: 19–25, рамка и таблица за ней", g && g.week === "19–25 октября" && g.sel === "19-25" && g.heads.join() === "19,20,21,22,23,24,25" && /тяжелее всего сб 24/.test(g.sub), JSON.stringify(g && [g.week, g.sel, g.sub]));
  await page.locator('[data-strip-day="3"]').click(); await sleep(600);
  g = await stripGeo(page);
  const prevDis = await page.locator('[data-sched-stepper] button[aria-label="Предыдущая неделя"]').isDisabled();
  ok(nm + ": тап по 3-му на полоске — неделя 1–4; «‹» у первой недели не нажимается", g && g.week === "1–4 октября" && g.sel === "1-4" && g.heads.join() === "1,2,3,4" && prevDis, JSON.stringify(g && [g.week, g.sel, prevDis]));
  await page.locator("[data-sched-weekmode] button", { hasText: "месяц" }).click(); await sleep(600);
  g = await stripGeo(page);
  ok(nm + ": «месяц» — вся таблица (31 день, коробкой с прокруткой вбок), рамки и «‹ неделя ›» нет", g && g.heads.length === FX.DAYS && !g.wk && !g.sel && !g.week && /Тап по полоске — неделя/.test(g.body), JSON.stringify(g && [g.heads.length, g.wk, g.sel]));
  await page.locator("[data-sched-weekmode] button", { hasText: "неделя" }).click(); await sleep(600);
  g = await stripGeo(page);
  ok(nm + ": «неделя» — снова текущая неделя", g && g.week === "12–18 октября" && g.wk, g && g.week);
  ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

if (want("WEEK")) for (const w of [393, 360, 320]) for (const light of (w === 393 ? [false, true] : [false])) {
  const nm = "WEEK " + w + (light ? " светлая" : " тёмная");
  const { ctx, page, errors } = await openSched({ light, profile: RA, w });
  const g0 = await page.evaluate(() => { const g = document.querySelector(".sa-schedgrid"), card = document.querySelector("[data-sched-gridcard]"), tab = g.querySelector("table");
    const cb = card.getBoundingClientRect(), tb = tab.getBoundingClientRect(), pad = parseFloat(getComputedStyle(card).paddingRight);
    return { inner: g.scrollHeight - g.clientHeight, rows: g.querySelectorAll("tr").length, tableRight: Math.round(tb.right), cardInner: Math.round(cb.right - pad), sw: document.documentElement.scrollWidth, iw: innerWidth }; });
  ok(nm + ": неделя во всю высоту — у таблицы нет своей прокрутки, все строки на странице", g0.inner <= 1 && g0.rows > 20, JSON.stringify(g0));
  ok(nm + ": неделя влезает в карточку, без прокрутки вбок", g0.tableRight <= g0.cardInner + 1 && g0.sw <= g0.iw, JSON.stringify(g0));
  // листаем страницу ниже шапки таблицы — числа прилипают к верху
  await page.evaluate(() => { const w = document.querySelector(".sa-schedwrap"), g = document.querySelector(".sa-schedgrid"); w.scrollTop = g.getBoundingClientRect().top + w.scrollTop + 380; }); await sleep(400);
  const g1 = await page.evaluate(() => { const g = document.querySelector(".sa-schedgrid"), th = g.querySelector("tr:first-child th:nth-child(2)"), tb = th.getBoundingClientRect(), gb = g.getBoundingClientRect();
    const today = [...g.querySelectorAll("tr:first-child th")].find((x) => x.style.borderRadius === "9px 9px 0px 0px");
    return { thTop: Math.round(tb.top), gridTop: Math.round(gb.top), todayBg: today ? getComputedStyle(today).backgroundColor : null, todayImg: today ? getComputedStyle(today).backgroundImage.length : 0 }; });
  ok(nm + ": числа прилипли к верху экрана, пока таблица уходит вверх", g1.gridTop < -100 && g1.thTop >= -1 && g1.thTop <= 2, JSON.stringify(g1));
  ok(nm + ": золото сегодняшнего числа — на плотной подложке (строки не просвечивают)", g1.todayBg && (light ? /rgba?\(0, 0, 0, 0\)|transparent/.test(g1.todayBg) ? g1.todayImg > 120 : true : g1.todayBg === "rgb(25, 19, 9)"), JSON.stringify(g1));
  await page.screenshot({ path: `${OUT8}/week-sticky-${w}-${light ? "light" : "dark"}.png` });
  ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
