// ui/call-queue.jsx — v213 (Доп. 539): очередь официантов к столам в листе «Позвать» (ui/call-sheet.jsx).
// Владелец: «Столы у нас не закрепляются за официантом, так как работает система очередности».
//   • QueueChips — «Кого · по очереди»: официанты по порядку очереди кнопками с номером, следующий выбран сразу;
//     «Пропустить Петра» — выбор переходит к следующему, Пётр остаётся первым; на перерыве — бледнее, но позвать можно;
//   • QueuePanel — правка очереди (руководитель, старший, хостес): выше и ниже, «Перерыв» и обратно, убрать на сегодня,
//     вернуть и добавить официанта, которого в очереди нет. Сохраняется сразу (queue_set, этап 69).
// Данные и правила — lib/call-queue.js. Стили — в CHAT_CSS (ui/chat.jsx), рядом со стилями листа.
import React from "react";
import { vibrate } from "../lib/utils";
import { accName, bubbleName } from "../lib/chat";
import { queueLive, queueMove, queueFlag, queueAdd, queueLabels } from "../lib/call-queue";

const Arrow = ({ up }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>);
const Cross = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" focusable="false">
    <path d="M6 6l12 12M18 6L6 18" /></svg>);
const first = (s) => String(s || "").trim().split(/\s+/)[0] || "";

/** Кнопки «Кого» по очереди. picked — id выбранного; auto — выбран очередью (тогда есть «Пропустить …»). */
export function QueueChips({ q, picked, auto, edit, editing, onPick, onSkip, onEdit }) {
  const live = queueLive(q), labels = queueLabels(live);
  const pickedOne = auto && picked != null ? live.find((x) => x.id === String(picked)) : null;
  return (<>
    <div className="ch-lbl ch-q-lbl"><span>Кого · по очереди</span>
      {edit ? <button type="button" className="ch-q-edit" data-queue-open={editing ? "on" : ""} aria-expanded={editing} onClick={() => { vibrate("light"); onEdit(); }}>{editing ? "Готово" : "Изменить очередь"}</button> : null}</div>
    <div className="ch-chips" role="radiogroup" aria-label="Очередь официантов" data-call-queue="">
      {live.map((x, i) => <button key={x.id} type="button" role="radio" aria-checked={picked != null && String(picked) === x.id} className={"ch-chip" + (x.away ? " away" : "")}
        data-call-qperson={x.id} aria-label={(i + 1) + ". " + x.name + (x.away ? ", на перерыве" : "")} onClick={() => onPick(x)}>
        <span className="ch-q-i" aria-hidden="true">{i + 1}</span>{labels[i]}{x.away ? <span className="ch-q-pause" aria-hidden="true"> · перерыв</span> : null}</button>)}
    </div>
    {pickedOne ? <button type="button" className="ch-q-skip" data-call-skip={pickedOne.id} onClick={() => { vibrate("light"); onSkip(pickedOne); }}>
      {"Пропустить " + (accName(first(pickedOne.name)) || bubbleName(pickedOne.name)) + ": позвать следующего"}</button> : null}
  </>);
}

/** Правка очереди. onChange(новая очередь) — сохранить; busy — сохраняется; err — не сохранилось. */
export function QueuePanel({ q, busy = false, err = "", onChange }) {
  const live = queueLive(q), out = q.list.filter((x) => x.out), labels = queueLabels(live);   // «Анна С.»: на узком экране полное имя не влезает
  const ch = (nq) => { vibrate("light"); onChange(nq); };
  return (
    <div className="ch-q-ed" data-queue-edit="">
      {!live.length ? <div className="ch-q-sub" style={{ marginTop: 4 }}>В очереди никого. Добавь официантов ниже.</div> : null}
      {live.map((x, i) => (
        <div key={x.id} className="ch-q-row" data-queue-row={x.id} data-queue-away={x.away ? "1" : "0"}>
          <span className="ch-q-n" aria-hidden="true">{i + 1}</span>
          <span className="ch-q-name" title={x.name}><span className="ch-q-nm">{labels[i]}</span>{x.away ? <span className="ch-q-away">на перерыве</span> : null}</span>
          <button type="button" className="ch-q-btn" aria-label={"Выше: " + x.name} data-queue-up={x.id} disabled={busy || i === 0} onClick={() => ch(queueMove(q, x.id, -1))}><Arrow up /></button>
          <button type="button" className="ch-q-btn" aria-label={"Ниже: " + x.name} data-queue-down={x.id} disabled={busy || i === live.length - 1} onClick={() => ch(queueMove(q, x.id, 1))}><Arrow /></button>
          <button type="button" className="ch-q-tog" aria-pressed={x.away} data-queue-pause={x.id} disabled={busy} onClick={() => ch(queueFlag(q, x.id, "away", !x.away))}>{x.away ? "Вернуть" : "Перерыв"}</button>
          <button type="button" className="ch-q-btn" aria-label={"Убрать из очереди на сегодня: " + x.name} data-queue-out={x.id} disabled={busy} onClick={() => ch(queueFlag(q, x.id, "out", true))}><Cross /></button>
        </div>))}
      {out.length || q.others.length ? <div className="ch-q-sub">Не в очереди сегодня, нажми, чтобы добавить</div> : null}
      {out.length || q.others.length ? <div className="ch-chips sub">
        {out.map((x) => <button key={x.id} type="button" className="ch-chip" data-queue-back={x.id} disabled={busy} onClick={() => ch(queueFlag(q, x.id, "out", false))}>{"+ " + x.name}</button>)}
        {q.others.map((x) => <button key={x.id} type="button" className="ch-chip" data-queue-add={x.id} disabled={busy} onClick={() => ch(queueAdd(q, x.id))}>{"+ " + x.name}</button>)}
      </div> : null}
      {err ? <div className="ch-err" role="alert" style={{ marginTop: 8, padding: 0 }} data-queue-err="">{err}</div> : null}
      <div className="ch-q-sub" style={{ marginBottom: 2 }}>Позвали к столу: официант уходит в конец. Занят и передал стол: остаётся первым.</div>
    </div>);
}
