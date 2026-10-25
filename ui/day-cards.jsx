// ui/day-cards.jsx — ритм дня на главной (Доп. 298, 301, 302, 306, 356):
//   DayChips    — v43: табличка под приветствием — пламя серии, бокал «цель дня» (тап — выбрать цель
//                 1–3 шага) и венок «Путь мастера» в медальонах (до v43 — маленькие чипы в строке роли);
//                 DayStrip — свеча и стакан крупно (прежний вид, сейчас не используется);
//   WarmupCard  — «Разминка до смены» в день смены по графику (compact — тонкая строка
//                 под главной карточкой, после разминки пропадает);
//   WeekCard    — «Чек недели готов» (по понедельникам);
//   RemindSheet — «Напоминания в Telegram» за час до смены (этап 22б).
import React from "react";
import { createPortal } from "react-dom";
import { ensureTableCss } from "./table-css";
import { Candle, Glass, Ic, plural } from "./table-bits";
import { Flame, Wine, Laurel, Medal, Val, palette, nextStreakTier } from "./day-emblems";
import { onActivate, vibrate } from "../lib/utils";
import { labelStyle, LABEL_CSS } from "./tokens";   // v73 (Доп. 386): подписи курсивом вместо моноширинного капса
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { serverMissing } from "../lib/server-text";   // v58 (Доп. 371)

const C = (a11y) => (a11y
  ? { text: "#2A1F0E", sub: "#6B5B40", gold: "#7A5D2A", line: "rgba(150,112,40,0.30)", bg: "rgba(250,242,222,0.62)", card: "linear-gradient(180deg,rgba(236,214,166,0.5),rgba(250,242,222,0.72))", top: "rgba(175,135,50,0.58)" }
  : { text: "#EFE4C8", sub: "#A99B7E", gold: "#D9B87C", line: "rgba(214,178,102,0.32)", bg: "rgba(255,250,238,0.035)", card: "linear-gradient(180deg,rgba(214,178,102,0.17),rgba(214,178,102,0.05))", top: "rgba(226,190,120,0.46)" });

export function DayStrip({ a11y, streak, steps = 0, goal = 2, onGoal, today }) {
  ensureTableCss();
  const c = C(a11y);
  const [open, setOpen] = React.useState(false);
  const lit = !!(streak && streak.last && streak.last === today);
  const n = (streak && streak.count) || 0;
  const reached = steps >= goal;
  const pick = (g) => { vibrate("light"); setOpen(false); onGoal && onGoal(g); };
  return (
    <div className="tbv" style={{ margin: "0 14px 10px", display: "flex", gap: 8 }}>
      <div title={lit ? "Сегодня занимался, свеча горит" : "Пройди шаг, и свеча загорится"}
        style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 14, border: `1px solid ${c.line}`, background: c.bg }}>
        <Candle s={22} lit={lit} />
        <span style={{ minWidth: 0 }}>
          <b style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 14, color: c.text, lineHeight: 1.2 }}>{n ? n + " " + plural(n, "день", "дня", "дней") : "Серия"}</b>
          <span style={{ display: "block", fontSize: 11, color: c.sub, lineHeight: 1.3 }}>{lit ? "свеча горит" : n ? "зажги сегодня" : "начни сегодня"}</span>
        </span>
      </div>
      <div role="button" tabIndex={0} onClick={() => setOpen(true)} {...onActivate(() => setOpen(true))} aria-label={"Цель дня: " + Math.min(steps, goal) + " из " + goal + ". Изменить цель"}
        style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 14, border: `1px solid ${reached ? "rgba(93,187,138,0.5)" : c.line}`, background: c.bg, cursor: "pointer" }}>
        <Glass s={22} pct={Math.min(1, steps / goal)} />
        <span style={{ minWidth: 0 }}>
          <b style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 14, color: c.text, lineHeight: 1.2 }}>{Math.min(steps, goal)} / {goal}{reached ? " ✓" : ""}</b>
          <span style={{ display: "block", fontSize: 11, color: c.sub, lineHeight: 1.3 }}>{reached ? "цель дня есть" : "цель дня · " + plural(goal, "шаг", "шага", "шагов")}</span>
        </span>
      </div>
      {open ? createPortal(<GoalSheet a11y={a11y} goal={goal} onPick={pick} onClose={() => setOpen(false)} />, document.body) : null}
    </div>
  );
}

