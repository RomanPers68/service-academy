// ui/call-queue.jsx — v213 (Доп. 539): очередь официантов к столам в листе «Позвать» (ui/call-sheet.jsx).
// Владелец: «Столы у нас не закрепляются за официантом, так как работает система очередности».
//   • QueueChips — «Кого · по очереди»: официанты по порядку очереди кнопками с номером, следующий выбран сразу;
//     «Пропустить Петра» — выбор переходит к следующему, Пётр остаётся первым; на перерыве — бледнее, но позвать можно;
//   • QueuePanel — правка очереди (руководитель, старший, хостес): выше и ниже, «Перерыв» и обратно, убрать на сегодня,
//     вернуть и добавить официанта, которого в очереди нет. Сохраняется сразу (queue_set, этап 69).
// v215 (Доп. 541): очередь составляет хостес по приходу. Утром она пустая; в правке сначала «Сегодня по графику» — по
//   началу смены, с часом («+ Анна С. · с 16:00»), и «Все по графику» одной кнопкой; ниже — кто не в графике.
//   QueueStrip — строка очереди в чате «Вся команда»: «Очередь: Анна С. → Илья Б.», официант видит своё место; хостес
//   и руководитель нажимают — правка очереди листом.
// Данные и правила — lib/call-queue.js. Стили — в CHAT_CSS (ui/chat.jsx), рядом со стилями листа.
import React from "react";
import { vibrate } from "../lib/utils";
import { accName, bubbleName } from "../lib/chat";
import { queueOf, queueLive, queueMove, queueFlag, queueAdd, queueLabels, queueOrd, queueToday, queueBySchedule, fromLabel, queueLine } from "../lib/call-queue";

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
  const today = queueToday(q), rest = q.others.filter((x) => x.from == null);
  const ch = (nq) => { vibrate("light"); onChange(nq); };
  const add = (x) => <button key={x.id} type="button" className="ch-chip" data-queue-add={x.id} disabled={busy} onClick={() => ch(queueAdd(q, x.id))}>
    {"+ " + (bubbleName(x.name) || x.name)}{x.from != null ? <span className="ch-q-from">{" · " + fromLabel(x)}</span> : null}</button>;
  return (
    <div className="ch-q-ed" data-queue-edit="">
      {!live.length ? <div className="ch-q-sub" style={{ marginTop: 4 }} data-queue-howto="">Отмечай официантов по приходу: кто пришёл первым, тот и первый в очереди.</div> : null}
      {live.map((x, i) => (
        <div key={x.id} className="ch-q-row" data-queue-row={x.id} data-queue-away={x.away ? "1" : "0"}>
          <span className="ch-q-n" aria-hidden="true">{i + 1}</span>
          <span className="ch-q-name" title={x.name}><span className="ch-q-nm">{labels[i]}</span>{x.away ? <span className="ch-q-away">на перерыве</span> : null}</span>
          <button type="button" className="ch-q-btn" aria-label={"Выше: " + x.name} data-queue-up={x.id} disabled={busy || i === 0} onClick={() => ch(queueMove(q, x.id, -1))}><Arrow up /></button>
          <button type="button" className="ch-q-btn" aria-label={"Ниже: " + x.name} data-queue-down={x.id} disabled={busy || i === live.length - 1} onClick={() => ch(queueMove(q, x.id, 1))}><Arrow /></button>
          <button type="button" className="ch-q-tog" aria-pressed={x.away} data-queue-pause={x.id} disabled={busy} onClick={() => ch(queueFlag(q, x.id, "away", !x.away))}>{x.away ? "Вернуть" : "Перерыв"}</button>
          <button type="button" className="ch-q-btn" aria-label={"Убрать из очереди на сегодня: " + x.name} data-queue-out={x.id} disabled={busy} onClick={() => ch(queueFlag(q, x.id, "out", true))}><Cross /></button>
        </div>))}
      {today.length ? <div className="ch-q-sub ch-q-subrow"><span>{live.length ? "Пришёл ещё кто-то из графика? Нажми" : "Сегодня по графику, по началу смены"}</span>
        {today.length > 1 ? <button type="button" className="ch-q-edit" data-queue-all="" disabled={busy} onClick={() => ch(queueBySchedule(q))}>Все по графику</button> : null}</div> : null}
      {today.length ? <div className="ch-chips sub" data-queue-today="">{today.map(add)}</div> : null}
      {out.length || rest.length ? <div className="ch-q-sub">{today.length ? "Не в графике сегодня" : "Не в очереди сегодня, нажми, чтобы добавить"}</div> : null}
      {out.length || rest.length ? <div className="ch-chips sub" data-queue-rest="">
        {out.map((x) => <button key={x.id} type="button" className="ch-chip" data-queue-back={x.id} disabled={busy} onClick={() => ch(queueFlag(q, x.id, "out", false))}>{"+ " + (bubbleName(x.name) || x.name)}</button>)}
        {rest.map(add)}
      </div> : null}
      {err ? <div className="ch-err" role="alert" style={{ marginTop: 8, padding: 0 }} data-queue-err="">{err}</div> : null}
      <div className="ch-q-sub" style={{ marginBottom: 2 }}>Позвали к столу или посадили гостей: официант уходит в конец. Занят и передал стол: остаётся первым.</div>
    </div>);
}

