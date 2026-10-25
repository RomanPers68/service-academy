// v85 (Доп. 398): рассадка для хостес. Схема зала (руководитель рисует столы на сетке 8 клеток в ширину) и доска
// на сегодня, общая для смены: свободен, бронь, гости, уборка; официанту — сообщение, что ему посадили гостей;
// брони — в брифинге смены. Вид — tools/claude/e2e-v85.mjs, сервер — tools/claude/sql/test35.sh.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { GRID_W, GRID_H, MAX_TABLES, PARTY, NEXT, cellsOf, busyCells, fits, nextNumber, newId, emptyPlan, addTable, moveTable, updateTable, removeTable,
  planProblem, gridRows, boardMap, stateOf, summary, suggest, minutesSince, sinceLabel, tableSub, defaultCnt, reservations, onShiftToday, waiterList,
  initials, shortName, waiterLoad } from "../lib/seating.js";
import { briefRes, buildBrief, briefText, BRIEF_ORDER, BRIEF_TITLE } from "../lib/briefing.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

const PLAN = { v: 1, tables: [
  { id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }, { id: "t2", n: "2", seats: 4, shape: "rd", x: 2, y: 0 },
  { id: "t3", n: "3", seats: 2, shape: "sq", x: 4, y: 0 }, { id: "t4", n: "4", seats: 2, shape: "sq", x: 0, y: 2 },
  { id: "t5", n: "5", seats: 6, shape: "long", x: 2, y: 2 },
] };
const NOW = Date.parse("2026-10-23T07:20:00Z");
const ROWS = [
  { tid: "t2", status: "seat", cnt: 4, name: "", rtime: "", since: "2026-10-23T06:55:00Z", waiter_id: "e-petr", waiter_name: "Пётр Орлов" },
  { tid: "t3", status: "res", cnt: 4, name: "Иванов", rtime: "19:30", since: null, waiter_id: null, waiter_name: "" },
  { tid: "t4", status: "clean", cnt: 0, name: "", rtime: "", since: null, waiter_id: null, waiter_name: "" },
  { tid: "t9", status: "seat", cnt: 3, name: "", rtime: "", since: "2026-10-23T07:00:00Z", waiter_id: "e-anna", waiter_name: "Анна Смирнова" },   // стола уже нет в схеме
];
const STAFF = [{ id: "e-petr", name: "Пётр", surname: "Орлов" }, { id: "e-anna", name: "Анна", surname: "Смирнова" }, { id: "e-ilya", name: "Илья", surname: "Белов" }];
const ROSTER = [{ k: "В", name: "Вечер", from: 16, to: 24, people: ["Анна Смирнова", "Ольга Ли"] }];

