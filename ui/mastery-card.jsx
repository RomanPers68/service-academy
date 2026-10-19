// ui/mastery-card.jsx — v40: «Путь мастера» на главной и общие значки.
//
//   tierColor(tier, a11y) — цвет металла ступени (бронза / серебро / золото) для колец и рамок;
//   FamIcon               — линейный значок 24×24 для каждого из 14 инструментов, «Первых шагов»
//                           (рассвет) и «Мастера роли» (печать с ✦);
//   Medal                 — медаль: металл ступени, значок тёмным по металлу, блик, кольцо пути до
//                           следующей ступени; ступени нет — силуэт с пунктиром;
//   MasteryHomeCard       — «Шаг дня» и строка пути карточкой (v40; с v41 главная её не показывает);
//   StepLine, masteryChip — v41: «Шаг дня» строкой в карточке трека и чип «Путь мастера» (звёздочка
//                           в кольце) в строке роли — главная снова минималистичная;
//   BadgeToast            — новый значок (плашка снизу, над вкладками) и «Мастер роли ✦» (окно по центру).
// Грузится сразу с главной — держим маленьким: только React, lib/mastery.js, lib/utils.js, ui/tokens.js.
import React from "react";
import { createPortal } from "react-dom";
import { FAMILIES, TIERS, TIERS_OF, ROLE_TITLE, familyCount } from "../lib/mastery";
import { vibrate, onActivate } from "../lib/utils";
import { sfx } from "../lib/sfx";   // v57 (Доп. 370)
import { GOLD } from "./tokens";

const SERIF = "'Piazzolla',Georgia,'Times New Roman',serif";
const BODY = "Georgia,'Times New Roman',serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

// Палитра и размеры — общие с экраном «Путь мастера». Светлая тема «Для чтения»: мелкий текст от 13 px,
// метки от 11 px; тёмная — от 12 и 10,5 px.
export const msPal = (a11y) => (a11y
  ? { text: "#2A1F0E", sub: "#6B5B40", gold: "#7A5A1E", line: "rgba(150,112,40,0.30)", faint: "rgba(120,90,30,0.16)", ok: "#2C6B48", okLine: "rgba(44,107,72,0.42)",
      muted: "#8A7A5C", chipBg: "rgba(201,154,46,0.18)", chip: "#6B4E0E", card: "rgba(250,242,222,0.62)", cardLine: "rgba(139,106,48,0.30)" }
  : { text: "#EFE4C8", sub: "#B5A78A", gold: "#D9B87C", line: "rgba(214,178,102,0.28)", faint: "rgba(214,178,102,0.16)", ok: "#8AD8AF", okLine: "rgba(93,187,138,0.45)",
      muted: "#8C7F66", chipBg: "rgba(232,197,106,0.16)", chip: "#F0D9A0", card: "rgba(226,186,116,0.09)", cardLine: "rgba(255,255,255,0.13)" });
export const msSmall = (a11y, px) => (a11y ? Math.max(13, px) : Math.max(12, px));
export const msEye = (a11y) => ({ fontFamily: MONO, fontSize: a11y ? 11 : 10.5, letterSpacing: 1.6, textTransform: "uppercase", lineHeight: 1.3 });
export const msPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: 0, borderRadius: 999, cursor: "pointer",
  background: "linear-gradient(180deg,#E4C88C," + GOLD + ")", color: "#1A1008", fontFamily: BODY, fontWeight: "bold" };

const CSS = `
.ms-clamp{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.ms-clamp.ms-l1{-webkit-line-clamp:1}.ms-clamp.ms-l3{-webkit-line-clamp:3}
@media (max-width:359px){.ms-clamp.ms-c3{-webkit-line-clamp:3}.ms-clamp.ms-l3{-webkit-line-clamp:4}}
.ms-step{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:12px}
@media (max-width:359px){.ms-step{grid-template-columns:minmax(0,1fr)}.ms-step-go{justify-self:start;margin-top:9px}.ms-step-go.ms-ok{display:none!important}}
.ms-zone{cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color .15s ease}
.ms-zone:active{background-color:rgba(214,178,102,0.08)}
html.sa-light .ms-zone:active{background-color:rgba(139,106,48,0.08)}
.ms-toast-pos{position:fixed;left:12px;right:12px;z-index:1200;bottom:calc(max(env(safe-area-inset-bottom,0px),8px) + 80px);display:flex;justify-content:center;pointer-events:none;animation:msToastIn .55s cubic-bezier(.2,1.25,.4,1) both}
.ms-toast-pos.out{animation:msToastOut .22s ease-in both}
.ms-toast,.ms-toast *{touch-action:none!important}
.ms-toast{pointer-events:auto;position:relative;width:100%;max-width:420px;box-sizing:border-box;user-select:none;-webkit-user-select:none}
@keyframes msToastIn{from{opacity:0;transform:translateY(120%)}to{opacity:1;transform:none}}
@keyframes msToastOut{to{opacity:0;transform:translateY(40%)}}
.ms-modal{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;overflow-y:auto;animation:msFade .25s ease both}
.ms-modal-card{position:relative;width:100%;max-width:380px;box-sizing:border-box;text-align:center;animation:msPop .55s cubic-bezier(.2,1.3,.4,1) both}
@keyframes msFade{from{opacity:0}to{opacity:1}}
@keyframes msPop{from{opacity:0;transform:scale(.86) translateY(14px)}to{opacity:1;transform:none}}
.ms-burst{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none}
.ms-burst i{position:absolute;left:-7px;top:-10px;font-style:normal;font-size:16px;line-height:1;color:#F3D27A;opacity:0;text-shadow:0 0 8px rgba(243,210,122,.75);animation:msSpark 1.5s cubic-bezier(.15,.8,.3,1) both}
.ms-burst.sm i{font-size:11px;left:-5px;top:-7px}
html.sa-light .ms-burst i{color:#B8862A;text-shadow:0 0 6px rgba(255,236,170,.9)}
@keyframes msSpark{0%{opacity:0;transform:translate(0,0) scale(.3)}18%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1) rotate(45deg)}}
.ms-glow{animation:msGlow 2.6s ease-in-out infinite}
@keyframes msGlow{0%,100%{opacity:.55;transform:scale(.95)}50%{opacity:1;transform:scale(1.05)}}
@media (prefers-reduced-motion: reduce){.ms-toast-pos,.ms-toast-pos.out,.ms-modal,.ms-modal-card,.ms-glow{animation:none}.ms-burst{display:none}}
`;
export function ensureMsCardCss() {
  if (typeof document === "undefined" || !document.head || !document.createElement) return;
  if (document.getElementById && document.getElementById("sa-ms-card-css")) return;
  const st = document.createElement("style");
  st.id = "sa-ms-card-css"; st.textContent = CSS;
  document.head.appendChild(st);
}

