// v193 (Доп. 518): меню в ежедневном повторе, ненавязчиво. Владелец (24.11): «Мы можем сделать так, что бы оно не навязчиво
// советовало повторить несколько блюд?..» — и на семь предложенных идей: «Давай по классике. Все».
//   1. блюда в разминке до смены (lib/menu-repeat.js warmPlan, ui/dish-step.jsx, ui/table.jsx — шаги «dish»);
//   2. одно блюдо в перерыв (breakPick, ui/dish-moments.jsx BreakDish, строка у карточки «сейчас»);
//   3. каждый второй «Вопрос дня» — о блюде (lib/menu-pack.js menuQday, lib/qday.js, applyQdayMenu);
//   4. новинки сами встают в повтор, пока не отметишь «Знаю» (personalQueue);
//   5. после смены: «Спросили о блюде?» (addAsked, AskedSheet) — завтра первым в разминке;
//   6. свой ритм (RHYTHMS, isDishDay, «Напоминания» → «Блюда в разминке»);
//   7. «Как команда знает меню» (ui/menu-team-know.jsx, teamWeak), «В разминку команде», «В фокус смены» (брифинг), этап 59.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v193.mjs; SQL: tools/claude/sql/test59.sh.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; }, key: (i) => Object.keys(store)[i] || null, get length() { return Object.keys(store).length; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.dispatchEvent) { globalThis.__ev = []; globalThis.dispatchEvent = (e) => { globalThis.__ev.push(e && e.type); return true; }; }
if (typeof globalThis.Event === "undefined") globalThis.Event = class { constructor(t) { this.type = t; } };
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), documentElement: { classList: { contains: () => false } } };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import * as MR from "../lib/menu-repeat.js";
import { buildQdayQueue, qdayMenuFirst, qdayFits, qdayKey, QDAY_MAX } from "../lib/qday.js";
import { menuQday, allergenQuestion, dishBrief, seeded } from "../lib/menu-pack.js";
import { buildMenuQuiz } from "../lib/menu-quiz.js";
import { buildBrief, briefDishFocus, briefText, briefLines, briefShown } from "../lib/briefing.js";
import { STAGES } from "../lib/server-check.js";
import { DEMO_MENUS as RESTAURANT_MENUS } from "../tools/claude/demo-app/menu-seed.js";   // v210: блюда для проверок
import { makeServer } from "../tools/claude/demo-app/fake-server.js";
import { DishCard } from "../ui/dish-step.jsx";
import { BreakDish } from "../ui/dish-moments.jsx";
import { RemindExample } from "../ui/day-cards.jsx";
import { QdayCard } from "../ui/qday-card.jsx";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const DAY = 864e5;
const NOW = new Date(2026, 10, 24, 15, 0, 0).getTime();   // вторник, 24 ноября 2026, 15:00 по местному
const OK = RESTAURANT_MENUS["Два моря, Океан"];
const D = (id, x = {}) => ({ id, name: "Блюдо " + id, cat: "Закуски", ingredients: ["Рыба", "Лимон"], allergens: ["Рыба"], ...x });
const MENU = [D("a"), D("b"), D("c", { isNew: true, addedAt: NOW - 2 * DAY }), D("d"), D("e", { stop: true }), D("f", { archived: true }), D("g", { kind: "cocktail" }), D("h")];
beforeEach(() => { localStorage.clear(); });

describe("v193 · версия и журнал", () => {
  it("сборка v193, Дополнение 518, слова владельца, сценарии, этап 59 в списке и в README", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(193);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 518 — .*\(v193\)/);
    const part = c.slice(c.indexOf("# Дополнение 518"));
    expect(part.replace(/\s+/g, " ")).toContain("не навязчиво советовало повторить несколько блюд");
    expect(part.replace(/\s+/g, " ")).toContain("Давай по классике");
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
    const tr = rd("tools/claude/README.md");
    expect(tr).toContain("e2e-v193.mjs");
    expect(tr).toContain("test59.sh");
    expect(STAGES.find((s) => s.n === "59")).toEqual({ n: "59", file: "supabase-stage59-menu-repeat.sql",
      what: "Меню в повторе: «Как команда знает меню», просьбы руководителя, блюда в напоминании до смены", fn: "menu_know_team" });
    expect(rd("supabase/README.md")).toContain("supabase-stage59-menu-repeat.sql");
    expect(rd("supabase/AI-SETUP.md")).toContain("## v193:");
  });
});

