// v127 (Доп. 440): «Барная карта» — коктейли, вина и крепкое под одной кнопкой; крепкое — всё, как у вин. Владелец (01.11):
// «может добавим и редактор по крепкому алкоголю?», «Общая карта, вина и крепкое… порций… на выбор, или же ручной ввод.
// Делаем сразу все, как у вин» и «Да, делаем». lib/spirit.js (запись крепкого), lib/drinks.js (один движок: вид напитка K),
// lib/spirit-cocktails.js (в каких коктейлях работает позиция), lib/bar-card.js (коктейли нашего бара, подпись карточки),
// lib/wine-train.js (тренировка по виду K), ui/bar-card.jsx, ui/wine-list.jsx, ui/wine-editor.jsx, ui/wine-train.jsx,
// api/wine-import.js (kind: "spirit"), этап 45 (supabase/supabase-stage45-spirits.sql). e2e — tools/claude/e2e-v127.mjs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import React from "react";
import { renderToString } from "react-dom/server";
import * as S from "../lib/spirit.js";
import * as SC from "../lib/spirit-cocktails.js";
import * as W from "../lib/wine.js";
import * as R from "../lib/wine-train.js";
import * as B from "../lib/bar-card.js";
import { WINE, SPIRIT, drinkOf, isBarRec } from "../lib/drinks.js";
import { COCKTAILS } from "../data/cocktails.js";
import { PRONOUNCE } from "../data/pronounce.js";
import { STAGES } from "../lib/server-check.js";
import { menuDishes } from "../lib/menu-dishes.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const NB = " ", NOW = Date.now(), DAY = 864e5;
const sp = (o, id, opt = {}) => S.normSpirit({ ...o }, { id, ...opt });
const CARD = [
  sp({ name: "Glenfiddich 12", cat: "whisky", style: "односолодовый", country: "Шотландия", region: "Спейсайд", age: "12 лет", abv: 40, portion: 40, pricePortion: 650, priceBottle: 9800,
    serve: ["чистым", "с каплей воды"], glass: "гленкерн", hot: true, notes: ["груша", "мёд"], short: "Мягкий, с грушей и мёдом.", pair: ["d-krab"] }, "sp-gle"),
  sp({ name: "Maker's Mark", cat: "whisky", style: "бурбон", country: "США", region: "Кентукки", abv: 45, portion: 40, pricePortion: 550, serve: ["со льдом", "в коктейле"], hot: true,
    short: "Карамель и ваниль.", addedAt: NOW - 2 * DAY }, "sp-mak"),
  sp({ name: "Hennessy", cat: "cognac", style: "VS", age: "VS", country: "Франция", region: "Коньяк", abv: 40, serve: ["чистым"], glass: "тюльпан", short: "Ваниль и дуб.", pair: ["d-des"] }, "sp-hen"),
  sp({ name: "Havana Club 7", cat: "rum", style: "выдержанный", country: "Куба", age: "7 лет", abv: 40, serve: ["чистым", "со льдом"], short: "Какао и табак.", addedAt: NOW - 3 * DAY }, "sp-hav"),
  sp({ name: "Beefeater", cat: "gin", style: "London Dry", country: "Великобритания", abv: 40, serve: ["в коктейле"], glass: "хайбол", hot: true, stop: { since: NOW }, pair: ["d-tem"] }, "sp-bee"),
  sp({ name: "Olmeca Blanco", cat: "agave", style: "бланко", country: "Мексика", abv: 38, notes: ["агава"] }, "sp-olm", { ai: ["notes"] }),
];
const DISHES = [{ id: "d-krab", name: "Крабовая котлета" }, { id: "d-des", name: "Шоколадный фондан" }, { id: "d-tem", name: "Креветка темпура" }, { id: "d-x", name: "Суп" }];

