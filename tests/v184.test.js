// v184 (Доп. 509): стулья по сторонам и диваны — как на фото, при распознавании.
// Владелец (20.11) на предложение, чтобы ИИ сам расставлял стулья по сторонам: «Да, давай сделаем так».
//   • supabase/functions/floor-scan (версия 4): второй проход по каждой картинке — chairs и sofa по сторонам (сверху,
//     справа, снизу, слева); приложению — seats и sides [верх, низ, лево, право] (минус — диван), как хранит схема;
//   • lib/floor-scan.js — scanSeatsFull, mergeSeats(…, sides) кладёт стороны в стол (sd), layoutScan(…, { sides })
//     поворачивает их вместе с фото и ставит, если подходят к форме стола; итог — у скольких столов;
//   • ui/seating.jsx — с сервером, где этап 55, стулья по сторонам с фото попадают на схему.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v184.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { cleanScan, mergeSeats, layoutScan, scanSummary, scanSeats, scanSeatsFull, okSd } from "../lib/floor-scan.js";
import { seatsOfSides } from "../lib/floor-art.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

describe("v184 · версия и журнал", () => {
  it("сборка v184, Дополнение 509, слова владельца, сценарий, функция заново", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(184);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 509 — .*\(v184\)/);
    const part = c.slice(c.indexOf("# Дополнение 509")).replace(/\s+/g, " ");
    expect(part).toContain("Да, давай сделаем так");
    for (const line of c.slice(c.indexOf("# Дополнение 509")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v184.mjs");
    expect(rd("supabase/README.md")).toContain("### v184 — без SQL: функцию `floor-scan` развернуть заново (версия 4)");
    expect(rd("supabase/AI-SETUP.md")).toContain("## v184: стулья по сторонам с фото (`floor-scan` версии 4)");
  });
});

// ── план владельца: рамки, номера и места (после v182) и стулья по сторонам с фото ──
// sd — [верх, низ, лево, право], минус — диван: у 20 и 21 стул снизу, у 19, 18 и 30 стулья слева и справа, у 6 и 4
// стул слева и диван справа, у 5 только диван, у 1–3 стулья сверху и диван снизу; круглые — по четвертям.
const T = (n, shape, b, sd) => ({ b, shape, seats: seatsOfSides(sd), n, sd });
const OWNER = [
  T("20", "square", [9.5, 3.5, 15.5, 11.8], [0, 1, 0, 0]), T("21", "square", [15.7, 3.5, 21.8, 11.8], [0, 1, 0, 0]),
  T("19", "rect", [61.5, 5.5, 67.7, 31], [0, 0, 4, 4]), T("18", "rect", [61.6, 31.8, 67.7, 56.7], [0, 0, 4, 4]),
  T("17", "round", [16.2, 29.7, 22.4, 38.3], [1, 2, 1, 1]), T("16", "round", [26.3, 30.2, 32.5, 38.8], [1, 2, 1, 1]),
  T("15", "round", [37.2, 29.7, 43.4, 38.3], [1, 2, 1, 1]), T("14", "round", [48, 29.4, 54.2, 38], [1, 2, 1, 1]),
  T("11", "round", [19, 50, 25, 58.4], [1, 1, 1, 0]), T("12", "round", [32, 50.8, 38.2, 59.2], [0, 1, 1, 1]),
  T("13", "square", [45.4, 50.6, 51.6, 59], [0, 0, 1, 1]), T("10", "round", [19.6, 65.8, 25.8, 74.2], [1, 2, 1, 1]),
  T("9", "round", [28.5, 65.4, 34.7, 73.8], [2, 2, 1, 1]), T("8", "round", [40.3, 65.3, 46.3, 73.3], [2, 2, 1, 1]),
  T("7", "round", [49.6, 65.1, 55.6, 73.5], [1, 2, 1, 1]), T("6", "square", [60.8, 61.2, 66.8, 69.5], [0, 0, 1, -1]),
  T("5", "square", [60.7, 71, 66.6, 79], [0, 0, 0, -2]), T("4", "square", [60.8, 81.5, 66.8, 89.5], [0, 0, 1, -1]),
  T("1", "rect", [15.7, 84.7, 25.8, 92.8], [2, -2, 0, 0]), T("2", "rect", [27.6, 84.5, 37.7, 92.8], [2, -2, 0, 0]),
  T("3", "rect", [44.3, 84.5, 58.5, 92.5], [3, -3, 0, 0]), T("30", "rect", [73.6, 58.2, 83.6, 94.5], [0, 0, 6, 6]),
];
const PASS1 = { ok: true, v: 4, plan: true, box: [3, 1, 90, 99], tables: OWNER.map(({ sd, ...t }) => t), bars: [], doors: [], note: "" };
const SEATS = OWNER.map((t) => t.seats), SIDES = OWNER.map((t) => t.sd);
const IMG = { w: 2576, h: 1882 };
const turn = ([u, b, l, r]) => [l, r, b, u];

