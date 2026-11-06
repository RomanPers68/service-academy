// v140 (Доп. 455): новые уроки по таблице обучения холдинга — «Ядро» и «Менеджер»: курс по алкоголю (вино, крепкое, пиво);
// «Бар» и «Хостес»: конфликты (у бара — и с гостем у стойки). Всё новыми темами в конце треков, существующее не меняется.
// Связи: «Книга отзывов», глоссарий, план новичка, индекс уроков (теперь собирается скриптом scripts/gen-modules-index.mjs).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { CORE_MODULES } from "../data/modules-core";
import { MANAGER_MODULES } from "../data/modules-manager";
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

const rd = (p) => readFileSync(p, "utf8");
const last = (arr) => arr[arr.length - 1];
const NEW = { core: [CORE_MODULES, "c6"], manager: [MANAGER_MODULES, "m6"], bar: [BAR_MODULES, "bar6"], spg: [SPG_MODULES, "spg-m10"] };
const mod = (r) => NEW[r][0].find((m) => m.id === NEW[r][1]);
const lessonsOf = (m, t = "lesson") => m.lessons.filter((l) => l.type === t);

describe("v140: новые темы — в конце треков, прежние не тронуты", () => {
  it("ядро, менеджер, бар — седьмая тема «Урок 6», хостес — одиннадцатая «Урок 10»", () => {
    expect(CORE_MODULES.map((m) => m.id)).toEqual(["c0", "c1", "c2", "c3", "c4", "c5", "c6"]);
    expect(MANAGER_MODULES.map((m) => m.id).slice(0, 7)).toEqual(["m0", "m1", "m2", "m3", "m4", "m5", "m6"]);   // v141: дальше m7 «Админ на смене»
    expect(BAR_MODULES.map((m) => m.id)).toEqual(["bar0", "bar1", "bar2", "bar3", "bar4", "bar5", "bar6"]);
    expect(last(SPG_MODULES).id).toBe("spg-m10");
    expect(SPG_MODULES.length).toBe(11);
    expect([mod("core").tag, mod("manager").tag, mod("bar").tag, mod("spg").tag]).toEqual(["Урок 6", "Урок 6", "Урок 6", "Урок 10"]);
    expect([mod("core").title, mod("manager").title, mod("bar").title, mod("spg").title]).toEqual(["Алкоголь: вино, крепкое, пиво",
      "Алкоголь в заведении: продукт, деньги, закон", "Конфликты: гость у стойки и команда", "Хостес и команда: конфликты внутри"]);
    // значок темы — из набора приложения (не эмодзи на экране), цвет — цвет трека
    for (const r of Object.keys(NEW)) expect(typeof MOD_SVG[mod(r).icon], r).toBe("function");
    expect(mod("core").color).toBe(CORE_MODULES[0].color);
    expect(mod("manager").color).toBe(MANAGER_MODULES[0].color);
    expect(mod("bar").color).toBe(BAR_MODULES[0].color);
    expect(mod("spg").color).toBe(SPG_MODULES[0].color);
    expect(SEASONAL_MODULES.length).toBe(14);   // новичок и сервис-менеджер не менялись
    expect(SERVICE_MANAGER_MODULES.length).toBe(7);
  });
  it("состав тем: уроки, практика или сборка или живой диалог, тест на 20 вопросов", () => {
    expect(mod("core").lessons.map((l) => l.type)).toEqual(["lesson", "lesson", "lesson", "lesson", "lesson", "practice", "quiz"]);
    expect(mod("manager").lessons.map((l) => l.type)).toEqual(["lesson", "lesson", "lesson", "lesson", "practice", "quiz"]);
    expect(mod("bar").lessons.map((l) => l.type)).toEqual(["lesson", "lesson", "lesson", "lesson", "lesson", "build", "quiz"]);
    expect(mod("spg").lessons.map((l) => l.type)).toEqual(["lesson", "lesson", "lesson", "lesson", "dialogue", "quiz"]);
    for (const r of Object.keys(NEW)) expect(lessonsOf(mod(r), "quiz")[0].questions.length, r).toBe(20);
    expect(lessonsOf(mod("core"), "practice")[0].situations.length).toBe(8);
    expect(lessonsOf(mod("manager"), "practice")[0].situations.length).toBe(8);
    for (const r of Object.keys(NEW)) for (const l of lessonsOf(mod(r))) expect(l.content.length, l.id).toBeGreaterThan(900);
  });
  it("индекс уроков собирается скриптом из данных: и заголовки совпадают (раньше один был устаревшим)", () => {
    const ROLES = { bar: BAR_MODULES, seasonal: SEASONAL_MODULES, core: CORE_MODULES, manager: MANAGER_MODULES, service_manager: SERVICE_MANAGER_MODULES, spg: SPG_MODULES };
    const want = Object.fromEntries(Object.entries(ROLES).map(([r, mods]) => [r, mods.map((m) => ({ id: m.id, title: m.title, lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, type: l.type })) }))]));
    expect(MODULES_INDEX).toEqual(want);
    expect(Object.keys(MODULES_INDEX)).toEqual(["bar", "seasonal", "core", "manager", "service_manager", "spg"]);
    const gen = rd("scripts/gen-modules-index.mjs");
    expect(gen).toContain('export const MODULES_INDEX = " + JSON.stringify(index) + ";\\n"');
    expect(rd("data/modules-index.js")).toContain('"title":"Тест: лидерство в службе приёма гостей (СПГ)"');
  });
});

