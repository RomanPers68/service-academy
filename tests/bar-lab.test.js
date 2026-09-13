// Сборка руками: сценарии из спеков, проверка действий, мастерство.
import { describe, it, expect } from "vitest";
import { buildScenario, checkAction, recordRun, tierOf, dailyPick, jiggerFor } from "../lib/bar-lab";
import { COCKTAILS } from "../data/cocktails";
import { recToCocktail, withCocktail, cocktailRecords, houseCocktails, isFullCocktail, familyOf, cocktailFaqSmart, FAMILIES } from "../lib/deck-extras";

describe("bar lab", () => {
  it("у каждого из 56 коктейлей есть сценарий: бокал первым, гарниш последним, все ингредиенты внутри", () => {
    for (const c of COCKTAILS) {
      const sc = buildScenario(c, COCKTAILS);
      expect(sc.steps[0].kind).toBe("glass");
      if (c.garnish && c.garnish !== "none") expect(sc.steps[sc.steps.length - 1].kind).toBe("garnish");
      const names = sc.steps.filter(s => s.kind === "ing").map(s => s.name);
      for (const i of c.ing) expect(names).toContain(i[0]);
      expect(sc.station.ings.length).toBeGreaterThanOrEqual(c.ing.length + 1);
      expect(sc.station.glasses).toContain(c.glass);
    }
  });
  it("каждый коктейль собираем до конца тем, что есть на станции и джиггере", () => {
    for (const c of COCKTAILS) {
      const sc = buildScenario(c, COCKTAILS); let done = [];
      for (const s of sc.steps) {
        const action = s.kind === "ing" ? { kind: "ing", name: s.name, amount: s.unit === "мл" ? s.amount : undefined } : { kind: s.kind, id: s.id };
        if (s.kind === "ing" && s.unit === "мл") expect(jiggerFor(c)).toContain(Number(s.amount));
        if (s.kind === "tool") expect(sc.station.tools).toContain(s.id);
        if (s.kind === "garnish") expect(sc.station.garnishes).toContain(s.id);
        const r = checkAction(sc, done, action); expect(r.ok).toBe(true); done = r.doneIdx;
      }
      expect(done.length).toBe(sc.steps.length);
    }
  });
  it("Негрони — как на карточке: всё в рокс со льдом → стир → цедра; лишний ингредиент и ранний гарниш — нет", () => {
    const c = COCKTAILS.find(x => x.id === "negroni"); const sc = buildScenario(c, COCKTAILS);
    let done = [];
    const go = (a) => { const r = checkAction(sc, done, a); if (r.ok) done = r.doneIdx; return r; };
    expect(go({ kind: "garnish", id: "peel" }).ok).toBe(false);
    expect(go({ kind: "glass", id: "rocks" }).ok).toBe(true);
    expect(go({ kind: "ing", name: "Кампари", amount: 30 }).ok).toBe(true);    // порядок внутри фазы свободный
    expect(go({ kind: "ing", name: "Джин", amount: 45 }).ok).toBe(false);       // не тот объём
    expect(go({ kind: "ing", name: "Джин", amount: 30 }).ok).toBe(true);
    expect(go({ kind: "ing", name: "Лимонный сок", amount: 30 }).ok).toBe(false); // чужой
    expect(go({ kind: "ing", name: "Красный вермут", amount: 30 }).ok).toBe(true);
    expect(go({ kind: "tool", id: "stir" }).ok).toBe(false); // по карточке: сначала лёд («всё в рокс с крупным льдом»)
    expect(go({ kind: "ice", id: "cube" }).ok).toBe(true);
    expect(go({ kind: "tool", id: "stir" }).ok).toBe(true);
    const last = go({ kind: "garnish", id: "peel" });
    expect(last.ok && last.done).toBe(true);
  });
  it("карточка и тренажёр — один источник: последовательность детерминирована и у каждого ингредиента объём со спека", () => {
    for (const c of COCKTAILS) {
      const a = buildScenario(c, COCKTAILS).steps.map(s => s.label), b = buildScenario(c, COCKTAILS).steps.map(s => s.label);
      expect(a.join("|")).toBe(b.join("|"));
      for (const s of buildScenario(c, COCKTAILS).steps) if (s.kind === "ing") { const spec = c.ing.find(i => i[0] === s.name); expect(!!spec).toBe(true); expect(Number(s.amount)).toBe(Number(spec[1])); }
    }
  });
  it("мастерство: подсказки → 1, по памяти → 2, три чистых подряд → 3, ошибка сбрасывает серию", () => {
    let m = recordRun({}, "x", "hint", true); expect(m.x.level).toBe(1);
    m = recordRun(m, "x", "memory", true); expect(m.x.level).toBe(2);
    m = recordRun(m, "x", "memory", true); m = recordRun(m, "x", "memory", true); expect(m.x.level).toBe(3);
    m = recordRun(m, "x", "memory", false); expect(m.x.streak).toBe(0); expect(m.x.level).toBe(3);
  });
  it("лестница и коктейль дня", () => {
    expect(tierOf({ ing: [1, 2] })).toBe(1); expect(tierOf({ ing: [1, 2, 3, 4] })).toBe(2); expect(tierOf({ ing: [1, 2, 3, 4, 5] })).toBe(3);
    expect(dailyPick(COCKTAILS, new Date(2026, 8, 9))).toBe(dailyPick(COCKTAILS, new Date(2026, 8, 9)));
    expect(dailyPick(COCKTAILS, new Date(2026, 8, 9))).not.toBe(dailyPick(COCKTAILS, new Date(2026, 8, 10)));
  });
});

