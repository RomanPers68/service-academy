// v181 (Доп. 506): места с фото — второй проход по каждому столу; между соседними столами проход.
// Владелец (20.11): «И можно сделать так, что бы он и места переносил с фото?» и «И что бы он близко к фото делал
// рассадку. А то очень кучно делает».
//   • supabase/functions/floor-scan (версия 2): mode "seats" — картинки столов крупно, модель считает стулья у стола
//     в центре каждой; в первом проходе стулья считаются по сторонам стола;
//   • lib/floor-photo.js — cropOf, tableCrops (стол с запасом под стулья, 224 точки); lib/floor-scan.js — seatBoxes,
//     scanSeats, mergeSeats; ui/seating.jsx — второй проход в «Расставить столы по фото», рисунок стола чуть меньше
//     клетки (между соседними столами проход), ui/table-art.jsx — отступ рисунка (at); lib/floor-art.js — у круглого
//     стулья тоньше и ближе, столешница прежняя (подпись под номером на месте).
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v181.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { seatBoxes, scanSeats, mergeSeats, cleanScan, SEATS_MAX } from "../lib/floor-scan.js";
import { cropOf } from "../lib/floor-photo.js";
import { boardMap } from "../lib/seating.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

describe("v181 · версия и журнал", () => {
  it("сборка v181, Дополнение 506, слова владельца, сценарий, функция заново", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(181);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 506 — .*\(v181\)/);
    const part = c.slice(c.indexOf("# Дополнение 506")).replace(/\s+/g, " ");
    for (const w of ["И можно сделать так, что бы он и места переносил с фото", "И что бы он близко к фото делал рассадку",
      "А то очень кучно делает"]) expect(part, w).toContain(w);
    for (const line of c.slice(c.indexOf("# Дополнение 506")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v181.mjs");
    expect(rd("supabase/README.md")).toContain("### v181 — без SQL: функцию `floor-scan` развернуть заново");
    expect(rd("supabase/AI-SETUP.md")).toContain("## v181: места у каждого стола (`floor-scan` версии 2)");
  });
});

describe("v181 · второй проход в приложении", () => {
  const SCAN = { ok: true, v: 2, tables: [{ b: [10, 10, 20, 20], shape: "square", seats: 2 }, { b: [1, 1] }, { b: [30, 10, 40, 20], shape: "round", seats: 5 }, { b: [50, 50, 80, 60], shape: "rect", seats: 6 }] };
  it("какие столы вырезать: чистые рамки по порядку, не больше 40", () => {
    expect(seatBoxes(SCAN)).toEqual([[10, 10, 20, 20], [30, 10, 40, 20], [50, 50, 80, 60]]);
    const many = { tables: Array.from({ length: 55 }, (_, i) => ({ b: [i, 0, i + 1, 1] })) };
    expect(seatBoxes(many).length).toBe(SEATS_MAX);
    expect(SEATS_MAX).toBe(40);
    expect(seatBoxes(null)).toEqual([]);
  });
  it("где вырезать: рамка с запасом под стулья (половина меньшей стороны, не меньше 2%), в пределах фото", () => {
    expect(cropOf([10, 10, 20, 20])).toEqual([5, 5, 25, 25]);
    expect(cropOf([50, 50, 80, 60])).toEqual([45, 45, 85, 65]);
    expect(cropOf([0.5, 98, 1.5, 99.5])).toEqual([0, 96, 3.5, 100]);
  });
  it("места второго прохода — в ответ первого; где второй не знает — как было; мусорные рамки не сбивают порядок", () => {
    const { scan, changed } = mergeSeats(SCAN, [4, null, 8]);
    expect(scan.tables.map((t) => t.seats)).toEqual([4, undefined, 5, 8]);
    expect(changed).toBe(2);
    expect(cleanScan(scan).tables.map((t) => t.seats)).toEqual([4, 5, 8]);
    expect(mergeSeats(SCAN, [2, 99, "x"]).changed).toBe(0);
    expect(mergeSeats(SCAN, null)).toEqual({ scan: SCAN, changed: 0 });
  });
  it("запрос второго прохода: mode seats и картинки; ответ — числа 1–20 или null; не вышло — null", async () => {
    let seen = null;
    const ok = (data) => Promise.resolve({ ok: true, status: 200, json: async () => data });
    const crops = ["data:image/jpeg;base64,AAA", "data:image/jpeg;base64,BBB", "data:image/jpeg;base64,CCC"];
    const r = await scanSeats(crops, { url: "https://sb.test/", key: "k", token: "tok", fetchImpl: (u, init) => { seen = { u, init }; return ok({ ok: true, v: 2, mode: "seats", seats: [4, 0, 6.5] }); } });
    expect(r).toEqual([4, null, null]);
    expect(seen.u).toBe("https://sb.test/functions/v1/floor-scan");
    expect(JSON.parse(seen.init.body)).toEqual({ token: "tok", mode: "seats", crops });
    // старая функция (версии 1) на mode seats отвечает bad_request; сеть упала; пусто
    expect(await scanSeats(crops, { url: "u", fetchImpl: () => ok({ ok: false, error: "bad_request" }) })).toBe(null);
    expect(await scanSeats(crops, { url: "u", fetchImpl: () => Promise.reject(new TypeError("Failed")) })).toBe(null);
    expect(await scanSeats([], { url: "u", fetchImpl: () => ok({}) })).toBe(null);
    const slow = (u, init) => new Promise((res, rej) => { init.signal.addEventListener("abort", () => { const e = new Error("a"); e.name = "AbortError"; rej(e); }); });
    expect(await scanSeats(crops, { url: "u", timeoutMs: 20, fetchImpl: slow })).toBe(null);
  });
  it("редактор: второй проход только у функции версии 2; пока считает — своя надпись; не вышло — пометка в итоге", () => {
    const s = rd("ui/seating.jsx");
    expect(s).toContain('const boxes = Number(res.v) >= 2 && res.plan !== false ? seatBoxes(res) : [];');
    expect(s).toContain('const seats = await tableCrops(r0, boxes).then((crops) => scanSeats(crops, opts)).catch(() => null);');
    expect(s).toContain('if (seats) scan = mergeSeats(res, seats).scan;');
    expect(s).toContain('" Места посчитаны по общему плану: пересчитать у каждого стола не вышло."');
    expect(s).toContain('setNote(scanSummary(out) + seatsNote);');
    expect(s).toContain('scanStage={scanStage}');
    expect(rd("lib/floor-photo.js")).toContain("export async function tableCrops(rec, boxes, side = 224) {");
  });
  it("карточка фото: «Считаю стулья у каждого стола» во втором проходе", async () => {
    const { PhotoCard } = await import("../ui/floor-tools.jsx");
    const c = { gold: "#D2A85A", text: "#EFE4C8", sub: "#A99A7C", line: "rgba(0,0,0,0.2)", red: "#E08A7A", frost: {} };
    const rec = { data: "data:image/jpeg;base64,/9j/AAAA", w: 8, h: 6, op: 0.5 };
    const p = { c, a11y: false, rec, scanBusy: true, ask: false, nTables: 0, onOp() {}, onScan() {}, onAnswer() {}, onRotate() {}, onDrop() {}, onPhoto() {} };
    expect(R(h(PhotoCard, { ...p, scanStage: "seats" }))).toContain("Считаю стулья у каждого стола. Ещё 10–20 секунд.");
    expect(R(h(PhotoCard, { ...p, scanStage: "plan" }))).toContain("Смотрю на план и расставляю столы. Обычно это 10–30 секунд.");
  });
});

