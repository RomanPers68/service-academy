// v129 (Доп. 442): «Барная карта» — зашёл и не заблудился. Владелец (02.11): «Как ещё можем сделать удобнее барную карту.
// Что бы человек зайдя в неё не заблудился и все было интуитивно понятно?» — на восемь предложений «Давай все».
// ui/bar-kit.jsx (поле поиска со своим крестиком, «Показаны: …», конец списка, «Нашлось во вкладке», строка «Учить»,
// листание пальцем, раздел под копией шапки, место вкладки, подсказка первого входа), ui/bar-card.jsx (память вкладок,
// поиск по всей карте, «Из карточки …»), ui/wine-list.jsx, lib/drinks.js («Барная карта · Вина»), data/hints.js (barCard);
// e2e — tools/claude/e2e-v129.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToString } from "react-dom/server";
import * as W from "../lib/wine.js";
import { WINE, SPIRIT } from "../lib/drinks.js";
import { HINTS, hintsFor } from "../data/hints.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const wn = (o, id, ai = []) => W.normWine({ ...o }, { id, ai });
const T = { screen: {}, modCard: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modArrow: {}, para: {}, doneBtn: {} };
const strip = (html) => html.replace(/<!-- -->/g, "");

describe("v129: где ты и что показано", () => {
  it("сверху карточки и тренировки — «Барная карта · Вина / Крепкое»; в конце списка — «Показать все вина / всё крепкое»", () => {
    expect([WINE.t.kicker, SPIRIT.t.kicker]).toEqual(["Барная карта · Вина", "Барная карта · Крепкое"]);
    expect([WINE.t.showAll, SPIRIT.t.showAll]).toEqual(["Показать все вина", "Показать всё крепкое"]);
  });
  it("«Показаны: Красные, по запросу «шаб», 2 из 30 · Показать все»; без фильтров строки нет; конец списка", async () => {
    const { FilterNote, EndNote } = await import("../ui/bar-kit.jsx");
    const f = renderToString(React.createElement(FilterNote, { parts: ["Красные", "по запросу «шаб»"], n: 2, total: 30, onReset: () => {}, gold: "#c8a96e", text: "#fff", sub: "#aaa" }));
    expect(f).toContain('data-bar-filter="2/30"');
    expect(f).toContain("Показаны: Красные, по запросу «шаб», 2 из 30");
    expect(f).toContain(">Показать все<");
    expect(renderToString(React.createElement(FilterNote, { parts: [], n: 30, total: 30, onReset: () => {} }))).toBe("");
    const e = renderToString(React.createElement(EndNote, { text: "Это весь раздел «Красные»", button: "Показать все вина", onClick: () => {}, gold: "#c8a96e", sub: "#aaa" }));
    expect(e).toContain(">Это весь раздел «Красные»<");
    expect(e).toContain('data-bar-end-all=""');
  });
  it("поле поиска: свой крестик, когда есть текст; браузерный спрятан правилом стилей", async () => {
    const { SearchField } = await import("../ui/bar-kit.jsx");
    const on = renderToString(React.createElement(SearchField, { value: "шабли", onChange: () => {}, placeholder: "Поиск", aria: "Поиск", gold: "#c8a96e", text: "#fff" }));
    const off = renderToString(React.createElement(SearchField, { value: "", onChange: () => {}, placeholder: "Поиск", aria: "Поиск", gold: "#c8a96e", text: "#fff" }));
    expect(on).toContain('data-bar-search=""');
    expect(on).toContain('aria-label="Очистить поиск"');
    expect(off).not.toContain("data-bar-search-clear");
    expect(rd("ui/css.js")).toContain("input[data-bar-search]::-webkit-search-cancel-button, input[data-bar-search]::-webkit-search-decoration { -webkit-appearance: none; appearance: none; display: none; }");
  });
  it("«Нашлось во вкладке «Вина»»: три строки и «Все 24 во вкладке «Вина» ›»; нашлось и здесь — «Ещё нашлось…»", async () => {
    const { Elsewhere } = await import("../ui/bar-kit.jsx");
    const g = [{ tab: "wine", label: "Вина", n: 24, items: [{ id: "a", title: "Шабли 2022", sub: "Франция" }, { id: "b", title: "Кьянти" }, { id: "c", title: "Бароло" }] }];
    const none = strip(renderToString(React.createElement(Elsewhere, { groups: g, none: true, onOpen: () => {}, onAll: () => {}, T, gold: "#c8a96e", text: "#fff", sub: "#aaa" })));
    expect(none).toContain(">Нашлось во вкладке «Вина»<");
    expect(none).toContain('data-bar-elsewhere-item="a"');
    expect(none).toContain(">Все 24 во вкладке «Вина» ›<");
    const more = renderToString(React.createElement(Elsewhere, { groups: [{ ...g[0], n: 3 }], onOpen: () => {}, onAll: () => {}, T, gold: "#c8a96e", text: "#fff", sub: "#aaa" }));
    expect(more).toContain(">Ещё нашлось во вкладке «Вина»<");
    expect(more).not.toContain("data-bar-elsewhere-all");
    expect(renderToString(React.createElement(Elsewhere, { groups: [], onOpen: () => {}, onAll: () => {}, T }))).toBe("");
  });
});

