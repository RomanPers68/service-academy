// v204 (Доп. 530): импорт меню из PDF по частям — список позиций, потом подробности по 4; причина ошибки своими словами.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  MENU_PDF_MAX, MENU_PDF_BIG, MENU_BATCH, MENU_PARALLEL, MENU_NO_DETAIL, MENU_NAMES_MAX,
  normName, cleanNames, askNames, pickRequested, menuImportWhy, menuImportErr, runMenuImport,
} from "../lib/menu-import.js";

const rd = (f) => readFileSync(f, "utf8");
const DISH = (name, x = {}) => ({ name, cat: "Закуски", desc: "Описание " + name, ingredients: ["а", "б"], allergens: ["Молоко"], note: "", pairing: "", ...x });
const NAMES = ["Паштет", "Гёдза", "Салат с уткой", "Веллингтон", "Трайфл", "Коктейль «Иней»", "Глинтвейн", "Сырники", "Борщ", "Пельмени"];

// сервер для runMenuImport: names — весь список; details — то, что спросили (skip — чего «модель» не находит)
const fakeServer = (opts = {}) => {
  const calls = [];
  let inFlight = 0, maxInFlight = 0, failLeft = opts.failDetails || 0;
  const post = async (b) => {
    calls.push(b);
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    if (b.mode === "names") return opts.names || { ok: true, status: 200, j: { names: NAMES.map((n) => ({ name: n, cat: "Закуски" })), model: "m1" } };
    if (failLeft > 0) { failLeft--; return { ok: false, status: 504, j: null }; }
    const skip = new Set(opts.skip || []);
    return { ok: true, status: 200, j: { dishes: b.names.filter((n) => !skip.has(n)).map((n) => ({ ...DISH(n), ask: n })), model: "m2" } };
  };
  return { post, calls, max: () => maxInFlight };
};

