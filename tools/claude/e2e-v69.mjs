// e2e v69 (Доп. 382): полноэкранный Telegram на телефоне, линза светлее, карточка без мерцания.
// Владелец (22.10, записи экрана): «выделенные элементы (шапку Telegram) в цвет приложения», «закрепить приложение,
// чтобы его нельзя было смахнуть вниз, добавив кнопку «свернуть»» (пример — другое мини-приложение в полноэкранном
// режиме), «не кажется, что она (линза) слишком тёмная? И обрати внимание на мерцание».
// Telegram здесь — заглушка window.Telegram.WebApp с полноэкранным режимом Bot API 8.0: requestFullscreen включает
// режим и сообщает отступы (iPhone 16 Pro Max: строка состояния 62, кнопки Telegram 46 → 108 px).
// Разделы:
//   FS      — телефон: просьба о полноэкранном режиме, смахивание выключено, шапка — цвет приложения;
//             страница начинается под кнопками Telegram (108 px), фон сцены — до самого верха; короткий экран не листается;
//   LAYERS  — слои поверх экрана под кнопками Telegram: разминка, график, Наставник, SOS, прилипшие номера тем;
//   LIGHT   — светлая тема в полноэкранном режиме: шапка светлая, отступ тот же;
//   LAND    — телефон лёжа: меню слева — по центру места под кнопками Telegram;
//   DESK    — компьютер (tdesktop): полноэкранный режим не просим, всё как было;
//   OLD     — старый Telegram (7.10): не просим, без ошибок;  FAIL — Telegram отказал (UNSUPPORTED): всё как было;
//   EXIT    — вышли из полноэкранного режима: отступ убран;
//   LENS    — линза тех же светлоты и стекла, что кнопка AI на экране;
//   FADE    — возврат на главную: карточка появляется вместе с блоками под ней (не позже); при смене состояния — мягко.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v69.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5269, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v69";
mkdirSync(OUT, { recursive: true });
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p); try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); } res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const OWNER = { id: "u-own", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "owner", is_admin: true };
const uk = "_" + OWNER.name + "_";
const NOW = new Date("2026-10-21T22:34:00Z");        // 22.10 10:34 по Камчатке — до смены 26 мин
const TODAY = "2026-10-22", YDAY = "2026-10-21";
const DONE = { "spg-0-1": true, "spg-0-2": true, "spg-0-3": true, "spg-0-4": true, "spg-0-d": true };
const PORTRAIT = { safe: { top: 62, bottom: 34, left: 0, right: 0 }, content: { top: 46, bottom: 0, left: 0, right: 0 } };
const LANDSCAPE = { safe: { top: 0, bottom: 21, left: 62, right: 62 }, content: { top: 40, bottom: 0, left: 0, right: 0 } };
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sched = JSON.stringify({ cfg: { staff: [{ id: "s1", name: "Роман" }], shifts: [{ k: "Д", name: "День", from: 11, to: 24 }] }, plan: { s1: { 22: "Д", 23: "Д" } }, ts: NOW.getTime() });

