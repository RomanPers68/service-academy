// v88 (Доп. 401): залы, стены, бар и вход на схеме зала и перетаскивание стола; «Вопрос дня» на главной с серией и
// своим часом; случаи из зала — голосом и «Черновик от ИИ». Вид — tools/claude/e2e-v88.mjs, сервер —
// tools/claude/sql/test37.sh.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { MAX_ZONES, MAX_ITEMS, ZONE1, ITEM_KINDS, zonesOf, zone1, zoneOfX, zoneTables, zoneItems, itemCells, busyCells, fits, addTable, moveTable, withZones,
  addZone, renameZone, removeZone, newZoneId, newItemId, wallOk, addWall, addBar, addDoor, removeItem, planV1, planProblem, gridRows, emptyPlan } from "../lib/seating.js";
import { QDAY_HOURS, qdayStreakText, qdayVerdict, qdayAnswerOf, QDAY_LETTERS } from "../lib/qday.js";
import { caseAiPrompt, parseCaseAi, CASE_LIMITS } from "../lib/cases.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

describe("v88: схема зала — залы", () => {
  const V1 = { v: 1, tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }, { id: "t2", n: "2", seats: 6, shape: "long", x: 2, y: 0 }] };
  it("старая схема — один зал «Зал», столы в нём; стол с неизвестным залом — в первом", () => {
    expect(zonesOf(V1)).toEqual([ZONE1]);
    expect(zonesOf(null)).toEqual([{ id: "z1", name: "Зал" }]);
    expect(zone1(V1)).toBe("z1");
    expect(zoneOfX(V1, V1.tables[0])).toBe("z1");
    const p = { v: 2, zones: [{ id: "z1", name: "Основной" }, { id: "z2", name: "Веранда" }], tables: [{ ...V1.tables[0], z: "z9" }, { ...V1.tables[1], z: "z2" }], items: [] };
    expect(zoneOfX(p, p.tables[0])).toBe("z1");
    expect(zoneTables(p, "z2").map((t) => t.id)).toEqual(["t2"]);
  });
  it("withZones: схема v2 с залом «Зал», у каждого стола z; addTable старой схемы не трогает её вид (v1)", () => {
    expect(withZones(V1)).toEqual({ v: 2, zones: [ZONE1], items: [], tables: V1.tables.map((t) => ({ ...t, z: "z1" })) });
    expect(addTable(V1, 7, 0, "z1")).toEqual({ ...V1, tables: [...V1.tables, { id: "t3", n: "3", seats: 4, shape: "sq", x: 7, y: 0 }] });
    expect(addTable(null, 0, 0)).toEqual({ v: 1, tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }] });
  });
  it("новый зал: «Зал 2», «Зал 3»… или своё имя; не больше шести; имена не повторяются", () => {
    const a = addZone(V1);
    expect(a.id).toBe("z2");
    expect(a.plan.zones).toEqual([ZONE1, { id: "z2", name: "Зал 2" }]);
    expect(a.plan.tables.every((t) => t.z === "z1")).toBe(true);
    expect(addZone(a.plan, "Веранда").plan.zones.map((z) => z.name)).toEqual(["Зал", "Зал 2", "Веранда"]);
    expect(addZone(a.plan, "зал 2")).toBe(null);
    let p = a.plan;
    for (let i = 0; i < 4; i++) p = addZone(p).plan;
    expect(p.zones.length).toBe(MAX_ZONES);
    expect(addZone(p)).toBe(null);
    expect(newZoneId({ zones: [{ id: "z1" }, { id: "z2" }, { id: "z4" }] })).toBe("z3");
  });
  it("переименовать: пустое и повторяющееся — нельзя; убрать: только пустой и не последний", () => {
    const p = addZone(V1, "Веранда").plan;
    expect(renameZone(p, "z2", "Терраса").zones[1].name).toBe("Терраса");
    expect(renameZone(p, "z2", " ")).toBe(p);
    expect(renameZone(p, "z2", "ЗАЛ")).toBe(p);
    expect(removeZone(p, "z1")).toBe(p);   // в нём столы
    expect(removeZone(p, "z2").zones).toEqual([ZONE1]);
    expect(removeZone(withZones(V1), "z1")).toEqual(withZones(V1));   // последний
    const withWall = addWall(p, "z2", 0, 1, 3, 1);
    expect(removeZone(withWall, "z2")).toBe(withWall);   // в нём стена
  });
  it("стол другого зала не мешает: на той же клетке в «Веранде» стол встаёт", () => {
    const p = addZone(V1, "Веранда").plan;
    const q = addTable(p, 0, 0, "z2");
    expect(q.tables.length).toBe(3);
    expect(q.tables[2]).toMatchObject({ x: 0, y: 0, z: "z2" });
    expect(fits(q, q.tables[2], 2, 0)).toBe(true);
    expect(moveTable(q, "t3", 3, 0).tables[2]).toMatchObject({ x: 3, z: "z2" });
  });
});

