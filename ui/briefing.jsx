// ui/briefing.jsx — v82 (Доп. 395): брифинг смены.
//
// BriefScreen — руководителю: приложение само собирает пятиминутку из того, что знает (кто сегодня в графике,
//   стоп-лист и новинки меню, фокус смены по ошибкам команды, вопрос команде, «спасибо» лидерам недели), руководитель
//   включает и выключает блоки, дописывает «Своё» и: «Провести» — крупным шрифтом по одному блоку с секундомером
//   (пять минут), «Отправить команде» — этап 32: брифинг дня в «Смене» у всех и сообщение в Telegram.
// BriefCard / BriefView — сотруднику: опубликованный брифинг дня в «Смене», открывается тем же показом.
import React from "react";
import { createPortal } from "react-dom";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { programAll } from "../data/modules";
import { useAllModules } from "../lib/use-content";
import { cachedShared } from "../lib/deck-extras";
import { BRIEF_ORDER, BRIEF_TITLE, buildBrief, briefShown, briefText, briefHours, voiceLabel } from "../lib/briefing";

const LETTERS = ["А", "Б", "В", "Г"];
const C = (a11y) => ({
  gold: a11y ? "#7A5D2A" : "#D2A85A",
  text: a11y ? "#2A1F0E" : "#EFE4C8",
  sub: a11y ? "#6B5B40" : "#A99A7C",
  line: a11y ? "rgba(139,106,48,0.28)" : "rgba(214,178,102,0.22)",
  red: a11y ? "#A0412F" : "#E08A7A",
  frost: {
    background: a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.09)",
    border: a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)",
    boxShadow: a11y ? "inset 0 0 26px rgba(255,255,255,0.55), 0 6px 18px rgba(120,85,25,0.14)" : "inset 0 0 26px rgba(255,248,230,0.07), 0 8px 24px rgba(0,0,0,0.45)",
    borderRadius: 18,
  },
});
const mmss = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
// слой на весь экран, как «Сборка» (ui/build.jsx): в полноэкранном Telegram — под его кнопками (--sa-st)
const SHELL = (a11y) => ({ position: "fixed", inset: 0, top: "var(--sa-st, 0px)", zIndex: 1000, boxSizing: "border-box", fontFamily: "Georgia, serif",   // шрифт приложения: слой — вне #root
  background: a11y ? "#E8DEC8" : "linear-gradient(160deg,#1A1008 0%,#1A1008 100%)", paddingBottom: "env(safe-area-inset-bottom, 0px)" });
const HEAD = { display: "flex", alignItems: "center", gap: 10, padding: "max(14px, calc(44px - var(--sa-st, 0px))) 16px 10px" };
// Слои — порталом в body, как урок-диалог и «Сборка» в App: внутри анимируемой обёртки экрана position: fixed
// считается от неё, и шапка приложения оказывалась поверх слоя. Без DOM (тесты на сервере) — на месте.
const portal = (el) => (typeof document !== "undefined" && document.body && document.body.nodeType === 1 ? createPortal(el, document.body) : el);
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };

