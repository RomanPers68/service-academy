// v28 (Доп. 294–306): журнал дня и цель, разминка, «подсмотреть в уроке», «вслух»,
// значки ситуаций, тихая подгрузка графика, самая свежая копия графика.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { bumpActivity, readActivity, stepsOn, readGoal, saveGoal, weekSummary, weekShareText } from "../lib/activity";
import { warmupPool, pickWarmup } from "../lib/warmup";
import { peekFor } from "../lib/peek";
import { checkSaid, phraseWords } from "../lib/say-check";
import { iconForSituation, SIT_ICON_KEYS } from "../lib/situation-icons";
import { syncMySchedule, DEFAULT_SHIFTS, BG_KEY, findMe, todayLabel } from "../lib/schedule-sync";
import { myShiftOn, ymd } from "../lib/streak";
import { lessonCards } from "../lib/lesson-cards";
import { topicShade, inkOnColor } from "../lib/topic-tint";
import { SEASONAL_MODULES } from "../data/modules-seasonal";

function mem(init = {}) {
  const o = { ...init };
  return {
    o,
    get length() { return Object.keys(o).length; },
    key: (i) => Object.keys(o)[i],
    getItem: (k) => (k in o ? o[k] : null),
    setItem: (k, v) => { o[k] = String(v); },
    removeItem: (k) => { delete o[k]; },
  };
}
const D = (s, h = 12) => { const d = new Date(s + "T00:00:00"); d.setHours(h, 0, 0, 0); return d; };

describe("журнал дня и цель (Доп. 298)", () => {
  it("шаги считаются только по шагам, ситуации и исправления — отдельно", () => {
    const ls = mem();
    bumpActivity("_a", "lesson", 1, D("2026-10-12"), ls);
    bumpActivity("_a", "sit", 3, D("2026-10-12"), ls);
    bumpActivity("_a", "warmup", 1, D("2026-10-12"), ls);
    bumpActivity("_a", "fix", 2, D("2026-10-12"), ls);
    bumpActivity("_a", "unknown", 5, D("2026-10-12"), ls);
    const act = readActivity("_a", ls);
    const r = act["2026-10-12"];
    expect([r.l, r.s, r.w, r.f, r.st]).toEqual([1, 3, 1, 2, 2]);
    expect(Object.keys(r).sort()).toEqual(["f", "l", "s", "st", "w"]);
    expect(stepsOn(act, "2026-10-12")).toBe(2);
    expect(stepsOn(act, "2026-10-11")).toBe(0);
  });
  it("журнал у каждого свой и хранит 60 дней", () => {
    const ls = mem();
    bumpActivity("_a", "lesson", 1, D("2026-07-01"), ls);
    bumpActivity("_b", "lesson", 1, D("2026-10-12"), ls);
    bumpActivity("_a", "quiz", 1, D("2026-10-12"), ls);
    expect(Object.keys(readActivity("_a", ls))).toEqual(["2026-10-12"]);
    expect(Object.keys(readActivity("_b", ls))).toEqual(["2026-10-12"]);
  });
  it("цель 1–3, по умолчанию 2; мусор не ломает", () => {
    const ls = mem({ sa_goal_x: "7" });
    expect(readGoal("_x", ls)).toBe(2);
    expect(saveGoal("_x", 3, ls)).toBe(3);
    expect(readGoal("_x", ls)).toBe(3);
    expect(saveGoal("_x", 9, ls)).toBe(3);
    expect(saveGoal("_x", 0, ls)).toBe(2);
    expect(readActivity("_y", mem({ sa_activity_y: "[1,2]" }))).toEqual({});
  });
  it("чек недели: 7 дней, дни в деле, выходные по графику, текст для команды", () => {
    const act = { "2026-10-06": { l: 1, st: 1 }, "2026-10-08": { s: 4, p: 1, st: 1 }, "2026-10-12": { w: 1, st: 1 } };
    const streak = { count: 3, days: ["2026-10-07"], frozen: ["2026-10-09"] };
    const sum = weekSummary(act, streak, D("2026-10-12"));
    expect(sum.from).toBe("2026-10-06");
    expect(sum.to).toBe("2026-10-12");
    expect(sum.days.map((d) => d.dow)).toEqual([1, 2, 3, 4, 5, 6, 0]);   // вт … пн
    expect(sum.activeDays).toBe(4);
    expect(sum.days[3].frozen).toBe(true);
    expect(sum.totals.st).toBe(3);
    const txt = weekShareText(sum, streak, "Анна");
    expect(txt).toContain("Чек недели — Анна");
    expect(txt).toContain("1 урок");
    expect(txt).toContain("4 ситуации у стола");
    expect(txt).toContain("1 разминка до смены");
    expect(txt).toContain("Дней в деле: 4 из 7 · серия 3 дня");
  });
});

