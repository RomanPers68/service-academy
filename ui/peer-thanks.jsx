// ui/peer-thanks.jsx — v108 (Доп. 421): «Я» → «Спасибо от коллег» (рядом со «Спасибо от гостей»). Сколько «спасибо» от
// коллег за неделю, месяц и всего; карточки — кто, за что, кто присоединился; карточка ещё в чате — открывается там.
// «Сказать спасибо коллеге» — «Вся команда» с листом «Спасибо коллеге». Сервер — этап 42 (thanks_peer); без него экран
// говорит, что этапа нет.
import React from "react";
import { LineArt } from "./line-art";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { serverMissing } from "../lib/server-text";
import { nm, upFirst } from "../lib/morning";

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
/** «сегодня», «вчера», «27 октября» — по часам телефона */
export function whenOf(iso, now = new Date()) {
  const d = new Date(iso || 0);
  if (isNaN(d)) return "";
  const y = new Date(now); y.setDate(y.getDate() - 1);
  return ymd(d) === ymd(now) ? "сегодня" : ymd(d) === ymd(y) ? "вчера" : d.getDate() + " " + MONTHS[d.getMonth()];
}
const ini = (name) => String(name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
// v110 (Доп. 423): кружок с инициалами того, кто сказал спасибо (как в «Новичках» и листе «Спасибо коллеге»)
const Ava = ({ name, size = 34 }) => (
  <span aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "inline-grid", placeItems: "center",
    background: "linear-gradient(135deg,#C8A96E,#7A5D2A)", color: "#fff", fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 12.5 }}>{ini(name)}</span>);
const C = (a11y) => ({
  gold: a11y ? "#7A5D2A" : "#D2A85A",
  text: a11y ? "#2A1F0E" : "#EFE4C8",
  sub: a11y ? "#6B5B40" : "#A99A7C",
  frost: {
    background: a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.09)",
    border: a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)",
    boxShadow: a11y ? "inset 0 0 26px rgba(255,255,255,0.55), 0 6px 18px rgba(120,85,25,0.14)" : "inset 0 0 26px rgba(255,248,230,0.07), 0 8px 24px rgba(0,0,0,0.45)",
    borderRadius: 18,
  },
});