/**
 * Строка очереди в чате «Вся команда»: «Очередь к столам: Анна С. → Илья Б. → Мария К.», у официанта — его место. Хостес и
 * руководитель нажимают — лист с правкой (QueuePanel), пустую очередь — «Очередь к столам не составлена · Составить».
 * api: { queue, queueSet } (lib/chat-api.js); нет этапа 69 или нет официантов — строки нет.
 */
export function QueueStrip({ api, me }) {
  const [q, setQ] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const dead = React.useRef(false);   // нет этапа 69 — больше не спрашиваем
  const load = React.useCallback(() => (dead.current ? Promise.resolve() : Promise.resolve(api.queue()).then((r) => { if (r && r.error === "missing") dead.current = true; setQ(queueOf(r)); }).catch(() => {})), [api]);
  React.useEffect(() => {
    load();
    const t = setInterval(() => { try { if (!document.hidden) load(); } catch (e) { /* */ } }, 20000);
    return () => clearInterval(t);
  }, [load]);
  if (!q || (!q.list.length && !q.others.length)) return null;
  const line = queueLine(q, me && me.id);
  if (!line && !q.edit) return null;
  const save = (nq) => {
    setQ(nq); setBusy(true); setErr("");
    Promise.resolve(api.queueSet(queueOrd(nq))).then((r) => {
      setBusy(false);
      const qq = queueOf(r);
      if (qq) setQ(qq); else { setErr(r && r.error === "forbidden" ? "Менять очередь может хостес или руководитель." : "Не сохранилось. Проверь связь и попробуй ещё раз."); load(); }
    }, () => { setBusy(false); setErr("Не сохранилось. Проверь связь и попробуй ещё раз."); load(); });
  };
  const tap = () => { if (!q.edit) return; vibrate("light"); setErr(""); setOpen(true); };
  const mine = line && line.pos ? (line.away ? "ты на перерыве" : "ты " + line.pos + "-й") : "";
  return (<>
    <div className="ch-qs" data-queue-strip={line ? "on" : "none"}>
      <button type="button" className="ch-qs-b" onClick={tap} disabled={!q.edit} aria-label={line ? "Очередь к столам: " + line.names.join(", ") + (mine ? ", " + mine : "") : "Очередь к столам не составлена"}>
        <span className="ch-qs-l">{line ? "Очередь к столам" : "Очередь к столам не составлена"}</span>
        {line ? <span className="ch-qs-t" data-queue-strip-names="">{line.names.join(" → ")}</span> : null}
        {mine ? <span className="ch-qs-me" data-queue-strip-me="">{mine}</span> : null}
        {q.edit ? <span className="ch-qs-go">{line ? "Изменить" : "Составить"}</span> : null}
      </button>
    </div>
    {open ? <div className="ch-veil" onClick={() => setOpen(false)}>
      <div className="ch-sheet" role="dialog" aria-modal="true" aria-label="Очередь к столам" data-queue-sheet="" onClick={(e) => e.stopPropagation()}>
        <div className="ch-grip" aria-hidden="true" />
        <div className="ch-sheet-h"><span className="ch-sheet-t">Очередь к столам</span>
          <button type="button" className="ch-q-edit" data-queue-done="" onClick={() => setOpen(false)}>Готово</button></div>
        <div className="sa-dlgscroll" style={{ overflowY: "auto", maxHeight: "70vh", padding: "0 2px 8px" }}><QueuePanel q={q} busy={busy} err={err} onChange={save} /></div>
      </div>
    </div> : null}
  </>);
}
