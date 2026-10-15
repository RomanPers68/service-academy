// v40: «Путь мастера» — значки по каждому инструменту (бронза / серебро / золото), «Мастер роли ✦»,
// «Шаг дня» и «Первая неделя» для новичков. Считается на телефоне: журнал дня (75 дней) плюс новые
// счётчики за всё время (sa_life), золото, серия, квесты, навыки в зале. Итог уходит в копию
// на сервер и в отчёт руководителя (экран, PDF, Excel).
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { bumpActivity, readActivity, readLife, syncLife, ACTIVITY_FIELDS } from "../lib/activity";
import {
  TIERS, FAMILIES, FIRST_WEEK, readLife as readLifeM, syncLife as syncLifeM, masteryFacts, familyState, masteryState,
  stepOfDay, readEarned, saveEarned, newlyEarned, mergeEarned, saveSummary, familyCount, masteryFromCopy,
} from "../lib/mastery";
import { learningSnapshot } from "../lib/learning-sync";
import { personModel, stepIndex } from "../lib/report-model";
import { teamSheets } from "../lib/report-xlsx";
import { personPdf } from "../lib/report-pdf";

// Шины для рендера блока отчёта в node — как в tests/smoke-render.test.jsx
const store = {};
if (typeof globalThis.localStorage === "undefined") globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: (i) => Object.keys(store)[i] || null, get length() { return Object.keys(store).length; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), head: { appendChild() {} } };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

function mem(init = {}) {
  const o = { ...init };
  return { o, get length() { return Object.keys(o).length; }, key: (i) => Object.keys(o)[i], getItem: (k) => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: (k) => { delete o[k]; } };
}
const D = (s, h = 12) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, h); };
const NOW = D("2026-10-12", 15);
const UK = "_Анна_Петрова";
const PROFILE = { name: "Анна", surname: "Петрова" };
const GO = ["track", "practice", "dialogue", "refresh", "gold", "warmup", "radio", "guest", "mistakes", "menu", "quest", "mentor"];
const MODS = [
  { id: "m1", title: "Встреча гостя", lessons: [{ id: "a1", type: "lesson" }, { id: "a2", type: "practice" }, { id: "aq", type: "quiz" }, { id: "ar", type: "result" }] },
  { id: "m2", title: "Заказ", lessons: [{ id: "b1", type: "lesson" }, { id: "bq", type: "quiz" }] },
  { id: "m3", title: "Вина", lessons: [{ id: "c1", type: "lesson" }] },
  { id: "m4", title: "Итоги", lessons: [{ id: "x", type: "result" }] },   // одни итоги — не раздел
];
const fam = (id) => FAMILIES.find((f) => f.id === id);
const tierOf = (state, id) => state.families.find((f) => f.id === id).tier;

// Телефон опытной сотрудницы: журнал, счётчики за всё время, золото, серия, квесты, навыки, ошибки
function veteranPhone() {
  return mem({
    ["sa_activity" + UK]: JSON.stringify({ "2026-10-10": { st: 3, l: 1, p: 1, q: 1, s: 6, w: 1 }, "2026-10-11": { st: 2, d: 1, u: 2, r: 1, s: 4 }, "2026-10-12": { st: 3, g: 1, m: 2, f: 3 } }),
    ["sa_life" + UK]: JSON.stringify({ s: 40, w: 2, l: 5, st: 20, since: "2026-09-01" }),
    ["sa_gold" + UK]: JSON.stringify({ m1: { d: "2026-10-01", w: 0, sec: 50 }, m2: { d: "2026-10-02", w: 1, sec: 70 }, junk: 5 }),
    ["sa_streak" + UK]: JSON.stringify({ count: 4, best: 9, last: "2026-10-12", days: ["2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"] }),
    ["sa_quest_done" + UK]: JSON.stringify(["2026-10-10", "2026-10-11", "2026-10-11", "мусор"]),
    ["sa_skills_анна|петрова"]: JSON.stringify({ s1: { mentor: "Мария", hall: true, verified: true }, s2: { mentor: "Пётр", verified: true }, s3: { mentor: "Ольга" } }),
    ["sa_mistakes" + UK]: JSON.stringify([{ q: "1", due: 0 }, { q: "2", due: NOW.getTime() - 1000 }, { q: "3", due: NOW.getTime() + 86400000 }]),
  });
}
const veteranFacts = (ls) => masteryFacts({
  uk: UK, storage: ls, role: "seasonal", modules: MODS, profile: PROFILE, now: NOW,
  completed: { a1: true, a2: true, b1: true, c1: true }, quizDone: { aq: true },
  scores: [{ lessonId: "aq", pct: 100 }, { lessonId: "aq", pct: 100 }, { quiz_id: "bq", score: 12, total: 12 }, { lessonId: "cq", pct: 92 }, { lessonId: "", pct: 100 }, null],
});

// Готовые факты для шага дня: опытный сотрудник (первая неделя давно позади)
const VET = (life = {}, more = {}) => ({
  life: { st: 50, l: 20, p: 5, q: 5, s: 25, d: 2, w: 14, r: 4, g: 1, m: 11, f: 0, u: 0, o: 0, ...life },
  sectionsDone: 1, sectionsTotal: 3, perfectTests: 0, gold: 0, streakBest: 3, questsDone: 0, hallSkills: 1, roleDone: false,
  firstDay: "2026-08-01", streakNow: 0, mistakesDue: 0, shiftToday: null, ...more,
});
// всё на золоте или заняться нечем
const TOP = (more = {}) => ({
  life: { st: 999, l: 99, s: 300, d: 25, w: 40, r: 40, g: 30, m: 150, q: 20 }, sectionsDone: 3, sectionsTotal: 3, roleDone: true, perfectTests: 10,
  gold: 10, streakBest: 30, streakNow: 0, questsDone: 0, hallSkills: 15, firstDay: "2026-08-01", mistakesDue: 0, shiftToday: null, ...more,
});
const NEWBIE = (life = {}) => ({ life: { ...life }, sectionsDone: 0, sectionsTotal: 3, perfectTests: 0, gold: 0, streakBest: 0, questsDone: 0, hallSkills: 0, roleDone: false, firstDay: null, streakNow: 0, mistakesDue: 0, shiftToday: null });
const step = (facts, opt = {}) => {
  const ls = opt.ls || mem();
  return stepOfDay({ state: masteryState(facts, "seasonal", { now: NOW }), facts, uk: UK, storage: ls, day: "2026-10-12", ...opt });
};

