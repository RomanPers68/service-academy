// e2e v190 (Доп. 515): «назад» возвращает туда, откуда пришёл.
// Владелец: «Столкнулся с тем, что приложение забывает откуда зашло в ту или иную вкладку. Нажимая назад он возвращает
// не туда, откуда зашел. Мы можем это исправить?»
// «Назад» здесь — как кнопка «Назад» Telegram: стрелка экрана, если она есть, иначе шаг по истории (window.__saBack из
// сборки для просмотра, tools/claude/build.mjs). Где приложение — window.__saScreen.
// Разделы:
//   TABS  — с каждой вкладки («Учусь», «Смена», «Команда», «Я») в каждый её раздел и «назад» — снова на этой вкладке
//           (раньше «Чек-лист» и «Пульс дня» из «Смены», «Аналитика», «Кандидат», «Редактор» и «Рейтинг» из «Команды»,
//           «Сертификаты» и «Статистика» из «Я» возвращали на «Учусь» или в «Команду»);
//   DEEP  — в два шага и обратно: профиль → карточка обучения (раньше качели профиль ⇄ карточка), статистика → игрок,
//           рейтинг → лига, справочник → глоссарий, сертификаты → экзамен, колода → сборка, рассадка → график,
//           Наставник → ошибки;
//   EXAM  — сертификаты → экзамен → сертификат → «назад» — список сертификатов, ещё «назад» — «Я»;
//   CHAT  — в чате «Открыть график» на карточке → «График», «назад» — снова тот же чат, закрыть чат — там, где был;
//   ARROW — стрелка «‹» на экране (не кнопка Telegram) ведёт так же.
// Голова сценария — как в e2e-v189.mjs (сервер чата в памяти, e2e-v90.mjs).
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v190.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5390, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v190";
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
    at: m.at, edited: !!m.edited && !m.del, del: m.del, card: m.card || null });   // v190: и карточки (у e2e-v90 их не было)
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

const BOSS = { id: "u-boss", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: true };
TOK["tok-boss"] = BOSS; STAFF.push(BOSS);
const cur = (page) => page.evaluate(() => window.__saScreen());
const back = async (page) => { await page.evaluate(() => window.__saBack()); await sleep(900); };
const go = async (page, s) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(1100); };
// путь: открыть по очереди, потом «назад» столько же раз — экраны в обратном порядке
async function walk(page, p) {
  for (const s of p) await go(page, s);
  const at = await cur(page);
  if (at !== p[p.length - 1]) return { opened: false, at };
  const got = [];
  for (let i = p.length - 2; i >= 0; i--) { await back(page); got.push(await cur(page)); }
  return { opened: true, got, want: p.slice(0, -1).reverse() };
}
const TABS = { shift: ["brief", "cases", "checklist", "daily", "morning", "newbie", "schedule", "seat", "weeklyGuest"],
  teamHub: ["about", "analytics", "candidate", "contentEditor", "gain", "leaderboard", "league", "mentor", "mistakes", "refEditor", "report", "server", "team"],
  me: ["cellar", "certificates", "guide", "mastery", "peerThanks", "profile", "report", "stats"],
  roleSelect: ["analytics", "assistant", "barLab", "candidate", "certificates", "checklist", "cocktails", "contentEditor", "daily", "glossary", "guestbook", "leaderboard", "mentor",
    "menuTrainer", "mistakes", "onboarding", "profile", "reference", "schedule", "sos", "stats", "wines"] };
const NAMES = { roleSelect: "Учусь", shift: "Смена", teamHub: "Команда", me: "Я" };

