// v141: менеджер — урок 7 «Админ на смене: от открытия до планёрки» (Доп. 457); гоу-лист в брифинге смены и его итог
// (этап 50, Доп. 458); «Распорядок смены» руководителю в «Смене» и напоминание «График» по ТК РФ, ст. 103 (Доп. 459).
// Всё — дополнением к имеющемуся: брифинг, меню, «Барная карта», чек-листы, «Утро руководителя», Наставник и график.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { MANAGER_MODULES } from "../data/modules-manager";
import { CORE_MODULES } from "../data/modules-core";
import { BAR_MODULES } from "../data/modules-bar";
import { SPG_MODULES } from "../data/modules-spg";
import { SEASONAL_MODULES } from "../data/modules-seasonal";
import { SERVICE_MANAGER_MODULES } from "../data/modules-service_manager";
import { MODULES_INDEX } from "../data/modules-index";
import { BUILDS } from "../data/builds";
import { DIALOGUES_DATA } from "../data/dialogues";
import { GLOSSARY } from "../data/glossary";
import { MODULE_REVIEWS } from "../data/reviews";
import { NB_COMP_MODULES } from "../lib/newbie";
import { MOD_SVG, MARKER_RE } from "../ui/icons";
import { answerTell } from "../lib/answer-tell";
import { BRIEF_ORDER, BRIEF_TITLE, buildBrief, briefShown, briefText, briefLines, briefPreview } from "../lib/briefing";
import * as GO from "../lib/golist";
import { routineSteps, routineNext, routineLine, ROUTINE_NEXT, briefGo } from "../lib/routine";
import { DEFAULT_CHECKLISTS, CL_KINDS } from "../lib/checklists";
import { nextMonthOf, planEmpty, needNextPlan } from "../lib/schedule-attn";
import { withRefContext } from "../lib/reference-context";
import { STAGES as SERVER_STAGES } from "../lib/server-check";

