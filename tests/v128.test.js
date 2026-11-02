// v128 (Доп. 441): «Барная карта» удобнее, проще, красивее. Владелец (01.11) прислал запись своей карты и спросил, как
// сделать удобнее, проще и красивее; на семь предложений — «Делаем все». lib/bar-view.js (названия в две строки, страна
// и регион без повтора, «Подобрать гостю», сколько ждёт проверки), ui/wine-list.jsx (строка проверки, «Верно для
// раздела», метка AI, «Подобрать»), ui/bar-pin.jsx (шапка не уезжает), ui/bar-card.jsx (бокалы), ui/cocktails.jsx не
// трогали; e2e — tools/claude/e2e-v128.mjs.
// Затем владелец: «Заходя в коктейли, нажимая на колонку, появляется тот же список. Делаешь лишние движения» — «Да,
// давай»: колода и лаборатория — две кнопки рядом; карточка коктейля в «Барной карте»; карточки листаются подряд; после
// «Сохранить» — снова карточка; поиск сверху находит вина и крепкое.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToString } from "react-dom/server";
import * as V from "../lib/bar-view.js";
import * as W from "../lib/wine.js";
import * as S from "../lib/spirit.js";
import * as R from "../lib/wine-train.js";
import * as B from "../lib/bar-card.js";
import { WINE, SPIRIT } from "../lib/drinks.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const NB = " ";
const wn = (o, id, ai = []) => W.normWine({ ...o }, { id, ai });

describe("v128: названия, страна и регион (lib/bar-view.js)", () => {
  it("«Русское / Original» — две строки; бленд через «/» и одно письмо — одно название", () => {
    expect(V.nameParts("«Золотая Балка» / \"Zolotaya Balka\" White Semi-Sweet")).toEqual({ main: "«Золотая Балка»", orig: "\"Zolotaya Balka\" White Semi-Sweet" });
    expect(V.nameParts("Австрийский Зект, Сигети Рислинг Брют / Szigeti Riesling Sekt Brut")).toEqual({ main: "Австрийский Зект, Сигети Рислинг Брют", orig: "Szigeti Riesling Sekt Brut" });
    expect(V.nameParts("Szigeti Riesling Sekt Brut / Сигети Рислинг Брют")).toEqual({ main: "Сигети Рислинг Брют", orig: "Szigeti Riesling Sekt Brut" });
    expect(V.nameParts("Каберне / Мерло").orig).toBe("");
    expect(V.nameParts("Cabernet / Merlot").orig).toBe("");
    expect(V.nameParts("Шабли").main).toBe("Шабли");
    expect(V.nameParts(null)).toEqual({ main: "", orig: "" });
  });
  it("заголовок: год и выдержка — к русскому названию, как у K.title", () => {
    expect(V.titleParts(WINE, wn({ name: "Шабли / Chablis", vintage: "2022" }, "a"))).toEqual({ main: "Шабли 2022", orig: "Chablis" });
    expect(V.titleParts(WINE, wn({ name: "Шабли", vintage: "2022" }, "b"))).toEqual({ main: "Шабли 2022", orig: "" });
    expect(V.titleParts(SPIRIT, S.normSpirit({ name: "Гленфиддик / Glenfiddich", age: "12 лет" }, { id: "c" }))).toEqual({ main: "Гленфиддик 12 лет", orig: "Glenfiddich" });
  });
  it("страна и регион без повтора — в строке вина и крепкого, в проверке, в тренировке", () => {
    expect([["Австрия", "Австрия"], ["Франция", "Франция, Шампань"], ["Франция", "Шампань"], ["", "Крым"], ["Италия", ""], [null, null]].map(([c, r]) => V.placeText(c, r)))
      .toEqual(["Австрия", "Франция, Шампань", "Франция, Шампань", "Крым", "Италия", ""]);
    const w = wn({ name: "Зект", country: "Австрия", region: "Австрия", grapes: ["рислинг"], color: "sparkling", sweet: "брют" }, "z");
    expect(W.wineLine(w)).toBe("Австрия · рислинг · игристое брют");
    expect(W.reviewRows(w).find((r) => r.key === "place").value).toBe("Австрия");
    expect(R.reverseClues(w)[0]).toBe("Австрия");
    expect(R.describePoints(w).find((p) => p.key === "place").value).toBe("Австрия");
    expect(S.spiritLine(S.normSpirit({ name: "Ром", cat: "rum", country: "Куба", region: "Куба", abv: 40 }, { id: "r" }))).toBe("Куба · ром · 40%");
    // в викторине «Откуда» — без «Австрия, Австрия» среди вариантов
    const list = [w, wn({ name: "Шабли", country: "Франция", region: "Бургундия", color: "white" }, "s"), wn({ name: "Кьянти", country: "Италия", region: "Тоскана", color: "red" }, "k")];
    const qs = R.makeQuiz(list, [], { n: 10, seed: 3 }).filter((q) => q.kind === "place");
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(q.options.join("|")).not.toMatch(/Австрия, Австрия/);
  });
  it("разделы — по названию с числами по порядку: «Вино 2» раньше «Вино 10»", () => {
    expect(W.groupByColor([wn({ name: "Вино 10", color: "red" }, "a"), wn({ name: "Вино 2", color: "red" }, "b")])[0][1].map((x) => x.name)).toEqual(["Вино 2", "Вино 10"]);
    expect(S.groupByCat([S.normSpirit({ name: "Talisker 10", cat: "whisky" }, { id: "a" }), S.normSpirit({ name: "Talisker 8", cat: "whisky" }, { id: "b" })])[0][1].map((x) => x.name)).toEqual(["Talisker 8", "Talisker 10"]);
  });
});