// ── Металл ступеней ──────────────────────────────────────────────────────────
// tierColor — для колец, рамок и полос (в светлой теме темнее: на пергаменте нужен контраст);
// tierText — для надписей «бронза / серебро / золото» (контраст 4,5 и выше в обеих темах)
export function tierColor(tier, a11y) {
  const t = Math.max(0, Math.min(3, Math.floor(Number(tier) || 0)));
  return (a11y ? ["#8A7A5C", "#A0643A", "#737C87", "#9C7420"] : ["#8C7F66", "#C98B5F", "#C9CED6", "#E8C56A"])[t];
}
export function tierText(tier, a11y) {
  const t = Math.max(0, Math.min(3, Math.floor(Number(tier) || 0)));
  return (a11y ? ["#6B5B40", "#87481F", "#4F5763", "#76561A"] : ["#A99B7E", "#DDA57E", "#D3D8E0", "#EBCB76"])[t];
}
const METAL = [null,
  { hi: "#F4CDA6", mid: "#C98B5F", lo: "#8A5230", rim: "#663719", ink: "#371A08" },
  { hi: "#FCFDFF", mid: "#C9CED6", lo: "#8A93A0", rim: "#565E6A", ink: "#20252D" },
  { hi: "#FFF2BE", mid: "#E8C56A", lo: "#AE8428", rim: "#765610", ink: "#362403" }];

const r2 = (v) => Math.round(v * 100) / 100;
// четырёхлучевая звёздочка ✦
const star4 = (x, y, r, k = 0.28) => {
  const a = r * k;
  return "M" + [[x, y - r], [x + a, y - a], [x + r, y], [x + a, y + a], [x, y + r], [x - a, y + a], [x - r, y], [x - a, y - a]].map((p) => r2(p[0]) + " " + r2(p[1])).join("L") + "Z";
};