describe("v193 · «Знаю?», ритм и дни (lib/menu-repeat.js)", () => {
  it("отметки: «Знаю» — ступень и срок, «Не уверен» и ошибка — к повтору сейчас; у отметки есть день", () => {
    let sr = MR.srMark({}, "a", true, NOW);
    expect(sr.a).toEqual({ stage: 1, due: NOW + DAY, t: NOW });
    sr = MR.srMark(sr, "a", true, NOW);
    expect(sr.a.stage).toBe(2); expect(sr.a.due).toBe(NOW + 3 * DAY);
    for (let i = 0; i < 4; i++) sr = MR.srMark(sr, "a", true, NOW);
    expect(sr.a.stage).toBe(4); expect(sr.a.due).toBe(NOW + 30 * DAY);
    sr = MR.srMark(sr, "a", false, NOW);
    expect(sr.a).toEqual({ stage: 0, due: NOW, t: NOW });
    expect(MR.srMiss({}, "b", NOW).b).toEqual({ stage: 0, due: NOW, t: NOW, m: NOW });
    expect(MR.srDue({}, "x", NOW)).toBe(true);
    expect(MR.srKnown(MR.srMark({}, "a", true, NOW), "a", NOW + 1000)).toBe(true);
    expect(MR.srKnown(MR.srMark({}, "a", true, NOW), "a", NOW + 2 * DAY)).toBe(false);
  });
  it("тот же ключ, что у «Колоды меню»; запись сообщает App событием", () => {
    expect(MR.srKey("Порт")).toBe("sa_menu_sr_Порт");
    globalThis.__ev = [];
    MR.markDish("Порт", "a", true, NOW);
    expect(JSON.parse(localStorage.getItem("sa_menu_sr_Порт")).a.stage).toBe(1);
    expect(globalThis.__ev).toContain(MR.MENU_SR_EVENT);
    expect(rd("ui/menu-deck.jsx")).toContain("const next = srMark(sr, d.id, ok);\n    setSr(next); writeSr(restaurant, next);");
  });
  it("ответ «Вопроса дня» о блюде: ошибка — к повтору с отметкой, верно — как «Знаю», но только если пора", () => {
    MR.writeSr("Порт", { a: { stage: 2, due: NOW + 3 * DAY, t: NOW - DAY } });
    expect(MR.answerDish("Порт", "a", true, NOW).a.stage).toBe(2);
    expect(MR.answerDish("Порт", "a", true, NOW + 4 * DAY).a.stage).toBe(3);
    expect(MR.answerDish("Порт", "a", false, NOW).a).toEqual({ stage: 0, due: NOW, t: NOW, m: NOW });
    MR.rememberQdayMenu("_Анна_С", "Порт", [{ q: "Главный ингредиент блюда «Тартар»?", dish: "t1" }, { q: "без блюда" }]);
    expect(MR.qdayMenuOf("_Анна_С", "Главный ингредиент блюда «Тартар»?")).toEqual({ id: "t1", r: "Порт" });
    expect(MR.qdayMenuOf("_Анна_С", "без блюда")).toBe(null);
    expect(MR.qdayMenuOf("_Иван_П", "Главный ингредиент блюда «Тартар»?")).toBe(null);
    const out = MR.applyQdayMenu("_Анна_С", [{ q: "Главный ингредиент блюда «Тартар»?", correct: false }, { q: "чужой вопрос", correct: false }], NOW);
    expect(out).toEqual([{ id: "t1", r: "Порт", correct: false }]);
    expect(MR.readSr("Порт").t1.m).toBe(NOW);
    const big = Array.from({ length: 90 }, (_, i) => ({ q: "Вопрос " + i, dish: "d" + i }));
    expect(Object.keys(MR.rememberQdayMenu("_Анна_С", "Порт", big)).length).toBe(80);
  });
  it("ритм: по умолчанию каждую смену и 2 блюда; мусор — по умолчанию", () => {
    expect(MR.readRhythm("_x")).toEqual({ r: "each", n: 2 });
    expect(MR.saveRhythm("_x", { r: "week", n: 3 })).toEqual({ r: "week", n: 3 });
    expect(MR.readRhythm("_x")).toEqual({ r: "week", n: 3 });
    expect(MR.normRhythm({ r: "daily", n: 7 })).toEqual({ r: "each", n: 2 });
    expect(MR.RHYTHMS.map((x) => x[1])).toEqual(["Каждую смену", "Через смену", "Раз в неделю", "Не нужно"]);
    expect(MR.COUNTS).toEqual([2, 3]);
  });
  it("в какие разминки блюда: каждую смену, через смену, раз в неделю, не нужно", () => {
    const T = "2026-11-26";   // четверг; понедельник недели — 23.11
    expect(MR.mondayOf(T)).toBe("2026-11-23");
    expect(MR.mondayOf("2026-11-23")).toBe("2026-11-23");
    expect(MR.isDishDay("each", {}, T)).toBe(true);
    expect(MR.isDishDay("off", {}, T)).toBe(false);
    expect(MR.isDishDay("every2", {}, T)).toBe(true);
    expect(MR.isDishDay("every2", { prev: "2026-11-25", had: true }, T)).toBe(false);
    expect(MR.isDishDay("every2", { prev: "2026-11-25", had: false }, T)).toBe(true);
    expect(MR.isDishDay("every2", { prev: T, had: true }, T)).toBe(true);
    expect(MR.isDishDay("week", { last: "2026-11-24" }, T)).toBe(false);
    expect(MR.isDishDay("week", { last: "2026-11-22" }, T)).toBe(true);
    expect(MR.isDishDay("week", { last: T }, T)).toBe(true);
    const log = MR.noteWarm(MR.noteWarm({}, "2026-11-24", true), "2026-11-25", false);
    expect(log).toEqual({ last: "2026-11-24", prev: "2026-11-25", had: false });
    MR.saveWarmLog("_x", log);
    expect(MR.readWarmLog("_x")).toEqual(log);
    expect(MR.readWarmLog("_y")).toEqual({ last: null, prev: null, had: false });
  });
  it("день — по местному календарю, как у сервера (номер дня с 1970 года)", () => {
    expect(MR.localDay(NOW)).toBe(MR.isoDay("2026-11-24"));
    expect(MR.isoOf(MR.isoDay("2026-11-24"))).toBe("2026-11-24");
    expect(MR.isoDay("2026-13")).toBe(0);
  });
});

