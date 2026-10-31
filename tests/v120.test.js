// v120 (Доп. 433): «Винная карта» и умный «Редактор вин». Владелец (31.10): «Вин более 140 позиций… PDF, к сожалению, нет.
// Но возможность добавления его нужно оставить» и «Сделаем такой же умный редактор, чтобы не только AI добавлял, а ещё и
// человек ручками всё это мог добавить». Вина — записи kind:"wine" в меню команды (lib/wine.js); руками — любое поле;
// AI (api/wine-import.js) — по названию, фото страницы, списком, PDF; что дописал AI — «не проверено», пока не подтвердят.
// Вина не блюда: не попадают в тренажёр меню, брифинг, поиск блюд, а публикация меню их не стирает. e2e — e2e-v120.mjs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import * as W from "../lib/wine.js";
import { menuDishes } from "../lib/menu-dishes.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const count = (s, sub) => s.split(sub).length - 1;

describe("v120: lib/wine.js — запись вина", () => {
  it("normWine: только известные поля, длины ограничены, цвет — из списка (и по-русски), списки — из строки через запятую", () => {
    const w = W.normWine({ name: "  Шабли   Премьер Крю ", color: "Белое", grapes: "шардоне, , пино", notes: "яблоко;мел", abv: "12,5 %", priceBottle: "5 200 ₽", junk: 1, story: "x".repeat(2000) });
    expect(w.kind).toBe("wine");
    expect(w.id).toMatch(/^wn-\d+-/);
    expect(w.name).toBe("Шабли Премьер Крю");
    expect(w.color).toBe("white");
    expect(w.grapes).toEqual(["шардоне", "пино"]);
    expect(w.notes).toEqual(["яблоко", "мел"]);
    expect(w.abv).toBe(12.5);
    expect(w.priceBottle).toBe(5200);
    expect(w.story.length).toBe(900);
    expect(w).not.toHaveProperty("junk");
    expect(W.normWine({ color: "фиолетовое" }).color).toBe("");
  });
  it("AI-пометка — только у заполненных полей из списка; руками исправленное — проверено; «подтвердить» снимает всё", () => {
    const w = W.normWine({ name: "A", region: "", grapes: ["гамэ"], ai: ["region", "grapes", "name", "bogus"] });
    expect(w.ai).toEqual(["grapes"]);
    expect(W.unchecked(w)).toBe(true);
    expect(W.touched(w, "grapes").ai).toEqual([]);
    const ok = W.confirmWine(w, "Мария Ким");
    expect(ok.ai).toEqual([]);
    expect(ok.checkedBy).toBe("Мария Ким");
    expect(ok.checkedAt).toBeGreaterThan(0);
  });
  it("mergeAi: AI заполняет только пустые поля (вписанное руками не трогает) и помечает именно их", () => {
    const mine = { ...W.normWine({ name: "Шабли", region: "Шабли", grapes: "" }), ai: [] };
    const m = W.mergeAi(mine, { name: "другое", region: "Бургундия", country: "Франция", grapes: ["шардоне"], notes: "мел, лимон", color: "white" });
    expect(m.name).toBe("Шабли");
    expect(m.region).toBe("Шабли");
    expect(m.country).toBe("Франция");
    expect(m.grapes).toEqual(["шардоне"]);
    expect(m.ai.sort()).toEqual(["color", "country", "grapes", "notes"]);
  });
  it("меню команды: вино заменяется по id или добавляется; пакет; удаление не трогает блюда, коктейли и карту бара", () => {
    const menu = [{ id: "d1", name: "Суп" }, { id: "c1", kind: "cocktail", name: "Негрони" }, { id: "__barcard__", cocktails: [] }];
    const a = W.withWine(menu, { id: "w1", name: "Шабли" });
    expect(a).toHaveLength(4);
    expect(a[3]).toMatchObject({ id: "w1", kind: "wine" });
    const b = W.withWine(a, { id: "w1", name: "Шабли 2022" });
    expect(b).toHaveLength(4);
    expect(b[3].name).toBe("Шабли 2022");
    const c = W.withWines(b, [{ id: "w2", name: "Кьянти" }, { id: "w1", name: "Шабли" }]);
    expect(W.wineRecords(c).map((w) => w.id)).toEqual(["w1", "w2"]);
    expect(W.withoutWine(c, "w1").map((d) => d.id)).toEqual(["d1", "c1", "__barcard__", "w2"]);
  });
  it("подписи: год не повторяется; строка стиля; цена; группы по цвету в порядке карты; поиск по сорту и нотам", () => {
    expect(W.wineTitle({ name: "Бароло 2018", vintage: "2018" })).toBe("Бароло 2018");
    expect(W.wineTitle({ name: "Бароло", vintage: "2018" })).toBe("Бароло 2018");
    expect(W.wineLine({ country: "Франция", region: "Бургундия", grapes: ["шардоне"], color: "white", sweet: "сухое" })).toBe("Франция, Бургундия · шардоне · белое сухое");
    expect(W.winePrice({ byGlass: true, priceGlass: 650, priceBottle: 3900 })).toBe("бокал 650 ₽ · бутылка 3 900 ₽");
    expect(W.winePrice({ byGlass: false, priceGlass: 650 })).toBe("");
    expect(W.groupByColor([{ name: "b", color: "red" }, { name: "a", color: "white" }, { name: "c" }, { name: "d", color: "sparkling" }]).map((g) => g[0])).toEqual(["sparkling", "white", "red", "other"]);
    const ws = [{ name: "Шабли", grapes: ["шардоне"], notes: ["мел"] }, { name: "Кьянти", grapes: ["санджовезе"] }];
    expect(W.findWines(ws, "шардоне мел").map((w) => w.name)).toEqual(["Шабли"]);
    expect(W.findWines(ws, "")).toHaveLength(2);
  });
  it("то же вино: по названию (и по названию с годом); разные годы — разные вина", () => {
    expect(W.sameWine({ name: "Шабли" }, { name: "шабли", vintage: "2022" })).toBe(true);
    expect(W.sameWine({ name: "Шабли 2022" }, { name: "Шабли", vintage: "2022" })).toBe(true);
    expect(W.sameWine({ name: "Шабли", vintage: "2021" }, { name: "Шабли", vintage: "2022" })).toBe(false);
    expect(W.sameWine({ name: "Шабли" }, { name: "Шабли Премьер Крю" })).toBe(false);
  });
  it("список названий: номера, маркеры, цены и объёмы отрезаются, повторы и мусор — мимо", () => {
    expect(W.splitNames("1. Шабли Премьер Крю, Domaine Laroche 2021 — 6 500 ₽\n• Просекко DOC 0,75 л 3200 руб.\n\nКьянти Классико 150 мл 650 р\nшабли премьер крю, domaine laroche 2021\n—\n42\nRiesling Dr. Loosen 2022\nБароло 2017 750 ml"))
      .toEqual(["Шабли Премьер Крю, Domaine Laroche 2021", "Просекко DOC", "Кьянти Классико", "Riesling Dr. Loosen 2022", "Бароло 2017"]);
    expect(W.splitNames(Array.from({ length: 300 }, (_, i) => "Вино " + i).join("\n"))).toHaveLength(200);
  });
  it("ответ AI: массив, объект, {wines:[…]}, в тексте и в ```json", () => {
    expect(W.parseAiWines('[{"name":"A"},{"name":"B"}]')).toHaveLength(2);
    expect(W.parseAiWines('```json\n{"wines":[{"name":"A"}]}\n```')).toHaveLength(1);
    expect(W.parseAiWines('Вот: {"name":"X","color":"red"} готово')).toEqual([{ name: "X", color: "red" }]);
    expect(W.parseAiWines("не знаю")).toEqual([]);
  });
});