// ── Значки семейств: линия 1,7, скруглённые концы, 24×24 (как ICON в ui/home-hubs.jsx) ──
const ICON = {
  track: () => <><path d="M3.6 21L9 9.6M20.4 21L15 9.6" /><path d="M12 21v-2.3M12 15.7v-1.8M12 11.6v-1" /><path d="M12 9.4V2.8" /><path d="M12 3.2h5.6l-1.5 1.9 1.5 1.9H12" /></>,
  tests: (c) => <><circle cx="11" cy="13" r="8" /><circle cx="11" cy="13" r="4.2" /><circle cx="11" cy="13" r="1" fill={c} stroke="none" /><path d="M11 13l8.4-8.4" /><path d="M16.6 2.6v3.2h3.2" /></>,
  table: () => <><path d="M2.8 17.6h18.4" /><path d="M4.8 17.6a7.2 7.2 0 0 1 14.4 0" /><path d="M12 10.4V8.7M10.4 8.4h3.2" /><path d="M8.1 14.6a4.6 4.6 0 0 1 2.4-2.2" /><path d="M5.6 20.6h12.8" /></>,
  dialogue: () => <><path d="M4.8 3.8h8.9a2.4 2.4 0 0 1 2.4 2.4v4.3a2.4 2.4 0 0 1-2.4 2.4H9.2l-3.4 2.8v-2.8h-1a2.4 2.4 0 0 1-2.4-2.4V6.2a2.4 2.4 0 0 1 2.4-2.4z" /><path d="M16.1 8.6h3.1a2.4 2.4 0 0 1 2.4 2.4v4.3a2.4 2.4 0 0 1-2.4 2.4h-.4v2.8l-3.4-2.8h-3.1a2.4 2.4 0 0 1-2.4-2.4v-2.4" /><path d="M5.9 7.4h6.6M5.9 9.9h4" /></>,
  fresh: (c) => <><path d="M6.4 3h10.4c0 5.5-2.2 9.4-5.2 10.7C8.6 12.4 6.4 8.5 6.4 3z" /><path d="M7.1 7.1h9" /><path d="M11.6 13.7v6.5M8.3 20.6h6.6" /><path d={star4(19.4, 13.4, 2.3)} fill={c} stroke="none" /></>,
  gold: (c) => <><path d="M3.6 9l4.3 3.5L12 6.2l4.1 6.3 4.3-3.5-1.6 8.4H5.2z" /><path d="M5.4 20.6h13.2" /><circle cx="3.6" cy="7" r="1.15" fill={c} stroke="none" /><circle cx="12" cy="3.9" r="1.15" fill={c} stroke="none" /><circle cx="20.4" cy="7" r="1.15" fill={c} stroke="none" /></>,
  warmup: () => <><path d="M4.6 10.4h11.6v3.8a5.4 5.4 0 0 1-5.4 5.4h-.8a5.4 5.4 0 0 1-5.4-5.4z" /><path d="M16.2 11.6h1.3a2.6 2.6 0 0 1 0 5.2h-1.8" /><path d="M3.4 21.6h15" /><path d="M8.4 3.1c-1.1 1.1 1.1 2.3 0 3.7M12.4 3.1c-1.1 1.1 1.1 2.3 0 3.7" /></>,
  radio: () => <><rect x="3" y="9" width="18" height="12" rx="2.6" /><path d="M7.4 9l9.2-5.6" /><circle cx="15.6" cy="15" r="2.8" /><path d="M6.6 13h4M6.6 15.9h4M6.6 18.8h2.4" /></>,
  guest: (c) => <><circle cx="10.6" cy="8.2" r="3.7" /><path d="M3.6 20.8c0-3.9 3.1-6.8 7-6.8s7 2.9 7 6.8" /><path d={star4(18.9, 4.3, 2.7)} fill={c} stroke="none" /></>,
  fixes: () => <><path d="M15 6.2l2.8 2.8 3.4-3.4a5.6 5.6 0 0 1-7.6 6.9l-7.2 7.2a2 2 0 0 1-2.9-2.9l7.2-7.2a5.6 5.6 0 0 1 6.9-7.6z" /><path d="M14.4 18.4l2.1 2.1 4.3-4.4" /></>,
  decks: () => <><path d="M6.6 17.6H6a1.8 1.8 0 0 1-1.8-1.8V4.8A1.8 1.8 0 0 1 6 3h8.6a1.8 1.8 0 0 1 1.8 1.8v.9" /><rect x="8.2" y="6.4" width="11.6" height="14.6" rx="1.8" /><path d="M14 10.4l2.1 3.2-2.1 3.2-2.1-3.2z" /></>,
  streak: () => <><path d="M12 2.4c1.7 2 2.6 3.3 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.3.9-2.6 2.6-4.6z" /><path d="M12 9.6v1.4" /><rect x="8.4" y="11" width="7.2" height="9.6" rx="1.3" /><path d="M5.6 21.4h12.8" /></>,
  quest: () => <><circle cx="7.4" cy="11.8" r="2.3" /><circle cx="16.6" cy="11.8" r="2.3" /><path d="M2.8 20.8c0-2.7 2-4.7 4.6-4.7 1.5 0 2.8.7 3.6 1.8M21.2 20.8c0-2.7-2-4.7-4.6-4.7-1.5 0-2.8.7-3.6 1.8" /><path d="M12 9.4V2.6" /><path d="M12 3h5.2l-1.4 1.7 1.4 1.7H12" /></>,
  hall: () => <><path d="M12 2.8l2.7 5.5 6 .9-4.35 4.25 1.03 6L12 16.6l-5.38 2.85 1.03-6L3.3 9.2l6-.9z" /><path d="M9.4 11.5l1.8 1.8 3.5-3.6" /></>,
  first: () => <><path d="M2.6 17.4h18.8" /><path d="M7 17.4a5 5 0 0 1 10 0" /><path d="M12 9.6V7M6.4 11.8l-1.7-1.7M17.6 11.8l1.7-1.7" /><path d="M6.4 20.6h11.2" /></>,
  master: (c) => <><circle cx="12" cy="9.4" r="6.6" /><path d="M8.3 14.9L6.8 21.4l5.2-2.4 5.2 2.4-1.5-6.5" /><path d={star4(12, 9.4, 3.6, 0.3)} fill={c} stroke="none" /></>,
  // внутри золотой печати мастера — корона под звездой
  masterIn: (c) => <><path d="M4.8 16.2l1.1-7.4 3.9 3.3L12 7.4l2.2 4.7 3.9-3.3 1.1 7.4z" /><path d="M5.2 19.4h13.6" /><path d={star4(12, 3, 2.3, 0.3)} fill={c} stroke="none" /></>,
};

export function FamIcon({ id, size = 24, color = "currentColor", strokeWidth = 1.7, style }) {
  const draw = ICON[id] || ICON.track;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" style={{ display: "block", flexShrink: 0, ...style }}>
      {draw(color)}
    </svg>
  );
}

// короткие предлоги, союзы и числа — к следующему слову («Практика у\u00A0стола», «3\u00A0разминки»)
export const msTie = (t) => String(t || "").replace(/(^|[\s\u00A0])([А-Яа-яЁё]{1,2}|\d{1,3})\s+(?=\S)/g, "$1$2\u00A0");
const titleOf = (id) => (id === "first" ? "Первые шаги ✦" : id === "master" ? "Мастер роли ✦" : (FAMILIES.find((f) => f.id === id) || {}).title || "Значок");

let seq = 0;
const useUid = (p) => { const ref = React.useRef(null); if (ref.current === null) ref.current = p + (++seq); return ref.current; };

// фестончатый край печати «Мастер роли»
function scallop(R, n = 18, a = 1.5) {
  const pts = [];
  const N = n * 8;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const r = R - a + a * Math.cos(n * t);
    pts.push(r2(32 + r * Math.sin(t)) + " " + r2(32 - r * Math.cos(t)));
  }
  return "M" + pts.join("L") + "Z";
}

