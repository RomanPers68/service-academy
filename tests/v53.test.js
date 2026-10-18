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
  it("пока открыт урок (в любой раскладке) — класс sa-edon на <html>; вышел из урока — снят", () => {
    expect(ed).toContain("const edOpen = view === \"edit\";");
    expect(ed).toContain("if (!edOpen || typeof document === \"undefined\") return undefined;");
    expect(ed).toContain("const el = document.documentElement; el.classList.add(\"sa-edon\");");
    expect(ed).toContain("return () => { el.classList.remove(\"sa-edon\"); };");
    expect(ed).toContain("}, [edOpen]);");
    expect(ed).not.toContain("sa-ed2on");
  });
  it("обёртки экрана в уроке — обрезка без прокрутки (overflow-x: clip), только пока открыт урок", () => {
    expect(ed).toContain("<div style={T.screen} className=\"sa-edscreen\">");
    expect(css).toContain("html.sa-edon #root > div, html.sa-edon .sa-edscreen { overflow-x: clip !important; }");
    expect(css).not.toContain("sa-ed2on");
    // у остальных экранов обёртки прежние
    expect(rd("ui/styles.js")).toContain("screen: { display:\"flex\", flexDirection:\"column\", minHeight:\"100vh\", background:\"transparent\", overflowX:\"hidden\" },");
  });
  it("полоска прилипает под вырез сверху (env), тап по разделу — заголовок под полоской", () => {
    expect(ed).toContain("<div data-ednav=\"\" style={{ position: \"sticky\", top: \"env(safe-area-inset-top, 0px)\", zIndex: 6,");
    expect(ed).toContain("if (r) r.scrollTop -= 58 + ((vpE.safe && vpE.safe.t) || 0); };   // под прилипшую полоску");
  });
  it("в две панели (v52) всё по-прежнему: предпросмотр прилипает, «Просмотр» подсвечивает", () => {
    expect(css).toContain("html.sa-wide .sa-ed2-pv { position: sticky; top: 10px;");
    expect(ed).toContain("if (k === \"prev\" && two && pv) {");
  });
});

describe("v53: метка и журнал", () => {
  it("метка сборки — v53; CHANGES — «Дополнение 366»", () => {
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v53</span>");
    expect(rd("CHANGES.md")).toContain("# Дополнение 366 — редактор урока: полоска разделов прилипает и на телефоне (v53)");
  });
});
