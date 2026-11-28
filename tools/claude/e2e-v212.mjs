// e2e v212 (Доп. 538): «Позвать» подряд — без «подожди минуту», схема сразу, лист не закрывается.
// Владелец: «Бывает такое, что приходит несколько столов подряд, и хостес должен всех оповестить, а приложение не дает
// это сделать сразу, просит подождать минуту. Да и сам путь, позвать к столу довольно длинный».
// Разделы:
//   SERIES — хостес Ольга на главной: «Позвать: официанта к столу» → лист сразу на «К столу» со схемой (команда взята
//            заранее), кнопками те, кто в смене (официанты первыми); стол 5 + Анна → «Позвать Анну к столу 5» → лист
//            открыт, «Позвали Анну к столу 5», колокольчик у стола; сразу стол 7 + Пётр — уходит без паузы; Анну к
//            столу 5 ещё раз — «уже позвали, ждём ответа», в чате нового нет; у Анны баннер; «Другой…» — Вера не в
//            смене; закрыла и открыла — колокольчики на месте;
//   SHIFT  — «Смена» → «Позвать к столу» в карточке «Зал сейчас»: схема из копии, хотя сервер отвечает через 2 секунды;
//   SEAT   — «Рассадка»: «Позвать» в шапке; карточка стола 7 → «Позвать к столу 7» — лист со столом 7, Пётр → уходит;
//   CHAT   — колокольчик в переписке «Вся команда»: два вызова подряд, оба в ленте, лист открыт;
//   OLD    — сервер без этапа 68: второй вызов — «Только что был вызов: подожди полминуты.»;
//   LOOK   — обе темы, 393 и 360 точек, низкий экран: кнопка «Позвать…» видна без прокрутки, без прокрутки вбок, снимки.
// Голова сценария — из e2e-v189.mjs (сервер чата в памяти, схема зала — seat_board).
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v212.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5412, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v212";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const PHOTO = SRC + "/tools/claude/chat-demo/home-light.webp";   // фото «с телефона»
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const ORIGIN = "http://localhost:" + PORT;

