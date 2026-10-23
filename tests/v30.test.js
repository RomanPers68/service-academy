// v30 (Доп. 311–320): свежесть тем, зачёт на опыт, золотая тема, квест смены, лига недели,
// живой гость, радио в дорогу, итоги месяца, копия телефонных данных v2, отчёт — живая практика.
import { describe, it, expect } from "vitest";
import { bumpActivity, readActivity, weekSummary, weekShareText, POINTS, DAY_CAP, pointsOf, weekPoints, weekStart } from "../lib/activity";
import { syncFresh, freshOf, touchFresh, updatedAfter, topicFreshness, fadedList, freshLabel, moduleDone, INTERVALS } from "../lib/freshness";
import { creditPool, goldPool, canCredit, canGold, canRefresh, creditPassed, goldPassed, saveGold, readGold, saveCredit, readCredits, creditTriedToday, markCreditTry, CREDIT_N, GOLD_N } from "../lib/marks";
import { buildCustomModules, revOf } from "../lib/custom-modules";
import { readFileSync } from "node:fs";
import { pickWarmup } from "../lib/warmup";
import { pickTasks, tasksFor, taskProgress, markQuestDone, questDays, goalLine } from "../lib/quest";
import { pickGuest, parseGuestReply, parseReceipt, mistakesForLessons, placeOf, saveGuestRun, readGuestRuns, PERSONAS } from "../lib/live-guest";
import { cleanLine, lessonSegments, buildEpisode, playlist, radioCounted, markRadio, voiceFor } from "../lib/radio";
import { monthRecap, recapMonth, recapShareText } from "../lib/month-recap";
import { learningSnapshot } from "../lib/learning-sync";
import { personModel, stepIndex } from "../lib/report-model";
import { SEASONAL_MODULES } from "../data/modules-seasonal";

function mem(init = {}) {
  const o = { ...init };
  return { o, get length() { return Object.keys(o).length; }, key: (i) => Object.keys(o)[i], getItem: (k) => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: (k) => { delete o[k]; } };
}
const DAY = 86400000;
const NOW = new Date(2026, 9, 14, 15, 0, 0);   // среда
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const ago = (n) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n, 12);
const S0 = SEASONAL_MODULES.find((m) => m.id === "s0"), S1 = SEASONAL_MODULES.find((m) => m.id === "s1");
const doneOf = (...mods) => { const c = {}, q = {}; mods.forEach((m) => m.lessons.forEach((l) => { if (l.type === "quiz") q[l.id] = true; else if (l.type !== "result") c[l.id] = true; })); return { c, q }; };

describe("журнал дня и очки лиги (Доп. 314, 317)", () => {
  it("новые шаги: гость, радио, освежить, золото, зачёт", () => {
    const ls = mem();
    ["guest", "radio", "refresh", "gold", "credit"].forEach((k) => bumpActivity("_a", k, 1, NOW, ls));
    const r = readActivity("_a", ls)[ymd(NOW)];
    expect([r.g, r.r, r.u, r.o, r.k, r.st]).toEqual([1, 1, 1, 1, 1, 5]);
    const w = weekSummary(readActivity("_a", ls), { count: 1 }, NOW);
    expect([w.totals.g, w.totals.r, w.totals.u, w.totals.o, w.totals.k]).toEqual([1, 1, 1, 1, 1]);
    const t = weekShareText(w, { count: 1 }, "Анна");
    expect(t).toContain("1 живой гость");
    expect(t).toContain("1 золотая тема");
    expect(t).toContain("1 зачёт на опыт");
  });
  it("очки: за занятия, потолок 200 в день, неделя с понедельника", () => {
    expect(pointsOf({ l: 1, w: 1, st: 2 })).toBe(20);
    expect(pointsOf({ g: 1, o: 1, k: 1 })).toBe(60);
    expect(pointsOf({ m: 100 })).toBe(DAY_CAP);
    expect(pointsOf({ l: "мусор" })).toBe(0);
    expect(POINTS.st).toBe(undefined);   // сумма шагов в очки не идёт — только сами занятия
    expect(ymd(weekStart(NOW))).toBe("2026-10-12");
    const act = { [ymd(ago(0))]: { l: 1 }, [ymd(ago(2))]: { q: 1 }, [ymd(ago(3))]: { l: 5 } };   // ago(3) — прошлое воскресенье
    expect(weekPoints(act, NOW)).toBe(25);
  });
});

