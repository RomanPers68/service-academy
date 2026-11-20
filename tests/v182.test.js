// v182 (Доп. 507): места по стульям, а не по номеру на столе.
// Владелец (20.11) прислал план из кассы и схему после распознавания: «Он не ориентируется по количеству на фото.
// Делает совсем неправильно», «Он нумерацию столов определил как количество гостей». Про диваны: «1-2 столы по
// 4 человека, на против стульев диван где могут разместиться 2-3 человека», 3 — «В основном там 6 человек», 4–6 — по 2.
//   • supabase/functions/floor-scan (версия 3): число на столе — номер (n), места — по стульям; подпись мест — лишь с
//     явным «м.», «мест», «×», «p»; диван — столько мест, сколько стульев напротив, у стола только с диваном — 2;
//   • lib/floor-photo.js — maskOf, tableCrops закрывает номера на картинках второго прохода цветом стола;
//   • lib/floor-scan.js — seatMasks; cleanScan: места, переписанные из номеров (три стола и больше), — не знаем;
//     mergeSeats: номера, прочитанные первым проходом как места, — снова номера; place/scanSummary: номер с плана уже
//     есть на схеме — какой стол получил вместо него;
//   • ui/seating.jsx — tableCrops(r0, boxes, 224, seatMasks(res)).
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v182.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { cleanScan, mergeSeats, seatMasks, seatBoxes, layoutScan, scanSummary } from "../lib/floor-scan.js";
import { maskOf, cropOf } from "../lib/floor-photo.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

describe("v182 · версия и журнал", () => {
  it("сборка v182, Дополнение 507, слова владельца, сценарий, функция заново", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(182);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 507 — .*\(v182\)/);
    const part = c.slice(c.indexOf("# Дополнение 507")).replace(/\s+/g, " ");
    for (const w of ["Он не ориентируется по количеству на фото. Делает совсем неправильно", "Он нумерацию столов определил как количество гостей",
      "1-2 столы по 4 человека, на против стульев диван где могут разместиться 2-3 человека"]) expect(part, w).toContain(w);
    for (const line of c.slice(c.indexOf("# Дополнение 507")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v182.mjs");
    expect(rd("supabase/README.md")).toContain("### v182 — без SQL: функцию `floor-scan` развернуть заново (версия 3)");
    expect(rd("supabase/AI-SETUP.md")).toContain("## v182: номер на столе — не места (`floor-scan` версии 3)");
  });
});

// ── план владельца: что вернул первый проход и что насчитал второй ──
// Рамки — по фото из кассы (проценты), как их видит модель. Первый проход: у пяти столов номер прочитан, у остальных
// номер ушёл в места («15» → 15 мест), у стола 30 — «30 мест» (больше 20, функция отбросила).
const T = (n, shape, b, seats, read = true) => ({ b, shape, seats, n: read ? n : "", truth: n });
const OWNER = [
  T("20", "square", [9.5, 3.5, 15.5, 11.8], 2), T("21", "square", [15.7, 3.5, 21.8, 11.8], 2),
  T("19", "rect", [61.5, 5.5, 67.7, 31], 19, false), T("18", "rect", [61.6, 31.8, 67.7, 56.7], 18, false),
  T("17", "round", [16.2, 29.7, 22.4, 38.3], 5), T("16", "round", [26.3, 30.2, 32.5, 38.8], 5),
  T("15", "round", [37.2, 29.7, 43.4, 38.3], 15, false), T("14", "round", [48, 29.4, 54.2, 38], 14, false),
  T("11", "round", [19, 50, 25, 58.4], 11, false), T("12", "round", [32, 50.8, 38.2, 59.2], 12, false),
  T("13", "square", [45.4, 50.6, 51.6, 59], 13, false), T("10", "round", [19.6, 65.8, 25.8, 74.2], 10, false),
  T("9", "round", [28.5, 65.4, 34.7, 73.8], 9, false), T("8", "round", [40.3, 65.3, 46.3, 73.3], 8, false),
  T("7", "round", [49.6, 65.1, 55.6, 73.5], 7, false), T("6", "square", [60.8, 61.2, 66.8, 69.5], 6, false),
  T("5", "square", [60.7, 71, 66.6, 79], 5, false), T("4", "square", [60.8, 81.5, 66.8, 89.5], 4, false),
  T("1", "rect", [15.7, 84.7, 25.8, 92.8], 4), T("2", "rect", [27.6, 84.5, 37.7, 92.8], 2, false),
  T("3", "rect", [44.3, 84.5, 58.5, 92.5], 3, false), T("30", "rect", [73.6, 58.2, 83.6, 94.5], null, false),
];
// по стульям (у 1–6 — со слов владельца: стулья и диван напротив)
const COUNT = { 20: 1, 21: 1, 19: 8, 18: 8, 17: 5, 16: 5, 15: 5, 14: 5, 11: 3, 12: 3, 13: 2, 10: 5, 9: 6, 8: 6, 7: 5, 6: 2, 5: 2, 4: 2, 1: 4, 2: 4, 3: 6, 30: 12 };
const PASS1 = { ok: true, v: 3, plan: true, box: [3, 1, 90, 99], tables: OWNER.map(({ truth, ...t }) => t), bars: [], doors: [], note: "" };
const PASS2 = OWNER.map((t) => COUNT[t.truth]);
const IMG = { w: 2576, h: 1882 };

