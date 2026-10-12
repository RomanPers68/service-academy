// Подбор ситуаций «у стола» к текстовому уроку (Доп. 289) и повтор ошибки (Доп. 293).
import { describe, it, expect } from "vitest";
import { pickForLesson, practicePool, rankSituations, tokensOf } from "../lib/table-pick";
import { practiceRound, sitKey } from "../lib/practice-round";
import { failFits, missText, mistakeFromSituation, practiceQuestionTexts } from "../lib/practice-mistake";
import { SEASONAL_MODULES } from "../data/modules-seasonal";

const mod = {
  id: "m", lessons: [
    { id: "l1", type: "lesson", title: "Аллергены при приёме заказа", content: "Если гость говорит про аллергию — уточни у кухни состав. Аллергия на орехи, арахис, морепродукты." },
    { id: "l2", type: "lesson", title: "Прожарки мяса", content: "Стейк: rare, medium, well done. Спроси о прожарке стейка, если гость не уточнил." },
    { id: "p", type: "practice", title: "Практика", situations: [
      { genre: "action", scene: "Гость заказал стейк и не уточнил прожарку.", question: "Что делаешь?", options: ["Ухожу", "Уточняю прожарку стейка"], correct: 1, win: "Верно", fail: "Нет" },
      { genre: "truefalse", statement: "Про аллергию можно не спрашивать, если гость молчит.", options: ["✅ Верно", "❌ Неверно"], correct: 1, question: "Это верно?", win: "Да", fail: "Нет" },
      { genre: "action", scene: "Гость говорит: «У меня аллергия на арахис».", question: "Твои действия?", options: ["Записываю и иду дальше", "Уточняю у кухни состав и отмечаю аллергию в заказе"], correct: 1, win: "Так", fail: "Нет" },
      { genre: "find", scene: "Коллега опоздал на брифинг.", question: "Чем рискует?", options: ["Ничем", "Не знает стоп-лист"], correct: 1, win: "Да", fail: "Нет" },
      { genre: "action", scene: "Битая ситуация без вариантов", options: [], correct: 0 },
    ] },
  ],
};

describe("подбор ситуаций к уроку", () => {
  it("пул — только ситуации практик раздела с вариантами", () => {
    const pool = practicePool(mod);
    expect(pool.length).toBe(4);
    expect(pool.every((s) => s._from === "p")).toBe(true);
  });
  it("урок про аллергены получает ситуации про аллергию", () => {
    const pick = pickForLesson(mod.lessons[0], practicePool(mod), 2);
    expect(pick.length).toBe(2);
    expect(pick.map((s) => s.scene || s.statement).join(" ")).toMatch(/аллерги/i);
    expect(pick.every((s) => /аллерги/i.test(s.scene || s.statement))).toBe(true);
  });
  it("урок про прожарку — первым идёт стейк", () => {
    const pick = pickForLesson(mod.lessons[1], practicePool(mod), 2);
    expect(pick[0].scene).toMatch(/прожарк/);
  });
  it("жанры по возможности разные", () => {
    const pick = pickForLesson(mod.lessons[0], practicePool(mod), 2);
    expect(new Set(pick.map((s) => s.genre)).size).toBe(2);
  });
  it("детерминированно: тот же урок — те же ситуации", () => {
    const a = pickForLesson(mod.lessons[0], practicePool(mod), 2).map(sitKey);
    const b = pickForLesson(mod.lessons[0], practicePool(mod), 2).map(sitKey);
    expect(a).toEqual(b);
  });
  it("пустой пул — пустой выбор", () => {
    expect(pickForLesson(mod.lessons[0], [], 2)).toEqual([]);
    expect(rankSituations(mod.lessons[0], null)).toEqual([]);
  });
  it("основы слов: «аллергия» и «аллергию» совпадают, служебные слова не считаются", () => {
    const a = tokensOf("аллергия"), b = tokensOf("аллергию");
    expect([...a.keys()].some((k) => b.has(k))).toBe(true);
    expect(tokensOf("гость официант чтобы").size).toBe(0);
  });
  it("на настоящих уроках: у каждого текстового урока с практикой в разделе есть 2 ситуации", () => {
    let lessons = 0;
    for (const m of SEASONAL_MODULES) {
      const pool = practicePool(m);
      if (!pool.length) continue;
      for (const l of m.lessons.filter((x) => x.type === "lesson")) {
        lessons++;
        const p = pickForLesson(l, pool, 2);
        expect(p.length).toBe(2);
        expect(p.every((s) => Array.isArray(s.options) && typeof s.correct === "number")).toBe(true);
      }
    }
    expect(lessons).toBeGreaterThan(30);
  });
});

describe("раунд практики", () => {
  const pool = practicePool(mod).slice(0, 4);
  it("6 ситуаций или сколько есть, новое состояние раунда", () => {
    const r = practiceRound(pool, []);
    expect(r.situations.length).toBe(4);
    expect(r.step).toBe(0);
    expect(r.lives).toBe(3);
    expect(r.done).toBe(false);
  });
  it("показали всё — история с нуля", () => {
    const r = practiceRound(pool, []);
    expect(r.usedIds).toEqual([]);
  });
  it("верный ответ остаётся верным после перемешивания", () => {
    const r = practiceRound(pool, []);
    for (const s of r.situations) {
      const orig = pool.find((o) => sitKey(o) === sitKey(s));
      expect(s.options[s.correct]).toBe(orig.options[orig.correct]);
    }
  });
});

describe("разбор промаха и ошибки практики", () => {
  const sit = { genre: "action", scene: "Гость спрашивает, что взять.", question: "Как поступаешь?", options: ["Угадываю", "«Уточню у шефа»", "«Я новенький, не знаю»"], correct: 1, win: "🎯 Честно и профессионально.", fail: "😬 «Я новенький» — гость потерял доверие." };
  it("fail с цитатой варианта — только для этого варианта", () => {
    expect(failFits(sit.fail, sit.options[2], sit.options)).toBe(true);
    expect(failFits(sit.fail, sit.options[0], sit.options)).toBe(false);
    expect(missText(sit, sit.options[0])).toBe(sit.win);
    expect(missText(sit, sit.options[2])).toBe(sit.fail);
  });
  it("цитата не из вариантов (мысли гостя) и fail без цитат — к любому промаху", () => {
    expect(failFits("💡 Гость думает: «Здесь не рады».", "Ему всё равно", ["Ему всё равно", "Раздражён"])).toBe(true);
    expect(failFits("💡 Неловко вышло.", "что угодно", ["а", "б"])).toBe(true);
  });
  it("время вышло: fail про конкретный вариант не показываем", () => {
    expect(missText(sit, "")).toBe(sit.win);
  });
  it("ситуация → вопрос банка; уборка банка узнаёт его по тексту", () => {
    const m = mistakeFromSituation(sit, { id: "p", title: "Практика" });
    expect(m.from).toBe("practice");
    expect(m.options[m.correct]).toBe("«Уточню у шефа»");
    expect(m.explanation).toBe("Честно и профессионально.");
    const live = practiceQuestionTexts([{ lessons: [{ id: "p", type: "practice", situations: [sit] }] }]);
    expect(live.has(m.q)).toBe(true);
  });
});
