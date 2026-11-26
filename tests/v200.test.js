// v200 (Доп. 525): живая проверка по урокам. Владелец (26.11): «Поможешь на основе уроков составить ряд вопросов для
// сотрудников, что бы понять и оценить то, читал ли человек инфу или же нет. Тестирование это хорошо, но живая проверка
// тоже важна». Решили: сразу в приложение, по всем курсам, чек-листом, три-четыре вопроса на модуль, «опираясь на
// градацию должностей»: «официанта проверяет менеджер, управляющий (если менеджер не может). Менеджера проверяет
// управляющий. И так далее по возрастанию».
//   1. data/live-check.js — вопросы: 58 модулей шести курсов, по четыре вопроса, у каждого урок и что должно прозвучать;
//   2. lib/live-check.js — ступени должностей, кто кого проверяет, процент и «зачтено» (те же правила у этапа 63 и демо),
//      расчёты экрана; lib/live-check-api.js — запросы и отметки «старше менеджера»;
//   3. сервер — этап 63 (supabase/supabase-stage63-live-check.sql, проверка tools/claude/sql/test63.sh);
//   4. ui/live-check.jsx — экран «Живая проверка»; ui/live-check-summary.jsx — раздел в отчёте по сотруднику;
//      «Заведения и должности» — отметка «старше менеджера»; сервер демо — этап 63 (__demo_no63).
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v200.mjs.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { LIVE_CHECK } from "../data/live-check.js";
import { MODULES_INDEX } from "../data/modules-index.js";
import { LC_PASS, LC_TRACKS, LC_MARKS, lcLevel, lcFamily, lcNet, lcCan, lcScore, tracksOf, lastByModule, moduleApp, trackSummary,
  lessonsToRepeat, lcDate, lcErr } from "../lib/live-check.js";
import { lcPeople, lcPerson, lcSave, lcDelete, loadLevels, setPositionUp, _resetLevels } from "../lib/live-check-api.js";
import { _resetOrg } from "../lib/org.js";
import { rpcMissing } from "../api/supabase";
import { LiveCheckScreen } from "../ui/live-check.jsx";
import { LiveCheckSummary } from "../ui/live-check-summary.jsx";
import { STAGES } from "../lib/server-check.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const R0 = "Два моря, Океан", PORT = "Порт";
const PEOPLE = [
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
  { id: "u-lena", name: "Елена", surname: "Сетевая", restaurant: PORT, position: "senior", is_admin: false },
  { id: "u-olga", name: "Ольга", surname: "Управляющая", restaurant: R0, position: "manager", is_admin: false, job_title: "pupravl00" },
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-timur", name: "Тимур", surname: "Ахметов", restaurant: R0, position: "senior_bartender", is_admin: false },
  { id: "e-ilya", name: "Илья", surname: "Белов", restaurant: R0, position: "bartender", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-igor", name: "Игорь", surname: "Портов", restaurant: PORT, position: "waiter", is_admin: false },
];
const P = Object.fromEntries(PEOPLE.map((p) => [p.id, { ...p, title: p.job_title || null }]));
const TOK = { tr: "u-roman", tl: "u-lena", to: "u-olga", tm: "u-maria", tt: "e-timur", ti: "e-ilya", ta: "e-anna", tg: "e-igor" };
let now = Date.UTC(2026, 10, 26, 9, 0);
const mk = (x = {}) => makeServer({ today: "2026-11-26", rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, scores: [],
  progress: { "e-anna": ["s0-1", "s0-2", "s0-3", "s0-4", "s1-1"] }, quizzes: { "e-anna": ["s0-q"] }, clock: () => now, ...x });

// телефон: localStorage и sessionStorage в памяти, запросы — в сервер демо
const realFetch = globalThis.fetch, realLS = globalThis.localStorage, realSS = globalThis.sessionStorage;
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; };
let calls = [];
const useServer = (srv) => { calls = []; globalThis.fetch = async (u, init = {}) => { const fn = String(u).split("/rpc/")[1]; const b = JSON.parse(init.body || "{}"); calls.push({ fn, b }); return { ok: true, status: 200, json: async () => srv.rpc(fn, b) }; }; };
const login = (tok) => globalThis.localStorage.setItem("sa_session_token", tok);
const phone = () => { globalThis.localStorage = mem(); globalThis.sessionStorage = mem(); _resetOrg(); _resetLevels(); };
const leave = () => { globalThis.fetch = realFetch; globalThis.localStorage = realLS; globalThis.sessionStorage = realSS; _resetOrg(); _resetLevels(); };
const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, a11y: false };
const TRACKS = ["seasonal", "core", "spg", "bar", "manager", "service_manager"];

