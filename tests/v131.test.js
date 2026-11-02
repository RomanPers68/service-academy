// v131 (Доп. 444): «Сомелье» в «Барной карте». Владелец (02.11): «как ты смотришь на то, что бы добавить AI-Сомелье?» —
// на концепт «Да делаем». lib/sommelier.js (что понято из просьбы, кто из карты годится, просьба Наставнику до 2000 знаков,
// разбор ответа только по нашему списку, подбор без Наставника), ui/bar-sommelier.jsx (экран и строка «Сомелье»),
// ui/bar-card.jsx (вход под вкладками, «назад» из карточки — к подбору), демо (tools/claude/demo-app/boot.js: ответ без ИИ);
// e2e — tools/claude/e2e-v131.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToString } from "react-dom/server";
import * as W from "../lib/wine.js";
import * as Sp from "../lib/spirit.js";
import { COCKTAILS } from "../data/cocktails.js";
import * as S from "../lib/sommelier.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const nb = (s) => String(s).replace(/ /g, " ");
const T = { screen: {}, modCard: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modArrow: {}, para: {}, doneBtn: {} };
const strip = (html) => html.replace(/<!-- -->/g, "");

const wines = [
  W.normWine({ id: "w-cha", name: "Шабли / Chablis", producer: "Domaine Laroche", country: "Франция", region: "Бургундия", grapes: ["шардоне"], color: "white", sweet: "сухое", priceBottle: 5200, notes: ["зелёное яблоко", "мел"], short: "Свежее и минеральное.", pair: ["d-oys"] }),
  W.normWine({ id: "w-mac", name: "Макон", country: "Франция", region: "Бургундия", grapes: ["шардоне"], color: "white", sweet: "сухое", byGlass: true, priceGlass: 750, priceBottle: 3900, notes: ["груша"], short: "Мягкое шардоне." }),
  W.normWine({ id: "w-mal", name: "Мальбек Reserva", country: "Аргентина", region: "Мендоса", grapes: ["мальбек"], color: "red", sweet: "сухое", byGlass: true, priceGlass: 690, priceBottle: 4200, notes: ["слива", "фиалка"], short: "Сочный, к мясу.", pair: ["d-rib"] }),
  W.normWine({ id: "w-bdx", name: "Château Haut Bailly", country: "Франция", region: "Бордо", grapes: ["каберне совиньон", "мерло"], color: "red", sweet: "сухое", priceBottle: 14500, notes: ["смородина"], pair: ["d-rib"] }),
  W.normWine({ id: "w-pro", name: "Просекко DOC", country: "Италия", region: "Венето", grapes: ["глера"], color: "sparkling", sweet: "брют", byGlass: true, priceGlass: 590, priceBottle: 3300, notes: ["яблоко"] }),
  W.normWine({ id: "w-tok", name: "Токай Асу", country: "Венгрия", region: "Токай", color: "dessert", sweet: "сладкое", byGlass: true, priceGlass: 900, priceBottle: 7800, notes: ["мёд", "абрикос"] }),
  W.normWine({ id: "w-rio", name: "Риоха Crianza", country: "Испания", region: "Риоха", grapes: ["темпранильо"], color: "red", sweet: "сухое", priceBottle: 4900, stop: { at: 1 } }),
  W.normWine({ id: "w-old", name: "Старое красное", color: "red", sweet: "сухое", priceBottle: 3000, archived: true }),
];
const spirits = [
  Sp.normSpirit({ id: "sp-mac", name: "Macallan 12", cat: "whisky", country: "Шотландия", portion: 40, pricePortion: 1200, priceBottle: 32000, notes: ["херес", "сухофрукты"] }),
  Sp.normSpirit({ id: "sp-hen", name: "Hennessy VSOP", cat: "cognac", country: "Франция", portion: 40, pricePortion: 950, notes: ["ваниль", "дуб"] }),
  Sp.normSpirit({ id: "sp-mon", name: "Amaro Montenegro", cat: "bitter", country: "Италия", portion: 40, pricePortion: 450 }),
];
const cocktails = COCKTAILS.slice(0, 12);
const dishes = [{ id: "d-rib", name: "Стейк рибай", cat: "Горячее", ingredients: ["говядина"] }, { id: "d-oys", name: "Устрицы Фин де Клер", cat: "Холодные закуски" }, { id: "d-tir", name: "Тирамису", cat: "Десерты" }];
const ctx = { dishes, wines, spirits };
const pool = S.somPool({ wines, spirits, cocktails });
const ask = (t) => S.somAsk(t, ctx);
const ids = (r) => r.list.map((c) => c.id);

