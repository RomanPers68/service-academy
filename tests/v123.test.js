// v123 (Доп. 436): тренировка по винной карте. Владелец (31.10): «Вин будет достаточно и, к большому сожалению, их учить
// очень сложно, особенно для новичка. Может, сделаем как в меню, с тренировками, викторинами и т. д.?». lib/wine-train.js
// (что идёт в тренировку, «Знаю?», новые вина, путь новичка, викторина), ui/wine-train.jsx (колода, викторина, главная
// тренировки), «Учить вина» в винной карте и в тренажёре меню, «Проверка подряд» в редакторе (lib/wine.js: uncheckedQueue,
// reviewRows). e2e — tools/claude/e2e-v123.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as W from "../lib/wine.js";
import * as R from "../lib/wine-train.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const DAY = 864e5, NOW = Date.UTC(2026, 9, 31, 12);
const mk = (o, id, opt = {}) => W.normWine({ ...o }, { id, ...opt });
const CARD = [
  mk({ name: "Шабли", country: "Франция", region: "Бургундия", grapes: ["шардоне"], color: "white", sweet: "сухое", byGlass: true, priceGlass: 950, priceBottle: 6400, short: "Свежее и минеральное", notes: ["зелёное яблоко", "мел"], pair: ["d1"] }, "w-cha"),
  mk({ name: "Кремант де Бургонь", country: "Франция", grapes: ["шардоне", "пино нуар"], color: "sparkling", sweet: "брют", byGlass: true, priceGlass: 800 }, "w-cre"),
  mk({ name: "Бордо Супериор", country: "Франция", region: "Бордо", grapes: ["мерло", "каберне совиньон"], color: "red", sweet: "сухое", priceBottle: 5200 }, "w-bor"),
  mk({ name: "Медок", country: "Франция", region: "Медок", grapes: ["каберне совиньон", "мерло"], color: "red", sweet: "сухое", short: "Плотное, с кедром и чёрной смородиной" }, "w-med"),
  mk({ name: "Кьянти Классико", country: "Италия", region: "Тоскана", grapes: ["санджовезе"], color: "red", sweet: "сухое", byGlass: true, priceGlass: 900, pair: ["d2"] }, "w-chi"),
  mk({ name: "Просекко", country: "Италия", region: "Венето", grapes: ["глера"], color: "sparkling", sweet: "экстра сухое", byGlass: true, priceGlass: 650 }, "w-pro"),
  mk({ name: "Розе Прованс", country: "Франция", region: "Прованс", grapes: ["гренаш"], color: "rose", sweet: "сухое" }, "w-ros", { ai: ["grapes"] }),
  mk({ name: "Старое Риоха", country: "Испания", region: "Риоха", grapes: ["темпранильо"], color: "red", sweet: "сухое", archived: true }, "w-old"),
];
const DISHES = [{ id: "d1", name: "Устрицы" }, { id: "d2", name: "Стейк рибай" }, { id: "d3", name: "Тирамису" }, { id: "d4", name: "Цезарь" }];

describe("v123: что идёт в тренировку", () => {
  it("только живые, с названием и проверенные: «не проверено» (AI) и архив — мимо", () => {
    expect(R.trainable(CARD).map((w) => w.id)).toEqual(["w-cha", "w-cre", "w-bor", "w-med", "w-chi", "w-pro"]);
    expect(R.trainable([...CARD, W.normWine({ name: "" }, { id: "x" })]).length).toBe(6);
    expect(R.trainable(null)).toEqual([]);
    // подтвердил — и вино в тренировке
    expect(R.trainable([W.confirmWine(CARD[6], "Мария")]).length).toBe(1);
  });
  it("normWine хранит addedAt; новое вино с фото бутылки (applyBottles) получает addedAt, прежнее — своё", () => {
    expect(W.normWine({ name: "Гави", addedAt: NOW }).addedAt).toBe(NOW);
    expect(W.normWine({ name: "Гави" }).addedAt).toBe(0);
    const shared = [{ id: "d1", name: "Устрицы" }, { ...CARD[0], addedAt: 5 }];
    const out = W.applyBottles(shared, [{ w: W.normWine({ name: "Гави" }, { id: "wn-gavi" }), plan: { kind: "new", to: "" }, url: "" },
      { w: W.normWine({ name: "Шабли", region: "Шабли" }), plan: { kind: "attach", to: "w-cha" }, url: "" }]);
    expect(W.wineRecords(out).find((x) => x.id === "wn-gavi").addedAt).toBeGreaterThan(Date.now() - 60000);
    expect(W.wineRecords(out).find((x) => x.id === "w-cha").addedAt).toBe(5);
  });
});