// ── Содержимое блока (одно и то же — в списке, в показе и у сотрудника) ──────────
function BlockBody({ k, b, c, big = false, reveal = true, onReveal }) {
  // данные приходят и с сервера (брифинг дня): чужой формат не роняет экран, блок просто пустой
  if (k === "note" ? typeof b !== "string" : k === "ask" ? !(b && typeof b === "object" && Array.isArray(b.options)) : !Array.isArray(b)) return null;
  const fs = big ? 21 : 14.5, small = big ? 15 : 12.5;
  const row = { fontFamily: "Georgia, serif", fontSize: fs, color: c.text, lineHeight: 1.45 };
  if (k === "roster") return (
    <div>{b.map((s) => (
      <div key={s.k} style={{ marginBottom: big ? 14 : 8 }}>
        <div style={{ ...labelStyle(big ? 16 : 13), color: c.gold, marginBottom: 2 }}>{s.name} · {briefHours(s)}</div>
        {(s.groups && s.groups.length ? s.groups : [{ t: "", names: s.people || [] }]).map((g, i) => (
          <div key={i} style={row}>{g.t ? <span style={{ color: c.sub, fontSize: small + 1 }}>{g.t}: </span> : null}{g.names.join(", ")}</div>))}
      </div>))}</div>);
  if (k === "stop") return <div style={row}>{b.join(", ")}</div>;
  if (k === "fresh") return (
    <div>{b.map((d) => (
      <div key={d.id} style={{ ...row, marginBottom: 4 }}>{d.name}{d.voice ? <span style={{ fontSize: small, color: c.sub }}> · есть {voiceLabel(d.voice)}</span> : null}</div>))}</div>);
  if (k === "focus") return (
    <div>{b.map((f, i) => (
      <div key={i} style={{ marginBottom: big ? 18 : 10 }}>
        <div style={row}>«{f.q}»</div>
        <div style={{ fontSize: small + 1, color: c.text, marginTop: 4 }}><span style={{ color: c.gold }}>Верно:</span> {f.right}</div>
        {f.why ? <div style={{ fontSize: small, color: c.sub, marginTop: 3, lineHeight: 1.45 }}>{f.why}</div> : null}
        <div style={{ fontSize: small - 1, color: c.sub, marginTop: 3 }}>Ошибаются {f.pct}% · ответов за 30 дней: {f.n}{f.topic ? " · " + f.topic : ""}</div>
      </div>))}</div>);
  if (k === "ask") return (
    <div>
      <div style={row}>«{b.q}»</div>
      <div style={{ marginTop: 8 }}>{b.options.map((o, i) => (
        <div key={i} style={{ fontSize: small + 1, color: reveal && i === b.correct ? c.gold : c.text, fontWeight: reveal && i === b.correct ? "bold" : "normal", marginBottom: 3 }}>{LETTERS[i]}. {o}</div>))}</div>
      {reveal ? (b.why ? <div style={{ fontSize: small, color: c.sub, marginTop: 6, lineHeight: 1.45 }}>{b.why}</div> : null)
        : <button type="button" data-brief-reveal="" onClick={(e) => { e.stopPropagation(); vibrate("light"); onReveal && onReveal(); }}
            style={{ marginTop: 10, padding: "8px 16px", borderRadius: 999, border: `1px solid ${c.gold}`, background: "transparent", color: c.gold, fontFamily: "Georgia, serif", fontSize: small, cursor: "pointer" }}>Показать ответ</button>}
    </div>);
  if (k === "thanks") return (
    <div>{b.map((t, i) => (
      <div key={i} style={{ ...row, marginBottom: 4 }}>{t.name}{t.surname ? " " + t.surname : ""} <span style={{ fontSize: small, color: c.sub }}>· {t.pts} {plural(t.pts, "очко", "очка", "очков")} за неделю</span></div>))}</div>);
  if (k === "note") return <div style={{ ...row, whiteSpace: "pre-wrap" }}>{b}</div>;
  return null;
}