describe("свежесть тем (Доп. 313)", () => {
  const { c, q } = doneOf(S0);
  it("пройденная тема получает отсчёт с сегодня, непройденная — нет", () => {
    const r = syncFresh({}, [S0, S1], c, q, NOW.getTime());
    expect(r.changed).toBe(true);
    expect(Object.keys(r.map)).toEqual(["s0"]);
    expect(syncFresh(r.map, [S0, S1], c, q, NOW.getTime()).changed).toBe(false);
    expect(moduleDone(S1, c, q)).toBe(false);
  });
  it("свежая → выдыхается → выдохлась; срок растёт с каждым освежением", () => {
    const t = NOW.getTime();
    expect(freshOf({ t: t - 2 * DAY, n: 0 }, t).level).toBe("fresh");
    expect(freshOf({ t: t - 4 * DAY, n: 0 }, t).level).toBe("fading");
    expect(freshOf({ t: t - 7 * DAY, n: 0 }, t).level).toBe("faded");
    expect(freshOf({ t: t - 4 * DAY, n: 1 }, t).level).toBe("fresh");   // после освежения срок 7 дней
    expect(freshOf({ t: t - 4 * DAY, n: 0 }, t).k).toBeGreaterThan(0.55);
    expect(INTERVALS).toEqual([3, 7, 14, 30, 60]);
    const m1 = touchFresh({ s0: { t: 1, n: 1 } }, "s0", t);
    expect(m1.s0).toEqual({ t, n: 2 });
    expect(touchFresh(m1, "s0", t + 5, true).s0).toEqual({ t: t + 5, n: 2 });   // разминка: срок не растёт
  });
  it("свой урок обновили после освежения — «обновлено»", () => {
    const rec = { t: NOW.getTime() - DAY, n: 1 };
    const mod = { ...S0, updatedAt: new Date(NOW.getTime() - 3600e3).toISOString() };
    expect(updatedAfter(mod, rec)).toBe(true);
    expect(updatedAfter({ ...S0, updatedAt: new Date(NOW.getTime() - 3 * DAY).toISOString() }, rec)).toBe(false);
    const f = topicFreshness(mod, { s0: rec }, c, q, NOW.getTime());
    expect(f.updated).toBe(true);
    expect(f.level).toBe("fading");
    expect(freshLabel(f)).toBe("обновлено, освежи");   // v74: без тире
  });
  it("ревью: свой раздел изменили в редакторе — «обновлено» по отпечатку текста", () => {
    const rec1 = [{ id: 7, role: "seasonal", module: "Наш бар", title: "Вино", content: "Подаём при 16°", questions: [{ q: "Температура?", options: ["8", "16"], correct: 1 }, { kind: "situation", scene: "Гость", options: ["а", "б"], correct: 0 }] }];
    const [m1] = buildCustomModules(rec1, "seasonal", { color: "#000" });
    expect(m1.rev).toBe(revOf(rec1));
    const done = doneOf(m1);
    const s1 = syncFresh({}, [m1], done.c, done.q, NOW.getTime());
    expect(s1.map[m1.id].h).toBe(m1.rev);
    // старая запись без отпечатка получает текущий молча — без «обновлено»
    const s2 = syncFresh({ [m1.id]: { t: 5, n: 1 } }, [m1], done.c, done.q, NOW.getTime());
    expect(s2.changed).toBe(true);
    expect(s2.map[m1.id]).toEqual({ t: 5, n: 1, h: m1.rev });
    expect(topicFreshness(m1, s1.map, done.c, done.q, NOW.getTime()).updated).toBe(undefined);
    // текст урока поправили — отпечаток другой, номер шага тот же
    const rec2 = [{ ...rec1[0], content: "Подаём при 14–16°" }];
    const [m2] = buildCustomModules(rec2, "seasonal", { color: "#000" });
    expect(m2.id).toBe(m1.id);
    expect(m2.rev).not.toBe(m1.rev);
    const f = topicFreshness(m2, s1.map, done.c, done.q, NOW.getTime());
    expect(f.updated).toBe(true);
    expect(freshLabel(f)).toBe("обновлено, освежи");   // v74: без тире
    // разминка отпечаток не трогает, целиком освежённая тема — снова «как сейчас»
    expect(touchFresh(s1.map, m2.id, NOW.getTime(), true, m2.rev)[m2.id].h).toBe(m1.rev);
    const fixed = touchFresh(s1.map, m2.id, NOW.getTime(), false, m2.rev);
    expect(fixed[m2.id].h).toBe(m2.rev);
    expect(topicFreshness(m2, fixed, done.c, done.q, NOW.getTime()).updated).toBe(undefined);
    // порядок уроков и вопросы на отпечаток не влияют
    expect(revOf([{ ...rec1[0], sort: 5, questions: [] }])).toBe(m1.rev);
  });
  it("ревью: свежесть только у тем, где есть чем освежить (от двух заданий)", () => {
    expect(canRefresh(S0)).toBe(true);
    expect(canRefresh({ id: "x", lessons: [{ id: "x-1", type: "lesson", content: "текст" }] })).toBe(false);
    expect(canRefresh({ id: "y", lessons: [{ id: "y-q", type: "quiz", questions: [{ q: "1?", options: ["a", "b"], correct: 0 }] }] })).toBe(false);
    expect(canRefresh({ id: "z", lessons: [{ id: "z-q", type: "quiz", questions: [{ q: "1?", options: ["a", "b"], correct: 0 }, { q: "2?", options: ["a", "b"], correct: 1 }] }] })).toBe(true);
  });
  it("список выдыхающихся — самые бледные первыми; непройденные не в счёт", () => {
    const all = doneOf(S0, S1);
    const map = { s0: { t: NOW.getTime() - 4 * DAY, n: 0 }, s1: { t: NOW.getTime() - 30 * DAY, n: 0 } };
    expect(fadedList(map, [S0, S1], all.c, all.q, NOW.getTime()).map((x) => x.mod.id)).toEqual(["s1", "s0"]);
    expect(topicFreshness(S1, map, c, q, NOW.getTime())).toBe(null);
  });
  it("разминка берёт выдыхающиеся темы первыми", () => {
    const pool = [...S0.lessons, ...S1.lessons].filter((l) => l.type === "practice").flatMap((l) => l.situations.map((s) => ({ ...s, _mod: l.id.split("-")[0] })));
    const pick = pickWarmup(pool, 3, "seed", new Set(["s1"]));
    expect(pick.filter((s) => s._mod === "s1").length).toBeGreaterThanOrEqual(2);
    expect(pickWarmup(pool, 3, "seed").length).toBe(3);
  });
});

