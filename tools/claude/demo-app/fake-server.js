// tools/claude/demo-app/fake-server.js — v97 (Доп. 410): сервер приложения в памяти: для демо целиком (в странице, вместо
// Supabase) и для e2e-v97 (в скрипте проверки). Те же ответы, что у этапов на сервере: вход по токену (whoami, my_state),
// меню (menu_get, menu_set), график (schedule_load, schedule_save_month), брифинг (brief_today, brief_publish) и чат
// (этап 38: переписка, смены — отдать, поменяться, «Ищем в смену», заявки на месяц для «Графика», карточка коллеги,
// задания, «Поделиться», опросы, стоп-лист из чата и из Меню, брифинг и «График готов» карточкой).
// Чего здесь нет, на то ответ «функции нет» (PGRST202): приложение прячет это, как без SQL-этапа.
// Состояние — обычный объект (JSON): демо хранит его в localStorage и переживает смену человека и перезагрузку.
import { cardSummary, shiftLogLine } from "../../../lib/chat-smart.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const addD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const dowOf = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const WD_S = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const dshort = (iso) => WD_S[dowOf(iso)] + " " + Number(iso.slice(8));
const dayN = (iso) => String(Number(iso.slice(8)));
const hh = (v) => String(v > 24 ? v - 24 : v).padStart(2, "0") + ":00";
const toks = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").split(/\s+/).filter(Boolean).sort().join(" ");
const nm = (s) => { const w = String(s || "").trim().split(/\s+/); return w[1] ? w[0] + " " + w[1][0] + "." : w[0] || ""; };
const cut = (s, n) => { const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
export const LEADS = ["manager", "senior", "owner", "admin", "service_manager", "head"];
export const isLead = (p) => !!p && (!!p.is_admin || LEADS.includes(p.position));
export const full = (p) => (p.name + " " + (p.surname || "")).trim();
export const SPOS = { manager: ["менеджер", "менеджеры"], host: ["хостес", "хостес"], bar: ["бар", "бармены"], waiter: ["официант", "официанты"] };
const POS_OF = { manager: "manager", senior: "manager", hostess: "host", bartender: "bar", senior_bartender: "bar", waiter: "waiter" };

export const SHIFTS = [{ k: "У", name: "Утро", from: 10, to: 18 }, { k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }];

/**
 * opts: { today: "ГГГГ-ММ-ДД", rest, people: [сотрудник], tok: { токен: id }, sstaff: [строка графика], cfg, plan: { sid: { смещение дня: буква } },
 *   menu: [блюдо], state (сохранённое S), clock: () => Date.now() }
 */
export function makeServer(opts) {
  const TODAY = opts.today, D = (n) => addD(TODAY, n), R0 = opts.rest;
  const PEOPLE = opts.people, TOK = opts.tok || {}, SSTAFF = opts.sstaff, CFG = opts.cfg;
  const SH = (CFG && CFG.shifts) || SHIFTS;
  const clock = opts.clock || (() => Date.now());
  const now = () => new Date(clock()).toISOString();
  const S = opts.state || {
    chats: [{ id: 1, kind: "team", rest: R0, pin: null }, { id: 2, kind: "leads", rest: R0, pin: null }, { id: 3, kind: "net", rest: "", pin: null }],
    msgs: [], reads: {}, photos: {}, seq: 100, pseq: 500, votes: {}, progress: clone(opts.progress || {}), quizzes: clone(opts.quizzes || {}), tg: [], menu: clone(opts.menu || []), months: {}, saved: [],
    brief: null, briefSent: 0, log: [], wishes: {},
  };
  const monOf = (iso) => { const mk = iso.slice(0, 7); return S.months[mk] || (S.months[mk] = { plan: {}, locks: {}, days: {}, facts: {} }); };
  if (!opts.state) for (const [sid, row] of Object.entries(opts.plan || {})) for (const [n, k] of Object.entries(row)) { const iso = D(Number(n)); const mo = monOf(iso); (mo.plan[sid] = mo.plan[sid] || {})[dayN(iso)] = k; }
  // пожелания: { "ГГГГ-ММ": [{ staff_id, day, kind: "off" | "hard" }] }; opts.wishes — смещение дня от сегодня
  if (!opts.state) for (const w of opts.wishes || []) { const iso = D(w.at); (S.wishes[iso.slice(0, 7)] = S.wishes[iso.slice(0, 7)] || []).push({ staff_id: w.sid, day: Number(dayN(iso)), kind: w.kind || "off" }); }
  const who = (id) => PEOPLE.find((e) => e.id === id) || null;
  const visible = (c, p) => !!c && (c.kind === "net" ? isLead(p) : c.kind === "dm" || c.kind === "group" ? c.members.includes(p.id) && (c.kind === "dm" || c.rest === p.restaurant)
    : c.rest === p.restaurant && (c.kind === "team" || isLead(p)));
  const members = (c) => PEOPLE.filter((e) => (c.kind === "net" ? isLead(e) : c.kind === "dm" || c.kind === "group" ? c.members.includes(e.id) : e.restaurant === c.rest && (c.kind === "team" || isLead(e))));
  const rd = (c, e) => ((S.reads[c.id] || {})[e] || 0);
  const setRead = (c, e, v) => { S.reads[c.id] = S.reads[c.id] || {}; S.reads[c.id][e] = Math.max(rd(c, e), v); };
  const msgOf = (id) => S.msgs.find((m) => m.id === Number(id));
  const chatOf = (id) => S.chats.find((c) => c.id === Number(id));
  const teamOf = (rest) => S.chats.find((c) => c.kind === "team" && c.rest === rest) || null;
  const quote = (q) => (q ? { id: q.id, emp: q.emp, name: q.name, kind: q.kind, body: q.del ? "" : q.body, photo: q.kind === "photo", del: q.del } : null);
  const J = (m) => ({ id: m.id, chat: m.chat, emp: m.emp, name: m.name, rest: m.rest, body: m.del ? "" : m.body, kind: m.kind, call: m.kind === "call" && !m.del ? m.call : null,
    photo: m.kind === "photo" && !m.del ? m.photo : null, reply: m.reply && !m.del ? quote(msgOf(m.reply)) : null, reacts: m.del ? [] : m.reacts.map((x) => ({ ...x })),
    at: m.at, edited: !!m.edited && !m.del, del: m.del, card: ["card", "ai", "sys"].includes(m.kind) && !m.del && m.card ? clone(m.card) : null });
  const put = (c, p, body, extra = {}) => { const t = now(); const m = { id: ++S.seq, chat: c.id, emp: p.id, name: full(p), rest: p.restaurant, body, kind: "text", call: null, photo: null, reply: null, reacts: [], edited: false, del: false, at: t, upd: t, ...extra }; S.msgs.push(m); setRead(c, p.id, m.id); return m; };
  const touch = (m) => { m.upd = now(); };
  const unread = (c, p) => S.msgs.filter((m) => m.chat === c.id && !m.del && m.emp !== p.id && m.id > rd(c, p.id)).length;
  const callFor = (m, p) => m.kind === "call" && !m.del && m.emp !== p.id && (m.call.who === "person" ? m.call.emp === p.id : m.call.who === "lead" ? isLead(p) : ({ host: ["hostess"], bar: ["bartender"], waiter: ["waiter"] }[m.call.who] || []).includes(p.position));
  const calls = (p) => S.msgs.filter((m) => callFor(m, p) && !(m.call.going || []).length && clock() - Date.parse(m.at) < 600000).map(J);
  const view = (c, p) => {
    const last = [...S.msgs].reverse().find((m) => m.chat === c.id && !m.del);
    const peer = c.kind === "dm" ? who(c.members.find((x) => x !== p.id)) : null;
    return { id: c.id, kind: c.kind, members: members(c).length, shift: c.kind === "team" || c.kind === "leads" ? 3 : null, peer: peer ? { id: peer.id, name: full(peer), pos: peer.position, shift: true } : null,
      last: last ? J(last) : null, unread: unread(c, p), cleared: c.cleared || null, title: c.kind === "group" ? c.title : null, owner: c.kind === "group" ? c.owner : null };
  };
  // ── график: буква в клетке, почему нельзя, может ли взять, варианты обмена, запись ──
  const code = (sid, iso, over = {}) => { const key = iso + "|" + sid; if (key in over) return over[key] || ""; return ((monOf(iso).plan[sid] || {})[dayN(iso)]) || ""; };
  const def = (k) => SH.find((x) => k && x.k === k) || null;
  const staffOf = (empId) => { const e = who(empId); if (!e) return null; const t = toks(full(e)); return SSTAFF.find((s) => toks(s.name) === t) || null; };
  const why = (s, iso, k, over) => {
    const sh = def(k); if (!sh) return "смены нет в графике";
    if (def(code(s.id, iso, over))) return "в этот день уже есть смена";
    const pv = def(code(s.id, addD(iso, -1), over)); if (pv && 24 - pv.to + sh.from < 11) return "мало отдыха после смены накануне (нужно 11 ч)";
    const nx = def(code(s.id, addD(iso, 1), over)); if (nx && 24 - sh.to + nx.from < 11) return "мало отдыха перед сменой назавтра (нужно 11 ч)";
    let run = 1;
    for (let d = addD(iso, -1); run <= 5 && def(code(s.id, d, over)); d = addD(d, -1)) run++;
    for (let d = addD(iso, 1); run <= 5 && def(code(s.id, d, over)); d = addD(d, 1)) run++;
    return run > 5 ? "вышло бы больше 5 смен подряд" : null;
  };
  const check = (c, empId) => {
    if (c.date < TODAY) return { can: false, why: "Этот день уже прошёл" };
    const gs = SSTAFF.find((s) => String(s.id) === String(c.sid)), ts = staffOf(empId);
    if (!ts) return { can: false, why: "Тебя нет в графике" };
    if (!gs || ts.id === gs.id) return { can: false, why: "" };
    if (ts.pos !== gs.pos) return { can: false, why: c.mode === "swap" ? "Поменяться могут " + SPOS[gs.pos][1] : "Забрать могут " + SPOS[gs.pos][1] + ", свободные в этот день" };
    if (code(String(gs.id), c.date) !== c.k) return { can: false, why: "Этой смены уже нет в графике" };
    if (c.mode === "swap") {
      if (def(code(String(ts.id), c.date))) return { can: false, why: "В этот день у тебя своя смена" };
      const days = (c.want || []).length ? c.want.filter((x) => x >= TODAY && x !== c.date) : Array.from({ length: 32 }, (_, i) => D(i)).filter((x) => x !== c.date);
      if (!days.some((x) => def(code(String(ts.id), x)))) return { can: false, why: (c.want || []).length ? "В эти дни у тебя нет смен взамен" : "В ближайший месяц у тебя нет смен взамен" };
      return { can: true, ts, gs };
    }
    const w = why({ id: String(ts.id) }, c.date, c.k, { [c.date + "|" + gs.id]: "" });
    return w ? { can: false, why: "Не получится: " + w } : { can: true, ts, gs };
  };
  // v97: «Ищем в смену»: та же должность по графику, свободен в этот день, правила графика; уже выходит — нет
  const needCheck = (c, empId) => {
    if (c.date < TODAY) return { can: false, why: "Этот день уже прошёл" };
    if ((c.took || []).some((t) => t.id === empId)) return { can: false, why: "Ты выходишь в эту смену" };
    const ts = staffOf(empId);
    if (!ts) return { can: false, why: "Тебя нет в графике" };
    if (ts.pos !== c.posKey) return { can: false, why: "Выйти могут " + (SPOS[c.posKey] ? SPOS[c.posKey][1] : "коллеги той же должности") };
    if (c.instead && String(c.instead.sid) === String(ts.id)) return { can: false, why: "" };
    const w = why({ id: String(ts.id) }, c.date, c.k, {});
    return w ? { can: false, why: "Не получится: " + w } : { can: true, ts };
  };
  const options = (c, empId) => {
    const k0 = check(c, empId); if (!k0.can) return { shifts: [], why: k0.why || "" };
    const ts = String(k0.ts.id), gs = String(k0.gs.id), out = []; let w0 = "";
    const days = (c.want || []).length ? c.want.filter((x) => x >= TODAY && x !== c.date).sort() : Array.from({ length: 32 }, (_, i) => D(i)).filter((x) => x !== c.date);
    for (const x of days) {
      const k2 = code(ts, x), sh = def(k2); if (!sh) continue;
      const w1 = why({ id: ts }, c.date, c.k, { [x + "|" + ts]: "", [c.date + "|" + gs]: "" }), w2 = why({ id: gs }, x, k2, { [c.date + "|" + gs]: "", [x + "|" + ts]: "" });
      if (!w1 && !w2) out.push({ date: x, k: k2, label: sh.name, time: hh(sh.from) + "–" + hh(sh.to) });
      else if (!w0) w0 = dshort(x) + ", " + (w1 || "у коллеги: " + w2);
    }
    return { shifts: out, why: out.length ? "" : w0 ? "Не получится: " + w0 : "Подходящих смен взамен нет" };
  };
  const apply = (list) => { for (const x of list) { const mo = monOf(x.date), d = dayN(x.date); mo.plan[x.sid] = { ...(mo.plan[x.sid] || {}) }; if (x.k) mo.plan[x.sid][d] = x.k; else delete mo.plan[x.sid][d]; mo.locks[x.sid] = { ...(mo.locks[x.sid] || {}), [d]: true }; } };
  // руководителям — строка о каждой передаче, обмене и выходе в смену (как _sa_sh_done)
  const done = (c, m, p) => { const lc = S.chats.find((x) => x.rest === c.rest && x.kind === "leads"); if (lc && lc.id !== c.id) put(lc, p, shiftLogLine(m.card), { kind: "sys", card: { t: "log", mode: m.card.mode } }); };
  // ── задание: кому, кто прошёл ──
  const taskWho = (c, card, author) => members(c).filter((e) => e.id !== author && (c.kind === "leads" || c.kind === "net" || !isLead(e)))
    .map((e) => ({ id: e.id, name: full(e) })).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const doneOf = (ids, it) => {
    const ls = it.kind === "lesson" ? [it.id] : it.kind === "module" ? it.lessons || [] : [], qs = it.kind === "quiz" ? [it.id] : it.kind === "module" ? it.quizzes || [] : [];
    if (!ls.length && !qs.length) return [];
    return ids.filter((u) => ls.every((l) => (S.progress[u] || []).includes(l)) && qs.every((q) => (S.quizzes[u] || []).includes(q)));
  };
  const taskInfo = (c, card, author, lead) => { const w = taskWho(c, card, author), dn = doneOf(w.map((x) => x.id), card.item || {}); const o = { n: dn.length, of: w.length }; if (lead) o.left = w.filter((x) => !dn.includes(x.id)).map((x) => x.name); return o; };
  const smart = (m, p) => {
    const x = J(m);
    if (x.kind !== "card" || !x.card || x.del) return x;
    const c = x.card;
    if (c.t === "shift" && c.st === "open" && c.from !== p.id) { const k = c.mode === "need" ? needCheck(c, p.id) : check(c, p.id); c.can = !!k.can; c.why = k.why || ""; }
    if (c.t === "task") Object.assign(c, taskInfo(chatOf(m.chat), c, m.emp, isLead(p)));
    if (c.t === "poll") c.votes = (S.votes[m.id] || []).map((v) => ({ o: v.o, emp: v.emp, name: v.name }));
    return x;
  };
  const item = (x, kinds) => {
    if (!x || typeof x !== "object" || !kinds.includes(x.kind) || !ID_RE.test(String(x.id || "")) || !cut(x.title, 120)) return null;
    const o = { kind: x.kind, id: String(x.id), title: cut(x.title, 120) };
    if (cut(x.sub, 140)) o.sub = cut(x.sub, 140);
    if (/^[0-9]{1,3}$/.test(String(x.mins == null ? "" : x.mins))) o.mins = Number(x.mins);
    if (/^https:\/\/[^\s"<>]+$/.test(String(x.img || "")) && String(x.img).length <= 600) o.img = x.img;
    if (x.kind === "module" && Array.isArray(x.lessons)) o.lessons = x.lessons.map(String).filter((v) => ID_RE.test(v)).slice(0, 80);
    if (x.kind === "module" && Array.isArray(x.quizzes)) o.quizzes = x.quizzes.map(String).filter((v) => ID_RE.test(v)).slice(0, 80);
    return o;
  };
  const cardMsg = (c, p, card, extra = {}) => put(c, p, cardSummary(card), { kind: "card", card, ...extra });
  const shiftCard = (s, iso, k) => { const sh = def(k); return { date: iso, k, label: sh.name, time: hh(sh.from) + "–" + hh(sh.to), pos: SPOS[s.pos][0], posKey: s.pos }; };

  // ── вход и главные экраны ──
  const stateOf = (p) => ({ ok: true, v: 2, quiz: (S.quizzes[p.id] || []).slice(), lessons: (S.progress[p.id] || []).slice(), stars: {}, roles: [], last_role: "seasonal" });

  function rpc(fn, b) {
    b = b || {};
    const p = PEOPLE.find((e) => e.id === TOK[b.p_token]) || null;
    if (fn === "whoami") return p ? { ok: true, employee: clone(p) } : { ok: false, error: "auth" };
    if (fn === "my_state") return p ? stateOf(p) : { ok: false, error: "auth" };
    if (fn === "my_reset_at") return { ok: true, reset_at: null };
    if (fn === "cms_list_lessons") return [];
    if (fn === "team_scores") return { ok: true, rows: [] };
    if (fn === "team_profiles") return { ok: true, rows: [], scope: "all" };
    if (fn === "my_mentors") return { ok: true, rows: [] };
    if (fn === "qday_inbox") return { ok: true, items: [] };
    if (fn === "menu_progress_team") return { ok: true, rows: [] };
    if (fn === "case_list") return { ok: true, lead: isLead(p), team: 0, fresh: 0, inbox: 0, mine_new: 0, top: null };
    if (fn === "menu_get") return clone(S.menu);
    if (fn === "menu_set") {
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      let ds = b.p_dishes; try { if (typeof ds === "string") ds = JSON.parse(ds); } catch (e) { ds = null; }
      if (!Array.isArray(ds)) return { ok: false, error: "bad_request" };
      S.menu = ds; return { ok: true };
    }
    if (fn === "schedule_load") { const mk = b.p_month || TODAY.slice(0, 7); return { ok: true, venues: [{ venue_key: "main", config: clone(CFG) }], months: [{ venue_key: "main", payload: clone(monOf(mk + "-01")) }] }; }
    if (fn === "schedule_save_month") {
      if (!isLead(p) && !(p && ["senior_bartender"].includes(p.position))) return { ok: false, error: "forbidden" };
      let pl = null; try { pl = typeof b.p_payload === "string" ? JSON.parse(b.p_payload) : b.p_payload; } catch (e) {}
      if (!pl) return { ok: false, error: "bad_request" };
      S.months[b.p_month] = pl; S.saved.push({ month: b.p_month, at: now() }); return { ok: true };
    }
    if (fn === "schedule_wishes_get") return { ok: true, wishes: clone(S.wishes[b.p_month] || []) };
    if (fn === "schedule_wish_set") {
      if (!p) return { ok: false, error: "auth" };
      const mk = String(b.p_month || ""), list = (S.wishes[mk] = (S.wishes[mk] || []).filter((w) => !(String(w.staff_id) === String(b.p_staff_id) && w.day === Number(b.p_day))));
      if (b.p_on) list.push({ staff_id: b.p_staff_id, day: Number(b.p_day), kind: b.p_kind === "hard" ? "hard" : "off" });
      return { ok: true };
    }
    if (fn === "swap_list") return { ok: true, swaps: [] };
    if (fn === "brief_today") return { ok: true, brief: S.brief && S.brief.data && S.brief.data.day === TODAY ? clone(S.brief) : null };
    if (fn === "brief_reads") return { ok: true, brief: null, rows: [], n: 0 };
    if (fn === "brief_publish") {
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      const again = !!(S.brief && S.brief.data && S.brief.data.day === TODAY);
      S.brief = { data: b.p_data, author: full(p), mine: true, sent: 0, at: now() };
      return { ok: true, again, sent: 0, bot: false };
    }
    if (!/^chat_/.test(fn)) return { code: "PGRST202", message: "demo: " + fn };
    S.log.push({ fn, at: now() }); if (S.log.length > 200) S.log.splice(0, S.log.length - 200);
    if (!p) return { ok: false, error: "auth" };
    if (fn === "chat_list") {
      const list = S.chats.filter((c) => visible(c, p) && (c.kind !== "dm" || S.msgs.some((m) => m.chat === c.id && !m.del))).map((c) => view(c, p));
      const ord = { team: 0, leads: 1, net: 2, group: 3, dm: 4 };
      list.sort((x, y) => ord[x.kind] - ord[y.kind]);
      return { ok: true, me: { id: p.id, name: full(p), pos: p.position, lead: isLead(p), network: !!p.is_admin || p.position === "senior", restaurant: p.restaurant }, chats: list,
        unread: list.reduce((s, c) => s + c.unread, 0), calls: calls(p) };
    }
    if (fn === "chat_unread") return { ok: true, unread: S.chats.filter((c) => visible(c, p)).reduce((s, c) => s + unread(c, p), 0), calls: calls(p) };
    if (fn === "chat_open") {
      const c = chatOf(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
      let list = S.msgs.filter((m) => m.chat === c.id), more = false;
      if (b.p_before) { list = list.filter((m) => m.id < b.p_before && !m.del); more = list.length > 40; list = list.slice(-40); }
      else if (b.p_after) list = list.filter((m) => m.id > b.p_after || (b.p_since && Date.parse(m.upd) >= Date.parse(b.p_since) - 5000));
      else { list = list.filter((m) => !m.del); more = list.length > 60; list = list.slice(-60); }
      const pin = c.pin ? msgOf(c.pin) : null;
      return { ok: true, chat: view(c, p), msgs: list.map((m) => smart(m, p)), members: members(c).map((e) => ({ id: e.id, name: full(e), pos: e.position, rest: e.restaurant, read: rd(c, e.id) })), more,
        pin: c.kind !== "dm" && pin && !pin.del ? J(pin) : null, now: now() };
    }
    if (fn === "chat_read") { const c = chatOf(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" }; setRead(c, p.id, Math.min(Number(b.p_last) || 0, S.seq)); return { ok: true }; }
    if (fn === "chat_send" || fn === "chat_photo_send") {
      const c = chatOf(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
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
    if (fn === "chat_photo") { const ph = S.photos[b.p_id]; return ph ? { ok: true, data: b.p_full ? ph.full : ph.thumb, mime: "image/jpeg", w: ph.w, h: ph.h } : { ok: false, error: "not_found" }; }
    if (fn === "chat_react") {
      const m = msgOf(b.p_msg); if (!m || m.del || !visible(chatOf(m.chat), p)) return { ok: false, error: "not_found" };
      m.reacts = m.reacts.filter((x) => x.emp !== p.id); if (b.p_r) m.reacts.push({ r: b.p_r, emp: p.id, name: full(p) }); touch(m); return { ok: true, msg: smart(m, p) };
    }
    if (fn === "chat_people") return { ok: true, people: PEOPLE.filter((e) => e.id !== p.id && e.restaurant === p.restaurant).map((e) => ({ id: e.id, name: full(e), pos: e.position, shift: !!personToday(e) })) };
    if (fn === "chat_dm") {
      const peer = who(String(b.p_emp)); if (!peer || peer.id === p.id || peer.restaurant !== p.restaurant) return { ok: false, error: "not_found" };
      let c = S.chats.find((x) => x.kind === "dm" && x.members.includes(p.id) && x.members.includes(peer.id));
      if (!c) { c = { id: Math.max(...S.chats.map((x) => x.id)) + 1, kind: "dm", rest: p.restaurant, members: [p.id, peer.id], pin: null }; S.chats.push(c); }
      return { ok: true, chat: view(c, p) };
    }
    if (fn === "chat_delete") {
      const m = msgOf(b.p_msg); if (!m) return { ok: false, error: "not_found" };
      const mc = chatOf(m.chat);
      if (m.emp !== p.id && !(mc.kind === "net" ? !!p.is_admin || p.position === "senior" : mc.kind !== "dm" && isLead(p))) return { ok: false, error: "forbidden" };
      if (m.kind === "card" && m.card && m.card.t === "shift" && m.card.st === "open") m.card.st = "off";
      m.del = true; m.body = ""; m.photo = null; m.reacts = []; touch(m); S.chats.forEach((c) => { if (c.pin === m.id) c.pin = null; });
      return { ok: true };
    }
    if (fn === "chat_edit") {
      const m = msgOf(b.p_msg); if (!m || m.del || m.emp !== p.id || m.kind !== "text") return { ok: false, error: "not_found" };
      const body = String(b.p_body || "").trim().slice(0, 1000); if (!body) return { ok: false, error: "bad_request" };
      m.body = body; m.edited = true; touch(m); return { ok: true, msg: smart(m, p) };
    }
    if (fn === "chat_pin") {
      const c = chatOf(b.p_chat); if (!visible(c, p) || c.kind === "dm") return { ok: false, error: "not_found" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      c.pin = b.p_msg ? Number(b.p_msg) : null; return { ok: true, pin: c.pin ? J(msgOf(c.pin)) : null };
    }
    if (fn === "chat_call") {
      const c = chatOf(b.p_chat); if (!visible(c, p) || c.kind !== "team") return { ok: false, error: "not_found" };
      const k = { who: b.p_who || "waiter", why: b.p_why || "help", table: cut(b.p_table, 8), text: cut(b.p_text, 80), emp: b.p_emp || null, going: [] };
      return { ok: true, msg: J(put(c, p, "", { kind: "call", call: k })) };
    }
    if (fn === "chat_go") {
      const m = msgOf(b.p_msg); if (!m || m.kind !== "call") return { ok: false, error: "not_found" };
      m.call.going = [...(m.call.going || []).filter((x) => x.emp !== p.id), { emp: p.id, name: full(p), at: now() }]; touch(m); return { ok: true, msg: J(m) };
    }
    // ── смены ──
    const shiftMsg = () => { const m = msgOf(b.p_msg); return m && !m.del && m.kind === "card" && m.card.t === "shift" && visible(chatOf(m.chat), p) ? m : null; };
    if (fn === "chat_shift_mine") {
      const s = staffOf(p.id), out = [];
      if (s) for (let i = 0; i <= 31; i++) {
        const iso = D(i), sh = def(code(String(s.id), iso));
        if (!sh || S.msgs.some((m) => m.emp === p.id && m.kind === "card" && !m.del && m.card.t === "shift" && m.card.st === "open" && m.card.date === iso)) continue;
        out.push({ date: iso, venue: "main", k: sh.k, label: sh.name, time: hh(sh.from) + "–" + hh(sh.to), pos: SPOS[s.pos][0] });
      }
      return { ok: true, shifts: out, schedule: true };
    }
    if (fn === "chat_shift_offer") {
      const c = chatOf(b.p_chat); if (!c || c.kind === "net" || !visible(c, p)) return { ok: false, error: "not_found" };
      if (!["give", "swap"].includes(b.p_mode)) return { ok: false, error: "bad_request" };
      const s = staffOf(p.id); if (!s) return { ok: false, error: "not_in_schedule" };
      const k = code(String(s.id), b.p_date), sh = def(k); if (!sh) return { ok: false, error: "no_shift" };
      if (S.msgs.some((m) => m.emp === p.id && m.kind === "card" && !m.del && m.card.t === "shift" && m.card.st === "open" && m.card.date === b.p_date)) return { ok: false, error: "already" };
      const want = b.p_mode === "swap" ? [...new Set((b.p_want || []).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= TODAY && x !== b.p_date))].sort().slice(0, 14) : [];
      const card = { t: "shift", mode: b.p_mode, ...shiftCard(s, b.p_date, k), from: p.id, fromName: full(p), sid: String(s.id), want, note: cut(b.p_note, 120), st: "open" };
      return { ok: true, msg: smart(cardMsg(c, p, card), p) };
    }
    if (fn === "chat_shift_need") {
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      const c = b.p_chat == null ? teamOf(p.restaurant) : chatOf(b.p_chat);
      if (!c || !["team", "group"].includes(c.kind) || !visible(c, p)) return { ok: false, error: "not_found" };
      const dt = String(b.p_date || ""), pos = String(b.p_pos || ""), sh = def(b.p_k);
      let n = Number(b.p_n) || 1;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dt) || dt < TODAY || dt > D(45) || !/^[a-z_]{2,20}$/.test(pos) || n < 1 || n > 5) return { ok: false, error: "bad_request" };
      if (!sh) return { ok: false, error: "no_shift" };
      let inst = null;
      if (b.p_instead != null) {
        const row = SSTAFF.find((s) => String(s.id) === String(b.p_instead));
        if (!row || row.pos !== pos || code(String(row.id), dt) !== b.p_k) return { ok: false, error: "bad_request" };
        inst = { sid: String(row.id), name: row.name.split(" ").reverse().join(" ") }; n = 1;
      }
      if (S.msgs.some((m) => m.chat === c.id && m.kind === "card" && !m.del && m.card.t === "shift" && m.card.mode === "need" && m.card.st === "open" && m.card.date === dt
        && m.card.posKey === pos && m.card.k === b.p_k && ((m.card.instead && m.card.instead.sid) || null) === (inst ? inst.sid : null))) return { ok: false, error: "already" };
      const card = { t: "shift", mode: "need", date: dt, k: b.p_k, label: sh.name, time: hh(sh.from) + "–" + hh(sh.to), pos: SPOS[pos] ? SPOS[pos][0] : pos, posKey: pos, n,
        from: p.id, fromName: full(p), ...(cut(b.p_note, 120) ? { note: cut(b.p_note, 120) } : {}), st: "open", ...(inst ? { instead: inst } : {}), took: [] };
      return { ok: true, msg: smart(cardMsg(c, p, card), p) };
    }
    if (fn === "chat_shift_take" || fn === "chat_shift_swap") {
      const m = shiftMsg(); if (!m) return { ok: false, error: "not_found" };
      if (m.card.st !== "open") return { ok: false, error: "taken", msg: smart(m, p) };
      const swap = fn === "chat_shift_swap";
      if (swap ? m.card.mode !== "swap" : !["give", "need"].includes(m.card.mode)) return { ok: false, error: "bad_request" };
      if (m.card.from === p.id) return { ok: false, error: "bad_request" };
      if (m.card.mode === "need") {
        const v = needCheck(m.card, p.id);
        if (!v.can) return { ok: false, error: "not_allowed", why: v.why || "", msg: smart(m, p) };
        const first = !(m.card.took || []).length;
        apply([{ date: m.card.date, sid: String(v.ts.id), k: m.card.k }, ...(first && m.card.instead ? [{ date: m.card.date, sid: String(m.card.instead.sid), k: null }] : [])]);
        m.card.took = [...(m.card.took || []), { id: p.id, name: full(p), sid: String(v.ts.id), at: now() }];
        if (m.card.took.length >= (m.card.n || 1)) Object.assign(m.card, { st: "done", by: p.id, byName: full(p), at: now() });
        touch(m); done(chatOf(m.chat), m, p);
        return { ok: true, msg: smart(m, p) };
      }
      const v = check(m.card, p.id);
      if (!swap) {
        if (!v.can) return { ok: false, error: "not_allowed", why: v.why || "" };
        apply([{ date: m.card.date, sid: String(v.gs.id), k: null }, { date: m.card.date, sid: String(v.ts.id), k: m.card.k }]);
        Object.assign(m.card, { st: "done", by: p.id, byName: full(p), at: now() });
      } else {
        const o = options(m.card, p.id), opt = o.shifts.find((x) => x.date === b.p_date);
        if (!opt) return { ok: false, error: "not_allowed", why: o.why || "Эта смена не подходит для обмена" };
        apply([{ date: m.card.date, sid: String(v.gs.id), k: null }, { date: m.card.date, sid: String(v.ts.id), k: m.card.k }, { date: b.p_date, sid: String(v.ts.id), k: null }, { date: b.p_date, sid: String(v.gs.id), k: opt.k }]);
        Object.assign(m.card, { st: "done", by: p.id, byName: full(p), byDate: b.p_date, byK: opt.k, byLabel: opt.label, at: now() });
      }
      touch(m); done(chatOf(m.chat), m, p);
      return { ok: true, msg: smart(m, p) };
    }
    if (fn === "chat_shift_options") {
      const m = shiftMsg(); if (!m) return { ok: false, error: "not_found" };
      if (m.card.mode !== "swap" || m.card.st !== "open" || m.card.from === p.id) return { ok: false, error: "bad_request" };
      return { ok: true, ...options(m.card, p.id) };
    }
    if (fn === "chat_shift_cancel") {
      const m = shiftMsg(); if (!m) return { ok: false, error: "not_found" };
      if (m.card.from !== p.id) return { ok: false, error: "forbidden" };
      if (m.card.st !== "open") return { ok: false, error: "taken", msg: smart(m, p) };
      m.card.st = "off"; m.card.at = now(); touch(m); return { ok: true, msg: smart(m, p) };
    }
    // v97: заявки на месяц для «Графика»: открытые, с сегодняшнего дня, в чатах заведения, где я есть
    if (fn === "chat_shift_board") {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(b.p_month || ""))) return { ok: false, error: "bad_request" };
      const offers = S.msgs.filter((m) => !m.del && m.kind === "card" && m.card.t === "shift" && m.card.st === "open" && m.card.date.slice(0, 7) === b.p_month && m.card.date >= TODAY
        && ["team", "group"].includes((chatOf(m.chat) || {}).kind) && visible(chatOf(m.chat), p))
        .sort((x, y) => (x.card.date < y.card.date ? -1 : x.card.date > y.card.date ? 1 : x.id - y.id))
        .map((m) => ({ msg: m.id, chat: m.chat, mine: m.card.from === p.id, card: smart(m, p).card }));
      return { ok: true, offers };
    }
    // v97: карточка коллеги (нажатие на имя): должность, смена сегодня и ближайшая (две недели), есть ли личная
    if (fn === "chat_person") {
      const e = who(String(b.p_emp));
      if (!e || !(e.restaurant === p.restaurant || (isLead(p) && isLead(e)))) return { ok: false, error: "not_found" };
      const t = personToday(e), nx = personNext(e);
      const dm = S.chats.find((x) => x.kind === "dm" && x.members.includes(p.id) && x.members.includes(e.id));
      return { ok: true, person: { id: e.id, name: full(e), pos: e.position, rest: e.restaurant, me: e.id === p.id, same: e.restaurant === p.restaurant, today: t, next: t ? null : nx, dm: dm ? dm.id : null } };
    }
    // v97: стоп из Меню — карточка в «Вся команда»; «Вернуть» отмечает все открытые карточки этого блюда
    if (fn === "chat_stop_note") {
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      const c = teamOf(p.restaurant); if (!c) return { ok: false, error: "not_found" };
      const id = String(b.p_dish || ""); if (!id) return { ok: false, error: "bad_request" };
      if (b.p_on) {
        const d = S.menu.find((x) => x && String(x.id) === id && x.kind !== "cocktail"); if (!d) return { ok: false, error: "not_found" };
        const was = [...S.msgs].reverse().find((m) => m.chat === c.id && !m.del && m.kind === "card" && m.card.t === "stop" && m.card.st === "on" && m.card.dish.id === id);
        if (was) return { ok: true, again: true, msg: smart(was, p) };
        return { ok: true, msg: smart(cardMsg(c, p, { t: "stop", st: "on", from: "menu", dish: { id, name: cut(d.name, 120) } }), p) };
      }
      let last = null, n = 0;
      S.msgs.filter((m) => m.rest === p.restaurant && !m.del && m.kind === "card" && m.card.t === "stop" && m.card.st === "on" && m.card.dish.id === id).forEach((m) => {
        Object.assign(m.card, { st: "off", offBy: full(p), offAt: now() }); m.body = cardSummary(m.card); touch(m); last = m; n++; });
      return { ok: true, n, msg: last ? smart(last, p) : null };
    }
    // ── задание, поделиться, опрос, брифинг, «График готов» (p_chat null — «Вся команда») ──
    if (fn === "chat_card_send") {
      const c = b.p_chat == null ? teamOf(p.restaurant) : chatOf(b.p_chat); if (!visible(c, p)) return { ok: false, error: "not_found" };
      const pc = b.p_card || {}, t = pc.t;
      let card;
      if (t === "task") {
        if (!isLead(p)) return { ok: false, error: "forbidden" };
        if (c.kind === "net") return { ok: false, error: "bad_request" };
        const it = item(pc.item, ["lesson", "quiz", "module"]);
        if (!it || (pc.due != null && !(/^\d{4}-\d{2}-\d{2}$/.test(pc.due) && pc.due >= TODAY && pc.due <= D(60)))) return { ok: false, error: "bad_request" };
        card = { t: "task", item: it, ...(pc.due ? { due: pc.due } : {}), to: "all" };
      } else if (t === "share") {
        const it = item(pc.item, c.kind === "net" ? ["lesson", "quiz", "module", "ref"] : ["dish", "cocktail", "ref", "lesson", "quiz", "module"]);
        if (!it) return { ok: false, error: "bad_request" };
        card = { t: "share", item: it, ...(cut(pc.note, 200) ? { note: cut(pc.note, 200) } : {}) };
      } else if (t === "poll") {
        if (c.kind === "dm") return { ok: false, error: "bad_request" };
        const q = cut(pc.q, 200), op = (Array.isArray(pc.opts) ? pc.opts : []).map((o) => cut(o, 60)).filter(Boolean);
        if (q.length < 3 || op.length < 2 || op.length > 6 || new Set(op.map((o) => o.toLowerCase())).size !== op.length) return { ok: false, error: "bad_request" };
        card = { t: "poll", q, opts: op };
      } else if (t === "brief") {
        if (!isLead(p)) return { ok: false, error: "forbidden" };
        if (c.kind !== "team") return { ok: false, error: "bad_request" };
        const lines = (Array.isArray(pc.lines) ? pc.lines : []).map((l) => cut(l, 140)).filter(Boolean);
        if (!lines.length) return { ok: false, error: "bad_request" };
        card = { t: "brief", date: TODAY, title: cut(pc.title, 80) || "Брифинг смены", lines: lines.slice(0, 8) };
        const was = [...S.msgs].reverse().find((m) => m.chat === c.id && !m.del && m.kind === "card" && m.card.t === "brief" && m.card.date === TODAY);
        if (was) { was.card = card; was.body = cardSummary(card); was.emp = p.id; was.name = full(p); touch(was); return { ok: true, again: true, msg: smart(was, p) }; }
      } else if (t === "sched") {
        if (!isLead(p)) return { ok: false, error: "forbidden" };
        if (c.kind !== "team") return { ok: false, error: "bad_request" };
        const mk = String(pc.month || ""), cur = TODAY.slice(0, 7), max = addD(TODAY.slice(0, 7) + "-01", 100).slice(0, 7);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mk) || mk < cur || mk > max) return { ok: false, error: "bad_request" };
        if (pc.what === "wishes") {
          const u = String(pc.until || "");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(u) || u < TODAY || u > D(62)) return { ok: false, error: "bad_request" };
          card = { t: "sched", what: "wishes", month: mk, until: u };
        } else card = { t: "sched", what: "ready", month: mk };
      } else return { ok: false, error: "bad_request" };
      return { ok: true, msg: smart(cardMsg(c, p, card), p) };
    }
    if (fn === "chat_task_remind") {
      const m = msgOf(b.p_msg); if (!m || m.del || m.kind !== "card" || m.card.t !== "task" || !visible(chatOf(m.chat), p)) return { ok: false, error: "not_found" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      if (m.card.reminded && clock() - Date.parse(m.card.reminded) < 3 * 3600e3) return { ok: false, error: "too_fast" };
      const w = taskWho(chatOf(m.chat), m.card, m.emp), dn = doneOf(w.map((x) => x.id), m.card.item), left = w.filter((x) => !dn.includes(x.id));
      m.card.reminded = now(); touch(m);
      return { ok: true, n: left.length, sent: left.filter((x) => S.tg.includes(x.id)).length, msg: smart(m, p) };
    }
    if (fn === "chat_poll_vote") {
      const m = msgOf(b.p_msg); if (!m || m.del || m.kind !== "card" || m.card.t !== "poll" || !visible(chatOf(m.chat), p)) return { ok: false, error: "not_found" };
      if (!(b.p_o >= 0 && b.p_o < m.card.opts.length)) return { ok: false, error: "bad_request" };
      const vs = S.votes[m.id] || [], was = vs.find((x) => x.emp === p.id);
      S.votes[m.id] = was && was.o === b.p_o ? vs.filter((x) => x.emp !== p.id) : [...vs.filter((x) => x.emp !== p.id), { o: b.p_o, emp: p.id, name: full(p), at: now() }];
      touch(m); return { ok: true, msg: smart(m, p) };
    }
    if (fn === "chat_stop_set") {
      const c = chatOf(b.p_chat); if (!c || !["team", "leads", "group"].includes(c.kind) || !visible(c, p)) return { ok: false, error: "not_found" };
      if (!isLead(p)) return { ok: false, error: "forbidden" };
      const ms = clock();
      let m = null;
      if (!b.p_on) { m = msgOf(b.p_msg); if (!m || m.chat !== c.id || m.del || m.kind !== "card" || m.card.t !== "stop") return { ok: false, error: "not_found" }; if (m.card.st === "off") return { ok: true, msg: smart(m, p) }; }
      const id = b.p_on ? b.p_dish : m.card.dish.id, d = S.menu.find((x) => x && String(x.id) === String(id) && x.kind !== "cocktail" && !x.archived);
      if (b.p_on) {
        if (!d) return { ok: false, error: "not_found" };
        if (!d.stop || typeof d.stop !== "object") { d.stop = { since: ms, by: full(p) }; d.stopAt = ms; }
        return { ok: true, msg: smart(cardMsg(c, p, { t: "stop", st: "on", dish: { id: String(d.id), name: cut(d.name, 120) } }), p) };
      }
      if (d && d.stop) { d.stop = null; d.stopAt = ms; }
      Object.assign(m.card, { st: "off", offBy: full(p), offAt: now() }); m.body = cardSummary(m.card); touch(m);
      return { ok: true, msg: smart(m, p) };
    }
    if (fn === "chat_ai_post") return { ok: false, error: "no_ai" };
    return { code: "PGRST202", message: "demo: " + fn };
  }
  // смена человека сегодня и ближайшая (для «Кто в смене» и карточки коллеги)
  function personToday(e) { const s = staffOf(e.id); const sh = s && def(code(String(s.id), TODAY)); return sh ? { label: sh.name, time: hh(sh.from) + "–" + hh(sh.to) } : null; }
  function personNext(e) { const s = staffOf(e.id); if (!s) return null; for (let i = 1; i <= 14; i++) { const iso = D(i), sh = def(code(String(s.id), iso)); if (sh) return { date: iso, label: sh.name, time: hh(sh.from) + "–" + hh(sh.to) }; } return null; }

  // ── то, что «делают коллеги» в демо: пишут, забирают смену, выходят по «Ищем в смену» ──
  const as = (id) => who(id);
  const bot = {
    say: (id, text, chatId = null) => { const e = as(id); const c = chatId != null ? chatOf(chatId) : teamOf(e.restaurant); return c && e ? J(put(c, e, text)) : null; },
    offer: (id, iso, mode = "give", note = "") => rpc("chat_shift_offer", { p_token: Object.keys(TOK).find((k) => TOK[k] === id), p_chat: teamOf(as(id).restaurant).id, p_date: iso, p_mode: mode, p_want: [], p_note: note }),
    need: (id, iso, pos, k, n = 1, instead = null) => rpc("chat_shift_need", { p_token: Object.keys(TOK).find((x) => TOK[x] === id), p_chat: null, p_date: iso, p_pos: pos, p_k: k, p_n: n, p_instead: instead }),
    take: (id, msg) => rpc("chat_shift_take", { p_token: Object.keys(TOK).find((k) => TOK[k] === id), p_msg: msg }),
    // кто из коллег (не я) может забрать или выйти по карточке
    taker: (m, notId) => PEOPLE.find((e) => e.id !== notId && e.id !== m.card.from && e.restaurant === R0 && (m.card.mode === "need" ? needCheck(m.card, e.id).can : check(m.card, e.id).can)) || null,
  };
  return { S, rpc, D, TODAY, bot, staffOf, code, monOf, msgOf, teamOf, chatOf };
}
