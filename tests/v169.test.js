// v169 (Доп. 494): ассистент редактора справочника раскладывает большой документ на главы и ходит в интернет.
// Владелец (16.11), на предложение научить ассистента раскладывать большой документ сразу на несколько глав: «Да, давай
// научим 😉»; и следом: «И давай тоже ему дадим выход в сеть, что бы он если что мог найти или проверить информацию😉».
//   • lib/ref-ai.js — режимы ref_plan, ref_part, ref_check, ref_amend и «Глава по теме» с поиском: просьбы к модели,
//     разбор ответов, следы ссылок, строки плана;
//   • api/lesson-assist.js — эти режимы, путь с поиском (api/_web.js), свой счёт обращений, честный предел PDF;
//   • ui/ref-split.jsx — «Главы из документа» в экране раздела: работа без React (makeSplitJob) и блок;
//   • ui/ref-assist.jsx — поиск в «Главе по теме», «Проверить факты», «Поправить отмеченное», источники.
// Сервер менять не нужно (этапа SQL нет). Разметки JSX в файле нет (Доп. 482). Вид в браузере — tools/claude/e2e-v169.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store0 = {};
const phone = { getItem: (k) => (k in store0 ? store0[k] : null), setItem: (k, v) => { store0[k] = String(v); }, removeItem: (k) => { delete store0[k]; } };
globalThis.localStorage = phone;
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import {
  REF_AI_MODES, REF_AI_LIMITS, REF_NEW_MODES, REF_PROMPT, REF_WEB_SYSTEM, REF_STYLE, refPrompt, refAiCheck, refAiClean, refNoLinks, refPlanClean, refPlanRows, refCheckClean, refFixesText, refSources,
} from "../lib/ref-ai";
import handler from "../api/lesson-assist.js";
import { RefAssist, RefSources, refAiCall, refHttpErr, REF_AI_PDF_MAX, REF_PDF_BIG } from "../ui/ref-assist";
import { RefSplit, makeSplitJob, splitCount, SPLIT_STOP_AFTER } from "../ui/ref-split";
import { addHiddenChapter, RE_BASE } from "../ui/ref-editor";
import { refEditTree } from "../lib/ref-edit";
import { loadRefBook, refItemsNow, _resetRefBook } from "../lib/ref-book";
import { _resetLessonPhotos } from "../lib/lesson-photo";
import { setPhotoBackend, memoryBackend } from "../lib/photo-store";
import { REFERENCE_APP_COURSE } from "../data/reference";
import { S, A } from "../ui/styles";
import { tones, glass } from "../ui/analytics-kit";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html) => html.replace(/<[^>]+>/g, "");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const noop = () => {};
const uiOf = (a11y) => { const dark = !a11y; return { input: { fontSize: 14 }, primary: { fontSize: 15 }, G: (x) => glass(null, a11y, x), txt: dark ? "#EFE4C8" : "#2A2113", muted: "#BFAE8A", gold: "#C8A96E", brd: "rgba(214,178,102,0.30)", TN: tones(a11y) }; };

const DOC = [
  "Встреча гостя\nВстречаем гостя у входа за десять секунд.\nЗдороваемся и называем заведение.\nУточняем, ждут ли гостя.",
  "Подача вина\nБутылку показываем гостю этикеткой.\nПробу наливаем тому, кто заказал.\nБелое подаём при 8–10 градусах.",
  "Расчёт\nСчёт приносим в течение трёх минут.\nСдачу отдаём до копейки.",
].join("\n\n");
const LONG = "Раф готовим на сливках десять процентов, сироп добавляем до взбивания, подаём в бокале айриш.";