// Доп. 306: главная без лишнего ряда — свеча и стакан маленькими значками в строке роли
// v41 (Доп. 354): третий чип — «Путь мастера» (mastery = masteryChip() из ui/mastery-card.jsx:
// { icon, text, aria, dot }); тап — экран значков, новое — точкой. Раньше путь был карточкой под треком.
// v43 (Доп. 356): чипы стали табличкой под приветствием — три медальона с подписями: пламя (серия),
// бокал (цель дня), лавровый венок («Путь мастера»). Отзыв владельца: «мелко и невзрачно», «не нравятся
// сами иконки». Ободок медальона — прогресс: у пламени — до следующей вехи серии (3, 7, 30 дней, как
// у значка «Свеча»), у бокала — цель дня, у венка — значки. Нажатия — как были: бокал — выбрать цель,
// венок — «Путь мастера». Размеры — CSS-переменными: на узком экране (меньше 375 px) медальоны меньше,
// подписи короче («цель», «мастер»); на широком (430 px, тёмная тема) — длиннее: «дней подряд», «первые шаги».
// Цель выполнена — цифра зелёным и искра над бокалом (подпись та же: длинная не влезла бы в ячейку).
// v44 (Доп. 357): «более плотнее» — медальоны 32 px (на узком 28), поля ячеек 7 px.
const DP_CSS = `
.sa-dp{display:flex;align-items:stretch;border-radius:16px;--dp-m:32px;--dp-i:19px;--dp-l:25px}
.sa-dp-cell{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;gap:7px;padding:7px 5px;position:relative;cursor:pointer;border-radius:14px;-webkit-tap-highlight-color:transparent}
.sa-dp-cell.st{cursor:default}
.sa-dp-cell[role=button]:active{background:rgba(214,178,102,.10)}
.sa-dp-cell:focus-visible{outline:2px solid rgba(214,178,102,.7);outline-offset:-3px}
.sa-dp-txt{min-width:0;display:flex;flex-direction:column;align-items:flex-start}
.sa-dp-cap{display:block;${LABEL_CSS};font-size:12.5px;margin-top:3px;white-space:nowrap;line-height:1.1}
.sa-dp.lt .sa-dp-cap{font-size:13.5px}
.sa-dp-sep{width:1px;align-self:stretch;margin:8px 0;flex-shrink:0}
.sa-dp-w{display:none}
@media (min-width:430px){.sa-dp:not(.lt) .sa-dp-w{display:inline}.sa-dp:not(.lt) .sa-dp-n{display:none}}
@media (max-width:374px){.sa-dp{--dp-m:28px;--dp-i:17px;--dp-l:22px}.sa-dp-cell{gap:5px;padding:7px 3px}.sa-dp-x{display:none}}
`;
function ensureDayPanelCss() {
  if (typeof document === "undefined" || !document.head || !document.createElement) return;
  if (document.getElementById && document.getElementById("sa-day-panel-css")) return;
  const st = document.createElement("style");
  st.id = "sa-day-panel-css"; st.textContent = DP_CSS;
  document.head.appendChild(st);
}
export function DayChips({ a11y, streak, steps = 0, goal = 2, onGoal, today, mastery = null, onMastery, firstDay = false }) {
  ensureTableCss(); ensureDayPanelCss();
  const p = palette(a11y);
  const [open, setOpen] = React.useState(false);
  // v56 (Доп. 369): самый первый день — вместо трёх нулей («0 дней · 0/2 · 0/7») одна строка: серия, цель дня и
  // значки начнутся с первого урока. После первого шага — табличка как была.
  if (firstDay) {
    return (
      <div className={"tbv sa-dp" + (a11y ? " lt" : "")} data-day-panel="" data-first-day=""
        style={{ background: p.panel, border: "1px solid " + p.panelLine, borderTopColor: p.panelTop, boxShadow: p.shadow }}>
        <span role="img" className="sa-dp-cell st" aria-label="Первый день: серия, цель дня и значки начнутся с первого урока"
          style={{ justifyContent: "flex-start", gap: 11, padding: "8px 13px" }}>
          <Medal s="var(--dp-m,32px)" pct={0} a11y={a11y}><Flame s="var(--dp-i,19px)" lit={false} a11y={a11y} /></Medal>
          <span className="sa-dp-txt" aria-hidden="true">
            <Val main="Первый день" a11y={a11y} big={17} />
            <span style={{ fontSize: a11y ? 13 : 12, color: p.sub, marginTop: 4, lineHeight: 1.35 }}>серия, цель дня и значки начнутся с первого урока</span>
          </span>
        </span>
      </div>
    );
  }
  const lit = !!(streak && streak.last && streak.last === today);
  const n = (streak && streak.count) || 0;
  const reached = steps >= goal;
  const sx = Math.min(steps, goal), gp = goal ? Math.min(1, steps / goal) : 0;
  const pick = (g) => { vibrate("light"); setOpen(false); onGoal && onGoal(g); };
  const goMastery = () => { vibrate("light"); onMastery && onMastery(); };
  const openGoal = () => setOpen(true);
  const sep = <i className="sa-dp-sep" aria-hidden="true" style={{ background: "linear-gradient(180deg,transparent," + p.panelLine + ",transparent)" }} />;
  const cap = { color: p.sub };
  // «Путь мастера»: числа — из masteryChip (v43); у старого вызова без них — из текста «9/14»
  const mm = mastery ? (() => {
    const t = String(mastery.text || "").split("/");
    const have = mastery.have != null ? mastery.have : Number(t[0]) || 0, total = mastery.total != null ? mastery.total : Number(t[1]) || 14;
    return { have, total, pct: mastery.pct != null ? mastery.pct : (total ? have / total : 0), mode: mastery.mode || "path" };
  })() : null;
  const M = "var(--dp-m,32px)", I = "var(--dp-i,19px)", L = "var(--dp-l,25px)";
  return (
    <div className={"tbv sa-dp" + (a11y ? " lt" : "")} data-day-panel=""
      style={{ background: p.panel, border: "1px solid " + p.panelLine, borderTopColor: p.panelTop, boxShadow: p.shadow }}>
      <span role="img" className="sa-dp-cell st" data-dp-cell="streak" title={lit ? "Серия: сегодня занимался, свеча горит" : "Серия: пройди шаг, и свеча загорится"}
        aria-label={"Серия " + n + " " + plural(n, "день", "дня", "дней") + (lit ? ", сегодня свеча горит" : "")}>
        <Medal s={M} pct={Math.min(1, n / nextStreakTier(n))} glow={lit} a11y={a11y}><Flame s={I} lit={lit} a11y={a11y} /></Medal>
        <span className="sa-dp-txt" aria-hidden="true"><Val main={n} a11y={a11y} />
          <span className="sa-dp-cap" style={cap}>{plural(n, "день", "дня", "дней")}<span className="sa-dp-w"> подряд</span></span></span>
      </span>
      {sep}
      <span role="button" tabIndex={0} className="sa-dp-cell" data-dp-cell="goal" onClick={openGoal} {...onActivate(openGoal)} aria-label={"Цель дня: " + sx + " из " + goal + ". Изменить цель"}>
        <Medal s={M} pct={gp} a11y={a11y}><Wine s={I} pct={gp} a11y={a11y} /></Medal>
        <span className="sa-dp-txt" aria-hidden="true"><Val main={sx} of={goal} a11y={a11y} color={reached ? p.green : undefined} />
          <span className="sa-dp-cap" style={cap}>цель<span className="sa-dp-x"> дня</span></span></span>
      </span>
      {mm ? (<>
        {sep}
        <span role="button" tabIndex={0} className="sa-dp-cell" data-dp-cell="mastery" data-ms-chip="" onClick={goMastery} {...onActivate(goMastery)} aria-label={mastery.aria} title="Путь мастера">
          <Medal s={M} pct={mm.pct} a11y={a11y}><Laurel s={L} have={mm.have} total={mm.total} a11y={a11y} /></Medal>
          <span className="sa-dp-txt" aria-hidden="true"><Val main={mm.have} of={mm.total} a11y={a11y} />
            <span className="sa-dp-cap" style={cap}>{mm.mode === "first"
              ? <><span className="sa-dp-w">первые шаги</span><span className="sa-dp-n">старт</span></>
              : mm.mode === "master" ? "мастер" : plural(mm.total, "значок", "значка", "значков")}</span></span>
          {mastery.dot ? <span data-ms-chip-new="" aria-hidden="true" style={{ position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: "50%", boxSizing: "border-box",
            background: p.goldHi, border: "1.5px solid " + p.dotEdge }} /> : null}
        </span>
      </>) : null}
      {open ? createPortal(<GoalSheet a11y={a11y} goal={goal} onPick={pick} onClose={() => setOpen(false)} />, document.body) : null}
    </div>
  );
}

