// v136 (Доп. 449): «Барная карта» ещё удобнее и красивее. Владелец (04.11): «Как думаешь, ещё удобнее и красивее барную
// карту можно сделать?» — на десять предложений «Давай все», первый («карта сразу на первом экране») — «пока не будем
// делать». lib/bottle-art.js (нарисованная бутылка), lib/bar-view.js (точки, порядок, похожие), ui/bar-kit.jsx (вид списка,
// «Как сказать», «Советуем»), ui/wine-list.jsx, ui/bar-card.jsx, печать с бутылками; e2e — tools/claude/e2e-v136.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToString } from "react-dom/server";
import * as W from "../lib/wine.js";
import { WINE, SPIRIT } from "../lib/drinks.js";
import { DOT, dotOf, SORTS, sortItems, similarOf } from "../lib/bar-view.js";
import { bottleLook, bottleSvg, bottleUrl, drawBottle } from "../lib/bottle-art.js";
import { withSomRules, readSomRules } from "../lib/sommelier.js";
import { drinkRow } from "../lib/bar-print.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const T = { screen: {}, modCard: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modArrow: {}, para: {}, doneBtn: {} };
const strip = (html) => html.replace(/<!-- -->/g, "");
const NB = " ";
const wn = (o, id, ai = []) => W.normWine({ ...o }, { id, ai });
const CHA = wn({ name: "Шабли", producer: "Domaine Laroche", country: "Франция", region: "Бургундия", grapes: ["шардоне"], color: "white", sweet: "сухое", byGlass: true, priceGlass: 950, priceBottle: 5200 }, "w-cha");
const SAU = wn({ name: "Совиньон Блан / Sauvignon Blanc", country: "Новая Зеландия", grapes: ["совиньон блан"], color: "white", sweet: "сухое", priceBottle: 6900, stop: { since: 1, by: "Мария Ким" } }, "w-sau");
const RIE = wn({ name: "Рислинг Кабинетт / Riesling Kabinett", country: "Германия", grapes: ["рислинг"], color: "white", sweet: "полусладкое", byGlass: true, priceGlass: 780, priceBottle: 4300 }, "w-rie");
const PIN = wn({ name: "Пино Нуар", country: "Франция", grapes: ["пино нуар"], color: "red", sweet: "сухое", priceBottle: 6100, img: "https://photos.example/pinot.jpg" }, "w-pin");
const MOS = wn({ name: "Москато д’Асти", country: "Италия", grapes: ["москато"], color: "dessert", sweet: "сладкое", priceBottle: 3300 }, "w-mos");
const OLD = wn({ name: "Гави", country: "Италия", grapes: ["кортезе"], color: "white", sweet: "сухое", priceBottle: 5000, archived: true }, "w-old");
const NOP = wn({ name: "Аглианико", color: "red" }, "w-nop");
const WINES = [CHA, SAU, RIE, PIN, MOS, OLD, NOP];
const HEN = SPIRIT.norm({ name: "Hendrick's", cat: "gin", country: "Шотландия", portion: 40, pricePortion: 520 }, { id: "sp-hen" });
const RULES = { text: "", prio: ["wine:w-pin", "cocktail:negroni"], by: "Мария Ким", at: 1 };
const TEAM = withSomRules([CHA, SAU, RIE, PIN, MOS, OLD, HEN], RULES);
// localStorage на время рендера (вид списка, меню команды в телефоне)
const withStore = async (store, fn) => {
  const was = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  try { return await fn(); } finally { globalThis.localStorage = was; }
};

