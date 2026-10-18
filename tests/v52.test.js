// v52 (Доп. 365): компьютер — остальные экраны используют ширину.
//
// Владелец: «На компьютере мы только график адаптировали?» → «Ну и по поводу компьютера. Да, делаем».
// «Смена», «Команда», «Я» — «сегодня» слева, плитки в две колонки; справочник, рейтинг, сертификаты, меню-тренажёр,
// список трека — сеткой; глоссарий и SOS — две независимые колонки; трек и книга отзывов — шире и крупнее; редактор
// урока — форма слева, «как увидит сотрудник» справа. Портрет не меняется. Вид в браузере — tools/claude/e2e-v52.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

import { splitAt } from "../ui/viewport";

const rd = (f) => readFileSync(f, "utf8");

describe("v52: экран сам просит ширину колонки", () => {
  const vp = rd("ui/viewport.js"), css = rd("ui/css.js");
  it("useColumn кладёт --sa-colw-req, пока экран открыт, и снимает при уходе; в портрете (0) ничего не трогает", () => {
    expect(vp).toContain("export function useColumn(w) {");
    expect(vp).toContain("if (!w || typeof document === \"undefined\") return undefined;");
    expect(vp).toContain("el.style.setProperty(\"--sa-colw-req\", Math.round(w) + \"px\");");
    expect(vp).toContain("return () => { el.style.removeProperty(\"--sa-colw-req\"); };");
    expect(vp).toContain("export function useWide() {");
  });
  it("колонка берёт запрошенную ширину вместо ширины от App и ужимается до свободного места", () => {
    expect(css).toContain("--sa-colwant: var(--sa-colw-req, var(--sa-colw, 640px));");
    expect(css).toContain("--sa-colx: max(calc(var(--sa-rail, 0px) + 12px), calc((100vw - var(--sa-colwant)) / 2));");
    expect(css).toContain("--sa-colr: min(var(--sa-colwant), calc(100vw - var(--sa-rail, 0px) - var(--sa-sr, env(safe-area-inset-right, 0px)) - 24px));");
  });
  it("какие экраны сколько просят (только на широком экране)", () => {
    expect(rd("ui/home-hubs.jsx")).toContain("useColumn(wide ? 1080 : 0);");
    expect(rd("ui/ReferenceSection.jsx")).toContain("useColumn(wide && (view === \"hub\" || view === \"course\") ? 900 : 0);");
    const sl = rd("ui/screens-learning.jsx");
    expect(sl).toContain("useColumn(wide ? 980 : 0);");          // глоссарий
    expect(sl).toContain("useColumn(wideScr ? 820 : 0);");       // трек
    expect(sl).toContain("useColumn(useWide() ? 820 : 0);   // v52 (Доп. 365): меню раздела — как страница трека");
    expect(rd("ui/menu-trainer.jsx")).toContain("useColumn(wide && !mode ? 900 : 0);");
    expect(rd("ui/screens-gamification.jsx")).toContain("useColumn(wide && !detailTab ? 900 : 0);");
    expect(rd("ui/screens-exam.jsx")).toContain("useColumn(wide ? 900 : 0);");
    expect(rd("ui/sos.jsx")).toContain("useColumn(wide ? 900 : 0);");
    expect(rd("ui/guestbook.jsx")).toContain("useColumn(wide ? 820 : 0);");
    expect(rd("ui/content-editor.jsx")).toContain("useColumn(two ? 1200 : vpE.wide && view === \"list\" ? 940 : 0);");
  });
});

