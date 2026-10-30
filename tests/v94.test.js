// v94 (Доп. 407): клавиатура в чате и у Наставника на iPhone (ui/keyboard.js): низ поднимается по высоте, которую
// Telegram сообщает, как только клавиатура поехала, и вместе с ней; Telegram больше не прокручивает страницу (экран не
// падает вниз), строка ввода не висит над пустым местом, когда клавиатура ушла; поиск в «Написать» не сжимается до
// полоски. Листы чата листаются пальцем. Карточка под ответом Наставника — того блюда, о котором спросили
// (lib/ai-cards.js). Вид — tools/claude/e2e-v94.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const rd = (f) => readFileSync(f, "utf8");
const DASH = /[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

describe("v94: клавиатура (ui/keyboard.js)", () => {
  it("перекрытие и отступ: окно сжалось само и visualViewport ещё короче — второй раз не вычитаем", async () => {
    const K = await import("../ui/keyboard.js");
    expect(K.kbOverlap(852, 0, 516)).toBe(336);                 // клавиатура поверх окна
    expect(K.kbPad(852, 852, 852, 0, 516)).toBe(336);           // Safari: окно то же, видимая часть короче
    expect(K.kbPad(516, 516, 852, 0, 516)).toBe(0);             // Android: окно сжалось само
    expect(K.kbPad(516, 516, 852, 0, 180)).toBe(0);             // Telegram на iPhone (v94, первая запись): не дважды
    expect(K.kbPad(undefined, null, NaN, null, undefined)).toBe(0);
    const chat = await import("../ui/chat.jsx");                // прежние имена — из чата (tests/v91)
    expect(chat.kbOverlap(852, 0, 552)).toBe(300);
    expect(chat.kbPad(552, 552, 852, 0, 252)).toBe(0);
  });
  it("куда опускать низ: в Telegram на iPhone — по высоте от Telegram, пока фокус в поле; visualViewport не в счёт", async () => {
    const { kbBottom } = await import("../ui/keyboard.js");
    const ios = { ios: true, layerH: 852, baseH: 852, vvTop: 0 };
    expect(kbBottom({ ...ios, bottom: 852, tgH: 516, typing: true, vvH: 852 })).toBe(516);    // клавиатура поехала, окно то же
    expect(kbBottom({ ...ios, bottom: 516, layerH: 516, tgH: 516, typing: true, vvH: 180 })).toBe(516);   // окно сжалось
    expect(kbBottom({ ...ios, bottom: 852, tgH: 516, typing: false, vvH: 852 })).toBe(852);   // фокус ушёл
    expect(kbBottom({ ...ios, bottom: 852, tgH: 852, typing: true, vvH: 516 })).toBe(852);    // vv на iPhone не верим
    expect(kbBottom({ ...ios, bottom: 852, tgH: 0, typing: true })).toBe(852);                // Telegram ничего не сообщил
    const web = { ios: false, typing: true, tgH: 852, vvTop: 0 };
    expect(kbBottom({ ...web, bottom: 852, layerH: 852, baseH: 852, vvH: 516 })).toBe(516);   // Safari
    expect(kbBottom({ ...web, bottom: 516, layerH: 516, baseH: 852, vvH: 516 })).toBe(516);   // Android
    expect(kbBottom({ ...web, bottom: 516, layerH: 516, baseH: 852, vvH: 180 })).toBe(516);   // дважды не вычитаем
  });
  it("клавиатура на экране: низ поднят или окно короче обычного; фокус ушёл, а окно ещё короткое — всё ещё на экране", async () => {
    const { kbUp } = await import("../ui/keyboard.js");
    expect(kbUp({ bottom: 852, layerH: 852, baseH: 852, typing: true }, 516)).toBe(true);
    expect(kbUp({ bottom: 516, layerH: 516, baseH: 852, typing: true }, 516)).toBe(true);
    expect(kbUp({ bottom: 516, layerH: 516, baseH: 852, typing: false }, 516)).toBe(true);
    expect(kbUp({ bottom: 852, layerH: 852, baseH: 852, typing: false }, 852)).toBe(false);
    expect(kbUp({ bottom: 852, layerH: 852, baseH: 852, typing: true }, 820)).toBe(false);   // 32 px — не клавиатура
  });
  it("ход низа: резко с места и мягко в конце (v96: по кривой самой клавиатуры, а не 220 мс); Telegram на iPhone — по платформе", async () => {
    const K = await import("../ui/keyboard.js");
    // v96 (Доп. 409): ход снят с записи клавиатуры iPhone — KB_OPEN и KB_CLOSE (tests/v96.test.js)
    expect([K.KB_MS, K.kbEase]).toEqual([undefined, undefined]);
    expect([K.kbCurve(K.KB_OPEN, 0), K.kbCurve(K.KB_OPEN, 1000), K.kbCurve(K.KB_OPEN, -5)]).toEqual([0, 1, 0]);
    expect(K.kbCurve(K.KB_OPEN, 25)).toBeGreaterThan(0.3);   // резко с места
    expect(K.kbCurve(K.KB_OPEN, 200) - K.kbCurve(K.KB_OPEN, 150)).toBeLessThan(0.05);   // мягко в конце
    expect(K.tgIos({ Telegram: { WebApp: { platform: "ios" } } })).toBe(true);
    expect(K.tgIos({ Telegram: { WebApp: { platform: "android" } } })).toBe(false);
    expect(K.tgIos({})).toBe(false);
  });
  it("хук: высота от Telegram (viewportChanged), отступ — переменной --kb в тот же кадр, без React; лента держится низа", () => {
    const src = rd("ui/keyboard.js");
    // v95: слушатель высоты от Telegram — onTg (тот же замер и ещё два позже)
    // v96: --kb меняется только в начале или в конце пути (setLayout), фокус — onIn и onOut (с него и считается ход)
    for (const s of ['try { if (tg && tg.onEvent) tg.onEvent("viewportChanged", onTg); } catch (e) { /* */ }',
      "let tgH = 0; try { tgH = tg ? num(tg.viewportHeight) : 0; } catch (e) { tgH = 0; }",
      'if (v !== L) { L = v; el.style.setProperty("--kb", v + "px"); }',
      "if (Math.abs(hold) < 0.5 || hold > (rising ? KB_HOLD_RUN : KB_HOLD_MAX)) { yIdle = goal; return; }",   // v98: окно сменило высоту — держим и доезжаем
      'document.addEventListener("focusin", onIn); document.addEventListener("focusout", onOut);',
      "else if (tn - KB_BASE.low > 600) { KB_BASE.h = r.height; KB_BASE.low = 0; }",
      "const ro = new ResizeObserver(() => {"]) expect([s, src.includes(s)]).toEqual([s, true]);
  });
  it("чат: корень с --kb и классом kb по клавиатуре на экране, лист над клавиатурой, без прежнего перехода padding-bottom", () => {
    const src = rd("ui/chat.jsx");
    expect(src).toContain('import { useKeyboardLift, usePinBottom } from "./keyboard";');
    expect(src).toContain('const kb = useKeyboardLift(rootRef, { cls: "kb" });');   // v95: класс kb ставит сам хук
    expect(src).toContain('<div ref={rootRef} className={"sa-dlg ch" + (a11y ? " lt" : "") + (kb.up ? " kb" : "")} data-chat="" role="dialog" aria-modal="true" aria-label="Чат">');
    expect(src).toContain("background-size:240px 240px,auto,auto;padding-bottom:var(--kb,0px)}");
    expect(src).toContain(".ch-veil{position:absolute;inset:0 0 var(--kb,0px);z-index:20;");
    expect(src).toContain("usePinBottom(chatRef);");
    expect(src).not.toContain("transition:padding-bottom .25s");
    expect(src).not.toContain("style={{ paddingBottom: kb }}");
    expect(src).toContain("calc(8px + var(--sa-sb,env(safe-area-inset-bottom,0px)) * var(--kbs,1))");   // v95: вырез снизу — тем же ходом, что низ
  });
  it("Наставник: тот же хук, корень с --kb, лента держится низа, без своего visualViewport", () => {
    const src = rd("ui/assistant.jsx");
    expect(src).toContain('const kbs = useKeyboardLift(rootRef, { safe: "env(safe-area-inset-bottom, 0px)" });');   // v96: вырез снизу у Наставника — env()
    expect(src).toContain("usePinBottom(listRef);");
    expect(src).toContain('<div className="sa-screen sa-dlg sa-layer" ref={rootRef}');
    expect(src).toContain('paddingBottom: "var(--kb, 0px)"');
    expect(src).not.toContain("window.innerHeight - vv.height - vv.offsetTop");
    expect(src).not.toContain('transition: "padding-bottom 0.25s cubic-bezier(0.25,0.1,0.25,1)"');
  });
});

describe("v94: листы чата листаются пальцем", () => {
  it("листы, подпись к фото — по вертикали, ряд подсказок — вбок; беседы Наставника — лента", () => {
    expect(rd("ui/chat.jsx")).toContain(".sa-dlg .ch-sheet,.sa-dlg .ch-sheet *,.ch-view .ch-view-cap,.ch-view .ch-view-cap *{touch-action:pan-y !important}");
    expect(rd("ui/chat-cards.jsx")).toContain(".sa-dlg .ch-sugg,.sa-dlg .ch-sugg *{touch-action:pan-x !important}");
    // v114: отступ панели — с учётом кнопок Telegram сверху (--sa-st)
    expect(rd("ui/assistant.jsx")).toContain('<div className="sa-pagein sa-dlgscroll" style={{ position: "absolute", top: "calc(62px + var(--sa-st, 0px))", left: 12, right: 12, zIndex: 6,');
    // правило слоя прежнее: жесты выключены всем, кроме лент
    expect(rd("ui/css.js")).toContain(".sa-dlg, .sa-dlg * { touch-action: none !important; }");
  });
});

describe("v94: карточка под ответом Наставника (lib/ai-cards.js)", () => {
  const CRAB = { id: "rb7", name: "Краб стригун", cat: "Row-bar", ingredients: ["Краб стригун", "Икра тобико", "Лайм"] };
  const SEAS = { id: "sl9", name: "Салат «Два моря»", cat: "Салаты", ingredients: ["Сливочный крем", "Огурец свежий", "Кальмар", "Краб Стригун", "Соус руй"] };
  const TWO = { ...SEAS, id: "sl8", name: "Два моря" };
  const NEG = { id: "negroni", name: "Негрони", ing: [["Джин", "30 мл"], ["Кампари", "30 мл"]] };
  const REPLY = "Роман, вот состав салата «Два моря» (Салаты):\n\n1. Сливочный крем\n2. Огурец свежий\n3. Кальмар\n4. Краб Стригун\n5. Соус руй\n\nВажно для гостя: в составе есть краб, кальмар и моллюски.";
  const names = (r) => r.picks.map((p) => p.item.name);
  it("слова в любой форме; название в вопросе — все значимые слова; подряд в тексте", async () => {
    const A = await import("../lib/ai-cards.js");
    expect(A.aiWords("Салат «Два моря»!")).toEqual(["салат", "два", "моря"]);
    expect([A.sameWord("салат", "салата"), A.sameWord("краб", "крабом"), A.sameWord("моря", "моря"), A.sameWord("два", "двух"), A.sameWord("краб", "кальмар")]).toEqual([true, true, true, false, false]);
    const q = A.aiWords("напомни состав салата два моря, океан");
    expect([A.namedIn("Салат «Два моря»", q), A.namedIn("Два моря", q), A.namedIn("Краб стригун", q)]).toEqual([true, true, false]);
    expect(A.phraseAt("Салат «Два моря»", A.aiWords("вот состав салата «Два моря» (Салаты)"))).toBe(2);
    expect(A.phraseAt("Краб стригун", A.aiWords("в составе есть краб, кальмар"))).toBe(-1);
  });
  it("запись владельца: спросил салат «Два моря» — карточка салата, а не «Краб стригун» из его состава", async () => {
    const { pickCards } = await import("../lib/ai-cards.js");
    const q = "напомни состав салата два моря, океан";
    expect(names(pickCards({ text: REPLY, question: q, dishes: [CRAB, SEAS] }))).toEqual(["Салат «Два моря»"]);
    expect(names(pickCards({ text: REPLY, question: q, dishes: [CRAB, TWO] }))).toEqual(["Два моря"]);
    // модель поставила метку краба: он в составе салата — отдельной карточкой нет
    const r = pickCards({ text: REPLY + "\n[[dish:rb7]]", question: q, dishes: [CRAB, SEAS] });
    expect(names(r)).toEqual(["Салат «Два моря»"]);
    expect(r.text).not.toContain("[[");
  });
  it("без вопроса: метки модели; без меток — названия в тексте по порядку, строки состава не в счёт", async () => {
    const { pickCards } = await import("../lib/ai-cards.js");
    expect(names(pickCards({ text: "Подай [[cocktail:negroni]] к [[dish:rb7]]", dishes: [CRAB], cocktails: [NEG] }))).toEqual(["Негрони", "Краб стригун"]);
    expect(names(pickCards({ text: REPLY, question: "", dishes: [CRAB, SEAS] }))).toEqual(["Салат «Два моря»"]);
    expect(names(pickCards({ text: "Состав:\n1. Краб стригун\n2. Лайм", dishes: [CRAB] }))).toEqual([]);
    expect(names(pickCards({ text: "Попробуй негрони, а к нему краб стригун.", dishes: [CRAB], cocktails: [NEG] }))).toEqual(["Негрони", "Краб стригун"]);
    // неизвестная метка: из текста убрана, карточки нет
    const u = pickCards({ text: "Вот [[dish:нет-такого]] и всё", dishes: [CRAB] });
    expect([u.text, u.picks.length]).toEqual(["Вот  и всё", 0]);
    expect(pickCards({ text: "", dishes: [CRAB, SEAS], cocktails: [NEG], question: "краб стригун и негрони и два моря салат" }).picks.length).toBe(2);
  });
  it("чат: aiReply получает вопрос (lib/chat-ai.js), уроки — после блюд; экран «Наставник» — тот же выбор", async () => {
    const { aiReply } = await import("../lib/chat-app.js");
    const r = aiReply(REPLY + " [[lesson:l1|Урок]] [[go:menu|Меню]]", { dishes: [CRAB, SEAS], lessons: { l1: "Аллергены" }, question: "напомни состав салата два моря" });
    expect(r.cards.map((c) => c.kind + ":" + c.title)).toEqual(["dish:Салат «Два моря»", "lesson:Аллергены"]);
    expect(r.text).not.toMatch(/\[\[/);
    expect(rd("lib/chat-ai.js")).toContain("lessons: lessonTitles(), question: q });");
    const as = rd("ui/assistant.jsx");
    expect(as).toContain("const pc = pickCards({ text: text || \"\", question, dishes: myDishes, cocktails: COCKTAILS, max: 2 });");
    expect(as).toContain("parseCards(nv.clean, askBefore(i))");
  });
});

describe("v94: без лишнего", () => {
  it("в новых файлах нет эмодзи и тире-ритма в строках интерфейса", () => {
    for (const f of ["ui/keyboard.js", "lib/ai-cards.js"]) {
      const s = rd(f);
      expect([f, EMOJI.test(s)]).toEqual([f, false]);
      expect([f, (code(s).match(DASH) || []).length]).toEqual([f, 0]);
    }
  });
});

describe("v94: документы", () => {
  it("README: e2e-v94; CHANGES: Дополнение 407; «сборка v94»", () => {
    expect(rd("tools/claude/README.md")).toContain("`e2e-v94.mjs` — v94 (Доп. 407)");
    expect(rd("CHANGES.md")).toContain("# Дополнение 407 — Клавиатура на iPhone, прокрутка листов и карточка у Наставника (v94)");
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(9[4-9]|\d{3,})<\/span>/);
  });
});
