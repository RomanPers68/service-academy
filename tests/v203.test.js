// v203 (Доп. 528): новинки меню — первыми в живой проверке и на брифинге, золотая точка «новинки» у всех.
// Владелец перед зимним меню спросил, будут ли новинки в приоритете в ежедневных подсказках и учитываются ли новые
// позиции. Разминка, «Вопрос дня», брифинг и «Новые позиции» уже ставили новинки первыми; не ставили живая проверка
// «Меню заведения» и вопрос о блюде на брифинге (v202), а точка «новинки» на значке «Меню» горела только на телефоне, где
// блюда добавляли. На «Исправить?» — «Да, давай».
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v203.mjs.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { RESTAURANT_MENUS } from "../data/menu.js";
import { MODULES_INDEX } from "../data/modules-index.js";
import { LIVE_CHECK } from "../data/live-check.js";
import { menuQuestions, menuPick, briefQuestion, briefPick, LC_MENU } from "../lib/live-check.js";
import { isNewDish, NEW_DAYS } from "../lib/menu-repeat.js";
import { newOf, newOnPhone, NEW_MS } from "../lib/menu-stops.js";
import { countNewDishes } from "../data/reviews.js";
import { useMenuNew } from "../ui/stop-badge.jsx";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R0 = "Два моря, Океан";
const DAY = 864e5;
const now = Date.UTC(2026, 10, 27, 2, 0);
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const dish = (id, x = {}) => ({ id, name: "Блюдо " + id, cat: "Горячее", ingredients: ["Первое", "Второе"], allergens: [], desc: "Тёплое. Сытное.", ...x });
const fresh = (id, ago = 1) => dish(id, { isNew: true, addedAt: now - ago * DAY });