// Медаль: tier 1–3 — металл; locked или tier 0 — силуэт (пунктир; путь уже начат — сплошной контур).
// ring — кольцо пути до следующей ступени (pct 0…1) цветом следующего металла; у золота — полное.
export function Medal({ id, tier = 0, size = 56, a11y, locked, pct = 0, ring = true, title, style }) {
  const uid = useUid("msm");
  const t = Math.max(0, Math.min(3, Math.floor(Number(tier) || 0)));
  const lock = !!locked || t === 0;
  const p = Math.max(0, Math.min(1, Number(pct) || 0));
  const special = id === "first" || id === "master";
  const label = (title || titleOf(id)) + " — " + (lock ? "ещё не получен" : special ? "получен" : TIERS[t]);
  const m = METAL[t || 3];
  const R = ring ? 24 : 30;
  const seal = id === "master" && !lock;
  const muted = a11y ? "#8A7A5C" : "#8C7F66";
  const RR = 29.6, CC = 2 * Math.PI * RR;
  const arc = !lock && t >= 3 ? 1 : p;
  const s = R * (seal ? 1.04 : 1.1);
  const ink = lock ? muted : m.ink;
  const glyph = seal ? ICON.masterIn : ICON[id] || ICON.track;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label} focusable="false" style={{ display: "block", flexShrink: 0, overflow: "visible", ...style }}>
      {!lock ? (
        <defs>
          <linearGradient id={uid + "a"} x1="0.12" y1="0.06" x2="0.88" y2="0.96"><stop offset="0" stopColor={m.hi} /><stop offset="0.5" stopColor={m.mid} /><stop offset="1" stopColor={m.lo} /></linearGradient>
          <linearGradient id={uid + "b"} x1="0.85" y1="0.95" x2="0.2" y2="0.08"><stop offset="0" stopColor={m.hi} /><stop offset="0.55" stopColor={m.mid} /><stop offset="1" stopColor={m.lo} /></linearGradient>
          <clipPath id={uid + "c"}><circle cx="32" cy="32" r={R} /></clipPath>
        </defs>
      ) : null}
      {ring ? <circle cx="32" cy="32" r={RR} fill="none" stroke={a11y ? "rgba(120,90,30,0.18)" : "rgba(214,178,102,0.18)"} strokeWidth="3" /> : null}
      {ring && arc > 0 ? <circle cx="32" cy="32" r={RR} fill="none" stroke={tierColor(lock ? 1 : Math.min(3, t + 1), a11y)} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={r2(CC * arc) + " " + r2(CC)} transform="rotate(-90 32 32)" /> : null}
      {lock ? (
        <circle cx="32" cy="32" r={R - 0.8} fill={a11y ? "rgba(255,252,244,0.5)" : "rgba(255,250,238,0.035)"} stroke={muted} strokeWidth="1.5" strokeDasharray={p > 0 ? undefined : "3.2 3.3"} />
      ) : (
        <>
          {seal ? <path d={scallop(R + 0.3)} fill={`url(#${uid}a)`} stroke={m.rim} strokeWidth="1.2" strokeLinejoin="round" />
            : <circle cx="32" cy="32" r={R - 0.6} fill={`url(#${uid}a)`} stroke={m.rim} strokeWidth="1.2" />}
          <circle cx="32" cy="32" r={R - (seal ? 4.8 : 4)} fill={`url(#${uid}b)`} />
          <circle cx="32" cy="32" r={R - (seal ? 4.8 : 4)} fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.8" />
          <circle cx="32" cy="32" r={R - (seal ? 5.8 : 4.9)} fill="none" stroke={m.rim} strokeOpacity="0.4" strokeWidth="0.7" />
          <ellipse cx="25" cy="20" rx={r2(R * 0.62)} ry={r2(R * 0.3)} transform="rotate(-32 25 20)" fill="#fff" opacity="0.2" clipPath={`url(#${uid}c)`} />
        </>
      )}
      <g transform={`translate(${r2(32 - s / 2)} ${r2(32 - s / 2)}) scale(${r2(s / 24)})`} fill="none" stroke={ink} strokeWidth={lock ? 1.6 : 1.75}
        strokeLinecap="round" strokeLinejoin="round" opacity={lock ? (p > 0 ? 0.8 : 0.6) : 1}>
        {glyph(ink)}
      </g>
      {!lock && t >= 3 && size >= 44 ? <path d={star4(54, 9.5, 4.4)} fill={a11y ? "#B8902E" : "#FFF0BC"} /> : null}
    </svg>
  );
}

