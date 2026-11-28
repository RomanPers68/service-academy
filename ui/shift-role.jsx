// ui/shift-role.jsx — v87 (Доп. 400): карточка «Смены» под роль (данные и правила — lib/shift-role.js).
//   Руководителю — «Брифинг на сегодня ещё не отправлен» (в день смены) и строка зала; хостес — зал сейчас: полоса
//   состояний столов в цветах схемы, сколько свободно и ближайшая бронь; официанту — его столы кружками с номером.
// v212 (Доп. 538): хостес — кнопка «Позвать к столу» (onCall: лист «Позвать» поверх, App.jsx) в карточке зала; схемы
//   зала нет — карточка с одной этой кнопкой.
// v213 (Доп. 539): QueueCard — «Очередь к столам» (этап 69): официанты по порядку, ты — золотом, на перерыве — бледнее;
//   официанту — «Ты в очереди: 2 из 4». Хостес нажимает — лист «Позвать».
import React from "react";
import { onActivate, vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { frostOf } from "./home-hubs";
import { hallHead, hallParts, hallLine, resLine, tableChip } from "../lib/shift-role";
import { guestsWord } from "../lib/seating";
import { queueLive, queuePos, queueLabels } from "../lib/call-queue";

const C = (a11y) => ({
  gold: a11y ? "#7A5D2A" : "#D2A85A",
  text: a11y ? "#2A1F0E" : "#EFE4C8",
  sub: a11y ? "#6B5B40" : "#A99A7C",
  line: a11y ? "rgba(139,106,48,0.28)" : "rgba(214,178,102,0.22)",
});
// цвета состояний — как на схеме зала (ui/seating.jsx): гости — золото, счёт — терракота, бронь — синеватый, уборка — серый
const PART = (a11y) => ({
  seat: a11y ? "#8B6A30" : "#E4C88C",
  bill: a11y ? "#A0412F" : "#EBA595",
  res: a11y ? "#3C6E9F" : "#8FBCE0",
  clean: a11y ? "rgba(90,70,40,0.45)" : "rgba(200,190,170,0.45)",
  free: a11y ? "rgba(139,106,48,0.16)" : "rgba(214,178,102,0.16)",
});
const Chevron = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>);

function HallBar({ a11y, hall }) {
  const P = PART(a11y), parts = hallParts(hall);
  return (
    <div data-hall-bar="" aria-hidden="true" style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", margin: "10px 0 8px", background: P.free }}>
      {parts.filter((p) => p.k !== "free").map((p) => <span key={p.k} data-part={p.k} style={{ flex: p.n + " 0 0", background: P[p.k], marginRight: 1 }} />)}
      {hall.free ? <span style={{ flex: hall.free + " 0 0" }} /> : null}
    </div>
  );
}

