// v210 (Доп. 536): без вшитых заведений — список ресторанов, меню-примеры и фото блюд убраны из приложения.
// Владелец: «Из кода мы можем убрать вшитые рестораны? Так как добавили возможность самому вписывать заведения,
// думаю они не нужно больше». Своё у каждого — на сервере (этап 61); демо и проверки берут сеть и блюда из
// tools/claude/demo-app (net-seed.js, menu-seed.js, menu/), в приложение это не попадает.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import * as ROLES from "../data/roles.js";
import { RESTAURANT_MENUS } from "../data/menu.js";
import { orgFallback, orgSeed, DEMO_VENUES, venueNames, hiddenVenues, venuesWithMine } from "../lib/org-model.js";
import { menuDishes } from "../lib/menu-dishes.js";
import { DEMO_NET } from "../tools/claude/demo-app/net-seed.js";
import { DEMO_MENUS } from "../tools/claude/demo-app/menu-seed.js";

const rd = (f) => readFileSync(f, "utf8");
const ENV = { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE_KEY: "svc", OPENROUTER_API_KEY: "or-key" };
if (!globalThis.Deno) globalThis.Deno = { serve() {}, env: { get: (k) => ENV[k] } };

// названия сети — ровно те, что были вшиты; берём из списка демо, чтобы не повторять их здесь. Длинные ищем
// где угодно, короткие («порт», «океан» бывают и просто словами) — только в кавычках
const WORDS = DEMO_NET.flatMap((n) => n.split(", "));
const NET_RE = new RegExp([...WORDS.filter((w) => w.length >= 6),
  ...WORDS.filter((w) => w.length < 6).flatMap((w) => [`«${w}»`, `"${w}"`])].join("|"));
