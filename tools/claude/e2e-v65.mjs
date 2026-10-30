// e2e v65 (Доп. 378): AI-интервью — в ленте главной у руководителей (менеджер, старший, владелец) пятым инструментом;
// лента сама подбирает размер кружков, чтобы подпись помещалась (393 / 375 / 360), на 320 — только значки.
// Собеседование: «Отвечать голосом» — кнопка-волна на месте «Отправить», полоса разговора: интервьюер читает вопрос
// вслух, кандидат отвечает голосом, ответ — в переписке и у интервьюера (ai-hr), следующий вопрос — вслух;
// «Завершить → оценка» в разговоре, «Стоп», кнопка «Назад» Telegram, «Прервать?» по ‹, сбой интервьюера.
// Голова (поддельный микрофон, голос телефона, сервер) — из e2e-v34.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v65.mjs [DOCK HR STOP BACK LEAVE ERR TEXT LIGHT]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5265, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v65";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const STAFF = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false };
const MANAGER = { id: "u-man", name: "Ольга", surname: "Петрова", restaurant: "Два моря, Океан", position: "manager", is_admin: false };
const SENIOR = { ...MANAGER, id: "u-sen", name: "Игорь", position: "senior" };
const OWNER = { ...MANAGER, id: "u-own", name: "Роман", position: "owner", is_admin: true };
// интервьюер ai-hr: приветствие и вопрос, потом короткая реакция и следующий вопрос; оценка — по компетенциям
const HR_Q = ["Здравствуйте, Мария! Давайте просто пообщаемся. Представьте: гость говорит, что ждёт заказ уже сорок минут. Что вы сделаете?",
  "Понятно, спасибо. А если за соседним столом шумная компания мешает паре — как поступите?",
  "Хороший подход. Вечер пятницы, зал полный, коллега заболел — как распределите столы?",
  "Ясно. Гость просит блюдо, которого нет в меню, — что ответите?",
  "Спасибо. Последний вопрос: за что вы любите работу с людьми?"];
const HR_SAY = ["Извинюсь, узнаю на кухне точное время и предложу комплимент.", "Подойду к компании, вежливо попрошу быть потише.", "Возьму часть столов коллеги и попрошу помощи у менеджера.", "Скажу, что его нет, и предложу похожее из меню."];
function hrAi(body, failAt) {
  const k = (body.messages || []).filter((m) => m.role === "user").length;
  if (body.mode === "assess") return { ok: true, scores: { "Гость": 82, "Команда": 74, "Стресс": 78 }, verdict: "Спокойная, думает о госте.", strengths: ["Извиняется и действует"], risks: ["Мало конкретики"] };
  if (failAt != null && k === failAt) return { ok: false, error: "provider" };
  return { ok: true, reply: HR_Q[Math.min(k, HR_Q.length - 1)] };
}
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// короткий звук «живого голоса» (WAV, тон) — data:URL, как отдаёт radio-tts в режиме talk
function wavUrl(sec = 0.35, freq = 330, amp = 0.15) {
  const sr = 16000, n = Math.round(sr * sec), buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / sr) * amp * 32767), 44 + i * 2);
  return "data:audio/wav;base64," + buf.toString("base64");
}
const SHORT = wavUrl(0.35), LONG = wavUrl(4);

const MENTOR_REPLY = "**Коротко:** предложи десерт, когда уносишь тарелки, — назови один, свой любимый. 😊\n- Спроси про кофе\n[[go:menu|Открыть меню]]";
const GUEST_STT = ["Добрый вечер! Что желаете?", "Рекомендую борщ — подадим за десять минут.", "Счёт сейчас принесу. Спасибо!"];
function guestAi(body) {
  const mine = (body.messages || []).filter((m) => m.role === "user").length;
  const replies = ["*откладывает меню* Мне бы что-нибудь побыстрее — у меня поезд. [[mood:3]]", "Отлично, это подходит. И чай, пожалуйста. [[mood:4]]", "*улыбается* Спасибо, всё было быстро. Можно счёт? До свидания! [[mood:5]]\n[[end]]"];
  return { ok: true, remaining: 30 - mine, reply: replies[Math.min(mine - 2, replies.length - 1)] || replies[0] };
}