describe("v193 · какие блюда (очередь и разминка)", () => {
  it("своя очередь: спросили → новинки, пока не «Знаю» → пора повторить (по сроку) → ещё не отмечал; стоп, архив и коктейли — нет", () => {
    const sr = { a: { stage: 1, due: NOW - 2 * DAY, t: NOW - 3 * DAY }, b: { stage: 0, due: NOW - DAY, t: NOW - DAY }, d: { stage: 2, due: NOW + DAY, t: NOW - DAY } };
    const q = MR.personalQueue({ dishes: MENU, sr, asked: [{ id: "h", at: NOW - 3600e3 }], now: NOW });
    expect(q.map((x) => x.id + ":" + x.why)).toEqual(["h:asked", "c:new", "a:due", "b:due"]);
    expect(q.every((x) => !["e", "f", "g"].includes(x.id))).toBe(true);
    // новинка, отмеченная «Знаю», из новинок уходит
    const q2 = MR.personalQueue({ dishes: MENU, sr: { ...sr, c: { stage: 1, due: NOW + DAY, t: NOW } }, asked: [], now: NOW });
    expect(q2.map((x) => x.id)).toEqual(["a", "b", "h"]);
    // новинка «Не уверен» — всё ещё новинка (идея 4)
    expect(MR.personalQueue({ dishes: MENU, sr: { c: { stage: 0, due: NOW, t: NOW } }, now: NOW })[0]).toEqual({ id: "c", name: "Блюдо c", why: "new" });
    expect(MR.personalQueue({ dishes: MENU, sr: {}, now: NOW, max: 2 }).length).toBe(2);
  });
  it("«спросили»: неделю или до «Знаю» после вопроса; новые — первыми", () => {
    const list = [{ id: "a", at: NOW - 8 * DAY }, { id: "b", at: NOW - DAY }, { id: "c", at: NOW - 3600e3 }];
    expect(MR.openAsked(list, {}, NOW)).toEqual(["c", "b"]);
    expect(MR.openAsked(list, { b: { stage: 1, due: NOW + DAY, t: NOW - 1000 } }, NOW)).toEqual(["c"]);
    expect(MR.openAsked(list, { b: { stage: 1, due: NOW + DAY, t: NOW - 2 * DAY } }, NOW)).toEqual(["c", "b"]);
    MR.addAsked("_a", "Порт", "x", NOW - DAY); MR.addAsked("_a", "Порт", "y", NOW); MR.addAsked("_a", "Порт", "x", NOW);
    expect(MR.readAsked("_a", "Порт").map((x) => x.id)).toEqual(["x", "y"]);
    expect(MR.readAsked("_a", "Марико")).toEqual([]);
    expect(MR.askedToday(MR.readAsked("_a", "Порт"), NOW)).toEqual(["x", "y"]);
  });
  it("разминка: спросили → просьба руководителя → гоу-лист смены → своя очередь; n блюд", () => {
    const focus = [{ id: "d", kind: "warm", day: MR.localDay(NOW) - 1 }, { id: "a", kind: "brief", day: 1 }];
    const go = [{ id: "zz", name: "Блюдо b", kind: "dish", say: "Лучшее к белому" }, { id: "n1", name: "Негрони", kind: "cocktail" }];
    const p = MR.warmPlan({ dishes: MENU, sr: {}, asked: [{ id: "h", at: NOW - 1000 }], focus, go, n: 3, now: NOW });
    expect(p.map((x) => x.id + ":" + x.why)).toEqual(["h:asked", "d:focus", "b:go"]);
    expect(p[2].say).toBe("Лучшее к белому");
    expect(p[0].dish.name).toBe("Блюдо h");
    expect(MR.warmPlan({ dishes: MENU, focus, go, n: 2, now: NOW }).map((x) => x.why)).toEqual(["focus", "go"]);
    // просьба: «Знаю» в день просьбы или позже — уже не зовём; раньше просьбы — зовём
    const sr1 = { d: { stage: 1, due: NOW + DAY, t: NOW } };
    expect(MR.warmPlan({ dishes: MENU, sr: sr1, focus, n: 1, now: NOW })[0].id).toBe("c");
    const sr2 = { d: { stage: 1, due: NOW + DAY, t: NOW - 3 * DAY } };
    expect(MR.warmPlan({ dishes: MENU, sr: sr2, focus, n: 1, now: NOW })[0].id).toBe("d");
    // гоу-лист: «Знаю» сегодня — дальше
    expect(MR.warmPlan({ dishes: MENU, sr: { b: { stage: 1, due: NOW + DAY, t: NOW - 1000 } }, go, n: 1, now: NOW })[0].id).toBe("c");
    // стоп в просьбе и гоу-листе — пропуск
    expect(MR.warmPlan({ dishes: MENU, focus: [{ id: "e", kind: "warm", day: 0 }], go: [{ id: "e", name: "Блюдо e" }], n: 1, now: NOW })[0].why).toBe("new");
  });
  it("перерыв: то же, но что сегодня уже отмечал — пропуск; бот назвал — в разминке они", () => {
    const sr = { c: { stage: 0, due: NOW, t: NOW - 1000 } };
    expect(MR.breakPick({ dishes: MENU, sr, now: NOW }).id).toBe("a");
    expect(MR.breakPick({ dishes: [D("a")], sr: { a: { stage: 1, due: NOW + DAY, t: NOW } }, now: NOW })).toBe(null);
    const sent = { day: "2026-11-24", ids: ["h", "e", "nope", "a"], names: [] };
    expect(MR.sentPlan(sent, MENU, "2026-11-24").map((x) => x.id)).toEqual(["h", "a"]);
    expect(MR.sentPlan(sent, MENU, "2026-11-25")).toBe(null);
    expect(MR.sentPlan({ day: "2026-11-24", ids: ["e"] }, MENU, "2026-11-24")).toBe(null);
  });
});

