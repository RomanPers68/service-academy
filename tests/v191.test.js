// v191 (Доп. 516): «О нас» — своё название раздела, «для ознакомления» или «в зачёт», зачёт по роли, «Из документа» в два
// шага (PDF, Word, текст), текст блоков — как в уроках, удобный редактор.
// Владелец (21.11): «Добавил концепцию холдинга, а приложение тему назвало «Наш ресторан». Мы можем добавить возможность
// дописывать название блока?»; «давай сделаем удобнее добавление концепции и стандарты»; «что бы он красиво составлял
// текст, по типу того, что у нас уже собранно в уроках. А то выглядит инородно»; про зачёт: «Он должен учитывать только
// роль, в которой его прошли. Единственное, вопрос! Может концепцию сделаем как ознакомительный блок?»
//   • lib/lesson-look.js — lessonize (разметка уроков), lookInfo, lineKind, markLines;
//   • lib/docx-text.js — Word (.docx) на телефоне; lib/concept-ai.js — план, блоки, замена;
//   • lib/concept.js — meta (название, режим), номера уроков у трека свои, info;
//   • api/lesson-assist.js — concept_plan, concept_block, concept_style, LOOK;
//   • ui/lesson-look.jsx, ui/concept.jsx, ui/concept-import.jsx — экран; этап 57 (supabase-stage57-concept-title.sql).
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v191.mjs; SQL: tools/claude/sql/test57.sh.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { deflateRawSync } from "node:zlib";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (!globalThis.sessionStorage) globalThis.sessionStorage = globalThis.localStorage;
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), documentElement: { classList: { contains: () => false } } };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { lessonize, lookInfo, lineKind, markLines, KEYCAPS } from "../lib/lesson-look.js";
import { docxXmlToText, docxText, unzipEntry, docErr } from "../lib/docx-text.js";
import { planJobs, replaceTarget, docBlockPayload, runPool } from "../lib/concept-ai.js";
import { normConcept, conceptSection, conceptRecords, conceptModules, conceptRecordsAll, withConceptPrograms, blankBlock, kindOf, CN_SECTION, CN_SUB } from "../lib/concept.js";
import { revOf } from "../lib/custom-modules.js";
import { PROMPT, LOOK, CONCEPT_LOOK, CN_MODES, sanitize, cnQuestions, CONCEPT_KINDS } from "../api/lesson-assist.js";
import { STAGES } from "../lib/server-check.js";
import { planOf } from "../lib/newbie.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";
import { LessonLook } from "../ui/lesson-look.jsx";
import { BlockText, AboutScreen, firstTab, leadOf } from "../ui/concept.jsx";
import { S } from "../ui/styles.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

const BL = (id, scope, kind, x = {}) => ({ id, scope, kind, title: x.title || kindOf(kind).title, body: x.body === undefined ? "Текст " + id : x.body, photos: x.photos || [],
  tracks: x.tracks || [], questions: x.questions || [], sort: x.sort || id, at: "2026-11-21T03:00:00Z", by: "Роман" });
const RAW = (meta) => ({ ok: true, mine: "Океан", restaurant: "Океан",
  net: { ver: "n1", blocks: [BL(1, "", "idea", { body: "Мы семь ресторанов на Камчатке." }), BL(2, "", "dress", { body: "Чёрный верх", questions: [{ q: "Цвет верха?", options: ["Чёрный", "Белый"], correct: 0, explanation: "" }] })] },
  venue: { name: "Океан", ver: "v1", blocks: [BL(11, "Океан", "pitch", { body: "«Добро пожаловать!»" })] },
  others: [], read: { net: "", venue: "" }, can: { net: true, venue: true }, venues: ["Океан", "Порт"], ...(meta === undefined ? {} : { meta }) });

describe("v191 · версия и журнал", () => {
  it("сборка v191, Дополнение 516, слова владельца, сценарии", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(191);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 516 — .*\(v191\)/);
    const part = c.slice(c.indexOf("# Дополнение 516")).replace(/\s+/g, " ");
    for (const q of ["Добавил концепцию холдинга, а приложение тему назвало «Наш ресторан»", "давай сделаем удобнее добавление концепции и стандарты",
      "что бы он красиво составлял текст, по типу того, что у нас уже собранно в уроках", "Он должен учитывать только роль, в которой его прошли",
      "Может концепцию сделаем как ознакомительный блок?"]) expect(part, q).toContain(q);
    for (const l of c.slice(c.indexOf("# Дополнение 516")).split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
    const tr = rd("tools/claude/README.md");
    expect(tr).toContain("e2e-v191.mjs");
    expect(tr).toContain("test57.sh");
  });
});

