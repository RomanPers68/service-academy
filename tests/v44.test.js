// v44 (Доп. 357): главная компактнее — вид «Б · Собрать», «но более плотнее».
//
// Отзыв владельца со скриншотом главной: «Как мы можем сделать чуть более компактнее? Всё выделенное» (от «Хорошей
// смены ✦» до полки «Справочник / SOS»), «и может у тебя есть предложение по визуалу?». Из двух вариантов выбран
// «Б · Собрать» и — «но более плотнее». Ничего не убрано: роль — строкой под именем, «хорошей смены ✦» — справа под
// заведением, разминка и «Шаг дня» — плашками рядом внизу карточки трека, «График смен» и «Книга отзывов» —
// плитками в один ряд, табличка, «Пульс недели» и полка инструментов — плотнее; «Пульс» в светлой теме читается.
// Вид в браузере (320 / 375 / 393 / 430 px, обе темы, нажатия) — /home/claude/preview/e2e-v44.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { WarmupCard } from "../ui/day-cards";
import { StepLine } from "../ui/mastery-card";

const noop = () => {};
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const text = (html) => html.replace(/<[^>]+>/g, "");
const count = (html, re) => (html.match(re) || []).length;
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const src = readFileSync("ui/screens-roleselect.jsx", "utf8");

const T4 = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false,
  roleHeader: {}, roleSubtitle: {}, roleList: {}, roleCard: {}, roleAccent: {}, roleIcon: {}, roleInfo: {}, roleLabel: {}, roleSublabel: {}, roleDesc: {} };
const mod = { id: "cms-m-1", title: "Свой раздел", lessons: [{ id: "cms-l-1", type: "lesson", title: "Урок: встреча гостя", content: "Текст" }] };
const profile = { name: "Роман", surname: "Смирнов", restaurant: "Два моря, Океан", position: "waiter" };
const boss = { ...profile, position: "manager", is_admin: true };
const STEP = { id: "try:quest", kind: "try", fam: "quest", text: "Попробуй: Квест смены", sub: "Закройте с командой общий квест смены.", go: "quest" };
const warm = (o = {}) => h(WarmupCard, { compact: true, a11y: false, shift: "Вечер · 17:00–24:00", known: true, done: false, onStart: noop, ...o });
const step = (o = {}) => h(StepLine, { a11y: false, step: STEP, onStep: noop, ...o });
const render = async (extra = {}) => {
  const { RoleSelect } = await import("../ui/screens-roleselect");
  return R(h(RoleSelect, { T: T4, a11y: false, profile, role: "seasonal", onSelect: noop, onContinueLesson: noop, onGuestBook: noop, onSchedule: noop, customByRole: { seasonal: [mod] }, ...extra }));
};
const shiftToday = (label) => { store.sa_today_shift = JSON.stringify({ date: ymd(new Date()), label }); };

describe("v44: приветствие — роль под именем, «хорошей смены ✦» справа", () => {
  it("роль — строкой под именем: значок, название и подпись целиком; отдельного ряда с чипом над карточкой нет", async () => {
    const html = await render();
    expect(count(html, /data-role-line=""/g)).toBe(1);
    expect(text(html.slice(html.indexOf("data-role-line"), html.indexOf("</span></span>", html.indexOf("data-role-line"))))).toContain("НовичокСезонный сотрудник");
    expect(html.indexOf("data-role-line")).toBeLessThan(html.indexOf("Два моря, Океан"));   // в левой колонке приветствия
    expect(html).not.toMatch(/padding:4px 11px;border-radius:999px/);                       // чипа роли больше нет
    expect(src).toContain("v44 (Доп. 357): роль — строкой под именем в");
  });
  it("смена сегодня — «хорошей смены ✦» под заведением, а не второй строкой слева; выходной — нет", async () => {
    shiftToday("Вечер · 17:00–24:00");
    const html = await render();
    const at = html.indexOf('data-shift-wish=""');
    expect(at).toBeGreaterThan(html.indexOf("Два моря, Океан"));
    expect(text(html.slice(at, html.indexOf("</div>", at)))).toContain("хорошей смены ✦");
    expect(html).not.toContain("Хорошей смены ✦");
    shiftToday("выходной");
    expect(await render()).not.toContain("data-shift-wish");
    delete store.sa_today_shift;
  });
  it("без роли — без строки роли; приветствие на одну строку", async () => {
    const html = await render({ role: null });
    expect(html).not.toContain("data-role-line");
    expect(html).toContain('<div style="padding:2px 20px 8px;display:flex;align-items:baseline;justify-content:space-between;gap:10px">');
  });
});