describe("v169 · версия и журнал", () => {
  it("сборка v169, Дополнение 494, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(169);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 494 — .*\(v169\)/);
    const part = c.slice(c.indexOf("# Дополнение 494")).replace(/\s+/g, " ");
    expect(part).toContain("Да, давай научим");
    expect(part).toContain("И давай тоже ему дадим выход в сеть, что бы он если что мог найти или проверить информацию");
    for (const line of c.slice(c.indexOf("# Дополнение 494")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v169.mjs");
  });
});

describe("v169 · 1: просьбы к модели и пределы (lib/ref-ai.js)", () => {
  it("семь режимов; новые пределы; модуль по-прежнему ни от чего не зависит", () => {
    expect(REF_AI_MODES).toEqual(["ref_chapter", "ref_improve", "ref_shorten", "ref_plan", "ref_part", "ref_check", "ref_amend"]);
    expect(REF_NEW_MODES).toEqual(["ref_chapter", "ref_part"]);
    expect(REF_AI_LIMITS).toEqual({ topic: 160, material: 30000, text: 6000, out: 20000, min: 40, doc: 60000, docMin: 200, parts: 8, about: 300, notes: 6, quote: 200, note: 400, fixes: 3000 });
    expect(rd("lib/ref-ai.js")).not.toMatch(/^import /m);
    expect(code(rd("lib/ref-ai.js"))).not.toMatch(/\p{Emoji_Presentation}/u);
    expect(rd("lib/ref-ai.js")).toContain("export const REF_STYLE = /* @__PURE__ */ [");
  });
  it("разложить документ: одна тема, одна глава; не больше восьми; только то, что есть в документе", () => {
    const p = REF_PROMPT.plan(DOC, false);
    for (const w of ["Разложи документ на главы справочника", "одна тема, одна глава", "от 2 до 8 глав", "Больше 8 не предлагай", "Порядок глав — как в документе", "чтобы главы не пересекались",
      "Бери только то, что есть в документе", "оглавление и лист согласования — не главы", '{"chapters": [{"title": "…", "about": "…"}]}', "\nДОКУМЕНТ:\n" + DOC]) expect(p, w).toContain(w);
    expect(p).not.toContain(REF_STYLE);   // плану разметка главы ни к чему
    expect(REF_PROMPT.plan("", true)).toContain("\nДОКУМЕНТ — во вложенном PDF.");
    expect(REF_PROMPT.plan("Начало.", true)).toContain("\nДОКУМЕНТ:\nНачало.\n\nПродолжение документа — во вложенном PDF.");
    expect(refPrompt("ref_plan", "не в счёт", DOC, false)).toBe(p);
  });
  it("одна глава плана: название, «что входит», остальные главы — чтобы не пересекались; только по документу", () => {
    const p = REF_PROMPT.part("Подача вина", "Порядок подачи.", ["Встреча гостя", "Расчёт"], DOC, false);
    for (const w of ["Напиши одну главу справочника для сотрудников ресторана: «Подача вина».", "Что входит в главу: Порядок подачи.", "Остальные главы: «Встреча гостя», «Расчёт».",
      "Их содержание сюда не бери", "Опирайся только на документ", "ничего важного по теме главы не выбрасывай", "Название оставь как дано.", REF_STYLE, '{"title": "…", "content": "…"}', "\nДОКУМЕНТ:\n" + DOC]) expect(p, w).toContain(w);
    const solo = REF_PROMPT.part("Подача вина", "", [], "", true);
    expect(solo).not.toContain("Что входит в главу");
    expect(solo).not.toContain("Остальные главы");
    expect(solo).toContain("\nДОКУМЕНТ — во вложенном PDF.");
    expect(refPrompt("ref_part", "Подача вина", DOC, false, { about: "Порядок подачи.", others: ["Встреча гостя", "Расчёт"] })).toBe(p);
    expect(refPrompt("ref_part", "Подача вина", "", true)).toBe(solo);
  });
  it("глава по теме с поиском: искать и сверять факты, заметки владельца важнее найденного; без поиска — как было", () => {
    const web = REF_PROMPT.chapter("Подача игристого", "", false, true);
    expect(web).toContain("Найди и проверь в интернете факты по теме");
    expect(web).toContain("Хватит одного-трёх поисков.");
    expect(web).toContain("Не придумывай правил конкретного заведения");
    expect(web).not.toContain("Материала нет");
    expect(web).not.toContain("ЗАМЕТКИ ВЛАДЕЛЬЦА");
    const notes = REF_PROMPT.chapter("Подача игристого", "Охлаждаем до 6–8 градусов.", false, true);
    expect(notes).toContain("Заметки владельца ниже учти обязательно: это правила его ресторана, они важнее найденного в интернете.");
    expect(notes).toContain("\nЗАМЕТКИ ВЛАДЕЛЬЦА:\nОхлаждаем до 6–8 градусов.");
    expect(notes).not.toContain("Опирайся только на материал");
    expect(refPrompt("ref_chapter", "Подача игристого", "", false, { web: true })).toBe(web);
    // без поиска просьба та же, что в v168
    const plain = REF_PROMPT.chapter("Подача игристого", "", false);
    expect(plain).toContain("Материала нет: пиши по общепринятым правилам ресторанного сервиса.");
    expect(plain).not.toContain("в интернете");
    expect(refPrompt("ref_chapter", "Подача игристого", "", false)).toBe(plain);
    expect(REF_PROMPT.chapter("Т", "Материал.", false)).toContain("Опирайся только на материал");
  });
  it("вводная для режимов с поиском: где искать, без догадок, ссылок в ответ не ставить", () => {
    for (const w of ["У тебя есть поиск в интернете", "на сайтах производителей", "в текстах законов и норм", "не нашёл подтверждения, так и скажи, без догадок", "Ссылок, сносок и адресов сайтов в ответ не ставь: ссылки приложение покажет само."])
      expect(REF_WEB_SYSTEM, w).toContain(w);
  });
  it("проверить факты: что сверять, а что решение владельца; замечания только по расхождениям", () => {
    const p = REF_PROMPT.check(LONG);
    for (const w of ["Проверь по интернету факты в тексте главы", "Температуры и сроки", "нормы закона, этикета и безопасности", "Что не проверять: порядок работы самого ресторана",
      "Это решение владельца, с ним не спорь.", "Расхождений нет — замечаний нет.", "Не больше 6 замечаний", '{"summary": "…", "notes": [{"quote": "…", "note": "…"}]}', "quote — слова из текста", "\nТЕКСТ ГЛАВЫ:\n" + LONG]) expect(p, w).toContain(w);
    expect(refPrompt("ref_check", "", LONG, false)).toBe(p);
  });
  it("поправить по замечаниям: менять только то, чего касаются замечания; картинки и стиль те же", () => {
    const p = REF_PROMPT.amend(LONG, "1. «десять процентов»: чаще 10–11%.");
    for (const w of ["Поправь текст главы справочника по замечаниям проверки фактов.", "Меняй только то, чего касаются замечания.", "ничего не добавляй от себя", REF_STYLE, "\nЗАМЕЧАНИЯ:\n1. «десять процентов»: чаще 10–11%.", "\nТЕКСТ ГЛАВЫ:\n" + LONG])
      expect(p, w).toContain(w);
    expect(refPrompt("ref_amend", "", LONG, false, { fixes: "1. «десять процентов»: чаще 10–11%." })).toBe(p);
    // прежние режимы: просьбы те же
    expect(refPrompt("ref_improve", "", LONG)).toBe(REF_PROMPT.improve(LONG));
    expect(refPrompt("ref_shorten", "", LONG)).toBe(REF_PROMPT.shorten(LONG));
  });
  it("чего не хватает для новых режимов — словами, без тире между словами", () => {
    expect(refAiCheck("ref_plan", {})).toBe("Вставь текст документа или прикрепи PDF.");
    expect(refAiCheck("ref_plan", { text: "т".repeat(199) })).toBe("Текста мало для нескольких глав. Одну главу ассистент соберёт в редакторе главы.");
    expect(refAiCheck("ref_plan", { text: "т".repeat(200) })).toBeNull();
    expect(refAiCheck("ref_plan", { hasPdf: true })).toBeNull();
    expect(refAiCheck("ref_plan", { text: "мало", hasPdf: true })).toBeNull();
    expect(refAiCheck("ref_plan", { text: "т".repeat(60001) })).toBe("Документ слишком большой. Дай его частями.");
    expect(refAiCheck("ref_plan", { text: "т".repeat(60000) })).toBeNull();
    expect(refAiCheck("ref_part", { topic: "Подача вина", text: DOC })).toBeNull();
    expect(refAiCheck("ref_part", { topic: "Подача вина", text: "мало" })).toBeNull();   // документ уже прошёл проверку плана
    expect(refAiCheck("ref_part", { topic: "я", text: DOC })).toBe("У главы нет названия.");
    expect(refAiCheck("ref_part", { topic: "Подача вина" })).toBe("Вставь текст документа или прикрепи PDF.");
    expect(refAiCheck("ref_part", { topic: "Подача вина", text: "т", len: 60001 })).toBe("Документ слишком большой. Дай его частями.");
    expect(refAiCheck("ref_check", { text: "мало" })).toBe("Сначала нужен текст главы, хотя бы пара предложений.");
    expect(refAiCheck("ref_check", { text: "т".repeat(6001) })).toBe("Текст длинный для одной проверки. Выдели часть, и ассистент проверит её.");
    expect(refAiCheck("ref_check", { text: LONG })).toBeNull();
    expect(refAiCheck("ref_amend", { text: LONG })).toBe("Отметь хотя бы одно замечание.");
    expect(refAiCheck("ref_amend", { text: LONG, fixes: "1. Замечание." })).toBeNull();
    expect(refAiCheck("ref_amend", { text: "т".repeat(6001), fixes: "1." })).toBe("Текст длинный для одного раза. Выдели часть, и ассистент поправит её.");
    for (const m of ["ref_plan", "ref_part", "ref_check", "ref_amend"]) for (const a of [{}, { text: "т".repeat(70000) }, { text: LONG }]) { const s = refAiCheck(m, a); if (s) expect(s).not.toMatch(/ — /); }
  });
});

describe("v169 · 2: разбор ответов (lib/ref-ai.js)", () => {
  it("план: названия без номеров, кавычек и точки; повторы и пустое убраны; не больше восьми", () => {
    expect(refPlanClean({ chapters: [{ title: "1. Встреча гостя.", about: "  Как   встречаем. " }, { title: "«Встреча гостя»" }, "Глава 2: Подача блюд", { title: "я" }, { title: "5 шагов сервиса", about: 7 }, null, { about: "без названия" }] }))
      .toEqual({ chapters: [{ title: "Встреча гостя", about: "Как встречаем." }, { title: "Подача блюд", about: "" }, { title: "5 шагов сервиса", about: "7" }] });
    expect(refPlanClean([{ title: "Одна глава" }])).toEqual({ chapters: [{ title: "Одна глава", about: "" }] });   // модель вернула голый список
    expect(refPlanClean({ chapters: Array.from({ length: 12 }, (_, i) => ({ title: "Глава о теме " + String.fromCharCode(1040 + i) })) }).chapters.length).toBe(8);
    expect(refPlanClean({ chapters: [{ title: "Ёлка в зале" }, { title: "елка  в  зале!" }] }).chapters.length).toBe(1);
    expect(refPlanClean({ chapters: [{ title: "т".repeat(300), about: "о".repeat(500) }] }).chapters[0]).toEqual({ title: "т".repeat(160), about: "о".repeat(300) });
    for (const bad of [null, "текст", {}, { chapters: "нет" }, { chapters: [] }, { chapters: [{ title: "" }, { title: "ab" }] }]) expect(refPlanClean(bad)).toBeNull();
  });
  it("строки плана для редактора: глава, которая в разделе уже есть, без галочки", () => {
    const rows = refPlanRows([{ title: "Встреча гостя", about: "Как встречаем." }, { title: "Подача вина" }, { title: "Ёлка в зале" }, null, { about: "без названия" }], ["  встреча   ГОСТЯ ", "Елка в зале", ""]);
    expect(rows).toEqual([{ title: "Встреча гостя", about: "Как встречаем.", on: false, dup: true }, { title: "Подача вина", about: "", on: true, dup: false }, { title: "Ёлка в зале", about: "", on: false, dup: true }]);
    expect(refPlanRows([{ title: "Подача вина" }])).toEqual([{ title: "Подача вина", about: "", on: true, dup: false }]);
    expect(refPlanRows(null, null)).toEqual([]);
  });
  it("следы ссылок из ответа с поиском убираются, строки картинок не трогаются", () => {
    expect(refNoLinks("Вино подают при 16–18 °C [1]. Смотри [сайт](https://a.ru/x) и (https://b.ru/y). Ещё https://c.ru/z тут【3†source】."))
      .toBe("Вино подают при 16–18 °C. Смотри сайт и. Ещё тут.");
    expect(refNoLinks("Подача ([2]) и срок [12].\n[img:espresso_cup]\n[photo:rp:a|Подпись (https://x.ru) [1]]\n1. Шаг первый")).toBe("Подача и срок.\n[img:espresso_cup]\n[photo:rp:a|Подпись (https://x.ru) [1]]\n1. Шаг первый");
    expect(refNoLinks("Обычный текст: 10 минут, [важно] и (в скобках).")).toBe("Обычный текст: 10 минут, [важно] и (в скобках).");
    expect(refNoLinks(null)).toBe("");
  });
  it("проверка фактов: вывод и замечания; кавычки и ссылки сняты; не больше шести; пусто — null", () => {
    expect(refCheckClean({ summary: " Проверено [1]. ", notes: [{ quote: "«при 20 градусах»", note: "Источники дают 16–18 (https://a.ru)." }, { quote: "без замечания" }, null, "строка", { note: "Без слов из текста." }] }))
      .toEqual({ summary: "Проверено.", notes: [{ quote: "при 20 градусах", note: "Источники дают 16–18." }, { quote: "", note: "Без слов из текста." }] });
    expect(refCheckClean({ summary: "Расхождений нет.", notes: [] })).toEqual({ summary: "Расхождений нет.", notes: [] });
    expect(refCheckClean({ notes: Array.from({ length: 9 }, (_, i) => ({ quote: "ц" + i, note: "Замечание " + i })) }).notes.length).toBe(6);
    const big = refCheckClean({ summary: "с".repeat(900), notes: [{ quote: "ц".repeat(500), note: "з".repeat(900) }] });
    expect([big.summary.length, big.notes[0].quote.length, big.notes[0].note.length]).toEqual([300, 200, 400]);
    for (const bad of [null, "текст", [], {}, { summary: "", notes: [] }, { notes: [{ quote: "только слова" }] }]) expect(refCheckClean(bad)).toBeNull();
  });
  it("отмеченные замечания → текст для правки; ссылки — только http(s), не больше шести", () => {
    expect(refFixesText([{ quote: "при 20 градусах", note: "Нужно 16–18." }, { note: "Без слов из текста." }, { quote: "пусто" }, null])).toBe("1. «при 20 градусах»: Нужно 16–18.\n2. Без слов из текста.");
    expect(refFixesText([])).toBe("");
    expect(refFixesText(Array.from({ length: 6 }, () => ({ quote: "ц".repeat(200), note: "з".repeat(400) }))).length).toBe(3000);
    expect(refSources([{ url: "https://a.ru/x", title: "  Сайт   А " }, { url: "javascript:alert(1)" }, { url: "ftp://b.ru" }, "https://c.ru", null, { url: "http://d.ru" }]))
      .toEqual([{ url: "https://a.ru/x", title: "Сайт А" }, { url: "http://d.ru", title: "" }]);
    expect(refSources(Array.from({ length: 9 }, (_, i) => ({ url: "https://s" + i + ".ru" }))).length).toBe(6);
    expect(refSources("нет")).toEqual([]);
  });
  it("ответ с главой: у главы плана — название и текст без картинок; у правки по замечаниям картинки главы целы", () => {
    expect(refAiClean("ref_part", { title: "«Подача вина».", content: "**Подача вина**\n[img:made_up]\n1. Показываем бутылку." })).toEqual({ title: "Подача вина", content: "**Подача вина**\n1. Показываем бутылку.", lost: 0 });
    const src = "Белое при 8 градусах.\n[photo:rp:a1|Бокал]\nКрасное комнатным.";
    expect(refAiClean("ref_amend", { content: "Белое при 8–10 градусах.\nКрасное при 16–18." }, src)).toEqual({ content: "Белое при 8–10 градусах.\nКрасное при 16–18.\n\n[photo:rp:a1|Бокал]", lost: 1 });
    expect(refAiClean("ref_amend", { content: "Белое.\n[photo:rp:a1|Бокал]\nКрасное." }, src).title).toBeUndefined();
    // ответ с поиском: следы ссылок сняты
    expect(refAiClean("ref_chapter", { title: "Игристое", content: "Охлаждаем до 6–8 °C [1] ([сайт](https://a.ru))." }, "", true)).toEqual({ title: "Игристое", content: "Охлаждаем до 6–8 °C (сайт).", lost: 0 });
    expect(refAiClean("ref_chapter", { title: "Игристое", content: "Текст [1]." }).content).toBe("Текст [1].");   // без поиска текст не трогаем
    for (const m of ["ref_plan", "ref_check", "ref_нет"]) expect(refAiClean(m, { content: "Текст." })).toBeNull();
  });
});

// ── сервер: /api/lesson-assist с новыми режимами ──────────────────────────────────────────────────────────────
const WHO = { owner: { id: "u1", name: "Роман", position: "owner", is_admin: true }, boss: { id: "u2", name: "Мария", position: "manager", is_admin: false },
  staff: { id: "u3", name: "Анна", position: "waiter", is_admin: false }, limit: { id: "u9", name: "Лимит", position: "owner", is_admin: true } };
let modelCalls = [], modelAnswer = null, modelStatus = 200;
const answer = (obj, finish = "stop") => ({ model: "test-model", choices: [{ message: { content: typeof obj === "string" ? obj : JSON.stringify(obj) }, finish_reason: finish }] });
// ответ модели с поиском: ссылки — в annotations, число поисков — в usage
const webAnswer = (obj, { cites = [], searches = 2, finish = "stop" } = {}) => ({ model: "web-model", usage: { server_tool_use_details: { web_search_requests: searches } },
  choices: [{ message: { content: typeof obj === "string" ? obj : JSON.stringify(obj), annotations: cites.map((c) => ({ type: "url_citation", url_citation: c })) }, finish_reason: finish }] });
const serverFetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes("/rest/v1/rpc/whoami")) { const emp = WHO[JSON.parse(init.body).p_token]; return { ok: true, status: 200, json: async () => (emp ? { ok: true, employee: emp } : { ok: false }) }; }
  if (u.includes("openrouter.ai")) { modelCalls.push(JSON.parse(init.body)); return { ok: modelStatus === 200, status: modelStatus, json: async () => modelAnswer }; }
  throw new Error("неожиданный адрес " + u);
};
const call = async (body, method = "POST") => {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; } };
  await handler({ method, body }, res);
  return out;
};
const promptOf = (i = modelCalls.length - 1) => modelCalls[i].messages[0].content[0].text;
const CITES = [{ url: "https://wine.example/serving", title: "Подача вина" }, { url: "https://wine.example/serving#temp", title: "Повтор" }, { url: "https://law.example/norms", title: "Нормы" }];

