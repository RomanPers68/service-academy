// ui/intro-video.jsx — v174 (Доп. 499): видео-знакомство в первом уроке роли (ролики — data/intro-videos.js, правила —
// lib/intro-video.js).
//
// Обложка стоит там же, где фото урока (ui/lesson-photo.jsx, LessonCover): первой строкой стеклянной карточки, к её
// краям, на первой карточке урока (лентой — сверху). Касание — ролик на весь экран, как сторис.
//
// v175 (Доп. 500), владелец (18.11) на снимках с телефона отметил кнопки плеера и нижнюю строку обложки: сделать их
// линзами, «да и все выделенное. Иконку плей нужно отцентровать. Видео мы можем сделать титульным? <…> нужно добавить
// возможность перемотки видео, вдруг что-то не услышал».
//   • Линзы. Все кнопки плеера — стекло с золотым ободком, светом сверху и одним кольцом, как у «Радио в дорогу»: крестик,
//     «Читать текстом», «Включить звук», «назад / вперёд на фразу», «Ещё раз», «К тексту урока»; ▶ и ❚❚ — золотая линза,
//     как «Слушать». Нижняя строка обложки — стеклянная капсула: ▶, подпись, длительность. Стекло лежит на тёмной
//     подложке: под ним видео, и без неё значки терялись бы на светлом кадре.
//   • ▶ по центру: треугольник нарисован так, что его центр тяжести — в центре кружка, без сдвига отступом.
//   • Видео первым экраном: урок открыли с начала, а ролик ещё не досмотрен и «Читать текстом» не выбрано — ролик сразу на
//     весь экран (lib/intro-video.js, introFirst). Сверху «Читать текстом» — к тексту урока. Звук: если телефон даёт
//     включить видео со звуком без отдельного касания — со звуком, нет — без звука (титры в кадре) и «Включить звук»
//     посередине; не дал и так — ▶. Что выбрал человек, помнится: досмотрел или ушёл к тексту — дальше урок открывается
//     текстом, видео — на обложке.
//   • Перемотка: внизу капсула — «назад на фразу», ▶ / ❚❚, «вперёд на фразу» и полоска времени, её можно тянуть пальцем
//     (риски на ней — начала предложений, время — под ней). «Назад на фразу» — к началу предложения, которое звучит, а
//     если оно только началось — к предыдущему: не расслышал — одно касание.
//
// iPhone (и Telegram на нём) включает видео со звуком только прямо из касания. Поэтому из обложки плеер встаёт на экран
// в самом обработчике касания (flushSync), и play() зовётся там же. «Назад» Telegram и Escape закрывают видео, а не урок:
// у кнопки закрытия data-sa-back (lib/utils.js, clickScreenBack ищет её в слоях поверх приложения первой).
import React from "react";
import { createPortal, flushSync } from "react-dom";
import { vibrate } from "../lib/utils";
import { introVideoOf, fmtDur, durWords } from "../data/intro-videos";
import { cueBack, cueNext, soundFrom, introFirst, markIntroSeen, coverPos } from "../lib/intro-video";