// tts(body) → ответ radio-tts; stt(i, body) → ответ stt; mic: "ok" | "deny"; noRecorder — телефон без записи
async function open({ telegram = false, tts = null, stt = null, calls = null, mentor = MENTOR_REPLY, mic = "ok", noRecorder = false, url = "/", light = false, phone = "ok", profile = STAFF, hrFail = null, w = 390, h = 844, dsf = 2, clock = null, role = "seasonal", storage = {}, lessons = [] }) {
  const C = calls || { tts: [], stt: [], chat: [], hr: [] };
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    const J = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (/\/functions\/v1\/radio-tts/.test(u)) {
      C.tts.push(body);
      const r = tts ? tts(body) : (body.probe ? { ok: true, configured: true, talk: true, provider: "openrouter" } : { ok: true, audio: SHORT, provider: "openrouter" });
      return J(r);
    }
    if (/\/functions\/v1\/stt/.test(u)) {
      C.stt.push(body);
      const i = C.stt.length - 1;
      const r = stt ? stt(i, body) : { text: "Как предложить десерт?" };
      return J(r, r && r.__status ? r.__status : 200);
    }
    if (/\/functions\/v1\/ai-hr/.test(u)) { C.hr.push(body); return sleep(250).then(() => J(hrAi(body, hrFail))); }
    if (/\/functions\/v1\/ai-chat/.test(u)) {
      C.chat.push(body);
      if (body.mode === "guest" && body.stream && !body.finish) {
        const r = guestAi(body); const words = String(r.reply || "").split(/(?<= )/);
        const sse = words.map((w) => "data: " + JSON.stringify({ t: w }) + "\n\n").join("") + "data: " + JSON.stringify({ done: true, remaining: r.remaining }) + "\n\n";
        return route.fulfill({ status: 200, contentType: "text/event-stream; charset=utf-8", body: sse });
      }
      if (body.mode === "guest" && body.finish) return J({ ok: true, remaining: 20, reply: "Вот разбор: " + JSON.stringify({ score: 4, scores: { contact: 5, menu: 4, care: 3, sales: 4, calm: 5 }, good: ["Тепло встретил"], fix: ["Не спросил про аллергии"], phrase: "Есть ли у вас аллергии?", lessons: [] }) });
      if (body.mode === "guest") return J(guestAi(body));
      return sleep(350).then(() => J({ ok: true, reply: mentor, remaining: 17 }));   // «думает» — видно глазом
    }
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const mock = {
        whoami: { ok: true, employee: profile }, candidate_list: { ok: true, items: [] }, candidate_save: { ok: true, id: 77 }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons, stars: {}, roles: [], last_role: role },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "none" }, my_mentors: { ok: true, rows: [] }, menu_get: [],
        guest_personas: { ok: true, rows: [], can_edit: false },
      };
      if (mock[m[1]] !== undefined) return J(mock[m[1]]);
      return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    }
    return route.abort();
  });
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(profile), sa_a11y: light ? "1" : "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_last_role: JSON.stringify(role), sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_quest_open: "1" };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  Object.assign(seed, storage);
  await ctx.addInitScript(([seed, telegram, mic, noRecorder, phone]) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (telegram) {
      const handlers = new Set();
      window.__bb = { visible: false, handlers, press() { [...handlers].forEach(h => h()); } };
      window.Telegram = { WebApp: { initData: "query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc", platform: "ios", initDataUnsafe: {}, ready() {}, expand() {}, setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {},
        showAlert(m) { (window.__alerts = window.__alerts || []).push(m); }, showConfirm(m, cb) { cb && cb(true); },
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
        BackButton: { show() { window.__bb.visible = true; }, hide() { window.__bb.visible = false; }, onClick(h) { handlers.add(h); }, offClick(h) { handlers.delete(h); } } } };
    }
    window.alert = (m) => { (window.__alerts = window.__alerts || []).push(String(m)); };
    // голос телефона: «говорит» мгновенно, всё сказанное — в __spoken
    try {
      window.__spoken = []; window.__ss = { speaking: false };
      const ss = window.speechSynthesis;
      if (ss) {
        try { Object.defineProperty(ss, "speaking", { get: () => window.__ss.speaking, configurable: true }); Object.defineProperty(ss, "pending", { get: () => false, configurable: true }); } catch (e) {}
        window.__speakEvt = [];
        // phone: "mute" — телефон молча не читает (как iPhone без «пробуждения»): ни начала, ни конца
        ss.speak = (u) => { window.__speakEvt.push(window.event ? window.event.type : null); window.__spoken.push(u.text); if (phone === "mute") return; window.__ss.speaking = true; window.__ss.cur = u; setTimeout(() => { if (window.__ss.cur !== u) return; window.__ss.speaking = false; try { u.onstart && u.onstart(); u.onend && u.onend(); } catch (e) {} }, 60); };
        ss.cancel = () => { const u = window.__ss.cur; window.__ss.cur = null; window.__ss.speaking = false; if (u) setTimeout(() => { try { u.onerror && u.onerror({ error: "canceled" }); } catch (e) {} }, 0); };
      }
    } catch (e) {}
    // <audio>: в каком событии вызван play() (iPhone будит звук только внутри касания), сколько раз pause()
    try {
      window.__playEvt = []; window.__pause = 0; window.__srcs = [];
      const p0 = HTMLMediaElement.prototype.play, pa0 = HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.play = function () { window.__playEvt.push(window.event ? window.event.type : null); window.__srcs.push(String(this.src || "").slice(0, 22)); return p0.apply(this, arguments); };
      HTMLMediaElement.prototype.pause = function () { window.__pause++; return pa0.apply(this, arguments); };
      const AC0 = window.AudioContext;
      window.__AC0 = AC0; window.__acEvt = [];
      window.__acs = [];
      const ACw = function (...a) { window.__acEvt.push(window.event ? window.event.type : null); const c = new AC0(...a); window.__acs.push(c); return c; };
      ACw.prototype = AC0.prototype;
      window.AudioContext = ACw;
    } catch (e) {}
    if (noRecorder) { try { delete window.MediaRecorder; window.MediaRecorder = undefined; } catch (e) {} }
    // поддельный микрофон: пила 140 Гц, громкость задаёт тест (__mic.say(ms)); в тишине — лёгкий фон
    // (живой микрофон не даёт ровного нуля); mic: "dead" — ровный ноль всегда (разбор уровня «мёртв»)
    try {
      const M = window.__mic = { calls: 0, tracks: [], base: mic === "dead" ? 0 : 0.004, level: 0, g: null };
      M.level = M.base;
      M.live = () => M.tracks.filter((t) => t.readyState === "live").length;
      M.say = (ms, lvl = 0.5) => { if (mic === "dead") return; M.level = lvl; if (M.g) M.g.gain.value = lvl; clearTimeout(M.t); M.t = setTimeout(() => { M.level = M.base; if (M.g) M.g.gain.value = M.base; }, ms); };
      const md = navigator.mediaDevices;
      M.delays = [];   // задержки ответа микрофона по очереди вызовов (гонка двух «слушаю»)
      if (md) md.getUserMedia = async () => {
        M.calls++;
        const d = M.delays.shift(); if (d) await new Promise((r) => setTimeout(r, d));
        if (mic === "deny") throw new DOMException("Permission denied", "NotAllowedError");
        const ac = M.ac || (M.ac = new window.__AC0());
        if (ac.state === "suspended") { try { await ac.resume(); } catch (e) {} }
        const osc = ac.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 140;
        const g = ac.createGain(); g.gain.value = M.level;
        const dest = ac.createMediaStreamDestination();
        osc.connect(g); g.connect(dest); osc.start();
        M.g = g;
        dest.stream.getTracks().forEach((t) => M.tracks.push(t));
        return dest.stream;
      };
    } catch (e) {}
  }, [seed, telegram, mic, noRecorder, phone]);
  const page = await ctx.newPage();
  if (clock) await page.clock.install({ time: clock });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + url, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1600);
  return { ctx, page, errors, C };
}
const only = process.argv.slice(2);
const want = (tag) => !only.length || only.includes(tag);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const st = (page) => page.evaluate(() => { const el = document.querySelector("[data-talk-state]"); return el ? el.getAttribute("data-talk-state") : null; });
const waitSt = async (page, s, ms = 6000) => { try { await page.waitForSelector(`[data-talk-state="${s}"]`, { timeout: ms, state: "attached" }); return true; } catch (e) { return false; } };
// слежка за состояниями: каждые 25 мс — что на экране разговора и сколько живых дорожек микрофона
const watch = (page) => page.evaluate(() => { window.__seen = []; const t0 = performance.now(); clearInterval(window.__seenT); window.__seenT = setInterval(() => { const el = document.querySelector("[data-talk-state]"); const s = el ? el.getAttribute("data-talk-state") : "—"; const nt = document.querySelector("[data-talk-note]"); const n = nt ? nt.textContent.slice(0, 18) : ""; const last = window.__seen[window.__seen.length - 1]; const live = window.__mic ? window.__mic.live() : -1; if (!last || last.s !== s || last.live !== live || last.n !== n) window.__seen.push({ s, live, n, t: Math.round(performance.now() - t0) }); }, 25); });
const seen = (page) => page.evaluate(() => window.__seen || []);
// короткие состояния («говорит» голосом телефона — 60 мс) ловим по журналу слежки, а не ожиданием
const states = (s) => s.map((x) => x.s).filter((v, i, a) => v !== a[i - 1]);
const passed = (s, seq) => { let k = 0; for (const x of states(s)) if (x === seq[k]) k++; return k === seq.length; };
const count = (s, st) => states(s).filter((x) => x === st).length;
async function waitSeen(page, pred, ms = 10000) { const t0 = Date.now(); for (;;) { const s = await seen(page); if (pred(s) || Date.now() - t0 > ms) return s; await sleep(80); } }
const TURN = ["listening", "hearing", "recognizing", "thinking", "speaking", "listening"];
// одна реплика голосом: ждём «слушаю», даём фону откалиброваться, говорим ms, ждём, пока собеседник ответит
async function sayTurn(page, ms = 1000) {
  const l = await waitSt(page, "listening", 8000);
  await sleep(650);
  await page.evaluate((ms) => window.__mic.say(ms), ms);
  const h = await waitSt(page, "hearing", 3000);
  return { l, h };
}
// строка-подсказка экрана разговора — сразу, без ожидания (её может и не быть)
const noteText = (page) => page.evaluate(() => { const el = document.querySelector("[data-talk-note]"); return el ? el.textContent : ""; });
const sendBtn = (page) => page.locator("button:has(svg path[d='M22 2L11 13'])");
const openMentor = async (page) => { await page.evaluate(() => window.__saNav("assistant")); await sleep(1300); };