const GOALS = [
  { g: 1, t: "1 шаг", s: "лёгкий день: один урок или разминка" },
  { g: 2, t: "2 шага", s: "обычная смена: урок и практика" },
  { g: 3, t: "3 шага", s: "хочу быстрее пройти программу" },
];
function GoalSheet({ a11y, goal, onPick, onClose }) {
  const c = C(a11y);
  return (
    <div className="tbv" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: a11y ? "rgba(70,52,24,0.35)" : "rgba(8,6,3,0.62)", display: "flex", alignItems: "flex-end" }}>
      <div role="dialog" aria-modal="true" aria-label="Цель дня" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, margin: "0 auto", padding: "18px 18px calc(18px + env(safe-area-inset-bottom,0px))", borderRadius: "22px 22px 0 0", backgroundColor: a11y ? "#F6EEDC" : "#1E170C", backgroundImage: "var(--sheet-bg,none)", border: "1px solid var(--sheet-edge," + c.line + ")", borderTop: "1px solid var(--sheet-top," + c.line + ")", borderBottom: 0, boxShadow: "var(--sheet-shadow,none)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Wine s={30} pct={0.6} a11y={a11y} />
          <h3 style={{ margin: 0, fontFamily: "'Piazzolla', Georgia, serif", fontSize: 20, color: c.text }}>Цель дня</h3>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.5, color: c.sub }}>Сколько шагов в день: урок, практика, тест или разминка до смены. Бокал наполняется с каждым шагом. Он виден на главной, в шапке трека и в чеках.</p>
        {GOALS.map((x) => (
          <button key={x.g} type="button" className="sa-btn" onClick={() => onPick(x.g)}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", margin: "0 0 8px", padding: "12px 14px", borderRadius: 14, cursor: "pointer",
              border: `1px solid ${x.g === goal ? (a11y ? "#7A5D2A" : "#C8A96E") : c.line}`, background: x.g === goal ? c.card : "transparent", color: c.text }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 15, minWidth: 64 }}>{x.t}</span>
            <span style={{ flex: 1, fontSize: 13, color: c.sub, lineHeight: 1.35 }}>{x.s}</span>
            {x.g === goal ? <span style={{ color: a11y ? "#2C6B48" : "#8AD8AF" }}>✓</span> : null}
          </button>
        ))}
        <button type="button" data-sa-back="" onClick={onClose} className="sa-btn"
          style={{ display: "block", width: "100%", marginTop: 4, padding: 12, border: 0, background: "none", color: c.sub, fontSize: 14, fontWeight: "bold", cursor: "pointer" }}>Закрыть</button>
      </div>
    </div>
  );
}

