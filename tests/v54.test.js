// v54 (Доп. 367): полоска разделов редактора урока больше не дрожит; «Сборка руками» лёжа — сцена слева, полки справа.
//
// Владелец — на «починю так же «Сборку руками» у бара, чтобы картинка сборки оставалась наверху»: «Давай починим»;
// и запись экрана v53: «Линия дрожит» — на iPhone полоска «Урок · Практика · …» (position: sticky внутри прокрутки
// приложения) дрожала при листании. Вид в браузере — tools/claude/e2e-v54.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");

describe("v54: полоска разделов — копией сверху, а не sticky", () => {
  const ed = rd("ui/content-editor.jsx"), css = rd("ui/css.js");
  it("сама полоска — position: relative (не sticky), одна разметка для неё и для копии", () => {
    expect(ed).toContain("<div data-ednav=\"\" ref={navRef} style={{ position: \"relative\", zIndex: 6, margin: \"0 -16px 6px\", padding: \"7px 8px\", display: \"flex\", gap: 3, ...navBg }}>");
    expect(ed).toContain("const navRow = navItems.map(([k, l]) => {");
    expect(ed).not.toMatch(/data-ednav="" style=\{\{ position: "sticky"/);
  });
  it("уехала вверх — копия в слое поверх экрана (portal в body), на том же месте и той же ширины", () => {
    expect(ed).toContain("const up = en.isIntersecting ? en.intersectionRect.top > b.top + 0.5 : b.top < topInsetPx();");   // v69: верх — под кнопками Telegram
    expect(ed).toContain("setNavPin(up ? box() : null);");
    expect(ed).toContain("}, { threshold: [0, 1] });");
    expect(ed).toContain("const onR = () => setNavPin((p) => (p ? box() : p));");
    expect(ed).toContain("<div data-ednav-pin=\"\" className=\"sa-ednav-pin\" style={{ left: navPin.left, width: navPin.width, ...navBg }}>{navRow}</div>, document.body) : null}");
    expect(css).toContain(".sa-ednav-pin { position: fixed; top: 0; z-index: 330; box-sizing: border-box; display: flex; gap: 3px;");
    expect(css).toContain("padding: calc(var(--sa-st, env(safe-area-inset-top, 0px)) + 7px) 8px 7px; }");   // v69: и кнопки Telegram
  });
  it("обрезка без прокрутки (sa-edon) — только в две панели, для липкого предпросмотра", () => {
    expect(ed).toContain("if (!two || typeof document === \"undefined\") return undefined;");
    expect(ed).toContain("}, [two]);");
  });
});

describe("v54: «Сборка руками» лёжа — две колонки", () => {
  const lab = rd("ui/bar-lab.jsx"), css = rd("ui/css.js");
  it("лёжа (sa-short) — колонка шире, шейкер и бокал столбиком, доска полная — с советом к коктейлю", () => {
    expect(lab).toContain("const lying = useViewport().short;");
    expect(lab).toContain("useColumn(lying ? 820 : 0);");
    expect(lab).toContain("const narrowW = useNarrow();   // Доп. 231: узкий телефон — сцена столбиком, доска компактнее");
    expect(lab).toContain("const narrow = narrowW || lying;   // v54: лёжа сцена в половине ширины — тоже столбиком; доска — полная, с советом (narrowW)");
    expect(lab).toContain("{c.tip && !narrowW && <div");
  });
  it("разметка: тело сборки, режим, чеки «Часа пик», сцена, станция; липкость сцены не трогаем (как было)", () => {
    expect(lab).toContain("<div className=\"sa-labbody\" style={{ padding: \"0 16px 110px\" }}>");
    expect(lab).toContain("<div data-labmode=\"\" style={{ display: \"flex\", justifyContent: \"space-between\"");
    expect(lab).toContain("<div data-labrush=\"\" style={{ display: \"flex\", alignItems: \"flex-end\", gap: 8, marginBottom: 10, overflow: \"hidden\", height: 54 }}>");
    expect(lab).toContain("<div data-labstation=\"\" style={{ marginTop: 12 }}>");
    expect(lab).toContain("<div data-labscene=\"\" style={{ position: \"sticky\", top: 0, zIndex: 6, margin: \"0 -16px\", padding: \"6px 16px 10px\"");
    expect(lab).not.toContain("sa-labon");
    expect(css).not.toContain("sa-labon");
  });
  it("стили — только лёжа: чеки над обеими колонками, сцена слева, справа режим со счётом и полки", () => {
    expect(css).toContain("grid-template-areas: \"rush rush\" \"scene mode\" \"scene station\"; column-gap: 16px; align-items: start;");
    expect(css).toContain("padding-bottom: 24px !important; }");
    expect(css).toContain("html.sa-short .sa-labbody > [data-labscene] { grid-area: scene; margin: 0 !important; padding: 0 0 10px !important; background: none !important; }");
    expect(css).toContain("html.sa-short .sa-labbody > [data-labstation] { grid-area: station; margin-top: 0 !important; min-width: 0; }");
    // блок v54 — до следующего блока (v55, Доп. 368) или до конца стилей
    const start = css.indexOf("/* ═══ v54 (Доп. 367)"), next = css.indexOf("/* ═══ v55", start);
    const block = css.slice(start, next > 0 ? next : css.indexOf("`;", start));
    const rules = block.split("\n").map((l) => l.trim()).filter((l) => /^html\./.test(l));
    expect(rules.length).toBeGreaterThanOrEqual(5);
    for (const r of rules) expect(r).toMatch(/^html\.sa-short /);
  });
});

describe("v54: метка и журнал", () => {
  it("метка сборки — v54; CHANGES — «Дополнение 367»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2,}<\/span>/);   // v55 — следующая метка
    expect(rd("CHANGES.md")).toContain("# Дополнение 367 — полоска редактора не дрожит; «Сборка руками» лёжа — сцена и полки рядом (v54)");
  });
});