// Заглушка Telegram: tg — { platform, version, fs: { safe, content }, fail } или null (обычный браузер)
async function open({ light = false, w = 440, h = 956, dsf = 2, at = null, tg = { platform: "ios", version: "9.6", fs: PORTRAIT }, extra = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: w < 900, hasTouch: w < 900, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      const mock = { whoami: { ok: true, employee: OWNER }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: Object.keys(DONE), stars: {}, roles: [], last_role: "spg" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] },
        schedule_load: { ok: false, error: "auth" }, menu_get: [] };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    if (/\/functions\/v1\/ai-chat/.test(u)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reply: "Разберём по шагам.", remaining: 18 }) });
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_quest_open: "1",
    sa_session_token: "tok-preview", sa_profile: JSON.stringify(OWNER), sa_ai_fab: "1",
    ["sa_last_role" + uk]: JSON.stringify("spg"), ["sa_completed" + uk]: JSON.stringify(DONE), ["sa_goal" + uk]: "1",
    ["sa_activity" + uk]: JSON.stringify({ [TODAY]: { st: 1, l: 1 }, [YDAY]: { st: 2, l: 2 } }),
    sa_today_shift: JSON.stringify({ date: TODAY, label: "День · 11:00–24:00" }), "sa_sched_cache_main_2026-10": sched, ...extra };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript(([seed, tg]) => {
    if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    if (!tg) return;
    const ev = {}, Z = { top: 0, bottom: 0, left: 0, right: 0 };
    const W = {
      platform: tg.platform, version: tg.version, initData: "query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc", initDataUnsafe: {}, colorScheme: "dark", themeParams: {},
      isFullscreen: false, isActive: true, isVerticalSwipesEnabled: true, safeAreaInset: { ...Z }, contentSafeAreaInset: { ...Z },
      __calls: { fullscreen: 0, swipesOff: 0, header: [], bg: [] },
      isVersionAtLeast(v) { const a = String(this.version).split(".").map(Number), b = String(v).split(".").map(Number); for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x > y; } return true; },
      onEvent(n, f) { (ev[n] = ev[n] || []).push(f); }, offEvent(n, f) { ev[n] = (ev[n] || []).filter((g) => g !== f); },
      __fire(n, p) { (ev[n] || []).forEach((f) => { try { f.call(W, p); } catch (e) {} }); },
      ready() {}, expand() {}, close() {},
      setHeaderColor(c) { W.__calls.header.push(c); }, setBackgroundColor(c) { W.__calls.bg.push(c); }, setBottomBarColor() {},
      disableVerticalSwipes() { W.__calls.swipesOff++; W.isVerticalSwipesEnabled = false; }, enableVerticalSwipes() { W.isVerticalSwipesEnabled = true; },
      requestFullscreen() {
        if (!W.isVersionAtLeast("8.0")) throw new Error("WebAppMethodUnsupported");
        W.__calls.fullscreen++;
        if (tg.fail) { setTimeout(() => W.__fire("fullscreenFailed", { error: tg.fail }), 40); return; }
        if (W.isFullscreen) { setTimeout(() => W.__fire("fullscreenFailed", { error: "ALREADY_FULLSCREEN" }), 40); return; }
        setTimeout(() => { W.isFullscreen = true; W.safeAreaInset = { ...tg.fs.safe }; W.contentSafeAreaInset = { ...tg.fs.content };
          W.__fire("fullscreenChanged"); W.__fire("safeAreaChanged"); W.__fire("contentSafeAreaChanged"); }, 60);
      },
      exitFullscreen() { setTimeout(() => { W.isFullscreen = false; W.safeAreaInset = { ...Z }; W.contentSafeAreaInset = { ...Z };
        W.__fire("fullscreenChanged"); W.__fire("safeAreaChanged"); W.__fire("contentSafeAreaChanged"); }, 40); },
      HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
      BackButton: { isVisible: false, show() { this.isVisible = true; }, hide() { this.isVisible = false; }, onClick() {}, offClick() {} },
      showAlert(m, cb) { if (cb) cb(); }, openLink() {}, openTelegramLink() {}, requestWriteAccess(cb) { if (cb) cb(false); }, downloadFile() {},
    };
    window.Telegram = { WebApp: W };
  }, [seed, tg]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(at || NOW);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await page.waitForTimeout(1800);
  return { ctx, page, errors };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const state = (p) => p.evaluate(() => {
  const W = window.Telegram && window.Telegram.WebApp, H = document.documentElement;
  const top = (s) => { const e = typeof s === "string" ? document.querySelector(s) : s; return e ? Math.round(e.getBoundingClientRect().top) : null; };
  const bar = [...document.querySelectorAll("span")].find((e) => e.textContent === "✦ SA");
  return { calls: W ? W.__calls : null, fs: W ? W.isFullscreen : null, cls: H.classList.contains("sa-tgfs"), st: H.style.getPropertyValue("--sa-st"),
    bodyPad: getComputedStyle(document.body).paddingTop, root: top("#root"), bar: bar ? Math.round(bar.getBoundingClientRect().top) : null, scene: top("#sa-scene"),
    card: top("[data-now-card]"), tab: (() => { const t = document.getElementById("sa-tabbar"); return t ? Math.round(t.getBoundingClientRect().bottom) : null; })(), vh: innerHeight,
    over: (() => { const r = document.getElementById("root"); return r.scrollWidth - r.clientWidth; })() };
});
const scrollOf = (p) => p.evaluate(() => { const r = document.getElementById("root"); return r.scrollHeight - r.clientHeight; });
const TOP = 108;