describe("зачёт на опыт и золотая тема (Доп. 315–316)", () => {
  it("задания: 7 для зачёта, 8 для раунда мастера — вперемешку тест и практика", () => {
    const c1 = creditPool(S1, 1), g1 = goldPool(S1, 1);
    expect(c1.length).toBe(CREDIT_N);
    expect(g1.length).toBe(GOLD_N);
    expect(c1.filter((x) => x.genre === "quiz").length).toBe(5);
    expect(g1.filter((x) => x.genre === "quiz").length).toBe(4);
    expect(new Set(c1.map((x) => x.question || x.scene || x.statement)).size).toBe(7);
    expect(canCredit(S1) && canGold(S1)).toBe(true);
    expect(canCredit({ id: "x", lessons: [] })).toBe(false);
  });
  it("пороги: зачёт — 6 из 7, золото — не больше одной ошибки", () => {
    expect([creditPassed(6, 7), creditPassed(5, 7), creditPassed(5, 5), creditPassed(4, 5)]).toEqual([true, false, true, false]);
    expect([goldPassed(8, 8), goldPassed(7, 8), goldPassed(6, 8)]).toEqual([true, true, false]);
  });
  it("золото хранит лучший результат; зачёт — раз в день", () => {
    const ls = mem();
    saveGold("_a", "s0", { d: "2026-10-14", w: 1, sec: 90 }, ls);
    saveGold("_a", "s0", { d: "2026-10-14", w: 1, sec: 120 }, ls);
    expect(readGold("_a", ls).s0.sec).toBe(90);
    saveGold("_a", "s0", { d: "2026-10-15", w: 0, sec: 200 }, ls);
    expect(readGold("_a", ls).s0.w).toBe(0);
    saveCredit("_a", "s1", { d: "2026-10-14", s: 7, t: 7 }, ls);
    expect(readCredits("_a", ls).s1.s).toBe(7);
    expect(creditTriedToday("_a", "s1", "2026-10-14", ls)).toBe(false);
    markCreditTry("_a", "s1", "2026-10-14", ls);
    expect(creditTriedToday("_a", "s1", "2026-10-14", ls)).toBe(true);
    expect(creditTriedToday("_a", "s1", "2026-10-15", ls)).toBe(false);
  });
});