export function WarmupCard({ a11y, shift, known = true, done, onStart, compact = false, children, what = "ситуации", pill = false }) {
  ensureTableCss();
  const c = C(a11y);
  if (compact && pill) {
    // v44 (Доп. 357): плашка внизу карточки трека, рядом с «Шагом дня»: «РАЗМИНКА» и «2 мин · вечер»
    // (время смены — на плитке «График смен»); подсказку «Напоминать в Telegram» RoleSelect ставит под плашками
    if (done) return null;
    const when = "2 мин" + (shift ? " · " + String(shift).split("·")[0].trim().toLowerCase() : known ? " · сегодня смена" : " · перед сменой");
    return (
      <div className="tbv" role="button" tabIndex={0} onClick={onStart} {...onActivate(onStart)} data-tb-warmup="" data-pill="warmup"
        aria-label={"Разминка до смены: " + when + ". Начать"}
        style={{ flex: "1 1 0", minWidth: 0, display: "flex", alignItems: "center", gap: 8, padding: "7px 9px 7px 10px", borderRadius: 12, cursor: "pointer",
          border: "1px solid " + c.line, background: a11y ? "rgba(255,252,244,0.6)" : "rgba(255,240,205,0.05)" }}>
        <span style={{ color: c.gold, display: "inline-flex", flexShrink: 0 }}><Ic n="clock" s={16} /></span>
        <span style={{ flex: 1, minWidth: 0 }} aria-hidden="true">
          <span style={{ display: "block", ...labelStyle(a11y ? 14 : 13), color: c.gold, lineHeight: 1.3 }}>Разминка</span>
          <span style={{ display: "block", fontSize: 12.5, color: c.text, lineHeight: 1.3, marginTop: 1 }}>{when}</span>
        </span>
        <span aria-hidden="true" style={{ color: c.gold, fontSize: 15, lineHeight: 1, flexShrink: 0 }}>›</span>
      </div>
    );
  }
  if (compact) {
    // Доп. 306: нижняя строка главной карточки (её часть, а не отдельная карточка);
    // сделал разминку — строка уходит
    if (done) return null;
    return (
      <div className="tbv">
        <div role="button" tabIndex={0} onClick={onStart} {...onActivate(onStart)} data-tb-warmup=""
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 13px 10px", cursor: "pointer", borderTop: `1px solid ${c.line}` }}>
          <span style={{ color: c.gold, display: "inline-flex", flexShrink: 0 }}><Ic n="clock" s={17} /></span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: c.text, lineHeight: 1.35 }}>
            {shift ? "Сегодня " + shift.replace(/^([^·]+)·\s*/, (m, a) => a.trim().toLowerCase() + ", ") : known ? "Сегодня смена" : "Перед сменой"}
            <span style={{ color: c.sub }}> · разминка 2 мин</span>
          </span>
          <span style={{ color: c.gold, fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold", whiteSpace: "nowrap" }}>Начать ›</span>
        </div>
        {children ? <div style={{ padding: "0 13px 9px", marginTop: -3 }}>{children}</div> : null}
      </div>
    );
  }
  if (done) {
    return (
      <div className="tbv" style={{ margin: "0 14px 10px", padding: "9px 13px", borderRadius: 14, border: "1px solid rgba(93,187,138,0.45)", background: c.bg, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: a11y ? "#2C6B48" : "#8AD8AF", display: "inline-flex" }}><Ic n="checkC" s={18} /></span>
        <span style={{ flex: 1, fontSize: 13, color: c.text, fontFamily: "Georgia, serif" }}>Разминка сделана. Хорошей смены!</span>
      </div>
    );
  }
  return (
    <div className="tbv" style={{ margin: "0 14px 10px" }}>
      <div className="sa-card" role="button" tabIndex={0} onClick={onStart} {...onActivate(onStart)} data-tb-warmup=""
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", borderRadius: 18, cursor: "pointer", background: c.card, border: `1px solid ${c.line}`, borderTop: `1px solid ${c.top}`,
          boxShadow: a11y ? "inset 0 0 22px rgba(255,255,255,0.6), inset 0 1px 0 rgba(255,255,255,0.95)" : "inset 0 0 22px rgba(255,240,205,0.08), inset 0 1px 0 rgba(255,255,255,0.13)" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", color: c.gold, border: `1.5px solid ${c.line}` }}><Ic n="clock" s={22} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...labelStyle(13), color: c.gold }}>Разминка до смены</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: c.text, lineHeight: 1.25, marginTop: 2 }}>2 минуты, 3 {what}</div>
          <div style={{ fontSize: 11.5, color: c.sub, marginTop: 2, lineHeight: 1.35 }}>{shift ? "Сегодня: " + shift : known ? "Сегодня смена по графику" : "Перед сменой освежи главное"}. Всё из того, что уже прошёл</div>
        </div>
        <div style={{ flexShrink: 0, padding: "9px 15px", borderRadius: 999, fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold", color: "#1A1008", background: "linear-gradient(180deg,#E4C88C,#C8A96E)" }}>Начать</div>
      </div>
      {children}
    </div>
  );
}

export function WeekCard({ a11y, onOpen, activeDays }) {
  ensureTableCss();
  const c = C(a11y);
  return (
    <div className="tbv sa-card" role="button" tabIndex={0} onClick={onOpen} {...onActivate(onOpen)}
      style={{ margin: "0 14px 10px", display: "flex", alignItems: "center", gap: 12, padding: "10px 13px", borderRadius: 16, cursor: "pointer", border: `1px solid ${c.line}`, background: c.bg }}>
      <span style={{ color: c.gold, display: "inline-flex" }}><Ic n="bill" s={22} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 14.5, color: c.text }}>Чек недели готов</b>
        <span style={{ display: "block", fontSize: 11.5, color: c.sub }}>{activeDays ? "В деле " + activeDays + " " + plural(activeDays, "день", "дня", "дней") + " из 7. Можно отправить команде" : "Что сделано за 7 дней. Можно отправить команде"}</span>
      </span>
      <span style={{ color: c.sub, fontSize: 20 }}>›</span>
    </div>
  );
}