describe("редактор коктейлей (Доп. 240)", () => {
  const rec = { id: "ck-1", kind: "cocktail", name: "Океан", base: "джин", glass: "highball", method: "билд", ice: "cube", garnish: "lime", color: ["#5AA7D8", "#2A5F8F"], strength: 2, sweet: 2,
    ing: [["Джин", 40, "мл"], ["Ликёр блю кюрасао", 15, "мл"], ["Сок лайма", 15, "мл"], ["Тоник", 90, "доверху"]], steps: ["Хайбол со льдом", "Джин, кюрасао, лайм", "Тоник доверху, один оборот", "Долька лайма"] };
  it("запись → коктейль → сборка проходится до конца, топпер последним, гарниш в конце", () => {
    const c = recToCocktail(rec); expect(isFullCocktail(c)).toBe(true);
    const sc = buildScenario(c, COCKTAILS); const kinds = sc.steps.map(s => s.kind + (s.name ? ":" + s.name : ""));
    expect(kinds[0]).toBe("glass"); expect(kinds[kinds.length - 1]).toBe("garnish");
    expect(kinds.indexOf("ing:Тоник")).toBeGreaterThan(kinds.indexOf("ing:Джин"));
    let done = []; for (const s of sc.steps) { const r = checkAction(sc, done, s.kind === "ing" ? { kind: "ing", name: s.name, amount: s.unit === "мл" ? s.amount : undefined } : { kind: s.kind, id: s.id }); expect(r.ok).toBe(true); done = r.doneIdx; }
    expect(done.length).toBe(sc.steps.length);
  });
  it("хранится в меню команды рядом с блюдами и картой бара, не смешиваясь", () => {
    const shared = withCocktail([{ id: "d1", name: "Сельдь", cat: "Закуски", ingredients: [] }, { id: "__barcard__", cocktails: ["negroni"] }], rec);
    expect(cocktailRecords(shared).length).toBe(1);
    expect(houseCocktails(shared).filter(isFullCocktail).map(c => c.name)).toEqual(["Океан"]);
    expect(shared.filter(d => d.name === "Сельдь").length).toBe(1);
  });
});

describe("семейства и замены (Доп. 244)", () => {
  it("каждый id в семействах существует; у Негрони родня — Бульвардье; у своего — по составу", () => {
    const ids = new Set(COCKTAILS.map(c => c.id));
    for (const f of FAMILIES) for (const id of f.ids) expect(ids.has(id)).toBe(true);
    const neg = COCKTAILS.find(c => c.id === "negroni"); const fam = familyOf(neg, COCKTAILS);
    expect(fam.items.map(x => x.id)).toContain("boulevardier");
    const house = recToCocktail({ id: "ck-x", name: "Свой сауэр", glass: "sour", method: "шейк", ice: "none", ing: [["Бурбон", 50], ["Сок лимона", 25], ["Сахарный сироп", 15]], steps: ["Всё в шейкер со льдом", "Шейк", "Стрейн"] });
    const f2 = familyOf(house, COCKTAILS); expect(!!f2 && f2.items.length > 0).toBe(true);
  });
  it("«Гость спрашивает» предлагает замену из карты и не предлагает то, что в стопе", () => {
    const neg = COCKTAILS.find(c => c.id === "negroni");
    const faq = cocktailFaqSmart(neg, COCKTAILS.map(c => c.id === "gin-tonic" ? { ...c, stop: { since: 1 } } : c), () => true);
    expect(faq.length).toBeGreaterThan(2);
    for (const f of faq) if (f.go) expect(f.go === "gin-tonic").toBe(false);
  });
});

describe("подписи сборки (Доп. 252)", () => {
  it("нет двух одинаковых подписей подряд и лёд всегда назван льдом", () => {
    for (const c of COCKTAILS) {
      const st = buildScenario(c, COCKTAILS).steps;
      for (let i = 1; i < st.length; i++) expect(st[i].label === st[i - 1].label).toBe(false);
      for (const s of st) if (s.kind === "ice") expect(/лёд|краш/i.test(s.label)).toBe(true);
    }
  });
  it("сосуд — по словам карточки: Олд фэшн собирается в бокале, Манхэттен — в смесительном стакане", () => {
    const of = buildScenario(COCKTAILS.find(c => c.id === "old-fashioned"), COCKTAILS).steps;
    expect(of.find(s => s.kind === "ice").label).toMatch(/в бокал/);
    expect(of.some(s => s.kind === "tool" && s.id === "strain")).toBe(false);
    const mh = buildScenario(COCKTAILS.find(c => c.id === "manhattan"), COCKTAILS).steps;
    expect(mh.find(s => s.kind === "ice").label).toMatch(/смесительн/);
    expect(mh.some(s => s.kind === "tool" && s.id === "strain")).toBe(true);
  });
});

