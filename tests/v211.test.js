// v211 (Доп. 537): ведомость КБЖУ — из кода приложения в базу, у заведения (этап 67).
// Владелец: «Да, давай её в базу уберем». lib/nutrition.js без встроенной таблицы: строки, решения владельца и хвосты
// приходят с сервера (nutrition_get) через lib/nutrition-sync.js, копия — на телефоне. Демо и проверки — ведомость из
// tools/claude/demo-app/nutrition-seed.js.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { setNutrition, nutritionOf, nutritionVenue, nutritionSize, dishNutrition } from "../lib/nutrition.js";
import { pickNutrition, loadNutrition, NUTRITION_KEY, _resetNutritionSync } from "../lib/nutrition-sync.js";
import { DEMO_NUTRITION } from "../tools/claude/demo-app/nutrition-seed.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (f) => readFileSync(f, "utf8");
const memStore = () => {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};
const walk = (dir, out = []) => {
  for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); }
  return out;
};
const APP = ["App.jsx", "main.jsx", ...walk("ui"), ...walk("lib"), ...walk("data"), ...walk("api"), ...walk("supabase/functions")]
  .filter((f) => /\.(jsx?|ts)$/.test(f));
const ROW = (n, kcal = 300) => ({ n, out: 250, kcal, p: 20, f: 10, c: 30 });