const Bell = ({ color, s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>);

/** Карточка под ролью. card — из roleCard(); onSeat / onBrief — открыть рассадку и брифинг; onCall — «Позвать» (хостес). */
export function ShiftRoleCard({ a11y, card, onSeat, onBrief, onCall = null }) {
  const c = C(a11y), P = PART(a11y);
  const call = (e) => { if (e && e.stopPropagation) e.stopPropagation(); vibrate("light"); if (onCall) onCall(); };
  const shell = { ...frostOf(a11y), borderRadius: 18, padding: "13px 16px", marginTop: 10, marginBottom: 4 };
  const tag = { ...labelStyle(a11y ? 14.5 : 13.5), color: c.gold };
  // v212: «Позвать к столу» — кнопкой; в карточке зала нажатие на неё не открывает «Рассадку»
  const callBtn = onCall ? (
    <button type="button" data-role-call="" onClick={call} onKeyDown={(e) => e.stopPropagation()}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 10, padding: "8px 14px", borderRadius: 999, border: `1px solid ${c.gold}`, background: "transparent",
        color: c.gold, fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer" }}><Bell color={c.gold} />Позвать к столу</button>) : null;
  if (!card) {
    if (!onCall) return null;
    return (
      <div className="sa-card sa-pagein" data-shift-role="call" data-lens-card="" onClick={call} {...onActivate(call)} aria-label="Позвать к столу: официанта, менеджера или бар"
        style={{ ...shell, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
        <Bell color={c.gold} s={22} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: c.text }}>Позвать к столу</div>
          <div style={{ fontSize: 12.5, color: c.sub, marginTop: 2 }}>Официанта, менеджера или бар: вызов уходит сразу</div>
        </div>
        <Chevron color={c.gold} />
      </div>);
  }
  const seat = () => { vibrate("light"); onSeat && onSeat(); };
  const brief = () => { vibrate("light"); onBrief && onBrief(); };
  if (card.role === "host") {
    const h = card.hall;
    return (
      <div className="sa-card sa-pagein" data-shift-role="host" data-lens-card="" onClick={seat} {...onActivate(seat)} aria-label={"Зал сейчас: " + hallHead(h).toLowerCase()} style={{ ...shell, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ ...tag, flex: 1 }}>Зал сейчас</div><Chevron color={c.gold} /></div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 23, color: c.text, marginTop: 4, lineHeight: 1.15 }}>{hallHead(h)}{h.guests ? <span style={{ fontSize: 14, color: c.sub }}> · {guestsWord(h.guests)}</span> : null}</div>
        <HallBar a11y={a11y} hall={h} />
        <div data-hall-parts="" style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12.5, color: c.sub }}>
          {hallParts(h).filter((p) => p.k !== "free").map((p) => (
            <span key={p.k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: P[p.k] }} />{p.t} {p.n}</span>))}
        </div>
        <div data-hall-res="" style={{ fontSize: 13, color: card.res ? c.text : c.sub, marginTop: 8, lineHeight: 1.4 }}>
          {card.res ? <><span style={{ color: c.gold }}>Ближайшая бронь:</span> {resLine(card.res)}</> : "Броней на сегодня нет"}</div>
        {callBtn}
      </div>
    );
  }
  if (card.role === "lead") {
    const row = { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer" };
    return (
      <div className="sa-card sa-pagein" data-shift-role="lead" data-lens-card="" style={shell}>
        <div style={tag}>Руководителю смены</div>
        {card.brief === "none" ? (
          <div data-role-brief="" onClick={brief} {...onActivate(brief)} aria-label="Брифинг на сегодня ещё не отправлен. Собрать" style={{ ...row, borderBottom: card.hall ? `1px solid ${c.line}` : 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 15.5, color: c.text }}>Брифинг на сегодня ещё не отправлен</div>
              <div style={{ fontSize: 12.5, color: c.sub, marginTop: 2 }}>Пять минут: приложение соберёт его само</div>
            </div>
            <span style={{ fontSize: 13.5, color: c.gold, whiteSpace: "nowrap" }}>Собрать</span><Chevron color={c.gold} />
          </div>) : null}
        {card.hall ? (
          <div data-role-hall="" onClick={seat} {...onActivate(seat)} aria-label={hallLine(card.hall)} style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 15, color: c.text }}>{hallLine(card.hall)}</div>
              <HallBar a11y={a11y} hall={card.hall} />
            </div>
            <Chevron color={c.gold} />
          </div>) : null}
      </div>
    );
  }
  // официант: свои столы
  return (
    <div className="sa-card sa-pagein" data-shift-role="staff" data-lens-card="" onClick={seat} {...onActivate(seat)} aria-label={(card.mine.length === 1 ? "Твой стол " : "Твои столы ") + card.mine.map((t) => t.n).join(", ")} style={{ ...shell, cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ ...tag, flex: 1 }}>{card.mine.length === 1 ? "Твой стол" : "Твои столы"}</div><Chevron color={c.gold} /></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {card.mine.map((t) => (
          <div key={t.tid} data-my-table={t.n} data-status={t.status} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 5px", borderRadius: 999,
            border: `1px solid ${t.status === "bill" ? P.bill : P.seat}`, background: t.status === "bill" ? (a11y ? "rgba(160,65,47,0.10)" : "rgba(224,138,122,0.14)") : (a11y ? "rgba(139,106,48,0.12)" : "rgba(210,168,90,0.14)") }}>
            <span style={{ minWidth: 28, height: 28, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", fontSize: 14.5,
              color: a11y ? "#2A1F0E" : "#1A1008", background: t.status === "bill" ? P.bill : P.seat, padding: "0 6px", boxSizing: "border-box" }}>{t.n}</span>
            <span style={{ fontSize: 12.5, color: c.text, whiteSpace: "nowrap" }}>{tableChip(t)}</span>
          </div>))}
      </div>
    </div>
  );
}