describe("счётчики за всё время (sa_life)", () => {
  it("bumpActivity прибавляет к ним то же, что к записи дня, и st за шаг", () => {
    const ls = mem();
    bumpActivity("_a", "lesson", 2, D("2026-10-12"), ls);
    bumpActivity("_a", "sit", 3, D("2026-10-12"), ls);
    bumpActivity("_a", "warmup", 1, D("2026-10-13"), ls);
    bumpActivity("_a", "unknown", 5, D("2026-10-13"), ls);
    const life = readLife("_a", ls);
    expect([life.l, life.s, life.w, life.st]).toEqual([2, 3, 1, 3]);
    expect(life.since).toBe("2026-10-12");
    expect(Object.keys(life)).toEqual([...ACTIVITY_FIELDS, "since"]);
    const day = readActivity("_a", ls)["2026-10-12"];
    expect([day.l, day.s, day.st]).toEqual([2, 3, 2]);
    expect(JSON.parse(ls.getItem("sa_life_a")).st).toBe(3);
    expect(readLife("_b", ls).st).toBe(0);      // у каждого свои
    expect(readLife("_b", ls).since).toBe("");
    expect(readLifeM).toBe(readLife);          // из lib/mastery — то же самое
    expect(syncLifeM).toBe(syncLife);
  });
  it("все новые шаги v30 тоже копятся: гость, радио, освежить, золото, зачёт, тренажёр, экзамен", () => {
    const ls = mem();
    ["guest", "radio", "refresh", "gold", "credit", "trainer", "exam", "fix", "check"].forEach((k) => bumpActivity("_a", k, 1, NOW, ls));
    const l = readLife("_a", ls);
    expect([l.g, l.r, l.u, l.o, l.k, l.m, l.x, l.f, l.c, l.st]).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 7]);
  });
  it("первая запись берёт историю журнала — у тех, кто занимался до v40, ничего не пропадает", () => {
    const ls = mem({ sa_activity_a: JSON.stringify({ "2026-09-01": { l: 4, st: 4 }, "2026-10-01": { w: 2, st: 2, s: 7 } }) });
    bumpActivity("_a", "warmup", 1, D("2026-10-12"), ls);
    const life = readLife("_a", ls);
    expect([life.l, life.w, life.s, life.st]).toEqual([4, 3, 7, 7]);
    expect(life.since).toBe("2026-09-01");
  });
  it("журнал забыл старые дни — счётчик помнит", () => {
    const ls = mem();
    bumpActivity("_a", "lesson", 1, D("2026-07-01"), ls);
    bumpActivity("_a", "lesson", 1, D("2026-10-12"), ls);   // через 103 дня 1 июля из журнала ушло
    expect(Object.keys(readActivity("_a", ls))).toEqual(["2026-10-12"]);
    expect(readLife("_a", ls).l).toBe(2);
    expect(readLife("_a", ls).since).toBe("2026-07-01");
    expect(syncLife("_a", ls, D("2026-10-12")).l).toBe(2);   // журнал меньше — счётчик не уменьшается
  });
  it("syncLife: большее из записанного и журнала, самый ранний день, сохраняет; мусор не ломает", () => {
    const ls = mem({
      sa_activity_a: JSON.stringify({ "2026-10-01": { r: 2, st: 2 }, "2026-10-05": { g: 1, st: 1, f: 4 }, bad: { r: 9 } }),
      sa_life_a: JSON.stringify({ r: 1, g: 5, st: 1, since: "2026-10-03" }),
    });
    const life = syncLife("_a", ls, D("2026-10-12"));
    expect([life.r, life.g, life.f, life.st]).toEqual([2, 5, 4, 3]);
    expect(life.since).toBe("2026-10-01");
    expect(JSON.parse(ls.getItem("sa_life_a"))).toEqual(life);
    expect(syncLife("_a", ls, D("2026-10-13"))).toEqual(life);
    const empty = syncLife("_z", mem(), D("2026-10-12"));
    expect([empty.st, empty.since]).toEqual([0, ""]);           // занятий не было — «первого дня» ещё нет
    expect(syncLife("_b", mem({ sa_life_b: JSON.stringify({ w: 3 }) }), D("2026-10-12")).since).toBe("2026-10-12");   // счёт без даты — с сегодня
    expect(readLife("_c", mem({ sa_life_c: "[1,2]" })).w).toBe(0);
    expect(readLife("_c", mem({ sa_life_c: JSON.stringify({ w: -4, r: "x", since: "вчера" }) }))).toMatchObject({ w: 0, r: 0, since: "" });
  });
});

