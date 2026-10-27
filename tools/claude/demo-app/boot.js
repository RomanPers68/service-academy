// tools/claude/demo-app/boot.js — v97 (Доп. 410): демо приложения целиком в одной странице. Сервер — в памяти страницы
// (fake-server.js вместо Supabase, состояние — в localStorage), заведение выдуманное: «Два моря, Океан», семь человек,
// график на месяц, меню. Сверху — строка демо: кто ты (Анна, официант, или Мария, менеджер), сменить, начать заново.
// Коллеги «живые»: забирают отданную смену, выходят по «Ищем в смену», отвечают на карточки.
// Собирается в один скрипт (esbuild, IIFE) и подключается в index.html до приложения.
import { makeServer, SHIFTS, full } from "./fake-server.js";
import { RESTAURANT_MENUS } from "../../../data/menu.js";
import { HINTS, HINTS_VERSION } from "../../../data/hints.js";

const R0 = "Два моря, Океан";
const PEOPLE = [
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-olga", name: "Ольга", surname: "Ли", restaurant: R0, position: "hostess", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-petr", name: "Пётр", surname: "Орлов", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-vera", name: "Вера", surname: "Соколова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-darya", name: "Дарья", surname: "Лебедева", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender", is_admin: false },
];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["demo-" + p.id, p.id]));
const tokOf = (id) => "demo-" + id;
const ME = { anna: "e-anna", maria: "u-maria" };
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

// ── состояние сервера: в localStorage, чтобы пережить смену человека и перезагрузку ──
const K_SRV = "__demo_srv", K_WHO = "__demo_who", K_DAY = "__demo_day";
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
let saved = null;
try { saved = lsGet(K_DAY) === TODAY ? JSON.parse(lsGet(K_SRV) || "null") : null; } catch (e) { saved = null; }
// пройденное: Анна и Мария не новички (инструменты открыты), коллеги — для заданий «кто прошёл»
const DONE = ["s0-1", "s0-2", "s0-3", "s0-4", "s1-1", "s1-2"];
const srv = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu: MENU, state: saved,
  progress: { "e-anna": DONE, "u-maria": [...DONE, "s1-3", "s1-4", "s2-1"], "e-petr": DONE.slice(0, 4), "e-vera": DONE }, quizzes: { "e-anna": ["s0-q"], "u-maria": ["s0-q", "s1-q"] },
  wishes: [{ sid: 6, at: 3, kind: "hard" }, { sid: 4, at: 12, kind: "off" }] });
const save = () => { lsSet(K_SRV, JSON.stringify(srv.S)); lsSet(K_DAY, TODAY); };
const D = srv.D;

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
const who = lsGet(K_WHO) === "maria" ? "maria" : "anna";
const me = PEOPLE.find((p) => p.id === ME[who]);

// ── то, что приложение ждёт на устройстве: вход, подсказки уже показаны ──
function seed() {
  const uk = "_" + me.name + "_" + me.surname;
  const keep = new Set([K_SRV, K_WHO, K_DAY]);
  try { Object.keys(localStorage).forEach((k) => { if (!keep.has(k)) localStorage.removeItem(k); }); } catch (e) {}
  const s = { sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0", sa_session_token: tokOf(me.id), sa_profile: JSON.stringify(me),
    sa_ai_fab: "1", ["sa_last_role" + uk]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + uk]: "1", ["sa_mastery" + uk]: JSON.stringify({ tiers: {}, fw: false, master: {} }),
    sa_menu_shared: JSON.stringify({ [R0]: srv.S.menu }), sa_boot_missing: String(Date.now()), __demo_me: me.id };
  for (const k of Object.keys(HINTS)) s["sa_hint_v" + HINTS_VERSION + "_" + k] = "1";
  s["sa_hint_v" + HINTS_VERSION + "_track_orb"] = "1";
  Object.entries(s).forEach(([k, v]) => lsSet(k, v));
}
if (lsGet("__demo_me") !== me.id) seed();