describe("v88: стены, бар, вход", () => {
  const P = withZones({ v: 1, tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }, { id: "t2", n: "2", seats: 6, shape: "long", x: 2, y: 2 }] });
  it("стена — по узлам сетки, по прямой, не нулевая; порядок концов не важен, повтор не добавляется", () => {
    expect([wallOk(0, 3, 8, 3), wallOk(2, 0, 2, 30), wallOk(0, 0, 2, 2), wallOk(1, 1, 1, 1), wallOk(0, 0, 9, 0), wallOk(-1, 0, 0, 0)]).toEqual([true, true, false, false, false, false]);
    const p = addWall(P, "z1", 8, 3, 0, 3);
    expect(p.items).toEqual([{ id: "i1", kind: "wall", x: 0, y: 3, x2: 8, y2: 3, z: "z1" }]);
    expect(addWall(p, "z1", 0, 3, 8, 3)).toBe(p);
    expect(addWall(p, "z1", 0, 0, 3, 3)).toBe(p);
    expect(itemCells(p.items[0])).toEqual([]);   // стена клеток не занимает
    expect(fits(p, { id: "x", shape: "sq", z: "z1" }, 0, 3)).toBe(true);
  });
  it("бар — прямоугольник между двумя клетками; на столе не встаёт; клетки бара заняты", () => {
    const p = addBar(P, "z1", 7, 0, 5, 1);
    expect(p.items[0]).toEqual({ id: "i1", kind: "bar", x: 5, y: 0, w: 3, h: 2, z: "z1" });
    expect(itemCells(p.items[0]).length).toBe(6);
    expect(addBar(P, "z1", 0, 0, 1, 0)).toBe(P);   // на столе 1
    expect(addBar(P, "z1", 6, 0, 8, 0)).toBe(P);   // за краем
    expect(fits(p, { id: "x", shape: "sq", z: "z1" }, 6, 1)).toBe(false);
    expect(addTable(p, 6, 1, "z1")).toBe(p);
    expect([...busyCells(p, null, "z1")].sort()).toEqual(["0:0", "2:2", "3:2", "5:0", "5:1", "6:0", "6:1", "7:0", "7:1"]);
  });
  it("вход — свободная клетка; на столе и на баре — нет; убрать предмет", () => {
    const p = addDoor(P, "z1", 7, 5);
    expect(p.items[0]).toEqual({ id: "i1", kind: "door", x: 7, y: 5, z: "z1" });
    expect(addDoor(P, "z1", 0, 0)).toBe(P);
    expect(addDoor(p, "z1", 7, 5)).toBe(p);
    expect(removeItem(p, "i1").items).toEqual([]);
    expect(newItemId({ items: [{ id: "i1", kind: "door" }, { id: "i2", kind: "door" }] })).toBe("i3");
    expect(ITEM_KINDS).toEqual({ wall: "Стена", bar: "Бар", door: "Вход" });
  });
  it("не больше 60 предметов; высота сетки зала — по столам и предметам", () => {
    const p = { ...P, items: Array.from({ length: MAX_ITEMS }, (_, i) => ({ id: "i" + (i + 1).toString(36), kind: "wall", x: 0, y: i % 30, x2: 1 + Math.floor(i / 30), y2: i % 30, z: "z1" })) };
    expect(addDoor(p, "z1", 7, 7)).toBe(p);
    expect(addWall(p, "z1", 4, 0, 4, 5)).toBe(p);
    expect(gridRows(addBar(P, "z1", 0, 9, 1, 10), 1, "z1")).toBe(12);
    expect(gridRows(addWall(P, "z1", 0, 12, 8, 12), 1, "z1")).toBe(13);
    expect(gridRows(P, 1, "z2")).toBe(1);
  });
  it("сервер без этапа 37: схема v1 — только один зал без предметов", () => {
    expect(planV1(P)).toEqual({ v: 1, tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }, { id: "t2", n: "2", seats: 6, shape: "long", x: 2, y: 2 }] });
    expect(planV1(addDoor(P, "z1", 7, 5))).toBe(null);
    expect(planV1(addZone(P).plan)).toBe(null);
  });
  it("перед сохранением: залы с одним именем, стол на баре", () => {
    expect(planProblem({ ...P, zones: [{ id: "z1", name: "Веранда" }, { id: "z2", name: "веранда" }] })).toBe("Зал «веранда» повторяется");
    expect(planProblem({ ...P, items: [{ id: "i1", kind: "bar", x: 0, y: 0, w: 2, h: 1, z: "z1" }] })).toBe("Стол 1 наезжает на другой или выходит за край");
    expect(planProblem(addWall(P, "z1", 0, 1, 8, 1))).toBe("");
  });
});