describe("v127: запись крепкого (lib/spirit.js)", () => {
  it("normSpirit: только свои поля, вид словом, порция — целое до 500 мл, подача до четырёх, id «sp-», AI — только у заполненного", () => {
    const w = S.normSpirit({ name: "  Glenfiddich   12 ", cat: "Виски", portion: "40,4", abv: "40%", pricePortion: "650 ₽", priceBottle: "9 800", hot: 1, x: 1,
      serve: "чистым, со льдом, с каплей воды, охлаждённым, в коктейле", notes: "груша, мёд", ai: ["notes", "style", "x"] });
    expect(w.id).toMatch(/^sp-/);
    expect(w).toMatchObject({ kind: "spirit", name: "Glenfiddich 12", cat: "whisky", portion: 40, abv: 40, pricePortion: 650, priceBottle: 9800, hot: true, notes: ["груша", "мёд"], ai: ["notes"] });
    expect(w.serve).toEqual(["чистым", "со льдом", "с каплей воды", "охлаждённым"]);
    expect(w).not.toHaveProperty("x");
    expect(S.normSpirit({ name: "x", portion: 700 }).portion).toBe("");
    expect(S.normSpirit({ name: "x", portion: "своя" }).portion).toBe("");
    expect(S.normSpirit({ name: "x", img: "javascript:alert(1)" }).img).toBe("");
    expect(["Tequila Reposado", "джин", "джинджер", "ром", "ромовый ликёр", "Calvados", "whisky", "Коньяк и бренди", "?"].map(S.catOf))
      .toEqual(["agave", "gin", "", "rum", "liqueur", "other", "whisky", "cognac", ""]);
  });
  it("название с выдержкой (без повтора), строка карточки, цена порции и бутылки, подача словами", () => {
    expect(S.spiritTitle({ name: "Glenfiddich", age: "12 лет" })).toBe("Glenfiddich 12 лет");
    expect(S.spiritTitle({ name: "Glenfiddich 12", age: "12 лет" })).toBe("Glenfiddich 12");
    expect(S.spiritTitle({ name: "Hennessy", age: "XO" })).toBe("Hennessy XO");
    expect(S.spiritLine(CARD[0])).toBe("Шотландия, Спейсайд · виски, односолодовый · 40%");
    expect(S.spiritLine(sp({ name: "H", cat: "gin", abv: 41.4 }, "h"))).toBe("джин · 41,4%");
    expect(S.spiritPrice(CARD[0])).toBe("40" + NB + "мл 650" + NB + "₽ · бутылка 9" + NB + "800" + NB + "₽");   // неразрывные, как у вин
    expect(S.spiritPrice({ pricePortion: 650 })).toBe("порция 650" + NB + "₽");
    expect(S.spiritPrice({ priceBottle: 3900 })).toBe("бутылка 3" + NB + "900" + NB + "₽");
    expect(S.spiritServe(CARD[0])).toBe("чистым, с каплей воды · бокал «гленкерн»");
  });
  it("разделы по виду (порядок карты), поиск, «то же в карте» с учётом выдержки", () => {
    expect(S.groupByCat(CARD).map(([k, ws]) => k + ":" + ws.length).join()).toBe("whisky:2,cognac:1,rum:1,gin:1,agave:1");
    expect(S.groupByCat([sp({ name: "Граппа" }, "g")])[0][0]).toBe("other");
    expect(S.findSpirits(CARD, "куба 7").map((w) => w.id)).toEqual(["sp-hav"]);
    expect(S.findSpirits(CARD, "виски").map((w) => w.id)).toEqual(["sp-gle", "sp-mak"]);
    expect(S.sameSpirit({ name: "Hennessy", age: "VS" }, { name: "hennessy", age: "VS" })).toBe(true);
    expect(S.sameSpirit({ name: "Hennessy", age: "VS" }, { name: "Hennessy", age: "XO" })).toBe(false);
    expect(S.sameSpirit({ name: "Glenfiddich 12" }, { name: "Glenfiddich", age: "12 лет" })).toBe(true);
  });
  it("проверка: строки карточки с пометкой AI; «Что дописать»; подсказки формы по виду", () => {
    const rows = S.reviewRowsSp(CARD[5]);
    expect(rows.map((r) => r.key + (r.ai ? "*" : ""))).toEqual(["place", "kind", "abv", "notes*"]);
    expect(SPIRIT.gapCounts(CARD)).toEqual({ nophoto: 6, noprice: 4, noshort: 2, noserve: 1 });
    expect(SPIRIT.partFill(CARD[0], "serve")).toEqual({ n: 5, of: 7 });
    expect(S.fieldHintsSp([], "country", { cat: "agave" })[0]).toBe("Мексика");
    expect(S.fieldHintsSp(CARD, "region", { country: "Шотландия" }).slice(0, 2)).toEqual(["Спейсайд", "Айла"]);
    expect(S.fieldHintsSp(CARD, "style", { cat: "whisky" }).slice(0, 3)).toEqual(["односолодовый", "бурбон", "купажированный"]);
  });
});

