// v185 (Доп. 510): «Взять номера с фото» и правило дивана.
// Владелец (21.11) прислал схему после распознавания: столы встали, стулья и диваны по сторонам — тоже, но номера
// 31–52 вместо 1–21 и 30: «Вроде бы решили предыдущую задачу, но тут вылезла новая». Все 22 номера уже были на схеме —
// в другом зале лежит прошлое распознавание того же плана.
//   • lib/seating.js — takeNumbers: распознанные столы получают номера с фото, те же номера в других залах убираются;
//   • lib/floor-scan.js — takeHint, takeSummary; scanSummary без совета «распознай в том зале»; sofaRule: диван — мест
//     столько, сколько стульев напротив, у стола только с диваном — 2; mergeSeats считает места после правила;
//   • lib/seating.js — planProblem: номер в двух залах — какие номера и в каких залах (владелец: «Пишет, что 20
//     повторяется. А повтора вообще нигде нет»); crossDupes, dropDupes — «Убрать повторы из «Зал 1»»;
//   • ui/floor-tools.jsx — TakeNumbers, DropDupes; ui/seating.jsx — кнопки под итогом и под ошибкой сохранения;
//   • supabase/functions/floor-scan (версия 5): банкетка вдоль нескольких столов, стул соседа у края картинки.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v185.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { takeNumbers, zoneTables, planProblem, crossDupes, dropDupes, isCrossDup } from "../lib/seating.js";
import { layoutScan, scanSummary, takeHint, takeSummary, sofaRule, mergeSeats, cleanScan, dropLabel, dropHint, dropSummary } from "../lib/floor-scan.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const ZONES = [{ id: "z1", name: "Зал 1" }, { id: "z2", name: "Зал 2" }];
const PLAN = (tables, items = []) => ({ v: 2, zones: ZONES, items, tables });
const nums = (p, z) => zoneTables(p, z).map((t) => t.n).sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));

describe("v185 · версия и журнал", () => {
  it("сборка v185, Дополнение 510, слова владельца, сценарий, функция заново", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(185);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 510 — .*\(v185\)/);
    const part = c.slice(c.indexOf("# Дополнение 510")).replace(/\s+/g, " ");
    expect(part).toContain("Вроде бы решили предыдущую задачу, но тут вылезла новая");
    for (const line of c.slice(c.indexOf("# Дополнение 510")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v185.mjs");
    expect(rd("supabase/README.md")).toContain("### v185 — без SQL: функцию `floor-scan` развернуть заново (версия 5)");
    expect(rd("supabase/AI-SETUP.md")).toContain("## v185: банкетка вдоль столов (`floor-scan` версии 5)");
  });
});