// ════════════════════════════ v65 (Доп. 378) ════════════════════════════
const ta = (page) => page.locator('textarea[placeholder="Ответ кандидата…"]');
const btn = (page, t) => page.locator("button", { hasText: t }).first();
async function toAi(page) {
  await page.evaluate(() => window.__saNav("candidate")); await sleep(1300);
  await btn(page, "Начать собеседование").click(); await sleep(500);
  await page.locator('input[placeholder="Имя кандидата"]').fill("Мария"); await sleep(150);
  await btn(page, "Дальше: анкета опыта").click(); await sleep(500);
  await page.locator(".sa-btn", { hasText: "До года" }).first().click(); await sleep(200);
  await btn(page, /^Дальше$/).click(); await sleep(500);
  await btn(page, "AI-интервью · бета").click();
  await page.waitForFunction(() => document.body.innerText.includes("Здравствуйте, Мария"), null, { timeout: 8000 }).catch(() => {});
  await sleep(300);
}
const chat = (page) => page.evaluate(() => {
  const box = document.querySelector(".sa-dlgscroll"); if (!box) return { n: 0, user: [], ai: [] };
  const rows = [...box.children].filter((r) => r.style && r.style.justifyContent);
  const user = rows.filter((r) => r.style.justifyContent === "flex-end" && !r.hasAttribute("data-talk-pending")).map((r) => r.innerText.trim());
  const ai = rows.filter((r) => r.style.justifyContent === "flex-start").map((r) => r.innerText.trim());
  return { n: rows.length, user, ai };
});
const dock = (page) => page.evaluate(() => {
  const row = document.querySelector("[data-tools-row]"); if (!row) return null;
  return { titles: [...row.children].map((c) => c.getAttribute("title")), ring: Number(row.getAttribute("data-tools-ring")), labels: row.getAttribute("data-tools-labels"), over: row.scrollWidth - row.clientWidth };
});

