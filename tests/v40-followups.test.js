// v40, доделки к выпуску:
//   • «Сыграть практику» в редакторе контента (TablePractice preview) ничего не обещает записать: выход —
//     «Выйти из пробы? Ничего не сохраняется.», в чеке вместо серии, цели дня и «Работы над ошибками» —
//     «Проба — результат не записывается»; нет «Разобрать с Наставником», «вслух» с микрофоном и
//     классического вида; «Продолжить» закрывает пробу. У сотрудника (без preview) всё как было;
//   • подсказка без микрофона: размер в разметке — тот же, что в CSS светлой темы (13 px), в тёмной — 12,5 px;
//   • ИИ-помощник урока: вопрос «Найди ошибку» по умолчанию — «Что не так?», как в редакторе и в правиле 9;
//   • Гид по приложению: кнопки темы — названиями плиток v40, новый пункт «Путь мастера», значки в отчёте.
// В браузере: /home/claude/preview/e2e-v40-editor.mjs (проба), e2e-table.mjs и e2e-table2.mjs (сотрудник).
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const noop = () => {};
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/\u00A0/g, " ");
const read = (p) => readFileSync(p, "utf8");   // от корня проекта
// для сравнения двух рисовок: id свечи/стакана (счётчик в ui/table-bits.jsx) и время на чеке;
// v43: и id пламени, бокала и медальона (счётчик в ui/day-emblems.jsx, «de…»)
const norm = (s) => s.replace(/\b(tbgl|tbfl|tbwax|de(?:fl|fc|fg|fd|wc|wl|wr|ll|mr|me|mh))\d+/g, "$1#").replace(/\d\d\.\d\d · \d\d:\d\d/g, "дд.мм · чч:мм");

// ── практика «у стола»: раздел из двух ситуаций; у первой верный ответ — фраза гостю (будет «вслух») ──
const SITS = [
  { genre: "action", scene: "Гость спрашивает, найдётся ли детский стул.", question: "Что ответишь?", options: ["«Конечно, сейчас принесу»", "«Нет, у нас такого нет»"], correct: 0, win: "🎯 Решение сразу", fail: "💡 Предложи решение" },
  { genre: "action", scene: "Гость просит счёт.", question: "Что делаешь?", options: ["Приношу счёт сразу", "Жду, пока гость доест десерт"], correct: 0, win: "🎯 Сразу", fail: "💡 Счёт — сразу" },
];
const LESSON = { id: "fu-p", type: "practice", title: "Практика: Детский стул", situations: SITS };
const MOD = { id: "fu", title: "Детский стул", lessons: [LESSON] };
const PS = { step: 0, choice: null, isAnswered: false, results: [], done: false, lives: 3, score: 0, combo: 0, situations: SITS, usedIds: [] };
const RIGHT = { ...PS, isAnswered: true, choice: 0, score: 10, combo: 1 };
const WRONG = { ...PS, isAnswered: true, choice: 1, lives: 2 };
const DONE = { ...PS, step: 1, choice: 1, results: [true, false], done: true, lives: 2, score: 10 };
const STREAK = { count: 3, best: 5, last: "2026-10-14", days: [] };
const tp = () => import("../ui/table");
const props = (TablePractice, ps, extra = {}) => ({ inline: true, lesson: LESSON, mod: MOD, color: "#7C9E87", a11y: false, practiceState: ps, setPracticeState: noop,
  onPracticeChoice: noop, onPracticeNext: noop, onBack: noop, onComplete: noop, onClassic: noop, onAskMentor: noop, streak: STREAK, profile: null,
  goal: { steps: 1, goal: 2 }, mentorName: "Мария", ...extra });
const P = (TablePractice, ps, extra) => R(h(TablePractice, props(TablePractice, ps, extra)));
// «телефон умеет записывать голос» — как в браузере (lib/voice.js: voiceSupported)
const withMic = (fn) => { const had = "webkitSpeechRecognition" in globalThis; const prev = globalThis.webkitSpeechRecognition;
  globalThis.webkitSpeechRecognition = function SR() {}; try { return fn(); } finally { if (had) globalThis.webkitSpeechRecognition = prev; else delete globalThis.webkitSpeechRecognition; } };
