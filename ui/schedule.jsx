// ui/schedule.jsx
// График смен заведения. Менеджер составляет, сотрудник видит свои смены.
//
// Данные лежат в Supabase (этап 9): schedule_venues — настройки заведения,
// schedule_months — расстановка на месяц. Права проверяются на сервере
// через whoami, здесь только интерфейс.
//
// Автозаполнение — жадный проход по дням: на каждый слот берём того, кому
// больше всего не хватает часов до нормы, соблюдая правила заведения.
// Всё, что менеджер поправил руками, закрепляется и генератором не трогается.

import React from "react";
import { rpc, saToken } from "../api/supabase";
import { generateSchedule } from "../lib/schedule-gen";
import { vibrate, onActivate } from "../lib/utils";
import { GOLD, GOLD_SOFT, CREAM, SAND, MUTED_2, INK_DEEP, RADIUS } from "./tokens";

const mono = "ui-monospace, Menlo, monospace";
const serif = "Georgia, serif";
const DOWL = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const MONTHS_N = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const MONTHS_R = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

// Порядок позиций: сверху руководство, дальше по залу
export const POS = [
  { id: "manager", t: "Менеджер" }, { id: "host", t: "Хостес" }, { id: "call", t: "Колл-центр" },
  { id: "bar", t: "Бар" }, { id: "barback", t: "Барбек" },
  { id: "waiter", t: "Официант" }, { id: "runner", t: "Раннер" },
];
const posName = id => (POS.find(p => p.id === id) || {}).t || id;

// Федеральные праздники с фиксированной датой. Переносы выходных
// правительство утверждает ежегодно — их отмечают руками.
const HOLIDAYS = {
  "01-01":"Новый год","01-02":"Новогодние каникулы","01-03":"Новогодние каникулы","01-04":"Новогодние каникулы",
  "01-05":"Новогодние каникулы","01-06":"Новогодние каникулы","01-07":"Рождество","01-08":"Новогодние каникулы",
  "02-23":"День защитника Отечества","03-08":"Международный женский день","05-01":"Праздник весны и труда",
  "05-09":"День Победы","06-12":"День России","11-04":"День народного единства",
};

// Если человек попросил меньше движения — не анимируем вовсе
const calmMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (e) { return false; }
};
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const firstDow = (y, m) => (new Date(y, m, 1).getDay() + 6) % 7;

// Цвет закреплён за порядком смены, а не за буквой: переименование не ломает раскраску
const SHIFT_COLORS = [
  { bg:"rgba(126,180,220,.20)", bd:"rgba(126,180,220,.5)",  fg:"#BDE0F5", bgL:"rgba(126,180,220,.34)", bdL:"rgba(60,120,165,.6)",  fgL:"#1E4E70" },
  { bg:"rgba(200,169,110,.20)", bd:"rgba(200,169,110,.55)", fg:"#EBD6A8", bgL:"rgba(200,169,110,.38)", bdL:"rgba(139,106,48,.65)", fgL:"#6B4E14" },
  { bg:"rgba(196,120,200,.18)", bd:"rgba(196,120,200,.5)",  fg:"#EBC4EF", bgL:"rgba(196,120,200,.30)", bdL:"rgba(130,60,140,.6)",  fgL:"#6A2A72" },
  { bg:"rgba(93,187,138,.18)",  bd:"rgba(93,187,138,.5)",   fg:"#BFE6D0", bgL:"rgba(93,187,138,.32)",  bdL:"rgba(40,120,80,.6)",   fgL:"#1E5236" },
  { bg:"rgba(224,150,110,.18)", bd:"rgba(224,150,110,.5)",  fg:"#F2CDB4", bgL:"rgba(224,150,110,.32)", bdL:"rgba(160,80,40,.6)",   fgL:"#7A3A18" },
];

// Заготовка заведения для первого запуска: менеджер правит её под себя
export const DEFAULT_CONFIG = {
  hours: [[12,24],[12,24],[12,24],[12,24],[12,26],[12,26],[12,24]],
  shifts: [
    { k:"У", name:"Утро",      from:10, to:18 },
    { k:"Д", name:"День",      from:12, to:20 },
    { k:"В", name:"Вечер",     from:16, to:24 },
    { k:"К", name:"Кейтеринг", from:10, to:22, extra:1 },
  ],
  need: {
    1:{manager:1,host:1,call:1,bar:1,barback:1,waiter:6,runner:1},
    2:{manager:1,host:1,call:1,bar:1,barback:1,waiter:6,runner:2},
    3:{manager:1,host:1,call:1,bar:2,barback:1,waiter:6,runner:2},
  },
  // Разбивка потребности по сменам: сколько человек в какой смене.
  // Если для позиции ничего не задано — все идут в основную смену.
  // Числа здесь — часть общей потребности, а не надбавка сверх неё.
  split: { waiter: { "Д":5, "В":1 } },
  rules: { peakDows:[4,5], highDows:[3,6], maxRow:5, minOff:2, minRest:11, holidayPeak:true,
    // floor — норма это обязательная выработка, сверх неё можно;
    // cap — норму превышать нельзя.
    normMode:"floor" },
  // Как позиция выходит: 2/2 — жёсткий цикл два через два,
  // «поровну» — генератор сам делит смены по недобору часов.
  posRules: {
    manager:{ pattern:"2x2" }, host:{ pattern:"2x2" }, call:{ pattern:"2x2" },
    bar:{ pattern:"even" }, barback:{ pattern:"even" },
    waiter:{ pattern:"even" }, runner:{ pattern:"2x2" },
  },
  dayShift: "Д",                    // основная смена для всех
  // Усиление вечером: сколько человек и в какие дни недели
  evening: { pos:"waiter", shift:"В", dows:[], count:0 },   // устарело, оставлено для старых настроек
  staff: [],
};

// Клавиатура на телефоне закрывает половину экрана: подводим поле к центру
const focusScroll = (e) => {
  const el = e.target;
  setTimeout(() => {
    try {
      // График живёт в position:fixed-слое. iOS при открытии клавиатуры
      // прокручивает СТРАНИЦУ под ним, и WebKit рисует каретку со смещением
      // от поля. Возвращаем страницу на место, затем подводим поле к центру
      // видимой зоны — каретка встаёт куда положено.
      window.scrollTo(0, 0);
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch (_) {}
  }, 350);
};

// Поля редактора — на уровне модуля, иначе React пересоздаёт их каждый рендер
const INP = (a11y, P) => ({
  // В приложении нет глобального box-sizing: без него ширина 100 %
  // складывается с отступами и рамкой, поле вылезает за свои границы
  // и наезжает на соседнюю кнопку.
  boxSizing: "border-box",
  // iOS красит текст в полях своим цветом, обычного color ему мало —
  // нужен -webkit-text-fill-color, иначе на тёмной теме текст почти чёрный.
  WebkitTextFillColor: P.text,
  caretColor: GOLD,
  WebkitAppearance: "none",
  // 16px — как у полей поиска и ассистента: крупнее тап-цель и ни одного
  // сценария зума-на-фокус на старых WebView.
  fontFamily: mono, fontSize: 16, color: P.text, borderRadius: 9, padding: "8px 9px", minWidth: 0,
  background: a11y ? "rgba(255,252,244,0.85)" : "rgba(255,250,238,0.05)",
  border: `1px solid ${a11y ? "rgba(175,140,65,0.35)" : "rgba(145,108,40,0.32)"}`,
  borderTopColor: a11y ? "rgba(255,240,200,0.9)" : "rgba(210,168,65,0.36)",
});
const ROW = (a11y) => ({ display:"flex", alignItems:"center", gap:8, padding:"7px 0",
  borderTop:`1px solid ${a11y ? "rgba(120,90,30,0.10)" : "rgba(255,255,255,0.06)"}` });

function Field({ label, P, children }) {
  return (
    <div style={{ flex:"1 1 0", minWidth:0, maxWidth:"100%" }}>
      <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.2, textTransform:"uppercase",
        color:P.sub, paddingBottom:4 }}>{label}</div>
      {children}
    </div>
  );
}
// Числовое поле держит своё значение, пока его правят: иначе стирание
// последней цифры мгновенно превращалось бы в ноль.
function Num({ v, min, max, set, inp }) {
  // Неуправляемое поле: значение живёт в DOM, поэтому перерисовка экрана
  // не может его сбросить и увести фокус вместе с клавиатурой.
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.value = String(v);
  }, [v]);
  return (
    <input ref={ref} type="number" inputMode="numeric" defaultValue={String(v)} min={min} max={max}
      style={{ ...inp, width:60, textAlign:"center" }}
      onFocus={focusScroll}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
      onChange={e => { if (e.target.value === "") return;
        set(Math.max(min, Math.min(max, +e.target.value || 0))); }}
      onBlur={e => { const x = Math.max(min, Math.min(max, +e.target.value || 0));
        e.target.value = String(x); set(x); }} />
  );
}
// Текстовое поле: правки идут локально, наверх уходят по окончании ввода
function Text({ v, set, inp, style, maxLength }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.value = v;
  }, [v]);
  return (
    <input ref={ref} defaultValue={v} maxLength={maxLength} style={{ ...inp, ...style }}
      enterKeyHint="done" onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
      onFocus={focusScroll} onChange={e => set(e.target.value)} />
  );
}
function Pill({ on, children, onClick, a11y, P, style }) {
  return (
    <button onClick={onClick} className="sa-btn" style={{
      padding:"6px 10px", borderRadius:999, cursor:"pointer", fontFamily:serif, fontSize:11.5,
      color: on ? GOLD : P.sub, background: on ? "rgba(200,169,110,0.13)" : "transparent",
      border:`1px solid ${on ? GOLD + "99" : (a11y ? "rgba(175,140,65,0.3)" : "rgba(145,108,40,0.3)")}`,
      ...style }}>{children}</button>
  );
}
// Имя с телефоном превращается в звонок по тапу: «проспал», «заболел» —
// это ситуации на секунды, а не на переписку. Пунктир снизу — знак, что имя
// звонит; stopPropagation — чтобы тап не сворачивал раскрытый день.
// Компонент на уровне модуля: объявленный внутри экрана, он получал бы новую
// идентичность каждый рендер, и React пересоздавал бы DOM ссылки впустую.
const telHref = ph => "tel:" + String(ph).replace(/[^+\d]/g, "");
function CallName({ who, label, color }) {
  // Прод-урок: прямые tel:-ссылки Telegram-WebView часто глушит молча —
  // тап «не делал ничего», и человек ждал, что номер хотя бы ПОЯВИТСЯ.
  // Теперь тап раскрывает номер рядом (и тихо кладёт его в буфер), а сам
  // раскрытый номер — ссылка на звонилку: где tel: работает — звонит,
  // где нет — номер перед глазами и уже скопирован.
  const [shown, setShown] = React.useState(false);
  if (!(who && who.phone)) return <>{label}</>;
  const tap = (e) => {
    e.stopPropagation();
    setShown(v => !v);
    if (!shown) { try { navigator.clipboard?.writeText(String(who.phone)); } catch (err) {} }
  };
  return (
    <span onClick={tap} style={{ color, cursor:"pointer" }}>
      <span style={{ borderBottom:`1px dashed ${color}AA` }}>{label}</span>
      {shown ? (
        <a href={telHref(who.phone)} onClick={e => e.stopPropagation()}
          style={{ color, textDecoration:"none", marginLeft:6, fontFamily:mono, fontSize:"0.92em",
            padding:"1px 6px", borderRadius:6, border:`1px solid ${color}55`, whiteSpace:"nowrap" }}>
          {who.phone} ↗
        </a>
      ) : null}
    </span>
  );
}
function Sec({ no, title, hint, open, onToggle, P, children }) {
  return (
    <div className="sa-schedsec" style={{ marginBottom:8, borderRadius:14, overflow:"hidden" }}>
      <div onClick={onToggle} {...onActivate(onToggle)}
        style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 13px", cursor:"pointer" }}>
        <div className="sa-schedno">{no}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14.5, color:P.text }}>{title}</div>
          <div style={{ fontSize:11, color:P.sub }}>{hint}</div>
        </div>
        <div style={{ color:P.sub, fontSize:16, transform: open ? "rotate(90deg)" : "none",
          transition:"transform .3s" }}>›</div>
      </div>
      {open ? <div style={{ padding:"0 13px 13px" }}>{children}</div> : null}
    </div>
  );
}