if (want("DOCK")) {
  const T0 = new Date(); T0.setHours(14, 20, 0, 0);
  for (const [nm, P, w, expRing, expLab] of [["менеджер 393", MANAGER, 393, 36, "on"], ["менеджер 375", MANAGER, 375, 33, "on"], ["менеджер 360", MANAGER, 360, 30, "on"], ["менеджер 320", MANAGER, 320, null, "off"]]) {
    const { ctx, page, errors } = await open({ profile: P, role: "manager", w, h: 852, dsf: 1, clock: T0 });
    let worst = -99, shown = new Set(), d0 = await dock(page);
    for (let k = 0; k < 6; k++) { await page.clock.runFor(4000); await sleep(1000); const d = await dock(page); worst = Math.max(worst, d ? d.over : 99);
      const on = await page.evaluate(() => { const r = document.querySelector("[data-tools-row]"); const c = r && [...r.children].find((x) => x.getBoundingClientRect().width > 50); return c ? c.getAttribute("title") : null; }); if (on) shown.add(on); }
    ok(`DOCK: ${nm} — пятым «AI-интервью» (после «Чек-листов»), ряд не вылезает ни при одной подписи${expLab === "off" ? " (на 320 — только значки)" : ""}`,
      !!d0 && d0.titles.join(",") === "Справочник,Меню,Глоссарий,Чек-листы,AI-интервью" && worst <= 0 && d0.labels === expLab && (expRing == null || d0.ring === expRing) && (expLab === "off" || shown.has("AI-интервью")),
      JSON.stringify({ ...d0, worst, shown: [...shown] }));
    if (w === 393) await shot(page, "dock-manager");
    if (w === 393) {
      const t = await open({ profile: P, role: "manager", w, h: 852, dsf: 1 });
      await t.page.locator('[data-tools-row] [title="AI-интервью"]').click(); await sleep(1600);
      const head = await t.page.evaluate(() => document.body.innerText.slice(0, 900));   // v74: вступление стало на фразу длиннее
      ok("DOCK: тап по «AI-интервью» открывает «Собеседование»", /Собеседование/.test(head) && /Начать собеседование/.test(head), head.slice(0, 80));
      await t.ctx.close();
    }
    ok(`DOCK: ${nm} — без ошибок`, !errors.length, errors.join(" | "));
    await ctx.close();
  }
  const DONE = (P) => ({});   // прогресс — с сервера (my_state.lessons), не новичок
  for (const [nm, P, role] of [["старший", SENIOR, "core"], ["владелец", OWNER, "manager"], ["официант", STAFF, "seasonal"]]) {
    const { ctx, page } = await open({ profile: P, role, w: 393, h: 852, dsf: 1, storage: DONE(P), lessons: ["s0-1"] });
    await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1200);
    const d = await dock(page);
    const has = !!d && d.titles.includes("AI-интервью");
    ok(`DOCK: ${nm} — ${P === STAFF ? "без «AI-интервью» (только руководителям), лента прежняя" : "тоже с «AI-интервью»"}`, P === STAFF ? (!has && d.titles.length === 4 && d.ring === 36) : has, JSON.stringify(d));
    await ctx.close();
  }
  // сотрудник на 320: раньше «Справочник» вылезал на 15 px — теперь кружки чуть меньше, подпись влезает
  const { ctx, page } = await open({ profile: STAFF, w: 320, h: 700, dsf: 1, clock: T0, storage: DONE(STAFF), lessons: ["s0-1"] });
  let worst = -99; for (let k = 0; k < 5; k++) { await page.clock.runFor(4000); await sleep(1000); const d = await dock(page); worst = Math.max(worst, d ? d.over : 99); }
  const d = await dock(page);
  ok("DOCK: официант на 320 — подписи на месте и ряд больше не вылезает (было 15 px)", d && d.labels === "on" && worst <= 0, JSON.stringify({ ...d, worst }));
  await ctx.close();
}

