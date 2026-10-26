// ui/guest-thanks.jsx — v84 (Доп. 397): страница гостя «Сказать спасибо» по QR сотрудника.
//
// Открывается по ссылке <приложение>/?thanks=<код> — без входа и без остального приложения (main.jsx грузит только её):
// имя и должность сотрудника, заведение, «за что спасибо» (отметки), пара слов и «Сказать спасибо». С одного телефона
// одному сотруднику — раз в 12 часов (номер браузера — случайный, не личные данные). Сервер — этап 34.
// v86 (Доп. 399): после «Спасибо передано» — «Отзыв на Яндекс Картах / в 2ГИС», если руководитель дал ссылки (этап 36).
// v87 (Доп. 400): страница в кремово-золотых тонах, как бумажная карточка в папке для счёта (гость открывает её
//   в обычном браузере, днём и в светлом зале); после отправки сердце рисуется золотой линией и один раз «бьётся».
//   Кто выключил анимацию в телефоне (prefers-reduced-motion), видит сердце сразу целиком.
import React from "react";
import { rpc } from "../api/supabase";
import { THANKS_TAGS, THANKS_TEXT_MAX, posLabel, deviceId, reviewButtons, HEART_PATH } from "../lib/guest-thanks";

// цвета бумаги: текст золотом — тёмное золото (6:1 на бумаге), светлое золото — только линии и рисунок
export const GUEST_PAPER = { ink: "#2A1F0E", sub: "#6B5B40", gold: "#7A5D2A", line: "#B88C3A", page: "#F4EAD5" };
const { ink: INK, sub: SUB, gold: GOLD } = GUEST_PAPER;
const shell = { minHeight: "100vh", boxSizing: "border-box", display: "flex", justifyContent: "center", padding: "max(26px, var(--sa-st, env(safe-area-inset-top, 0px))) 16px 30px",
  background: "radial-gradient(120% 70% at 50% -8%, rgba(226,186,110,0.40) 0%, rgba(226,186,110,0) 58%), radial-gradient(90% 55% at 50% 112%, rgba(210,168,90,0.20) 0%, rgba(210,168,90,0) 60%), linear-gradient(175deg, #FBF5E8 0%, #F4EAD5 60%, #EEE0C2 100%)",
  fontFamily: "Georgia, serif", color: INK };
const label = { fontStyle: "italic", fontSize: 14.5, color: GOLD };