describe("v181 · проход между столами", () => {
  it("круглый стол: стулья тоньше и ближе — столешница почти как в v180, хотя рисунок меньше клетки", async () => {
    const { tableGeom } = await import("../lib/floor-art.js");
    // v180: стул 0,13 рамки, зазор 0,38 стула; рисунок — вся клетка без 2 · 3% по краям
    const v180 = (m) => { const d = Math.max(2.5, Math.min(9, m * 0.13)), g = Math.max(1, d * 0.38); return m / 2 - (d + g + 0.5); };
    for (const cell of [38.25, 40.1, 42.4, 47]) {
      const pad = Math.max(1, cell * 0.03), W = cell - 2 * pad, gap = Math.max(1.5, cell * 0.07) * 0.6, aw = W - 2 * gap;
      const g = tableGeom("rd", 6, aw, aw);
      expect(g.top.r, "клетка " + cell).toBeGreaterThan(v180(W) - 0.2);
      // подпись (квадрат 1,48 r) — не меньше 16 точек: номер и «счёт» под ним видны на телефоне от 360 точек
      expect(g.top.r * 1.48, "клетка " + cell).toBeGreaterThanOrEqual(16);
      for (const c of g.chairs) expect(Math.hypot(c.cx - aw / 2, c.cy - aw / 2) + c.h / 2).toBeLessThanOrEqual(aw / 2 + 0.01);
    }
  });
  it("рисунок стола — в отступе от края его клеток (7% клетки, не меньше 1,5 точки; у круглого 0,6 этого); кнопка — вся клетка", async () => {
    const { Floor } = await import("../ui/seating.jsx");
    const plan = { v: 2, zones: [{ id: "z1", name: "Зал" }], items: [], tables: [{ id: "t1", n: "1", seats: 4, shape: "sq", x: 0, y: 0, z: "z1" }, { id: "t2", n: "2", seats: 4, shape: "rd", x: 1, y: 0, z: "z1" }] };
    const html = R(h(Floor, { a11y: false, plan, map: boardMap([]), now: 0 }));
    const part = (id) => html.slice(html.indexOf(`data-table="${id}"`), html.indexOf("</button>", html.indexOf(`data-table="${id}"`)));
    // клетка 45 px: отступ 3,15 px, рисунок 45 − 2·1,35 − 2·3,15 = 36 px
    expect(part("t1")).toMatch(/<svg width="3[56](\.\d+)?" height="3[56](\.\d+)?"[^>]*style="position:absolute;left:3\.1\d*px;top:3\.1\d*px/);
    expect(part("t1")).toMatch(/width:42\.3\d*px;height:42\.3\d*px/);
    // круглый: отступ 0,6 · 3,15 = 1,89 px; подпись под номером на месте («4 м.»)
    expect(part("t2")).toMatch(/<svg width="38\.5\d*" height="38\.5\d*"[^>]*style="position:absolute;left:1\.8\d*px;top:1\.8\d*px/);
    expect(part("t2")).toContain("4 м.");
    // два соседних стола: между рисунками 1,35 + 3,15 + 1,35 + 1,89 ≈ 7,7 точки
    expect(rd("ui/seating.jsx")).toContain('const gap = Math.max(1.5, cell * 0.07) * (t.shape === "rd" ? 0.6 : 1), aw = W - 2 * gap, ah = H - 2 * gap;');
    expect(rd("ui/table-art.jsx")).toContain('style={{ position: "absolute", left: at, top: at, overflow: "visible", pointerEvents: "none" }}>');
  });
});

// ── функция floor-scan, второй проход, на стенде ──
const ENV = { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE_KEY: "svc", OPENROUTER_API_KEY: "or-key", OPENROUTER_MODEL: "anthropic/claude-haiku-5.5" };
globalThis.Deno = { serve() {}, env: { get: (k) => ENV[k] } };
const fn = await import("../supabase/functions/floor-scan/index.ts");
let NET = { who: null, bodies: [], replies: [], usage: 0 };
const send = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data, text: async () => JSON.stringify(data) });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith("/rest/v1/rpc/whoami")) return send(NET.who ? { ok: true, employee: NET.who } : { ok: false });
  if (u.includes("/rest/v1/ai_usage")) { NET.usage++; return send([{ count: 0 }]); }
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

