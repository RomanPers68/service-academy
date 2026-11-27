// v202 (Доп. 527): живая проверка в смене. Владелец (27.11) на предложения, как ещё упростить живую проверку: «Давай все,
// кроме 10-го и 2-го».
//   1. Брифинг — ui/brief-live-check.jsx: двое-трое со смены по вопросу, пункты в «Провести», команде не уходит;
//   3. Просьбы — «Готов к живой проверке» / «к пересдаче», у руководителя первыми; 4. Меню заведения — вопросы о блюдах;
//   5. «Повтори вслух» в «Работе над ошибками» — ui/live-practice.jsx; 6. Свои вопросы — ui/live-check-editor.jsx,
//      «Неудачный вопрос?»; 7. Допуск к залу и «Путь мастера» — ui/live-admit.jsx, lib/mastery.js;
//   8. Итог недели в Telegram и 9. План и сверка проверяющих — этап 65 (supabase-stage65-live-check-shift.sql,
//      tools/claude/sql/test65.sh), сводка.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v202.mjs.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { LIVE_CHECK } from "../data/live-check.js";
import { MODULES_INDEX } from "../data/modules-index.js";
import { DEMO_MENUS as RESTAURANT_MENUS } from "../tools/claude/demo-app/menu-seed.js";   // v210: блюда для проверок
import { isModuleCheck, mergeBank, dishKey, menuQuestions, briefQuestion, briefPick, admission, askState, failedItems, livePassed, calib, lcErr65,
  ADMIT, LC_MENU, PLAN_DAYS, qKey, lastByModule } from "../lib/live-check.js";
import { lcSave, lcFlush, LC_QUEUE_KEY, lcRequests, lcRequest, lcFlag, lcFlagDone, lcPlanSet, lcQuestionSave, loadQuestions, _resetQuestions, LCQ_KEY,
  saveMine, readMine, practiceDone, practiceMark, lcSummary } from "../lib/live-check-api.js";
import { _resetOrg } from "../lib/org.js";
import { FAMILIES, masteryFacts, familyState } from "../lib/mastery.js";
import { LiveCheckScreen } from "../ui/live-check.jsx";
import { BriefLcBlock, BriefLcPage } from "../ui/brief-live-check.jsx";
import { LivePractice } from "../ui/live-practice.jsx";
import { AdmitCard, admitLine } from "../ui/live-admit.jsx";
import { LiveCheckEditor } from "../ui/live-check-editor.jsx";
import { MistakesScreen } from "../ui/screens-learning.jsx";
import { STAGES, CRON_JOBS } from "../lib/server-check.js";
import { sanitize, PROMPT } from "../api/lesson-assist.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const R0 = "Два моря, Океан", PORT = "Порт";
const PEOPLE = [
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender", is_admin: false },
  { id: "e-igor", name: "Игорь", surname: "Портов", restaurant: PORT, position: "waiter", is_admin: false },
];
const TOK = { tr: "u-roman", tm: "u-maria", ta: "e-anna", ti: "e-ilya", tg: "e-igor" };
let now = Date.UTC(2026, 10, 27, 2, 0);
const mk = (x = {}) => makeServer({ today: "2026-11-27", rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, scores: [],
  progress: { "e-anna": ["s0-1", "s0-2", "s0-3", "s0-4"] }, quizzes: { "e-anna": ["s0-q", "s5-q"] }, clock: () => now, ...x });
const realFetch = globalThis.fetch, realLS = globalThis.localStorage, realSS = globalThis.sessionStorage;
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, key: (i) => [...m.keys()][i], get length() { return m.size; }, _m: m }; };
let calls = [];
const useServer = (srv) => { calls = []; globalThis.fetch = async (u, init = {}) => { const fn = String(u).split("/rpc/")[1]; const b = JSON.parse(init.body || "{}"); calls.push({ fn, b }); return { ok: true, status: 200, json: async () => srv.rpc(fn, b) }; }; };
const login = (tok) => globalThis.localStorage.setItem("sa_session_token", tok);
const phone = () => { globalThis.localStorage = mem(); globalThis.sessionStorage = mem(); _resetOrg(); _resetQuestions(); };
const leave = () => { globalThis.fetch = realFetch; globalThis.localStorage = realLS; globalThis.sessionStorage = realSS; _resetOrg(); _resetQuestions(); };
const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, a11y: false, para: {}, quizWrap: {}, quizProgress: {}, quizQ: {}, quizOpt: {}, secTitle: {}, bold: {}, note: {}, doneBtn: {} };
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const OKEAN = RESTAURANT_MENUS[R0];

