// ui/tracks-row.jsx — v61 (Доп. 374): ряд треков под свёрнутым списком на главной (телефон).
//
// Владелец (после фишек v60): «Кружки должны быть больше, в ряд, как раз по ширине экрана. Тап по нему — открывается
// кнопка, а остальные кружки смещаются вниз, под открытую кнопку»; «стекло без блика, как кнопка AI»; «по духу —
// карточка „Твой трек“, цветные»; «уберём «сейчас» из кружка, кнопку вернём к изначальной — а то два «Твой трек»».
//
// Что здесь:
//   • шесть узлов в ряд ровно по ширине (размер считается от ширины ряда): кольцо прогресса вокруг (у своего
//     трека — золотое), плоский стеклянный диск цвета трека без блика, значок; под узлом плашка «14 %» у начатых
//     и замок у закрытых (у них кольцо пунктиром) — как значок карточки «Твой трек», но без её слов;
//   • тап по узлу — он вырастает в карточку трека (значок, название, кто это, описание, «›»), остальные узлы
//     съезжают под неё (FLIP: двигаются со своих мест, не мигают); тап по карточке — в трек, «×» — свернуть,
//     тап по другому узлу — меняет карточку; закрытый трек в карточке объясняет, что его откроет;
//   • первый заход (v62, владелец: «давай переосмыслим первый вход… подсказка на кружок роли, по типу «Твоя роль.
//     Тапни😉»») — не раскрытая карточка, а подсказка у своего кружка (ключ track_orb, сразу после тура главной);
//     v63 — ярлычок над кружком (nudge ниже); кружки имеют id sa-orb-<трек>.
// «Спокойный режим» телефона — без движения.
import React from "react";
import { ROLES } from "../data/roles";
import { ROLE_SVG } from "./icons";
import { inkOf } from "../lib/tracks";
import { vibrate } from "../lib/utils";
import { GOLD } from "./tokens";

const ZAL = ["seasonal", "core", "manager", "service_manager"];   // ступени зала по порядку — для подсказки «что откроет»
const GAP = 10;
export const SHY_PX = 42;   // на сколько кнопка AI уходит к краю, когда мешает ряду (ui/css.js: html.sa-fab-shy)

const roleIcon = (r, c, n) => (ROLE_SVG[r.id] ? ROLE_SVG[r.id](c, n) : r.icon);
const lockIcon = (c, n) => ROLE_SVG.lock(c, n);
const prevOf = (id) => { const i = ZAL.indexOf(id); return i > 0 ? ROLES.find((r) => r.id === ZAL[i - 1]) : null; };
export const lockedHint = (id) => { const pr = prevOf(id); return pr ? `Пройди «${pr.label}», чтобы открыть` : "Откроется позже"; };
const calm = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

