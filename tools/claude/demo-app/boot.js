// tools/claude/demo-app/boot.js — v97 (Доп. 410): демо приложения целиком в одной странице. Сервер — в памяти страницы
// (fake-server.js вместо Supabase, состояние — в localStorage), заведение выдуманное: «Два моря, Океан», восемь человек,
// график на месяц, меню. Сверху — строка демо: кто ты (Анна, официант; Мария, менеджер; Роман, владелец), сменить,
// начать заново. Коллеги «живые»: забирают отданную смену, выходят по «Ищем в смену», отвечают на карточки.
// v99 (Доп. 412): время в демо идёт с 11:00 (у Анны и Марии смена с 12:00, на главной «Опаздываю?»); «Новый телефон» —
// вход через Telegram без кода; сообщения бота в Telegram — уведомлением сверху (с кнопкой «Принято»); страница
// «Подписаться» на календарь и страница подключения бота открываются поверх приложения.
// Собирается в один скрипт (esbuild, IIFE) и подключается в index.html до приложения.
import { makeServer, SHIFTS, full } from "./fake-server.js";
import { RESTAURANT_MENUS } from "../../../data/menu.js";
import { HINTS, HINTS_VERSION } from "../../../data/hints.js";
import { calPage } from "../../../lib/ical.js";

const K_SRV = "__demo_srv", K_WHO = "__demo_who", K_DAY = "__demo_day", K_T = "__demo_t", K_NEW = "__demo_newphone";
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };

// ── время в демо: утро, 11:00 в первый раз, дальше идёт как обычно (смещение помнится 11 часов; потом — новое утро) ──
const RealDate = Date;
(function demoClock() {
  const n = RealDate.now();
  let off = null;
  try { const t = JSON.parse(lsGet(K_T) || "null"); if (t && typeof t.off === "number" && n - t.at >= 0 && n - t.at < 11 * 3600e3) off = t.off; } catch (e) { off = null; }
  if (off === null) {
    const d = new RealDate(n);
    off = new RealDate(d.getFullYear(), d.getMonth(), d.getDate(), 11, 0, 0).getTime() - n;
    lsSet(K_T, JSON.stringify({ off, at: n })); lsDel(K_SRV); lsDel("__demo_me");   // новое утро — заведение с начала
  }
  if (!off) return;
  function DemoDate(...a) {
    if (!new.target) return new RealDate(RealDate.now() + off).toString();
    return a.length ? new RealDate(...a) : new RealDate(RealDate.now() + off);
  }
  DemoDate.prototype = RealDate.prototype;
  DemoDate.now = () => RealDate.now() + off;
  DemoDate.parse = RealDate.parse; DemoDate.UTC = RealDate.UTC;
  window.Date = DemoDate;
})();