// ── Главная: «Шаг дня» и строка пути ─────────────────────────────────────────
const cardStyle = (a11y) => ({
  background: a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.09)",
  border: a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)",
  boxShadow: a11y
    ? "inset 0 0 26px rgba(255,255,255,0.55), inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 18px rgba(120,85,25,0.14)"
    : "inset 0 0 26px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.45)",
});
const CheckMark = ({ size = 16, color }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
const stepIcon = (step) => (step && step.kind === "first" ? "first" : (step && step.fam) || "track");
const newLabel = (n) => (n === 1 ? "новое" : n + " новых");

export function MasteryHomeCard({ a11y, step, state, newCount = 0, onStep, onOpen, style }) {
  ensureMsCardCss();
  const c = msPal(a11y);
  const fw = state && state.firstWeek;
  const ms = state && state.master;
  if (!step && !state) return null;
  const goStep = () => { vibrate("light"); onStep && onStep(step); };
  const goOpen = () => { vibrate("light"); onOpen && onOpen(); };
  const done = !!(step && step.done);
  const firstWeek = !!(fw && fw.active);
  const badges = (state && state.bronze) || 0, total = (state && state.total) || FAMILIES.length;
  const have = (ms && ms.have) || 0, need = (ms && ms.need) || 13;
  // неразрывные пробелы: строка переносится только между частями «·», а не «7/13» отдельной строкой
  const nb = (t) => t.replace(/ /g, "\u00A0");
  const line = firstWeek ? nb((fw.done || 0) + " из " + (fw.total || 7))
    : ms && ms.ok ? nb("Мастер роли ✦") + "\u00A0· " + nb(badges + " из " + total + " значков")
    : nb(badges + " из " + total + " значков") + "\u00A0· " + nb("мастер роли " + have + "/" + need);
  const longT = String((step && step.text) || "").length > 38;
  const R = 15, CC = 2 * Math.PI * R;
  return (
    <div data-ms-home="" style={{ margin: "0 14px 10px", borderRadius: 18, overflow: "hidden", ...cardStyle(a11y), ...style }}>
      {step ? (
        <div className="ms-zone" data-ms-step="" onClick={goStep} {...onActivate(goStep)}
          aria-label={done ? "Шаг дня сделан. Завтра будет новый" : "Шаг дня: " + step.text + (step.sub ? ". " + step.sub : "")}
          style={{ padding: "11px 13px 12px" }}>
          <div className="ms-step" style={{ minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...msEye(a11y), color: c.gold, display: "flex", alignItems: "center", gap: 6 }}>
                <FamIcon id={stepIcon(step)} size={14} color={c.gold} strokeWidth={1.9} />Шаг дня
              </div>
              <div className={"ms-clamp " + (longT && !done ? "ms-l3" : "ms-c3")} style={{ fontFamily: BODY, fontSize: a11y ? 16.5 : 15.5, lineHeight: 1.28, color: c.text, marginTop: 4 }}>{done ? "Шаг дня сделан ✓" : msTie(step.text)}</div>
              {done || step.sub ? <div className={"ms-clamp" + (longT && !done ? " ms-l1" : "")} style={{ fontSize: msSmall(a11y, 12.5), lineHeight: 1.38, color: c.sub, marginTop: 3 }}>{done ? "Завтра будет новый" : msTie(step.sub)}</div> : null}
            </div>
            {done ? (
              <span className="ms-step-go ms-ok" aria-hidden="true" style={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", boxSizing: "border-box", border: "1.5px solid " + c.okLine, color: c.ok }}><CheckMark size={17} color={c.ok} /></span>
            ) : (
              <span className="ms-step-go" aria-hidden="true" style={{ ...msPrimary, padding: "9px 16px", fontSize: a11y ? 14.5 : 13.5, whiteSpace: "nowrap" }}>Сделать</span>
            )}
          </div>
        </div>
      ) : null}
      {state ? (
        <div className="ms-zone" data-ms-open="" onClick={goOpen} {...onActivate(goOpen)}
          aria-label={(firstWeek ? "Первые шаги в академии · " : "Путь мастера · ") + line + (newCount > 0 ? " · " + newLabel(newCount) : "")}
          style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 13px 11px", borderTop: step ? "1px solid " + c.line : "none" }}>
          {firstWeek ? (
            <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", border: "1px solid " + c.line, color: c.gold }}><FamIcon id="first" size={19} color={c.gold} /></span>
          ) : ms && ms.ok ? (
            <span aria-hidden="true" style={{ flexShrink: 0 }}><Medal id="master" tier={3} size={34} a11y={a11y} ring={false} /></span>
          ) : (
            <span aria-hidden="true" style={{ position: "relative", width: 34, height: 34, flexShrink: 0, display: "grid", placeItems: "center" }}>
              <svg width="34" height="34" viewBox="0 0 34 34" style={{ position: "absolute", inset: 0 }}>
                <circle cx="17" cy="17" r={R} fill="none" stroke={c.faint} strokeWidth="2.4" />
                {have > 0 ? <circle cx="17" cy="17" r={R} fill="none" stroke={tierColor(3, a11y)} strokeWidth="2.4" strokeLinecap="round" strokeDasharray={r2(CC * Math.min(1, have / need)) + " " + r2(CC)} transform="rotate(-90 17 17)" /> : null}
              </svg>
              <FamIcon id="master" size={17} color={c.gold} />
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ minWidth: 0, fontFamily: BODY, fontSize: a11y ? 15.5 : 14.5, lineHeight: 1.25, color: c.text }}>{firstWeek ? msTie("Первые шаги в академии") : "Путь мастера"}</span>
              {newCount > 0 ? <span data-ms-newcount="" style={{ flexShrink: 0, padding: "2px 9px", borderRadius: 999, background: c.chipBg, color: c.chip, fontSize: msSmall(a11y, 12), fontWeight: "bold", lineHeight: 1.35, whiteSpace: "nowrap" }}>{newLabel(newCount)}</span> : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2px 8px", marginTop: 3, fontSize: msSmall(a11y, 12), lineHeight: 1.35, color: c.sub }}>
              {firstWeek ? (
                <span aria-hidden="true" style={{ display: "inline-flex", gap: 4 }}>
                  {(fw.items || []).slice(0, 7).map((it, i) => <i key={it.id || i} className={"ms-dot" + (it.done ? " on" : "")} style={{ display: "block", width: 8, height: 8, borderRadius: "50%", boxSizing: "border-box", background: it.done ? tierColor(3, a11y) : "transparent", border: "1.5px solid " + (it.done ? tierColor(3, a11y) : c.muted) }} />)}
                </span>
              ) : null}
              <span>{line}</span>
            </div>
          </div>
          <span aria-hidden="true" style={{ color: c.gold, fontSize: 21, lineHeight: 1, opacity: 0.8, flexShrink: 0 }}>›</span>
        </div>
      ) : null}
    </div>
  );
}

// ── v41 (Доп. 354): главная снова минималистичная ────────────────────────────
// Отзыв владельца: «новая функция немного рушит изначальный минимализм». На главной одно главное
// действие — карточка трека. «Шаг дня» — строкой внутри неё (как «разминка 2 мин», Доп. 306), без второй
// большой кнопки: значок и золотая надпись «ШАГ ДНЯ», под ними дело и круглая стрелка справа; сделал —
// строка уходит. «Путь мастера» — чип рядом со свечой и стаканом: звёздочка ✦ в кольце, которое
// заполняется по мере значков; новое — точкой. Вид выбран владельцем из четырёх («Б · Строка с подписью»,
// «Звёздочка в кольце»). MasteryHomeCard остался (его разметку проверяют тесты и слот RoleSelect), но
// главная его больше не показывает.
const StepArrow = ({ c }) => (
  <span aria-hidden="true" data-ms-line-go="" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", boxSizing: "border-box",
    border: "1px solid " + c.gold + "77", background: "radial-gradient(circle at 35% 30%, " + c.gold + "22, transparent 70%)" }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c.gold} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
  </span>);
export function StepLine({ a11y, step, onStep, pill = false }) {
  ensureMsCardCss();
  if (!step || step.done || !step.text) return null;
  const c = msPal(a11y);
  const go = () => { vibrate("light"); onStep && onStep(step); };
  // последнее слово — вместе с предпоследним: строка не кончается одиноким «дня»»
  const text = msTie(step.text).replace(/\s+(\S+)$/, "\u00A0$1");
  // v44 (Доп. 357): плашкой внизу карточки трека, рядом с разминкой: «ШАГ ДНЯ» и дело (без «Попробуй:» — места
  // мало, приставку говорит значок); длинное — до трёх строк, без многоточия; вся плашка — кнопка
  if (pill) return (
    <div role="button" tabIndex={0} className="ms-zone" data-ms-line="" data-pill="step" onClick={go} {...onActivate(go)}
      aria-label={"Шаг дня: " + step.text + (step.sub ? ". " + step.sub : "")}
      style={{ flex: "1 1 0", minWidth: 0, display: "flex", alignItems: "center", gap: 8, padding: "7px 9px 7px 10px", borderRadius: 12, cursor: "pointer",
        border: "1px solid " + c.line, background: a11y ? "rgba(255,252,244,0.6)" : "rgba(255,240,205,0.05)" }}>
      <span style={{ flexShrink: 0, display: "inline-flex" }}><FamIcon id={stepIcon(step)} size={16} color={c.gold} strokeWidth={1.9} /></span>
      <span style={{ flex: 1, minWidth: 0 }} aria-hidden="true">
        <span style={{ ...msEye(a11y), fontSize: a11y ? 11 : 10.5, letterSpacing: 1, color: c.gold, display: "block" }}>Шаг дня</span>
        {/* в узкой плашке слова переносятся свободно (без неразрывной склейки последних слов, как в строке) */}
        <span className="ms-clamp ms-c3" style={{ fontFamily: BODY, fontSize: 12.5, lineHeight: 1.3, color: c.text, marginTop: 1 }}>{String(step.text).replace(/^Попробуй:\s*/, "").replace(/^./, (x) => x.toUpperCase())}</span>
      </span>
      <span aria-hidden="true" style={{ color: c.gold, fontSize: 15, lineHeight: 1, flexShrink: 0 }}>›</span>
    </div>
  );
  return (
    <div role="button" tabIndex={0} className="ms-zone" data-ms-line="" onClick={go} {...onActivate(go)}
      aria-label={"Шаг дня: " + step.text + (step.sub ? ". " + step.sub : "")}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 13px 9px", borderTop: "1px solid " + c.line }}>
      {/* «чуть-чуть компактнее»: значок — в строке надписи (как у часов разминки, слева), дело — во всю ширину,
          короткое встаёт в одну строку; длинное — две, на узком экране (меньше 360 px) — три, без многоточия */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...msEye(a11y), color: c.gold, display: "flex", alignItems: "center", gap: 7 }}>
          <FamIcon id={stepIcon(step)} size={15} color={c.gold} strokeWidth={1.9} />Шаг дня
        </span>
        <span className="ms-clamp ms-c3" style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.25, color: c.text, marginTop: 2 }}>{text}</span>
      </span>
      <StepArrow c={c} />
    </div>
  );
}