if (want("HR")) {
  const tag = "HR";
  const C = { tts: [], stt: [], chat: [], hr: [] };
  const { ctx, page, errors } = await open({ profile: MANAGER, role: "manager", calls: C, stt: (i) => ({ text: HR_SAY[i] || "Ответ" }) });
  await toAi(page);
  let c = await chat(page);
  ok(tag + ": AI-интервью началось — первый вопрос в переписке", c.ai.length === 1 && /сорок минут/.test(c.ai[0]), JSON.stringify(c));
  ok(tag + ": поле пустое — кнопка-волна «Отвечать голосом» на месте «Отправить»; микрофон диктовки на месте",
    (await page.locator('[data-talk-open][aria-label="Отвечать голосом"]').count()) === 1 && (await sendBtn(page).count()) === 0 && (await page.locator('button[aria-label="Сказать голосом"]').count()) === 1);
  await ta(page).fill("Черновик"); await sleep(150);
  ok(tag + ": набрал текст — снова «Отправить», волны нет", (await page.locator("[data-talk-open]").count()) === 0 && (await sendBtn(page).count()) === 1);
  await ta(page).fill(""); await sleep(150);
  await shot(page, "hr0-wave");
  await watch(page);
  await page.locator("[data-talk-open]").click(); await sleep(250);
  ok(tag + ": коснулся волны — вместо поля полоса разговора", (await page.locator("[data-talk]").count()) === 1 && (await ta(page).count()) === 0);
  // первый вопрос звучит вслух (живой голос — radio-tts в режиме talk, голосом Наставника)
  await waitSt(page, "listening", 9000);
  const firstTts = C.tts.filter((b) => b.talk && b.text);
  ok(tag + ": интервьюер прочитал вопрос вслух (живой голос, голос «Наставник»), потом слушает",
    firstTts.length >= 1 && /сорок минут/.test(firstTts.map((b) => b.text).join(" ")) && firstTts.every((b) => b.who === "mentor"), JSON.stringify(firstTts.map((b) => ({ who: b.who, t: String(b.text).slice(0, 40) }))));
  // ответ голосом
  for (let k = 0; k < 4; k++) {
    const t = await sayTurn(page, 1000);
    if (k === 0) { await sleep(200); ok(tag + ": кандидат говорит — в переписке его пузырь с точками", (await page.locator("[data-talk-pending]").count()) === 1 && t.h); }
    await page.waitForFunction((n) => { const el = document.querySelector("[data-talk-state]"); return el && el.getAttribute("data-talk-state") === "listening" && document.body.innerText.includes(n); }, ["Понятно, спасибо", "Хороший подход", "Гость просит блюдо", "Последний вопрос"][k], { timeout: 12000 }).catch(() => {});
    if (k === 0) {
      c = await chat(page);
      const lastHr = C.hr[C.hr.length - 1];
      const um = (lastHr && lastHr.messages || []).filter((m) => m.role === "user");
      ok(tag + ": ответ голосом лёг в переписку и ушёл интервьюеру (ai-hr, режим chat) — без служебных полей", c.user.length === 1 && c.user[0] === HR_SAY[0] && lastHr.mode === "chat" && um.length === 1 && um[0].content === HR_SAY[0] && Object.keys(um[0]).join(",") === "role,content", JSON.stringify({ c, um }));
      ok(tag + ": следующий вопрос — в переписке и вслух", c.ai.length === 2 && C.tts.some((b) => b.talk && /шумная компания/.test(String(b.text))), JSON.stringify(c.ai));
      // v83: слежка пишет раз в 25 мс — ждём, пока она запишет и последнее «слушаю» (снимок сразу иногда её опережал)
      const s = await waitSeen(page, (x) => passed(x, TURN), 3000);
      ok(tag + ": круг разговора: слушаю → слышу → разбираю → думает → говорит → слушаю", passed(s, TURN), states(s).join(" → "));
      await shot(page, "hr1-voice");
    }
  }
  c = await chat(page);
  ok(tag + ": четыре ответа голосом — пять вопросов в переписке", c.user.length === 4 && c.ai.length === 5, JSON.stringify({ u: c.user.length, a: c.ai.length }));
  const fin = btn(page, "Завершить интервью → оценка");
  ok(tag + ": после четырёх ответов «Завершить интервью → оценка» — прямо под полосой разговора", (await fin.count()) === 1 && (await page.locator("[data-talk]").count()) === 1);
  await shot(page, "hr2-finish");
  await fin.click(); await sleep(1500);
  const res = await page.evaluate(() => { let r = null; try { r = JSON.parse(localStorage.getItem("sa_candidate_results") || "[]")[0]; } catch (e) {} return { talk: !!document.querySelector("[data-talk]"), body: document.body.innerText.slice(0, 600), r }; });
  ok(tag + ": «Завершить» — разговор закрыт, оценка по компетенциям (ai-hr, режим assess)", !res.talk && C.hr.some((b) => b.mode === "assess") && /Спокойная, думает о госте/.test(res.body), res.body.slice(0, 120));
  ok(tag + ": в истории — «Официант · AI-интервью голосом», ответов голосом 4", res.r && res.r.roleLabel === "Официант · AI-интервью голосом" && res.r.aiVoice === 4, JSON.stringify(res.r && { l: res.r.roleLabel, v: res.r.aiVoice }));
  await shot(page, "hr3-result");
  ok(tag + ": без ошибок", !errors.length, errors.join(" | "));
  await ctx.close();
}