// дерево элементов экрана: функция-компонент, вызванная внутри обёртки (хуки — у обёртки)
const tree = (Comp, p) => { let out = null; const W = () => { out = Comp(p); return null; }; renderToString(h(W)); return out; };
const textOf = (el) => (typeof el === "string" || typeof el === "number" ? String(el) : Array.isArray(el) ? el.map(textOf).join("") : el && el.props ? textOf(el.props.children) : "");
const findAll = (el, pred, out = []) => {
  if (!el || typeof el !== "object") return out;
  if (Array.isArray(el)) { el.forEach((x) => findAll(x, pred, out)); return out; }
  if (el.props) { if (pred(el)) out.push(el); findAll(el.props.children, pred, out); }
  return out;
};

describe("проба практики в редакторе (TablePractice preview, v40)", () => {
  it("после ответа: нет «вслух» с микрофоном и «Разобрать с Наставником»; у сотрудника — есть", async () => {
    const { TablePractice } = await tp();
    withMic(() => {
      const emp = P(TablePractice, WRONG);
      expect(emp).toContain("А теперь — вслух");
      expect(emp).toContain('aria-label="Сказать голосом"');   // микрофон (ui/mic.jsx)
      expect(emp).toContain("Разобрать с Наставником ›");
      const pv = P(TablePractice, WRONG, { preview: true });
      expect(pv).not.toContain("вслух");
      expect(pv).not.toContain("Сказать голосом");
      expect(pv).not.toContain("tb-say");
      expect(pv).not.toContain("Наставником");
      // разбор ответа — как у сотрудника
      expect(pv).toContain("Не совсем");
      expect(pv).toContain("Лучше так");
      expect(pv).toContain("−1 тарелка · осталось 2");
      const ok = P(TablePractice, RIGHT, { preview: true });
      expect(ok).toContain("+10 очков");
      expect(ok).not.toContain("вслух");
      expect(ok).not.toContain("Сказать голосом");
      expect(P(TablePractice, RIGHT)).toContain('aria-label="Сказать голосом"');
    });
  });
  it("без микрофона в телефоне проба тоже не зовёт проговорить; классического вида в пробе нет", async () => {
    const { TablePractice } = await tp();
    expect(P(TablePractice, RIGHT)).toContain("Проговори фразу вслух");
    expect(P(TablePractice, RIGHT, { preview: true })).not.toContain("Проговори фразу вслух");
    expect(P(TablePractice, PS)).toContain('aria-label="Классический вид практики"');
    const pv = P(TablePractice, PS, { preview: true });
    expect(pv).not.toContain("Классический вид практики");
    // остальное на месте: ситуация, тарелки, «Подсмотреть», «Послушать» и звук — те же кнопки
    expect(pv).toContain("Ситуация 1 из 2");
    expect(pv).toContain("Гость спрашивает, найдётся ли детский стул.");
    expect(pv).toContain('aria-label="Подсмотреть в уроке"');
    expect(pv).toContain('aria-label="Выйти из практики"');
  });
  it("чек пробы: «Проба — результат не записывается»; ни серии, ни цели дня, ни «Работы над ошибками»", async () => {
    const { TablePractice, PREVIEW_NOTE } = await tp();
    expect(PREVIEW_NOTE).toBe("Проба — результат не записывается");
    const pv = P(TablePractice, DONE, { preview: true });
    expect(pv).toContain("Практика пройдена");
    expect(pv).toContain("Правильно");
    expect(pv).toContain("1/2");
    expect(pv).toContain("звёзды 1 из 3");
    expect(pv).toContain('<p class="r-note" data-preview="">');
    expect(pv).toContain(PREVIEW_NOTE);
    for (const bad of ["Серия", "Цель дня", "Работу над ошибками", "в зачёт", "записано", "12 часов"]) expect(pv.includes(bad), bad).toBe(false);
    expect(pv).toContain("Разбор раунда");   // разбор раунда — как у сотрудника
    expect(pv).toContain("Сыграть ещё раз");
  });
  it("у сотрудника чек как был: серия, цель дня, «в зачёт идёт лучший раунд», «В «Работу над ошибками»»", async () => {
    const { TablePractice, PREVIEW_NOTE } = await tp();
    const emp = P(TablePractice, DONE);
    expect(emp).toContain("звёзды 1 из 3 · в зачёт идёт лучший раунд");
    expect(emp).toContain("Серия");
    expect(emp).toContain("3 дня");
    expect(emp).toContain("Цель дня");
    expect(emp).toContain("1 / 2");
    expect(emp).toContain("В «Работу над ошибками»");
    expect(emp).not.toContain(PREVIEW_NOTE);
    expect(emp).not.toContain("data-preview");
    // preview={false} — ровно то же, что без него
    for (const ps of [PS, RIGHT, WRONG, DONE]) expect(norm(P(TablePractice, ps, { preview: false }))).toBe(norm(P(TablePractice, ps)));
  });
  it("«Продолжить» в пробе закрывает её (onBack), у сотрудника — засчитывает практику (onComplete)", async () => {
    const { TablePractice } = await tp();
    const onBack = () => "back", onComplete = () => "complete";
    const go = (extra) => {
      const b = findAll(tree(TablePractice, props(TablePractice, DONE, { onBack, onComplete, ...extra })), (e) => e.type === "button" && textOf(e) === "Продолжить");
      expect(b.length).toBe(1);
      return b[0].props.onClick;
    };
    expect(go({ preview: true })).toBe(onBack);
    expect(go({})).toBe(onComplete);
    expect(go({ preview: false })).toBe(onComplete);
    // без onBack — как раньше
    expect(go({ preview: true, onBack: undefined })).toBe(onComplete);
  });
  it("выход посреди раунда: в пробе «Выйти из пробы? Ничего не сохраняется.», у сотрудника — про 12 часов", async () => {
    const { practiceExitText } = await tp();
    expect(practiceExitText(true)).toEqual({ title: "Выйти из пробы?", text: "Ничего не сохраняется." });
    expect(practiceExitText()).toEqual({ title: "Выйти из практики?", text: "Раунд подождёт: вернёшься в течение 12 часов — продолжишь с этой же ситуации." });
    expect(practiceExitText(false)).toEqual(practiceExitText());
    // шторка выхода берёт тексты отсюда; кнопки «Остаться» / «Выйти» — те же
    const src = read("ui/table.jsx");
    expect(src).toMatch(/const exitTx = practiceExitText\(preview\);/);
    expect(src).toMatch(/<ExitSheet title=\{exitTx\.title\} text=\{exitTx\.text\} onStay=\{\(\) => setSheet\(false\)\} onLeave=\{\(\) => \{ setSheet\(false\); onBack\(\); \}\} \/>/);
    expect(src).toMatch(/data-sa-back="" onClick=\{onStay\}>Остаться<\/button>/);
    expect(src).toMatch(/onClick=\{onLeave\}>Выйти<\/button>/);
  });
  it("редактор открывает пробу с preview; колбэки — те же, без записи", () => {
    const src = read("ui/content-editor.jsx");
    expect(src).toMatch(/<TP key=\{play\.key\}[^>]*onBack=\{closePlay\} onComplete=\{closePlay\} streak=\{null\} profile=\{play\.profile\} preview \/>/);
    expect(src).toMatch(/Это проба: звёзды, ошибки и прогресс не записываются\./);
    const a = src.indexOf("{/* v40: проба — настоящие экраны поверх редактора");
    const mount = src.slice(a, src.indexOf("})() : null}", a));
    for (const bad of ["onMistakes", "onActivity", "onAskMentor", "onClassic", "goal=", "replay"]) expect(mount.includes(bad), bad).toBe(false);
  });
});