// Кольцо чипа: тонкий круг, дуга металла по мере пути и золотая звёздочка ✦ в центре
function ChipRing({ c, pct, a11y }) {
  const R = 7.6, CC = 2 * Math.PI * R, p = Math.max(0, Math.min(1, Number(pct) || 0));
  return (
    <svg width="19" height="19" viewBox="0 0 19 19" aria-hidden="true" data-ms-ring={Math.round(p * 100)} style={{ display: "block", flexShrink: 0 }}>
      <circle cx="9.5" cy="9.5" r={R} fill="none" stroke={c.faint} strokeWidth="1.8" />
      {p > 0 ? <circle cx="9.5" cy="9.5" r={R} fill="none" stroke={tierColor(3, a11y)} strokeWidth="1.8" strokeLinecap="round" strokeDasharray={r2(CC * p) + " " + r2(CC)} transform="rotate(-90 9.5 9.5)" /> : null}
      <path d={star4(9.5, 9.5, 4.2, 0.3)} fill={c.gold} />
    </svg>);
}
// Чип «Путь мастера» для строки роли (DayChips рисует его тем же видом, что свечу и стакан):
// звёздочка в кольце и «9/14» (значков из 14); у новичка — «2/7» «Первых шагов»; у мастера кольцо полное.
// v43 (Доп. 356): табличка на главной рисует венок сама — ей нужны и числа: pct, have, total,
// mode ("first" — «Первые шаги», "master" — мастер роли, "path" — путь).
export function masteryChip(state, newCount = 0, a11y = false) {
  if (!state) return null;
  const c = msPal(a11y);
  const fw = state.firstWeek, ms = state.master;
  const firstWeek = !!(fw && fw.active);
  const badges = state.bronze || 0, total = state.total || FAMILIES.length;
  const have = (ms && ms.have) || 0, need = (ms && ms.need) || 13;
  const fd = (fw && fw.done) || 0, ft = (fw && fw.total) || 7;
  const pct = firstWeek ? fd / ft : ms && ms.ok ? 1 : badges / total;
  const icon = <ChipRing c={c} a11y={a11y} pct={pct} />;
  const text = firstWeek ? fd + "/" + ft : badges + "/" + total;
  const aria = (firstWeek ? "Первые шаги в академии: " + fd + " из " + ft
    : ms && ms.ok ? "Путь мастера: мастер роли ✦, " + badges + " из " + total + " значков"
    : "Путь мастера: " + badges + " из " + total + " значков, до мастера роли " + have + " из " + need) + (newCount > 0 ? ", есть новое" : "");
  return { icon, text, aria, dot: newCount > 0, pct, have: firstWeek ? fd : badges, total: firstWeek ? ft : total,
    mode: firstWeek ? "first" : ms && ms.ok ? "master" : "path" };
}

