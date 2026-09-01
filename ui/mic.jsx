import React from "react";
import { startVoice, voiceSupported } from "../lib/voice";
import { vibrate } from "../lib/utils";

// Кнопка-микрофон в каноне капелек: золотое кольцо + изморозь; при записи —
// тёплое красное дыхание. onText получает распознанную фразу.
export function MicButton({ onText, onError, a11y, sttUrl, headers, size = 44 }) {
  const [state, setState] = React.useState("idle");   // idle | listening | processing
  const [level, setLevel] = React.useState(0);        // громкость 0..1 (ореол дышит в такт)
  const [t0, setT0] = React.useState(0);              // старт записи — для кольца-таймера
  const [prog, setProg] = React.useState(0);
  React.useEffect(() => {
    if (state !== "listening") { setProg(0); return; }
    const id = setInterval(() => setProg(Math.min(1, (Date.now() - t0) / 30000)), 100);
    return () => clearInterval(id);
  }, [state, t0]);
  const stopRef = React.useRef(null);
  if (!voiceSupported()) return null;
  const toggle = () => {
    if (state === "listening") { stopRef.current && stopRef.current(); stopRef.current = null; return; }
    if (state === "processing") return;
    vibrate("light");
    stopRef.current = startVoice({
      onText: (t) => { vibrate("success"); onText(t); },
      onState: (st) => { if (st === "listening") setT0(Date.now()); setState(st); },
      onLevel: setLevel,
      onError: (m) => { vibrate("error"); onError && onError(m); },
      sttUrl, headers,
    });
  };
  const rec = state === "listening", busy = state === "processing";
  const gold = a11y ? "#6B4E1A" : "#D2A85A";
  return (
    <button className="sa-btn" onClick={toggle} aria-label={rec ? "Остановить запись" : "Сказать голосом"}
      title={rec ? "Остановить" : "Сказать голосом"}
      style={{ width: size, height: size, borderRadius: size / 2, border: "none", cursor: "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: rec ? "rgba(200,70,60,0.16)" : (a11y ? "rgba(139,106,48,0.10)" : "rgba(200,169,110,0.08)"),
        transform: rec ? `scale(${1 + level * 0.08})` : "none",
        boxShadow: rec
          ? `inset 0 0 0 1px rgba(220,90,80,0.6), 0 0 0 ${Math.round(4 + level * 16)}px rgba(220,90,80,${(0.06 + level * 0.14).toFixed(2)})`
          : (a11y ? "inset 0 0 0 1px rgba(139,106,48,0.5), inset 0 0 12px rgba(255,255,255,0.4)"
                  : "inset 0 0 0 1px rgba(214,178,102,0.40), inset 0 0 12px rgba(255,230,170,0.10), inset 0 1px 0 rgba(255,255,255,0.14)"),
        opacity: busy ? 0.55 : 1, transition: "box-shadow .25s, background .25s",
        animation: rec && level < 0.05 ? "saMicPulse 1.2s ease-in-out infinite" : "none",
        // Кольцо-таймер: золото набегает по кругу за 30 секунд записи
        backgroundImage: rec ? `conic-gradient(rgba(214,178,102,0.85) ${Math.round(prog * 360)}deg, transparent 0deg)` : "none",
        backgroundOrigin: "border-box", padding: rec ? 2 : 0, position: "relative" }}>
      <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none"
        stroke={rec ? "#E07A6E" : gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3M9 21h6" />
      </svg>
    </button>
  );
}
