// v38 (Доп. 351): тесты и практики «у стола» — ответы с подвохом. Верный больше не угадывается по длине
// (было: самый длинный в 80% вопросов тестов и в 97% ситуаций практики), неверные — правдоподобные ловушки
// по теме урока; грамматика и пунктуация вычитаны. Плюс правки в самих вопросах и уроках (запятые, падежи).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { answerTell } from "../lib/answer-tell";
import { SEASONAL_MODULES } from "../data/modules-seasonal";
import { CORE_MODULES } from "../data/modules-core";
import { MANAGER_MODULES } from "../data/modules-manager";
import { SERVICE_MANAGER_MODULES } from "../data/modules-service_manager";
import { SPG_MODULES } from "../data/modules-spg";
import { BAR_MODULES } from "../data/modules-bar";

const ROLES = { seasonal: SEASONAL_MODULES, core: CORE_MODULES, manager: MANAGER_MODULES, service_manager: SERVICE_MANAGER_MODULES, spg: SPG_MODULES, bar: BAR_MODULES };
const quiz = [], practice = [];
for (const [role, mods] of Object.entries(ROLES)) for (const m of mods) for (const l of m.lessons || []) {
  if (l.type === "quiz") l.questions.forEach((q, i) => quiz.push({ tag: `${role}/${l.id} Q${i + 1}`, options: q.options, correct: q.correct, extra: [q.explanation] }));
  for (const [i, s] of (l.situations || []).entries()) if ((s.genre || s.type) !== "truefalse") practice.push({ tag: `${role}/${l.id} P${i + 1}`, options: s.options, correct: s.correct, extra: [s.win, s.fail] });
}
const lens = (it) => it.options.map((o) => String(o).length);
const noticeablyLongest = (it) => { const L = lens(it); return L[it.correct] - Math.max(...L.filter((_, k) => k !== it.correct)) >= 3; };
const noticeablyShortest = (it) => { const L = lens(it); return Math.min(...L.filter((_, k) => k !== it.correct)) - L[it.correct] >= 3; };
const text = (s) => String(s || "");

describe("тесты и практики: верный не угадывается по длине (Доп. 351)", () => {
  it("всё на месте: 917 вопросов тестов и 219 ситуаций практики с вариантами", () => {
    expect(quiz.length).toBe(917);
    expect(practice.length).toBe(219);
    for (const it of [...quiz, ...practice]) {
      expect(it.options.length, it.tag).toBe(4);
      expect(it.correct >= 0 && it.correct < 4, it.tag).toBe(true);
    }
  });
  it("в каждом вопросе варианты почти одной длины, подсказки «по длине» нет", () => {
    for (const it of [...quiz, ...practice]) {
      const L = lens(it), mx = Math.max(...L), mn = Math.min(...L);
      if (mx <= 24) expect(mx - mn, it.tag + " " + L.join("/")).toBeLessThanOrEqual(8);
      else expect(mx / mn, it.tag + " " + L.join("/")).toBeLessThanOrEqual(1.3);
      expect(answerTell(it.options, it.correct), it.tag).toBe(false);
    }
  });
  it("верный заметно длиннее всех — не чаще чем в трети вопросов (было 80% и 97%), заметно короче — тоже не правило", () => {
    for (const list of [quiz, practice]) {
      expect(list.filter(noticeablyLongest).length / list.length).toBeLessThanOrEqual(0.35);
      expect(list.filter(noticeablyShortest).length / list.length).toBeLessThanOrEqual(0.45);
    }
  });
  it("типографика: «ёлочки», длинное тире, без прямых кавычек, двойных пробелов и пробелов перед знаками", () => {
    for (const it of [...quiz, ...practice]) {
      for (const o of [...it.options, ...it.extra.filter(Boolean)]) {
        const t = text(o);
        expect(t, it.tag).not.toMatch(/["\\\n\t]|\s{2,}/);
        expect(t, it.tag).not.toMatch(/[а-яё] - [а-яё]/i);
        expect(t, it.tag).not.toMatch(/[а-яё] [,.!?;:]/i);
        expect((t.match(/«/g) || []).length, it.tag + ": ёлочки").toBe((t.match(/»/g) || []).length);
      }
      // точка в конце — у всех вариантов или ни у одного: иначе верный выдаёт себя знаком
      const dots = it.options.map((o) => /\.$/.test(text(o).replace(/»$/, "")));
      expect(dots.every(Boolean) || !dots.some(Boolean), it.tag + ": точки в конце").toBe(true);
    }
  });
  it("практика: за верный — win, за любой неверный — fail, оба со значком в начале", () => {
    for (const it of practice) {
      const [win, fail] = it.extra;
      expect(text(win).length, it.tag).toBeGreaterThan(5);
      expect(text(fail).length, it.tag).toBeGreaterThan(5);
      expect(text(win), it.tag).toMatch(/^\p{Extended_Pictographic}/u);
      expect(text(fail), it.tag).toMatch(/^\p{Extended_Pictographic}/u);
    }
  });
});

describe("правки в самих вопросах и уроках (Доп. 351)", () => {
  const spg = readFileSync("data/modules-spg.js", "utf8");
  const all = ["modules-seasonal.js", "modules-core.js", "modules-manager.js", "modules-service_manager.js", "modules-spg.js", "modules-bar.js"].map((f) => readFileSync("data/" + f, "utf8")).join("\n");
  it("«служба приёма гостей» — в нужном падеже (было «задача служба», «в служба», «лидерство служба»)", () => {
    expect(spg).not.toMatch(/задача служба|в служба |для служба|лидерство служба|роли служба/);
    expect(spg).toMatch(/Добро пожаловать в службу приёма гостей/);
    expect(spg).toMatch(/Тест: лидерство в службе приёма гостей \(СПГ\)/);
  });
  it("типовые ошибки исправлены: «Позвольте принести», «Постоянный гость», «4,2», «и т. д.»", () => {
    expect(all).not.toMatch(/Позвольте принесу|Постоянник|рейтинг 4\.2|и т\.д\./);
  });
  it("проверка контента (npm run check:content) читает уроки ролей из их файлов и ловит подсказку по длине", () => {
    const src = readFileSync("scripts/check-content.mjs", "utf8");
    expect(src).toMatch(/ROLE_FILES/);
    expect(src).toMatch(/answerTell\(q\.options, q\.correct\)/);
    expect(src).toMatch(/answerTell\(it\.options, it\.correct\)/);
  });
});
