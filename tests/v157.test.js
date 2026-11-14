// v157 (Доп. 481): «чтобы было приятно зайти и хотелось остаться». Владелец (14.11): «Поможешь улучшить приложение по сервису в
// визуальном плане? …что бы человек зашел и ему было приятно им пользоваться и было желание остаться в нем подольше». На четыре
// наброска «сейчас / идея» — «Да, все прекрасно, мне нравится☺️ Единственное не нравится цвет в выделенной зоне» (рыжий свет
// внизу «Вечернего света») и «Фото которые ты показал в идее, их можно будет самому загрузить, верно?».
// 1) фото на обложках: разделы «Справочника» и раздел трека, своё фото ставит руководитель (те же фото, что у уроков, этап 51);
// 2) «Я»: полка значков и неделя; 3) «Смена»: кто сегодня со мной; 4) вечерние огни на главной — без рыжего света снизу.
// Экран — tools/claude/e2e-v157.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, existsSync } from "node:fs";
import { surnameFirst, mateName, shiftMates, matesLine, matesNote } from "../lib/shift-mates";
import { myScheduleCopies, myScheduleCopy, myShiftOn } from "../lib/streak";
import { syncMySchedule, BG_KEY, DEFAULT_SHIFTS } from "../lib/schedule-sync";
import { refCoverId, modCoverId, moduleCover, REF_COVER_DEFAULT, normLessonPhotos, lessonPhotoId } from "../lib/lesson-photo";
import { ShiftHero, MeShelf, shelfBadges, shelfWeek, shelfWeekNote } from "../ui/home-hubs";
import { LessonPhotoSheet, CoverEditButton, canEditCovers } from "../ui/lesson-photo";
import { EVE_LIGHTS, eveLightsMode } from "../ui/screens-roleselect";
import { TABLE_CSS } from "../ui/table-css";
import { S } from "../ui/styles";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "");
const sp = (s) => String(s).replace(/ /g, " ");
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
  get length() { return m.size; }, key: (i) => [...m.keys()][i] || null }; };

const ANNA = { name: "Анна", surname: "Смирнова", restaurant: "Океан" };
const MARIA = { name: "Мария", surname: "Ким", restaurant: "Океан" };
const DAY = new Date(2026, 10, 14, 11, 0, 0);   // суббота, 14 ноября
const SHIFTS = [{ k: "У", name: "Утро", from: 8, to: 12 }, { k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 24 }, { k: "Н", name: "Ночь", from: 22, to: 4 }, { k: "К", name: "Кейтеринг", from: 10, to: 22, extra: 1 }];
const STAFF = [{ id: 1, name: "Ким Мария", pos: "manager" }, { id: 2, name: "Ли Ольга", pos: "host" }, { id: 3, name: "Смирнова Анна", pos: "waiter" }, { id: 4, name: "Орлов Пётр", pos: "waiter" },
  { id: 5, name: "Соколова Вера", pos: "waiter" }, { id: 6, name: "Лебедева Дарья", pos: "waiter" }, { id: 7, name: "Белов Илья", pos: "bar" }, { id: 8, name: "Миронова Ксения", pos: "waiter" }, { id: 9, name: "Зуев Глеб", pos: "waiter", till: "2026-10" }];
// 14-го: Мария, Анна, Дарья, Ксения — день; Пётр — вечер (пересекается с днём); Ольга — утро (с днём не пересекается);
// Илья — кейтеринг (не с нами); Вера — выходной; Глеб ушёл в октябре, хотя в плане остался
const PLAN = { 1: { 14: "Д" }, 2: { 14: "У" }, 3: { 14: "Д", 15: "Д" }, 4: { 14: "В" }, 6: { 14: "Д" }, 7: { 14: "К" }, 8: { 14: "Д" }, 9: { 14: "Д" } };
const full = (over = {}) => ({ cfg: { staff: STAFF, shifts: SHIFTS }, plan: PLAN, ts: 1000, ...over });
const lsFull = (over) => mem({ "sa_sched_cache_main_2026-11": JSON.stringify(full(over)) });

