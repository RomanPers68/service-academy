// e2e v137 (Доп. 450): уведомления на телефон, как у «Плати по миру». Владелец (04.11): «можно ли это реализовать в
// приложении?» — на семь предложений «Да, берём все». Браузерные Push API — свои (сервис-воркер, PushManager, Notification,
// число на иконке), сервер — demo-app/fake-server.js с этапом 48 (noStage48 — без него), функция push-send — свой ответ.
// Разделы: ENABLE («Я» → «Уведомления на телефон»: включить — подписка с ключом сервера, «Проверить», «Выключить здесь»),
// KEY (ключа ещё нет — у функции push-send; функции нет — «Сервер уведомлений ещё не готов»), CHANNEL («Куда присылать»:
// только телефон — Telegram молчит, только Telegram — на телефон нет), ENV (iPhone в Safari — три шага, iOS 16.3, в
// Telegram — бот пишет, запрещено в настройках), TAP (касание уведомления при открытом приложении: переписка на сообщении,
// вопрос дня, график; ?go=remind при запуске), BADGE (число на иконке — непрочитанное в чатах), LOGOUT (вышел — подписка
// снята), SERVER («Сервер»: функция push-send на месте или как развернуть, телефоны), MISSING (этапа 48 нет), NARROW (320 px,
// светлая тема). REPLY (Доп. 451): уведомление о сообщении как в мессенджере, касание — сразу ответ (…_r). HOME (Доп. 452)
// с v138 — в e2e-v138.mjs.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v137.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5337, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v137";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/src/app/sa-v127";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const { makeServer, SHIFTS } = await import(SRC + "/tools/claude/demo-app/fake-server.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

const TZ = "Asia/Kamchatka";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const R0 = "Два моря, Океан";
const P = (id, name, surname, position, x = {}) => ({ id, name, surname, restaurant: R0, position, is_admin: false, ...x });
const MARIA = P("u-maria", "Мария", "Ким", "manager"), ANNA = P("e-anna", "Анна", "Смирнова", "waiter"), PETR = P("e-petr", "Пётр", "Орлов", "waiter");
const OLGA = P("e-olga", "Ольга", "Ли", "hostess"), ROMAN = P("u-roman", "Роман", "", "owner", { is_admin: true });
const PEOPLE = [MARIA, ANNA, PETR, OLGA, ROMAN];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["tok-" + p.id, p.id]));
const tok = (p) => "tok-" + p.id;
const SSTAFF = [{ id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Смирнова Анна", pos: "waiter", norm: 160 }, { id: 3, name: "Орлов Пётр", pos: "waiter", norm: 160 }, { id: 4, name: "Ли Ольга", pos: "host", norm: 160 }];
const CFG = { hours: Array.from({ length: 7 }, () => [12, 24]), shifts: SHIFTS, need: { 1: { waiter: 2 } }, split: {}, rules: { peakDows: [], highDows: [] }, staff: SSTAFF };
const plan = () => { const o = {}; for (let i = -3; i <= 20; i++) for (const sid of [1, 2, 3, 4]) if ((i + sid) % 3) (o[sid] = o[sid] || {})[i] = "Д"; return o; };
const KEYB = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
function srvOf(extra = {}) {
  const pings = [], pushes = [];
  const s = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: plan(), menu: [], tgLinked: ["u-maria", "e-anna", "e-petr", "u-roman"],
    progress: { "e-anna": ["s0-1", "s0-2"] }, ping: (to, text) => pings.push({ to, text }), push: (to, n) => pushes.push({ to, ...n }), ...extra });
  s.calls = []; s.pings = pings; s.pushes = pushes;
  return s;
}

const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra && !cond ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IPHONE = (v) => "Mozilla/5.0 (iPhone; CPU iPhone OS " + v + " like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/" + v.replace("_", ".") + " Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