describe("v88: схема на экране", () => {
  const PLAN = { v: 2, zones: [{ id: "z1", name: "Основной" }, { id: "z2", name: "Веранда" }],
    tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t3", n: "В1", seats: 2, shape: "rd", x: 1, y: 1, z: "z2" }],
    items: [{ id: "i1", kind: "wall", x: 0, y: 3, x2: 8, y2: 3, z: "z1" }, { id: "i2", kind: "bar", x: 5, y: 0, w: 3, h: 1, z: "z1" }, { id: "i3", kind: "door", x: 7, y: 5, z: "z1" }] };
  it("Floor: только столы и предметы выбранного зала; стена — линией, бар и вход — подписями", async () => {
    const { Floor } = await import("../ui/seating.jsx");
    const a = R(h(Floor, { a11y: false, plan: PLAN, zone: "z1", map: {}, now: 0 }));
    expect(a).toContain('data-zone="z1"');
    expect(a).toContain('data-table="t1"');
    expect(a).not.toContain('data-table="t3"');
    expect(a).toContain('<g data-item="i1" data-kind="wall"><line');
    expect(a).toMatch(/data-item="i2" data-kind="bar"[^>]*><span>Бар<\/span>/);
    expect(a).toMatch(/data-item="i3" data-kind="door"/);
    const b = R(h(Floor, { a11y: true, plan: PLAN, zone: "z2", map: {}, now: 0 }));
    expect(b).toContain('data-table="t3"');
    expect(b).not.toContain("data-item=");
  });
  it("подбор компании по залам: здесь и в других залах", async () => {
    const { suggestLine } = await import("../ui/seating.jsx");
    const tn = (id) => "стол " + id, zone = (id) => (id.startsWith("v") ? "z2" : "z1"), name = (z) => (z === "z2" ? "Веранда" : "Основной");
    expect(suggestLine([], tn, zone, "z1", name)).toBe("Свободных столов на столько гостей нет.");
    expect(suggestLine(["5", "7"], tn, null, "z1", name)).toBe("Подойдут: стол 5, стол 7. Они подсвечены.");
    expect(suggestLine(["5", "v2"], tn, zone, "z1", name)).toBe("Подойдут: стол 5. Они подсвечены. Ещё в зале «Веранда»: стол v2.");
    expect(suggestLine(["v2"], tn, zone, "z1", name)).toBe("В этом зале подходящих нет. Ещё в зале «Веранда»: стол v2.");
  });
  it("редактор: залы и инструменты — с этапом 37; без него — подсказка и схема v1; стол перетаскивается", () => {
    const src = rd("ui/seating.jsx");
    expect(src).toContain('const TOOLS = [["table", "Столы"], ["wall", "Стены"], ["bar", "Бар"], ["door", "Вход"]];');
    expect(src).toContain("const body = floor2 ? withZones(plan) : planV1(plan);");
    expect(src).toContain('<FloorEditor c={c} a11y={a11y} plan0={plan} floor2={st.floor === 2}');
    expect(src).toContain("Залы, стены, бар и вход появятся, когда на сервер добавят этап 37 (supabase-stage37-halls-qday.sql).");
    expect(src).toContain("try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_e) { /* */ }");
    // жест пальцем — целиком столу: общее «* { touch-action: pan-y !important }» перебивает только класс с !important
    expect(src).toContain('className={canDrag ? "sa-drag" : undefined}');
    expect(rd("ui/css.js")).toContain(".sa-drag, .sa-drag * { touch-action: none !important; }");
    expect(src).toContain('else if (r && r.error === "overlap") setErr("Стол стоит на баре или входе.");');
    expect(src).toContain('localStorage.getItem("sa_seat_zone")');
  });
});