// T — стили темы (ui/styles.js), role — свой трек, unlocked — Set открытых, progressOf(id) → %,
// onSelect(id) — открыть трек, onPick(id) — тап по кружку (закрыть подсказку), frame — цвет оправы (saFrame)
export function TracksRow({ T, a11y, role, unlocked, progressOf, onSelect, onPick = null, frame, nudge = false }) {
  const items = ROLES.map((r) => { const open = unlocked.has(r.id); return { r, open, cur: r.id === role, pct: open ? progressOf(r.id) : 0 }; });
  const [openId, setOpenId] = React.useState(null);
  const ex = openId ? items.find((x) => x.r.id === openId) : null;
  const rest = items.filter((x) => x.r.id !== openId);

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
  // Кнопка AI (внизу справа) на высоких телефонах ложится ровно на последний узел — владелец: «AI закрывает бар.
  // Можем как-то сместить?». Когда её место пересекается с рядом, кнопка отходит к краю экрана «ушком» (html.sa-fab-shy,
  // ui/css.js: видно 16 px, тап работает, при прокрутке возвращается), а ряд освобождает справа ровно под ушко —
  // узлы почти того же размера. На остальных телефонах всё как было. Меряем в покое: при показе, после прокрутки,
  // при повороте и когда карточки над рядом дорастают.
  const [avoid, setAvoid] = React.useState(0);
  const fabRest = React.useRef(null);   // положение кнопки в покое (спрятанная/ушедшая к краю — со сдвигом)
  React.useLayoutEffect(() => {
    const root = ref.current; if (!root) return undefined;
    let t1 = 0, t2 = 0;
    const html = document.documentElement;
    const measure = () => {
      const fab = document.querySelector(".sa-fab"); const pop = fab ? fab.querySelector(".sa-pop") : null;
      if (!fab || !pop) { html.classList.remove("sa-fab-shy"); setAvoid(0); return; }
      if (fab.getAttribute("data-fab") === "on") {
        const q = pop.getBoundingClientRect(); const dx = html.classList.contains("sa-fab-shy") ? SHY_PX : 0;
        fabRest.current = { left: q.left - dx, right: q.right - dx, top: q.top, bottom: q.bottom, width: q.width };
      }
      const f = fabRest.current; if (!f || !f.width) return;
      const r = root.getBoundingClientRect();
      const hit = f.top < r.bottom - 4 && f.bottom > r.top + 4 && f.left < r.right;
      html.classList.toggle("sa-fab-shy", hit);
      setAvoid(hit ? Math.max(0, Math.ceil(r.right - (f.left + SHY_PX) + 6)) : 0);
    };
    const later = () => { clearTimeout(t1); clearTimeout(t2); t1 = setTimeout(measure, 120); t2 = setTimeout(measure, 420); };
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", later);
    document.addEventListener("scroll", later, { capture: true, passive: true });
    // карточки над рядом дорастают позже (уроки роли, «что сейчас») — ряд съезжает; следим за высотой колонки
    let ro = null;
    try { ro = new ResizeObserver(later); const col = root.closest(".sa-col") || document.body; ro.observe(col); } catch (e) {}
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); window.removeEventListener("resize", later); document.removeEventListener("scroll", later, { capture: true }); if (ro) ro.disconnect(); html.classList.remove("sa-fab-shy"); };
  }, [openId]);
  const D = Math.max(40, Math.floor(((w || 365) - avoid - GAP * 5) / 6));

  // Движение: тапнутый узел «вырастает» в карточку со своего места, остальные съезжают на новые места (FLIP)
  const before = React.useRef(null);
  const snap = (fromId) => {
    const root = ref.current; if (!root || calm()) { before.current = null; return; }
    const rects = {};
    root.querySelectorAll("[data-track-chip]").forEach((el) => { rects[el.getAttribute("data-track-chip")] = el.getBoundingClientRect(); });
    before.current = { rects, from: fromId ? rects[fromId] || null : null };
  };
  const pick = (id) => { vibrate("light"); snap(id); setOpenId(id); if (onPick) onPick(id); };
  const close = () => { vibrate("light"); snap(null); setOpenId(null); };
  React.useLayoutEffect(() => {
    const b = before.current; before.current = null;
    const root = ref.current; if (!b || !root) return;
    const ease = "cubic-bezier(.2,.8,.2,1)";
    root.querySelectorAll("[data-track-chip]").forEach((el) => {
      const id = el.getAttribute("data-track-chip"); const prev = b.rects[id]; if (!prev) return;
      const now = el.getBoundingClientRect(); const dx = prev.left - now.left, dy = prev.top - now.top;
      if (!dx && !dy) return;
      try { el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 380, easing: ease }); } catch (e) {}
    });
    const card = root.querySelector("[data-track-open]");
    if (card && b.from) {
      const now = card.getBoundingClientRect();
      const sx = Math.max(0.05, b.from.width / now.width), sy = Math.max(0.05, b.from.height / now.height);
      try {
        card.style.transformOrigin = "0 0";
        card.animate([{ transform: `translate(${b.from.left - now.left}px, ${b.from.top - now.top}px) scale(${sx}, ${sy})`, opacity: 0.25 }, { transform: "none", opacity: 1 }], { duration: 420, easing: ease });
      } catch (e) {}
    }
  }, [openId]);

  const gold = a11y ? "#7A5D2A" : GOLD;
  const pageBg = a11y ? "#F7F0E0" : "#1A1409";
  // v63 (Доп. 376): подсказка «Твоя роль. Тапни 😉» — не системный пузырь с затемнением (v62), а лёгкий ярлычок над
  // своим кружком с хвостиком к нему (владелец: «давай ярлычок»); ряд приспускается, чтобы ярлычок не лёг на строку
  // «Треки обучения». Кружок при этом «дышит» золотым кольцом (css: sa-orb-nudge). Тап по ярлычку = тап по кружку.
  const nudgeOn = nudge && !openId && !!role && rest.some((x) => x.cur);
  const nudgeIdx = nudgeOn ? rest.findIndex((x) => x.cur) : -1;
  const NW = 168, NH = 34, LANE = NH + 12;
  const rowW = (w || 365) - avoid;
  const slot = rest.length > 1 ? (rowW - D) / (rest.length - 1) : 0;   // шаг между центрами при space-between
  const ncx = nudgeIdx >= 0 ? nudgeIdx * slot + D / 2 : 0;
  const nleft = Math.max(0, Math.min(ncx - NW / 2, rowW - NW));
  const btn = { background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" };

  const node = (x) => {
    const d = D, R = d / 2 - 1.5, CC = 2 * Math.PI * R;
    const ic = x.open ? (a11y ? inkOf(x.r.color, true) : x.r.color) : "#8A8070";
    const badge = x.open && x.pct > 0 ? `${x.pct}%` : null;
    return (
      <button key={x.r.id} type="button" id={"sa-orb-" + x.r.id} data-track-chip={x.r.id} data-track-locked={x.open ? undefined : ""} title={x.r.label} className="sa-opt"
        aria-label={`Трек «${x.r.label}»${x.cur ? " — твой" : !x.open ? " — закрыт" : ""}`}
        onClick={() => pick(x.r.id)}
        style={{ ...btn, flex: `0 0 ${d}px`, width: d, height: d, display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent", position: "relative", zIndex: 1, alignSelf: "center" }}>
        <span style={{ position: "relative", width: d, height: d, display: "grid", placeItems: "center", opacity: x.open ? 1 : 0.7 }}>
          <svg aria-hidden width={d} height={d} viewBox={`0 0 ${d} ${d}`} style={{ position: "absolute", inset: 0 }}>
            <circle cx={d / 2} cy={d / 2} r={R} fill="none" strokeWidth={x.open ? 2.5 : 1.5}
              stroke={a11y ? (x.open ? "rgba(120,90,30,0.2)" : "rgba(120,90,30,0.25)") : (x.open ? "rgba(200,169,110,0.2)" : "rgba(200,169,110,0.18)")} strokeDasharray={x.open ? undefined : "2.5 3.5"} />
            {x.open && x.pct > 0 ? <circle cx={d / 2} cy={d / 2} r={R} fill="none" strokeWidth="2.5" strokeLinecap="round" stroke={x.cur ? GOLD : ic}
              strokeDasharray={`${(CC * Math.min(100, x.pct)) / 100} ${CC}`} transform={`rotate(-90 ${d / 2} ${d / 2})`} /> : null}
          </svg>
          {/* плоское стекло без блика — как кнопка AI; у своего трека золотое кольцо-оправа */}
          <span aria-hidden className={nudgeOn && x.cur ? "sa-orb-nudge" : undefined} style={{ position: "absolute", inset: 5, borderRadius: "50%",
            background: x.open ? `${ic}1F` : (a11y ? "rgba(120,90,30,0.08)" : "rgba(255,255,255,0.04)"),
            boxShadow: `inset 0 0 0 ${x.cur ? 1.5 : 1}px ${x.cur ? gold : x.open ? ic + "55" : frame}${x.cur ? `, 0 0 16px ${GOLD}55` : ""}`,
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }} />
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

  const card = ex ? (() => {
    const c = ex.open ? ex.r.color : "#8A8070";
    const ink = ex.open ? inkOf(ex.r.color, a11y) : T.modSub.color;
    return (
      <div data-track-open={ex.r.id} style={{ flex: "0 0 100%", order: -1, minWidth: 0, willChange: "transform" }}>
        <div className={ex.open ? "sa-card sa-glass sa-opt" : "sa-card"} role="button" tabIndex={0}
          onClick={() => { if (ex.open) { vibrate("light"); onSelect(ex.r.id); } }}
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && ex.open) { e.preventDefault(); onSelect(ex.r.id); } }}
          style={{ ...T.roleCard, borderColor: ex.open ? c + "44" : "rgba(255,255,255,0.06)", opacity: ex.open ? 1 : 0.7,
            cursor: ex.open ? "pointer" : "default", position: "relative", overflow: "hidden" }}>
          {ex.open ? <div style={{ ...T.roleAccent, background: c }} /> : null}
          <div style={{ ...T.roleIcon, background: ex.open ? c + "28" : (a11y ? "rgba(120,90,30,0.10)" : "rgba(255,255,255,0.05)"), borderRadius: "50%", boxShadow: ex.open ? `0 2px 8px ${c}44` : "none", filter: ex.open ? "none" : "grayscale(1)" }}>
            {ex.open ? roleIcon(ex.r, c, 30) : lockIcon("#8A8070", 25)}
          </div>
          <div style={{ ...T.roleInfo, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0, paddingRight: 22 }}>
              <div style={{ ...T.roleLabel, color: ink }}>{ex.r.label}</div>
              {ex.open && ex.pct > 0 ? <span style={{ fontFamily: "monospace", fontSize: a11y ? 10.5 : 9.5, letterSpacing: 1.4, color: T.modSub.color }}>{ex.pct}%</span> : null}
            </div>
            <div style={T.roleSublabel}>{ex.r.sublabel}</div>
            {ex.open
              ? <div style={T.roleDesc}>{ex.r.desc}</div>
              : <div style={{ ...T.roleDesc, color: T.modSub.color, fontStyle: "italic" }}>{lockedHint(ex.r.id)}</div>}
          </div>
          {ex.open
            ? <div style={{ fontSize: 21, color: c + "99", fontWeight: "bold" }}>›</div>
            : <div style={{ display: "flex", alignItems: "center" }}>{lockIcon(T.modSub.color, 17)}</div>}
          <button type="button" data-track-close="" aria-label="Свернуть" onClick={(e) => { e.stopPropagation(); close(); }}
            style={{ ...btn, position: "absolute", top: 6, right: 8, width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center",
              color: T.modSub.color, fontSize: 15, lineHeight: 1, background: a11y ? "rgba(120,90,30,0.08)" : "rgba(255,255,255,0.06)" }}>×</button>
        </div>
      </div>
    );
  })() : null;

  return (
    <div ref={ref} data-tracks-row="" data-tracks-open={openId || undefined} data-tracks-avoid={avoid || undefined} data-tracks-nudge={nudgeOn ? "tag" : undefined}
      style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", rowGap: 16, margin: "0 14px 6px",
        paddingBottom: 8, paddingTop: nudgeOn ? LANE : 0,
        paddingRight: avoid, boxSizing: "border-box", transition: "padding-right .25s ease, padding-top .3s ease" }}>
      {card}
      {nudgeOn ? (
        <button type="button" data-track-nudge="tag" className="sa-hintin" onClick={() => pick(role)} aria-label="Твоя роль — открыть"
          style={{ ...btn, position: "absolute", top: 0, left: nleft, width: NW, height: NH, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: a11y ? "rgba(246,238,220,0.98)" : "rgba(40,31,16,0.97)", border: `1px solid ${a11y ? "rgba(150,112,40,0.45)" : "rgba(214,178,102,0.45)"}`,
            boxShadow: a11y ? "0 6px 18px rgba(60,42,10,0.22), inset 0 1px 0 rgba(255,255,255,0.9)" : `0 8px 22px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 18px ${GOLD}22`,
            color: a11y ? "#2A2113" : "#EFE4C8", fontFamily: "Georgia, serif", fontSize: 13, whiteSpace: "nowrap", zIndex: 3 }}>
          <span style={{ color: gold, fontSize: 12 }}>✦</span>
          <span>Твоя роль. <b style={{ color: gold, fontWeight: "bold" }}>Тапни</b> 😉</span>
          {/* хвостик к кружку */}
          <span aria-hidden style={{ position: "absolute", left: Math.max(10, Math.min(ncx - nleft - 6, NW - 22)), bottom: -6, width: 12, height: 12, transform: "rotate(45deg)",
            background: a11y ? "rgba(246,238,220,0.98)" : "rgba(40,31,16,0.97)", borderRight: `1px solid ${a11y ? "rgba(150,112,40,0.45)" : "rgba(214,178,102,0.45)"}`, borderBottom: `1px solid ${a11y ? "rgba(150,112,40,0.45)" : "rgba(214,178,102,0.45)"}` }} />
        </button>
      ) : null}
      {rest.map(node)}
    </div>
  );
}
