// e2e v91 (Доп. 404): чат смены — починка после первого запуска в зале, круг чата у меню, «Очистить чат», удалённое без
// следа. Сервер чата — в памяти скрипта (как этап 38).
// Разделы:
//   DOCK   — круг чата рядом с нижним меню (значка в верхней строке нет): число непрочитанных, открывает чат; на вкладках
//            есть, вне вкладок нет; 320 px — подписи меню целиком; лёжа — в меню слева; без этапа 38 — круга нет;
//   CLEAR  — «Очистить чат»: у старшей в «Вся команда» есть, у официанта нет; переспрашивает, «Отмена» ничего не трогает;
//            очистила — пусто у неё и (опросом) у открытого чата коллеги, без строки «кто очистил»; личную очищает
//            любой из двоих, она уходит из списка;
//   DEL    — удалённое сообщение исчезает целиком у всех, без «Сообщение удалено»;
//   KEEP   — новая личная переписка (ещё без сообщений) не закрывается опросом списка через 10 секунд;
//   SAFE   — полноэкранный Telegram на iPhone: вырез снизу 34 px (--sa-sb, как ставит приложение из safeAreaInset):
//            строка ввода, колокольчик и микрофон целиком над вырезом; список чатов и лист сообщения — тоже;
//   KB     — клавиатура: поверх окна (окно не сжимается) — низ поднимается на её высоту, строка ввода над ней;
//            окно сжалось, а window.innerHeight прежний (так в Telegram) — клавиатура не вычитается второй раз:
//            «Написать» — поиск и коллеги видны целиком; вырез снизу при клавиатуре не добавляется;
//   PEOPLE — «Написать»: коллеги списком; список не пришёл — «Список коллег не загрузился», а не «Никого не нашёл»;
//            пусто по поиску — «Никого не нашёл».
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v91.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5291, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v91";
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

// ── сервер чата в памяти: те же ответы, что у этапа 38 (v91: chat_clear, метка cleared, удалённое — только в опросе) ──
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
    const last = [...S.msgs].reverse().find((m) => m.chat === c.id && !m.del);
    const peer = c.kind === "dm" ? STAFF.find((e) => e.id === c.members.find((x) => x !== p.id)) : null;
    return { id: c.id, kind: c.kind, members: members(c).length, shift: c.kind === "team" || c.kind === "leads" ? 3 : null, peer: peer ? { id: peer.id, name: full(peer), pos: peer.position, shift: true } : null,
      last: last ? J(last) : null, unread: unread(c, p), cleared: c.cleared || null };
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
      list.sort((x, y) => ({ team: 0, leads: 1, net: 2, dm: 3 })[x.kind] - ({ team: 0, leads: 1, net: 2, dm: 3 })[y.kind]);
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


// вырез снизу, как в полноэкранном Telegram на iPhone (приложение ставит --sa-sb из safeAreaInset)
const SAFE_CSS = ":root{--sa-sb:34px !important}";
const box = (loc) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height }; });
const H = 852;

if (want("SAFE")) {
  for (const light of [false, true]) {
    const tag = "SAFE" + (light ? " светлая" : "");
    const C = chatServer();
    const o = await open({ who: ANNA, token: "tok-anna", light, rpcs: C.rpc });
    await o.page.addStyleTag({ content: SAFE_CSS });
    await sleep(4800);
    await o.page.locator("[data-chat-dock]").click(); await sleep(900);
    const list = await o.page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".ch-list")).paddingBottom));
    ok(tag + ": список чатов — запас снизу на вырез (24 + 34)", list >= 57, String(list));
    await o.page.locator('[data-chat-item="team"]').click(); await sleep(1200);
    const bar = await box(o.page.locator(".ch-bar-in")), bell = await box(o.page.locator(".ch-bar [data-chat-callbtn]")), mic = await box(o.page.locator("[data-chat-mic] button"));
    ok(tag + ": строка ввода, колокольчик и микрофон — целиком над вырезом", bar.bottom <= H - 34 + 0.5 && bell.bottom <= H - 34 + 0.5 && mic.bottom <= H - 34 + 0.5, JSON.stringify({ bar, bell, mic }));
    await shot(o.page, "safe-thread" + (light ? "-light" : ""));
    await bubble(o.page, "Доброе утро").click(); await sleep(400);
    const sheetPad = await o.page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("[data-chat-msgsheet]")).paddingBottom));
    ok(tag + ": лист сообщения — запас снизу на вырез (16 + 34)", sheetPad >= 49, String(sheetPad));
    await o.page.keyboard.press("Escape"); await sleep(200);
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
}

