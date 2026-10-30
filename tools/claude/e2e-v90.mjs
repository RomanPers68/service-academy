// e2e v90 (Доп. 403): чат смены. Сервер чата — в памяти скрипта (как этап 38): кто зовёт — по токену, два человека
// в двух окнах видят переписку друг друга.
// Разделы:
//   TOP     — значок чата (с v91 — круг у нижнего меню, не в верхней строке), число непрочитанных; пункт «Чат смены»
//             в «Смене» с числом;
//             на экзамене значка нет; обе темы; 320 px — верхняя строка без прокрутки вбок;
//   FLOW    — Анна и Мария: Анна пишет в «Вся команда» → Мария видит; Мария отвечает с цитатой (лист «Ответить»), ставит
//             «Принято», закрепляет сообщение Анны, шлёт фото → у Анны цитата, реакция, полоска закрепа, строка «Мария
//             закрепляет…», фото (превью и на весь экран); Анна правит своё → у Марии «изменено»; свайп пальцем — ответ;
//             Escape закрывает лист; личная переписка; без ошибок в консоли;
//   CALL    — Мария зовёт Анну лично → у Анны на главной баннер «Мария зовёт тебя: подойди ко мне» → «Иду» → баннер
//             ушёл, у Марии в ленте «Идёт: Анна С.»;
//   NET     — «Руководители сети»: у старшей Океана и у менеджера Порта один чат, у официанта его нет; в пузыре
//             «Мария К. · Океан»; число непрочитанных у Ирины;
//   LINK    — ссылка бота ?go=chat открывает чат;
//   MISSING — сервер без этапа 38: значка и пункта нет, ошибок нет;
//   NARROW  — 320 px: переписка с закрепом, фото, реакциями и цитатой без прокрутки вбок; обе темы.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v90.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5290, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v90";
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