// ── Показ: по одному блоку крупно, секундомер на пять минут ──────────────────────
export function BriefPresenter({ brief, a11y, onClose, author }) {
  const c = C(a11y);
  const pages = BRIEF_ORDER.filter((k) => briefShown(brief, k));
  const [i, setI] = React.useState(0);
  const [sec, setSec] = React.useState(0);
  const [reveal, setReveal] = React.useState(false);
  React.useEffect(() => { const t = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(t); }, []);
  const go = (d) => { const n = Math.max(0, Math.min(pages.length - 1, i + d)); if (n !== i) { vibrate("light"); setI(n); } };
  const tx = React.useRef(null);
  const k = pages[i];
  const over = sec >= 300;
  return portal(
    <div data-brief-show="" role="dialog" aria-modal="true" aria-label="Брифинг смены" className="sa-layer sa-safex" style={{ ...SHELL(a11y), display: "flex", flexDirection: "column" }}
      onTouchStart={(e) => { tx.current = e.touches[0].clientX; }} onTouchEnd={(e) => { const s = tx.current; tx.current = null; if (s == null) return; const dx = e.changedTouches[0].clientX - s; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); }}>
      <div style={HEAD}>
        <button type="button" data-sa-back="" aria-label="Закрыть" onClick={onClose} style={{ border: 0, background: "none", color: c.sub, fontSize: 28, cursor: "pointer", lineHeight: 1, padding: "0 6px 2px 0" }}>×</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 15, color: c.text }}>Брифинг · {brief.dayLabel}</div>
          {author ? <div style={{ fontSize: 12, color: c.sub }}>{author}</div> : null}
        </div>
        <div data-brief-timer="" aria-label="Время брифинга" style={{ fontFamily: "Georgia, serif", fontSize: 18, color: over ? c.red : c.gold, fontVariantNumeric: "tabular-nums" }}>{mmss(sec)}</div>
      </div>
      <div style={{ display: "flex", gap: 4, padding: "0 16px 12px" }}>{pages.map((p, n) => <span key={p} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= i ? c.gold : c.line }} />)}</div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 22px 20px" }}>
        {k ? <>
          <div data-brief-page={k} style={{ ...labelStyle(18), color: c.gold, marginBottom: 14 }}>{BRIEF_TITLE[k]}</div>
          <BlockBody k={k} b={brief.blocks[k]} c={c} big reveal={k !== "ask" || reveal} onReveal={() => setReveal(true)} />
        </> : <div style={{ fontFamily: "Georgia, serif", fontSize: 18, color: c.sub }}>В брифинге пока пусто.</div>}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "10px 16px 14px" }}>
        <button type="button" onClick={() => go(-1)} disabled={i === 0} style={{ flex: 1, padding: 14, borderRadius: 16, border: `1px solid ${c.line}`, background: "transparent", color: c.text, fontFamily: "Georgia, serif", fontSize: 15, opacity: i === 0 ? 0.4 : 1, cursor: "pointer" }}>‹ Назад</button>
        {i < pages.length - 1
          ? <button type="button" data-brief-next="" onClick={() => go(1)} style={{ flex: 1.4, padding: 14, borderRadius: 16, border: 0, background: c.gold, color: "#1A1008", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", cursor: "pointer" }}>Дальше ›</button>
          : <button type="button" onClick={onClose} style={{ flex: 1.4, padding: 14, borderRadius: 16, border: 0, background: c.gold, color: "#1A1008", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", cursor: "pointer" }}>Хорошей смены</button>}
      </div>
    </div>
  );
}

// ── Руководителю: собрать, провести, отправить ───────────────────────────────────
export function BriefScreen({ T, a11y, profile, onBack, onSent }) {
  const c = C(a11y);
  const contentVer = useAllModules();   // фокус и вопрос ищутся по программе всех ролей
  const [src, setSrc] = React.useState({ menu: null, hard: null, sched: null, league: null });
  const [today, setToday] = React.useState(null);   // уже отправленный сегодня
  const [note, setNote] = React.useState("");
  const [on, setOn] = React.useState({});
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);   // { ok, text }
  const [typing, setTyping] = React.useState(false);
  const restaurant = (profile && profile.restaurant) || "";
  React.useEffect(() => {
    let alive = true;
    const tok = saToken();
    const put = (k) => (v) => { if (alive) setSrc((s) => ({ ...s, [k]: v })); };
    const cached = cachedShared(restaurant);
    rpc("menu_get", { p_restaurant: restaurant }).then((r) => { const a = typeof r === "string" ? JSON.parse(r) : r; put("menu")(Array.isArray(a) ? a : cached); }).catch(() => put("menu")(cached));
    rpc("quiz_hard_questions", { p_token: tok }).then((r) => put("hard")(Array.isArray(r) ? r : [])).catch(() => put("hard")([]));
    const d = new Date(), mkey = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    // нет связи — false («не пришло»), а не null («ещё собираю»): иначе «Отправить команде» ждала бы вечно
    rpc("schedule_load", { p_token: tok, p_restaurant: restaurant, p_month: mkey }).then((r) => put("sched")(r || false)).catch(() => put("sched")(false));
    rpc("league_week", { p_token: tok }).then((r) => put("league")(r || false)).catch(() => put("league")(false));
    // уже отправленный сегодня: «Своё» и выключатели — как в нём, чтобы правка начиналась с отправленного
    rpc("brief_today", { p_token: tok }).then((r) => {
      if (!alive || !r || !r.ok || !r.brief || !r.brief.data) return;
      setToday(r.brief);
      const d0 = r.brief.data, n = d0.blocks && d0.blocks.note;
      if (n && typeof n === "string") setNote(n);
      if (d0.on && typeof d0.on === "object") { const o = {}; BRIEF_ORDER.forEach((k) => { if (typeof d0.on[k] === "boolean") o[k] = d0.on[k]; }); setOn(o); }
    }).catch(() => {});
    return () => { alive = false; };
  }, [restaurant]);
  const loading = Object.values(src).some((v) => v === null);
  const author = profile ? (profile.name + (profile.surname ? " " + profile.surname : "")).trim() : "";
  const base = React.useMemo(() => buildBrief({ menu: src.menu || [], hard: src.hard || [], programs: programAll(), sched: src.sched, league: src.league, restaurant, author, note }),
    [src, restaurant, author, note, contentVer]);   // eslint-disable-line react-hooks/exhaustive-deps
  const brief = { ...base, on: { ...base.on, ...on, note: on.note !== undefined ? on.note : !!note.trim() } };
  const toggle = (k) => { vibrate("light"); setOn((o) => ({ ...o, [k]: !(o[k] !== undefined ? o[k] : brief.on[k]) })); };
  const count = BRIEF_ORDER.filter((k) => briefShown(brief, k)).length;
  const publish = () => {
    if (busy || !count) return;
    setBusy(true); setMsg(null);
    const data = { ...brief, blocks: { ...brief.blocks, note: note.trim() } };
    rpc("brief_publish", { p_token: saToken(), p_data: data, p_text: briefText(data) }).then((r) => {
      setBusy(false);
      if (r && r.ok) {
        vibrate("success");
        setToday({ data, author, mine: true, sent: (today ? today.sent : 0) + (r.sent || 0), at: new Date().toISOString() });
        if (onSent) onSent();
        const tg = r.sent ? ` В Telegram ушло ${r.sent} ${plural(r.sent, "сотруднику", "сотрудникам", "сотрудникам")}.` : "";
        setMsg({ ok: true, text: r.again
          ? "Брифинг обновлён: команда увидит правку в «Смене»." + (tg ? tg.replace("ушло", "ушло тем, кто ещё не получал:") : " Второй раз в Telegram не пишем.")
          : "Отправлено: брифинг в «Смене» у всей команды." + (tg || (r.bot ? " В Telegram сегодня некому: никто из команды не подключил бота." : "")) });
      } else if (rpcMissing(r)) setMsg({ ok: false, text: "На сервере ещё нет этапа 32 (supabase-stage32-briefing.sql). Провести брифинг можно и без него." });
      else if (r && r.error === "forbidden") setMsg({ ok: false, text: "Отправлять брифинг может руководитель или старший." });
      else setMsg({ ok: false, text: "Не отправилось. Проверь связь и попробуй ещё раз." });
    }).catch(() => { setBusy(false); setMsg({ ok: false, text: "Нет связи. Провести брифинг можно и так, отправишь потом." }); });
  };
  const empty = { roster: "В графике на сегодня никого: график не заполнен или выходной.", stop: "Стоп-листа нет.", fresh: "Новинок за месяц нет.",
    focus: "Пока мало ответов команды за 30 дней.", ask: "Вопроса нет: программа ещё грузится.", thanks: "На этой неделе очков пока нет." };
  return (
    <div style={T.screen} className="sa-screen">
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} aria-label="Вернуться" onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Брифинг смены</div>
      </div>
      <div style={{ padding: "4px 16px 120px" }}>
        <div style={{ fontSize: 13, color: c.sub, lineHeight: 1.5, marginBottom: 12 }}>
          {brief.dayLabel}{restaurant ? " · " + restaurant : ""}. Собрано из графика, меню, ошибок команды и лиги недели. Лишнее выключи, своё допиши.
        </div>
        {today ? <div data-brief-sent="" style={{ ...c.frost, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: c.text, lineHeight: 1.45 }}>
          Сегодня уже отправлен{today.mine ? "" : " (" + (today.author || "руководитель") + ")"}: команда видит его в «Смене»{today.sent ? ", в Telegram ушло " + today.sent : ""}. Новая отправка заменит его правкой.
        </div> : null}
        {BRIEF_ORDER.map((k) => {
          const b = brief.blocks[k];
          const has = Array.isArray(b) ? b.length > 0 : !!b;
          const isOn = !!brief.on[k];
          if (k === "note") return (
            <div key={k} data-brief-block={k} style={{ ...c.frost, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ ...labelStyle(13.5), color: c.gold, marginBottom: 6 }}>{BRIEF_TITLE[k]}</div>
              <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 600))} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} rows={3} placeholder="Банкет на 12 человек в 19:00, VIP-гость за пятым столом, новый сомелье…" className="sa-field"
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: `1px solid ${c.line}`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.25)", color: c.text, fontFamily: "Georgia, serif", fontSize: 14, outline: "none", resize: "vertical" }} />
            </div>);
          return (
            <div key={k} data-brief-block={k} data-on={isOn ? "1" : "0"} style={{ ...c.frost, padding: "12px 14px", marginBottom: 10, opacity: has && !isOn ? 0.55 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: has ? 8 : 0 }}>
                <div style={{ ...labelStyle(13.5), color: c.gold, flex: 1 }}>{BRIEF_TITLE[k]}</div>
                {has ? <button type="button" role="switch" aria-checked={isOn} aria-label={(isOn ? "Убрать из брифинга: " : "Включить в брифинг: ") + BRIEF_TITLE[k]} onClick={() => toggle(k)}
                  style={{ position: "relative", width: 40, height: 24, borderRadius: 12, border: `1px solid ${isOn ? c.gold : c.line}`, background: isOn ? (a11y ? "rgba(139,106,48,0.25)" : "rgba(200,169,110,0.35)") : "transparent", cursor: "pointer", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: "50%", background: isOn ? (a11y ? "#8B6A30" : "#E4C88C") : c.sub, transform: isOn ? "translateX(16px)" : "none", transition: "transform .2s" }} />
                </button> : null}
              </div>
              {has ? <BlockBody k={k} b={b} c={c} /> : <div style={{ fontSize: 12.5, color: c.sub }}>{src[{ roster: "sched", stop: "menu", fresh: "menu", focus: "hard", ask: "hard", thanks: "league" }[k]] === null ? "Собираю…" : empty[k]}</div>}
            </div>);
        })}
        {msg ? <div role="status" style={{ fontSize: 13, color: msg.ok ? c.text : c.red, lineHeight: 1.5, margin: "4px 2px 10px" }}>{msg.text}</div> : null}
      </div>
      {/* полоса кнопок — порталом: внутри .sa-screen (анимация с transform) position: fixed прилипает к концу экрана,
          а не к низу окна; пока печатаешь «Своё» — уезжает вниз, чтобы не закрывать поле (как в редакторе меню) */}
      {portal(<div className="sa-colbar" data-brief-bar="" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, padding: "10px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
        background: a11y ? "rgba(245,238,222,0.94)" : "rgba(21,17,11,0.94)", borderTop: `1px solid ${c.line}`, display: "flex", gap: 10, fontFamily: "Georgia, serif",
        transform: typing ? "translateY(120%)" : "none", transition: "transform .25s ease" }}>
        <button type="button" data-brief-present="" onClick={() => { vibrate("medium"); setShow(true); }} disabled={!count}
          style={{ flex: 1, padding: 14, borderRadius: 16, border: `1px solid ${c.gold}`, background: "transparent", color: c.text, fontFamily: "Georgia, serif", fontSize: 15, cursor: "pointer", opacity: count ? 1 : 0.5 }}>Провести</button>
        <button type="button" data-brief-publish="" onClick={publish} disabled={busy || !count || loading}
          style={{ flex: 1.4, padding: 14, borderRadius: 16, border: 0, background: c.gold, color: "#1A1008", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", cursor: "pointer", opacity: busy || !count || loading ? 0.55 : 1 }}>{busy ? "Отправляю…" : today ? "Отправить правку" : "Отправить команде"}</button>
      </div>)}
      {show ? <BriefPresenter brief={brief} a11y={a11y} author={author} onClose={() => setShow(false)} /> : null}
    </div>
  );
}