describe("v169 · 3: сервер (api/lesson-assist.js): документ на главы", () => {
  beforeEach(() => { globalThis.fetch = serverFetch; process.env.OPENROUTER_API_KEY = "ключ"; delete process.env.OPENROUTER_WEB_MODEL; modelCalls = []; modelStatus = 200; modelAnswer = answer({ chapters: [{ title: "Встреча гостя", about: "Как встречаем." }] }); });
  it("ref_plan: документ в просьбе, PDF файлом, поиска нет; ответ — главы без повторов", async () => {
    modelAnswer = answer({ chapters: [{ title: "1. Встреча гостя.", about: " Как встречаем. " }, { title: "Подача вина", about: "Порядок подачи." }, { title: "встреча ГОСТЯ" }] });
    const r = await call({ token: "owner", mode: "ref_plan", text: DOC, title: "не в счёт" });
    expect(r).toEqual({ status: 200, body: { ok: true, chapters: [{ title: "Встреча гостя", about: "Как встречаем." }, { title: "Подача вина", about: "Порядок подачи." }], model: "test-model" } });
    expect(promptOf()).toBe(REF_PROMPT.plan(DOC, false));
    expect(modelCalls[0].messages[0].content.length).toBe(1);
    expect(modelCalls[0].tools).toBeUndefined();
    await call({ token: "owner", mode: "ref_plan", pdfBase64: "data:application/pdf;base64,QUJD" });
    expect(promptOf()).toBe(REF_PROMPT.plan("", true));
    expect(modelCalls[1].messages[0].content[1]).toEqual({ type: "file", file: { filename: "material.pdf", file_data: "data:application/pdf;base64,QUJD" } });
  });
  it("ref_plan: мало текста, слишком много, пусто — отказ до модели; ответ не по формату — 422", async () => {
    expect((await call({ token: "owner", mode: "ref_plan" })).body).toEqual({ ok: false, error: "Вставь текст документа или прикрепи PDF." });
    expect(await call({ token: "owner", mode: "ref_plan", text: "Короткая заметка." })).toEqual({ status: 400, body: { ok: false, error: "Текста мало для нескольких глав. Одну главу ассистент соберёт в редакторе главы." } });
    expect((await call({ token: "owner", mode: "ref_plan", text: "т".repeat(60001) })).body.error).toBe("Документ слишком большой. Дай его частями.");
    expect(modelCalls.length).toBe(0);
    expect((await call({ token: "owner", mode: "ref_plan", text: "т".repeat(60000) })).status).toBe(200);   // документ длиннее материала одной главы (30 000) проходит
    expect(promptOf()).toContain("т".repeat(60000));
    modelAnswer = answer({ chapters: [] });
    expect(await call({ token: "owner", mode: "ref_plan", text: DOC })).toEqual({ status: 422, body: { ok: false, error: "Ассистент ответил не по формату. Попробуй ещё раз." } });
    modelAnswer = answer({ chapters: [{ title: "Глава" }] }, "length");
    expect((await call({ token: "owner", mode: "ref_plan", text: DOC })).status).toBe(422);
  });
  it("ref_part: в просьбе название, «что входит», остальные главы и документ; ответ — название и текст без выдуманных картинок", async () => {
    modelAnswer = answer({ title: "Подача вина.", content: "**Подача вина**\n[img:made_up]\n1. Показываем бутылку." });
    const r = await call({ token: "owner", mode: "ref_part", title: " Подача вина ", text: DOC, about: " Порядок подачи. ", others: ["Встреча гостя", "", 5, null, " Расчёт "] });
    expect(r).toEqual({ status: 200, body: { ok: true, content: "**Подача вина**\n1. Показываем бутылку.", lost: 0, title: "Подача вина", model: "test-model" } });
    expect(promptOf()).toBe(REF_PROMPT.part("Подача вина", "Порядок подачи.", ["Встреча гостя", "Расчёт"], DOC, false));
    expect(modelCalls[0].tools).toBeUndefined();
    // остальных глав не больше восьми; не список — значит, их нет; PDF уходит и главе
    await call({ token: "owner", mode: "ref_part", title: "Подача вина", pdfBase64: "QUJD", others: Array.from({ length: 12 }, (_, i) => "Глава " + i) });
    expect(promptOf()).toBe(REF_PROMPT.part("Подача вина", "", Array.from({ length: 8 }, (_, i) => "Глава " + i), "", true));
    expect(modelCalls[1].messages[0].content[1].file.file_data).toBe("data:application/pdf;base64,QUJD");
    await call({ token: "owner", mode: "ref_part", title: "Подача вина", text: DOC, others: "Расчёт" });
    expect(promptOf()).toBe(REF_PROMPT.part("Подача вина", "", [], DOC, false));
  });
  it("ref_part: нет названия или документа — отказ до модели", async () => {
    expect((await call({ token: "owner", mode: "ref_part", text: DOC })).body).toEqual({ ok: false, error: "У главы нет названия." });
    expect((await call({ token: "owner", mode: "ref_part", title: "Подача вина" })).body.error).toBe("Вставь текст документа или прикрепи PDF.");
    expect(modelCalls.length).toBe(0);
  });
  it("новые режимы — только владельцу; PDF больше предела хостинга не принимается", async () => {
    for (const mode of ["ref_plan", "ref_part", "ref_check", "ref_amend"]) {
      expect(await call({ token: "boss", mode, title: "Глава", text: DOC, fixes: "1." })).toEqual({ status: 403, body: { ok: false, error: "Редактор справочника доступен только владельцу" } });
      expect((await call({ token: "staff", mode, title: "Глава", text: DOC })).status).toBe(403);
    }
    expect(await call({ token: "owner", mode: "ref_plan", pdfBase64: "A".repeat(4_300_001) })).toEqual({ status: 413, body: { ok: false, error: "PDF слишком большой: до 3 МБ" } });
    expect(modelCalls.length).toBe(0);
    expect((await call({ token: "owner", mode: "ref_plan", pdfBase64: "A".repeat(4_200_000) })).status).toBe(200);
  });
});