describe("v131: что понято из просьбы", () => {
  it("бюджет словами: «до 5 000», «до 5к», «до 5 тыс», «не дороже 3000 ₽», «от 5 000», «около 4000»", () => {
    expect(ask("к рибаю, до 5 000").budget).toBe(5000);
    expect(ask("до 5к красное").budget).toBe(5000);
    expect(ask("что-нибудь до 5 тыс").budget).toBe(5000);
    expect(ask("не дороже 3000 ₽").budget).toBe(3000);
    expect(ask("до 1,5 тыс бокалом").budget).toBe(1500);
    expect(ask("от 5 000").budgetMin).toBe(5000);
    expect(ask("около 4000").budget).toBe(4600);
    expect(ask("для 2 гостей").budget).toBe(0);
  });
  it("бокалом, цвет, сладость, вид крепкого, повод; «красное» — вино, «виски» — крепкое, «коктейль» — коктейли", () => {
    const a = ask("к рибаю, сухое красное, бокалом");
    expect([a.glass, a.colors, a.sweet, a.kinds]).toEqual([true, ["red"], "dry", ["wine"]]);
    expect(ask("полусладкое белое").sweet).toBe("semisweet");
    expect(ask("брют").colors).toEqual(["sparkling"]);
    expect(ask("виски до 1500").cats).toEqual(["whisky"]);
    expect(ask("ром").cats).toEqual(["rum"]);
    expect(ask("ароматное").cats).toEqual([]);   // «ром» внутри слова — не ром
    expect(ask("коньяк после ужина")).toMatchObject({ cats: ["cognac"], occasion: "digestif", kinds: ["spirit"] });
    expect(ask("аперитив").occasion).toBe("aperitif");
    expect(ask("к десерту").occasion).toBe("dessert");
    expect(ask("десертное вино")).toMatchObject({ occasion: "", colors: ["dessert"] });
    expect(ask("какой-нибудь коктейль").kinds).toEqual(["cocktail"]);
  });
  it("блюдо из меню: «к рибаю» — «Стейк рибай»; «похоже на…»: своё вино из карты и известный стиль", () => {
    expect(ask("к рибаю").dishes.map((d) => d.id)).toEqual(["d-rib"]);
    expect(ask("что-нибудь к устрицам").dishes.map((d) => d.id)).toEqual(["d-oys"]);
    expect(ask("к пицце").dishes).toEqual([]);
    const a = ask("что-то как Шабли, но бокалом");
    expect([a.like, a.likeRef && a.likeRef.rec.id, !!a.likeStyle, a.glass, a.kinds]).toEqual(["шабли", "w-cha", true, true, ["wine"]]);
    const b = ask("похоже на Пино нуар");
    expect([b.like, b.likeRef, b.likeStyle && b.likeStyle.color]).toEqual(["пино нуар", null, "red"]);
    expect(ask("как аперитив").like).toBe("");
  });
});

