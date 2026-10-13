// e2e v33: лента тем у края и при отмене свайпа возвращается кадрами (без CSS-перехода к «без сдвига»,
// на iPhone он стирал страницу), перехват ленты на лету; радио — то же для обложек; голос телефона
// без «тихой дорожки» и Audio Session, отказ телефона читать — сообщение с кодом.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = "/home/claude/preview/site", PORT = 5204, OUT = "/home/claude/preview/shots-v33";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { SEASONAL_MODULES } = await import(SRC + "/data/modules-seasonal.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const STAFF = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false };
const OWNER = { id: "u-own", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "senior", is_admin: true };
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ymdL = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const now = new Date();
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();

// команда для «Управления данными»: двое не начинали, одна уснула (18 дней), трое занимаются
const TEAM = [
  { name: "Иван", surname: "Иванов", restaurant: "Два моря, Океан", position: "waiter" },
  { name: "Марк", surname: "Финке", restaurant: "Два моря, Океан", position: "hostess" },
  { name: "Екатерина", surname: "Лучко", restaurant: "Два моря, Океан", position: "waiter" },
  { name: "Кристина", surname: "Кочнева", restaurant: "Два моря, Океан", position: "hostess" },
  { name: "Дмитрий", surname: "Блеклов", restaurant: "Два моря, Океан", position: "bartender" },
  { name: "Сергей", surname: "Малахов", restaurant: "Два моря, Океан", position: "manager" },
];
let sid = 0;
const sc = (p, n, ago, role = "seasonal") => Array.from({ length: n }, (_, i) => ({ id: "sc" + (++sid), name: p.name, surname: p.surname, restaurant: p.restaurant, role, position: p.position, quiz_id: "q" + sid, score: 9, total: 10, updated_at: daysAgo(ago + i) }));
const SCORES = [...sc(TEAM[2], 2, 18), ...sc(TEAM[3], 3, 1), ...sc(TEAM[4], 7, 2, "bar"), ...sc(TEAM[5], 9, 0, "manager")];

async function open({ storage = {}, light = false, w = 390, h = 844, url = "/", rpcs = null, profile = STAFF, calls = [], telegram = false, speech = "instant" }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const fn = m[1];
      let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
      calls.push({ fn, body });
      if (rpcs) { const r = rpcs(fn, body); if (r !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r) }); }
      const mock = {
        whoami: { ok: true, employee: profile },
        my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: storage.__role === null ? null : "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "none" },
        my_mentors: { ok: true, rows: [{ name: "Мария" }] },
        menu_get: [],
      };
      if (mock[fn] !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[fn]) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    }
    return route.abort();
  });
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(profile), sa_a11y: light ? "1" : "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0" };
  if (storage.__role !== null) seed.sa_last_role = JSON.stringify(storage.__role || "seasonal");
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  const ukx = "_" + profile.name + "_" + (profile.surname || "");
  for (const [k, v] of Object.entries(storage)) { if (k === "__role") continue; seed[k.replace("{uk}", ukx)] = typeof v === "string" ? v : JSON.stringify(v); }
  await ctx.addInitScript(([seed, telegram, speech]) => {
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
    // голос в headless: озвучка «говорит» мгновенно (как в e2e-v31)
    // v33: счётчики голоса и медиа; режим "fail" — телефон через ~1,1 с отказывается читать (как на iPhone в v32)
    try {
      window.__spoken = []; window.__ss = { speak: 0, cancel: 0, cancelIdle: 0, speaking: false };
      const ss = window.speechSynthesis;
      if (ss) {
        try { Object.defineProperty(ss, "speaking", { get: () => window.__ss.speaking, configurable: true }); Object.defineProperty(ss, "pending", { get: () => false, configurable: true }); } catch (e) {}
        ss.speak = (u) => {
          window.__ss.speak++; window.__spoken.push(u.text); window.__ss.speaking = true; window.__ss.cur = u;
          if (speech === "fail") { setTimeout(() => { if (window.__ss.cur !== u) return; window.__ss.speaking = false; try { u.onerror && u.onerror({ error: "audio-busy" }); } catch (e) {} }, 1100); return; }
          setTimeout(() => { if (window.__ss.cur !== u) return; window.__ss.speaking = false; try { u.onstart && u.onstart(); u.onend && u.onend(); } catch (e) {} }, 60);
        };
        ss.cancel = () => { window.__ss.cancel++; if (!window.__ss.speaking) window.__ss.cancelIdle++; const u = window.__ss.cur; window.__ss.cur = null; window.__ss.speaking = false; if (u) setTimeout(() => { try { u.onerror && u.onerror({ error: "canceled" }); } catch (e) {} }, 0); };
      }
    } catch (e) {}
    try {
      window.__media = 0;
      const p0 = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__media++; try { return p0.apply(this, arguments); } catch (e) { return Promise.resolve(); } };
      if (!navigator.audioSession) Object.defineProperty(navigator, "audioSession", { value: { type: "auto" }, configurable: true });
    } catch (e) {}
  }, [seed, telegram, speech]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + url, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1600);
  return { ctx, page, errors };
}
const text = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const only = process.argv.slice(2);
const want = (tag) => !only.length || only.includes(tag);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const doneMap = (mods) => { const c = {}, q = {}; mods.forEach(m => m.lessons.forEach(l => { if (l.type === "quiz") q[l.id] = true; else if (l.type !== "result") c[l.id] = true; })); return { c, q }; };
const teamRpcs = (extra) => (fn, body) => {
  if (extra) { const r = extra(fn, body); if (r !== undefined) return r; }
  if (fn === "team_profiles") return { ok: true, rows: TEAM, scope: "restaurant" };
  if (fn === "team_scores") return { ok: true, rows: SCORES };
  return undefined;
};


