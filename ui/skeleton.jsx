// v55 (Доп. 368): силуэты вместо надписи «Загрузка…». Пока данные едут с сервера, на месте будущих
// карточек мерцают их контуры — экран сразу похож на себя, а не на пустую страницу со словом.
// Мерцание — класс .sa-skel из css.js (при «меньше движения» — без анимации).
// Экранному диктору остаётся слово «Загружаю…»: его видно только ему.
import React from "react";

const srOnly = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden",
  clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };

const edge = (a11y) => (a11y ? "1px solid rgba(139,106,48,0.20)" : "1px solid rgba(255,255,255,0.07)");

/** Строки «текста» — подзаголовок или абзац, пока цифры едут. */
export function SkelLines({ a11y, widths = ["68%", "42%"], h = 11, gap = 7, style, label = "Загружаю…" }) {
  return (
    <div role="status" aria-live="polite" data-skel="lines" style={{ position: "relative", ...style }}>
      <span style={srOnly}>{label}</span>
      {widths.map((w, i) => (
        <div key={i} className="sa-skel" aria-hidden="true"
          style={{ height: h + (a11y ? 2 : 0), width: w, borderRadius: 7, marginTop: i ? gap : 0 }} />
      ))}
    </div>
  );
}

/** Карточки-силуэты — список, пока он едет с сервера. */
export function SkelCards({ a11y, rows = 3, h = 62, gap = 10, radius = 16, style, label = "Загружаю…" }) {
  return (
    <div role="status" aria-live="polite" data-skel="cards" style={{ position: "relative", ...style }}>
      <span style={srOnly}>{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sa-skel" aria-hidden="true"
          style={{ height: h + (a11y ? 6 : 0), borderRadius: radius, border: edge(a11y), marginTop: i ? gap : 0, opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  );
}