describe("v140: содержание — алкоголь у ядра и менеджера", () => {
  const core = mod("core"), man = mod("manager");
  const txt = (m) => lessonsOf(m).map((l) => l.content).join("\n");
  it("ядро: стиль вина, пары, подача (температуры), крепкое, пиво; связь с «Барной картой» и «Сомелье»; 18+", () => {
    const t = txt(core);
    expect(core.lessons.map((l) => l.title).slice(0, 5)).toEqual(["Вино: стиль за десять секунд", "Вино к блюду: пара за одну фразу",
      "Подача: температура, бокал, игристое", "Крепкое: категории, порция и подача", "Пиво: стили, температура, пена"]);
    for (const s of ["Формула «три слова»", "Игристое — 6–8 °C", "Плотное красное — 16–18 °C", "Пробковый дефект", "Лагер — брожение при низкой температуре",
      "Пена — около 2–3 см", "«Барной карте»", "«Сомелье»", "18+ без исключений", "по уроку «Работа с вином»"]) expect(t, s).toContain(s);
  });
  it("менеджер: карта напитков, деньги (порция 50 мл — 100 ₽), закон на осень 2026, продажи в смене", () => {
    const t = txt(man);
    for (const s of ["порция 50 мл — 100 ₽", "пять бокалов по 150 мл", "Списание — только по акту", "от 30 до 50 тысяч", "от 100 до 200 тысяч",
      "от 300 до 500 тысяч", "в течение года после штрафа — уголовная статья", "цифровым ID в приложении Max", "(с 23:00 до 8:00)",
      "на Камчатке", "только открытым", "«Кто выучил новые вина»", "есть в «О нас»", "«Сомелье»"]) expect(t, s).toContain(s);
  });
  it("бар: виды конфликтов, гость у стойки, бар и зал (стоп-лист в чат смены), передача смены, разговор после спора", () => {
    const t = txt(mod("bar"));
    for (const s of ["Четыре вида конфликтов у бара", "«Слишком сладко? Сделаю суше, две минуты»", "одним сообщением в чат смены",
      "Передача смены по чек-листу", "Я-сообщение", "Когда звать менеджера"]) expect(t, s).toContain(s);
  });
  it("хостес: откуда конфликты, рассадка («Смена» → «Рассадка»), обещания гостю, я-сообщение и менеджер", () => {
    const t = txt(mod("spg"));
    for (const s of ["Откуда берутся конфликты у входа", "«Опять ко мне? У меня уже три стола!»", "В «Смене» → «Рассадке»",
      "Что нельзя обещать, не проверив", "Я-сообщение: факт → как это повлияло → просьба", "Когда звать менеджера"]) expect(t, s).toContain(s);
  });
  it("строки с маркерами — без звёздочек: на экране они всё равно без жирного, а термины глоссария в них подсвечиваются", () => {
    for (const r of Object.keys(NEW)) for (const l of lessonsOf(mod(r)))
      for (const line of l.content.split("\n")) if (MARKER_RE.test(line)) expect(line, l.id).not.toContain("**");
  });
});