describe("разминка до смены (Доп. 301)", () => {
  it("только из начатых разделов; ничего не начато — первый раздел", () => {
    const pool = warmupPool(SEASONAL_MODULES, { "s1-1": true }, {});
    expect(pool.length).toBeGreaterThan(2);
    expect(new Set(pool.map((s) => s._mod))).toEqual(new Set(["s1"]));
    const first = warmupPool(SEASONAL_MODULES, {}, {});
    expect(new Set(first.map((s) => s._mod))).toEqual(new Set([SEASONAL_MODULES[0].id]));
  });
  it("выбор стабилен на день, жанры разные", () => {
    const pool = warmupPool(SEASONAL_MODULES, { "s0-1": true, "s1-1": true }, {});
    const a = pickWarmup(pool, 3, "2026-10-12_Анна");
    const b = pickWarmup(pool, 3, "2026-10-12_Анна");
    const c = pickWarmup(pool, 3, "2026-10-13_Анна");
    expect(a).toEqual(b);
    expect(a.length).toBe(3);
    expect(new Set(a.map((s) => s.genre || s.type)).size).toBe(3);
    expect(c.map((s) => s.scene || s.statement)).not.toEqual(a.map((s) => s.scene || s.statement));
  });
});

describe("подсмотреть в уроке (Доп. 299)", () => {
  it("для ситуаций практики находится карточка урока того же раздела", () => {
    let found = 0, total = 0;
    for (const mod of SEASONAL_MODULES) {
      const lessons = mod.lessons.filter((l) => l.type === "lesson");
      for (const l of mod.lessons.filter((x) => x.type === "practice")) {
        for (const s of l.situations || []) {
          total++;
          const p = peekFor(s, lessons);
          if (p) {
            found++;
            expect(p.lesson.type).toBe("lesson");
            expect(p.index).toBeGreaterThanOrEqual(0);
            expect(p.index).toBeLessThan(p.total);
            expect(p.lines).toEqual(lessonCards(p.lesson.content)[p.index]);
          }
        }
      }
    }
    expect(total).toBeGreaterThan(20);
    expect(found / total).toBeGreaterThan(0.8);
  });
  it("без уроков и без ситуации — null", () => {
    expect(peekFor(null, [])).toBe(null);
    expect(peekFor({ scene: "Гость ждёт" }, [])).toBe(null);
  });
});

describe("«А теперь — вслух» (Доп. 300)", () => {
  it("главные слова по основе, порядок не важен", () => {
    const r = checkSaid("Уточню у шефа — одну секунду", "одну секундочку, я уточню у шефа");
    expect(r.ok).toBe(true);
    expect(r.hits).toBe(r.total);
  });
  it("не прозвучало главное — подсвечиваем", () => {
    const r = checkSaid("Позвольте уточнить ваш заказ: два капучино", "два капучино");
    expect(r.ok).toBe(false);
    expect(r.words.filter((w) => w.hit === false).map((w) => w.text.replace(/[^а-яё]/gi, ""))).toContain("Позвольте");
  });
  it("служебные и короткие слова не считаются", () => {
    expect(phraseWords("Да, это у нас есть").filter((w) => w.key).length).toBe(0);
    expect(checkSaid("Да, это у нас есть", "что угодно").ok).toBe(false);
  });
});

describe("значки ситуаций (Доп. 295)", () => {
  it("у каждой ситуации практики — известный значок", () => {
    const keys = new Set([...SIT_ICON_KEYS, "guest"]);
    for (const mod of SEASONAL_MODULES) for (const l of mod.lessons) for (const s of l.situations || []) {
      expect(keys.has(iconForSituation(s))).toBe(true);
    }
  });
});