const R0 = "Два моря, Океан";
const ANNA = { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false };
const MARIA = { id: "u-lead", name: "Мария", surname: "Ким", restaurant: R0, position: "senior", is_admin: false };
const OLGA = { id: "u-host", name: "Ольга", surname: "Ли", restaurant: R0, position: "hostess", is_admin: false };
const IRINA = { id: "u-irina", name: "Ирина", surname: "Портова", restaurant: "Порт", position: "manager", is_admin: false };
const STAFF = [ANNA, MARIA, OLGA, { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: R0, position: "waiter" }, { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender" },
  { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: R0, position: "waiter" }, IRINA, { id: "e-ivan", name: "Иван", surname: "Петров", restaurant: "Порт", position: "waiter" }];
const OFF = ["e-vera"];   // Вера сегодня не в смене
const TOK = { "tok-anna": ANNA, "tok-maria": MARIA, "tok-olga": OLGA, "tok-irina": IRINA };
const ukOf = (p) => "_" + p.name + "_" + p.surname;
const full = (p) => p.name + " " + p.surname;
const LEADS = ["manager", "senior", "owner", "admin", "service_manager", "head"];
const isLead = (p) => !!p.is_admin || LEADS.includes(p.position);

// ── сервер чата в памяти: те же ответы, что у этапа 38 ──
function chatServer({ old = false } = {}) {
  const S = { chats: [{ id: 1, kind: "team", rest: R0, pin: null }, { id: 2, kind: "leads", rest: R0, pin: null }, { id: 3, kind: "net", rest: "", pin: null }, { id: 4, kind: "team", rest: "Порт", pin: null }],
    msgs: [], reads: {}, photos: {}, seq: 100, pseq: 500, log: [] };
  const now = () => new Date().toISOString();
  const visible = (c, p) => !!c && (c.kind === "net" ? isLead(p) : c.kind === "dm" ? c.members.includes(p.id) : c.rest === p.restaurant && (c.kind === "team" || isLead(p)));
  const members = (c) => STAFF.filter((e) => (c.kind === "net" ? isLead(e) : c.kind === "dm" ? c.members.includes(e.id) : e.restaurant === c.rest && (c.kind === "team" || isLead(e))));
  const rd = (c, e) => ((S.reads[c.id] || {})[e] || 0);
  const setRead = (c, e, v) => { S.reads[c.id] = S.reads[c.id] || {}; S.reads[c.id][e] = Math.max(rd(c, e), v); };
  const msgOf = (id) => S.msgs.find((m) => m.id === Number(id));
  const quote = (q) => (q ? { id: q.id, emp: q.emp, name: q.name, kind: q.kind, body: q.del ? "" : q.body, photo: q.kind === "photo", del: q.del } : null);
  const J = (m) => ({ id: m.id, chat: m.chat, emp: m.emp, name: m.name, rest: m.rest, body: m.del ? "" : m.body, kind: m.kind, call: m.kind === "call" && !m.del ? m.call : null,
    photo: m.kind === "photo" && !m.del ? m.photo : null, reply: m.reply && !m.del ? quote(msgOf(m.reply)) : null, reacts: m.del ? [] : m.reacts.map((x) => ({ ...x })),
    at: m.at, edited: !!m.edited && !m.del, del: m.del });
  const put = (c, p, body, extra = {}) => { const t = now(); const m = { id: ++S.seq, chat: c.id, emp: p.id, name: full(p), rest: p.restaurant, body, kind: "text", call: null, photo: null, reply: null, reacts: [], edited: false, del: false, at: t, upd: t, ...extra }; S.msgs.push(m); setRead(c, p.id, m.id); return m; };
  const touch = (m) => { m.upd = now(); };
  const unread = (c, p) => S.msgs.filter((m) => m.chat === c.id && !m.del && m.emp !== p.id && m.id > rd(c, p.id)).length;
  const callFor = (m, p) => m.kind === "call" && !m.del && m.emp !== p.id && (m.call.who === "person" ? m.call.emp === p.id : m.call.who === "lead" ? isLead(p) : ({ host: ["hostess"], bar: ["bartender"], waiter: ["waiter"] }[m.call.who] || []).includes(p.position));
  const calls = (p) => S.msgs.filter((m) => callFor(m, p) && !(m.call.going || []).length && Date.now() - Date.parse(m.at) < 600000).map(J);
  const view = (c, p) => {
    const last = [...S.msgs].reverse().find((m) => m.chat === c.id);
    const peer = c.kind === "dm" ? STAFF.find((e) => e.id === c.members.find((x) => x !== p.id)) : null;
    return { id: c.id, kind: c.kind, members: members(c).length, shift: c.kind === "team" || c.kind === "leads" ? 3 : null, peer: peer ? { id: peer.id, name: full(peer), pos: peer.position, shift: true } : null,
      last: last ? J(last) : null, unread: unread(c, p) };
  };
  const whyText = (k) => ({ who: { lead: "менеджера", host: "хостес", bar: "бар", waiter: "официанта" }[k.who] || (k.to_name || "").split(" ")[0], why: { table: "к столу " + (k.table || ""), help: "нужна помощь", come: "подойди ко мне", guest: "гость ждёт", own: k.text || "" }[k.why] });
  const rpc = (fn, b) => {
    if (!/^chat_/.test(fn)) return undefined;
    S.log.push({ fn, b });
    const p = TOK[b.p_token];
    if (!p) return { ok: false, error: "auth" };
    const chat = (id) => S.chats.find((c) => c.id === Number(id));
    if (fn === "chat_list") {
      const list = S.chats.filter((c) => visible(c, p) && (c.kind !== "dm" || S.msgs.some((m) => m.chat === c.id))).map((c) => view(c, p));
      list.sort((x, y) => ({ team: 0, leads: 1, net: 2, dm: 3 })[x.kind] - ({ team: 0, leads: 1, net: 2, dm: 3 })[y.kind]);
      return { ok: true, me: { id: p.id, name: full(p), pos: p.position, lead: isLead(p), network: !!p.is_admin || p.position === "senior", restaurant: p.restaurant }, chats: list,
        unread: list.reduce((s, c) => s + c.unread, 0), calls: calls(p) };
    }
    if (fn === "chat_unread") return { ok: true, unread: S.chats.filter((c) => visible(c, p)).reduce((s, c) => s + unread(c, p), 0), calls: calls(p) };
    if (fn === "chat_open") {
      const c = chat(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
      let list = S.msgs.filter((m) => m.chat === c.id), more = false;
      if (b.p_before) { list = list.filter((m) => m.id < b.p_before); more = list.length > 40; list = list.slice(-40); }
      else if (b.p_after) list = list.filter((m) => m.id > b.p_after || (b.p_since && Date.parse(m.upd) >= Date.parse(b.p_since) - 5000));
      else { more = list.length > 60; list = list.slice(-60); }
      const pin = c.pin ? msgOf(c.pin) : null;
      return { ok: true, chat: view(c, p), msgs: list.map(J), members: members(c).map((e) => ({ id: e.id, name: full(e), pos: e.position, rest: e.restaurant, read: rd(c, e.id) })), more,
        pin: c.kind !== "dm" && pin && !pin.del ? J(pin) : null, now: now() };
    }
    if (fn === "chat_read") { const c = chat(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" }; setRead(c, p.id, Math.min(Number(b.p_last) || 0, S.seq)); return { ok: true }; }
    if (fn === "chat_send" || fn === "chat_photo_send") {
      const c = chat(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
      const q = b.p_reply ? msgOf(b.p_reply) : null;
      const body = String(b.p_body || "").trim().slice(0, 1000);
      if (fn === "chat_send" && !body) return { ok: false, error: "bad_request" };
      const extra = { reply: q && q.chat === c.id && !q.del ? q.id : null };
      if (fn === "chat_photo_send") {
        if (!b.p_full || !b.p_thumb || !(b.p_w > 0) || !(b.p_h > 0)) return { ok: false, error: "bad_request" };
        const pid = ++S.pseq; S.photos[pid] = { full: b.p_full, thumb: b.p_thumb, w: b.p_w, h: b.p_h };
        Object.assign(extra, { kind: "photo", photo: { id: pid, w: b.p_w, h: b.p_h } });
      }
      return { ok: true, msg: J(put(c, p, body, extra)) };
    }
    if (fn === "chat_photo") {
      const id = Number(b.p_id), m = S.msgs.find((x) => x.photo && x.photo.id === id), ph = S.photos[id];
      if (!ph || !m || m.del || !visible(chat(m.chat), p)) return { ok: false, error: "not_found" };
      return { ok: true, mime: "image/jpeg", w: ph.w, h: ph.h, data: b.p_full ? ph.full : ph.thumb };
    }
    if (fn === "chat_edit") {
      const m = msgOf(b.p_msg); if (!m || m.del || !visible(chat(m.chat), p)) return { ok: false, error: "not_found" };
      if (m.emp !== p.id) return { ok: false, error: "forbidden" };
      m.body = String(b.p_body || "").trim(); m.edited = true; touch(m); return { ok: true, msg: J(m) };
    }
    if (fn === "chat_react") {
      const m = msgOf(b.p_msg); if (!m || m.del || !visible(chat(m.chat), p)) return { ok: false, error: "not_found" };
      m.reacts = m.reacts.filter((x) => x.emp !== p.id); if (b.p_r) m.reacts.push({ r: b.p_r, emp: p.id, name: full(p) }); touch(m); return { ok: true, msg: J(m) };
    }
    if (fn === "chat_pin") {
      const c = chat(b.p_chat); if (!visible(c, p) || c.kind === "dm") return { ok: false, error: "not_found" };
      if (c.kind === "team" && !isLead(p)) return { ok: false, error: "forbidden" };
      if (!b.p_msg) { c.pin = null; return { ok: true, pin: null }; }
      const m = msgOf(b.p_msg); if (!m || m.chat !== c.id || m.del) return { ok: false, error: "not_found" };
      c.pin = m.id;
      const s = put(c, p, p.name + " закрепляет «" + (m.body.length > 48 ? m.body.slice(0, 47) + "…" : m.body) + "»", { kind: "sys", reply: m.id });
      return { ok: true, pin: J(m), msg: J(s) };
    }
    if (fn === "chat_dm") {
      const other = STAFF.find((e) => e.id === b.p_emp); if (!other || other.id === p.id) return { ok: false, error: "bad_request" };
      let c = S.chats.find((x) => x.kind === "dm" && x.members.includes(p.id) && x.members.includes(other.id));
      if (!c) { c = { id: S.chats.length + 10, kind: "dm", members: [p.id, other.id] }; S.chats.push(c); }
      return { ok: true, chat: view(c, p) };
    }
    if (fn === "chat_people") return { ok: true, people: STAFF.filter((e) => e.id !== p.id && e.restaurant === p.restaurant).map((e) => ({ id: e.id, name: full(e), pos: e.position, shift: !OFF.includes(e.id) })) };
    if (fn === "chat_call") {
      // как этап 68: тот же вызов за 30 секунд — already; old — сервер без этапа 68 (после любого вызова — too_fast)
      const c = S.chats.find((x) => x.kind === "team" && x.rest === p.restaurant), to = b.p_who === "person" ? STAFF.find((e) => e.id === b.p_emp) : null;
      const k = { who: b.p_who, emp: to ? to.id : null, to_name: to ? full(to) : "", why: b.p_why, table: b.p_why === "table" ? String(b.p_table || "").trim() : "", text: b.p_why === "own" ? String(b.p_text || "").trim() : "", going: [] };
      const mine = S.msgs.filter((m) => m.emp === p.id && m.kind === "call" && Date.now() - Date.parse(m.at) < 30000);
      if (old && mine.length) return { ok: false, error: "too_fast" };
      const same = mine.reverse().find((m) => !m.del && m.call.who === k.who && String(m.call.emp || "") === String(k.emp || "") && m.call.why === k.why && m.call.table === k.table && m.call.text === k.text);
      if (!old && same) return { ok: false, error: "already", msg: J(same) };
      const w = whyText(k);
      return { ok: true, msg: J(put(c, p, p.name + " зовёт " + w.who + ": " + w.why, { kind: "call", call: k })) };
    }
    if (fn === "chat_go") {
      const m = msgOf(b.p_msg); if (!m || m.kind !== "call") return { ok: false, error: "not_found" };
      if (!m.call.going.some((g) => g.id === p.id)) { m.call.going.push({ id: p.id, name: full(p), at: now() }); touch(m); }
      return { ok: true, msg: J(m) };
    }
    if (fn === "chat_delete") {
      const m = msgOf(b.p_msg); if (!m) return { ok: false, error: "not_found" };
      const mc = chat(m.chat);
      if (m.emp !== p.id && !(mc.kind === "net" ? !!p.is_admin || p.position === "senior" : mc.kind !== "dm" && isLead(p))) return { ok: false, error: "forbidden" };
      m.del = true; m.body = ""; m.photo = null; m.reacts = []; touch(m); S.chats.forEach((c) => { if (c.pin === m.id) c.pin = null; });
      return { ok: true };
    }
    return { ok: false, error: "bad_request" };
  };
  // утро: Мария написала команде, Ольга ответила
  const team = S.chats[0];
  const m1 = put(team, MARIA, "Доброе утро! Сегодня банкет на 12 человек в 19:00 на веранде.");
  put(team, OLGA, "Поняла, накрою веранду к 18:00", { reply: m1.id });
  return { S, rpc };
}

const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ who = ANNA, token = "tok-anna", rpcs = () => undefined, calls = [], light = false, w = 393, h = 852, path = "/", seedExtra = {} } = {}) {
  const UK = ukOf(who);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Asia/Kamchatka", reducedMotion: "reduce" });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN }).catch(() => {});
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      calls.push({ fn: m[1], body, t: Date.now() });
      let own = rpcs(m[1], body);
      if (own && own.__delay) { const d = own.__delay; own = own.body; await sleep(d); }   // v212: ответ сервера позже (копия на телефоне — сразу)
      if (own !== undefined) return route.fulfill({ status: own && own.code === "PGRST202" ? 404 : 200, contentType: "application/json", body: JSON.stringify(own) });
      const mock = { whoami: { ok: true, employee: who }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
        my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: "seasonal" },
        team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "all" }, my_mentors: { ok: true, rows: [] }, schedule_load: { ok: false, error: "auth" }, menu_get: [],
        qday_inbox: { ok: true, items: [] }, brief_today: { ok: true, brief: null }, case_list: { ok: true, lead: false, team: 0, fresh: 0, inbox: 0, mine_new: 0, top: null }, menu_progress_team: { ok: true, rows: [] } };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mock[m[1]] !== undefined ? mock[m[1]] : null) });
    }
    return route.abort();
  });
  const seed = { sa_a11y: light ? "1" : "0", sa_theme_auto: "0", sa_welcome_seen_v11: "1", sa_hub_open: "all", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_session_token: token, sa_profile: JSON.stringify(who), sa_ai_fab: "1", ["sa_last_role" + UK]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + UK]: "1",
    ["sa_mastery" + UK]: JSON.stringify({ tiers: {}, fw: false, master: {} }), sa_menu_shared: JSON.stringify({ [R0]: [] }), ...seedExtra };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1"; seed[`sa_hint_v${HINTS_VERSION}_track_orb`] = "1";
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem("__seeded")) { sessionStorage.setItem("__seeded", "1"); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/i.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  const t0 = Date.now();
  await page.goto(ORIGIN + path, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла"));
  return { ctx, page, errors, calls, t0 };
}
const only = process.argv.slice(2);
const want = (t) => !only.length || only.includes(t);
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const txt = async (loc) => ((await loc.count()) ? (await loc.first().innerText()).replace(/\s+/g, " ").trim() : "");
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const noShift = (page) => page.evaluate(() => [...document.querySelectorAll("*")].filter((e) => e.scrollLeft > 0).length === 0);
const fits = (page, sel) => page.evaluate((sel) => { const W = document.documentElement.clientWidth; const over = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1) && !e.closest(".ch-ticks"); }).length; return { W, sw: document.documentElement.scrollWidth, over }; }, sel);
// текст пузыря (не цитата в чужом ответе): нажатие на него открывает лист сообщения
const bubble = (page, text) => page.locator("[data-chat-bubble] > .ch-tx", { hasText: text }).last();
const bubbleEl = (page, text) => page.locator("[data-chat-bubble]").filter({ has: page.locator(":scope > .ch-tx", { hasText: text }) }).last();
const wake = (page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));   // приложение снова на виду — сразу спросить непрочитанные
const openTeam = async (page) => { await page.locator("[data-chat-dock]").click(); await sleep(900); await page.locator('[data-chat-item="team"]').click(); await sleep(1300); };

