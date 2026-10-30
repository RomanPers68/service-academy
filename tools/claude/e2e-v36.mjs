// e2e v36 (Доп. 345–347):
//  TG — лента трека у первой и последней темы — тоже шириной в пять страниц (пустые невидимые места окна):
//       окно из трёх страниц (~1250 px) на iPhone попадало между порогами WebKit (1024 / 1280 px) и слой ленты
//       на ходу «перескакивал» — меню пропадало; упругий край и листание — как были.
//  RG — то же у ленты обложек радио.
//  RM — радио голосом телефона: Media Session не включается, и «пауза», которую WebKit жмёт сам, когда голос
//       телефона начинает читать (эмуляция MediaSession::suspendPlayback), радио больше не останавливает.
//  RL — радио живыми голосами: Media Session есть, голос телефона не «будим» беззвучной фразой (она прерывала
//       <audio>); звук остановила система — выпуск на паузе и строка об этом; отказ живых голосов — с причиной.
//  RP — проверка живых голосов: сбой связи не запоминается — открыли радио снова, голоса появились.
//  TK — разговор голосом: «Живой голос не ответил (причина)»; длинный ответ Наставника вслух — начало и
//       «Остальное — в чате.», в чате — весь; ai-chat получает voice: true.
// Запуск: node tools/claude/e2e-v36.mjs [TG RG RM RL RP TK]; другой сайт — E2E_SITE=/путь
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = 5206, OUT = "/home/claude/preview/shots-v36";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { SEASONAL_MODULES } = await import(SRC + "/data/modules-seasonal.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const STAFF = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false };
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function wavUrl(sec = 0.35, freq = 330, amp = 0.15) {
  const sr = 16000, n = Math.round(sr * sec), buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / sr) * amp * 32767), 44 + i * 2);
  return "data:audio/wav;base64," + buf.toString("base64");
}
const SHORT = wavUrl(0.35), LONG = wavUrl(3);

// длинный ответ Наставника — как на видео (заголовки, нумерация, «Кстати…», кнопка)
const LONG_REPLY = [
  "Первый день волнует всех, и это нормально.", "", "**Вот что реально помогает:**", "",
  "**1. Приди за 20 минут до смены**", "Не спешка в последний момент. Приди, переоденься, посмотри график столов, где ты будешь работать. Спокойствие начинается с подготовки.", "",
  "**2. Пройди разминку**", "У тебя сегодня в графике утро — отлично. Перед сменой открой Разминку до смены (3 задания на 2 минуты). Это не просто упражнение — это переключение в режим работы.", "",
  "**3. Найди своего наставника**", "На первый день у тебя должен быть человек, к которому можно подойти. Спроси менеджера, кто тебе поможет. Не стесняйся — это их работа.", "",
  "**4. Знай, что ты не один**", "Первый день — это не экзамен. Это день, когда ты наблюдаешь, копируешь и учишься. Ошибки будут — это нормально. Главное — честно признать и исправить.", "",
  "**Кстати, замечу:** у тебя в очереди на повтор две важные темы — про роль хостес и про первые слова с гостем. Освежи перед сменой — потом всё остальное будет проще.",
  "[[go:warmup|Разминка до смены]]",
].join("\n");

