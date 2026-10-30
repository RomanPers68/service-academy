// e2e v37 (Доп. 348–350): «Живой диалог» — переписка с гостем во ВСЕХ местах, где он открывается в приложении.
//  HS — хостес: урок-диалог в треке («Знакомство» → «Живой диалог: первая встреча»): поверх приложения (портал),
//       карточка гостя, «★ до 3 звёзд», панель ответов «N из M», верные ответы, покадрово — лента без разворотов
//       и прыжков, отзыв со звёздами, «Дальше» — урок засчитан; кнопка «Назад» Telegram видна.
//  HW — хостес: самые резкие неверные ответы — гость уходит (🚪, «Без отзыва», 0 звёзд, «Закрыть»).
//  HE — хостес: «эвакуация у дверей» — у ухода своя фраза и заголовок («Зал в панике»), а не «не дождавшись приёма».
//  HB — хостес: «Назад» Telegram посреди разговора закрывает диалог (стрелка в шапке, data-sa-back) — урок не
//       засчитан; стрелка в шапке посреди разговора — так же. Дошёл до конца (и даже гость ушёл) — засчитан.
//  WT — официант: поппап термина «Антиципация» в уроке «Правило периферии и антиципация» → «Отработать на
//       практике →» → переписка (без звёзд, без «Лучше так»); «Назад» Telegram закрывает только диалог — урок
//       на месте; «Дальше» — тоже только диалог, урок термином не засчитывается.
//  MG — менеджер: поппап термина «Сервис-менеджер» в уроке «Кто такой менеджер зала» → переписка; звук
//       (отправил / ответил) и голос гостя (голос телефона читает реплики, звук сообщений молчит), запоминаются.
//  WG — «Гость недели»: подсказка (2 шага, «кольцо вокруг гостя»), нажатия на переписку торопят, доведённый до
//       конца разговор — страница в Книге (weekly_… в пройденных), переход в Книгу отзывов.
//  LT — светлая тема: экран светлый, реплики и кнопки ответов читаются (контраст ≥ 4,5).
// Запуск: node tools/claude/e2e-v37.mjs [HS HW HE HB WT MG WG LT]; другой сайт — E2E_SITE=/путь
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = 5207, OUT = "/home/claude/preview/shots-v37";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { DIALOGUES_DATA } = await import(SRC + "/data/dialogues.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); return cond; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// staff — кто вошёл; role — открытый трек; hintsOff — какие подсказки ещё НЕ видены
async function open({ staff, role = "seasonal", telegram = false, light = false, hintsOff = [], storage = {} }) {
  const STAFF = staff || { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const J = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const mock = {
        whoami: { ok: true, employee: STAFF }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: role },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "none" }, my_mentors: { ok: true, rows: [] }, menu_get: [],
        guest_personas: { ok: true, rows: [], can_edit: false },
      };
      if (mock[m[1]] !== undefined) return J(mock[m[1]]);
      return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    }
    return route.abort();
  });
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(STAFF), sa_a11y: light ? "1" : "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_last_role: JSON.stringify(role), sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_quest_open: "1", sa_track_swiped: "1" };
  for (const k of Object.keys(HINTS)) if (!hintsOff.includes(k)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  const ukx = "_" + STAFF.name + "_" + (STAFF.surname || "");
  for (const [k, v] of Object.entries(storage)) seed[k.replace("{uk}", ukx)] = typeof v === "string" ? v : JSON.stringify(v);
  await ctx.addInitScript(([seed, telegram]) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (telegram) {
      const handlers = new Set();
      window.__bb = { visible: false, handlers, press() { [...handlers].forEach((h) => h()); } };
      window.Telegram = { WebApp: { initData: "query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc", platform: "ios", initDataUnsafe: {}, ready() {}, expand() {}, setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {},
        showAlert(m) { (window.__alerts = window.__alerts || []).push(m); }, showConfirm(m, cb) { cb && cb(true); },
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
        BackButton: { show() { window.__bb.visible = true; }, hide() { window.__bb.visible = false; }, onClick(h) { handlers.add(h); }, offClick(h) { handlers.delete(h); } } } };
    }
    window.alert = (m) => { (window.__alerts = window.__alerts || []).push(String(m)); };
    // голос телефона: «говорит» 60 мс, что прочитал — в window.__spoken
    try {
      window.__spoken = [];
      const ss = window.speechSynthesis;
      if (ss) {
        let cur = null;
        try { Object.defineProperty(ss, "speaking", { get: () => !!cur, configurable: true }); Object.defineProperty(ss, "pending", { get: () => false, configurable: true }); } catch (e) {}
        ss.speak = (u) => { window.__spoken.push(u.text); cur = u; setTimeout(() => { if (cur !== u) return; cur = null; try { u.onstart && u.onstart(); u.onend && u.onend(); } catch (e) {} }, 60); };
        ss.cancel = () => { const u = cur; cur = null; if (u) setTimeout(() => { try { u.onerror && u.onerror({ error: "canceled" }); } catch (e) {} }, 0); };
      }
    } catch (e) {}
    // звуки (lib/sfx.js): частота каждого «удара» — в window.__tones (send — 520, recv — 988 и 1319)
    try {
      window.__tones = [];
      const BAC = window.BaseAudioContext || window.AudioContext;
      const co = BAC.prototype.createOscillator;
      BAC.prototype.createOscillator = function () {
        const o = co.call(this); const f = o.frequency; const sv = f.setValueAtTime.bind(f);
        f.setValueAtTime = (v, t) => { window.__tones.push(Math.round(v)); return sv(v, t); };
        return o;
      };
    } catch (e) {}
  }, [seed, telegram]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1600);
  return { ctx, page, errors, uk: ukx };
}
const only = process.argv.slice(2);
const want = (tag) => !only.length || only.includes(tag);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const text = (page) => page.evaluate(() => document.body.innerText);

