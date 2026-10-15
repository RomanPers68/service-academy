// ui/mastery.jsx — v40: экран «Путь мастера» (лениво, из App).
//
// Сверху — главная награда «Мастер роли ✦»: печать с кольцом «7 из 13», четыре условия с прогрессом,
// приз заведения (руководитель назначает его здесь же). Ниже — «Шаг дня», «Первые шаги в академии»
// для новичков, коллекция из 14 значков (тап — шторка «как получить» и «Показать ›»), мастера
// заведения. У мастера — «Сертификат мастера»: картинкой (lib/master-image.js) или текстом.
// Всё считает lib/mastery.js; экран только показывает и ведёт в инструмент (onGo).
import React from "react";
import { createPortal } from "react-dom";
import { FAMILIES, TIERS, TIERS_OF, ROLE_TITLE, MASTER_NEED, familyCount, isNewTool, plural } from "../lib/mastery";
import { Medal, FamIcon, tierColor, tierText, msPal, msSmall, msEye, msPrimary, msTie, ensureMsCardCss } from "./mastery-card";
import { vibrate } from "../lib/utils";
import { useHintOnce, HintBubble } from "./widgets";
import { hintsFor } from "../data/hints";
import { masterImage, masterShareText, masterDate, MASTER_PARTS } from "../lib/master-image";

const SERIF = "'Piazzolla',Georgia,'Times New Roman',serif";
const BODY = "Georgia,'Times New Roman',serif";
const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

const CSS = `
.ms-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
@media (max-width:359px){.ms-grid.ms-grid-l{grid-template-columns:repeat(2,minmax(0,1fr))}}
.ms-hero-t{font-size:clamp(18px,5.6vw,21px)}
html.sa-light .ms-hero-t{font-size:clamp(19px,5.9vw,22px)}
.ms-tile{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:5px;min-width:0;margin:0;padding:12px 4px 10px;border-radius:16px;cursor:pointer;text-align:center;font:inherit;-webkit-tap-highlight-color:transparent;box-sizing:border-box}
.ms-tile-t{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;max-width:100%}
.ms-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;margin:0;font:inherit;-webkit-tap-highlight-color:transparent;box-sizing:border-box}
.ms-sheet-wrap{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;animation:msFade .2s ease both}
.ms-sheet{position:relative;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;box-sizing:border-box;margin:0 auto;padding:10px 18px calc(18px + env(safe-area-inset-bottom,0px));border-radius:22px 22px 0 0;animation:msUp .32s cubic-bezier(.2,.8,.2,1) both}
@keyframes msUp{from{transform:translateY(48px);opacity:.3}to{transform:none;opacity:1}}
.ms-cert-wrap{position:fixed;inset:0;z-index:1000;overflow-y:auto;-webkit-overflow-scrolling:touch;animation:msFade .25s ease both}
.ms-cert-col{max-width:420px;margin:0 auto;padding:max(16px,env(safe-area-inset-top,0px)) 16px calc(20px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
.ms-pv{position:fixed;inset:0;z-index:1002;background:#0D0905;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:max(18px,env(safe-area-inset-top,0px)) 18px calc(18px + env(safe-area-inset-bottom,0px));box-sizing:border-box;overflow-y:auto}
.ms-pv img{max-width:100%;max-height:62vh;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.55);-webkit-touch-callout:default;user-select:auto;-webkit-user-select:auto}
.ms-pv p{margin:0;text-align:center;font:13.5px/1.45 Georgia,serif;color:rgba(243,233,210,.84);max-width:360px}
.ms-cert-h{font-size:clamp(15.5px,5vw,19px);letter-spacing:1.4px}
.ms-cert-badges{display:flex;justify-content:center;gap:6px;margin:16px 0 4px}
.ms-cert-badges>span{flex:0 1 40px;min-width:0}
.ms-cert-badges svg{width:100%!important;height:auto!important}
.ms-ta{display:block;width:100%;box-sizing:border-box;resize:vertical;min-height:64px;padding:10px 12px;border-radius:12px;font:16px/1.4 Georgia,serif;outline:none}
.ms-ta:focus{border-color:rgba(200,169,110,.8)!important;box-shadow:0 0 0 2px rgba(200,169,110,.2)}
@media (prefers-reduced-motion: reduce){.ms-sheet-wrap,.ms-sheet,.ms-cert-wrap{animation:none}}
`;
function ensureCss() {
  ensureMsCardCss();
  if (typeof document === "undefined" || !document.head || !document.createElement) return;
  if (document.getElementById && document.getElementById("sa-ms-css")) return;
  const st = document.createElement("style");
  st.id = "sa-ms-css"; st.textContent = CSS;
  document.head.appendChild(st);
}

const Layer = ({ inline, children }) => (inline || typeof document === "undefined" || !document.body ? children : createPortal(children, document.body));
const Check = ({ size = 14, color }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
const XIcon = ({ color }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
const Gift = ({ color }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="9" width="17" height="4" rx="1" /><path d="M5 13v7.5h14V13M12 9v11.5" /><path d="M12 9c-1.6-3.3-5.6-3.6-5.6-1.2C6.4 9 9 9 12 9zM12 9c1.6-3.3 5.6-3.6 5.6-1.2C17.6 9 15 9 12 9z" /></svg>;
const ShareIc = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4" /></svg>;

const card = (a11y, rich) => ({
  borderRadius: 18, padding: "14px 14px", marginBottom: 12, boxSizing: "border-box",
  background: rich ? (a11y ? "linear-gradient(180deg,rgba(236,214,166,0.55),rgba(250,242,222,0.75))" : "linear-gradient(180deg,rgba(214,178,102,0.17),rgba(214,178,102,0.05))")
    : a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.07)",
  border: "1px solid " + (rich ? (a11y ? "rgba(150,112,40,0.42)" : "rgba(214,178,102,0.4)") : a11y ? "rgba(139,106,48,0.30)" : "rgba(255,255,255,0.12)"),
  borderTop: "1px solid " + (rich ? (a11y ? "rgba(175,135,50,0.58)" : "rgba(226,190,120,0.46)") : a11y ? "rgba(139,106,48,0.30)" : "rgba(255,255,255,0.16)"),
  boxShadow: a11y ? "inset 0 0 22px rgba(255,255,255,0.55), inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 14px rgba(120,85,25,0.12)"
    : "inset 0 0 22px rgba(255,248,230,0.06), inset 0 1px 0 rgba(255,255,255,0.11), 0 6px 20px rgba(0,0,0,0.38)",
});
const ghostBtn = (a11y, c) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, padding: "0 16px", borderRadius: 999, cursor: "pointer",
  background: "transparent", border: "1px solid " + (a11y ? "rgba(139,106,48,0.5)" : "rgba(214,178,102,0.5)"), color: c.text, fontFamily: BODY, fontWeight: "bold", fontSize: a11y ? 15 : 14 });
