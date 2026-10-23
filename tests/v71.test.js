// v71 (Доп. 384): пять улучшений по обходу приложения — владелец: «Соберём все 5?»
// 1) тест: правила на виду (тарелки, бусины, правило словами, буквы у ответов) — правила не менялись;
// 2) «‹ назад» и стрелки листания — место для пальца 44×44, вид прежний;
// 3) поиск с любого экрана (лупа в верхней строке) — меню команды, как в «Колоде меню», и карта бара;
// 4) разделы «Смена», «Команда», «Я» — группами, у руководителя «Управление» сверху;
// 5) полноэкранный Telegram — верхняя строка в середине строки кнопок Telegram.
// Вид в браузере — tools/claude/e2e-v71.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: () => null, length: 0 };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { quizRule, quizTopic, rulePhrase, QuizPlates, QuizBeads, QUIZ_LIVES } from "../ui/quiz-bits";
import { menuDishes, barCocktails } from "../lib/menu-dishes";
import { tgButtonsRow, startTgScreen } from "../lib/tg-screen";
import { COCKTAILS } from "../data/cocktails";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const noop = () => {};

describe("v71: тест — правила на виду, сами правила прежние", () => {
  it("12 вопросов: зачёт от 10, ошибиться можно дважды; 11 → 9; 5 → 4 и один раз; 3 → без ошибок", () => {
    expect(QUIZ_LIVES).toBe(3);
    expect(quizRule(12)).toEqual({ need: 10, allowed: 2 });
    expect(quizRule(11)).toEqual({ need: 9, allowed: 2 });
    expect(quizRule(10)).toEqual({ need: 8, allowed: 2 });
    expect(quizRule(5)).toEqual({ need: 4, allowed: 1 });
    expect(quizRule(3)).toEqual({ need: 3, allowed: 0 });
  });
  it("правило совпадает с тем, как приложение засчитывает тест: от 70% и без третьей ошибки (App.jsx, экран результата)", () => {
    for (let n = 1; n <= 24; n++) for (let m = 0; m <= n; m++) {
      const passApp = n - m >= n * 0.7 && m < 3;              // экран результата: score >= 70% и не blocked (третья ошибка)
      expect(n - m >= quizRule(n).need).toBe(passApp);
    }
    const app = rd("App.jsx"), sl = rd("ui/screens-learning.jsx");
    expect(app).toContain("if (newMistakes >= 3 && !isCorrect) {");
    expect(app).toContain("const SHOW = 12;");
    expect(sl).toContain("score >= lesson.questions.length * 0.7 && !quizState.blocked");
  });
  it("тема теста — без «Тест:», с заглавной; правило словами — без лишних тире", () => {
    expect(quizTopic("Тест: поведение в зале")).toBe("Поведение в зале");
    expect(quizTopic("Финальный тест — Сервис-менеджер")).toBe("Сервис-менеджер");
    expect(quizTopic("Экзамен ступени")).toBe("Экзамен ступени");
    expect(quizTopic("")).toBe("Тест");
    expect(rulePhrase(12)).toBe("Для зачёта нужно 10 верных из 12. Можно ошибиться два раза, на третьей ошибке тест закончится. Пересдать можно сразу.");
    expect(rulePhrase(5)).toContain("Можно ошибиться один раз");
    expect(rulePhrase(3)).toBe("Для зачёта нужно ответить верно на все 3 вопроса.");
  });
  it("тарелки: целые — сколько ещё можно ошибиться до конца; подпись для экранного диктора", () => {
    const at = (m) => R(h(QuizPlates, { mistakes: m }));
    expect((at(0).match(/data-quiz-plate="1"/g) || []).length).toBe(3);
    expect(at(0)).toContain('aria-label="Можно ошибиться ещё 2 раза"');
    expect((at(1).match(/data-quiz-plate="1"/g) || []).length).toBe(2);
    expect(at(1)).toContain('aria-label="Можно ошибиться ещё 1 раз"');
    expect(at(2)).toContain('aria-label="Следующая ошибка завершит тест"');
    expect((at(3).match(/data-quiz-plate="0"/g) || []).length).toBe(3);
  });
  it("бусины: верно, ошибка, текущий; ответ в подсветке уже виден", () => {
    const html = R(h(QuizBeads, { n: 5, step: 2, answers: [{ isCorrect: true }, { isCorrect: false }] }));
    expect([...html.matchAll(/data-bead="([a-z]*)"/g)].map((m) => m[1])).toEqual(["ok", "bad", "cur", "", ""]);
    const p = R(h(QuizBeads, { n: 5, step: 2, answers: [{ isCorrect: true }, { isCorrect: false }], pending: { isCorrect: false } }));
    expect([...p.matchAll(/data-bead="([a-z]*)"/g)].map((m) => m[1])).toEqual(["ok", "bad", "bad", "", ""]);
  });
  it("экран теста: тема и число вопросов в шапке, тарелки, «Вопрос 1 из 12 · зачёт — от 10», правило на первом вопросе, буквы А–Г", async () => {
    const { LessonScreen } = await import("../ui/screens-learning");
    const T = { screen: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, quizWrap: {}, quizProgress: {}, quizQ: {}, quizOpt: {}, modTitle: {}, modSub: {}, para: {} };
    const qs = Array.from({ length: 12 }, (_, i) => ({ q: "Вопрос " + (i + 1) + "?", options: ["а", "б", "в", "г"], correct: 1 }));
    const L = { id: "q9", type: "quiz", title: "Тест: поведение в зале", questions: qs };
    const PS = { step: 0, results: [], lives: 3, situations: [] };
    const at = (st) => R(h(LessonScreen, { lesson: L, color: "#7C9E87", onBack: noop, onComplete: noop, quizState: st, onQuiz: noop, practiceState: PS, setPracticeState: noop, onPracticeChoice: noop, onPracticeNext: noop, T }));
    const first = at({ step: 0, answers: [], mistakes: 0, done: false });
    expect(first).toContain("Тест · 12 вопросов");
    expect(first).toContain(">Поведение в зале<");
    expect(first).toContain("Вопрос 1 из 12");
    expect(first).toContain("зачёт — от 10");
    expect(first).toContain("data-quiz-rule");
    expect(first).toContain("Для зачёта нужно 10 верных из 12.");
    expect((first.match(/data-quiz-opt=/g) || []).length).toBe(4);
    for (const l of ["А", "Б", "В", "Г"]) expect(first).toContain(">" + l + "</span>");
    expect(first).toContain('aria-label="Вернуться"');
    expect(first).toContain('class="sa-hit"');
    // дальше правило уже не повторяется, тарелка за ошибку разбита
    const third = at({ step: 2, answers: [{ idx: 1, isCorrect: true }, { idx: 0, isCorrect: false }], mistakes: 1, done: false });
    expect(third).not.toContain("data-quiz-rule");
    expect(third).toContain("Вопрос 3 из 12");
    expect((third.match(/data-quiz-plate="1"/g) || []).length).toBe(2);
  });
  it("результат после третьей ошибки — понятными словами", () => {
    const sl = rd("ui/screens-learning.jsx");
    expect(sl).toContain("Это третья ошибка, тест закончился. Посмотри разбор ниже и попробуй снова: пересдать можно сразу.");
    expect(sl).not.toContain("Тест завершён — много ошибок");
  });
});