const R0 = "Два моря, Океан";
const PEOPLE = [
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-olga", name: "Ольга", surname: "Ли", restaurant: R0, position: "hostess", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-darya", name: "Дарья", surname: "Лебедева", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender", is_admin: false },
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },   // v99: владелец — экран «Сервер»
];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["demo-" + p.id, p.id]));
const tokOf = (id) => "demo-" + id;
const ME = { anna: "e-anna", maria: "u-maria", roman: "u-roman" };
const TG_ANNA = "700003";   // Telegram Анны: она подключала напоминания, поэтому приложение узнаёт её без кода
const DEMO_INIT = "user=" + encodeURIComponent(JSON.stringify({ id: Number(TG_ANNA), first_name: "Анна" })) + "&auth_date=" + Math.floor(Date.now() / 1000) + "&hash=demo";
const SSTAFF = [
  { id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Ли Ольга", pos: "host", norm: 160 },
  { id: 3, name: "Смирнова Анна", pos: "waiter", norm: 160 }, { id: 4, name: "Орлов Пётр", pos: "waiter", norm: 160 },
  { id: 5, name: "Соколова Вера", pos: "waiter", norm: 160 }, { id: 6, name: "Лебедева Дарья", pos: "waiter", norm: 160 },
  { id: 7, name: "Белов Илья", pos: "bar", norm: 160 },
];
const CFG = {
  hours: [[12, 24], [12, 24], [12, 24], [12, 24], [12, 24], [12, 24], [12, 24]], shifts: SHIFTS,
  // потребность — только у официантов: у остальных по одному человеку, «не хватает» по ним было бы каждый второй день
  need: { 1: { waiter: 2 }, 2: { waiter: 2 }, 3: { waiter: 3 } },
  split: {}, rules: { peakDows: [4, 5], highDows: [3, 6], maxRow: 5, minOff: 2, minRest: 11, holidayPeak: true, wishDeadline: 0, autoFill: false, normMode: "floor" },
  posRules: { manager: { pattern: "2x2" }, host: { pattern: "2x2" }, bar: { pattern: "even" }, waiter: { pattern: "even" } },
  dayShift: "Д", staff: SSTAFF,
};
// график: две недели от сегодня — по дням (так, чтобы Анне было что забрать и куда выйти), дальше и раньше — по кругу
const NEAR = {
  3: "ДД-ВВ--ДД-ВВ--", 4: "В-ДД-ВВ-ДД-ВВ-", 5: "-ВВ-ДД-В-ДД-ВВ", 6: "Д--Д--Д-В--Д-Д",
};
function planOf() {
  const out = {};
  for (let i = -30; i <= 45; i++) {
    const set = (sid, k) => { if (k && k !== "-") (out[sid] = out[sid] || {})[i] = k; };
    const c2 = ((i % 4) + 4) % 4;
    set(1, c2 < 2 ? "Д" : ""); set(2, c2 >= 2 ? "Д" : ""); set(7, c2 === 1 || c2 === 2 ? "В" : "");
    if (i % 7 === 3 || i % 7 === -4) set(7, "Д");
    for (const sid of [3, 4, 5, 6]) {
      const row = NEAR[sid];
      set(sid, i >= 0 && i < row.length ? row[i] : row[((i % row.length) + row.length) % row.length]);
    }
  }
  return out;
}
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const TODAY = iso(new Date());
const MENU = JSON.parse(JSON.stringify(RESTAURANT_MENUS[R0] || []));

// ── кто я: Анна, Мария или Роман; «Новый телефон» — Анна без входа, приложение открыто «в Telegram» ──
const whoKey = lsGet(K_WHO);
const who = ME[whoKey] ? whoKey : "anna";
const me = PEOPLE.find((p) => p.id === ME[who]);
const newPhone = lsGet(K_NEW) === "1";

// ── состояние сервера: в localStorage, чтобы пережить смену человека и перезагрузку ──
let saved = null;
try { saved = lsGet(K_DAY) === TODAY ? JSON.parse(lsGet(K_SRV) || "null") : null; } catch (e) { saved = null; }
// пройденное: Анна и Мария не новички (инструменты открыты), коллеги — для заданий «кто прошёл»
const DONE = ["s0-1", "s0-2", "s0-3", "s0-4", "s1-1", "s1-2"];
const srv = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu: MENU, state: saved,
  progress: { "e-anna": DONE, "u-maria": [...DONE, "s1-3", "s1-4", "s2-1"], "e-petr": DONE.slice(0, 4), "e-vera": DONE }, quizzes: { "e-anna": ["s0-q"], "u-maria": ["s0-q", "s1-q"] },
  wishes: [{ sid: 6, at: 3, kind: "hard" }, { sid: 4, at: 12, kind: "off" }],
  tgKnown: { [TG_ANNA]: "e-anna" },
  // бот пишет в Telegram: мне — уведомлением сверху, остальным — никак (их телефонов в демо нет)
  ping: (to, text, acts) => { if (to === me.id) setTimeout(() => tgToast(text, acts), 500); } });
const save = () => { lsSet(K_SRV, JSON.stringify(srv.S)); lsSet(K_DAY, TODAY); };
const D = srv.D;
// приложение только что открыли: сейчас я ни в одном чате (бот пишет мне в Telegram, как в жизни)
for (const k of Object.keys(srv.S.seen || {})) if (k.endsWith("|" + me.id)) delete srv.S.seen[k];

