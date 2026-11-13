// v151 (Доп. 475): «Дописать пустое» — вся барная карта за раз. Владелец (13.11): «В справочнике есть барная карта, в ней уже
// добавлены вина и крепкие алкогольные напитки. Так вот, есть возможность мне помочь и заполнить недостающую информацию,
// опираясь на название того или иного напитка? Естественно без года урожая (его уже вручную вобью)». На предложение кнопки
// «Дописать пустое» в редакторе барной карты: «Давай 😉». AI идёт пачками (api/wine-import.js, mode "gaps"), пишет только в
// пустые поля с пометкой «AI»; год урожая, объём, цены, порцию и «бокалом» не трогает (lib/drinks.js: BULK_SKIP); что не
// знал — помнится (aiTried) и второй раз не спрашивается. Экран — tools/claude/e2e-v151.mjs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { WINE, SPIRIT, NO_ASK, BULK_SKIP, bulkAsk, bulkQueue, bulkPlan, bulkTotal, bulkJobs, bulkMerge, bulkApply } from "../lib/drinks";
import { normWine } from "../lib/wine";
import { normSpirit } from "../lib/spirit";

const rd = (p) => readFileSync(p, "utf8");
const wine = (o) => WINE.norm({ name: "Шабли", ...o });
const spirit = (o) => SPIRIT.norm({ name: "Hennessy VS", ...o });

describe("v151: что спрашивать у AI (lib/drinks.js)", () => {
  it("BULK_SKIP — год урожая, объём, цены, порция и «бокалом»: их вписывают руками", () => {
    expect(BULK_SKIP).toEqual([...NO_ASK, "vintage", "volume"]);
    for (const f of ["vintage", "volume", "byGlass", "priceGlass", "priceBottle", "portion", "pricePortion"]) expect(BULK_SKIP).toContain(f);
  });
  it("bulkAsk: вписанное — фактами, пустое — кроме BULK_SKIP и того, что AI уже не знал", () => {
    const w = wine({ id: "wn-1", producer: "Domaine Laroche", color: "white", vintage: "2022", priceBottle: 5200 });
    const a = bulkAsk(WINE, w);
    expect(a.known).toEqual({ producer: "Domaine Laroche", color: "white", vintage: "2022" });
    expect(a.missing).toEqual(["country", "region", "grapes", "sweet", "abv", "temp", "glass", "notes", "short", "story"]);
    expect(bulkAsk(WINE, { ...w, aiTried: ["region", "abv"] }).missing).not.toContain("region");
    const s = spirit({ id: "sp-1", cat: "cognac", portion: 40, pricePortion: 750 });
    expect(bulkAsk(SPIRIT, s).missing).toEqual(["producer", "style", "country", "region", "age", "abv", "serve", "glass", "temp", "notes", "short", "story"]);
  });
  it("очередь: только живые позиции с названием и пустыми полями; план — сначала вид редактора; пачки по n", () => {
    const menu = [wine({ id: "wn-1" }), wine({ id: "wn-2", name: "" }), wine({ id: "wn-3", archived: true }), spirit({ id: "sp-1" }), { id: "d1", name: "Борщ" },
      wine({ id: "wn-4", name: "Полное", producer: "p", country: "c", region: "r", grapes: ["g"], color: "red", sweet: "сухое", abv: 13, temp: "16 °C", glass: "бордо", notes: ["вишня"], short: "s", story: "t" })];
    expect(bulkQueue(WINE, menu).map((r) => r.id)).toEqual(["wn-1"]);
    expect(bulkQueue(SPIRIT, menu).map((r) => r.id)).toEqual(["sp-1"]);
    expect(bulkPlan(menu, "spirit")).toEqual([{ kind: "spirit", ids: ["sp-1"] }, { kind: "wine", ids: ["wn-1"] }]);
    expect(bulkPlan(menu)).toEqual([{ kind: "wine", ids: ["wn-1"] }, { kind: "spirit", ids: ["sp-1"] }]);
    expect(bulkTotal(bulkPlan(menu))).toBe(2);
    expect(bulkJobs([{ kind: "wine", ids: ["a", "b", "c", "d", "e"] }, { kind: "spirit", ids: ["x"] }], 2))
      .toEqual([{ kind: "wine", ids: ["a", "b"] }, { kind: "wine", ids: ["c", "d"] }, { kind: "wine", ids: ["e"] }, { kind: "spirit", ids: ["x"] }]);
    expect(bulkPlan([wine({ id: "wn-1", aiTried: WINE.fillAsk(wine({})).missing })])).toEqual([]);   // всё уже спрашивали — дописывать нечего
  });
});

