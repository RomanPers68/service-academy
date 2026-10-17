// v41 (Доп. 354): оборванные фразы и вычитка всего текста; главная снова минималистичная.
//
// 1. Отзыв владельца: в живом диалоге «Семья на пороге» реплика гостя обрывалась — «…хотелось бы потише и
//    чтоб малышу было где.» Дописана; весь текст приложения вычитан (два круга и независимое ревью правок),
//    в npm run check:content — пункт 7 «Оборванные фразы», он ловит и эту реплику.
// 2. «Новая функция немного рушит изначальный минимализм»: «Шаг дня» — тонкой строкой в карточке трека,
//    «Путь мастера» — чипом рядом со свечой и стаканом, вместо карточки v40 под треком.
// Вид в браузере (обе темы, 320 и 390 px) — /home/claude/preview/e2e-v41.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { DIALOGUES_DATA } from "../data/dialogues";
import { masteryState } from "../lib/mastery";
import { StepLine, masteryChip } from "../ui/mastery-card";
import { DayChips } from "../ui/day-cards";

const noop = () => {};
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const app = readFileSync("App.jsx", "utf8");
const NOW = new Date(2026, 9, 15, 12);

// та же проверка, что в scripts/check-content.mjs (п. 7)
const CUT_TAIL = "в|во|на|с|со|к|ко|по|о|об|обо|у|от|из|за|для|при|через|над|под|перед|про|чтобы|чтоб|и|а|но|или|либо|во время|вместо|который|которая|которое|которые";
const CUT_RX = [
  new RegExp("(?:^|[\\s«(—])(?:" + CUT_TAIL + ")\\s*[.!?]+(?=[\\s\"'`)]|$)", "i"),
  /(?:^|[\s«(—,])(?:было|будет|будут|есть)\s+(?:где|куда|чем|кому|когда)\s*[.!?…]/i,
];
const cut = (s) => CUT_RX.some((rx) => rx.test(s));

describe("v41: незаконченные фразы — дописаны, и есть проверка", () => {
  it("реплика семьи Орловых дописана", () => {
    const d = DIALOGUES_DATA.find((x) => x.id === "spg-b0-2");
    const guest = d.steps.filter((s) => s.type === "guest").map((s) => s.text);
    expect(guest).toContain("Спасибо… да, хотелось бы потише — и чтобы малышу было где устроиться.");
    expect(JSON.stringify(d)).not.toContain("было где.");
  });
  it("в диалогах многоточие — одним знаком «…»", () => {
    expect(JSON.stringify(DIALOGUES_DATA).includes("...")).toBe(false);
  });
  it("проверка ловит обрыв, но не трогает заминки, вопросы-продолжения и названия кнопок", () => {
    for (const s of ["Спасибо... да, хотелось бы потише и чтоб малышу было где.", "Фиксируй после смены. Не во время.",
      "Учат после смены, спасают — во время.", "Хочу заказать и.", "Смотри, что лежит на."]) expect(cut(s), s).toBe(true);
    for (const s of ["Я… первый раз у вас. Не знаю, как тут всё устроено.", "Хорошая старшая хостес добивается, чтобы…",
      "Оттуда же «Кто вместо?» и «Факт часов».", "Картой, пожалуйста. И, если можно, побыстрее.", "С газом или без?",
      "Улыбайся до приветствия, а не после — пусть гостя встретит лицо.", "Спасибо… да, хотелось бы потише — и чтобы малышу было где устроиться."]) expect(cut(s), s).toBe(false);
  });
  it("во всех файлах данных оборванных фраз нет (как npm run check:content, п. 7)", () => {
    const hits = [];
    for (const f of readdirSync("data").filter((f) => f.endsWith(".js"))) {
      readFileSync("data/" + f, "utf8").split("\n").forEach((line, i) => {
        if (/^\s*\/\//.test(line)) return;
        for (const part of line.split("\\n")) if (cut(part)) hits.push(f + ":" + (i + 1));
      });
    }
    expect(hits).toEqual([]);
  });
  it("check-content.mjs — пункт 7 «Оборванные фразы» (предупреждение, сборку не валит)", () => {
    const cc = readFileSync("scripts/check-content.mjs", "utf8");
    expect(cc).toContain('console.log("7. Оборванные фразы")');
    expect(cc).toMatch(/warns\.push\(`data\/\$\{f\}:\$\{i \+ 1\} фраза обрывается/);
    expect(cc).toMatch(/\ncutCheck\(\);\n/);
  });
  it("ИИ-помощник редактора тоже договаривает фразы: правило в подсказках урока, теста и практики", async () => {
    const { PROMPT } = await import("../api/lesson-assist");
    for (const t of [PROMPT.lesson("seasonal", "материал"), PROMPT.improve("seasonal", "текст"), PROMPT.questions("seasonal", "текст", "Тема"), PROMPT.situations("seasonal", "текст", "Тема")])
      expect(t).toContain("Каждая фраза договорена до конца: не обрывай мысль на предлоге, союзе, «во время», «вместо» или «было где / чем»");
  });
  it("исправленные места — новый текст на месте, старого нет (выборка по всем файлам)", () => {
    const FIX = [
      ["dialogues.js", "Так растят.\"", "Так растят новичков."],
      ["dialogues.js", "А то я уж подумал.\"", "А то я уж подумал, что бронь потеряли."],
      ["dialogues.js", "Не знаю, как тут всё.\"", "Не знаю, как тут всё устроено."],
      ["dialogues.js", "проявь заботу", "прояви заботу"],
      ["dialogues.js", "и угла «чтоб не занимать».", "и угла «чтоб не занимать большой стол»."],
      ["dialogues.js", "Как поступаешь как старший?", "Что делаешь как старшая?"],
      ["dialogues.js", "Что значит «я ошибаюсь»?!", "То есть это я виноват?!"],
      ["modules-seasonal.js", "скорость исправления важнее\\n", "скорость исправления важнее объяснений"],
      ["modules-seasonal.js", "«Позвольте, обсудим это здесь»", "«Позвольте, обсудим не здесь»"],
      ["modules-core.js", "Не во время.", "после смены, а не во время неё."],
      ["modules-core.js", "Налить дамам → мужчинам → хозяин стола", "Налить дамам → мужчинам → хозяину стола"],
      ["modules-manager.js", "Первая закрывает.\"", "Первая закрывает человека, второй — развивает."],
      ["modules-service_manager.js", "до того, как грянет.", "до того, как грянет гром."],
      ["modules-spg.js", "И не пускает никого обратно внутрь.\"", "помогает сосчитать гостей и не пускает никого обратно внутрь."],
      ["modules-bar.js", "Всё, что до, работает", "Всё, что было до подачи, работает"],
      ["builds.js", "Мадлером в нём работать нечем.", "Мадлером в нём работать негде."],
      ["builds.js", "тает о вчерашнюю воду", "тает во вчерашней воде"],
      ["candidate-questions.js", "не при чём", "ни при чём"],
      ["candidate-questions.js", "а об форме", "а о форме"],
      ["cocktail-stories.js", "любимая Хемингуэя", "любимая Хемингуэем"],
      ["cocktails.js", "любимая Хемингуэя", "любимая Хемингуэем"],
      ["cocktail-stories.js", "сахар оставили", "добавили сахар"],
      ["reviews.js", "двое картой, один наличными", "Разделить счёт на пятерых: двое картой, двое наличными"],
      ["glossary.js", "затем отдают из листа ожидания.", "затем отдают гостям из листа ожидания."],
      ["nutrition.js", "клоповка ,белый", "клоповка, белый"],
    ];
    for (const [f, before, after] of FIX) {
      const src = readFileSync("data/" + f, "utf8");
      expect(src.includes(before), f + ": осталось «" + before + "»").toBe(false);
      expect(src.includes(after), f + ": нет «" + after + "»").toBe(true);
    }
  });
});

// ── главная ──
const FACTS = {
  mid: { life: { st: 120, l: 30, p: 8, q: 9, s: 46, d: 3, w: 40, r: 1, g: 0, m: 4, f: 2, u: 2, o: 0 }, sectionsDone: 9, sectionsTotal: 12, perfectTests: 2, gold: 0, streakBest: 14, questsDone: 0, hallSkills: 0, roleDone: false, firstDay: "2026-08-01", streakNow: 3, mistakesDue: 0, shiftToday: null },
  newbie: { life: { w: 1, r: 1, st: 2 }, sectionsDone: 0, sectionsTotal: 12, perfectTests: 0, gold: 0, streakBest: 1, questsDone: 0, hallSkills: 0, roleDone: false, firstDay: "2026-10-10", streakNow: 1, mistakesDue: 0, shiftToday: null },
  master: { life: { st: 400, l: 60, p: 20, q: 20, s: 120, d: 12, w: 42, r: 5, g: 3, m: 60, f: 8, u: 16, o: 6 }, sectionsDone: 12, sectionsTotal: 12, roleDone: true, perfectTests: 6, gold: 6, streakBest: 21, questsDone: 0, hallSkills: 0, firstDay: "2026-07-01", streakNow: 5, mistakesDue: 0, shiftToday: null },
};
const stateOf = (fx) => masteryState(FACTS[fx], "core", { now: NOW });
const STEP = { id: "fresh:s0", kind: "fresh", fam: "fresh", text: "Освежи тему «Психология первого дня»", sub: "3 ситуации · 1 мин — тема снова свежая", go: "refresh", payload: { mod: "s0" } };

describe("v41: «Шаг дня» — строкой в карточке трека (вид «Б · Строка с подписью»)", () => {
  it("значок и золотая надпись «ШАГ ДНЯ», под ними дело и круглая стрелка справа; без большой кнопки; вся строка — кнопка", () => {
    const html = R(h(StepLine, { a11y: false, step: STEP, onStep: noop }));
    expect(html).toContain("data-ms-line");
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Шаг дня: Освежи тему «Психология первого дня». 3 ситуации · 1 мин — тема снова свежая"');
    expect(html.replace(/<[^>]+>/g, "")).toBe("Шаг дняОсвежи тему «Психология первого дня»");
    // «чуть-чуть компактнее»: значок — в строке надписи, дело — во всю ширину (короткое — в одну строку)
    expect(html).toMatch(/text-transform:uppercase;line-height:1\.3;color:#D9B87C;display:flex;align-items:center;gap:7px"><svg[^>]*>.*?<\/svg>Шаг дня</);
    expect(html).toMatch(/font-size:14px;line-height:1\.25;color:#EFE4C8;margin-top:2px">Освежи тему «Психология первого дня»</);
    expect(html).toContain('data-ms-line-go=""');
    expect(html).toContain('d="M9 5l7 7-7 7"');
    expect(html).not.toContain("Сделать");            // ни таблетки v40, ни слова — стрелка
    expect(html).toContain("ms-clamp ms-c3");        // две строки, на узком — три (без «первог…»)
  });
  it("сделан, пустой или нет шага — строки нет", () => {
    expect(R(h(StepLine, { step: { ...STEP, done: true } }))).toBe("");
    expect(R(h(StepLine, { step: { ...STEP, text: "" } }))).toBe("");
    expect(R(h(StepLine, { step: null }))).toBe("");
  });
  it("светлая тема: надпись 11 px (метка), дело 14 px; последнее слово не остаётся одно на строке", () => {
    const html = R(h(StepLine, { a11y: true, step: STEP, onStep: noop }));
    expect(html).toMatch(/font-size:11px;letter-spacing:1\.6px;text-transform:uppercase/);
    expect(html).toMatch(/font-size:14px;line-height:1\.25;color:#2A1F0E/);
    const raw = renderToString(h(StepLine, { a11y: true, step: STEP, onStep: noop }));
    expect(raw).toContain("первого\u00A0дня»");
  });
});

describe("v41: «Путь мастера» — чипом в строке роли (звёздочка в кольце)", () => {
  it("середина пути: «N/14», кольцо — доля значков; в подписи — значки и мастер роли; новое — точкой", () => {
    const st = stateOf("mid");
    const m = masteryChip(st, 0, false);
    expect(m.text).toBe(st.bronze + "/14");
    expect(R(m.icon)).toContain('data-ms-ring="' + Math.round(st.bronze / 14 * 100) + '"');
    expect(m.aria).toBe("Путь мастера: " + st.bronze + " из 14 значков, до мастера роли " + st.master.have + " из 13");
    expect(m.dot).toBe(false);
    const m2 = masteryChip(st, 3, false);
    expect(m2.dot).toBe(true);
    expect(m2.aria.endsWith(", есть новое")).toBe(true);
  });
  it("новичок — «Первые шаги в академии» x/7; мастер — печать и «мастер роли ✦»", () => {
    const nst = stateOf("newbie");
    const nb = masteryChip(nst, 0, false);
    expect(nb.text).toMatch(/^\d\/7$/);
    expect(nb.aria).toMatch(/^Первые шаги в академии: \d из 7$/);
    expect(R(nb.icon)).toContain('data-ms-ring="' + Math.round(nst.firstWeek.done / 7 * 100) + '"');
    const ms = stateOf("master");
    expect(ms.master.ok).toBe(true);
    const mm = masteryChip(ms, 0, true);
    expect(mm.aria).toMatch(/^Путь мастера: мастер роли ✦, \d+ из 14 значков$/);
    expect(R(mm.icon)).toContain('data-ms-ring="100"');   // у мастера кольцо полное
    expect(masteryChip(null)).toBe(null);
  });
  it("DayChips: третий чип — кнопка с подписью и точкой; без него — как было", () => {
    const st = { count: 4, last: "2026-10-15", days: [] };
    const m = masteryChip(stateOf("mid"), 2, false);
    const html = R(h(DayChips, { a11y: false, streak: st, steps: 0, goal: 2, onGoal: noop, today: "2026-10-15", mastery: m, onMastery: noop }));
    expect(html).toContain("data-ms-chip");
    expect(html).toContain('aria-label="' + m.aria + '"');
    expect(html).toContain("data-ms-chip-new");
    expect(html.replace(/<[^>]+>/g, "")).toContain(m.text);
    const base = R(h(DayChips, { a11y: false, streak: st, steps: 0, goal: 2, onGoal: noop, today: "2026-10-15" }));
    expect(base).not.toContain("data-ms-chip");
    expect(base).toContain("Цель дня: 0 из 2");
  });
  it("чипы в светлой теме — 13 px (в тёмной — 12, как было); v43 — табличка: цифры 20 px, подписи в светлой теме 11 px", () => {
    // v43 (Доп. 356): чипы стали табличкой с медальонами (tests/v43.test.js). Мелкого текста 12–13 px в ней нет:
    // цифры — 20 px, подписи — метки, в светлой теме «Для чтения» от 11 px (как метки в v40)
    const st = { count: 1, last: "", days: [] };
    const lt = R(h(DayChips, { a11y: true, streak: st, steps: 0, goal: 2, onGoal: noop, today: "x" }));
    const dk = R(h(DayChips, { a11y: false, streak: st, steps: 0, goal: 2, onGoal: noop, today: "x" }));
    expect(lt).toMatch(/class="tbv sa-dp lt"/);
    expect(dk).toMatch(/class="tbv sa-dp"/);
    for (const html of [lt, dk]) expect(html).toMatch(/font-size:20px/);
    expect(readFileSync("ui/day-cards.jsx", "utf8")).toMatch(/\.sa-dp\.lt \.sa-dp-cap\{font-size:11px;/);
  });
});

describe("v41: главная — строка шага в карточке трека, подпись роли целиком или никак", () => {
  const T4 = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false,
    roleHeader: {}, roleSubtitle: {}, roleList: {}, roleCard: {}, roleAccent: {}, roleIcon: {}, roleInfo: {}, roleLabel: {}, roleSublabel: {}, roleDesc: {} };
  const mod = { id: "cms-m-1", title: "Свой раздел", lessons: [{ id: "cms-l-1", type: "lesson", title: "Урок: встреча гостя", content: "Текст" }, { id: "cms-l-1q", type: "quiz", title: "Тест", questions: [{ q: "?", options: ["а", "б"], correct: 0 }] }] };
  const profile = { name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter" };
  const line = h("div", { "data-test-line": "" }, "Шаг дня · Освежи тему");
  const render = async (extra) => {
    const { RoleSelect } = await import("../ui/screens-roleselect");
    return R(h(RoleSelect, { T: T4, a11y: false, profile, role: "seasonal", onSelect: noop, onContinueLesson: noop, customByRole: { seasonal: [mod] }, ...extra }));
  };
  it("строка — внутри карточки трека (после «Начать», до «Мой график»), клики не уходят в карточку", async () => {
    // v44 (Доп. 357): «Шаг дня» — плашкой в ряду внизу карточки (ряд останавливает клики), карточка закрывается после ряда
    const html = await render({ stepLine: line });
    const slot = '<div data-step-slot="" style="flex:1 1 0;min-width:0;display:flex"><div data-test-line="">Шаг дня · Освежи тему</div></div>';
    const at = html.indexOf(slot);
    expect(at).toBeGreaterThan(0);
    expect(html.indexOf(">Начать</div>")).toBeLessThan(at);
    expect(at).toBeLessThan(html.indexOf("Мой график"));
    const row = html.lastIndexOf('<div data-day-pills=""', at);
    expect(row).toBeGreaterThan(html.indexOf(">Начать</div>"));
    // сразу после ряда закрывается карточка трека, а за ней — обёртка трека
    expect(html.slice(at + slot.length).startsWith("</div></div></div>")).toBe(true);
    const base = await render({});
    expect(base).not.toContain("data-step-slot");
    expect(base).not.toContain("data-day-pills");
    expect(await render({ stepLine: null })).toBe(base);
  });
  it("подпись роли — целиком или никак: обёртка в одну строку с невидимым элементом нулевой ширины", async () => {
    // v44 (Доп. 357): роль — строкой под именем в приветствии; подпись целиком (без многоточия), не влезла рядом —
    // переносится второй строкой (flex-wrap), а не обрезается
    const html = await render({});
    expect(html).toMatch(/<span data-role-line="" style="display:flex;flex-wrap:wrap;align-items:center;column-gap:6px;margin-top:3px;font-family:Georgia, serif;font-size:12px;line-height:16px;color:#[0-9A-Fa-f]{6}"><span style="display:inline-flex;align-items:center;gap:5px;white-space:nowrap">.*?<b>Новичок<\/b><\/span><span data-role-sub="" style="color:#aaa;font-size:11px;white-space:nowrap">Сезонный сотрудник<\/span><\/span>/);
    expect(html).not.toMatch(/text-overflow:ellipsis;white-space:nowrap">Сезонный/);
  });
  it("название шага трека — до трёх строк (на узком экране не обрывается многоточием)", async () => {
    expect(await render({})).toMatch(/-webkit-line-clamp:3;-webkit-box-orient:vertical">Встреча гостя</);
  });
  it("App: строка шага — только когда есть что делать и это не повтор главной карточки или разминки; чип — с точкой «новое»", () => {
    expect(app).toMatch(/import \{ BadgeToast, StepLine, masteryChip \} from "\.\/ui\/mastery-card";/);
    expect(app).not.toMatch(/<MasteryHomeCard/);
    expect(app).toMatch(/stepLine=\{profile && role && mShown && mStepShown && !mStepShown\.done && mStepShown\.kind !== "next" && mStepShown\.kind !== "track"\s*&& !\(mStepShown\.go === "warmup" && warmShow && warmDone !== todayKey\)/);
    expect(app).toMatch(/mastery=\{role && mShown \? masteryChip\(mShown, mNew\.size, a11y\) : null\} onMastery=\{\(\) => openMastery\(\)\}/);
  });
});

describe("v41: метка сборки и запись в CHANGES", () => {
  it("«сборка v41», «Дополнение 354»", () => {
    expect(readFileSync("ui/menu-trainer.jsx", "utf8")).toMatch(/· сборка v\d{2}</);   // v42: номер сборки растёт
    expect(readFileSync("CHANGES.md", "utf8")).toMatch(/# Дополнение 354 — /);
  });
});
