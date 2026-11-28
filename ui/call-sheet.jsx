// ui/call-sheet.jsx — v212 (Доп. 538): «Позвать» подряд и короче.
// Владелец: «Бывает такое, что приходит несколько столов подряд, и хостес должен всех оповестить, а приложение не дает
// это сделать сразу, просит подождать минуту. Да и сам путь, позвать к столу довольно длинный. Много действий нужно
// сделать, мы можем сделать это проще и удобнее?» Лист жил в ui/chat.jsx (v90; схема зала — v189, ui/call-table.jsx).
//   • открывается сразу на «К столу» со схемой зала; схема и команда — из копии на телефоне, свежие приходят следом
//     (lib/call-series.js), лист не ждёт сервер;
//   • сверху вниз: схема, «Кого», «Зачем». «К столу» выбрано сразу, поэтому схема и люди — наверху, без прокрутки;
//   • «Кого» — кнопками те, кто сегодня в смене (официанты первыми), ниже «или всех по должности» и «Другой…» (весь
//     список с поиском);
//   • кнопка говорит, что уйдёт: «Позвать Анну к столу 13»; чего не хватает — «Выбери стол и кого позвать»;
//   • позвали — лист открыт дальше: над кнопкой «Позвали Анну к столу 13», у стола на схеме колокольчик (10 минут),
//     стол и человек сброшены, можно сразу следующий стол. Тот же вызов второй раз за 30 секунд сервер не шлёт
//     (этап 68): «Анну к столу 13 уже позвали, ждём ответа»;
//   • схема и люди листаются, кнопка внизу всегда на виду.
// v213 (Доп. 539): очередь официантов (этап 69, ui/call-queue.jsx). При «К столу» «Кого» — по очереди: следующий выбран
//   сразу, «Пропустить» — следующий за ним (пропущенный остаётся первым), позвали — он в конец, выбран следующий.
//   Хостес и руководитель правят очередь здесь же: «Изменить очередь». Нет этапа 69 — «Кого», как в v212.
// v215 (Доп. 541): очередь составляет хостес по приходу: утром она пустая, «Очередь не составлена · Составить» открывает
//   правку, там сегодняшние официанты по началу смены. Колокольчики на схеме — по состоянию вызова (chat_call_state раз
//   в 5 секунд): ждём, «Иду», молчит две минуты. У выбранного стола с вызовом без ответа — «Передать следующему по
//   очереди»: передаёт хостес сама, автоматом стол никуда не уходит.
// Открывают: колокольчик в чате «Вся команда» и в списке чатов (ui/chat.jsx), «Позвать» с главной хостес, из «Смены»
// и «Рассадки» (CallLayer в ui/chat.jsx; init — стол, который уже выбран).
import React from "react";
import { vibrate } from "../lib/utils";
import { SEARCH_ATTRS } from "../lib/search-field";
import { CALL_WHO, CALL_WHY, CALL_OWN_MAX, chatInitials, bubbleName } from "../lib/chat";
import { callAction, callHint, afterCall, shiftChips, recentCalls, rememberCall, tableMarks, cachedTeam, cachedBoard, freshTeam, freshBoard, callStates, markIds } from "../lib/call-series";
import { queueOf, queueLive, queueNext, queueAfterCall, queueOrd, queueEmpty, passedLine, passErrText } from "../lib/call-queue";
import { IC, posName, stop } from "./chat-kit";
import { FaceImg } from "./staff-photo";
import { QueueChips, QueuePanel } from "./call-queue";

const CallTables = React.lazy(() => import("./call-table").then((m) => ({ default: m.CallTables })));
// «К столу» зовут официантов: по должности — сначала они
const ROLE_ORDER = ["waiter", "lead", "host", "bar"];
const ROLES = [...CALL_WHO].sort((a, b) => ROLE_ORDER.indexOf(a[0]) - ROLE_ORDER.indexOf(b[0]));

