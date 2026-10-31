// v124 (Доп. 437): редактор вин удобнее и красивее; «Вино к блюду», «Опиши за 60 секунд», «Как произносить». Владелец
// (31.10): «И так же, как мы сам редактор можем сделать более удобнее и красивее?». lib/wine.js (GAPS, gapCounts,
// FORM_PARTS, partFill, fieldHints), lib/wine-train.js (dishPairs, pairQuiz, describePoints, describePick),
// ui/wine-editor.jsx (сводка, разделы формы, подсказки, «Сохранить и дальше»), ui/wine-train.jsx (WinePairQuiz,
// WineDescribe60, WineSay), ui/wine-list.jsx (useInnerTop, новые режимы), ui/pronounce.jsx (ownLabel, ownWhere).
// e2e — tools/claude/e2e-v124.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as W from "../lib/wine.js";
import * as R from "../lib/wine-train.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const mk = (o, id, opt = {}) => W.normWine({ ...o }, { id, ...opt });
const CARD = [
  mk({ name: "Шабли", country: "Франция", region: "Бургундия", grapes: ["шардоне"], color: "white", sweet: "сухое", byGlass: true, priceGlass: 950, short: "Свежее", notes: ["мел"], pair: ["d1", "d4"], pairNote: "минеральность к устрицам", img: "https://x.y/abcdefgh.jpg" }, "w-cha"),
  mk({ name: "Пино Нуар", country: "Франция", region: "Бургундия", grapes: ["пино нуар"], color: "red", sweet: "сухое", priceBottle: 6100 }, "w-pin"),
  mk({ name: "Кьянти", country: "Италия", region: "Тоскана", grapes: ["санджовезе"], color: "red", sweet: "сухое", pair: ["d2"] }, "w-chi"),
  mk({ name: "Просекко", country: "Италия", region: "Венето", grapes: ["глера"], color: "sparkling", sweet: "экстра сухое", pair: ["d1"], short: "Пузырьки" }, "w-pro"),
  mk({ name: "Риоха", country: "Испания", region: "Риоха", grapes: ["темпранильо"], color: "red", sweet: "сухое", priceBottle: 5900 }, "w-rio"),
  mk({ name: "Розе", country: "Франция", region: "Прованс", grapes: ["гренаш"], color: "rose", pair: ["d2"] }, "w-ros", { ai: ["grapes"] }),
  mk({ name: "Архив", color: "red", archived: true }, "w-old"),
];
const DISHES = [{ id: "d1", name: "Устрицы", img: "https://x.y/oysters.jpg" }, { id: "d2", name: "Стейк" }, { id: "d3", name: "Тирамису" }, { id: "d4", name: "Тартар" }];