const walk = (dir, out = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const APP = ["App.jsx", "main.jsx", "index.html", ...walk("ui"), ...walk("lib"), ...walk("data"), ...walk("api"), ...walk("supabase/functions")]
  .filter((f) => /\.(jsx?|ts|html)$/.test(f));

describe("v210 · версия и журнал", () => {
  it("сборка v210, Дополнение 536 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(210);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 536 — .*\(v210\)/);
    const part = c.slice(c.indexOf("# Дополнение 536"));
    for (const w of ["«Из кода мы можем убрать вшитые рестораны?", "orgSeed(names, keep)", "DEMO_VENUES", "net-seed.js",
      "menu-seed.js", "ai-chat", "app-api", "data/nutrition.js"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
});

describe("v210 · в коде приложения нет названий сети", () => {
  it("проверка сама ловит названия (на списке демо)", () => {
    expect(NET_RE.test(`ресторан «${DEMO_NET[0]}»`)).toBe(true);
    expect(NET_RE.test("ресторан «Маяк»")).toBe(false);
  });
  it("экраны, логика, данные, обработчики, функции Supabase — чисто (таблица КБЖУ решается отдельно)", () => {
    expect(APP.length).toBeGreaterThan(300);
    const bad = APP.filter((f) => f !== "data/nutrition.js" && NET_RE.test(rd(f)));
    expect(bad).toEqual([]);
  });
  it("data/roles.js без RESTAURANTS; меню-примеры пусты; фото блюд не в public, а у демо", () => {
    expect("RESTAURANTS" in ROLES).toBe(false);
    expect(ROLES.ROLES.length).toBe(6);
    expect(RESTAURANT_MENUS).toEqual({});
    expect(existsSync("public/menu")).toBe(false);
    expect(readdirSync("tools/claude/demo-app/menu").filter((f) => f.endsWith(".jpg")).length).toBe(10);
  });
});

describe("v210 · заведения: запасной список и демо", () => {
  it("этапа 61 нет — заведений в списке нет, своё у сотрудника видно; должностей шесть", () => {
    const o = orgFallback();
    expect(o.venues).toEqual([]);
    expect(venuesWithMine(o, "Кафе «Ромашка»")).toEqual(["Кафе «Ромашка»"]);
    expect(o.positions.length).toBe(6);
  });
  it("orgSeed без названий — выдуманные демо, видно первое; со своими — keep видно, повторы и пробелы убраны", () => {
    expect(DEMO_VENUES).toEqual(["Демо-ресторан", "Демо-бар", "Демо-кафе"]);
    const d = orgSeed();
    expect(venueNames(d)).toEqual(["Демо-ресторан"]);
    expect(hiddenVenues(d).map((v) => v.name)).toEqual(["Демо-бар", "Демо-кафе"]);
    const s = orgSeed(["  Причал ", "Маяк", "Причал"], "Маяк");
    expect(venueNames(s)).toEqual(["Маяк"]);
    expect(hiddenVenues(s).map((v) => v.name)).toEqual(["Причал"]);
    expect(s.positions.every((p) => p.staff === 0)).toBe(true);
  });
  it("команда во входе «Демо» — в демо-заведениях; сервер демо играет сеть из net-seed", () => {
    const t = rd("ui/screens-team.jsx");
    expect(t).toContain('import { DEMO_VENUES } from "../lib/org-model.js";');
    expect(t).not.toContain("RESTAURANTS");
    expect((t.match(/restaurant:DEMO_VENUES\[\d\]/g) || []).length).toBe(7);
    expect(rd("tools/claude/demo-app/fake-server.js"))
      .toContain("orgSeed([...DEMO_NET, ...new Set(PEOPLE.map((e) => e.restaurant))], DEMO_NET[0]);");
    expect(DEMO_NET.length).toBe(5);
  });
});

describe("v210 · меню без встроенных примеров", () => {
  it("menuDishes: у заведения без меню команды — пусто; примеры — только если их передали", () => {
    expect(menuDishes({ restaurant: "Маяк", shared: [] })).toEqual([]);
    const samples = { "Маяк": [{ id: "s1", name: "Уха" }] };
    expect(menuDishes({ restaurant: "Маяк", shared: [], samples }).map((d) => d.name)).toEqual(["Уха"]);
  });
  it("тренажёр: переключатель примеров — только при примерах; подпись «Редактора меню» — про импорт", () => {
    const m = rd("ui/menu-trainer.jsx");
    expect(m).toContain("const hasSamples = (RESTAURANT_MENUS[restaurant] || []).length > 0;");
    expect(m).toContain("{hasSamples && (");
    expect(m).toContain('"Добавь блюда сам или загрузи меню из PDF или Word"');
  });
  it("демо и проверки берут блюда из menu-seed; сборка демо кладёт фото в /menu/", () => {
    expect(Object.values(DEMO_MENUS).flat().length).toBeGreaterThan(20);
    expect(rd("tools/claude/demo-app/boot.js")).toContain('import { DEMO_MENUS as RESTAURANT_MENUS } from "./menu-seed.js";');
    expect(rd("tools/claude/demo-app/build.mjs")).toContain('cpSync(join(SRC, "tools/claude/demo-app/menu"), join(OUT, "menu")');
    expect(rd("scripts/check-content.mjs")).not.toContain("RESTAURANTS");
  });
});

describe("v210 · подсказки ИИ без названия заведения", () => {
  it("Наставник и помощник уроков; app-api собран из свежих исходников", () => {
    expect(rd("supabase/functions/ai-chat/index.ts"))
      .toContain("`Ты — «Наставник», AI-ассистент обучающего приложения Service Academy для сотрудников ресторанов и баров.`");
    expect(rd("api/lesson-assist.js")).toContain('"Стиль уроков приложения Service Academy:",');
    const bundle = rd("supabase/functions/app-api/index.ts");
    expect(bundle).toContain('"Стиль уроков приложения Service Academy:",');
    expect(NET_RE.test(bundle)).toBe(false);
  });
  it("ресторан собеседника Наставник знает — в личной части подсказки, не в общей", async () => {
    const chat = await import("../supabase/functions/ai-chat/index.ts");
    const p = chat.buildSystemParts({ name: "Анна", position: "waiter", restaurant: "Маяк" }, "");
    expect(p.stable).not.toContain("Маяк");
    expect(p.personal).toContain("ресторан «Маяк»");
  });
});
