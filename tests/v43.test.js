// v43 (Доп. 356): ритм дня на главной — табличка с медальонами.
//
// Отзыв владельца на три чипа в строке роли (свеча «1», стакан «0/3», «Путь мастера» «4/14»): «как сделать
// лучше и красивее?», после первых вариантов — «мелко и невзрачно» и «не нравятся сами иконки». Выбран вид
// «Д + Е»: табличка во всю ширину под приветствием, в ней три медальона с подписями — пламя (серия), бокал
// (цель дня), лавровый венок («Путь мастера», лист за значок). Строка роли снова с подписью целиком.
// Пламя и бокал — и в шапке трека, и в строках «Серия» / «Цель дня» в чеках; свеча осталась там, где она —
// своя механика («Свеча на двоих», календари недели и месяца, запас в «Раунде мастера»).
// Вид в браузере (обе темы, 320 / 390 / 430 px, нажатия) — /home/claude/preview/e2e-v43.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { Flame, Wine, Laurel, Medal, Val, laurelLeaves, STREAK_TIERS, nextStreakTier, palette } from "../ui/day-emblems";
import { DayChips } from "../ui/day-cards";
import { masteryChip } from "../ui/mastery-card";
import { masteryState, FAMILIES } from "../lib/mastery";

const noop = () => {};
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const text = (html) => html.replace(/<[^>]+>/g, "");
const count = (html, re) => (html.match(re) || []).length;
const attr = (html, name) => { const m = html.match(new RegExp(name + '="([^"]*)"')); return m ? m[1] : null; };
const NOW = new Date(2026, 9, 15, 12);
const FACTS = {
  mid: { life: { st: 120, l: 30, p: 8, q: 9, s: 46, d: 3, w: 40, r: 1, g: 0, m: 4, f: 2, u: 2, o: 0 }, sectionsDone: 9, sectionsTotal: 12, perfectTests: 2, gold: 0, streakBest: 14, questsDone: 0, hallSkills: 0, roleDone: false, firstDay: "2026-08-01", streakNow: 3, mistakesDue: 0, shiftToday: null },
  newbie: { life: { w: 1, r: 1, st: 2 }, sectionsDone: 0, sectionsTotal: 12, perfectTests: 0, gold: 0, streakBest: 1, questsDone: 0, hallSkills: 0, roleDone: false, firstDay: "2026-10-10", streakNow: 1, mistakesDue: 0, shiftToday: null },
  master: { life: { st: 400, l: 60, p: 20, q: 20, s: 120, d: 12, w: 42, r: 5, g: 3, m: 60, f: 8, u: 16, o: 6 }, sectionsDone: 12, sectionsTotal: 12, roleDone: true, perfectTests: 6, gold: 6, streakBest: 21, questsDone: 0, hallSkills: 0, firstDay: "2026-07-01", streakNow: 5, mistakesDue: 0, shiftToday: null },
};
const stateOf = (fx) => masteryState(FACTS[fx], "core", { now: NOW });
const TODAY = "2026-10-15";
const chips = (o = {}) => R(h(DayChips, { a11y: false, streak: { count: 1, last: "2026-10-14", days: [] }, steps: 0, goal: 3, onGoal: noop, today: TODAY, ...o }));
// одна ячейка таблички: от её открывающего тега до тега следующей ячейки
const cell = (html, kind) => {
  const at = html.indexOf('data-dp-cell="' + kind + '"'); if (at < 0) return "";
  const next = html.indexOf("data-dp-cell=", at + 20);
  return html.slice(html.lastIndexOf("<span", at), next < 0 ? undefined : html.lastIndexOf("<span", next));
};

