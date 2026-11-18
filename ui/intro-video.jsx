// ui/intro-video.jsx — v174 (Доп. 499): видео-знакомство в первом уроке роли (ролики и длительность — data/intro-videos.js).
//
// Обложка ставится туда же, где фото урока (ui/lesson-photo.jsx, LessonCover): первой строкой стеклянной карточки, к её
// краям, на первой карточке урока (лентой — сверху). На обложке кадр ролика, ▶ и длительность. Касание — ролик на весь
// экран, как сторис: вертикальное видео целиком на чёрном, сверху полоска времени и «закрыть», касание по видео — пауза
// и снова дальше, в конце — «Ещё раз» и «К уроку». «Назад» Telegram и Escape закрывают видео, а не урок: у крестика
// data-sa-back (lib/utils.js, clickScreenBack ищет его в слоях поверх приложения первым).
//
// iPhone (и Telegram на нём) включает видео со звуком только прямо из касания. Поэтому плеер ставится на экран сразу
// в обработчике касания (flushSync), и там же зовём play(). Пока обложку не нажали, ролик не грузится вовсе: только
// кадр-обложка, 70–110 КБ. Листать карточки урока можно и с обложки: касание без сдвига — видео, сдвиг — карточка.
import React from "react";
import { createPortal, flushSync } from "react-dom";
import { vibrate } from "../lib/utils";
import { introVideoOf, fmtDur, durWords } from "../data/intro-videos";

const SERIF = "Georgia, 'Times New Roman', serif";
const GOLD = "#E8C983";
const GLASS = { background: "rgba(20,15,8,0.55)", boxShadow: "inset 0 0 0 1px rgba(232,201,131,0.55), 0 4px 14px rgba(0,0,0,0.35)",
  WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)" };

const PlayIcon = ({ s = 26, c = GOLD }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 5.4v13.2c0 .8.9 1.3 1.6.9l10.3-6.6c.6-.4.6-1.3 0-1.7L9.8 4.6c-.7-.5-1.6 0-1.6.8z" fill={c} /></svg>
);
const XIcon = ({ s = 20, c = GOLD }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
const AgainIcon = ({ s = 18, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4.6h4.6" />
  </svg>
);
const Spinner = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
    <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(232,201,131,0.25)" strokeWidth="3" />
    <path d="M22 4a18 18 0 0 1 18 18" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" from="0 22 22" to="360 22 22" dur="0.9s" repeatCount="indefinite" />
    </path>
  </svg>
);

/** Новый <video> для ролика: без своих кнопок, внутри страницы (без системного плеера iPhone) */
export function makeIntroVideoEl(video) {
  if (typeof document === "undefined" || !video) return null;
  const v = document.createElement("video");
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");
  v.setAttribute("preload", "auto");
  v.setAttribute("data-intro-el", video.role || "");
  v.playsInline = true;
  v.poster = video.poster;
  v.src = video.src;
  Object.assign(v.style, { width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#000" });
  return v;
}

const playSafe = (v) => { try { const p = v.play(); if (p && typeof p.catch === "function") p.catch(() => {}); } catch (e) { /* */ } };

/** Обложка видео-знакомства в карточке урока (нет ролика у урока — ничего) */
export function IntroVideoCover({ lessonId, a11y = false }) {
  const video = introVideoOf(lessonId);
  const [open, setOpen] = React.useState(false);
  const elRef = React.useRef(null);
  // ушли из урока — ролик больше не качаем
  React.useEffect(() => () => {
    const v = elRef.current;
    elRef.current = null;
    if (v) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) { /* */ } }
  }, [lessonId]);
  const closePlayer = React.useCallback(() => setOpen(false), []);
  if (!video) return null;
  const start = (e) => {
    if (e) e.stopPropagation();
    vibrate("light");
    let v = elRef.current;
    if (!v) { v = makeIntroVideoEl(video); elRef.current = v; }
    if (!v) return;
    flushSync(() => setOpen(true));   // плеер уже на экране, ролик — у него
    try { if (v.currentTime > 0) v.currentTime = 0; } catch (err) { /* */ }
    playSafe(v);                       // всё ещё внутри касания
  };
  return (<>
    <div data-intro-cover={video.role} role="button" tabIndex={0} aria-label={"Смотреть видео-знакомство, " + durWords(video.dur)}
      onClick={start} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(e); } }}
      style={{ position: "relative", display: "block", margin: "-20px -18px 16px", borderRadius: "21px 21px 0 0", overflow: "hidden", cursor: "pointer",
        height: "clamp(210px, 66vw, 300px)", background: "#1B150D", WebkitTapHighlightColor: "transparent" }}>
      <img src={video.poster} alt="" draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 6%", display: "block", userSelect: "none", WebkitTouchCallout: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "58%", pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(14,11,6,0) 0%, rgba(14,11,6,0.55) 48%, rgba(14,11,6,0.86) 100%)" }} />
      <div aria-hidden="true" style={{ position: "absolute", left: 14, right: 14, bottom: 13, display: "flex", alignItems: "center", gap: 12 }}>
        {/* ▶ внизу, рядом с подписью: лицо на кадре остаётся открытым */}
        <span data-intro-play="" style={{ flexShrink: 0, width: 48, height: 48, borderRadius: "50%", display: "grid", placeItems: "center", paddingLeft: 3, boxSizing: "border-box",
          ...GLASS, boxShadow: "inset 0 0 0 1.5px rgba(232,201,131,0.8), 0 0 0 5px rgba(232,201,131,0.12), 0 6px 18px rgba(0,0,0,0.45)" }}>
          <PlayIcon s={22} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SERIF, fontSize: 11.5, letterSpacing: 1.4, textTransform: "uppercase", color: GOLD, opacity: 0.92 }}>Видео-знакомство</div>
          <div style={{ fontFamily: SERIF, fontSize: a11y ? 18.5 : 17.5, fontWeight: "bold", lineHeight: 1.2, color: "#F4E9CF", marginTop: 2, textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}>С чего начинается роль</div>
        </div>
        <span data-intro-dur="" style={{ flexShrink: 0, alignSelf: "flex-end", fontFamily: SERIF, fontSize: 13, color: "#F4E9CF", padding: "3px 9px", borderRadius: 999,
          background: "rgba(20,15,8,0.6)", boxShadow: "inset 0 0 0 1px rgba(232,201,131,0.45)" }}>{fmtDur(video.dur)}</span>
      </div>
    </div>
    {open && elRef.current ? <IntroPlayer video={video} el={elRef.current} onClose={closePlayer} /> : null}
  </>);
}

