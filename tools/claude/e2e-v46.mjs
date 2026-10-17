// e2e v46 (Доп. 359): график. STAFF — у сотрудника наверху карточка ближайшей смены (листок 46×50, время, «через …»,
// старший со звонком, «Чек-лист смены», «Кто со мной»), под ней медальоны месяца; смены словами; 393 и 360 px, обе
// темы. STATES — смена закончилась (следующая, без нити), смен больше нет, повтор перед сменой. TAPS — «Кто со мной»
// раскрывает день, «Чек-лист смены» открывает чек-лист. CAL — календарь месяца (по умолчанию), лист дня («Отдать
// смену», «Возьму», «Прошу выходной»), «Отметить период», «списком», стрелки месяца в шапке. BOSS — у руководителя «Требует внимания» под месяцем, кнопки
// в один ряд без «Сохранено», в сетке только недобор, светлая шапка читается, «Сегодня» крупнее. FILL — «Кто может?»
// → человек в смену → плашка «1 изменение не сохранено» → «Сохранить» уходит на сервер. SWAP, CONFLICT, AUDIT, MONTHS.
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

if (want("STAFF")) for (const w of [393, 360]) for (const light of [false, true]) {
  const nm = "STAFF " + w + (light ? " светлая" : " тёмная");
  const { ctx, page, errors } = await openSched({ light, w });
  await sleep(700);   // заработок «досчитывается» за 0,6 с
  const g = await staffGeo(page);
  const td = now.getDate(), dowF = DOWF[(now.getDay() + 6) % 7];
  ok(nm + ": карточка ближайшей смены первой, под ней медальоны", g.hero && g.med && g.hero.top < g.med.top, JSON.stringify([g.hero && g.hero.top, g.med && g.med.top]));
  ok(nm + ": листок 46×50 с сегодняшним числом; «сегодня · " + dowF + "», «Вечер», время золотом", g.hero && g.hero.page && g.hero.page.w === 46 && g.hero.page.h === 50 && g.hero.day === String(td)
    && g.hero.text.toLowerCase().includes("сегодня · " + dowF) && g.hero.text.includes("Вечер") && g.hero.timeColor === (light ? GOLD_LT : GOLD_DK), JSON.stringify([g.hero && g.hero.page, g.hero && g.hero.day, g.hero && g.hero.timeColor]));
  ok(nm + ": «16:00–24:00 8 ч · через 1 ч 40 мин», нить суток", g.hero && /16:00–24:00 8 ч · через 1 ч 40 мин/.test(g.hero.text) && g.hero.thread && g.hero.status === "soon", g.hero && g.hero.text.slice(0, 90));
  ok(nm + ": старший со звонком, «Чек-лист смены», «Кто со мной · N»", g.hero && g.hero.lead && /старший смены/i.test(g.hero.text) && g.hero.check && /^Кто со мной · \d+$/.test(g.hero.mates || ""), g.hero && g.hero.mates);
  ok(nm + ": медальоны — часы, заработок, смены; расчёт строкой", g.med && g.med.cells.map((c) => c.k).join() === "hours,pay,shifts" && /^\d+\/160 часов/i.test(g.med.cells[0].t)
    && /^₽ \d[\d\s]* ≈ за месяц \+[\d\s]+ ₽ за 2 смены$/i.test(g.med.cells[1].t.replace(/ /g, " ")) && /^\d+ смен/i.test(g.med.cells[2].t) && /^≈ [\d\s ]+ ₽ — \d+ ч × 220, по сменам в графике/.test((g.med.note || "").replace(/ /g, " ")),
    JSON.stringify(g.med && g.med.cells.map((c) => c.t)) + " | " + (g.med && g.med.note));
  ok(nm + ": старых строк нет — «Заработок за месяц», «Возьмёшь ещё», «ближайшая смена» строкой", !/Заработок за месяц|Возьмёшь ещё 2 смены|ближайшая смена/i.test(g.body));
  const offer = FX.offerDay, offerTxt = "отдаёт смену · " + DOWL[FX.dow(offer)] + ", " + offer + " " + MONTHS_R[now.getMonth()] + " · День 12:00–20:00";
  ok(nm + ": обмен словами — «" + offerTxt + "», без «-е (Д)»", g.body.includes(offerTxt) && !/\d-е \([А-Я]\)/.test(g.body), "");
  ok(nm + ": всё в своих рамках, без прокрутки вбок", g.hero.fits && g.med.fits && g.sw <= g.iw, JSON.stringify([g.hero.fits, g.med.fits, g.sw, g.iw]));
  // экран графика — колонка flex фиксированной высоты: карточка с overflow:hidden не должна сжиматься в полоску
  ok(nm + ": карточка смены не сжата (высота по содержимому, ничего не срезано), медальоны тоже", g.hero.h >= 190 && g.hero.clip <= 1 && g.med.h >= 80, JSON.stringify([g.hero.h, g.hero.clip, g.med.h]));
  if (light) { const sm = await smallText(page, "[data-sched-medals]", 11); ok(nm + ": в медальонах мелкого текста нет (от 11 px)", sm === "", sm); }
  await page.evaluate(() => { const w = document.querySelector(".sa-schedwrap"); w.scrollTop = 0; }); await sleep(200);
  await page.screenshot({ path: OUT + "/staff-" + (light ? "light" : "dark") + "-" + w + ".png" });
  ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

if (want("STATES")) {
  { const fx = clone(FX); fx.dow = FX.dow; const td = now.getDate(); fx.plan[9][td] = "У"; if (td < FX.DAYS) fx.plan[9][td + 1] = "Д";
    const { ctx, page, errors } = await openSched({ fx, time: at(19, 5) });
    const g = await staffGeo(page);
    const want1 = td < FX.DAYS ? "завтра · " + DOWF[(now.getDay() + 7) % 7] : "";
    ok("STATES: утренняя смена закончилась — карточка зовёт следующую (" + (want1 || "конец месяца") + "), без нити", td >= FX.DAYS || (g.hero && g.hero.text.toLowerCase().includes(want1) && !g.hero.thread && g.hero.status === "later"), g.hero && g.hero.text.slice(0, 60));
    ok("STATES: чек-лист сегодняшней смены остаётся", !!(g.hero && g.hero.check));
    ok("STATES: без ошибок", errors.length === 0, errors.slice(0, 2).join(" | ")); await ctx.close(); }
  { const fx = clone(FX); fx.dow = FX.dow; const td = now.getDate(); for (let d = td; d <= FX.DAYS; d++) fx.plan[9][d] = "";
    const { ctx, page, errors } = await openSched({ fx });
    const g = await staffGeo(page);
    ok("STATES: смен в месяце больше нет — тихая карточка", g.hero && g.hero.status === "none" && g.hero.text.includes("в этом месяце смен больше нет"), g.hero && g.hero.text);
    ok("STATES: без ошибок (нет смен)", errors.length === 0, errors.slice(0, 2).join(" | ")); await ctx.close(); }
  { const bank = ALL_Q.slice(0, 3).map((q) => ({ q: q.q, options: q.options, correct: q.correct, lessonTitle: "Тест", stage: 0, due: 1 }));
    const { ctx, page, errors } = await openSched({ storage: { "sa_mistakes{uk}": bank } });
    const g = await staffGeo(page);
    ok("STATES: есть вопросы на повтор — «3 вопроса ждут повтора · Повторить перед сменой» в карточке", g.hero && /3 вопроса ждут повтора Повторить перед сменой/.test(g.hero.due || ""), g.hero && g.hero.due);
    ok("STATES: без ошибок (повтор)", errors.length === 0, errors.slice(0, 2).join(" | ")); await ctx.close(); }
}

if (want("TAPS")) {
  { const { ctx, page, errors } = await openSched();
    await page.locator("[data-hero-mates]").click(); await sleep(700);
    const r = await page.evaluate((d) => { const sh = document.querySelector('[data-day-sheet="' + d + '"]'); if (!sh) return null;
      return { faces: sh.querySelectorAll("[data-sheet-face]").length, text: /с тобой в смене · \d+/i.test(sh.innerText), letters: /\([А-ЯЁ]\)/.test(sh.innerText) }; }, now.getDate());
    ok("TAPS: «Кто со мной» в календаре открывает лист сегодняшнего дня — лица по времени прихода", r && r.text && r.faces >= 5, JSON.stringify(r));
    await page.locator("[data-day-sheet] button", { hasText: "Закрыть" }).click(); await sleep(300);
    await page.locator("[data-hero-lead] [aria-label^='Позвонить']").click(); await sleep(300);
    const num = await page.evaluate(() => /\+7 914 000-11-22/.test(document.querySelector("[data-hero-lead]").innerText));
    ok("TAPS: круглая кнопка звонка у старшего показывает номер (та же логика, что у капсулы)", num);
    ok("TAPS: без ошибок (кто со мной)", errors.length === 0, errors.slice(0, 2).join(" | ")); await ctx.close(); }
  { const { ctx, page, errors } = await openSched({ storage: { sa_sched_view: "list" } });
    await page.locator("[data-hero-mates]").click(); await sleep(900);
    const r = await page.evaluate((d) => { const row = document.querySelector('[data-list-day="' + d + '"]'); if (!row) return null; const b = row.getBoundingClientRect();
      return { open: /в смене с тобой/i.test(row.innerText), inView: b.top >= -2 && b.top < innerHeight - 80, letters: /\([А-ЯЁ]\)/.test(row.innerText) }; }, now.getDate());
    ok("TAPS: в виде «списком» «Кто со мной» раскрывает сегодняшний день и подводит к нему", r && r.open && r.inView, JSON.stringify(r));
    ok("TAPS: в составе дня — смены словами («(день)»), без букв «(Д)»", r && !r.letters, JSON.stringify(r));
    ok("TAPS: без ошибок (список)", errors.length === 0, errors.slice(0, 2).join(" | ")); await ctx.close(); }
  { const { ctx, page, errors } = await openSched();
    await page.locator("[data-hero-checklist]").click(); await sleep(1500);
    const r = await page.evaluate(() => ({ sched: !!document.querySelector("[data-sched-hero]"), text: /чек-лист/i.test(document.body.innerText) }));
    ok("TAPS: «Чек-лист смены» открывает чек-лист", !r.sched && r.text, JSON.stringify(r));
    ok("TAPS: без ошибок (чек-лист)", errors.length === 0, errors.slice(0, 2).join(" | ")); await ctx.close(); }
}

// ── CAL. Календарь месяца, лист дня, обмен, пожелания, период, «списком», стрелки месяца ──
const calGeo = (page) => page.evaluate(() => {
  const cal = document.querySelector("[data-sched-cal]"); if (!cal) return null;
  const cells = [...cal.querySelectorAll("[data-cal-day]")];
  const cs = (el) => getComputedStyle(el);
  const byDay = (d) => cal.querySelector('[data-cal-day="' + d + '"]');
  return { n: cells.length, legend: cal.innerText.replace(/\s+/g, " "), byDay: (d) => null,
    cells: cells.map((c) => ({ d: +c.getAttribute("data-cal-day"), k: c.getAttribute("data-cal-k"), t: c.innerText.replace(/\s+/g, " ").trim(), op: +cs(c).opacity, dashed: cs(c).borderStyle === "dashed", ring: cs(c).boxShadow !== "none", al: c.getAttribute("aria-label") })),
    sw: document.documentElement.scrollWidth, iw: innerWidth };
});
if (want("CAL")) {
  const td = now.getDate();
  for (const w of [393, 360]) {
    const { ctx, page, errors } = await openSched({ w });
    const g = await calGeo(page);
    const cell = (d) => g && g.cells.find((c) => c.d === d);
    ok("CAL " + w + ": по умолчанию — календарь, все дни месяца", g && g.n === FX.DAYS, g && String(g.n));
    ok("CAL " + w + ": сегодня — смена «16–24» в золотой рамке; прошедшие бледнее", cell(td) && /^\d+ 16–24$/.test(cell(td).t) && cell(td).ring && cell(td).op === 1 && (td === 1 || cell(1).op < 0.5), JSON.stringify([cell(td), cell(1) && cell(1).op]));
    const wd = FX.wishes.find((x) => x.staff_id === 9 && x.kind === "off" && x.day > td);
    ok("CAL " + w + ": день с просьбой — солнце; смену коллеги можно взять — пунктир и ⇄", (!wd || /прошу выходной/.test(cell(wd.day).al)) && cell(FX.offerDay).dashed && /⇄/.test(cell(FX.offerDay).t), JSON.stringify([wd && cell(wd.day), cell(FX.offerDay)]));
    ok("CAL " + w + ": легенда и подсказка", /День/.test(g.legend) && /Вечер/.test(g.legend) && /можно взять/.test(g.legend) && /Тапни день — кто с тобой, пожелание, обмен или заметка/.test(g.legend) && /Отметить период/.test(g.legend), g.legend.slice(0, 200));
    ok("CAL " + w + ": календарь в ширину экрана, без прокрутки вбок", g.sw <= g.iw, g.sw + "/" + g.iw);
    ok("CAL " + w + ": отдельной сетки «Моих пожеланий» и списка дней в виде «месяц» нет", !(await page.locator("text=МОИ ПОЖЕЛАНИЯ").count()) && !(await page.locator("[data-list-day]").count()));
    ok("CAL " + w + ": без ошибок", errors.length === 0, errors.slice(0, 2).join(" | "));
    await ctx.close();
  }
  // лист дня: «Отдать смену» своей будущей смены
  { const calls = [];
    const myFuture = Object.keys(FX.plan[9]).map(Number).filter((d) => d > td && FX.plan[9][d]).sort((a, b) => a - b)[0];
    const { ctx, page, errors } = await openSched({ calls });
    await page.locator('[data-cal-day="' + myFuture + '"]').click(); await sleep(600);
    const head = await page.evaluate((d) => document.querySelector('[data-day-sheet="' + d + '"]').innerText.replace(/\s+/g, " "), myFuture);
    ok("CAL: лист своей смены — день, смена и время, «с тобой в смене», «Отдать смену», заметка", /С ТОБОЙ В СМЕНЕ · \d+/i.test(head) && /Отдать смену/.test(head) && /ЗАМЕТКА/i.test(head) && /\d+:00–\d+:00/.test(head), head.slice(0, 160));
    await page.locator("[data-sheet-giveaway]").click(); await sleep(700);
    const c = calls.find((x) => x.fn === "swap_create");
    ok("CAL: «Отдать смену» — заявка на обмен этого дня (swap_create)", c && c.body.p_day === myFuture && c.body.p_k === FX.plan[9][myFuture] && c.body.p_staff === "9", JSON.stringify(c && c.body));
    ok("CAL: без ошибок (отдать)", errors.length === 0, errors.slice(0, 2).join(" | ")); await ctx.close(); }
  // лист дня: смена коллеги — «Возьму»
  { const calls = [];
    const { ctx, page, errors } = await openSched({ calls });
    await page.locator('[data-cal-day="' + FX.offerDay + '"]').click(); await sleep(600);
    const t = await page.evaluate((d) => document.querySelector('[data-day-sheet="' + d + '"]').innerText.replace(/\s+/g, " "), FX.offerDay);
    ok("CAL: в выходной со сменой коллеги — «Морозова Ксения отдаёт эту смену · День 12:00–20:00 · Возьму» и пожелания", /Морозова Ксения отдаёт эту смену · День 12:00–20:00 Возьму/.test(t) && /Прошу выходной/.test(t) && /Не смогу выйти/.test(t), t.slice(0, 220));
    await page.locator("[data-sheet-take]").click(); await sleep(700);
    const c = calls.find((x) => x.fn === "swap_take");
    ok("CAL: «Возьму» — отклик на обмен (swap_take)", c && c.body.p_id === 1 && c.body.p_staff === "9", JSON.stringify(c && c.body));
    ok("CAL: без ошибок (возьму)", errors.length === 0, errors.slice(0, 2).join(" | ")); await ctx.close(); }
  // лист дня: «Прошу выходной» в свободный будущий день
  { const calls = [];
    const free = Array.from({ length: FX.DAYS }, (_, i) => i + 1).find((d) => d > td + 1 && !FX.plan[9][d] && d !== FX.offerDay && !FX.wishes.some((x) => x.staff_id === 9 && x.day === d));
    const { ctx, page, errors } = await openSched({ calls });
    if (free) {
      await page.locator('[data-cal-day="' + free + '"]').click(); await sleep(500);
      await page.locator("[data-sheet-wish]").click(); await sleep(700);
      const c = calls.find((x) => x.fn === "schedule_wish_set");
      const btn = await page.locator("[data-sheet-wish]").innerText();
      ok("CAL: «Прошу выходной» — просьба уходит (schedule_wish_set), кнопка — «Отозвать просьбу»", c && c.body.p_day === free && c.body.p_on === true && c.body.p_kind === "off" && /Отозвать просьбу/.test(btn), JSON.stringify([c && c.body, btn]));
      await page.locator("[data-day-sheet] button", { hasText: "Закрыть" }).click(); await sleep(300);
      const al = await page.locator('[data-cal-day="' + free + '"]').getAttribute("aria-label");
      ok("CAL: в календаре у дня — «прошу выходной»", /прошу выходной/.test(al), al);
    } else ok("CAL: свободный день для просьбы найден", false);
    ok("CAL: без ошибок (просьба)", errors.length === 0, errors.slice(0, 2).join(" | ")); await ctx.close(); }
  // «Отметить период»: первый тап — начало, второй — конец, лист «что отметить»
  { const free = Array.from({ length: FX.DAYS }, (_, i) => i + 1).filter((d) => d > td + 1 && !FX.plan[9][d]);
    const { ctx, page, errors } = await openSched();
    if (free.length >= 2) {
      await page.locator("[data-cal-wishes] button", { hasText: "Отметить период" }).click(); await sleep(300);
      await page.locator('[data-cal-day="' + free[0] + '"]').click(); await sleep(300);
      const mid = await page.evaluate(() => ({ sheet: !!document.querySelector("[data-day-sheet]"), hint: /Теперь тапни последний день периода/.test(document.querySelector("[data-sched-cal]").innerText) }));
      await page.locator('[data-cal-day="' + free[1] + '"]').click(); await sleep(500);
      const ask = await page.evaluate(() => /что отметить/i.test(document.body.innerText) ? document.body.innerText.match(/\d+–\d+ [а-я]+ · \d+ дн\./) : null);
      ok("CAL: «Отметить период» — первый тап не открывает лист, второй — «что отметить» с периодом", !mid.sheet && mid.hint && ask && ask[0].startsWith(free[0] + "–" + free[1]), JSON.stringify([mid, ask && ask[0]]));
    } else ok("CAL: два свободных дня для периода", false);
    ok("CAL: без ошибок (период)", errors.length === 0, errors.slice(0, 2).join(" | ")); await ctx.close(); }
  // «списком» — прежний список и «Мои пожелания»; выбор помнится
  { const { ctx, page, errors } = await openSched();
    await page.locator("[data-sched-viewtoggle] button", { hasText: "списком" }).click(); await sleep(600);
    const r = await page.evaluate(() => ({ rows: document.querySelectorAll("[data-list-day]").length, cal: !!document.querySelector("[data-sched-cal]"), wish: /мои пожелания/i.test(document.body.innerText), saved: localStorage.getItem("sa_sched_view") }));
    ok("CAL: «списком» — прежний список дней и «Мои пожелания», календаря нет; выбор сохранён", r.rows === FX.DAYS && !r.cal && r.wish && r.saved === "list", JSON.stringify(r));
    ok("CAL: без ошибок (списком)", errors.length === 0, errors.slice(0, 2).join(" | ")); await ctx.close(); }
  // стрелки месяца в шапке
  { const { ctx, page, errors } = await openSched();
    const t0 = await page.evaluate(() => document.querySelector(".sa-schedwrap").innerText.match(/(Январь|Февраль|Март|Апрель|Май|Июнь|Июль|Август|Сентябрь|Октябрь|Ноябрь|Декабрь) \d{4}/g));
    await page.locator('[data-month-arrow="1"]').click(); await sleep(1600);
    const t1 = await page.evaluate(() => document.querySelector(".sa-schedwrap").innerText.match(/(Январь|Февраль|Март|Апрель|Май|Июнь|Июль|Август|Сентябрь|Октябрь|Ноябрь|Декабрь) \d{4}/g));
    const MN = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
    const nm = MN[(now.getMonth() + 1) % 12];
    ok("CAL: месяц в шапке один раз; стрелка «›» листает на " + nm, t0 && t0.length === 1 && t1 && t1[0].startsWith(nm), JSON.stringify([t0, t1]));
    ok("CAL: без ошибок (стрелки)", errors.length === 0, errors.slice(0, 2).join(" | ")); await ctx.close(); }
}

const bossGeo = (page) => page.evaluate(() => {
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const wrap = document.querySelector(".sa-schedwrap");
  const attn = document.querySelector("[data-attn]"), actions = document.querySelector("[data-sched-actions]");
  const navBtn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "›");
  const rows = attn ? [...attn.querySelectorAll("[data-attn-row]")].map((x) => ({ k: x.getAttribute("data-attn-row"), pos: x.getAttribute("data-attn-pos"), t: x.innerText.replace(/\s+/g, " ").trim() })) : [];
  const grp = [...document.querySelectorAll(".sa-schedgrid td.sa-schedgrp:not(.sa-schednm)")];
  const th = [...document.querySelectorAll(".sa-schedgrid th b")];
  const dots = [...document.querySelectorAll("span[title]")].filter((s) => s.style.borderRadius === "50%" && s.closest("[style]") && !s.closest(".sa-schedgrid"));
  return {
    attn: attn ? { h: Math.round(r(attn).height), clip: attn.scrollHeight - attn.clientHeight, top: Math.round(r(attn).top + wrap.scrollTop), label: attn.querySelector("span:last-child") ? attn.firstElementChild.innerText.replace(/\s+/g, " ") : "", rows, text: attn.innerText.replace(/\s+/g, " ") } : null,
    navBottom: navBtn ? Math.round(r(navBtn).bottom + wrap.scrollTop) : null, actions: actions ? { top: Math.round(r(actions).top + wrap.scrollTop), text: actions.innerText.replace(/\s+/g, " ").trim() } : null,
    grpText: grp.map((c) => c.innerText.trim()).filter(Boolean), short: [...document.querySelectorAll(".sa-schedgrid [data-short]")].length, ok: [...document.querySelectorAll(".sa-schedgrid [data-ok]")].length,
    thColors: th.slice(0, 5).map((b) => getComputedStyle(b).color), dot: dots[0] ? { w: Math.round(r(dots[0]).width), fs: parseFloat(getComputedStyle(dots[0]).fontSize) } : null,
    savebar: document.querySelector("[data-savebar]") ? document.querySelector("[data-savebar]").innerText.replace(/\s+/g, " ").trim() : null,
    sw: document.documentElement.scrollWidth, iw: innerWidth, body: wrap.innerText.replace(/\s+/g, " "),
  };
});