describe("v52: две колонки без «перетекания» карточек", () => {
  it("splitAt режет по весам пополам; при равенстве левая колонка не короче правой", () => {
    expect(splitAt([1, 1, 1, 1, 1, 1, 1])).toBe(4);          // SOS: 4 слева, 3 справа
    expect(splitAt([1, 1, 1, 1, 1, 1])).toBe(3);
    expect(splitAt([1, 1])).toBe(1);
    expect(splitAt([1])).toBe(1);
    expect(splitAt([])).toBe(0);
    expect(splitAt([5, 1, 1, 1, 1, 1])).toBe(1);             // одна длинная карточка — против пяти коротких
    expect(splitAt([1, 1, 1, 1, 6])).toBe(4);
    expect(splitAt([2, 2, 2, 3, 3])).toBe(3);                // 6 | 6
    expect(splitAt([null, "x", -3, 2, 2])).toBe(4);          // мусор в весах — как ноль
  });
  it("SOS: слева здоровье, справа ситуации в зале; портрет — прежний список", () => {
    const s = rd("ui/sos.jsx");
    expect(s).toContain("if (!wide) return <div style={colSt}>{cards}</div>;");
    expect(s).toContain("const h = splitAt(cards.map(() => 1));");
    expect(s).toContain("return <div className=\"sa-2c sa-2cg\" data-sos-cols=\"\"><div style={colSt}>{cards.slice(0, h)}</div><div style={colSt}>{cards.slice(h)}</div></div>;");
  });
  it("глоссарий: заголовок раздела во всю ширину, термины — двумя колонками; разрез не зависит от заметок", () => {
    const s = rd("ui/screens-learning.jsx");
    expect(s).toContain("return { i, header: catHeader || null, card, w: 84 + String(g.def || \"\").length * 0.5 };");
    expect(s).toContain("if (!wide) return list.map((x) => <React.Fragment key={x.i}>{x.header}{x.card}</React.Fragment>);");
    expect(s).toContain("<div className=\"sa-2c\"><div>{gr.items.slice(0, h).map((x) => x.card)}</div><div>{gr.items.slice(h).map((x) => x.card)}</div></div>");
    expect(s).not.toMatch(/w: 84 \+[^\n]*note/);
  });
  it("стили: sa-2c — две колонки от 760 px, уже — одна под другой; только в широкой раскладке", () => {
    const css = rd("ui/css.js");
    expect(css).toContain("html.sa-wide .sa-2c { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; }");
    expect(css).toContain("@media (min-width: 760px) { html.sa-wide .sa-2c { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 14px; } }");
    expect(css).toContain("html.sa-wide .sa-2cg { row-gap: 10px; }");
    expect(css).not.toContain("sa-cols2");
  });
});

describe("v52: сетки карточек и вкладки", () => {
  const css = rd("ui/css.js");
  it("sa-g2 — две-три колонки, строки по содержимому (не растягиваются на высоту экрана)", () => {
    expect(css).toContain("html.sa-wide .sa-g2 { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));");
    expect(css).toContain("gap: 10px 12px !important; align-items: stretch; align-content: start; }");
    expect(css).toContain("html.sa-wide .sa-g2 > [data-span] { grid-column: 1 / -1; }");
  });
  it("где сетка: справочник (курсы и главы), меню-тренажёр, рейтинг, сертификаты, список трека, список уроков редактора", () => {
    const ref = rd("ui/ReferenceSection.jsx");
    expect(ref).toContain("<div className=\"sa-g2\" style={{ ...T.modList, paddingTop: 8 }}>");
    expect(ref).toContain("<div className=\"sa-g2\" style={T.lessList}>");
    expect(rd("ui/menu-trainer.jsx")).toMatch(/className="sa-g2"/);
    expect(rd("ui/screens-gamification.jsx")).toContain("return wide ? <div className=\"sa-g2\" data-lb-cols=\"\">{rows}</div> : rows;");
    expect(rd("ui/screens-exam.jsx")).toMatch(/className="sa-g2"/);
    expect(rd("ui/screens-learning.jsx")).toContain("<div style={T.modList} className=\"sa-stagger sa-g2\">");
    expect(rd("ui/content-editor.jsx")).toContain("<div className=\"sa-g2\">{secs.map(([name, ls]) => {");
  });
  it("«Смена», «Команда», «Я»: слева «сегодня», справа плитки; уже 1024 px — друг под другом; портрет — прежний список", () => {
    const h = rd("ui/home-hubs.jsx");
    expect(h).toContain("<div className=\"sa-hub2\" data-hub2=\"\">");
    expect(h).toContain("<div className=\"sa-hub2-l\">{hero}{hintEl}</div>");
    expect(h).toContain("<div className=\"sa-hub2-r\"><div className=\"sa-hubtiles\">{tiles}</div>{footer}</div>");
    expect(h).toContain("<div style={{ padding: \"6px 16px 100px\", display: \"flex\", flexDirection: \"column\", gap: 10 }}>");
    expect(css).toContain("@media (min-width: 1024px) { html.sa-wide .sa-hub2 { grid-template-columns: minmax(330px, 400px) minmax(0, 1fr); column-gap: 22px; } }");
    expect(css).toContain("html.sa-wide .sa-hubtiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 10px 12px; align-content: start; }");
  });
});

describe("v52: трек и книга отзывов — шире и крупнее", () => {
  const css = rd("ui/css.js");
  it("трек и меню раздела на компьютере — шрифт меню крупнее (только sa-desk)", () => {
    expect(css).toContain("html.sa-desk .tbm-title { font-size: 25px; }");
    expect(css).toContain("html.sa-desk .tbm-t { font-size: 17px; }");
    expect(css).toContain("html.sa-desk .tbm-list > li { --my: 18px; }");
    expect(css).toContain("html.sa-desk .tbm-list > li.cur { --my: 37px; }");
  });
  it("книга отзывов крупнее по ступеням высоты окна; телефон лёжа (sa-short) — без увеличения", () => {
    expect(rd("ui/guestbook.jsx")).toContain("<div className=\"sa-gbbook\" style={{ flex: 1, display: \"flex\", flexDirection: \"column\", justifyContent: \"center\", padding: \"12px 16px 6px\" }}>");
    expect(css).toContain("@media (min-height: 860px) { html.sa-wide:not(.sa-short) .sa-gbbook { zoom: 1.1; } }");
    expect(css).toContain("@media (min-height: 940px) { html.sa-wide:not(.sa-short) .sa-gbbook { zoom: 1.18; } }");
    expect(css).toContain("@media (min-height: 1020px) { html.sa-wide:not(.sa-short) .sa-gbbook { zoom: 1.28; } }");
  });
});

