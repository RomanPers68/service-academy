// ui/tracks-row.jsx — ряд треков под свёрнутым списком на главной (телефон).
//
// v61 (Доп. 374): шесть узлов в ряд ровно по ширине экрана (владелец: «кружки больше, в ряд, как раз по ширине»;
// «стекло без блика, как кнопка AI»; «по духу — карточка „Твой трек“, цветные»). У каждого — кольцо прогресса (у своего
// трека — золотое), плоский стеклянный диск цвета трека, значок; под узлом плашка «14 %» у начатых и замок у закрытых
// (кольцо пунктиром). v62–v63 (Доп. 375–376): первый заход — ярлычок «Твоя роль. Тапни 😉» над своим кружком (nudge).
//
// v64 (Доп. 377), запись экрана владельца: «Давай поправим анимацию»; «когда нажимаешь на роль, кружок заменяется на
// выбранный — это будет путать сотрудника»; «кнопку, которая открывается, нужно переработать, сделать красивее».
//   • Ряд больше не перестраивается: все шесть кружков всегда на своих местах. Тап по кружку — он выделяется (кольцо
//     цвета трека, чуть крупнее), а под рядом раскрывается панель трека с «язычком», указывающим на кружок.
//   • Панель (новая): плоское стекло с кромкой цвета трека, свет от язычка, крупный водяной знак значка; строка
//     «Ступень 2/4» / «Приём гостей» / «Бар» (v73 — курсивом, обычными буквами), название цветом трека, кто это, описание, тонкая нить прогресса
//     и «Открыть трек ›» — без золотой кнопки и «Дальше», чтобы не было второго «Твоего трека». Закрытый трек —
//     замок и «Пройди «Новичок», чтобы открыть».
//   • Движение без растяжения текста: панель раскрывается по высоте (WAAPI), содержимое проявляется; тап по другому
//     кружку — язычок переезжает, содержимое сменяется, высота плавно подстраивается; повторный тап по выбранному
//     кружку или «×» — панель сворачивается. Панель у нижнего края — страница докручивается, чтобы её было видно.
//     В «спокойном режиме» телефона — без движения.
//   • Панель компактная (владелец: «открытые кнопки сделаем компактнее») — три строки.
//   • Страница у нижнего края едет вместе с панелью кадр в кадр (followPanel): при раскрытии поднимается, при
//     сворачивании опускается — без «доезда» после и без рывка на отступе.
//   • Кнопка AI переехала в нижнее меню (ui/tabbar.jsx), поэтому ряду больше не нужно уступать ей место (v62: «ушко»).
import React from "react";
import { ROLES } from "../data/roles";
import { ROLE_SVG } from "./icons";
import { inkOf } from "../lib/tracks";
import { vibrate } from "../lib/utils";
import { GOLD, labelStyle } from "./tokens";

const ZAL = ["seasonal", "core", "manager", "service_manager"];   // ступени зала по порядку
const GAP = 10;

const roleIcon = (r, c, n) => (ROLE_SVG[r.id] ? ROLE_SVG[r.id](c, n) : r.icon);
const lockIcon = (c, n) => ROLE_SVG.lock(c, n);
const prevOf = (id) => { const i = ZAL.indexOf(id); return i > 0 ? ROLES.find((r) => r.id === ZAL[i - 1]) : null; };
export const lockedHint = (id) => { const pr = prevOf(id); return pr ? `Пройди «${pr.label}», чтобы открыть` : "Откроется позже"; };
// строка над названием в панели: где этот трек на пути
export const trackEyebrow = (id) => {
  const i = ZAL.indexOf(id);
  if (i >= 0) return `Ступень ${i + 1}/${ZAL.length}`;
  if (id === "spg") return "Приём гостей";
  if (id === "bar") return "Бар";
  return "Трек";
};
const calm = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const EASE = "cubic-bezier(.2,.8,.2,1)";
const MT = 9;   // отступ панели от ряда