if (want("FS")) {
  const o = await open({});
  const s = await state(o.page);
  ok("FS: телефон — просьба о полноэкранном режиме (Bot API 8.0), смахивание вниз выключено", s.calls && s.calls.fullscreen >= 1 && s.calls.swipesOff >= 1 && s.fs === true, JSON.stringify(s.calls));
  ok("FS: шапка Telegram — цвет приложения (#14110A): по нему Telegram красит строку состояния и свои кнопки", s.calls && s.calls.header.length && s.calls.header.every((c) => c === "#14110A"), JSON.stringify(s.calls && s.calls.header));
  ok("FS: отступ сверху — строка состояния 62 + кнопки Telegram 46 = 108 px (sa-tgfs, --sa-st)", s.cls && s.st === "108px" && s.bodyPad === "108px", JSON.stringify(s));
  ok("FS: страница начинается под кнопками Telegram: «✦ SA» и прокрутка — ниже 108 px", s.root === TOP && s.bar >= TOP, JSON.stringify({ root: s.root, bar: s.bar }));
  ok("FS: фон приложения — до самого верха (сцена от 0 px), без прокрутки вбок", s.scene === 0 && s.over <= 0, JSON.stringify({ scene: s.scene, over: s.over }));
  ok("FS: нижнее меню — на месте, в экране", s.tab && s.tab <= s.vh, JSON.stringify({ tab: s.tab, vh: s.vh }));
  await shot(o.page, "fs-home");
  // короткий экран (Рейтинг) не листается на высоту отступа
  await o.page.evaluate(() => window.__saNav("leaderboard")); await sleep(1300);
  const sc = await scrollOf(o.page);
  ok("FS: короткий экран («Рейтинг») не листается на высоту кнопок Telegram", sc <= 2, String(sc));
  ok("FS: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
  const q = await open({ tg: null });
  await q.page.evaluate(() => window.__saNav("leaderboard")); await sleep(1300);
  const sc0 = await scrollOf(q.page);
  const s0 = await state(q.page);
  ok("FS: в браузере (без Telegram) — как было: отступа и класса нет, «Рейтинг» листается так же", !s0.cls && !s0.st && s0.root === 0 && Math.abs(sc0 - sc) <= 2, JSON.stringify({ cls: s0.cls, st: s0.st, root: s0.root, sc0, sc }));
  await q.ctx.close();
}

if (want("LAYERS")) {
  // разминка (слой «у стола»): тап по карточке «до смены»
  let o = await open({});
  await o.page.locator("[data-now-card]").click(); await sleep(1500);
  let r = await o.page.evaluate(() => { const h = document.querySelector(".tb-head"); const x = h && h.querySelector("button"); return { head: !!h, btn: x ? Math.round(x.getBoundingClientRect().top) : null, text: /Разминка до смены/.test(document.body.innerText) }; });
  ok("LAYERS: разминка — шапка слоя под кнопками Telegram", r.text && r.btn >= TOP, JSON.stringify(r));
  await shot(o.page, "fs-warmup");
  await o.ctx.close();
  // график
  o = await open({});
  await o.page.evaluate(() => window.__saNav("schedule")); await sleep(1600);
  r = await o.page.evaluate(() => { const w = document.querySelector(".sa-schedwrap"); const b = w && w.querySelector('button[aria-label="Назад"]'); return { wrap: w ? Math.round(w.getBoundingClientRect().top) : null, back: b ? Math.round(b.getBoundingClientRect().top) : null }; });
  ok("LAYERS: график — слой начинается под кнопками Telegram, «‹» — ниже", r.wrap === TOP && r.back >= TOP, JSON.stringify(r));
  await shot(o.page, "fs-schedule");
  ok("LAYERS: без ошибок (разминка, график)", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
  // Наставник
  o = await open({});
  await o.page.evaluate(() => window.__saNav("assistant")); await sleep(1600);
  r = await o.page.evaluate(() => { const l = document.querySelector(".sa-dlg.sa-layer"); const b = l && l.querySelector("button"); return { layer: !!l, btn: b ? Math.round(b.getBoundingClientRect().top) : null, txt: l ? /Наставник/.test(l.innerText) : false }; });
  ok("LAYERS: Наставник — шапка под кнопками Telegram", r.layer && r.txt && r.btn >= TOP, JSON.stringify(r));
  await shot(o.page, "fs-assistant");
  await o.ctx.close();
  // SOS (экран в потоке страницы)
  o = await open({ at: new Date("2026-10-22T01:10:00Z") });
  await o.page.locator("[data-now-card]").click(); await sleep(1500);
  r = await o.page.evaluate(() => { const e = [...document.querySelectorAll("*")].find((x) => x.children.length === 0 && /^SOS в смене$/.test((x.textContent || "").trim())); return { sos: e ? Math.round(e.getBoundingClientRect().top) : null }; });
  ok("LAYERS: SOS — заголовок под кнопками Telegram", r.sos >= TOP, JSON.stringify(r));
  await shot(o.page, "fs-sos");
  await o.ctx.close();
  // трек: номера тем прилипают сверху — под кнопками Telegram (экран пониже, чтобы меню темы листалось)
  for (const tg of [undefined, null]) {
    o = await open({ h: 560, ...(tg === null ? { tg: null } : {}) });
    await o.page.evaluate(() => window.__saNav("home")); await sleep(1600);
    await o.page.evaluate(() => { const r = document.getElementById("root"); r.scrollTop = r.scrollHeight; }); await sleep(900);
    r = await o.page.evaluate(() => { const p = document.querySelector(".tbp-pin"); const c = p && p.firstElementChild; const s = document.querySelector(".tbp-strip"); return { pin: !!p, top: c ? Math.round(c.getBoundingClientRect().top) : null, strip: s ? Math.round(s.getBoundingClientRect().bottom) : null }; });
    if (tg === null) ok("LAYERS: трек в браузере — номера тем прилипают сверху, как было", r.pin && r.top >= 0 && r.top < 20, JSON.stringify(r));
    else { ok("LAYERS: трек — номера тем прилипли сверху, под кнопками Telegram", r.pin && r.top >= TOP, JSON.stringify(r)); await shot(o.page, "fs-track-pin"); }
    ok("LAYERS: без ошибок (" + (tg === null ? "трек в браузере" : "Наставник, SOS, трек") + ")", !o.errors.length, o.errors.join(" | "));
    await o.ctx.close();
  }
}

if (want("LIGHT")) {
  const o = await open({ light: true });
  const s = await state(o.page);
  ok("LIGHT: светлая тема — шапка Telegram светлая (#E8DEC8), отступ 108 px, страница под кнопками", s.calls.header.length && s.calls.header[s.calls.header.length - 1] === "#E8DEC8" && s.root === TOP && s.bar >= TOP, JSON.stringify({ h: s.calls.header, root: s.root, bar: s.bar }));
  await shot(o.page, "fs-light");
  ok("LIGHT: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("LAND")) {
  const o = await open({ w: 956, h: 440, tg: { platform: "ios", version: "9.6", fs: LANDSCAPE } });
  const s = await state(o.page);
  const rail = await o.page.evaluate(() => { const n = document.querySelector("[data-nav-rail]"); const b = n && n.getBoundingClientRect(); return b ? { top: Math.round(b.top), bottom: Math.round(b.bottom) } : null; });
  ok("LAND: лёжа — отступ 40 px (кнопки Telegram), меню слева — целиком под ними и в экране", s.st === "40px" && rail && rail.top >= 40 && rail.bottom <= s.vh, JSON.stringify({ st: s.st, rail, vh: s.vh }));
  await shot(o.page, "fs-landscape");
  ok("LAND: без ошибок, без прокрутки вбок", !o.errors.length && s.over <= 0, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("DESK")) {
  const o = await open({ w: 1440, h: 900, dsf: 1, tg: { platform: "tdesktop", version: "9.6", fs: PORTRAIT } });
  const s = await state(o.page);
  ok("DESK: Telegram на компьютере — полноэкранный режим не просим, отступа нет", s.calls.fullscreen === 0 && !s.cls && !s.st && s.root === 0, JSON.stringify(s));
  ok("DESK: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("OLD")) {
  const o = await open({ tg: { platform: "ios", version: "7.10", fs: PORTRAIT } });
  const s = await state(o.page);
  ok("OLD: старый Telegram (7.10) — не просим, всё как было, без ошибок", s.calls.fullscreen === 0 && !s.cls && s.root === 0 && !o.errors.length, JSON.stringify({ s, e: o.errors }));
  await o.ctx.close();
}

if (want("FAIL")) {
  const o = await open({ tg: { platform: "android", version: "8.0", fs: PORTRAIT, fail: "UNSUPPORTED" } });
  const s = await state(o.page);
  ok("FAIL: Telegram отказал (UNSUPPORTED) — всё как было: отступа нет, без ошибок", s.calls.fullscreen >= 1 && !s.cls && !s.st && s.root === 0 && !o.errors.length, JSON.stringify({ s, e: o.errors }));
  await o.ctx.close();
}

if (want("EXIT")) {
  const o = await open({});
  await o.page.evaluate(() => window.Telegram.WebApp.exitFullscreen()); await sleep(500);
  const s = await state(o.page);
  ok("EXIT: вышли из полноэкранного режима — отступ и класс убраны, страница от верха", !s.cls && !s.st && s.root === 0 && s.bodyPad === "0px", JSON.stringify(s));
  ok("EXIT: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("LENS")) {
  const o = await open({ tg: null, dsf: 3 });
  const box = await o.page.evaluate(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; }; return { lens: r("[data-now-lens]"), ai: r("[data-ai-disc]") }; });
  // пиксели снимка — через холст в той же странице (без лишних модулей): точка в стекле между значком и кромкой
  const png = (await o.page.screenshot()).toString("base64");
  const [lens, ai] = await o.page.evaluate(([b64, box]) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      const k = img.width / innerWidth, px = (x, y) => Array.from(g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data.slice(0, 3));
      res([px(box.lens.x - box.lens.w * 0.3, box.lens.y), px(box.ai.x - box.ai.w * 0.3, box.ai.y)]); };
    img.src = "data:image/png;base64," + b64;
  }), [png, box]);
  const close = lens && ai && lens.every((v, i) => Math.abs(v - ai[i]) <= 8);
  ok("LENS: линза той же светлоты, что кнопка AI на экране (стекло в пикселях — разница не больше 8)", close, JSON.stringify({ lens, ai }));
  ok("LENS: без ошибок", !o.errors.length, o.errors.join(" | "));
  await o.ctx.close();
}

if (want("FADE")) {
  // анимации включены (reducedMotion: no-preference) — меряем по кадрам действующую прозрачность карточки и блока под ней
  const q = await open({ tg: null, at: new Date("2026-10-22T01:10:00Z") });
  await q.page.emulateMedia({ reducedMotion: "no-preference" });
  await q.page.locator("[data-now-card]").click(); await sleep(1200);
  const seq = await q.page.evaluate(() => new Promise((res) => {
    const eff = (el) => { let o = 1; for (let e = el; e && e !== document.documentElement; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity) || 0; return o; };
    const out = []; const t0 = performance.now();
    window.__saNav("roleSelect");
    const tick = () => { const c = document.querySelector("[data-now-card]"), tl = document.querySelector("[data-home-tiles]");
      out.push([Math.round(performance.now() - t0), c ? eff(c) : null, tl ? eff(tl) : null, c ? c.className : ""]);
      if (performance.now() - t0 < 900) requestAnimationFrame(tick); else res(out); };
    requestAnimationFrame(tick);
  }));
  const both = seq.filter((r) => r[1] != null && r[2] != null);
  const lag = Math.max(...both.map((r) => r[2] - r[1]));
  ok("FADE: возврат на главную — карточка появляется вместе с блоком под ней, не позже (без второго проявления)", both.length > 10 && lag <= 0.05 && !both.some((r) => /sa-fadein/.test(r[3])), JSON.stringify({ frames: both.length, lag: Math.round(lag * 100) / 100 }));
  // смена состояния на открытом экране — мягко: «как прошла смена?» → ответ
  await q.ctx.close();
  const m = await open({ tg: null, at: new Date("2026-10-21T23:30:00Z"), extra: { "sa_sched_cache_main_2026-10": JSON.stringify({ cfg: { staff: [{ id: "s1", name: "Роман" }], shifts: [{ k: "У", name: "Утро", from: 8, to: 10 }] }, plan: { s1: { 22: "У" } }, ts: NOW.getTime() }), sa_today_shift: JSON.stringify({ date: TODAY, label: "Утро · 08:00–10:00" }) } });
  const before = await m.page.evaluate(() => { const c = document.querySelector("[data-now-card]"); return c ? [c.getAttribute("data-now-card"), c.className] : null; });
  await m.page.locator('[data-now-moods] button[aria-label="Хорошо"]').click(); await sleep(500);
  const after = await m.page.evaluate(() => { const c = document.querySelector("[data-now-card]"); return c ? [c.getAttribute("data-now-card"), c.className] : null; });
  ok("FADE: при открытии — без проявления; ответ на «как прошла смена?» — мягко (sa-fadein)", before && before[0] === "after" && !/sa-fadein/.test(before[1]) && after && after[0] === "reply" && /sa-fadein/.test(after[1]), JSON.stringify({ before, after }));
  ok("FADE: без ошибок", !m.errors.length, m.errors.join(" | "));
  await m.ctx.close();
}

console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("✓")).length} ✓ / ${results.filter((r) => r.startsWith("✗")).length} ✗`);
await browser.close();
server.close();
