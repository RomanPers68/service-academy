// v82 (Доп. 395): брифинг смены из приложения. Руководитель в «Смене» → «Брифинг смены»: приложение само собирает
// пятиминутку (кто сегодня в графике, стоп-лист и новинки меню, фокус по ошибкам команды, вопрос команде, «спасибо»
// лидерам недели, своё), «Провести» — по одному блоку крупно с секундомером, «Отправить команде» — этап 32
// (brief_publish): брифинг дня у всех в «Смене» и текст в Telegram. Вид — tools/claude/e2e-v82.mjs,
// сервер — tools/claude/sql/test32.sh.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { BRIEF_ORDER, BRIEF_TITLE, BRIEF_POS, briefStop, briefFresh, findQuestion, briefFocus, briefAsk, briefRoster, briefHours, briefThanks,
  buildBrief, briefShown, briefText, rosterLine, briefDayLabel, voiceLabel } from "../lib/briefing.js";
import { DEFAULT_SHIFTS } from "../lib/schedule-sync.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

const NOW = new Date(2026, 9, 25, 10, 0);   // 25 октября, 10:00 по часам телефона
const DAY = 864e5;
const Q = (q, options, correct, explanation = "") => ({ q, options, correct, explanation });
const PROGRAMS = {
  seasonal: [{ id: "s1", title: "Первые шаги", lessons: [
    { id: "s1-1", type: "lesson", title: "Встреча гостя", content: "…" },
    { id: "s1-q", type: "quiz", title: "Тест: встреча гостя", questions: [
      Q("Через сколько секунд подойти к новому гостю?", ["Через 10 секунд", "Через минуту", "Когда позовёт"], 0, "Первые 10 секунд решают, рады ли гостю."),
      Q("Что сказать, если блюдо задерживается?", ["Ничего", "Предупредить и предложить напиток", "Сослаться на кухню"], 1, "Предупредить заранее значит позаботиться."),
      Q("Картинка: какой бокал для игристого?", ["Флюте", "Рокс"], 0, ""),
    ] },
  ] }],
  core: [{ id: "c1", title: "Стандарты", lessons: [
    { id: "c1-q", type: "quiz", title: "Тест: стандарты", questions: [
      Q("С какой стороны подают блюдо?", ["Справа", "Слева", "Как удобно"], 0, "Подаём справа правой рукой."),
      Q("Сколько вариантов здесь?", ["1", "2", "3", "4", "5"], 2, "Пять вариантов: в Telegram и на брифинг не идёт."),
    ] },
  ] }],
  bar: [{ id: "b1", title: "Бар", lessons: [
    { id: "b1-q", type: "quiz", title: "Тест: бар", questions: [Q("Сколько мл в классическом негрони каждого ингредиента?", ["30 мл", "50 мл"], 0, "По 30 мл.")] },
  ] }],
};
PROGRAMS.seasonal[0].lessons[1].questions[2].img = "/img/glass.webp";
const HARD = [
  { question: "что сказать,  если блюдо задерживается?", lesson_id: "s1-q", total: 10, fails: 6, fail_pct: 60 },
  { question: "Несуществующий вопрос", lesson_id: "x", total: 5, fails: 4, fail_pct: 80 },
  { question: "Сколько мл в классическом негрони каждого ингредиента?", lesson_id: "b1-q", total: 8, fails: 4, fail_pct: 50 },
  { question: "С какой стороны подают блюдо?", lesson_id: "c1-q", total: 6, fails: 2, fail_pct: 33 },
];
const MENU = [
  { id: "d1", name: "Борщ", cat: "Супы", stop: { since: NOW.getTime() - DAY } },
  { id: "d2", name: "Тартар из говядины", cat: "Закуски", isNew: true, addedAt: NOW.getTime() - 2 * DAY, voice: { chef: { url: "https://x/v.m4a", by: "Шеф Алексей" } } },
  { id: "d3", name: "Старая новинка", isNew: true, addedAt: NOW.getTime() - 40 * DAY },
  { id: "ck1", kind: "cocktail", name: "Негрони", stop: { since: 1 } },
  { id: "d4", name: "Из архива", archived: true, stop: { since: 1 } },
  { id: "__barcard__", name: "Карта бара", cocktails: ["negroni"], stop: { since: 1 } },
  { id: "d5", name: "Новинка в стопе", isNew: true, addedAt: NOW.getTime() - DAY, stop: { since: 1 } },
  { id: "d6", name: "Паста", isNew: true, addedAt: NOW.getTime() - 5 * DAY },
];
const SCHED = { ok: true, venues: [{ venue_key: "main", config: {
  staff: [{ id: 1, name: "Анна", pos: "waiter" }, { id: 2, name: "Борис", pos: "bar" }, { id: 3, name: "Вера", pos: "waiter" }, { id: 4, name: "Глеб", pos: "manager" }, { id: 5, name: "Дина", pos: "host" }, { id: 6, name: "Ева" }],
  shifts: [{ k: "Д", name: "День", from: 12, to: 20 }, { k: "В", name: "Вечер", from: 16, to: 26 }, { k: "Н", name: "Ночь", from: 20, to: 8 }] } }],
  months: [{ venue_key: "main", payload: { plan: { 1: { 25: "В", 24: "Д" }, 2: { 25: "В" }, 3: { 25: "Д" }, 4: { 25: "Д" }, 5: { 25: "Х" }, 6: { 25: "Д" } } } }] };