describe("квест смены: твоя часть (Доп. 314)", () => {
  it("три задания по важности и прогресс по журналу дня", () => {
    const t = pickTasks({ dueMistakes: 3, faded: [{ id: "s0", title: "Первый день" }], warm: true, next: { title: "Урок" }, guest: true });
    expect(t.map((x) => x.id)).toEqual(["fix", "fresh", "warm"]);
    expect(t[0].need).toBe(2);
    expect(taskProgress(t[0], { f: 1 })).toEqual({ have: 1, need: 2, done: false });
    expect(taskProgress(t[0], { f: 3 }).done).toBe(true);
    const step = pickTasks({ dueMistakes: 0, faded: [], warm: false, next: { title: "Урок" }, guest: false }).find((x) => x.id === "step");
    expect(taskProgress(step, { q: 1 }).done).toBe(true);   // тест — тоже шаг трека
  });
  it("задания выбираются раз в день и не меняются", () => {
    const ls = mem();
    const a = tasksFor("_a", { day: "2026-10-14", dueMistakes: 2, faded: [], warm: false, next: null, guest: true }, ls);
    const b = tasksFor("_a", { day: "2026-10-14", dueMistakes: 0, faded: [{ id: "x", title: "X" }], warm: true, next: null, guest: true }, ls);
    expect(b).toEqual(a);
    const c = tasksFor("_a", { day: "2026-10-15", dueMistakes: 0, faded: [{ id: "x", title: "X" }], warm: true, next: null, guest: true }, ls);
    expect(c[0].id).toBe("fresh");
  });
  it("закрытый квест — день записан один раз; подпись цели", () => {
    const ls = mem();
    markQuestDone("_a", "2026-10-14", ls); markQuestDone("_a", "2026-10-14", ls);
    expect(questDays("_a", ls)).toEqual(["2026-10-14"]);
    expect(goalLine({ warm: 3, steps: 6, guest: 1 })).toBe("3 разминки · 6 шагов · 1 живой гость");
  });
});