if (want("TOP")) {
  for (const light of [false, true]) {
    const tag = "TOP" + (light ? " светлая" : "");
    const C = chatServer();
    const o = await open({ who: ANNA, token: "tok-anna", light, rpcs: C.rpc });
    await sleep(4800);
    // v91 (Доп. 404): значок переехал из верхней строки в круг рядом с нижним меню (подробно — e2e-v91, DOCK)
    const b = o.page.locator("[data-chat-dock]");
    ok(tag + ": значок чата — круг у нижнего меню (в верхней строке его нет)", (await b.count()) === 1 && !(await o.page.locator('[data-sa-topbar] [aria-label^="Чат смены"]').count()) && (await o.page.locator("[data-top-search]").count()) === 1);
    ok(tag + ": число непрочитанных — 2 (Мария и Ольга)", (await o.page.locator('[data-chat-dock-n="2"]').count()) === 1 && /непрочитанных 2/.test(await b.getAttribute("aria-label")));
    const first = o.calls.find((x) => x.fn === "chat_unread");
    ok(tag + ": непрочитанные спрашиваются не при старте, а через 4 секунды (старт — одним запросом)", !!first && first.t - o.t0 >= 3500, first ? first.t - o.t0 + " мс" : "нет");
    await shot(o.page, "top" + (light ? "-light" : ""));
    await nav(o.page, "shift", 1500);
    const item = o.page.locator("button, [role=button]").filter({ hasText: "Чат смены" }).first();
    ok(tag + ": «Смена» — пункт «Чат смены» с числом", /Чат смены Команда, старшие и личные сообщения 2$/.test(await txt(item)) && (await o.page.locator("[data-chat-dock]").count()) === 1, await txt(item));
    await item.click(); await sleep(900);
    ok(tag + ": пункт открывает чат", (await o.page.locator("[data-chat]").count()) === 1 && (await o.page.locator("[data-chat-item]").count()) === 1);
    await o.page.locator(".ch-head [data-sa-back]").click(); await sleep(500);
    ok(tag + ": «Назад» — чат закрыт", !(await o.page.locator("[data-chat]").count()));
    await nav(o.page, "exam", 1200);
    ok(tag + ": на экзамене значка чата нет", !(await o.page.locator("[data-chat-dock]").count()));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
  const C = chatServer();
  const o = await open({ who: MARIA, token: "tok-maria", w: 320, h: 640, rpcs: C.rpc });
  await sleep(4800);
  const f = await fits(o.page, "[data-sa-topbar] *");
  ok("TOP: 320 px — верхняя строка без прокрутки вбок, круг чата у меню", f.sw <= f.W && f.over === 0 && (await o.page.locator("[data-chat-dock]").count()) === 1, JSON.stringify(f));
  await shot(o.page, "top-320");
  await o.ctx.close();
}

if (want("FLOW")) {
  const C = chatServer();
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc });
  await sleep(4800);
  await openTeam(a.page);
  ok("FLOW: Анна — «Вся команда»: утро Марии и ответ Ольги с цитатой", /Ольга Л\. Мария К\. Доброе утро!/.test((await txt(a.page.locator("[data-chat-msg]").filter({ hasText: "накрою веранду" }))).replace(/\s+/g, " ")));
  await a.page.locator("[data-chat-input]").fill("Банкет переносится на 19:30?"); await a.page.locator("[data-chat-send]").click(); await sleep(900);
  ok("FLOW: Анна отправила — сообщение в ленте", (await bubble(a.page, "Банкет переносится").count()) === 1);
  await openTeam(m.page);
  ok("FLOW: Мария видит сообщение Анны", (await bubble(m.page, "Банкет переносится").count()) === 1);
  ok("FLOW: у Марии закрепа ещё нет", !(await m.page.locator("[data-chat-pinbar]").count()));
  // Мария: ответ с цитатой из листа
  await bubble(m.page, "Банкет переносится").click(); await sleep(400);
  ok("FLOW: лист сообщения у старшей — реакции, «Ответить», «Закрепить для всех», «Удалить у всех»", (await m.page.locator("[data-chat-react]").count()) === 6 && (await m.page.locator('[data-chat-pin="on"]').count()) === 1 && /Удалить у всех/.test(await txt(m.page.locator("[data-chat-del]"))));
  await m.page.locator('[data-chat-react="ok"]').click(); await sleep(500);
  await bubble(m.page, "Банкет переносится").click(); await sleep(300);
  await m.page.locator("[data-chat-reply]").click(); await sleep(300);
  ok("FLOW: «Ответить» — «Ответ: Анна С.»", /Ответ: Анна С\. Банкет переносится на 19:30\?/.test(await txt(m.page.locator("[data-chat-replybar]"))));
  await m.page.locator("[data-chat-input]").fill("Да, на 19:30. Гости предупреждены."); await m.page.locator("[data-chat-send]").click(); await sleep(700);
  await bubble(m.page, "Банкет переносится").click(); await sleep(300);
  await m.page.locator('[data-chat-pin="on"]').click(); await sleep(800);
  ok("FLOW: Мария закрепила — полоска «Анна: Банкет переносится…» и строка «Мария закрепляет…»", /Закреплено Анна: Банкет переносится/.test(await txt(m.page.locator("[data-chat-pinbar]"))) && (await m.page.locator("[data-chat-sys]").filter({ hasText: "Мария закрепляет «Банкет переносится" }).count()) === 1);
  await m.page.locator("[data-chat-file]").setInputFiles(PHOTO); await sleep(1500);
  ok("FLOW: фото — лист с превью", (await m.page.locator("[data-chat-photosheet] img.ch-shot").count()) === 1);
  await m.page.locator("[data-chat-caption]").fill("Схема веранды на вечер"); await m.page.locator("[data-chat-photo-send]").click(); await sleep(1600);
  ok("FLOW: фото ушло — в ленте Марии с подписью", (await m.page.locator("[data-chat-msg]").filter({ hasText: "Схема веранды" }).locator("[data-chat-photo] img").count()) === 1);
  const ph = C.S.log.filter((x) => x.fn === "chat_photo_send").pop();
  ok("FLOW: на сервер — сжатый JPEG и превью, размер, подпись", !!ph && /^\/9j\//.test(ph.b.p_full) && /^\/9j\//.test(ph.b.p_thumb) && ph.b.p_w <= 1280 && ph.b.p_h <= 1280 && ph.b.p_body === "Схема веранды на вечер"
    && ph.b.p_full.length * 0.75 <= 300 * 1024 && ph.b.p_thumb.length * 0.75 <= 48 * 1024, ph ? [ph.b.p_w, ph.b.p_h, Math.round(ph.b.p_full.length * 0.75 / 1024) + " КБ"].join(" ") : "");
  await shot(m.page, "flow-maria");
  // у Анны — всё это опросом
  await sleep(5200);
  await shot(a.page, "flow-anna");
  ok("FLOW: у Анны — ответ Марии с цитатой её сообщения", /Ты Банкет переносится на 19:30\?/.test(await txt(a.page.locator("[data-chat-msg]").filter({ hasText: "Гости предупреждены" }).locator("[data-chat-rq]"))));
  ok("FLOW: у Анны — «Принято» от Марии на её сообщении", (await a.page.locator("[data-chat-msg]").filter({ has: a.page.locator("[data-chat-bubble] > .ch-tx", { hasText: "Банкет переносится" }) }).locator('[data-chat-rx="ok"]').count()) === 1);
  ok("FLOW: у Анны — полоска закрепа и строка «Мария закрепляет…»", /Анна: Банкет переносится/.test(await txt(a.page.locator("[data-chat-pinbar]"))) && (await a.page.locator("[data-chat-sys]").count()) === 1);
  ok("FLOW: у Анны — фото с подписью (превью с сервера)", (await a.page.locator("[data-chat-msg]").filter({ hasText: "Схема веранды" }).locator("[data-chat-photo] img").count()) === 1);
  ok("FLOW: «прочитали» у Анны под своим", /прочитали [1-9] из 4/.test(await txt(a.page.locator("[data-chat-reads]"))), await txt(a.page.locator("[data-chat-reads]")));
  ok("FLOW: у Анны (официант) закреп не снять — крестика нет", !(await a.page.locator("[data-chat-unpin]").count()));
  await a.page.locator("[data-chat-msg]").filter({ hasText: "Схема веранды" }).locator("[data-chat-photo]").click(); await sleep(1200);
  ok("FLOW: фото на весь экран — полное с сервера, подпись", (await a.page.locator("[data-chat-viewer] img").count()) === 1 && C.S.log.some((x) => x.fn === "chat_photo" && x.b.p_full === true && x.b.p_token === "tok-anna"));
  await shot(a.page, "flow-viewer");
  await a.page.keyboard.press("Escape"); await sleep(300);
  ok("FLOW: Escape закрывает фото", !(await a.page.locator("[data-chat-viewer]").count()));
  // Анна правит своё → у Марии «изменено»
  await bubble(a.page, "Банкет переносится").click(); await sleep(300);
  ok("FLOW: у официанта в листе — «Изменить», без «Закрепить»", (await a.page.locator("[data-chat-edit]").count()) === 1 && !(await a.page.locator("[data-chat-pin]").count()));
  await a.page.locator("[data-chat-edit]").click(); await sleep(300);
  await a.page.locator("[data-chat-input]").fill("Банкет переносится на 19:30? Уточните, пожалуйста."); await a.page.locator("[data-chat-save]").click(); await sleep(800);
  ok("FLOW: Анна поправила — «изменено»", /изменено/.test(await txt(bubbleEl(a.page, "Уточните, пожалуйста"))));
  await sleep(4800);
  ok("FLOW: у Марии — новый текст и «изменено», закреп тоже обновился", /изменено/.test(await txt(bubbleEl(m.page, "Уточните, пожалуйста"))) && /Уточните, пожалуйста/.test(await txt(m.page.locator("[data-chat-pinbar]"))));
  // свайп пальцем — ответ
  await bubble(a.page, "Гости предупреждены").evaluate((e) => e.scrollIntoView({ block: "center" })); await sleep(250);
  const sb = await bubble(a.page, "Гости предупреждены").boundingBox();
  const cdp = await a.ctx.newCDPSession(a.page);
  const tp = (x) => [{ x: Math.round(x), y: Math.round(sb.y + sb.height / 2), radiusX: 4, radiusY: 4, force: 1, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(sb.x + 20) });
  for (let i = 1; i <= 12; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(sb.x + 20 + i * 9) }); await sleep(16); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(450);
  ok("FLOW: свайп пальцем по сообщению Марии — «Ответ: Мария К.»", /Ответ: Мария К\. Да, на 19:30/.test(await txt(a.page.locator("[data-chat-replybar]"))) && !(await a.page.locator("[data-chat-msgsheet]").count()));
  await a.page.keyboard.press("Escape"); await sleep(250);
  ok("FLOW: Escape — ответ отменён", !(await a.page.locator("[data-chat-replybar]").count()));
  ok("FLOW: экран не съехал вбок (Анна, Мария)", (await noShift(a.page)) && (await noShift(m.page)));
  // личная: Анна пишет Ольге
  await a.page.locator(".ch-head [data-sa-back]").click(); await sleep(500);
  await a.page.locator("[data-chat-write]").click(); await sleep(700);
  await shot(a.page, "flow-people");
  await a.page.locator('[data-chat-person="u-host"]').click(); await sleep(900);
  await shot(a.page, "flow-dm");
  ok("FLOW: личная с Ольгой — «Напиши первым», без закрепа", /Напиши первым/.test(await txt(a.page.locator("[data-chat-feed]"))) && !(await a.page.locator("[data-chat-pinbar]").count()));
  await a.page.locator("[data-chat-input]").fill("Оля, можешь подменить меня в субботу?"); await a.page.locator("[data-chat-send]").click(); await sleep(800);
  ok("FLOW: личное ушло", (await bubble(a.page, "подменить меня").count()) === 1 && C.S.chats.some((c) => c.kind === "dm"));
  ok("FLOW: без ошибок в консоли (Анна, Мария)", !a.errors.length && !m.errors.length, [...a.errors, ...m.errors].slice(0, 3).join(" | "));
  await a.ctx.close(); await m.ctx.close();
}

