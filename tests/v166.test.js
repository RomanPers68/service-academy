// v166 (Доп. 491): «Бог сервиса» — все тесты всех шести треков на 100%. Владелец (15.11) спросил, учитывает ли ачивка
// «Бар» и «Хостес» (она появилась раньше них), и решил: «Да, должно быть у всех 6 ролей, так как чтобы быть богом
// сервиса, нужно знать всё». До v166 в счёт шли четыре ступени зала, а само условие считалось в двух местах
// по-разному и было мягче названия: всплывающему поздравлению хватало открытой четвёртой ступени, венку в рейтинге —
// по одному результату в каждой ступени. Теперь правило одно (lib/service-god.js) и строгое.
// Сервер не меняется. Разметки JSX в файле нет (Доп. 482). Вид в браузере — tools/claude/e2e-v166.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { GOD_TRACKS, GOD_QUIZ_IDS, godQuizIds, bestByQuiz, godProgress, isServiceGod } from "../lib/service-god";
import { MODULES_INDEX } from "../data/modules-index";
import { ROLES } from "../data/roles";

const rd = (p) => readFileSync(p, "utf8");
const row = (quiz_id, pct, extra = {}) => ({ name: "Вера", surname: "Соколова", quiz_id, pct, score: pct, total: 100, ...extra });
const quizzesOf = (track) => MODULES_INDEX[track].filter((m) => !m.info).flatMap((m) => m.lessons.filter((l) => l.type === "quiz").map((l) => l.id));
const HALL = ["seasonal", "core", "manager", "service_manager"];
const allPerfect = () => GOD_QUIZ_IDS.map((id) => row(id, 100));

describe("v166 · версия и журнал", () => {
  it("сборка v166, Дополнение 491, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(166);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 491 — .*\(v166\)/);
    const part = c.slice(c.indexOf("# Дополнение 491"));
    const flat = part.replace(/\s+/g, " ");
    expect(flat).toContain("должно быть у всех 6 ролей");
    expect(flat).toContain("нужно знать всё");
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v166.mjs");
  });
});

describe("v166 · какие тесты нужны (lib/service-god.js)", () => {
  it("шесть треков — все, что есть в приложении", () => {
    expect([...GOD_TRACKS].sort()).toEqual(["bar", "core", "manager", "seasonal", "service_manager", "spg"]);
    expect([...GOD_TRACKS].sort()).toEqual(ROLES.map((r) => r.id).sort());   // появится седьмой трек — тест напомнит решить, входит ли он
    expect([...GOD_TRACKS].sort()).toEqual(Object.keys(MODULES_INDEX).sort());
  });
  it("в счёт идут все тесты программы шести треков: и зал, и «Бар», и «Хостес»", () => {
    const want = GOD_TRACKS.flatMap(quizzesOf);
    expect(GOD_QUIZ_IDS).toEqual(want);
    expect(new Set(GOD_QUIZ_IDS).size).toBe(GOD_QUIZ_IDS.length);
    expect(GOD_QUIZ_IDS.length).toBeGreaterThanOrEqual(56);
    for (const t of GOD_TRACKS) expect([t, quizzesOf(t).length > 0, quizzesOf(t).every((id) => GOD_QUIZ_IDS.includes(id))]).toEqual([t, true, true]);
    for (const id of ["s0-q", "bar0-q"]) expect(GOD_QUIZ_IDS).toContain(id);
    expect(quizzesOf("spg").length).toBeGreaterThanOrEqual(11);
    expect(quizzesOf("bar").length).toBeGreaterThanOrEqual(7);
  });
  it("тесты тем «для ознакомления» не нужны: их результат в рейтинг не уходит", () => {
    const info = Object.values(MODULES_INDEX).flat().filter((m) => m.info).flatMap((m) => m.lessons.filter((l) => l.type === "quiz").map((l) => l.id));
    expect(info.length).toBeGreaterThanOrEqual(2);
    for (const id of info) expect(GOD_QUIZ_IDS).not.toContain(id);
  });
  it("свой список треков и своя программа — без падения на пустом", () => {
    const idx = { a: [{ id: "m1", lessons: [{ id: "a-1", type: "lesson" }, { id: "a-q", type: "quiz" }] }, { id: "m2", info: true, lessons: [{ id: "a2-q", type: "quiz" }] }], b: [{ id: "m3", lessons: [{ id: "b-q", type: "quiz" }] }] };
    expect(godQuizIds(idx, ["a", "b"])).toEqual(["a-q", "b-q"]);
    expect(godQuizIds(idx, ["a", "нет"])).toEqual(["a-q"]);
    expect(godQuizIds({}, ["a"])).toEqual([]);
    expect(godQuizIds(null, null)).toEqual([]);
  });
});

