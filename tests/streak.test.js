// Серия дней с учётом графика (Доп. 288): выходной по графику серию не сжигает.
import { describe, it, expect } from "vitest";
import { nextStreak, dayOffFromSchedule, ymd } from "../lib/streak";

const D = (s) => new Date(s + "T12:00:00");

function fakeStorage(obj) {
  const keys = Object.keys(obj);
  return { length: keys.length, key: (i) => keys[i], getItem: (k) => (k in obj ? obj[k] : null) };
}

// октябрь 2026: у Анны смены 9, 10 и 12, остальные дни — выходные
const SCHED = {
  "sa_sched_cache_okean_2026-10": JSON.stringify({
    cfg: { staff: [{ id: "s1", name: "Анна Смирнова" }, { id: "s2", name: "Иван Петров" }], shifts: [{ k: "У" }, { k: "Д" }, { k: "В" }] },
    plan: { s1: { 9: "Д", 10: "У", 12: "В" }, s2: { 11: "Д" } },
  }),
  "sa_other_key": "x",
};
const anna = { name: "Анна", surname: "Смирнова" };

describe("nextStreak", () => {
  it("первый день начинает серию", () => {
    const s = nextStreak(null, D("2026-10-11"));
    expect(s.count).toBe(1);
    expect(s.best).toBe(1);
    expect(s.last).toBe("2026-10-11");
    expect(s.days).toEqual(["2026-10-11"]);
  });
  it("второй раз за день ничего не меняет (тот же объект)", () => {
    const a = nextStreak(null, D("2026-10-11"));
    expect(nextStreak(a, D("2026-10-11"))).toBe(a);
  });
  it("вчера → +1, рекорд растёт", () => {
    const a = { count: 4, best: 4, last: "2026-10-10", days: ["2026-10-10"] };
    const s = nextStreak(a, D("2026-10-11"));
    expect(s.count).toBe(5);
    expect(s.best).toBe(5);
    expect(s.days).toEqual(["2026-10-10", "2026-10-11"]);
  });
  it("пропуск без графика — серия с нуля, рекорд остаётся", () => {
    const a = { count: 9, best: 12, last: "2026-10-08", days: [] };
    const s = nextStreak(a, D("2026-10-11"));
    expect(s.count).toBe(1);
    expect(s.best).toBe(12);
  });
  it("между занятиями только выходные по графику — серия продолжается, дни заморожены", () => {
    const a = { count: 3, best: 3, last: "2026-10-08", days: [] };
    const off = (d) => ["2026-10-09", "2026-10-10"].includes(ymd(d));
    const s = nextStreak(a, D("2026-10-11"), off);
    expect(s.count).toBe(4);
    expect(s.frozen).toEqual(["2026-10-10", "2026-10-09"]);
  });
  it("пропущенная смена сжигает серию", () => {
    const a = { count: 3, best: 3, last: "2026-10-08", days: [] };
    const off = (d) => ymd(d) === "2026-10-10";      // 9-го — смена, пропущена
    expect(nextStreak(a, D("2026-10-11"), off).count).toBe(1);
  });
  it("«неизвестно» (графика нет) — как раньше: пропуск сжигает", () => {
    const a = { count: 3, best: 3, last: "2026-10-09", days: [] };
    expect(nextStreak(a, D("2026-10-11"), () => null).count).toBe(1);
  });
  it("заморозка не дольше недели", () => {
    const a = { count: 5, best: 5, last: "2026-09-20", days: [] };
    expect(nextStreak(a, D("2026-10-11"), () => true).count).toBe(1);
  });
  it("ошибка в проверке графика не ломает серию", () => {
    const a = { count: 2, best: 2, last: "2026-10-10", days: [] };
    const s = nextStreak(a, D("2026-10-11"), () => { throw new Error("x"); });
    expect(s.count).toBe(3);
  });
  it("новая серия забывает старые замороженные дни", () => {
    const a = { count: 2, best: 6, last: "2026-10-01", days: [], frozen: ["2026-09-28"] };
    expect(nextStreak(a, D("2026-10-11")).frozen).toEqual([]);
  });
});

describe("dayOffFromSchedule", () => {
  const ls = fakeStorage(SCHED);
  it("день со сменой → false", () => { expect(dayOffFromSchedule(anna, D("2026-10-09"), ls)).toBe(false); });
  it("день без смены → true (выходной)", () => { expect(dayOffFromSchedule(anna, D("2026-10-11"), ls)).toBe(true); });
  it("месяц без сохранённого графика → null", () => { expect(dayOffFromSchedule(anna, D("2026-11-03"), ls)).toBe(null); });
  it("не нашли себя в графике → null", () => { expect(dayOffFromSchedule({ name: "Ольга", surname: "Ким" }, D("2026-10-11"), ls)).toBe(null); });
  it("ищет по имени, как экран графика (ё = е, регистр, порядок слов)", () => {
    expect(dayOffFromSchedule({ name: "смирнова", surname: "АННА" }, D("2026-10-10"), ls)).toBe(false);
  });
  it("без профиля → null", () => { expect(dayOffFromSchedule(null, D("2026-10-10"), ls)).toBe(null); });
  it("в графике есть, но смен на месяц нет → null (не знаем)", () => {
    const ls2 = fakeStorage({ "sa_sched_cache_okean_2026-10": JSON.stringify({ cfg: { staff: [{ id: "s1", name: "Анна Смирнова" }], shifts: [{ k: "Д" }] }, plan: {} }) });
    expect(dayOffFromSchedule(anna, D("2026-10-10"), ls2)).toBe(null);
  });
});
