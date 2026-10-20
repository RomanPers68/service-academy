// v50 (Доп. 363): телефон лёжа и компьютер. После поворота iPhone текст больше не увеличивается; шире 600 px —
// меню слева вместо нижней панели, колонка экрана шире и по центру; главная, график руководителя и график
// сотрудника — в две колонки, когда хватает места; Наставник и итоги месяца на компьютере — панелью по центру;
// живой диалог лёжа — переписка слева, ответы справа. Портрет телефона не меняется ни на пиксель.
//
// Владелец: «Мы можем добавить горизонтальную ориентацию? Чтобы было удобно работать с компьютера, или же если
// перевернуть смартфон?», «после возвращения текст увеличивается… нужно сделать правильно», «Главное, чтобы всё
// приложение имело возможность переходить в горизонт, и было им удобно пользоваться». Вид в браузере (портрет —
// попиксельно как v49; 844×390, 667×375, 932×430, 820×1180, 1280×720, 1440×900) — tools/claude/e2e-v50.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

import { layoutOf, availOf, colWidthOf, homeTwoCols, WIDE_MIN, SHORT_MAX, RAIL_W, COL_W, HOME2_MIN } from "../ui/viewport";
import { NavRail } from "../ui/tabbar";

const h = React.createElement;
const RAW = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const rd = (f) => readFileSync(f, "utf8");
const app = rd("App.jsx"), css = rd("ui/css.js");

describe("v50: текст после поворота", () => {
  it("автоподгонка шрифта iOS выключена для всего приложения — и в стилях, и в index.html до загрузки скриптов", () => {
    expect(css).toContain("html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }");
    expect(rd("index.html")).toContain("<style>html{-webkit-text-size-adjust:100%;text-size-adjust:100%}</style>");
  });
  it("манифест больше не держит портрет", () => {
    expect(JSON.parse(rd("public/manifest.webmanifest")).orientation).toBe("any");
    expect(rd("docs/android-apk.md")).toContain("### Поворот экрана (v50)");
  });
});

describe("v50: раскладка по размеру экрана (ui/viewport.js)", () => {
  it("портрет телефона — как было; телефон лёжа, планшет и компьютер — широкая раскладка", () => {
    expect([WIDE_MIN, SHORT_MAX, RAIL_W, COL_W, HOME2_MIN]).toEqual([600, 540, 80, 640, 630]);
    expect(layoutOf(390, 844)).toMatchObject({ wide: false, short: false, desk: false });
    expect(layoutOf(430, 932).wide).toBe(false);
    expect(layoutOf(599, 900).wide).toBe(false);
    expect(layoutOf(844, 390)).toMatchObject({ wide: true, short: true, desk: false });
    expect(layoutOf(667, 375)).toMatchObject({ wide: true, short: true });
    expect(layoutOf(820, 1180)).toMatchObject({ wide: true, short: false, desk: false });
    expect(layoutOf(1280, 720)).toMatchObject({ wide: true, short: false, desk: true });
    expect(layoutOf(1440, 900)).toMatchObject({ wide: true, desk: true });
  });
  it("колонка: портрет 430, широкий экран 640; главная — в две колонки от 630 px свободного места", () => {
    const safe = { l: 0, r: 0 };
    expect(colWidthOf(layoutOf(393, 852), "roleSelect", false, safe)).toBe(430);
    expect(colWidthOf(layoutOf(844, 390), "shift", true, safe)).toBe(640);
    expect(availOf(layoutOf(1440, 900), true, safe)).toBe(1336);
    expect(colWidthOf(layoutOf(1440, 900), "roleSelect", true, safe)).toBe(1120);
    expect(colWidthOf(layoutOf(932, 430), "roleSelect", true, safe)).toBe(828);
    // iPhone лёжа с вырезом 47 + 47: свободно 646 — главная всё равно в две колонки (310 + 20 + 300)
    expect(availOf(layoutOf(844, 390), true, { l: 47, r: 47 })).toBe(646);
    expect(colWidthOf(layoutOf(844, 390), "roleSelect", true, { l: 47, r: 47 })).toBe(646);
    // iPhone 15 Pro лёжа (вырез 59 + 59): ровно 630 — две колонки; SE лёжа (667): 563 — одна колонка 640
    expect(colWidthOf(layoutOf(852, 393), "roleSelect", true, { l: 59, r: 59 })).toBe(630);
    expect(colWidthOf(layoutOf(667, 375), "roleSelect", true, safe)).toBe(640);
    // две колонки решает свободное место, а не колонка 640 по умолчанию (SE лёжа: 563 — одна колонка)
    expect(homeTwoCols(layoutOf(667, 375), true, safe)).toBe(false);
    expect(homeTwoCols(layoutOf(750, 340), true, safe)).toBe(true);
    expect(homeTwoCols(layoutOf(393, 852), false, safe)).toBe(false);
  });
});

