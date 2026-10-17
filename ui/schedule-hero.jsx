// ui/schedule-hero.jsx — верх графика сотрудника (v46, Доп. 359).
// Владелец выбрал из предложений по графику «Карточку смены + медальоны»:
//   • ShiftHero — ближайшая смена главной карточкой, как плитка «График смен» на главной: крупный листок
//     календаря с числом, «Вечер», время золотом, «через 1 ч 40 мин» / «идёт · ещё 3 ч», старший смены
//     со звонком, «Чек-лист смены» (в день смены), «Кто со мной», «Повторить перед сменой» (сегодня или
//     завтра смена и есть вопросы на повтор), а у сегодняшней смены — золотая нить суток по нижнему краю;
//   • MonthMedals — итоги месяца тремя медальонами, как табличка ритма дня на главной: часы (кольцо до
//     нормы), заработок, смены. Подписи под ними — то, что раньше было строками и капсулами: «до нормы
//     34 ч ≈ 5 см.», «норма закрыта», «+3 520 ₽ за 2 смены», «из них 6 пиковых»; расчёт заработка
//     и прошлый месяц — строкой под табличкой.
// Расчёты — чистые функции (nextShift, shiftStatus, staffMonthCells): их проверяют тесты.
import React from "react";
import { ACCENT_SERIF } from "./styles";
import { palette, Medal, Val } from "./day-emblems";
import { CalendarPage, DayThread } from "./schedule-tile";

const mono = "ui-monospace, Menlo, monospace", serif = "Georgia, serif";

// «1 ч 40 мин», «2 ч», «35 мин»
export const leftText = (mins) => {
  const m = Math.max(0, Math.round(mins)), h = Math.floor(m / 60), r = m % 60;
  return h && r ? `${h} ч ${r} мин` : h ? `${h} ч` : `${r} мин`;
};
// конец смены в часах от начала её дня: 16→24 — 24, ночная 19→3 — 27
const endOf = (sh) => (sh.to <= sh.from ? sh.to + 24 : sh.to);

// Ближайшая смена с сегодняшнего дня. Сегодняшняя, которая уже закончилась, не в счёт — дальше следующая
// (раньше после утренней смены вечером карточка всё ещё звала «сегодня · Утро»).
export function nextShift({ row, shiftOf, todayD, days, nowH }) {
  if (!todayD) return null;
  for (let d = todayD; d <= days; d++) {
    const sh = shiftOf(row && row[d]);
    if (!sh) continue;
    if (d === todayD && nowH >= endOf(sh)) continue;
    return { d, sh };
  }
  return null;
}

// До начала — «через …», во время — «идёт · ещё …»; другие дни — без подписи
export function shiftStatus(sh, isToday, nowH) {
  if (!isToday || !sh) return { kind: "later", text: "" };
  if (nowH < sh.from) return { kind: "soon", text: "через " + leftText((sh.from - nowH) * 60) };
  if (nowH < endOf(sh)) return { kind: "now", text: "идёт · ещё " + leftText((endOf(sh) - nowH) * 60) };
  return { kind: "done", text: "" };
}

const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };
const rub = (n) => Math.round(n).toLocaleString("ru-RU");

// Подписи медальонов. hours/norm — часы и норма месяца (норма уже с учётом отпуска, vac — что учтена),
// pay — { sum, mode: "hour"|"shift"|"month", note, per } (per — сколько приносит одна смена), prev — прошлый
// месяц, shifts/peaks — смены и пиковые из них, avg — средняя длина смены (для «≈ N см.»).
export function staffMonthCells({ hours, norm, vac, pay, prev, shifts, peaks, avg }) {
  const lack = norm > 0 && hours < norm ? norm - hours : 0;
  const cells = [{
    key: "hours", pct: norm > 0 ? Math.min(1, hours / norm) : 0, main: hours, of: norm > 0 ? norm : null, cap: "часов",
    // неразрывные пробелы: «34 ч ≈ 5 см.» не рвётся на «5 / см.» в узкой ячейке
    sub: norm > 0 && hours >= norm ? "норма закрыта ✦" : lack ? `до нормы ${lack}\u00A0ч ≈\u00A0${Math.ceil(lack / Math.max(1, avg || 12))}\u00A0см.` : "",
    sub2: vac ? "отпуск учтён" : "",
  }];
  if (pay) cells.push({
    key: "pay", main: rub(pay.sum), cap: pay.mode === "month" ? "оклад" : "≈ за месяц",
    sub: pay.mode !== "month" && pay.per > 0 ? `+${rub(pay.per * 2)}\u00A0₽ за\u00A02\u00A0смены` : pay.mode === "month" ? "в месяц" : "", sub2: "",
  });
  cells.push({ key: "shifts", main: shifts, cap: plural(shifts, "смена", "смены", "смен"), sub: peaks > 0 ? `из них ${peaks} ${plural(peaks, "пиковая", "пиковые", "пиковых")}` : "в графике", sub2: "" });
  const note = pay ? `≈ ${rub(pay.sum)} ₽ — ${pay.note}${pay.mode !== "month" ? ", по сменам в графике" : ""}${prev > 0 ? ` · прошлый месяц ≈ ${rub(prev)} ₽` : ""}` : "";
  return { cells, note };
}

