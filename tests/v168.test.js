// v168 (Доп. 493): редактор справочника, часть вторая — ассистент. Владелец (15.11): «Редактор должен быть гибким и
// удобным. Включая все фишки и ai-ассистента»; (16.11) «Продолжим?». Ассистент устроен как в редакторе контента: блок под
// текстом главы, всё приходит черновиком, в главу текст берёт владелец.
//   • lib/ref-ai.js — общее у сервера, редактора и демо: режимы, просьбы к модели, разбор ответа, сохранность картинок,
//     работа с выделенным фрагментом;
//   • api/lesson-assist.js — режимы ref_chapter, ref_improve, ref_shorten, только владелец;
//   • ui/ref-assist.jsx — блок «Ассистент» в редакторе главы.
// Сервер менять не нужно (этапа SQL нет): тот же ключ OpenRouter, что у редактора контента. Разметки JSX в файле нет
// (Доп. 482). Вид в браузере — tools/claude/e2e-v168.mjs.
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
  REF_AI_MODES, REF_AI_LIMITS, REF_STYLE, REF_PROMPT, refPrompt, refAiCheck, REF_MARK_LINE, refMarkLines, keepRefMarks, refAiClean, refFragment, refApplyFragment, refTake,
} from "../lib/ref-ai";
import handler, { sanitize, PROMPT } from "../api/lesson-assist.js";
import { RefAssist, refAiCall, REF_AI_URL, REF_AI_PDF_MAX } from "../ui/ref-assist";
import { RefEditorScreen } from "../ui/ref-editor";
import { REF_MARKS } from "../lib/ref-edit";
import { loadRefBook, _resetRefBook } from "../lib/ref-book";
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
const noDoc = (fn) => { const d = globalThis.document; delete globalThis.document; try { return fn(); } finally { globalThis.document = d; } };

describe("v168 · версия и журнал", () => {
  it("сборка v168, Дополнение 493, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(168);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 493 — .*\(v168\)/);
    const part = c.slice(c.indexOf("# Дополнение 493"));
    expect(part.replace(/\s+/g, " ")).toContain("Включая все фишки и ai-ассистента");
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v168.mjs");
  });
});

describe("v168 · 1: просьбы к модели (lib/ref-ai.js)", () => {
  it("три режима; пределы; модуль ни от чего не зависит (его подключает и серверная функция)", () => {
    expect(REF_AI_MODES.slice(0, 3)).toEqual(["ref_chapter", "ref_improve", "ref_shorten"]);   // v169 добавил режимы: tests/v169.test.js
    expect(REF_AI_LIMITS).toMatchObject({ topic: 160, material: 30000, text: 6000, out: 20000, min: 40 });
    expect(rd("lib/ref-ai.js")).not.toMatch(/^import /m);
    expect(rd("api/lesson-assist.js")).toMatch(/import \{ REF_AI_MODES, REF_AI_LIMITS, [^}]*refPrompt, refAiCheck, refAiClean[^}]* \} from "\.\.\/lib\/ref-ai\.js";/);
  });
  it("стиль — разметка, которую рисует экран главы: заголовок, списки, «важно», «верно» и «неверно», картинки не трогать", () => {
    for (const w of ["**двойных звёздочках**", "«• »", "«1. »", "«" + REF_MARKS.note + " »", "«" + REF_MARKS.good + " »", "«" + REF_MARKS.bad + " »", "[img:…]", "[photo:…]", "переноси их без изменений", "новых не придумывай", "(#, _, таблиц, HTML)"]) expect(REF_STYLE, w).toContain(w);
  });
  it("глава из материала: только по материалу; по теме без материала: общие правила, без выдумок о заведении", () => {
    const doc = REF_PROMPT.chapter("Встреча гостя", "Встречаем за десять секунд.", false);
    expect(doc).toContain("на тему «Встреча гостя»");
    expect(doc).toContain("Опирайся только на материал");
    expect(doc).toContain("Ничего не придумывай и ничего важного не выбрасывай.");
    expect(doc).toContain("\nМАТЕРИАЛ:\nВстречаем за десять секунд.");
    expect(doc).toContain('{"title": "…", "content": "…"}');
    expect(doc).toContain(REF_STYLE);
    const pdf = REF_PROMPT.chapter("", "", true);
    expect(pdf).toContain("Напиши одну главу справочника для сотрудников ресторана.");
    expect(pdf).toContain("МАТЕРИАЛ — во вложенном PDF.");
    expect(pdf).toContain("Опирайся только на материал");
    const topic = REF_PROMPT.chapter("Декантация вина", "", false);
    expect(topic).toContain("Материала нет: пиши по общепринятым правилам ресторанного сервиса.");
    expect(topic).toContain("Не придумывай правил конкретного заведения, цен, имён и названий блюд");
    expect(topic).not.toContain("МАТЕРИАЛ");
    expect(doc).toContain("150–450 слов");
  });
  it("улучшить и сократить: факты, цифры и правила те же, от себя ничего", () => {
    const imp = REF_PROMPT.improve("Текст главы."), sh = REF_PROMPT.shorten("Текст главы.");
    expect(imp).toContain("Смысл, факты, цифры и правила не меняй и ничего не добавляй от себя.");
    expect(sh).toContain("Сократи текст главы справочника примерно на треть");
    expect(sh).toContain("Все правила, цифры, шаги и предупреждения сохрани. Ничего не добавляй от себя.");
    for (const p of [imp, sh]) { expect(p).toContain('{"content": "…"}'); expect(p).toContain("\nТЕКСТ ГЛАВЫ:\nТекст главы."); expect(p).toContain(REF_STYLE); }
    expect(refPrompt("ref_chapter", "Т", "м", false)).toBe(REF_PROMPT.chapter("Т", "м", false));
    expect(refPrompt("ref_improve", "", "т")).toBe(imp.replace("Текст главы.", "т"));
    expect(refPrompt("ref_shorten", "", "т")).toBe(sh.replace("Текст главы.", "т"));
  });
  it("чего не хватает для запроса: одна проверка у кнопок редактора и у сервера", () => {
    expect(refAiCheck("ref_chapter", {})).toBe("Напиши тему, вставь текст или прикрепи PDF.");
    expect(refAiCheck("ref_chapter", { topic: "Ра" })).toBe("Напиши тему, вставь текст или прикрепи PDF.");
    expect(refAiCheck("ref_chapter", { topic: "Раф" })).toBeNull();
    expect(refAiCheck("ref_chapter", { text: "Заметка" })).toBeNull();
    expect(refAiCheck("ref_chapter", { hasPdf: true })).toBeNull();
    expect(refAiCheck("ref_chapter", { text: "т".repeat(30001) })).toBe("Текст слишком большой. Дай его частями, одна тема за раз.");
    expect(refAiCheck("ref_chapter", { text: "коротко", len: 30001 })).toMatch(/слишком большой/);   // сервер считает длину до обрезки
    for (const m of ["ref_improve", "ref_shorten"]) {
      expect(refAiCheck(m, { text: "коротко" })).toBe("Сначала нужен текст главы, хотя бы пара предложений.");
      expect(refAiCheck(m, { text: "т".repeat(40) })).toBeNull();
      expect(refAiCheck(m, { text: "т".repeat(6000) })).toBeNull();
      expect(refAiCheck(m, { text: "т".repeat(6001) })).toBe("Текст длинный для одного раза. Выдели часть, и ассистент поправит её.");
    }
    for (const s of [refAiCheck("ref_chapter", {}), refAiCheck("ref_improve", {}), refAiCheck("ref_improve", { text: "т".repeat(6001) })]) expect(s).not.toMatch(/ — /);
  });
});