// ── Сотруднику: карточка в «Смене» и чтение ──────────────────────────────────────
// Карточка — сегодняшний брифинг заведения (brief_today), пока он есть; прочитанный — без золотой точки.
export function BriefCard({ a11y, brief, seen, onOpen }) {
  const c = C(a11y);
  if (!brief || !brief.data) return null;
  const d = brief.data;
  const pts = BRIEF_ORDER.filter((k) => briefShown(d, k));
  if (!pts.length) return null;
  return (
    <div data-brief-card="" data-seen={seen ? "1" : "0"} role="button" tabIndex={0} aria-label={"Брифинг смены" + (brief.author ? " от " + brief.author : "") + ": открыть"}
      onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      style={{ ...c.frost, margin: "0 0 12px", padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...labelStyle(13), color: c.gold, display: "flex", alignItems: "center", gap: 7 }}>
          {!seen ? <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: c.gold, boxShadow: `0 0 8px ${c.gold}` }} /> : null}
          Брифинг смены{brief.author ? " · " + brief.author : ""}</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 14.5, color: c.text, marginTop: 4, lineHeight: 1.4 }}>{pts.map((k) => BRIEF_TITLE[k]).join(", ")}</div>
      </div>
      <span aria-hidden="true" style={{ color: c.gold, fontSize: 22, lineHeight: 1 }}>›</span>
    </div>
  );
}

