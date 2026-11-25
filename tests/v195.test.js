// v195 (Доп. 520): где ещё верный ответ мог уйти ошибкой. Владелец (25.11): «Проверим остальное на подобные ошибки? Может
// где-то ещё так же засчитывает😉».
//   1. «Работа над ошибками» — порядок вариантов на показ вопроса, «верно» — в момент ответа (банк менялся сам, когда
//      через 8 с приходил ответ из Telegram, варианты перемешивались под выбранным ответом);
//   2. экзамен — набор попытки не пересобирается посреди неё; свои вопросы — только целые;
//   3. свои тесты и ситуации из редактора, «О нас», «Вопрос дня», повтор у стола, кандидат — чистые варианты (lib/utils
//      cleanChoice): без повторов, номер верного числом; редакторы не сохраняют повторы;
//   4. меню и вино — «нет» про аллерген только где точно (safeAbsentAllergens), в вариантах нет одинаковых названий.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v195.mjs.
import { describe, it, expect, afterAll } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

class Mem {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const realLs = globalThis.localStorage;
globalThis.localStorage = new Mem();
afterAll(() => { globalThis.localStorage = realLs; });

import { cleanChoice, cleanQuizQ, hasDupOptions, optKey, shuffleQuizOptions } from "../lib/utils.js";
import { sectionSteps } from "../lib/custom-modules.js";
import { cleanQuestion } from "../lib/concept.js";
import { qdayFits, buildQdayQueue } from "../lib/qday.js";
import { safeAbsentAllergens } from "../lib/menu-sections.js";
import { buildMenuQuiz } from "../lib/menu-quiz.js";
import { allergenQuestion } from "../lib/menu-pack.js";
import { dishFaq } from "../lib/deck-extras.js";
import { pairQuiz, rng } from "../lib/wine-train.js";
import { sitProblem, dlgProblem } from "../ui/content-editor.jsx";
import { MistakesScreen } from "../ui/screens-learning.jsx";
import { ExamScreen } from "../ui/screens-exam.jsx";
import { S } from "../ui/styles.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

describe("v195 · версия и журнал", () => {
  it("сборка v195, Дополнение 520 со словами владельца, e2e-v195 в README инструментов", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(195);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 520 — .*\(v195\)/);
    const part = c.slice(c.indexOf("# Дополнение 520"));
    expect(part.replace(/\s+/g, " ")).toContain("Проверим остальное на подобные ошибки? Может где-то ещё так же засчитывает");
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v195.mjs");
  });
});

describe("v195 · чистые варианты (lib/utils)", () => {
  it("повтор верного варианта убирается, верный остаётся верным; номер строкой — числом", () => {
    expect(cleanChoice(["Старший смены", "Повар", "Старший смены."], 2)).toEqual({ options: ["Старший смены", "Повар"], correct: 0 });
    expect(cleanChoice(["Двоих", "Четверых"], "1")).toEqual({ options: ["Двоих", "Четверых"], correct: 1 });
    expect(cleanChoice(["  Да ", "«да»", "Нет"], 0)).toEqual({ options: ["Да", "Нет"], correct: 0 });
    expect(cleanChoice(["А", "", "Б", "а"], 2)).toEqual({ options: ["А", "Б"], correct: 1 });
    expect(cleanChoice(["Ё-моё", "Е-мое", "Нет"], 1)).toEqual({ options: ["Ё-моё", "Нет"], correct: 0 });
  });
  it("сломанное — null: верного нет, верный пустой, меньше двух разных вариантов, не массив", () => {
    expect(cleanChoice(["А", "Б"], 2)).toBe(null);
    expect(cleanChoice(["А", "Б"], -1)).toBe(null);
    expect(cleanChoice(["А", "Б"], "x")).toBe(null);
    expect(cleanChoice(["", "Б"], 0)).toBe(null);
    expect(cleanChoice(["Да", "да."], 0)).toBe(null);
    expect(cleanChoice(null, 0)).toBe(null);
    expect(cleanQuizQ({ q: " ", options: ["А", "Б"], correct: 0 })).toBe(null);
    expect(cleanQuizQ({ q: "Вопрос?", options: ["А", "Б", "А"], correct: 2, explanation: "x", fixed: true }))
      .toEqual({ q: "Вопрос?", options: ["А", "Б"], correct: 0, explanation: "x", fixed: true });
  });
  it("повторы видны проверкам; ключ без регистра, «ё», кавычек и знаков", () => {
    expect(hasDupOptions(["Да", "Нет", "да!"])).toBe(true);
    expect(hasDupOptions(["Да", "Нет", ""])).toBe(false);
    expect(hasDupOptions(["Правда", "Миф"])).toBe(false);
    expect(optKey("  «Ёлка», да!  ")).toBe("елка да");
  });
  it("перемешивание чистого вопроса: верный тот же текст при любом порядке", () => {
    const q = cleanQuizQ({ q: "Кто?", options: ["Старший смены", "Повар", "Старший смены"], correct: 2 });
    for (let i = 0; i < 30; i++) { const s = shuffleQuizOptions(q); expect(s.options[s.correct]).toBe("Старший смены"); expect(s.options).toHaveLength(2); }
  });
});