export function ScheduleScreen({ T = {}, a11y, profile, onBack }) {
  // Редактор графика — не только владелец: менеджеры и руководители тоже
  // (та же формула, что у собеседования кандидатов — canHire в App).
  const isAdmin = !!profile?.is_admin || ["manager", "senior", "senior_bartender"].includes(profile?.position);
  const now = new Date();
  const [Y, setY] = React.useState(now.getFullYear());
  const [M, setM] = React.useState(now.getMonth());
  const [cfg, setCfg] = React.useState(null);       // настройки заведения
  const [plan, setPlan] = React.useState({});       // plan[staffId][day] = метка смены
  const [locks, setLocks] = React.useState({});
  const [days, setDays] = React.useState({});       // ручные пометки дней месяца
  const [state, setState] = React.useState("load"); // load · ok · error
  const [dirty, setDirty] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [dbg, setDbg] = React.useState("");     // сырой ответ сервера для разбора
  const [tab, setTab] = React.useState("plan"); // plan · setup
  const [openSec, setOpenSec] = React.useState(1);
  const [confirmClear, setConfirmClear] = React.useState(false);
  // Месяц не влезает в ширину экрана, а горизонтальный жест в Telegram
  // работает через раз. Поэтому показываем неделю целиком, без прокрутки.
  const [weekIdx, setWeekIdx] = React.useState(null);   // null — весь месяц
  const [genKey, setGenKey] = React.useState(0);        // смена номера перезапускает анимацию
  const [shot, setShot] = React.useState(null);         // готовая картинка: {url, blob, name}
  const [shotBusy, setShotBusy] = React.useState(false);
  const [shotMode, setShotMode] = React.useState("chat");  // chat · a4
  const [openDay, setOpenDay] = React.useState(0);     // раскрытый день в виде сотрудника
  const [openEmp, setOpenEmp] = React.useState(0);     // раскрытая карточка сотрудника в настройках
  const [offRange, setOffRange] = React.useState(false); // календарь дат: режим «диапазон»
  const [offAnchor, setOffAnchor] = React.useState(null); // первый тап диапазона {i, d}
  // Отмена последнего крупного действия (генерация, обмен, очистка, снятие
  // замков): один снапшот, честная страховка от «ой, не то нажал».
  const undoRef = React.useRef(null);
  const [undoTick, setUndoTick] = React.useState(0);
  const snapUndo = () => {
    undoRef.current = { plan: JSON.parse(JSON.stringify(plan)), locks: JSON.parse(JSON.stringify(locks)) };
    setUndoTick(t => t + 1);
  };
  const undo = () => {
    const u = undoRef.current; if (!u) return;
    setPlan(u.plan); setLocks(u.locks); undoRef.current = null;
    setUndoTick(t => t + 1); setDirty(true); vibrate("light");
    setMsg("Вернул как было — не забудь сохранить"); setTimeout(() => setMsg(""), 2500);
  };
  const [swap, setSwap] = React.useState(false);       // режим обмена сменами (менеджер)
  const [swapSel, setSwapSel] = React.useState(null);  // первая выбранная клетка обмена
  const [covShown, setCovShown] = React.useState(0);    // покрытие, догоняющее настоящее
  const covTarget = React.useRef(0);

  const DAYS = daysIn(Y, M);
  const mkey = `${Y}-${String(M + 1).padStart(2, "0")}`;
  const venueKey = "main";                           // одно заведение на ресторан; сети — позже
  const dow = d => (firstDow(Y, M) + d - 1) % 7;

  // Личные заметки к дням: чаевые, важные события. Хранятся на устройстве —
  // это персональный блокнот сотрудника, сервер о нём не знает.
  // ВАЖНО: блок живёт ПОСЛЕ объявления mkey — массив зависимостей эффекта
  // вычисляется прямо при рендере, и ссылка на mkey выше его объявления
  // роняла весь экран (TDZ: "Cannot access before initialization").
  const notesKey = `sa_schednotes_${profile?.name || ""}_${profile?.surname || ""}`;
  const [notes, setNotes] = React.useState({});
  React.useEffect(() => {
    try { const all = JSON.parse(localStorage.getItem(notesKey) || "{}"); setNotes(all[mkey] || {}); }
    catch (e) { setNotes({}); }
  }, [mkey, notesKey]);
  const saveNote = (d, text) => {
    setNotes(n => {
      const nx = { ...n }; const t = (text || "").trim();
      if (t) nx[d] = t.slice(0, 200); else delete nx[d];
      try {
        const all = JSON.parse(localStorage.getItem(notesKey) || "{}");
        if (Object.keys(nx).length) all[mkey] = nx; else delete all[mkey];
        localStorage.setItem(notesKey, JSON.stringify(all));
      } catch (e) {}
      return nx;
    });
  };

  // Пожелания «прошу выходной»: null — грузятся, false — сервер без функции
  // (schedule-wishes.sql не применён), объект — карта staffId → [дни].
  // ВАЖНО: блок стоит ПОСЛЕ mkey/venueKey — их имена живут в deps-массивах,
  // которые вычисляются при рендере (тот же TDZ, что уже ронял заметки).
  const [wishes, setWishes] = React.useState(null);
  // Жёсткие «не смогу выйти» (kind='hard'): для генератора — запрет,
  // для менеджера — красный уголок. Требует schedule-wishes-v2.sql;
  // на старом сервере кнопка честно деградирует в подсказку.
  const [hardOff, setHardOff] = React.useState({});
  const [wishesV2, setWishesV2] = React.useState(true);
  const wishOf = (id, d) => wishes && Array.isArray(wishes[id]) && wishes[id].includes(d);
  const hardOf = (id, d) => Array.isArray(hardOff[id]) && hardOff[id].includes(d);

  const loadWishes = React.useCallback(async () => {
    try {
      const r = await rpc("schedule_wishes_get", {
        p_token: saToken(), p_restaurant: profile?.restaurant || "",
        p_venue_key: venueKey, p_month: mkey,
      });
      if (r && r.ok === true) {
        const map = {}, hard = {};
        (r.wishes || []).forEach(w => {
          const tgt = w.kind === "hard" ? hard : map;
          (tgt[w.staff_id] = tgt[w.staff_id] || []).push(w.day);
        });
        setWishes(map); setHardOff(hard);
      } else if (String(r?.message || r?.error || "").toLowerCase().includes("schedule_wishes_get")) {
        setWishes(false);   // функции нет на сервере — фича честно спит
      } else setWishes({});
    } catch (e) { setWishes(false); }
  }, [mkey, venueKey, profile]);
  React.useEffect(() => { if (state === "ok") { setWishes(null); loadWishes(); } }, [state, loadWishes]);
  const setWish = async (staffId, d, on, kind = "off") => {
    if (wishes === false) return;
    let cap = null;
    if (kind === "hard" && on) {
      const meObj = staff.find(x => String(x.id) === String(staffId));
      cap = meObj ? hardCapacity(d, meObj) : null;
      if (cap && cap.left <= 0) {
        // мест нет — честно и сразу, без похода на сервер
        setWishNote({ d, text: cap.maxHard === 0
          ? "На этот день никто не может брать «не смогу»: людей ровно столько, сколько нужно залу. Поговори с менеджером"
          : `Мест на этот день уже нет (${cap.taken} из ${cap.maxHard} заняли коллеги) — кто успел, тот успел. Поговори с менеджером` });
        vibrate("light");
        return;
      }
    }
    setWishNote(null);
    const applyLocal = (setter) => setter(w => {
      const nx = { ...(w || {}) };
      const arr = new Set(nx[staffId] || []);
      on ? arr.add(d) : arr.delete(d);
      nx[staffId] = [...arr].sort((a, b) => a - b);
      if (!nx[staffId].length) delete nx[staffId];
      return nx;
    });
    applyLocal(kind === "hard" ? setHardOff : setWishes);
    // один день — одно состояние: жёсткое и мягкое взаимоисключаются
    if (on) {
      const other = kind === "hard" ? setWishes : setHardOff;
      other(w => { if (!w || !Array.isArray(w[staffId])) return w;
        const nx = { ...w, [staffId]: w[staffId].filter(x => x !== d) };
        if (!nx[staffId].length) delete nx[staffId]; return nx; });
    }
    vibrate("light");
    try {
      const args = {
        p_token: saToken(), p_restaurant: profile?.restaurant || "",
        p_venue_key: venueKey, p_month: mkey, p_staff_id: staffId, p_day: d, p_on: on,
      };
      let r = await rpc("schedule_wish_set", { ...args, p_kind: kind,
        ...(cap ? { p_peers: cap.peers, p_max: cap.maxHard } : {}) });
      if (r && r.ok !== true && r.error === "day_full") {
        // гонка: пока думал — коллеги заняли места; сервер отбил честно
        loadWishes();
        setWishNote({ d, text: "Пока ты думал(а), коллеги заняли последние места на этот день — кто успел, тот успел. Поговори с менеджером" });
        return;
      }
      const miss = (x) => String(x?.message || x?.error || "").toLowerCase().includes("schedule_wish_set");
      if ((!r || r.ok !== true) && miss(r) && kind !== "hard") {
        // старый сервер без p_kind: мягкие работают по-старому
        setWishesV2(false);
        r = await rpc("schedule_wish_set", args);
      } else if ((!r || r.ok !== true) && miss(r) && kind === "hard") {
        setWishesV2(false); loadWishes(); return;
      }
      if (!r || r.ok !== true) {
        if (miss(r)) setWishes(false);
        else loadWishes();   // рассинхрон — перечитать правду с сервера
      }
    } catch (e) { setWishes(false); }
  };
  const holName = d => HOLIDAYS[`${String(M+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`];

  const shiftOf = k => (cfg?.shifts || []).find(s => s.k === k);
  const len = s => s.to - s.from;
  const colorOf = k => {
    const i = (cfg?.shifts || []).findIndex(x => x.k === k);
    return i < 0 ? null : SHIFT_COLORS[i % SHIFT_COLORS.length];
  };
  const lvlOf = d => {
    const o = days[d];
    if (o && o.lvl) return o.lvl;
    const R = cfg?.rules || DEFAULT_CONFIG.rules;
    if (holName(d) && R.holidayPeak) return 3;
    const w = dow(d);
    if (R.peakDows.includes(w)) return 3;
    if (R.highDows.includes(w)) return 2;
    return 1;
  };
  const holOf = d => { const o = days[d]; return o && o.hol !== undefined ? o.hol : !!holName(d); };
  const needOf = d => (cfg?.need || {})[lvlOf(d)] || {};
  const onVac = (s, d) => s.vac && s.vac[2] === mkey && d >= s.vac[0] && d <= s.vac[1];
  // Заморозка живого месяца: прошедшие дни (и сегодня — смена уже идёт)
  // неприкосновенны для генерации/раздачи/очистки. Прошлый месяц заморожен
  // целиком, будущий — свободен весь.
  const frozenBefore = () => {
    const cur = new Date(now.getFullYear(), now.getMonth());
    const view = new Date(Y, M);
    if (view < cur) return DAYS + 1;
    if (view > cur) return 0;
    return now.getDate() + 1;
  };
  // Норма с учётом отпуска: 160 ч при 11 днях отпуска — это не 160 ч в
  // оставшиеся дни. Уменьшаем пропорционально — генератор перестаёт
  // трамбовать отпускника, а «Проверка» — ныть о недоработке.
  const effNorm = (s) => {
    if (!(s.vac && s.vac[2] === mkey && s.vac[0])) return s.norm || 0;
    const vd = Math.max(0, Math.min(DAYS, s.vac[1]) - Math.max(1, s.vac[0]) + 1);
    return Math.round((s.norm || 0) * (DAYS - vd) / DAYS);
  };
  const vacOn = (s) => !!(s.vac && s.vac[2] === mkey && s.vac[0]);
  // Выходные по конкретным числам. Хранятся по месяцам: «14-е» в августе
  // не должно тянуться в сентябрь.
  const offDays = (s) => (s.offDays && s.offDays[mkey]) || [];
  const isDayOff = (s, d) => (s.off || []).includes(dow(d)) || offDays(s).includes(d);

  const isLocked = (id, d) => !!(locks[id] && locks[id][d]);

  // ── Загрузка ──────────────────────────────────────────────────────
  const load = React.useCallback(async () => {
    setState("load"); setMsg("");
    try {
      const r = await rpc("schedule_load", {
        p_token: saToken(), p_restaurant: profile?.restaurant || "", p_month: mkey,
      });
      // Показываем ответ сервера как есть: общая фраза «не удалось» не даёт
      // понять, дело в правах, в отсутствующей функции или в токене.
      if (!r || r.ok !== true) {
        setState("error");
        const why = r?.error === "auth" ? "Сессия не распознана — перезайди в приложение"
          : r?.error === "bad_token" ? "Токен сессии в неверном формате — перезайди в приложение"
          : r?.error === "forbidden" ? "Нет прав: график меняет менеджер"
          : r?.message || r?.error || r?.hint || (r?.code ? "Код " + r.code : "Сервер вернул пустой ответ");
        setMsg(why);
        setDbg(JSON.stringify(r || {}).slice(0, 400));
        return;
      }
      const v = (r.venues || []).find(x => x.venue_key === venueKey);
      setCfg(v ? { ...DEFAULT_CONFIG, ...v.config } : { ...DEFAULT_CONFIG });
      const m = (r.months || []).find(x => x.venue_key === venueKey);
      const pl = m?.payload || {};
      setPlan(pl.plan || {}); setLocks(pl.locks || {}); setDays(pl.days || {});
      setSwapSel(null);   // выбор обмена не переживает смену месяца
      undoRef.current = null; setUndoTick(t => t + 1);   // и отмена тоже
      setDirty(false); setState("ok");
    } catch (e) { setState("error"); setMsg("Нет связи с сервером"); setDbg(String(e && e.message || e)); }
  }, [mkey, profile?.restaurant]);

  React.useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!isAdmin) return;
    setMsg("Сохраняю…");
    try {
      const r = await rpc("schedule_save_month", {
        p_token: saToken(), p_restaurant: profile?.restaurant || "", p_venue_key: venueKey,
        p_month: mkey, p_payload: JSON.stringify({ plan, locks, days }),
      });
      if (r && r.ok === true) { setDirty(false); setMsg("Сохранено"); vibrate("success"); }
      else setMsg(r?.error === "forbidden" ? "Нет прав на изменение графика"
        : (r?.message || r?.error || "Сохранить не удалось"));
    } catch (e) { setMsg("Нет связи с сервером"); }
    setTimeout(() => setMsg(""), 2500);
  };

  const staff = cfg?.staff || [];
  const [wishNote, setWishNote] = React.useState(null);   // { d, text } — отказ очереди в раскрытом дне
  // Очередь жёстких «не смогу выйти»: мест на день ровно столько, чтобы
  // зал ещё закрывался — доступные коллеги должности минус потребность.
  // Кто успел, тот успел; отпуск и постоянные выходные место не занимают
  // (эти люди и так не в строю).
  const hardCapacity = (d, meObj) => {
    const peers = staff.filter(x => x.pos === meObj.pos);
    const avail = peers.filter(x => !onVac(x, d) && !isDayOff(x, d));
    const need = needOf(d)[meObj.pos] || 0;
    const maxHard = Math.max(0, avail.length - need);
    const taken = avail.filter(x => String(x.id) !== String(meObj.id) && hardOf(x.id, d)).length;
    return { maxHard, taken, left: Math.max(0, maxHard - taken), peers: peers.map(x => x.id) };
  };

  // Смещение цикла 2/2 у каждого своё, иначе вся позиция уйдёт отдыхать разом.
  const cycleOffset = (s) => {
    const list = staff.filter(x => x.pos === s.pos);
    const i = list.findIndex(x => x.id === s.id);
    return list.length ? Math.round(i * 4 / list.length) % 4 : 0;
  };
  const inCycle = (s, d) => {
    const rule = (cfg?.posRules || {})[s.pos];
    if (!rule || rule.pattern !== "2x2") return true;
    return ((d - 1 + cycleOffset(s)) % 4) < 2;      // два рабочих, два выходных
  };

  // Недели месяца: первая может быть неполной, последняя тоже
  const weeks = React.useMemo(() => {
    const out = []; let cur = [];
    for (let d = 1; d <= DAYS; d++) {
      cur.push(d);
      if (dow(d) === 6 || d === DAYS) { out.push(cur); cur = []; }
    }
    return out;
  }, [Y, M, DAYS]);
  const visibleDays = weekIdx == null
    ? Array.from({ length: DAYS }, (_, i) => i + 1)
    : (weeks[weekIdx] || []);

  // Очистка месяца: снимает и расстановку, и замки. Настройки заведения
  // при этом остаются — они общие для всех месяцев.
  // Очистка — ЛОКАЛЬНЫЙ черновик: сервер не трогаем до осознанного
  // «Сохранить». Случайная очистка теперь безобидна всегда: «Отменить»
  // вернёт как было, а закрытие приложения просто оставит сервер прежним.
  // scope: {} — весь месяц; { pos } — должность; { staffId } — один человек.
  const clearScope = (scope = {}) => {
    snapUndo();
    const fb = frozenBefore();
    const match = (id) => {
      if (scope.staffId) return String(id) === String(scope.staffId);
      if (scope.pos) return staff.some(x => String(x.id) === String(id) && x.pos === scope.pos);
      return true;
    };
    const strip = (obj) => {
      const nx = {};
      Object.entries(obj || {}).forEach(([id, v]) => {
        if (!match(id)) { nx[id] = v; return; }
        // прошедшие дни живого месяца неприкосновенны — стирается будущее
        const past = {};
        Object.entries(v || {}).forEach(([d, val]) => { if (+d < fb && val) past[d] = val; });
        if (Object.keys(past).length) nx[id] = past;
      });
      return nx;
    };
    setPlan(p => strip(p)); setLocks(l => strip(l));
    setDirty(true); setConfirmClear(false); vibrate("light");
    const what = scope.staffId
      ? `у ${staff.find(x => String(x.id) === String(scope.staffId))?.name || "сотрудника"}`
      : scope.pos ? `у должности «${POS.find(pp => pp.id === scope.pos)?.t || scope.pos}»` : "за месяц";
    setMsg(`Смены ${what} стёрты в черновике — «Сохранить» закрепит, «↩ Отменить» вернёт`);
    setTimeout(() => setMsg(""), 4000);
  };

  // Сотрудник уходит: раздать ЕГО смены другим, не тронув ни одной чужой
  // клетки. Механика — виртуальные замки: всё существующее у остальных
  // фиксируется на время прогона, уходящий исключается из штата, и
  // генератор заполняет только его дыры по всем правилам. Виртуальные
  // замки в стейт не попадают — это инструмент прогона, не данные.
  const redistribute = (staffId) => {
    const gone = staff.find(x => String(x.id) === String(staffId));
    if (!gone) return;
    const fb = frozenBefore();
    if (fb > DAYS) { setMsg("Это прошлый месяц — он только для чтения"); setTimeout(() => setMsg(""), 2500); return; }
    snapUndo();
    // Отработанное остаётся у уходящего — это история и зарплата;
    // раздаём коллегам только будущие смены
    const gonePast = {};
    Object.entries(plan[staffId] || {}).forEach(([d, v]) => { if (+d < fb && v) gonePast[d] = v; });
    const planWo = {};
    Object.entries(plan).forEach(([id, ds]) => { if (String(id) !== String(staffId)) planWo[id] = { ...ds }; });
    const vLocks = {};
    Object.entries(planWo).forEach(([id, ds]) => {
      Object.keys(ds || {}).forEach(d => { if (ds[d]) (vLocks[id] = vLocks[id] || {})[d] = true; });
    });
    Object.entries(locks).forEach(([id, ds]) => {
      if (String(id) === String(staffId)) return;
      Object.keys(ds || {}).forEach(d => { if (ds[d]) (vLocks[id] = vLocks[id] || {})[d] = true; });
    });
    const cfg2 = { ...cfg, staff: staff.filter(x => String(x.id) !== String(staffId)) };
    const res = generateSchedule({ cfg: cfg2, DAYS, dow, lvlOf, plan: planWo, locks: vLocks, POS, mkey, wishes: wishes || {}, hardOff, freezeBefore: fb });
    if (!res.plan) return;
    // прошлое уходящего возвращается в план (генератор его не знает — он
    // исключён из штата на прогон)
    setPlan(Object.keys(gonePast).length ? { ...res.plan, [staffId]: gonePast } : res.plan);
    setLocks(l => { const nx = { ...l }; delete nx[staffId]; return nx; });
    setDirty(true); setConfirmClear(false); setGenKey(k => k + 1); vibrate("success");
    setMsg(res.shortage
      ? `Будущие смены ${gone.name} розданы, но ${res.shortage} закрыть некем — детали в проверке. «Сохранить» закрепит, «↩ Отменить» вернёт`
      : `Будущие смены ${gone.name} розданы коллегам (отработанное осталось в графике) — проверь черновик и сохрани. Не забудь убрать человека в настройках`);
    setTimeout(() => setMsg(""), 6000);
  };

  // Новенький в живом месяце: отдать ему ДЫРЫ будущего, ничего не меняя
  // у остальных. Механика: все существующие клетки фиксируются
  // виртуальными замками, а назначать генератору разрешено только ему
  // (onlyIds) — коллеги остаются фоном занятости.
  const onboardNew = (staffId) => {
    const nw = staff.find(x => String(x.id) === String(staffId));
    if (!nw) return;
    const fb = frozenBefore();
    if (fb > DAYS) { setMsg("Это прошлый месяц — он только для чтения"); setTimeout(() => setMsg(""), 2500); return; }
    snapUndo();
    const vLocks = {};
    Object.entries(plan).forEach(([id, ds]) => {
      Object.keys(ds || {}).forEach(d => { if (ds[d]) (vLocks[id] = vLocks[id] || {})[d] = true; });
    });
    Object.entries(locks).forEach(([id, ds]) => {
      Object.keys(ds || {}).forEach(d => { if (ds[d]) (vLocks[id] = vLocks[id] || {})[d] = true; });
    });
    const res = generateSchedule({ cfg, DAYS, dow, lvlOf, plan, locks: vLocks, POS, mkey,
      wishes: wishes || {}, hardOff, onlyIds: new Set([String(staffId)]), freezeBefore: fb });
    if (!res.plan) return;
    setPlan(res.plan);
    setDirty(true); setConfirmClear(false); setGenKey(k => k + 1); vibrate("success");
    const got = Object.values(res.plan[staffId] || {}).filter(Boolean).length
      - Object.values(plan[staffId] || {}).filter(Boolean).length;
    setMsg(got > 0
      ? `${nw.name} получил(а) ${got} ${got === 1 ? "смену" : got < 5 ? "смены" : "смен"} в свободные дыры — проверь черновик и сохрани`
      : `Свободных дыр для ${nw.name} не нашлось: график уже закрыт. Сними смены у коллег (очисткой или тапами) и повтори`);
    setTimeout(() => setMsg(""), 6000);
  };

  // Настройки заведения сохраняются отдельно от месяца: они общие для всех месяцев
  const saveCfg = async (next) => {
    if (!isAdmin) return;
    setMsg("Сохраняю настройки…");
    try {
      const r = await rpc("schedule_save_venue", {
        p_token: saToken(), p_restaurant: profile?.restaurant || "", p_venue_key: venueKey,
        p_title: profile?.restaurant || "Заведение", p_config: JSON.stringify(next),
      });
      setMsg(r && r.ok === true ? "Настройки сохранены"
        : (r?.error === "forbidden" ? "Настройки меняет менеджер" : "Сохранить не удалось"));
    } catch (e) { setMsg("Нет связи с сервером"); }
    setTimeout(() => setMsg(""), 2000);
  };
  // Правки применяются мгновенно, а на сервер уходят через паузу —
  // иначе каждая нажатая буква била бы запросом.
  const saveTimer = React.useRef(null);
  const patch = (fn) => {
    const next = JSON.parse(JSON.stringify(cfg)); fn(next);
    setCfg(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveCfg(next), 900);
  };

  // ── Автозаполнение ────────────────────────────────────────────────
  // Алгоритм живёт в lib/schedule-gen.js (там же тесты гоняются в Node):
  // мультистарт из 24 прогонов с ремонтом дыр перестановками. Закреплённые
  // вручную клетки сохраняются и достраиваются вокруг — как раньше.
  const generate = () => {
    if (!cfg || !staff.length) return;
    const fb = frozenBefore();
    if (fb > DAYS) { setMsg("Это прошлый месяц — он только для чтения"); setTimeout(() => setMsg(""), 2500); return; }
    // ДОЗАПОЛНЕНИЕ, а не пересборка: всё уже расставленное фиксируется
    // виртуальными замками — генератор закрывает только дыры. Прод-кейс:
    // стёр одну должность → «Заполнить» перетасовывал весь месяц, хотя
    // люди уже видели свои смены. Пересборка с нуля — через очистку.
    const vLocks = {};
    Object.entries(plan).forEach(([id, ds]) => {
      Object.keys(ds || {}).forEach(d => { if (ds[d]) (vLocks[id] = vLocks[id] || {})[d] = true; });
    });
    Object.entries(locks).forEach(([id, ds]) => {
      Object.keys(ds || {}).forEach(d => { if (ds[d]) (vLocks[id] = vLocks[id] || {})[d] = true; });
    });
    const cells = (pm) => Object.values(pm || {}).reduce((a, ds) => a + Object.values(ds || {}).filter(Boolean).length, 0);
    const before = cells(plan);
    const res = generateSchedule({ cfg, DAYS, dow, lvlOf, plan, locks: vLocks, POS, mkey, wishes: wishes || {}, hardOff, freezeBefore: fb });
    if (!res.plan) return;
    const added = cells(res.plan) - before;
    snapUndo();
    setPlan(res.plan); setDirty(true); setGenKey(k => k + 1);
    vibrate(res.shortage ? "light" : "success");
    const frozenNote = fb > 1 ? ", прошедшие дни не тронуты" : "";
    setMsg(added > 0
      ? (res.shortage
        ? `Дозаполнено ${added} ${added === 1 ? "смена" : added < 5 ? "смены" : "смен"} (ген 3${frozenNote}), но ${res.shortage} закрыть некем — детали в проверке`
        : `Дозаполнено ${added} ${added === 1 ? "смена" : added < 5 ? "смены" : "смен"} (ген 3${frozenNote}) — существующие не тронуты`)
      : (res.shortage
        ? `Дыры есть (${res.shortage}), но закрыть их некем — детали в проверке ниже`
        : "Всё уже расставлено. Пересобрать с нуля? Сначала «Очистить месяц» (или должность) — потом «Заполнить»"));
    setTimeout(() => setMsg(""), 5000);
  };

  // ── Проверка ──────────────────────────────────────────────────────
  const audit = () => {
    if (!cfg) return [];
    const R = cfg.rules, out = [];
    for (let d = 1; d <= DAYS; d++) {
      const need = needOf(d);
      POS.forEach(({ id: pos }) => {
        const n = need[pos] || 0; if (!n) return;
        const have = staff.filter(s => {
          const sh = s.pos === pos && shiftOf(plan[s.id]?.[d]); return sh && !sh.extra;
        }).length;
        if (have < n) out.push(`${d} ${MONTHS_R[M]} · ${posName(pos).toLowerCase()}: ${have} из ${n}`);
      });
    }
    staff.forEach(s => {
      let h = 0, st = 0, mx = 0;
      for (let d = 1; d <= DAYS; d++) {
        const k = plan[s.id]?.[d], sh = k && shiftOf(k);
        if (sh) { h += len(sh); st++; mx = Math.max(mx, st); } else st = 0;
        if (k && onVac(s, d)) out.push(`${s.name}: смена ${d}-го в отпуске`);
        const pv = d > 1 ? plan[s.id]?.[d - 1] : "", q = pv && shiftOf(pv);
        if (sh && q) { const r = 24 - q.to + sh.from; if (r < R.minRest) out.push(`${s.name}: между ${d-1} и ${d} только ${r} ч отдыха`); }
      }
      const en = effNorm(s);
      if ((R.normMode || "floor") === "cap" && h > s.norm) out.push(`${s.name}: переработка ${h - s.norm} ч`);
      if ((R.normMode || "floor") === "floor" && h < en) out.push(`${s.name}: недоработка ${en - h} ч до нормы${en !== s.norm ? " (с учётом отпуска)" : ""}`);
      if (mx > R.maxRow) out.push(`${s.name}: ${mx} смен подряд при пределе ${R.maxRow}`);
    });
    return [...new Set(out)];
  };

  // Норма месяца при полной ставке: рабочие дни по пятидневке минус праздники,
  // предпраздничный день короче на час. Переносы выходных правительство
  // утверждает отдельно — их менеджер поправит руками.
  const monthNorm = (hoursPerWeek = 40) => {
    const perDay = hoursPerWeek / 5;
    let work = 0, shortDays = 0;
    for (let d = 1; d <= DAYS; d++) {
      const w = dow(d), hol = !!holName(d);
      if (w >= 5 || hol) continue;
      work++;
      const nextHol = d < DAYS ? !!holName(d + 1) : false;
      if (nextHol) shortDays++;
    }
    return Math.round(work * perDay - shortDays);
  };

  // Полный разбор по человеку: сколько смен каждого вида и сколько часов
  // они дали. Считается по фактически расставленным сменам месяца.
  const breakdownOf = s => {
    const by = {}; let hours = 0, shifts = 0;
    for (let d = 1; d <= DAYS; d++) {
      const k = plan[s.id]?.[d]; if (!k) continue;
      const sh = shiftOf(k); if (!sh) continue;
      shifts++; hours += len(sh);
      if (!by[k]) by[k] = { n: 0, h: 0, name: sh.name };
      by[k].n++; by[k].h += len(sh);
    }
    return { hours, shifts, by };
  };

  const hoursOf = s => {
    let h = 0;
    for (let d = 1; d <= DAYS; d++) { const sh = shiftOf(plan[s.id]?.[d]); if (sh) h += len(sh); }
    return h;
  };
  const leadObj = d =>
    staff.find(s => s.pos === "manager" && plan[s.id]?.[d] && !shiftOf(plan[s.id][d])?.extra) || null;
  const leadOn = d => { const m = leadObj(d); return m ? m.name : null; };

  // Координаты клеток-нарушителей: та же логика, что в audit(), но с адресами
  // — красная точка на клетке показывает проблему прямо в сетке.
  // ВАЖНО: это ХУК, и он обязан жить ДО первых ранних return (загрузка,
  // ошибка, вид сотрудника) — иначе число хуков меняется между рендерами
  // и React падает с #310. Уже падал: третий бокал вина за день.
  const badCells = React.useMemo(() => {
    const bad = new Set(); if (!cfg) return bad;
    const R = cfg.rules;
    staff.forEach(sf => {
      let run = [];
      for (let d = 1; d <= DAYS + 1; d++) {
        const sh = d <= DAYS ? shiftOf(plan[sf.id]?.[d]) : null;
        if (sh) run.push(d);
        else { if (run.length > R.maxRow) run.forEach(x => bad.add(sf.id + ":" + x)); run = []; }
        if (d <= DAYS && sh && d > 1) {
          const q = shiftOf(plan[sf.id]?.[d - 1]);
          if (q && (24 - q.to + sh.from) < R.minRest) { bad.add(sf.id + ":" + d); bad.add(sf.id + ":" + (d - 1)); }
        }
        if (d <= DAYS && plan[sf.id]?.[d] && onVac(sf, d)) bad.add(sf.id + ":" + d);
      }
    });
    return bad;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, cfg, staff, DAYS]);

  // Цифра покрытия догоняет настоящее значение за полсекунды — так видно,
  // что генератор отработал, а не просто перерисовалась таблица.
  React.useEffect(() => {
    if (calmMotion()) { setCovShown(covTarget.current); return; }
    let raf = 0; const from = covShown, to = covTarget.current, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 520);
      const e = 1 - Math.pow(1 - k, 3);
      setCovShown(Math.round(from + (to - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [genKey, mkey, weekIdx]);

  const tapCell = (s, d) => {
    if (!isAdmin) return;
    // Режим обмена: две тапнутые клетки меняются содержимым. Самая частая
    // просьба смены — «поменяйся со мной» — решается двумя касаниями.
    if (swap) {
      if (!swapSel) { setSwapSel({ id: s.id, d }); vibrate("light"); return; }
      if (swapSel.id === s.id && swapSel.d === d) { setSwapSel(null); return; }
      const a = swapSel, b = { id: s.id, d };
      const va = plan[a.id]?.[a.d] || "", vb = plan[b.id]?.[b.d] || "";
      snapUndo();
      setPlan(p => {
        // Последовательно, через промежуточный объект: так обмен корректен
        // и когда обе клетки принадлежат одному сотруднику.
        const nx = { ...p };
        const ra = { ...(nx[a.id] || {}) }; ra[a.d] = vb; nx[a.id] = ra;
        const rb = { ...(nx[b.id] || {}) }; rb[b.d] = va; nx[b.id] = rb;
        return nx;
      });
      setLocks(l => {
        if (a.id === b.id) {
          const mine = { ...(l[a.id] || {}) };
          if (vb) mine[a.d] = 1; else delete mine[a.d];
          if (va) mine[b.d] = 1; else delete mine[b.d];
          return { ...l, [a.id]: mine };
        }
        const la = { ...(l[a.id] || {}) }, lb = { ...(l[b.id] || {}) };
        if (vb) la[a.d] = 1; else delete la[a.d];
        if (va) lb[b.d] = 1; else delete lb[b.d];
        return { ...l, [a.id]: la, [b.id]: lb };
      });
      setSwapSel(null); setDirty(true); vibrate("success");
      return;
    }
    const keys = ["", ...(cfg.shifts || []).map(x => x.k)];
    const cur = plan[s.id]?.[d] || "";
    const nx = keys[(keys.indexOf(cur) + 1) % keys.length];
    setPlan(p => ({ ...p, [s.id]: { ...(p[s.id] || {}), [d]: nx } }));
    // Пустая клетка снимает и замок: иначе случайный тап закреплял бы
    // пустоту навсегда, а генератор обходил бы её стороной. Снять такой
    // замок можно было только сбросом всех закреплений месяца.
    setLocks(l => {
      const mine = { ...(l[s.id] || {}) };
      if (nx) mine[d] = 1; else delete mine[d];
      return { ...l, [s.id]: mine };
    });
    setDirty(true);
  };

  const P = a11y
    ? { text:"#2A1F0E", sub:"#6B5B40", acc:"#7A5A22", warn:"#A33A2A",
        danger:"#8B3020", dangerBg:"#A33A2A", dangerFg:"#FFF4F1" }
    : { text:CREAM, sub:MUTED_2, acc:GOLD_SOFT, warn:"#E09090",
        danger:"#E09090", dangerBg:"#C04A4A", dangerFg:"#FFF1F1" };

  // ── Оформление ────────────────────────────────────────────────────
  const card = {
    margin: 14, padding: 14, borderRadius: RADIUS.lg,
    background: T.lessGlass?.bg || (a11y ? "rgba(250,242,222,0.72)" : "rgba(226,186,116,0.11)"),
    border: T.lessGlass?.border || `1px solid ${a11y ? "rgba(175,140,65,0.26)" : "rgba(145,108,40,0.36)"}`,
    borderTop: T.lessGlass?.borderTop || `1px solid ${a11y ? "rgba(255,240,200,0.8)" : "rgba(210,168,65,0.44)"}`,
    boxShadow: T.lessGlass?.shadow || "inset 0 0 22px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 20px rgba(0,0,0,0.38)",
  };
  const btn = { flex:1, padding:12, border:"none", borderRadius:RADIUS.md, cursor:"pointer",
    fontFamily:serif, fontSize:13.5, fontWeight:"bold", background:GOLD, color:INK_DEEP };
  const ghost = { ...btn, background:"transparent", border:`1px solid ${GOLD}66`, color:GOLD, fontWeight:"normal" };
  const eyebrow = { fontFamily:mono, fontSize:9, letterSpacing:3, textTransform:"uppercase",
    color:P.sub, display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:10 };

  const shell = kids => (
    <div className="sa-schedwrap"
      onBlurCapture={() => { try { window.scrollTo(0, 0); } catch (_) {} }}
      style={{
      position:"fixed", inset:0, zIndex:1000, display:"flex", flexDirection:"column",
      background: a11y ? "#E8DEC8" : "linear-gradient(160deg,#14110A 0%,#1C1509 50%,#14110A 100%)",
      overflowY:"auto", WebkitOverflowScrolling:"touch", overscrollBehavior:"contain",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"44px 18px 4px" }}>
        <button className="sa-btn" style={{ background:"transparent", border:"none", color:GOLD,
          fontSize:26, cursor:"pointer", lineHeight:1, padding:"0 6px 4px 0", fontFamily:serif }}
          onClick={onBack} aria-label="Назад">‹</button>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:mono, fontSize:9, letterSpacing:3, textTransform:"uppercase", color:P.sub }}>График</div>
          <div style={{ color:P.text, fontSize:16, fontFamily:serif }}>{MONTHS_N[M]} {Y}</div>
        </div>
      </div>
      {kids}
      <div style={{ height:24 }} />
    </div>
  );

  if (state === "load") return shell(<div style={{ ...card, textAlign:"center", color:P.sub }}>Загружаю график…</div>);
  if (state === "error") return shell(
    <div style={{ ...card }}>
      <div style={{ color:P.warn, marginBottom:6, fontSize:15 }}>{msg}</div>
      <div style={{ fontSize:11.5, color:P.sub, lineHeight:1.55, marginBottom:12 }}>
        Ресторан в профиле: «{profile?.restaurant || "не задан"}» · месяц {mkey}
      </div>
      {dbg ? (
        <div style={{ fontFamily:mono, fontSize:10, lineHeight:1.5, color:P.sub, wordBreak:"break-all",
          padding:"9px 11px", borderRadius:10, marginBottom:12,
          background: a11y ? "rgba(120,90,30,0.07)" : "rgba(0,0,0,0.28)",
          border:`1px solid ${a11y ? "rgba(175,140,65,0.22)" : "rgba(145,108,40,0.28)"}` }}>{dbg}</div>
      ) : null}
      <button style={ghost} className="sa-btn" onClick={load}>Попробовать снова</button>
    </div>
  );

  const monthNav = (
    <div style={{ display:"flex", alignItems:"center", gap:8, margin:"12px 14px 0" }}>
      <button className="sa-btn" style={{ ...ghost, flex:"0 0 auto", width:40, height:40, padding:0, fontSize:17 }}
        onClick={() => { const m = M - 1; if (m < 0) { setM(11); setY(Y - 1); } else setM(m); }}>‹</button>
      <div style={{ flex:1, textAlign:"center" }}>
        <div style={{ fontSize:16, color:P.text }}>{MONTHS_N[M]} {Y}</div>
        <div style={{ fontFamily:mono, fontSize:9, letterSpacing:1.5, color:P.sub }}>{DAYS} дней</div>
      </div>
      <button className="sa-btn" style={{ ...ghost, flex:"0 0 auto", width:40, height:40, padding:0, fontSize:17 }}
        onClick={() => { const m = M + 1; if (m > 11) { setM(0); setY(Y + 1); } else setM(m); }}>›</button>
    </div>
  );

  // ── Выгрузка графика картинкой ────────────────────────────────────
  // Рисуем на canvas вручную: внутри Telegram печать в PDF недоступна,
  // а PNG открывается прямо в чате и не требует ни сервера, ни библиотек.

  // Для печати рисуем заведомо монохромно: на чёрно-белом принтере красный
  // и зелёный превращаются в одинаковый серый, поэтому смысл несут
  // не цвета, а начертание и пометки.
  const drawExport = (forPrint = false) => {
    const C = forPrint ? {
      bg:"#FFFFFF", text:"#111111", dim:"#444444", faint:"#8A8A8A",
      grpBg:"#E6E6E6", weBg:"#F1F1F1", line:"#B8B8B8", lineHard:"#6E6E6E",
      bad:"#000000", good:"#444444", hol:"#000000", empty:"#BDBDBD",
    } : {
      bg:"#FBF7EE", text:"#2A1F0E", dim:"#6B5B40", faint:"#8A7A5C",
      grpBg:"#EFE4CB", weBg:"#FAF5E9", line:"#DED3BC", lineHard:"#CDBF9F",
      bad:"#A33A2A", good:"#4A6B4A", hol:"#A33A2A", empty:"#CFC5AE",
    };
    const S = 2;                                     // множитель под ретину
    const NAME = 150, CELL = 34, ROW = 30, HEAD = 96, FOOT = 64;
    const groups = POS.map(p => ({ ...p, list: staff.filter(x => x.pos === p.id) })).filter(g => g.list.length);
    // Экспорт без строки «есть/нужно» в ОБЕИХ версиях: полотно — витрина
    // для команды, аудит недоборов живёт в таблице приложения
    const rows = groups.reduce((a, g) => a + g.list.length + 1, 0);
    const W = NAME + DAYS * CELL;
    const H = HEAD + rows * ROW + FOOT;

    const cv = document.createElement("canvas");
    cv.width = W * S; cv.height = H * S;
    const x = cv.getContext("2d");
    x.scale(S, S);
    x.textBaseline = "middle";

    // фон и шапка
    x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
    x.fillStyle = C.text; x.font = "600 21px Georgia, serif";
    x.fillText("График смен", 16, 30);
    x.fillStyle = C.dim; x.font = "13px Georgia, serif";
    x.fillText(`${profile?.restaurant || ""} · ${MONTHS_N[M]} ${Y} · ${staff.length} сотрудников`, 16, 54);
    // Вордмарк и служебная строка — правым краем: слева им тесно
    // (строка «составлен» упиралась в числа первых дней)
    x.fillStyle = C.faint; x.font = "600 10px ui-monospace, Menlo, monospace";
    const wm = "S E R V I C E   A C A D E M Y";
    x.fillText(wm, W - 16 - x.measureText(wm).width, 30);
    x.fillStyle = C.dim; x.font = "12px Georgia, serif";
    const made = `составлен ${new Date().toLocaleDateString("ru-RU")} · ген 3`;
    x.fillText(made, W - 16 - x.measureText(made).width, 50);
    // Диагностика конфига из экспорта убрана (Доп. 54): аудит живёт в
    // таблице приложения, полотно — чистая витрина для команды.
    // Золотая линия отделяет шапку от полотна (в печати — серая)
    x.strokeStyle = forPrint ? C.lineHard : "#C8A96E"; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, HEAD - 26); x.lineTo(W, HEAD - 26); x.stroke();

    // шапка дней
    let y = HEAD;
    x.font = "11px ui-monospace, Menlo, monospace";
    for (let d = 1; d <= DAYS; d++) {
      const cx = NAME + (d - 1) * CELL, w = dow(d);
      if (w >= 5 || holOf(d)) { x.fillStyle = C.weBg; x.fillRect(cx, y - 24, CELL, 24); }
      x.fillStyle = holOf(d) ? C.hol : C.text;
      if (holOf(d)) x.font = "600 11px ui-monospace, Menlo, monospace";
      x.fillText(String(d), cx + CELL / 2 - (d > 9 ? 7 : 3.5), y - 16);
      x.font = "11px ui-monospace, Menlo, monospace";
      x.fillStyle = C.faint;
      x.fillText(holOf(d) ? "•" + DOWL[w] : DOWL[w], cx + CELL / 2 - (holOf(d) ? 10 : 7), y - 5);
    }

    const line = (yy, c = C.line) => { x.strokeStyle = c; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, yy + .5); x.lineTo(W, yy + .5); x.stroke(); };
    const kColor = (k) => forPrint ? C.text : (k === "В" ? "#8A6520" : k === "У" ? "#4A6B4A" : C.text);
    // Чипы под редкими буквами (только чат-версия): «Д» — спокойный текст,
    // остальные буквы глаз выхватывает по цвету, не вглядываясь
    const CHIP = forPrint ? null : {
      "В": { bg: "rgba(138,101,32,0.16)", fg: "#6E4F14" },
      "У": { bg: "rgba(74,107,74,0.16)",  fg: "#3E5C3E" },
      "К": { bg: "rgba(90,74,110,0.16)",  fg: "#55446B" },
      "О": { bg: "rgba(163,58,42,0.11)",  fg: C.hol },
    };
    const rr = (x0, y0, w, h, r) => { x.beginPath();
      x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
      x.arcTo(x0 + w, y0 + h, x0, y0 + h, r); x.arcTo(x0, y0 + h, x0, y0, r);
      x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); };

    groups.forEach(g => {
      // заголовок должности
      x.fillStyle = C.grpBg; x.fillRect(0, y, W, ROW);
      x.fillStyle = C.text; x.font = "600 11px ui-monospace, Menlo, monospace";
      x.fillText(g.t.toUpperCase(), 12, y + ROW / 2);
      line(y); line(y + ROW); y += ROW;

      // люди
      g.list.forEach((s, si) => {
        let h = 0;
        for (let d = 1; d <= DAYS; d++) { const sh = shiftOf(plan[s.id]?.[d]); if (sh) h += len(sh); }
        // Зебра чётных строк — глазу легче вести длинную строку (не в печати)
        if (!forPrint && si % 2 === 1) { x.fillStyle = "rgba(43,31,14,0.03)"; x.fillRect(0, y + 1, W, ROW - 1); }
        x.fillStyle = C.text; x.font = "13px Georgia, serif";
        x.fillText(s.name.length > 17 ? s.name.slice(0, 16) + "…" : s.name, 12, y + ROW / 2 - 5);
        const en = effNorm(s);
        x.fillStyle = C.faint; x.font = "10px ui-monospace, Menlo, monospace";
        x.fillText(`${h} / ${en} ч${en !== s.norm ? "*" : ""}`, 12, y + ROW / 2 + 8);
        for (let d = 1; d <= DAYS; d++) {
          const cx = NAME + (d - 1) * CELL;
          // +1/-1: заливка не съедает горизонтальные линии (прод-артефакт
          // «линия прерывается» — fillRect ложился ровно на штрих)
          if (dow(d) >= 5 || holOf(d)) { x.fillStyle = C.weBg; x.fillRect(cx, y + 1, CELL, ROW - 1); }
          const k = plan[s.id]?.[d] || "";
          const vac = onVac(s, d), fix = !k && !vac && (s.off || []).includes(dow(d));
          const glyph = k || (vac ? "О" : fix ? "✕" : "·");
          const chip = CHIP && CHIP[glyph];
          if (chip) { x.fillStyle = chip.bg; rr(cx + 5, y + 5, CELL - 10, ROW - 10, 6); x.fill(); }
          x.font = "600 13px ui-monospace, Menlo, monospace";
          x.fillStyle = chip ? chip.fg : k ? kColor(k) : vac ? C.hol : fix ? C.dim : C.empty;
          x.fillText(glyph, cx + CELL / 2 - 5, y + ROW / 2);
        }
        line(y + ROW); y += ROW;
      });

      line(y, C.lineHard);   // жирная граница группы
    });

    // вертикальные линии недель
    x.strokeStyle = C.lineHard;
    for (let d = 1; d <= DAYS; d++) if (dow(d) === 0) {
      const cx = NAME + (d - 1) * CELL;
      x.beginPath(); x.moveTo(cx + .5, HEAD - 26); x.lineTo(cx + .5, y); x.stroke();
    }
    x.beginPath(); x.moveTo(NAME + .5, HEAD - 26); x.lineTo(NAME + .5, y); x.stroke();

    // подвал: расшифровка смен (буквы — в цветах сетки) + диагностика
    const legend = (cfg.shifts || []).map(sh => ({
      mark: sh.k, mc: kColor(sh.k),
      rest: ` — ${sh.name} ${sh.from}:00–${sh.to > 24 ? sh.to - 24 : sh.to}:00${sh.extra ? " (вручную)" : ""}`,
    })).concat([{ mark: "О", mc: C.hol, rest: " — отпуск" }, { mark: "✕", mc: C.dim, rest: " — постоянный выходной" }]);
    let lx = 12, ly = y + 22;
    legend.forEach(t => {
      x.font = "600 11px ui-monospace, Menlo, monospace";
      const wMark = x.measureText(t.mark).width;
      x.font = "11px Georgia, serif";
      const w = wMark + x.measureText(t.rest).width + 18;
      if (lx + w > W - 12) { lx = 12; ly += 17; }
      const lchip = CHIP && CHIP[t.mark];
      if (lchip) { x.fillStyle = lchip.bg; rr(lx - 4, ly - 8, wMark + 8, 16, 5); x.fill(); }
      x.fillStyle = lchip ? lchip.fg : t.mc; x.font = "600 11px ui-monospace, Menlo, monospace";
      x.fillText(t.mark, lx, ly);
      x.fillStyle = C.dim; x.font = "11px Georgia, serif";
      x.fillText(t.rest, lx + wMark, ly);
      lx += w;
    });
    return cv;
  };

  // Лист A4 в альбомной: содержимое вписывается по центру с полями.
  // Пропорции листа важны, иначе принтер добавит свои поля и всё уедет.
  const toSheet = (src) => {
    const W = 3508, H = 2480, M = 110;               // A4 альбомная при 300 точках на дюйм
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, W, H);
    const k = Math.min((W - M * 2) / src.width, (H - M * 2) / src.height);
    const w = src.width * k, h = src.height * k;
    x.imageSmoothingQuality = "high";
    x.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
    return cv;
  };

  const exportImage = async (mode = shotMode) => {
    if (!staff.length) return;
    setShotBusy(true); setShotMode(mode);
    try {
      const base = drawExport(mode === "a4");
      const cv = mode === "a4" ? toSheet(base) : base;
      const blob = await new Promise(res => cv.toBlob(res, "image/png"));
      const name = `График_${MONTHS_N[M]}_${Y}${mode === "a4" ? "_A4" : ""}.png`.replace(/\s/g, "_");
      const url = URL.createObjectURL(blob);
      setShot({ url, blob, name });
      vibrate("success");
    } catch (e) { setMsg("Не удалось собрать картинку"); setTimeout(() => setMsg(""), 2500); }
    setShotBusy(false);
  };

  // «Мои смены» картинкой: сотрудник сохраняет свой месяц себе или семье.
  // Заметки попадают в картинку — чаевые и пометки останутся под рукой.
  const drawMyExport = (me) => {
    const C = { bg:"#FBF7EE", text:"#2A1F0E", dim:"#6B5B40", faint:"#8A7A5C",
      line:"#DED3BC", we:"#F3EDDD", hol:"#A33A2A", acc:"#7A5A22" };
    const S = 2, W = 430, ROWH = 30, HEAD = 92, FOOT = 34;
    const H = HEAD + DAYS * ROWH + FOOT;
    const cv = document.createElement("canvas");
    cv.width = W * S; cv.height = H * S;
    const x = cv.getContext("2d"); x.scale(S, S); x.textBaseline = "middle";
    x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
    x.fillStyle = C.text; x.font = "600 19px Georgia, serif";
    x.fillText("Мои смены", 16, 28);
    const bd = breakdownOf(me);
    x.fillStyle = C.dim; x.font = "12.5px Georgia, serif";
    x.fillText(`${me.name} · ${MONTHS_N[M]} ${Y}`, 16, 50);
    x.fillText(`${profile?.restaurant || ""} · ${bd.shifts} смен · ${bd.hours} из ${effNorm(me)} ч`, 16, 69);
    let y = HEAD;
    for (let d = 1; d <= DAYS; d++) {
      const k = plan[me.id]?.[d], sh = k && shiftOf(k), vac = onVac(me, d), w = dow(d), note = notes[d];
      if (w >= 5 || holOf(d)) { x.fillStyle = C.we; x.fillRect(0, y, W, ROWH); }
      x.font = "11px ui-monospace, Menlo, monospace";
      x.fillStyle = holOf(d) ? C.hol : C.dim;
      x.fillText(`${String(d).padStart(2, " ")} ${DOWL[w]}`, 16, y + ROWH / 2);
      const main = sh ? `${sh.name} · ${sh.from}:00–${sh.to > 24 ? sh.to - 24 : sh.to}:00`
        : vac ? "Отпуск" : "";
      x.font = sh ? "13px Georgia, serif" : "italic 12px Georgia, serif";
      x.fillStyle = sh ? C.text : vac ? C.hol : C.faint;
      x.fillText(main || "—", 74, y + ROWH / 2 - (note ? 6 : 0));
      if (note) {
        x.font = "italic 10px Georgia, serif"; x.fillStyle = C.acc;
        const t = note.replace(/\s+/g, " ");
        x.fillText("✎ " + (t.length > 44 ? t.slice(0, 43) + "…" : t), 74, y + ROWH / 2 + 8);
      }
      if (sh) {
        x.font = "11px ui-monospace, Menlo, monospace"; x.fillStyle = C.acc;
        x.fillText(len(sh) + " ч", W - 42, y + ROWH / 2);
      }
      x.strokeStyle = C.line; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, y + ROWH + .5); x.lineTo(W, y + ROWH + .5); x.stroke();
      y += ROWH;
    }
    x.fillStyle = C.faint; x.font = "10.5px Georgia, serif";
    x.fillText(`составлено ${new Date().toLocaleDateString("ru-RU")}`, 16, y + 20);
    return cv;
  };
  const exportMy = async (me) => {
    setShotBusy(true);
    try {
      const cv = drawMyExport(me);
      const blob = await new Promise(res => cv.toBlob(res, "image/png"));
      const name = `Мои_смены_${MONTHS_N[M]}_${Y}.png`.replace(/\s/g, "_");
      setShot({ url: URL.createObjectURL(blob), blob, name });
      vibrate("success");
    } catch (e) { setMsg("Не удалось собрать картинку"); setTimeout(() => setMsg(""), 2500); }
    setShotBusy(false);
  };

  const shareShot = async () => {
    if (!shot) return;
    try {
      const file = new File([shot.blob], shot.name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `График · ${MONTHS_N[M]} ${Y}` });
        return;
      }
    } catch (e) {}
    // Запасной путь: обычное скачивание
    const a = document.createElement("a");
    a.href = shot.url; a.download = shot.name; a.click();
  };

  // ── Редактор настроек ─────────────────────────────────────────────
  // Компоненты полей вынесены на уровень модуля: объявленные внутри,
  // они пересоздавались на каждый рендер, React размонтировал поле,
  // и клавиатура закрывалась на первом же нажатии.
  const inp = INP(a11y, P);
  const rowStyle = ROW(a11y);
  const hintStyle = { fontSize:11, color:P.sub, marginTop:8, fontStyle:"italic", lineHeight:1.5 };

  const setupView = () => {
    // Сводки для свёрнутых секций: закрытая секция отвечает «что настроено»,
    // открытая — «что это значит». Обзор всех настроек без единого тапа.
    const sum1 = `с ${Math.min(...cfg.hours.map(h => h[0]))}:00 до ${Math.max(...cfg.hours.map(h => h[1]))}:00`;
    const sum2 = `${cfg.shifts.map(x => x.k).join(" ")} · авто: ${cfg.shifts.filter(x => !x.extra).length}`;
    const sum3 = [1, 2, 3].map(l => Object.values(cfg.need[l] || {}).reduce((a, v) => a + (v || 0), 0)).join(" / ") + " чел.";
    const sum4 = `пик: ${cfg.rules.peakDows.map(w => DOWL[w]).join(",") || "—"} · до ${cfg.rules.maxRow} подряд · отдых ${cfg.rules.minRest} ч`;
    const nVac = staff.filter(vacOn).length;
    const sum5 = `${staff.length} чел.` + (nVac ? ` · в отпуске: ${nVac}` : "");
    return (
    <div style={card}>
      <div style={eyebrow}><span>Настройки графика</span><span style={{ color:P.acc }}>{staff.length} чел.</span></div>

      {/* Паспорт заведения: контекст до того, как открыл хоть одну секцию */}
      <div style={{ ...card, marginBottom:10, padding:"12px 14px" }}>
        <div style={{ fontFamily:serif, fontSize:15, color:P.text, marginBottom:6 }}>
          {profile?.restaurant || "Заведение"}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap", fontSize:11, color:P.sub }}>
          <span>👥 {staff.length} {staff.length % 10 === 1 && staff.length % 100 !== 11 ? "сотрудник" : [2,3,4].includes(staff.length % 10) && ![12,13,14].includes(staff.length % 100) ? "сотрудника" : "сотрудников"}</span>
          <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
            {(cfg.shifts || []).map((sh2, i2) => {
              const c2 = SHIFT_COLORS[i2 % SHIFT_COLORS.length];
              return <span key={sh2.k} style={{ width:15, height:15, borderRadius:4, display:"grid", placeItems:"center",
                fontSize:8.5, color: a11y ? c2.fgL : c2.fg, background: a11y ? c2.bgL : c2.bg,
                border:`1px solid ${a11y ? c2.bdL : c2.bd}` }}>{sh2.k}</span>;
            })}
          </span>
          {(() => {
            const sums = [1, 2, 3].map(l => POS.reduce((a, pp) => a + ((cfg.need?.[l] || {})[pp.id] || 0), 0)).filter(Boolean);
            if (!sums.length) return null;
            const lo = Math.min(...sums), hi = Math.max(...sums);
            return <span>в день: {lo === hi ? lo : `${lo}–${hi}`} чел</span>;
          })()}
        </div>
      </div>
      <Sec no={1} title="Часы работы" hint={openSec===1 ? "Когда открываемся и закрываемся в каждый день недели" : sum1} P={P} open={openSec===1} onToggle={() => setOpenSec(openSec===1?0:1)}>
        {DOWL.map((dl, i) => (
          <div key={i} style={rowStyle}>
            <span style={{ flex:"0 0 40px", fontSize:12.5, color:P.sub }}>{dl}</span>
            <Num inp={inp} v={cfg.hours[i][0]} min={0} max={23} set={v => patch(c => { c.hours[i][0] = v; })} />
            <span style={{ color:P.sub }}>—</span>
            <Num inp={inp} v={cfg.hours[i][1]} min={1} max={30} set={v => patch(c => { c.hours[i][1] = v; })} />
            <span style={{ fontSize:11, color:P.sub }}>
              {(cfg.hours[i][1] < cfg.hours[i][0] ? cfg.hours[i][1] + 24 : cfg.hours[i][1]) - cfg.hours[i][0]} ч
              {cfg.hours[i][1] > 24 ? " (до утра)" : ""}
            </span>
          </div>
        ))}
        <div style={hintStyle}>Работу после полуночи пишем как 25 или 26 — это час и два ночи.</div>
      </Sec>

      <Sec no={2} title="Смены" hint={openSec===2 ? "Во сколько люди приходят и уходят" : sum2} P={P} open={openSec===2} onToggle={() => setOpenSec(openSec===2?0:2)}>
        {cfg.shifts.map((sh, i) => (
          <div key={i} style={{ ...rowStyle, flexWrap:"wrap" }}>
            <Text inp={inp} v={sh.k} maxLength={2} style={{ width:44, textAlign:"center" }}
              set={val => patch(c => { c.shifts[i].k = val.toUpperCase().slice(0,2); })} />
            <Text inp={inp} v={sh.name} style={{ flex:1 }}
              set={val => patch(c => { c.shifts[i].name = val; })} />
            <Num inp={inp} v={sh.from} min={0} max={23} set={v => patch(c => { c.shifts[i].from = v; })} />
            <Num inp={inp} v={sh.to} min={1} max={30} set={v => patch(c => { c.shifts[i].to = v; })} />
            <span style={{ fontSize:11, color:P.acc }}>{len(sh)} ч</span>
            <Pill a11y={a11y} P={P} on={!!sh.extra} onClick={() => patch(c => { c.shifts[i].extra = sh.extra ? 0 : 1; })}>
              {sh.extra ? "вручную" : "авто"}
            </Pill>
            <button className="sa-btn" title="Удалить смену" onClick={() => patch(c => { c.shifts.splice(i, 1); })}
              style={{ flex:"0 0 32px", width:32, height:32, minWidth:32, boxSizing:"border-box",
                background:"transparent", border:`1px solid ${P.danger}66`, color:P.danger,
                borderRadius:9, fontSize:12, cursor:"pointer", fontFamily:serif, lineHeight:1,
                padding:0, display:"grid", placeItems:"center" }}>✕</button>
          </div>
        ))}
        <button className="sa-btn" style={{ ...ghost, marginTop:10, padding:"8px 12px", fontSize:12 }}
          onClick={() => patch(c => { c.shifts.push({ k:"С" + (c.shifts.length+1), name:"Новая смена", from:12, to:20 }); })}>
          + добавить смену
        </button>
        <div style={hintStyle}>Порядок важен: первого человека на позицию ставим в первую смену. Режим «вручную» — смена, которую автозаполнение не расставляет: так помечают кейтеринг.</div>
      </Sec>

      <Sec no={3} title="Сколько людей нужно" hint={openSec===3 ? "Разное количество в будни, выходные и праздники" : sum3} P={P} open={openSec===3} onToggle={() => setOpenSec(openSec===3?0:3)}>
        <div style={{ display:"flex", gap:8, fontFamily:mono, fontSize:8.5, letterSpacing:1.2,
          textTransform:"uppercase", color:P.sub, paddingBottom:4 }}>
          <span style={{ flex:1 }}>позиция</span>
          {["обычный","высокий","пик"].map(x => <span key={x} style={{ flex:"0 0 56px", textAlign:"center" }}>{x}</span>)}
        </div>
        {POS.map(({ id, t }) => (
          <div key={id} style={rowStyle}>
            <span style={{ flex:1, fontSize:12.5, color:P.sub }}>{t}</span>
            {[1,2,3].map(lvl => (
              <Num key={lvl} inp={inp} v={cfg.need[lvl]?.[id] || 0} min={0} max={9}
                set={v => patch(c => { if (!c.need[lvl]) c.need[lvl] = {}; c.need[lvl][id] = v; })} />
            ))}
          </div>
        ))}
      </Sec>

      <Sec no={4} title="Правила смен" hint={openSec===4 ? "Загрузка по дням недели, выходные и отдых" : sum4} P={P} open={openSec===4} onToggle={() => setOpenSec(openSec===4?0:4)}>
        <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.2, textTransform:"uppercase", color:P.sub, paddingBottom:4 }}>пиковые дни недели</div>
        <div style={{ display:"flex", gap:4, marginBottom:8 }}>
          {DOWL.map((dl, wi) => (
            <Pill a11y={a11y} P={P} key={wi} on={cfg.rules.peakDows.includes(wi)} style={{ flex:1, padding:"6px 0" }}
              onClick={() => patch(c => {
                c.rules.peakDows = c.rules.peakDows.includes(wi)
                  ? c.rules.peakDows.filter(x => x !== wi) : [...c.rules.peakDows, wi];
                c.rules.highDows = c.rules.highDows.filter(x => x !== wi);
              })}>{dl}</Pill>
          ))}
        </div>
        <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.2, textTransform:"uppercase", color:P.sub, paddingBottom:4 }}>высокие дни</div>
        <div style={{ display:"flex", gap:4, marginBottom:8 }}>
          {DOWL.map((dl, wi) => (
            <Pill a11y={a11y} P={P} key={wi} on={cfg.rules.highDows.includes(wi)} style={{ flex:1, padding:"6px 0",
              opacity: cfg.rules.peakDows.includes(wi) ? .35 : 1 }}
              onClick={() => { if (cfg.rules.peakDows.includes(wi)) return; patch(c => {
                c.rules.highDows = c.rules.highDows.includes(wi)
                  ? c.rules.highDows.filter(x => x !== wi) : [...c.rules.highDows, wi];
              }); }}>{dl}</Pill>
          ))}
        </div>
        <div style={rowStyle}>
          <Field label="смен подряд" P={P}><Num inp={inp} v={cfg.rules.maxRow} min={1} max={14} set={v => patch(c => { c.rules.maxRow = v; })} /></Field>
          <Field label="выходных в неделю" P={P}><Num inp={inp} v={cfg.rules.minOff} min={0} max={4} set={v => patch(c => { c.rules.minOff = v; })} /></Field>
          <Field label="отдых, ч" P={P}><Num inp={inp} v={cfg.rules.minRest} min={0} max={24} set={v => patch(c => { c.rules.minRest = v; })} /></Field>
        </div>
        <div style={{ marginTop:8 }}>
          <Pill a11y={a11y} P={P} on={cfg.rules.holidayPeak} onClick={() => patch(c => { c.rules.holidayPeak = !c.rules.holidayPeak; })}>
            {cfg.rules.holidayPeak ? "праздники считаем пиком" : "праздники как обычный день"}
          </Pill>
        </div>

        <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.2, textTransform:"uppercase",
          color:P.sub, padding:"14px 0 5px" }}>что означает норма часов</div>
        <div style={{ display:"flex", gap:6 }}>
          {[["floor","обязательный минимум"],["cap","потолок"]].map(([v, t]) => (
            <Pill key={v} a11y={a11y} P={P} on={(cfg.rules.normMode || "floor") === v} style={{ flex:1, padding:"8px 6px" }}
              onClick={() => patch(c => { c.rules.normMode = v; })}>{t}</Pill>
          ))}
        </div>
        <div style={hintStyle}>
          {(cfg.rules.normMode || "floor") === "floor"
            ? "Норму нужно выработать, всё сверху — законная переработка. Генератор закрывает смены до конца месяца и делит их поровну по числу рабочих дней."
            : "Норму превышать нельзя. Генератор скорее оставит смену незакрытой, чем выведет человека сверх нормы."}
        </div>
        <div style={hintStyle}>Эти правила генератор не нарушает: он скорее оставит смену незакрытой, чем поставит человека сверх предела.</div>

        <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.2, textTransform:"uppercase",
          color:P.sub, padding:"14px 0 5px" }}>как выходит каждая позиция</div>
        {POS.map(({ id, t }) => {
          const pat = (cfg.posRules?.[id]?.pattern) || "even";
          return (
            <div key={id} style={{ ...rowStyle }}>
              <span style={{ flex:1, fontSize:12.5, color:P.sub }}>{t}</span>
              {[["2x2","2 / 2"],["even","поровну"]].map(([v, lbl]) => (
                <Pill key={v} a11y={a11y} P={P} on={pat === v} style={{ flex:"0 0 82px", padding:"6px 0" }}
                  onClick={() => patch(c => {
                    if (!c.posRules) c.posRules = {};
                    c.posRules[id] = { ...(c.posRules[id] || {}), pattern: v };
                  })}>{lbl}</Pill>
              ))}
            </div>
          );
        })}
        <div style={hintStyle}>«2 / 2» — жёсткий цикл: два дня работает, два отдыхает, смещение у каждого своё.
          «Поровну» — генератор делит смены по недобору часов и старается склеивать выходные по два подряд.</div>

        <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.2, textTransform:"uppercase",
          color:P.sub, padding:"14px 0 5px" }}>основная смена</div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {(cfg.shifts || []).filter(x => !x.extra).map(sh => (
            <Pill key={sh.k} a11y={a11y} P={P} on={(cfg.dayShift || "Д") === sh.k} style={{ flex:"1 1 auto", padding:"7px 10px" }}
              onClick={() => patch(c => { c.dayShift = sh.k; })}>{sh.k} · {sh.name}</Pill>
          ))}
        </div>
        <div style={hintStyle}>Её получают все позиции по умолчанию.</div>

        <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.2, textTransform:"uppercase",
          color:P.sub, padding:"14px 0 5px" }}>разбивка по сменам</div>
        {POS.map(({ id, t }) => {
          const sp = (cfg.split || {})[id];
          const total = Math.max(...[1,2,3].map(l => cfg.need[l]?.[id] || 0));
          if (!total) return null;
          const sum = sp ? Object.values(sp).reduce((a, v) => a + (v || 0), 0) : 0;
          return (
            <div key={id} style={{ ...rowStyle, flexWrap:"wrap" }}>
              <span style={{ flex:"1 1 100%", fontSize:12.5, color:P.sub, marginBottom:4 }}>
                {t}
                {sp ? <span style={{ color: sum === total ? P.acc : P.warn }}> · {sum} из {total}</span>
                    : <span style={{ color:P.sub }}> · все в основную смену</span>}
              </span>
              {(cfg.shifts || []).filter(x => !x.extra).map(sh => (
                <div key={sh.k} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ fontFamily:mono, fontSize:11, color:P.sub }}>{sh.k}</span>
                  <Num inp={inp} v={(sp && sp[sh.k]) || 0} min={0} max={20}
                    set={v => patch(c => {
                      if (!c.split) c.split = {};
                      const cur = { ...(c.split[id] || {}) };
                      if (v) cur[sh.k] = v; else delete cur[sh.k];
                      if (Object.keys(cur).length) c.split[id] = cur; else delete c.split[id];
                    })} />
                </div>
              ))}
            </div>
          );
        })}
        <div style={hintStyle}>Сколько человек в какой смене. Сумма должна совпадать с потребностью позиции —
          если не совпадает, цифра краснеет. Ноль везде означает, что все выходят в основную смену.</div>
      </Sec>

      <Sec no={5} title="Сотрудники" hint={openSec===5 ? "Кто работает, на какой позиции и сколько часов" : sum5} P={P} open={openSec===5} onToggle={() => setOpenSec(openSec===5?0:5)}>
        {staff.map((sf, i) => { const openE = openEmp === sf.id; return (
          <div key={sf.id} className="sa-schedemp" style={{ padding:10, borderRadius:12, marginBottom:7 }}>
            {/* Свёрнутая строка: обзор без простыни из десяти полей на человека */}
            <div onClick={() => { vibrate("light"); setOpenEmp(openE ? 0 : sf.id); }}
              {...onActivate(() => setOpenEmp(openE ? 0 : sf.id))}
              style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", minWidth:0 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13.5, color:P.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sf.name}</div>
                <div style={{ fontSize:10.5, color:P.sub }}>
                  {posName(sf.pos)} · {sf.norm} ч
                  {sf.phone ? " · ✆" : ""}
                  {vacOn(sf) ? " · отпуск" : ""}
                  {((sf.off || []).length || offDays(sf).length) ? " · есть выходные" : ""}
                </div>
              </div>
              <div style={{ color:P.sub, fontSize:15, transform: openE ? "rotate(90deg)" : "none",
                transition:"transform .25s" }}>›</div>
            </div>
            {openE ? (<>
            <div style={{ display:"flex", alignItems:"flex-end", gap:8, padding:"8px 0 2px", minWidth:0 }}>
              <Field label="имя" P={P}>
                <Text inp={inp} v={sf.name} style={{ width:"100%" }}
                  set={val => patch(c => { c.staff[i].name = val; })} />
              </Field>
              <button className="sa-btn" title="Удалить сотрудника"
                onClick={() => patch(c => { c.staff.splice(i, 1); })}
                style={{ flex:"0 0 34px", width:34, height:34, minWidth:34, boxSizing:"border-box",
                  background:"transparent", border:`1px solid ${P.danger}66`, color:P.danger,
                  borderRadius:9, fontSize:13, cursor:"pointer", fontFamily:serif, lineHeight:1,
                  padding:0, display:"grid", placeItems:"center" }}>✕</button>
            </div>
            <div style={{ ...rowStyle, borderTop:"none" }}>
              <Field label="должность" P={P}>
                <select value={sf.pos} style={{ ...inp, width:"100%" }} onFocus={focusScroll}
                  onChange={e => patch(c => { c.staff[i].pos = e.target.value; })}>
                  {POS.map(({ id, t }) => <option key={id} value={id}>{t}</option>)}
                </select>
              </Field>
              <Field label="норма, ч" P={P}>
                <Num inp={inp} v={sf.norm} min={0} max={320} set={v => patch(c => { c.staff[i].norm = v; })} />
              </Field>
            </div>
            <div style={{ ...rowStyle, borderTop:"none", display:"flex", gap:8 }}>
              <Field label="телефон · для связи" P={P}>
                <Text inp={inp} v={sf.phone || ""} maxLength={20} style={{ width:"100%" }}
                  set={val => patch(c => { c.staff[i].phone = val; })} />
              </Field>
              <Field label="ставка, ₽/ч" P={P}>
                <Num inp={inp} v={sf.rate || 0} min={0} max={20000}
                  set={v => patch(c => { c.staff[i].rate = v; })} />
              </Field>
            </div>

            {/* Отпуск задаётся числами того месяца, который открыт сейчас */}
            <div style={{ ...rowStyle, borderTop:"none" }}>
              <Field label={"отпуск с · " + MONTHS_R[M]} P={P}>
                <Num inp={inp} v={vacOn(sf) ? sf.vac[0] : 0} min={0} max={DAYS}
                  set={v => patch(c => {
                    c.staff[i].vac = v ? [v, Math.max(v, (vacOn(sf) ? sf.vac[1] : v)), mkey] : null;
                  })} />
              </Field>
              <Field label="по" P={P}>
                <Num inp={inp} v={vacOn(sf) ? sf.vac[1] : 0} min={0} max={DAYS}
                  set={v => patch(c => {
                    if (c.staff[i].vac) c.staff[i].vac[1] = Math.max(c.staff[i].vac[0], v);
                    else if (v) c.staff[i].vac = [v, v, mkey];   // «по» первым — тоже работает, а не теряется молча
                  })} />
              </Field>
              <Field label="статус" P={P}>
                <span style={{ fontFamily:mono, fontSize:9, letterSpacing:1, padding:"3px 8px",
                  borderRadius:999, display:"inline-block",
                  color: vacOn(sf) ? "#F0C0C0" : "#BFE6D0",
                  background: vacOn(sf) ? "rgba(224,120,120,.12)" : "rgba(93,187,138,.13)",
                  border:`1px solid ${vacOn(sf) ? "rgba(224,120,120,.35)" : "rgba(93,187,138,.35)"}` }}>
                  {vacOn(sf) ? "в отпуске" : "работает"}
                </span>
              </Field>
            </div>

            {/* Постоянные выходные: учёба, вторая работа, транспорт */}
            <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.2, textTransform:"uppercase",
              color:P.sub, padding:"8px 0 4px" }}>не работает в эти дни недели</div>
            <div style={{ display:"flex", gap:4 }}>
              {DOWL.map((dl, wi) => (
                <Pill key={wi} a11y={a11y} P={P} on={(sf.off || []).includes(wi)} style={{ flex:1, padding:"6px 0" }}
                  onClick={() => patch(c => {
                    const cur = c.staff[i].off || [];
                    c.staff[i].off = cur.includes(wi) ? cur.filter(x => x !== wi) : [...cur, wi];
                  })}>{dl}</Pill>
              ))}
            </div>
            {/* Выходные по конкретным датам — поверх недельного шаблона */}
            <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.2, textTransform:"uppercase",
              color:P.sub, padding:"10px 0 5px" }}>
              <span>выходные по датам · {MONTHS_R[M]}
                {offDays(sf).length ? <span style={{ color:P.acc }}> · выбрано {offDays(sf).length}</span> : null}</span>
              <button className="sa-btn" onClick={() => { setOffRange(!offRange); setOffAnchor(null); vibrate("light"); }}
                style={{ float:"right", padding:"3px 9px", borderRadius:8, cursor:"pointer", fontFamily:mono, fontSize:9,
                  letterSpacing:1, textTransform:"uppercase",
                  color: offRange ? INK_DEEP : P.sub,
                  background: offRange ? `linear-gradient(180deg,#E4C88C,${GOLD})` : "transparent",
                  border:`1px solid ${offRange ? GOLD : (a11y ? "rgba(175,140,65,.28)" : "rgba(145,108,40,.28)")}` }}>
                ↔ диапазон
              </button>
            </div>
            {offRange ? (
              <div style={{ fontSize:10.5, color:P.acc, fontStyle:"italic", marginBottom:6 }}>
                {offAnchor && offAnchor.i === i
                  ? `Начало: ${offAnchor.d} ${MONTHS_R[M]} — теперь тапни последний день`
                  : "Тапни первый и последний день — заполню всё между ними"}
              </div>
            ) : null}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:4 }}>
              {Array.from({ length: DAYS }, (_, k) => k + 1).map(d => {
                const on = offDays(sf).includes(d);
                const weekly = (sf.off || []).includes(dow(d));
                return (
                  <button key={d} className="sa-btn" disabled={weekly}
                    onClick={() => {
                      // Режим диапазона: первый тап — якорь, второй заливает всё
                      // между. Если вся полоса уже выбрана — второй тап её снимает.
                      if (offRange) {
                        if (!offAnchor || offAnchor.i !== i) { setOffAnchor({ i, d }); vibrate("light"); return; }
                        const lo = Math.min(offAnchor.d, d), hi = Math.max(offAnchor.d, d);
                        setOffAnchor(null);
                        patch(c => {
                          const st = c.staff[i];
                          if (!st.offDays) st.offDays = {};
                          const cur = new Set(st.offDays[mkey] || []);
                          const span = [];
                          for (let x = lo; x <= hi; x++) if (!(st.off || []).includes(dow(x))) span.push(x);
                          const allOn = span.every(x => cur.has(x));
                          span.forEach(x => allOn ? cur.delete(x) : cur.add(x));
                          st.offDays[mkey] = [...cur].sort((a, b) => a - b);
                          if (!st.offDays[mkey].length) delete st.offDays[mkey];
                        });
                        vibrate("success");
                        return;
                      }
                      patch(c => {
                        const st = c.staff[i];
                        if (!st.offDays) st.offDays = {};
                        const cur = st.offDays[mkey] || [];
                        st.offDays[mkey] = cur.includes(d) ? cur.filter(v => v !== d) : [...cur, d].sort((a, b) => a - b);
                        if (!st.offDays[mkey].length) delete st.offDays[mkey];
                      });
                    }}
                    style={{ padding:"7px 0", borderRadius:8, cursor: weekly ? "default" : "pointer",
                      fontFamily:mono, fontSize:11, opacity: weekly ? .35 : 1,
                      color: on ? INK_DEEP : (holOf(d) ? P.warn : P.sub),
                      background: on ? `linear-gradient(180deg,#E4C88C,${GOLD})` : "transparent",
                      border:`1px solid ${on ? GOLD : (a11y ? "rgba(175,140,65,.28)" : "rgba(145,108,40,.28)")}`,
                      boxShadow: (offAnchor && offAnchor.i === i && offAnchor.d === d)
                        ? `0 0 0 2px ${GOLD}, 0 0 8px ${GOLD}88` : undefined,
                      fontWeight: on ? "bold" : "normal" }}>{d}</button>
                );
              })}
            </div>
            <div style={{ fontSize:11, color:P.sub, marginTop:6, fontStyle:"italic", lineHeight:1.5 }}>
              Числа, в которые человек точно не выйдет. Дни, уже закрытые недельным шаблоном, погашены.
            </div>

            <div style={{ ...rowStyle, borderTop:"none", marginTop:4 }}>
              <Field label="не раньше, ч" P={P}>
                <Num inp={inp} v={sf.notBefore || 0} min={0} max={23}
                  set={v => patch(c => { c.staff[i].notBefore = v || 0; })} />
              </Field>
              <div style={{ flex:2, minWidth:0, fontSize:11, color:P.sub, alignSelf:"flex-end", paddingBottom:7 }}>
                {sf.notBefore ? `не ставим на смены раньше ${sf.notBefore}:00` : "ограничений по времени нет"}
              </div>
            </div>
            </>) : null}
          </div>
        ); })}
        <div style={{ marginTop:10, padding:"10px 12px", borderRadius:12,
          background: a11y ? "rgba(200,169,110,0.14)" : "rgba(200,169,110,0.10)",
          border:`1px solid ${a11y ? "rgba(175,140,65,0.3)" : "rgba(200,169,110,0.3)"}` }}>
          <div style={{ fontSize:12.5, color:P.text, lineHeight:1.55 }}>
            Норма {MONTHS_R[M]} при полной ставке — <b style={{ color:P.acc }}>{monthNorm(40)} ч</b>
            <span style={{ color:P.sub }}> · при 36 часах в неделю {monthNorm(36)} ч</span>
          </div>
          <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
            {[40, 36, 24].map(h => (
              <Pill key={h} a11y={a11y} P={P} on={false} style={{ flex:"1 1 auto" }}
                onClick={() => patch(c => { c.staff.forEach(x => { x.norm = monthNorm(h); }); })}>
                поставить всем {monthNorm(h)} ч
              </Pill>
            ))}
          </div>
        </div>

        <button className="sa-btn" style={{ ...ghost, marginTop:10, padding:"10px 12px", fontSize:12.5 }}
          onClick={() => {
            const nid = Math.max(0, ...(cfg.staff || []).map(x => +x.id || 0)) + 1;
            patch(c => { c.staff.push({ id: nid, name:"Новый сотрудник", pos:"waiter", norm: monthNorm(40) }); });
            setOpenEmp(nid);   // новая карточка сразу раскрыта — заполняй
          }}>+ добавить сотрудника</button>
        <div style={hintStyle}>Имена лучше писать так же, как в профиле сотрудника: по ним человек увидит свои смены.
          Телефон виден коллегам в их графике — имя становится звонком по тапу: выручает, когда кто-то проспал или заболел.
          У каждого три вида нерабочих дней: <b>отпуск</b> — период в этом месяце, <b>дни недели</b> — постоянный
          шаблон вроде «не работает по вторникам», <b>выходные по датам</b> — разовые числа. Генератор не нарушает
          ни одно из них.</div>
      </Sec>
    </div>
    );
  };

  // ── Вид сотрудника: только свои смены ─────────────────────────────
  if (!isAdmin) {
    const me = staff.find(s => `${s.name}`.toLowerCase() === `${profile?.name || ""} ${profile?.surname || ""}`.trim().toLowerCase())
            || staff.find(s => `${s.name}`.toLowerCase().includes((profile?.name || "").toLowerCase()));
    return shell(<>
      {monthNav}
      {!me ? (
        <div style={{ ...card, color:P.sub }}>
          Тебя пока нет в графике этого месяца. Если это ошибка — скажи менеджеру,
          он добавит тебя в настройках заведения.
        </div>
      ) : (<>
        <div style={card}>
          <div style={eyebrow}><span>{me.name}</span><span style={{ color:P.acc }}>{hoursOf(me)} / {effNorm(me)} ч{effNorm(me) !== me.norm ? <span style={{ color:P.sub }}> · отпуск учтён</span> : null}</span></div>
          {me.rate > 0 ? (
            <div style={{ fontSize:12.5, color:P.text, margin:"2px 0 8px" }}>
              Заработок за месяц: <b style={{ color:P.acc }}>≈ {(hoursOf(me) * me.rate).toLocaleString("ru-RU")} ₽</b>
              <span style={{ color:P.sub }}> · по ставке {me.rate} ₽/ч, по сменам в графике</span>
            </div>
          ) : null}
          {(() => {
            // Первый вопрос при открытии графика — «когда моя ближайшая смена?».
            // Отвечаем сразу, в одну строку, не заставляя сканировать список.
            const todayD = (now.getFullYear() === Y && now.getMonth() === M) ? now.getDate() : 0;
            if (!todayD) return null;
            let nd = 0;
            for (let d = todayD; d <= DAYS; d++) { if (shiftOf(plan[me.id]?.[d])) { nd = d; break; } }
            const sh = nd ? shiftOf(plan[me.id][nd]) : null;
            const when = !nd ? null : nd === todayD ? "сегодня" : nd === todayD + 1 ? "завтра" : `${DOWL[dow(nd)]} ${nd} ${MONTHS_R[M]}`;
            return (
              <div style={{ display:"flex", alignItems:"baseline", gap:7, margin:"2px 0 10px", fontSize:13,
                paddingBottom:9, borderBottom:`1px dashed ${a11y ? "rgba(120,90,30,0.25)" : "rgba(255,255,255,0.12)"}` }}>
                <span style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.5, textTransform:"uppercase", color:P.sub }}>ближайшая</span>
                {sh ? (
                  <span style={{ color:P.text }}><b style={{ color:P.acc }}>{when}</b> · {sh.name} {sh.from}:00–{sh.to > 24 ? sh.to - 24 : sh.to}:00</span>
                ) : (
                  <span style={{ color:P.sub }}>в этом месяце смен больше нет</span>
                )}
              </div>
            );
          })()}
          {(() => {
            // Контакты «на связи»: раньше телефоны жили только в настройках
            // и у старшего смены — сотрудник их не видел (замечание владельца)
            const bosses = staff.filter(x => x.phone && x.id !== me.id);
            if (!bosses.length) return null;
            return (
              <div style={{ display:"flex", alignItems:"baseline", gap:7, flexWrap:"wrap", margin:"0 0 10px",
                paddingBottom:9, borderBottom:`1px dashed ${a11y ? "rgba(120,90,30,0.25)" : "rgba(255,255,255,0.12)"}` }}>
                <span style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.5, textTransform:"uppercase", color:P.sub }}>на связи</span>
                {bosses.map(b => (
                  <span key={b.id} style={{ fontSize:12.5 }}>
                    <CallName who={b} label={`✆ ${b.name}`} color={P.acc} />
                  </span>
                ))}
              </div>
            );
          })()}
          {Array.from({ length: DAYS }, (_, i) => i + 1).map(d => {
            const k = plan[me.id]?.[d], sh = k && shiftOf(k), vac = onVac(me, d), col = k && colorOf(k);
            // Состав смены по тапу: первый вопрос любой смены — «кто сегодня
            // со мной?», и ответ уже лежит в загруженном plan.
            const open = openDay === d;
            return (
              <div key={d} onClick={() => { vibrate("light"); setOpenDay(open ? 0 : d); }}
                className={"sa-schedrow" + (sh ? "" : " off")} style={{
                display:"flex", alignItems:"center", gap:11, padding:"9px 11px", marginTop:6, borderRadius:13,
                cursor:"pointer", flexWrap:"wrap",
                outline: (now.getFullYear() === Y && now.getMonth() === M && now.getDate() === d)
                  ? `1px solid ${GOLD}66` : undefined,
                borderLeft: col ? `3px solid ${a11y ? col.bdL : col.bd}` : undefined,
              }}>
                <div style={{ flex:"0 0 44px", textAlign:"center" }}>
                  <div style={{ fontSize:17, color: holOf(d) ? P.warn : P.text }}>{d}</div>
                  <div style={{ fontFamily:mono, fontSize:8.5, color:P.sub }}>{DOWL[dow(d)]}</div>
                  {notes[d] ? <div style={{ fontSize:9, color:P.acc, lineHeight:1.2 }}>✎</div> : null}
                  {wishOf(me.id, d) ? <div style={{ fontSize:9, lineHeight:1.2 }}>🙏</div> : null}
                  {hardOf(me.id, d) ? <div style={{ fontSize:9, lineHeight:1.2 }}>🚫</div> : null}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, color:P.text }}>{vac && !sh ? "Отпуск 🌊" : sh ? sh.name
                    : ["Выходной", "Отдыхай ✨", "Твой день"][d % 3]}</div>
                  <div style={{ fontSize:11.5, color:P.sub }}>
                    {sh ? `${sh.from}:00 – ${sh.to > 24 ? sh.to - 24 : sh.to}:00` : (holName(d) || "")}
                    {sh && leadObj(d) ? <span style={{ color:P.acc }}> · старший:{" "}
                      <CallName who={leadObj(d)} label={leadOn(d)} color={P.acc} /></span> : null}
                  </div>
                </div>
                <div style={{ fontFamily:mono, fontSize:11, color:P.acc }}>{sh ? len(sh) + " ч" : ""}</div>
                {open ? (() => {
                  const mates = sh ? staff.filter(x => x.id !== me.id && shiftOf(plan[x.id]?.[d])) : [];
                  return (
                    <div style={{ flex:"1 1 100%", paddingTop:8, marginTop:7,
                      borderTop:`1px dashed ${a11y ? "rgba(120,90,30,0.25)" : "rgba(255,255,255,0.12)"}` }}
                      onClick={e => e.stopPropagation()}>
                      {sh ? (<>
                        <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.5, textTransform:"uppercase",
                          color:P.sub, marginBottom:5 }}>в смене с тобой</div>
                        {!mates.length ? (
                          <div style={{ fontSize:12, color:P.sub }}>Больше никого — держишь оборону в одиночку</div>
                        ) : POS.map(({ id: pos, t }) => {
                          const list = mates.filter(x => x.pos === pos);
                          if (!list.length) return null;
                          return (
                            <div key={pos} style={{ display:"flex", gap:8, fontSize:12, lineHeight:1.7 }}>
                              <span style={{ flex:"0 0 84px", color:P.sub }}>{t}</span>
                              <span style={{ flex:1, color:P.text }}>
                                {list.map((x, xi) => {
                                  const xs = shiftOf(plan[x.id][d]);
                                  const lbl = x.name + (xs && xs.k !== k ? " (" + xs.k + ")" : "");
                                  return (
                                    <span key={x.id}>{xi ? ", " : ""}
                                      <CallName who={x} label={lbl} color={P.text} />
                                    </span>
                                  );
                                })}
                              </span>
                            </div>
                          );
                        })}
                      </>) : null}
                      {/* Личная заметка дня: чаевые, важные события, напоминания */}
                      <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.5, textTransform:"uppercase",
                        color:P.sub, margin: sh ? "9px 0 5px" : "0 0 5px" }}>заметка</div>
                      <textarea key={"nt" + mkey + "-" + d} defaultValue={notes[d] || ""} rows={2} maxLength={200}
                        placeholder="Чаевые, важный день, напоминание…"
                        onFocus={focusScroll} onBlur={e => saveNote(d, e.target.value)}
                        style={{ ...INP(a11y, P), width:"100%", resize:"none", fontFamily:serif, fontSize:13, lineHeight:1.5 }} />
                      <div style={{ fontSize:10.5, color:P.sub, marginTop:4, fontStyle:"italic" }}>
                        Заметки видишь только ты — они живут на этом устройстве
                      </div>
                      {/* Пожелание выходного: видит менеджер, уважает генератор */}
                      {wishes === false ? (
                        <div style={{ fontSize:10.5, color:P.sub, marginTop:8, fontStyle:"italic" }}>
                          Просьбы о выходных пока не включены — менеджеру нужно применить SQL-файл schedule-wishes.sql в Supabase
                        </div>
                      ) : !sh ? (
                        <div style={{ marginTop:9 }}>
                          <button className="sa-btn" disabled={wishes === null}
                            onClick={() => setWish(me.id, d, !wishOf(me.id, d))}
                            style={{ ...ghost, width:"100%", boxSizing:"border-box",
                              padding:"9px 10px", fontSize:12.5,
                              ...(wishOf(me.id, d) ? { borderColor:GOLD, color: a11y ? "#6B4E1A" : GOLD } : {}) }}>
                            {wishes === null ? "…" : wishOf(me.id, d)
                              ? "🙏 Просьба о выходном отправлена — отозвать"
                              : "🙏 Попросить выходной (если получится)"}
                          </button>
                          {wishesV2 ? (
                            <button className="sa-btn" disabled={wishes === null}
                              onClick={() => setWish(me.id, d, !hardOf(me.id, d), "hard")}
                              style={{ ...ghost, width:"100%", boxSizing:"border-box", marginTop:7,
                                padding:"9px 10px", fontSize:12.5,
                                ...(hardOf(me.id, d) ? { borderColor:P.warn, color:P.warn } : {}) }}>
                              {wishes === null ? "…" : hardOf(me.id, d)
                                ? "🚫 Отмечено «не смогу выйти» — снять"
                                : `🚫 Не смогу выйти в этот день${(() => { const c = hardCapacity(d, me); return c.maxHard ? ` (мест: ${c.left})` : ""; })()}`}
                            </button>
                          ) : (
                            <div style={{ fontSize:10.5, color:P.sub, marginTop:7, fontStyle:"italic" }}>
                              «Не смогу выйти» появится после обновления сервера (schedule-wishes-v2.sql)
                            </div>
                          )}
                          {wishNote && wishNote.d === d ? (
                            <div style={{ fontSize:11.5, color:P.warn, marginTop:7, lineHeight:1.5 }}>
                              {wishNote.text}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div style={{ fontSize:10.5, color:P.sub, marginTop:8, fontStyle:"italic" }}>
                          На этот день уже стоит смена — о замене договорись с менеджером
                        </div>
                      )}
                    </div>
                  );
                })() : null}
              </div>
            );
          })}
        </div>
        <div style={{ margin:"0 14px" }}>
          <button style={{ ...ghost, width:"100%", boxSizing:"border-box", padding:"11px 12px", fontSize:13 }}
            className="sa-btn" disabled={shotBusy} onClick={() => exportMy(me)}>
            {shotBusy ? "Собираю…" : "Сохранить смены картинкой"}
          </button>
        </div>
        {shot ? (
          <div style={{ ...card }}>
            <div style={eyebrow}><span>Мои смены</span><span style={{ color:P.acc }}>{MONTHS_N[M]} {Y}</span></div>
            <img src={shot.url} alt="Мои смены" style={{ width:"100%", borderRadius:12, display:"block",
              border:`1px solid ${a11y ? "rgba(175,140,65,.3)" : "rgba(145,108,40,.32)"}` }} />
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <button style={btn} className="sa-btn" onClick={shareShot}>Отправить</button>
              <button style={ghost} className="sa-btn"
                onClick={() => { URL.revokeObjectURL(shot.url); setShot(null); }}>Закрыть</button>
            </div>
            <div style={{ fontSize:11.5, color:P.sub, marginTop:10, lineHeight:1.55 }}>
              Картинка с твоими сменами и заметками — можно отправить себе или сохранить в галерею.
            </div>
          </div>
        ) : null}
      </>)}
    </>);
  }

  // ── Вид менеджера: таблица ────────────────────────────────────────
  const warns = audit();
  // Советник ёмкости: если потребность НЕДОСТИЖИМА штатом даже в идеале
  // (отпуска, недельные выходные, цикл 2/2) — сказать прямо, а не сыпать
  // десятками одинаковых недоборов. Классика межсезонья: людей ужали,
  // потребность забыли. Оценка верхняя: реальность будет чуть ниже.
  POS.forEach(({ id: pos, t }) => {
    let needTotal = 0;
    for (let d = 1; d <= DAYS; d++) {
      const sp = (cfg.split || {})[pos];
      if (sp && Object.keys(sp).length) needTotal += Object.values(sp).reduce((a, v) => a + (v || 0), 0);
      else needTotal += needOf(d)[pos] || 0;
    }
    if (!needTotal) return;
    let cap = 0;
    staff.filter(x => x.pos === pos).forEach(x => {
      let avail = 0;
      for (let d = 1; d <= DAYS; d++) if (!onVac(x, d) && !isDayOff(x, d)) avail++;
      let c = Math.min(avail, Math.round(DAYS * (7 - (cfg.rules?.minOff || 0)) / 7));
      if ((cfg.posRules?.[pos]?.pattern) === "2x2") c = Math.min(c, Math.ceil(DAYS / 2));
      cap += c;
    });
    if (cap < needTotal) warns.unshift(
      `${t}: потребность ${needTotal} смен в месяц, а ёмкость штата ≈ ${cap} — нехватка структурная. Уменьши потребность в настройках (межсезонье?) или добавь людей`
    );
  });
  // Нарушенные пожелания — отдельно от нарушений правил: это просьбы,
  // а не запреты; менеджер решает сам, но должен их видеть.
  if (wishes && typeof wishes === "object") {
    staff.forEach(sf => (wishes[sf.id] || []).forEach(d => {
      const q = shiftOf(plan[sf.id]?.[d]);
      if (q && !q.extra) warns.push(`${sf.name} просил(а) выходной ${d}-го — стоит смена ${q.k}`);
    }));
  }
  staff.forEach(sf => (hardOff[sf.id] || []).forEach(d => {
    const q = shiftOf(plan[sf.id]?.[d]);
    if (q) warns.push(`${sf.name} НЕ СМОЖЕТ выйти ${d}-го — а смена ${q.k} стоит! Срочно замени`);
  }));
  let need = 0, have = 0;
  for (let d = 1; d <= DAYS; d++) POS.forEach(({ id: pos }) => {
    const n = needOf(d)[pos] || 0; need += n;
    have += Math.min(n, staff.filter(s => { const sh = s.pos === pos && shiftOf(plan[s.id]?.[d]); return sh && !sh.extra; }).length);
  });
  const covPct = need ? Math.round(have / need * 100) : 0;
  covTarget.current = covPct;
  // Сегодняшний день, если открыт текущий месяц: менеджеру чаще всего
  // нужен ответ «кто сейчас в смене», а не таблица месяца целиком.
  const today = (now.getFullYear() === Y && now.getMonth() === M) ? now.getDate() : 0;

  return shell(<>
    <div style={{ position:"relative", display:"flex", gap:2, margin:"12px 14px 0", padding:4,
      background: a11y ? "rgba(120,90,30,0.10)" : "rgba(0,0,0,0.3)",
      border:`1px solid ${a11y ? "rgba(175,140,65,0.3)" : "rgba(150,112,42,0.3)"}`, borderRadius:999 }}>
      {[["plan","График"],["setup","Настройки"]].map(([k, t]) => (
        <button key={k} className="sa-btn" onClick={() => setTab(k)} style={{
          flex:1, border:"none", cursor:"pointer", padding:"9px 4px", borderRadius:999, fontFamily:serif, fontSize:13,
          background: tab === k ? `linear-gradient(180deg,#E4C88C,${GOLD})` : "transparent",
          color: tab === k ? INK_DEEP : P.sub, fontWeight: tab === k ? "bold" : "normal",
        }}>{t}</button>
      ))}
    </div>
    {tab === "setup" ? setupView() : <>
    {monthNav}
    <div style={{ display:"flex", gap:8, margin:"12px 14px 0" }}>
      <button style={btn} className="sa-btn" onClick={generate}>Заполнить черновик</button>
      <button style={ghost} className="sa-btn" onClick={save} disabled={!dirty}>
        {dirty ? "Сохранить" : "Сохранено"}
      </button>
    </div>
    <div style={{ display:"flex", gap:8, margin:"8px 14px 0" }}>
      <button style={{ ...ghost, fontSize:12.5, padding:"9px 8px",
        ...(swap ? { background:`linear-gradient(180deg,#E4C88C,${GOLD})`, color:INK_DEEP,
          fontWeight:"bold", borderColor:GOLD } : {}) }} className="sa-btn"
        onClick={() => { setSwap(!swap); setSwapSel(null); vibrate("light"); }}>
        {swap ? "Обмен: вкл" : "Обмен"}
      </button>
      {undoRef.current ? (
        <button style={{ ...ghost, fontSize:12.5, padding:"9px 8px" }} className="sa-btn"
          onClick={undo} data-tick={undoTick}>↩ Отменить</button>
      ) : null}
      <button style={{ ...ghost, fontSize:12.5, padding:"9px 8px" }} className="sa-btn"
        onClick={() => { snapUndo(); setLocks({}); setDirty(true); }}>Снять закрепления</button>
      <button style={{ ...ghost, fontSize:12.5, padding:"9px 8px",
        borderColor: P.danger + "77", color: P.danger }} className="sa-btn"
        onClick={() => setConfirmClear(true)}>Очистить месяц</button>
    </div>
    <div style={{ display:"flex", gap:8, margin:"8px 14px 0" }}>
      <button style={{ ...btn, fontSize:13 }} className="sa-btn" onClick={exportImage} disabled={!staff.length || shotBusy}>
        {shotBusy ? "Собираю…" : "Сохранить и отправить"}
      </button>
    </div>
    {shot ? (
      <div style={{ ...card }}>
        <div style={eyebrow}><span>График картинкой</span><span style={{ color:P.acc }}>{MONTHS_N[M]} {Y}</span></div>
        <img src={shot.url} alt="График" style={{ width:"100%", borderRadius:12, display:"block",
          border:`1px solid ${a11y ? "rgba(175,140,65,.3)" : "rgba(145,108,40,.32)"}` }} />
        <div style={{ display:"flex", gap:6, marginTop:10 }}>
          {[["chat","Для чата"],["a4","Лист A4"]].map(([k, t]) => (
            <button key={k} className="sa-btn" onClick={() => { URL.revokeObjectURL(shot.url); exportImage(k); }}
              style={{ flex:1, padding:"8px 4px", borderRadius:999, cursor:"pointer", fontFamily:serif, fontSize:12,
                color: shotMode === k ? INK_DEEP : P.sub,
                background: shotMode === k ? `linear-gradient(180deg,#E4C88C,${GOLD})` : "transparent",
                border:`1px solid ${shotMode === k ? GOLD : (a11y ? "rgba(175,140,65,.3)" : "rgba(145,108,40,.3)")}`,
                fontWeight: shotMode === k ? "bold" : "normal" }}>{t}</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, marginTop:8 }}>
          <button style={btn} className="sa-btn" onClick={shareShot}>Отправить</button>
          <button style={ghost} className="sa-btn"
            onClick={() => { URL.revokeObjectURL(shot.url); setShot(null); }}>Закрыть</button>
        </div>
        <div style={{ fontSize:11.5, color:P.sub, marginTop:10, lineHeight:1.55 }}>
          {shotMode === "a4"
            ? "Лист A4 в альбомной, 300 точек на дюйм, свёрстан под чёрно-белую печать: недобор помечен восклицательным знаком, праздники точкой. «Отправить» → «Напечатать»."
            : "«Отправить» откроет системное меню — оттуда картинка уходит в рабочую группу одним касанием. Для печати переключись на «Лист A4»."}
        </div>
      </div>
    ) : null}

    {confirmClear ? (
      <div style={{ ...card, marginTop:10 }}>
        <div style={{ fontSize:13.5, lineHeight:1.6, color:P.text, marginBottom:10 }}>
          Что стереть за {MONTHS_R[M]} {Y}? Расстановка и закрепления сотрутся
          <b> только в черновике</b> — на сервере всё останется, пока не нажмёшь «Сохранить».
          Передумал — «↩ Отменить» вернёт как было.
          {frozenBefore() > 1 && frozenBefore() <= DAYS ? <span> <b>Прошедшие дни и сегодня не трогаются</b> — сотрётся только будущее.</span> : null}
        </div>
        <button style={{ ...btn, background:P.dangerBg, color:P.dangerFg, width:"100%", boxSizing:"border-box", marginBottom:10 }}
          className="sa-btn" onClick={() => clearScope({})}>Стереть весь месяц</button>
        <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.5, textTransform:"uppercase", color:P.sub, marginBottom:6 }}>
          или только одну должность
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          {POS.filter(pp => staff.some(x => x.pos === pp.id)).map(pp => (
            <button key={pp.id} style={{ ...ghost, padding:"7px 11px", fontSize:12 }} className="sa-btn"
              onClick={() => clearScope({ pos: pp.id })}>{pp.t}</button>
          ))}
        </div>
        <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.5, textTransform:"uppercase", color:P.sub, marginBottom:6 }}>
          или одного сотрудника
        </div>
        <select style={{ ...inp, width:"100%", boxSizing:"border-box", marginBottom:10 }} value=""
          onChange={e => { if (e.target.value) clearScope({ staffId: e.target.value }); }}>
          <option value="">Выбрать сотрудника…</option>
          {staff.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.5, textTransform:"uppercase", color:P.sub, marginBottom:6 }}>
          новенький пришёл — дать ему смены
        </div>
        <div style={{ fontSize:11.5, color:P.sub, lineHeight:1.5, marginBottom:8 }}>
          Сначала добавь человека в настройках. Он получит только свободные
          дыры будущих дней — чужие смены не изменятся.
        </div>
        <select style={{ ...inp, width:"100%", boxSizing:"border-box", marginBottom:10 }} value=""
          onChange={e => { if (e.target.value) onboardNew(e.target.value); }}>
          <option value="">Выбрать новенького…</option>
          {staff.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.5, textTransform:"uppercase", color:P.sub, marginBottom:6 }}>
          сотрудник уходит — раздать его смены другим
        </div>
        <div style={{ fontSize:11.5, color:P.sub, lineHeight:1.5, marginBottom:8 }}>
          Чужие смены останутся как есть: генератор заполнит только освободившиеся
          дни, соблюдая отдых, «подряд» и нормы.
        </div>
        <select style={{ ...inp, width:"100%", boxSizing:"border-box", marginBottom:10 }} value=""
          onChange={e => { if (e.target.value) redistribute(e.target.value); }}>
          <option value="">Выбрать уходящего…</option>
          {staff.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <button style={{ ...ghost, width:"100%", boxSizing:"border-box" }} className="sa-btn"
          onClick={() => setConfirmClear(false)}>Отмена</button>
      </div>
    ) : null}
    {msg ? <div style={{ textAlign:"center", fontSize:12, color:P.sub, marginTop:8 }}>{msg}</div> : null}

    {today ? (
      <div style={card}>
        <div style={eyebrow}>
          <span>Сегодня · {today} {MONTHS_R[M]}</span>
          <span style={{ color:P.acc }}>{leadOn(today) ? "старший: " + leadOn(today) : ""}</span>
        </div>
        {POS.map(({ id: pos, t }) => {
          const n = needOf(today)[pos] || 0;
          const onDuty = staff.filter(x => x.pos === pos && shiftOf(plan[x.id]?.[today]));
          if (!n && !onDuty.length) return null;
          const main = onDuty.filter(x => !shiftOf(plan[x.id][today]).extra).length;
          const short = main < n;
          return (
            <div key={pos} style={{ display:"flex", gap:8, fontSize:12.5, lineHeight:1.8 }}>
              <span style={{ flex:"0 0 104px", color: short ? P.warn : P.sub, fontWeight: short ? "bold" : "normal" }}>
                {t}{n ? ` ${main}/${n}` : ""}{short ? "!" : ""}
              </span>
              <span style={{ flex:1, minWidth:0, color:P.text }}>
                {onDuty.length ? onDuty.map((x, xi) => (
                  <span key={x.id}>{xi ? ", " : ""}
                    <CallName who={x} label={x.name.split(" ")[0]} color={P.text} />
                    {" (" + plan[x.id][today] + ")"}
                  </span>
                )) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    ) : null}
    <div style={card}>
      <div style={eyebrow}>
        <span>Смены</span>
        <span style={{ color:P.acc }}>{need ? `покрытие ${covShown}%` : "—"}</span>
      </div>

      {!staff.length ? (
        <div style={{ color:P.sub, fontSize:13, lineHeight:1.6 }}>
          В заведении пока нет сотрудников. Их список задаётся в настройках графика —
          добавь людей, и появится таблица.
        </div>
      ) : (
        <>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:9 }}>
          {weeks.map((w, i) => (
            <button key={i} className="sa-btn" onClick={() => setWeekIdx(weekIdx === i ? null : i)}
              style={{ flex:"1 1 auto", padding:"7px 4px", borderRadius:999, cursor:"pointer",
                fontFamily:serif, fontSize:11.5, minWidth:52,
                color: weekIdx === i ? INK_DEEP : P.sub,
                background: weekIdx === i ? `linear-gradient(180deg,#E4C88C,${GOLD})` : "transparent",
                border:`1px solid ${weekIdx === i ? GOLD : (a11y ? "rgba(175,140,65,.3)" : "rgba(145,108,40,.3)")}`,
                fontWeight: weekIdx === i ? "bold" : "normal" }}>
              {w[0]}–{w[w.length - 1]}
            </button>
          ))}
          <button className="sa-btn" onClick={() => setWeekIdx(null)}
            style={{ flex:"1 1 auto", padding:"7px 8px", borderRadius:999, cursor:"pointer",
              fontFamily:serif, fontSize:11.5, minWidth:74,
              color: weekIdx == null ? INK_DEEP : P.sub,
              background: weekIdx == null ? `linear-gradient(180deg,#E4C88C,${GOLD})` : "transparent",
              border:`1px solid ${weekIdx == null ? GOLD : (a11y ? "rgba(175,140,65,.3)" : "rgba(145,108,40,.3)")}`,
              fontWeight: weekIdx == null ? "bold" : "normal" }}>весь месяц</button>
        </div>
        <div style={{ fontSize:11, color:P.sub, fontStyle:"italic", marginBottom:7 }}>
          {swap
            ? (swapSel ? "Теперь тапни вторую клетку — смены поменяются местами" : "Обмен: тапни первую клетку")
            : weekIdx == null
            ? "Весь месяц: таблица листается вбок. Выбери неделю — влезет без прокрутки"
            : "Тап по клетке меняет смену и закрепляет её"}
        </div>
        {/* Мини-легенда: палитра смен читается без экспорта и без памяти */}
        <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap", margin:"2px 0 9px" }}>
          {(cfg.shifts || []).map((sh2, i2) => {
            const c2 = SHIFT_COLORS[i2 % SHIFT_COLORS.length];
            return (
              <span key={sh2.k} style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:10.5, color:P.sub }}>
                <span style={{ width:16, height:16, borderRadius:5, display:"grid", placeItems:"center", fontSize:9,
                  color: a11y ? c2.fgL : c2.fg, background: a11y ? c2.bgL : c2.bg,
                  border:`1px solid ${a11y ? c2.bdL : c2.bd}` }}>{sh2.k}</span>
                {sh2.name}
              </span>
            );
          })}
          <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:10.5, color:P.sub }}>
            <span style={{ width:16, height:16, borderRadius:5, display:"grid", placeItems:"center", fontSize:9,
              color: a11y ? "#8B3020" : "#E0A0A0", background: a11y ? "rgba(224,120,120,.14)" : "rgba(224,120,120,.10)",
              border:"1px solid rgba(224,120,120,.35)" }}>О</span>
            отпуск
          </span>
          <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:10.5, color:P.sub }}>
            <span style={{ width:16, height:16, borderRadius:5, display:"grid", placeItems:"center", fontSize:12,
              fontWeight:600, color: a11y ? "#6B5B40" : "#9A8A72" }}>✕</span>
            пост. выходной
          </span>
        </div>
        <div className="sa-schedgrid sa-hscroll">
          <table style={{ borderCollapse:"separate", borderSpacing:0, fontFamily:mono }}>
            <tbody key={"g" + genKey + ":" + weekIdx} className="sa-weekin">
              <tr>
                <th className="sa-schednm" style={{ width:100, minWidth:100 }} />
                {visibleDays.map(d => (
                  <th key={d} style={{ width:26, minWidth:26, fontSize:9, color:P.sub, padding:"3px 0", lineHeight:1.2,
                    background: d === today ? (a11y ? "rgba(175,140,65,0.12)" : "rgba(212,168,90,0.09)") : undefined,
                    boxShadow: d === today ? `0 2px 0 ${GOLD} inset` : undefined,
                    borderLeft: dow(d) === 0 ? `1px solid ${GOLD}44` : undefined }}>
                    <b style={{ display:"block", fontSize:10.5,
                      fontWeight: d === today ? "bold" : "normal",
                      color: d === today ? GOLD : holOf(d) ? P.warn : dow(d) >= 5 ? P.acc : SAND }}>{d}</b>
                    {DOWL[dow(d)]}
                  </th>
                ))}
              </tr>
              {POS.map(({ id: pos, t }) => {
                const list = staff.filter(s => s.pos === pos);
                if (!list.length) return null;
                return (
                  <React.Fragment key={pos}>
                    <tr>
                      <td className="sa-schednm sa-schedgrp" style={{ fontFamily:mono, fontSize:9,
                        letterSpacing:2, textTransform:"uppercase", color:P.acc, padding:"6px 8px" }}>{t}</td>
                      {visibleDays.map(d => {
                        // Факт против плана: недобор виден прямо в сетке, без
                        // сверки со списком «Проверки» — красная цифра = дыра.
                        const n = needOf(d)[pos] || 0;
                        const have = staff.filter(x => {
                          const sh = x.pos === pos && shiftOf(plan[x.id]?.[d]); return sh && !sh.extra;
                        }).length;
                        const short = n > 0 && have < n;
                        return (
                          <td key={d} className="sa-schedgrp" style={{ fontSize:8.5, minWidth:26, height:22, textAlign:"center",
                            color: short ? P.warn : P.sub, fontWeight: short ? "bold" : "normal",
                            background: d === today ? (a11y ? "rgba(175,140,65,0.10)" : "rgba(212,168,90,0.07)") : undefined,
                            borderLeft: dow(d) === 0 ? `1px solid ${GOLD}44` : undefined }}>
                            {n ? `${have}/${n}` : (have || "·")}
                          </td>
                        );
                      })}
                    </tr>
                    {list.map((s, ri) => {
                      const en = effNorm(s);
                      const h = hoursOf(s), pct = Math.min(100, Math.round(h / (en || 1) * 100));
                      return (
                        <tr key={s.id} className={ri % 2 ? "sa-schedzeb" : ""}>
                          <td className="sa-schednm" style={{ fontFamily:serif, fontSize:12.5, padding:"0 8px",
                            textAlign:"left", color:P.text }}>
                            {s.name}
                            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
                              <span className="sa-schedbar">
                                <span style={{ display:"block", height:"100%", width:pct + "%", borderRadius:2,
                                  background: h > en ? "linear-gradient(90deg,#E07878,#C04A4A)" : "linear-gradient(90deg,#D4A85A,#C8A96E)" }} />
                              </span>
                              <span style={{ fontFamily:mono, fontSize:8, color:P.sub }}>{h}/{en}{en !== s.norm ? "*" : ""}</span>
                            </div>
                          </td>
                          {visibleDays.map((d, di) => {
                            const k = plan[s.id]?.[d] || "", col = k && colorOf(k);
                            const vac = onVac(s, d);
                            const fixedOff = !k && !vac && isDayOff(s, d);
                            return (
                              <td key={d} onClick={() => tapCell(s, d)}
                                className={"sa-schedcell" + (dow(d) >= 5 ? " sa-schedwe" : "")}
                                style={{ width:26, minWidth:26, height:30, cursor:"pointer", textAlign:"center",
                                  background: d === today ? (a11y ? "rgba(175,140,65,0.07)" : "rgba(212,168,90,0.05)") : undefined,
                                  borderLeft: dow(d) === 0 ? `1px solid ${GOLD}44` : undefined }}>
                                <div style={{
                                  width:22, height:22, margin:"0 auto", borderRadius:6, display:"grid", placeItems:"center",
                                  // Крестик постоянного выходного — крупнее и плотнее: девятый
                                  // кегль тусклым цветом было «для зорких» (замечание владельца)
                                  fontSize: !k && !vac && fixedOff ? 13 : 9,
                                  fontWeight: !k && !vac && fixedOff ? 600 : undefined,
                                  position:"relative",
                                  color: col ? (a11y ? col.fgL : col.fg)
                                    : vac ? (a11y ? "#8B3020" : "#E0A0A0")
                                    : fixedOff ? (a11y ? "#6B5B40" : "#9A8A72")
                                    : (a11y ? "#B9AE97" : "#4A4136"),
                                  background: col ? (a11y ? col.bgL : col.bg)
                                    : vac ? (a11y ? "rgba(224,120,120,.14)" : "rgba(224,120,120,.10)")
                                    : "transparent",
                                  border: `1px solid ${col ? (a11y ? col.bdL : col.bd)
                                    : vac ? "rgba(224,120,120,.35)" : "transparent"}`,
                                  boxShadow: (swapSel && swapSel.id === s.id && swapSel.d === d)
                                    ? `0 0 0 2px ${GOLD}, 0 0 10px ${GOLD}88`
                                    : isLocked(s.id, d) ? `0 0 0 1.5px ${GOLD}D0` : undefined,
                                  animationDelay: `${ri * 45 + di * 7}ms`,
                                }} className={k ? "sa-schedchip" : undefined}
                                >{k || (vac ? "О" : fixedOff ? "✕" : "·")}
                                  {badCells.has(s.id + ":" + d) ? (
                                    <span style={{ position:"absolute", top:-2, right:-2, width:6, height:6,
                                      borderRadius:3, background:P.warn, boxShadow:"0 0 4px rgba(224,120,120,0.8)" }} />
                                  ) : null}
                                  {wishOf(s.id, d) ? (
                                    <span style={{ position:"absolute", bottom:-2, left:-2, width:6, height:6,
                                      borderRadius:3, border:`1.4px solid ${GOLD}`, background:"transparent" }} />
                                  ) : null}
                                  {hardOf(s.id, d) ? (
                                    <span style={{ position:"absolute", bottom:-2, left:-2, width:6, height:6,
                                      borderRadius:3, border:`1.4px solid ${P.warn}`, background:"transparent" }} />
                                  ) : null}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Месяц одной строкой: менеджер видит масштаб без калькулятора */}
        {(() => {
          let shifts = 0, hours = 0;
          staff.forEach(x => {
            for (let d = 1; d <= DAYS; d++) {
              const q = shiftOf(plan[x.id]?.[d]);
              if (q) { shifts++; hours += (q.to - q.from); }
            }
          });
          if (!shifts) return null;
          const fund = staff.reduce((a, x) => a + (x.rate > 0 ? hoursOf(x) * x.rate : 0), 0);
          return (
            <div style={{ fontFamily:mono, fontSize:10, color:P.sub, marginTop:8, letterSpacing:0.3 }}>
              итог месяца: {shifts} смен · {hours.toLocaleString("ru-RU")} ч
              {fund > 0 ? <> · фонд ≈ <span style={{ color:P.acc }}>{fund.toLocaleString("ru-RU")} ₽</span></> : null}
            </div>
          );
        })()}
        </>
      )}

      {staff.length ? (
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:12 }}>
          {(cfg.shifts || []).map((sh, i) => {
            const c = SHIFT_COLORS[i % SHIFT_COLORS.length];
            return (
              <span key={sh.k} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10.5, color:P.sub }}>
                <i style={{ width:14, height:14, borderRadius:4, display:"inline-block",
                  background: a11y ? c.bgL : c.bg, border:`1px solid ${a11y ? c.bdL : c.bd}` }} />
                {sh.k} — {sh.name} {sh.from}:00–{sh.to > 24 ? sh.to - 24 : sh.to}:00{sh.extra ? " · вручную" : ""}
              </span>
            );
          })}
          <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:10.5, color:P.sub }}>
            <i style={{ width:14, height:14, borderRadius:4, display:"inline-block",
              background:"rgba(224,120,120,.12)", border:"1px solid rgba(224,120,120,.35)" }} />
            О — отпуск
          </span>
          <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:10.5, color:P.sub }}>
            <i style={{ width:14, height:14, borderRadius:4, display:"inline-block",
              border:`1px solid ${a11y ? "rgba(175,140,65,.3)" : "rgba(145,108,40,.3)"}`,
              color:P.sub, fontSize:9, textAlign:"center", lineHeight:"13px" }}>×</i>
            × — постоянный выходной
          </span>
        </div>
      ) : null}
    </div>

    {staff.length ? (
      <div style={card}>
        <div style={eyebrow}><span>Отработано по людям</span><span style={{ color:P.acc }}>{MONTHS_R[M]}</span></div>
        {POS.map(({ id: pos, t }) => {
          const list = staff.filter(x => x.pos === pos);
          if (!list.length) return null;
          return (
            <div key={pos}>
              <div style={{ fontFamily:mono, fontSize:9, letterSpacing:2, textTransform:"uppercase",
                color:P.acc, margin:"12px 0 4px" }}>{t}</div>
              {list.map(s => {
                const b = breakdownOf(s);
                const diff = b.hours - (s.norm || 0);
                return (
                  <div key={s.id} className="sa-schedrow" style={{ padding:"9px 11px", marginTop:6, borderRadius:13 }}>
                    <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                      <div style={{ flex:1, minWidth:0, fontSize:14, color:P.text }}>{s.name}</div>
                      <div style={{ fontFamily:mono, fontSize:14, color: diff > 0 ? P.warn : P.acc }}>{b.hours} ч</div>
                      <div style={{ fontFamily:mono, fontSize:10.5, color:P.sub }}>из {s.norm}</div>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:6 }}>
                      <span style={{ fontFamily:mono, fontSize:10.5, color:P.sub }}>{b.shifts} смен</span>
                      {Object.entries(b.by).map(([k, v]) => {
                        const c = colorOf(k);
                        return (
                          <span key={k} style={{ display:"flex", alignItems:"center", gap:4,
                            fontFamily:mono, fontSize:10.5, color:P.sub }}>
                            <i style={{ width:11, height:11, borderRadius:3, display:"inline-block",
                              background: c ? (a11y ? c.bgL : c.bg) : "transparent",
                              border:`1px solid ${c ? (a11y ? c.bdL : c.bd) : "transparent"}` }} />
                            {k} · {v.n} × {v.h} ч
                          </span>
                        );
                      })}
                      <span style={{ fontFamily:mono, fontSize:10.5, marginLeft:"auto",
                        color: diff > 0 ? P.warn : diff < 0 ? P.sub : P.acc }}>
                        {diff > 0 ? `+${diff} ч сверх нормы` : diff < 0 ? `${-diff} ч недобор` : "норма закрыта"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    ) : null}

    {staff.length ? (() => {
      const tot = staff.reduce((a, s) => a + hoursOf(s), 0);
      const totNorm = staff.reduce((a, s) => a + (s.norm || 0), 0);
      const over = staff.filter(s => hoursOf(s) > s.norm);
      const under = staff.filter(s => hoursOf(s) < s.norm * 0.9);
      const shifts = staff.reduce((a, s) => {
        let n = 0; for (let d = 1; d <= DAYS; d++) if (plan[s.id]?.[d]) n++; return a + n;
      }, 0);
      return (
        <div style={card}>
          <div style={eyebrow}><span>Часы за месяц</span>
            <span style={{ color:P.acc }}>норма месяца {monthNorm(40)} ч</span></div>
          <div style={{ display:"flex", gap:10 }}>
            {[[shifts, "смен"], [tot, "часов"], [totNorm, "по нормам"]].map(([v, t], i) => (
              <div key={i} style={{ flex:1, textAlign:"center", padding:"11px 6px", borderRadius:14,
                background: a11y ? "rgba(250,242,222,0.72)" : "rgba(255,250,238,0.04)",
                border:`1px solid ${a11y ? "rgba(175,140,65,0.26)" : "rgba(145,108,40,0.26)"}`,
                borderTop:`1px solid ${a11y ? "rgba(255,240,200,0.8)" : "rgba(210,168,65,0.3)"}`,
                boxShadow: a11y
                  ? "inset 0 0 14px rgba(255,255,255,0.55), inset 0 1px 0 rgba(255,255,255,0.9)"
                  : "inset 0 0 14px rgba(255,248,230,0.05), inset 0 1px 0 rgba(255,255,255,0.10)" }}>
                <div style={{ fontSize:21, color:P.acc, lineHeight:1.1 }}>{v}</div>
                <div style={{ fontFamily:mono, fontSize:8, letterSpacing:1.4, textTransform:"uppercase",
                  color:P.sub, marginTop:5 }}>{t}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:12.5, color:P.sub, marginTop:10, lineHeight:1.6 }}>
            {tot === totNorm ? "Часы разошлись ровно по нормам."
              : tot < totNorm ? `Недобрано ${totNorm - tot} ч до суммы норм.`
              : `Сверх норм ${tot - totNorm} ч — это переработки.`}
            {over.length ? <span style={{ color:P.warn }}> Переработка у {over.length}: {over.map(s => s.name).join(", ")}.</span> : null}
            {under.length ? <span> Заметный недобор у {under.length}: {under.map(s => s.name).join(", ")}.</span> : null}
          </div>
        </div>
      );
    })() : null}

    {!staff.length ? (
      <div style={card}>
        <div style={eyebrow}><span>С чего начать</span></div>
        <div style={{ fontSize:13, lineHeight:1.6, color:P.sub }}>
          Открой «Настройки» вверху и заведи людей — по одному, с должностью и нормой часов.
          Там же задаются часы работы, смены и правила. После этого «Заполнить черновик»
          расставит смены сам, а проверка покажет, где не сходится.
        </div>
      </div>
    ) : (
    <div style={card}>
      <div style={eyebrow}><span>Проверка</span></div>
      {!warns.length ? (
        <div className="sa-schednote ok">🎯 Нарушений нет: смены закрыты, нормы соблюдены.</div>
      ) : (
        <div className="sa-schednote bad">
          💡 Замечаний: {warns.length} · красная точка = нарушение, золотой уголок = просьба о выходном, красный уголок = «не смогу выйти», звёздочка = отпуск в норме
        <ul style={{ margin:"7px 0 0", paddingLeft:17 }}>
            {warns.slice(0, 10).map((w, i) => <li key={i} style={{ marginBottom:4 }}>{w}</li>)}
            {warns.length > 10 ? <li>…и ещё {warns.length - 10}</li> : null}
          </ul>
        </div>
      )}
      {staff.some(x => x.rate > 0) ? (
        <div style={{ marginTop:10, paddingTop:10, borderTop:`1px dashed ${a11y ? "rgba(120,90,30,0.25)" : "rgba(255,255,255,0.12)"}` }}>
          <div style={{ fontFamily:mono, fontSize:8.5, letterSpacing:1.5, textTransform:"uppercase", color:P.sub, marginBottom:6 }}>
            зарплата · по ставкам и сменам черновика
          </div>
          {staff.filter(x => x.rate > 0).map(x => (
            <div key={x.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:P.text, padding:"2px 0" }}>
              <span>{x.name}</span>
              <span style={{ fontFamily:mono }}>{hoursOf(x)} ч × {x.rate} = <b style={{ color:P.acc }}>{(hoursOf(x) * x.rate).toLocaleString("ru-RU")} ₽</b></span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, color:P.text, padding:"6px 0 0", marginTop:4,
            borderTop:`1px solid ${a11y ? "rgba(120,90,30,0.3)" : "rgba(255,255,255,0.15)"}` }}>
            <b>Итого фонд</b>
            <b style={{ color:P.acc, fontFamily:mono }}>{staff.reduce((a, x) => a + (x.rate > 0 ? hoursOf(x) * x.rate : 0), 0).toLocaleString("ru-RU")} ₽</b>
          </div>
          <div style={{ fontSize:10.5, color:P.sub, marginTop:6, fontStyle:"italic" }}>
            Считается по сменам текущего черновика. У кого ставка не задана — в фонд не входит.
          </div>
        </div>
      ) : null}
    </div>
    )}
    </>}
  </>);
}
