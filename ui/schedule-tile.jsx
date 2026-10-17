// ui/schedule-tile.jsx — плитка «График смен» на главной (v45, Доп. 358).
// Отзыв владельца на плитку v44: «Все кайф, но вот график… Как мы его можем сделать красивее?» Выбран
// вариант «Г · Листок + нить»:
//   • слева — отрывной листок календаря: красная планка, два золотых кольца, сегодняшнее число; снизу
//     выглядывает край следующего листка;
//   • заголовок — жирный, как у «Книги отзывов»; под ним — «Вечер · 17:00–24:00», время — золотом;
//   • по нижнему краю — золотая нить суток, как у «Книги отзывов»: смена — золотым отрезком (через
//     полночь — двумя), «сейчас» — светлой риской, пока смена идёт — с сиянием.
// Выходной — «Сегодня выходной ✦», нить без отрезка; графика на сегодня нет — прежняя подпись, без нити.
// Узкой плитке время уходит строкой ниже вместе с точкой-разделителем: точка в начале строки срезается.
import React from "react";
import { ACCENT_SERIF } from "./styles";
import { CREAM, INK } from "./tokens";
import { palette } from "./day-emblems";
import { ymd } from "../lib/streak";

// «Вечер · 17:00–24:00» → { name, from, to, a, b }; «выходной» → { off }; другая подпись → { raw }
export function parseShift(label) {
  if (!label) return null;
  const s = String(label).trim();
  if (!s) return null;
  if (/^выходной$/i.test(s)) return { off: true };
  const m = /^(.*?)\s*·\s*(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return { raw: s };
  return { name: m[1].trim(), from: +m[2] + +m[3] / 60, to: +m[4] + +m[5] / 60, a: m[2] + ":" + m[3], b: m[4] + ":" + m[5] };
}
// длина смены в часах (через полночь — тоже): 17→24 = 7, 22→6 = 8
export const shiftLen = (sh) => { const d = (((sh.to - sh.from) % 24) + 24) % 24; return d || 24; };
// идёт ли смена в час h (0–24, дробный)
export function shiftNow(sh, h) {
  if (!sh || sh.from == null) return false;
  return ((((h - sh.from) % 24) + 24) % 24) < shiftLen(sh);
}
// отрезки смены на шкале суток 0–24: 17→24 — [[17, 24]], 22→6 — [[22, 24], [0, 6]]
export const daySegments = (sh) => (sh.from + shiftLen(sh) <= 24 ? [[sh.from, sh.from + shiftLen(sh)]] : [[sh.from, 24], [0, sh.from + shiftLen(sh) - 24]]);
// сводка «моя смена сегодня» (lib/schedule-sync.js) — только за сегодняшнее число
export function readTodayShift(storage, now = new Date()) {
  try {
    const ls = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const r = ls ? JSON.parse(ls.getItem("sa_today_shift") || "null") : null;
    return r && r.date === ymd(now) && r.label ? String(r.label) : null;
  } catch (e) { return null; }
}

// Подпись: «Вечер · 17:00–24:00» — время золотом; «Сегодня выходной ✦»; без графика — запасная фраза
function When({ sh, p, fallback }) {
  const base = { fontSize: 11, lineHeight: 1.3, color: p.sub, marginTop: 3, fontFamily: "Georgia, serif" };
  if (sh && sh.off) return <div data-when="off" style={base}>Сегодня выходной{" "}<span style={{ color: p.gold }}>✦</span></div>;
  if (sh && sh.a) return (
    <div data-when="shift" style={{ ...base, overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", marginLeft: -10 }}>
        <span style={{ marginLeft: 10, whiteSpace: "nowrap" }}>{sh.name}</span>
        <span data-when-time="" style={{ marginLeft: 10, position: "relative", whiteSpace: "nowrap", fontFamily: ACCENT_SERIF, fontWeight: 700, fontSize: 11.5, color: p.gold, letterSpacing: 0.1 }}>
          <span aria-hidden="true" data-when-dot="" style={{ position: "absolute", left: -7.5, fontFamily: "Georgia, serif", fontWeight: 400, color: p.sub }}>·</span>
          {sh.a}–{sh.b}
        </span>
      </div>
    </div>
  );
  return <div data-when="none" style={base}>{sh && sh.raw ? "Сегодня: " + sh.raw : fallback}</div>;
}

// Листок отрывного календаря: красная планка, два кольца, сегодняшнее число; снизу — край следующего листка.
// v46: размер задаётся (w × h) — крупный листок у ближайшей смены в графике сотрудника; 31 × 34 — как на плитке.
export function CalendarPage({ day, p, a11y, off, w = 31, h = 34 }) {
  const k = w / 31, r = (x) => +(x * k).toFixed(2);
  const ring = { position: "absolute", top: r(-3), width: r(3), height: r(7), borderRadius: 2, background: `linear-gradient(180deg, ${p.goldHi}, ${p.goldLo})`, boxShadow: a11y ? "0 1px 1px rgba(90,60,20,0.25)" : "0 1px 1px rgba(0,0,0,0.45)" };
  return (
    <span aria-hidden="true" data-sched-page="" style={{ position: "relative", display: "block", width: w, height: h, flexShrink: 0 }}>
      {/* v47: край следующего листка виден только ПОД листком. В тёмной теме листок полупрозрачный, и верх
          подложки (5 px) просвечивал сквозь него светлой полосой по низу числа — обрезаем его. */}
      <span data-page-under="" style={{ position: "absolute", left: r(2.5), right: r(2.5), bottom: r(-3), height: r(8), borderRadius: `0 0 ${r(6)}px ${r(6)}px`, border: `1px solid ${a11y ? "rgba(139,106,48,0.30)" : "rgba(217,184,124,0.24)"}`, borderTop: "none",
        background: a11y ? "#F3E8CF" : "rgba(255,240,205,0.06)", clipPath: `inset(${r(5)}px 0 0 0)`, WebkitClipPath: `inset(${r(5)}px 0 0 0)` }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: r(7), overflow: "hidden", display: "flex", flexDirection: "column", border: `1px solid ${a11y ? "rgba(139,106,48,0.45)" : "rgba(217,184,124,0.45)"}`,
        background: a11y ? "#FFFCF4" : "linear-gradient(180deg, rgba(255,240,205,0.13), rgba(255,240,205,0.05))",
        boxShadow: a11y ? "0 2px 6px rgba(120,85,25,0.16)" : "0 3px 8px rgba(0,0,0,0.42)" }}>
        <span style={{ height: Math.round(h * 0.265), flexShrink: 0, background: "linear-gradient(180deg, #C2533A, #8A3220)", boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.22)" }} />
        <span data-sched-day="" style={{ flex: 1, display: "grid", placeItems: "center", fontFamily: ACCENT_SERIF, fontWeight: 700, fontSize: Math.round(h * 0.47), lineHeight: 1, color: off ? p.sub : p.gold }}>{day}</span>
      </span>
      <i style={{ ...ring, left: r(7.5) }} />
      <i style={{ ...ring, right: r(7.5) }} />
    </span>
  );
}

// Нить суток по нижнему краю плитки: смена — золотым отрезком, «сейчас» — светлой риской
// (v46: та же нить — у ближайшей смены в графике сотрудника)
export function DayThread({ sh, h, p, a11y }) {
  const pct = (x) => +Math.max(0, Math.min(100, (x / 24) * 100)).toFixed(2);
  const on = shiftNow(sh, h);
  return (
    <div aria-hidden="true" data-sched-thread="" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2.5, background: a11y ? "rgba(120,90,40,0.18)" : "rgba(0,0,0,0.45)" }}>
      {sh ? daySegments(sh).map(([a, b], i) => (
        <i key={i} data-seg={a + "-" + b} style={{ position: "absolute", top: 0, bottom: 0, left: pct(a) + "%", width: +(pct(b) - pct(a)).toFixed(2) + "%", background: `linear-gradient(90deg, ${p.goldLo}, ${p.goldHi})`,
          boxShadow: `0 0 6px ${a11y ? "rgba(156,118,52,0.45)" : "rgba(226,196,132,0.55)"}` }} />
      )) : null}
      <i data-now={on ? "on" : "off"} style={{ position: "absolute", bottom: 0, left: `calc(${pct(h)}% - 1px)`, width: 2, height: 7, borderRadius: "1px 1px 0 0",
        background: on ? (a11y ? "#5A3F12" : "#FFF6DC") : p.gold, boxShadow: on ? `0 0 6px ${a11y ? "rgba(156,118,52,0.7)" : "rgba(255,236,190,0.9)"}` : "none" }} />
    </div>
  );
}

// tile — общий вид плиток ряда (как у «Книги отзывов»), frame — цвет рамки; label — подпись смены
// (по умолчанию — сводка «моя смена сегодня»), now — для проверок
export function ScheduleTile({ a11y, mgr, tile, frame, onOpen, act, label, now }) {
  const [, tick] = React.useState(0);
  // риска «сейчас» и число на листке — раз в минуту
  React.useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(t); }, []);
  const p = palette(a11y);
  const d = now || new Date(), h = d.getHours() + d.getMinutes() / 60;
  const sh = parseShift(label !== undefined ? label : readTodayShift(null, d));
  const name = mgr ? "График смен" : "Мой график";
  const fallback = mgr ? "Составить, проверить и опубликовать" : "Смены, время и старший смены";
  const aria = name + ". " + (sh && sh.off ? "Сегодня выходной" : sh && sh.a ? "Сегодня: " + sh.name + ", " + sh.a + "–" + sh.b : sh && sh.raw ? "Сегодня: " + sh.raw : fallback);
  return (
    <div className="sa-card sa-glass" data-tile="schedule" aria-label={aria} onClick={onOpen} {...act} style={{ ...tile, border: `1px solid ${frame}` }}>
      <div style={{ overflow: "hidden", position: "relative", borderRadius: 12.5, height: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 9, padding: "9px 10px 10.5px" }}>
        <CalendarPage day={d.getDate()} p={p} a11y={a11y} off={!!(sh && sh.off)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.25, color: a11y ? INK : CREAM, whiteSpace: "nowrap", fontFamily: "Georgia, serif", fontWeight: "bold" }}>{name}</div>
          <When sh={sh} p={p} fallback={fallback} />
        </div>
        {sh && (sh.a || sh.off) ? <DayThread sh={sh.a ? sh : null} h={h} p={p} a11y={a11y} /> : null}
      </div>
    </div>
  );
}