// жест пальцем по элементу: тянем на dx за n шагов (по кадру), отпускаем; потом каждый кадр — где лента
const TRACK_PROBE = async ([sel, trSel, curSel, dx, steps, watch, catchDx]) => {
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
    fr.push({ x: Math.round(m41() * 10) / 10, tr: tr.style.transition, vis: !!cs && cs.visibility === "visible" && cs.opacity === "1" && rc.height > 150 && rc.right > 60 && rc.left < innerWidth - 60 });
  }
  let caught = null;
  if (catchDx) {
    // перехват на лету: палец снова на ленте — лента остаётся там, где была, и идёт за пальцем
    const before = m41();
    let x2 = catchDx > 0 ? r.left + 50 : r.right - 50;
    vp.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [mk(x2, y)], changedTouches: [mk(x2, y)] }));
    await raf();
    const at = m41();
    for (let i = 0; i < 10; i++) { x2 += catchDx / 10; vp.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [mk(x2, y)], changedTouches: [mk(x2, y)] })); await raf(); }
    vp.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [mk(x2, y)] }));
    caught = { before: Math.round(before * 10) / 10, at: Math.round(at * 10) / 10 };
  }
  return { held: Math.round(held * 10) / 10, fr, caught, end: tr.style.transform };
};
const settleOk = (g) => {
  const css = g.fr.some((f) => /transform/.test(f.tr));
  const xs = g.fr.map((f) => f.x);
  const mono = xs.every((x, i) => i === 0 || Math.abs(x) <= Math.abs(xs[i - 1]) + 0.6);
  return { css, mono, last: xs[xs.length - 1], n: xs.length, vis: g.fr.every((f) => f.vis), xs };
};

