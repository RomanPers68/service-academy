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
import { CONCEPT_SEED, CONCEPT_PHOTOS } from "./concept-seed.js";   // v139 (Доп. 454): «О нас» — пример концепции и стандартов
import { LESSON_PHOTOS } from "./lesson-photo-seed.js";   // v146 (Доп. 467): фото уроков — пример, руководитель меняет на свои
import { RESTAURANT_MENUS } from "../../../data/menu.js";
import { HINTS, HINTS_VERSION } from "../../../data/hints.js";
import { calPage } from "../../../lib/ical.js";
import { LOOKS, LOOK_NAMES, LOOK_KEY, homeLook, setHomeLook } from "../../../lib/home-look.js";
import { morningText, morningKb } from "../../../lib/morning.js";   // v106: «Утро руководителя» — сообщение бота
import { eveText, eveKb } from "../../../lib/newbie.js";
import { normWine, TEMP_HINT } from "../../../lib/wine.js";
import { descAngles } from "../../../lib/dish-desc.js";   // v153: углы «Пяти вариантов описания»
import { unpackWeb } from "../../../lib/ai-web.js";   // v155: запросы поиска упакованы
if (typeof window !== "undefined") window.__demoUnpack = unpackWeb;   // v155: e2e читают упакованные запросы
import { normSpirit, TEMP_HINT_SP } from "../../../lib/spirit.js";
import { nameParts } from "../../../lib/bar-view.js";   // v128: на «этикетке» — русское название   // v127: крепкое в «Барной карте» демо   // v120: винная карта демо и AI-импорт вместо сервера   // v107: памятка новичку накануне первой смены

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
  // v141 (Доп. 459): вперёд — до конца месяца, но не меньше двух недель: в начале месяца следующий ещё не составлен, и в
  // «Графике» у Марии видно напоминание по ТК РФ, ст. 103 (раньше — на 45 дней вперёд)
  const t0 = new Date(), left = new Date(t0.getFullYear(), t0.getMonth() + 1, 0).getDate() - t0.getDate();
  for (let i = -30; i <= Math.max(14, left); i++) {
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
// v120 (Доп. 433): винная карта «Двух морей» — восемь вин; у одного поля дописал AI и их ещё не проверили (кнопка «Верно»)
const dish = (n) => (MENU.find((d) => d && d.name && d.name.startsWith(n)) || {}).id;
const DEMO_WINES = [
  { name: "Просекко DOC Extra Dry", producer: "Bottega", country: "Италия", region: "Венето", grapes: ["глера"], color: "sparkling", sweet: "экстра сухое", byGlass: true, priceGlass: 650, priceBottle: 3600, temp: "6–8 °C", glass: "флюте",
    notes: ["груша", "белые цветы", "лёгкая пена"], short: "Лёгкие пузырьки и груша: начать вечер и к закускам.", pair: [dish("Креветка темпура"), dish("Ассорти паштетов")] },
  { name: "Шабли", producer: "Domaine Laroche", country: "Франция", region: "Бургундия, Шабли", grapes: ["шардоне"], color: "white", sweet: "сухое", vintage: "2022", byGlass: true, priceGlass: 950, priceBottle: 5200, temp: "8–10 °C", glass: "бургундия",
    notes: ["зелёное яблоко", "мел", "лимон"], short: "Свежее, минеральное, с кислинкой: к морепродуктам лучше не придумать.", story: "Шардоне без дуба с известняковых почв Шабли: чистое, звонкое, с меловым послевкусием. Гостю: «если любите свежие белые без сладости».",
    pair: [dish("Закуска из морепродуктов"), dish("Салат с крабом"), dish("Кальмар")] },
  { name: "Совиньон Блан / Sauvignon Blanc", producer: "Cloudy Bay", country: "Новая Зеландия", region: "Мальборо", grapes: ["совиньон блан"], color: "white", sweet: "сухое", vintage: "2023", priceBottle: 6900, temp: "8–10 °C", glass: "универсальный",
    notes: ["маракуйя", "крыжовник", "свежескошенная трава"], short: "Яркий и ароматный: тропические фрукты и свежая зелень.", pair: [dish("Салат с креветками")] },
  { name: "Рислинг Кабинетт / Riesling Kabinett", producer: "Dr. Loosen", country: "Германия", region: "Мозель", grapes: ["рислинг"], color: "white", sweet: "полусладкое", vintage: "2021", byGlass: true, priceGlass: 780, priceBottle: 4300, temp: "8–10 °C", glass: "универсальный",
    notes: ["персик", "лайм", "мёд"], short: "Сочный, с лёгкой сладостью и кислинкой: к острому и азиатскому.", pair: [dish("Кальмар в азиатском стиле")] },
  { name: "Розе Côtes de Provence", producer: "Château d’Esclans", country: "Франция", region: "Прованс", grapes: ["гренаш", "сенсо"], color: "rose", sweet: "сухое", vintage: "2023", priceBottle: 5900, temp: "8–10 °C", glass: "универсальный",
    notes: ["клубника", "грейпфрут", "травы"], short: "Бледное и сухое розовое: лето в бокале.", ai: ["grapes", "notes", "short"] },
  { name: "Пино Нуар", producer: "Louis Jadot", country: "Франция", region: "Бургундия", grapes: ["пино нуар"], color: "red", sweet: "сухое", vintage: "2020", byGlass: true, priceGlass: 1100, priceBottle: 6100, temp: "14–16 °C", glass: "бургундия",
    notes: ["вишня", "малина", "лесная подстилка"], short: "Лёгкое красное: можно и к рыбе, и к крабовой котлете.", pair: [dish("Крабовая котлета")] },
  { name: "Кьянти Классико / Chianti Classico", producer: "Castello di Ama", country: "Италия", region: "Тоскана", grapes: ["санджовезе"], color: "red", sweet: "сухое", vintage: "2019", priceBottle: 7400, temp: "16–18 °C", glass: "бордо",
    notes: ["вишня", "фиалка", "пряности"], short: "Классическая Тоскана: вишня, специи, бодрая кислотность." },
  { name: "Москато д’Асти", producer: "Saracco", country: "Италия", region: "Пьемонт", grapes: ["москато"], color: "dessert", sweet: "сладкое", vintage: "2023", byGlass: true, priceGlass: 590, priceBottle: 3300, temp: "6–8 °C", glass: "флюте",
    notes: ["абрикос", "апельсиновый цвет", "мускат"], short: "Сладкое и чуть игристое: к десерту, особенно к конфетам.", pair: [dish("Ассорти конфет")] },
];
// v122 (Доп. 435): у части вин — «фото бутылки». Хранилища в демо нет, снимков бутылок тоже: рисуем бутылку с этикеткой
// на холсте (своя простая картинка) и кладём JPEG прямо в запись. У «Шабли» фото нет — в «Импорт» → «Фото бутылок» снимок
// добавится к нему.
const GLASS_OF = { sparkling: ["#4F5E2E", "#7C8C49"], white: ["#5B6A33", "#8A9A57"], rose: ["#E6B2A1", "#F5D2C4"], red: ["#1E2A1B", "#3A4A32"], dessert: ["#9A6420", "#C98F3E"],
  amber: ["#4A2A0C", "#A2652A"], clear: ["#4F5D63", "#9FB3BA"] };   // v127: янтарное и прозрачное стекло — для крепкого
function bottlePic(w) {
  try {
    const c = document.createElement("canvas"); c.width = 300; c.height = 400;
    const g = c.getContext("2d");
    const bg = g.createRadialGradient(150, 150, 30, 150, 220, 320); bg.addColorStop(0, "#4A3620"); bg.addColorStop(1, "#140D06");
    g.fillStyle = bg; g.fillRect(0, 0, 300, 400);
    const [dark, light] = GLASS_OF[w.color] || GLASS_OF.red;
    const body = g.createLinearGradient(95, 0, 205, 0); body.addColorStop(0, dark); body.addColorStop(0.45, light); body.addColorStop(1, dark);
    g.fillStyle = body;
    g.beginPath(); g.moveTo(134, 30); g.lineTo(166, 30); g.lineTo(166, 120); g.bezierCurveTo(166, 150, 205, 160, 205, 200); g.lineTo(205, 380);
    g.quadraticCurveTo(205, 392, 193, 392); g.lineTo(107, 392); g.quadraticCurveTo(95, 392, 95, 380); g.lineTo(95, 200); g.bezierCurveTo(95, 160, 134, 150, 134, 120); g.closePath(); g.fill();
    g.fillStyle = w.color === "sparkling" ? "#D9B25E" : "#5A1E1E"; g.fillRect(132, 24, 36, 34);   // фольга или капсула
    g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(112, 200, 8, 170);                       // блик на стекле
    g.fillStyle = "#F3EAD6"; g.fillRect(104, 238, 92, 104);                                     // этикетка
    g.strokeStyle = "#B08A47"; g.lineWidth = 2; g.strokeRect(109, 243, 82, 94);
    g.fillStyle = "#3A2A14"; g.textAlign = "center";
    const words = String(w.name).split(" "), lines = [];
    for (const x of words) { const last = lines[lines.length - 1]; if (last && (last + " " + x).length <= 11) lines[lines.length - 1] = last + " " + x; else lines.push(x); }
    g.font = "bold 15px Georgia, serif"; lines.slice(0, 3).forEach((t, i) => g.fillText(t, 150, 274 + i * 18));
    g.font = "italic 11px Georgia, serif"; g.fillText(w.vintage ? String(w.vintage) : "", 150, 326);   // только название и год: не копия настоящей этикетки
    return c.toDataURL("image/jpeg", 0.8);
  } catch (e) { return ""; }
}
const WITH_PIC = ["Просекко DOC Extra Dry", "Пино Нуар", "Кьянти Классико / Chianti Classico", "Москато д’Асти", "Рислинг Кабинетт / Riesling Kabinett"];
// v123 (Доп. 436): два вина добавлены три дня назад — в тренировке «Новые вина»; остальные — давно (без addedAt, как до v123)
const NEW_IN_DEMO = ["Совиньон Блан / Sauvignon Blanc", "Москато д’Асти"];
// v128 (Доп. 441): у трёх вин название «Русское / Original», как в карте владельца: в списке — в две строки
// v132 (Доп. 445): у четырёх вин — вкус по шкалам (у «Кьянти» — от ИИ, ещё не проверен); остальным его дополнит «Заполнить через ИИ»
const TASTE_DEMO = { "Шабли": { body: 2, acid: 5, tannin: 1, sweet: 1, oak: 1 }, "Пино Нуар": { body: 2, acid: 4, tannin: 2, sweet: 1, oak: 2 },
  "Просекко DOC Extra Dry": { body: 1, acid: 4, tannin: 1, sweet: 2, oak: 1 }, "Кьянти Классико / Chianti Classico": { body: 3, acid: 4, tannin: 3, sweet: 1, oak: 2, ai: 1 } };
DEMO_WINES.forEach((w, i) => MENU.push(normWine({ ...w, taste: TASTE_DEMO[w.name] || null, pair: (w.pair || []).filter(Boolean), img: WITH_PIC.includes(w.name) ? bottlePic({ ...w, name: nameParts(w.name).main }) : "",
  addedAt: NEW_IN_DEMO.includes(w.name) ? Date.now() - 3 * 864e5 : 0 }, { id: "wn-demo-" + (i + 1), ai: w.ai || [] })));
// v127 (Доп. 440): крепкое «Двух морей» в «Барной карте» — десять позиций по видам. Две добавлены три дня назад («Новинки»),
// пять — «ходовое» (путь новичка), у «Olmeca» ноты и фразу дописал AI и их ещё не проверили; у трёх — фото бутылки (своя
// простая картинка, как у вин)
const DEMO_SPIRITS = [
  { name: "Glenfiddich 12", producer: "William Grant & Sons", cat: "whisky", style: "односолодовый", country: "Шотландия", region: "Спейсайд", age: "12 лет", abv: 40, portion: 40, pricePortion: 650, priceBottle: 9800, volume: "0,7 л",
    serve: ["чистым", "с каплей воды"], glass: "гленкерн", temp: "комнатная, 18–20 °C", hot: true, notes: ["груша", "мёд", "дуб"], short: "Мягкий спейсайд с грушей и мёдом: хорош для знакомства с односолодовым.",
    story: "Один из самых известных односолодовых. Бочки из-под бурбона и хереса дают грушу, мёд и лёгкий дуб. Тому, кто пьёт виски редко, предложи с каплей воды: аромат раскроется." },
  { name: "Lagavulin 16", producer: "Lagavulin", cat: "whisky", style: "торфяной", country: "Шотландия", region: "Айла", age: "16 лет", abv: 43, portion: 40, pricePortion: 1200, priceBottle: 21000, volume: "0,7 л",
    serve: ["чистым", "с каплей воды"], glass: "гленкерн", temp: "комнатная, 18–20 °C", notes: ["торфяной дым", "йод", "сухофрукты"], short: "Дым, море и сухофрукты Айлы: для тех, кто любит торф.", pair: [dish("Крабовая котлета")] },
  { name: "Maker's Mark", producer: "Maker's Mark", cat: "whisky", style: "бурбон", country: "США", region: "Кентукки", abv: 45, portion: 40, pricePortion: 550, priceBottle: 7900, volume: "0,7 л",
    serve: ["чистым", "со льдом", "в коктейле"], glass: "рокс", temp: "комнатная или со льдом", hot: true, notes: ["карамель", "ваниль", "пшеничный хлеб"], short: "Сладкий бурбон с карамелью и ванилью: чистым, со льдом или в «Олд фэшн»." },
  { name: "Hennessy VS", producer: "Hennessy", cat: "cognac", style: "VS", country: "Франция", region: "Коньяк", abv: 40, portion: 40, pricePortion: 750, priceBottle: 11500, volume: "0,7 л",
    serve: ["чистым"], glass: "тюльпан", temp: "комнатная, 18–20 °C", hot: true, notes: ["ваниль", "дуб", "сухофрукты"], short: "Молодой живой коньяк: ваниль, дуб и сухофрукты, после ужина." },
  { name: "Havana Club 7", producer: "Havana Club", cat: "rum", style: "выдержанный", country: "Куба", age: "7 лет", abv: 40, portion: 40, pricePortion: 450, priceBottle: 6500, volume: "0,7 л",
    serve: ["чистым", "со льдом", "в коктейле"], glass: "рокс", temp: "комнатная или со льдом", notes: ["табак", "какао", "ваниль"], short: "Кубинский ром с какао и табаком: чистым или со льдом." },
  { name: "Hendrick's", producer: "William Grant & Sons", cat: "gin", style: "травяной", country: "Шотландия", abv: 41.4, portion: 40, pricePortion: 520, priceBottle: 8500, volume: "0,7 л",
    serve: ["в коктейле", "охлаждённым"], glass: "хайбол", temp: "охлаждённым", hot: true, notes: ["огурец", "роза", "можжевельник"], short: "Огурец и роза: в джин-тоник с ломтиком огурца.", pair: [dish("Креветка темпура"), dish("Кальмар")] },
  { name: "Белуга Нобл", producer: "Белуга", cat: "vodka", style: "классическая", country: "Россия", abv: 40, portion: 50, pricePortion: 450, priceBottle: 7200, volume: "0,7 л",
    serve: ["охлаждённым"], glass: "шот", temp: "охлаждённой, 4–6 °C", hot: true, notes: ["злаки", "мягкость", "чистый вкус"], short: "Мягкая и чистая: охлаждённой к закускам из морепродуктов.", pair: [dish("Закуска из морепродуктов"), dish("Ассорти паштетов")] },
  { name: "Olmeca Blanco", producer: "Olmeca", cat: "agave", style: "бланко", country: "Мексика", region: "Халиско", abv: 38, portion: 40, pricePortion: 380, priceBottle: 4900, volume: "0,7 л",
    serve: ["в коктейле", "чистым"], glass: "шот", temp: "комнатная", notes: ["агава", "цитрус", "перец"], short: "Свежая бланко: в «Маргариту» или шотом с лаймом.", ai: ["notes", "short"] },
  { name: "Campari", producer: "Campari", cat: "bitter", style: "аперитив", country: "Италия", abv: 25, portion: 40, pricePortion: 400, priceBottle: 3900, volume: "0,7 л",
    serve: ["со льдом", "в коктейле"], glass: "рокс", temp: "со льдом", notes: ["горький апельсин", "травы"], short: "Горький апельсин и травы: в «Негрони» или со льдом и содовой." },
  { name: "Baileys Original", producer: "Baileys", cat: "liqueur", style: "сливочный", country: "Ирландия", abv: 17, portion: 50, pricePortion: 400, priceBottle: 3600, volume: "0,7 л",
    serve: ["со льдом"], glass: "рокс", temp: "со льдом", notes: ["сливки", "ваниль", "какао"], short: "Сливки, ваниль и какао: к кофе или вместо десерта." },
  // v134 (Доп. 447): как у владельца на снимке: из карты пришли вид, страна, выдержка, порция и цена (помечены «AI»), остальное
  // пусто; «Заполнить по названию» допишет остальное и вписанное не тронет
  { name: "АБЕРФЕЛДИ 12 ЛЕТ / ABERFELDY 12 YEARS", cat: "whisky", country: "Шотландия", age: "12 лет", portion: 40, pricePortion: 700, ai: ["cat", "country", "age", "portion", "pricePortion"] },
  // v151 (Доп. 475): своя настойка бара — в карте только название, порция и цена; AI о ней ничего не знает («Дописать пустое»
  // покажет её в «AI не нашёл, что дописать»)
  { name: "Настойка «Облепиха с мёдом», своя", portion: 50, pricePortion: 350 },
  // v152 (Доп. 476): кальвадос — в карте только название, порция и цена; AI демо его не знает, а «Поискать в интернете» находит
  { name: "Кальвадос Pays d’Auge, Christian Drouin", portion: 40, pricePortion: 690 },
];
const SPIRIT_GLASS = { whisky: "amber", cognac: "amber", rum: "amber", liqueur: "amber", bitter: "red", gin: "clear", agave: "clear", vodka: "clear" };
const SP_PIC = ["Glenfiddich 12", "Hennessy VS", "Hendrick's"], SP_NEW = ["Maker's Mark", "Havana Club 7"];
DEMO_SPIRITS.forEach((w, i) => MENU.push(normSpirit({ ...w, pair: (w.pair || []).filter(Boolean),
  img: SP_PIC.includes(w.name) ? bottlePic({ name: w.name, color: SPIRIT_GLASS[w.cat] || "amber", vintage: w.age || "" }) : "",
  addedAt: SP_NEW.includes(w.name) ? Date.now() - 3 * 864e5 : 0 }, { id: "sp-demo-" + (i + 1), ai: w.ai || [] })));
// AI винной карты в демо — без нейросети: по словам названия угадываем стиль, честно помеченный «AI» (в приложении — api/wine-import.js)
const WINE_GUESS = [[/просекко|prosecco|шампан|champagne|кава|cava|брют|brut|игрист|франчакорт/i, "sparkling", ["шардоне"], ["яблоко", "бриошь", "цитрус"]],
  [/шабли|chablis|шардоне|chardonnay|мерсо/i, "white", ["шардоне"], ["яблоко", "мел", "лимон"]], [/альбариньо|albariño|albarino/i, "white", ["альбариньо"], ["персик", "морская соль", "цитрус"]],
  [/гави|gavi|кортезе/i, "white", ["кортезе"], ["груша", "миндаль", "цитрус"]], [/грюнер|grüner|gruner/i, "white", ["грюнер вельтлинер"], ["белый перец", "яблоко"]], [/рислинг|riesling/i, "white", ["рислинг"], ["персик", "лайм", "мёд"]],
  [/совиньон|sauvignon|сансер/i, "white", ["совиньон блан"], ["крыжовник", "трава", "цитрус"]], [/розе|rosé|rose|прованс/i, "rose", ["гренаш"], ["клубника", "грейпфрут"]],
  [/пино нуар|pinot noir|бургундия/i, "red", ["пино нуар"], ["вишня", "малина"]], [/кьянти|chianti|санджовезе/i, "red", ["санджовезе"], ["вишня", "пряности"]],
  [/бароло|barolo|неббиоло/i, "red", ["неббиоло"], ["роза", "смола", "вишня"]], [/риоха|rioja|темпранильо/i, "red", ["темпранильо"], ["ваниль", "слива"]],
  [/каберне|cabernet|бордо|bordeaux|мальбек|malbec|шираз|syrah/i, "red", ["каберне совиньон"], ["смородина", "кедр", "табак"]],
  [/москато|moscato|сотерн|токай|ледян/i, "dessert", ["москато"], ["абрикос", "мёд"]], [/портвейн|porto|херес|sherry|мадера/i, "fortified", ["тоурига насьонал"], ["изюм", "орех"]]];
const SHORT_BY = { sparkling: "Свежие пузырьки: к закускам и для начала вечера.", white: "Свежее белое: к рыбе и морепродуктам.", rose: "Лёгкое розовое: к салатам и закускам.",
  red: "Красное с мягкими танинами: к мясу и котлете.", dessert: "Сладкое: к десерту.", fortified: "Креплёное: к сыру и десерту." };
const guessWine = (name) => { const g = WINE_GUESS.find(([re]) => re.test(name)) || [null, "red", [], ["ягоды", "пряности"]];
  const year = (String(name).match(/\b(19|20)\d{2}\b/) || [""])[0];
  return { name, grapes: g[2], color: g[1], sweet: g[1] === "sparkling" ? "брют" : g[1] === "dessert" ? "сладкое" : "сухое", vintage: year, temp: TEMP_HINT[g[1]] || "", notes: g[3], short: SHORT_BY[g[1]] || "" }; };
const SHEET = [["Шампанское Brut Réserve", "Charles Heidsieck", "Франция", "Шампань", 0, 14500], ["Гави ди Гави", "La Scolca", "Италия", "Пьемонт", 820, 4600],
  ["Альбариньо", "Pazo Señorans", "Испания", "Риас-Байшас", 0, 5400], ["Риоха Резерва", "Muga", "Испания", "Риоха", 980, 5900], ["Бароло", "Pio Cesare", "Италия", "Пьемонт", 0, 12800],
  ["Мальбек", "Catena Zapata", "Аргентина", "Мендоса", 850, 4800]];
// v122: этикетка в демо — нейросети нет, бутылки «читаются» по очереди из этого списка. «Шабли» уже в карте без фото — фото
// добавится к нему; «Пино Нуар» уже с фото — не отмечено, отметишь — фото заменится
const LABELS = [["Гави ди Гави", "La Scolca", "Италия", "Пьемонт", "2022"], ["Шабли", "Domaine Laroche", "Франция", "Бургундия, Шабли", "2022"],
  ["Бароло", "Pio Cesare", "Италия", "Пьемонт", "2018"], ["Пино Нуар", "Louis Jadot", "Франция", "Бургундия", "2020"], ["Альбариньо", "Pazo Señorans", "Испания", "Риас-Байшас", "2022"],
  ["Риоха Резерва", "Muga", "Испания", "Риоха", "2018"]];
let labelN = 0;
// v127: AI крепкого в демо — тоже без нейросети: вид, страна и подача по словам названия (в приложении — api/wine-import.js, kind: "spirit")
const SPIRIT_GUESS = [
  [/mezcal|мескал/i, { cat: "agave", style: "мескаль", country: "Мексика", region: "Оахака", abv: 40, serve: ["чистым"], glass: "шот", notes: ["дым", "агава", "цитрус"] }],
  [/bourbon|бурбон|maker|jim beam|wild turkey|woodford|buffalo/i, { cat: "whisky", style: "бурбон", country: "США", region: "Кентукки", abv: 45, serve: ["чистым", "со льдом", "в коктейле"], glass: "рокс", notes: ["карамель", "ваниль", "дуб"] }],
  [/jameson|bushmills|irish|ирланд/i, { cat: "whisky", style: "купажированный", country: "Ирландия", abv: 40, serve: ["чистым", "со льдом"], glass: "рокс", notes: ["ваниль", "орех", "мёд"] }],
  [/glen|macallan|lagavulin|laphroaig|talisker|ardbeg|bowmore|aberfeldy|аберфелди|виски|whisk|скотч|scotch/i, { cat: "whisky", style: "односолодовый", country: "Шотландия", abv: 40, serve: ["чистым", "с каплей воды"], glass: "гленкерн", notes: ["мёд", "дуб", "сухофрукты"] }],
  [/hennessy|martell|courvoisier|remy|rémy|коньяк|cognac|арарат|ararat|бренди|brandy/i, { cat: "cognac", style: "VSOP", country: "Франция", region: "Коньяк", abv: 40, serve: ["чистым"], glass: "тюльпан", notes: ["ваниль", "дуб", "сухофрукты"] }],
  [/bacardi|havana|zacapa|captain|diplomatico|(^|\s)ром(\s|$)|(^|\s)rum(\s|$)/i, { cat: "rum", style: "выдержанный", country: "Куба", abv: 40, serve: ["чистым", "со льдом", "в коктейле"], glass: "рокс", notes: ["ваниль", "карамель", "тропические фрукты"] }],
  [/(^|\s)gin(\s|$)|джин|beefeater|bombay|tanqueray|hendrick|monkey/i, { cat: "gin", style: "London Dry", country: "Великобритания", abv: 40, serve: ["в коктейле"], glass: "хайбол", notes: ["можжевельник", "цитрус", "кориандр"] }],
  [/tequila|текил|patron|patrón|olmeca|cuervo|don julio/i, { cat: "agave", style: "бланко", country: "Мексика", region: "Халиско", abv: 38, serve: ["в коктейле", "чистым"], glass: "шот", notes: ["агава", "цитрус", "перец"] }],
  [/водк|vodka|beluga|белуг|absolut|grey goose|finlandia/i, { cat: "vodka", style: "классическая", country: "Россия", abv: 40, serve: ["охлаждённым"], glass: "шот", notes: ["злаки", "мягкость"] }],
  [/campari|кампари|aperol|апероль|angostura|ангостура|becherovka|бехеровка|биттер|bitter/i, { cat: "bitter", style: "аперитив", country: "Италия", abv: 25, serve: ["со льдом", "в коктейле"], glass: "рокс", notes: ["горький апельсин", "травы"] }],
];
const SP_SHORT = { whisky: "Виски с характером: чистым или с каплей воды.", cognac: "Ваниль и дуб: после ужина, чистым.", rum: "Мягкая сладость: чистым или со льдом.",
  gin: "Можжевельник и цитрус: в джин-тоник.", agave: "Агава и цитрус: в «Маргариту» или шотом.", vodka: "Чистая и мягкая: охлаждённой к закускам.", liqueur: "Сладкий ликёр: к кофе или десерту.",
  bitter: "Горечь и травы: аперитив перед ужином." };
const yearsWord = (n) => n + " " + (n % 10 === 1 && n % 100 !== 11 ? "год" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "года" : "лет");
// v134 (Доп. 447): «по названию» в демо знает дома и регионы нескольких марок; вид по названию не понять, а в карточке он
// вписан (known.cat), значит, держимся его (как сервер: что вписано, то факты)
const HOUSES = [[/aberfeldy|аберфелди/i, "Aberfeldy", "Хайленд", "односолодовый", ["мёд", "вереск", "ваниль"]],
  [/glenfiddich|гленфиддик/i, "William Grant & Sons", "Спейсайд", "односолодовый", ["груша", "мёд", "дуб"]],
  [/macallan|макаллан/i, "The Macallan", "Спейсайд", "односолодовый", ["херес", "сухофрукты", "пряности"]],
  [/talisker|талискер/i, "Talisker", "Остров Скай", "односолодовый", ["дым", "морская соль", "перец"]],
  [/jameson|джеймсон/i, "Jameson", "", "купажированный", ["ваниль", "орех", "мёд"]]];
const SP_STORY = { whisky: "Виски выдерживают в дубовых бочках: отсюда мёд, ваниль и сухофрукты. Гостю предложи чистым или с каплей воды: аромат раскроется.",
  cognac: "Коньяк делают из белого винограда и выдерживают в дубе. Подавай в тюльпане после ужина: тепло ладони раскрывает ваниль и сухофрукты.",
  rum: "Ром делают из сахарного тростника, выдержанный мягче и слаще. Предложи чистым или со льдом, к десерту или после ужина.",
  gin: "Джин настаивают на можжевельнике и травах. Лучше всего он раскрывается в джин-тонике с цедрой.",
  agave: "Текилу и мескаль делают из агавы. Бланко хороша в «Маргарите», выдержанную пьют медленно и чистой.",
  vodka: "Чистая и мягкая: подавай охлаждённой, к закускам и рыбе.", liqueur: "Сладкий ликёр: к кофе, к десерту или со льдом.",
  bitter: "Горький аперитив: со льдом и содовой перед ужином или в «Негрони»." };
const SP_BY_CAT = {};
for (const [, g] of SPIRIT_GUESS) if (!SP_BY_CAT[g.cat] || g.style === "односолодовый" || g.style === "бланко") SP_BY_CAT[g.cat] = g;
const guessSpirit = (name, known = null) => {
  const hit = SPIRIT_GUESS.find(([re]) => re.test(name)), kc = known && known.cat;
  const g = hit ? hit[1] : (kc && SP_BY_CAT[kc]) || { cat: "liqueur", style: "", country: "", abv: 30, serve: ["со льдом"], glass: "рокс", notes: ["сладость", "пряности"] };
  const h = HOUSES.find(([re]) => re.test(name)) || null;
  const y = Number((String(name).match(/(^|\s)(\d{1,2})(\s|$)/) || [])[2] || 0);
  return { name, ...g, ...(h ? { producer: h[1], region: h[2] || g.region || "", style: h[3], notes: h[4] } : {}), age: y ? yearsWord(y) : "", temp: TEMP_HINT_SP[g.cat] || "",
    short: SP_SHORT[g.cat] || "", story: SP_STORY[g.cat] || "" };
};
// этикетка: «Белуга Нобл» в карте без фото — фото добавится к ней; «Hennessy VS» уже с фото — не отмечено, отметишь — заменится
const SP_LABELS = [["Talisker 10", "Talisker", "Шотландия", "Острова", 45.8], ["Белуга Нобл", "Белуга", "Россия", "", 40], ["Hennessy VS", "Hennessy", "Франция", "Коньяк", 40],
  ["Jameson", "Jameson", "Ирландия", "", 40]];
let spLabelN = 0;
const SP_SHEET = [["Talisker 10", "Talisker", 720, 11900], ["Jameson", "Jameson", 450, 5900], ["Courvoisier VSOP", "Courvoisier", 980, 14500], ["Bacardi Carta Blanca", "Bacardi", 350, 3900],
  ["Beefeater London Dry", "Beefeater", 380, 4300], ["Aperol", "Aperol", 350, 2900]];
const demoSpiritAi = (b) => {
  if (b.mode === "fill") return { wines: [guessSpirit(String(b.name || ""), b.known || null)] };   // v134: и что уже вписано
  if (b.mode === "label") { const [name, producer, country, region, abv] = SP_LABELS[spLabelN++ % SP_LABELS.length]; return { wines: [{ ...guessSpirit(name), producer, country, region, abv, portion: "", pricePortion: "", priceBottle: "" }] }; }
  if (b.mode === "names") return { wines: (b.names || []).slice(0, 15).map((n) => guessSpirit(String(n))) };
  // фото страницы или PDF: в демо — одна и та же «страница» из шести позиций
  return { wines: SP_SHEET.map(([name, producer, pp, bt]) => ({ ...guessSpirit(name), producer, portion: 40, pricePortion: pp, priceBottle: bt, notes: [], short: "", story: "" })) };
};
// v132 (Доп. 445): «Вкус по шкалам» через ИИ в демо — по цвету вина и виду крепкого
const TASTE_BY = { red: [3, 3, 3, 1, 2], white: [2, 4, 1, 1, 1], sparkling: [1, 4, 1, 2, 1], rose: [2, 3, 1, 1, 1], orange: [3, 3, 2, 1, 1], dessert: [3, 3, 1, 5, 1], fortified: [4, 3, 2, 4, 3],
  whisky: [4, 2, 2, 4, 2], cognac: [4, 3, 1, 4, 2], rum: [3, 4, 1, 3, 3], gin: [2, 1, 1, 1, 4], agave: [3, 1, 2, 1, 3], vodka: [1, 1, 1, 1, 1], liqueur: [3, 5, 1, 1, 2], bitter: [2, 3, 1, 1, 4], other: [3, 2, 1, 2, 2] };
const demoTaste = (b) => {
  const sp = b.kind === "spirit", keys = sp ? ["body", "sweet", "smoke", "oak", "spice"] : ["body", "acid", "tannin", "sweet", "oak"];
  return { tastes: (b.items || []).slice(0, 25).map((x, i) => { const v = TASTE_BY[sp ? x.cat : x.color] || [3, 3, 2, 1, 2];
    const t = Object.fromEntries(keys.map((k, j) => [k, v[j]])); if (sp && /торф|айла|islay/i.test([x.style, x.region, x.name].join(" "))) t.smoke = 5; if (!sp && /полусух|полуслад/.test(x.sweet || "")) t.sweet = 3; return { i, ...t }; }) };
};
// v151 (Доп. 475): «Дописать пустое» в демо — без нейросети: те же догадки по названию (у вин ещё крепость и рассказ по цвету);
// в ответе только то, чего не хватало, с номером позиции (как сервер, api/wine-import.js: gapsPick). Название, по которому
// догадки нет (своя настойка), — без полей: «AI не нашёл, что дописать»
const ABV_BY = { sparkling: 12, white: 12.5, rose: 12.5, orange: 12.5, red: 13.5, dessert: 5.5, fortified: 19 };
const STORY_BY = { sparkling: "Игристое со вторичным брожением: пузырьки, свежесть, тонкая кислотность. Предложи для начала вечера и к закускам.",
  white: "Свежее белое: ведут фрукты и кислотность. Хорошо к рыбе, морепродуктам и салатам.", rose: "Сухое розовое: лёгкое, с ягодами и цитрусом. Летний выбор к закускам.",
  orange: "Оранжевое вино: белый виноград, настоянный на кожице. Плотнее белого, с лёгкой терпкостью.", red: "Красное со спелой ягодой и мягкими танинами. Предложи к мясу и выдержанным сырам.",
  dessert: "Сладкое и ароматное: к десерту и фруктам. Подавай охлаждённым, небольшой порцией.", fortified: "Креплёное: крепче обычного вина, с сухофруктами и орехом. К сыру, десерту или после ужина." };
const demoGaps = (b) => {
  const sp = b.kind === "spirit";
  return { wines: (Array.isArray(b.items) ? b.items : []).slice(0, 6).map((x, i) => {
    const name = String((x && x.name) || ""), known = (x && x.known) || {}, out = { i, name };
    const knows = sp ? SPIRIT_GUESS.some(([re]) => re.test(name)) || HOUSES.some(([re]) => re.test(name)) || !!known.cat : WINE_GUESS.some(([re]) => re.test(name)) || !!known.color;
    if (!knows) return out;
    let g;
    if (sp) g = guessSpirit(name, known);
    else { const w = guessWine(name), color = known.color || w.color; g = { ...w, color, abv: ABV_BY[color] || 13, story: STORY_BY[color] || "" }; }
    for (const f of (x && x.missing) || []) { const v = g[f]; if (Array.isArray(v) ? v.length : v !== "" && v != null && v !== false) out[f] = v; }
    return out;
  }) };
};
// v152 (Доп. 476): «Поискать в интернете» в демо — интернета нет: что «нашлось» бы, лежит здесь, ссылки — на example.com
// (честно: страница-пример). Своя настойка не находится нигде — как и было бы на самом деле
const WEB_DEMO = [[/кальвадос|calvados|drouin/i, { cat: "other", style: "кальвадос", country: "Франция", region: "Нормандия, Пеи д’Ож", abv: 40, serve: ["чистым"], glass: "тюльпан",
  temp: "комнатная", notes: ["печёное яблоко", "груша", "дуб"], short: "Яблочный бренди Нормандии: печёное яблоко и дуб, после ужина.",
  story: "Кальвадос перегоняют из сидра и выдерживают в дубе. Pays d’Auge — самая строгая апелласьон: двойная перегонка в кубе. Подавай в тюльпане, комнатной температуры.",
  src: [{ url: "https://example.com/demo/calvados-pays-d-auge", title: "Страница-пример (демо): кальвадос Pays d’Auge" }] }]];
const demoWebGaps = (b) => ({ wines: (Array.isArray(b.items) ? b.items : []).slice(0, 2).map((x, i) => {
  const name = String((x && x.name) || ""), out = { i, name }, hit = WEB_DEMO.find(([re]) => re.test(name));
  if (!hit) return out;
  for (const f of (x && x.missing) || []) if (hit[1][f] != null) out[f] = hit[1][f];
  out.src = hit[1].src;
  return out;
}) });
// v152: ассистент с интернетом в демо: «Château Margaux» — ответ как из интернета (ссылки — страницы-примеры), проверка
// ответа — «сходится»; остальное — честно: в демо интернета нет
const demoWebAnswer = (b) => {
  const q = String(b.question || ""), src = (t, u) => [{ url: "https://example.com/demo/" + u, title: "Страница-пример (демо): " + t }];
  if (b.check) return { ok: true, reply: "Проверил: в ответе всё сходится с тем, что пишут производитель и справочники. Добавлю одно: подавать при 16–18 °C, в бокале «бордо».", sources: src("проверка ответа", "check"), searched: 1 };
  // v155 (Доп. 479): продукт не из меню — «что за рыба такая Чавыча?»; «а подробнее?» / «найди в сети» — тема из прошлых реплик
  const hist = (Array.isArray(b.history) ? b.history : []).map((m) => String((m && m.content) || "")).join(" ");
  if (/чавыч/i.test(q)) return { ok: true, reply: "Чавыча — самый крупный из тихоокеанских лососей, в Америке её зовут «королевским лососем». Ловят у Камчатки и Аляски. Мясо оранжево-красное и самое жирное среди тихоокеанских лососей: нежное, сочное, с мягким сливочным вкусом. Гостю: «король тихоокеанских лососей — очень нежная дикая рыба».", sources: src("чавыча", "chinook-salmon"), searched: 1 };
  if (/подробн|сет[иь]|интернет/i.test(q) && /чавыч/i.test(hist)) return { ok: true, reply: "Подробнее о чавыче: на нерест она идёт первой из лососей — в реки Камчатки в начале лета, поэтому свежая чавыча бывает коротким сезоном. Из-за жирности мясо не пересыхает: хорошо стейком на гриле и запечённой. Гостю можно сказать: «дикая камчатская рыба короткого сезона, самая сочная из лососей».", sources: src("чавыча: сезон и кухня", "chinook-season"), searched: 1 };
  if (/margaux|марго/i.test(q)) return { ok: true, reply: "Château Margaux — первое гран крю (Premier Grand Cru Classé) Медока по классификации 1855 года, апелласьон Марго, Бордо. В основе — каберне совиньон с мерло: кассис, фиалка, кедр, шелковистые танины. Гостю: «одно из пяти великих вин Бордо». В нашей карте его нет — предложи похожее из карты.", sources: src("Château Margaux", "chateau-margaux"), searched: 1 };
  return { ok: true, reply: "В демо интернета нет. В приложении я поищу ответ на сайтах производителей и в справочниках и покажу ссылки.", sources: [], searched: 0 };
};
// v153 (Доп. 477): «Пять вариантов описания» в демо — по углам нажатия (lib/dish-desc.js), из названия и состава блюда;
// ссылка — страница-пример. В приложении модель ищет идеи в интернете и пишет сама.
const DESC_DEMO = {   // только именительный падеж для {a} и {b}: состав в демо — любые слова
  taste: ["«{n}»: {a} — для глубины, {b} — для свежести, и вкус раскрывается с каждым кусочком.", "Первое впечатление — {a}, послевкусие — {b}: вкус собранный и очень цельный."],
  origin: ["Такие блюда родом из домашней кухни: их готовят неспешно, чтобы раскрылся вкус каждого ингредиента. Мы держим этот принцип.", "Рецепт простой и честный, как в домашней кухне: главное — не торопиться, а {a} здесь в главной роли."],
  play: ["«{n}» — тот случай, когда второй заказ хочется сделать ещё до того, как закончился первый.", "Осторожно: после «{n}» другие блюда раздела кажутся немного скучными."],
  doubt: ["Если гость сомневается — смело советуйте «{n}»: понятное, тёплое и сытное, а {a} — его изюминка.", "Беспроигрышный выбор: «{n}» нравится и тем, кто пробует впервые, и тем, кто заказывает его каждый раз."],
  star: ["Главное здесь — {a}, всё остальное только подчёркивает этот вкус.", "Сердце блюда — {a}: именно за этот вкус «{n}» заказывают снова."],
  craft: ["Готовим «{n}» под заказ: {a} и {b} — на тарелке за минуты до подачи, поэтому вкус яркий и свежий.", "Собираем «{n}» прямо перед подачей, чтобы всё было свежим: {b} — в последний момент."],
  mood: ["Это блюдо для прохладного вечера или после долгого дня: тёплое, спокойное и очень уютное.", "«{n}» хорошо заходит в компании: его приятно обсуждать и делить на двоих."],
  simple: ["Если коротко: {a}, {b} и немного терпения на кухне — просто, понятно и очень вкусно.", "Простыми словами: {a}, {b} и точная подача — блюдо, которое хочется доесть до конца."],
  gourmet: ["Обратите внимание на послевкусие: к концу тарелки появляются новые, более глубокие оттенки.", "Для ценителей: {b} здесь не украшение, а противовес — освежает и держит баланс."],
  fact: ["Интересно: в «{n}» каждый ингредиент добавляют в свой момент — поэтому вкус собирается слоями.", "Мало кто знает, но порядок, в котором добавляют ингредиенты, меняет вкус сильнее, чем специи."],
};
const demoDesc = (b) => {
  const d = b.dish || {}, n = String(d.name || "блюдо").trim(), ing = (Array.isArray(d.ingredients) ? d.ingredients : [])
    .map((x) => String(x).replace(/\s*\(.*$/, "").replace(/[()]/g, "").trim().toLowerCase()).filter(Boolean);   // «паштет (осьминог» → «паштет»
  const a = ing[0] || "главный ингредиент", c = ing[1] || "зелень", round = Math.max(0, Math.floor(Number(b.round) || 0)), k = Math.floor(round / 2) % 2;
  const variants = descAngles(round).map(([angle, label]) => ({ angle, label, text: DESC_DEMO[angle][k].replace(/\{n\}/g, n).replace(/\{a\}/g, a).replace(/\{b\}/g, c) }));
  return { ok: true, variants, sources: [{ url: "https://example.com/demo/dish-ideas", title: "Страница-пример (демо): идеи для описания блюд" }], searched: 1 };
};
const demoWineAi = (b) => {
  if (b.via === "web-answer") return b.mode === "desc" ? demoDesc(b) : demoWebAnswer(b);   // v155: запасной путь поиска, как в api/wine-import.js
  if (b.mode === "taste") return demoTaste(b);   // v132
  if (b.mode === "gaps" && b.web) return demoWebGaps(b);   // v152
  if (b.mode === "gaps") return demoGaps(b);   // v151
  if (b.kind === "spirit") return demoSpiritAi(b);   // v127
  if (b.mode === "fill") return { wines: [guessWine(String(b.name || ""))] };
  if (b.mode === "label") { const [name, producer, country, region, vintage] = LABELS[labelN++ % LABELS.length]; return { wines: [{ ...guessWine(name), producer, country, region, vintage }] }; }
  if (b.mode === "names") return { wines: (b.names || []).slice(0, 15).map((n) => guessWine(String(n))) };
  // фото страницы или PDF: в демо — одна и та же «страница» из шести вин
  return { wines: SHEET.map(([name, producer, country, region, g, bt]) => ({ ...guessWine(name), producer, country, region, byGlass: !!g, priceGlass: g || "", priceBottle: bt })) };
};
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
// v136 (Доп. 449): «Барная карта» удобнее и красивее. Руководитель отметил «★ Советуем первым» вино, крепкое и коктейль
// (та же отметка, что «☆ Первым» в «Сомелье»); «Совиньон блан» сегодня закончился: в карточке «Предложи вместо» похожие из карты
MENU.push({ id: "__somrules__", kind: "somrules", text: "", prio: ["wine:wn-demo-6", "spirit:sp-demo-1", "cocktail:negroni"], by: "Мария Ким", at: Date.now() - 2 * 864e5 });
MENU.filter((d) => d && d.id === "wn-demo-3").forEach((d) => Object.assign(d, { stop: { since: Date.now() - 2 * 3600e3, by: "Мария Ким" }, stopAt: Date.now() - 2 * 3600e3 }));

// ── кто я: Анна, Мария или Роман; «Новый телефон» — Анна без входа, приложение открыто «в Telegram» ──
// v146 (Доп. 467): в «песочнице» (страница Claude без своей памяти) localStorage — память страницы и после перезагрузки
// пуст: кого выбрали в строке демо, помнит и адрес (#maria, #roman, #ksenia)
const hashWho = (() => { try { const h = String(location.hash || "").slice(1); return /^(anna|maria|roman|ksenia)$/.test(h) ? h : null; } catch (e) { return null; } })();
const whoKey = lsGet(K_WHO) || hashWho;
const who = ME[whoKey] ? whoKey : "anna";
const me = PEOPLE.find((p) => p.id === ME[who]);
const newPhone = lsGet(K_NEW) === "1";

// ── v137 (Доп. 450): уведомления на телефон. Демо — как академия на экране «Домой» iPhone: разрешение спрашивает окно, как
// у iPhone, подписка живёт на этом «телефоне» (до смены человека), уведомление — баннером сверху, касание открывает экран
// (событие sa-go, как у сервис-воркера). «Новый телефон» — в Telegram: там уведомления не включаются, пишет бот.
const K_PUSH = "__demo_push";
const pushSt = (() => { try { return JSON.parse(lsGet(K_PUSH) || "null") || {}; } catch (e) { return {}; } })();
const pushSave = () => lsSet(K_PUSH, JSON.stringify(pushSt));
const DEMO_P256 = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", DEMO_AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
const mkSub = (ep) => ({ endpoint: ep, options: { applicationServerKey: null },
  toJSON: () => ({ endpoint: ep, keys: { p256dh: DEMO_P256, auth: DEMO_AUTH } }),
  unsubscribe: async () => { pushSt.sub = null; pushSave(); return true; } });
function pushAsk() {
  return new Promise((res) => {
    const old = document.getElementById("demo-perm"); if (old) old.remove();
    const v = document.createElement("div"); v.id = "demo-perm";
    v.innerHTML = '<div class="box" role="alertdialog" aria-label="Разрешение на уведомления"><b>«Service Academy» хочет присылать уведомления</b>' +
      '<p>В уведомлениях бывают оповещения, звуки и число на значке. Их можно настроить в «Настройках».</p>' +
      '<div class="row"><button type="button" data-demo-perm="no">Не разрешать</button><button type="button" data-demo-perm="yes">Разрешить</button></div></div>';
    v.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { v.remove(); res(b.getAttribute("data-demo-perm") === "yes"); }));
    document.body.appendChild(v);
  });
}
window.__saPushShim = {
  get env() { return newPhone ? "telegram" : pushSt.perm === "denied" ? "denied" : pushSt.perm === "granted" ? "granted" : "ok"; },
  get permission() { return pushSt.perm || "default"; },
  reg: { pushManager: {
    getSubscription: async () => (pushSt.sub ? mkSub(pushSt.sub) : null),
    subscribe: async () => {
      if (pushSt.perm !== "granted") {
        const yes = pushSt.perm === "denied" ? false : await pushAsk();
        pushSt.perm = yes ? "granted" : "denied"; pushSave();
        if (!yes) { const e = new Error("Нет разрешения"); e.name = "NotAllowedError"; throw e; }
      }
      if (!pushSt.sub) { pushSt.sub = "https://web.push.apple.com/demo-" + me.id + "-" + Date.now().toString(36); pushSave(); }
      return mkSub(pushSt.sub);
    },
  } },
};
// уведомление на телефоне: баннер сверху, касание — экран из уведомления. v137 (Доп. 451): на Android под ним кнопки
// («Ответить» — поле прямо в уведомлении, «Прочитано», «Принято», «Забрать», «Иду»; нажатие — как функция push-send:
// srv.pushAct), ответ — коротко в том же баннере. iPhone кнопок не показывает — и демо на iPhone тоже (__demo_android —
// вид Android для снимков проверки).
const isAndroid = () => /Android/i.test(navigator.userAgent || "") || lsGet("__demo_android") === "1";
const goApp = (go) => { try { window.dispatchEvent(new CustomEvent("sa-go", { detail: { go: go || "" } })); } catch (e) {} };
function pushBanner(n) {
  const old = document.getElementById("demo-push"); if (old) old.remove();
  const v = document.createElement("div"); v.id = "demo-push"; v.setAttribute("role", "status"); v.setAttribute("data-demo-push", n.go || "");
  v.innerHTML = '<img alt="" src="icons/icon-192.png"><div class="c"><div class="h"><span>SERVICE ACADEMY</span><i>сейчас</i></div><b></b><div class="t"></div></div>';
  v.querySelector("b").textContent = n.t || "";
  v.querySelector(".t").textContent = n.b || "";
  if (!n.b) v.querySelector(".t").remove();
  let timer = setTimeout(() => v.remove(), 8000);
  v.addEventListener("click", () => { clearTimeout(timer); v.remove(); goApp(n.go); });
  if (isAndroid() && Array.isArray(n.a) && n.a.length && n.k) {
    const c = v.querySelector(".c"), row = document.createElement("div"); row.className = "a";
    const done = (r) => {
      save();
      if (!r || !r.ok) { v.remove(); goApp(n.go); return; }   // не вышло — открыть приложение на этом месте
      if (!r.text) { v.remove(); return; }                     // «Прочитано» — тихо
      c.querySelector("b").textContent = r.text;
      for (const x of c.querySelectorAll(".t, .a, .r")) x.remove();
      v.setAttribute("data-demo-push-done", "");
      timer = setTimeout(() => v.remove(), 2400);
    };
    const reply = () => {
      row.remove();
      const f = document.createElement("div"); f.className = "r";
      f.innerHTML = '<input type="text" data-demo-push-reply="" placeholder="Ответ…" maxlength="1000"><button type="button" data-demo-push-send="" aria-label="Отправить">➤</button>';
      f.addEventListener("click", (e) => e.stopPropagation());
      const inp = f.querySelector("input");
      const send = () => { const r = srv.pushAct(n.k, "reply", inp.value); if (r && !r.ok && r.error === "empty") { v.remove(); goApp(n.go); return; } done(r); };
      f.querySelector("button").addEventListener("click", send);
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
      c.appendChild(f);
      setTimeout(() => { try { inp.focus(); } catch (e) {} }, 30);
    };
    for (const x of n.a) {
      const btn = document.createElement("button"); btn.type = "button"; btn.textContent = x.t; btn.setAttribute("data-demo-push-act", x.a);
      btn.addEventListener("click", (e) => { e.stopPropagation(); clearTimeout(timer); if (x.a === "reply") reply(); else done(srv.pushAct(n.k, x.a)); });
      row.appendChild(btn);
    }
    c.appendChild(row);
  }
  document.body.appendChild(v);
}