if (want("CALL")) {
  const C = chatServer();
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc });
  await sleep(4800);
  await openTeam(m.page);
  await m.page.locator(".ch-bar [data-chat-callbtn]").click(); await sleep(300);
  await m.page.locator('[data-chat-who="person"]').click(); await sleep(700);
  await m.page.locator('[data-chat-callsheet] [data-chat-person="e-anna"]').click(); await sleep(200);
  await m.page.locator('[data-chat-why="come"]').click(); await sleep(200);
  ok("CALL: «Позовёшь Анну: подойди ко мне»", (await txt(m.page.locator("[data-chat-preview]"))) === "Позовёшь Анну: подойди ко мне", await txt(m.page.locator("[data-chat-preview]")));
  await m.page.locator("[data-chat-call-send]").click(); await sleep(800);
  ok("CALL: у Марии — карточка вызова «Мария зовёт Анну: подойди ко мне», «Ждёт ответа»", /Мария зовёт Анну: подойди ко мне Ждёт ответа/.test(await txt(m.page.locator("[data-chat-call]").last())), await txt(m.page.locator("[data-chat-call]").last()));
  await wake(a.page); await sleep(1500);
  await shot(a.page, "call-banner");
  ok("CALL: у Анны на главной — баннер «Мария зовёт тебя: подойди ко мне» и «Иду»", /Мария зовёт тебя: подойди ко мне/.test(await txt(a.page.locator("[data-chat-banner]"))) && (await a.page.locator("[data-chat-banner-go]").count()) === 1);
  await a.page.locator("[data-chat-banner-go]").click(); await sleep(1200);
  ok("CALL: «Иду» — баннер ушёл, на сервере chat_go от Анны", !(await a.page.locator("[data-chat-banner]").count()) && C.S.log.some((x) => x.fn === "chat_go" && x.b.p_token === "tok-anna"));
  await sleep(4800);
  ok("CALL: у Марии — «Идёт: Анна С.»", /Идёт: Анна С\./.test(await txt(m.page.locator("[data-chat-call]").last())), await txt(m.page.locator("[data-chat-call]").last()));
  await shot(m.page, "call-going");
  ok("CALL: без ошибок в консоли", !a.errors.length && !m.errors.length, [...a.errors, ...m.errors].slice(0, 3).join(" | "));
  await a.ctx.close(); await m.ctx.close();
}