/** Весь список команды с поиском — «Другой…»: кого нет среди кнопок (не в смене, не официант). */
function PickList({ team, bad, meId, picked, onPick }) {
  const [q, setQ] = React.useState("");
  const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");
  const all = (team || []).filter((p) => p && String(p.id) !== String(meId));
  const shown = all.filter((p) => !q.trim() || norm(p.name).includes(norm(q.trim())));
  const on = shown.filter((p) => p.shift), off = shown.filter((p) => !p.shift);
  const row = (p) => (
    <button key={p.id} type="button" className="ch-person" data-chat-person={p.id} aria-pressed={picked != null && String(picked) === String(p.id)} onClick={() => onPick(p)}>
      <span className="ch-ava" aria-hidden="true">{chatInitials(p.name)}<FaceImg who={{ id: p.id }} /></span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span className="ch-person-n">{p.name}</span>
        <span className="ch-person-p">{[posName(p.pos), p.shift ? "сегодня в смене" : ""].filter(Boolean).join(" · ")}</span></span>
    </button>);
  return (
    <div className="ch-cs-list sa-dlgscroll" data-call-list="">
      <input className="ch-search sa-field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти по имени" aria-label="Найти по имени" data-chat-search="" {...SEARCH_ATTRS} />
      {!team ? <div className="ch-empty" style={{ margin: "14px auto" }} role={bad ? "alert" : undefined} data-call-list-bad={bad ? "" : undefined}>{bad ? "Список коллег не загрузился. Проверь связь." : "Загружаю команду…"}</div>
        : !shown.length ? <div className="ch-empty" style={{ margin: "14px auto" }}>{q.trim() ? "Никого не нашёл." : "Пока здесь никого нет."}</div> : null}
      {on.length ? <div className="ch-sec">Сегодня в смене</div> : null}
      <div style={{ padding: "0 6px" }}>{on.map(row)}</div>
      {off.length && on.length ? <div className="ch-sec">Остальные</div> : null}
      <div style={{ padding: "0 6px" }}>{off.map(row)}</div>
    </div>);
}

/**
 * me: { id, name, restaurant }; api: { call, people, board } (lib/chat-api.js); chat — «Вся команда» (необязательно);
 * init: { tid, table } — стол уже выбран (из «Рассадки»). onSent(msg) — каждый ушедший вызов (переписка добавит его);
 * onClose(n) — закрыли, n — сколько позвали за это время.
 */