describe("v193 · для сервера и руководителя", () => {
  it("«Знаю?» для сервера: ступень, день повтора, день отметки; только блюда меню; до 400", () => {
    const sr = { a: { stage: 2, due: NOW + 3 * DAY, t: NOW }, b: { stage: 0, due: 0 }, zz: { stage: 1, due: NOW }, g: { stage: 1, due: NOW } };
    const dn = MR.localDay(NOW);
    expect(MR.knowData(sr, MENU, NOW)).toEqual({ a: [2, dn + 3, dn], b: [0, dn, 0] });
    const many = Object.fromEntries(Array.from({ length: 450 }, (_, i) => ["x" + i, { stage: 1, due: NOW }]));
    expect(Object.keys(MR.knowData(many, Array.from({ length: 450 }, (_, i) => D("x" + i)), NOW)).length).toBe(400);
  });
  it("ритм и своя очередь — компактно", () => {
    const w = MR.warmData({ rhythm: { r: "every2", n: 3 }, log: { last: "2026-11-20", prev: "2026-11-23", had: false },
      next: Array.from({ length: 8 }, (_, i) => ({ id: "d" + i, name: "  Блюдо   " + i + " ", why: "fresh", dish: {} })) });
    expect(w).toEqual({ r: "every2", n: 3, last: "2026-11-20", prev: "2026-11-23", had: false,
      next: Array.from({ length: 6 }, (_, i) => ({ id: "d" + i, name: "Блюдо " + i, why: "fresh" })) });
  });
  it("строка напоминания — как у сервера (этап 59)", () => {
    expect(MR.remindLine([])).toBe("Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!");
    expect(MR.remindLine(["Креветка темпура", "Пончик с крабом"])).toBe("Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл, и 2 блюда из меню: Креветка темпура, Пончик с крабом. Хорошей смены!");
    expect(MR.remindLine(["Тартар"])).toBe("Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл, и 1 блюдо из меню: Тартар. Хорошей смены!");
    const sql = rd("supabase/supabase-stage59-menu-repeat.sql");
    expect(sql).toContain("'Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл, и ' || cnt || ' ' ||");
    expect(sql).toContain("' из меню: ' || nm || '. Хорошей смены!'");
    expect(sql).toContain("then return 'Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!'");
  });
  it("копия просьб на телефоне: только своё заведение, мусор отброшен", () => {
    MR.saveFocus("_a", "Порт", { ok: true, focus: [{ id: 5, kind: "warm", name: "Тартар", day: 20781, until: "2026-12-01", by: "Мария" }, { id: "x", kind: "other" }],
      sent: { day: "2026-11-24", ids: ["a", "b", "c", "d"], names: ["А", "Б"] } });
    const f = MR.readFocus("_a", "Порт");
    expect(f.focus).toEqual([{ id: "5", kind: "warm", name: "Тартар", note: "", until: "2026-12-01", day: 20781, by: "Мария" }]);
    expect(f.sent).toEqual({ day: "2026-11-24", ids: ["a", "b", "c"], names: ["А", "Б"] });
    expect(MR.readFocus("_a", "Марико")).toEqual({ r: "Марико", at: 0, focus: [], sent: null });
    expect(MR.saveFocus("_a", "Порт", { ok: false })).toBe(null);
  });
  it("слабые блюда: «не уверены» — выше, «знают» — ниже; блюд не из меню нет", () => {
    const res = { n: 4, dishes: [{ id: "a", known: 4, weak: 0, seen: 4 }, { id: "b", known: 1, weak: 2, seen: 3 }, { id: "c", known: 0, weak: 1, seen: 1 }, { id: "zz", known: 0, weak: 4, seen: 4 }] };
    const w = MR.teamWeak(res, MENU);
    expect(w.map((r) => r.id)).toEqual(["b", "c", "d", "e", "h"]);
    expect(w[0]).toEqual({ id: "b", name: "Блюдо b", cat: "Закуски", stop: false, known: 1, weak: 2, seen: 3, n: 4 });
    expect(w.find((r) => r.id === "e").stop).toBe(true);
    expect(MR.weakLine(w[0])).toBe("не уверены 2 · знают 1 из 4");
    expect(MR.weakLine({ known: 0, weak: 0, n: 3 })).toBe("знают 0 из 3");
  });
  it("тексты: «ситуации и 2 блюда», подписи причин", () => {
    expect(MR.warmWhat("ситуации", 2)).toBe("ситуации и 2 блюда");
    expect(MR.warmWhat("вопроса", 0)).toBe("вопроса");
    expect(MR.warmWhat("ситуации", 3)).toBe("ситуации и 3 блюда");
    expect(MR.WHY_LABEL).toMatchObject({ asked: "спрашивали", focus: "просит руководитель", go: "гоу-лист смены", new: "новинка", due: "пора повторить" });
  });
});