describe("v123: новые вина", () => {
  const card = CARD.map((w, i) => ({ ...w, addedAt: i < 2 ? NOW - 3 * DAY : NOW - 90 * DAY }));
  it("новое — добавлено за 30 дней; без addedAt (вина до v123) — прежнее", () => {
    expect(R.isNewWine(card[0], NOW)).toBe(true);
    expect(R.isNewWine(card[3], NOW)).toBe(false);
    expect(R.isNewWine({ ...card[0], addedAt: NOW - 31 * DAY }, NOW)).toBe(false);
    expect(R.isNewWine(CARD[0], NOW)).toBe(false);
  });
  it("«Новые вина» — только проверенные и только когда в карте есть прежние (карту, заведённую целиком, учат с начала)", () => {
    expect(R.newWines(card, NOW).map((w) => w.id)).toEqual(["w-cha", "w-cre"]);
    expect(R.newWines(card.map((w) => ({ ...w, addedAt: NOW - DAY })), NOW)).toEqual([]);
    expect(R.newWines([...card, { ...card[6], id: "w-ros2", addedAt: NOW - DAY }], NOW).map((w) => w.id)).toEqual(["w-cha", "w-cre"]);
  });
  it("«Выучил новые вина» — по списку вин: добавили новое — снова не выучено; старое вышло из новых — выученное держится", () => {
    const fresh = R.newWines(card, NOW);
    expect(R.allLearned(fresh, ["w-cha", "w-cre"])).toBe(true);
    expect(R.allLearned(fresh, ["w-cha"])).toBe(false);
    expect(R.allLearned([...fresh, card[4]], ["w-cha", "w-cre"])).toBe(false);
    expect(R.allLearned(fresh.slice(1), ["w-cha", "w-cre"])).toBe(true);
    expect(R.allLearned([], ["w-cha"])).toBe(false);
    expect(R.learnedKey("Два моря")).toBe("sa_wine_learned_Два моря");
  });
});

describe("v123: «Знаю?» и путь новичка", () => {
  it("знал — следующая ступень 1, 3, 7, 30 дней; не знал — к повтору сейчас", () => {
    let sr = {};
    const due = () => Math.round((sr.a.due - NOW) / DAY);
    sr = R.srMark(sr, "a", true, NOW); expect([sr.a.stage, due()]).toEqual([1, 1]);
    sr = R.srMark(sr, "a", true, NOW); expect([sr.a.stage, due()]).toEqual([2, 3]);
    sr = R.srMark(sr, "a", true, NOW); expect([sr.a.stage, due()]).toEqual([3, 7]);
    sr = R.srMark(sr, "a", true, NOW); expect([sr.a.stage, due()]).toEqual([4, 30]);
    sr = R.srMark(sr, "a", true, NOW); expect([sr.a.stage, due()]).toEqual([4, 30]);
    expect(R.srKnown(sr, "a", NOW)).toBe(true);
    expect(R.srDue(sr, "a", NOW)).toBe(false);
    expect(R.srDue(sr, "a", NOW + 31 * DAY)).toBe(true);
    sr = R.srMark(sr, "a", false, NOW); expect([sr.a.stage, sr.a.due]).toEqual([0, NOW]);
    expect(R.srKnown(sr, "a", NOW)).toBe(false);
    expect(R.srDue({}, "b", NOW)).toBe(true);
    expect(R.srKey("Два моря")).toBe("sa_wine_sr_Два моря");
  });
  it("«С чего начать»: вина бокалом, выучено N из M; «сегодня нет» не считается", () => {
    const sr = R.srMark(R.srMark({}, "w-cha", true, NOW), "w-pro", true, NOW);
    const g = R.glassPath(CARD, sr, NOW);
    expect(g.list.map((w) => w.id)).toEqual(["w-cha", "w-cre", "w-chi", "w-pro"]);
    expect([g.known, g.total]).toEqual([2, 4]);
    const stop = CARD.map((w) => (w.id === "w-cre" ? { ...w, stop: { since: NOW, by: "М" } } : w));
    expect([R.glassPath(stop, sr, NOW).known, R.glassPath(stop, sr, NOW).total]).toEqual([2, 3]);
  });
  it("«Наоборот»: описание без названия, производителя и года; меньше двух подсказок — не в «Наоборот»", () => {
    expect(R.reverseClues(CARD[0])).toEqual(["Франция, Бургундия", "шардоне", "белое сухое", "зелёное яблоко, мел"]);
    expect(R.reverseClues(W.normWine({ name: "Бароло Pio Cesare 2018", producer: "Pio Cesare", vintage: "2018", country: "Италия" })).join(" ")).not.toMatch(/Pio|2018|Бароло/);
    expect(R.reversible(W.normWine({ name: "Х", country: "Италия" }))).toBe(false);
    expect(R.reversible(W.normWine({ name: "Х", country: "Италия", grapes: "неббиоло" }))).toBe(true);
  });
});