// ── Праздник: новый значок и «Мастер роли ✦» ─────────────────────────────────
// Ровно один вызов на показ: onOpen(item) — кнопка «Путь мастера ›» / «Сертификат мастера ›»;
// onClose(item) — крестик, смахивание, «Позже» или сама ушла через 6 с.
const SPARKS = [[-78, -54], [80, -46], [-100, 4], [102, 12], [-60, 66], [64, 70], [0, -96], [-30, -86], [34, -88], [0, 92], [-92, -26], [94, -22]];
const SPARKS_SM = [[-34, -30], [36, -26], [-40, 14], [40, 18], [0, -40], [4, 40]];
const burst = (list, sm) => (
  <span className={"ms-burst" + (sm ? " sm" : "")} aria-hidden="true">
    {list.map(([x, y], i) => <i key={i} style={{ "--dx": x + "px", "--dy": y + "px", animationDelay: 120 + i * 45 + "ms" }}>✦</i>)}
  </span>
);
// праздничная отдача — только после первого касания страницы: иначе Chrome пишет в консоль ошибку
// (navigator.vibrate без жеста пользователя), а Telegram отдаёт отдачу и так
const buzz = () => { try { if (typeof navigator !== "undefined" && navigator.userActivation && !navigator.userActivation.hasBeenActive) return; } catch (e) {} vibrate("success"); sfx("done"); };   // v57: и колокольчик
const XIcon = ({ color }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;

export function BadgeToast({ a11y, item, state, onOpen, onClose, inline = false }) {
  ensureMsCardCss();
  if (!item || !item.kind) return null;
  const key = item.kind + ":" + (item.id || item.role || "") + ":" + (item.tier || "");
  const el = item.kind === "master"
    ? <MasterModal key={key} a11y={a11y} item={item} onOpen={onOpen} onClose={onClose} />
    : <TierToast key={key} a11y={a11y} item={item} state={state} onOpen={onOpen} onClose={onClose} />;
  if (inline || typeof document === "undefined" || !document.body) return el;
  return createPortal(el, document.body);
}

// строка под названием значка: «15 тем освежено · до золота ещё 25»
export function toastLine(item, state) {
  if (!item) return "";
  if (item.kind === "firstWeek") return "7 первых шагов за первые две недели";
  const fs = state && Array.isArray(state.families) ? state.families.find((f) => f && f.id === item.id) : null;
  if (!fs) return "";
  const count = familyCount(fs.id, fs.value);
  return fs.next == null || fs.tier >= 3 ? count + " · высшая ступень ✦" : count + " · до " + TIERS_OF[fs.tier + 1] + " ещё " + fs.left;
}

function TierToast({ a11y, item, state, onOpen, onClose }) {
  const c = msPal(a11y);
  const [out, setOut] = React.useState(false);
  const [drag, setDrag] = React.useState(null);
  const from = React.useRef(null);
  const fired = React.useRef(false);
  const cb = React.useRef({ onOpen, onClose });
  cb.current = { onOpen, onClose };
  const finish = React.useCallback((open) => {
    if (fired.current) return;
    fired.current = true;
    setOut(true);
    setTimeout(() => { const f = open ? cb.current.onOpen : cb.current.onClose; if (f) f(item); }, open ? 0 : 200);
  }, [item]);
  React.useEffect(() => { buzz(); }, []);
  React.useEffect(() => {
    if (drag) return undefined;
    const tm = setTimeout(() => finish(false), 6000);
    return () => clearTimeout(tm);
  }, [drag, finish]);
  const first = item.kind === "firstWeek";
  const tier = first ? 3 : Math.max(1, Math.min(3, Math.floor(Number(item.tier) || 1)));
  const title = first ? "Первые шаги ✦" : item.title || titleOf(item.id);
  const line = toastLine(item, state);
  const down = (e) => { if (e.target.closest && e.target.closest("button")) return; from.current = { x: e.clientX, y: e.clientY }; setDrag({ x: 0, y: 0 }); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {} };
  const move = (e) => { if (!from.current) return; setDrag({ x: e.clientX - from.current.x, y: e.clientY - from.current.y }); };
  const up = () => {
    if (!from.current) return;
    const d = drag || { x: 0, y: 0 };
    from.current = null;
    if (d.y > 46 || Math.abs(d.x) > 90) finish(false); else setDrag(null);
  };
  const dy = drag ? Math.max(0, drag.y) : 0, dx = drag ? drag.x : 0;
  return (
    <div className={"ms-toast-pos" + (out ? " out" : "")} data-ms-toast="">
      <div className="ms-toast" role="status" aria-live="polite" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ padding: "14px 14px 14px", borderRadius: 20, fontFamily: BODY,
          background: a11y ? "linear-gradient(180deg,#FFF9EC,#F4E8CD)" : "linear-gradient(180deg,#2E2312,#1E170C)",
          border: "1px solid " + (a11y ? "rgba(139,106,48,0.42)" : "rgba(214,178,102,0.45)"),
          boxShadow: a11y ? "inset 0 1px 0 #fff, 0 14px 34px rgba(90,66,20,0.28)" : "inset 0 1px 0 rgba(255,236,190,0.14), 0 18px 44px rgba(0,0,0,0.6)",
          transform: drag ? "translate(" + dx + "px," + dy + "px)" : undefined, opacity: drag ? Math.max(0.3, 1 - Math.abs(dx) / 260 - dy / 160) : 1,
          transition: drag ? "none" : "transform .25s ease, opacity .25s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ position: "relative", flexShrink: 0 }}>
            <Medal id={first ? "first" : item.id} tier={tier} size={60} a11y={a11y} ring={false} />
            {burst(SPARKS_SM, true)}
          </span>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 26 }}>
            <div style={{ ...msEye(a11y), color: tierText(tier, a11y) }}>{"✦ Новый значок" + (first ? "" : " · " + TIERS[tier])}</div>
            <div style={{ fontFamily: SERIF, fontSize: a11y ? 19 : 18, fontWeight: 700, lineHeight: 1.2, color: c.text, marginTop: 3 }}>{msTie(title)}</div>
            {line ? <div style={{ fontSize: msSmall(a11y, 13), lineHeight: 1.38, color: c.sub, marginTop: 3 }}>{line}</div> : null}
          </div>
        </div>
        <button type="button" className="sa-btn" onClick={() => { vibrate("light"); finish(true); }}
          style={{ ...msPrimary, width: "100%", minHeight: 44, marginTop: 12, fontSize: a11y ? 16 : 15 }}>Путь мастера ›</button>
        <button type="button" aria-label="Закрыть" onClick={() => finish(false)}
          style={{ position: "absolute", top: 2, right: 2, width: 44, height: 44, display: "grid", placeItems: "center", border: 0, background: "none", cursor: "pointer", padding: 0 }}><XIcon color={c.sub} /></button>
      </div>
    </div>
  );
}

