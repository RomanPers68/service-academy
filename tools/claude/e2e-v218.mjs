// e2e v218 (Доп. 544): очередь к столам и до начала смены. В живой очереди с утра стоял вечерний официант (смена с 17:00),
// и до 17:00 ему всё ещё могли дать стол. График: Пётр — утро 10–18, Вера — день 12–20, Анна — вечер 17–24.
// Разделы:
//   EARLY  — 15:40, в очереди Пётр, Вера и Анна (добавлена раньше): у Анны бледная кнопка «с 17:00», «ещё не пришёл»;
//            пропустили Петра и Веру — Анну не предлагает; в правке «Пришёл» — и её снова зовут по очереди;
//   LATER  — 11:00, очередь пустая: Анну добавили из «Позже по графику» — «Пришёл» уже стоит, кнопка не бледная;
//   STRIP  — у Анны в строке чата «смена с 17:00», пока она не отмечена;
//   SEAT   — «Рассадка» в 15:40: по очереди Вера, а не Анна, которая стоит первой, но ещё не пришла;
//   LOOK   — 360 точек, обе темы: правка с «Пришёл».
// Голова сценария — из e2e-v217.mjs (сервер чата в памяти, как этапы 69, 71, 73 и 74).
// Запуск: E2E_SITE=<сборка> E2E_PORT=<порт> E2E_OUT=<папка снимков> [E2E_SRC=<исходники>] node e2e-v218.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/site", PORT = Number(process.env.E2E_PORT) || 5418, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v218";
mkdirSync(OUT, { recursive: true });
const SRC = process.env.E2E_SRC || "/home/claude/service-academy";
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
  { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: R0, position: "waiter" }, { id: "e-dina", name: "Дина", surname: "Белова", restaurant: R0, position: "waiter" },
  IRINA, { id: "e-ivan", name: "Иван", surname: "Петров", restaurant: "Порт", position: "waiter" }];
const OFF = ["e-dina"];   // Дина сегодня не в смене
const HRS = { "e-petr": [10, 18], "e-vera": [12, 20], "e-anna": [17, 24] };   // смены по графику: утро, день, вечер
const TOK = { "tok-anna": ANNA, "tok-maria": MARIA, "tok-olga": OLGA, "tok-irina": IRINA };
TOK["tok-petr"] = STAFF.find((e) => e.id === "e-petr"); TOK["tok-vera"] = STAFF.find((e) => e.id === "e-vera");
const ukOf = (p) => "_" + p.name + "_" + p.surname;
const full = (p) => p.name + " " + p.surname;
const LEADS = ["manager", "senior", "owner", "admin", "service_manager", "head"];
const isLead = (p) => !!p.is_admin || LEADS.includes(p.position);
const accN = (n) => ({ "Пётр": "Петра", "Анна": "Анну", "Вера": "Веру", "Дина": "Дину" })[n] || n;