describe("v185 · «Взять номера с фото»", () => {
  // в «Зал 1» — прошлое распознавание (столы 15, 2, 19), «Зал 2» пустой; тот же план распознан в «Зал 2»
  const OLD = [{ id: "a1", n: "15", seats: 5, shape: "rd", x: 0, y: 0, z: "z1" }, { id: "a2", n: "2", seats: 4, shape: "long", x: 2, y: 0, z: "z1" }, { id: "a3", n: "19", seats: 8, shape: "tall", x: 6, y: 0, z: "z1" }];
  const SCAN = { plan: true, tables: [{ b: [10, 10, 20, 24], shape: "round", seats: 5, n: "15" }, { b: [40, 10, 60, 20], shape: "rect", seats: 4, n: "2" }, { b: [80, 10, 86, 60], shape: "rect", seats: 8, n: "19" }] };
  const scanned = (plan) => layoutScan(SCAN, { w: 800, h: 600 }, plan, "z2", { mode: "replace", items: true, tall: true });
  it("план владельца: все номера заняты в «Зал 1» — у этих столов новые; кнопка отдаёт им номера с фото, старые убираются", () => {
    const r = scanned(PLAN(OLD));
    expect(r.renamed.map((q) => q[0]).sort()).toEqual(["15", "19", "2"]);
    expect(nums(r.plan, "z2")).toEqual(["20", "21", "22"]);
    const t = takeNumbers(r.plan, "z2", r.renamed);
    expect(t.taken).toBe(3);
    expect(nums(t.plan, "z2")).toEqual(["2", "15", "19"]);
    expect(nums(t.plan, "z1")).toEqual([]);
    expect(t.removed).toEqual([{ z: "z1", name: "Зал 1", count: 3, empty: true }]);
    // места, форма и клетки — те же, что после распознавания
    const before = zoneTables(r.plan, "z2"), after = zoneTables(t.plan, "z2");
    expect(after.map(({ n, ...q }) => q)).toEqual(before.map(({ n, ...q }) => q));
  });
  it("в «Зал 1» остались стены или другие столы — зал не пустой; столы с другими номерами не трогаем", () => {
    const r = scanned(PLAN([...OLD, { id: "a4", n: "7", seats: 2, shape: "sq", x: 0, y: 3, z: "z1" }]));
    const t = takeNumbers(r.plan, "z2", r.renamed);
    expect(nums(t.plan, "z1")).toEqual(["7"]);
    expect(t.removed).toEqual([{ z: "z1", name: "Зал 1", count: 3, empty: false }]);
    const w = scanned(PLAN(OLD, [{ id: "w1", kind: "wall", x: 0, y: 5, x2: 3, y2: 5, z: "z1" }]));
    expect(takeNumbers(w.plan, "z2", w.renamed).removed[0].empty).toBe(false);
  });
  it("не трогаем: номер на фото у двух столов, номер есть у другого стола этого зала, стола уже нет; регистр не важен", () => {
    const P = (tables) => PLAN(tables);
    const T = (id, n, z, x) => ({ id, n, seats: 2, shape: "sq", x, y: 0, z });
    // два стола с фото «1» получили 5 и 6 — какой из них «1», не знаем
    expect(takeNumbers(P([T("a", "1", "z1", 0), T("b", "5", "z2", 0), T("c", "6", "z2", 1)]), "z2", [["1", "5"], ["1", "6"]]).taken).toBe(0);
    // в этом же зале уже есть «1» (стол остался) — не трогаем
    expect(takeNumbers(P([T("a", "1", "z2", 3), T("b", "5", "z2", 0)]), "z2", [["1", "5"]]).taken).toBe(0);
    // стол с номером 5 уже переименовали или убрали
    expect(takeNumbers(P([T("a", "1", "z1", 0), T("b", "9", "z2", 0)]), "z2", [["1", "5"]])).toEqual({ plan: P([T("a", "1", "z1", 0), T("b", "9", "z2", 0)]), taken: 0, removed: [] });
    // цепочка: «2» занят распознанным столом, который сам уходит на «15»
    const c = takeNumbers(P([T("a", "2", "z1", 0), T("b", "9", "z2", 0), T("c", "2", "z2", 1)]), "z2", [["2", "9"], ["15", "2"]]);
    expect([c.taken, nums(c.plan, "z2"), nums(c.plan, "z1")]).toEqual([2, ["2", "15"], []]);
    // «В3» на фото, «в3» в другом зале
    const v = takeNumbers(P([T("a", "в3", "z1", 0), T("b", "9", "z2", 0)]), "z2", [["В3", "9"]]);
    expect([v.taken, nums(v.plan, "z2"), nums(v.plan, "z1")]).toEqual([1, ["В3"], []]);
  });
  it("тексты: что будет под кнопкой и что вышло; пустой зал — как убрать", () => {
    const one = { taken: 22, removed: [{ z: "z1", name: "Зал 1", count: 22, empty: true }] };
    expect(takeHint(one)).toBe("У 22 столов будут номера с фото, а 22 стола с теми же номерами уберутся из «Зал 1». Передумаешь, нажми «Шаг назад».");
    expect(takeSummary(one)).toBe("Номера как на фото: у 22 столов. Из «Зал 1» убрано 22 стола с теми же номерами. «Зал 1» теперь пустой: если он не нужен, открой и нажми «Убрать зал».");
    expect(takeSummary({ taken: 21, removed: [{ z: "z1", name: "Зал 1", count: 21, empty: false }] })).toBe("Номера как на фото: у 21 стола. Из «Зал 1» убран 21 стол с теми же номерами.");
    expect(takeHint({ taken: 1, removed: [{ z: "z1", name: "Веранда", count: 1, empty: false }] })).toBe("У 1 стола будут номера с фото, а 1 стол с теми же номерами уберётся из «Веранда». Передумаешь, нажми «Шаг назад».");
    expect(takeHint({ taken: 2, removed: [] })).toBe("У 2 столов будут номера с фото. Передумаешь, нажми «Шаг назад».");
    expect(takeSummary({ taken: 5, removed: [{ z: "z1", name: "Зал 1", count: 3, empty: true }, { z: "z3", name: "Зал 3", count: 2, empty: true }] }))
      .toBe("Номера как на фото: у 5 столов. Из «Зал 1», «Зал 3» убрано 5 столов с теми же номерами. «Зал 1», «Зал 3» теперь пустые: если они не нужны, открой и нажми «Убрать зал».");
    // итог распознавания больше не советует распознавать в другом зале — для этого кнопка
    expect(scanSummary({ added: 2, renamed: [["2", "9"], ["3", "10"]] })).toBe("Расставил 2 стола по фото. Номера 2, 3 уже есть на схеме: у этих столов теперь 9, 10. Проверь номера и места. Если не так, нажми «Шаг назад».");
  });
  it("экран: кнопка под итогом, пока схема та же, что сразу после распознавания; нажатие — одним шагом, «Шаг назад» вернёт", async () => {
    const s = rd("ui/seating.jsx");
    expect(s).toContain("setTake(out.renamed && out.renamed.length ? { at: out.plan, z: zz, pairs: out.renamed } : null);");
    expect(s).toContain("const takeInfo = take && take.at === plan ? takeNumbers(plan, take.z, take.pairs) : null;");
    expect(s).toContain("{takeInfo && takeInfo.taken ? <TakeNumbers c={c} a11y={a11y} hint={takeHint(takeInfo)} onTake={takeNow} /> : null}");
    expect(s).toContain('vibrate("success"); setErr(""); commit(r.plan); setNote(takeSummary(r));');
    expect(s).toContain('const pickZone = (id) => { vibrate("light"); reset(); setNote(""); setTake(null); setAsk(false); setZone(id); };');
    const { TakeNumbers } = await import("../ui/floor-tools.jsx");
    const html = R(h(TakeNumbers, { c: { gold: "#c8a96e", sub: "#999", text: "#eee", line: "#555" }, a11y: false, hint: "У 2 столов будут номера с фото.", onTake() {} }));
    expect(html).toMatch(/<button type="button" data-take-btn=""[^>]*>Взять номера с фото<\/button>/);
    expect(html).toContain('<div data-take-hint="" style="');
    expect(html).toContain(">У 2 столов будут номера с фото.</div>");
  });
});