// v48: те же три медальона — в карточке сотрудника у руководителя. Подписи — для руководителя: сколько не хватает
// до нормы или сколько сверх, как посчитан заработок; расчёт с прошлым месяцем — строкой под табличкой.
export function personMonthCells({ hours, norm, vac, pay, prev, shifts, peaks, avg }) {
  const lack = norm > 0 && hours < norm ? norm - hours : 0, over = norm > 0 && hours > norm ? hours - norm : 0;
  const cells = [{
    key: "hours", pct: norm > 0 ? Math.min(1, hours / norm) : 0, main: hours, of: norm > 0 ? norm : null, cap: "часов",
    sub: over ? `+${over} ч сверх нормы` : norm > 0 && hours >= norm ? "норма закрыта ✦"
      : lack ? `до нормы ${lack} ч ≈ ${Math.ceil(lack / Math.max(1, avg || 12))} см.` : "",
    sub2: vac ? "отпуск учтён" : "",
  }];
  if (pay) cells.push({ key: "pay", main: rub(pay.sum), cap: pay.mode === "month" ? "оклад" : "≈ за месяц",
    sub: pay.mode === "month" ? "в месяц" : String(pay.note || "").replace(/ /g, " "), sub2: "" });
  cells.push({ key: "shifts", main: shifts, cap: plural(shifts, "смена", "смены", "смен"), sub: peaks > 0 ? `из них ${peaks} ${plural(peaks, "пиковая", "пиковые", "пиковых")}` : "в графике", sub2: "" });
  return { cells, note: prev > 0 ? `прошлый месяц ≈ ${rub(prev)} ₽` : "" };
}

const ICONS = {
  hours: (c) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  pay: (c) => <span style={{ fontFamily: ACCENT_SERIF, fontWeight: 700, fontSize: 16, lineHeight: 1, color: c }}>₽</span>,
  shifts: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" style={{ display: "block" }}><path d="M12 3.5l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 15.8l-5 2.9 1.2-5.6L4 9.3l5.6-.6z" /></svg>,
};

// Итоги месяца тремя медальонами (без ставки — двумя). payMain — узел с числом (в графике — с «досчётом»)
// style — v48: в карточке сотрудника табличка стоит без внешних отступов; compact — там же: медальон и цифры
// чуть мельче, чтобы «128/160» влезало в ячейку и на узком экране (лист уже карточки графика)
export function MonthMedals({ a11y, cells, note, payMain, style, compact }) {
  const p = palette(a11y), ms = compact ? 30 : 34, dz = compact ? 2 : 0;
  return (
    <div data-sched-medals="" style={{ margin: "12px 14px 0", flexShrink: 0, ...(style || {}) }}>
      <div style={{ display: "flex", alignItems: "stretch", borderRadius: 16, border: `1px solid ${p.panelLine}`, borderTop: `1px solid ${p.panelTop}`, background: p.panel, boxShadow: p.shadow }}>
        {cells.map((x, i) => (
          <div key={x.key} data-medal-cell={x.key} style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px 9px", borderLeft: i ? `1px solid ${p.panelLine}` : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: "100%" }}>
              <Medal s={ms} pct={x.pct || 0} a11y={a11y}>{ICONS[x.key](p.gold)}</Medal>
              {x.key === "pay" && payMain ? <Val main={payMain} a11y={a11y} big={(cells.length > 2 ? 17 : 19) - dz} /> : <Val main={x.main} of={x.of} a11y={a11y} big={(x.key === "pay" ? (cells.length > 2 ? 17 : 19) : 20) - dz} />}
            </div>
            <div style={{ fontFamily: mono, fontSize: a11y ? 11 : 9, letterSpacing: a11y ? 0.4 : 1, textTransform: "uppercase", color: p.sub }}>{x.cap}</div>
            {x.sub ? <div data-medal-sub="" style={{ fontSize: a11y ? 11.5 : 10.5, lineHeight: 1.25, color: p.gold, textAlign: "center" }}>{x.sub}</div> : null}
            {x.sub2 ? <div style={{ fontSize: a11y ? 11 : 10, lineHeight: 1.25, color: p.sub, textAlign: "center" }}>{x.sub2}</div> : null}
          </div>
        ))}
      </div>
      {note ? <div data-medal-note="" style={{ fontSize: 11, color: p.sub, margin: "6px 4px 0", lineHeight: 1.45 }}>{note}</div> : null}
    </div>
  );
}