describe("v120: вина — не блюда, а публикация меню их не стирает", () => {
  const shared = [{ id: "d1", name: "Суп" }, { id: "c1", kind: "cocktail", name: "Негрони" }, { id: "w1", kind: "wine", name: "Шабли" }];
  it("lib/menu-dishes: в блюдах команды нет вин и коктейлей", () => {
    expect(menuDishes({ restaurant: "R", shared }).map((d) => d.id)).toEqual(["d1"]);
  });
  it("тренажёр меню: в списке команды и «сиротах» вин нет; «Опубликовать» и стоп-лист сохраняют вина вместе с коктейлями", () => {
    const M = rd("ui/menu-trainer.jsx");
    expect(M).toContain('!isBarcard(d) && d.kind !== "cocktail" && d.kind !== "wine" && !ownIds.has(d.id)');
    expect(M).toContain('!isBarcard(s) && s.kind !== "cocktail" && s.kind !== "wine" &&');
    expect(M).toContain('...(shared || []).filter(x => isBarcard(x) || (x && (x.kind === "cocktail" || x.kind === "wine")))');
    expect(M).toContain('...(shared || []).filter(d => isBarcard(d) || (d && (d.kind === "cocktail" || d.kind === "wine")))');
    expect(M).not.toMatch(/filter\(\w => isBarcard\(\w\) \|\| \(\w && \w\.kind === "cocktail"\)\)/);
  });
  it("брифинг, живой гость, кэш меню", () => {
    expect(rd("lib/briefing.js")).toContain('const isDish = (d) => isItem(d) && d.kind !== "cocktail" && d.kind !== "wine";');
    const G = rd("ui/live-guest.jsx");
    expect(G).toContain('dishes.filter((d) => d.kind === "cocktail" || d.kind === "wine")');
    expect(G).toContain('dishes: dishes.filter((d) => d.kind !== "cocktail" && d.kind !== "wine")');
    // 140+ вин: кэш меню на телефоне больше не режется на 200-й записи
    expect(rd("lib/reference-context.js")).toContain("shared[restaurant] = dishes.slice(0, 600).map(");
  });
});

