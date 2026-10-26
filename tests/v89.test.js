// v89 (Доп. 402): «Вопрос дня» после ответа уходит с главной. Разбор виден, пока ты на главной (ответ дан сейчас);
// «Понятно» убирает карточку сразу; ушёл с главной, перезапустил, ответил в Telegram — карточки нет до завтрашнего
// вопроса. Вид — tools/claude/e2e-v89.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

const ITEM = { id: 7, q: "Через сколько секунд гостя нужно поприветствовать?", o: ["30 секунд", "Через 5 минут", "Когда сядет"], t: "Встреча гостя", r: "Официант", day: "2026-10-26", via: "app", answer: null, correct: null, at: null };
const OK = { ...ITEM, answer: 0, correct: true, c: 0, e: "Первый контакт до 30 секунд." };
const BAD = { ...ITEM, answer: 2, correct: false, c: 0, e: "Первый контакт до 30 секунд." };

describe("v89: «Вопрос дня» после ответа уходит с главной", () => {
  it("карточка: после ответа справа в строке разбора «Понятно» (с onHide); до ответа и без onHide — нет", async () => {
    const { QdayCard } = await import("../ui/qday-card.jsx");
    const bad = R(h(QdayCard, { a11y: false, data: { item: BAD, streak: 1 }, onMistakes: () => {}, onHide: () => {} }));
    expect(bad).toMatch(/Вопрос ждёт в .*«Работе над ошибками».*\. Следующий вопрос завтра\.<\/span><span role="button" tabindex="0" data-qday-hide="" [^>]*>Понятно<\/span>/);
    const ok = R(h(QdayCard, { a11y: true, data: { item: OK, streak: 2 }, onHide: () => {} }));
    expect(ok).toMatch(/Следующий вопрос завтра\.<\/span><span role="button" tabindex="0" data-qday-hide=""[^>]*>Понятно<\/span>/);
    expect(R(h(QdayCard, { a11y: false, data: { item: OK, streak: 2 } }))).not.toContain("data-qday-hide");
    expect(R(h(QdayCard, { a11y: false, data: { item: ITEM, streak: 2 }, onAnswer: () => {}, onHide: () => {} }))).not.toContain("data-qday-hide");
  });
  it("приложение: отвеченный вопрос на главной — только если ответ дан сейчас; ушёл с главной или «Понятно» — карточки нет", () => {
    const app = code(rd("App.jsx"));
    expect(app).toContain("const [qdayKeep, setQdayKeep] = useState(false);");
    expect(app).toContain('useEffect(() => { if (screen !== "roleSelect") setQdayKeep(false); }, [screen]);');
    // ответ засчитан (в том числе «уже отвечал в Telegram») — разбор держим, пока ты на главной
    expect(app).toMatch(/if \(r && r\.item && \(r\.ok \|\| r\.error === "again"\)\) \{\s*setQdayKeep\(true\);/);
    expect(app).toContain("qdayCard={qdayData && qdayData.item && (!Number.isInteger(qdayData.item.answer) || qdayKeep) ? <QdayCard");
    expect(app).toContain("onHide={() => setQdayKeep(false)} />");
  });
  it("тексты: без эмодзи и «слово — слово»; справка — «Понятно» и до завтрашнего вопроса", async () => {
    const src = code(rd("ui/qday-card.jsx"));
    expect(src).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g)).toBe(null);
    const { GUIDE } = await import("../ui/guide.jsx");
    const t = (GUIDE.flatMap((g) => g.items || []).find((x) => x.key === "qday") || {}).text || "";
    expect(t).toContain("Разбор виден, пока ты на главной; «Понятно» убирает карточку сразу. Потом карточки нет до завтрашнего вопроса");
    expect(t).toContain("Серия на карточке: сколько дней подряд был ответ.");
  });
  it("«сборка v89», «Дополнение 402»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(89|9\d|\d{3,})<\/span>/);   // v89 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 402 — «Вопрос дня» уходит с главной после ответа (v89)");
  });
});