describe("семейства, ступени и факты", () => {
  it("14 семейств в договорённом порядке, у каждого все поля; пороги как в задании", () => {
    expect(TIERS).toEqual(["", "бронза", "серебро", "золото"]);
    expect(FAMILIES.map((f) => f.id)).toEqual(["track", "tests", "table", "dialogue", "fresh", "gold", "warmup", "radio", "guest", "fixes", "decks", "streak", "quest", "hall"]);
    expect(FAMILIES.map((f) => f.title)).toEqual(["Трек", "Тесты на отлично", "Практика у стола", "Живой диалог", "Свежесть тем", "Раунд мастера", "Разминка до смены",
      "Радио в дорогу", "Живой гость", "Работа над ошибками", "Колоды и тренажёры", "Свеча", "Квест смены", "Навыки в зале"]);
    expect(FAMILIES.slice(1).map((f) => f.tiers)).toEqual([[1, 5, 10], [20, 100, 300], [1, 10, 25], [3, 15, 40], [1, 5, 10], [3, 15, 40], [3, 15, 40], [1, 10, 30], [5, 30, 100], [10, 50, 150], [3, 7, 30], [1, 10, 30], [1, 5, 15]]);
    expect(FAMILIES.map((f) => f.go)).toEqual(["track", "track", "practice", "dialogue", "refresh", "gold", "warmup", "radio", "guest", "mistakes", "menu", "track", "quest", "mentor"]);
    expect(fam("track").tiers({ sectionsTotal: 7 })).toEqual([1, 4, 7]);
    expect(fam("track").tiers({ sectionsTotal: 2 })).toEqual([1, 1, 2]);
    expect(fam("radio").how).toBe("Включи «Радио в дорогу» по пути на смену — три коротких выпуска из твоих уроков.");
    for (const f of [...FAMILIES, ...FIRST_WEEK]) {
      for (const k of ["id", "title", "how", "go"]) expect(typeof f[k], f.id + "." + k).toBe("string");
      expect(GO, f.id).toContain(f.go);
      expect(f.how, f.id).toMatch(/^[А-ЯЁ].{20,}\.$/);
      expect(f.how + f.title, f.id).not.toMatch(/["']| - |\s{2}/);
      expect((f.how.match(/«/g) || []).length, f.id).toBe((f.how.match(/»/g) || []).length);
    }
    for (const f of FAMILIES) { expect(typeof f.icon).toBe("string"); expect(typeof f.what).toBe("string"); expect(f.unit.length).toBe(3); }
    expect(fam("fresh").what).toBe("тем освежено");
  });
  it("ступень, следующий порог и сколько осталось", () => {
    const s = (n) => { const x = familyState(fam("table"), { life: { s: n } }); return [x.tier, x.next, x.left]; };
    expect([s(0), s(19), s(20), s(99), s(100), s(300), s(1000)]).toEqual([[0, 20, 20], [0, 20, 1], [1, 100, 80], [1, 100, 1], [2, 300, 200], [3, null, null], [3, null, null]]);
    const x = familyState(fam("track"), { sectionsDone: 4, sectionsTotal: 7 });
    expect(x).toMatchObject({ id: "track", title: "Трек", icon: "📚", what: "разделов пройдено", go: "track", value: 4, tiers: [1, 4, 7], tier: 2, next: 7, left: 3, tierName: "серебро" });
    for (const k of ["id", "title", "icon", "what", "how", "go", "value", "tiers", "tier", "next", "left"]) expect(k in x, k).toBe(true);
    expect(familyState("radio", { life: { r: 3 } }).tier).toBe(1);               // можно и по id
    expect(familyState(fam("track"), { sectionsDone: 0, sectionsTotal: 0 })).toMatchObject({ tier: 0, tiers: [1, 1, 1], next: 1 });   // роли без разделов — без деления на ноль
    expect(familyState(fam("track"), { sectionsDone: 1, sectionsTotal: 2 })).toMatchObject({ tier: 2, next: 2, left: 1 });             // [1, 1, 2]: один раздел — сразу серебро
    expect(familyState("nope", {})).toBe(null);
  });
  it("«N …» с верным окончанием", () => {
    expect([1, 3, 5, 11, 21, 22].map((n) => familyCount("fresh", n))).toEqual(["1 тема освежена", "3 темы освежены", "5 тем освежено", "11 тем освежено", "21 тема освежена", "22 темы освежены"]);
    expect(familyCount(fam("track"), 2)).toBe("2 раздела пройдены");
  });
  it("каждое семейство берёт своё: разделы, тесты на 100%, журнал и счётчики, золото, серия, квесты, навыки", () => {
    const ls = veteranPhone();
    const f = veteranFacts(ls);
    expect([f.sectionsDone, f.sectionsTotal, f.roleDone]).toEqual([2, 3, false]);   // «Заказ» без теста — не пройден; «Итоги» — не раздел
    expect(f.perfectTests).toBe(2);           // aq дважды, bq 12/12; 92% и пустой id — нет
    expect([f.gold, f.streakBest, f.questsDone, f.hallSkills]).toEqual([2, 9, 2, 2]);
    expect(f.firstDay).toBe("2026-09-01");
    expect([f.streakNow, f.mistakesDue, f.shiftToday]).toEqual([4, 2, null]);
    // счётчик за всё время, но не меньше журнала: s 40 > 10, w 2 > 1, p 1 из журнала
    expect([f.life.s, f.life.w, f.life.p, f.life.d, f.life.u, f.life.r, f.life.g, f.life.f, f.life.m, f.life.q, f.life.since]).toEqual([40, 2, 1, 1, 2, 1, 1, 3, 2, 1, "2026-09-01"]);
    const st = masteryState(f, "seasonal", { now: NOW });
    expect(Object.fromEntries(st.families.map((x) => [x.id, x.value]))).toEqual({ track: 2, tests: 2, table: 40, dialogue: 1, fresh: 2, gold: 2, warmup: 2, radio: 1, guest: 1, fixes: 3, decks: 2, streak: 9, quest: 2, hall: 2 });
    expect(Object.fromEntries(st.families.map((x) => [x.id, x.tier]))).toEqual({ track: 2, tests: 1, table: 1, dialogue: 1, fresh: 0, gold: 1, warmup: 0, radio: 0, guest: 1, fixes: 0, decks: 0, streak: 2, quest: 1, hall: 1 });
    expect([st.bronze, st.total]).toEqual([9, 14]);
  });
  it("освежения считает и свежесть тем (n) — освежённое раньше журнала не теряется", () => {
    const ls = mem({ ["sa_fresh" + UK]: JSON.stringify({ m1: { t: 1, n: 3 }, m3: { t: 2, n: 2 }, bad: 5 }), ["sa_activity" + UK]: JSON.stringify({ "2026-10-11": { u: 1, st: 1 } }) });
    const f = masteryFacts({ uk: UK, storage: ls, now: NOW });
    expect(f.life.u).toBe(5);
    expect(familyState("fresh", f)).toMatchObject({ value: 5, tier: 1, next: 15, left: 10 });
    expect(masteryFacts({ uk: UK, storage: mem({ ["sa_activity" + UK]: JSON.stringify({ "2026-10-11": { u: 4, st: 4 } }) }), now: NOW }).life.u).toBe(4);
  });
  it("syncLife ещё не звали — факты всё равно не меньше журнала; телефон без данных — нули", () => {
    const ls = mem({ ["sa_activity" + UK]: JSON.stringify({ "2026-10-11": { r: 3, st: 3 } }) });
    expect(masteryFacts({ uk: UK, storage: ls, now: NOW }).life.r).toBe(3);
    expect(ls.getItem("sa_life" + UK)).toBe(null);   // факты ничего не пишут
    const z = masteryFacts({ uk: "_x", storage: mem(), now: NOW });
    expect([z.sectionsTotal, z.perfectTests, z.gold, z.streakBest, z.questsDone, z.hallSkills, z.roleDone, z.firstDay]).toEqual([0, 0, 0, 0, 0, 0, false, null]);
  });
  it("серия жива через выходной по графику, оборванная — ноль", () => {
    const sched = { cfg: { staff: [{ id: "e1", name: "Анна Петрова" }], shifts: [{ k: "Д", name: "День", from: 10, to: 22 }] }, plan: { e1: { 9: "Д", 12: "Д" } }, ts: 1 };
    const ls = mem({ ["sa_streak" + UK]: JSON.stringify({ count: 5, best: 5, last: "2026-10-09" }), "sa_sched_cache_Океан_2026-10": JSON.stringify(sched) });
    const f = masteryFacts({ uk: UK, storage: ls, profile: PROFILE, now: NOW });
    expect([f.streakNow, f.shiftToday]).toEqual([5, true]);   // 10 и 11 — выходные, 12 — смена
    const ls2 = mem({ ["sa_streak" + UK]: JSON.stringify({ count: 5, best: 5, last: "2026-10-09" }) });
    expect(masteryFacts({ uk: UK, storage: ls2, profile: PROFILE, now: NOW }).streakNow).toBe(0);
  });
});

describe("«Мастер роли ✦» и «Первая неделя»", () => {
  it("части мастера и счёт have/need: роль, 5 золотых, серия 14, бронза в 10 семействах", () => {
    const part = masteryState({ life: { s: 25, d: 1, u: 3, w: 3, r: 3, g: 1 }, sectionsDone: 2, sectionsTotal: 3, gold: 2, streakBest: 10 }, "seasonal", { now: NOW });
    expect(part.master).toMatchObject({ role: "seasonal", ok: false, need: 13 });
    expect(part.master.parts.map((p) => [p.id, p.label, p.done, p.value, p.need])).toEqual([
      ["role", "Роль пройдена", false, 2, 3], ["gold", "5 золотых тем", false, 2, 5], ["streak", "Серия 14 дней", false, 10, 14], ["bronze", "Бронза в 10 значках", false, 9, 10]]);
    expect(part.bronze).toBe(9);   // трек, стол, диалог, свежесть, золото, разминка, радио, гость, свеча
    expect(part.master.have).toBe(9);
    const full = masteryState({ life: { s: 20, d: 1, u: 3, w: 3, r: 3, g: 1, f: 5, m: 10 }, sectionsDone: 3, sectionsTotal: 3, roleDone: true, perfectTests: 1, gold: 5, streakBest: 14, questsDone: 1, hallSkills: 1 }, "bar", { now: NOW });
    expect(full.bronze).toBe(14);
    expect(full.master).toMatchObject({ role: "bar", ok: true, have: 13, need: 13 });
    expect(full.master.parts.map((p) => p.value)).toEqual([3, 5, 14, 10]);   // бронзы 14, в счёт — не больше 10
    const noBronze = masteryState({ sectionsDone: 3, sectionsTotal: 3, roleDone: true, gold: 5, streakBest: 14 }, "bar", { now: NOW });
    expect([noBronze.master.have, noBronze.master.ok]).toEqual([3 + noBronze.bronze, false]);
    expect(masteryState({ sectionsDone: 0, sectionsTotal: 0, roleDone: true }, "x", { now: NOW }).master.parts[0].done).toBe(false);   // роль без разделов не «пройдена»
  });
  it("первая неделя: открыта до первого занятия и 14 дней после; семь заданий; закрывается, когда всё сделано", () => {
    const fresh = masteryState(NEWBIE(), "seasonal", { now: NOW }).firstWeek;
    expect(fresh).toMatchObject({ done: 0, total: 7, active: true, inWindow: true, daysLeft: 14 });
    expect(fresh.items.map((i) => i.id)).toEqual(["warmup", "dialogue", "practice", "radio", "guest", "decks", "quiz"]);
    expect(fresh.items.map((i) => i.go)).toEqual(["warmup", "dialogue", "practice", "radio", "guest", "menu", "track"]);
    const day8 = masteryState({ ...NEWBIE({ w: 1, s: 2, q: 1 }), firstDay: "2026-10-05" }, "seasonal", { now: NOW }).firstWeek;
    expect(day8.items.filter((i) => i.done).map((i) => i.id)).toEqual(["warmup", "practice", "quiz"]);   // практика — и по ситуациям
    expect([day8.done, day8.active, day8.daysLeft]).toEqual([3, true, 7]);
    expect(masteryState({ ...NEWBIE({ p: 1 }), firstDay: "2026-09-29" }, "seasonal", { now: NOW }).firstWeek.active).toBe(true);    // 13-й день
    expect(masteryState({ ...NEWBIE({ p: 1 }), firstDay: "2026-09-28" }, "seasonal", { now: NOW }).firstWeek).toMatchObject({ active: false, inWindow: false, daysLeft: 0 });   // 14 дней прошло
    const all = masteryState({ ...NEWBIE({ w: 1, d: 1, p: 1, r: 1, g: 1, m: 1, q: 1 }), firstDay: "2026-10-10" }, "seasonal", { now: NOW }).firstWeek;
    expect([all.done, all.active, all.inWindow]).toEqual([7, false, true]);
  });
});

describe("шаг дня", () => {
  it("1) выдохшаяся тема — освежить (годятся и записи fadedList)", () => {
    const s = step(VET(), { faded: [{ mod: { id: "m1", title: "Встреча гостя" }, f: { level: "faded" } }] });
    expect(s).toMatchObject({ id: "fresh:m1", text: "Освежи тему «Встреча гостя»", sub: "3 ситуации · 1 мин — тема снова свежая", go: "refresh", payload: { mod: "m1" }, done: false });
    expect(step(NEWBIE(), { faded: [{ id: "m2", title: "Заказ" }] }).id).toBe("fresh:m2");   // и новичку — раньше заданий недели
  });
  it("2) новичку — задание «Первой недели», которое ещё не сделано", () => {
    const s = step(NEWBIE({ w: 1, d: 1, p: 1, r: 1, g: 1, m: 1 }));
    expect(s).toMatchObject({ id: "first:quiz", text: "Сдай первый тест", go: "track", done: false });
    expect(s.sub).toBe(FIRST_WEEK.find((m) => m.id === "quiz").how);
    expect(step(NEWBIE()).id).toMatch(/^first:/);
  });
  it("3) инструмент, которым не пользовался, — «Попробуй: …»; туда, где делать нечего, не зовёт", () => {
    const s = step(VET({}, { hallSkills: 0 }));
    expect(s).toMatchObject({ id: "try:hall", text: "Попробуй: Навыки в зале", go: "mentor", sub: fam("hall").how });
    // квест — только в день смены, ошибки — только когда есть что повторить, разминка — не в выходной
    expect(step(VET({ f: 0 }, { mistakesDue: 3 })).id).toBe("try:fixes");
    expect(step(VET({}, { shiftToday: true })).id).toBe("try:quest");
    const off = step(VET({ w: 0 }, { shiftToday: false }));
    expect(off.id).not.toMatch(/warmup/);
  });
  it("4) раунд мастера по пройденной теме", () => {
    expect(step(VET(), { goldable: [{ id: "m2", title: "Заказ" }] })).toMatchObject({ id: "gold:m2", text: "Раунд мастера: «Заказ»", sub: "8 заданий → тема золотая", go: "gold", payload: { mod: "m2" } });
  });
  it("5) ближе всех к следующей ступени — «Ещё N … до серебра «…»»", () => {
    const s = step(VET());   // разминок 14 из 15
    expect(s).toMatchObject({ id: "tier:warmup", text: "Ещё 1 разминка до серебра «Разминка до смены»", go: "warmup", sub: fam("warmup").how });
    expect(step(VET({ w: 3, s: 95 })).text).toBe("Ещё 5 ситуаций до серебра «Практика у стола»");
    // у свечи — текущая серия: лучшая 5 (бронза), сейчас 4 → до серебра (7) ещё 3 дня
    expect(step(TOP({ streakBest: 5, streakNow: 4 })).text).toBe("Ещё 3 дня серии до серебра «Свеча»");
    expect(step(TOP({ hallSkills: 14 })).text).toBe("Ещё 1 навык до золота «Навыки в зале»");
  });
  it("6) всё на золоте — следующий урок или «Продолжи трек»; шаг есть всегда", () => {
    const nx = step(TOP(), { next: { mod: { id: "m3", title: "Вина" }, lesson: { id: "c2", title: "Игристое" } } });
    expect(nx).toMatchObject({ id: "next:c2", text: "Следующий шаг: «Игристое»", go: "track", payload: { mod: "m3", lesson: "c2" } });
    expect(step(TOP(), { next: { title: "Игристое" } }).text).toBe("Следующий шаг: «Игристое»");
    expect(step(TOP())).toMatchObject({ id: "track", text: "Продолжи трек", go: "track", payload: null });
    const any = stepOfDay({ storage: mem() });
    expect(typeof any.text).toBe("string");
    expect(any.text.length).toBeGreaterThan(3);
  });
  it("один шаг на весь день: запоминается в sa_step, назавтра — новый", () => {
    const ls = mem();
    const a = step(VET(), { ls, faded: [{ id: "m1", title: "Встреча гостя" }] });
    const saved = JSON.parse(ls.getItem("sa_step" + UK));
    expect(saved).toMatchObject({ day: "2026-10-12", id: "fresh:m1", text: a.text, sub: a.sub, go: "refresh", payload: { mod: "m1" } });
    const b = step(VET({}, { hallSkills: 0 }), { ls, faded: [] });     // другие данные — тот же шаг
    expect([b.id, b.text, b.done]).toEqual(["fresh:m1", a.text, false]);
    const c = step(VET({}, { hallSkills: 0 }), { ls, faded: [], day: "2026-10-13" });
    expect(c.id).toBe("try:hall");
  });
  it("сделал — тот же шаг с done: true", () => {
    // задание первой недели
    let ls = mem();
    expect(step(NEWBIE({ w: 1, d: 1, p: 1, r: 1, g: 1, m: 1 }), { ls }).done).toBe(false);
    expect(step(NEWBIE({ w: 1, d: 1, p: 1, r: 1, g: 1, m: 1, q: 1 }), { ls })).toMatchObject({ id: "first:quiz", done: true });
    // освежил тему
    ls = mem();
    step(VET(), { ls, faded: [{ id: "m1", title: "Встреча гостя" }] });
    expect(step(VET(), { ls }).done).toBe(false);
    ls.setItem("sa_fresh" + UK, JSON.stringify({ m1: { t: Date.now() + 60000, n: 1 } }));
    expect(step(VET(), { ls }).done).toBe(true);
    // попробовал
    ls = mem();
    step(VET({}, { hallSkills: 0 }), { ls });
    expect(step(VET({}, { hallSkills: 1 }), { ls })).toMatchObject({ id: "try:hall", done: true });
    // золотая тема
    ls = mem();
    step(VET(), { ls, goldable: [{ id: "m2", title: "Заказ" }] });
    ls.setItem("sa_gold" + UK, JSON.stringify({ m2: { d: "2026-10-12", w: 0, sec: 40 } }));
    expect(step(VET(), { ls })).toMatchObject({ id: "gold:m2", done: true });
    // ещё одна разминка
    ls = mem();
    step(VET(), { ls });
    expect(step(VET({ w: 15 }), { ls })).toMatchObject({ id: "tier:warmup", done: true });
    // следующий урок пройден
    ls = mem();
    step(TOP(), { ls, next: { mod: { id: "m3" }, lesson: { id: "c2", title: "Игристое" } } });
    expect(step(TOP(), { ls }).done).toBe(false);
    ls.setItem("sa_completed" + UK, JSON.stringify({ c2: true }));
    expect(step(TOP(), { ls })).toMatchObject({ id: "next:c2", done: true });
    // «Продолжи трек» — любой шаг за день
    ls = mem();
    step(TOP(), { ls });
    expect(step(TOP({ life: { ...TOP().life, st: 1000 } }), { ls })).toMatchObject({ id: "track", done: true });
  });
  it("равные по важности — по очереди: от дня и сотрудника, в один день одно и то же", () => {
    const faded = [{ id: "a", title: "А" }, { id: "b", title: "Б" }, { id: "c", title: "В" }];
    const days = Array.from({ length: 20 }, (_, i) => "2026-10-" + String(i + 1).padStart(2, "0"));
    const picks = days.map((day) => step(VET(), { faded, day }).id);
    expect(new Set(picks).size).toBeGreaterThan(1);
    expect(picks.every((p) => /^fresh:[abc]$/.test(p))).toBe(true);
    expect(days.map((day) => step(VET(), { faded, day }).id)).toEqual(picks);   // повторяемо
    const tries = days.map((day) => step(VET({}, { hallSkills: 0, shiftToday: true }), { day }).id);
    expect([...new Set(tries)].sort()).toEqual(["try:hall", "try:quest"]);
    const people = ["_a", "_b", "_c", "_d", "_e", "_f"].map((uk) => stepOfDay({ state: masteryState(VET(), null), facts: VET(), faded, uk, storage: mem(), day: "2026-10-12" }).id);
    expect(new Set(people).size).toBeGreaterThan(1);
  });
});

describe("новые значки и итог для копии", () => {
  it("newlyEarned: только то, чего ещё нет в записи; запись не меняется; первая запись помечена", () => {
    const ls = veteranPhone();
    const st = masteryState(veteranFacts(ls), "seasonal", { now: NOW });
    const e0 = readEarned(UK, ls);
    expect(e0).toEqual({ tiers: {}, fw: false, master: {}, first: true });
    const news = newlyEarned(st, e0);
    expect(news.length).toBe(9);
    expect(news.slice(0, 2)).toEqual([{ kind: "tier", id: "track", title: "Трек", tier: 2 }, { kind: "tier", id: "streak", title: "Свеча", tier: 2 }]);
    expect(news.some((n) => n.kind !== "tier")).toBe(false);   // неделя давно прошла, мастера нет
    const e1 = { tiers: { track: 1, streak: 2, table: 3 }, fw: false, master: {} };
    const before = JSON.stringify(e1);
    const n1 = newlyEarned(st, e1);
    expect(JSON.stringify(e1)).toBe(before);
    expect(n1.find((n) => n.id === "track")).toEqual({ kind: "tier", id: "track", title: "Трек", tier: 2 });
    expect(n1.some((n) => n.id === "streak" || n.id === "table")).toBe(false);   // та же или ниже — не новость
    saveEarned(UK, mergeEarned(e0, news, "2026-10-12"), ls);
    const e2 = readEarned(UK, ls);
    expect(e2.first).toBe(undefined);
    expect(e2.tiers.track).toBe(2);
    expect(newlyEarned(st, e2)).toEqual([]);
  });
  it("«Мастер роли» и «Первая неделя» — новостью один раз", () => {
    const facts = { life: { s: 20, d: 1, u: 3, w: 3, r: 3, g: 1, f: 5, m: 10, p: 1, q: 1 }, sectionsDone: 3, sectionsTotal: 3, roleDone: true, perfectTests: 1, gold: 5, streakBest: 14, questsDone: 1, hallSkills: 1, firstDay: "2026-10-01" };
    const st = masteryState(facts, "seasonal", { now: NOW });
    const news = newlyEarned(st, {});
    expect(news.slice(0, 2)).toEqual([{ kind: "master", role: "seasonal" }, { kind: "firstWeek" }]);
    expect(news.length).toBe(16);
    const e = mergeEarned({}, news, "2026-10-12");
    expect(e.master).toEqual({ seasonal: "2026-10-12" });
    expect(e.fw).toBe(true);
    expect(newlyEarned(st, e)).toEqual([]);
    // неделя закончилась без всех заданий — праздника «Первой недели» нет
    const late = masteryState({ ...facts, firstDay: "2026-09-01" }, "seasonal", { now: NOW });
    expect(newlyEarned(late, {}).some((n) => n.kind === "firstWeek")).toBe(false);
  });
  it("saveSummary: ступени, сколько, бронза, неделя, роли мастера, шаг дня; значки не отнимаются", () => {
    const ls = veteranPhone();
    const facts = veteranFacts(ls);
    const st = masteryState(facts, "seasonal", { now: NOW });
    const s = stepOfDay({ state: st, facts, faded: [{ id: "m1", title: "Встреча гостя" }], uk: UK, storage: ls, day: "2026-10-12" });
    const sum = saveSummary(UK, st, s, ls);
    expect(sum.tiers).toEqual({ track: 2, tests: 1, table: 1, dialogue: 1, gold: 1, guest: 1, streak: 2, quest: 1, hall: 1 });
    expect([sum.bronze, sum.fw, sum.vals.table, sum.vals.fixes]).toEqual([9, false, 40, 3]);
    expect(sum.master).toEqual([]);
    expect(sum.step).toEqual({ day: "2026-10-12", t: "Освежи тему «Встреча гостя»" });
    expect(JSON.parse(ls.getItem("sa_mastery_sum" + UK))).toEqual(sum);
    // отпразднованное выше нынешнего — остаётся; «Мастер роли» — и после смены роли
    saveEarned(UK, { tiers: { fresh: 1, track: 3 }, fw: false, master: { bar: "2026-09-30" } }, ls);
    const sum2 = saveSummary(UK, st, null, ls);
    expect([sum2.tiers.fresh, sum2.tiers.track, sum2.bronze]).toEqual([1, 3, 10]);
    expect(sum2.master).toEqual(["bar"]);
    expect("step" in sum2).toBe(false);
    const okState = { ...st, master: { ...st.master, role: "seasonal", ok: true } };
    expect(saveSummary(UK, okState, null, ls).master).toEqual(["bar", "seasonal"]);
    saveEarned(UK, {}, ls);
    expect(saveSummary(UK, st, null, ls).master).toEqual(["bar", "seasonal"]);   // и без записи праздников
  });
  it("копия на сервер несёт mastery: { life, …итог }, числа в пределах; нет данных — поля нет", () => {
    const ls = veteranPhone();
    const facts = veteranFacts(ls);
    const st = masteryState(facts, "seasonal", { now: NOW });
    const sum = saveSummary(UK, st, { day: "2026-10-12", text: "Ещё 1 разминка до серебра «Разминка до смены»" }, ls);
    const snap = learningSnapshot(UK, PROFILE, ls, NOW);
    expect(snap.mastery.life).toEqual({ st: 20, l: 5, p: 1, q: 1, d: 1, w: 2, m: 2, g: 1, r: 1, u: 2, s: 40, f: 3, since: "2026-09-01" });
    expect(snap.mastery.tiers).toEqual(sum.tiers);
    expect(snap.mastery.vals).toEqual(sum.vals);
    expect([snap.mastery.bronze, snap.mastery.fw]).toEqual([9, false]);
    expect(snap.mastery.master).toEqual([]);
    expect(snap.mastery.step).toEqual({ day: "2026-10-12", t: "Ещё 1 разминка до серебра «Разминка до смены»" });
    expect(snap.v).toBe(2);
    const bad = mem({ ["sa_mastery_sum" + UK]: JSON.stringify({ tiers: { table: 7, "Bad Key": 2, warmup: -1, radio: "2" }, vals: { table: 1e12, x: "abc" }, bronze: 500, fw: "да",
      master: ["seasonal", "<script>", 5, "a".repeat(40)], step: { day: "вчера", t: "x".repeat(400) } }) });
    expect(learningSnapshot(UK, PROFILE, bad, NOW).mastery).toEqual({ tiers: { table: 3, radio: 2 }, vals: { table: 10000000 }, bronze: 99, fw: true, master: ["seasonal"], step: { day: "", t: "x".repeat(160) } });
    const onlyLife = mem({ ["sa_life" + UK]: JSON.stringify({ w: 4, since: "2026-10-01" }), ["sa_activity" + UK]: JSON.stringify({ "2026-10-12": { w: 6, st: 6 } }) });
    expect(learningSnapshot(UK, PROFILE, onlyLife, NOW).mastery).toEqual({ life: { st: 6, w: 6, since: "2026-10-01" } });
    expect("mastery" in learningSnapshot(UK, PROFILE, mem({ ["sa_activity" + UK]: JSON.stringify({ "2026-10-12": { w: 1, st: 1 } }) }), NOW)).toBe(false);
  });
});

describe("отчёт руководителя: «Путь мастера»", () => {
  const ctx = { steps: stepIndex({ seasonal: MODS }), roles: [{ id: "seasonal", label: "Новичок" }, { id: "bar", label: "Бар" }], now: NOW };
  const raw = (learning) => ({ person: { id: "p1", name: "Анна", surname: "Петрова", position: "waiter" }, lessons: ["a1"], quiz: [], last_role: "seasonal",
    seen: NOW.toISOString(), learning_at: NOW.toISOString(), learning });
  const LEARNING = {
    activity: { "2026-10-12": { st: 1, r: 1 } }, streak: { count: 1, best: 2, last: "2026-10-12" }, quests: [], skills: {}, gold: {},
    mastery: { life: { st: 11, l: 5, q: 2, s: 30, w: 4, since: "2026-10-01" }, tiers: { track: 2, table: 1, warmup: 1 }, vals: { track: 2, table: 30, warmup: 4, tests: 0 },
      bronze: 3, fw: true, master: ["seasonal"], step: { day: "2026-10-12", t: "Попробуй: Радио в дорогу" } },
  };
  it("значки по семействам, бронза и выше, мастер роли, «Не пользуется»", () => {
    const m = personModel(raw(LEARNING), ctx);
    expect([m.mastery.bronze, m.mastery.total, m.mastery.fw, m.mastery.since]).toEqual([3, 14, true, "2026-10-01"]);
    expect(m.mastery.badges.map((b) => [b.title, b.tierName])).toEqual([["Трек", "серебро"], ["Практика у стола", "бронза"], ["Разминка до смены", "бронза"]]);
    expect(m.mastery.families.length).toBe(14);
    expect(m.mastery.families.find((f) => f.id === "table")).toEqual({ id: "table", title: "Практика у стола", tier: 1, tierName: "бронза", value: 30 });
    expect(m.mastery.master).toEqual([{ id: "seasonal", label: "Новичок" }]);
    // радио есть в журнале, свеча — в копии, тесты — в счётчике: ими пользуется, хоть и без значка
    expect(m.mastery.unused).toEqual(["Живой диалог", "Свежесть тем", "Раунд мастера", "Живой гость", "Работа над ошибками", "Колоды и тренажёры", "Квест смены", "Навыки в зале"]);
    expect(m.mastery.step).toEqual({ day: "2026-10-12", t: "Попробуй: Радио в дорогу" });
    expect(m.flags.some((f) => f.level === "good" && f.text === "Мастер роли: «Новичок»")).toBe(true);
    const direct = masteryFromCopy({ mastery: { tiers: { quest: 1 } }, quests: ["2026-10-01"], fresh: { s0: { t: 1, n: 2 } }, gold: { s1: { d: "2026-10-01" } }, skills: { k: { pin: true } } });
    expect(direct.unused.includes("Квест смены")).toBe(false);
    expect(["Свежесть тем", "Раунд мастера", "Навыки в зале"].some((t) => direct.unused.includes(t))).toBe(false);   // по самой копии
    expect(direct.bronze).toBe(1);
  });
  it("старая копия без «Пути мастера» — отчёт как раньше, раздела нет", () => {
    const old = personModel(raw({ activity: { "2026-10-12": { st: 1 } } }), ctx);
    expect(old.mastery).toBe(null);
    expect(old.flags.some((f) => /Мастер роли/.test(f.text))).toBe(false);
    expect(personModel(raw(undefined), ctx).mastery).toBe(null);
    expect(masteryFromCopy({ mastery: [1] })).toBe(null);
  });
  it("Excel: в «Сводке» — значки, мастер роли, чем не пользуется; листы те же; PDF с разделом и без", () => {
    const m = personModel(raw(LEARNING), ctx);
    const old = personModel(raw({}), ctx);
    const sheets = teamSheets({ scope: "restaurant", people: [m, old] });
    expect(sheets.map((x) => x.name)).toEqual(["Сводка", "Где ошибается", "С чем работать", "Что не пройдено", "Ждут повтора", "Навыки"]);
    const head = sheets[0].columns.map((c) => c.header);
    const col = (row, h) => sheets[0].rows[row][head.indexOf(h)];
    expect(sheets[0].rows.every((r) => r.length === head.length)).toBe(true);
    expect(col(0, "Значков (бронза и выше)")).toBe(3);
    expect(col(0, "Значки по ступеням")).toBe("Трек — серебро, Практика у стола — бронза, Разминка до смены — бронза");
    expect(col(0, "Мастер роли")).toEqual({ v: "«Новичок»", s: "good" });
    expect(col(0, "Не пользуется")).toMatch(/^Живой диалог, Свежесть тем, .+, Навыки в зале$/);
    expect([col(1, "Значков (бронза и выше)"), col(1, "Значки по ступеням"), col(1, "Мастер роли"), col(1, "Не пользуется")]).toEqual(["", "", "", ""]);
    const withMs = personPdf(m), without = personPdf({ ...m, mastery: null });
    const txt = (u8) => { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s; };
    expect(txt(withMs).startsWith("%PDF-1.7")).toBe(true);
    expect(withMs.length).toBeGreaterThan(without.length);
    expect(txt(personPdf(old)).trimEnd().endsWith("%%EOF")).toBe(true);
  });
  it("экран отчёта: блок «Путь мастера»", async () => {
    const { MasteryBlock } = await import("../ui/report");
    const m = personModel(raw(LEARNING), ctx);
    const html = renderToString(React.createElement(MasteryBlock, { ms: m.mastery })).replace(/<!-- -->/g, "");
    for (const t of ["Путь мастера", "3 из 14 значков", "✦ Мастер роли: «Новичок»", "Практика у стола", "бронза", "серебро", "Первые шаги пройдены", "Не пользуется", "Квест смены", "Шаг дня · 12.10", "Попробуй: Радио в дорогу"]) expect(html).toContain(t);
    expect(html).toContain('class="t2"');
    const none = renderToString(React.createElement(MasteryBlock, { ms: { ...m.mastery, badges: [], bronze: 0, master: [], unused: [], fw: false, step: null } })).replace(/<!-- -->/g, "");
    expect(none).toContain("Значков пока нет.");
    expect(none).not.toContain("Не пользуется");
  });
});