// ── сервер чата в памяти: те же ответы, что у этапа 38 ──
function chatServer({ old = false, noQueue = false } = {}) {
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
  const calls = (p) => S.msgs.filter((m) => callFor(m, p) && !(m.call.going || []).length && !m.call.passed && !m.call.done && Date.now() - Date.parse(m.at) < 600000).map(J);
  // очередь официантов, как этапы 73 и 74: часы смены (HRS), «Остался» (stay), «Пришёл» (here), минуты дня заведения S.min
  S.queue = []; S.qlog = []; S.min = 11 * 60;
  const qOrd = () => S.queue;
  const hrs = (id) => (HRS[id] ? { from: HRS[id][0], to: HRS[id][1] } : { from: null, to: null });
  const over = (x) => (!x.stay && hrs(x.id).to != null && S.min >= hrs(x.id).to * 60) || (!x.here && hrs(x.id).from != null && S.min < hrs(x.id).from * 60 - 30);
  const qJson = (p) => ({ ok: true, day: "x", min: S.min, edit: isLead(p) || p.position === "hostess", list: qOrd().map((x) => ({ ...x, name: full(STAFF.find((e) => e.id === x.id)), ...hrs(x.id) })),
    others: STAFF.filter((e) => e.restaurant === R0 && e.position === "waiter" && !qOrd().some((x) => x.id === e.id)).map((e) => ({ id: e.id, name: full(e), ...hrs(e.id) }))
      .sort((a, b) => (a.from == null) - (b.from == null) || (a.from || 0) - (b.from || 0) || a.name.localeCompare(b.name, "ru")) });
  // в конец (позвали, посадили) или первым (передал); кого в очереди нет — не трогаем; «Остался» сохраняется
  const qMove = (id, firstPlace) => { const cur = qOrd().find((x) => x.id === id); if (!cur) return; const it = { id, away: false, out: false, stay: !!cur.stay, here: !!cur.here }, rest = qOrd().filter((x) => x.id !== id); S.queue = firstPlace ? [it, ...rest] : [...rest, it]; };
  const view = (c, p) => {
    const last = [...S.msgs].reverse().find((m) => m.chat === c.id);
    const peer = c.kind === "dm" ? STAFF.find((e) => e.id === c.members.find((x) => x !== p.id)) : null;
    return { id: c.id, kind: c.kind, members: members(c).length, shift: c.kind === "team" || c.kind === "leads" ? 3 : null, peer: peer ? { id: peer.id, name: full(peer), pos: peer.position, shift: true } : null,
      last: last ? J(last) : null, unread: unread(c, p) };
  };
  const whyText = (k) => ({ who: { lead: "менеджера", host: "хостес", bar: "бар", waiter: "официанта" }[k.who] || (k.to_name || "").split(" ")[0], why: { table: "к столу " + (k.table || ""), help: "нужна помощь", come: "подойди ко мне", guest: "гость ждёт", own: k.text || "" }[k.why] });
  const rpc = (fn, b) => {
    if (fn === "seat_set") {   // «Рассадка»: посадили гостей официанту — в конец очереди (этап 69 после v215)
      S.seats = S.seats || []; S.seats.push(b);
      if (b.p_status === "seat" && b.p_waiter) qMove(b.p_waiter, false);
      return { ok: true, table: { tid: b.p_tid, status: b.p_status, cnt: b.p_cnt, name: "", rtime: "", since: now(), waiter_id: b.p_waiter, waiter_name: b.p_waiter ? full(STAFF.find((e) => e.id === b.p_waiter)) : "", main: null, joined: [] } };
    }
    if (!/^(chat_|queue_)/.test(fn)) return undefined;
    if (noQueue && /^(queue_|chat_pass)/.test(fn)) return { code: "PGRST202" };
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
      const m = put(c, p, p.name + " зовёт " + w.who + ": " + w.why, { kind: "call", call: k });
      if (!noQueue && k.who === "person" && k.why === "table") qMove(k.emp, false);
      return { ok: true, msg: J(m) };
    }
    if (fn === "queue_get") return qJson(p);
    if (fn === "queue_set") {
      S.qlog.push(b.p_ord);
      if (!(isLead(p) || p.position === "hostess")) return { ok: false, error: "forbidden" };
      const seen = new Set(), nq = [];
      for (const x of b.p_ord || []) if (x && STAFF.some((e) => e.id === x.id && e.position === "waiter") && !seen.has(x.id)) { seen.add(x.id); nq.push({ id: x.id, away: x.away === true, out: x.out === true, stay: x.stay === true, here: x.here === true }); }
      S.queue = [...nq, ...qOrd().filter((x) => !seen.has(x.id))];
      return qJson(p);
    }
    if (fn === "chat_pass") {
      const m = msgOf(b.p_msg); if (!m || m.kind !== "call") return { ok: false, error: "not_found" };
      const k = m.call;
      if (k.passed) return { ok: false, error: "passed", msg: J(m) };
      if ((k.going || []).length || k.done) return { ok: false, error: "going", msg: J(m) };
      const skip = [...new Set([k.emp, ...(k.skip || [])])], nx = qOrd().find((x) => !x.away && !x.out && !skip.includes(x.id) && !over(x));
      if (!nx) return { ok: false, error: "nobody" };
      qMove(k.emp, true); qMove(nx.id, false);
      const to = STAFF.find((e) => e.id === nx.id), caller = STAFF.find((e) => e.id === m.emp);
      const k2 = { who: "person", emp: to.id, to_name: full(to), why: "table", table: k.table, text: "", going: [], skip, from: { id: k.emp, name: k.to_name, self: k.emp === p.id } };
      const m2 = put(S.chats.find((x) => x.id === m.chat), caller, caller.name + " зовёт " + accN(to.name) + ": к столу " + k.table, { kind: "call", call: k2 });
      k.passed = { by: p.id, by_name: full(p), to: to.id, to_name: full(to), at: now(), msg: m2.id }; touch(m);
      return { ok: true, msg: J(m), next: J(m2) };
    }
    if (fn === "chat_call_state") {
      if (noQueue) return { code: "PGRST202" };
      const list = [];
      for (const id of b.p_ids || []) {
        let m = msgOf(id); if (!m || m.kind !== "call") continue;
        let hops = 0; while (m.call.passed && msgOf(m.call.passed.msg) && hops < 8) { m = msgOf(m.call.passed.msg); hops++; }
        const g = (m.call.going || [])[0] || null, dn = m.call.done || null;
        const st = g ? "going" : dn ? "done" : m.del || Date.now() - Date.parse(m.at) >= 600000 ? "gone" : "wait";
        list.push({ id: Number(id), msg: m.id, st, who: m.call.who, emp: m.call.emp, name: m.call.to_name || "", table: m.call.table, at: m.at, by: g ? g.name : dn ? dn.by_name : null,
          going_at: g ? g.at : dn ? dn.at : null, hops });
      }
      return { ok: true, list };
    }
    if (fn === "chat_call_done") {
      if (noQueue) return { code: "PGRST202" };
      const m = msgOf(b.p_msg); if (!m || m.kind !== "call") return { ok: false, error: "not_found" };
      if (m.emp !== p.id && !(isLead(p) || p.position === "hostess")) return { ok: false, error: "forbidden" };
      if (m.call.passed) return { ok: false, error: "passed", msg: J(m) };
      if (!m.call.done) { m.call.done = { by: p.id, by_name: full(p), at: now() }; touch(m); }
      return { ok: true, msg: J(m) };
    }
    if (fn === "chat_go") {
      const m = msgOf(b.p_msg); if (!m || m.kind !== "call") return { ok: false, error: "not_found" };
      if (m.call.passed) return { ok: false, error: "passed", msg: J(m) };
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
const qChips = async (page) => (await sheet(page).locator("[data-call-qperson]").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
const qPicked = (page) => sheet(page).locator('[data-call-qperson][aria-checked="true"]').getAttribute("data-call-qperson");
const openSheet = async (page) => { await page.locator('[data-now-row="call"]').click(); await sleep(1100); };
const callDirect = (C, by, emp, table) => C.rpc("chat_call", { p_token: by, p_who: "person", p_emp: emp, p_why: "table", p_table: table, p_text: null });

const markOf = (page, tid) => sheet(page).locator(`[data-call-floor] [data-table="${tid}"] [data-table-mark]`);
const markSt = async (page, tid) => ((await markOf(page, tid).count()) ? markOf(page, tid).getAttribute("data-table-mark") : "");
const lastCallMsg = (C) => C.S.msgs.filter((m) => m.kind === "call").pop();
const older = (m, min) => { m.at = new Date(Date.now() - min * 60e3).toISOString(); m.upd = new Date().toISOString(); };
const pickT = async (page, tid) => { await sheet(page).locator(`[data-call-floor] [data-table="${tid}"]`).click(); await sleep(300); };
const compose = (C) => { C.S.queue = [{ id: "e-petr", away: false, out: false }, { id: "e-vera", away: false, out: false }]; };   // утренние по приходу

const reopen = async (page) => { await sheet(page).locator("[data-ch-x], [data-sa-back]").first().click().catch(() => {}); await sleep(500); await openSheet(page); };

const ids = (C) => C.S.queue.map((x) => x.id + (x.stay ? "·о" : "") + (x.here ? "·п" : "")).join(",");
const three = (C) => { C.S.queue = [{ id: "e-petr", away: false, out: false }, { id: "e-vera", away: false, out: false }, { id: "e-anna", away: false, out: false }]; };

if (want("EARLY")) {
  const C = chatServer(); three(C); C.S.min = 15 * 60 + 40;
  const o = await open({ who: OLGA, token: "tok-olga", rpcs: withBoard(C) });
  await sleep(4800); await openSheet(o.page);
  const sh = sheet(o.page);
  ok("EARLY: 15:40 — у Анны бледная кнопка «3 Анна С. · с 17:00», «ещё не пришёл»; выбран Пётр", (await qChips(o.page)).join(",") === "1Пётр О.,2Вера С.,3Анна С. · с 17:00"
    && (await sh.locator('[data-call-qperson="e-anna"]').getAttribute("data-call-qearly")) === "1"
    && /ещё не пришёл/.test((await sh.locator('[data-call-qperson="e-anna"]').getAttribute("aria-label")) || "") && (await qPicked(o.page)) === "e-petr", (await qChips(o.page)).join(","));
  await shot(o.page, "early-chips");
  await sh.locator("[data-call-skip]").click(); await sleep(400);
  ok("EARLY: «Пропустить Петра» — выбрана Вера", (await qPicked(o.page)) === "e-vera", await qPicked(o.page));
  await sh.locator("[data-call-skip]").click(); await sleep(400);
  const nPick = await sh.locator('[data-call-qperson][aria-checked="true"]').count();
  ok("EARLY: «Пропустить Веру» — Анну не предлагает (до смены больше получаса)", nPick === 0 && !(await sh.locator("[data-call-skip]").count()), String(nPick));
  await reopen(o.page);
  await sh.locator("[data-queue-open]").first().click(); await sleep(400);
  const row = sh.locator('[data-queue-row="e-anna"]');
  ok("EARLY: в правке у Анны «смена с 17:00, ещё не пришёл» и «Пришёл» вместо «Перерыв»", /смена с 17:00, ещё не пришёл/.test(await txt(row)) && (await row.locator("[data-queue-here]").count()) === 1
    && !(await row.locator("[data-queue-pause]").count()), await txt(row));
  await shot(o.page, "early-panel");
  await row.locator("[data-queue-here]").click(); await sleep(900);
  ok("EARLY: «Пришёл» — на сервере here, «пришёл раньше смены»", ids(C) === "e-petr,e-vera,e-anna·п" && /пришёл раньше смены/.test(await txt(row)), ids(C) + " | " + (await txt(row)));
  await sh.locator("[data-queue-open]").first().click(); await sleep(500);
  ok("EARLY: кнопка Анны больше не бледная", (await sh.locator('[data-call-qperson="e-anna"]').getAttribute("data-call-qearly")) === null
    && !/(^| )over( |$)/.test((await sh.locator('[data-call-qperson="e-anna"]').getAttribute("class")) || ""));
  await sh.locator("[data-call-skip]").click(); await sleep(300); await sh.locator("[data-call-skip]").click(); await sleep(400);
  ok("EARLY: пропустили Петра и Веру — теперь выбрана Анна", (await qPicked(o.page)) === "e-anna", String(await qPicked(o.page)));
  ok("EARLY: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 2).join(" | "));
  await o.ctx.close();
}

if (want("LATER")) {
  const C = chatServer(); C.S.min = 11 * 60;
  const o = await open({ who: OLGA, token: "tok-olga", rpcs: withBoard(C) });
  await sleep(4800); await openSheet(o.page);
  const sh = sheet(o.page);
  await sh.locator("[data-queue-none] [data-queue-open]").click(); await sleep(400);
  await sh.locator('[data-queue-later] [data-queue-add="e-anna"]').click(); await sleep(900);
  ok("LATER: 11:00, Анну добавили из «Позже по графику» — «Пришёл» уже стоит", ids(C) === "e-anna·п" && /пришёл раньше смены/.test(await txt(sh.locator('[data-queue-row="e-anna"]'))),
    ids(C) + " | " + (await txt(sh.locator('[data-queue-row="e-anna"]'))));
  await sh.locator("[data-queue-open]").first().click(); await sleep(500);
  ok("LATER: Анна выбрана по очереди, кнопка не бледная", (await qPicked(o.page)) === "e-anna" && (await sh.locator('[data-call-qperson="e-anna"]').getAttribute("data-call-qearly")) === null);
  await o.ctx.close();
}

if (want("STRIP")) {
  const C = chatServer(); three(C); C.S.min = 15 * 60 + 40;
  const a = await open({ who: ANNA, token: "tok-anna", rpcs: withBoard(C) });
  await sleep(1500); await openTeam(a.page);
  const st = a.page.locator("[data-queue-strip]");
  ok("STRIP: у Анны в 15:40 — «смена с 17:00», в строке Пётр и Вера", (await txt(st.locator("[data-queue-strip-me]"))) === "смена с 17:00"
    && (await txt(st.locator("[data-queue-strip-names]"))) === "Пётр О. → Вера С.", await txt(st));
  await shot(a.page, "strip-early");
  ok("STRIP: без ошибок в консоли", !a.errors.length, a.errors.slice(0, 2).join(" | "));
  await a.ctx.close();
}

if (want("SEAT")) {
  const C = chatServer(); C.S.queue = [{ id: "e-anna", away: false, out: false }, { id: "e-vera", away: false, out: false }]; C.S.min = 15 * 60 + 40;
  const o = await open({ who: OLGA, token: "tok-olga", rpcs: withBoard(C) });
  await sleep(1500); await nav(o.page, "seat", 3500);
  await o.page.locator('[data-table="t1"]').first().click(); await sleep(700);
  const ts = o.page.locator('[data-table-sheet="t1"]');
  if (!(await ts.locator('[data-waiters-pick]').count())) { await ts.locator('[data-sheet-status="seat"]').click(); await sleep(300); }
  ok("SEAT: 15:40 — по очереди Вера, а не Анна (первая, но её смена с 17:00)", (await ts.locator('[data-waiter="e-vera"][data-waiter-next]').count()) === 1
    && /по очереди Вера С\./.test(await txt(ts.locator("[data-waiter-queue]"))), await txt(ts.locator("[data-waiter-queue]")));
  ok("SEAT: без ошибок в консоли", !o.errors.length, o.errors.slice(0, 2).join(" | "));
  await o.ctx.close();
}

if (want("LOOK")) {
  for (const light of [false, true]) {
    const C = chatServer(); three(C); C.S.min = 15 * 60 + 40;
    const o = await open({ who: OLGA, token: "tok-olga", rpcs: withBoard(C), light, w: 360, h: 780 });
    await sleep(4800); await openSheet(o.page);
    const sh = sheet(o.page);
    await sh.locator("[data-queue-open]").first().click(); await sleep(400);
    const f = await fits(o.page, "[data-queue-edit] button");
    await sh.locator('[data-queue-row="e-anna"]').scrollIntoViewIfNeeded().catch(() => {});
    await shot(o.page, "look-early-" + (light ? "light" : "dark"));
    ok("LOOK: " + (light ? "светлая" : "тёмная") + " 360 — «Пришёл» и кнопки правки в экране", f.over === 0 && (await sh.locator("[data-queue-here]").count()) === 1, JSON.stringify(f));
    ok("LOOK: " + (light ? "светлая" : "тёмная") + " — без ошибок в консоли", !o.errors.length, o.errors.slice(0, 2).join(" | "));
    await o.ctx.close();
  }
}

await browser.close();
server.close();
console.log(results.join("\n"));
const bad = results.filter((r) => r.startsWith("✗")).length;
console.log(`\n${results.length - bad} из ${results.length} проверок прошли`);
process.exit(bad ? 1 : 0);