if (want("STOP")) {
  const C = { tts: [], stt: [], chat: [], hr: [] };
  const { ctx, page, errors } = await open({ profile: MANAGER, role: "manager", calls: C, stt: (i) => ({ text: HR_SAY[i] || "Ответ" }) });
  await toAi(page);
  await page.locator("[data-talk-open]").click(); await sleep(200);
  await sayTurn(page, 900);
  await page.waitForFunction(() => document.body.innerText.includes("Понятно, спасибо"), null, { timeout: 12000 }).catch(() => {});
  await waitSt(page, "listening", 8000);
  await page.locator("[data-talk-stop]").click(); await sleep(400);
  const c = await chat(page);
  ok("STOP: «Стоп» — полоса ушла, снова поле и волна; переписка на месте", (await page.locator("[data-talk]").count()) === 0 && (await ta(page).count()) === 1 && (await page.locator("[data-talk-open]").count()) === 1 && c.user.length === 1 && c.ai.length === 2, JSON.stringify(c));
  const live = await page.evaluate(() => window.__mic.live());
  ok("STOP: микрофон закрыт", live === 0, String(live));
  // дальше — текстом
  await ta(page).fill("Предложу соседний стол и извинюсь"); await sendBtn(page).click();
  await page.waitForFunction(() => document.body.innerText.includes("Вечер пятницы"), null, { timeout: 8000 }).catch(() => {});
  const c2 = await chat(page);
  ok("STOP: после голоса можно отвечать текстом — интервью продолжается", c2.user.length === 2 && c2.ai.length === 3, JSON.stringify({ u: c2.user.length, a: c2.ai.length }));
  ok("STOP: без ошибок", !errors.length, errors.join(" | "));
  await ctx.close();
}