describe("v123: викторина по винам", () => {
  const all = (fn) => { for (let seed = 1; seed <= 300; seed++) fn(R.makeQuiz(CARD, DISHES, { n: 10, seed }), seed); };
  it("до 10 вопросов, у вина не больше двух; только проверенные вина; тот же seed — та же викторина", () => {
    all((qs) => {
      expect(qs.length).toBeGreaterThan(5);
      expect(qs.length).toBeLessThanOrEqual(10);
      const per = {}; for (const q of qs) per[q.wine] = (per[q.wine] || 0) + 1;
      expect(Math.max(...Object.values(per))).toBeLessThanOrEqual(2);
      expect(qs.some((q) => q.wine === "w-ros" || q.wine === "w-old")).toBe(false);
      expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
    });
    expect(R.makeQuiz(CARD, DISHES, { seed: 42 })).toEqual(R.makeQuiz(CARD, DISHES, { seed: 42 }));
    expect(R.makeQuiz([CARD[0]], DISHES, { seed: 1 })).toEqual([]);
    expect(R.makeQuiz([CARD[0], CARD[6]], DISHES, { seed: 1 })).toEqual([]);   // второе — не проверено
  });
  it("верный ответ — из карточки вина; варианты без повторов, другого «тоже верного» нет", () => {
    const by = Object.fromEntries(CARD.map((w) => [w.id, w]));
    const kinds = new Set();
    all((qs, seed) => {
      for (const q of qs) {
        kinds.add(q.kind);
        const w = by[q.wine], right = q.options[q.answer];
        expect(new Set(q.options).size, seed + " " + q.q).toBe(q.options.length);
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        if (q.kind === "place") expect(right).toBe([w.country, w.region].filter(Boolean).join(", "));
        if (q.kind === "grape") {
          expect(right).toBe(w.grapes.join(", "));
          for (const o of q.options) if (o !== right) expect(o.split(", ").some((g) => w.grapes.includes(g)), seed + " " + o).toBe(false);
        }
        if (q.kind === "place") for (const o of q.options) if (o !== right) expect(o.startsWith(right) || right.startsWith(o), seed + " " + o).toBe(false);
        if (q.kind === "style") expect(right).toBe(W.COLOR_RU[w.color].toLowerCase() + " " + w.sweet);
        if (q.kind === "phrase") { expect(q.q).toContain(w.short); expect(right).toBe(W.wineTitle(w)); expect(q.img).toBe(""); }
        if (q.kind === "dish") { expect(w.pair.map((id) => DISHES.find((d) => d.id === id).name)).toContain(right); expect(q.options.filter((o) => o !== right).some((o) => w.pair.map((id) => DISHES.find((d) => d.id === id).name).includes(o))).toBe(false); }
        if (q.kind === "glass") { expect(q.options.slice().sort()).toEqual(["Да, бокалом", "Только бутылкой"]); expect(right).toBe(w.byGlass ? "Да, бокалом" : "Только бутылкой"); }
        expect(q.why.length).toBeGreaterThan(3);
      }
    });
    expect([...kinds].sort()).toEqual(["dish", "glass", "grape", "phrase", "place", "style"]);
  });
  it("фото бутылки — у вопроса, кроме «какое вино по фразе» (на этикетке ответ)", () => {
    const pic = CARD.map((w) => ({ ...w, img: "https://photos.e2e/" + w.id + ".jpg" }));
    all(() => {});
    for (let seed = 1; seed < 60; seed++) for (const q of R.makeQuiz(pic, DISHES, { seed })) expect(q.img).toBe(q.kind === "phrase" ? "" : "https://photos.e2e/" + q.wine + ".jpg");
  });
  it("итог: верные и вина с ошибками — по разу", () => {
    const qs = [{ wine: "a", answer: 1 }, { wine: "a", answer: 0 }, { wine: "b", answer: 2 }, { wine: "c", answer: 0 }];
    expect(R.quizScore(qs, [1, 1, 0, 0])).toEqual({ right: 2, total: 4, wrong: ["a", "b"] });
    expect(R.quizScore(qs, [])).toEqual({ right: 0, total: 4, wrong: ["a", "b", "c"] });
  });
});