describe("v157: кто сегодня со мной (lib/shift-mates.js)", () => {
  it("порядок слов в имени узнаётся по своей строке графика", () => {
    expect(surnameFirst("Смирнова Анна", ANNA)).toBe(true);
    expect(surnameFirst("Анна Смирнова", ANNA)).toBe(false);
    expect(surnameFirst("Аня", ANNA)).toBe(null);
    expect(surnameFirst("Смирнова А.", ANNA)).toBe(true);
    expect(surnameFirst("Ким Мария", null)).toBe(null);
    expect(mateName("Ким Мария", true)).toEqual({ first: "Мария", sur: "Ким", ini: "МК" });
    expect(mateName("Мария Ким", false)).toEqual({ first: "Мария", sur: "Ким", ini: "МК" });
    expect(mateName("Маша")).toEqual({ first: "Маша", sur: "", ini: "М" });
    expect(mateName("")).toEqual({ first: "", sur: "", ini: "?" });
  });
  it("с тобой — те, чья смена сегодня пересекается с твоей; старший первым, потом та же смена, потом остальные", () => {
    const r = shiftMates(ANNA, DAY, lsFull());
    expect(r.mates.map((m) => m.first)).toEqual(["Мария", "Дарья", "Ксения", "Пётр"]);
    expect(r.mates.map((m) => m.ini)).toEqual(["МК", "ДЛ", "КМ", "ПО"]);
    expect(r.mates.map((m) => m.lead)).toEqual([true, false, false, false]);
    expect(r.mates.map((m) => m.same)).toEqual([true, true, true, false]);
    expect(r).toMatchObject({ lead: "Мария", leadF: true, leadMe: false });
    // утро 8–12 с днём 12–20 не пересекается, кейтеринг — не в зале, выходной и ушедший в октябре — не в счёт
    for (const name of ["Ольга", "Илья", "Вера", "Глеб"]) expect(r.mates.map((m) => m.first)).not.toContain(name);
  });
  it("старший — как в «Графике»: первый менеджер с обычной сменой; это я — «ты за старшего»", () => {
    const r = shiftMates(MARIA, DAY, lsFull());
    expect(r.leadMe).toBe(true);
    expect(r.lead).toBe(null);
    expect(r.mates.every((m) => !m.lead)).toBe(true);
    expect(r.mates.map((m) => m.first)).toEqual(["Анна", "Дарья", "Ксения", "Пётр"]);
    expect(sp(matesNote(r))).toBe("с тобой сегодня · ты за старшего");
    // менеджер на выездной смене старшим в зале не считается
    const r2 = shiftMates(ANNA, DAY, lsFull({ plan: { ...PLAN, 1: { 14: "К" } } }));
    expect(r2.lead).toBe(null);
    expect(r2.mates.map((m) => m.first)).toEqual(["Дарья", "Ксения", "Пётр"]);
    expect(sp(matesNote(r2))).toBe("с тобой сегодня");
    expect(sp(matesNote({ mates: [{ first: "Пётр" }], lead: "Пётр", leadF: false }))).toBe("с тобой сегодня · Пётр старший");
  });
  it("ночная смена через полночь пересекается с вечерней; своя выездная — только с теми, кто в ней же", () => {
    const night = shiftMates(ANNA, DAY, lsFull({ plan: { 3: { 14: "Н" }, 4: { 14: "В" }, 6: { 14: "У" } } }));
    expect(night.mates.map((m) => m.first)).toEqual(["Пётр"]);
    const cater = shiftMates(ANNA, DAY, lsFull({ plan: { 3: { 14: "К" }, 7: { 14: "К" }, 6: { 14: "Д" } } }));
    expect(cater.mates.map((m) => m.first)).toEqual(["Илья"]);
  });
  it("неизвестно — null: нет копии графика, себя в ней нет, сегодня выходной, нет входа", () => {
    expect(shiftMates(ANNA, DAY, mem())).toBe(null);
    expect(shiftMates({ name: "Зоя", surname: "Новая" }, DAY, lsFull())).toBe(null);
    expect(shiftMates(ANNA, new Date(2026, 10, 16), lsFull())).toBe(null);
    expect(shiftMates(null, DAY, lsFull())).toBe(null);
    // одна в смене — пустой список, а не null: карточка покажет прежнюю строку
    expect(shiftMates(ANNA, new Date(2026, 10, 15), lsFull()).mates).toEqual([]);
  });
  it("имена в строку: не длиннее трёх, хвост не отрывается", () => {
    const m = (...n) => n.map((first) => ({ first }));
    expect(matesLine([])).toBe("");
    expect(matesLine(m("Мария"))).toBe("Мария");
    expect(sp(matesLine(m("Мария", "Дарья")))).toBe("Мария и Дарья");
    expect(sp(matesLine(m("Мария", "Дарья", "Ксения")))).toBe("Мария, Дарья и Ксения");
    expect(sp(matesLine(m("Мария", "Дарья", "Ксения", "Пётр")))).toBe("Мария, Дарья и ещё 2");
    expect(matesLine(m("Мария", "Дарья", "Ксения", "Пётр"))).toContain("и ещё 2");
    expect(matesNote(null)).toBe("");
    expect(matesNote({ mates: [] })).toBe("");
  });
});