describe("v169 · 3: сервер: выход в интернет", () => {
  beforeEach(() => { globalThis.fetch = serverFetch; process.env.OPENROUTER_API_KEY = "ключ"; delete process.env.OPENROUTER_WEB_MODEL; modelCalls = []; modelStatus = 200; modelAnswer = webAnswer({ title: "Игристое", content: "Охлаждаем до 6–8 °C [1]." }, { cites: CITES }); });
  it("глава по теме с поиском: инструмент поиска, вводная, ответ со ссылками и без следов ссылок в тексте", async () => {
    const r = await call({ token: "owner", mode: "ref_chapter", title: "Подача игристого", text: "Бокал держим за ножку.", web: true });
    expect(r).toEqual({ status: 200, body: { ok: true, content: "Охлаждаем до 6–8 °C.", lost: 0, title: "Игристое", searched: 2, model: "web-model",
      sources: [{ url: "https://wine.example/serving", title: "Подача вина" }, { url: "https://law.example/norms", title: "Нормы" }] } });
    const q = modelCalls[0];
    expect(q.model).toBe("google/gemini-2.5-flash");
    expect(q.tools).toEqual([{ type: "openrouter:web_search", parameters: { engine: "exa", max_results: 5, max_characters: 2000, max_uses: 3 } }]);
    expect(q.max_tokens).toBe(3500);
    expect(q.messages).toEqual([{ role: "system", content: REF_WEB_SYSTEM }, { role: "user", content: REF_PROMPT.chapter("Подача игристого", "Бокал держим за ножку.", false, true) }]);
  });
  it("без web, с PDF или из материала глава пишется без поиска, как раньше", async () => {
    modelAnswer = answer({ title: "Игристое", content: "Текст [1]." });
    const plain = await call({ token: "owner", mode: "ref_chapter", title: "Подача игристого" });
    expect(plain.body).toEqual({ ok: true, content: "Текст [1].", lost: 0, title: "Игристое", model: "test-model" });
    expect(modelCalls[0].tools).toBeUndefined();
    expect(promptOf()).toBe(REF_PROMPT.chapter("Подача игристого", "", false));
    await call({ token: "owner", mode: "ref_chapter", title: "Подача игристого", pdfBase64: "QUJD", web: true });   // свой документ: интернет ему не указ
    expect(modelCalls[1].tools).toBeUndefined();
    expect(promptOf()).toBe(REF_PROMPT.chapter("Подача игристого", "", true));
    await call({ token: "owner", mode: "ref_chapter", title: "Подача игристого", web: "true" });   // только настоящий признак
    expect(modelCalls[2].tools).toBeUndefined();
    for (const mode of ["ref_improve", "ref_shorten"]) { modelAnswer = answer({ content: "Короче." }); await call({ token: "owner", mode, text: LONG, web: true }); expect(modelCalls[modelCalls.length - 1].tools).toBeUndefined(); }
  });
  it("проверить факты: всегда с поиском; ответ — вывод, замечания, ссылки, число поисков", async () => {
    modelAnswer = webAnswer({ summary: "Сверено по трём источникам.", notes: [{ quote: "«десять процентов»", note: "Чаще берут 10–11% [1]." }, { quote: "мимо" }] }, { cites: CITES, searches: 3 });
    const r = await call({ token: "owner", mode: "ref_check", text: LONG, pdfBase64: "QUJD", title: "не в счёт" });
    expect(r).toEqual({ status: 200, body: { ok: true, summary: "Сверено по трём источникам.", notes: [{ quote: "десять процентов", note: "Чаще берут 10–11%." }], searched: 3, model: "web-model",
      sources: [{ url: "https://wine.example/serving", title: "Подача вина" }, { url: "https://law.example/norms", title: "Нормы" }] } });
    expect(modelCalls[0].tools[0].type).toBe("openrouter:web_search");
    expect(modelCalls[0].messages).toEqual([{ role: "system", content: REF_WEB_SYSTEM }, { role: "user", content: REF_PROMPT.check(LONG) }]);   // PDF проверке не нужен
    modelAnswer = webAnswer({ summary: "Расхождений нет.", notes: [] }, { searches: 0 });
    expect((await call({ token: "owner", mode: "ref_check", text: LONG })).body).toEqual({ ok: true, summary: "Расхождений нет.", notes: [], sources: [], searched: 0, model: "web-model" });
  });
  it("проверить факты: мало текста или слишком много — отказ до модели", async () => {
    expect((await call({ token: "owner", mode: "ref_check", text: "мало" })).body).toEqual({ ok: false, error: "Сначала нужен текст главы, хотя бы пара предложений." });
    expect(await call({ token: "owner", mode: "ref_check", text: "т".repeat(6001) })).toEqual({ status: 400, body: { ok: false, error: "Текст длинный для одной проверки. Выдели часть, и ассистент проверит её." } });
    expect(modelCalls.length).toBe(0);
  });
  it("путь с поиском отказал — ответ помечен web: по нему редактор пишет главу без поиска", async () => {
    modelStatus = 500; modelAnswer = { error: { message: "поиск упал" } };
    const r = await call({ token: "owner", mode: "ref_chapter", title: "Подача игристого", web: true });
    expect(r.status).toBe(502);
    expect(r.body.ok).toBe(false);
    expect(r.body.web).toBe(true);
    expect(r.body.error).toMatch(/^Ошибка OpenRouter: /);
    expect(modelCalls.map((x) => x.model)).toEqual(["google/gemini-2.5-flash", "anthropic/claude-sonnet-4.6"]);   // запасная модель тоже спрошена
    const c = await call({ token: "owner", mode: "ref_check", text: LONG });
    expect([c.status, c.body.web]).toEqual([502, true]);
    // ответил не по формату или не уместился — тоже отказ пути с поиском
    modelStatus = 200; modelAnswer = webAnswer("Вот что я нашёл: текст без JSON");
    expect((await call({ token: "owner", mode: "ref_chapter", title: "Подача игристого", web: true })).body).toEqual({ ok: false, error: "Ассистент ответил не по формату. Попробуй ещё раз.", web: true });
    modelAnswer = webAnswer({ title: "Т", content: "Обрыв" }, { finish: "length" });
    expect((await call({ token: "owner", mode: "ref_chapter", title: "Подача игристого", web: true })).body).toMatchObject({ ok: false, web: true });
    // без поиска пометки нет
    modelAnswer = answer("Текст без JSON");
    expect((await call({ token: "owner", mode: "ref_chapter", title: "Подача игристого" })).body).toEqual({ ok: false, error: "Ассистент ответил не по формату. Попробуй ещё раз." });
  });
  it("своя модель для поиска — из OPENROUTER_WEB_MODEL, как у Наставника", async () => {
    process.env.OPENROUTER_WEB_MODEL = "openai/gpt-web";
    await call({ token: "owner", mode: "ref_check", text: LONG });
    expect(modelCalls[0].model).toBe("openai/gpt-web");
    delete process.env.OPENROUTER_WEB_MODEL;
  });
  it("поправить по замечаниям: текст и замечания в просьбе, без поиска; картинки главы целы; без замечаний — отказ", async () => {
    const src = LONG + "\n[photo:rp:a1|Бокал айриш]";
    modelAnswer = answer({ content: "Раф готовим на сливках 10–11%." });
    const r = await call({ token: "owner", mode: "ref_amend", text: src, fixes: " 1. «десять процентов»: чаще 10–11%. " });
    expect(r).toEqual({ status: 200, body: { ok: true, content: "Раф готовим на сливках 10–11%.\n\n[photo:rp:a1|Бокал айриш]", lost: 1, model: "test-model" } });
    expect(promptOf()).toBe(REF_PROMPT.amend(src, "1. «десять процентов»: чаще 10–11%."));
    expect(modelCalls[0].tools).toBeUndefined();
    expect((await call({ token: "owner", mode: "ref_amend", text: src })).body).toEqual({ ok: false, error: "Отметь хотя бы одно замечание." });
    await call({ token: "owner", mode: "ref_amend", text: src, fixes: "з".repeat(5000) });
    expect(promptOf()).toBe(REF_PROMPT.amend(src, "з".repeat(3000)));
  });
  it("у режимов справочника свой счёт обращений: 80 в час; прежние режимы считаются отдельно", async () => {
    modelAnswer = answer({ content: "Короче." });
    for (let i = 0; i < 80; i++) expect((await call({ token: "limit", mode: "ref_improve", text: LONG })).status, "обращение " + (i + 1)).toBe(200);
    expect(await call({ token: "limit", mode: "ref_improve", text: LONG })).toEqual({ status: 429, body: { ok: false, error: "Слишком много запросов подряд — попробуй через час" } });
    expect((await call({ token: "limit", mode: "ref_plan", text: DOC })).status).toBe(429);
    expect(modelCalls.length).toBe(80);
    modelAnswer = answer({ content: "Текст урока." });
    expect((await call({ token: "limit", mode: "improve", role: "core", text: LONG })).status).toBe(200);   // редактор контента — свой счёт
    const api = rd("api/lesson-assist.js");
    expect(api).toContain('isRef ? rateLimit("ref:" + token, 80, 3600_000) : rateLimit("lesson:" + token, 40, 3600_000)');
    expect(api).toContain('import { webCall } from "./_web.js";');
    expect(api.indexOf("if (isRef && !emp.is_admin)")).toBeLessThan(api.indexOf("await webCall("));   // чужой запрос поиск не тратит
  });
});

