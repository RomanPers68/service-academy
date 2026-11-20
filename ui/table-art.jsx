// ui/table-art.jsx — v179 (Доп. 504): стол на схеме зала сверху — столешница и стулья вокруг (геометрия —
// lib/floor-art.js). У стола с гостями закрашено столько стульев, сколько гостей; у брони — сколько придёт.
// v183 (Доп. 508): диван у стола — спинка и подушки по местам (подушки закрашиваются, как стулья).
// v186 (Доп. 511): progress — время за столом по контуру столешницы (у круглого — дуга от 12 часов, у прочих — по
// длинной стороне; под полоской тёмная (в светлой теме — светлая) подложка, чтобы полоска не сливалась с контуром);
// mark — рамка вокруг стола цветом официанта.
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
export function TableArt({ g, W, H, top, stroke, chair, chairOn, filled = 0, dash = false, ring = null, glow = null, at = 0, progress = null, mark = null }) {
  const n = Math.min(filled, g.chairs.length);
  const tw = ring ? 2 : 1.25;
  // v186: полоска времени — поверх контура столешницы, толще его
  const pw = 2.6, pp = progress && progress.p > 0.005 ? Math.min(1, progress.p) : 0;
  let bar = null;
  if (pp && g.top.kind === "circle") {
    const { cx, cy, r } = g.top, len = 2 * Math.PI * r;
    const arc = (k, w, col) => <circle key={k} data-sit-bar={k === "b" ? progress.level : undefined} data-sit-case={k === "c" ? "" : undefined} cx={cx} cy={cy} r={r} fill="none" stroke={col}
      strokeWidth={w} strokeLinecap="round" strokeDasharray={`${(len * pp).toFixed(2)} ${len.toFixed(2)}`} transform={`rotate(-90 ${cx.toFixed(2)} ${cy.toFixed(2)})`} />;
    bar = [progress.casing ? arc("c", pw + 2, progress.casing) : null, arc("b", pw, progress.color)];
  } else if (pp) {
    const t = g.top, k = Math.min(t.r, Math.min(t.w, t.h) / 2), wide = t.w >= t.h;
    const xy = wide ? [t.x + k, t.y + t.h, t.x + k + (t.w - 2 * k) * pp, t.y + t.h] : [t.x, t.y + k, t.x, t.y + k + (t.h - 2 * k) * pp];
    const ln = (key, w, col) => <line key={key} data-sit-bar={key === "b" ? progress.level : undefined} data-sit-case={key === "c" ? "" : undefined}
      x1={xy[0]} y1={xy[1]} x2={xy[2]} y2={xy[3]} stroke={col} strokeWidth={w} strokeLinecap="round" />;
    bar = [progress.casing ? ln("c", pw + 2, progress.casing) : null, ln("b", pw, progress.color)];
  }
  // at — отступ рисунка от края кнопки стола (v181: между соседними столами проход)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W.toFixed(2)} ${H.toFixed(2)}`} aria-hidden="true" focusable="false"
      style={{ position: "absolute", left: at, top: at, overflow: "visible", pointerEvents: "none" }}>
      {mark ? (g.top.kind === "circle"
        ? <circle data-waiter-ring="" cx={W / 2} cy={H / 2} r={Math.min(W, H) / 2 + 0.9} fill="none" stroke={mark} strokeWidth={1.7} />
        : <rect data-waiter-ring="" x={-0.9} y={-0.9} width={W + 1.8} height={H + 1.8} rx={Math.min(W, H) * 0.22} fill="none" stroke={mark} strokeWidth={1.7} />) : null}
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
      {bar}
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