// анимация и состояния — классами: псевдоклассы (:active, :focus-visible) и prefers-reduced-motion строками стилей не задать
const CSS = `
.gt-card{position:relative;width:100%;max-width:440px;box-sizing:border-box;padding:24px 20px 22px;border-radius:20px;
  background:linear-gradient(180deg,#FFFDF8 0%,#FBF4E4 100%);border:1px solid rgba(150,112,44,.30);
  box-shadow:0 18px 40px rgba(120,85,25,.16),0 2px 6px rgba(120,85,25,.08)}
.gt-card:before{content:"";position:absolute;inset:5px;border:1px solid rgba(150,112,44,.18);border-radius:15px;pointer-events:none}
.gt-in{animation:gtIn .5s ease-out both}
.gt-mono{display:flex;align-items:center;justify-content:center;gap:12px;margin:4px 0 18px;color:${GOLD};font-size:13px;letter-spacing:5px}
.gt-mono b{font-weight:normal;padding-left:5px}
.gt-mono i,.gt-rule i{flex:0 0 auto;height:1px}
.gt-mono i{width:38px;background:linear-gradient(90deg,rgba(150,112,44,0),rgba(150,112,44,.55))}
.gt-mono i:last-child,.gt-rule i:last-child{transform:scaleX(-1)}
.gt-rule{display:flex;align-items:center;gap:8px;margin:18px 0 16px}
.gt-rule i{flex:1 1 auto;background:linear-gradient(90deg,rgba(150,112,44,0),rgba(150,112,44,.45))}
.gt-rule s{width:6px;height:6px;transform:rotate(45deg);border:1px solid #B88C3A;background:#FBF0D6;text-decoration:none}
.gt-tag{padding:9px 14px;border-radius:999px;border:1px solid rgba(150,112,44,.32);background:rgba(255,255,255,.55);color:#4A3A20;
  font-family:Georgia,serif;font-size:14.5px;cursor:pointer;transition:background .2s,border-color .2s,box-shadow .2s,transform .12s;-webkit-tap-highlight-color:transparent}
.gt-tag[aria-pressed="true"]{background:linear-gradient(180deg,#F6E3B4 0%,#EDCF8A 100%);border-color:#B88C3A;color:${INK};box-shadow:0 3px 10px rgba(184,140,58,.28),inset 0 1px 0 rgba(255,255,255,.6)}
.gt-tag:active,.gt-send:active{transform:scale(.97)}
.gt-text{display:block;width:100%;box-sizing:border-box;padding:11px 13px;border-radius:14px;border:1px solid rgba(150,112,44,.32);background:#FFFEFA;color:${INK};
  font-family:Georgia,serif;font-size:16px;line-height:1.45;outline:none;resize:vertical;box-shadow:inset 0 1px 3px rgba(120,85,25,.08)}
.gt-text:focus{border-color:#B88C3A;box-shadow:0 0 0 3px rgba(210,168,90,.28)}
.gt-text::placeholder{color:#8C7B5C;opacity:1}
.gt-send{width:100%;margin-top:16px;padding:16px;border-radius:18px;border:0;background:linear-gradient(180deg,#DDBA6C 0%,#C29545 100%);color:#1F1608;
  font-family:Georgia,serif;font-size:17px;font-weight:bold;cursor:pointer;box-shadow:0 10px 22px rgba(176,132,52,.32),inset 0 1px 0 rgba(255,255,255,.5);
  transition:transform .12s,box-shadow .2s;-webkit-tap-highlight-color:transparent}
.gt-send:disabled{opacity:.6;cursor:default}
.gt-review{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 16px;margin-top:8px;border-radius:16px;border:1px solid rgba(150,112,44,.40);
  background:rgba(255,255,255,.6);color:${INK};text-decoration:none;font-size:15.5px;text-align:left;box-shadow:0 4px 12px rgba(120,85,25,.08)}
.gt-tag:focus-visible,.gt-send:focus-visible,.gt-review:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}
.gt-heart{display:block;margin:0 auto;overflow:visible}
.gt-draw,.gt-draw2{stroke-dasharray:1 1.01;stroke-dashoffset:1}
.gt-draw{animation:gtDraw 1.5s cubic-bezier(.45,.05,.25,1) .15s forwards}
.gt-draw2{animation:gtDraw 1s ease-out .8s forwards}
.gt-fill{opacity:0;animation:gtFade .8s ease-out 1.3s forwards}
.gt-glow{opacity:0;animation:gtGlow 2.4s ease-out 1.3s forwards}
.gt-beat{transform-box:view-box;transform-origin:66px 60px;animation:gtBeat 1.1s ease-in-out 1.75s both}
.gt-spark{opacity:0;transform-box:fill-box;transform-origin:center;animation:gtSpark .9s ease-out forwards}
.gt-spark.s1{animation-delay:1.25s}.gt-spark.s2{animation-delay:1.45s}.gt-spark.s3{animation-delay:1.65s}
.gt-after{animation:gtIn .6s ease-out .7s both}
@keyframes gtIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes gtDraw{to{stroke-dashoffset:0}}
@keyframes gtFade{to{opacity:1}}
@keyframes gtGlow{0%{opacity:0}40%{opacity:1}100%{opacity:.6}}
@keyframes gtBeat{0%,100%{transform:scale(1)}25%{transform:scale(1.07)}45%{transform:scale(.99)}65%{transform:scale(1.04)}}
@keyframes gtSpark{0%{opacity:0;transform:scale(.3) rotate(-30deg)}60%{opacity:1;transform:scale(1.15) rotate(8deg)}100%{opacity:.85;transform:scale(1) rotate(0)}}
@media (prefers-reduced-motion: reduce){
  .gt-in,.gt-after,.gt-beat{animation:none}
  .gt-draw,.gt-draw2{animation:none;stroke-dashoffset:0}
  .gt-fill,.gt-glow,.gt-spark{animation:none;opacity:1}
  .gt-tag,.gt-send{transition:none}
}
`;