describe("v128: «Подобрать гостю» и проверка (lib/bar-view.js)", () => {
  it("сладость группой: брют — к сухому, экстра сухое — к полусухому, полусладкое, сладкое и десертное", () => {
    expect(["брют", "экстра брют", "сухое", "Extra Dry", "экстра сухое", "полусухое", "полусладкое", "Demi-Sec", "сладкое", "десертное", "", "креплёное"].map((s) => V.sweetOf({ sweet: s })))
      .toEqual(["dry", "dry", "dry", "semidry", "semidry", "semidry", "semisweet", "semisweet", "sweet", "sweet", "", ""]);
    expect(V.SWEET.map(([, t]) => t)).toEqual(["сухое", "полусухое", "полусладкое", "сладкое"]);
  });
  it("бюджет: три ступени по ценам своей карты круглыми числами; мало цен — нет", () => {
    const prices = Array.from({ length: 30 }, (_, i) => 2000 + i * 500);
    expect(V.budgetSteps(prices)).toEqual([7000, 12000]);
    expect(V.budgetLabels([7000, 12000])).toEqual(["до 7" + NB + "000" + NB + "₽", "до 12" + NB + "000" + NB + "₽", "от 12" + NB + "000" + NB + "₽"]);
    expect(V.budgetSteps([380, 400, 450, 550, 650, 750])).toEqual([450, 650]);
    expect(V.budgetSteps([2630, 2780, 13300, 13800, 89900, 95100])).toEqual([13000, 90000]);
    expect(V.budgetSteps([500, 600, 0, ""])).toBe(null);
    expect(V.budgetSteps([1000, 1000, 1000, 1000])).toBe(null);
    expect([[6999, 1], [7000, 1], [7001, 1], [12000, 2], [12001, 3], [0, 1], [5000, 0]].map(([p, b]) => V.inBudget(p, b, [7000, 12000]))).toEqual([true, true, false, true, true, false, true]);
  });
  it("цена для бюджета: у вин — бутылка (в «Бокалом» — бокал), у крепкого — порция", () => {
    const w = { priceBottle: 5200, priceGlass: 950, pricePortion: 650 };
    expect([V.budgetPrice(WINE, w), V.budgetPrice(WINE, w, true), V.budgetPrice(SPIRIT, w), V.budgetPrice(WINE, {})]).toEqual([5200, 950, 650, 0]);
  });
  it("сколько ждёт проверки словами", () => {
    expect([V.checkWord(WINE, 118), V.checkWord(WINE, 1), V.checkWord(WINE, 21), V.checkWord(SPIRIT, 3), V.checkWord(SPIRIT, 11)])
      .toEqual(["118 вин ждут проверки", "1 вино ждёт проверки", "21 вино ждёт проверки", "3 позиции ждут проверки", "11 позиций ждут проверки"]);
  });
});