if (want("TABS")) {
  const C = chatServer();
  const o = await open({ who: BOSS, token: "tok-boss", rpcs: C.rpc });
  await sleep(4000);
  for (const [tab, list] of Object.entries(TABS)) {
    const bad = [];
    for (const s of list) {
      const r = await walk(o.page, [tab, s]);
      if (!r.opened) bad.push(s + ": не открылся (" + r.at + ")");
      else if (r.got[0] !== tab) bad.push(s + " → " + r.got[0]);
    }
    ok("TABS: «" + NAMES[tab] + "» → каждый раздел (" + list.length + ") → «назад» — снова «" + NAMES[tab] + "»", !bad.length, bad.join(", "));
  }
  ok("TABS: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("DEEP")) {
  const C = chatServer();
  const o = await open({ who: BOSS, token: "tok-boss", rpcs: C.rpc });
  await sleep(4000);
  for (const p of [["me", "profile", "trainingCard"], ["me", "stats", "playerDetail"], ["teamHub", "leaderboard", "league"], ["roleSelect", "reference", "glossary"],
    ["me", "certificates", "exam"], ["roleSelect", "cocktails", "barLab"], ["shift", "seat", "schedule"], ["teamHub", "mentor", "mistakes"], ["shift", "daily", "schedule"],
    ["teamHub", "analytics", "report"]]) {
    const r = await walk(o.page, p);
    ok("DEEP: " + p.join(" → ") + ", назад: " + r.want.join(" → "), r.opened && JSON.stringify(r.got) === JSON.stringify(r.want), r.opened ? r.got.join(" → ") : "не открылся: " + r.at);
  }
  ok("DEEP: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("EXAM")) {
  const C = chatServer();
  const o = await open({ who: BOSS, token: "tok-boss", rpcs: C.rpc });
  await sleep(4000);
  await go(o.page, "me"); await go(o.page, "certificates"); await go(o.page, "exam"); await go(o.page, "certificate");
  ok("EXAM: «Я» → сертификаты → экзамен → сертификат", (await cur(o.page)) === "certificate");
  await back(o.page);
  ok("EXAM: «назад» с сертификата — список сертификатов, а не снова экзамен", (await cur(o.page)) === "certificates", await cur(o.page));
  await back(o.page);
  ok("EXAM: ещё «назад» — «Я»", (await cur(o.page)) === "me", await cur(o.page));
  ok("EXAM: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("CHAT")) {
  const C = chatServer();
  const team = C.S.chats[0];
  C.S.msgs.push({ id: ++C.S.seq, chat: team.id, emp: BOSS.id, name: "Мария Ким", rest: R0, body: "График на декабрь готов", kind: "card", card: { t: "sched", month: "2026-12", what: "ready" },
    call: null, photo: null, reply: null, reacts: [], edited: false, del: false, at: new Date().toISOString(), upd: new Date().toISOString() });
  const o = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await sleep(4800);
  await go(o.page, "shift");
  await openTeam(o.page);
  ok("CHAT: в «Смене» открыт чат «Вся команда», в нём карточка «График»", (await o.page.locator("[data-chat]").count()) === 1 && (await o.page.locator('[data-chat-open="schedule"]').count()) === 1);
  await o.page.locator('[data-chat-open="schedule"]').first().click(); await sleep(1500);
  ok("CHAT: «Открыть график» — чат закрылся, открыт «График»", (await cur(o.page)) === "schedule" && !(await o.page.locator("[data-chat]").count()), await cur(o.page));
  await back(o.page); await sleep(800);
  ok("CHAT: «назад» с графика — снова тот же чат «Вся команда»", (await o.page.locator("[data-chat]").count()) === 1 && /Вся команда/.test(await txt(o.page.locator("[data-chat-title]"))), await txt(o.page.locator("[data-chat-title]")));
  await shot(o.page, "chat-back");
  ok("CHAT: под чатом — «Смена», откуда открывали чат", (await cur(o.page)) === "shift", await cur(o.page));
  await back(o.page); await sleep(400); await back(o.page); await sleep(600);
  ok("CHAT: закрыли чат — «Смена»", !(await o.page.locator("[data-chat]").count()) && (await cur(o.page)) === "shift", await cur(o.page));
  // открыли «График» из чата, ушли во вкладку — «назад» в чат больше не тянет
  await openTeam(o.page);
  await o.page.locator('[data-chat-open="schedule"]').first().click(); await sleep(1500);
  await go(o.page, "me"); await go(o.page, "profile"); await back(o.page);
  ok("CHAT: после перехода во вкладку «назад» ведёт по новой ветке, чат сам не открывается", (await cur(o.page)) === "me" && !(await o.page.locator("[data-chat]").count()), await cur(o.page));
  ok("CHAT: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

if (want("ARROW")) {
  const C = chatServer();
  const o = await open({ who: BOSS, token: "tok-boss", rpcs: C.rpc });
  await sleep(4000);
  // стрелка на экране — та же, что ищет кнопка Telegram (lib/utils.js, clickScreenBack): data-sa-back, «Назад» или «‹»; нажимаем пальцем
  const arrow = async () => {
    const found = await o.page.evaluate(() => {
      const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
      const t = (e) => (e.textContent || "").replace(/\s+/g, " ").trim();
      const b = [...document.querySelectorAll('[data-sa-back], [aria-label="Назад"]')].find(vis)
        || [...document.querySelectorAll('button, [role="button"]')].find((e) => vis(e) && ["‹", "‹ Назад", "←", "← Назад"].includes(t(e)));
      if (b) b.setAttribute("data-e2e-arrow", "1");
      return !!b;
    });
    if (found) await o.page.locator("[data-e2e-arrow]").first().click();
    await sleep(900);
    return found;
  };
  for (const [tab, s] of [["shift", "checklist"], ["teamHub", "leaderboard"], ["me", "stats"], ["me", "certificates"]]) {
    await go(o.page, tab); await go(o.page, s);
    const before = await cur(o.page);
    const had = await arrow();
    ok("ARROW: «" + NAMES[tab] + "» → " + s + " → стрелка «‹» — «" + NAMES[tab] + "»", had && before === s && (await cur(o.page)) === tab, (had ? "" : "стрелки нет · ") + before + " → " + (await cur(o.page)));
  }
  ok("ARROW: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
  await o.ctx.close();
}

await browser.close();
server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
