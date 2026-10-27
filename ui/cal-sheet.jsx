// ui/cal-sheet.jsx — v99 (Доп. 412): «Смены в календаре телефона». Личная ссылка (этап 39, cal_key) — подписка: календарь
// телефона сам забирает смены (api/cal.js на Vercel) и обновляет их, когда меняется график. «Подписаться» открывает в
// браузере страницу с кнопкой «Добавить в календарь» (iPhone и компьютер сразу предлагают подписаться), там же — как
// добавить в Google Календарь; «Скопировать ссылку»; «Сбросить ссылку» — если отдал её кому-то (старая перестанет работать).
import React from "react";
import { createPortal } from "react-dom";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { vibrate } from "../lib/utils";
import { serverMissing } from "../lib/server-text";

const C = (a11y) => (a11y
  ? { text: "#2A1F0E", sub: "#6B5B40", gold: "#7A5D2A", line: "rgba(150,112,40,0.30)", bg: "rgba(250,242,222,0.62)", ok: "#2C6B48", bad: "#A33A2A" }
  : { text: "#EFE4C8", sub: "#A99B7E", gold: "#D9B87C", line: "rgba(214,178,102,0.32)", bg: "rgba(255,250,238,0.035)", ok: "#8AD8AF", bad: "#E07878" });
const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const ymdNow = () => { const t = new Date(); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); };

/** «сегодня», «завтра», «пятница, 30 октября» — для строки смены. */
export function calDay(ymd, today = ymdNow()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!m) return "";
  const d = new Date(+m[1], +m[2] - 1, +m[3]), t = new Date(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const diff = Math.round((d - t) / 86400000);
  return (diff === 0 ? "сегодня" : diff === 1 ? "завтра" : WD[d.getDay()]) + ", " + d.getDate() + " " + MON[d.getMonth()];
}
/** Когда календарь последний раз забирал смены: «сегодня в 14:02», «вчера в 9:10», «28 октября». */
export function calUsed(iso, now = new Date()) {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime()) || !iso) return "";
  const k = (x) => x.getFullYear() * 400 + x.getMonth() * 32 + x.getDate();
  const hm = d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return k(d) === k(now) ? "сегодня в " + hm : k(d) === k(y) ? "вчера в " + hm : d.getDate() + " " + MON[d.getMonth()];
}
/** Адрес файла календаря по ключу: этот же сайт, /api/cal. */
export const calUrl = (origin, key) => String(origin || "").replace(/\/+$/, "") + "/api/cal?k=" + encodeURIComponent(String(key || ""));
const platform = () => { try { const p = String((window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.platform) || "").toLowerCase(); if (p) return p; return /android/i.test(navigator.userAgent) ? "android" : /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "web"; } catch (e) { return "web"; } };
// открыть в браузере: в Telegram — его openLink (из мини-приложения webcal не открыть), иначе — новая вкладка
const openOut = (url) => {
  try { const tg = window.Telegram && window.Telegram.WebApp; if (tg && tg.initData && typeof tg.openLink === "function") { tg.openLink(url); return; } } catch (e) { /* */ }
  try { window.open(url, "_blank", "noopener"); } catch (e) { /* */ }
};