describe("живой гость (Доп. 312)", () => {
  it("место по треку: зал, вход, бар", () => {
    expect([placeOf("seasonal", "waiter"), placeOf("spg", "hostess"), placeOf("bar", "bartender"), placeOf("core", "senior_bartender")]).toEqual(["hall", "door", "bar", "bar"]);
    expect(PERSONAS.hall.length).toBeGreaterThanOrEqual(6);
  });
  it("гость заказывает из меню, стоп-лист — отдельно; другой персонаж, чем в прошлый раз", () => {
    const dishes = [{ name: "Борщ", allergens: ["сельдерей"] }, { name: "Салат с орехами", stop: { since: 1 } }, { name: "Архив", archived: true }];
    const g = pickGuest({ role: "seasonal", position: "waiter", dishes, seed: 5 });
    expect(g.place).toBe("hall");
    expect(g.menu).toEqual(["Борщ (аллергены: сельдерей)"]);
    expect(g.stop).toEqual(["Салат с орехами"]);
    expect(g.table).toBeGreaterThanOrEqual(2);
    const again = pickGuest({ role: "seasonal", position: "waiter", dishes, seed: 5, lastId: g.id });
    expect(again.id).not.toBe(g.id);
  });
  it("реплика гостя: метки настроения и ухода скрыты", () => {
    expect(parseGuestReply("Спасибо! [[mood:5]]\n[[end]]")).toEqual({ text: "Спасибо!", mood: 5, end: true });
    expect(parseGuestReply("Хм. [[mood:9]]").mood).toBe(null);
  });
  it("чек разбора: JSON внутри текста, оценки 1–5, уроки только из карты", () => {
    const r = parseReceipt('Вот: {"score": 7, "scores": {"contact": 5, "menu": 0, "care": "4"}, "good": ["a", "", "b"], "fix": ["c"], "phrase": "«Есть аллергии?»", "lessons": ["s0-2", "нет"]}', (id) => id === "s0-2");
    expect(r.scores).toEqual({ contact: 5, menu: 3, care: 4, sales: 3, calm: 3 });
    expect(r.score).toBe(4);   // 7 — мимо шкалы: берётся среднее
    expect(r.good).toEqual(["a", "b"]);
    expect(r.lessons).toEqual(["s0-2"]);
    expect(parseReceipt("без json")).toBe(null);
  });
  it("уроки из разбора → вопросы тестов в «Работу над ошибками», без повторов", () => {
    const items = mistakesForLessons(["s0-2", "s0-3"], [S0], [], NOW.getTime());
    expect(items.length).toBe(2);
    expect(items[0].lessonId).toBe("s0-q");
    expect(items[0].from).toBe("guest");
    expect(items[0].q).not.toBe(items[1].q);
    expect(mistakesForLessons(["s0-2"], [S0], [{ q: items[0].q }])[0].q).not.toBe(items[0].q);
  });
  it("ревью: персонажи на сервере (ai-chat) совпадают с приложением", () => {
    const src = readFileSync("supabase/functions/ai-chat/index.ts", "utf8");   // тесты запускаются из корня проекта
    const a = src.indexOf("const GUEST_PERSONAS"), b = src.indexOf("\n};", a);
    expect(a).toBeGreaterThan(0);
    const body = src.slice(src.indexOf("{", a) + 1, b);
    const server = {};
    const re = /\n\s*([a-z]+): \{ place: "(\w+)", name: "([^"]+)", age: (\d+), mood: (\d+),\s*who: "([^"]*)", occasion: "([^"]*)",\s*hidden: "([^"]*)" \},/g;
    let m;
    while ((m = re.exec(body))) server[m[1]] = { place: m[2], name: m[3], age: Number(m[4]), mood: Number(m[5]), who: m[6], occasion: m[7], hidden: m[8] };
    const app = {};
    Object.entries(PERSONAS).forEach(([place, list]) => list.forEach((p) => { app[p.id] = { place, name: p.name, age: p.age, mood: p.mood, who: p.who, occasion: p.occasion, hidden: p.hidden }; }));
    expect(Object.keys(server).sort()).toEqual(Object.keys(app).sort());
    Object.keys(app).forEach((id) => {
      ["place", "name", "age", "mood", "who", "occasion", "hidden"].forEach((k) => expect([id, k, server[id][k]]).toEqual([id, k, app[id][k]]));
    });
    // телефон присылает номер персонажа
    expect(pickGuest({ role: "seasonal", seed: 3 }).id).toBeTruthy();
  });
  it("история разговоров — последние 30", () => {
    const ls = mem();
    for (let i = 0; i < 32; i++) saveGuestRun("_a", { d: "2026-10-14", s: 4 }, ls);
    expect(readGuestRuns("_a", ls).length).toBe(30);
  });
});