describe("v127: один движок для вин и крепкого (lib/drinks.js)", () => {
  it("вид по ключу; у вин — те же функции lib/wine.js; ключи телефона и этапы базы у каждого свои", () => {
    expect(drinkOf("spirit")).toBe(SPIRIT);
    expect(drinkOf("wine")).toBe(WINE);
    expect(drinkOf("x")).toBe(WINE);
    expect([WINE.norm, WINE.title, WINE.groups, WINE.mergeAi, WINE.bottlePlan]).toEqual([W.normWine, W.wineTitle, W.groupByColor, W.mergeAi, W.bottlePlan]);
    expect([SPIRIT.norm, SPIRIT.title, SPIRIT.groups]).toEqual([S.normSpirit, S.spiritTitle, S.groupByCat]);
    expect(Object.values(SPIRIT.keys).some((k) => Object.values(WINE.keys).includes(k))).toBe(false);
    expect(SPIRIT.keys).toEqual({ learned: "sa_spirit_learned_", sr: "sa_spirit_sr_", sync: "sa_spirit_sync_" });
    expect(SPIRIT.rpc).toEqual({ set: "spirit_progress_set", team: "spirit_progress_team", stage: "45", sql: "supabase/supabase-stage45-spirits.sql" });
    expect(existsSync(SPIRIT.rpc.sql)).toBe(true);
    expect([1, 3, 5, 11, 21].map(SPIRIT.word)).toEqual(["1 позиция", "3 позиции", "5 позиций", "11 позиций", "21 позиция"]);
    expect(WINE.word(5)).toBe("5 вин");
    expect(SPIRIT.pathTest(CARD[0]) && !SPIRIT.pathTest(CARD[2])).toBe(true);
  });
  it("AI дописывает только пустое и помечает; правка руками снимает пометку; «Верно» — всё", () => {
    const got = SPIRIT.mergeAi(sp({ name: "Talisker 10", country: "Шотландия" }, "t"), { name: "другое", country: "Ирландия", region: "Острова", cat: "Виски", abv: "45,8", notes: ["дым"] });
    expect(got).toMatchObject({ name: "Talisker 10", country: "Шотландия", region: "Острова", cat: "whisky", abv: 45.8, notes: ["дым"] });
    expect(got.ai.sort()).toEqual(["abv", "cat", "notes", "region"]);
    expect(SPIRIT.touched(got, "region").ai).not.toContain("region");
    const ok = SPIRIT.confirm(got, "Мария Ким");
    expect([ok.ai, ok.checkedBy, ok.checkedAt > 0]).toEqual([[], "Мария Ким", true]);
  });
  it("фото бутылок: нет в карте — новая позиция с фото; есть без фото — фото и пустые поля к ней; есть с фото — заменить, если отметят", () => {
    const live = [sp({ name: "Hennessy", age: "VS", img: "https://x.supabase.co/a.jpg" }, "sp-h"), sp({ name: "Белуга Нобл" }, "sp-b")];
    expect(SPIRIT.bottlePlan({ name: "Hennessy", age: "VS" }, live)).toEqual({ kind: "replace", keep: false, to: "sp-h" });
    expect(SPIRIT.bottlePlan({ name: "белуга нобл" }, live)).toEqual({ kind: "attach", keep: true, to: "sp-b" });
    expect(SPIRIT.bottlePlan({ name: "Hennessy", age: "XO" }, live).kind).toBe("new");
    const out = SPIRIT.applyBottles(live, [{ w: { name: "Белуга Нобл", country: "Россия", abv: 40 }, plan: { to: "sp-b" }, url: "https://x.supabase.co/b.jpg" },
      { w: sp({ name: "Talisker 10" }, "sp-t"), plan: { to: "" }, url: "https://x.supabase.co/t.jpg" }]);
    const b = out.find((x) => x.id === "sp-b"), t = out.find((x) => x.id === "sp-t");
    expect(b).toMatchObject({ img: "https://x.supabase.co/b.jpg", country: "Россия", abv: 40 });
    expect(b.ai.sort()).toEqual(["abv", "country"]);
    expect(t.img && t.addedAt > 0 && t.kind === "spirit").toBe(true);
  });
  it("«Проверка подряд» — по разделам карты; записи бара (коктейли, вина, крепкое) — не блюда", () => {
    const q = SPIRIT.uncheckedQueue([sp({ name: "Б", cat: "gin", notes: ["x"] }, "b", { ai: ["notes"] }), sp({ name: "А", cat: "whisky", notes: ["x"] }, "a", { ai: ["notes"] }), CARD[0]]);
    expect(q).toEqual(["a", "b"]);
    expect([{ kind: "spirit" }, { kind: "wine" }, { kind: "cocktail" }, { kind: "dish" }, null].map(isBarRec)).toEqual([true, true, true, false, false]);
    expect(menuDishes({ restaurant: "R", shared: [{ id: "d1", name: "Суп" }, { id: "s1", kind: "spirit", name: "Hennessy" }, { id: "w1", kind: "wine", name: "Шабли" }] }).map((d) => d.id)).toEqual(["d1"]);
  });
  it("слова на экране: у вин — прежние, у крепкого — свои; без тире-ритма, эмодзи и восклицаний", () => {
    expect([WINE.t.tab, WINE.t.deck, WINE.t.learned, WINE.t.team, WINE.t.pair]).toEqual(["Вина", "Колода вин", "Выучил новые вина ✓", "Кто выучил новые вина", "Вино к блюду"]);
    expect([SPIRIT.t.tab, SPIRIT.t.deck, SPIRIT.t.learned, SPIRIT.t.team, SPIRIT.t.pair, SPIRIT.t.pathChip]).toEqual(["Крепкое", "Колода крепкого", "Выучил новинки ✓", "Кто выучил новинки крепкого", "Крепкое к блюду", "Ходовое"]);
    expect(Object.keys(SPIRIT.t).sort()).toEqual(Object.keys(WINE.t).sort());
    const all = Object.values(SPIRIT.t).map((v) => (typeof v === "function" ? String(v(2, 5)) : v)).join("\n");
    expect(all).not.toMatch(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/);
    expect(all).not.toMatch(/[\u{1F300}-\u{1FAFF}]|!/u);
  });
});

