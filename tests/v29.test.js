// v29 (Доп. 309–310): отчёты по сотрудникам (модель, Excel, PDF), копия «телефонных» данных
// на сервер, задания «у стола» и разминка из вопросов тестов, свои навыки разделов,
// занятия в тренажёрах и экзамен в журнале дня, ритм дня в контексте Наставника.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { learningSnapshot, snapshotHash, pushLearning, _resetLearningSync } from "../lib/learning-sync";
import { personModel, teamModel, listRow, stepIndex, trackTotals, agoLabel, pl } from "../lib/report-model";
import { crc32, buildXlsx, colName } from "../lib/xlsx";
import { teamXlsx, personXlsx, teamSheets } from "../lib/report-xlsx";
import { personPdf, teamPdf } from "../lib/report-pdf";
import { quizPool, tablePool, practicePool } from "../lib/table-pick";
import { warmupPool } from "../lib/warmup";
import { bumpActivity, readActivity, weekSummary, weekShareText, emitActivity, ACTIVITY_EVENT } from "../lib/activity";
import { splitExtras, buildCustomModules } from "../lib/custom-modules";
import { withRefContext } from "../lib/reference-context";

function mem(init = {}) {
  const o = { ...init };
  return {
    o,
    get length() { return Object.keys(o).length; },
    key: (i) => Object.keys(o)[i],
    getItem: (k) => (k in o ? o[k] : null),
    setItem: (k, v) => { o[k] = String(v); },
    removeItem: (k) => { delete o[k]; },
  };
}
const NOW = new Date(2026, 9, 12, 15, 0, 0);
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const daysAgo = (n) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n, 12);
const iso = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();
const txt = (u8) => { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s; };

// маленький трек: две темы, практика, тесты
const INDEX = {
  seasonal: [
    { id: "m1", title: "Встреча гостя", lessons: [
      { id: "a1", title: "Первые 10 секунд", type: "lesson" },
      { id: "a2", title: "Практика встречи", type: "practice", situations: [
        { scene: "Гость у входа", question: "Что сделать?", options: ["Кивнуть", "Отвернуться"], correct: 0, genre: "action" },
      ] },
      { id: "aq", title: "Тест: встреча", type: "quiz", questions: [
        { q: "Когда первый контакт?", options: ["10 секунд", "Минута"], correct: 0, explanation: "Гость решает за 10 секунд." },
        { q: "Кто провожает к столу?", options: ["Хостес", "Повар"], correct: 0 },
      ] },
      { id: "ar", title: "Итог", type: "result" },
    ] },
    { id: "m2", title: "Заказ", lessons: [
      { id: "b1", title: "Как принять заказ", type: "lesson" },
      { id: "bq", title: "Тест: заказ", type: "quiz", questions: [{ q: "Повторять заказ?", options: ["Да", "Нет"], correct: 0 }] },
    ] },
  ],
};
const ROLES = [{ id: "seasonal", label: "Стажёр", color: "#C8A96E" }];

function rawPerson(over = {}) {
  return {
    person: { id: "p1", name: "Анна", surname: "Смирнова", restaurant: "Океан", position: "waiter", is_admin: false },
    lessons: ["a1", "a2"], quiz: ["aq"], roles: [], last_role: "seasonal", stars: { a2: 1 },
    scores: [{ quiz_id: "aq", score: 6, total: 10, updated_at: iso(3) }, { quiz_id: "aq", score: 9, total: 10, updated_at: iso(1) }],
    events: [
      { lesson_id: "aq", question: "Когда первый контакт?", correct: false, answer: "Минута", right_answer: "10 секунд", ts: iso(4) },
      { lesson_id: "aq", question: "Когда первый контакт?", correct: true, answer: "10 секунд", right_answer: "10 секунд", ts: iso(2) },
      { lesson_id: "aq", question: "Кто провожает к столу?", correct: false, answer: "Повар", right_answer: "Хостес", ts: iso(1) },
      { lesson_id: "aq", question: "Кто провожает к столу?", correct: false, answer: "Повар", right_answer: "Хостес", ts: iso(0.5) },
    ],
    skills: [{ role_id: "seasonal", skill_id: "sk1", skill_label: "Встреча у входа", status: "approved", mentor_name: "Мария", decided_at: iso(1) }],
    learning: {
      v: 1, goal: 3, weekly: 2,
      mistakes: [{ q: "Повторять заказ?", a: "Да", l: "bq", st: 0, due: NOW.getTime() - 1000 }, { q: "Кто провожает?", a: "Хостес", l: "aq", st: 2, due: NOW.getTime() + 86400000 }],
      exams: { seasonal: { passed: false, score: 60, date: "2026-10-10" } },
      streak: { count: 3, best: 5, last: ymd(NOW) },
      activity: { [ymd(daysAgo(0))]: { st: 2, w: 1 }, [ymd(daysAgo(1))]: { st: 1 }, [ymd(daysAgo(20))]: { st: 4 } },
      skills: { sk2: { by: "Пётр", date: ymd(daysAgo(2)), hall: false, pin: true, label: "Свой навык" } },
    },
    learning_at: iso(0.1), seen: iso(0.1), tg: true,
    ...over,
  };
}
const ctx = { steps: stepIndex(INDEX), roles: ROLES, skillLabel: (id) => (id === "sk1" ? "Встреча у входа" : ""), now: NOW };