describe("v71: «‹ назад» и стрелки — место для пальца 44×44, вид прежний", () => {
  it("класс .sa-hit: невидимое место 44×44 вокруг значка, раскладка не меняется", () => {
    const css = rd("ui/css.js");
    expect(css).toContain(".sa-hit { position: relative;");
    expect(css).toContain('.sa-hit::before { content: ""; position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; transform: translate(-50%, -50%); }');
  });
  it("каждая стандартная кнопка «назад» (T.backBtn2) — с .sa-hit и подписью для экранного диктора", () => {
    let n = 0;
    const marked = [];
    for (const f of readdirSync("ui").filter((x) => /\.jsx$/.test(x))) {
      const src = rd("ui/" + f);
      for (const m of src.matchAll(/<button[^>]*style=\{T\.backBtn2\}[^>]*>/g)) {
        n++;
        expect(m[0], f).toContain('className="sa-hit"');
        expect(m[0], f).toMatch(/aria-label="(Назад|Вернуться)"/);
        expect((m[0].match(/aria-label=/g) || []).length, f).toBe(1);
        if (m[0].includes('aria-label="Назад"')) marked.push(f);
      }
    }
    expect(n).toBeGreaterThanOrEqual(31);
    // «Назад» Telegram (lib/utils clickScreenBack) сначала жмёт помеченное [data-sa-back] / [aria-label="Назад"], потом «‹» по тексту.
    // Подпись «Назад» у шапки перехватила бы его у полосы разговора голосом (v65: «Назад» закрывает разговор, а не собеседование) —
    // поэтому новые подписи — «Вернуться», а «Назад» осталось ровно там, где было до v71.
    expect(marked.sort()).toEqual(["cellar.jsx", "content-editor.jsx", "league.jsx"]);
    expect(rd("lib/utils.js")).toContain(`const marked = [...layer.querySelectorAll('[data-sa-back], [aria-label="Назад"]')].find(visible);`);
  });
  it("и нестандартные: график, колода бармена, «Сборка руками», гид, чек-листы, SOS, стрелки карточек урока", () => {
    expect(rd("ui/schedule.jsx")).toContain('<button className="sa-btn sa-hit" style={{ background:"transparent", border:"none", color:GOLD,');
    expect(rd("ui/cocktails.jsx")).toContain('<span className="sa-hit" onClick={onBack}');   // без role — «Назад» Telegram его не ищет, как до v71
    expect(rd("ui/bar-lab.jsx")).toContain('<button className="sa-btn sa-hit" onClick={backTo || onBack}');
    expect(rd("ui/guide.jsx")).toContain('<button className="sa-btn sa-hit" onClick={onBack}');
    expect((rd("ui/screens-admin.jsx").match(/<div className="sa-hit" onClick=\{onBack\}/g) || []).length).toBe(3);
    expect(rd("ui/sos.jsx")).toContain('<button className="sa-hit" style={T.backBtn}');
    const sl = rd("ui/screens-learning.jsx");
    expect(sl).toContain('className="sa-hit" role="button" aria-label="Предыдущая карточка"');
    expect(sl).toContain('className="sa-hit" role="button" aria-label="Следующая карточка"');
  });
});