// ── утро в заведении: что уже есть в чате, когда демо открывают впервые ──
if (!saved) {
  srv.bot.say("u-maria", "Доброе утро! Сегодня банкет на 12 человек в 19:00 на веранде. Зал готовим к 18:30.");
  srv.bot.offer("e-vera", D(2), "give", "Нужно к врачу, выручите");
  srv.bot.need("u-maria", D(6), "waiter", "В", 1);
  srv.bot.offer("e-petr", D(9), "swap", "Поменяюсь на любой день");
  srv.bot.say("e-ilya", "На баре закончился тоник, до обеда привезут. Пока предлагаем содовую.");
  srv.bot.say("e-olga", "Бронь на 20:00 перенесли на 20:30, стол 7.");
  save();
}

// ── то, что приложение ждёт на устройстве: вход, подсказки уже показаны ──
function seed() {
  const uk = "_" + me.name + "_" + me.surname;
  const keep = new Set([K_SRV, K_WHO, K_DAY, K_T]);
  try { Object.keys(localStorage).forEach((k) => { if (!keep.has(k)) localStorage.removeItem(k); }); } catch (e) {}
  try { sessionStorage.removeItem("sa_tg_skip"); } catch (e) {}
  const s = { sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_ai_fab: "1", ["sa_last_role" + uk]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + uk]: "1", ["sa_mastery" + uk]: JSON.stringify({ tiers: {}, fw: false, master: {} }),
    sa_menu_shared: JSON.stringify({ [R0]: srv.S.menu }), sa_boot_missing: String(Date.now()), __demo_me: me.id };
  if (!newPhone) { s.sa_session_token = tokOf(me.id); s.sa_profile = JSON.stringify(me); }   // новый телефон — входа ещё нет
  for (const k of Object.keys(HINTS)) s["sa_hint_v" + HINTS_VERSION + "_" + k] = "1";
  s["sa_hint_v" + HINTS_VERSION + "_track_orb"] = "1";
  Object.entries(s).forEach(([k, v]) => lsSet(k, v));
}
if (lsGet("__demo_me") !== me.id || newPhone) seed();
if (newPhone) { lsDel(K_NEW); delete srv.S.tgAuth[TG_ANNA]; save(); }
// входа нет — телефон «в Telegram»: экран входа сначала пробует узнать по Telegram (lib/tg-login.js)
if (!lsGet("sa_session_token")) window.__saDemoTg = DEMO_INIT;

