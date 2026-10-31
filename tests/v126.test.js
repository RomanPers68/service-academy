// v126 (Доп. 439): выученное до v125 — на сервер. Владелец (31.10): «Да, давай» — кто нажал «Выучил новые вина ✓» до
// обновления, запомнил это только на телефоне, и в «Кто выучил новые вина» (этап 44) был «учит». lib/wine-train.js
// (syncKey, catchUpPlan, sentAfter, otherUsers), lib/wine-sync.js (wineCatchUp, markSent), api/supabase.js (rpcSync отвечает,
// чем кончилось), App.jsx (через 8 с после входа), ui/wine-list.jsx (при открытии карты), ui/wine-train.jsx (wineReport
// запоминает, что ушло). e2e — tools/claude/e2e-v126.mjs.
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import * as W from "../lib/wine.js";
import * as R from "../lib/wine-train.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const NOW = Date.now(), DAY = 864e5;
const mk = (o, id, opt = {}) => W.normWine({ ...o }, { id, ...opt });
const CARD = [
  mk({ name: "Просекко", color: "sparkling", byGlass: true, addedAt: NOW - 2 * DAY }, "w-pro"),
  mk({ name: "Шабли", color: "white", byGlass: true, addedAt: NOW - 2 * DAY }, "w-cha"),
  mk({ name: "Пино Нуар", color: "red", byGlass: true }, "w-pin"),
  mk({ name: "Кьянти", color: "red" }, "w-chi"),
];
const SR = { "w-pro": { stage: 1, due: NOW + 2 * DAY }, "w-cha": { stage: 1, due: NOW + 2 * DAY }, "w-chi": { stage: 2, due: NOW + 3 * DAY } };
const STATS = { known: 3, total: 4, glassKnown: 2, glassTotal: 3 };

describe("v126: что досылать", () => {
  it("выученная волна, которой сервер не видел, — passed; потом счёт «Знаю?», если тренировался, а он не уходил; иначе ничего", () => {
    expect(R.syncKey("Два моря")).toBe("sa_wine_sync_Два моря");
    expect(R.catchUpPlan(["w-pro", "w-cha"], SR, {})).toEqual({ kind: "passed", ids: ["w-pro", "w-cha"] });
    expect(R.catchUpPlan(["w-pro", "w-cha"], SR, { passed: "w-pro,w-cha", stats: 1 })).toBe(null);
    expect(R.catchUpPlan(["w-pro", "w-cha", "w-gav"], SR, { passed: "w-pro,w-cha", stats: 1 })).toEqual({ kind: "passed", ids: ["w-pro", "w-cha", "w-gav"] });
    expect(R.catchUpPlan([], SR, {})).toEqual({ kind: "stats", ids: [] });
    expect(R.catchUpPlan([], SR, { stats: 1 })).toBe(null);
    expect(R.catchUpPlan([5, "", null], {}, null)).toBe(null);
    expect(R.catchUpPlan("w-pro", [], "x")).toBe(null);
  });
  it("что ушло: волна — у passed, счёт «Знаю?» — с любым сообщением", () => {
    expect(R.sentAfter({}, "passed", ["w-pro", "w-cha"])).toEqual({ passed: "w-pro,w-cha", stats: 1 });
    expect(R.sentAfter({ passed: "w-pro" }, "opened", ["w-pro"])).toEqual({ passed: "w-pro", stats: 1 });
    expect(R.sentAfter(null, "stats")).toEqual({ stats: 1 });
  });
  it("другие люди на телефоне — по личным ключам роли и серии; свой ключ и чужие ключи без имени не считаются", () => {
    const keys = ["sa_last_role_Анна_Смирнова", "sa_streak_Анна_Смирнова", "sa_last_role", "sa_wine_sr_Два моря", "sa_streak_Пётр_Орлов", "sa_last_role_Пётр_Орлов"];
    expect(R.otherUsers("_Анна_Смирнова", keys)).toEqual(["_Пётр_Орлов"]);
    expect(R.otherUsers("_Анна_Смирнова", keys.slice(0, 4))).toEqual([]);
    expect(R.otherUsers("", ["sa_last_role_Анна_Смирнова"])).toEqual(["_Анна_Смирнова"]);
  });
});

