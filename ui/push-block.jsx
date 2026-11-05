// ui/push-block.jsx — v137 (Доп. 450): уведомления на телефон в окне «Напоминания» (ui/day-cards.jsx, RemindSheet).
//   PushBlock   — «На телефон»: включить на этом телефоне, проверить, выключить; где нельзя — почему и что сделать
//                 (iPhone: с экрана «Домой», три шага; Telegram: бот и так пишет). Состояние сервера — наверх (onState).
//   ChannelPick — «Куда присылать»: Telegram и телефон, только телефон, только Telegram (этап 48, push_channel).
// Логика — lib/push.js. Разрешение на iPhone спрашивается только в ответ на касание: сервис-воркер и ключ готовятся,
// пока окно открывается, а нажатие сразу зовёт subscribe().
import React from "react";
import { labelStyle } from "./tokens";
import { vibrate } from "../lib/utils";
import { serverMissing } from "../lib/server-text";
import { pushEnv, pushCan, pushEnvNote, pushReg, currentSub, pushStatus, fetchPushKey, pushSubscribe, pushUnsubscribe,
  pushTest, pushChannel, pushError, savePushFlag, CHANNELS } from "../lib/push";

const ShareIc = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11v8.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V11" /></svg>);
const AddIc = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" /></svg>);
const BellIc = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>);

// iPhone в Safari: как добавить на экран «Домой»
function IosSteps({ c }) {
  const step = (n, ic, t) => (
    <li key={n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: n > 1 ? `1px dashed ${c.line}` : 0 }}>
      <span aria-hidden="true" style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: "50%", display: "inline-grid", placeItems: "center", border: `1px solid ${c.line}`, fontFamily: "Georgia, serif", fontSize: 12, color: c.gold }}>{n}</span>
      <span style={{ flex: "0 0 auto", color: c.gold, display: "inline-flex" }}>{ic}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.4, color: c.text }}>{t}</span>
    </li>);
  return (
    <ol data-push-ios="" style={{ listStyle: "none", margin: "8px 0 0", padding: "2px 12px", borderRadius: 14, border: `1px solid ${c.line}`, background: c.bg }}>
      {step(1, <ShareIc />, "Внизу Safari нажми «Поделиться»")}
      {step(2, <AddIc />, "Выбери «На экран «Домой»» и «Добавить»")}
      {step(3, <BellIc />, "Открой академию с экрана «Домой» и включи уведомления здесь")}
    </ol>);
}