// Ближайшая смена главной карточкой. when — «сегодня»/«завтра»/«» (тогда пишется «вт · 21 октября»),
// dowName — полный день недели, leadNode — капсула старшего со звонком (CallName из графика), mates — сколько
// человек с тобой в смене, due — { n, onMistakes } — вопросы на повтор перед сменой.
export function ShiftHero({ a11y, card, d, sh, when, dowName, dowShort, monthR, isToday, now, lead, leadNode, callNode, mates, onMates, onChecklist, due }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(t); }, []);
  const p = palette(a11y);
  const t = now || new Date(), nowH = t.getHours() + t.getMinutes() / 60;
  const st = shiftStatus(sh, isToday, nowH);
  const to = sh.to > 24 ? sh.to - 24 : sh.to;
  const len = endOf(sh) - sh.from;
  const eyebrow = { fontFamily: mono, fontSize: a11y ? 11 : 9, letterSpacing: a11y ? 1 : 2.4, textTransform: "uppercase" };
  const pill = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, fontFamily: serif, fontSize: 12.5, cursor: "pointer", WebkitTapHighlightColor: "transparent", whiteSpace: "nowrap" };
  const gold = { ...pill, fontWeight: "bold", color: "#1A1008", background: "linear-gradient(180deg,#E4C88C,#C8A96E)" };
  const ghost = { ...pill, color: p.gold, border: `1px solid ${a11y ? "rgba(139,106,48,0.45)" : "rgba(200,169,110,0.45)"}`, background: a11y ? "rgba(255,252,244,0.6)" : "rgba(255,250,238,0.03)" };
  const act = (fn) => (fn ? { role: "button", tabIndex: 0, onClick: fn, onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } } } : {});
  const label = (when ? when + " · " + dowName : dowShort + " · " + d + " " + monthR);
  return (
    // flexShrink 0: экран графика — колонка flex фиксированной высоты, и карточка с overflow:hidden иначе
    // сжимается в полоску (как секции до Доп. 66)
    <div data-sched-hero="" data-hero-status={st.kind} style={{ ...card, position: "relative", overflow: "hidden", flexShrink: 0, paddingBottom: isToday ? 16 : 14 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ paddingTop: 5 }}><CalendarPage day={d} p={p} a11y={a11y} w={46} h={50} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...eyebrow, color: p.gold }}>{label}</div>
          <div style={{ fontFamily: serif, fontSize: 21, marginTop: 3, lineHeight: 1.15, color: p.text }}>{sh.name}</div>
          <div style={{ marginTop: 3, display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 7 }}>
            <span data-hero-time="" style={{ fontFamily: ACCENT_SERIF, fontWeight: 700, fontSize: 19, color: p.gold, whiteSpace: "nowrap" }}>{sh.from}:00–{to}:00</span>
            <span style={{ fontSize: 12.5, color: p.sub, whiteSpace: "nowrap" }}>{len} ч{st.text ? " · " + st.text : ""}</span>
          </div>
        </div>
      </div>
      {lead ? (
        <div data-hero-lead="" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 13, padding: "9px 11px", borderRadius: 12,
          background: a11y ? "rgba(255,252,244,0.6)" : "rgba(255,250,238,0.035)", border: `1px solid ${a11y ? "rgba(150,112,40,0.3)" : "rgba(145,108,40,0.28)"}` }}>
          <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, fontFamily: serif, fontSize: 12.5, color: p.text,
            background: "linear-gradient(180deg,rgba(214,178,102,0.26),rgba(214,178,102,0.10))", border: `1px solid ${p.gold}`, boxShadow: "0 0 0 3px rgba(214,178,102,0.16)" }}>
            {String(lead).trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...eyebrow, fontSize: a11y ? 10.5 : 8.5, color: p.sub }}>старший смены</div>
            <div style={{ fontFamily: serif, fontSize: 14, marginTop: 2, color: p.text }}>{leadNode || lead}</div>
          </div>
          {callNode || null}
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {onChecklist ? <span data-hero-checklist="" style={gold} {...act(onChecklist)}>✓ Чек-лист смены</span> : null}
        <span data-hero-mates="" style={ghost} {...act(onMates)}>Кто со мной{mates > 0 ? " · " + mates : ""}</span>
      </div>
      {due && due.n > 0 && due.onMistakes ? (
        <div data-hero-due="" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10, fontSize: 12.5, color: p.text }}>
          <span><b style={{ color: p.gold }}>{due.n}</b> {due.n === 1 ? "вопрос ждёт" : due.n < 5 ? "вопроса ждут" : "вопросов ждут"} повтора</span>
          <span style={{ ...ghost, padding: "5px 11px", fontSize: 11.5 }} {...act(due.onMistakes)}>Повторить перед сменой</span>
        </div>
      ) : null}
      {isToday ? <DayThread sh={sh} h={nowH} p={p} a11y={a11y} /> : null}
    </div>
  );
}

// Смен в этом месяце больше нет — та же карточка, тихо
export function NoShiftHero({ a11y, card, todayD }) {
  const p = palette(a11y);
  return (
    <div data-sched-hero="" data-hero-status="none" style={{ ...card, flexShrink: 0, display: "flex", alignItems: "center", gap: 14 }}>
      <CalendarPage day={todayD} p={p} a11y={a11y} off w={40} h={44} />
      <div>
        <div style={{ fontFamily: mono, fontSize: a11y ? 11 : 9, letterSpacing: a11y ? 1 : 2.4, textTransform: "uppercase", color: p.sub }}>ближайшая смена</div>
        <div style={{ fontSize: 14, color: p.sub, marginTop: 3 }}>в этом месяце смен больше нет</div>
      </div>
    </div>
  );
}
