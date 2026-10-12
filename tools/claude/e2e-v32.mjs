// e2e v32: свеча и стакан на главной (без роли), лента номеров тем (монета едет за пальцем), плавное листание
// тем (без скачка после свайпа), компактное меню темы, «морозный лёд» в обеих темах.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = "/home/claude/preview/site", PORT = 5203, OUT = "/home/claude/preview/shots-v32";
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

async function open({ storage = {}, light = false, w = 390, h = 844, url = "/", rpcs = null, profile = STAFF, calls = [], telegram = false }) {
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
    // голос в headless: озвучка «говорит» мгновенно (как в e2e-v31)
    try {
      window.__spoken = [];
      const ss = window.speechSynthesis;
      if (ss) { ss.speak = (u) => { window.__spoken.push(u.text); setTimeout(() => { try { u.onstart && u.onstart(); u.onend && u.onend(); } catch (e) {} }, 60); }; ss.cancel = () => {}; }
    } catch (e) {}
  }, [seed, telegram]);
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

// ── LOOK. Снимки «как есть» (для сравнения до/после) ──
if (want("LOOK")) {
  for (const light of [false, true]) {
    const sfx = light ? "-l" : "";
    { const { ctx, page } = await open({ profile: OWNER, light, storage: { __role: null }, rpcs: teamRpcs() });
      await shot(page, "look-home-owner" + sfx);
      await page.evaluate(() => window.__saNav("stats")); await sleep(1200);
      await page.evaluate(() => { const el = [...document.querySelectorAll("div")].find(d => /^УПРАВЛЕНИЕ ДАННЫМИ/.test(d.textContent || "") && d.children.length === 0); if (el) el.scrollIntoView({ block: "start" }); });
      await sleep(400); await shot(page, "look-stats-admin" + sfx);
      await ctx.close(); }
    { const { ctx, page } = await open({ light });
      await page.evaluate(() => window.__saNav("home")); await sleep(1300);
      await shot(page, "look-track" + sfx);
      await ctx.close(); }
  }
  ok("LOOK: снимки сделаны", true);
}

