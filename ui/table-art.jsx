// ui/table-art.jsx — v179 (Доп. 504): стол на схеме зала сверху — столешница и стулья вокруг (геометрия —
// lib/floor-art.js). У стола с гостями закрашено столько стульев, сколько гостей; у брони — сколько придёт.
// v183 (Доп. 508): диван у стола — спинка и подушки по местам (подушки закрашиваются, как стулья).
import React from "react";
import { tableGeom } from "../lib/floor-art";

/** Где писать номер стола: прямоугольник внутри столешницы (у круглого — вписанный квадрат) */
export function labelBox(g) {
  if (g.top.kind === "circle") { const s = g.top.r * 1.48; return { x: g.top.cx - s / 2, y: g.top.cy - s / 2, w: s, h: s }; }
  return { x: g.top.x, y: g.top.y, w: g.top.w, h: g.top.h };
}

/**
 * Рисунок стола в рамке W × H. top — заливка столешницы, stroke — её контур, chair — { fill, stroke } свободного стула,
 * chairOn — цвет занятого, filled — сколько стульев закрасить, dash — пунктир (уборка), ring — выделенный контур
 * (выбран, подходит компании), glow — подсветка вокруг стола { fill, stroke }.
 */
export function TableArt({ g, W, H, top, stroke, chair, chairOn, filled = 0, dash = false, ring = null, glow = null, at = 0 }) {
  const n = Math.min(filled, g.chairs.length);
  const tw = ring ? 2 : 1.25;
  // at — отступ рисунка от края кнопки стола (v181: между соседними столами проход)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W.toFixed(2)} ${H.toFixed(2)}`} aria-hidden="true" focusable="false"
      style={{ position: "absolute", left: at, top: at, overflow: "visible", pointerEvents: "none" }}>
      {glow ? (g.top.kind === "circle"
        ? <circle data-table-glow="" cx={W / 2} cy={H / 2} r={Math.min(W, H) / 2 - 0.5} fill={glow.fill} stroke={glow.stroke} strokeWidth={1.3} />
        : <rect data-table-glow="" x={0.6} y={0.6} width={W - 1.2} height={H - 1.2} rx={Math.min(W, H) * 0.24} fill={glow.fill} stroke={glow.stroke} strokeWidth={1.3} />) : null}
      {(g.backs || []).map((b, i) => (
        <rect key={"b" + i} data-sofa-back="" x={b.x.toFixed(2)} y={b.y.toFixed(2)} width={b.w.toFixed(2)} height={b.h.toFixed(2)} rx={(Math.min(b.w, b.h) * 0.5).toFixed(2)}
          fill={chair.stroke} stroke={chair.stroke} strokeWidth={0.6} opacity={dash ? 0.6 : 0.9} />))}
      {g.chairs.map((c, i) => (
        <rect key={i} data-chair={i < n ? "on" : "off"} data-sofa={c.sofa ? "" : undefined} x={(-c.w / 2).toFixed(2)} y={(-c.h / 2).toFixed(2)} width={c.w.toFixed(2)} height={c.h.toFixed(2)} rx={(Math.min(c.w, c.h) * (c.sofa ? 0.2 : 0.42)).toFixed(2)}
          transform={`translate(${c.cx.toFixed(2)} ${c.cy.toFixed(2)}) rotate(${c.rot.toFixed(1)})`}
          fill={i < n ? chairOn : chair.fill} stroke={i < n ? chairOn : chair.stroke} strokeWidth={0.9} strokeDasharray={dash && i >= n ? "2 1.5" : undefined} />))}
      {g.top.kind === "circle"
        ? <circle data-table-top="" cx={g.top.cx} cy={g.top.cy} r={g.top.r} fill={top} stroke={ring || stroke} strokeWidth={tw} strokeDasharray={dash && !ring ? "3 2" : undefined} />
        : <rect data-table-top="" x={g.top.x} y={g.top.y} width={g.top.w} height={g.top.h} rx={g.top.r} fill={top} stroke={ring || stroke} strokeWidth={tw} strokeDasharray={dash && !ring ? "3 2" : undefined} />}
    </svg>
  );
}

/** Значок вида стола (палитра редактора): маленький стол со стульями */
export function KindIcon({ shape, seats, size = 26, color }) {
  const W = shape === "long" ? size * 1.7 : size, H = shape === "tall" ? size * 1.7 : size;
  const g = tableGeom(shape, seats, W, H);
  return (
    <span style={{ position: "relative", display: "inline-block", width: W, height: H, flex: "none" }}>
      <TableArt g={g} W={W} H={H} top="transparent" stroke={color} chair={{ fill: "transparent", stroke: color }} chairOn={color} />
    </span>
  );
}