describe("v124: редактор — «Что дописать» и разделы формы", () => {
  it("пробелы карты: без фото, без цены (бутылка или бокал у вина бокалом), без фразы гостю, без блюд; архив не считается", () => {
    expect(W.GAPS.map((g) => g[0])).toEqual(["nophoto", "noprice", "noshort", "nopair"]);
    expect(W.gapCounts(CARD)).toEqual({ nophoto: 5, noprice: 3, noshort: 4, nopair: 2 });
    expect(W.gapTest("noprice")(mk({ name: "x", byGlass: true, priceGlass: 500 }, "a"))).toBe(false);
    expect(W.gapTest("noprice")(mk({ name: "x", byGlass: false, priceGlass: 500 }, "a"))).toBe(true);
    expect(W.gapTest("all")).toBe(null);
  });
  it("разделы формы: «заполнено N из M»; цена бокала считается, только если вино бокалом", () => {
    expect(W.FORM_PARTS.map((p) => p[0])).toEqual(["origin", "serve", "guest", "pair"]);
    expect(W.partFill(CARD[0], "origin")).toEqual({ n: 5, of: 7 });
    expect(W.partFill(CARD[0], "serve")).toEqual({ n: 1, of: 5 });
    expect(W.partFill(CARD[1], "serve")).toEqual({ n: 1, of: 4 });
    expect(W.partFill(CARD[0], "guest")).toEqual({ n: 2, of: 3 });
    expect(W.partFill(CARD[0], "pair")).toEqual({ n: 1, of: 1 });
    // строка формы (сорт строкой) — тоже считается
    expect(W.partFill({ grapes: "шардоне", country: " " }, "origin")).toEqual({ n: 1, of: 7 });
  });
  it("подсказки: страна — сначала из своей карты по частоте, регион — этой страны, сорт — того цвета и без уже вписанных", () => {
    expect(W.fieldHints(CARD, "country").slice(0, 4)).toEqual(["Франция", "Италия", "Испания", "Германия"]);
    expect(W.fieldHints(CARD, "region", { country: "Франция" }).slice(0, 3)).toEqual(["Бургундия", "Прованс", "Бордо"]);
    expect(W.fieldHints(CARD, "region", { country: "франция" })[0]).toBe("Бургундия");
    expect(W.fieldHints(CARD, "region", { country: "Атлантида" })).toEqual([]);
    const g = W.fieldHints(CARD, "grapes", { color: "red", grapes: "пино нуар" });
    expect(g[0]).toBe("санджовезе");
    expect(g).not.toContain("пино нуар");
    expect(g).toContain("каберне совиньон");
    expect(W.fieldHints(CARD, "grapes", { color: "white" })[0]).toBe("шардоне");
    expect(W.fieldHints(CARD, "country").length).toBeLessThanOrEqual(8);
    // архив в подсказки не идёт; само вино (правка) — тоже
    expect(W.fieldHints([mk({ name: "a", country: "Чехия", archived: true }, "x")], "country")[0]).toBe("Франция");
    expect(W.fieldHints([mk({ name: "a", country: "Чехия" }, "x")], "country", { id: "x" })[0]).toBe("Франция");
  });
});

describe("v124: «Вино к блюду»", () => {
  it("пары — из поля «к блюдам» у проверенных вин", () => {
    expect(R.dishPairs(CARD, DISHES).map((x) => x.dish.id + ":" + x.wines.map((w) => w.id).join("+"))).toEqual(["d1:w-cha+w-pro", "d2:w-chi", "d4:w-cha"]);
  });
  it("верное — вино этого блюда; другие вина к нему в варианты не идут; сначала варианты другого цвета", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const qs = R.pairQuiz(CARD, DISHES, { seed });
      expect(qs.length).toBe(3);
      expect(new Set(qs.map((q) => q.id)).size).toBe(3);
      for (const q of qs) {
        const pair = R.dishPairs(CARD, DISHES).find((x) => x.dish.id === q.id);
        const ids = pair.wines.map((w) => w.id);
        expect(ids).toContain(q.wines[q.answer]);
        expect(q.wines.filter((id, i) => i !== q.answer).some((id) => ids.includes(id)), seed + " " + q.dish).toBe(false);
        expect(q.wines).not.toContain("w-ros");
        const right = CARD.find((w) => w.id === q.wines[q.answer]);
        const others = q.wines.filter((id, i) => i !== q.answer).map((id) => CARD.find((w) => w.id === id));
        const diff = R.trainable(CARD).filter((w) => !ids.includes(w.id) && w.color !== right.color).length;
        expect(others.filter((w) => w.color !== right.color).length).toBe(Math.min(diff, others.length));
        expect(q.why.startsWith("К нему в карте: ")).toBe(true);
      }
    }
    const oy = R.pairQuiz(CARD, DISHES, { seed: 5 }).find((q) => q.id === "d1");
    expect(oy.img).toBe("https://x.y/oysters.jpg");
    expect(oy.q).toBe("Гость заказал «Устрицы». Что предложить из вина?");
    expect(R.pairQuiz(CARD, [DISHES[2]], { seed: 1 })).toEqual([]);
  });
  it("пояснение сомелье — с названием вина (не путается с другим блюдом)", () => {
    for (let seed = 1; seed < 80; seed++) for (const q of R.pairQuiz(CARD, DISHES, { seed })) {
      const right = CARD.find((w) => w.id === q.wines[q.answer]);
      if (right.pairNote) expect(q.why).toContain("О «" + W.wineTitle(right) + "»: " + right.pairNote);
    }
  });
});