describe("v193 · «Вопрос дня» из меню", () => {
  const reg = [{ q: "R1?", options: ["a", "b"], correct: 0 }, { q: "R2?", options: ["a", "b"], correct: 1 }, { q: "R3?", options: ["a", "b"], correct: 0 }];
  const prog = [{ lessons: [{ type: "quiz", id: "q1", title: "Встреча гостя", questions: reg }] }];
  const men = [1, 2, 3].map((i) => ({ q: "M" + i + "?", options: ["x", "y"], correct: 0, lessonTitle: "Меню", dish: "d" + i }));
  it("через один: в нечётный день первым — о блюде, в чётный — из уроков; кончились одни — другие", () => {
    expect(qdayMenuFirst("2026-11-24")).toBe(true);    // 20781 — нечётный
    expect(qdayMenuFirst("2026-11-25")).toBe(false);
    const a = buildQdayQueue({ programModules: prog, quizDone: { q1: true }, day: "2026-11-24", uk: "_a", menu: men });
    expect(a.map((x) => x.t)).toEqual(["Меню", "Встреча гостя", "Меню", "Встреча гостя", "Меню", "Встреча гостя"]);
    const b = buildQdayQueue({ programModules: prog, quizDone: { q1: true }, day: "2026-11-25", uk: "_a", menu: men.slice(0, 1) });
    expect(b.map((x) => x.t)).toEqual(["Встреча гостя", "Меню", "Встреча гостя", "Встреча гостя"]);
    expect(buildQdayQueue({ programModules: prog, quizDone: { q1: true }, day: "2026-11-24", uk: "_a" }).every((x) => x.t === "Встреча гостя")).toBe(true);
    const many = Array.from({ length: 9 }, (_, i) => ({ q: "M" + i + "?", options: ["x", "y"], correct: 0, lessonTitle: "Меню" }));
    expect(buildQdayQueue({ programModules: prog, quizDone: { q1: true }, day: "2026-11-24", menu: many }).length).toBe(QDAY_MAX);
  });
  it("вопросы о блюдах: годятся для чата, один и тот же весь день, сначала о тех, что пора повторить", () => {
    const prefer = [OK[3].id, OK[7].id];
    const q = menuQday({ dishes: OK, prefer, seed: "2026-11-24_Анна", max: 4 });
    expect(q.length).toBe(4);
    expect(q.every((x) => qdayFits(x) && x.lessonTitle === "Меню")).toBe(true);
    expect(new Set(q.map((x) => x.dish)).size).toBe(4);
    expect(q.slice(0, 2).map((x) => x.dish)).toEqual(prefer);
    expect(menuQday({ dishes: OK, prefer, seed: "2026-11-24_Анна", max: 4 })).toEqual(q);
    expect(JSON.stringify(menuQday({ dishes: OK, prefer, seed: "2026-11-25_Анна", max: 4 }))).not.toBe(JSON.stringify(q));
    expect(menuQday({ dishes: OK.slice(0, 3), seed: "x" })).toEqual([]);
    expect(menuQday({ dishes: OK.map((d) => ({ ...d, stop: true })), seed: "x" })).toEqual([]);
  });
  it("«Есть ли в блюде…?»: да — отмеченный аллерген; нет — только где отмечено три и больше и состав не намекает", () => {
    const one = { id: 1, name: "Тартар", ingredients: ["Говядина", "Желток"], allergens: ["Яйца"] };
    for (let i = 0; i < 20; i++) { const x = allergenQuestion(one, seeded("s" + i)); expect(x.correct).toBe(0); expect(x.q).toBe("Есть ли в блюде «Тартар» яйца?"); }
    const three = { id: 2, name: "Паста", ingredients: ["Паста", "Сливки", "Креветки"], allergens: ["Глютен", "Молоко", "Моллюски и ракообразные"] };
    const qs = Array.from({ length: 30 }, (_, i) => allergenQuestion(three, seeded("t" + i)));
    expect(qs.some((x) => x.correct === 1) && qs.some((x) => x.correct === 0)).toBe(true);
    for (const x of qs.filter((y) => y.correct === 1)) expect(x.q).not.toMatch(/молоко|глютен|моллюски/);
    expect(allergenQuestion({ id: 3, name: "Салат", allergens: [] })).toBe(null);
    expect(allergenQuestion(three, seeded("t1")).options).toEqual(["Да, есть", "Нет"]);
  });
  it("викторина меню — со своим «случаем» (то же зерно — те же вопросы)", () => {
    expect(buildMenuQuiz(OK, { rnd: seeded("a") })).toEqual(buildMenuQuiz(OK, { rnd: seeded("a") }));
    expect(buildMenuQuiz(OK).length).toBeGreaterThan(3);
  });
  it("карточка вопроса о блюде: после ошибки — «Блюдо придёт в разминку»", () => {
    const item = { id: 7, q: "Есть ли в блюде «Тартар» яйца?", o: ["Да, есть", "Нет"], c: 0, t: "Меню", answer: 1, correct: false, e: "" };
    expect(R(h(QdayCard, { data: { item }, menu: true, onMistakes: () => {} }))).toContain("Блюдо придёт в разминку.");
    expect(R(h(QdayCard, { data: { item }, onMistakes: () => {} }))).not.toContain("Блюдо придёт в разминку.");
    expect(R(h(QdayCard, { data: { item } }))).toContain("· Меню");
  });
});

