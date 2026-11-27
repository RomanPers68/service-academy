// ui/menu-team-know.jsx — v193 (Доп. 518): «Как команда знает меню» — руководителю (идея 7 из «Давай по классике. Все»).
// Телефоны присылают свой «Знаю?» по блюдам (этап 59, menu_know_set), здесь — сводка menu_know_team:
//   • слабые блюда: где больше «не уверен» и меньше «знаю»; у каждого — «В разминку команде» (неделю блюдо приходит в
//     разминку каждому, пока он не отметит «Знаю») и «В фокус смены» (в брифинг сегодня и завтра: состав и аллергены);
//   • что сейчас просите, со сроком, — снять одним касанием;
//   • кто как знает меню: знает, не уверен, когда присылал.
// Просить можно только в своём заведении; другое заведение (сеть) — только смотреть.
import React from "react";
import { rpc, saToken, rpcMissing } from "../lib/supabase";
import { onActivate, vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { SkelCards } from "./skeleton";
import { serverMissing } from "../lib/server-text";
import { teamWeak, weakLine, plural } from "../lib/menu-repeat";

const fmtDay = (iso) => { try { const [y, m, d] = String(iso).split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }); } catch (e) { return iso; } };
const fmtAt = (ts) => { try { return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }); } catch (e) { return ""; } };