describe("v181 · функция floor-scan версии 2: стулья у каждого стола", () => {
  beforeEach(() => { NET = { who: { id: "e1", position: "manager", is_admin: false }, bodies: [], replies: [], usage: 0 }; });
  it("картинки по порядку с подписями, подсказка про стол в центре; ответ — числа или null по числу картинок; в лимит не идёт", async () => {
    NET.replies.push('```json\n{"seats":[4, "6", null, 30]}\n```');
    const r = await call({ mode: "seats", crops: [CROP, CROP, CROP] });
    expect(r).toEqual({ status: 200, ok: true, v: 2, mode: "seats", seats: [4, 6, null], model: "anthropic/claude-haiku-5.5" });
    const b = NET.bodies[0];
    expect(b.messages[0].content).toBe(fn.SEATS_SYSTEM);
    const parts = b.messages[1].content;
    expect(parts.map((p) => p.type)).toEqual(["text", "text", "image_url", "text", "image_url", "text", "image_url"]);
    expect(parts[1].text).toBe("Картинка 1");
    expect(parts[6]).toEqual({ type: "image_url", image_url: { url: CROP } });
    expect(b.reasoning).toEqual({ effort: "low", exclude: true });
    expect(NET.usage).toBe(0);
    expect(fn.SEATS_SYSTEM).toContain("обойди стол по сторонам — сверху, справа, снизу, слева — и сложи");
    expect(fn.SEATS_SYSTEM).toContain("По краям картинки могут попасть соседние столы и их стулья — их не считай.");
  });
  it("проверки: без картинок и с не-картинкой — bad_request; больше 40 или слишком большая — too_large; права — как у распознавания", async () => {
    expect(await call({ mode: "seats", crops: [] })).toMatchObject({ status: 400, error: "bad_request" });
    expect(await call({ mode: "seats", crops: [CROP, "http://x/y.jpg"] })).toMatchObject({ status: 400, error: "bad_request" });
    expect(await call({ mode: "seats", crops: Array(41).fill(CROP) })).toMatchObject({ status: 413, error: "too_large" });
    expect(await call({ mode: "seats", crops: ["data:image/jpeg;base64," + "C".repeat(fn.MAX_CROP)] })).toMatchObject({ status: 413, error: "too_large" });
    NET.who = { id: "e2", position: "waiter" };
    expect(await call({ mode: "seats", crops: [CROP] })).toMatchObject({ status: 403, error: "forbidden" });
    NET.who = null;
    expect(await call({ mode: "seats", crops: [CROP] })).toMatchObject({ status: 401, error: "auth" });
  });
  it("первый проход: версия 2, стулья считаются по сторонам стола", async () => {
    expect(fn.FLOOR_SCAN_V).toBe(2);
    expect(fn.SCAN_SYSTEM).toContain("посчитай стулья у стола по сторонам (сверху, справа, снизу, слева) и сложи");
    expect(fn.cleanSeats({ seats: [1, 20, 21, 0, "3"] }, 6)).toEqual([1, 20, null, null, 3, null]);
  });
});

describe("v181 · тексты", () => {
  it("без тире между словами, без восклицаний и эмодзи", () => {
    for (const f of ["ui/floor-tools.jsx", "ui/seating.jsx", "lib/floor-scan.js", "lib/floor-photo.js", "ui/table-art.jsx"]) {
      const src = code(rd(f));
      expect([f, src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []]).toEqual([f, []]);
      expect([f, /[А-Яа-яЁё]!["'`<\s]/.test(src)]).toEqual([f, false]);
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
