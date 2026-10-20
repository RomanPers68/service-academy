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
//   • первый заход человека на главную со своим треком — карточка его трека уже раскрыта («намекая зайти»);
//     отметка sa_tracks_met<uk> — больше не навязываемся.
// «Спокойный режим» телефона — без движения.
import React from "react";
import { ROLES } from "../data/roles";
import { ROLE_SVG } from "./icons";
import { inkOf } from "../lib/tracks";
import { vibrate } from "../lib/utils";
import { GOLD } from "./tokens";

const ZAL = ["seasonal", "core", "manager", "service_manager"];   // ступени зала по порядку — для подсказки «что откроет»
export const MET_KEY = "sa_tracks_met";
const GAP = 10;

// Первый ли это заход человека к ряду (чистая функция — для тестов): ставит отметку и говорит «да» один раз
export function firstMeet(uk, storage) {
  try {
    const st = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!st || !uk) return false;
    const k = MET_KEY + uk;
    if (st.getItem(k)) return false;
    st.setItem(k, "1");
    return true;
  } catch (e) { return false; }
}

const roleIcon = (r, c, n) => (ROLE_SVG[r.id] ? ROLE_SVG[r.id](c, n) : r.icon);
const lockIcon = (c, n) => ROLE_SVG.lock(c, n);
const prevOf = (id) => { const i = ZAL.indexOf(id); return i > 0 ? ROLES.find((r) => r.id === ZAL[i - 1]) : null; };
export const lockedHint = (id) => { const pr = prevOf(id); return pr ? `Пройди «${pr.label}», чтобы открыть` : "Откроется позже"; };
const calm = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

// T — стили темы (ui/styles.js), role — свой трек, unlocked — Set открытых, progressOf(id) → %, uk — личный ключ,
// onSelect(id) — открыть трек, frame — цвет оправы (saFrame)
export function TracksRow({ T, a11y, role, unlocked, progressOf, uk = "", onSelect, frame }) {
  const items = ROLES.map((r) => { const open = unlocked.has(r.id); return { r, open, cur: r.id === role, pct: open ? progressOf(r.id) : 0 }; });
  const [openId, setOpenId] = React.useState(() => (role && firstMeet(uk) ? role : null));
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
  const D = Math.max(40, Math.floor(((w || 365) - GAP * 5) / 6));

  // Движение: тапнутый узел «вырастает» в карточку со своего места, остальные съезжают на новые места (FLIP)
  const before = React.useRef(null);
  const snap = (fromId) => {
    const root = ref.current; if (!root || calm()) { before.current = null; return; }
    const rects = {};
    root.querySelectorAll("[data-track-chip]").forEach((el) => { rects[el.getAttribute("data-track-chip")] = el.getBoundingClientRect(); });
    before.current = { rects, from: fromId ? rects[fromId] || null : null };
  };
  const pick = (id) => { vibrate("light"); snap(id); setOpenId(id); };
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
  const btn = { background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" };

  const node = (x) => {
    const d = D, R = d / 2 - 1.5, CC = 2 * Math.PI * R;
    const ic = x.open ? (a11y ? inkOf(x.r.color, true) : x.r.color) : "#8A8070";
    const badge = x.open && x.pct > 0 ? `${x.pct}%` : null;
    return (
      <button key={x.r.id} type="button" data-track-chip={x.r.id} data-track-locked={x.open ? undefined : ""} title={x.r.label} className="sa-opt"
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
          <span aria-hidden style={{ position: "absolute", inset: 5, borderRadius: "50%",
            background: x.open ? `${ic}1F` : (a11y ? "rgba(120,90,30,0.08)" : "rgba(255,255,255,0.04)"),
            boxShadow: `inset 0 0 0 ${x.cur ? 1.5 : 1}px ${x.cur ? gold : x.open ? ic + "55" : frame}${x.cur ? `, 0 0 16px ${GOLD}55` : ""}`,
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }} />
          <span style={{ position: "relative", display: "inline-flex", opacity: x.open ? 1 : 0.45 }}>{roleIcon(x.r, ic, Math.round(d * 0.42))}</span>
          {badge ? (
            <span data-track-pct="" style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", fontFamily: "monospace", fontSize: a11y ? 10 : 9.5, letterSpacing: 1.1, whiteSpace: "nowrap",
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
    <div ref={ref} data-tracks-row="" data-tracks-open={openId || undefined}
      style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", rowGap: 16, margin: "0 14px 6px", paddingBottom: 8 }}>
      {card}
      {rest.map(node)}
    </div>
  );
}