// браузер с уведомлениями: сервис-воркер, PushManager, Notification, число на иконке (window.__push — что звали)
const PUSH_INIT = (cfg) => {
  const log = window.__push = { subscribe: [], unsub: 0, badges: [], answer: cfg.answer || "yes" };
  let perm = cfg.perm || "default";
  const mkSub = (ep, key) => ({ endpoint: ep, options: { applicationServerKey: key || null },
    toJSON() { return { endpoint: ep, keys: { p256dh: cfg.p256dh, auth: "BTBZMqHH6r4Tts7J_aSIgg" } }; },
    unsubscribe: async () => { log.unsub++; sub = null; return true; } });
  let sub = cfg.sub ? mkSub(cfg.sub) : null;
  const pm = { getSubscription: async () => sub, subscribe: async (o) => {
    log.subscribe.push({ uvo: o.userVisibleOnly, key: Array.from(new Uint8Array(o.applicationServerKey)) });
    if (perm === "default") perm = log.answer === "yes" ? "granted" : "denied";
    if (perm !== "granted") { const e = new Error("denied"); e.name = "NotAllowedError"; throw e; }
    sub = mkSub("https://fcm.googleapis.com/fcm/send/e2e-" + (log.subscribe.length), o.applicationServerKey); return sub; } };
  const reg = { active: {}, pushManager: pm };
  const et = new EventTarget();
  const sw = { getRegistration: async () => reg, register: async () => reg, ready: Promise.resolve(reg), controller: null,
    addEventListener: (...a) => et.addEventListener(...a), removeEventListener: (...a) => et.removeEventListener(...a), dispatchEvent: (e) => et.dispatchEvent(e) };
  Object.defineProperty(Navigator.prototype, "serviceWorker", { get: () => sw, configurable: true });
  window.__swGo = (go) => sw.dispatchEvent(new MessageEvent("message", { data: { type: "sa-go", go } }));
  window.PushManager = function PushManager() {};
  window.Notification = { get permission() { return perm; }, requestPermission: async () => perm };
  Navigator.prototype.setAppBadge = async (n) => { log.badges.push(n); };
  Navigator.prototype.clearAppBadge = async () => { log.badges.push(0); };
  if (cfg.standalone) {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/display-mode: standalone/.test(q) ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q));
    Object.defineProperty(Navigator.prototype, "standalone", { get: () => true, configurable: true });
  }
  if (cfg.tg) {
    window.Telegram = { WebApp: { initData: "query_id=x&user=%7B%22id%22%3A111%7D&auth_date=1&hash=abc", platform: "ios", initDataUnsafe: {}, ready() {}, expand() {}, setBackgroundColor() {}, setHeaderColor() {}, setBottomBarColor() {},
      openTelegramLink() {}, requestWriteAccess(cb) { setTimeout(() => cb && cb(true), 30); }, HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
      BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} } } };
  }
};