describe("v168 · 2: картинки в тексте не теряются (lib/ref-ai.js)", () => {
  const SRC = "Абзац.\n[img:preset_table]\nЕщё абзац.\n  [photo:rp:a1|Зал утром]  \n[img:preset_table]";
  it("строка картинки — только целая строка [img:…] или [photo:…]", () => {
    expect(REF_MARK_LINE.test("[img:glass_red]")).toBe(true);
    expect(REF_MARK_LINE.test("  [photo:rp:a1|Подпись]  ")).toBe(true);
    expect(REF_MARK_LINE.test("[photo:rp:a1|Зал [у окна]]")).toBe(true);   // подпись со скобками — как у экрана главы
    expect(REF_MARK_LINE.test("[photo:rp:a1|Подпись] и текст после")).toBe(false);
    expect(REF_MARK_LINE.test("[видео:rp:a1]")).toBe(false);
    expect(REF_MARK_LINE.test("текст [img:glass_red]")).toBe(false);
    expect(refMarkLines(SRC)).toEqual(["[img:preset_table]", "[photo:rp:a1|Зал утром]", "[img:preset_table]"]);
    expect(refMarkLines(null)).toEqual([]);
  });
  it("модель всё сохранила — текст как есть, ничего не потеряно", () => {
    const out = "**Заголовок**\nАбзац.\n[img:preset_table]\n• Ещё абзац.\n[photo:rp:a1|Зал утром]\n[img:preset_table]";
    expect(keepRefMarks(SRC, out)).toEqual({ text: out, lost: 0 });
  });
  it("потерянные строки возвращаются в конец, выдуманные и лишние повторы убираются", () => {
    expect(keepRefMarks(SRC, "Абзац.\n[img:preset_table]\nЕщё абзац.")).toEqual({ text: "Абзац.\n[img:preset_table]\nЕщё абзац.\n\n[photo:rp:a1|Зал утром]\n[img:preset_table]", lost: 2 });
    expect(keepRefMarks(SRC, "Абзац.\n[img:made_up]\n[photo:rp:a1|Другая подпись]\nКонец.")).toEqual({ text: "Абзац.\nКонец.\n\n[img:preset_table]\n[photo:rp:a1|Зал утром]\n[img:preset_table]", lost: 3 });
    expect(keepRefMarks("Абзац.\n[img:a]", "[img:a]\nАбзац.\n[img:a]\n[img:a]")).toEqual({ text: "[img:a]\nАбзац.", lost: 0 });
    expect(keepRefMarks("", "Новая глава.\n[img:made_up]\n\n\n\nКонец.")).toEqual({ text: "Новая глава.\n\nКонец.", lost: 0 });
    expect(keepRefMarks("[img:a]", "")).toEqual({ text: "[img:a]", lost: 1 });
    expect(keepRefMarks(null, null)).toEqual({ text: "", lost: 0 });
  });
  it("разбор ответа: только нужные поля; у новой главы выдуманные картинки убираются, название чистится", () => {
    expect(refAiClean("ref_chapter", { title: ' «Встреча   гостя». ', content: "  Текст.\r\n[img:made_up]\nКонец.  ", extra: 1 }, "что угодно\n[img:a]")).toEqual({ title: "Встреча гостя", content: "Текст.\nКонец.", lost: 0 });
    expect(refAiClean("ref_improve", { content: "Текст." }, "Текст\n[photo:rp:x|Зал]")).toEqual({ content: "Текст.\n\n[photo:rp:x|Зал]", lost: 1 });
    expect(refAiClean("ref_shorten", { content: "[img:a]\nКороче.", title: "лишнее" }, "Длинно.\n[img:a]")).toEqual({ content: "[img:a]\nКороче.", lost: 0 });
    expect(refAiClean("ref_chapter", { title: "т".repeat(300), content: "к".repeat(30000) }).title.length).toBe(160);
    expect(refAiClean("ref_chapter", { title: "Т", content: "к".repeat(30000) }).content.length).toBe(20000);
    for (const bad of [null, "строка", {}, { content: "   " }, { content: 5 }]) expect(refAiClean("ref_improve", bad, "")).toBeNull();
    expect(refAiClean("ref_chapter", { content: "[img:made_up]" })).toBeNull();
    expect(refAiClean("lesson", { content: "Текст." })).toBeNull();
  });
});