export function TeamMenuKnow({ T, a11y, gold, green, Head, restaurant, dishes = [], own = true, admin = false }) {
  const [res, setRes] = React.useState(null);     // ответ menu_know_team
  const [err, setErr] = React.useState("");       // missing | forbidden | net
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [focus, setFocus] = React.useState([]);
  React.useEffect(() => {
    let alive = true;
    setRes(null); setErr("");
    rpc("menu_know_team", { p_token: saToken(), p_restaurant: restaurant }).then((r) => {
      if (!alive) return;
      if (rpcMissing(r)) { setErr("missing"); return; }
      if (r && r.ok) { setRes(r); setFocus(Array.isArray(r.focus) ? r.focus : []); return; }
      setErr(r && r.error === "forbidden" ? "forbidden" : "net");
    }).catch(() => { if (alive) setErr("net"); });
    return () => { alive = false; };
  }, [restaurant]);
  const text = T.modTitle && T.modTitle.color, sub = T.modSub && T.modSub.color;
  const line = a11y ? "rgba(139,106,48,0.28)" : "rgba(214,178,102,0.22)";
  const on = (kind, id) => focus.some((f) => f.kind === kind && String(f.id) === String(id));
  const ask = (kind, r) => {
    if (busy || !own) return;
    const want = !on(kind, r.id);
    setBusy(kind + ":" + r.id); setMsg("");
    rpc("menu_focus_set", { p_token: saToken(), p_kind: kind, p_id: r.id, p_name: r.name, p_on: want, p_note: r.note || "" }).then((x) => {
      setBusy("");
      if (x && x.ok) { setFocus(Array.isArray(x.focus) ? x.focus : []); vibrate(want ? "success" : "light");
        setMsg(want ? (kind === "warm" ? "«" + r.name + "» придёт в разминку каждому, пока не отметит «Знаю». Неделю." : "«" + r.name + "» в фокусе смены: появится в брифинге сегодня и завтра.") : "Просьбу сняли."); }
      else setMsg(x && x.error === "too_many" ? "Сразу можно просить не больше пяти блюд. Сними одно и попробуй снова." : "Не получилось. Проверь связь и попробуй ещё раз.");
    }).catch(() => { setBusy(""); setMsg("Нет связи. Попробуй ещё раз."); });
  };
  const chip = (act, dim) => ({ padding: "6px 11px", borderRadius: 999, fontFamily: "Georgia, serif", fontSize: 12.5, cursor: own ? "pointer" : "default", whiteSpace: "nowrap",
    border: `1px solid ${act ? gold : line}`, background: act ? (a11y ? "rgba(139,106,48,0.18)" : "rgba(200,169,110,0.2)") : "transparent", color: act ? text : sub, opacity: dim ? 0.55 : 1 });
  const weak = res ? teamWeak(res, dishes) : [];
  const people = res && Array.isArray(res.people) ? res.people : [];
  const sent = people.filter((p) => p && p.marked > 0).length;
  return (
    <div style={T.screen} className="sa-screen">
      {Head("Как команда знает меню")}
      <div style={{ padding: "8px 16px 100px" }}>
        {err === "missing" ? <p data-know-missing="" style={{ fontSize: 14, lineHeight: 1.6, color: sub, marginTop: 24 }}>{serverMissing({ what: "сводка по меню", admin, sql: "supabase-stage59-menu-repeat.sql" })}</p> : null}
        {err === "forbidden" ? <p style={{ fontSize: 14, lineHeight: 1.6, color: sub, marginTop: 24 }}>Сводка доступна только по своему заведению. Другие заведения видят руководители сети и владелец.</p> : null}
        {err === "net" ? <p style={{ fontSize: 14, lineHeight: 1.6, color: sub, marginTop: 24 }}>Не получилось загрузить сводку. Проверь связь и открой экран ещё раз.</p> : null}
        {!err && !res ? <SkelCards a11y={!!a11y} rows={4} h={58} style={{ padding: "8px 0 24px" }} /> : null}
        {res ? (
          <>
            <p data-know-sum={sent} style={{ fontSize: 13.5, lineHeight: 1.55, color: sub, margin: "4px 2px 12px" }}>
              {sent ? <>«Знаю?» по меню прислали <b style={{ color: gold }}>{sent}</b> из {people.length}. Остальные ещё не повторяли меню в приложении: блюда придут им в разминку до смены.</>
                : <>Пока никто не повторял меню в приложении. Блюда придут команде в разминку до смены, сводка появится после первых отметок.</>}
            </p>
            {focus.length ? (
              <div data-know-focus={focus.length} style={{ marginBottom: 14 }}>
                <div style={{ ...labelStyle(13.5), color: gold, margin: "0 2px 6px" }}>Сейчас просите</div>
                {focus.map((f) => (
                  <div key={f.kind + f.id} data-know-asked={f.kind + ":" + f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: `1px dashed ${line}` }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: text }}>{f.name}<span style={{ display: "block", fontSize: 12, color: sub }}>{f.kind === "warm" ? "в разминке команды" : "в фокусе смены"} до {fmtDay(f.until)}{f.by ? " · " + f.by : ""}</span></span>
                    {own ? <button type="button" data-lens-btn="soft" data-know-off={f.kind + ":" + f.id} disabled={!!busy} onClick={() => ask(f.kind, { id: f.id, name: f.name })} style={chip(false)}>Снять</button> : null}
                  </div>))}
              </div>) : null}
            <div style={{ ...labelStyle(13.5), color: gold, margin: "0 2px 6px" }}>Слабые блюда</div>
            {weak.length ? weak.map((r) => { const note = weakLine(r); return (
              <div key={r.id} className="sa-card" data-lens-card="" data-know-dish={r.id} style={{ ...T.modCard, margin: "0 0 9px", flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <div>
                  <div style={{ ...T.modTitle, whiteSpace: "normal" }}>{r.name}{r.stop ? <span style={{ fontSize: 12, color: sub }}> · сегодня в стопе</span> : null}</div>
                  <div style={{ ...T.modSub, whiteSpace: "normal" }}>{r.n ? note : "ещё никто не отмечал"}{r.cat ? " · " + r.cat : ""}</div>
                </div>
                {own ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button type="button" data-lens-btn="soft" aria-pressed={on("warm", r.id)} data-know-warm={r.id} disabled={!!busy} onClick={() => ask("warm", { ...r, note })} style={chip(on("warm", r.id), busy === "warm:" + r.id)}>{on("warm", r.id) ? "В разминке команды ✓" : "В разминку команде"}</button>
                  <button type="button" data-lens-btn="soft" aria-pressed={on("brief", r.id)} data-know-brief={r.id} disabled={!!busy} onClick={() => ask("brief", { ...r, note })} style={chip(on("brief", r.id), busy === "brief:" + r.id)}>{on("brief", r.id) ? "В фокусе смены ✓" : "В фокус смены"}</button>
                </div> : null}
              </div>); }) : <p style={{ fontSize: 13.5, color: sub, margin: "0 2px 12px" }}>Слабых блюд нет: все, кто прислал, знают меню. Так держать.</p>}
            {msg ? <p role="status" data-know-msg="" style={{ fontSize: 13, lineHeight: 1.5, color: text, margin: "4px 2px 12px" }}>{msg}</p> : null}
            <div style={{ ...labelStyle(13.5), color: gold, margin: "16px 2px 6px" }}>Кто как знает меню</div>
            {people.map((p) => (
              <div key={p.id} data-know-person={p.id} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "8px 2px", borderBottom: `1px dashed ${line}` }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: text }}>{p.name || "Сотрудник"}</span>
                <span style={{ fontSize: 12.5, color: sub, whiteSpace: "nowrap", opacity: p.at && p.marked ? 1 : 0.7 }}>{p.at && p.marked
                  ? "знает " + (p.known || 0) + " " + plural(p.known || 0, "блюдо", "блюда", "блюд") + (p.weak ? " · не уверен: " + p.weak : "") + " · " + fmtAt(p.at)
                  : "ещё не повторял"}</span>
              </div>))}
            <p style={{ fontSize: 12, lineHeight: 1.5, color: sub, margin: "12px 2px 0" }}>«Знает»: отметил «Знаю», и срок повтора ещё не подошёл. «Не уверен»: нажал «Не уверен» или ошибся в вопросе дня за последние 30 дней.</p>
          </>) : null}
      </div>
    </div>
  );
}
