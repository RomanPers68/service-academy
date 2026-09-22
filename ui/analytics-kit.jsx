// ui/analytics-kit.jsx — «кирпичики» экрана «Аналитика» в языке «морозного льда».
// Тот же язык, что у ачивки «Находчивая жопка»: золото, стекло с бликом по кромке,
// медальоны, плашки с метками. Каждый цвет — с вариантом для светлой темы (a11y).
import React from "react";

// Тона тяжести: хорошо / внимание / плохо — у каждого светлый вариант для контраста
export const tones = (a11y) => ({
  good: a11y ? "#2F7A4F" : "#62C08C",
  mid:  a11y ? "#8A6414" : "#E0B04A",
  bad:  a11y ? "#A4452A" : "#E8896A",
  gold: a11y ? "#6B4E14" : "#D6B266",
});
export const toneOfFail = (pct) => pct >= 50 ? "bad" : pct >= 25 ? "mid" : "good";   // % ошибок
export const toneOfScore = (pct) => pct < 60 ? "bad" : pct < 75 ? "mid" : "good";    // % результата

// Стекло карточки: полупрозрачный градиент, свечение изнутри, блик по верхней кромке
export const glass = (C, a11y, extra = {}) => ({
  background: a11y ? "linear-gradient(180deg, rgba(255,252,244,0.92), rgba(246,236,214,0.92))"
                   : "linear-gradient(180deg, rgba(52,40,22,0.78), rgba(30,23,12,0.82))",
  border: `1px solid ${a11y ? "rgba(107,78,20,0.22)" : "rgba(214,178,102,0.22)"}`,
  borderTop: `1px solid ${a11y ? "rgba(255,255,255,0.95)" : "rgba(255,236,190,0.30)"}`,
  boxShadow: a11y ? "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 18px rgba(90,60,20,0.12)"
                  : "inset 0 0 26px rgba(214,178,102,0.05), inset 0 1px 0 rgba(255,236,190,0.12), 0 8px 22px rgba(0,0,0,0.35)",
  borderRadius: 18, ...extra,
});

const initials = (who) => String(who || "").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "·";

// Аватар: инициалы в медальоне; кольцо — золото, или тон, если человеку тяжело
export function Avatar({ who, size = 40, tone, a11y }) {
  const T = tones(a11y);
  const ring = tone && tone !== "good"
    ? `conic-gradient(from 210deg, ${T[tone]}, ${T[tone]}88, ${T[tone]})`
    : "conic-gradient(from 200deg, #F4E2AE, #A67C3A, #E9CF8E, #8B6A30, #F4E2AE)";
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: ring,
      boxShadow: a11y ? "0 2px 6px rgba(107,78,20,0.18)" : "0 0 14px rgba(214,178,102,0.16)" }}>
      <span style={{ width: size - 6, height: size - 6, borderRadius: "50%", display: "grid", placeItems: "center",
        background: a11y ? "radial-gradient(circle at 35% 30%, #FFF9EC, #EADBB8)" : "radial-gradient(circle at 35% 30%, #4A3A20, #1E160A)",
        color: a11y ? "#5A4214" : "#EBD49A", fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: size * 0.36, letterSpacing: 0.5 }}>
        {initials(who)}
      </span>
    </span>
  );
}

// Метка-пилюля
export function Chip({ children, tone, a11y, strong }) {
  const T = tones(a11y);
  const c = tone ? T[tone] : (a11y ? "#5E4E30" : "#BFAE8A");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 11,
      lineHeight: 1.5, whiteSpace: "nowrap", color: c, border: `1px solid ${c}55`, fontWeight: strong ? "bold" : "normal",
      background: tone ? `${c}14` : (a11y ? "rgba(107,78,20,0.05)" : "rgba(255,236,190,0.04)") }}>{children}</span>
  );
}