describe("v44: разминка и «Шаг дня» — плашками внизу карточки трека", () => {
  it("плашка разминки: «РАЗМИНКА» и «2 мин · вечер», вся — кнопка; сделана — нет; строка прежнего вида осталась", () => {
    const p = R(warm({ pill: true }));
    expect(p).toContain('data-pill="warmup"');
    expect(p).toContain('role="button"');
    expect(p).toContain('aria-label="Разминка до смены: 2 мин · вечер. Начать"');
    expect(text(p)).toBe("Разминка2 мин · вечер›");
    expect(text(R(warm({ pill: true, shift: "" })))).toBe("Разминка2 мин · сегодня смена›");
    expect(text(R(warm({ pill: true, shift: "", known: false })))).toBe("Разминка2 мин · перед сменой›");
    expect(R(warm({ pill: true, done: true }))).toBe("");
    expect(R(warm())).toContain("разминка 2 мин");      // compact без pill — как в v28
  });
  it("плашка шага: «ШАГ ДНЯ» и дело без «Попробуй:», до трёх строк без многоточия; подпись для чтения — полностью", () => {
    const p = R(step({ pill: true }));
    expect(p).toContain('data-pill="step"');
    expect(p).toContain('data-ms-line=""');
    expect(p).toContain('aria-label="Шаг дня: Попробуй: Квест смены. Закройте с командой общий квест смены."');
    expect(text(p)).toBe("Шаг дняКвест смены›");
    expect(p).toContain('class="ms-clamp ms-c3"');
    expect(R(step())).toContain("Шаг дня");             // строка прежнего вида осталась
  });
  it("обе — рядом в одном ряду карточки; разминка сделана — шаг во всю ширину; ничего — ряда нет", async () => {
    const both = await render({ warmupCard: warm(), stepLine: step() });
    const row = both.indexOf('<div data-day-pills="" style="display:flex;gap:8px;padding:0 9px 9px;align-items:stretch">');
    expect(row).toBeGreaterThan(both.indexOf(">Начать</div>"));
    expect(both.indexOf('data-pill="warmup"')).toBeGreaterThan(row);
    expect(both.indexOf('data-pill="step"')).toBeGreaterThan(both.indexOf('data-pill="warmup"'));
    const onlyStep = await render({ warmupCard: warm({ done: true }), stepLine: step() });
    expect(onlyStep).not.toContain('data-pill="warmup"');
    expect(onlyStep).toContain('data-pill="step"');
    const none = await render({ warmupCard: warm({ done: true }) });
    expect(none).not.toContain("data-day-pills");
  });
  it("подсказка «Напоминать в Telegram» разминки — строкой под плашками", async () => {
    const hint = h("div", { "data-test-hint": "" }, "Напоминать в Telegram за час до смены ›");
    const html = await render({ warmupCard: h(WarmupCard, { compact: true, a11y: false, shift: "Вечер · 17:00–24:00", known: true, done: false, onStart: noop }, hint), stepLine: step() });
    const row = html.indexOf("data-day-pills");
    const at = html.indexOf('data-test-hint=""');
    expect(at).toBeGreaterThan(row);
    expect(html).toContain('<div style="padding:0 13px 9px;margin-top:-3px"><div data-test-hint="">');
  });
});