describe("v151: ответ AI в карточку (lib/drinks.js)", () => {
  it("bulkMerge: только пустые поля, с пометкой «AI»; год, объём и цены — никогда, даже если AI их прислал", () => {
    const w = wine({ id: "wn-1", producer: "Domaine Laroche", country: "Франция", vintage: "", priceBottle: 5200, ai: [] });
    const { rec, added } = bulkMerge(WINE, w, { producer: "Другой", abv: 12.5, story: "Минерально", vintage: "2019", volume: "0,75 л", priceBottle: 1, byGlass: true }, ["abv", "story", "region"]);
    expect(added).toEqual(["abv", "story"]);
    expect(rec.producer).toBe("Domaine Laroche");
    expect([rec.vintage, rec.volume, rec.priceBottle, rec.byGlass]).toEqual(["", "", 5200, false]);
    expect(rec.ai).toEqual(["abv", "story"]);
    expect(rec.aiTried).toEqual(["region"]);   // спросили, AI не знал
  });
  it("bulkMerge: чужие поля записи (stopAt из чата, отметки сервера) остаются; aiTried, ставший пустым, уходит", () => {
    const w = { ...wine({ id: "wn-1", stop: { since: 5 } }), stopAt: 123, updatedAt: 456, aiTried: ["abv"] };
    const { rec } = bulkMerge(WINE, { ...w, aiTried: [] }, { story: "Свежее" }, ["story"]);
    expect([rec.stopAt, rec.updatedAt, rec.stop]).toEqual([123, 456, { since: 5 }]);
    expect("aiTried" in rec).toBe(false);
    expect(bulkMerge(WINE, w, { abv: 12 }, ["abv"]).rec.aiTried).toBeUndefined();   // abv заполнено — из aiTried ушло
  });
  it("bulkApply: ответ по номеру позиции; нет ответа — «не нашёл», и спрошенное уходит в aiTried", () => {
    const menu = [wine({ id: "wn-1" }), wine({ id: "wn-2", name: "Своё вино" }), { id: "d1", name: "Борщ" }];
    const items = [{ id: "wn-1", missing: ["abv", "story"] }, { id: "wn-2", missing: ["abv", "region"] }];
    const r = bulkApply(WINE, menu, items, [{ i: 0, abv: 12, story: "Свежее" }]);
    expect(r.added).toEqual([{ id: "wn-1", name: "Шабли", fields: ["abv", "story"] }]);
    expect(r.none).toEqual(["Своё вино"]);
    const two = WINE.records(r.shared).find((x) => x.id === "wn-2");
    expect(two.aiTried).toEqual(["abv", "region"]);
    expect(bulkAsk(WINE, two).missing).not.toContain("abv");
    expect(r.shared.find((x) => x.id === "d1")).toEqual({ id: "d1", name: "Борщ" });   // блюда не трогаем
    expect(r.shared.length).toBe(3);
  });
  it("aiTried в записи: только известные пустые поля; заполнили — уходит само; пусто — поля нет (старые записи как были)", () => {
    expect(normWine({ name: "x", aiTried: ["abv", "abv", "foo", "story"], story: "есть" }).aiTried).toEqual(["abv"]);
    expect("aiTried" in normWine({ name: "x" })).toBe(false);
    expect("aiTried" in normWine({ name: "x", aiTried: ["story"], story: "есть" })).toBe(false);
    expect(normSpirit({ name: "x", aiTried: ["age", "volume", "bar"] }).aiTried).toEqual(["age", "volume"]);
    expect("aiTried" in normSpirit({ name: "x" })).toBe(false);
  });
});

