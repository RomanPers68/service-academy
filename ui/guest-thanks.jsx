// ui/guest-thanks.jsx — v84 (Доп. 397): страница гостя «Сказать спасибо» по QR сотрудника.
//
// Открывается по ссылке <приложение>/?thanks=<код> — без входа и без остального приложения (main.jsx грузит только её):
// имя и должность сотрудника, заведение, «за что спасибо» (отметки), пара слов и «Сказать спасибо». С одного телефона
// одному сотруднику — раз в 12 часов (номер браузера — случайный, не личные данные). Сервер — этап 34.
// v86 (Доп. 399): после «Спасибо передано» — «Отзыв на Яндекс Картах / в 2ГИС», если руководитель дал ссылки (этап 36).
import React from "react";
import { rpc } from "../api/supabase";
import { THANKS_TAGS, THANKS_TEXT_MAX, posLabel, deviceId, reviewButtons } from "../lib/guest-thanks";

const GOLD = "#D2A85A", CREAM = "#EFE4C8", SUB = "#A99A7C", LINE = "rgba(214,178,102,0.24)";
const shell = { minHeight: "100vh", boxSizing: "border-box", display: "flex", justifyContent: "center", padding: "max(28px, var(--sa-st, env(safe-area-inset-top, 0px))) 18px 32px",
  background: "radial-gradient(130% 80% at 50% -5%, rgba(214,170,80,0.12) 0%, rgba(214,170,80,0) 55%), linear-gradient(160deg, #1A1008 0%, #1C1509 50%, #14110A 100%)",
  fontFamily: "Georgia, serif", color: CREAM };
const card = { width: "100%", maxWidth: 440, boxSizing: "border-box", padding: "22px 20px", borderRadius: 22, background: "rgba(226,186,116,0.08)",
  border: "1px solid rgba(255,255,255,0.12)", boxShadow: "inset 0 0 30px rgba(255,248,230,0.06), 0 10px 30px rgba(0,0,0,0.45)" };
const label = { fontStyle: "italic", fontSize: 14, color: GOLD };

function Heart() {
  return <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /><path d="M9.5 11.5l1.8 1.8 3.4-3.6" /></svg>;
}