describe("v184 · стулья по сторонам с фото на схему", () => {
  it("стороны второго прохода кладутся в стол (sd), только где второй знает места; мусор — нет", () => {
    expect([okSd([0, 0, 1, -1]), okSd([0, 0, 0, 0]), okSd([1.5, 0, 0, 0]), okSd([21, 0, 0, 0]), okSd([10, 10, 1, 0]), okSd(null)]).toEqual([true, false, false, false, false, false]);
    const { scan } = mergeSeats(PASS1, SEATS, SIDES);
    expect(cleanScan(scan).tables.map((t) => t.sd)).toEqual(SIDES);
    const half = mergeSeats(PASS1, SEATS.map((v, i) => (i === 0 ? null : v)), SIDES.map((v, i) => (i === 1 ? [0, 0, 0, 0] : v))).scan;
    expect(cleanScan(half).tables.slice(0, 3).map((t) => t.sd || null)).toEqual([null, null, [0, 0, 4, 4]]);
    expect(cleanScan(mergeSeats(PASS1, SEATS).scan).tables.every((t) => !("sd" in t))).toBe(true);
  });
  it("план владельца: у квадратных и длинных — стулья и диваны как на фото, места — всего по сторонам; у круглых — по местам", () => {
    const scan = mergeSeats(PASS1, SEATS, SIDES).scan;
    const r = layoutScan(scan, IMG, null, "z1", { mode: "replace", items: true, tall: true, sides: true });
    expect(r.added).toBe(22);
    const by = Object.fromEntries(r.plan.tables.map((t) => [t.n, t]));
    const want = (n) => { const sd = OWNER.find((q) => q.n === n).sd; return r.rot ? turn(sd) : sd; };
    for (const n of ["20", "21", "19", "18", "13", "6", "5", "4", "1", "2", "3", "30"]) {
      expect(by[n].sides, n).toEqual(want(n));
      expect(by[n].seats, n).toBe(seatsOfSides(by[n].sides));
    }
    for (const n of ["17", "16", "15", "14", "11", "12", "10", "9", "8", "7"]) {
      expect(by[n].shape, n).toBe("rd");
      expect(by[n], n).not.toHaveProperty("sides");
      expect(by[n].seats, n).toBe(OWNER.find((q) => q.n === n).seats);
    }
    expect([by["6"].seats, by["5"].seats, by["1"].seats, by["3"].seats, by["19"].seats, by["30"].seats]).toEqual([2, 2, 4, 6, 8, 12]);
    expect(r.sided).toBe(12);
    expect(scanSummary(r)).toMatch(/^Расставил 22 стола по фото\. Стулья и диваны по сторонам расставил как на фото: у 12 столов\./);
  });
  it("без этапа 55 (sides: false) — сторон нет, места те же", () => {
    const scan = mergeSeats(PASS1, SEATS, SIDES).scan;
    const r = layoutScan(scan, IMG, null, "z1", { mode: "replace", items: true, tall: true });
    expect(r.plan.tables.every((t) => !("sides" in t))).toBe(true);
    expect(r.sided).toBe(0);
    expect(scanSummary(r)).not.toContain("по сторонам");
    expect(r.plan.tables.find((t) => t.n === "6").seats).toBe(2);
  });
  it("фото повёрнуто на сетке — стороны тоже: стул сверху на фото — справа на схеме; не подходит к форме — по местам", () => {
    const tables = [];
    [60, 200, 340].forEach((y) => { for (let i = 0; i < 10; i++) { const x = 40 + i * 112; tables.push({ b: [x / 12, y / 5, (x + 70) / 12, (y + 90) / 5], shape: "square", seats: 3, n: "", sd: [1, 0, 0, -2] }); } });
    const r = layoutScan({ plan: true, box: [0.8, 2, 99.2, 98], tables }, { w: 1200, h: 500 }, null, "z1", { sides: true });
    expect(r.rot).toBe(90);
    expect(r.plan.tables.every((t) => JSON.stringify(t.sides) === JSON.stringify([0, -2, 0, 1]))).toBe(true);   // диван справа → снизу, стул сверху → справа
    // длинный по фото, на сетке — квадратный (рядом нет места): у квадрата 8 на сторону не бывает — по местам
    const one = layoutScan({ plan: true, tables: [{ b: [10, 10, 40, 20], shape: "rect", seats: 8, n: "1", sd: [4, 4, 0, 0] }] }, { w: 800, h: 600 }, null, "z1", { sides: true });
    const t = one.plan.tables[0];
    expect(t.shape === "long" ? JSON.stringify(t.sides) === "[4,4,0,0]" : !("sides" in t)).toBe(true);
  });
  it("запрос второго прохода: seats и sides; функция прежней версии (без sides) — sides пустые; scanSeats — как раньше", async () => {
    const ok = (data) => Promise.resolve({ ok: true, status: 200, json: async () => data });
    const crops = ["data:image/jpeg;base64,AAA", "data:image/jpeg;base64,BBB", "data:image/jpeg;base64,CCC"];
    const reply = { ok: true, v: 4, mode: "seats", seats: [2, 4, null], sides: [[0, 0, 1, -1], [2, -2, 0, 0, 1], null] };
    expect(await scanSeatsFull(crops, { url: "u", fetchImpl: () => ok(reply) })).toEqual({ seats: [2, 4, null], sides: [[0, 0, 1, -1], null, null] });
    expect(await scanSeats(crops, { url: "u", fetchImpl: () => ok(reply) })).toEqual([2, 4, null]);
    expect(await scanSeatsFull(crops, { url: "u", fetchImpl: () => ok({ ok: true, v: 3, mode: "seats", seats: [5, 4, 2] }) })).toEqual({ seats: [5, 4, 2], sides: [null, null, null] });
    expect(await scanSeatsFull(crops, { url: "u", fetchImpl: () => ok({ ok: false, error: "auth" }) })).toBe(null);
  });
  it("редактор: стороны — только с этапом 55; в раскладку — с признаком sides", () => {
    const s = rd("ui/seating.jsx");
    expect(s).toContain("const full = await tableCrops(r0, boxes, 224, seatMasks(res)).then((crops) => scanSeatsFull(crops, opts)).catch(() => null);");
    expect(s).toContain("if (full) scan = mergeSeats(res, full.seats, sidesOn ? full.sides : null).scan;");
    expect(s).toContain("const out = layoutScan(scan, ai, planRef.current, zz, { mode, items: floor2, tall, sides: sidesOn });");
  });
});