describe("v127: тренировка по крепкому (lib/wine-train.js с видом K)", () => {
  const SR = { "sp-gle": { stage: 1, due: NOW + 2 * DAY }, "sp-hen": { stage: 2, due: NOW + 3 * DAY } };
  it("путь новичка — «ходовое» (без «сегодня нет» и не проверенного); счёт «Знаю?» для сервера", () => {
    const p = R.pathFor(SPIRIT, CARD, SR);
    expect(p.list.map((w) => w.id)).toEqual(["sp-gle", "sp-mak"]);
    expect([p.known, p.total]).toEqual([1, 2]);
    expect(R.statsFor(SPIRIT, CARD, SR)).toEqual({ known: 2, total: 5, glassKnown: 1, glassTotal: 2 });
    expect(R.newWines(CARD).map((w) => w.id).sort()).toEqual(["sp-hav", "sp-mak"]);
  });
  it("«Наоборот»: подсказки без названия — откуда, что это, выдержка и крепость, ноты", () => {
    expect(R.cluesFor(SPIRIT, CARD[0])).toEqual(["Шотландия, Спейсайд", "виски, односолодовый", "выдержка 12 лет · 40%", "груша, мёд"]);
    expect(R.reversibleFor(SPIRIT, sp({ name: "X", cat: "gin" }, "x"))).toBe(false);
    expect(R.cluesFor(WINE, W.normWine({ name: "Шабли", country: "Франция", grapes: ["шардоне"] }))).toEqual(["Франция", "шардоне"]);
  });
  it("викторина: вопросы по виду (что это, откуда, выдержка, подача, фраза, блюдо, крепость); верный ответ — из карточки", () => {
    const qs = R.quizFor(SPIRIT, CARD, DISHES, { n: 20, seed: 7 });
    expect(qs.length).toBeGreaterThanOrEqual(6);
    const kinds = new Set(qs.map((q) => q.kind));
    for (const k of kinds) expect(["kind", "place", "age", "serve", "phrase", "dish", "abv"]).toContain(k);
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    for (const q of qs) {
      const w = CARD.find((x) => x.id === q.wine), right = q.options[q.answer];
      expect(w && !w.ai.length).toBe(true);
      if (q.kind === "place") expect(right).toBe([w.country, w.region].filter(Boolean).join(", "));
      if (q.kind === "kind") expect(right).toBe(S.spiritKind(w));
      if (q.kind === "serve") expect(right).toBe(w.serve.join(", "));
      if (q.kind === "phrase") expect(right).toBe(S.spiritTitle(w));
      expect(new Set(q.options).size).toBe(q.options.length);
    }
    // выдержка в названии — вопрос о ней ничего не проверяет
    expect(qs.some((q) => q.kind === "age" && (q.wine === "sp-gle" || q.wine === "sp-hav"))).toBe(false);
    // у вин — прежняя викторина
    expect(R.makeQuiz([W.normWine({ name: "А", country: "Франция", color: "red" }, { id: "a" }), W.normWine({ name: "Б", country: "Италия", color: "white" }, { id: "b" })], [], { seed: 1 })
      .every((q) => ["place", "grape", "style", "phrase", "dish", "glass"].includes(q.kind))).toBe(true);
  });
  it("«Крепкое к блюду»: блюдо и что к нему из карты; «Опиши за 60 секунд» — пункты крепкого", () => {
    const pq = R.pairQuizFor(SPIRIT, CARD, DISHES, { seed: 3 });
    expect(pq.map((q) => q.id).sort()).toEqual(["d-des", "d-krab", "d-tem"]);   // «сегодня нет» в парах остаётся: завтра его снова предложат
    for (const q of pq) {
      expect(q.q).toBe(`Гость заказал «${q.dish}». Что предложить из крепкого?`);
      expect(q.why).toMatch(/^К нему в карте: /);
    }
    expect(R.describeFor(SPIRIT, CARD[0], DISHES).map((p) => p.key)).toEqual(["place", "kind", "age", "notes", "serve", "pair", "short"]);
    expect(R.describeFor(SPIRIT, CARD[0], DISHES).find((p) => p.key === "pair").value).toBe("Крабовая котлета");
  });
});