describe("v123: «Проверка подряд» (lib/wine.js)", () => {
  it("очередь — не проверенные живые вина в порядке карты (цвет, алфавит)", () => {
    const ws = [mk({ name: "Яблочное", color: "white", grapes: "x" }, "w1", { ai: ["grapes"] }), mk({ name: "Брют", color: "sparkling", grapes: "x" }, "w2", { ai: ["grapes"] }),
      mk({ name: "Арбуз", color: "white", grapes: "x" }, "w3", { ai: ["grapes"] }), mk({ name: "Проверено", color: "white" }, "w4"), mk({ name: "Архив", color: "red", grapes: "x", archived: true }, "w5", { ai: ["grapes"] })];
    expect(W.uncheckedQueue(ws)).toEqual(["w2", "w3", "w1"]);
    expect(W.uncheckedQueue([])).toEqual([]);
  });
  it("строки карточки: только заполненное, словами; что дописал AI — помечено", () => {
    const w = mk({ name: "Шабли", producer: "Laroche", country: "Франция", region: "Бургундия", grapes: ["шардоне"], color: "white", sweet: "сухое", abv: "12,5", byGlass: true, priceGlass: 950,
      priceBottle: 6400, volume: "0,75", temp: "8–10 °C", glass: "бургундия", notes: ["яблоко", "мел"], short: "Свежее", story: "Северная Бургундия" }, "x", { ai: ["region", "notes", "priceGlass"] });
    const rows = W.reviewRows(w);
    expect(rows.map((r) => r.key)).toEqual(["producer", "place", "grapes", "style", "abv", "serve", "temp", "notes", "short", "story"]);
    const v = Object.fromEntries(rows.map((r) => [r.key, r.value])), ai = rows.filter((r) => r.ai).map((r) => r.key);
    expect(v).toMatchObject({ place: "Франция, Бургундия", style: "белое сухое", abv: "12,5%", serve: "бокалом 950\u00a0₽ · бутылка 6\u00a0400\u00a0₽ · 0,75", temp: "8–10 °C · бокал «бургундия»", short: "«Свежее»" });
    expect(ai).toEqual(["place", "serve", "notes"]);
    expect(W.reviewRows(mk({ name: "Пусто" }, "y"))).toEqual([]);
    expect(W.reviewRows(null)).toEqual([]);
  });
});

