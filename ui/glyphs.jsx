// ui/glyphs.jsx — v110 (Доп. 423): значки строк по смыслу. Аудит новых экранов (владелец, 30.10): в «Утре руководителя» у смен,
// стоп-листа, «спасибо», брифинга и занятий был один и тот же кружок с точкой (похож на переключатель), строки сливались.
// Теперь в кружке — значок того, о чём строка, а то, что требует внимания или уже сделано, — маленькой отметкой на кружке
// («!» или галочка): цвет не единственный знак.
import React from "react";

const P = (d) => <path d={d} />;
// 24×24, линии; цвет — currentColor
export const GLYPH = {
  sun: <><circle cx="12" cy="12" r="4" />{P("M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5")}</>,
  moon: P("M20 14.3A8.2 8.2 0 1 1 9.7 4a6.5 6.5 0 0 0 10.3 10.3z"),
  clock: <><circle cx="12" cy="12" r="8.6" />{P("M12 7.4V12l3.1 1.9")}</>,
  userPlus: <><circle cx="9.5" cy="8" r="3.6" />{P("M2.8 20.2c0-3.7 3-6.6 6.7-6.6s6.7 2.9 6.7 6.6M19 7.8v6M16 10.8h6")}</>,
  swap: P("M4 8.2h13.5L14 4.7M20 15.8H6.5L10 19.3"),
  brief: <>{P("M4 9.5h3l9-5v15l-9-5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z")}{P("M7 14.5l1.5 5h2.6L9.6 14.5")}{P("M19.5 9.5a3.5 3.5 0 0 1 0 5")}</>,
  stop: <>{P("M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z")}{P("M8 12h8")}</>,
  heart: P("M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"),
  eye: <>{P("M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12z")}<circle cx="12" cy="12" r="2.6" /></>,
  book: <>{P("M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z")}{P("M8 7h7M8 11h5")}</>,
  checklist: <><rect x="5" y="4" width="14" height="17" rx="2.5" />{P("M9.5 4V2.8h5V4M8.6 12.2l2 2 4-4.2M8.6 17h6.8")}</>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />{P("M3.5 10h17M8 3v4M16 3v4")}</>,
  person: <><circle cx="12" cy="8" r="4" />{P("M4.5 20.5c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7")}</>,
  team: <><circle cx="8" cy="8.5" r="3" /><circle cx="16.5" cy="9.5" r="2.5" />{P("M2.5 20c0-3.2 2.5-5.8 5.5-5.8s5.5 2.6 5.5 5.8M14 19.5c.3-2.4 2-4.2 4.3-4.2 2.2 0 3.7 1.6 3.7 4")}</>,
  plane: <>{P("M21 3.5L3 10.8l6.8 2.4L12.3 20z")}{P("M9.8 13.2L21 3.5")}</>,
  server: <><ellipse cx="12" cy="6" rx="7" ry="2.6" />{P("M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6")}</>,
};

/**
 * Кружок со значком строки. kind: "info" — просто сведения, "warn" — нужно внимание (отметка «!»), "ok" — сделано (галочка).
 * c: { ok, warn, gold, chip } — цвета экрана; mark — цвет обводки отметки (под фон карточки).
 */
export function GlyphMark({ icon, kind = "info", c, mark = "#20180E", size = 28 }) {
  const col = kind === "ok" ? c.ok : kind === "warn" ? c.warn : c.gold;
  const g = GLYPH[icon];
  return (
    <span aria-hidden="true" data-glyph={icon || ""} data-glyph-kind={kind}
      style={{ position: "relative", flex: "0 0 auto", width: size, height: size, borderRadius: "50%", display: "inline-grid", placeItems: "center",
        border: "1.5px solid " + col, color: col, background: c.chip, boxSizing: "border-box" }}>
      {g ? <svg width={Math.round(size * 0.54)} height={Math.round(size * 0.54)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{g}</svg>
        : <span style={{ width: 6, height: 6, borderRadius: "50%", background: col }} />}
      {kind !== "info" ? (
        <span style={{ position: "absolute", right: -5, bottom: -5, width: 13, height: 13, borderRadius: "50%", background: col, border: "2px solid " + mark,
          display: "grid", placeItems: "center", boxSizing: "content-box" }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={mark} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            {kind === "ok" ? <path d="M5 12.5l4.2 4.2L19 7" /> : <path d="M12 5v9M12 19.5v.5" />}
          </svg>
        </span>) : null}
    </span>);
}
