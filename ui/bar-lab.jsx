import React from "react";
import { onActivate, vibrate } from "../lib/utils";
import { GOLD } from "./tokens";
import { COCKTAILS } from "../data/cocktails";
import { buildScenario, checkAction, loadMastery, saveMastery, recordRun, tierOf, TIER_LABEL, MASTERY_LABEL, dailyPick, rushOrders, GLASS_RU, GARNISH_RU, TOOLS, jiggerFor } from "../lib/bar-lab";
import { frostOf } from "./home-hubs";
import { readBarcard, cachedShared } from "../lib/deck-extras";
import { CocktailArt } from "./cocktail-art";
import { report as reportAch } from "../lib/achievements";

// ── Дополнение 208: «Сборка руками» — тренажёр, от которого не оторваться ─────
// Станция внизу: стекло · лёд · ингредиенты · инструмент · гарниш. Тап — действие,
// бокал наполняется слоями. «С подсказкой» — следующий шаг подсвечен и объяснён;
// «По памяти» — тишина, ошибка = «вылил», заново. Мастерство → золотая печать на карточке.

const ICE_RU = { cube: "Кубики", crushed: "Краш", none: "Без льда" };
// Доп. 209: живая станция — струя, лёд, шейк, стир, «вылил», печать
const FX_CSS = `
@keyframes saLabPour { 0% { transform: scaleY(0); opacity: 0 } 15% { opacity: 1 } 85% { transform: scaleY(1); opacity: 1 } 100% { opacity: 0 } }
@keyframes saLabDrop { 0% { transform: translateY(-46px) rotate(-12deg); opacity: 0 } 60% { transform: translateY(2px) rotate(4deg); opacity: 1 } 80% { transform: translateY(-3px) } 100% { transform: translateY(0) } }
@keyframes saLabShake { 0%,100% { transform: translate(0,0) rotate(0) } 20% { transform: translate(-6px,-4px) rotate(-8deg) } 40% { transform: translate(6px,3px) rotate(7deg) } 60% { transform: translate(-5px,2px) rotate(-6deg) } 80% { transform: translate(4px,-3px) rotate(5deg) } }
@keyframes saLabStir { from { transform: rotate(0) } to { transform: rotate(360deg) } }
@keyframes saLabMuddle { 0%,100% { transform: translateY(0) } 50% { transform: translateY(7px) } }
@keyframes saLabSpill { 0% { transform: rotate(0) } 30% { transform: rotate(-32deg) translate(-6px,4px) } 100% { transform: rotate(-38deg) translate(-8px,8px); opacity: .55 } }
@keyframes saLabSplash { 0% { transform: translate(0,0) scale(1); opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) scale(.4); opacity: 0 } }
@keyframes saLabGlow { 0% { box-shadow: 0 0 0 0 rgba(214,178,102,0) } 40% { box-shadow: 0 0 34px 6px rgba(214,178,102,.45) } 100% { box-shadow: 0 0 0 0 rgba(214,178,102,0) } }
@keyframes saLabStamp { 0% { transform: scale(2.2) rotate(-18deg); opacity: 0 } 60% { transform: scale(.92) rotate(-8deg); opacity: 1 } 100% { transform: scale(1) rotate(-10deg); opacity: 1 } }
@keyframes saLabSpark { 0% { transform: translate(0,0) scale(0); opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0 } }
@keyframes saLabIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
@keyframes saLabLift { 0% { transform: translateY(0) rotate(0) } 35% { transform: translateY(-26px) rotate(-38deg) } 70% { transform: translateY(-26px) rotate(-38deg) } 100% { transform: translateY(0) rotate(0) } }
@keyframes saLabScoop { 0% { transform: translateY(0) rotate(0) } 40% { transform: translateY(-18px) rotate(-30deg) } 100% { transform: translateY(0) rotate(0) } }
.sa-lab-lift { animation: saLabLift 1.05s cubic-bezier(.3,.9,.4,1) ; transform-origin: 50% 90%; z-index: 2 }
.sa-lab-scoop { animation: saLabScoop .6s ease-in-out; transform-origin: 50% 90% }
@keyframes saLabStreamIn { to { stroke-dashoffset: 0 } }
@keyframes saLabBubble { 0% { transform: translateY(0) scale(.6); opacity: 0 } 20% { opacity: .9 } 100% { transform: translateY(-46px) scale(1.1); opacity: 0 } }
@keyframes saLabBob { 0%,100% { transform: translateY(0) rotate(0) } 50% { transform: translateY(-1.5px) rotate(2deg) } }
@keyframes saLabTwinkle { 0%,100% { opacity: .25 } 50% { opacity: .9 } }
@keyframes saLabJigger { 0% { transform: translate(-50%,-10px) rotate(0); opacity: 0 } 15% { opacity: 1 } 55% { transform: translate(-50%,0) rotate(0) } 85% { transform: translate(-30%,6px) rotate(-70deg) } 100% { transform: translate(-30%,6px) rotate(-70deg); opacity: 0 } }
@keyframes saLabJiggerFill { from { height: 0 } to { height: var(--h) } }
@keyframes saLabDrip { 0% { transform: translateY(0); opacity: .9 } 100% { transform: translateY(70px); opacity: 0 } }
@keyframes saLabTicket { from { transform: translateY(-14px) rotate(-3deg); opacity: 0 } to { transform: translateY(0) rotate(-1.5deg); opacity: 1 } }
@keyframes saLabServe { 0% { transform: translateY(0) } 40% { transform: translateY(-8px) } 100% { transform: translateY(0) } }
.sa-lab-in { animation: saLabIn .32s cubic-bezier(.16,1,.3,1) backwards }
.sa-lab-bottle:active { transform: scale(.94) }
`;
function LabStyle() { return <style>{FX_CSS}</style>; }
const TOOL_ICON = { shake: "⇅", stir: "↻", strain: "◒", muddle: "⌇", blend: "✱", layer: "≡", swizzle: "∿" };

// ── Бокал: простые контуры в языке витражей; жидкость — по объёму, цвет — смесь добавленного
const GLASS_PATH = {
  rocks: "M22 30 H98 L94 108 H26 Z", highball: "M34 14 H86 L84 112 H36 Z", martini: "M14 22 L60 74 L106 22 Z M60 74 V102 M40 106 H80",
  sour: "M30 26 Q28 74 60 78 Q92 74 90 26 Z M60 78 V102 M40 106 H80", flute: "M42 14 Q40 70 60 76 Q80 70 78 14 Z M60 76 V104 M42 108 H78",
  hurricane: "M36 14 Q30 50 52 64 Q30 84 36 108 H84 Q90 84 68 64 Q90 50 84 14 Z", shot: "M40 40 H80 L76 108 H44 Z",
  irish: "M32 26 H88 Q92 70 74 82 V100 H46 V82 Q28 70 32 26 Z", margarita: "M20 30 H100 L80 60 Q72 68 60 68 Q48 68 40 60 Z M60 68 V102 M40 106 H80", red: "M28 24 Q24 72 60 78 Q96 72 92 24 Z M60 78 V104 M40 108 H80",
};
const LIQ_BOX = { rocks: [26, 34, 68, 72], highball: [37, 18, 46, 92], martini: [22, 26, 76, 44], sour: [32, 30, 56, 44], flute: [44, 20, 32, 52], hurricane: [38, 20, 44, 84], shot: [42, 44, 36, 60], irish: [34, 30, 52, 50], margarita: [24, 34, 72, 30], red: [30, 28, 60, 46] };
const ING_COLOR = (name) => {
  const n = name.toLowerCase();
  if (/кампари|апероль|гренадин|клюкв|вишн|клубн|малин/.test(n)) return "#C4483A";
  if (/апельсин|манго|персик|ананас/.test(n)) return "#E2A63A";
  if (/лайм|мят|мидори|базилик|дын/.test(n)) return "#9BC77A";
  if (/кюрасао|блю/.test(n)) return "#5AA7D8";
  if (/кофе|кола|калуа|тёмн|темн|бурбон|виски|коньяк|бренди|вермут красн|ангостур/.test(n)) return "#6E3E1C";
  if (/слив|молок|бейлис|кокос|белок/.test(n)) return "#EFE4C8";
  if (/содов|тоник|вода|лимонад|игрист|просекко|шампан|энергет/.test(n)) return "#DDE7EA";
  if (/лимон|сироп|мёд|мед|сахар/.test(n)) return "#E8D27A";
  return "#D6B266";
};
const mix = (cols) => { if (!cols.length) return "#D6B266"; const rgb = cols.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))); const avg = [0, 1, 2].map(k => Math.round(rgb.reduce((a, c) => a + c[k], 0) / rgb.length)); return "#" + avg.map(v => v.toString(16).padStart(2, "0")).join(""); };

