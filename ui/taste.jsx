// ui/taste.jsx — v132 (Доп. 445): «Вкус по шкалам» на экране. Шкалы и слова — lib/taste.js.
// TasteBars — пять строк «Тело ●●●●○ плотное» (в карточке вина и крепкого, компактно — в подборе Сомелье);
// TasteEdit — то же для руководителя в редакторе: касание точки ставит уровень, второе касание той же — снимает.
import React from "react";
import { axesOf, axisWord } from "../lib/taste";
import { vibrate } from "../lib/utils";

const SERIF = "Georgia, 'Times New Roman', serif";
const dots = (v, on, off, size = 9, gap = 4) => (
  <span aria-hidden="true" style={{ display: "inline-flex", gap, alignItems: "center" }}>
    {[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: size, height: size, borderRadius: 999, background: i <= v ? on : "transparent", border: `1px solid ${i <= v ? on : off}` }} />)}
  </span>);

/** Шкалы вкуса. compact — без слов справа, в две колонки (карточка подбора). */
export function TasteBars({ t, kind = "wine", gold, text, sub, compact = false }) {
  if (!t) return null;
  const rows = axesOf(kind).filter(([k]) => t[k]);
  if (!rows.length) return null;
  return (
    <div data-taste={kind} data-taste-ai={t.ai ? "1" : "0"} style={{ display: compact ? "grid" : "block", gridTemplateColumns: compact ? "1fr 1fr" : undefined, columnGap: 14, rowGap: 4, marginTop: compact ? 8 : 2 }}>
      {rows.map(([k, ru]) => (
        <div key={k} data-taste-axis={k} data-taste-v={t[k]} aria-label={ru + ": " + t[k] + " из 5, " + axisWord(kind, k, t[k])}
          style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, margin: compact ? 0 : "5px 0" }}>
          <span style={{ width: compact ? 74 : 96, flexShrink: 0, fontFamily: SERIF, fontSize: compact ? 12 : 13.5, color: compact ? sub : text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ru}</span>
          {dots(t[k], gold, gold + "55", compact ? 7 : 9, compact ? 3 : 4)}
          {!compact ? <span style={{ fontSize: 12.5, color: sub, marginLeft: 2, whiteSpace: "nowrap" }}>{axisWord(kind, k, t[k])}</span> : null}
        </div>))}
    </div>);
}

/** Правка шкал: строка на шкалу, пять точек; та же точка ещё раз — «не знаю». */
export function TasteEdit({ kind = "wine", value, onChange, gold, text, sub }) {
  const t = value || {};
  const set = (k, v) => { vibrate("light"); const next = { ...t, [k]: t[k] === v ? 0 : v }; delete next.ai; onChange(axesOf(kind).some(([x]) => next[x]) ? next : null); };
  return (
    <div data-taste-edit={kind} style={{ marginTop: 4 }}>
      {axesOf(kind).map(([k, ru, lo, hi]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, margin: "7px 0" }}>
          <span style={{ width: 96, flexShrink: 0, fontFamily: SERIF, fontSize: 14, color: text }}>{ru}</span>
          <span role="group" aria-label={ru} style={{ display: "inline-flex", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((i) => {
              const on = (t[k] || 0) >= i;
              return <button key={i} type="button" data-taste-set={k + ":" + i} aria-pressed={t[k] === i} aria-label={ru + " " + i} onClick={() => set(k, i)}
                style={{ width: 26, height: 26, padding: 0, borderRadius: 999, cursor: "pointer", border: `1px solid ${on ? gold : gold + "55"}`, background: on ? gold : "transparent", color: on ? "#1A1008" : sub, fontSize: 11 }}>{i}</button>;
            })}
          </span>
          <span style={{ fontSize: 12, color: sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{t[k] ? axisWord(kind, k, t[k]) : lo + " … " + hi}</span>
        </div>))}
    </div>);
}