describe("v127: в каких коктейлях нашего бара работает позиция (lib/spirit-cocktails.js)", () => {
  const names = (w) => SC.spiritCocktails(S.normSpirit({ ...w, id: "x" }), COCKTAILS).map((c) => c.name);
  it("основа с уточнением: односолодовый — не в коктейле на бурбоне, бурбон — не в «Манхэттене» на ржаном", () => {
    expect(names({ name: "Glenfiddich 12", cat: "whisky", style: "односолодовый", country: "Шотландия" })).toEqual(["Ржавый гвоздь"]);
    const mm = names({ name: "Maker's Mark", cat: "whisky", style: "бурбон", country: "США" });
    expect(mm).toContain("Олд фэшн");
    expect(mm).not.toContain("Манхэттен");
    expect(names({ name: "Jameson", cat: "whisky", country: "Ирландия" })).toEqual(["Кофе по-ирландски"]);
    // ничего не известно — к любому виски
    expect(names({ name: "Виски бара", cat: "whisky" }).length).toBeGreaterThanOrEqual(8);
    expect(names({ name: "Olmeca Reposado", cat: "agave", style: "репосадо" })).not.toContain("Маргарита");
    expect(names({ name: "Del Maguey", cat: "agave", style: "мескаль" })).toEqual([]);
  });
  it("ликёры и биттеры — по названию, как говорят в зале и по синонимам; добавки и цвет вермута — мимо", () => {
    expect(names({ name: "Campari", cat: "bitter" })).toContain("Негрони");
    expect(names({ name: "Cointreau", cat: "liqueur" })).toContain("Маргарита");
    expect(names({ name: "Kahlua", cat: "liqueur" })).toContain("Белый русский");
    expect(names({ name: "Апельсиновый ликёр", cat: "liqueur" })).toEqual([]);   // не «Апельсиновый сок»
    expect(names({ name: "Ликёр Мята", cat: "liqueur" })).not.toContain("Мохито");
    expect(names({ name: "Martini Rosso", cat: "bitter" })).toContain("Негрони");
    expect(names({ name: "Martini Rosso", cat: "bitter" })).not.toContain("Мартини");
    expect(names({ name: "Martini Extra Dry", cat: "bitter" })).toContain("Мартини");
    expect(names({ name: "Martini Extra Dry", cat: "bitter" })).not.toContain("Негрони");
    expect(SC.spiritKeys({ name: "Angostura Aromatic Bitters" })).toContain("ангостура");
  });
  it("строка коктейля: живые позиции из нашей карты", () => {
    const neg = COCKTAILS.find((c) => c.id === "negroni");
    const items = [S.normSpirit({ name: "Campari", cat: "bitter" }, { id: "c" }), S.normSpirit({ name: "Beefeater", cat: "gin" }, { id: "b" }), S.normSpirit({ name: "Old", cat: "gin", archived: true }, { id: "o" })];
    expect(SC.cocktailSpirits(neg, items).map((w) => w.id)).toEqual(["c", "b"]);
    expect(rd("lib/spirit.js")).not.toContain("data/pronounce");   // словарь — только там, где он нужен (не в «Справочнике»)
  });
});

