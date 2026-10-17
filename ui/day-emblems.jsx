// ui/day-emblems.jsx — эмблемы ритма дня (v43, Доп. 356). Рисует табличку на главной (ui/day-cards.jsx
// DayChips), шапку трека и строки чеков:
//   Flame  — пламя свечи: серия дней. Горит (сегодня уже занимался) — тёплый металл, свечение и лёгкое
//            колыхание; не горит — гравюра: золотой контур с сердцевиной;
//   Wine   — бокал на ножке: цель дня. Вино поднимается с каждым шагом, цель есть — искра над бокалом;
//   Laurel — лавровый венок: «Путь мастера», по листу за каждый значок (снизу вверх, слева и справа
//            по очереди), у новичка — 7 листьев «Первых шагов»;
//   Medal  — медальон: эмаль, металлический ободок, по ободку — дуга прогресса;
//   Val    — число: крупная цифра металлом и мелкое «/3».
// Отзыв владельца на чипы v41: «мелко и невзрачно», «не нравятся сами иконки» (свеча, стакан, звёздочка).
// Свеча осталась там, где она — своя механика: «Свеча на двоих», календари недели и месяца, запас
// в «Раунде мастера».
// Размер s — число (px) или CSS-значение (например "var(--dp-m,35px)": табличка меняет размер на узком
// экране через CSS-переменные).
import React from "react";
import { ACCENT_SERIF } from "./styles";

let seq = 0;
const useUid = (p) => { const r = React.useRef(null); if (r.current === null) r.current = "de" + p + (++seq); return r.current; };
const box = (s) => (typeof s === "number" ? { width: s, height: s } : { width: s, height: s });
const attrs = (s) => (typeof s === "number" ? { width: s, height: s } : {});

// Металл, эмаль, вино и огонь: a11y — светлая тема «Для чтения»
export const palette = (a11y) => (a11y
  ? { gold: "#7A5A22", goldHi: "#C29A52", goldMid: "#9C7634", goldLo: "#6A4C1C", dim: "rgba(122,93,42,0.30)", faint: "rgba(122,93,42,0.16)", text: "#2A1F0E", sub: "#6B5B40",
      enamelA: "#FFFBF1", enamelB: "#F1E4C6", rim: "rgba(139,106,48,0.38)", sheen: ".9", wineA: "#F0C25E", wineB: "#C7871E", flameA: "#FFD27A", flameB: "#EE9530", flameC: "#C25A12",
      core: "#FFF3CF", glow: "rgba(238,149,48,0.30)", green: "#2C6B48", dotEdge: "#F3EAD6",
      panel: "linear-gradient(180deg,rgba(255,252,244,0.92),rgba(244,231,201,0.86))", panelLine: "rgba(150,112,40,0.30)", panelTop: "rgba(175,135,50,0.50)", shadow: "0 6px 18px rgba(120,88,30,0.10)" }
  : { gold: "#E2C484", goldHi: "#F8E6B6", goldMid: "#D2AE6A", goldLo: "#9C7A42", dim: "rgba(217,184,124,0.30)", faint: "rgba(217,184,124,0.14)", text: "#EFE4C8", sub: "#A99B7E",
      enamelA: "#33270F", enamelB: "#0F0B05", rim: "rgba(217,184,124,0.36)", sheen: ".16", wineA: "#F9DC92", wineB: "#D69B38", flameA: "#FFE9AE", flameB: "#F4AE4A", flameC: "#D46A1F",
      core: "#FFF8E2", glow: "rgba(244,174,74,0.38)", green: "#8AD8AF", dotEdge: "#17120A",
      panel: "linear-gradient(180deg,rgba(214,178,102,0.16),rgba(214,178,102,0.04))", panelLine: "rgba(214,178,102,0.26)", panelTop: "rgba(226,190,120,0.46)", shadow: "0 8px 22px rgba(0,0,0,0.28)" });