describe("v185 · номер в двух залах при сохранении", () => {
  // как у владельца: в «Зал 1» прошлое распознавание (столы 1–21 и 30), в «Зал 2» столы перенумерованы вручную — 1–21 и VIP
  const OLD = [...Array.from({ length: 21 }, (_, i) => String(i + 1)), "30"].map((n, i) => ({ id: "a" + i, n, seats: 2, shape: "sq", x: i % 8, y: Math.floor(i / 8), z: "z1" }));
  const NEW = [...Array.from({ length: 21 }, (_, i) => String(21 - i)), "VIP"].map((n, i) => ({ id: "b" + i, n, seats: 2, shape: "sq", x: i % 8, y: Math.floor(i / 8), z: "z2" }));
  const P = PLAN([...OLD, ...NEW]);
  it("сообщение: какие номера и в каких залах (раньше — «Номер 20 повторяется», и непонятно где)", () => {
    expect(planProblem(P)).toBe("Номера 21, 20, 19, 18, 17 и ещё 16 есть и в «Зал 1», и в «Зал 2». Номера в заведении не повторяются.");
    expect(isCrossDup(planProblem(P))).toBe(true);
    expect(planProblem(PLAN([OLD[0], { ...NEW[20], n: "1" }]))).toBe("Номер 1 есть и в «Зал 1», и в «Зал 2». Номера в заведении не повторяются.");
    const three = { ...PLAN([OLD[0], { ...NEW[20], n: "1" }, { id: "c", n: "1", seats: 2, shape: "sq", x: 0, y: 0, z: "z3" }]), zones: [...ZONES, { id: "z3", name: "Веранда" }] };
    expect(planProblem(three)).toBe("Номер 1 есть в залах «Зал 1», «Зал 2», «Веранда». Номера в заведении не повторяются.");
    // в одном зале — как раньше
    expect(planProblem(PLAN([OLD[0], { ...OLD[1], n: "1" }]))).toBe("Номер 1 повторяется");
    expect(isCrossDup("Номер 1 повторяется")).toBe(false);
  });
  it("«Убрать повторы из «Зал 1»»: в «Зал 2» всё остаётся, из «Зал 1» уходят столы с теми же номерами; 30 не трогаем", () => {
    expect(crossDupes(P, "z2").length).toBe(21);
    const r = dropDupes(P, "z2");
    expect(nums(r.plan, "z2")).toEqual(nums(P, "z2"));
    expect(nums(r.plan, "z1")).toEqual(["30"]);
    expect(r.removed).toEqual([{ z: "z1", name: "Зал 1", count: 21, empty: false }]);
    expect(planProblem(r.plan)).toBe("");
    expect(dropLabel(r)).toBe("Убрать повторы из «Зал 1»");
    expect(dropHint(r)).toBe("21 стол с теми же номерами уберётся из «Зал 1», здесь всё останется. Передумаешь, нажми «Шаг назад».");
    expect(dropSummary(r)).toBe("Из «Зал 1» убран 21 стол с теми же номерами.");
    const all = dropDupes(PLAN([...OLD.slice(0, 3), ...NEW.slice(18, 21)]), "z2");
    expect(dropSummary(all)).toBe("Из «Зал 1» убрано 3 стола с теми же номерами. «Зал 1» теперь пустой: если он не нужен, открой и нажми «Убрать зал».");
    expect(dropLabel({ removed: [{ name: "Зал 1" }, { name: "Веранда" }] })).toBe("Убрать повторы из других залов");
    expect(dropDupes(PLAN(NEW), "z2")).toEqual({ plan: PLAN(NEW), removed: [] });
  });
  it("экран: кнопка — только под этой ошибкой; нажатие — одним шагом, итог там же, внизу", () => {
    const s = rd("ui/seating.jsx");
    expect(s).toContain("const dropInfo = isCrossDup(err) && crossDupes(plan, z).length ? dropDupes(plan, z) : null;");
    expect(s).toContain("{dropInfo ? <DropDupes c={c} a11y={a11y} label={dropLabel(dropInfo)} hint={dropHint(dropInfo)} onDrop={dropNow} /> : null}");
    expect(s).toContain('vibrate("success"); setErr(""); commit(r.plan); setFixNote(dropSummary(r));');
    expect(s).toContain('{fixNote && !err ? <div role="status" data-fix-note=""');
  });
});

