// e2e v92 (Доп. 405): свои чаты — руководитель и старший заводят чат с названием и выбранными коллегами. Сервер чата —
// в памяти скрипта (как этап 38).
// Разделы:
//   NEW    — «Написать» → «Новый чат» у старшей есть, у официанта нет; название и галочки, «Создать чат · 3 человека»;
//            чат открывается, в списке — после «Руководителей сети», буквы названия; у участницы (Анна) — тоже;
//   MANAGE — нажатие на шапку: участники; старшая переименовывает, добавляет (в списке только тех, кого нет) и убирает;
//            убранная видит «Этого чата у тебя больше нет»; у официанта в участниках нет «Убрать» и «Удалить»;
//            официант выходит сам; старшая удаляет чат у всех;
//   NARROW — 320 px: новый чат и участники без прокрутки вбок, обе темы.
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v92.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5292, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v92";
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

// ── сервер чата в памяти: те же ответы, что у этапа 38 (v91: chat_clear, cleared, удалённое; v92: свои чаты) ──
function chatServer() {
  const S = { chats: [{ id: 1, kind: "team", rest: R0, pin: null }, { id: 2, kind: "leads", rest: R0, pin: null }, { id: 3, kind: "net", rest: "", pin: null }, { id: 4, kind: "team", rest: "Порт", pin: null }],
    msgs: [], reads: {}, photos: {}, seq: 100, pseq: 500, log: [] };
  const now = () => new Date().toISOString();
  const visible = (c, p) => !!c && (c.kind === "net" ? isLead(p) : c.kind === "dm" || c.kind === "group" ? c.members.includes(p.id) && (c.kind === "dm" || c.rest === p.restaurant)
    : c.rest === p.restaurant && (c.kind === "team" || isLead(p)));
  const members = (c) => STAFF.filter((e) => (c.kind === "net" ? isLead(e) : c.kind === "dm" || c.kind === "group" ? c.members.includes(e.id) : e.restaurant === c.rest && (c.kind === "team" || isLead(e))));
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
    const last = [...S.msgs].reverse().find((m) => m.chat === c.id && !m.del);
    const peer = c.kind === "dm" ? STAFF.find((e) => e.id === c.members.find((x) => x !== p.id)) : null;
    return { id: c.id, kind: c.kind, members: members(c).length, shift: c.kind === "team" || c.kind === "leads" ? 3 : null, peer: peer ? { id: peer.id, name: full(peer), pos: peer.position, shift: true } : null,
      last: last ? J(last) : null, unread: unread(c, p), cleared: c.cleared || null, title: c.kind === "group" ? c.title : null, owner: c.kind === "group" ? c.owner : null };
  };
  const whyText = (k) => ({ who: { lead: "менеджера", host: "хостес", bar: "бар", waiter: "официанта" }[k.who] || (k.to_name || "").split(" ")[0], why: { table: "к столу " + (k.table || ""), help: "нужна помощь", come: "подойди ко мне", guest: "гость ждёт", own: k.text || "" }[k.why] });
  const rpc = (fn, b) => {
    if (!/^chat_/.test(fn)) return undefined;
    S.log.push({ fn, b });
    const p = TOK[b.p_token];
    if (!p) return { ok: false, error: "auth" };
    const chat = (id) => S.chats.find((c) => c.id === Number(id));
    if (fn === "chat_list") {
      const list = S.chats.filter((c) => visible(c, p) && (c.kind !== "dm" || S.msgs.some((m) => m.chat === c.id && !m.del))).map((c) => view(c, p));
      list.sort((x, y) => ({ team: 0, leads: 1, net: 2, group: 3, dm: 4 })[x.kind] - ({ team: 0, leads: 1, net: 2, group: 3, dm: 4 })[y.kind]);
      return { ok: true, me: { id: p.id, name: full(p), pos: p.position, lead: isLead(p), network: !!p.is_admin || p.position === "senior", restaurant: p.restaurant }, chats: list,
        unread: list.reduce((s, c) => s + c.unread, 0), calls: calls(p) };
    }
    if (fn === "chat_unread") return { ok: true, unread: S.chats.filter((c) => visible(c, p)).reduce((s, c) => s + unread(c, p), 0), calls: calls(p) };
    if (fn === "chat_open") {
      const c = chat(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
      let list = S.msgs.filter((m) => m.chat === c.id), more = false;
      if (b.p_before) { list = list.filter((m) => m.id < b.p_before && !m.del); more = list.length > 40; list = list.slice(-40); }
      else if (b.p_after) list = list.filter((m) => m.id > b.p_after || (b.p_since && Date.parse(m.upd) >= Date.parse(b.p_since) - 5000));
      else { list = list.filter((m) => !m.del); more = list.length > 60; list = list.slice(-60); }
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
      if ((c.kind === "team" || c.kind === "group") && !isLead(p)) return { ok: false, error: "forbidden" };
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
    // v92: свои чаты
    const pick = (ids) => [...new Set((ids || []).map(String))].filter((id) => id !== p.id && STAFF.some((e) => e.id === id && e.restaurant === p.restaurant));
    const out = (c) => ({ ok: true, chat: view(c, p), members: members(c).map((e) => ({ id: e.id, name: full(e), pos: e.position })) });
    if (fn === "chat_group_create") {
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      const t = String(b.p_title || "").replace(/\s+/g, " ").trim().slice(0, 40), who = pick(b.p_emps);
      if (!t || !who.length) return { ok: false, error: "bad_request" };
      const c = { id: 100 + S.chats.length, kind: "group", rest: p.restaurant, title: t, owner: p.id, members: [p.id, ...who], pin: null };
      S.chats.push(c); S.added = (S.added || []).concat(who.map((w) => [c.id, w]));
      return out(c);
    }
    if (fn === "chat_group_edit" || fn === "chat_group_leave" || fn === "chat_group_delete") {
      const c = chat(b.p_chat); if (!c || c.kind !== "group" || !visible(c, p)) return { ok: false, error: "not_found" };
      if (fn === "chat_group_leave") { c.members = c.members.filter((x) => x !== p.id); if (!c.members.length) S.chats = S.chats.filter((x) => x !== c); return { ok: true }; }
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      if (fn === "chat_group_delete") { S.chats = S.chats.filter((x) => x !== c); S.msgs = S.msgs.filter((m) => m.chat !== c.id); return { ok: true }; }
      if (b.p_title != null) { const t = String(b.p_title).replace(/\s+/g, " ").trim().slice(0, 40); if (!t) return { ok: false, error: "bad_request" }; c.title = t; }
      if (b.p_remove) c.members = c.members.filter((x) => x === p.id || !b.p_remove.map(String).includes(x));
      if (b.p_add) { const add = pick(b.p_add).filter((x) => !c.members.includes(x)); c.members.push(...add); S.added = (S.added || []).concat(add.map((w) => [c.id, w])); }
      return out(c);
    }
    if (fn === "chat_clear") {
      const c = chat(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
      if (!(c.kind === "dm" || (c.kind === "net" ? !!p.is_admin || p.position === "senior" : isLead(p)))) return { ok: false, error: "forbidden" };
      const n = S.msgs.filter((m) => m.chat === c.id).length;
      S.msgs = S.msgs.filter((m) => m.chat !== c.id); c.pin = null; c.cleared = now();
      return { ok: true, removed: n, cleared: c.cleared };
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



const H = 852;
const toList = async (page) => { for (let i = 0; i < 3 && !(await page.locator("[data-chat-write]").count()); i++) { await page.locator("[data-chat] .ch-head .ch-back").first().click(); await sleep(500); } };
async function createBar(m, names = ["e-ilya", "e-anna"]) {
  await m.page.locator("[data-chat-dock]").click(); await sleep(900);
  await m.page.locator("[data-chat-write]").click(); await sleep(900);
  await m.page.locator("[data-chat-newgroup]").click(); await sleep(900);
  await m.page.locator("[data-chat-gtitle]").fill("  Бар  ");
  for (const id of names) { await m.page.locator(`[data-chat-person="${id}"]`).click(); await sleep(120); }
}

if (want("NEW")) {
  const C = chatServer();
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await a.page.locator("[data-chat-dock]").click(); await sleep(900);
  await a.page.locator("[data-chat-write]").click(); await sleep(900);
  ok("NEW: у официанта в «Написать» нет «Новый чат»", !(await a.page.locator("[data-chat-newgroup]").count()) && (await a.page.locator("[data-chat-person]").count()) === 4);
  await toList(a.page);
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc });
  await m.page.locator("[data-chat-dock]").click(); await sleep(900);
  await m.page.locator("[data-chat-write]").click(); await sleep(900);
  ok("NEW: у старшей в «Написать» первым — «Новый чат»", /Новый чат название и несколько коллег/.test(await txt(m.page.locator("[data-chat-newgroup]"))));
  await m.page.locator("[data-chat-newgroup]").click(); await sleep(900);
  const go = m.page.locator("[data-chat-gcreate]");
  ok("NEW: без названия и людей — «Дай чату название», кнопка не нажимается", /Дай чату название/.test(await txt(go)) && (await go.isDisabled()));
  await m.page.locator("[data-chat-gtitle]").fill("  Бар  ");
  ok("NEW: с названием, но без людей — «Отметь коллег»", /Отметь коллег/.test(await txt(go)) && (await go.isDisabled()));
  await m.page.locator('[data-chat-person="e-ilya"]').click(); await m.page.locator('[data-chat-person="e-anna"]').click(); await m.page.locator('[data-chat-person="u-host"]').click(); await m.page.locator('[data-chat-person="u-host"]').click(); await sleep(200);
  ok("NEW: галочки — двое отмечены (повторное нажатие снимает), «Создать чат · 3 человека»", (await m.page.locator('[data-chat-person][aria-pressed="true"]').count()) === 2 && /Создать чат · 3 человека/.test(await txt(go)) && !(await go.isDisabled()) && (await m.page.locator('[data-chat-gcount="2"]').count()) === 1);
  await shot(m.page, "new-form");
  await go.click(); await sleep(1300);
  ok("NEW: чат создан и открыт: «Бар», 3 человека", (await txt(m.page.locator("[data-chat-title]"))) === "Бар" && /3 человека · участники/.test(await txt(m.page.locator(".ch-head .ch-st"))));
  const g = C.S.chats.find((c) => c.kind === "group");
  ok("NEW: на сервере — название без пробелов по краям, участники: Мария, Илья, Анна", !!g && g.title === "Бар" && g.members.join(",") === "u-lead,e-ilya,e-anna");
  await m.page.locator("[data-chat-input]").fill("Коллеги, сегодня закрываем бар в 23:00"); await m.page.locator("[data-chat-send]").click(); await sleep(900);
  await toList(m.page);
  const kinds = await m.page.locator("[data-chat-item]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chat-item")));
  ok("NEW: в списке — после «Руководителей сети», с буквой названия", kinds.join(",") === "team,leads,net,group" && (await txt(m.page.locator('[data-chat-item="group"] .ch-ava'))) === "Б", kinds.join(","));
  await shot(m.page, "new-list");
  await toList(a.page); await sleep(10500);
  ok("NEW: у Анны (участница) «Бар» появился в списке с непрочитанным", (await a.page.locator('[data-chat-item="group"]').count()) === 1 && /Бар/.test(await txt(a.page.locator('[data-chat-item="group"]'))) && (await a.page.locator('[data-chat-item="group"] [data-chat-unread="1"]').count()) === 1);
  const o = await open({ who: OLGA, token: "tok-olga", rpcs: C.rpc });
  await o.page.locator("[data-chat-dock]").click(); await sleep(900);
  ok("NEW: у Ольги (не участница) «Бара» нет", !(await o.page.locator('[data-chat-item="group"]').count()));
  ok("NEW: без ошибок в консоли", !a.errors.length && !m.errors.length && !o.errors.length, [...a.errors, ...m.errors, ...o.errors].slice(0, 3).join(" | "));
  await a.ctx.close(); await m.ctx.close(); await o.ctx.close();
}

if (want("MANAGE")) {
  const C = chatServer();
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc });
  await createBar(m); await m.page.locator("[data-chat-gcreate]").click(); await sleep(1300);
  const gid = C.S.chats.find((c) => c.kind === "group").id;
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await a.page.locator("[data-chat-dock]").click(); await sleep(900);
  await a.page.locator('[data-chat-item="group"]').click(); await sleep(1300);
  ok("MANAGE: Анна открыла «Бар»", (await txt(a.page.locator("[data-chat-title]"))) === "Бар");
  await m.page.locator("[data-chat-info]").click(); await sleep(500);
  ok("MANAGE: шапка — участники (3), «создатель чата» у Марии, у старшей — название, «Добавить людей», «Убрать», «Удалить чат»",
    (await m.page.locator('[data-chat-gmembers="3"]').count()) === 1 && /Мария Ким \(ты\) Руководящий состав · создатель чата/.test(await txt(m.page.locator('[data-chat-gm="u-lead"]')))
    && (await m.page.locator("[data-chat-grename]").count()) === 1 && (await m.page.locator("[data-chat-gadd]").count()) === 1 && (await m.page.locator("[data-chat-gremove]").count()) === 2 && (await m.page.locator("[data-chat-gdelete]").count()) === 1);
  await shot(m.page, "manage-info");
  await m.page.locator("[data-chat-grename]").fill("Бар и веранда"); await sleep(150);
  await m.page.locator("[data-chat-gsave]").click(); await sleep(1200);
  ok("MANAGE: переименовала — «Бар и веранда» на сервере и в шапке", C.S.chats.find((c) => c.id === gid).title === "Бар и веранда" && (await txt(m.page.locator("[data-chat-title]"))) === "Бар и веранда");
  await m.page.locator("[data-chat-gadd]").click(); await sleep(1000);
  const ppl = await m.page.locator("[data-chat-person]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chat-person")));
  ok("MANAGE: «Добавить» — только те, кого нет в чате (Ольга, Пётр)", ppl.sort().join(",") === "e-petr,u-host", ppl.join(","));
  await m.page.locator('[data-chat-person="u-host"]').click(); await sleep(150);
  ok("MANAGE: «Добавить · 1»", /Добавить · 1/.test(await txt(m.page.locator("[data-chat-gaddgo]"))));
  await m.page.locator("[data-chat-gaddgo]").click(); await sleep(1300);
  ok("MANAGE: Ольга в чате, снова переписка; 4 человека", C.S.chats.find((c) => c.id === gid).members.includes("u-host") && (await m.page.locator("[data-chat-input]").count()) === 1 && /4 человека/.test(await txt(m.page.locator(".ch-head .ch-st"))));
  await m.page.locator("[data-chat-info]").click(); await sleep(500);
  await m.page.locator('[data-chat-gremove="e-anna"]').click(); await sleep(1000);
  ok("MANAGE: убрала Анну — участников 3", (await m.page.locator('[data-chat-gmembers="3"]').count()) === 1 && !(await m.page.locator('[data-chat-gm="e-anna"]').count()));
  await m.page.keyboard.press("Escape"); await sleep(300);
  await sleep(5200);
  ok("MANAGE: у Анны чат закрылся: «Этого чата у тебя больше нет», в списке его нет", /Этого чата у тебя больше нет/.test(await txt(a.page.locator("[data-chat-note]"))) && !(await a.page.locator('[data-chat-item="group"]').count()));
  await shot(a.page, "manage-gone");
  const ILYA = { ...STAFF.find((e) => e.id === "e-ilya"), is_admin: false };
  TOK["tok-ilya"] = ILYA;
  const i = await open({ who: ILYA, token: "tok-ilya", rpcs: C.rpc });
  await i.page.locator("[data-chat-dock]").click(); await sleep(900);
  await i.page.locator('[data-chat-item="group"]').click(); await sleep(1200);
  await i.page.locator("[data-chat-info]").click(); await sleep(500);
  ok("MANAGE: у бармена (Илья) — участники без «Убрать», без названия и «Удалить», есть «Выйти»", (await i.page.locator("[data-chat-gm]").count()) === 3 && !(await i.page.locator("[data-chat-gremove], [data-chat-grename], [data-chat-gadd], [data-chat-gdelete]").count()) && (await i.page.locator("[data-chat-gleave]").count()) === 1);
  await i.page.locator("[data-chat-gleave]").click(); await sleep(200);
  ok("MANAGE: «Выйти» переспрашивает", /Точно выйти\? Нажми ещё раз/.test(await txt(i.page.locator("[data-chat-gleave]"))));
  await i.page.locator("[data-chat-gleave]").click(); await sleep(1200);
  ok("MANAGE: Илья вышел: «Ты больше не в этом чате», на сервере его нет", /Ты больше не в этом чате/.test(await txt(i.page.locator("[data-chat-note]"))) && !C.S.chats.find((c) => c.id === gid).members.includes("e-ilya"));
  await m.page.locator("[data-chat-info]").click(); await sleep(500);
  await m.page.locator("[data-chat-gdelete]").click(); await sleep(200);
  ok("MANAGE: «Удалить чат» переспрашивает: «Удалить у всех?»", /Удалить у всех\? Нажми ещё раз/.test(await txt(m.page.locator("[data-chat-gdelete]"))));
  await m.page.locator("[data-chat-gdelete]").click(); await sleep(1200);
  ok("MANAGE: удалила — «Чат удалён у всех», на сервере чата нет", /Чат удалён у всех/.test(await txt(m.page.locator("[data-chat-note]"))) && !C.S.chats.some((c) => c.id === gid) && !(await m.page.locator('[data-chat-item="group"]').count()));
  ok("MANAGE: без ошибок в консоли", !a.errors.length && !m.errors.length && !i.errors.length, [...a.errors, ...m.errors, ...i.errors].slice(0, 3).join(" | "));
  await a.ctx.close(); await m.ctx.close(); await i.ctx.close();
}

if (want("NARROW")) {
  for (const light of [false, true]) {
    const tag = "NARROW" + (light ? " светлая" : "");
    const C = chatServer();
    const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc, w: 320, h: 640, light });
    await createBar(m);
    let f = await fits(m.page, "[data-chat] *");
    ok(tag + ": новый чат на 320 px — без прокрутки вбок, кнопка «Создать» целиком", f.sw <= f.W && f.over === 0 && /Создать чат · 3 человека/.test(await txt(m.page.locator("[data-chat-gcreate]"))), JSON.stringify(f));
    await shot(m.page, "narrow-new" + (light ? "-light" : ""));
    await m.page.locator("[data-chat-gcreate]").click(); await sleep(1300);
    await m.page.locator("[data-chat-info]").click(); await sleep(500);
    f = await fits(m.page, "[data-chat] *");
    ok(tag + ": участники на 320 px — без прокрутки вбок", f.sw <= f.W && f.over === 0, JSON.stringify(f));
    await shot(m.page, "narrow-info" + (light ? "-light" : ""));
    ok(tag + ": без ошибок в консоли", !m.errors.length, m.errors.slice(0, 3).join(" | "));
    await m.ctx.close();
  }
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