describe("v182 · номер на столе — не места", () => {
  it("закрыть номер: у круглого — эллипс 76% поперечника, у прочих — середина без 14% с краёв; цвет — по точкам вокруг надписи", () => {
    const r = maskOf([10, 20, 30, 40], true);
    expect(r.e).toEqual([20, 30, 7.6, 7.6]);
    expect(r.r).toBe(undefined);
    expect(r.pts.length).toBe(8);
    for (const [x, y] of r.pts) {
      const d = Math.hypot((x - 20) / 20, (y - 30) / 20);
      expect(d, "точка на столешнице").toBeLessThan(0.45);   // круг стола — 0,5
      expect(d, "точка вне пятна").toBeGreaterThan(0.38);
    }
    const q = maskOf([10, 20, 50, 30], false);
    expect(q.e).toBe(undefined);
    q.r.forEach((v, i) => expect(v).toBeCloseTo([15.6, 21.4, 44.4, 28.6][i], 6));
    for (const [x, y] of q.pts) {
      expect(x >= 10 && x <= 50 && y >= 20 && y <= 30, "на столе").toBe(true);
      expect(x < q.r[0] || x > q.r[2] || y < q.r[1] || y > q.r[3], "вне пятна").toBe(true);
    }
  });
  it("закрываются все столы ответа (и соседние в картинке), круглые — эллипсом; вырезать — по-прежнему до 40", () => {
    const m = seatMasks(PASS1);
    expect(m.length).toBe(22);
    expect(m[4]).toEqual({ b: [16.2, 29.7, 22.4, 38.3], round: true });
    expect(m[0].round).toBe(false);
    const many = { tables: Array.from({ length: 55 }, (_, i) => ({ b: [i, 0, i + 1, 1] })) };
    expect(seatMasks(many).length).toBe(55);
    expect(seatBoxes(many).length).toBe(40);
    expect(seatMasks(null)).toEqual([]);
    // стол 21 попадает в картинку стола 20 (стоят вплотную): его номер тоже закрывается
    const area = cropOf(OWNER[0].b), b21 = OWNER[1].b;
    expect(b21[0] < area[2] && b21[2] > area[0] && b21[1] < area[3] && b21[3] > area[1]).toBe(true);
  });
  it("второй проход: номера, прочитанные первым как места, — снова номера; места — по стульям", () => {
    const { scan, changed, numbered } = mergeSeats(PASS1, PASS2);
    expect(numbered).toBe(16);
    expect(changed).toBe(19);   // у 17, 16 и 1 места первого прохода совпали со стульями
    const s = cleanScan(scan);
    expect(s.tables.map((t) => t.n)).toEqual(OWNER.map((t) => (t.truth === "30" ? "" : t.truth)));
    expect(s.tables.map((t) => t.seats)).toEqual(OWNER.map((t) => COUNT[t.truth]));
    // на сетке: номера с плана, у 30 — следующий свободный; места — по стульям
    const r = layoutScan(scan, IMG, null, "z1", { mode: "replace", items: true, tall: true });
    expect(r.added).toBe(22);
    const by = Object.fromEntries(r.plan.tables.map((t) => [t.n, t]));
    expect(Object.keys(by).sort((a, b) => a - b)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"]);
    expect([by["15"].seats, by["19"].seats, by["1"].seats, by["3"].seats, by["5"].seats, by["22"].seats]).toEqual([5, 8, 4, 6, 2, 12]);
    expect(r.renamed).toEqual([]);
  });
  it("номера не трогаем: таких столов меньше трёх, места повторяются, номер уже есть на плане, номеров почти у всех", () => {
    const pick = (tables, seats) => mergeSeats({ tables }, seats);
    const t = (b0, seats, n = "") => ({ b: [b0, 0, b0 + 5, 5], shape: "square", seats, n });
    expect(pick([t(0, 7), t(10, 9), t(20, 4)], [4, 4, 4]).numbered).toBe(0);                     // не совпали у двух — мало
    expect(pick([t(0, 7), t(10, 9), t(20, 11)], [4, 4, 4]).numbered).toBe(3);
    expect(pick([t(0, 6), t(10, 6), t(20, 6)], [4, 4, 4]).numbered).toBe(0);                     // 6, 6, 6 — места, а не номера
    expect(pick([t(0, 7), t(10, 9), t(20, 11), t(30, 4, "9")], [4, 4, 4, 4]).numbered).toBe(0);  // «9» на плане уже есть
    const noN = [t(0, 7), t(10, 9), t(20, 11), t(30, 3), t(40, 3), t(50, 3)];
    expect(pick(noN, [4, 4, 4, 3, 3, 3]).numbered).toBe(0);            // 3 из 6 столов без номера — половина, мало
    expect(pick(noN.slice(0, 5), [4, 4, 4, 3, 3]).numbered).toBe(3);   // 3 из 5 — большинство
    expect(pick(noN, [4, 4, 4, 3, 3, 3]).scan.tables.every((q) => q.counted)).toBe(true);
  });
  it("без второго прохода: места, равные номеру, у трёх столов и больше — переписанные номера, их не знаем; одно-два совпадения — бывает", () => {
    const t = (n, seats, counted) => ({ b: [Number(n), 0, Number(n) + 1, 1], shape: "square", seats, n, ...(counted ? { counted } : {}) });
    expect(cleanScan({ tables: [t("15", 15), t("14", 14), t("2", 2), t("1", 4)] }).tables.map((q) => q.seats)).toEqual([0, 0, 0, 4]);
    expect(cleanScan({ tables: [t("8", 8), t("4", 4), t("1", 2), t("2", 6)] }).tables.map((q) => q.seats)).toEqual([8, 4, 2, 6]);
    expect(cleanScan({ tables: [t("15", 15, true), t("14", 14, true), t("2", 2, true)] }).tables.map((q) => q.seats)).toEqual([15, 14, 2]);
    // половина столов с номером и местами — переписаны; меньше половины — совпадения случайны
    const half = [t("7", 7), t("8", 8), t("9", 9), ...[10, 11, 12].map((x) => t(String(x), 4))];
    expect(cleanScan({ tables: half }).tables.map((q) => q.seats)).toEqual([0, 0, 0, 4, 4, 4]);
    const less = [t("7", 7), t("8", 8), t("9", 9), ...[10, 11, 12, 13].map((x) => t(String(x), 4))];
    expect(cleanScan({ tables: less }).tables.map((q) => q.seats)).toEqual([7, 8, 9, 4, 4, 4, 4]);
  });
  it("номер с плана уже есть на схеме — итог говорит, какой номер у стола теперь", () => {
    const plan = { v: 2, zones: [{ id: "z1", name: "Зал 1" }, { id: "z2", name: "Зал 2" }], items: [], tables: [{ id: "t1", n: "15", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t2", n: "16", seats: 4, shape: "sq", x: 1, y: 0, z: "z1" }] };
    const scan = { plan: true, tables: [{ b: [10, 10, 20, 20], shape: "round", seats: 5, n: "15" }, { b: [40, 10, 50, 20], shape: "round", seats: 5, n: "3" }] };
    const r = layoutScan(scan, { w: 800, h: 600 }, plan, "z2", { mode: "replace", items: true });
    expect(r.renamed).toEqual([["15", "17"]]);
    expect(scanSummary(r)).toContain(" Номер 15 уже есть на схеме: у этого стола теперь 17. Если это тот же зал, что уже нарисован, распознай план в нём и выбери «Вместо них». Проверь номера и места.");
    const many = { added: 7, renamed: [["2", "31"], ["3", "32"], ["4", "33"], ["5", "34"], ["6", "35"], ["7", "36"]] };
    expect(scanSummary(many)).toContain(" Номера 2, 3, 4, 5, 6 и ещё 1 уже есть на схеме: у этих столов теперь 31, 32, 33, 34, 35 и дальше.");
    expect(scanSummary({ added: 2, renamed: [["2", "9"], ["3", "10"]] })).toContain(" Номера 2, 3 уже есть на схеме: у этих столов теперь 9, 10.");
    expect(scanSummary({ added: 2 })).not.toContain("уже есть на схеме");
  });
  it("редактор: в картинки второго прохода уходят все столы ответа — их номера закрыты", () => {
    const s = rd("ui/seating.jsx");
    expect(s).toContain("const full = await tableCrops(r0, boxes, 224, seatMasks(res)).then((crops) => scanSeatsFull(crops, opts)).catch(() => null);");   // v184: и стулья по сторонам
    const p = rd("lib/floor-photo.js");
    expect(p).toContain("export async function tableCrops(rec, boxes, side = 224, masks = []) {");
    expect(p).toContain("hideNumbers(c, g, all.filter((m) => overlaps(m.b, area)), (x, y) => [((x / 100) * W - sx) * k, ((y / 100) * H - sy) * k]);");
    // цвет берётся до закраски, по исходной картинке; холст без доступа к точкам — без пятен, но картинка уходит
    expect(p).toMatch(/try \{ px = g\.getImageData\(0, 0, c\.width, c\.height\)\.data; \} catch \(e\) \{ return; \}/);
  });
});

// ── функция floor-scan версии 3 на стенде ──
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
const IMG64 = "data:image/jpeg;base64," + "A".repeat(400);
const call = async (payload) => { const res = await fn.handle(new Request("https://fn.test/floor-scan", { method: "POST", body: JSON.stringify({ token: "tok", ...payload }) })); return { status: res.status, ...(await res.json()) }; };

describe("v182 · функция floor-scan версии 3", () => {
  beforeEach(() => { NET = { who: { id: "e1", position: "manager", is_admin: false }, bodies: [], replies: [] }; });
  it("первый проход: число на столе — номер, места — по стульям; пример с номером 15 и пятью местами; прежнего «бери число» нет", async () => {
    expect(fn.FLOOR_SCAN_V).toBeGreaterThanOrEqual(3);   // v184: 4
    const S = fn.SCAN_SYSTEM;
    expect(S).toContain("на схемах из программ бронирования и кассы это крупная цифра в центре стола");
    expect(S).toContain("Число на самом столе — его номер, а не места: в seats его не пиши.");
    expect(S).toContain("Подпись бери за места, только если по ней видно, что это места: «4 места», «4 м.», «на 4», «×4», «4p», «4 pax».");
    expect(S).toContain('Номер и места — разное: круглый стол с цифрой 15 и пятью стульями вокруг — "n":"15", "seats":5.');
    expect(S).toContain('{"b":[10.5,20,18,27.5],"shape":"round","n":"15","seats":5}');
    expect(S).toContain("Диван или банкетка вдоль стороны стола: мест на нём столько же, сколько стульев у противоположной стороны");
    expect(S).not.toMatch(/число мест \(«4»/);
    expect(S).not.toContain("если у стола написано число мест («4»");
    // n — раньше seats: модель сначала отдаёт номер
    expect(S.indexOf("- n — номер стола")).toBeLessThan(S.indexOf("- seats — сколько мест"));
    NET.replies.push(JSON.stringify({ plan: true, tables: [{ b: [10, 10, 20, 20], shape: "round", n: "15", seats: 5 }] }));
    const r = await call({ image: IMG64 });
    expect(r).toMatchObject({ status: 200, ok: true, v: fn.FLOOR_SCAN_V, tables: [{ b: [10, 10, 20, 20], shape: "round", seats: 5, n: "15" }] });
  });
  it("второй проход: номера закрыты — считать стулья; надписи не места; диван — как стульев напротив, у стола только с диваном — 2", async () => {
    const S = fn.SEATS_SYSTEM;
    expect(S).toContain("Номера на столах закрыты пятном цвета стола — так и задумано: номер не нужен, нужны только стулья.");
    expect(S).toContain("Цифры и надписи на картинке (номер стола, время вроде «43 мин», остатки подписи) — не места, по ним не считай.");
    expect(S).toContain("стол с двумя стульями сверху и диваном снизу — 4 места, даже если на диване три подушки");
    expect(S).toContain("У стола только с диваном — не меньше 2");
    expect(S).not.toContain("Если на столе или рядом написано число мест («4», «4 места», «×4», «4p»), бери его.");
    NET.replies.push('{"seats":[5, 4]}');
    expect(await call({ mode: "seats", crops: [CROP, CROP] })).toEqual({ status: 200, ok: true, v: fn.FLOOR_SCAN_V, mode: "seats", seats: [5, 4], sides: [null, null], model: "anthropic/claude-haiku-5.5" });   // v184: и sides
  });
});

describe("v182 · тексты", () => {
  it("без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["lib/floor-scan.js", "lib/floor-photo.js", "ui/seating.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