if (want("NET")) {
  const C = chatServer();
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc });
  const i = await open({ who: IRINA, token: "tok-irina", rpcs: C.rpc });
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await sleep(4800);
  await m.page.locator("[data-chat-dock]").click(); await sleep(900);
  ok("NET: у старшей Океана — «Вся команда», «Старшие», «Руководители сети»", (await m.page.locator("[data-chat-item]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chat-item")).join(","))) === "team,leads,net"
    && /Руководители сети/.test(await txt(m.page.locator('[data-chat-item="net"]'))));
  await m.page.locator('[data-chat-item="net"]').click(); await sleep(1200);
  ok("NET: шапка — «Руководители сети», «все заведения»", /Руководители сети/.test(await txt(m.page.locator("[data-chat-title]"))) && /все заведения/.test(await txt(m.page.locator(".ch-head .ch-st"))) && !(await m.page.locator(".ch-bar [data-chat-callbtn]").count()));
  await m.page.locator("[data-chat-input]").fill("Коллеги, в четверг общая планёрка в 11:00"); await m.page.locator("[data-chat-send]").click(); await sleep(800);
  await shot(m.page, "net-maria");
  await wake(i.page); await sleep(1500);
  ok("NET: у менеджера Порта на значке — непрочитанное из сети", (await i.page.locator('[data-chat-dock-n="1"]').count()) === 1);
  await i.page.locator("[data-chat-dock]").click(); await sleep(900);
  ok("NET: у Ирины — её «Вся команда» и «Руководители сети» (без «Старших» Океана)", (await i.page.locator("[data-chat-item]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chat-item")).join(","))) === "team,net");
  await i.page.locator('[data-chat-item="net"]').click(); await sleep(1200);
  ok("NET: у Ирины — сообщение Марии с подписью «Мария К. · Океан»", (await i.page.locator(".ch-nm").filter({ hasText: "Мария К. · Океан" }).count()) === 1 && (await bubble(i.page, "общая планёрка").count()) === 1);
  await shot(i.page, "net-irina");
  await bubble(i.page, "общая планёрка").click(); await sleep(300);
  ok("NET: Ирина (менеджер) может закрепить, но не удалить чужое", (await i.page.locator('[data-chat-pin="on"]').count()) === 1 && !(await i.page.locator("[data-chat-del]").count()));
  await i.page.keyboard.press("Escape"); await sleep(200);
  await a.page.locator("[data-chat-dock]").click(); await sleep(900);
  ok("NET: у официанта Океана «Руководителей сети» нет", !(await a.page.locator('[data-chat-item="net"]').count()) && (await a.page.locator('[data-chat-item="team"]').count()) === 1);
  ok("NET: без ошибок в консоли", !m.errors.length && !i.errors.length && !a.errors.length, [...m.errors, ...i.errors, ...a.errors].slice(0, 3).join(" | "));
  await m.ctx.close(); await i.ctx.close(); await a.ctx.close();
}

