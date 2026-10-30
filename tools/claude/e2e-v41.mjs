// e2e v41: главная снова минималистичная — «Шаг дня» тонкой строкой в карточке трека, «Путь мастера» чипом в строке
// роли (вместо карточки v40 под треком); строка открывает дело и уходит, когда сделано; новичку — «Первые шаги» на чипе;
// светлая тема от 13 px. SHOT — снимки главной для сравнения «было / стало».
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5260, OUT = "/home/claude/preview/shots-v41";
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

// ── SHOT. Снимок главной (для сравнения «было / стало»: E2E_SITE=site-v40b SHOT_NAME=home-v40) ──
if (want("SHOT")) {
  for (const light of [false, true]) {
    const { ctx, page } = await open({ storage: { ...BASE41(), "sa_step{uk}": STEP_FRESH }, light, w: 390, h: 844 });
    await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1500);
    const g = await homeGeo(page);
    await shot(page, (process.env.SHOT_NAME || "home") + (light ? "-light" : "-dark"));
    ok("SHOT " + (light ? "light" : "dark") + ": снято", true, JSON.stringify({ cardH: g.cardH, gap: g.gap, schedY: g.schedY }));
    await ctx.close();
  }
}

// ── HOME41. Шаг дня строкой, чип «Путь мастера», строка открывает дело и уходит, когда сделано ──
if (want("HOME41")) {
  const tag = "HOME41";
  const { ctx, page, errors } = await open({ storage: { ...BASE41(), "sa_step{uk}": STEP_FRESH } });
  await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1300);
  const g = await homeGeo(page);
  ok(tag + ": карточки «Шаг дня / Путь мастера» под треком больше нет", !g.hasCard, JSON.stringify(g).slice(0, 220));
  ok(tag + ": шаг дня — тонкая строка внутри карточки трека", g.lineInCard);
  ok(tag + ": «Сделать» — не вторая большая кнопка", g.pills === 0, String(g.pills));
  ok(tag + ": чип «Путь мастера» в строке роли — звёздочка в кольце и «N/14», рядом со свечой и стаканом, в один ряд", /^\d+\/14$/.test(g.chip || "") && g.chipsOneRow && g.ring !== null
    && /^Путь мастера: \d+ из 14 значков, до мастера роли \d+ из 13/.test(g.chipAria || ""), g.chip + " · " + g.chipAria);
  ok(tag + ": новое — точкой на чипе", g.chipNew && /есть новое$/.test(g.chipAria || ""), g.chipAria);
  ok(tag + ": без прокрутки вбок", g.sw <= g.iw, g.sw + "/" + g.iw);
  const t = (await page.locator("[data-ms-line]").innerText()).replace(/\s+/g, " ");
  ok(tag + ": строка — «ШАГ ДНЯ», «Освежи тему «…»» и круглая стрелка", /^ШАГ ДНЯ /.test(t) && t.includes("Освежи тему «" + S0.title + "»") && (await page.locator("[data-ms-line] [data-ms-line-go]").count()) === 1, t);
  await shot(page, "home-dark-390");
  await page.locator("[data-ms-line]").click(); await sleep(1400);
  const tt = await tbText(page);
  ok(tag + ": строка открывает «Освежить» этой темы", (await page.locator(".tb").count()) === 1 && /1 из 3/i.test(tt), tt.slice(0, 120));
  await playAll(page, true, 6);
  await page.locator(".tb .tb-foot .tb-main").click().catch(() => {}); await sleep(900);
  await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1100);
  const g2 = await homeGeo(page);
  ok(tag + ": шаг сделан — строка ушла, чип остался", (await page.locator("[data-ms-line]").count()) === 0 && !!g2.chip, String(g2.chip));
  await page.locator("[data-ms-chip]").click(); await sleep(1500);
  const ms = (await page.locator("[data-ms-screen]").innerText().catch(() => "")).replace(/\s+/g, " ");
  ok(tag + ": чип открывает «Путь мастера», там шаг дня — «сделан»", (await page.locator("[data-ms-screen]").count()) === 1 && /Шаг дня сделан/.test(ms), ms.slice(0, 160));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── NEXT41. Шаг дня = следующий урок трека: строки нет (это и так «Дальше»), в «Пути мастера» — есть ──
