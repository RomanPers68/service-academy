// ui/newbie.jsx — v107 (Доп. 420): новичок. NewbieScreen — его «Первая неделя»: первая смена с памяткой (к какому времени,
// как найти, форма, кто встретит), наставник, план по дням, первыми — темы с собеседования (урок открывается сразу).
// NewbiesScreen — «Новички»: у руководителя все новички заведения (наставник, собеседование, «Представить команде»,
// подтверждения, памятка), у наставника — свои. Сервер — этап 41 (newbie_me, newbie_list, …), слова — lib/newbie.js.
import React from "react";
import { createPortal } from "react-dom";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { vibrate, isFemaleName } from "../lib/utils";
import { serverMissing } from "../lib/server-text";
import { labelStyle } from "./tokens";
import {
  newbieModel, planOf, doneCount, totalCount, memoOf, arriveAt, shiftLabel, whenWord, withUs, firstLine, focusLine, posWord, dayDiff,
  NB_ARRIVE, NB_MEMO_MAX, NB_BUDDY_STEPS, NB_PLAN,
} from "../lib/newbie";
import { dLong, upFirst, nm } from "../lib/morning";

const SQL = "supabase-stage41-newbie.sql";
const P = (a11y) => (a11y
  ? { ok: "#2C6B48", warn: "#8B5A12", line: "rgba(139,106,48,0.22)", chip: "rgba(139,106,48,0.10)", gold: "#7A5D2A", soft: "rgba(139,106,48,0.16)", bad: "#A33A2A",
      track: "rgba(140,105,40,0.16)", sheet: "#F6EEDC", veil: "rgba(70,52,24,0.35)" }
  : { ok: "#8AD8AF", warn: "#E4B36A", line: "rgba(214,178,102,0.18)", chip: "rgba(214,178,102,0.10)", gold: "#D9B87C", soft: "rgba(200,169,110,0.22)", bad: "#E07878",
      track: "rgba(160,120,60,0.2)", sheet: "#1C1710", veil: "rgba(8,6,3,0.62)" });
const errText = (r) => (r && r.error === "auth" ? "Сессия устарела. Войди заново." : r && r.error === "forbidden" ? "Это могут руководитель и наставник." : "Нет связи. Попробуй ещё раз.");
const ini = (name) => String(name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
const dayMon = (iso) => { const s = dLong(iso); return s ? s.split(", ")[1] || s : ""; };
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

// кружок-отметка шага: сделано — галочка
function Check({ on, c, size = 23 }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, boxSizing: "border-box", borderRadius: "50%", flexShrink: 0, display: "inline-grid", placeItems: "center",
      background: on ? "radial-gradient(circle at 35% 30%, #4FB484, #2A6B45 72%)" : "transparent", border: on ? "none" : "2px solid " + c.track, color: "#fff" }}>
      {on ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.2 4.2L19 7" /></svg> : null}
    </span>);
}
const Ava = ({ name, c, size = 40 }) => (
  <span aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "inline-grid", placeItems: "center",
    background: "linear-gradient(135deg,#C8A96E,#7A5D2A)", color: "#fff", fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: size > 34 ? 14 : 12 }}>{ini(name)}</span>);
function Bar({ done, total, c }) {
  const p = total ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ height: 7, borderRadius: 6, background: c.track, overflow: "hidden" }} aria-hidden="true">
      <div style={{ width: p + "%", height: "100%", borderRadius: 6, background: "linear-gradient(90deg,#C8A96E,#7A5D2A)", transition: "width .3s" }} />
    </div>);
}
// лист снизу (как «Смены в календаре телефона»)
function Sheet({ a11y, title, onClose, children, mark }) {
  const c = P(a11y), text = a11y ? "#2A1F0E" : "#EFE4C8";
  return createPortal(
    <div data-nb-sheet={mark || ""} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: c.veil, display: "flex", alignItems: "flex-end" }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box", margin: "0 auto",
          padding: "18px 18px calc(18px + env(safe-area-inset-bottom,0px))", borderRadius: "22px 22px 0 0", backgroundColor: c.sheet, color: text,
          boxShadow: "0 -10px 40px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <h3 style={{ flex: 1, margin: 0, fontFamily: "'Piazzolla', Georgia, serif", fontSize: 19, color: text }}>{title}</h3>
          <button type="button" className="sa-btn" data-sa-back="" aria-label="Закрыть" onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: "50%", border: 0, background: "none", color: c.gold, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>, document.body);
}
function useStyles(T, a11y) {
  const c = P(a11y);
  const card = { ...T.modCard, display: "block", padding: "12px 14px", marginBottom: 12, cursor: "default" };
  const sub = T.modSub.color, text = T.modTitle.color;
  const ghost = { flex: "0 0 auto", alignSelf: "center", padding: "6px 12px", borderRadius: 999, border: "1px solid " + c.line, background: c.chip, color: text,
    fontSize: 12.5, fontFamily: "Georgia, serif", cursor: "pointer", whiteSpace: "nowrap" };
  const main = { display: "block", width: "100%", marginTop: 10, padding: 11, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14.5,
    fontWeight: "bold", color: "#1A1008", background: "linear-gradient(180deg,#E4C88C,#C8A96E)" };
  const h = (t, n = null, key = "") => (
    <div data-nb-h={key} style={{ ...labelStyle(13.5), color: c.gold, margin: "6px 2px 8px", display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ flex: 1 }}>{t}</span>{n != null ? <span style={{ color: sub, fontStyle: "normal" }}>{n}</span> : null}
    </div>);
  const line = (key, label, value, extra = null) => (
    <div key={key} data-nb-line={key} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderTop: "1px solid " + c.line }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.45, color: text }}>{label ? <span style={{ color: sub }}>{label} </span> : null}{value}</div>
      {extra}
    </div>);
  return { c, card, sub, text, ghost, main, h, line };
}