describe("v211 · версия и журнал", () => {
  it("сборка v211, Дополнение 537 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(211);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 537 — .*\(v211\)/);
    const part = c.slice(c.indexOf("# Дополнение 537"));
    for (const w of ["«Да, давай её в базу уберем»", "supabase-stage67-nutrition.sql", "nutrition_get", "lib/nutrition-sync.js",
      "nutrition-seed.js", "test67.sh", "147 строк"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v211 · в коде приложения ведомости нет", () => {
  it("data/nutrition.js убран; lib/nutrition.js не тянет таблицу из data/", () => {
    expect(existsSync("data/nutrition.js")).toBe(false);
    const lib = rd("lib/nutrition.js");
    expect(lib).not.toMatch(/from "\.\.\/data\/nutrition"/);
    expect(lib).not.toMatch(/NUTRITION\b/);
    expect(lib).not.toMatch(/океан блюдо|ROW-BAR|лком/);
  });
  it("ни источника ведомости, ни её хвостов нигде в коде приложения", () => {
    const bad = APP.filter((f) => /КАМ-ОПТ|ведомости БЖУК|океан блюдо|с лком и чесноком/.test(rd(f)));
    expect(bad).toEqual([]);
  });
  it("ведомость демо — та же, что ушла в базу: 147 строк, 5 решений, 2 хвоста", () => {
    expect(DEMO_NUTRITION.rows.length).toBe(147);
    expect(Object.keys(DEMO_NUTRITION.alias).length).toBe(5);
    expect(DEMO_NUTRITION.tails).toEqual(["океан блюдо", "океан"]);
    for (const r of DEMO_NUTRITION.rows) expect(r.n && r.kcal > 0, r.n).toBeTruthy();
  });
});

describe("v211 · таблица приходит снаружи (setNutrition)", () => {
  beforeEach(() => setNutrition(null));
  it("без таблицы — только свои цифры из карточки", () => {
    expect(nutritionSize()).toBe(0);
    expect(nutritionOf("Уха по-царски")).toBe(null);
    expect(dishNutrition({ name: "Уха по-царски" })).toBe(null);
    expect(dishNutrition({ name: "Уха", kcal: 280, out: 350, prot: 21 })).toMatchObject({ kcal: 280, own: true });
  });
  it("строки, решения владельца и свои хвосты — из таблицы заведения", () => {
    setNutrition({ rows: [ROW("Уха по-царски"), ROW("Котлета из щуки ЗАЛ БЛЮДО", 410), ROW("Салат «Северный»", 220)],
      alias: { "Уха царская": "Уха по-царски" }, tails: ["зал блюдо"] }, "Маяк");
    expect(nutritionVenue()).toBe("Маяк");
    expect(nutritionSize()).toBe(3);
    expect(nutritionOf("Уха по-царски").kcal).toBe(300);
    expect(nutritionOf("Уха царская")).toMatchObject({ n: "Уха по-царски", score: 1 });   // решение владельца
    expect(nutritionOf("Котлета из щуки").kcal).toBe(410);                                // хвост выгрузки отрезан
    expect(nutritionOf("Салат Северный блюдо").kcal).toBe(220);                           // «блюдо» — общий хвост
    setNutrition({ rows: [ROW("Котлета из щуки ЗАЛ БЛЮДО", 410)] }, "Другое");             // без своих хвостов
    expect(nutritionOf("Котлета из щуки")).toMatchObject({ kcal: 410, score: 0.9 });      // не точно, но по всем словам
    setNutrition(null);
    expect([nutritionVenue(), nutritionSize()]).toEqual([null, 0]);
  });
  it("ведомость демо находит то же, что раньше встроенная", () => {
    setNutrition(DEMO_NUTRITION, "пилот");
    expect(nutritionOf("Креветка темпура").n).toMatch(/Креветк. темпура/);
    expect(nutritionOf("Камчатский краб").n).toBe("Живой камчатский краб");
    expect(nutritionOf("Жареха с олениной").n).toMatch(/^Жареха с олениной/);
  });
});

describe("v211 · с сервера и из копии (lib/nutrition-sync.js)", () => {
  let calls, answer;
  beforeEach(() => {
    globalThis.localStorage = memStore();
    localStorage.setItem("sa_session_token", "tok-1");
    calls = []; answer = { ok: true, restaurant: "Маяк", rows: [ROW("Уха по-царски")], alias: {}, tails: [] };
    globalThis.fetch = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(init.body) }); return { json: async () => (typeof answer === "function" ? answer() : answer) }; };
    _resetNutritionSync(); setNutrition(null);
  });
  it("с сервера — в таблицу и в копию; копия — сразу при следующем открытии", async () => {
    expect(pickNutrition("Маяк")).toBe(false);
    expect(await loadNutrition("Маяк")).toBe(true);
    expect(calls[0].url).toMatch(/\/rest\/v1\/rpc\/nutrition_get$/);
    expect(calls[0].body).toEqual({ p_token: "tok-1", p_restaurant: "Маяк" });
    expect([nutritionVenue(), nutritionOf("Уха по-царски").kcal]).toEqual(["Маяк", 300]);
    expect(JSON.parse(localStorage.getItem(NUTRITION_KEY))["Маяк"].rows.length).toBe(1);
    setNutrition(null);
    expect(pickNutrition("Маяк")).toBe(true);
    expect(nutritionOf("Уха по-царски").kcal).toBe(300);
  });
  it("пустая ведомость — копия убирается; другое заведение открыто — таблицу не трогает", async () => {
    await loadNutrition("Маяк");
    answer = { ok: true, restaurant: "Маяк", rows: [], alias: {}, tails: [] };
    _resetNutritionSync();
    await loadNutrition("Маяк");
    expect(JSON.parse(localStorage.getItem(NUTRITION_KEY))["Маяк"]).toBeUndefined();
    expect(nutritionSize()).toBe(0);
    answer = { ok: true, restaurant: "Маяк", rows: [ROW("Уха по-царски")], alias: {}, tails: [] };
    const p = loadNutrition("Маяк");
    setNutrition(null, "Причал");                         // пока шёл ответ, открыли другое заведение
    await p;
    expect(nutritionVenue()).toBe("Причал");
    expect(nutritionSize()).toBe(0);
  });
  it("ошибка или нет сети — таблица из копии остаётся; этапа 67 нет — больше не спрашиваем", async () => {
    await loadNutrition("Маяк");
    answer = { ok: false, error: "forbidden" };
    _resetNutritionSync();
    expect(await loadNutrition("Маяк")).toBe(false);
    expect(nutritionSize()).toBe(1);
    globalThis.fetch = async () => { throw new Error("offline"); };
    expect(await loadNutrition("Маяк")).toBe(false);
    expect(nutritionSize()).toBe(1);
    let n = 0;
    globalThis.fetch = async () => { n++; return { json: async () => ({ code: "PGRST202", message: "Could not find the function" }) }; };
    expect(await loadNutrition("Маяк")).toBe(false);
    expect(await loadNutrition("Маяк")).toBe(false);
    expect(n).toBe(1);
  });
  it("вход «Демо» и без входа — на сервер не ходит", async () => {
    localStorage.setItem("sa_session_token", "demo");
    expect(await loadNutrition("Маяк")).toBe(false);
    localStorage.removeItem("sa_session_token");
    expect(await loadNutrition("Маяк")).toBe(false);
    expect(calls.length).toBe(0);
  });
});