describe("радио в дорогу (Доп. 319)", () => {
  it("строка урока без разметки и эмодзи", () => {
    expect(cleanLine("**Цель сервиса:**")).toBe("Цель сервиса:");
    expect(cleanLine("🔵 Базовый — выполнил")).toBe("Базовый — выполнил");
    expect(cleanLine("[mm:сервис] • Пункт")).toBe("Пункт");
  });
  it("главное из урока — до ~330 слов, заголовки отдельно", () => {
    const long = Array.from({ length: 80 }, (_, i) => "Фраза номер " + i + " про сервис и гостя.").join("\n");
    const segs = lessonSegments("**Заголовок:**\n" + long);
    expect(segs[0]).toEqual({ who: "host", text: "Заголовок.", head: true });
    expect(segs.reduce((a, s) => a + s.text.split(/\s+/).length, 0)).toBeLessThanOrEqual(340);
  });
  it("выпуск: ведущий, сценка разными голосами, два вопроса", () => {
    const l = S1.lessons.find((x) => x.type === "lesson");
    const e = buildEpisode(S1, l, "next", "x");
    expect(e.segs[0].text).toContain("Следующий урок твоего трека");
    expect(e.segs.some((s) => s.who === "staff")).toBe(true);
    expect(e.quiz.length).toBe(2);
    expect(e.mins).toBeGreaterThanOrEqual(1);
  });
  it("плейлист: следующий урок, выдохшаяся тема, повтор", () => {
    const { c, q } = doneOf(S0);
    const list = playlist({ modules: [S0, S1], completed: c, quizDone: q, faded: ["s0"], seed: "d" });
    expect(list.map((e) => e.kind)).toEqual(["next", "fresh", "repeat"]);
    expect(list[0].modId).toBe("s1");
    expect(list[1].modId).toBe("s0");
  });
  it("выпуск засчитывается раз в день; голоса различаются", () => {
    const ls = mem();
    expect(radioCounted("_a", "s1-1", "2026-10-14", ls)).toBe(false);
    markRadio("_a", "s1-1", "2026-10-14", ls);
    expect(radioCounted("_a", "s1-1", "2026-10-14", ls)).toBe(true);
    const one = [{ lang: "ru-RU", name: "A" }];
    expect(voiceFor("guest", one).pitch).not.toBe(voiceFor("host", one).pitch);
    const three = [{ lang: "ru-RU", name: "A" }, { lang: "ru-RU", name: "B" }, { lang: "ru-RU", name: "C" }];
    expect(voiceFor("staff", three).voice.name).toBe("C");
  });
});

describe("итоги месяца (Доп. 320)", () => {
  const act = {
    "2026-10-01": { st: 2, l: 2 }, "2026-10-02": { st: 1, q: 1 }, "2026-10-04": { st: 5, l: 3, w: 2, g: 1 }, "2026-10-05": { st: 1, l: 1 },
    "2026-10-06": { st: 2, l: 2 }, "2026-09-30": { st: 9 },
  };
  it("дни в деле, выходной не рвёт серию, лучший день", () => {
    const r = monthRecap({ act, streak: { frozen: ["2026-10-03"] }, month: "2026-10", now: NOW, guests: [{ d: "2026-10-04", s: 5 }, { d: "2026-09-29", s: 2 }], gold: { s0: { d: "2026-10-05" } }, quests: ["2026-10-04", "2026-09-20"] });
    expect([r.active, r.off, r.longest]).toEqual([5, 1, 5]);
    expect(r.best).toEqual({ d: 4, steps: 5, label: "4 октября" });
    expect(r.totals.st).toBe(11);
    expect([r.guests.n, r.guests.best, r.gold, r.quests]).toEqual([1, 5, 1, 1]);
    expect(r.calendar.length).toBe(31);
    expect(r.calendar[20].state).toBe(null);   // будущее
    expect(r.title).toBe("Октябрь");
  });
  it("первые три дня месяца — итоги прошлого, если в нём занимался", () => {
    expect(recapMonth(act, new Date(2026, 10, 2))).toEqual({ key: "2026-10", prev: true });
    expect(recapMonth(act, new Date(2026, 10, 5))).toEqual({ key: "2026-11", prev: false });
    expect(recapMonth({}, new Date(2026, 10, 2))).toEqual({ key: "2026-11", prev: false });
  });
  it("текст «поделиться»", () => {
    const r = monthRecap({ act, month: "2026-10", now: new Date(2026, 10, 2) });
    const t = recapShareText(r, "Анна");
    expect(t).toContain("Итоги за октябрь, Анна");   // v74: без тире
    expect(t).toContain("Дней в деле: 5 из 31");
  });
});