/** onOpenChat(chat, msg) — карточка в чате; onSay() — «Вся команда» с листом «Спасибо коллеге» */
export function PeerThanksScreen({ T, a11y, profile, onBack, onOpenChat = null, onSay = null, onLoaded = null }) {
  const c = C(a11y);
  const [st, setSt] = React.useState({ status: "loading" });
  const load = React.useCallback(() => {
    rpc("thanks_peer", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) setSt({ status: "missing" });
      else if (r && r.ok) { setSt({ status: "ok", ...r }); if (onLoaded) onLoaded(r); }
      else setSt({ status: "error" });
    }).catch(() => setSt((s) => (s.status === "ok" ? s : { status: "error" })));
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { load(); }, [load]);
  const items = Array.isArray(st.items) ? st.items : [];
  const say = onSay ? (
    <button type="button" data-peer-say="" onClick={() => { vibrate("light"); onSay(); }}
      style={{ display: "block", width: "100%", marginTop: 4, padding: "12px 14px", borderRadius: 16, border: `1px solid ${c.gold}`, background: "transparent", color: c.text,
        fontFamily: "Georgia, serif", fontSize: 14.5, cursor: "pointer" }}>Сказать спасибо коллеге</button>) : null;
  return (
    <div style={T.screen} className="sa-screen" data-peer={st.status}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Спасибо от коллег</div>
      </div>
      <div style={{ padding: "4px 16px 110px" }}>
        {st.status === "loading" ? <div style={{ fontSize: 13, color: c.sub, padding: "6px 2px" }}>Загружаю…</div> : null}
        {st.status === "missing" ? <div style={{ ...c.frost, padding: "12px 14px", fontSize: 13.5, color: c.text, lineHeight: 1.5 }} data-peer-missing="">
          {serverMissing({ what: "«Спасибо от коллег»", many: true, admin: !!(profile && profile.is_admin), sql: "supabase-stage42-thanks.sql" })}</div> : null}
        {st.status === "error" ? <div style={{ ...c.frost, padding: "12px 14px", fontSize: 13.5, color: c.text, lineHeight: 1.5 }}>Не загрузилось. Проверь связь.
          <button type="button" onClick={() => { setSt({ status: "loading" }); load(); }}
            style={{ display: "block", marginTop: 10, padding: "9px 14px", borderRadius: 16, border: `1px solid ${c.gold}`, background: "transparent", color: c.text, fontFamily: "Georgia, serif", cursor: "pointer" }}>Ещё раз</button></div> : null}
        {st.status === "ok" ? (<>
          {/* v110 (Доп. 423): крупно — за неделю и сколько это очков в «Сотруднике недели», месяц и всего мельче; пока «спасибо» нет —
              без «0 0 0» (пустой экран ниже сам всё объясняет) */}
          {Number(st.total) > 0 ? (
            <div style={{ ...c.frost, padding: "14px 16px", margin: "6px 0 12px" }} data-peer-stats="">
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 34, color: c.text, lineHeight: 1 }} data-peer-week={st.week || 0}>{st.week || 0}</div>
                <div style={{ fontSize: 13.5, color: c.text }}>спасибо за неделю</div>
              </div>
              <div style={{ fontSize: 13, color: c.gold, marginTop: 6 }} data-peer-pts="">{Number(st.week) > 0 ? "+" + Number(st.week) * 5 + " очков в «Сотруднике недели»" : "Каждое «спасибо» даёт 5 очков в «Сотруднике недели»"}</div>
              <div style={{ fontSize: 12.5, color: c.sub, marginTop: 10, paddingTop: 9, borderTop: "1px solid " + (a11y ? "rgba(139,106,48,0.18)" : "rgba(255,240,210,0.09)") }} data-peer-more="">
                {"За месяц " + (st.month || 0) + " · всего " + (st.total || 0)}</div>
            </div>) : null}
          {Number(st.total) > 0 ? say : null}
          <div style={{ height: 14 }} />
          {items.length ? items.map((x) => {
            const plus = Array.isArray(x.plus) ? x.plus : [];
            const can = !!(onOpenChat && x.chat);
            return (
              <div key={x.msg} data-peer-item={x.msg} role={can ? "button" : undefined} tabIndex={can ? 0 : undefined}
                onClick={can ? () => { vibrate("light"); onOpenChat(x.chat, x.msg); } : undefined}
                onKeyDown={can ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenChat(x.chat, x.msg); } } : undefined}
                style={{ ...c.frost, padding: "11px 14px", marginBottom: 8, cursor: can ? "pointer" : "default", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Ava name={x.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...labelStyle(12.5), color: c.gold }}>{[whenOf(x.at), nm(x.name)].filter(Boolean).join(" · ")}</div>
                  {x.text ? <div style={{ fontFamily: "Georgia, serif", fontSize: 14.5, color: c.text, marginTop: 4, lineHeight: 1.45 }}>«{upFirst(x.text)}»</div>
                    : <div style={{ fontSize: 13, color: c.sub, marginTop: 3 }}>Спасибо без слов</div>}
                  {plus.length ? <div style={{ fontSize: 12.5, color: c.sub, marginTop: 4 }} data-peer-plus={plus.length}>{"Ещё спасибо: " + plus.map((n) => nm(n)).join(", ")}</div> : null}
                </div>
              </div>);
          }) : (
            <div data-peer-empty="" style={{ textAlign: "center", padding: "6px 2px 8px" }}>
              <LineArt kind="heart" color={c.gold} size={130} style={{ margin: "6px auto 8px" }} />
              <div style={{ fontSize: 13.5, color: c.sub, lineHeight: 1.5 }}>Пока спасибо от коллег нет. Первое появится здесь, когда кто-то из команды скажет его карточкой в чате.</div>
              <div style={{ fontSize: 12.5, color: c.sub, lineHeight: 1.5, marginTop: 6 }}>Каждое «спасибо» даёт 5 очков в «Сотруднике недели».</div>
              {say ? <div style={{ marginTop: 14 }}>{say}</div> : null}
            </div>)}
        </>) : null}
      </div>
    </div>);
}
