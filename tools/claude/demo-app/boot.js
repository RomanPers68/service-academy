// tools/claude/demo-app/boot.js — v97 (Доп. 410): демо приложения целиком в одной странице. Сервер — в памяти страницы
// (fake-server.js вместо Supabase, состояние — в localStorage), заведение выдуманное: «Два моря, Океан», восемь человек,
// график на месяц, меню. Сверху — строка демо: кто ты (Анна, официант; Мария, менеджер; Роман, владелец), сменить,
// начать заново. Коллеги «живые»: забирают отданную смену, выходят по «Ищем в смену», отвечают на карточки.
// v99 (Доп. 412): время в демо идёт с 11:00 (у Анны и Марии смена с 12:00, на главной «Опаздываю?»); «Новый телефон» —
// вход через Telegram без кода; сообщения бота в Telegram — уведомлением сверху (с кнопкой «Принято»); страница
// «Подписаться» на календарь и страница подключения бота открываются поверх приложения.
// v101 (Доп. 414): главная «Линза»; в строке демо — «Вид: …» (Линза или как было), главная меняется сразу.
// v106 (Доп. 419): «Утро руководителя» — Марии и Роману при открытии демо бот присылает утреннюю сводку (она открывается
// как чат с ботом в Telegram, кнопки ведут в приложение); «спасибо» гостей, занятия, брифинг и чек-листы вчерашнего дня.
// v107 (Доп. 420): новички. Ксения Миронова (официант) пришла вчера, сегодня первая смена: вчера вечером бот прислал ей
// памятку, в «Вся команда» её представили, наставник — Анна, первыми в плане — темы с собеседования. Тимур Ахметов (бармен)
// с нами неделю, наставник — Илья, «5 столов» подтверждено, самостоятельной смены ещё нет. В демо можно стать Ксенией.
// v108 (Доп. 421): тепло в команде. Сегодня у Ильи день рождения, Вера год в команде: утром в «Вся команда» карточки,
// коллеги поздравляют; вчера Мария сказала Анне спасибо карточкой, сегодня Ольга — Илье. Сказал спасибо — двое присоединяются.
// v109 (Доп. 422): «Что дало обучение» — журнал занятий команды и ответы в тестах за прошлый и этот месяц (Анна, Пётр и Мария
// занимаются чаще, Дарья ни разу), «спасибо» гостей и коллег, двое новичков вышли на самостоятельную смену; у Марии и Романа
// «Прислать этот итог в Telegram» показывает сообщение бота, его кнопка «Открыть итог» ведёт на экран.
// Собирается в один скрипт (esbuild, IIFE) и подключается в index.html до приложения.
import { makeServer, SHIFTS, full } from "./fake-server.js";
import { RESTAURANT_MENUS } from "../../../data/menu.js";
import { HINTS, HINTS_VERSION } from "../../../data/hints.js";
import { calPage } from "../../../lib/ical.js";
import { LOOKS, LOOK_NAMES, LOOK_KEY, homeLook, setHomeLook } from "../../../lib/home-look.js";
import { morningText, morningKb } from "../../../lib/morning.js";   // v106: «Утро руководителя» — сообщение бота
import { eveText, eveKb } from "../../../lib/newbie.js";   // v107: памятка новичку накануне первой смены

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
  { id: "e-ksenia", name: "Ксения", surname: "Миронова", restaurant: R0, position: "waiter", is_admin: false },   // v107: новичок, первая смена сегодня
  { id: "e-timur", name: "Тимур", surname: "Ахметов", restaurant: R0, position: "bartender", is_admin: false },   // v107: новичок, неделя в команде
];
const TOK = Object.fromEntries(PEOPLE.map((p) => ["demo-" + p.id, p.id]));
const tokOf = (id) => "demo-" + id;
const ME = { anna: "e-anna", maria: "u-maria", roman: "u-roman", ksenia: "e-ksenia" };
const TG_ANNA = "700003";   // Telegram Анны: она подключала напоминания, поэтому приложение узнаёт её без кода
const DEMO_INIT = "user=" + encodeURIComponent(JSON.stringify({ id: Number(TG_ANNA), first_name: "Анна" })) + "&auth_date=" + Math.floor(Date.now() / 1000) + "&hash=demo";
const SSTAFF = [
  { id: 1, name: "Ким Мария", pos: "manager", norm: 160 }, { id: 2, name: "Ли Ольга", pos: "host", norm: 160 },
  { id: 3, name: "Смирнова Анна", pos: "waiter", norm: 160 }, { id: 4, name: "Орлов Пётр", pos: "waiter", norm: 160 },
  { id: 5, name: "Соколова Вера", pos: "waiter", norm: 160 }, { id: 6, name: "Лебедева Дарья", pos: "waiter", norm: 160 },
  { id: 7, name: "Белов Илья", pos: "bar", norm: 160 },
  { id: 8, name: "Миронова Ксения", pos: "waiter", norm: 160 }, { id: 9, name: "Ахметов Тимур", pos: "bar", norm: 160 },   // v107: новички
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
    // v107: Ксения — с сегодняшнего дня (первая смена — сегодня днём), Тимур — с прошлой недели
    if (i >= 0) set(8, "Д-ВВ-ДД-"[i % 8]);
    if (i >= -5) set(9, "ДД-ВВ-Д"[(i + 5) % 7]);
  }
  return out;
}
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const TODAY = iso(new Date());
// v108: даты в карточках сотрудников графика — сегодня у Ильи день рождения, Вера год в команде; у остальных — другие дни
const DM = TODAY.slice(8, 10) + "." + TODAY.slice(5, 7);
Object.assign(SSTAFF[6], { bday: DM, joined: "12.05.2024" });
Object.assign(SSTAFF[4], { bday: "03.08", joined: DM + "." + (Number(TODAY.slice(0, 4)) - 1) });
Object.assign(SSTAFF[0], { bday: "14.02", joined: "01.03.2022" });
Object.assign(SSTAFF[2], { bday: "21.11", joined: "02.06.2024" });
Object.assign(SSTAFF[3], { bday: "07.07", joined: "15.04.2023" });
const MENU = JSON.parse(JSON.stringify(RESTAURANT_MENUS[R0] || []));
// v109 (Доп. 422): «Что дало обучение». Дни месяца → смещения от сегодня: прошлый месяц целиком, этот — до дня за 10 до сегодня
// (последние девять дней — дни занятий «Утра руководителя», learn ниже); в каждый день — запись журнала и ответы в тестах.
const dOff = (iso) => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(+TODAY.slice(0, 4), +TODAY.slice(5, 7) - 1, +TODAY.slice(8, 10))) / 864e5);
const M0 = TODAY.slice(0, 8) + "01";
const M1 = (() => { const d = new Date(Date.UTC(+TODAY.slice(0, 4), +TODAY.slice(5, 7) - 2, 1)); return d.toISOString().slice(0, 10); })();
const dayOf = (m1, n) => { const d = new Date(Date.UTC(+m1.slice(0, 4), +m1.slice(5, 7) - 1, n)); const iso = d.toISOString().slice(0, 10); return iso.slice(0, 7) === m1.slice(0, 7) ? iso : null; };
const LEARN = { "e-anna": [-1, -2, -3], "u-maria": [-1, -2, -3, -4, -5, -6], "e-vera": [-1, -3], "e-olga": [-1, -2], "e-ilya": [-1], "e-petr": [-9], "u-roman": [-1, -2],
  "e-ksenia": [-1], "e-timur": [-1, -2, -4, -5] };