// сердце: контур рисуется линией, потом мягкая заливка, свечение и искры
const HEART = HEART_PATH;   // то же сердце — на картинках для печати (ui/thanks-print.js)
const HEART_IN = "M66 88C66 88 32 67 32 45C32 35 39 29 47 29";
const star = (x, y, r) => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;
function DrawnHeart() {
  return (
    <svg className="gt-heart" data-guest-heart="" width="132" height="114" viewBox="0 0 132 114" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="gtGlowGrad" cx="50%" cy="52%" r="50%">
          <stop offset="0%" stopColor="#E9C77E" stopOpacity=".55" />
          <stop offset="100%" stopColor="#E9C77E" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="gt-glow" cx="66" cy="60" rx="64" ry="56" fill="url(#gtGlowGrad)" />
      <g className="gt-beat">
        <path className="gt-fill" d={HEART} fill="rgba(210,168,90,0.16)" />
        <path className="gt-draw" d={HEART} pathLength="1" stroke="#B88C3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path className="gt-draw2" d={HEART_IN} pathLength="1" stroke="#C79B48" strokeWidth="1.5" strokeLinecap="round" opacity=".6" />
      </g>
      <path className="gt-spark s1" d={star(112, 18, 7)} fill="#C79B48" />
      <path className="gt-spark s2" d={star(20, 24, 5)} fill="#C79B48" />
      <path className="gt-spark s3" d={star(120, 72, 4)} fill="#C79B48" />
    </svg>
  );
}
const Rule = () => <div className="gt-rule" aria-hidden="true"><i /><s /><i /></div>;
const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flex: "0 0 auto" }}>
    <path d="M7 17L17 7M9 7h8v8" /></svg>);