// Пламя колышется, бокал наливается плавно; «уменьшить движение» — без анимации
const CSS = `
.de-flame{overflow:visible}
.de-flame .de-fl,.de-flame .de-core{transform-box:fill-box;transform-origin:50% 100%}
.de-flame.lit .de-fl{animation:deFlick 3s ease-in-out infinite}
.de-flame.lit .de-core{animation:deFlick 3s ease-in-out infinite reverse}
.de-flame.lit .de-glow{animation:deGlow 3s ease-in-out infinite}
@keyframes deFlick{0%,100%{transform:scale(1) rotate(-1.2deg)}30%{transform:scale(1.04,.97) rotate(1.2deg)}55%{transform:scale(.98,1.03) rotate(-.4deg)}80%{transform:scale(1.02) rotate(.8deg)}}
@keyframes deGlow{0%,100%{opacity:.85}50%{opacity:1}}
.de-wine .de-liq{transition:y .6s cubic-bezier(.2,.8,.2,1),height .6s cubic-bezier(.2,.8,.2,1)}
.de-medal .de-arc{transition:stroke-dasharray .6s cubic-bezier(.2,.8,.2,1)}
@media (prefers-reduced-motion: reduce){.de-flame.lit .de-fl,.de-flame.lit .de-core,.de-flame.lit .de-glow{animation:none}.de-wine .de-liq,.de-medal .de-arc{transition:none}}
`;
export function ensureEmblemCss() {
  if (typeof document === "undefined" || !document.head || !document.createElement) return;
  if (document.getElementById && document.getElementById("sa-emblem-css")) return;
  const st = document.createElement("style");
  st.id = "sa-emblem-css"; st.textContent = CSS;
  document.head.appendChild(st);
}

const FLAME = "M16 29.2C10.9 29.2 7.4 25.5 7.4 20.6C7.4 16.4 9.2 13.2 10.6 8.6C12 10.4 13 11.9 13.4 13.6C13.7 9.6 15.3 5.6 17.6 2.4C21.5 6.8 24.6 11.6 24.6 18.8C24.6 25 20.8 29.2 16 29.2Z";
const CORE = "M16 27C13.2 27 11.4 24.9 11.4 22.3C11.4 19.4 13.6 17.6 15 14.6C15.5 16.6 16.5 17.6 17.6 18.6C19.4 20.2 20.6 21.4 20.6 23.2C20.6 25.5 18.6 27 16 27Z";

export function Flame({ lit, s = 28, a11y }) {
  ensureEmblemCss();
  const p = palette(a11y), g = useUid("fl"), gc = useUid("fc"), gl = useUid("fg"), gd = useUid("fd");
  return (
    <svg className={"de-flame" + (lit ? " lit" : "")} {...attrs(s)} viewBox="0 0 32 32" aria-hidden="true" data-emb="flame" data-lit={lit ? "1" : "0"}
      style={{ ...box(s), display: "block", overflow: "visible", flexShrink: 0 }}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.flameA} /><stop offset=".5" stopColor={p.flameB} /><stop offset="1" stopColor={p.flameC} /></linearGradient>
        <linearGradient id={gc} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity=".98" /><stop offset="1" stopColor={p.core} /></linearGradient>
        <radialGradient id={gl} cx="50%" cy="62%" r="50%"><stop offset="0" stopColor={p.glow} /><stop offset="1" stopColor={p.glow} stopOpacity="0" /></radialGradient>
        <linearGradient id={gd} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={p.goldHi} /><stop offset=".55" stopColor={p.goldMid} /><stop offset="1" stopColor={p.goldLo} /></linearGradient>
      </defs>
      {lit ? (<>
        <circle className="de-glow" cx="16" cy="19" r="15.5" fill={`url(#${gl})`} />
        <path className="de-fl" d={FLAME} fill={`url(#${g})`} />
        <path className="de-core" d={CORE} fill={`url(#${gc})`} />
      </>) : (<>
        <path d={FLAME} fill={`url(#${gd})`} fillOpacity={a11y ? ".2" : ".16"} stroke={`url(#${gd})`} strokeWidth="1.35" strokeLinejoin="round" />
        <path d={CORE} fill="none" stroke={`url(#${gd})`} strokeOpacity=".8" strokeWidth="1" strokeLinejoin="round" />
      </>)}
    </svg>
  );
}

