// ui/intro-video.jsx — v174 (Доп. 499): видео-знакомство в первом уроке роли (ролики — data/intro-videos.js, правила —
// lib/intro-video.js).
//
// Обложка стоит там же, где фото урока (ui/lesson-photo.jsx, LessonCover): первой строкой стеклянной карточки, к её
// краям, на первой карточке урока (лентой — сверху). Касание — ролик на весь экран, как сторис.
//
// v175 (Доп. 500), владелец (18.11) на снимках с телефона: кнопки — линзами, «Иконку плей нужно отцентровать. Видео мы
// можем сделать титульным? <…> нужно добавить возможность перемотки видео, вдруг что-то не услышал».
//   • ▶ по центру: треугольник нарисован так, что его центр тяжести — в центре кружка, без сдвига отступом.
//   • Видео первым экраном: урок открыли с начала, а ролик ещё не досмотрен и «Читать текстом» не выбрано — ролик сразу на
//     весь экран (lib/intro-video.js, introFirst). Сверху «Читать текстом» — к тексту урока. Звук: если телефон даёт
//     включить видео со звуком без отдельного касания — со звуком, нет — без звука (титры в кадре) и «Включить звук»;
//     не дал и так — ▶. Что выбрал человек, помнится: досмотрел или ушёл к тексту — дальше урок открывается текстом.
//   • Перемотка: «назад на фразу» — к началу предложения, которое звучит, а если оно только началось — к предыдущему;
//     «вперёд на фразу»; полоска времени, её можно тянуть пальцем (риски на ней — начала предложений).
//
// v176 (Доп. 501), владелец (18.11) со снимком плеера iPhone: «Давай сделаем линзы без дополнительного обруча, более
// прозрачными. И что бы видео было на весь экран, и после начала, все элементы изчезали, с аккуратной анимацией. И так же
// мне нравился первый твой вариант кнопки запуска и подписи видео. <…> И да, с дополнительной кнопкой динамика».
//   • Кнопки — стекло, как у плеера iPhone: прозрачные, со светлой кромкой и бликом сверху, без колец. Посередине —
//     «назад на фразу», ▶ / ❚❚ и «вперёд на фразу»; внизу — капсула со временем, полоской и сколько осталось; сверху
//     слева — крестик (первым экраном — «Читать текстом»), справа — динамик: выключить и включить звук.
//   • Видео на весь экран: кадр растягивается, пока не закроет экран, но вшитые титры остаются целиком (fillSize).
//   • Ролик пошёл — через 3 с кнопки плавно гаснут (прозрачность и лёгкий сдвиг, 0,35 с); касание по видео — снова на
//     экране, ещё касание — гаснут. На паузе, в конце и пока тянут полоску — на экране.
//   • Обложка в уроке — как в v174: ▶ в тёмном кружке с золотой кромкой, «Видео-знакомство», «С чего начинается роль»,
//     длительность; ▶ — по центру.
//
// iPhone (и Telegram на нём) включает видео со звуком только прямо из касания. Поэтому из обложки плеер встаёт на экран
// в самом обработчике касания (flushSync), и play() зовётся там же. «Назад» Telegram и Escape закрывают видео, а не урок:
// у кнопки закрытия data-sa-back (lib/utils.js, clickScreenBack ищет её в слоях поверх приложения первой).
import React from "react";
import { createPortal, flushSync } from "react-dom";
import { vibrate } from "../lib/utils";
import { introVideoOf, fmtDur, durWords } from "../data/intro-videos";
import { cueBack, cueNext, soundFrom, introFirst, markIntroSeen, coverPos, fillSize } from "../lib/intro-video";

const SERIF = "Georgia, 'Times New Roman', serif";
const GOLD = "#E8C983", CREAM = "#F4E9CF", INK = "#FFFFFF";

