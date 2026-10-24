// v77 (Доп. 390): владелец вернул Наставнику человечность. Пустой экран снова здоровается по имени и говорит от первого
// лица; в ответах остаются смайлики, похвала вопросу и тёплая концовка — как их написала модель; в подсказке ai-chat вместо
// запретов v76 — просьба писать тепло, как старший коллега. От v76 остаётся только разметка обычным текстом («###», «-»,
// «---», *курсив*, «1️⃣» в начале пункта), гость — без звёздочек и эмодзи. Вид — tools/claude/e2e-v77.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { cleanReply, splitActions } from "../lib/reply-clean.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
if (!globalThis.Deno) globalThis.Deno = { serve() {}, env: { get: () => undefined } };
const chat = await import("../supabase/functions/ai-chat/index.ts");

const SMILE = "\u{1F60A}", THUMB = "\u{1F44D}", PLATE = "\u{1F37D}\uFE0F", CHECK = "✅", COOK = "\u{1F469}\u200D\u{1F373}", K1 = "1\uFE0F\u20E3", K2 = "2\uFE0F\u20E3";

describe("v77: ответ Наставника — тон как у модели, разметка обычным текстом", () => {
  it("смайлики, «Отличный вопрос!» и «Надеюсь, помог!» остаются", () => {
    expect(cleanReply("Отличный вопрос! " + SMILE + " Сначала пауза и вдох.\n\nНадеюсь, помог! " + THUMB)).toBe("Отличный вопрос! " + SMILE + " Сначала пауза и вдох.\n\nНадеюсь, помог! " + THUMB);
    expect(cleanReply("Хороший вопрос, Анна. Скажи гостю: «Сейчас уточню у кухни».\nЕсли остались вопросы — спрашивай!")).toBe("Хороший вопрос, Анна. Скажи гостю: «Сейчас уточню у кухни».\nЕсли остались вопросы — спрашивай!");
    expect(cleanReply("Конечно! Подойди к столу.\nОбращайся, если что " + SMILE)).toBe("Конечно! Подойди к столу.\nОбращайся, если что " + SMILE);
    expect(cleanReply(COOK + " Повар уже знает. " + THUMB + "\u{1F3FD}")).toBe(COOK + " Повар уже знает. " + THUMB + "\u{1F3FD}");
  });
  it("разметка: «###» — жирной строкой, «-» — «•», «1\uFE0F\u20E3» в начале пункта — «1.», «---» и *курсив* — без знаков", () => {
    const out = cleanReply("Отличный вопрос! " + SMILE + "\n\n### Что делать\n" + K1 + " **Извинись** перед гостем.\n" + K2 + " Предложи замену " + PLATE + "\n- Позови менеджера.\n\n---\n" + CHECK + " Главное — *спокойно*.\n\nНадеюсь, помог! " + THUMB);
    expect(out).toBe("Отличный вопрос! " + SMILE + "\n\n**Что делать**\n1. **Извинись** перед гостем.\n2. Предложи замену " + PLATE + "\n• Позови менеджера.\n\n" + CHECK + " Главное — спокойно.\n\nНадеюсь, помог! " + THUMB);
    expect(cleanReply("Шаг " + K1 + " внутри строки — как есть")).toBe("Шаг " + K1 + " внутри строки — как есть");
  });
  it("живой гость — как в v76: действие отдельно, без звёздочек, без эмодзи", () => {
    expect(splitActions("*смотрит на часы* Простите, горячее скоро? \u{1F644}")).toEqual([{ t: "смотрит на часы", act: true }, { t: "Простите, горячее скоро?", act: false }]);
  });
});

describe("v77: пустой экран Наставника — снова с приветствием", () => {
  it("значок «AI» в круге, «Привет, {имя}!» и «Я знаю стандарты… Спрашивай как коллегу»", () => {
    const src = code(rd("ui/assistant.jsx"));
    expect(src).toContain('import { UI_SVG } from "./icons";');
    expect(src).toContain("{UI_SVG.ai(gold, 26)}");
    expect(src).toContain('<div data-mentor-hello="" style={{ color: T.lessHeadTitle?.color, fontFamily: ACCENT_SERIF, fontSize: a11y ? 20 : 18, fontWeight: "bold", textAlign: "center", marginBottom: 8 }}>\n              Привет, {profile?.name || "коллега"}!');
    expect(src).toContain("Я знаю стандарты Service Academy и помогу с любой рабочей ситуацией:\n              гости, конфликты, подача, запара. Спрашивай как коллегу или начни с готового вопроса:");
    expect(src).not.toContain("Наставник знает уроки, Справочник и меню твоего ресторана.");
    expect(src).not.toContain("data-mentor-empty");
  });
  it("сообщение о лимите — как было: «…там тоже много ответов!»", () => {
    expect(code(rd("ui/assistant.jsx"))).toContain("Загляни в уроки или SOS: там тоже много ответов!`");
  });
});

describe("v77: подсказка Наставника — тёплый тон вместо запретов", () => {
  const anna = { name: "Анна", position: "waiter", restaurant: "Два моря, Океан" };
  it("«пиши тепло и по-человечески… можно по имени, подбодрить, к месту — смайлик»; «#» и таблиц — нет", () => {
    const { stable } = chat.buildSystemParts(anna, "");
    expect(stable).toContain("СТИЛЬ: пиши тепло и по-человечески, как старший коллега в мессенджере: можно обратиться по имени, подбодрить, к месту — смайлик. Заголовки с «#» и таблицы чат не показывает: вместо них — жирный и строки «1.», «2.», «3.».");
    for (const bad of ["Без эмодзи, без цифр-эмодзи", "Не хвали вопрос", "не заканчивай дежурной фразой", "Без противопоставлений «не X, а Y»"]) expect([bad, stable.includes(bad)]).toEqual([bad, false]);
    expect(stable.indexOf("СТИЛЬ:")).toBeGreaterThan(stable.indexOf("Тон: опытный"));
    expect(stable.indexOf("СТИЛЬ:")).toBeLessThan(stable.indexOf("КАК СТРОИТЬ ОТВЕТ:"));
  });
  it("голосом — по-прежнему без эмодзи и списков (ответ звучит вслух)", () => {
    expect(rd("supabase/functions/ai-chat/index.ts")).toContain("`Без списков, нумерации, заголовков, жирного и эмодзи.");
  });
  it("номер функции — 77", () => {
    expect(chat.AI_CHAT_V).toBe(77);
  });
});

describe("v77: метка и журнал", () => {
  it("«сборка v77», «Дополнение 390»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(7[7-9]|[89]\d|\d{3,})<\/span>/);   // v77 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 390 — Наставнику вернули человечность: приветствие по имени, смайлики и тёплые фразы (v77)");
  });
});