describe("v195 · свои разделы, «О нас», «Вопрос дня»", () => {
  const rec = { id: 7, role: "spg", module: "Свой", title: "Урок", content: "Текст", sort: 1, questions: [
    { q: "Кто главный?", options: ["Старший смены", "Повар", "Старший смены."], correct: 2, explanation: "" },
    { q: "Сколько гостей?", options: ["Двоих", "Четверых"], correct: "1" },
    { q: "Сломанный?", options: ["А", "Б"], correct: 5 },
    { kind: "situation", genre: "action", scene: "Гость ждёт", question: "Что делаешь?", options: ["Подхожу", "Жду", "Подхожу."], correct: 2 },
    { kind: "situation", genre: "truefalse", statement: "Хлеб ставим слева", isTrue: true, correct: 1, options: ["✅ Верно", "❌ Неверно"] },
    { kind: "situation", genre: "truefalse", statement: "Без вариантов", isTrue: false },
  ] };
  const steps = sectionSteps("Свой", [rec], "spg", "#C8A96E");
  const quiz = steps.find((s) => s.type === "quiz"), prac = steps.find((s) => s.type === "practice");
  it("тест: повтор убран, номер — числом, сломанный вопрос не показывается; номера шагов прежние", () => {
    expect(quiz.id).toBe("cms-q-7");
    expect(prac.id).toBe("cms-p-7");
    expect(quiz.questions.map((q) => [q.q, q.options, q.correct])).toEqual([
      ["Кто главный?", ["Старший смены", "Повар"], 0], ["Сколько гостей?", ["Двоих", "Четверых"], 1]]);
  });
  it("практика: повтор убран; «правда или миф» — верный по isTrue (его видит владелец), варианты — пара «верно, неверно»", () => {
    expect(prac.situations).toHaveLength(3);
    expect(prac.situations[0]).toMatchObject({ options: ["Подхожу", "Жду"], correct: 0 });
    expect(prac.situations[1]).toMatchObject({ isTrue: true, correct: 0, options: ["✅ Верно", "❌ Неверно"] });
    expect(prac.situations[2]).toMatchObject({ isTrue: false, correct: 1, options: ["Верно", "Неверно"] });
  });
  it("редактор раздела получает вопросы как в базе (чистка — только в игре)", () => {
    expect(rd("lib/custom-modules.js")).toContain('quiz: all.filter(q => !(q && ["situation", "dialogue", "build", "review", "skill"].includes(q.kind))),');
  });
  it("«О нас»: повтор варианта убирается, два одинаковых — вопрос не годится", () => {
    expect(cleanQuestion({ q: "Год основания?", options: ["2015", "2018", "2015 "], correct: 2 })).toEqual({ q: "Год основания?", options: ["2015", "2018"], correct: 0, explanation: "" });
    expect(cleanQuestion({ q: "Год?", options: ["2015", "2015."], correct: 0 })).toBe(null);
  });
  it("«Вопрос дня»: с повтором вариантов в чат не идёт", () => {
    expect(qdayFits({ q: "Кто?", options: ["А", "Б", "а"], correct: 0 })).toBe(false);
    expect(qdayFits({ q: "Кто?", options: ["А", "Б"], correct: 0 })).toBe(true);
    const items = buildQdayQueue({ mistakeBank: [{ q: "Кто?", options: ["А", "Б", "а"], correct: 0, due: 0 }, { q: "Где?", options: ["Тут", "Там"], correct: 1, due: 0 }], day: "2026-11-25" });
    expect(items.map((x) => x.q)).toEqual(["Где?"]);
  });
});