// ── Доп. 304: «Напоминания в Telegram» — за час до смены бот зовёт на разминку ──
// Включает каждый сам. Telegram спрашивает разрешение писать (requestWriteAccess),
// сервер проверяет подпись initData и запоминает чат (этап 22б: tg_status / tg_link / tg_set).
const REM_KEY = "sa_tg_remind";
export function readRemindFlag(uk) { try { return localStorage.getItem(REM_KEY + (uk || "")) === "1"; } catch (e) { return false; } }
function saveRemindFlag(uk, v) { try { localStorage.setItem(REM_KEY + (uk || ""), v ? "1" : "0"); } catch (e) {} }
export const inTelegramApp = () => { try { return !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData); } catch (e) { return false; } };

// v31: что ещё присылать (этап 25: notify_prefs / notify_set). Без этапа 25 — блока нет.
const PREF_ROWS = [
  ["pair", "Свеча на двоих", "вечером, если напарник уже занимался, а ты ещё нет"],
  ["quest", "Квест смены", "когда старший зовёт на разминку"],
  ["league", "Лига недели", "итоги недели по понедельникам"],
  ["fresh", "Свежесть тем", "по четвергам, если темы выдыхаются"],
  ["month", "Итоги месяца", "первого числа: твой месяц в карточках"],
  ["master", "Мастера заведения", "когда коллега становится мастером роли"],   // v40, этап 26
  ["qday", "Вопрос дня", "в 12:00 вопрос с кнопками ответа: из твоих ошибок и пройденных тем"],   // v81, этап 31
  ["brief", "Брифинг смены", "когда руководитель отправляет брифинг команде"],   // v82, этап 32
];
// Строки для ответа notify_prefs. Вид «master» знает только этап 26: сервер этапа 25 его не присылает
// и не принял бы (notify_set → kind) — тогда строки нет.
// v81: так же «Вопрос дня» — только с этапом 31; час — от сервера (qday_hour). v82: «Брифинг смены» — с этапом 32
const LATER_KINDS = new Set(["master", "qday", "brief"]);
export const prefRows = (p) => PREF_ROWS.filter(([k]) => !LATER_KINDS.has(k) || (!!p && p[k] !== undefined))
  .map(([k, t, sub]) => (k === "qday" && p && Number.isInteger(p.qday_hour) ? [k, t, sub.replace("12:00", p.qday_hour + ":00")] : [k, t, sub]));