describe("v193 · карточки блюда", () => {
  const item = { id: "ok2602", name: "Креветка темпура", why: "go", say: "Хрустящие, к белому вину", brief: { img: "/menu/okean_02.jpg", cat: "Закуски", comp: "Креветки, кляр, соус спайси", al: ["Морепродукты", "Глютен"], desc: "Хрустящие креветки в воздушном кляре." } };
  it("в разминке: сначала вспомнить, потом состав, аллергены, как рассказать, фраза из гоу-листа", () => {
    const front = R(h(DishCard, { item, flipped: false }));
    expect(front).toContain("меню · гоу-лист смены");
    expect(front).toContain("Креветка темпура");
    expect(front).toContain("Вспомни, что в составе и какие аллергены. Потом переверни карточку.");
    expect(front).not.toContain("Креветки, кляр");
    expect(front).toContain('aria-label="Креветка темпура. Показать состав"');
    const back = R(h(DishCard, { item, flipped: true }));
    for (const t of ["Состав", "Креветки, кляр, соус спайси", ">Морепродукты<", ">Глютен<", "Как рассказать гостю", "Хрустящие креветки в воздушном кляре.", "Фраза гостю из гоу-листа", "«Хрустящие, к белому вину»"]) expect(back).toContain(t);
    expect(R(h(DishCard, { item: { ...item, say: "", brief: { comp: "", al: [] } }, flipped: true }))).toContain("нет из «большой восьмёрки»");
  });
  it("в перерыв: показать состав, «Знаю» / «Не уверена», «Ещё одно»", () => {
    const html = R(h(BreakDish, { item, female: true }));
    expect(html).toContain("Блюдо в перерыв · Закуски");
    expect(html).toContain("Показать состав");
    expect(html).toContain('data-break-dish="ok2602"');
    expect(R(h(BreakDish, { item: null }))).toContain("На сегодня всё");
    const src = rd("ui/dish-moments.jsx");
    expect(src).toContain('{female ? "Не уверена" : "Не уверен"}');
    expect(src).toContain('"Отметил" + (female ? "а" : "") + " «Знаю». Повторим, когда подойдёт срок."');
    expect(src).toContain("Ещё одно");
    expect(src).toContain("О каком блюде спросили?");
  });
  it("данные карточки: состав строкой, аллергены подписями, описание — одна-две фразы до 170 знаков", () => {
    const b = dishBrief(OK[1]);
    expect(b.img).toBe("/menu/okean_02.jpg");
    expect(b.comp.length).toBeGreaterThan(5);
    expect(b.desc.length).toBeLessThanOrEqual(170);
    expect(dishBrief({ id: 1, name: "X", allergens: ["Молоко"], desc: "Раз. Два. " + "Очень длинная фраза ".repeat(20) }).al).toEqual(["Лактоза (молоко)"]);
    expect(dishBrief({ id: 1, name: "X", desc: "Раз. Два. " + "Очень длинная фраза ".repeat(20) }).desc).toBe("Раз. Два.");
    expect(dishBrief(null)).toBe(null);
  });
  it("пример сообщения бота: с блюдами — строкой с блюдами, без — как было", () => {
    expect(R(h(RemindExample, { when: "час", shift: "День · 12:00–20:00", dishes: ["Креветка темпура", "Пончик с крабом"] })))
      .toContain(">Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл, и 2 блюда из меню: Креветка темпура, Пончик с крабом. Хорошей смены!<");
    expect(R(h(RemindExample, { when: "час" }))).toContain(">Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!<");
  });
});

describe("v193 · брифинг: «В фокус смены»", () => {
  const menu = [{ id: "a", name: "Тартар", ingredients: ["Говядина", "Желток", "Каперсы"], allergens: ["Яйца"] }, { id: "b", name: "Салат", ingredients: [] }, { id: "c", name: "Негрони", kind: "cocktail" }];
  it("блюдо в фокусе: название, состав, аллергены, заметка руководителя; до двух; не из меню — нет", () => {
    const f = briefDishFocus([{ id: "a", kind: "brief", note: "не уверены 3 из 5" }, { id: "zz", kind: "brief" }, { id: "c", kind: "brief" }, { id: "b", kind: "warm" }, { id: "b", kind: "brief" }], menu);
    expect(f).toEqual([{ kind: "dish", id: "a", q: "Тартар", right: "Говядина, Желток, Каперсы", why: "Аллергены: яйца", topic: "Меню", note: "не уверены 3 из 5", pct: 0, n: 0 },
      { kind: "dish", id: "b", q: "Салат", right: "", why: "", topic: "Меню", note: "", pct: 0, n: 0 }]);
  });
  it("в брифинге — после трудных вопросов, в Telegram и в чат — строкой о блюде", () => {
    const b = buildBrief({ menu, dishFocus: [{ id: "a", kind: "brief" }], restaurant: "Океан", now: new Date(NOW) });
    expect(briefShown(b, "focus")).toBe(true);
    expect(b.blocks.focus[0].kind).toBe("dish");
    expect(briefText(b)).toContain("Фокус смены: блюдо «Тартар». Состав: Говядина, Желток, Каперсы. Аллергены: яйца");
    expect(briefLines(b)).toContain("Фокус смены: блюдо «Тартар»");
    const ui = rd("ui/briefing.jsx");
    expect(ui).toContain('rpc("menu_focus_get", { p_token: tok })');
    expect(ui).toContain("<div style={row}>Блюдо «{f.q}»</div>");
    expect(ui).toContain('Меню{f.note ? " · " + f.note : ""}');
  });
});