describe("v50: меню слева (NavRail)", () => {
  const tabs = [{ id: "roleSelect", icon: "home", label: "Учусь" }, { id: "shift", icon: "daily", label: "Смена" },
    { id: "teamHub", icon: "team", label: "Команда" }, { id: "me", icon: "stats", label: "Я" }];
  it("те же четыре вкладки столбиком, активная — aria-current и линза; внизу — кнопка Наставника; id как у панели", () => {
    const html = RAW(h(NavRail, { tabs, activeId: "shift", onTab: () => {}, onAi: () => {}, a11y: false }));
    expect(html).toContain('id="sa-tabbar"');
    expect(html).toContain('data-nav-rail=""');
    expect((html.match(/data-rail-tab="/g) || []).length).toBe(4);
    expect(html).toMatch(/aria-current="page" data-rail-tab="shift"/);
    expect(html).toContain('data-rail-lens="1"');
    expect(html).toContain('aria-label="AI-ассистент" data-rail-ai=""');
    expect(html).toMatch(/left:calc\(12px \+ (var\(--sa-sl, )?env\(safe-area-inset-left, 0px\)\)?\)/);   // v51: вырез — из Telegram (--sa-sl)
  });
  it("лёжа (compact) — вкладки ниже: 54 px вместо 62; без onAi — без кнопки", () => {
    const tall = RAW(h(NavRail, { tabs, activeId: "me", onTab: () => {}, onAi: () => {}, a11y: true }));
    const low = RAW(h(NavRail, { tabs, activeId: "me", onTab: () => {}, a11y: true, compact: true }));
    expect(tall).toContain("height:62px");
    expect(low).toContain("height:54px");
    expect(low).not.toContain("data-rail-ai");
  });
  it("App: шире 600 px — меню слева и Наставник в нём; в портрете — нижняя панель (v64: Наставник — круг посередине неё)", () => {
    expect(app).toContain('import { useViewport, colWidthOf, homeTwoCols, RAIL_W } from "./ui/viewport";');
    expect(app).toContain('const homeCols = screen === "roleSelect" && homeTwoCols(vp, railOn, vp.safe);');
    expect(app).toContain('const NAV_SCREENS = ["roleSelect","home","module","leaderboard","glossary","stats","daily","playerDetail","team","shift","teamHub","me"];');
    expect(app).toContain("? <NavRail a11y={a11y} activeId={activeId} tabs={tabs} compact={vp.short} onTab={(id) => navigate(id)} onAi={() => navigate(\"assistant\")} />");
    expect(app).toContain(": <LiquidTabBar a11y={a11y} activeId={activeId} onTab={(id) => { if (screen !== id) vibrate(\"light\"); navigate(id); }} tabs={tabs}");
    // v55 (Доп. 368): условие плавающей кнопки вынесено в fabOn — по нему же ставится запас снизу (sa-fabon).
    // v64 (Доп. 377): Наставник — в нижнем меню (onAi), плавающая кнопка выключена; сама AiFab в коде осталась
    expect(app).toContain('onAi={() => navigate("assistant")} aiMode="center" />;');
    expect(app).toContain("const fabOn = false;");
    expect(app).toContain("{fabOn && (");
    expect(app).toContain('bottom: vp.wide ? 24 : 104');
  });
  it("подсказка главного: «Слева четыре вкладки», пузырь — справа от меню", () => {
    // v64 (Доп. 377): в тексте теперь и круг «AI» «посередине» — на компьютере он «внизу меню» слева
    expect(rd("ui/screens-roleselect.jsx")).toContain('text={wide && homeStep === 2 ? String(steps[homeStep] || "").replace(/^Внизу/, "Слева").replace("посередине", "внизу меню") : steps[homeStep]}');
    const w = rd("ui/widgets.jsx");
    expect(w).toContain("const side = box.h > box.w * 1.6 && box.left + box.w < vw * 0.3 && box.left + box.w + 16 + W + pad <= vw;");
    expect(w).toContain('data-hint-side=""');
  });
});

describe("v50: колонка экрана и классы на <html>", () => {
  it("App ставит sa-wide / sa-short / sa-desk / sa-railon и переменные --sa-rail, --sa-colw; колонка — sa-col", () => {
    expect(app).toContain('el.classList.toggle("sa-wide", vp.wide); el.classList.toggle("sa-short", vp.short);');
    expect(app).toContain('el.classList.toggle("sa-desk", vp.desk); el.classList.toggle("sa-railon", railOn);');
    expect(app).toMatch(/el\.style\.setProperty\("--sa-rail", /);   // v51: в px — с вырезом из Telegram
    expect(app).toContain('el.style.setProperty("--sa-colw", colW + "px");');
    expect(app).toContain('<div style={T.phone} className="sa-col">');
  });
  it("стили: колонка по центру свободного места справа от меню; слои порталом — по колонке; правила только с sa-wide", () => {
    // v52: ширину колонки экран может попросить сам (--sa-colw-req) — формула та же, через --sa-colwant
    expect(css).toContain("--sa-colwant: var(--sa-colw-req, var(--sa-colw, 640px));");
    expect(css).toContain("--sa-colx: max(calc(var(--sa-rail, 0px) + 12px), calc((100vw - var(--sa-colwant)) / 2));");
    expect(css).toContain("html.sa-wide .sa-col { width: var(--sa-colr) !important; max-width: none !important; flex-shrink: 0;");
    expect(css).toContain("html.sa-wide .tbp-pin { left: calc(var(--sa-colx) + var(--sa-colr) / 2) !important;");
    expect(css).toContain("html.sa-wide .ms-toast-pos { left: var(--sa-colx) !important;");
    expect(css).toContain("html.sa-wide .sa-colbar { padding-left: max(16px, var(--sa-colx)) !important;");
    for (const f of ["ui/content-editor.jsx", "ui/menu-trainer.jsx", "ui/cocktail-editor.jsx"]) expect(rd(f)).toContain('<div className="sa-colbar" style={{ position: "fixed", left: 0, right: 0,');
  });
  it("телефон лёжа: шапки ниже (тема), у слоёв «у стола» — компактные шапка и кнопки", () => {
    expect(app).toContain('const T = useMemo(() => (vp.short ? { ...T0, modHead: { ...T0.modHead, padding: "14px 18px 12px" },');
    expect(css).toContain("html.sa-short .tb-head { padding-top: max(10px, env(safe-area-inset-top, 0px)); }");
    expect(css).toContain("html.sa-short .sa-tophead { padding-top: 14px !important; }");
    for (const f of ["ui/screens-learning.jsx", "ui/module-menu.jsx", "ui/build.jsx"]) expect(rd(f)).toContain('className="sa-tophead"');
  });
  it("колесо мыши над горизонтальной лентой листает её вбок (у края — снова страницу)", () => {
    expect(css).toContain('document.addEventListener("wheel", e => {');
    expect(css).toContain("if (!el || el.scrollWidth <= el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) return;");
  });
});

describe("v50: главная в две колонки", () => {
  const rs = rd("ui/screens-roleselect.jsx");
  it("sa-home2: слева шапка дня, справа треки; заголовок треков — над правой колонкой", () => {
    expect(rs).toContain('<div style={T.screen} className={"sa-screen" + (wideCols ? " sa-home2" : "")}>');
    expect(rs).toContain('data-home2-title=""');
    expect(rs).toMatch(/\{!wideCols \? \(\s+(role \? \(\s+<button[^]*?\) : \(\s+)?<div (ref=\{refTracks\} data-tracks-title="" )?style=\{\{ padding:"0 14px 8px", display:"flex", alignItems:"center", gap:8/);   // v58: якорь «сменить»; v59: с треком — кнопка-переключатель
    expect(css).toContain("html.sa-wide .sa-home2 { display: grid !important; grid-template-columns: minmax(310px, 440px) minmax(300px, 1fr);");
    expect(css).toContain("column-gap: clamp(20px, 2.5vw, 32px); align-items: start; }");
    expect(css).toContain("grid-template-rows: repeat(12, auto) 1fr;");
    expect(css).toContain("html.sa-wide .sa-home2 > :first-child { grid-column: 1; grid-row: 1 / -1; }");
  });
  it("телефон лёжа — логотип меньше (118×94 вместо 198×158); узкая левая колонка — плотнее ряд инструментов", () => {
    // v56 (Доп. 369): стоя логотип на четверть меньше — 152×121 (было 198×158); лёжа — как был, 118×94
    expect(rs).toMatch(/width: short \? 118 : (198|152), height: short \? 94 : (158|121)/);
    expect(rs).toContain("(window.innerWidth < 380 || (wideCols && wideColW > 0 && wideColW < 728))");
    expect(app).toContain("<RoleSelect learnOnly wide={vp.wide} wideCols={homeCols} wideColW={homeCols ? colW : 0} short={vp.short}");
  });
});

describe("v50: график в широкой раскладке", () => {
  const sc = rd("ui/schedule.jsx");
  it("колонкой по центру; от 700 px — в две колонки: у руководителя таблица справа, у сотрудника календарь справа", () => {
    expect(sc).toContain("const twoCols = vpS.wide && vpS.w >= 700;");
    expect(sc).toContain('? <div className={"sa-schedcol" + (opts.two ? " sa-two" : "")}>{head}<div className="sa-schedbody">{kids}</div></div>');
    expect(sc).toContain(": <>{head}{kids}</>; })()}");
    expect(sc).toContain('</>, { arrows: tab !== "setup", two: twoCols && tab !== "setup" });');
    expect(sc).toContain("</>, { arrows: true, two: twoCols && !!me });");
    expect(sc).toContain('<div data-sched-tabs="" style=');
    expect(sc).toContain('<div style={card} data-sched-month="">');
    expect(sc).toContain('padding: vpS.short ? "14px 18px 4px" : "44px 18px 4px"');
  });
  it("сетка: вкладки на всю ширину, «Смены» и календарь — во второй колонке на все строки; «Сохранить» — плашкой внизу", () => {
    expect(css).toContain("html.sa-wide .sa-two .sa-schedbody { display: grid; grid-template-columns: minmax(340px, min(430px, 38%)) minmax(0, 1fr);");
    expect(css).toContain("html.sa-wide .sa-two .sa-schedbody > [data-sched-tabs] { grid-column: 1 / -1; grid-row: 1; }");
    expect(css).toContain("html.sa-wide .sa-two .sa-schedbody > [data-sched-gridcard] { grid-column: 2; grid-row: 2 / -1; }");
    expect(css).toContain("html.sa-wide .sa-two .sa-schedbody > [data-sched-month] { grid-column: 2; grid-row: 1 / -1; }");
    expect(css).toContain("html.sa-wide .sa-two [data-savebar] { position: fixed !important;");
  });
  it("месяц в две колонки тянется по ширине карточки (31 день на компьютере — без прокрутки вбок), подпись это знает", () => {
    expect(css).toContain("html.sa-wide .sa-two .sa-schedgrid:not(.sa-wk) table { table-layout: fixed; width: 100%; min-width: 898px; }");
    expect(css).toContain("html.sa-wide .sa-two .sa-schedgrid:not(.sa-wk) th.sa-schednm { width: 92px; }");
    expect(sc).toContain("const fits = !!(g && g.scrollWidth > 0 && g.scrollWidth <= g.clientWidth + 1);");
    expect(sc).toContain('(monthFits ? "Весь месяц — целиком. Тап по полоске — неделя крупнее" : "Весь месяц: таблица листается вбок. Тап по полоске — неделя, она влезает без прокрутки")');
  });
  it("в широкой раскладке у body нет поля браузера 8 px (в портрете оно остаётся, как было)", () => {
    expect(css).toContain("html.sa-wide body { margin: 0 !important; }");
  });
});

describe("v50: слои на весь экран", () => {
  it("Наставник и итоги месяца — на компьютере панелью по центру с притемнением; нажатие мимо не уходит в экран", () => {
    expect(rd("ui/assistant.jsx")).toContain('<div className="sa-screen sa-dlg sa-layer"');
    expect(rd("ui/assistant.jsx")).toContain('"--sa-layerw": "780px"');
    expect(rd("ui/month-recap.jsx")).toContain('<div className="mr tbv sa-layer" style={{ "--sa-layerw": "520px" }}');
    expect(css).toContain("@media (min-width: 900px) {");
    expect(css).toContain("html.sa-wide .sa-layer::before { content: \"\"; position: fixed; inset: 0; z-index: -1; }");
  });
  it("живой диалог лёжа: переписка слева, ответы справа во всю высоту; запасное поле под панель не нужно", () => {
    const d = rd("ui/screens-dialogue.jsx");
    expect(d).toContain("@media (min-width:700px) and (max-height:540px){");
    expect(d).toContain(".sa-dlg.dc .dc-chat{right:min(44%,400px)}");
    expect(d).toContain(".sa-dlg.dc .dc-pane{top:0;left:auto;width:min(44%,400px);transform:none}");
    expect(d).toContain("const covers = !!(box && box.getBoundingClientRect().left < el.getBoundingClientRect().right - 1);");
    expect(d).toContain("const extra = open && covers ? Math.max(0, bh + 14 - base) : open ? 0 : reserve;");
  });
});

describe("v50: попутно", () => {
  it("гид: «Показать подсказки заново» — под заголовком, а не внутри него (наезжал на «Назад» и название)", () => {
    const g = rd("ui/guide.jsx");
    const title = g.indexOf(">Что где и зачем</div>"), reset = g.indexOf('"Показать подсказки заново"');
    expect(title).toBeGreaterThan(0);
    expect(reset).toBeGreaterThan(title);
    expect(g.slice(title, reset)).toMatch(/<\/div>\s+<\/div>\s+\{\/\* v50 \(Доп\. 363\)/);
  });
  it("метка сборки — v50; CHANGES — «Дополнение 363»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2}<\/span>/);   // v51 — следующая метка
    expect(rd("CHANGES.md")).toContain("# Дополнение 363 — горизонталь и компьютер: меню слева, две колонки, текст после поворота (v50)");
  });
});