// tts(body) → ответ radio-tts (null — «нет связи»); mentor — ответ Наставника; storage — ключи пользователя ({uk})
async function open({ telegram = false, tts = null, mentor = "Коротко: предложи десерт, когда уносишь тарелки.", storage = {}, w = 390, h = 844, light = false, calls = null }) {
  const C = calls || { tts: [], stt: [], chat: [] };
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    const J = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (/\/functions\/v1\/radio-tts/.test(u)) {
      C.tts.push(body);
      const r = tts ? tts(body) : null;
      if (r === null) return route.abort();
      return J(r);
    }
    if (/\/functions\/v1\/stt/.test(u)) { C.stt.push(body); return J({ text: "Как лучше подготовиться к первому дню?" }); }
    if (/\/functions\/v1\/ai-chat/.test(u)) { C.chat.push(body); return sleep(300).then(() => J({ ok: true, reply: mentor, remaining: 17 })); }
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
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(STAFF), sa_a11y: light ? "1" : "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_last_role: JSON.stringify("seasonal"), sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_quest_open: "1", sa_track_swiped: "1" };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  const ukx = "_" + STAFF.name + "_" + (STAFF.surname || "");
  for (const [k, v] of Object.entries(storage)) seed[k.replace("{uk}", ukx)] = typeof v === "string" ? v : JSON.stringify(v);
  await ctx.addInitScript(([seed, telegram]) => {
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
    // Media Session: какие обработчики стоят (window.__ms) — как их видит WebKit
    try {
      window.__ms = {}; window.__msLog = [];
      const MS = window.MediaSession && window.MediaSession.prototype;
      if (MS && MS.setActionHandler) {
        const s0 = MS.setActionHandler;
        MS.setActionHandler = function (a, h) { window.__ms[a] = h || null; window.__msLog.push(a + ":" + (h ? "on" : "off")); try { return s0.call(this, a, h); } catch (e) { return undefined; } };
      }
    } catch (e) {}
    // <audio>: все элементы, что играли (window.__auds), и сколько раз
    try {
      window.__auds = []; window.__plays = 0;
      const p0 = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__plays++; if (!window.__auds.includes(this)) window.__auds.push(this); return p0.apply(this, arguments); };
    } catch (e) {}
    // голос телефона «говорит» 60 мс. Эмуляция iPhone (WebKit): когда голос телефона начинает звучать, он
    // забирает звук у страницы — играющий <audio> встаёт на паузу, а если Media Session «играет» и у неё
    // есть «пауза», WebKit сам её нажимает (MediaSession::suspendPlayback при прерывании звука)
    try {
      window.__spoken = []; window.__ss = { speaking: false, interrupts: 0 };
      const ss = window.speechSynthesis;
      if (ss) {
        try { Object.defineProperty(ss, "speaking", { get: () => window.__ss.speaking, configurable: true }); Object.defineProperty(ss, "pending", { get: () => false, configurable: true }); } catch (e) {}
        ss.speak = (u) => {
          window.__spoken.push(u.text); window.__ss.speaking = true; window.__ss.cur = u;
          setTimeout(() => {
            if (window.__ss.cur !== u) return;
            try {
              (window.__auds || []).forEach((a) => { if (!a.paused) { window.__ss.interrupts++; a.pause(); } });
              const ms = navigator.mediaSession;
              if (ms && ms.playbackState === "playing" && window.__ms.pause) { window.__ss.interrupts++; window.__ms.pause(); }
            } catch (e) {}
            setTimeout(() => {
              if (window.__ss.cur !== u) return;
              window.__ss.speaking = false;
              try { u.onstart && u.onstart(); u.onend && u.onend(); } catch (e) {}
            }, 40);
          }, 20);
        };
        ss.cancel = () => { const u = window.__ss.cur; window.__ss.cur = null; window.__ss.speaking = false; if (u) setTimeout(() => { try { u.onerror && u.onerror({ error: "canceled" }); } catch (e) {} }, 0); };
      }
    } catch (e) {}
    // поддельный микрофон (как в e2e-v34): пила 140 Гц, громкость задаёт тест
    try {
      const AC0 = window.AudioContext; window.__AC0 = AC0;
      const M = window.__mic = { tracks: [], base: 0.004, level: 0.004, g: null };
      M.live = () => M.tracks.filter((t) => t.readyState === "live").length;
      M.say = (ms, lvl = 0.5) => { M.level = lvl; if (M.g) M.g.gain.value = lvl; clearTimeout(M.t); M.t = setTimeout(() => { M.level = M.base; if (M.g) M.g.gain.value = M.base; }, ms); };
      const md = navigator.mediaDevices;
      if (md) md.getUserMedia = async () => {
        const ac = M.ac || (M.ac = new AC0());
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
  }, [seed, telegram]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1600);
  return { ctx, page, errors, C };
}
const only = process.argv.slice(2);
const want = (tag) => !only.length || only.includes(tag);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const doneMap = (mods) => { const c = {}, q = {}; mods.forEach(m => m.lessons.forEach(l => { if (l.type === "quiz") q[l.id] = true; else if (l.type !== "result") c[l.id] = true; })); return { c, q }; };

// жест пальцем (как в e2e-v33): тянем на dx за n шагов, отпускаем; каждый кадр — где лента и видна ли страница
const TRACK_PROBE = async ([sel, trSel, curSel, dx, steps, watch]) => {
  const vp = document.querySelector(sel), tr = document.querySelector(trSel); const r = vp.getBoundingClientRect();
  const mk = (x, y) => new Touch({ identifier: 5, target: vp, clientX: x, clientY: y });
  const raf = () => new Promise((res) => requestAnimationFrame(res));
  const m41 = () => { const t = getComputedStyle(tr).transform; return t && t !== "none" ? new DOMMatrixReadOnly(t).m41 : 0; };
  const y = r.top + 140; let x = dx < 0 ? r.right - 50 : r.left + 50;
  vp.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [mk(x, y)], changedTouches: [mk(x, y)] }));
  for (let i = 0; i < steps; i++) { x += dx / steps; vp.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [mk(x, y)], changedTouches: [mk(x, y)] })); await raf(); }
  const held = m41();
  vp.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [mk(x, y)] }));
  const fr = []; const t0 = performance.now();
  while (performance.now() - t0 < watch) {
    await raf();
    const cur = document.querySelector(curSel); const cs = cur ? getComputedStyle(cur) : null; const rc = cur ? cur.getBoundingClientRect() : null;
    fr.push({ x: Math.round(m41() * 10) / 10, vis: !!cs && cs.visibility === "visible" && cs.opacity === "1" && rc.height > 150 && rc.right > 60 && rc.left < innerWidth - 60 });
  }
  return { held: Math.round(held * 10) / 10, fr, end: tr.style.transform };
};
// ширина ленты, какой её видит WebKit при сдвиге (union всех вложенных блоков; с тенями — шире на ~40 px)
const SPAN = (trSel) => {
  const tr = document.querySelector(trSel); if (!tr) return null;
  let l = Infinity, r = -Infinity, pl = Infinity, pr = -Infinity;
  tr.querySelectorAll("*").forEach((el) => {
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) return;
    l = Math.min(l, b.left); r = Math.max(r, b.right);
    if (!el.closest(".tbp-gap,.rd-gap")) { pl = Math.min(pl, b.left); pr = Math.max(pr, b.right); }
  });
  return { all: Math.round(r - l), painted: Math.round(pr - pl) };
};