/** «Очередь к столам»: q — очередь (lib/call-queue.js, queueOf); meId — кто смотрит; onOpen — открыть «Позвать» (хостес). */
export function QueueCard({ a11y, q, meId, onOpen = null }) {
  const live = queueLive(q);
  const c = C(a11y), labels = queueLabels(live), pos = queuePos(q, meId), mine = live.find((x) => x.id === String(meId));
  const open = onOpen ? () => { vibrate("light"); onOpen(); } : null;
  const shell = { ...frostOf(a11y), borderRadius: 18, padding: "13px 16px", marginTop: 10, marginBottom: 4, cursor: open ? "pointer" : "default" };
  // v215 (Доп. 541): очередь составляет хостес по приходу — пустая утром; хостес видит, что её пора составить
  if (!live.length) {
    if (!(q && q.edit && open)) return null;
    return (
      <div className="sa-card sa-pagein" data-queue-card="none" data-lens-card="" style={shell} onClick={open} {...onActivate(open)} aria-label="Очередь к столам не составлена. Составить">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ ...labelStyle(a11y ? 14.5 : 13.5), color: c.gold, flex: 1 }}>Очередь к столам</div><Chevron color={c.gold} /></div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: c.text, marginTop: 4 }}>Ещё не составлена</div>
        <div style={{ fontSize: 13, color: c.sub, marginTop: 4, lineHeight: 1.45 }}>Отмечай официантов по приходу: кто пришёл первым, тот первый.</div>
      </div>);
  }
  return (
    <div className="sa-card sa-pagein" data-queue-card="" data-lens-card="" style={shell} {...(open ? { onClick: open, ...onActivate(open) } : {})}
      aria-label={"Очередь к столам: " + live.map((x, i) => (i + 1) + ". " + x.name + (x.away ? ", на перерыве" : "")).join("; ")}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ ...labelStyle(a11y ? 14.5 : 13.5), color: c.gold, flex: 1 }}>Очередь к столам</div>{open ? <Chevron color={c.gold} /> : null}</div>
      {pos ? <div data-queue-me="" style={{ fontFamily: "Georgia, serif", fontSize: 16, color: c.text, marginTop: 4 }}>
        {mine && mine.away ? "Ты на перерыве: очередь тебя пропускает" : "Ты в очереди: " + pos + " из " + live.length}</div> : null}
      <div aria-hidden="true" style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", marginTop: 8 }}>
        {live.map((x, i) => {
          const me = x.id === String(meId);
          return (
            <span key={x.id} data-queue-chip={x.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px", borderRadius: 999, fontSize: 13,
              border: `1px solid ${me ? c.gold : c.line}`, color: c.text, opacity: x.away ? 0.55 : 1, borderStyle: x.away ? "dashed" : "solid" }}>
              <span style={{ minWidth: 22, height: 22, borderRadius: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                background: me ? c.gold : "transparent", color: me ? (a11y ? "#FBF7EE" : "#1A1008") : c.sub, border: me ? 0 : `1px solid ${c.line}` }}>{i + 1}</span>
              {me ? "ты" : labels[i]}{x.away ? <span style={{ color: c.sub }}>· перерыв</span> : null}
            </span>);
        })}
      </div>
    </div>);
}