if (want("KB")) {
  const C = chatServer();
  const o = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await o.page.addStyleTag({ content: SAFE_CSS });
  await sleep(4800);
  await o.page.locator("[data-chat-dock]").click(); await sleep(900);
  await o.page.locator('[data-chat-item="team"]').click(); await sleep(1200);
  // клавиатура поверх окна: окно прежнее, видимая часть — на 300 короче
  await o.page.locator("[data-chat-input]").focus();
  await o.page.evaluate(() => { const vv = window.visualViewport, h0 = vv.height; Object.defineProperty(vv, "height", { configurable: true, get: () => h0 - 300 }); vv.dispatchEvent(new Event("resize")); });
  await sleep(500);
  const pad = await o.page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("[data-chat]")).paddingBottom));
  const bar = await box(o.page.locator(".ch-bar-in"));
  const barPad = await o.page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".ch-bar")).paddingBottom));
  ok("KB: клавиатура поверх окна — низ поднят на её высоту, строка ввода над ней, без запаса на вырез", Math.abs(pad - 300) <= 1 && bar.bottom <= H - 300 + 0.5 && barPad === 8, JSON.stringify({ pad, bar, barPad }));
  await shot(o.page, "kb-over");
  await o.ctx.close();
  // как в Telegram: окно сжалось на высоту клавиатуры, а window.innerHeight остался прежним
  const C2 = chatServer();
  const p = await open({ who: ANNA, token: "tok-anna", rpcs: C2.rpc });
  await p.page.addStyleTag({ content: SAFE_CSS });
  await sleep(4800);
  await p.page.locator("[data-chat-dock]").click(); await sleep(900);
  await p.page.locator("[data-chat-write]").click(); await sleep(900);
  await p.page.locator("[data-chat-search]").focus();
  await p.page.evaluate((h) => { Object.defineProperty(window, "innerHeight", { configurable: true, get: () => h }); }, H);
  await p.page.setViewportSize({ width: 393, height: H - 300 }); await sleep(700);
  const pad2 = await p.page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("[data-chat]")).paddingBottom));
  const scroll = await box(p.page.locator("[data-chat-people]"));
  const rows = await p.page.locator("[data-chat-person]").count();
  const lastRow = await box(p.page.locator("[data-chat-person]").last());
  ok("KB: окно сжалось, innerHeight прежний — клавиатура не вычитается второй раз (поиск и коллеги видны)", pad2 === 0 && scroll.bottom >= H - 300 - 1 && rows === 4 && lastRow.bottom <= H - 300, JSON.stringify({ pad2, scroll, rows }));
  await p.page.locator("[data-chat-search]").fill("Валерия"); await sleep(300);
  const empty = await box(p.page.locator(".ch-empty"));
  ok("KB: «Никого не нашёл» по поиску — целиком в видимой части", /Никого не нашёл/.test(await txt(p.page.locator(".ch-empty"))) && empty.bottom <= scroll.bottom && empty.h >= 18, JSON.stringify({ empty, scroll }));
  await shot(p.page, "kb-people");
  ok("KB: без ошибок в консоли", !o.errors.length && !p.errors.length, [...o.errors, ...p.errors].slice(0, 3).join(" | "));
  await p.ctx.close();
}

