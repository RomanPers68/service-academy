// v159 (Доп. 484): четыре находки для главной из совета Google, которые ложатся в то, что уже есть.
//
// Владелец прислал советы Google по виду главной: «Подскажи что из этого применимо, что будет вливаться органично в уже
// имеющееся… что из этого мы можем взять и внедрить? 😉». Из списка предложено четыре, остальное либо уже есть, либо
// спорит с прежними решениями. Ответ: «Давай все 4😉».
//   1. «Пульс недели»: лидер — кружком с фото под маленькой короной, плашка ведёт в рейтинг (без бегущей строки).
//   2. «Книга отзывов»: первый пустой кружок — бледный оттиск печати в кольце «сколько до экзамена».
//   3. Значок «Меню»: число блюд в стопе; в самом «Меню» — строка «Сегодня нет».
//   4. «Мой график»: пока смена идёт — «Идёт» и риска «сейчас» мягким зелёным.
// Вид в браузере (обе темы, 320 px, нажатия, сверка меню с сервером) — tools/claude/e2e-v159.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { ScheduleTile } from "../ui/schedule-tile";
import { ShiftHero } from "../ui/schedule-hero";
import { weekPulse, weekStart } from "../lib/week-pulse.js";
import { nextSealOf, LEGEND_REVIEWS } from "../data/reviews.js";
import { stopsOf, stopsOnPhone, stopCount, stopBadge, stopsLabel, stopsStale, refreshStops, noteStopCards, _resetStops, STOPS_FRESH_MS, STOPS_RETRY_MS, STOPS_MAX } from "../lib/menu-stops.js";
import { menuTouched, menuTouchedAt, menuDirty, menuSubscribe, _resetMenuFresh } from "../lib/menu-fresh.js";
import { menuDishes, mergeStops } from "../lib/menu-dishes.js";
import { StopBadge } from "../ui/stop-badge";
import { MODULES } from "../data/modules";
import { countable } from "../lib/info-topics";

const noop = () => {};
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const text = (html) => html.replace(/<[^>]+>/g, "");
const count = (html, re) => (html.match(re) || []).length;
const rd = (f) => readFileSync(f, "utf8");
const at = (hh, mm = 0) => { const d = new Date(); d.setHours(hh, mm, 0, 0); return d; };
const RS = rd("ui/screens-roleselect.jsx");
const OCEAN = "Два моря, Океан";

const T4 = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false,
  roleHeader: {}, roleSubtitle: {}, roleList: {}, roleCard: {}, roleAccent: {}, roleIcon: {}, roleInfo: {}, roleLabel: {}, roleSublabel: {}, roleDesc: {} };
const mod = { id: "cms-m-1", title: "Свой раздел", lessons: [{ id: "cms-l-1", type: "lesson", title: "Урок: встреча гостя", content: "Текст" }] };
const profile = { name: "Роман", surname: "Смирнов", restaurant: OCEAN, position: "waiter" };
const boss = { ...profile, position: "manager", is_admin: true };
const home = async (extra = {}) => {
  const { RoleSelect } = await import("../ui/screens-roleselect");
  return R(h(RoleSelect, { T: T4, a11y: false, profile, role: "seasonal", onSelect: noop, onContinueLesson: noop, onGuestBook: noop, onSchedule: noop, customByRole: { seasonal: [mod] }, ...extra }));
};
const clear = () => { for (const k of Object.keys(store)) delete store[k]; };