describe("v124: «Опиши за 60 секунд»", () => {
  it("пункты сверки — только заполненное: откуда, сорт, стиль, ноты, к чему подать, фраза гостю", () => {
    expect(R.describePoints(CARD[0], DISHES).map((p) => p.key + "=" + p.value)).toEqual(["place=Франция, Бургундия", "grape=шардоне", "style=белое сухое", "notes=мел", "pair=Устрицы, Тартар", "short=«Свежее»"]);
    expect(R.describePoints(mk({ name: "x", pairNote: "к мясу" }, "z"), []).map((p) => p.key)).toEqual(["pair"]);
    expect(R.describePoints(null)).toEqual([]);
  });
  it("вино — проверенное, где есть хотя бы три пункта; не то же, что сейчас", () => {
    for (let i = 0; i < 50; i++) {
      const w = R.describePick(CARD, DISHES, "w-cha");
      expect(w && w.id).not.toBe("w-cha");
      expect(["w-ros", "w-old"]).not.toContain(w.id);
    }
    expect(R.describePick([mk({ name: "x", country: "Италия" }, "q")], [])).toBe(null);
  });
});

describe("v124: экраны", () => {
  const E = rd("ui/wine-editor.jsx"), TR = rd("ui/wine-train.jsx"), L = rd("ui/wine-list.jsx"), P = rd("ui/pronounce.jsx");
  it("редактор: сводка (сколько, проверено N из M, «Проверка подряд», «Что дописать» — фильтр списка)", () => {
    for (const s of ["data-wine-sum-card", "data-wine-sum-line", "data-wine-checked={live.length - uncheckedN", "data-wine-review-start={uncheckedN}", "Что дописать", "data-wine-gap={k}",
      "setOnly(only === k ? \"all\" : k)", "gapF ? gapF(w) : true"]) expect(E, s).toContain(s);
    // «Проверка подряд» — внутри сводки, а не отдельной кнопкой под «Новое вино»
    expect(E.indexOf("data-wine-review-start")).toBeLessThan(E.indexOf('data-wine-new=""'));
  });
  it("форма: разделы с «заполнено», цвет перед сортом, подсказки на пустых полях, «Сохранить и дальше»", () => {
    for (const s of ['part("origin"', 'part("serve"', 'part("guest"', 'part("pair"', "data-wine-part-fill", 'hintRow("country")', 'hintRow("region")', 'hintRow("grapes")',
      "data-wine-hint={h}", "data-wine-save-next={nextRec.id}", "Сохранить и дальше ›", "save(false, true)"]) expect(E, s).toContain(s);
    const o = E.indexOf('part("origin"');
    expect(E.indexOf('label("Цвет", "color")', o)).toBeLessThan(E.indexOf('label("Сорт винограда", "grapes")', o));
    expect(E).toContain('label("Бокалом, цена и объём"');
  });
  it("форма и проверка — сверху, список — где был (корень приложения)", () => {
    expect(L).toContain("export function useInnerTop(key, listKey = \"list\")");
    expect(L).toContain('document.getElementById("root")');
    expect(E).toContain('useInnerTop(form ? "form:" + (form.id || form._nid) : rev ? "rev:" + rev.i : "list")');
    expect(L).toContain('useInnerTop(openId ? "card:" + openId');
  });
  it("тренировка: «Вино к блюду», «Опиши за 60 секунд», «Как произносить» (оборот карточки и словарь «Наша карта»)", () => {
    for (const s of ["export function WinePairQuiz", "export function WineDescribe60", "export function WineSay", '"Вино к блюду"', '"Опиши за 60 секунд"', '"Как произносить"', "pairsN >= 2 ? row(\"pair\"",
      "{flip ? <WineSay", "data-wine-point={p.key}", "data-wine-popt={i}"]) expect(TR, s).toContain(s);
    for (const s of ['view === "pair"', 'view === "say60"', 'view === "pron"', 'ownLabel="Наша карта"', 'ownWhere="в карте:"']) expect(L, s).toContain(s);
    expect(P).toContain('ownLabel = "Наше меню", ownWhere = "в блюде"');
    expect(P).toContain("dish: d.label || d.name");
  });
  it("без тире-ритма и эмодзи в новом коде; метка — v124", () => {
    for (const f of ["ui/wine-train.jsx", "lib/wine-train.js", "ui/wine-list.jsx", "ui/wine-editor.jsx", "lib/wine.js", "ui/pronounce.jsx"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v124</span>");
  });
});