describe("v166 · заслужен ли венок", () => {
  it("все тесты шести треков на 100% — да", () => {
    expect(isServiceGod(allPerfect())).toBe(true);
    expect(godProgress(allPerfect())).toEqual({ total: GOD_QUIZ_IDS.length, perfect: GOD_QUIZ_IDS.length, left: [], weak: [] });
  });
  it("только четыре ступени зала на 100%, без «Бара» и «Хостес», — нет (раньше этого хватало)", () => {
    const hall = HALL.flatMap(quizzesOf).map((id) => row(id, 100));
    expect(isServiceGod(hall)).toBe(false);
    const p = godProgress(hall);
    expect(p.perfect).toBe(hall.length);
    expect(p.left).toEqual([...quizzesOf("spg"), ...quizzesOf("bar")]);
    expect(isServiceGod([...hall, ...quizzesOf("bar").map((id) => row(id, 100))])).toBe(false);   // без «Хостес»
    expect(isServiceGod([...hall, ...quizzesOf("spg").map((id) => row(id, 100))])).toBe(false);   // без «Бара»
    expect(isServiceGod([...hall, ...quizzesOf("spg").map((id) => row(id, 100)), ...quizzesOf("bar").map((id) => row(id, 100))])).toBe(true);
  });
  it("по одному результату в каждом треке — нет: нужны все тесты (раньше венку в рейтинге хватало)", () => {
    const one = GOD_TRACKS.map((t) => row(quizzesOf(t)[0], 100, { role: t }));
    expect(isServiceGod(one)).toBe(false);
    expect(godProgress(one).perfect).toBe(6);
  });
  it("один тест не сдан или сдан ниже 100% — нет; какой именно — видно", () => {
    const miss = allPerfect().filter((s) => s.quiz_id !== "bar0-q");
    expect(isServiceGod(miss)).toBe(false);
    expect(godProgress(miss).left).toEqual(["bar0-q"]);
    const low = allPerfect().map((s) => (s.quiz_id === "s0-q" ? row("s0-q", 92) : s));
    expect(isServiceGod(low)).toBe(false);
    expect(godProgress(low).left).toEqual(["s0-q"]);
    expect(isServiceGod(allPerfect().map((s) => (s.quiz_id === "s0-q" ? row("s0-q", 99.6) : s)))).toBe(false);
  });
  it("считается лучшая попытка: старые 92% не мешают, когда тест пересдан на 100%", () => {
    expect(isServiceGod([row("s0-q", 92), ...allPerfect()])).toBe(true);
    expect(isServiceGod([...allPerfect(), row("s0-q", 50), row("bar0-q", 0)])).toBe(true);
    expect(bestByQuiz([row("a", 50), row("a", 100), row("a", 80), row("b", 10)])).toEqual({ a: 100, b: 10 });
  });
  it("свой тест заведения ниже 100% — нет; на 100% или не сданный — не мешает", () => {
    expect(isServiceGod([...allPerfect(), row("cms-q-7", 80)])).toBe(false);
    expect(godProgress([...allPerfect(), row("cms-q-7", 80)]).weak).toEqual(["cms-q-7"]);
    expect(isServiceGod([...allPerfect(), row("cms-q-7", 80), row("cms-q-7", 100)])).toBe(true);
    expect(isServiceGod([...allPerfect(), row("cms-q-7", 100)])).toBe(true);
  });
  it("тест, которого в программе больше нет, и строки без номера теста или процента — не в счёт", () => {
    expect(isServiceGod([...allPerfect(), row("снятый-тест", 40)])).toBe(true);
    expect(isServiceGod([...allPerfect(), { name: "Вера", pct: 10 }, row("s1-q", "не число"), null, undefined])).toBe(true);
    expect(bestByQuiz([{ pct: 100 }, row("a", NaN), row("b", "100"), null])).toEqual({ b: 100 });
    expect(bestByQuiz(null)).toEqual({});
  });
  it("нет результатов, пустая программа — нет", () => {
    expect(isServiceGod([])).toBe(false);
    expect(isServiceGod(null)).toBe(false);
    expect(isServiceGod([row("x", 100)], [])).toBe(false);
    expect(godProgress(null, null)).toEqual({ total: 0, perfect: 0, left: [], weak: [] });
  });
});

describe("v166 · правило одно: поздравление и венок в рейтинге (App.jsx, ui/screens-gamification.jsx)", () => {
  it("поздравление: по правилу lib/service-god.js; результаты удалённых своих уроков не мешают", () => {
    const app = rd("App.jsx");
    expect(app).toContain('import { isServiceGod } from "./lib/service-god";');
    expect(app).toContain('if (isServiceGod(myScores.filter(s => !deadCms(s.quiz_id)))) achieved.push({ icon:"laurel", label:"Бог сервиса", key:"god" });');
    expect(app).not.toContain("allRolesDone");
    expect(app).not.toContain("allPerfect");
    const at = app.indexOf("const checkAndShowAchievements = useCallback(");
    expect(app.slice(at, app.indexOf("const completeLesson = useCallback(", at))).toContain("}, [profile, deadCms]);");
  });
  it("венок в рейтинге: то же правило по результатам человека", () => {
    const g = rd("ui/screens-gamification.jsx");
    expect(g).toContain('import { isServiceGod } from "../lib/service-god";');
    expect(g).toContain('if (isServiceGod(playerScores)) {\n      achievements.push({ icon:"laurel", label:"Бог сервиса" });');
    expect(g).not.toContain("allRolesCovered");
    expect(g).not.toContain("rolesWithScores");
  });
  it("в приложении условие «Бога сервиса» считается только в lib/service-god.js", () => {
    const hits = [];
    for (const dir of ["ui", "lib"]) for (const f of readdirSync(dir).filter((x) => /\.jsx?$/.test(x))) if (/every\(\(?s\)? => s\.pct === 100\)/.test(rd(dir + "/" + f))) hits.push(dir + "/" + f);
    expect(hits).toEqual([]);
    expect(/every\(\(?s\)? => s\.pct === 100\)/.test(rd("App.jsx"))).toBe(false);
  });
});
