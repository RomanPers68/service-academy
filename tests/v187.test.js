// v187 (Доп. 512): объединить столы, пересадить гостей, лист ожидания (этап 56).
// Вторая сборка по ответу владельца «Давай все» на вопрос «Как ещё удобнее и красивее мы можем сделать рассадку?»:
//   • supabase/supabase-stage56-join-move-wait.sql — seat_join, seat_unjoin, seat_move, wait_add, wait_done; seat_set с
//     приставленными; seat_board — seat2, fine, wait; floor_save — сдвиг ox, oy (для v188). На PostgreSQL —
//     tools/claude/sql/test56.sh;
//   • lib/seating.js — компания за несколькими столами (groupOf, groupLabel, groupSeats, groupFill), рядом ли столы,
//     что можно объединить (joinSuggest), ответы сервера (mergeRows, seat2Error), лист ожидания (waitLine, waitFits);
//     брони, сводка, официанты и «Твои столы» — с номером компании «3+4»;
//   • ui/seat-more.jsx — PickBanner, JoinChips, SheetMore, WaitList; ui/seating.jsx — перемычка и «к 1» на схеме, выбор
//     стола, карточка стола с «Пересадить» и «Приставить стол», лист ожидания.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v187.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { mainOf, joinedOf, groupOf, groupLabel, groupSeats, groupFill, isFreeT, nearT, freeNear, joinSuggest, mergeRows, seat2Error, waitLine, waitFits,
  boardMap, reservations, soonFree, summary, waiterLoad, myTablesOf, myTablesSub, tableSub } from "../lib/seating.js";