export function BriefView({ a11y, brief, onClose }) {
  const c = C(a11y);
  const [reveal, setReveal] = React.useState(false);
  const d = brief && brief.data;
  if (!d) return null;
  const pages = BRIEF_ORDER.filter((k) => briefShown(d, k));
  return portal(
    <div data-brief-view="" role="dialog" aria-modal="true" aria-label="Брифинг смены" className="sa-layer sa-safex" style={{ ...SHELL(a11y), overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
      <div style={HEAD}>
        <button type="button" data-sa-back="" aria-label="Закрыть" onClick={onClose} style={{ border: 0, background: "none", color: c.gold, fontSize: 26, cursor: "pointer", lineHeight: 1, padding: "0 6px 4px 0", fontFamily: "Georgia, serif" }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...labelStyle(13), color: c.sub }}>Брифинг смены · {d.dayLabel}</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: c.text }}>{brief.author ? "От " + brief.author : "От руководителя"}</div>
        </div>
      </div>
      <div style={{ padding: "4px 16px 28px" }}>
        {pages.map((k) => (
          <div key={k} data-brief-block={k} style={{ ...c.frost, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ ...labelStyle(13.5), color: c.gold, marginBottom: 8 }}>{BRIEF_TITLE[k]}</div>
            <BlockBody k={k} b={d.blocks[k]} c={c} reveal={k !== "ask" || reveal} onReveal={() => setReveal(true)} />
          </div>))}
        <button type="button" onClick={onClose} style={{ width: "100%", marginTop: 6, padding: 14, borderRadius: 16, border: 0, background: c.gold, color: "#1A1008", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", cursor: "pointer" }}>Понятно</button>
      </div>
    </div>
  );
}
