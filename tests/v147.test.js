// v147 (Доп. 470): кнопки снова линзы. В v146 золотая заливка «одной главной кнопки» легла на все кнопки с
// data-lens-btn="main" и .tb-main — их в коде ~170 на ~45 экранах, в «Графике» золотых выходило до трёх рядом.
// Владелец (12.11), снимки урока и «Графика»: «Некоторые кнопки сменили линзы на золотые», «Посмотри, где ещё они
// изменились». Кнопки — прежние линзы (ui/home-look.jsx) с одним кольцом. Доп. 471: и «Начать» на главной — не золотой
// корешок, а линза с подсветкой («Как будто она не вписывается. Особенно заметно в теме для чтения»).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { LOOK_V146_CSS } from "../ui/look-v146";

const rd = (p) => readFileSync(p, "utf8");

describe("v147: кнопки — линзы с одним кольцом, «Начать» на главной — линза с подсветкой", () => {
  it("в стилях v146 нет золотой заливки кнопок и тёмной надписи на ней", () => {
    expect(LOOK_V146_CSS).not.toContain("linear-gradient(172deg");
    expect(LOOK_V146_CSS).not.toContain("#24180A");
    expect(LOOK_V146_CSS).not.toMatch(/\[data-lens-btn="main"\][^{]*\{[^}]*background/);
    expect(LOOK_V146_CSS).not.toMatch(/\.tb-main[^{]*\{[^}]*background/);
    expect(LOOK_V146_CSS).not.toMatch(/\[data-lens-btn="main"\][^{]*(\*|svg)/);   // значки и текст внутри — как у линзы
  });
  it("у кнопок одно кольцо: внешнее (::after) скрыто, у главной и у кнопок уроков у стола, радио и «Живого гостя»", () => {
    expect(LOOK_V146_CSS).toContain('html.sa-lens [data-lens-btn="main"]:not(#sa-v146)::after,html.sa-lens .tb-main:not(#sa-v146)::after{display:none!important}');
  });
  it("линза главной кнопки — прежняя (стекло, ободок, свет; надпись золотом)", () => {
    const L = rd("ui/home-look.jsx");
    expect(L).toContain('html.sa-lens [data-lens-btn="main"]{position:relative;color:var(--lk-hi)!important;font-weight:bold!important;border-color:transparent!important;');
    expect(L).toContain("background:radial-gradient(120% 160% at 50% 0%,rgba(232,201,131,0.24),rgba(200,169,110,0.12) 62%)!important;");
    expect(L).toContain("html.sa-lens .tb-table .tb-main:not(:disabled){position:relative;overflow:visible;color:var(--lk-hi);");
  });
  // Доп. 471 (12.11), владелец о «Начать» на главной: «Давай подумаем над этой кнопкой. Как будто она не вписывается.
  // Особенно заметно в теме для чтения». Из трёх вариантов — линза с подсветкой и одним кольцом.
  it("«Начать» — линза с подсветкой: стекло светлее, ободок ярче, свечение; второе кольцо скрыто; надпись золотом", () => {
    const S = "html.sa-lens .sa-look-lens [data-now-stub]";
    expect(LOOK_V146_CSS).toContain(S + ":not(#sa-v146){width:84px!important;background:radial-gradient(80% 55% at 50% 40%,rgba(232,201,131,0.15),rgba(232,201,131,0) 72%)}");
    expect(LOOK_V146_CSS).toContain(S + " [data-now-lens]:not(#sa-v146){width:50px!important;height:50px!important;");
    expect(LOOK_V146_CSS).toContain("inset 0 0 0 1.5px rgba(232,201,131,0.9),inset 0 0 16px rgba(255,230,170,0.16),inset 0 1.5px 0 rgba(255,255,255,0.32),0 0 20px rgba(232,201,131,0.3)!important}");
    expect(LOOK_V146_CSS).toContain(S + " [data-now-lens]:not(#sa-v146)>span{display:none!important}");
    expect(LOOK_V146_CSS).toContain(S + " [data-now-cta]:not(#sa-v146){color:#E8C983!important;font-size:16px!important;font-weight:bold!important;text-align:center;line-height:1.15}");
    expect(LOOK_V146_CSS).toContain("html.sa-lens.sa-light .sa-look-lens [data-now-stub] [data-now-cta]:not(#sa-v146){color:#6B4E1A!important}");
    expect(LOOK_V146_CSS).not.toContain("linear-gradient");   // золота в стилях v146 больше нет
  });
  it("надпись «Начать» читается: золото на тёмной карточке и тёмное золото на бумаге — контраст 4,5 и выше", () => {
    const lum = (hex) => { const v = hex.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    for (const bg of ["#2A2113", "#3A2F1F", "#4A3C26"]) expect(cr("#E8C983", bg), bg).toBeGreaterThanOrEqual(4.5);
    for (const bg of ["#FFFDF8", "#F7EEDC", "#EBDDBF"]) expect(cr("#6B4E1A", bg), bg).toBeGreaterThanOrEqual(4.5);
  });
  it("метка сборки — v147 и новее (номер последней версии сторожит tests/v145.test.js)", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    expect(n[0]).toBeGreaterThanOrEqual(147);
  });
});