const LEAGUE = { ok: true, rows: [
  { name: "Анна", surname: "Кравец", restaurant: "Два моря, Океан", pts: 40 }, { name: "Борис", surname: "", restaurant: "Другое", pts: 90 },
  { name: "Вера", surname: "Л", restaurant: "Два моря, Океан", pts: 0 }, { name: "Глеб", surname: "Гусев", restaurant: "Два моря, Океан", pts: 55 },
  { name: "Дина", surname: "", restaurant: "Два моря, Океан", pts: 12 }, { name: "Ева", surname: "", restaurant: "Два моря, Океан", pts: 5 },
] };
const REST = "Два моря, Океан";

describe("v82: блоки брифинга", () => {
  it("стоп-лист: блюда и коктейли «сегодня нет»; без архива и карты бара", () => {
    expect(briefStop(MENU)).toEqual(["Борщ", "Негрони", "Новинка в стопе"]);
    expect(briefStop([])).toEqual([]);
    expect(briefStop(Array.from({ length: 20 }, (_, i) => ({ id: "x" + i, name: "Блюдо " + i, stop: { since: 1 } })))).toHaveLength(12);
  });
  it("новинки: за 30 дней, не в стопе, свежие первыми; голос — если шеф или сомелье записали", () => {
    expect(briefFresh(MENU, NOW)).toEqual([
      { id: "d2", name: "Тартар из говядины", cat: "Закуски", voice: "chef" },
      { id: "d6", name: "Паста", cat: "", voice: false },
    ]);
    const both = briefFresh([{ ...MENU[1], voice: { chef: { url: "a" }, som: { url: "b" } } }, { ...MENU[7], voice: { som: { url: "c" }, chef: { url: "" } } }], NOW);
    expect(both.map((d) => d.voice)).toEqual(["both", "som"]);
    expect([voiceLabel("chef"), voiceLabel("som"), voiceLabel("both"), voiceLabel(true), voiceLabel(false)]).toEqual(["голос шефа", "голос сомелье", "голос шефа и сомелье", "голос шефа", ""]);
  });
  it("вопрос программы по тексту: без разницы регистра, «ё» и лишних пробелов; во всех ролях", () => {
    const q = findQuestion(PROGRAMS, "ЧТО сказать, если   блюдо задерживается?");
    expect(q).toMatchObject({ q: "Что сказать, если блюдо задерживается?", correct: 1, topic: "Тест: встреча гостя", roleId: "seasonal" });
    expect(findQuestion(PROGRAMS, "Сколько мл в классическом негрони каждого ингредиента?").roleId).toBe("bar");
    expect(findQuestion(PROGRAMS, "нет такого")).toBeNull();
    expect(findQuestion(PROGRAMS, "")).toBeNull();
  });
  it("фокус смены: два самых трудных вопроса, которые есть в программе, с верным ответом, разбором и долей ошибок", () => {
    const f = briefFocus(HARD, PROGRAMS);
    expect(f).toEqual([
      { q: "Что сказать, если блюдо задерживается?", right: "Предупредить и предложить напиток", why: "Предупредить заранее значит позаботиться.", topic: "Тест: встреча гостя", pct: 60, n: 10 },
      { q: "Сколько мл в классическом негрони каждого ингредиента?", right: "30 мл", why: "По 30 мл.", topic: "Тест: бар", pct: 50, n: 8 },
    ]);
    expect(briefFocus([], PROGRAMS)).toEqual([]);
  });
  it("вопрос команде: следующий трудный (не из фокуса); нет трудных — вопрос программы, один и тот же весь день", () => {
    const f = briefFocus(HARD, PROGRAMS);
    expect(briefAsk(HARD, PROGRAMS, f, "2026-10-25", REST)).toMatchObject({ q: "С какой стороны подают блюдо?", correct: 0, from: "hard" });
    const a1 = briefAsk([], PROGRAMS, [], "2026-10-25", REST), a2 = briefAsk([], PROGRAMS, [], "2026-10-25", REST);
    expect(a1).toEqual(a2);
    expect(a1.from).toBe("program");
    // из программы новичка и основ: без картинки и не больше четырёх вариантов, не бар
    expect(["Через сколько секунд подойти к новому гостю?", "Что сказать, если блюдо задерживается?", "С какой стороны подают блюдо?"]).toContain(a1.q);
    const days = new Set(Array.from({ length: 12 }, (_, i) => briefAsk([], PROGRAMS, [], "2026-10-" + String(10 + i), REST).q));
    expect(days.size).toBeGreaterThan(1);   // день ото дня вопрос меняется
    expect(briefAsk([], {}, [], "2026-10-25", REST)).toBeNull();
  });
  it("кто сегодня: смены по началу, внутри — позиции в порядке графика; не смена (Х) и пустые — мимо", () => {
    const r = briefRoster(SCHED, NOW);
    expect(r).toEqual([
      { k: "Д", name: "День", from: 12, to: 20, people: ["Глеб", "Вера", "Ева"], groups: [{ t: "Менеджер", names: ["Глеб"] }, { t: "Официант", names: ["Вера"] }, { t: "", names: ["Ева"] }] },
      { k: "В", name: "Вечер", from: 16, to: 26, people: ["Борис", "Анна"], groups: [{ t: "Бар", names: ["Борис"] }, { t: "Официант", names: ["Анна"] }] },
    ]);
    expect(rosterLine(r[0])).toBe("Менеджер: Глеб · Официант: Вера · Ева");
    expect(briefRoster({ ok: false }, NOW)).toBeNull();
    expect(briefRoster(null, NOW)).toBeNull();
    expect(briefRoster(SCHED, new Date(2026, 9, 26))).toBeNull();   // на 26-е никого
    // смен в настройках нет — как в графике (DEFAULT_SHIFTS)
    const noShifts = { ...SCHED, venues: [{ venue_key: "main", config: { staff: SCHED.venues[0].config.staff } }], months: [{ venue_key: "main", payload: { plan: { 1: { 25: "У" }, 2: { 25: "В" } } } }] };
    expect(briefRoster(noShifts, NOW).map((s) => [s.name, s.from])).toEqual([["Утро", 10], ["Вечер", 16]]);
  });
  it("часы смены — как в графике: после полуночи и ночная", () => {
    expect(briefHours({ from: 16, to: 24 })).toBe("16:00–24:00");
    expect(briefHours({ from: 12, to: 26 })).toBe("12:00–2:00");
    expect(briefHours({ from: 20, to: 8 })).toBe("20:00–8:00");
  });
  it("позиции — те же, что в графике (ui/schedule.jsx), в том же порядке", () => {
    const src = rd("ui/schedule.jsx");
    const block = src.slice(src.indexOf("const POS = ["), src.indexOf("];", src.indexOf("const POS = [")));
    const pos = [...block.matchAll(/\{ id: "([a-z]+)", t: "([^"]+)" \}/g)].map((m) => [m[1], m[2]]);
    expect(pos.length).toBe(7);
    expect(BRIEF_POS).toEqual(pos);
    expect(DEFAULT_SHIFTS.map((s) => s.k)).toEqual(["У", "Д", "В", "К"]);
  });
  it("спасибо: трое лидеров недели своего заведения, у кого есть очки", () => {
    expect(briefThanks(LEAGUE, REST)).toEqual([
      { name: "Глеб", surname: "Гусев", pts: 55 }, { name: "Анна", surname: "Кравец", pts: 40 }, { name: "Дина", surname: "", pts: 12 },
    ]);
    expect(briefThanks({ ok: false }, REST)).toEqual([]);
    expect(briefThanks(LEAGUE, "Нет такого")).toEqual([]);
  });
});

describe("v82: брифинг целиком и текст для Telegram", () => {
  const b = buildBrief({ menu: MENU, hard: HARD, programs: PROGRAMS, sched: SCHED, league: LEAGUE, restaurant: REST, author: "Глеб Гусев", note: "  Банкет на 12 в 19:00  ", now: NOW });
  it("порядок, заголовки; блок с данными включён, пустой — выключен", () => {
    expect(BRIEF_ORDER).toEqual(["roster", "stop", "fresh", "focus", "ask", "thanks", "note"]);
    expect(BRIEF_ORDER.map((k) => BRIEF_TITLE[k])).toEqual(["Кто сегодня", "Стоп-лист", "Новинки меню", "Фокус смены", "Вопрос команде", "Спасибо", "Своё"]);
    expect(b).toMatchObject({ v: 1, day: "2026-10-25", dayLabel: "25 октября", restaurant: REST, author: "Глеб Гусев" });
    expect(b.on).toEqual({ roster: true, stop: true, fresh: true, focus: true, ask: true, thanks: true, note: true });
    expect(b.blocks.note).toBe("Банкет на 12 в 19:00");
    const empty = buildBrief({ now: NOW });
    expect(empty.on).toEqual({ roster: false, stop: false, fresh: false, focus: false, ask: false, thanks: false, note: false });
    expect(BRIEF_ORDER.filter((k) => briefShown(empty, k))).toEqual([]);
    expect(briefDayLabel(new Date(2026, 0, 1))).toBe("1 января");
  });
  it("выключатель прячет блок; «Своё» из пробелов не показывается", () => {
    expect(briefShown({ ...b, on: { ...b.on, stop: false } }, "stop")).toBe(false);
    expect(briefShown({ ...b, blocks: { ...b.blocks, note: "   " } }, "note")).toBe(false);
    expect(briefShown(null, "stop")).toBe(false);
  });
  it("текст: по блокам в том же порядке, вопрос команде без ответа, своё в конце", () => {
    const t = briefText(b);
    expect(t.startsWith("Брифинг смены · 25 октября\nот Глеб Гусев\n\nКто сегодня:\nДень 12:00–20:00. Менеджер: Глеб · Официант: Вера · Ева\nВечер 16:00–2:00. Бар: Борис · Официант: Анна")).toBe(true);
    const at = (s) => t.indexOf(s);
    expect(at("Стоп-лист: Борщ, Негрони, Новинка в стопе")).toBeGreaterThan(0);
    expect(at("Новинки: Тартар из говядины (есть голос шефа), Паста")).toBeGreaterThan(at("Стоп-лист"));
    expect(at("Фокус смены: «Что сказать, если блюдо задерживается?» Верно: Предупредить и предложить напиток. Предупредить заранее значит позаботиться.")).toBeGreaterThan(at("Новинки"));
    expect(at("Вопрос команде: «С какой стороны подают блюдо?» Ответ в приложении.")).toBeGreaterThan(at("Фокус смены"));
    expect(t).not.toContain("Подаём справа");   // разбор вопроса команде — только в приложении
    expect(at("Спасибо: Глеб Гусев (55), Анна Кравец (40), Дина (12)")).toBeGreaterThan(at("Вопрос команде"));
    expect(t.endsWith("\n\nБанкет на 12 в 19:00")).toBe(true);
    expect(t).not.toMatch(/[*_`]/);   // без разметки: sa_tg_send шлёт простой текст
  });
  it("выключенное в текст не идёт; длинное обрезается, весь текст до 3500 знаков", () => {
    const t = briefText({ ...b, on: { ...b.on, roster: false, thanks: false } });
    expect(t).not.toContain("Кто сегодня");
    expect(t).not.toContain("Спасибо:");
    const long = { ...b, blocks: { ...b.blocks, note: "слово ".repeat(400), stop: Array.from({ length: 12 }, (_, i) => "Очень длинное название блюда номер " + i) } };
    const tl = briefText(long);
    expect(tl.length).toBeLessThanOrEqual(3500);
    expect(tl).toMatch(/слово…$/);
    expect(briefText(null)).toBe("");
  });
});

describe("v82: экран и карточка", () => {
  const b = buildBrief({ menu: MENU, hard: HARD, programs: PROGRAMS, sched: SCHED, league: LEAGUE, restaurant: REST, author: "Глеб Гусев", note: "Банкет", now: NOW });
  it("карточка в «Смене»: кто отправил и что внутри; непрочитанная — с точкой; пустой брифинг — без карточки", async () => {
    const { BriefCard } = await import("../ui/briefing.jsx");
    const html = R(h(BriefCard, { a11y: false, brief: { data: b, author: "Глеб Гусев" }, seen: false, onOpen: () => {} }));
    expect(html).toContain("Брифинг смены · Глеб Гусев");
    expect(html).toContain("Кто сегодня, Стоп-лист, Новинки меню, Фокус смены, Вопрос команде, Спасибо, Своё");
    expect(html).toContain('data-seen="0"');
    expect(R(h(BriefCard, { a11y: true, brief: { data: b, author: "" }, seen: true, onOpen: () => {} }))).toContain('data-seen="1"');
    expect(R(h(BriefCard, { a11y: false, brief: { data: buildBrief({ now: NOW }) }, seen: false, onOpen: () => {} }))).toBe("");
    expect(R(h(BriefCard, { a11y: false, brief: null, seen: false, onOpen: () => {} }))).toBe("");
  });
  it("чтение у сотрудника: все включённые блоки по порядку; ответ на вопрос команде — по кнопке", async () => {
    const { BriefView } = await import("../ui/briefing.jsx");
    const html = R(h(BriefView, { a11y: false, brief: { data: { ...b, on: { ...b.on, thanks: false } }, author: "Глеб Гусев" }, onClose: () => {} }));
    expect(html).toContain("От Глеб Гусев");
    const ks = [...html.matchAll(/data-brief-block="([a-z]+)"/g)].map((m) => m[1]);
    expect(ks).toEqual(["roster", "stop", "fresh", "focus", "ask", "note"]);
    expect(html).toContain("Показать ответ");
    expect(html).not.toContain("Подаём справа");
    expect(html).toContain('data-sa-back=""');   // «Назад» Telegram закрывает чтение
    expect(html).toContain("Вечер · 16:00–2:00");
  });
  it("экран руководителя рисуется до ответов сервера: «Собираю…», «Провести» и «Отправить команде»", async () => {
    const { BriefScreen } = await import("../ui/briefing.jsx");
    const T = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, lessHead: {}, lessHeadTitle: {}, backBtn2: {} };
    const html = R(h(BriefScreen, { T, a11y: false, profile: { name: "Глеб", surname: "Гусев", restaurant: REST, position: "manager" }, onBack: () => {} }));
    expect(html).toContain("Брифинг смены");
    expect(html).toContain("Собираю…");
    expect(html).toContain("Провести");
    expect(html).toContain("Отправить команде");
    expect(html).toContain(REST);
  });
});

describe("v82: в приложении", () => {
  const app = rd("App.jsx");
  it("экраны грузятся лениво; «Смена»: карточка брифинга всем, пункт «Брифинг смены» руководителю", () => {
    expect(app).toContain('const loadBriefing = () => import("./ui/briefing");');
    expect(app).toContain('const BriefScreen = lazyOf(loadBriefing, "BriefScreen");');
    expect(app).not.toMatch(/^import [^\n]*from "\.\/ui\/briefing"/m);   // не в стартовом файле
    expect(app).toContain('isLead && { key:"brief", group:"На смене", icon:"brief", label:"Брифинг смены"');
    expect(app).toContain("<BriefCard a11y={a11y} brief={teamBrief}");
    expect(app).toContain('{screen === "brief" && profile && <div className="sa-tabpad">');
    expect(rd("ui/home-hubs.jsx")).toContain("brief: (c) => <svg");
  });
  it("брифинг дня — при входе в «Смену», не чаще раза в пять минут; без этапа 32 больше не спрашиваем", () => {
    expect(app).toContain('rpc("brief_today", { p_token: saToken() })');
    expect(app).toContain("if (rpcMissing(r)) { st.off = true; return; }");
    expect(app).toContain('useEffect(() => { if (screen === "shift" && storageLoaded) loadTeamBrief(false); }, [screen, storageLoaded, loadTeamBrief]);');
    expect(app).toContain("Date.now() - st.at < 5 * 60e3");
  });
  it("кнопка «Брифинг смены» из Telegram (?go=brief): «Смена» и сразу чтение; «Назад» закрывает слой", () => {
    expect(app).toMatch(/\["pair", "league", [^\]]*"mistakes", "brief"[^\]]*\]\.includes\(v\)/);   // дальше в списке — ссылки следующих версий
    expect(app).toContain('else if (g === "brief") { navigate("shift"); briefAskRef.current.open = true; loadTeamBrief(true); }');
    expect(app).toContain('pair: set("pair"), brief: set("brief") };');
    expect(app).toContain("{briefView && teamBrief ? <Suspense fallback={null}><BriefView");
  });
  it("«Напоминания в Telegram»: строка «Брифинг смены» — только когда сервер её знает (этап 32)", async () => {
    const { prefRows } = await import("../ui/day-cards");
    const st31 = { ok: true, bot: true, linked: true, remind: true, pair: true, quest: true, league: true, fresh: true, month: true, master: true, qday: true, qday_hour: 12 };
    expect(prefRows(st31).map((r) => r[0])).toEqual(["pair", "quest", "league", "fresh", "month", "master", "qday"]);
    const rows = prefRows({ ...st31, brief: false });
    expect(rows.map((r) => r[0])).toEqual(["pair", "quest", "league", "fresh", "month", "master", "qday", "brief"]);
    expect(rows[7]).toEqual(["brief", "Брифинг смены", "когда руководитель отправляет брифинг команде"]);
  });
  it("тексты экрана — без тире между словами и без восклицаний", () => {
    const src = code(rd("ui/briefing.jsx"));
    expect(src.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).toEqual([]);
    expect(src).not.toMatch(/[А-Яа-яЁё]!["'`<\s]/);
  });
});

describe("v82: этап 32 на сервере", () => {
  const sql = rd("supabase/supabase-stage32-briefing.sql");
  it("отправляет только руководитель или старший своего заведения; день — по часам заведения; повтор — правка того же дня", () => {
    expect(sql).toContain("if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;");
    expect(sql).toContain("ld := (now() at time zone tz)::date;");
    expect(sql).toContain("on conflict (restaurant, day) do update");
    expect(sql).toContain("length(p_data::text) > 30000");
    expect(sql).toContain("txt := left(btrim(coalesce(p_text, '')), 3500);");
  });
  it("Telegram: своему заведению, раз в день на человека, кроме автора; кто выключил «Брифинг смены» — нет", () => {
    expect(sql).toContain("for l in select t.emp_id from tg_links t where t.remind and t.restaurant is not distinct from rest and t.emp_id <> c->>'id' order by t.emp_id loop");
    expect(sql).toContain("chat := _sa_tg_chat(l.emp_id, 'brief');");
    expect(sql).toContain("if not _sa_tg_once(l.emp_id, ld, 'brief') then continue; end if;");
    expect(sql).toContain("perform sa_tg_send(chat, txt, 'Брифинг смены', 'brief');");
  });
  it("виды сообщений — колонки sa_notify_prefs: следующему этапу не надо переписывать notify_prefs / notify_set", () => {
    expect(sql).toContain("where table_schema = 'public' and table_name = 'sa_notify_prefs' and data_type = 'boolean'");
    expect(sql).toContain("if p_kind is null or not (p_kind = any(_sa_notify_kinds())) then return jsonb_build_object('ok', false, 'error', 'kind'); end if;");
    expect(sql).toContain("execute format('update sa_notify_prefs set %I = $1, updated_at = now() where emp_id = $2', p_kind)");
    expect(sql).toContain("alter table sa_notify_prefs add column if not exists brief boolean not null default true;");
  });
  it("права: таблица закрыта, функции брифинга — приложению", () => {
    expect(sql).toContain("revoke all on table sa_briefs from public, anon, authenticated;");
    expect(sql).toContain("grant execute on function brief_publish(text, jsonb, text) to anon, authenticated;");
    expect(sql).toContain("grant execute on function brief_today(text) to anon, authenticated;");
    expect(sql).toContain("revoke all on function _sa_notify_kinds() from public, anon, authenticated;");
  });
});

describe("v82: метка и журнал", () => {
  it("«сборка v82», «Дополнение 395»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(8[2-9]|9\d|\d{3,})<\/span>/);   // v82 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 395 — брифинг смены из приложения: собрать, провести, отправить команде (v82)");
  });
});