describe("v151: api/wine-import.js — mode \"gaps\"", () => {
  const real = globalThis.fetch;
  let A, prompts = [], reply = "[]";
  beforeAll(async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    globalThis.fetch = async (url, init = {}) => {
      if (/rpc\/whoami/.test(url)) return { ok: true, json: async () => ({ ok: true, employee: { id: "u1", name: "Мария" } }) };
      const body = JSON.parse(init.body);
      prompts.push((((body.messages || [])[0] || {}).content || [])[0].text);
      return { ok: true, status: 200, json: async () => ({ model: body.model, choices: [{ finish_reason: "stop", message: { content: reply } }] }) };
    };
    A = await import("../api/wine-import.js");
  });
  afterAll(() => { globalThis.fetch = real; delete process.env.OPENROUTER_API_KEY; });
  const call = (body) => new Promise((ok) => { const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); return this; } }; A.default({ method: "POST", body }, res); });

  it("gapItems: до 6 позиций, номера сохраняются, «не хватает» — только поля «по названию» без года, объёма и цен", () => {
    const items = A.gapItems([{ name: "Шабли", known: { producer: "Laroche", vintage: "2022", x: 1 }, missing: ["abv", "vintage", "volume", "priceBottle", "story", "abv"] },
      { name: "", missing: ["abv"] }, ...Array.from({ length: 6 }, (_, i) => ({ name: "w" + i, missing: ["abv"] }))], false);
    expect(items.length).toBe(A.GAP_MAX);
    expect(A.GAP_MAX).toBe(6);
    expect(items[0]).toEqual({ name: "Шабли", known: { producer: "Laroche", vintage: "2022" }, missing: ["abv", "story"] });
    expect(items[1]).toEqual({ name: "", known: {}, missing: ["abv"] });
    expect(A.gapItems([{ name: "Hennessy VS", missing: ["age", "portion", "pricePortion", "serve"] }], true)[0].missing).toEqual(["age", "serve"]);
  });
  it("подсказка: вписанное — фактами, «не хватает» — по позиции; год, объём и цены не писать; позиции без названия — мимо", () => {
    const items = A.gapItems([{ name: "Шабли", known: { producer: "Laroche" }, missing: ["abv", "story"] }, { name: "", missing: ["abv"] }, { name: "Кьянти", missing: ["region"] }], false);
    const p = A.gapsPrompt(items, false);
    expect(p).toContain("Ты — сомелье ресторанной академии.");
    expect(p).toContain('0. «Шабли» — вписано: {"producer":"Laroche"}; не хватает: abv, story');
    expect(p).toContain("2. «Кьянти»; не хватает: region");
    expect(p).not.toContain("1. «");
    expect(p).toContain("Год урожая, объём, цены и подачу бокалом не пиши.");
    expect(A.gapsPrompt(A.gapItems([{ name: "Glenfiddich 12", missing: ["story"] }], true), true)).toContain("Год урожая, объём, цены и порцию не пиши.");
  });
  it("разбор ответа: по номеру, иначе по названию, иначе по порядку; только недостающие поля, без повторов", () => {
    const items = A.gapItems([{ name: "Шабли", missing: ["abv", "story"] }, { name: "Кьянти Классико", missing: ["region"] }, { name: "", missing: ["abv"] }], false);
    expect(A.gapsPick([{ i: 1, region: "Тоскана", producer: "Лишнее" }, { name: "шабли!", abv: "12,5", story: "Минерально", vintage: "2019" }, { i: 1, region: "Дубль" }], items, false))
      .toEqual([{ i: 0, name: "Шабли", abv: 12.5, story: "Минерально" }, { i: 1, name: "Кьянти Классико", region: "Тоскана" }]);
    expect(A.gapsPick([{ abv: 13 }, { region: "Тоскана" }], items, false)).toEqual([{ i: 0, name: "Шабли", abv: 13 }, { i: 1, name: "Кьянти Классико", region: "Тоскана" }]);
    expect(A.gapsPick([{ i: 2, abv: 13 }], items, false)).toEqual([]);   // позиция без названия
    expect(A.gapsPick(null, items, false)).toEqual([]);
  });
  it("обработчик: 200 с { wines: [{ i, …}] }; ничего не узнал — пустой список; не JSON — 422; нечего дописывать — 400", async () => {
    reply = JSON.stringify([{ i: 0, name: "Шабли", abv: 12.5, story: "Минерально", vintage: "2020", priceBottle: 1 }]);
    prompts = [];
    let r = await call({ token: "t1", mode: "gaps", items: [{ name: "Шабли", known: { producer: "Laroche" }, missing: ["abv", "story", "vintage"] }] });
    expect(r.code).toBe(200);
    expect(r.j.wines).toEqual([{ i: 0, name: "Шабли", abv: 12.5, story: "Минерально" }]);
    expect(prompts[0]).toContain("не хватает: abv, story");
    reply = "[]";
    r = await call({ token: "t1", mode: "gaps", kind: "spirit", items: [{ name: "Своя настойка", missing: ["story"] }] });
    expect(r.code).toBe(200);
    expect(r.j.wines).toEqual([]);
    reply = "Извините, не знаю";
    r = await call({ token: "t1", mode: "gaps", items: [{ name: "Шабли", missing: ["abv"] }] });
    expect(r.code).toBe(422);
    r = await call({ token: "t1", mode: "gaps", items: [{ name: "Шабли", missing: ["vintage", "priceBottle"] }] });
    expect(r.code).toBe(400);
  });
});