describe("v44: «График смен» и «Книга отзывов» — плитками в один ряд", () => {
  it("две плитки в ряду, на узком экране ряд переносится; «ОТКРЫТЬ ›» и большие карточки ушли", async () => {
    shiftToday("Вечер · 17:00–24:00");
    const html = await render();
    expect(html).toContain('<div data-home-tiles="" style="display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 8px">');
    expect(count(html, /data-tile="/g)).toBe(2);
    expect(html).toMatch(/data-tile="schedule"[^>]*style="flex:1 1 150px;min-width:0/);
    expect(html).not.toContain("ОТКРЫТЬ ›");
    // время смены не рвётся по тире
    expect(html).toContain("Сегодня: Вечер · 17:00⁠–⁠24:00");
    expect(text(html)).toContain("Мой график");
    delete store.sa_today_shift;
  });
  it("книга: страницы, ранг, печати, ляссе и нить — в плитке; «Личная · имя» и монограмма ушли", async () => {
    const html = await render();
    const at = html.lastIndexOf("<div", html.indexOf('data-tile="book"'));
    const tile = html.slice(at, html.indexOf("Треки обучения", at));
    expect(text(tile)).toMatch(/^Книга отзывов\d+\/\d+Стажёр/);
    expect(tile).toContain("clip-path:polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)");   // ляссе
    expect(tile).toMatch(/linear-gradient\(90deg, [^)]+\)/);                                // золотая нить
    expect(html).not.toContain("ЛИЧНАЯ ·");
    expect(await render({ onGuestBook: null })).not.toContain('data-tile="book"');
  });
  it("руководителю — «График смен» и подпись про составление", async () => {
    const html = await render({ profile: boss });
    expect(text(html)).toContain("График смен");
    expect(text(html)).toContain("Составить, проверить и опубликовать");
  });
});

describe("v44: «Пульс недели», табличка и полка — плотнее; «Пульс» в светлой теме читается", () => {
  const now = new Date().toISOString();
  const scores = [{ name: "Ангелина", surname: "Токарева", score: 9, updated_at: now }, { name: "Иван", surname: "Петров", score: 6, updated_at: now }];
  it("«Пульс недели»: тоньше; в светлой теме — тёмное золото вместо #C8A96E", async () => {
    const dk = await render({ profile: boss, scores });
    const lt = await render({ profile: boss, scores, a11y: true });
    expect(dk).toContain('data-pulse="" style="margin:0 14px 8px;padding:6px 12px;');
    expect(text(dk)).toContain("пульс недели · 2 теста · 2 чел в игре · лидер: Ангелина Токарева");
    const pl = lt.slice(lt.indexOf("data-pulse"), lt.indexOf("</div>", lt.indexOf("data-pulse")));
    expect(pl).toContain("color:#7A5D2A");
    expect(pl).not.toContain("#C8A96E");
  });
  it("табличка: медальоны 32 px, поля 7 px; полка: кружки 36 px, SOS 42 px, поля 6 px", () => {
    const dc = readFileSync("ui/day-cards.jsx", "utf8");
    expect(dc).toContain(".sa-dp{display:flex;align-items:stretch;border-radius:16px;--dp-m:32px;--dp-i:19px;--dp-l:25px}");
    expect(dc).toContain("gap:7px;padding:7px 5px;");
    expect(src).toContain("const ring = narrow ? 34 : 36;");
    expect(src).toContain('margin:"0 14px 8px", padding: narrow ? "6px 9px" : "6px 10px", borderRadius:999,');
    expect(src).toContain("width: narrow ? 40 : 42, height: narrow ? 40 : 42");
  });
});

describe("v44: метка сборки и CHANGES", () => {
  it("«сборка v44», «Дополнение 357»", () => {
    expect(readFileSync("ui/menu-trainer.jsx", "utf8")).toMatch("· сборка v44");
    expect(readFileSync("CHANGES.md", "utf8")).toMatch(/# Дополнение 357 — /);
  });
});