// ── редактор: обращение к ассистенту ───────────────────────────────────────────────────────────────────────
describe("v169 · 4: обращение из редактора (ui/ref-assist.jsx, refAiCall)", () => {
  let sent = [], reply = null, status = 200, down = false;
  beforeEach(() => {
    for (const k of Object.keys(store0)) delete store0[k];
    phone.setItem("sa_session_token", "owner"); sent = []; status = 200; down = false; reply = { ok: true, title: "Глава", content: "Текст.", lost: 0 };
    globalThis.fetch = async (url, init = {}) => { if (down) throw new Error("нет сети"); sent.push([String(url), JSON.parse(init.body)]); return { ok: status === 200, status, json: async () => { if (reply === "мусор") throw new Error("не JSON"); return reply; } }; };
  });
  it("новые поля уходят, только когда они есть: поиск, «что входит», остальные главы, замечания", async () => {
    await refAiCall("ref_chapter", { topic: "Раф" });
    expect(sent[0][1]).toEqual({ token: "owner", mode: "ref_chapter", title: "Раф", text: "", pdfBase64: "" });
    await refAiCall("ref_chapter", { topic: "Раф", text: "Заметки", web: true });
    expect(sent[1][1]).toEqual({ token: "owner", mode: "ref_chapter", title: "Раф", text: "Заметки", pdfBase64: "", web: true });
    await refAiCall("ref_part", { topic: "Подача вина", text: DOC, about: "Порядок подачи.", others: ["Расчёт"] });
    expect(sent[2][1]).toEqual({ token: "owner", mode: "ref_part", title: "Подача вина", text: DOC, pdfBase64: "", about: "Порядок подачи.", others: ["Расчёт"] });
    await refAiCall("ref_part", { topic: "Подача вина", pdfBase64: "QUJD", others: [] });
    expect(sent[3][1]).toEqual({ token: "owner", mode: "ref_part", title: "Подача вина", text: "", pdfBase64: "QUJD" });
    reply = { ok: true, content: "Поправлено." };
    await refAiCall("ref_amend", { text: LONG, fixes: "1. Замечание." }, LONG);
    expect(sent[4][1]).toEqual({ token: "owner", mode: "ref_amend", title: "", text: LONG, pdfBase64: "", fixes: "1. Замечание." });
  });
  it("план: главы чистятся и в редакторе; глав нет — отказ словами", async () => {
    reply = { ok: true, chapters: [{ title: "1. Встреча гостя.", about: " Как встречаем. " }, { title: "встреча гостя" }, { title: "Подача вина" }], model: "m" };
    expect(await refAiCall("ref_plan", { text: DOC })).toEqual({ ok: true, chapters: [{ title: "Встреча гостя", about: "Как встречаем." }, { title: "Подача вина", about: "" }] });
    reply = { ok: true, chapters: [] };
    expect(await refAiCall("ref_plan", { text: DOC })).toEqual({ ok: false, error: "Ассистент не нашёл в документе глав. Попробуй ещё раз." });
  });
  it("проверка фактов: вывод, замечания, ссылки и число поисков; пустой ответ — отказ", async () => {
    reply = { ok: true, summary: "Сверено.", notes: [{ quote: "«при 20»", note: "Нужно 16–18." }], sources: [{ url: "https://a.ru/x", title: "А" }, { url: "javascript:alert(1)" }], searched: "2" };
    expect(await refAiCall("ref_check", { text: LONG })).toEqual({ ok: true, summary: "Сверено.", notes: [{ quote: "при 20", note: "Нужно 16–18." }], sources: [{ url: "https://a.ru/x", title: "А" }], searched: 2 });
    reply = { ok: true, summary: "", notes: [] };
    expect(await refAiCall("ref_check", { text: LONG })).toEqual({ ok: false, error: "Ассистент ответил пусто. Попробуй ещё раз." });
  });
  it("глава с поиском приносит ссылки; глава плана — название; без поиска ссылок в ответе нет", async () => {
    reply = { ok: true, title: " Игристое ", content: "Текст.\n[img:made_up]", lost: 0, sources: [{ url: "https://a.ru/x" }, { url: "нет" }], searched: 1 };
    expect(await refAiCall("ref_chapter", { topic: "Игристое", web: true })).toEqual({ ok: true, content: "Текст.", lost: 0, title: "Игристое", sources: [{ url: "https://a.ru/x", title: "" }], searched: 1 });
    reply = { ok: true, title: "Подача вина", content: "Текст.\n[img:made_up]", lost: 0 };
    expect(await refAiCall("ref_part", { topic: "Подача вина", text: DOC })).toEqual({ ok: true, content: "Текст.", lost: 0, title: "Подача вина" });
    expect("sources" in (await refAiCall("ref_chapter", { topic: "Игристое" }))).toBe(false);
  });
  it("отказ пути с поиском виден редактору (web); чужой отказ и отказ без поиска — нет", async () => {
    status = 502; reply = { ok: false, error: "Ошибка OpenRouter: поиск упал", web: true };
    expect(await refAiCall("ref_chapter", { topic: "Раф", web: true })).toEqual({ ok: false, error: "Ошибка OpenRouter: поиск упал", web: true });
    status = 504; reply = "мусор";   // хостинг оборвал долгий поиск: ответ не от нашей функции
    expect(await refAiCall("ref_chapter", { topic: "Раф", web: true })).toEqual({ ok: false, error: "Ассистент не успел ответить. Попробуй ещё раз.", web: true });
    expect(await refAiCall("ref_chapter", { topic: "Раф" })).toEqual({ ok: false, error: "Ассистент не успел ответить. Попробуй ещё раз." });
    status = 403; reply = { ok: false, error: "Редактор справочника доступен только владельцу" };
    expect(await refAiCall("ref_chapter", { topic: "Раф", web: true })).toEqual({ ok: false, error: "Редактор справочника доступен только владельцу" });
    status = 413; reply = "мусор";
    expect(await refAiCall("ref_plan", { pdfBase64: "QUJD", web: true })).toEqual({ ok: false, error: "Файл слишком большой для сервера. Сожми PDF или вставь текст." });
    down = true;
    expect(await refAiCall("ref_check", { text: LONG })).toEqual({ ok: false, error: "Нет связи с ассистентом." });
  });
  it("ответил не ассистент, а хостинг: причина словами и с кодом; предел PDF — честные 3 МБ", () => {
    expect(refHttpErr(404)).toBe("Ассистент ещё не развёрнут на сервере.");
    expect(refHttpErr(413)).toBe("Файл слишком большой для сервера. Сожми PDF или вставь текст.");
    expect(refHttpErr(504)).toBe("Ассистент не успел ответить. Попробуй ещё раз.");
    expect(refHttpErr(403)).toBe("Ассистент не ответил: сервер вернул код 403. Попробуй ещё раз.");
    expect(refHttpErr(200)).toBe("Ассистент не ответил. Попробуй ещё раз.");
    expect(REF_AI_PDF_MAX).toBe(3 * 1024 * 1024);
    expect(REF_PDF_BIG).toBe("PDF больше 3 МБ: сервер такой не примет. Сожми файл или вставь текст.");
    // тот же предел у редактора контента и у «О нас»: файл больше трёх мегабайт до ассистента не доходил
    for (const f of ["ui/content-editor.jsx", "ui/concept.jsx"]) { const src = rd(f); expect(src, f).toContain("file.size > 3 * 1024 * 1024"); expect(src, f).toContain("PDF больше 3 МБ: сервер такой не примет."); expect(src, f).not.toContain("10 МБ"); }
    expect(rd("api/lesson-assist.js")).toContain('if (b64.length > 4_300_000) return res.status(413).json({ ok: false, error: "PDF слишком большой: до 3 МБ" });');
  });
});