//  p — дни прошлого месяца, c — этого, r — запись дня, t — тесты по кругу, w — раз в сколько дней один неверный ответ из четырёх
//  (в прошлом месяце и в этом; 0 — без ошибок)
const ACT = {
  "e-anna": { p: [4, 11, 18, 25], c: [2, 4, 6, 9, 11, 13, 16, 18, 20], r: { st: 3, l: 2, q: 1 }, t: ["s4-q", "s1-q", "s3-q"], w: [2, 5] },
  "e-petr": { p: [7, 21], c: [3, 5, 8, 10, 12, 15, 17, 19], r: { st: 3, l: 2, q: 1, p: 1 }, t: ["s4-q", "s-prod-q", "s3-q"], w: [1, 4] },
  "u-maria": { p: [2, 9, 16, 23, 30], c: [1, 3, 6, 8, 10, 14, 17, 20], r: { st: 2, l: 1, q: 1 }, t: ["m3-q", "m4-q"], w: [2, 6] },
  "e-vera": { p: [5, 12, 19, 26], c: [6, 13, 20], r: { st: 2, l: 1, q: 1 }, t: ["s4-q", "s1-q"], w: [3, 3] },
  "e-olga": { p: [3, 10, 17, 24, 28], c: [9, 16], r: { st: 2, l: 1 }, t: [], w: [0, 0] },
  "e-ilya": { p: [6, 13, 20, 27], c: [7, 14], r: { st: 2, l: 1, q: 1 }, t: ["bar1-q", "bar4-q"], w: [2, 2] },
  "e-ksenia": { p: [], c: [], r: { st: 2, l: 2 }, t: ["s0-q"], w: [0, 2] },
  "e-timur": { p: [], c: [], r: { st: 2, l: 1, q: 1 }, t: ["bar0-q"], w: [0, 3] },
};
const ACTIVITY = {}, QUIZ = [];
for (const [id, a] of Object.entries(ACT)) {
  const days = [...a.p.map((n) => [dayOf(M1, n), 0]), ...a.c.map((n) => [dayOf(M0, n), 1]), ...(LEARN[id] || []).map((n) => [null, 1, n])];
  days.forEach(([iso, cur, off], i) => {
    const n = off != null ? off : iso ? dOff(iso) : null;
    if (n == null || n > -1 || (off == null && cur && n > -10)) return;
    (ACTIVITY[id] = ACTIVITY[id] || {})[n] = { ...a.r };
    if (a.t.length && a.r.q) QUIZ.push({ emp: id, lesson: a.t[i % a.t.length], at: n, n: 4, w: a.w[cur] && i % a.w[cur] === 0 ? 1 : 0 });
  });
}
// «спасибо» гостей прошлых дней (вчерашние — в thanks ниже, их видит «Утро руководителя»): в прошлом месяце 24, в этом — чаще
const THANKS_OLD = [];
[[M1, [2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18, 20, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 31]], [M0, [1, 2, 2, 3, 4, 4, 5, 6, 7, 7, 8, 9, 10, 10, 11, 12, 13, 13, 14, 15, 16, 16,
  17, 18, 19, 19, 20, 21, 22, 22, 23, 24, 25, 25, 26, 27, 28]]].forEach(([m1, ns], k) => ns.forEach((n, i) => {
  const iso = dayOf(m1, n); if (!iso) return; const off = dOff(iso); if (off >= -1) return;
  THANKS_OLD.push({ emp: ["e-anna", "e-petr", "e-vera", "e-ilya", "e-olga", "e-anna", "u-maria"][(i + k) % 7], at: off, time: "20:" + String(10 + (i % 40)).padStart(2, "0"),
    text: ["Спасибо за вечер", "", "Очень внимательно, спасибо", "Всё было вкусно и быстро", "", "Отличный сервис"][(i + 2 * k) % 6] });
}));
// новички, которые уже вышли на самостоятельную смену (в «Новичках» их больше нет): Ольга — в прошлом месяце за 11 дней,
// Дарья — в этом за 6 (если это было больше двух недель назад)
const NB_PAST = [{ emp: "e-olga", started: dOff(dayOf(M1, 4)), solo: dOff(dayOf(M1, 15)), buddy: "u-maria", buddyBy: "u-maria" }];
if (dOff(dayOf(M0, 8)) <= -15) NB_PAST.push({ emp: "e-darya", started: dOff(dayOf(M0, 2)), solo: dOff(dayOf(M0, 8)), buddy: "e-vera", buddyBy: "u-maria" });
// v106: утром в стопе два блюда — «Утро руководителя» показывает стоп-лист
MENU.filter((d) => d && d.name && d.kind !== "cocktail").slice(3, 5).forEach((d) => Object.assign(d, { stop: { since: Date.now() - 3600e3, by: "Мария Ким" }, stopAt: Date.now() - 3600e3 }));

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
  progress: { "e-anna": DONE, "u-maria": [...DONE, "s1-3", "s1-4", "s2-1"], "e-petr": DONE.slice(0, 4), "e-vera": DONE, "u-roman": DONE, "e-ksenia": ["s0-1"] }, quizzes: { "e-anna": ["s0-q"], "u-maria": ["s0-q", "s1-q"], "u-roman": ["s0-q"] },
  wishes: [{ sid: 6, at: 3, kind: "hard" }, { sid: 4, at: 12, kind: "off" }],
  tgKnown: { [TG_ANNA]: "e-anna" },
  // v106: вчерашний день и привычки команды — для «Утра руководителя» (смещения дней от сегодня)
  thanks: [{ emp: "e-anna", at: -1, time: "19:40", text: "Анна подсказала с вином, всё было идеально" }, { emp: "e-anna", at: -1, time: "21:10", text: "Спасибо за внимательность" },
    { emp: "e-petr", at: -1, time: "20:05", text: "Быстро и вежливо, спасибо" }, { emp: "e-vera", at: -1, time: "18:30", text: "" }, { emp: "e-ilya", at: -2, time: "20:00", text: "Лучший негрони в городе" },
    ...THANKS_OLD],   // v109: и прошлые дни — для «Что дало обучение»
  learn: LEARN,
  activity: ACTIVITY, quiz: QUIZ,   // v109: журнал занятий и ответы в тестах за два месяца («Что дало обучение»)
  briefDays: { "-1": ["e-anna", "e-petr", "e-olga", "e-vera", "u-maria", "e-ilya"] },
  tgLinked: ["u-maria", "u-roman", "e-anna", "e-petr", "e-vera", "e-ksenia"],
  // v107: новички (смещения дней от сегодня), памятка заведения, собеседования «Берём»
  newbies: [
    { emp: "e-ksenia", started: -1, buddy: "e-anna", buddyBy: "u-maria", checked: ["d1c"], hello: { at: -1, time: "18:40", by: "u-maria", greet: ["e-petr", "e-vera", "e-ilya"] } },
    { emp: "e-timur", started: -6, buddy: "e-ilya", buddyBy: "u-maria", checked: ["d1a", "d1b", "d1c", "d1d", "d2a", "d2b", "d2d"],
      confirm: { d2c: { by: "e-ilya", name: "Илья Белов", at: -2 } }, hello: { at: -6, time: "17:20", by: "u-maria", greet: ["e-anna", "e-petr", "e-olga", "e-vera"] } },
    ...NB_PAST,   // v109: уже вышли на самостоятельную смену
  ],
  nbMemo: { addr: "Служебный вход со двора, звонок справа от двери", arrive: 15, dress: "Чёрный верх, тёмные брюки, закрытая обувь. Фартук выдадут на месте",
    meet: "", extra: "Обед для команды в 15:30" },
  cands: [
    { id: 501, name: "Ксения Миронова", at: -6, decision: "hire", aiScores: { "Сервис и гость": 78, "Конфликты и сложные ситуации": 45, "Приоритеты и организация": 70, "Честность и деньги": 62, "Команда": 85 } },
    { id: 502, name: "Глеб Соколов", at: -2, decision: "hire", aiScores: { "Сервис и гость": 66, "Конфликты и сложные ситуации": 72, "Приоритеты и организация": 58, "Честность и деньги": 80, "Команда": 74 } },
  ],
  // v108: «спасибо» от коллег в «Вся команда» (смещение дня и время; позже вчерашней карточки «Знакомьтесь»)
  peerThanks: [
    { from: "u-maria", to: "e-anna", text: "выручила с банкетом на веранде", at: -1, time: "21:50", plus: ["e-petr", "e-olga"] },
    { from: "e-olga", to: "e-ilya", text: "помог с гостями у бара", at: 0, time: "10:20", plus: ["e-vera"] },
    // v109: и в прошлом месяце — для «Что дало обучение»
    ...[["e-vera", "e-petr", "подменил в субботу", 12], ["e-ilya", "e-olga", "помогла с большой бронью", 20]].map(([from, to, text, n]) => ({ from, to, text, at: dOff(dayOf(M1, n)), time: "22:15", plus: [] })),
  ],
  checklists: { "-1": { open: { checked: ["o1", "o2", "o3", "o4", "o5", "o6"], done_at: iso(new Date(Date.now() - 86400000)) + "T09:52:00", by_name: "Ольга Л." },
    preshift: { checked: ["p1", "p2", "p3", "p4", "p5"], done_at: iso(new Date(Date.now() - 86400000)) + "T11:40:00", by_name: "Мария К." },
    close: { checked: ["c1", "c2", "c3", "c4"], done_at: null, by_name: null } } },
  // бот пишет в Telegram: мне — уведомлением сверху, остальным — никак (их телефонов в демо нет)
  ping: (to, text, acts, chat, msg, o) => { if (to !== me.id) return;
    if (o && o.kind === "morning") setTimeout(() => tgChat(text, o.kb, nowHM()), 400);
    else if (o && o.kind === "gain") setTimeout(() => tgChat(text, o.kb, nowHM(), { note: "Так 1-го числа в 10:00 приходит итог прошлого месяца. Кнопка открывает его в приложении." }), 400);   // v109
    else setTimeout(() => tgToast(text, acts), 500); } });
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
  const keep = new Set([K_SRV, K_WHO, K_DAY, K_T, LOOK_KEY]);
  try { Object.keys(localStorage).forEach((k) => { if (!keep.has(k)) localStorage.removeItem(k); }); } catch (e) {}
  try { sessionStorage.removeItem("sa_tg_skip"); } catch (e) {}
  const s = { sa_welcome_seen_v11: "1", sa_hint_mistakes: "1", sa_mode_hint: "1", sa_sfx: "0", sa_guest_voice: "0",
    sa_ai_fab: "1", ["sa_last_role" + uk]: JSON.stringify("seasonal"), ["sa_ach_pioneer" + uk]: "1", ["sa_mastery" + uk]: JSON.stringify({ tiers: {}, fw: false, master: {} }),
    sa_menu_shared: JSON.stringify({ [R0]: srv.S.menu }), sa_boot_missing: String(Date.now()), __demo_me: me.id };
  if (!newPhone) { s.sa_session_token = tokOf(me.id); s.sa_profile = JSON.stringify(me); }   // новый телефон — входа ещё нет
  // v101: серия и журнал прошлых дней — живой сотрудник, а не первый день (Анна 3 дня подряд, Мария 6, Роман 2)
  const sn = { "e-anna": 3, "u-maria": 6, "u-roman": 2 }[me.id] || 0;
  if (sn && !newPhone) {
    const ago = (n) => iso(new Date(Date.now() - n * 86400000));
    s["sa_streak" + uk] = JSON.stringify({ count: sn, best: Math.max(sn, 5), last: ago(1), days: Array.from({ length: sn }, (_, i) => ago(sn - i)) });
    s["sa_activity" + uk] = JSON.stringify(Object.fromEntries(Array.from({ length: sn }, (_, i) => [ago(sn - i), { st: 2, l: 1, q: 1 }])));
  }
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
  // v107: представили новичка — коллеги здороваются; самостоятельная смена — поздравляют
  // v108: сказал спасибо коллеге — двое присоединяются
  if (fn === "chat_thanks" && m && m.card) later(5000, () => ["e-vera", "e-petr", "e-olga"].filter((id) => id !== me.id && id !== b.p_to).slice(0, 2)
    .forEach((id) => srv.rpc("chat_cheer", { p_token: tokOf(id), p_msg: m.id })));
  if (fn === "newbie_set" && b.p_hello && m) later(5000, () => ["e-petr", "e-vera", "e-olga"].filter((id) => id !== me.id && id !== b.p_emp).forEach((id) => srv.rpc("chat_greet", { p_token: tokOf(id), p_msg: m.id })));
  if (fn === "newbie_confirm" && b.p_step === "d3b" && b.p_on !== false) later(5000, () => { const n = srv.S.nb[b.p_emp]; if (n && n.soloMsg) ["e-vera", "e-petr", "e-olga", "e-anna"].filter((id) => id !== me.id && id !== b.p_emp).slice(0, 3).forEach((id) => srv.rpc("chat_greet", { p_token: tokOf(id), p_msg: n.soloMsg })); });
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
const cheerBy = (id) => { if (id === me.id) return; for (const m of srv.S.msgs) if (m.card && (m.card.t === "bday" || m.card.t === "anniv") && m.card.day === TODAY && m.card.emp !== id && !m.del)
  srv.rpc("chat_cheer", { p_token: tokOf(id), p_msg: m.id }); };