// ── состояние сервера: в localStorage, чтобы пережить смену человека и перезагрузку ──
let saved = null, seeding = false;
try { saved = lsGet(K_DAY) === TODAY ? JSON.parse(lsGet(K_SRV) || "null") : null; } catch (e) { saved = null; }
// пройденное: Анна и Мария не новички (инструменты открыты), коллеги — для заданий «кто прошёл»
const DONE = ["s0-1", "s0-2", "s0-3", "s0-4", "s1-1", "s1-2"];
// v132: журнал Сомелье — за последние недели гости брали Рислинг к кальмару и Шабли к закуске из морепродуктов
const SOM_SEED = [];
for (let i = 0; i < 9; i++) SOM_SEED.push({ rest: R0, emp: i % 2 ? "e-petr" : "e-anna", ev: "run", item: "", dishes: [], ask: "", t: Date.now() - (i + 1) * 2 * 864e5 });
for (let i = 0; i < 3; i++) SOM_SEED.push({ rest: R0, emp: "e-anna", ev: "taken", item: "wine:wn-demo-4", dishes: [dish("Кальмар в азиатском стиле")].filter(Boolean), ask: "", t: Date.now() - (i + 2) * 3 * 864e5 });
for (let i = 0; i < 2; i++) SOM_SEED.push({ rest: R0, emp: "e-petr", ev: "taken", item: "wine:wn-demo-2", dishes: [dish("Закуска из морепродуктов")].filter(Boolean), ask: "", t: Date.now() - (i + 3) * 4 * 864e5 });
SOM_SEED.push({ rest: R0, emp: "e-petr", ev: "declined", item: "wine:wn-demo-7", dishes: [], ask: "", t: Date.now() - 5 * 864e5 });
const srv = makeServer({ today: TODAY, rest: R0, people: PEOPLE, tok: TOK, sstaff: SSTAFF, cfg: CFG, plan: planOf(), menu: MENU, state: saved, som: SOM_SEED,
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
  concept: CONCEPT_SEED, conceptPhotos: CONCEPT_PHOTOS, lessonPhotos: LESSON_PHOTOS,   // v139 (Доп. 454): «О нас» — сеть, «Океан» и сосед «Порт»
  pushSubs: ["e-petr", "e-olga", "e-vera"],   // v137: уведомления на телефоне уже включили Пётр, Ольга (без Telegram) и Вера
  // v125 (Доп. 438): тренировка по винам у команды (этап 44): Анна выучила новые вина («Совиньон Блан» и «Москато»), Вера
  // их учит, Илья выучил одно, Пётр учит карту, новые не открывал; остальные пока не занимались (смещения дней от сейчас)
  wineProg: {
    "e-anna": { passed: ["wn-demo-3", "wn-demo-8"], passedAt: -1, opened: ["wn-demo-3", "wn-demo-8"], openedAt: -2, known: 6, total: 7, glassKnown: 5, glassTotal: 5, statsAt: -1, quizRight: 9, quizOf: 10, quizAt: -1 },
    "e-vera": { opened: ["wn-demo-3", "wn-demo-8"], openedAt: 0, known: 2, total: 7, glassKnown: 2, glassTotal: 5, statsAt: 0 },
    "e-ilya": { passed: ["wn-demo-3"], passedAt: -2, opened: ["wn-demo-3"], openedAt: -2, known: 3, total: 7, glassKnown: 3, glassTotal: 5, statsAt: -2, quizRight: 6, quizOf: 10, quizAt: -3 },
    "e-petr": { known: 1, total: 7, glassKnown: 1, glassTotal: 5, statsAt: -3 },
  },
  // v127 (Доп. 440): тренировка по крепкому (этап 45): Илья (бармен) выучил новинки («Maker's Mark» и «Havana Club 7»), Анна
  // их учит, Вера учит карту, новинки не открывала; остальные пока не занимались
  spiritProg: {
    "e-ilya": { passed: ["sp-demo-3", "sp-demo-5"], passedAt: -1, opened: ["sp-demo-3", "sp-demo-5"], openedAt: -2, known: 8, total: 9, glassKnown: 5, glassTotal: 5, statsAt: -1, quizRight: 10, quizOf: 10, quizAt: -1 },
    "e-anna": { opened: ["sp-demo-3", "sp-demo-5"], openedAt: -1, known: 3, total: 9, glassKnown: 3, glassTotal: 5, statsAt: -1 },
    "e-vera": { known: 1, total: 9, glassKnown: 1, glassTotal: 5, statsAt: -2 },
  },
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
  // v137: уведомление на телефон — мне баннером сверху (как у iPhone), чуть раньше сообщения Telegram
  push: (to, n) => { if (to === me.id && !seeding) setTimeout(() => pushBanner(n), 350); },
  // бот пишет в Telegram: мне — уведомлением сверху, остальным — никак (их телефонов в демо нет)
  ping: (to, text, acts, chat, msg, o) => { if (to !== me.id || seeding) return;
    if (o && o.kind === "morning") setTimeout(() => tgChat(text, o.kb, nowHM()), 400);
    else if (o && o.kind === "gain") setTimeout(() => tgChat(text, o.kb, nowHM(), { note: "Так 1-го числа в 10:00 приходит итог прошлого месяца. Кнопка открывает его в приложении." }), 400);   // v109
    else setTimeout(() => tgToast(text, acts, chat), 500); } });
