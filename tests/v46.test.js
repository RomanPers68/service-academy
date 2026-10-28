// v46 (Доп. 359): график — персоналу «Карточка смены + медальоны», руководителю «Требует внимания»,
// «Сохранить» плашкой внизу и тихая сетка (только недобор).
//
// Владелец: «Ты можешь посмотреть внутри графика и подсказать, что можно сделать в нём удобнее и красивее?
// Имею ввиду у руководства и у персонала». Из предложений выбрано: персоналу — карточка ближайшей смены
// и медальоны месяца (макет А), руководству — три идеи с картинки «было → станет»: «Для руководства тоже
// делай, уже посмотрю вживую». Ничего не убрано — меняются место и вид.
// Вид в браузере (обе темы, сотрудник и руководитель, нажатия, сохранение) — /home/claude/preview/e2e-v46.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };

import { ShiftHero, NoShiftHero, MonthMedals, nextShift, shiftStatus, staffMonthCells, leftText } from "../ui/schedule-hero";
import { CalendarPage } from "../ui/schedule-tile";
import { palette } from "../ui/day-emblems";
import { attnDays, holesIn, conflictsIn, holeShiftOf, planChanges, changesText } from "../lib/schedule-attn";

const h = React.createElement;
const RAW = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const R = (el) => RAW(el).replace(/ /g, " ");
const text = (html) => html.replace(/<[^>]+>/g, "");
const src = readFileSync("ui/schedule.jsx", "utf8");
const SH = { "У": { k: "У", name: "Утро", from: 10, to: 18 }, "Д": { k: "Д", name: "День", from: 12, to: 20 }, "В": { k: "В", name: "Вечер", from: 16, to: 24 }, "Н": { k: "Н", name: "Ночь", from: 19, to: 3 } };
const shiftOf = (k) => SH[k] || null;
const at = (hh, mm = 0) => { const d = new Date(2026, 9, 17); d.setHours(hh, mm, 0, 0); return d; };   // суббота, 17 октября 2026
const CARD = { margin: 14, padding: 14, borderRadius: 18 };

describe("v46: ближайшая смена — расчёты", () => {
  it("leftText: «1 ч 40 мин», «2 ч», «35 мин»", () => {
    expect([leftText(100), leftText(120), leftText(35), leftText(0)]).toEqual(["1 ч 40 мин", "2 ч", "35 мин", "0 мин"]);
  });
  it("nextShift: сегодняшняя — пока не закончилась; закончилась — следующая; ночная до 3 утра; дальше — нет", () => {
    const row = { 17: "У", 19: "В", 21: "Н" };
    expect(nextShift({ row, shiftOf, todayD: 17, days: 31, nowH: 9 })).toMatchObject({ d: 17, sh: { k: "У" } });
    expect(nextShift({ row, shiftOf, todayD: 17, days: 31, nowH: 17.5 })).toMatchObject({ d: 17 });
    expect(nextShift({ row, shiftOf, todayD: 17, days: 31, nowH: 18.2 })).toMatchObject({ d: 19, sh: { k: "В" } });
    expect(nextShift({ row: { 21: "Н" }, shiftOf, todayD: 21, days: 31, nowH: 23.5 })).toMatchObject({ d: 21 });   // ночная 19→3 идёт
    expect(nextShift({ row: { 2: "Д" }, shiftOf, todayD: 17, days: 31, nowH: 9 })).toBe(null);
    expect(nextShift({ row, shiftOf, todayD: 0, days: 31, nowH: 9 })).toBe(null);                                // не текущий месяц
  });
  it("shiftStatus: «через …», «идёт · ещё …», другие дни — без подписи", () => {
    expect(shiftStatus(SH["В"], true, 14 + 20 / 60)).toEqual({ kind: "soon", text: "через 1 ч 40 мин" });
    expect(shiftStatus(SH["В"], true, 20.5)).toEqual({ kind: "now", text: "идёт · ещё 3 ч 30 мин" });
    expect(shiftStatus(SH["Н"], true, 23)).toEqual({ kind: "now", text: "идёт · ещё 4 ч" });
    expect(shiftStatus(SH["В"], false, 9)).toEqual({ kind: "later", text: "" });
  });
});