export function GuestThanksPage({ code }) {
  const [st, setSt] = React.useState({ status: "loading" });
  const [tags, setTags] = React.useState([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState("");   // "" | "ok" | "dup" | "limit"
  const [err, setErr] = React.useState("");
  const [reviews, setReviews] = React.useState([]);
  const doneAt = React.useRef(0);   // кнопки отзывов появляются, когда сердце уже нарисовано, даже если сервер ответил раньше
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
    // v87: светлая страница — светлые поля ввода и полоса браузера в тон бумаги
    try { document.documentElement.style.colorScheme = "light"; const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", GUEST_PAPER.page); } catch (e) {}
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
      if (r && r.ok) { doneAt.current = Date.now(); setDone(r.dup ? "dup" : "ok"); }
      else if (r && r.error === "limit") setDone("limit");
      else if (r && r.error === "not_found") setSt({ status: "gone" });
      else setErr("Не отправилось. Проверьте интернет и попробуйте ещё раз.");
    }).catch(() => { setBusy(false); setErr("Нет связи. Проверьте интернет и попробуйте ещё раз."); });
  };
  const name = st.name || "сотрудник";
  return (
    <div style={shell} data-guest-thanks="">
      <style>{CSS}</style>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div className="gt-mono" aria-hidden="true"><i /><b>SA</b><i /></div>
        {st.status === "loading" ? <div className="gt-card" style={{ textAlign: "center", color: SUB }}>Минуту…</div> : null}
        {st.status === "gone" || st.status === "missing" ? (
          <div className="gt-card gt-in" style={{ textAlign: "center", lineHeight: 1.55 }} data-guest-gone="">
            <div style={{ fontSize: 19, marginBottom: 8 }}>Эта ссылка не работает</div>
            <div style={{ fontSize: 15, color: SUB }}>Попросите у сотрудника новый QR-код. Спасибо, что хотели поблагодарить.</div>
          </div>) : null}
        {st.status === "offline" ? (
          <div className="gt-card gt-in" style={{ textAlign: "center", lineHeight: 1.55 }}>
            <div style={{ fontSize: 17, marginBottom: 8 }}>Нет связи</div>
            <div style={{ fontSize: 15, color: SUB }}>Проверьте интернет и откройте ссылку ещё раз.</div>
          </div>) : null}
        {st.status === "ok" && done ? (
          <div className="gt-card" style={{ textAlign: "center", lineHeight: 1.55 }} data-guest-done={done}>
            <DrawnHeart />
            <div className="gt-after">
              <div style={{ fontSize: 23, margin: "8px 0 8px" }}>{done === "ok" ? "Спасибо передано" : done === "dup" ? "Спасибо уже отправлено" : "Спасибо, что хотели поблагодарить"}</div>
              <div style={{ fontSize: 15.5, color: SUB }}>
                {done === "ok" ? name + " увидит его в приложении. Будем рады видеть вас снова."
                  : done === "dup" ? "С этого телефона его отправляли сегодня. " + name + " увидит его в приложении."
                  : "Сегодня спасибо для этого сотрудника уже очень много. Мы передадим и ваше на словах."}
              </div>
              {st.restaurant ? <div style={{ ...label, marginTop: 16 }}>{st.restaurant}</div> : null}
            </div>
            {reviews.length ? <div className="gt-in" data-guest-reviews="" style={{ marginTop: 6, animationDelay: Math.max(0, 1500 - (Date.now() - doneAt.current)) + "ms" }}>
              <Rule />
              <div style={{ fontSize: 14.5, color: SUB, marginBottom: 6 }}>Если хотите, расскажите о нас другим:</div>
              {reviews.map((r) => <a key={r.kind} className="gt-review" href={r.url} target="_blank" rel="noopener noreferrer" data-guest-review={r.kind}><span>{r.label}</span><Arrow /></a>)}
            </div> : null}
          </div>) : null}
        {st.status === "ok" && !done ? (
          <div className="gt-card gt-in" data-guest-form="">
            {st.restaurant ? <div style={{ ...label, textAlign: "center" }}>{st.restaurant}</div> : null}
            <div style={{ textAlign: "center", fontSize: 31, margin: "8px 0 2px", color: INK, letterSpacing: 0.2 }} data-guest-name="">{name}</div>
            {st.pos ? <div style={{ textAlign: "center", fontSize: 14.5, color: SUB }}>{st.pos}</div> : null}
            <Rule />
            <div style={{ ...label, marginBottom: 10 }}>За что спасибо?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }} role="group" aria-label="За что спасибо">
              {THANKS_TAGS.map(([k, t]) => <button key={k} type="button" className="gt-tag" aria-pressed={tags.includes(k)} data-guest-tag={k} onClick={() => toggle(k)}>{t}</button>)}
            </div>
            <label style={{ display: "block" }}>
              <span style={{ ...label, display: "block", marginBottom: 6 }}>Пара слов (по желанию)</span>
              <textarea className="gt-text" value={text} maxLength={THANKS_TEXT_MAX} rows={3} onChange={(e) => setText(e.target.value)} data-guest-text=""
                placeholder="Например: спасибо за совет с вином" />
            </label>
            {err ? <div role="alert" style={{ fontSize: 14, color: "#A0412F", marginTop: 8, lineHeight: 1.45 }}>{err}</div> : null}
            <button type="button" className="gt-send" onClick={send} disabled={busy} data-guest-send="">{busy ? "Отправляю…" : "Сказать спасибо"}</button>
            <div style={{ textAlign: "center", fontSize: 13, color: SUB, marginTop: 10 }}>Без регистрации. {name} увидит ваше спасибо в приложении.</div>
          </div>) : null}
        <div style={{ textAlign: "center", fontSize: 12, color: SUB, marginTop: 18, letterSpacing: 0.4 }}>Service Academy</div>
      </div>
    </div>
  );
}