// ── HOME. Владелец без роли: свеча и стакан — под заведением, в пределах колонки ──
if (want("HOME")) {
  for (const light of [false, true]) {
    const tag = "HOME" + (light ? "-L" : "");
    const { ctx, page, errors } = await open({ profile: OWNER, light, storage: { __role: null } });
    const m = await page.evaluate(() => {
      const box = document.querySelector("[data-day-chips]"); if (!box) return null;
      const r = box.getBoundingClientRect();
      const lab = box.previousElementSibling; const lr = lab ? lab.getBoundingClientRect() : null;
      return { left: r.left, right: r.right, vw: innerWidth, labRight: lr ? lr.right : null, lab: lab ? lab.textContent : "", txt: box.innerText.replace(/\s+/g, " ") };
    });
    ok(tag + ": значки дня есть", !!m, m ? m.txt : "");
    ok(tag + ": не вылезают влево", m && m.left >= 14, m ? "left " + Math.round(m.left) : "");
    ok(tag + ": под заведением, по его правому краю", m && m.right <= m.vw - 14 && /ДВА МОРЯ|Два моря/i.test(m.lab) && Math.abs(m.right - m.labRight) <= 2, m ? "right " + Math.round(m.right) + " / заведение " + Math.round(m.labRight || 0) : "");
    await shot(page, "home-owner" + (light ? "-l" : ""));
    ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
  // у сотрудника с ролью — значки в строке роли (как было)
  const { ctx, page } = await open({});
  const inRole = await page.evaluate(() => { const b = document.querySelector("[data-day-chips]"); return !b && /Новичок/.test(document.body.innerText); });
  ok("HOME: с ролью — значки в строке роли, не под заведением", inRole);
  await ctx.close();
}

// ── PG. Лента номеров и листание тем: монета едет за пальцем, после свайпа ничего не прыгает ──
if (want("PG")) {
  for (const light of [false, true]) {
    const tag = "PG" + (light ? "-L" : "");
    const { ctx, page, errors } = await open({ light, storage: { sa_track_swiped: "1" } });
    await page.evaluate(() => window.__saNav("home")); await sleep(1300);
    const coin = () => page.evaluate(() => {
      const row = document.querySelector(".sa-screen .tbp-nums"); const ind = row && row.querySelector(".tbp-ind");
      if (!ind) return null;
      const r = ind.getBoundingClientRect(); const cells = [...row.querySelectorAll(".tbp-num")].map((b) => { const q = b.getBoundingClientRect(); return q.left + q.width / 2; });
      return { cx: r.left + r.width / 2, w: r.width, op: getComputedStyle(ind).opacity, cells, on: (row.querySelector(".tbp-num.on .n") || {}).textContent };
    });
    let c = await coin();
    ok(tag + ": монета на текущей теме", c && c.op === "1" && Math.abs(c.cx - c.cells[0]) < 2.5 && c.on === "0", c ? JSON.stringify({ cx: c.cx, c0: c.cells[0], op: c.op }) : "");
    const copyOk = await page.evaluate(() => { const row = document.querySelector(".sa-screen .tbp-nums"); const sp = row.querySelectorAll(".tbp-ind-row span")[0]; const b = row.querySelector(".tbp-num .n");
      const a = sp.getBoundingClientRect(), q = b.getBoundingClientRect(); return Math.abs((a.left + a.width / 2) - (q.left + q.width / 2)) < 1.5 && Math.abs(a.top - q.top) < 1.5; });
    ok(tag + ": тёмная цифра в монете — точно над номером", copyOk);
    // у соседней страницы — та же кнопка «Я это умею», что и у текущей (ничего не появится после свайпа)
    const side = await page.evaluate(() => { const s = document.querySelector('.tbp-side.next'); return { acts: !!(s && s.querySelector(".tbm-act")), inert: s && s.hasAttribute("inert") }; });
    ok(tag + ": у соседней страницы те же кнопки темы (не нажимаются)", side.acts && side.inert, JSON.stringify(side));
    // палец ведёт: на полпути монета — между номерами
    const mid = await page.evaluate(async () => {
      const vp = document.querySelector(".tbp-vp"); const r = vp.getBoundingClientRect();
      const mk = (x, y) => new Touch({ identifier: 3, target: vp, clientX: x, clientY: y });
      const y = r.top + 160; let x = r.right - 40;
      vp.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [mk(x, y)], changedTouches: [mk(x, y)] }));
      for (let i = 0; i < 10; i++) { x -= 16; vp.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [mk(x, y + 1)], changedTouches: [mk(x, y + 1)] })); await new Promise((res) => requestAnimationFrame(res)); }
      const row = document.querySelector(".sa-screen .tbp-nums"), ind = row.querySelector(".tbp-ind"); const q = ind.getBoundingClientRect();
      const cells = [...row.querySelectorAll(".tbp-num")].map((b) => { const z = b.getBoundingClientRect(); return z.left + z.width / 2; });
      window.__swipeX = x; window.__swipeY = y;
      return { cx: q.left + q.width / 2, c0: cells[0], c1: cells[1] };
    });
    ok(tag + ": палец ведёт — монета на полпути к «1»", mid.cx > mid.c0 + 3 && mid.cx < mid.c1 - 3, JSON.stringify(mid));
    // отпускаем — следим за страницей «Мышление сервиса» каждый кадр: только влево, без скачков по вертикали
    const tr = await page.evaluate(async () => {
      const vp = document.querySelector(".tbp-vp");
      const pageOf = () => { const t = [...document.querySelectorAll(".tbm-title")].find((x) => x.textContent === "Мышление сервиса"); return t ? t.closest("[data-k]") : null; };
      const mk = (x, y) => new Touch({ identifier: 3, target: vp, clientX: x, clientY: y });
      vp.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [mk(window.__swipeX, window.__swipeY)] }));
      const out = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 700) {
        await new Promise((res) => requestAnimationFrame(res));
        const el = pageOf(); if (!el) { out.push(null); continue; }
        const r = el.getBoundingClientRect(); const act = el.querySelector(".tbm-act"); const li = el.querySelector(".tbm-list");
        out.push({ x: Math.round(r.left * 10) / 10, act: act ? Math.round(act.getBoundingClientRect().top - r.top) : null, li: li ? Math.round(li.getBoundingClientRect().top - r.top) : null, k: el.getAttribute("data-k") });
      }
      return out;
    });
    const xs = tr.filter(Boolean);
    const mono = xs.every((p, i) => i === 0 || p.x <= xs[i - 1].x + 0.6);
    const sameV = xs.every((p) => p.act === xs[0].act && p.li === xs[0].li);
    ok(tag + ": после отпускания страница едет только влево — без рывка назад", mono && xs.length > 10 && Math.abs(xs[xs.length - 1].x) < 16, JSON.stringify(xs.map((p) => p.x)).slice(0, 200));
    ok(tag + ": внутри страницы ничего не сдвигается (кнопка и список на месте)", sameV && xs[xs.length - 1].k === "0", JSON.stringify(xs.map((p) => p.act + "/" + p.li + "/" + p.k)).slice(-260));
    c = await coin();
    ok(tag + ": после свайпа монета на «1»", c && Math.abs(c.cx - c.cells[1]) < 2.5 && c.on === "1", c ? JSON.stringify({ cx: c.cx, c1: c.cells[1], on: c.on }) : "");
    const tabs = await page.evaluate(() => ({ prev: (document.querySelector(".tbp-tab.prev") || {}).textContent, next: (document.querySelector(".tbp-tab.next") || {}).textContent,
      vis: [...document.querySelectorAll(".tbp-tab")].filter((b) => parseFloat(getComputedStyle(b).opacity) > 0.5).map((b) => b.textContent) }));
    const visOk = await page.evaluate(() => { const vw = innerWidth; return [...document.querySelectorAll(".tbp-tab")].filter((b) => parseFloat(getComputedStyle(b).opacity) > 0.5).every((b) => { const r = b.getBoundingClientRect(); return r.right < 24 || r.left > vw - 24 || r.right < 0 || r.left > vw; }); });
    ok(tag + ": закладки — «0» слева, «2» справа, видимых лишних нет", tabs.prev === "0" && tabs.next === "2" && visOk, JSON.stringify(tabs));
    await shot(page, light ? "pg-after-l" : "pg-after");
    // быстро два свайпа подряд: второй перехватывает первый на лету
    const fast = await page.evaluate(async () => {
      const vp = document.querySelector(".tbp-vp"); const r = vp.getBoundingClientRect();
      const mk = (x, y) => new Touch({ identifier: 4, target: vp, clientX: x, clientY: y });
      const flick = async () => {
        const y = r.top + 160; let x = r.right - 40;
        vp.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [mk(x, y)], changedTouches: [mk(x, y)] }));
        for (let i = 0; i < 4; i++) { x -= 30; vp.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [mk(x, y)], changedTouches: [mk(x, y)] })); await new Promise((res) => setTimeout(res, 16)); }
        vp.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [mk(x, y)] }));
      };
      await flick(); await new Promise((res) => setTimeout(res, 120)); await flick();
      await new Promise((res) => setTimeout(res, 800));
      return { on: (document.querySelector(".sa-screen .tbp-num.on .n") || {}).textContent, title: (document.querySelector(".tbp-cur .tbm-title") || {}).textContent, tx: document.querySelector(".tbp-track").style.transform };
    });
    ok(tag + ": два быстрых свайпа — две темы вперёд, лента стоит ровно", fast.on === "3" && fast.tx === "", JSON.stringify(fast));
    // тап по дальнему номеру — монета доезжает до него
    await page.locator(".sa-screen .tbp-num", { hasText: /^7$/ }).click(); await sleep(700);
    c = await coin();
    ok(tag + ": тап по «7» — монета на «7»", c && c.on === "7" && Math.abs(c.cx - c.cells[7]) < 2.5, c ? JSON.stringify({ cx: c.cx, c7: c.cells[7], on: c.on }) : "");
    ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── QC. Квест смены — компактный: свёрнут по умолчанию, «Подробнее» раскрывает всё ──