const once = (key, ms, fn) => { if (EV[key]) return; later(ms, () => { if (EV[key]) return; EV[key] = 1; fn(); }); };
if (!newPhone) {
  if (who === "anna") once("ment-anna", 15000, () => srv.bot.say("u-maria", "@Анна, возьмёшь сегодня банкет на веранде? Гости к 19:00, нужен один официант на весь вечер."));
  if (who === "maria") once("ment-maria", 15000, () => srv.bot.say("e-petr", "@Мария, на банкет нужен ещё один стол. Ставим к окну?"));
  if (who === "roman") once("ment-roman", 15000, () => srv.bot.say("u-maria", "@Роман, к банкету берём «Шабли» или «Совиньон блан»? Нужно решить до 15:00."));
  if (who === "maria") once("late-darya", 25000, () => srv.rpc("chat_late", { p_token: tokOf("e-darya"), p_chat: null, p_min: 20, p_note: "автобус сломался" }));
  // v106: «Утро руководителя» пришло в 9:00 — при открытии демо оно уже ждёт в Telegram
  if (who === "maria" || who === "roman") once("morning-" + who, 1800, () => {
    const mb = srv.rpc("morning_brief", { p_token: tokOf(me.id) });
    if (mb && mb.ok) tgChat(morningText(mb, me.name), morningKb(mb), "09:00");
  });
  // v107: Ксения — вчера в 19:00 бот прислал памятку на первую смену; через 12 секунд с ней здоровается Ольга
  if (who === "ksenia") once("eve-ksenia", 1800, () => {
    const r = srv.rpc("newbie_me", { p_token: tokOf(me.id) });
    if (r && r.ok && r.first) tgChat(eveText(r), eveKb(), "19:00", { day: "Вчера", note: "Так новичок получает памятку накануне первой смены. Кнопка открывает «Первую неделю»." });
  });
  // v108: день рождения Ильи и годовщина Веры — коллеги поздравляют по одному
  once("cheer-1", 6000, () => cheerBy("e-petr"));
  once("cheer-2", 15000, () => cheerBy("e-olga"));
  if (who === "ksenia") once("greet-olga", 12000, () => { const n = srv.S.nb["e-ksenia"]; if (n && n.hello) srv.rpc("chat_greet", { p_token: tokOf("e-olga"), p_msg: n.hello }); });
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

// ── v106: чат с ботом в Telegram — утренняя сводка руководителю. Текст — HTML бота (только <b> и экранированный текст),
// кнопки ведут в приложение, как web_app-кнопки в Telegram ──
const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
function tgChat(html, kb, at, o = {}) {
  const old = document.getElementById("demo-tgchat"); if (old) old.remove();
  const v = document.createElement("div"); v.id = "demo-tgchat"; v.setAttribute("role", "dialog"); v.setAttribute("aria-label", "Telegram: сообщение бота");
  v.innerHTML = '<div class="bar"><button type="button" class="x" aria-label="Закрыть">‹</button><span class="ava">SA</span><span class="who"><b>Академия</b><i>бот</i></span><button type="button" class="done">Готово</button></div>' +
    '<div class="note">Так приходит «Утро руководителя» в Telegram. Кнопки открывают приложение.</div><div class="feed"><div class="day">Сегодня</div><div class="msg"><div class="t"></div><span class="tm"></span></div><div class="kb"></div></div>';
  v.querySelector(".t").innerHTML = String(html || "").replace(/\n/g, "<br>");
  v.querySelector(".tm").textContent = at || "";
  if (o.day) v.querySelector(".day").textContent = o.day;   // v107: памятка новичку пришла вчера
  if (o.note) v.querySelector(".note").textContent = o.note;
  const close = () => v.remove();
  v.querySelector(".x").addEventListener("click", close); v.querySelector(".done").addEventListener("click", close);
  const go = { morning: "morning", briefing: "brief", schedule: "schedule", newbie: "newbie", newbies: "newbies" };
  for (const row of kb || []) {
    const r = document.createElement("div"); r.className = "row";
    for (const k of row) {
      const btn = document.createElement("button"); btn.type = "button"; btn.textContent = k.text; btn.setAttribute("data-demo-tgbtn", k.go);
      btn.addEventListener("click", () => { close(); try {
        if (/^gain_/.test(k.go)) { if (window.__saGainMonth) window.__saGainMonth(k.go.slice(5)); if (window.__saNav) window.__saNav("gain"); }   // v109: «Открыть итог» за этот месяц
        else if (window.__saNav && go[k.go]) window.__saNav(go[k.go]);
      } catch (e) {} });
      r.appendChild(btn);
    }
    v.querySelector(".kb").appendChild(r);
  }
  document.body.appendChild(v);
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
#demo-strip .look{position:relative;flex-shrink:0;display:inline-flex;align-items:center;gap:5px;padding:5px 26px 5px 11px;border-radius:999px;border:1px solid rgba(214,178,102,0.55);
  color:#EAD9B4;font-size:12.5px;white-space:nowrap}
#demo-strip .look b{font-weight:normal;color:#F3E6C8}
#demo-strip .look:after{content:"";position:absolute;right:11px;top:50%;width:6px;height:6px;margin-top:-5px;border:solid #C8A96E;border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
#demo-strip .look select{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:16px}
#demo-strip .chg{flex-shrink:0}
@media (max-width:380px){#demo-strip{gap:7px;padding:0 8px}#demo-strip .tag{display:none}#demo-strip .look .lk-l{display:none}#demo-strip .chg{padding:6px 10px}}
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
#demo-tgchat{position:fixed;inset:0;z-index:2147482990;display:flex;flex-direction:column;background:#0E1621;color:#F5F7FA;font:15px/1.42 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
#demo-tgchat .bar{display:flex;align-items:center;gap:10px;padding:calc(${STRIP + 6}px) 10px 8px;background:#17212B;border-bottom:1px solid rgba(255,255,255,0.06)}
#demo-tgchat .bar .x{border:0;background:none;color:#6AB2F2;font-size:30px;line-height:1;padding:0 6px 4px;cursor:pointer}
#demo-tgchat .ava{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(180deg,#E4C88C,#C8A96E);color:#1C150A;font:600 13px Georgia,serif;letter-spacing:1px}
#demo-tgchat .who{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}
#demo-tgchat .who b{font-weight:600;font-size:15.5px}
#demo-tgchat .who i{font-style:normal;font-size:13px;color:#8B9AA8}
#demo-tgchat .bar .done{border:0;background:none;color:#6AB2F2;font:600 15px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer;padding:6px 4px}
#demo-tgchat .note{margin:10px 12px 0;padding:9px 12px;border-radius:12px;font:13px/1.45 Georgia,serif;color:#1C150A;background:linear-gradient(180deg,#E4C88C,#C8A96E)}
#demo-tgchat .feed{flex:1;min-height:0;overflow-y:auto;padding:12px 10px 24px;display:flex;flex-direction:column;align-items:flex-start}
#demo-tgchat .day{align-self:center;margin:2px 0 10px;padding:3px 10px;border-radius:12px;background:rgba(0,0,0,0.35);color:#C9D2DB;font-size:13px}
#demo-tgchat .msg{position:relative;max-width:92%;padding:8px 12px 20px;border-radius:16px 16px 16px 6px;background:#182533;box-shadow:0 1px 1px rgba(0,0,0,0.25)}
#demo-tgchat .msg .t{white-space:normal;word-break:break-word}
#demo-tgchat .msg .t b{font-weight:600}
#demo-tgchat .msg .tm{position:absolute;right:10px;bottom:5px;font-size:12px;color:#6D7F8F}
#demo-tgchat .kb{width:92%;max-width:92%;margin-top:4px;display:flex;flex-direction:column;gap:4px}
#demo-tgchat .kb .row{display:flex;gap:4px}
#demo-tgchat .kb button{flex:1;min-width:0;padding:10px 8px;border:0;border-radius:10px;background:rgba(43,82,120,0.55);color:#F5F7FA;font:500 14.5px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer}
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
  anna: { t: "Анна Смирнова, официант", s: "Главная сотрудника: медальоны дня, приглашение, график и книга отзывов, инструменты, треки. В демо 11:00, смена с 12:00: на главной «Опаздываю?». Анна ведёт новичка: «Команда» → «Новички». Сегодня у Ильи день рождения и Вера год в команде: в «Вся команда» можно поздравить. Спасибо коллеге: нажми на имя в чате или «+» → «Спасибо коллеге»; свои — «Я» → «Спасибо от коллег»." },
  maria: { t: "Мария Ким, менеджер", s: "Главная менеджера: у инструментов ещё «AI-интервью». Скоро Дарья напишет, что опаздывает: «Принято» на карточке в чате или под уведомлением бота. Утром бот прислал «Утро руководителя»: «Смена» → «Утро руководителя». «Команда» → «Новички»: Ксения и Тимур. В «Рейтинге» «Сотрудник недели» считает и «спасибо» от коллег." },
  roman: { t: "Роман, владелец", s: "Главная владельца: «Пульс недели» и все инструменты. «Команда» → «Сервер»: этапы базы, бот, расписания. Утром бот прислал «Утро руководителя»." },
  ksenia: { t: "Ксения Миронова, новичок", s: "Вчера пришла в команду, сегодня первая смена. Вчера вечером бот прислал памятку. «Смена» → «Первая неделя»: наставник, план и темы с собеседования. В «Вся команда» с ней здороваются." },
  phone: { t: "Анна: новый телефон", s: "Приложение открыли в Telegram на новом телефоне. Кода нет, а оно узнаёт Анну само: она подключала напоминания." },
};
function strip() {
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  document.documentElement.classList.add("sa-tgfs");
  document.documentElement.style.setProperty("--sa-st", STRIP + "px");
  const el = document.createElement("div"); el.id = "demo-strip";
  el.innerHTML = '<span class="tag">Демо</span><span class="who"></span>' +
    '<label class="look"><span class="lk-l">Вид:</span><b></b><select aria-label="Вид главной"></select></label>' +
    '<button type="button" class="chg">Сменить</button>';
  // v101: «Вид: …» — как сейчас, Линза, Строчка, Меню; главная меняется сразу (App слушает LOOK_EVENT)
  const sel = el.querySelector(".look select"), lab = el.querySelector(".look b");
  for (const k of LOOKS) { const o = document.createElement("option"); o.value = k; o.textContent = LOOK_NAMES[k].replace(/^./, (c) => c.toUpperCase()); sel.appendChild(o); }
  const lookUpd = () => { const v = homeLook(); sel.value = v; lab.textContent = LOOK_NAMES[v].replace(/^./, (c) => c.toUpperCase()); };
  sel.addEventListener("change", () => { setHomeLook(sel.value); lookUpd(); });
  lookUpd();
  el.querySelector(".who").textContent = (newPhone ? TIPS.phone.t : TIPS[who].t) + " · " + R0;
  el.querySelector(".chg").addEventListener("click", panel);
  document.body.appendChild(el);
}
function panel() {
  if (document.getElementById("demo-veil")) return;
  const v = document.createElement("div"); v.id = "demo-veil";
  v.innerHTML = '<div id="demo-box" role="dialog" aria-label="Демо"><h3>Кто ты в демо</h3><p>Заведение выдуманное, сервер живёт в этой странице. Время в демо идёт с 11:00. Коллеги отвечают сами, а то, что бот прислал бы в Telegram, появляется уведомлением сверху. «Вид» в строке вверху показывает главную «Линзой» или как было до неё.</p></div>';
  const box = v.querySelector("#demo-box");
  for (const k of ["anna", "maria", "roman", "ksenia", "phone"]) {
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
window.__demo = { srv, save, who, me: full(me), newPhone, toast: tgToast, tgChat };