describe("v46: медальоны месяца — подписи", () => {
  const base = { hours: 126, norm: 160, vac: false, prev: 0, shifts: 16, peaks: 6, avg: 8 };
  it("часы: «до нормы 34 ч ≈ 5 см.» (неразрывно), «норма закрыта» (v73: без ✦), «отпуск учтён»", () => {
    const a = staffMonthCells({ ...base, pay: null });
    expect(a.cells.map((c) => c.key)).toEqual(["hours", "shifts"]);
    expect(a.cells[0]).toMatchObject({ main: 126, of: 160, cap: "часов", sub: "до нормы 34 ч ≈ 5 см." });
    expect(a.cells[0].pct).toBeCloseTo(126 / 160, 5);
    expect(staffMonthCells({ ...base, hours: 168, pay: null }).cells[0]).toMatchObject({ sub: "норма закрыта", pct: 1 });
    expect(staffMonthCells({ ...base, vac: true, pay: null }).cells[0].sub2).toBe("отпуск учтён");
    expect(staffMonthCells({ ...base, norm: 0, pay: null }).cells[0]).toMatchObject({ of: null, sub: "", pct: 0 });
  });
  it("заработок: почасовая — «+3 520 ₽ за 2 смены» и расчёт с прошлым месяцем строкой; оклад — «в месяц»", () => {
    const a = staffMonthCells({ ...base, pay: { sum: 27720, mode: "hour", note: "126 ч × 220", per: 1760 }, prev: 25300 });
    expect(a.cells.map((c) => c.key)).toEqual(["hours", "pay", "shifts"]);
    expect(a.cells[1]).toMatchObject({ main: "27 720", cap: "≈ за месяц", sub: "+3 520 ₽ за 2 смены" });
    expect(a.note.replace(/ /g, " ")).toBe("≈ 27 720 ₽ — 126 ч × 220, по сменам в графике · прошлый месяц ≈ 25 300 ₽");
    const m = staffMonthCells({ ...base, pay: { sum: 95000, mode: "month", note: "оклад / мес", per: 0 } });
    expect(m.cells[1]).toMatchObject({ cap: "оклад", sub: "в месяц" });
    expect(m.note.replace(/ /g, " ")).toBe("≈ 95 000 ₽ — оклад / мес");
  });
  it("смены: падежи и пиковые", () => {
    expect(staffMonthCells({ ...base, pay: null }).cells[1]).toMatchObject({ main: 16, cap: "смен", sub: "из них 6 пиковых" });
    expect(staffMonthCells({ ...base, shifts: 1, peaks: 1, pay: null }).cells[1]).toMatchObject({ cap: "смена", sub: "из них 1 пиковая" });
    expect(staffMonthCells({ ...base, shifts: 3, peaks: 0, pay: null }).cells[1]).toMatchObject({ cap: "смены", sub: "в графике" });
  });
});