// ── «Главы из документа»: работа без React ───────────────────────────────────────────────────────────────────
describe("v169 · 5: работа «Главы из документа» (ui/ref-split.jsx, makeSplitJob)", () => {
  let asked = [], bad = new Set(), saved = [], saveBad = new Set(), gate = null, states = [];
  const defer = () => { let go; const p = new Promise((r) => { go = r; }); return { p, go }; };
  const PLAN = [{ title: "Встреча гостя", about: "Как встречаем." }, { title: "Подача вина", about: "Порядок подачи." }, { title: "Расчёт", about: "Счёт и сдача." }, { title: "Прощание", about: "Проводы." }];
  const save = async (c, sec) => { if (saveBad.has(c.title)) return { ok: false, error: "Не записалось: нет связи. Попробуй ещё раз." }; saved.push({ ...c, sec }); return { ok: true, id: "id:" + c.title }; };
  const job = () => { const j = makeSplitJob(save, (s) => states.push(s ? s.phase : null)); j.open({ id: "rs-1", title: "Стандарты" }); j.patch({ text: DOC }); return j; };
  const planned = async (existing = ["Встреча гостя"]) => { const j = job(); await j.plan(existing); return j; };
  const st = (j) => j.st.rows.map((r) => r.state || "-").join(",");
  beforeEach(() => {
    for (const k of Object.keys(store0)) delete store0[k];
    phone.setItem("sa_session_token", "owner"); asked = []; bad = new Set(); saved = []; saveBad = new Set(); gate = null; states = [];
    globalThis.fetch = async (url, init = {}) => {
      const b = JSON.parse(init.body); asked.push(b);
      if (gate) await gate.p;
      const r = b.mode === "ref_plan" ? { ok: true, chapters: PLAN } : bad.has(b.title) ? { ok: false, error: "Ассистент не ответил. Попробуй ещё раз." } : { ok: true, title: b.title, content: "Текст главы «" + b.title + "»." };
      return { ok: true, status: 200, json: async () => r };
    };
  });
  it("открыть: форма для раздела; без документа и с коротким текстом план не просится", async () => {
    const j = makeSplitJob(save);
    expect(j.st).toBeNull();
    j.open({ id: "rs-1", title: "Стандарты" });
    expect(j.st).toEqual({ sec: "rs-1", secTitle: "Стандарты", phase: "form", text: "", pdf: null, err: "", rows: [], stopped: false, halting: false });
    await j.plan();
    expect([j.st.phase, j.st.err]).toEqual(["form", "Вставь текст документа или прикрепи PDF."]);
    j.patch({ text: "Короткая заметка.", err: "" });
    await j.plan();
    expect(j.st.err).toBe("Текста мало для нескольких глав. Одну главу ассистент соберёт в редакторе главы.");
    expect(asked.length).toBe(0);
    j.close();
    expect(j.st).toBeNull();
  });
  it("план: главы по порядку; та, что в разделе уже есть, без галочки; ассистент не ответил — форма с причиной", async () => {
    const j = await planned();
    expect(asked).toEqual([{ token: "owner", mode: "ref_plan", title: "", text: DOC, pdfBase64: "" }]);
    expect(j.st.phase).toBe("plan");
    expect(j.st.rows).toEqual(PLAN.map((c, i) => ({ ...c, on: i > 0, dup: i === 0, state: "", err: "", content: "", id: "" })));
    expect(splitCount(j.st.rows)).toEqual({ on: 3, done: 0, left: 3 });
    expect(states).toEqual(["form", "form", "planning", "plan"]);
    const k = job();
    globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => ({ ok: false, error: "Ассистент не ответил — модель молчит" }) });
    await k.plan();
    expect([k.st.phase, k.st.err, k.st.text]).toEqual(["form", "Ассистент не ответил — модель молчит", DOC]);
  });
  it("главы пишутся по одной и сразу записываются: в просьбе название, «что входит», остальные отмеченные главы", async () => {
    const j = await planned();
    j.setRow(2, { title: " Расчёт гостя " });      // владелец поправил название
    j.setRow(3, (r) => ({ on: !r.on }));           // и снял галочку с последней
    await j.run();
    expect(asked.slice(1)).toEqual([
      { token: "owner", mode: "ref_part", title: "Подача вина", text: DOC, pdfBase64: "", about: "Порядок подачи.", others: ["Расчёт гостя"] },
      { token: "owner", mode: "ref_part", title: "Расчёт гостя", text: DOC, pdfBase64: "", about: "Счёт и сдача.", others: ["Подача вина"] }]);
    expect(saved).toEqual([{ title: "Подача вина", content: "Текст главы «Подача вина».", after: "", before: "", sec: "rs-1" },
      { title: "Расчёт гостя", content: "Текст главы «Расчёт гостя».", after: "id:Подача вина", before: "", sec: "rs-1" }]);
    expect([j.st.phase, j.st.stopped, st(j)]).toEqual(["done", false, "-,done,done,-"]);
    expect(j.st.rows[1]).toMatchObject({ id: "id:Подача вина", content: "", err: "" });
    expect(splitCount(j.st.rows)).toEqual({ on: 2, done: 2, left: 0 });
    expect(states.slice(-1)).toEqual(["done"]);
    expect(states.filter((s) => s === "writing").length).toBeGreaterThan(2);   // экран видел ход работы
  });
  it("без отмеченных глав и с пустым названием работа не начинается", async () => {
    const j = await planned();
    for (const i of [1, 2, 3]) j.setRow(i, { on: false });
    await j.run();
    expect([j.st.phase, j.st.err]).toEqual(["plan", "Отметь хотя бы одну главу."]);
    j.setRow(1, { on: true, title: " я " });
    await j.run();
    expect([j.st.phase, j.st.err]).toEqual(["plan", "У главы нет названия."]);
    expect(asked.length).toBe(1);
    expect(saved).toEqual([]);
  });
  it("одна глава не написалась — остальные в разделе; «Дописать остальные» пишет только её, и она встаёт на своё место", async () => {
    const j = await planned();
    bad.add("Подача вина");
    await j.run();
    expect([j.st.phase, j.st.stopped, st(j)]).toEqual(["done", false, "-,fail,done,done"]);
    expect(j.st.rows[1].err).toBe("Ассистент не ответил. Попробуй ещё раз.");
    expect(saved.map((x) => [x.title, x.after, x.before])).toEqual([["Расчёт", "", ""], ["Прощание", "id:Расчёт", ""]]);
    expect(splitCount(j.st.rows)).toEqual({ on: 3, done: 2, left: 1 });
    bad.clear();
    const n = asked.length;
    await j.run();
    expect(asked.slice(n).map((x) => x.title)).toEqual(["Подача вина"]);
    expect(saved[2]).toMatchObject({ title: "Подача вина", after: "", before: "id:Расчёт" });   // перед следующей готовой: порядок документа
    expect(st(j)).toBe("-,done,done,done");
  });
  it("две неудачи подряд — работа останавливается сама, третья глава не начата", async () => {
    expect(SPLIT_STOP_AFTER).toBe(2);
    const j = await planned();
    bad.add("Подача вина"); bad.add("Расчёт"); bad.add("Прощание");
    await j.run();
    expect([j.st.phase, j.st.stopped, st(j)]).toEqual(["done", "fail", "-,fail,fail,-"]);
    expect(asked.length).toBe(3);   // план и две главы
    expect(saved).toEqual([]);
    // неудачи не подряд работу не останавливают
    const k = await planned();
    bad = new Set(["Подача вина", "Прощание"]);
    await k.run();
    expect([k.st.stopped, st(k)]).toEqual([false, "-,fail,done,fail"]);
  });
  it("глава написана, но не записалась: текст остаётся, со второго раза ассистента не зовём", async () => {
    const j = await planned();
    saveBad.add("Расчёт");
    await j.run();
    expect(st(j)).toBe("-,done,fail,done");
    expect(j.st.rows[2]).toMatchObject({ content: "Текст главы «Расчёт».", err: "Не записалось: нет связи. Попробуй ещё раз." });
    saveBad.clear();
    const n = asked.length;
    await j.run();
    expect(asked.length).toBe(n);
    expect(saved[2]).toMatchObject({ title: "Расчёт", content: "Текст главы «Расчёт».", after: "id:Подача вина", before: "id:Прощание" });
    expect(j.st.rows[2]).toMatchObject({ state: "done", content: "", id: "id:Расчёт" });
  });
  it("«Остановить»: текущая глава дописывается и записывается, остальные не начинаются; потом можно дописать", async () => {
    const j = await planned();
    gate = defer();
    const run = j.run();
    await Promise.resolve();
    expect([j.st.phase, st(j)]).toEqual(["writing", "-,busy,wait,wait"]);
    j.halt();
    expect(j.st.halting).toBe(true);
    gate.go(); gate = null;
    await run;
    expect([j.st.phase, j.st.stopped, j.st.halting, st(j)]).toEqual(["done", "user", false, "-,done,-,-"]);
    expect(saved.map((x) => x.title)).toEqual(["Подача вина"]);
    await j.run();
    expect([j.st.stopped, st(j)]).toEqual([false, "-,done,done,done"]);
  });
  it("во время работы второй запуск и новый план не начинаются; закрыли — написанное после этого не записывается", async () => {
    const j = await planned();
    gate = defer();
    const run = j.run();
    await Promise.resolve();
    await j.run();
    await j.plan();
    expect(asked.length).toBe(2);
    j.close();
    gate.go(); gate = null;
    await run;
    expect(j.st).toBeNull();
    expect(saved).toEqual([]);
    // экран редактора закрыт (dispose): работа тоже останавливается, экран больше не тревожат
    const k = await planned();
    const before = states.length;
    gate = defer();
    const r2 = k.run();
    await Promise.resolve();
    k.dispose();
    gate.go(); gate = null;
    await r2;
    expect(saved).toEqual([]);
    expect(states.length).toBe(before + 2);   // «пишу» и «глава в работе» — и всё
  });
});

