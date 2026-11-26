// v201 (Доп. 526): живая проверка точнее и удобнее. Владелец (26.11) на десять предложений: «Да, давай сделаем все».
//   1. data/live-check.js — по восемь вопросов на модуль (464), у каждого постоянный номер n;
//   2. lib/live-check.js — четыре вопроса из восьми, не недавние, ситуация последней; блиц из пройденного; процент по
//      пунктам; пометки «тест сдал, вживую нет», «пора повторить», «пересдача»; «Сегодня» по графику;
//      lib/live-check-api.js — сохранение по пунктам, очередь без сети, прежний вызов без этапа 64, сводка;
//   3. сервер — этап 64 (supabase/supabase-stage64-live-check-plus.sql, проверка tools/claude/sql/test64.sh);
//   4. ui/live-check.jsx — вопрос на экране, ответ по касанию, пункты галочками, блиц, «Сегодня», «Сводка»;
//      ui/live-check-summary.jsx — пометки в отчёте и карточка «Итог живой проверки» на «Смене»; App — ссылки lc и lc_me.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v201.mjs.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { LIVE_CHECK } from "../data/live-check.js";
import { MODULES_INDEX } from "../data/modules-index.js";
import { LC_PICK, LC_BLITZ, qKey, isSituation, pointsScore, marksOf, recentKeys, pickQuestions, blitzPick, repeatFromItems, quizOf,
  moduleFlags, suggestFor, suggestText, onShiftToday, lcErr64 } from "../lib/live-check.js";
import { lcSave, lcFlush, lcQueued, lcSummary, LC_QUEUE_KEY, newCid } from "../lib/live-check-api.js";
import { _resetOrg } from "../lib/org.js";
import { LiveCheckScreen } from "../ui/live-check.jsx";
import { LiveCheckSummary, LiveResultCard, freshResult } from "../ui/live-check-summary.jsx";
import { STAGES, CRON_JOBS } from "../lib/server-check.js";
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
let now = Date.UTC(2026, 10, 26, 2, 0);
const SCORES = [
  { id: 1, name: "Анна", surname: "Смирнова", restaurant: R0, quiz_id: "s0-q", score: 11, total: 12 },
  { id: 2, name: "Анна", surname: "Смирнова", restaurant: R0, quiz_id: "s0-q", score: 8, total: 12 },
  { id: 3, name: "Анна", surname: "Смирнова", restaurant: R0, quiz_id: "s1-q", score: 7, total: 10 },
];
const mk = (x = {}) => makeServer({ today: "2026-11-26", rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, scores: SCORES,
  progress: { "e-anna": ["s0-1", "s0-2", "s0-3", "s0-4"] }, quizzes: { "e-anna": ["s0-q", "s1-q"] }, clock: () => now, ...x });
const realFetch = globalThis.fetch, realLS = globalThis.localStorage, realSS = globalThis.sessionStorage;
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; };
let calls = [];
const useServer = (srv) => { calls = []; globalThis.fetch = async (u, init = {}) => { const fn = String(u).split("/rpc/")[1]; const b = JSON.parse(init.body || "{}"); calls.push({ fn, b }); return { ok: true, status: 200, json: async () => srv.rpc(fn, b) }; }; };
const offline = () => { globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); }; };
const login = (tok) => globalThis.localStorage.setItem("sa_session_token", tok);
const phone = () => { globalThis.localStorage = mem(); globalThis.sessionStorage = mem(); _resetOrg(); };
const leave = () => { globalThis.fetch = realFetch; globalThis.localStorage = realLS; globalThis.sessionStorage = realSS; _resetOrg(); };
const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, a11y: false };
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const MODS = Object.values(MODULES_INDEX).flat();
const mod = (id) => MODS.find((m) => m.id === id);

