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
import { vibrate, onActivate } from "../lib/utils";
import { GOLD, GOLD_SOFT, CREAM, SAND, MUTED_2, INK_DEEP, RADIUS } from "./tokens";

const mono = "ui-monospace, Menlo, monospace";
const serif = "Georgia, serif";
const DOWL = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const MONTHS_N = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const MONTHS_R = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

// Порядок позиций: сверху руководство, дальше по залу
export const POS = [
  { id: "manager", t: "Менеджер" }, { id: "host", t: "Хостес" }, { id: "bar", t: "Бар" },
  { id: "barback", t: "Барбек" }, { id: "waiter", t: "Официант" }, { id: "runner", t: "Раннер" },
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
    1:{manager:1,host:1,bar:1,barback:0,waiter:2,runner:1},
    2:{manager:1,host:1,bar:1,barback:1,waiter:3,runner:1},
    3:{manager:1,host:1,bar:2,barback:1,waiter:4,runner:2},
  },
  rules: { peakDows:[4,5], highDows:[3,6], maxRow:5, minOff:2, minRest:11, holidayPeak:true },
  staff: [],
};

// Клавиатура на телефоне закрывает половину экрана: подводим поле к центру
const focusScroll = (e) => {
  const el = e.target;
  setTimeout(() => {
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
  }, 300);
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
  fontFamily: mono, fontSize: 13.5, color: P.text, borderRadius: 9, padding: "8px 9px", minWidth: 0,
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
      style={{ ...inp, width:56, textAlign:"center" }}
      onFocus={focusScroll}
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
  const isAdmin = !!profile?.is_admin;
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
  const [covShown, setCovShown] = React.useState(0);    // покрытие, догоняющее настоящее
  const covTarget = React.useRef(0);

  const DAYS = daysIn(Y, M);
  const mkey = `${Y}-${String(M + 1).padStart(2, "0")}`;
  const venueKey = "main";                           // одно заведение на ресторан; сети — позже
  const dow = d => (firstDow(Y, M) + d - 1) % 7;
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
  const clearMonth = async () => {
    setPlan({}); setLocks({}); setConfirmClear(false);
    if (!isAdmin) return;
    setMsg("Очищаю…");
    try {
      const r = await rpc("schedule_save_month", {
        p_token: saToken(), p_restaurant: profile?.restaurant || "", p_venue_key: venueKey,
        p_month: mkey, p_payload: JSON.stringify({ plan: {}, locks: {}, days }),
      });
      if (r && r.ok === true) { setDirty(false); setMsg("Месяц очищен"); vibrate("light"); }
      else setMsg(r?.error === "forbidden" ? "Нет прав на изменение графика" : "Очистить не удалось");
    } catch (e) { setMsg("Нет связи с сервером"); }
    setTimeout(() => setMsg(""), 2500);
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
  // Закреплённые вручную клетки сохраняем и достраиваем вокруг них.
  const generate = () => {
    if (!cfg || !staff.length) return;
    const R = cfg.rules, auto = cfg.shifts.filter(x => !x.extra);
    if (!auto.length) return;
    const p = {}; staff.forEach(s => { p[s.id] = {}; });
    const hrs = {}, row = {}, peak = {};
    staff.forEach(s => { hrs[s.id] = 0; row[s.id] = 0; peak[s.id] = 0; });

    for (let d = 1; d <= DAYS; d++) staff.forEach(s => {
      const keep = isLocked(s.id, d) ? (plan[s.id]?.[d] || "") : "";
      p[s.id][d] = keep;
      const sh = keep && shiftOf(keep);
      if (sh) { hrs[s.id] += len(sh); if (lvlOf(d) === 3) peak[s.id]++; }
    });

    // Сколько выходных ещё можно потратить на этой неделе.
    // Неполные недели на стыке месяцев считаем пропорционально.
    const offLeft = (s, d) => {
      const start = d - dow(d), end = Math.min(DAYS, start + 6);
      let work = 0, n = 0;
      for (let i = Math.max(1, start); i <= end; i++) { n++; if (p[s.id][i]) work++; }
      const need = n >= 7 ? R.minOff : Math.round(R.minOff * n / 7);
      return (n - work) - need;
    };

    for (let d = 1; d <= DAYS; d++) {
      const need = needOf(d), isPeak = lvlOf(d) === 3, slots = [];
      POS.forEach(({ id: pos }) => {
        const already = staff.filter(s => s.pos === pos && p[s.id][d]).length;
        const n = (need[pos] || 0) - already;
        for (let i = 0; i < n; i++) slots.push({ pos, k: auto[Math.min(already + i, auto.length - 1)].k });
      });
      slots.forEach(sl => {
        const sh = shiftOf(sl.k); if (!sh) return;
        const cand = staff.filter(s => {
          if (s.pos !== sl.pos || p[s.id][d] || onVac(s, d)) return false;
          if (isDayOff(s, d)) return false;
          if (s.notBefore && sh.from < s.notBefore) return false;
          if (row[s.id] >= R.maxRow) return false;
          if (offLeft(s, d) <= 0) return false;
          if (hrs[s.id] + len(sh) > s.norm) return false;
          const pv = d > 1 ? p[s.id][d - 1] : "";
          if (pv) { const q = shiftOf(pv); if (q && (24 - q.to + sh.from) < R.minRest) return false; }
          return true;
        }).sort((a, b) => {
          if (isPeak && peak[a.id] !== peak[b.id]) return peak[a.id] - peak[b.id];
          return (b.norm - hrs[b.id]) - (a.norm - hrs[a.id]);
        });
        if (cand.length) {
          const s = cand[0]; p[s.id][d] = sl.k; hrs[s.id] += len(sh);
          if (isPeak) peak[s.id]++;
        }
      });
      staff.forEach(s => { row[s.id] = p[s.id][d] ? row[s.id] + 1 : 0; });
    }
    setPlan(p); setDirty(true); setGenKey(k => k + 1); vibrate("light");
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
      if (h > s.norm) out.push(`${s.name}: переработка ${h - s.norm} ч`);
      if (mx > R.maxRow) out.push(`${s.name}: ${mx} смен подряд при пределе ${R.maxRow}`);
    });
    return [...new Set(out)];
  };

  const hoursOf = s => {
    let h = 0;
    for (let d = 1; d <= DAYS; d++) { const sh = shiftOf(plan[s.id]?.[d]); if (sh) h += len(sh); }
    return h;
  };
  const leadOn = d => {
    const m = staff.find(s => s.pos === "manager" && plan[s.id]?.[d] && !shiftOf(plan[s.id][d])?.extra);
    return m ? m.name : null;
  };

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
    const keys = ["", ...(cfg.shifts || []).map(x => x.k)];
    const cur = plan[s.id]?.[d] || "";
    const nx = keys[(keys.indexOf(cur) + 1) % keys.length];
    setPlan(p => ({ ...p, [s.id]: { ...(p[s.id] || {}), [d]: nx } }));
    setLocks(l => ({ ...l, [s.id]: { ...(l[s.id] || {}), [d]: 1 } }));
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
    <div className="sa-schedwrap" style={{
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
    const NAME = 150, CELL = 34, ROW = 30, HEAD = 96, FOOT = 58;
    const groups = POS.map(p => ({ ...p, list: staff.filter(x => x.pos === p.id) })).filter(g => g.list.length);
    const rows = groups.reduce((a, g) => a + g.list.length + 2, 0);   // +заголовок +строка добора
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
    x.fillText(`составлен ${new Date().toLocaleDateString("ru-RU")}`, 16, 74);

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

    groups.forEach(g => {
      // заголовок должности
      x.fillStyle = C.grpBg; x.fillRect(0, y, W, ROW);
      x.fillStyle = C.text; x.font = "600 11px ui-monospace, Menlo, monospace";
      x.fillText(g.t.toUpperCase(), 12, y + ROW / 2);
      x.font = "11px ui-monospace, Menlo, monospace";
      for (let d = 1; d <= DAYS; d++) {
        x.fillStyle = C.faint;
        x.fillText(String(needOf(d)[g.id] || 0), NAME + (d - 1) * CELL + CELL / 2 - 3, y + ROW / 2);
      }
      line(y); line(y + ROW); y += ROW;

      // люди
      g.list.forEach(s => {
        let h = 0;
        for (let d = 1; d <= DAYS; d++) { const sh = shiftOf(plan[s.id]?.[d]); if (sh) h += len(sh); }
        x.fillStyle = C.text; x.font = "13px Georgia, serif";
        x.fillText(s.name.length > 17 ? s.name.slice(0, 16) + "…" : s.name, 12, y + ROW / 2 - 5);
        x.fillStyle = C.faint; x.font = "10px ui-monospace, Menlo, monospace";
        x.fillText(`${h} / ${s.norm} ч`, 12, y + ROW / 2 + 8);
        for (let d = 1; d <= DAYS; d++) {
          const cx = NAME + (d - 1) * CELL;
          if (dow(d) >= 5 || holOf(d)) { x.fillStyle = C.weBg; x.fillRect(cx, y, CELL, ROW); }
          const k = plan[s.id]?.[d] || "";
          const vac = onVac(s, d), fix = !k && !vac && (s.off || []).includes(dow(d));
          x.font = "600 13px ui-monospace, Menlo, monospace";
          x.fillStyle = k ? C.text : vac ? C.hol : fix ? C.faint : C.empty;
          x.fillText(k || (vac ? "О" : fix ? "×" : "·"), cx + CELL / 2 - 5, y + ROW / 2);
        }
        line(y + ROW); y += ROW;
      });

      // добор
      x.font = "10px ui-monospace, Menlo, monospace";
      x.fillStyle = C.faint; x.fillText("есть / нужно", 12, y + ROW / 2);
      for (let d = 1; d <= DAYS; d++) {
        const n = needOf(d)[g.id] || 0;
        const have = g.list.filter(s => { const sh = shiftOf(plan[s.id]?.[d]); return sh && !sh.extra; }).length;
        const short = have < n;
        x.fillStyle = short ? C.bad : C.good;
        x.font = short ? "600 10px ui-monospace, Menlo, monospace" : "10px ui-monospace, Menlo, monospace";
        x.fillText(`${have}/${n}` + (short ? "!" : ""), NAME + (d - 1) * CELL + CELL / 2 - (short ? 12 : 9), y + ROW / 2);
      }
      line(y + ROW, C.lineHard); y += ROW;
    });

    // вертикальные линии недель
    x.strokeStyle = C.lineHard;
    for (let d = 1; d <= DAYS; d++) if (dow(d) === 0) {
      const cx = NAME + (d - 1) * CELL;
      x.beginPath(); x.moveTo(cx + .5, HEAD - 26); x.lineTo(cx + .5, y); x.stroke();
    }
    x.beginPath(); x.moveTo(NAME + .5, HEAD - 26); x.lineTo(NAME + .5, y); x.stroke();

    // подвал: расшифровка смен
    x.fillStyle = C.dim; x.font = "11px Georgia, serif";
    const legend = (cfg.shifts || []).map(sh =>
      `${sh.k} — ${sh.name} ${sh.from}:00–${sh.to > 24 ? sh.to - 24 : sh.to}:00${sh.extra ? " (вручную)" : ""}`
    ).concat(["О — отпуск", "× — постоянный выходной"]);
    let lx = 12, ly = y + 22;
    legend.forEach(t => {
      const w = x.measureText(t).width + 18;
      if (lx + w > W - 12) { lx = 12; ly += 17; }
      x.fillText(t, lx, ly); lx += w;
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

  const setupView = () => (
    <div style={card}>
      <div style={eyebrow}><span>Настройки графика</span><span style={{ color:P.acc }}>{staff.length} чел.</span></div>

      <Sec no={1} title="Часы работы" hint="Когда открываемся и закрываемся в каждый день недели" P={P} open={openSec===1} onToggle={() => setOpenSec(openSec===1?0:1)}>
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

      <Sec no={2} title="Смены" hint="Во сколько люди приходят и уходят" P={P} open={openSec===2} onToggle={() => setOpenSec(openSec===2?0:2)}>
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

      <Sec no={3} title="Сколько людей нужно" hint="Разное количество в будни, выходные и праздники" P={P} open={openSec===3} onToggle={() => setOpenSec(openSec===3?0:3)}>
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

      <Sec no={4} title="Правила смен" hint="Загрузка по дням недели, выходные и отдых" P={P} open={openSec===4} onToggle={() => setOpenSec(openSec===4?0:4)}>
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
        <div style={hintStyle}>Эти правила генератор не нарушает: он скорее оставит смену незакрытой, чем поставит человека сверх предела.</div>
      </Sec>

      <Sec no={5} title="Сотрудники" hint="Кто работает, на какой позиции и сколько часов" P={P} open={openSec===5} onToggle={() => setOpenSec(openSec===5?0:5)}>
        {staff.map((sf, i) => (
          <div key={sf.id} className="sa-schedemp" style={{ padding:10, borderRadius:12, marginBottom:7 }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:8, paddingBottom:2, minWidth:0 }}>
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
              выходные по датам · {MONTHS_R[M]}
              {offDays(sf).length ? <span style={{ color:P.acc }}> · выбрано {offDays(sf).length}</span> : null}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:4 }}>
              {Array.from({ length: DAYS }, (_, k) => k + 1).map(d => {
                const on = offDays(sf).includes(d);
                const weekly = (sf.off || []).includes(dow(d));
                return (
                  <button key={d} className="sa-btn" disabled={weekly}
                    onClick={() => patch(c => {
                      const st = c.staff[i];
                      if (!st.offDays) st.offDays = {};
                      const cur = st.offDays[mkey] || [];
                      st.offDays[mkey] = cur.includes(d) ? cur.filter(v => v !== d) : [...cur, d].sort((a, b) => a - b);
                      if (!st.offDays[mkey].length) delete st.offDays[mkey];
                    })}
                    style={{ padding:"7px 0", borderRadius:8, cursor: weekly ? "default" : "pointer",
                      fontFamily:mono, fontSize:11, opacity: weekly ? .35 : 1,
                      color: on ? INK_DEEP : (holOf(d) ? P.warn : P.sub),
                      background: on ? `linear-gradient(180deg,#E4C88C,${GOLD})` : "transparent",
                      border:`1px solid ${on ? GOLD : (a11y ? "rgba(175,140,65,.28)" : "rgba(145,108,40,.28)")}`,
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
          </div>
        ))}
        <button className="sa-btn" style={{ ...ghost, marginTop:4, padding:"10px 12px", fontSize:12.5 }}
          onClick={() => patch(c => {
            const id = Math.max(0, ...c.staff.map(x => +x.id || 0)) + 1;
            c.staff.push({ id, name:"Новый сотрудник", pos:"waiter", norm:160 });
          })}>+ добавить сотрудника</button>
        <div style={hintStyle}>Имена лучше писать так же, как в профиле сотрудника: по ним человек увидит свои смены.
          У каждого три вида нерабочих дней: <b>отпуск</b> — период в этом месяце, <b>дни недели</b> — постоянный
          шаблон вроде «не работает по вторникам», <b>выходные по датам</b> — разовые числа. Генератор не нарушает
          ни одно из них.</div>
      </Sec>
    </div>
  );

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
          <div style={eyebrow}><span>{me.name}</span><span style={{ color:P.acc }}>{hoursOf(me)} / {me.norm} ч</span></div>
          {Array.from({ length: DAYS }, (_, i) => i + 1).map(d => {
            const k = plan[me.id]?.[d], sh = k && shiftOf(k), vac = onVac(me, d), col = k && colorOf(k);
            return (
              <div key={d} className={"sa-schedrow" + (sh ? "" : " off")} style={{
                display:"flex", alignItems:"center", gap:11, padding:"9px 11px", marginTop:6, borderRadius:13,
                borderLeft: col ? `3px solid ${a11y ? col.bdL : col.bd}` : undefined,
              }}>
                <div style={{ flex:"0 0 44px", textAlign:"center" }}>
                  <div style={{ fontSize:17, color: holOf(d) ? P.warn : P.text }}>{d}</div>
                  <div style={{ fontFamily:mono, fontSize:8.5, color:P.sub }}>{DOWL[dow(d)]}</div>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, color:P.text }}>{vac && !sh ? "Отпуск" : sh ? sh.name : "Выходной"}</div>
                  <div style={{ fontSize:11.5, color:P.sub }}>
                    {sh ? `${sh.from}:00 – ${sh.to > 24 ? sh.to - 24 : sh.to}:00` : (holName(d) || "")}
                    {sh && leadOn(d) ? <span style={{ color:P.acc }}> · старший: {leadOn(d)}</span> : null}
                  </div>
                </div>
                <div style={{ fontFamily:mono, fontSize:11, color:P.acc }}>{sh ? len(sh) + " ч" : ""}</div>
              </div>
            );
          })}
        </div>
      </>)}
    </>);
  }

  // ── Вид менеджера: таблица ────────────────────────────────────────
  const warns = audit();
  let need = 0, have = 0;
  for (let d = 1; d <= DAYS; d++) POS.forEach(({ id: pos }) => {
    const n = needOf(d)[pos] || 0; need += n;
    have += Math.min(n, staff.filter(s => { const sh = s.pos === pos && shiftOf(plan[s.id]?.[d]); return sh && !sh.extra; }).length);
  });
  const covPct = need ? Math.round(have / need * 100) : 0;
  covTarget.current = covPct;

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
      <button style={{ ...ghost, fontSize:12.5, padding:"9px 8px" }} className="sa-btn"
        onClick={() => { setLocks({}); setDirty(true); }}>Снять закрепления</button>
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
        <div style={{ fontSize:13.5, lineHeight:1.6, color:P.text, marginBottom:12 }}>
          Стереть весь график за {MONTHS_R[M]} {Y}? Сотрудники, смены и правила останутся —
          сотрётся только расстановка и закрепления.
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={{ ...btn, background:P.dangerBg, color:P.dangerFg }} className="sa-btn"
            onClick={clearMonth}>Да, стереть</button>
          <button style={ghost} className="sa-btn" onClick={() => setConfirmClear(false)}>Отмена</button>
        </div>
      </div>
    ) : null}
    {msg ? <div style={{ textAlign:"center", fontSize:12, color:P.sub, marginTop:8 }}>{msg}</div> : null}

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
          {weekIdx == null
            ? "Весь месяц: таблица листается вбок. Выбери неделю — влезет без прокрутки"
            : "Тап по клетке меняет смену и закрепляет её"}
        </div>
        <div className="sa-schedgrid sa-hscroll">
          <table style={{ borderCollapse:"separate", borderSpacing:0, fontFamily:mono }}>
            <tbody key={"g" + genKey + ":" + weekIdx}>
              <tr>
                <th className="sa-schednm" style={{ width:100, minWidth:100 }} />
                {visibleDays.map(d => (
                  <th key={d} style={{ width:26, minWidth:26, fontSize:9, color:P.sub, padding:"3px 0", lineHeight:1.2,
                    borderLeft: dow(d) === 0 ? `1px solid ${GOLD}44` : undefined }}>
                    <b style={{ display:"block", fontSize:10.5, fontWeight:"normal",
                      color: holOf(d) ? P.warn : dow(d) >= 5 ? P.acc : SAND }}>{d}</b>
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
                      {visibleDays.map(d => (
                        <td key={d} className="sa-schedgrp" style={{ fontSize:8.5, minWidth:26, color:P.sub, height:22, textAlign:"center",
                          borderLeft: dow(d) === 0 ? `1px solid ${GOLD}44` : undefined }}>{needOf(d)[pos] || 0}</td>
                      ))}
                    </tr>
                    {list.map((s, ri) => {
                      const h = hoursOf(s), pct = Math.min(100, Math.round(h / (s.norm || 1) * 100));
                      return (
                        <tr key={s.id} className={ri % 2 ? "sa-schedzeb" : ""}>
                          <td className="sa-schednm" style={{ fontFamily:serif, fontSize:12.5, padding:"0 8px",
                            textAlign:"left", color:P.text }}>
                            {s.name}
                            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
                              <span className="sa-schedbar">
                                <span style={{ display:"block", height:"100%", width:pct + "%", borderRadius:2,
                                  background: h > s.norm ? "linear-gradient(90deg,#E07878,#C04A4A)" : "linear-gradient(90deg,#D4A85A,#C8A96E)" }} />
                              </span>
                              <span style={{ fontFamily:mono, fontSize:8, color:P.sub }}>{h}/{s.norm}</span>
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
                                  borderLeft: dow(d) === 0 ? `1px solid ${GOLD}44` : undefined }}>
                                <div style={{
                                  width:22, height:22, margin:"0 auto", borderRadius:6, display:"grid", placeItems:"center",
                                  fontSize:9, position:"relative",
                                  color: col ? (a11y ? col.fgL : col.fg)
                                    : vac ? (a11y ? "#8B3020" : "#E0A0A0")
                                    : fixedOff ? (a11y ? "#8A7A5C" : "#7A6A54")
                                    : (a11y ? "#B9AE97" : "#4A4136"),
                                  background: col ? (a11y ? col.bgL : col.bg)
                                    : vac ? (a11y ? "rgba(224,120,120,.14)" : "rgba(224,120,120,.10)")
                                    : "transparent",
                                  border: `1px solid ${col ? (a11y ? col.bdL : col.bd)
                                    : vac ? "rgba(224,120,120,.35)" : "transparent"}`,
                                  boxShadow: isLocked(s.id, d) ? `0 0 0 1.5px ${GOLD}D0` : undefined,
                                  animationDelay: `${ri * 45 + di * 7}ms`,
                                }} className={k ? "sa-schedchip" : undefined}
                                >{k || (vac ? "О" : fixedOff ? "×" : "·")}</div>
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
          💡 Замечаний: {warns.length}
          <ul style={{ margin:"7px 0 0", paddingLeft:17 }}>
            {warns.slice(0, 10).map((w, i) => <li key={i} style={{ marginBottom:4 }}>{w}</li>)}
            {warns.length > 10 ? <li>…и ещё {warns.length - 10}</li> : null}
          </ul>
        </div>
      )}
    </div>
    )}
    </>}
  </>);
}