// v141 (Доп. 458): вчерашний брифинг Марии с гоу-листом (салат с крабом и «Негрони»), итог ещё не записан: «Как вчера» в
// брифинге, «Гоу-лист: итог не записан» в «Утре руководителя». Демо, открытое сегодня до этой сборки, получает его один раз
if (!srv.S.goSeeded) {
  srv.S.goSeeded = 1;
  const yd = srv.D(-1), was = srv.S.briefDays[yd] || {};
  if (!was.data) srv.S.briefDays[yd] = { ...was, reads: was.reads || [], author: "Мария Ким", go_sold: null, go_at: null, go_by: null,
    data: { v: 1, day: yd, restaurant: R0, author: "Мария Ким", on: { go: true }, blocks: { go: [
      { id: dish("Салат с крабом"), name: "Салат с крабом и страчателлой", kind: "dish", why: "Краб-стригун и домашняя страчателла", pair: "С бокалом совиньон блан", say: "Сегодня советую салат с крабом: страчателлу делаем сами" },
      { id: "negroni", name: "Негрони", kind: "cocktail", why: "Три равные части, горьковатый и честный", pair: "К закускам из морепродуктов", say: "Аперитив, который открыл сто лет назад итальянский граф" }] } } };
}
// v127: демо, открытое сегодня ещё до этой сборки, — крепкое приходит в меню команды один раз (дальше — как правил руководитель)
if (!srv.S.spiritSeeded) { srv.S.spiritSeeded = 1; if (Array.isArray(srv.S.menu) && !srv.S.menu.some((d) => d && d.kind === "spirit")) srv.S.menu.push(...MENU.filter((d) => d && d.kind === "spirit")); }
const save = () => { lsSet(K_SRV, JSON.stringify(srv.S)); lsSet(K_DAY, TODAY); };
const D = srv.D;
// приложение только что открыли: сейчас я ни в одном чате (бот пишет мне в Telegram, как в жизни)
for (const k of Object.keys(srv.S.seen || {})) if (k.endsWith("|" + me.id)) delete srv.S.seen[k];