describe("v200 · версия и журнал", () => {
  it("сборка v200, Дополнение 525 со словами владельца и решениями, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(200);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 525 — .*\(v200\)/);
    const part = c.slice(c.indexOf("# Дополнение 525"));
    expect(part).toContain("«Поможешь на основе уроков составить ряд вопросов для сотрудников, что бы понять и оценить то,");
    expect(part).toContain("Тестирование это хорошо, но живая проверка тоже важна»");
    expect(part).toContain("«официанта проверяет менеджер, управляющий (если менеджер не может). Менеджера проверяет управляющий.");
    expect(part).toContain("supabase/supabase-stage63-live-check.sql");
    expect(part).toContain("tools/claude/sql/test63.sh (33 проверки)");
    expect(part).toContain("232");
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v200 · вопросы (data/live-check.js)", () => {
  const mods = TRACKS.flatMap((t) => MODULES_INDEX[t].map((m) => ({ ...m, track: t })));
  it("все 58 модулей шести курсов, лишних нет; по четыре вопроса, всего 232", () => {
    expect(mods.length).toBe(58);
    expect(Object.keys(LIVE_CHECK).sort()).toEqual(mods.map((m) => m.id).sort());
    for (const m of mods) expect(LIVE_CHECK[m.id].length, m.id).toBe(4);
    expect(Object.values(LIVE_CHECK).flat().length).toBe(232);
  });
  it("каждый вопрос — по уроку своего модуля; вопрос и 2–4 пункта «что должно прозвучать»; без повторов", () => {
    for (const m of mods) {
      const ids = new Set(m.lessons.filter((l) => l.type === "lesson").map((l) => l.id));
      const qs = LIVE_CHECK[m.id];
      expect(new Set(qs.map((q) => q.q)).size, m.id).toBe(qs.length);
      for (const q of qs) {
        expect(ids.has(q.l), m.id + " · " + q.l).toBe(true);
        expect(q.q, m.id).toMatch(/^[А-ЯЁA-Z«].{10,}[?.]$/);
        expect(q.a.length, m.id + " · " + q.q).toBeGreaterThanOrEqual(2);
        expect(q.a.length, m.id + " · " + q.q).toBeLessThanOrEqual(4);
        for (const a of q.a) { expect(typeof a).toBe("string"); expect(a.trim().length, q.q).toBeGreaterThan(3); expect(a.length, a).toBeLessThanOrEqual(90); }
      }
    }
  });
  it("есть и ситуации «что сделаешь»: 41 вопрос, в 38 модулях последним", () => {
    const all = Object.values(LIVE_CHECK);
    expect(all.flat().filter((q) => /^Ситуация: /.test(q.q)).length).toBe(41);
    expect(all.filter((qs) => /^Ситуация: /.test(qs[qs.length - 1].q)).length).toBe(38);
  });
  it("примеры: «Психология первого дня» и «Психология менеджера»", () => {
    expect(LIVE_CHECK.s0.map((q) => q.l)).toEqual(["s0-3", "s0-3", "s0-4", "s0-1"]);
    expect(LIVE_CHECK.s0[1].q).toBe("Что такое стоп-лист и откуда ты о нём узнаёшь?");
    expect(LIVE_CHECK.s0[1].a).toContain("Узнаю на брифинге перед сменой");
    expect(LIVE_CHECK.m0.length).toBe(4);
  });
  it("без смайликов и длинных тире в тексте вопросов", () => {
    const txt = JSON.stringify(LIVE_CHECK);
    expect(txt).not.toMatch(/\p{Emoji_Presentation}|\p{Extended_Pictographic}️|[✦✧✨⚠❄]/u);
    expect(txt).not.toContain(" — ");
  });
});

describe("v200 · ступени и кто кого проверяет (lib/live-check.js)", () => {
  const UPS = ["pupravl00"];
  it("ступени: линейные 10, старший бармен 20, менеджер 30, «старше менеджера» 35, руководящий состав 50, владелец 60", () => {
    expect(["e-anna", "e-ilya", "e-timur", "u-maria", "u-olga", "u-lena", "u-roman"].map((id) => lcLevel(P[id], UPS))).toEqual([10, 10, 20, 30, 35, 50, 60]);
    expect(lcLevel(P["u-olga"], [])).toBe(30);                        // отметку сняли — на одной ступени с менеджером
    expect(lcLevel({ position: "hostess" })).toBe(10);
    expect(lcLevel({ position: "head" })).toBe(35);                    // прежняя «старшая» должность
    expect(lcLevel({ position: "manager", is_admin: true })).toBe(60);
    expect(lcLevel(null)).toBe(0);
  });
  it("линии и сеть", () => {
    expect(["bartender", "senior_bartender", "hostess", "waiter", "manager", ""].map(lcFamily)).toEqual(["bar", "bar", "host", "hall", "other", "other"]);
    expect([P["u-roman"], P["u-lena"], P["u-olga"], P["u-maria"]].map(lcNet)).toEqual([true, true, false, false]);
  });
  const can = (a, b, ups = UPS) => lcCan(P[a], P[b], ups);
  it("менеджер — всех ниже себя в своём заведении; другого менеджера, себя и другое заведение — нет", () => {
    expect(["e-anna", "e-ilya", "e-timur"].map((id) => can("u-maria", id))).toEqual([true, true, true]);
    expect([can("u-maria", "u-olga"), can("u-maria", "u-maria"), can("u-maria", "e-igor"), can("u-maria", "u-roman")]).toEqual([false, false, false, false]);
  });
  it("управляющий — и менеджеров; без отметки «старше» — как менеджер", () => {
    expect(can("u-olga", "u-maria")).toBe(true);
    expect(can("u-olga", "u-maria", [])).toBe(false);
    expect(can("u-olga", "e-igor")).toBe(false);                       // заведение не его
  });
  it("старший бармен — только барменов; официант и бармен — никого", () => {
    expect([can("e-timur", "e-ilya"), can("e-timur", "e-anna")]).toEqual([true, false]);
    expect([can("e-anna", "e-ilya"), can("e-ilya", "e-anna"), can("e-anna", "e-anna")]).toEqual([false, false, false]);
  });
  it("сеть — всех ниже себя в любом заведении; руководящий состав владельца — нет", () => {
    expect([can("u-roman", "u-maria"), can("u-roman", "e-igor"), can("u-roman", "u-lena")]).toEqual([true, true, true]);
    expect([can("u-lena", "e-anna"), can("u-lena", "u-olga"), can("u-lena", "u-roman")]).toEqual([true, true, false]);
  });
  it("уволенного не проверяют", () => {
    expect(lcCan(P["u-maria"], { ...P["e-anna"], status: "fired" })).toBe(false);
  });
});

describe("v200 · итог и расчёты экрана (lib/live-check.js)", () => {
  it("отметки: ответил 2, частично 1, не ответил 0; зачтено от 75%", () => {
    expect(LC_MARKS.map((m) => m.v + " " + m.label)).toEqual(["2 Ответил", "1 Частично", "0 Не ответил"]);
    expect(LC_PASS).toBe(75);
    expect(LC_TRACKS).toEqual(TRACKS);
    expect(lcScore([2, 2, 1, 2])).toEqual({ score: 88, passed: true });
    expect(lcScore([2, 1, 1, 2])).toEqual({ score: 75, passed: true });
    expect(lcScore([2, 1, 1, 1])).toEqual({ score: 63, passed: false });
    expect(lcScore([0, 0, 0, 0])).toEqual({ score: 0, passed: false });
    expect(lcScore([2, 1, 2])).toEqual({ score: 83, passed: true });
    expect([lcScore([]), lcScore([3]), lcScore([2, null]), lcScore(["2", "1"]), lcScore("2")]).toEqual([null, null, null, null, null]);   // как этап 63
  });
  it("курсы человека: официант — «Новичок» и «Ядро», остальные — свой", () => {
    expect(["waiter", "hostess", "bartender", "senior_bartender", "manager", "senior", "owner", ""].map((p) => tracksOf(p)))
      .toEqual([["seasonal", "core"], ["spg"], ["bar"], ["bar"], ["manager"], ["service_manager"], [], []]);
  });
  it("последняя проверка по модулю, итог курса, что повторить", () => {
    const ch = [{ m: "s0", s: 50, p: false, at: "2026-11-20T10:00:00Z" }, { m: "s0", s: 88, p: true, at: "2026-11-26T10:00:00Z" }, { m: "s1", s: 63, p: false, at: "2026-11-25T10:00:00Z" }];
    const last = lastByModule(ch);
    expect([last.s0.s, last.s1.s]).toEqual([88, 63]);
    expect(trackSummary(MODULES_INDEX.seasonal, last)).toEqual({ total: 14, checked: 2, passed: 1 });
    expect(lessonsToRepeat(LIVE_CHECK.s0, [2, 1, 0, 2])).toEqual(["s0-3", "s0-4"]);
    expect(lessonsToRepeat(LIVE_CHECK.s0, [1, 0, 2, 2])).toEqual(["s0-3"]);   // один урок — один раз
    expect(lessonsToRepeat(LIVE_CHECK.s0, [2, 2, 2, 2])).toEqual([]);
  });
  it("что пройдено в приложении: модуль пройден (все уроки или тест), начат, не начат", () => {
    const s0 = MODULES_INDEX.seasonal[0], s1 = MODULES_INDEX.seasonal[1];
    expect(moduleApp(s0, ["s0-1", "s0-2", "s0-3", "s0-4"], [])).toMatchObject({ lessons: 4, done: 4, quizDone: false, state: "done" });
    expect(moduleApp(s0, new Set(["s0-1"]), new Set(["s0-q"]))).toMatchObject({ done: 1, quizDone: true, state: "done" });
    expect(moduleApp(s1, ["s1-1", "s1-2"], [])).toMatchObject({ lessons: 4, done: 2, state: "part" });
    expect(moduleApp(s1, [], [])).toMatchObject({ done: 0, state: "none" });
  });
  it("дата и тексты ответов сервера", () => {
    expect(lcDate("2026-11-26T09:00:00Z")).toMatch(/^2[67]\.11$/);
    expect(lcDate("")).toBe("");
    expect(lcErr("stage", true)).toBe("Живая проверка заработает после этапа базы 63: подскажет экран «Сервер».");
    expect(lcErr("stage")).toBe("Живая проверка появится, когда владелец обновит сервер.");
    expect(lcErr("forbidden")).toBe("Проверяют руководители: менеджер свою команду, управляющий ещё и менеджеров, старший бармен барменов.");
    expect(lcErr("bad_request")).toBe("Отметь ответ на каждый вопрос.");
    expect(lcErr("not_found")).toBe("Этого сотрудника уже нет в списке. Обнови экран.");
    expect(lcErr("auth")).toBe("Вход устарел. Войди заново.");
    expect(lcErr("что-то")).toBe("Нет связи. Попробуй ещё раз.");
  });
});

describe("v200 · сервер демо: этап 63 по тем же правилам", () => {
  const ids = (r) => r.people.map((x) => x.id);
  it("кого проверить: менеджер — своих ниже себя, управляющая — и Марию, старший бармен — бармена, сеть — выбранное заведение", () => {
    const s = mk();
    expect(ids(s.rpc("live_check_people", { p_token: "tm" }))).toEqual(["e-timur", "e-anna", "e-ilya"]);
    expect(ids(s.rpc("live_check_people", { p_token: "to" }))).toEqual(["u-maria", "e-timur", "e-anna", "e-ilya"]);
    expect(ids(s.rpc("live_check_people", { p_token: "tt" }))).toEqual(["e-ilya"]);
    expect(ids(s.rpc("live_check_people", { p_token: "tr" }))).toEqual(["u-olga", "u-maria", "e-timur", "e-anna", "e-ilya"]);
    expect(ids(s.rpc("live_check_people", { p_token: "tr", p_restaurant: PORT }))).toEqual(["u-lena", "e-igor"]);
    expect(ids(s.rpc("live_check_people", { p_token: "tm", p_restaurant: PORT }))).toEqual(["e-timur", "e-anna", "e-ilya"]);   // не сеть — своё
    expect([s.rpc("live_check_people", { p_token: "ta" }).error, s.rpc("live_check_people", { p_token: "ti" }).error, s.rpc("live_check_people", { p_token: "x" }).error])
      .toEqual(["forbidden", "forbidden", "auth"]);
  });
  it("сохранить: процент и «зачтено»; чужого и неверное — нет; итог виден в списке", () => {
    const s = mk();
    const save = (tok, emp, marks, track = "seasonal", module = "s0") => s.rpc("live_check_save", { p_token: tok, p_emp: emp, p_track: track, p_module: module, p_marks: marks, p_note: "  ок " });
    expect(save("tm", "e-anna", [2, 2, 1, 2])).toMatchObject({ ok: true, score: 88, passed: true });
    expect(save("ta", "e-anna", [2, 2, 2, 2]).error).toBe("forbidden");                     // сама себя
    expect(save("tm", "u-olga", [2, 2, 2, 2]).error).toBe("forbidden");                     // старше
    expect(save("tm", "e-anna", [2, 3]).error).toBe("bad_request");
    expect(save("tm", "e-anna", [2, 2], "pizza").error).toBe("bad_request");
    expect(save("tm", "e-nobody", [2, 2]).error).toBe("not_found");
    const anna = s.rpc("live_check_people", { p_token: "tm" }).people.find((x) => x.id === "e-anna");
    expect(anna.checks).toEqual([expect.objectContaining({ m: "s0", t: "seasonal", s: 88, p: true, by: "Мария Ким" })]);
  });
  it("человек: что пройдено в приложении и все итоги; видят сам, тот, кто может проверять, и сеть", () => {
    const s = mk();
    s.rpc("live_check_save", { p_token: "tm", p_emp: "e-anna", p_track: "seasonal", p_module: "s0", p_marks: [2, 2, 2, 2], p_note: "ок" });
    const m = s.rpc("live_check_person", { p_token: "tm", p_emp: "e-anna" });
    expect(m).toMatchObject({ ok: true, can: true, person: { id: "e-anna", position: "waiter", level: 10 } });
    expect(m.lessons).toContain("s0-4");
    expect(m.quiz).toEqual(["s0-q"]);
    expect(m.checks).toEqual([expect.objectContaining({ m: "s0", s: 100, p: true, note: "ок", mine: true, marks: [2, 2, 2, 2] })]);
    expect(s.rpc("live_check_person", { p_token: "ta", p_emp: "" })).toMatchObject({ ok: true, can: false });   // сама: только посмотреть
    expect(s.rpc("live_check_person", { p_token: "tl", p_emp: "e-anna" })).toMatchObject({ ok: true, can: true });
    expect(s.rpc("live_check_person", { p_token: "ti", p_emp: "e-anna" }).error).toBe("forbidden");
    expect(s.rpc("live_check_person", { p_token: "tm", p_emp: "e-igor" }).error).toBe("forbidden");
  });
  it("убрать: своё — в течение суток, владелец — любое", () => {
    now = Date.UTC(2026, 10, 26, 9, 0);
    const s = mk();
    const id = s.rpc("live_check_save", { p_token: "tm", p_emp: "e-anna", p_track: "core", p_module: "c0", p_marks: [0, 0, 1, 0] }).id;
    expect(s.rpc("live_check_delete", { p_token: "to", p_id: id }).error).toBe("forbidden");
    expect(s.rpc("live_check_delete", { p_token: "tm", p_id: id }).ok).toBe(true);
    expect(s.rpc("live_check_delete", { p_token: "tm", p_id: id }).error).toBe("not_found");
    const id2 = s.rpc("live_check_save", { p_token: "tm", p_emp: "e-anna", p_track: "core", p_module: "c0", p_marks: [2, 2, 2, 2] }).id;
    now += 25 * 3600e3;
    expect(s.rpc("live_check_delete", { p_token: "tm", p_id: id2 }).error).toBe("forbidden");
    expect(s.rpc("live_check_delete", { p_token: "tr", p_id: id2 }).ok).toBe(true);
    now = Date.UTC(2026, 10, 26, 9, 0);
  });
  it("«старше менеджера»: «Управляющий» отмечен; снять и вернуть — только владелец; встроенную и не менеджерскую — нельзя", () => {
    const s = mk();
    expect(s.rpc("org_lists", { p_token: "tr" }).positions.find((x) => x.id === "pupravl00")).toMatchObject({ label: "Управляющий", base: "manager", builtin: false });
    expect(s.rpc("live_check_levels", { p_token: "to" })).toEqual({ ok: true, level: 35, ups: ["pupravl00"] });
    expect(s.rpc("org_position_level", { p_token: "tm", p_id: "pupravl00", p_up: false }).error).toBe("forbidden");
    expect(s.rpc("org_position_level", { p_token: "tr", p_id: "pupravl00", p_up: false })).toEqual({ ok: true, id: "pupravl00", up: false });
    expect(s.rpc("live_check_levels", { p_token: "to" })).toEqual({ ok: true, level: 30, ups: [] });
    expect(ids(s.rpc("live_check_people", { p_token: "to" }))).not.toContain("u-maria");
    expect([s.rpc("org_position_level", { p_token: "tr", p_id: "manager", p_up: true }).error, s.rpc("org_position_level", { p_token: "tr", p_id: "nope", p_up: true }).error])
      .toEqual(["builtin", "not_found"]);
  });
  it("без этапа 63 — как отсутствующие функции; «Управляющего» не добавляет", () => {
    const s = mk({ noStage63: true });
    for (const fn of ["live_check_people", "live_check_person", "live_check_save", "live_check_delete", "live_check_levels", "org_position_level"]) expect(rpcMissing(s.rpc(fn, { p_token: "tr" })), fn).toBe(true);
    expect(s.rpc("org_lists", { p_token: "tr" }).positions.some((x) => x.id === "pupravl00")).toBe(false);
  });
});

describe("v200 · запросы с телефона (lib/live-check-api.js)", () => {
  beforeEach(phone);
  afterEach(leave);
  it("список, человек, сохранить, убрать — с токеном; выбранное сетью заведение уходит на сервер", async () => {
    useServer(mk()); login("tr");
    expect((await lcPeople(PORT)).people.map((x) => x.id)).toEqual(["u-lena", "e-igor"]);
    expect(calls[0]).toEqual({ fn: "live_check_people", b: { p_token: "tr", p_restaurant: PORT } });
    expect((await lcPeople()).restaurant).toBe(R0);
    const r = await lcSave({ emp: "u-maria", track: "manager", module: "m0", marks: [2, 2, 2, 1] });
    expect(r).toMatchObject({ ok: true, score: 88, passed: true });
    expect(calls[2].b).toEqual({ p_token: "tr", p_emp: "u-maria", p_track: "manager", p_module: "m0", p_marks: [2, 2, 2, 1], p_note: null });
    expect((await lcPerson("u-maria")).checks.length).toBe(1);
    expect((await lcDelete(r.id)).ok).toBe(true);
  });
  it("нет этапа 63 — { ok: false, error: \"stage\" }; нет связи — net", async () => {
    useServer(mk({ noStage63: true })); login("tm");
    expect(await lcPeople()).toEqual({ ok: false, error: "stage" });
    globalThis.fetch = async () => { throw new Error("offline"); };
    expect((await lcPerson("e-anna")).ok).toBe(false);
  });
  it("ступени: «старше» с сервера; владелец снимает и ставит отметку, список обновляется сразу", async () => {
    useServer(mk()); login("tr");
    expect(await loadLevels()).toEqual({ stage: true, ups: ["pupravl00"], level: 60 });
    expect((await setPositionUp("pupravl00", false)).ok).toBe(true);
    expect((await loadLevels()).ups).toEqual([]);
    expect((await setPositionUp("pupravl00", true)).up).toBe(true);
    useServer(mk({ noStage63: true }));
    expect(await loadLevels()).toEqual({ stage: false, ups: [], level: 0 });
  });
});

describe("v200 · экраны", () => {
  beforeEach(phone);
  afterEach(leave);
  it("«Живая проверка»: сначала список (загрузка); из отчёта — сразу человек", () => {
    const html = R(h(LiveCheckScreen, { T, a11y: false, profile: P["u-maria"], onBack: () => {} }));
    expect(html).toContain('data-lc="list"');
    expect(html).toContain("Живая проверка");
    expect(html).toContain("Спроси по урокам вслух: по три-четыре вопроса на модуль.");
    expect(html).toContain("Загружаю, кого можно проверить…");
    const p = R(h(LiveCheckScreen, { T, a11y: true, profile: P["u-maria"], onBack: () => {}, startEmp: "e-anna" }));
    expect(p).toContain('data-lc="person"');
    expect(p).toContain("Загружаю…");
  });
  it("раздел в отчёте: последние итоги по модулям, «Проверить вживую» — если можно проверять", () => {
    expect(R(h(LiveCheckSummary, { data: null }))).toBe("");
    expect(R(h(LiveCheckSummary, { data: { ok: false } }))).toBe("");
    const empty = R(h(LiveCheckSummary, { data: { ok: true, can: true, checks: [] }, onCheck: () => {} }));
    expect(empty).toContain('data-rp-live="0"');
    expect(empty).toContain("Вживую по урокам ещё не проверяли.");
    expect(empty).toContain("Проверить вживую");
    const data = { ok: true, can: false, checks: [
      { id: 2, t: "seasonal", m: "s0", s: 88, p: true, by: "Мария Ким", at: "2026-11-26T09:00:00Z", note: "помнит стоп-лист" },
      { id: 1, t: "seasonal", m: "s0", s: 50, p: false, by: "Мария Ким", at: "2026-11-20T09:00:00Z" },
      { id: 3, t: "core", m: "c0", s: 63, p: false, by: "Роман", at: "2026-11-25T09:00:00Z" }] };
    const html = R(h(LiveCheckSummary, { data, onCheck: () => {} }));
    expect(html).toContain('data-rp-live="2"');
    expect(html).toContain("зачтено 1 из 2");
    expect(html).toContain("Психология первого дня · <span class=\"ok\">зачтено, 88%</span>");
    expect(html).toContain("Психология ядра · <span class=\"bad\">не зачтено, 63%</span>");
    expect(html).toContain("Мария Ким · помнит стоп-лист");
    expect(html.indexOf('data-rp-live-row="s0"')).toBeLessThan(html.indexOf('data-rp-live-row="c0"'));   // свежие выше
    expect(html).not.toContain("Проверить вживую");                                                       // can: false
  });
});

describe("v200 · где и как это встроено", () => {
  const app = rd("App.jsx"), rep = rd("ui/report.jsx"), org = rd("ui/org.jsx"), scr = rd("ui/live-check.jsx");
  it("App: экран отдельным куском, плитка в «Команде» (руководителям и старшему бармену), из отчёта — сразу человек", () => {
    expect(app).toContain('const LiveCheckScreen = lazyOf(() => import("./ui/live-check"), "LiveCheckScreen");');
    expect(app).toContain('(staff || profile?.position === "senior_bartender") && { key:"lc", group: staff ? "Управление" : "Команда", icon:"checklist", label:"Живая проверка"');
    expect(app).toContain('sub:"Вопросы по урокам вслух: читал человек или нет"');
    expect(app).toContain('{screen === "liveCheck" && profile && ');
    expect(app).toContain('startEmp={lcEmp}');
    expect(app).toContain('onLiveCheck={(id) => { setLcEmp(id); navigate("liveCheck"); }}');
    expect(app).toContain('onBack={() => goBack(lcEmp ? "report" : "teamHub")}');
    expect(app).toContain('startEmp={reportSelf ? null : lcEmp}');
    expect(app).toContain('useEffect(() => { if (screen !== "report" && screen !== "liveCheck") setLcEmp(null); }, [screen]);');
  });
  it("отчёт: раздел после «Навыков в зале»; вопросы в кусок отчёта не попадают", () => {
    expect(rep).toContain('<PersonView m={m} live={<LiveCheckSummary data={live} onCheck={onLiveCheck ? () => onLiveCheck(sel) : null} />} />');
    expect(rep).toContain("const [sel, setSel] = React.useState(startEmp || null);");
    const pv = rep.slice(rep.indexOf("function PersonView("));
    expect(pv.indexOf("{live}")).toBeGreaterThan(pv.indexOf("<h3>Навыки в зале"));
    expect(pv.indexOf("{live}")).toBeLessThan(pv.indexOf("<h3>Дни занятий"));
    expect(rep).not.toMatch(/from "\.\.\/data\/live-check"/);
    expect(rd("ui/live-check-summary.jsx")).not.toMatch(/from "\.\.\/data\/live-check"/);
    expect(scr).toContain('import { LIVE_CHECK } from "../data/live-check";');
  });
  it("«Гид по приложению»: «Живая проверка» руководителю, кнопка «Открыть» ведёт на экран", async () => {
    const { GUIDE } = await import("../ui/guide.jsx");
    const team = GUIDE.find((s) => s.tab === "Команда").items;
    const g = team.find((x) => x.key === "livecheck");
    expect(g).toMatchObject({ title: "Живая проверка", go: "liveCheck", staff: true });
    expect(team.indexOf(g)).toBe(team.findIndex((x) => x.key === "reports") + 1);
    expect(g.text).toContain("менеджер свою команду, управляющий ещё и менеджеров, старший бармен барменов");
  });
  it("«Заведения и должности»: «старше менеджера» — у своей должности «как менеджер», в строке и в правке", () => {
    expect(org).toContain('upOf(p) ? "старше менеджера" : ""');
    expect(org).toContain("Старше менеджера: в живой проверке проверяет и менеджеров");
    expect(org).toContain('const upOf = (p) => !!p && !p.builtin && p.base === "manager" && lv.ups.includes(p.id);');
  });
  it("экран: отметки по каждому вопросу, «Сохранить · N%», что повторить, «Убрать проверку», курсы по должности", () => {
    for (const s of ['data-lc-mark={i + ":" + mk.v}', '"Сохранить · " + preview.score + "%"', "Что должно прозвучать", "Что повторить", "Убрать проверку",
      "Другие курсы", "Следующий модуль", "Проверять этого сотрудника может руководитель ступенью выше. Здесь только итоги."]) expect(scr, s).toContain(s);
  });
});

describe("v200 · сервер: этап 63", () => {
  const sql = rd("supabase/supabase-stage63-live-check.sql");
  it("нужны этапы 21 и 61; таблицы закрыты; функции с токеном; итог в конце", () => {
    expect(sql).toContain("Сначала этап 21 (supabase-stage21-private-data.sql)");
    expect(sql).toContain("Сначала этап 61 (supabase-stage61-places.sql): нужен список должностей");
    for (const t of ["sa_position_levels", "sa_live_checks"]) {
      expect(sql).toContain("create table if not exists " + t);
      expect(sql).toContain("alter table " + t + " enable row level security;");
      expect(sql).toContain("revoke all on table " + t + " from public, anon, authenticated;");
    }
    for (const f of ["live_check_people(p_token text, p_restaurant text default null)", "live_check_person(p_token text, p_emp text)",
      "live_check_save(p_token text, p_emp text, p_track text, p_module text, p_marks jsonb, p_note text default null)", "live_check_delete(p_token text, p_id bigint)",
      "live_check_levels(p_token text)", "org_position_level(p_token text, p_id text, p_up boolean)"]) expect(sql, f).toContain("create or replace function " + f);
    expect(sql).toContain("notify pgrst, 'reload schema';");
    expect(sql).toContain("живая проверка: функций");
  });
  it("«Управляющий»: своя должность «Управляющий» или «Управляющая», иначе новая «как менеджер»; отметка — один раз", () => {
    expect(sql).toContain("lower(btrim(label)) in ('управляющий', 'управляющая')");
    expect(sql).toContain("'pupravl00'");
    expect(sql).toContain("on conflict (id) do nothing");
  });
  it("«Сервер» знает этап 63, README — строка 72, проверки — в памятке инструментов", () => {
    expect(STAGES.find((s) => s.n === "63")).toEqual({ n: "63", file: "supabase-stage63-live-check.sql", what: "Живая проверка: вопросы по урокам вслух, кто кого проверяет по должности", fn: "live_check_people" });
    expect(rd("supabase/README.md")).toContain("| 72 | `supabase-stage63-live-check.sql` | **Живая проверка** (v200)");
    const tr = rd("tools/claude/README.md");
    expect(tr).toContain("bash sql/test63.sh");
    expect(tr).toContain("e2e-v200.mjs");
    expect(rd("tools/claude/sql/test63.sh")).toContain("supabase-stage63-live-check.sql");
    expect(rd("tools/claude/demo-app/boot.js")).toContain('noStage63: lsGet("__demo_no63") === "1",');
  });
});