// схема зала и столы на сегодня (seat_board): «Основной зал» и «Веранда»
const NOW = new Date();
const ago = (m) => new Date(NOW.getTime() - m * 60000).toISOString();
const PLAN = { v: 2, zones: [{ id: "z1", name: "Основной зал" }, { id: "z2", name: "Веранда" }], items: [{ id: "i1", kind: "bar", x: 7, y: 0, w: 1, h: 3, z: "z1" }, { id: "i2", kind: "door", x: 3, y: 5, z: "z1" }], tables: [
  { id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t2", n: "2", seats: 4, shape: "sq", x: 2, y: 0, z: "z1" },
  { id: "t3", n: "3", seats: 6, shape: "long", x: 4, y: 0, z: "z1" }, { id: "t4", n: "4", seats: 2, shape: "sq", x: 0, y: 2, z: "z1" },
  { id: "t5", n: "5", seats: 4, shape: "rd", x: 2, y: 2, z: "z1" }, { id: "t6", n: "6", seats: 4, shape: "rd", x: 4, y: 2, z: "z1" },
  { id: "t7", n: "7", seats: 8, shape: "long", x: 0, y: 4, z: "z1" }, { id: "t8", n: "8", seats: 2, shape: "sq", x: 5, y: 4, z: "z1" },
  { id: "t20", n: "20", seats: 4, shape: "sq", x: 0, y: 0, z: "z2" }, { id: "t21", n: "21", seats: 6, shape: "long", x: 2, y: 0, z: "z2" }, { id: "t22", n: "22", seats: 4, shape: "rd", x: 5, y: 0, z: "z2" }] };
const row = (tid, status, cnt, min, w = null, extra = {}) => ({ tid, status, cnt, name: "", rtime: "", since: status === "seat" || status === "bill" ? ago(min) : null,
  waiter_id: w ? w.id : null, waiter_name: w ? w.name + " " + w.surname : "", main: null, joined: [], ...extra });
const PETR = STAFF.find((e) => e.id === "e-petr");
const ROWS = [row("t2", "seat", 2, 50, PETR), row("t3", "bill", 5, 95, PETR), row("t5", "seat", 3, 25, ANNA), row("t7", "seat", 6, 10, ANNA), row("t8", "clean", 0, 0),
  { ...row("t21", "res", 6, 0), rtime: "20:00", name: "Ильины" }, row("t20", "seat", 2, 40, PETR)];
const withBoard = (C, { plan = PLAN, rows = ROWS, delay = 0 } = {}) => (fn, b) => {
  if (fn !== "seat_board") return C.rpc(fn, b);
  const r = plan ? { ok: true, floor: 2, tall: true, sides: true, seat2: true, fine: true, wait: [], day: NOW.toISOString().slice(0, 10), now: NOW.toISOString(), lead: true, plan,
    staff: STAFF.filter((e) => e.restaurant === R0 && e.position === "waiter").map((e) => ({ id: e.id, name: full(e), position: e.position })), tables: rows } : { code: "PGRST202" };
  const d = typeof delay === "function" ? delay() : delay;
  return d ? { __delay: d, body: r } : r;
};
const openCall = async (page) => { await openTeam(page); await page.locator(".ch-bar [data-chat-callbtn]").click(); await sleep(400); };
const sheet = (page) => page.locator("[data-chat-callsheet]");
const send = (page) => sheet(page).locator("[data-chat-call-send]");
const lastCall = (calls) => (calls.filter((x) => x.fn === "chat_call").pop() || {}).body || {};
const nCalls = (calls) => calls.filter((x) => x.fn === "chat_call").length;
const inView = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0; }, sel);
const marks = (page) => sheet(page).locator("[data-call-floor] [data-table-mark]").count();