describe("v191 · текст как в уроках (lib/lesson-look.js)", () => {
  it("заголовки: #, __, капс (название латиницей — с больших, сокращение без гласных — капсом), «…:» и короткая строка перед списком", () => {
    expect(lessonize("## Наши ценности\nТекст.")).toBe("**Наши ценности**\nТекст.");
    expect(lessonize("__Форма__\nТекст.")).toBe("**Форма**\nТекст.");
    expect(lessonize("MARIN RESTO GROUP\nМы — сеть.")).toBe("**Marin Resto Group**\nМы — сеть.");
    expect(lessonize("НАША МИССИЯ ДЛЯ МРГ\nТекст.")).toBe("**Наша миссия для МРГ**\nТекст.");
    // написание из обычных строк текста главнее: «Камчатка» с большой, ЕГАИС — капсом
    expect(lessonize("РАБОТАЕМ НА КАМЧАТКЕ И С ЕГАИС\nВсе поставки на Камчатке идут через ЕГАИС.")).toBe("**Работаем на Камчатке и с ЕГАИС**\nВсе поставки на Камчатке идут через ЕГАИС.");
    expect(lessonize("Что делаем:\n- встречаем\n- провожаем")).toBe("**Что делаем:**\n• встречаем\n• провожаем");
    expect(lessonize("Наши принципы\n— быть честными\n— быть вовремя")).toBe("**Наши принципы**\n• быть честными\n• быть вовремя");
    expect(lessonize("**Форма**:\nЧёрный верх.")).toBe("**Форма:**\nЧёрный верх.");
  });
  it("списки: «- », «* », «·», «•» без пробела → «• »; одна строка с тире — реплика, не список", () => {
    expect(lessonize("Список:\n* раз\n· два\n•три")).toBe("**Список:**\n• раз\n• два\n• три");
    expect(lessonize("Гость сказал.\n\n— Здравствуйте!")).toBe("Гость сказал.\n\n— Здравствуйте!");
  });
  it("нумерованный список 2–9 пунктов с 1 → 1️⃣ 2️⃣; длиннее или не с 1 — как был", () => {
    expect(lessonize("Порядок:\n1. Улыбка\n2) Приветствие\n\n3. Проводить")).toBe("**Порядок:**\n" + KEYCAPS[0] + " Улыбка\n" + KEYCAPS[1] + " Приветствие\n" + KEYCAPS[2] + " Проводить");
    expect(lessonize("Год:\n2. второй\n3. третий")).toBe("**Год:**\n2. второй\n3. третий");
    const ten = Array.from({ length: 10 }, (_, i) => (i + 1) + ". п" + i).join("\n");
    expect(lessonize(ten).split("\n")[0]).toBe("1. п0");
  });
  it("«Важно: …» и «Главное — …» → вывод «📌»; «Главное в работе — гость» не трогаем", () => {
    expect(lessonize("Важно: опоздание больше 10 минут — штраф.")).toBe("📌 Важно: опоздание больше 10 минут — штраф.");
    expect(lessonize("Главное — гость.")).toBe("📌 Главное — гость.");
    expect(lessonize("Главное в работе — гость.")).toBe("Главное в работе — гость.");
  });
  it("таблица: шапка — подзаголовком, строки — пунктами; цитата «>» и строка в кавычках — «ёлочки»; markdown-ссылка — текст", () => {
    expect(lessonize("| Должность | За что отвечает |\n|---|---|\n| Управляющий | ЕГАИС |")).toBe("**Должность — за что отвечает**\n• Управляющий — ЕГАИС");
    expect(lessonize("> Добро пожаловать!")).toBe("«Добро пожаловать!»");
    expect(lessonize('"Рады вас видеть!"')).toBe("«Рады вас видеть!»");
    expect(lessonize("Смотри [сайт](https://example.com) и «меню».")).toBe("Смотри сайт и «меню».");
  });
  it("переносы строк из PDF внутри абзаца склеиваются; абзацы — через пустую строку; после заголовка и внутри списка — без", () => {
    expect(lessonize("Мы кормим гостей так, как\nкормили бы своих.\nВторой абзац.")).toBe("Мы кормим гостей так, как кормили бы своих.\n\nВторой абзац.");
    expect(lessonize("**Форма**\n\n\nЧёрный верх.\n• Фартук\n\n• Обувь\n📌 Это стандарт.")).toBe("**Форма**\nЧёрный верх.\n\n• Фартук\n• Обувь\n\n📌 Это стандарт.");
    // как надо и как нельзя — одно семейство, подряд
    expect(lessonize("✅ Волосы собраны\n🚫 Яркий лак")).toBe("✅ Волосы собраны\n🚫 Яркий лак");
  });
  it("длинный абзац делится по предложению ближе к середине; короткий — нет", () => {
    const long = Array.from({ length: 24 }, (_, i) => "Предложение номер " + (i + 1) + " про сервис.").join(" ");
    const out = lessonize(long).split("\n\n");
    expect(out.length).toBeGreaterThan(1);
    for (const p of out) expect(p.length).toBeLessThanOrEqual(420);
    expect(lessonize("Короткий. Абзац.")).toBe("Короткий. Абзац.");
  });
  it("повторный проход ничего не меняет; пустое — пусто", () => {
    const samples = ["MARIN RESTO GROUP\nМы — семь ресторанов на Камчатке. Начинали\nс одного зала.\n\nНаши ценности\n- Забота\n- Команда\n\nВажно: гость первым.",
      "| A | B |\n|---|---|\n| 1 | 2 |\n\n1. раз\n2. два", "**Готово**\nТекст.\n\n📌 Вывод.", "Порядок:\n1. Улыбка\n2. Приветствие"];
    for (const t of samples) { const a = lessonize(t); expect(lessonize(a), t).toBe(a); }
    expect(lessonize("")).toBe(""); expect(lessonize(null)).toBe(""); expect(lessonize("   \n ")).toBe("");
  });
  it("lookInfo: слова, карточки (как в уроке), крупная первая мысль, части, выводы", () => {
    const t = lessonize("Мы — семь ресторанов на Камчатке, кормим гостей как своих.\n\n**Ценности**\n• Забота\n• Команда\n\n📌 Гость первым.");
    expect(lookInfo(t)).toEqual({ words: 18, cards: 1, lead: true, heads: 1, items: 3, pins: 1 });
    expect(lookInfo("**Сразу заголовок**\nТекст").lead).toBe(false);
    expect(lookInfo("").cards).toBe(0);
  });
  it("lineKind: значки строки урока; markLines: кнопки разметки и повторное нажатие снимает", () => {
    expect(lineKind("✅ так")).toEqual({ k: "good" });
    expect(lineKind("🚫 нет")).toEqual({ k: "ban" });
    expect(lineKind("📌 вывод")).toEqual({ k: "pin" });
    expect(lineKind(KEYCAPS[2] + " шаг")).toEqual({ k: "step", n: "3" });
    expect(lineKind("🟢 норма")).toEqual({ k: "level", level: "green" });
    expect(lineKind("обычная")).toBe(null);
    const v = "Улыбка\nПриветствие\nМеню";
    const st = markLines(v, 0, v.length, "steps");
    expect(st.v).toBe(KEYCAPS[0] + " Улыбка\n" + KEYCAPS[1] + " Приветствие\n" + KEYCAPS[2] + " Меню");
    expect(markLines(st.v, 0, st.v.length, "steps").v).toBe(v);
    expect(markLines("а\nб", 0, 3, "good").v).toBe("✅ а\n✅ б");
    expect(markLines("✅ а", 0, 4, "ban").v).toBe("🚫 а");
    expect(markLines("Добрый вечер!", 0, 5, "quote").v).toBe("«Добрый вечер!»");
    expect(markLines("Добрый", 0, 6, "bold")).toEqual({ v: "**Добрый**", s: 2, e: 8 });
    expect(markLines("Форма", 0, 5, "head").v).toBe("**Форма**");
    expect(markLines("📌 Вывод", 0, 8, "pin").v).toBe("Вывод");
  });
});