async function open({ who = ANNA, srv, rpcs = () => undefined, fn = null, light = false, w = 393, h = 852, path = "/", ua = ANDROID, push = {}, seedExtra = {}, safe = null } = {}) {
  const UK = "_" + who.name + "_" + who.surname;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: TZ, reducedMotion: "reduce", userAgent: ua });
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\/push-send/.test(u)) {
      srv.calls.push({ fn: "push-send", url: u, h: route.request().headers() });
      const r = fn ? fn(u) : { status: 404, body: { error: "not found" } };
      return route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    }
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      srv.calls.push({ fn: m[1], body, who: who.id, t: Date.now() });
      let own = rpcs(m[1], body);
      if (own === undefined) own = srv.rpc(m[1], body);
      return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own === undefined ? null : own) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: tok(who), sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_boot_missing: String(Date.now()), sa_hub_open: "all", ...seedExtra };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1"; seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } }, seed);
  await ctx.addInitScript(PUSH_INIT, { p256dh: KEYB, ...push });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  // v137 (Доп. 452): вырезы экрана, как у iPhone (env(safe-area-inset-*)): Chromium отдаёт их по просьбе DevTools
  if (safe) { const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: 0, left: 0, right: 0, ...safe } }); }
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  await page.goto(ORIGIN + path, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  await sleep(900);
  return { ctx, page, errors };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const nav = async (page, s, wait = 1300) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const until = async (fn, ms = 9000, step = 250) => { const t0 = Date.now(); for (;;) { let v = false; try { v = await fn(); } catch (e) { v = false; } if (v || Date.now() - t0 > ms) return v; await sleep(step); } };
const noErr = (...xs) => [!xs.some((x) => x.errors.length), xs.flatMap((x) => x.errors).slice(0, 3).join(" | ")];
const run = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { ok(name + ": раздел дошёл до конца", false, String(e && e.message || e).split("\n")[0].slice(0, 200)); } };
const SHEET = '[role="dialog"][aria-label="Напоминания"]';
const block = (page) => page.evaluate(() => (document.querySelector("[data-push-block]") || { getAttribute: () => "" }).getAttribute("data-push-block"));
const keyBytes = (k) => Array.from(Buffer.from(k.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
const openPushFromMe = async (page) => { await nav(page, "me"); await page.locator('.sa-card[aria-label="Уведомления на телефон"]').first().click(); await until(() => page.locator(SHEET).count()); await sleep(900); };
const openRemindFromShift = async (page) => { await nav(page, "shift"); await page.locator('.sa-card[aria-label="Напоминания"]').first().click(); await until(() => page.locator(SHEET).count()); await sleep(900); };

await run("ENABLE", async () => {
  const srv = srvOf();
  const o = await open({ who: ANNA, srv });
  await nav(o.page, "me");
  const row = await txt(o.page.locator('.sa-card[aria-label="Уведомления на телефон"]'));
  ok("ENABLE: «Я» → «Помощь и настройки» → «Уведомления на телефон»", /^Уведомления на телефон Чат, смены и вопрос дня на экране блокировки/.test(row), row);
  await openPushFromMe(o.page);
  ok("ENABLE: окно «Напоминания», раздел «На телефон» — «Включить уведомления» (вне Telegram — первым)", (await block(o.page)) === "off"
    && (await o.page.locator("[data-push-enable]").count()) === 1 && /^Напоминания За час до смены/.test(await txt(o.page.locator(SHEET)))
    && await o.page.evaluate(() => { const p = document.querySelector("[data-push-block]"), t = document.querySelector("[data-remind-tg]"); return !!p && !!t && !!(p.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING); }));
  await shot(o.page, "enable-1-off");
  const st0 = srv.calls.filter((c) => c.fn === "push_status").pop();
  ok("ENABLE: сотрудник — без адреса сервера и ключа anon", !!st0 && st0.body.p_url == null && st0.body.p_key == null, JSON.stringify(st0 && st0.body));
  await o.page.locator("[data-push-enable]").click();
  await until(async () => (await block(o.page)) === "on");
  const sub = await o.page.evaluate(() => window.__push.subscribe);
  const ps = srv.calls.filter((c) => c.fn === "push_subscribe").pop();
  ok("ENABLE: подписка — видимые уведомления, ключ сервера (65 байт)", sub.length === 1 && sub[0].uvo === true && JSON.stringify(sub[0].key) === JSON.stringify(keyBytes(srv.rpc("push_status", { p_token: tok(ANNA) }).key)), JSON.stringify(sub).slice(0, 120));
  ok("ENABLE: на сервер — адрес и ключи подписки, что за телефон", !!ps && /^https:\/\/fcm\.googleapis\.com\/fcm\/send\/e2e-1$/.test(ps.body.p_sub.endpoint) && ps.body.p_sub.keys.p256dh === KEYB && /Android 14/.test(ps.body.p_ua), JSON.stringify(ps && ps.body).slice(0, 200));
  ok("ENABLE: «✓ Включено на этом телефоне», «Проверить», «Выключить здесь»; подсказка про пробное",
    /✓ Включено на этом телефоне Проверить Выключить здесь Готово\. Нажми «Проверить»: придёт пробное уведомление\./.test(await txt(o.page.locator("[data-push-block]"))), await txt(o.page.locator("[data-push-block]")));
  ok("ENABLE: Telegram подключён — «Куда присылать», «Что ещё присылать» один раз", (await o.page.locator("[data-push-channel]").count()) === 1 && (await o.page.locator("[data-notify-prefs]").count()) === 1
    && (await o.page.locator("[data-remind-tglinked]").count()) === 1);
  await shot(o.page, "enable-2-on");
  await o.page.locator("[data-push-test]").click();
  await until(() => srv.pushes.length > 0);
  ok("ENABLE: «Проверить» — пробное уведомление: заголовок, текст, экран «Напоминания»", srv.pushes.length === 1 && srv.pushes[0].to === "e-anna" && srv.pushes[0].t === "Уведомления работают" && srv.pushes[0].go === "remind",
    JSON.stringify(srv.pushes));
  ok("ENABLE: «Отправил. Уведомление придёт через несколько секунд.»", await until(async () => /Отправил\. Уведомление придёт через несколько секунд\./.test(await txt(o.page.locator("[data-push-msg]")))));
  await o.page.locator("[data-push-test]").click(); await sleep(700);
  ok("ENABLE: ещё раз сразу — «Пробное уже ушло. Следующее можно через 15 секунд.»", /Пробное уже ушло/.test(await txt(o.page.locator("[data-push-msg]"))));
  await o.page.locator('[role="dialog"] [data-sa-back]').click(); await sleep(600);
  ok("ENABLE: в «Я» — «Включены на этом телефоне»; в «Смене» — «На телефон и в Telegram»", /Включены на этом телефоне/.test(await txt(o.page.locator('.sa-card[aria-label="Уведомления на телефон"]')))
    && await (async () => { await nav(o.page, "shift"); return /На телефон и в Telegram: разминка, чат, вопрос дня/.test(await txt(o.page.locator('.sa-card[aria-label="Напоминания"]'))); })());
  await openRemindFromShift(o.page);
  ok("ENABLE: снова открыл — сервер узнаёт этот телефон", (await block(o.page)) === "on");
  await o.page.locator("[data-push-off]").click();
  await until(async () => (await block(o.page)) === "off");
  ok("ENABLE: «Выключить здесь» — подписка снята и на сервере, и в браузере", (await o.page.evaluate(() => window.__push.unsub)) === 1 && srv.calls.some((c) => c.fn === "push_unsubscribe" && /e2e-1$/.test(c.body.p_endpoint))
    && srv.rpc("push_status", { p_token: tok(ANNA) }).n === 0 && /Выключено на этом телефоне\./.test(await txt(o.page.locator("[data-push-msg]"))));
  await shot(o.page, "enable-3-off-again");
  const [e1, e2] = noErr(o); ok("ENABLE: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("KEY", async () => {
  const K = srvOf().rpc("push_status", { p_token: tok(ANNA) }).key;
  const srv = srvOf();
  const o = await open({ who: ANNA, srv, rpcs: (fn, b) => (fn === "push_status" ? { ...srv.rpc(fn, b), key: null } : undefined), fn: () => ({ status: 200, body: { ok: true, key: K } }) });
  await openPushFromMe(o.page);
  const kc = srv.calls.find((c) => c.fn === "push-send");
  ok("KEY: ключа ещё нет — приложение просит его у функции push-send (?init=1, с ключом anon)", !!kc && /\/functions\/v1\/push-send\?init=1$/.test(kc.url) && /^eyJ/.test(kc.h.apikey || "") && /^Bearer eyJ/.test(kc.h.authorization || ""), JSON.stringify(kc && kc.url));
  await o.page.locator("[data-push-enable]").click();
  ok("KEY: подписка — ключом от функции", await until(async () => (await block(o.page)) === "on") && JSON.stringify((await o.page.evaluate(() => window.__push.subscribe))[0].key) === JSON.stringify(keyBytes(K)));
  await o.ctx.close();
  const srv2 = srvOf();
  const o2 = await open({ who: ANNA, srv: srv2, rpcs: (fn, b) => (fn === "push_status" ? { ...srv2.rpc(fn, b), key: null } : undefined), fn: () => ({ status: 404, body: { error: "not found" } }) });
  await openPushFromMe(o2.page);
  await o2.page.locator("[data-push-enable]").click(); await sleep(700);
  ok("KEY: функции push-send нет — «Сервер уведомлений ещё не готов. Скажи руководителю.», подписки не было", /Сервер уведомлений ещё не готов\. Скажи руководителю\./.test(await txt(o2.page.locator("[data-push-msg]")))
    && (await o2.page.evaluate(() => window.__push.subscribe.length)) === 0);
  const [e1, e2] = noErr(o, o2); ok("KEY: без ошибок", e1, e2);
  await o2.ctx.close();
});

await run("CHANNEL", async () => {
  const srv = srvOf();
  const o = await open({ who: MARIA, srv });
  await openRemindFromShift(o.page);
  await o.page.locator("[data-push-enable]").click();
  await until(async () => (await block(o.page)) === "on");
  ok("CHANNEL: «Куда присылать»: Telegram и телефон (сразу), только телефон, только Telegram", /^Куда присылать Telegram и телефон Только телефон Только Telegram Приходит и туда, и туда\.$/.test(await txt(o.page.locator("[data-push-channel]")))
    && (await o.page.locator('[data-push-ch="both"][aria-pressed="true"]').count()) === 1);
  const say = (t) => { for (const k of Object.keys(srv.S.seen)) delete srv.S.seen[k]; srv.bot.say("e-petr", t); };
  say("@Мария, банкет на 19:00 — ставим стол к окну?");
  ok("CHANNEL: Telegram и телефон — упоминание пришло и туда, и туда (на телефон — как в мессенджере, Доп. 451)", srv.pushes.some((p) => p.to === "u-maria" && p.t === "Вся команда" && /^Пётр О\.: @Мария, банкет/.test(p.b) && /^chat_1_\d+_r$/.test(p.go)) && srv.pings.some((p) => p.to === "u-maria"),
    JSON.stringify(srv.pushes.slice(-1)));
  await o.page.locator('[data-push-ch="push"]').click();
  await until(() => o.page.locator('[data-push-ch="push"][aria-pressed="true"]').count());
  ok("CHANNEL: «Только телефон» — на сервере push, подпись «Telegram молчит…»", srv.calls.some((c) => c.fn === "push_channel" && c.body.p_channel === "push") && /Telegram молчит, пока уведомления на телефоне включены\./.test(await txt(o.page.locator("[data-push-channel]"))));
  await shot(o.page, "channel-push");
  const p0 = srv.pings.length, q0 = srv.pushes.length;
  say("@Мария, гости пришли раньше");
  ok("CHANNEL: только телефон — на телефон пришло, в Telegram нет", srv.pushes.length === q0 + 1 && srv.pings.length === p0);
  await o.page.locator('[data-push-ch="tg"]').click(); await sleep(700);
  const p1 = srv.pings.length, q1 = srv.pushes.length;
  say("@Мария, проверь стоп-лист");
  ok("CHANNEL: только Telegram — в Telegram пришло, на телефон нет", srv.pings.length === p1 + 1 && srv.pushes.length === q1);
  const [e1, e2] = noErr(o); ok("CHANNEL: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("ENV", async () => {
  const srv = srvOf();
  const a = await open({ who: ANNA, srv, ua: IPHONE("17_5") });
  await openPushFromMe(a.page);
  ok("ENV: iPhone в Safari — три шага «Поделиться», «На экран «Домой»», «Открой… и включи», кнопки нет", (await block(a.page)) === "ios-browser" && (await a.page.locator("[data-push-ios] li").count()) === 3
    && /^1 Внизу Safari нажми «Поделиться» 2 Выбери «На экран «Домой»» и «Добавить» 3 Открой академию с экрана «Домой» и включи уведомления здесь$/.test(await txt(a.page.locator("[data-push-ios]")))
    && /^На телефон На iPhone уведомления приходят, когда академия открыта с экрана «Домой»\. Как её туда добавить:/.test(await txt(a.page.locator("[data-push-block]")))
    && (await a.page.locator("[data-push-enable]").count()) === 0);
  await shot(a.page, "env-ios-safari");
  await a.ctx.close();
  const b = await open({ who: ANNA, srv, ua: IPHONE("16_3"), push: { standalone: true } });
  await openPushFromMe(b.page);
  ok("ENV: iOS 16.3 с экрана «Домой» — «обнови iOS»", (await block(b.page)) === "ios-old" && /работают с iOS 16\.4\. Обнови iOS/.test(await txt(b.page.locator("[data-push-block]"))));
  await b.ctx.close();
  const c = await open({ who: ANNA, srv, ua: IPHONE("17_5"), push: { standalone: true } });
  await openPushFromMe(c.page);
  ok("ENV: iOS 17.5 с экрана «Домой» — можно включить", (await block(c.page)) === "off" && (await c.page.locator("[data-push-enable]").count()) === 1);
  await c.ctx.close();
  const d = await open({ who: ANNA, srv, push: { tg: true } });
  await openRemindFromShift(d.page);
  ok("ENV: в Telegram — «Здесь сообщения присылает бот Telegram…», Telegram первым, «Включить» одна (у Telegram)", (await block(d.page)) === "telegram"
    && /^Здесь сообщения присылает бот Telegram/.test((await txt(d.page.locator("[data-push-block]"))).replace(/^На телефон /, ""))
    && await d.page.evaluate(() => { const p = document.querySelector("[data-push-block]"), t = document.querySelector("[data-remind-tg]"); return !!(t.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING); }));
  await d.page.evaluate(() => { const e = document.querySelector("[data-push-block]"); if (e) e.scrollIntoView({ block: "center" }); }); await sleep(300);
  await shot(d.page, "env-telegram");
  await d.ctx.close();
  const e = await open({ who: ANNA, srv, push: { perm: "denied" } });
  await openPushFromMe(e.page);
  ok("ENV: запрещено в настройках — где разрешить", (await block(e.page)) === "denied" && /Уведомления запрещены в настройках телефона\. iPhone: Настройки, Уведомления, Service Academy/.test(await txt(e.page.locator("[data-push-block]"))));
  await e.ctx.close();
  const f = await open({ who: ANNA, srv, push: { answer: "no" } });
  await openPushFromMe(f.page);
  await f.page.locator("[data-push-enable]").click(); await sleep(800);
  ok("ENV: «Не разрешать» в окне телефона — объясняем, где разрешить, кнопки больше нет", (await block(f.page)) === "denied" && (await f.page.locator("[data-push-enable]").count()) === 0
    && /Уведомления запрещены в настройках телефона/.test(await txt(f.page.locator("[data-push-msg]"))));
  const [e1, e2] = noErr(a, b, c, d, e, f); ok("ENV: без ошибок", e1, e2);
  await f.ctx.close();
});

await run("TAP", async () => {
  const srv = srvOf();
  for (const k of Object.keys(srv.S.seen)) delete srv.S.seen[k];
  const m = srv.bot.say("u-maria", "@Анна, возьмёшь банкет на веранде?");
  const o = await open({ who: ANNA, srv, push: { perm: "granted", sub: "https://fcm.googleapis.com/fcm/send/tap" } });
  await o.page.evaluate((go) => window.__swGo(go), "chat_1_" + m.id); await sleep(2200);
  ok("TAP: касание уведомления о сообщении (приложение открыто) — переписка на этом сообщении", await until(() => o.page.locator("[data-chat]").count(), 6000)
    && /возьмёшь банкет на веранде/.test(await txt(o.page.locator("[data-chat]"))));
  await shot(o.page, "tap-chat");
  for (let i = 0; i < 5 && await o.page.locator("[data-chat]").count(); i++) { await o.page.evaluate(() => { const b = document.querySelector("[data-chat] [data-sa-back]"); if (b) b.click(); }); await sleep(450); }
  await o.page.evaluate(() => window.__swGo("schedule")); await sleep(1600);
  ok("TAP: «Завтра смена» — график", await until(() => o.page.locator('[data-lens="back"]').count()) && /График|Смены/.test(await txt(o.page.locator("body"))));
  await o.page.evaluate(() => window.__swGo("qday")); await sleep(1500);
  ok("TAP: «Вопрос дня» — главная, вопрос дня запрошен заново", srv.calls.filter((c) => c.fn === "qday_today").length >= 1);
  await o.page.evaluate(() => window.__swGo("javascript:alert(1)")); await sleep(500);
  ok("TAP: чужая ссылка — ничего", (await o.page.locator('[role="dialog"]').count()) === 0);
  await o.ctx.close();
  const o2 = await open({ who: ANNA, srv, path: "/?go=remind" });
  ok("TAP: открыли по уведомлению (/?go=remind) — «Напоминания», к телефону", await until(() => o2.page.locator(SHEET).count()));
  const [e1, e2] = noErr(o, o2); ok("TAP: без ошибок", e1, e2);
  await o2.ctx.close();
});

await run("BADGE", async () => {
  const srv = srvOf();
  srv.bot.say("u-maria", "Доброе утро, команда"); srv.bot.say("e-petr", "Привет");
  const o = await open({ who: ANNA, srv });
  ok("BADGE: число на иконке — непрочитанное в чатах (2)", await until(async () => (await o.page.evaluate(() => window.__push.badges)).includes(2), 9000), JSON.stringify(await o.page.evaluate(() => window.__push.badges)));
  const [e1, e2] = noErr(o); ok("BADGE: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("LOGOUT", async () => {
  const srv = srvOf();
  srv.rpc("push_subscribe", { p_token: tok(ANNA), p_sub: { endpoint: "https://fcm.googleapis.com/fcm/send/out", keys: { p256dh: KEYB, auth: "BTBZMqHH6r4Tts7J_aSIgg" } } });
  const o = await open({ who: ANNA, srv, push: { perm: "granted", sub: "https://fcm.googleapis.com/fcm/send/out" }, seedExtra: { sa_push_on_Анна_Смирнова: "1" } });
  await nav(o.page, "profile");
  await o.page.getByText("Выйти с этого устройства").click(); await sleep(300);
  await o.page.getByRole("button", { name: "Выйти", exact: true }).click(); await sleep(1200);
  ok("LOGOUT: вышел — подписка снята на сервере (с токеном Анны) и в браузере", srv.calls.some((c) => c.fn === "push_unsubscribe" && c.body.p_token === tok(ANNA) && /\/out$/.test(c.body.p_endpoint))
    && (await o.page.evaluate(() => window.__push.unsub)) === 1 && srv.rpc("push_status", { p_token: tok(ANNA) }).n === 0);
  const [e1, e2] = noErr(o); ok("LOGOUT: без ошибок", e1, e2);
  await o.ctx.close();
});

await run("SERVER", async () => {
  const srv = srvOf({ pushSubs: ["e-petr", "e-olga"] });
  const o = await open({ who: ROMAN, srv, fn: () => ({ status: 200, body: { ok: true, key: KEYB } }) });
  await nav(o.page, "server", 2600);
  await until(() => o.page.locator('[data-srv-push="ok"]').count());
  const t = await txt(o.page.locator("[data-srv-push]"));
  ok("SERVER: «Уведомления на телефон»: функция на месте, 2 человека, 2 телефона", /^Функция push-send: на месте .* Уведомления включили: 2 человека, телефонов: 2/.test(t), t);
  const st = srv.calls.filter((c) => c.fn === "push_status").pop();
  ok("SERVER: руководитель передаёт адрес сервера и ключ anon (база зовёт push-send)", !!st && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(st.body.p_url) && /^eyJ/.test(st.body.p_key || ""));
  ok("SERVER: этап 48 — в списке этапов", /48 · Уведомления на телефон/.test(await (async () => { await o.page.locator("[data-srv-all]").click(); await sleep(300); return txt(o.page.locator("[data-srv-db]")); })()));
  ok("SERVER: «Напоминания в Telegram включили» — без Ольги (у неё только телефон)", /Напоминания в Telegram включили: 4/.test(await txt(o.page.locator("[data-srv-tg]"))), await txt(o.page.locator("[data-srv-tg]")));
  await o.page.evaluate(() => { const e = document.querySelector("[data-srv-push]"); if (e) e.scrollIntoView({ block: "center" }); }); await sleep(300);
  await shot(o.page, "server-ok");
  await o.ctx.close();
  const o2 = await open({ who: ROMAN, srv: srvOf(), fn: () => ({ status: 404, body: {} }) });
  await nav(o2.page, "server", 2600);
  await until(() => o2.page.locator('[data-srv-push="no_fn"]').count());
  ok("SERVER: функции нет — как развернуть, «Код на GitHub», в «Нужно сделать» +1", /Функции push-send нет Edge Functions, Deploy a new function, Via Editor: имя push-send, вставь код, Deploy\. Проверку JWT выключи, как у tg-bot\. Код на GitHub/.test(await txt(o2.page.locator("[data-srv-push]")))
    && Number(await o2.page.locator("[data-srv-todo]").getAttribute("data-srv-todo")) >= 1);
  await shot(o2.page, "server-nofn");
  const [e1, e2] = noErr(o, o2); ok("SERVER: без ошибок", e1, e2);
  await o2.ctx.close();
});

await run("MISSING", async () => {
  const srv = srvOf({ noStage48: true });
  const o = await open({ who: ANNA, srv });
  await openRemindFromShift(o.page);
  ok("MISSING: этапа 48 нет — «Уведомления на телефон появятся, когда владелец обновит сервер», кнопки нет; Telegram — как раньше",
    /Уведомления на телефон появятся, когда владелец обновит сервер\./.test(await txt(o.page.locator("[data-push-block]"))) && (await o.page.locator("[data-push-enable]").count()) === 0
    && /✓ Включено: за час до смены/.test(await txt(o.page.locator("[data-remind-tg]"))) && (await o.page.locator("[data-push-channel]").count()) === 0);
  const [e1, e2] = noErr(o); ok("MISSING: без ошибок", e1, e2);
  await o.ctx.close();
});

// v137 (Доп. 451): уведомление о сообщении — как в мессенджере, касание — сразу ответ (цитата над строкой ввода в группе,
// строка ввода в личной); ссылка …_r и при запуске
await run("REPLY", async () => {
  const srv = srvOf({ pushSubs: ["e-anna"] });
  for (const k of Object.keys(srv.S.seen)) delete srv.S.seen[k];
  const m = srv.bot.say("u-maria", "@Анна, возьмёшь банкет на веранде?");
  const n = srv.pushes.filter((x) => x.to === "e-anna").at(-1);
  ok("REPLY: на телефон — «Вся команда», «Мария К.: …», c — чат, касание — к ответу (…_r), кнопки «Ответить» и «Прочитано»",
    !!n && n.t === "Вся команда" && n.b === "Мария К.: @Анна, возьмёшь банкет на веранде?" && n.go === "chat_1_" + m.id + "_r" && n.c === 1
    && JSON.stringify(n.a) === JSON.stringify([{ a: "reply", t: "Ответить" }, { a: "read", t: "Прочитано" }]) && /^[0-9a-f]{64}$/.test(n.k), JSON.stringify(n));
  const o = await open({ who: ANNA, srv, push: { perm: "granted", sub: "https://fcm.googleapis.com/fcm/send/rep" } });
  await o.page.evaluate((go) => window.__swGo(go), n.go);
  ok("REPLY: касание — переписка на этом сообщении и сразу ответ на него (цитата над строкой ввода)",
    await until(() => o.page.locator("[data-chat-noreply]").count(), 6000) && /возьмёшь банкет на веранде/.test(await txt(o.page.locator(".ch-bar"))));
  await shot(o.page, "reply-group");
  for (let i = 0; i < 5 && await o.page.locator("[data-chat]").count(); i++) { await o.page.evaluate(() => { const b = document.querySelector("[data-chat] [data-sa-back]"); if (b) b.click(); }); await sleep(450); }
  const dm = srv.rpc("chat_dm", { p_token: tok(MARIA), p_emp: "e-anna" }).chat.id;
  delete srv.S.seen[dm + "|e-anna"];
  srv.rpc("chat_send", { p_token: tok(MARIA), p_chat: dm, p_body: "Можно поменяться сменой в субботу?" });
  const n2 = srv.pushes.filter((x) => x.to === "e-anna").at(-1);
  ok("REPLY: личное — заголовок «Мария Ким», текст — сообщение", !!n2 && n2.t === "Мария Ким" && n2.b === "Можно поменяться сменой в субботу?" && n2.go.endsWith("_r") && n2.c === dm, JSON.stringify(n2));
  await o.page.evaluate((go) => window.__swGo(go), n2.go);
  ok("REPLY: в личной — без цитаты, строка ввода готова", await until(() => o.page.locator(".ch-bar").count(), 6000)
    && (await o.page.locator("[data-chat-noreply]").count()) === 0
    && await until(() => o.page.evaluate(() => !!document.activeElement && document.activeElement.classList.contains("ch-input")), 3000));
  await shot(o.page, "reply-dm");
  await o.ctx.close();
  const o2 = await open({ who: ANNA, srv, path: "/?go=chat_1_" + m.id + "_r" });
  ok("REPLY: открыли по уведомлению (/?go=chat_…_r) — тоже сразу ответ", await until(() => o2.page.locator("[data-chat-noreply]").count(), 8000));
  const o3 = await open({ who: ANNA, srv, path: "/?go=chat_1_" + m.id + "_x" });
  ok("REPLY: чужой хвост (…_x) — ссылка не принимается", (await o3.page.locator("[data-chat]").count()) === 0);
  const [e1, e2] = noErr(o, o2, o3); ok("REPLY: без ошибок", e1, e2);
  await o2.ctx.close(); await o3.ctx.close();
});

// v138 (Доп. 453): раздел HOME (приложение с экрана «Домой» на iPhone, Доп. 452) — в e2e-v138.mjs: v138 убрал
// viewport-fit=cover, и вид там другой

await run("NARROW", async () => {
  for (const light of [false, true]) {
    const tag = light ? "light" : "dark";
    const srv = srvOf();
    const o = await open({ who: MARIA, srv, light, w: 320, h: 720 });
    await openRemindFromShift(o.page);
    await o.page.locator("[data-push-enable]").click(); await until(async () => (await block(o.page)) === "on");
    const over = await o.page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); const W = d.getBoundingClientRect().right; return [...d.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > W + 1; }).length; });
    ok(`NARROW ${tag}: 320 px — окно в ширину, без вылезающего`, over === 0, String(over));
    await o.page.evaluate(() => { const e = document.querySelector("[data-push-channel]"); if (e) e.scrollIntoView({ block: "center" }); }); await sleep(300);
    await shot(o.page, "narrow-" + tag);
    const [e1, e2] = noErr(o); ok(`NARROW ${tag}: без ошибок`, e1, e2);
    await o.ctx.close();
  }
});

await browser.close(); server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