describe("v131: кто из карты годится", () => {
  it("стоп и архив не предлагаются; у позиции цена для бюджета: бутылка, бокал (если бокалом), порция", () => {
    expect(pool.some((c) => c.id === "w-rio" || c.id === "w-old")).toBe(false);
    const mal = pool.find((c) => c.id === "w-mal"), mon = pool.find((c) => c.id === "sp-mon");
    expect([S.somPrice(mal), S.somPrice(mal, true), S.somPrice(mon)]).toEqual([4200, 690, 450]);
    expect(nb(mal.priceText)).toBe("бокал 690 ₽ · бутылка 4 200 ₽");
  });
  it("«к рибаю, сухое красное, до 5 000»: в бюджете и к блюду — первым, с «почему»; дороже бюджета — нет", () => {
    const r = S.somShortlist(pool, ask("к рибаю, сухое красное, до 5 000"));
    expect(ids(r)).toEqual(["w-mal"]);
    expect(r.list[0].why[0]).toBe("в нашей карте к «Стейк рибай»");
    expect(ids(S.somShortlist(pool, ask("к рибаю, сухое красное")))).toEqual(["w-mal", "w-bdx"]);
  });
  it("«как Шабли, но бокалом»: только бокалом, шардоне — первым («тоже шардоне», цена бокала)", () => {
    const r = S.somShortlist(pool, ask("что-то как Шабли, но бокалом"));
    expect(r.list.every((c) => c.kind === "wine" && c.byGlass)).toBe(true);
    expect(r.list[0].id).toBe("w-mac");
    expect(nb(r.list[0].why.join("; "))).toBe("тоже шардоне; бокал 750 ₽");
  });
  it("вид: выбран — он; «Всё» — что названо в просьбе, а нет — вся карта; повод поднимает своё", () => {
    expect(S.kindsFor("spirit", ask("красное"))).toEqual(["spirit"]);
    expect(S.kindsFor("all", ask("виски"))).toEqual(["spirit"]);
    expect(S.kindsFor("all", ask("к рибаю"))).toEqual(["wine", "spirit", "cocktail"]);
    expect(S.somShortlist(pool, ask("к десерту")).list[0].id).toBe("w-tok");
    expect(S.somShortlist(pool, ask("коньяк после ужина")).list.map((c) => c.id)).toEqual(["sp-hen"]);
    const ap = S.somShortlist(pool, ask("аперитив"), { what: "wine" });
    expect(ap.list[0].id).toBe("w-pro");
  });
  it("«Ещё варианты» — без показанных; «Подешевле» — дешевле самой доступной из показанных", () => {
    const a = ask("сухое красное");
    expect(ids(S.somShortlist(pool, a, { exclude: ["wine:w-mal"] }))).toEqual(["w-bdx"]);
    const shown = S.somShortlist(pool, a).list.filter((c) => c.id === "w-bdx");
    expect(S.cheaperThan(shown)).toBe(14500);
    expect(ids(S.somShortlist(pool, a, { below: S.cheaperThan(shown) }))).toEqual(["w-mal"]);
  });
  it("пусто — сказано почему: бюджет (и что ближе всего), всё показано, дешевле нет, бокалом нет, нет такого крепкого", () => {
    expect(nb(S.somShortlist(pool, ask("красное до 2 000")).none)).toBe("В бюджет до 2 000 ₽ под эту просьбу ничего нет: ближе всего «Мальбек Reserva», 4 200 ₽.");
    expect(S.somShortlist(pool, ask("сухое красное"), { exclude: ["wine:w-mal", "wine:w-bdx"] }).none).toBe("Больше под эту просьбу в карте ничего нет: всё подходящее уже показано.");
    expect(S.somShortlist(pool, ask("сухое красное"), { below: 4200 }).none).toBe("Дешевле под эту просьбу в карте ничего нет: показанные и так самые доступные.");
    expect(S.somShortlist(S.somPool({ wines: [wines[0]] }), ask("бокалом")).none).toBe("Бокалом в нашей карте вин сейчас нет.");
    expect(S.somShortlist(pool, ask("ром")).none).toBe("Такого крепкого в нашей карте сейчас нет.");
    expect(S.somShortlist(pool, ask("розовое")).none).toBe("Такого цвета под эту просьбу в карте нет. Убери цвет из просьбы, и подберу из остального.");
  });
});