describe("v88: «Вопрос дня» на главной", () => {
  const ITEM = { id: 7, q: "Через сколько секунд гостя нужно поприветствовать?", o: ["30 секунд", "Через 5 минут", "Когда сядет"], t: "Встреча гостя", r: "Официант", day: "2026-10-26", via: "app", answer: null, correct: null, at: null };
  it("серия, итог и запись для банка ошибок", () => {
    expect([qdayStreakText(0), qdayStreakText(1), qdayStreakText(3), qdayStreakText(5), qdayStreakText(21), qdayStreakText(12)]).toEqual(["", "серия 1 день", "серия 3 дня", "серия 5 дней", "серия 21 день", "серия 12 дней"]);
    expect(qdayVerdict(ITEM)).toBe("");
    expect(qdayVerdict({ ...ITEM, answer: 0, correct: true, c: 0 })).toBe("Верно.");
    expect(qdayVerdict({ ...ITEM, answer: 2, correct: false, c: 0 })).toBe("Неверно. Верный ответ: А.");
    expect(qdayAnswerOf(ITEM)).toBe(null);
    expect(qdayAnswerOf({ ...ITEM, answer: 2, correct: false, c: 0, e: "Первый контакт — до 30 секунд." })).toEqual({ id: 7, q: ITEM.q, o: ITEM.o, c: 0, e: "Первый контакт — до 30 секунд.", t: "Встреча гостя", answer: 2, correct: false, at: null });
    expect(QDAY_HOURS).toEqual([8, 10, 12, 14, 16, 18, 20]);
    expect(QDAY_LETTERS).toEqual(["А", "Б", "В", "Г"]);
  });
  it("карточка: вопрос и варианты; после ответа — верный золотом, мой неверный, разбор и «Работа над ошибками»", async () => {
    const { QdayCard } = await import("../ui/qday-card.jsx");
    expect(R(h(QdayCard, { a11y: false, data: { item: null } }))).toBe("");
    const ask = R(h(QdayCard, { a11y: false, data: { item: ITEM, streak: 3 }, onAnswer: () => {} }));
    expect(ask).toContain('data-qday-card="ask"');
    expect(ask).toMatch(/Вопрос дня.*· Встреча гостя.*серия 3 дня/);
    expect(ask).toContain('data-qday-opt="2" data-state="idle" role="button" tabindex="0" aria-label="В. Когда сядет"');
    expect(ask).not.toContain("data-qday-result");
    const bad = R(h(QdayCard, { a11y: true, data: { item: { ...ITEM, answer: 2, correct: false, c: 0, e: "Первый контакт до 30 секунд." }, streak: 1 }, onMistakes: () => {} }));
    expect(bad).toContain('data-qday-card="bad"');
    expect(bad).toContain('data-qday-opt="0" data-state="right"');
    expect(bad).toContain('data-qday-opt="2" data-state="wrong"');
    expect(bad).toMatch(/Неверно\. Верный ответ: А\..*Первый контакт до 30 секунд\..*«Работе над ошибками»/);
    const ok = R(h(QdayCard, { a11y: false, data: { item: { ...ITEM, answer: 0, correct: true, c: 0, e: "" }, streak: 2 } }));
    expect(ok).toMatch(/Верно\..*Следующий вопрос завтра\./);
    // после ответа: вариант уже не кнопка, «верный ответ» / «твой ответ» — скрытым текстом для экранного диктора
    expect(bad).toMatch(/data-qday-opt="0" data-state="right"[^>]*>(?:(?!data-qday-opt).)*, верный ответ<\/span>/s);
    expect(bad).toMatch(/data-qday-opt="2" data-state="wrong"[^>]*>(?:(?!data-qday-opt).)*, твой ответ<\/span>/s);
    expect(bad).not.toMatch(/data-qday-opt="\d" data-state="\w+" role="button"/);
  });
  it("приложение: qday_today при входе на главную и после очереди; ответ — в банк ошибок один раз; карточка под главной", () => {
    const app = rd("App.jsx");
    expect(app).toContain('rpc("qday_today", { p_token: saToken() })');
    expect(app).toContain('rpc("qday_answer", { p_token: saToken(), p_id: it.id, p_answer: i })');
    expect(app).toContain("if (a && newQdayAnswers(ukP, [a]).length) {");
    expect(app).toContain("markQdaySeen(ukP, [a.id]);");
    expect(app).toContain("if (alive) loadQday(true);");
    // другой сотрудник на том же телефоне: карточка и «не чаще раза в пять минут» сбрасываются
    expect(app).toContain('useEffect(() => { qdayAskRef.current = { at: 0, off: false }; setQdayData(null); setQdayErr(""); }, [ukP]);');
    expect(app).toContain('qdayCard={qdayData && qdayData.item ? <QdayCard a11y={a11y} data={qdayData}');
    expect(rd("ui/screens-roleselect.jsx")).toContain('{qdayCard ? <div data-qday-slot="" style={{ margin:"9px -14px 0" }}>{qdayCard}</div> : null}');
  });
  it("напоминания: «Во сколько» у «Вопроса дня» — только с этапом 37; час заведения — как у всех (null)", async () => {
    const src = rd("ui/day-cards.jsx");
    const { QDAY_PICK } = await import("../ui/day-cards.jsx");
    expect(QDAY_PICK).toEqual([8, 10, 12, 14, 16, 18, 20]);
    expect(src).toContain('k === "qday" && on && p.qday_hour_default !== undefined');
    expect(src).toContain('rpc("notify_qday_hour_set", { p_token: saToken(), p_hour: h === p.qday_hour_default ? null : h })');
  });
});