describe("v193 · сервер в демо (как этап 59)", () => {
  const people = [{ id: "m", name: "Мария", surname: "Ким", restaurant: "Океан", position: "manager" }, { id: "a", name: "Анна", surname: "С", restaurant: "Океан", position: "waiter" },
    { id: "o", name: "Олег", surname: "П", restaurant: "Порт", position: "manager" }, { id: "r", name: "Роман", surname: "", restaurant: "Океан", position: "owner", is_admin: true }];
  const mk = (x = {}) => makeServer({ today: "2026-11-24", rest: "Океан", people, tok: { tm: "m", ta: "a", to: "o", tr: "r" }, sstaff: [], cfg: { shifts: [] }, plan: {}, menu: [], clock: () => NOW, ...x });
  it("«Знаю?» и ритм: только понятное; ответ — просьбы и что назвал бот сегодня", () => {
    const srv = mk();
    const dn = MR.isoDay("2026-11-24");
    const r = srv.rpc("menu_know_set", { p_token: "ta", p_data: { a: [1, dn + 1, dn], b: [0, dn, dn], x: "bad", y: [9, 999999, -1] }, p_warm: { r: "week", n: 9, next: [{ id: "a", name: " A  a ", why: "?" }, { id: "" }] } });
    expect(r).toEqual({ ok: true, restaurant: "Океан", today: "2026-11-24", focus: [], sent: null });
    expect(srv.S.mk.know.a.data).toEqual({ a: [1, dn + 1, dn], b: [0, dn, dn], y: [4, 100000, 0] });
    expect(srv.S.mk.know.a.warm).toMatchObject({ r: "week", n: 3, next: [{ id: "a", name: "A a", why: "due" }] });
    expect(srv.rpc("menu_know_set", { p_token: "нет" })).toEqual({ ok: false, error: "auth" });
  });
  it("просьбы: только руководитель, неделя и два дня, до пяти, снять; команда — по блюдам и людям", () => {
    const srv = mk();
    expect(srv.rpc("menu_focus_set", { p_token: "ta", p_kind: "warm", p_id: "a" }).error).toBe("forbidden");
    expect(srv.rpc("menu_focus_set", { p_token: "tm", p_kind: "x", p_id: "a" }).error).toBe("kind");
    const r = srv.rpc("menu_focus_set", { p_token: "tm", p_kind: "warm", p_id: "a", p_name: "Тартар", p_note: "не уверены 1 из 1" });
    expect(r.focus).toEqual([{ id: "a", kind: "warm", name: "Тартар", note: "не уверены 1 из 1", until: "2026-12-01", day: MR.isoDay("2026-11-24"), by: "Мария Ким" }]);
    expect(srv.rpc("menu_focus_set", { p_token: "tm", p_kind: "brief", p_id: "b", p_name: "Салат" }).focus.find((f) => f.kind === "brief").until).toBe("2026-11-25");
    for (let i = 0; i < 4; i++) srv.rpc("menu_focus_set", { p_token: "tm", p_kind: "brief", p_id: "x" + i, p_name: "X" });
    expect(srv.rpc("menu_focus_set", { p_token: "tm", p_kind: "brief", p_id: "y", p_name: "Y" }).error).toBe("too_many");
    expect(srv.rpc("menu_focus_set", { p_token: "tm", p_kind: "brief", p_id: "x0", p_on: false }).focus.filter((f) => f.kind === "brief").length).toBe(4);
    expect(srv.rpc("menu_focus_get", { p_token: "ta" }).focus.length).toBe(5);
    expect(srv.rpc("menu_focus_get", { p_token: "to" }).focus).toEqual([]);
    const dn = MR.isoDay("2026-11-24");
    srv.rpc("menu_know_set", { p_token: "ta", p_data: { a: [1, dn + 1, dn], b: [0, dn, dn] } });
    expect(srv.rpc("menu_know_team", { p_token: "ta" }).error).toBe("forbidden");
    expect(srv.rpc("menu_know_team", { p_token: "to", p_restaurant: "Океан" }).error).toBe("forbidden");
    const t = srv.rpc("menu_know_team", { p_token: "tm" });
    expect(t.n).toBe(1); expect(t.staff).toBe(2);
    expect(t.dishes).toEqual([{ id: "a", known: 1, weak: 0, seen: 1 }, { id: "b", known: 0, weak: 1, seen: 1 }]);
    expect(t.people.find((p) => p.id === "a")).toMatchObject({ name: "Анна С", known: 1, weak: 1, marked: 2 });
    expect(t.people.some((p) => p.id === "r")).toBe(false);
    expect(mk({ noStage59: true }).rpc("menu_focus_get", { p_token: "ta" }).code).toBe("PGRST202");
  });
});