// ближайший предок, который правда листается (экран с overflow, #root); иначе — сам документ.
// scrollIntoView во вложенных контейнерах прокручивает не туда — поэтому считаем сами.
const scrollerOf = (el) => {
  let sc = el && el.parentElement;
  while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
  return sc || document.scrollingElement || null;
};
// Страница едет вместе с панелью кадр в кадр (а не «панель раскрылась — потом страница доехала»):
// прокрутка следует за текущей высотой панели, a → b, от s0 до s1. Человек сам тронул ленту — отпускаем.
export const followPanel = (el, sc, a, b, s0, s1, raf = requestAnimationFrame, caf = cancelAnimationFrame) => {
  if (!el || !sc || Math.abs(s1 - s0) < 1) return () => {};
  let id = 0, last = s0, done = false;
  const step = () => {
    if (done) return;
    if (Math.abs(sc.scrollTop - last) > 3) { done = true; return; }
    const h = el.isConnected ? el.getBoundingClientRect().height : b;
    const pr = b === a ? 1 : Math.max(0, Math.min(1, (h - a) / (b - a)));
    last = Math.round(s0 + (s1 - s0) * pr);
    sc.scrollTop = last;
    if (pr < 1) id = raf(step); else done = true;
  };
  id = raf(step);
  return () => { done = true; caf(id); };
};