if (want("LINK")) {
  const C = chatServer();
  const o = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc, path: "/?go=chat" });
  await sleep(3200);
  ok("LINK: ?go=chat — чат открыт сразу", (await o.page.locator("[data-chat]").count()) === 1 && (await o.page.locator('[data-chat-item="team"]').count()) === 1);
  await o.ctx.close();
}

if (want("MISSING")) {
  const o = await open({ who: ANNA, token: "tok-anna", rpcs: (fn) => (/^chat_/.test(fn) ? { code: "PGRST202", message: "not found" } : undefined) });
  await sleep(4800);
  ok("MISSING: без этапа 38 — значка нет", !(await o.page.locator("[data-chat-dock]").count()) && (await o.page.locator("[data-top-search]").count()) === 1);
  await nav(o.page, "shift", 1500);
  ok("MISSING: в «Смене» пункта «Чат смены» нет", !(await o.page.locator("button, [role=button]").filter({ hasText: "Чат смены" }).count()));
  ok("MISSING: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("NARROW")) {
  for (const light of [false, true]) {
    const C = chatServer();
    const m = await open({ who: MARIA, token: "tok-maria", w: 320, h: 640, light, rpcs: C.rpc });
    await sleep(4800);
    await openTeam(m.page);
    await bubble(m.page, "Доброе утро").click(); await sleep(300);
    await m.page.locator('[data-chat-pin="on"]').click(); await sleep(700);
    await bubble(m.page, "накрою веранду").click(); await sleep(300);
    await m.page.locator('[data-chat-react="heart"]').click(); await sleep(400);
    await m.page.locator("[data-chat-file]").setInputFiles(PHOTO); await sleep(1500);
    await m.page.locator("[data-chat-photo-send]").click(); await sleep(1600);
    const f = await fits(m.page, "[data-chat] *");
    ok("NARROW" + (light ? " светлая" : "") + ": 320 px — закреп, фото, реакции, цитата без прокрутки вбок", f.sw <= f.W && f.over === 0 && (await noShift(m.page)), JSON.stringify(f));
    await shot(m.page, "narrow" + (light ? "-light" : ""));
    ok("NARROW" + (light ? " светлая" : "") + ": без ошибок в консоли", !m.errors.length, m.errors.slice(0, 3).join(" | "));
    await m.ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