/** Ролик на весь экран. el — <video> из касания по обложке (плеер ставит его к себе) */
export function IntroPlayer({ video, el, onClose }) {
  const stageRef = React.useRef(null);
  const barRef = React.useRef(null);
  const xRef = React.useRef(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const [st, setSt] = React.useState({ playing: false, waiting: false, ended: false, failed: false });
  const close = React.useCallback((e) => {
    if (e) e.stopPropagation();
    vibrate("light");
    try { el.pause(); } catch (err) { /* */ }
    onCloseRef.current();
  }, [el]);
  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !el) return undefined;
    stage.appendChild(el);
    const sync = () => setSt({ playing: !el.paused && !el.ended, waiting: !el.paused && !el.ended && el.readyState < 3, ended: !!el.ended, failed: !!el.error });
    const evs = ["play", "playing", "pause", "waiting", "canplay", "canplaythrough", "ended", "error", "loadeddata", "seeked"];
    evs.forEach((n) => el.addEventListener(n, sync));
    sync();
    let raf = 0;
    const tick = () => {
      const d = el.duration || video.dur || 1;
      if (barRef.current) barRef.current.style.transform = "scaleX(" + Math.min(1, (el.currentTime || 0) / d).toFixed(4) + ")";
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Escape закрывает только видео: слушаем первыми и дальше не пускаем
    const key = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); ev.stopImmediatePropagation(); close(); } };
    window.addEventListener("keydown", key, true);
    const prev = document.activeElement;
    try { if (xRef.current) xRef.current.focus({ preventScroll: true }); } catch (e) { /* */ }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", key, true);
      evs.forEach((n) => el.removeEventListener(n, sync));
      try { el.pause(); } catch (e) { /* */ }
      if (el.parentNode === stage) stage.removeChild(el);
      try { if (prev && prev !== document.body && typeof prev.focus === "function" && document.contains(prev)) prev.focus({ preventScroll: true }); } catch (e) { /* */ }
    };
  }, [el, video, close]);
  const toggle = (e) => {
    if (e) e.stopPropagation();
    if (st.ended || st.failed) return;
    if (el.paused) playSafe(el); else el.pause();
  };
  const again = (e) => {
    if (e) e.stopPropagation();
    vibrate("light");
    try { if (st.failed) { el.src = video.src; el.load(); } el.currentTime = 0; } catch (err) { /* */ }
    playSafe(el);
  };
  // касания и нажатия в плеере не уходят в урок под ним (портал передаёт события предкам по дереву React)
  const keep = (e) => e.stopPropagation();
  const top = "var(--sa-st, env(safe-area-inset-top, 0px))";
  const btn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 46, padding: "0 22px", borderRadius: 999, border: 0,
    fontFamily: SERIF, fontSize: 16, cursor: "pointer" };
  const state = st.failed ? "failed" : st.ended ? "ended" : st.playing ? (st.waiting ? "waiting" : "playing") : "paused";
  const body = (
    <div data-intro-player={video.role} data-intro-state={state} role="dialog" aria-modal="true" aria-label="Видео-знакомство" className="sa-fadein"
      onClick={keep} onTouchStart={keep} onTouchEnd={keep}
      style={{ position: "fixed", inset: 0, zIndex: 9700, background: "#000", touchAction: "manipulation", overscrollBehavior: "contain", WebkitTapHighlightColor: "transparent" }}>
      <div ref={stageRef} data-intro-stage="" onClick={toggle} style={{ position: "absolute", inset: 0 }} />
      {/* полоска времени, как у сторис */}
      <div aria-hidden="true" style={{ position: "absolute", left: 12, right: 12, top: "calc(" + top + " + 8px)", height: 3, borderRadius: 2, overflow: "hidden",
        background: "rgba(255,255,255,0.28)", pointerEvents: "none" }}>
        <div ref={barRef} data-intro-bar="" style={{ width: "100%", height: "100%", background: "#F4E9CF", transform: "scaleX(0)", transformOrigin: "0 50%" }} />
      </div>
      <button ref={xRef} type="button" data-sa-back="" data-intro-x="" aria-label="Закрыть" onClick={close}
        style={{ position: "absolute", top: "calc(" + top + " + 20px)", right: 12, width: 44, height: 44, borderRadius: "50%", border: 0, padding: 0, cursor: "pointer",
          display: "grid", placeItems: "center", ...GLASS }}><XIcon /></button>
      {state === "paused" ? (
        <button type="button" data-intro-resume="" aria-label="Смотреть дальше" onClick={toggle}
          style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 76, height: 76, borderRadius: "50%", border: 0, padding: "0 0 0 5px",
            cursor: "pointer", display: "grid", placeItems: "center", ...GLASS, boxShadow: "inset 0 0 0 1.5px rgba(232,201,131,0.75), 0 8px 24px rgba(0,0,0,0.45)" }}><PlayIcon s={32} /></button>
      ) : null}
      {state === "waiting" ? (
        <div aria-hidden="true" data-intro-wait="" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }}><Spinner /></div>
      ) : null}
      {state === "ended" || state === "failed" ? (
        <div data-intro-end={state} onClick={keep}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "40px 20px calc(26px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 10, background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 42%)" }}>
          {state === "failed" ? (
            <div style={{ fontFamily: SERIF, fontSize: 15, lineHeight: 1.45, color: "#EFE4C8", textAlign: "center", marginBottom: 4 }}>Видео не загрузилось. Проверь связь и попробуй ещё раз.</div>
          ) : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" data-intro-again="" onClick={again} style={{ ...btn, ...GLASS, color: GOLD }}><AgainIcon />Ещё раз</button>
            <button type="button" data-intro-done="" onClick={close}
              style={{ ...btn, color: "#24180A", fontWeight: "bold", background: "linear-gradient(172deg,#F1DBA4 0%,#DDBE7F 46%,#BC9A5E 100%)" }}>К уроку</button>
          </div>
        </div>
      ) : null}
    </div>
  );
  return typeof document !== "undefined" ? createPortal(body, document.body) : null;
}