const SERIF = "Georgia, 'Times New Roman', serif";
const GOLD = "#E8C983", GOLD2 = "#C8A96E", CREAM = "#F4E9CF";
// линзы на тёмной подложке (как «Линза» в ui/home-look.jsx и радио, но всегда тёмные: под ними кадр видео)
const DARK = "rgba(16,12,7,0.62)";
const SOFT_RIM = "inset 0 0 0 1px rgba(214,178,102,0.45), inset 0 1.5px 0 rgba(255,255,255,0.18)";
export const LENS = {
  disc: { background: "radial-gradient(circle at 50% 28%, rgba(232,201,131,0.16), rgba(200,169,110,0.07) 70%), " + DARK,
    boxShadow: "inset 0 0 0 1px rgba(214,178,102,0.55), inset 0 0 12px rgba(255,230,170,0.12), inset 0 1.5px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.35)",
    color: GOLD, WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)" },
  play: { background: "radial-gradient(circle at 50% 28%, rgba(240,214,150,0.42), rgba(200,169,110,0.18) 62%, rgba(200,169,110,0.1)), " + DARK,
    boxShadow: "inset 0 0 0 1px rgba(232,201,131,0.8), inset 0 0 18px rgba(255,230,170,0.14), inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -12px 18px -10px rgba(232,197,106,0.5), 0 8px 20px rgba(0,0,0,0.4)",
    color: GOLD, WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)" },
  main: { background: "radial-gradient(120% 160% at 50% 0%, rgba(232,201,131,0.26), rgba(200,169,110,0.12) 62%), " + DARK,
    boxShadow: "inset 0 0 0 1px rgba(214,178,102,0.6), inset 0 0 18px rgba(255,230,170,0.12), inset 0 1.5px 0 rgba(255,255,255,0.2), 0 4px 14px rgba(0,0,0,0.32)",
    color: GOLD, fontWeight: "bold", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)" },
  soft: { background: "radial-gradient(120% 160% at 50% 0%, rgba(232,201,131,0.12), rgba(200,169,110,0.06) 62%), " + DARK,
    boxShadow: SOFT_RIM + ", 0 4px 12px rgba(0,0,0,0.3)", color: GOLD, WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)" },
  tag: { background: "rgba(200,169,110,0.1)", boxShadow: SOFT_RIM, color: CREAM },
  panel: { background: "radial-gradient(120% 80px at 20% 0%, rgba(214,178,102,0.12), transparent 60%), rgba(16,12,7,0.66)",
    boxShadow: "inset 0 0 0 1px rgba(214,178,102,0.34), inset 0 1.5px 0 rgba(255,255,255,0.16), inset 0 0 22px rgba(255,248,230,0.06), 0 6px 18px rgba(0,0,0,0.45)",
    WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)" },
};
// кольцо вокруг линзы — одно, как у кнопок радио (ui/home-look.jsx: .tb-radio, ::after); у золотой ▶ — заметнее
const Ring = ({ inset = -3.5, gold = false }) => (
  <span aria-hidden="true" data-lens-ring="" style={{ position: "absolute", inset, borderRadius: 999, border: "1px solid " + (gold ? "rgba(214,178,102,0.55)" : "rgba(214,178,102,0.44)"), pointerEvents: "none" }} />
);