const BOWL = "M11.3 2.8C9.1 7.3 9.3 12.5 12.3 15.5C13.4 16.6 14.7 17.2 16 17.2C17.3 17.2 18.6 16.6 19.7 15.5C22.7 12.5 22.9 7.3 20.7 2.8Z";
export function Wine({ pct = 0, s = 28, a11y }) {
  ensureEmblemCss();
  const p = palette(a11y), clip = useUid("wc"), lg = useUid("wl"), rg = useUid("wr");
  const v = Math.max(0, Math.min(1, Number(pct) || 0));
  // вино — не до края: полный бокал налит до 7.2 из 32, пустой — 17.2 (дно чаши)
  const top = 7.2, bottom = 17.2, y = +(top + (bottom - top) * (1 - v)).toFixed(2);
  return (
    <svg className="de-wine" {...attrs(s)} viewBox="0 0 32 32" aria-hidden="true" data-emb="wine" data-pct={Math.round(v * 100)}
      style={{ ...box(s), display: "block", overflow: "visible", flexShrink: 0 }}>
      <defs>
        <clipPath id={clip}><path d={BOWL} /></clipPath>
        <linearGradient id={lg} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.wineA} /><stop offset="1" stopColor={p.wineB} /></linearGradient>
        {/* userSpaceOnUse: у ножки нулевая ширина — с градиентом «по рамке» её не было бы видно */}
        <linearGradient id={rg} gradientUnits="userSpaceOnUse" x1="9" y1="2" x2="23" y2="30"><stop offset="0" stopColor={p.goldHi} /><stop offset=".55" stopColor={p.goldMid} /><stop offset="1" stopColor={p.goldLo} /></linearGradient>
      </defs>
      <path d={BOWL} fill={p.faint} />
      <g clipPath={`url(#${clip})`}>
        <rect className="de-liq" x="8" y={v > 0 ? y : bottom + 1} width="16" height={v > 0 ? +(bottom - y + 1.2).toFixed(2) : 0} fill={`url(#${lg})`} />
        {v > 0 ? <path d={`M8 ${y}H24`} stroke="#FFFFFF" strokeOpacity={a11y ? ".55" : ".45"} strokeWidth=".9" /> : null}
      </g>
      <path d={BOWL} fill="none" stroke={`url(#${rg})`} strokeWidth="1.45" strokeLinejoin="round" />
      <path d="M12.6 5.6C11.7 8.8 12 11.8 13.6 13.9" fill="none" stroke="#FFFFFF" strokeOpacity={a11y ? ".85" : ".4"} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M16 17.2V26.6" stroke={`url(#${rg})`} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.9 28.4C12.7 26.9 19.3 26.9 21.1 28.4" fill="none" stroke={`url(#${rg})`} strokeWidth="1.6" strokeLinecap="round" />
      {v >= 1 ? <path data-emb-spark="" d="M26.2 1.2l.75 2.05 2.05.75-2.05.75-.75 2.05-.75-2.05-2.05-.75 2.05-.75z" fill={p.goldHi} /> : null}
    </svg>
  );
}

const LEAF = "M-3.4 0C-1.6 -1.75 1.6 -1.75 3.4 0C1.6 1.75 -1.6 1.75 -3.4 0Z";
// листья венка: i-й — слева (чётные) или справа, снизу (угол 112°) вверх (244°) по окружности R
export function laurelLeaves(total = 14) {
  const n = Math.max(1, Math.floor(Number(total) || 14)), per = Math.ceil(n / 2), R = 10.4, out = [];
  for (let i = 0; i < n; i++) {
    const left = i % 2 === 0, k = Math.floor(i / 2);
    const phi = (112 + k * (132 / Math.max(1, per - 1))) * Math.PI / 180;
    const x = 16 + R * Math.cos(phi), y = 16 + R * Math.sin(phi);
    let deg = Math.atan2(Math.cos(phi), -Math.sin(phi)) * 180 / Math.PI - 32;   // по касательной, кончиком наружу
    if (!left) deg = 180 - deg;
    out.push({ cx: +(left ? x : 32 - x).toFixed(2), cy: +y.toFixed(2), deg: +deg.toFixed(1), left });
  }
  return out;
}
export function Laurel({ have = 0, total = 14, s = 28, a11y }) {
  const p = palette(a11y), lg = useUid("ll");
  const leaves = laurelLeaves(total), got = Math.max(0, Math.min(leaves.length, Math.floor(Number(have) || 0)));
  const arc = (side) => { const a0 = 104 * Math.PI / 180, a1 = 250 * Math.PI / 180, r = 8.8;
    const sx = (a) => (side < 0 ? 16 + r * Math.cos(a) : 16 - r * Math.cos(a));
    return `M${sx(a0).toFixed(2)} ${(16 + r * Math.sin(a0)).toFixed(2)}A${r} ${r} 0 0 ${side < 0 ? 1 : 0} ${sx(a1).toFixed(2)} ${(16 + r * Math.sin(a1)).toFixed(2)}`; };
  return (
    <svg className="de-laurel" {...attrs(s)} viewBox="0 0 32 32" aria-hidden="true" data-emb="laurel" data-have={got} data-total={leaves.length}
      style={{ ...box(s), display: "block", overflow: "visible", flexShrink: 0 }}>
      <defs><linearGradient id={lg} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={p.goldHi} /><stop offset=".55" stopColor={p.goldMid} /><stop offset="1" stopColor={p.goldLo} /></linearGradient></defs>
      <path d={arc(-1)} fill="none" stroke={got > 0 ? p.goldMid : p.dim} strokeOpacity={got > 0 ? ".8" : "1"} strokeWidth=".9" strokeLinecap="round" />
      <path d={arc(1)} fill="none" stroke={got > 1 ? p.goldMid : p.dim} strokeOpacity={got > 1 ? ".8" : "1"} strokeWidth=".9" strokeLinecap="round" />
      {leaves.map((l, i) => (
        <path key={i} data-leaf={i < got ? "on" : "off"} d={LEAF} transform={`translate(${l.cx} ${l.cy}) rotate(${l.deg})`}
          fill={i < got ? `url(#${lg})` : p.faint} stroke={i < got ? "none" : p.dim} strokeWidth=".7" />
      ))}
      <path d="M16 11.2c.55 2.9 2.2 4.55 5.1 5.1-2.9.55-4.55 2.2-5.1 5.1-.55-2.9-2.2-4.55-5.1-5.1 2.9-.55 4.55-2.2 5.1-5.1z" fill={got > 0 ? `url(#${lg})` : p.dim} />
    </svg>
  );
}