describe("v71: поиск — меню команды, как в «Колоде меню», и карта бара", () => {
  const R0 = "Два моря, Океан";
  const SAMPLES = { [R0]: [{ id: "s1", name: "Креветка темпура", allergens: ["Орехи"] }, { id: "s2", name: "Пончик с крабом" }] };
  it("меню команды с сервера видно (раньше поиск его не знал); примеры — пока у команды нет своего меню", () => {
    const team = [{ id: "t1", name: "Чизкейк с фундуком", allergens: ["Орехи"] }, { id: "__barcard__", cocktails: ["negroni"] }, { id: "t2", name: "Дом. коктейль", kind: "cocktail" },
      { id: "t3", name: "Старое блюдо", archived: true }, { id: "t4", name: "Удалённое" }];
    const names = (x) => x.map((d) => d.name);
    expect(names(menuDishes({ restaurant: R0, shared: team, samples: SAMPLES, deleted: { [R0]: ["t4"] } }))).toEqual(["Чизкейк с фундуком"]);
    expect(names(menuDishes({ restaurant: R0, shared: [], samples: SAMPLES }))).toEqual(["Креветка темпура", "Пончик с крабом"]);
    // примеры включили вручную — видны и при меню команды; выключили — не видны и без него
    expect(names(menuDishes({ restaurant: R0, shared: team.slice(0, 1), samples: SAMPLES, hideSamples: { [R0]: false } }))).toEqual(["Чизкейк с фундуком", "Креветка темпура", "Пончик с крабом"]);
    expect(names(menuDishes({ restaurant: R0, shared: [], samples: SAMPLES, hideSamples: { [R0]: true } }))).toEqual([]);
    // своя правка важнее серверной; архив своих не показываем; скрытый пример не показываем
    const custom = { [R0]: [{ id: "t1", name: "Чизкейк (своя правка)" }, { id: "c2", name: "Своё в архиве", archived: true }] };
    expect(names(menuDishes({ restaurant: R0, shared: team.slice(0, 1), custom, samples: SAMPLES }))).toEqual(["Чизкейк (своя правка)"]);
    expect(names(menuDishes({ restaurant: R0, shared: [], samples: SAMPLES, hiddenIds: { [R0]: ["s1"] } }))).toEqual(["Пончик с крабом"]);
    expect(menuDishes({ restaurant: "" })).toEqual([]);
  });
  it("то же правило, что у «Колоды меню» (ui/menu-trainer.jsx)", () => {
    const mt = rd("ui/menu-trainer.jsx");
    expect(mt).toContain("const showSamples = hs === false ? true : hs === true ? false : shared.length === 0;");
    expect(mt).toContain('const team = shared.filter(d => d && d.id && d.name && !isBarcard(d) && d.kind !== "cocktail" && !ownIds.has(d.id) && !del.has(d.id) && !d.archived);');
  });
  it("карта бара: если настроена — только её коктейли и свои; если нет — все", () => {
    expect(barCocktails([]).length).toBe(COCKTAILS.length);
    const ids = barCocktails([{ id: "__barcard__", cocktails: ["negroni", "manhattan"] }]).map((c) => c.id);
    expect(ids.sort()).toEqual(["manhattan", "negroni"]);
  });
  it("экран поиска: блюда через общее правило, раздел «Карта бара», аллергены в строке, переход к карточке коктейля", () => {
    const s = rd("ui/search.jsx"), app = rd("App.jsx");
    expect(s).toContain("const dishesFor = (restaurant) => menuDishesFromStorage(restaurant);");
    expect(s).toContain("Карта бара");
    expect(s).toContain("data-search-cocktail");
    expect(s).toContain("data-dish-allergens");
    expect(s).toContain('placeholder="Блюдо, аллерген, коктейль, термин…"');
    expect(app).toContain('onCocktail={(id) => { setRefStart(null); setCkStart(id); navigate("cocktails"); }}');
  });
  it("лупа в верхней строке на любом экране, кроме теста, экзамена и собеседования кандидата", () => {
    const app = rd("App.jsx");
    expect(app).toContain("data-top-search");
    expect(app).toContain('{profile && !["search", "exam", "certificate", "candidate"].includes(screen) && !(screen === "lesson" && activeLesson && activeLesson.type === "quiz") ? (');
    expect(app).toContain('onClick={() => { vibrate("light"); navigate("search"); }}');
  });
});

