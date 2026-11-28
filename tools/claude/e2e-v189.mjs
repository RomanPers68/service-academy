// e2e v189 (Доп. 514): «Позвать» → «К столу» — стол выбирают на схеме зала (из «Рассадки»), а не вписывают номер.
// Владелец: «А может мы в функции «позвать официанта» добавим возможность выбора стола, к которому нужно подойти?»
// Разделы:
//   PICK   — Мария (старшая) в «Вся команда»: «Позвать» → «Официанта» → «К столу» — схема зала с залами вкладками;
//            нажала на стол 5 — он выбран, под схемой «Стол 5 · 4 места · гости, 3 гостя, 25 мин · официант Анна С.»,
//            кнопка «Позвать только Анну С.»; нажала — «Кого» стало «Анна», «Позовёшь Анну: к столу 5»; «Позвать» —
//            на сервер chat_call: person, Анна, к столу 5; у Анны баннер «Мария зовёт тебя: к столу 5»;
//   ZONE   — вкладка «Веранда» — её столы; стол 21 — бронь, кнопки «только …» нет; «Вписать номер» — поле, как раньше;
//   NOPLAN — сервер без рассадки (seat_board нет): «К столу» — поле номера, как раньше;
//   SHOW   — снимки листа «Позвать» целиком (высокий экран), обе темы;
//   LOOK   — обе темы, 360 точек без прокрутки вбок, снимки.
// Голова сценария — как в e2e-v90.mjs (сервер чата в памяти).
// v212 (Доп. 538): лист «Позвать» переделан (ui/call-sheet.jsx: сразу «К столу», люди кнопками, без строки «Позовёшь…»)
// — проверки листа здесь — по виду v189; нынешний лист проверяет e2e-v212.mjs.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v189.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5389, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v189";
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
  IRINA, { id: "e-ivan", name: "Иван", surname: "Петров", restaurant: "Порт", position: "waiter" }];
const TOK = { "tok-anna": ANNA, "tok-maria": MARIA, "tok-olga": OLGA, "tok-irina": IRINA };
const ukOf = (p) => "_" + p.name + "_" + p.surname;
const full = (p) => p.name + " " + p.surname;
const LEADS = ["manager", "senior", "owner", "admin", "service_manager", "head"];
const isLead = (p) => !!p.is_admin || LEADS.includes(p.position);