if (want("PEOPLE")) {
  const C = chatServer();
  const o = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await sleep(4800);
  await o.page.locator("[data-chat-dock]").click(); await sleep(900);
  await o.page.locator("[data-chat-write]").click(); await sleep(900);
  ok("PEOPLE: «Написать» — коллеги своего заведения списком (4)", (await o.page.locator("[data-chat-person]").count()) === 4 && /Мария Ким/.test(await txt(o.page.locator("[data-chat-people]"))));
  await o.page.locator("[data-chat-search]").fill("ольга"); await sleep(250);
  ok("PEOPLE: поиск по имени", (await o.page.locator("[data-chat-person]").count()) === 1 && /Ольга Ли/.test(await txt(o.page.locator("[data-chat-person]"))));
  await o.page.locator("[data-chat-search]").fill("Валерия"); await sleep(250);
  ok("PEOPLE: по поиску пусто — «Никого не нашёл»", (await txt(o.page.locator(".ch-empty"))) === "Никого не нашёл.");
  await o.ctx.close();
  // сервер не отдал список (как этап 38 v90 в зале: функция падала, и приходило auth)
  const C2 = chatServer();
  const p = await open({ who: ANNA, token: "tok-anna", rpcs: (fn, b) => (fn === "chat_people" ? { ok: false, error: "auth" } : C2.rpc(fn, b)) });
  await sleep(4800);
  await p.page.locator("[data-chat-dock]").click(); await sleep(900);
  await p.page.locator("[data-chat-write]").click(); await sleep(900);
  ok("PEOPLE: список не пришёл — «Список коллег не загрузился», а не «Никого не нашёл»", /Список коллег не загрузился/.test(await txt(p.page.locator("[data-chat-people-bad]"))) && !/Никого не нашёл/.test(await txt(p.page.locator("[data-chat-people]"))));
  await shot(p.page, "people-bad");
  ok("PEOPLE: без ошибок в консоли", !p.errors.length, p.errors.slice(0, 3).join(" | "));
  await p.ctx.close();
}