export function PushBlock({ a11y, c, uk = "", admin = false, focus = false, first = false, onState }) {
  const env0 = React.useMemo(() => pushEnv(), []);
  const [env, setEnv] = React.useState(env0);
  const [ps, setPs] = React.useState(pushCan(env0) ? { phase: "load" } : { phase: "env" });
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const prep = React.useRef({ reg: null, sub: null, key: "", keyErr: "" });
  const box = React.useRef(null);
  const tell = (r) => { if (onState) onState(r); };
  React.useEffect(() => {
    if (focus && box.current && typeof box.current.scrollIntoView === "function") {
      const t = setTimeout(() => { try { box.current.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (e) { /* */ } }, 120);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [focus]);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const can = pushCan(env0);
      if (can) {
        prep.current.reg = await pushReg();
        prep.current.sub = await currentSub(prep.current.reg);
      }
      const r = await pushStatus({ endpoint: prep.current.sub ? prep.current.sub.endpoint : null, admin });
      if (!alive) return;
      if (r && r.error === "missing") { if (can) setPs({ phase: "missing" }); tell(null); return; }
      if (!r || !r.ok) { if (can) setPs({ phase: "error", error: r && r.error }); tell(null); return; }
      tell(r);
      if (!can) return;
      setPs({ phase: "ready", ...r });
      if (prep.current.sub) savePushFlag(uk, !!r.here);
      if (r.key) prep.current.key = r.key;
      else {
        const k = await fetchPushKey();
        if (!alive) return;
        if (k.ok) prep.current.key = k.key; else prep.current.keyErr = k.error;
      }
    })().catch(() => { if (alive && pushCan(env0)) setPs({ phase: "error", error: "net" }); });
    return () => { alive = false; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const enable = () => {
    if (busy) return;
    const p = prep.current;
    if (!p.key) { setMsg(pushError(p.keyErr || "no_key", admin)); vibrate("error"); return; }
    setBusy("on"); setMsg("");
    pushSubscribe({ reg: p.reg, key: p.key, uk, old: p.sub }).then((r) => {
      setBusy("");
      if (r && r.ok) {
        currentSub(p.reg).then((s) => { p.sub = s; });
        setPs({ phase: "ready", ...r }); tell(r); setEnv(pushEnv());
        setMsg("Готово. Нажми «Проверить»: придёт пробное уведомление."); vibrate("success"); return;
      }
      if (r && r.error === "denied") setEnv("denied");
      setMsg(pushError(r && r.error, admin)); vibrate("error");
    }).catch(() => { setBusy(""); setMsg(pushError("net")); });
  };
  const disable = () => {
    if (busy) return;
    setBusy("off"); setMsg("");
    pushUnsubscribe({ reg: prep.current.reg, uk }).then((r) => {
      setBusy(""); prep.current.sub = null;
      setPs((x) => ({ ...x, ...(r && r.ok && r.n !== undefined ? r : {}), phase: "ready", here: false }));
      if (r && r.ok && r.n !== undefined) tell(r);
      setMsg("Выключено на этом телефоне.");
    }).catch(() => { setBusy(""); setMsg(pushError("net")); });
  };
  const test = () => {
    if (busy) return;
    setBusy("test"); setMsg("");
    pushTest().then((r) => {
      setBusy("");
      if (r && r.ok) { setMsg("Отправил. Уведомление придёт через несколько секунд."); vibrate("light"); } else setMsg(pushError(r && r.error, admin));
    }).catch(() => { setBusy(""); setMsg(pushError("net")); });
  };
  const note = (t) => <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, color: c.sub }}>{t}</p>;
  const mainBtn = { display: "block", width: "100%", marginTop: 12, padding: 13, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", color: "#1A1008", background: "linear-gradient(180deg,#E4C88C,#C8A96E)" };
  const ghost = { flex: 1, padding: 11, borderRadius: 999, cursor: "pointer", background: "transparent", border: `1px solid ${c.line}`, color: c.text, fontSize: 13.5, fontWeight: "bold" };
  const here = ps.phase === "ready" && !!ps.here;
  const others = ps.phase === "ready" ? Math.max(0, (Number(ps.n) || 0) - (here ? 1 : 0)) : 0;
  const state = !pushCan(env) ? env : ps.phase === "ready" ? (here ? "on" : "off") : ps.phase;
  return (
    <div ref={box} data-push-block={state} style={{ marginTop: first ? 12 : 18, scrollMarginTop: 12 }}>
      <div style={{ ...labelStyle(13.5), color: c.gold, margin: "0 0 2px" }}>На телефон</div>
      {!pushCan(env) ? <>
        {note(pushEnvNote(env))}
        {env === "ios-browser" ? <IosSteps c={c} /> : null}
      </> : null}
      {pushCan(env) && ps.phase === "load" ? note("Проверяю…") : null}
      {pushCan(env) && ps.phase === "missing" ? note(serverMissing({ what: "уведомления на телефон", many: true, admin, sql: "supabase-stage48-push.sql" })) : null}
      {pushCan(env) && ps.phase === "error" ? note(pushError(ps.error, admin)) : null}
      {pushCan(env) && ps.phase === "ready" ? (here ? <>
        <div data-push-on="" style={{ marginTop: 8, padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(93,187,138,0.5)", color: a11y ? "#2C6B48" : "#8AD8AF", fontSize: 14, fontFamily: "Georgia, serif" }}>✓ Включено на этом телефоне</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" className="sa-btn" data-push-test="" onClick={test} disabled={!!busy} style={ghost}>{busy === "test" ? "Минуту…" : "Проверить"}</button>
          <button type="button" className="sa-btn" data-push-off="" onClick={disable} disabled={!!busy} style={ghost}>{busy === "off" ? "Минуту…" : "Выключить здесь"}</button>
        </div>
      </> : <>
        {note("Чат, смены, вопрос дня и разминка придут уведомлением, как у приложения. Касание откроет нужный экран.")}
        <button type="button" className="sa-btn" data-push-enable="" onClick={enable} disabled={!!busy} style={mainBtn}>{busy === "on" ? "Минуту…" : "Включить уведомления"}</button>
      </>) : null}
      {others ? note("Ещё включено на " + (others === 1 ? "одном телефоне" : others + " телефонах") + ".") : null}
      {msg ? <p role="status" data-push-msg="" style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.45, color: c.text }}>{msg}</p> : null}
    </div>);
}

export function ChannelPick({ a11y, c, ps, onState }) {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const ch = (ps && ps.channel) || "both";
  const pick = (v) => {
    if (busy || v === ch) return;
    setBusy(true); setMsg("");
    pushChannel(v).then((r) => {
      setBusy(false);
      if (r && r.ok) { if (onState) onState(r); vibrate("light"); } else setMsg(r && r.error === "no_subs" ? "Сначала включи уведомления на телефоне." : "Не сохранилось. Попробуй ещё раз.");
    }).catch(() => { setBusy(false); setMsg("Нет связи. Попробуй ещё раз."); });
  };
  return (
    <div data-push-channel={ch} style={{ marginTop: 14 }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 14.5, fontWeight: "bold", color: c.text }}>Куда присылать</div>
      <div role="group" aria-label="Куда присылать" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {CHANNELS.map(([v, l]) => { const on = ch === v;
          return <button key={v} type="button" aria-pressed={on} data-push-ch={v} onClick={() => pick(v)} disabled={busy}
            style={{ padding: "6px 11px", borderRadius: 999, border: `1px solid ${on ? c.gold : c.line}`, background: on ? (a11y ? "rgba(139,106,48,0.18)" : "rgba(200,169,110,0.22)") : "transparent",
              color: on ? c.text : c.sub, fontFamily: "Georgia, serif", fontSize: 12.5, cursor: "pointer" }}>{l}</button>; })}
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.4, color: c.sub, marginTop: 6 }}>
        {ch === "push" ? "Telegram молчит, пока уведомления на телефоне включены." : ch === "tg" ? "На телефон не приходит, пока выбран только Telegram." : "Приходит и туда, и туда."}
      </div>
      {msg ? <p role="status" style={{ margin: "6px 0 0", fontSize: 13, color: c.text }}>{msg}</p> : null}
    </div>);
}