describe("v211 · экраны и сервер демо", () => {
  it("приложение берёт ведомость своего заведения при входе, тренажёр — открытого", () => {
    const app = rd("App.jsx");
    expect(app).toContain('import { pickNutrition, loadNutrition } from "./lib/nutrition-sync";');
    expect(app).toContain("useEffect(() => { if (!profile || !menuRest) return; pickNutrition(menuRest); loadNutrition(menuRest); }");
    const m = rd("ui/menu-trainer.jsx");
    expect(m).toContain("pickNutrition(restaurant); setNutTick((t) => t + 1);");
    expect(m).toContain("loadNutrition(restaurant).then((ok) => { if (alive && ok) setNutTick((t) => t + 1); });");
  });
  it("сервер демо: своё — всем, кто вошёл, чужое — сети; без этапа 67 — нет функции", () => {
    const people = [{ id: "a", name: "Анна", surname: "С", restaurant: "Маяк", position: "waiter" },
      { id: "o", name: "Олег", surname: "П", restaurant: "Причал", position: "manager" },
      { id: "r", name: "Роман", surname: "", restaurant: "Маяк", position: "owner", is_admin: true }];
    const mk = (x = {}) => makeServer({ today: "2026-11-28", rest: "Маяк", people, tok: { ta: "a", to: "o", tr: "r" }, sstaff: [], cfg: { shifts: [] },
      plan: {}, menu: [], clock: () => Date.parse("2026-11-28T09:00:00Z"), ...x });
    const srv = mk();
    expect(srv.rpc("nutrition_get", { p_token: "нет" })).toEqual({ ok: false, error: "auth" });
    const a = srv.rpc("nutrition_get", { p_token: "ta", p_restaurant: "Маяк" });
    expect([a.ok, a.restaurant, a.rows.length, Object.keys(a.alias).length, a.tails.length]).toEqual([true, "Маяк", 147, 5, 2]);
    expect(srv.rpc("nutrition_get", { p_token: "ta", p_restaurant: "Причал" }).error).toBe("forbidden");
    expect(srv.rpc("nutrition_get", { p_token: "to" })).toMatchObject({ ok: true, restaurant: "Причал", rows: [] });
    expect(srv.rpc("nutrition_get", { p_token: "tr", p_restaurant: "Причал" })).toMatchObject({ ok: true, rows: [] });
    expect(mk({ noStage67: true }).rpc("nutrition_get", { p_token: "ta" }).code).toBe("PGRST202");
  });
});

describe("v211 · этап 67", () => {
  const sql = rd("supabase/supabase-stage67-nutrition.sql");
  it("таблица закрыта, чтение — с проверкой входа и заведения; без данных в файле", () => {
    expect(sql).toContain("raise exception 'Сначала этап 62 (supabase-stage62-venue-walls.sql): нет функции _sa_caller';");
    expect(sql).toContain("create table if not exists sa_nutrition (");
    expect(sql).toContain("revoke all on table sa_nutrition from public, anon, authenticated;");
    expect(sql).toContain("returns jsonb language plpgsql volatile security definer set search_path to public as $$");
    expect(sql).toContain("c := _sa_caller(p_token);");
    expect(sql).toContain("and not coalesce((c->>'network')::boolean, false) then");
    expect(sql).toContain("grant execute on function nutrition_get(text, text) to anon, authenticated;");
    expect(sql).not.toMatch(/insert into sa_nutrition/i);
  });
  it("в списке этапов и с проверкой на локальной базе", () => {
    expect(rd("supabase/README.md")).toContain("| 76 | `supabase-stage67-nutrition.sql` |");
    const t = rd("tools/claude/sql/test67.sh");
    expect(t).toContain("S67=supabase-stage67-nutrition.sql");
    expect(t).toContain('chk "ведомость — у нового названия"');
    expect(rd("tools/claude/README.md")).toContain("- `sql/test67.sh` — v211 (Доп. 537)");
  });
});