// T — стили темы (ui/styles.js), role — свой трек, unlocked — Set открытых, progressOf(id) → %,
// onSelect(id) — открыть трек, onPick(id) — тап по кружку (закрыть подсказку), frame — цвет оправы (saFrame)
export function TracksRow({ T, a11y, role, unlocked, progressOf, onSelect, onPick = null, frame, nudge = false }) {
  const items = ROLES.map((r) => { const open = unlocked.has(r.id); return { r, open, cur: r.id === role, pct: open ? progressOf(r.id) : 0 }; });
  const [openId, setOpenId] = React.useState(null);
  const ex = openId ? items.find((x) => x.r.id === openId) : null;

  // ширина ряда → размер узла: шесть в ряд с одинаковыми промежутками
  const ref = React.useRef(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const upd = () => setW(el.clientWidth || 0);
    upd();
    let ro = null;
    try { ro = new ResizeObserver(upd); ro.observe(el); } catch (e) { window.addEventListener("resize", upd); }
    return () => { if (ro) ro.disconnect(); else window.removeEventListener("resize", upd); };
  }, []);
  const rowW = w || 365;
  const D = Math.max(40, Math.floor((rowW - GAP * 5) / 6));
  const slot = (rowW - D) / 5;                                     // шаг между центрами (space-between, шесть кружков)
  const centerOf = (i) => i * slot + D / 2;

  // ── Панель: раскрытие, смена и сворачивание по высоте (без растяжения текста) ──
  const panelRef = React.useRef(null);
  const fromH = React.useRef(null);   // высота панели до смены (null — панели не было)
  const closingRef = React.useRef(false);
  const [outgoing, setOutgoing] = React.useState(null);   // прежнее содержимое панели — тает поверх нового (смена трека)
  const outTimer = React.useRef(0);
  React.useEffect(() => () => clearTimeout(outTimer.current), []);
  const pick = (id) => {
    vibrate("light");
    if (onPick) onPick(id);
    if (closingRef.current) return;
    if (id === openId) { close(); return; }
    fromH.current = panelRef.current ? panelRef.current.getBoundingClientRect().height : 0;
    if (openId && !calm()) {
      clearTimeout(outTimer.current);
      setOutgoing(openId);
      outTimer.current = setTimeout(() => setOutgoing(null), 200);
    }
    setOpenId(id);
  };
  const close = () => {
    const el = panelRef.current;
    if (!el || calm()) { setOpenId(null); return; }
    closingRef.current = true;
    const h = el.getBoundingClientRect().height;
    // страница внизу: без панели её станет меньше — опускаем ленту вместе со сворачиванием, а не рывком после
    let stop = () => {};
    try {
      const sc = scrollerOf(el);
      if (sc) {
        const s0 = sc.scrollTop, after = Math.max(0, sc.scrollHeight - sc.clientHeight - h - MT);
        if (s0 > after + 0.5) stop = followPanel(el, sc, h, 0, s0, after);
      }
    } catch (e) {}
    const done = () => { stop(); closingRef.current = false; setOpenId(null); };
    try {
      // и высота, и отступ — к нулю: когда панель уберётся, под рядом ничего не дрогнет
      const a = el.animate([{ height: h + "px", marginTop: MT + "px", opacity: 1 }, { height: "0px", marginTop: "0px", opacity: 0 }], { duration: 240, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
      a.onfinish = done;
      a.oncancel = done;
    } catch (e) { done(); }
  };
  React.useLayoutEffect(() => {
    const el = panelRef.current;
    const from = fromH.current; fromH.current = null;
    if (!el || !openId || from === null) return undefined;
    const sc = scrollerOf(el);
    const tb = document.getElementById("sa-tabbar");
    // сколько не хватает, чтобы низ панели встал над панелью вкладок (с зазором 12)
    const need = () => Math.ceil(el.getBoundingClientRect().bottom - ((tb ? tb.getBoundingClientRect().top : window.innerHeight) - 12));
    const reveal = () => { try { const d = need(); if (d > 0 && sc) sc.scrollBy({ top: d, behavior: calm() ? "auto" : "smooth" }); } catch (e) {} };
    if (calm()) { reveal(); return undefined; }
    // сейчас у панели уже конечная высота — меряем до начала движения
    const to = el.getBoundingClientRect().height;
    const delta = need();
    const dur = from ? 280 : 340;
    let stop = () => {};
    if (Math.abs(to - from) >= 1) {
      try {
        el.animate(from ? [{ height: from + "px" }, { height: to + "px" }] : [{ height: "0px", marginTop: "0px" }, { height: to + "px", marginTop: MT + "px" }], { duration: dur, easing: EASE });
        // панель у нижнего края: страница поднимается вместе с ней — одним движением
        if (delta > 0 && sc) stop = followPanel(el, sc, from, to, sc.scrollTop, sc.scrollTop + delta);
      } catch (e) { reveal(); }
    } else if (delta > 0) reveal();
    // подстраховка: если что-то помешало (человек листал, страница не успела вырасти) — докручиваем после
    const t = setTimeout(() => { if (need() > 1) reveal(); }, dur + 60);
    return () => { clearTimeout(t); stop(); };
  }, [openId]);

  const gold = a11y ? "#7A5D2A" : GOLD;
  const pageBg = a11y ? "#F7F0E0" : "#1A1409";
  const text = a11y ? "#2A2113" : "#EFE4C8";
  const btn = { background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" };

  // «Твоя роль. Тапни 😉» — ярлычок над своим кружком (v63)
  const nudgeOn = nudge && !openId && !!role && items.some((x) => x.cur);
  const nudgeIdx = nudgeOn ? items.findIndex((x) => x.cur) : -1;
  const NW = 168, NH = 34, LANE = NH + 12;
  const ncx = nudgeIdx >= 0 ? centerOf(nudgeIdx) : 0;
  const nleft = Math.max(0, Math.min(ncx - NW / 2, rowW - NW));

  const node = (x) => {
    const d = D, R = d / 2 - 1.5, CC = 2 * Math.PI * R;
    const ic = x.open ? (a11y ? inkOf(x.r.color, true) : x.r.color) : "#8A8070";
    const sel = openId === x.r.id;
    const badge = x.open && x.pct > 0 ? `${x.pct}%` : null;
    const selRing = x.open ? ic : (a11y ? "#8A7A60" : "#A79C86");
    return (
      <button key={x.r.id} type="button" id={"sa-orb-" + x.r.id} data-track-chip={x.r.id} data-track-locked={x.open ? undefined : ""} data-track-sel={sel ? "" : undefined}
        title={x.r.label} className="sa-opt" aria-pressed={sel}
        aria-label={`Трек «${x.r.label}»${x.cur ? ", твой" : !x.open ? ", закрыт" : ""}`}
        onClick={() => pick(x.r.id)}
        style={{ ...btn, flex: `0 0 ${d}px`, width: d, height: d, display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent", position: "relative", zIndex: 1,
          transform: sel ? "scale(1.07)" : "none", transition: `transform .3s ${EASE}` }}>
        <span style={{ position: "relative", width: d, height: d, display: "grid", placeItems: "center", opacity: x.open ? 1 : 0.7 }}>
          <svg aria-hidden width={d} height={d} viewBox={`0 0 ${d} ${d}`} style={{ position: "absolute", inset: 0 }}>
            <circle cx={d / 2} cy={d / 2} r={R} fill="none" strokeWidth={x.open ? 2.5 : 1.5}
              stroke={a11y ? (x.open ? "rgba(120,90,30,0.2)" : "rgba(120,90,30,0.25)") : (x.open ? "rgba(200,169,110,0.2)" : "rgba(200,169,110,0.18)")} strokeDasharray={x.open ? undefined : "2.5 3.5"} />
            {x.open && x.pct > 0 ? <circle cx={d / 2} cy={d / 2} r={R} fill="none" strokeWidth="2.5" strokeLinecap="round" stroke={x.cur ? GOLD : ic}
              strokeDasharray={`${(CC * Math.min(100, x.pct)) / 100} ${CC}`} transform={`rotate(-90 ${d / 2} ${d / 2})`} /> : null}
          </svg>
          {/* плоское стекло без блика — как кнопка AI; у своего трека золотая оправа; выбранный — оправа цвета трека и свечение */}
          <span aria-hidden className={nudgeOn && x.cur ? "sa-orb-nudge" : undefined} style={{ position: "absolute", inset: 5, borderRadius: "50%",
            background: x.open ? `${ic}${sel ? "33" : "1F"}` : (a11y ? "rgba(120,90,30,0.08)" : "rgba(255,255,255,0.04)"),
            boxShadow: sel
              ? `inset 0 0 0 1.5px ${selRing}, 0 0 0 3px ${selRing}33, 0 0 18px ${selRing}66`
              : `inset 0 0 0 ${x.cur ? 1.5 : 1}px ${x.cur ? gold : x.open ? ic + "55" : frame}${x.cur ? `, 0 0 16px ${GOLD}55` : ""}`,
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", transition: "box-shadow .3s ease, background .3s ease" }} />
          <span style={{ position: "relative", display: "inline-flex", opacity: x.open ? 1 : 0.45 }}>{roleIcon(x.r, ic, Math.round(d * 0.42))}</span>
          {badge ? (
            <span data-track-pct="" style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", fontFamily: "monospace", fontSize: a11y ? 11 : 10.5, letterSpacing: 1, whiteSpace: "nowrap",
              color: x.cur ? gold : ic, padding: "1px 6px", borderRadius: 999, background: pageBg, border: `1px solid ${x.cur ? gold : ic}66`, lineHeight: 1.3 }}>{badge}</span>
          ) : !x.open ? (
            <span aria-hidden style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center",
              background: pageBg, border: `1px solid ${frame}` }}>{lockIcon("#8A8070", 11)}</span>
          ) : null}
        </span>
      </button>
    );
  };

  // Компактная панель (владелец: «давай открытые кнопки сделаем компактнее»): три строки вместо пяти —
  // название · кто это (и «твой трек»); описание в одну строку; где трек на пути, нить прогресса и «Открыть ›»
  // (у закрытого — замок и что его откроет).
  const panelBody = (x) => {
    if (!x) return null;
    const c = x.open ? (a11y ? inkOf(x.r.color, true) : x.r.color) : "#8A8070";
    const pct = Math.max(0, Math.min(100, x.pct || 0));
    // v73 (Доп. 386): подписи («Ступень 2/4», «твой», «не начат») — курсивом, обычными буквами; моноширинный — только проценту
    const label = { ...labelStyle(a11y ? 13.5 : 13), whiteSpace: "nowrap" };
    const mono = { fontFamily: "monospace", fontSize: a11y ? 11 : 10.5, letterSpacing: 0.6, whiteSpace: "nowrap" };
    return (<>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, paddingRight: 28 }}>
        <span style={{ fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 17, lineHeight: 1.2, color: x.open ? inkOf(x.r.color, a11y) : T.modSub.color, whiteSpace: "nowrap", flexShrink: 0 }}>{x.r.label}</span>
        <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 12, color: T.modSub.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>· {x.r.sublabel}</span>
        {/* капсула «твой»: шрифт крупнее прежнего — межстрочный меньше, чтобы капсула не выросла по высоте */}
        {x.cur ? <span data-track-mine="" style={{ ...label, color: gold, border: `1px solid ${gold}66`, borderRadius: 999, padding: "0 6px", lineHeight: 1.35, marginLeft: "auto", flexShrink: 0, alignSelf: "center" }}>твой</span> : null}
      </div>
      <div style={{ marginTop: 3, fontFamily: "Georgia, serif", fontSize: 12.5, lineHeight: 1.4, color: text, opacity: x.open ? 0.88 : 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 4 }}>{x.r.desc}</div>
      <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ ...label, color: x.open ? c : T.modSub.color, opacity: 0.95 }}>{trackEyebrow(x.r.id)}</span>
        {x.open ? (<>
          <div aria-hidden style={{ flex: 1, minWidth: 24, height: 3, borderRadius: 3, background: a11y ? "rgba(120,90,40,0.16)" : "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${Math.max(pct, pct ? 3 : 0)}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${c}99, ${c})`, boxShadow: pct ? `0 0 6px ${c}88` : "none" }} />
          </div>
          <span style={{ ...(pct ? mono : label), color: T.modSub.color }}>{pct ? `${pct}%` : "не начат"}</span>
          <span data-track-go="" style={{ fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 13, color: inkOf(x.r.color, a11y), whiteSpace: "nowrap" }}>Открыть ›</span>
        </>) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 12, color: T.modSub.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            <span style={{ display: "inline-flex", flexShrink: 0 }}>{lockIcon(T.modSub.color, 13)}</span>{lockedHint(x.r.id)}
          </span>
        )}
      </div>
    </>);
  };
  const selIdx = ex ? items.findIndex((x) => x.r.id === ex.r.id) : -1;
  const notchX = selIdx >= 0 ? centerOf(selIdx) : 0;
  const panel = ex ? (() => {
    const c = ex.open ? (a11y ? inkOf(ex.r.color, true) : ex.r.color) : "#8A8070";
    const glass = a11y ? "rgba(246,238,220,0.72)" : "rgba(200,169,110,0.08)";
    const notchPct = rowW ? Math.round((notchX / rowW) * 100) : 50;
    return (
      <div ref={panelRef} data-track-open={ex.r.id} style={{ position: "relative", overflow: "hidden", marginTop: MT }}>
        {/* язычок: указывает на выбранный кружок и переезжает за ним */}
        <div aria-hidden style={{ position: "relative", height: 8 }}>
          <span data-track-notch="" style={{ position: "absolute", left: notchX - 7, top: 1, width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent",
            borderBottom: `7px solid ${c}${ex.open ? "AA" : "66"}`, transition: `left .35s ${EASE}` }} />
        </div>
        <div className={ex.open ? "sa-opt" : undefined} role="button" tabIndex={0} data-track-panel=""
          onClick={() => { if (ex.open) { vibrate("light"); onSelect(ex.r.id); } }}
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && ex.open) { e.preventDefault(); onSelect(ex.r.id); } }}
          style={{ position: "relative", overflow: "hidden", borderRadius: 16, padding: "10px 12px 10px", cursor: ex.open ? "pointer" : "default",
            background: `radial-gradient(120% 90% at ${notchPct}% 0%, ${c}${a11y ? "22" : "2B"}, rgba(0,0,0,0) 62%), ${glass}`,
            backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            // без внешней тени: обёртка с overflow: hidden (нужна для раскрытия по высоте) срезала бы её — у
            // скруглённых углов проступали тёмные прямоугольники; плоское стекло — как у кружков и кнопки AI
            boxShadow: `inset 0 0 0 1px ${c}${ex.open ? "59" : "33"}, inset 0 0 22px ${a11y ? "rgba(255,255,255,0.45)" : "rgba(255,230,170,0.06)"}` }}>
          {/* светлая черта на кромке под язычком */}
          <span aria-hidden style={{ position: "absolute", top: 0, left: notchX - 22, width: 44, height: 2, borderRadius: 2, background: `linear-gradient(90deg, transparent, ${c}, transparent)`, opacity: ex.open ? 0.9 : 0.5, transition: `left .35s ${EASE}` }} />
          {/* водяной знак */}
          <span aria-hidden style={{ position: "absolute", right: -8, top: -10, opacity: a11y ? 0.09 : 0.07, transform: "rotate(-10deg)", pointerEvents: "none" }}>{roleIcon(ex.r, c, 84)}</span>
          {outgoing && outgoing !== ex.r.id ? (
            <div key={"out-" + outgoing} aria-hidden className="sa-panel-out" style={{ position: "absolute", left: 12, right: 12, top: 10, pointerEvents: "none" }}>
              {panelBody(items.find((x) => x.r.id === outgoing))}
            </div>
          ) : null}
          <div key={ex.r.id} className="sa-panel-in" style={{ position: "relative" }}>
            {panelBody(ex)}
          </div>
          <button type="button" data-track-close="" aria-label="Свернуть" onClick={(e) => { e.stopPropagation(); vibrate("light"); close(); }}
            style={{ ...btn, position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center",
              color: T.modSub.color, fontSize: 13, lineHeight: 1, background: a11y ? "rgba(120,90,30,0.08)" : "rgba(255,255,255,0.06)" }}>×</button>
        </div>
      </div>
    );
  })() : null;

  return (
    <div ref={ref} data-tracks-row="" data-tracks-open={openId || undefined} data-tracks-nudge={nudgeOn ? "tag" : undefined}
      style={{ position: "relative", margin: "0 14px 6px", paddingTop: nudgeOn ? LANE : 0, paddingBottom: 8, boxSizing: "border-box", transition: "padding-top .3s ease" }}>
      {nudgeOn ? (
        <button type="button" data-track-nudge="tag" className="sa-hintin" onClick={() => pick(role)} aria-label="Открыть твою роль"
          style={{ ...btn, position: "absolute", top: 0, left: nleft, width: NW, height: NH, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: a11y ? "rgba(246,238,220,0.98)" : "rgba(40,31,16,0.97)", border: `1px solid ${a11y ? "rgba(150,112,40,0.45)" : "rgba(214,178,102,0.45)"}`,
            boxShadow: a11y ? "0 6px 18px rgba(60,42,10,0.22), inset 0 1px 0 rgba(255,255,255,0.9)" : `0 8px 22px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 18px ${GOLD}22`,
            color: text, fontFamily: "Georgia, serif", fontSize: 13, whiteSpace: "nowrap", zIndex: 3 }}>
          <span>Твоя роль. <b style={{ color: gold, fontWeight: "bold" }}>Тапни</b> 😉</span>
          <span aria-hidden style={{ position: "absolute", left: Math.max(10, Math.min(ncx - nleft - 6, NW - 22)), bottom: -6, width: 12, height: 12, transform: "rotate(45deg)",
            background: a11y ? "rgba(246,238,220,0.98)" : "rgba(40,31,16,0.97)", borderRight: `1px solid ${a11y ? "rgba(150,112,40,0.45)" : "rgba(214,178,102,0.45)"}`, borderBottom: `1px solid ${a11y ? "rgba(150,112,40,0.45)" : "rgba(214,178,102,0.45)"}` }} />
        </button>
      ) : null}
      <div data-tracks-nodes="" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {items.map(node)}
      </div>
      {panel}
    </div>
  );
}