// ───────────────────────── 4. «Мой график»: смена идёт ─────────────────────────
describe("v159: «Мой график» — пока смена идёт, «Идёт» и риска «сейчас» мягким зелёным", () => {
  const TILE = { flex: "1 1 150px", minWidth: 0, boxSizing: "border-box", position: "relative", borderRadius: 14, cursor: "pointer" };
  const tile = (props) => R(h(ScheduleTile, { a11y: false, mgr: false, tile: TILE, frame: "rgba(1,2,3,0.4)", onOpen: noop, act: { role: "button", tabIndex: 0 }, ...props }));
  it("19:30 при смене 17–24: вместо «Вечер» — «Идёт» зелёным, время золотом; диктору — «…, смена идёт»", () => {
    const html = tile({ label: "Вечер · 17:00–24:00", now: at(19, 30) });
    expect(html).toMatch(/<span data-when-live="" style="margin-left:10px;white-space:nowrap;color:#8AD8AF">Идёт<\/span>/);
    expect(text(html)).toContain("Мой графикИдёт·17:00–24:00");
    expect(text(html)).not.toContain("Вечер");
    expect(html).toContain('aria-label="Мой график. Сегодня: Вечер, 17:00–24:00, смена идёт"');   // название смены диктор всё равно называет
    expect(html).toMatch(/data-when-time=""[^>]*color:#E2C484/);
  });
  it("риска «сейчас» на нити — зелёная с мягким сиянием; размер прежний (2 × 7 px)", () => {
    const html = tile({ label: "Вечер · 17:00–24:00", now: at(19, 30) });
    expect(html).toMatch(/data-now="on" style="position:absolute;bottom:0;left:calc\(81.25% - 1px\);width:2px;height:7px;border-radius:1px 1px 0 0;background:#8AD8AF;box-shadow:0 0 6px rgba\(138,216,175,0.85\)"/);
    expect(html).toMatch(/data-seg="17-24"[^>]*background:linear-gradient\(90deg, #9C7A42, #F8E6B6\)/);   // сам отрезок смены — золотой, как был
  });
  it("до смены и после — название смены и золотая риска без сияния, слов «смена идёт» нет", () => {
    for (const [hh, mm] of [[10, 30], [16, 59], [0, 10]]) {
      const html = tile({ label: "Вечер · 17:00–24:00", now: at(hh, mm) });
      expect([hh, html.includes("data-when-live")]).toEqual([hh, false]);
      expect(html).toContain('<span style="margin-left:10px;white-space:nowrap">Вечер</span>');   // разметка названия — как до v159
      expect(html).toMatch(/data-now="off" style="[^"]*background:#E2C484;box-shadow:none"/);
      expect(html).toContain('aria-label="Мой график. Сегодня: Вечер, 17:00–24:00"');
    }
  });
  it("края: 17:00 — уже идёт, 23:59 — ещё идёт; ночная 22–6 идёт и в 23:00, и в 2:30, в 6:00 — уже нет", () => {
    const live = (label, hh, mm = 0) => tile({ label, now: at(hh, mm) }).includes('data-when-live=""');
    expect([live("Вечер · 17:00–24:00", 17), live("Вечер · 17:00–24:00", 23, 59)]).toEqual([true, true]);
    expect([live("Ночь · 22:00–6:00", 23), live("Ночь · 22:00–6:00", 2, 30), live("Ночь · 22:00–6:00", 6), live("Ночь · 22:00–6:00", 12)]).toEqual([true, true, false, false]);
  });
  it("выходной и подпись другого вида — без «Идёт»; у руководителя («График смен») — так же, как у сотрудника", () => {
    expect(tile({ label: "выходной", now: at(12) })).not.toContain("data-when-live");
    expect(tile({ label: "Инвентаризация", now: at(12) })).not.toContain("data-when-live");
    expect(tile({ label: null, now: at(12) })).not.toContain("data-when-live");
    const mgr = tile({ mgr: true, label: "День · 12:00–20:00", now: at(13) });
    expect(text(mgr)).toContain("График сменИдёт·12:00–20:00");
    expect(mgr).toContain('aria-label="График смен. Сегодня: День, 12:00–20:00, смена идёт"');
  });
  it("«Для чтения»: зелёный темнее (#2C6B48) — и слово, и риска", () => {
    const html = tile({ a11y: true, label: "Вечер · 17:00–24:00", now: at(19, 30) });
    expect(html).toMatch(/data-when-live="" style="[^"]*color:#2C6B48"/);
    expect(html).toMatch(/data-now="on"[^>]*background:#2C6B48;box-shadow:0 0 6px rgba\(44,107,72,0.55\)/);
  });
  it("в «Графике» у ближайшей смены «идёт» — тем же зелёным; слова прежние", () => {
    const SH = { k: "В", name: "Вечер", from: 16, to: 24 };
    const d = new Date(2026, 9, 17); const on = new Date(d); on.setHours(20, 30, 0, 0); const before = new Date(d); before.setHours(14, 20, 0, 0);
    const hero = (now, a11y = false) => R(h(ShiftHero, { a11y, card: { margin: 14, padding: 14, borderRadius: 18 }, d: 17, sh: SH, when: "сегодня", dowName: "суббота", dowShort: "сб", monthR: "октября",
      isToday: true, now, lead: "Смирнов Роман", leadNode: h("span", null, "Смирнов Роман"), mates: 10, onMates: noop, onChecklist: noop, due: null }));
    const html = hero(on);
    expect(text(html)).toContain("8 ч · идёт · ещё 3 ч 30 мин");
    expect(html).toContain('<span data-hero-live="" style="color:#8AD8AF">идёт</span>');
    expect(hero(on, true)).toContain('<span data-hero-live="" style="color:#2C6B48">идёт</span>');
    expect(html).toMatch(/data-now="on"[^>]*background:#8AD8AF/);
    const soon = hero(before);
    expect(text(soon)).toContain("8 ч · через 1 ч 40 мин");
    expect(soon).not.toContain("data-hero-live");
  });
});

// ───────────────────────── 1. «Пульс недели» ─────────────────────────
describe("v159: «Пульс недели» — счёт и лидер (lib/week-pulse.js)", () => {
  const NOW = new Date(2026, 10, 11, 12, 0, 0);                       // среда, 11 ноября 2026
  const iso = (y, m, d, hh = 12, mm = 0) => new Date(y, m, d, hh, mm, 0).toISOString();
  const row = (name, surname, score, when, restaurant = OCEAN) => ({ name, surname, score, updated_at: when, restaurant });
  it("неделя — с понедельника 00:00 по часам телефона", () => {
    expect(new Date(weekStart(NOW))).toEqual(new Date(2026, 10, 9, 0, 0, 0));
    expect(new Date(weekStart(new Date(2026, 10, 9, 0, 0, 0)))).toEqual(new Date(2026, 10, 9, 0, 0, 0));      // сам понедельник
    expect(new Date(weekStart(new Date(2026, 10, 15, 23, 59, 0)))).toEqual(new Date(2026, 10, 9, 0, 0, 0));   // воскресенье — та же неделя
  });
  it("тесты и люди — только с этой недели; лидер — у кого больше очков в сумме; у лидера есть заведение", () => {
    const p = weekPulse([
      row("Вера", "Соколова", 9, iso(2026, 10, 10)), row("Вера", "Соколова", 8, iso(2026, 10, 11, 9)), row("Анна", "Смирнова", 12, iso(2026, 10, 9, 0, 0)),
      row("Пётр", "Орлов", 20, iso(2026, 10, 8, 23, 59)),                                                       // воскресенье прошлой недели — мимо
      { name: "Дарья", surname: "Лебедева", score: 30 },                                                        // без даты — мимо
    ], NOW);
    expect([p.tests, p.people]).toEqual([3, 2]);
    expect(p.leader).toEqual({ full: "Вера Соколова", name: "Вера", surname: "Соколова", restaurant: OCEAN, sum: 17 });
  });
  it("поровну — лидер тот, кто встретился раньше (как было); без фамилии — одно имя; на неделе пусто — null", () => {
    expect(weekPulse([row("Анна", "Смирнова", 9, iso(2026, 10, 10)), row("Вера", "Соколова", 9, iso(2026, 10, 10))], NOW).leader.full).toBe("Анна Смирнова");
    expect(weekPulse([{ name: "Илья", score: 5, updated_at: iso(2026, 10, 10) }], NOW).leader).toEqual({ full: "Илья", name: "Илья", surname: "", restaurant: "", sum: 5 });
    expect(weekPulse([row("Вера", "Соколова", 9, iso(2026, 10, 1))], NOW)).toBe(null);
    expect(weekPulse([], NOW)).toBe(null);
    expect(weekPulse(null, NOW)).toBe(null);
  });
});

describe("v159: «Пульс недели» на главной — лидер кружком под короной, плашка ведёт в рейтинг", () => {
  const now = new Date().toISOString();
  const scores = [{ name: "Ангелина", surname: "Токарева", score: 9, updated_at: now, restaurant: OCEAN }, { name: "Иван", surname: "Петров", score: 6, updated_at: now, restaurant: OCEAN }];
  const pulseOf = (html) => { const a = html.indexOf("data-pulse="); return html.slice(a, html.indexOf("</div>", a)); };
  beforeEach(clear);
  it("плашка той же плотности; кружок с буквами лидера и короной стоит на месте слова «лидер:», имя — следом", async () => {
    const html = await home({ profile: boss, scores });
    expect(html).toContain('data-pulse="" style="margin:0 14px 8px;padding:6px 12px;');
    const p = pulseOf(html);
    expect(p).not.toContain("<div");          // внутри плашки — только строчные элементы:
    expect(p).toContain("Токарева</span>");   // до первого </div> она видна целиком
    expect(text(html)).toContain("Пульс недели · 2 теста · 2 чел в игре · АТАнгелина Токарева");
    expect(text(html)).not.toContain("лидер:");
    expect(p).toMatch(/<span data-pulse-lead="" style="white-space:nowrap"><span data-pulse-leader="" aria-hidden="true" style="position:relative;display:inline-grid;place-items:center;vertical-align:middle;width:22px;height:22px;margin:-6px 5px -6px 0;border-radius:50%/);
    expect(count(p, /data-pulse-crown=""/g)).toBe(1);
    expect(p).toMatch(/data-pulse-crown="" style="position:absolute;top:-6.5px;left:50%;margin-left:-6px/);
    expect(p).not.toContain("data-face");   // фото лидера приезжает с сервера (этап 52); без него — буквы
  });
  it("нажимается, когда есть куда вести: кнопка с подписью для диктора; без onLeaderboard — просто плашка", async () => {
    const go = await home({ profile: boss, scores, onLeaderboard: noop });
    expect(go).toMatch(/data-pulse="" style="[^"]*cursor:pointer[^"]*" data-pulse-go="" role="button" tabindex="0" aria-label="Пульс недели: 2 теста, в игре 2, лидер Ангелина Токарева\. Открыть рейтинг"/);
    const plain = await home({ profile: boss, scores });
    expect(plain).toMatch(/data-pulse="" style="[^"]*cursor:default[^"]*" aria-label="Пульс недели: 2 теста, в игре 2, лидер Ангелина Токарева"/);
    expect(plain).not.toContain("data-pulse-go");
    expect(RS).toContain("const go = onLeaderboard ? () => onLeaderboard() : null;");
    expect(RS).toContain("data-pulse-go={go ? \"\" : undefined} onClick={go || undefined} {...onActivate(go)}");
    expect(rd("App.jsx")).toContain('onLeaderboard={() => navigate("leaderboard")}');
  });
  it("имя и фамилия не отрываются от кружка; третье слово и очень длинное имя переносятся", async () => {
    const three = await home({ profile: boss, scores: [{ name: "Анна Мария", surname: "Ким", score: 9, updated_at: now }] });
    expect(text(pulseOf(three))).toContain("· АКАнна Мария Ким");
    expect(pulseOf(three)).toMatch(/<span style="color:#C8A96E">Анна Мария<\/span><\/span><span style="color:#C8A96E"> Ким<\/span>/);
    const long = await home({ profile: boss, scores: [{ name: "Александра-Виктория", surname: "Константинопольская", score: 9, updated_at: now }] });
    expect(pulseOf(long)).toMatch(/<span style="color:#C8A96E">Александра-Виктория<\/span><\/span><span style="color:#C8A96E"> Константинопольская<\/span>/);
  });
  it("видит, как и раньше, только владелец; на неделе без тестов плашки нет", async () => {
    expect(await home({ profile, scores })).not.toContain("data-pulse=");
    expect(await home({ profile: { ...profile, position: "manager" }, scores })).not.toContain("data-pulse=");
    const old = new Date(Date.now() - 20 * 864e5).toISOString();
    expect(await home({ profile: boss, scores: scores.map((s) => ({ ...s, updated_at: old })) })).not.toContain("data-pulse=");
  });
  it("«Для чтения»: тёмное золото, #C8A96E в плашке нет; корона темнее", async () => {
    const lt = pulseOf(await home({ profile: boss, scores, a11y: true, onLeaderboard: noop }));
    expect(lt).toContain("color:#7A5D2A");
    expect(lt).not.toContain("#C8A96E");
    expect(lt).toContain('fill="#B8862B"');
    expect(lt).toContain("linear-gradient(135deg, #B08A3E, #7A5D2A)");
  });
  it("бегущей строки нет: в плашке ничего не движется", async () => {
    const p = pulseOf(await home({ profile: boss, scores, onLeaderboard: noop }));
    expect(p).not.toMatch(/animation|marquee|transition/);
  });
});

// ───────────────────────── 2. «Книга отзывов»: следующая печать ─────────────────────────
describe("v159: следующая печать — до чьего экзамена ближе (data/reviews.js: nextSealOf)", () => {
  const ROLES6 = Object.keys(LEGEND_REVIEWS);
  const prog = (m) => (r) => m[r] || 0;
  it("печатей столько же, сколько ролей с экзаменом; своя роль, пока её экзамен не сдан, — первая", () => {
    expect(ROLES6).toEqual(["spg", "seasonal", "core", "manager", "service_manager", "bar"]);
    expect(nextSealOf({ role: "seasonal", examResults: {}, progressOf: prog({ seasonal: 8, bar: 60 }) })).toEqual({ role: "seasonal", pct: 8, ready: false });
    expect(nextSealOf({ role: "bar", examResults: { seasonal: { passed: true } }, progressOf: prog({ bar: 100 }) })).toEqual({ role: "bar", pct: 100, ready: true });
  });
  it("свой экзамен сдан — из открытых ролей та, где пройдено больше; при равенстве — первая по порядку", () => {
    const ex = { seasonal: { passed: true } };
    expect(nextSealOf({ role: "seasonal", examResults: ex, progressOf: prog({ spg: 10, bar: 40, core: 90 }), unlocked: new Set(["seasonal", "spg", "bar"]) })).toEqual({ role: "bar", pct: 40, ready: false });
    expect(nextSealOf({ role: "seasonal", examResults: ex, progressOf: prog({ core: 90 }), unlocked: ["seasonal", "spg", "bar", "core"] }).role).toBe("core");
    expect(nextSealOf({ role: "seasonal", examResults: ex, progressOf: prog({}), unlocked: new Set(["seasonal", "spg", "bar"]) })).toEqual({ role: "spg", pct: 0, ready: false });
    expect(nextSealOf({ role: "seasonal", examResults: ex, progressOf: prog({ manager: 30 }) }).role).toBe("manager");   // список открытых не дали — из всех
  });
  it("несданный экзамен — не печать; все печати получены — null; проценты — от 0 до 100 целым", () => {
    expect(nextSealOf({ role: "seasonal", examResults: { seasonal: { passed: false, score: 60 } }, progressOf: prog({ seasonal: 100 }) })).toEqual({ role: "seasonal", pct: 100, ready: true });
    expect(nextSealOf({ role: "seasonal", examResults: Object.fromEntries(ROLES6.map((r) => [r, { passed: true }])), progressOf: prog({}) })).toBe(null);
    expect(nextSealOf({ role: "seasonal", progressOf: () => 133.7 }).pct).toBe(100);
    expect(nextSealOf({ role: "seasonal", progressOf: () => -5 }).pct).toBe(0);
    expect(nextSealOf({ role: "seasonal", progressOf: () => "x" }).pct).toBe(0);
    expect(nextSealOf({ role: "seasonal", progressOf: () => 49.6 }).pct).toBe(50);
    expect(nextSealOf().role).toBe("spg");
  });
});

describe("v159: «Книга отзывов» на главной — первый пустой кружок стал оттиском печати в кольце", () => {
  // свой раздел из четырёх шагов (три урока, тест и страница итога, которая в счёт не идёт): штатные разделы роли в
  // тестах могут быть пустыми, а считать надо доли
  const mod4 = { id: "cms-m-4", title: "Раздел из четырёх шагов", lessons: [{ id: "c4-1", type: "lesson", title: "Раз", content: "…" }, { id: "c4-2", type: "lesson", title: "Два", content: "…" },
    { id: "c4-3", type: "lesson", title: "Три", content: "…" }, { id: "c4-q", type: "quiz", title: "Тест", questions: [] }, { id: "c4-r", type: "result", title: "Итог" }] };
  const seals = (extra = {}) => home({ customByRole: { seasonal: [mod4] }, ...extra });
  const lessons = () => countable([...(MODULES.seasonal || []), mod4]).flatMap((m) => (m.lessons || []).filter((l) => l.type !== "result"));
  const doneAll = () => { const completed = {}, quizDone = {}; for (const l of lessons()) (l.type === "quiz" ? quizDone : completed)[l.id] = true; return { completed, quizDone }; };
  const book = (html) => { const a = html.indexOf('data-tile="book"'), b = html.indexOf("Треки обучения", a); return html.slice(a, b > a ? b : html.length); };
  beforeEach(clear);
  it("новичок: один оттиск и пять пустых кружков; кольца ещё нет (0%), оттиск бледный", async () => {
    const b = book(await seals());
    expect(count(b, /data-seal-next="/g)).toBe(1);
    expect(count(b, /data-seal-empty=""/g)).toBe(Object.keys(LEGEND_REVIEWS).length - 1);
    expect(b).toMatch(/<svg data-seal-next="0" role="img" aria-label="Следующая печать: до экзамена пройдено 0%" width="17" height="17" viewBox="0 0 24 24" style="flex-shrink:0;display:block;margin:-2px -1px;overflow:visible">/);
    expect(b).not.toContain("data-seal-ring");
    expect(b).not.toContain("data-seal-ready");
    expect(b).toMatch(/<g opacity="0.5" transform="translate\(12 12\) scale\(0.62\) translate\(-12 -12\)">/);
    expect(b.indexOf("data-seal-next")).toBeLessThan(b.indexOf("data-seal-empty"));   // оттиск — первым из пустых
  });
  it("кольцо показывает, сколько уроков своей роли пройдено; число — то же, что на кружке трека", async () => {
    const all = lessons();
    const pct = Math.round((1 / all.length) * 100);
    expect(pct).toBeGreaterThan(0); expect(pct).toBeLessThan(100);
    const b = book(await seals({ completed: { "c4-1": true } }));
    expect(b).toContain(`data-seal-next="${pct}"`);
    expect(b).toContain(`aria-label="Следующая печать: до экзамена пройдено ${pct}%"`);
    const len = 2 * Math.PI * 10.4;
    expect(b).toContain(`<circle data-seal-ring="" cx="12" cy="12" r="10.4" fill="none" stroke="#E8C983" stroke-width="2.1" stroke-linecap="round" stroke-dasharray="${(len * pct / 100).toFixed(2)} ${len.toFixed(2)}" transform="rotate(-90 12 12)">`);
  });
  it("все уроки пройдены, экзамен впереди: кольцо полное, оттиск ярче, диктору — «остался экзамен»", async () => {
    const b = book(await seals(doneAll()));
    expect(b).toContain('data-seal-next="100" data-seal-ready=""');
    expect(b).toContain('aria-label="Следующая печать: уроки пройдены, остался экзамен"');
    expect(b).toMatch(/<g opacity="0.9" transform/);
  });
  it("экзамены сданы: настоящие печати слева, оттиск — сразу за ними; все шесть — ни оттиска, ни пустых", async () => {
    const one = book(await seals({ examResults: { spg: { passed: true } } }));
    expect(count(one, /url\(#saWax\)/g)).toBe(1);
    expect(count(one, /data-seal-next="/g)).toBe(1);
    expect(count(one, /data-seal-empty=""/g)).toBe(4);
    expect(one.indexOf("url(#saWax)")).toBeLessThan(one.indexOf("data-seal-next"));
    const all = book(await seals({ examResults: Object.fromEntries(Object.keys(LEGEND_REVIEWS).map((r) => [r, { passed: true }])) }));
    expect(count(all, /url\(#saWax\)/g)).toBe(6);
    expect(all).not.toContain("data-seal-next");
    expect(all).not.toContain("data-seal-empty");
  });
  it("«Для чтения»: кольцо тёмным золотом, оттиск ещё бледнее; пустой кружок (v150) не тронут", async () => {
    const b = book(await seals({ a11y: true, quizDone: { "c4-q": true } }));
    expect(b).toMatch(/data-seal-ring=""[^>]*stroke="#7A5D2A"/);
    expect(b).toMatch(/<g opacity="0.36" transform/);
    expect(RS).toContain('<div data-seal-empty="" style={{ width: 13, height: 13, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box"');
    expect(RS).toContain(": i === bs.seals && nextSeal ? <NextSealSlot key={i} a11y={a11y} pct={nextSeal.pct} ready={nextSeal.ready} />");
  });
});

// ───────────────────────── 3. стоп-лист на значке «Меню» ─────────────────────────
describe("v159: сколько блюд в стопе — счёт по копии меню на телефоне (lib/menu-stops.js)", () => {
  const S = (at = 100) => ({ since: at });
  beforeEach(() => { clear(); _resetStops(); _resetMenuFresh(); });
  it("свои без архива и меню команды без напитков, карты бара, удалённого и архива; порядок — как в меню", () => {
    const custom = [{ id: "a", name: "Тартар", stop: S() }, { id: "b", name: "Севиче" }, { id: "c", name: "В архиве", stop: S(), archived: true }, { id: "d", stop: S() }];
    const shared = [{ id: "a", name: "Тартар (у команды)" }, { id: "s1", name: "Суп дня", stop: S() }, { id: "s2", name: "Салат" }, { id: "w1", name: "Рислинг", kind: "wine", stop: S() },
      { id: "k1", name: "Негрони", kind: "cocktail", stop: S() }, { id: "sp", name: "Виски", kind: "spirit", stop: S() }, { id: "__barcard__", cocktails: [], stop: S() },
      { id: "s3", name: "Удалён до публикации", stop: S() }, { id: "s4", name: "Архив команды", stop: S(), archived: true }, { name: "без номера", stop: S() }, null];
    expect(stopsOf({ custom, shared, deleted: ["s3"] })).toEqual([{ id: "a", name: "Тартар" }, { id: "s1", name: "Суп дня" }]);
    expect(stopsOf()).toEqual([]);
    expect(stopsOf({ custom: null, shared: "x", deleted: 5 })).toEqual([]);
  });
  it("стоп из чата (на сервере) новее своей копии — действует он; своя правка новее — действует она", () => {
    const own = (stop, stopAt) => [{ id: "a", name: "Тартар", stop, stopAt }];
    const srv = (stop, stopAt) => [{ id: "a", name: "Тартар", stop, stopAt }];
    expect(stopsOf({ custom: own(null, 100), shared: srv(S(200), 200) }).length).toBe(1);   // в чате поставили стоп
    expect(stopsOf({ custom: own(S(100), 100), shared: srv(null, 200) }).length).toBe(0);   // в чате вернули в меню
    expect(stopsOf({ custom: own(S(300), 300), shared: srv(null, 200) }).length).toBe(1);   // сам поставил позже
    expect(stopsOf({ custom: own(null, 300), shared: srv(S(200), 200) }).length).toBe(0);   // сам снял позже
    expect(stopsOf({ custom: own(S(), undefined), shared: srv(null, undefined) }).length).toBe(1);   // отметок времени нет — своя копия
  });
  it("то же число, что даёт правило экрана «Меню» (menuDishes + mergeStops), на разных наборах", () => {
    const sets = [
      { custom: [], shared: [] },
      { custom: [{ id: "a", name: "A", stop: S(5), stopAt: 5 }, { id: "b", name: "B" }], shared: [{ id: "a", name: "A", stop: null, stopAt: 9 }, { id: "c", name: "C", stop: S(), stopAt: 3 }] },
      { custom: [{ id: "a", name: "A", archived: true, stop: S() }], shared: [{ id: "a", name: "A", stop: S(), stopAt: 2 }, { id: "w", name: "W", kind: "wine", stop: S() }, { id: "x", name: "X", stop: S() }], deleted: ["x"] },
      { custom: [{ id: "m1", name: "Пример стал своим", stop: S(7), stopAt: 7 }], shared: [], },
      { custom: [{ id: "a", name: "A" }, { id: "b", name: "B", stop: S(1), stopAt: 1 }], shared: [{ id: "b", name: "B", stop: null, stopAt: 1 }, { id: "__barcard__", cocktails: ["x"] }, { id: "z", name: "Z", stop: S() }, { id: "y", name: "Y", archived: true, stop: S() }] },
    ];
    for (const s of sets) {
      const own = s.custom, merged = mergeStops(own, s.shared);
      const full = menuDishes({ restaurant: OCEAN, custom: { [OCEAN]: merged }, shared: s.shared, deleted: { [OCEAN]: s.deleted || [] } }).filter((d) => d.stop).map((d) => String(d.id));
      expect(stopsOf(s).map((d) => d.id)).toEqual(full);
    }
  });
  it("с телефона: свои, меню команды и удалённые — по заведению; другого заведения и пустого — ноль", () => {
    store.sa_menu_custom = JSON.stringify({ [OCEAN]: [{ id: "a", name: "Тартар", stop: S() }], "Марико": [{ id: "m", name: "Роллы", stop: S() }, { id: "n", name: "Суши", stop: S() }] });
    store.sa_menu_shared = JSON.stringify({ [OCEAN]: [{ id: "s1", name: "Суп дня", stop: S() }, { id: "s2", name: "Десерт", stop: S() }] });
    store.sa_menu_deleted = JSON.stringify({ [OCEAN]: ["s2"] });
    expect(stopsOnPhone(OCEAN)).toEqual([{ id: "a", name: "Тартар" }, { id: "s1", name: "Суп дня" }]);
    expect([stopCount(OCEAN), stopCount("Марико"), stopCount("Порт"), stopCount("")]).toEqual([2, 2, 0, 0]);
    store.sa_menu_shared = "{не json";
    expect(stopCount(OCEAN)).toBe(1);
  });
  it("число на жетоне и слова для диктора", () => {
    expect([stopBadge(0), stopBadge(-2), stopBadge(null), stopBadge(1), stopBadge(12), stopBadge(STOPS_MAX), stopBadge(100), stopBadge(3.9)]).toEqual(["", "", "", "1", "12", "99", "99+", "3"]);
    expect([0, 1, 2, 4, 5, 11, 12, 21, 22, 25].map(stopsLabel)).toEqual(["Меню", "Меню. В стопе 1 блюдо", "Меню. В стопе 2 блюда", "Меню. В стопе 4 блюда", "Меню. В стопе 5 блюд", "Меню. В стопе 11 блюд",
      "Меню. В стопе 12 блюд", "Меню. В стопе 21 блюдо", "Меню. В стопе 22 блюда", "Меню. В стопе 25 блюд"]);
  });
  it("модуль лёгкий: ни заготовок меню, ни коктейлей в стартовый набор он не тянет", () => {
    const imports = (f) => [...rd(f).matchAll(/^import [^;]*? from "([^"]+)";/gm)].map((m) => m[1]);
    expect(imports("lib/menu-stops.js")).toEqual(["../api/supabase", "./menu-fresh.js"]);
    expect(imports("lib/menu-fresh.js")).toEqual([]);
    expect(imports("lib/week-pulse.js")).toEqual([]);
    expect(imports("ui/stop-badge.jsx")).toEqual(["react", "../lib/menu-stops", "../lib/menu-fresh"]);
    expect(rd("lib/menu-stops.js")).toContain('import("./reference-context.js")');           // тяжёлое — только когда ответ сервера уже пришёл
    expect(rd("data/reviews.js")).not.toMatch(/from "\.\/menu"/);                             // как в v79
    expect(rd("lib/deck-extras.js")).toContain('export const BARCARD_ID = "__barcard__";');   // тот же номер карты бара
    expect(rd("lib/menu-stops.js")).toContain('const BARCARD_ID = "__barcard__";');
  });
});

describe("v159: свежесть числа — копия меню сверяется с сервером, пока главная на виду", () => {
  const menu = [{ id: "s1", name: "Суп дня", stop: { since: 1 }, stopAt: 1 }];
  let asked, saved;
  const ask = (res) => (fn, args) => { asked.push([fn, args]); return typeof res === "function" ? res() : Promise.resolve(res); };
  const remember = (r, list) => { saved.push([r, list.length]); menuTouched(r, 1e6); };
  beforeEach(() => { clear(); _resetStops(); _resetMenuFresh(); asked = []; saved = []; });
  it("отметка свежести: записали копию — «свежая» пять минут; подписчики узнают, отписка работает", () => {
    const got = []; const off = menuSubscribe((r, why) => got.push(r + ":" + why));
    expect(menuTouchedAt(OCEAN)).toBe(0);
    expect(stopsStale(OCEAN, 1e6)).toBe(true);
    menuTouched(OCEAN, 1e6);
    expect(menuTouchedAt(OCEAN)).toBe(1e6);
    expect([stopsStale(OCEAN, 1e6 + STOPS_FRESH_MS), stopsStale(OCEAN, 1e6 + STOPS_FRESH_MS + 1), stopsStale("Марико", 1e6), stopsStale("", 1e6)]).toEqual([false, true, true, false]);
    menuDirty(OCEAN);
    expect(menuTouchedAt(OCEAN)).toBe(0);
    menuTouched("Марико", 5); menuDirty();
    expect(menuTouchedAt("Марико")).toBe(0);
    off(); menuTouched(OCEAN, 7);
    expect(got).toEqual([OCEAN + ":fresh", OCEAN + ":dirty", "Марико:fresh", ":dirty"]);
    expect(STOPS_FRESH_MS).toBe(5 * 60e3);
    menuSubscribe(() => { throw new Error("сломанный подписчик"); }); menuTouched(OCEAN, 8);   // чужая ошибка не мешает остальным
    expect(menuTouchedAt(OCEAN)).toBe(8);
  });
  it("копия устарела — один запрос menu_get по заведению, ответ запоминается; свежая — запроса нет", async () => {
    expect(await refreshStops(OCEAN, { now: 1e6, ask: ask(menu), remember })).toBe(true);
    expect(asked).toEqual([["menu_get", { p_restaurant: OCEAN }]]);
    expect(saved).toEqual([[OCEAN, 1]]);
    expect(await refreshStops(OCEAN, { now: 1e6 + 60e3, ask: ask(menu), remember })).toBe(false);   // минуту назад сверяли
    expect(asked.length).toBe(1);
    expect(await refreshStops(OCEAN, { now: 1e6 + STOPS_FRESH_MS + 1, ask: ask(JSON.stringify(menu)), remember })).toBe(true);   // строкой — тоже меню
    expect(asked.length).toBe(2);
    expect(await refreshStops("", { now: 1e6, ask: ask(menu), remember })).toBe(false);
  });
  it("в чате поменяли стоп (force) — спрашиваем сразу; два вызова подряд — один запрос", async () => {
    menuTouched(OCEAN, 1e6);
    let free; const slow = () => new Promise((res) => { free = () => res(menu); });
    const a = refreshStops(OCEAN, { force: true, now: 1e6 + 1000, ask: ask(slow), remember });
    const b = refreshStops(OCEAN, { force: true, now: 1e6 + 1000, ask: ask(slow), remember });
    expect(b).toBe(a);
    await Promise.resolve(); await Promise.resolve();
    expect(asked.length).toBe(1);
    free();
    expect(await a).toBe(true);
    expect(await refreshStops(OCEAN, { force: true, now: 1e6 + 2000, ask: ask(menu), remember })).toBe(true);   // следующий — уже новый запрос
    expect(asked.length).toBe(2);
  });
  it("нет связи или ответ не меню — минуту не спрашиваем, даже по force; потом снова", async () => {
    expect(await refreshStops(OCEAN, { now: 1e6, ask: ask(() => Promise.reject(new Error("net"))), remember })).toBe(false);
    expect(await refreshStops(OCEAN, { now: 1e6 + 30e3, ask: ask(menu), remember })).toBe(false);
    expect(await refreshStops(OCEAN, { force: true, now: 1e6 + STOPS_RETRY_MS - 1, ask: ask(menu), remember })).toBe(false);
    expect(asked.length).toBe(1);
    expect(await refreshStops(OCEAN, { now: 1e6 + STOPS_RETRY_MS, ask: ask({ message: "boom" }), remember })).toBe(false);   // объект с ошибкой — не меню
    expect(asked.length).toBe(2);
    expect(saved).toEqual([]);
    expect(await refreshStops(OCEAN, { now: 1e6 + 2 * STOPS_RETRY_MS, ask: ask("{не json"), remember })).toBe(false);
    expect(await refreshStops(OCEAN, { now: 1e6 + 3 * STOPS_RETRY_MS, ask: ask(menu), remember })).toBe(true);
    expect(saved).toEqual([[OCEAN, 1]]);
  });
  it("функции меню на сервере нет — больше не спрашиваем до перезапуска", async () => {
    expect(await refreshStops(OCEAN, { now: 1e6, ask: ask({ code: "PGRST202", message: "Could not find the function public.menu_get" }), remember })).toBe(false);
    expect(await refreshStops(OCEAN, { force: true, now: 9e6, ask: ask(menu), remember })).toBe(false);
    expect(stopsStale(OCEAN, 9e6)).toBe(false);
    expect(asked.length).toBe(1);
    _resetStops();
    expect(await refreshStops(OCEAN, { now: 9e6, ask: ask(menu), remember })).toBe(true);
  });
  it("без своего «запомнить» — тот же путь, что у экрана «Меню»: копия на телефоне, отметка свежести, число пересчитано", async () => {
    const got = []; menuSubscribe((r, why) => got.push(why));
    expect(stopCount(OCEAN)).toBe(0);
    expect(await refreshStops(OCEAN, { ask: ask([...menu, { id: "s2", name: "Салат" }]) })).toBe(true);
    expect(JSON.parse(store.sa_menu_shared)[OCEAN].length).toBe(2);
    expect(menuTouchedAt(OCEAN)).toBeGreaterThan(0);
    expect(got).toEqual(["fresh"]);
    expect(stopCount(OCEAN)).toBe(1);
    expect(rd("lib/reference-context.js")).toContain("  menuTouched(restaurant);   // v159: копия свежая (lib/menu-fresh.js)");
  });
  it("сверка принесла то же меню — копию на телефоне не переписываем (а отметка свежести ставится); поменялось — пишем", async () => {
    const { rememberSharedMenu } = await import("../lib/reference-context.js");
    let writes = 0; const set = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = (k, v) => { if (k === "sa_menu_shared") writes++; set(k, v); };
    try {
      rememberSharedMenu(OCEAN, menu);
      expect(writes).toBe(1);
      rememberSharedMenu(OCEAN, menu.map((d) => ({ ...d })));
      expect(writes).toBe(1);                                    // то же самое — без записи
      expect(menuTouchedAt(OCEAN)).toBeGreaterThan(0);
      rememberSharedMenu(OCEAN, [{ ...menu[0], stop: null, stopAt: 2 }]);
      expect(writes).toBe(2);                                    // блюдо вернули в меню — записали
      expect(stopCount(OCEAN)).toBe(0);
      rememberSharedMenu("Марико", [{ id: "m1", name: "Роллы" }]);
      expect(writes).toBe(3);
      expect(Object.keys(JSON.parse(store.sa_menu_shared))).toEqual([OCEAN, "Марико"]);   // чужое заведение не задето
    } finally { globalThis.localStorage.setItem = set; }
  });
  it("чат: новая карточка стоп-листа или «Снова в меню» — копия устарела; та же карточка второй раз — нет", () => {
    menuTouched(OCEAN, 1e6);
    const got = []; menuSubscribe((r, why) => got.push(why));
    const stop = (id, st) => ({ id, kind: "card", card: { t: "stop", st, dish: { id: "s1", name: "Суп дня" } } });
    expect(noteStopCards([{ id: 1, kind: "text", body: "привет" }, { id: 2, kind: "card", card: { t: "poll" } }, { card: { t: "stop", st: "on" } }, null])).toBe(false);
    expect(got).toEqual([]);
    expect(noteStopCards([stop(7, "on")])).toBe(true);
    expect(menuTouchedAt(OCEAN)).toBe(0);
    expect(noteStopCards([stop(7, "on")])).toBe(false);          // лента перечитана — карточка та же
    expect(noteStopCards([stop(7, "off")])).toBe(true);          // «Снова в меню»
    expect(noteStopCards([stop(7, "off"), stop(8, "on")])).toBe(true);
    expect(noteStopCards(null)).toBe(false);
    expect(got).toEqual(["dirty", "dirty", "dirty"]);
    const chat = rd("ui/chat.jsx");
    expect(chat).toContain("    const next = mergeMsgs(msgsRef.current, list || []);\n    noteStopCards(list);");
  });
  it("хук главной: сразу по телефону, сверка — когда экран на виду; после запуска не раньше шести секунд, новичку — ничего", () => {
    const sb = rd("ui/stop-badge.jsx");
    expect(sb).toContain("const [n, setN] = React.useState(() => (on && restaurant ? stopCount(restaurant) : 0));");
    expect(sb).toContain("const seen = () => typeof document === \"undefined\" || !document.hidden;");
    expect(sb).toContain("const ask = (force) => { if (alive && seen()) refreshStops(restaurant, { force: !!force }); };");
    expect(sb).toContain('if (why === "dirty") ask(true); else read();');
    expect(sb).toContain("setTimeout(() => ask(false), Math.max(STOPS_MOUNT_MS, STOPS_BOOT_MS - (Date.now() - BOOT_AT)))");
    expect(sb).toContain('document.addEventListener("visibilitychange", vis)');
    expect(sb).toContain('document.removeEventListener("visibilitychange", vis)');
    expect(RS).toContain("const stopN = useStopCount(profile?.restaurant || \"\", !!onMenuTrainer && !!profile && (isBoss || Object.keys(completed || {}).length > 0 || Object.keys(quizDone || {}).length > 0));");
  });
});

describe("v159: жетон на значке «Меню» и строка «Сегодня нет»", () => {
  const stops = () => {
    store.sa_menu_shared = JSON.stringify({ [OCEAN]: [{ id: "s1", name: "Закуска из морепродуктов", stop: { since: 1 } }, { id: "s2", name: "Салат с крабом", stop: { since: 1 } }, { id: "s3", name: "Суп" }, { id: "w", name: "Рислинг", kind: "wine", stop: { since: 1 } }] });
  };
  beforeEach(() => { clear(); _resetStops(); _resetMenuFresh(); });
  it("жетон: рубиновый, цифра 10,5 px (не мельче принятого), у края кружка; нуля нет", () => {
    expect(R(h(StopBadge, { n: 0 }))).toBe("");
    const dk = R(h(StopBadge, { n: 3 }));
    expect(dk).toMatch(/^<span data-stop-badge="3" aria-hidden="true" style="position:absolute;top:-2px;right:-2px;min-width:16px;height:16px;padding:0 3.5px;box-sizing:border-box;border-radius:8px;/);
    expect(dk).toContain("font-size:10.5px;font-weight:700");
    expect(dk).toContain("background:linear-gradient(180deg, #C8553C, #9A3322);border:1.5px solid #1A1409");
    expect(dk).toContain("pointer-events:none");
    expect(R(h(StopBadge, { n: 3, a11y: true }))).toContain("background:linear-gradient(180deg, #B4432F, #8E2C1C);border:1.5px solid #F7F0E0");
    expect(text(R(h(StopBadge, { n: 140 })))).toBe("99+");
  });
  it("на главной: у «Меню» число блюд в стопе (вино не в счёт) и подпись для диктора; золотой точки при нём нет", async () => {
    stops();
    const html = await home({ profile: boss, onMenuTrainer: noop });
    expect(count(html, /data-stop-badge="2"/g)).toBe(1);
    expect(html).toMatch(/title="Меню" aria-label="Меню\. В стопе 2 блюда"/);   // подсказка — название инструмента, как было
    const disc = html.slice(html.lastIndexOf("data-tool-disc", html.indexOf("data-stop-badge")), html.indexOf("data-stop-badge"));
    expect(disc).not.toContain("width:8px;height:8px");
    expect(RS).toContain("{stop > 0 ? <StopBadge n={stop} a11y={a11y} /> : (badge || dot) ? (");
  });
  it("стопа нет — значок как был (подпись «Меню», без жетона); новичку до первого урока значок «Меню» не показан", async () => {
    store.sa_menu_shared = JSON.stringify({ [OCEAN]: [{ id: "s3", name: "Суп" }] });
    const none = await home({ profile: boss, onMenuTrainer: noop });
    expect(none).not.toContain("data-stop-badge");
    expect(none).toContain('title="Меню"');
    expect(none).not.toContain("В стопе");
    stops();
    const newbie = await home({ onMenuTrainer: noop });
    expect(newbie).not.toContain("data-stop-badge");
    expect(newbie).not.toContain('title="Меню');
    const started = await home({ onMenuTrainer: noop, completed: { "cms-l-1": true } });
    expect(count(started, /data-stop-badge="2"/g)).toBe(1);
  });
  it("«Меню»: под шапкой — «Сегодня нет» с блюдами, нажатие открывает колоду на блюде; колода из списка режимов — с начала", () => {
    const mt = rd("ui/menu-trainer.jsx");
    expect(mt).toContain("const st = dishes.filter(d => d && d.stop);");
    expect(mt).toContain('<div data-menu-stops={st.length} style={{ marginTop: 7, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>');
    expect(mt).toContain('<span style={{ color: a11y ? "#A33A2A" : red, fontSize: 12.5 }}>Сегодня нет:</span>');
    expect(mt).toContain('const openAt = (d) => { setDeckStart(String(d.id)); setFocusNew(false); setMode("cards"); vibrate("light"); };');
    expect(mt).toContain("<span key={d.id} data-menu-stop={d.id} onClick={() => openAt(d)} {...onActivate(() => openAt(d))}");
    expect(mt).toContain("const show = st.slice(0, 8), more = st.length - show.length;");
    expect(mt).toContain("{more > 0 ? <span style={{ fontSize: 11.5 }}>и ещё {more}</span> : null}");
    expect(mt).toContain('if (m.key === "cards") setDeckStart(null); setMode(m.key); };');
    expect(mt).toContain("if (mode) { setMode(null); setFocusNew(false); setDeckStart(null); }");   // вышли из колоды — место в ней забыто
  });
  it("колода: лента «сегодня нет» — поверх фото блюда (раньше лежала под ним), в левом углу", () => {
    const deck = rd("ui/menu-deck.jsx");
    expect(deck).toContain('{d.stop && <div data-deck-stop="" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: "inherit", zIndex: 2 }}>');
    expect(deck).toContain('<div style={{ position: "absolute", top: 16, left: -36, transform: "rotate(-35deg)", background: a11y ? "#A33A2A" : "#B8352A", color: "#fff"');
    expect(deck).toContain("СЕГОДНЯ НЕТ</div></div>}");
    expect(deck).toContain('style={{ position: "absolute", right: 10, top: 10, width: 34, height: 34, borderRadius: 18, background: "rgba(0,0,0,0.55)"');   // кнопка «фото на весь экран» — в правом
  });
});

describe("v159: сборка, журнал, памятки", () => {
  it("«сборка v159» и новее; CHANGES — Дополнение 484 со словами владельца; проверки названы в памятке", () => {
    const vers = readdirSync("tests").map((f) => /^v(\d+)\.test\.js$/.exec(f)).filter(Boolean).map((m) => +m[1]);
    const label = +/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1];
    expect(label).toBe(Math.max(...vers));
    expect(label).toBeGreaterThanOrEqual(159);
    const ch = rd("CHANGES.md");
    expect(ch).toMatch(/^# Дополнение 484 — [^\n]*\(v159\)$/m);
    const part = ch.slice(ch.indexOf("# Дополнение 484"));
    expect(part).toContain("Давай все 4");
    for (const w of ["Пульс недели", "Книга отзывов", "стоп", "Идёт", "tests/v159.test.js", "e2e-v159.mjs"]) expect([w, part.includes(w)]).toEqual([w, true]);
    const rm = rd("tools/claude/README.md");
    expect(rm).toContain("e2e-v159.mjs");
    expect(rm).toContain("__demo_pulse");
  });
  it("демо: «тесты на этой неделе» включаются флажком и переживают смену человека", () => {
    const boot = rd("tools/claude/demo-app/boot.js");
    expect(boot).toContain('].map((s, i) => (lsGet("__demo_pulse") === "1" ? { ...s, updated_at: new Date(Date.now() - (i + 1) * 9 * 60e3).toISOString() } : s)),');
    expect(boot).toContain('keep.add("__demo_pulse");');
    expect(boot).toContain("const keep = new Set([K_SRV, K_WHO, K_DAY, K_T, LOOK_KEY]);");   // как держит tests/v101
  });
});