describe("v203 · версия и журнал", () => {
  it("сборка v203, Дополнение 528 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(203);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 528 — .*\(v203\)/);
    const part = c.slice(c.indexOf("# Дополнение 528"));
    for (const w of ["«Да, давай»", "Меню заведения", "Проверка на брифинге", "Выучил новинки ✓", "tools/claude/e2e-v203.mjs (13 проверок)"]) expect(part, w).toContain(w);
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v203 · новинки первыми в живой проверке и на брифинге", () => {
  it("вопросы о блюдах: новинка — по правилу разминки (30 дней), новинки первыми и не отрезаются по max", () => {
    const list = [...Array.from({ length: 70 }, (_, i) => dish("o" + i)), fresh("w1", 2), dish("old", { isNew: true, addedAt: now - 40 * DAY }), dish("future", { isNew: true, addedAt: now + 3 * DAY }), fresh("w2", 29)];
    const qs = menuQuestions(list, { now, max: 60 });
    expect(qs.length).toBe(60);
    expect(qs.slice(0, 2).map((q) => [q.n, q.isNew])).toEqual([["w1", true], ["w2", true]]);
    expect(qs.filter((q) => q.isNew).length).toBe(2);
    for (const d of list) expect(qs.some((q) => q.n === d.id && q.isNew) || !isNewDish(d, now)).toBe(true);   // то же правило
    expect(NEW_DAYS).toBe(30);
    expect(menuQuestions(RESTAURANT_MENUS[R0], { now }).some((q) => q.isNew)).toBe(false);   // у заготовок новинок нет
  });
  it("«Меню заведения»: сначала новинки, которые недавно не задавали, потом другие; недавние — в конце, новинки первыми", () => {
    const qs = menuQuestions([dish("a"), dish("b"), dish("c"), fresh("n1"), fresh("n2"), fresh("n3")], { now });
    const p = menuPick(qs, new Set(), seeded(3), 4);
    expect(p.length).toBe(4);
    expect(new Set(p.slice(0, 3).map((q) => q.n))).toEqual(new Set(["n1", "n2", "n3"]));
    expect(["a", "b", "c"]).toContain(p[3].n);
    expect(p.every((q) => q.m === LC_MENU && q.k === "menu#" + q.n)).toBe(true);
    const p2 = menuPick(qs, new Set(["menu#n1", "menu#n2"]), seeded(5), 4);
    expect(p2[0].n).toBe("n3");
    expect(p2.slice(1, 4).map((q) => q.n).sort()).toEqual(["a", "b", "c"]);
    const p3 = menuPick(qs, new Set(qs.map((q) => "menu#" + q.n)), seeded(7), 4);   // всё недавно — новинки всё равно первыми
    expect(new Set(p3.slice(0, 3).map((q) => q.n))).toEqual(new Set(["n1", "n2", "n3"]));
    expect(menuPick([], new Set())).toEqual([]);
  });
  it("брифинг: вопрос о блюде — о новинке; заданная — другая новинка; новинок не осталось — любое блюдо", () => {
    const menuQs = menuQuestions([dish("a"), dish("b"), fresh("n1"), fresh("n2")], { now });
    const anna = { id: "e-anna", name: "Анна", position: "waiter", quiz: [], checks: [] };
    for (let s = 1; s < 30; s++) expect(briefQuestion(anna, { menuQs, menu: true, rng: seeded(s) }).n).toMatch(/^n[12]$/);
    expect(briefQuestion(anna, { menuQs, menu: true, rng: seeded(2), exclude: new Set(["menu#n1"]) }).n).toBe("n2");
    expect(["a", "b"]).toContain(briefQuestion(anna, { menuQs, menu: true, rng: seeded(2), exclude: new Set(["menu#n1", "menu#n2"]) }).n);
    const people = [anna, { id: "e-petr", name: "Пётр", position: "waiter", quiz: [], checks: [] }];
    const pick = briefPick({ people, onShift: null, modsByTrack: MODULES_INDEX, bank: LIVE_CHECK, menuQs, now, rng: seeded(9) });
    expect(pick.filter((x) => x.q.m === LC_MENU).map((x) => x.q.n)[0]).toMatch(/^n[12]$/);
  });
  it("экраны: «Меню заведения» берёт новинки первыми, «Новинок в меню: N», у вопроса и на брифинге «· новинка»", () => {
    const s = rd("ui/live-check.jsx");
    expect(s).toContain('kind === "menu" ? menuPick(menuQs || [], recent) :');
    expect(s).toContain('{runQ.isNew ? " · новинка" : ""}');
    expect(s).toContain('const menuNewN = (menuQs || []).filter((q) => q.isNew).length;');
    expect(s).toContain('{"Новинок в меню: " + menuNewN + ", спрошу о них первыми"}');
    expect(rd("ui/brief-live-check.jsx")).toContain('(q.isNew ? " · новинка" : "")');
  });
});

describe("v203 · точка «новинки» на значке «Меню» у всех", () => {
  const realLS = globalThis.localStorage;
  let m;
  beforeEach(() => { m = new Map(); globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; });
  afterEach(() => { globalThis.localStorage = realLS; });
  it("свои блюда и меню команды: без архива, удалённого, напитков и карты бара; своя правка — одна; волна — самая поздняя", () => {
    const shared = [fresh("t1", 3), fresh("t2", 1), fresh("mine", 5), fresh("arch"), dish("tz"), fresh("del"), { ...fresh("ck"), kind: "cocktail" }, { ...fresh("__barcard__") },
      { ...fresh("old", 31) }, { id: "noname", isNew: true, addedAt: now }];
    shared.find((d) => d.id === "arch").archived = true;
    const custom = [fresh("mine", 5), fresh("own1", 2), { ...fresh("own2"), archived: true }];
    const v = newOf({ custom, shared, deleted: ["del"], now });
    expect(v.n).toBe(4);   // mine, own1, t1, t2
    expect(v.wave).toBe(String(now - DAY));
    expect(newOf({ now })).toEqual({ n: 0, wave: "0" });
    expect(NEW_MS).toBe(30 * DAY);
  });
  it("на телефоне сотрудника: новинки из меню команды; «Выучил новинки ✓» — эта волна выучена; новая новинка — снова", () => {
    m.set("sa_menu_shared", JSON.stringify({ [R0]: [fresh("w1", 2), fresh("w2", 1), dish("x")] }));
    expect(newOnPhone(R0, now)).toEqual({ n: 2, wave: String(now - DAY), learned: false });
    expect(countNewDishes(R0)).toBe(2);   // раньше — 0: считались только свои блюда
    expect(countNewDishes("")).toBe(0);
    m.set("sa_menu_learned_" + R0, String(now - DAY));
    expect(newOnPhone(R0, now).learned).toBe(true);
    m.set("sa_menu_shared", JSON.stringify({ [R0]: [fresh("w1", 2), fresh("w2", 1), fresh("w3", 0.5)] }));
    expect(newOnPhone(R0, now)).toMatchObject({ n: 3, learned: false });
    expect(newOnPhone("", now)).toEqual({ n: 0, wave: "0", learned: false });
  });
  it("правило и волна — как «Новые позиции» в «Меню» (ui/menu-trainer.jsx)", () => {
    const t = rd("ui/menu-trainer.jsx");
    expect(t).toContain("dishes.filter(d => d.isNew && d.addedAt && Date.now() - d.addedAt < 30 * 864e5), [dishes]);");
    expect(t).toContain("String(newDishes.reduce((m, d) => Math.max(m, d.addedAt || 0), 0)), [newDishes]);");
    expect(t).toContain('localStorage.setItem("sa_menu_learned_" + restaurant, wave);');
    expect(t).toContain("d.kind !== \"cocktail\" && d.kind !== \"wine\" && d.kind !== \"spirit\" && !ownIds.has(d.id) && !del.has(d.id) && !d.archived");
  });
  it("главная: точка из useMenuNew (свои и команды), выученная волна не горит; число «в стопе» важнее точки", () => {
    m.set("sa_menu_shared", JSON.stringify({ [R0]: [fresh("w1", 2), fresh("w2", 1)] }));
    const Probe = ({ on = true }) => { const v = useMenuNew(R0, on); return h("i", null, v.n + ":" + v.learned); };
    expect(renderToString(h(Probe))).toBe("<i>2:false</i>");
    expect(renderToString(h(Probe, { on: false }))).toBe("<i>0:false</i>");
    const home = rd("ui/screens-roleselect.jsx");
    expect(home).toContain('const menuNewV = useMenuNew(profile?.restaurant || "", !!onMenuTrainer && !!profile);');
    expect(home).toContain("const menuNew = menuNewV.learned ? 0 : menuNewV.n;");
    expect(home).toContain('{stop > 0 ? <StopBadge n={stop} a11y={a11y} /> : (badge || dot) ? (');
    expect(home).toContain('<span data-menu-dot={badge ? "new" : "day"}');
    expect(home).not.toContain("countNewDishes");
    const sb = rd("ui/stop-badge.jsx");
    expect(sb).toContain('const off = menuSubscribe((r, why) => { if ((!r || r === restaurant) && why === "fresh") read(); });');
    expect(rd("data/reviews.js")).toContain("export const countNewDishes = (restaurant) => (restaurant ? newOnPhone(restaurant).n : 0);");
    expect(rd("data/reviews.js")).not.toMatch(/from "\.\/menu"/);   // заготовки меню (53 КБ) на старте по-прежнему не тянем
  });
});