if (want("QC")) {
  const today = ymdL(new Date());
  const MKEY = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  const SCHED = { cfg: { staff: [{ id: "s1", name: "Анна Смирнова" }], shifts: [{ k: "В", name: "Вечер", from: 16, to: 24 }] }, plan: { s1: { [now.getDate()]: "В" } }, ts: Date.now() - 3600e3 };
  for (const light of [false, true]) {
    const tag = "QC" + (light ? "-L" : "");
    const calls = [];
    const people = [
      { id: "u-staff", name: "Анна", initial: "С", position: "waiter", me: true, steps: 3, warm: 1, guest: 1, synced: true, tg: true },
      { id: "x2", name: "Илья", initial: "Б", position: "bartender", me: false, steps: 2, warm: 1, guest: 0, synced: true, tg: true },
      { id: "x3", name: "Мария", initial: "К", position: "waiter", me: false, steps: 0, warm: 0, guest: 0, synced: false, tg: true },
      { id: "x4", name: "Пётр", initial: "Л", position: "waiter", me: false, steps: 0, warm: 0, guest: 0, synced: false, tg: false },
    ];
    const quest = { ok: true, date: today, restaurant: "Два моря, Океан", known: true, me_on: true, people, lead: true, tg: true,
      goal: { warm: 3, steps: 6, guest: 1 }, done: { warm: 2, steps: 5, guest: 1 }, complete: false, thanks: [{ name: "Илья", initial: "Б" }] };
    const rpcs = (fn) => fn === "day_brief" ? { ok: true, quest, pair: { ok: true, pair: null, invites: [], outgoing: null }, league: { pts: 85, rank_rest: 2, rank_net: 4, n_rest: 5, n_net: 12 } } : fn === "quest_today" ? quest : undefined;
    const { ctx, page, errors } = await open({ light, rpcs, calls, profile: { ...STAFF, position: "senior" }, storage: { ["sa_sched_cache_main_" + MKEY]: SCHED, "sa_mistakes{uk}": [{ q: "Вопрос", options: ["a", "b"], correct: 0, due: Date.now() - 1000, stage: 0, lessonTitle: "Тест" }] } });
    await page.evaluate(() => window.__saNav("shift")); await sleep(1600);
    const card = page.locator("[data-quest]").first();
    const m = await card.evaluate((el) => {
      const r = el.getBoundingClientRect(); const bars = [...el.querySelectorAll(".tg-bar")].map((b) => Math.round(b.getBoundingClientRect().top));
      return { h: Math.round(r.height), bars, tasks: el.querySelectorAll(".tg-task").length, txt: el.innerText.replace(/\s+/g, " ") };
    });
    ok(tag + ": свёрнут — шкалы в одну строку", m.bars.length === 3 && new Set(m.bars).size === 1, JSON.stringify(m.bars));
    ok(tag + ": свёрнут — виден один следующий шаг", m.tasks === 1 && /ТВОЯ ЧАСТЬ · 0 ИЗ \d/.test(m.txt), m.tasks + " · " + m.txt.slice(-120));
    ok(tag + ": свёрнут — люди одной строкой, старшему — «Позвать на разминку»", /4 человека в смене · ты 3 шага/.test(m.txt) && /Ещё не начали: 2/.test(m.txt) && /Позвать на разминку/.test(m.txt), m.txt.slice(0, 260));
    ok(tag + ": свёрнутая карточка невысокая", m.h < 330, m.h + " px");
    await card.scrollIntoViewIfNeeded(); await sleep(200);
    await card.screenshot({ path: OUT + "/qc-min" + (light ? "-l" : "") + ".png" });
    await page.locator("[data-quest-more]").click(); await sleep(400);
    const x = await card.evaluate((el) => ({ h: Math.round(el.getBoundingClientRect().height), tasks: el.querySelectorAll(".tg-task").length, txt: el.innerText.replace(/\s+/g, " ") }));
    ok(tag + ": «Подробнее» — все задания, цель, «Спасибо команде»", x.tasks >= 2 && /Цель: 3 разминки · 6 шагов · 1 живой гость/.test(x.txt) && /Спасибо команде ✦/.test(x.txt) && /Спасибо от Илья Б\. ✦/.test(x.txt), x.txt.slice(0, 300));
    ok(tag + ": кто не начал — по именам, «без Telegram» — одной строкой", /Ещё не начали: Мария К\., Пётр Л\./.test(x.txt) && /Без Telegram: Пётр Л\./.test(x.txt) && !/\(без Telegram\)/.test(x.txt), (x.txt.match(/Ещё не начали.{0,80}/) || [""])[0]);
    await card.screenshot({ path: OUT + "/qc-open" + (light ? "-l" : "") + ".png" });
    ok(tag + ": раскрытие запомнилось", (await page.evaluate(() => localStorage.getItem("sa_quest_open"))) === "1");
    ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── RLOOK. Радио — снимки ──
if (want("RLOOK")) {
  const S0 = SEASONAL_MODULES[0];
  const { c, q } = doneMap([S0]);
  for (const light of [false, true]) {
    const { ctx, page } = await open({ light, storage: { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_fresh{uk}": { s0: { t: Date.now() - 20 * 864e5, n: 0 } } } });
    await page.evaluate(() => window.__saNav("shift")); await sleep(1000);
    await page.locator('.sa-card[aria-label="Радио в дорогу"]').first().click(); await sleep(1500);
    await shot(page, "radio-look" + (light ? "-l" : ""));
    await ctx.close();
  }
  ok("RLOOK: снимки радио", true);
}

// ── RS. Радио: выпуски листаются пальцем, вкладки, играет дальше, подсказка на iPhone ──
if (want("RS")) {
  const S0 = SEASONAL_MODULES[0];
  const { c, q } = doneMap([S0]);
  for (const light of [false, true]) {
    const tag = "RS" + (light ? "-L" : "");
    const { ctx, page, errors } = await open({ light, telegram: true, storage: { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_fresh{uk}": { s0: { t: Date.now() - 20 * 864e5, n: 0 } }, sa_radio_road: "0" } });
    await page.evaluate(() => { window.Telegram.WebApp.platform = "ios"; });
    await page.evaluate(() => window.__saNav("shift")); await sleep(1000);
    await page.locator('.sa-card[aria-label="Радио в дорогу"]').first().click(); await sleep(1500);
    const st = () => page.evaluate(() => {
      const tabs = [...document.querySelectorAll(".tb .rd-tab")]; const on = tabs.findIndex((t) => t.classList.contains("on"));
      const pill = document.querySelector(".tb .rd-pill"); const pr = pill.getBoundingClientRect(); const tr = tabs[on] ? tabs[on].getBoundingClientRect() : null;
      return { on, n: tabs.length, pillOk: !!tr && Math.abs(pr.left - tr.left) < 2 && Math.abs(pr.width - tr.width) < 2, cur: (document.querySelector(".tb .rd-card.cur .rd-ttl") || {}).textContent, side: document.querySelectorAll(".tb .rd-card.side").length };
    });
    let a = await st();
    ok(tag + ": три выпуска во вкладках, подсветка на первом, сосед виден краем", a.n === 3 && a.on === 0 && a.pillOk && a.side === 1, JSON.stringify(a));
    const swipe = (dx) => page.evaluate(async (dx) => {
      const el = document.querySelector(".tb .rd-stage"); const r = el.getBoundingClientRect();
      const mk = (x, y) => new Touch({ identifier: 9, target: el, clientX: x, clientY: y });
      const y = r.top + 120; let x = dx < 0 ? r.right - 40 : r.left + 40;
      el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [mk(x, y)], changedTouches: [mk(x, y)] }));
      for (let i = 0; i < 8; i++) { x += dx / 8; el.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [mk(x, y + 1)], changedTouches: [mk(x, y + 1)] })); await new Promise((res) => requestAnimationFrame(res)); }
      el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [mk(x, y + 1)] }));
    }, dx);
    await swipe(-170); await sleep(700);
    a = await st();
    ok(tag + ": свайп влево — второй выпуск, подсветка переехала", a.on === 1 && a.pillOk && a.side === 2, JSON.stringify(a));
    await shot(page, light ? "rs-swiped-l" : "rs-swiped");
    await swipe(170); await sleep(700);
    a = await st();
    ok(tag + ": свайп вправо — снова первый", a.on === 0 && a.pillOk, JSON.stringify(a));
    // играет — и свайп продолжает уже следующий выпуск
    await page.locator(".tb .rd-ctl .play").click(); await sleep(900);
    const tip = await page.locator(".tb [data-radio-tip]").count();
    ok(tag + ": на iPhone, пока читает телефон, — подсказка про беззвучный режим", tip === 1);
    const armOn = await page.evaluate(() => !!document.querySelector(".tb .rd-card.cur .rd-arm.on") && !!document.querySelector(".tb .rd-card.cur .rd-disc.on"));
    ok(tag + ": играет — пластинка крутится, тонарм на пластинке", armOn);
    const before = await page.evaluate(() => (window.__spoken || []).length);
    await swipe(-170); await sleep(1500);
    const sp = await page.evaluate(() => (window.__spoken || []).slice(-6));
    a = await st();
    ok(tag + ": свайп во время выпуска — играет следующий выпуск", a.on === 1 && sp.some((t) => /Освежаем тему|Повторяем пройденное/.test(t)) && (await page.locator(".tb .rd-ctl .play.on").count()) === 1, JSON.stringify(sp).slice(0, 200));
    ok(tag + ": фразы идут одна за другой", (await page.evaluate(() => (window.__spoken || []).length)) > before + 2);
    // деления фраз: тап — к фразе
    await page.locator(".tb .rd-ctl .play").click(); await sleep(300);
    await page.locator(".tb .rd-card.cur .rd-segs button").nth(3).click(); await sleep(300);
    ok(tag + ": тап по делению — «фраза 4 из …»", /фраза 4 из \d+/.test(await page.evaluate(() => document.querySelector(".tb .rd-card.cur .rd-pos").textContent)));
    // вкладка по тапу
    await page.locator(".tb .rd-tab").nth(2).click(); await sleep(500);
    a = await st();
    ok(tag + ": тап по вкладке — третий выпуск", a.on === 2 && a.pillOk, JSON.stringify(a));
    ok(tag + ": без ошибок", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

// ── FROST. Снимки всех новых экранов (v28–v32) в обеих темах — сверка с «морозным льдом» ──
if (want("FROST")) {
  const S0 = SEASONAL_MODULES[0];
  const { c, q } = doneMap([S0]);
  const ymd = ymdL(new Date()), yest = new Date(Date.now() - 864e5);
  const MKEY = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  const SCHED = { cfg: { staff: [{ id: "s1", name: "Анна Смирнова" }], shifts: [{ k: "В", name: "Вечер", from: 16, to: 24 }] }, plan: { s1: { [now.getDate()]: "В" } }, ts: Date.now() - 3600e3 };
  const quest = { ok: true, date: ymd, restaurant: "Два моря, Океан", known: true, me_on: true, lead: true, tg: true, goal: { warm: 3, steps: 6, guest: 1 }, done: { warm: 1, steps: 3, guest: 0 }, complete: false,
    people: [{ id: "u-staff", name: "Анна", initial: "С", me: true, steps: 3, warm: 1, guest: 0, synced: true, tg: true }, { id: "x2", name: "Илья", initial: "Б", steps: 1, warm: 0, guest: 0, synced: true, tg: true }, { id: "x3", name: "Мария", initial: "К", steps: 0, synced: false, tg: false }], thanks: [] };
  const pair = { ok: true, pair: { id: "p1", with: { name: "Аня", initial: "К" }, streak: 5, week: [2, 2, 1, 0, 2, 2, 1], me_today: true, mate_today: false }, invites: [], outgoing: null };
  const rpcs = (fn) => fn === "day_brief" ? { ok: true, quest, pair, league: { pts: 85, rank_rest: 2, rank_net: 4, n_rest: 5, n_net: 12 } } : fn === "quest_today" ? quest : fn === "pair_status" ? pair : undefined;
  const act = {}; for (let n = 0; n < 9; n++) { const d = new Date(); d.setDate(d.getDate() - n); act[ymdL(d)] = { st: 2 + (n % 3), l: 1, w: n % 2, g: n === 2 ? 1 : 0 }; }
  for (const light of [false, true]) {
    const sfx = light ? "-l" : "";
    const { ctx, page } = await open({ light, telegram: true, rpcs, profile: { ...STAFF, position: "senior" }, storage: { "sa_completed{uk}": c, "sa_quiz_done{uk}": q, "sa_activity{uk}": act,
      ["sa_sched_cache_main_" + MKEY]: SCHED, "sa_streak{uk}": { count: 4, best: 6, last: ymdL(yest), days: [ymdL(yest)] }, "sa_fresh{uk}": { s0: { t: Date.now() - 20 * 864e5, n: 0 } } } });
    const grab = async (name) => { await sleep(500); await shot(page, "frost-" + name + sfx); };
    await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1200); await grab("01-home");
    await page.evaluate(() => window.__saNav("shift")); await sleep(1500); await grab("02-shift");
    await page.evaluate(() => { const el = document.querySelector("#root"); if (el) el.scrollTop = 520; }); await grab("03-shift-down");
    await page.evaluate(() => { const el = document.querySelector("#root"); if (el) el.scrollTop = 0; });
    await page.evaluate(() => window.__saNav("me")); await sleep(1200); await grab("04-me");
    await page.evaluate(() => window.__saNav("teamHub")); await sleep(1200); await grab("05-team");
    await page.evaluate(() => window.__saNav("league")); await sleep(1500); await grab("06-league");
    await page.evaluate(() => window.__saNav("cellar")); await sleep(1500); await grab("07-cellar");
    await page.evaluate(() => window.__saNav("me")); await sleep(900);
    if (await page.locator('.sa-card[aria-label="Итоги месяца"]').count()) { await page.locator('.sa-card[aria-label="Итоги месяца"]').first().click(); await sleep(1000); await grab("08-recap"); await page.evaluate(() => window.__bb && window.__bb.press()); await sleep(600); }
    await page.evaluate(() => window.__saNav("shift")); await sleep(1200);
    if (await page.locator('.sa-card[aria-label="Свеча на двоих"]').count()) { await page.locator('.sa-card[aria-label="Свеча на двоих"]').first().click(); await sleep(1200); await grab("09-pair"); await page.evaluate(() => window.__bb && window.__bb.press()); await sleep(600); }
    if (await page.locator('.sa-card[aria-label="Живой гость"]').count()) { await page.locator('.sa-card[aria-label="Живой гость"]').first().click(); await sleep(1500); await grab("10-guest"); await page.evaluate(() => window.__bb && window.__bb.press()); await sleep(600); }
    if (await page.locator('.sa-card[aria-label="Напоминания в Telegram"]').count()) { await page.locator('.sa-card[aria-label="Напоминания в Telegram"]').first().click(); await sleep(1200); await grab("11-remind"); await page.evaluate(() => window.__bb && window.__bb.press()); await sleep(600); }
    await page.evaluate(() => window.__saNav("roleSelect")); await sleep(1000);
    if (await page.locator('[aria-label^="Цель дня:"]').count()) { await page.locator('[aria-label^="Цель дня:"]').first().click(); await sleep(600); await grab("12-goal"); await page.mouse.click(30, 60); await sleep(400); }
    await ctx.close();
  }
  ok("FROST: снимки сделаны", true);
}

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length}`);
process.exit(bad ? 1 : 0);