function MasterModal({ a11y, item, onOpen, onClose }) {
  const c = msPal(a11y);
  const fired = React.useRef(false);
  const once = (fn) => () => { if (fired.current) return; fired.current = true; vibrate("light"); if (fn) fn(item); };
  React.useEffect(() => { buzz(); }, []);
  const role = ROLE_TITLE[item.role] || "";
  const title = role ? "Мастер роли «" + role + "» ✦" : "Мастер роли ✦";
  return (
    <div className="ms-modal" data-ms-toast="" onClick={once(onClose)} style={{ background: a11y ? "rgba(70,52,24,0.45)" : "rgba(8,6,3,0.76)" }}>
      <div className="ms-modal-card" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ padding: "22px 20px 16px", borderRadius: 26, fontFamily: BODY,
          background: a11y ? "radial-gradient(120% 70% at 50% 0%,#F7E4B2 0%,#F9F1E0 58%,#F3E8D0 100%)" : "radial-gradient(120% 70% at 50% 0%,#523B16 0%,#261B0C 56%,#1A130A 100%)",
          border: "1px solid " + (a11y ? "rgba(139,106,48,0.45)" : "rgba(232,197,106,0.5)"),
          boxShadow: a11y ? "inset 0 1px 0 #fff, 0 24px 60px rgba(90,66,20,0.35)" : "inset 0 1px 0 rgba(255,236,190,0.18), 0 24px 60px rgba(0,0,0,0.65)" }}>
        <div style={{ position: "relative", width: 128, height: 128, margin: "2px auto 10px" }}>
          <span className="ms-glow" aria-hidden="true" style={{ position: "absolute", inset: -18, borderRadius: "50%", background: "radial-gradient(circle, rgba(243,210,122,0.5) 0%, rgba(243,210,122,0) 68%)" }} />
          <Medal id="master" tier={3} size={128} a11y={a11y} ring={false} style={{ position: "relative" }} />
          {burst(SPARKS, false)}
        </div>
        <div style={{ ...msEye(a11y), color: c.gold }}>✦ Главная награда</div>
        <h2 style={{ margin: "6px 0 8px", fontFamily: SERIF, fontWeight: 700, fontSize: a11y ? 26 : 25, lineHeight: 1.18, color: c.text, textWrap: "balance" }}>{title}</h2>
        <p style={{ margin: "0 0 16px", fontSize: a11y ? 16 : 15, lineHeight: 1.5, color: a11y ? c.sub : "#CFC2A4" }}>{"Роль пройдена, 5\u00A0золотых тем, серия 14\u00A0дней и 10\u00A0значков. Коллеги увидят знак\u00A0✦ у\u00A0твоего имени."}</p>
        <button type="button" className="sa-btn" onClick={once(onOpen)} style={{ ...msPrimary, width: "100%", minHeight: 52, fontSize: a11y ? 17 : 16 }}>Сертификат мастера ›</button>
        <button type="button" className="sa-btn" data-sa-back="" onClick={once(onClose)}
          style={{ display: "block", width: "100%", minHeight: 44, marginTop: 4, border: 0, background: "none", cursor: "pointer", color: a11y ? c.sub : "#CFC2A4", fontFamily: BODY, fontSize: a11y ? 16 : 15, fontWeight: "bold" }}>Позже</button>
      </div>
    </div>
  );
}