describe("v85: схема зала", () => {
  const p = { v: 1, tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }, { id: "t2", n: "2", seats: 6, shape: "long", x: 2, y: 0 }] };
  it("сетка 8 клеток в ширину (на телефоне по столу легко попасть пальцем); длинный стол — две клетки", () => {
    expect([GRID_W, GRID_H, MAX_TABLES]).toEqual([8, 30, 80]);
    expect(cellsOf(p.tables[1])).toEqual([[2, 0], [3, 0]]);
    expect([...busyCells(p)].sort()).toEqual(["0:0", "2:0", "3:0"]);
    expect([...busyCells(p, "t2")]).toEqual(["0:0"]);
  });
  it("стол встаёт только в свободные клетки сетки: не на другой стол и не за край; сам себе не мешает", () => {
    expect(fits(p, { id: "x", shape: "sq" }, 3, 0)).toBe(false);
    expect(fits(p, { id: "x", shape: "sq" }, 7, 0)).toBe(true);
    expect(fits(p, { id: "x", shape: "long" }, 7, 0)).toBe(false);
    expect(fits(p, { id: "x", shape: "sq" }, 0, GRID_H)).toBe(false);
    expect(fits(p, { id: "x", shape: "sq" }, -1, 0)).toBe(false);
    expect(fits(p, p.tables[1], 3, 0)).toBe(true);
  });
  it("новый стол: следующий номер, 4 места, квадрат; на занятую клетку и сверх 80 столов не ставится", () => {
    let q = addTable(null, 0, 0);
    expect(q).toEqual({ v: 1, tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0 }] });
    q = addTable(q, 1, 0);
    expect(q.tables[1]).toEqual({ id: "t2", n: "2", seats: 4, shape: "sq", x: 1, y: 0 });
    expect(addTable(q, 1, 0)).toBe(q);
    expect(nextNumber({ tables: [{ n: "12" }, { n: "VIP" }, { n: "3" }] })).toBe("13");
    expect(nextNumber(emptyPlan())).toBe("1");
    expect(newId({ tables: [{ id: "t3" }, { id: "t4" }] })).toBe("t5");
    expect(newId({ tables: Array.from({ length: 9 }, (_, i) => ({ id: "t" + (i + 1) })) })).toBe("ta");   // как на сервере: t + [0-9a-z]
    const full = { v: 1, tables: Array.from({ length: MAX_TABLES }, (_, i) => ({ id: "t" + (i + 1).toString(36), n: String(i + 1), seats: 2, shape: "sq", x: i % 8, y: Math.floor(i / 8) })) };
    expect(addTable(full, 0, 15)).toBe(full);
  });
  it("передвинуть, места (1–20), форма (длинному нужна клетка справа), убрать", () => {
    expect(moveTable(p, "t1", 5, 2).tables[0]).toMatchObject({ x: 5, y: 2 });
    expect(moveTable(p, "t1", 2, 0)).toBe(p);
    expect(moveTable(p, "t2", 7, 0)).toBe(p);
    expect(moveTable(p, "t9", 5, 5)).toBe(p);
    expect(updateTable(p, "t1", { seats: 0 }).tables[0].seats).toBe(1);
    expect(updateTable(p, "t1", { seats: 99 }).tables[0].seats).toBe(20);
    expect(updateTable(p, "t1", { shape: "long" }).tables[0].shape).toBe("long");
    const tight = { v: 1, tables: [{ ...p.tables[0], x: 1 }, p.tables[1]] };
    expect(updateTable(tight, "t1", { shape: "long" })).toBe(tight);
    expect(updateTable(tight, "t1", { shape: "rd", n: "7" }).tables[0]).toMatchObject({ shape: "rd", n: "7" });
    expect(removeTable(p, "t1").tables.map((t) => t.id)).toEqual(["t2"]);
  });
  it("перед сохранением: номер есть и не повторяется (без учёта регистра), столы не наезжают", () => {
    expect(planProblem(p)).toBe("");
    expect(planProblem({ tables: [{ ...p.tables[0], n: "VIP" }, { ...p.tables[1], n: "vip" }] })).toBe("Номер vip повторяется");
    expect(planProblem({ tables: [{ ...p.tables[0], n: " " }] })).toBe("У стола нет номера");
    expect(planProblem({ tables: [p.tables[0], { ...p.tables[1], x: 0 }] })).toBe("Стол 1 наезжает на другой или выходит за край");
  });
  it("высота сетки: до нижнего стола и запас (в редакторе — три ряда)", () => {
    expect(gridRows(p)).toBe(2);
    expect(gridRows(p, 3)).toBe(4);
    expect(gridRows(emptyPlan(), 3)).toBe(3);
    expect(gridRows({ tables: [{ ...p.tables[0], y: 29 }] }, 3)).toBe(GRID_H);
  });
});