function GlassView({ glass, fill, colors, ice, garnish, shake, a11y, spilled, layers, floatColor, bubbles, served }) {
  const path = GLASS_PATH[glass] || GLASS_PATH.rocks; const box = LIQ_BOX[glass] || LIQ_BOX.rocks;
  const line = a11y ? "#8B6A30" : GOLD; const liq = mix(colors);
  const [x, y, w, h] = box; const lh = Math.min(1, fill) * h;
  // Доп. 220: слоистые коктейли — полосы по порядку; флоат — тонкий слой сверху; пузырьки; лёд покачивается; краш искрится
  const total = layers && layers.length ? layers.reduce((a, l) => a + l.ml, 0) || 1 : 1;
  let acc = 0;
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ filter: shake ? "blur(0.6px)" : "none", transform: spilled ? "rotate(-28deg) translateY(10px)" : shake ? "rotate(-3deg)" : "none", transition: "transform .35s cubic-bezier(.3,1.4,.4,1)", overflow: "visible" }}>
      <defs><clipPath id={"gl-" + glass}><path d={path.split(" M")[0]} /></clipPath>
        <radialGradient id="sa-spot" cx="50%" cy="0%" r="80%"><stop offset="0%" stopColor="rgba(255,236,190,0.35)" /><stop offset="100%" stopColor="rgba(255,236,190,0)" /></radialGradient></defs>
      {served && <><ellipse cx="60" cy="114" rx="34" ry="5" fill="rgba(0,0,0,0.45)" /><ellipse cx="60" cy="112" rx="30" ry="4" fill="#3a2a12" stroke={line} strokeWidth="1" /><rect x="0" y="0" width="120" height="120" fill="url(#sa-spot)" /></>}
      <g clipPath={`url(#gl-${glass})`}>
        {!spilled && layers && layers.length > 0 ? layers.map((l, i) => { const lhh = (l.ml / total) * lh; const yy = y + h - (acc + l.ml) / total * lh; acc += l.ml; return <rect key={i} x={x} y={yy} width={w} height={lhh} fill={l.color} opacity="0.9" style={{ transition: "y .4s ease, height .4s ease" }} />; })
          : !spilled && lh > 0 && <rect x={x} y={y + h - lh} width={w} height={lh} fill={liq} opacity="0.85" style={{ transition: "y .4s ease, height .4s ease" }} />}
        {!spilled && floatColor && lh > 0 && <rect x={x} y={y + h - lh} width={w} height={Math.max(6, lh * 0.18)} fill={floatColor} opacity="0.95" />}
        {!spilled && ice === "cube" && [0, 1, 2].map(i => <rect key={i} x={x + 6 + i * (w / 3.2)} y={y + h - lh - 2 + i * 6} width={w / 4} height={w / 4} rx="3" fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.6)" strokeWidth="1" style={{ animation: lh > 0 ? `saLabBob ${2.4 + i * 0.5}s ease-in-out infinite` : "none", transformOrigin: "center" }} />)}
        {!spilled && ice === "crushed" && Array.from({ length: 14 }).map((_, i) => <circle key={i} cx={x + 6 + (i * 37) % w} cy={y + 8 + (i * 23) % (h - 12)} r="3.5" fill="rgba(255,255,255,0.45)" style={{ animation: `saLabTwinkle ${1.6 + (i % 4) * 0.4}s ease-in-out ${i * 0.13}s infinite` }} />)}
        {!spilled && bubbles && lh > 0 && Array.from({ length: 9 }).map((_, i) => <circle key={i} cx={x + 6 + (i * 31) % (w - 8)} cy={y + h - 4} r={1.2 + (i % 3) * 0.6} fill="rgba(255,255,255,0.75)" style={{ animation: `saLabBubble ${1.4 + (i % 3) * 0.5}s ease-out ${i * 0.17}s infinite` }} />)}
      </g>
      <path d={path} fill="none" stroke={line} strokeWidth="2" strokeLinejoin="round" />
      {garnish && garnish !== "none" && <g transform="translate(88 18)" style={{ animation: served ? "saLabBob 3s ease-in-out infinite" : "none" }}><circle r="8" fill={garnish === "cherry" ? "#C4483A" : garnish === "olive" || garnish === "mint" ? "#7FA05A" : garnish === "cream" ? "#EFE4C8" : "#E2A63A"} stroke={line} strokeWidth="1.2" /></g>}
    </svg>
  );
}
// Доп. 220: джиггер — наполняется до метки и опрокидывается в сосуд
function Jigger({ amount, color, gold }) {
  const frac = Math.min(1, amount / 60);
  return (
    <div style={{ position: "absolute", left: "50%", top: -6, width: 34, height: 44, animation: "saLabJigger 1s ease-in-out forwards", transformOrigin: "60% 90%", zIndex: 3 }}>
      <svg viewBox="0 0 34 44" width="34" height="44">
        <defs><clipPath id="jg"><path d="M4 2h26l-10 20 10 20H4l10-20z" /></clipPath></defs>
        <rect x="4" y={42 - 18 * frac} width="26" height={18 * frac} fill={color} clipPath="url(#jg)" opacity="0.9" />
        <path d="M4 2h26l-10 20 10 20H4l10-20z" fill="rgba(220,220,230,0.12)" stroke={gold} strokeWidth="1.5" />
        <path d="M6 30h22" stroke={gold} strokeWidth="0.8" opacity="0.6" />
      </svg>
      <div style={{ position: "absolute", top: -12, left: 0, right: 0, textAlign: "center", fontSize: 9, letterSpacing: 1, color: gold, fontFamily: "monospace" }}>{amount} мл</div>
    </div>
  );
}
// Доп. 220: струя с изгибом и каплями
function Stream({ color, from, to, curved }) {
  const d = curved ? `M${from[0]} ${from[1]} Q ${(from[0] + to[0]) / 2 + 14} ${(from[1] + to[1]) / 2} ${to[0]} ${to[1]}` : `M${from[0]} ${from[1]} L${to[0]} ${to[1]}`;
  return (
    <svg viewBox="0 0 200 150" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
      <path d={d} stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.9" style={{ strokeDasharray: 200, strokeDashoffset: 200, animation: "saLabStreamIn .6s ease-out forwards" }} />
      {[0, 1, 2].map(i => <circle key={i} cx={to[0] + (i - 1) * 6} cy={to[1] - 6} r="2.6" fill={color} style={{ animation: `saLabDrip .5s ${0.45 + i * 0.08}s ease-in forwards`, opacity: 0 }} />)}
    </svg>
  );
}