// ── коллеги отвечают ──
const later = (ms, fn) => setTimeout(() => { try { fn(); save(); } catch (e) {} }, ms);
const colleague = (notIds, pos = null) => PEOPLE.find((p) => !notIds.includes(p.id) && (!pos || p.position === pos) && !p.is_admin) || null;
const firstName = (p) => String(p.name || "").trim();
function after(fn, b, res) {
  if (!res || !res.ok) return;
  const m = res.msg;
  if (fn === "chat_shift_offer" && m && m.card) {
    if (m.card.mode === "give") later(8000, () => { const x = srv.msgOf(m.id); if (!x || x.card.st !== "open") return; const t = srv.bot.taker(x, me.id); if (t) srv.bot.take(t.id, x.id); });
    if (m.card.mode === "swap") later(9000, () => {
      const x = srv.msgOf(m.id); if (!x || x.card.st !== "open") return;
      for (const p of PEOPLE) {
        if (p.id === me.id || p.position !== me.position) continue;
        const o = srv.rpc("chat_shift_options", { p_token: tokOf(p.id), p_msg: x.id });
        if (o && o.ok && o.shifts && o.shifts.length) { srv.rpc("chat_shift_swap", { p_token: tokOf(p.id), p_msg: x.id, p_date: o.shifts[0].date }); return; }
      }
    });
  }
  if (fn === "chat_shift_need" && m && m.card) later(8000, () => { const x = srv.msgOf(m.id); if (!x || x.card.st !== "open") return; const t = srv.bot.taker(x, me.id); if (t) srv.bot.take(t.id, x.id); });
  if (fn === "chat_card_send" && m && m.card) {
    const t = m.card.t, c = m.chat;
    const say = (id, text) => later(4500, () => srv.bot.say(id, text, c));
    if (t === "share") say(me.id === "e-petr" ? "e-vera" : "e-petr", "Спасибо, гляну перед сменой");
    if (t === "task") say("e-vera", "Принято, пройду до вечера");
    if (t === "sched") say("e-darya", m.card.what === "wishes" ? "Отмечу сегодня" : "Спасибо, посмотрела свои смены");
    if (t === "brief") say("e-olga", "Прочитала, к банкету готовы");
    if (t === "poll") later(5000, () => { const x = srv.msgOf(m.id); if (x) ["e-petr", "e-vera"].forEach((id, i) => srv.rpc("chat_poll_vote", { p_token: tokOf(id), p_msg: x.id, p_o: i % x.card.opts.length })); });
  }
  if (fn === "chat_stop_note" && b.p_on && !res.again && m) later(4500, () => srv.bot.say("e-ilya", "Понял, гостям предложу замену", m.chat));
  if (fn === "chat_stop_set" && b.p_on && m) later(4500, () => srv.bot.say("e-ilya", "Понял, гостям предложу замену", m.chat));
  // v99: «Опаздываю» — руководитель в смене через несколько секунд отвечает «Принято» (Марии и Роману — друг друга)
  if (fn === "chat_late" && m) {
    const lead = me.id === "u-maria" ? "u-roman" : "u-maria";
    later(6000, () => srv.rpc("chat_late_ok", { p_token: tokOf(lead), p_msg: m.id }));
  }
  if (fn === "chat_send" && m) {
    // v99: упомянули коллегу — он отвечает; «@все» от руководителя — отвечает хостес
    const x = srv.msgOf(m.id), ment = (x && x.ment) || [];
    const to = ment.filter((id) => id !== "all" && id !== me.id).map((id) => PEOPLE.find((p) => p.id === id)).filter(Boolean)[0] || null;
    if (to) { later(5000, () => srv.bot.say(to.id, "@" + firstName(me) + " вижу, сейчас подойду", m.chat)); return; }
    if (ment.includes("all")) { later(5000, () => srv.bot.say("e-olga", "Принято, будем", m.chat)); return; }
    if (/\?\s*$/.test(String(b.p_body || ""))) {
      const ans = colleague([me.id], me.position === "manager" || me.is_admin ? "waiter" : "manager");
      if (ans) later(5000, () => srv.bot.say(ans.id, me.position === "manager" || me.is_admin ? "Да, сделаю" : "Сейчас уточню и напишу", m.chat));
    }
  }
}
// v99: события утра, по разу за демо: коллега упоминает тебя (через 15 с — увидишь уведомление бота, если ты не в чате);
// Марии Дарья пишет, что опаздывает (через 25 с — уведомление бота с «Принято»)
const EV = srv.S.demoEv || (srv.S.demoEv = {});
const once = (key, ms, fn) => { if (EV[key]) return; later(ms, () => { if (EV[key]) return; EV[key] = 1; fn(); }); };
if (!newPhone) {
  if (who === "anna") once("ment-anna", 15000, () => srv.bot.say("u-maria", "@Анна, возьмёшь сегодня банкет на веранде? Гости к 19:00, нужен один официант на весь вечер."));
  if (who === "maria") once("ment-maria", 15000, () => srv.bot.say("e-petr", "@Мария, на банкет нужен ещё один стол. Ставим к окну?"));
  if (who === "roman") once("ment-roman", 15000, () => srv.bot.say("u-maria", "@Роман, к банкету берём «Шабли» или «Совиньон блан»? Нужно решить до 15:00."));
  if (who === "maria") once("late-darya", 25000, () => srv.rpc("chat_late", { p_token: tokOf("e-darya"), p_chat: null, p_min: 20, p_note: "автобус сломался" }));
}