// ── «Первая неделя» новичка ───────────────────────────────────────────────────────
/** onOpenModule(id) — открыть тему трека; onDm({ id, name }) — личная переписка; onChat(msg) — «Вся команда» (у сообщения msg); onLegacy() — прежний
 *  экран (этапа 41 нет или сервер не считает новичком). */
export function NewbieScreen({ T, a11y, profile, track = "", modules = [], completed = {}, quizDone = {}, onBack, onOpenModule = () => {}, onDm = null, onChat = null, onLegacy = null }) {
  const S = useStyles(T, a11y), { c, card, sub, text, ghost, h, line } = S;
  const [st, setSt] = React.useState({ phase: "load" });
  const [busy, setBusy] = React.useState("");
  const legacy = React.useRef(onLegacy);
  legacy.current = onLegacy;
  const load = React.useCallback(() => {
    rpc("newbie_me", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) { if (legacy.current) legacy.current(); else setSt({ phase: "missing" }); return; }
      if (!r || r.ok === false) { setSt({ phase: "error", text: errText(r) }); return; }
      if (r.newbie === false) { if (legacy.current) legacy.current(); else setSt({ phase: "notnew" }); return; }
      setSt({ phase: "ready", nb: newbieModel(r) });
    }).catch(() => setSt({ phase: "error", text: "Нет связи. Попробуй ещё раз." }));
  }, []);
  React.useEffect(() => { load(); }, [load]);
  const nb = st.nb;
  const plan = nb ? planOf(nb, { track, modules, completed, quizDone }) : null;
  // тема пройдена в уроках — отмечаем на сервере (руководитель и наставник видят)
  const synced = React.useRef(new Set());
  React.useEffect(() => {
    if (!plan || !nb) return;
    const ids = plan.sections.flatMap((s) => s.steps).filter((s) => s.auto && !nb.checked[s.id] && !synced.current.has(s.id)).map((s) => s.id);
    if (!ids.length) return;
    ids.forEach((id) => synced.current.add(id));
    rpc("newbie_check", { p_token: saToken(), p_steps: ids, p_on: true }).then((r) => {
      if (r && r.ok && r.checked) setSt((x) => (x.nb ? { ...x, nb: { ...x.nb, checked: newbieModel({ checked: r.checked }).checked } } : x));
    }).catch(() => {});
  });   // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (s) => {
    if (s.buddy || s.auto || busy) return;
    vibrate("light");
    const on = !nb.checked[s.id], was = nb.checked;
    setSt((x) => ({ ...x, nb: { ...x.nb, checked: on ? { ...x.nb.checked, [s.id]: new Date().toISOString() } : Object.fromEntries(Object.entries(x.nb.checked).filter(([k]) => k !== s.id)) } }));
    setBusy(s.id);
    rpc("newbie_check", { p_token: saToken(), p_steps: [s.id], p_on: on }).then((r) => {
      setBusy("");
      if (!r || !r.ok) setSt((x) => ({ ...x, nb: { ...x.nb, checked: was } }));
    }).catch(() => { setBusy(""); setSt((x) => ({ ...x, nb: { ...x.nb, checked: was } })); });
  };
  const me = String((profile && profile.name) || "").trim().split(/\s+/)[0];
  const female = isFemaleName(profile && profile.name, profile && profile.surname);
  return (
    <div style={T.screen} className="sa-screen" data-newbie={st.phase}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Первая неделя</div>
      </div>
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>
        {st.phase === "load" ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>Собираю твою неделю…</div> : null}
        {st.phase === "missing" ? <div style={card} data-nb-missing="">{serverMissing({ what: "«Первая неделя»", admin: !!(profile && profile.is_admin), sql: SQL })}</div> : null}
        {st.phase === "notnew" ? <div style={card} data-nb-notnew="">«Первая неделя» открыта новичкам. Если ты только пришёл в команду, скажи руководителю: он добавит тебя в «Новички».</div> : null}
        {st.phase === "error" ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>{st.text}
          <div><button type="button" style={{ ...ghost, marginTop: 10 }} onClick={() => { vibrate("light"); load(); }}>Ещё раз</button></div></div> : null}
        {st.phase === "ready" && nb ? (<>
          <div style={{ margin: "0 2px 14px" }} data-nb-hello="">
            <div style={{ fontFamily: "'Piazzolla', Georgia, serif", fontWeight: 700, fontSize: 21, color: text, lineHeight: 1.25 }}>{"Добро пожаловать" + (me ? ", " + me : "")}</div>
            <div style={{ fontSize: 13, color: sub, marginTop: 3 }}>{[nb.rest, posWord(nb.pos), "с нами " + withUs(nb.days)].filter(Boolean).join(" · ")}</div>
          </div>

          {nb.first && dayDiff(nb.day, nb.first.day) >= 0 ? (<>
            {h("Первая смена", null, "first")}
            <div style={card} data-nb-sec="first">
              <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: "bold", color: text }} data-nb-first={nb.first.day}>{upFirst(whenWord(nb.first.day, nb.day))}, {shiftLabel(nb.first)}</div>
              <div style={{ fontSize: 12.5, color: sub, margin: "2px 0 8px" }}>{upFirst(dLong(nb.first.day))}</div>
              {line("arrive", "Приходи к", <b>{arriveAt(nb.first.from, nb.memo.arrive)}</b>)}
              {nb.memo.addr ? line("addr", "Как найти:", nb.memo.addr) : null}
              {nb.memo.dress ? line("dress", "Форма:", nb.memo.dress) : null}
              {line("meet", "", nb.buddy ? "Тебя встретит " + nm(nb.buddy.name) + ", твой наставник" : nb.memo.meet ? "Тебя встретит: " + nb.memo.meet : "Тебя встретит менеджер смены",
                nb.buddy && onDm ? <button type="button" style={ghost} data-nb-dm={nb.buddy.id} onClick={() => { vibrate("light"); onDm({ id: nb.buddy.id, name: nb.buddy.name }); }}>Написать</button> : null)}
              {nb.memo.extra ? line("extra", "", nb.memo.extra) : null}
            </div>
          </>) : null}

          {h("Наставник", null, "buddy")}
          <div style={card} data-nb-sec="buddy">
            {nb.buddy ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Ava name={nb.buddy.name} c={c} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", color: text }} data-nb-buddy={nb.buddy.id}>{nb.buddy.name}</div>
                  <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.4 }}>{[upFirst(posWord(nb.buddy.pos)), "покажет, где что, и подтвердит шаги плана"].filter(Boolean).join(" · ")}</div>
                </div>
                {onDm ? <button type="button" style={ghost} data-nb-dm={nb.buddy.id} onClick={() => { vibrate("light"); onDm({ id: nb.buddy.id, name: nb.buddy.name }); }}>Написать</button> : null}
              </div>
            ) : <div style={{ fontSize: 14, color: sub, lineHeight: 1.45 }} data-nb-nobuddy="">Наставника назначит руководитель. Пока с вопросами подходи к менеджеру смены.</div>}
            {!nb.first ? <div style={{ fontSize: 12.5, color: sub, marginTop: 8 }}>{firstLine(nb)}</div> : nb.first && dayDiff(nb.day, nb.first.day) < 0 ? <div style={{ fontSize: 12.5, color: sub, marginTop: 8 }}>{firstLine(nb)}</div> : null}
          </div>

          {nb.solo ? (
            <div style={{ ...card, border: "1px solid " + c.ok }} data-nb-solo="">
              <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", color: c.ok }}>{"Ты " + (female ? "вышла" : "вышел") + " на самостоятельную смену"}</div>
              <div style={{ fontSize: 12.5, color: sub, marginTop: 3 }}>{dayMon(String(nb.solo.at).slice(0, 10))}{nb.solo.name ? " · " + (isFemaleName(...String(nb.solo.name).split(" ")) ? "подтвердила " : "подтвердил ") + nm(nb.solo.name) : ""}</div>
              {onChat ? <button type="button" style={{ ...ghost, marginTop: 8 }} data-nb-chat="" onClick={() => { vibrate("light"); onChat(); }}>Открыть «Вся команда»</button> : null}
            </div>) : null}

          {h("План недели", "сделано " + plan.done + " из " + plan.total, "plan")}
          <div style={{ margin: "0 2px 12px" }}><Bar done={plan.done} total={plan.total} c={c} /></div>
          {plan.sections.map((sec) => (
            <div key={sec.key} style={{ marginBottom: 12 }} data-nb-sec={sec.key}>
              <div style={{ color: c.gold, fontSize: 11, letterSpacing: 2, fontWeight: "bold", marginBottom: 6, paddingLeft: 2 }}>{sec.title}</div>
              {sec.key === "focus" ? <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.45, margin: "0 2px 8px" }}>На собеседовании эти темы дались труднее всего. Начни с них.</div> : null}
              {sec.steps.map((s) => {
                const can = !s.buddy && !s.auto;
                const subLine = s.buddy ? (s.conf ? "Подтверждено: " + nm(s.conf.name) + ", " + dayMon(String(s.conf.at).slice(0, 10)) : "Подтверждает наставник") : s.sub || "";
                return (
                  <div key={s.id} data-nb-step={s.id} data-nb-done={s.done ? "1" : "0"} role={can ? "checkbox" : undefined} aria-checked={can ? s.done : undefined} tabIndex={can ? 0 : undefined}
                    onClick={can ? () => toggle(s) : undefined} onKeyDown={can ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(s); } } : undefined}
                    style={{ ...T.modCard, display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 8, cursor: can ? "pointer" : "default" }}>
                    <Check on={s.done} c={c} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: s.done ? sub : text, fontSize: 14, lineHeight: 1.4, textDecoration: s.done && !s.module ? "line-through" : "none" }}>{s.text}</div>
                      {subLine ? <div style={{ fontSize: 12, color: s.buddy && s.conf ? c.ok : sub, marginTop: 2, lineHeight: 1.4 }}>{subLine}</div> : null}
                    </div>
                    {s.module ? <button type="button" style={ghost} data-nb-open={s.module} onClick={(e) => { e.stopPropagation(); vibrate("light"); onOpenModule(s.module); }}>{s.done ? "Повторить" : "Открыть"}</button> : null}
                  </div>);
              })}
            </div>))}

          {nb.hello ? (
            <div style={card} data-nb-team="">
              <div style={{ fontSize: 14, color: text, lineHeight: 1.45 }}>{"Тебя представили в «Вся команда»" + (nb.hello.n ? ": поздоровались " + nb.hello.n : "")}</div>
              {onChat ? <button type="button" style={{ ...ghost, marginTop: 8 }} data-nb-chat="" onClick={() => { vibrate("light"); onChat(nb.hello.msg); }}>Открыть чат</button> : null}
            </div>) : null}
        </>) : null}
      </div>
    </div>);
}