describe("v202 · версия и журнал", () => {
  it("сборка v202, Дополнение 527 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(202);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 527 — .*\(v202\)/);
    const part = c.slice(c.indexOf("# Дополнение 527"));
    expect(part).toContain("«Давай все, кроме 10-го и 2-го»");
    for (const w of ["supabase/supabase-stage65-live-check-shift.sql", "tools/claude/sql/test65.sh (36 проверок)", "tools/claude/e2e-v202.mjs (48 проверок)",
      "Проверка на брифинге", "Готов к живой проверке", "Меню заведения", "Повтори вслух", "Вопросы живой проверки", "Допуск к залу", "Итог недели", "каждого раз в 30 дней"]) expect(part, w).toContain(w);
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v202 · вопросы: правки руководства, меню заведения", () => {
  it("проверка модуля — не блиц и не брифинг", () => {
    expect([{ m: "s0", k: "module" }, { m: "blitz", k: "blitz" }, { m: "brief", k: "brief" }, { m: "menu", k: "module" }, null].map(isModuleCheck)).toEqual([true, false, false, true, false]);
  });
  it("правки поверх банка: формулировка и пункты, спрятан, свой вопрос «c12»; банк приложения не меняется", () => {
    const rows = [{ m: "s0", n: "3", q: "Новый текст вопроса?", a: ["Пункт один", " ", "Пункт два"], l: "s0-2" }, { m: "s0", n: "5", h: true },
      { m: "s0", n: "c12", q: "Свой вопрос о смене?", a: ["Раз", "Два"], l: "" }, { m: "s0", n: "c13", q: null, a: null }, { m: "zz", n: "c1", q: "Вопрос нового модуля?", a: ["Да"] }];
    const b = mergeBank(LIVE_CHECK, rows);
    expect(b.s0.find((q) => q.n === 3)).toMatchObject({ q: "Новый текст вопроса?", a: ["Пункт один", "Пункт два"], l: "s0-2", edited: true });
    expect(b.s0.some((q) => q.n === 5)).toBe(false);
    expect(b.s0.find((q) => q.n === "c12")).toEqual({ n: "c12", l: "", q: "Свой вопрос о смене?", a: ["Раз", "Два"], own: true });
    expect(b.s0.length).toBe(8);   // 8 − спрятанный + свой; пустой свой не попадает
    expect(b.zz).toEqual([{ n: "c1", l: "", q: "Вопрос нового модуля?", a: ["Да"], own: true }]);
    expect(LIVE_CHECK.s0.find((q) => q.n === 3).q).not.toBe("Новый текст вопроса?");
    expect(LIVE_CHECK.s0.length).toBe(8);
    expect(qKey("s0", b.s0.find((q) => q.n === "c12"))).toBe("s0#c12");
  });
  it("ключ блюда: латиница как есть, иначе — с хвостом от названия; разные блюда — разные ключи", () => {
    expect(dishKey({ id: "ok2601" })).toBe("ok2601");
    const a = dishKey({ id: "dish-борщ" }), b = dishKey({ id: "dish-щи" }), c = dishKey({ name: "Борщ" });
    for (const k of [a, b, c]) expect(k).toMatch(/^[a-z0-9_-]{1,40}$/);
    expect(new Set([a, b, c]).size).toBe(3);
    expect(dishKey({ name: "Борщ" })).toBe(c);
    expect(dishKey({})).toBe("");
  });
  it("вопросы о блюдах: до трёх главного в составе (без скобок), аллергены, первая фраза описания", () => {
    const qs = menuQuestions(OKEAN);
    expect(qs.length).toBe(OKEAN.length);
    expect(qs[0]).toMatchObject({ n: "ok2601", m: LC_MENU, k: "menu#ok2601", dish: "Ассорти паштетов из морепродуктов", cat: "Закуски", l: "",
      q: "Блюдо «Ассорти паштетов из морепродуктов»: что в составе, какие аллергены и как расскажешь гостю?" });
    expect(qs[0].a).toEqual(["Паштет из осьминога", "Рыбный паштет", "Крабовый паштет", "Аллергены: моллюски и ракообразные, рыба, молоко",
      "Как рассказать: Нежный мусс из красной рыбы, кремовый паштет из осьминога и насыщенный крабовый паштет из стригуна."]);
    const two = menuQuestions([{ id: "x1", name: "Чай", ingredients: ["Чай", "Мята"] }, { id: "x2", name: "Вода" }, { id: "x3", name: "Сок", desc: "Свежий. Из апельсина.", allergens: ["Молоко"] }],
      { label: (x) => "«" + x + "»" });
    expect(two.map((q) => [q.n, q.q, q.a])).toEqual([["x1", "Блюдо «Чай»: что в составе?", ["Чай", "Мята"]],
      ["x3", "Блюдо «Сок»: какие аллергены и как расскажешь гостю?", ["Аллергены: «молоко»", "Как рассказать: Свежий."]]]);
    for (const q of qs) { expect(q.a.length).toBeGreaterThanOrEqual(2); expect(q.a.length).toBeLessThanOrEqual(6); }
  });
});

describe("v202 · брифинг, допуск, просьбы, «Повтори вслух», сверка", () => {
  const people = [
    { id: "e-anna", name: "Анна", surname: "Смирнова", position: "waiter", quiz: ["s0-q"], checks: [{ m: "s1", k: "module", s: 40, p: false, at: "2026-11-20T10:00:00Z" }] },
    { id: "e-petr", name: "Пётр", surname: "Орлов", position: "waiter", quiz: [], checks: [] },
    { id: "e-ilya", name: "Илья", surname: "Белов", position: "bartender", quiz: [], checks: [] },
    { id: "e-vera", name: "Вера", surname: "Соколова", position: "waiter", quiz: [], checks: [{ m: "s0", k: "module", s: 90, p: true, at: "2026-11-26T10:00:00Z" }] },
    { id: "u-roman", name: "Роман", surname: "", position: "owner", quiz: [], checks: [] },
  ];
  it("брифинг: только со смены, до трёх, сначала пересдача, у последнего — блюдо; ключи разные", () => {
    const menuQs = menuQuestions(OKEAN);
    const pick = briefPick({ people, onShift: new Set(["e-anna", "e-petr", "e-ilya", "e-vera"]), modsByTrack: MODULES_INDEX, bank: LIVE_CHECK, menuQs, now, rng: seeded(7) });
    expect(pick.length).toBe(3);
    expect(pick[0]).toMatchObject({ emp: "e-anna", name: "Анна Смирнова", short: "Анна", track: "seasonal" });
    expect(pick[0].q.m).toBe("s1");   // пересдача — из модуля, который не сдан
    expect(pick[2].q.k).toMatch(/^menu#ok26\d\d$/);
    expect(new Set(pick.map((x) => x.q.k)).size).toBe(3);
    for (const x of pick) { expect(x.q.q).toBeTruthy(); expect(Array.isArray(x.q.a)).toBe(true); }
    expect(briefPick({ people, onShift: new Set(["e-ilya"]), modsByTrack: MODULES_INDEX, bank: LIVE_CHECK, menuQs, now, rng: seeded(3) }).map((x) => [x.emp, x.q.m.startsWith("bar")]))
      .toEqual([["e-ilya", true]]);   // один человек — блюда нет, вопрос по своему курсу
    expect(briefPick({ people, onShift: new Set(["u-roman"]), modsByTrack: MODULES_INDEX, bank: LIVE_CHECK })).toEqual([]);   // без курса — некого
    expect(briefPick({ people, onShift: null, modsByTrack: MODULES_INDEX, bank: LIVE_CHECK, rng: seeded(5) }).length).toBe(3);   // графика нет — из всех
  });
  it("другой вопрос — не из уже заданных; о блюде — другое блюдо", () => {
    const anna = people[0], menuQs = menuQuestions(OKEAN);
    const q1 = briefQuestion(anna, { modsByTrack: MODULES_INDEX, bank: LIVE_CHECK, now, rng: seeded(11) });
    const q2 = briefQuestion(anna, { modsByTrack: MODULES_INDEX, bank: LIVE_CHECK, now, rng: seeded(11), exclude: new Set([q1.k]) });
    expect(q1.k).not.toBe(q2.k);
    const d1 = briefQuestion(anna, { menuQs, menu: true, rng: seeded(2) }), d2 = briefQuestion(anna, { menuQs, menu: true, rng: seeded(2), exclude: new Set([d1.k]) });
    expect([d1.m, d2.m, d1.k === d2.k]).toEqual([LC_MENU, LC_MENU, false]);
  });
  it("допуск к залу: тест и живая проверка по «Аллергиям» и «ЧП»", () => {
    expect(ADMIT).toEqual(["s5", "s-er"]);
    const mods = MODULES_INDEX.seasonal;
    expect(admission(mods, {})).toMatchObject({ done: 0, total: 4, ok: false });
    const a = admission(mods, { quiz: ["s5-q"], checks: [{ m: "s5", k: "module", s: 80, p: true, at: "2026-11-26" }, { m: "s-er", k: "module", s: 50, p: false, at: "2026-11-26" }] });
    expect(a.rows.map((r) => [r.m, r.title, r.test, r.live, r.s])).toEqual([["s5", "Аллергии и безопасность", true, true, 80], ["s-er", "ЧП в зале: действуй за секунды", false, false, 50]]);
    expect([a.done, a.ok]).toEqual([2, false]);
    expect(admission(mods, { tests: { "s5-q": 90, "s-er-q": 76 }, checks: [{ m: "s5", s: 100, p: true, at: "1" }, { m: "s-er", s: 80, p: true, at: "1" }] }).ok).toBe(true);
    expect(admission(mods, { quiz: ["s5-q", "s-er-q"], checks: [{ m: "brief", k: "brief", s: 100, p: true, at: "1" }] }).done).toBe(2);   // брифинг — не проверка модуля
  });
  it("позвать на проверку: пройден в приложении — «проверка», не зачтено — «пересдача», зачтено — нет, просьба — отправлена", () => {
    const m = MODULES_INDEX.seasonal[0];
    expect(askState(m, null, { lessons: m.lessons.map((l) => l.id) })).toEqual({ kind: "check", sent: false });
    expect(askState(m, null, { quiz: ["s0-q"] })).toEqual({ kind: "check", sent: false });
    expect(askState(m, null, {})).toBe(null);
    expect(askState(m, { p: false, s: 40 }, {})).toEqual({ kind: "retake", sent: false });
    expect(askState(m, { p: true, s: 90 }, { req: { k: "check" } })).toBe(null);
    expect(askState(m, null, { req: { k: "check" } })).toEqual({ kind: "check", sent: true });
    expect(askState(m, { p: false }, { req: { k: "retake" } })).toEqual({ kind: "retake", sent: true });
  });
  it("«Повтори вслух»: последний ответ на вопрос; назвал всё позже или повторил после проверки — уходит; блюдо — из меню", () => {
    const menuQs = menuQuestions(OKEAN);
    const checks = [
      { m: "s0", k: "module", at: "2026-11-20T10:00:00Z", by: "Мария Ким", it: [{ k: "s0#1", g: 1, o: 3 }, { k: "s0#2", g: 3, o: 3 }, { k: "s0#3", g: 0, o: 2 }] },
      { m: "brief", k: "brief", at: "2026-11-25T10:00:00Z", it: [{ k: "s0#1", g: 3, o: 3 }] },
      { m: "menu", k: "module", at: "2026-11-26T10:00:00Z", it: [{ k: "menu#ok2601", g: 2, o: 5 }, { k: "menu#gone", g: 0, o: 3 }] },
      { m: "s1", k: "module", at: "2026-11-26T11:00:00Z", it: [{ k: "s1#4", g: 1, o: 2 }] },
      { m: "s2", k: "module", at: "2026-11-01T10:00:00Z", marks: [0, 0] },
    ];
    const f = failedItems(checks, LIVE_CHECK, { menuQs });
    expect(f.map((x) => [x.k, x.g, x.o])).toEqual([["s1#4", 1, 2], ["menu#ok2601", 2, 5], ["s0#3", 0, 2]]);
    expect(f[2]).toMatchObject({ m: "s0", q: LIVE_CHECK.s0[2].q, a: LIVE_CHECK.s0[2].a, by: "Мария Ким" });
    expect(failedItems(checks, LIVE_CHECK, { menuQs, done: { "s1#4": "2026-11-26T12:00:00Z", "s0#3": "2026-11-01T00:00:00Z" } }).map((x) => x.k)).toEqual(["menu#ok2601", "s0#3"]);
    expect(failedItems(checks, LIVE_CHECK, { menuQs, max: 1 }).length).toBe(1);
  });
  it("зачтено вживую — в «Путь мастера»; сверка проверяющих; тексты этапа 65", () => {
    expect(livePassed([{ m: "s0", k: "module", p: true, at: "2" }, { m: "s0", k: "module", p: false, at: "1" }, { m: "s1", k: "module", p: false, at: "3" },
      { m: "blitz", k: "blitz", p: true, at: "4" }, { m: "menu", k: "module", p: true, at: "5" }])).toEqual(["menu", "s0"]);
    expect([calib({ m: 5, avg: 95 }, 70), calib({ m: 5, avg: 50 }, 70), calib({ m: 5, avg: 80 }, 70), calib({ m: 2, avg: 99 }, 50), calib({ m: 5, avg: 90 }, null)])
      .toEqual(["soft", "hard", null, null, null]);
    expect(lcErr65("stage65", true)).toContain("после этапа базы 65");
    expect(lcErr65("stage65")).toBe("Это появится, когда владелец обновит сервер.");
    expect(lcErr65("too_many")).toContain("не больше чем по десяти модулям");
    expect(lcErr65("stage64", true)).toContain("этапа базы 64");
    expect(PLAN_DAYS).toEqual([14, 30, 60, 90]);
  });
});

describe("v202 · сервер демо: этап 65 по тем же правилам", () => {
  const save = (s, x) => s.rpc("live_check_save", { p_token: "tm", p_emp: "e-anna", p_track: "seasonal", p_module: "s0", p_items: [{ k: "s0#1", g: 3, o: 3 }], p_kind: "module", ...x });
  it("брифинг: только модуль «brief», бот — если назвал не всё; блюда и свои ключи", () => {
    const s = mk();
    expect(save(s, { p_module: "brief", p_kind: "brief", p_items: [{ k: "s5#1", g: 1, o: 3 }, { k: "menu#borsch", g: 2, o: 2 }] })).toMatchObject({ ok: true, score: 60, sent: true });
    expect(save(s, { p_module: "brief", p_kind: "brief", p_items: [{ k: "s5#2", g: 2, o: 2 }] })).toMatchObject({ ok: true, score: 100, sent: false });
    expect([save(s, { p_module: "s0", p_kind: "brief" }).error, save(s, { p_module: "brief", p_kind: "module" }).error, save(s, { p_module: "brief", p_kind: "brief", p_items: null, p_marks: [2] }).error])
      .toEqual(["bad_request", "bad_request", "bad_request"]);
    expect(save(s, { p_items: [{ k: "s0#c12", g: 1, o: 1 }] })).toMatchObject({ ok: true });
    expect(save(s, { p_module: "menu", p_title: "Меню заведения", p_items: [{ k: "menu#ok2601", g: 1, o: 3 }], p_repeat: [{ l: "ok2601", t: "Паштеты" }] })).toMatchObject({ ok: true, score: 33 });
    expect(s.S.lc.sent.map((x) => [x.text, x.go])).toEqual([["Вопрос на брифинге: названо 3 из 5 пунктов.", "lc_me"], ["Живая проверка «s0»: 100%, зачтено.", "lc_me"],
      ["Живая проверка «Меню заведения»: 33%, не зачтено.\nПовторить блюда: «Паштеты».", "lc_me"]]);
  });
  it("просьбы: проверка, повтор, пересдача; руководитель видит, проверка модуля закрывает; отмена; без этапа 65 — нет функции", () => {
    const s = mk(), rq = (tok, x) => s.rpc("live_check_request", { p_token: tok, p_track: "seasonal", ...x });
    expect(rq("ta", { p_module: "s5", p_title: "Аллергии и безопасность" })).toMatchObject({ ok: true, kind: "check", again: false });
    expect(rq("ta", { p_module: "s5" })).toMatchObject({ ok: true, kind: "check", again: true });
    save(s, { p_module: "s1", p_items: [{ k: "s1#1", g: 0, o: 3 }] });
    expect(rq("ta", { p_module: "s1" })).toMatchObject({ kind: "retake" });
    expect([rq("ta", { p_module: "blitz" }).error, rq("ta", { p_module: "s5", p_track: "x" }).error]).toEqual(["bad_request", "bad_request"]);
    const list = (tok, v) => s.rpc("live_check_requests", { p_token: tok, p_restaurant: v || null });
    expect(list("tm").people.map((r) => [r.name, r.m, r.k, r.ti])).toEqual([["Анна", "s5", "check", "Аллергии и безопасность"], ["Анна", "s1", "retake", null]]);
    expect([list("ta").mine.length, list("ta").people.length, list("ti").people.length, list("tr", PORT).people.length]).toEqual([2, 0, 0, 0]);
    save(s, { p_module: "s5", p_items: [{ k: "s5#1", g: 3, o: 3 }] });
    expect(list("tm").people.map((r) => r.m)).toEqual(["s1"]);
    expect([rq("ta", { p_module: "s1", p_cancel: true }).cancelled, rq("ta", { p_module: "s1", p_cancel: true }).cancelled]).toEqual([true, false]);
    expect(list("tm").plan_days).toBe(30);
    const s2 = mk({ noStage65: true });
    expect(s2.rpc("live_check_requests", { p_token: "tm" }).code).toBe("PGRST202");
    expect(s2.rpc("live_check_save", { p_token: "tm", p_emp: "e-anna", p_track: "seasonal", p_module: "brief", p_kind: "brief", p_items: [{ k: "s0#1", g: 1, o: 1 }] }).error).toBe("bad_request");
  });
  it("отметки и правки: отмечает от старшего бармена, правит руководство сети; правка снимает отметки; свой «c1»; норма", () => {
    const s = mk();
    const fl = (tok, key, x) => s.rpc("live_check_flag", { p_token: tok, p_track: "seasonal", p_module: key.split("#")[0], p_key: key, ...x });
    expect([fl("tm", "s0#3", { p_note: "непонятно" }).ok, fl("tm", "s0#3").ok, fl("ta", "s0#3").error, fl("tm", "s0#x y").error]).toEqual([true, true, "forbidden", "bad_request"]);
    expect(s.rpc("live_check_questions", { p_token: "tm" })).toMatchObject({ ok: true, can_edit: false, flags: [] });
    expect(s.rpc("live_check_questions", { p_token: "tr" }).flags.map((f) => [f.k, f.n, f.notes[0].note, f.notes[0].by])).toEqual([["s0#3", 1, "непонятно", "Мария Ким"]]);
    const qs = (tok, x) => s.rpc("live_check_question_save", { p_token: tok, p_track: "seasonal", p_module: "s0", ...x });
    const A = ["Подождать паузу", "Встать в поле зрения"];
    expect(qs("tm", { p_n: "3", p_q: "Как подойти к столу, если гость говорит?", p_a: A }).error).toBe("forbidden");
    expect(qs("tr", { p_n: "3", p_q: "Как подойти к столу, если гость говорит?", p_a: A })).toMatchObject({ ok: true, n: "3", resolved: 1 });
    expect(qs("tr", { p_q: "Что сказать, если блюдо задерживается?", p_a: A })).toMatchObject({ ok: true, n: "c1" });
    expect(qs("tr", { p_n: "5", p_hidden: true })).toMatchObject({ ok: true, n: "5" });
    expect([qs("tr", { p_n: "c9", p_q: "Что сказать, если блюдо задерживается?", p_a: A }).error, qs("tr", { p_q: "Коротко", p_a: A }).error, qs("tr", { p_module: "menu", p_q: "Что сказать гостю о блюде?", p_a: A }).error])
      .toEqual(["not_found", "bad_request", "bad_request"]);
    const rows = s.rpc("live_check_questions", { p_token: "ta" }).rows;
    expect(rows.map((r) => [r.m + "#" + r.n, r.h])).toEqual([["s0#3", false], ["s0#5", true], ["s0#c1", false]]);
    expect(mergeBank(LIVE_CHECK, rows).s0.map((q) => String(q.n))).toEqual(["1", "2", "3", "4", "6", "7", "8", "c1"]);
    fl("tm", "s1#2");
    expect([s.rpc("live_check_flag_done", { p_token: "tm", p_key: "s1#2" }).error, s.rpc("live_check_flag_done", { p_token: "tr", p_key: "s1#2" }).resolved]).toEqual(["forbidden", 1]);
    expect([s.rpc("live_check_plan_set", { p_token: "tm", p_days: 14 }).error, s.rpc("live_check_plan_set", { p_token: "tr", p_days: 45 }).error, s.rpc("live_check_plan_set", { p_token: "tr", p_days: 14 }).days])
      .toEqual(["forbidden", "bad_request", 14]);
  });
  it("сводка: брифинг, план по заведениям, средний у проверяющих и по сети, просьбы, отметки", () => {
    const s = mk();
    save(s, { p_items: [{ k: "s0#1", g: 1, o: 2 }] });                              // 50, Анна
    save(s, { p_module: "brief", p_kind: "brief", p_items: [{ k: "s5#1", g: 1, o: 1 }] });
    s.rpc("live_check_save", { p_token: "tr", p_emp: "e-igor", p_track: "seasonal", p_module: "s0", p_items: [{ k: "s0#2", g: 3, o: 3 }], p_kind: "module" });   // 100, Порт
    s.rpc("live_check_request", { p_token: "ta", p_track: "seasonal", p_module: "s5" });
    s.rpc("live_check_flag", { p_token: "tm", p_track: "seasonal", p_module: "s0", p_key: "s0#3" });
    const m = s.rpc("live_check_summary", { p_token: "tm" }), r = s.rpc("live_check_summary", { p_token: "tr" });
    expect([m.restaurant, m.totals.checks, m.totals.brief, m.net_avg, m.plan.done, m.plan.due, m.plan.edit, m.requests, m.flags]).toEqual([R0, 1, 1, 75, 1, 3, false, 1, 0]);
    expect(m.venues[0].checkers).toEqual([{ name: "Мария Ким", n: 2, m: 1, avg: 50 }]);
    expect([r.plan.due, r.plan.done, r.plan.venues, r.plan.edit, r.flags]).toEqual([4, 2, [{ name: R0, due: 3, done: 1 }, { name: PORT, due: 1, done: 1 }], true, 1]);
    expect(mk({ noStage65: true }).rpc("live_check_summary", { p_token: "tm" }).plan).toBe(undefined);
  });
});

describe("v202 · запросы с телефона (lib/live-check-api.js)", () => {
  beforeEach(() => { phone(); now = Date.UTC(2026, 10, 27, 2, 0); });
  afterEach(leave);
  it("брифинг на сервере с этапом 65 — вид «brief»; без него — блицем «Брифинг» (только вопросы по урокам)", async () => {
    let s = mk(); useServer(s); login("tm");
    expect(await lcSave({ emp: "e-anna", track: "seasonal", module: "brief", kind: "brief", items: [{ k: "s0#1", g: 1, o: 2 }, { k: "menu#ok2601", g: 2, o: 2 }] })).toMatchObject({ ok: true, score: 75 });
    expect(s.S.lc.checks[0]).toMatchObject({ m: "brief", kind: "brief" });
    s = mk({ noStage65: true }); useServer(s); login("tm");
    const r = await lcSave({ emp: "e-anna", track: "seasonal", module: "brief", kind: "brief", items: [{ k: "s0#1", g: 1, o: 2 }, { k: "menu#ok2601", g: 2, o: 2 }] });
    expect(r).toMatchObject({ ok: true, asBlitz: true, score: 50 });
    expect(s.S.lc.checks[0]).toMatchObject({ m: "blitz", kind: "blitz", title: "Брифинг", items: [{ k: "s0#1", g: 1, o: 2 }] });
    expect(await lcSave({ emp: "e-anna", track: "seasonal", module: "brief", kind: "brief", items: [{ k: "menu#ok2601", g: 2, o: 2 }] })).toEqual({ ok: false, error: "stage65" });
    expect(await lcSave({ emp: "e-anna", track: "seasonal", module: "menu", items: [{ k: "menu#ok2601", g: 2, o: 2 }] })).toEqual({ ok: false, error: "stage65" });
    expect(await lcSave({ emp: "e-anna", track: "seasonal", module: "s0", items: [{ k: "s0#c3", g: 2, o: 2 }] })).toEqual({ ok: false, error: "stage65" });
  });
  it("брифинг без сети ждёт на телефоне; связь вернулась, а этапа 65 нет — уходит блицем", async () => {
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    login("tm");
    expect(await lcSave({ emp: "e-anna", track: "seasonal", module: "brief", kind: "brief", items: [{ k: "s0#1", g: 1, o: 1 }] })).toMatchObject({ ok: true, queued: true });
    expect(JSON.parse(globalThis.localStorage.getItem(LC_QUEUE_KEY)).length).toBe(1);
    const s = mk({ noStage65: true }); useServer(s);
    expect(await lcFlush()).toBe(1);
    expect(s.S.lc.checks[0]).toMatchObject({ kind: "blitz", title: "Брифинг" });
  });
  it("просьбы, отметки, правки, норма — с телефона; без этапа 65 — error stage65", async () => {
    let s = mk(); useServer(s); login("ta");
    expect(await lcRequest({ track: "seasonal", module: "s5", title: "Аллергии и безопасность" })).toMatchObject({ ok: true, kind: "check" });
    expect(calls.at(-1)).toMatchObject({ fn: "live_check_request", b: { p_track: "seasonal", p_module: "s5", p_title: "Аллергии и безопасность", p_cancel: false } });
    expect((await lcRequests()).mine.map((r) => r.m)).toEqual(["s5"]);
    login("tm");
    expect(await lcFlag({ track: "seasonal", module: "s0", key: "s0#3", note: "непонятно" })).toEqual({ ok: true });
    login("tr");
    expect((await loadQuestions(true)).flags.map((f) => f.k)).toEqual(["s0#3"]);
    expect(await lcQuestionSave({ track: "seasonal", module: "s0", n: 3, q: "Как подойти к столу, если гость говорит?", a: ["Подождать", "Встать в поле зрения"] }))
      .toMatchObject({ ok: true, n: "3", resolved: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse(globalThis.localStorage.getItem(LCQ_KEY)).rows.map((r) => r.n)).toEqual(["3"]);   // копия правок на телефоне
    expect(await lcFlagDone("s0#3")).toEqual({ ok: true, resolved: 0 });
    expect(await lcPlanSet(60)).toEqual({ ok: true, days: 60 });
    expect((await lcSummary()).plan.days).toBe(60);
    s = mk({ noStage65: true }); useServer(s); _resetQuestions();
    expect([(await lcRequests()).error, (await lcFlag({ track: "seasonal", module: "s0", key: "s0#1" })).error, (await lcPlanSet(30)).error]).toEqual(["stage65", "stage65", "stage65"]);
    expect((await loadQuestions()).stage).toBe(false);
  });
  it("свои проверки на телефоне — для «Пути мастера» и допуска; «Повтори вслух» помнит, что повторил", () => {
    saveMine("_Анна_Смирнова", [{ m: "s0", k: "module", p: true, at: "2026-11-26" }, { m: "s1", k: "module", p: false, at: "2026-11-26" }, { m: "blitz", k: "blitz", p: true, at: "2026-11-27" },
      { m: "s5", k: "module", p: false, at: "2026-11-20" }, { m: "s5", k: "module", p: true, at: "2026-11-25" }]);
    const mine = readMine("_Анна_Смирнова");
    expect(mine.passed).toEqual(["s0", "s5"]);
    expect(mine.checks.length).toBe(5);
    const f = masteryFacts({ uk: "_Анна_Смирнова", storage: globalThis.localStorage, now: new Date(now) });
    expect(f.livePassed).toBe(2);
    expect(familyState("hall", { hallSkills: 1, livePassed: 2 })).toMatchObject({ value: 3, tier: 1 });
    const hall = FAMILIES.find((x) => x.id === "hall");
    expect(hall.how).toBe("Покажи навык в зале, и старший подтвердит его своим PIN или в «Наставничестве». Зачтённая живая проверка тоже в счёт.");
    expect(practiceDone("_x")).toEqual({});
    practiceMark("_x", "s0#3", "2026-11-27T10:00:00Z");
    expect(practiceDone("_x")).toEqual({ "s0#3": "2026-11-27T10:00:00Z" });
  });
});

describe("v202 · экраны (без JSX, renderToString)", () => {
  beforeEach(phone);
  afterEach(leave);
  const c = { a11y: false, gold: "#D2A85A", text: "#EFE4C8", sub: "#A99A7C", line: "rgba(0,0,0,.2)", red: "#E08A7A", frost: {} };
  const it1 = { emp: "e-anna", name: "Анна Смирнова", short: "Анна", track: "seasonal", q: { ...LIVE_CHECK.s0[0], m: "s0", k: "s0#1" } };
  const it2 = { emp: "e-petr", name: "Пётр Орлов", short: "Пётр", track: "seasonal", q: menuQuestions(OKEAN)[1] };
  it("блок «Проверка на брифинге»: люди, вопрос, «Другой вопрос», «Другой человек», «Убрать»; не руководитель — ничего", () => {
    const lc = { can: true, items: [it1, it2], on: true, guess: false, setOn() {}, swapQ() {}, other() {}, drop() {}, marks: {}, put() {}, save() {} };
    const html = R(h(BriefLcBlock, { lc, c, a11y: false }));
    expect(html).toContain('data-brief-block="lc" data-on="1"');
    expect(html).toContain("По вопросу 2 людям со смены. Пункты отмечаешь в «Провести», команде этот блок не отправляется.");
    expect([...html.matchAll(/data-brief-lc="([^"]+)"/g)].map((m) => m[1])).toEqual(["e-anna", "e-petr"]);
    expect(html).toContain('data-brief-lc-key="menu#ok2602"');
    for (const t of ["Другой вопрос", "Другой человек", "Убрать", "Психология первого дня", "Меню · Закуски"]) expect(html, t).toContain(t);
    expect(R(h(BriefLcBlock, { lc: { ...lc, items: null }, c, a11y: false }))).toContain("Собираю, кого спросить…");
    expect(R(h(BriefLcBlock, { lc: { ...lc, items: [], guess: true }, c, a11y: false }))).toContain("Спросить некого");
    expect(R(h(BriefLcBlock, { lc: { ...lc, items: [it1], guess: true }, c, a11y: false }))).toContain("Графика на сегодня нет: выбрал из всей команды, замени тех, кого нет.");
    expect(R(h(BriefLcBlock, { lc: { ...lc, can: false }, c, a11y: false }))).toBe("");
  });
  it("страница в «Провести»: вопрос, ответ по касанию, пункты, «Записать ответ», «Записано»", () => {
    const lc = { marks: {}, put() {}, save() {} };
    const closed = R(h(BriefLcPage, { lc, it: it1, c }));
    expect(closed).toContain('data-brief-lc-q="s0#1"');
    expect(closed).toContain("Показать, что должно прозвучать");
    expect(closed).not.toContain("data-brief-lc-pt");
    const open = R(h(BriefLcPage, { lc: { ...lc, marks: { "e-anna": { open: true, got: [0] } } }, it: it1, c }));
    expect(open).toContain("Что назвал сам · 1 из " + it1.q.a.length);
    expect((open.match(/data-brief-lc-pt=/g) || []).length).toBe(it1.q.a.length);
    expect(open).toContain("Записать ответ");
    const saved = R(h(BriefLcPage, { lc: { ...lc, marks: { "e-anna": { open: true, got: [0], saved: { score: 33, g: 1, o: 3 } } } }, it: it1, c }));
    expect(saved).toContain("Записано: 1 из 3.");
    expect(saved).not.toContain("Записать ответ");
  });
  it("«Повтори вслух»: вопросы с проверок, где назвал не всё; нечего — пусто; в «Работе над ошибками» — над тестами", () => {
    saveMine("_Анна_Смирнова", [{ m: "s0", k: "module", p: false, s: 50, at: "2026-11-26T10:00:00Z", by: "Мария Ким", it: [{ k: "s0#1", g: 1, o: 3 }, { k: "s0#2", g: 3, o: 3 }] }]);
    const prof = { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: "" };
    const html = R(h(LivePractice, { T, a11y: false, profile: prof, uk: "_Анна_Смирнова" }));
    expect(html).toContain('data-live-practice="1"');
    expect(html).toContain('data-live-practice-q="s0#1"');
    expect(html).toContain("Повтори вслух · 1");
    expect(html).toContain("Психология первого дня · проверка 26.11 · было 1 из 3");
    expect(R(h(LivePractice, { T, a11y: false, profile: prof, uk: "_нет" }))).toBe("");
    const ms = R(h(MistakesScreen, { T, a11y: false, mistakeBank: [], noTests: true, onResolve() {}, onFail() {}, onBack() {}, live: h("div", { "data-x-live": "" }, "живое") }));
    expect(ms.indexOf("data-x-live")).toBeGreaterThan(-1);
    expect(ms.indexOf("data-x-live")).toBeLessThan(ms.indexOf("data-mistakes-empty"));
  });
  it("допуск к залу: карточка новичку и строка руководителю", () => {
    saveMine("_Ксения_Миронова", [{ m: "s5", k: "module", p: true, s: 90, at: "2026-11-26" }]);
    const html = R(h(AdmitCard, { T, a11y: false, uk: "_Ксения_Миронова", quizDone: { "s5-q": true, "s-er-q": true }, onLiveCheck() {} }));
    expect(html).toContain('data-nb-admit="3/4"');
    expect(html).toContain("Допуск к залу · 3 из 4");
    expect(html).toContain("Позвать на живую проверку");   // тест «ЧП» сдан, вживую не проверяли
    const two = R(h(AdmitCard, { T, a11y: false, uk: "_Ксения_Миронова", quizDone: { "s5-q": true }, onLiveCheck() {} }));
    expect(two).toContain('data-nb-admit="2/4"');
    expect(two).not.toContain("Позвать на живую проверку");   // звать не с чем: тест «ЧП» ещё не сдан
    expect(html).not.toContain("—");
    expect(admitLine({ position: "waiter", quiz: ["s5-q"], checks: [{ m: "s5", k: "module", p: true }] })).toBe("Допуск к залу: 2 из 4");
    expect(admitLine({ position: "waiter", quiz: ["s5-q", "s-er-q"], checks: [{ m: "s5", p: true, at: "1" }, { m: "s-er", p: true, at: "1" }] })).toBe("Допущен(а) к залу");
    expect(admitLine({ position: "bartender", quiz: [], checks: [] })).toBe("");
  });
  it("редактор вопросов: курсы и модули с числом вопросов; живая проверка открывается на сводке", () => {
    const ed = R(h(LiveCheckEditor, { T, a11y: false, profile: { id: "u-roman", is_admin: true }, onBack() {} }));
    expect(ed).toContain('data-lce="list"');
    expect((ed.match(/data-lce-track=/g) || []).length).toBe(6);
    expect((ed.match(/data-lce-mod=/g) || []).length).toBe(MODULES_INDEX.seasonal.length);
    expect(ed).toContain("8 вопросов");
    const lc = R(h(LiveCheckScreen, { T, a11y: false, profile: { id: "u-maria", name: "Мария", position: "manager", restaurant: R0 }, onBack() {}, startTab: "sum" }));
    expect(lc).toContain('data-lc="sum"');
    const self = R(h(LiveCheckScreen, { T, a11y: false, profile: { id: "e-anna", name: "Анна", position: "waiter", restaurant: R0 }, onBack() {}, startEmp: "e-anna", startTab: "sum" }));
    expect(self).toContain('data-lc="person"');   // свои проверки — всегда человек, не сводка
  });
});

describe("v202 · где и как это встроено", () => {
  const app = rd("App.jsx");
  it("App: ссылка lc_sum — сводка; «Вопросы живой проверки»; «Повтори вслух» в «Работе над ошибками»; допуск у новичка", () => {
    expect(app).toContain('|| v === "lc_sum" || v === "lc" || v === "lc_me" || v === "qday" || v === "remind");');
    expect(app).toContain('else if (g === "lc_sum") { setLcEmp(null); setLcTab("sum"); navigate("liveCheck"); }');
    expect(app).toContain('const LiveCheckEditor = lazyOf(() => import("./ui/live-check-editor"), "LiveCheckEditor");');
    expect(app).toContain('{screen === "lcEditor" && profile && ');
    expect(app).toContain('startTab={lcTab} uk={ukP} onEditQuestions={lcEditQ ? () => navigate("lcEditor") : null} onPractice={() => navigate("mistakes")}');
    expect(app).toContain('onLiveQuestions={profile ? () => navigate("lcEditor") : null}');
    expect(app).toContain('live={profile ? <Suspense fallback={null}><LivePractice T={T} a11y={a11y} profile={profile} uk={ukP} onFixed={() => { touchStreak(); logActivity("fix"); }} /></Suspense> : null}');
    expect(app).toContain("onLiveCheck={() => openLiveCheck(true)}");
    expect(app).toContain("api.saveMine(ukP, r.checks);");
    expect(app).toContain('const lcEditQ = !!profile?.is_admin || profile?.position === "senior";');
  });
  it("брифинг: блок в списке и страницы в «Провести»; в «Отправить команде» его нет", () => {
    const b = rd("ui/briefing.jsx");
    expect(b).toContain('import { useBriefLc, BriefLcBlock, BriefLcPage } from "./brief-live-check";');
    expect(b).toContain("const lc = useBriefLc({ profile, sched: src.sched });");
    expect(b).toContain("<BriefLcBlock lc={lc} c={c} a11y={a11y} />");
    expect(b).toContain("const pages = [...BRIEF_ORDER.filter((k) => briefShown(brief, k)), ...(extra || []).map((x) => x.key)];");
    const pub = b.slice(b.indexOf("const publish = () => {"), b.indexOf("const empty = {"));
    expect(pub).not.toMatch(/\blc\b/);
    expect(rd("ui/brief-live-check.jsx")).toContain('module: "brief", items: [{ k: it.q.k, g, o }], kind: "brief"');
  });
  it("живая проверка: просьбы первыми, меню, «Неудачный вопрос?», допуск, план и сверка; без этапа 65 — без них", () => {
    const s = rd("ui/live-check.jsx");
    const list = s.slice(s.indexOf('{view === "list" ? (<>'));
    expect(list.indexOf("data-lc-requests")).toBeLessThan(list.indexOf("data-lc-today"));
    for (const t of ["data-lc-menu-start", "data-lc-flag-q", "data-lc-admit", "data-lc-ask=", "data-lc-plan-day", "data-lc-calib", "data-lc-flags-open", "data-lc-practice-open"]) expect(s, t).toContain(t);
    expect(s).toContain('const no65 = lq.stage === false || reqs.code === "stage65";');
    expect(s).toContain("const bank = React.useMemo(() => mergeBank(LIVE_CHECK, lq.rows), [lq.rows]);");
    expect(s).not.toMatch(/LIVE_CHECK\[/);   // вопросы — с правками руководства
  });
  it("редактор контента: вход «Вопросы живой проверки»; ассистент — режим live", () => {
    expect(rd("ui/content-editor.jsx")).toContain('export function ContentEditorScreen({ T, a11y, onBack, onLiveQuestions = null }) {');
    expect(rd("api/lesson-assist.js")).toContain('if (mode === "live") return liveAssist(res, key, req.body || {});');
    expect(sanitize("live", { questions: [{ q: "Что сказать гостю при встрече?", a: ["Поздороваться", "  ", "Представиться"] }, { q: "Коротко", a: ["1", "2"] }, { q: "Один пункт тут?", a: ["1"] }] }))
      .toEqual({ questions: [{ q: "Что сказать гостю при встрече?", a: ["Поздороваться", "Представиться"] }] });
    expect(sanitize("live", {})).toBe(null);
    const p = PROMPT.live("seasonal", "ТЕКСТ", "Аллергии и безопасность", ["Вопрос, который есть"]);
    for (const t of ["«Аллергии и безопасность»", "4 вопроса для живой проверки", "от 2 до 5 пунктов", "Ситуация:", "• Вопрос, который есть", '{"questions"', "ТЕКСТ"]) expect(p, t).toContain(t);
  });
  it("«Сервер» знает этап 65 и расписание; README, памятка инструментов, демо", () => {
    expect(STAGES.find((s) => s.n === "65")).toEqual({ n: "65", file: "supabase-stage65-live-check-shift.sql", what: "Живая проверка в смене: брифинг, просьбы, меню, свои вопросы, план, итог недели", fn: "live_check_requests" });
    expect(STAGES.map((s) => s.n).indexOf("65")).toBe(STAGES.map((s) => s.n).indexOf("64") + 1);
    expect(CRON_JOBS.find((j) => j.name === "sa-live-check")).toEqual({ name: "sa-live-check", what: "Живая проверка: пересдача и итог недели", n: "65" });
    expect(rd("supabase/README.md")).toContain("| 74 | `supabase-stage65-live-check-shift.sql` | **Живая проверка в смене** (v202)");
    const tr = rd("tools/claude/README.md");
    expect(tr).toContain("bash sql/test65.sh");
    expect(tr).toContain("e2e-v202.mjs");
    const boot = rd("tools/claude/demo-app/boot.js");
    expect(boot).toContain('noStage65: lsGet("__demo_no65") === "1",');
    expect(boot).toContain('keep.add("__demo_no65");');
  });
  it("этап 65: нужен этап 64, ничего не удаляет, семь функций с правами, итог недели раз в неделю, результат", () => {
    const sql = rd("supabase/supabase-stage65-live-check-shift.sql");
    expect(sql).toContain("«Давай все, кроме 10-го и 2-го»");
    expect(sql).toContain("raise exception 'Сначала этап 64 (supabase-stage64-live-check-plus.sql): нужна живая проверка по пунктам';");
    expect(sql).not.toMatch(/\bdrop (table|function|index)\b/i);
    for (const g of ["live_check_request(text, text, text, text, boolean)", "live_check_requests(text, text)", "live_check_flag(text, text, text, text, text)",
      "live_check_questions(text)", "live_check_question_save(text, text, text, text, text, jsonb, text, boolean)", "live_check_flag_done(text, text)", "live_check_plan_set(text, int)",
      "live_check_save(text, text, text, text, jsonb, text, jsonb, text, text, text, jsonb)", "live_check_summary(text, text, int)"]) expect(sql, g).toContain("grant execute on function " + g + " to anon, authenticated;");
    expect(sql).toContain("revoke all on function sa_lc_tick(timestamptz) from public, anon, authenticated;");
    expect(sql).toContain("revoke all on function _sa_lc_week_text(timestamptz, text) from public, anon, authenticated;");
    expect(sql).toContain("perform sa_tg_send(v_chat, _sa_lc_week_text(p_now, v_tz), 'Сводка', 'lc_sum');");
    expect(sql).toContain("if extract(isodow from v_loc) <> 1 or extract(hour from v_loc) < 10 or extract(hour from v_loc) >= 12 then continue; end if;");
    expect(sql).toContain("cron.schedule('sa-live-check', '*/30 * * * *', 'select public.sa_lc_tick()')");
    expect(sql).toContain("select 'живая проверка, этап 65: функций ' ||");
    for (const t of ["sa_live_check_requests", "sa_live_check_questions", "sa_live_check_flags", "sa_live_check_plan", "sa_live_check_digest"]) {
      expect(sql, t).toContain("create table if not exists " + t + " (");
      expect(sql, t).toContain("alter table " + t + " enable row level security;");
    }
    const t65 = rd("tools/claude/sql/test65.sh");
    expect((t65.match(/^chk "/gm) || []).length).toBe(36);
  });
  it("гид: брифинг, «Повтори вслух», живая проверка и редактор знают новое", async () => {
    const { GUIDE } = await import("../ui/guide.jsx");
    const all = GUIDE.flatMap((g) => g.items || []);
    const by = (k) => all.find((x) => x.key === k).text;
    expect(by("brief")).toContain("Блок «Проверка на брифинге»");
    expect(by("mistakes")).toContain("«Повтори вслух»");
    for (const t of ["«Готов к живой проверке»", "«Меню заведения»", "«Вопросы живой проверки»", "каждого раз в 30 дней", "итог недели", "«Аллергиям» и «ЧП»"]) expect(by("livecheck"), t).toContain(t);
    expect(by("editor")).toContain("«Вопросы живой проверки»");
  });
});