if (want("DOCK")) {
  for (const light of [false, true]) {
    const tag = "DOCK" + (light ? " светлая" : "");
    const C = chatServer();
    const o = await open({ who: ANNA, token: "tok-anna", light, rpcs: C.rpc });
    await sleep(4800);
    const dock = o.page.locator('[data-chat-dock="bar"]');
    ok(tag + ": значка чата в верхней строке нет; круг рядом с меню — один", !(await o.page.locator("[data-top-chat]").count()) && (await dock.count()) === 1);
    const g = await o.page.evaluate(() => {
      const d = document.querySelector('[data-chat-dock="bar"]').getBoundingClientRect(), pill = document.querySelector("#sa-tabbar .sa-lensbar").getBoundingClientRect();
      return { dl: d.left, dr: d.right, db: d.bottom, dc: d.top + d.height / 2, pr: pill.right, pc: pill.top + pill.height / 2, W: innerWidth, H: innerHeight };
    });
    ok(tag + ": круг справа от меню, по центру его высоты, целиком на экране", g.dl > g.pr && Math.abs(g.dc - g.pc) <= 1 && g.dr <= g.W && g.db <= g.H, JSON.stringify(g));
    ok(tag + ": на круге число непрочитанных — 2", (await o.page.locator('[data-chat-dock-n="2"]').count()) === 1 && /непрочитанных 2/.test(await dock.getAttribute("aria-label")));
    await shot(o.page, "dock" + (light ? "-light" : ""));
    await dock.click(); await sleep(900);
    ok(tag + ": круг открывает чат", (await o.page.locator("[data-chat]").count()) === 1 && (await o.page.locator('[data-chat-item="team"]').count()) === 1);
    await o.page.locator("[data-chat] .ch-back").first().click(); await sleep(600);
    const onTabs = [];
    for (const s of ["shift", "teamHub", "me"]) { await nav(o.page, s, 1200); onTabs.push(await o.page.locator('[data-chat-dock="bar"]').count()); }
    await nav(o.page, "search", 1200);
    ok(tag + ": круг на вкладках «Смена», «Команда», «Я»; вне вкладок (поиск) — нет", onTabs.join("") === "111" && !(await o.page.locator("[data-chat-dock]").count()), onTabs.join(""));
    ok(tag + ": без ошибок в консоли", !o.errors.length, o.errors.slice(0, 3).join(" | "));
    await o.ctx.close();
  }
  // 320 px: меню уже на ширину круга — подписи вкладок целиком, без прокрутки вбок
  const C = chatServer();
  const n = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc, w: 320, h: 640 });
  await sleep(4800);
  const cut = await n.page.evaluate(() => [...document.querySelectorAll("#sa-tabbar .sa-lensbar [role=button] > div > div:last-child")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  const f = await fits(n.page, "#sa-tabbar, #sa-tabbar *");
  ok("DOCK: 320 px — круг и меню в строку, подписи вкладок целиком", !cut.length && f.over === 0 && f.sw <= f.W, JSON.stringify({ cut, f }));
  await shot(n.page, "dock-320");
  await n.ctx.close();
  // лёжа: меню слева — чат под Наставником, с числом
  const C2 = chatServer();
  const l = await open({ who: ANNA, token: "tok-anna", rpcs: C2.rpc, w: 852, h: 393 });
  await sleep(4800);
  ok("DOCK: лёжа — чат в меню слева, с числом", (await l.page.locator('[data-chat-dock="rail"]').count()) === 1 && (await l.page.locator('[data-chat-dock="rail"] [data-chat-dock-n="2"]').count()) === 1);
  await l.page.locator('[data-chat-dock="rail"]').click(); await sleep(900);
  ok("DOCK: лёжа — из меню слева чат открывается", (await l.page.locator("[data-chat]").count()) === 1);
  await shot(l.page, "dock-rail");
  await l.ctx.close();
  const m = await open({ who: ANNA, token: "tok-anna", rpcs: (fn) => (/^chat_/.test(fn) ? { code: "PGRST202", message: "not found" } : undefined) });
  await sleep(4800);
  ok("DOCK: без этапа 38 на сервере — круга нет, ошибок нет", !(await m.page.locator("[data-chat-dock]").count()) && !m.errors.length, m.errors.slice(0, 2).join(" | "));
  await m.ctx.close();
}

if (want("CLEAR")) {
  const C = chatServer();
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc });
  await openTeam(a.page); await openTeam(m.page);
  ok("CLEAR: у официанта в «Вся команда» кнопки «Очистить» нет, у старшей — есть", !(await a.page.locator("[data-chat-clear]").count()) && (await m.page.locator("[data-chat-clear]").count()) === 1);
  await m.page.locator("[data-chat-clear]").click(); await sleep(400);
  ok("CLEAR: переспрашивает: всё исчезнет у всех, вернуть нельзя", /исчезнут у всех/.test(await txt(m.page.locator("[data-chat-clear-text]"))) && /Вернуть переписку нельзя/.test(await txt(m.page.locator("[data-chat-clear-text]"))));
  await shot(m.page, "clear-sheet");
  await m.page.locator("[data-chat-clearsheet] .ch-act").filter({ hasText: "Отмена" }).click(); await sleep(300);
  ok("CLEAR: «Отмена» — лист закрыт, переписка на месте", !(await m.page.locator("[data-chat-clearsheet]").count()) && (await m.page.locator("[data-chat-bubble]").count()) === 2);
  await m.page.locator("[data-chat-clear]").click(); await sleep(300);
  await m.page.locator("[data-chat-clear-go]").click(); await sleep(900);
  ok("CLEAR: очистила — у неё пусто, без строки «кто очистил»", !(await m.page.locator("[data-chat-bubble], [data-chat-sys], [data-chat-call]").count()) && /Здесь пока тихо/.test(await txt(m.page.locator("[data-chat-feed]"))) && !C.S.msgs.some((x) => x.chat === 1));
  await sleep(5200);
  ok("CLEAR: у Анны, у которой чат открыт, переписка исчезла сама (опрос)", !(await a.page.locator("[data-chat-bubble]").count()) && /Здесь пока тихо/.test(await txt(a.page.locator("[data-chat-feed]"))));
  await a.page.locator("[data-chat-input]").fill("Начинаем заново"); await a.page.locator("[data-chat-send]").click(); await sleep(5200);
  ok("CLEAR: после очистки пишут как обычно — у Марии новое сообщение", (await m.page.locator("[data-chat-bubble]").count()) === 1 && /Начинаем заново/.test(await txt(m.page.locator("[data-chat-feed]"))));
  await m.page.locator("[data-chat] .ch-back").first().click(); await sleep(900);
  await shot(m.page, "clear-list");
  // личная: очищает любой из двоих, переписка уходит из списка
  await a.page.locator("[data-chat] .ch-back").first().click(); await sleep(700);
  await a.page.locator("[data-chat-write]").click(); await sleep(900);
  await a.page.locator('[data-chat-person="u-host"]').click(); await sleep(1200);
  await a.page.locator("[data-chat-input]").fill("Оля, привет"); await a.page.locator("[data-chat-send]").click(); await sleep(900);
  ok("CLEAR: в личной кнопка «Очистить» есть и у официанта", (await a.page.locator("[data-chat-clear]").count()) === 1);
  await a.page.locator("[data-chat-clear]").click(); await sleep(300);
  ok("CLEAR: личная — «исчезнут у вас обоих», уйдёт из списка", /у вас обоих/.test(await txt(a.page.locator("[data-chat-clear-text]"))) && /уйдёт из списка/.test(await txt(a.page.locator("[data-chat-clear-text]"))));
  await a.page.locator("[data-chat-clear-go]").click(); await sleep(11000);
  ok("CLEAR: очистила личную — переписка пустая и открытой остаётся (опрос списка её не закрыл)", !(await a.page.locator("[data-chat-bubble]").count()) && /Ольга Ли/.test(await txt(a.page.locator("[data-chat-title]"))));
  await a.page.locator("[data-chat] .ch-back").first().click(); await sleep(900);
  ok("CLEAR: в списке чатов личной больше нет", !(await a.page.locator('[data-chat-item="dm"]').count()) && (await a.page.locator('[data-chat-item="team"]').count()) === 1);
  ok("CLEAR: без ошибок в консоли", !a.errors.length && !m.errors.length, [...a.errors, ...m.errors].slice(0, 3).join(" | "));
  await a.ctx.close(); await m.ctx.close();
}