// ▶: центр тяжести треугольника — ровно в центре (12, 12), поэтому кружку отступ не нужен
export const PlayIcon = ({ s = 24, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" data-play-ic="">
    <path d="M8.6 6.9v10.2c0 .7.8 1.1 1.4.7l8.2-5.1c.6-.4.6-1.2 0-1.6L10 6.2c-.6-.4-1.4 0-1.4.7z" fill={c} />
  </svg>
);
const PauseIcon = ({ s = 24, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true"><rect x="6.6" y="5.5" width="3.8" height="13" rx="1.3" fill={c} /><rect x="13.6" y="5.5" width="3.8" height="13" rx="1.3" fill={c} /></svg>
);
const XIcon = ({ s = 20, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
);
const TextIcon = ({ s = 17, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 6.5h14M5 11h14M5 15.5h9" /></svg>
);
const SoundIcon = ({ s = 18, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 9.5h3.2L12 5.8v12.4l-4.3-3.7H4.5z" fill={c} stroke="none" /><path d="M15.5 9.2a4 4 0 0 1 0 5.6" /><path d="M18 6.8a7.5 7.5 0 0 1 0 10.4" />
  </svg>
);
// «назад / вперёд на фразу»: круговая стрелка
const PhraseIcon = ({ s = 22, c = "currentColor", fwd = false }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={fwd ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M5.6 9.2A7 7 0 1 1 5 13" /><path d="M5.2 4.9v4.6h4.6" /><path d="M10.6 12h3.4" />
  </svg>
);
const AgainIcon = ({ s = 18, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.6 12a7.4 7.4 0 1 0 2.2-5.2" /><path d="M5 3.8v4.6h4.6" />
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

// на сервере (проверки) раскладки нет — там обычный эффект, без предупреждения React
const useLayout = typeof document !== "undefined" && typeof document.createElement === "function" ? React.useLayoutEffect : React.useEffect;
const tryPlay = (v) => { try { const p = v.play(); return p && typeof p.then === "function" ? p : Promise.resolve(); } catch (e) { return Promise.reject(e); } };
const playSafe = (v) => { tryPlay(v).catch(() => {}); };

/**
 * Обложка видео-знакомства в карточке урока (нет ролика у урока — ничего).
 * autoOpen — урок открыли с начала: ролик может встать первым экраном (lib/intro-video.js, introFirst); uk — чей телефон.
 */
export function IntroVideoCover({ lessonId, a11y = false, autoOpen = false, uk = "" }) {
  const video = introVideoOf(lessonId);
  const [mode, setMode] = React.useState(null);   // null | "view" — из обложки | "title" — первым экраном
  const elRef = React.useRef(null);
  const ensureEl = () => { if (!elRef.current) elRef.current = makeIntroVideoEl(video); return elRef.current; };
  // видео первым экраном — в той же отрисовке, что и урок: так play() ещё идёт от касания, которым урок открыли
  useLayout(() => {
    setMode(null);
    if (!video || !introFirst(lessonId, autoOpen, uk) || !ensureEl()) return;
    setMode("title");
  }, [lessonId]);   // eslint-disable-line react-hooks/exhaustive-deps
  // ушли из урока — ролик больше не качаем
  React.useEffect(() => () => {
    const v = elRef.current;
    elRef.current = null;
    if (v) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) { /* */ } }
  }, [lessonId]);
  const closePlayer = React.useCallback((how) => {
    if (how === "end" || how === "text") markIntroSeen(lessonId, how, uk);
    setMode(null);
    // v175: закрыли — ролик дальше не качаем (особенно после «Читать текстом»); снова откроют — новый, с начала
    const v = elRef.current;
    elRef.current = null;
    if (v) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) { /* */ } }
  }, [lessonId, uk]);
  if (!video) return null;
  const start = (e) => {
    if (e) e.stopPropagation();
    vibrate("light");
    const v = ensureEl();
    if (!v) return;
    flushSync(() => setMode("view"));   // плеер уже на экране, ролик — у него
    try { v.muted = false; if (v.currentTime > 0) v.currentTime = 0; } catch (err) { /* */ }
    playSafe(v);                        // всё ещё внутри касания
  };
  return (<>
    <div data-intro-cover={video.role} data-lens-dark="" role="button" tabIndex={0} aria-label={"Смотреть видео-знакомство, " + durWords(video.dur)}
      onClick={start} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(e); } }}
      style={{ position: "relative", display: "block", margin: "-20px -18px 16px", borderRadius: "21px 21px 0 0", overflow: "hidden", cursor: "pointer",
        height: "clamp(230px, 72vw, 310px)", background: "#1B150D", WebkitTapHighlightColor: "transparent" }}>
      {/* кадр — так, чтобы лицо было над капсулой (у каждого ролика своё место лица — face в data/intro-videos.js) */}
      <img src={video.poster} alt="" draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: coverPos(video), display: "block", userSelect: "none", WebkitTouchCallout: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "46%", pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(14,11,6,0) 0%, rgba(14,11,6,0.45) 60%, rgba(14,11,6,0.7) 100%)" }} />
      {/* нижняя строка — стеклянная капсула: ▶ (золотая линза), подпись, длительность */}
      <div aria-hidden="true" data-intro-bar="" style={{ position: "absolute", left: 12, right: 12, bottom: 12, display: "flex", alignItems: "center", gap: 12,
        padding: "7px 10px 7px 7px", borderRadius: 999, ...LENS.panel }}>
        <span data-intro-play="" style={{ position: "relative", flexShrink: 0, width: 46, height: 46, borderRadius: "50%", display: "grid", placeItems: "center", ...LENS.play }}>
          <PlayIcon s={22} /><Ring inset={-4} gold />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SERIF, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: GOLD2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Видео-знакомство</div>
          <div style={{ fontFamily: SERIF, fontSize: a11y ? 17 : 16, fontWeight: "bold", lineHeight: 1.2, color: CREAM, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>С чего начинается роль</div>
        </div>
        <span data-intro-dur="" style={{ flexShrink: 0, fontFamily: SERIF, fontSize: 13, padding: "4px 10px", borderRadius: 999, ...LENS.tag }}>{fmtDur(video.dur)}</span>
      </div>
    </div>
    {mode && elRef.current ? <IntroPlayer video={video} el={elRef.current} mode={mode} onClose={closePlayer} /> : null}
  </>);
}

/**
 * Ролик на весь экран. el — <video> урока (плеер ставит его к себе). mode: "view" — открыли с обложки (play() уже
 * позван из касания), "title" — первым экраном урока (play() здесь: со звуком, не дали — без звука, не дали и так — ▶).
 * onClose(how): "end" — досмотрел, "text" — ушёл к тексту, "close" — закрыл ролик, открытый с обложки.
 */
export function IntroPlayer({ video, el, mode = "view", onClose }) {
  const title = mode === "title";
  const stageRef = React.useRef(null);
  const trackRef = React.useRef(null);   // сама полоска: по ней — куда перематывать
  const seekRef = React.useRef(null);    // ползунок для экранного диктора: сколько из скольки
  const fillRef = React.useRef(null);
  const knobRef = React.useRef(null);
  const nowRef = React.useRef(null);
  const xRef = React.useRef(null);
  const drag = React.useRef(null);
  const endedOnce = React.useRef(false);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const [st, setSt] = React.useState({ playing: false, waiting: false, ended: false, failed: false, muted: false });
  const dur = () => (el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : video.dur || 1);
  const close = React.useCallback((how) => {
    vibrate("light");
    try { el.pause(); } catch (err) { /* */ }
    onCloseRef.current(endedOnce.current ? "end" : how);
  }, [el]);
  useLayout(() => {
    const stage = stageRef.current;
    if (!stage || !el) return undefined;
    let live = true;
    stage.appendChild(el);
    const sync = () => {
      if (!live) return;
      if (el.ended) endedOnce.current = true;
      setSt({ playing: !el.paused && !el.ended, waiting: !el.paused && !el.ended && el.readyState < 3, ended: !!el.ended, failed: !!el.error, muted: !!el.muted });
    };
    const evs = ["play", "playing", "pause", "waiting", "canplay", "canplaythrough", "ended", "error", "loadeddata", "seeked", "volumechange"];
    evs.forEach((n) => el.addEventListener(n, sync));
    if (title) {
      // первым экраном: со звуком; телефон не дал — без звука (титры в кадре) и «Включить звук»; не дал и так — ▶
      try { el.muted = false; } catch (e) { /* */ }
      tryPlay(el).catch(() => { if (!live) return; try { el.muted = true; } catch (e) { /* */ } tryPlay(el).catch(() => {}).then(sync); });
    }
    sync();
    // время и полоска — каждый кадр, без перерисовки React
    let raf = 0, shown = -1;
    const tick = () => {
      if (!drag.current) {
        const f = Math.min(1, (el.currentTime || 0) / dur());
        if (fillRef.current) fillRef.current.style.width = (f * 100).toFixed(2) + "%";
        if (knobRef.current) knobRef.current.style.left = (f * 100).toFixed(2) + "%";
      }
      const s = Math.floor(el.currentTime || 0);
      if (s !== shown && nowRef.current) {
        shown = s;
        nowRef.current.textContent = fmtDur(s);
        if (seekRef.current) { seekRef.current.setAttribute("aria-valuenow", String(s)); seekRef.current.setAttribute("aria-valuetext", fmtDur(s) + " из " + fmtDur(dur())); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const key = (ev) => {
      if (ev.key === "Escape") { ev.stopPropagation(); ev.stopImmediatePropagation(); close(title ? "text" : "close"); }
    };
    window.addEventListener("keydown", key, true);
    const prev = document.activeElement;
    try { if (xRef.current) xRef.current.focus({ preventScroll: true }); } catch (e) { /* */ }
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", key, true);
      evs.forEach((n) => el.removeEventListener(n, sync));
      try { el.pause(); } catch (e) { /* */ }
      if (el.parentNode === stage) stage.removeChild(el);
      try { if (prev && prev !== document.body && typeof prev.focus === "function" && document.contains(prev)) prev.focus({ preventScroll: true }); } catch (e) { /* */ }
    };
  }, [el, video, close, title]);   // eslint-disable-line react-hooks/exhaustive-deps

  const seekTo = (t, smooth = false) => {
    const to = Math.max(0, Math.min(dur() - 0.05, t));
    try { if (smooth && typeof el.fastSeek === "function") el.fastSeek(to); else el.currentTime = to; } catch (e) { /* */ }
    const f = to / dur();
    if (fillRef.current) fillRef.current.style.width = (f * 100).toFixed(2) + "%";
    if (knobRef.current) knobRef.current.style.left = (f * 100).toFixed(2) + "%";
    if (nowRef.current) nowRef.current.textContent = fmtDur(Math.floor(to));
  };
  const unmute = () => {
    try { el.muted = false; } catch (e) { /* */ }
    seekTo(soundFrom(video.cues, el.currentTime || 0));
    playSafe(el);
  };
  const toggle = (e) => {
    if (e) e.stopPropagation();
    if (st.failed) return;
    if (st.ended || el.paused) {
      if (el.muted) { try { el.muted = false; } catch (err) { /* */ } }
      if (st.ended) seekTo(0);
      playSafe(el);
    } else el.pause();
  };
  // касание по видео: без звука — включить звук; иначе пауза и дальше
  const stageTap = (e) => { e.stopPropagation(); if (st.ended || st.failed) return; if (st.muted) unmute(); else toggle(); };
  const phrase = (dir) => (e) => {
    if (e) e.stopPropagation();
    vibrate("light");
    const t = el.currentTime || 0;
    const to = dir < 0 ? cueBack(video.cues, t) : cueNext(video.cues, t);
    if (to == null) return;
    seekTo(to);
    if (el.paused && !st.ended) playSafe(el);
  };
  const again = (e) => {
    if (e) e.stopPropagation();
    vibrate("light");
    try { if (st.failed) { el.src = video.src; el.load(); } el.muted = false; } catch (err) { /* */ }
    seekTo(0);
    playSafe(el);
  };
  // полоска времени: тянуть пальцем, касание — сразу туда
  const at = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width))) * dur();
  };
  const onDown = (e) => {
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    drag.current = { last: 0 };
    seekTo(at(e.clientX), true);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const now = Date.now();
    if (now - drag.current.last < 60) return;
    drag.current.last = now;
    seekTo(at(e.clientX), true);
  };
  const onUp = (e) => {
    if (!drag.current) return;
    e.stopPropagation();
    drag.current = null;
    seekTo(at(e.clientX));
    if (st.ended) playSafe(el);
  };
  const onSeekKey = (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); seekTo((el.currentTime || 0) - 5); }
    else if (e.key === "ArrowRight") { e.preventDefault(); seekTo((el.currentTime || 0) + 5); }
  };
  const keep = (e) => e.stopPropagation();   // касания в плеере не уходят в урок под ним (портал — потомок урока в React)
  const top = "var(--sa-st, env(safe-area-inset-top, 0px))";
  const bottom = "env(safe-area-inset-bottom, 0px)";
  const pill = { position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, padding: "0 18px", borderRadius: 999, border: 0,
    fontFamily: SERIF, fontSize: 15.5, cursor: "pointer", whiteSpace: "nowrap" };
  const disc = (s) => ({ position: "relative", width: s, height: s, borderRadius: "50%", border: 0, padding: 0, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 });
  const state = st.failed ? "failed" : st.ended ? "ended" : st.playing ? (st.waiting ? "waiting" : "playing") : "paused";
  const cues = (video.cues || []).filter((x) => x > 0.5 && x < (video.dur || 1) - 0.5);
  const body = (
    <div data-intro-player={video.role} data-intro-mode={mode} data-intro-state={state} data-intro-muted={st.muted ? "1" : undefined} data-lens-dark=""
      role="dialog" aria-modal="true" aria-label="Видео-знакомство" className="sa-fadein"
      onClick={keep} onTouchStart={keep} onTouchEnd={keep}
      style={{ position: "fixed", inset: 0, zIndex: 9700, background: "#000", touchAction: "manipulation", overscrollBehavior: "contain", WebkitTapHighlightColor: "transparent", userSelect: "none" }}>
      <div ref={stageRef} data-intro-stage="" onClick={stageTap} style={{ position: "absolute", inset: 0 }} />
      {/* закрыть: первым экраном — «Читать текстом», с обложки — крестик */}
      {title ? (
        <button ref={xRef} type="button" data-sa-back="" data-intro-x="text" aria-label="Читать текстом" onClick={(e) => { e.stopPropagation(); close("text"); }}
          style={{ ...pill, position: "absolute", top: "calc(" + top + " + 12px)", right: 12, minHeight: 40, padding: "0 16px 0 13px", fontSize: 15, ...LENS.soft }}>
          <TextIcon />Читать текстом<Ring />
        </button>
      ) : (
        <button ref={xRef} type="button" data-sa-back="" data-intro-x="close" aria-label="Закрыть" onClick={(e) => { e.stopPropagation(); close("close"); }}
          style={{ ...disc(44), position: "absolute", top: "calc(" + top + " + 12px)", right: 12, ...LENS.disc }}><XIcon /><Ring /></button>
      )}
      {state === "paused" ? (
        <button type="button" data-intro-resume="" aria-label="Смотреть" onClick={toggle}
          style={{ ...disc(78), position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", ...LENS.play }}><PlayIcon s={34} /><Ring inset={-5} gold /></button>
      ) : null}
      {state === "waiting" ? (
        <div aria-hidden="true" data-intro-wait="" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }}><Spinner /></div>
      ) : null}
      {st.muted && state === "playing" ? (
        <button type="button" data-intro-sound="" onClick={(e) => { e.stopPropagation(); vibrate("light"); unmute(); }}
          style={{ ...pill, position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", minHeight: 48, padding: "0 20px 0 16px", ...LENS.main }}>
          <SoundIcon />Включить звук<Ring />
        </button>
      ) : null}
      {state === "ended" || state === "failed" ? (
        <div data-intro-end={state} onClick={keep}
          style={{ position: "absolute", left: 12, right: 12, bottom: "calc(" + bottom + " + 86px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          {state === "failed" ? (
            <div style={{ fontFamily: SERIF, fontSize: 15, lineHeight: 1.45, color: "#EFE4C8", textAlign: "center", padding: "8px 14px", borderRadius: 14, ...LENS.panel }}>
              Видео не загрузилось. Проверь связь и попробуй ещё раз.</div>
          ) : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" data-intro-again="" onClick={again} style={{ ...pill, ...LENS.soft }}><AgainIcon />Ещё раз<Ring /></button>
            <button type="button" data-intro-done="" onClick={(e) => { e.stopPropagation(); close(st.ended ? "end" : title ? "text" : "close"); }}
              style={{ ...pill, ...LENS.main }}>К тексту урока<Ring /></button>
          </div>
        </div>
      ) : null}
      {/* внизу: назад на фразу, ▶ / ❚❚, вперёд на фразу и полоска времени (время — под ней: полоске — вся ширина, что осталась) */}
      <div data-intro-controls="" onClick={keep}
        style={{ position: "absolute", left: 10, right: 10, bottom: "calc(" + bottom + " + 10px)", display: "flex", alignItems: "center", gap: 11,
          padding: "6px 16px 6px 8px", borderRadius: 999, ...LENS.panel }}>
        <button type="button" data-intro-back="" aria-label="Назад на фразу" onClick={phrase(-1)} style={{ ...disc(40), ...LENS.disc }}><PhraseIcon /><Ring /></button>
        <button type="button" data-intro-toggle="" aria-label={st.playing ? "Пауза" : "Смотреть"} onClick={toggle} style={{ ...disc(48), ...LENS.play }}>
          {st.playing ? <PauseIcon s={22} /> : <PlayIcon s={24} />}<Ring inset={-4} gold /></button>
        <button type="button" data-intro-next="" aria-label="Вперёд на фразу" onClick={phrase(1)} style={{ ...disc(40), ...LENS.disc }}><PhraseIcon fwd /><Ring /></button>
        {/* полоска: ловит касание по всей высоте капсулы, тянуть — пальцем */}
        <div ref={seekRef} data-intro-seek="" role="slider" tabIndex={0} aria-label="Перемотка" aria-valuemin={0} aria-valuemax={Math.round(video.dur || 1)}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onSeekKey}
          style={{ position: "relative", flex: 1, minWidth: 60, height: 48, marginLeft: 2, cursor: "pointer", touchAction: "none", outline: "none" }}>
          <div ref={trackRef} aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 9, height: 20 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 4, marginTop: -2, borderRadius: 2, background: "rgba(244,233,207,0.22)" }} />
            {cues.map((c) => (
              <i key={c} data-intro-cue="" style={{ position: "absolute", top: "50%", left: (c / (video.dur || 1) * 100).toFixed(2) + "%", width: 2, height: 8, marginTop: -4, marginLeft: -1,
                borderRadius: 1, background: "rgba(232,201,131,0.45)" }} />
            ))}
            <div ref={fillRef} data-intro-fill="" style={{ position: "absolute", left: 0, top: "50%", height: 4, marginTop: -2, width: "0%", borderRadius: 2,
              background: "linear-gradient(90deg, #C8A96E, #F1DBA4)" }} />
            <div ref={knobRef} data-intro-knob="" style={{ position: "absolute", top: "50%", left: "0%", width: 14, height: 14, marginTop: -7, marginLeft: -7, borderRadius: "50%",
              background: "#F1DBA4", boxShadow: "0 0 0 3px rgba(232,201,131,0.25), 0 2px 6px rgba(0,0,0,0.5)" }} />
          </div>
          <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 3, display: "flex", justifyContent: "space-between",
            fontFamily: SERIF, fontSize: 11.5, lineHeight: "14px", fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}>
            <span ref={nowRef} data-intro-now="" style={{ color: CREAM }}>0:00</span>
            <span data-intro-total="" style={{ color: "rgba(244,233,207,0.7)" }}>{fmtDur(video.dur)}</span>
          </div>
        </div>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(body, document.body) : null;
}