export function Medal({ pct = 0, s = 34, a11y, children, glow = false }) {
  ensureEmblemCss();
  const p = palette(a11y), rg = useUid("mr"), eg = useUid("me"), hg = useUid("mh");
  const R = 15.3, CC = 2 * Math.PI * R, v = Math.max(0, Math.min(1, Number(pct) || 0));
  return (
    <span className="de-medal" data-medal={Math.round(v * 100)} style={{ ...box(s), position: "relative", display: "inline-grid", placeItems: "center", flexShrink: 0 }}>
      <svg width="100%" height="100%" viewBox="0 0 34 34" aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <radialGradient id={eg} cx="38%" cy="30%" r="75%"><stop offset="0" stopColor={p.enamelA} /><stop offset="1" stopColor={p.enamelB} /></radialGradient>
          <linearGradient id={rg} gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="32" y2="32"><stop offset="0" stopColor={p.goldHi} /><stop offset=".5" stopColor={p.goldMid} /><stop offset="1" stopColor={p.goldLo} /></linearGradient>
          <linearGradient id={hg} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity={p.sheen} /><stop offset=".5" stopColor="#FFFFFF" stopOpacity="0" /></linearGradient>
        </defs>
        {glow ? <circle data-medal-glow="" cx="17" cy="17" r="17.2" fill="none" stroke={p.glow} strokeWidth="2.6" /> : null}
        <circle cx="17" cy="17" r={R} fill={`url(#${eg})`} />
        <circle cx="17" cy="17" r={R - 1.6} fill={`url(#${hg})`} />
        <circle cx="17" cy="17" r={R} fill="none" stroke={p.rim} strokeWidth="2" />
        {v > 0 ? <circle className="de-arc" cx="17" cy="17" r={R} fill="none" stroke={`url(#${rg})`} strokeWidth="2" strokeLinecap="round"
          strokeDasharray={(CC * v).toFixed(2) + " " + CC.toFixed(2)} transform="rotate(-90 17 17)" /> : null}
      </svg>
      <span style={{ position: "relative", display: "inline-flex" }}>{children}</span>
    </span>
  );
}

// Вехи серии — как у значка «Свеча» в lib/mastery.js (FAMILIES, id "streak"): ободок пламени — до следующей
export const STREAK_TIERS = [3, 7, 30];
export const nextStreakTier = (n) => STREAK_TIERS.find((t) => t > n) || STREAK_TIERS[STREAK_TIERS.length - 1];

export function Val({ main, of, a11y, big = 20, color }) {
  const p = palette(a11y);
  return (
    <span data-val="" style={{ whiteSpace: "nowrap", fontFamily: ACCENT_SERIF, lineHeight: 1, fontWeight: 700, letterSpacing: 0.2 }}>
      <span style={{ fontSize: big, color: color || p.gold }}>{main}</span>
      {of != null ? <span style={{ fontSize: Math.round(big * 0.66), color: p.sub, fontWeight: 400 }}>/{of}</span> : null}
    </span>
  );
}