describe("модель отчёта (Доп. 309)", () => {
  it("трек, что не пройдено и следующий шаг", () => {
    const m = personModel(rawPerson(), ctx);
    expect(m.full).toBe("Анна Смирнова");
    expect(m.main.id).toBe("seasonal");
    expect([m.main.done, m.main.total, m.main.pct]).toEqual([3, 5, 60]);
    expect(m.notDone.left).toBe(2);
    expect(m.notDone.modules.map((x) => x.title)).toEqual(["Заказ"]);
    expect(m.main.next.title).toBe("Как принять заказ");
  });
  it("ошибки — по вопросу: что выбрал, как верно, исправил ли; неисправленные первыми", () => {
    const m = personModel(rawPerson(), ctx);
    expect(m.wrong.map((w) => [w.q, w.wrong, w.fixed])).toEqual([["Кто провожает к столу?", 2, false], ["Когда первый контакт?", 1, true]]);
    expect(m.wrong[0].chosen).toBe("Повар");
    expect(m.wrong[0].right).toBe("Хостес");
    expect(m.unfixed).toBe(1);
    expect(m.wrong30).toBe(3);
  });
  it("тест — по лучшей попытке; повторы, навыки, дни, экзамен", () => {
    const m = personModel(rawPerson(), ctx);
    expect(m.tests.list[0].pct).toBe(90);
    expect([m.repeat.total, m.repeat.due]).toEqual([2, 1]);
    expect(m.skills.list.map((s) => [s.label, s.status])).toEqual([["Встреча у входа", "hall"], ["Свой навык", "pin"]]);
    expect(m.activity.days.length).toBe(14);
    expect(m.activity.active14).toBe(2);
    expect(m.activity.steps30).toBe(7);
    expect(m.activity.goal).toBe(3);
    expect(m.flags.some((f) => /Экзамен «Стажёр» не сдан/.test(f.text))).toBe(true);
    expect(m.weak[0].topic).toBe("Встреча гостя");
  });
  it("давно не занимался и нет данных с телефона — видно в флагах", () => {
    const m = personModel(rawPerson({ seen: iso(10), learning_at: null, learning: {} }), ctx);
    expect(m.flags.find((f) => f.level === "warn").text).toBe("Не занимался 10 дней");
    expect(m.flags.some((f) => f.level === "info")).toBe(true);
    expect(m.hasPhone).toBe(false);
    const never = personModel(rawPerson({ seen: null }), ctx);
    expect(never.flags[0].text).toBe("Ещё не занимался");
  });
  it("строка списка: внимание и процент", () => {
    const r = listRow({ id: "p1", name: "А", surname: "Б", last_role: "seasonal", lessons: 2, quiz: 1, wrong30: 5, seen: iso(1) }, { roles: ROLES, totals: trackTotals(INDEX), now: NOW });
    expect(r.pct).toBe(60);
    expect(r.attention).toBe(true);
    const ok = listRow({ id: "p2", last_role: "seasonal", lessons: 1, seen: iso(1) }, { roles: ROLES, totals: trackTotals(INDEX), now: NOW });
    expect(ok.attention).toBe(false);
    expect(agoLabel(NOW, NOW)).toBe("сегодня");
    expect([pl(1, "a", "b", "c"), pl(3, "a", "b", "c"), pl(11, "a", "b", "c")]).toEqual(["a", "b", "c"]);
  });
  it("команда: подпись охвата", () => {
    const t = teamModel({ scope: "restaurant", restaurant: "Океан", people: [rawPerson()] }, ctx);
    expect(t.scopeLabel).toBe("Океан");
    expect(t.people.length).toBe(1);
    expect(teamModel({ scope: "all", people: [] }, ctx).scopeLabel).toBe("Все рестораны");
  });
});