describe("v127: «Барная карта» (lib/bar-card.js)", () => {
  const house = { id: "h1", kind: "cocktail", name: "Морской бриз по-нашему", ing: [["Водка", "40 мл"], ["Клюквенный морс", "90 мл"]], method: "билд", glass: "highball" };
  it("коктейли нашего бара: свои — первыми, классика — из «Карты бара» (не настроена — вся)", () => {
    const all = B.ourCocktails([]);
    expect(all.length).toBe(COCKTAILS.length);
    const card = B.ourCocktails([{ id: "__barcard__", cocktails: ["negroni", "mojito"] }, house]);
    expect(card.map((c) => c.id)).toEqual(["h1", "negroni", "mojito"]);
    expect(card[0].house).toBe(true);
  });
  it("по основе (порядок карты, свои первыми), поиск по ингредиенту, основа по первому ингредиенту", () => {
    const list = B.ourCocktails([house]);
    const g = B.groupByBase(list);
    expect(g.map(([k]) => k)).toEqual(B.BAR_BASES.filter((k) => g.some(([x]) => x === k)));
    const vodka = g.find(([k]) => k === "Водка")[1], firstClassic = vodka.findIndex((c) => !c.house);
    expect(vodka.findIndex((c) => c.id === "h1")).toBeLessThan(firstClassic);   // свои — выше классики
    expect(B.findCocktails(list, "кампари").map((c) => c.id)).toContain("negroni");
    expect(B.findCocktails(list, "негрони").map((c) => c.id)).toContain("negroni");
    expect(B.cocktailBase({ ing: [["Белый ром", "50"]] })).toBe("Ром");
    expect(B.cocktailBase({ ing: [["Бурбон", "50"]] })).toBe("Виски");
    expect(B.cocktailBase({ ing: [] })).toBe("Другое");
  });
  it("подпись карточки в Справочнике: сколько чего (архив не считается)", () => {
    const shared = [{ id: "__barcard__", cocktails: ["negroni"] }, house, { id: "w1", kind: "wine", name: "Шабли" }, { id: "w2", kind: "wine", name: "Б", archived: true }, CARD[0], CARD[1]];
    expect(B.barCounts(shared)).toEqual({ cocktails: 2, wines: 1, spirits: 2 });
    expect(B.barLine(B.barCounts(shared))).toBe("Коктейли 2 · вина 1 · крепкое 2");
    expect(B.barLine({ cocktails: 0, wines: 0, spirits: 3 })).toBe("Крепкое 3");
    expect(B.barLine({})).toBe("Коктейли, вина и крепкое нашего бара");
    expect([1, 2, 5].map(B.cocktailsWord)).toEqual(["1 коктейль", "2 коктейля", "5 коктейлей"]);
  });
});

describe("v127: этап 45 «Кто выучил новинки крепкого»", () => {
  const Q = rd("supabase/supabase-stage45-spirits.sql");
  it("SQL: своя таблица (закрыта), две функции для anon, служебные — закрыты; ничего не удаляет; итог строкой", () => {
    expect(Q).toContain("create table if not exists sa_spirit_progress (");
    expect(Q).toContain("revoke all on table sa_spirit_progress from public, anon, authenticated;");
    expect(Q).toContain("create or replace function spirit_progress_set(p_token text, p_kind text, p_data jsonb default '{}'::jsonb)");
    expect(Q).toContain("create or replace function spirit_progress_team(p_token text, p_restaurant text default null)");
    expect(Q).toContain("grant execute on function spirit_progress_set(text, text, jsonb), spirit_progress_team(text, text) to anon, authenticated;");
    expect(Q).toContain("revoke all on function _sa_wp_ids(jsonb) from public, anon, authenticated;");
    expect(Q).toContain("select 'крепкое: ' ||");
    expect(code(Q.replace(/--[^\n]*/g, ""))).not.toMatch(/\bdrop\s+(table|function)\b|\bdelete\s+from\b|\btruncate\b/i);
    expect(Q).not.toMatch(/sa_wine_progress|wine_progress_(set|team)/);
    expect(STAGES.find((s) => s.n === "45")).toEqual({ n: "45", file: "supabase-stage45-spirits.sql", what: "Кто выучил новинки крепкого", fn: "spirit_progress_team" });
    expect(rd("supabase/README.md")).toContain("| 54 | `supabase-stage45-spirits.sql` | **Кто выучил новинки крепкого** (v127)");
    expect(rd("tools/claude/pg-check-stage45.mjs")).toContain('pg("spirit_progress_set"');
  });
  it("сервер демо: крепкое отдельно от вин, правила те же", () => {
    const PEOPLE = [{ id: "u-m", name: "Мария", surname: "Ким", restaurant: "R", position: "manager", is_admin: false },
      { id: "e-a", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter", is_admin: false }];
    const s = makeServer({ today: "2026-11-01", rest: "R", people: PEOPLE, tok: { tm: "u-m", ta: "e-a" }, sstaff: [], cfg: { shifts: [], staff: [] }, plan: {}, menu: [], clock: () => NOW });
    expect(s.rpc("spirit_progress_set", { p_token: "ta", p_kind: "passed", p_data: { ids: ["sp-mak", "sp-mak", ""], stats: { known: 9, total: 5 } } })).toEqual({ ok: true });
    expect(s.S.spirit["R|e-a"]).toMatchObject({ passed: ["sp-mak"], known: 5, total: 5 });
    expect(s.S.wine["R|e-a"]).toBeUndefined();
    expect(s.rpc("spirit_progress_team", { p_token: "ta" }).error).toBe("forbidden");
    expect(s.rpc("spirit_progress_team", { p_token: "tm" }).rows.map((r) => r.id + ":" + r.passed.join("|"))).toEqual(["e-a:sp-mak", "u-m:"]);
    expect(s.rpc("wine_progress_team", { p_token: "tm" }).rows.every((r) => !r.at)).toBe(true);
  });
});

describe("v127: AI для крепкого (api/wine-import.js, kind: \"spirit\")", () => {
  const real = globalThis.fetch;
  let handler, lastPrompt = "";
  beforeAll(async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    globalThis.fetch = async (url, init) => {
      if (/rpc\/whoami/.test(url)) return { ok: true, json: async () => ({ ok: true, employee: { id: "u1", name: "Мария" } }) };
      try { lastPrompt = JSON.stringify(JSON.parse(init.body).messages); } catch (e) { lastPrompt = ""; }
      const out = [{ name: "Glenfiddich 12", cat: "whisky", style: "односолодовый", abv: "40%", portion: "40", pricePortion: "650 ₽", serve: ["чистым", "neat", "со льдом"], glass: "гленкерн", x: 1 },
        { name: "Hennessy VS", cat: "Коньяк", portion: 900, glass: "бокал", notes: "ваниль, дуб" }];
      return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content: JSON.stringify(out) } }] }) };
    };
    handler = (await import("../api/wine-import.js")).default;
  });
  afterAll(() => { globalThis.fetch = real; delete process.env.OPENROUTER_API_KEY; });
  const call = (body) => new Promise((ok) => { const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); return this; } }; handler({ method: "POST", body }, res); });
  it("names: подсказка бармена; вид, бокал и подача — из своих списков (вид словом пропускается — его поймёт приложение), порция до 500 мл", async () => {
    const { code: c, j } = await call({ token: "t1", mode: "names", kind: "spirit", names: ["Glenfiddich 12", "Hennessy VS"] });
    expect(c).toBe(200);
    expect(lastPrompt).toContain("бармен ресторанной академии");
    expect(j.wines[0]).toMatchObject({ name: "Glenfiddich 12", cat: "whisky", abv: 40, portion: 40, pricePortion: 650, serve: ["чистым", "со льдом"], glass: "гленкерн" });
    expect(j.wines[0]).not.toHaveProperty("x");
    expect(j.wines[1]).toMatchObject({ cat: "Коньяк", portion: "", glass: "", notes: ["ваниль", "дуб"] });
    expect(S.normSpirit(j.wines[1]).cat).toBe("cognac");
  });
  it("label: с этикетки — без цены и порции; вина — по-прежнему своей подсказкой", async () => {
    const { j } = await call({ token: "t2", mode: "label", kind: "spirit", imageBase64: "a".repeat(200), mime: "image/jpeg" });
    expect(j.wines).toHaveLength(1);
    expect(j.wines[0]).toMatchObject({ portion: "", pricePortion: "", priceBottle: "" });
    await call({ token: "t3", mode: "names", names: ["Шабли"] });
    expect(lastPrompt).toContain("сомелье");
  });
});

