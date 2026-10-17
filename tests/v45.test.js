// v45 (Доп. 358): плитка «График смен» — листок календаря и нить суток.
//
// Отзыв владельца на главную v44: «Все кайф, но вот график… Как мы его можем сделать красивее?» Из четырёх
// вариантов на настоящем экране выбран «Г · Листок + нить»: отрывной листок календаря с сегодняшним числом,
// жирный заголовок, как у «Книги отзывов», «Вечер · 17:00–24:00» (время золотом) и золотая нить суток по нижнему
// краю: смена — отрезком, «сейчас» — риской. Ничего не убрано: выходной, запасные подписи и нажатие — как были.
// Вид в браузере (320 / 360 / 375 / 393 / 430 px, обе темы, состояния, нажатие) — /home/claude/preview/e2e-v45.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { ScheduleTile, parseShift, shiftLen, shiftNow, daySegments, readTodayShift } from "../ui/schedule-tile";

const noop = () => {};
const h = React.createElement;
const RAW = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const R = (el) => RAW(el).replace(/ /g, " ");
const text = (html) => html.replace(/<[^>]+>/g, "");
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const at = (hh, mm = 0) => { const d = new Date(); d.setHours(hh, mm, 0, 0); return d; };
const src = readFileSync("ui/screens-roleselect.jsx", "utf8");
const TILE = { flex: "1 1 150px", minWidth: 0, boxSizing: "border-box", position: "relative", borderRadius: 14, cursor: "pointer" };
const el = (props) => h(ScheduleTile, { a11y: false, mgr: true, tile: TILE, frame: "rgba(1,2,3,0.4)", onOpen: noop, act: { role: "button", tabIndex: 0 }, ...props });
const T = (props) => R(el(props));

describe("v45: подпись смены разбирается", () => {
  it("parseShift: смена, ночная, выходной, другая подпись, пусто", () => {
    expect(parseShift("Вечер · 17:00–24:00")).toEqual({ name: "Вечер", from: 17, to: 24, a: "17:00", b: "24:00" });
    expect(parseShift("Ночь · 22:00-6:00")).toEqual({ name: "Ночь", from: 22, to: 6, a: "22:00", b: "6:00" });
    expect(parseShift("выходной")).toEqual({ off: true });
    expect(parseShift("Инвентаризация")).toEqual({ raw: "Инвентаризация" });
    expect(parseShift(null)).toBe(null);
    expect(parseShift("  ")).toBe(null);
  });
  it("подписи, которые пишет lib/schedule-sync.js (todayLabel), разбираются все", async () => {
    const { todayLabel, DEFAULT_SHIFTS } = await import("../lib/schedule-sync");
    for (const sh of DEFAULT_SHIFTS) {
      const p = parseShift(todayLabel(sh));
      expect([p.name, p.from, p.to]).toEqual([sh.name, sh.from, sh.to]);
    }
  });
  it("длина смены, «идёт ли сейчас», отрезки на сутках — и через полночь", () => {
    const ev = parseShift("Вечер · 17:00–24:00"), nt = parseShift("Ночь · 22:00–6:00");
    expect([shiftLen(ev), shiftLen(nt)]).toEqual([7, 8]);
    expect([shiftNow(ev, 19.5), shiftNow(ev, 16.9), shiftNow(ev, 0)]).toEqual([true, false, false]);
    expect([shiftNow(nt, 23), shiftNow(nt, 2.5), shiftNow(nt, 6), shiftNow(nt, 12)]).toEqual([true, true, false, false]);
    expect(daySegments(ev)).toEqual([[17, 24]]);
    expect(daySegments(nt)).toEqual([[22, 24], [0, 6]]);
  });
  it("readTodayShift: только сводка за сегодня; битая и пустая — ничего", () => {
    const now = at(12);
    const ls = (v) => ({ getItem: () => v });
    expect(readTodayShift(ls(JSON.stringify({ date: ymd(now), label: "Утро · 10:00–18:00" })), now)).toBe("Утро · 10:00–18:00");
    expect(readTodayShift(ls(JSON.stringify({ date: "2000-01-01", label: "Утро · 10:00–18:00" })), now)).toBe(null);
    expect(readTodayShift(ls("{oops"), now)).toBe(null);
    expect(readTodayShift(ls(null), now)).toBe(null);
  });
});

