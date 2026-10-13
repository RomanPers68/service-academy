// e2e v34–v35 (Доп. 343–344): «Разговор голосом» — кнопка-волна на месте «Отправить», пока поле пустое (Наставник
// и «Живой гость»); v35: разговор прямо в чате — вместо поля полоса разговора (волна, «Пауза», «Стоп»), реплики —
// в переписке, пока говоришь — пузырь с точками, пока звучит ответ — значок у него; слушаю → слышу → разбираю (stt) → думает (ai-chat) → говорит (radio-tts,
// режим talk; нет живых голосов — голос телефона) → снова слушаю. Микрофон — поддельный (WebAudio, уровень
// задаёт тест), сервер — поддельный. Проверяем: состояния, субтитры, подсказку «отвечай коротко» только на
// сервер, текст для голоса без разметки и меток, микрофон закрыт, пока собеседник говорит, перебить касанием,
// пауза по тишине, нет доступа к микрофону, «Завершить» и кнопка «Назад» Telegram, конец визита гостя.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = "/home/claude/preview/site", PORT = 5205, OUT = "/home/claude/preview/shots-v34";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const STAFF = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false };
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
async function open({ telegram = false, tts = null, stt = null, calls = null, mentor = MENTOR_REPLY, mic = "ok", noRecorder = false, url = "/", light = false, phone = "ok" }) {
  const C = calls || { tts: [], stt: [], chat: [] };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
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
        whoami: { ok: true, employee: STAFF }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "none" }, my_mentors: { ok: true, rows: [] }, menu_get: [],
        guest_personas: { ok: true, rows: [], can_edit: false },
      };
      if (mock[m[1]] !== undefined) return J(mock[m[1]]);
      return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    }
    return route.abort();
  });
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(STAFF), sa_a11y: light ? "1" : "0", sa_welcome_seen_v11: "1", sa_last_role: JSON.stringify("seasonal"), sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_quest_open: "1" };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
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