describe("v168 · 2: выделенный фрагмент (lib/ref-ai.js)", () => {
  const BODY = "**Заголовок**\nПервая строка главы про встречу гостя.\nВторая строка главы про проводы к столу.\nТретья.";
  it("выделение доводится до целых строк; мало текста или выделено всё — правится вся глава", () => {
    const a = BODY.indexOf("строка главы про встречу"), b = BODY.indexOf("к столу") + 3;
    const f = refFragment(BODY, a, b);
    expect(f).toEqual({ text: "Первая строка главы про встречу гостя.\nВторая строка главы про проводы к столу.", s: 14, e: BODY.indexOf("\nТретья"), part: true });
    expect(BODY.slice(f.s, f.e)).toBe(f.text);
    expect(refFragment(BODY, b, a)).toEqual(f);   // выделяли справа налево
    expect(refFragment(BODY, 5, 5)).toEqual({ text: BODY, s: 0, e: BODY.length, part: false });
    expect(refFragment(BODY, 20, 40).part).toBe(false);   // меньше сорока знаков
    expect(refFragment(BODY, 0, BODY.length).part).toBe(false);
    expect(refFragment(BODY, 2, BODY.length - 2).part).toBe(false);   // до целых строк — это вся глава
    const B2 = "Первая строка главы про встречу гостя у входа в зал.\nВторая строка.";   // выделили до начала следующей строки — её не берём
    expect(refFragment(B2, 0, B2.indexOf("Вторая"))).toEqual({ text: "Первая строка главы про встречу гостя у входа в зал.", s: 0, e: B2.indexOf("\n"), part: true });
    expect(refFragment("", 0, 0)).toEqual({ text: "", s: 0, e: 0, part: false });
    expect(refFragment(null, 3, 9).text).toBe("");
  });
  it("ответ встаёт на место фрагмента; текст успели поправить — ищем фрагмент по содержимому; не нашли — null", () => {
    const f = refFragment(BODY, BODY.indexOf("Первая"), BODY.indexOf("к столу") + 3);
    expect(refApplyFragment(BODY, f, " Новый кусок. ")).toBe("**Заголовок**\nНовый кусок.\nТретья.");
    expect(refApplyFragment("Вступление.\n" + BODY, f, "Новый кусок.")).toBe("Вступление.\n**Заголовок**\nНовый кусок.\nТретья.");
    expect(refApplyFragment(BODY.replace("Первая", "Самая первая"), f, "Новый кусок.")).toBeNull();
    expect(refApplyFragment(f.text + "\n" + f.text, { ...f, s: 99 }, "Новый кусок.")).toBeNull();   // фрагмент встречается дважды — не угадываем
    expect(refApplyFragment(BODY, refFragment(BODY, 0, 0), " Вся глава заново. ")).toBe("Вся глава заново.");
    expect(refApplyFragment(BODY, null, "Целиком")).toBe("Целиком");
  });
});