describe("v45: плитка — листок календаря и нить суток", () => {
  it("смена: листок с сегодняшним числом, жирный заголовок, «Вечер · 17:00–24:00» — время золотом и неразрывно", () => {
    const now = at(19, 30);
    const html = T({ label: "Вечер · 17:00–24:00", now });
    expect(html).toMatch(/data-tile="schedule" aria-label="График смен. Сегодня: Вечер, 17:00–24:00" role="button" tabindex="0" style="flex:1 1 150px;min-width:0/);
    expect(html).toContain('data-sched-page=""');
    expect(html).toContain("linear-gradient(180deg, #C2533A, #8A3220)");                        // красная планка
    expect(html).toMatch(new RegExp('data-sched-day=""[^>]*color:#E2C484">' + now.getDate() + "<"));
    expect(html).toMatch(/font-weight:bold">График смен</);
    expect(html).toMatch(/data-when-time="" style="[^"]*white-space:nowrap;font-family:'Piazzolla', Georgia, serif;font-weight:700;font-size:11.5px;color:#E2C484/);
    expect(html).toMatch(/aria-hidden="true" data-when-dot="" style="position:absolute;left:-7.5px[^"]*">·</);
    expect(text(html)).toContain("График сменВечер·17:00–24:00");
  });
  it("нить суток: отрезок 17–24 справа; на 19:30 риска светится, в 10:30 — золотая без сияния левее отрезка", () => {
    const html = T({ label: "Вечер · 17:00–24:00", now: at(19, 30) });
    expect(html).toContain('data-sched-thread=""');
    expect(html).toMatch(/data-seg="17-24" style="position:absolute;top:0;bottom:0;left:70.83%;width:29.17%/);
    expect(html).toMatch(/data-now="on" style="position:absolute;bottom:0;left:calc\(81.25% - 1px\);width:2px;height:7px[^"]*background:#FFF6DC;box-shadow:0 0 6px/);
    const early = T({ label: "Вечер · 17:00–24:00", now: at(10, 30) });
    expect(early).toMatch(/data-now="off" style="[^"]*left:calc\(43.75% - 1px\)[^"]*background:#E2C484;box-shadow:none/);
  });
  it("ночная смена — два отрезка, 22–24 и 0–6; в 2:30 смена идёт", () => {
    const html = T({ label: "Ночь · 22:00–6:00", now: at(2, 30) });
    expect(html).toContain('data-seg="22-24"');
    expect(html).toContain('data-seg="0-6"');
    expect(html).toContain('data-now="on"');
  });
  it("выходной: «Сегодня выходной ✦» — звезда не отрывается от слова, число приглушено, нить без отрезка", () => {
    const raw = RAW(el({ label: "выходной", now: at(12) }));
    expect(raw).toContain('Сегодня выходной <span style="color:#E2C484">✦</span>');
    expect(raw).toContain('aria-label="График смен. Сегодня выходной"');
    expect(raw).toMatch(/data-sched-day=""[^>]*color:#A99B7E">/);
    expect(raw).toContain('data-sched-thread=""');
    expect(raw).not.toContain("data-seg=");
  });
  it("графика на сегодня нет — прежние подписи, без нити; подпись другого вида — «Сегодня: …»", () => {
    const boss = T({ label: null, now: at(12) });
    expect(text(boss)).toContain("График сменСоставить, проверить и опубликовать");
    expect(boss).not.toContain("data-sched-thread");
    expect(text(T({ label: null, mgr: false, now: at(12) }))).toContain("Мой графикСмены, время и старший смены");
    const other = T({ label: "Инвентаризация", now: at(12) });
    expect(text(other)).toContain("Сегодня: Инвентаризация");
    expect(other).not.toContain("data-sched-thread");
  });
  it("светлая тема «Для чтения»: тёмное золото, кремовый листок, тёмный заголовок", () => {
    const html = T({ a11y: true, label: "Вечер · 17:00–24:00", now: at(19, 30) });
    expect(html).toMatch(/data-when-time=""[^>]*color:#7A5A22/);
    expect(html).toContain("background:#FFFCF4");
    expect(html).toContain('color:#2A1F0E;white-space:nowrap;font-family:Georgia, serif;font-weight:bold">График смен<');
    expect(html).toMatch(/data-now="on"[^>]*background:#5A3F12/);
  });
  it("без подписи в пропсах — берёт сводку «моя смена сегодня»; вчерашняя не показывается", () => {
    store.sa_today_shift = JSON.stringify({ date: ymd(new Date()), label: "Утро · 10:00–18:00" });
    expect(text(T({}))).toContain("Утро·10:00–18:00");
    const y = new Date(); y.setDate(y.getDate() - 1);
    store.sa_today_shift = JSON.stringify({ date: ymd(y), label: "Утро · 10:00–18:00" });
    expect(text(T({}))).toContain("Составить, проверить и опубликовать");
    delete store.sa_today_shift;
  });
  it("плитка — в обёртке со скруглением 12.5 px и обрезкой: нить не вылезает за углы", () => {
    const html = T({ label: "Вечер · 17:00–24:00", now: at(19, 30) });
    expect(html).toContain('<div style="overflow:hidden;position:relative;border-radius:12.5px;height:100%;box-sizing:border-box;display:flex;align-items:center;gap:9px;padding:9px 10px 10.5px">');
  });
});

describe("v45: на главной", () => {
  const T4 = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false,
    roleHeader: {}, roleSubtitle: {}, roleList: {}, roleCard: {}, roleAccent: {}, roleIcon: {}, roleInfo: {}, roleLabel: {}, roleSublabel: {}, roleDesc: {} };
  const mod = { id: "cms-m-1", title: "Свой раздел", lessons: [{ id: "cms-l-1", type: "lesson", title: "Урок: встреча гостя", content: "Текст" }] };
  const profile = { name: "Роман", surname: "Смирнов", restaurant: "Два моря, Океан", position: "waiter" };
  const render = async (extra = {}) => {
    const { RoleSelect } = await import("../ui/screens-roleselect");
    return R(h(RoleSelect, { T: T4, a11y: false, profile, role: "seasonal", onSelect: noop, onContinueLesson: noop, onGuestBook: noop, onSchedule: noop, customByRole: { seasonal: [mod] }, ...extra }));
  };
  it("в исходнике: плитка графика — ScheduleTile в ряду с книгой; старой подписи subS и кружка с иконкой нет", () => {
    expect(src).toContain('import { ScheduleTile } from "./schedule-tile";');
    expect(src).toContain('<ScheduleTile a11y={a11y} mgr={mgr} tile={tile} frame={saFrame(a11y, "mid")}');
    expect(src).toContain("onOpen={() => onSchedule && onSchedule()} act={onActivate(() => onSchedule && onSchedule())} />");
    expect(src).not.toContain("const subS");
    expect(src).toContain("v45 (Доп. 358)");
  });
  it("главная: ряд из двух плиток, у графика — листок, подпись смены и нить; книга — как была", async () => {
    store.sa_today_shift = JSON.stringify({ date: ymd(new Date()), label: "Вечер · 17:00–24:00" });
    const html = await render();
    const row = html.indexOf('<div data-home-tiles="" style="display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 8px">');
    expect(row).toBeGreaterThan(0);
    const sch = html.indexOf('data-tile="schedule"'), book = html.indexOf('data-tile="book"');
    expect(sch).toBeGreaterThan(row);
    expect(book).toBeGreaterThan(sch);
    const tile = html.slice(sch, book);
    expect(tile).toContain("data-sched-page");
    expect(tile).toContain("data-sched-thread");
    expect(text(tile)).toContain("Мой графикВечер·17:00–24:00");
    delete store.sa_today_shift;
    const none = await render();
    expect(none).not.toContain("data-sched-thread");
    expect(text(none)).toContain("Смены, время и старший смены");
  });
  it("метка сборки — v45; CHANGES — «Дополнение 358»", () => {
    expect(readFileSync("ui/menu-trainer.jsx", "utf8")).toContain("· сборка v45</span>");
    expect(readFileSync("CHANGES.md", "utf8")).toContain("# Дополнение 358 — плитка «График смен»: листок календаря и нить суток (v45)");
  });
});
