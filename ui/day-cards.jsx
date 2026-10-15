// ui/day-cards.jsx — ритм дня на главной (Доп. 298, 301, 302, 306):
//   DayChips    — свеча серии и стакан «цель дня» маленькими значками в строке роли
//                 (тап по стакану — выбрать цель 1–3 шага), v41 — и чип «Путь мастера»; DayStrip — то же крупно;
//   WarmupCard  — «Разминка до смены» в день смены по графику (compact — тонкая строка
//                 под главной карточкой, после разминки пропадает);
//   WeekCard    — «Чек недели готов» (по понедельникам);
//   RemindSheet — «Напоминания в Telegram» за час до смены (этап 22б).
import React from "react";
import { createPortal } from "react-dom";
import { ensureTableCss } from "./table-css";
import { Candle, Glass, Ic, plural } from "./table-bits";
import { onActivate, vibrate } from "../lib/utils";
import { rpc, saToken, rpcMissing } from "../api/supabase";

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
      <div title={lit ? "Сегодня занимался — свеча горит" : "Пройди шаг — и свеча загорится"}
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
export function DayChips({ a11y, streak, steps = 0, goal = 2, onGoal, today, mastery = null, onMastery }) {
  ensureTableCss();
  const c = C(a11y);
  const [open, setOpen] = React.useState(false);
  const lit = !!(streak && streak.last && streak.last === today);
  const n = (streak && streak.count) || 0;
  const reached = steps >= goal;
  const pick = (g) => { vibrate("light"); setOpen(false); onGoal && onGoal(g); };
  // v41: в светлой теме «Для чтения» — 13 px, как остальной мелкий текст (в тёмной — 12, как было)
  const chip = { display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px 3px 6px", borderRadius: 999, border: `1px solid ${c.line}`, background: c.bg, fontFamily: "Georgia, serif", fontSize: a11y ? 13 : 12, color: c.text, lineHeight: 1.2, whiteSpace: "nowrap" };
  const goMastery = () => { vibrate("light"); onMastery && onMastery(); };
  return (
    <span className="tbv" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <span style={chip} title={lit ? "Серия: сегодня занимался — свеча горит" : "Серия: пройди шаг — и свеча загорится"} aria-label={"Серия " + n + " " + plural(n, "день", "дня", "дней") + (lit ? ", сегодня свеча горит" : "")}>
        <Candle s={15} lit={lit} />{n}
      </span>
      <span role="button" tabIndex={0} onClick={() => setOpen(true)} {...onActivate(() => setOpen(true))} aria-label={"Цель дня: " + Math.min(steps, goal) + " из " + goal + ". Изменить цель"}
        style={{ ...chip, cursor: "pointer", borderColor: reached ? "rgba(93,187,138,0.5)" : c.line }}>
        <Glass s={15} pct={Math.min(1, steps / goal)} />{Math.min(steps, goal)}/{goal}{reached ? " ✓" : ""}
      </span>
      {mastery ? (
        <span role="button" tabIndex={0} data-ms-chip="" onClick={goMastery} {...onActivate(goMastery)} aria-label={mastery.aria} title="Путь мастера"
          style={{ ...chip, cursor: "pointer", position: "relative" }}>
          {mastery.icon}{mastery.text}
          {mastery.dot ? <span data-ms-chip-new="" aria-hidden="true" style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", boxSizing: "border-box",
            background: c.gold, border: `1.5px solid ${a11y ? "#F3EAD6" : "#17120A"}` }} /> : null}
        </span>
      ) : null}
      {open ? createPortal(<GoalSheet a11y={a11y} goal={goal} onPick={pick} onClose={() => setOpen(false)} />, document.body) : null}
    </span>
  );
}

