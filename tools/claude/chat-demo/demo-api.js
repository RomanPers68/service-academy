// tools/claude/chat-demo/demo-api.js — v90: демо-сервер чата в памяти (для показа и для просмотра вида).
// Те же ответы, что у сервера (этап 38): list, open, send, read, dm, people, call, go, del, edit, react, pin, photoSend,
// photo. Коллеги выдуманы и отвечают по сценарию: прочитали через секунду-две, ответили через три-четыре (на вопрос —
// с цитатой), на сообщение в группе ставят «Принято», на фото — «Огонь»; на вызов идёт тот, кого звали.
// «Руководители сети» — руководители Океана и выдуманного второго заведения «Два моря, Порт».
import { callLine, EDIT_HOURS } from "../../../lib/chat.js";
import { cardSummary, withVote, dueChoices, askAi, shiftLogLine } from "../../../lib/chat-smart.js";

// v93: что «знает приложение» в демо — уроки, тесты, блюда, коктейли, справочник (для «+», заданий, стоп-листа и Наставника)
export const DEMO_ITEMS = [
  { kind: "lesson", id: "l-allerg", title: "Аллергены: как говорить с гостем", mins: 7, sub: "Новичок" },
  { kind: "lesson", id: "l-wine", title: "Подача вина у стола", mins: 9, sub: "Официант" },
  { kind: "lesson", id: "l-hard", title: "Сложный гость: спокойствие и решения", mins: 8, sub: "Официант" },
  { kind: "quiz", id: "q-menu", title: "Тест: осеннее меню", mins: 5, sub: "12 вопросов" },
  { kind: "module", id: "m-wine", title: "Винная карта", mins: 25, sub: "4 урока" },
  { kind: "dish", id: "d-tartar", title: "Тартар из тунца", sub: "тунец, авокадо, понзу · рыба, соя, кунжут", allerg: "рыба, соя и кунжут" },
  { kind: "dish", id: "d-borsch", title: "Борщ с уткой", sub: "утка, свёкла, сметана · молоко, сельдерей", allerg: "молоко и сельдерей" },
  { kind: "dish", id: "d-cheese", title: "Чизкейк Сан-Себастьян", sub: "сливочный сыр, сливки, яйца · молоко, яйца, глютен", allerg: "молоко, яйца и глютен" },
  { kind: "dish", id: "d-pasta", title: "Паста с белыми грибами", sub: "белые грибы, сливки, пармезан · глютен, молоко", allerg: "глютен и молоко" },
  { kind: "cocktail", id: "c-negroni", title: "Кедровый негрони", sub: "джин на кедровых орешках, кампари, вермут · орехи" },
  { kind: "cocktail", id: "c-spritz", title: "Апероль спритц", sub: "апероль, просекко, содовая" },
  { kind: "ref", id: "r-meet", title: "Стандарт встречи гостя", sub: "первые 30 секунд у входа" },
  { kind: "ref", id: "r-allerg", title: "Как говорить об аллергенах", sub: "фразы и что уточнить на кухне" },
];
const DAY = 86400000;
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

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
  const everyone = [...all, ...NET_PEOPLE, { id: "ai", name: "Наставник", pos: "ai" }];   // v93: Наставник пишет в переписку
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
  // v93: умные карточки — смена, обмен, задание, опрос, стоп-лист и вопрос Наставнику
  const d0 = new Date(T0); d0.setHours(12, 0, 0, 0);
  const dIn = (n) => iso(new Date(d0.getTime() + n * DAY));
  const sCard = (c) => ({ t: "shift", st: "open", ...c });
  // мои смены в демо меняются после обмена и передачи, как в графике
  const myShifts = [[2, "День", "11:00–23:00"], [6, "День", "11:00–23:00"], [8, "Вечер", "17:00–24:00"], [11, "День", "11:00–23:00"]]
    .map(([n, label, time]) => ({ date: dIn(n), venue: "main", label, time, pos: "менеджер" }));
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const vera = put("team", "p6", "", 11, { kind: "card", card: sCard({ mode: "give", date: dIn(3), label: "Вечер", time: "18:00–24:00", pos: "зал", from: "p6", fromName: "Вера Соколова", note: "Сестра выходит замуж", can: false, why: "Забрать могут официанты, свободные в этот день" }) });
  vera.body = cardSummary(vera.card);
  const giveM = put("team", "p1", "", 10, { kind: "card", card: sCard({ mode: "give", date: dIn(5), label: "Вечер", time: "17:00–24:00", pos: "менеджер", from: "p1", fromName: "Мария Ким", note: "Семейный праздник", can: true }) });
  giveM.body = cardSummary(giveM.card);
  const swapC = put("team", "p1", "", 9, { kind: "card", card: sCard({ mode: "swap", date: dIn(4), label: "День", time: "11:00–23:00", pos: "менеджер", from: "p1", fromName: "Мария Ким", want: [dIn(6), dIn(8)], can: true }) });
  swapC.body = cardSummary(swapC.card);
  const fri = dueChoices(new Date(T0)).find((x) => x[0] === "fri")[2];
  const task = put("team", "p1", "", 8, { kind: "card", card: { t: "task", item: DEMO_ITEMS[0], due: fri, n: 3, of: 7, left: ["Пётр Орлов", "Вера Соколова", "Илья Белов", "Глеб Морозов"] } });
  task.body = cardSummary(task.card);
  const poll = put("team", "p1", "", 7, { kind: "card", card: { t: "poll", q: "Кто выйдет на банкет в субботу?", opts: ["Я выйду", "Не смогу", "Могу до 22:00"], votes: [{ o: 0, emp: "p3", name: "Анна Смирнова" }, { o: 0, emp: "p4", name: "Пётр Орлов" }, { o: 2, emp: "p6", name: "Вера Соколова" }] } });
  poll.body = cardSummary(poll.card);
  const stopC = put("team", "p1", "", 6, { kind: "card", card: { t: "stop", st: "on", dish: { id: "d-tartar", name: "Тартар из тунца" } } });
  stopC.body = cardSummary(stopC.card);
  const ask = put("team", "p2", "@Наставник, какие аллергены в чизкейке Сан-Себастьян?", 5);
  put("team", "ai", "В чизкейке Сан-Себастьян молоко (сливочный сыр и сливки), яйца и глютен (немного муки). Орехов нет, но десерт готовят на общей кухне: гостю с сильной аллергией скажи об этом и уточни у шефа.", 5,
    { kind: "ai", reply: quote(ask), card: { t: "ai", cards: [{ kind: "dish", id: "d-cheese", title: "Чизкейк Сан-Себастьян", sub: "сливочный сыр, сливки, яйца · молоко, яйца, глютен" }] } });
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
  // v93: смена переходит без подтверждения, а руководители видят каждую передачу и обмен: строка в «Старших»
  // (на сервере ещё и бот руководителям заведения)
  const offered = (date) => msgs.some((m) => m.card && m.card.t === "shift" && m.card.st === "open" && String(m.card.from) === String(me.id) && m.card.date === date);
  const logLeads = (m) => { if (m && m.chat !== "leads" && m.card && m.card.st === "done") put("leads", m.card.by, shiftLogLine(m.card), 0, { kind: "sys", card: { t: "log", mode: m.card.mode } }); };
  // через 15 секунд в «Вся команда» Пётр забирает смену Веры: видно, как карточка закрывается и что пишут руководителям
  let veraT = false;
  const veraTake = () => { if (veraT) return; veraT = true; later(15000, () => { if (vera.card.st !== "open") return; Object.assign(vera.card, { st: "done", by: "p4", byName: "Пётр Орлов", at: new Date().toISOString() }); touch(vera); logLeads(vera); }); };
  const ok = (x) => new Promise((res) => setTimeout(() => res({ ok: true, ...x }), 90 + Math.random() * 90));
  const no = (error) => Promise.resolve({ ok: false, error });
  const chatOf = (id) => chats.find((c) => String(c.id) === String(id));
  const visible = (c) => c && c.members.includes(me.id);
  const msgOf = (id) => msgs.find((x) => String(x.id) === String(id));
  const last = (cid) => [...msgs].reverse().find((m) => m.chat === cid && !m.del) || null;   // v91: удалённое — без следа
  const unread = (cid) => msgs.filter((m) => m.chat === cid && !m.del && String(m.emp) !== String(me.id) && m.id > ((reads[cid] || {})[me.id] || 0)).length;
  const forMe = (m) => m.kind === "call" && String(m.emp) !== String(me.id) && (m.call.who === "person" ? String(m.call.emp) === String(me.id) : (ROLE_POS[m.call.who] || []).includes(me.pos));
  const J = (m) => (m ? { ...m, call: m.call ? { ...m.call, going: [...(m.call.going || [])] } : null, photo: m.photo ? { ...m.photo } : null, reply: m.reply ? { ...m.reply } : null,
    reacts: (m.reacts || []).map((x) => ({ ...x })), body: m.del ? "" : m.body, card: m.card ? JSON.parse(JSON.stringify(m.card)) : undefined } : null);
  const view = (c) => ({ id: c.id, kind: c.kind, members: c.members.length, shift: c.kind === "team" ? all.filter((p) => p.id === me.id || p.shift).length : undefined,
    peer: c.kind === "dm" ? (() => { const p = byId(c.members.find((e) => e !== me.id)); return p && { id: p.id, name: p.name, pos: p.pos, shift: !!p.shift }; })() : undefined,
    last: J(last(c.id)), unread: unread(c.id), cleared: c.cleared || null, title: c.kind === "group" ? c.title : undefined, owner: c.kind === "group" ? c.owner : undefined });
  const RANK = { team: 0, leads: 1, net: 2, group: 3, dm: 4 };
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
    if (c.kind === "group") {   // v92: в своём чате отвечают только его участники
      if (!others.length) return;
      later(2000, () => react(mine, others[0], photo ? "fire" : "ok"));
      if (!photo) later(3400, () => put(c.id, others[others.length - 1], q ? "Сейчас уточню и напишу" : ["Принято", "Хорошо, сделаю", "Договорились"][ri++ % 3], 0, q ? { reply: quote(mine) } : {}));
      return;
    }
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
      if (c.id === "team") veraTake();
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
      if (!askAi(m.body)) answer(c, m);   // v93: на «@Наставник …» отвечает Наставник, а не коллеги
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
    // v92: свои чаты — завести, поправить, выйти, удалить (руководитель — я)
    groupCreate: (title, emps) => {
      const t = String(title || "").replace(/\s+/g, " ").trim().slice(0, 40), who = [...new Set((emps || []).map(String))].filter((e) => e !== me.id && PEOPLE.some((p) => p.id === e));
      if (!t || !who.length) return no("bad_request");
      const c = { id: "g" + (++seq), kind: "group", title: t, owner: me.id, members: [me.id, ...who], pin: null };
      chats.push(c);
      later(2400, () => put(c.id, who[0], "Привет! Я на месте", 0));
      return ok({ chat: view(c), members: members(c) });
    },
    groupEdit: (cid, { title = null, add = null, remove = null } = {}) => {
      const c = chatOf(cid);
      if (!visible(c) || c.kind !== "group") return no("not_found");
      if (title != null) { const t = String(title).replace(/\s+/g, " ").trim().slice(0, 40); if (!t) return no("bad_request"); c.title = t; }
      if (remove) c.members = c.members.filter((e) => e === me.id || !remove.map(String).includes(e));
      if (add) add.map(String).forEach((e) => { if (!c.members.includes(e) && PEOPLE.some((p) => p.id === e)) c.members.push(e); });
      return ok({ chat: view(c), members: members(c) });
    },
    groupLeave: (cid) => {
      const c = chatOf(cid);
      if (!visible(c) || c.kind !== "group") return no("not_found");
      c.members = c.members.filter((e) => e !== me.id);
      return ok({});
    },
    groupDelete: (cid) => {
      const c = chatOf(cid);
      if (!visible(c) || c.kind !== "group") return no("not_found");
      chats.splice(chats.indexOf(c), 1);
      for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].chat === c.id) msgs.splice(i, 1);
      return ok({});
    },
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
    // ── v93: умный чат ──
    shiftsMine: () => ok({ shifts: myShifts.filter((s) => !offered(s.date)).map((s) => ({ ...s })) }),
    shiftOffer: (cid, { date, venue, mode, want, note }) => {
      const c = chatOf(cid); if (!visible(c)) return no("not_found");
      const s = myShifts.find((x) => x.date === date);
      if (!s || offered(date)) return no("not_allowed");
      const m = put(c.id, me.id, "", 0, { kind: "card", card: sCard({ mode, date, venue, label: s.label, time: s.time, pos: "менеджер", from: me.id, fromName: me.name, want: want || [], note: note || "", can: false }) });
      m.body = cardSummary(m.card);
      // коллега (Мария) забирает или меняется через несколько секунд — как в смене
      later(4200, () => {
        if (m.card.st !== "open") return;
        m.card.st = "done"; m.card.by = "p1"; m.card.byName = "Мария Ким"; m.card.at = new Date().toISOString();
        const i = myShifts.findIndex((x) => x.date === date);
        if (i >= 0) myShifts.splice(i, 1);
        if (mode === "swap") { m.card.byDate = (want && want[0]) || dIn(9); m.card.byLabel = "День"; myShifts.push({ date: m.card.byDate, venue, label: "День", time: "11:00–23:00", pos: "менеджер" }); myShifts.sort(byDate); }
        touch(m); logLeads(m);
      });
      return ok({ msg: J(m) });
    },
    shiftTake: (id) => {
      const m = msgOf(id); if (!m || !m.card || m.card.t !== "shift") return no("not_found");
      if (m.card.st !== "open") return no("taken");
      if (!m.card.can || m.card.mode !== "give" || myShifts.some((x) => x.date === m.card.date)) return no("not_allowed");
      Object.assign(m.card, { st: "done", by: me.id, byName: me.name, at: new Date().toISOString() }); touch(m); logLeads(m);
      myShifts.push({ date: m.card.date, venue: "main", label: m.card.label, time: m.card.time, pos: "менеджер" }); myShifts.sort(byDate);
      return ok({ msg: J(m) });
    },
    shiftSwapOptions: (id) => {
      const m = msgOf(id); if (!m || !m.card) return no("not_found");
      const want = m.card.want || [];
      return ok({ shifts: myShifts.filter((s) => s.date !== m.card.date && !offered(s.date) && (!want.length || want.includes(s.date))).map((s) => ({ ...s })) });
    },
    shiftSwap: (id, date) => {
      const m = msgOf(id); if (!m || !m.card || m.card.t !== "shift") return no("not_found");
      if (m.card.st !== "open") return no("taken");
      const i = myShifts.findIndex((x) => x.date === date);
      if (!m.card.can || m.card.mode !== "swap" || i < 0) return no("not_allowed");
      Object.assign(m.card, { st: "done", by: me.id, byName: me.name, byDate: date, byLabel: myShifts[i].label, at: new Date().toISOString() }); touch(m); logLeads(m);
      myShifts.splice(i, 1, { date: m.card.date, venue: "main", label: m.card.label, time: m.card.time, pos: "менеджер" }); myShifts.sort(byDate);
      return ok({ msg: J(m) });
    },
    shiftCancel: (id) => {
      const m = msgOf(id); if (!m || !m.card || String(m.card.from) !== String(me.id)) return no("not_found");
      if (m.card.st !== "open") return no("taken");
      m.card.st = "off"; touch(m); return ok({ msg: J(m) });
    },
    cardSend: (cid, card) => {
      const c = chatOf(cid); if (!visible(c)) return no("not_found");
      const others = c.members.filter((e) => e !== me.id);
      const cc = card.t === "task" ? { ...card, n: 0, of: others.length, left: others.map((e) => byId(e).name) } : card.t === "poll" ? { ...card, votes: [] } : { ...card };
      const m = put(c.id, me.id, "", 0, { kind: "card", card: cc });
      m.body = cardSummary(cc);
      if (cc.t === "task") others.slice(0, 2).forEach((e, i) => later(3500 + i * 2600, () => { m.card.n += 1; m.card.left = m.card.left.filter((x) => x !== byId(e).name); touch(m); }));
      if (cc.t === "poll") others.slice(0, 3).forEach((e, i) => later(2500 + i * 1500, () => { m.card.votes = withVote(m.card.votes, i % cc.opts.length, { id: e, name: byId(e).name }); touch(m); }));
      if (cc.t === "share" || cc.t === "brief") later(2200, () => react(m, others[0], "ok"));
      return ok({ msg: J(m) });
    },
    taskRemind: (id) => { const m = msgOf(id); if (!m || !m.card) return no("not_found"); m.card.reminded = true; touch(m); return ok({ n: (m.card.left || []).length, msg: J(m) }); },
    pollVote: (id, i) => { const m = msgOf(id); if (!m || !m.card || m.card.t !== "poll") return no("not_found"); m.card.votes = withVote(m.card.votes, i, me); touch(m); return ok({ msg: J(m) }); },
    stopSet: (cid, dish, on, until, msgId) => {
      const c = chatOf(cid); if (!visible(c)) return no("not_found");
      if (!on) { const m = msgOf(msgId); if (!m || !m.card) return no("not_found"); Object.assign(m.card, { st: "off", offBy: me.name, offAt: new Date().toISOString() }); touch(m); return ok({ msg: J(m) }); }
      const m = put(c.id, me.id, "", 0, { kind: "card", card: { t: "stop", st: "on", dish: { id: dish.id, name: dish.name, img: dish.img || "" } } });
      m.body = cardSummary(m.card);
      return ok({ msg: J(m) });
    },
    aiAsk: (cid, qid, question) => new Promise((res) => {
      const c = chatOf(cid), qm = msgOf(qid);
      if (!visible(c) || !qm) { res({ ok: false, error: "not_found" }); return; }
      const t = String(question || "").toLowerCase().replace(/ё/g, "е");
      const dish = DEMO_ITEMS.find((x) => x.kind === "dish" && t.includes(x.title.toLowerCase().split(" ")[0].slice(0, 5).replace(/ё/g, "е")));
      const ck = DEMO_ITEMS.find((x) => x.kind === "cocktail" && t.includes(x.title.toLowerCase().split(" ").slice(-1)[0].slice(0, 5)));
      let body, cards = [];
      if (dish) { body = dish.title + ": аллергены " + dish.allerg + ". Если гость спрашивает про замену, уточни у шефа, что можно убрать без потери вкуса."; cards = [{ kind: "dish", id: dish.id, title: dish.title, sub: dish.sub }]; }
      else if (ck || /(вин|коктейл|напит)/.test(t)) { const x = ck || DEMO_ITEMS.find((y) => y.id === "c-spritz"); body = "К этому хорошо подойдёт " + x.title.toLowerCase() + ": " + x.sub + ". Предложи гостю коротко: вкус, крепость и почему к его блюду."; cards = [{ kind: "cocktail", id: x.id, title: x.title, sub: x.sub }]; }
      else if (/(стандарт|встрет|гост)/.test(t)) { const x = DEMO_ITEMS.find((y) => y.id === "r-meet"); body = "Встречаем в первые 30 секунд: улыбка, приветствие, бронь или свободный стол, проводить и подать меню. Подробно в справочнике."; cards = [{ kind: "ref", id: x.id, title: x.title, sub: x.sub }]; }
      else body = "Хороший вопрос. Коротко: опирайся на стандарты зала и меню вашего ресторана, а если сомневаешься, спроси старшего смены. Могу показать нужный урок или карточку блюда, если назовёшь блюдо.";
      setTimeout(() => { const m = put(c.id, "ai", body, 0, { kind: "ai", reply: quote(qm), card: { t: "ai", cards } }); onChange(); res({ ok: true, msg: J(m) }); }, 1600);
    }),
    // демо: вызов мне и сообщение от коллеги
    demoCall: () => { put("team", "p5", "", 0, { kind: "call", call: { who: "lead", why: "help", going: [] } }); onChange(); },
    demoMessage: () => { put("dm-p3", "p3", "Ещё вопрос: можно я сегодня уйду в 23:00? Все столы закрою.", 0); onChange(); },
  };
  return api;
}