describe("v204 · версия и журнал", () => {
  it("сборка v204, Дополнение 530 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(204);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 530 — .*\(v204\)/);
    const part = c.slice(c.indexOf("# Дополнение 530"));
    for (const w of ["Сам pdf весит очень мало", "151 КБ", "names", "details", "tools/claude/e2e-v204.mjs"]) expect(part, w).toContain(w);
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v204 · общие части", () => {
  it("normName: регистр, ё, кавычки и пробелы не важны", () => {
    expect(normName("  Коктейль «Морозко»  б/а ")).toBe("коктейль морозко б/а");
    expect(normName("ЁЛКА")).toBe(normName("елка"));
    expect(normName(null)).toBe("");
  });
  it("cleanNames: без пустых и повторов, по порядку, строки и объекты, не больше MENU_NAMES_MAX", () => {
    expect(cleanNames([{ name: "Паштет", cat: "Закуски" }, { name: " паштет " }, "Борщ", { name: "" }, null, { cat: "x" }]))
      .toEqual([{ name: "Паштет", cat: "Закуски" }, { name: "Борщ", cat: "" }]);
    expect(cleanNames(Array.from({ length: 300 }, (_, i) => ({ name: "Блюдо " + i }))).length).toBe(MENU_NAMES_MAX);
    expect(cleanNames(null)).toEqual([]);
  });
  it("askNames: 1–6 непустых названий, иначе null", () => {
    expect(askNames(["А", " Б  в "])).toEqual(["А", "Б в"]);
    expect(askNames([])).toBe(null);
    expect(askNames("А")).toBe(null);
    expect(askNames(["А", ""])).toBe(null);
    expect(askNames(Array.from({ length: 7 }, (_, i) => "Б" + i))).toBe(null);
  });
  it("pickRequested: только запрошенные, по порядку запроса, ask — как спросили; чего нет — missing", () => {
    const got = pickRequested([DISH("Гедза с говядиной"), DISH("Паштет"), DISH("Борщ")], ["Паштет", "Гёдза с говядиной", "Сырники"]);
    expect(got.dishes.map((d) => [d.name, d.ask])).toEqual([["Паштет", "Паштет"], ["Гедза с говядиной", "Гёдза с говядиной"]]);
    expect(got.missing).toEqual(["Сырники"]);
    // название у модели короче или длиннее — «одно содержит другое»
    const part = pickRequested([DISH("Трайфл «Шоколадная вишня»")], ["Шоколадная вишня"]);
    expect(part.dishes.length).toBe(1);
    expect(pickRequested(null, ["А"])).toEqual({ dishes: [], missing: ["А"] });
  });
  it("menuImportWhy: код в тексте, без связи — отдельные слова", () => {
    expect(menuImportWhy(504)).toBe("AI не успел прочитать меню: сервер перестал ждать (код 504). Нажми «Из PDF» ещё раз");
    expect(menuImportWhy(413)).toMatch(/код 413/);
    expect(menuImportWhy(404)).toMatch(/menu-import не развёрнута/);   // v206: функция Supabase menu-import, запасной — /api
    expect(menuImportWhy(502)).toMatch(/код 502/);
    expect(menuImportWhy(0)).toBe("Нет связи с сервером приложения: проверь интернет и нажми «Из PDF» ещё раз");
    expect(menuImportErr({ ok: false, status: 401, j: { error: "Сессия не найдена" } })).toBe("Сессия не найдена");
    expect(menuImportErr({ ok: false, status: 504, j: null })).toMatch(/код 504/);
    expect(menuImportErr(null)).toMatch(/Нет связи/);
  });
  it("предел файла — 3 МБ, слова как в других редакторах", () => {
    expect(MENU_PDF_MAX).toBe(3 * 1024 * 1024);
    expect(MENU_PDF_BIG).toMatch(/больше 3 МБ/);
    expect(MENU_BATCH).toBe(4);
    expect(MENU_PARALLEL).toBe(2);
  });
});

describe("v204 · runMenuImport", () => {
  it("список, потом подробности по 4, не больше двух запросов сразу; порядок — как в меню; ход виден", async () => {
    const s = fakeServer(), seen = [];
    const out = await runMenuImport({ pdfBase64: "JVBE", post: s.post, onProgress: (p) => seen.push(p) });
    expect(s.calls[0]).toEqual({ mode: "names", pdfBase64: "JVBE" });
    const det = s.calls.slice(1);
    expect(det.every((c) => c.mode === "details" && c.pdfBase64 === "JVBE")).toBe(true);
    expect(det.map((c) => c.names.length)).toEqual([4, 4, 2]);
    expect(s.max()).toBeLessThanOrEqual(2);
    expect(out.dishes.map((d) => d.name)).toEqual(NAMES);
    expect(out.dishes.every((d) => !("ask" in d) && !d.short)).toBe(true);
    expect(out.short).toEqual([]);
    expect(out.model).toBe("m2");
    expect(seen[0]).toEqual({ done: 0, total: 10 });
    expect(seen[seen.length - 1]).toEqual({ done: 10, total: 10 });
  });
  it("старый сервер (без режимов) отвечает всем меню сразу — так и берём", async () => {
    const post = async () => ({ ok: true, status: 200, j: { dishes: [DISH("Паштет")], model: "old" } });
    const out = await runMenuImport({ pdfBase64: "x", post });
    expect(out).toEqual({ dishes: [DISH("Паштет")], short: [], model: "old" });
  });
  it("часть не ответила один раз — повтор; позицию не нашли и со второго раза — с названием и пометкой", async () => {
    const s = fakeServer({ failDetails: 1, skip: ["Борщ"] });
    const out = await runMenuImport({ pdfBase64: "x", post: s.post });
    expect(out.dishes.length).toBe(10);
    const borsch = out.dishes.find((d) => d.name === "Борщ");
    expect(borsch).toMatchObject({ name: "Борщ", cat: "Закуски", ingredients: [], allergens: [], note: MENU_NO_DETAIL, short: true });
    expect(out.short).toEqual(["Борщ"]);
    // «Борщ» спрашивали дважды: в своей пачке и отдельно
    expect(s.calls.filter((c) => c.mode === "details" && c.names.includes("Борщ")).length).toBe(2);
  });
  it("не прочиталось ничего — ошибка первой причиной (код хостинга)", async () => {
    const s = fakeServer({ failDetails: 100 });
    await expect(runMenuImport({ pdfBase64: "x", post: s.post })).rejects.toThrow(/код 504/);
  });
  it("список не пришёл: хостинг (не JSON) — код; своя ошибка сервера — её слова; нет связи — «Нет связи»", async () => {
    await expect(runMenuImport({ pdfBase64: "x", post: async () => ({ ok: false, status: 504, j: null }) })).rejects.toThrow("AI не успел прочитать меню: сервер перестал ждать (код 504)");
    await expect(runMenuImport({ pdfBase64: "x", post: async () => ({ ok: false, status: 429, j: { error: "Слишком много импортов подряд — попробуй через час" } }) }))
      .rejects.toThrow("Слишком много импортов подряд — попробуй через час");
    await expect(runMenuImport({ pdfBase64: "x", post: async () => ({ ok: false, status: 0, j: null }) })).rejects.toThrow(/Нет связи с сервером приложения/);
    await expect(runMenuImport({ pdfBase64: "x", post: async () => ({ ok: true, status: 200, j: { names: [] } }) })).rejects.toThrow(/не нашлось ни одного блюда/);
  });
});

describe("v204 · редактор меню и демо", () => {
  const src = rd("ui/menu-trainer.jsx");
  it("редактор: импорт через runMenuImport, предел 3 МБ, ход «Читаю PDF… N из M», служебные поля не сохраняются", () => {
    expect(src).toContain('from "../lib/menu-import"');
    expect(src).toContain("runMenuImport({ pdfBase64, post, onProgress: setImportStep })");
    expect(src).toContain("if (file.size > MENU_PDF_MAX) { setImportErr(MENU_PDF_BIG); return; }");
    expect(src).toContain("`Читаю PDF… ${importStep.done} из ${importStep.total}`");
    expect(src).toContain(".map(({ short, ask, ...d }, i) => ({");
    expect(src).not.toContain("Сеть недоступна или функция /api/menu-import не развёрнута.");
    expect(src).toContain("data-import-short");
  });
  it("демо отвечает на names и details, умеет «не дождался» и «не дочитал»", () => {
    const boot = rd("tools/claude/demo-app/boot.js");
    expect(boot).toContain("function demoMenuImport(b)");
    expect(boot).toMatch(/\/api\\\/menu-import/);
    for (const k of ["__demo_menu_504", "__demo_menu_short", "__demoMenuCalls"]) expect(boot).toContain(k);
  });
});