const linkBtn = (a11y, c) => ({ display: "inline-flex", alignItems: "center", minHeight: 44, padding: 0, border: 0, background: "none", cursor: "pointer", color: c.gold, fontFamily: BODY, fontWeight: "bold", fontSize: a11y ? 15 : 14 });

// «12 окт» из «2026-10-12» или ISO-времени. Время сервера (UTC) — через Date: на Камчатке «2026-10-14T21:30Z» —
// это уже 15 октября (раньше бралась дата из строки — день назад)
export function shortDay(at) {
  const s = String(at || "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return Number(m[3]) + " " + MON[Number(m[2]) - 1];
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.getDate() + " " + MON[d.getMonth()];
}
// «12 октября» (этот год) или «12 октября 2025»
function sinceDay(ymd, now = new Date()) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return Number(m[3]) + " " + MONTHS[Number(m[2]) - 1] + (Number(m[1]) !== now.getFullYear() ? " " + m[1] : "");
}
const todayYmd = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const famDef = (id) => FAMILIES.find((f) => f.id === id) || null;
// до шести лучших значков: золото первым, при равенстве — порядок семейств
export function topBadges(state, n = 6) {
  const list = ((state && state.families) || []).filter((f) => f && f.tier >= 1);
  return list.map((f, i) => ({ f, i })).sort((a, b) => b.f.tier - a.f.tier || a.i - b.i).slice(0, n).map((x) => x.f);
}
const PART_LABEL = { role: "Роль пройдена", gold: MASTER_NEED.gold + " золотых тем", streak: "Серия " + MASTER_NEED.streak + " дней", bronze: "Бронза в " + MASTER_NEED.bronze + " значках" };
function partValue(p, state) {
  if (p.id === "role") return p.need ? p.value + " из " + p.need + " " + plural(p.need, "раздела", "разделов", "разделов") : "разделов пока нет";
  if (p.id === "streak") { const s = ((state && state.families) || []).find((f) => f && f.id === "streak"); return "лучшая: " + Math.min(p.need || 14, Math.max(p.value || 0, (s && s.value) || 0)) + " из " + (p.need || 14); }
  return p.value + " из " + p.need;
}
const PRIZE_ERR = { offline: "Нет связи — попробуй ещё раз", missing: "Сервер ещё не обновлён — нужен этап 26 в Supabase", forbidden: "Назначать приз может только руководитель заведения" };

// кольцо «Мастера роли»: 13 долей — роль, золото, серия и десять бронз
function MasterRing({ have, need, a11y, c }) {
  const n = Math.max(1, need || 13), R = 44, C = 52, gap = 4;
  const pt = (deg) => { const r = (deg * Math.PI) / 180; return (C + R * Math.cos(r)).toFixed(2) + " " + (C + R * Math.sin(r)).toFixed(2); };
  const segs = Array.from({ length: n }, (_, i) => { const a = -90 + (i * 360) / n + gap / 2, b = a + 360 / n - gap; return "M" + pt(a) + "A" + R + " " + R + " 0 0 1 " + pt(b); });
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={"Мастер роли: " + have + " из " + n} style={{ display: "block", flexShrink: 0 }}>
      {segs.map((d, i) => <path key={i} d={d} fill="none" strokeWidth="7" strokeLinecap="butt" stroke={i < have ? tierColor(3, a11y) : c.faint} />)}
      <circle cx="52" cy="52" r="33" fill={a11y ? "rgba(255,252,244,0.6)" : "rgba(255,248,230,0.04)"} stroke={c.line} strokeWidth="1" />
      <text x="52" y="55" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="29" fill={c.text}>{have}</text>
      <text x="52" y="73" textAnchor="middle" fontFamily={BODY} fontSize={a11y ? 13 : 12} fill={c.sub}>{"из " + n}</text>
    </svg>
  );
}