describe("v85: доска на сегодня", () => {
  const map = boardMap(ROWS);
  it("сводка; стола нет в доске — свободен", () => {
    expect(summary(PLAN, ROWS)).toEqual({ total: 5, free: 2, seat: 1, guests: 4, res: 1, clean: 1 });
    expect(stateOf(map, "t1")).toEqual({ tid: "t1", status: "free", cnt: 0 });
  });
  it("«Посадить компанию»: свободные столы, где хватает мест, сначала с наименьшим запасом; до трёх", () => {
    expect(PARTY.map((x) => x[1])).toEqual(["1–2", "3–4", "5–6", "7+"]);
    expect(suggest(PLAN, ROWS, 4)).toEqual(["t1", "t5"]);
    expect(suggest(PLAN, ROWS, 8)).toEqual([]);
    expect(suggest(PLAN, [], 2)).toEqual(["t3", "t4", "t1"]);
  });
  it("время: сколько сидят — по часам сервера, не меньше нуля; подпись на столе", () => {
    expect(minutesSince("2026-10-23T06:55:00Z", NOW)).toBe(25);
    expect(minutesSince("2026-10-23T08:00:00Z", NOW)).toBe(0);
    expect(minutesSince(null, NOW)).toBe(0);
    expect([sinceLabel(25), sinceLabel(65)]).toEqual(["25 мин", "1 ч 05 мин"]);
    expect(tableSub(PLAN.tables[1], stateOf(map, "t2"), NOW)).toBe("4·25м");
    expect(tableSub(PLAN.tables[1], { ...stateOf(map, "t2"), since: "2026-10-23T05:55:00Z" }, NOW)).toBe("4·1ч25");
    expect(tableSub(PLAN.tables[2], stateOf(map, "t3"), NOW)).toBe("19:30");
    expect(tableSub(PLAN.tables[2], { status: "res", rtime: "" }, NOW)).toBe("бронь");
    expect(tableSub(PLAN.tables[3], stateOf(map, "t4"), NOW)).toBe("уборка");
    expect(tableSub(PLAN.tables[0], stateOf(map, "t1"), NOW)).toBe("4 м.");
  });
  it("в карточке стола сразу выбрано обычное следующее; гостей — как в брони, по компании или двое (не больше мест)", () => {
    expect(NEXT).toEqual({ free: "seat", res: "seat", seat: "clean", clean: "free" });
    expect(defaultCnt({ seats: 4 }, { cnt: 0 }, 0)).toBe(2);
    expect(defaultCnt({ seats: 4 }, { cnt: 0 }, 4)).toBe(4);
    expect(defaultCnt({ seats: 4 }, { cnt: 0 }, 8)).toBe(4);
    expect(defaultCnt({ seats: 2 }, { cnt: 4 }, 0)).toBe(4);
    expect(defaultCnt({ seats: 1 }, { cnt: 0 }, 0)).toBe(1);
  });
  it("брони: по времени, при равном — по номеру стола; столы не из схемы не видны", () => {
    const rows = [...ROWS, { tid: "t5", status: "res", cnt: 6, name: "", rtime: "18:00" }, { tid: "t1", status: "res", cnt: 2, name: "Ли", rtime: "19:30" }, { tid: "t9", status: "res", cnt: 2, rtime: "17:00" }];
    expect(reservations(PLAN, rows)).toEqual([
      { tid: "t5", n: "5", rtime: "18:00", name: "", cnt: 6 },
      { tid: "t1", n: "1", rtime: "19:30", name: "Ли", cnt: 2 },
      { tid: "t3", n: "3", rtime: "19:30", name: "Иванов", cnt: 4 },
    ]);
  });
  it("официанты: кто в графике (по именам, как «График»), они первыми; у кого какие столы; кто в графике без столов", () => {
    const on = onShiftToday(STAFF, ROSTER);
    expect(on).toEqual({ "e-anna": true });
    expect(waiterList(STAFF, on).map((e) => e.id)).toEqual(["e-anna", "e-ilya", "e-petr"]);
    expect(waiterList(STAFF, null).map((e) => e.id)).toEqual(["e-anna", "e-ilya", "e-petr"]);
    expect([shortName("Анна Смирнова"), shortName("Илья"), shortName("  "), initials("Пётр Орлов")]).toEqual(["Анна С.", "Илья", "", "ПО"]);
    expect(waiterLoad(PLAN, ROWS, STAFF, on)).toEqual({ busy: [{ id: "e-petr", name: "Пётр О.", tables: ["2"], guests: 4 }], idle: ["Анна С."], count: { "e-petr": 1 } });
    const more = [...ROWS, { tid: "t5", status: "seat", cnt: 5, waiter_id: "e-anna", waiter_name: "Анна Смирнова" }, { tid: "t1", status: "seat", cnt: 2, waiter_id: "e-anna", waiter_name: "Анна Смирнова" }];
    expect(waiterLoad(PLAN, more, STAFF, on)).toEqual({ busy: [{ id: "e-anna", name: "Анна С.", tables: ["1", "5"], guests: 7 }, { id: "e-petr", name: "Пётр О.", tables: ["2"], guests: 4 }], idle: [], count: { "e-anna": 2, "e-petr": 1 } });
  });
});