describe("v168 · 2: владелец берёт ответ в главу (lib/ref-ai.js, refTake)", () => {
  const PH = "[photo:rp:a1|Бокал айриш]", IMG = "[img:espresso_cup]";
  const OLD = "Раф готовим на сливках десять процентов.\n" + PH + "\nСироп добавляем до взбивания, иначе он не смешается.\n" + IMG + "\nПодаём в бокале айриш.";
  it("новая глава вместо прежнего текста: картинки прежнего текста переносятся в конец, по порядку", () => {
    expect(refTake(OLD, { content: "**Раф**\n1. Сливки.\n2. Сироп." })).toEqual({ body: "**Раф**\n1. Сливки.\n2. Сироп.\n\n" + PH + "\n" + IMG, pics: 2 });
    expect(refTake("Просто текст без картинок.", { content: " Новая глава. " })).toEqual({ body: "Новая глава.", pics: 0 });
    expect(refTake("", { content: "Новая глава." })).toEqual({ body: "Новая глава.", pics: 0 });
    expect(refTake(null, { content: "Новая глава." })).toEqual({ body: "Новая глава.", pics: 0 });
  });
  it("«Добавить в конец»: прежний текст цел, новый за ним через пустую строку; в пустую главу — просто новый", () => {
    expect(refTake(OLD + "\n\n", { content: "**Ещё**\nНовое.", how: "append" })).toEqual({ body: OLD + "\n\n**Ещё**\nНовое.", pics: 0 });
    expect(refTake("  \n", { content: "Новое.", how: "append" })).toEqual({ body: "Новое.", pics: 0 });
  });
  it("правка фрагмента: меняется только он, остальной текст буква в букву; не нашёлся — null", () => {
    const f = refFragment(OLD, OLD.indexOf("Сироп"), OLD.indexOf("смешается.") + 10);
    expect(f.part).toBe(true);
    expect(refTake(OLD, { fixed: true, frag: f, content: "Сироп: до взбивания." })).toEqual({ body: OLD.replace(f.text, "Сироп: до взбивания."), pics: 0 });
    const spaced = OLD.replace("Подаём", "\n\n\nПодаём") + "\n";   // чужие пустые строки и хвост не трогаем
    expect(refTake(spaced, { fixed: true, frag: f, content: "Сироп: до взбивания." }).body).toBe(spaced.replace(f.text, "Сироп: до взбивания."));
    expect(refTake(OLD.replace("Сироп добавляем", "Сироп всегда добавляем"), { fixed: true, frag: f, content: "Сироп: до взбивания." })).toBeNull();
  });
  it("правка всей главы: ответ как есть; фото вставили, пока ассистент думал, — оно остаётся; убрали — не возвращается", () => {
    const all = refFragment(OLD, 0, 0);
    const ANSWER = "• Раф готовим на сливках.\n" + PH + "\n• Сироп до взбивания.\n" + IMG + "\n• Подаём в бокале айриш.";
    expect(refTake(OLD, { fixed: true, frag: all, content: ANSWER })).toEqual({ body: ANSWER, pics: 0 });
    const NEW = "[photo:rp:b2|Сливки]";
    expect(refTake(OLD + "\n" + NEW, { fixed: true, frag: all, content: ANSWER })).toEqual({ body: ANSWER + "\n\n" + NEW, pics: 1 });
    expect(refTake(OLD.replace(PH + "\n", ""), { fixed: true, frag: all, content: ANSWER })).toEqual({ body: ANSWER.replace(PH + "\n", ""), pics: 0 });
    expect(refTake(OLD, { fixed: true, frag: null, content: ANSWER })).toEqual({ body: ANSWER, pics: 0 });
  });
});

// ── сервер: /api/lesson-assist с режимами справочника ────────────────────────────────────────────────────────
const WHO = { owner: { id: "u1", name: "Роман", position: "owner", is_admin: true }, boss: { id: "u2", name: "Мария", position: "manager", is_admin: false }, staff: { id: "u3", name: "Анна", position: "waiter", is_admin: false } };
let modelCalls = [], modelAnswer = null, modelStatus = 200;
const answer = (obj, finish = "stop") => ({ model: "test-model", choices: [{ message: { content: typeof obj === "string" ? obj : JSON.stringify(obj) }, finish_reason: finish }] });
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
const LONG = "Раф готовим на сливках десять процентов, сироп добавляем до взбивания, подаём в бокале айриш.";