if (want("BACK")) {
  const { ctx, page, errors } = await open({ profile: MANAGER, role: "manager", telegram: true, stt: (i) => ({ text: HR_SAY[i] || "Ответ" }) });
  await toAi(page);
  await page.locator("[data-talk-open]").click(); await sleep(200);
  await waitSt(page, "listening", 9000);
  await page.evaluate(() => window.__bb.press()); await sleep(500);
  const s = await page.evaluate(() => ({ talk: !!document.querySelector("[data-talk]"), ta: !!document.querySelector('textarea[placeholder="Ответ кандидата…"]'), body: /AI-интервью/i.test(document.body.innerText) }));
  ok("BACK: кнопка «Назад» Telegram в разговоре голосом — закрывает разговор, интервью на месте", !s.talk && s.ta && s.body, JSON.stringify(s));
  ok("BACK: без ошибок", !errors.length, errors.join(" | "));
  await ctx.close();
}

if (want("LEAVE")) {
  const { ctx, page, errors } = await open({ profile: MANAGER, role: "manager", stt: (i) => ({ text: HR_SAY[i] || "Ответ" }) });
  await toAi(page);
  // без ответов ‹ — сразу назад (ничего не теряется)
  await page.locator("button", { hasText: /^‹$/ }).first().click(); await sleep(500);
  const s0 = await page.evaluate(() => ({ intro: document.body.innerText.includes("Начать собеседование"), confirm: document.body.innerText.includes("Прервать собеседование?") }));
  ok("LEAVE: без ответов ‹ — сразу к началу, без вопроса", s0.intro && !s0.confirm, JSON.stringify(s0));
  await ctx.close();
  const b = await open({ profile: MANAGER, role: "manager", stt: (i) => ({ text: HR_SAY[i] || "Ответ" }) });
  await toAi(b.page);
  await b.page.locator("[data-talk-open]").click(); await sleep(200);
  await sayTurn(b.page, 900);
  await b.page.waitForFunction(() => document.body.innerText.includes("Понятно, спасибо"), null, { timeout: 12000 }).catch(() => {});
  await b.page.locator("button", { hasText: /^‹$/ }).first().click(); await sleep(500);
  const s1 = await b.page.evaluate(() => ({ confirm: document.body.innerText.includes("Прервать собеседование?"), talk: !!document.querySelector("[data-talk]"), mic: window.__mic.live() }));
  ok("LEAVE: с ответами ‹ — «Прервать собеседование?», разговор голосом закрыт, микрофон выключен", s1.confirm && !s1.talk && s1.mic === 0, JSON.stringify(s1));
  await b.page.locator("button", { hasText: "Продолжить" }).first().click(); await sleep(400);
  const c = await chat(b.page);
  ok("LEAVE: «Продолжить» — интервью и ответы на месте", c.user.length === 1 && (await ta(b.page).count()) === 1, JSON.stringify(c));
  ok("LEAVE: без ошибок", !errors.length && !b.errors.length, [...errors, ...b.errors].join(" | "));
  await b.ctx.close();
}