describe("v120: api/wine-import.js", () => {
  const A = rd("api/wine-import.js");
  it("четыре входа, сессия и лимит — до обращения к нейросети; названий — до 15 за раз", () => {
    for (const m of ['b.mode === "fill"', 'b.mode === "names"', 'b.mode === "photo"', 'b.mode === "pdf"']) expect(A).toContain(m);
    expect(A.indexOf("verifySession(b.token)")).toBeLessThan(A.indexOf("viaOpenRouter(orKey, parts"));   // v122: + предел длины ответа
    // v122: этикетки по одной бутылке за запрос — лимит 200 в час (был 60)
    expect(Number((A.match(/rateLimit\("wine:" \+ b\.token, (\d+), 3600_000\)/) || [])[1])).toBeGreaterThanOrEqual(60);
    expect(A).toContain(".slice(0, 15)");
    expect(A).toContain('{ type: "image_url", image_url: { url: "data:" + p.mime + ";base64," + p.image } }');
    expect(A).toContain('{ type: "image", source: { type: "base64", media_type: p.mime, data: p.image } }');
  });
  describe("ответ модели — чистится", () => {
    const real = globalThis.fetch;
    let handler;
    beforeAll(async () => {
      process.env.OPENROUTER_API_KEY = "sk-test";
      globalThis.fetch = async (url) => {
        if (/rpc\/whoami/.test(url)) return { ok: true, json: async () => ({ ok: true, employee: { id: "u1", name: "Мария" } }) };
        return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content: '```json\n[{"name":"Шабли","color":"white","glass":"бургундия","grapes":"шардоне","priceBottle":"5 200 ₽","x":1},{"name":"Кьянти","color":"бордовое","glass":"кружка"},{"name":""}]\n```' } }] }) };
      };
      handler = (await import("../api/wine-import.js")).default;
    });
    afterAll(() => { globalThis.fetch = real; delete process.env.OPENROUTER_API_KEY; });
    const call = (body) => new Promise((ok) => { const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); return this; } }; handler({ method: "POST", body }, res); });
    it("names: цвет и бокал — только из списков, пустые названия выкинуты, лишних полей нет", async () => {
      const { code, j } = await call({ token: "t1", mode: "names", names: ["Шабли", "Кьянти"] });
      expect(code).toBe(200);
      expect(j.wines).toHaveLength(2);
      expect(j.wines[0]).toMatchObject({ name: "Шабли", color: "white", glass: "бургундия", grapes: ["шардоне"], priceBottle: 5200 });
      expect(j.wines[0]).not.toHaveProperty("x");
      expect(j.wines[1]).toMatchObject({ name: "Кьянти", color: "", glass: "" });
    });
    it("без названия и без режима — 400", async () => {
      expect((await call({ token: "t2", mode: "fill", name: " " })).code).toBe(400);
      expect((await call({ token: "t3", mode: "zzz" })).code).toBe(400);
    });
  });
});