const rd = (p) => readFileSync(p, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const M7 = MANAGER_MODULES.find((m) => m.id === "m7");
const lessonsOf = (t = "lesson") => M7.lessons.filter((l) => l.type === t);
const TXT = lessonsOf().map((l) => l.content).join("\n");

// localStorage и window для гоу-листа дня (метка в меню и Наставник)
let store;
beforeEach(() => {
  store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
});
afterEach(() => { delete globalThis.localStorage; });
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

describe("v141 (Доп. 457): урок 7 менеджера — в конце трека, прежнее не тронуто", () => {
  it("восьмая тема «Урок 7» менеджера; остальные треки как были", () => {
    expect(MANAGER_MODULES.map((m) => m.id)).toEqual(["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7"]);
    expect(M7).toMatchObject({ tag: "Урок 7", title: "Админ на смене: от открытия до планёрки", subtitle: "Распорядок, касса, гоу-лист, цифры и планирование" });
    expect(typeof MOD_SVG[M7.icon]).toBe("function");
    expect(M7.color).toBe(MANAGER_MODULES[0].color);
    expect([CORE_MODULES.length, BAR_MODULES.length, SPG_MODULES.length, SEASONAL_MODULES.length, SERVICE_MANAGER_MODULES.length]).toEqual([7, 7, 11, 14, 7]);
  });
  it("семь уроков, сборка, живой диалог, практика на 8 ситуаций, тест на 20", () => {
    expect(M7.lessons.map((l) => l.type)).toEqual(["lesson", "lesson", "lesson", "lesson", "lesson", "lesson", "lesson", "build", "dialogue", "practice", "quiz"]);
    expect(lessonsOf().map((l) => l.title)).toEqual(["Смена целиком: зоны и распорядок", "Открытие: обход, касса, брифинг", "Гоу-лист: что смена продаёт сегодня",
      "Касса и чеки: что требует закон", "Недостача: по закону, без «штрафов»", "Закрытие и цифры смены", "Планирование: день, неделя, месяц, год"]);
    expect(lessonsOf("quiz")[0].questions.length).toBe(20);
    expect(lessonsOf("practice")[0].situations.length).toBe(8);
    for (const l of lessonsOf()) expect(l.content.length, l.id).toBeGreaterThan(900);
    expect(M7.lessons.find((l) => l.type === "build")).toMatchObject({ id: "m7-build", buildId: "open-shift-admin", role: "manager", mod: "m7" });
    expect(M7.lessons.find((l) => l.type === "dialogue").dialogueId).toBe("mgr-b7-1");
  });
  it("индекс уроков собран скриптом и знает новую тему", () => {
    const idx = MODULES_INDEX.manager.find((m) => m.id === "m7");
    expect(idx.title).toBe(M7.title);
    expect(idx.lessons.map((l) => l.id)).toEqual(M7.lessons.map((l) => l.id));
  });
});

describe("v141 (Доп. 457): содержание урока — распорядок, касса, закон, цифры, планирование", () => {
  it("распорядок по часам и шесть зон; особенности заведения — в «О нас» (Распорядок дня менеджера)", () => {
    for (const s of ["**Шесть зон смены**", "За 60 минут до открытия", "За 30 минут — брифинг", "За 15 минут — чек-лист готовности зала",
      "в блоке «Распорядок дня менеджера»", "«О нас»"]) expect(TXT, s).toContain(s);
  });
  it("гоу-лист: две-три позиции, четыре строки на брифинге, срок годности не обходим, итог по отчёту iiko", () => {
    for (const s of ["две-три позиции", "**Четыре строки на брифинге**", "Чем хорошо", "С чем предложить", "Фраза гостю",
      "никогда не продаёт просроченное", "отчёте iiko по блюдам"]) expect(TXT, s).toContain(s);
  });
  it("ТК РФ, ст. 103: график за месяц; ссылки на экраны приложения", () => {
    expect(TXT).toContain("не позже чем за месяц до начала (ст. 103)");
    for (const s of ["«Смена» → «Распорядок смены»", "«Смена» → «Чек-листы»", "«Брифинг смены» → блок «Гоу-лист»", "«Итог гоу-листа»",
      "«График» напомнит, если на следующий месяц он ещё пуст", "«Утро руководителя»"]) expect(TXT, s).toContain(s);
  });
  it("строки с маркерами — без звёздочек (на экране всё равно без жирного)", () => {
    for (const l of lessonsOf()) for (const line of l.content.split("\n")) if (MARKER_RE.test(line)) expect(line, l.id).not.toContain("**");
  });
  it("тест и практика: варианты почти одной длины, верный не угадывается (как tests/v38)", () => {
    for (const l of M7.lessons) {
      const items = l.type === "quiz" ? l.questions.map((q) => ({ o: q.options, c: q.correct }))
        : (l.situations || []).filter((s) => s.genre !== "truefalse").map((s) => ({ o: s.options, c: s.correct }));
      for (const it of items) {
        const L = it.o.map((x) => x.length), mx = Math.max(...L), mn = Math.min(...L);
        if (mx <= 24) expect(mx - mn, l.id + " " + L.join("/")).toBeLessThanOrEqual(8);
        else expect(mx / mn, l.id + " " + L.join("/")).toBeLessThanOrEqual(1.3);
        expect(answerTell(it.o, it.c), l.id).toBe(false);
      }
    }
  });
  it("«Сборка: открытие смены» — вид «по шагам» (flow), пять этапов, в каждом один верный, варианты ровные", () => {
    const b = BUILDS.find((x) => x.id === "open-shift-admin");
    expect(b).toMatchObject({ mod: "m7", role: "manager", vis: "flow" });
    expect(b.steps.length).toBe(5);
    for (const s of b.steps) {
      expect(s.options.filter((o) => o.ok).length, s.label).toBe(1);
      const L = s.options.map((o) => o.t.length);
      expect(Math.max(...L) / Math.min(...L), s.label).toBeLessThanOrEqual(1.3);
      for (const o of s.options) expect(o.fb.length, s.label).toBeGreaterThan(10);
    }
    expect(rd("ui/build.jsx")).toContain("flow: Flow");
    expect(rd("ui/module-menu.jsx")).toContain('if (l.type === "build") return l.role && l.role !== "bar" ? "собери по шагам" : "собери у стойки";');
  });
  it("живой диалог «Касса не сходится»: четыре выбора, свой уход, верный путь до хорошего настроения", () => {
    const d = DIALOGUES_DATA.find((x) => x.id === "mgr-b7-1");
    expect(d.termKey).toBe("мгр-б7");
    expect(d.guest).toMatchObject({ name: "Кирилл", mood: 2, walkTitle: "Кирилл ушёл" });
    const ch = d.steps.filter((s) => s.type === "choice");
    expect(ch.length).toBe(4);
    for (const s of ch) {
      expect(s.options.filter((o) => o.correct).length).toBe(1);
      const L = s.options.map((o) => o.text.length);
      expect(Math.max(...L) / Math.min(...L)).toBeLessThanOrEqual(1.3);
    }
    expect(d.guest.mood + ch.reduce((a, s) => a + s.options.find((o) => o.correct).moodDelta, 0)).toBeGreaterThanOrEqual(5);
  });
  it("связи: «Книга отзывов», семь терминов глоссария (и они в уроке), план новичка", () => {
    const rv = MODULE_REVIEWS.m7;
    expect(rv && rv.text.length > 60 && rv.guest && rv.table).toBeTruthy();
    const low = TXT.toLowerCase();
    for (const t of ["Гоу-лист", "Кассовая смена", "Чек коррекции", "Глубина чека", "Материальная ответственность", "Планёрка", "ФОТ"]) {
      const g = GLOSSARY.filter((x) => x.term === t);
      expect(g.length, t).toBe(1);
      expect(g[0].def.length, t).toBeGreaterThan(40);
      expect(low, t).toContain(t.toLowerCase().slice(0, 7));
    }
    expect(NB_COMP_MODULES.manager["Честность и деньги"]).toBe("m7");
    expect(NB_COMP_MODULES.manager["Продукт и подача"]).toBe("m6");   // прежнее — как было
  });
});

// ── Гоу-лист ────────────────────────────────────────────────────────────────────────────────
const MENU = [
  { id: "d1", name: "Тартар из говядины", desc: "Нежный, с лёгким дымком. Порция на одного.", pairing: "Пино нуар или лимонад с розмарином", ingredients: ["говядина", "желток"] },
  { id: "d2", name: "Борщ", stop: true },
  { id: "d3", name: "Старое блюдо", archived: true },
  { id: "w1", kind: "wine", name: "Пино нуар Бургундия", notes: ["вишня", "земля", "специи"], pair: ["d1"], pairNote: "к мясу", short: "Лёгкое красное к тартару" },
  { id: "__barcard__", cocktails: ["negroni", "daiquiri"] },
];
const GOL = [
  { id: "d1", name: "Тартар из говядины", kind: "dish", why: "Нежный, с лёгким дымком.", pair: "Пино нуар", say: "Сегодня советую тартар: шеф сам коптит желток." },
  { id: "negroni", name: "Негрони", kind: "cocktail", why: "", pair: "", say: "" },
];

describe("v141 (Доп. 458): гоу-лист — данные и строки", () => {
  it("нормализация: не больше трёх, без повторов и пустых названий, вид — из четырёх, длины обрезаны", () => {
    const g = GO.goNormalize([{ name: "А" }, { id: "x", name: "Б", kind: "пицца" }, { id: "x", name: "Б2" }, { name: "  " }, null, "строка", { name: "В", why: "я".repeat(200) }, { name: "Г" }]);
    expect(g.map((x) => [x.id, x.name, x.kind])).toEqual([["А", "А", "dish"], ["x", "Б", "dish"], ["В", "В", "dish"]]);
    expect(g[2].why.length).toBe(GO.GO_LIMITS.why);
    expect(GO.goNormalize("не массив")).toEqual([]);
    expect(GO.GO_MAX).toBe(3);
    expect(GO.GO_KINDS.map((k) => k[0])).toEqual(["dish", "cocktail", "wine", "spirit"]);
  });
  it("в стопе и в архиве — не уходят в брифинг; классика «Барной карты» остаётся", () => {
    const go = [...GOL, { id: "d2", name: "Борщ" }];
    expect(GO.goBlocked(go, MENU)).toEqual(["d2"]);
    expect(GO.goActive(go, MENU).map((x) => x.id)).toEqual(["d1", "negroni"]);
    expect(GO.goActive([{ id: "d3", name: "Старое блюдо" }], MENU)).toEqual([]);
  });
  it("строки для чтения и Telegram: фраза гостю — в «ёлочках», точка между строками одна", () => {
    // одна точка в конце строки не нужна (у одних позиций есть, у других нет), многоточие остаётся
    expect(GO.goRows(GO.goNormalize(GOL)[0])).toEqual([["Чем хорошо", "Нежный, с лёгким дымком"], ["С чем предложить", "Пино нуар"], ["Фраза гостю", "«Сегодня советую тартар: шеф сам коптит желток»"]]);
    expect(GO.goRows({ why: "Хорош…", pair: "Вино..." })).toEqual([["Чем хорошо", "Хорош…"], ["С чем предложить", "Вино..."]]);
    expect(GO.goText(GOL)).toBe("Гоу-лист:\n1. Тартар из говядины. Чем хорошо: Нежный, с лёгким дымком. С чем предложить: Пино нуар. Фраза гостю: «Сегодня советую тартар: шеф сам коптит желток»\n2. Негрони");
    expect(GO.goText([])).toBe("");
    expect(GO.goNames(GOL)).toBe("Тартар из говядины, Негрони");
  });
  it("итог смены: целые 0–99 999 только по позициям гоу-листа; строка и «всё записано»", () => {
    expect(GO.goSoldNormalize({ d1: "12", negroni: 0, x: 5, d9: -1 }, GOL)).toEqual({ d1: 12, negroni: 0 });
    expect(GO.goSoldNormalize({ d1: 1.5, negroni: 100000 }, GOL)).toEqual({});
    expect(GO.goSoldNormalize([1, 2], GOL)).toEqual({});
    expect(GO.goSoldLine(GOL, { d1: 12, negroni: 7 })).toBe("Тартар из говядины: 12 · Негрони: 7");
    expect(GO.goSoldLine(GOL, {})).toBe("");
    expect([GO.goSoldDone(GOL, { d1: 12 }), GO.goSoldDone(GOL, { d1: 12, negroni: 0 }), GO.goSoldDone([], {})]).toEqual([false, true, false]);
  });
  it("кандидаты: блюда, вина и классика «Барной карты»; в стопе — с пометкой, архив и запись карты — нет", () => {
    const c = GO.goCandidates(MENU);
    expect(c.map((x) => [x.id, x.kind, x.stop, !!x.classic])).toEqual([["d1", "dish", false, false], ["d2", "dish", true, false], ["w1", "wine", false, false],
      ["negroni", "cocktail", false, true], ["daiquiri", "cocktail", false, true]]);
    // карта бара не настроена — вся классика, как в «Барной карте» (lib/bar-card.js)
    expect(GO.goCandidates(MENU.filter((d) => d.id !== "__barcard__")).filter((x) => x.classic).length).toBeGreaterThan(20);
    expect(GO.goSearch(c, "нег").map((x) => x.id)).toEqual(["negroni"]);
    expect(GO.goSearch(c, "пино бур").map((x) => x.id)).toEqual(["w1"]);
    expect(GO.goSearch(c, "").length).toBe(c.length);
  });
  it("три строки из карточки: блюдо, классика (фраза гостю делится), вино (ноты, пары из меню)", () => {
    const c = GO.goCandidates(MENU), of = (id) => GO.goItem(c.find((x) => x.id === id), MENU);
    expect(of("d1")).toEqual({ id: "d1", name: "Тартар из говядины", kind: "dish", why: "Нежный, с лёгким дымком", pair: "Пино нуар или лимонад с розмарином", say: "" });
    expect(of("negroni")).toMatchObject({ kind: "cocktail", why: "Три равные части, горьковатый и честный", pair: "Прошутто, оливки, брускетты", say: "Аперитив, который открыл сто лет назад итальянский граф" });
    expect(of("w1")).toMatchObject({ why: "Ноты: вишня, земля, специи", pair: "Тартар из говядины; к мясу", say: "Лёгкое красное к тартару" });
  });
  it("Наставник: вопрос по карточке и разбор ответа на три строки", () => {
    const c = GO.goCandidates(MENU).find((x) => x.id === "d1");
    const q = GO.goAiPrompt(GO.goItem(c, MENU), c, "Два моря, Океан");
    expect(q).toContain("Гоу-лист смены ресторана «Два моря, Океан»: блюдо «Тартар из говядины». Из карточки: Нежный, с лёгким дымком. Порция на одного; состав: говядина, желток; сочетание: Пино нуар или лимонад с розмарином.");
    expect(q).toContain("Чем хорошо: (до 70 знаков)\nС чем предложить: (до 70 знаков)\nФраза гостю:");
    expect(q).not.toContain("..");
    expect(GO.goParseAi("**Чем хорошо:** нежный, с дымком\nС чем предложить: «пино нуар»\nФраза гостю: Советую тартар, он сегодня особенно хорош\n[[go:menu]]"))
      .toEqual({ why: "нежный, с дымком", pair: "пино нуар", say: "Советую тартар, он сегодня особенно хорош" });
    expect(GO.goParseAi("Не знаю")).toBe(null);
  });
  it("гоу-лист дня на телефоне: из брифинга дня; вчерашний, чужой и выключенный — пусто; событие для меню", () => {
    const now = new Date(), day = ymd(now);
    const brief = { data: { day, on: { go: true }, blocks: { go: GOL } } };
    let fired = 0;
    globalThis.window = { dispatchEvent: () => { fired++; } };
    try {
      GO.rememberGoToday(brief, "Два моря, Океан");
      expect(GO.goToday("Два моря, Океан").map((g) => g.id)).toEqual(["d1", "negroni"]);
      expect(GO.goToday("Порт")).toEqual([]);
      expect(GO.inGoToday({ id: "d1" }, "Два моря, Океан")).toBe(true);
      expect(GO.inGoToday({ id: "house:7", name: "негрони" }, "Два моря, Океан")).toBe(true);   // по названию
      expect(GO.inGoToday({ id: "w1", name: "Пино" }, "Два моря, Океан")).toBe(false);
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
      expect(GO.goToday("Два моря, Океан", tomorrow)).toEqual([]);
      GO.rememberGoToday({ data: { day, on: { go: false }, blocks: { go: GOL } } }, "Два моря, Океан");
      expect(GO.goToday("Два моря, Океан")).toEqual([]);
      expect(fired).toBe(2);
    } finally { delete globalThis.window; }
    expect(GO.goAssistantLine(GOL)).toBe("Тартар из говядины (фраза гостю: «Сегодня советую тартар: шеф сам коптит желток.»); Негрони");
  });
  it("«Как вчера»: последний отправленный гоу-лист с этого телефона, только раньше сегодня; подпись по дню", () => {
    GO.rememberGoLast("Два моря, Океан", "2026-11-05", GOL);
    expect(GO.goLast("Два моря, Океан", "2026-11-06")).toMatchObject({ day: "2026-11-05" });
    expect(GO.goLast("Два моря, Океан", "2026-11-05")).toBe(null);
    expect(GO.goLast("Порт", "2026-11-06")).toBe(null);
    expect(GO.goAgainLabel("2026-11-05", "2026-11-06")).toBe("Как вчера");
    expect(GO.goAgainLabel("2026-11-04", "2026-11-06")).toBe("Как 4 ноября");
    expect(GO.goAgainLabel("2026-12-31", "2027-01-01")).toBe("Как вчера");
    expect(GO.dayBefore("2026-03-01")).toBe("2026-02-28");
  });
});

describe("v141 (Доп. 458): гоу-лист в брифинге", () => {
  const NOW = new Date(2026, 10, 6, 10);
  it("блок «Гоу-лист» после «Новинок меню»; выбран — включён, в стопе — не уходит", () => {
    expect(BRIEF_ORDER.indexOf("go")).toBe(BRIEF_ORDER.indexOf("fresh") + 1);
    expect(BRIEF_TITLE.go).toBe("Гоу-лист");
    const b = buildBrief({ menu: MENU, go: [...GOL, { id: "d2", name: "Борщ" }], now: NOW });
    expect(b.on.go).toBe(true);
    expect(b.blocks.go.map((g) => g.id)).toEqual(["d1", "negroni"]);
    expect(buildBrief({ menu: MENU, now: NOW }).on.go).toBe(false);
  });
  it("превью карточки, строки чата и текст Telegram", () => {
    const b = buildBrief({ menu: MENU, go: GOL, now: NOW });
    expect(briefShown(b, "go")).toBe(true);
    expect(briefPreview(b)).toContain("гоу-лист: Тартар из говядины, Негрони");
    expect(briefLines(b).lines || briefLines(b)).toEqual(expect.arrayContaining(["Гоу-лист: Тартар из говядины, Негрони"]));
    expect(briefText(b)).toContain("Гоу-лист:\n1. Тартар из говядины. Чем хорошо: Нежный, с лёгким дымком.");
    const off = { ...b, on: { ...b.on, go: false } };
    expect(briefText(off)).not.toContain("Гоу-лист");
  });
  it("экран брифинга: редактор гоу-листа, «Как вчера» и итог за сегодня и вчера (этап 50)", () => {
    const s = rd("ui/briefing.jsx");
    expect(s).toContain('if (k === "go") return <GoEditor key={k}');
    expect(s).toContain('rpc("brief_go_get", { p_token: tok, p_day: yd })');
    expect(s).toContain("rememberGoLast(restaurant, data.day, data.blocks.go);");
    expect(s).toContain("<GoResult key={d + \"|\" + (r.at || \"\")}");
    expect(s).toContain('if (k === "go") return <GoBody b={b} c={c} big={big} sold={goSold} />;');
    expect(s).toContain('export function BriefScreen({ T, a11y, profile, onBack, onSent, toChat = false, focus = "" })');
    const g = rd("ui/golist.jsx");
    for (const x of ['data-go-picker=""', 'data-go-search=""', "data-go-tab={k}", "data-go-opt={x.id}", 'data-go-field="why"', 'data-go-field="pair"', 'data-go-field="say"',
      "data-go-ai={g.id}", "Подсказать фразы", '"Выбрать из меню"', "data-go-again", "data-go-result={r.day}", "data-go-sold-input={g.id}", 'data-go-save=""',
      "В стопе: в брифинг не уйдёт", 'rpc("brief_go_save"']) expect(g, x).toContain(x);
  });
  it("метка «гоу-лист» в меню, «Барной карте» и колоде; брифинг дня спрашиваем и там", () => {
    for (const f of ["ui/menu-deck.jsx", "ui/menu-trainer.jsx", "ui/wine-list.jsx", "ui/bar-card.jsx"]) {
      const s = rd(f);
      expect(s, f).toContain("useGoToday(");
      expect(s, f).toContain("data-go-badge");
    }
    const app = rd("App.jsx");
    expect(app).toContain('useEffect(() => { if (["shift", "menuTrainer", "wines", "cocktails"].includes(screen) && storageLoaded) loadTeamBrief(false); }');
    expect(app).toContain("rememberGoToday(teamBrief, profile.restaurant)");
    expect(app).toContain("golist: goToday(profile?.restaurant),");
  });
  it("Наставник знает гоу-лист дня: строкой, когда спрашивают, что советовать, или про позицию из него", () => {
    const ask = (q, golist = GOL) => withRefContext([{ role: "user", content: q }], { position: "waiter" }, { position: "waiter", golist })[0].content;
    const line = "[Гоу-лист смены на сегодня: Тартар из говядины (фраза гостю: «Сегодня советую тартар: шеф сам коптит желток.»); Негрони. Советуя гостю, начни с него.]";
    for (const q of ["Что посоветовать гостю?", "Как продать больше десертов?", "Что сегодня в гоу-листе?", "Что предложить к ужину?", "Расскажи про тартар", "С чем подать негрони?"]) expect(ask(q), q).toContain(line);
    for (const q of ["Как открыть смену?", "Какие аллергены в борще?"]) expect(ask(q), q).not.toContain("Гоу-лист");
    expect(ask("Что посоветовать гостю?", [])).not.toContain("Гоу-лист");
  });
  it("«Утро руководителя»: вчерашний итог или «итог не записан» с переходом к нему", () => {
    const s = rd("ui/morning.jsx");
    expect(s).toContain('"Гоу-лист: итог не записан"');
    expect(s).toContain('onGo("brief", { focus: "go" })');
    expect(rd("App.jsx")).toContain('else if (dest === "brief") { setBriefFocus(x && x.focus === "go" ? "go" : ""); navigate("brief"); }');
  });
});

describe("v141 (Доп. 458): этап 50 — итог гоу-листа на сервере", () => {
  const sql = rd("supabase/supabase-stage50-golist.sql");
  it("две функции поверх брифинга дня; руководитель — сегодня и вчера; любой сотрудник читает", () => {
    for (const s of ["create or replace function brief_go_save(p_token text, p_day text, p_sold jsonb)", "create or replace function brief_go_get(p_token text, p_day text default null)",
      "alter table sa_briefs add column if not exists go_sold jsonb;", "if d is null or d > today or d < today - 1 then return jsonb_build_object('ok', false, 'error', 'bad_day')",
      "if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden')", "n < 0 or n > 99999 or n <> trunc(n)",
      "d < today - 31", "grant execute on function brief_go_save(text, text, jsonb), brief_go_get(text, text) to anon, authenticated;",
      "revoke all on function _sa_go_ids(jsonb), _sa_go_day(text, date) from public, anon, authenticated;", "' функции из 2'"]) expect(sql, s).toContain(s);
    expect((sql.match(/language plpgsql volatile security definer/g) || []).length).toBe(2);
    for (const n of ["21", "24", "32"]) expect(sql).toContain("Сначала этап " + n);
  });
  it("проверка сервера, README и тест базы", () => {
    expect(SERVER_STAGES.find((s) => s.n === "50")).toMatchObject({ file: "supabase-stage50-golist.sql", fn: "brief_go_get" });
    expect(rd("supabase/README.md")).toContain("supabase-stage50-golist.sql");
    expect(rd("tools/claude/sql/test50.sh")).toContain("brief_go_save");
    const fake = rd("tools/claude/demo-app/fake-server.js");
    expect(fake).toContain('fn === "brief_go_get"');
    expect(fake).toContain('fn === "brief_go_save"');
  });
});

describe("v141 (Доп. 459): «Распорядок смены»", () => {
  const T0 = new Date(2026, 10, 6, 9, 5).toISOString(), T1 = new Date(2026, 10, 6, 23, 10).toISOString();
  const brief = { at: "a", data: { day: "2026-11-06", on: { go: true }, blocks: { go: GOL } } };
  it("четыре шага: открытие, брифинг, закрытие, итог; сделанное — само, следующий — строкой", () => {
    const cl = { ok: true, templates: {}, today: { open: { checked: ["o1", "o2", "o3", "o4", "o5", "o6"], done_at: T0 }, close: { checked: ["c1", "c2", "zz"] } } };
    const s = routineSteps({ cl, brief, go: { ok: true, saved: false, sold: {} } });
    expect(s.map((x) => [x.k, x.title, x.done, x.skip, x.sub])).toEqual([["open", "Открытие", true, false, "готово в 09:05"], ["brief", "Брифинг", true, false, "гоу-лист: 2"],
      ["close", "Закрытие", false, false, "2 из 6"], ["go", "Итог", false, false, "не записан"]]);
    expect(routineNext(s).k).toBe("close");
    expect(routineLine(s)).toBe("Дальше: чек-лист закрытия");
    const done = routineSteps({ cl: { ok: true, today: { open: { done_at: T0 }, close: { done_at: T1 } } }, brief, go: { ok: true, saved: true, sold: { d1: 12, negroni: 7 } } });
    expect(done.map((x) => x.done)).toEqual([true, true, true, true]);
    expect(done[3]).toMatchObject({ sub: "записан", full: "записан, Тартар из говядины: 12 · Негрони: 7" });
    expect(routineLine(done)).toBe("Все шаги распорядка на сегодня сделаны");
  });
  it("без гоу-листа итог пропускается; до ответа сервера — без «не отправлен»; шаблон чек-листа — свой", () => {
    const s = routineSteps({ cl: { ok: true, today: {} }, brief: { at: 1, data: { on: {}, blocks: {} } } });
    expect(s[3]).toMatchObject({ skip: true, sub: "нет гоу-листа" });
    expect(s.map((x) => x.sub)).toEqual(["не начат", "без гоу-листа", "не начат", "нет гоу-листа"]);
    const u = routineSteps({ briefKnown: false });
    expect(u.map((x) => x.sub)).toEqual(["чек-лист", "брифинг", "чек-лист", "гоу-лист"]);
    expect(routineSteps({ cl: { ok: true }, brief: null }).map((x) => x.sub)[1]).toBe("не отправлен");
    const own = routineSteps({ cl: { ok: true, templates: { open: [{ id: "a", text: "Свет" }, { id: "b", text: "Касса" }] }, today: { open: { checked: ["a"] } } } });
    expect(own[0].sub).toBe("1 из 2");
    expect(briefGo(null)).toEqual([]);
    expect(Object.keys(ROUTINE_NEXT)).toEqual(["open", "brief", "close", "go"]);
    expect(DEFAULT_CHECKLISTS.open.length).toBe(6);
    expect(CL_KINDS.map((k) => k[0])).toEqual(["open", "preshift", "close"]);
  });
  it("в «Смене» руководителю, не в выходной; шаг открывает свой экран (нужный чек-лист, итог в брифинге)", () => {
    const app = rd("App.jsx");
    expect(app).toContain('const RoutineCard = lazyOf(() => import("./ui/routine"), "RoutineCard");');
    expect(app).toContain("{isLead && profile.restaurant && !(shiftToday && shiftToday.off) ? <Suspense fallback={null}><RoutineCard a11y={a11y} brief={teamBrief} briefKnown={briefKnown} onOpen={openRoutine} /></Suspense> : null}");
    expect(app).toContain('if (k === "open" || k === "close") { setChecklistTab(k); navigate("checklist"); }');
    expect(app).toContain("initialTab={checklistTab}");
    expect(app).toContain("focus={briefFocus}");
    const sa = rd("ui/screens-admin.jsx");
    expect(sa).toContain('export function ChecklistScreen({ T, a11y, profile, onBack, initialTab = "open" })');
    expect(sa).toContain('export { DEFAULT_CHECKLISTS, CL_KINDS } from "../lib/checklists";');
    const r = rd("ui/routine.jsx");
    for (const x of ["data-routine=\"\"", "data-routine-step={s.k}", "data-routine-next=", 'rpc("checklist_get"', 'rpc("brief_go_get"', "Распорядок смены"]) expect(r, x).toContain(x);
  });
});

describe("v141 (Доп. 459): «График» — ТК РФ, ст. 103", () => {
  it("следующий месяц, пустая расстановка, когда показывать", () => {
    expect(nextMonthOf(2026, 10)).toEqual({ y: 2026, m: 11, key: "2026-12" });
    expect(nextMonthOf(2026, 11)).toEqual({ y: 2027, m: 0, key: "2027-01" });
    expect([planEmpty({}), planEmpty({ a: {} }), planEmpty({ a: { 3: "" } }), planEmpty({ a: { 3: "Д" } }), planEmpty(null)]).toEqual([true, true, true, false, true]);
    const now = new Date(2026, 10, 6);
    const next = { key: "2026-12", empty: true };
    expect(needNextPlan({ Y: 2026, M: 10, now, admin: true, next })).toBe(true);
    expect(needNextPlan({ Y: 2026, M: 10, now, admin: false, next })).toBe(false);   // сотруднику не показываем
    expect(needNextPlan({ Y: 2026, M: 11, now, admin: true, next })).toBe(false);    // открыт не текущий месяц
    expect(needNextPlan({ Y: 2026, M: 10, now, admin: true, next: { key: "2026-12", empty: false } })).toBe(false);
    expect(needNextPlan({ Y: 2026, M: 10, now, admin: true, next: null })).toBe(false);   // ещё не знаем
  });
  it("строка в «Требует внимания» с переходом в следующий месяц", () => {
    const s = rd("ui/schedule.jsx");
    expect(s).toContain('<div data-attn-row="tk103"');
    expect(s).toContain("ТК РФ, ст. 103: график сменности доводят до сотрудников не позже чем за месяц до начала");
    expect(s).toContain("onClick={() => { goMonth(1); vibrate(\"light\"); }}>Открыть ›</button>");
    expect(s).toContain("const calm = !confl.length && !holes.length && !waiting.length && !tk103;");
    expect(s).toContain('rpc("schedule_load", { p_token: saToken(), p_restaurant: profile?.restaurant || "", p_month: nx.key })');
  });
});

describe("v141: правила текста и выпуск", () => {
  const NEWF = ["lib/golist-day.js", "lib/golist.js", "lib/use-go-today.js", "lib/routine.js", "lib/checklists.js", "ui/golist.jsx", "ui/routine.jsx"];
  it("новые файлы: без ритма « — » в строках и без эмодзи", () => {
    for (const f of NEWF) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(/\p{Extended_Pictographic}/u.test(code(rd(f))), f).toBe(false);
    }
  });
  it("CHANGES и README проверок", () => {
    const ch = rd("CHANGES.md");
    for (const n of ["457", "458", "459"]) expect(ch).toContain("# Дополнение " + n);
    expect(rd("tools/claude/README.md")).toContain("`e2e-v141.mjs`");
  });
});