describe("v52: редактор урока в две панели", () => {
  const ed = rd("ui/content-editor.jsx"), css = rd("ui/css.js");
  it("две панели — от 1000 px свободной ширины и только в самом уроке (не в списке)", () => {
    expect(ed).toContain("export const ED2_MIN = 1000;");
    expect(ed).toContain("const two = vpE.wide && view === \"edit\" && vpE.w - vpE.safe.l - vpE.safe.r - 24 >= ED2_MIN;");
    expect(ed).toContain("const edWrap = (cls, ref, kids) => (two ? <div className={cls} ref={ref} data-ed2={cls}>{kids}</div> : kids);");
    expect(ed).toContain("{edWrap(\"sa-ed2-f\", null, <>");
    expect(ed).toContain("{edWrap(\"sa-ed2-pv\", pvRef, <>");
  });
  it("предпросмотр в две панели открыт всегда, без «Скрыть»; в портрете — по кнопке, как раньше", () => {
    expect(ed).toContain("{showPreview || two ? (<>");
    expect(ed).toContain("{two ? null : <button onClick={() => setShowPreview(false)} style={{ ...ghost, marginBottom: 12 }}>Скрыть предпросмотр ▴</button>}");
    expect(ed).toContain("Показать, как увидит сотрудник ▾</button>}");
  });
  it("«Просмотр» в полоске разделов — к началу предпросмотра с подсветкой", () => {
    expect(ed).toContain("if (k === \"prev\" && two && pv) {");
    expect(ed).toContain("pv.classList.remove(\"sa-ed2-flash\"); void pv.offsetWidth; pv.classList.add(\"sa-ed2-flash\"); return;");
    expect(css).toContain("@keyframes saEd2Flash");
  });
  it("предпросмотр прилипает и листается сам; обёртки экрана в две панели — overflow-x: clip (иначе липкое не липнет)", () => {
    expect(css).toContain("html.sa-wide .sa-ed2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, 410px); column-gap: 28px; align-items: start; }");
    expect(css).toContain("html.sa-wide .sa-ed2-pv { position: sticky; top: 10px; min-width: 0; max-height: calc(100vh - 110px); overflow-y: auto;");
    expect(css).toContain("margin-top: 8px; padding: 0 6px 130px; box-sizing: border-box; border-radius: 18px; scrollbar-width: thin; }");
    expect(css).toContain("html.sa-ed2on #root > div, html.sa-ed2on .sa-edscreen { overflow-x: clip !important; }");
    expect(css).toContain("html.sa-wide .sa-ed2 { padding-bottom: 0 !important; }");
    expect(css).toContain("html.sa-wide .sa-ed2-f { padding-bottom: 150px; }");
    expect(ed).toContain("const el = document.documentElement; el.classList.add(\"sa-ed2on\");");
    expect(ed).toContain("return () => { el.classList.remove(\"sa-ed2on\"); };");
    expect(ed).toContain("<div style={T.screen} className={two ? \"sa-edscreen\" : undefined}>");
  });
});

describe("v52: портрет не трогаем", () => {
  it("все новые правила — только в широкой раскладке (sa-wide / sa-desk / sa-ed2on)", () => {
    const css = rd("ui/css.js");
    const block = css.slice(css.indexOf("/* ═══ v52 (Доп. 365)"), css.indexOf("`;", css.indexOf("/* ═══ v52 (Доп. 365)")));
    const rules = block.split("\n").map((l) => l.trim()).filter((l) => /^[.a-z@][^{]*\{/.test(l) && !l.startsWith("@keyframes") && !l.startsWith("/*"));
    expect(rules.length).toBeGreaterThan(20);
    for (const r of rules) {
      const sel = r.startsWith("@media") ? r.slice(r.indexOf("{") + 1) : r;
      if (/^\.sa-ed2-flash/.test(sel.trim())) continue;   // класс ставится только в две панели
      expect(sel.trim()).toMatch(/^html\.sa-(wide|desk|ed2on)/);
    }
  });
});

describe("v52: метка и журнал", () => {
  it("метка сборки — v52; CHANGES — «Дополнение 365»", () => {
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v52</span>");
    expect(rd("CHANGES.md")).toContain("# Дополнение 365 — компьютер: остальные экраны используют ширину (v52)");
  });
});