import { STAGES } from "../lib/server-check.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const NOW = Date.parse("2026-11-20T07:20:00Z");
const ago = (m) => new Date(NOW - m * 60000).toISOString();
const ANNA = ["e-anna", "Анна Смирнова"];
const row = (tid, status, cnt, extra = {}) => ({ tid, status, cnt, name: "", rtime: "", since: status === "seat" || status === "bill" ? ago(30) : null, waiter_id: null, waiter_name: "", main: null, joined: [], ...extra });
const withW = (w) => ({ waiter_id: w[0], waiter_name: w[1] });
// 1 (4) и 2 (4) рядом; 3 — длинный на 6; 4 (2) вплотную к 3; 5 — круглый на 4 у края; 6 (2) под 1 через клетку; 7 (2) — дальше
const PLAN = { v: 2, zones: [{ id: "z1", name: "Зал" }, { id: "z2", name: "Терраса" }], items: [], tables: [
  { id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t2", n: "2", seats: 4, shape: "sq", x: 1, y: 0, z: "z1" },
  { id: "t3", n: "3", seats: 6, shape: "long", x: 3, y: 0, z: "z1" }, { id: "t4", n: "4", seats: 2, shape: "sq", x: 5, y: 0, z: "z1" },
  { id: "t5", n: "5", seats: 4, shape: "rd", x: 7, y: 0, z: "z1" }, { id: "t6", n: "6", seats: 2, shape: "sq", x: 0, y: 2, z: "z1" },
  { id: "t7", n: "7", seats: 2, shape: "sq", x: 2, y: 4, z: "z1" }, { id: "t8", n: "8", seats: 6, shape: "sq", x: 0, y: 0, z: "z2" },
  { id: "t9", n: "9", seats: 6, shape: "sq", x: 1, y: 0, z: "z2" }] };
const T = (id) => PLAN.tables.find((t) => t.id === id);
// 1 и 2 вместе (7 гостей, Анна), 3 и 4 — бронь на 20:00
const ROWS = [row("t1", "seat", 7, { ...withW(ANNA), joined: ["t2"] }), row("t2", "seat", 0, { ...withW(ANNA), main: "t1" }),
  row("t3", "res", 8, { rtime: "20:00", name: "Ильины", joined: ["t4"] }), row("t4", "res", 0, { rtime: "20:00", main: "t3" })];

describe("v187 · версия, журнал, этап 56", () => {
  it("сборка v187, Дополнение 512, слова владельца, сценарии, этап в списке «Сервер»", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(187);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 512 — .*\(v187, этап 56\)/);
    const part = c.slice(c.indexOf("# Дополнение 512")).replace(/\s+/g, " ");
    expect(part).toContain("Давай все");
    expect(part).toContain("Как ещё удобнее и красивее мы можем сделать рассадку?");
    for (const line of c.slice(c.indexOf("# Дополнение 512")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    const tr = rd("tools/claude/README.md");
    expect(tr).toContain("e2e-v187.mjs");
    expect(tr).toContain("bash sql/test56.sh");
    const sr = rd("supabase/README.md");
    expect(sr).toContain("### Этап 56 (v187) — объединить столы, пересадить гостей, лист ожидания");
    expect(sr).toContain("| 65 | `supabase-stage56-join-move-wait.sql` |");
    const st = STAGES.find((s) => s.n === "56");
    expect(st).toEqual({ n: "56", file: "supabase-stage56-join-move-wait.sql", what: "Объединить столы, пересадить гостей, лист ожидания", fn: "seat_move" });
    expect(STAGES.indexOf(st)).toBe(STAGES.findIndex((s) => s.n === "55") + 1);
  });
  it("этап 56: нужен 55; функции, права, признаки доски; заменяет seat_set, floor_save и seat_board", () => {
    const q = rd("supabase/supabase-stage56-join-move-wait.sql");
    expect(q).toContain("raise exception 'Сначала этап 55 (supabase-stage55-chair-sides.sql): нужны стулья по сторонам';");
    for (const f of ["seat_join(p_token text, p_tid text, p_with jsonb)", "seat_unjoin(p_token text, p_tid text)", "seat_move(p_token text, p_from text, p_to text)",
      "wait_add(p_token text, p_name text, p_cnt int, p_note text)", "wait_done(p_token text, p_id bigint, p_how text, p_tid text)",
      "seat_set(p_token text, p_tid text, p_status text, p_cnt int, p_name text, p_rtime text, p_waiter text)", "floor_save(p_token text, p_plan jsonb)", "seat_board(p_token text)"]) {
      expect(q).toContain("create or replace function " + f);
    }
    for (const g of ["seat_join(text, text, jsonb)", "seat_unjoin(text, text)", "seat_move(text, text, text)", "wait_add(text, text, int, text)", "wait_done(text, bigint, text, text)"]) {
      expect(q).toContain("grant execute on function " + g + " to anon, authenticated;");
    }
    expect(q).toContain("'seat2', true, 'fine', true");
    expect(q).toContain("alter table sa_seat add column if not exists main text;");
    expect(q).toContain("alter table sa_seat add column if not exists joined jsonb not null default '[]'::jsonb;");
    expect(q).toContain("revoke all on table sa_wait from public, anon, authenticated;");
    expect(q).toContain("'Гостей со стола ' || fn || ' пересадили за стол ' || tn || '. Пересадил(а): '");
    // сдвиг: число от −0.5 до 0.5 с шагом 0.25; старое приложение не стирает
    expect(q).toContain("else (t->>k.f)::numeric * 4 <> round((t->>k.f)::numeric * 4) end;");
    expect(q).toContain("fine := coalesce(p_plan->'fine' = 'true'::jsonb, false);");
    expect(rd("tools/claude/sql/test56.sh")).toContain('echo "итог: $pass ✓, $fail ✗"');
  });
});

describe("v187 · компания за несколькими столами", () => {
  const map = boardMap(ROWS);
  it("главный, приставленные, номер и места компании", () => {
    expect([mainOf(map.t2), mainOf(map.t1), mainOf(null)]).toEqual(["t1", null, null]);
    expect([joinedOf(map.t1), joinedOf(map.t2), joinedOf(undefined)]).toEqual([["t2"], [], []]);
    expect(groupOf(map, "t1")).toEqual(["t1", "t2"]);
    expect(groupOf(map, "t2")).toEqual(["t1", "t2"]);   // по приставленному — тоже вся компания
    expect(groupOf(map, "t5")).toEqual(["t5"]);
    expect([groupLabel(PLAN, map, "t2"), groupLabel(PLAN, map, "t3"), groupLabel(PLAN, map, "t5")]).toEqual(["1+2", "3+4", "5"]);
    expect([groupSeats(PLAN, map, "t1"), groupSeats(PLAN, map, "t3"), groupSeats(PLAN, map, "t5")]).toEqual([8, 8, 4]);
    // главный ссылается на стол, которого в доске нет или он приставлен к другому — не считаем
    const odd = boardMap([row("t1", "seat", 2, { joined: ["t2", "t5"] }), row("t2", "seat", 0, { main: "t9" })]);
    expect(groupOf(odd, "t1")).toEqual(["t1"]);
  });
  it("свободен — только «свободен» и ни к кому не приставлен", () => {
    const m = boardMap([row("t6", "free", 0, { main: "t1" }), row("t7", "clean", 0)]);
    expect([isFreeT(m, "t6"), isFreeT(m, "t7"), isFreeT(m, "t5"), isFreeT(null, "t5")]).toEqual([false, false, true, true]);
  });
  it("гости садятся по местам: главный, потом приставленные; лишние — за главным", () => {
    expect(groupFill(PLAN, map, "t1")).toEqual({ t1: 4, t2: 3 });
    expect(groupFill(PLAN, boardMap([row("t1", "seat", 11, { joined: ["t2"] }), row("t2", "seat", 0, { main: "t1" })]), "t2")).toEqual({ t1: 7, t2: 4 });
    expect(groupFill(PLAN, boardMap([row("t3", "seat", 2)]), "t3")).toEqual({ t3: 2 });
  });
  it("рядом: по одной оси перекрываются, по другой — не дальше клетки; по диагонали — нет", () => {
    expect([nearT(T("t1"), T("t2")), nearT(T("t2"), T("t3")), nearT(T("t3"), T("t4")), nearT(T("t1"), T("t6")), nearT(T("t1"), T("t3")), nearT(T("t2"), T("t6"))])
      .toEqual([true, true, true, true, false, false]);
    expect(nearT({ shape: "tall", x: 0, y: 0 }, { shape: "sq", x: 1, y: 1 })).toBe(true);   // вертикальный — две клетки в глубину
  });
  it("свободные рядом с компанией (для «Приставить стол»): рядом с любым её столом", () => {
    const rows = [row("t1", "seat", 3, { joined: ["t2"] }), row("t2", "seat", 0, { main: "t1" }), row("t6", "clean", 0)];
    expect(freeNear(PLAN, rows, "t1")).toEqual(["t3"]);   // 2 — свой, 6 — уборка, 3 — рядом со 2
    expect(freeNear(PLAN, [], "t3")).toEqual(["t2", "t4"]);
    expect(freeNear(PLAN, [], "t99")).toEqual([]);
  });
  it("что объединить для компании: сначала пары, потом с наименьшим запасом; свой зал первым; главный — больший стол", () => {
    const rows = [row("t1", "seat", 3)];
    expect(joinSuggest(PLAN, rows, 8, "z1").map((j) => j.n + "·" + j.seats)).toEqual(["3+4·8", "3+2·10", "3+2+4·12"]);
    expect(joinSuggest(PLAN, rows, 8, "z2").map((j) => j.n)).toEqual(["8+9", "3+4", "3+2"]);
    expect(joinSuggest(PLAN, rows, 8, "z1")[0]).toEqual({ main: "t3", with: ["t4"], seats: 8, n: "3+4", z: "z1" });
    // тройки — когда пары малы
    expect(joinSuggest(PLAN, rows, 11, "z1").map((j) => j.n)).toEqual(["3+2+4", "3+5+4", "8+9"]);
    expect(joinSuggest(PLAN, rows, 40, "z1")).toEqual([]);
    expect(joinSuggest(null, [], 4, "z1")).toEqual([]);
  });
});

describe("v187 · брони, сводка, официанты, подписи", () => {
  const map = boardMap(ROWS);
  it("бронь за двумя столами — одна, с номером «3+4»; в сводке тоже одна", () => {
    expect(reservations(PLAN, ROWS)).toEqual([{ tid: "t3", n: "3+4", rtime: "20:00", name: "Ильины", cnt: 8 }]);
    const s = summary(PLAN, ROWS);
    expect([s.res, s.seat, s.guests, s.free]).toEqual([1, 2, 7, 5]);
  });
  it("официант: «стол 1+2», гостей — сколько за главным; «Твои столы: 1+2»", () => {
    expect(waiterLoad(PLAN, ROWS, [], {}).busy).toEqual([{ id: "e-anna", name: "Анна С.", tables: ["1+2"], guests: 7 }]);
    const mine = myTablesOf({ ok: true, plan: PLAN, tables: ROWS }, "e-anna");
    expect(mine).toEqual({ n: ["1+2"], guests: 7, bill: 0 });
    expect(myTablesSub(mine)).toBe("Твой стол: 1+2 · 7 гостей");
  });
  it("скоро освободится: компания со «Счётом» — по местам всех её столов", () => {
    const rows = [row("t1", "bill", 7, { joined: ["t2"] }), row("t2", "bill", 0, { main: "t1" })];
    expect(soonFree(PLAN, rows, 6)).toEqual(["t1"]);   // у одного стола 1 — 4 места, у компании — 8
    expect(soonFree(PLAN, rows, 9)).toEqual([]);
  });
  it("подпись на столе: приставленный — «к 1»; без номера главного — как раньше", () => {
    expect(tableSub(T("t2"), map.t2, NOW, "1")).toBe("к 1");
    expect(tableSub(T("t2"), map.t2, NOW)).toBe("0·30м");
    expect(tableSub(T("t1"), map.t1, NOW, "")).toBe("7·30м");
  });
  it("ответы сервера: изменённые столы заменяют прежние; ошибки — по-человечески", () => {
    expect(mergeRows([row("t1", "seat", 2), row("t2", "free", 0)], [row("t2", "seat", 0, { main: "t1" }), row("t5", "clean", 0)]).map((r) => r.tid + ":" + r.status))
      .toEqual(["t1:seat", "t2:seat", "t5:clean"]);
    expect(mergeRows(null, null)).toEqual([]);
    const tn = (id) => T(id).n;
    expect(seat2Error({ ok: false, error: "busy", tid: "t5" }, tn)).toBe("Стол 5 уже занят. Выбери свободный.");
    expect(seat2Error({ ok: false, error: "too_many" })).toBe("Больше шести столов к одному не приставить.");
    expect(seat2Error({ ok: false, error: "other_zone" })).toBe("Приставить можно стол того же зала.");
    expect(seat2Error(null)).toBe("Не сохранилось. Проверь связь.");
  });
  it("лист ожидания: строка и какие столы подойдут", () => {
    expect(waitLine({ name: " Петровы ", cnt: 2, at: ago(15) }, NOW)).toBe("Петровы · 2 гостя · ждут 15 мин");
    expect(waitLine({ name: "", cnt: 5, at: ago(75) }, NOW)).toBe("Без имени · 5 гостей · ждут 1 ч 15 мин");
    expect(waitFits(PLAN, ROWS, { cnt: 2 })).toEqual({ free: ["6", "7", "5"], soon: [] });
    expect(waitFits(PLAN, [...ROWS.filter((r) => r.tid !== "t1" && r.tid !== "t2"), row("t1", "bill", 3)], { cnt: 7 })).toEqual({ free: [], soon: [] });
    expect(waitFits(PLAN, [row("t8", "seat", 2), row("t9", "bill", 4)], { cnt: 6 })).toEqual({ free: ["3"], soon: ["9"] });
  });
});

describe("v187 · схема", () => {
  it("перемычка между столами компании, «к 1» на приставленном, гости по стульям обоих, полоска только у главного", async () => {
    const { Floor } = await import("../ui/seating.jsx");
    const html = R(h(Floor, { a11y: false, plan: PLAN, zone: "z1", map: boardMap(ROWS), now: NOW }));
    expect(html).toContain('data-link="t1:t2"');
    expect(html).toContain('data-link="t3:t4"');
    expect((html.match(/data-link="/g) || []).length).toBe(2);
    const part = (id) => { const i = html.indexOf('data-table="' + id + '"'); return html.slice(i, html.indexOf("</button>", i)); };
    expect(part("t2")).toContain(">к 1</span>");
    expect(part("t4")).toContain(">к 3</span>");
    expect((part("t1").match(/data-chair="on"/g) || []).length).toBe(4);
    expect((part("t2").match(/data-chair="on"/g) || []).length).toBe(3);
    expect(part("t1")).toContain("data-sit-bar");
    expect(part("t2")).not.toContain("data-sit-bar");
    expect(part("t2")).toContain('aria-label="Стол 2, 4 места: приставлен к столу 1, гости"');
    expect(part("t1")).toMatch(/aria-label="Стол 1, 4 места: гости, гостей 7, сидят 30 мин, официант Анна С\., вместе со столом 2"/);
    expect(part("t3")).toContain('aria-label="Стол 3, 6 мест: бронь, на 20:00, вместе со столом 4"');
  });
  it("перемычка: у соседей по горизонтали — между краями столешниц, а не через их середину", async () => {
    const { Floor } = await import("../ui/seating.jsx");
    const html = R(h(Floor, { a11y: false, plan: PLAN, zone: "z1", map: boardMap(ROWS), now: NOW }));
    const m = /data-link="t3:t4" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/.exec(html);
    expect(m).not.toBeNull();
    const [x1, y1, x2, y2] = m.slice(1).map(Number);
    expect(y1).toBe(y2);
    expect(x2).toBeGreaterThan(x1);
    // без ширины (сервер) клетка 0 — линия вырождается в точку, но атрибуты на месте; в браузере — e2e-v187
    expect(x2 - x1).toBeLessThan(1000);
  });
  it("в редакторе ни перемычек, ни «к 1»", async () => {
    const { Floor } = await import("../ui/seating.jsx");
    const ed = R(h(Floor, { a11y: false, plan: PLAN, zone: "z1", map: boardMap(ROWS), now: NOW, edit: true }));
    expect(ed).not.toContain("data-link");
    expect(ed).not.toContain(">к 1</span>");
  });
});

describe("v187 · карточка стола", () => {
  const map = boardMap(ROWS);
  const base = { a11y: false, staff: [], now: NOW, onSave: async () => true, onClose: () => {}, onMove: () => {}, onJoin: () => {}, onUnjoin: () => {} };
  it("с гостями и сервером этапа 56 — «Пересадить», «Приставить стол», с кем вместе и отделить", async () => {
    const { TableSheet } = await import("../ui/seating.jsx");
    const s = R(h(TableSheet, { ...base, t: T("t1"), row: map.t1, seat2: true, group: [T("t2")] }));
    expect(s).toContain("data-sheet-more");
    expect(s).toMatch(/data-sheet-move=""[^>]*>Пересадить<\/button>/);
    expect(s).toMatch(/data-sheet-join=""[^>]*>Приставить стол<\/button>/);
    expect(s).toContain('data-sheet-unjoin="t2"');
    expect(s).toContain('aria-label="Отделить стол 2"');
    expect(s).toContain("Вместе со столом 2: всего 8 мест.");
    expect(s).toContain("Гости, официант и время посадки переедут за другой стол, а этот пойдёт на уборку.");
  });
  it("бронь — «Перенести бронь»; без этапа 56, у свободного и на уборке — без этих кнопок", async () => {
    const { TableSheet } = await import("../ui/seating.jsx");
    expect(R(h(TableSheet, { ...base, t: T("t3"), row: map.t3, seat2: true, group: [T("t4")] }))).toMatch(/data-sheet-move=""[^>]*>Перенести бронь<\/button>/);
    expect(R(h(TableSheet, { ...base, t: T("t1"), row: map.t1, seat2: false }))).not.toContain("data-sheet-more");
    expect(R(h(TableSheet, { ...base, t: T("t5"), row: row("t5", "free", 0), seat2: true }))).not.toContain("data-sheet-more");
    expect(R(h(TableSheet, { ...base, t: T("t5"), row: row("t5", "clean", 0), seat2: true }))).not.toContain("data-sheet-more");
  });
  it("посадить за объединённые и из листа ожидания: строка над статусами, гостей сразу сколько нужно", async () => {
    const { TableSheet } = await import("../ui/seating.jsx");
    const j = R(h(TableSheet, { ...base, t: T("t3"), row: row("t3", "free", 0), seat2: true, joinWith: [T("t4")], cnt0: 8 }));
    expect(j).toContain("Посадим за столы 3 и 4: всего 8 мест. Столы приставим.");
    expect(j).toMatch(/data-cnt=""[^>]*>8<\/span>/);   // не урезано до 6 мест стола 3
    const w = R(h(TableSheet, { ...base, t: T("t2"), row: row("t2", "free", 0), seat2: true, fromWait: { id: 9, name: "Ильины", cnt: 4 }, cnt0: 4 }));
    expect(w).toContain("Из листа ожидания: Ильины, 4 гостя.");
    expect(w).toMatch(/data-cnt=""[^>]*>4<\/span>/);
    const w0 = R(h(TableSheet, { ...base, t: T("t6"), row: row("t6", "free", 0), seat2: true, fromWait: { id: 9, name: "", cnt: 1 }, cnt0: 1 }));
    expect(w0).toContain("Из листа ожидания: без имени, 1 гость.");
  });
});

describe("v187 · подсказка, объединить, лист ожидания", () => {
  const c = { gold: "#D2A85A", text: "#EFE4C8", sub: "#A99A7C", line: "rgba(214,178,102,0.22)", red: "#E08A7A", field: "rgba(0,0,0,0.25)", frost: {} };
  it("подсказка выбора с «Отмена»; «Можно объединить» — номер и места, другой зал — с названием", async () => {
    const { PickBanner, JoinChips } = await import("../ui/seat-more.jsx");
    const b = R(h(PickBanner, { c, text: "Какой стол приставить к столу 1?", onCancel: () => {} }));
    expect(b).toContain('data-pick-banner="" role="status"');
    expect(b).toContain(">Какой стол приставить к столу 1?</span>");
    expect(b).toMatch(/data-pick-cancel=""[^>]*>Отмена<\/button>/);
    const list = [{ main: "t3", with: ["t4"], seats: 8, n: "3+4", z: "z1" }, { main: "t8", with: ["t9"], seats: 12, n: "8+9", z: "z2" }];
    const j = R(h(JoinChips, { c, a11y: false, list, zName: (id) => (id === "z2" ? "Терраса" : "Зал"), here: "z1", onPick: () => {} }));
    expect(j).toContain(">Можно объединить:</span>");
    expect(j).toContain(">3+4 · 8 мест</button>");
    expect(j).toContain(">8+9 · 12 мест · Терраса</button>");
    expect(R(h(JoinChips, { c, list: [], onPick: () => {} }))).toBe("");
  });
  it("лист: строка, заметка, свободные столы, «Посадить» и «Ушли»; пустой — совет; форма записи", async () => {
    const { WaitList } = await import("../ui/seat-more.jsx");
    const waits = [{ id: 7, name: "Петровы", cnt: 2, note: "у бара", at: ago(15) }, { id: 8, name: "", cnt: 12, note: "", at: ago(3) }];
    const html = R(h(WaitList, { c, a11y: false, plan: PLAN, rows: ROWS, waits, now: NOW, form: false, onForm: () => {}, onAdd: async () => true, onSeat: () => {}, onLeft: () => {} }));
    expect(html).toContain(">Лист ожидания</div>");
    expect(html).toContain("Петровы · 2 гостя · ждут 15 мин");
    expect(html).toContain(">у бара</div>");
    expect(html).toContain("Свободны столы 6, 7, 5");
    expect(html).toContain("Без имени · 12 гостей · ждут 3 мин");
    expect(html).toContain("Подходящих свободных столов пока нет");
    expect(html).toContain('data-wait-seat="7"');
    expect(html).toContain('data-wait-left="8"');
    expect(html).toMatch(/data-wait-add=""[^>]*>＋ Записать<\/button>/);
    const empty = R(h(WaitList, { c, plan: PLAN, rows: [], waits: [], now: NOW, form: false, onForm: () => {}, onAdd: async () => true, onSeat: () => {}, onLeft: () => {} }));
    expect(empty).toContain("Нет свободного стола? Запиши гостей: смена увидит, кто ждёт и сколько, а когда стол освободится, приложение подскажет какой.");
    const form = R(h(WaitList, { c, plan: PLAN, rows: [], waits: [], now: NOW, form: true, onForm: () => {}, onAdd: async () => true, onSeat: () => {}, onLeft: () => {} }));
    expect(form).toContain("data-wait-form");
    expect(form).toMatch(/data-wait-cnt=""[^>]*>2<\/span>/);
    expect(form).toContain('placeholder="Например: у бара, с коляской"');
    expect(form).not.toContain("data-wait-add");
  });
});

describe("v187 · экран", () => {
  it("выбор стола: свой — нельзя, занятый — нельзя, другой зал для приставить — нельзя; приставленный открывает главный", () => {
    const s = code(rd("ui/seating.jsx"));
    expect(s).toContain('if (pick.tid && groupOf(map, pick.tid).includes(t.id)) { setMsg("Это стол той же компании. Выбери другой."); return; }');
    expect(s).toContain('if (!isFreeT(map, t.id)) { setMsg("Стол " + t.n + " занят. Выбери свободный."); return; }');
    expect(s).toContain('if (zoneOfX(plan, t) !== zoneOfX(plan, tById(pick.tid))) { setMsg("Приставить можно стол того же зала."); return; }');
    expect(s).toContain("setSel(r.main && map[r.main] ? r.main : t.id);");
    expect(s).toContain("hi={pick ? pickHi : party ? hi : hiW}");
    expect(s).toContain("onTable={onTable}");
  });
  it("после «Посадить»: приставить столы компании, отметить «посадили» в листе; ответ сервера — все изменённые столы", () => {
    const s = code(rd("ui/seating.jsx"));
    expect(s).toContain("setSt((s) => ({ ...s, tables: mergeRows(s.tables, r.tables || [r.table]) }));");
    expect(s).toContain('if (p && p.main === t.id && p.with && p.with.length && (f.status === "seat" || f.status === "res")) doJoin(t.id, p.with,');
    expect(s).toContain('rpc("wait_done", { p_token: saToken(), p_id: p.wait.id, p_how: "seat", p_tid: t.id })');
    expect(s).toContain("React.useEffect(() => { if (!sel) setPend(null); }, [sel]);");
    expect(s).toContain("const joins = seat2 && party && !hi.length ? joinSuggest(plan, rows, party, z) : [];");
    expect(s).toContain("{seat2 ? <WaitList ");
    expect(s).toContain("{st.lead && !seat2 ? <div data-seat2-hint=\"\"");
  });
  it("сообщения после пересадки, объединения и отделения", () => {
    const s = rd("ui/seating.jsx");
    expect(s).toContain('" пересадили за стол " + tnum(to) + ". " + (g.length > 1 ? "Столы " + listN(g) + " на уборке." : "Стол " + listN(g) + " на уборке.")');
    expect(s).toContain('" приставили к столу " + tnum(main) + ": вместе " + n + " " + pl(n, "место", "места", "мест") + "."');
    expect(s).toContain('setMsg("Стол " + tnum(tid) + " отделили, " + (wasBusy ? "он на уборке." : "он свободен."));');
  });
});

describe("v187 · тексты", () => {
  it("без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["lib/seating.js", "ui/seat-more.jsx", "ui/seating.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
