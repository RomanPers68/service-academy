// v40: редактор контента догоняет штатные практики и диалоги.
//   • практика — все шесть видов, как в приложении: «Что делаешь?», «Найди ошибку», «Глазами гостя»,
//     «Правда или миф», «Собери правило», «Быстрое решение» — у каждого свои поля, проверки и формат
//     сохранения, тот же, что у штатных ситуаций (data/modules-*.js);
//   • «Как увидит сотрудник» — «Сыграть практику» и «Сыграть диалог» на настоящих экранах, без записи;
//   • диалог — своя фраза и заголовок, когда гость уходит (guest.walk / guest.walkTitle);
//   • ИИ-помощник урока — ситуации всех шести видов по правилам docs/ОТВЕТЫ-С-ПОДВОХОМ.md.
// В браузере: /home/claude/preview/e2e-v40-editor.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToString } from "react-dom/server";
import { sanitize, PROMPT, SIT_GENRES } from "../api/lesson-assist";
import { buildCustomModules, sectionSteps } from "../lib/custom-modules";
import { dlgWalkLine, dlgWalkText, LiveDialogue } from "../ui/screens-dialogue";
import { answerTell } from "../lib/answer-tell";
import { mistakeFromSituation } from "../lib/practice-mistake";
import { SEASONAL_MODULES } from "../data/modules-seasonal";
import { S } from "../ui/styles";

