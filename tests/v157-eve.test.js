// v157 (Доп. 481–482): вечерние огни на главной — в заданный час. Главная зависит от часов (приветствие, свет Доп. 146,
// огни v157), а тесты идут когда придётся: на GitHub — по UTC. Проверка на GitHub в первый же запуск (01:25 UTC — «ночь»)
// поймала tests/v44.test.js, который сверял строку приветствия и ходил только днём. Здесь час задан: день, вечер, ночь.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const noop = () => {};
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const T4 = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false,
  roleHeader: {}, roleSubtitle: {}, roleList: {}, roleCard: {}, roleAccent: {}, roleIcon: {}, roleInfo: {}, roleLabel: {}, roleSublabel: {}, roleDesc: {} };
const profile = { name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter" };
const RealDate = Date;
// главная в заданный час: «сейчас» — 14 ноября 2026, hour:30 по часам машины, где идут тесты
const atHour = async (hour, extra = {}) => {
  class FixedDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(2026, 10, 14, hour, 30, 0); }
    static now() { return new RealDate(2026, 10, 14, hour, 30, 0).getTime(); }
  }
  globalThis.Date = FixedDate;
  try {
    const { RoleSelect } = await import("../ui/screens-roleselect");
    return R(h(RoleSelect, { T: T4, a11y: false, profile, role: null, onSelect: noop, onContinueLesson: noop, onGuestBook: noop, onSchedule: noop, customByRole: {}, ...extra }));
  } finally { globalThis.Date = RealDate; }
};
const GREET = '<div style="padding:2px 20px 8px;display:flex;align-items:baseline;justify-content:space-between;gap:10px';
const lights = (html) => (html.match(/<i style="left:calc\(/g) || []).length;

describe("v157: главная в разное время суток", () => {
  it("днём огней нет, приветствие и логотип — как до v157", async () => {
    for (const hour of [6, 11, 17]) {
      const html = await atHour(hour);
      expect(html).not.toContain("data-eve-lights");
      expect(html).not.toContain("sa-evl");
      expect(html).toContain(GREET + '">');
      expect(html).not.toContain("position:relative\"><img");
      expect(html).toContain(hour < 12 ? "Доброе утро" : "Добрый день");
    }
  });
  it("вечером — десять огней, логотип и приветствие над ними", async () => {
    for (const hour of [18, 19, 23]) {
      const html = await atHour(hour);
      expect(html).toContain('<div class="sa-evl" data-eve-lights="evening" aria-hidden="true"');
      expect(lights(html)).toBe(10);
      expect(html).toContain(GREET + ';position:relative">');
      expect(html).toMatch(/<div style="display:flex;flex-direction:column;align-items:center;padding:[^"]*;position:relative"><img /);
      expect(html).toContain("Добрый вечер");
      expect(html).toContain("pointer-events:none");
    }
  });
  it("ночью — четыре огня, тише", async () => {
    const html = await atHour(1);
    expect(html).toContain('data-eve-lights="night"');
    expect(lights(html)).toBe(4);
    expect(html).toContain(GREET + ';position:relative">');
    expect(html).toContain("Доброй ночи");
    expect(html).toContain("rgba(232,190,120,0.072)");   // 0,12 × 0,6
    expect(await atHour(19)).toContain("rgba(232,190,120,0.120)");
  });
  it("«Для чтения» — без огней в любой час", async () => {
    for (const hour of [1, 11, 19]) {
      const html = await atHour(hour, { a11y: true });
      expect(html).not.toContain("data-eve-lights");
      expect(html).toContain(GREET + '">');
    }
  });
  it("часы после теста — настоящие", () => {
    expect(globalThis.Date).toBe(RealDate);
  });
});