describe("v131: Наставнику и обратно", () => {
  const dishName = (id) => (dishes.find((d) => d.id === id) || {}).name || "";
  it("просьба Наставнику — одно сообщение до 2000 знаков: просьба, блюдо из меню, наш список под номерами, строгий формат", () => {
    const a = ask("к рибаю, сухое красное");
    const p = S.somPrompt(a, S.somShortlist(pool, a).list, { restaurant: "Два моря", dishName });
    const L = nb(p).split("\n");
    expect(L[0]).toBe("Сомелье: подбери гостю из «Барной карты» ресторана «Два моря».");
    expect(L[1]).toBe("Просьба гостя: «к рибаю, сухое красное»");
    expect(L[2]).toBe("Блюдо из нашего меню: Стейк рибай, Горячее, говядина");
    expect(L[3]).toBe("Ниже всё, что под неё есть в нашей карте (не в стопе). Бери только отсюда, других вин и марок не называй, цены не меняй.");
    expect(L[4]).toBe("1. Вино · Мальбек Reserva · Аргентина, Мендоса · мальбек · красное сухое · бокал 690 ₽ · бутылка 4 200 ₽ · ноты: слива, фиалка · к блюдам: Стейк рибай");
    expect(L[5]).toMatch(/^2\. Вино · Château Haut Bailly · Франция, Бордо/);
    expect(L[6]).toBe("Выбери одну или обе. Ответ строго так, по строке на позицию, без вступления, заголовков и кнопок:");
    expect(L[7]).toBe("[[pick:номер]] Почему: одно короткое предложение. Гостю: «фраза, которую официант скажет гостю»");
    expect(S.promptCount(p)).toBe(2);
    // длинная карта: в 2000 знаков влезает столько, сколько влезает, номера подряд
    const many = Array.from({ length: 40 }, (_, i) => W.normWine({ id: "x" + i, name: "Вино номер " + i + " с длинным названием от производителя", country: "Франция", region: "Долина Луары, Турень", grapes: ["совиньон блан", "шенен блан"], color: "white", sweet: "сухое", priceBottle: 3000 + i, notes: ["крыжовник", "лайм", "мокрый камень"] }));
    const sl = S.somShortlist(S.somPool({ wines: many }), ask("белое"), { limit: 40 });
    const p2 = S.somPrompt(ask("белое"), sl.list);
    expect(p2.length).toBeLessThanOrEqual(2000);
    expect(S.promptCount(p2)).toBeGreaterThan(5);
    expect(p2).toMatch(/Выбери 2 или 3 лучших\./);
  });
  it("ответ: [[pick:N]] — позиция из списка с «почему» и фразой гостю; чужой номер и повтор — мимо; не больше трёх", () => {
    const list = S.somShortlist(pool, ask("сухое красное")).list;
    const r = S.parseSom("Вот:\n[[pick:2]] Почему: классика Бордо к стейку. Гостю: «Для особого вечера советую Бордо»\n[[pick:1]] **Почему:** сочный мальбек. Гостю: \"К рибаю отлично\"\n[[pick:1]] ещё раз\n[[pick:7]] чужое\n[[go:wines|Открыть барную карту]]", list);
    expect(r.picks.map((p) => [p.id, p.why, p.say])).toEqual([["w-bdx", "классика Бордо к стейку.", "Для особого вечера советую Бордо"], ["w-mal", "сочный мальбек.", "К рибаю отлично"]]);
    expect(r.note).toBe("");
  });
  it("без разметки: [[wine:ID]], строки «1. …» или название из списка; ничего не выбрал — его слова в note", () => {
    const list = S.somShortlist(pool, ask("сухое красное")).list;
    expect(S.parseSom("[[wine:w-mal]] Сочный. Гостю: «Попробуйте»", list).picks.map((p) => p.id)).toEqual(["w-mal"]);
    expect(S.parseSom("[[wine:w-zzz]] Чужое вино", list).picks).toEqual([]);
    expect(S.parseSom("1. Мальбек Reserva: к мясу. Гостю: «Попробуйте Мальбек»", list).picks.map((p) => [p.id, p.why, p.say])).toEqual([["w-mal", "к мясу.", "Попробуйте Мальбек"]]);
    expect(S.parseSom("Советую Château Haut Bailly, он к стейку.", list).picks.map((p) => p.id)).toEqual(["w-bdx"]);
    expect(S.parseSom("Из списка к этому ничего не подходит: нет креплёных.", list)).toEqual({ picks: [], note: "Из списка к этому ничего не подходит: нет креплёных." });
  });
  it("без Наставника: лучшие по совпадению, «почему» — что совпало, фраза гостю — из карточки", () => {
    const lp = S.localPicks(S.somShortlist(pool, ask("к рибаю, сухое красное")).list);
    expect(lp.map((p) => [p.id, p.why, p.say, p.local])).toEqual([["w-mal", "В нашей карте к «Стейк рибай».", "Сочный, к мясу.", true], ["w-bdx", "В нашей карте к «Стейк рибай».", "", true]]);
  });
});