describe("v185 · правило дивана", () => {
  it("диван — мест столько, сколько стульев напротив; только диван — не меньше 2; диваны друг напротив друга — как сказал ИИ", () => {
    expect(sofaRule([2, -3, 0, 0])).toEqual([2, -2, 0, 0]);    // столы 1–2 владельца: 4 места, а не 5
    expect(sofaRule([3, -3, 0, 0])).toEqual([3, -3, 0, 0]);
    expect(sofaRule([0, 0, 1, -1])).toEqual([0, 0, 1, -1]);    // 6 и 4: стул и диван — 2
    expect(sofaRule([0, 0, 1, -3])).toEqual([0, 0, 1, -1]);
    expect(sofaRule([0, 0, 0, -1])).toEqual([0, 0, 0, -2]);    // 5: только диван — 2
    expect(sofaRule([0, -1, 0, 0])).toEqual([0, -2, 0, 0]);
    expect(sofaRule([-2, -3, 0, 0])).toEqual([-2, -3, 0, 0]);
    expect(sofaRule([1, -3, 0, -1])).toEqual([1, -1, 0, -1]);
    expect(sofaRule([0, 1, 0, 0])).toEqual([0, 1, 0, 0]);
  });
  it("второй проход: места стола — по сторонам после правила (и без этапа 55 тоже)", () => {
    const scan = { plan: true, tables: [{ b: [10, 10, 30, 20], shape: "rect", seats: 0, n: "1" }, { b: [40, 10, 50, 20], shape: "square", seats: 0, n: "5" }] };
    const m = mergeSeats(scan, [5, 1], [[2, -3, 0, 0], [0, 0, 0, -1]]).scan;
    expect(cleanScan(m).tables.map((t) => [t.seats, t.sd])).toEqual([[4, [2, -2, 0, 0]], [2, [0, 0, 0, -2]]]);
    const r = layoutScan(m, { w: 800, h: 600 }, null, "z1", { mode: "replace" });
    expect(r.plan.tables.map((t) => [t.n, t.seats, "sides" in t])).toEqual([["1", 4, false], ["5", 2, false]]);
  });
});

// ── функция floor-scan версии 5 ──
const ENV = { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE_KEY: "svc", OPENROUTER_API_KEY: "or-key", OPENROUTER_MODEL: "anthropic/claude-haiku-5.5" };
globalThis.Deno = { serve() {}, env: { get: (k) => ENV[k] } };
const fn = await import("../supabase/functions/floor-scan/index.ts");

describe("v185 · функция floor-scan версии 5", () => {
  it("подсказка: банкетка вдоль нескольких столов — тоже диван стола; стул соседа у края картинки — не считать", () => {
    expect(fn.FLOOR_SCAN_V).toBeGreaterThanOrEqual(5);   // v188: 6
    expect(fn.SEATS_SYSTEM).toContain("Банкетка или диван может тянуться вдоль нескольких столов подряд, например у стены: для стола в центре это тоже его диван, если он идёт вдоль его стороны, хотя бы у края картинки");
    expect(fn.SEATS_SYSTEM).toContain("Стул у края картинки, который придвинут к соседнему столу, — стул соседа, его не считай");
  });
});

describe("v185 · тексты", () => {
  it("без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["lib/floor-scan.js", "ui/floor-tools.jsx", "ui/seating.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