// Шины для рендера экранов в node — как в tests/smoke-render.test.jsx
const store = {};
if (typeof globalThis.localStorage === "undefined") globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: (i) => Object.keys(store)[i] || null, get length() { return Object.keys(store).length; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const read = (p) => readFileSync(p, "utf8");   // от корня проекта
const R = (el) => renderToString(el).replace(/<!-- -->/g, "");
const noop = () => {};
const ed = () => import("../ui/content-editor");

// черновик раздела: по ситуации каждого вида, как их набирает руководитель
const DRAFT_SITS = [
  { genre: "action", emoji: "🔥", scene: "Менеджера нет, гость требует скидку.", question: "Что делаешь?", options: ["Зову старшего смены", "Даю скидку сам", ""], correct: 0, win: "🎯 Решает старший", fail: "💡 Скидки — не твоё решение" },
  { genre: "find", emoji: "⚠️", scene: "Новичок спорит со старшим при гостях.", question: "Что не так?", options: ["Спор при гостях", "Новичок говорит громко"], correct: 0, win: "🎯 Да", fail: "💡 Не при гостях" },
  { genre: "empathy", emoji: "", guestThought: "  «Я уже десять минут без меню…»  ", scene: "Официант занят большим столом.", question: "Что чувствует гость и что сделать?", options: ["Раздражён: подойти сразу", "Спокоен: подойти позже"], correct: 0, win: "🎯", fail: "💡" },
  { genre: "truefalse", emoji: "🃏", statement: "«Приборы можно выносить голыми руками»", isTrue: false, options: ["", ""], correct: 0, win: "🎯 Так нельзя", fail: "💡 Только в салфетке" },
  { genre: "complete", emoji: "🔗", start: "Если сомневаешься, подходить ли к гостю, —", options: ["подойди: лучше раньше", "подожди: гость позовёт"], correct: 0, win: "🎯", fail: "💡" },
  { genre: "timer", emoji: "⚡", scene: "Гость поднял руку, у тебя горячее.", question: "Что делаешь?", options: ["Киваю и подхожу после подачи", "Ставлю горячее на соседний стол"], correct: 0, win: "🎯", fail: "💡" },
];
const builtIn = (g) => SEASONAL_MODULES.flatMap((m) => m.lessons).flatMap((l) => l.situations || []).find((s) => (s.genre || s.type) === g);

describe("практика: шесть видов, как в приложении (v40)", () => {
  it("в редакторе — все шесть видов, их подписи и вопросы по умолчанию", async () => {
    const { GENRES, SIT_Q } = await ed();
    expect(GENRES.map((g) => g[0])).toEqual(["action", "find", "empathy", "truefalse", "complete", "timer"]);
    expect(GENRES.map((g) => g[1])).toEqual(["Что делаешь?", "Найди ошибку", "Глазами гостя", "Правда или миф", "Собери правило", "Быстрое решение"]);
    expect(SIT_Q.find).toBe("Что не так?");
    expect(SIT_Q.empathy).toBe("Что чувствует гость и что сделать?");
    expect(SIT_Q.truefalse).toBe("Это верно?");
    expect(SIT_Q.complete).toBe("Выбери правильное продолжение:");
    // те же виды играет «у стола» (ui/table.jsx) и ИИ-помощник
    const table = read("ui/table.jsx");
    for (const g of GENRES.map((x) => x[0])) expect(table).toMatch(new RegExp("const PLACE = \\{[^}]*\\b" + g + ":"));
    expect(SIT_GENRES).toEqual(GENRES.map((g) => g[0]));
  });
  it("сохранение — ровно формат штатных ситуаций: у каждого вида свой набор полей", async () => {
    const { toDraftSit, sitOut } = await ed();
    for (const s of DRAFT_SITS) {
      const out = sitOut(toDraftSit(s));
      const { kind, ...rest } = out;
      expect(kind).toBe("situation");
      expect(Object.keys(rest).sort(), s.genre).toEqual(Object.keys(builtIn(s.genre)).sort());
      expect(out.options[out.correct], s.genre).toBeTruthy();
    }
  });
  it("правда/миф: утверждение, ответ и служебные «✅ Верно / ❌ Неверно», как у штатных", async () => {
    const { toDraftSit, sitOut } = await ed();
    const out = sitOut(toDraftSit(DRAFT_SITS[3]));
    expect(out).toEqual({ kind: "situation", genre: "truefalse", emoji: "🃏", statement: "Приборы можно выносить голыми руками", isTrue: false, correct: 1,
      question: "Это верно?", options: ["✅ Верно", "❌ Неверно"], win: "🎯 Так нельзя", fail: "💡 Только в салфетке" });
    expect(sitOut(toDraftSit({ ...DRAFT_SITS[3], isTrue: true })).correct).toBe(0);
    // обратно в карточку: служебные варианты не становятся «своими», ответ на месте
    const back = toDraftSit(out);
    expect(back.options).toEqual(["", ""]);
    expect(back.isTrue).toBe(false);
    // штатная правда/миф без isTrue — ответ по correct
    expect(toDraftSit({ genre: "truefalse", statement: "x", correct: 0, options: ["✅ Верно", "❌ Неверно"] }).isTrue).toBe(true);
    // в «Работу над ошибками» — как штатная: «Правда / Миф», верный — «Миф»
    const m = mistakeFromSituation(out, { id: "cms-p-1", title: "Практика" });
    expect(m.options).toEqual(["Правда", "Миф"]);
    expect(m.options[m.correct]).toBe("Миф");
  });
  it("глазами гостя, собери правило, остальные: свои поля, пустые варианты убраны, верный сдвинут", async () => {
    const { toDraftSit, sitOut } = await ed();
    const em = sitOut(toDraftSit(DRAFT_SITS[2]));
    expect(em.guestThought).toBe("Я уже десять минут без меню…");   // ёлочки ставит экран
    expect(em.scene).toBe("Официант занят большим столом.");
    const co = sitOut(toDraftSit(DRAFT_SITS[4]));
    expect(co.start).toBe("Если сомневаешься, подходить ли к гостю, —");
    expect(co.question).toBe("Выбери правильное продолжение:");
    expect("scene" in co || "guestThought" in co || "statement" in co).toBe(false);
    const ac = sitOut(toDraftSit({ ...DRAFT_SITS[0], options: ["", "Даю скидку сам", "Зову старшего смены"], correct: 2 }));
    expect(ac.options).toEqual(["Даю скидку сам", "Зову старшего смены"]);
    expect(ac.correct).toBe(1);
    // мысли гостя — только в «глазами гостя» (правило 9): у других видов поле не сохраняется
    expect("guestThought" in sitOut(toDraftSit({ ...DRAFT_SITS[0], guestThought: "думает" }))).toBe(false);
    // пустой вопрос — вопрос вида по умолчанию
    expect(sitOut(toDraftSit({ ...DRAFT_SITS[1], question: "  " })).question).toBe("Что не так?");
  });
  it("смена вида не теряет набранное; вопрос по умолчанию меняется, свой — остаётся", async () => {
    const { toDraftSit, switchGenre, sitOut } = await ed();
    const a = toDraftSit({ ...DRAFT_SITS[0], question: "Как поступишь?" });
    const tf = switchGenre(a, "truefalse");
    expect(tf.scene).toBe(a.scene);
    expect(tf.options).toEqual(a.options);
    const tfOut = sitOut({ ...tf, statement: "Скидку даёт старший", isTrue: true });
    expect("scene" in tfOut).toBe(false);
    expect(tfOut.options).toEqual(["✅ Верно", "❌ Неверно"]);
    const back = switchGenre(tf, "action");
    expect(back.question).toBe("Как поступишь?");
    expect(sitOut(back)).toEqual(sitOut(a));
    // вопрос по умолчанию (и прежний «В чём ошибка?») — на вопрос нового вида
    const f = switchGenre(toDraftSit(DRAFT_SITS[0]), "find");
    expect(f.question).toBe("Что не так?");
    expect(switchGenre({ ...f, question: "В чём ошибка?" }, "empathy").question).toBe("Что чувствует гость и что сделать?");
    expect(switchGenre(switchGenre(f, "complete"), "timer").question).toBe("Что делаешь?");
  });
  it("проверки по видам — понятными словами", async () => {
    const { toDraftSit, sitProblem } = await ed();
    for (const s of DRAFT_SITS) expect(sitProblem(toDraftSit(s)), s.genre).toBeNull();
    const P = (s) => sitProblem(toDraftSit(s));
    expect(P({ ...DRAFT_SITS[2], guestThought: " " })).toBe("нужны мысли гостя.");
    expect(P({ ...DRAFT_SITS[2], scene: "" })).toBe("нужна сцена.");
    expect(P({ ...DRAFT_SITS[0], scene: "" })).toBe("нужна сцена.");
    expect(P({ ...DRAFT_SITS[3], statement: "" })).toBe("нужно утверждение.");
    expect(P({ ...DRAFT_SITS[3], isTrue: null })).toBe("отметь, правда это или миф.");
    expect(P({ ...DRAFT_SITS[4], start: "" })).toBe("нужно начало правила.");
    expect(P({ ...DRAFT_SITS[4], start: "Что делать, если гость сомневается?" })).toMatch(/не вопрос/);
    expect(P({ ...DRAFT_SITS[4], start: "Ядро думает не о себе, а:" })).toMatch(/обрывается на «а:»/);
    expect(P({ ...DRAFT_SITS[4], start: "Сомневаешься, подходить ли, — он:" })).toMatch(/«он:»/);
    expect(P({ ...DRAFT_SITS[4], start: "Метод «Ёлочка» означает:" })).toBeNull();   // двоеточие после слова — можно
    expect(P({ ...DRAFT_SITS[5], options: ["Киваю", ""] })).toBe("нужно хотя бы два варианта.");
    expect(P({ ...DRAFT_SITS[1], correct: 2, options: ["Спор при гостях", "Громко", ""] })).toBe("отметь верный вариант.");
    // правде/мифу варианты не нужны
    expect(P({ ...DRAFT_SITS[3], options: [] })).toBeNull();
    // сообщения встают в «Ситуация N: …» и ведут к карточке (как раньше)
    const src = read("ui/content-editor.jsx");
    expect(src).toMatch(/return `Ситуация \$\{i \+ 1\}: \$\{sp\}`;/);
    expect(src).toMatch(/\[\/\^Ситуация \(\\d\+\):\/, "sit", draft\.situations\]/);
  });
  it("длина: «угадают по длине» — и у практики (кроме правды/мифа); у диалога и теста — как в v37", () => {
    const src = read("ui/content-editor.jsx");
    expect((src.match(/data-len-tell=""/g) || []).length).toBe(2);
    expect(src).toMatch(/\{g !== "truefalse" \? \(<>[\s\S]*answerTell\(x\.options, x\.correct\) \? <div data-len-tell="sit"/);
    expect(answerTell(["Подойду, извинюсь за ожидание и сразу принесу меню гостю", "Подойду позже", "Позову коллегу"], 0)).toBe(true);
  });
  it("подсказки в карточке — по правилам «Ответов с подвохом» (8–9)", () => {
    const src = read("ui/content-editor.jsx");
    expect(src).toMatch(/empathy: "Мысли гостя есть только в этом виде, и они совпадают со сценой/);   // v74: без тире
    expect(src).toMatch(/complete: "Начало и любой вариант читаются как одно предложение: без вопроса в конце начала и без двоеточия после «а», «в», «он»\."/);
    expect(src).toMatch(/find: "В сцене сотрудник ошибается\. Спроси, что не так\."/);   // v74: без «а не»
    expect(src).toMatch(/Читается так:/);
  });
});

describe("из редактора — в приложение: ничего не срезается (v40)", () => {
  it("lib/custom-modules: все поля всех видов доходят до практики раздела; диалог — с уходом гостя", async () => {
    const { toDraftSit, serializeExtras } = await ed();
    const draft = { questions: [], situations: DRAFT_SITS.map(toDraftSit), build: null, review: null, skills: [],
      dialogue: { tip: "Старший решает", guest: { name: "Ольга", avatar: "👩", context: "Требует менеджера", mood: 3, walk: "  Ольга молча уходит к выходу.  ", walkTitle: " Ольга ушла к конкурентам " },
        steps: [{ id: "a", type: "guest", text: "Позовите менеджера!" }, { id: "b", type: "choice", prompt: "Что ответишь?", options: [
          { text: "Сейчас позову старшего смены", correct: true, feedback: "Да", moodDelta: 1 }, { text: "Менеджера нет", correct: false, feedback: "Холодно", moodDelta: -1 }] }] } };
    const questions = serializeExtras(draft);
    const mods = buildCustomModules([{ id: 7, role: "seasonal", module: "Субординация", title: "Кто главный", content: "Старший смены отвечает за зал.", questions }], "seasonal", { color: "#7C9E87" });
    const pr = mods[0].lessons.find((l) => l.type === "practice");
    expect(pr.situations).toEqual(questions.filter((q) => q.kind === "situation").map(({ kind, ...x }) => x));
    expect(pr.situations.map((s) => s.genre)).toEqual(["action", "find", "empathy", "truefalse", "complete", "timer"]);
    const dl = mods[0].lessons.find((l) => l.type === "dialogue").dialogue;
    expect(dl.guest.walk).toBe("Ольга молча уходит к выходу.");
    expect(dl.guest.walkTitle).toBe("Ольга ушла к конкурентам");
    expect(dlgWalkLine(dl.guest)).toBe("Ольга молча уходит к выходу.");
    expect(dl.steps[dl.steps.length - 1]).toEqual({ type: "result", tip: "Старший решает" });   // v75: без ✦ в начале итога
  });
  it("уход гостя — в guest, только если написан; старые диалоги сохраняются как раньше", async () => {
    const { serializeExtras } = await ed();
    const d = (guest) => serializeExtras({ questions: [], situations: [], build: null, review: null, skills: [], dialogue: { tip: "", guest, steps: [{ type: "guest", text: "Здравствуйте" }] } }).find((q) => q.kind === "dialogue").guest;
    expect(d({ name: " Михаил ", avatar: "👔", context: "", mood: 3 })).toEqual({ name: "Михаил", avatar: "👔", context: "", mood: 3 });
    expect(d({ name: "Михаил", avatar: "👔", context: "", mood: 3, walk: "  ", walkTitle: "" })).toEqual({ name: "Михаил", avatar: "👔", context: "", mood: 3 });
    expect(d({ name: "Михаил", avatar: "👔", context: "", mood: 3, walk: "Михаил уходит.", walkTitle: "Михаил ушёл" })).toEqual({ name: "Михаил", avatar: "👔", context: "", mood: 3, walk: "Михаил уходит.", walkTitle: "Михаил ушёл" });
    expect(dlgWalkLine({ name: "Михаил" })).toBe(dlgWalkText("Михаил"));   // не написал — общая фраза
    const src = read("ui/content-editor.jsx");
    expect(src).toMatch(/Если гость уйдёт · необязательно/);   // v73: подпись поля курсивом, обычными буквами
    expect(src).toMatch(/onChange=\{e => setGuest\(\{ walk: e\.target\.value \}\)\}/);
    expect(src).toMatch(/onChange=\{e => setGuest\(\{ walkTitle: e\.target\.value \}\)\}/);
  });
  it("игра «у стола» рисует все шесть видов из редактора", async () => {
    const { toDraftSit, serializeExtras } = await ed();
    const { TablePractice } = await import("../ui/table");
    const qs = serializeExtras({ questions: [], situations: DRAFT_SITS.map(toDraftSit), dialogue: null, build: null, review: null, skills: [] });
    const steps = sectionSteps("Субординация", [{ id: "new", title: "Кто главный", content: "Старший смены отвечает за зал.", questions: qs }], "seasonal", "#7C9E87");
    const L = steps.find((s) => s.type === "practice");
    const PS = { step: 0, choice: null, isAnswered: false, results: [], done: false, lives: 3, score: 0, combo: 0, situations: L.situations, usedIds: [] };
    const P = (ps) => R(React.createElement(TablePractice, { inline: true, lesson: L, mod: { id: "m", title: "Субординация", lessons: steps }, color: "#7C9E87", practiceState: ps,
      setPracticeState: noop, onPracticeChoice: noop, onPracticeNext: noop, onBack: noop, onComplete: noop, streak: null, profile: null }));
    const want = ["в зале", "найди ошибку", "Мысли гостя", "правда или миф", "Собери правило", "быстрое решение"];
    L.situations.forEach((s, i) => {
      const h = P({ ...PS, step: i });
      expect(h).toContain("Ситуация " + (i + 1) + " из 6");
      expect(h, s.genre).toContain(want[i]);
    });
    expect(P({ ...PS, step: 2 })).toContain("Я уже десять минут без меню…");
    expect(P({ ...PS, step: 3 })).toContain("«Приборы можно выносить голыми руками»");
    expect(P({ ...PS, step: 4 })).toContain("Если сомневаешься, подходить ли к гостю, —");
    expect(P({ ...PS, step: 5 })).toMatch(/role="timer"/);
    expect(P({ ...PS, step: 3, isAnswered: true, choice: 0, lives: 2 })).toContain("Миф");   // неверно: «Ответ — Миф»
  });
});

describe("«Как увидит сотрудник»: проба на настоящих экранах (v40)", () => {
  it("раунд пробы считается как в App: очки, комбо ×2, тарелки, конец раунда", async () => {
    const { pvChoice, pvNext } = await ed();
    const sits = [{ correct: 0, options: ["a", "b"] }, { correct: 1, options: ["a", "b"] }, { correct: 0, options: ["a", "b"] }, { correct: 0, options: ["a", "b"] }];
    let ps = { step: 0, choice: null, isAnswered: false, results: [], done: false, lives: 3, score: 0, combo: 0, situations: sits };
    ps = pvChoice(ps, 0); expect([ps.score, ps.combo, ps.lives, ps.isAnswered]).toEqual([10, 1, 3, true]);
    expect(pvChoice(ps, 1)).toBe(ps);   // второй ответ на ту же ситуацию не считается
    ps = pvNext(ps); expect([ps.step, ps.results, ps.isAnswered]).toEqual([1, [true], false]);
    ps = pvNext(pvChoice(ps, 1)); expect([ps.score, ps.combo]).toEqual([30, 2]);   // комбо: +20
    ps = pvChoice(ps, 1); expect([ps.score, ps.combo, ps.lives]).toEqual([30, 0, 2]);
    ps = pvNext(ps); ps = pvNext(pvChoice(ps, -1));   // время вышло — тоже промах
    expect(ps.done).toBe(true);
    expect(ps.results).toEqual([true, true, false, false]);
    // три промаха — раунд окончен раньше
    let g = { step: 0, choice: null, isAnswered: false, results: [], done: false, lives: 3, score: 0, combo: 0, situations: [...sits, ...sits] };
    for (let i = 0; i < 3; i++) g = pvNext(pvChoice(g, 1 - g.situations[g.step].correct));
    expect([g.done, g.lives, g.results.length]).toEqual([true, 0, 3]);
  });
  it("кнопки и экраны: «Сыграть практику» — TablePractice, «Сыграть диалог» — LiveDialogue; без записи", () => {
    const src = read("ui/content-editor.jsx");
    expect(src).toMatch(/Сыграть практику/);
    expect(src).toMatch(/Сыграть диалог/);
    expect(src).toMatch(/звёзды, ошибки и прогресс не записываются/);
    expect(src).toMatch(/import\("\.\/table"\)/);
    expect(src).toMatch(/<TP key=\{play\.key\} lesson=\{play\.lesson\}[^>]*onPracticeChoice=\{playPick\} onPracticeNext=\{playNext\} onBack=\{closePlay\} onComplete=\{closePlay\}/);
    expect(src).toMatch(/createPortal\(<LiveDialogue key=\{play\.key\} inline=\{play\.dialogue\} T=\{T\} color=\{track\.color\} pro onClose=\{closePlay\} \/>, document\.body\)/);
    // проба ничего не пишет: в её коде нет сервера, записи на телефон и колбэков прогресса
    const a = src.indexOf("// ── v40: проба — те же экраны"), b = src.indexOf("return (", a);
    expect(a > 0 && b > a).toBe(true);
    const play = src.slice(a, b) + src.slice(src.indexOf("{/* v40: проба — настоящие экраны поверх редактора"), src.lastIndexOf("</div>"));
    for (const bad of ["rpc(", "fetch(", "localStorage.setItem", "writeDraft", "onMistakes", "onActivity", "onAskMentor", "logActivity", "addMistakes", "hintKey"]) expect(play.includes(bad), bad).toBe(false);
  });
  it("диалог для пробы — тот же объект, что соберёт приложение: итоговый шаг, уход гостя", async () => {
    const steps = sectionSteps("Субординация", [{ id: "new", title: "Кто главный", content: "", questions: [{ kind: "dialogue", tip: "", guest: { name: "Ольга", avatar: "👩", context: "", mood: 2, walk: "Ольга уходит.", walkTitle: "Ольга ушла" }, steps: [{ type: "guest", text: "Позовите менеджера!" }, { type: "choice", prompt: "Что ответишь?", options: [{ text: "Позову", correct: true, feedback: "", moodDelta: 1 }, { text: "Нет", correct: false, feedback: "", moodDelta: -1 }] }] }] }], "seasonal", "#7C9E87");
    const dl = steps.find((s) => s.type === "dialogue").dialogue;
    expect(dl.id).toBe("cms-d-new");
    const html = R(React.createElement(LiveDialogue, { inline: dl, T: S, onClose: noop, color: "#7C9E87", pro: true }));
    expect(html).toMatch(/data-dlg="cms-d-new"/);
    expect(html).toContain("Ольга");
    expect(html).toContain('aria-label="Живой диалог: Кто главный"');   // название — как у урока-диалога в программе
    expect(html).toMatch(/data-sa-back=""/);   // «Назад» Telegram закрывает пробу
  });
  it("предупреждения: незаполненная ситуация в пробу не попадает; диалог с ошибкой — сообщение, а не экран", async () => {
    const { dlgProblem, sitProblem, toDraftSit } = await ed();
    expect(DRAFT_SITS.concat([{ genre: "empathy", scene: "x", options: ["a", "b"] }]).map(toDraftSit).filter((x) => !sitProblem(x)).length).toBe(6);
    expect(dlgProblem({ guest: { name: "" }, steps: [] })).toBe("Живой диалог: как зовут гостя?");
    expect(dlgProblem({ guest: { name: "Ольга" }, steps: [{ type: "guest", text: "Привет" }] })).toBe("Живой диалог: нужен хотя бы один выбор.");
    expect(dlgProblem({ guest: { name: "Ольга" }, steps: [{ type: "choice", prompt: "?", options: [{ text: "a", correct: true }, { text: "" }] }] })).toBe("Живой диалог, шаг 1: нужно хотя бы два ответа.");
    expect(dlgProblem({ guest: { name: "Ольга" }, steps: [{ type: "choice", prompt: "?", options: [{ text: "a", correct: true }, { text: "b" }] }] })).toBeNull();
    const src = read("ui/content-editor.jsx");
    expect(src).toMatch(/В пробу попадут заполненные ситуации:/);
    expect(src).toMatch(/if \(draft\.dialogue\) \{ const dp = dlgProblem\(draft\.dialogue\); if \(dp\) return dp; \}/);
  });
  it("экран редактора рисуется", async () => {
    const { ContentEditorScreen } = await ed();
    const T = { screen: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, lessBody: {}, a11y: false };
    expect(R(React.createElement(ContentEditorScreen, { T, a11y: false, onBack: noop }))).toContain("Редактор контента");
  });
});

describe("ИИ-помощник: ситуации всех шести видов (v40)", () => {
  const P = PROMPT.situations("seasonal", "ТЕКСТ УРОКА ДЛЯ ПРОВЕРКИ", "Встреча гостя");
  it("промпт знает виды, их поля и правила v37–v39", () => {
    for (const g of ["action", "find", "empathy", "truefalse", "complete", "timer"]) expect(P).toContain(g);
    for (const f of ["guestThought", "statement", "isTrue", "start", "scene", "question", "options", "correct", "win", "fail", "emoji"]) expect(P).toContain('"' + f + '"');
    expect(P).toMatch(/question спрашивает, что не так \(«Что не так\?»\), а не «что делаешь\?»/);
    expect(P).toMatch(/Мысли гостя \(guestThought\) — только в empathy/);
    expect(P).toMatch(/совпадают со сценой/);
    expect(P).toMatch(/start и любой вариант вместе читаются как одно грамотное предложение/);
    expect(P).toMatch(/не заканчивается вопросом и не обрывается двоеточием после «а», «в», «он»/);
    expect(P).toMatch(/однозначно верно или однозначно неверно/);
    expect(P).toMatch(/ровно один верный/);
    expect(P).toMatch(/одной длины/);
    expect(P).toMatch(/верный не должен выделяться ни длиной, ни подробностью, ни тоном/);
    expect(P).toMatch(/ловушка/);
    expect(P).toMatch(/подходит к любому неверному варианту/);
    expect(P).toContain("ТЕКСТ УРОКА ДЛЯ ПРОВЕРКИ");
  });
  it("sanitize: у каждого вида только свои поля, ровно один верный, правда/миф — служебные варианты", () => {
    const r = sanitize("situations", { situations: [
      { genre: "truefalse", emoji: "🃏", statement: "«Приборы можно голыми руками»", correct: 1, options: ["x", "y"], scene: "лишнее", hack: 1, win: "w", fail: "f" },
      { genre: "complete", start: "Ядро думает не о себе, а:", options: ["о госте", "", "о кухне", "о менеджере"], correct: 2, guestThought: "лишнее" },
      { genre: "complete", start: "Что делать, если гость молчит?", options: ["a", "b"] },
      { genre: "empathy", scene: "Гость ждёт", options: ["a", "b"], correct: 1 },
      { genre: "empathy", guestThought: "«Почему так долго…»", scene: "Гость ждёт меню", options: ["Раздражён", "Доволен"], correct: "0", question: "" },
      { genre: "find", scene: "Официант спорит", question: "Что делаешь?", options: ["a", "b", "c", "d", "e"], correct: 4 },
      { genre: "timer", emoji: "👨‍👩‍👧", scene: "Гость поднял руку", options: ["Подхожу", "Жду"], correct: 1, guestThought: "думает" },
      { genre: "hack", scene: "Сцена", options: ["a", "b"], correct: 1 },
      { genre: "truefalse", statement: "Без ответа" },
    ] }).situations;
    expect(r.map((s) => s.genre)).toEqual(["truefalse", "complete", "empathy", "find", "timer", "action"]);
    expect(r[0]).toEqual({ genre: "truefalse", emoji: "🃏", statement: "Приборы можно голыми руками", isTrue: false, correct: 1, question: "Это верно?", options: ["✅ Верно", "❌ Неверно"], win: "w", fail: "f" });
    expect(r[1].start).toBe("Ядро думает не о себе, а");   // «а:» → «а»: начало и вариант — одно предложение
    expect([r[1].options, r[1].correct, r[1].question]).toEqual([["о госте", "о кухне", "о менеджере"], 1, "Выбери правильное продолжение:"]);
    expect("guestThought" in r[1]).toBe(false);
    expect([r[2].guestThought, r[2].question, r[2].correct]).toEqual(["Почему так долго…", "Что чувствует гость и что сделать?", 0]);
    expect([r[3].question, r[3].options.length, r[3].correct]).toEqual(["Что не так?", 4, 0]);
    expect("guestThought" in r[4]).toBe(false);
    expect(r[4].emoji.length).toBeLessThanOrEqual(4);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(r[4].emoji)).toBe(false);   // без половинки эмодзи
    for (const s of r) {
      expect(Number.isInteger(s.correct) && s.correct >= 0 && s.correct < s.options.length, s.genre).toBe(true);
      expect(Object.keys(s).sort(), s.genre).toEqual(Object.keys(builtIn(s.genre)).sort());   // как у штатных
    }
  });
  it("sanitize: разумные длины", () => {
    const long = "я".repeat(2000);
    const [tf, ac] = sanitize("situations", { situations: [{ genre: "truefalse", statement: long, isTrue: "true", win: long }, { genre: "action", scene: long, question: long, options: [long, long], correct: 1, fail: long }] }).situations;
    expect([tf.statement.length, tf.isTrue, tf.correct, tf.win.length]).toEqual([300, true, 0, 240]);
    expect([ac.scene.length, ac.question.length, ac.options[0].length, ac.fail.length]).toEqual([400, 160, 200, 240]);
    expect(sanitize("situations", { situations: [{ genre: "empathy", scene: "x", options: ["a", "b"] }] })).toBeNull();
  });
  it("в редакторе ИИ-ситуации всех видов показываются и вставляются в карточки", async () => {
    const { toDraftSit, sitOut } = await ed();
    const r = sanitize("situations", { situations: DRAFT_SITS }).situations;
    expect(r.map((s) => s.genre)).toEqual(["action", "find", "empathy", "truefalse", "complete", "timer"]);
    for (const s of r) {
      const card = toDraftSit({ ...s, id: "x" });
      expect(card.genre).toBe(s.genre);
      const back = sitOut(card);
      const { kind, ...plain } = back;
      expect(plain, s.genre).toEqual(s);   // вставили и сохранили — то же, что предложил ассистент
    }
    const src = read("ui/content-editor.jsx");
    expect(src).toMatch(/\.map\(x => toDraftSit\(\{ \.\.\.x, id: uid\(\) \}\)\)/);
    expect(src).toMatch(/\{GENRE_RU\[g\]\}<\/div>/);   // v73: без капса
  });
});