describe("Excel без зависимостей (Доп. 309)", () => {
  it("CRC32 и имена столбцов", () => {
    expect(crc32(new TextEncoder().encode("123456789")) >>> 0).toBe(0xCBF43926);
    expect([colName(0), colName(25), colName(26), colName(701)]).toEqual(["A", "Z", "AA", "ZZ"]);
  });
  it("книга — ZIP с нужными частями, текст по-русски внутри", () => {
    const u8 = buildXlsx([{ name: "Лист", rows: [["Имя", "Балл"], ["Анна", 90]] }]);
    const s = txt(u8);
    expect(s.slice(0, 4)).toBe("PK\u0003\u0004");
    ["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml"].forEach((n) => expect(s.includes(n)).toBe(true));
    expect(new TextDecoder().decode(u8).includes("Анна")).toBe(true);
  });
  it("отчёт по команде — шесть листов, личный — книга", () => {
    const team = teamModel({ scope: "restaurant", restaurant: "Океан", people: [rawPerson()] }, ctx);
    expect(teamSheets(team).map((x) => x.name)).toEqual(["Сводка", "Где ошибается", "С чем работать", "Что не пройдено", "Ждут повтора", "Навыки"]);
    expect(txt(teamXlsx(team)).slice(0, 2)).toBe("PK");
    expect(txt(personXlsx(personModel(rawPerson(), ctx))).slice(0, 2)).toBe("PK");
  });
});