describe("v169 · 5: блок «Главы из документа» (ui/ref-split.jsx, RefSplit)", () => {
  const jobOf = (st) => ({ st, open: noop, close: noop, patch: noop, pickPdf: noop, plan: noop, setRow: noop, run: noop, halt: noop });
  const SEC = { id: "rs-1", title: "Стандарты", lessons: [{ id: "rc-1", title: "Встреча гостя" }] };
  const base = { sec: "rs-1", secTitle: "Стандарты", phase: "form", text: "", pdf: null, err: "", rows: [], stopped: false, halting: false };
  const row = (title, more = {}) => ({ title, about: "О чём глава «" + title + "».", on: true, dup: false, state: "", err: "", content: "", id: "", ...more });
  const view = (st, a11y = false) => R(h(RefSplit, { a11y, job: jobOf(st), sec: SEC, ui: uiOf(a11y) }));
  it("закрыто: кнопка «Главы из документа» и подсказка", () => {
    const html = view(null);
    expect(html).toContain('data-rs-open=""');
    expect(text(html)).toContain("Главы из документа");
    expect(text(html)).toContain("Большой регламент ассистент разложит на несколько глав.");
    expect(html).not.toContain("data-rs=");
  });
  it("форма: документ, PDF, пределы; без документа «Предложить главы» не нажимается; длинный текст — честный счёт", () => {
    const html = view(base);
    expect(html).toContain('data-rs="form"');
    const t = text(html);
    for (const w of ["Вставь документ целиком или прикрепи PDF.", "одна тема, одна глава", "Список можно поправить до того, как он начнёт писать.", "Текст до 60 000 знаков, PDF до 3 МБ.", "Прикрепить PDF", "Предложить главы", "Отмена"]) expect(t, w).toContain(w);
    expect(html).toMatch(/data-rs-plan=""[^>]*disabled=""/);
    expect(view({ ...base, text: DOC })).not.toMatch(/data-rs-plan=""[^>]*disabled=""/);
    expect(view({ ...base, pdf: { name: "Стандарт сервиса 2026 полный.pdf", b64: "QUJD" } })).not.toMatch(/data-rs-plan=""[^>]*disabled=""/);
    expect(text(view({ ...base, pdf: { name: "Стандарт сервиса 2026 полный.pdf", b64: "QUJD" } }))).toContain("PDF до 3 МБ.Стандарт сервиса 2026 поПредложить главы");   // имя файла — первые 24 знака
    const long = view({ ...base, text: "т".repeat(60001) });
    expect(text(long)).toContain("В тексте 60 001 знаков, а влезает 60 000. Дай документ частями.".replace("60 001", (60001).toLocaleString("ru-RU")));
    expect(long).toMatch(/data-rs-plan=""[^>]*disabled=""/);
    expect(text(view({ ...base, phase: "planning", text: DOC }))).toContain("Читаю документ…");
    expect(text(view({ ...base, err: "Ассистент не ответил. Попробуй ещё раз." }))).toContain("Ассистент не ответил. Попробуй ещё раз.");
  });
  it("план: названия в полях, «что войдёт», галочки, пометка о повторе; кнопка считает отмеченные", () => {
    const html = view({ ...base, phase: "plan", text: DOC, rows: [row("Встреча гостя", { on: false, dup: true }), row("Подача вина"), row("Расчёт")] });
    expect(html).toContain('data-rs="plan"');
    expect([...html.matchAll(/data-rs-row="(\d)" data-rs-on="(\d)"/g)].map((m) => m[1] + m[2])).toEqual(["00", "11", "21"]);
    expect([...html.matchAll(/data-rs-title=""[^>]*value="([^"]*)"/g)].map((m) => m[1])).toEqual(["Встреча гостя", "Подача вина", "Расчёт"]);
    const t = text(html);
    for (const w of ["Ассистент предлагает такие главы. Сними галочку с лишних и поправь названия.", "О чём глава «Подача вина».", "такая глава уже есть в разделе", "Написать главы (2)",
      "Главы пишутся по одной и сразу ложатся в раздел скрытыми: команда их не увидит, пока ты не проверишь и не покажешь."]) expect(t, w).toContain(w);
    expect(text(view({ ...base, phase: "plan", rows: [row("Подача вина")] }))).toContain("Документ про одну тему: выйдет одна глава. Название можно поправить.");
    expect(text(view({ ...base, phase: "plan", rows: [row("Подача вина")] }))).toContain("Написать главу");
    expect(view({ ...base, phase: "plan", rows: [row("Подача вина", { on: false })] })).toMatch(/data-rs-run=""[^>]*disabled=""/);
    // PDF уходит заново с каждой главой: об этом сказано до начала работы; у текста такой строки нет
    expect(text(view({ ...base, phase: "plan", pdf: { name: "doc.pdf", b64: "QUJD" }, rows: [row("Подача вина")] }))).toContain("PDF уходит ассистенту заново с каждой главой. На мобильном интернете лучше подключиться к Wi-Fi.");
    expect(html).not.toContain("data-rs-pdf-note");
  });
  it("работа: какая глава по счёту пишется, «Остановить»; итог: сколько в разделе, что с ними делать, чем кончилось", () => {
    const rows = [row("Встреча гостя", { on: false, dup: true }), row("Подача вина", { state: "done", id: "a" }), row("Расчёт", { state: "busy" }), row("Прощание", { state: "wait" })];
    const w = view({ ...base, phase: "writing", rows });
    expect(text(w)).toContain("Пишу главу 2 из 3…");
    expect([...w.matchAll(/data-rs-item="([a-z]+)"/g)].map((m) => m[1])).toEqual(["done", "busy", "wait"]);
    for (const s of ["в разделе, скрыта", "пишется", "в очереди", "Остановить", "Новые главы скрыты: команда их не видит. Открой каждую, проверь и нажми в ней «Показать главу»."]) expect(text(w), s).toContain(s);
    expect(text(view({ ...base, phase: "writing", halting: true, rows }))).toContain("Пишу главу 2 из 3… Допишу её и остановлюсь.");
    expect(view({ ...base, phase: "writing", halting: true, rows })).toMatch(/data-rs-stop=""[^>]*disabled=""/);
    const all = view({ ...base, phase: "done", rows: [row("Подача вина", { state: "done" }), row("Расчёт", { state: "done" })] });
    expect(all).toContain('data-rs-done="all"');
    expect(text(all)).toContain("Готово: в разделе 2 новые главы.");
    expect(all).not.toContain("data-rs-more");
    expect(text(view({ ...base, phase: "done", rows: [row("Подача вина", { state: "done" })] }))).toContain("Готово: глава в разделе.");
    const part = view({ ...base, phase: "done", rows: [row("Подача вина", { state: "fail", err: "Ассистент не ответил. Попробуй ещё раз." }), row("Расчёт", { state: "done" }), row("Прощание", { state: "fail", content: "Текст.", err: "Не записалось: нет связи. Попробуй ещё раз." })] });
    expect(part).toContain('data-rs-done="part"');
    for (const s of ["В разделе 1 новая глава из 3.", "не написана", "Ассистент не ответил. Попробуй ещё раз.", "не записалась", "Не записалось: нет связи. Попробуй ещё раз.", "Дописать остальные (2)", "Готово"]) expect(text(part), s).toContain(s);
    expect(text(view({ ...base, phase: "done", stopped: "fail", rows: [row("А: глава", { state: "fail", err: "нет" }), row("Б: глава", { state: "fail", err: "нет" }), row("В: глава")] })))
      .toContain("Пока ни одна глава не написана. Ассистент не отвечает: остановился после двух неудач подряд.");
    expect(text(view({ ...base, phase: "done", stopped: "user", rows: [row("А: глава", { state: "done" }), row("Б: глава")] }))).toContain("В разделе 1 новая глава из 2. Остановлено.");
    expect(text(view({ ...base, phase: "done", stopped: "user", rows: [row("А: глава", { state: "done" }), row("Б: глава")] }))).toContain("не начата");
  });
  it("работа идёт в другом разделе — здесь сказано где, начать нельзя; чужая форма или итог не мешают", () => {
    const away = view({ ...base, sec: "rs-2", secTitle: "Бар", phase: "writing", rows: [row("Глава", { state: "busy" })] });
    expect(text(away)).toBe("Ассистент сейчас раскладывает документ в разделе «Бар». Когда закончит, можно будет и здесь.");
    expect(away).not.toContain("data-rs-open");
    expect(text(view({ ...base, sec: "rs-2", secTitle: "Бар", phase: "planning" }))).toContain("в разделе «Бар»");
    for (const phase of ["form", "plan", "done"]) expect(view({ ...base, sec: "rs-2", phase }), phase).toContain('data-rs-open=""');
  });
  it("светлая тема рисуется; в файле нет мелкого шрифта, тире между словами, точек-разделителей и значков-эмодзи", () => {
    expect(view({ ...base, phase: "plan", rows: [row("Подача вина")] }, true)).toContain('data-rs="plan"');
    for (const f of ["ui/ref-split.jsx", "ui/ref-assist.jsx"]) {
      const src = code(rd(f));
      for (const m of src.matchAll(/fontSize: (\d+(?:\.\d+)?)/g)) expect(Number(m[1]), f + " " + m[0]).toBeGreaterThanOrEqual(11.5);
      expect(src, f).not.toMatch(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/);
      expect(src, f).not.toContain("·");
      expect(src, f).not.toMatch(/\p{Emoji_Presentation}/u);
    }
  });
});

// ── редактор: глава ложится в раздел скрытой и на своё место ────────────────────────────────────────────────────
describe("v169 · 6: готовая глава в разделе (ui/ref-editor.jsx, addHiddenChapter)", () => {
  let srv;
  const lessons = (sec) => refEditTree(RE_BASE, refItemsNow()).find((s) => s.id === sec).lessons;
  beforeEach(async () => {
    for (const k of Object.keys(store0)) delete store0[k];
    setPhotoBackend(memoryBackend()); _resetLessonPhotos(); _resetRefBook();
    srv = makeServer({ today: "2026-11-16", rest: "Два моря, Океан", people: [{ id: "u-roman", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "owner", is_admin: true }], tok: { tr: "u-roman" }, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false });
    globalThis.fetch = async (u, init = {}) => ({ ok: true, status: 200, json: async () => srv.rpc(String(u).split("/rpc/")[1], JSON.parse(init.body || "{}")) });
    phone.setItem("sa_session_token", "tr");
    srv.rpc("ref_book_save", { p_token: "tr", p_items: [{ id: "rs-1", kind: "sec", parent: "", title: "Стандарты", sub: null, body: null, hidden: false, sort: null }], p_del: [] });
    await loadRefBook(true);
  });
  it("глава — своя, скрытая, последняя в разделе; следующая встаёт за ней", async () => {
    const a = await addHiddenChapter({ title: "  Подача вина  ", content: "**Подача вина**\n1. Показываем бутылку." }, "rs-1");
    expect(a.ok).toBe(true);
    expect(a.id).toMatch(/^rc-/);
    const b = await addHiddenChapter({ title: "Расчёт", content: "Текст.", after: a.id }, "rs-1");
    expect(lessons("rs-1").map((l) => [l.title, l.own, l.hidden, l.content])).toEqual([["Подача вина", true, true, "**Подача вина**\n1. Показываем бутылку."], ["Расчёт", true, true, "Текст."]]);
    const onServer = Object.values(srv.S.rb.items).filter((x) => x.kind === "ch").sort((p, q) => p.sort - q.sort).map((x) => [x.id, x.parent, x.hidden, x.sort]);
    expect(onServer).toEqual([[a.id, "rs-1", true, 10], [b.id, "rs-1", true, 20]]);
  });
  it("место — как в документе: после названной главы, иначе перед названной, иначе последней", async () => {
    const a = await addHiddenChapter({ title: "Первая", content: "Т." }, "rs-1");
    const c = await addHiddenChapter({ title: "Третья", content: "Т.", after: a.id }, "rs-1");
    await addHiddenChapter({ title: "Вторая", content: "Т.", after: a.id }, "rs-1");            // дописана позже — встала за первой
    await addHiddenChapter({ title: "Нулевая", content: "Т.", before: a.id }, "rs-1");          // перед первой
    await addHiddenChapter({ title: "Последняя", content: "Т.", after: "rc-нет", before: "rc-нет" }, "rs-1");
    await addHiddenChapter({ title: "Перед третьей", content: "Т.", after: "rc-нет", before: c.id }, "rs-1");
    expect(lessons("rs-1").map((l) => l.title)).toEqual(["Нулевая", "Первая", "Вторая", "Перед третьей", "Третья", "Последняя"]);
    expect(lessons("rs-1").every((l) => l.hidden && l.own)).toBe(true);
  });
  it("в штатном разделе новая глава встаёт после штатных, их не трогая; раздела нет — причина словами", async () => {
    const before = lessons("coffee").map((l) => l.id);
    const a = await addHiddenChapter({ title: "Раф", content: "Текст про раф." }, "coffee");
    expect(lessons("coffee").map((l) => l.id)).toEqual([...before, a.id]);
    expect(Object.values(srv.S.rb.items).filter((x) => x.kind === "ch").map((x) => x.id)).toEqual([a.id]);   // штатным главам строк не писали
    expect(await addHiddenChapter({ title: "Глава", content: "Текст." }, "rs-нет")).toEqual({ ok: false, error: "Раздела больше нет: его убрали, пока ассистент писал." });
    globalThis.fetch = async () => { throw new Error("нет сети"); };
    expect(await addHiddenChapter({ title: "Глава", content: "Текст." }, "rs-1")).toEqual({ ok: false, error: "Не записалось: нет связи. Попробуй ещё раз." });
  });
  it("блок стоит в экране раздела под «Новая глава»; работа живёт на уровне экрана редактора", () => {
    const src = rd("ui/ref-editor.jsx");
    expect(src).toContain('import { RefSplit, useRefSplit } from "./ref-split";');
    expect(src).toContain("const split = useRefSplit(addHiddenChapter);");
    expect(src).toContain('<RefSplit a11y={a11y} job={split} sec={sec} ui={{ input, primary, G, txt, muted, gold: a11y ? "#7A5D2A" : GOLD, brd, TN }} />');
    expect(src.indexOf("<RefSplit ")).toBeGreaterThan(src.indexOf('data-re-new-ch=""'));
    expect(src.indexOf("<RefSplit ")).toBeLessThan(src.indexOf("// ═════ ГЛАВА ═════"));
    expect(src.indexOf("const split = useRefSplit(")).toBeLessThan(src.indexOf('if (shown === "list")'));   // до первого выхода из экрана: правило хуков
    for (const f of ["App.jsx", "ui/ReferenceSection.jsx", "lib/ref-book.js", "ui/search.jsx"]) expect(rd(f), f).not.toMatch(/ref-split/);   // грузится вместе с редактором
    // главы из документа приходят скрытыми: показать главу можно сразу сверху, рядом с пометкой
    expect(src).toContain('<button type="button" data-re-ch-show="" data-lens-btn="soft" disabled={busy} onClick={hideCh}');
    expect(src).toContain("Глава скрыта: команда её не видит.");
  });
});

// ── блок «Ассистент»: поиск и проверка фактов ───────────────────────────────────────────────────────────────
describe("v169 · 7: блок «Ассистент» (ui/ref-assist.jsx): интернет", () => {
  const panel = (p = {}) => R(h(RefAssist, { T: S, a11y: false, title: "", body: "", getSel: () => [0, 0], onTake: noop, ui: uiOf(false), ...p }));
  it("пятая кнопка «Проверить факты»: без текста закрыта, с текстом открыта; подсказка говорит и о проверке", () => {
    const html = panel();
    expect([...html.matchAll(/data-ra-btn="([^"]+)"/g)].map((m) => m[1])).toEqual(["doc", "topic", "improve", "shorten", "check"]);
    expect(text(html)).toContain("Проверить факты");
    expect(html).toMatch(/data-ra-btn="check"[^>]*disabled=""/);
    const full = panel({ title: "Раф", body: LONG });
    expect(full).not.toMatch(/data-ra-btn="check"[^>]*disabled=""/);
    expect(text(full)).toContain("Выдели несколько строк, и ассистент улучшит, сократит или проверит только их.");
    expect(R(h(RefAssist, { T: A, a11y: true, title: "Раф", body: LONG, getSel: () => [0, 0], onTake: noop, ui: uiOf(true) }))).toContain('data-ra-btn="check"');
  });
  it("строка источников: по одной ссылке на сайт, через запятую; пусто — строки нет", () => {
    const html = R(h(RefSources, { label: "Источники", list: [{ url: "https://www.wine.example/a", title: "А" }, { url: "https://wine.example/b" }, { url: "https://law.example/c" }], muted: "#999", gold: "#C8A96E" }));
    expect(text(html)).toBe("Источники: wine.example, law.example");
    expect([...html.matchAll(/data-ra-src="([^"]+)"/g)].map((m) => m[1])).toEqual(["https://www.wine.example/a", "https://law.example/c"]);
    expect(html).toContain('data-ra-sources="2"');
    expect(R(h(RefSources, { label: "Источники", list: [], muted: "#999", gold: "#C8A96E" }))).toBe("");
  });
  it("«Глава по теме»: сначала с поиском; поиск не ответил — та же глава без него и причина под ответом", () => {
    const src = rd("ui/ref-assist.jsx");
    expect(src).toContain('const web = mode === "topic";');
    expect(src).toContain('let r = await refAiCall("ref_chapter", { topic, text, pdfBase64: pdf, web });');
    expect(src).toContain("if (!r.ok && r.web && web) {");
    expect(src).toContain('r = await refAiCall("ref_chapter", { topic, text });');
    expect(src).toContain("if (r.ok) r = { ...r, noWeb: dot(why).slice(0, 140) };");
    expect(src).toContain("Без интернета: поиск сейчас не ответил ({r.noWeb}).");
    expect(src).toContain('{ai.busy ? (ai.stage === "plain" ? "Пишу без поиска…" : "Ищу и пишу…") : "Написать главу"}');
    expect(src).toContain('<RefSources label="Источники" list={r.sources} muted={muted} gold={gold} />');
    expect(src).toContain('import { siteOf, oneSite, openOut } from "../lib/ai-web";');   // ссылки открываются так же, как у Наставника
  });
  it("«Проверить факты»: вся глава или выделенное; замечания с галочками; оговорки честные", () => {
    const src = rd("ui/ref-assist.jsx");
    expect(src).toContain('const r = await refAiCall("ref_check", { text: frag.text });');
    expect(src).toContain('"Не получилось проверить в интернете: " + dot(r.error).slice(0, 240) + ". Попробуй ещё раз."');
    expect(src).toContain("on: r.notes.map(() => true)");
    for (const w of ["Проверяю в интернете. Это может занять до минуты.", "Проверка выделенных строк", "Проверка фактов", "Расхождений с источниками ассистент не нашёл.",
      "Ссылок ассистент не дал: считай это подсказкой, а не проверкой.", "Правила вашего ресторана ассистент не оценивает. Замечания сверь по ссылкам: решение за тобой.", "Поправить отмеченное", "Закрыть"]) expect(src, w).toContain(w);
  });
  it("«Поправить отмеченное»: уходит только отмеченное; правка приходит как «Улучшить»; «К замечаниям» возвращает к списку", () => {
    const src = rd("ui/ref-assist.jsx");
    expect(src).toContain("const picked = ai.check ? ai.check.notes.filter((_, i) => ai.on[i]) : [];");
    expect(src).toContain("const fixes = refFixesText(picked);");
    expect(src).toContain('const r = await refAiCall("ref_amend", { text: frag.text, fixes }, frag.text);');
    expect(src).toContain('const FIX = ["improve", "shorten", "amend"];');
    expect(src).toContain('{ai.mode === "amend" ? "К замечаниям" : "Отмена"}');
    expect(src).toContain('if (ai.mode === "amend" && ai.check) setAi((a) => ({ ...a, mode: "check", busy: false, err: "", result: null })); else close();');
    expect(src).toContain('if (!r.ok) { vibrate("error"); setAi((a) => ({ ...a, mode: "check", busy: false, err: r.error, result: null })); return; }');   // не вышло — замечания остаются
    expect(src).toContain("Правлю по замечаниям…");
    // блок переживает двойную постановку React в режиме разработки
    expect(src).toContain("React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);");
  });
});

describe("v169 · 8: демо и подсказки", () => {
  it("демо отвечает за новые режимы теми же проверкой и разбором, что сервер", () => {
    const boot = rd("tools/claude/demo-app/boot.js");
    expect(boot).toContain('import { refAiCheck, refAiClean, refPlanClean, refCheckClean } from "../../../lib/ref-ai.js";');
    for (const w of ['if (b.mode === "ref_plan") {', 'if (b.mode === "ref_check") {', 'if (b.mode === "ref_part") {', '} else if (b.mode === "ref_amend") {', 'if (useWeb && flag === "noweb")', 'flag.startsWith("failpart:")',
      "const res = refAiClean(b.mode, o, text, useWeb);"]) expect(boot, w).toContain(w);
  });
  it("о новом сказано в «Гиде» и в главе «Инструменты руководителя»", () => {
    expect(rd("ui/guide.jsx")).toMatch(/key: "refeditor"[^\n]*Большой документ он разложит на несколько глав, а факты найдёт и проверит в интернете\./);
    const ch = REFERENCE_APP_COURSE.lessons.find((l) => l.id === "app-leader").content;
    expect(ch).toContain("Большой документ он разложит на несколько глав: они ложатся в раздел скрытыми, пока владелец не проверит.");
    expect(ch).toContain("Факты ассистент ищет и проверяет в интернете и показывает источники.");
  });
  it("в «Главе из материала» подсказка ведёт к «Главам из документа»", () => {
    expect(rd("ui/ref-assist.jsx")).toContain("Здесь одна тема и одна глава. Большой документ на несколько глав раскладывается в разделе: «Главы из документа».");
  });
});