if (want("SERIES")) {
  const C = chatServer();
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: withBoard(C) });
  const o = await open({ who: OLGA, token: "tok-olga", rpcs: withBoard(C) });
  await sleep(5200);
  ok("SERIES: команда взята заранее, пока хостес на главной (chat_people до «Позвать»)", o.calls.some((x) => x.fn === "chat_people"));
  const row = o.page.locator('[data-now-row="call"]');
  ok("SERIES: на главной — строка «Позвать: официанта к столу»", /Позвать:\s*официанта к столу/.test(await txt(row)), await txt(row));
  await shot(o.page, "0-home");
  await row.click(); await sleep(900);
  const sh = sheet(o.page);
  ok("SERIES: лист поверх главной, сразу «К столу»", (await o.page.locator("[data-call-layer] [data-chat-callsheet]").count()) === 1
    && (await sh.locator('[data-chat-why="table"][aria-checked="true"]').count()) === 1);
  ok("SERIES: схема зала сразу, без поля номера", (await sh.locator("[data-call-floor] [data-table]").count()) === 8 && !(await sh.locator("[data-chat-table]").count()));
  const chips = await sh.locator("[data-call-person]").allInnerTexts();
  ok("SERIES: «Кого» — кто в смене: официанты первыми, Веры (не в смене) нет", chips.join(",") === "Анна С.,Пётр О.,Илья Б.,Мария К.", chips.join(","));
  ok("SERIES: кнопка подписана, чего не хватает", (await txt(send(o.page))) === "Выбери стол и кого позвать" && /\bwait\b/.test(await send(o.page).getAttribute("class")));
  ok("SERIES: кнопка «Позвать…» видна без прокрутки", await inView(o.page, "[data-chat-call-send]"));
  await shot(o.page, "1-open");
  await sh.locator('[data-call-floor] [data-table="t5"]').click(); await sleep(200);
  ok("SERIES: стол 5 — «Выбери, кого позвать»", (await txt(send(o.page))) === "Выбери, кого позвать");
  await sh.locator('[data-call-person="e-anna"]').click(); await sleep(200);
  ok("SERIES: + Анна — «Позвать Анну к столу 5»", (await txt(send(o.page))) === "Позвать Анну к столу 5");
  await shot(o.page, "2-ready");
  await send(o.page).click(); await sleep(900);
  let cc = lastCall(o.calls);
  ok("SERIES: на сервер — Анне лично, к столу 5", cc.p_who === "person" && cc.p_emp === "e-anna" && cc.p_why === "table" && cc.p_table === "5", JSON.stringify(cc));
  ok("SERIES: лист открыт, «Позвали Анну к столу 5», «позвали: 1»", (await sh.count()) === 1 && (await txt(sh.locator('[data-call-last="sent"]'))) === "Позвали Анну к столу 5"
    && (await txt(sh.locator("[data-call-count]"))) === "позвали: 1");
  ok("SERIES: у стола 5 колокольчик, выбор сброшен", (await marks(o.page)) === 1 && (await sh.locator('[data-table="t5"] [data-table-mark]').count()) === 1
    && (await txt(send(o.page))) === "Выбери стол и кого позвать" && !(await sh.locator('[data-call-person][aria-checked="true"]').count()));
  await shot(o.page, "3-sent");
  const t0 = Date.now();
  await sh.locator('[data-call-floor] [data-table="t7"]').click(); await sh.locator('[data-call-person="e-petr"]').click(); await sleep(150);
  ok("SERIES: следом стол 7 + Пётр — «Позвать Петра к столу 7»", (await txt(send(o.page))) === "Позвать Петра к столу 7");
  await send(o.page).click(); await sleep(900);
  cc = lastCall(o.calls);
  ok("SERIES: второй вызов ушёл сразу, без «подожди» (" + Math.round((Date.now() - t0) / 100) / 10 + " с)", cc.p_emp === "e-petr" && cc.p_table === "7" && (await txt(sh.locator('[data-call-last="sent"]'))) === "Позвали Петра к столу 7"
    && !(await sh.locator("[data-call-err]").count()), JSON.stringify(cc));
  ok("SERIES: колокольчики у столов 5 и 7, «позвали: 2»", (await marks(o.page)) === 2 && (await txt(sh.locator("[data-call-count]"))) === "позвали: 2");
  await sh.locator('[data-call-floor] [data-table="t5"]').click(); await sleep(150);
  // v215 (Доп. 541): метка говорит, что с вызовом — «позвали Анну, ждём» (было «позвали Анну только что»)
  ok("SERIES: стол 5 снова — под схемой «позвали Анну, ждём»", /позвали Анну, ждём/.test(await txt(sh.locator("[data-call-picked]"))), await txt(sh.locator("[data-call-picked]")));
  await sh.locator('[data-call-person="e-anna"]').click(); await send(o.page).click(); await sleep(900);
  ok("SERIES: Анну к столу 5 ещё раз — «уже позвали, ждём ответа», счёт тот же", (await txt(sh.locator('[data-call-last="again"]'))) === "Анну к столу 5 уже позвали, ждём ответа"
    && (await txt(sh.locator("[data-call-count]"))) === "позвали: 2");
  ok("SERIES: в чате два вызова, а не три", C.S.msgs.filter((m) => m.kind === "call").length === 2);
  await shot(o.page, "4-again");
  await sh.locator("[data-call-more]").click(); await sleep(300);
  ok("SERIES: «Другой…» — весь список с поиском, Вера «Официант» не в смене", (await sh.locator("[data-call-list] [data-chat-search]").count()) === 1
    && /Вера Соколова\s*Официант/.test(await txt(sh.locator('[data-call-list] [data-chat-person="e-vera"]'))));
  await sh.locator('[data-call-list] [data-chat-person="e-vera"]').click(); await sleep(200);
  await sh.locator('[data-call-floor] [data-table="t8"]').click(); await sleep(150);
  ok("SERIES: Вера выбрана — на кнопке «Другой…» её имя, «Позвать Веру к столу 8»", (await txt(sh.locator("[data-call-more]"))) === "Вера С." && (await sh.locator('[data-call-more][aria-checked="true"]').count()) === 1
    && (await txt(send(o.page))) === "Позвать Веру к столу 8");
  await wake(a.page); await sleep(1500);
  ok("SERIES: у Анны — «Ольга зовёт тебя: к столу 5» и «Иду»", /Ольга зовёт тебя: к столу 5/.test(await txt(a.page.locator("[data-chat-banner]"))), await txt(a.page.locator("[data-chat-banner]")));
  await sh.locator(".ch-sheet-h [data-sa-back]").click(); await sleep(500);
  ok("SERIES: закрыла — снова главная", !(await o.page.locator("[data-call-layer]").count()) && (await o.page.locator('[data-now-row="call"]').count()) === 1);
  await o.page.locator('[data-now-row="call"]').click(); await sleep(900);
  ok("SERIES: открыла снова — колокольчики у 5 и 7 на месте, счёт с нуля", (await marks(o.page)) === 2 && !(await sheet(o.page).locator("[data-call-count]").count()));
  ok("SERIES: без ошибок в консоли", !a.errors.length && !o.errors.length, [...a.errors, ...o.errors].slice(0, 3).join(" | "));
  await a.ctx.close(); await o.ctx.close();
}