describe("v127: экраны", () => {
  const T = { screen: {}, modCard: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modArrow: {}, para: {}, doneBtn: {} };
  it("«Барная карта» рисуется: сотруднику без вин и крепкого — только коктейли; руководителю — три вкладки", async () => {
    const { BarCardScreen } = await import("../ui/bar-card.jsx");
    const staff = renderToString(React.createElement(BarCardScreen, { T, a11y: false, profile: { restaurant: "R", position: "waiter" }, onBack: () => {}, onEdit: () => {} }));
    expect(staff).toContain('data-bar-cocktails="' + COCKTAILS.length + '"');
    expect(staff).not.toContain("data-bar-tabs");
    const lead = renderToString(React.createElement(BarCardScreen, { T, a11y: false, profile: { restaurant: "R", position: "manager" }, onBack: () => {}, onEdit: () => {}, onCocktailDeck: () => {}, onBarLab: () => {} }));
    expect(lead).toContain('data-bar-tabs="cocktail,wine,spirit"');
    expect(lead).toContain('data-bar-learn="deck"');   // v128: колода и лаборатория — две кнопки рядом
    expect(lead).toContain('data-bar-learn="lab"');
    expect(lead).toContain(">Барная карта<");
  });
  it("вкладка запоминается; вина и крепкое — один экран с видом; коктейль — в «Колоду бармена»", () => {
    const BC = rd("ui/bar-card.jsx");
    for (const s of ['const TAB_KEY = "sa_bar_tab";', "React.useEffect(() => { saveTab(cur); }, [cur]);", 'data-bar-tab={pin ? undefined : k}', "<WineListScreen key={cur} kind={cur}",
      "onEdit={onEdit ? (id) => onEdit(cur, id) : undefined}", "В карте бара пока нет коктейлей."]) expect(BC, s).toContain(s);
    // v136 (Доп. 449): что из нашей карты — в той же строке, что метод и бокал («шейк · купе · Hendrick's»), без «Из нашей карты: »
    expect(BC).toContain('{line}{line && ours.length ? " · " : ""}{ours.length ? <span data-bar-ck-spirits={ours.length}');
    const L = rd("ui/wine-list.jsx");
    for (const s of ["const K = drinkOf(kind);", "data-drink-kind={K.kind}", "В коктейлях нашего бара", "data-spirit-cocktail={c.id}", 'if (menuLoaded && K.kind === "wine") wineCatchUp(']) expect(L, s).toContain(s);
    const APP = rd("App.jsx");
    for (const s of ['import("./ui/bar-card")', "<WineEditor key={wineKind} kind={wineKind}", "setBarTab(null)"]) expect(APP, s).toContain(s);
    expect(APP).not.toContain('import("./ui/wine-list")');
    expect(rd("ui/ReferenceSection.jsx")).toContain('s: barLine(barCounts(cachedShared(restaurant)))');
  });
  it("редактор крепкого: вид чипами, порция 25, 40, 50 мл или своя, подача, бокал и температура, «ходовое»", () => {
    const E = rd("ui/wine-editor.jsx");
    for (const s of ["data-wine-cat={k}", "{PORTIONS.map((n) =>", "data-wine-portion={n}", 'field("portion", "Своя, мл"', "data-wine-serve={m}", 'label("Бокал и температура", ["glass", "temp"])',
      "data-wine-glass={g}", "Ходовое: учить первым", 'const blank = () => (K.kind === "spirit" ? blankSpirit(K) : blankWine());']) expect(E, s).toContain(s);
    expect(S.PORTIONS).toEqual([25, 40, 50]);
    expect(S.SPIRIT_CATS.map(([k]) => k)).toEqual(["whisky", "cognac", "rum", "gin", "agave", "vodka", "liqueur", "bitter", "other"]);
  });
  it("меню блюд, брифинг, живой гость и публикация меню: крепкое — не блюдо и не стирается", () => {
    expect(rd("lib/briefing.js")).toContain('d.kind !== "wine" && d.kind !== "spirit"');
    expect(rd("ui/live-guest.jsx")).toContain('d.kind === "cocktail" || d.kind === "wine" || d.kind === "spirit"');
    expect(rd("ui/menu-trainer.jsx")).toContain('(x.kind === "cocktail" || x.kind === "wine" || x.kind === "spirit")');
  });
});