describe("v157: сегодняшний состав в тихой подгрузке графика (lib/schedule-sync.js, lib/streak.js)", () => {
  const answer = { ok: true, venues: [{ venue_key: "main", config: { staff: STAFF, shifts: SHIFTS } }], months: [{ venue_key: "main", payload: { plan: PLAN } }] };
  it("рядом со своей строкой — сегодняшний состав: кто, должность, смена; своя строка и план — как были", async () => {
    const ls = mem();
    expect(await syncMySchedule(async () => answer, "tok", ANNA, DAY, ls)).toBe(true);
    const snap = JSON.parse(ls.getItem(BG_KEY + "2026-11"));
    expect(snap.cfg.staff).toEqual([{ id: 3, name: "Смирнова Анна" }]);
    expect(Object.keys(snap.plan)).toEqual(["3"]);
    expect(snap.today.date).toBe("2026-11-14");
    expect(snap.today.staff.map((x) => x.name)).toEqual(["Ким Мария", "Ли Ольга", "Смирнова Анна", "Орлов Пётр", "Лебедева Дарья", "Белов Илья", "Миронова Ксения"]);   // без выходной Веры и ушедшего Глеба
    expect(snap.today.staff[0]).toEqual({ id: 1, name: "Ким Мария", pos: "manager" });
    expect(snap.today.plan).toEqual({ 1: "Д", 2: "У", 3: "Д", 4: "В", 6: "Д", 7: "К", 8: "Д" });
    expect(snap.cfg.shifts.find((q) => q.k === "К")).toEqual({ k: "К", name: "Кейтеринг", from: 10, to: 22, extra: 1 });   // выездная смена помечена и в копии
    expect(snap.cfg.shifts.find((q) => q.k === "Д")).toEqual({ k: "Д", name: "День", from: 12, to: 20 });
    // по этой копии «кто со мной» — тот же, что по целому графику
    expect(shiftMates(ANNA, DAY, ls).mates.map((m) => m.first)).toEqual(["Мария", "Дарья", "Ксения", "Пётр"]);
    expect(shiftMates(ANNA, DAY, ls)).toMatchObject({ lead: "Мария", leadF: true, leadMe: false });
    expect(myShiftOn(ANNA, DAY, ls)).toEqual({ off: false, key: "Д", name: "День", from: 12, to: 20 });
  });
  it("после обновления приложения подгрузка в тот же день идёт ещё раз (отметка прежнего вида не считается), потом — раз в день", async () => {
    const ls = mem({ sa_sched_sync: "2026-11-14|Океан|Анна Смирнова" });   // так отмечала подгрузку v156
    let calls = 0; const rpc = async () => { calls++; return answer; };
    expect(await syncMySchedule(rpc, "tok", ANNA, DAY, ls)).toBe(true);
    expect(JSON.parse(ls.getItem(BG_KEY + "2026-11")).today.date).toBe("2026-11-14");
    expect(ls.getItem("sa_sched_sync")).toBe("2026-11-14|Океан|Анна Смирнова|состав");
    expect(await syncMySchedule(rpc, "tok", ANNA, DAY, ls)).toBe(false);
    expect(calls).toBe(1);
  });
  it("состав вчерашний — не годится: берём копию постарше, где график целиком; иначе неизвестно", async () => {
    const ls = mem();
    await syncMySchedule(async () => answer, "tok", ANNA, new Date(2026, 10, 13, 9, 0, 0), ls);   // подгрузка была вчера
    expect(JSON.parse(ls.getItem(BG_KEY + "2026-11")).today.date).toBe("2026-11-13");
    expect(shiftMates(ANNA, DAY, ls)).toBe(null);
    ls.setItem("sa_sched_cache_main_2026-11", JSON.stringify(full({ ts: 5 })));   // старый снимок экрана «График»
    expect(myScheduleCopies(ANNA, DAY, ls).length).toBe(2);
    expect(myScheduleCopy(ANNA, DAY, ls).c.today.date).toBe("2026-11-13");        // свежая — своя строка
    expect(shiftMates(ANNA, DAY, ls).mates.map((m) => m.first)).toEqual(["Мария", "Дарья", "Ксения", "Пётр"]);
  });
  it("копий нет — пустой список; смена по свежей копии, как раньше", () => {
    expect(myScheduleCopies(ANNA, DAY, mem())).toEqual([]);
    expect(myScheduleCopy(ANNA, DAY, mem())).toBe(null);
    const old = { cfg: { staff: [{ id: "s1", name: "Анна Смирнова" }], shifts: DEFAULT_SHIFTS }, plan: { s1: { 14: "У" } }, ts: 1000 };
    const fresh = { cfg: { staff: [{ id: "a1", name: "Анна Смирнова" }], shifts: DEFAULT_SHIFTS }, plan: { a1: { 14: "Д" } }, ts: 2000 };
    const ls = mem({ "sa_sched_cache_main_2026-11": JSON.stringify(old), [BG_KEY + "2026-11"]: JSON.stringify(fresh) });
    expect(myShiftOn(ANNA, DAY, ls).key).toBe("Д");
    expect(myScheduleCopies(ANNA, DAY, ls).map((x) => x.me.id)).toEqual(["a1", "s1"]);
  });
});

