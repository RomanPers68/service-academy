// v47 (Доп. 360): листок календаря без светлой полосы.
//
// Владелец прислал снимок плитки «График смен»: «нашёл небольшой визуальный баг» — по низу числа на листке
// шла светлая полоса. Под листком лежит край следующего листка; его верх заходил под листок, а в тёмной теме
// листок полупрозрачный — подложка просвечивала. Теперь верх подложки обрезан: край виден только под листком.
// Вид в браузере (плитка и карточка смены, обе темы) — /home/claude/preview/e2e-v47.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

import { CalendarPage } from "../ui/schedule-tile";
import { palette } from "../ui/day-emblems";

const h = React.createElement;
const RAW = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
// стиль подложки (край следующего листка) — первый вложенный span листка
const under = (html) => { const m = html.match(/<span data-page-under="" style="([^"]*)"/); return m ? m[1] : null; };
const num = (style, prop) => { const m = style.match(new RegExp("(?:^|;)" + prop + ":(-?[\\d.]+)px")); return m ? +m[1] : null; };

describe("v47: край следующего листка — только под листком", () => {
  for (const a11y of [false, true]) for (const [w, hh] of [[31, 34], [46, 50]]) {
    it(`${a11y ? "светлая" : "тёмная"} тема, листок ${w} × ${hh}: верх подложки обрезан ровно на ту часть, что под листком`, () => {
      const st = under(RAW(h(CalendarPage, { day: 18, p: palette(a11y), a11y, off: true, w, h: hh })));
      expect(st).toBeTruthy();
      const bottom = num(st, "bottom"), height = num(st, "height");
      const inside = +(height + bottom).toFixed(2);            // bottom отрицательный: сколько подложки заходит под листок
      expect(inside).toBeGreaterThan(0);
      expect(st).toContain(`clip-path:inset(${inside}px 0 0 0)`);
      expect(st).toContain(`-webkit-clip-path:inset(${inside}px 0 0 0)`);
    });
  }
  it("размер по умолчанию не изменился: 31 × 34, подложка 8 px, из них 3 px под листком", () => {
    const html = RAW(h(CalendarPage, { day: 7, p: palette(false), a11y: false }));
    expect(html).toContain("width:31px;height:34px");
    const st = under(html);
    expect([num(st, "bottom"), num(st, "height")]).toEqual([-3, 8]);
    expect(st).toContain("clip-path:inset(5px 0 0 0)");
  });
  it("листок по-прежнему полупрозрачный в тёмной теме и плотный в светлой — меняется только подложка", () => {
    expect(RAW(h(CalendarPage, { day: 7, p: palette(false), a11y: false }))).toContain("linear-gradient(180deg, rgba(255,240,205,0.13), rgba(255,240,205,0.05))");
    expect(RAW(h(CalendarPage, { day: 7, p: palette(true), a11y: true }))).toContain("background:#FFFCF4");
  });
  it("метка сборки — v47; CHANGES — «Дополнение 360»", () => {
    expect(readFileSync("ui/menu-trainer.jsx", "utf8")).toMatch(/· сборка v\d{2,}<\/span>/);   // v48 — следующая метка
    expect(readFileSync("CHANGES.md", "utf8")).toContain("# Дополнение 360 — листок календаря без светлой полосы (v47)");
  });
});