// v176: стекло, как у плеера iPhone. bubble — прозрачный пузырь (посередине: ▶ / ❚❚ и фразы), dark — дымчатое стекло
// (крестик, динамик, «Читать текстом», капсула внизу, «Ещё раз»): текст и значки читаются и на светлом кадре
const BLUR = "blur(16px) saturate(180%)";
export const GLASS = {
  bubble: { color: INK, background: "radial-gradient(120% 120% at 50% 0%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 55%, rgba(255,255,255,0.12) 100%)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.24), inset 0 1.5px 1px rgba(255,255,255,0.32), inset 0 -8px 14px -8px rgba(255,255,255,0.2), 0 8px 24px rgba(0,0,0,0.22)",
    WebkitBackdropFilter: BLUR, backdropFilter: BLUR },
  dark: { color: INK, background: "linear-gradient(180deg, rgba(58,54,48,0.42) 0%, rgba(28,26,22,0.42) 100%)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.16), inset 0 1px 0 rgba(255,255,255,0.2), 0 6px 20px rgba(0,0,0,0.25)",
    WebkitBackdropFilter: BLUR, backdropFilter: BLUR },
};
// обложка в уроке (v174): ▶ в тёмном кружке с золотой кромкой и мягким ореолом
const COVER_DISC = { background: "rgba(20,15,8,0.55)", boxShadow: "inset 0 0 0 1.5px rgba(232,201,131,0.8), 0 0 0 5px rgba(232,201,131,0.12), 0 6px 18px rgba(0,0,0,0.45)",
  WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)", color: GOLD };
const shade = { filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))" };

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
// динамик: со звуком — волны, без звука — крестик
const SpeakerIcon = ({ s = 22, c = "currentColor", off = false }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-speaker={off ? "off" : "on"}>
    <path d="M4 9.5h3.4L12 5.6v12.8l-4.6-3.9H4z" fill={c} stroke="none" />
    {off ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <><path d="M15.5 9.2a4 4 0 0 1 0 5.6" /><path d="M18 6.8a7.5 7.5 0 0 1 0 10.4" /></>}
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
const Spinner = ({ s = 40 }) => (
  <svg width={s} height={s} viewBox="0 0 44 44" aria-hidden="true" data-intro-spin="">
    <circle cx="22" cy="22" r="17" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
    <path d="M22 5a17 17 0 0 1 17 17" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round">
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
const calmMotion = () => { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };

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
    <div data-intro-cover={video.role} role="button" tabIndex={0} aria-label={"Смотреть видео-знакомство, " + durWords(video.dur)}
      onClick={start} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(e); } }}
      style={{ position: "relative", display: "block", margin: "-20px -18px 16px", borderRadius: "21px 21px 0 0", overflow: "hidden", cursor: "pointer",
        height: "clamp(230px, 72vw, 310px)", background: "#1B150D", WebkitTapHighlightColor: "transparent" }}>
      {/* кадр — так, чтобы лицо было над нижней строкой (у каждого ролика своё место лица — face в data/intro-videos.js) */}
      <img src={video.poster} alt="" draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: coverPos(video), display: "block", userSelect: "none", WebkitTouchCallout: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "52%", pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(14,11,6,0) 0%, rgba(14,11,6,0.55) 48%, rgba(14,11,6,0.86) 100%)" }} />
      {/* v176: нижняя строка — как в v174: ▶ в тёмном кружке с золотой кромкой, подпись, длительность */}
      <div aria-hidden="true" data-intro-bar="" style={{ position: "absolute", left: 14, right: 14, bottom: 13, display: "flex", alignItems: "center", gap: 12 }}>
        <span data-intro-play="" style={{ flexShrink: 0, width: 48, height: 48, borderRadius: "50%", display: "grid", placeItems: "center", ...COVER_DISC }}>
          <PlayIcon s={22} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SERIF, fontSize: 11.5, letterSpacing: 1.4, textTransform: "uppercase", color: GOLD, opacity: 0.92 }}>Видео-знакомство</div>
          <div style={{ fontFamily: SERIF, fontSize: a11y ? 18.5 : 17.5, fontWeight: "bold", lineHeight: 1.2, color: CREAM, marginTop: 2, textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}>С чего начинается роль</div>
        </div>
        <span data-intro-dur="" style={{ flexShrink: 0, alignSelf: "flex-end", fontFamily: SERIF, fontSize: 13, color: CREAM, padding: "3px 9px", borderRadius: 999,
          background: "rgba(20,15,8,0.6)", boxShadow: "inset 0 0 0 1px rgba(232,201,131,0.45)" }}>{fmtDur(video.dur)}</span>
      </div>
    </div>
    {mode && elRef.current ? <IntroPlayer video={video} el={elRef.current} mode={mode} onClose={closePlayer} /> : null}
  </>);
}