describe("v157: «Смена» — кружки коллег (ui/home-hubs.jsx: ShiftHero)", () => {
  const shift = { off: false, label: "День · 12:00–20:00" };
  const crew = shiftMates(ANNA, DAY, lsFull());
  it("кружки с буквами, имена и кто старший — вместо «Тап покажет…»", () => {
    const html = R(h(ShiftHero, { a11y: false, shift, mates: crew }));
    expect(html).toContain('data-shift-mates="4"');
    expect((html.match(/data-lens="disc" data-mate="/g) || []).length).toBe(3);   // двое и «+2»
    expect(html).toContain('data-mate="lead"');
    expect(html).toContain(">МК</span>");
    expect(html).toContain(">ДЛ</span>");
    expect(html).toContain('data-mate="more"');
    expect(html).toContain(">+2</span>");
    expect(sp(html)).toContain("Мария, Дарья и ещё 2");
    expect(sp(html)).toContain("с тобой сегодня · Мария старшая");
    expect(html).not.toContain("Тап покажет");
    expect(html).toContain("День · 12:00–20:00");
    // трое — три кружка, без «+»
    const three = R(h(ShiftHero, { a11y: false, shift, mates: { ...crew, mates: crew.mates.slice(0, 3) } }));
    expect((three.match(/data-mate="/g) || []).length).toBe(3);
    expect(three).not.toContain('data-mate="more"');
    expect(sp(three)).toContain("Мария, Дарья и Ксения");
  });
  it("состава нет, он пуст или сегодня выходной — карточка прежняя", () => {
    for (const mates of [null, { mates: [] }, undefined]) {
      const html = R(h(ShiftHero, { a11y: false, shift, mates }));
      expect(html).toContain("Тап покажет, кто в смене с тобой и кто старший");
      expect(html).not.toContain("data-shift-mates");
    }
    const off = R(h(ShiftHero, { a11y: false, shift: { off: true }, mates: crew }));
    expect(off).toContain("Отдыхай, а завтра загляни в график");
    expect(off).not.toContain("data-shift-mates");
  });
  it("«Для чтения» — тёмное золото на бумаге; в «Линзе» у старшего ободок ярче", () => {
    const html = R(h(ShiftHero, { a11y: true, shift, mates: crew }));
    expect(html).toContain("color:#7A5D2A");
    expect(html).toContain("rgba(122,93,42,0.8)");
    expect(rd("ui/css.js")).toContain('html.sa-lens [data-lens="disc"][data-mate="lead"] { box-shadow: inset 0 0 0 1.5px var(--lk-hi)');
    const app = rd("App.jsx");
    expect(app).toContain('import { shiftMates } from "./lib/shift-mates";');
    expect(app).toContain("const shiftCrew = useMemo(() => (profile ? shiftMates(profile, new Date()) : null), [profile, todayKey, screen, schedTick]);");
    expect(app).toContain('<ShiftHero a11y={a11y} shift={shiftToday} mates={shiftCrew} onOpen={() => navigate("schedule")} />');
  });
});

describe("v157: «Я» — полка значков и неделя (ui/home-hubs.jsx: MeShelf)", () => {
  const fam = (id, title, tier, pct) => ({ id, title, tier, pct });
  const state = { bronze: 2, total: 14, families: [fam("track", "Трек", 0, 0.2), fam("tests", "Тесты на отлично", 0, 0), fam("table", "Практика у стола", 0, 0.6), fam("dialogue", "Живой диалог", 2, 0.1),
    fam("fresh", "Свежесть тем", 0, 0), fam("streak", "Свеча", 1, 0.5), fam("quest", "Квест смены", 0, 0.9)] };
  it("сначала полученные (старшая ступень первой), потом те, что ближе к бронзе; не больше пяти", () => {
    expect(shelfBadges(state).map((f) => f.id)).toEqual(["dialogue", "streak", "quest", "table", "track"]);
    expect(shelfBadges(state, 3).map((f) => f.id)).toEqual(["dialogue", "streak", "quest"]);
    expect(shelfBadges(null)).toEqual([]);
    expect(shelfBadges({ families: [] })).toEqual([]);
  });
  it("неделя с понедельника: был, сегодня, выходной по графику, без занятия, впереди", () => {
    const streak = { count: 3, last: "2026-11-13", days: ["2026-11-06", "2026-11-11", "2026-11-12", "2026-11-13"], frozen: ["2026-11-10"] };
    const w = shelfWeek(streak, DAY);
    expect(w.map((d) => d.dow)).toEqual(["пн", "вт", "ср", "чт", "пт", "сб", "вс"]);
    expect(w.map((d) => d.key)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
    expect(w.map((d) => d.state)).toEqual(["past", "off", "done", "done", "done", "today", "ahead"]);
    // воскресенье — последний день недели, понедельник — первый
    expect(shelfWeek(null, new Date(2026, 10, 15, 12)).map((d) => d.state)).toEqual(["past", "past", "past", "past", "past", "past", "today"]);
    expect(shelfWeek(null, new Date(2026, 10, 16, 12)).map((d) => d.state)).toEqual(["today", "ahead", "ahead", "ahead", "ahead", "ahead", "ahead"]);
    expect(shelfWeek({ days: ["2026-11-14"] }, DAY)[5].state).toBe("done");
  });
  it("подпись недели", () => {
    expect(sp(shelfWeekNote({ count: 3, last: "2026-11-13" }, DAY))).toBe("сегодня будет 4-й подряд");
    expect(shelfWeekNote({ count: 3, last: "2026-11-13" }, DAY)).toContain("4-й подряд");
    expect(shelfWeekNote({ count: 4, last: "2026-11-14" }, DAY)).toBe("сегодня уже есть");
    expect(shelfWeekNote({ count: 0, last: "" }, DAY)).toBe("начни серию сегодня");
    expect(shelfWeekNote(null, DAY)).toBe("начни серию сегодня");
  });
  it("карточка: «Мои значки · 2 из 14», пять медалей «Пути мастера», неделя; без значков — ничего", () => {
    const streak = { count: 3, last: "2026-11-13", days: ["2026-11-11", "2026-11-12", "2026-11-13"] };
    const html = R(h(MeShelf, { a11y: false, state, streak, now: DAY, onOpen() {} }));
    expect(html).toContain('data-lens-card="" data-me-shelf=""');
    expect(html).toContain("Мои значки");
    expect(html).toContain("2 из 14");
    expect((html.match(/data-me-badge="/g) || []).length).toBe(5);
    expect(html).toContain('data-me-badge="dialogue" data-me-tier="2"');
    expect(html).toContain('aria-label="Живой диалог — серебро"');
    expect(html).toContain('aria-label="Трек — ещё не получен"');
    expect(html).toContain('width="52" height="52"');
    expect((html.match(/data-me-day="/g) || []).length).toBe(7);
    expect((html.match(/data-me-day="done"/g) || []).length).toBe(3);
    expect(html).toContain('data-me-day="today"');
    expect(html).toContain("Эта неделя");
    expect(sp(html)).toContain('сегодня будет <span style="white-space:nowrap">4-й подряд</span>');
    expect(html).toContain('aria-label="Мои значки: 2 из 14. Открыть «Путь мастера»"');
    expect(html).toContain("Неделя. пн: без занятия, вт: без занятия, ср: занятие было, чт: занятие было, пт: занятие было, сб: сегодня, вс: впереди");
    expect(R(h(MeShelf, { a11y: false, state: { families: [], bronze: 0, total: 14 }, streak }))).toBe("");
    expect(R(h(MeShelf, { a11y: false, state: null, streak }))).toBe("");
    const light = R(h(MeShelf, { a11y: true, state, streak, now: DAY }));
    expect(light).toContain("color:#6B5B40");
    const app = rd("App.jsx");
    expect(app).toContain('{mShown ? <MeShelf a11y={a11y} state={mShown} streak={streakLive} onOpen={() => navigate("mastery")} /> : null}</>} items={[');
  });
});

describe("v157: обложки разделов — те же фото, что у уроков (lib/lesson-photo.js, ui/lesson-photo.jsx)", () => {
  const list = normLessonPhotos({ ok: true, restaurant: "Океан", can: { net: false, venue: true }, items: [
    { lesson: "about-1", scope: "", ver: "v1", w: 600, h: 400 }, { lesson: "s0-2", scope: "Океан", ver: "v2" }, { lesson: "mod:s1", scope: "Океан", ver: "v3" }, { lesson: "ref:coffee", scope: "", ver: "v4" }] });
  it("у раздела свой номер: «ref:<раздел Справочника>» и «mod:<раздел трека>» — сервер этапа 51 такие принимает", () => {
    expect(refCoverId("serving")).toBe("ref:serving");
    expect(modCoverId("s-prod")).toBe("mod:s-prod");
    expect(refCoverId("")).toBe("ref:");
    expect(modCoverId("плохой номер")).toBe(null);
    expect(lessonPhotoId("ref:barcard")).toBe("ref:barcard");
    const sql = rd("supabase/supabase-stage51-lesson-photos.sql");
    expect(sql).toContain("if coalesce(p_lesson, '') !~ '^[A-Za-z0-9_.:-]{1,80}$' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;");
    expect(list.map["ref:coffee"].best.ver).toBe("v4");
  });
  it("обложка раздела трека: своё фото раздела, а нет — фото первого урока, у которого оно есть", () => {
    const about = { id: "about", lessons: [{ id: "about-0", title: "Вступление" }, { id: "about-1", title: "Концепция и история" }, { id: "about-2", title: "Ценности" }] };
    expect(moduleCover(list, about)).toMatchObject({ id: "about-1", own: false, lesson: "Концепция и история", info: { ver: "v1" } });
    expect(moduleCover(list, { id: "s1", lessons: [{ id: "s1-1", title: "Урок" }] })).toMatchObject({ id: "mod:s1", own: true, lesson: "", info: { ver: "v3", scope: "Океан" } });
    expect(moduleCover(list, { id: "s0", lessons: [{ id: "s0-1" }, { id: "s0-2", title: "Стресс" }] })).toMatchObject({ id: "s0-2", own: false });
    expect(moduleCover(list, { id: "s9", lessons: [{ id: "s9-1" }] })).toBe(null);
    for (const bad of [null, "missing", undefined, {}]) expect(moduleCover(bad, about)).toBe(null);
    expect(moduleCover(list, null)).toBe(null);
  });
  it("фото из приложения для «Сервировки» и «Вин» лежат в public/reference; у «Кофе» и «Барной карты» — рисунок", () => {
    expect(Object.keys(REF_COVER_DEFAULT)).toEqual(["serving", "wine"]);
    for (const d of Object.values(REF_COVER_DEFAULT)) { expect(d.src).toMatch(/^\/reference\/[a-z_0-9]+\.jpg$/); expect(existsSync("public" + d.src)).toBe(true); expect(d.pos).toMatch(/^\d+% \d+%$/); }
  });
  it("лист «Фото раздела»: слова про раздел; у урока — прежние", () => {
    const boss = { name: "Мария", surname: "Ким", position: "manager", restaurant: "Океан" };
    const sec = R(h(LessonPhotoSheet, { kind: "section", lessonId: "ref:serving", lessonTitle: "Сервировка", profile: boss, a11y: false, list, onClose() {}, note: "Сейчас на обложке снимок из справочника. Своё фото встанет вместо него." }));
    expect(sec).toContain('aria-label="Фото раздела" data-lp-kind="section"');
    expect(sec).toContain(">Фото раздела</div>");
    expect(sec).toContain("Лучше горизонтальное: фото встанет обложкой раздела у «Океан».");
    expect(sec).toContain("Сейчас на обложке снимок из справочника. Своё фото встанет вместо него.");
    expect(sec).toContain("Выбрать фото");
    expect(sec).not.toContain("урок");
    const own = R(h(LessonPhotoSheet, { kind: "section", lessonId: "mod:s1", lessonTitle: "Мышление сервиса", profile: boss, a11y: false, list, onClose() {}, note: "не покажется" }));
    expect(own).toContain("Сменить фото");
    expect(own).toContain("Убрать фото");
    expect(own).not.toContain("не покажется");   // своё фото раздела уже стоит — подсказка «сейчас на обложке…» не нужна
    const les = R(h(LessonPhotoSheet, { lessonId: "about-1", lessonTitle: "Концепция и история", profile: boss, a11y: false, list, onClose() {} }));
    expect(les).toContain('aria-label="Фото урока" data-lp-kind="lesson"');
    expect(les).toContain("Лучше горизонтальное — фото встанет над текстом урока у «Океан».");
    expect(les).toContain("Сейчас у урока фото всей сети. Новое заменит его для «Океан».");
    const src = rd("ui/lesson-photo.jsx");
    expect(src).toContain('drop: "Да, убрать фото у урока"');
    expect(src).toContain('drop: "Да, убрать фото у раздела"');
  });
  it("фотоаппарат у обложки — только тому, кто может ставить фото; без этапа 51 — руководителю", () => {
    const waiter = { name: "Анна", surname: "Смирнова", position: "waiter" }, boss = { name: "Мария", surname: "Ким", position: "manager" };
    expect(canEditCovers(list, waiter)).toBe(true);    // права — по списку с сервера, не по должности
    expect(canEditCovers({ ...list, can: { net: false, venue: false } }, boss)).toBe(false);
    expect(canEditCovers("missing", boss)).toBe(true);
    expect(canEditCovers("missing", waiter)).toBe(false);
    expect(canEditCovers(null, boss)).toBe(false);
    const btn = R(h(CoverEditButton, { id: "ref:wine", title: "Вина", profile: boss, list, onPhoto: true }));
    expect(btn).toContain('data-cover-edit="ref:wine"');
    expect(btn).toContain('aria-label="Фото раздела «Вина»"');
    expect(btn).not.toContain("data-lens=");            // на фото — тёмная подложка, чтобы значок читался на любом снимке
    expect(R(h(CoverEditButton, { id: "ref:coffee", title: "Кофе", profile: boss, list }))).toContain('data-lens="disc"');
    expect(R(h(CoverEditButton, { id: "ref:wine", title: "Вина", profile: waiter, list: { ...list, can: { net: false, venue: false } } }))).toBe("");
    const pas = R(h(CoverEditButton, { id: "mod:s1", title: "Раздел", profile: boss, list, passive: true }));
    expect(pas).toContain('tabindex="-1" aria-hidden="true"');
    expect(pas).toContain("pointer-events:none");
  });
  it("«Справочник»: карточка-обложка; раздел трека: фото сверху, шапка ниже", () => {
    const ref = rd("ui/ReferenceSection.jsx");
    expect(ref).toContain("function RefCard({ c, T, gold, dark, a11y, onGo, photos, profile }) {");
    expect(ref).toContain('data-ref-card={c.id} data-ref-cover={own && ownSrc ? "own" : photo ? "app" : "art"}');
    expect(ref).toContain("minHeight: 112");
    expect(ref).toContain("const photo = own && ownSrc ? { src: ownSrc, pos: \"50% 50%\" } : def;");
    expect(ref).toContain('<CoverEditButton id={id} title={c.t} profile={profile} a11y={!!a11y} list={photos} note={note} onPhoto={!!photo} />');
    expect(ref).toContain("<Hub T={T} gold={gold} dark={dark} a11y={a11y} onBarLab={onBarLab} profile={profile}");
    const mm = rd("ui/module-menu.jsx");
    expect(mm).toContain('<div className={"tbm-menu" + (sealed ? " sealed" : "") + (covered ? " covered" : "")} data-mod-cover={covered ? (cov.own ? "own" : "lesson") : undefined}>');
    expect(mm).toContain('{covered ? <div className="tbm-cover" aria-hidden="true">{covSrc ? <img src={covSrc} alt="" draggable={false} /> : <span className="sa-skel" style={{ position: "absolute", inset: 0 }} />}</div> : null}');
    // место под обложку — сразу, как известно, что фото есть; соседней странице — только превью; не пришло — карточка прежняя
    expect(mm).toContain('const { src: covSrc, gone: covGone } = useCover(cov ? cov.id : null, cov ? cov.info.ver : "", !passive);');
    expect(mm).toContain("const covered = !!cov && !covGone;");
    expect(mm).toContain("passive={passive} style={{ top: 10, right: 46 }}");
    expect(TABLE_CSS).toContain(".tbm-cover{position:absolute;left:0;right:0;top:0;height:178px;border-radius:21px 21px 0 0;overflow:hidden;pointer-events:none;");
    expect(TABLE_CSS).toContain(".tbm-menu.covered .tbm-head{position:relative;padding-top:84px}");
    expect(TABLE_CSS).toContain("html.sa-light .tbm-cover::after{background:linear-gradient(180deg,rgba(248,241,226,0) 0%");
    const sl = rd("ui/screens-learning.jsx");
    expect(sl).toContain("estMins={_estMins} fmtMins={_fmtMins} profile={profile}");
    expect(rd("App.jsx")).toContain('onLesson={openLesson} T={T} a11y={a11y} profile={profile}');
  });
});

describe("v157: вечерние огни на главной (ui/screens-roleselect.jsx)", () => {
  it("вечером и ночью, только в тёмной теме", () => {
    expect([17, 18, 21, 23].map((x) => eveLightsMode(x, false))).toEqual([null, "evening", "evening", "evening"]);
    expect([0, 3, 5, 6, 11].map((x) => eveLightsMode(x, false))).toEqual(["night", "night", "night", null, null]);
    for (const x of [0, 5, 12, 19, 23]) expect(eveLightsMode(x, true)).toBe(null);
  });
  it("десять огней, ночью четыре; золотом приложения; крупных поверх логотипа нет", () => {
    expect(EVE_LIGHTS.length).toBe(10);
    expect(EVE_LIGHTS.filter((l) => l[9]).length).toBe(4);
    for (const [x, y, size, rgb, alpha, dur] of EVE_LIGHTS) {
      const [r, g, b] = rgb.split(",").map(Number);
      expect(r).toBeGreaterThanOrEqual(230); expect(g).toBeGreaterThanOrEqual(190); expect(b).toBeGreaterThanOrEqual(120); expect(b).toBeLessThanOrEqual(180);   // не рыжие: синего не меньше 120
      expect(alpha).toBeLessThanOrEqual(0.13); expect(dur).toBeGreaterThanOrEqual(5.5);
      if (size > 16) expect(x < 34 || x > 66 || y < 20 || y > 76).toBe(true);   // логотип — в середине слоя
    }
  });
  it("фон приложения не трогали: рыжего света снизу нет; «меньше движения» — огни стоят", () => {
    expect(S.app.background).toBe("radial-gradient(130% 80% at 50% -5%, rgba(214,170,80,0.10) 0%, rgba(214,170,80,0) 55%), linear-gradient(160deg, #14110A 0%, #1C1509 50%, #14110A 100%)");
    const src = rd("ui/screens-roleselect.jsx");
    expect(src).toContain('<div className="sa-evl" data-eve-lights={eveLights} aria-hidden="true" style={{ position:"absolute", left:0, right:0, top:0, height: eveH, pointerEvents:"none", overflow:"hidden",');
    expect(src).toContain("const eveLights = eveLightsMode(new Date().getHours(), a11y);");
    expect((src.match(/position: eveLights \? "relative" : undefined/g) || []).length).toBe(2);   // логотип и приветствие — над огнями, и только в этот час
    const css = rd("ui/css.js");
    expect(css).toContain("@keyframes saEvl { 0%, 100% { opacity: .58; transform: translate3d(0, 0, 0); } 50% { opacity: 1; transform: translate3d(var(--dx, 0px), var(--dy, 0px), 0); } }");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .sa-evl > i { animation: none; } }");
  });
});

describe("v157: метка и журнал", () => {
  it("метка «сборка v157», Дополнение 481 со словами владельца, e2e-v157 и запуск тестов в README", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n).toEqual([157]);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 481 — .*\(v157\)/);
    expect(c).toContain("было приятно им пользоваться и было желание остаться в нем подольше");
    expect(c).toContain("Единственное не нравится цвет в выделенной зоне");
    expect(c.replace(/\s+/g, " ")).toContain("их можно будет самому загрузить, верно?");
    const readme = rd("tools/claude/README.md");
    expect(readme).toContain("`e2e-v157.mjs` — v157 (Доп. 481)");
    expect(readme).toContain("node tools/claude/run-tests.mjs .");
    expect(existsSync("tools/claude/run-tests.mjs") && existsSync("tools/claude/vitest-shim.mjs")).toBe(true);
  });
});