function NotifyPrefs({ a11y, c, onLoad }) {
  const [p, setP] = React.useState(null);
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    rpc("notify_prefs", { p_token: saToken() }).then((r) => { if (alive && r && r.ok) { setP(r); if (onLoad) onLoad(r); } }).catch(() => {});
    return () => { alive = false; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return null;
  const flip = (k) => {
    if (busy) return;
    const on = !p[k];
    setBusy(k); setMsg(""); setP((x) => ({ ...x, [k]: on }));
    rpc("notify_set", { p_token: saToken(), p_kind: k, p_on: on }).then((r) => {
      setBusy("");
      if (r && r.ok) { setP(r); vibrate("light"); } else { setP((x) => ({ ...x, [k]: !on })); setMsg("Не сохранилось. Попробуй ещё раз."); }
    }).catch(() => { setBusy(""); setP((x) => ({ ...x, [k]: !on })); setMsg("Нет связи. Попробуй ещё раз."); });
  };
  return (
    <div data-notify-prefs="" style={{ marginTop: 14 }}>
      <div style={{ ...labelStyle(13.5), color: c.gold, margin: "0 0 4px" }}>Что ещё присылать</div>
      {prefRows(p).map(([k, t, sub]) => {
        const on = !!p[k];
        return (
          <button key={k} type="button" role="switch" aria-checked={on} onClick={() => flip(k)} disabled={busy === k} className="sa-btn"
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "10px 2px", border: 0, borderBottom: `1px dashed ${c.line}`, background: "none", cursor: "pointer", color: c.text }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 14.5, fontWeight: "bold" }}>{t}</span>
              <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.4, color: c.sub }}>{sub}</span>
            </span>
            <span aria-hidden="true" style={{ flex: "0 0 auto", position: "relative", width: 40, height: 24, borderRadius: 12, border: `1px solid ${on ? c.gold : c.line}`, background: on ? (a11y ? "rgba(139,106,48,0.25)" : "rgba(200,169,110,0.35)") : "transparent", transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: "50%", background: on ? (a11y ? "#8B6A30" : "#E4C88C") : c.sub, transform: on ? "translateX(16px)" : "none", transition: "transform .2s" }} />
            </span>
          </button>
        );
      })}
      {msg ? <p role="status" style={{ margin: "8px 0 0", fontSize: 13, color: c.text }}>{msg}</p> : null}
    </div>
  );
}