describe("v201 · версия и журнал", () => {
  it("сборка v201, Дополнение 526 со словами владельца и решениями, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(201);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 526 — .*\(v201\)/);
    const part = c.slice(c.indexOf("# Дополнение 526"));
    expect(part).toContain("«Да, давай сделаем все»");
    for (const w of ["supabase/supabase-stage64-live-check-plus.sql", "tools/claude/sql/test64.sh (27 проверок)", "464", "Блиц", "Сводка", "Сегодня"]) expect(part, w).toContain(w);
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v201 · вопросы: по восемь на модуль, у каждого постоянный номер", () => {
  it("58 модулей × 8 = 464; номера 1–8 по порядку; первые четыре — вопросы v200 на своих местах", () => {
    const all = Object.entries(LIVE_CHECK);
    expect(all.length).toBe(58);
    expect(all.flatMap(([, qs]) => qs).length).toBe(464);
    for (const [m, qs] of all) expect(qs.map((q) => q.n), m).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(LIVE_CHECK.s0[1]).toMatchObject({ n: 2, l: "s0-3", q: "Что такое стоп-лист и откуда ты о нём узнаёшь?" });
    expect(LIVE_CHECK.s0[4]).toMatchObject({ n: 5, l: "s0-1", q: "Каков твой минимальный стандарт у стола в первые дни?" });
  });
  it("у каждого модуля есть ситуация, последний вопрос — ситуация", () => {
    for (const [m, qs] of Object.entries(LIVE_CHECK)) { expect(qs.some(isSituation), m).toBe(true); expect(isSituation(qs[7]), m).toBe(true); }
  });
  it("в шапке файла — правило номеров: не перенумеровывать", () => {
    expect(rd("data/live-check.js")).toContain("старый не перенумеровывать");
  });
});

describe("v201 · какие вопросы задать (lib/live-check.js)", () => {
  it("ключ вопроса — «модуль#номер»", () => {
    expect(qKey("s0", { n: 5 })).toBe("s0#5");
    expect([LC_PICK, LC_BLITZ]).toEqual([4, 3]);
  });
  it("четыре из восьми: разные уроки, ситуация одна и последняя, без недавних", () => {
    for (let seed = 1; seed < 40; seed++) {
      const qs = pickQuestions(LIVE_CHECK.s1, "s1", new Set(["s1#1", "s1#2", "s1#3"]), seeded(seed));
      expect(qs.length).toBe(4);
      expect(new Set(qs.map((q) => q.k)).size).toBe(4);
      expect(qs.filter(isSituation).length).toBe(1);
      expect(isSituation(qs[3])).toBe(true);
      expect(qs.some((q) => ["s1#1", "s1#2", "s1#3"].includes(q.k))).toBe(false);
      expect(qs.every((q) => q.m === "s1" && q.k === "s1#" + q.n)).toBe(true);
    }
  });
  it("все восемь недавно спрашивали — всё равно четыре; вторая проверка подряд — другие четыре", () => {
    const all = new Set(LIVE_CHECK.s0.map((q) => qKey("s0", q)));
    expect(pickQuestions(LIVE_CHECK.s0, "s0", all, seeded(3)).length).toBe(4);
    const first = pickQuestions(LIVE_CHECK.s0, "s0", new Set(), seeded(5));
    const second = pickQuestions(LIVE_CHECK.s0, "s0", new Set(first.map((q) => q.k)), seeded(6));
    expect(second.filter((q) => first.some((f) => f.k === q.k))).toEqual([]);
  });
  it("недавние ключи: из пунктов; у проверок до v201 — первые вопросы по числу отметок; старше 30 дней — нет", () => {
    const at = new Date(now).toISOString(), old = new Date(now - 40 * 864e5).toISOString();
    const k = recentKeys([{ m: "s0", at, it: [{ k: "s0#5" }, { k: "s0#7" }] }, { m: "s1", at, marks: [2, 1, 2] }, { m: "s2", at: old, it: [{ k: "s2#1" }] },
      { m: "blitz", at, marks: [2, 2] }], now);
    expect([...k].sort()).toEqual(["s0#5", "s0#7", "s1#1", "s1#2", "s1#3"]);
  });
  it("блиц: три вопроса из разных пройденных модулей, без повторов; модуль один — три вопроса из него", () => {
    const qs = blitzPick(LIVE_CHECK, ["s0", "s1", "c0", "nope"], new Set(), seeded(7));
    expect(qs.length).toBe(3);
    expect(new Set(qs.map((q) => q.m)).size).toBe(3);
    expect(qs.every((q) => ["s0", "s1", "c0"].includes(q.m) && q.k === q.m + "#" + q.n)).toBe(true);
    const one = blitzPick(LIVE_CHECK, ["s0"], new Set(), seeded(8));
    expect(one.length).toBe(3);
    expect(new Set(one.map((q) => q.k)).size).toBe(3);
    expect(blitzPick(LIVE_CHECK, [], new Set(), seeded(9))).toEqual([]);
  });
});

describe("v201 · итог по пунктам и пометки", () => {
  it("процент — названо из всех пунктов; зачтено от 75%; отметки для старых экранов", () => {
    const it4 = [{ k: "s0#1", g: 3, o: 3 }, { k: "s0#5", g: 1, o: 3 }, { k: "s0#6", g: 2, o: 3 }, { k: "s0#8", g: 3, o: 3 }];
    expect(pointsScore(it4)).toEqual({ score: 75, passed: true });
    expect(pointsScore([{ g: 1, o: 3 }, { g: 0, o: 2 }, { g: 1, o: 4 }])).toEqual({ score: 22, passed: false });
    expect([pointsScore([]), pointsScore([{ g: 4, o: 3 }]), pointsScore([{ g: 1, o: 0 }]), pointsScore(null)]).toEqual([null, null, null, null]);
    expect(marksOf(it4)).toEqual([2, 1, 1, 2]);
  });
  it("что повторить: уроки вопросов, где назвали не всё, без повторов", () => {
    const qs = [LIVE_CHECK.s0[1], LIVE_CHECK.s0[0], LIVE_CHECK.s0[2], LIVE_CHECK.s0[4]];   // s0-3, s0-3, s0-4, s0-1
    expect(repeatFromItems(qs, [[0], [0, 1, 2], [0, 1, 2], [0, 1]])).toEqual(["s0-3", "s0-1"]);
    expect(repeatFromItems(qs, [[0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1, 2, 3]])).toEqual([]);
  });
  it("пометки модуля: тест сдал — вживую нет; пересдача через три дня; пора повторить через месяц; прошёл — не проверяли", () => {
    const s0 = mod("s0"), at = (d) => new Date(now - d * 864e5).toISOString();
    expect(quizOf(s0)).toBe("s0-q");
    expect(moduleFlags(s0, { p: false, s: 50, at: at(1) }, { tests: { "s0-q": 92 }, now })).toMatchObject({ testPct: 92, gap: true, retake: false, recheck: false, ready: false });
    expect(moduleFlags(s0, { p: false, s: 50, at: at(4) }, { quiz: ["s0-q"], now })).toMatchObject({ gap: true, retake: true });
    expect(moduleFlags(s0, { p: false, s: 50, at: at(4) }, { tests: { "s0-q": 60 }, now })).toMatchObject({ gap: false, retake: true });
    expect(moduleFlags(s0, { p: true, s: 90, at: at(31) }, { now })).toMatchObject({ recheck: true });
    expect(moduleFlags(s0, null, { quiz: ["s0-q"], now })).toMatchObject({ ready: true, gap: false });
    expect(moduleFlags(s0, null, { now })).toMatchObject({ ready: false });
  });
  it("что предложить по человеку: пересдача важнее, потом «тест сдал», потом «прошёл в приложении»", () => {
    const anna = { position: "waiter", quiz: ["s0-q", "s1-q", "c0-q"], checks: [
      { m: "s1", t: "seasonal", s: 50, p: false, at: new Date(now - 5 * 864e5).toISOString() },
      { m: "blitz", k: "blitz", s: 40, p: false, at: new Date(now - 5 * 864e5).toISOString() }] };
    const s = suggestFor(anna, MODULES_INDEX, now);
    expect(s.top).toMatchObject({ kind: "retake", m: "s1", s: 50 });
    expect(s.ready.map((x) => x.m)).toEqual(["s0", "c0"]);
    expect(suggestText(s.top)).toBe("пересдача: «Мышление сервиса», 50%");
    expect(suggestText({ kind: "ready", title: "Психология первого дня" })).toBe("прошёл в приложении: «Психология первого дня»");
    expect(suggestText({ kind: "gap", title: "X" })).toBe("тест сдал, вживую нет: «X»");
    expect(suggestFor({ position: "waiter", quiz: [], checks: [] }, MODULES_INDEX, now).top).toBe(null);
  });
  it("кто сегодня на смене: строки графика «Фамилия Имя» и «Имя Фамилия», выездная смена — нет", () => {
    const sched = { ok: true, venues: [{ venue_key: "main", config: { shifts: [{ k: "У", from: 10, to: 18 }, { k: "К", from: 10, to: 22, extra: 1 }],
      staff: [{ id: 1, name: "Смирнова Анна" }, { id: 2, name: "Илья Белов" }, { id: 3, name: "Ким Мария" }] } }],
      months: [{ venue_key: "main", payload: { plan: { 1: { 26: "У" }, 2: { 26: "К" }, 3: { 25: "У" } } } }] };
    const on = onShiftToday(sched, PEOPLE, new Date(2026, 10, 26, 12));
    expect([...on]).toEqual(["e-anna"]);
    expect([...onShiftToday(null, PEOPLE)]).toEqual([]);
  });
  it("тексты этапа 64", () => {
    expect(lcErr64("stage64", true)).toBe("Блиц и сводка заработают после этапа базы 64: подскажет экран «Сервер».");
    expect(lcErr64("stage64")).toBe("Это появится, когда владелец обновит сервер.");
    expect(lcErr64("forbidden")).toContain("Проверяют руководители");
  });
});

describe("v201 · сервер демо: этап 64 по тем же правилам", () => {
  const items = [{ k: "s0#1", g: 3, o: 3 }, { k: "s0#5", g: 1, o: 3 }, { k: "s0#6", g: 2, o: 3 }, { k: "s0#8", g: 3, o: 3 }];
  const save = (s, x) => s.rpc("live_check_save", { p_token: "tm", p_emp: "e-anna", p_track: "seasonal", p_module: "s0", p_items: items, p_kind: "module", ...x });
  it("по пунктам: 75%, отметки для старых экранов; чужой модуль, названо больше, повтор вопроса — bad_request", () => {
    const s = mk();
    expect(save(s)).toMatchObject({ ok: true, score: 75, passed: true, sent: true });
    expect(s.S.lc.checks[0]).toMatchObject({ marks: [2, 1, 1, 2], kind: "module" });
    expect([save(s, { p_items: [{ k: "s1#1", g: 1, o: 1 }] }).error, save(s, { p_items: [{ k: "s0#1", g: 4, o: 3 }] }).error,
      save(s, { p_items: [{ k: "s0#1", g: 1, o: 1 }, { k: "s0#1", g: 1, o: 1 }] }).error]).toEqual(["bad_request", "bad_request", "bad_request"]);
  });
  it("блиц только с модулем «blitz»; cid — повтор не задваивает", () => {
    const s = mk(), bl = [{ k: "s0#2", g: 2, o: 3 }, { k: "s1#4", g: 3, o: 3 }, { k: "c0#7", g: 3, o: 3 }];
    expect(save(s, { p_module: "blitz", p_kind: "blitz", p_items: bl })).toMatchObject({ ok: true, score: 89 });
    expect(save(s, { p_module: "s0", p_kind: "blitz", p_items: bl }).error).toBe("bad_request");
    const a = save(s, { p_cid: "tel-abc123" }), b = save(s, { p_cid: "tel-abc123", p_items: [{ k: "s0#1", g: 0, o: 3 }] });
    expect([b.id, b.dup, b.score]).toEqual([a.id, true, 75]);
  });
  it("итог человеку: процент, что повторить, кнопка урока; без уроков — «Мои проверки»", () => {
    const s = mk();
    save(s, { p_title: "Психология первого дня", p_repeat: [{ l: "s0-4", t: "Shadow и первые шаги" }] });
    save(s, { p_module: "blitz", p_kind: "blitz", p_items: [{ k: "s6#1", g: 2, o: 2 }] });
    expect(s.S.lc.sent.map((x) => [x.emp, x.text, x.go])).toEqual([
      ["e-anna", "Живая проверка «Психология первого дня»: 75%, зачтено.\nПовторить: «Shadow и первые шаги».", "lesson_s0-4"],
      ["e-anna", "Живая проверка, блиц: 100%, зачтено.", "lc_me"]]);
  });
  it("человек: лучшие тесты в приложении, у итогов вид, пункты, название, уроки; список — пройденные тесты", () => {
    const s = mk();
    save(s, { p_title: "Психология первого дня", p_repeat: [{ l: "s0-4", t: "Shadow" }] });
    const p = s.rpc("live_check_person", { p_token: "tm", p_emp: "e-anna" });
    expect(p.tests).toEqual({ "s0-q": 92, "s1-q": 70 });
    expect(p.checks[0]).toMatchObject({ k: "module", ti: "Психология первого дня", rp: [{ l: "s0-4", t: "Shadow" }], it: items });
    const anna = s.rpc("live_check_people", { p_token: "tm" }).people.find((x) => x.id === "e-anna");
    expect(anna.quiz).toEqual(["s0-q", "s1-q"]);
    expect(anna.checks[0]).toMatchObject({ m: "s0", k: "module", s: 75 });
  });
  it("сводка: менеджер — своё заведение, сеть — всё или одно, официант — нельзя; слабые модули и вопросы", () => {
    const s = mk();
    save(s); save(s, { p_items: [{ k: "s0#5", g: 0, o: 3 }] }); save(s, { p_items: [{ k: "s0#5", g: 1, o: 3 }] });
    s.rpc("live_check_save", { p_token: "tr", p_emp: "e-igor", p_track: "seasonal", p_module: "s0", p_items: [{ k: "s0#2", g: 1, o: 3 }], p_kind: "module" });
    const m = s.rpc("live_check_summary", { p_token: "tm" });
    expect(m).toMatchObject({ ok: true, restaurant: R0, totals: { checks: 3, blitz: 0, people: 1, passed: 1 } });
    expect(m.venues.map((v) => [v.name, v.checks, v.checkers.map((c) => c.name + ":" + c.n).join()])).toEqual([[R0, 3, "Мария Ким:3"]]);
    expect(m.modules).toEqual([{ t: "seasonal", m: "s0", n: 3, avg: 36, failed: 2 }]);   // 75, 0, 33
    expect(m.questions).toEqual([{ k: "s0#5", n: 3, pct: 22 }]);
    const all = s.rpc("live_check_summary", { p_token: "tr" });
    expect([all.restaurant, all.totals.checks, all.venues.map((v) => v.name)]).toEqual([null, 4, [R0, PORT]]);
    expect(s.rpc("live_check_summary", { p_token: "tr", p_restaurant: PORT }).totals.checks).toBe(1);
    expect(s.rpc("live_check_summary", { p_token: "ta" }).error).toBe("forbidden");
  });
  it("без этапа 64: новый вызов сохранения и сводка — как отсутствующие функции; прежний вызов работает", () => {
    const s = mk({ noStage64: true });
    expect(save(s).code).toBe("PGRST202");
    expect(s.rpc("live_check_summary", { p_token: "tm" }).code).toBe("PGRST202");
    expect(s.rpc("live_check_save", { p_token: "tm", p_emp: "e-anna", p_track: "seasonal", p_module: "s0", p_marks: [2, 1, 1, 2] })).toMatchObject({ ok: true, score: 75 });
  });
});

describe("v201 · запросы с телефона (lib/live-check-api.js)", () => {
  beforeEach(phone);
  afterEach(leave);
  const items = [{ k: "s0#1", g: 3, o: 3 }, { k: "s0#5", g: 1, o: 3 }];
  it("сохранить по пунктам: пункты, вид, номер, название, уроки и отметки уходят на сервер", async () => {
    useServer(mk()); login("tm");
    const r = await lcSave({ emp: "e-anna", track: "seasonal", module: "s0", items, kind: "module", cid: "lc-test-1", title: "Психология первого дня", repeat: [{ l: "s0-4", t: "Shadow" }] });
    expect(r).toMatchObject({ ok: true, score: 67, passed: false });
    expect(calls[0].b).toEqual({ p_token: "tm", p_emp: "e-anna", p_track: "seasonal", p_module: "s0", p_items: items, p_note: null, p_kind: "module", p_cid: "lc-test-1",
      p_title: "Психология первого дня", p_repeat: [{ l: "s0-4", t: "Shadow" }], p_marks: [2, 1] });
    expect(newCid()).toMatch(/^lc[a-z0-9]{8,}$/);
  });
  it("сервер без этапа 64: проверка модуля уходит прежним вызовом (отметки), блиц — stage64", async () => {
    useServer(mk({ noStage64: true })); login("tm");
    expect(await lcSave({ emp: "e-anna", track: "seasonal", module: "s0", items })).toMatchObject({ ok: true, score: 75, old: true });
    expect(calls.map((c) => c.fn)).toEqual(["live_check_save", "live_check_save"]);
    expect(calls[1].b).toEqual({ p_token: "tm", p_emp: "e-anna", p_track: "seasonal", p_module: "s0", p_marks: [2, 1], p_note: null });
    expect(await lcSave({ emp: "e-anna", track: "seasonal", module: "blitz", kind: "blitz", items: [{ k: "s0#2", g: 1, o: 1 }] })).toEqual({ ok: false, error: "stage64" });
    expect(await lcSummary()).toEqual({ ok: false, error: "stage64" });
  });
  it("без сети: проверка ждёт на телефоне с номером, итог считается на месте; связь вернулась — ушла один раз", async () => {
    const srv = mk(); login("tm"); offline();
    const r = await lcSave({ emp: "e-anna", track: "seasonal", module: "s0", items, cid: "lc-off-1" });
    expect(r).toEqual({ ok: true, queued: true, id: null, score: 67, passed: false });
    expect(lcQueued()).toBe(1);
    expect(JSON.parse(globalThis.localStorage.getItem(LC_QUEUE_KEY))[0]).toMatchObject({ cid: "lc-off-1", tok: "tm" });
    expect(await lcFlush()).toBe(0);                 // связи всё ещё нет — ждёт
    expect(lcQueued()).toBe(1);
    useServer(srv);
    expect(await lcFlush()).toBe(1);
    expect(lcQueued()).toBe(0);
    expect(srv.S.lc.checks.map((k) => [k.cid, k.s])).toEqual([["lc-off-1", 67]]);
    expect(await lcFlush()).toBe(0);
  });
  it("сводка: выбранное сетью заведение уходит на сервер", async () => {
    useServer(mk()); login("tr");
    expect((await lcSummary(PORT)).restaurant).toBe(PORT);
    expect(calls[0].b).toEqual({ p_token: "tr", p_restaurant: PORT, p_days: 30 });
  });
});

describe("v201 · экраны", () => {
  beforeEach(phone);
  afterEach(leave);
  it("«Живая проверка»: подсказка про четыре вопроса и пункты; из отчёта — сразу человек", () => {
    const html = R(h(LiveCheckScreen, { T, a11y: false, profile: PEOPLE[1], onBack: () => {} }));
    expect(html).toContain('data-lc="list"');
    expect(html).toContain("ты отмечаешь, что он назвал сам");
    expect(R(h(LiveCheckScreen, { T, a11y: true, profile: PEOPLE[1], onBack: () => {}, startEmp: "e-anna" }))).toContain('data-lc="person"');
  });
  it("отчёт: «тест в приложении 92%» у незачтённого, последний блиц", () => {
    const at = new Date(now - 864e5).toISOString();
    const html = R(h(LiveCheckSummary, { data: { ok: true, can: false, quiz: ["s0-q"], tests: { "s0-q": 92 }, checks: [
      { id: 3, t: "seasonal", m: "blitz", k: "blitz", s: 67, p: false, by: "Мария Ким", at },
      { id: 2, t: "seasonal", m: "s0", k: "module", s: 50, p: false, by: "Мария Ким", at }] } }));
    expect(html).toContain('data-rp-live-flag="gap"');
    expect(html).toContain("тест в приложении 92%");
    expect(html).toContain('data-rp-live-blitz="67"');
    expect(html).toContain('data-rp-live="1"');
  });
  it("итог себе: новый за 14 дней и не просмотренный; карточка — процент, что повторить, «Открыть урок»", () => {
    const at = (d) => new Date(Date.now() - d * 864e5).toISOString();
    const checks = [{ id: 5, m: "s0", t: "seasonal", s: 75, p: true, at: at(1), by: "Мария Ким", ti: "Психология первого дня", rp: [{ l: "s0-4", t: "Shadow и первые шаги" }] },
      { id: 4, m: "s1", t: "seasonal", s: 50, p: false, at: at(2) }, { id: 9, m: "s2", t: "seasonal", s: 90, p: true, at: at(20) }];
    expect(freshResult(checks, 0).id).toBe(5);
    expect(freshResult(checks, 5)).toBe(null);
    expect(freshResult(checks, 4).id).toBe(5);
    const html = R(h(LiveResultCard, { a11y: false, check: checks[0], onLesson: () => {}, onOpen: () => {}, onHide: () => {} }));
    expect(html).toContain("«Психология первого дня»: <b");
    expect(html).toContain("75%</b>, зачтено");
    expect(html).toContain("Повторить: «Shadow и первые шаги»");
    expect(html).toContain('data-lc-mine-lesson="s0-4"');
    expect(html).toContain("Мои проверки");
  });
});

describe("v201 · где и как это встроено", () => {
  const app = rd("App.jsx"), scr = rd("ui/live-check.jsx"), sql = rd("supabase/supabase-stage64-live-check-plus.sql");
  it("App: ссылки lc и lc_me, карточка итога на «Смене», «Мои проверки»", () => {
    expect(app).toContain('|| v === "lc" || v === "lc_me" || v === "qday" || v === "remind");');
    expect(app).toContain('else if (g === "lc" || g === "lc_me") openLiveCheck(g === "lc_me");');
    expect(app).toContain('const LiveResultCard = lazyOf(() => import("./ui/live-check-summary"), "LiveResultCard");');
    expect(app).toContain('{lcMine ? <Suspense fallback={null}><LiveResultCard a11y={a11y} check={lcMine} onHide={lcMineSeen}');
    expect(app).toContain('if (screen !== "shift" || !profile || !storageLoaded || Date.now() - lcMineAt.current < 10 * 60 * 1000) return undefined;');
  });
  it("экран: ответ по касанию, пункты, «Назвал всё», блиц, «Сегодня», пересдача, «Сводка», очередь без сети", () => {
    for (const s of ["Показать, что должно прозвучать", "Назвал всё", 'data-lc-pt={i + ":" + j}', "Блиц на 2 минуты", "Сегодня на смене", "Пересдача",
      "Вопросы, на которых чаще молчат", "Ждут связи: ", 'window.addEventListener("online", go);', "lcSchedule(list.restaurant)"]) expect(scr, s).toContain(s);
  });
  it("этап 64: нужен этап 63; поля; новый вызов; итог человеку; напоминание; сводка; права", () => {
    expect(sql).toContain("Сначала этап 63 (supabase-stage63-live-check.sql): нужна живая проверка");
    for (const col of ["kind text not null default 'module'", "items jsonb", "cid text", "title text", "repeat jsonb", "reminded_at timestamptz"]) expect(sql).toContain("add column if not exists " + col);
    expect(sql).toContain("drop function if exists live_check_save(text, text, text, text, jsonb, text);");
    expect(sql).toContain("perform sa_tg_send(v_chat, v_txt, 'Открыть урок', 'lesson_' || (v_rep->0->>'l'));");
    expect(sql).toContain("cron.schedule('sa-live-check', '*/30 * * * *', 'select public.sa_lc_tick()')");
    expect(sql).toContain("grant execute on function live_check_summary(text, text, int) to anon, authenticated;");
    expect(sql).toContain("revoke all on function sa_lc_tick(timestamptz) from public, anon, authenticated;");
  });
  it("«Сервер» знает этап 64 и расписание; README и памятка инструментов", () => {
    expect(STAGES.find((s) => s.n === "64")).toEqual({ n: "64", file: "supabase-stage64-live-check-plus.sql", what: "Живая проверка: по пунктам, блиц, итог сотруднику, пересдача, сводка", fn: "live_check_summary" });
    // v202 (Доп. 527): то же расписание с этапа 65 шлёт ещё итог недели
    expect(CRON_JOBS.find((j) => j.name === "sa-live-check")).toEqual({ name: "sa-live-check", what: "Живая проверка: пересдача и итог недели", n: "65" });
    expect(rd("supabase/README.md")).toContain("| 73 | `supabase-stage64-live-check-plus.sql` | **Живая проверка точнее и удобнее** (v201)");
    const tr = rd("tools/claude/README.md");
    expect(tr).toContain("bash sql/test64.sh");
    expect(tr).toContain("e2e-v201.mjs");
    expect(rd("tools/claude/demo-app/boot.js")).toContain('noStage64: lsGet("__demo_no64") === "1",');
  });
});