describe("v129: «Учить», стрелки, пальцем, память вкладки", () => {
  const BIG = Array.from({ length: 12 }, (_, i) => wn({ name: "Вино " + (i + 1), country: "Италия", color: ["white", "red"][i % 2], sweet: "сухое", grapes: ["санджовезе"], notes: ["вишня"], priceBottle: 2000 + i * 500, byGlass: i % 3 === 0 }, "w" + (i + 1)));
  const render = async (props = {}) => {
    const { WineListScreen } = await import("../ui/wine-list.jsx");
    return strip(renderToString(React.createElement(WineListScreen, { T, a11y: false, profile: { restaurant: "R", position: "waiter", name: "А", surname: "Б" }, onBack: () => {}, onEdit: () => {}, kind: "wine", team: [BIG, () => {}, true], listTitle: "Барная карта", ...props })));
  };
  it("строка «Учить» у вин: «С чего начать», «Колода», «Викторина», «Ещё» (прежняя тренировка); над поиском", async () => {
    const html = await render();
    expect(html).toContain('data-bar-learn-row="glass,deck,quiz,more"');
    expect(html).toContain(">Учить<");
    expect(html).toContain(">бокалом: 0 из 4<");
    expect(html).toMatch(/data-bar-learn="more" data-lens-card="" data-wine-train-open=""/);
    expect(html.indexOf("data-bar-learn-row")).toBeLessThan(html.indexOf('data-bar-search=""'));
    expect(html).not.toContain("Колода, викторина, путь новичка");   // прежней карточки «Учить вина» нет
  });
  it("у каждой строки — золотая стрелка; у первой — цель подсказки; вкладка помнит раздел и поиск («Показаны: …», конец списка)", async () => {
    const html = await render();
    expect((html.match(/data-wine-row=/g) || []).length).toBe(12);
    expect((html.match(/data-bar-chev=""/g) || []).length).toBe(12);
    expect(html).toContain('id="sa-bar-row1"');
    const kept = await render({ keep: { q: "Вино 1", only: "red", pick: { b: 0, s: "" } } });
    expect(kept).toContain("Показаны: Красные, по запросу «Вино 1», 2 из 12");   // красные — чётные: «Вино 10» и «Вино 12»
    expect(kept).toContain(">Это всё, что нашлось<");
    expect(kept).toContain(">Показать все вина<");
    const sec = await render({ keep: { only: "red" } });
    expect(sec).toContain(">Это весь раздел «Красные»<");
  });
  it("карточка: сверху «Барная карта · Вина» или откуда пришёл; листается пальцем", async () => {
    expect(await render({ startId: "w3" })).toContain(">Барная карта · Вина<");
    expect(await render({ startId: "w3", fromText: "Из поиска «шабли»", cardBack: () => {} })).toContain(">Из поиска «шабли»<");
    const L = rd("ui/wine-list.jsx");
    for (const s of ["{...swipe(nav.prev ? () => goCard(nav.prev.id, \"l\") : null, nav.next ? () => goCard(nav.next.id, \"r\") : null)}", 'className={slide === "l" ? "sa-cardpage-l" : slide === "r" ? "sa-cardpage-r" : undefined}',
      "useKeepScroll(view === \"list\" && !openId, k0.scroll,", "const backTrain = () => setView(trainFrom);", 'useSection(view === "list" && !openId && all.length > 0, "[data-wine-group]", "data-wine-group")']) expect(L, s).toContain(s);
  });
  it("жест: влево — следующая, вправо — предыдущая; вертикально, медленно-коротко и от края — нет", async () => {
    const { useSwipe } = await import("../ui/bar-kit.jsx");
    let api = null;
    const Probe = () => { api = useSwipe(); return null; };
    renderToString(React.createElement(Probe));
    const run = (x0, dx, dy) => { const log = []; const h = api(() => log.push("prev"), () => log.push("next"));
      h.onTouchStart({ touches: [{ clientX: x0, clientY: 400 }] }); h.onTouchMove({ touches: [{ clientX: x0 + dx, clientY: 400 + dy }] }); h.onTouchEnd({ changedTouches: [{ clientX: x0 + dx, clientY: 400 + dy }] }); return log.join(); };
    expect(run(250, -140, 10)).toBe("next");
    expect(run(100, 140, -8)).toBe("prev");
    expect(run(200, -30, 160)).toBe("");
    expect(run(12, -160, 0)).toBe("");
  });
  it("«Барная карта»: вкладки — цель подсказки; коктейли — та же строка «Учить»; память вкладок, поиск по всей карте, «Из карточки …»", async () => {
    const { BarCardScreen } = await import("../ui/bar-card.jsx");
    const html = strip(renderToString(React.createElement(BarCardScreen, { T, a11y: false, profile: { restaurant: "R", position: "manager" }, onBack: () => {}, onEdit: () => {}, onCocktailDeck: () => {}, onBarLab: () => {} })));
    expect(html).toContain('id="sa-bar-tabs"');
    expect(html).toContain('data-bar-learn-row="deck,lab"');
    expect(html).toContain('data-bar-chev=""');
    const ck = strip(renderToString(React.createElement(BarCardScreen, { T, a11y: false, profile: { restaurant: "R", position: "waiter" }, onBack: () => {}, onEdit: () => {}, startTab: "cocktail", startId: "negroni" })));
    expect(ck).toContain(">Барная карта · Коктейли<");
    const BC = rd("ui/bar-card.jsx");
    for (const s of ["const mem = React.useRef({});", "if (k === cur) { if (pin) toTop(); return; }", "openIn(k, id, { tab: cur, id: null, q, back: null })",
      'mem.current[k] = { ...(mem.current[k] || {}), q, only: "all", pick: { b: 0, s: "" }, scroll: 0 };', 'return n ? "Из карточки " + n : "";', 'return b.q ? "Из поиска «" + b.q + "»" : "";',
      'add("wine", "Вина", WINE.find(wines, t),', 'add("spirit", "Крепкое", SPIRIT.find(spirits, t),', 'id={pin ? undefined : "sa-bar-tabs"}']) expect(BC, s).toContain(s);
    const P = rd("ui/bar-pin.jsx");
    for (const s of ["export const showActiveChip = (row) =>", "React.useLayoutEffect(() => { showActiveChip(rowRef.current); }, [box ? box.width : 0, active]);", '{line ? <div data-bar-pin-line="">{line}</div> : null}']) expect(P, s).toContain(s);
    expect(rd("ui/wine-list.jsx")).toContain('export function useInnerTop(key, listKey = "list", initial = 0) {');
  });
});