describe("v193 · экраны и связки", () => {
  it("стол разминки: блюда после ситуаций, до повтора ошибки; перевернуть, «Знаю» / «Не уверен»; в чеке — сколько знал", () => {
    const t = rd("ui/table.jsx");
    expect(t).toContain('if (warm && out.length && Array.isArray(dishes)) dishes.filter((d) => d && d.id != null && d.name).slice(0, 3).forEach((d) => out.push({ kind: "dish", item: d }));');
    expect(t.indexOf('out.push({ kind: "dish"')).toBeLessThan(t.indexOf('out.push({ kind: "bank"'));
    expect(t).toContain('isDish ? "Блюдо " + dishNo + " из " + dishCount');
    expect(t).toContain('<button type="button" className="tb-main" data-dish-flip="" onClick={flipDish}>Показать состав</button>');
    expect(t).toContain('<button type="button" className="tb-main" data-dish-know="" onClick={() => markDish(true)}>Знаю</button>');
    expect(t).toContain('<button type="button" className="tb-ghost" data-dish-unsure="" onClick={() => markDish(false)}>{unsure}</button>');
    expect(t).toContain('<Line label="Блюда: знаю" value={dishRes.current.filter((x) => x.ok).length + " из " + dishRes.current.length} />');
    expect(t).toContain("dishN: dl.length, dishOk: dl.filter((x) => x.ok).length, dishes: dl.slice()");
  });
  it("App: меню отдельным куском, блюда в разминке, строки у карточки «сейчас», «Спросили о блюде», вопрос дня, ритм", () => {
    const a = rd("App.jsx");
    expect(a).toContain('const loadMenuPack = () => import("./lib/menu-pack");');
    expect(a).not.toMatch(/^import .* from "\.\/lib\/menu-pack"/m);
    expect(a).not.toMatch(/^import .* from "\.\/lib\/menu-dishes"/m);
    expect(a).toContain("dishes={warmDishes} onDish={onWarmDish}");
    expect(a).toContain("const plan = sentPlan(menuFocus.sent, menuDishes, todayKey) || warmPlan({ ...planArgs, n: menuRhythm.n, now: Date.now() });");
    expect(a).toContain('during: menuOn && !breakCur ? [{ key: "dish", label: "В перерыв:", title: "одно блюдо за 20 секунд", onClick: nextBreak }] : [],');
    expect(a).toContain('{ key: "asked", label: "Спросили о блюде?", title: "Отметь", onClick: () => setAskOpen(true) }');
    expect(a).toContain("<AskedSheet a11y={a11y} dishes={menuDishes} picked={askedTodayIds} female={menuFemale} onPick={pickAsked} onClose={() => setAskOpen(false)} />");
    expect(a).toContain("menuQ = pack.menuQday({ dishes, prefer, seed: day + ukP, max: 4 });");
    expect(a).toContain("roleLabel: label, day, uk: ukP, menu: menuQ });");
    expect((a.match(/applyQdayMenu\(ukP, /g) || []).length).toBe(2);
    expect(a).toContain("saveWarmLog(ukP, noteWarm(readWarmLog(ukP), todayKey, !!(res && res.dishN > 0)));");
    expect(a).toContain("if (!menuLinkReady) return;   // v193");
    expect(a).toContain('rhythm={menuPack && menuDishes.length ? menuRhythm : null} onRhythm={(v) => saveRhythm(ukP, v)}');
    const home = rd("ui/screens-roleselect.jsx");
    expect(home).toContain('const extraRows = ctx && nowRows ? (nowRows[ctx.mode === "reply" ? "after" : ctx.mode] || []) : [];');
    expect(home).toContain('ctx && ctx.mode === "during" && nowFoot ? nowFoot : null');
  });
  it("«Напоминания»: «Блюда в разминке» — четыре ритма и 2 или 3 блюда", () => {
    const dc = rd("ui/day-cards.jsx");
    expect(dc).toContain(">Блюда в разминке</div>");
    expect(dc).toContain('{RHYTHMS.map(([k, t]) => <button key={k} type="button" aria-pressed={v.r === k} data-rhythm={k}');
    expect(dc).toContain('{COUNTS.map((n) => <button key={n} type="button" aria-pressed={v.n === n} data-rhythm-n={n}');
    expect(dc).toContain("{rh ? <DishRhythm a11y={a11y} c={c} value={rh} onPick={pickRh} /> : null}");
  });
  it("«Меню»: руководителю «Как команда знает меню»; сводка, просьбы, кто как знает", () => {
    const m = rd("ui/menu-trainer.jsx");
    expect(m).toContain("<div style={T.modTitle}>Как команда знает меню</div>");
    expect(m).toContain('if (mode === "know") return <TeamMenuKnow');
    const k = rd("ui/menu-team-know.jsx");
    for (const t of ['rpc("menu_know_team", { p_token: saToken(), p_restaurant: restaurant })', 'rpc("menu_focus_set", { p_token: saToken(), p_kind: kind, p_id: r.id, p_name: r.name, p_on: want, p_note: r.note || "" })',
      '"В разминку команде"', '"В фокус смены"', ">Сейчас просите</div>", ">Слабые блюда</div>", ">Кто как знает меню</div>", 'sql: "supabase-stage59-menu-repeat.sql"']) expect(k).toContain(t);
  });
  it("справка: «Меню каждый день» и «Как команда знает меню»", async () => {
    const { GUIDE } = await import("../ui/guide.jsx");
    const all = GUIDE.flatMap((g) => g.items.map((x) => ({ ...x, tab: g.tab })));
    const daily = all.find((x) => x.key === "menu-daily"), know = all.find((x) => x.key === "m-know");
    expect(daily.tab).toBe("Учусь");
    expect(daily.text).toContain("«Напоминания» → «Блюда в разминке»");
    expect(daily.text).toContain("«В перерыв: одно блюдо за 20 секунд»");
    expect(know.tab).toBe("Руководителю: меню");
    expect(know.text).toContain("«В разминку команде»");
    expect(know.text).toContain("«В фокус смены»");
    expect(know.go).toBe("menu");
  });
  it("без тире и эмодзи в новом интерфейсе; кнопки с меткой линзы", () => {
    const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
    for (const f of ["ui/dish-step.jsx", "ui/dish-moments.jsx", "ui/menu-team-know.jsx"]) {
      const s = code(rd(f));
      expect([f, (s.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length]).toEqual([f, 0]);
      expect([f, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u.test(s)]).toEqual([f, false]);
    }
    const k = rd("ui/menu-team-know.jsx");
    expect((k.match(/<button /g) || []).length).toBe((k.match(/<button [^>]*data-lens/g) || []).length);
  });
  it("этап 59: функции, таблицы, напоминание — правкой текста функции, права", () => {
    const s = rd("supabase/supabase-stage59-menu-repeat.sql");
    for (const f of ["menu_know_set(p_token text, p_data jsonb default null, p_warm jsonb default null)", "menu_focus_get(p_token text)",
      "menu_focus_set(p_token text, p_kind text, p_id text, p_name text default '', p_on boolean default true, p_note text default '')", "menu_know_team(p_token text, p_restaurant text default null)",
      "_sa_menu_warm_pick(p_emp text, p_rest text, p_day date)", "create table if not exists sa_menu_know", "create table if not exists sa_menu_focus"]) expect(s).toContain(f);
    expect(s).toContain("def := replace(def, lit, $r$E'\\n\\n' || _sa_menu_warm_line(target.emp_id, v.restaurant, ld)$r$);");
    expect(s).toContain("perform _sa_menu_warm_mark(target.emp_id, v.restaurant, ld);$r$);");
    expect(s).toContain("grant execute on function menu_know_set(text, jsonb, jsonb), menu_focus_get(text), menu_focus_set(text, text, text, text, boolean, text),");
    expect(s).not.toMatch(/drop table/i);
  });
});