// кнопки гаснут через столько после начала (первый раз — чуть позже: успеть увидеть «Читать текстом») и после касания
export const HIDE_MS = { first: 3200, next: 2600 };

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
  const leftRef = React.useRef(null);
  const xRef = React.useRef(null);
  const drag = React.useRef(null);
  const endedOnce = React.useRef(false);
  const hideT = React.useRef(0);
  const firstHide = React.useRef(true);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const [st, setSt] = React.useState({ playing: false, waiting: false, ended: false, failed: false, muted: false });
  const [ui, setUi] = React.useState(true);          // кнопки на экране
  const [forced, setForced] = React.useState(false); // звук выключил телефон (первым экраном), а не человек
  const calm = React.useMemo(calmMotion, []);
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
    // на весь экран, но вшитые титры — целиком (lib/intro-video.js, fillSize)
    const fit = () => {
      const { w, h } = fillSize(stage.clientWidth, stage.clientHeight, el.videoWidth || 720, el.videoHeight || 1280);
      if (!w || !h) return;
      Object.assign(el.style, { position: "absolute", left: "50%", top: "50%", width: w + "px", height: h + "px", maxWidth: "none",
        transform: "translate(-50%, -50%)", objectFit: "cover" });
    };
    fit();
    const sync = () => {
      if (!live) return;
      if (el.ended) endedOnce.current = true;
      setSt({ playing: !el.paused && !el.ended, waiting: !el.paused && !el.ended && el.readyState < 3, ended: !!el.ended, failed: !!el.error, muted: !!el.muted });
    };
    const evs = ["play", "playing", "pause", "waiting", "canplay", "canplaythrough", "ended", "error", "loadeddata", "seeked", "volumechange"];
    evs.forEach((n) => el.addEventListener(n, sync));
    el.addEventListener("loadedmetadata", fit);
    window.addEventListener("resize", fit);
    if (title) {
      // первым экраном: со звуком; телефон не дал — без звука (титры в кадре) и «Включить звук»; не дал и так — ▶
      try { el.muted = false; } catch (e) { /* */ }
      tryPlay(el).catch(() => {
        if (!live) return;
        try { el.muted = true; } catch (e) { /* */ }
        setForced(true);
        tryPlay(el).catch(() => {}).then(sync);
      });
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
      if (s !== shown) {
        shown = s;
        if (nowRef.current) nowRef.current.textContent = fmtDur(s);
        if (leftRef.current) leftRef.current.textContent = "−" + fmtDur(Math.max(0, Math.round(dur() - (el.currentTime || 0))));
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
      clearTimeout(hideT.current);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", fit);
      el.removeEventListener("loadedmetadata", fit);
      evs.forEach((n) => el.removeEventListener(n, sync));
      try { el.pause(); } catch (e) { /* */ }
      if (el.parentNode === stage) stage.removeChild(el);
      try { if (prev && prev !== document.body && typeof prev.focus === "function" && document.contains(prev)) prev.focus({ preventScroll: true }); } catch (e) { /* */ }
    };
  }, [el, video, close, title]);   // eslint-disable-line react-hooks/exhaustive-deps

  // кнопки гаснут, пока ролик идёт; на паузе, в конце и при ошибке — на экране
  const arm = React.useCallback((ms) => {
    clearTimeout(hideT.current);
    hideT.current = setTimeout(() => { if (!drag.current) setUi(false); }, ms || HIDE_MS.next);
  }, []);
  // ждёт загрузки посреди ролика — кнопки не выскакивают: при спрятанных посередине крутится круг
  React.useEffect(() => {
    if (!st.playing) { clearTimeout(hideT.current); setUi(true); return; }
    if (!st.waiting) { arm(firstHide.current ? HIDE_MS.first : HIDE_MS.next); firstHide.current = false; }
  }, [st.playing, st.waiting, arm]);
  const poke = () => { setUi(true); if (st.playing) arm(); };

  const seekTo = (t, smooth = false) => {
    const to = Math.max(0, Math.min(dur() - 0.05, t));
    try { if (smooth && typeof el.fastSeek === "function") el.fastSeek(to); else el.currentTime = to; } catch (e) { /* */ }
    const f = to / dur();
    if (fillRef.current) fillRef.current.style.width = (f * 100).toFixed(2) + "%";
    if (knobRef.current) knobRef.current.style.left = (f * 100).toFixed(2) + "%";
    if (nowRef.current) nowRef.current.textContent = fmtDur(Math.floor(to));
    if (leftRef.current) leftRef.current.textContent = "−" + fmtDur(Math.max(0, Math.round(dur() - to)));
  };
  // звук выключил телефон: включаем и возвращаем к началу фразы (в первые секунды — к «Привет!»)
  const unmute = () => {
    try { el.muted = false; } catch (e) { /* */ }
    setForced(false);
    seekTo(soundFrom(video.cues, el.currentTime || 0));
    playSafe(el);
  };
  // динамик: выключить звук — по желанию человека; включить
  const toggleMute = (e) => {
    if (e) e.stopPropagation();
    vibrate("light");
    poke();
    if (el.muted) { if (forced) unmute(); else { try { el.muted = false; } catch (err) { /* */ } } }
    else { try { el.muted = true; } catch (err) { /* */ } setForced(false); }
  };
  const toggle = (e) => {
    if (e) e.stopPropagation();
    if (st.failed) return;
    poke();
    if (st.ended || el.paused) {
      if (forced && el.muted) { try { el.muted = false; } catch (err) { /* */ } setForced(false); }
      if (st.ended) seekTo(0);
      playSafe(el);
    } else el.pause();
  };
  // касание по видео: звук выключил телефон — включить; иначе — показать или спрятать кнопки
  const stageTap = (e) => {
    e.stopPropagation();
    if (st.ended || st.failed) return;
    if (forced && st.muted && st.playing) { unmute(); return; }
    if (!st.playing) { setUi(true); return; }
    if (ui) { clearTimeout(hideT.current); setUi(false); } else poke();
  };
  const phrase = (dir) => (e) => {
    if (e) e.stopPropagation();
    vibrate("light");
    poke();
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
    setForced(false);
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
    clearTimeout(hideT.current);
    setUi(true);
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
    if (st.playing) arm();
  };
  const onSeekKey = (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); poke(); seekTo((el.currentTime || 0) - 5); }
    else if (e.key === "ArrowRight") { e.preventDefault(); poke(); seekTo((el.currentTime || 0) + 5); }
  };
  const keep = (e) => e.stopPropagation();   // касания в плеере не уходят в урок под ним (портал — потомок урока в React)
  const top = "var(--sa-st, env(safe-area-inset-top, 0px))";
  const bottom = "env(safe-area-inset-bottom, 0px)";
  const state = st.failed ? "failed" : st.ended ? "ended" : st.playing ? (st.waiting ? "waiting" : "playing") : "paused";
  const cues = (video.cues || []).filter((x) => x > 0.5 && x < (video.dur || 1) - 0.5);
  // гаснут плавно: прозрачность и лёгкий сдвиг к краю (без сдвига, если в телефоне «уменьшить движение»)
  const fade = (dx, dy, sc = 1) => ({ opacity: ui ? 1 : 0, pointerEvents: ui ? "auto" : "none",
    transition: calm ? "opacity .3s ease" : "opacity .35s ease, transform .35s cubic-bezier(.2,.7,.3,1)",
    transform: (ui || calm) ? undefined : "translate(" + dx + "px, " + dy + "px)" + (sc !== 1 ? " scale(" + sc + ")" : "") });
  const pill = { position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, padding: "0 18px", borderRadius: 999, border: 0,
    fontFamily: SERIF, fontSize: 15.5, cursor: "pointer", whiteSpace: "nowrap" };
  const disc = (s) => ({ position: "relative", width: s, height: s, borderRadius: "50%", border: 0, padding: 0, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 });
  const center = { position: "absolute", left: "50%", top: "50%" };
  const body = (
    <div data-intro-player={video.role} data-intro-mode={mode} data-intro-state={state} data-intro-muted={st.muted ? "1" : undefined} data-intro-ui={ui ? "on" : "off"}
      data-lens-dark="" role="dialog" aria-modal="true" aria-label="Видео-знакомство" className="sa-fadein"
      onClick={keep} onTouchStart={keep} onTouchEnd={keep} onFocus={() => { if (!ui) poke(); }}
      style={{ position: "fixed", inset: 0, zIndex: 9700, background: "#000", touchAction: "manipulation", overscrollBehavior: "contain", WebkitTapHighlightColor: "transparent", userSelect: "none" }}>
      <div ref={stageRef} data-intro-stage="" onClick={stageTap} style={{ position: "absolute", inset: 0, overflow: "hidden" }} />
      {/* сверху: слева — закрыть (первым экраном — «Читать текстом»), справа — динамик */}
      <div data-intro-top="" style={{ position: "absolute", left: 12, right: 12, top: "calc(" + top + " + 12px)", display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 12, pointerEvents: "none" }}>
        <div style={{ ...fade(0, -10) }}>
          {title ? (
            <button ref={xRef} type="button" data-sa-back="" data-intro-x="text" aria-label="Читать текстом" onClick={(e) => { e.stopPropagation(); close("text"); }}
              style={{ ...pill, minHeight: 42, padding: "0 16px 0 13px", fontSize: 15, ...GLASS.dark }}>
              <TextIcon />Читать текстом
            </button>
          ) : (
            <button ref={xRef} type="button" data-sa-back="" data-intro-x="close" aria-label="Закрыть" onClick={(e) => { e.stopPropagation(); close("close"); }}
              style={{ ...disc(44), ...GLASS.dark }}><XIcon /></button>
          )}
        </div>
        <div style={{ ...fade(0, -10) }}>
          <button type="button" data-intro-mute="" aria-label={st.muted ? "Включить звук" : "Выключить звук"} aria-pressed={st.muted ? "true" : "false"} onClick={toggleMute}
            style={{ ...disc(44), ...GLASS.dark }}><SpeakerIcon off={st.muted} /></button>
        </div>
      </div>
      {/* звук выключил телефон — просим включить; не гаснет, пока звук не включат */}
      {forced && st.muted && state === "playing" ? (
        <button type="button" data-intro-sound="" onClick={(e) => { e.stopPropagation(); vibrate("light"); unmute(); }}
          style={{ ...pill, ...center, top: "calc(50% - 112px)", transform: "translate(-50%, -50%)", minHeight: 46, padding: "0 20px 0 16px", ...GLASS.dark }}>
          <SpeakerIcon s={20} off />Включить звук
        </button>
      ) : null}
      {/* посередине: назад на фразу, ▶ / ❚❚, вперёд на фразу */}
      {state !== "ended" && state !== "failed" ? (
        <div data-intro-center="" style={{ ...center, transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 30, ...fade(0, 0, 0.94) }}>
            <button type="button" data-intro-back="" aria-label="Назад на фразу" onClick={phrase(-1)} style={{ ...disc(58), ...GLASS.bubble }}><span style={shade}><PhraseIcon s={26} /></span></button>
            <button type="button" data-intro-toggle="" aria-label={st.playing ? "Пауза" : "Смотреть"} onClick={toggle} style={{ ...disc(82), ...GLASS.bubble }}>
              {state === "waiting" ? <Spinner s={38} /> : <span style={{ ...shade, display: "grid" }}>{st.playing ? <PauseIcon s={34} /> : <PlayIcon s={38} />}</span>}
            </button>
            <button type="button" data-intro-next="" aria-label="Вперёд на фразу" onClick={phrase(1)} style={{ ...disc(58), ...GLASS.bubble }}><span style={shade}><PhraseIcon s={26} fwd /></span></button>
          </div>
        </div>
      ) : null}
      {/* кнопки спрятаны, а ролик ждёт загрузки — круг посередине */}
      {state === "waiting" && !ui ? (
        <div aria-hidden="true" data-intro-wait="" style={{ ...center, transform: "translate(-50%, -50%)", pointerEvents: "none" }}><Spinner /></div>
      ) : null}
      {state === "ended" || state === "failed" ? (
        <div data-intro-end={state} onClick={keep}
          style={{ ...center, transform: "translate(-50%, -50%)", width: "calc(100% - 24px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {state === "failed" ? (
            <div style={{ fontFamily: SERIF, fontSize: 15, lineHeight: 1.45, color: INK, textAlign: "center", padding: "10px 16px", borderRadius: 16, ...GLASS.dark }}>
              Видео не загрузилось. Проверь связь и попробуй ещё раз.</div>
          ) : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" data-intro-again="" onClick={again} style={{ ...pill, ...GLASS.dark }}><AgainIcon />Ещё раз</button>
            <button type="button" data-intro-done="" onClick={(e) => { e.stopPropagation(); close(st.ended ? "end" : title ? "text" : "close"); }}
              style={{ ...pill, fontWeight: "bold", ...GLASS.dark }}>К тексту урока</button>
          </div>
        </div>
      ) : null}
      {/* внизу: сколько прошло, полоска с рисками фраз, сколько осталось */}
      <div data-intro-controls="" onClick={keep}
        style={{ position: "absolute", left: 12, right: 12, bottom: "calc(" + bottom + " + 12px)", height: 46, display: "flex", alignItems: "center", gap: 12,
          padding: "0 16px", borderRadius: 999, boxSizing: "border-box", ...GLASS.dark, ...fade(0, 12) }}>
        <span ref={nowRef} data-intro-now="" style={{ flexShrink: 0, minWidth: 30, fontFamily: SERIF, fontSize: 13, color: INK, fontVariantNumeric: "tabular-nums" }}>0:00</span>
        <div ref={seekRef} data-intro-seek="" role="slider" tabIndex={0} aria-label="Перемотка" aria-valuemin={0} aria-valuemax={Math.round(video.dur || 1)}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onSeekKey}
          style={{ position: "relative", flex: 1, minWidth: 60, height: 46, cursor: "pointer", touchAction: "none", outline: "none" }}>
          <div ref={trackRef} aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 20, marginTop: -10 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 4, marginTop: -2, borderRadius: 2, background: "rgba(255,255,255,0.24)" }} />
            {cues.map((c) => (
              <i key={c} data-intro-cue="" style={{ position: "absolute", top: "50%", left: (c / (video.dur || 1) * 100).toFixed(2) + "%", width: 2, height: 8, marginTop: -4, marginLeft: -1,
                borderRadius: 1, background: "rgba(255,255,255,0.42)" }} />
            ))}
            <div ref={fillRef} data-intro-fill="" style={{ position: "absolute", left: 0, top: "50%", height: 4, marginTop: -2, width: "0%", borderRadius: 2,
              background: "linear-gradient(90deg, #E8C983, #FFF4D8)" }} />
            <div ref={knobRef} data-intro-knob="" style={{ position: "absolute", top: "50%", left: "0%", width: 12, height: 12, marginTop: -6, marginLeft: -6, borderRadius: "50%",
              background: "#FFF8EA", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
          </div>
        </div>
        <span ref={leftRef} data-intro-left="" style={{ flexShrink: 0, minWidth: 34, textAlign: "right", fontFamily: SERIF, fontSize: 13, color: "rgba(255,255,255,0.78)", fontVariantNumeric: "tabular-nums" }}>
          {"−" + fmtDur(video.dur)}</span>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(body, document.body) : null;
}