describe("v129: подсказка первого входа и документы", () => {
  it("три шага по экрану: вкладки, строка и карточка, «Учить»; в демо — видна", () => {
    expect(hintsFor("barCard")).toEqual(["Три вкладки: коктейли, вина и крепкое. Каждая помнит, где ты остановился.",
      "Коснись строки, и откроется карточка. Карточки листаются пальцем влево и вправо.", "Учить можно прямо отсюда: каждая кнопка ведёт сразу в тренировку."]);
    for (const t of HINTS.barCard) expect(t).not.toMatch(/ — /);
    const K = rd("ui/bar-kit.jsx");
    for (const s of ['useHintOnce("barCard", ready)', '[["tabs", "sa-bar-tabs"], ["row", "sa-bar-row1"], ["learn", "sa-bar-learn"]]', 'id="sa-bar-learn"']) expect(K, s).toContain(s);
    expect(rd("tools/claude/demo-app/boot.js")).toContain('for (const k of Object.keys(HINTS)) if (k !== "barCard") s["sa_hint_v" + HINTS_VERSION + "_" + k] = "1";');
  });
  it("README, CHANGES, проверка демо; без тире-ритма и эмодзи в новом коде; метка — v129", () => {
    expect(rd("tools/claude/README.md")).toContain("`e2e-v129.mjs` — v129 (Доп. 442)");
    expect(rd("CHANGES.md")).toContain("# Дополнение 442 — «Барная карта»: зашёл и не заблудился (v129)");
    for (const s of ["m11a-bar-hint", "m37-wines-filter", "m38-search-elsewhere", '[data-bar-learn="new"]']) expect(rd("tools/claude/demo-app/check.mjs"), s).toContain(s);
    for (const f of ["ui/bar-kit.jsx", "ui/bar-pin.jsx", "ui/bar-card.jsx", "ui/wine-list.jsx", "ui/wine-editor.jsx", "lib/drinks.js", "ui/css.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(129|1[3-9]\d|[2-9]\d\d)<\/span>/);
  });
});