describe("v127: произношение, демо, документы, правила текста", () => {
  it("«Как произносить»: дома и марки крепкого; оригиналы в разделе бара не повторяются", () => {
    const bar = PRONOUNCE.filter((p) => p.cat === "bar");
    for (const o of ["Hennessy", "Glenfiddich", "Laphroaig", "Hendrick's", "cachaça"]) expect(bar.some((p) => p.o === o), o).toBe(true);
    const os = bar.map((p) => p.o.toLowerCase());
    expect(os.filter((o, i) => os.indexOf(o) !== i)).toEqual([]);
    expect(bar.find((p) => p.o === "Glenfiddich").w).toBe("Гленф+иддик");
  });
  it("демо: десять позиций крепкого, две новинки, AI без нейросети; команда учит; проверка демо — «Барная карта»", () => {
    const BT = rd("tools/claude/demo-app/boot.js"), C = rd("tools/claude/demo-app/check.mjs");
    for (const s of ["const DEMO_SPIRITS = [", "spiritProg: {", 'if (b.kind === "spirit") return demoSpiritAi(b);', "if (!srv.S.spiritSeeded)"]) expect(BT, s).toContain(s);
    for (const s of ["const toBar = async (tab, ms = 1500)", "«Кто выучил новинки крепкого»", "Новая позиция: вид чипами"]) expect(C, s).toContain(s);
  });
  it("README, CHANGES; без тире-ритма и эмодзи в новом коде; метка — v127", () => {
    const TOOLS = rd("tools/claude/README.md");
    expect(TOOLS).toContain("`e2e-v127.mjs` — v127 (Доп. 440)");
    expect(TOOLS).toContain("node tools/claude/pg-check-stage45.mjs");
    expect(rd("CHANGES.md")).toContain("# Дополнение 440 — «Барная карта»");
    for (const f of ["lib/spirit.js", "lib/spirit-cocktails.js", "lib/drinks.js", "lib/bar-card.js", "ui/bar-card.jsx", "ui/wine-list.jsx", "ui/wine-editor.jsx", "ui/wine-train.jsx", "lib/wine-train.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(12[7-9]|1[3-9]\d|[2-9]\d\d)<\/span>/);
  });
});