// ── «Новички»: руководитель и наставник ─────────────────────────────────────────────
function MemoSheet({ a11y, memo, onClose, onSaved }) {
  const c = P(a11y), text = a11y ? "#2A1F0E" : "#EFE4C8", sub = a11y ? "#6B5B40" : "#A99B7E";
  const [m, setM] = React.useState(() => memoOf(memo));
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const fld = (k, label, ph, rows = 1) => (
    <label style={{ display: "block", marginTop: 10 }}>
      <span style={{ display: "block", fontSize: 12.5, color: sub, marginBottom: 4 }}>{label}</span>
      {rows > 1
        ? <textarea className="sa-field" data-nb-memo={k} rows={rows} maxLength={NB_MEMO_MAX[k]} value={m[k]} placeholder={ph} onChange={(e) => setM({ ...m, [k]: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 12, border: "1px solid " + c.line, background: "transparent", color: text, fontFamily: "Georgia, serif", fontSize: 14, resize: "vertical" }} />
        : <input className="sa-field" data-nb-memo={k} maxLength={NB_MEMO_MAX[k]} value={m[k]} placeholder={ph} onChange={(e) => setM({ ...m, [k]: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 12, border: "1px solid " + c.line, background: "transparent", color: text, fontFamily: "Georgia, serif", fontSize: 14 }} />}
    </label>);
  const save = () => {
    if (busy) return;
    setBusy(true); setErr(""); vibrate("light");
    rpc("newbie_memo_set", { p_token: saToken(), p_memo: m }).then((r) => {
      setBusy(false);
      if (r && r.ok) { vibrate("success"); onSaved(r.memo || m); } else setErr(errText(r));
    }).catch(() => { setBusy(false); setErr("Нет связи. Попробуй ещё раз."); });
  };
  return (
    <Sheet a11y={a11y} title="Памятка новичку" onClose={onClose} mark="memo">
      <p style={{ margin: "0 0 4px", fontSize: 13, color: sub, lineHeight: 1.5 }}>Новичок получит её в Telegram накануне первой смены и увидит в «Первой неделе». Пустое не показывается.</p>
      {fld("addr", "Как найти и где вход", "Служебный вход со двора, звонок справа", 2)}
      <div style={{ marginTop: 10 }}>
        <span style={{ display: "block", fontSize: 12.5, color: sub, marginBottom: 6 }}>За сколько приходить до начала смены</span>
        <div role="group" aria-label="За сколько приходить" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {NB_ARRIVE.map((x) => { const on = m.arrive === x;
            return <button key={x} type="button" aria-pressed={on} data-nb-arrive={x} onClick={() => setM({ ...m, arrive: x })}
              style={{ padding: "6px 11px", borderRadius: 999, border: "1px solid " + (on ? c.gold : c.line), background: on ? c.soft : "transparent", color: on ? text : sub, fontFamily: "Georgia, serif", fontSize: 13, cursor: "pointer" }}>
              {x ? x + " мин" : "к началу"}</button>; })}
        </div>
      </div>
      {fld("dress", "Форма", "Чёрный верх, тёмные брюки, закрытая обувь", 2)}
      {fld("meet", "Кто встретит, если наставника ещё нет", "Менеджер смены")}
      {fld("extra", "Ещё", "Обед для команды в 15:30, шкафчик выдаст менеджер", 3)}
      {err ? <p role="alert" style={{ margin: "10px 0 0", fontSize: 13, color: c.bad }}>{err}</p> : null}
      <button type="button" data-nb-memo-save="" disabled={busy} onClick={save}
        style={{ display: "block", width: "100%", marginTop: 14, padding: 13, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", color: "#1A1008", background: "linear-gradient(180deg,#E4C88C,#C8A96E)" }}>
        {busy ? "Сохраняю…" : "Сохранить"}</button>
    </Sheet>);
}

function PickSheet({ a11y, title, mark, rows, onPick, onClose, note = "" }) {
  const c = P(a11y), text = a11y ? "#2A1F0E" : "#EFE4C8", sub = a11y ? "#6B5B40" : "#A99B7E";
  return (
    <Sheet a11y={a11y} title={title} onClose={onClose} mark={mark}>
      {note ? <p style={{ margin: "0 0 8px", fontSize: 13, color: sub, lineHeight: 1.5 }}>{note}</p> : null}
      {rows.length ? rows.map((r) => (
        <button key={r.key} type="button" data-nb-pick={r.key} onClick={() => { vibrate("light"); onPick(r); }}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "10px 4px", border: 0, borderTop: "1px solid " + c.line, background: "none", cursor: "pointer", color: text }}>
          {r.name ? <Ava name={r.name} c={c} size={32} /> : null}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 14.5, color: r.on ? c.gold : text }}>{r.title}</span>
            {r.sub ? <span style={{ display: "block", fontSize: 12.5, color: sub, lineHeight: 1.4 }}>{r.sub}</span> : null}
          </span>
          {r.on ? <span style={{ color: c.gold, fontSize: 12.5 }}>сейчас</span> : null}
        </button>)) : <p style={{ fontSize: 13.5, color: sub }}>Пока некого выбрать.</p>}
    </Sheet>);
}