// ── утро в заведении: что уже есть в чате, когда демо открывают впервые (это было утром — бот об этом сейчас не пишет) ──
if (!saved) {
  seeding = true;
  srv.bot.say("u-maria", "Доброе утро! Сегодня банкет на 12 человек в 19:00 на веранде. Зал готовим к 18:30.");
  srv.bot.offer("e-vera", D(2), "give", "Нужно к врачу, выручите");
  srv.bot.need("u-maria", D(6), "waiter", "В", 1);
  srv.bot.offer("e-petr", D(9), "swap", "Поменяюсь на любой день");
  srv.bot.say("e-ilya", "На баре закончился тоник, до обеда привезут. Пока предлагаем содовую.");
  srv.bot.say("e-olga", "Бронь на 20:00 перенесли на 20:30, стол 7.");
  save();
  seeding = false;
}

// ── то, что приложение ждёт на устройстве: вход, подсказки уже показаны ──
function seed() {
  const uk = "_" + me.name + "_" + me.surname;
  const keep = new Set([K_SRV, K_WHO, K_DAY, K_T, LOOK_KEY]);
  try { Object.keys(localStorage).forEach((k) => { if (!keep.has(k)) localStorage.removeItem(k); }); } catch (e) {}
  for (const k of Object.keys(pushSt)) delete pushSt[k];   // v137: другой человек — телефон без разрешения и подписки
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
  // v129 (Доп. 442): подсказку первого входа в «Барную карту» в демо видно (остальные отмечены прочитанными)
  for (const k of Object.keys(HINTS)) if (k !== "barCard") s["sa_hint_v" + HINTS_VERSION + "_" + k] = "1";
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

// ── v121: AI-интервью в демо без нейросети — пять тем по одному вопросу (план, как у ai-hr v2), в конце — демо-оценка.
// Владелец смотрит ряд ответа: поле, микрофон и волну «Отвечать голосом» (Доп. 434)
const HR_TOPICS = ["Сервис и гость", "Конфликты и сложные ситуации", "Приоритеты и организация", "Честность и деньги", "Команда"];
const HR_Q = [
  "Здравствуйте! Давайте просто пообщаемся: я расскажу пару рабочих ситуаций, а вы поделитесь, как бы поступили. Заготовленных правильных ответов не нужно. Представьте: гость долго сидит над меню и говорит: «Даже не знаю, всё какое-то непонятное». Что вы сделаете?",
  "Гость недоволен: горячее остыло, он повышает голос на весь зал. Как поступите?",
  "Пришли новые гости, на раздаче остывает горячее, третий стол просит счёт. В каком порядке?",
  "В счёт не попало одно блюдо, а гость уже ушёл. Ваши действия?",
  "У коллеги «горит» зона, у вас спокойно. Что сделаете?",
];
function demoHr(b) {
  if (b.mode === "assess") return { ok: true, v: 2, model: "demo", category: "Рекомендован",
    scores: Object.fromEntries(HR_TOPICS.map((t, i) => [t, [82, 74, 70, 88, 76][i]])),
    verdict: "Это демо: в приложении оценку пишет ИИ по ответам кандидата, решение всегда за менеджером.",
    strengths: ["Думает о госте"], growth: ["Приоритеты в запаре"], risks: [], ask: ["Как поступите, если коллега отказывается от помощи?"], uncertain: [] };
  const plan = Array.isArray(b.plan) ? b.plan : [];
  const R = (reply, topic, done) => ({ ok: true, v: 2, model: "demo", reply, topic, followup: false, done, topics: HR_TOPICS, total: HR_TOPICS.length });
  const last = plan[plan.length - 1];
  if (!last) return R(HR_Q[0], 0, false);
  if (last.topic < 0 || last.topic >= HR_TOPICS.length - 1) return R("Спасибо за разговор! Это демо: в приложении интервью ведёт ИИ, оценку менеджер видит сразу после «Завершить».", -1, true);
  return R(HR_Q[last.topic + 1], last.topic + 1, false);
}

// ── сервер вместо Supabase: те же адреса, ответы из памяти ──
const AI_REPLY = "Это демо: Наставник здесь не подключён к ИИ. В приложении он отвечает по меню, стандартам и урокам вашего заведения.";
// v142 (Доп. 461): вопрос про приёмку и хранение — приложение добавило к нему стандарт холдинга («[Стандарт холдинга, приём и
// хранение: …]»); в демо без нейросети Наставник отвечает по этому стандарту готовым ответом под тему вопроса
function demoRcv(q) {
  const t = q.toLowerCase().split("\n\n[")[0];
  const tail = "\n\nПодробно: тема «Приём и хранение» в уроках бара и менеджера.";
  if (/марк/.test(t)) return "По стандарту холдинга бутылку без марки или с повреждённой маркой не принимаем ни в каком виде. В ЕГАИС отвечаем «принято с расхождениями» и составляем акт с экспедитором, подписываете оба. Ответ на ТТН отправляем в день поставки." + tail;
  if (/кег/.test(t)) return "Кегу не подключаем, пока не отсканировали её код. Подключение отмечаем в «Честном знаке» не позднее следующего рабочего дня, а разливное продаём через кассу: в чеке кега и объём порции." + tail;
  if (/вскрыт|открыт|стикер|хран/.test(t)) return "Вскрытую бутылку храним со стикером: дата и время вскрытия, «годен до», подпись. Тихое вино живёт 3 суток с вакуумной пробкой в холодильнике, игристое 1 сутки, креплёное 14. Хранить алкоголь можно только по адресу из лицензии." + tail;
  if (/спис|бой|разбил/.test(t)) return "Бой, порчу и алкоголь для коктейлей списываем актом в ЕГАИС не позднее следующего рабочего дня. Маркированную воду, сок или молоко для бара выводим из оборота в «Честном знаке» за 3 рабочих дня." + tail;
  return "По стандарту холдинга: поставку пересчитываем и сканируем марку каждой бутылки до подписи, на ТТН отвечаем в день поставки, УПД подписываем после пересчёта и проверки кодов, алкоголь храним только по адресу из лицензии." + tail;
}
// v143 (Доп. 463): Наставник об инвентаре и оборудовании бара — в демо без нейросети, по стандарту холдинга
function demoEqp(q) {
  const t = q.toLowerCase().split("\n\n[")[0];
  const tail = "\n\nПодробно: тема «Инвентарь и оборудование бара» в уроках бара и менеджера.";
  if (/бокал|стекл|скол|осколк/.test(t)) return "Если стекло разбилось рядом со льдом, останавливаем работу с этим льдом и весь лёд утилизируем, даже если осколков не видно. Осколки собираем щёткой и совком, мелкие влажной салфеткой, ёмкость моем, смотрим на свет и дезинфицируем. Бокал со сколом сразу в утиль, горячий бокал из мойки в лёд не ставим." + tail;
  if (/баллон|co2|со2|углекисл|редуктор/.test(t)) return "Баллон CO2 меняет только обученный сотрудник: закрыть вентиль пустого, снять редуктор, проверить прокладку, подключить новый и медленно открыть вентиль. Соединения проверяем мыльным раствором: пузыри значат утечку. Одышка или головокружение у баллонов: сразу выйти и вывести всех, к вентилю не идти, проветрить и сообщить администратору." + tail;
  if (/слома|поломк|не работает|искрит|ремонт|неисправ/.test(t)) return "Неисправное оборудование отключаем, вешаем табличку «Не работает» и сообщаем администратору. Администратор в ту же смену ставит задачу в Битрикс24: что сломалось, когда, фото. Сами не ремонтируем и не снимаем защитные панели." + tail;
  if (/кофемашин|кофемолк|трубк|холдер/.test(t)) return "Группы кофемашины промываем с моющим средством, холдеры и сетки чистим в конце каждой смены. Паровую трубку протираем и продуваем после каждого вспенивания, бункер и жернова кофемолки чистим раз в неделю. Накипь и фильтр воды по инструкции производителя." + tail;
  return "По стандарту холдинга: лёд только совком, совок вне льда, в бункере ничего не храним. Стаканомойка: температура в начале смены, режим с дезинфекцией в конце дня. Льдогенератор: бункер не реже раза в месяц, пивные линии не реже раза в 14 дней и при смене сорта, температура холодильников в журнал каждый день." + tail;
}
// v141 (Доп. 458): «Подсказать фразы» в гоу-листе — в демо без нейросети: три строки по тому, что пришло из карточки
function demoGoLines(q) {
  const m = /: (блюдо|коктейль|вино|крепкое|позиция) «([^»]+)»/.exec(q) || [], kind = m[1] || "позиция", name = m[2] || "эту позицию";
  const facts = ((/Из карточки: ([^\n]+)/.exec(q) || [])[1] || "").replace(/\.$/, "").split(/;\s*/).map((x) => x.trim()).filter(Boolean);
  const cut = (t, n) => (t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t);
  const desc = facts.find((x) => !/^(состав|сочетание|к столу|ноты):/i.test(x)) || "";
  const pairF = (facts.find((x) => /^(сочетание|к столу):/i.test(x)) || "").replace(/^[^:]+:\s*/, "");
  const notes = (facts.find((x) => /^ноты:/i.test(x)) || "").replace(/^ноты:\s*/i, "");
  const GEN = { блюдо: "Свежая подача, порция на одного", коктейль: "Яркий вкус, готовим за пару минут", вино: "Хорошо раскрывается с нашей кухней", крепкое: "Мягкое, хорошо идёт чистым" };
  const why = cut(kind === "блюдо" && desc ? desc.split(/[.!?]/)[0] : notes ? "Ноты: " + notes : GEN[kind] || "Гости его любят", 70);
  const pair = cut(pairF || { блюдо: "С бокалом белого вина или нашим лимонадом", коктейль: "К закускам и морепродуктам", вино: "К рыбе и морепродуктам", крепкое: "После ужина, с кофе или десертом" }[kind] || "К основному блюду", 70);
  const nm = kind === "блюдо" ? name.charAt(0).toLowerCase() + name.slice(1) : name;
  const say = cut({ блюдо: "Сегодня советую " + nm + ", шеф очень рекомендует", коктейль: "Попробуйте " + nm + ", бармен приготовит за пару минут",
    вино: "К вашему блюду советую " + nm + ", можно бокалом", крепкое: "После ужина советую " + nm + ", подадим как вы любите" }[kind] || "Сегодня советую " + nm, 140);
  return "Чем хорошо: " + why + "\nС чем предложить: " + pair + "\nФраза гостю: " + say;
}

// v131 (Доп. 444): «Сомелье» в демо без ИИ. Из присланного списка (строки «1. Вино · Шабли · … · ноты: … · к блюдам: …»)
// берёт первые три и пишет «почему» и фразу гостю по их же строкам, в том формате, который просит приложение.
// v132 (Доп. 445): режим «Сомелье» сервера в демо — та же разметка ответа (JSON); выбор — первые строки карты, а для
// «бокал к каждому» — по первой строке к каждому блюду; «почему», фраза, коротко, с историей и подача — по строке карты.
function demoSomJson(som) {
  const card = Array.isArray(som.card) ? som.card : [];
  const each = /Бокал к каждому/.test(String(som.table || ""));
  const nDish = each ? (String(som.table).match(/(^| \|\| )\d\) /g) || []).length : 0;
  let idx = [], dishOf = [];
  const inDish = (l, k) => { const m = / · к блюду ([\d, ]+)$/.exec(l); return !!m && m[1].split(", ").map(Number).includes(k); };
  if (each) { for (let k = 1; k <= nDish; k++) { const i = card.findIndex((l, j) => !idx.includes(j) && inDish(l, k)); if (i >= 0) { idx.push(i); dishOf.push(k); } } }
  else idx = card.slice(0, 3).map((_, i) => i);
  const picks = idx.map((i, k) => {
    const parts = card[i].replace(/^★ /, "").split(" · "), name = parts[1] || "";
    const notes = (parts.find((x) => /^ноты: /.test(x)) || "").replace(/^ноты: /, "").split(", ").filter(Boolean);
    const taste = (parts.find((x) => /^вкус: /.test(x)) || "");
    const red = /красное/.test(card[i]), spirit = /^Крепкое/.test(parts[0]);
    const why = (som.dish && card[i].includes("к блюдам: ") && card[i].includes(String(som.dish).split(";")[0]) ? "В нашей карте его ставят к этому блюду" : taste ? "По вкусу подходит: " + taste.replace(/^вкус: /, "").split(" · ").slice(0, 2).join(", ") : "Подходит по стилю: " + (parts[2] || "").split(", ")[0])
      + (/дороже/.test(String(som.refine || "")) ? "; на ступень выше показанного" : /полегче/.test(String(som.refine || "")) ? "; легче показанного" : /насыщеннее/.test(String(som.refine || "")) ? "; плотнее показанного" : "") + ".";
    return { n: i + 1, dish: each ? dishOf[k] : 0, why, say: (/дороже/.test(String(som.refine || "")) ? "Если хочется чего-то особенного, советую " : "Советую ") + name + (notes.length ? ": " + notes.slice(0, 2).join(" и ") : "") + ". Принести?",
      short: name + (notes.length ? ", " + notes[0] : ""), story: "Это " + name + (parts[2] ? ", " + parts[2].split(" · ")[0] : "") + ". Расскажу, откуда оно и чем интересно, если гость спросит.",
      serve: spirit ? "Чистым или со льдом, бокал по карточке" : red ? "14–16 °C, бокал «бургундия»; декантировать не нужно" : "Охладить до 8–10 °C, бокал «универсальный»" };
  });
  return JSON.stringify({ picks, note: picks.length ? "" : "Из карты ничего не подходит." });
}
function demoSom(b) {
  const msg = String(((b.messages || [])[0] || {}).content || "");
  const asked = ((/^Блюдо из нашего меню: ([^,;\n]+)/m.exec(msg) || [])[1] || "").trim();
  const rows = msg.split("\n").map((l) => /^(\d+)\. (.+)$/.exec(l)).filter(Boolean).slice(0, 3);
  if (!rows.length) return "Из списка ничего не подходит.";
  return rows.map(([, n, l]) => {
    const parts = l.split(" · ");
    const name = parts[1] || "";
    const notes = (parts.find((x) => /^ноты: /.test(x)) || "").replace(/^ноты: /, "");
    const dishes = (parts.find((x) => /^к блюдам: /.test(x)) || "").replace(/^к блюдам: /, "");
    const style = parts.slice(2).filter((x) => !/₽|%|^ноты: |^к блюдам: |^бокалом$/.test(x)).slice(-2).join(", ");
    const why = asked && dishes.indexOf(asked) >= 0 ? "в нашей карте его ставят к «" + asked + "»" + (notes ? ", в нотах " + notes : "")
      : (style ? style + (notes ? ", в нотах " + notes : "") : "в нотах " + notes);
    const say = "Советую " + name + (notes ? ": " + notes.split(", ").slice(0, 2).join(" и ") : "") + ". Принести?";
    return "[[pick:" + n + "]] Почему: " + why.charAt(0).toUpperCase() + why.slice(1) + ". Гостю: «" + say + "»";
  }).join("\n");
}