// Кольцо-индикатор: процент по кругу, число в центре
const calm = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
// Значение «доезжает» до цели после появления: кольца заполняются, полосы растут
function useGrow(target) {
  const [v, setV] = React.useState(calm() ? target : 0);
  React.useEffect(() => { if (calm()) { setV(target); return; } const t = setTimeout(() => setV(target), 80); return () => clearTimeout(t); }, [target]);
  return v;
}
export function Ring({ pct = 0, size = 64, tone = "gold", a11y, label }) {
  const T = tones(a11y); const c = T[tone] || T.gold;
  const r = size / 2 - 5, L = 2 * Math.PI * r, v = useGrow(Math.max(0, Math.min(100, pct)));
  return (
    <span style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "inline-grid", placeItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a11y ? "rgba(107,78,20,0.14)" : "rgba(214,178,102,0.14)"} strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${(v / 100) * L} ${L}`} style={{ filter: a11y ? "none" : `drop-shadow(0 0 4px ${c}66)`, transition: "stroke-dasharray 1.1s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <span style={{ fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: size * 0.27, color: c, lineHeight: 1 }}>
        {label != null ? label : `${Math.round(pct)}%`}
      </span>
    </span>
  );
}

// Полоса: доля с тоном
export function Bar({ pct = 0, tone = "gold", a11y, h = 6 }) {
  const T = tones(a11y); const c = T[tone] || T.gold; const w = useGrow(pct);
  return (
    <div style={{ height: h, borderRadius: h, background: a11y ? "rgba(107,78,20,0.12)" : "rgba(214,178,102,0.12)", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(3, Math.min(100, w))}%`, height: "100%", borderRadius: h, transition: "width .9s cubic-bezier(.2,.8,.2,1)",
        background: `linear-gradient(90deg, ${c}bb, ${c})`, boxShadow: a11y ? "none" : `0 0 8px ${c}55` }} />
    </div>
  );
}

// График-искра: средний результат по неделям, золотая линия со свечением и заливкой
export function Spark({ points = [], a11y, h = 64 }) {
  const T = tones(a11y); const c = T.gold;
  const pts = points.map((p, i) => ({ ...p, i })).filter(p => p.v != null);
  if (pts.length < 2) return <div style={{ height: h, display: "grid", placeItems: "center", color: a11y ? "#5E4E30" : "#BFAE8A", fontSize: 12 }}>Динамика появится через пару недель</div>;
  const W = 300, n = points.length, x = (i) => 8 + (i * (W - 16)) / Math.max(1, n - 1);
  const lo = Math.max(0, Math.min(...pts.map(p => p.v)) - 10), hi = Math.min(100, Math.max(...pts.map(p => p.v)) + 6);
  const y = (v) => 6 + (1 - (v - lo) / Math.max(1, hi - lo)) * (h - 22);
  const line = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts[pts.length - 1].i).toFixed(1)},${h - 14} L${x(pts[0].i).toFixed(1)},${h - 14} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs><linearGradient id="spkF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} stopOpacity={a11y ? 0.28 : 0.35} /><stop offset="1" stopColor={c} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#spkF)" />
      <path d={line} fill="none" stroke={c} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: a11y ? "none" : `drop-shadow(0 0 4px ${c}88)` }} vectorEffect="non-scaling-stroke" />
      {pts.map((p, k) => <circle key={k} cx={x(p.i)} cy={y(p.v)} r={p === last ? 3.6 : 2.2} fill={p === last ? c : (a11y ? "#F6EEDC" : "#1E160A")} stroke={c} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />)}
      {points.map((p, i) => <text key={i} x={x(i)} y={h - 2} textAnchor="middle" fontSize="9" fill={a11y ? "#5E4E30" : "#9F8F6E"} fontFamily="Georgia, serif">{p.label}</text>)}
    </svg>
  );
}

