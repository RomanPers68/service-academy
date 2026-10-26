// tools/claude/chat-demo/demo-api.js — v90: демо-сервер чата в памяти (для показа и для просмотра вида).
// Те же ответы, что у сервера (этап 38): list, open, send, read, dm, people, call, go, del, edit, react, pin, photoSend,
// photo. Коллеги выдуманы и отвечают по сценарию: прочитали через секунду-две, ответили через три-четыре (на вопрос —
// с цитатой), на сообщение в группе ставят «Принято», на фото — «Огонь»; на вызов идёт тот, кого звали.
// «Руководители сети» — руководители Океана и выдуманного второго заведения «Два моря, Порт».
import { callLine, EDIT_HOURS } from "../../../lib/chat.js";

const PEOPLE = [
  { id: "p1", name: "Мария Ким", pos: "manager", shift: true },
  { id: "p2", name: "Ольга Ли", pos: "hostess", shift: true },
  { id: "p3", name: "Анна Смирнова", pos: "waiter", shift: true },
  { id: "p4", name: "Пётр Орлов", pos: "waiter", shift: true },
  { id: "p5", name: "Илья Белов", pos: "bartender", shift: true },
  { id: "p6", name: "Вера Соколова", pos: "waiter", shift: false },
  { id: "p7", name: "Глеб Морозов", pos: "senior_bartender", shift: false },
];
const OKEAN = "Два моря, Океан", PORT = "Два моря, Порт";
// руководители второго заведения — только в «Руководителях сети»
const NET_PEOPLE = [{ id: "n1", name: "Ирина Белова", pos: "manager", rest: PORT }, { id: "n2", name: "Сергей Литвинов", pos: "owner", rest: PORT }];
const ROLE_POS = { lead: ["manager", "senior", "service_manager", "owner", "admin"], host: ["hostess"], bar: ["bartender", "senior_bartender"], waiter: ["waiter"] };