describe("v71: разделы группами", () => {
  const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" } };
  const it_ = (key, group) => ({ key, group, icon: "book", label: "Пункт " + key, sub: "подпись " + key, onClick: noop });
  it("заголовок над группой, группы — в порядке groupOrder, внутри группы порядок прежний; compactGroups — строками в одной карточке", async () => {
    const { HubScreen } = await import("../ui/home-hubs");
    const html = R(h(HubScreen, { T, a11y: false, title: "Я", items: [it_("a", "Мой путь"), it_("g", "Помощь и настройки"), it_("b", "Мой путь"), it_("w", "Итоги"), null],
      groupOrder: ["Мой путь", "Итоги", "Помощь и настройки"], compactGroups: ["Итоги", "Помощь и настройки"] }));
    expect([...html.matchAll(/data-hub-group="([^"]+)"/g)].map((m) => m[1])).toEqual(["Мой путь", "Итоги", "Помощь и настройки"]);
    expect([...html.matchAll(/aria-label="(Пункт [a-z])"/g)].map((m) => m[1])).toEqual(["Пункт a", "Пункт b", "Пункт w", "Пункт g"]);
    expect((html.match(/data-hub-compact/g) || []).length).toBe(2);
  });
  it("без групп — как было: ни заголовков, ни строк", async () => {
    const { HubScreen } = await import("../ui/home-hubs");
    const html = R(h(HubScreen, { T, a11y: false, title: "Смена", items: [{ key: "x", icon: "book", label: "X" }] }));
    expect(html).not.toContain("data-hub-group");
    expect(html).not.toContain("data-hub-compact");
  });
  it("«Я», «Смена», «Команда» — группы в App; ни один пункт не пропал", () => {
    const app = rd("App.jsx");
    expect(app).toContain('groupOrder={["Мой путь", "Итоги и документы", "Вместе", "Помощь и настройки"]} compactGroups={["Итоги и документы", "Помощь и настройки"]}');
    expect(app).toContain(']} compactGroups={["Управление"]} /></div>;');
    for (const k of ["mastery", "guide", "st", "week", "month", "cellar", "myrep", "pair", "cert", "acc", "roles"]) expect(app).toMatch(new RegExp('key:"' + k + '", group:"'));
    expect(app).toContain('{ ...offlineHelp, group:"Помощь и настройки" }');
    for (const k of ["sch", "cl", "remind", "daily", "lg", "wg", "rd", "ob"]) expect(app).toMatch(new RegExp('key:"' + k + '", group:"(На смене|Потренироваться|Первая неделя|Команда)"'));
    for (const k of ["an", "tm", "hire", "rep", "ce"]) expect(app).toMatch(new RegExp('key:"' + k + '", group:"Управление"'));
    for (const k of ["lb", "mt"]) expect(app).toMatch(new RegExp('key:"' + k + '", group:"Команда"'));
    expect(app).toContain('{ key:"mis", group:"Моё обучение"');
  });
});

describe("v71: полноэкранный Telegram — верхняя строка в строке его кнопок", () => {
  it("строка кнопок Telegram: высота из contentSafeAreaInset.top, только в полноэкранном и не ниже 30 px", () => {
    expect(tgButtonsRow({ isFullscreen: true, contentSafeAreaInset: { top: 46 } })).toBe(46);
    expect(tgButtonsRow({ isFullscreen: false, contentSafeAreaInset: { top: 46 } })).toBe(0);
    expect(tgButtonsRow({ isFullscreen: true, contentSafeAreaInset: { top: 12 } })).toBe(0);
    expect(tgButtonsRow(null)).toBe(0);
  });
  it("класс sa-tgrow и --sa-tgrow ставятся по событиям Telegram и снимаются при выходе", () => {
    const ev = {};
    const tg = { platform: "ios", isFullscreen: true, safeAreaInset: { top: 62 }, contentSafeAreaInset: { top: 46 }, isVersionAtLeast: () => true, requestFullscreen() {}, disableVerticalSwipes() {},
      onEvent(n, f) { (ev[n] = ev[n] || []).push(f); }, offEvent() {} };
    const cls = new Set(), vars = {};
    const root = { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) }, style: { setProperty: (k, v) => { vars[k] = v; }, removeProperty: (k) => { delete vars[k]; } } };
    startTgScreen(tg, root);
    expect(cls.has("sa-tgfs")).toBe(true);
    expect(cls.has("sa-tgrow")).toBe(true);
    expect(vars["--sa-st"]).toBe("108px");
    expect(vars["--sa-tgrow"]).toBe("46px");
    tg.isFullscreen = false; ev.fullscreenChanged.forEach((f) => f());
    expect(cls.has("sa-tgrow")).toBe(false);
    expect(vars["--sa-tgrow"]).toBeUndefined();
  });
  it("CSS: строка — посередине между кнопками Telegram; подпись «Для чтения» здесь — значком; у кнопки темы — подпись для диктора", () => {
    const css = rd("ui/css.js"), app = rd("App.jsx");
    expect(css).toContain("html.sa-tgfs.sa-tgrow [data-sa-topbar] { position: fixed; z-index: 40; left: 50%; transform: translateX(-50%);");
    expect(css).toContain("top: calc(var(--sa-st, 0px) - var(--sa-tgrow, 0px)); height: var(--sa-tgrow, 46px); width: min(210px, calc(100vw - 236px));");
    expect(css).toContain("html.sa-tgfs.sa-tgrow [data-sa-topbar] .sa-topbar-lbl { display: none; }");
    expect(app).toContain('<span className="sa-topbar-lbl">{a11y ? "Тёмная" : "Для чтения"}</span>');
    expect(app).toContain('aria-label={a11y ? "Тёмная тема" : "Для чтения: светлая тема и крупный текст"}');
  });
});

describe("v71: метка, гид и журнал", () => {
  it("«сборка v71», «Дополнение 384»; гид знает про лупу и правила теста", () => {
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v71</span>");
    expect(rd("CHANGES.md")).toContain("# Дополнение 384 — пять улучшений по обходу: тест с правилами на виду, кнопка «назад» под палец, поиск с любого экрана, разделы группами, верх в Telegram (v71)");
    const g = rd("ui/guide.jsx");
    expect(g).toContain("Лупа в верхней строке, рядом с «Для чтения», открывает поиск с любого экрана.");
    expect(g).toContain('go: "search" }');
    expect(g).toContain("Сверху три тарелки: каждая ошибка разбивает одну, на третьей тест заканчивается, пересдать можно сразу.");
  });
});