// ── коллеги отвечают ──
const later = (ms, fn) => setTimeout(() => { try { fn(); save(); } catch (e) {} }, ms);
const colleague = (notIds, pos = null) => PEOPLE.find((p) => !notIds.includes(p.id) && (!pos || p.position === pos)) || null;
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
  if (fn === "chat_send" && m && /\?\s*$/.test(String(b.p_body || ""))) {
    const ans = colleague([me.id], me.position === "manager" ? "waiter" : "manager");
    if (ans) later(5000, () => srv.bot.say(ans.id, me.position === "manager" ? "Да, сделаю" : "Сейчас уточню и напишу", m.chat));
  }
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
    return wait(120 + Math.round(Math.random() * 160)).then(() => json(res, res && res.code === "PGRST202" ? 404 : 200));
  }
  if (/\/functions\/v1\/ai-chat/.test(url)) return wait(700).then(() => json({ ok: true, reply: AI_REPLY, model: "demo" }));
  if (/\/index\.html\?ts=/.test(url)) return Promise.resolve(new Response("", { status: 200 }));   // сверка сборки: в демо одна
  if (/supabase\.co/.test(url) || /\/api\//.test(url)) return wait(60).then(() => json({ error: "demo" }, 404));
  return realFetch ? realFetch(input, init) : Promise.reject(new Error("no fetch"));
};

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
`;
const TIPS = {
  anna: { t: "Анна Смирнова, официант", s: "«График»: забери смену Веры и выйди по «Ищем официанта», отдай свою смену в чате. Колода меню: «Поделиться в чат» на обороте блюда. Нажми на имя в чате: карточка коллеги." },
  maria: { t: "Мария Ким, менеджер", s: "«График»: «Кто вместо?» у Дарьи и «Спросить в чате команды», «Ещё» → «Сообщить в чат команды». Меню → редактор: «В стоп» уходит карточкой в чат. Брифинг смены тоже." },
};
function strip() {
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  document.documentElement.classList.add("sa-tgfs");
  document.documentElement.style.setProperty("--sa-st", STRIP + "px");
  const el = document.createElement("div"); el.id = "demo-strip";
  el.innerHTML = '<span class="tag">Демо</span><span class="who"></span><button type="button">Сменить</button>';
  el.querySelector(".who").textContent = TIPS[who].t + " · " + R0;
  el.querySelector("button").addEventListener("click", panel);
  document.body.appendChild(el);
}
function panel() {
  if (document.getElementById("demo-veil")) return;
  const v = document.createElement("div"); v.id = "demo-veil";
  v.innerHTML = '<div id="demo-box" role="dialog" aria-label="Демо"><h3>Кто ты в демо</h3><p>Заведение выдуманное, сервер живёт в этой странице. Коллеги отвечают сами: забирают отданную смену, выходят по «Ищем в смену».</p></div>';
  const box = v.querySelector("#demo-box");
  for (const k of ["anna", "maria"]) {
    const b = document.createElement("button"); b.type = "button"; b.className = "p"; b.setAttribute("aria-pressed", String(k === who));
    b.innerHTML = "<b></b><span></span>"; b.querySelector("b").textContent = TIPS[k].t; b.querySelector("span").textContent = TIPS[k].s;
    b.addEventListener("click", () => { if (k !== who) { lsSet(K_WHO, k); location.reload(); } else v.remove(); });
    box.appendChild(b);
  }
  const row = document.createElement("div"); row.className = "row";
  row.innerHTML = '<button type="button" class="ghost" data-x="reset">Начать заново</button><button type="button" class="main" data-x="close">Закрыть</button>';
  row.querySelector('[data-x="reset"]').addEventListener("click", () => { try { localStorage.removeItem(K_SRV); localStorage.removeItem("__demo_me"); } catch (e) {} location.reload(); });
  row.querySelector('[data-x="close"]').addEventListener("click", () => v.remove());
  box.appendChild(row);
  v.addEventListener("click", (e) => { if (e.target === v) v.remove(); });
  document.body.appendChild(v);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", strip); else strip();
window.__demo = { srv, save, who, me: full(me) };