describe("PDF без зависимостей (Доп. 309)", () => {
  it("карточка сотрудника — настоящий PDF со шрифтом", () => {
    const u8 = personPdf(personModel(rawPerson(), ctx));
    const s = txt(u8);
    expect(s.startsWith("%PDF-1.7")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(/\/Type\s*\/Catalog/.test(s)).toBe(true);
    expect(/FontFile2/.test(s)).toBe(true);
    expect((s.match(/\/Type\s*\/Page\b/g) || []).length).toBeGreaterThan(0);
  });
  it("PDF команды — обложка и карточки", () => {
    const team = teamModel({ scope: "restaurant", restaurant: "Океан", people: [rawPerson(), rawPerson({ person: { id: "p2", name: "Иван", surname: "Петров", position: "bartender" } })] }, ctx);
    const one = (txt(personPdf(team.people[0])).match(/\/Type\s*\/Page\b/g) || []).length;
    const all = (txt(teamPdf(team)).match(/\/Type\s*\/Page\b/g) || []).length;
    expect(all).toBeGreaterThan(one);
  });
});

describe("копия телефонных данных (Доп. 309)", () => {
  it("снимок: только нужное, по сотруднику, 90 дней", () => {
    const uk = "_Анна_Смирнова";
    const old = new Date(NOW.getTime()); old.setDate(old.getDate() - 120);
    const ls = mem({
      ["sa_mistakes" + uk]: JSON.stringify([
        { q: "Вопрос 1", options: ["а", "б"], correct: 1, stage: 2, due: 5, lessonId: "aq", lessonTitle: "Тест", kind: "quiz" },
        { q: "", options: [] },
      ]),
      ["sa_exam" + uk]: JSON.stringify({ seasonal: { passed: true, score: 92, correct: 11, total: 12, date: "2026-10-01" } }),
      ["sa_streak" + uk]: JSON.stringify({ count: 4, best: 9, last: "2026-10-12", days: ["x"] }),
      ["sa_activity" + uk]: JSON.stringify({ [ymd(NOW)]: { st: 2, w: 1, zz: 5 }, [ymd(old)]: { st: 1 }, bad: { st: 1 } }),
      ["sa_goal" + uk]: "3",
      ["sa_skills_анна|смирнова"]: JSON.stringify({ sk1: { mentor: "Мария", date: "2026-10-10", verified: true }, sk2: { hall: true, label: "В зале" } }),
      ["sa_completed" + uk]: JSON.stringify({ weekly_1: true, weekly_2: true, a1: true }),
      ["sa_warmup" + uk]: "2026-10-12",
    });
    const s = learningSnapshot(uk, { name: "Анна", surname: "Смирнова" }, ls, NOW);
    expect(s.mistakes).toEqual([{ q: "Вопрос 1", a: "б", st: 2, due: 5, l: "aq", t: "Тест", k: "quiz" }]);
    expect(s.exams.seasonal).toEqual({ passed: true, score: 92, correct: 11, total: 12, date: "2026-10-01" });
    expect([s.streak.count, s.streak.best, s.streak.last]).toEqual([4, 9, "2026-10-12"]);
    expect(s.streak.days).toEqual([]);   // v30: дни серии (только даты) — для «Свечи на двоих»
    expect(Object.keys(s.activity)).toEqual([ymd(NOW)]);
    expect(s.activity[ymd(NOW)]).toEqual({ st: 2, w: 1 });
    expect(s.goal).toBe(3);
    expect(s.skills.sk1).toEqual({ by: "Мария", date: "2026-10-10", hall: false, pin: true, label: "" });
    expect(s.skills.sk2.hall).toBe(true);
    expect(s.weekly).toBe(2);
    expect(s.warm).toBe("2026-10-12");
  });
  it("отпечаток: тот же снимок — тот же, другой — другой", () => {
    const a = { v: 1, mistakes: [{ q: "x" }] };
    expect(snapshotHash(a)).toBe(snapshotHash({ v: 1, mistakes: [{ q: "x" }] }));
    expect(snapshotHash(a)).not.toBe(snapshotHash({ v: 1, mistakes: [{ q: "y" }] }));
  });
});

describe("отправка копии (Доп. 309)", () => {
  let calls = [];
  const saved = {};
  beforeEach(() => {
    calls = [];
    saved.fetch = globalThis.fetch; saved.ls = globalThis.localStorage;
    _resetLearningSync();
  });
  afterEach(() => {
    globalThis.fetch = saved.fetch;
    if (saved.ls === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved.ls;
    _resetLearningSync();
  });
  const profile = { name: "Анна", surname: "Смирнова" };
  const uk = "_Анна_Смирнова";
  it("шлёт один раз, одинаковое не повторяет, без сервера этапа 23 — молчит", async () => {
    const ls = mem({ sa_session_token: "tok", ["sa_goal" + uk]: "2" });
    globalThis.localStorage = ls;
    globalThis.fetch = async (url, opt) => { calls.push({ url, body: JSON.parse(opt.body) }); return { json: async () => ({ ok: true }) }; };
    expect(await pushLearning({ uk, profile, storage: ls })).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].url.endsWith("/rpc/sa_learning_push")).toBe(true);
    expect(calls[0].body.p_token).toBe("tok");
    expect(await pushLearning({ uk, profile, storage: ls, force: true })).toBe(false);   // ничего не поменялось
    ls.setItem("sa_goal" + uk, "3");
    expect(await pushLearning({ uk, profile, storage: ls })).toBe(false);                // пауза 2 минуты
    expect(await pushLearning({ uk, profile, storage: ls, force: true })).toBe(true);    // при уходе в фон — сразу
    expect(calls.length).toBe(2);
    _resetLearningSync();
    globalThis.fetch = async () => ({ json: async () => ({ code: "PGRST202", message: "Could not find the function" }) });
    ls.setItem("sa_goal" + uk, "1");
    expect(await pushLearning({ uk, profile, storage: ls, force: true })).toBe(false);
    globalThis.fetch = async () => { throw new Error("не должен звать"); };
    ls.setItem("sa_goal" + uk, "2");
    expect(await pushLearning({ uk, profile, storage: ls, force: true })).toBe(false);
  });
  it("без входа — не шлёт", async () => {
    const ls = mem({});
    globalThis.localStorage = ls;
    globalThis.fetch = async () => { throw new Error("не должен звать"); };
    expect(await pushLearning({ uk, profile, storage: ls, force: true })).toBe(false);
    expect(await pushLearning({ uk, profile: null, storage: ls, force: true })).toBe(false);
  });
});