// ── AT. Наставник: кнопка-волна, полный круг разговора голосом, переписка — в чате ──
if (want("AT")) {
  const tag = "AT";
  const { ctx, page, errors, C } = await open({});
  await openMentor(page);
  ok(tag + ": поле пустое — кнопка-волна на месте «Отправить»", (await page.locator("[data-talk-open]").count()) === 1 && (await sendBtn(page).count()) === 0);
  const ta = page.locator('textarea[placeholder="Спроси наставника…"]');
  await ta.fill("Привет"); await sleep(150);
  ok(tag + ": набрал текст — снова «Отправить», волны нет", (await page.locator("[data-talk-open]").count()) === 0 && (await sendBtn(page).count()) === 1);
  await ta.fill(""); await sleep(150);
  ok(tag + ": стёр — волна вернулась", (await page.locator("[data-talk-open]").count()) === 1);
  await ta.focus();
  await shot(page, "at0-button");
  await watch(page);
  await page.locator("[data-talk-open]").click();
  await sleep(200);
  ok(tag + ": на месте поля — полоса разговора (без отдельного экрана)", (await page.locator("[data-talk]").count()) === 1 && (await page.locator('textarea[placeholder="Спроси наставника…"]').count()) === 0 && (await page.locator(".tkb-cap").count()) === 1);
  ok(tag + ": готовые вопросы спрятаны, пока идёт разговор", (await page.locator("button", { hasText: "Как красиво предложить десерт?" }).count()) === 0);
  const pe = await page.evaluate(() => ({ play: window.__playEvt.slice(), ac: window.__acEvt.slice() }));
  ok(tag + ": звук разбужен прямо в касании (play и AudioContext — внутри click)", pe.play[0] === "click" && pe.ac[0] === "click", JSON.stringify(pe));
  const sp0 = await page.evaluate(() => ({ t: window.__spoken.slice(), e: window.__speakEvt.slice() }));
  ok(tag + ": голос телефона тоже разбужен в касании (беззвучная фраза)", sp0.t[0] === " " && sp0.e[0] === "click", JSON.stringify(sp0));
  ok(tag + ": клавиатура убрана (поле ввода не в фокусе)", (await page.evaluate(() => !document.activeElement || document.activeElement.tagName !== "TEXTAREA")));
  const t1 = await sayTurn(page, 1000);
  ok(tag + ": «слушаю» → «слышу тебя» по голосу", t1.l && t1.h);
  await sleep(250);
  const waveH = await page.evaluate(() => [...document.querySelectorAll(".tkb-bar")].map((b) => b.getBoundingClientRect().height));
  ok(tag + ": волна пляшет под голос", Math.max(...waveH) > 10, JSON.stringify(waveH.slice(-8)));
  ok(tag + ": в чате — твой пузырь с точками, пока говоришь", (await page.locator("[data-talk-pending]").count()) === 1);
  await shot(page, "at1-hearing");
  const back = await waitSeen(page, (s) => count(s, "speaking") >= 1, 9000);
  ok(tag + ": договорил (пауза) → распознал → думает → говорит", count(back, "speaking") >= 1, states(back).join(" → "));
  const txt1 = await page.evaluate(() => document.body.innerText);
  ok(tag + ": в чате — что ты сказал (пузырь с точками сменился текстом)", /Как предложить десерт\?/.test(txt1) && (await page.locator("[data-talk-pending]").count()) === 0);
  ok(tag + ": в чате — ответ Наставника, у него значок «звучит»", /предложи десерт, когда уносишь тарелки/.test(txt1) && (await page.locator("[data-talk-speaking]").count()) === 1);
  await shot(page, "at2-speaking");
  const again = await waitSt(page, "listening", 6000);
  ok(tag + ": ответ прозвучал — снова «слушаю» (без кнопок)", again);
  const ss = await seen(page);
  const order = ss.map((x) => x.s).filter((s, i, a) => s !== a[i - 1]);
  const want1 = ["listening", "hearing", "recognizing", "thinking", "speaking", "listening"];
  let k = 0; for (const s of order) if (s === want1[k]) k++;
  ok(tag + ": порядок состояний", k === want1.length, order.join(" → "));
  ok(tag + ": микрофон закрыт, пока говорит Наставник", ss.filter((x) => x.s === "speaking").every((x) => x.live === 0) && ss.some((x) => x.s === "hearing" && x.live === 1), JSON.stringify(ss).slice(0, 300));
  // сервер: распознавание, подсказка «коротко» только в запросе, голос Наставника
  const sttB = C.stt[0] || {};
  ok(tag + ": запись ушла на распознавание (base64 + формат)", typeof sttB.audio === "string" && sttB.audio.length > 200 && /^(wav|m4a|webm|ogg)$/.test(sttB.format), (sttB.format || "") + " " + String(sttB.audio || "").length);
  const ch = C.chat[0] || {}; const lastQ = (ch.messages || []).slice(-1)[0] || {};
  ok(tag + ": Наставнику — вопрос и просьба отвечать коротко, вслух", /Как предложить десерт\?/.test(lastQ.content || "") && /прозвучит вслух/.test(lastQ.content || "") && /2–4 предложения/.test(lastQ.content || ""), String(lastQ.content || "").slice(-160));
  const probe = C.tts.find((b) => b.probe), talkB = C.tts.filter((b) => b.talk);
  ok(tag + ": живые голоса: проверка + реплика голосом Наставника", !!probe && talkB.length >= 1 && talkB.every((b) => b.who === "mentor" && b.token === "tok-preview"), JSON.stringify(talkB.map((b) => b.who)));
  const said = talkB.map((b) => b.text).join(" ");
  ok(tag + ": в голос — без разметки, эмодзи и [[кнопок]]", /Коротко: предложи десерт/.test(said) && /Спроси про кофе/.test(said) && !/[*#😊]|\[\[|go:menu/.test(said), said.slice(0, 200));
  ok(tag + ": голос телефона молчал (живой голос есть)", (await page.evaluate(() => window.__spoken.filter((x) => x.trim()).length)) === 0);
  ok(tag + ": ответ сыгран тем же <audio>, что разбудили касанием", (await page.evaluate(() => window.__srcs.filter((s) => s.startsWith("data:audio/wav")).length)) >= 1);
  // «Завершить»
  await page.locator("[data-talk-stop]").click(); await sleep(500);
  ok(tag + ": «Стоп» — полоса закрыта, поле ввода вернулось, микрофон выключен, AudioContext закрыт", (await page.locator("[data-talk]").count()) === 0 && (await page.locator('textarea[placeholder="Спроси наставника…"]').count()) === 1 && (await page.evaluate(() => window.__mic.live())) === 0 && (await page.evaluate(() => window.__acs.every((c) => c.state === "closed"))), JSON.stringify(await page.evaluate(() => window.__acs.map((c) => c.state))));
  const chatText = await page.evaluate(() => document.body.innerText);
  ok(tag + ": разговор сохранился в чате: вопрос и ответ", /Как предложить десерт\?/.test(chatText) && /предложи десерт, когда уносишь тарелки/.test(chatText) && !/прозвучит вслух/.test(chatText));
  ok(tag + ": в чате у ответа — кнопка «Открыть меню», жирное — жирным", (await page.locator("button", { hasText: "Открыть меню" }).count()) >= 1 && (await page.locator("b", { hasText: "Коротко:" }).count()) >= 1);
  const stored = await page.evaluate(() => { const all = JSON.parse(localStorage.getItem("sa_ai_chats_v2") || "{}"); const u = all["u-staff"]; const s = u && u.sessions.find((x) => x.id === u.activeId); return s ? s.msgs.map((m) => m.role + ":" + m.content.slice(0, 30)) : []; });
  ok(tag + ": переписка записана на устройстве (2 реплики)", stored.length === 2 && /^user:Как предложить/.test(stored[0]) && /^assistant:/.test(stored[1]), JSON.stringify(stored));
  await shot(page, "at3-chat");
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── AF. Живых голосов нет — отвечает голос телефона, об этом одна строка ──
if (want("AF")) {
  const tag = "AF";
  const { ctx, page, errors, C } = await open({ tts: (b) => (b.probe ? { ok: true, configured: false, talk: false, provider: null } : { ok: false, error: "not_configured" }) });
  await openMentor(page);
  await watch(page);
  await page.locator("[data-talk-open]").click();
  await sayTurn(page, 900);
  const tr = await waitSeen(page, (s) => passed(s, TURN), 10000);
  const sp = passed(tr, TURN);
  const spoken = await page.evaluate(() => window.__spoken.slice());
  ok(tag + ": ответ прочитал голос телефона и снова слушает", sp && spoken.length >= 1 && /предложи десерт/.test(spoken.join(" ")) && !/\[\[|\*\*/.test(spoken.join(" ")), JSON.stringify(spoken).slice(0, 200));
  const note = await noteText(page);
  ok(tag + ": строка «живые голоса не подключены — голос телефона»", /голос телефона/.test(note), note + " " + JSON.stringify(await seen(page)));
  ok(tag + ": реплик живым голосом не просили", C.tts.filter((b) => b.talk).length === 0);
  await shot(page, "af-phone");
  await page.locator("[data-talk-stop]").click(); await sleep(300);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── AL. Живые голоса кончились посреди разговора — дальше голос телефона, с объяснением ──
if (want("AL")) {
  const tag = "AL";
  const { ctx, page, errors } = await open({ tts: (b) => (b.probe ? { ok: true, configured: true, talk: true } : { ok: false, error: "daily_limit" }) });
  await openMentor(page);
  await watch(page);
  await page.locator("[data-talk-open]").click();
  await sayTurn(page, 900);
  await waitSeen(page, (s) => passed(s, TURN), 10000);
  const note = await noteText(page);
  const spoken = await page.evaluate(() => window.__spoken.slice());
  ok(tag + ": лимит живых голосов — читает телефон, строка об этом", /на сегодня закончились/.test(note) && /предложи десерт/.test(spoken.join(" ")), note + " | " + spoken.length);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── AI. Перебить: касание волны, пока говорит, — замолкает и слушает ──
if (want("AI")) {
  const tag = "AI";
  const { ctx, page, errors } = await open({ tts: (b) => (b.probe ? { ok: true, talk: true, configured: true } : { ok: true, audio: LONG }) });
  await openMentor(page);
  await page.locator("[data-talk-open]").click();
  await sayTurn(page, 900);
  const sp = await waitSt(page, "speaking", 9000);
  await sleep(700);
  const { acOpen, micLive } = await page.evaluate(() => ({ acOpen: window.__acs.filter((c) => c.state === "running").length, micLive: window.__mic.live() }));
  const p0 = await page.evaluate(() => window.__pause);
  await page.locator("[data-talk-wave]").click();
  const l = await waitSt(page, "listening", 1500);
  const p1 = await page.evaluate(() => window.__pause);
  ok(tag + ": говорит → касание волны → «слушаю», звук остановлен", sp && l && p1 > p0, `pause ${p0}→${p1}`);
  ok(tag + ": пока говорил — микрофон выключен, AudioContext разбора приглушён", acOpen === 0 && micLive === 0, JSON.stringify({ acOpen, micLive }));
  await sleep(500);
  ok(tag + ": микрофон снова открыт", (await page.evaluate(() => window.__mic.live())) === 1);
  // и закончить фразу касанием, не дожидаясь паузы
  await sleep(300);
  await page.evaluate(() => window.__mic.say(6000));
  const h = await waitSt(page, "hearing", 3000);
  await sleep(500);
  await page.locator("[data-talk-wave]").click();
  const r = await waitSt(page, "recognizing", 1200) || await waitSt(page, "thinking", 1200);
  ok(tag + ": «слышу» → касание волны — фраза закончена сразу", h && r);
  await page.locator("[data-talk-stop]").click(); await sleep(300);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── AP. Молчит 12 секунд — пауза (микрофон закрыт), касание — слушаю снова ──
if (want("AP")) {
  const tag = "AP";
  const { ctx, page, errors } = await open({});
  await openMentor(page);
  await page.locator("[data-talk-open]").click();
  await waitSt(page, "listening", 5000);
  const p = await waitSt(page, "paused", 15000);
  const note = await noteText(page);
  ok(tag + ": молчание — «пауза», подсказка коснуться волны", p && /Не слышу/.test(note), note);
  ok(tag + ": в паузе микрофон выключен", (await page.evaluate(() => window.__mic.live())) === 0);
  await shot(page, "ap-paused");
  await page.locator("[data-talk-wave]").click();
  ok(tag + ": касание — снова «слушаю»", await waitSt(page, "listening", 1500));
  await watch(page);
  await sayTurn(page, 900);
  const trp = await waitSeen(page, (s) => count(s, "speaking") >= 1, 9000);
  ok(tag + ": после паузы — фраза ушла, ответ прозвучал", count(trp, "speaking") >= 1, states(trp).join(" → "));
  await page.locator("[data-talk-stop]").click(); await sleep(300);
  // «Завершить», пока микрофон ещё не ответил (телефон думает над разрешением) — микрофон не остаётся включённым
  await page.evaluate(() => { window.__mic.delays = [900]; });
  await page.locator("[data-talk-open]").click(); await sleep(250);
  await page.locator("[data-talk-stop]").click(); await sleep(1300);
  ok(tag + ": «Завершить» до ответа микрофона — микрофон выключен", (await page.evaluate(() => window.__mic.live())) === 0 && (await page.locator("[data-talk]").count()) === 0);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── AE. Ошибки: нет доступа к микрофону; распознавание не ответило; ответа нет ──
if (want("AE")) {
  const tag = "AE";
  {
    const { ctx, page, errors } = await open({ mic: "deny" });
    await openMentor(page);
    await page.locator("[data-talk-open]").click();
    const p = await waitSt(page, "paused", 4000);
    const note = await noteText(page);
    ok(tag + ": нет доступа к микрофону — пауза и понятная строка", p && /Нет доступа к микрофону/.test(note), note);
    ok(tag + ": без ошибок (микрофон)", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open({ stt: () => ({ __status: 502, error: "provider" }) });
    await openMentor(page);
    await page.locator("[data-talk-open]").click();
    await sayTurn(page, 900);
    const p = await waitSt(page, "paused", 8000);
    const note = await noteText(page);
    ok(tag + ": распознавание не ответило — пауза и строка", p && note.length > 5, note);
    ok(tag + ": без ошибок (распознавание)", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open({ stt: () => ({ text: "" }) });
    await openMentor(page);
    await page.locator("[data-talk-open]").click();
    await sayTurn(page, 900);
    await sleep(2200);
    const note = await noteText(page);
    ok(tag + ": пустое распознавание — «Не расслышал» и снова слушает", /Не расслышал/.test(note) && ["listening", "hearing"].includes(await st(page)), note + " / " + (await st(page)));
    await sayTurn(page, 900);
    const p2 = await waitSt(page, "paused", 6000);
    ok(tag + ": второй раз пусто — пауза «коснись волны» (без круга без конца)", p2 && /коснись волны/.test(await noteText(page)), await noteText(page));
    ok(tag + ": без ошибок (пусто)", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── AB. Telegram: «Назад» закрывает разговор, Наставник остаётся ──
if (want("AB")) {
  const tag = "AB";
  const { ctx, page, errors } = await open({ telegram: true });
  await openMentor(page);
  await page.locator("[data-talk-open]").click();
  await waitSt(page, "listening", 5000);
  await page.evaluate(() => window.__bb.press()); await sleep(500);
  ok(tag + ": «Назад» Telegram — разговор закрыт", (await page.locator("[data-talk]").count()) === 0);
  ok(tag + ": …а Наставник открыт", (await page.locator('textarea[placeholder="Спроси наставника…"]').count()) === 1);
  ok(tag + ": микрофон выключен", (await page.evaluate(() => window.__mic.live())) === 0);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── LT. Светлая тема: экран разговора светлый, текст читается ──
if (want("LT")) {
  const tag = "LT";
  const { ctx, page, errors } = await open({ light: true, tts: (b) => (b.probe ? { ok: true, talk: true, configured: true } : { ok: true, audio: LONG }) });
  await openMentor(page);
  await shot(page, "lt0-button");
  await page.locator("[data-talk-open]").click();
  await sayTurn(page, 900);
  await waitSt(page, "speaking", 9000);
  await sleep(400);
  const c = await page.evaluate(() => { const cap = getComputedStyle(document.querySelector(".tkb-cap")); const t = getComputedStyle(document.querySelector("[data-talk-state]")); return { light: document.documentElement.classList.contains("sa-light"), bg: cap.backgroundColor, color: t.color }; });
  ok(tag + ": в светлой теме — полоса светлая, текст тёмный", c.light && /^rgba\(255, 252, 244/.test(c.bg) && /rgb\((1[0-9]{2}|[0-9]{1,2}), /.test(c.color), JSON.stringify(c));
  await shot(page, "lt1-speaking");
  await page.locator("[data-talk-stop]").click(); await sleep(300);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── AZ. Разбор уровня не работает (ровный ноль) — через 3 с «договоришь — коснись шара», касание — фраза ушла ──
if (want("AZ")) {
  const tag = "AZ";
  const { ctx, page, errors, C } = await open({ mic: "dead" });
  await openMentor(page);
  await watch(page);
  await page.locator("[data-talk-open]").click();
  await waitSt(page, "listening", 5000);
  const h = await waitSt(page, "hearing", 6000);
  const note = await noteText(page);
  ok(tag + ": ровный ноль 3 с — «слышу» и строка «коснись волны»", h && /коснись волны/.test(note), note + " " + JSON.stringify(await seen(page)) + " " + JSON.stringify(await page.evaluate(() => window.__acs.map((c) => c.state))));
  await sleep(600);
  await page.locator("[data-talk-wave]").click();
  const tr = await waitSeen(page, (s) => count(s, "recognizing") >= 1, 2000);
  await waitSeen(page, (s) => count(s, "speaking") >= 1, 6000);
  ok(tag + ": касание — фраза сразу ушла на распознавание и Наставнику", count(tr, "recognizing") >= 1 && C.stt.length === 1 && C.chat.length === 1, states(tr).join(" → "));
  await page.locator("[data-talk-stop]").click(); await sleep(300);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── AM. Живых голосов нет, а голос телефона молчит — не висим в «говорит»: ответ на экране, пауза ──
if (want("AM")) {
  const tag = "AM";
  const { ctx, page, errors } = await open({ phone: "mute", tts: (b) => (b.probe ? { ok: true, configured: false, talk: false } : { ok: false, error: "not_configured" }) });
  await openMentor(page);
  await watch(page);
  await page.locator("[data-talk-open]").click();
  await sayTurn(page, 900);
  const p = await waitSt(page, "paused", 12000);
  const tr = await seen(page);
  const sp = tr.find((x) => x.s === "speaking"), pz = tr.find((x) => x.s === "paused");
  ok(tag + ": телефон молчит — через ~5 с пауза, а не «говорит» без конца", p && sp && pz && pz.t - sp.t < 7000, sp && pz ? (pz.t - sp.t) + " мс" : states(tr).join(" → "));
  ok(tag + ": строка «ответ в чате» и сам ответ в чате", /ответ в чате/.test(await noteText(page)) && /предложи десерт, когда уносишь тарелки/.test(await page.evaluate(() => document.body.innerText)), await noteText(page));
  // касание волны — это касание: голос телефона будим ещё раз (одна попытка)
  const n0 = await page.evaluate(() => window.__speakEvt.length);
  await page.locator("[data-talk-wave]").click();
  const ev1 = await page.evaluate((n0) => ({ t: window.__spoken.slice(n0, n0 + 1), e: window.__speakEvt.slice(n0, n0 + 1) }), n0);
  ok(tag + ": касание волны в паузе — голос телефона будим снова (внутри касания)", ev1.t[0] === " " && ev1.e[0] === "click", JSON.stringify(ev1));
  await sayTurn(page, 900);
  const p2 = await waitSeen(page, (s) => count(s, "paused") >= 2, 12000);
  ok(tag + ": вторая попытка — снова молчит, снова пауза", count(p2, "paused") >= 2, states(p2).join(" → "));
  await page.locator("[data-talk-wave]").click();
  await sayTurn(page, 900);
  const p3 = await waitSeen(page, (s) => count(s, "paused") >= 3, 9000);
  const tr3 = p3.slice(p3.map((x) => x.s).lastIndexOf("thinking"));
  const th3 = tr3[0], pz3 = tr3.find((x) => x.s === "paused");
  ok(tag + ": дальше ответ — сразу в чат и пауза (телефон больше не ждём)", th3 && pz3 && pz3.t - th3.t < 1500, th3 && pz3 ? (pz3.t - th3.t) + " мс" : states(p3).join(" → "));
  await page.locator("[data-talk-stop]").click(); await sleep(300);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── AV. Ушёл из приложения посреди разговора — пауза, микрофон выключен ──
if (want("AV")) {
  const tag = "AV";
  const { ctx, page, errors } = await open({});
  await openMentor(page);
  await page.locator("[data-talk-open]").click();
  await waitSt(page, "listening", 5000);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await sleep(300);
  ok(tag + ": свернул — пауза, микрофон выключен, строка «на паузе»", (await st(page)) === "paused" && (await page.evaluate(() => window.__mic.live())) === 0 && /на паузе/.test(await noteText(page)), (await st(page)) + " / " + (await noteText(page)));
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.locator("[data-talk-wave]").click();
  ok(tag + ": вернулся, коснулся волны — слушаю", await waitSt(page, "listening", 3000));
  await page.locator("[data-talk-stop]").click(); await sleep(300);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── MB. Кнопка-микрофон пишет — волна ждёт; надиктовал — в поле текст, на месте волны «Отправить» ──
if (want("MB")) {
  const tag = "MB";
  const { ctx, page, errors } = await open({});
  await openMentor(page);
  await page.locator('button[aria-label="Сказать голосом"]').click(); await sleep(700);
  ok(tag + ": микрофон пишет — волна неактивна", (await page.locator("[data-talk-open][disabled]").count()) === 1);
  await page.evaluate(() => window.__mic.say(600)); await sleep(800);
  await page.locator('button[aria-label="Остановить запись"]').click(); await sleep(1500);
  const v = await page.locator('textarea[placeholder="Спроси наставника…"]').inputValue();
  ok(tag + ": надиктовал — текст в поле, «Отправить» на месте волны", /десерт/.test(v) && (await sendBtn(page).count()) === 1 && (await page.locator("[data-talk-open]").count()) === 0, v);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── PB. Кнопка «Пауза» в полосе: микрофон выключен, касание — слушаю снова ──
if (want("PB")) {
  const tag = "PB";
  const { ctx, page, errors } = await open({});
  await openMentor(page);
  await page.locator("[data-talk-open]").click();
  await waitSt(page, "listening", 5000);
  await page.locator("[data-talk-pause]").click(); await sleep(300);
  ok(tag + ": «Пауза» — пауза, микрофон выключен", (await st(page)) === "paused" && (await page.evaluate(() => window.__mic.live())) === 0);
  await shot(page, "pb-paused");
  await page.locator("[data-talk-pause]").click();
  ok(tag + ": ещё раз — слушаю", await waitSt(page, "listening", 3000));
  await page.locator("[data-talk-stop]").click(); await sleep(300);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── GS. Снимки: живой гость в разговоре голосом (длинные реплики — видно «звучит») ──
if (want("GS")) {
  const tag = "GS";
  const { ctx, page, errors } = await open({ stt: (i) => ({ text: GUEST_STT[Math.min(i, GUEST_STT.length - 1)] }), tts: (b) => (b.probe ? { ok: true, talk: true, configured: true } : { ok: true, audio: LONG }) });
  await page.evaluate(() => window.__saNav("shift")); await sleep(1100);
  await page.locator('.sa-card[aria-label="Живой гость"]').first().click(); await sleep(1600);
  await page.locator(".tb .tb-main").click(); await sleep(700);
  await page.locator(".tb [data-talk-open]").click();
  ok(tag + ": первая фраза гостя звучит — значок у неё", await waitSt(page, "speaking", 6000) && (await page.locator(".tb [data-talk-speaking]").count()) === 1);
  await sleep(600);
  await shot(page, "gs1-first");
  await page.locator("[data-talk-wave]").click();
  await sayTurn(page, 1600);
  await sleep(300);
  ok(tag + ": ты говоришь — пузырь с точками", (await page.locator(".tb [data-talk-pending]").count()) === 1);
  await shot(page, "gs2-hearing");
  await waitSt(page, "speaking", 9000); await sleep(700);
  await shot(page, "gs3-speaking");
  await page.locator("[data-talk-stop]").click(); await sleep(400);
  ok(tag + ": «Стоп» — снова поле и кнопки", (await page.locator(".tb .lg-in").count()) === 1 && (await page.locator(".tb [data-talk]").count()) === 0);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── AN. Телефон без записи голоса — волны нет, «Отправить» как раньше ──
if (want("AN")) {
  const tag = "AN";
  const { ctx, page, errors } = await open({ noRecorder: true });
  await openMentor(page);
  ok(tag + ": нет записи — волны нет, кнопка «Отправить» на месте", (await page.locator("[data-talk-open]").count()) === 0 && (await sendBtn(page).count()) === 1);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── GT. Живой гость голосом: первая фраза гостя — живым голосом, три реплики, гость уходит — экран
//    разговора закрывается сам, дальше «Получить чек разбора» ──
if (want("GT")) {
  const tag = "GT";
  const { ctx, page, errors, C } = await open({ stt: (i) => ({ text: GUEST_STT[Math.min(i, GUEST_STT.length - 1)] }) });
  await page.evaluate(() => window.__saNav("shift")); await sleep(1100);
  await page.locator('.sa-card[aria-label="Живой гость"]').first().click(); await sleep(1600);
  const gname = await page.evaluate(() => { const h = document.querySelector(".tb .lg-card h2"); return h ? h.textContent : ""; });
  await page.locator(".tb .tb-main").click(); await sleep(700);
  ok(tag + ": разговор с гостем — кнопка-волна на месте «Сказать»", (await page.locator(".tb [data-talk-open]").count()) === 1 && (await page.locator(".tb .lg-send").count()) === 0);
  await page.locator(".tb .lg-in").fill("Здравствуйте"); await sleep(150);
  ok(tag + ": набрал — «Сказать» вернулась", (await page.locator(".tb .lg-send").count()) === 1 && (await page.locator(".tb [data-talk-open]").count()) === 0);
  await page.locator(".tb .lg-in").fill(""); await sleep(150);
  await shot(page, "gt0-button");
  await watch(page);
  await page.locator(".tb [data-talk-open]").click(); await sleep(300);
  ok(tag + ": полоса разговора с гостем на месте поля, настроение гостя видно", (await page.locator(".tb [data-talk]").count()) === 1 && /Разговор голосом · /.test(await page.locator("[data-talk]").getAttribute("aria-label")) && (await page.locator(".tb .lg-in").count()) === 0 && (await page.locator(".tb .lg-mood").count()) === 1, gname);
  const firstSp = count(await waitSeen(page, (s) => count(s, "speaking") >= 1, 5000), "speaking") >= 1;
  const firstTts = C.tts.filter((b) => b.talk)[0] || {};
  const female = /[ая]$/i.test(gname.split(" ")[0]);
  ok(tag + ": первая фраза гостя — живым голосом гостя", firstSp && firstTts.who === (female ? "guest_f" : "guest") && firstTts.text && !/\*/.test(firstTts.text), JSON.stringify(firstTts).slice(0, 160));
  for (let i = 0; i < 3; i++) {
    await sayTurn(page, 1000);
    if (i < 2) await waitSeen(page, (s) => count(s, "speaking") >= i + 2, 9000);
  }
  // третья реплика: гость прощается — после его слов полоса разговора закрывается сама
  let closed = false;
  for (let i = 0; i < 40 && !closed; i++) { await sleep(250); closed = (await page.locator("[data-talk]").count()) === 0; }
  ok(tag + ": гость попрощался — полоса разговора закрылась сама", closed);
  const gReqs = C.chat.filter((b) => b.mode === "guest" && !b.finish);
  ok(tag + ": реплики гостя — потоком", gReqs.length === 3 && gReqs.every((b) => b.stream === true), String(gReqs.length));
  const said = C.tts.filter((b) => b.talk).map((b) => b.text);
  ok(tag + ": в голос гостя — без *действий* и меток", said.length >= 4 && said.every((t) => !/\*|\[\[|mood|end\]/.test(t)) && said.some((t) => /поезд/.test(t)) && said.some((t) => /Можно счёт/.test(t)), JSON.stringify(said).slice(0, 260));
  const tbt = await page.evaluate(() => { const el = document.querySelector(".tb"); return el ? el.innerText.replace(/\s+/g, " ") : ""; });
  ok(tag + ": в чате — все реплики голосом", (await page.locator(".tb .tb-mine").count()) === 3 && (await page.locator(".tb .lg-g").count()) === 4 && /Рекомендую борщ/.test(tbt), tbt.slice(-240));
  ok(tag + ": настроение гостя — «в восторге»", (await page.locator('.tb .lg-mood[data-mood="5"]').count()) === 1);
  ok(tag + ": «Гость попросил счёт» и кнопка «Получить чек разбора»", /Гость попросил счёт/.test(tbt) && (await page.locator(".tb .tb-main", { hasText: "Получить чек разбора" }).count()) === 1);
  ok(tag + ": микрофон выключен", (await page.evaluate(() => window.__mic.live())) === 0);
  await shot(page, "gt1-after");
  await page.locator(".tb .tb-main", { hasText: "Получить чек разбора" }).click(); await sleep(1500);
  ok(tag + ": чек разбора", /Чек разбора/.test(await page.evaluate(() => document.body.innerText)));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
process.exit(bad ? 1 : 0);