describe("подсказка без микрофона: размер — как в CSS (v40)", () => {
  it("светлая тема — 13 px, как правило html.sa-light; тёмная — 12,5 px, как было", async () => {
    const { TablePractice } = await tp();
    const css = read("ui/table-css-lesson.js");
    const m = css.match(/html\.sa-light \.tb-say>div:not\(\[class\]\)\{font-size:([\d.]+)px!important\}/);
    expect(!!m).toBe(true);
    const size = (a11y) => (P(TablePractice, RIGHT, { a11y }).match(/<div style="font-size:([\d.]+)px;color:var\(--sub\);margin:0 0 10px;line-height:1.45">Проговори фразу вслух/) || [])[1];
    expect(size(true)).toBe(m[1]);
    expect(size(false)).toBe("12.5");
  });
});

describe("ИИ-помощник урока: «Найди ошибку» по умолчанию спрашивает «Что не так?» (v40)", () => {
  it("пустой вопрос — «Что не так?», как в редакторе (SIT_Q.find) и в правиле 9", async () => {
    const { sanitize, PROMPT } = await import("../api/lesson-assist");
    const one = (s) => sanitize("situations", { situations: [s] }).situations[0];
    const base = { scene: "Официант ставит бокал слева от тарелки.", options: ["Бокал не на месте", "Слишком рано"], correct: 0 };
    expect(one({ ...base, genre: "find", question: "" }).question).toBe("Что не так?");
    expect(one({ ...base, genre: "find" }).question).toBe("Что не так?");
    expect(one({ ...base, genre: "find", question: "Что делаешь?" }).question).toBe("Что не так?");
    expect(one({ ...base, genre: "find", question: "Что не так с бокалом?" }).question).toBe("Что не так с бокалом?");   // свой вопрос — остаётся
    // остальные виды — как были
    expect(one({ ...base, genre: "action", question: "" }).question).toBe("Что делаешь?");
    expect(one({ ...base, genre: "timer", question: "" }).question).toBe("Что делаешь?");
    expect(one({ ...base, genre: "empathy", guestThought: "Где мой бокал?", question: "" }).question).toBe("Что чувствует гость и что сделать?");
    // в редакторе и в промпте — то же
    expect(read("ui/content-editor.jsx")).toMatch(/export const SIT_Q = \{[^}]*find: "Что не так\?"/);
    expect(PROMPT.situations("seasonal", "Текст урока", "Сервировка")).toContain('"genre": "find", "emoji": "🔍", "scene": "…", "question": "Что не так?"');
    expect(read("api/lesson-assist.js")).not.toMatch(/find: "В чём ошибка\?"/);
    expect(read("docs/ОТВЕТЫ-С-ПОДВОХОМ.md")).toMatch(/В «найди ошибку» спрашиваем, что не так/);
  });
});