// ── функция floor-scan версии 4 на стенде ──
const ENV = { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE_KEY: "svc", OPENROUTER_API_KEY: "or-key", OPENROUTER_MODEL: "anthropic/claude-haiku-5.5" };
globalThis.Deno = { serve() {}, env: { get: (k) => ENV[k] } };
const fn = await import("../supabase/functions/floor-scan/index.ts");
let NET = { who: null, bodies: [], replies: [] };
const send = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data, text: async () => JSON.stringify(data) });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith("/rest/v1/rpc/whoami")) return send(NET.who ? { ok: true, employee: NET.who } : { ok: false });
  if (u.includes("/rest/v1/ai_usage")) return send([{ count: 0 }]);
  if (u === "https://openrouter.ai/api/v1/models") return send({ data: [] });
  if (u === "https://openrouter.ai/api/v1/chat/completions") {
    const body = JSON.parse(init.body);
    NET.bodies.push(body);
    return send({ model: body.model, choices: [{ message: { content: NET.replies.length ? NET.replies.shift() : "{}" } }] });
  }
  return send(null, 404);
};
const CROP = "data:image/jpeg;base64," + "B".repeat(300);
const call = async (payload) => { const res = await fn.handle(new Request("https://fn.test/floor-scan", { method: "POST", body: JSON.stringify({ token: "tok", ...payload }) })); return { status: res.status, ...(await res.json()) }; };

