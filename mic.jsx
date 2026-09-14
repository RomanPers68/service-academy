import React from "react";
import { startVoice, voiceSupported } from "../lib/voice";
import { vibrate } from "../lib/utils";

// Кнопка-микрофон в каноне капелек. Дополнение 127 — анимация «Волна»:
// пока идёт запись, иконка сменяется пятью золотыми столбиками, которые
// пляшут под громкость голоса; по краю за 30 секунд ползёт тонкое золотое
// кольцо-таймер. Никакого красного — всё в цвете интерфейса.
// onText получает распознанную фразу.
export function MicButton({ onText, onError, a11y, sttUrl, headers, size = 44 }) {
  const [state, setState] = React.useState("idle");   // idle | listening | processing
  const [level, setLevel] = React.useState(0);        // громкость 0..1
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
  const goldDim = a11y ? "rgba(107,78,26,0.22)" : "rgba(214,178,102,0.20)";

  // Пять столбиков: центральный выше, крайние ниже; лёгкий сдвиг фазы —
  // чтобы даже на ровной громкости волна жила, а не стояла столбом.
  const now = Date.now();
  const L = Math.max(rec ? 0.12 : 0, level);
  const bars = [0.5, 0.8, 1, 0.8, 0.5].map((f, i) =>
    Math.round(4 + (size * 0.38) * L * f * (0.7 + 0.3 * Math.sin(now / 110 + i * 1.3))));

  const ringMask = `radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0)`;
  return (
    <button className="sa-btn" onClick={toggle} aria-label={rec ? "Остановить запись" : "Сказать голосом"}
      title={rec ? "Остановить" : "Сказать голосом"}
      style={{ width: size, height: size, borderRadius: size / 2, border: "none", cursor: "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
        background: rec ? (a11y ? "rgba(139,106,48,0.16)" : "rgba(214,178,102,0.14)") : (a11y ? "rgba(139,106,48,0.10)" : "rgba(200,169,110,0.08)"),
        boxShadow: rec ? "none"
          : (a11y ? "inset 0 0 0 1px rgba(139,106,48,0.5), inset 0 0 12px rgba(255,255,255,0.4)"
                  : "inset 0 0 0 1px rgba(214,178,102,0.40), inset 0 0 12px rgba(255,230,170,0.10), inset 0 1px 0 rgba(255,255,255,0.14)"),
        opacity: busy ? 0.55 : 1, transition: "box-shadow .25s, background .25s, opacity .25s" }}>
      {/* Кольцо-таймер: золото набегает по кругу за 30 секунд записи */}
      {rec && <div aria-hidden="true" style={{ position: "absolute", inset: -2, borderRadius: "50%", pointerEvents: "none",
        background: `conic-gradient(${gold} ${Math.round(prog * 360)}deg, ${goldDim} 0deg)`,
        WebkitMask: ringMask, mask: ringMask }} />}
      {rec || busy ? (
        <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: Math.max(2, Math.round(size * 0.07)), height: size * 0.5 }}>
          {bars.map((h, i) => (
            <span key={i} style={{ display: "block", width: Math.max(2, Math.round(size * 0.07)), height: busy ? 4 : h,
              borderRadius: 2, background: gold, transition: "height .08s linear" }} />
          ))}
        </div>
      ) : (
        <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none"
          stroke={gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3M9 21h6" />
        </svg>
      )}
    </button>
  );
}
