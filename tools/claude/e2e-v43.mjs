// e2e v43 (Доп. 356): ритм дня на главной — табличка с медальонами под приветствием: пламя (серия), бокал (цель дня),
// лавровый венок («Путь мастера»). PANEL — место, размеры и подписи на 320 / 390 / 430 px в обеих темах; TAPS — бокал
// открывает «Цель дня», венок — «Путь мастера»; LIT — пламя горит и колышется, цель выполнена, «уменьшить движение»;
// NOROLE — без роли два медальона; FIRST — новичок «x/7»; TRACK — пламя и бокал в шапке трека.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5260, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v43";
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
async function open({ storage = {}, telegram = false, light = false, w = 390, h = 844, url = "/", schedule = null, fixedTime = null, chat = [], rpcs = null, profile = prof, calls = [], ai = "guest", tts = null, ttsCalls = [], stream = false, assistant = null, motion = "no-preference" }) {
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


// ════════════════════════════ v43: табличка с медальонами ════════════════════════════
const RO = { ...prof, name: "Роман", surname: "Смирнов" };
const OWNER = { id: "u-own", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "senior", is_admin: true };
// как у Романа на снимке: хостес, серия 1 (вчера), цель 3 шага, 4 значка из 14 и новое
const ROMAN = (extra = {}) => { const b = BASE41(); b["sa_life{uk}"] = { ...b["sa_life{uk}"], w: 3, d: 1, g: 1, r: 3 };
  return { ...b, __role: "spg", "sa_streak{uk}": { count: 1, last: DAYS_AGO(1) }, "sa_goal{uk}": "3", ...extra }; };
const panelGeo = (page) => page.evaluate(() => {
  const p = document.querySelector("[data-day-panel]"); if (!p) return null;
  const r = (el) => el.getBoundingClientRect();
  const greet = document.querySelector('div[style*="2px 20px 12px"]');
  const sub = document.querySelector("[data-role-sub]");
  const cells = [...p.querySelectorAll("[data-dp-cell]")].map((c) => {
    const cr = r(c);
    const kids = [...c.querySelectorAll(".de-medal, .sa-dp-txt, .sa-dp-cap, [data-val]")].map(r);
    const cap = c.querySelector(".sa-dp-cap"), medal = c.querySelector(".de-medal");
    return { kind: c.getAttribute("data-dp-cell"), role: c.getAttribute("role"), aria: c.getAttribute("aria-label"),
      fits: kids.length > 0 && kids.every((k) => k.left >= cr.left - 0.5 && k.right <= cr.right + 0.5),
      text: (c.innerText || "").replace(/\s+/g, " ").trim(), capFs: cap ? parseFloat(getComputedStyle(cap).fontSize) : 0,
      medal: medal ? Math.round(r(medal).width) : 0, lit: (c.querySelector("[data-emb=flame]") || { dataset: {} }).dataset.lit || null,
      glow: !!c.querySelector("[data-medal-glow]"), pct: (c.querySelector("[data-emb=wine]") || { dataset: {} }).dataset.pct || null,
      spark: !!c.querySelector("[data-emb-spark]"), leaves: c.querySelectorAll("[data-leaf]").length, dot: !!c.querySelector("[data-ms-chip-new]") };
  });
  const pr = r(p);
  return { cells, top: pr.top, bottom: pr.bottom, left: pr.left, right: pr.right, greetBottom: greet ? r(greet).bottom : null,
    subTop: sub ? r(sub).top : null, subVisible: sub ? r(sub.querySelector("span")).top < r(sub).bottom : null,
    rowLeft: sub && sub.parentElement ? r(sub.parentElement).left : null, rowRight: sub && sub.parentElement ? r(sub.parentElement).right : null,
    sw: document.documentElement.scrollWidth, iw: innerWidth, wide: [...p.querySelectorAll(".sa-dp-w")].map((e) => getComputedStyle(e).display),
    inRoleRow: !!(sub && sub.parentElement && sub.parentElement.querySelector("[data-day-panel]")) };
});
const C = (g, k) => (g && g.cells.find((c) => c.kind === k)) || {};

// ── PANEL. Место, размеры, подписи: 320 / 390 / 430, тёмная и светлая ──
if (want("PANEL")) {
  for (const w of [320, 360, 375, 390, 430]) for (const light of [false, true]) {
    const nm = "PANEL " + w + (light ? " светлая" : " тёмная");
    const { ctx, page, errors } = await open({ storage: ROMAN(), profile: RO, light, w });
    await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1400);
    const g = await panelGeo(page);
    ok(nm + ": табличка есть, в ней три медальона", !!g && g.cells.length === 3, g ? g.cells.map((c) => c.kind).join(",") : "нет");
    if (!g) { await ctx.close(); continue; }
    ok(nm + ": под приветствием, над строкой роли", g.greetBottom !== null && g.top >= g.greetBottom - 1 && g.subTop !== null && g.bottom <= g.subTop && !g.inRoleRow,
      JSON.stringify({ top: Math.round(g.top), greet: Math.round(g.greetBottom || 0), bottom: Math.round(g.bottom), sub: Math.round(g.subTop || 0) }));
    ok(nm + ": края — вровень со строкой роли и карточкой трека, без прокрутки вбок", Math.abs(g.left - g.rowLeft) < 1 && Math.abs(g.right - g.rowRight) < 1 && Math.abs(g.left - (g.iw - g.right)) < 1 && g.sw <= g.iw,
      JSON.stringify({ l: g.left, row: g.rowLeft, r: g.iw - g.right, sw: g.sw }));
    ok(nm + ": всё в своих ячейках (медальон, цифра, подпись)", g.cells.every((c) => c.fits), g.cells.filter((c) => !c.fits).map((c) => c.kind).join(","));
    ok(nm + ": подпись роли видна целиком", g.subVisible === true);
    ok(nm + ": медальоны — " + (w < 375 ? 28 : 34) + " px", g.cells.every((c) => c.medal === (w < 375 ? 28 : 34)), g.cells.map((c) => c.medal).join(","));
    ok(nm + ": подписи — " + (light ? 11 : 9.5) + " px", g.cells.every((c) => c.capFs === (light ? 11 : 9.5)), g.cells.map((c) => c.capFs).join(","));
    const wideOn = w >= 430 && !light;
    ok(nm + ": «подряд» — " + (wideOn ? "есть" : "нет"), g.wide.every((d) => d === (wideOn ? "inline" : "none")), g.wide.join(","));
    ok(nm + ": тексты — «1 день», «0/3 цель" + (w < 375 ? "" : " дня") + "», «4/14 значков»", new RegExp("^1 ДЕНЬ" + (wideOn ? " ПОДРЯД" : "") + "$", "i").test(C(g, "streak").text)
      && new RegExp("^0\\/3 ЦЕЛЬ" + (w < 375 ? "" : " ДНЯ") + "$", "i").test(C(g, "goal").text) && /^4\/14 ЗНАЧКОВ$/i.test(C(g, "mastery").text), g.cells.map((c) => c.text).join(" | "));
    ok(nm + ": роли и подписи для чтения с экрана", C(g, "streak").role === "img" && C(g, "streak").aria === "Серия 1 день" && C(g, "goal").role === "button"
      && C(g, "goal").aria === "Цель дня: 0 из 3. Изменить цель" && C(g, "mastery").role === "button" && /^Путь мастера: 4 из 14 значков/.test(C(g, "mastery").aria || ""), g.cells.map((c) => c.aria).join(" | "));
    ok(nm + ": пламя не горит, ободок 1 из 3; венок — 14 листьев и точка «новое»", C(g, "streak").lit === "0" && !C(g, "streak").glow && C(g, "mastery").leaves === 14 && C(g, "mastery").dot);
    if (light) { const s = await smallText(page, "[data-day-panel]"); ok(nm + ": мелкого текста нет (от 13 px, метки от 11)", s === "", s); }
    await shot(page, "home-" + (light ? "light" : "dark") + "-" + w);
    ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── TAPS. Бокал — «Цель дня» (с бокалом), выбор цели меняет табличку; венок — «Путь мастера» ──
if (want("TAPS")) {
  const { ctx, page, errors } = await open({ storage: ROMAN(), profile: RO });
  await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1400);
  await page.locator('[data-dp-cell="goal"]').click(); await sleep(500);
  const dlg = page.locator('[role="dialog"][aria-label="Цель дня"]');
  const dt = (await dlg.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("TAPS: бокал открывает «Цель дня» — с бокалом и словами про бокал", (await dlg.count()) === 1 && (await dlg.locator('[data-emb="wine"]').count()) === 1 && /Бокал наполняется с каждым шагом/.test(dt), dt.slice(0, 160));
  await shot(page, "goal-sheet");
  await dlg.locator("button", { hasText: "2 шага" }).click(); await sleep(600);
  const g = await panelGeo(page);
  ok("TAPS: цель 2 шага — в табличке «0/2», окно закрылось", (await dlg.count()) === 0 && /^0\/2 ЦЕЛЬ ДНЯ$/i.test(C(g, "goal").text), C(g, "goal").text);
  ok("TAPS: цель сохранена", (await lsGet(page, "sa_goal_Роман_Смирнов")) == 2, String(await lsGet(page, "sa_goal_Роман_Смирнов")));
  await page.locator('[data-dp-cell="mastery"]').click(); await sleep(1500);
  ok("TAPS: венок открывает «Путь мастера»", (await page.locator("[data-ms-screen]").count()) === 1);
  ok("TAPS: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── LIT. Вечер: пламя горит и колышется, цель выполнена; «уменьшить движение» — без колыхания ──
if (want("LIT")) {
  for (const light of [false, true]) {
    const nm = "LIT" + (light ? " светлая" : " тёмная");
    const { ctx, page, errors } = await open({ storage: ROMAN({ "sa_streak{uk}": { count: 5, last: TODAY }, "sa_activity{uk}": { [TODAY]: { st: 3, l: 2, p: 1 } } }), profile: RO, light });
    await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1400);
    const g = await panelGeo(page);
    ok(nm + ": пламя горит, медальон светится, «5 дней»", C(g, "streak").lit === "1" && C(g, "streak").glow && /^5 ДНЕЙ$/i.test(C(g, "streak").text) && C(g, "streak").aria === "Серия 5 дней, сегодня свеча горит", C(g, "streak").text + " · " + C(g, "streak").aria);
    ok(nm + ": цель выполнена — «3/3 цель дня», бокал полный, искра", /^3\/3 ЦЕЛЬ ДНЯ$/i.test(C(g, "goal").text) && C(g, "goal").pct === "100" && C(g, "goal").spark, C(g, "goal").text);
    ok(nm + ": всё в своих ячейках", g.cells.every((c) => c.fits), g.cells.filter((c) => !c.fits).map((c) => c.kind).join(","));
    const anim = await page.evaluate(() => { const f = document.querySelector("[data-day-panel] .de-flame.lit .de-fl"); return f && f.getAnimations ? f.getAnimations().length : -1; });
    ok(nm + ": пламя колышется", anim > 0, String(anim));
    await shot(page, "home-lit-" + (light ? "light" : "dark"));
    ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
  const { ctx, page } = await open({ storage: ROMAN({ "sa_streak{uk}": { count: 5, last: TODAY } }), profile: RO, motion: "reduce" });
  await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1400);
  const anim = await page.evaluate(() => { const f = document.querySelector("[data-day-panel] .de-flame.lit .de-fl"); return f && f.getAnimations ? f.getAnimations().length : -1; });
  ok("LIT: «уменьшить движение» — пламя не колышется", anim === 0, String(anim));
  await ctx.close();
}

// ── NOROLE. Владелец без роли: табличка под приветствием, два медальона ──
if (want("NOROLE")) {
  for (const light of [false, true]) {
    const nm = "NOROLE" + (light ? " светлая" : " тёмная");
    const { ctx, page, errors } = await open({ profile: OWNER, light, storage: { __role: null, "sa_streak{uk}": { count: 2, last: DAYS_AGO(1) } } });
    await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1400);
    const g = await panelGeo(page);
    ok(nm + ": табличка с двумя медальонами, без «Пути мастера»", !!g && g.cells.length === 2 && (await page.locator("[data-ms-chip]").count()) === 0, g ? g.cells.map((c) => c.text).join(" | ") : "нет");
    ok(nm + ": под приветствием, во всю ширину (поля поровну)", !!g && g.greetBottom !== null && g.top >= g.greetBottom - 1 && g.left >= 14 && Math.abs(g.left - (g.iw - g.right)) < 1 && g.sw <= g.iw,
      g ? JSON.stringify({ top: g.top, greet: g.greetBottom, l: g.left, r: g.iw - g.right }) : "");
    ok(nm + ": всё в своих ячейках", !!g && g.cells.every((c) => c.fits));
    await shot(page, "home-owner-" + (light ? "light" : "dark"));
    ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── FIRST. Новичок: «x/7», семь листьев; подпись «старт», на широком экране — «первые шаги» ──
if (want("FIRST")) {
  for (const w of [320, 390, 430]) {
    const nm = "FIRST " + w;
    const { ctx, page, errors } = await open({ storage: { ...BASE41(3), "sa_step{uk}": STEP_RADIO }, w });
    await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1400);
    const g = await panelGeo(page), m = C(g, "mastery");
    ok(nm + ": «x/7 " + (w >= 430 ? "первые шаги" : "старт") + "», семь листьев", new RegExp("^\\d\\/7 " + (w >= 430 ? "ПЕРВЫЕ ШАГИ" : "СТАРТ") + "$", "i").test(m.text || "") && m.leaves === 7
      && /^Первые шаги в академии: \d из 7/.test(m.aria || ""), (m.text || "") + " · " + m.leaves + " · " + m.aria);
    ok(nm + ": всё в своих ячейках", !!g && g.cells.every((c) => c.fits));
    ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── TRACK. Шапка трека: пламя серии и бокал цели вместо свечи и стакана ──
if (want("TRACK")) {
  for (const light of [false, true]) {
    const nm = "TRACK" + (light ? " светлая" : " тёмная");
    const { ctx, page, errors } = await open({ storage: { ...BASE41(), "sa_streak{uk}": { count: 4, last: TODAY }, "sa_activity{uk}": { [TODAY]: { st: 1, l: 1 } } }, light });
    await page.evaluate(() => window.__saNav("home")); await sleep(1600);
    const t = await page.evaluate(() => ({ flame: document.querySelectorAll(".tbp-root [data-emb=flame]").length, lit: (document.querySelector(".tbp-root [data-emb=flame]") || { dataset: {} }).dataset.lit,
      wine: (document.querySelector(".tbp-root [data-emb=wine]") || { dataset: {} }).dataset.pct, candles: document.querySelectorAll(".tbp-root svg.candle").length, glass: document.querySelectorAll(".tbp-root svg.glass").length }));
    ok(nm + ": в шапке — горящее пламя и бокал 1 из 2, свечи и стакана нет", t.flame === 1 && t.lit === "1" && t.wine === "50" && t.candles === 0 && t.glass === 0, JSON.stringify(t));
    await shot(page, "track-" + (light ? "light" : "dark"));
    ok(nm + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