// Дорожка теста: сколько вопросов прошёл до выхода и где вышел — вместо «вышел на 4-м из 12»
export function ExitTrack({ answered = 0, total = 0, a11y }) {
  const T = tones(a11y);
  const n = Math.max(total, answered, 1), cells = Math.min(n, 20), per = n / cells;
  const at = Math.min(cells, Math.max(1, Math.ceil(answered / per)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }} aria-label={`Вышел на ${answered}-м вопросе из ${total}`}>
      {Array.from({ length: cells }).map((_, i) => {
        const done = i + 1 < at, exit = i + 1 === at;
        return <span key={i} style={{ flex: 1, height: exit ? 10 : 6, borderRadius: 3,
          background: exit ? T.bad : done ? T.gold : (a11y ? "rgba(107,78,20,0.14)" : "rgba(214,178,102,0.14)"),
          boxShadow: exit && !a11y ? `0 0 8px ${T.bad}88` : "none" }} />;
      })}
      <span style={{ marginLeft: 6, fontSize: 11, color: a11y ? "#5E4E30" : "#BFAE8A", whiteSpace: "nowrap" }}>{answered} из {total || "?"}</span>
    </div>
  );
}

// Стеклянная плашка ошибки: вопрос, что выбрал, что верно — как в ачивке
export function MissPlate({ q, picked, right, times, a11y }) {
  const T = tones(a11y);
  const text = a11y ? "#2A2113" : "#EFE4C8", muted = a11y ? "#5E4E30" : "#BFAE8A";
  const tag = (t, c) => <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: 1.3, color: c, fontWeight: "bold", marginRight: 6 }}>{t}</span>;
  return (
    <div style={{ background: a11y ? "rgba(255,255,255,0.6)" : "rgba(255,236,190,0.04)", border: `1px solid ${a11y ? "rgba(107,78,20,0.18)" : "rgba(214,178,102,0.16)"}`,
      borderRadius: 13, padding: "10px 11px", marginTop: 7, boxShadow: a11y ? "inset 0 1px 0 rgba(255,255,255,0.9)" : "inset 0 1px 0 rgba(255,236,190,0.07)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", marginTop: 1,
          border: `1px solid ${T.bad}88`, color: T.bad, fontSize: 10 }}>✕</span>
        <div style={{ color: text, fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold", lineHeight: 1.4, flex: 1, minWidth: 0 }}>{q}</div>
        {times > 1 ? <span style={{ color: T.bad, fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 12.5, flexShrink: 0 }}>×{times}</span> : null}
      </div>
      {(picked || right) ? (
        <div style={{ paddingLeft: 26, marginTop: 5 }}>
          {picked ? <div style={{ color: muted, fontSize: 12, lineHeight: 1.45 }}>{tag("ВЫБРАЛ", muted)}{picked}</div> : null}
          {right ? <div style={{ color: T.good, fontSize: 12, lineHeight: 1.45, marginTop: 2 }}>{tag("ВЕРНО", T.good)}{right}</div> : null}
        </div>) : null}
    </div>
  );
}

// Заголовок раздела: подпись с золотыми линиями — как «СЕКРЕТНАЯ АЧИВКА»
export function SectionLabel({ children, a11y, right }) {
  const c = a11y ? "#6B4E14" : "#D6B266";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 2px 8px" }}>
      <span style={{ height: 1, width: 14, background: `linear-gradient(90deg, transparent, ${c})` }} />
      <span style={{ color: c, fontFamily: "monospace", fontSize: 10, letterSpacing: 1.8, fontWeight: "bold", whiteSpace: "nowrap" }}>{children}</span>
      <span style={{ height: 1, flex: 1, background: `linear-gradient(90deg, ${c}, transparent)`, opacity: 0.5 }} />
      {right ? <span style={{ color: a11y ? "#5E4E30" : "#BFAE8A", fontSize: 11 }}>{right}</span> : null}
    </div>
  );
}

// Иконки (линией, в цвет)
export const Icon = {
  key: (c, s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 19 4M16 7l2.5 2.5M14 9l2 2" /></svg>,
  people: (c, s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2c2.4-.2 4.1 1.3 4.6 4.3" /></svg>,
  check: (c, s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="m8.3 12.3 2.5 2.5 5-5.4" /></svg>,
  moon: (c, s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" /></svg>,
  alert: (c, s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4 21 19H3z" /><path d="M12 10v4M12 16.8v.2" /></svg>,
  chev: (c, open) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .25s ease" }}><path d="m9 6 6 6-6 6" /></svg>,
};