// ── маленький ZIP (как .docx) руками: локальные записи, оглавление, конец оглавления ──
function zip(files) {
  const parts = [], dir = []; let off = 0;
  for (const [name, text, method] of files) {
    const nb = Buffer.from(name, "utf8"), raw = Buffer.from(text, "utf8"), data = method === 8 ? deflateRawSync(raw) : raw;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(method, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nb, data); dir.push(Buffer.concat([ch, nb])); off += 30 + nb.length + data.length;
  }
  const cd = Buffer.concat(dir), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  const b = Buffer.concat([...parts, cd, end]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}
const P = (inner, pr = "") => `<w:p>${pr ? "<w:pPr>" + pr + "</w:pPr>" : ""}${inner}</w:p>`;
const RUN = (t, bold = false) => `<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const XML = `<?xml version="1.0"?><w:document><w:body>${P(RUN("Концепция"), '<w:pStyle w:val="Heading1"/>')}${P(RUN("Мы — семь ресторанов &amp; бар. ") + RUN("Гость первым.", true))}`
  + `${P(RUN("Наши ценности", true))}${P(RUN("Забота"), "<w:numPr><w:ilvl w:val=\"0\"/></w:numPr>")}${P(RUN("Команда"), "<w:numPr/>")}`
  + `<w:tbl><w:tr><w:tc>${P(RUN("Управляющий"))}</w:tc><w:tc>${P(RUN("ЕГАИС"))}</w:tc></w:tr></w:tbl>`
  + `${P("<w:del><w:r><w:delText>старое</w:delText></w:r></w:del>" + RUN("Итог"), '<w:pStyle w:val="2"/>')}${P(RUN("Последний") + "<w:tab/>" + RUN("абзац."))}</w:body></w:document>`;

describe("v191 · Word на телефоне (lib/docx-text.js)", () => {
  it("document.xml → текст: заголовок по стилю (и русский номер стиля), жирный короткий абзац, пункты, таблица, правки удалены", () => {
    expect(docxXmlToText(XML)).toBe("**Концепция**\n\nМы — семь ресторанов & бар. Гость первым.\n\n**Наши ценности**\n• Забота\n• Команда\n• Управляющий — ЕГАИС\n\n**Итог**\n\nПоследний абзац.");
  });
  it("архив: сжатый и без сжатия; не Word — ошибка «zip» и понятные слова", async () => {
    expect(await docxText(zip([["[Content_Types].xml", "<Types/>", 0], ["word/document.xml", XML, 8]]))).toContain("**Наши ценности**\n• Забота");
    const plain = zip([["word/document.xml", XML, 0]]);
    expect(new TextDecoder().decode(await unzipEntry(new Uint8Array(plain), "word/document.xml"))).toBe(XML);
    expect(await unzipEntry(new Uint8Array(plain), "нет.xml")).toBe(null);
    await expect(docxText(new TextEncoder().encode("просто текст").buffer)).rejects.toThrow("zip");
    expect(docErr(new Error("zip"))).toBe("Не получилось открыть файл как документ Word (.docx). Сохрани его в PDF или вставь текст.");
    expect(docErr(new Error("no-inflate"))).toBe("Этот телефон не умеет открывать Word. Сохрани документ в PDF или вставь текст.");
  });
});

describe("v191 · помощник: план, блок, оформление (api/lesson-assist.js)", () => {
  it("вид уроков в подсказке: первая мысль, части, пустые строки, значки, «📌», «ёлочки»; режимы «О нас» — свой список", () => {
    for (const s of ["первая строка — главная мысль", "**двойных звёздочках**", "разделяй пустой строкой", "«☑ »", "«🔹 »", "1️⃣ 2️⃣ 3️⃣", "«✅ »", "«🚫 »", "«📌 »", "«ёлочках»"]) expect(LOOK, s).toContain(s);
    expect(CN_MODES).toEqual(["concept", "concept_plan", "concept_block", "concept_style"]);
    expect(Object.keys(CONCEPT_LOOK)).toEqual(Object.keys(CONCEPT_KINDS));
    const plan = PROMPT.concept_plan("Вся сеть", "МАТ");
    expect(plan).toContain("составь план раздела «О нас»"); expect(plan).toContain("src — выдержка из материала"); expect(plan).toContain("\nМАТЕРИАЛ:\nМАТ");
    expect(PROMPT.concept_plan("", "")).toContain("МАТЕРИАЛ — во вложенном PDF.");
    const blk = PROMPT.concept_block("Marin", "dress", "Форма", "Форма и обувь", ["Кто мы"], 2, "МАТ", "ВЫДЕРЖКА");
    for (const s of ["Напиши блок-урок «Форма»", "«✅ » как надо и «🚫 » так нельзя", "Что в нём: Форма и обувь", "не повторяй: «Кто мы»", "ВЫДЕРЖКА", "Ещё 2 вопроса для теста", LOOK, '"questions": [']) expect(blk, s).toContain(s);
    expect(PROMPT.concept_block("", "idea", "", "", [], 0, "М")).not.toContain("вопрос");
    const sty = PROMPT.concept_style("values", "Ценности", "ТЕКСТ");
    expect(sty).toContain("ничего не добавляй от себя и ничего важного не теряй"); expect(sty).toContain('{"body": "…"}'); expect(sty).toContain("ТЕКСТ БЛОКА:\nТЕКСТ");
  });
  it("чистка ответа: план — виды, свой блок не больше пяти, выдержки; блок — разметка уроков и целые вопросы; оформление — разметка", () => {
    const own = Array.from({ length: 7 }, (_, i) => ({ kind: "own", title: "Своё " + i }));
    const pl = sanitize("concept_plan", { blocks: [{ kind: "idea", title: "Кто мы", about: "а", src: "б" }, { kind: "idea" }, { kind: "spam" }, ...own] });
    expect(pl.blocks.map((b) => b.kind)).toEqual(["idea", "own", "own", "own", "own", "own"]);
    expect(pl.blocks[0]).toEqual({ kind: "idea", title: "Кто мы", about: "а", src: "б", photos: [] });   // v192: и номера картинок из Word
    expect(sanitize("concept_plan", { blocks: [] })).toBe(null);
    const b = sanitize("concept_block", { title: "Форма", body: "## Главное\n- верх\n- обувь", questions: [{ q: "Что?", options: ["", "а", "б"], correct: 2 }, { q: "", options: ["а", "б"], correct: 0 }] });
    expect(b).toEqual({ title: "Форма", body: "**Главное**\n• верх\n• обувь", questions: [{ q: "Что?", options: ["а", "б"], correct: 1, explanation: "" }] });
    expect(sanitize("concept_block", { body: "" })).toBe(null);
    expect(sanitize("concept_style", { body: "### Итог\nТекст" })).toEqual({ body: "**Итог**\nТекст" });
    expect(sanitize("concept_style", { content: "Текст" })).toEqual({ body: "Текст" });
    expect(cnQuestions([{ q: "?", options: ["a", "b", "c", "d", "e"], correct: 4 }])).toEqual([]);
    expect(cnQuestions(Array.from({ length: 6 }, () => ({ q: "?", options: ["a", "b"], correct: 1 }))).length).toBe(4);
  });
  it("сервер: режимы «О нас» со своим счётом, PDF у плана и блока, вид блока проверен, выдержка блока, предел длины плана", () => {
    const api = rd("api/lesson-assist.js");
    expect(api).toContain('isCn ? rateLimit("cn:" + token, 150, 3600_000)');
    expect(api).toContain('if ((mode === "concept_block" || mode === "concept_style") && !CONCEPT_KINDS[kind]) return res.status(400).json({ ok: false, error: "Неизвестный вид блока" });');
    expect(api).toContain('const out = await ask(key, prompt, withPdf ? b64 : "", mode === "concept_plan" ? 8000 : 4000);');
    expect(api).toContain('if (out.ok && out.cut && isCn) return res.status(422).json({ ok: false, error: "Документ слишком большой для одного раза. Вставь его частями." });');
    expect(api).toContain("PROMPT.concept_block(cut(where, 80).trim(), kind, cut(title, 80).trim(), cut(about, 300).trim(), oth, nq, material, cut(src, 1500).trim())");
    expect(api).toContain('import { lessonize } from "../lib/lesson-look.js";');
  });
});

describe("v191 · раздел в треках: название, для ознакомления или в зачёт, зачёт по роли (lib/concept.js)", () => {
  it("meta с сервера: название, подзаголовок, режим; без этапа 57 — null", () => {
    expect(normConcept(RAW()).meta).toBe(null);
    const n = normConcept(RAW({ net: { title: " Marin Resto Group ", sub: "Холдинг", mode: "credit" }, venue: { title: "", sub: "", mode: "странно" } }));
    expect(n.meta).toEqual({ net: { title: "Marin Resto Group", sub: "Холдинг", mode: "credit" }, venue: { title: "", sub: "", mode: "" } });
  });
  it("conceptSection: заведение главнее сети, пусто — «Наш ресторан»; по умолчанию — для ознакомления", () => {
    expect(conceptSection(normConcept(RAW()))).toEqual({ title: CN_SECTION, sub: CN_SUB, mode: "info", info: true });
    expect(conceptSection(normConcept(RAW({ net: { title: "Marin", sub: "", mode: "credit" }, venue: { title: "", sub: "Океан", mode: "" } }))))
      .toEqual({ title: "Marin", sub: "Океан", mode: "credit", info: false });
    expect(conceptSection(normConcept(RAW({ net: { title: "Marin", sub: "", mode: "credit" }, venue: { title: "Океан", sub: "", mode: "info" } })))).toMatchObject({ title: "Океан", info: true });
    expect(conceptSection(null)).toMatchObject({ title: CN_SECTION, info: true });
  });
  it("номера уроков у трека свои; обложка — общая; «версия» по прежним номерам и тексту как написали", () => {
    const c = normConcept(RAW());
    const r = conceptRecords(c, "spg");
    expect(r.map((x) => x.id)).toEqual(["cn-spg-idea", "cn-spg-pitch", "cn-spg-dress"]);
    expect(r[0]).toMatchObject({ key: "cn-idea", photoKey: "cms-l-cn-idea", module: CN_SECTION });
    const [m] = conceptModules(c, "spg", "#C8A96E");
    expect(m.lessons.map((l) => l.id)).toEqual(["cms-l-cn-spg-idea", "cms-l-cn-spg-pitch", "cms-l-cn-spg-dress", "cms-q-cn-spg-dress"]);
    expect(m.lessons[0].photoKey).toBe("cms-l-cn-idea");
    expect(m.rev).toBe(revOf(conceptRecords(c, "spg").map((x) => ({ ...x, id: x.key }))));
    // у другого трека — свои номера уроков, а «версия» та же: текст тот же
    const [b] = conceptModules(c, "bar", "#C8A96E");
    expect(b.lessons[0].id).toBe("cms-l-cn-bar-idea");
    expect(b.rev).toBe(m.rev);
  });
  it("для ознакомления — info у модуля, в отчёт и брифинг не идёт; в зачёт — как обычная тема; своё название", () => {
    const info = normConcept(RAW());
    expect(conceptModules(info, "core", "")[0]).toMatchObject({ info: true, title: CN_SECTION, subtitle: CN_SUB });
    expect(conceptRecordsAll(info)).toEqual([]);
    expect(withConceptPrograms({ core: [{ id: "c0" }] }, info)).toEqual({ core: [{ id: "c0" }] });
    const cr = normConcept(RAW({ net: { title: "Marin Resto Group", sub: "Кто мы", mode: "credit" }, venue: { title: "", sub: "", mode: "" } }));
    const [m] = conceptModules(cr, "core", "");
    expect(m.info).toBe(undefined);
    expect(m).toMatchObject({ title: "Marin Resto Group", subtitle: "Кто мы" });
    expect(m.lessons.find((l) => l.type === "quiz").title).toBe("Тест: Marin Resto Group");
    expect(conceptRecordsAll(cr).length).toBeGreaterThan(0);
    expect(withConceptPrograms({ core: [{ id: "c0" }] }, cr).core.map((x) => x.id)).toEqual(["cn-core", "c0"]);
  });
  it("текст уроков раздела — разметкой уроков (на экране), а в базе — как написали", () => {
    const c = normConcept({ ...RAW(), net: { ver: "n", blocks: [BL(1, "", "idea", { body: "## Кто мы\n- семь залов\n- Камчатка" })] }, venue: null });
    expect(conceptModules(c, "core", "")[0].lessons[0].content).toBe("**Кто мы**\n• семь залов\n• Камчатка");
    expect(conceptRecords(c, "core")[0].content).toBe("## Кто мы\n- семь залов\n- Камчатка");
  });
  it("новичок: «Внешний вид по стандарту» находит дресс-код раздела по номеру трека", () => {
    const mods = conceptModules(normConcept(RAW()), "seasonal", "");
    const plan = planOf({ checked: {}, confirm: {} }, { modules: mods });
    const d1c = plan.sections.flatMap((s) => s.steps).find((s) => s.id === "d1c");
    expect(d1c).toMatchObject({ module: "cn-seasonal", sub: "Дресс-код и фото: «О нас», раздел «Наш ресторан»" });
  });
});

describe("v191 · «Из документа»: план, замена, сохранение (lib/concept-ai.js)", () => {
  it("planJobs — понятные виды и заголовки; replaceTarget — тот же вид, свой блок — по заголовку", () => {
    expect(planJobs([{ kind: "idea", title: " ", about: "а" }, { kind: "bad" }, null])).toEqual([{ kind: "idea", title: "Концепция и история", about: "а", src: "", photos: [] }]);   // v192: photos
    const ex = [BL(1, "", "idea"), BL(2, "", "own", { title: "Музыка в зале" })];
    expect(replaceTarget(ex, "idea", "Кто мы").id).toBe(1);
    expect(replaceTarget(ex, "own", "музыка  в зале!").id).toBe(2);
    expect(replaceTarget(ex, "own", "Льготы")).toBe(null);
    expect(replaceTarget(ex, "values", "Ценности")).toBe(null);
  });
  it("docBlockPayload: замена — тот же номер, фото и «для кого» остаются, вопросы новые (нет — прежние); новый — «для кого» по виду", () => {
    const t = { ...BL(5, "Океан", "check", { photos: [{ id: 9, cap: "" }], tracks: ["core"], questions: [{ q: "старый", options: ["a", "b"], correct: 0 }] }) };
    const a = docBlockPayload({ kind: "check", title: "Чек", body: "- напиток\n- горячее", questions: [] }, t, "Океан", blankBlock);
    expect(a).toMatchObject({ id: 5, title: "Чек", body: "• напиток\n• горячее", photos: [{ id: 9, cap: "" }], tracks: ["core"] });
    expect(a.questions[0].q).toBe("старый");
    const n = docBlockPayload({ kind: "check", title: "", body: "Текст", questions: [{ q: "новый", options: ["a", "b"], correct: 1 }] }, null, "Океан", blankBlock);
    expect(n).toMatchObject({ id: null, scope: "Океан", kind: "check", title: "Правильный чек: к чему стремимся", tracks: ["seasonal", "core", "manager", "service_manager"] });
    expect(n.questions[0].q).toBe("новый");
  });
  it("runPool: не больше n сразу, все по разу, stop — новые не начинаются", async () => {
    let now = 0, peak = 0; const seen = [];
    await runPool([1, 2, 3, 4, 5], 2, async (x) => { now++; peak = Math.max(peak, now); await new Promise((r) => setTimeout(r, 5)); seen.push(x); now--; });
    expect(peak).toBe(2); expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
    const done = []; let stop = false;
    await runPool([1, 2, 3, 4], 1, async (x) => { done.push(x); if (x === 2) stop = true; }, () => stop);
    expect(done).toEqual([1, 2]);
  });
});

describe("v191 · экран: как в уроке, редактор", () => {
  it("LessonLook: первая мысль крупно, заголовок, пункты, значки, «ёлочки»; карточки — с отметкой; bare — без стекла", () => {
    const t = "Мы — семь ресторанов на Камчатке, кормим гостей как своих.\n\n**Ценности**\n• Забота\n✅ Так\n🚫 Нельзя\n📌 Вывод\n" + KEYCAPS[0] + " Шаг\n«Добро пожаловать!»";
    const html = R(h(LessonLook, { text: t, T: S, title: "Кто мы" }));
    for (const k of ["lead", "head", "dot", "good", "ban", "pin", "step", "quote"]) expect(html, k).toContain('data-look="' + k + '"');
    expect(html).toContain("Кто мы</div>");
    expect(html).toContain('data-lens-card=""');
    const bare = R(h(LessonLook, { text: t, T: S, bare: true }));
    expect(bare).toContain('data-lesson-look="bare"'); expect(bare).not.toContain("data-lens-card");
    const long = Array.from({ length: 6 }, (_, i) => "**Часть " + (i + 1) + "**\n" + "Текст части. ".repeat(20)).join("\n\n");
    expect(R(h(LessonLook, { text: long, T: S, cards: true }))).toContain("data-look-cut");
  });
  it("«О нас»: текст блока — как в уроке, разметка приводится (BlockText)", () => {
    const html = R(h(BlockText, { T: S, text: "## Форма\n- Чёрный верх\nВажно: обувь закрытая." }));
    expect(html).toContain('data-look="head"'); expect(html).toContain(">Форма</div>");
    expect(html).toContain('data-look="dot"'); expect(html).toContain('data-look="pin"');
  });
  it("редактор: с какой вкладки начать; первая мысль в строке блока", () => {
    const c = normConcept(RAW());
    expect(firstTab(c)).toBe("net");
    expect(firstTab(c, "venue")).toBe("venue");
    expect(firstTab({ ...c, can: { net: false, venue: true } }, "net")).toBe("venue");
    expect(firstTab({ ...c, net: { blocks: [], ver: "" } })).toBe("venue");
    expect(leadOf("**Заголовок**\n✅ Волосы собраны, ногти короткие.")).toBe("Волосы собраны, ногти короткие.");
    expect(leadOf("Слово ".repeat(40)).length).toBeLessThanOrEqual(110);
  });
  it("редактор целиком: карточка раздела (название, уроки, самопроверка, как проходить), вкладки со счётом, строки с первой мыслью", () => {
    const c = normConcept(RAW({ net: { title: "Marin Resto Group", sub: "Кто мы", mode: "" }, venue: { title: "", sub: "", mode: "" } }));
    const html = R(h(AboutScreen, { T: S, a11y: false, profile: { is_admin: true, restaurant: "Океан" }, role: "spg", concept: c, onRaw() {}, onBack() {}, startEdit: true, onOpenSection() {} }));
    expect(html).toContain('data-about="edit"'); expect(html).toContain('data-cn-scope="net"');
    expect(html).toContain('data-cn-section="Marin Resto Group"'); expect(html).toContain("Кто мы</div>");
    expect(html).toContain('data-cn-secstat="3/1"'); expect(html).toContain("самопроверка: 1 вопрос");
    expect(html).toContain('data-cn-mode="info"'); expect(html).toContain("Пройденное засчитывается только в той роли, где его прошли.");
    expect(html).toContain('data-cn-secopen=""');
    expect(html).toMatch(/Вся сеть<span data-cn-tabn="2"/); expect(html).toMatch(/Океан<span data-cn-tabn="1"/);
    expect(html).toContain('data-cn-lead=""'); expect(html).toContain("Мы семь ресторанов на Камчатке.");
    expect(html).toContain('data-cn-restyle-go=""');
  });
  it("в коде экрана нет тире-ритма и эмодзи (значки строк — из lib/lesson-look.js)", () => {
    const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
    const EM = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️/gu;
    for (const f of ["ui/concept.jsx", "ui/concept-import.jsx", "ui/lesson-look.jsx", "lib/concept-ai.js", "lib/docx-text.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect((code(rd(f)).match(EM) || []).length, f).toBe(0);
    }
  });
});

describe("v191 · сервер: этап 57 и демо", () => {
  it("этап 57: таблица, режим, функция с null «не трогать», concept_get с meta, перенос пройденного по ролям, права", () => {
    const sql = rd("supabase/supabase-stage57-concept-title.sql");
    for (const s of ["create table if not exists sa_concept_meta", "alter table sa_concept_meta add column if not exists mode text not null default ''",
      "create or replace function concept_meta_set(p_token text, p_scope text, p_title text default null, p_sub text default null, p_mode text default null)",
      "if p_mode is not null and p_mode not in ('', 'info', 'credit') then return jsonb_build_object('ok', false, 'error', 'bad_mode'); end if;",
      "'meta', jsonb_build_object('net', _sa_cn_meta(''), 'venue', case when rest is null then null else _sa_cn_meta(rest) end)",
      "update progress set lesson_id = 'cms-l-cn-' || role || '-' || substr(lesson_id, 10)", "update scores set quiz_id = 'cms-q-cn-' || role || '-' || substr(quiz_id, 10)",
      "update quiz_events set lesson_id = 'cms-q-cn-' || role_id || '-' || substr(lesson_id, 10)", "update quiz_done d set quiz_id = 'cms-q-cn-' || r.role || '-' || substr(d.quiz_id, 10)",
      "grant execute on function concept_meta_set(text, text, text, text, text), concept_get(text, text) to anon, authenticated;",
      "Сначала этап 49 (supabase-stage49-concept.sql)"]) expect(sql, s).toContain(s);
    expect(STAGES.find((s) => s.n === "57")).toEqual({ n: "57", file: "supabase-stage57-concept-title.sql", what: "«О нас»: своё название раздела, для ознакомления или в зачёт", fn: "concept_meta_set" });
    expect(rd("supabase/README.md")).toContain("supabase-stage57-concept-title.sql");
    expect(rd("supabase/AI-SETUP.md")).toContain("## v191: «О нас» → «Из документа» в два шага");
  });
  it("демо-сервер: название и режим, null — не трогать, права, без этапа 57 — как раньше", () => {
    const Pp = (id, name, restaurant, position, x = {}) => ({ id, name, surname: "", restaurant, position, is_admin: false, ...x });
    const people = [Pp("r", "Роман", "Океан", "owner", { is_admin: true }), Pp("m", "Мария", "Океан", "manager"), Pp("a", "Анна", "Океан", "waiter")];
    const mk = (x = {}) => makeServer({ today: "2026-11-21", rest: "Океан", people, tok: { tr: "r", tm: "m", ta: "a" }, sstaff: [], cfg: { shifts: [] }, plan: {}, menu: [],
      concept: { net: [{ kind: "idea", title: "Кто мы", body: "Текст" }] }, ...x });
    const srv = mk();
    expect(srv.rpc("concept_get", { p_token: "ta" }).meta).toEqual({ net: { title: "", sub: "", mode: "" }, venue: { title: "", sub: "", mode: "" } });
    expect(srv.rpc("concept_meta_set", { p_token: "tr", p_scope: "", p_title: " Marin   Resto ", p_sub: null, p_mode: "credit" }).meta).toEqual({ title: "Marin Resto", sub: "", mode: "credit" });
    expect(srv.rpc("concept_meta_set", { p_token: "tr", p_scope: "", p_title: null, p_sub: "Кто мы", p_mode: null }).meta).toEqual({ title: "Marin Resto", sub: "Кто мы", mode: "credit" });
    expect(srv.rpc("concept_meta_set", { p_token: "tr", p_scope: "", p_mode: "всегда" }).error).toBe("bad_mode");
    expect(srv.rpc("concept_meta_set", { p_token: "ta", p_scope: "", p_title: "x" }).error).toBe("forbidden");
    expect(srv.rpc("concept_meta_set", { p_token: "tm", p_scope: "Океан", p_title: "Океан", p_mode: "info" }).meta).toEqual({ title: "Океан", sub: "", mode: "info" });
    expect(srv.rpc("concept_get", { p_token: "ta" }).meta.venue).toEqual({ title: "Океан", sub: "", mode: "info" });
    expect(srv.rpc("concept_meta_set", { p_token: "tm", p_scope: "Океан", p_title: "", p_sub: "", p_mode: "" }).meta).toEqual({ title: "", sub: "", mode: "" });
    const old = mk({ noStage57: true });
    expect("meta" in old.rpc("concept_get", { p_token: "ta" })).toBe(false);
    expect(old.rpc("concept_meta_set", { p_token: "tr", p_scope: "", p_title: "x" }).code).toBe("PGRST202");
  });
  it("демо: флажок «без этапа 57», помощник умеет план, блок и оформление", () => {
    const boot = rd("tools/claude/demo-app/boot.js");
    expect(boot).toContain('noStage57: lsGet("__demo_no57") === "1"');
    expect(boot).toContain('keep.add("__demo_no57");');
    for (const m of ['b.mode === "concept_plan"', 'b.mode === "concept_block"', 'b.mode === "concept_style"']) expect(boot, m).toContain(m);
    expect(rd("tools/claude/demo-app/fake-server.js")).toContain('if (fn === "concept_meta_set") {');
  });
});

describe("v191 · связи в приложении", () => {
  it("«Открыть как сотрудник», шаги раздела для ознакомления — самопроверка, экзамен без них, обложка урока общая", () => {
    const app = rd("App.jsx");
    expect(app).toContain("onOpenSection={conceptMods.length ? () => openModule(conceptMods[0]) : null}");
    expect(app).toContain("const infoIds = useMemo(() => infoLessonIds([...Object.values(MODULES).flat(), ...Object.values(customByRole).flat()]), [contentVer, customByRole]);");
    expect(app).toContain("const examExtra = useMemo(() => countable(customByRole[examRole] || [])");
    expect(app.indexOf("const customByRole = useMemo(")).toBeLessThan(app.indexOf("const infoIds = useMemo("));
    expect(rd("ui/screens-learning.jsx")).toContain("<LessonCover lessonId={lesson.photoKey || lesson.id}");
    expect(rd("lib/lesson-photo.js")).toContain("add(full, lesson ? lessonPhotoId(lesson.photoKey || lesson.id) : null);");
    expect(rd("lib/lesson-photo.js")).toContain("const id = l ? lessonPhotoId(l.photoKey || l.id) : null, b = id ? photoOf(list, id) : null;");
    expect(rd("lib/custom-modules.js")).toContain("...(c.photoKey ? { photoKey: c.photoKey } : {})");
    expect(rd("lib/newbie.js")).toContain("/^cms-l-cn-(?:[a-z_]+-)?dress$/.test(l.id)");
  });
});