if (want("SHIFT")) {
  const C = chatServer();
  let slow = 0;
  const o = await open({ who: OLGA, token: "tok-olga", rpcs: withBoard(C, { delay: () => slow }) });
  await sleep(4500);
  await nav(o.page, "shift", 2500);
  const btn = o.page.locator('[data-shift-role="host"] [data-role-call]');
  ok("SHIFT: «Смена» → «Зал сейчас» с кнопкой «Позвать к столу»", (await txt(btn)) === "Позвать к столу");
  await shot(o.page, "5-shift");
  slow = 2000;   // теперь сервер отвечает через 2 секунды: схема — из копии
  const t0 = Date.now();
  await btn.click(); await sleep(400);
  ok("SHIFT: нажатие не открыло «Рассадку», открылся лист", (await sheet(o.page).count()) === 1 && !(await o.page.locator("[data-floor-empty], [data-seat-summary]").count()));
  ok("SHIFT: схема сразу из копии (" + (Date.now() - t0) + " мс, сервер ещё думает)", (await sheet(o.page).locator("[data-call-floor] [data-table]").count()) === 8 && !(await sheet(o.page).locator("[data-call-board-wait]").count()));
  ok("SHIFT: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("SEAT")) {
  const C = chatServer();
  const o = await open({ who: OLGA, token: "tok-olga", rpcs: withBoard(C) });
  await sleep(4500);
  await nav(o.page, "seat", 2500);
  ok("SEAT: «Рассадка» — «Позвать» в шапке", (await txt(o.page.locator("[data-seat-call]"))) === "Позвать");
  await o.page.locator("[data-seat-call]").click(); await sleep(700);
  ok("SEAT: «Позвать» из шапки — лист без выбранного стола", (await sheet(o.page).count()) === 1 && (await txt(send(o.page))) === "Выбери стол и кого позвать");
  await sheet(o.page).locator(".ch-sheet-h [data-sa-back]").click(); await sleep(400);
  await o.page.locator('[data-floor] [data-table="t7"]').first().click(); await sleep(500);
  const card = o.page.locator('[data-table-sheet="t7"]');
  ok("SEAT: карточка стола 7 — «Позвать к столу 7»", (await txt(card.locator("[data-sheet-call]"))) === "Позвать к столу 7");
  await card.locator("[data-sheet-call]").scrollIntoViewIfNeeded(); await shot(o.page, "6-seat-card");
  await card.locator("[data-sheet-call]").click(); await sleep(800);
  ok("SEAT: карточка закрылась, лист со столом 7: «Выбери, кого позвать»", !(await o.page.locator("[data-table-sheet]").count()) && (await txt(send(o.page))) === "Выбери, кого позвать"
    && /^Стол 7/.test(await txt(sheet(o.page).locator("[data-call-picked]"))));
  await shot(o.page, "7-seat-sheet");
  await sheet(o.page).locator('[data-call-person="e-petr"]').click(); await send(o.page).click(); await sleep(900);
  const cc = lastCall(o.calls);
  ok("SEAT: Пётр → на сервер к столу 7", cc.p_emp === "e-petr" && cc.p_table === "7" && (await txt(sheet(o.page).locator('[data-call-last="sent"]'))) === "Позвали Петра к столу 7", JSON.stringify(cc));
  ok("SEAT: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("CHAT")) {
  const C = chatServer();
  const o = await open({ who: OLGA, token: "tok-olga", rpcs: withBoard(C) });
  await sleep(4800);
  await openTeam(o.page);
  await o.page.locator(".ch-bar [data-chat-callbtn]").click(); await sleep(900);
  const sh = sheet(o.page);
  await sh.locator('[data-call-floor] [data-table="t1"]').click(); await sh.locator('[data-call-person="e-anna"]').click(); await send(o.page).click(); await sleep(900);
  await sh.locator('[data-call-floor] [data-table="t2"]').click(); await sh.locator('[data-chat-who="waiter"]').click(); await sleep(150);
  ok("CHAT: по должности — «Позвать официанта к столу 2»", (await txt(send(o.page))) === "Позвать официанта к столу 2");
  await send(o.page).click(); await sleep(900);
  ok("CHAT: после вызова должность осталась выбранной, стол сброшен", (await sh.locator('[data-chat-who="waiter"][aria-checked="true"]').count()) === 1 && (await txt(send(o.page))) === "Выбери стол на схеме");
  await sh.locator(".ch-sheet-h [data-sa-back]").click(); await sleep(600);
  const feed = await o.page.locator("[data-chat-call]").allInnerTexts();
  ok("CHAT: в ленте оба вызова", feed.some((t) => /Ольга зовёт Анну: к столу 1/.test(t)) && feed.some((t) => /Ольга зовёт официанта: к столу 2/.test(t)), feed.join(" | ").slice(0, 300));
  await shot(o.page, "8-chat-feed");
  ok("CHAT: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("OLD")) {
  const C = chatServer({ old: true });
  const o = await open({ who: OLGA, token: "tok-olga", rpcs: withBoard(C) });
  await sleep(4800);
  await o.page.locator('[data-now-row="call"]').click(); await sleep(900);
  const sh = sheet(o.page);
  await sh.locator('[data-call-floor] [data-table="t1"]').click(); await sh.locator('[data-call-person="e-anna"]').click(); await send(o.page).click(); await sleep(800);
  await sh.locator('[data-call-floor] [data-table="t2"]').click(); await sh.locator('[data-call-person="e-petr"]').click(); await send(o.page).click(); await sleep(800);
  ok("OLD: сервер без этапа 68 — «Только что был вызов: подожди полминуты.», выбор не сброшен", (await txt(sh.locator("[data-call-err]"))) === "Только что был вызов: подожди полминуты."
    && (await txt(send(o.page))) === "Позвать Петра к столу 2");
  ok("OLD: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("LOOK")) {
  for (const [light, w, hh] of [[false, 393, 852], [true, 393, 852], [false, 360, 640], [true, 360, 740]]) {
    const tag = "LOOK" + (light ? " светлая" : "") + " " + w + "×" + hh;
    const C = chatServer();
    const o = await open({ who: OLGA, token: "tok-olga", light, w, h: hh, rpcs: withBoard(C) });
    await sleep(4800);
    await o.page.locator('[data-now-row="call"]').click(); await sleep(900);
    const sh = sheet(o.page);
    await sh.locator('[data-call-floor] [data-table="t5"]').click(); await sh.locator('[data-call-person="e-anna"]').click(); await send(o.page).click(); await sleep(800);
    await sh.locator('[data-call-floor] [data-table="t3"]').click(); await sh.locator('[data-call-person="e-petr"]').click(); await sleep(200);
    const f = await fits(o.page, "[data-chat-callsheet] *");
    ok(tag + ": без прокрутки вбок", f.over === 0, JSON.stringify(f));
    ok(tag + ": кнопка «Позвать Петра к столу 3» видна без прокрутки", await inView(o.page, "[data-chat-call-send]") && (await txt(send(o.page))) === "Позвать Петра к столу 3");
    ok(tag + ": строка «Позвали Анну к столу 5» видна над кнопкой", await inView(o.page, '[data-call-last="sent"]'));
    await shot(o.page, "look-" + (light ? "light-" : "") + w + "x" + hh);
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

await browser.close();
server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