if (want("NEXT41")) {
  const tag = "NEXT41";
  const L = S2.lessons.find((l) => l.type === "lesson");
  const st = stepRec({ id: "next:" + L.id, kind: "next", fam: "track", text: "Следующий шаг: «" + L.title + "»", sub: "Продолжи трек с того места, где остановился.", go: "track", payload: { mod: "s2", lesson: L.id } });
  const { ctx, page, errors } = await open({ storage: { ...BASE41(), "sa_step{uk}": st } });
  await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1300);
  ok(tag + ": строки шага нет — главная карточка и так ведёт в этот урок", (await page.locator("[data-ms-line]").count()) === 0);
  const main = await text(page);
  ok(tag + ": главная карточка — этот урок", main.includes(L.title), main.slice(0, 200));
  await page.locator("[data-ms-chip]").click(); await sleep(1500);
  ok(tag + ": в «Пути мастера» шаг дня на месте", (await page.locator("[data-ms-screen] [data-ms-step]").count()) === 1);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── FIRST41. Новичок: чип — «Первые шаги в академии» (x/7) ──
if (want("FIRST41")) {
  const tag = "FIRST41";
  const { ctx, page, errors } = await open({ storage: { ...BASE41(3), "sa_step{uk}": STEP_RADIO } });
  await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1300);
  const g = await homeGeo(page);
  ok(tag + ": чип — «x/7» и «Первые шаги в академии»", /^\d\/7$/.test(g.chip || "") && /^Первые шаги в академии: \d из 7/.test(g.chipAria || ""), g.chip + " · " + g.chipAria);
  const t = (await page.locator("[data-ms-line]").innerText().catch(() => "")).replace(/\s+/g, " ");
  ok(tag + ": строка — «ШАГ ДНЯ · Попробуй: Радио в дорогу»", /^ШАГ ДНЯ Попробуй: Радио в\s*дорогу/.test(t), t);
  await page.locator("[data-ms-line]").click(); await sleep(1500);
  ok(tag + ": строка открывает радио", (await page.locator(".tb .rd-tab, .tb .rd-card, .tb .rd-note").count()) >= 1);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── LT41. Светлая тема «Для чтения», 320 и 390: мелкий текст от 13 px, чипы в один ряд, без прокрутки вбок ──
if (want("LT41")) {
  const tag = "LT41";
  for (const [w, light] of [[320, true], [390, true], [320, false]]) {
    const { ctx, page, errors } = await open({ storage: { ...BASE41(), "sa_step{uk}": STEP_FRESH }, light, w });
    await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1400);
    const g = await homeGeo(page);
    const nm = tag + " " + w + (light ? " светлая" : " тёмная");
    if (light) {
      const s1 = await smallText(page, "[data-ms-line]"), s2 = await smallText(page, "[data-ms-chip]");
      ok(nm + ": строка шага и чип — от 13 px", s1 === "" && s2 === "", s1 + " | " + s2);
    }
    ok(nm + ": чипы в один ряд, без прокрутки вбок", g.chipsOneRow && g.sw <= g.iw, JSON.stringify({ one: g.chipsOneRow, sw: g.sw, iw: g.iw }));
    await shot(page, "home-" + (light ? "light" : "dark") + "-" + w);
    if (light) {
      await page.evaluate(() => window.__saNav("mastery")); await sleep(1600);
      const s3 = await smallText(page, "[data-ms-screen]");
      ok(nm + ": экран «Путь мастера» — от 13 px (метки от 11)", s3 === "", s3);
    }
    ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