const json = (x, status = 200) => new Response(JSON.stringify(x === undefined ? null : x), { status, headers: { "Content-Type": "application/json" } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// v139 (Доп. 454): помощник «О нас» в демо — без модели. «Из документа»: абзацы по словам раскладываются по видам блоков;
// «Придумать вопросы»: строки текста становятся верными ответами; «Улучшить текст»: строки списком
const CN_WORDS = [["dress", /форм|дресс|внешн|ногт|украшен|обувь/i], ["setting", /сервир|накрыт|прибор|бокал/i], ["check", /средн\S* чек|правильн\S* чек/i],
  ["day", /распорядок|приход|брифинг в/i], ["numbers", /выручк|цифр|списани/i], ["structure", /отвечает|кто за что|управляющ/i], ["values", /ценност|верим/i],
  ["guest", /гост\S* приход|наш гость|кто к нам/i], ["kitchen", /кухн|блюд|бар\b|пиво|вино/i], ["mood", /атмосфер|музык|интерьер|свет/i], ["idea", /концепц|истори|идея|открыл/i]];
const CN_T = { idea: "Концепция и история", values: "Ценности", structure: "Структура: кто за что отвечает", guest: "Наш гость", kitchen: "Кухня и бар",
  mood: "Атмосфера", pitch: "Рассказ гостю за 30 секунд", dress: "Внешний вид и дресс-код", setting: "Сервировка залов", check: "Правильный чек: к чему стремимся",
  day: "Распорядок дня менеджера", numbers: "Цифры смены: на что смотрим", own: "Свой блок" };
function demoLessonAssist(b) {
  const text = String(b.text || "").trim();
  if (b.mode === "concept") {
    const paras = (text || "Наша концепция: свежая рыба каждый день и сервис, как дома.\n\nФорма: чёрный верх, фартук, закрытая обувь.").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    const by = {};
    for (const p of paras) { const k = (CN_WORDS.find(([, re]) => re.test(p)) || ["own"])[0]; (by[k] = by[k] || []).push(p); }
    const blocks = Object.entries(by).map(([k, ps]) => ({ kind: k, title: k === "own" ? "Разное" : CN_T[k], body: ps.join("\n\n") }));
    return { ok: true, blocks, model: "demo" };
  }
  const lines = text.split("\n").map((x) => x.replace(/^•\s*/, "").replace(/\*\*/g, "").trim()).filter((x) => x.length > 12);
  if (b.mode === "questions") {
    const wrong = ["Как удобно, стандарта нет", "Решает гость", "Это только для руководителей"];
    return { ok: true, model: "demo", questions: lines.slice(0, 3).map((l) => ({ q: "Что из этого наш стандарт («" + String(b.title || "блок") + "»)?", options: [l.slice(0, 190), ...wrong], correct: 0,
      explanation: "Так написано в «О нас»: " + l.slice(0, 160) })) };
  }
  if (b.mode === "improve") return { ok: true, model: "demo", content: lines.length > 1 ? lines.map((l) => "• " + l).join("\n") : text };
  return { ok: false, error: "В демо помощник умеет только «О нас»." };
}
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
  if (/\/functions\/v1\/ai-chat/.test(url)) {
    let b = {}; try { b = JSON.parse((init && init.body) || "{}"); } catch (e) {}
    if (b.mode === "sommelier" && b.som) return wait(1200).then(() => json({ ok: true, reply: demoSomJson(b.som), model: "demo", remaining: 17, som: 1 }));   // v132
    if (b.mode === "sommelier") return wait(1100).then(() => json({ ok: true, reply: demoSom(b), model: "demo", remaining: 17 }));   // v131
    const q0 = String(((b.messages || []).slice(-1)[0] || {}).content || "");
    if (/^Гоу-лист смены ресторана/.test(q0)) return wait(1000).then(() => json({ ok: true, reply: demoGoLines(q0), model: "demo" }));   // v141
    if (q0.includes("[Стандарт холдинга, приём и хранение")) return wait(900).then(() => json({ ok: true, reply: demoRcv(q0), model: "demo" }));   // v142
    if (q0.includes("[Стандарт холдинга, оборудование бара")) return wait(900).then(() => json({ ok: true, reply: demoEqp(q0), model: "demo" }));   // v143
    return wait(700).then(() => json({ ok: true, reply: AI_REPLY, model: "demo" }));
  }
  // v122: фото бутылки — в демо хранилища нет, снимок остаётся в записи (в приложении — ссылка хранилища, photo-upload)
  if (/\/functions\/v1\/photo-upload/.test(url)) { let b = {}; try { b = JSON.parse((init && init.body) || "{}"); } catch (e) {} return wait(600).then(() => json(/^data:image\/(jpeg|png|webp);base64,/.test(String(b.image || "")) ? { ok: true, url: b.image } : { ok: false, error: "bad_request" })); }
  if (/\/functions\/v1\/ai-hr/.test(url)) { let b = {}; try { b = JSON.parse((init && init.body) || "{}"); } catch (e) {} return wait(b.mode === "assess" ? 1400 : 900).then(() => json(demoHr(b))); }   // v121
  // v137: функция push-send на месте (ключи уведомлений созданы)
  if (/\/functions\/v1\/push-send\?init=1/.test(url)) return wait(300).then(() => json({ ok: true, key: srv.rpc("push_status", { p_token: tokOf(me.id) }).key || "" }));
  if (/\/index\.html\?ts=/.test(url)) return Promise.resolve(new Response("", { status: 200 }));   // сверка сборки: в демо одна
  if (/\/api\/lesson-assist/.test(url)) { let b = {}; try { b = JSON.parse((init && init.body) || "{}"); } catch (e) {} return wait(b.mode === "concept" ? 1500 : 900).then(() => json(demoLessonAssist(b))); }   // v139
  if (/\/api\/wine-import/.test(url)) { let b = {}; try { b = JSON.parse((init && init.body) || "{}"); } catch (e) {}
    return (b.z || b.p ? unpackWeb(b) : Promise.resolve(b)).then((x) => wait(x.mode === "fill" ? 700 : 1400).then(() => json(demoWineAi(x)))); }   // v120; v155: упакованный запрос поиска
  if (/\/api\/web-answer/.test(url)) { let b = {}; try { b = JSON.parse((init && init.body) || "{}"); } catch (e) {}
    return unpackWeb(b).then((x) => wait(1500).then(() => json(x.mode === "desc" ? demoDesc(x) : demoWebAnswer(x)))); }   // v152; v153: описания блюд; v155: упакованный запрос
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
function tgToast(text, acts, chat = null) {
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
      const r = a.late ? srv.rpc("chat_late_ok", { p_token: tokOf(me.id), p_msg: a.late })
        : a.take ? srv.rpc("chat_shift_take", { p_token: tokOf(me.id), p_msg: a.take }) : null;   // v137: «Забрать» / «Выйду»
      save();
      btn.textContent = r && r.ok ? (a.take ? "Смена твоя: в графике уже видно" : "Принято: на карточке в чате видно")
        : r && r.error === "taken" ? "Смену уже забрали" : "Не получилось"; btn.disabled = true;
      timer = setTimeout(() => t.remove(), 2200);
    });
    t.querySelector(".a").appendChild(btn);
  }
  // v137 (Доп. 451): сообщение о переписке — «Ответить»: просто текст боту в ближайшие 30 минут уходит в эту переписку
  // (srv.tg.quick, как этап 48); бот отвечает «Ушло в «…».» с кнопками «Отменить» и «Открыть чат»
  if (chat != null) {
    const btn = document.createElement("button"); btn.type = "button"; btn.textContent = "Ответить"; btn.setAttribute("data-demo-tg-reply", "");
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); clearTimeout(timer);
      t.querySelector(".a").remove();
      const f = document.createElement("div"); f.className = "r";
      f.innerHTML = '<input type="text" data-demo-tg-input="" placeholder="Сообщение боту" maxlength="1000"><button type="button" data-demo-tg-send="" aria-label="Отправить">➤</button>';
      f.addEventListener("click", (ev) => ev.stopPropagation());
      const inp = f.querySelector("input");
      const send = () => {
        const r = srv.tg.quick(me.id, inp.value.trim()); save();
        f.remove();
        t.querySelector(".h span").textContent = "бот Академии · ответ";
        t.querySelector(".t").textContent = r && r.ok ? r.text : "Не получилось: открой чат в приложении.";
        if (!(r && r.ok)) { timer = setTimeout(() => t.remove(), 2400); return; }
        t.setAttribute("data-demo-tg-sent", String(r.id));
        const a = document.createElement("div"); a.className = "a";
        const undo = document.createElement("button"); undo.type = "button"; undo.textContent = "Отменить"; undo.setAttribute("data-demo-tg-undo", "");
        const open = document.createElement("button"); open.type = "button"; open.textContent = "Открыть чат"; open.setAttribute("data-demo-tg-open", "");
        undo.addEventListener("click", (ev) => {
          ev.stopPropagation(); clearTimeout(timer);
          const u = srv.tg.undo(me.id, r.id); save();
          t.querySelector(".t").textContent = u && u.ok ? "Отменено: в чат не ушло." : "Отменить уже нельзя: прошло больше 10 минут";
          a.remove(); timer = setTimeout(() => t.remove(), 2200);
        });
        open.addEventListener("click", (ev) => { ev.stopPropagation(); t.remove(); goApp("chat_" + r.chat + "_" + r.id); });
        a.appendChild(undo); a.appendChild(open); t.appendChild(a);
        timer = setTimeout(() => t.remove(), 9000);
      };
      f.querySelector("button").addEventListener("click", send);
      inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") send(); });
      t.appendChild(f);
      setTimeout(() => { try { inp.focus(); } catch (er) {} }, 30);
    });
    t.querySelector(".a").appendChild(btn);
  }
  t.addEventListener("click", () => t.remove());
  // v137: уведомление на телефоне уже сверху — сообщение Telegram под ним
  const pb = document.getElementById("demo-push");
  if (pb) t.style.top = (STRIP + 16 + pb.offsetHeight) + "px";
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
#demo-push{position:fixed;top:${STRIP + 8}px;left:8px;right:8px;margin:0 auto;max-width:420px;z-index:2147483004;box-sizing:border-box;display:flex;gap:10px;align-items:flex-start;padding:11px 13px 12px;border-radius:22px;cursor:pointer;
  font:14px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#F4F4F6;background:rgba(44,44,48,0.86);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);
  box-shadow:0 10px 32px rgba(0,0,0,0.45);animation:demoTgIn .3s ease-out}