describe("v184 · функция floor-scan версии 4", () => {
  beforeEach(() => { NET = { who: { id: "e1", position: "manager", is_admin: false }, bodies: [], replies: [] }; });
  it("ответ по сторонам → seats и sides [верх, низ, лево, право]; диван — минус; ничего — null; больше 20 — null", () => {
    expect(fn.FLOOR_SCAN_V).toBe(4);
    const o = { tables: [
      { chairs: [2, 0, 0, 0], sofa: [0, 0, 2, 0] },          // два стула сверху, диван снизу
      { chairs: [0, 0, 0, 1], sofa: [0, 1, 0, 0] },          // стул слева, диван справа
      { chairs: [0, 4, 0, 4], sofa: [0, 0, 0, 0] },          // вертикальный длинный
      null,
      { chairs: [0, 0, 0, 0], sofa: [0, 0, 0, 0] },
      { chairs: [8, 8, 8, 8], sofa: [0, 0, 0, 0] },
      { chairs: [1, "2", -1, 0.4], sofa: [0, 3, 0, 0] },     // мусор → 0; диван и стулья на одной стороне — диван
    ] };
    expect(fn.cleanSides(o, 8)).toEqual({
      seats: [4, 2, 8, null, null, null, 4, null],
      sides: [[2, -2, 0, 0], [0, 0, 1, -1], [0, 0, 4, 4], null, null, null, [1, 0, 0, -3], null] });
    expect(fn.cleanSeats(o, 3)).toEqual([4, 2, 8]);
    expect(fn.cleanSides({ seats: [4, 5] }, 2)).toEqual({ seats: [4, 5], sides: [null, null] });
  });
  it("подсказка: по каждой картинке стулья и диван по сторонам, примеры; ответ функции — seats и sides; в лимит не идёт", async () => {
    const S = fn.SEATS_SYSTEM;
    expect(S).toContain('Запись — {"chairs":[сверху, справа, снизу, слева],"sofa":[сверху, справа, снизу, слева]}');
    expect(S).toContain('два стула сверху и диван снизу — {"chairs":[2,0,0,0],"sofa":[0,0,2,0]}');
    expect(S).toContain('стул слева и диван справа — {"chairs":[0,0,0,1],"sofa":[0,1,0,0]}');
    expect(S).toContain("У круглого стола стороны условные: раздели стулья по четвертям");
    expect(S).toContain("Номера на столах закрыты пятном цвета стола");
    NET.replies.push('{"tables":[{"chairs":[2,0,0,0],"sofa":[0,0,2,0]},null]}');
    const r = await call({ mode: "seats", crops: [CROP, CROP] });
    expect(r).toEqual({ status: 200, ok: true, v: 4, mode: "seats", seats: [4, null], sides: [[2, -2, 0, 0], null], model: "anthropic/claude-haiku-5.5" });
    expect(NET.bodies[0].max_tokens).toBe(Math.ceil((400 + 30 * 2) * 1.35) + 4000);
  });
});

describe("v184 · тексты", () => {
  it("без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["lib/floor-scan.js", "ui/seating.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