describe("v120: экраны", () => {
  const L = rd("ui/wine-list.jsx"), E = rd("ui/wine-editor.jsx"), R = rd("ui/ReferenceSection.jsx"), APP = rd("App.jsx");
  it("править могут руководитель, старший и владелец — как коктейли", () => {
    expect(L).toContain('export const canEditWines = (profile) => !!(profile && (profile.is_admin || ["manager", "senior"].includes(profile.position)));');
  });
  it("App: экраны «wines» и «wineEditor», вход из «Справочника»", () => {
    expect(APP).toContain('{screen === "wines" && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><WineListScreen ');
    expect(APP).toContain('{screen === "wineEditor" && <Suspense fallback={<ScreenLoader T={T} />}><WineEditor ');
    expect(APP).toContain('onWines={() => { setRefStart(null); navigate("wines"); }}');
    expect(R).toContain('id: "winelist", t: "Наша винная карта"');
    expect(R).toContain('return n || isLeader ? [');
  });
  it("«Справочник»: у «Нашей винной карты» — свой витраж, как у курсов (владелец: «выглядит как что-то инородное»)", () => {
    expect(R).toContain('{["serving","wine","coffee","cocktails","winelist"].includes(c.id)');
    const A = rd("ui/reference-art.jsx");
    expect(A).toContain("const ART = { serving: Serving, wine: Wine, coffee: Coffee, cocktails: Cocktails, winelist: WineList };");
    expect(A).toMatch(/function WineList\(\{ light \}\) \{[\s\S]*viewBox="0 0 120 120"/);
  });
  it("линза с самого начала: карточки, поля, плашки и стекло; «Справочник» — карточки, значок без витража — линза", () => {
    expect(count(L, 'data-lens-card=""')).toBeGreaterThanOrEqual(2);
    expect(L).toContain('data-lens-field=""');
    expect(E).toContain('data-lens-btn="main" data-wine-new=""');
    expect(E).toContain('data-lens-btn="main" data-wine-save=""');
    expect(E).toContain('data-lens-btn="soft" data-lens-ink="" data-wine-fill=""');
    expect(E).toContain('data-lens-btn="danger" data-wine-del=""');
    expect(count(E, 'data-lens-field=""')).toBeGreaterThanOrEqual(5);
    expect(R).toContain('aria-label={c.t} data-lens-card="" data-ref-card={c.id}');
    expect(R).toContain('<div data-lens="disc" style={T.modIcon}>{c.icon(gold, 24)}</div>');
  });
  it("импорт: фото (несколько снимков, ужимаются до 1800 px), PDF, списком по 15; ошибки — понятным текстом", () => {
    expect(E).toContain('accept="image/*" multiple');
    expect(E).toContain('accept="application/pdf"');
    expect(E).toContain("const BATCH = 15;");
    expect(E).toContain("1800 / Math.max(img.width, img.height)");
    expect(E).toContain('"Сеть недоступна или функция /api/wine-import не развёрнута."');
  });
  it("демо: восемь вин в меню «Двух морей», одно ждёт проверки; AI-импорт в демо — без нейросети", () => {
    const B = rd("tools/claude/demo-app/boot.js");
    expect(count(B.slice(B.indexOf("const DEMO_WINES"), B.indexOf("DEMO_WINES.forEach")), '{ name: "')).toBe(8);
    expect(B).toContain('if (/\\/api\\/wine-import/.test(url))');
  });
});

describe("v120: карточка «Дальше» под пройденной темой — в линзе (владелец: «Ещё пару нашёл. Далее…»)", () => {
  const L = rd("ui/screens-learning.jsx"), LOOK = rd("ui/home-look.jsx");
  it("карточка, номер шага — линза, «Перейти ›» — плашка; «Программа роли пройдена» — тоже", () => {
    expect(L).toContain('data-lens-card="" data-next-card="next" style={{ ...frost,');
    expect(L).toContain('<div data-lens="disc" style={{ width: 36, height: 36, borderRadius: 12,');
    expect(L).toContain('<span data-lens-btn="main" style={{ padding: "9px 14px", borderRadius: 999,');
    expect(L).toContain('data-lens-card="" data-next-card="finish" style={{ ...frost,');
    expect(L).toContain('{f.cta && <button className="sa-btn" data-lens-btn="main" onClick={go}');
    // мелкая подпись на плашке в «Для чтения» — тёмным золотом
    expect(LOOK).toContain('html.sa-lens.sa-light [data-next-card] [data-lens-btn="main"]{color:#6B4E1A!important}');
  });
});

describe("v120: тексты", () => {
  it("без тире-ритма и эмодзи в новых экранах и lib; метка — v120", () => {
    for (const f of ["ui/wine-list.jsx", "ui/wine-editor.jsx", "lib/wine.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(Number((rd("ui/menu-trainer.jsx").match(/· сборка v(\d+)<\/span>/) || [])[1])).toBeGreaterThanOrEqual(120);   // v121: метка дальше
  });
});