describe("v128: экраны", () => {
  const T = { screen: {}, modCard: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modArrow: {}, para: {}, doneBtn: {} };
  const CARD = [wn({ name: "Зект / Sekt Brut", country: "Австрия", region: "Австрия", color: "sparkling", sweet: "брют", notes: ["яблоко"], priceBottle: 3900 }, "w1", ["notes"]),
    wn({ name: "Шабли", country: "Франция", region: "Бургундия", color: "white", sweet: "сухое", priceBottle: 5200 }, "w2"),
    wn({ name: "Кьянти", country: "Италия", color: "red", sweet: "сухое", priceBottle: 7400 }, "w3"), wn({ name: "Розе", color: "rose", sweet: "полусладкое", priceBottle: 4100 }, "w4")];
  const render = async (profile) => {
    const { WineListScreen } = await import("../ui/wine-list.jsx");
    return renderToString(React.createElement(WineListScreen, { T, a11y: false, profile, onBack: () => {}, onEdit: () => {}, kind: "wine", team: [CARD, () => {}, true], listTitle: "Барная карта" }));
  };
  it("руководителю — «1 вино ждёт проверки», «Проверить подряд», «Верно для раздела»; в строке — метка AI и название в две строки", async () => {
    const html = await render({ restaurant: "R", position: "manager", name: "Мария", surname: "Ким" });
    expect(html).toContain('data-wine-check-banner="1"');
    expect(html).toContain("1 вино ждёт проверки");
    expect(html).toContain("Команда учит только проверенные: сейчас <!-- -->3 вина<!-- --> из <!-- -->4");
    expect(html).toContain('data-wine-check-go=""');
    expect(html).toContain('data-wine-sec-ok="sparkling"');
    expect(html).toContain(">Верно для раздела: 1<");
    expect(html).toContain('data-wine-ai-tag=""');
    expect(html).not.toContain(">не проверено<");
    expect(html).toContain(">Зект<");
    expect(html).toMatch(/data-wine-orig=""[^>]*>Sekt Brut</);
    expect(html).toContain("Австрия · игристое брют");
    expect(html).toContain('data-wine-pick-open="0"');
  });
  it("сотруднику — без строки проверки и кнопок раздела", async () => {
    const html = await render({ restaurant: "R", position: "waiter", name: "Анна", surname: "С" });
    expect(html).not.toContain("data-wine-check-banner");
    expect(html).not.toContain("data-wine-sec-ok");
    expect(html).toContain('data-wine-ai-tag=""');
  });
  it("«Подобрать гостю», «Верно для раздела» — два касания и сохранение, шапка не уезжает", () => {
    const L = rd("ui/wine-list.jsx");
    for (const s of ["const pinBox = usePin(chipsRef, frameRef, view === \"list\" && !openId && all.length > 0);", "<BarPin box={pinBox}", "onSearch={() => focusSearch(searchRef.current)}",
      'K.kind === "spirit" ? "Бюджет за порцию" : glassOnly ? "Бюджет за бокал" : "Бюджет за бутылку"', '"Нашлось: " + K.word(shown.length)', "Подобрать гостю", "Сбросить",
      'if (secSure !== k) { setSecSure(k); vibrate("light"); return; }', 'rpc("menu_set", { p_token: saToken(), p_restaurant: restaurant, p_dishes: JSON.stringify(next) })',
      '"Проверено: " + K.word(recs.length) + ". Команда уже может их учить."', '"Подтвердить " + un + "? Коснись ещё раз"', 'data-wine-pin-only={pin ? k : undefined}']) expect(L, s).toContain(s);
    const P = rd("ui/bar-pin.jsx");
    for (const s of ['target.addEventListener("scroll", onScroll, { passive: true });', 'position: "fixed", top: 0', "createPortal(", 'el.focus({ preventScroll: true })',
      'r.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" })', "data-bar-pin-up", "data-bar-pin-search"]) expect(P, s).toContain(s);
    expect(P).not.toContain("new IntersectionObserver");   // быстрый взмах наблюдатель пропускает
  });
  it("коктейли: колода и лаборатория — две кнопки рядом, бокал в цвете коктейля; вкладки — и в копии шапки", () => {
    const BC = rd("ui/bar-card.jsx");
    // v129: две кнопки — в общей строке «Учить» (ui/bar-kit.jsx, LearnStrip); своя вкладка из копии сверху — к началу
    for (const s of ['key: "deck"', 'key: "lab"', '"Колода"', '"Лаборатория"', '"выучено " + known + " из " + cocktails.length', "<CocktailArt c={x} w={40} light={a11y} showIce={false} />",
      'const SR_KEY = "sa_cocktail_sr";', "data-bar-pin-tab={pin ? k : undefined}", "const tabs = tabBar(false), pinTabs = tabBar(true);", "if (k === cur) { if (pin) toTop(); return; }"]) expect(BC, s).toContain(s);
    for (const s of ['learnRow("hub"', '"Учить коктейли"', 'view === "learn"']) expect(BC, s).not.toContain(s);   // экрана посредине больше нет
    expect(rd("ui/wine-train.jsx")).toContain("{titleParts(K, w).main}");
    expect(rd("ui/wine-editor.jsx")).toContain("{titleParts(K, w).main}");
  });
  it("демо: три вина «Русское / Original», на «этикетке» — русское; проверка демо — новое", () => {
    const BT = rd("tools/claude/demo-app/boot.js"), C = rd("tools/claude/demo-app/check.mjs");
    for (const s of ['{ name: "Рислинг Кабинетт / Riesling Kabinett",', 'bottlePic({ ...w, name: nameParts(w.name).main })']) expect(BT, s).toContain(s);
    for (const s of ["ждёт проверки", "data-wine-pick-open", "data-bar-pin", '[data-bar-learn="deck"]', "data-bar-ck-card", "data-card-step", "data-search-drink"]) expect(C, s).toContain(s);
  });
  it("README, CHANGES; без тире-ритма и эмодзи в новом коде; метка — v128", () => {
    expect(rd("tools/claude/README.md")).toContain("`e2e-v128.mjs` — v128 (Доп. 441)");
    expect(rd("CHANGES.md")).toContain("# Дополнение 441 — «Барная карта» удобнее, проще, красивее");
    for (const f of ["lib/bar-view.js", "ui/bar-pin.jsx", "ui/bar-card.jsx", "ui/wine-list.jsx", "ui/wine-train.jsx", "ui/wine-editor.jsx", "lib/wine.js", "lib/spirit.js", "lib/bar-card.js", "ui/search.jsx"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(12[8-9]|1[3-9]\d|[2-9]\d\d)<\/span>/);
    expect(B.barLine({ cocktails: 57, wines: 120, spirits: 0 })).toBe("Коктейли 57 · вина 120");
  });
});

describe("v128: проще — без лишних касаний", () => {
  const T = { screen: {}, modCard: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modArrow: {}, para: {}, doneBtn: { marginTop: 24 } };
  it("листать подряд: место в списке на экране, нет там — во всём списке; края — без соседа", async () => {
    const { stepsOf } = await import("../ui/bar-pin.jsx");
    const L = [{ id: "a" }, { id: "b" }, { id: "c" }], A = [{ id: "x" }, ...L];
    expect(stepsOf("b", L, A)).toEqual({ at: 1, n: 3, prev: { id: "a" }, next: { id: "c" } });
    expect(stepsOf("a", L, A)).toMatchObject({ at: 0, prev: null, next: { id: "b" } });
    expect(stepsOf("c", L, A)).toMatchObject({ at: 2, prev: { id: "b" }, next: null });
    expect(stepsOf("x", L, A)).toEqual({ at: 0, n: 4, prev: null, next: { id: "a" } });   // поиск её уже не находит — по всей карте
    expect(stepsOf("z", L, A).at).toBe(-1);
  });
  it("карточка коктейля в «Барной карте»: бокал, состав с граммовкой, как готовить, подача, история, «Учить в колоде», «Собрать руками», соседние", async () => {
    const { BarCardScreen } = await import("../ui/bar-card.jsx");
    const html = renderToString(React.createElement(BarCardScreen, { T, a11y: false, profile: { restaurant: "R", position: "waiter" }, onBack: () => {}, onEdit: () => {},
      startTab: "cocktail", startId: "negroni", onOpenCocktail: () => {}, onBuildCocktail: () => {}, onCocktailDeck: () => {}, onBarLab: () => {} }));
    expect(html).toContain('data-bar-ck-card="negroni"');
    expect(html).toContain('data-bar-ck-art="big"');
    for (const s of [">Состав<", ">Джин<", "30" + NB + "мл", "Как готовить · 7 шагов, как в лаборатории", "Стир 20 секунд", ">Подача<", "Три равные части", "Прошутто, оливки, брускетты",
      ">История<", "Граф Камилло Негрони", "Гостю: «", ">Учить в колоде<", ">Собрать руками<", "‹ предыдущее", "следующее ›", "крепость "]) expect(html, s).toContain(s);
    expect(html).toMatch(/data-card-steps="\d+\/\d+"/);
    expect(html).not.toContain("Гарниш: ");   // у классики гарниш — последним шагом «Как готовить»
    expect(html).not.toContain("data-bar-cocktails=");   // список не рисуется под карточкой
    const list = renderToString(React.createElement(BarCardScreen, { T, a11y: false, profile: { restaurant: "R", position: "waiter" }, onBack: () => {}, onEdit: () => {}, onCocktailDeck: () => {}, onBarLab: () => {} }));
    expect(list).toContain('data-bar-learn-row="deck,lab"');   // v129: строка «Учить»
    expect(list).toContain(">Колода<");
    expect(list).toContain(">Лаборатория<");
    expect(list).toContain(">собрать руками<");
  });
  it("карточка вина: «Сохранено» после редактора, «‹ предыдущее» и «следующее ›» по порядку списка", async () => {
    const { WineListScreen } = await import("../ui/wine-list.jsx");
    const W3 = [wn({ name: "Шабли", color: "white" }, "w1"), wn({ name: "Кьянти", color: "red" }, "w2"), wn({ name: "Бароло", color: "red" }, "w3")];
    const html = renderToString(React.createElement(WineListScreen, { T, a11y: false, profile: { restaurant: "R", position: "waiter" }, onBack: () => {}, onEdit: () => {}, kind: "wine",
      team: [W3, () => {}, true], startId: "w3", note: "Сохранено: в карте у всех" }));
    expect(html).toContain('data-wine-card="w3"');
    expect(html).toContain("Сохранено: в карте у всех");
    expect(html).toContain('data-card-steps="2/3"');   // белые, потом красные: Шабли · Бароло · Кьянти
    expect(html).toMatch(/data-card-step="prev"[^>]*>.*Шабли/);
    expect(html).toMatch(/data-card-step="next"[^>]*>.*Кьянти/);
  });
  it("переходы: крепкое ↔ коктейль внутри карты и «назад» туда, откуда пришёл; после «Править» — снова карточка; из колоды — в карточку", () => {
    const BC = rd("ui/bar-card.jsx"), L = rd("ui/wine-list.jsx"), E = rd("ui/wine-editor.jsx"), APP = rd("App.jsx"), P = rd("ui/bar-pin.jsx");
    for (const s of ["const jump = (k) => (id, from) => openIn(k, id, from ? { tab: cur, id: from, back: start.tab === cur ? start.back : null } : null);",
      "openIn(start.back.tab, start.back.id, start.back.back)", 'onOpenCocktail={cocktails.length ? jump("cocktail") : null}', 'onOpenSpirit={avail.includes("spirit") ? jump("spirit") : null}',
      "const canBuild = !!onBuild && (!c.house || (isFullCocktail(c) && !c.stop));", "buildScenario(c, COCKTAILS).steps", "COCKTAIL_STORIES[c.id]", "onOpenSpirit(x.id, c.id)", "const remember = useInnerTop(c ? \"card:\" + c.id : \"list\", \"list\", k0.scroll);"]) expect(BC, s).toContain(s);
    for (const s of ["onOpenCocktail(c.id, w.id)", "cardBack || (() => setOpenId(null))", "useBackToRow(openId, (id) => '[data-wine-row=\"' + id + '\"]');", "if (menuLoaded && openId && !all.some((x) => x.id === openId)) setOpenId(null);"]) expect(L, s).toContain(s);
    for (const s of ["fromCard.current = r.id;", 'if (!rev && backToCard("Сохранено: в карте у всех")) return;', "if (backToCard()) return; setForm(null); setSeq(null); setSure(false); setAiErr(\"\");"]) expect(E, s).toContain(s);
    for (const s of ['onDone={(id, msg) => { setWineStart(id); setBarTab(wineKind); setBarNote(msg || ""); goBack("wines"); }}', 'onBuildCocktail={(id) => { setBarBack({ tab: "cocktail", id }); setLabStart(id); navigate("barLab"); }}',
      'startId={wineStart || (barBack && barBack.id)}', 'if (!["cocktails", "barLab", "ckEditor"].includes(screen)) setBarBack(null);',
      'onDrink={(kind, id) => { setRefStart(null); setWineStart(id); setBarTab(kind); navigate("wines"); }}', 'onBarItem={(kind, id) => { setRefStart(null); setWineStart(id); setBarTab(kind); navigate("wines"); }}']) expect(APP, s).toContain(s);
    for (const s of ["export function useBackToRow(", "export function PrevNext(", "export const revealEl = "]) expect(P, s).toContain(s);
  });
  it("поиск сверху находит вина и крепкое карты команды; касание — карточка в «Барной карте»", () => {
    const SR = rd("ui/search.jsx");
    for (const s of ["const drink = drinks.flatMap(([K, list]) => K.find(list, q.trim()).map((w) => ({ K, w })))", "data-search-drink={w.id}", "onDrink(K.kind, w.id)", 'K.kind === "wine" ? "Вина" : "Крепкое"',
      "!results.drink.length", "K.records(sh).filter((w) => !w.archived)"]) expect(SR, s).toContain(s);
    expect(rd("ui/ReferenceSection.jsx")).toContain('onCocktail={onBarItem ? (id) => onBarItem("cocktail", id) : undefined} onDrink={onBarItem || undefined}');
  });
});