// ── TG. Трек: у краёв лента — тоже в пять страниц; пустые места невидимы; упругий край и листание как были ──
if (want("TG")) {
  for (const light of [false, true]) {
    const tag = "TG" + (light ? "-L" : "");
    const { ctx, page, errors } = await open({ light, w: 440, h: 956 });
    await page.evaluate(() => window.__saNav("home")); await sleep(1300);
    const labels = await page.evaluate(() => [...document.querySelectorAll(".sa-screen .tbp-nums .tbp-num .n")].map((e) => e.textContent));
    const onNow = () => page.evaluate(() => (document.querySelector(".sa-screen .tbp-num.on .n") || {}).textContent);
    const gaps = () => page.evaluate(() => [...document.querySelectorAll(".tbp-track > .tbp-gap")].map((g) => Number(g.getAttribute("data-gap"))).sort((a, b) => a - b));
    // первая тема
    await page.locator(".sa-screen .tbp-nums .tbp-num").nth(0).click(); await sleep(900);
    let g = await gaps(), sp = await page.evaluate(SPAN, ".tbp-track");
    ok(tag + ": первая тема — пустые места слева (−2, −1)", JSON.stringify(g) === "[-2,-1]", JSON.stringify(g));
    ok(tag + ": первая тема — лента шире 1280 px (как посреди трека)", sp && sp.all >= 1600, JSON.stringify(sp));
    // середина
    await page.locator(".sa-screen .tbp-nums .tbp-num").nth(4).click(); await sleep(900);
    g = await gaps(); sp = await page.evaluate(SPAN, ".tbp-track");
    ok(tag + ": посреди трека пустых мест нет (пять страниц и так)", g.length === 0 && sp.all >= 1600, JSON.stringify({ g, sp }));
    const mid = sp.all;
    // последняя тема
    await page.locator(".sa-screen .tbp-nums .tbp-num").nth(labels.length - 1).click(); await sleep(1000);
    ok(tag + ": на последней теме", (await onNow()) === labels[labels.length - 1]);
    g = await gaps(); sp = await page.evaluate(SPAN, ".tbp-track");
    ok(tag + ": последняя тема — пустые места справа (1, 2)", JSON.stringify(g) === "[1,2]", JSON.stringify(g));
    ok(tag + ": последняя тема — лента как посреди трека (без пустых было бы ≈1250 px — между порогами WebKit)", sp.all >= 1600 && Math.abs(sp.all - mid) < 40 && sp.painted < 1290, JSON.stringify({ ...sp, mid }));
    const gs = await page.evaluate(() => [...document.querySelectorAll(".tbp-gap")].map((el) => { const cs = getComputedStyle(el); const tr = el.parentElement.getBoundingClientRect(); const b = el.getBoundingClientRect(); return { pe: cs.pointerEvents, bg: cs.backgroundColor, bi: cs.backgroundImage, sh: cs.boxShadow, h: Math.round(b.height), th: Math.round(tr.height), kids: el.children.length, aria: el.getAttribute("aria-hidden"), inert: el.hasAttribute("inert") }; }));
    ok(tag + ": пустые места — невидимые, без нажатий, на всю высоту ленты, недоступны", gs.length === 2 && gs.every((x) => x.pe === "none" && /rgba\(0, 0, 0, 0\)|transparent/.test(x.bg) && x.bi === "none" && x.sh === "none" && x.h === x.th && x.h > 200 && x.kids === 0 && x.aria === "true" && x.inert), JSON.stringify(gs));
    // правый край экрана — ничего не появилось (пустое место видно краем, как соседняя тема, но оно прозрачное)
    await shot(page, light ? "tg-last-l" : "tg-last");
    // упругий край — как был
    let p = await page.evaluate(TRACK_PROBE, [".tbp-vp", ".tbp-track", ".tbp-cur", -150, 10, 650]);
    const xs = p.fr.map((f) => f.x);
    ok(tag + ": за концом лента упирается и возвращается кадрами, страница видна в каждом кадре", p.held < -25 && p.held > -60 && Math.abs(xs[xs.length - 1]) < 0.6 && p.fr.every((f) => f.vis) && p.end === "", JSON.stringify({ held: p.held, last: xs[xs.length - 1] }));
    ok(tag + ": тема та же", (await onNow()) === labels[labels.length - 1]);
    // листание назад и снова вперёд — пустые места переезжают вместе с окном
    p = await page.evaluate(TRACK_PROBE, [".tbp-vp", ".tbp-track", ".tbp-cur", 190, 8, 700]);
    await sleep(300);
    ok(tag + ": свайп вправо — предыдущая тема, пустое место одно (2)", (await onNow()) === labels[labels.length - 2] && JSON.stringify(await gaps()) === "[2]", (await onNow()) + " " + JSON.stringify(await gaps()));
    p = await page.evaluate(TRACK_PROBE, [".tbp-vp", ".tbp-track", ".tbp-cur", -190, 8, 700]);
    await sleep(300);
    ok(tag + ": свайп влево — снова последняя, пустые места (1, 2)", (await onNow()) === labels[labels.length - 1] && JSON.stringify(await gaps()) === "[1,2]");
    // кнопки темы на последней странице по-прежнему нажимаются (пустое место не перекрывает)
    const hit = await page.evaluate(() => { const b = document.querySelector(".tbp-cur .tbm-cur"); if (!b) return "нет"; const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width - 30, r.top + r.height / 2); return el && el.closest(".tbp-cur") ? "ok" : (el ? el.className : "null"); });
    ok(tag + ": текущий шаг темы нажимается (пустые места не мешают)", hit === "ok", hit);
    ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// радио: три выпуска (следующий урок, выдохшаяся тема, повтор)
const S0 = SEASONAL_MODULES[0];
const dm = doneMap([S0]);
const RSTORE = { "sa_completed{uk}": dm.c, "sa_quiz_done{uk}": dm.q, "sa_fresh{uk}": { s0: { t: Date.now() - 20 * 864e5, n: 0 } }, sa_radio_road: "0", sa_radio_live: "1" };
const openRadio = async (opt) => {
  const o = await open({ telegram: true, storage: RSTORE, ...opt });
  await o.page.evaluate(() => window.__saNav("shift")); await sleep(1000);
  await o.page.locator('.sa-card[aria-label="Радио в дорогу"]').first().click(); await sleep(1500);
  return o;
};
const radioState = (page) => page.evaluate(() => ({
  on: !!document.querySelector(".tb .rd-ctl .play.on"), pos: (document.querySelector(".tb .rd-card.cur .rd-pos") || {}).textContent || "",
  ps: navigator.mediaSession ? navigator.mediaSession.playbackState : "?", pause: typeof window.__ms.pause, play: typeof window.__ms.play,
  spoken: window.__spoken.length, blank: window.__spoken.filter((t) => !String(t).trim()).length, plays: window.__plays, intr: window.__ss.interrupts,
  paused: !!document.querySelector(".tb [data-radio-paused]"), err: (document.querySelector(".tb [data-radio-err]") || {}).textContent || "",
  live: !!document.querySelector(".tb [data-radio-live]"), note: [...document.querySelectorAll(".tb .rd-note[role=status]")].map((n) => n.textContent).join(" | "),
}));

// ── RG. Радио: лента обложек — тоже в пять мест ──
if (want("RG")) {
  for (const light of [false, true]) {
    const tag = "RG" + (light ? "-L" : "");
    const { ctx, page, errors } = await openRadio({ light, w: 440, h: 956 });
    const gaps = () => page.evaluate(() => [...document.querySelectorAll(".tb .rd-strack > .rd-gap")].map((g) => Number(g.getAttribute("data-gap"))).sort((a, b) => a - b));
    const n = await page.evaluate(() => document.querySelectorAll(".tb .rd-tab").length);
    let g = await gaps(), sp = await page.evaluate(SPAN, ".tb .rd-strack");
    ok(tag + ": первый выпуск — пустые места (−2, −1, 2), лента шире 1280 px", n === 3 && JSON.stringify(g) === "[-2,-1,2]" && sp.all >= 1600, JSON.stringify({ n, g, sp }));
    await page.locator(".tb .rd-tab").nth(1).click(); await sleep(700);
    g = await gaps(); sp = await page.evaluate(SPAN, ".tb .rd-strack");
    ok(tag + ": средний выпуск — пустые места (−2, 2): без них три обложки ≈1200 px — между порогами", JSON.stringify(g) === "[-2,2]" && sp.all >= 1600 && sp.painted < 1290, JSON.stringify({ g, sp }));
    const gs = await page.evaluate(() => [...document.querySelectorAll(".tb .rd-gap")].map((el) => { const cs = getComputedStyle(el); return { pe: cs.pointerEvents, bg: cs.backgroundColor, pos: cs.position, h: Math.round(el.getBoundingClientRect().height) }; }));
    ok(tag + ": пустые места — невидимые и без нажатий", gs.every((x) => x.pe === "none" && /rgba\(0, 0, 0, 0\)|transparent/.test(x.bg) && x.pos === "absolute" && x.h > 100), JSON.stringify(gs));
    await shot(page, light ? "rg-l" : "rg");
    ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── RM. Радио голосом телефона: Media Session выключена — «пауза» от WebKit радио не останавливает ──
if (want("RM")) {
  const tag = "RM";
  const { ctx, page, errors } = await openRadio({ tts: (b) => (b.probe ? { ok: true, configured: false, talk: true, provider: "openrouter" } : { ok: false, error: "not_configured" }) });
  const s0 = await radioState(page);
  ok(tag + ": живых голосов нет — переключателя нет, Media Session выключена", !s0.live && s0.ps === "none" && s0.pause !== "function", JSON.stringify(s0));
  await page.locator(".tb .rd-ctl .play").click(); await sleep(1800);
  const s1 = await radioState(page);
  ok(tag + ": «Слушать» — читает голос телефона фраза за фразой и не останавливается", s1.on && s1.spoken >= 5 && /фраза ([5-9]|1\d)/.test(s1.pos), JSON.stringify(s1));
  ok(tag + ": пока читает телефон, Media Session не «играет» и «паузы» нет", s1.ps === "none" && s1.pause !== "function" && s1.play !== "function" && s1.intr === 0, JSON.stringify({ ps: s1.ps, pause: s1.pause, intr: s1.intr }));
  ok(tag + ": без <audio> (голос телефона сам по себе)", s1.plays === 0, "plays=" + s1.plays);
  ok(tag + ": подсказка про беззвучный режим на месте", (await page.locator(".tb [data-radio-tip]").count()) === 1);
  await page.locator(".tb .rd-ctl .play").click(); await sleep(300);
  const s2 = await radioState(page);
  ok(tag + ": «Пауза» — остановилось, без строки «на паузе от системы»", !s2.on && !s2.paused, JSON.stringify(s2));
  await shot(page, "rm-phone");
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── RL. Радио живыми голосами: Media Session есть; голос телефона не «будим»; пауза системы — строка ──
if (want("RL")) {
  const tag = "RL";
  {
    const { ctx, page, errors, C } = await openRadio({ tts: (b) => (b.probe ? { ok: true, configured: true, talk: true, provider: "openrouter" } : { ok: true, url: SHORT, cached: true }) });
    const s0 = await radioState(page);
    ok(tag + ": живые голоса есть — переключатель на месте", s0.live, JSON.stringify(s0));
    await page.locator(".tb .rd-ctl .play").click(); await sleep(1500);
    const s1 = await radioState(page);
    ok(tag + ": играет живой голос (<audio>), фразы идут", s1.on && s1.plays >= 3 && /фраза ([2-9]|1\d)/.test(s1.pos), JSON.stringify(s1));
    ok(tag + ": голос телефона не «будили» беззвучной фразой (она прерывала <audio> на iPhone)", s1.spoken === 0 && s1.blank === 0 && s1.intr === 0, JSON.stringify({ spoken: s1.spoken, intr: s1.intr }));
    ok(tag + ": Media Session «играет», кнопки экрана блокировки на месте", s1.ps === "playing" && s1.pause === "function" && s1.play === "function", JSON.stringify({ ps: s1.ps, pause: s1.pause }));
    ok(tag + ": фразы просили у radio-tts (не в режиме разговора)", C.tts.filter((b) => !b.probe && !b.talk && b.text).length >= 2);
    // система забрала звук (звонок, другое приложение): <audio> встал на паузу сам
    await page.evaluate(() => { const a = window.__auds[window.__auds.length - 1]; a.pause(); });
    await sleep(400);
    const s2 = await radioState(page);
    ok(tag + ": звук остановила система — выпуск на паузе и строка об этом", !s2.on && s2.paused && s2.ps === "paused", JSON.stringify(s2));
    await shot(page, "rl-paused");
    await page.locator(".tb .rd-ctl .play").click(); await sleep(700);
    const s3 = await radioState(page);
    ok(tag + ": «Слушать» — снова играет, строка убрана", s3.on && !s3.paused && s3.ps === "playing", JSON.stringify(s3));
    // «пауза» с экрана блокировки (Media Session)
    await page.evaluate(() => window.__ms.pause()); await sleep(300);
    const s4 = await radioState(page);
    ok(tag + ": «пауза» с экрана блокировки — на паузе, строка", !s4.on && s4.paused, JSON.stringify(s4));
    await page.evaluate(() => window.__ms.play()); await sleep(700);
    const s5 = await radioState(page);
    ok(tag + ": «играть» с экрана блокировки — снова играет", s5.on && !s5.paused, JSON.stringify(s5));
    // конец фразы — тоже «пауза» у <audio>, но выпуск идёт дальше (это не остановка системы)
    await sleep(1200);
    const s6 = await radioState(page);
    ok(tag + ": конец фразы не считается паузой системы — выпуск идёт", s6.on && !s6.paused && s6.plays > s5.plays, JSON.stringify({ on: s6.on, plays: [s5.plays, s6.plays] }));
    await page.locator(".tb .rd-ctl .play").click(); await sleep(300);
    // закрыли радио — Media Session выключена
    await page.locator(".tb .tb-x").first().click(); await sleep(700);
    const ps = await page.evaluate(() => navigator.mediaSession.playbackState);
    ok(tag + ": закрыли радио — Media Session выключена", ps === "none", ps);
    ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
  {
    // живые голоса не ответили — причина в скобках, дальше читает телефон (и Media Session выключается)
    const { ctx, page, errors } = await openRadio({ tts: (b) => (b.probe ? { ok: true, configured: true, talk: true, provider: "openrouter" } : { ok: false, error: "provider", detail: "OpenRouter 404: No endpoints found matching your data policy" }) });
    await page.locator(".tb .rd-ctl .play").click(); await sleep(1500);
    const s = await radioState(page);
    ok(tag + ": отказ живых голосов — строка с причиной (OpenRouter 404…)", /Живые голоса не отвечают \(OpenRouter 404: No endpoints found/.test(s.note), s.note);
    ok(tag + ": дальше читает голос телефона, Media Session выключена", s.on && s.spoken >= 2 && s.ps === "none" && s.pause !== "function", JSON.stringify(s));
    await shot(page, "rl-fallback");
    ok(tag + ": без ошибок (отказ)", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── RP. Проверка живых голосов: сбой связи не запоминается — открыли радио снова, голоса есть ──
if (want("RP")) {
  const tag = "RP";
  let up = false;
  const { ctx, page, errors, C } = await openRadio({ tts: (b) => (!up ? null : b.probe ? { ok: true, configured: true, talk: true, provider: "openrouter" } : { ok: true, url: SHORT }) });
  const s0 = await radioState(page);
  ok(tag + ": проверка не прошла (нет связи) — переключателя нет", !s0.live && C.tts.filter((b) => b.probe).length === 1, JSON.stringify({ live: s0.live, probes: C.tts.length }));
  await page.locator(".tb .tb-x").first().click(); await sleep(800);
  up = true;
  await page.locator('.sa-card[aria-label="Радио в дорогу"]').first().click(); await sleep(1500);
  const s1 = await radioState(page);
  ok(tag + ": открыли радио снова — спросили ещё раз, живые голоса есть", s1.live && C.tts.filter((b) => b.probe).length === 2, JSON.stringify({ live: s1.live, probes: C.tts.filter((b) => b.probe).length }));
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ── TK. Разговор голосом: причина отказа живого голоса; длинный ответ вслух — начало и «Остальное — в чате» ──
if (want("TK")) {
  const tag = "TK";
  const { ctx, page, errors, C } = await open({ mentor: LONG_REPLY, tts: (b) => (b.probe ? { ok: true, configured: true, talk: true, provider: "openrouter" } : { ok: false, error: "provider", detail: "OpenRouter 404: No endpoints found matching your data policy" }) });
  await page.evaluate(() => window.__saNav("assistant")); await sleep(1300);
  await page.locator("[data-talk-open]").click();
  await page.waitForSelector('[data-talk-state="listening"]', { timeout: 8000 }).catch(() => {});
  await sleep(650);
  await page.evaluate(() => window.__mic.say(1000));
  await page.waitForSelector('[data-talk-state="speaking"]', { timeout: 12000, state: "attached" }).catch(() => {});
  await page.waitForSelector('[data-talk-state="listening"]', { timeout: 12000, state: "attached" }).catch(() => {});
  await sleep(300);
  const note = await page.evaluate(() => (document.querySelector("[data-talk-note]") || {}).textContent || "");
  ok(tag + ": живой голос не ответил — причина в скобках", /^Живой голос не ответил \(OpenRouter 404: No endpoints found/.test(note) && /голос телефона/.test(note), note);
  const spoken = await page.evaluate(() => window.__spoken.filter((t) => String(t).trim()).join(" "));
  ok(tag + ": вслух — начало ответа и «Остальное — в чате.» (не больше ~600 знаков)", /^Первый день волнует всех/.test(spoken) && /Остальное — в чате\.$/.test(spoken) && spoken.length <= 640 && !/Кстати, замечу/.test(spoken), spoken.length + ": …" + spoken.slice(-90));
  ok(tag + ": вслух без «помогает:.» (заголовок с двоеточием читается ровно)", /помогает: Приди/.test(spoken), spoken.slice(0, 160));
  const chatText = await page.evaluate(() => document.body.innerText);
  ok(tag + ": в чате — весь ответ (и последний раздел)", /Знай, что ты не один/.test(chatText) && /Освежи перед сменой/.test(chatText));
  const body = C.chat[0] || {};
  ok(tag + ": ai-chat получил voice: true (короткий ответ для разговора)", body.voice === true && !body.mode, JSON.stringify({ voice: body.voice }));
  await shot(page, "tk-note");
  await page.locator("[data-talk-stop]").click(); await sleep(300);
  ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
process.exit(bad ? 1 : 0);