describe("v131: быстрые просьбы и экран", () => {
  it("фраза в поле: поставить, заменить, снять; подсветка — что уже стоит", () => {
    let t = S.somToggle("", "glass", "бокалом");
    expect(t).toBe("бокалом");
    t = S.somToggle(t, "budget", "до 5 000 ₽"); expect(nb(t)).toBe("бокалом, до 5 000 ₽");
    t = S.somToggle(t, "budget", "до 2 500 ₽"); expect(nb(t)).toBe("бокалом, до 2 500 ₽");
    t = S.somToggle(t, "dish", "к «Стейк рибай»"); expect(nb(t)).toBe("бокалом, до 2 500 ₽, к «Стейк рибай»");
    t = S.somToggle(t, "glass", "бокалом"); expect(nb(t)).toBe("до 2 500 ₽, к «Стейк рибай»");
    expect(S.somOn(t)).toEqual({ glass: false, budget: true, dish: true, like: false, occasion: false });
    expect(S.somToggle("к десерту, сухое", "occasion", "аперитив")).toBe("сухое, аперитив");
    expect(S.somToggle("похоже на Шабли, бокалом", "like", "похоже на Шабли")).toBe("бокалом");
  });
  it("«К блюду» — сначала блюда с парой в карте; «Похоже на…» — что узнаётся в нашей карте; бюджет — по ценам того, что подбираем", () => {
    expect(S.dishOptions(dishes, pool).map((d) => d.id)).toEqual(["d-rib", "d-oys", "d-tir"]);
    expect(S.likeOptions(pool)).toEqual(["Шабли", "Просекко", "Мальбек"]);
    expect(S.somBudgetSteps(pool, "wine", false)).toEqual([4000, 8000]);
    expect(nb(S.budgetPhrase(0, [4000, 8000]))).toBe("до 4 000 ₽");
    expect(nb(S.budgetPhrase(2, [4000, 8000]))).toBe("от 8 000 ₽");
  });
  it("экран «Сомелье»: шапка, что подобрать, поле с примером, быстрые просьбы, «Подобрать»; строка входа", async () => {
    const { BarSommelier, SomEntry } = await import("../ui/bar-sommelier.jsx");
    const html = strip(renderToString(React.createElement(BarSommelier, { T, a11y: false, restaurant: "Два моря", cocktails, wines: wines.filter((w) => !w.archived), spirits, start: "wine", onBack: () => {}, onOpen: () => {} })));
    expect(html).toContain('data-som="wine"');
    expect(html).toContain(">Барная карта · Наставник<");
    expect(html).toContain(">Сомелье<");
    expect(html).toContain('data-som-whats="all,wine,spirit,cocktail"');
    expect(nb(html)).toContain('placeholder="Например: к рибаю, сухое красное, до 5 000"');
    expect([...html.matchAll(/data-som-chip="([^"]+)"/g)].map((m) => m[1]).join(",")).toBe("glass,budget,like,occ-aperitif,occ-dessert,occ-digestif");
    expect(html).toContain('data-som-go=""');
    const keep = { text: "к рибаю", what: "wine", seen: ["wine:w-mal"], res: { how: "new", text: "к рибаю", what: "wine", total: 2, mode: "ai", remaining: 17,
      picks: [{ ...pool.find((c) => c.id === "w-mal"), why: "Сочный мальбек к стейку.", say: "К рибаю советую Мальбек" }] } };
    const h2 = strip(renderToString(React.createElement(BarSommelier, { T, a11y: true, restaurant: "", cocktails: [], wines, spirits: [], keep, onBack: () => {}, onOpen: () => {}, onShareChat: () => {} })));
    expect(h2).toContain('data-som-res="ai"');
    expect(h2).toContain('data-som-pick="wine:w-mal"');
    expect(h2).toContain("Гостю: «К рибаю советую Мальбек»");
    expect(h2).toContain('data-share-chat="wine:w-mal"');
    expect(h2).toContain('data-som-left="17"');
    expect(h2).toContain("У Наставника сегодня осталось 17 вопросов: подбор считается как вопрос.");
    const e = strip(renderToString(React.createElement(SomEntry, { T, a11y: false, onClick: () => {} })));
    expect(e).toContain('data-bar-som-open=""');
    expect(e).toContain(">Подберу гостю из нашей карты<");
  });
  it("«Барная карта»: строка «Сомелье» под вкладками; карточка из подбора — «Из подбора Сомелье», «назад» — к подбору", () => {
    const B = rd("ui/bar-card.jsx");
    // строка — отдельно от вкладок: у сотрудника с одними коктейлями вкладок нет, а «Сомелье» есть (и подсказка первого входа
    // не показывает шаг про вкладки)
    expect((B.match(/tabs=\{tabs\} pinTabs=\{pinTabs\} som=\{somRow\}/g) || []).length).toBe(2);
    expect(B).toContain("      {tabs}\n      {som}\n");
    expect(rd("ui/wine-list.jsx")).toContain("      {tabs}\n      {som}\n");
    expect(B).toContain("onOpen={(k, id) => { setSom(false); openIn(k, id, { som: true }); }}");
    expect(B).toContain("if (start.back.som) { setStart({ tab: null, id: null, back: null }); setSom(true); return; }");
    expect(B).toContain('if (b.som) return "Из подбора Сомелье";');
    expect(rd("ui/bar-sommelier.jsx")).toContain('body: JSON.stringify({ token: saToken(), mode: "sommelier", messages: [{ role: "user", content: prompt }] })');
  });
  it("демо: ответ Сомелье без ИИ в том же формате; гид «Сомелье»; без тире-ритма и эмодзи в новом коде; метка — v131", () => {
    const D = rd("tools/claude/demo-app/boot.js");
    expect(D).toContain('if (b.mode === "sommelier") return wait(1100).then(() => json({ ok: true, reply: demoSom(b), model: "demo", remaining: 17 }));');
    expect(D).toContain('return "[[pick:" + n + "]] Почему: "');
    expect(rd("ui/guide.jsx")).toContain('{ key: "sommelier", title: "Сомелье"');
    expect(rd("tools/claude/README.md")).toContain("`e2e-v131.mjs` — v131 (Доп. 444)");
    expect(rd("CHANGES.md")).toContain("# Дополнение 444 — «Сомелье» в «Барной карте» (v131)");
    for (const x of ["m42-som", "m43-som-res", "m44-som-card", "data-bar-som-open", "data-som-res"]) expect(rd("tools/claude/demo-app/check.mjs"), x).toContain(x);
    for (const f of ["ui/bar-sommelier.jsx", "lib/sommelier.js", "ui/bar-card.jsx"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(code(rd("ui/bar-sommelier.jsx"))).not.toMatch(/[А-Яа-яЁё]!/);
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(13[1-9]|1[4-9]\d|[2-9]\d\d)<\/span>/);
  });
});