// ── TE. Трек: у последней темы потянули дальше конца / не дотянули посреди трека — лента возвращается
//    кадрами (без CSS-перехода к «без сдвига»), страница видна в каждом кадре; перехват на лету ──
if (want("TE")) {
  for (const light of [false, true]) {
    const tag = "TE" + (light ? "-L" : "");
    const { ctx, page, errors } = await open({ light, storage: { sa_track_swiped: "1" } });
    await page.evaluate(() => window.__saNav("home")); await sleep(1300);
    const labels = await page.evaluate(() => [...document.querySelectorAll(".sa-screen .tbp-nums .tbp-num .n")].map((e) => e.textContent));
    const onNow = () => page.evaluate(() => (document.querySelector(".sa-screen .tbp-num.on .n") || {}).textContent);
    await page.locator(".sa-screen .tbp-nums .tbp-num").nth(labels.length - 1).click(); await sleep(1000);
    ok(tag + ": на последней теме", (await onNow()) === labels[labels.length - 1], (await onNow()) + " / " + labels.join(","));
    let g = await page.evaluate(TRACK_PROBE, [".tbp-vp", ".tbp-track", ".tbp-cur", -150, 10, 650, 0]);
    let s = settleOk(g);
    ok(tag + ": за концом лента упирается (сдвиг втрое меньше пальца)", g.held < -25 && g.held > -60, "held=" + g.held);
    ok(tag + ": отпустил — возврат кадрами, без CSS-перехода", !s.css && s.n > 8, JSON.stringify(g.fr.slice(0, 2)));
    ok(tag + ": лента едет только к нулю и встаёт ровно", s.mono && Math.abs(s.last) < 0.6 && g.end === "", JSON.stringify(s.xs).slice(0, 180));
    ok(tag + ": страница (меню темы) видна в каждом кадре", s.vis);
    ok(tag + ": тема та же", (await onNow()) === labels[labels.length - 1]);
    await shot(page, light ? "te-end-l" : "te-end");
    // перехват на лету: потянул за конец, отпустил и через 90 мс повёл вправо — к предыдущей теме, без рывка
    g = await page.evaluate(TRACK_PROBE, [".tbp-vp", ".tbp-track", ".tbp-cur", -150, 10, 90, 230]);
    await sleep(900);
    ok(tag + ": перехват на лету — без рывка, вправо — предыдущая тема", g.caught && Math.abs(g.caught.at - g.caught.before) <= 2.5 && (await onNow()) === labels[labels.length - 2], JSON.stringify(g.caught) + " on=" + (await onNow()));
    // посреди трека: не дотянул (короткий медленный свайп) — тоже кадрами, тема та же
    await page.locator(".sa-screen .tbp-nums .tbp-num").nth(3).click(); await sleep(1000);
    g = await page.evaluate(TRACK_PROBE, [".tbp-vp", ".tbp-track", ".tbp-cur", -50, 12, 650, 0]);
    s = settleOk(g);
    ok(tag + ": посреди трека не дотянул — возврат кадрами, страница на месте", !s.css && s.mono && Math.abs(s.last) < 0.6 && s.vis && (await onNow()) === labels[3], JSON.stringify({ held: g.held, last: s.last, css: s.css }));
    // и обычный свайп по-прежнему листает
    g = await page.evaluate(TRACK_PROBE, [".tbp-vp", ".tbp-track", ".tbp-cur", -170, 8, 700, 0]);
    ok(tag + ": обычный свайп листает дальше", (await onNow()) === labels[4], "on=" + (await onNow()));
    ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── RV. Радио: голос телефона без «тихой дорожки»; отказ читать — причина на экране; обложка у края ──
if (want("RV")) {
  const S0 = SEASONAL_MODULES[0];
  const { c, q } = doneMap([S0]);
  const st = { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_fresh{uk}": { s0: { t: Date.now() - 20 * 864e5, n: 0 } }, sa_radio_road: "0" };
  const openRadio = async (opt) => {
    const o = await open({ telegram: true, storage: st, ...opt });
    await o.page.evaluate(() => { window.Telegram.WebApp.platform = "ios"; });
    await o.page.evaluate(() => window.__saNav("shift")); await sleep(1000);
    await o.page.locator('.sa-card[aria-label="Радио в дорогу"]').first().click(); await sleep(1500);
    return o;
  };
  {
    const { ctx, page, errors } = await openRadio({});
    await page.evaluate(() => { window.__ss.cancel = 0; window.__ss.cancelIdle = 0; });   // считаем только после «Слушать»
    await page.locator(".tb .rd-ctl .play").click(); await sleep(1600);
    const s = await page.evaluate(() => ({ ss: window.__ss && { speak: window.__ss.speak, cancel: window.__ss.cancel, cancelIdle: window.__ss.cancelIdle }, media: window.__media, sess: navigator.audioSession && navigator.audioSession.type, spoken: (window.__spoken || []).length, pos: (document.querySelector(".tb .rd-card.cur .rd-pos") || {}).textContent, on: !!document.querySelector(".tb .rd-ctl .play.on") }));
    ok("RV: голос телефона читает фразы одна за другой", s.on && s.spoken >= 3 && /фраза [3-9]/.test(s.pos || ""), JSON.stringify(s));
    ok("RV: без «тихой дорожки» и без смены режима звука", s.media === 0 && s.sess === "auto", JSON.stringify({ media: s.media, sess: s.sess }));
    ok("RV: при «Слушать» cancel() вхолостую не зовётся", s.ss && s.ss.cancelIdle === 0, JSON.stringify(s.ss));
    const tip = await page.locator(".tb [data-radio-tip]").count();
    ok("RV: на iPhone, пока читает телефон, — подсказка про беззвучный режим", tip === 1);
    const n0 = await page.evaluate(() => (window.__spoken || []).length);
    await page.locator('.tb .rd-ctl [aria-label="Дальше на фразу"]').click(); await sleep(900);
    const s2 = await page.evaluate(() => ({ n: (window.__spoken || []).length, on: !!document.querySelector(".tb .rd-ctl .play.on") }));
    ok("RV: «Дальше на фразу» во время чтения — читает дальше", s2.on && s2.n > n0 + 1, JSON.stringify({ n0, ...s2 }));
    ok("RV: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
  {
    // телефон через ~1,1 с отказывается читать (так было на iPhone с «тихой дорожкой» v32)
    const { ctx, page, errors } = await openRadio({ speech: "fail" });
    await page.locator(".tb .rd-ctl .play").click(); await sleep(1800);
    const r = await page.evaluate(() => ({ on: !!document.querySelector(".tb .rd-ctl .play.on"), err: (document.querySelector(".tb [data-radio-err]") || {}).textContent || "" }));
    ok("RV: телефон отказался — выпуск остановлен, причина с кодом на экране", !r.on && /не включился/.test(r.err) && /audio-busy/.test(r.err) && /беззвучном/.test(r.err), JSON.stringify(r));
    await shot(page, "rv-err");
    await page.locator(".tb .rd-ctl .play").click(); await sleep(300);
    const r2 = await page.evaluate(() => ({ on: !!document.querySelector(".tb .rd-ctl .play.on"), err: !!document.querySelector(".tb [data-radio-err]") }));
    ok("RV: снова «Слушать» — сообщение убрано, пока играет", r2.on && !r2.err, JSON.stringify(r2));
    ok("RV-fail: без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
  for (const light of [false, true]) {
    const tag = "RV-edge" + (light ? "-L" : "");
    const { ctx, page, errors } = await openRadio({ light });
    // первый выпуск: тянем вправо (раньше выпусков нет) — упирается и возвращается кадрами
    let g = await page.evaluate(TRACK_PROBE, [".tb .rd-stage", ".tb .rd-strack", ".tb .rd-card.cur", 150, 10, 650, 0]);
    let s = settleOk(g);
    ok(tag + ": у первого выпуска обложка упирается и возвращается кадрами", g.held > 25 && g.held < 60 && !s.css && s.mono && Math.abs(s.last) < 0.6 && g.end === "" && s.vis, JSON.stringify({ held: g.held, css: s.css, last: s.last, vis: s.vis }));
    // перехват: потянул вправо, отпустил, через 90 мс повёл влево — второй выпуск
    g = await page.evaluate(TRACK_PROBE, [".tb .rd-stage", ".tb .rd-strack", ".tb .rd-card.cur", 150, 10, 90, -230]);
    await sleep(900);
    const on = await page.evaluate(() => [...document.querySelectorAll(".tb .rd-tab")].findIndex((t) => t.classList.contains("on")));
    ok(tag + ": перехват на лету — без рывка, влево — второй выпуск", g.caught && Math.abs(g.caught.at - g.caught.before) <= 2.5 && on === 1, JSON.stringify(g.caught) + " on=" + on);
    // не дотянул до соседнего — тоже кадрами
    g = await page.evaluate(TRACK_PROBE, [".tb .rd-stage", ".tb .rd-strack", ".tb .rd-card.cur", -45, 12, 650, 0]);
    s = settleOk(g);
    const on2 = await page.evaluate(() => [...document.querySelectorAll(".tb .rd-tab")].findIndex((t) => t.classList.contains("on")));
    ok(tag + ": не дотянул — возврат кадрами, выпуск тот же", !s.css && s.mono && Math.abs(s.last) < 0.6 && s.vis && on2 === 1, JSON.stringify({ held: g.held, css: s.css, last: s.last, on2 }));
    await shot(page, light ? "rv-edge-l" : "rv-edge");
    ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
process.exit(bad ? 1 : 0);