describe("v88: случаи из зала — голосом и «Черновик от ИИ»", () => {
  const ITEM = { story: "Гость за баром попросил коктейль не из карты, а нужного сиропа нет.", did: "Сказал, что такого нет", outcome: "bad" };
  it("запрос Наставнику: метки строк, рассказ, что сделали и итог", () => {
    const p = caseAiPrompt(ITEM);
    for (const l of ["СЦЕНА:", "ВОПРОС:", "ВЕРНО:", "НЕВЕРНО1:", "НЕВЕРНО2:", "НЕВЕРНО3:", "РАЗБОР:", "КАК БЫЛО:"]) expect(p).toContain(l);
    expect(p).toContain("Рассказ: «Гость за баром попросил коктейль не из карты, а нужного сиропа нет.»");
    expect(p).toContain("Что сделали: «Сказал, что такого нет»");
    expect(p).toContain("Чем закончилось: гость ушёл недовольным.");
    expect(caseAiPrompt({ story: "x".repeat(2000) }).length).toBeLessThan(2000 + 1200);
  });
  it("ответ раскладывается по полям (markdown, кнопки, перенос строки — не мешают); без разбора — null", () => {
    const reply = "Вот черновик:\nСЦЕНА: Гость за баром просит коктейль, которого нет в карте.\nВОПРОС: Как поступить?\n**ВЕРНО:** Предложить похожий из карты.\nНЕВЕРНО1: Сказать, что такого нет.\n- НЕВЕРНО 2: Сделать без сиропа.\nРАЗБОР: Гость пришёл за вкусом,\nа не за названием.\nКАК БЫЛО: Сказали, что нет; гость ушёл.\n[[lesson:s1-1|Открыть урок]]";
    expect(parseCaseAi(reply)).toEqual({ scene: "Гость за баром просит коктейль, которого нет в карте.", question: "Как поступить?", right: "Предложить похожий из карты.",
      wrong: ["Сказать, что такого нет.", "Сделать без сиропа.", ""], why: "Гость пришёл за вкусом, а не за названием.", real: "Сказали, что нет; гость ушёл." });
    expect(parseCaseAi("СЦЕНА: Гость ждёт счёт уже десять минут.\nВЕРНО: Принести сразу.\nНЕВЕРНО1: Ждать.")).toBe(null);
    expect(parseCaseAi("Привет! Отличный случай 🙂")).toBe(null);
    expect(parseCaseAi("СЦЕНА: " + "а".repeat(3000) + "\nВЕРНО: да\nНЕВЕРНО1: нет\nРАЗБОР: потому что так").scene.length).toBe(CASE_LIMITS.scene);
  });
  it("экран: микрофон у полей рассказа и разбора, «Черновик от ИИ» с «Вернуть как было»", async () => {
    const src = rd("ui/cases.jsx");
    const { appendSpoken } = await import("../ui/cases.jsx");
    expect(appendSpoken("Гость попросил", " пересадить ", 100)).toBe("Гость попросил пересадить");
    expect(appendSpoken("", "Привет", 100)).toBe("Привет");
    expect(appendSpoken("абв", "где", 5)).toBe("абв г");
    expect(src.match(/ mic onMicError=\{setErr\}/g).length).toBe(5);   // что случилось, что сделал(а), сцена, разбор, как было
    // микрофон — вне <label>: нажатие на подпись не включает запись, у поля остаётся подпись (htmlFor)
    expect(src).toContain('<label htmlFor={id} style={{ flex: 1, minWidth: 0, ...labelStyle(13), color: c.gold }}>{label}</label>{micEl}</div>');
    expect(src).toContain("<textarea id={id} ");
    expect(src).not.toMatch(/<label[^>]*>\s*\{label \|\| micEl/);
    expect(src).toContain('body: JSON.stringify({ token: saToken(), messages: [{ role: "user", content: caseAiPrompt(item) }] })');
    expect(src).toContain('{aiBusy ? "Наставник пишет черновик…" : undo ? "Ещё вариант от ИИ" : "Черновик от ИИ"}');
    expect(src).toContain("Вернуть как было");
    expect(src).toContain('else if (j && j.error === "daily_limit") setErr(');
  });
});

describe("v88: этап 37 и справка", () => {
  const sql = rd("supabase/supabase-stage37-halls-qday.sql");
  it("этап 37: что заменяет, что требует, права", () => {
    expect(sql).toContain("raise exception 'Сначала этап 36 (supabase-stage36-comfort.sql): нужны тихие часы — notify_quiet';");
    expect(sql).toContain("return jsonb_build_object('ok', false, 'error', 'old_app');");
    expect(sql).toContain("return jsonb_build_object('ok', true, 'floor', 2,");
    expect(sql).toContain("alter table sa_notify_prefs add column if not exists qday_hour smallint;");
    expect(sql).toContain("grant execute on function qday_answer(text, bigint, int) to anon, authenticated;");
    expect(sql).toContain("revoke all on function _sa_qday_streak(text, date) from public, anon, authenticated;");
    expect(sql).toContain("' функций из 5 · схема: '");
    expect(rd("supabase/README.md")).toContain("| 46 | `supabase-stage37-halls-qday.sql` |");
  });
  it("справка: залы и стены, голос и черновик от ИИ, вопрос дня и его час", async () => {
    const { GUIDE } = await import("../ui/guide.jsx");
    const all = GUIDE.flatMap((g) => g.items || []);
    const t = (k) => (all.find((x) => x.key === k) || {}).text || "";
    expect(t("seat")).toContain("инструментами «Стены», «Бар» и «Вход», а стол можно перетащить пальцем");
    expect(t("cases")).toContain("«Черновик от ИИ»");
    expect(t("qday")).toContain("Серия на карточке: сколько дней подряд был ответ.");
    expect(t("remind")).toContain("У «Вопроса дня» можно выбрать свой час: «Во сколько».");
    // прежние формулировки на месте
    expect(t("seat")).toContain("столу с гостями «Счёт», после счёта «Уборка»");
    expect(t("remind")).toContain("«Тихие часы»: в это время бот молчит, кроме напоминания о смене.");
  });
  it("новые файлы — без эмодзи и без «слово — слово» в строках интерфейса", () => {
    for (const f of ["ui/qday-card.jsx", "lib/qday.js", "ui/seating.jsx", "lib/seating.js", "ui/cases.jsx", "lib/cases.js", "ui/day-cards.jsx"]) {
      const s = code(rd(f));
      expect(s, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    for (const f of ["ui/qday-card.jsx", "ui/seating.jsx", "ui/cases.jsx"]) expect(code(rd(f)).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g), f).toBe(null);
  });
  it("«сборка v88», «Дополнение 401»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(8[89]|9\d|\d{3,})<\/span>/);   // v88 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 401 — залы и стены на схеме, вопрос дня на главной, случаи голосом и черновик от ИИ (v88)");
  });
});