// телефон: хранилище с length и key(i) (как localStorage) и сеть, которая отвечает как сервер
class Mem {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
describe("v126: телефон досылает (lib/wine-sync.js)", () => {
  const realLs = globalThis.localStorage, realFetch = globalThis.fetch;
  const ls = new Mem(), sent = [];
  let mode = "ok";
  globalThis.localStorage = ls;
  globalThis.fetch = async (url, opts) => {
    sent.push({ fn: String(url).split("/rpc/")[1], body: JSON.parse(opts.body) });
    if (mode === "offline") throw new Error("offline");
    if (mode === "drop") return { ok: false, status: 404, json: async () => ({ code: "PGRST202" }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  afterAll(() => { globalThis.localStorage = realLs; globalThis.fetch = realFetch; });
  const UK = "_Анна_Смирнова";
  const phone = (rest, { learned = ["w-pro", "w-cha"], sr = SR, extra = {} } = {}) => {
    ls.setItem("sa_session_token", "tok-anna"); ls.setItem("sa_last_role" + UK, '"seasonal"');
    if (learned) ls.setItem(R.learnedKey(rest), JSON.stringify(learned));
    if (sr) ls.setItem(R.srKey(rest), JSON.stringify(sr));
    for (const [k, v] of Object.entries(extra)) ls.setItem(k, v);
  };
  const flag = (rest) => JSON.parse(ls.getItem(R.syncKey(rest)) || "null");
  beforeEach(() => { ls.clear(); sent.length = 0; mode = "ok"; });

  it("выученное до v125 ушло (волна и счёт «Знаю?») и запомнено; в этом запуске и после — второй раз не шлёт", async () => {
    const { wineCatchUp } = await import("../lib/wine-sync.js");
    phone("R1");
    expect(await wineCatchUp({ restaurant: "R1", uk: UK, wines: CARD })).toBe("passed");
    expect(sent).toEqual([{ fn: "wine_progress_set", body: { p_token: "tok-anna", p_kind: "passed", p_data: { ids: ["w-pro", "w-cha"], stats: STATS } } }]);
    expect(flag("R1")).toEqual({ passed: "w-pro,w-cha", stats: 1 });
    expect(await wineCatchUp({ restaurant: "R1", uk: UK, wines: CARD })).toBe(null);
    expect(sent.length).toBe(1);
  });
  it("вина — из меню на телефоне; без проверенных вин не шлёт (счёт «0 из 0» ни к чему)", async () => {
    const { wineCatchUp } = await import("../lib/wine-sync.js");
    phone("R2");
    expect(await wineCatchUp({ restaurant: "R2", uk: UK })).toBe(null);
    ls.setItem("sa_menu_shared", JSON.stringify({ R2: [{ id: "d1", name: "Борщ" }, ...CARD.map((w) => ({ ...w, ai: ["country"] }))] }));
    expect(await wineCatchUp({ restaurant: "R2", uk: UK })).toBe(null);
    ls.setItem("sa_menu_shared", JSON.stringify({ R2: [{ id: "d1", name: "Борщ" }, ...CARD] }));
    expect(await wineCatchUp({ restaurant: "R2", uk: UK })).toBe("passed");
    expect(sent.map((x) => x.body.p_data.stats)).toEqual([STATS]);
  });
  it("только «Знаю?» — уходит только счёт", async () => {
    const { wineCatchUp } = await import("../lib/wine-sync.js");
    phone("R3", { learned: null });
    expect(await wineCatchUp({ restaurant: "R3", uk: UK, wines: CARD })).toBe("stats");
    expect(sent[0].body).toEqual({ p_token: "tok-anna", p_kind: "stats", p_data: { stats: STATS } });
    expect(flag("R3")).toEqual({ stats: 1 });
  });
  it("общий телефон (входил другой человек), нет входа, всё уже ушло — ничего не шлёт", async () => {
    const { wineCatchUp } = await import("../lib/wine-sync.js");
    phone("R4", { extra: { "sa_streak_Пётр_Орлов": "{}" } });
    expect(await wineCatchUp({ restaurant: "R4", uk: UK, wines: CARD })).toBe(null);
    ls.clear(); phone("R5"); ls.removeItem("sa_session_token");
    expect(await wineCatchUp({ restaurant: "R5", uk: UK, wines: CARD })).toBe(null);
    ls.clear(); phone("R6", { extra: { [R.syncKey("R6")]: JSON.stringify({ passed: "w-pro,w-cha", stats: 1 }) } });
    expect(await wineCatchUp({ restaurant: "R6", uk: UK, wines: CARD })).toBe(null);
    expect(await wineCatchUp({ uk: UK, wines: CARD })).toBe(null);
    expect(sent.length).toBe(0);
  });
  it("сервер отверг (нет этапа 44) — «ушло» не запомнено, дошлётся в другой раз; нет сети — в очереди, запомнено", async () => {
    const { wineCatchUp } = await import("../lib/wine-sync.js");
    mode = "drop"; phone("R7");
    expect(await wineCatchUp({ restaurant: "R7", uk: UK, wines: CARD })).toBe(null);
    expect(flag("R7")).toEqual({});
    mode = "offline"; phone("R8");
    expect(await wineCatchUp({ restaurant: "R8", uk: UK, wines: CARD })).toBe("passed");
    expect(flag("R8")).toEqual({ passed: "w-pro,w-cha", stats: 1 });
    expect(JSON.parse(ls.getItem("sa_sync_queue")).map((x) => [x.fn, x.params.p_kind])).toEqual([["wine_progress_set", "passed"]]);
  });
  it("markSent запоминает сразу и умеет вернуть как было; rpcSync отвечает, чем кончилось", async () => {
    const { markSent } = await import("../lib/wine-sync.js");
    const { rpcSync } = await import("../api/supabase.js");
    ls.setItem(R.syncKey("R9"), JSON.stringify({ stats: 1 }));
    const undo = markSent("R9", "passed", ["w-pro"]);
    expect(flag("R9")).toEqual({ stats: 1, passed: "w-pro" });
    undo();
    expect(flag("R9")).toEqual({ stats: 1 });
    expect(await rpcSync("x", {})).toBe("ok");
    mode = "drop"; expect(await rpcSync("x", {})).toBe("drop");
    mode = "offline"; expect(await rpcSync("x", {})).toBe("retry");
  });
});

describe("v126: где досылается", () => {
  const APP = rd("App.jsx"), L = rd("ui/wine-list.jsx"), TR = rd("ui/wine-train.jsx"), API = rd("api/supabase.js"), S = rd("lib/wine-sync.js");
  it("через 8 с после входа (App), при открытии винной карты; wineReport запоминает, что ушло, и возвращает при отказе", () => {
    expect(APP).toContain('import { wineCatchUp } from "./lib/wine-sync";');
    expect(APP).toContain("const t = setTimeout(() => { wineCatchUp({ restaurant: profile.restaurant, uk: ukP }); }, 8000);");
    expect(L).toContain("const [shared, , menuLoaded] = useTeamMenu(restaurant);");
    expect(L).toContain("React.useEffect(() => { if (menuLoaded) wineCatchUp({ restaurant, uk, wines: all }); }, [menuLoaded]);");
    expect(TR).toContain("const undo = markSent(restaurant, kind, data && data.ids);");
    expect(TR).toContain('.then((res) => { if (res === "drop") undo(); })');
    expect(API).toMatch(/else if \(res === "ok"\) \{ flushQueue\(\); \}\n    return res;\n  \}\);/);
    expect(S).toContain("if (!plan || otherUsers(uk, keys()).length) return Promise.resolve(null);");
    expect(S).toContain("if (!stats.total) return Promise.resolve(null);");
  });
  it("README, CHANGES; без тире-ритма и эмодзи в новом коде; метка — v126", () => {
    expect(rd("tools/claude/README.md")).toContain("`e2e-v126.mjs` — v126 (Доп. 439)");
    expect(rd("CHANGES.md")).toContain("# Дополнение 439 — выученное до v125 — на сервер");
    for (const f of ["lib/wine-sync.js", "lib/wine-train.js", "ui/wine-train.jsx", "ui/wine-list.jsx"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v126</span>");
  });
});