describe("v168 · 3: сервер (api/lesson-assist.js, режимы ref_*)", () => {
  beforeEach(() => { globalThis.fetch = serverFetch; process.env.OPENROUTER_API_KEY = "ключ"; modelCalls = []; modelStatus = 200; modelAnswer = answer({ title: "Раф", content: "**Раф**\n• На сливках." }); });
  it("только владелец: руководителю и сотруднику — отказ, модель не тратится; прежние режимы руководителю открыты", async () => {
    expect(await call({ token: "boss", mode: "ref_chapter", title: "Раф" })).toEqual({ status: 403, body: { ok: false, error: "Редактор справочника доступен только владельцу" } });
    expect((await call({ token: "staff", mode: "ref_improve", text: LONG })).status).toBe(403);
    expect((await call({ token: "нет", mode: "ref_chapter", title: "Раф" })).status).toBe(401);
    expect(modelCalls.length).toBe(0);
    modelAnswer = answer({ title: "Урок", content: "Текст урока." });
    const les = await call({ token: "boss", mode: "lesson", role: "core", text: "Материал урока для официантов." });
    expect(les).toMatchObject({ status: 200, body: { ok: true, title: "Урок", content: "Текст урока." } });
    expect((await call({ token: "owner", mode: "ref_нет" })).body).toEqual({ ok: false, error: "Неизвестный режим" });
  });
  it("глава по теме: просьба без материала, PDF не прикладывается; ответ — название, текст, lost", async () => {
    const r = await call({ token: "owner", mode: "ref_chapter", title: "  Раф и авторские напитки  " });
    expect(r).toEqual({ status: 200, body: { ok: true, title: "Раф", content: "**Раф**\n• На сливках.", lost: 0, model: "test-model" } });
    expect(promptOf()).toBe(REF_PROMPT.chapter("Раф и авторские напитки", "", false));
    expect(modelCalls[0].messages[0].content.length).toBe(1);
    expect(modelCalls[0].max_tokens).toBe(4000);
  });
  it("глава из материала и из PDF: материал в просьбе, PDF файлом; выдуманные моделью картинки убираются", async () => {
    modelAnswer = answer({ title: "Встреча", content: "Текст.\n[img:made_up]\nКонец." });
    const r = await call({ token: "owner", mode: "ref_chapter", title: "Встреча гостя", text: "Встречаем за десять секунд.", pdfBase64: "data:application/pdf;base64,QUJD" });
    expect(r.body).toMatchObject({ ok: true, title: "Встреча", content: "Текст.\nКонец.", lost: 0 });
    expect(promptOf()).toBe(REF_PROMPT.chapter("Встреча гостя", "Встречаем за десять секунд.", true));
    expect(modelCalls[0].messages[0].content[1]).toEqual({ type: "file", file: { filename: "material.pdf", file_data: "data:application/pdf;base64,QUJD" } });
    await call({ token: "owner", mode: "ref_chapter", pdfBase64: "QUJD" });
    expect(promptOf()).toBe(REF_PROMPT.chapter("", "", true));
  });
  it("улучшить и сократить: текст главы в просьбе, PDF не уходит; потерянные моделью картинки возвращены и посчитаны", async () => {
    const src = LONG + "\n[photo:rp:a1|Бокал айриш]\nПодача на блюдце с ложкой.";
    modelAnswer = answer({ content: "• Раф на сливках.\n• Подача на блюдце." });
    const r = await call({ token: "owner", mode: "ref_improve", text: src, pdfBase64: "QUJD" });
    expect(r).toEqual({ status: 200, body: { ok: true, content: "• Раф на сливках.\n• Подача на блюдце.\n\n[photo:rp:a1|Бокал айриш]", lost: 1, model: "test-model" } });
    expect(promptOf()).toBe(REF_PROMPT.improve(src));
    expect(modelCalls[0].messages[0].content.length).toBe(1);
    modelAnswer = answer("```json\n" + JSON.stringify({ content: "[photo:rp:a1|Бокал айриш]\nКороче." }) + "\n```");
    const s = await call({ token: "owner", mode: "ref_shorten", text: src });
    expect(s.body).toMatchObject({ ok: true, content: "[photo:rp:a1|Бокал айриш]\nКороче.", lost: 0 });
    expect(promptOf()).toBe(REF_PROMPT.shorten(src));
  });
  it("не хватает данных — отказ до обращения к модели, теми же словами, что у кнопок", async () => {
    expect((await call({ token: "owner", mode: "ref_chapter" })).body).toEqual({ ok: false, error: "Напиши тему, вставь текст или прикрепи PDF." });
    expect((await call({ token: "owner", mode: "ref_improve", text: "мало" })).body.error).toBe("Сначала нужен текст главы, хотя бы пара предложений.");
    expect(await call({ token: "owner", mode: "ref_shorten", text: "т".repeat(6001) })).toEqual({ status: 400, body: { ok: false, error: "Текст длинный для одного раза. Выдели часть, и ассистент поправит её." } });
    expect((await call({ token: "owner", mode: "ref_chapter", text: "т".repeat(30001) })).body.error).toMatch(/слишком большой/);
    expect(modelCalls.length).toBe(0);
  });
  it("ответ не уместился или не по формату — честный отказ, а не обрывок", async () => {
    modelAnswer = answer('{"content": "Начало текста, который оборва', "length");
    expect(await call({ token: "owner", mode: "ref_improve", text: LONG })).toEqual({ status: 422, body: { ok: false, error: "Ответ не уместился. Выдели часть текста или дай материал частями." } });
    modelAnswer = answer({ content: "Целый ответ, но модель упёрлась в предел." }, "length");
    expect((await call({ token: "owner", mode: "ref_shorten", text: LONG })).status).toBe(422);
    modelAnswer = answer("Вот ваша глава: текст без JSON");
    expect((await call({ token: "owner", mode: "ref_chapter", title: "Раф" })).body).toEqual({ ok: false, error: "Ассистент ответил не по формату. Попробуй ещё раз." });
    modelAnswer = answer({ content: "" });
    expect((await call({ token: "owner", mode: "ref_improve", text: LONG })).status).toBe(422);
  });
  it("нет ключа, не POST, модель недоступна — как у остальных режимов", async () => {
    expect((await call({ token: "owner", mode: "ref_chapter", title: "Раф" }, "GET")).status).toBe(405);
    modelStatus = 402; modelAnswer = { error: { message: "нет кредитов", code: 402 } };
    const r = await call({ token: "owner", mode: "ref_chapter", title: "Раф" });
    expect(r.status).toBe(502);
    expect(r.body.error).toContain("закончились кредиты");
    delete process.env.OPENROUTER_API_KEY;
    expect((await call({ token: "owner", mode: "ref_chapter", title: "Раф" })).status).toBe(500);
  });
  it("прежние режимы не тронуты: список и PDF — те же строки, разбор урока тот же", () => {
    const api = rd("api/lesson-assist.js");
    // v191 (Доп. 516): режимы «О нас» — списком CN_MODES; PDF — ещё и у плана и блока «О нас»
    // v192 (Доп. 517): и тренажёр «Рассказ гостю» (concept_pitch) — для всех сотрудников
    expect(api).toContain('if (!isRef && !isPitch && !["lesson", "improve", "questions", "situations", "dialogue", "build", "review", ...CN_MODES].includes(mode)) return res.status(400).json({ ok: false, error: "Неизвестный режим" });');
    expect(api).toContain('const withPdf = mode === "lesson" || mode === "concept" || mode === "concept_plan" || mode === "concept_block";');
    expect(api).toContain('if (isRef && !emp.is_admin) return res.status(403).json({ ok: false, error: "Редактор справочника доступен только владельцу" });');
    expect(api.indexOf("if (isRef && !emp.is_admin)")).toBeLessThan(api.indexOf("await ask(key, refPrompt("));
    expect(sanitize("lesson", { title: "Т", content: "К" })).toEqual({ title: "Т", content: "К" });
    expect(sanitize("improve", { content: "К" })).toEqual({ content: "К" });
    expect(PROMPT.lesson("core", "м")).toContain("Сделай один урок");
  });
});