describe("v46: карточка смены и медальоны — вид", () => {
  const hero = (o = {}) => R(h(ShiftHero, { a11y: false, card: CARD, d: 17, sh: SH["В"], when: "сегодня", dowName: "суббота", dowShort: "сб", monthR: "октября",
    isToday: true, now: at(14, 20), lead: "Смирнов Роман", leadNode: h("span", { "data-test-call": "" }, "Смирнов Роман"), mates: 10, onMates: () => {}, onChecklist: () => {}, due: null, ...o }));
  it("сегодня: листок 46×50 с числом, «сегодня · суббота», «Вечер», время золотом, «8 ч · через 1 ч 40 мин», нить суток", () => {
    const html = hero();
    expect(html).toContain('data-sched-hero="" data-hero-status="soon"');
    expect(html).toMatch(/data-hero-status="soon" style="[^"]*overflow:hidden;flex-shrink:0/);   // в колонке flex не сжимается в полоску
    expect(html).toMatch(/data-sched-page="" style="position:relative;display:block;width:46px;height:50px/);
    expect(html).toMatch(/data-sched-day=""[^>]*font-size:24px[^>]*color:#E2C484">17</);
    expect(text(html)).toContain("Сегодня · суббота");   // v73: подпись курсивом, с заглавной
    expect(html).toMatch(/data-hero-time=""[^>]*color:#E2C484[^>]*>16:00–24:00</);
    expect(text(html)).toContain("8 ч · через 1 ч 40 мин");
    expect(html).toContain('data-sched-thread=""');
    expect(html).toContain('data-now="off"');
  });
  it("старший — со звонком (капсула графика), «Чек-лист смены», «Кто со мной · 10»; повтор — если есть вопросы", () => {
    const html = hero({ due: { n: 3, onMistakes: () => {} } });
    expect(html).toContain('data-hero-lead=""');
    expect(html).toContain('data-test-call=""');
    expect(text(html)).toContain("Старший смены");
    expect(html).toMatch(/data-hero-checklist="" [^>]*role="button"[^>]*>✓ Чек-лист смены</);
    expect(html).toMatch(/data-hero-mates=""[^>]*>Кто со мной · 10</);
    expect(text(html)).toContain("3 вопроса ждут повтора");
    expect(text(html)).toContain("Повторить перед сменой");
    const call = hero({ leadNode: null, callNode: h("span", { "data-test-round": "" }, "☎") });
    expect(call).toMatch(/data-hero-lead=""[\s\S]*Смирнов Роман<\/div><\/div><span data-test-round="">☎<\/span>/);
    const bare = hero({ onChecklist: null, mates: 0, lead: null, leadNode: null });
    expect(bare).not.toContain("data-hero-checklist");
    expect(bare).not.toContain("data-hero-lead");
    expect(bare).toMatch(/data-hero-mates=""[^>]*>Кто со мной</);
    expect(bare).not.toContain("data-hero-due");
  });
  it("смена идёт — «идёт · ещё …», риска горит; завтра и позже — без нити, подпись днём", () => {
    expect(text(hero({ now: at(20, 30) }))).toContain("идёт · ещё 3 ч 30 мин");
    expect(hero({ now: at(20, 30) })).toContain('data-now="on"');
    const tmr = hero({ d: 18, when: "завтра", dowName: "воскресенье", dowShort: "вс", isToday: false });
    expect(text(tmr)).toContain("Завтра · воскресенье");
    expect(tmr).toContain('data-hero-status="later"');
    expect(tmr).not.toContain("data-sched-thread");
    expect(text(hero({ d: 21, when: "", dowName: "среда", dowShort: "ср", isToday: false }))).toContain("Ср · 21 октября");
  });
  it("смен больше нет — тихая карточка с бледным числом", () => {
    const html = R(h(NoShiftHero, { a11y: false, card: CARD, todayD: 30 }));
    expect(html).toContain('data-hero-status="none"');
    expect(text(html)).toContain("в этом месяце смен больше нет");
    expect(html).toMatch(/data-sched-day=""[^>]*color:#A99B7E">30</);
  });
  it("медальоны: три ячейки в табличке, как на главной; расчёт — строкой; без ставки — две", () => {
    const { cells, note } = staffMonthCells({ hours: 126, norm: 160, vac: false, prev: 0, shifts: 16, peaks: 6, avg: 8, pay: { sum: 27720, mode: "hour", note: "126 ч × 220", per: 1760 } });
    const html = R(h(MonthMedals, { a11y: false, cells, note }));
    expect(html).toContain('data-sched-medals=""');
    expect((html.match(/data-medal-cell="/g) || []).length).toBe(3);
    expect(html).toMatch(/data-medal-cell="hours"[\s\S]*data-medal="79"/);
    expect(text(html)).toContain("126/160");
    expect(text(html)).toContain("до нормы 34 ч ≈ 5 см.");
    expect(text(html)).toContain("27 720");
    expect(text(html)).toContain("+3 520 ₽ за 2 смены");
    expect(text(html)).toContain("из них 6 пиковых");
    expect(html).toMatch(/data-medal-note=""[^>]*>≈ 27 720 ₽ — 126 ч × 220, по сменам в графике</);
    expect(html).toContain(palette(false).panel);
    const two = R(h(MonthMedals, { a11y: false, ...staffMonthCells({ hours: 40, norm: 160, vac: false, prev: 0, shifts: 5, peaks: 0, avg: 8, pay: null }) }));
    expect((two.match(/data-medal-cell="/g) || []).length).toBe(2);
    expect(two).not.toContain("data-medal-note");
  });
  it("листок календаря: размер по умолчанию — как на плитке (31×34, планка 9, число 16), крупный — 46×50", () => {
    const p = palette(false);
    const small = R(h(CalendarPage, { day: 17, p, a11y: false }));
    expect(small).toMatch(/width:31px;height:34px/);
    expect(small).toMatch(/<span style="height:9px;flex-shrink:0;background:linear-gradient\(180deg, #C2533A, #8A3220\)/);
    expect(small).toMatch(/font-size:16px/);
    expect(small).toContain("border-radius:0 0 6px 6px");
    const big = R(h(CalendarPage, { day: 17, p, a11y: false, w: 46, h: 50 }));
    expect(big).toMatch(/width:46px;height:50px/);
    expect(big).toMatch(/height:13px;flex-shrink:0/);
    expect(big).toMatch(/font-size:24px/);
  });
});

describe("v46: «Требует внимания» — расчёты", () => {
  const POS = [{ id: "manager", t: "Менеджер" }, { id: "barback", t: "Барбек" }, { id: "waiter", t: "Официант" }];
  const staff = [{ id: 1, name: "Смирнов Роман", pos: "manager" }, { id: 2, name: "Лисин Егор", pos: "barback" }, { id: 3, name: "Смирнова Анна", pos: "waiter" }, { id: 4, name: "Морозова Ксения", pos: "waiter" }];
  const plan = { 1: { 17: "Д", 18: "Д" }, 2: { 18: "Д" }, 3: { 17: "В", 30: "Д" }, 4: { 17: "Д" } };
  const needOf = (d) => ({ manager: 1, barback: 1, waiter: d === 18 ? 3 : 2 });
  it("окно: текущий месяц — сегодня и 6 дней (не дальше конца месяца), будущий — весь, прошлый — пусто", () => {
    expect(attnDays({ Y: 2026, M: 9, DAYS: 31, now: at(14) })).toEqual([17, 18, 19, 20, 21, 22, 23]);
    expect(attnDays({ Y: 2026, M: 9, DAYS: 31, now: new Date(2026, 9, 28, 12) })).toEqual([28, 29, 30, 31]);
    expect(attnDays({ Y: 2026, M: 10, DAYS: 30, now: at(14) })).toHaveLength(30);
    expect(attnDays({ Y: 2026, M: 8, DAYS: 30, now: at(14) })).toEqual([]);
  });
  it("недобор по позициям с днями и сколько не хватает; «не смогу» под стоящей сменой", () => {
    expect(holesIn([17, 18], { staff, plan, POS, needOf, shiftOf })).toEqual([
      { pos: "barback", title: "Барбек", days: [{ d: 17, miss: 1 }] },
      { pos: "waiter", title: "Официант", days: [{ d: 18, miss: 3 }] },
    ]);
    expect(conflictsIn([17, 30], { staff, plan, hardOff: { 3: [30], 4: [18] }, shiftOf })).toEqual([{ id: 3, name: "Смирнова Анна", d: 30, k: "Д" }]);
  });
  it("какую смену ставить в дыру: по разбивке позиции, иначе основная", () => {
    const cfg = { shifts: Object.values(SH).filter((x) => x.k !== "Н"), dayShift: "Д", split: { waiter: { "Д": 1, "В": 1 } } };
    const ctx = { cfg, lvlOf: () => 1, staff, shiftOf };
    expect(holeShiftOf({ ...ctx, d: 17, pos: "waiter", plan }).k).toBe("Д");                    // Д: 1 из 1, В: 1 из 1 → основная
    expect(holeShiftOf({ ...ctx, d: 18, pos: "waiter", plan }).k).toBe("Д");                    // никого: первой по разбивке — Д
    expect(holeShiftOf({ ...ctx, d: 18, pos: "waiter", plan: { 4: { 18: "Д" } } }).k).toBe("В");   // Д закрыта → В
    expect(holeShiftOf({ ...ctx, d: 17, pos: "barback", plan }).k).toBe("Д");
  });
  it("плашка «Сохранить»: считает клетки, факт часов и пометки дней; падежи", () => {
    const saved = { plan: { 1: { 17: "Д" } }, days: {}, facts: {} };
    expect(planChanges(saved, { plan: { 1: { 17: "Д" } }, days: {}, facts: {} }, 31)).toBe(0);
    expect(planChanges(saved, { plan: { 1: { 17: "" , 18: "В" }, 2: { 5: "Д" } }, days: { 3: { note: "Банкет" } }, facts: { 1: { 17: 6 } } }, 31)).toBe(5);
    expect(planChanges(null, { plan: {}, days: {}, facts: {} }, 31)).toBe(0);
    expect([1, 3, 5, 11, 21, 22].map(changesText)).toEqual(["1 изменение не сохранено", "3 изменения не сохранены", "5 изменений не сохранено",
      "11 изменений не сохранено", "21 изменение не сохранено", "22 изменения не сохранены"]);
    expect(changesText(0)).toBe("Есть несохранённые изменения");
  });
});

describe("v46: календарь месяца и лист дня у сотрудника (исходник)", () => {
  it("переключатель «месяц / списком»: календарь по умолчанию, выбор помнит устройство; список — как был", () => {
    expect(src).toContain('localStorage.getItem("sa_sched_view") === "list" ? "list" : "cal"');
    expect(src).toContain('localStorage.setItem("sa_sched_view", v)');
    expect(src).toContain('data-sched-viewtoggle=""');
    expect(src).toContain('{[["cal", "месяц"], ["list", "списком"]].map(([kv, t]) => (');
    expect(src).toContain('{calView === "list" ? Array.from({ length: DAYS }, (_, i) => i + 1).map(d => {');
    expect(src).toContain('{wishes !== false && calView === "list" ? (() => {');
  });
  it("календарь: клетка — смена и время, пожелания значками, «можно взять» пунктиром, сегодня в рамке, легенда по месяцу", () => {
    const at1 = src.indexOf('data-sched-cal=""');
    expect(at1).toBeGreaterThan(0);
    const cal = src.slice(at1, src.indexOf('data-cal-wishes=""', at1) + 2000);
    expect(cal).toContain("data-cal-day={d}");
    expect(cal).toContain("{sh.from}–{sh.to > 24 ? sh.to - 24 : sh.to}");
    expect(cal).toContain("wish ? <IcoSun size={11} color={P.acc} /> : hd ? <IcoBan size={11} color={P.warn} />");
    expect(cal).toContain('border:`1px ${offerHere ? "dashed" : "solid"}');
    expect(cal).toContain('boxShadow: isT ? "0 0 0 2px rgba(214,178,102,0.25), 0 0 12px rgba(214,178,102,0.35)" : "none"');
    expect(cal).toContain("opacity: past && !selOn ? 0.42 : 1");
    expect(cal).toContain("(cfg.shifts || []).filter(s2 => used.has(s2.k))");
    expect(cal).toContain('"Тапни день: кто с тобой, пожелание, обмен или заметка"');   // v74
    expect(cal).toContain('{wishRange ? "Отмена периода" : "Отметить период"}');
  });
  it("лист дня: лица по времени прихода, кто отдыхает, «Отдать смену» / «Возьму», пожелания, заметка", () => {
    const at1 = src.indexOf("{daySheet && calView === \"cal\" ? (() => {");
    expect(at1).toBeGreaterThan(0);
    const sh = src.slice(at1, src.indexOf("})() : null}", src.indexOf('data-day-sheet={d}', at1)));
    expect(sh).toContain("data-sheet-face={x.id}");
    expect(sh).toContain("С тобой в смене · {mates.length}");
    expect(sh).toContain("ещё {restOther.length} из других позиций ›");
    expect(sh).toContain('swapCall("swap_create", { p_venue: venueKey, p_month: mkey, p_day: d, p_k: kk, p_staff: String(me.id), p_name: me.name }, "Предложение отправлено")');
    expect(sh).toContain('swapCall("swap_take", { p_id: offer.id, p_staff: String(me.id), p_name: me.name }, "Ты взял смену. Ждём менеджера")');   // v74
    expect(sh).toContain("onClick={() => setWish(me.id, d, !wishOf(me.id, d))}");
    expect(sh).toContain('onClick={() => setWish(me.id, d, !hardOf(me.id, d), "hard")}');
    expect(sh).toContain("onBlur={e => saveNote(d, e.target.value)}");
    expect(sh).toContain("Учтено по факту:");
  });
  it("шапка сотрудника — месяц один раз, стрелки рядом; «Отметить период»: первый тап — начало", () => {
    expect(src).toContain("const shell = (kids, opts = {}) => (");
    expect(src).toContain('{opts.arrows ? [[-1, "‹", "Предыдущий месяц"], [1, "›", "Следующий месяц"]].map(');
    expect(src).toMatch(/<\/>, \{ arrows: true(, two: twoCols && !!me)? \}\);/);   // v50: + две колонки от 700 px
    const staffAt = src.indexOf("  if (!isAdmin) {"), mgrAt = src.indexOf("  // ── Вид менеджера: таблица");
    expect(src.slice(staffAt, mgrAt)).not.toContain("{monthNav}");
    expect(src).toContain("if (wishRange.from && wishRange.to == null && d !== wishRange.from) { setWishAsk({ from: wishRange.from, to: d }); setWishRange(null); }");
  });
  it("старший смены — круглая кнопка звонка той же логикой, что у капсулы", () => {
    expect(src).toContain("function CallName({ who, label, color, badge, round }) {");
    expect(src).toContain('<span data-call-round="" style={{ display:"inline-flex", alignItems:"center", gap:6, flexShrink:0 }}>');
    expect(src).toContain("callNode={lead && lead.phone ? <CallName who={lead} label={lead.name} color={P.acc} round /> : null}");
  });
});

describe("v46: в графике (исходник)", () => {
  it("сотрудник: карточка смены и медальоны первыми; мост «чек-лист / повтор» переехал в карточку; смены словами", () => {
    // v48: к импорту добавились подписи медальонов для карточки сотрудника у руководителя
    expect(src).toMatch(/import \{ ShiftHero, NoShiftHero, MonthMedals, nextShift, staffMonthCells(, personMonthCells)? \} from "\.\/schedule-hero";/);
    expect(src).toMatch(/<ShiftHero a11y=\{a11y\} card=\{card\} d=\{nd\}/);
    expect(src).toContain("onChecklist={kT && onChecklist ? onChecklist : null}");
    expect(src).toContain("due={(kT || kN) && dueCount > 0 && onMistakes ? { n: dueCount, onMistakes } : null}");
    expect(src).toContain("<MonthMedals a11y={a11y} cells={cells} note={note} payMain={po ? <NumUp v={po.sum} /> : null} />");
    expect(src).not.toContain("Заработок за месяц:");
    expect(src).not.toContain("Возьмёшь ещё 2 смены — будет примерно");
    expect(src).not.toMatch(/Смена \{kT\.name\.toLowerCase\(\)\}/);
    expect(src).toContain("отдаёт смену · {swapWhen(w.day, w.k)}");
    expect(src).toContain("Ты отдаёшь смену {swapWhen(myAct.day, myAct.k)}");
    expect(src).not.toMatch(/отдаёт \{w\.day\}-е \(\{w\.k\}\)/);
    expect(src).toContain('" (" + xs.name.toLowerCase() + ")"');
    expect(src).toContain("data-list-day={d}");
  });
  it("руководитель: «Требует внимания» под месяцем, лист «Кто может выйти», обмены там же; кнопки в один ряд", () => {
    const at1 = src.indexOf('{tab === "setup" ? setupView() : <>');
    expect(src.indexOf("data-attn=\"\"", at1)).toBeGreaterThan(at1);
    expect(src.indexOf("data-attn=\"\"", at1)).toBeLessThan(src.indexOf("data-sched-actions", at1));
    expect(src).toContain("const holes = holesIn(win, ctx), confl = conflictsIn(win, ctx);");
    expect(src).toContain("setReplAsk({ id: c.id, d: c.d })");
    expect(src).toContain('data-fill-sheet=""');
    expect(src).toContain("const z = holeShiftOf({ d, pos, cfg, lvlOf, staff, plan, shiftOf });");
    expect(src).toContain("resolveSwap(w, true)");
    expect(src).not.toContain("Обмены ждут решения</span>");
    expect(src).not.toContain('{dirty ? "Сохранить" : "Сохранено"}');
    expect(src).toMatch(/data-sched-actions=""[\s\S]{0,900}aria-expanded=\{more\}>Ещё/);
  });
  it("плашка «Сохранить» у нижнего края — только при изменениях; сетка — только недобор; светлая шапка и «Сегодня» читаются", () => {
    expect(src).toMatch(/\{dirty \? \(\(\) => \{\s+const n = planChanges\(savedRef\.current, \{ plan, days, facts \}, DAYS\);/);
    expect(src).toContain('data-savebar="" className="sa-fadein" style={{ position:"sticky", bottom:"calc(12px + env(safe-area-inset-bottom, 0px))"');
    expect(src).toMatch(/savedRef\.current = \{ plan(: P, locks: L)?, days, facts \}; setDirty\(false\);/);   // v93: со сменами из чата (сведено с сервером)
    expect(src).toContain("data-short={n - have}");
    expect(src).toContain('{have > n ? "+" + (have - n) : "✓"}');
    expect(src).not.toContain("{n ? `${have}/${n}` : (have || \"·\")}");
    expect(src).toContain("dow(d) >= 5 ? P.acc : (a11y ? P.text : SAND) }}>{d}</b>");
    expect(src).toContain('const dot = (extra) => ({ width:30, height:30, borderRadius:"50%", flexShrink:0,');
    // светлая тема: «Кто может?», «Кто вместо?», «↩» и «Закрыть» в листе — тёмным золотом
    expect(src).toContain('const ghostInk = a11y ? { ...ghost, color:"#7A5A22", border:"1px solid rgba(122,90,34,0.45)" } : ghost;');
    expect(src).toContain('const chipBtn = { ...ghostInk, flex:"0 0 auto"');
    expect(src).toContain('onClick={() => setFillAsk(null)} style={{ ...ghostInk, width:"100%"');
    expect(src).toMatch(/style=\{\{ \.\.\.ghostInk, flex:"0 0 auto", fontSize:12\.5, padding:"9px 13px" \}\} className="sa-btn" onClick=\{undo\}/);
  });
  it("подсказки — про новое место; метка сборки — v46; CHANGES — «Дополнение 359»", () => {
    const hints = readFileSync("data/hints.js", "utf8");
    expect(hints).toContain("Первая карточка показывает ближайшую смену: время, старшего и чек-лист.");   // v74
    expect(hints).toContain("Выходные отмечай прямо в календаре");   // v74
    expect(hints).toContain("плашка с этой кнопкой появится внизу");
    expect(src).toContain("Передумал? «↩» рядом с «Заполнить черновик» вернёт как было.");   // v74
    expect(readFileSync("ui/menu-trainer.jsx", "utf8")).toMatch(/· сборка v\d{2,}<\/span>/);   // v47 — следующая метка
    expect(readFileSync("CHANGES.md", "utf8")).toContain("# Дополнение 359 — график: карточка смены и медальоны у персонала");
  });
});