export function MasteryScreen({ T, a11y, profile, role, state, step, earned, seen = {}, masters = null, focus = null, shareUrl = "", onGo, onPrize, onReloadMasters, onBack, inline = false }) {
  ensureCss();
  const TT = T || {};
  const c = msPal(a11y);
  const st = state && Array.isArray(state.families) ? state : null;
  const ern = earned && typeof earned === "object" ? earned : { tiers: {}, fw: false, master: {} };
  const ms = st ? st.master : null;
  const roleId = role || (ms && ms.role) || "";
  const roleTitle = ROLE_TITLE[roleId] || "";
  const roleQ = roleTitle ? " «" + roleTitle + "»" : "";
  const sinceYmd = ern.master && ern.master[roleId];
  const achieved = !!((ms && ms.ok) || sinceYmd);
  const isFam = (id) => FAMILIES.some((f) => f.id === id);
  const [sheet, setSheet] = React.useState(() => (focus && isFam(focus) ? focus : null));
  const [cert, setCert] = React.useState(() => focus === "certificate");
  React.useEffect(() => { if (focus === "certificate") setCert(true); else if (focus && isFam(focus)) setSheet(focus); }, [focus]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [hint, hintDone] = useHintOnce("mastery");
  const [hstep, setHstep] = React.useState(0);
  const hsteps = hintsFor("mastery");
  // приз: после сохранения показываем своё, не дожидаясь нового списка с сервера
  const [prizeOwn, setPrizeOwn] = React.useState(undefined);
  const serverPrize = (masters && masters.prize) || null;
  React.useEffect(() => { setPrizeOwn(undefined); }, [serverPrize]);   // пришёл новый список — верим серверу
  const prize = prizeOwn !== undefined ? prizeOwn : serverPrize;
  const [edit, setEdit] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [pmsg, setPmsg] = React.useState(null);
  const go = (key, payload) => { vibrate("light"); if (onGo) onGo(key, payload == null ? null : payload); };
  const openSheet = (id) => { vibrate("light"); setSheet(id); };
  const savePrize = (text) => {
    if (busy || !onPrize) return;
    const v = String(text || "").trim().slice(0, 200);
    setBusy(true); setPmsg(null);
    let p;
    try { p = Promise.resolve(onPrize(v)); } catch (e) { p = Promise.reject(e); }
    p.then((r) => {
      setBusy(false);
      if (r && r.ok) {
        setPrizeOwn(r.prize !== undefined ? (r.prize || null) : (v || null));
        setEdit(false); setPmsg({ ok: true, t: v ? "Сохранено ✓" : "Приз убран ✓" }); vibrate("success");
      } else { setPmsg({ ok: false, t: PRIZE_ERR[r && r.error] || "Не сохранилось — попробуй ещё раз" }); vibrate("error"); }
    }, () => { setBusy(false); setPmsg({ ok: false, t: PRIZE_ERR.offline }); });
  };
  const fams = st ? st.families : FAMILIES.map((f) => ({ id: f.id, title: f.title, how: f.how, go: f.go, value: 0, tiers: [1, 1, 1], tier: 0, next: 1, left: 1, pct: 0 }));
  const bronze = st ? st.bronze : 0, total = (st && st.total) || FAMILIES.length;
  const fw = st && st.firstWeek;
  const fwGot = !!(ern.fw || (fw && fw.total && fw.done >= fw.total && fw.inWindow !== false));
  const fwOpen = !!(fw && fw.inWindow && !fwGot && fw.done < fw.total);
  const sheetFam = sheet ? fams.find((f) => f && f.id === sheet) : null;
  const left = ms ? Math.max(0, ms.need - ms.have) : 0;
  const small = (px) => msSmall(a11y, px);
  const eye = msEye(a11y);

  // ── HERO «Мастер роли ✦» ──
  const hero = ms ? (
    <section data-ms-hero="" aria-label="Мастер роли" style={card(a11y, true)}>
      <div style={{ ...eye, color: c.gold, marginBottom: 8 }}>✦ Главная награда</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {achieved ? <Medal id="master" tier={3} size={96} a11y={a11y} ring={false} title={"Мастер роли" + roleQ + " ✦"} /> : <MasterRing have={ms.have} need={ms.need} a11y={a11y} c={c} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="ms-hero-t" style={{ margin: 0, fontFamily: SERIF, fontWeight: 700, lineHeight: 1.18, color: c.text, overflowWrap: "anywhere" }}>
            {(achieved ? "Ты — мастер роли" : "Мастер роли") + roleQ + "\u00A0✦"}
          </h2>
          {achieved && sinceYmd ? <div style={{ fontSize: small(13), color: c.sub, marginTop: 4 }}>{"с " + sinceDay(sinceYmd)}</div> : null}
        </div>
      </div>
      {!achieved ? <p style={{ margin: "12px 0 0", fontSize: small(13.5), lineHeight: 1.5, color: c.sub }}><b style={{ color: c.text }}>{"До звания — ещё " + left + "\u00A0из\u00A0" + ((ms && ms.need) || 13) + "."}</b>{" Коллеги-мастера носят знак\u00A0✦ у имени в рейтинге и лиге."}</p> : null}
      <div role="list" aria-label="Условия" style={{ marginTop: 10 }}>
        {ms.parts.map((p, i) => {
          const done = achieved || p.done;
          const val = partValue(p, st);
          const label = PART_LABEL[p.id] || p.label;
          return (
            <div key={p.id} role="listitem" data-ms-part={p.id} aria-label={label + " — " + (done ? "готово" : val)}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderTop: i ? "1px solid " + c.line : "none" }}>
              <span aria-hidden="true" style={{ width: 24, height: 24, marginTop: 0, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", boxSizing: "border-box",
                background: done ? (a11y ? "rgba(44,107,72,0.14)" : "rgba(93,187,138,0.16)") : "transparent", border: "1.5px solid " + (done ? c.okLine : c.line) }}>
                {done ? <Check size={13} color={c.ok} /> : null}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: BODY, fontSize: a11y ? 16 : 15, color: c.text }}>{label}</span>
                  {!(achieved && !p.done) ? <span style={{ marginLeft: "auto", fontSize: small(13), color: done ? c.ok : c.sub, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{val}</span> : null}
                </span>
                {!done && p.need ? (
                  <span aria-hidden="true" style={{ display: "block", height: 4, borderRadius: 2, marginTop: 6, background: c.faint, overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: Math.round(100 * Math.min(1, (p.value || 0) / p.need)) + "%", borderRadius: 2, background: tierColor(3, a11y) }} />
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
      {achieved ? (
        <button type="button" className="sa-btn" data-ms-certopen="" onClick={() => { vibrate("light"); setCert(true); }}
          style={{ ...msPrimary, width: "100%", minHeight: 52, marginTop: 12, fontSize: a11y ? 17 : 16 }}>Сертификат мастера</button>
      ) : null}
      {prize || (masters && masters.can_prize) ? (
        <div data-ms-prize="" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid " + c.line }}>
          {prize ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
              <span style={{ marginTop: 1, flexShrink: 0 }}><Gift color={c.gold} /></span>
              <span style={{ fontSize: small(14), lineHeight: 1.45, color: c.text, overflowWrap: "anywhere" }}><span style={{ color: c.sub }}>Приз заведения для мастеров: </span>{prize}</span>
            </div>
          ) : null}
          {masters && masters.can_prize && !edit ? (
            <button type="button" onClick={() => { setDraft(prize || ""); setPmsg(null); setEdit(true); }} style={linkBtn(a11y, c)}>{prize ? "Изменить приз" : "Назначить приз ›"}</button>
          ) : null}
          {edit ? (
            <div style={{ marginTop: 6 }}>
              <label htmlFor="ms-prize-ta" style={{ ...eye, display: "block", color: c.gold, marginBottom: 6 }}>Приз для мастеров заведения</label>
              <textarea id="ms-prize-ta" className="ms-ta sa-field" value={draft} maxLength={200} rows={2} onChange={(e) => setDraft(String(e.target.value || "").slice(0, 200))}
                style={{ border: "1px solid " + c.line, background: a11y ? "rgba(255,252,244,0.85)" : "rgba(0,0,0,0.22)", color: c.text }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginTop: 5 }}>
                <span style={{ fontSize: small(12.5), lineHeight: 1.4, color: c.sub }}>{msTie("Например: «Ужин на двоих» или «Выходной в любой день»")}</span>
                <span style={{ fontSize: small(12), color: c.sub, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{draft.length}/200</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
                <button type="button" className="sa-btn" disabled={busy || !draft.trim()} onClick={() => savePrize(draft)}
                  style={{ ...msPrimary, minHeight: 44, padding: "0 20px", fontSize: a11y ? 16 : 15, opacity: busy || !draft.trim() ? 0.55 : 1 }}>{busy ? "Минуту…" : "Сохранить"}</button>
                {prize ? <button type="button" className="sa-btn" disabled={busy} onClick={() => savePrize("")} style={ghostBtn(a11y, c)}>Убрать приз</button> : null}
                <button type="button" onClick={() => { setEdit(false); setPmsg(null); }} style={{ ...linkBtn(a11y, c), color: c.sub, padding: "0 6px" }}>Отмена</button>
              </div>
            </div>
          ) : null}
          {pmsg ? <p role="status" style={{ margin: "6px 0 0", fontSize: small(13.5), color: pmsg.ok ? c.ok : (a11y ? "#8F3520" : "#F0A08A") }}>{pmsg.t}</p> : null}
        </div>
      ) : null}
    </section>
  ) : null;

  // ── ШАГ ДНЯ ──
  const stepDone = !!(step && step.done);
  const stepCard = step ? (
    <section data-ms-step="" aria-label="Шаг дня" style={card(a11y, false)}>
      <div style={{ ...eye, color: c.gold }}>Шаг дня</div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 8 }}>
        <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", boxSizing: "border-box",
          border: "1.5px solid " + (stepDone ? c.okLine : c.line), color: stepDone ? c.ok : c.gold }}>
          {stepDone ? <Check size={20} color={c.ok} /> : <FamIcon id={step.kind === "first" ? "first" : step.fam || "track"} size={22} color={c.gold} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: BODY, fontSize: a11y ? 18 : 17, lineHeight: 1.3, color: c.text, overflowWrap: "anywhere" }}>{stepDone ? "Шаг дня сделан ✓" : msTie(step.text)}</div>
          <div style={{ fontSize: small(13.5), lineHeight: 1.45, color: c.sub, marginTop: 4 }}>{stepDone ? "Завтра будет новый" : msTie(step.sub)}</div>
        </div>
      </div>
      {!stepDone ? (
        <button type="button" className="sa-btn" onClick={() => go(step.go, step.payload)} style={{ ...msPrimary, width: "100%", minHeight: 48, marginTop: 12, fontSize: a11y ? 17 : 16 }}>Сделать ›</button>
      ) : null}
    </section>
  ) : null;

  // ── ПЕРВАЯ НЕДЕЛЯ В АКАДЕМИИ ──
  let firstBlock = null;
  if (fw && fwGot) {
    firstBlock = (
      <section data-ms-first="" data-ms-first-got="" style={{ ...card(a11y, false), display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
        <Medal id="first" tier={3} size={40} a11y={a11y} ring={false} />
        <span style={{ flex: 1, minWidth: 0, fontFamily: BODY, fontSize: a11y ? 16 : 15, lineHeight: 1.35, color: c.text }}>Значок «Первые шаги» получен ✦</span>
      </section>
    );
  } else if (fwOpen) {
    const dl = fw.daysLeft || 0;
    firstBlock = (
      <section data-ms-first="" aria-label="Первые шаги в академии" style={card(a11y, false)}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", border: "1.5px solid " + c.line }}><FamIcon id="first" size={24} color={c.gold} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: a11y ? 18 : 17, lineHeight: 1.25, color: c.text }}>Первые шаги в академии</div>
            <div style={{ fontSize: small(13), color: c.sub, marginTop: 2 }}>{fw.done + " из " + fw.total + (dl ? " · " + (plural(dl, "остался ", "осталось ", "осталось ") + dl + " " + plural(dl, "день", "дня", "дней")) : "")}</div>
          </div>
        </div>
        <div aria-hidden="true" style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {fw.items.map((it) => <span key={it.id} style={{ flex: 1, height: 5, borderRadius: 3, background: it.done ? tierColor(3, a11y) : c.faint }} />)}
        </div>
        <div role="list" style={{ marginTop: 6 }}>
          {fw.items.map((it, i) => {
            const open = () => go(it.go);
            const line = i ? "1px solid " + c.line : "none";
            if (it.done) {
              return (
                <div key={it.id} role="listitem" data-ms-mission={it.id} data-ms-done="" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: line }}>
                  <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", boxSizing: "border-box", background: a11y ? "rgba(44,107,72,0.14)" : "rgba(93,187,138,0.16)", border: "1.5px solid " + c.okLine }}><Check size={13} color={c.ok} /></span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: BODY, fontSize: a11y ? 16 : 15, color: c.sub }}>{msTie(it.title)}</span>
                  <span style={{ fontSize: small(12.5), color: c.ok, flexShrink: 0 }}>сделано</span>
                </div>
              );
            }
            return (
              <div key={it.id} role="listitem" style={{ borderTop: line }}>
                <button type="button" className="ms-row ms-zone" data-ms-mission={it.id} onClick={open} aria-label={it.title + ". " + it.how + " Открыть"}
                  style={{ padding: "10px 0", border: 0, background: "none", color: c.text, cursor: "pointer", alignItems: "flex-start" }}>
                  <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box", border: "1.5px dashed " + c.muted, marginTop: 1 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: BODY, fontSize: a11y ? 16.5 : 15.5, lineHeight: 1.3, color: c.text }}>{msTie(it.title)}</span>
                    <span style={{ display: "block", fontSize: small(13), lineHeight: 1.42, color: c.sub, marginTop: 2 }}>{msTie(it.how)}</span>
                    <span style={{ display: "block", marginTop: 5, fontFamily: BODY, fontWeight: "bold", fontSize: a11y ? 15 : 14, color: c.gold }}>Открыть ›</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: small(13), lineHeight: 1.45, color: c.sub, marginTop: 8 }}>Все семь — значок «Первые шаги ✦».</div>
      </section>
    );
  }

  // ── ЗНАЧКИ ──
  const grid = (
    <section data-ms-badges="" aria-label="Значки" style={{ marginBottom: 14 }}>
      <div style={{ ...eye, color: c.gold, margin: "6px 2px 10px" }}>{"Значки · " + bronze + " из " + total}</div>
      <div className={"ms-grid" + (a11y ? " ms-grid-l" : "")}>
        {fams.map((f) => {
          const silhouette = !f.tier && !(f.value > 0);
          const fresh = isNewTool(f, seen);
          const word = f.tier ? TIERS[f.tier] + (f.tier >= 3 ? " ✦" : "") : f.value > 0 ? f.value + " из " + f.next : "как получить";
          return (
            <button key={f.id} type="button" className="ms-tile sa-btn" data-ms-badge={f.id} data-ms-locked={silhouette ? "" : undefined}
              aria-label={f.title + " — " + (f.tier ? TIERS[f.tier] : "ещё не получен") + ". " + (f.value > 0 ? familyCount(f.id, f.value) : "Как получить") + (fresh ? ". Новое" : "")}
              onClick={() => openSheet(f.id)}
              style={{ background: a11y ? "rgba(250,242,222,0.55)" : "rgba(255,250,238,0.035)", border: "1px solid " + (f.tier ? (a11y ? "rgba(139,106,48,0.3)" : "rgba(214,178,102,0.24)") : (a11y ? "rgba(139,106,48,0.18)" : "rgba(214,178,102,0.12)")) }}>
              <Medal id={f.id} tier={f.tier} size={60} a11y={a11y} pct={f.pct} ring />
              <span className="ms-tile-t" style={{ fontFamily: BODY, fontSize: small(12.5), lineHeight: 1.25, color: f.tier ? c.text : c.sub }}>{msTie(f.title)}</span>
              {fresh ? (
                <span data-ms-new="" style={{ marginTop: "auto", padding: "2px 9px", borderRadius: 999, background: c.chipBg, color: c.chip, fontSize: small(12), fontWeight: "bold", lineHeight: 1.35 }}>новое</span>
              ) : (
                <span style={{ marginTop: "auto", fontSize: small(12), lineHeight: 1.35, color: f.tier ? tierText(f.tier, a11y) : c.sub, fontWeight: f.tier ? "bold" : "normal" }}>{word}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );

  // ── МАСТЕРА ЗАВЕДЕНИЯ ──
  let mastersBlock = null;
  const mstatus = masters && masters.status;
  if (mstatus === "ok") {
    const rows = Array.isArray(masters.rows) ? masters.rows : [];
    mastersBlock = (
      <section data-ms-masters="" aria-label="Мастера заведения" style={card(a11y, false)}>
        <div style={{ ...eye, color: c.gold }}>{"Мастера заведения" + (rows.length ? " · " + rows.length : "")}</div>
        {!rows.length ? <div style={{ fontFamily: BODY, fontSize: a11y ? 16 : 15, color: c.text, marginTop: 8 }}>Пока никого. Первый знак ✦ в заведении может быть твоим</div> : null}
        {rows.length ? (
          <div role="list" style={{ marginTop: 4 }}>
            {rows.map((r, i) => (
              <div key={(r.who || r.name || "") + ":" + r.role + ":" + i} role="listitem" data-ms-master="" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? "1px solid " + c.line : "none" }}>
                <span aria-hidden="true" style={{ color: tierColor(3, a11y), fontSize: 18, width: 22, textAlign: "center", flexShrink: 0 }}>✦</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ fontFamily: BODY, fontSize: a11y ? 16 : 15, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.who || r.name || "Коллега"}</span>
                    {r.me ? <span style={{ flexShrink: 0, padding: "1px 8px", borderRadius: 999, background: c.chipBg, color: c.chip, fontSize: small(12), fontWeight: "bold" }}>ты</span> : null}
                  </span>
                  <span style={{ display: "block", fontSize: small(12.5), color: c.sub }}>{ROLE_TITLE[r.role] ? "мастер роли «" + ROLE_TITLE[r.role] + "»" : "мастер роли"}</span>
                </span>
                <span style={{ fontSize: small(12.5), color: c.sub, whiteSpace: "nowrap", flexShrink: 0 }}>{shortDay(r.at)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    );
  } else if (mstatus === "loading") {
    mastersBlock = (
      <section data-ms-masters="" aria-busy="true" aria-label="Мастера заведения" style={{ marginBottom: 12 }}>
        <div style={{ ...eye, color: c.gold, margin: "0 2px 8px" }}>Мастера заведения</div>
        <div className="sa-skel" aria-hidden="true" style={{ height: 52, borderRadius: 14 }} />
      </section>
    );
  } else if ((mstatus === "offline" || mstatus === "error") && onReloadMasters) {
    mastersBlock = (
      <div data-ms-masters-reload="" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 2px 8px" }}>
        <span style={{ ...eye, color: c.gold }}>Мастера заведения</span>
        <button type="button" onClick={() => { vibrate("light"); onReloadMasters(); }} style={linkBtn(a11y, c)}>Обновить</button>
      </div>
    );
  }

  return (
    <div style={TT.screen} className="sa-screen" data-ms-screen="">
      <div style={{ ...TT.lessHead, justifyContent: "space-between" }}>
        <button style={{ ...TT.backBtn2, minWidth: 44, minHeight: 44, marginLeft: -10 }} onClick={onBack} aria-label="Назад">‹</button>
        <div style={{ ...TT.lessHeadTitle, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <FamIcon id="master" size={22} color={tierColor(3, a11y)} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block" }}>Путь мастера</span>
            {roleTitle ? <span style={{ display: "block", fontFamily: BODY, fontWeight: "normal", fontSize: small(12.5), color: c.sub, marginTop: 1 }}>{"роль «" + roleTitle + "»"}</span> : null}
          </span>
        </div>
        <div style={{ width: 24 }} />
      </div>
      <div style={{ padding: "12px 16px 100px" }}>
        {hint && hsteps.length ? <HintBubble a11y={!!a11y} text={hsteps[hstep]} arrow="up" step={hstep + 1} total={hsteps.length}
          onNext={hstep >= hsteps.length - 1 ? null : () => setHstep((v) => v + 1)} onClose={hintDone} /> : null}
        {hero}
        {stepCard}
        {firstBlock}
        {grid}
        {mastersBlock}
        <p style={{ margin: "8px 4px 0", fontSize: small(12.5), lineHeight: 1.5, color: c.sub, textAlign: "center" }}>Значки считаются на этом телефоне по твоим занятиям. Руководитель видит их в отчёте.</p>
      </div>
      {sheetFam ? <Layer inline={inline}><BadgeSheet a11y={a11y} fam={sheetFam} fresh={isNewTool(sheetFam, seen)} onClose={() => setSheet(null)} onShow={() => { setSheet(null); go(sheetFam.go || (famDef(sheetFam.id) || {}).go); }} /></Layer> : null}
      {cert && achieved ? <MasterCertificate a11y={a11y} profile={profile} role={roleId} state={st} earned={ern} shareUrl={shareUrl} inline={inline} onClose={() => setCert(false)} /> : null}
    </div>
  );
}

// ── Шторка значка: ступени, сколько до следующей, как получить, «Показать ›» ──
function BadgeSheet({ a11y, fam, fresh, onClose, onShow }) {
  const c = msPal(a11y);
  const F = famDef(fam.id) || {};
  const unit = F.unit || ["", "", ""];
  const tiers = Array.isArray(fam.tiers) ? fam.tiers : [];
  const n = (k) => tiers[k - 1] || 0;
  const count = fam.value > 0 ? (fam.id === "streak" ? "Лучшая серия — " : "") + familyCount(fam.id, fam.value) : "Ещё не начато";
  const nextLine = fam.tier >= 3 || fam.next == null ? "Высшая ступень ✦" : "До " + TIERS_OF[fam.tier + 1] + " — ещё " + fam.left + " " + plural(fam.left, unit[0], unit[1], unit[2]);
  const T3 = ["Бронза", "Серебро", "Золото"];
  return (
    <div className="ms-sheet-wrap" onClick={onClose} style={{ background: a11y ? "rgba(70,52,24,0.35)" : "rgba(8,6,3,0.62)" }}>
      <div className="ms-sheet" role="dialog" aria-modal="true" aria-label={fam.title} data-ms-sheet={fam.id} onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: a11y ? "#F6EEDC" : "#1E170C",
          backgroundImage: a11y ? "linear-gradient(180deg,rgba(255,252,244,0.99),rgba(247,239,222,0.99))" : "linear-gradient(180deg,rgba(46,35,18,0.98),rgba(28,21,10,0.98))",
          border: "1px solid " + (a11y ? "rgba(139,106,48,0.24)" : "rgba(214,178,102,0.2)"), borderTop: "1px solid " + (a11y ? "#fff" : "rgba(215,170,68,0.55)"), borderBottom: 0,
          boxShadow: a11y ? "inset 0 1px 0 #fff, 0 -10px 36px rgba(120,85,25,0.18)" : "inset 0 1px 0 rgba(255,236,190,0.16), 0 -12px 44px rgba(0,0,0,0.45)", fontFamily: BODY }}>
        <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 2, margin: "0 auto 10px", background: c.line }} />
        <button type="button" data-sa-back="" aria-label="Закрыть" onClick={onClose}
          style={{ position: "absolute", top: 8, right: 8, width: 44, height: 44, display: "grid", placeItems: "center", border: 0, background: "none", cursor: "pointer", padding: 0 }}><XIcon color={c.sub} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingRight: 36 }}>
          <Medal id={fam.id} tier={fam.tier} size={92} a11y={a11y} pct={fam.pct} ring />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...msEye(a11y), color: fam.tier ? tierText(fam.tier, a11y) : c.sub }}>{fam.tier ? "Значок · " + TIERS[fam.tier] : "Значок ещё не получен"}</div>
            <h3 style={{ margin: "4px 0 2px", fontFamily: SERIF, fontWeight: 700, fontSize: a11y ? 23 : 22, lineHeight: 1.18, color: c.text }}>{msTie(fam.title)}</h3>
            <div style={{ fontSize: msSmall(a11y, 14), color: c.sub }}>{count}</div>
            {fresh ? <span style={{ display: "inline-block", marginTop: 6, padding: "2px 9px", borderRadius: 999, background: c.chipBg, color: c.chip, fontSize: msSmall(a11y, 12), fontWeight: "bold" }}>новое</span> : null}
          </div>
        </div>
        <div role="list" aria-label="Ступени" style={{ marginTop: 14, borderRadius: 14, border: "1px solid " + c.line, overflow: "hidden" }}>
          {[1, 2, 3].map((k) => {
            const got = fam.tier >= k;
            const isNext = fam.tier + 1 === k;
            return (
              <div key={k} role="listitem" data-ms-tier={k} aria-label={T3[k - 1] + " — " + n(k) + (got ? ", есть" : "")}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: k > 1 ? "1px solid " + c.line : "none",
                  background: isNext ? (a11y ? "rgba(201,154,46,0.10)" : "rgba(232,197,106,0.07)") : "transparent" }}>
                <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, background: got ? tierColor(k, a11y) : "transparent", border: "2px solid " + tierColor(k, a11y), boxSizing: "border-box" }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: a11y ? 16 : 15, lineHeight: 1.35, color: got ? c.text : c.sub, fontWeight: got ? "bold" : "normal" }}>{T3[k - 1] + " — " + n(k) + " " + plural(n(k), unit[0], unit[1], unit[2])}</span>
                {got ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, fontSize: msSmall(a11y, 13), color: c.ok }}><Check size={14} color={c.ok} />есть</span>
                  : isNext ? <span style={{ flexShrink: 0, fontSize: msSmall(a11y, 13), color: c.sub }}>следующая</span> : null}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: BODY, fontSize: a11y ? 16.5 : 15.5, fontWeight: "bold", color: fam.tier >= 3 ? tierText(3, a11y) : c.text }}>{nextLine}</div>
          {fam.tier < 3 && fam.next != null ? (
            <div aria-hidden="true" style={{ height: 5, borderRadius: 3, marginTop: 7, background: c.faint, overflow: "hidden" }}>
              <div style={{ height: "100%", width: Math.round(100 * Math.max(0, Math.min(1, fam.pct || 0))) + "%", borderRadius: 3, background: tierColor(fam.tier + 1, a11y) }} />
            </div>
          ) : null}
        </div>
        <div style={{ ...msEye(a11y), color: c.gold, marginTop: 16 }}>Как получить</div>
        <p style={{ margin: "5px 0 0", fontSize: a11y ? 16 : 15, lineHeight: 1.5, color: c.text }}>{msTie(fam.how || F.how)}</p>
        <button type="button" className="sa-btn" data-ms-show="" onClick={onShow} style={{ ...msPrimary, width: "100%", minHeight: 50, marginTop: 16, fontSize: a11y ? 17 : 16 }}>Показать ›</button>
      </div>
    </div>
  );
}

// ── Сертификат мастера: карточка, «Поделиться картинкой / текстом» ──
function MasterCertificate({ a11y, profile, role, state, earned, shareUrl, onClose, inline }) {
  const c = msPal(a11y);
  const roleTitle = ROLE_TITLE[role] || "";
  const roleQ = roleTitle ? " «" + roleTitle + "»" : "";
  const pf = profile || {};
  const name = [pf.name, pf.surname].filter(Boolean).join(" ");
  const day = (earned && earned.master && earned.master[role]) || todayYmd();
  const dateStr = masterDate(day);
  const badges = topBadges(state, 6);
  const data = { name: pf.name || "", surname: pf.surname || "", restaurant: pf.restaurant || "", roleLabel: roleTitle, date: day, badges: badges.map((f) => ({ id: f.id, title: f.title, tier: f.tier })) };
  const picName = "master-" + (role || "role") + ".png";
  const [sent, setSent] = React.useState("");
  const [pic, setPic] = React.useState(null);
  const [pv, setPv] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  // картинку рисуем сразу: системное «Поделиться» с файлом работает только по свежему нажатию
  React.useEffect(() => {
    let dead = false;
    masterImage(data).then((b) => { if (!dead && b) setPic(b); }).catch(() => {});
    return () => { dead = true; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => () => { if (pv && pv.url) { try { URL.revokeObjectURL(pv.url); } catch (e) {} } }, [pv]);
  const preview = (blob) => { try { setPv({ url: URL.createObjectURL(blob) }); } catch (e) { setSent("Картинка не открылась — поделись текстом"); } };
  const sharePic = () => {
    if (busy) return;
    setSent("");
    const send = (blob) => {
      let file = null;
      try { file = new File([blob], picName, { type: "image/png" }); } catch (e) {}
      let can = false;
      try { can = !!(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) {}
      if (!can) { preview(blob); return; }
      navigator.share({ files: [file], title: "Сертификат мастера" }).then(() => setSent("Отправлено"), (e) => { if (!(e && e.name === "AbortError")) preview(blob); });
    };
    if (pic) { vibrate("light"); send(pic); return; }
    setBusy(true);
    masterImage(data).then((blob) => {
      setBusy(false);
      if (!blob) { setSent("Картинка не получилась — поделись текстом"); return; }
      setPic(blob);
      preview(blob);   // время нажатия ушло — сразу просмотр, оттуда «Скачать» или «Поделиться»
    }, () => { setBusy(false); setSent("Картинка не получилась — поделись текстом"); });
  };
  const shareText = () => {
    vibrate("light");
    const text = masterShareText({ name: pf.name, roleLabel: roleTitle, restaurant: pf.restaurant });
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.initData && typeof tg.openTelegramLink === "function") { tg.openTelegramLink("https://t.me/share/url?url=" + encodeURIComponent(shareUrl || "") + "&text=" + encodeURIComponent(text)); setSent("Выбери чат в Telegram"); return; }
    } catch (e) {}
    const full = text + (shareUrl ? "\n" + shareUrl : "");
    const copy = () => { try { navigator.clipboard.writeText(full).then(() => setSent("Текст скопирован"), () => setSent("Не получилось скопировать — сделай снимок экрана")); } catch (e) { setSent("Не получилось скопировать — сделай снимок экрана"); } };
    try { if (navigator.share) { navigator.share({ text: full }).then(() => setSent("Отправлено"), (e) => { if (!(e && e.name === "AbortError")) copy(); }); return; } } catch (e) {}
    copy();
  };
  const pvShare = () => {
    if (!pic) return;
    let file = null;
    try { file = new File([pic], picName, { type: "image/png" }); } catch (e) {}
    try { if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file] }).catch(() => {}); } catch (e) {}
  };
  const canFiles = (() => { try { return !!(typeof navigator !== "undefined" && navigator.canShare && typeof File !== "undefined" && navigator.canShare({ files: [new File([""], "a.png", { type: "image/png" })] })); } catch (e) { return false; } })();
  const ink = a11y ? { text: "#2A1F0E", sub: "#5E4E30", gold: "#7A5A1E", frame: "rgba(139,106,48,0.62)", inner: "rgba(139,106,48,0.3)" }
    : { text: "#FFF6E2", sub: "rgba(243,233,210,0.8)", gold: "#E8C56A", frame: "rgba(232,197,106,0.62)", inner: "rgba(232,197,106,0.3)" };
  const el = (
    <div className="ms-cert-wrap" role="dialog" aria-modal="true" aria-label="Сертификат мастера" data-ms-cert=""
      style={{ background: a11y ? "radial-gradient(120% 70% at 50% 0%,#F3DEA8 0%,#EFE6D2 64%)" : "radial-gradient(120% 70% at 50% 0%,#3E2C12 0%,#120D06 70%)" }}>
      <div className="ms-cert-col">
        <div style={{ borderRadius: 22, padding: 7, border: "1.5px solid " + ink.frame,
          background: a11y ? "linear-gradient(160deg,#FCF6E6 0%,#F2E3C1 100%)" : "linear-gradient(160deg,#3B2B13 0%,#1F170B 55%,#170F07 100%)",
          boxShadow: a11y ? "0 16px 40px rgba(90,66,20,0.25), inset 0 1px 0 #fff" : "0 18px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,236,190,0.15)" }}>
          <div style={{ borderRadius: 16, border: "1px solid " + ink.inner, padding: "20px 14px 18px", textAlign: "center", fontFamily: BODY }}>
            <div style={{ ...msEye(a11y), letterSpacing: 2.4, color: ink.gold }}>✦ Service Academy ✦</div>
            <div className="ms-cert-h" style={{ fontFamily: SERIF, fontWeight: 700, color: ink.text, marginTop: 6, whiteSpace: "nowrap" }}>СЕРТИФИКАТ МАСТЕРА</div>
            <div style={{ display: "flex", justifyContent: "center", margin: "14px 0 10px" }}><Medal id="master" tier={3} size={88} a11y={a11y} ring={false} title={"Мастер роли" + roleQ + " ✦"} /></div>
            <div style={{ fontStyle: "italic", fontSize: a11y ? 15 : 14, color: ink.sub }}>настоящим подтверждается, что</div>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 27, lineHeight: 1.2, color: ink.text, margin: "6px 0 4px", overflowWrap: "anywhere" }}>{name || "Сотрудник"}</div>
            <div style={{ fontFamily: BODY, fontSize: 19, color: ink.gold }}>{"мастер роли" + roleQ + " ✦"}</div>
            <div style={{ fontSize: a11y ? 15 : 14, color: ink.sub, marginTop: 6 }}>{[pf.restaurant, dateStr].filter(Boolean).join(" · ")}</div>
            {badges.length ? (
              <div role="list" aria-label="Лучшие значки" className="ms-cert-badges">
                {badges.map((f) => <span key={f.id} role="listitem"><Medal id={f.id} tier={f.tier} size={40} a11y={a11y} ring={false} /></span>)}
              </div>
            ) : null}
            <div style={{ height: 1, background: ink.inner, margin: "14px 18px 12px" }} />
            <div style={{ fontSize: a11y ? 14 : 13, lineHeight: 1.5, color: ink.sub }}>{MASTER_PARTS.split(" · ").map((x) => x.replace(/ (?=\S+$)|(?<=^\S+) /g, "\u00A0")).join("\u00A0· ")}</div>
          </div>
        </div>
        <button type="button" className="sa-btn" data-ms-sharepic="" onClick={sharePic} disabled={busy} style={{ ...msPrimary, width: "100%", minHeight: 52, marginTop: 16, fontSize: a11y ? 17 : 16, opacity: busy ? 0.65 : 1 }}>
          <ShareIc />{busy ? "Рисуем картинку…" : "Поделиться картинкой"}
        </button>
        <button type="button" className="sa-btn" data-ms-sharetext="" onClick={shareText} style={{ ...ghostBtn(a11y, c), width: "100%", minHeight: 48, marginTop: 8, color: a11y ? "#2A1F0E" : "#F3E9D2" }}>Поделиться текстом</button>
        {sent ? <p role="status" style={{ margin: "10px 0 0", textAlign: "center", fontSize: a11y ? 14 : 13.5, color: a11y ? "#2A1F0E" : "rgba(243,233,210,0.86)" }}>{sent}</p> : null}
        <button type="button" className="sa-btn" data-sa-back={pv ? undefined : ""} onClick={onClose}
          style={{ display: "block", width: "100%", minHeight: 46, marginTop: 4, border: 0, background: "none", cursor: "pointer", color: a11y ? "#5E4E30" : "rgba(243,233,210,0.8)", fontFamily: BODY, fontWeight: "bold", fontSize: a11y ? 16 : 15 }}>Закрыть</button>
      </div>
    </div>
  );
  const pvEl = pv ? (
    <div className="ms-pv" role="dialog" aria-modal="true" aria-label="Сертификат мастера картинкой" data-ms-preview="">
      <img src={pv.url} alt={"Сертификат мастера роли" + roleQ} />
      <a href={pv.url} download={picName} className="sa-btn" style={{ ...msPrimary, width: "100%", maxWidth: 360, minHeight: 52, fontSize: 16, textDecoration: "none" }}>Скачать картинку</a>
      {canFiles ? <button type="button" onClick={pvShare} style={{ ...ghostBtn(false, msPal(false)), width: "100%", maxWidth: 360, color: "#F3E9D2" }}>Поделиться…</button> : null}
      <p>Или нажми и удерживай картинку — «Сохранить» или «Поделиться». В Telegram её можно отправить из галереи.</p>
      <button type="button" data-sa-back="" onClick={() => setPv(null)} style={{ minHeight: 46, padding: "0 20px", border: 0, background: "none", cursor: "pointer", color: "rgba(243,233,210,0.84)", fontFamily: BODY, fontWeight: "bold", fontSize: 15 }}>Готово</button>
    </div>
  ) : null;
  return <><Layer inline={inline}>{el}</Layer>{pvEl ? <Layer inline={inline}>{pvEl}</Layer> : null}</>;
}

export default MasteryScreen;
