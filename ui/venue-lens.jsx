// ui/venue-lens.jsx — v199 (Доп. 524): «Какое заведение показать» — лента для руководства сети на экранах статистики
// (аналитика, отчёт, «Что дало обучение», новички, кандидаты, график). Владелец (26.11): «руководитель всей сети мог
// по заведениям увидеть статистику, а вот руководитель конкретного заведения… только то, за которым он прикреплен».
// Кто сеть и что выбрано — lib/org.js (useLens); остальным лента не показывается: у них всегда своё заведение.
import React from "react";
import { LiquidSegment } from "./widgets";
import { LENS_ALL, lensErr } from "../lib/org-model";

/** Лента заведений; lens — из useLens. Одно заведение в сети — ленты нет */
export function VenueLens({ a11y, lens, style = null }) {
  if (!lens || !lens.network) return null;
  const items = [...(lens.withAll ? [{ id: LENS_ALL, label: "Вся сеть" }] : []), ...lens.venues.map((v) => ({ id: v, label: v }))];
  if (items.length < 2) return null;
  return (
    <div data-venue-lens={lens.venue} role="group" aria-label="Какое заведение показать" style={{ margin: "8px 0 6px", ...(style || {}) }}>
      <LiquidSegment a11y={a11y} equal={false} scroll activeId={lens.venue} onSelect={(id) => lens.pick(id)}
        items={items.map((it) => ({ id: it.id, label: it.label,
          render: (on) => <span data-venue-pick={it.id} data-on={on ? "1" : "0"}>{it.label}{it.id === lens.own && lens.own ? " · своё" : ""}</span> }))} />
    </div>
  );
}

/** Чужое заведение не открылось: почему (этапа 62 нет, заведения нет в списке, нет связи) */
export function LensNote({ a11y, code, admin = false, style = null }) {
  if (!code) return null;
  return (
    <div role="status" data-lens-note={code} style={{ fontSize: 12.5, lineHeight: 1.5, padding: "8px 2px", color: a11y ? "#6B4E1A" : "#D9BE84", ...(style || {}) }}>
      {lensErr(code, admin)}
    </div>
  );
}