const GOALS = [
  { g: 1, t: "1 шаг", s: "лёгкий день — один урок или разминка" },
  { g: 2, t: "2 шага", s: "обычная смена — урок и практика" },
  { g: 3, t: "3 шага", s: "хочу быстрее пройти программу" },
];
function GoalSheet({ a11y, goal, onPick, onClose }) {
  const c = C(a11y);
  return (
    <div className="tbv" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: a11y ? "rgba(70,52,24,0.35)" : "rgba(8,6,3,0.62)", display: "flex", alignItems: "flex-end" }}>
      <div role="dialog" aria-modal="true" aria-label="Цель дня" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, margin: "0 auto", padding: "18px 18px calc(18px + env(safe-area-inset-bottom,0px))", borderRadius: "22px 22px 0 0", backgroundColor: a11y ? "#F6EEDC" : "#1E170C", backgroundImage: "var(--sheet-bg,none)", border: "1px solid var(--sheet-edge," + c.line + ")", borderTop: "1px solid var(--sheet-top," + c.line + ")", borderBottom: 0, boxShadow: "var(--sheet-shadow,none)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Glass s={26} pct={0.6} />
          <h3 style={{ margin: 0, fontFamily: "'Piazzolla', Georgia, serif", fontSize: 20, color: c.text }}>Цель дня</h3>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.5, color: c.sub }}>Сколько шагов в день: урок, практика, тест или разминка до смены. Стакан наполняется — на главной и в чеках.</p>
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

export function WarmupCard({ a11y, shift, known = true, done, onStart, compact = false, children, what = "ситуации" }) {
  ensureTableCss();
  const c = C(a11y);
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
        <span style={{ flex: 1, fontSize: 13, color: c.text, fontFamily: "Georgia, serif" }}>Разминка сделана — хорошей смены!</span>
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
          <div style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: 1.6, color: c.gold, textTransform: "uppercase" }}>Разминка до смены</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: c.text, lineHeight: 1.25, marginTop: 2 }}>2 минуты — 3 {what}</div>
          <div style={{ fontSize: 11.5, color: c.sub, marginTop: 2, lineHeight: 1.35 }}>{shift ? "Сегодня: " + shift : known ? "Сегодня смена по графику" : "Перед сменой — освежить главное"} · из того, что уже прошёл</div>
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
        <span style={{ display: "block", fontSize: 11.5, color: c.sub }}>{activeDays ? "в деле " + activeDays + " " + plural(activeDays, "день", "дня", "дней") + " из 7 · можно отправить команде" : "что сделано за 7 дней — можно отправить команде"}</span>
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
  ["pair", "Свеча на двоих", "вечером, если напарник уже занимался, а ты — ещё нет"],
  ["quest", "Квест смены", "когда старший зовёт на разминку"],
  ["league", "Лига недели", "итоги недели — по понедельникам"],
  ["fresh", "Свежесть тем", "по четвергам, если темы выдыхаются"],
  ["month", "Итоги месяца", "первого числа — твой месяц в карточках"],
  ["master", "Мастера заведения", "когда коллега становится мастером роли ✦"],   // v40, этап 26
];
// Строки для ответа notify_prefs. Вид «master» знает только этап 26: сервер этапа 25 его не присылает
// и не принял бы (notify_set → kind) — тогда строки нет.
export const prefRows = (p) => PREF_ROWS.filter(([k]) => k !== "master" || (!!p && p.master !== undefined));
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
      if (r && r.ok) { setP(r); vibrate("light"); } else { setP((x) => ({ ...x, [k]: !on })); setMsg("Не сохранилось — попробуй ещё раз."); }
    }).catch(() => { setBusy(""); setP((x) => ({ ...x, [k]: !on })); setMsg("Нет связи — попробуй ещё раз."); });
  };
  return (
    <div data-notify-prefs="" style={{ marginTop: 14 }}>
      <div style={{ fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.8, color: c.gold, margin: "0 0 4px" }}>ЧТО ЕЩЁ ПРИСЫЛАТЬ</div>
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
// Так выглядит сообщение бота за час до смены. step — текст «Шага дня» (v40): строка под текстом, перед кнопкой.
export function RemindExample({ c = C(false), when = "час", shift = "", step = "" }) {
  const st = stepLine(step);
  return (
    <div aria-label="Пример сообщения" style={{ padding: "10px 12px", borderRadius: "16px 16px 16px 4px", border: `1px solid ${c.line}`, background: c.bg }}>
      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 1.6, color: c.gold }}>✦ SERVICE ACADEMY</div>
      <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.45, color: c.text }}>{"Через " + when + " смена: " + (shift || "Вечер · 16:00–24:00")}</div>
      <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.45, color: c.sub }}>Разминка до смены — 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены ✦</div>
      {st ? <div data-remind-step="" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45, color: c.text }}>{"Шаг дня: " + st}</div> : null}
      <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: 10, textAlign: "center", fontSize: 13, fontWeight: "bold", color: c.gold, border: `1px solid ${c.line}` }}>Разминка ✦</div>
    </div>
  );
}