/** onChat() — «Вся команда» (там карточки «Знакомьтесь»); onDm({ id, name }). */
export function NewbiesScreen({ T, a11y, profile, onBack, onChat = null, onDm = null, onLegacy = null }) {
  const S = useStyles(T, a11y), { c, card, sub, text, ghost, main, h, line } = S;
  const [st, setSt] = React.useState({ phase: "load" });
  const [open, setOpen] = React.useState(null);        // раскрытый новичок
  const [sheet, setSheet] = React.useState(null);      // memo | { buddy: emp } | { cand: emp } | add
  const [busy, setBusy] = React.useState("");
  const [note, setNote] = React.useState({});          // emp → текст ответа
  const [sure, setSure] = React.useState("");          // emp — «Убрать из новичков?» второй раз
  const legacy = React.useRef(onLegacy);
  legacy.current = onLegacy;
  const load = React.useCallback(() => {
    rpc("newbie_list", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) { if (legacy.current) legacy.current(); else setSt({ phase: "missing" }); return; }
      if (!r || r.ok === false) { setSt({ phase: "error", text: errText(r) }); return; }
      setSt({ phase: "ready", lead: !!r.lead, day: r.day || "", memo: memoOf(r.memo), list: (Array.isArray(r.list) ? r.list : []).map(newbieModel),
        team: Array.isArray(r.team) ? r.team : [], cands: Array.isArray(r.cands) ? r.cands : [], led: Array.isArray(r.led) ? r.led : [] });
    }).catch(() => setSt({ phase: "error", text: "Нет связи. Попробуй ещё раз." }));
  }, []);
  React.useEffect(() => { load(); }, [load]);
  const upd = (item) => setSt((x) => ({ ...x, list: x.list.map((n) => (n.emp === item.emp ? newbieModel(item) : n)) }));
  const act = (emp, fn, args, done) => {
    if (busy) return;
    vibrate("light"); setBusy(emp + fn); setNote((x) => ({ ...x, [emp]: "" }));
    rpc(fn, { p_token: saToken(), ...args }).then((r) => {
      setBusy("");
      if (r && r.ok) { if (r.item) upd(r.item); if (done) done(r); vibrate("success"); }
      else setNote((x) => ({ ...x, [emp]: r && r.error === "bad_buddy" ? "Этого человека нельзя назначить наставником." : errText(r) }));
    }).catch(() => { setBusy(""); setNote((x) => ({ ...x, [emp]: "Нет связи. Попробуй ещё раз." })); });
  };
  const lead = st.lead;
  const list = st.list || [];
  const nbOf = (emp) => list.find((n) => n.emp === emp);

  const memoCard = () => {
    const m = st.memo;
    return (<>
      {h("Памятка новичку", null, "memo")}
      <div style={card} data-nbl-memo="">
        <div style={{ fontSize: 13, color: sub, lineHeight: 1.45, marginBottom: 4 }}>Её получает новичок накануне первой смены и видит в «Первой неделе».</div>
        {line("arrive", "Приходить:", m.arrive ? "за " + m.arrive + " минут до смены" : "к началу смены")}
        {line("addr", "Как найти:", m.addr || <span style={{ color: sub }}>не указано</span>)}
        {line("dress", "Форма:", m.dress || <span style={{ color: sub }}>не указано</span>)}
        {line("meet", "Встретит:", "наставник; если его нет, " + (m.meet || "менеджер смены"))}
        {m.extra ? line("extra", "Ещё:", m.extra) : null}
        <button type="button" style={{ ...ghost, marginTop: 8 }} data-nbl-memo-edit="" onClick={() => { vibrate("light"); setSheet("memo"); }}>Изменить</button>
      </div>
    </>);
  };

  const item = (n) => {
    const isOpen = open === n.emp, done = doneCount(n), total = totalCount(n);
    const conf = (step) => n.confirm[step];
    const confBtn = (step, label) => {
      const cf = conf(step);
      return line("cf-" + step, "", <>{label}<div style={{ fontSize: 12, color: cf ? c.ok : sub, marginTop: 2 }}>{cf ? "Подтверждено: " + nm(cf.name) + ", " + dayMon(String(cf.at).slice(0, 10)) : "Ещё не подтверждено"}</div></>,
        <button type="button" style={cf ? ghost : { ...ghost, border: "1px solid " + c.gold, color: text }} data-nbl-confirm={step} data-nbl-emp={n.emp} disabled={!!busy}
          onClick={() => act(n.emp, "newbie_confirm", { p_emp: n.emp, p_step: step, p_on: !cf })}>{cf ? "Снять" : "Подтвердить"}</button>);
    };
    const candLine = lead ? (n.cand ? "Собеседование " + dayMon(n.cand.date) + (n.focus.length ? ": " + focusLine(n.focus) : ": сильные по всем темам")
      : n.noCand ? "Без собеседования" : "Собеседование не найдено") : null;
    return (
      <div key={n.emp} style={{ ...card, padding: 0 }} data-nbl-item={n.emp}>
        <div role="button" tabIndex={0} aria-expanded={isOpen} onClick={() => { vibrate("light"); setOpen(isOpen ? null : n.emp); setSure(""); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(isOpen ? null : n.emp); } }}
          style={{ display: "flex", gap: 12, padding: "12px 14px", cursor: "pointer" }}>
          <Ava name={n.name} c={c} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", color: text }}>{n.name}</div>
            <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.45 }}>{[upFirst(posWord(n.pos)), "с нами " + withUs(n.days)].filter(Boolean).join(" · ")}</div>
            <div style={{ fontSize: 13, color: text, lineHeight: 1.45, marginTop: 4 }} data-nbl-first="">{firstLine(n)}</div>
            {lead ? <div style={{ fontSize: 13, color: n.buddy ? text : c.warn, lineHeight: 1.45 }} data-nbl-buddy-line="">{n.buddy ? "Наставник: " + nm(n.buddy.name) : "Наставник не назначен"}</div> : null}
            {candLine ? <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.45 }} data-nbl-cand-line="">{candLine}</div> : null}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}><Bar done={done} total={total} c={c} /></div>
              <span style={{ fontSize: 12, color: sub }} data-nbl-done={done}>{done} из {total}</span>
            </div>
            {n.solo ? <div style={{ fontSize: 12.5, color: c.ok, marginTop: 6 }} data-nbl-solo="">{"Самостоятельная смена: " + dayMon(String(n.solo.at).slice(0, 10))}</div>
              : n.hello ? <div style={{ fontSize: 12.5, color: sub, marginTop: 6 }} data-nbl-hello-st="">{(isFemaleName(...n.name.split(" ")) ? "Представлена" : "Представлен") + " команде" + (n.hello.n ? " · поздоровались " + n.hello.n : "")}</div> : null}
          </div>
          <span aria-hidden="true" style={{ alignSelf: "center", color: sub, fontSize: 18, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>›</span>
        </div>
        {isOpen ? (
          <div style={{ padding: "0 14px 12px" }} data-nbl-open={n.emp}>
            {lead ? line("buddy", "Наставник:", n.buddy ? n.buddy.name : <span style={{ color: c.warn }}>не назначен</span>,
              <button type="button" style={ghost} data-nbl-buddy={n.emp} onClick={() => { vibrate("light"); setSheet({ buddy: n.emp }); }}>{n.buddy ? "Сменить" : "Назначить"}</button>) : null}
            {lead ? line("cand", "Собеседование:", n.cand ? n.cand.name + ", " + dayMon(n.cand.date) : n.noCand ? "нет" : "не найдено",
              <button type="button" style={ghost} data-nbl-cand={n.emp} onClick={() => { vibrate("light"); setSheet({ cand: n.emp }); }}>{n.cand || n.noCand ? "Сменить" : "Выбрать"}</button>) : null}
            {!lead && n.first && dayDiff(n.day, n.first.day) >= 0 ? line("arrive", "", "Встретить к " + arriveAt(n.first.from, n.memo.arrive) + ", " + whenWord(n.first.day, n.day)) : null}
            {n.focus.length && !lead ? line("focus", "Темы для занятий:", focusLine(n.focus, false)) : null}
            {confBtn("d2c", "5 столов под присмотром наставника")}
            {confBtn("d3b", "Первая самостоятельная смена")}
            {lead && !n.hello ? <button type="button" style={main} data-nbl-hello={n.emp} disabled={!!busy}
              onClick={() => act(n.emp, "newbie_set", { p_emp: n.emp, p_hello: true }, () => setNote((x) => ({ ...x, [n.emp]: "Карточка «Знакомьтесь» в «Вся команда»" })))}>Представить команде</button> : null}
            {lead && n.hello && onChat ? <button type="button" style={{ ...ghost, marginTop: 10 }} data-nbl-chat="" onClick={() => { vibrate("light"); onChat(); }}>Открыть «Вся команда»</button> : null}
            {!lead && onDm ? <button type="button" style={{ ...ghost, marginTop: 10 }} data-nbl-dm={n.emp} onClick={() => { vibrate("light"); onDm({ id: n.emp, name: n.name }); }}>{"Написать: " + firstName(n.name)}</button> : null}
            {note[n.emp] ? <div role="status" style={{ fontSize: 12.5, color: text, marginTop: 8 }} data-nbl-note="">{note[n.emp]}</div> : null}
            {lead ? <button type="button" data-nbl-off={n.emp} disabled={!!busy}
              onClick={() => { if (sure !== n.emp) { vibrate("light"); setSure(n.emp); return; } setSure(""); act(n.emp, "newbie_add", { p_emp: n.emp, p_on: false }, () => setSt((x) => ({ ...x, list: x.list.filter((y) => y.emp !== n.emp) }))); }}
              style={{ display: "block", width: "100%", marginTop: 10, padding: 10, borderRadius: 999, cursor: "pointer", background: "transparent", border: "1px solid " + (sure === n.emp ? c.bad : c.line), color: sure === n.emp ? c.bad : sub, fontSize: 13, fontFamily: "Georgia, serif" }}>
              {sure === n.emp ? "Убрать? Нажми ещё раз" : "Убрать из новичков"}</button> : null}
          </div>) : null}
      </div>);
  };

  const sh = sheet && typeof sheet === "object" ? sheet : null;
  return (
    <div style={T.screen} className="sa-screen" data-newbies={st.phase} data-newbies-lead={st.lead ? "1" : "0"}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Новички</div>
      </div>
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>
        {st.phase === "load" ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>Загружаю…</div> : null}
        {st.phase === "missing" ? <div style={card} data-nbl-missing="">{serverMissing({ what: "«Новички»", many: true, admin: !!(profile && profile.is_admin), sql: SQL })}</div> : null}
        {st.phase === "error" ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>{st.text}
          <div><button type="button" style={{ ...ghost, marginTop: 10 }} onClick={() => { vibrate("light"); load(); }}>Ещё раз</button></div></div> : null}
        {st.phase === "ready" ? (<>
          {lead ? memoCard() : null}
          {h(lead ? "Новички" : "Ты наставник", list.length || null, "list")}
          {list.length ? list.map(item) : (
            <div style={card} data-nbl-empty="">{lead ? "Сейчас новичков нет. Новый сотрудник появится здесь сам, когда владелец заведёт его в «Сотрудниках»." : "Сейчас ты никого не ведёшь. Наставника назначает руководитель в «Новичках»."}</div>)}
          {lead ? <button type="button" style={{ ...ghost, display: "block", width: "100%", padding: "10px 12px" }} data-nbl-add="" onClick={() => { vibrate("light"); setSheet("add"); }}>Добавить новичка из команды</button> : null}
          {st.led.length ? (<>
            {h("Ты " + (isFemaleName(profile && profile.name, profile && profile.surname) ? "вывела" : "вывел") + " на самостоятельную смену", st.led.length, "led")}
            <div style={card} data-nbl-led="">{st.led.map((x, i) => line("led" + i, "", nm(x.name) + (x.solo ? ", " + dayMon(x.solo) : "")))}</div>
          </>) : null}
        </>) : null}
      </div>
      {sheet === "memo" ? <MemoSheet a11y={a11y} memo={st.memo} onClose={() => setSheet(null)} onSaved={(m) => { setSt((x) => ({ ...x, memo: memoOf(m), list: x.list.map((n) => ({ ...n, memo: memoOf(m) })) })); setSheet(null); }} /> : null}
      {sh && sh.buddy ? (() => {
        const n = nbOf(sh.buddy);
        const rows = [...(st.team || [])].filter((p) => String(p.id) !== String(sh.buddy))
          .sort((a, b) => (a.pos === n.pos ? 0 : 1) - (b.pos === n.pos ? 0 : 1) || String(a.name).localeCompare(String(b.name), "ru"))
          .map((p) => ({ key: String(p.id), name: p.name, title: p.name, on: n && n.buddy && String(n.buddy.id) === String(p.id),
            sub: [upFirst(posWord(p.pos)), p.leads ? "ведёт: " + p.leads : ""].filter(Boolean).join(" · ") }));
        if (n && n.buddy) rows.push({ key: "", title: "Без наставника", sub: "Встретит тот, кто указан в памятке" });
        return <PickSheet a11y={a11y} title={"Наставник: " + (n ? firstName(n.name) : "")} mark="buddy" rows={rows} onClose={() => setSheet(null)}
          note="Покажет, где что, подтвердит «5 столов под присмотром» и первую самостоятельную смену. Накануне первой смены ему придёт напоминание."
          onPick={(r) => { setSheet(null); act(sh.buddy, "newbie_set", { p_emp: sh.buddy, p_buddy: r.key, p_hello: !!r.key && !(n && n.hello) },
            (res) => setNote((x) => ({ ...x, [sh.buddy]: r.key ? (res && res.msg ? "Наставник назначен, команда увидела «Знакомьтесь»" : "Наставник назначен") : "Наставник снят" }))); }} />;
      })() : null}
      {sh && sh.cand ? (() => {
        const n = nbOf(sh.cand);
        const rows = (st.cands || []).map((x) => ({ key: String(x.id), title: x.name, on: n && n.cand && Number(n.cand.id) === Number(x.id),
          sub: [dayMon(x.date), Array.isArray(x.focus) && x.focus.length ? focusLine(x.focus) : "сильные по всем темам"].filter(Boolean).join(" · ") }));
        rows.push({ key: "0", title: "Найти само", sub: "По имени и фамилии среди «Берём»" });
        rows.push({ key: "-1", title: "Без собеседования", sub: "План без тем с собеседования" });
        return <PickSheet a11y={a11y} title={"Собеседование: " + (n ? firstName(n.name) : "")} mark="cand" rows={rows} onClose={() => setSheet(null)}
          note="Темы, которые на собеседовании дались труднее всего, встанут первыми в «Первой неделе»."
          onPick={(r) => { setSheet(null); act(sh.cand, "newbie_set", { p_emp: sh.cand, p_cand: Number(r.key) }); }} />;
      })() : null}
      {sheet === "add" ? (() => {
        const rows = (st.team || []).filter((p) => String(p.id) !== String(profile && profile.id)).map((p) => ({ key: String(p.id), name: p.name, title: p.name, sub: upFirst(posWord(p.pos)) }));
        return <PickSheet a11y={a11y} title="Добавить новичка" mark="add" rows={rows} onClose={() => setSheet(null)}
          note="Новые сотрудники попадают сюда сами. Добавь того, кто пришёл раньше."
          onPick={(r) => { setSheet(null); act(r.key, "newbie_add", { p_emp: r.key, p_on: true }, () => load()); }} />;
      })() : null}
    </div>);
}

// для проверок: шаги плана, которые подтверждает наставник
export const NB_CONFIRM_STEPS = NB_BUDDY_STEPS;
export { NB_PLAN };