// v40: «Шаг дня» в напоминании — одной строкой и не длиннее 140 знаков, как режет сервер (этап 26)
export function stepLine(t) {
  const s = String(t == null ? "" : t).replace(/[\s\u0000-\u001F\u007F-\u009F]+/g, " ").trim();
  const ch = Array.from(s);
  return ch.length > 140 ? ch.slice(0, 139).join("").replace(/\s+$/, "") + "…" : s;
}
// Так выглядит сообщение бота за час до смены. Текст — дословно как у бота: v74 (Доп. 387, этап 29) — без шапки
// «✦ SERVICE ACADEMY» и звёздочек, кнопка «Разминка». step — текст «Шага дня» (v40): строка под текстом, перед кнопкой.
export function RemindExample({ c = C(false), when = "час", shift = "", step = "" }) {
  const st = stepLine(step);
  return (
    <div aria-label="Пример сообщения" style={{ padding: "10px 12px", borderRadius: "16px 16px 16px 4px", border: `1px solid ${c.line}`, background: c.bg }}>
      <div style={{ fontSize: 13.5, lineHeight: 1.45, color: c.text }}>{"Через " + when + " смена: " + (shift || "Вечер · 16:00–24:00")}</div>
      <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.45, color: c.sub }}>Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!</div>
      {st ? <div data-remind-step="" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45, color: c.text }}>{"Шаг дня: " + st}</div> : null}
      <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: 10, textAlign: "center", fontSize: 13, fontWeight: "bold", color: c.gold, border: `1px solid ${c.line}` }}>Разминка</div>
    </div>
  );
}

