// ui/reference-illustrations.jsx
// Линейные SVG-иллюстрации раздела «Справочник» (бокалы, приборы, тарелки, сцены)
// + фото национальных школ (base64) + реестр ILL/renderIll.
import React from "react";
import { REFERENCE_PHOTOS } from "../data/reference-photos";

const sv = (c, s, w = 2) => ({ width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" });
export const Ico = {
  serving: (c, s = 26) => (<svg {...sv(c, s, 1.7)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.4" /><path d="M3.5 12H1M23 12h-2.5" /></svg>),
  wine: (c, s = 26) => (<svg {...sv(c, s, 1.7)}><path d="M8 3h8M9 3c0 5 1.5 7 3 7s3-2 3-7M12 10v8M8 21h8" /></svg>),
  coffee: (c, s = 26) => (<svg {...sv(c, s, 1.7)}><path d="M4 8h13v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M17 9h2a2 2 0 0 1 0 4h-2" /><path d="M7 2.5c0 1.2-1 1.2-1 2.5M11 2.5c0 1.2-1 1.2-1 2.5" /></svg>),
  bar: (c, s = 26) => (<svg {...sv(c, s, 1.7)}><path d="M5 4h14l-7 8zM12 12v6M8 21h8" /></svg>),
  lock: (c, s = 14) => (<svg {...sv(c, s)}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>),
  cam: (c, s = 15) => (<svg {...sv(c, s)}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>),
  check: (c, s = 18) => (<svg {...sv(c, s, 2.2)}><circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" /></svg>),
  x: (c, s = 18) => (<svg {...sv(c, s, 2.2)}><circle cx="12" cy="12" r="10" /><path d="M9 9l6 6M15 9l-6 6" /></svg>),
};

// ── Бокалы ──
const GLASS = {
  water: { bowl: "M19 16 Q19 64 40 73 Q61 64 61 16", rim: "M19 16 Q40 27 61 16", liquid: "M24 42 Q24 60 40 68 Q56 60 56 42 Q40 49 24 42", stemY: 73, fill: { d: "rgba(120,170,200,0.28)", l: "rgba(90,140,180,0.30)" } },
  white: { bowl: "M26 16 Q26 58 40 66 Q54 58 54 16", rim: "M26 16 Q40 24 54 16", liquid: "M30 40 Q30 54 40 60 Q50 54 50 40 Q40 46 30 40", stemY: 66, fill: { d: "rgba(225,205,125,0.40)", l: "rgba(190,160,70,0.38)" } },
  red: { bowl: "M17 15 Q17 64 40 74 Q63 64 63 15", rim: "M17 15 Q40 28 63 15", liquid: "M23 38 Q23 60 40 69 Q57 60 57 38 Q40 47 23 38", stemY: 74, fill: { d: "rgba(150,40,48,0.52)", l: "rgba(150,45,45,0.46)" } },
  flute: { bowl: "M33 8 Q33 72 40 80 Q47 72 47 8", rim: "M33 8 Q40 12 47 8", liquid: "M35 34 Q35 70 40 76 Q45 70 45 34 Q40 38 35 34", stemY: 80, fill: { d: "rgba(232,205,130,0.42)", l: "rgba(200,170,80,0.42)" }, bubbles: true },
};
function Glass({ type = "red", c, dark, size = 76 }) {
  const g = GLASS[type]; const liq = dark ? g.fill.d : g.fill.l; const baseY = 128;
  return (<svg width={size} height={size * 1.85} viewBox="0 0 80 150" fill="none">
    <path d={g.liquid} fill={liq} />
    {g.bubbles && [0, 1, 2, 3].map(i => <circle key={i} cx={38 + (i % 2) * 4} cy={68 - i * 8} r={1.1} fill={dark ? "#EBCF8E" : "#9A6B1E"} />)}
    <path d={g.bowl} stroke={c} strokeWidth="2.1" strokeLinecap="round" fill="none" />
    <path d={g.rim} stroke={c} strokeWidth="2.1" strokeLinecap="round" fill="none" />
    <line x1="40" y1={g.stemY} x2="40" y2={baseY} stroke={c} strokeWidth="2.1" strokeLinecap="round" />
    <path d={`M24 ${baseY + 3} Q40 ${baseY - 3} 56 ${baseY + 3}`} stroke={c} strokeWidth="2.1" fill="none" strokeLinecap="round" />
    <ellipse cx="40" cy={baseY + 4} rx="17" ry="3.4" stroke={c} strokeWidth="2.1" fill="none" />
  </svg>);
}
function Snifter({ c, dark, size = 64 }) {
  const liq = dark ? "rgba(190,110,50,0.50)" : "rgba(165,95,40,0.45)";
  // Коньячный снифтер: широкий низ, плавное сужение к устью, короткая ножка, широкое основание
  return (<svg width={size} height={size * 1.36} viewBox="0 0 88 120" fill="none">
    <path d="M16 66 Q18 82 44 86 Q70 82 72 66 Q44 73 16 66" fill={liq} />
    <path d="M23 22 Q9 33 8 60 Q9 80 44 86 Q79 80 80 60 Q79 33 65 22" stroke={c} strokeWidth="2.2" fill="none" strokeLinejoin="round" />
    <path d="M23 22 Q44 30 65 22" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" />
    <line x1="44" y1="86" x2="44" y2="105" stroke={c} strokeWidth="3" strokeLinecap="round" />
    <path d="M26 108 Q44 103 62 108" stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    <ellipse cx="44" cy="108" rx="20" ry="3.4" stroke={c} strokeWidth="2.2" fill="none" />
  </svg>);
}
function Rocks({ c, dark, size = 56 }) {
  const liq = dark ? "rgba(205,130,45,0.46)" : "rgba(170,100,38,0.42)";
  const ice = dark ? "#EAE0CC" : "#7A5F37";
  // Виски-рокс: низкий широкий тумблер с толстым дном и кубиками льда
  return (<svg width={size} height={size * 0.875} viewBox="0 0 96 84" fill="none">
    <path d="M18 30 Q48 38 78 30 L80 68 Q48 77 16 68 Z" fill={liq} />
    <rect x="29" y="26" width="14" height="14" rx="2" transform="rotate(-10 36 33)" stroke={ice} strokeWidth="1.6" fill="none" opacity="0.8" />
    <rect x="50" y="32" width="16" height="16" rx="2" transform="rotate(12 58 40)" stroke={ice} strokeWidth="1.6" fill="none" opacity="0.65" />
    <rect x="42" y="45" width="14" height="14" rx="2" transform="rotate(-6 49 52)" stroke={ice} strokeWidth="1.6" fill="none" opacity="0.55" />
    <path d="M14 16 L16 68 Q48 77 80 68 L82 16" stroke={c} strokeWidth="2.3" fill="none" strokeLinejoin="round" />
    <ellipse cx="48" cy="16" rx="34" ry="7" stroke={c} strokeWidth="2.3" fill="none" />
    <path d="M22 62 Q48 70 74 62" stroke={c} strokeWidth="1.6" fill="none" opacity="0.6" strokeLinecap="round" />
  </svg>);
}

// ── Приборы ──
const HANDLE = (y) => `M19.5 ${y} L20 144 Q20 150 22 150 Q24 150 24 144 L24.5 ${y}`;
function Util({ kind, c, size = 44 }) {
  const cm = { stroke: c, strokeWidth: 2.2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  let b = null;
  if (kind === "fork") b = (<>{[14.5, 19.5, 24.5, 29.5].map((x, i) => <line key={i} x1={x} y1={12} x2={x} y2={42} {...cm} />)}<path d="M14.5 42 Q14 54 19.5 62 M29.5 42 Q30 54 24.5 62" {...cm} /><path d={HANDLE(62)} {...cm} /></>);
  else if (kind === "knife") b = (<><path d="M22 14 L24.5 24 L24.5 64 L20 66 Q15 50 16 36 Q17.5 22 22 14 Z" {...cm} /><path d={HANDLE(66)} {...cm} /></>);
  else if (kind === "steak") { let p = "M22 15 L24.5 24 L24.5 62 L20 64"; let y = 61, t = true; while (y > 21) { p += ` L${t ? 15.8 : 18} ${y}`; y -= 3; t = !t; } p += " Z"; b = (<><path d={p} {...cm} /><path d={HANDLE(64)} {...cm} /></>); }
  else if (kind === "fish") b = (<><path d="M20 12 Q13 28 13 46 Q14 58 19 64 L25 64 Q28 56 29 44 L24 40 L29 36 Q28 22 20 12 Z" {...cm} /><path d={HANDLE(64)} {...cm} /></>);
  else if (kind === "butter") b = (<><path d="M16 30 Q16 17 22 16 Q28 17 28 30 L26 51 Q26 56 22 56 Q18 56 18 51 Z" {...cm} /><path d={HANDLE(55)} {...cm} /></>);
  else if (kind === "spoon") b = (<><ellipse cx="22" cy="30" rx="11" ry="16.5" {...cm} /><path d={HANDLE(47)} {...cm} /></>);
  else if (kind === "oyster") b = (<>{[16, 22, 28].map((x, i) => <line key={i} x1={x} y1={40} x2={x} y2={66} {...cm} />)}<path d="M16 66 Q16 74 19.5 80 M28 66 Q28 74 24.5 80" {...cm} /><path d="M19.5 80 L20 142 Q20 148 22 148 Q24 148 24 142 L24.5 80" {...cm} /></>);
  return <svg width={size} height={size * 3.55} viewBox="0 0 44 156">{b}</svg>;
}
function Plate({ kind, c, size = 90 }) {
  const cm = { stroke: c, strokeWidth: 2.2, fill: "none" }; let b = null;
  if (kind === "charger") b = (<><circle cx="60" cy="60" r="52" {...cm} /><circle cx="60" cy="60" r="44" {...cm} opacity="0.85" /><circle cx="60" cy="60" r="30" {...cm} opacity="0.5" /></>);
  else if (kind === "dinner") b = (<><circle cx="60" cy="60" r="50" {...cm} /><circle cx="60" cy="60" r="36" {...cm} opacity="0.55" /></>);
  else if (kind === "bread") b = (<><circle cx="60" cy="60" r="40" {...cm} /><circle cx="60" cy="60" r="28" {...cm} opacity="0.5" /></>);
  else if (kind === "sizes") b = [52, 42, 32, 22].map((r, i) => <circle key={i} cx="60" cy="60" r={r} {...cm} opacity={1 - i * 0.18} />);
  return <svg width={size} height={size} viewBox="0 0 120 120">{b}</svg>;
}
function MiniGlass({ type, c, size = 26 }) {
  const G = { water: "M5 4 Q5 17 11 19 Q17 17 17 4", red: "M4 3 Q4 18 11 20 Q18 18 18 3", white: "M6 4 Q6 16 11 18 Q16 16 16 4", flute: "M9 2 Q9 18 11 20 Q13 18 13 2" }[type];
  const sy = { water: 19, red: 20, white: 18, flute: 20 }[type];
  return (<svg width={size} height={size * 1.8} viewBox="0 0 22 40" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><path d={G} /><line x1="11" y1={sy} x2="11" y2="34" /><line x1="6" y1="35" x2="16" y2="35" /></svg>);
}
function Napkin({ c, size = 40 }) {
  const cm = { stroke: c, strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  return (<svg width={size} height={size * 1.15} viewBox="0 0 60 70" fill="none"><path d="M30 60 L8 18 Q30 7 52 18 Z" {...cm} />{[[15, 13], [23, 10], [30, 9], [37, 10], [45, 13]].map((p, i) => <line key={i} x1="30" y1="60" x2={p[0]} y2={p[1]} stroke={c} strokeWidth="1.3" opacity="0.7" strokeLinecap="round" />)}</svg>);
}
function Oyster({ c, x, y }) { return (<g stroke={c} strokeWidth="1.6" fill="none"><ellipse cx={x} cy={y} rx="9" ry="11" /><path d={`M${x - 6} ${y - 3} Q${x} ${y - 8} ${x + 6} ${y - 3}`} opacity="0.6" /><ellipse cx={x} cy={y + 1} rx="4" ry="5" fill={c} fillOpacity="0.25" stroke="none" /></g>); }
function PlateStack({ c, size = 110 }) {
  const cm = { stroke: c, strokeWidth: 2, fill: "none" };
  return (<svg width={size} height={size * 0.75} viewBox="0 0 120 90">{[0, 1, 2, 3, 4].map(i => <ellipse key={i} cx="60" cy={28 + i * 11} rx="40" ry="9" {...cm} opacity={0.55 + i * 0.11} />)}<path d="M20 28 L20 72" {...cm} /><path d="M100 28 L100 72" {...cm} /></svg>);
}
const P = (o) => ({ position: "absolute", ...o });

// ── Сцены (глава «Виды сервировки») ──
function SceneBase({ c }) {
  return (<div style={{ position: "relative", width: "100%", height: 200 }}>
    <div style={P({ left: "50%", top: 64, transform: "translateX(-50%)" })}><Plate kind="dinner" c={c} size={108} /></div>
    <div style={P({ left: "50%", top: 80, transform: "translateX(-50%)" })}><Napkin c={c} size={40} /></div>
    <div style={P({ left: "28%", top: 70 })}><Util kind="fork" c={c} size={20} /></div>
    <div style={P({ right: "28%", top: 70 })}><Util kind="knife" c={c} size={20} /></div>
    <div style={P({ right: "24%", top: 22 })}><MiniGlass type="water" c={c} size={26} /></div>
  </div>);
}
function SceneFull({ c }) {
  return (<div style={{ position: "relative", width: "100%", height: 210 }}>
    <div style={P({ left: "50%", top: 78, transform: "translateX(-50%)" })}><Plate kind="charger" c={c} size={100} /></div>
    <div style={P({ left: "16%", top: 76 })}><Util kind="fork" c={c} size={17} /></div>
    <div style={P({ left: "23%", top: 78 })}><Util kind="fork" c={c} size={17} /></div>
    <div style={P({ left: "30%", top: 80 })}><Util kind="fork" c={c} size={16} /></div>
    <div style={P({ right: "30%", top: 80 })}><Util kind="fish" c={c} size={16} /></div>
    <div style={P({ right: "23%", top: 78 })}><Util kind="knife" c={c} size={17} /></div>
    <div style={P({ right: "16%", top: 76 })}><Util kind="spoon" c={c} size={17} /></div>
    <div style={P({ left: "50%", top: 56, transform: "translateX(-50%) rotate(-90deg)" })}><Util kind="spoon" c={c} size={13} /></div>
    <div style={P({ left: "7%", top: 18 })}><Plate kind="bread" c={c} size={58} /></div>
    <div style={P({ right: "6%", top: 16, display: "flex", alignItems: "flex-end", gap: 1 })}><MiniGlass type="water" c={c} size={22} /><MiniGlass type="red" c={c} size={24} /><MiniGlass type="white" c={c} size={20} /><MiniGlass type="flute" c={c} size={18} /></div>
  </div>);
}
function Cover({ c, left }) {
  return (<div style={P({ left, top: 30, width: 80, transform: "translateX(-50%)" })}><div style={{ position: "relative", height: 130 }}>
    <div style={P({ left: "50%", top: 34, transform: "translateX(-50%)" })}><Plate kind="dinner" c={c} size={66} /></div>
    <div style={P({ left: -2, top: 38 })}><Util kind="fork" c={c} size={13} /></div>
    <div style={P({ right: -2, top: 38 })}><Util kind="knife" c={c} size={13} /></div>
    <div style={P({ left: "50%", top: 0, transform: "translateX(-50%)" })}><MiniGlass type="red" c={c} size={18} /></div>
  </div></div>);
}
function SceneBanquet({ c }) { return (<div style={{ position: "relative", width: "100%", height: 175 }}><Cover c={c} left="18%" /><Cover c={c} left="50%" /><Cover c={c} left="82%" /></div>); }
function SceneBuffet({ c }) {
  return (<div style={{ position: "relative", width: "100%", height: 185, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 8px" }}>
    <PlateStack c={c} size={108} />
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}><MiniGlass type="water" c={c} size={26} /><MiniGlass type="red" c={c} size={28} /><MiniGlass type="flute" c={c} size={22} /></div>
    <div style={{ display: "flex", gap: 2 }}><Util kind="fork" c={c} size={20} /><Util kind="knife" c={c} size={20} /></div>
  </div>);
}
function SceneOyster({ c }) {
  const oy = []; for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 2; oy.push([60 + 30 * Math.cos(a), 60 + 30 * Math.sin(a)]); }
  return (<div style={{ position: "relative", width: "100%", height: 185 }}>
    <div style={P({ left: "50%", top: 30, transform: "translateX(-50%)" })}><svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="54" stroke={c} strokeWidth="2.2" /><circle cx="60" cy="60" r="46" stroke={c} strokeWidth="2.2" opacity="0.5" strokeDasharray="3 4" />
      {oy.map(([x, y], i) => <Oyster key={i} c={c} x={x} y={y} />)}
      <g stroke={c} strokeWidth="1.6" fill="none"><path d="M53 60 L67 60 L60 50 Z" /><path d="M60 50 L60 60 M55 57 L60 60 M65 57 L60 60" opacity="0.6" /></g>
    </svg></div>
    <div style={P({ right: "16%", top: 28 })}><Util kind="oyster" c={c} size={18} /></div>
  </div>);
}

function Row({ children }) { return <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 14, padding: "6px 0" }}>{children}</div>; }
function Photo({ src }) { return <img src={src} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: 190, objectFit: "cover", borderRadius: 14, display: "block" }} />; }
function PhotoSmall({ src }) { return <img src={src} alt="" loading="lazy" decoding="async" style={{ width: "auto", maxWidth: 152, maxHeight: 190, objectFit: "contain", borderRadius: 12, display: "block", margin: "0 auto", imageRendering: "auto" }} />; }

// ── Реестр иллюстраций ──
export const ILL = {
  preset_table: (c, d) => <SceneBase c={c} />,
  oyster_service: (c, d) => <SceneOyster c={c} />,
  fine_dining_full: (c, d) => <SceneFull c={c} />,
  banquet: (c, d) => <SceneBanquet c={c} />,
  buffet: (c, d) => <SceneBuffet c={c} />,
  cutlery_layout_diagram: (c, d) => <SceneFull c={c} />,
  bread_plate_butter: (c, d) => (<div style={{ position: "relative", width: 100, height: 100 }}><Plate kind="bread" c={c} size={100} /><div style={{ position: "absolute", left: 44, top: 8, transform: "rotate(42deg)" }}><Util kind="butter" c={c} size={20} /></div></div>),
  plates_sizes: (c, d) => <Plate kind="sizes" c={c} size={104} />,
  charger_plate: (c, d) => <Plate kind="charger" c={c} size={104} />,
  basic_flatware: (c, d) => <Row><Util kind="fork" c={c} size={26} /><Util kind="knife" c={c} size={26} /><Util kind="spoon" c={c} size={26} /></Row>,
  fish_steak_cutlery: (c, d) => <Row><Util kind="steak" c={c} size={26} /><Util kind="fish" c={c} size={26} /><Util kind="oyster" c={c} size={22} /></Row>,
  wine_glasses_chart: (c, d) => <Row><Glass type="water" c={c} dark={d} size={40} /><Glass type="white" c={c} dark={d} size={40} /><Glass type="red" c={c} dark={d} size={40} /><Glass type="flute" c={c} dark={d} size={40} /></Row>,
  snifter_rocks: (c, d) => <Row><Snifter c={c} dark={d} size={56} /><Rocks c={c} dark={d} size={48} /></Row>,
  glass_red: (c, d) => <Glass type="red" c={c} dark={d} size={88} />,
  glass_flute: (c, d) => <Glass type="flute" c={c} dark={d} size={88} />,
};
// Фото национальных школ (school_russian_1 … school_french_2)
Object.keys(REFERENCE_PHOTOS).forEach((k) => { ILL[k] = () => (k.indexOf("wine_") === 0 ? <PhotoSmall src={REFERENCE_PHOTOS[k]} /> : <Photo src={REFERENCE_PHOTOS[k]} />); });

export const renderIll = (key, gold, dark) => (ILL[key] ? ILL[key](gold, dark) : null);


// ── Флаги стран для заголовков «Школы сервировки» ──────────────────────────
// Мини-SVG вместо эмодзи-флагов: выглядят одинаково на iOS/Android/desktop,
// в едином стиле с золотой рамкой. Ближневосточная (🕌) — региональный бейдж.
export const FLAGS = {
  'fr': (size=22) => (<svg viewBox="0 0 24 16" width={size} height={size*2/3} style={{display:"inline-block",verticalAlign:"-3px",flexShrink:0}}>
    <defs><clipPath id="fl_fr"><rect x="0.5" y="0.5" width="23" height="15" rx="2.6"/></clipPath></defs>
    <g clipPath="url(#fl_fr)"><rect x="0.00" y="0" width="8.00" height="16" fill="#0055A4"/><rect x="8.00" y="0" width="8.00" height="16" fill="#FFFFFF"/><rect x="16.00" y="0" width="8.00" height="16" fill="#EF4135"/></g>
    <rect x="0.6" y="0.6" width="22.8" height="14.8" rx="2.5" fill="none" stroke="#C8A96E" strokeWidth="0.7"/></svg>),
  'gb': (size=22) => (<svg viewBox="0 0 24 16" width={size} height={size*2/3} style={{display:"inline-block",verticalAlign:"-3px",flexShrink:0}}>
    <defs><clipPath id="fl_gb"><rect x="0.5" y="0.5" width="23" height="15" rx="2.6"/></clipPath></defs>
    <g clipPath="url(#fl_gb)"><rect width="24" height="16" fill="#012169"/><line x1="0" y1="0" x2="24" y2="16" stroke="#FFFFFF" strokeWidth="3.2"/><line x1="24" y1="0" x2="0" y2="16" stroke="#FFFFFF" strokeWidth="3.2"/><line x1="0" y1="0" x2="24" y2="16" stroke="#C8102E" strokeWidth="1.4"/><line x1="24" y1="0" x2="0" y2="16" stroke="#C8102E" strokeWidth="1.4"/><rect x="9.4" y="0" width="5.2" height="16" fill="#FFFFFF"/><rect x="0" y="5.4" width="24" height="5.2" fill="#FFFFFF"/><rect x="10.4" y="0" width="3.2" height="16" fill="#C8102E"/><rect x="0" y="6.4" width="24" height="3.2" fill="#C8102E"/></g>
    <rect x="0.6" y="0.6" width="22.8" height="14.8" rx="2.5" fill="none" stroke="#C8A96E" strokeWidth="0.7"/></svg>),
  'us': (size=22) => (<svg viewBox="0 0 24 16" width={size} height={size*2/3} style={{display:"inline-block",verticalAlign:"-3px",flexShrink:0}}>
    <defs><clipPath id="fl_us"><rect x="0.5" y="0.5" width="23" height="15" rx="2.6"/></clipPath></defs>
    <g clipPath="url(#fl_us)"><rect x="0" y="0.00" width="24" height="2.29" fill="#B22234"/><rect x="0" y="2.29" width="24" height="2.29" fill="#FFFFFF"/><rect x="0" y="4.57" width="24" height="2.29" fill="#B22234"/><rect x="0" y="6.86" width="24" height="2.29" fill="#FFFFFF"/><rect x="0" y="9.14" width="24" height="2.29" fill="#B22234"/><rect x="0" y="11.43" width="24" height="2.29" fill="#FFFFFF"/><rect x="0" y="13.71" width="24" height="2.29" fill="#B22234"/><rect x="0" y="0" width="10" height="9.14" fill="#3C3B6E"/><circle cx="1.30" cy="1.60" r="0.5" fill="#FFFFFF"/><circle cx="3.70" cy="1.60" r="0.5" fill="#FFFFFF"/><circle cx="6.10" cy="1.60" r="0.5" fill="#FFFFFF"/><circle cx="8.50" cy="1.60" r="0.5" fill="#FFFFFF"/><circle cx="1.30" cy="4.20" r="0.5" fill="#FFFFFF"/><circle cx="3.70" cy="4.20" r="0.5" fill="#FFFFFF"/><circle cx="6.10" cy="4.20" r="0.5" fill="#FFFFFF"/><circle cx="8.50" cy="4.20" r="0.5" fill="#FFFFFF"/><circle cx="1.30" cy="6.80" r="0.5" fill="#FFFFFF"/><circle cx="3.70" cy="6.80" r="0.5" fill="#FFFFFF"/><circle cx="6.10" cy="6.80" r="0.5" fill="#FFFFFF"/><circle cx="8.50" cy="6.80" r="0.5" fill="#FFFFFF"/></g>
    <rect x="0.6" y="0.6" width="22.8" height="14.8" rx="2.5" fill="none" stroke="#C8A96E" strokeWidth="0.7"/></svg>),
  'it': (size=22) => (<svg viewBox="0 0 24 16" width={size} height={size*2/3} style={{display:"inline-block",verticalAlign:"-3px",flexShrink:0}}>
    <defs><clipPath id="fl_it"><rect x="0.5" y="0.5" width="23" height="15" rx="2.6"/></clipPath></defs>
    <g clipPath="url(#fl_it)"><rect x="0.00" y="0" width="8.00" height="16" fill="#009246"/><rect x="8.00" y="0" width="8.00" height="16" fill="#FFFFFF"/><rect x="16.00" y="0" width="8.00" height="16" fill="#CE2B37"/></g>
    <rect x="0.6" y="0.6" width="22.8" height="14.8" rx="2.5" fill="none" stroke="#C8A96E" strokeWidth="0.7"/></svg>),
  'jp': (size=22) => (<svg viewBox="0 0 24 16" width={size} height={size*2/3} style={{display:"inline-block",verticalAlign:"-3px",flexShrink:0}}>
    <defs><clipPath id="fl_jp"><rect x="0.5" y="0.5" width="23" height="15" rx="2.6"/></clipPath></defs>
    <g clipPath="url(#fl_jp)"><rect width="24" height="16" fill="#FFFFFF"/><circle cx="12" cy="8" r="4.4" fill="#BC002D"/></g>
    <rect x="0.6" y="0.6" width="22.8" height="14.8" rx="2.5" fill="none" stroke="#C8A96E" strokeWidth="0.7"/></svg>),
  'cn': (size=22) => (<svg viewBox="0 0 24 16" width={size} height={size*2/3} style={{display:"inline-block",verticalAlign:"-3px",flexShrink:0}}>
    <defs><clipPath id="fl_cn"><rect x="0.5" y="0.5" width="23" height="15" rx="2.6"/></clipPath></defs>
    <g clipPath="url(#fl_cn)"><rect width="24" height="16" fill="#DE2910"/><polygon points="4.20,1.90 4.85,3.61 6.67,3.70 5.25,4.84 5.73,6.60 4.20,5.60 2.67,6.60 3.15,4.84 1.73,3.70 3.55,3.61" fill="#FFDE00"/><polygon points="8.08,0.92 7.98,1.62 8.58,1.98 7.89,2.11 7.73,2.79 7.40,2.17 6.70,2.23 7.19,1.72 6.91,1.07 7.55,1.38" fill="#FFDE00"/><polygon points="9.78,2.98 9.42,3.58 9.83,4.15 9.15,3.99 8.73,4.56 8.67,3.86 8.00,3.64 8.65,3.37 8.65,2.66 9.11,3.20" fill="#FFDE00"/><polygon points="9.20,5.22 9.31,5.92 9.99,6.09 9.37,6.41 9.42,7.11 8.92,6.61 8.26,6.88 8.58,6.25 8.13,5.71 8.83,5.82" fill="#FFDE00"/><polygon points="7.40,7.02 7.77,7.62 8.47,7.51 8.02,8.05 8.34,8.68 7.68,8.41 7.18,8.91 7.23,8.21 6.61,7.89 7.29,7.72" fill="#FFDE00"/></g>
    <rect x="0.6" y="0.6" width="22.8" height="14.8" rx="2.5" fill="none" stroke="#C8A96E" strokeWidth="0.7"/></svg>),
  '_me': (size=22) => (<svg viewBox="0 0 24 16" width={size} height={size*2/3} style={{display:"inline-block",verticalAlign:"-3px",flexShrink:0}}>
    <defs><clipPath id="fl_me"><rect x="0.5" y="0.5" width="23" height="15" rx="2.6"/></clipPath></defs>
    <g clipPath="url(#fl_me)"><rect width="24" height="16" fill="#1F6E54"/><circle cx="9.5" cy="8" r="5" fill="#E8C56A"/><circle cx="11.3" cy="7.2" r="5" fill="#1F6E54"/><polygon points="15.00,5.90 15.50,7.31 17.00,7.35 15.81,8.26 16.23,9.70 15.00,8.85 13.77,9.70 14.19,8.26 13.00,7.35 14.50,7.31" fill="#E8C56A"/></g>
    <rect x="0.6" y="0.6" width="22.8" height="14.8" rx="2.5" fill="none" stroke="#C8A96E" strokeWidth="0.7"/></svg>),
  'ru': (size=22) => (<svg viewBox="0 0 24 16" width={size} height={size*2/3} style={{display:"inline-block",verticalAlign:"-3px",flexShrink:0}}>
    <defs><clipPath id="fl_ru"><rect x="0.5" y="0.5" width="23" height="15" rx="2.6"/></clipPath></defs>
    <g clipPath="url(#fl_ru)"><rect x="0" y="0.00" width="24" height="5.33" fill="#FFFFFF"/><rect x="0" y="5.33" width="24" height="5.33" fill="#0039A6"/><rect x="0" y="10.67" width="24" height="5.33" fill="#D52B1E"/></g>
    <rect x="0.6" y="0.6" width="22.8" height="14.8" rx="2.5" fill="none" stroke="#C8A96E" strokeWidth="0.7"/></svg>),
};

// Снимает ведущий эмодзи-флаг (пара regional-indicator) или 🕌 и отдаёт SVG + остаток строки.
const _RI = 0x1F1E6;
export function splitLeadingFlag(text, size = 22) {
  const cps = Array.from(text || "");
  if (!cps.length) return { flag: null, rest: text };
  const c0 = cps[0].codePointAt(0);
  let code = null, len = 0;
  if (c0 === 0x1F54C) { code = "_me"; len = 1; }                       // 🕌 — Ближневосточная
  else if (c0 >= _RI && c0 <= 0x1F1FF && cps[1]) {
    const c1 = cps[1].codePointAt(0);
    if (c1 >= _RI && c1 <= 0x1F1FF) {
      code = (String.fromCharCode(65 + c0 - _RI) + String.fromCharCode(65 + c1 - _RI)).toLowerCase();
      len = 2;
    }
  }
  if (!code || !FLAGS[code]) return { flag: null, rest: text };
  return { flag: FLAGS[code](size), rest: cps.slice(len).join("").replace(/^\s+/, "") };
}