export function RemindSheet({ a11y, uk = "", lead = false, shift = "", step = "", onClose, onChange }) {
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
      if (!res || !res.ok) { setSt({ phase: "error", text: res && res.error === "auth" ? "Сессия устарела — перезайди по коду." : "Не получилось узнать, включены ли напоминания." }); return; }
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
      if (res && res.ok) { setSt((x) => ({ ...x, linked: true, remind: true })); apply(true); setMsg("Готово — бот прислал сообщение в чат."); vibrate("success"); return; }
      const e = res && res.error;
      setMsg(e === "no_bot" ? "Бот ещё не подключён на сервере — скажи руководителю." : (e === "bad_init" || e === "stale") ? "Telegram не подтвердил вход. Закрой приложение и открой заново через бота." : e === "auth" ? "Сессия устарела — перезайди по коду." : rpcMissing(res) ? "Сервер ещё не обновлён — скажи руководителю." : "Не получилось включить — попробуй ещё раз.");
      vibrate("error");
    }).catch(() => { setBusy(false); setMsg("Нет связи — попробуй ещё раз."); });
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
      else setMsg("Не получилось выключить — попробуй ещё раз.");
    }).catch(() => { setBusy(false); setMsg("Нет связи — попробуй ещё раз."); });
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
          За {when} до смены по графику бот напишет и откроет разминку — 2 минуты, 3 задания из пройденного.{lead ? " Старшим ещё приходят запросы на подтверждение навыков в зале." : ""}
        </p>
        {/* так выглядит сообщение (v40: со строкой «Шаг дня», если App его передал) */}
        {/* v40: строку «Шаг дня» бот добавляет только с этапом 26 — его видно по виду «master» в настройках */}
        <RemindExample c={c} when={when} shift={shift} step={has26 ? step : ""} />
        {st.phase === "load" ? note("Проверяю…") : null}
        {st.phase === "missing" ? note("Сервер ещё не готов: руководителю нужно выполнить этап 22б в Supabase.") : null}
        {st.phase === "offline" ? note("Нет связи — открой это окно, когда появится сеть.") : null}
        {st.phase === "error" ? note(st.text) : null}
        {st.phase === "ready" && !st.bot ? note("Бот ещё не подключён на сервере — скажи руководителю.") : null}
        {st.phase === "ready" && st.bot ? (on ? (
          <>
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(93,187,138,0.5)", color: a11y ? "#2C6B48" : "#8AD8AF", fontSize: 14, fontFamily: "Georgia, serif" }}>✓ Включено — за {when} до смены</div>
            <NotifyPrefs a11y={a11y} c={c} onLoad={(p) => setHas26(!!p && p.master !== undefined)} />
            <button type="button" className="sa-btn" onClick={disable} disabled={busy}
              style={{ display: "block", width: "100%", marginTop: 10, padding: 12, borderRadius: 999, cursor: "pointer", background: "transparent", border: `1px solid ${c.line}`, color: c.text, fontSize: 14, fontWeight: "bold" }}>{busy ? "Минуту…" : "Выключить"}</button>
          </>
        ) : inTg ? (
          <button type="button" className="sa-btn" onClick={enable} disabled={busy} style={mainBtn}>{busy ? "Минуту…" : "Включить"}</button>
        ) : note("Напоминания приходят от бота в Telegram. Открой Service Academy через бота — и включи здесь.")) : null}
        {st.phase !== "ready" && st.phase !== "load" && !inTg ? note("Включить можно в приложении внутри Telegram.") : null}
        {msg ? <p role="status" style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45, color: c.text }}>{msg}</p> : null}
        <button type="button" data-sa-back="" onClick={onClose} className="sa-btn"
          style={{ display: "block", width: "100%", marginTop: 8, padding: 12, border: 0, background: "none", color: c.sub, fontSize: 14, fontWeight: "bold", cursor: "pointer" }}>Закрыть</button>
      </div>
    </div>, document.body);
}