// ── редактор: обращение к ассистенту и блок под текстом ───────────────────────────────────────────────────────
describe("v168 · 4: обращение из редактора (ui/ref-assist.jsx, refAiCall)", () => {
  let sent = [], reply = null, status = 200, down = false;
  beforeEach(() => {
    for (const k of Object.keys(store0)) delete store0[k];
    phone.setItem("sa_session_token", "owner"); sent = []; status = 200; down = false;
    reply = { ok: true, title: " Раф ", content: "Текст.", lost: 0, model: "m" };
    globalThis.fetch = async (url, init = {}) => { if (down) throw new Error("нет сети"); sent.push([String(url), JSON.parse(init.body)]); return { ok: status === 200, status, json: async () => { if (reply === "мусор") throw new Error("не JSON"); return reply; } }; };
  });
  it("запрос: тот же адрес, что у редактора контента; тема — в title, текст — в text, вход — токеном", async () => {
    const r = await refAiCall("ref_chapter", { topic: "Раф", text: "Заметки", pdfBase64: "QUJD" });
    expect(r).toEqual({ ok: true, content: "Текст.", lost: 0, title: "Раф" });
    expect(sent).toEqual([["/api/lesson-assist", { token: "owner", mode: "ref_chapter", title: "Раф", text: "Заметки", pdfBase64: "QUJD" }]]);
    expect(REF_AI_URL).toBe("/api/lesson-assist");
    expect(REF_AI_PDF_MAX).toBe(3 * 1024 * 1024);   // v169: хостинг принимает запрос до 4,5 МБ, PDF больше 3 МБ до ассистента не дошёл бы
  });
  it("картинки сверяются и в редакторе: сервер не досчитал — потерянное возвращено, счёт складывается", async () => {
    reply = { ok: true, content: "Короче.\n[img:made_up]", lost: 1 };
    const r = await refAiCall("ref_improve", { text: "Длинно.\n[photo:rp:a|Зал]" }, "Длинно.\n[photo:rp:a|Зал]");
    expect(r).toEqual({ ok: true, content: "Короче.\n\n[photo:rp:a|Зал]", lost: 2 });
    expect(r.title).toBeUndefined();
    reply = { ok: true, content: "[img:made_up]" };
    expect(await refAiCall("ref_chapter", { topic: "Раф" })).toEqual({ ok: false, error: "Ассистент ответил пусто. Попробуй ещё раз." });
  });
  it("отказы: слова сервера как есть; функции нет — «ещё не развёрнут»; нет связи; не JSON", async () => {
    status = 403; reply = { ok: false, error: "Редактор справочника доступен только владельцу" };
    expect(await refAiCall("ref_improve", { text: "т" })).toEqual({ ok: false, error: "Редактор справочника доступен только владельцу" });
    status = 404; reply = "мусор";
    expect((await refAiCall("ref_improve", { text: "т" })).error).toBe("Ассистент ещё не развёрнут на сервере.");
    status = 500;
    expect((await refAiCall("ref_improve", { text: "т" })).error).toBe("Ассистент не ответил: сервер вернул код 500. Попробуй ещё раз.");   // v169: код виден на снимке
    down = true;
    expect(await refAiCall("ref_improve", { text: "т" })).toEqual({ ok: false, error: "Нет связи с ассистентом." });
  });
});