describe("копия с телефона v2 и отчёт: живая практика", () => {
  it("снимок несёт свежесть, зачёты, золото, гостей, квесты и дни серии", () => {
    const uk = "_Анна_С";
    const ls = mem({
      ["sa_fresh" + uk]: JSON.stringify({ s0: { t: 100, n: 2 }, bad: { t: 0 } }),
      ["sa_credit" + uk]: JSON.stringify({ s1: { d: "2026-10-14", s: 7, t: 7 } }),
      ["sa_gold" + uk]: JSON.stringify({ s0: { d: "2026-10-14", w: 0, sec: 50 } }),
      ["sa_guest_runs" + uk]: JSON.stringify([{ d: "2026-10-14", s: 4, p: "rush", ai: true, fix: "Аллергии" }]),
      ["sa_quest_done" + uk]: JSON.stringify(["2026-10-14", "мусор"]),
      ["sa_streak" + uk]: JSON.stringify({ count: 2, best: 3, last: "2026-10-14", days: ["2026-10-13", "2026-10-14"], frozen: ["2026-10-12"] }),
      ["sa_activity" + uk]: JSON.stringify({ [ymd(NOW)]: { st: 2, g: 1, x: 1, k: 1 } }),
    });
    const s = learningSnapshot(uk, { name: "Анна", surname: "С" }, ls, NOW);
    expect(s.v).toBe(2);
    expect(s.fresh).toEqual({ s0: { t: 100, n: 2 } });
    expect(s.credits.s1.s).toBe(7);
    expect(s.gold.s0.w).toBe(0);
    expect(s.guests[0]).toEqual({ d: "2026-10-14", s: 4, p: "rush", ai: true, fix: "Аллергии" });
    expect(s.quests).toEqual(["2026-10-14"]);
    expect(s.streak.days).toEqual(["2026-10-13", "2026-10-14"]);
    expect(s.streak.frozen).toEqual(["2026-10-12"]);
    expect(s.activity[ymd(NOW)]).toEqual({ st: 2, x: 1, g: 1, k: 1 });
  });
  it("карточка сотрудника: живая практика и флаги", () => {
    const steps = stepIndex({ seasonal: [S0, S1] });
    const t = NOW.getTime();
    const m = personModel({
      person: { id: "a", name: "Анна", surname: "С", position: "waiter" }, lessons: [], quiz: [], last_role: "seasonal", seen: NOW.toISOString(), learning_at: NOW.toISOString(),
      learning: { guests: [{ d: ymd(ago(1)), s: 4, ai: true, fix: "Аллергии" }, { d: ymd(ago(3)), s: 2 }], credits: { s1: { d: "2026-10-10", s: 6, t: 7 } }, gold: { s0: { d: "2026-10-11", w: 1 } },
        fresh: { s0: { t: t - 30 * DAY, n: 0 }, s1: { t: t - 20 * DAY, n: 0 }, x: { t: t - 40 * DAY, n: 0 } }, quests: [ymd(ago(2))], activity: { [ymd(ago(1))]: { st: 1, r: 1, u: 2 } } },
    }, { steps, roles: [{ id: "seasonal", label: "Новичок" }], now: NOW });
    expect(m.live.guests).toEqual({ n30: 2, total: 2, avg: 3, best: 4, ai: 1, lastFix: "Аллергии" });
    expect(m.live.credits.map((c) => c.title)).toEqual(["Мышление сервиса"]);
    expect(m.live.gold.map((c) => c.title)).toEqual(["Психология первого дня"]);
    expect(m.live.fresh.fading).toBe(3);
    expect([m.live.quests30, m.live.radio30, m.live.refresh30]).toEqual([1, 1, 2]);
    expect(m.flags.some((f) => /3 темы выдыхаются/.test(f.text))).toBe(true);
    expect(m.flags.some((f) => f.level === "good" && /Золотых тем: 1/.test(f.text))).toBe(true);
    expect(m.flags.some((f) => f.level === "info" && /Зачтено по опыту: «Мышление сервиса»/.test(f.text))).toBe(true);
  });
});