// ── сервер вместо Supabase: те же адреса, ответы из памяти ──
const AI_REPLY = "Это демо: Наставник здесь не подключён к ИИ. В приложении он отвечает по меню, стандартам и урокам вашего заведения.";
const json = (x, status = 200) => new Response(JSON.stringify(x === undefined ? null : x), { status, headers: { "Content-Type": "application/json" } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const realFetch = window.fetch ? window.fetch.bind(window) : null;
window.fetch = function (input, init) {
  const url = typeof input === "string" ? input : (input && input.url) || "";
  const m = /\/rest\/v1\/rpc\/([a-z_0-9]+)/.exec(url);
  if (m) {
    let body = {}; try { body = JSON.parse((init && init.body) || "{}"); } catch (e) {}
    let res; try { res = srv.rpc(m[1], body); } catch (e) { res = { ok: false, error: "demo" }; }
    save();
    try { after(m[1], body, res); } catch (e) {}
    // вход через Telegram — чуть дольше, чтобы было видно «Узнаю тебя по Telegram…»
    return wait(m[1] === "tg_login" ? 1400 : 120 + Math.round(Math.random() * 160)).then(() => json(res, res && res.code === "PGRST202" ? 404 : 200));
  }
  if (/\/functions\/v1\/ai-chat/.test(url)) return wait(700).then(() => json({ ok: true, reply: AI_REPLY, model: "demo" }));
  if (/\/index\.html\?ts=/.test(url)) return Promise.resolve(new Response("", { status: 200 }));   // сверка сборки: в демо одна
  if (/supabase\.co/.test(url) || /\/api\//.test(url)) return wait(60).then(() => json({ error: "demo" }, 404));
  return realFetch ? realFetch(input, init) : Promise.reject(new Error("no fetch"));
};

// ── v99: что открылось бы в браузере: страница «Подписаться» на календарь и страница подключения бота ──
const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const calLine = (s) => { const [y, mo, d] = String(s.date).split("-").map(Number); const dt = new Date(Date.UTC(y, mo - 1, d)); return WD[dt.getUTCDay()] + ", " + d + " " + MON[mo - 1] + " · " + String(s.label || "").toLowerCase() + " " + (s.time || ""); };
function browserSheet(addr, fill) {
  const v = document.createElement("div"); v.id = "demo-page";
  v.innerHTML = '<div class="bar"><span class="addr"></span><button type="button" aria-label="Закрыть">Готово</button></div><div class="note"></div><div class="body"></div>';
  v.querySelector(".addr").textContent = addr.replace(/^https?:\/\//, "");
  const close = () => v.remove();
  v.querySelector("button").addEventListener("click", close);
  fill(v.querySelector(".body"), (t) => { const n = v.querySelector(".note"); n.textContent = t; n.style.display = t ? "block" : "none"; });
  document.body.appendChild(v);
}
function calOverlay(u) {
  const k = (/[?&]k=([0-9a-f]{32})/.exec(u) || [])[1];
  const f = k ? srv.rpc("cal_feed", { p_key: k, p_page: true }) : null;
  if (!f || !f.ok) return;
  const https = u.replace(/&page=1$/, "");
  const next = (f.shifts || []).filter((s) => s.date >= TODAY).slice(0, 3).map(calLine);
  const html = calPage({ name: f.name, rest: f.rest, https, next })
    .replace(/<a class="btn" href="[^"]*">/, '<a class="btn" href="#" onclick="parent.postMessage(\'sa-demo-cal\', \'*\'); return false">');
  browserSheet(https, (body, note) => {
    const fr = document.createElement("iframe"); fr.setAttribute("sandbox", "allow-scripts"); fr.srcdoc = html; fr.title = "Страница подписки";
    body.appendChild(fr);
    const on = (e) => {
      if (e.data !== "sa-demo-cal") return;
      srv.rpc("cal_feed", { p_key: k }); save();   // телефон забрал смены: в приложении — «Подписка работает»
      note("В демо подписки нет. На телефоне здесь спросят «Подписаться на календарь?», и смены появятся в календаре. Закрой страницу и открой «Смены в календаре телефона» ещё раз.");
      window.removeEventListener("message", on);
    };
    window.addEventListener("message", on);
  });
}
function botOverlay(u) {
  const code = (/[?&]setup=([0-9a-f]{12})/.exec(u) || [])[1];
  const S = srv.S.srv;
  const ok = code && code === S.code;
  if (ok) { S.hook = true; S.code = null; save(); }   // как tg_hook_at: вебхук стоит; событий от Telegram ещё не было
  const hook = u.split("?")[0];
  const text = ok
    ? "Готово\n\nБот подключён: нажатия кнопок и ответы в чат приходят сюда:\n" + hook + "\n\n" +
      (S.app ? "Кнопка «Академия» у поля ввода открывает приложение." : "Кнопку «Академия» у поля ввода не поставил: нет адреса приложения.") + "\n" +
      "Команды: /smena (ближайшие смены) и /start (что приходит от бота).\n\n" +
      "Проверить можно в Telegram: напиши боту /start, он ответит и покажет кнопку в приложение; /smena покажет твои смены."
    : "Код не подошёл\n\nКод неверный или старше 30 минут. В приложении: «Команда» → «Сервер» → «Подключить бота».";
  browserSheet(u, (body) => { const pre = document.createElement("pre"); pre.textContent = text; body.appendChild(pre); });
}
const realOpen = window.open ? window.open.bind(window) : null;
window.open = function (url, ...rest) {
  const u = String(url || "");
  if (/\/api\/cal\?k=/.test(u)) { calOverlay(u); return null; }
  if (/\/functions\/v1\/tg-bot\?setup=/.test(u)) { botOverlay(u); return null; }
  return realOpen ? realOpen(url, ...rest) : null;
};

// ── v99: сообщение бота в Telegram — уведомлением сверху; «Принято» под сообщением об опоздании работает ──
function tgToast(text, acts) {
  const old = document.getElementById("demo-tg"); if (old) old.remove();
  const t = document.createElement("div"); t.id = "demo-tg"; t.setAttribute("role", "status");
  t.innerHTML = '<div class="h"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M21.5 4.2 2.9 11.4c-.9.4-.9 1.6.1 1.9l4.6 1.4 1.8 5.5c.3.8 1.3 1 1.9.4l2.6-2.5 4.7 3.5c.7.5 1.7.1 1.9-.8l3.1-14.9c.2-1-.8-1.8-1.7-1.3z" fill="currentColor"/></svg>' +
    '<b>Telegram</b><span>бот Академии · сейчас</span></div><div class="t"></div><div class="a"></div>';
  t.querySelector(".t").textContent = text;
  let timer = setTimeout(() => t.remove(), 9000);
  for (const a of acts || []) {
    const btn = document.createElement("button"); btn.type = "button"; btn.textContent = a.text;
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); clearTimeout(timer);
      const r = a.late ? srv.rpc("chat_late_ok", { p_token: tokOf(me.id), p_msg: a.late }) : null; save();
      btn.textContent = r && r.ok ? "Принято: на карточке в чате видно" : "Не получилось"; btn.disabled = true;
      timer = setTimeout(() => t.remove(), 2200);
    });
    t.querySelector(".a").appendChild(btn);
  }
  t.addEventListener("click", () => t.remove());
  document.body.appendChild(t);
}

// ── строка демо сверху: кто я, сменить, начать заново ──
const STRIP = 40;
const css = `
html.sa-tgfs body{padding-top:var(--sa-st,0px)}
#demo-strip{position:fixed;top:0;left:0;right:0;height:${STRIP}px;z-index:2147483000;display:flex;align-items:center;gap:10px;padding:0 12px;box-sizing:border-box;
  font-family:Georgia,serif;font-size:13px;color:#EAD9B4;background:linear-gradient(180deg,rgba(30,23,12,0.97),rgba(20,16,8,0.97));border-bottom:1px solid rgba(214,178,102,0.35);
  box-shadow:0 2px 14px rgba(0,0,0,0.35)}
#demo-strip .tag{font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:#C8A96E;border:1px solid rgba(214,178,102,0.45);border-radius:999px;padding:3px 8px}
#demo-strip .who{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#demo-strip button{font-family:Georgia,serif;font-size:12.5px;color:#1C150A;background:linear-gradient(180deg,#E4C88C,#C8A96E);border:none;border-radius:999px;padding:6px 12px;cursor:pointer}
#demo-veil{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,0.5);display:flex;align-items:flex-start;justify-content:center;padding:${STRIP + 8}px 12px 12px;box-sizing:border-box}
#demo-box{width:100%;max-width:440px;max-height:calc(100% - 20px);overflow-y:auto;box-sizing:border-box;border-radius:18px;padding:16px;font-family:Georgia,serif;color:#EAD9B4;
  background:linear-gradient(180deg,rgba(38,29,15,0.99),rgba(22,17,8,0.99));border:1px solid rgba(145,108,40,0.4);border-top-color:rgba(210,168,65,0.45);box-shadow:inset 0 0 22px rgba(255,248,230,0.05),0 10px 30px rgba(0,0,0,0.5)}
#demo-box h3{margin:0 0 4px;font-size:17px;font-weight:normal;color:#F3E6C8}
#demo-box p{margin:0 0 12px;font-size:12.5px;line-height:1.5;color:#B9A47E}
#demo-box .p{display:block;width:100%;text-align:left;margin:0 0 8px;padding:11px 13px;border-radius:14px;cursor:pointer;font-family:Georgia,serif;color:#EAD9B4;
  background:rgba(255,250,238,0.04);border:1px solid rgba(145,108,40,0.4)}
#demo-box .p[aria-pressed="true"]{border-color:#C8A96E;background:rgba(214,178,102,0.12)}
#demo-box .p b{display:block;font-weight:normal;font-size:14.5px;color:#F3E6C8;margin-bottom:3px}
#demo-box .p span{display:block;font-size:12px;line-height:1.5;color:#B9A47E}
#demo-box .row{display:flex;gap:8px;margin-top:6px}
#demo-box .row button{flex:1;padding:10px;border-radius:999px;cursor:pointer;font-family:Georgia,serif;font-size:13px}
#demo-box .ghost{background:transparent;color:#C8A96E;border:1px solid rgba(214,178,102,0.5)}
#demo-box .main{background:linear-gradient(180deg,#E4C88C,#C8A96E);color:#1C150A;border:none}
#demo-tg{position:fixed;top:${STRIP + 8}px;left:10px;right:10px;margin:0 auto;max-width:420px;z-index:2147483002;box-sizing:border-box;padding:11px 13px 12px;border-radius:16px;cursor:pointer;
  font:13.5px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#F2F5F8;background:rgba(28,34,42,0.96);border:1px solid rgba(120,170,220,0.28);
  box-shadow:0 10px 30px rgba(0,0,0,0.5);animation:demoTgIn .28s ease-out}
#demo-tg .h{display:flex;align-items:center;gap:7px;margin-bottom:4px;color:#5AAEE8;font-size:12.5px}
#demo-tg .h b{color:#E8F1F8;font-weight:600}
#demo-tg .h span{color:#8FA3B5}
#demo-tg .t{white-space:pre-wrap}
#demo-tg .a{display:flex;gap:8px}
#demo-tg .a button{margin-top:9px;flex:1;padding:8px 10px;border-radius:10px;border:1px solid rgba(120,170,220,0.35);background:rgba(90,174,232,0.16);color:#E8F1F8;font:inherit;cursor:pointer}
@keyframes demoTgIn{from{transform:translateY(-12px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion: reduce){#demo-tg{animation:none}}
#demo-page{position:fixed;inset:0;z-index:2147483003;display:flex;flex-direction:column;background:#14110A}
#demo-page .bar{display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top,0px)) 12px 8px;background:#2A2F36;color:#C9D2DB;font:12.5px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
#demo-page .addr{flex:1;min-width:0;padding:7px 10px;border-radius:9px;background:rgba(255,255,255,0.08);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#demo-page .bar button{border:0;background:none;color:#5AAEE8;font:600 14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer;padding:6px 2px}
#demo-page .note{display:none;margin:10px 12px 0;padding:10px 12px;border-radius:12px;font:13px/1.45 Georgia,serif;color:#1C150A;background:linear-gradient(180deg,#E4C88C,#C8A96E)}
#demo-page .body{flex:1;min-height:0;display:flex;flex-direction:column}
#demo-page iframe{flex:1;width:100%;border:0;background:#14110A}
#demo-page pre{margin:0;padding:14px 14px 30px;white-space:pre-wrap;word-break:break-word;font:14px/1.5 ui-monospace,Menlo,monospace;color:#1d1d1d;background:#fff;flex:1;overflow:auto}
`;
const TIPS = {
  anna: { t: "Анна Смирнова, официант", s: "В демо 11:00, смена с 12:00: на главной «Опаздываю?». В чате «@» зовёт коллегу, лупа ищет по переписке, недописанное сообщение ждёт в строке. «Смена» → «Смены в календаре телефона»." },
  maria: { t: "Мария Ким, менеджер", s: "Скоро Дарья напишет, что опаздывает: «Принято» на карточке в чате или под уведомлением бота. «@все» зовёт всю команду. В «Графике» у дня отметка опоздания." },
  roman: { t: "Роман, владелец", s: "«Команда» → «Сервер»: этапы базы, бот, расписания. «Подключить бота» одной кнопкой: вебхук, кнопка «Академия» у поля ввода, команды бота." },
  phone: { t: "Анна: новый телефон", s: "Приложение открыли в Telegram на новом телефоне. Кода нет, а оно узнаёт Анну само: она подключала напоминания." },
};
function strip() {
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  document.documentElement.classList.add("sa-tgfs");
  document.documentElement.style.setProperty("--sa-st", STRIP + "px");
  const el = document.createElement("div"); el.id = "demo-strip";
  el.innerHTML = '<span class="tag">Демо</span><span class="who"></span><button type="button">Сменить</button>';
  el.querySelector(".who").textContent = (newPhone ? TIPS.phone.t : TIPS[who].t) + " · " + R0;
  el.querySelector("button").addEventListener("click", panel);
  document.body.appendChild(el);
}
function panel() {
  if (document.getElementById("demo-veil")) return;
  const v = document.createElement("div"); v.id = "demo-veil";
  v.innerHTML = '<div id="demo-box" role="dialog" aria-label="Демо"><h3>Кто ты в демо</h3><p>Заведение выдуманное, сервер живёт в этой странице. Время в демо идёт с 11:00. Коллеги отвечают сами, а то, что бот прислал бы в Telegram, появляется уведомлением сверху.</p></div>';
  const box = v.querySelector("#demo-box");
  for (const k of ["anna", "maria", "roman", "phone"]) {
    const b = document.createElement("button"); b.type = "button"; b.className = "p"; b.setAttribute("aria-pressed", String(k === "phone" ? newPhone : k === who && !newPhone));
    b.innerHTML = "<b></b><span></span>"; b.querySelector("b").textContent = TIPS[k].t; b.querySelector("span").textContent = TIPS[k].s;
    b.addEventListener("click", () => {
      if (k === "phone") { lsSet(K_WHO, "anna"); lsSet(K_NEW, "1"); lsDel("__demo_me"); location.reload(); return; }
      if (k !== who || newPhone || !lsGet("sa_session_token")) { lsSet(K_WHO, k); lsDel("__demo_me"); location.reload(); } else v.remove();
    });
    box.appendChild(b);
  }
  const row = document.createElement("div"); row.className = "row";
  row.innerHTML = '<button type="button" class="ghost" data-x="reset">Начать заново</button><button type="button" class="main" data-x="close">Закрыть</button>';
  row.querySelector('[data-x="reset"]').addEventListener("click", () => { lsDel(K_SRV); lsDel("__demo_me"); lsDel(K_T); location.reload(); });
  row.querySelector('[data-x="close"]').addEventListener("click", () => v.remove());
  box.appendChild(row);
  v.addEventListener("click", (e) => { if (e.target === v) v.remove(); });
  document.body.appendChild(v);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", strip); else strip();
window.__demo = { srv, save, who, me: full(me), newPhone, toast: tgToast };