const uiOf = (a11y) => { const dark = !a11y; return { input: { fontSize: 14 }, primary: { fontSize: 15 }, G: (x) => glass(null, a11y, x), txt: dark ? "#EFE4C8" : "#2A2113", muted: "#BFAE8A", gold: "#C8A96E", brd: "rgba(214,178,102,0.30)", TN: tones(a11y) }; };
const panel = (p = {}) => R(h(RefAssist, { T: S, a11y: false, title: "", body: "", getSel: () => [0, 0], onTake: noop, ui: uiOf(false), ...p }));

describe("v168 · 4: блок «Ассистент» под текстом главы (ui/ref-assist.jsx)", () => {
  it("четыре кнопки; «всё приходит черновиком»; без текста «Улучшить» и «Сократить» не нажимаются", () => {
    const html = panel();
    expect([...html.matchAll(/data-ra-btn="([^"]+)"/g)].map((m) => m[1]).slice(0, 4)).toEqual(["doc", "topic", "improve", "shorten"]);   // v169: пятая — «Проверить факты»
    const t = text(html);
    for (const w of ["Ассистент", "Всё приходит черновиком. В главу текст берёшь ты, записываешь тоже ты.", "Глава из материала", "Глава по теме", "Улучшить текст", "Сократить"]) expect(t, w).toContain(w);
    expect(html).toMatch(/data-ra-btn="improve"[^>]*disabled=""/);
    expect(html).toMatch(/data-ra-btn="shorten"[^>]*disabled=""/);
    expect(html).not.toMatch(/data-ra-btn="doc"[^>]*disabled=""/);
    expect(t).not.toContain("Выдели несколько строк");
    for (const a of ["data-ra-form", "data-ra-result", "data-ra-undo", "data-ra-err"]) expect(html).not.toContain(a);
  });
  it("с текстом кнопки правки открыты и есть подсказка про выделение", () => {
    const html = panel({ title: "Раф", body: LONG });
    expect(html).not.toMatch(/data-ra-btn="improve"[^>]*disabled=""/);
    expect(html).not.toMatch(/data-ra-btn="shorten"[^>]*disabled=""/);
    expect(text(html)).toContain("Выдели несколько строк, и ассистент улучшит, сократит или проверит только их.");   // v169: и проверит
    expect(panel({ body: "мало текста" })).toMatch(/data-ra-btn="improve"[^>]*disabled=""/);
  });
  it("блок стоит в редакторе главы между текстом и «Как увидит сотрудник»; светлая тема рисуется", async () => {
    for (const k of Object.keys(store0)) delete store0[k];
    setPhotoBackend(memoryBackend()); _resetLessonPhotos(); _resetRefBook();
    const srv = makeServer({ today: "2026-11-16", rest: "Два моря, Океан", people: [{ id: "u-roman", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "owner", is_admin: true }], tok: { tr: "u-roman" }, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false });
    globalThis.fetch = async (u, init = {}) => ({ ok: true, status: 200, json: async () => srv.rpc(String(u).split("/rpc/")[1], JSON.parse(init.body || "{}")) });
    phone.setItem("sa_session_token", "tr");
    await loadRefBook();
    for (const [T, a11y] of [[S, false], [A, true]]) {
      const html = noDoc(() => R(h(RefEditorScreen, { T, a11y, profile: { id: "u-roman", name: "Роман", is_admin: true }, onBack: noop, startId: "srv-basics" })));
      expect(html).toContain('data-re-screen="ch"');
      const at = (s) => html.indexOf(s);
      expect(at('data-ra=""')).toBeGreaterThan(at('data-re-ch-body=""'));
      expect(at('data-ra=""')).toBeLessThan(at('data-re-preview-btn=""'));
      expect(html).not.toMatch(/data-ra-btn="improve"[^>]*disabled=""/);   // у штатной главы текст есть
    }
    const src = rd("ui/ref-editor.jsx");
    expect(src).toContain('<RefAssist key={draft.id + ":" + aiGen} T={T} a11y={a11y} title={draft.title} body={draft.body} getSel={sel} onTake={(f) => patch(f)}');
    // «Начать заново» стирает черновик вместе с его фото: «Вернуть прежний текст» после этого вернул бы строки без фото
    expect(src).toContain("const restart = () => { dropDraftPhotos(); dropDraft(); setAiGen((n) => n + 1); if (chNode)");
  });
  it("ответ сначала показан как глава; взять, заменить или добавить в конец; после замены — «Вернуть прежний текст»", () => {
    const src = rd("ui/ref-assist.jsx");
    expect(src).toContain("<RefContent text={r.content} T={T} gold={gold} dark={dark} notes />");
    expect(src).toContain('{filled ? "Заменить текст" : "Взять в главу"}');
    expect(src).toContain('{part ? "Заменить фрагмент" : "Заменить текст"}');
    expect(src).toContain("Добавить в конец");
    expect(src).toContain("Нужна вся глава");   // выделение могло остаться от кнопок оформления
    expect(src).toContain("const [s, e] = whole ? [0, 0] : getSel();");
    expect(src).toContain("Вернуть прежний текст");
    expect(src).toContain("const t = refTake(was.body, { fixed, frag: ai.frag, content: r.content, how });");
    expect(src).toContain("onTake(!fixed && !was.title.trim() && r.title ? { title: r.title, body: t.body } : { body: t.body });");   // своё название владельца не затирается
    expect(src).toContain('"Текст главы изменился, фрагмент не найден. Попробуй ещё раз."); return; }');
    // картинки прежнего текста перенесены в конец — об этом сказано рядом с «Вернуть прежний текст»
    expect(src).toContain("setUndo(was.body.trim() || was.title.trim() ? { ...was, pics: t.pics } : null);");
    expect(src).toContain("Картинка прежнего текста перенесена в конец. Поставь её на место или убери.");
    expect(src).toContain("Картинки прежнего текста перенесены в конец. Поставь их на место или убери.");
    // «Нужна вся глава» предлагается, только когда глава уместится в один запрос
    expect(src).toContain("{isFix && ai.mode !== \"amend\" && part && String(body || \"\").length <= REF_AI_LIMITS.text");
    // v169: «Глава по теме» ищет факты в интернете; пометка об этом и о том, что заметки владельца важнее найденного
    expect(src).toContain("Ассистент поищет факты в интернете и покажет источники. Твои заметки для него важнее найденного. Проверь главу и добавь то, как принято у вас.");
    expect(src).toContain("Это черновик. Проверь факты перед записью.");
  });
  it("в файле блока нет мелкого шрифта, тире между словами, точек-разделителей и значков-эмодзи", () => {
    const src = code(rd("ui/ref-assist.jsx"));
    for (const m of src.matchAll(/fontSize: (\d+(?:\.\d+)?)/g)) expect(Number(m[1]), m[0]).toBeGreaterThanOrEqual(12.5);
    expect(src).not.toMatch(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/);
    expect(src).not.toContain("·");
    expect(src).not.toMatch(/\p{Emoji_Presentation}/u);
    expect(code(rd("lib/ref-ai.js"))).not.toMatch(/\p{Emoji_Presentation}/u);
  });
});

describe("v168 · 5: демо и подсказки", () => {
  it("демо отвечает за ассистента теми же проверкой и разбором, что сервер", () => {
    const boot = rd("tools/claude/demo-app/boot.js");
    expect(boot).toMatch(/import \{ refAiCheck, refAiClean[^}]* \} from "\.\.\/\.\.\/\.\.\/lib\/ref-ai\.js";/);
    expect(boot).toContain('if (b.token !== "demo-u-roman") return { ok: false, error: "Редактор справочника доступен только владельцу" };');
    expect(boot).toContain("const res = refAiClean(b.mode, o, text");
  });
  it("об ассистенте сказано в «Гиде» и в главе «Инструменты руководителя»", () => {
    expect(rd("ui/guide.jsx")).toMatch(/key: "refeditor"[^\n]*Ассистент соберёт главу из регламента, заметок или PDF, улучшит и сократит текст\./);
    expect(REFERENCE_APP_COURSE.lessons.find((l) => l.id === "app-leader").content).toContain("Ассистент в редакторе соберёт главу из регламента или PDF, улучшит и сократит текст.");
  });
  it("ассистент грузится вместе с редактором: в стартовую сборку и в сам справочник не попал", () => {
    for (const f of ["App.jsx", "ui/ReferenceSection.jsx", "lib/ref-book.js", "ui/search.jsx"]) expect(rd(f), f).not.toMatch(/ref-assist|ref-ai/);
    expect(rd("ui/ref-editor.jsx")).toContain('import { RefAssist } from "./ref-assist";');
    // просьбы к модели нужны только серверу: стиль помечен для сборщика, чтобы не ехал в телефон владельца
    expect(rd("lib/ref-ai.js")).toContain("export const REF_STYLE = /* @__PURE__ */ [");
  });
});