if (want("DEL")) {
  const C = chatServer();
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  const m = await open({ who: MARIA, token: "tok-maria", rpcs: C.rpc });
  await openTeam(a.page); await openTeam(m.page);
  await a.page.locator("[data-chat-input]").fill("Это я удалю"); await a.page.locator("[data-chat-send]").click(); await sleep(5200);
  ok("DEL: у Марии новое сообщение Анны", /Это я удалю/.test(await txt(m.page.locator("[data-chat-feed]"))));
  await bubble(a.page, "Это я удалю").click(); await sleep(400);
  await a.page.locator("[data-chat-del]").click(); await sleep(200); await a.page.locator("[data-chat-del]").click(); await sleep(900);
  ok("DEL: у Анны сообщение исчезло целиком, без «Сообщение удалено»", !/Это я удалю|Сообщение удалено/.test(await txt(a.page.locator("[data-chat-feed]"))) && (await a.page.locator("[data-chat-bubble]").count()) === 2);
  await sleep(5200);
  ok("DEL: у Марии (опрос) — тоже исчезло, без следа", !/Это я удалю|Сообщение удалено/.test(await txt(m.page.locator("[data-chat-feed]"))) && (await m.page.locator("[data-chat-bubble]").count()) === 2);
  await m.page.locator("[data-chat] .ch-back").first().click(); await sleep(900);
  ok("DEL: в списке чатов — последнее неудалённое", /Поняла, накрою веранду/.test(await txt(m.page.locator('[data-chat-item="team"]'))));
  ok("DEL: без ошибок в консоли", !a.errors.length && !m.errors.length, [...a.errors, ...m.errors].slice(0, 3).join(" | "));
  await a.ctx.close(); await m.ctx.close();
}

if (want("KEEP")) {
  const C = chatServer();
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: C.rpc });
  await a.page.locator("[data-chat-dock]").click(); await sleep(900);
  await a.page.locator("[data-chat-write]").click(); await sleep(900);
  await a.page.locator('[data-chat-person="e-ilya"]').click(); await sleep(1200);
  const t0 = await txt(a.page.locator("[data-chat-title]"));
  await sleep(11500);
  ok("KEEP: новая личная (без сообщений) открыта и через 11 секунд — опрос списка её не закрыл", t0 === "Илья Белов" && (await txt(a.page.locator("[data-chat-title]"))) === "Илья Белов" && (await a.page.locator("[data-chat-input]").count()) === 1);
  ok("KEEP: без ошибок в консоли", !a.errors.length, a.errors.slice(0, 3).join(" | "));
  await a.ctx.close();
}

await browser.close(); server.close();
console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
