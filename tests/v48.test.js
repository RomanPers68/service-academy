// v48 (Доп. 361): у руководителя — карточка сотрудника по тапу на имя; «Факт часов» и заметка ко дню — окошком
// на виду; месяц в шапке один раз.
//
// Владелец: «Как ещё мы можем сделать удобнее и красивее для руководителя?» Из четырёх идей с картинками выбрана
// «Тап по имени — карточка сотрудника». Попутно исправлено: тап по числу и «Факт часов» открывали карточку за
// краем экрана. Вид в браузере (обе темы, 393 и 360 px, правка из карточки) — /home/claude/preview/e2e-v48.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

import { MonthMedals, personMonthCells, staffMonthCells } from "../ui/schedule-hero";

const h = React.createElement;
const RAW = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const text = (html) => html.replace(/<[^>]+>/g, "").replace(/ /g, " ");
const src = readFileSync("ui/schedule.jsx", "utf8");
const NB = (s) => s.replace(/ /g, " ");

describe("v48: медальоны в карточке сотрудника — подписи для руководителя", () => {
  it("часы: до нормы со сменами, сверх нормы, норма закрыта, отпуск учтён", () => {
    const sub = (o) => NB(personMonthCells({ shifts: 16, peaks: 0, avg: 8, pay: null, prev: 0, ...o }).cells[0].sub);
    expect(sub({ hours: 128, norm: 160 })).toBe("до нормы 32 ч ≈ 4 см.");
    expect(sub({ hours: 176, norm: 160 })).toBe("+16 ч сверх нормы");
    expect(sub({ hours: 160, norm: 160 })).toBe("норма закрыта");   // v73: без ✦
    const c = personMonthCells({ hours: 104, norm: 124, vac: true, shifts: 13, peaks: 2, avg: 8, pay: null, prev: 0 }).cells[0];
    expect([c.main, c.of, c.sub2]).toEqual([104, 124, "отпуск учтён"]);
    expect(personMonthCells({ hours: 176, norm: 160, shifts: 22, peaks: 0, pay: null, prev: 0 }).cells[0].pct).toBe(1);
  });
  it("заработок: почасовая и посменная — как посчитан; оклад — «оклад · в месяц»; без ставки — два медальона", () => {
    const hr = personMonthCells({ hours: 128, norm: 160, shifts: 16, peaks: 5, pay: { sum: 28160, mode: "hour", note: "128 ч × 220" }, prev: 0 });
    expect(hr.cells.map((x) => x.key)).toEqual(["hours", "pay", "shifts"]);
    expect([NB(hr.cells[1].main), hr.cells[1].cap, NB(hr.cells[1].sub)]).toEqual(["28 160", "≈ за месяц", "128 ч × 220"]);
    const sh = personMonthCells({ hours: 96, norm: 160, shifts: 12, peaks: 0, pay: { sum: 30000, mode: "shift", note: "12 смен × 2500" }, prev: 0 });
    expect(NB(sh.cells[1].sub)).toBe("12 смен × 2500");
    const mo = personMonthCells({ hours: 128, norm: 160, shifts: 16, peaks: 5, pay: { sum: 95000, mode: "month", note: "оклад / мес" }, prev: 0 });
    expect([mo.cells[1].cap, mo.cells[1].sub]).toEqual(["оклад", "в месяц"]);
    expect(personMonthCells({ hours: 128, norm: 160, shifts: 16, peaks: 0, pay: null, prev: 0 }).cells.map((x) => x.key)).toEqual(["hours", "shifts"]);
  });
  it("смены: падежи и пиковые; прошлый месяц — строкой под табличкой", () => {
    const r = personMonthCells({ hours: 128, norm: 160, shifts: 16, peaks: 5, pay: { sum: 28160, mode: "hour", note: "128 ч × 220" }, prev: 26400 });
    expect([r.cells[2].cap, r.cells[2].sub]).toEqual(["смен", "из них 5 пиковых"]);
    expect(personMonthCells({ hours: 8, norm: 160, shifts: 1, peaks: 1, pay: null, prev: 0 }).cells[1].sub).toBe("из них 1 пиковая");
    expect(personMonthCells({ hours: 16, norm: 160, shifts: 2, peaks: 0, pay: null, prev: 0 }).cells[1].cap).toBe("смены");
    expect(NB(r.note)).toBe("прошлый месяц ≈ 26 400 ₽");
    expect(personMonthCells({ hours: 128, norm: 160, shifts: 16, peaks: 5, pay: null, prev: 0 }).note).toBe("");
  });
  it("у сотрудника подписи прежние — «+… ₽ за 2 смены» остаётся в его медальонах", () => {
    const st = staffMonthCells({ hours: 128, norm: 160, vac: false, pay: { sum: 28160, mode: "hour", note: "128 ч × 220", per: 1760 }, prev: 0, shifts: 16, peaks: 5, avg: 8 });
    expect(NB(st.cells[1].sub)).toBe("+3 520 ₽ за 2 смены");
  });
  it("MonthMedals: style снимает внешние отступы, compact — медальон 30 px и цифры мельче; по умолчанию — как было", () => {
    const cells = personMonthCells({ hours: 128, norm: 160, shifts: 16, peaks: 5, pay: { sum: 28160, mode: "hour", note: "128 ч × 220" }, prev: 0 }).cells;
    const def = RAW(h(MonthMedals, { a11y: false, cells, note: "" }));
    expect(def).toContain('data-sched-medals="" style="margin:12px 14px 0;flex-shrink:0"');
    expect(def).toMatch(/data-medal="80" style="width:34px;height:34px/);
    expect(def).toContain('<span style="font-size:20px');
    const cmp = RAW(h(MonthMedals, { a11y: false, cells, note: "", style: { margin: "12px 0 0" }, compact: true }));
    expect(cmp).toContain('data-sched-medals="" style="margin:12px 0 0;flex-shrink:0"');
    expect(cmp).toMatch(/data-medal="80" style="width:30px;height:30px/);
    expect(cmp).toContain('<span style="font-size:18px');
    expect(text(cmp)).toContain("128/160");
  });
});

describe("v48: карточка сотрудника в графике (исходник)", () => {
  it("имя в таблице нажимается — открывает карточку; кнопкой и с клавиатуры", () => {
    expect(src).toContain('data-person-open={s.id} aria-label={"Карточка: " + s.name}');
    expect(src).toContain("onClick={() => { setPersonSheet(s.id); vibrate(\"light\"); }} {...onActivate(() => setPersonSheet(s.id))}");
    expect(src).toContain("const [personSheet, setPersonSheet] = React.useState(null);");
  });
  it("карточка: инициалы, имя, должность · ставка · норма, звонок, медальоны (compact), календарь, пожелания, кнопки", () => {
    const at = src.indexOf("{personSheet && (() => {");
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(src.indexOf("{pick && (() => {"));          // лист смены открывается поверх карточки
    const body = src.slice(at, src.indexOf("{pick && (() => {"));
    expect(body).toContain("personMonthCells({ hours: h, norm: en, vac: en !== s.norm");
    expect(body).toContain('style={{ margin:"12px 0 0" }} compact />');
    expect(body).toContain('{s.phone ? <CallName who={s} label={s.name} color={P.acc} round /> : null}');
    expect(body).toContain("{posName(s.pos)} · {rateT} · {normT}");
    expect(body).toContain('`норма ${en} ч с отпуском`');
    expect(body).toContain('data-person-day={d} data-person-k={kk || ""} onClick={() => { setPick({ id: s.id, d }); vibrate("light"); }}');
    expect(body).toContain("const clash = sh && (wish || hd);");
    expect(body).toContain("просит выходной: {wl.join(\", \")}");
    expect(body).toContain("не сможет: {hl.join(\", \")}");
    expect(body).toContain("отпуск: {vr.join(\", \")}");
    expect(body).toContain("постоянный выходной: {offW.join(\", \")}");
    expect(body).toContain("Пожеланий на этот месяц нет");
    expect(body).toContain(">Настройки сотрудника ›</button>");
    expect(body).toContain("Тап по дню — поставить смену, как в таблице");
  });
  it("«Настройки сотрудника ›» — вкладка «Настройки», раздел «Сотрудники», карточка человека раскрыта и подведена", () => {
    expect(src).toContain('setPersonSheet(null); setTab("setup"); setOpenSec(5); setOpenEmp(s.id); vibrate("light");');
    expect(src).toContain("document.querySelector('[data-emp=\"' + s.id + '\"]')");
    expect(src).toContain('className="sa-schedemp" data-emp={sf.id}');
  });
});

describe("v48: «Факт часов» и заметка ко дню — на виду; шапка руководителя", () => {
  it("окошко сверху поверх экрана: факт часов и заметка; тап мимо — закрыть; кнопки — тёмным золотом в светлой теме", () => {
    expect(src).toContain('<div onClick={() => setFactEdit(null)} style={veil(true)}>');
    expect(src).toContain('<div data-fact-sheet="" onClick={e => e.stopPropagation()} className="sa-fadein" style={dialogBox}>');
    expect(src).toContain('<div onClick={() => setDayEdit(null)} style={veil(true)}>');
    expect(src).toContain('<div data-note-sheet="" onClick={e => e.stopPropagation()} className="sa-fadein" style={dialogBox}>');
    expect(src).toContain('const dialogBox = { ...sheetBox, margin:"calc(70px + var(--sa-st, env(safe-area-inset-top, 0px))) 12px 0", maxHeight:"70vh" };');   // v69: и кнопки Telegram
    expect(src).toContain('alignItems: top ? "flex-start" : "flex-end"');
    expect(src).not.toMatch(/\{factEdit \? \(\(\) => \{[\s\S]{0,900}<div style=\{\{ \.\.\.card, marginTop:10 \}\}>/);
    expect(src).toContain('onClick={() => setFactEdit(null)}>Готово</button>');
    expect(src).toMatch(/\.\.\.ghostInk, padding:"9px 11px", fontSize:12\.5 \}\} className="sa-btn" onClick=\{\(\) => setDayEdit\(null\)\}>Готово/);
  });
  it("шапка: месяц один раз, стрелки рядом на вкладке «График»; строки «‹ месяц · N дней ›» под вкладками нет", () => {
    expect(src).toMatch(/<\/>, \{ arrows: tab !== "setup"(, two: twoCols && tab !== "setup")? \}\);/);   // v50: + две колонки от 700 px
    expect(src).not.toMatch(/\{tab === "setup" \? setupView\(\) : <>\s*\{monthNav\}/);
  });
  it("подсказка руководителя — про тап по имени; метка сборки — v48; CHANGES — «Дополнение 361»", () => {
    expect(readFileSync("data/hints.js", "utf8")).toContain("Тап по имени — карточка человека: часы, заработок и весь его месяц");   // v49: дальше — «тап по числу — день по часам»
    expect(readFileSync("ui/menu-trainer.jsx", "utf8")).toMatch(/· сборка v\d{2}<\/span>/);   // v49 — следующая метка
    expect(readFileSync("CHANGES.md", "utf8")).toContain("# Дополнение 361 — график: карточка сотрудника по тапу на имя");
  });
});