export function GuestThanksPage({ code }) {
  const [st, setSt] = React.useState({ status: "loading" });
  const [tags, setTags] = React.useState([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState("");   // "" | "ok" | "dup" | "limit"
  const [err, setErr] = React.useState("");
  const [reviews, setReviews] = React.useState([]);
  // ссылки на отзывы спрашиваем, когда спасибо уже ушло: без этапа 36 их просто нет
  React.useEffect(() => {
    if (!code || (done !== "ok" && done !== "dup")) return undefined;
    let alive = true;
    rpc("guest_review_links", { p_code: code }).then((r) => { if (alive && r && r.ok) setReviews(reviewButtons(r.links)); }).catch(() => {});
    return () => { alive = false; };
  }, [code, done]);
  React.useEffect(() => {
    try { const sp = document.getElementById("sa-splash"); if (sp) sp.remove(); } catch (e) {}
    try { document.title = "Сказать спасибо"; } catch (e) {}
    if (!code) { setSt({ status: "gone" }); return; }   // битый код в ссылке — не спрашиваем сервер
    rpc("guest_thanks_card", { p_code: code }).then((r) => {
      if (r && r.ok) setSt({ status: "ok", name: String(r.name || "").trim(), pos: posLabel(r.pos), restaurant: String(r.restaurant || "").trim() });
      else setSt({ status: r && (r.code === "PGRST202" || r.code === "42883") ? "missing" : "gone" });
    }).catch(() => setSt({ status: "offline" }));
  }, [code]);
  const toggle = (k) => setTags((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));
  const send = () => {
    if (busy) return;
    setBusy(true); setErr("");
    rpc("guest_thanks_send", { p_code: code, p_tags: tags, p_text: text.trim(), p_device: deviceId() }).then((r) => {
      setBusy(false);
      if (r && r.ok) setDone(r.dup ? "dup" : "ok");
      else if (r && r.error === "limit") setDone("limit");
      else if (r && r.error === "not_found") setSt({ status: "gone" });
      else setErr("Не отправилось. Проверьте интернет и попробуйте ещё раз.");
    }).catch(() => { setBusy(false); setErr("Нет связи. Проверьте интернет и попробуйте ещё раз."); });
  };
  const name = st.name || "сотрудник";
  return (
    <div style={shell} data-guest-thanks="">
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", fontSize: 13, letterSpacing: 5, color: GOLD, opacity: 0.85, margin: "6px 0 18px" }}>SA</div>
        {st.status === "loading" ? <div style={{ ...card, textAlign: "center", color: SUB }}>Минуту…</div> : null}
        {st.status === "gone" || st.status === "missing" ? (
          <div style={{ ...card, textAlign: "center", lineHeight: 1.55 }} data-guest-gone="">
            <div style={{ fontSize: 19, marginBottom: 8 }}>Эта ссылка не работает</div>
            <div style={{ fontSize: 14.5, color: SUB }}>Попросите у сотрудника новый QR-код. Спасибо, что хотели поблагодарить.</div>
          </div>) : null}
        {st.status === "offline" ? (
          <div style={{ ...card, textAlign: "center", lineHeight: 1.55 }}>
            <div style={{ fontSize: 17, marginBottom: 8 }}>Нет связи</div>
            <div style={{ fontSize: 14.5, color: SUB }}>Проверьте интернет и откройте ссылку ещё раз.</div>
          </div>) : null}
        {st.status === "ok" && done ? (
          <div style={{ ...card, textAlign: "center", lineHeight: 1.55 }} data-guest-done={done}>
            <Heart />
            <div style={{ fontSize: 22, margin: "10px 0 8px" }}>{done === "ok" ? "Спасибо передано" : done === "dup" ? "Спасибо уже отправлено" : "Спасибо, что хотели поблагодарить"}</div>
            <div style={{ fontSize: 15, color: SUB }}>
              {done === "ok" ? name + " увидит его в приложении. Будем рады видеть вас снова."
                : done === "dup" ? "С этого телефона его отправляли сегодня. " + name + " увидит его в приложении."
                : "Сегодня спасибо для этого сотрудника уже очень много. Мы передадим и ваше на словах."}
            </div>
            {st.restaurant ? <div style={{ ...label, marginTop: 16 }}>{st.restaurant}</div> : null}
            {reviews.length ? <div data-guest-reviews="" style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${LINE}` }}>
              <div style={{ fontSize: 14, color: SUB, marginBottom: 10 }}>Если хотите, расскажите о нас другим:</div>
              {reviews.map((r) => <a key={r.kind} href={r.url} target="_blank" rel="noopener noreferrer" data-guest-review={r.kind}
                style={{ display: "block", padding: "12px 14px", marginTop: 8, borderRadius: 16, border: `1px solid ${GOLD}`, color: CREAM, textDecoration: "none", fontSize: 15.5 }}>{r.label}</a>)}
            </div> : null}
          </div>) : null}
        {st.status === "ok" && !done ? (
          <div style={card} data-guest-form="">
            {st.restaurant ? <div style={{ ...label, textAlign: "center" }}>{st.restaurant}</div> : null}
            <div style={{ textAlign: "center", fontSize: 30, margin: "8px 0 2px", color: CREAM }} data-guest-name="">{name}</div>
            {st.pos ? <div style={{ textAlign: "center", fontSize: 14, color: SUB }}>{st.pos}</div> : null}
            <div style={{ height: 1, background: LINE, margin: "18px 0 16px" }} />
            <div style={{ ...label, marginBottom: 10 }}>За что спасибо?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }} role="group" aria-label="За что спасибо">
              {THANKS_TAGS.map(([k, t]) => {
                const on = tags.includes(k);
                return <button key={k} type="button" aria-pressed={on} data-guest-tag={k} onClick={() => toggle(k)}
                  style={{ padding: "9px 14px", borderRadius: 999, border: `1px solid ${on ? GOLD : LINE}`, background: on ? "rgba(200,169,110,0.24)" : "transparent",
                    color: on ? CREAM : SUB, fontFamily: "Georgia, serif", fontSize: 14.5, cursor: "pointer" }}>{t}</button>;
              })}
            </div>
            <label style={{ display: "block" }}>
              <span style={{ ...label, display: "block", marginBottom: 6 }}>Пара слов (по желанию)</span>
              <textarea value={text} maxLength={THANKS_TEXT_MAX} rows={3} onChange={(e) => setText(e.target.value)} data-guest-text=""
                placeholder="Например: спасибо за совет с вином"
                style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 14, border: `1px solid ${LINE}`, background: "rgba(0,0,0,0.25)",
                  color: CREAM, fontFamily: "Georgia, serif", fontSize: 15.5, lineHeight: 1.45, outline: "none", resize: "vertical" }} />
            </label>
            {err ? <div role="alert" style={{ fontSize: 13.5, color: "#E08A7A", marginTop: 8, lineHeight: 1.45 }}>{err}</div> : null}
            <button type="button" onClick={send} disabled={busy} data-guest-send=""
              style={{ width: "100%", marginTop: 16, padding: 16, borderRadius: 18, border: 0, background: GOLD, color: "#1A1008", fontFamily: "Georgia, serif",
                fontSize: 17, fontWeight: "bold", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Отправляю…" : "Сказать спасибо"}</button>
            <div style={{ textAlign: "center", fontSize: 12.5, color: SUB, marginTop: 10 }}>Без регистрации. {name} увидит ваше спасибо в приложении.</div>
          </div>) : null}
        <div style={{ textAlign: "center", fontSize: 11.5, color: SUB, opacity: 0.7, marginTop: 18 }}>Service Academy</div>
      </div>
    </div>
  );
}