describe("тихая подгрузка графика (Доп. 301)", () => {
  const prof = { name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан" };
  const day = D("2026-10-12", 9);
  const resp = { ok: true,
    venues: [{ venue_key: "main", config: { staff: [{ id: "a1", name: "Смирнова Анна" }, { id: "a2", name: "Иван Петров" }] } }],
    months: [{ venue_key: "main", payload: { plan: { a1: { 12: "В", 14: "У" }, a2: { 12: "Д" } } } }] };
  it("смены по умолчанию — как в экране графика", () => {
    const src = readFileSync("ui/schedule.jsx", "utf8");   // тесты идут из корня проекта
    const block = src.slice(src.indexOf("export const DEFAULT_CONFIG"), src.indexOf("need:", src.indexOf("export const DEFAULT_CONFIG")));
    for (const sh of DEFAULT_SHIFTS) {
      expect(block).toMatch(new RegExp('k:"' + sh.k + '",\\s*name:"' + sh.name + '",\\s*from:' + sh.from + ",\\s*to:" + sh.to));
    }
  });
  it("хранит только свою строку, пишет сводку дня, второй раз за день не ходит", async () => {
    const ls = mem();
    const calls = [];
    const rpc = async (fn, p) => { calls.push([fn, p]); return resp; };
    expect(await syncMySchedule(rpc, "tok", prof, day, ls)).toBe(true);
    expect(calls[0]).toEqual(["schedule_load", { p_token: "tok", p_restaurant: "Два моря, Океан", p_month: "2026-10" }]);
    const snap = JSON.parse(ls.getItem(BG_KEY + "2026-10"));
    expect(snap.cfg.staff).toEqual([{ id: "a1", name: "Смирнова Анна" }]);
    expect(Object.keys(snap.plan)).toEqual(["a1"]);
    expect(snap.cfg.shifts.map((s) => s.k)).toEqual(DEFAULT_SHIFTS.map((s) => s.k));
    expect(JSON.parse(ls.getItem("sa_today_shift"))).toEqual({ date: "2026-10-12", label: "Вечер · 16:00–24:00" });
    const sh = myShiftOn(prof, day, ls);
    expect([sh.off, sh.key, sh.name, sh.from, sh.to]).toEqual([false, "В", "Вечер", 16, 24]);
    expect(myShiftOn(prof, D("2026-10-13"), ls)).toEqual({ off: true });
    expect(await syncMySchedule(rpc, "tok", prof, day, ls)).toBe(false);
    expect(calls.length).toBe(1);
  });
  it("себя в графике нет — копии нет; ошибка сервера — ничего не ломает", async () => {
    const ls = mem();
    expect(await syncMySchedule(async () => resp, "tok", { ...prof, name: "Ольга", surname: "Белова" }, day, ls)).toBe(false);
    expect(ls.getItem(BG_KEY + "2026-10")).toBe(null);
    const ls2 = mem();
    expect(await syncMySchedule(async () => { throw new Error("сеть"); }, "tok", prof, day, ls2)).toBe(false);
    expect(await syncMySchedule(async () => ({ ok: false, error: "auth" }), "tok", prof, day, ls2)).toBe(false);
    expect(ls2.getItem("sa_sched_sync")).toBe(null);
  });
  it("из двух копий графика берётся свежая (экран «График» или подгрузка)", () => {
    const old = { cfg: { staff: [{ id: "s1", name: "Анна Смирнова" }], shifts: DEFAULT_SHIFTS }, plan: { s1: { 12: "У" } }, ts: 1000 };
    const fresh = { cfg: { staff: [{ id: "a1", name: "Анна Смирнова" }], shifts: DEFAULT_SHIFTS }, plan: { a1: { 12: "Д" } }, ts: 2000 };
    const ls = mem({ "sa_sched_cache_main_2026-10": JSON.stringify(old), [BG_KEY + "2026-10"]: JSON.stringify(fresh) });
    expect(myShiftOn(prof, day, ls).key).toBe("Д");
    const ls2 = mem({ "sa_sched_cache_main_2026-10": JSON.stringify({ ...old, ts: 3000 }), [BG_KEY + "2026-10"]: JSON.stringify(fresh) });
    expect(myShiftOn(prof, day, ls2).key).toBe("У");
  });
  it("поиск себя и подпись смены", () => {
    expect(findMe([{ id: 1, name: "Анна Смирнова" }, { id: 2, name: "Анна Белова" }], prof).id).toBe(1);
    expect(findMe([{ id: 1, name: "Анна" }], prof).id).toBe(1);
    expect(findMe([{ id: 1, name: "Анна" }, { id: 2, name: "Смирнова" }], prof)).toBe(null);
    expect(todayLabel({ name: "Вечер", from: 16, to: 24 })).toBe("Вечер · 16:00–24:00");
    expect(ymd(day)).toBe("2026-10-12");
  });

  it("оттенки тем: цвет «путешествует» от первой темы к последней (Доп. 308)", () => {
    const base = "#7C9E87";
    const first = topicShade(base, 0, 14), last = topicShade(base, 13, 14), mid = topicShade(base, 6.5, 14);
    expect(first).toMatch(/^#[0-9A-F]{6}$/);
    expect(first).not.toBe(last);
    expect(mid.toUpperCase()).toBe(base.toUpperCase());   // середина — сам цвет трека
    expect(topicShade(base, 0, 1)).toBe(base);            // одна тема — без сдвига
    expect(topicShade("не цвет", 2, 5)).toBe("не цвет");  // непонятный цвет — как есть
    const hue = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (!d) return 0; let x = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return x * 60; };
    const span = (hue(last) - hue(first) + 360) % 360;
    expect(Math.abs(span - 80)).toBeLessThan(3);          // ±40° от цвета трека
    expect(inkOnColor("#FFFFFF")).toBe("#140D05");
    expect(inkOnColor("#1A1008")).toBe("#FFFFFF");
    expect(inkOnColor(topicShade(base, 0, 14))).toBe("#140D05");
  });
});