// ── сервер чата в памяти: те же ответы, что у этапа 38 ──
function chatServer() {
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
    if (fn === "chat_people") return { ok: true, people: STAFF.filter((e) => e.id !== p.id && e.restaurant === p.restaurant).map((e) => ({ id: e.id, name: full(e), pos: e.position, shift: e.id !== "e-petr" })) };
    if (fn === "chat_call") {
      const c = S.chats[0], to = b.p_who === "person" ? STAFF.find((e) => e.id === b.p_emp) : null;
      const k = { who: b.p_who, emp: to ? to.id : null, to_name: to ? full(to) : "", why: b.p_why, table: b.p_table || "", text: b.p_text || "", going: [] };
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
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    let body = {}; try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) {}
    if (/\/functions\/v1\//.test(u)) return route.abort();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m) {
      calls.push({ fn: m[1], body, t: Date.now() });
      const own = rpcs(m[1], body);
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
const withBoard = (C, { plan = PLAN, rows = ROWS } = {}) => (fn, b) => (fn === "seat_board"
  ? (plan ? { ok: true, floor: 2, tall: true, sides: true, seat2: true, fine: true, wait: [], day: NOW.toISOString().slice(0, 10), now: NOW.toISOString(), lead: true, plan, staff: [], tables: rows } : { code: "PGRST202" })
  : C.rpc(fn, b));
const openCall = async (page) => { await openTeam(page); await page.locator(".ch-bar [data-chat-callbtn]").click(); await sleep(400); };
const sheet = (page) => page.locator("[data-chat-callsheet]");

if (want("PICK")) {
  const C = chatServer();
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: withBoard(C) });
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: withBoard(C) });
  await sleep(4800);
  await openCall(m.page);
  await m.page.locator('[data-chat-who="waiter"]').click(); await sleep(150);
  await m.page.locator('[data-chat-why="table"]').click(); await sleep(1200);
  const sh = sheet(m.page);
  ok("PICK: «К столу» — схема зала вместо поля номера, залы вкладками", (await sh.locator("[data-call-floor] [data-floor]").count()) === 1 && !(await sh.locator("[data-chat-table]").count())
    && (await sh.locator("[data-call-zone]").count()) === 2 && (await sh.locator("[data-call-floor] [data-table]").count()) === 8);
  ok("PICK: пока стол не выбран — «Нажми на стол на схеме.»", /Нажми на стол на схеме\./.test(await txt(sh.locator("[data-call-tables]"))));
  await sh.locator("[data-call-tables]").scrollIntoViewIfNeeded(); await sleep(200);
  await shot(m.page, "1-map");
  await sh.locator('[data-call-floor] [data-table="t5"]').click(); await sleep(300);
  const line = await txt(sh.locator("[data-call-picked]"));
  ok("PICK: нажала на 5 — «Стол 5 · 4 места · гости, 3 гостя, 25 мин · официант Анна С.»", line.replace(/\u00a0/g, " ") === "Стол 5 · 4 места · гости, 3 гостя, 25 мин · официант Анна С.", line);
  ok("PICK: стол 5 выбран на схеме (золотом), другие — нет", (await sh.locator('[data-call-floor] [data-table="t5"]').getAttribute("data-hi")) === "1" && (await sh.locator('[data-call-floor] [data-hi="1"]').count()) === 1);
  ok("PICK: «Позовёшь официанта: к столу 5»", (await txt(sh.locator("[data-chat-preview]"))) === "Позовёшь официанта: к столу 5", await txt(sh.locator("[data-chat-preview]")));
  ok("PICK: кнопка «Позвать только Анну С.»", (await txt(sh.locator('[data-call-own="e-anna"]'))) === "Позвать только Анну С.");
  await sh.locator("[data-call-picked]").scrollIntoViewIfNeeded(); await sleep(200);
  await shot(m.page, "2-picked");
  await sh.locator('[data-call-own="e-anna"]').click(); await sleep(250);
  ok("PICK: «Позвать только…» — список людей не раскрылся, схема на месте", !(await sh.locator("[data-chat-person]").count()) && (await sh.locator("[data-call-floor]").count()) === 1);
  ok("PICK: «Позвать только…» — в «Кого» Анна, «Позовёшь Анну: к столу 5»", (await sh.locator('[data-chat-who="person"][aria-checked="true"]').count()) === 1 && /Анна/.test(await txt(sh.locator('[data-chat-who="person"]')))
    && (await txt(sh.locator("[data-chat-preview]"))) === "Позовёшь Анну: к столу 5", await txt(sh.locator("[data-chat-preview]")));
  await sh.locator("[data-chat-call-send]").scrollIntoViewIfNeeded(); await sleep(200);
  await shot(m.page, "3-anna");
  await sh.locator("[data-chat-call-send]").click(); await sleep(900);
  const cc = m.calls.filter((x) => x.fn === "chat_call").pop() || {};
  ok("PICK: на сервер — chat_call: лично Анне, к столу 5", cc.body && cc.body.p_who === "person" && cc.body.p_emp === "e-anna" && cc.body.p_why === "table" && cc.body.p_table === "5", JSON.stringify(cc.body));
  await shot(m.page, "4-feed");
  await wake(a.page); await sleep(1500);
  ok("PICK: у Анны — «Мария зовёт тебя: к столу 5» и «Иду»", /Мария зовёт тебя: к столу 5/.test(await txt(a.page.locator("[data-chat-banner]"))), await txt(a.page.locator("[data-chat-banner]")));
  await shot(a.page, "5-banner");
  ok("PICK: без ошибок в консоли", !a.errors.length && !m.errors.length, [...a.errors, ...m.errors].slice(0, 3).join(" | "));
  await a.ctx.close(); await m.ctx.close();
}

