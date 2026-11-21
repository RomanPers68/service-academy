// ui/call-table.jsx — v189 (Доп. 514): «Позвать» → «К столу»: стол выбирают на схеме зала, а не вписывают номер.
// Владелец: «Слушай, а может мы в функции «позвать официанта», добавим возможность выбора стола, к которому нужно
// подойти?» и, посмотрев пример, «давай схему сделаем».
//   • CallTables — схема зала, та же, что в «Рассадке», с тем, что сейчас за столами; залы — вкладками; нажал на стол — он
//     выбран (золотом), под схемой — что за ним и кто его официант. Зовёшь официанта, а у стола он свой — кнопка «Позвать
//     только Анну С.»: вызов уйдёт ей лично, а не всем официантам;
//   • стола нет на схеме — «Вписать номер» (как раньше). Схемы нет совсем (рассадку не настроили, нет этапа 35) — сразу
//     поле номера.
// Экран «Позвать» — ui/chat.jsx (CallSheet); схема — Floor из ui/seating.jsx (грузится, только когда нужна).
import React from "react";
import { Floor } from "./seating";
import { boardMap, stateOf, zonesOf, zoneOfX, STATUS, isBusy, shortName, guestsWord, minutesSince, sinceLabel } from "../lib/seating";
import { accName } from "../lib/chat";
import { vibrate } from "../lib/utils";

const pl = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };

/** Что за выбранным столом: «Стол 5 · 4 места · гости, 3 гостя, 25 мин · официант Анна С.» */
export function pickedLine(t, r, now) {
  if (!t) return "";
  const parts = ["Стол " + t.n, t.seats + " " + pl(t.seats, "место", "места", "мест")];
  if (isBusy(r)) parts.push(STATUS[r.status].toLowerCase() + ", " + guestsWord(Number(r.cnt) || 0) + (r.since ? ", " + sinceLabel(minutesSince(r.since, now)) : ""));
  else if (r && r.status === "res") parts.push("бронь" + (r.rtime ? " на " + r.rtime : ""));
  else parts.push(STATUS[(r && r.status) || "free"].toLowerCase());
  if (isBusy(r) && r.waiter_name) parts.push("официант " + shortName(r.waiter_name).replace(/ (?=\S+$)/, "\u00a0"));   // «Анна С.» не рвётся
  return parts.join(" · ");
}
/** Кнопка «Позвать только Анну С.»: зовут официанта, а у стола свой */
export function ownWaiter(r) {
  if (!isBusy(r) || !r.waiter_id || !r.waiter_name) return null;
  const [first, ...rest] = String(r.waiter_name).trim().split(/\s+/);
  return { id: String(r.waiter_id), name: String(r.waiter_name).trim(), label: "Позвать только " + accName(first) + (rest.length ? " " + rest[0][0] + "." : "") };
}

export function CallTables({ a11y, board, tid, who, onPick, onWaiter, onManual }) {
  const plan = board.plan, map = React.useMemo(() => boardMap(board.tables || []), [board]);
  const now = board.now ? Date.parse(board.now) || Date.now() : Date.now();
  const zones = zonesOf(plan), t = tid ? (plan.tables || []).find((q) => q.id === tid) : null;
  const [zone, setZone] = React.useState(() => (t ? zoneOfX(plan, t) : (zones[0] || {}).id));
  const r = t ? stateOf(map, t.id) : null, own = who === "waiter" && r ? ownWaiter(r) : null;
  return (
    <div data-call-tables="">
      <div className="ch-lbl" style={{ marginTop: 4 }}>Какой стол</div>
      {zones.length > 1 ? (
        <div className="ch-chips" role="tablist" aria-label="Зал" style={{ marginBottom: 8 }}>
          {zones.map((z) => <button key={z.id} type="button" role="tab" aria-selected={z.id === zone} aria-checked={z.id === zone} className="ch-chip" data-call-zone={z.id}
            onClick={() => { vibrate("light"); setZone(z.id); }}>{z.name}</button>)}
        </div>) : null}
      <div data-call-floor="" style={{ borderRadius: 16, padding: 6, border: "1px solid var(--opt-edge)", background: "var(--opt)" }}>
        <Floor a11y={a11y} plan={plan} zone={zone} map={map} now={now} sel={tid} hi={tid ? [tid] : []} onTable={(q) => { vibrate("light"); onPick(q); }} />
      </div>
      {/* что выбрано — диктор прочтёт сам, когда выберут стол */}
      <div data-call-status="" role="status" aria-live="polite" style={{ marginTop: 8, lineHeight: 1.45 }}>
        {t ? <span data-call-picked="" style={{ fontSize: 13.5, color: "var(--text)" }}>{pickedLine(t, r, now)}</span>
          : <span style={{ fontSize: 13, color: "var(--sub)" }}>Нажми на стол на схеме.</span>}
      </div>
      {own ? <div className="ch-chips" style={{ marginTop: 8 }}>
        <button type="button" className="ch-chip" data-call-own={own.id} onClick={() => { vibrate("light"); onWaiter(own); }}>{own.label}</button>
        <span style={{ alignSelf: "center", fontSize: 12, color: "var(--sub)", lineHeight: 1.35 }}>Вызов уйдёт только официанту этого стола.</span>
      </div> : null}
      <button type="button" data-call-manual="" onClick={onManual}
        style={{ marginTop: 6, border: 0, background: "none", padding: "4px 0", color: "var(--gold-ink)", fontFamily: "inherit", fontSize: 13.5, cursor: "pointer" }}>Стола нет на схеме? Вписать номер</button>
    </div>);
}