describe("v43: эмблемы — пламя, бокал, лавровый венок, медальон", () => {
  it("пламя: горит — огонь, свечение и колыхание; не горит — гравюра без свечения", () => {
    const on = R(h(Flame, { lit: true, s: 28 })), off = R(h(Flame, { lit: false, s: 28 }));
    expect(on).toContain('class="de-flame lit"');
    expect(on).toContain('data-lit="1"');
    expect(on).toContain('class="de-glow"');
    expect(on).toContain('class="de-fl"');
    expect(off).toContain('class="de-flame"');
    expect(off).toContain('data-lit="0"');
    expect(off).not.toContain("de-glow");
    expect(off).toMatch(/fill-opacity="\.16" stroke="url\(#/);   // контур металлом и прозрачная заливка
  });
  it("бокал: вино по доле шагов, пустой — без вина, полный — искра; доля в пределах 0…1", () => {
    const liq = (html) => { const m = html.match(/class="de-liq" x="8" y="([\d.]+)" width="16" height="([\d.]+)"/); return m ? [Number(m[1]), Number(m[2])] : null; };
    const empty = R(h(Wine, { pct: 0 })), third = R(h(Wine, { pct: 1 / 3 })), full = R(h(Wine, { pct: 1 }));
    expect(attr(empty, "data-pct")).toBe("0");
    expect(liq(empty)[1]).toBe(0);
    expect(attr(third, "data-pct")).toBe("33");
    expect(liq(third)[0]).toBeCloseTo(13.87, 1);
    expect(liq(full)[0]).toBe(7.2);                       // не до края: полный бокал налит до 7.2 из 32
    expect(full).toContain("data-emb-spark");
    expect(third).not.toContain("data-emb-spark");
    expect(attr(R(h(Wine, { pct: 5 })), "data-pct")).toBe("100");
    expect(attr(R(h(Wine, { pct: -1 })), "data-pct")).toBe("0");
    expect(attr(R(h(Wine, { pct: NaN })), "data-pct")).toBe("0");
    // у ножки нулевая ширина: градиент «по рамке» её бы стёр — градиент металла в координатах рисунка
    expect(full).toMatch(/<linearGradient id="[^"]+" gradientUnits="userSpaceOnUse" x1="9" y1="2" x2="23" y2="30">/);
    expect(full).toMatch(/<path d="M16 17\.2V26\.6" stroke="url\(#/);
  });
  it("венок: столько листьев, сколько значков в пути; золотые — заработанные", () => {
    const w = R(h(Laurel, { have: 4, total: 14 }));
    expect(count(w, /data-leaf="/g)).toBe(14);
    expect(count(w, /data-leaf="on"/g)).toBe(4);
    expect(attr(w, "data-have")).toBe("4");
    const nb = R(h(Laurel, { have: 2, total: 7 }));
    expect(count(nb, /data-leaf="/g)).toBe(7);
    expect(count(nb, /data-leaf="on"/g)).toBe(2);
    expect(count(R(h(Laurel, { have: 99, total: 14 })), /data-leaf="on"/g)).toBe(14);
    expect(count(R(h(Laurel, { have: -3, total: 14 })), /data-leaf="on"/g)).toBe(0);
  });
  it("листья венка: слева и справа по очереди, зеркально, снизу вверх, в пределах рисунка", () => {
    for (const total of [7, 14]) {
      const L = laurelLeaves(total);
      expect(L.length).toBe(total);
      L.forEach((l, i) => expect(l.left).toBe(i % 2 === 0));
      for (let i = 0; i + 1 < L.length; i += 2) {
        expect(L[i].cx + L[i + 1].cx).toBeCloseTo(32, 1);   // зеркально относительно середины
        expect(L[i].cy).toBeCloseTo(L[i + 1].cy, 2);
        expect(L[i].cx).toBeLessThan(16);
        if (i >= 2) expect(L[i].cy).toBeLessThan(L[i - 2].cy);   // каждая пара выше предыдущей
      }
      for (const l of L) { expect(l.cx).toBeGreaterThan(3.4); expect(l.cx).toBeLessThan(28.6); expect(l.cy).toBeGreaterThan(3.4); expect(l.cy).toBeLessThan(28.6); }
    }
  });
  it("медальон: дуга по доле, свечение — по просьбе; размер — числом или CSS-переменной", () => {
    const m0 = R(h(Medal, { pct: 0 }, "x")), m = R(h(Medal, { pct: 0.5, glow: true }, "x"));
    expect(attr(m0, "data-medal")).toBe("0");
    expect(m0).not.toContain("de-arc");
    expect(attr(m, "data-medal")).toBe("50");
    expect(m).toContain("de-arc");
    expect(m).toContain("data-medal-glow");
    expect(R(h(Medal, { s: "var(--dp-m,35px)" }, "x"))).toContain("width:var(--dp-m,35px);height:var(--dp-m,35px)");
    const num = R(h(Flame, { s: 19 })), css = R(h(Flame, { s: "var(--dp-i,21px)" }));
    expect(num).toMatch(/width="19" height="19"/);
    expect(css).not.toMatch(/ width="/);
    expect(css).toContain("width:var(--dp-i,21px)");
  });
  it("у каждой эмблемы свои id градиентов: две на экране не делят заливку", () => {
    const html = R(h("div", null, h(Flame, { lit: true }), h(Flame, { lit: true }), h(Wine, { pct: 1 }), h(Wine, { pct: 1 })));
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(8);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("вехи серии — как у значка «Свеча» в «Пути мастера»; ободок пламени — до следующей", () => {
    expect(STREAK_TIERS).toEqual(FAMILIES.find((f) => f.id === "streak").tiers);
    expect([0, 1, 2, 3, 6, 7, 29, 30, 100].map(nextStreakTier)).toEqual([3, 3, 3, 7, 7, 30, 30, 30, 30]);
  });
  it("число: крупная цифра акцентным шрифтом и мелкое «/3»", () => {
    const v = R(h(Val, { main: 4, of: 14 }));
    expect(text(v)).toBe("4/14");
    expect(v).toContain("font-family:'Piazzolla', Georgia, serif");
    expect(v).toContain("font-size:20px;color:" + palette(false).gold);
    expect(v).toContain("font-size:13px");
  });
});

describe("v43: табличка на главной (DayChips)", () => {
  it("три медальона: пламя, бокал и венок; нажимаются бокал и венок, подписи и метки — как раньше", () => {
    const m = masteryChip(stateOf("mid"), 2, false);
    const html = chips({ mastery: m, onMastery: noop });
    expect(html).toContain("data-day-panel");
    expect(count(html, /data-dp-cell="/g)).toBe(3);
    expect(count(html, /class="sa-dp-sep"/g)).toBe(2);
    expect(cell(html, "streak")).toContain('role="img"');
    expect(cell(html, "streak")).toContain('aria-label="Серия 1 день"');
    expect(cell(html, "streak")).toContain('data-emb="flame"');
    expect(cell(html, "goal")).toContain('role="button"');
    expect(cell(html, "goal")).toContain('aria-label="Цель дня: 0 из 3. Изменить цель"');
    expect(cell(html, "goal")).toContain('data-emb="wine"');
    expect(cell(html, "mastery")).toContain('role="button"');
    expect(cell(html, "mastery")).toContain("data-ms-chip");
    expect(cell(html, "mastery")).toContain('aria-label="' + m.aria + '"');
    expect(cell(html, "mastery")).toContain('data-emb="laurel"');
    expect(cell(html, "mastery")).toContain("data-ms-chip-new");
    expect(text(cell(html, "mastery"))).toContain(m.have + "/" + m.total + "значков");
    // без «Пути мастера» (нет роли) — два медальона
    const base = chips();
    expect(count(base, /data-dp-cell="/g)).toBe(2);
    expect(count(base, /class="sa-dp-sep"/g)).toBe(1);
    expect(base).not.toContain("data-ms-chip");
  });
  it("подписи: дни по-русски (и «подряд» на широком экране), «цель дня» (на узком — «цель»); выполнена — зелёным и искра", () => {
    const cap = (o) => text(cell(chips(o), "streak"));
    expect(cap({ streak: { count: 1, last: "" } })).toBe("1день подряд");
    expect(cap({ streak: { count: 3, last: "" } })).toBe("3дня подряд");
    expect(cap({ streak: { count: 5, last: "" } })).toBe("5дней подряд");
    expect(cap({ streak: { count: 21, last: "" } })).toBe("21день подряд");
    expect(cap({ streak: null })).toBe("0дней подряд");
    expect(chips()).toContain('<span class="sa-dp-w"> подряд</span>');
    expect(text(cell(chips({ steps: 1 }), "goal"))).toBe("1/3цель дня");
    expect(cell(chips({ steps: 1 }), "goal")).toContain('цель<span class="sa-dp-x"> дня</span>');
    const done = chips({ steps: 5 });
    expect(text(cell(done, "goal"))).toBe("3/3цель дня");
    expect(cell(done, "goal")).toContain("color:" + palette(false).green);
    expect(cell(done, "goal")).toContain("data-emb-spark");
    expect(cell(chips({ steps: 3, a11y: true }), "goal")).toContain("color:" + palette(true).green);
  });
  it("пламя горит, когда сегодня занимался: огонь и свечение медальона; ободок — до следующей вехи", () => {
    const lit = chips({ streak: { count: 5, last: TODAY } });
    expect(cell(lit, "streak")).toContain('data-lit="1"');
    expect(cell(lit, "streak")).toContain("data-medal-glow");
    expect(cell(lit, "streak")).toContain('aria-label="Серия 5 дней, сегодня свеча горит"');
    expect(attr(cell(lit, "streak"), "data-medal")).toBe("71");     // 5 из 7
    const off = chips({ streak: { count: 1, last: "2026-10-14" } });
    expect(cell(off, "streak")).toContain('data-lit="0"');
    expect(cell(off, "streak")).not.toContain("data-medal-glow");
    expect(attr(cell(off, "streak"), "data-medal")).toBe("33");     // 1 из 3
    expect(attr(cell(chips({ streak: { count: 10, last: "" } }), "streak"), "data-medal")).toBe("33");   // 10 из 30
    expect(attr(cell(chips({ streak: { count: 40, last: "" } }), "streak"), "data-medal")).toBe("100");
  });
  it("бокал и его ободок — доля цели дня; шагов больше цели — полный", () => {
    const g = cell(chips({ steps: 1, goal: 3 }), "goal");
    expect(attr(g, "data-medal")).toBe("33");
    expect(attr(g, "data-pct")).toBe("33");
    const over = cell(chips({ steps: 7, goal: 2 }), "goal");
    expect(attr(over, "data-medal")).toBe("100");
    expect(attr(over, "data-pct")).toBe("100");
  });
  it("«Путь мастера»: значки — «N/14 значков», новичок — «2/7» и 7 листьев, мастер — «мастер ✦»", () => {
    const mid = masteryChip(stateOf("mid"), 0, false);
    expect(mid).toMatchObject({ mode: "path", total: 14 });
    expect(mid.have).toBe(stateOf("mid").bronze);
    expect(mid.pct).toBeCloseTo(mid.have / 14, 5);
    const nbS = stateOf("newbie"), nb = masteryChip(nbS, 0, false);
    expect(nb).toMatchObject({ mode: "first", have: nbS.firstWeek.done, total: 7 });
    const nbHtml = cell(chips({ mastery: nb, onMastery: noop }), "mastery");
    expect(count(nbHtml, /data-leaf="/g)).toBe(7);
    expect(nbHtml).toContain('<span class="sa-dp-w">первые шаги</span><span class="sa-dp-n">старт</span>');
    const ms = masteryChip(stateOf("master"), 0, true);
    expect(ms).toMatchObject({ mode: "master", pct: 1 });
    const msHtml = cell(chips({ mastery: ms, onMastery: noop, a11y: true }), "mastery");
    expect(text(msHtml)).toContain("мастер");   // v73: без ✦
    expect(msHtml).toContain('>мастер</span>'); expect(msHtml).not.toContain("✦");
    expect(attr(msHtml, "data-medal")).toBe("100");
    expect(msHtml).not.toContain("data-ms-chip-new");
  });
  it("старый вызов без чисел (только «9/14») — числа берутся из текста", () => {
    const legacy = { icon: null, text: "9/14", aria: "Путь мастера: 9 из 14 значков", dot: false };
    const html = cell(chips({ mastery: legacy, onMastery: noop }), "mastery");
    expect(count(html, /data-leaf="on"/g)).toBe(9);
    expect(attr(html, "data-medal")).toBe("64");
    expect(text(html)).toContain("9/14значков");
  });
  it("светлая тема — своя палитра и класс lt; размеры — CSS-переменными, на узком экране меньше", () => {
    const lt = chips({ a11y: true });
    expect(lt).toContain('class="tbv sa-dp lt"');
    expect(lt).toContain(palette(true).panel);
    expect(lt).toContain("width:var(--dp-m,32px)");   // v44: плотнее
    const src = readFileSync("ui/day-cards.jsx", "utf8");
    expect(src).toMatch(/\.sa-dp\{display:flex;align-items:stretch;border-radius:16px;--dp-m:32px;--dp-i:19px;--dp-l:25px\}/);   // v44: плотнее
    expect(src).toMatch(/@media \(max-width:374px\)\{\.sa-dp\{--dp-m:28px;--dp-i:17px;--dp-l:22px\}\.sa-dp-cell\{gap:5px;padding:7px 3px\}\.sa-dp-x\{display:none\}\}/);
    expect(src).toMatch(/@media \(min-width:430px\)\{\.sa-dp:not\(\.lt\) \.sa-dp-w\{display:inline\}\.sa-dp:not\(\.lt\) \.sa-dp-n\{display:none\}\}/);
    expect(src).toMatch(/\.sa-dp\.lt \.sa-dp-cap\{font-size:13\.5px\}/);   // v73: курсивом, без разрядки
  });
  it("окно «Цель дня» — с бокалом: «Бокал наполняется с каждым шагом»", () => {
    const src = readFileSync("ui/day-cards.jsx", "utf8");
    expect(src).toContain("<Wine s={30} pct={0.6} a11y={a11y} />");
    expect(src).toContain("Бокал наполняется с каждым шагом. Он виден на главной, в шапке трека и в чеках.");   // v74
    expect(src).not.toContain("Стакан наполняется");
  });
});

describe("v43: место таблички — под приветствием, строка роли — с подписью", () => {
  const T4 = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false,
    roleHeader: {}, roleSubtitle: {}, roleList: {}, roleCard: {}, roleAccent: {}, roleIcon: {}, roleInfo: {}, roleLabel: {}, roleSublabel: {}, roleDesc: {} };
  const mod = { id: "cms-m-1", title: "Свой раздел", lessons: [{ id: "cms-l-1", type: "lesson", title: "Урок: встреча гостя", content: "Текст" }] };
  const profile = { name: "Роман", surname: "Смирнов", restaurant: "Два моря, Океан", position: "waiter" };
  const strip = h("div", { "data-test-strip": "" }, "ТАБЛИЧКА");
  const render = async (extra) => {
    const { RoleSelect } = await import("../ui/screens-roleselect");
    return R(h(RoleSelect, { T: T4, a11y: false, profile, role: "seasonal", onSelect: noop, onContinueLesson: noop, customByRole: { seasonal: [mod] }, dayStrip: strip, ...extra }));
  };
  it("с треком: табличка — сразу после приветствия (v44: роль — строкой в нём), до карточки трека", async () => {
    const html = await render({});
    const at = html.indexOf('<div data-day-chips="" style="padding:0 14px 8px"><div data-test-strip="">ТАБЛИЧКА</div></div>');
    expect(at).toBeGreaterThan(0);
    expect(html.indexOf("Два моря, Океан")).toBeLessThan(at);
    expect(html.indexOf("data-role-line")).toBeLessThan(at);
    expect(at).toBeLessThan(html.indexOf("Встреча гостя"));
    expect(count(html, /data-test-strip/g)).toBe(1);
    // строка роли под именем: роль и подпись целиком (v41/v44), значков рядом нет
    expect(html).toMatch(/<span data-role-sub="" style="color:#aaa;font-size:11px;white-space:nowrap">Сезонный сотрудник<\/span><\/span><\/div>/);
  });
  it("без трека — там же, под приветствием (не под названием заведения); без профиля — нет", async () => {
    const html = await render({ role: null });
    expect(html).toContain('<div data-day-chips="" style="padding:0 14px 8px"><div data-test-strip="">ТАБЛИЧКА</div></div>');
    expect(html).not.toMatch(/flex-direction:column;align-items:flex-end;gap:7px/);
    expect(html).not.toContain("data-role-line");
    expect(await render({ profile: null, role: null })).not.toContain("data-test-strip");
  });
});

describe("v43: пламя и бокал — в шапке трека и в чеках; свеча — в своих механиках", () => {
  const SITS = [
    { genre: "action", scene: "Гость спрашивает, найдётся ли детский стул.", question: "Что ответишь?", options: ["«Конечно, сейчас принесу»", "«Нет, у нас такого нет»"], correct: 0, win: "🎯 Решение сразу", fail: "💡 Предложи решение" },
    { genre: "action", scene: "Гость просит счёт.", question: "Что делаешь?", options: ["Приношу счёт сразу", "Жду, пока гость доест десерт"], correct: 0, win: "🎯 Сразу", fail: "💡 Счёт — сразу" },
  ];
  const MOD = { id: "fu", title: "Детский стул", color: "#7C9E87", lessons: [{ id: "fu-p", type: "practice", title: "Практика: Детский стул", situations: SITS }] };
  it("шапка трека: пламя серии и бокал цели вместо свечи и стакана", async () => {
    const { HomeScreen } = await import("../ui/screens-learning");
    const T = { screen: {}, modTitle: {}, modSub: {}, homeRoleBadge: {}, changeRoleBtn: {}, modList: {}, modIcon: {}, modInfo: {}, modTag: {}, modRight: {}, homeHead: {}, homeTopRow: {}, logoRow: {}, logoText: {} };
    const roleObj = { id: "seasonal", label: "Новичок", sublabel: "Сезонный сотрудник", color: "#7C9E87" };
    const html = R(h(HomeScreen, { role: roleObj, modules: [MOD], customModules: [], completed: {}, quizDone: {}, progress: 0, doneCount: 0, totalLessons: 1, onModule: noop, onChangeRole: noop, T,
      streak: { count: 3, last: "", days: [] }, a11y: false, profile: { name: "Анна" }, mistakeBank: [], onMistakes: noop, onSearch: noop, dayGoal: { steps: 1, goal: 2 }, onLesson: noop, nextFor: () => null, onNext: noop }));
    expect(html).toContain('data-emb="flame"');
    expect(html).toContain('data-emb="wine" data-pct="50"');
    expect(html).not.toContain('class="candle');
    expect(html).not.toContain('class="glass"');
    expect(readFileSync("ui/screens-learning.jsx", "utf8")).not.toMatch(/<Candle|<Glass/);
  });
  it("чек практики: строки «Серия» и «Цель дня» — пламя и бокал в светлой (бумажной) палитре", async () => {
    const { TableCheck } = await import("../ui/table");
    const html = R(h(TableCheck, { inline: true, mode: "warmup", situations: SITS, modules: [MOD], shift: "", color: MOD.color, profile: { name: "Анна", restaurant: "Океан" },
      streak: { count: 2, last: "", days: [] }, mistakeBank: [], goal: { steps: 1, goal: 2 }, onFinish: noop, onClose: noop, onMistakes: noop }));
    // до конца разминки чека нет — строки проверяем в исходнике и в чеке недели
    const src = readFileSync("ui/table.jsx", "utf8");
    expect(count(src, /<Line icon=\{<Flame s=\{19\} lit=\{[^}]+\} a11y \/>\} label="Серия"/g)).toBe(3);
    expect(src).toContain('<Line icon={<Wine pct={Math.min(1, st / goal.goal)} s={19} a11y />} label="Цель дня"');
    expect(src).not.toMatch(/<Glass /);
    expect(html.length).toBeGreaterThan(100);
  });
  it("чек недели: календарь — свечи, как было; строки «Серия» и «Цель дня» — пламя и бокал", async () => {
    const { WeekReceipt } = await import("../ui/table");
    const sum = { from: "2026-10-06", to: "2026-10-12", activeDays: 4, totals: { st: 3, l: 1, p: 1, q: 0, d: 0, b: 0, w: 1, s: 4, f: 0 },
      days: ["06", "07", "08", "09", "10", "11", "12"].map((d, i) => ({ key: "2026-10-" + d, dow: (i + 1) % 7, steps: i % 2, active: i % 2 === 0, frozen: i === 3 })) };
    const wk = R(h(WeekReceipt, { inline: true, a11y: false, profile: { name: "Анна", restaurant: "Океан" }, streak: { count: 3, last: "2026-10-12" }, summary: sum, goal: 2, onClose: noop }));
    const week = wk.slice(wk.indexOf('class="r-week"'), wk.indexOf("</div>", wk.indexOf('class="r-week"')));
    expect(count(week, /class="candle lit"/g)).toBe(4);
    expect(wk).toMatch(/data-emb="flame"[^>]*>.*?<\/svg>Серия</);
    expect(wk).toMatch(/data-emb="wine"[^>]*>.*?<\/svg>Цель дня \(2 шага\)</);
    expect(wk).toContain('stop-color="' + palette(true).goldHi + '"');   // бумага — светлая палитра в обеих темах
  });
  it("свеча осталась: «Свеча на двоих», итоги месяца, запас в «Раунде мастера»; строка напарника — с v70 пламя", () => {
    expect(readFileSync("ui/together.jsx", "utf8")).toMatch(/<Candle s=\{64\}/);
    expect(readFileSync("ui/month-recap.jsx", "utf8")).toMatch(/<Candle s=\{88\} lit \/>/);
    expect(readFileSync("ui/table.jsx", "utf8")).toMatch(/<Candle s=\{14\} lit=\{!stat\.wrong\.length\} \/>/);
    // v70 (Доп. 383), владелец: «свечка некрасивая, в обеих темах одинаковая палитра» → «давай пламя»: свеча в строке
    // напарника стояла вне «стола» (.tbv) и не получала цветов темы
    expect(readFileSync("App.jsx", "utf8")).not.toMatch(/<Candle s=\{16\} lit \/>/);
    expect(readFileSync("App.jsx", "utf8")).toContain("<Flame lit s={18} a11y={a11y} />");
  });
});

describe("v43: гид, метка сборки и CHANGES", () => {
  it("гид: «Серия, цель дня и значки» — про табличку, пламя, бокал и венок", async () => {
    const { GUIDE } = await import("../ui/guide");
    const all = GUIDE.flatMap((s) => s.items);
    const it2 = all.find((x) => x.key === "rhythm");
    expect(it2.title).toBe("Серия, цель дня и значки");
    for (const w of ["Табличка под приветствием", "Пламя свечи", "3, 7 и 30 дней", "Бокал — цель дня", "1, 2 или 3 шага", "Венок — «Путь мастера»: лист за каждый значок", "«Чек недели»"]) expect(it2.text).toContain(w);
    expect(/["“”„]/.test(it2.text)).toBe(false);
    expect(/ - |\s–\s/.test(it2.text)).toBe(false);
    expect(all.find((x) => x.key === "daymode").text).toContain("пламя серии горит, бокал цели наполняется");
    expect(all.map((x) => x.title + " " + x.text).join("\n")).not.toMatch(/стакан/i);
  });
  it("«сборка v43», «Дополнение 356»", () => {
    expect(readFileSync("ui/menu-trainer.jsx", "utf8")).toMatch(/· сборка v\d{2}</);   // v44: номер сборки растёт
    expect(readFileSync("CHANGES.md", "utf8")).toMatch(/# Дополнение 356 — /);
  });
});