export function RemindSheet({ a11y, uk = "", lead = false, admin = false, shift = "", step = "", onClose, onChange }) {
  ensureTableCss();
  const c = C(a11y);
  const tg = typeof window !== "undefined" && window.Telegram ? window.Telegram.WebApp : null;
  const inTg = inTelegramApp();
  const [st, setSt] = React.useState({ phase: "load" });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [has26, setHas26] = React.useState(false);   // v40: сервер знает «Путь мастера» (этап 26)
  const apply = (remind) => { saveRemindFlag(uk, remind); if (onChange) onChange(remind); };
  React.useEffect(() => {
    let alive = true;
    rpc("tg_status", { p_token: saToken() }).then((res) => {
      if (!alive) return;
      if (rpcMissing(res)) { setSt({ phase: "missing" }); return; }
      if (!res || !res.ok) { setSt({ phase: "error", text: res && res.error === "auth" ? "Сессия устарела. Перезайди по коду." : "Не получилось узнать, включены ли напоминания." }); return; }
      setSt({ phase: "ready", bot: !!res.bot, linked: !!res.linked, remind: !!res.remind, minutes: res.minutes || 60 });
      apply(!!(res.linked && res.remind));
    }).catch(() => { if (alive) setSt({ phase: "offline" }); });
    return () => { alive = false; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const enable = () => {
    if (!inTg || busy || !tg) return;
    setBusy(true); setMsg("");
    const link = () => rpc("tg_link", { p_token: saToken(), p_init_data: tg.initData, p_remind: true }).then((res) => {
      setBusy(false);
      if (res && res.ok) { setSt((x) => ({ ...x, linked: true, remind: true })); apply(true); setMsg("Готово, бот прислал сообщение в чат."); vibrate("success"); return; }
      const e = res && res.error;
      setMsg(e === "no_bot" ? "Бот ещё не подключён на сервере. Скажи руководителю." : (e === "bad_init" || e === "stale") ? "Telegram не подтвердил вход. Закрой приложение и открой заново через бота." : e === "auth" ? "Сессия устарела. Перезайди по коду." : rpcMissing(res) ? "Сервер ещё не обновлён. Скажи руководителю." : "Не получилось включить. Попробуй ещё раз.");
      vibrate("error");
    }).catch(() => { setBusy(false); setMsg("Нет связи. Попробуй ещё раз."); });
    try {
      if (typeof tg.requestWriteAccess === "function") {
        tg.requestWriteAccess((granted) => { if (granted) link(); else { setBusy(false); setMsg("Без разрешения бот не сможет написать. Нажми «Включить» ещё раз и выбери «Разрешить»."); } });
      } else link();
    } catch (e) { link(); }
  };
  const disable = () => {
    if (busy) return;
    setBusy(true); setMsg("");
    rpc("tg_set", { p_token: saToken(), p_remind: false }).then((res) => {
      setBusy(false);
      if (res && res.ok) { setSt((x) => ({ ...x, remind: false })); apply(false); setMsg("Выключено. Включить снова можно здесь же."); }
      else setMsg("Не получилось выключить. Попробуй ещё раз.");
    }).catch(() => { setBusy(false); setMsg("Нет связи. Попробуй ещё раз."); });
  };
  const on = st.phase === "ready" && st.linked && st.remind;
  const mins = st.minutes || 60;
  const when = mins === 60 ? "час" : mins + " мин";
  const note = (t) => <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: c.sub }}>{t}</p>;
  const mainBtn = { display: "block", width: "100%", marginTop: 12, padding: 13, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", color: "#1A1008", background: "linear-gradient(180deg,#E4C88C,#C8A96E)" };
  return createPortal(
    <div className="tbv" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: a11y ? "rgba(70,52,24,0.35)" : "rgba(8,6,3,0.62)", display: "flex", alignItems: "flex-end" }}>
      <div role="dialog" aria-modal="true" aria-label="Напоминания в Telegram" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box", margin: "0 auto", padding: "18px 18px calc(18px + env(safe-area-inset-bottom,0px))", borderRadius: "22px 22px 0 0", backgroundColor: a11y ? "#F6EEDC" : "#1E170C", backgroundImage: "var(--sheet-bg,none)", border: "1px solid var(--sheet-edge," + c.line + ")", borderTop: "1px solid var(--sheet-top," + c.line + ")", borderBottom: 0, boxShadow: "var(--sheet-shadow,none)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ color: c.gold, display: "inline-flex" }}><Ic n="bell" s={24} /></span>
          <h3 style={{ margin: 0, fontFamily: "'Piazzolla', Georgia, serif", fontSize: 20, color: c.text }}>Напоминания в Telegram</h3>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.5, color: c.sub }}>
          За {when} до смены по графику бот пришлёт сообщение с кнопкой разминки: 2 минуты, 3 задания из пройденного.{lead ? " Старшим ещё приходят запросы на подтверждение навыков в зале." : ""}
        </p>
        {/* так выглядит сообщение (v40: со строкой «Шаг дня», если App его передал) */}
        {/* v40: строку «Шаг дня» бот добавляет только с этапом 26 — его видно по виду «master» в настройках */}
        <RemindExample c={c} when={when} shift={shift} step={has26 ? step : ""} />
        {st.phase === "load" ? note("Проверяю…") : null}
        {st.phase === "missing" ? note(serverMissing({ what: "напоминания", many: true, admin, sql: "supabase-stage22b-telegram-reminders.sql" })) : null}{/* v58 (Доп. 371); v74: комментарий был снаружи фигурных скобок и показывался на экране */}
        {st.phase === "offline" ? note("Нет связи. Открой это окно, когда появится сеть.") : null}
        {st.phase === "error" ? note(st.text) : null}
        {st.phase === "ready" && !st.bot ? note(admin ? "Бот ещё не подключён: нужен токен бота в настройках Supabase (этап 22б)." : "Бот ещё не подключён на сервере. Скажи владельцу.") : null}
        {st.phase === "ready" && st.bot ? (on ? (
          <>
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(93,187,138,0.5)", color: a11y ? "#2C6B48" : "#8AD8AF", fontSize: 14, fontFamily: "Georgia, serif" }}>✓ Включено: за {when} до смены</div>
            <NotifyPrefs a11y={a11y} c={c} onLoad={(p) => setHas26(!!p && p.master !== undefined)} />
            <button type="button" className="sa-btn" onClick={disable} disabled={busy}
              style={{ display: "block", width: "100%", marginTop: 10, padding: 12, borderRadius: 999, cursor: "pointer", background: "transparent", border: `1px solid ${c.line}`, color: c.text, fontSize: 14, fontWeight: "bold" }}>{busy ? "Минуту…" : "Выключить"}</button>
          </>
        ) : inTg ? (
          <button type="button" className="sa-btn" onClick={enable} disabled={busy} style={mainBtn}>{busy ? "Минуту…" : "Включить"}</button>
        ) : note("Напоминания приходят от бота в Telegram. Открой Service Academy через бота и включи их здесь.")) : null}
        {st.phase !== "ready" && st.phase !== "load" && !inTg ? note("Включить можно в приложении внутри Telegram.") : null}
        {msg ? <p role="status" style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45, color: c.text }}>{msg}</p> : null}
        <button type="button" data-sa-back="" onClick={onClose} className="sa-btn"
          style={{ display: "block", width: "100%", marginTop: 8, padding: 12, border: 0, background: "none", color: c.sub, fontSize: 14, fontWeight: "bold", cursor: "pointer" }}>Закрыть</button>
      </div>
    </div>, document.body);
}