describe("v136: нарисованная бутылка вместо пустой рамки (lib/bottle-art.js)", () => {
  it("у вина — по цвету, у крепкого — по виду; неизвестное — обычная", () => {
    expect(bottleLook("wine", { color: "sparkling" }).s).toBe("champagne");
    expect(bottleLook("wine", { color: "red" }).clear).toBeFalsy();
    expect(bottleLook("wine", { color: "white" }).liquid).toBeTruthy();
    expect(bottleLook("wine", { color: "dessert" }).s).toBe("slender");
    expect(bottleLook("spirit", { cat: "whisky" }).s).toBe("square");
    expect(bottleLook("spirit", { cat: "cognac" }).s).toBe("flask");
    expect(bottleLook("spirit", { cat: "vodka" }).s).toBe("tall");
    expect(bottleLook("spirit", { cat: "??" })).toBe(bottleLook("spirit", { cat: "other" }));
    expect(bottleLook("wine", null)).toBe(bottleLook("wine", { color: "other" }));
  });
  it("SVG 60 × 150 без надписей (этикетка без текста — не путать с настоящей); data:-адрес из кэша", () => {
    const svg = bottleSvg("wine", { color: "rose" });
    expect(svg).toContain('viewBox="0 0 60 150"');
    expect(svg).not.toContain("<text");
    expect(svg).toContain('fill="#F4EBD7"');   // этикетка
    const u = bottleUrl("spirit", { cat: "gin" });
    expect(u.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(bottleUrl("spirit", { cat: "gin", name: "другой" })).toBe(u);
    expect(bottleUrl("spirit", { cat: "rum" })).not.toBe(u);
    expect(typeof drawBottle).toBe("function");
  });
});

describe("v136: точки разделов, порядок и похожие (lib/bar-view.js)", () => {
  it("точка: цвет вина, вид крепкого, основа коктейля; неизвестное — без точки", () => {
    expect(dotOf("wine", "red")).toBe(DOT.wine.red);
    expect(dotOf("spirit", "whisky")).toBe("#C98A3A");
    expect(dotOf("cocktail", "Джин")).toBe("#9CC3CF");
    expect(dotOf("wine", "nope")).toBe("");
    expect(SORTS).toEqual([["sec", "Разделы"], ["price", "Цена"], ["az", "А–Я"]]);
  });
  it("«Цена» — от недорогих, без цены в конце; «А–Я» — по названию; «Разделы» — как было", () => {
    const pr = (x) => x.priceBottle;
    expect(sortItems(WINES, "price", { price: pr }).map((x) => x.id)).toEqual(["w-mos", "w-rie", "w-old", "w-cha", "w-pin", "w-sau", "w-nop"]);
    expect(sortItems(WINES, "az", { title: (x) => x.name }).map((x) => x.id)).toEqual(["w-nop", "w-old", "w-mos", "w-pin", "w-rie", "w-sau", "w-cha"]);
    expect(sortItems(WINES, "sec")).toEqual(WINES);
    expect(sortItems(WINES, "sec")).not.toBe(WINES);
  });
  it("похожие: тот же раздел, цена рядом, страна, сорт; без себя, архива и «сегодня нет»", () => {
    expect(similarOf(WINE, SAU, WINES).map((x) => x.id)).toEqual(["w-cha", "w-rie"]);
    expect(similarOf(WINE, CHA, WINES).map((x) => x.id)).toEqual(["w-rie"]);   // Совиньон сегодня нет, Гави в архиве
    expect(similarOf(WINE, CHA, WINES, { n: 0 })).toEqual([]);
    expect(similarOf(WINE, null, WINES)).toEqual([]);
  });
});

describe("v136: вид списка, «Как сказать», «Советуем» (ui/bar-kit.jsx)", () => {
  it("«Разделы · Цена · А–Я» и «Подробно · Кратко» — капсулы без кольца", async () => {
    const { ViewBar } = await import("../ui/bar-kit.jsx");
    const h = strip(renderToString(React.createElement(ViewBar, { sorts: SORTS, sort: "price", onSort: () => {}, short: true, onShort: () => {}, gold: "#c8a96e", text: "#fff", sub: "#aaa" })));
    for (const s of ['data-bar-view="price,short"', 'aria-pressed="true" data-bar-sort="price"', 'data-bar-sort="az"', 'data-bar-short="on"', ">Подробно<", ">Кратко<", ">А–Я<", 'data-lens-seg="flat"'])
      expect(h, s).toContain(s);
    // один порядок — без капсулы порядка
    const one = renderToString(React.createElement(ViewBar, { sorts: [["sec", "Разделы"]], sort: "sec", onSort: () => {}, short: false, onShort: () => {}, gold: "#c8a96e" }));
    expect(one).not.toContain("data-bar-sort");
  });
  it("«Как сказать»: сначала название, потом сорт («Шабли́ · Шардоне́»); словарь не знает — строки нет", async () => {
    const { HowToSay } = await import("../ui/bar-kit.jsx");
    const h = strip(renderToString(React.createElement(HowToSay, { words: ["Шабли", "", "шардоне", "Бургундия"], gold: "#c8a96e", text: "#fff" })));
    expect(h).toMatch(/data-bar-say="Шабли,Шардоне/);
    expect(h).toContain("Как сказать: ");
    expect(renderToString(React.createElement(HowToSay, { words: ["Пёстрый кот"], gold: "#c8a96e", text: "#fff" }))).toBe("");
  });
  it("руководителю: «☆ Советовать первым» / «★ Советуем первым»", async () => {
    const { PrioToggle } = await import("../ui/bar-kit.jsx");
    const on = renderToString(React.createElement(PrioToggle, { on: true, onClick: () => {}, gold: "#c8a96e", text: "#fff" }));
    const off = renderToString(React.createElement(PrioToggle, { on: false, busy: true, onClick: () => {}, gold: "#c8a96e", text: "#fff" }));
    expect(on).toContain('data-bar-prio="on"'); expect(on).toContain("★ Советуем первым");
    expect(off).toContain('data-bar-prio="off"'); expect(off).toContain("☆ Советовать первым"); expect(off).toContain("disabled");
  });
  it("вид списка помнит телефон, у каждой вкладки свой", () => {
    const K = rd("ui/bar-kit.jsx");
    expect(K).toContain('const prefKey = (what, kind) => "sa_bar_" + what + "_" + kind;');
    expect(K).toContain('localStorage.setItem(prefKey("short", kind), v ? "1" : "0")');
  });
});

describe("v136: вина и крепкое (ui/wine-list.jsx)", () => {
  const list = async (props, store = {}) => withStore(store, async () => {
    const { WineListScreen } = await import("../ui/wine-list.jsx");
    return strip(renderToString(React.createElement(WineListScreen, { T, a11y: false, profile: { restaurant: "R", position: "waiter", name: "Анна", surname: "С" }, onBack: () => {}, onEdit: () => {},
      kind: "wine", team: [TEAM, () => {}, true], listTitle: "Барная карта", ...props })));
  });
  it("список: «★ Советуем», точки разделов, «Фильтр», порядок и вид, у каждой строки бутылка (фото или нарисованная)", async () => {
    const h = await list({});
    for (const s of ['data-wine-only="prio"', "★ Советуем", 'data-bar-view="sec"', 'data-bar-sort="price"', 'data-bar-short="off"', 'data-wine-thumb="art"', 'data-wine-thumb="photo"', 'data-bar-dot="' + DOT.wine.white + '"', ">Фильтр</button>"])
      expect(h, s).toContain(s);
    expect(h).toMatch(/data-wine-row="w-pin"[\s\S]{0,2500}data-wine-prio=""/);
    expect(h).not.toContain("Подобрать гостю");
    expect(h).not.toContain('data-wine-row="w-old"');   // архив — не в карте
  });
  it("«Кратко»: строка в одну линию, «бокалом» — значком бокала, цена бутылки", async () => {
    const h = await list({}, { sa_bar_short_wine: "1" });
    expect(h).toContain('data-bar-view="sec,short"');
    expect(h).toMatch(/data-wine-row="w-cha" data-wine-short=""[\s\S]{0,1600}data-wine-short-glass=""[\s\S]{0,600}data-wine-short-price=""[^>]*>5 200 ₽</);
    expect(h).toMatch(/data-wine-row="w-sau" data-wine-short=""[\s\S]{0,1200}сегодня нет/);
  });
  it("«Цена»: одним списком без заголовков разделов", async () => {
    const h = await list({}, { sa_bar_sort_wine: "price" });
    expect(h).toContain('data-wine-flat="price"');
    const ids = [...h.matchAll(/data-wine-row="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["w-mos", "w-rie", "w-cha", "w-pin", "w-sau"]);
  });
  it("карточка «сегодня нет»: сразу «Предложи вместо» из похожих; бутылка в шапке нарисована", async () => {
    const h = await list({ startId: "w-sau" });
    expect(h).toContain("Сегодня нет. Предложи вместо:");
    expect(h).toContain('data-wine-instead="2"');
    expect(h).toContain('data-wine-similar-go="w-cha"');
    expect(h).toContain("data-wine-art=");
    expect(h).not.toContain("Похожие в нашей карте");
  });
  it("карточка: фото в шапке (касание — крупно), «Как сказать», «Похожие в нашей карте»; официанту «★ советуем» значком", async () => {
    const h = await list({ startId: "w-pin" });
    for (const s of ['data-wine-hero=""', 'data-wine-photo-big=""', 'aria-label="Фото бутылки крупно"', "★ советуем"]) expect(h, s).toContain(s);
    expect(h).not.toContain("data-bar-prio");
    const c = await list({ startId: "w-cha" });
    expect(c).toMatch(/data-bar-say="Шабли,Шардоне/);
    expect(c).toContain("Похожие в нашей карте");
    expect(c).toContain('data-wine-similar="1"');
  });
  it("руководителю: «★ Советуем первым» в карточке вместо значка; сохранять можно, когда меню с сервера пришло", async () => {
    const h = await list({ startId: "w-pin", profile: { restaurant: "R", position: "manager", name: "Мария", surname: "Ким" } });
    expect(h).toContain('data-bar-prio="on"');
    expect(h).not.toContain(">★ советуем<");
    const L = rd("ui/wine-list.jsx");
    expect(L).toContain("if (busy || !setShared || !menuLoaded) return;");
    expect(L).toContain("<PrioToggle on={prioOn} busy={busy || !menuLoaded}");
    expect(L).toContain('const arr = withSomRules(shared, { ...rules, prio: next, by: who, at: Date.now() });');
    expect(readSomRules(TEAM).prio).toEqual(["wine:w-pin", "cocktail:negroni"]);
  });
});

describe("v136: коктейли (ui/bar-card.jsx)", () => {
  const bar = async (props = {}, extra = {}) => withStore({ sa_menu_shared: JSON.stringify({ R: TEAM }), ...extra }, async () => {
    const { BarCardScreen } = await import("../ui/bar-card.jsx");
    return strip(renderToString(React.createElement(BarCardScreen, { T, a11y: false, profile: { restaurant: "R", position: "waiter" }, onBack: () => {}, onEdit: () => {}, startTab: "cocktail", ...props })));
  });
  it("строка: что из нашей карты — в той же строке, что метод и бокал; «★ советуем»; точки; «Советуем» в разделах", async () => {
    const h = await bar();
    expect(h).toMatch(/data-bar-ck="negroni"[\s\S]{0,12000}★ советуем[\s\S]{0,900}стир · рокс · <span data-bar-ck-spirits="1"[^>]*>Hendrick&#x27;s<\/span>/);   // бокал (SVG) длинный
    for (const s of ['data-bar-ck-only="prio"', "★ Советуем", 'data-bar-dot="#9CC3CF"', 'data-bar-view="sec"', 'data-bar-sort="az"']) expect(h, s).toContain(s);
    expect(h).not.toContain('data-bar-sort="price"');   // цен у коктейлей нет — «Цена» не показываем
    expect(h).not.toContain("Из нашей карты: ");
  });
  it("«Кратко»: имя, «★», значок «свой» или «сегодня нет»", async () => {
    const h = await bar({}, { sa_bar_short_cocktail: "1" });
    expect(h).toContain('data-bar-view="sec,short"');
    expect(h).toMatch(/data-bar-ck="negroni" data-bar-ck-short=""[\s\S]{0,1400}data-bar-ck-prio=""/);
    expect(h).not.toContain("data-bar-ck-art=\"\"");
  });
  it("карточка: «Как готовить» свёрнуто (состав уже сверху), «Как готовить · 7 шагов» с касанием; руководителю — «★ Советуем первым»", async () => {
    const h = await bar({ startId: "negroni" });
    expect(h).toContain('data-bar-ck-how-toggle="closed"');
    expect(h).toContain("Как готовить · 7 шагов, как в лаборатории");
    expect(h).not.toContain("Стир 20 секунд");
    expect(h).toContain(">★ советуем<");
    const m = await bar({ startId: "negroni", profile: { restaurant: "R", position: "manager", name: "Мария", surname: "Ким" } });
    expect(m).toContain('data-bar-prio="on"');
    expect(m).not.toContain(">★ советуем<");
    const B = rd("ui/bar-card.jsx");
    expect(B).toContain("if (busy || !setShared || !teamLoaded) return;");
    expect(B).toContain('const stepsWord = (n) =>');
  });
});

describe("v136: печать — где нет фото, нарисованная бутылка", () => {
  it("у строки вина и крепкого — вид бутылки (look)", () => {
    expect(drinkRow(WINE, CHA).look).toEqual({ kind: "wine", color: "white", cat: "" });
    expect(drinkRow(SPIRIT, HEN).look).toEqual({ kind: "spirit", color: "", cat: "gin" });
  });
  it("переключатель — когда в выбранном есть вина или крепкое; без фото — «С бутылками ✓»", async () => {
    const { BarPrint } = await import("../ui/bar-print.jsx");
    const h = strip(renderToString(React.createElement(BarPrint, { T, a11y: false, restaurant: "R", cocktails: [], wines: [CHA, RIE], spirits: [], start: { kind: "wine" }, onBack: () => {} })));
    expect(h).toContain('data-bar-print-photo="on"');
    expect(h).toContain(">С бутылками ✓<");
    const P = rd("ui/bar-print.jsx");
    expect(P).toContain("else if (look) drawBottle(x, look.kind, look, X + 6, Y + 6, PH.w - 12, PH.h - 12);");
    expect(P).toContain("try { out = await build(withPhoto && hasBottles); }");
    expect(P).toContain('import { drawBottle } from "../lib/bottle-art";');
  });
});

describe("v136: «Править» из карточки не стирает фото (ui/wine-editor.jsx)", () => {
  // форма открывалась с копии меню в телефоне — в ней нет фото data: — и «Сохранить» записывало вино без фото
  const E = rd("ui/wine-editor.jsx");
  it("пришло меню с сервера, форму не трогали — форма из свежей записи; правят — подставляется фото; «Убрать» — убирает", () => {
    expect(E).toContain("const [shared, setShared, loaded] = useTeamMenu(restaurant);");
    expect(E).toContain("const f = { ...blank(), ...r }; opened.current = loaded ? null : f; setForm(f);");
    expect(E).toContain("if (opened.current && form === opened.current) { opened.current = null; setForm({ ...blank(), ...fresh }); return; }");
    expect(E).toContain("if (!form.img && fresh.img && !picCleared.current) setForm(");
    expect(E).toContain("setPic(null); picCleared.current = true; setForm((x) => ({ ...x, img: \"\" }));");
  });
  it("копия меню в телефоне — без фото data: (так и задумано: память телефона)", () => {
    expect(rd("lib/reference-context.js")).toContain('(typeof d.img === "string" && d.img.startsWith("data:")) ? { ...d, img: "" } : d');
  });
});

describe("v136: демо и тексты", () => {
  it("в демо руководитель отметил «★ Советуем первым» вино, крепкое и коктейль; «Совиньон блан» сегодня нет", () => {
    const B = rd("tools/claude/demo-app/boot.js");
    expect(B).toContain('MENU.push({ id: "__somrules__", kind: "somrules", text: "", prio: ["wine:wn-demo-6", "spirit:sp-demo-1", "cocktail:negroni"]');
    expect(B).toContain('MENU.filter((d) => d && d.id === "wn-demo-3").forEach((d) => Object.assign(d, { stop: {');
    const C = rd("tools/claude/demo-app/check.mjs");
    for (const s of ["m49-wines-price", "m50-wines-short", "m51-wine-instead", "m52-wine-chablis", "m53-wine-prio", "m54-cocktails-prio", "m55-spirits-art", "/Стоп-лист: 3/"]) expect(C, s).toContain(s);
  });
  it("без тире-ритма и эмодзи; метка — v136", () => {
    for (const f of ["ui/bar-kit.jsx", "ui/wine-list.jsx", "ui/bar-card.jsx", "ui/bar-print.jsx", "ui/wine-editor.jsx", "lib/bottle-art.js", "lib/bar-view.js", "lib/bar-print.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(Number((rd("ui/menu-trainer.jsx").match(/· сборка v(\d+)<\/span>/) || [])[1])).toBeGreaterThanOrEqual(136);
  });
  it("гид, README, CHANGES", () => {
    const G = rd("ui/guide.jsx");
    expect(G).toContain('{ key: "barview", title: "Барная карта: удобнее"');
    expect(G).toContain("с бутылками или без: у позиции фото, а без фото нарисованная бутылка. Выбран раздел, поиск или фильтр");
    expect(dashes(G.split("\n").find((l) => l.includes('key: "barview"')))).toBe(0);
    expect(rd("tools/claude/README.md")).toContain("`e2e-v136.mjs` — v136 (Доп. 449)");
    expect(rd("CHANGES.md")).toContain("# Дополнение 449 — «Барная карта» ещё удобнее и красивее (v136)");
  });
});