if (want("BOSS")) for (const light of [false, true]) {
  const nm = "BOSS" + (light ? " светлая" : " тёмная");
  const { ctx, page, errors } = await openSched({ light, profile: RA });
  const g = await bossGeo(page);
  ok(nm + ": «Требует внимания» — под месяцем, над кнопками", g.attn && g.navBottom && g.actions && g.attn.top > g.navBottom - 2 && g.attn.top < g.actions.top, JSON.stringify([g.navBottom, g.attn && g.attn.top, g.actions && g.actions.top]));
  ok(nm + ": в карточке — недобор по позициям с днями и обмен с «Подтвердить / отклонить»", g.attn && g.attn.rows.some((x) => x.k === "hole" && /^Не хватает: [а-яё]+ .*\d/.test(x.t) && /Кто может\?$/.test(x.t))
    && g.attn.rows.some((x) => x.k === "swap" && /Обмен: Соколов Дмитрий → Новиков Кирилл .* · День 12:00–20:00 Подтвердить отклонить/.test(x.t)) && /ближайшие 7 дней/i.test(g.attn.label), JSON.stringify(g.attn && g.attn.rows.map((x) => x.t)));
  ok(nm + ": «Все замечания месяца: N ›»", g.attn && /Все замечания месяца: \d+ ›/.test(g.attn.text));
  ok(nm + ": карточка «Требует внимания» не сжата", g.attn && g.attn.clip <= 1 && g.attn.h >= 200, JSON.stringify([g.attn && g.attn.h, g.attn && g.attn.clip]));
  ok(nm + ": кнопки в один ряд — «Заполнить черновик», «Ещё», без «Сохранено»", g.actions && /^Заполнить черновик Ещё ▾$/.test(g.actions.text) && !/Сохранено/.test(g.body), g.actions && g.actions.text);
  ok(nm + ": отдельной карточки «Обмены ждут решения» нет", !/Обмены ждут решения/i.test(g.body));
  ok(nm + ": в строках должностей — только недобор: «−1» и бледные галочки, без «1/1»", g.short > 0 && g.ok > 0 && !g.grpText.some((t) => /^\d+\/\d+$/.test(t)), JSON.stringify([g.short, g.ok, g.grpText.slice(0, 8)]));
  if (light) ok(nm + ": номера дней в шапке таблицы — тёмные, читаются", g.thColors.filter((c, i) => c === "rgb(42, 31, 14)").length >= 3, JSON.stringify(g.thColors));
  if (light) { const bc = await page.evaluate(() => { const b = document.querySelector("[data-attn-row] button"); return b ? getComputedStyle(b).color : null; });
    ok(nm + ": «Кто может?» — тёмным золотом, читается на кремовом", bc === "rgb(122, 90, 34)", bc); }
  ok(nm + ": свёрнутая «Сегодня» — кружки 30 px, буквы 11 px", g.dot && g.dot.w === 30 && g.dot.fs === 11, JSON.stringify(g.dot));
  ok(nm + ": плашки «Сохранить» без изменений нет", g.savebar === null);
  ok(nm + ": без прокрутки вбок", g.sw <= g.iw, g.sw + "/" + g.iw);
  await page.screenshot({ path: OUT + "/boss-" + (light ? "light" : "dark") + ".png" });
  ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

if (want("FILL")) {
  const calls = [];
  const { ctx, page, errors } = await openSched({ profile: RA, calls });
  // первая дыра, где есть кому выйти
  const rows = await page.locator('[data-attn-row="hole"]').count();
  let opened = null;
  for (let i = 0; i < rows && !opened; i++) {
    await page.locator('[data-attn-row="hole"] button', { hasText: "Кто может?" }).nth(i).click(); await sleep(500);
    const n = await page.locator("[data-fill-pick]").count();
    if (n) opened = await page.evaluate(() => { const s = document.querySelector("[data-fill-sheet]"); return s.innerText.replace(/\s+/g, " "); });
    else { await page.locator("[data-fill-sheet] button", { hasText: "Закрыть" }).click(); await sleep(300); }
  }
  ok("FILL: «Кто может?» — лист «КТО МОЖЕТ ВЫЙТИ» с позицией, сменой и списками", !!opened && /КТО МОЖЕТ ВЫЙТИ · [А-Я]{2} · \d+ [А-Я]+/.test(opened) && /МОГУТ ВЫЙТИ · \d+/.test(opened) && /нужно \d+, в смене \d+/.test(opened), (opened || "").slice(0, 160));
  if (opened) await page.screenshot({ path: OUT + "/boss-fill-sheet.png" });
  if (opened) {
    const pick = await page.locator("[data-fill-pick]").first().getAttribute("data-fill-pick");
    await page.locator("[data-fill-pick]").first().click(); await sleep(700);
    const g = await bossGeo(page);
    ok("FILL: человек поставлен — лист закрылся, плашка «1 изменение не сохранено · команда их пока не видит · Сохранить»", !(await page.locator("[data-fill-sheet]").count()) && g.savebar === "1 изменение не сохранено команда их пока не видит Сохранить", g.savebar);
    ok("FILL: «↩» появился в ряду кнопок", g.actions && /^Заполнить черновик ↩ Ещё ▾$/.test(g.actions.text), g.actions && g.actions.text);
    const bar = await page.evaluate(() => { const b = document.querySelector("[data-savebar]").getBoundingClientRect(); return { bottom: Math.round(innerHeight - b.bottom), visible: b.top < innerHeight && b.bottom > 0 }; });
    ok("FILL: плашка — у нижнего края экрана, видна без прокрутки", bar.visible && bar.bottom >= 8 && bar.bottom <= 40, JSON.stringify(bar));
    await page.locator("[data-savebar] button", { hasText: "Сохранить" }).click(); await sleep(900);
    const sv = calls.filter((c) => c.fn === "schedule_save_month").pop();
    let payload = null; try { payload = JSON.parse(sv.body.p_payload); } catch (e) {}
    const g2 = await bossGeo(page);
    ok("FILL: «Сохранить» уходит на сервер с новой клеткой, плашка исчезает", !!payload && Object.values(payload.plan[pick] || {}).length > 0 && g2.savebar === null, JSON.stringify([!!payload, g2.savebar]));
    await page.locator("[data-sched-actions] button", { hasText: "↩" }).click(); await sleep(500);
    const g3 = await bossGeo(page);
    ok("FILL: «↩» после сохранения — снова черновик, плашка возвращается", g3.savebar && /^1 изменение не сохранено/.test(g3.savebar), g3.savebar);
  }
  await page.screenshot({ path: OUT + "/boss-fill.png" });
  ok("FILL: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

if (want("SWAP")) {
  const calls = [];
  const { ctx, page, errors } = await openSched({ profile: RA, calls });
  await page.locator('[data-attn-row="swap"] [role="button"]', { hasText: "Подтвердить" }).click(); await sleep(800);
  const rs = calls.find((c) => c.fn === "swap_resolve");
  const g = await bossGeo(page);
  ok("SWAP: «Подтвердить» — swap_resolve с согласием, строка обмена ушла, плашка «Сохранить» появилась", rs && rs.body.p_approve === true && rs.body.p_id === 2 && !g.attn.rows.some((x) => x.k === "swap") && /не сохранен/.test(g.savebar || ""), JSON.stringify([rs && rs.body, g.savebar]));
  ok("SWAP: без ошибок", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

if (want("CONFLICT")) {
  const fx = clone(FX); fx.dow = FX.dow; const td = now.getDate();
  // «не смогу» у Морозовой на завтра, а смена стоит
  const d = Math.min(FX.DAYS, td + 1); fx.plan[10] = { ...(fx.plan[10] || {}), [d]: "Д" }; fx.wishes = [...fx.wishes, { staff_id: 10, day: d, kind: "hard" }];
  const { ctx, page, errors } = await openSched({ fx, profile: RA });
  const g = await bossGeo(page);
  const row = g.attn && g.attn.rows.find((x) => x.k === "conflict");
  ok("CONFLICT: «Морозова Ксения не сможет выйти · … стоит смена «День 12:00–20:00»» первой строкой, «Кто вместо?»", row && g.attn.rows[0].k === "conflict" && /Морозова Ксения не сможет выйти .* стоит смена «День 12:00–20:00» Кто вместо\?/.test(row.t), row && row.t);
  await page.locator('[data-attn-row="conflict"] button', { hasText: "Кто вместо?" }).click(); await sleep(600);
  const repl = await page.evaluate(() => /КТО ВМЕСТО · \d+/.test(document.body.innerText));
  ok("CONFLICT: «Кто вместо?» открывает прежний подбор замены", repl);
  ok("CONFLICT: без ошибок", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

if (want("AUDIT")) {
  const { ctx, page, errors } = await openSched({ profile: RA });
  await page.locator("[data-attn] span", { hasText: "Все замечания месяца" }).click(); await sleep(900);
  const r = await page.evaluate(() => { const a = document.querySelector("[data-sec-audit]"); const sec = a && a.nextElementSibling; const b = sec && sec.getBoundingClientRect();
    return { open: !!sec && /Замечаний: \d+|Нарушений нет/.test(sec.innerText), inView: !!b && b.top >= -4 && b.top < innerHeight - 60 }; });
  ok("AUDIT: «Все замечания» раскрывает «Проверку и зарплату» и подводит к ней", r.open && r.inView, JSON.stringify(r));
  ok("AUDIT: без ошибок", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

if (want("MONTHS")) {
  const { ctx, page, errors } = await openSched({ profile: RA });
  await page.locator("button", { hasText: /^›$/ }).first().click(); await sleep(1800);
  const g1 = await bossGeo(page);
  ok("MONTHS: будущий месяц — «весь месяц»", g1.attn && /весь месяц/i.test(g1.attn.label), g1.attn && g1.attn.label);
  await page.locator("button", { hasText: /^‹$/ }).last().click(); await sleep(1800);
  await page.locator("button", { hasText: /^‹$/ }).last().click(); await sleep(1800);
  const g2 = await bossGeo(page);
  ok("MONTHS: прошлый месяц — дыр и «не смогу» в карточке нет (поправлять нечего)", !g2.attn || !g2.attn.rows.some((x) => x.k === "hole" || x.k === "conflict"), JSON.stringify(g2.attn && g2.attn.rows.map((x) => x.k)));
  ok("MONTHS: без ошибок", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