describe("у стола и разминка из вопросов тестов (Доп. 310)", () => {
  const bar = [
    { id: "x1", title: "Бар: основы", lessons: [
      { id: "x1-1", title: "Стекло", type: "lesson" },
      { id: "x1-q", title: "Тест: стекло", type: "quiz", questions: [
        { q: "Бокал для мартини?", options: ["Коктейльная рюмка", "Хайбол"], correct: 0, explanation: "V-образная рюмка." },
        { kind: "situation", q: "служебное" },
        { q: "Один вариант", options: ["а"], correct: 0 },
      ] },
    ] },
    { id: "x2", title: "Бар: лёд", lessons: [
      { id: "x2-q", title: "Тест: лёд", type: "quiz", questions: [{ q: "Какой лёд в виски?", options: ["Крупный", "Колотый"], correct: 0 }] },
    ] },
  ];
  it("вопрос теста становится заданием жанра quiz", () => {
    const pool = quizPool(bar[0]);
    expect(pool.length).toBe(1);
    expect(pool[0].genre).toBe("quiz");
    expect(pool[0].question).toBe("Бокал для мартини?");
    expect(pool[0].win).toBe("V-образная рюмка.");   // v75: без эмодзи в начале (на экране его и так срезали)
    expect(pool[0]._quiz).toBe(true);
    expect(practicePool(bar[0]).length).toBe(0);
    expect(tablePool(bar[0]).length).toBe(1);
    expect(tablePool(INDEX.seasonal[0])[0].genre).toBe("action");   // практика есть — берётся она
  });
  it("разминка в треке без практики: сначала сданные тесты, иначе первая тема", () => {
    expect(warmupPool(bar, {}, { "x2-q": true }).map((s) => s.question)).toEqual(["Какой лёд в виски?"]);
    expect(warmupPool(bar, {}, {}).map((s) => s.question)).toEqual(["Бокал для мартини?"]);
  });
});

describe("журнал дня: тренажёры и экзамен (Доп. 310)", () => {
  it("тренажёр и экзамен — шаги дня и строки чека недели", () => {
    const ls = mem();
    bumpActivity("_a", "trainer", 1, NOW, ls);
    bumpActivity("_a", "exam", 1, NOW, ls);
    const act = readActivity("_a", ls);
    const r = act[ymd(NOW)];
    expect([r.m, r.x, r.st, Object.keys(r).length]).toEqual([1, 1, 2, 3]);
    const w = weekSummary(act, { count: 1 }, NOW);
    expect([w.totals.m, w.totals.x, w.totals.st]).toEqual([1, 1, 2]);
    const t = weekShareText(w, { count: 1 }, "Анна");
    expect(t).toContain("1 тренировка в тренажёрах");
    expect(t).toContain("1 экзамен");
  });
  it("событие занятия без окна не падает, с окном — доходит", () => {
    expect(() => emitActivity("trainer")).not.toThrow();
    const got = [];
    const target = new EventTarget();
    const had = Object.prototype.hasOwnProperty.call(globalThis, "window");
    const prev = globalThis.window;
    globalThis.window = target;
    try {
      target.addEventListener(ACTIVITY_EVENT, (e) => got.push(e.detail.kind));
      emitActivity("exam");
    } finally { if (had) globalThis.window = prev; else delete globalThis.window; }
    expect(got).toEqual(["exam"]);
  });
});

describe("свои навыки разделов (Доп. 310)", () => {
  it("навык из редактора — не вопрос теста, а навык раздела", () => {
    const qs = [{ q: "Вопрос", options: ["а", "б"], correct: 0 }, { kind: "skill", sid: "k1", label: "Подача вина", hint: "Этикеткой к гостю" }, { kind: "skill", label: "  " }];
    const p = splitExtras(qs);
    expect(p.quiz.length).toBe(1);
    expect(p.skills).toEqual([{ sid: "k1", label: "Подача вина", hint: "Этикеткой к гостю" }]);
    const mods = buildCustomModules([{ id: 7, role: "seasonal", module: "Вино", title: "Подача", content: "…", questions: qs }], "seasonal", { color: "#123456" });
    expect(mods[0].skills).toEqual([{ id: "cms-s-k1", label: "Подача вина", hint: "Этикеткой к гостю", custom: true, section: "Вино" }]);
    expect(mods[0].lessons.find((l) => l.type === "quiz").questions.length).toBe(1);
  });
});

describe("Наставник знает ритм дня (Доп. 310)", () => {
  it("серия, цель и разминка — в контексте вопроса", () => {
    const out = withRefContext([{ role: "user", content: "как у меня дела?" }], { position: "waiter" },
      { position: "waiter", streak: 4, steps: 1, goal: 2, warmup: "open" });
    const c = out[out.length - 1].content;
    expect(c).toContain("серия занятий: 4 дн.");
    expect(c).toContain("цель дня: 1 из 2 шагов");
    expect(c).toContain("разминка до смены сегодня ещё не сделана");
  });
});