describe("Гид по приложению: плитки темы v40 и «Путь мастера»", () => {
  const all = (G) => G.flatMap((s) => s.items);
  const textAll = (G) => all(G).map((it) => it.title + " " + it.text).join("\n");
  it("старых названий кнопок темы нет", async () => {
    const { GUIDE } = await import("../ui/guide");
    const t = textAll(GUIDE);
    for (const old of ["Освежить · 1 мин", "Я это умею — зачёт на опыт", "Раундом мастера", "зачёт можно снова завтра"]) expect(t.includes(old), old).toBe(false);
  });
  it("каждая плитка меню темы — в гиде тем же названием и подписью; «Погреб тем ›» — тоже", async () => {
    const { GUIDE } = await import("../ui/guide");
    const { SEASONAL_MODULES } = await import("../data/modules-seasonal");
    const { ModuleMenu } = await import("../ui/module-menu");
    const S0 = SEASONAL_MODULES.find((m) => m.id === "s0");
    const c = {}, q = {};
    S0.lessons.forEach((l) => { if (l.type === "quiz") q[l.id] = true; else if (l.type !== "result") c[l.id] = true; });
    const menu = (done, topic) => R(h(ModuleMenu, { mod: S0, completed: done ? c : {}, quizDone: done ? q : {}, onLesson: noop, embedded: true, topic,
      acts: { onRefresh: noop, onGold: noop, onCredit: noop, onCellar: noop } }));
    const html = [
      menu(true, { f: { level: "faded", k: 0.3, days: 12 }, canGold: true }),     // Освежить + Раунд мастера
      menu(true, { f: { level: "fresh", dueIn: 6 }, gold: { d: "x" }, canGold: true }),   // Золото · ещё раз
      menu(false, { canCredit: true }),                                            // Я это умею
      menu(false, { canCredit: true, tried: true }),                               // Зачёт на опыт — завтра
    ].join("\n");
    const tiles = [...html.matchAll(/class="tbm-act-t">([^<]*)<\/span><span class="tbm-act-s">([^<]*)</g)].map((m) => [m[1], m[2]]);
    expect(tiles).toEqual([["Освежить", "3 ситуации · 1 мин"], ["Раунд мастера", "8 заданий → тема золотая"], ["Освежить", "3 ситуации · 1 мин"],
      ["Золото · ещё раз", "побей свой рекорд"], ["Я это умею", "зачёт на опыт · 7 заданий"], ["Зачёт на опыт", "новая попытка — завтра"]]);
    const t = textAll(GUIDE);
    for (const [title, sub] of tiles) { expect(t, title).toContain("«" + title + "»"); expect(t, sub).toContain("«" + sub + "»"); }
    expect(html).toContain(">Погреб тем ›</button>");
    expect(t).toContain("«Погреб тем ›»");
    // где о них написано
    const by = (k) => all(GUIDE).find((it) => it.key === k).text;
    expect(by("fresh")).toContain("Плитка «Освежить» («3 ситуации · 1 мин»)");
    expect(by("credit")).toContain("плитка «Я это умею» («зачёт на опыт · 7 заданий»)");
    expect(by("credit")).toContain("«Зачёт на опыт» («новая попытка — завтра»)");
    expect(by("gold")).toContain("плитка «Раунд мастера» («8 заданий → тема золотая»)");
    expect(by("gold")).toContain("«Золото · ещё раз» («побей свой рекорд»)");
    expect(by("cellar")).toContain("кнопка «Погреб тем ›» в меню пройденной темы");
  });
  it("«Путь мастера» — во вкладке «Я», рядом с «Итогами месяца» и «Свечой на двоих»; «Открыть» ведёт на mastery", async () => {
    const { GUIDE } = await import("../ui/guide");
    const me = GUIDE.find((s) => s.tab === "Я");
    const keys = me.items.map((it) => it.key);
    expect(keys).toContain("mastery");
    expect(keys.indexOf("mastery")).toBe(keys.indexOf("pair") + 1);
    expect(keys.indexOf("month")).toBeLessThan(keys.indexOf("mastery"));
    const it2 = me.items.find((it) => it.key === "mastery");
    expect(it2).toMatchObject({ key: "mastery", title: "Путь мастера", go: "mastery" });
    expect(!!it2.staff || !!it2.admin).toBe(false);   // всем, не только руководителю
    expect(it2.text).toBe("Значки за привычки: у каждого инструмента — бронза, серебро и золото, серые ещё не открыты (нажми — узнаешь, как получить, и кнопка «Показать» откроет инструмент). Главная награда — «Мастер роли»: роль пройдена, 5 золотых тем, серия 14 дней и бронза в 10 значках; мастеру — сертификат, знак ✦ у имени в рейтинге и лиге, а руководитель может назначить приз. Каждый день на главной — «Шаг дня»: одно дело, подобранное под тебя; его же бот добавит в напоминание перед сменой. Новичку — «Первые шаги в академии»: семь заданий по главным инструментам за первые две недели.");
    expect(all(GUIDE).filter((it) => it.key === "mastery").length).toBe(1);
    // ключи пунктов не повторяются
    const ks = all(GUIDE).map((it) => it.key);
    expect(new Set(ks).size).toBe(ks.length);
  });
  it("отчёт руководителя: значки сотрудника и инструменты, которыми он ещё не пользовался", async () => {
    const { GUIDE } = await import("../ui/guide");
    const rep = all(GUIDE).find((it) => it.key === "reports");
    expect(rep.staff).toBe(true);
    expect(rep.text).toContain("В отчёте по сотруднику — его значки и инструменты, которыми он ещё не пользовался.");
  });
  it("экран гида: «Путь мастера» видят все, «Отчёты по сотрудникам» — руководитель", async () => {
    const { GuideScreen } = await import("../ui/guide");
    const T = { screen: {}, modTitle: {}, modSub: {} };
    const staff = R(h(GuideScreen, { T, a11y: false, profile: { name: "Роман", position: "manager" }, onBack: noop, onOpen: noop }));
    const emp = R(h(GuideScreen, { T, a11y: true, profile: { name: "Анна", position: "waiter" }, onBack: noop, onOpen: noop }));
    expect(staff).toContain("Путь мастера");
    expect(emp).toContain("Путь мастера");
    expect(staff).toContain("Отчёты по сотрудникам");
    expect(emp).not.toContain("Отчёты по сотрудникам");
  });
  it("типографика новых и переписанных текстов: «ёлочки», длинное тире с пробелами, ё", async () => {
    const { GUIDE } = await import("../ui/guide");
    for (const k of ["fresh", "credit", "gold", "cellar", "reports", "mastery"]) {
      const t = all(GUIDE).find((it) => it.key === k).text;
      expect(/["“”„]/.test(t), k + ": прямые кавычки").toBe(false);
      expect(/ - |\s–\s/.test(t), k + ": дефис или короткое тире вместо длинного").toBe(false);
      expect(/\S—|—\S/.test(t.replace(/ — /g, "")), k + ": тире без пробелов").toBe(false);
      expect((t.match(/«/g) || []).length, k + ": ёлочки парные").toBe((t.match(/»/g) || []).length);
    }
    const t = all(GUIDE).find((it) => it.key === "mastery").text;
    for (const w of ["серые ещё не открыты", "его же бот добавит", "Новичку"]) expect(t).toContain(w);
  });
});