describe("v151: редактор барной карты — «Дописать пустое»", () => {
  const E = rd("ui/wine-editor.jsx");
  it("кнопка в сводке: число позиций всей карты, только когда меню с сервера пришло и импорт закрыт", () => {
    // v152: к импорту добавились webAsk, webPlan, webApply («Поискать в интернете»)
    expect(E).toContain('import { drinkOf, bulkAsk, bulkPlan, bulkTotal, bulkJobs, bulkApply, webAsk, webPlan, webApply } from "../lib/drinks";');
    expect(E).toContain("const plan = React.useMemo(() => bulkPlan(shared, K.kind), [shared, K]);");
    expect(E).toContain("{bulkN && loaded && !imp ? (");
    expect(E).toContain('data-wine-bulk={bulkN}');
    expect(E).toContain(">Дописать пустое · {bulkN}</button>");
  });
  it("пачки по 4, по 3 запроса сразу; после круга — сохранение в меню команды; ушли с экрана — новых пачек нет", () => {
    expect(E).toContain("const BULK_BATCH = 4, BULK_PAR = 3;");
    // v152: тот же запрос, у поиска в интернете — ещё web: true
    expect(E).toContain('return askAiFull({ mode: "gaps", items: items.map(({ name, known, missing }) => ({ name, known, missing })), ...(job.kind === "spirit" ? { kind: "spirit" } : {}), ...(web ? { web: true } : {}) })');
    // v152: у поиска в интернете ответ ложится через webApply (ещё ссылки aiWeb)
    expect(E).toContain("const KK = drinkOf(r.job.kind), a = web ? webApply(KK, cur, r.items, r.got, Date.now()) : bulkApply(KK, cur, r.items, r.got);");
    expect(E).toContain("saveMenu(cur).then((ok) => { if (ok) go(); else finish(true); });");
    expect(E).toContain("React.useEffect(() => () => { bulkStop.current = true; }, []);");
    expect(E).toContain('const saveMenu = (next) => rpc("menu_set", { p_token: saToken(), p_restaurant: restaurant, p_dishes: JSON.stringify(next) })');
  });
  it("экран: вопрос (что впишет, что не тронет), работа с «Остановить», итог с «не нашёл» и «Скопировать названия»", () => {
    expect(E).toContain("Год урожая, объём, цены и порции. Уже вписанное не меняет.");
    expect(E).toContain("пока не проверишь, позиция не идёт в тренировку");
    expect(E).toContain('data-wine-bulk-stop=""');
    // v152: у поиска в интернете своя строка («Не нашлось и в интернете у …»)
    expect(E).toContain('{web ? "Не нашлось и в интернете у " : "AI не нашёл, что дописать, у "}{posGen(bulk.none.length)}');
    expect(E).toContain('{bulk.copied ? "Скопировано ✓" : "Скопировать названия"}');
    expect(E).toContain("AI не ответил по {posDat(bulk.failed)}");
    expect(E).toContain('onKind(other, "@review")');
  });
  it("App: «Проверить крепкое ›» открывает другой редактор сразу в «Проверке подряд»", () => {
    expect(rd("App.jsx")).toContain('onKind={(k, start) => { setWineKind(k === "spirit" ? "spirit" : "wine"); setWineEdit(start || null); }}');
  });
});

describe("v151: метка и журнал", () => {
  it("метка «сборка v151», Дополнение 475 со словами владельца, e2e-v151 в README", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    expect(n[0]).toBeGreaterThanOrEqual(151);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 475 — .*\(v151\)/);
    expect(c).toContain("Естественно без года урожая (его уже вручную вобью)");
    expect(rd("tools/claude/README.md")).toContain("`e2e-v151.mjs` — v151 (Доп. 475)");
  });
});
