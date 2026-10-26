// tools/claude/chat-demo/mic-stub.jsx — демо: микрофон «слушает» две секунды и подставляет фразу (в демо нет записи
// и распознавания; в приложении — настоящий ui/mic.jsx).
import React from "react";
const PHRASES = ["Закончился лёд на баре, кто свободен, принесите пожалуйста", "Гости за девятым столом просят счёт", "Через десять минут собираемся на брифинг у бара"];
let n = 0;
export function MicButton({ onText, a11y, size = 42 }) {
  const [on, setOn] = React.useState(false);
  const gold = a11y ? "#6B4E1A" : "#D2A85A";
  const click = () => { if (on) return; setOn(true); setTimeout(() => { setOn(false); onText(PHRASES[n++ % PHRASES.length]); }, 1800); };
  return (
    <button type="button" onClick={click} aria-label={on ? "Слушаю" : "Сказать голосом"} title="Сказать голосом"
      style={{ width: size, height: size, borderRadius: size / 2, border: "none", cursor: "pointer", flexShrink: 0, display: "grid", placeItems: "center", padding: 0,
        background: on ? (a11y ? "rgba(139,106,48,0.22)" : "rgba(214,178,102,0.22)") : (a11y ? "rgba(139,106,48,0.10)" : "rgba(200,169,110,0.08)"),
        boxShadow: a11y ? "inset 0 0 0 1px rgba(139,106,48,0.5)" : "inset 0 0 0 1px rgba(214,178,102,0.40)", color: gold, transition: "background .2s" }}>
      {on ? <span style={{ display: "flex", gap: 3, alignItems: "center", height: 18 }}>{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ width: 3, borderRadius: 2, background: gold, height: [8, 14, 18, 14, 8][i], animation: "chMicBar .8s " + i * 0.1 + "s infinite ease-in-out" }} />)}</span>
        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>}
    </button>);
}