if (want("ERR")) {
  const C = { tts: [], stt: [], chat: [], hr: [] };
  const { ctx, page, errors } = await open({ profile: MANAGER, role: "manager", calls: C, hrFail: 1, stt: (i) => ({ text: HR_SAY[i] || "Ответ" }) });
  await toAi(page);
  await page.locator("[data-talk-open]").click(); await sleep(200);
  await sayTurn(page, 900);
  await waitSt(page, "paused", 12000);
  const note = await noteText(page);
  const c = await chat(page);
  ok("ERR: интервьюер не ответил — пауза и причина «Коснитесь волны и ответьте ещё раз», ответ убран из переписки", /Коснитесь волны и ответьте ещё раз/.test(note) && c.user.length === 0 && c.ai.length === 1, JSON.stringify({ note, c }));
  await shot(page, "err-paused");
  ok("ERR: без ошибок страницы", !errors.length, errors.join(" | "));
  await ctx.close();
}

if (want("TEXT")) {
  const C = { tts: [], stt: [], chat: [], hr: [] };
  const { ctx, page, errors } = await open({ profile: MANAGER, role: "manager", calls: C });
  await toAi(page);
  await ta(page).fill("Извинюсь и узнаю у кухни время."); await sendBtn(page).click();
  await page.waitForFunction(() => document.body.innerText.includes("Понятно, спасибо"), null, { timeout: 8000 }).catch(() => {});
  const c = await chat(page);
  ok("TEXT: ответ текстом — как раньше (без голоса: ни stt, ни озвучки)", c.user.length === 1 && c.ai.length === 2 && C.stt.length === 0 && !C.tts.some((b) => b.talk && b.text), JSON.stringify({ c, stt: C.stt.length, tts: C.tts.length }));
  const h = await page.evaluate(() => document.body.innerText);
  ok("TEXT: без ошибок", !errors.length, errors.join(" | "));
  await ctx.close();
  // экран передачи телефона рассказывает про голос
  const b = await open({ profile: MANAGER, role: "manager" });
  await b.page.evaluate(() => window.__saNav("candidate")); await sleep(1300);
  await btn(b.page, "Начать собеседование").click(); await sleep(400);
  await b.page.locator('input[placeholder="Имя кандидата"]').fill("Мария");
  await btn(b.page, "Дальше: анкета опыта").click(); await sleep(400);
  await b.page.locator(".sa-btn", { hasText: "До года" }).first().click(); await btn(b.page, /^Дальше$/).click(); await sleep(500);
  const hand = await b.page.evaluate(() => document.body.innerText);
  ok("TEXT: передача телефона — «текстом или голосом (волна справа от поля…)»", /текстом или голосом/.test(hand) && /вопросы звучат вслух/.test(hand));
  await b.ctx.close();
}

if (want("LIGHT")) {
  const { ctx, page, errors } = await open({ profile: MANAGER, role: "manager", light: true, stt: (i) => ({ text: HR_SAY[i] || "Ответ" }) });
  await toAi(page);
  await page.locator("[data-talk-open]").click(); await sleep(200);
  await sayTurn(page, 900); await sleep(400);
  await shot(page, "light-hearing");
  await page.waitForFunction(() => document.body.innerText.includes("Понятно, спасибо"), null, { timeout: 12000 }).catch(() => {});
  await waitSt(page, "listening", 8000);
  await shot(page, "light-voice");
  ok("LIGHT: «Для чтения» — полоса разговора и переписка, без ошибок", (await page.locator("[data-talk]").count()) === 1 && !errors.length, errors.join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
process.exit(bad ? 1 : 0);
