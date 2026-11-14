// ui/lesson-done.jsx — v158 (Доп. 483): тихая строка под кнопкой после «Урок пройден».
// Бокал цели дня доливается на глазах (тот же бокал, что в табличке на главной и в шапке трека), рядом — сколько шагов
// до конца раздела. Слова и счёт — lib/lesson-done.js. Ни шторок, ни затемнений (Доп. 205).
import React from "react";
import { Wine, palette } from "./day-emblems";
import { doneNote } from "../lib/lesson-done";

export function DoneNote({ goal, left = null, a11y = false, sub }) {
  const n = doneNote(goal, left);
  const to = n && n.goal ? n.goal.pct : 0;
  const [pct, setPct] = React.useState(() => (n && n.goal ? n.goal.from : 0));
  // сначала бокал такой, каким был до урока, через четверть секунды — доливается (плавность — в стилях бокала)
  React.useEffect(() => { const t = setTimeout(() => setPct(to), 260); return () => clearTimeout(t); }, [to]);
  if (!n) return null;
  const p = palette(a11y);
  return (
    <div data-done-note="" role="status" className="sa-fadein" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "3px 14px",
      marginTop: 12, fontSize: a11y ? 14.5 : 13.5, lineHeight: 1.35, color: sub || p.sub }}>
      {n.goal ? (
        <span data-done-goal={n.goal.reached ? "reached" : "going"} style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", color: p.gold, fontWeight: "bold" }}>
          <Wine s={22} pct={pct} a11y={a11y} />{n.goal.text}
        </span>
      ) : null}
      {n.left ? <span data-done-left={n.left.n} style={{ whiteSpace: "nowrap" }}>{n.left.text}</span> : null}
    </div>
  );
}