export function CalSheet({ a11y, admin = false, onClose }) {
  const c = C(a11y);
  const [st, setSt] = React.useState({ phase: "load" });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [sure, setSure] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const urlRef = React.useRef(null);
  const load = (reset = false) => {
    setBusy(true);
    return rpc("cal_key", { p_token: saToken(), p_reset: !!reset }).then((r) => {
      setBusy(false);
      if (rpcMissing(r)) { setSt({ phase: "missing" }); return null; }
      if (!r || !r.ok || !r.key) { setSt({ phase: "error" }); return null; }
      setSt({ phase: "ready", key: r.key, used: r.used || null, next: Array.isArray(r.next) ? r.next : [], schedule: r.schedule !== false });
      return r;
    }).catch(() => { setBusy(false); setSt({ phase: "offline" }); return null; });
  };
  React.useEffect(() => { load(false); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const origin = typeof window !== "undefined" && window.location ? window.location.origin : "";
  const url = st.phase === "ready" ? calUrl(origin, st.key) : "";
  const pf = platform();
  const subscribe = () => { if (!url) return; vibrate("light"); openOut(url + "&page=1"); setMsg(pf === "ios" ? "В браузере нажми «Добавить в календарь», потом «Подписаться»." : pf === "android" ? "На странице: как добавить ссылку в Google Календарь." : "В браузере нажми «Добавить в календарь»."); };
  const copy = () => {
    if (!url) return;
    vibrate("light");
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2500); };
    const manual = () => { try { const el = urlRef.current; if (el) { el.focus(); el.select(); document.execCommand("copy"); done(); } } catch (e) { setMsg("Не получилось скопировать: выдели ссылку ниже и скопируй."); } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, manual); else manual(); } catch (e) { manual(); }
  };
  const reset = () => {
    if (!sure) { vibrate("light"); setSure(true); return; }
    setSure(false); setMsg("");
    load(true).then((r) => { if (r) { vibrate("success"); setMsg("Ссылка новая. Старая подписка больше не обновляется: подпишись заново."); } });
  };
  const note = (t, color) => <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: color || c.sub }}>{t}</p>;
  const mainBtn = { display: "block", width: "100%", marginTop: 14, padding: 13, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", color: "#1A1008", background: "linear-gradient(180deg,#E4C88C,#C8A96E)" };
  const ghostBtn = { display: "block", width: "100%", marginTop: 8, padding: 12, borderRadius: 999, cursor: "pointer", background: "transparent", border: `1px solid ${c.line}`, color: c.text, fontSize: 14, fontFamily: "Georgia, serif" };
  const today = ymdNow();
  return createPortal(
    <div className="tbv" data-cal-sheet={st.phase} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: a11y ? "rgba(70,52,24,0.35)" : "rgba(8,6,3,0.62)", display: "flex", alignItems: "flex-end" }}>
      <div role="dialog" aria-modal="true" aria-label="Смены в календаре телефона" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box", margin: "0 auto", padding: "18px 18px calc(18px + env(safe-area-inset-bottom,0px))", borderRadius: "22px 22px 0 0", backgroundColor: a11y ? "#F6EEDC" : "#1E170C", backgroundImage: "var(--sheet-bg,none)", border: "1px solid var(--sheet-edge," + c.line + ")", borderTop: "1px solid var(--sheet-top," + c.line + ")", borderBottom: 0, boxShadow: "var(--sheet-shadow,none)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span aria-hidden="true" style={{ color: c.gold, display: "inline-flex" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M9 15.5l2.2 2.2 4-4.4" /></svg></span>
          <h3 style={{ flex: 1, margin: 0, fontFamily: "'Piazzolla', Georgia, serif", fontSize: 20, color: c.text }}>Смены в календаре телефона</h3>
          <button type="button" className="sa-btn" data-sa-back="" aria-label="Закрыть" onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", border: 0, background: "none", color: c.sub, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 13.5, lineHeight: 1.5, color: c.sub }}>
          Твои смены появятся в календаре телефона рядом с остальными делами и будут обновляться сами, когда меняется график.
        </p>
        {st.phase === "load" ? note("Готовлю ссылку…") : null}
        {st.phase === "missing" ? note(serverMissing({ what: "календарь смен", admin, sql: "supabase-stage39-everyday.sql" })) : null}
        {st.phase === "offline" ? note("Нет связи. Открой это окно, когда появится сеть.") : null}
        {st.phase === "error" ? note("Не получилось сделать ссылку. Попробуй ещё раз позже.") : null}
        {st.phase === "ready" ? (<>
          <div data-cal-next={st.next.length} style={{ padding: "10px 12px", borderRadius: 14, border: `1px solid ${c.line}`, background: c.bg }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 13, color: c.gold, fontStyle: "italic", marginBottom: 4 }}>Ближайшие смены</div>
            {st.next.length ? st.next.map((s) => (
              <div key={s.date} style={{ fontSize: 14, lineHeight: 1.55, color: c.text }}>{calDay(s.date, today)} · {String(s.label || "").toLowerCase()} {s.time}</div>
            )) : <div style={{ fontSize: 13.5, color: c.sub }}>{st.schedule ? "На две недели вперёд смен нет. Появятся в календаре, когда их поставят в график." : "График ещё не составлен. Смены появятся в календаре сами."}</div>}
          </div>
          {st.used ? note("Календарь забирал смены: " + calUsed(st.used) + ". Подписка работает.", c.ok) : null}
          <button type="button" className="sa-btn" data-cal-sub="" onClick={subscribe} disabled={busy} style={mainBtn}>Подписаться</button>
          <button type="button" className="sa-btn" data-cal-copy="" onClick={copy} disabled={busy} style={ghostBtn}>{copied ? "Ссылка скопирована" : "Скопировать ссылку"}</button>
          <input ref={urlRef} readOnly value={url} aria-label="Ссылка на календарь" data-cal-url="" onFocus={(e) => e.target.select()}
            style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, padding: "9px 10px", borderRadius: 10, border: `1px solid ${c.line}`, background: "transparent", color: c.sub, fontSize: 12, fontFamily: "ui-monospace, Menlo, monospace" }} />
          {msg ? note(msg, c.text) : null}
          {note(pf === "android" ? "Android: Google Календарь подписывается по ссылке на компьютере (calendar.google.com, «Добавить по URL»), на телефоне смены появятся сами."
            : "Ссылка личная: по ней видны только твои смены. Напоминание о смене по-прежнему придёт в Telegram.")}
          <button type="button" className="sa-btn" data-cal-reset="" onClick={reset} disabled={busy}
            style={{ ...ghostBtn, border: `1px solid ${sure ? c.bad : c.line}`, color: sure ? c.bad : c.sub }}>{sure ? "Сбросить? Старая подписка перестанет обновляться" : "Сбросить ссылку"}</button>
        </>) : null}
      </div>
    </div>, document.body);
}