describe("v140: тесты, практики, сборка, живой диалог — без подсказки «по длине»", () => {
  it("тесты и практики: варианты почти одной длины, верный не длиннее (как tests/v38)", () => {
    for (const r of Object.keys(NEW)) for (const l of mod(r).lessons) {
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
  it("«Сборка: спор на раздаче» — вид «выдача», пять шагов, в каждом один верный, варианты ровные", () => {
    const b = BUILDS.find((x) => x.id === "pass-conflict");
    expect(b).toMatchObject({ mod: "bar6", role: "bar", vis: "pass", title: "Спор на раздаче" });
    expect(b.steps.map((s) => s.label)).toEqual(["Претензия", "Очередь", "Ошибка", "Стоп-лист", "После пика"]);
    for (const s of b.steps) {
      expect(s.options.filter((o) => o.ok).length, s.label).toBe(1);
      const L = s.options.map((o) => o.t.length);
      expect(Math.max(...L) / Math.min(...L), s.label).toBeLessThanOrEqual(1.3);
      for (const o of s.options) expect(o.fb.length, s.label).toBeGreaterThan(10);
    }
  });
  it("живой диалог «Опять ко мне?»: собеседник — официант, свой уход, четыре выбора, верный путь до восторга", () => {
    const d = DIALOGUES_DATA.find((x) => x.id === "spg-b10-1");
    expect(d.termKey).toBe("спг-б10");
    expect(d.guest).toMatchObject({ name: "Денис", mood: 2, walkTitle: "Денис ушёл к менеджеру" });
    const ch = d.steps.filter((s) => s.type === "choice");
    expect(ch.length).toBe(4);
    const up = ch.reduce((a, s) => a + s.options.find((o) => o.correct).moodDelta, 0);
    expect(d.guest.mood + up).toBeGreaterThanOrEqual(5);
    expect(d.steps.some((s) => s.type === "result")).toBe(true);
    expect(mod("spg").lessons.find((l) => l.type === "dialogue").dialogueId).toBe("spg-b10-1");
  });
});

describe("v140: связи с приложением", () => {
  it("«Книга отзывов»: страница на каждую новую тему", () => {
    for (const r of Object.keys(NEW)) {
      const rv = MODULE_REVIEWS[NEW[r][1]];
      expect(rv && rv.text.length > 60 && rv.guest && rv.table, r).toBeTruthy();
    }
  });
  it("глоссарий: лагер, эль, стаут, пробковый дефект, я-сообщение — и они встречаются в новых уроках", () => {
    const all = Object.keys(NEW).flatMap((r) => lessonsOf(mod(r)).map((l) => l.content)).join("\n").toLowerCase();
    for (const t of ["Лагер", "Эль", "Стаут", "Пробковый дефект", "Я-сообщение"]) {
      const g = GLOSSARY.find((x) => x.term === t);
      expect(g && g.def.length > 40, t).toBeTruthy();
      expect(all, t).toContain(t.toLowerCase());
    }
    expect(GLOSSARY.filter((x) => x.term === "Эль").length).toBe(1);
  });
  it("план новичка: слабая тема собеседования ведёт в новые темы", () => {
    expect(NB_COMP_MODULES.bar["Команда"]).toBe("bar6");
    expect(NB_COMP_MODULES.bar["Команда и люди"]).toBe("bar6");
    expect(NB_COMP_MODULES.bar["Конфликты и сложные ситуации"]).toBe("bar6");
    expect(NB_COMP_MODULES.spg["Команда"]).toBe("spg-m10");
    expect(NB_COMP_MODULES.spg["Команда и люди"]).toBe("spg-m10");
    expect(NB_COMP_MODULES.manager["Продукт и подача"]).toBe("m6");
    expect(NB_COMP_MODULES.bar["Продукт и подача"]).toBe("bar3");   // прежнее — как было
    expect(NB_COMP_MODULES.spg["Конфликты и сложные ситуации"]).toBe("spg-m6");
  });
  it("CHANGES и README проверок", () => {
    expect(rd("CHANGES.md")).toContain("# Дополнение 455");
    expect(rd("tools/claude/README.md")).toContain("`e2e-v140.mjs`");
  });
});

// v140 (Доп. 456): полоска внизу в Telegram на iPhone — индикатор загрузки самого Telegram (WKWebView.estimatedProgress).
// WebKit ждёт каждый запрос, начатый до события load (fetch тоже), а приложение начинало их раньше. Теперь всё стартовое —
// следующей задачей после load (lib/page-ready.js), страховка — 3 с.
import { vi } from "vitest";
import { pageReadyGate, READY_FALLBACK_MS, afterLoad as afterLoadNode, pageIsReady } from "../lib/page-ready";

const fakePage = (state = "interactive") => {
  const et = new EventTarget();
  return { win: { addEventListener: (...a) => et.addEventListener(...a), setTimeout: (f, ms) => setTimeout(f, ms) }, doc: { readyState: state },
    load: () => et.dispatchEvent(new Event("load")) };
};

describe("v140 (Доп. 456): старт приложения после загрузки страницы", () => {
  it("до load ждёт; после load — следующей задачей, не в самом обработчике; потом — сразу", () => {
    vi.useFakeTimers();
    try {
      const p = fakePage(), g = pageReadyGate(p.win, p.doc), seen = [];
      g.afterLoad(() => seen.push("a")); g.afterLoad(() => seen.push("b"));
      vi.advanceTimersByTime(1000);
      expect(seen).toEqual([]); expect(g.isReady()).toBe(false);
      p.load();
      expect(seen).toEqual([]);                      // в обработчике load — ещё нет: WebKit отмечает загрузку сразу после него
      vi.advanceTimersByTime(0);
      expect(seen).toEqual(["a", "b"]); expect(g.isReady()).toBe(true);
      g.afterLoad(() => seen.push("c"));
      expect(seen).toEqual(["a", "b", "c"]);         // страница уже загружена — сразу
      vi.advanceTimersByTime(READY_FALLBACK_MS);
      expect(seen).toEqual(["a", "b", "c"]);         // страховка после load ничего не повторяет
    } finally { vi.useRealTimers(); }
  });
  it("load задержался — старт через 3 с; поздний load ничего не повторяет; упавшая функция не держит остальные", () => {
    vi.useFakeTimers();
    try {
      const p = fakePage("loading"), g = pageReadyGate(p.win, p.doc), seen = [];
      g.afterLoad(() => { throw new Error("x"); }); g.afterLoad(() => seen.push(1));
      vi.advanceTimersByTime(READY_FALLBACK_MS - 1);
      expect(seen).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(seen).toEqual([1]);
      p.load(); vi.advanceTimersByTime(10);
      expect(seen).toEqual([1]);
      expect(READY_FALLBACK_MS).toBe(3000);
    } finally { vi.useRealTimers(); }
  });
  it("страница уже загружена (readyState complete) — следующей задачей; вне браузера — сразу", () => {
    vi.useFakeTimers();
    try {
      const p = fakePage("complete"), g = pageReadyGate(p.win, p.doc), seen = [];
      g.afterLoad(() => seen.push(1));
      expect(seen).toEqual([]);
      vi.advanceTimersByTime(0);
      expect(seen).toEqual([1]);
    } finally { vi.useRealTimers(); }
    let n = 0; afterLoadNode(() => { n++; });
    expect(n).toBe(1); expect(pageIsReady()).toBe(true);
  });
  it("main.jsx: App — внутри AfterLoad, уроки роли — в afterLoad; других запросов при загрузке скриптов нет", () => {
    const m = rd("main.jsx").replace(/\/\/.*$/gm, "");
    expect(m).toContain('import { afterLoad, pageIsReady } from "./lib/page-ready";');
    expect(m).toContain("const [ready, setReady] = React.useState(pageIsReady);");
    expect(m).toContain("React.useEffect(() => { if (!ready) afterLoad(() => setReady(true)); }, [ready]);");
    expect(m).toContain("return ready ? children : null;");
    expect(m).toMatch(/<BootBoundary>\s*<AfterLoad><App \/><\/AfterLoad>\s*<\/BootBoundary>/);
    expect(m.split("loadRoleModules(r)").length).toBe(2);
    expect(m.indexOf("afterLoad(() => {")).toBeGreaterThan(0);
    expect(m.indexOf("afterLoad(() => {")).toBeLessThan(m.indexOf("loadRoleModules(r)"));
    // единственный fetch — сверка сборки: через 1,2 с после load, при возвращении и раз в 10 минут
    expect(m.match(/\bfetch\(/g)).toHaveLength(1);
    expect(m).toContain('const html = await fetch("/index.html?ts=" + Date.now(), { cache: "no-store" })');
    expect(m).toContain('window.addEventListener("load", () => setTimeout(() => check("load"), 1200));');
    // единственный import() при загрузке скриптов — страница гостя (?thanks=): там приложения нет
    expect(m.match(/\bimport\(/g)).toHaveLength(1);
    expect(m).toContain('import("./ui/guest-thanks.jsx")');
  });
  it("логотип (assets/logo.js) — тоже после загрузки страницы; App и логотип — одни ворота", () => {
    const l = rd("assets/logo.js");
    expect(l).toContain('import { afterLoad } from "../lib/page-ready";');
    expect(l).toContain("afterLoad(() => { hold(LOGO_SRC_DARK, (u) => { LOGO_SRC_DARK = u; }); });");
    expect(l.replace(/\/\/.*$/gm, "").match(/\bhold\(/g)).toHaveLength(2);   // объявление и один вызов — в afterLoad
    const g = rd("lib/page-ready.js");
    expect(g).toContain('win.addEventListener("load", soon, { once: true });');
    expect(g).toContain("const soon = () => win.setTimeout(fire, 0);");
    expect(g).toContain("win.setTimeout(fire, fallbackMs);");
  });
  it("CHANGES и e2e: Доп. 456, раздел LOAD", () => {
    expect(rd("CHANGES.md")).toContain("# Дополнение 456");
    expect(rd("tools/claude/e2e-v140.mjs")).toContain('await run("LOAD"');
  });
});