// тема трека по номеру в оглавлении → шаг раздела
async function toLesson(page, topic, lesson) {
  await page.evaluate(() => window.__saNav("home")); await sleep(1500);
  await page.locator('.tbp-num[aria-label*="' + topic + '"]').first().click({ timeout: 6000 });
  await sleep(900);
  await page.locator(".tbm-node:not(.tbp-side *)", { hasText: lesson }).first().click({ timeout: 6000 });
  await sleep(1300);
}
// подсвеченный термин урока на текущей карточке (листаем «›», пока не найдём) → нажатие по нему
async function tapTerm(page, term) {
  for (let i = 0; i < 12; i++) {
    const r = await page.evaluate((term) => {
      const el = [...document.querySelectorAll("span")].find((s) => s.textContent.trim().toLowerCase() === term.toLowerCase()
        && getComputedStyle(s).borderBottomStyle === "dotted" && s.getClientRects().length
        && (() => { const b = s.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.top > 60 && b.bottom < innerHeight - 60; })());
      if (!el) return null;
      const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, term);
    if (r) { await page.mouse.click(r.x, r.y); await sleep(500); return true; }
    await page.locator("span", { hasText: /^›$/ }).last().click().catch(() => {}); await sleep(450);
  }
  return false;
}
const dlgId = (page) => page.evaluate(() => { const d = document.querySelector(".sa-dlg[data-dlg]"); return d ? d.getAttribute("data-dlg") : null; });
const dlgOpen = (page) => page.evaluate(() => !!document.querySelector(".sa-dlg"));
// покадровый след карточки гостя: вся лента едет вместе с ней
const traceOn = (page) => page.evaluate(() => {
  window.__trace = []; window.__traceOn = true;
  const tick = (t) => { if (!window.__traceOn) return; const i = document.querySelector("[data-dlg-msg=intro]"); if (i) window.__trace.push([t, i.getBoundingClientRect().top]); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
const traceOff = async (page) => {
  const tr = await page.evaluate(() => { window.__traceOn = false; return window.__trace; });
  let reversals = 0, jumps = 0, moves = 0, lastDir = 0, lastMoveT = -1e9, path = 0;
  for (let i = 1; i < tr.length; i++) {
    const dy = tr[i][1] - tr[i - 1][1];
    if (Math.abs(dy) < 0.5) continue;
    moves++; path += Math.abs(dy);
    const dir = Math.sign(dy);
    if (lastDir && dir !== lastDir && tr[i][0] - lastMoveT < 120) reversals++;
    const prev = i > 1 ? Math.abs(tr[i - 1][1] - tr[i - 2][1]) : 0, next = i + 1 < tr.length ? Math.abs(tr[i + 1][1] - tr[i][1]) : 0;
    if (Math.abs(dy) > 12 && prev < 1 && next < 1) jumps++;
    lastDir = dir; lastMoveT = tr[i][0];
  }
  return { frames: tr.length, moves, path: Math.round(path), reversals, jumps };
};
// отвечать до конца разговора: how(step, n) → вариант; каждый вопрос — снимок «N из M» и текстов
async function playDialogue(page, how, { hurry = false, onAsk = null } = {}) {
  const id = await dlgId(page);
  const D = DIALOGUES_DATA.find((d) => d.id === id);
  if (!D) return { id, err: "сценарий не найден: " + id };
  if (hurry) await page.evaluate(() => { window.__tap = setInterval(() => { const c = document.querySelector(".dc-chat"); if (c) c.click(); }, 120); });
  const asks = [], picks = [];
  for (let n = 0; n < 40; n++) {
    await page.waitForSelector("[data-dlg-reply]:not([disabled]), [data-dlg-next]", { timeout: 25000 });
    if (await page.locator("[data-dlg-next]").count()) break;
    await sleep(hurry ? 120 : 450);
    const idx = Number(await page.getAttribute("[data-dlg-kb]", "data-dlg-kb"));
    const step = D.steps[idx];
    asks.push(await page.evaluate(() => (document.querySelector(".dc-kb-n") || {}).textContent));
    if (onAsk) await onAsk(n, step);
    const o = how(step, n);
    picks.push(o);
    const texts = await page.evaluate(() => [...document.querySelectorAll("[data-dlg-reply] .dc-opt-t")].map((e) => e.textContent));
    await page.locator(`[data-dlg-reply="${texts.indexOf(o.text)}"]`).click();
  }
  await page.waitForSelector("[data-dlg-next]", { timeout: 25000 });
  if (hurry) await page.evaluate(() => clearInterval(window.__tap));
  await sleep(700);
  const fin = await page.evaluate(() => {
    const rv = document.querySelector("[data-dlg-review]"), st = rv && rv.querySelector(".dc-stars");
    return {
      review: rv ? rv.getAttribute("data-dlg-review") : null, stars: st ? st.getAttribute("aria-label") : null,
      score: rv ? (rv.querySelector(".dc-rv-s") || {}).textContent : null, ey: rv ? (rv.querySelector(".dc-ey") || {}).textContent : null,
      next: (document.querySelector("[data-dlg-next]") || {}).textContent, walk: !!document.querySelector("[data-dlg-msg=walk]"),
      coach: [...document.querySelectorAll("[data-dlg-mentor]")].map((c) => c.getAttribute("data-dlg-mentor")),
      best: document.querySelectorAll(".dc-best").length, me: document.querySelectorAll("[data-dlg-msg=me]").length,
      guests: [...document.querySelectorAll("[data-dlg-msg=guest] .dc-tx")].map((e) => e.textContent),
    };
  });
  return { id, D, asks, picks, ...fin };
}
const right = (step) => step.options.find((o) => o.correct);
const worst = (step) => step.options.filter((o) => !o.correct).sort((a, b) => (Number(a.moodDelta) || 0) - (Number(b.moodDelta) || 0))[0];
const choicesOf = (D) => D.steps.filter((s) => s.type === "choice").length;
const completedOf = (page, uk) => page.evaluate((uk) => { try { return JSON.parse(localStorage.getItem("sa_completed" + uk) || "{}"); } catch (e) { return {}; } }, uk);
const portaled = (page) => page.evaluate(() => { const d = document.querySelector(".sa-dlg"); return !!d && d.parentElement === document.body; });

// ── HS. Хостес: урок-диалог в треке ──
if (want("HS")) {
  const tag = "HS";
  const { ctx, page, errors, uk } = await open({ role: "spg", telegram: true });
  await toLesson(page, "Знакомство", "Живой диалог: первая встреча");
  await page.waitForSelector(".sa-dlg[data-dlg]", { timeout: 8000 }).catch(() => {});
  const id = await dlgId(page);
  ok(tag + ": урок «Живой диалог: первая встреча» — переписка с гостем темы (spg-b0-*)", /^spg-b0-\d$/.test(id || ""), String(id));
  ok(tag + ": экран поверх приложения (портал в body), «Назад» Telegram видна", (await portaled(page)) && (await page.evaluate(() => window.__bb.visible)));
  const intro = await page.evaluate(() => ({ chips: [...document.querySelectorAll("[data-dlg-msg=intro] .dc-chip")].map((c) => c.textContent), ey: (document.querySelector("[data-dlg-msg=intro] .dc-ey") || {}).textContent, name: (document.querySelector(".dc-name") || {}).textContent }));
  const D0 = DIALOGUES_DATA.find((d) => d.id === id) || {};
  ok(tag + ": карточка гостя — «Живой диалог · …», имя в шапке, «★ до 3 звёзд»", /^Живой диалог/.test(intro.ey || "") && intro.name === (D0.guest || {}).name && intro.chips.includes("★ до 3 звёзд"), JSON.stringify(intro));
  await traceOn(page);
  await shot(page, "hs-01-first");
  const r = await playDialogue(page, right, { onAsk: async (n) => { if (n === 0) await shot(page, "hs-02-ask"); } });
  const mo = await traceOff(page);
  const N = choicesOf(r.D);
  ok(tag + ": вопросы «1 из N» … «N из N»", JSON.stringify(r.asks) === JSON.stringify(Array.from({ length: r.asks.length }, (_, i) => `${i + 1} из ${N}`)), JSON.stringify(r.asks));
  ok(tag + ": наставник шепчет «верно» после каждого ответа, «Лучше так» нет", r.coach.length === r.picks.length && r.coach.every((c) => c === "ok") && r.best === 0, JSON.stringify(r.coach));
  ok(tag + ": отзыв гостя со звёздами, «N из N правильных ответов», «Дальше»", r.review !== "walked" && /^\d из 3 звёзд$/.test(r.stars || "") && r.score === `${r.picks.length} из ${r.picks.length} правильных ответов` && r.next === "Дальше", JSON.stringify({ rv: r.review, st: r.stars, sc: r.score, nx: r.next }));
  ok(tag + ": покадрово — лента едет, без разворотов и прыжков", mo.moves > 20 && mo.reversals === 0 && mo.jumps === 0, JSON.stringify(mo));
  await shot(page, "hs-03-review");
  await page.locator("[data-dlg-next]").click(); await sleep(1200);
  const done = await completedOf(page, uk);
  ok(tag + ": «Дальше» — диалог закрыт, урок засчитан (spg-0-d)", !(await dlgOpen(page)) && done["spg-0-d"] === true, JSON.stringify(Object.keys(done)));
  const foreign = await page.evaluate(() => { const el = document.createElement("span"); el.className = "dc"; document.body.appendChild(el); const cs = getComputedStyle(el); const r = { pos: cs.position, op: cs.opacity, z: cs.zIndex, css: !!document.getElementById("sa-dlg-css") }; el.remove(); return r; });
  ok(tag + ": стиль диалога не задевает чужой класс «dc» (клетки недели в «Свече на двоих»)", foreign.css && foreign.pos === "static" && foreign.op === "1", JSON.stringify(foreign));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── HW. Хостес: гость уходит после резких ответов ──
if (want("HW")) {
  const tag = "HW";
  const { ctx, page, errors, uk } = await open({ role: "spg", telegram: true });
  await toLesson(page, "Знакомство", "Живой диалог: первая встреча");
  await page.waitForSelector(".sa-dlg[data-dlg]", { timeout: 8000 }).catch(() => {});
  const r = await playDialogue(page, worst, { hurry: true });
  ok(tag + ": наставник — «неверно» и «Лучше так: «…»» (урок)", r.coach.length > 0 && r.coach.every((c) => c === "bad") && r.best === r.coach.length, JSON.stringify({ c: r.coach, best: r.best }));
  if (r.walk) ok(tag + ": гость ушёл — плашка с дверью, «Без отзыва», 0 звёзд, «Закрыть»", r.review === "walked" && r.ey === "Без отзыва" && r.stars === "0 из 3 звёзд" && r.next === "Закрыть", JSON.stringify({ rv: r.review, ey: r.ey, st: r.stars, nx: r.next }));
  else ok(tag + ": гость дослушал — отзыв «не в духе», «Дальше»", r.review !== "walked" && r.next === "Дальше", JSON.stringify(r.review));
  await shot(page, "hw-walkout");
  await page.locator("[data-dlg-next]").click(); await sleep(1000);
  const doneW = await completedOf(page, uk);
  ok(tag + ": «Закрыть» — диалог закрыт; разговор дошёл до конца — урок засчитан, как раньше", !(await dlgOpen(page)) && doneW["spg-0-d"] === true, JSON.stringify(Object.keys(doneW)));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── HE. Хостес: «эвакуация у дверей» — у ухода своя фраза и свой заголовок (это не гость ресторана) ──
if (want("HE")) {
  const tag = "HE";
  const { ctx, page, errors } = await open({ role: "spg" });
  await toLesson(page, "Безопасность и ЧП на входе", "Живой диалог: эвакуация у дверей");
  await page.waitForSelector(".sa-dlg[data-dlg]", { timeout: 8000 }).catch(() => {});
  ok(tag + ": урок «Живой диалог: эвакуация у дверей» — сценарий spg-b9-1", (await dlgId(page)) === "spg-b9-1");
  const r = await playDialogue(page, worst, { hurry: true });
  // v75: дверь — значком (svg) перед текстом, а не эмодзи 🚪
  const fin = await page.evaluate(() => ({ walk: (document.querySelector("[data-dlg-msg=walk]") || {}).textContent, door: !!document.querySelector("[data-dlg-msg=walk] svg"), title: (document.querySelector("[data-dlg-review] .dc-rv-t") || {}).textContent }));
  ok(tag + ": ушёл «Зал» — дверь и «Зал в панике: …», в отзыве «Зал в панике» (а не «не дождавшись хорошего приёма»)",
    r.walk && fin.door && fin.walk === "Зал в панике: люди толпятся у дверей, эвакуация идёт без тебя." && fin.title === "Зал в панике" && r.next === "Закрыть", JSON.stringify(fin));
  await shot(page, "he-evac-walk");
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── HB. Хостес: «Назад» Telegram посреди разговора ──
if (want("HB")) {
  const tag = "HB";
  const { ctx, page, errors, uk } = await open({ role: "spg", telegram: true });
  await toLesson(page, "Знакомство", "Живой диалог: первая встреча");
  await page.waitForSelector("[data-dlg-reply]:not([disabled])", { timeout: 15000 }).catch(() => {});
  ok(tag + ": панель ответов пришла", (await page.locator("[data-dlg-reply]:not([disabled])").count()) > 1);
  await page.evaluate(() => window.__bb.press()); await sleep(1000);
  let doneB = await completedOf(page, uk);
  ok(tag + ": «Назад» Telegram посреди разговора — диалог закрыт, раздел на месте, урок НЕ засчитан", !(await dlgOpen(page)) && (await page.locator(".tbm-node").count()) > 0 && !doneB["spg-0-d"], JSON.stringify(Object.keys(doneB)));
  // стрелка «назад» в шапке посреди разговора — так же
  await page.locator(".tbm-node:not(.tbp-side *)", { hasText: "Живой диалог: первая встреча" }).first().click(); await sleep(1300);
  await page.waitForSelector("[data-dlg-reply]:not([disabled])", { timeout: 15000 }).catch(() => {});
  await page.locator(".dc-back").click(); await sleep(1000);
  doneB = await completedOf(page, uk);
  ok(tag + ": стрелка в шапке посреди разговора — тоже назад без отметки", !(await dlgOpen(page)) && (await page.locator(".tbm-node").count()) > 0 && !doneB["spg-0-d"], JSON.stringify(Object.keys(doneB)));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── WT. Официант: поппап термина «Антиципация» ──
if (want("WT")) {
  const tag = "WT";
  const { ctx, page, errors, uk } = await open({ role: "seasonal", telegram: true });
  await toLesson(page, "Поведение в зале", "Правило периферии и антиципация");
  ok(tag + ": открылся урок «Правило периферии и антиципация»", /Правило периферии и антиципация/.test(await text(page)));
  const tapped = await tapTerm(page, "Антиципация");
  ok(tag + ": термин «Антиципация» подсвечен — поппап с «Отработать на практике →»", tapped && (await page.locator("text=Отработать на практике →").count()) === 1);
  await page.locator("text=Отработать на практике →").click(); await sleep(900);
  ok(tag + ": переписка «anticipation» поверх урока (портал в body), без «★ до 3 звёзд»",
    (await dlgId(page)) === "anticipation" && (await portaled(page)) && !(await page.evaluate(() => [...document.querySelectorAll("[data-dlg-msg=intro] .dc-chip")].some((c) => c.textContent === "★ до 3 звёзд"))));
  await shot(page, "wt-01-term-dialog");
  await page.waitForSelector("[data-dlg-reply]:not([disabled])", { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => window.__bb.press()); await sleep(900);
  ok(tag + ": «Назад» Telegram закрыл только диалог — урок на месте", !(await dlgOpen(page)) && /Правило периферии и антиципация/.test(await text(page)));
  // снова: голос гостя и звук включены; через один неверно / верно — до конца
  await tapTerm(page, "Антиципация");
  await page.locator("text=Отработать на практике →").click(); await sleep(900);
  await page.locator("[data-dlg-sound]").click(); await sleep(100);
  await page.locator("[data-dlg-voice]").click(); await sleep(200);
  await page.evaluate(() => { window.__tones.length = 0; });
  const r = await playDialogue(page, (s, n) => (n % 2 === 0 ? worst(s) : right(s)), { hurry: true });
  const said = await page.evaluate(() => ({ spoken: window.__spoken.slice(), tones: window.__tones.slice() }));
  const spokenGuests = r.guests.filter((g) => said.spoken.includes(g)).length;
  ok(tag + ": голос гостя: каждая реплика гостя прочитана, звук сообщений молчит", spokenGuests === r.guests.length && r.guests.length >= 2 && !said.tones.some((t) => [520, 988, 1319].includes(t)),
    JSON.stringify({ guests: r.guests.length, spokenGuests, tones: said.tones.slice(0, 8) }));
  ok(tag + ": разбор без «Лучше так» и отзыв без звёзд (не урок)", r.best === 0 && r.stars === null && r.review !== null && r.coach.includes("bad"), JSON.stringify({ best: r.best, st: r.stars, rv: r.review }));
  await shot(page, "wt-02-end");
  await page.locator("[data-dlg-next]").click(); await sleep(900);
  const done = await completedOf(page, uk);
  ok(tag + ": «Дальше»/«Закрыть» — закрыт только диалог; урок термином не засчитан", !(await dlgOpen(page)) && /Правило периферии и антиципация/.test(await text(page)) && !done["s2-2"], JSON.stringify(Object.keys(done)));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── MG. Менеджер: поппап термина «Сервис-менеджер», звук и голос гостя ──
if (want("MG")) {
  const tag = "MG";
  const staff = { id: "u-mgr", name: "Ирина", surname: "Котова", restaurant: "Два моря, Океан", position: "manager", is_admin: false };
  const { ctx, page, errors } = await open({ staff, role: "manager", telegram: true });
  await toLesson(page, "Роль менеджера", "Кто такой менеджер зала");
  ok(tag + ": открылся урок «Кто такой менеджер зала»", /Кто такой менеджер зала/.test(await text(page)));
  const tapped = await tapTerm(page, "Сервис-менеджер");
  ok(tag + ": термин «Сервис-менеджер» — поппап с «Отработать на практике →»", tapped && (await page.locator("text=Отработать на практике →").count()) === 1);
  await page.locator("text=Отработать на практике →").click(); await sleep(900);
  ok(tag + ": переписка «servicemgr1» поверх урока", (await dlgId(page)) === "servicemgr1" && (await portaled(page)));
  // звук: был выключен (sa_sfx = 0) → включили; отправил — 520 Гц, гость ответил — 988 + 1319 Гц
  const s0 = await page.evaluate(() => document.querySelector("[data-dlg-sound]").getAttribute("data-dlg-sound"));
  await page.locator("[data-dlg-sound]").click(); await sleep(200);
  const s1 = await page.evaluate(() => ({ a: document.querySelector("[data-dlg-sound]").getAttribute("data-dlg-sound"), k: localStorage.getItem("sa_sfx") }));
  ok(tag + ": звук — выключатель в шапке, запоминается (sa_sfx)", s0 === "off" && s1.a === "on" && s1.k === "1", JSON.stringify({ s0, s1 }));
  const D = DIALOGUES_DATA.find((d) => d.id === "servicemgr1");
  // первый ответ — со звуком
  await page.waitForSelector("[data-dlg-reply]:not([disabled])", { timeout: 15000 });
  await page.evaluate(() => { window.__tones.length = 0; });
  let idx = Number(await page.getAttribute("[data-dlg-kb]", "data-dlg-kb"));
  let texts = await page.evaluate(() => [...document.querySelectorAll("[data-dlg-reply] .dc-opt-t")].map((e) => e.textContent));
  await page.locator(`[data-dlg-reply="${texts.indexOf(right(D.steps[idx]).text)}"]`).click();
  await page.waitForSelector("[data-dlg-reply]:not([disabled]), [data-dlg-next]", { timeout: 25000 });
  const tones1 = await page.evaluate(() => window.__tones.slice());
  ok(tag + ": отправил — «вжух» 520 Гц; гость ответил — 988 + 1319 Гц", tones1.includes(520) && tones1.includes(988) && tones1.includes(1319), JSON.stringify(tones1));
  // голос гостя: включили — сразу читает последнюю реплику; дальше реплики читаются, звук сообщений молчит
  const canVoice = await page.locator("[data-dlg-voice]").count();
  ok(tag + ": кнопка голоса гостя есть (голос телефона доступен)", canVoice === 1);
  await page.evaluate(() => { window.__spoken.length = 0; });
  await page.locator("[data-dlg-voice]").click(); await sleep(200);
  const v1 = await page.evaluate(() => ({ a: document.querySelector("[data-dlg-voice]").getAttribute("data-dlg-voice"), k: localStorage.getItem("sa_dlg_voice"), sp: window.__spoken.slice(), last: [...document.querySelectorAll("[data-dlg-msg=guest] .dc-tx")].pop().textContent }));
  ok(tag + ": голос включён — запомнился, сразу прочитал последнюю реплику гостя", v1.a === "on" && v1.k === "1" && v1.sp.includes(v1.last), JSON.stringify(v1).slice(0, 220));
  await page.evaluate(() => { window.__tones.length = 0; window.__spoken.length = 0; });
  const r = await playDialogue(page, right);
  const after = await page.evaluate(() => ({ tones: window.__tones.slice(), spoken: window.__spoken.slice() }));
  ok(tag + ": с голосом — звуки «отправил / пришло / итог» молчат (вместо них голос)", r.next === "Дальше" && !after.tones.some((t) => [520, 988, 1319].includes(t)), JSON.stringify({ tones: after.tones.slice(0, 12) }));
  await shot(page, "mg-voice-end");
  await page.locator("[data-dlg-next]").click(); await sleep(900);
  ok(tag + ": «Дальше» — закрыт только диалог, урок на месте", !(await dlgOpen(page)) && /Кто такой менеджер зала/.test(await text(page)));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── WG. «Гость недели» ──
if (want("WG")) {
  const tag = "WG";
  const { ctx, page, errors, uk } = await open({ role: "seasonal", hintsOff: ["weeklyGuest"] });
  await page.evaluate(() => window.__saNav("weeklyGuest")); await sleep(1500);
  const id = await dlgId(page);
  ok(tag + ": «Гость недели» — та же переписка", !!id && !!DIALOGUES_DATA.find((d) => d.id === id), String(id));
  const h1 = await page.evaluate(() => (document.querySelector(".dc-hint") || {}).innerText || "");
  ok(tag + ": подсказка, шаг 1 — про Книгу и «доведённый до конца»", /доведённый до конца/.test(h1) && /Дальше/.test(h1), h1.replace(/\s+/g, " ").slice(0, 160));
  await page.locator(".dc-hint span", { hasText: /^Дальше$/ }).first().click(); await sleep(300);
  const h2 = await page.evaluate(() => (document.querySelector(".dc-hint") || {}).innerText || "");
  ok(tag + ": шаг 2 — «наставник шепнёт разбор», «кольцо вокруг гостя в шапке»", /наставник шепнёт разбор/.test(h2) && /кольцо вокруг гостя в шапке/.test(h2), h2.replace(/\s+/g, " ").slice(0, 200));
  await shot(page, "wg-01-hint");
  await page.locator(".dc-hint span", { hasText: /^Понятно$/ }).first().click(); await sleep(400);
  ok(tag + ": «Понятно» — подсказка ушла", (await page.locator(".dc-hint").count()) === 0);
  const t0 = Date.now();
  const r = await playDialogue(page, right, { hurry: true });
  ok(tag + ": нажатия на переписку торопят — разговор до конца быстро", Date.now() - t0 < 30000 && r.next === "Дальше", (Date.now() - t0) + " мс");
  await shot(page, "wg-02-end");
  await page.locator("[data-dlg-next]").click(); await sleep(1500);
  const done = await completedOf(page, uk);
  const wk = Object.keys(done).find((k) => /^weekly_/.test(k));
  ok(tag + ": доведённый до конца — страница в Книге (weekly_… засчитан), открыта Книга отзывов", !!wk && !(await dlgOpen(page)) && /Книга/i.test(await text(page)), JSON.stringify({ wk, keys: Object.keys(done) }));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── LT. Светлая тема ──
if (want("LT")) {
  const tag = "LT";
  const { ctx, page, errors } = await open({ role: "spg", light: true });
  await toLesson(page, "Знакомство", "Живой диалог: первая встреча");
  await page.waitForSelector("[data-dlg-reply]:not([disabled])", { timeout: 15000 }).catch(() => {});
  await shot(page, "lt-ask");
  const opt0 = await page.evaluate(() => { const r = [...document.querySelectorAll("[data-dlg-reply] .dc-opt-t")].map((e) => e.textContent); return r; });
  // первый ответ — верный (по данным сценария), дальше ждём следующий вопрос: в переписке — все виды строк
  const id = await dlgId(page); const DL = DIALOGUES_DATA.find((d) => d.id === id);
  const idx0 = Number(await page.getAttribute("[data-dlg-kb]", "data-dlg-kb"));
  await page.locator(`[data-dlg-reply="${opt0.indexOf(right(DL.steps[idx0]).text)}"]`).click();
  await page.waitForSelector("[data-dlg-mentor]", { timeout: 15000 }).catch(() => {});
  await page.waitForSelector("[data-dlg-reply]:not([disabled]), [data-dlg-next]", { timeout: 25000 }).catch(() => {});
  await sleep(500);
  const c = await page.evaluate(() => {
    const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > 0.6)) return c; } return [255, 255, 255]; };
    const pair = (sel) => { const el = document.querySelector(sel); if (!el) return null; return +ratio(rgb(getComputedStyle(el).color), bgOf(el)).toFixed(2); };
    const root = document.querySelector(".sa-dlg");
    return { lt: root.classList.contains("lt"), chatBg: +lum(bgOf(document.querySelector(".dc-chat"))).toFixed(2),
      intro: pair(".dc-intro-p"), guest: pair("[data-dlg-msg=guest] .dc-tx"), me: pair("[data-dlg-msg=me] .dc-tx"), coach: pair("[data-dlg-mentor] p"),
      svc: pair(".dc-svc"), opt: pair("[data-dlg-reply] .dc-opt-t"), name: pair(".dc-name"), q: pair("[data-dlg-q]") };
  });
  ok(tag + ": светлый экран (класс lt, фон переписки светлый)", c.lt && c.chatBg > 0.5, JSON.stringify(c));
  const must = ["me", "coach", "name"].concat(c.opt !== null ? ["opt"] : []);
  ok(tag + ": реплики (гость, ты), шёпот наставника, плашки, кнопки ответов, имя, вопрос — контраст ≥ 4,5",
    must.every((k) => c[k] !== null) && Object.entries(c).filter(([k, v]) => !["lt", "chatBg"].includes(k) && v !== null).every(([, v]) => v >= 4.5), JSON.stringify(c));
  await shot(page, "lt-after");
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
process.exit(bad ? 1 : 0);
