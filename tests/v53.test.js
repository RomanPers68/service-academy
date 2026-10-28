// v53 (Доп. 366): редактор урока — полоска разделов «Урок · Практика · Диалог · Тест · Просмотр» прилипает сверху
// и на телефоне, как задумано в правке 162.
//
// Владелец — на «следующим шагом починю полоску разделов в редакторе урока на телефоне»: «Да, давай».
// Причина: обёртки экрана (T.app, T.screen) режут край overflow-x: hidden и потому сами считаются «прокруткой»;
// листается же #root — position: sticky внутри обёрток не прилипал. Вид в браузере — tools/claude/e2e-v53.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");

describe("v53: полоска разделов в редакторе урока прилипает", () => {
  const ed = rd("ui/content-editor.jsx"), css = rd("ui/css.js");
  it("класс sa-edon на <html> — пока нужен липкому (v54: только в две панели); вышел из урока — снят", () => {
    expect(ed).toContain("const edOpen = view === \"edit\";");
    // v54 (Доп. 367): полоска разделов больше не sticky (на iPhone дрожала) — clip нужен лишь предпросмотру в две панели
    expect(ed).toContain("if (!two || typeof document === \"undefined\") return undefined;");
    expect(ed).toContain("const el = document.documentElement; el.classList.add(\"sa-edon\");");
    expect(ed).toContain("return () => { el.classList.remove(\"sa-edon\"); };");
    expect(ed).toContain("}, [two]);");
    expect(ed).not.toContain("sa-ed2on");
  });
  it("обёртки экрана в уроке — обрезка без прокрутки (overflow-x: clip), только пока открыт урок", () => {
    expect(ed).toContain("<div style={T.screen} className=\"sa-edscreen\">");
    expect(css).toContain("html.sa-edon #root > div, html.sa-edon .sa-edscreen { overflow-x: clip !important; }");
    expect(css).not.toContain("sa-ed2on");
    // у остальных экранов обёртки прежние
    // v55 (Доп. 368): минимальная высота экрана — за вычетом верхней строки и отступов (tests/v55.test.js)
    expect(rd("ui/styles.js")).toMatch(/screen: \{ display:"flex", flexDirection:"column", minHeight:"[^"]+", background:"transparent", overflowX:"hidden" \},/);
  });
  it("полоска видна сверху при прокрутке, тап по разделу — заголовок под ней", () => {
    // v54: полоска на месте — position: relative; уехала вверх — сверху её копия (position: fixed), см. tests/v54.test.js
    expect(ed).toContain("<div data-ednav=\"\" ref={navRef} style={{ position: \"relative\", zIndex: 6,");
    expect(ed).toContain("if (r) r.scrollTop -= 58 + ((vpE.safe && vpE.safe.t) || 0); };   // под копию полоски сверху");
  });
  it("в две панели (v52) всё по-прежнему: предпросмотр прилипает, «Просмотр» подсвечивает", () => {
    expect(css).toContain("html.sa-wide .sa-ed2-pv { position: sticky; top: 10px;");
    expect(ed).toContain("if (k === \"prev\" && two && pv) {");
  });
});

describe("v53: метка и журнал", () => {
  it("метка сборки — v53; CHANGES — «Дополнение 366»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2,}<\/span>/);   // v54 — следующая метка
    expect(rd("CHANGES.md")).toContain("# Дополнение 366 — редактор урока: полоска разделов прилипает и на телефоне (v53)");
  });
});
