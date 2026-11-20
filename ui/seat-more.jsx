// ui/seat-more.jsx — v187 (Доп. 512): объединить столы, пересадить гостей, лист ожидания (сервер с этапом 56).
//
// Владелец: «Как ещё удобнее и красивее мы можем сделать рассадку?» и на семь предложений — «Давай все».
//   • PickBanner — над схемой, пока выбирают стол: куда пересадить, какой приставить, куда посадить из листа; «Отмена»;
//   • JoinChips — под подбором компании, когда одного стола не хватает: «Можно объединить: 3+4 · 10 мест»;
//   • SheetMore — в карточке стола с гостями или бронью: «Пересадить» («Перенести бронь»), «Приставить стол», с какими
//     столами компания (нажать — отделить);
//   • WaitList — «Лист ожидания»: кто ждёт, сколько и сколько минут, какие столы свободны; «Посадить», «Ушли»,
//     «＋ Записать» (форма: на кого, сколько, заметка).
// Экран — ui/seating.jsx, расчёт — lib/seating.js.
import React from "react";
import { labelStyle } from "./tokens";
import { vibrate } from "../lib/utils";
import { waitLine, waitFits } from "../lib/seating";

const chip = (c, on, a11y) => ({ padding: "7px 12px", borderRadius: 999, border: `1px solid ${on ? c.gold : c.line}`, background: on ? (a11y ? "rgba(139,106,48,0.18)" : "rgba(200,169,110,0.22)") : "transparent",
  color: on ? c.text : c.sub, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer" });
const link = (color) => ({ border: 0, background: "none", color, fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer", padding: "4px 2px" });

/** Выбор стола на схеме: что делаем и «Отмена» */
export function PickBanner({ c, text, onCancel }) {
  return (
    <div data-pick-banner="" role="status" data-lens-card="" style={{ ...c.frost, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 10, border: `1px solid ${c.gold}` }}>
      <span style={{ flex: 1, fontSize: 13.5, color: c.text, lineHeight: 1.45 }}>{text}</span>
      <button type="button" data-pick-cancel="" onClick={() => { vibrate("light"); onCancel(); }} style={link(c.gold)}>Отмена</button>
    </div>);
}

/** Когда одного стола на компанию нет: какие соседние столы можно объединить */
export function JoinChips({ c, a11y, list, zName, here, onPick }) {
  if (!list || !list.length) return null;
  return (
    <div data-join-suggest="" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "-2px 2px 10px" }}>
      <span style={{ fontSize: 13, color: c.text }}>Можно объединить:</span>
      {list.map((j) => (
        <button key={j.main + j.with.join("")} type="button" data-join-sug={j.main} onClick={() => { vibrate("light"); onPick(j); }} data-lens-btn="soft" data-lens-ink="" style={chip(c, false, a11y)}>
          {j.n} · {j.seats} мест{zName && j.z !== here ? " · " + zName(j.z) : ""}</button>))}
    </div>);
}

/** В карточке стола с гостями, «Счётом» или бронью: пересадить, приставить, отделить */
export function SheetMore({ c, a11y, row, group, onMove, onJoin, onUnjoin }) {
  const res = row.status === "res";
  return (
    <div data-sheet-more="" style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${c.line}` }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" data-sheet-move="" onClick={() => { vibrate("light"); onMove(); }} data-lens-btn="soft" data-lens-ink="" style={chip(c, false, a11y)}>{res ? "Перенести бронь" : "Пересадить"}</button>
        <button type="button" data-sheet-join="" onClick={() => { vibrate("light"); onJoin(); }} data-lens-btn="soft" data-lens-ink="" style={chip(c, false, a11y)}>Приставить стол</button>
      </div>
      {group.length ? (
        <div data-sheet-group="" style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12.5, color: c.sub, marginBottom: 6, lineHeight: 1.45 }}>Статус меняется у всех столов компании. Нажми на стол, чтобы отделить его.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {group.map((g) => (
              <button key={g.id} type="button" data-sheet-unjoin={g.id} aria-label={"Отделить стол " + g.n} onClick={() => { vibrate("light"); onUnjoin(g.id); }} data-lens-btn="soft" data-lens-ink=""
                style={{ ...chip(c, false, a11y), display: "inline-flex", alignItems: "center", gap: 6 }}>Стол {g.n}<span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>×</span></button>))}
          </div>
        </div>) : null}
      <div style={{ fontSize: 11.5, color: c.sub, marginTop: 10, lineHeight: 1.45 }}>
        {res ? "Бронь переедет за другой стол вместе со временем и именем." : "Гости, официант и время посадки переедут за другой стол, а этот пойдёт на уборку."}</div>
    </div>);
}

/** Запись в лист: на кого, сколько, заметка */
function WaitForm({ c, a11y, onAdd, onCancel }) {
  const [name, setName] = React.useState("");
  const [cnt, setCnt] = React.useState(2);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const field = { width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 12, border: `1px solid ${c.line}`, background: c.field, color: c.text, fontFamily: "Georgia, serif", fontSize: 15 };
  const add = () => {
    if (busy) return;
    setBusy(true); setErr("");
    onAdd({ name: name.trim(), cnt, note: note.trim() }).then((r) => { setBusy(false); if (r !== true) setErr(r || "Не сохранилось. Проверь связь."); });
  };
  return (
    <div data-wait-form="" data-lens-card="" style={{ ...c.frost, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <label style={{ flex: 1.4 }}><span style={{ ...labelStyle(13), color: c.gold, display: "block", marginBottom: 4 }}>На кого</span>
          <input value={name} maxLength={40} data-wait-name="" placeholder="Имя" onChange={(e) => setName(e.target.value)} style={field} /></label>
        <div style={{ flex: 1 }}><span style={{ ...labelStyle(13), color: c.gold, display: "block", marginBottom: 4 }}>Гостей</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" aria-label="Меньше" data-wait-minus="" onClick={() => setCnt((n) => Math.max(1, n - 1))} data-lens-btn="soft" data-lens-ink="" style={{ ...chip(c, false, a11y), width: 36, padding: "5px 0", fontSize: 17 }}>−</button>
            <span data-wait-cnt="" style={{ minWidth: 22, textAlign: "center", fontSize: 19, color: c.text }}>{cnt}</span>
            <button type="button" aria-label="Больше" data-wait-plus="" onClick={() => setCnt((n) => Math.min(40, n + 1))} data-lens-btn="soft" data-lens-ink="" style={{ ...chip(c, false, a11y), width: 36, padding: "5px 0", fontSize: 17 }}>+</button>
          </div></div>
      </div>
      <label style={{ display: "block", marginBottom: 10 }}><span style={{ ...labelStyle(13), color: c.gold, display: "block", marginBottom: 4 }}>Заметка</span>
        <input value={note} maxLength={60} data-wait-note="" placeholder="Например: у бара, с коляской" onChange={(e) => setNote(e.target.value)} style={field} /></label>
      {err ? <div role="alert" style={{ fontSize: 13, color: c.red, marginBottom: 8 }}>{err}</div> : null}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" data-wait-save="" onClick={add} disabled={busy} data-lens-btn="main"
          style={{ flex: 1, padding: "11px 14px", borderRadius: 16, border: 0, background: c.gold, color: "#1A1008", fontWeight: "bold", fontFamily: "Georgia, serif", fontSize: 15, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Записываю…" : "Записать"}</button>
        <button type="button" data-wait-cancel="" onClick={onCancel} style={link(c.sub)}>Отмена</button>
      </div>
    </div>);
}

/** Лист ожидания на сегодня: общий для смены */
export function WaitList({ c, a11y, plan, rows, waits, now, form, onForm, onAdd, onSeat, onLeft }) {
  return (
    <div data-wait="" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "0 2px 6px" }}>
        <div style={{ ...labelStyle(15), color: c.gold, flex: 1 }}>Лист ожидания</div>
        {!form ? <button type="button" data-wait-add="" onClick={() => { vibrate("light"); onForm(true); }} style={link(c.gold)}>＋ Записать</button> : null}
      </div>
      {form ? <WaitForm c={c} a11y={a11y} onAdd={onAdd} onCancel={() => onForm(false)} /> : null}
      {waits.length ? (
        <div data-lens-card="" style={{ ...c.frost, padding: "2px 14px" }}>
          {waits.map((w, i) => {
            const f = waitFits(plan, rows, w);
            return (
              <div key={w.id} data-wait-item={w.id} style={{ padding: "10px 0", borderTop: i ? `1px solid ${c.line}` : 0 }}>
                <div style={{ fontSize: 14.5, color: c.text }}>{waitLine(w, now)}</div>
                {w.note ? <div style={{ fontSize: 12.5, color: c.sub, marginTop: 1 }}>{w.note}</div> : null}
                <div data-wait-fit="" style={{ fontSize: 12.5, color: f.free.length ? c.gold : c.sub, marginTop: 2 }}>
                  {f.free.length ? (f.free.length === 1 ? "Свободен стол " : "Свободны столы ") + f.free.join(", ")
                    : f.soon.length ? "Подходящих свободных нет, скоро освободится " + f.soon.join(", ")
                    : "Подходящих свободных столов пока нет"}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" data-wait-seat={w.id} onClick={() => { vibrate("light"); onSeat(w); }} data-lens-btn="soft" data-lens-ink="" style={chip(c, false, a11y)}>Посадить</button>
                  <button type="button" data-wait-left={w.id} onClick={() => { vibrate("light"); onLeft(w); }} data-lens-btn="soft" data-lens-ink="" style={chip(c, false, a11y)}>Ушли</button>
                </div>
              </div>);
          })}
        </div>)
        : !form ? <div style={{ fontSize: 12.5, color: c.sub, margin: "0 2px", lineHeight: 1.45 }}>Нет свободного стола? Запиши гостей: смена увидит, кто ждёт и сколько, а когда стол освободится, приложение подскажет какой.</div> : null}
    </div>);
}