if (want("ZONE")) {
  const C = chatServer();
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: withBoard(C) });
  await sleep(4800);
  await openCall(m.page);
  await m.page.locator('[data-chat-who="waiter"]').click(); await m.page.locator('[data-chat-why="table"]').click(); await sleep(1200);
  const sh = sheet(m.page);
  await sh.locator('[data-call-zone="z2"]').click(); await sleep(250);
  ok("ZONE: «Веранда» — её три стола", (await sh.locator("[data-call-floor] [data-table]").count()) === 3);
  await sh.locator('[data-call-floor] [data-table="t21"]').click(); await sleep(250);
  ok("ZONE: стол 21 — «бронь на 20:00», кнопки «только …» нет", (await txt(sh.locator("[data-call-picked]"))) === "Стол 21 · 6 мест · бронь на 20:00" && !(await sh.locator("[data-call-own]").count()), await txt(sh.locator("[data-call-picked]")));
  await sh.locator("[data-call-manual]").click(); await sleep(250);
  ok("ZONE: «Вписать номер» — поле номера, как раньше", (await sh.locator("[data-chat-table]").count()) === 1 && !(await sh.locator("[data-call-floor]").count()));
  ok("ZONE: без ошибок в консоли", !m.errors.length, m.errors.slice(0, 3).join(" | "));
  await m.ctx.close();
}

if (want("NOPLAN")) {
  const C = chatServer();
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: withBoard(C, { plan: null }) });
  await sleep(4800);
  await openCall(m.page);
  await m.page.locator('[data-chat-why="table"]').click(); await sleep(800);
  ok("NOPLAN: рассадки нет — «К столу» с полем номера, как раньше", (await sheet(m.page).locator("[data-chat-table]").count()) === 1 && !(await sheet(m.page).locator("[data-call-floor]").count()));
  ok("NOPLAN: без ошибок в консоли", !m.errors.length, m.errors.slice(0, 3).join(" | "));
  await m.ctx.close();
}

// снимки для владельца: высокий экран, чтобы лист «Позвать» был виден целиком
if (want("SHOW")) {
  for (const light of [false, true]) {
    const C = chatServer();
    const m = await open({ who: MARIA, token: "tok-maria", light, h: 1480, rpcs: withBoard(C) });
    await sleep(4800);
    await openCall(m.page);
    await m.page.locator('[data-chat-who="waiter"]').click(); await m.page.locator('[data-chat-why="table"]').click(); await sleep(1200);
    await sheet(m.page).locator('[data-call-floor] [data-table="t5"]').click(); await sleep(300);
    await sheet(m.page).evaluate((e) => { e.scrollTop = 0; }); await sleep(150);
    await shot(m.page, "show-picked" + (light ? "-light" : ""));
    ok("SHOW" + (light ? " светлая" : "") + ": кнопка «Позвать только Анну С.» видна", await sheet(m.page).locator('[data-call-own="e-anna"]').isVisible());
    if (!light) {
      await sheet(m.page).locator('[data-call-own="e-anna"]').click(); await sleep(300);
      await sheet(m.page).evaluate((e) => { e.scrollTop = 0; }); await sleep(150);
      await shot(m.page, "show-anna");
    }
    await m.ctx.close();
  }
}

if (want("LOOK")) {
  for (const [light, w] of [[false, 393], [true, 393], [false, 360]]) {
    const tag = "LOOK" + (light ? " светлая" : "") + (w !== 393 ? " " + w : "");
    const C = chatServer();
    const m = await open({ who: MARIA, token: "tok-maria", light, w, rpcs: withBoard(C) });
    await sleep(4800);
    await openCall(m.page);
    await m.page.locator('[data-chat-who="waiter"]').click(); await m.page.locator('[data-chat-why="table"]').click(); await sleep(1200);
    await sheet(m.page).locator('[data-call-floor] [data-table="t5"]').click(); await sleep(250);
    const f = await fits(m.page, "[data-chat-callsheet] *");
    ok(tag + ": лист «Позвать» со схемой — без прокрутки вбок", f.over === 0, JSON.stringify(f));
    await sheet(m.page).locator("[data-call-picked]").scrollIntoViewIfNeeded(); await sleep(200);
    if (light || w !== 393) await shot(m.page, "look" + (light ? "-light" : "") + (w !== 393 ? "-" + w : ""));
    ok(tag + ": без ошибок в консоли", !m.errors.length, m.errors.slice(0, 3).join(" | "));
    await m.ctx.close();
  }
}

await browser.close();
server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