// Доп. 219: форма бутылки по типу продукта
export function bottleKind(name) {
  const n = String(name || "").toLowerCase().replace(/ё/g, "е");
  if (/ангостур|биттер|табаско|вустер|острый соус/.test(n)) return "dasher";
  if (/сироп|мед\b|медов|гренадин|оржа/.test(n)) return "syrup";
  if (/сок|морс|пюре|сливк|молок|кокос|эспрессо|кофе|вода\b/.test(n)) return "jug";
  if (/содов|тоник|кола|лимонад|спрайт|имбирн|энергет|газиров/.test(n)) return "soda";
  if (/шампан|просекко|игрист/.test(n)) return "champagne";
  if (/вино|вермут/.test(n)) return "wine";
  if (/ликер|куантро|трипл|кампари|апероль|крем де|бейлис|драмбуи|мараскино|кюрасао|самбука|абсент|мидори|калуа|гран марнье|амаретто|кассис|мюр|виолет|персиков|дынн/.test(n)) return "liqueur";
  if (/джин|водка|текила|кашас|ром\b|виски|бурбон|скотч|коньяк|бренди/.test(n)) return "spirit";
  return "fresh"; // мята, лайм, сахар, соль, белок, ягоды…
}
const BOTTLE_PATHS = {
  spirit:   { d: "M17 2h10v11l4 5v40a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4V18l4-5z", liq: [13, 22, 18, 40], label: [13, 34, 18, 12] },
  liqueur:  { d: "M18 2h8v10c7 3 9 8 9 14v32a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4V26c0-6 2-11 9-14z", liq: [9, 24, 26, 38], label: [9, 36, 26, 12] },
  wine:     { d: "M19 2h6v14c5 2 6 6 6 10v32a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4V26c0-4 1-8 6-10z", liq: [13, 26, 18, 36], label: [13, 38, 18, 12] },
  champagne:{ d: "M19 2h6v12c6 3 7 8 7 13v31a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V27c0-5 1-10 7-13z", liq: [12, 26, 20, 36], label: [12, 38, 20, 12] },
  soda:     { d: "M18 2h8v9l3 4v43a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V15l3-4z", liq: [15, 18, 14, 44], label: [15, 32, 14, 10] },
  syrup:    { d: "M20 2h4l2 7v8c4 2 5 6 5 10v31a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4V27c0-4 1-8 5-10V9z", liq: [13, 26, 18, 36], label: [13, 38, 18, 12] },
  dasher:   { d: "M20 8h4v6c4 1 6 4 6 8v34a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3V22c0-4 2-7 6-8z", liq: [14, 22, 16, 37], label: [14, 34, 16, 10] },
  jug:      { d: "M10 14h22l2 4v40a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V18zM32 22h6v14h-6", liq: [8, 22, 26, 40], label: [8, 40, 26, 10] },
  fresh:    { d: "M8 30a14 14 0 0 1 28 0v22a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z", liq: [8, 30, 28, 26], label: [8, 44, 28, 10] },
};
function Bottle({ color, label, on, dim, ghost, gold, a11y, onClick, delay = 0, lifting }) {
  const kind = bottleKind(label); const sh = BOTTLE_PATHS[kind] || BOTTLE_PATHS.spirit;
  const text = a11y ? "#2A1F0E" : "#EFE4C8";
  const short = String(label).replace(/\s*\(.*?\)/g, "").split(" ").slice(0, 2).join(" ");
  return (
    <div className={"sa-lab-in sa-lab-bottle" + (lifting ? " sa-lab-lift" : "")} onClick={onClick} {...onActivate(onClick)} style={{ animationDelay: lifting ? "0ms" : `${delay}ms`, width: 78, flexShrink: 0, cursor: "pointer", opacity: dim ? 0.42 : 1, textAlign: "center", transition: "transform .12s" }}>
      <div style={{ width: 52, height: 73, margin: "0 auto 5px", position: "relative", filter: on ? "drop-shadow(0 0 8px rgba(214,178,102,.75))" : "drop-shadow(0 4px 4px rgba(0,0,0,.35))" }}>
        <svg viewBox="0 0 44 62" width="52" height="73">
          <defs><clipPath id={"bt-" + kind}><path d={sh.d} /></clipPath></defs>
          <path d={sh.d} fill={a11y ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.06)"} stroke={on ? gold : (a11y ? "#8B6A30" : "rgba(255,255,255,0.28)")} strokeWidth={on ? 1.6 : 1} />
          {!ghost && <rect x={sh.liq[0]} y={sh.liq[1]} width={sh.liq[2]} height={sh.liq[3]} fill={color} opacity="0.9" clipPath={`url(#bt-${kind})`} />}
          {kind === "soda" && [0, 1, 2, 3].map(i => <circle key={i} cx={19 + (i * 5) % 8} cy={50 - i * 9} r="1.3" fill="rgba(255,255,255,0.7)" clipPath={`url(#bt-${kind})`} />)}
          {kind === "fresh" && <path d="M14 30c4-6 12-6 16 0" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" fill="none" />}
          <rect x={sh.label[0] + 1} y={sh.label[1]} width={sh.label[2] - 2} height={sh.label[3]} rx="1.5" fill={a11y ? "rgba(255,252,240,0.95)" : "rgba(238,228,200,0.92)"} />
          <text x="22" y={sh.label[1] + sh.label[3] * 0.72} textAnchor="middle" fontSize={Math.min(5.2, (sh.label[2] - 3) / Math.max(4, short.length) * 1.9)} fontFamily="Georgia, serif" fill="#2A1F0E">{short.length > 14 ? short.slice(0, 13) + "…" : short}</text>
          <path d={`M${sh.liq[0] + 2} ${sh.liq[1] + 4} v${sh.liq[3] - 8}`} stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        {dim && <div style={{ position: "absolute", right: -2, top: -2, width: 16, height: 16, borderRadius: 8, background: "#5DBB8A", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>}
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.2, color: on ? gold : text, height: 27, overflow: "hidden" }}>{label}</div>
    </div>
  );
}
function Item({ icon, label, on, gold, a11y, onClick, delay = 0, wide }) {
  const text = a11y ? "#2A1F0E" : "#EFE4C8";
  return (
    <div className="sa-lab-in sa-lab-bottle" onClick={onClick} {...onActivate(onClick)} style={{ animationDelay: `${delay}ms`, minWidth: wide ? 88 : 64, flexShrink: 0, cursor: "pointer", textAlign: "center", transition: "transform .12s" }}>
      <div style={{ width: 54, height: 54, margin: "0 auto 5px", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${on ? gold : (a11y ? "#8B6A3055" : "rgba(255,255,255,0.14)")}`, background: on ? "rgba(214,178,102,0.16)" : (a11y ? "rgba(255,255,255,0.45)" : "rgba(255,248,230,0.05)"), boxShadow: on ? `0 0 14px rgba(214,178,102,.45)` : "none" }}>{icon}</div>
      <div style={{ fontSize: 10.5, lineHeight: 1.2, color: on ? gold : text, height: 26, overflow: "hidden" }}>{label}</div>
    </div>
  );
}
const GlassIcon = ({ glass, a11y }) => <div style={{ width: 34, height: 34 }}><GlassView glass={glass} fill={0} colors={[]} a11y={a11y} /></div>;
const ToolIcon = ({ id, gold }) => <span style={{ fontSize: 22, color: gold, lineHeight: 1 }}>{TOOL_ICON[id] || "•"}</span>;
const GarnishIcon = ({ id }) => <span style={{ width: 18, height: 18, borderRadius: 9, display: "inline-block", background: id === "cherry" ? "#C4483A" : id === "olive" || id === "mint" ? "#7FA05A" : id === "cream" ? "#EFE4C8" : id === "salt" ? "#F2F2F2" : id === "onion" ? "#E8E4D0" : "#E2A63A", border: "1px solid rgba(255,255,255,0.35)" }} />;
const IceIcon = ({ id, gold }) => <span style={{ fontSize: 20, color: gold }}>{id === "cube" ? "▢" : id === "crushed" ? "∴" : "∅"}</span>;

// Доп. 219: сосуд на сцене — в него льётся, в нём лёд, он дрожит; при стрейне переливается в бокал
function VesselView({ kind, fill, colors, ice, a11y, shake, tilt }) {
  const line = a11y ? "#8B6A30" : GOLD; const liq = mix(colors);
  const shapes = {
    shaker: { d: "M38 8h44l-6 30v58a6 6 0 0 1-6 6H50a6 6 0 0 1-6-6V38z M40 8h40v-6H40z", box: [46, 40, 28, 60], cap: true },
    mixing: { d: "M36 12h48v86a6 6 0 0 1-6 6H42a6 6 0 0 1-6-6z", box: [40, 16, 40, 84], spoon: true },
    blender: { d: "M40 10h40l6 84a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6z", box: [40, 16, 40, 82], lid: true },
  };
  const s = shapes[kind] || shapes.shaker; const [x, y, w, h] = s.box; const lh = Math.min(1, fill) * h;
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ transform: tilt ? "rotate(-48deg) translate(14px,-8px)" : "none", transition: "transform .45s cubic-bezier(.3,1.2,.4,1)", animation: shake ? "saLabShake .8s ease-in-out" : "none" }}>
      <defs><clipPath id={"vs-" + kind}><path d={s.d.split(" M")[0]} /></clipPath></defs>
      <g clipPath={`url(#vs-${kind})`}>
        {lh > 0 && <rect x={x} y={y + h - lh} width={w} height={lh} fill={liq} opacity="0.88" style={{ transition: "y .4s ease, height .4s ease" }} />}
        {ice === "cube" && [0, 1, 2, 3].map(i => <rect key={i} x={x + 4 + (i % 2) * 14} y={y + h - lh - 4 + Math.floor(i / 2) * 12} width="11" height="11" rx="3" fill="rgba(255,255,255,0.4)" stroke="rgba(255,255,255,0.65)" strokeWidth="1" />)}
        {ice === "crushed" && Array.from({ length: 12 }).map((_, i) => <circle key={i} cx={x + 5 + (i * 29) % (w - 8)} cy={y + 6 + (i * 19) % (h - 12)} r="3" fill="rgba(255,255,255,0.45)" />)}
      </g>
      <path d={s.d} fill={kind === "shaker" ? "rgba(200,200,210,0.10)" : "none"} stroke={line} strokeWidth="2" strokeLinejoin="round" />
      {s.spoon && <path d="M92 6 L64 84" stroke={line} strokeWidth="2" strokeLinecap="round" opacity="0.8" />}
      {kind === "shaker" && <path d="M46 40h28" stroke={line} strokeWidth="1" opacity="0.5" />}
    </svg>
  );
}

const ukOf = (profile) => profile ? `_${profile.name}_${profile.surname || ""}` : "";

export function BarLabScreen({ T, a11y, profile, onBack, startId, onOpenDeck }) {
  const gold = a11y ? "#8B6A30" : GOLD; const text = T.modTitle.color, sub = T.modSub.color, frost = frostOf(a11y);
  const uk = ukOf(profile);
  const [mastery, setMastery] = React.useState(() => loadMastery(uk));
  const [view, setView] = React.useState(startId ? "pick" : "hub"); // hub | pick | play | rush | station
  const [current, setCurrent] = React.useState(() => startId ? COCKTAILS.find(c => c.id === startId) || null : null);
  const [mode, setMode] = React.useState("hint");
  const [rush, setRush] = React.useState(null); // { orders, i, started, penalties }
  const [rushBest, setRushBest] = React.useState(() => { try { return Number(localStorage.getItem("sa_bar_rush_best" + uk) || 0); } catch (e) { return 0; } });
  const daily = React.useMemo(() => dailyPick(COCKTAILS), []);
  // Доп. 214: своя карта бара — своё впереди, чужое ниже как эрудиция; Час пик и коктейль дня — из карты
  const card = React.useMemo(() => readBarcard(cachedShared(profile?.restaurant || "")), [profile]);
  const inCard = (c) => !card || card.includes(c.id);
  const dailyC = React.useMemo(() => { if (!card || card.includes(daily.id)) return daily; const mine = COCKTAILS.filter(inCard); return mine.length ? dailyPick(mine) : daily; }, [card, daily]);
  const save = (m) => { setMastery(m); saveMastery(uk, m); reportAch(uk, "stamps", COCKTAILS.filter(c => (m[c.id]?.level || 0) >= 2).length); }; // Доп. 216: печати — в рекорды команды
  const masteredCount = (t) => COCKTAILS.filter(c => (t ? tierOf(c) === t : true) && (mastery[c.id]?.level || 0) >= 2).length;
  const cardTotal = (t) => COCKTAILS.filter(c => (t ? tierOf(c) === t : true) && inCard(c)).length;
  const pill = (on) => ({ padding: "6px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: `1px solid ${on ? gold : gold + "55"}`, background: on ? "rgba(214,178,102,0.16)" : "transparent", color: on ? text : sub });

  const startPlay = (c, m) => { setCurrent(c); setMode(m); setView("play"); vibrate("light"); };
  const finishPlay = (clean) => {
    save(recordRun(mastery, current.id, mode, clean));
    if (rush) {
      const next = rush.i + 1;
      if (next >= rush.orders.length) {
        const total = Math.round((Date.now() - rush.started) / 1000) + rush.penalties;
        const best = rushBest && rushBest < total ? rushBest : total;
        setRushBest(best); try { localStorage.setItem("sa_bar_rush_best" + uk, String(best)); } catch (e) {}
        reportAch(uk, "rush_best", total); // Доп. 216
        setRush({ ...rush, done: true, total }); setView("rush");
      } else { setRush({ ...rush, i: next }); setCurrent(rush.orders[next]); setView("play"); }
    }
  };

  const Head = (title, backTo) => (
    <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
      <button className="sa-btn" onClick={backTo || onBack} {...onActivate(backTo || onBack)} aria-label="Назад" style={{ border: "none", background: "transparent", color: gold, fontSize: 22, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, letterSpacing: 1.5, color: gold }}>СБОРКА · БАР</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: text, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────── HUB
  if (view === "hub") {
    const stamps = masteredCount();
    const card = (props, children) => <div className="sa-card" {...props} style={{ ...frost, borderRadius: 18, padding: "14px 15px", marginBottom: 10, cursor: props.onClick ? "pointer" : "default", ...(props.style || {}) }}>{children}</div>;
    return (
      <div style={T.screen} className="sa-screen">
        <LabStyle />
        {Head("Сборка руками")}
        <div style={{ padding: "4px 16px 100px" }}>
          {card({ onClick: () => { setCurrent(dailyC); setView("pick"); vibrate("light"); } }, <>
            <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", marginBottom: 6 }}>КОКТЕЙЛЬ ДНЯ</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 56, height: 56, flexShrink: 0 }}><GlassView glass={dailyC.glass} fill={0.7} colors={dailyC.ing.map(i => ING_COLOR(i[0]))} ice={dailyC.ice === "crushed" ? "crushed" : dailyC.ice ? "cube" : null} garnish={dailyC.garnish} a11y={a11y} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 19, color: text }}>{dailyC.name}</div>
                <div style={{ fontSize: 12.5, color: sub }}>{dailyC.method} · {GLASS_RU[dailyC.glass]} · {MASTERY_LABEL[mastery[dailyC.id]?.level || 0]}</div>
              </div>
              <span style={{ color: gold, fontSize: 18 }}>›</span>
            </div>
          </>)}
          {card({}, <>
            <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", marginBottom: 6 }}>МАСТЕРСТВО · {stamps} ИЗ {cardTotal()} ПЕЧАТЕЙ{card ? " · СВОЯ КАРТА" : ""}</div>
            {[1, 2, 3].map(t => { const total = cardTotal(t); const n = COCKTAILS.filter(c => tierOf(c) === t && inCard(c) && (mastery[c.id]?.level || 0) >= 2).length; return (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <div style={{ width: 84, fontSize: 12.5, color: text }}>{TIER_LABEL[t]}</div>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: a11y ? "rgba(139,106,48,0.18)" : "rgba(214,178,102,0.16)" }}><div style={{ width: `${total ? (n / total) * 100 : 0}%`, height: "100%", borderRadius: 3, background: gold, transition: "width .6s" }} /></div>
                <div style={{ width: 44, textAlign: "right", fontSize: 12, color: sub, fontFamily: "monospace" }}>{n}/{total}</div>
              </div>); })}
            <div style={{ fontSize: 12, color: sub, marginTop: 8, lineHeight: 1.5 }}>Печать — коктейль собран по памяти. Три раза подряд без ошибок — «мастер».</div>
          </>)}
          {card({ onClick: () => { const orders = rushOrders(COCKTAILS, mastery, 3, card); setRush({ orders, i: 0, started: Date.now(), penalties: 0 }); setCurrent(orders[0]); setMode("memory"); setView("play"); vibrate("heavy"); } }, <>
            <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", marginBottom: 6 }}>ЧАС ПИК</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 18, color: text }}>Три заказа на время</div>
                <div style={{ fontSize: 12.5, color: sub, marginTop: 3 }}>{rushBest ? `Твой рекорд ${rushBest} с` : "По памяти · ошибка +10 с · рекорд в Рейтинг команды"}</div>
              </div>
              <span style={{ color: gold, fontSize: 18 }}>›</span>
            </div>
          </>)}
          {onOpenDeck && card({ onClick: () => onOpenDeck(null) }, <>
            <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", marginBottom: 6 }}>ВЫБРАТЬ КОКТЕЙЛЬ</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 18, color: text }}>Колода бармена</div>
                <div style={{ fontSize: 12.5, color: sub, marginTop: 3 }}>Любая карточка · на обороте «Собрать руками» · печати видны в указателе</div>
              </div>
              <span style={{ color: gold, fontSize: 18 }}>›</span>
            </div>
          </>)}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────── PICK MODE
  if (view === "pick" && current) {
    const lv = mastery[current.id]?.level || 0;
    return (
      <div style={T.screen} className="sa-screen">
        {Head(current.name, () => setView("hub"))}
        <div style={{ padding: "4px 16px 100px" }}>
          <div style={{ ...frost, borderRadius: 18, padding: 16, display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 96, height: 96, flexShrink: 0 }}><GlassView glass={current.glass} fill={0.75} colors={current.ing.map(i => ING_COLOR(i[0]))} ice={current.ice === "crushed" ? "crushed" : current.ice ? "cube" : null} garnish={current.garnish} a11y={a11y} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: sub }}>{current.method} · {GLASS_RU[current.glass]} · {current.ing.length} ингр.</div>
              <div style={{ fontSize: 12.5, color: lv >= 2 ? gold : sub, marginTop: 4 }}>{lv >= 2 ? "✦ " : ""}{MASTERY_LABEL[lv]}{mastery[current.id]?.streak ? ` · серия ${mastery[current.id].streak}` : ""}</div>
              {onOpenDeck && <div onClick={() => onOpenDeck(current.id)} style={{ fontSize: 12.5, color: gold, marginTop: 8, cursor: "pointer" }}>Карточка в Колоде ›</div>}
            </div>
          </div>
          <div className="sa-card" onClick={() => startPlay(current, "hint")} {...onActivate(() => startPlay(current, "hint"))} style={{ ...frost, borderRadius: 18, padding: "14px 16px", marginBottom: 10, cursor: "pointer" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: text }}>С подсказкой</div>
            <div style={{ fontSize: 12.5, color: sub, marginTop: 3, lineHeight: 1.5 }}>Следующий шаг подсвечен, ошибка объясняется словами урока. Учишься телом, не текстом.</div>
          </div>
          <div className="sa-card" onClick={() => startPlay(current, "memory")} {...onActivate(() => startPlay(current, "memory"))} style={{ ...frost, borderRadius: 18, padding: "14px 16px", cursor: "pointer", borderColor: gold + "88" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: text }}>По памяти ✦</div>
            <div style={{ fontSize: 12.5, color: sub, marginTop: 3, lineHeight: 1.5 }}>Как за стойкой: подсказок нет, ошибка — «вылил», заново. Собрал чисто — печать на карточке.</div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────── PLAY
  if (view === "play" && current) return <Play key={current.id + mode + (rush ? rush.i : "")} c={current} mode={mode} T={T} a11y={a11y} gold={gold} frost={frost} Head={Head} rush={rush} onPenalty={() => rush && setRush(r => ({ ...r, penalties: r.penalties + 10 }))}
    onExit={() => { setRush(null); setView(rush ? "hub" : "pick"); }} onFinish={finishPlay} />;

  // ─────────────────────────────────────────────── RUSH RESULT
  if (view === "rush" && rush?.done) return (
    <div style={T.screen} className="sa-screen">
      {Head("Час пик", () => { setRush(null); setView("hub"); })}
      <div style={{ padding: "20px 16px 100px", textAlign: "center" }}>
        <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace" }}>{rush.total <= rushBest ? "НОВЫЙ РЕКОРД ✦" : "СМЕНА ОТРАБОТАНА"}</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 46, color: text, margin: "6px 0" }}>{rush.total} с</div>
        <div style={{ fontSize: 13, color: sub }}>{rush.orders.map(o => o.name).join(" · ")}{rush.penalties ? ` · штрафы +${rush.penalties} с` : " · без ошибок"}</div>
        <button className="sa-btn" onClick={() => { const orders = rushOrders(COCKTAILS, mastery, 3, card); setRush({ orders, i: 0, started: Date.now(), penalties: 0 }); setCurrent(orders[0]); setMode("memory"); setView("play"); }} style={{ ...T.doneBtn, background: gold, marginTop: 22, width: "100%" }}>Ещё смену ›</button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────── STATION PREP
  return null;
}

// ── Игровой экран одного коктейля ──────────────────────────────────────────────
function Play({ c, mode, T, a11y, gold, frost, Head, rush, onPenalty, onExit, onFinish }) {
  const text = T.modTitle.color, sub = T.modSub.color;
  const sc = React.useMemo(() => buildScenario(c, COCKTAILS), [c]);
  const [done, setDone] = React.useState([]);
  const [msg, setMsg] = React.useState(null); // { ok, text }
  const [mistakes, setMistakes] = React.useState(0);
  const [spilled, setSpilled] = React.useState(false);
  const [pending, setPending] = React.useState(null); // ингредиент, ждём объём
  const [finished, setFinished] = React.useState(null);
  const [shake, setShake] = React.useState(false);
  const [fx, setFx] = React.useState(null); // { kind: pour|drop|stir|muddle|strain|garnish|win|spill, color }
  const [jig, setJig] = React.useState(null); // Доп. 220: джиггер на сцене
  const [lift, setLift] = React.useState(null); // Доп. 224: «рука бармена» — какая бутылка сейчас в руке
  const fxTimer = React.useRef(null);
  const playFx = (kind, color, ms = 650) => { clearTimeout(fxTimer.current); setFx({ kind, color, key: Date.now() }); fxTimer.current = setTimeout(() => setFx(null), ms); };
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { if (!rush) return; const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }, [rush]);

  const glassStep = sc.steps.find(s => s.kind === "glass"); const glassDone = done.includes(sc.steps.indexOf(glassStep));
  const addedIngs = sc.steps.filter((s, i) => s.kind === "ing" && done.includes(i));
  const totalMl = sc.spec.ing.reduce((a, i) => a + (String(i[2] || "мл").startsWith("мл") ? Number(i[1]) || 0 : 0), 0) || 1;
  // Доп. 219: сосуд на сцене — что в шейкере, что в бокале
  const vesselKind = sc.steps.some(s => s.where === "shaker") ? "shaker" : sc.steps.some(s => s.where === "mixing") ? "mixing" : sc.steps.some(s => s.where === "blender") ? "blender" : null;
  const strained = sc.steps.some((s, i) => s.kind === "tool" && s.id === "strain" && done.includes(i)) || (vesselKind === "blender" && sc.steps.some((s, i) => s.kind === "tool" && s.id === "blend" && done.includes(i)));
  const inVessel = addedIngs.filter(s => s.where && s.where !== "glass");
  const inGlassDirect = addedIngs.filter(s => !s.where || s.where === "glass");
  const vesselMl = inVessel.reduce((a, s) => a + (s.unit === "мл" ? Number(s.amount) || 0 : 0), 0);
  const fillMl = inGlassDirect.reduce((a, s) => a + (s.unit === "мл" ? Number(s.amount) || 0 : 0), 0) + (strained ? vesselMl : 0);
  const glassColors = [...inGlassDirect, ...(strained ? inVessel : [])].map(s => ING_COLOR(s.name));
  const iceInVessel = sc.steps.find((s, i) => s.kind === "ice" && s.where && s.where !== "glass" && done.includes(i));
  // Доп. 220: слои для слоистых, флоат сверху, пузырьки после газировки
  const layers = c.method === "слои" ? inGlassDirect.map(s => ({ color: ING_COLOR(s.name), ml: Number(s.amount) || 20 })) : null;
  const floatStep = addedIngs.find(s => /флоат/.test(String(s.label || "")) || /флоат|взбит/.test(String((sc.spec.ing.find(i => i[0] === s.name) || [])[2] || "")));
  const fizzy = addedIngs.some(s => /содов|тоник|кола|лимонад|спрайт|имбирн|энергет|просекко|шампан|игрист/.test(s.name.toLowerCase()));
  const iceInGlass = sc.steps.find((s, i) => s.kind === "ice" && s.where === "glass" && done.includes(i));
  const vesselActive = vesselKind && !strained && (inVessel.length > 0 || iceInVessel || (expectedWhere() !== "glass"));
  function expectedWhere() { const e = sc.steps.map((s, i) => ({ s, i })).find(x => !done.includes(x.i)); return e && e.s.where ? e.s.where : "glass"; }
  const garnishDone = sc.steps.find((s, i) => s.kind === "garnish" && done.includes(i));
  const expected = sc.steps.map((s, i) => ({ s, i })).find(x => !done.includes(x.i));

  const act = (action) => {
    if (finished || spilled) return;
    const r = checkAction(sc, done, action);
    if (r.ok) {
      setDone(r.doneIdx); setMsg(null); vibrate("light");
      if (action.kind === "ing") { setLift(action.name); setTimeout(() => setLift(null), 1100); }
      if (action.kind === "ing" && action.amount != null) { const col = ING_COLOR(action.name); setJig({ amount: action.amount, color: col, key: Date.now() }); setTimeout(() => { setJig(null); playFx("pour", col, 700); }, 850); }
      else if (action.kind === "ing") setTimeout(() => playFx("pour", ING_COLOR(action.name), 700), 350);
      else if (action.kind === "ice") playFx("drop", null, 600);
      else if (action.kind === "tool" && (action.id === "shake" || action.id === "blend")) { setShake(true); playFx("shake", null, 800); setTimeout(() => setShake(false), 800); vibrate("medium"); }
      else if (action.kind === "tool" && (action.id === "stir" || action.id === "swizzle")) playFx("stir", null, 900);
      else if (action.kind === "tool" && action.id === "muddle") playFx("muddle", null, 700);
      else if (action.kind === "tool" && action.id === "strain") playFx("strain", mix(inVessel.map(s => ING_COLOR(s.name))), 900);
      else if (action.kind === "garnish") playFx("drop", null, 500);
      if (r.done) { const clean = mistakes === 0; setFinished({ clean }); vibrate("success"); setTimeout(() => playFx("win", null, 1600), 120); setTimeout(() => onFinish(clean), rush ? 900 : 0); }
    } else {
      setMistakes(m => m + 1); vibrate("error");
      if (mode === "memory") { setSpilled(true); playFx("spill", mix(addedIngs.map(s => ING_COLOR(s.name))) , 1400); setMsg({ ok: false, text: r.why + " Вылил — собираем заново." }); if (rush) onPenalty(); setTimeout(() => { setDone([]); setSpilled(false); setMsg(null); setPending(null); }, 1400); }
      else setMsg({ ok: false, text: r.why });
    }
  };
  const tapIng = (name) => {
    const step = sc.steps.find(s => s.kind === "ing" && s.name === name);
    if (step && step.unit === "мл") setPending(name); else act({ kind: "ing", name });
  };
  const chip = (on, extra) => ({ padding: "8px 11px", borderRadius: 12, fontSize: 12.5, cursor: "pointer", border: `1px solid ${on ? gold : gold + "44"}`, background: on ? "rgba(214,178,102,0.18)" : (a11y ? "rgba(255,255,255,0.45)" : "rgba(255,248,230,0.05)"), color: on ? text : sub, whiteSpace: "nowrap", ...extra });
  const hint = (step) => mode === "hint" && expected && expected.s === step;
  const elapsed = rush ? Math.round((Date.now() - rush.started) / 1000) + rush.penalties : 0;

  return (
    <div style={T.screen} className="sa-screen">
      <LabStyle />
      {Head(c.name, onExit)}
      <div style={{ padding: "0 16px 110px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, letterSpacing: 1.4, fontFamily: "monospace", color: sub, marginBottom: 8 }}>
          <span>{mode === "hint" ? "С ПОДСКАЗКОЙ" : "ПО ПАМЯТИ ✦"}{rush ? ` · ЗАКАЗ ${rush.i + 1}/${rush.orders.length}` : ""}</span>
          <span>{rush ? `${elapsed} с` : `${done.length}/${sc.steps.length}`}{mistakes ? ` · ошибок ${mistakes}` : ""}</span>
        </div>
        {/* Доп. 220: Час пик — заказы выезжают чеками из принтера на стойке */}
        {rush && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 10, overflow: "hidden", height: 54 }}>
            {rush.orders.map((o, i) => { const cur = i === rush.i, past = i < rush.i; return (
              <div key={o.id + i} className={cur ? "sa-lab-in" : ""} style={{ flexShrink: 0, width: cur ? 150 : 96, padding: cur ? "8px 10px" : "6px 8px", background: past ? "#cfc6ad" : "#F2ECD8", color: "#2A1F0E", fontFamily: "ui-monospace, Menlo, monospace", fontSize: cur ? 12 : 10, lineHeight: 1.25, borderRadius: "2px 2px 6px 6px", boxShadow: "0 4px 10px rgba(0,0,0,.35)", opacity: past ? 0.5 : cur ? 1 : 0.75, transform: cur ? "rotate(-1.5deg)" : "translateY(10px) rotate(1deg)", animation: cur ? "saLabTicket .45s cubic-bezier(.2,1.2,.3,1)" : "none", borderTop: "2px dashed rgba(0,0,0,.25)" }}>
                <div style={{ fontSize: 8.5, letterSpacing: 1.2, opacity: 0.6 }}>ЗАКАЗ №{i + 1}{past ? " · ГОТОВ" : cur ? " · В РАБОТЕ" : ""}</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: cur ? 14 : 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</div>
              </div>); })}
          </div>
        )}
        {/* шаги — точки, заполняются по мере сборки */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>{sc.steps.map((s, i) => <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: done.includes(i) ? gold : (a11y ? "rgba(139,106,48,0.22)" : "rgba(214,178,102,0.18)"), transition: "background .3s" }} />)}</div>
        <div style={{ ...frost, borderRadius: 22, padding: "16px 12px 12px", display: "flex", gap: 12, alignItems: "center", minHeight: 210, position: "relative", overflow: "hidden",
          background: a11y ? frost.background : "radial-gradient(ellipse 70% 80% at 28% 45%, rgba(214,178,102,0.16), rgba(0,0,0,0) 60%), rgba(255,250,238,0.04)" }}>
          <div style={{ width: vesselKind && !strained ? 224 : 168, height: 176, flexShrink: 0, position: "relative", borderRadius: 24, display: "flex", alignItems: "flex-end", gap: 4, animation: fx?.kind === "win" ? "saLabGlow 1.4s ease-out" : "none", transition: "width .3s" }}>
            {vesselKind && !strained && (
              <div style={{ width: 108, height: 150, position: "relative", animation: fx?.kind === "spill" ? "saLabSpill 1.2s ease-in forwards" : "none" }}>
                <VesselView kind={vesselKind} fill={vesselMl / totalMl} colors={inVessel.map(s => ING_COLOR(s.name))} ice={iceInVessel ? iceInVessel.id : null} a11y={a11y} shake={fx?.kind === "shake"} tilt={fx?.kind === "strain"} />
                {fx?.kind === "muddle" && <div style={{ position: "absolute", left: "46%", top: 0, width: 6, height: 60, borderRadius: 3, background: gold, animation: "saLabMuddle .35s ease-in-out 2" }} />}
              </div>
            )}
            {finished && <div className="sa-fadein" style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center", zIndex: 2, animation: "saLabIn .6s ease-out" }}><CocktailArt c={c} w={168} light={a11y} /></div>}
            <div style={{ width: vesselKind && !strained ? 108 : 160, height: vesselKind && !strained ? 136 : 160, position: "relative", opacity: finished ? 0 : 1, transition: "opacity .5s", animation: !vesselKind || strained ? (fx?.kind === "shake" ? "saLabShake .8s ease-in-out" : fx?.kind === "muddle" ? "saLabMuddle .35s ease-in-out 2" : fx?.kind === "spill" ? "saLabSpill 1.2s ease-in forwards" : "none") : "none", transition: "width .3s, height .3s" }}>
              <GlassView glass={glassDone ? c.glass : "rocks"} fill={glassDone ? fillMl / totalMl : 0} colors={glassColors} ice={iceInGlass ? iceInGlass.id : null} garnish={garnishDone ? c.garnish : null} shake={false} a11y={a11y} spilled={false}
                layers={layers} floatColor={floatStep ? ING_COLOR(floatStep.name) : null} bubbles={fizzy && !finished} served={!!finished} />
            </div>
            {jig && <Jigger key={jig.key} amount={jig.amount} color={jig.color} gold={gold} />}
            {fx?.kind === "pour" && <Stream key={fx.key} color={fx.color || "#D6B266"} from={[vesselActive ? 40 : 100, -4]} to={[vesselActive ? 48 : 100, 74]} curved />}
            {fx?.kind === "strain" && <Stream key={fx.key} color={fx.color || "#D6B266"} from={[78, 58]} to={[146, 92]} curved />}
            {fx?.kind === "drop" && [0, 1, 2].map(i => <div key={fx.key + i} style={{ position: "absolute", left: (vesselActive ? 18 : 46) + i * 16, top: 34, width: 14, height: 14, borderRadius: 4, background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.8)", animation: `saLabDrop .55s ${i * 70}ms cubic-bezier(.3,.8,.4,1.4) forwards` }} />)}
            {fx?.kind === "stir" && <div key={fx.key} style={{ position: "absolute", left: "50%", top: 14, width: 4, height: 74, marginLeft: -2, borderRadius: 2, background: gold, transformOrigin: "50% 85%", animation: "saLabStir .9s linear", opacity: 0.8 }} />}
            {fx?.kind === "spill" && [0, 1, 2, 3, 4].map(i => <div key={fx.key + i} style={{ position: "absolute", left: 30, top: 70, width: 8, height: 8, borderRadius: 4, background: fx.color || "#D6B266", "--dx": `${-30 - i * 12}px`, "--dy": `${20 + (i % 3) * 14}px`, animation: `saLabSplash .8s ${i * 40}ms ease-out forwards` }} />)}
            {fx?.kind === "win" && [0, 1, 2, 3, 4, 5, 6, 7].map(i => <div key={fx.key + i} style={{ position: "absolute", left: 60, top: 60, width: 6, height: 6, borderRadius: 3, background: gold, "--dx": `${Math.round(Math.cos(i / 8 * Math.PI * 2) * 58)}px`, "--dy": `${Math.round(Math.sin(i / 8 * Math.PI * 2) * 58)}px`, animation: `saLabSpark .9s ${i * 30}ms ease-out forwards` }} />)}
            {finished && finished.clean && mode === "memory" && <div style={{ position: "absolute", right: -6, bottom: -4, width: 54, height: 54, borderRadius: 27, border: `3px solid ${gold}`, color: gold, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", fontSize: 11, letterSpacing: 1, textAlign: "center", lineHeight: 1.1, background: a11y ? "rgba(250,242,222,0.9)" : "rgba(28,22,12,0.9)", animation: "saLabStamp .7s cubic-bezier(.2,1.2,.3,1) forwards", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>ПЕ<br/>ЧАТЬ</div>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {finished ? (
              <div className="sa-fadein">
                <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: "#5DBB8A", fontFamily: "monospace" }}>{finished.clean ? "✦ ПОДАНО · ЧИСТО" : "✦ ПОДАНО"}</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 18, color: text, marginTop: 4 }}>{c.name}</div>
                <div style={{ fontSize: 12.5, color: sub, marginTop: 4, lineHeight: 1.5 }}>{mode === "memory" && finished.clean ? "Печать на карточке твоя." : mistakes ? `Ошибок: ${mistakes}. По памяти и без ошибок — будет печать.` : "Теперь — по памяти."}</div>
                {!rush && <button className="sa-btn" onClick={onExit} style={{ ...T.doneBtn, background: gold, marginTop: 10, padding: "10px 14px", fontSize: 13.5 }}>Готово ›</button>}
              </div>
            ) : msg ? (
              <div className="sa-fadein" style={{ fontSize: 13.5, color: "#E07878", lineHeight: 1.5 }}>{msg.text}</div>
            ) : pending ? (
              <div className="sa-fadein">
                <div style={{ fontSize: 10.5, letterSpacing: 1.5, color: gold, fontFamily: "monospace", marginBottom: 6 }}>ДЖИГГЕР · {pending.toUpperCase()}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {jiggerFor(c).map(a => { const st = sc.steps.find(s => s.kind === "ing" && s.name === pending); return <span key={a} style={chip(hint(st) && Number(st.amount) === a, { padding: "6px 9px", fontSize: 12 })} onClick={() => { const n = pending; setPending(null); act({ kind: "ing", name: n, amount: a }); }}>{a}</span>; })}
                  <span style={chip(false, { padding: "6px 9px", fontSize: 12, color: sub })} onClick={() => setPending(null)}>✕</span>
                </div>
                <div style={{ fontSize: 10.5, color: sub, marginTop: 6 }}>мл</div>
              </div>
            ) : mode === "hint" && expected ? (
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace" }}>ТЕПЕРЬ</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: text, marginTop: 4, lineHeight: 1.3 }}>{expected.s.label}</div>
                {c.steps && c.steps[Math.min(c.steps.length - 1, Math.floor(done.length / Math.max(1, sc.steps.length / c.steps.length)))] && <div style={{ fontSize: 12, color: sub, marginTop: 6, fontStyle: "italic" }}>{c.tip}</div>}
              </div>
            ) : (
              <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.5 }}>{pending ? `Сколько ${pending.toLowerCase()}?` : "Тапай по станции: стекло → лёд или ингредиенты → инструмент → гарниш."}</div>
            )}
          </div>
        </div>


        {/* СТАНЦИЯ — три полки: стекло и лёд · бутылки · инструмент и гарниш */}
        <div style={{ marginTop: 14 }}>
          {[
            ["СТЕКЛО · ЛЁД", [
              ...sc.station.glasses.map((g, k) => <Item key={"g" + g} icon={<GlassIcon glass={g} a11y={a11y} />} label={GLASS_RU[g]} on={hint(glassStep) && g === c.glass} gold={gold} a11y={a11y} delay={k * 40} onClick={() => act({ kind: "glass", id: g })} />),
              <span key="sep" style={{ width: 1, alignSelf: "stretch", background: `${gold}33`, margin: "6px 4px" }} />,
              ...sc.station.ices.map((i, k) => <Item key={"i" + i} icon={<IceIcon id={i} gold={gold} />} label={ICE_RU[i]} on={expected && expected.s.kind === "ice" && hint(expected.s) && expected.s.id === i} gold={gold} a11y={a11y} delay={200 + k * 40} onClick={() => act({ kind: "ice", id: i })} />),
            ]],
            ["БУТЫЛКИ", sc.station.ings.map((n, k) => { const st = sc.steps.find(x => x.kind === "ing" && x.name === n); const added = st && done.includes(sc.steps.indexOf(st)); return <Bottle key={n} color={ING_COLOR(n)} label={n} on={st && hint(st)} dim={added} gold={gold} a11y={a11y} delay={k * 40} lifting={lift === n} onClick={() => tapIng(n)} />; })],
            ["ИНСТРУМЕНТ · ГАРНИШ", [
              ...sc.station.tools.map((t, k) => <Item key={"t" + t} icon={<ToolIcon id={t} gold={gold} />} label={TOOLS[t]} on={expected && expected.s.kind === "tool" && hint(expected.s) && expected.s.id === t} gold={gold} a11y={a11y} delay={k * 40} onClick={() => act({ kind: "tool", id: t })} />),
              <span key="sep2" style={{ width: 1, alignSelf: "stretch", background: `${gold}33`, margin: "6px 4px" }} />,
              ...sc.station.garnishes.map((g, k) => <Item key={"ga" + g} icon={<GarnishIcon id={g} />} label={GARNISH_RU[g]} on={expected && expected.s.kind === "garnish" && hint(expected.s) && expected.s.id === g} gold={gold} a11y={a11y} delay={300 + k * 40} onClick={() => act({ kind: "garnish", id: g })} />),
            ]],
          ].map(([title, nodes]) => (
            <div key={title} style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: gold, fontFamily: "monospace", margin: "0 2px 4px" }}>{title}</div>
              <div style={{ position: "relative", borderRadius: 12, background: a11y ? "linear-gradient(180deg, rgba(255,250,235,0.55), rgba(240,228,200,0.35))" : "linear-gradient(180deg, rgba(255,248,230,0.02), rgba(255,236,190,0.06) 70%, rgba(214,178,102,0.10))", boxShadow: a11y ? "none" : "inset 0 -14px 20px -14px rgba(214,178,102,0.55)" }}>
                <div className="sa-hscroll" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 8px 6px", WebkitOverflowScrolling: "touch" }}>{nodes}</div>
                <div style={{ height: 7, borderRadius: "0 0 12px 12px", background: a11y ? "linear-gradient(180deg,#B08A4E,#8B6A30)" : "linear-gradient(180deg,#6B4A22,#3B2711)", boxShadow: "0 3px 6px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,220,160,.35)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Подготовка станции к смене: расставь по порядку ────────────────────────────
const PREP = [
  { phase: "Чистота", items: [{ id: "wipe", t: "Протереть станцию", why: "Порядок начинается с поверхности — иначе всё ляжет в чужие следы." }, { id: "cloths", t: "Разложить тряпки: станция · стекло · руки", why: "Три тряпки — три задачи. Одна на всё разносит запахи и жир." }] },
  { phase: "Лёд", items: [{ id: "ice-check", t: "Проверить лёд: прозрачность, запах", why: "Лёд — ингредиент. Мутный или пахнущий — в работу не идёт." }, { id: "ice-fill", t: "Заполнить колодец, совок отдельно", why: "Совок в колодце — это руки в каждом напитке." }] },
  { phase: "Гарниш", items: [{ id: "cut", t: "Нарезать цитрус и травы", why: "Резать в час пик — значит бегать за вишенкой на глазах у гостя." }, { id: "cover", t: "Накрыть и убрать в холод", why: "Открытый гарниш заветривается за час." }] },
  { phase: "Инструмент", items: [{ id: "tools", t: "Шейкер, джиггер, ложка, стрейнеры — под руку", why: "То, что в руках каждую минуту, лежит в рабочей зоне." }, { id: "check", t: "Проверить чистоту инструмента", why: "Грязный шейкер = вкус прошлого коктейля в новом." }] },
  { phase: "Расходники", items: [{ id: "straws", t: "Трубочки, салфетки, костеры", why: "Расходники — последними: они не портятся и не нужны для сборки." }, { id: "backup", t: "Запас ходовых бутылок", why: "Кончилось в час пик — беготня в подсобку." }] },
];
function StationPrep({ T, a11y, gold, frost, Head, onExit, uk }) {
  const text = T.modTitle.color, sub = T.modSub.color;
  const all = React.useMemo(() => PREP.flatMap((p, pi) => p.items.map(it => ({ ...it, phase: p.phase, pi }))), []);
  const [order] = React.useState(() => { const r = all.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; });
  const [placed, setPlaced] = React.useState([]);
  const [msg, setMsg] = React.useState(null);
  const [mistakes, setMistakes] = React.useState(0);
  const [start] = React.useState(Date.now());
  const [best, setBest] = React.useState(() => { try { return Number(localStorage.getItem("sa_bar_station_best" + uk) || 0); } catch (e) { return 0; } });
  const donePhases = new Set(placed.map(id => all.find(x => x.id === id).pi));
  const curPhase = Math.min(...PREP.map((_, i) => i).filter(i => PREP[i].items.some(it => !placed.includes(it.id))), 99);
  const finished = placed.length === all.length;
  const took = Math.round((Date.now() - start) / 1000);
  React.useEffect(() => { if (finished) { const t = took; if (!best || t < best) { setBest(t); try { localStorage.setItem("sa_bar_station_best" + uk, String(t)); } catch (e) {} } vibrate("success"); } }, [finished]);
  const tap = (it) => {
    if (finished) return;
    if (it.pi === curPhase) { setPlaced(p => [...p, it.id]); setMsg({ ok: true, text: it.why }); vibrate("light"); }
    else if (it.pi < curPhase) return;
    else { setMistakes(m => m + 1); setMsg({ ok: false, text: `Рано: сначала ${PREP[curPhase].phase.toLowerCase()}. ${it.why}` }); vibrate("error"); }
  };
  return (
    <div style={T.screen} className="sa-screen">
      {Head("Подготовка к смене", onExit)}
      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ ...frost, borderRadius: 18, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {PREP.map((p, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9.5, letterSpacing: 1, fontFamily: "monospace", color: donePhases.has(i) && PREP[i].items.every(it => placed.includes(it.id)) ? "#5DBB8A" : i === curPhase ? gold : sub, borderBottom: `2px solid ${i === curPhase ? gold : "transparent"}`, paddingBottom: 4 }}>{p.phase.toUpperCase()}</div>)}
          </div>
          {finished ? (
            <div className="sa-fadein">
              <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: "#5DBB8A", fontFamily: "monospace" }}>{took <= best ? "СТАНЦИЯ СОБРАНА · РЕКОРД ✦" : "СТАНЦИЯ СОБРАНА"}</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 24, color: text, marginTop: 4 }}>{took} с{mistakes ? ` · ошибок ${mistakes}` : " · без ошибок"}</div>
              <div style={{ fontSize: 12.5, color: sub, marginTop: 4 }}>Дальше смена идёт на автомате — ты не ищешь, ты берёшь.</div>
              <button className="sa-btn" onClick={onExit} style={{ ...T.doneBtn, background: gold, marginTop: 12, padding: "10px 14px", fontSize: 13.5 }}>Готово ›</button>
            </div>
          ) : msg ? (
            <div className="sa-fadein" style={{ fontSize: 13.5, lineHeight: 1.5, color: msg.ok ? text : "#E07878" }}>{msg.text}</div>
          ) : (
            <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.5 }}>Смена через полчаса. Тапай действия в правильном порядке: что раньше — то и первым.</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {order.map(it => { const on = placed.includes(it.id); return (
            <div key={it.id} className="sa-card" onClick={() => tap(it)} {...onActivate(() => tap(it))} style={{ ...frost, borderRadius: 14, padding: "11px 14px", cursor: on ? "default" : "pointer", opacity: on ? 0.45 : 1, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 22, color: on ? "#5DBB8A" : gold, fontSize: 15 }}>{on ? "✓" : "○"}</span>
              <span style={{ flex: 1, fontSize: 14, color: text }}>{it.t}</span>
              {on && <span style={{ fontSize: 10.5, color: sub, fontFamily: "monospace" }}>{it.phase.toUpperCase()}</span>}
            </div>); })}
        </div>
      </div>
    </div>
  );
}
