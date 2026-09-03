import React from "react";

// ── Дополнение 147: витражи для курсов Справочника ───────────────────────────
// Тот же язык, что у бокала в Колоде: тёмное стекло, золотой свинец контура,
// цветная жидкость/материал с глубиной, блик. viewBox 120x120. light — светлая тема.

const lead = (light) => (light ? "#8B6A30" : "#D2A85A");
const glass = (light) => (light ? "rgba(139,106,48,0.10)" : "rgba(255,248,230,0.06)");
const shine = (light) => (light ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)");

/** Сервировка: клош на тарелке, приборы по бокам */
function Serving({ light }) {
  const L = lead(light);
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <ellipse cx="60" cy="86" rx="40" ry="8" fill={glass(light)} stroke={L} strokeWidth="1.8" />
      <path d="M26 82 Q30 46 60 42 Q90 46 94 82 Z" fill={light ? "rgba(139,106,48,0.16)" : "rgba(226,186,116,0.16)"} stroke={L} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M34 76 Q40 54 60 50" fill="none" stroke={shine(light)} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M60 42 V36" stroke={L} strokeWidth="2" strokeLinecap="round" />
      <circle cx="60" cy="33" r="3.2" fill={L} />
      <path d="M14 46 V78 M14 46 Q11 46 11 50 V58 Q11 62 14 62 M14 46 Q17 46 17 50 V58 Q17 62 14 62" fill="none" stroke={L} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M106 44 V78 M103 44 V56 Q103 60 106 60 Q109 60 109 56 V44" fill="none" stroke={L} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Вина: бокал с вином и отражением */
function Wine({ light }) {
  const L = lead(light);
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <defs><clipPath id="sa-wine-bowl"><path d="M34 22 Q30 70 60 76 Q90 70 86 22 Z" /></clipPath></defs>
      <path d="M34 22 Q30 70 60 76 Q90 70 86 22 Z" fill={glass(light)} stroke={L} strokeWidth="1.8" strokeLinejoin="round" />
      <g clipPath="url(#sa-wine-bowl)">
        <path d="M28 48 Q60 40 92 48 V80 H28 Z" fill={light ? "rgba(140,40,60,0.55)" : "rgba(160,44,66,0.72)"} />
        <path d="M28 52 Q60 60 92 52" fill="none" stroke={light ? "rgba(255,255,255,0.35)" : "rgba(255,200,210,0.25)"} strokeWidth="2" />
      </g>
      <path d="M40 30 Q38 48 46 60" fill="none" stroke={shine(light)} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M60 76 V100 M44 103 Q60 98 76 103" fill="none" stroke={L} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="98" cy="30" r="2" fill={L} opacity="0.7" /><circle cx="22" cy="40" r="1.5" fill={L} opacity="0.5" />
    </svg>
  );
}

/** Кофе: чашка на блюдце, пар */
function Coffee({ light }) {
  const L = lead(light);
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <ellipse cx="58" cy="94" rx="36" ry="7" fill={glass(light)} stroke={L} strokeWidth="1.8" />
      <path d="M28 52 H84 V72 Q84 90 60 90 Q36 90 36 72 Z" fill={glass(light)} stroke={L} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M31 55 H81 V60 Q81 64 60 65 Q34 64 31 60 Z" fill={light ? "rgba(90,50,20,0.7)" : "rgba(110,62,28,0.85)"} />
      <path d="M40 58 Q60 54 78 58" fill="none" stroke={light ? "rgba(240,210,170,0.7)" : "rgba(240,210,170,0.45)"} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M84 60 Q100 58 100 70 Q100 82 84 82" fill="none" stroke={L} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M40 66 Q44 76 40 86" fill="none" stroke={shine(light)} strokeWidth="2" strokeLinecap="round" />
      <path d="M48 42 Q44 34 50 28 Q56 22 52 14" fill="none" stroke={L} strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M62 42 Q58 34 64 28 Q70 22 66 14" fill="none" stroke={L} strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

const ART = { serving: Serving, wine: Wine, coffee: Coffee };

export function RefArt({ kind, light = false, size = 56 }) {
  const C = ART[kind];
  if (!C) return null;
  return (
    <div style={{ width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 14, background: light ? "rgba(139,106,48,0.08)" : "rgba(214,178,102,0.08)",
      border: light ? "1px solid rgba(139,106,48,0.28)" : "1px solid rgba(255,255,255,0.12)",
      boxShadow: light ? "inset 0 0 14px rgba(255,255,255,0.5)" : "inset 0 0 14px rgba(255,248,230,0.06)" }}>
      <div style={{ width: size - 10, height: size - 10 }}><C light={light} /></div>
    </div>
  );
}