describe("v195 · «Работа над ошибками», экзамен, урок-тест, кандидат", () => {
  it("«Работа над ошибками»: порядок — на показ вопроса, «верно» — в момент ответа", () => {
    const L = rd("ui/screens-learning.jsx");
    expect(L).toContain("const showKey = base ? JSON.stringify([base.q, base.options, base.correct, shown]) : \"\";");
    expect(L).toContain("const q = React.useMemo(() => shuffleQuizOptions(base), [showKey]);");
    expect(L).toContain("const pick = pickRec && pickRec.at === showKey ? pickRec.i : null;");
    expect(L).toContain("const wasCorrect = pickRec.ok;");
    expect(L).toContain("setPickRec(null); setShown((n) => n + 1);");
    expect(L).toContain('{pickOk ? "Верно, убрать ✓" : "Дальше →"}');
    expect(L).not.toContain("React.useMemo(() => shuffleQuizOptions(bank[Math.min(idx, bank.length - 1)]), [bank, idx])");
  });
  it("«Работа над ошибками» показывает варианты без повтора", () => {
    const bank = [{ q: "Кто главный?", options: ["Старший смены", "Повар", "Старший смены"], correct: 2, explanation: "", lessonTitle: "Свой", stage: 0, due: 1 }];
    const html = R(h(MistakesScreen, { T: S, a11y: false, mistakeBank: bank, onResolve: () => {}, onFail: () => {}, onBack: () => {} }));
    expect((html.match(/class="sa-opt"/g) || []).length).toBe(2);
    expect((html.match(/Старший смены/g) || []).length).toBe(1);
  });
  it("экзамен: набор попытки держится; новый — до первого ответа и на пересдаче; свои вопросы — только целые", () => {
    const E = rd("ui/screens-exam.jsx");
    expect(E).toContain("const [questions, setQuestions] = React.useState(draw);");
    expect(E).toContain("if (phase === \"quiz\" && step === 0 && picked === null) setQuestions(draw());");
    expect(E).toContain("<button onClick={() => { setQuestions(draw()); setStep(0); setPicked(null); setCorrectCount(0); setPhase(\"quiz\"); }}");
    expect(E).not.toMatch(/useMemo\(\(\) => shuffleArray\(\[\.\.\.pool\]\)/);
    const extra = [{ q: "Свой вопрос?", options: ["Да", "Нет", "да"], correct: 2 }, { kind: "review", text: "отзыв" }, { q: "Битый?", options: ["А"], correct: 0 }];
    const html = R(h(ExamScreen, { T: S, a11y: false, roleObj: { label: "Тест", color: "#C8A96E" }, roleId: "нет-такой-роли", extraQuestions: extra, onFinish: () => {}, onExit: () => {} }));
    expect(html).toContain("1 / 1");
    expect(html).toContain("Свой вопрос?");
    expect((html.match(/<button[^>]*>(Да|Нет)<\/button>/g) || []).length).toBe(2);
  });
  it("урок-тест: чистые варианты и общий shuffleQuizOptions; кандидат: свои вопросы — чистые", () => {
    const app = rd("App.jsx");
    expect(app).toContain("const withShuffled = picked.map((q) => shuffleQuizOptions(cleanQuizQ(q) || q));");
    expect(app).not.toContain("const shuffledOpts = shuffleArray(opts);");
    expect(rd("ui/candidate.jsx")).toContain("const q = q0 && !q0.kind ? cleanQuizQ(q0) : null;");
    expect(rd("ui/table.jsx")).toContain('q: shuffleQuizOptions(cleanQuizQ(bankItem) || bankItem) });');
  });
});

describe("v195 · редакторы не сохраняют повторы", () => {
  it("ситуация, живой диалог, вопрос теста, сборка, «О нас»", () => {
    expect(sitProblem({ genre: "action", scene: "Гость ждёт", options: ["Подхожу", "Жду", "подхожу!"], correct: 0 }))
      .toBe("варианты повторяются: оставь один, вместо второго напиши другой.");
    expect(sitProblem({ genre: "action", scene: "Гость ждёт", options: ["Подхожу", "Жду"], correct: 0 })).toBe(null);
    const dl = { guest: { name: "Ольга" }, steps: [{ type: "guest", text: "Позовите менеджера!" },
      { type: "choice", prompt: "Что ответишь?", options: [{ text: "Сейчас позову", correct: true }, { text: "сейчас позову.", correct: false }] }] };
    expect(dlgProblem(dl)).toBe("Живой диалог, шаг 2: ответы повторяются.");
    const ed = rd("ui/content-editor.jsx");
    expect(ed).toContain("if (hasDupOptions(q.options)) return `Вопрос ${i + 1}: варианты повторяются. Оставь один, а вместо второго напиши другой.`;");
    expect(ed).toContain("if (hasDupOptions(st.options.map(o => o.t))) return `Сборка, шаг ${i + 1}: варианты повторяются.`;");
    expect(rd("ui/concept.jsx")).toContain("if (dup >= 0) { setErr(`Вопрос ${dup + 1}: варианты повторяются. Оставь один, а вместо второго напиши другой.`); return; }");
  });
});

describe("v195 · меню и вино", () => {
  it("«нет» про аллерген — только где точно: не отмечен, не подсказан составом, названием, описанием; пустая карточка — ничего", () => {
    expect(safeAbsentAllergens({ name: "Пицца", ingredients: [], allergens: [] })).toEqual([]);
    const syr = safeAbsentAllergens({ name: "Сырники со сметаной", ingredients: ["творог"], allergens: ["Глютен", "Яйца"] });
    expect(syr).not.toContain("Молоко");
    expect(syr).not.toContain("Глютен");
    expect(syr).toContain("Рыба");
    const pasta = safeAbsentAllergens({ name: "Паста с томатами", ingredients: ["томаты", "базилик"], allergens: [] });
    expect(pasta).not.toContain("Глютен");
    expect(safeAbsentAllergens({ name: "Морс", ingredients: ["клюква", "вода"], allergens: [], desc: "с орешками кешью" })).not.toContain("Орехи");
  });
  it("вопрос дня о блюде и «Гость спрашивает»: «нет» не про подсказанное названием", () => {
    const d = { id: "d1", name: "Сырники", ingredients: ["яйца", "мука", "сахар"], allergens: ["Глютен", "Яйца", "Соя"] };
    for (let i = 0; i < 40; i++) {
      const q = allergenQuestion(d, rng(i + 1));
      if (q.correct === 1) expect(q.q).not.toMatch(/молоко/);
    }
    const faq = dishFaq({ id: "x", name: "Сырники", ingredients: ["творог"], allergens: ["Яйца"] });
    expect(faq.map((x) => x.a).join(" ")).not.toMatch(/Лактоза \(молоко\) — в составе нет/);
    const empty = dishFaq({ id: "y", name: "Пицца", ingredients: [], allergens: [] });
    expect(empty.map((x) => x.a).join(" ")).not.toMatch(/в составе нет/);
  });
  it("викторина по меню: в вариантах нет двух блюд с одним названием", () => {
    const dishes = [
      { id: 1, name: "Борщ", cat: "Супы", ingredients: ["свёкла", "говядина", "капуста"], allergens: [], pairing: "Пампушки с чесноком и салом" },
      { id: 2, name: "Борщ", cat: "Ланч", ingredients: ["свёкла", "фасоль"], allergens: [], pairing: "Бородинский хлеб и сало" },
      { id: 3, name: "Солянка", cat: "Супы", ingredients: ["колбаса", "оливки", "лимон"], allergens: [], pairing: "Бородинский хлеб и сметана" },
      { id: 4, name: "Уха", cat: "Супы", ingredients: ["судак", "картофель"], allergens: ["Рыба"], pairing: "Рюмка холодной водки" },
      { id: 5, name: "Окрошка", cat: "Супы", ingredients: ["квас", "огурец", "редис"], allergens: [], pairing: "Ржаные гренки с чесноком" },
      { id: 6, name: "Цезарь", cat: "Салаты", ingredients: ["курица", "романо", "пармезан"], allergens: ["Молоко"], pairing: "Бокал шардоне" },
    ];
    for (let s = 1; s <= 60; s++) {
      for (const q of buildMenuQuiz(dishes, { total: 20, rnd: rng(s) })) {
        const k = q.options.map((o) => String(o).toLowerCase());
        expect(new Set(k).size, JSON.stringify(q)).toBe(k.length);
      }
    }
  });
  it("вино к блюду: в вариантах нет вина с тем же названием, что у верного", () => {
    const wines = [{ id: "w1", name: "Шабли", color: "white", pair: ["d1"] }, { id: "w2", name: "Шабли", color: "white" },
      { id: "w3", name: "Бароло", color: "red" }, { id: "w4", name: "Риоха", color: "red" }, { id: "w5", name: "Сансер", color: "white" }];
    for (let s = 1; s <= 40; s++) {
      const [q] = pairQuiz(wines, [{ id: "d1", name: "Устрицы" }], { seed: s });
      expect(q.options.filter((t) => t === "Шабли")).toHaveLength(1);
      expect(q.options[q.answer]).toBe("Шабли");
    }
  });
  it("аллергены на скорость: в игре только блюда, о которых можно спросить честно", () => {
    const D = rd("ui/menu-deck.jsx");
    expect(D).toContain("const pool = React.useMemo(() => (dishes || []).filter(d => d && d.name && ((d.allergens || []).length || safeAbsentAllergens(d, ALL_AL).length)), [dishes]);");
    expect(D).toContain("const safeAbsent = safeAbsentAllergens(d, ALL_AL);");
    expect(D).not.toContain("|| als[0] || ALL_AL[0]");
    expect(D).toContain('"Нужно три блюда с составом или аллергенами"');
  });
});