// фото коллеги в демо: карта коктейлей на барной стойке, нарисованная прямо в странице
function drawCard(side) {
  try {
    const W = Math.round(side * 0.8), H = side;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"), k = W / 1080;
    const wood = g.createLinearGradient(0, 0, W, H); wood.addColorStop(0, "#3a2414"); wood.addColorStop(0.5, "#5a3a20"); wood.addColorStop(1, "#2e1c0f");
    g.fillStyle = wood; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.12; g.strokeStyle = "#1a0f07";
    for (let i = 0; i < 46; i++) { g.lineWidth = (1 + (i % 3)) * k; g.beginPath(); g.moveTo(0, i * 31 * k); g.bezierCurveTo(W * 0.3, (i * 31 + 14) * k, W * 0.7, (i * 31 - 12) * k, W, (i * 31 + 6) * k); g.stroke(); }
    g.globalAlpha = 1;
    const glow = g.createRadialGradient(W * 0.75, H * 0.12, 10, W * 0.75, H * 0.12, W * 0.9); glow.addColorStop(0, "rgba(255,210,140,0.35)"); glow.addColorStop(1, "rgba(255,210,140,0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2); g.rotate(-0.05);
    const pw = 760 * k, ph = 1040 * k;
    g.shadowColor = "rgba(0,0,0,0.55)"; g.shadowBlur = 40 * k; g.shadowOffsetY = 18 * k;
    g.fillStyle = "#f3ead7"; g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.shadowColor = "transparent";
    g.strokeStyle = "#b08d4f"; g.lineWidth = 3 * k; g.strokeRect(-pw / 2 + 28 * k, -ph / 2 + 28 * k, pw - 56 * k, ph - 56 * k);
    g.fillStyle = "#7a5a22"; g.textAlign = "center";
    g.font = "italic " + Math.round(34 * k) + "px Georgia, serif"; g.fillText("бар «Два моря»", 0, -ph / 2 + 120 * k);
    g.fillStyle = "#2a1f0e"; g.font = "bold " + Math.round(70 * k) + "px Georgia, serif"; g.fillText("Коктейли", 0, -ph / 2 + 210 * k);
    g.fillStyle = "#7a5a22"; g.font = "italic " + Math.round(38 * k) + "px Georgia, serif"; g.fillText("осенняя карта", 0, -ph / 2 + 265 * k);
    const rows = [["Облепиховый сауэр", "590"], ["Груша и розмарин", "620"], ["Кедровый негрони", "650"], ["Тёплый сидр с корицей", "480"], ["Клюква и тоник", "450"]];
    rows.forEach(([n, p], i) => {
      const y = -ph / 2 + (380 + i * 118) * k;
      g.textAlign = "left"; g.fillStyle = "#2a1f0e"; g.font = Math.round(40 * k) + "px Georgia, serif"; g.fillText(n, -pw / 2 + 70 * k, y);
      g.textAlign = "right"; g.fillStyle = "#7a5a22"; g.fillText(p, pw / 2 - 70 * k, y);
      g.strokeStyle = "rgba(122,90,34,0.35)"; g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(-pw / 2 + 70 * k, y + 30 * k); g.lineTo(pw / 2 - 70 * k, y + 30 * k); g.stroke();
    });
    g.restore();
    return c.toDataURL("image/jpeg", 0.8);
  } catch (e) { return ""; }
}

export function demoApi({ me = { id: "me", name: "Роман", pos: "manager", lead: true, network: true, restaurant: OKEAN }, onChange = () => {} } = {}) {
  const T0 = Date.now();
  const at = (minAgo) => new Date(T0 - minAgo * 60000).toISOString();
  const all = [me, ...PEOPLE];
  const everyone = [...all, ...NET_PEOPLE];
  const byId = (id) => everyone.find((p) => String(p.id) === String(id));
  const restOf = (p) => (p && p.rest) || OKEAN;
  let seq = 100;
  const chats = [
    { id: "team", kind: "team", members: all.map((p) => p.id), pin: null },
    { id: "leads", kind: "leads", members: [me.id, "p1", "p7"], pin: null },
    { id: "net", kind: "net", members: [me.id, "p1", "p7", "n1", "n2"], pin: null },
    { id: "dm-p3", kind: "dm", members: [me.id, "p3"] },
    { id: "dm-p1", kind: "dm", members: [me.id, "p1"] },
  ];
  const msgs = [];
  const reads = {};   // chat → emp → lastId
  const photos = {};  // id → { full, thumb } (data URL) или { draw }
  const R = (r, ...ids) => ids.map((e) => ({ r, emp: e, name: byId(e).name }));
  const quote = (m) => (m ? { id: m.id, emp: m.emp, name: m.name, kind: m.kind, body: m.body, photo: m.kind === "photo", del: !!m.del } : null);
  const put = (chat, emp, body, minAgo, extra = {}) => {
    const p = byId(emp);
    const m = { id: ++seq, chat, emp, name: p.name, rest: restOf(p), body, kind: "text", call: null, photo: null, reply: null, reacts: [], edited: false, del: false,
      at: minAgo ? at(minAgo) : new Date().toISOString(), upd: 0, ...extra };
    if (m.kind === "call") m.body = callLine(m, null);
    msgs.push(m); return m;
  };
  const touch = (m) => { m.upd = Date.now(); };
  const readAll = (chat, upto, except = []) => { const c = chats.find((x) => x.id === chat); reads[chat] = reads[chat] || {}; c.members.forEach((e) => { if (!except.includes(e)) reads[chat][e] = Math.max(reads[chat][e] || 0, upto); }); };
  // вчера
  put("team", "p1", "Всем спасибо за смену! Вечер был плотный, гости довольны.", 60 * 26, { reacts: [...R("heart", "p3", "p4"), ...R("like", me.id)] });
  // сегодня
  const brief = put("team", "p1", "Доброе утро! Сегодня банкет на 12 человек в 19:00 на веранде. Брифинг в 11:30.", 310, { reacts: R("ok", "p2", "p3", "p4", "p5") });
  put("team", "p1", "Мария закрепляет «Доброе утро! Сегодня банкет на 12 человек в 19:00…»", 309, { kind: "sys", reply: quote(brief) });
  chats[0].pin = brief.id;
  const lime = put("team", "p5", "Лайм закончился. Кто заглянет на склад?", 300);
  put("team", "p4", "Иду, принесу два килограмма", 299, { reply: quote(lime), reacts: R("like", "p5") });
  put("team", "p2", "", 240, { kind: "call", call: { who: "lead", why: "guest", going: [{ id: "p1", name: "Мария Ким", at: at(239) }] } });
  const chair = put("team", "p3", "Шестой стол просит детский стульчик, свободный есть?", 120);
  put("team", "p2", "Есть у входа, сейчас принесу", 119, { reply: quote(chair), reacts: R("heart", "p3") });
  const mine = put("team", me.id, "Спасибо, команда. В 18:00 вместе проверим веранду перед банкетом.", 60, { edited: true, reacts: R("ok", "p1", "p2") });
  photos.d1 = { draw: true };
  put("team", "p5", "На баре новая карта коктейлей, гляньте до вечера", 12, { kind: "photo", photo: { id: "d1", w: 1024, h: 1280 }, reacts: R("fire", "p3", "p4") });
  readAll("team", mine.id, ["p6", "p7"]);
  reads.team[me.id] = mine.id;
  put("leads", "p1", "Вечером не хватает одного официанта. Вера сможет выйти?", 200);
  put("leads", "p7", "Спрошу её. И завтра поставка вина в 12:00, приму сам.", 195);
  reads.leads = { [me.id]: 0, p1: seq, p7: seq };
  // сеть: Порт просит бокалы, Океан даёт; планёрка закреплена
  const glasses = put("net", "n1", "Коллеги, в Порту закончились бокалы для игристого. Кто одолжит 12 штук до завтра?", 95);
  put("net", "p1", "Океан даст, заберите после 15:00", 90, { reply: quote(glasses), reacts: R("ok", "n1") });
  const plan = put("net", "n2", "Напоминаю: в четверг общая планёрка в 11:00 в Океане. От каждого заведения итоги месяца.", 40, { reacts: R("ok", "p1") });
  put("net", "n2", "Сергей закрепляет «Напоминаю: в четверг общая планёрка в 11:00 в…»", 39, { kind: "sys", reply: quote(plan) });
  chats.find((c) => c.id === "net").pin = plan.id;
  reads.net = { [me.id]: glasses.id + 1, p1: seq, p7: glasses.id, n1: seq, n2: seq };
  put("dm-p1", me.id, "Банкет подтвердили?", 90);
  put("dm-p1", "p1", "Да, предоплата есть, меню согласовали.", 88, { reacts: R("like", me.id) });
  reads["dm-p1"] = { [me.id]: seq, p1: seq };
  put("dm-p3", "p3", "Роман, можно в субботу поменяться сменой с Петром? Он не против.", 20);
  reads["dm-p3"] = { [me.id]: 0, p3: seq };

  const later = (ms, fn) => setTimeout(() => { fn(); onChange(); }, ms);
  const ok = (x) => new Promise((res) => setTimeout(() => res({ ok: true, ...x }), 90 + Math.random() * 90));
  const no = (error) => Promise.resolve({ ok: false, error });
  const chatOf = (id) => chats.find((c) => String(c.id) === String(id));
  const visible = (c) => c && c.members.includes(me.id);
  const msgOf = (id) => msgs.find((x) => String(x.id) === String(id));
  const last = (cid) => [...msgs].reverse().find((m) => m.chat === cid && !m.del) || null;   // v91: удалённое — без следа
  const unread = (cid) => msgs.filter((m) => m.chat === cid && !m.del && String(m.emp) !== String(me.id) && m.id > ((reads[cid] || {})[me.id] || 0)).length;
  const forMe = (m) => m.kind === "call" && String(m.emp) !== String(me.id) && (m.call.who === "person" ? String(m.call.emp) === String(me.id) : (ROLE_POS[m.call.who] || []).includes(me.pos));
  const J = (m) => (m ? { ...m, call: m.call ? { ...m.call, going: [...(m.call.going || [])] } : null, photo: m.photo ? { ...m.photo } : null, reply: m.reply ? { ...m.reply } : null,
    reacts: (m.reacts || []).map((x) => ({ ...x })), body: m.del ? "" : m.body } : null);
  const view = (c) => ({ id: c.id, kind: c.kind, members: c.members.length, shift: c.kind === "team" ? all.filter((p) => p.id === me.id || p.shift).length : undefined,
    peer: c.kind === "dm" ? (() => { const p = byId(c.members.find((e) => e !== me.id)); return p && { id: p.id, name: p.name, pos: p.pos, shift: !!p.shift }; })() : undefined,
    last: J(last(c.id)), unread: unread(c.id), cleared: c.cleared || null });
  const RANK = { team: 0, leads: 1, net: 2, dm: 3 };
  const order = (a, b) => RANK[a.kind] - RANK[b.kind] || ((last(b.id) || { id: 0 }).id - (last(a.id) || { id: 0 }).id);
  const members = (c) => c.members.map((e) => ({ id: e, name: byId(e).name, rest: restOf(byId(e)), read: (reads[c.id] || {})[e] || 0 }));
  const pinOf = (c) => { const m = c.pin ? msgOf(c.pin) : null; return m && !m.del ? J(m) : null; };
  // кто ответит в переписке
  const REPLY = {
    team: [["p1", "Принято, спасибо"], ["p4", "Сделаю"], ["p2", "Хорошо, передам гостям"], ["p5", "Понял"], ["p3", "Поняла, иду"]],
    leads: [["p1", "Согласна"], ["p7", "Хорошо, возьму на себя"]],
    net: [["n1", "Спасибо, коллеги"], ["n2", "Принято, обсудим на планёрке"], ["p1", "Поддерживаю"]],
  };
  let ri = 0;
  const peerOf = (c) => c.members.find((e) => e !== me.id);
  const react = (m, emp, r) => { m.reacts = [...(m.reacts || []).filter((x) => x.emp !== emp), { r, emp, name: byId(emp).name }]; touch(m); };
  const answer = (c, mine) => {
    const body = mine.body || "", q = /\?/.test(body), photo = mine.kind === "photo";
    if (c.kind === "dm") {
      const p = peerOf(c);
      later(1100, () => { reads[c.id] = reads[c.id] || {}; reads[c.id][p] = seq; });
      if (photo) { later(2300, () => react(mine, p, "heart")); return; }
      later(3300, () => put(c.id, p, q ? "Сейчас посмотрю и отвечу" : ["Спасибо!", "Хорошо", "Поняла, сделаю", "Договорились"][ri++ % 4], 0, q ? { reply: quote(mine) } : {}));
      return;
    }
    const others = c.members.filter((e) => e !== me.id && (c.kind !== "team" || (byId(e) || {}).shift));
    others.forEach((e, i) => later(900 + i * 650, () => { reads[c.id] = reads[c.id] || {}; reads[c.id][e] = seq; }));
    const pool = REPLY[c.kind] || REPLY.team;
    if (photo) { later(2200, () => react(mine, "p3", "fire")); later(3000, () => react(mine, "p4", "heart")); return; }
    later(2200, () => react(mine, pool[0][0], "ok"));
    const [who, text] = q ? [pool[0][0], "Сейчас уточню и напишу"] : pool[ri++ % pool.length];
    later(3600, () => put(c.id, who, text, 0, q ? { reply: quote(mine) } : {}));
  };
  const goer = (call) => (call.who === "person" ? call.emp : (all.find((p) => p.id !== me.id && p.shift && (ROLE_POS[call.who] || []).includes(p.pos)) || {}).id);
  const api = {
    me,
    list: () => ok({ me, chats: chats.filter((c) => visible(c) && (c.kind !== "dm" || msgs.some((m) => m.chat === c.id && !m.del))).map(view).sort(order),
      calls: msgs.filter((m) => forMe(m) && !(m.call.going || []).length && !m.del).map(J) }),
    open: (cid, { after = 0, before = 0, since = 0 } = {}) => {
      const c = chatOf(cid);
      if (!visible(c)) return no("not_found");
      let list = msgs.filter((m) => m.chat === c.id);
      let more = false;
      if (before) { list = list.filter((m) => m.id < before && !m.del); more = list.length > 40; list = list.slice(-40); }
      else if (after) list = list.filter((m) => m.id > after || (m.upd && since && m.upd > Number(since) - 5000));
      else { list = list.filter((m) => !m.del); more = list.length > 60; list = list.slice(-60); }
      return ok({ chat: view(c), msgs: list.map(J), members: members(c), more, pin: c.kind === "dm" ? null : pinOf(c), now: Date.now() });
    },
    send: (cid, body, replyId = null) => {
      const c = chatOf(cid);
      if (!visible(c)) return no("not_found");
      const q = replyId ? msgOf(replyId) : null;
      const m = put(c.id, me.id, String(body).slice(0, 1000), 0, { reply: q && q.chat === c.id ? quote(q) : null });
      reads[c.id] = reads[c.id] || {}; reads[c.id][me.id] = m.id;
      answer(c, m);
      return ok({ msg: J(m) });
    },
    photoSend: (cid, { full, thumb, w, h, body = "", reply = null } = {}) => {
      const c = chatOf(cid);
      if (!visible(c)) return no("not_found");
      if (!full || !thumb) return no("bad_request");
      const pid = "u" + (++seq);
      photos[pid] = { full: "data:image/jpeg;base64," + full, thumb: "data:image/jpeg;base64," + thumb };
      const q = reply ? msgOf(reply) : null;
      const m = put(c.id, me.id, String(body || "").slice(0, 1000), 0, { kind: "photo", photo: { id: pid, w, h }, reply: q && q.chat === c.id ? quote(q) : null });
      reads[c.id] = reads[c.id] || {}; reads[c.id][me.id] = m.id;
      answer(c, m);
      return new Promise((res) => setTimeout(() => res({ ok: true, msg: J(m) }), 700));
    },
    photo: (id, full) => {
      const p = photos[id];
      if (!p) return no("not_found");
      if (p.draw && !p.full) { p.full = drawCard(1280); p.thumb = drawCard(360); }
      return new Promise((res) => setTimeout(() => res({ ok: true, url: full ? p.full : p.thumb }), full ? 350 : 200));
    },
    read: (cid, upto) => { reads[cid] = reads[cid] || {}; reads[cid][me.id] = Math.max(reads[cid][me.id] || 0, Number(upto) || 0); return ok({}); },
    people: () => ok({ people: PEOPLE.map((p) => ({ ...p })) }),
    dm: (emp) => {
      let c = chats.find((x) => x.kind === "dm" && x.members.includes(String(emp)) && x.members.includes(me.id));
      if (!c) { c = { id: "dm-" + emp, kind: "dm", members: [me.id, String(emp)] }; chats.push(c); }
      return ok({ chat: view(c) });
    },
    call: ({ chat, who, emp, why, table, text }) => {
      const p = emp ? byId(emp) : null;
      const m = put("team", me.id, "", 0, { kind: "call", call: { who, emp: emp || null, toName: p ? p.name : "", why, table: table || "", text: text || "", going: [] } });
      const g = goer(m.call);
      if (g) later(3200, () => { m.call.going = [{ id: g, name: byId(g).name, at: new Date().toISOString() }]; touch(m); });
      void chat;
      return ok({ msg: J(m) });
    },
    go: (id) => {
      const m = msgOf(id);
      if (!m || m.kind !== "call") return no("not_found");
      m.call.going = [...(m.call.going || []).filter((g) => g.id !== me.id), { id: me.id, name: me.name, at: new Date().toISOString() }]; touch(m);
      return ok({ msg: J(m) });
    },
    edit: (id, body) => {
      const m = msgOf(id);
      if (!m || m.del || m.emp !== me.id || !(m.kind === "text" || m.kind === "photo")) return no("not_found");
      if (Date.now() - new Date(m.at).getTime() > EDIT_HOURS * 3600000) return no("too_late");
      const b = String(body || "").trim().slice(0, 1000);
      if (!b && m.kind !== "photo") return no("bad_request");
      m.body = b; m.edited = true; touch(m);
      return ok({ msg: J(m) });
    },
    react: (id, r) => {
      const m = msgOf(id);
      if (!m || m.del) return no("not_found");
      m.reacts = (m.reacts || []).filter((x) => x.emp !== me.id);
      if (r) m.reacts.push({ r, emp: me.id, name: me.name });
      touch(m);
      return ok({ msg: J(m) });
    },
    pin: (cid, id) => {
      const c = chatOf(cid);
      if (!visible(c) || c.kind === "dm") return no("not_found");
      if (c.kind === "team" && !me.lead) return no("forbidden");
      if (!id) { c.pin = null; return ok({ pin: null }); }
      const m = msgOf(id);
      if (!m || m.chat !== c.id || m.del || !(m.kind === "text" || m.kind === "photo")) return no("not_found");
      c.pin = m.id;
      const t = (m.kind === "photo" ? "фото" + (m.body ? ": " + m.body : "") : m.body).replace(/\s+/g, " ");
      const s = put(c.id, me.id, me.name.split(" ")[0] + " закрепляет «" + (t.length > 48 ? t.slice(0, 47).trimEnd() + "…" : t) + "»", 0, { kind: "sys", reply: quote(m) });
      reads[c.id] = reads[c.id] || {}; reads[c.id][me.id] = s.id;
      return ok({ pin: J(m), msg: J(s) });
    },
    del: (id) => {
      const m = msgOf(id);
      if (m) { m.del = true; m.body = ""; m.photo = null; m.reacts = []; touch(m); chats.forEach((c) => { if (c.pin === m.id) c.pin = null; }); }
      return ok({});
    },
    // v91: очистить чат целиком у всех — группу руководитель, личную любой из двоих; без строки «кто очистил»
    clear: (cid) => {
      const c = chatOf(cid);
      if (!visible(c)) return no("not_found");
      if (c.kind !== "dm" && !me.lead) return no("forbidden");
      for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].chat === c.id) msgs.splice(i, 1);
      c.pin = null; c.cleared = new Date().toISOString();
      return ok({ removed: 0, cleared: c.cleared });
    },
    // демо: вызов мне и сообщение от коллеги
    demoCall: () => { put("team", "p5", "", 0, { kind: "call", call: { who: "lead", why: "help", going: [] } }); onChange(); },
    demoMessage: () => { put("dm-p3", "p3", "Ещё вопрос: можно я сегодня уйду в 23:00? Все столы закрою.", 0); onChange(); },
  };
  return api;
}