describe("v123: экраны", () => {
  const TR = rd("ui/wine-train.jsx"), L = rd("ui/wine-list.jsx"), E = rd("ui/wine-editor.jsx"), M = rd("ui/menu-trainer.jsx"), APP = rd("App.jsx");
  it("колода: свайп, переворот, «Знаю?» и «Наоборот», фильтры; прогресс и «Знаю?» — по ресторану, режим дня считается", () => {
    for (const s of ['className="sa-ck-wrap"', '"sa-ck-inner" + (settled ? " sa-ck-settled" : "")', 'data-wine-deck-mode="quiz"', "Знаю?", "data-wine-deck-reverse", "Наоборот",
      "data-wine-deck-chip={k}", 'data-wine-mark="ok"', "Знал", "Повторить", "markSr(w.id, ok); bumpDaily(uk);", "useWineSR(restaurant)", "srDue(sr, w.id)", "reversible(w)",
      "Выучил новые вина ✓", "Дальше: вся карта", "выучено {known} из {liveN}"]) expect(TR, s).toContain(s);
    // в «Наоборот» на карточке нет фото: на этикетке название
    expect(TR).toContain("{w.img && !reverse ? <img");
  });
  it("викторина: вопросы один раз на заход, пояснение после ответа, ошибки — к повтору в «Знаю?»", () => {
    for (const s of ["React.useState(() => makeQuiz(wines, dishes, { n: 10 }))", "data-lens-opt=", "data-wine-why", "res.wrong.forEach((id) => markSr(id, false))", "Повторить ошибки", "Ещё раз", "Вопрос {step + 1} из {questions.length}"])
      expect(TR, s).toContain(s);
  });
  it("главная тренировки: новые вина, путь новичка, колода, викторина; не проверенные — руководителю «Проверить подряд»", () => {
    for (const s of ['row("new"', '"Новые вина"', '"С чего начать: вина бокалом"', '"Колода вин"', '"Викторина по винам"', "data-wine-review-open", "Проверить подряд", "ждут проверки руководителем"])
      expect(TR, s).toContain(s);
  });
  it("винная карта: «Учить вина» сверху, вход «@train» сразу в тренировку", () => {
    for (const s of ["data-wine-train-open", "Учить вина", 'startId === "@train"', '<WineTrainHub', '<WineDeck', '<WineQuiz', 'onReview={() => onEdit("@review")}']) expect(L, s).toContain(s);
  });
  it("тренажёр меню: «Винная карта» — вход в тренировку своего ресторана; App ведёт в карту с «@train»", () => {
    expect(M).toContain("data-menu-wines={wn}");
    expect(M).toContain("onWines = null }");
    expect(APP).toContain('onWines={() => { setWineStart("@train"); navigate("wines"); }}');
  });
  it("редактор: «Проверка подряд» (Верно, Исправить, Пропустить, итог), вход «@review»; новое вино и импорт — с addedAt", () => {
    for (const s of ["data-wine-review-start={uncheckedN}", "Проверка подряд", 'startEditId === "@review"', "data-wine-review-ok", "data-wine-review-fix", "data-wine-review-skip",
      "data-wine-review-done", "reviewRows(cur)", "uncheckedQueue(wines)", "if (!form.id && !rec.addedAt) rec.addedAt = Date.now();", "addedAt: x.w.addedAt || Date.now()"]) expect(E, s).toContain(s);
  });
  it("владелец: «Кнопки слиплись» — у кнопок редактора свой отступ сверху не съедается (база без marginTop из T.doneBtn)", () => {
    expect(E).toContain("const { marginTop: _doneTop, ...doneBase } = T.doneBtn;");
    expect(E).toContain('const mainBtn = { ...doneBase, margin: 0,');
    expect(E).toContain('const softBtn = { ...doneBase, margin: 0,');
    expect(E).not.toMatch(/const (mainBtn|softBtn) = \{ \.\.\.T\.doneBtn/);
    // как это ломалось: marginTop стоит раньше margin — в DOM margin: 0 затирает отступ
    const T = { doneBtn: { padding: "14px", marginTop: 24, color: "#fff" } };
    const old = { ...{ ...T.doneBtn, margin: 0 }, marginTop: 10 }, keys = Object.keys(old);
    expect(keys.indexOf("marginTop")).toBeLessThan(keys.indexOf("margin"));
    const { marginTop: _m, ...base } = T.doneBtn, fixed = { ...{ ...base, margin: 0 }, marginTop: 10 }, k2 = Object.keys(fixed);
    expect(k2.indexOf("marginTop")).toBeGreaterThan(k2.indexOf("margin"));
    expect(E).toContain('style={{ ...softBtn, width: "100%", marginTop: 14, padding: "11px", fontSize: 14, color: gold }}>Проверка подряд · {uncheckedN}');
  });
  it("без тире-ритма и эмодзи в новом коде; метка — v123", () => {
    for (const f of ["ui/wine-train.jsx", "lib/wine-train.js", "ui/wine-list.jsx", "ui/wine-editor.jsx", "lib/wine.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(M).toContain("· сборка v123</span>");
  });
});