export function CallSheet({ a11y = false, me, api, chat = null, init = null, onClose, onSent = null }) {
  const rest = (me && me.restaurant) || "", meId = me && me.id;
  const [why, setWhy] = React.useState("table");
  const [who, setWho] = React.useState("");
  const [person, setPerson] = React.useState(null);
  const [tid, setTid] = React.useState((init && init.tid) || null);
  const [table, setTable] = React.useState(init && init.table != null ? String(init.table) : "");
  const [own, setOwn] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [last, setLast] = React.useState(null);   // что ушло последним: { line, again }
  const [count, setCount] = React.useState(0);    // сколько позвали, пока лист открыт
  const [recent, setRecent] = React.useState(() => recentCalls(rest));
  const [board, setBoard] = React.useState(() => cachedBoard(rest));
  const [boardDone, setBoardDone] = React.useState(() => !!cachedBoard(rest));
  const [team, setTeam] = React.useState(() => cachedTeam(rest));
  const [teamBad, setTeamBad] = React.useState(false);
  const [manual, setManual] = React.useState(false);
  const [more, setMore] = React.useState(false);
  // v213: очередь официантов — только свежая с сервера (копия могла устареть: кто следующий, решает сервер)
  const [q, setQ] = React.useState(null);
  const [skip, setSkip] = React.useState([]);     // пропущенные в этот раз (остаются первыми в очереди)
  const [auto, setAuto] = React.useState(false);  // человек выбран очередью, а не нажатием
  const [qEdit, setQEdit] = React.useState(!!(init && init.queue));   // v215: открыли с карточки «Очередь к столам» — сразу правка
  const [qBusy, setQBusy] = React.useState(false);
  const [qErr, setQErr] = React.useState("");
  // v215: что с вызовами к столам (колокольчики) и тик, чтобы «ждём» через две минуты стало «не отвечает»
  const [states, setStates] = React.useState({});
  const [tick, setTick] = React.useState(0);
  const [passBusy, setPassBusy] = React.useState(false);
  const stateRef = React.useRef(null);
  const busyRef = React.useRef(false);
  React.useEffect(() => {
    let on = true;
    freshBoard(api, rest).then((b) => { if (!on) return; if (b !== null) setBoard(b || null); setBoardDone(true); });
    freshTeam(api, rest).then((l) => { if (!on) return; if (l) { setTeam(l); setTeamBad(false); } else setTeamBad(true); });
    return () => { on = false; };
  }, [api, rest]);
  const loadQ = React.useCallback(() => (api && api.queue ? Promise.resolve(api.queue()).then((r) => { const qq = queueOf(r); if (qq) setQ(qq); }).catch(() => {}) : Promise.resolve()), [api]);
  React.useEffect(() => {
    loadQ();
    const t = setInterval(() => { try { if (!document.hidden) loadQ(); } catch (e) { /* */ } }, 20000);   // другая хостес тоже зовёт
    return () => clearInterval(t);
  }, [loadQ]);
  const ids = React.useMemo(() => markIds(recent), [recent]), idsKey = ids.join(",");
  React.useEffect(() => {
    if (!ids.length) { stateRef.current = null; return undefined; }
    let on = true, dead = false;   // dead — на сервере нет этапа 69: больше не спрашиваем, метки считаем сами
    const load = () => (!dead && api && api.callState ? Promise.resolve(api.callState(ids)).then((r) => { if (r && r.error === "missing") dead = true; else if (on && r && r.ok) setStates(callStates(r)); }).catch(() => {}) : Promise.resolve());
    stateRef.current = load;
    load();
    const t = setInterval(() => { try { if (!document.hidden) { load(); setTick((k) => k + 1); } } catch (e) { /* */ } }, 5000);
    return () => { on = false; clearInterval(t); };
  }, [idsKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  const plan = !!board && !manual;
  const qOn = why === "table" && !!q;   // очередь есть на сервере (этап 69)
  const useQ = qOn && !queueEmpty(q);
  // «К столу» и никто не выбран — следующий по очереди
  React.useEffect(() => {
    if (!useQ || who) return;
    const n = queueNext(q, skip);
    if (n) { setWho("person"); setPerson({ id: n.id, name: n.name }); setAuto(true); }
  }, [useQ, q, who, skip]);   // eslint-disable-line react-hooks/exhaustive-deps
  const call = { who, emp: person && person.id, toName: person && person.name, why, table: why === "table" ? table : "", text: why === "own" ? own : "" };
  const hint = callHint(call, plan);
  const chips = React.useMemo(() => shiftChips(team, meId), [team, meId]);
  const marks = React.useMemo(() => (board ? tableMarks(recent, board.plan, states) : {}), [board, recent, states, tick]);   // eslint-disable-line react-hooks/exhaustive-deps
  const inChips = !!(person && (useQ ? queueLive(q) : chips.list).some((p) => p.id === String(person.id)));
  const touch = () => setErr("");
  const pickPerson = (p) => { vibrate("light"); setWho("person"); setPerson({ id: String(p.id), name: String(p.name || "") }); setAuto(false); setMore(false); touch(); };
  const pickRole = (id) => { vibrate("light"); setWho(id); setPerson(null); setAuto(false); setMore(false); touch(); };
  const skipNext = (x) => { setSkip((sk) => [...sk, String(x.id)]); setWho(""); setPerson(null); setAuto(false); touch(); };
  const saveQ = (nq) => {
    setQ(nq); setQBusy(true); setQErr("");
    if (auto) { setWho(""); setPerson(null); setAuto(false); }   // следующий — по новой очереди
    Promise.resolve(api.queueSet(queueOrd(nq))).then((r) => {
      setQBusy(false);
      const qq = queueOf(r);
      if (qq) setQ(qq);
      else { setQErr(r && r.error === "forbidden" ? "Менять очередь может хостес или руководитель." : "Не сохранилось. Проверь связь и попробуй ещё раз."); loadQ(); }
    }, () => { setQBusy(false); setQErr("Не сохранилось. Проверь связь и попробуй ещё раз."); loadQ(); });
  };
  const close = () => { if (onClose) onClose(count); };
  // «На месте»: официант подошёл, не нажав «Иду», — хостес закрывает вызов сама (chat_call_done)
  const hereMark = (mk) => {
    if (!api || !api.callDone || !mk || !mk.msg || passBusy) return;
    setPassBusy(true); setErr("");
    Promise.resolve(api.callDone(mk.msg)).then((r) => {
      setPassBusy(false);
      if (!r || !r.ok) { vibrate("light"); setErr(r && r.error === "passed" ? "Этот стол уже передали дальше." : r && r.error === "missing" ? "Отметить пока нельзя: на сервере нет этапа 69." : "Не отметилось. Проверь связь и попробуй ещё раз."); return; }
      vibrate("success");
      setLast({ line: "Отметили: " + (mk.who === "person" ? String(mk.name || "").trim().split(/\s+/)[0] || "официант" : "официант") + " на месте", again: false });
      if (stateRef.current) stateRef.current();
    }, () => { setPassBusy(false); setErr("Не отметилось. Проверь связь и попробуй ещё раз."); });
  };
  // «Передать следующему по очереди» у стола, где официант не отвечает: решает хостес, сама передача — chat_pass
  const passMark = (mk) => {
    if (!api || !api.pass || !mk || !mk.msg || passBusy) return;
    setPassBusy(true); setErr("");
    Promise.resolve(api.pass(mk.msg)).then((r) => {
      setPassBusy(false);
      if (!r || !r.ok) { vibrate("light"); setErr(passErrText(r)); return; }
      vibrate("success");
      setLast({ line: passedLine(r.msg && r.msg.call) || "Стол передан дальше", again: false });
      if (r.next && onSent) onSent(r.next);
      loadQ(); if (stateRef.current) stateRef.current();
    }, () => { setPassBusy(false); setErr(passErrText({ error: "net" })); });
  };
  const submit = () => {
    if (busyRef.current) return;
    if (hint) { vibrate("light"); setErr(hint); return; }
    busyRef.current = true; setBusy(true); setErr(""); vibrate("medium");
    const c = { ...call, table: why === "table" ? String(table).trim() : "", text: why === "own" ? own.trim() : "" };
    const fin = (r) => {
      busyRef.current = false; setBusy(false);
      const res = afterCall({ who, person, tid, table, own }, c, r);
      if (!res.done) { setErr(res.err); return; }
      const msg = r && r.msg ? r.msg : null;
      const key = String((msg && msg.id) || [c.who, c.emp || "", c.why, c.table, c.text].join("|"));
      if (!res.again || !recent.some((x) => x.key === key)) {
        rememberCall(rest, { key, msg: msg && msg.id != null ? msg.id : null, tid: c.why === "table" ? tid : null, table: c.table, who: c.who, emp: c.emp || null, toName: c.toName || "", why: c.why, text: c.text });
        setRecent(recentCalls(rest));
      }
      setLast({ line: res.line, again: res.again });
      // v213: позвали лично к столу — он в конец очереди (сервер делает так же), выбран следующий; пропуски — заново
      if (c.who === "person" && c.why === "table" && !res.again) { setQ((qq) => queueAfterCall(qq, c.emp)); setSkip([]); }
      if (q) loadQ();
      setAuto(false);
      setWho(res.pick.who); setPerson(res.pick.person); setTid(res.pick.tid); setTable(res.pick.table); setOwn(res.pick.own);
      if (!res.again) { setCount((k) => k + 1); vibrate("success"); if (onSent) onSent(msg); }
    };
    Promise.resolve(api.call({ chat: chat && chat.id, who: c.who, emp: c.emp || null, why: c.why, table: c.table, text: c.text })).then(fin, () => fin({ ok: false, error: "net" }));
  };
  return (
    <div className="ch-veil" data-kbm="" onClick={close}>
      <div className="ch-sheet ch-cs" role="dialog" aria-modal="true" aria-label="Позвать" data-chat-callsheet="" onClick={stop}>
        <div className="ch-grip" aria-hidden="true" />
        <div className="ch-sheet-h"><span className="ch-sheet-t">Позвать</span>
          {count ? <span className="ch-cs-n" data-call-count="">{"позвали: " + count}</span> : null}
          <button type="button" className="ch-x" data-sa-back="" aria-label="Закрыть" onClick={close}>{IC.x}</button></div>
        <div className="ch-cs-body sa-dlgscroll" data-call-body="">
          {why === "table" && plan ? <div>
            <React.Suspense fallback={<div className="ch-cs-wait">Открываю схему зала…</div>}>
              <CallTables a11y={a11y} board={board} tid={tid} who={who} marks={marks} onPass={qOn ? passMark : null} onHere={api && api.callDone ? hereMark : null} passBusy={passBusy}
                onPick={(t) => { setTid(t.id); setTable(String(t.n)); touch(); }}
                onWaiter={pickPerson}
                onManual={() => { setManual(true); setTid(null); setTable(""); }} />
            </React.Suspense>
          </div> : null}
          {why === "table" && !plan ? <div className="ch-lbl" style={{ marginTop: 2 }}>Какой стол</div> : null}
          {why === "table" && !plan && !boardDone ? <div className="ch-cs-wait" data-call-board-wait="">Загружаю схему зала…</div> : null}
          {why === "table" && !plan && boardDone ? <input className="ch-field num sa-field" inputMode="numeric" value={table} maxLength={6} placeholder="Номер стола" aria-label="Номер стола" data-chat-table=""
            onChange={(e) => { setTable(e.target.value); touch(); }} /> : null}
          {useQ ? <QueueChips q={q} picked={who === "person" && person ? person.id : null} auto={auto} edit={q.edit} editing={qEdit}
            onPick={pickPerson} onSkip={skipNext} onEdit={() => { setQEdit((e) => !e); setQErr(""); }} /> : null}
          {qOn && !useQ && q.edit ? <div className="ch-lbl ch-q-lbl" data-queue-none=""><span>Очередь к столам не составлена</span>
            <button type="button" className="ch-q-edit" data-queue-open={qEdit ? "on" : ""} aria-expanded={qEdit} onClick={() => { vibrate("light"); setQEdit((e) => !e); setQErr(""); }}>{qEdit ? "Готово" : "Составить"}</button></div> : null}
          {qOn && qEdit && q.edit ? <QueuePanel q={q} busy={qBusy} err={qErr} onChange={saveQ} /> : null}
          {!useQ ? <div className="ch-lbl" style={why === "table" ? undefined : { marginTop: 2 }}>Кого</div> : null}
          {useQ ? null : chips.list.length ? <div className="ch-chips" role="radiogroup" aria-label={chips.shift ? "Кто сегодня в смене" : "Официанты"} data-call-people={chips.shift ? "shift" : "waiters"}>
            {chips.list.map((p) => <button key={p.id} type="button" role="radio" aria-checked={who === "person" && !!person && String(person.id) === p.id} className="ch-chip" data-call-person={p.id}
              aria-label={p.name + (posName(p.pos) ? ", " + posName(p.pos).toLowerCase() : "")} onClick={() => pickPerson(p)}>{p.label}</button>)}
          </div> : !team && !teamBad ? <div className="ch-cs-wait">Загружаю, кто в смене…</div> : null}
          <div className="ch-cs-or">{chips.list.length || useQ ? "или всех по должности" : "по должности"}</div>
          <div className="ch-chips sub" role="radiogroup" aria-label="По должности">
            {ROLES.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={who === id} className="ch-chip" data-chat-who={id} onClick={() => pickRole(id)}>{label}</button>)}
            <button type="button" role="radio" aria-checked={who === "person" && !!person && !inChips} className="ch-chip" data-call-more=""
              onClick={() => { vibrate("light"); setMore((m) => !m); }}>{who === "person" && person && !inChips ? bubbleName(person.name) : "Другой…"}</button>
          </div>
          {more ? <PickList team={team} bad={teamBad} meId={meId} picked={person && person.id} onPick={pickPerson} /> : null}
          {/* зачем — ниже: «К столу» выбрано сразу, схема и люди наверху, без прокрутки */}
          <div className="ch-lbl">Зачем</div>
          <div className="ch-chips sub" role="radiogroup" aria-label="Зачем" data-call-why="">
            {CALL_WHY.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={why === id} className="ch-chip" data-chat-why={id}
              onClick={() => { vibrate("light"); if (auto && id !== "table") { setWho(""); setPerson(null); setAuto(false); } setWhy(id); touch(); }}>{label}</button>)}
          </div>
          {why === "own" ? <input className="ch-field sa-field" value={own} maxLength={CALL_OWN_MAX} placeholder="Например: принеси детский стульчик" aria-label="Зачем зовёшь" data-chat-own=""
            onChange={(e) => { setOwn(e.target.value); touch(); }} /> : null}
        </div>
        <div className="ch-cs-foot">
          {err ? <div className="ch-err" role="alert" data-call-err="">{err}</div> : null}
          <div aria-live="polite">{last && !err ? <div className={"ch-cs-last" + (last.again ? " again" : "")} data-call-last={last.again ? "again" : "sent"}>{last.again ? IC.clock : IC.check}<span>{last.line}</span></div> : null}</div>
          <button type="button" className={"ch-main" + (hint ? " wait" : "")} data-chat-call-send="" aria-disabled={hint ? "true" : undefined} disabled={busy} onClick={submit}>
            {busy ? "Зову…" : hint || callAction(call)}</button>
        </div>
      </div>
    </div>);
}