#demo-push img{flex:0 0 auto;width:38px;height:38px;border-radius:9px}
#demo-push .c{flex:1;min-width:0}
#demo-push .h{display:flex;gap:8px;font-size:12px;letter-spacing:.3px;color:rgba(235,235,245,0.62)}
#demo-push .h span{flex:1}
#demo-push .h i{font-style:normal}
#demo-push b{display:block;font-weight:600;margin-top:1px}
#demo-push .t{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;color:rgba(244,244,246,0.92)}
#demo-push .a{display:flex;gap:6px;margin-top:9px}
#demo-push .a button{flex:1;min-width:0;padding:8px 6px;border:0;border-radius:12px;background:rgba(255,255,255,0.12);color:#F4F4F6;font:600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer}
#demo-push .r,#demo-tg .r{display:flex;gap:6px;margin-top:9px}
#demo-push .r input,#demo-tg .r input{flex:1;min-width:0;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);background:rgba(0,0,0,0.25);color:inherit;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;outline:none}
#demo-push .r button,#demo-tg .r button{flex:0 0 auto;width:36px;height:36px;border-radius:50%;border:0;background:#C8A96E;color:#1C150A;font-size:15px;cursor:pointer}
@media (prefers-color-scheme: light){#demo-push{color:#111;background:rgba(246,246,248,0.9);box-shadow:0 10px 30px rgba(0,0,0,0.18)}#demo-push .h{color:rgba(60,60,67,0.6)}#demo-push .t{color:rgba(17,17,17,0.88)}
  #demo-push .a button{background:rgba(0,0,0,0.07);color:#111}#demo-push .r input{border-color:rgba(0,0,0,0.18);background:rgba(255,255,255,0.7)}}
#demo-perm{position:fixed;inset:0;z-index:2147483005;display:grid;place-items:center;background:rgba(0,0,0,0.35)}
#demo-perm .box{width:270px;border-radius:14px;overflow:hidden;text-align:center;font:13px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#F4F4F6;background:rgba(40,40,44,0.94);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}
#demo-perm b{display:block;padding:18px 16px 4px;font-size:16px;font-weight:600;line-height:1.3}
#demo-perm p{margin:0;padding:0 16px 16px;color:rgba(244,244,246,0.85)}
#demo-perm .row{display:flex;border-top:1px solid rgba(255,255,255,0.14)}
#demo-perm .row button{flex:1;padding:11px 6px;border:0;background:none;color:#0A84FF;font:17px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer}
#demo-perm .row button+button{border-left:1px solid rgba(255,255,255,0.14);font-weight:600}
@media (prefers-color-scheme: light){#demo-perm .box{color:#111;background:rgba(242,242,247,0.96)}#demo-perm p{color:rgba(17,17,17,0.82)}#demo-perm .row{border-top-color:rgba(60,60,67,0.2)}#demo-perm .row button+button{border-left-color:rgba(60,60,67,0.2)}}
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
      if (k !== who || newPhone || !lsGet("sa_session_token")) { lsSet(K_WHO, k); lsDel("__demo_me"); try { history.replaceState(null, "", "#" + k); } catch (e) { try { location.hash = k; } catch (e2) { /* */ } } location.reload(); } else v.remove();
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