describe("v85: экран", () => {
  const T = { screen: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {} };
  it("до ответа сервера — «Загружаю зал…»", async () => {
    const { SeatingScreen } = await import("../ui/seating.jsx");
    const html = R(h(SeatingScreen, { T, a11y: false, profile: { name: "Ольга", restaurant: "Два моря, Океан" }, onBack: () => {} }));
    expect(html).toContain(">Рассадка</div>");
    expect(html).toContain("Загружаю зал…");
  });
  it("схема: столы с состоянием для экранного диктора, подсветка подходящих", async () => {
    const { Floor } = await import("../ui/seating.jsx");
    const html = R(h(Floor, { a11y: false, plan: PLAN, map: boardMap(ROWS), now: NOW, hi: ["t1", "t5"] }));
    expect((html.match(/data-table="/g) || []).length).toBe(5);
    expect(html).toContain('data-table="t1" data-status="free" data-hi="1"');
    expect(html).toContain('data-table="t3" data-status="res" data-hi="0"');
    expect(html).toContain('aria-label="Стол 2, 4 места: гости, гостей 4"');
    expect(html).toContain('aria-label="Стол 3, 2 места: бронь, на 19:30"');
    expect(html).toContain('aria-label="Стол 5, 6 мест: свободен"');
    expect(html).toContain(">4·25м</span>");
    expect(html).toContain("data-broom");   // «уборка» на маленьком столе не влезает — веник
    expect(html).not.toContain("data-cell=");
    const ed = R(h(Floor, { a11y: true, plan: PLAN, map: {}, now: NOW, edit: true }));
    expect((ed.match(/data-cell="/g) || []).length).toBe(GRID_W * 6);   // до нижнего стола (ряд 3) и ещё три
  });
  it("карточка свободного стола: «Гости», гостей по компании, сначала официанты из графика, остальные — «Ещё»", async () => {
    const { TableSheet } = await import("../ui/seating.jsx");
    const on = onShiftToday(STAFF, ROSTER);
    const html = R(h(TableSheet, { a11y: false, t: PLAN.tables[0], row: { tid: "t1", status: "free", cnt: 0 }, staff: STAFF, shiftMap: on, load: { "e-petr": 1 }, party: 4, now: NOW, onSave: async () => true, onClose: () => {} }));
    expect(html).toContain('aria-checked="true" data-sheet-status="seat"');
    expect(html).toMatch(/data-cnt=""[^>]*>4<\/span>/);
    expect(html).toContain(">Анна С.</button>");
    expect(html).toContain(">Ещё 2</button>");
    expect(html).not.toContain("Пётр О.");
    expect(html).toContain(">Посадить</button>");
    expect(html).toContain("4 места · сейчас: свободен");
  });
  it("карточка стола с гостями: сразу «Уборка», сколько гостей и сколько сидят; бронь: время и на кого", async () => {
    const { TableSheet } = await import("../ui/seating.jsx");
    const map = boardMap(ROWS);
    const s2 = R(h(TableSheet, { a11y: true, t: PLAN.tables[1], row: stateOf(map, "t2"), staff: STAFF, now: NOW, onSave: async () => true, onClose: () => {} }));
    expect(s2).toContain('aria-checked="true" data-sheet-status="clean"');
    expect(s2).toContain("4 места · сейчас: гости, 4 гостя, 25 мин");
    expect(s2).toContain(">На уборку</button>");
    const s4 = R(h(TableSheet, { a11y: false, t: PLAN.tables[3], row: stateOf(map, "t4"), staff: STAFF, now: NOW, onSave: async () => true, onClose: () => {} }));
    expect(s4).toContain('aria-checked="true" data-sheet-status="free"');
    expect(s4).toContain(">Освободить стол</button>");
    const s3 = R(h(TableSheet, { a11y: false, t: PLAN.tables[2], row: stateOf(map, "t3"), staff: [], now: NOW, onSave: async () => true, onClose: () => {} }));
    expect(s3).toContain("2 места · сейчас: бронь на 19:30");
    expect(s3).toContain('aria-checked="true" data-sheet-status="seat"');
  });
  it("тексты — без тире между словами и без восклицаний", () => {
    for (const f of ["ui/seating.jsx", "lib/seating.js"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
    }
  });
});

describe("v85: в приложении", () => {
  const app = rd("App.jsx");
  it("«Смена» → «На смене» → «Рассадка» (после брифинга, перед графиком); экран лениво; ?go=seat; без этапа 35 пункт пропадает", () => {
    expect(app).toContain('const SeatingScreen = lazyOf(() => import("./ui/seating"), "SeatingScreen");');
    expect(app).toContain('seatOn && { key:"seat", group:"На смене", icon:"seat", label:"Рассадка", sub:"Схема зала: кто где сидит, брони и уборка", onClick:() => navigate("seat") },');
    expect(app.indexOf('seatOn && { key:"seat"')).toBeLessThan(app.indexOf('{ key:"sch", group:"На смене"'));
    expect(app.indexOf('isLead && { key:"brief"')).toBeLessThan(app.indexOf('seatOn && { key:"seat"'));
    expect(app).toMatch(/"thanks", "seat"[^\]]*\]\.includes\(v\)/);
    expect(app).toContain('else if (g === "seat") navigate("seat");');
    expect(app).toContain('onMissing={() => setSeatOn(false)} onBack={() => goBack("shift")}');
    expect(rd("ui/home-hubs.jsx")).toContain("seat: (c) => <svg");
  });
  it("«Напоминания в Telegram»: строка «Рассадка» последней — только когда сервер её знает", async () => {
    const { prefRows } = await import("../ui/day-cards");
    const base = { ok: true, bot: true, linked: true, remind: true, pair: true, quest: true, league: true, fresh: true, month: true, thanks: true };
    expect(prefRows(base).map((r) => r[0])).not.toContain("seat");
    const rows = prefRows({ ...base, seat: true });
    expect(rows[rows.length - 1]).toEqual(["seat", "Рассадка", "когда тебе посадили гостей за стол"]);
  });
  it("справка: «Рассадка» в «Смене»; в «Напоминаниях» перечислены все виды сообщений", async () => {
    const { GUIDE } = await import("../ui/guide.jsx");
    const all = GUIDE.flatMap((g) => g.items || []);
    const seat = all.find((x) => x.key === "seat");
    expect(seat && seat.go).toBe("seat");
    expect(seat.text).toContain("«Посадить: 1–2, 3–4, 5–6, 7+» подсвечивает подходящие свободные столы");
    expect(all.find((x) => x.key === "remind").text).toContain("вопрос дня, брифинг смены, случаи из зала, спасибо от гостей и рассадка; каждое выключается отдельно");
  });
});

describe("v85: брони в брифинге смены", () => {
  const board = { ok: true, plan: PLAN, tables: [...ROWS, { tid: "t5", status: "res", cnt: 6, name: "", rtime: "18:00" }] };
  it("блок «Брони сегодня» сразу после «Кто сегодня»; без этапа 35 или схемы — пусто", () => {
    expect(BRIEF_ORDER.slice(0, 2)).toEqual(["roster", "res"]);
    expect(BRIEF_TITLE.res).toBe("Брони сегодня");
    expect(briefRes(board)).toEqual([{ t: "18:00", name: "", cnt: 6, n: "5" }, { t: "19:30", name: "Иванов", cnt: 4, n: "3" }]);
    expect(briefRes({ ok: true, plan: null, tables: [] })).toEqual([]);
    expect(briefRes(false)).toEqual([]);
    expect(briefRes(null)).toEqual([]);
  });
  it("в тексте для Telegram — строкой: время, на кого, гостей, стол", () => {
    const b = buildBrief({ seat: board, now: new Date(2026, 9, 23) });
    expect(b.on.res).toBe(true);
    expect(briefText(b)).toContain("Брони сегодня: 18:00 6 гостей, стол 5; 19:30 Иванов, 4 гостя, стол 3");
    expect(buildBrief({ now: new Date(2026, 9, 23) }).on.res).toBe(false);
  });
});

describe("v85: этап 35 на сервере", () => {
  const sql = rd("supabase/supabase-stage35-seating.sql");
  it("схему меняет руководитель или старший; клетки — в сетке 8×30, длинный — не у правого края; числа без ошибок приведения", () => {
    expect(sql).toContain("if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;");
    expect(sql).toContain("(case when coalesce(t->>'x', '') ~ '^\\d{1,2}$' then (t->>'x')::int else 99 end) > case when t->>'shape' = 'long' then 6 else 7 end");
    expect(sql).toContain("(case when coalesce(t->>'y', '') ~ '^\\d{1,2}$' then (t->>'y')::int else 99 end) > 29");
    expect(sql).toContain("return jsonb_build_object('ok', false, 'error', 'duplicate');");
  });
  it("доска — по дню заведения (новый день — чистая доска); официанты для выбора — без хостес; время сервера", () => {
    expect(sql).toContain("ld := (now() at time zone _sa_tz(rest))::date;");
    expect(sql).toContain("in ('waiter', 'senior', 'bartender', 'senior_bartender', 'manager', 'runner', 'sommelier')");
    expect(sql).toContain("'now', now(), 'lead', coalesce((c->>'lead')::boolean, false)");
  });
  it("посадили: время посадки прежнее при правке; официанту — сообщение (новая посадка или стол передали), себе — нет", () => {
    expect(sql).toContain("case when st = 'seat' then case when old.status = 'seat' then old.since else now() end end,");
    expect(sql).toContain("if st = 'seat' and wid is not null and wid <> c->>'id' and (old.status is distinct from 'seat' or old.waiter_id is distinct from wid) and _sa_tg_ready() then");
    expect(sql).toContain("chat := _sa_tg_chat(wid, 'seat');");
    expect(sql).toContain("alter table sa_notify_prefs add column if not exists seat boolean not null default true;");
  });
  it("права: четыре функции — anon; таблицы и служебное — закрыты", () => {
    expect(sql).toContain("revoke all on table sa_floor, sa_seat from public, anon, authenticated;");
    expect(sql).toContain("grant execute on function seat_set(text, text, text, int, text, text, text) to anon, authenticated;");
    expect(sql).toContain("revoke all on function _sa_seat_json(sa_seat) from public, anon, authenticated;");
  });
});

describe("v85: метка и журнал", () => {
  it("«сборка v85», «Дополнение 398»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(8[5-9]|9\d|\d{3,})<\/span>/);   // v85 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 398 — рассадка для хостес: схема зала и столы на сегодня для всей смены (v85)");
  });
});
