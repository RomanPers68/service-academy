// v192 (Доп. 517): «О нас» — все семь идей. Владелец (23.11): «Ты правильно понял. Делаем все 7».
//   1. «Ознакомлен(а)» и лист ознакомления (lib/concept.js conceptAck, ui/concept-more.jsx AckCard и AcksPanel, этап 58);
//   2. картинки из Word сразу в блоки (lib/docx-text.js docxDoc, lib/concept-ai.js assignPhotos, ui/concept-import.jsx);
//   3. обложка «О нас» (conceptHero, conceptToc, ConceptCover);
//   4. «Что изменилось» и история блока с «Вернуть» (conceptChanges, lib/text-diff.js, DiffView, HistoryPanel, GonePanel);
//   5. тренажёр «Рассказ гостю за 30 секунд» (lib/concept-pitch.js, api/lesson-assist.js concept_pitch, ui/concept-pitch.jsx);
//   6. новичку в первый день «Знакомство с компанией» (lib/newbie.js, шаг d1e);
//   7. «О нас» одним файлом и лист ознакомления в PDF (lib/concept-pdf.js, lib/pdf.js — фото, api/report.js).
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v192.mjs; SQL: tools/claude/sql/test58.sh.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (!globalThis.sessionStorage) globalThis.sessionStorage = globalThis.localStorage;
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), documentElement: { classList: { contains: () => false } } };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { diffText, diffWords, diffCount, foldSame } from "../lib/text-diff.js";
import { normConcept, conceptAck, conceptChanges, conceptHero, conceptToc, conceptPitch, conceptModules, dayWords, dayDots, kindOf } from "../lib/concept.js";
import { pitchIdeas, pitchLocal, pitchClean, pitchPrompt, pitchWordCount, PITCH_LIMITS, PITCH_SECS } from "../lib/concept-pitch.js";
import { docxDoc, docxRels, docxXmlToText, DOCX_IMG } from "../lib/docx-text.js";
import { planJobs, assignPhotos, stripPhotoMarks, photoMarks, docBlockPayload } from "../lib/concept-ai.js";
import { blankBlock } from "../lib/concept.js";
import { PdfDoc, jpegInfo, b64Bytes } from "../lib/pdf.js";
import { conceptPdf, acksPdf, cleanConceptModel, cleanAcksModel, conceptFileName, acksFileName } from "../lib/concept-pdf.js";
import { NB_PLAN, NB_STEP_IDS, planOf, newbieModel, doneCount, totalCount } from "../lib/newbie.js";
import { STAGES } from "../lib/server-check.js";
import handler, { sanitize, PROMPT } from "../api/lesson-assist.js";
import reportHandler from "../api/report.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";
import { STAFF_PHOTOS } from "../tools/claude/demo-app/staff-photo-seed.js";
import { ConceptCtx, ConceptFoot } from "../ui/concept-foot.jsx";
import { ConceptCover, ChangesCard, DiffView, AckCard, ackWord } from "../ui/concept-more.jsx";
import { PitchScreen } from "../ui/concept-pitch.jsx";
import { AboutScreen } from "../ui/concept.jsx";
import { S } from "../ui/styles.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const T = S;
const JPG = Buffer.from(Object.values(STAFF_PHOTOS)[0].thumb, "base64");

const BL = (id, scope, kind, x = {}) => ({ id, scope, kind, title: x.title || kindOf(kind).title, body: x.body === undefined ? "Текст " + id : x.body, photos: x.photos || [],
  tracks: x.tracks || [], questions: x.questions || [], sort: x.sort || id, at: "2026-11-21T03:00:00Z", by: "Роман" });
const RAW = (x = {}) => ({ ok: true, mine: "Океан", restaurant: "Океан",
  net: { ver: "n2", at: "2026-11-20T05:00:00Z", blocks: [BL(1, "", "idea", { body: "Мы семь ресторанов на Камчатке.", photos: [{ id: 7, cap: "Первый зал" }] }), BL(2, "", "dress", { body: "Чёрный верх", photos: [{ id: 8, cap: "Форма" }] }),
    BL(3, "", "day", { tracks: ["manager"] })] },
  venue: { name: "Океан", ver: "v2", at: "2026-11-22T05:00:00Z", blocks: [BL(11, "Океан", "pitch", { body: "«Добрый вечер! Мы ресторан у моря: рыба и морепродукты с утреннего улова.»\n«Шеф готовит на открытом огне.»" }),
    BL(12, "Океан", "mood", { body: "Тёплый свет и джаз.", photos: [{ id: 9, cap: "Зал вечером" }] }), BL(13, "Океан", "own", { title: "Музыка", body: "Джаз по пятницам." })] },
  others: [], read: { net: "n1", venue: "v1" }, read_at: { net: "2026-11-10T08:00:00Z", venue: "2026-11-10T08:00:00Z" },
  changes: { net: { at: "2026-11-10T08:00:00Z", was: [{ id: 2, kind: "dress", title: "Дресс-код", body: "Белый верх", photos: [], tracks: [] }], fresh: [3], gone: [{ id: 4, kind: "check", title: "Чек", tracks: [], at: "2026-11-15T00:00:00Z" }] },
    venue: { at: "2026-11-11T08:00:00Z", was: [{ id: 12, kind: "mood", title: "Атмосфера", body: "Тёплый свет и джаз.", photos: [{ id: 9, cap: "Зал вечером" }], tracks: ["manager"] }], fresh: [13], gone: [] } },
  can: { net: false, venue: false }, venues: [], meta: { net: { title: "", sub: "", mode: "" }, venue: { title: "", sub: "", mode: "" } }, ...x });

describe("v192 · версия и журнал", () => {
  it("сборка v192, Дополнение 517, слова владельца, сценарии, этап 58 в списке и в README", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(192);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 517 — .*\(v192\)/);
    const part = c.slice(c.indexOf("# Дополнение 517"));
    expect(part.replace(/\s+/g, " ")).toContain("Ты правильно понял");
    expect(part.replace(/\s+/g, " ")).toContain("Делаем все 7");
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
    const tr = rd("tools/claude/README.md");
    expect(tr).toContain("e2e-v192.mjs");
    expect(tr).toContain("test58.sh");
    expect(STAGES.find((s) => s.n === "58")).toEqual({ n: "58", file: "supabase-stage58-concept-acks.sql", what: "«О нас»: «Ознакомлен(а)» с датой, лист ознакомления, что изменилось, история блоков", fn: "concept_history" });
    expect(rd("supabase/README.md")).toContain("supabase-stage58-concept-acks.sql");
    expect(rd("supabase/AI-SETUP.md")).toContain("## v192:");
  });
});

describe("v192 · что изменилось в тексте (lib/text-diff.js)", () => {
  it("строки: без изменений, добавили, убрали; переписанная строка — по словам", () => {
    const d = diffText("Главное.\n\n• Чёрный верх\n• Белый фартук\n• Обувь закрытая", "Главное.\n\n• Чёрный верх и брюки\n• Обувь закрытая\n• Волосы собраны");
    expect(d.map((x) => x.t)).toEqual(["same", "del", "mod", "same", "add"]);
    expect(diffCount(d)).toEqual({ add: 1, del: 1, mod: 1 });
    const mod = d.find((x) => x.t === "mod");
    expect(mod.segs).toEqual([{ t: "same", s: "• Чёрный верх" }, { t: "add", s: " и брюки" }]);
    expect(d.find((x) => x.t === "del").s).toBe("• Белый фартук");
    expect(d.find((x) => x.t === "add").s).toBe("• Волосы собраны");
  });
  it("слова: знаки препинания отдельно, лишние пробелы не в счёт; очень длинная строка — целиком «было / стало»", () => {
    expect(diffWords("Обувь закрытая", "Обувь закрытая, чёрная")).toEqual([{ t: "same", s: "Обувь закрытая" }, { t: "add", s: ", чёрная" }]);
    expect(diffWords("рыба  и море", "рыба и море")).toEqual([{ t: "same", s: "рыба и море" }]);   // показываем, как сейчас
    const long = Array.from({ length: 300 }, (_, i) => "слово" + i).join(" ");
    expect(diffWords(long, long + " конец").map((x) => x.t)).toEqual(["del", "add"]);
  });
  it("непохожие строки — «убрали» и «добавили», а не переписанная; свёртка без изменений", () => {
    const d = diffText("Абв где.\nКошка спит на окне.", "Абв где.\nСобака бежит по двору.");
    expect(d.map((x) => x.t)).toEqual(["same", "del", "add"]);
    const f = foldSame(diffText("стр1\nстр2\nстр3\nстр4\nстр5\nстр6", "стр1\nстр2\nстр3\nстр4\nстр5\nстр6 и ещё"), 1);
    expect(f.map((x) => x.t)).toEqual(["fold", "same", "mod"]);
    expect(f[0].n).toBe(4);
    expect(foldSame(diffText("x\ny", "x\ny"))).toEqual([{ t: "fold", n: 2 }]);
  });
});

describe("v192 · отметка, изменения, обложка (lib/concept.js)", () => {
  const c = normConcept(RAW());
  it("normConcept: даты редакций, когда отметил, что поменялось; без этапа 58 — пусто", () => {
    expect([c.net.at, c.venue.at, c.readAt.net, c.readAt.venue]).toEqual(["2026-11-20T05:00:00Z", "2026-11-22T05:00:00Z", "2026-11-10T08:00:00Z", "2026-11-10T08:00:00Z"]);
    expect(c.changes.net.was[0]).toEqual({ id: 2, kind: "dress", title: "Дресс-код", body: "Белый верх", photos: [], tracks: [] });
    expect([c.changes.net.fresh, c.changes.venue.fresh, c.changes.net.gone[0].title]).toEqual([[3], [13], "Чек"]);
    const old = normConcept({ ...RAW(), read_at: undefined, changes: undefined, net: { ...RAW().net, at: undefined } });
    expect([old.readAt, old.changes, old.net.at]).toEqual([{ net: "", venue: "" }, { net: null, venue: null }, ""]);
    expect(normConcept({ ...RAW(), changes: { net: { at: "x", was: [null, { id: "a" }], fresh: ["1", -2], gone: "нет" } } }).changes.net).toEqual({ at: "", was: [], fresh: [1], gone: [] });
  });
  it("conceptAck: нужна отметка, пока редакция новая; дата — последняя из двух частей; редакция — последняя правка", () => {
    expect(conceptAck(c)).toEqual({ has: true, need: true, at: "", edition: "2026-11-22T05:00:00Z" });
    const ok = normConcept(RAW({ read: { net: "n2", venue: "v2" }, read_at: { net: "2026-11-23T01:00:00Z", venue: "2026-11-23T02:00:00Z" } }));
    expect(conceptAck(ok)).toEqual({ has: true, need: false, at: "2026-11-23T02:00:00Z", edition: "2026-11-22T05:00:00Z" });
    expect(conceptAck(null)).toEqual({ has: false, need: false, at: "", edition: "" });
    expect(conceptAck(normConcept(RAW({ net: { ver: "", blocks: [] }, venue: null }))).has).toBe(false);
  });
  it("conceptChanges: правка, новые, убранные — только видимые треку; «для кого» поменяли, а видно как было — не изменение", () => {
    const s = conceptChanges(c, "seasonal");
    // «Распорядок» — менеджеру; «Атмосфера» раньше была только менеджеру, теперь всем — для официанта она новая
    expect(s.items.map((x) => x.type + ":" + x.id)).toEqual(["edit:2", "gone:4", "new:12", "new:13"]);
    expect(s.at).toBe("2026-11-10T08:00:00Z");
    expect(s.items[0].was.body).toBe("Белый верх");
    // менеджеру «Распорядок» новый, «Атмосфера» перестала быть только его — для него она тем же текстом, не изменение
    expect(conceptChanges(c, "manager").items.map((x) => x.type + ":" + x.id)).toEqual(["edit:2", "new:3", "gone:4", "new:13"]);
    // хостес «Атмосфера» раньше не была видна — теперь новая
    const c2 = normConcept(RAW({ changes: { net: null, venue: { at: "2026-11-11T08:00:00Z", was: [{ id: 12, kind: "mood", title: "Атмосфера", body: "Старый", photos: [], tracks: ["manager"] }], fresh: [], gone: [] } } }));
    expect(conceptChanges(c2, "spg").items.map((x) => x.type + ":" + x.id)).toEqual(["new:12"]);
    expect(conceptChanges(c2, "manager").items.map((x) => x.type + ":" + x.id)).toEqual(["edit:12"]);
    expect(conceptChanges(null, "spg")).toEqual({ at: "", items: [] });
  });
  it("обложка: фото атмосферы заведения; форма — не на обложку; оглавление — сеть, потом заведение", () => {
    expect(conceptHero(c, "seasonal")).toEqual({ id: 9, cap: "Зал вечером", kind: "mood" });
    expect(conceptHero(normConcept(RAW({ venue: null })), "seasonal")).toEqual({ id: 7, cap: "Первый зал", kind: "idea" });
    expect(conceptHero(normConcept(RAW({ venue: null, net: { ver: "n", blocks: [BL(2, "", "dress", { photos: [{ id: 8, cap: "" }] })] } })), "seasonal")).toBe(null);
    expect(conceptToc(c, "seasonal").map((x) => x.id + "|" + x.where)).toEqual(["1|Вся сеть", "2|Вся сеть", "11|Океан", "12|Океан", "13|Океан"]);
    expect(conceptToc(c, "seasonal", true).length).toBe(6);
  });
  it("рассказ гостю: образец заведения и факты раздела; без образца — null", () => {
    const p = conceptPitch(c, "seasonal");
    expect(p.ref).toBe("«Добрый вечер! Мы ресторан у моря: рыба и морепродукты с утреннего улова.»\n«Шеф готовит на открытом огне.»");
    expect(p.facts).toBe("Атмосфера: Тёплый свет и джаз.\nКонцепция и история: Мы семь ресторанов на Камчатке.");
    expect([p.where, p.title]).toEqual(["Океан", "Рассказ гостю за 30 секунд"]);
    expect(conceptPitch(normConcept(RAW({ venue: null })), "seasonal")).toBe(null);
  });
  it("даты словами и цифрами по часам телефона", () => {
    expect(dayWords("2026-11-20T05:00:00Z")).toMatch(/^20 ноября 2026$/);
    expect(dayDots("2026-11-20T05:00:00Z")).toBe("20.11.2026");
    expect([dayWords(""), dayDots(null), dayWords("мусор")]).toEqual(["", "", ""]);
  });
});

describe("v192 · тренажёр «Рассказ гостю за 30 секунд»", () => {
  const REF = "«Добрый вечер! Вы в «Океане». У нас всё из моря: рыбу и морепродукты привозят каждое утро. Краба можно выбрать в аквариуме у входа, а к рыбе подскажу вино.»";
  it("мысли образца: по предложениям, без приветствия и коротких", () => {
    expect(pitchIdeas(REF)).toEqual(["У нас всё из моря: рыбу и морепродукты привозят каждое утро.", "Краба можно выбрать в аквариуме у входа, а к рыбе подскажу вино."]);
    expect([PITCH_SECS, pitchWordCount("Добрый вечер, мы у моря!")]).toEqual([30, 5]);
  });
  it("разбор без помощника: что прозвучало (по основам слов), что нет, совет по длине, оценка", () => {
    const r = pitchLocal(REF, "Добрый вечер! Мы ресторан у моря, у нас рыба и морепродукты с утреннего улова, шеф готовит на открытом огне. Обязательно попробуйте что-нибудь с гриля, вам понравится, приходите ещё и приводите друзей, у нас уютно.", 25);
    expect(r.good).toEqual(["Прозвучало: «У нас всё из моря: рыбу и морепродукты привозят…»"]);
    expect(r.missed).toEqual(["Не прозвучало: «Краба можно выбрать в аквариуме у входа, а к…»"]);
    expect(r.tip).toBe("В следующий раз добавь то, что не прозвучало. Хватит одной фразы на каждое.");
    expect([r.score, r.local, r.better]).toEqual([4, true, ""]);
    expect(pitchLocal(REF, "Мы у моря.", 3).tip).toBe("Коротковато. Добавь, чем мы отличаемся и что гостю попробовать.");
    expect(pitchLocal(REF, Array.from({ length: 120 }, () => "слово").join(" "), 50).tip).toMatch(/^Длинновато для 30 секунд/);
  });
  it("ответ помощника: только известные поля и длины; без разбора — null", () => {
    expect(pitchClean({ good: ["a", "", "b"], missed: "c", tip: " совет ", better: "x".repeat(2000), score: "4", extra: 1 }))
      .toEqual({ good: ["a", "b"], missed: ["c"], tip: "совет", better: "x".repeat(PITCH_LIMITS.better), score: 4 });
    expect(pitchClean({ good: [], missed: [], tip: "" })).toBe(null);
    expect(pitchClean({ good: ["a"], score: 9 }).score).toBe(0);
  });
  it("задание помощнику: заведение, секунды, образец, факты, рассказ; JSON", () => {
    const p = pitchPrompt({ where: "Океан", ref: REF, facts: "Атмосфера: джаз", said: "Мы у моря", secs: 27 });
    for (const x of ["ресторана «Океан»", "уложился в 27 с", "ОБРАЗЕЦ:\n«Добрый вечер!", "ФАКТЫ О РЕСТОРАНЕ:\nАтмосфера: джаз", "РАССКАЗ СОТРУДНИКА:\nМы у моря",
      '{"good": ["…"], "missed": ["…"], "tip": "…", "better": "…", "score": 4}', "Не выдумывай фактов"]) expect(p, x).toContain(x);
  });
});

// ── сервер: /api/lesson-assist, режим concept_pitch — для всех сотрудников ─────────────────────────────
const WHO = { boss: { id: "u2", name: "Мария", position: "manager", is_admin: false }, staff: { id: "u3", name: "Анна", position: "waiter", is_admin: false } };
let modelCalls = [], modelAnswer = null;
const answer = (obj) => ({ model: "test-model", choices: [{ message: { content: typeof obj === "string" ? obj : JSON.stringify(obj) }, finish_reason: "stop" }] });
const serverFetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes("/rest/v1/rpc/whoami")) { const emp = WHO[JSON.parse(init.body).p_token]; return { ok: true, status: 200, json: async () => (emp ? { ok: true, employee: emp } : { ok: false }) }; }
  if (u.includes("openrouter.ai")) { modelCalls.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => modelAnswer }; }
  throw new Error("неожиданный адрес " + u);
};
const call = async (body) => {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; } };
  await handler({ method: "POST", body }, res);
  return out;
};
describe("v192 · /api/lesson-assist: concept_pitch", () => {
  beforeEach(() => { globalThis.fetch = serverFetch; process.env.OPENROUTER_API_KEY = "ключ"; modelCalls = []; modelAnswer = answer({ good: ["Начал с приветствия"], missed: ["Не сказал про краба"], tip: "Заверши предложением", better: "Мы у моря.", score: 3 }); });
  it("официант может: разбор приходит, в задании — образец и рассказ; другим режимам официант по-прежнему не нужен", async () => {
    const r = await call({ token: "staff", mode: "concept_pitch", title: "Океан", src: "«Мы у моря, краб в аквариуме.»", facts: "Атмосфера: джаз", text: "Добрый вечер, мы ресторан у моря.", secs: 26 });
    expect(r).toEqual({ status: 200, body: { ok: true, good: ["Начал с приветствия"], missed: ["Не сказал про краба"], tip: "Заверши предложением", better: "Мы у моря.", score: 3, model: "test-model" } });
    const prompt = modelCalls[0].messages[0].content[0].text;
    expect(prompt).toContain("ОБРАЗЕЦ:\n«Мы у моря, краб в аквариуме.»");
    expect(prompt).toContain("РАССКАЗ СОТРУДНИКА:\nДобрый вечер, мы ресторан у моря.");
    expect((await call({ token: "staff", mode: "concept_style", kind: "idea", title: "x", text: "Достаточно длинный текст блока для оформления." })).status).toBe(403);
  });
  it("проверки до модели: нет образца, слишком коротко, нет входа; ответ не по формату — 422", async () => {
    expect(await call({ token: "staff", mode: "concept_pitch", src: "", text: "Добрый вечер, мы у моря." })).toEqual({ status: 400, body: { ok: false, error: "В «О нас» нет образца рассказа гостю" } });
    expect(await call({ token: "staff", mode: "concept_pitch", src: "«Мы»", text: "Мы" })).toEqual({ status: 400, body: { ok: false, error: "Расскажи хотя бы пару предложений" } });
    expect((await call({ token: "нет", mode: "concept_pitch", src: "«Мы»", text: "Добрый вечер, мы у моря." })).status).toBe(401);
    expect(modelCalls.length).toBe(0);
    modelAnswer = answer("не JSON");
    expect((await call({ token: "boss", mode: "concept_pitch", src: "«Мы у моря»", text: "Добрый вечер, мы у моря." })).status).toBe(422);
  });
  it("план «Из документа» знает про картинки: метки в задании, номера в ответе", () => {
    expect(PROMPT.concept_plan("Океан", "x")).toContain("Строки «[фото N]» в материале — картинки документа");
    expect(PROMPT.concept_plan("Океан", "x")).toContain('"photos": [1]');
    expect(PROMPT.concept_block("Океан", "mood", "Атмосфера", "", [], 0, "x")).toContain("в текст блока их не переноси");
    expect(sanitize("concept_plan", { blocks: [{ kind: "mood", title: "А", src: "x [фото 1]", photos: [1, "2", 0, 99, 1] }] }).blocks[0].photos).toEqual([1, 2]);
    expect(sanitize("concept_block", { body: "Текст.\n[фото 2]\nЕщё [фото 3] слово" }).body).toBe("Текст.\n\nЕщё слово");
  });
});

// ── маленький .docx: архив без сжатия ──────────────────────────────────────────────────────────────
function zipStored(files) {
  const enc = new TextEncoder();
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const parts = [], cd = []; let off = 0;
  for (const [name, d0] of files) {
    const data = typeof d0 === "string" ? Buffer.from(enc.encode(d0)) : d0, nm = Buffer.from(enc.encode(name)), c = crc(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(c, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt32LE(c, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nm, data); cd.push(ch, nm); off += 30 + nm.length + data.length;
  }
  const cdb = Buffer.concat(cd), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cdb.length, 12); e.writeUInt32LE(off, 16);
  const z = Buffer.concat([...parts, cdb, e]);
  return z.buffer.slice(z.byteOffset, z.byteOffset + z.length);
}
const PIC = (rid, descr) => `<w:r><w:drawing><wp:inline><wp:docPr id="1" name="Picture 1" descr="${descr}"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="${rid}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
const REL = (id, target, type = "image", ext = "") => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"${ext}/>`;

describe("v192 · картинки из Word (lib/docx-text.js, lib/concept-ai.js)", () => {
  it("связи: только картинки внутри файла, путь в архиве", () => {
    expect(docxRels(`<Relationships>${REL("rId5", "media/image1.png")}${REL("rId6", "http://x/y.png", "image", ' TargetMode="External"')}${REL("rId7", "styles.xml", "styles")}${REL("rId8", "/word/media/a.jpg")}</Relationships>`))
      .toEqual({ rId5: "word/media/image1.png", rId8: "word/media/a.jpg" });
    expect(["a.png", "b.JPG", "c.jpeg", "d.gif", "e.webp", "f.bmp", "g.emf", "h.wmf", "i.tif"].filter((x) => DOCX_IMG.test(x))).toEqual(["a.png", "b.JPG", "c.jpeg", "d.gif", "e.webp", "f.bmp"]);
  });
  it("метки «[фото N]»: картинка отдельным абзацем — к тексту перед ней, в абзаце — после текста; без onImage — как раньше", () => {
    const xml = `<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Атмосфера</w:t></w:r></w:p><w:p>${PIC("rId7", "Зал")}</w:p>`
      + `<w:p><w:r><w:t>Тёплый свет.</w:t></w:r></w:p><w:p><w:r><w:t>Форма: чёрный верх.</w:t></w:r>${PIC("rId8", "Рисунок 2")}</w:p></w:body></w:document>`;
    const caps = [];
    const t = docxXmlToText(xml, (rid, cap) => { caps.push(cap); return rid === "rId7" ? 1 : 2; });
    expect(t).toBe("**Атмосфера**\n[фото 1]\n\nТёплый свет.\n\nФорма: чёрный верх.\n[фото 2]");
    expect(caps).toEqual(["Зал", ""]);   // «Рисунок 2» — имя по умолчанию, не подпись
    expect(docxXmlToText(xml)).toBe("**Атмосфера**\n\nТёплый свет.\n\nФорма: чёрный верх.");
  });
  it("docxDoc: текст с метками и картинки; EMF пропущен, одна картинка дважды — один номер, не больше max", async () => {
    const xml = `<w:document><w:body><w:p><w:r><w:t>Зал</w:t></w:r>${PIC("rId7", "Зал вечером")}</w:p><w:p><w:r><w:t>Ещё раз</w:t></w:r>${PIC("rId9", "")}</w:p>`
      + `<w:p><w:r><w:t>Схема</w:t></w:r>${PIC("rId8", "Схема")}</w:p></w:body></w:document>`;
    const rels = `<Relationships>${REL("rId7", "media/image1.jpeg")}${REL("rId9", "media/image1.jpeg")}${REL("rId8", "media/image2.emf")}</Relationships>`;
    const buf = zipStored([["word/document.xml", xml], ["word/_rels/document.xml.rels", rels], ["word/media/image1.jpeg", JPG], ["word/media/image2.emf", JPG]]);
    const d = await docxDoc(buf);
    expect(d.text).toBe("Зал\n[фото 1]\n\nЕщё раз\n[фото 1]\n\nСхема");
    expect(d.images.map((x) => [x.n, x.name, x.mime, x.bytes.length, x.cap])).toEqual([[1, "image1.jpeg", "image/jpeg", JPG.length, "Зал вечером"]]);
    expect((await docxDoc(buf, { max: 0 })).text).toBe("Зал\n\nЕщё раз\n\nСхема");
    await expect(docxDoc(new ArrayBuffer(10))).rejects.toThrow("zip");
  });
  it("по блокам: что предложил помощник, иначе метки в выдержке; одна картинка — одному блоку; лишние — без блока", () => {
    const jobs = planJobs([{ kind: "mood", title: "Атмосфера", src: "Зал [фото 1]", photos: [3] }, { kind: "dress", title: "Форма", src: "Форма [фото 2] [фото 1]" }, { kind: "own", title: "Ещё", src: "[фото 2]", photos: ["2"] }]);
    expect(jobs.map((j) => j.photos)).toEqual([[3], [], [2]]);
    const a = assignPhotos(jobs, [1, 2, 3, 4]);
    expect(a.jobs.map((j) => j.photos)).toEqual([[3], [2, 1], []]);
    expect(a.spare).toEqual([4]);
    expect(assignPhotos([{ src: "[фото 1] [фото 2] [фото 3]" }], [1, 2, 3], 2).jobs[0].photos).toEqual([1, 2]);
    expect(photoMarks("а [фото 2] б [фото 10]")).toEqual([2, 10]);
    expect(stripPhotoMarks("Текст.\n[фото 1]\n\n\nЕщё [фото 2] слово")).toBe("Текст.\n\nЕщё слово");
  });
  it("сохранение: новые фото — к прежним фото блока (до 8), у нового блока — свои; меток в тексте нет", () => {
    const tgt = { id: 5, scope: "Океан", kind: "mood", title: "Атмосфера", body: "x", photos: Array.from({ length: 7 }, (_, i) => ({ id: i + 1, cap: "" })), tracks: [], questions: [] };
    const r = docBlockPayload({ kind: "mood", title: "Атмосфера", body: "Свет.\n[фото 1]", questions: [] }, tgt, "Океан", blankBlock, [{ id: 50, cap: "Зал" }, { id: 51, cap: "" }]);
    expect([r.photos.length, r.photos[7], r.body]).toEqual([8, { id: 50, cap: "Зал" }, "Свет."]);
    const n = docBlockPayload({ kind: "mood", title: "", body: "Свет." }, null, "Океан", blankBlock, [{ id: 50, cap: "Зал" }]);
    expect([n.id, n.scope, n.title, n.photos]).toEqual([null, "Океан", "Атмосфера", [{ id: 50, cap: "Зал" }]]);
  });
});

describe("v192 · PDF: фото, «О нас» и лист ознакомления", () => {
  it("JPEG: размер и цвет из заголовка; не JPEG и CMYK — нет", () => {
    const i = jpegInfo(JPG);
    expect(i && i.w > 0 && i.h > 0 && i.comps === 3).toBe(true);
    expect(jpegInfo(Buffer.from("89504e470d0a1a0a", "hex"))).toBe(null);
    const cmyk = Buffer.from([0xFF, 0xD8, 0xFF, 0xC0, 0, 17, 8, 0, 10, 0, 10, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(jpegInfo(cmyk)).toBe(null);
    expect(b64Bytes("data:image/jpeg;base64,/9g=")).toEqual(new Uint8Array([0xFF, 0xD8]));
  });
  it("PdfDoc.image: фото — объектом XObject (DCTDecode), одно и то же — один раз; не JPEG — false", async () => {
    const f = await import("../lib/fonts/sa-serif.js");
    const pdf = new PdfDoc({ fonts: { regular: f.SA_SERIF_REGULAR } });
    const p = pdf.addPage();
    expect(pdf.image(p, JPG, 10, 10, 100, 60)).toBe(true);
    expect(pdf.image(p, JPG, 10, 80, 100, 60, { r: 6, fit: "contain" })).toBe(true);
    expect(pdf.image(p, Buffer.from("нет"), 0, 0, 1, 1)).toBe(false);
    const s = Buffer.from(pdf.save()).toString("latin1");
    expect((s.match(/\/Subtype \/Image/g) || []).length).toBe(1);
    expect(s).toContain("/Filter /DCTDecode");
    expect(s).toContain("/XObject << /Im1");
    expect((s.match(/\/Im1 Do/g) || []).length).toBe(2);
  });
  it("модели чистятся: длины, фото только base64, пустые части уходят", () => {
    const m = cleanConceptModel({ title: "x".repeat(100), parts: [{ where: "Сеть", blocks: [{ label: "Ценности", title: "", body: "Текст", photos: [{ b64: "<script>" }, { b64: JPG.toString("base64"), cap: "Зал" }] }] }, { where: "Пусто", blocks: [] }], hero: { b64: "x" } });
    expect([m.title.length, m.parts.length, m.parts[0].blocks[0].title, m.parts[0].blocks[0].photos.length, m.hero]).toEqual([60, 1, "Без заголовка", 1, null]);
    const a = cleanAcksModel({ rows: [{ name: "Анна Смирнова", pos: "Официант", at: "21.11.2026" }, { name: "" }], blanks: 99 });
    expect([a.rows.length, a.blanks, a.title]).toEqual([1, 20, "Наш ресторан"]);
    expect(cleanAcksModel(null).blanks).toBe(4);
  });
  it("«О нас» в PDF: обложка, содержание, блоки, фото, страницы; лист ознакомления — фамилия первой; имена файлов", () => {
    const model = { title: "Два моря", sub: "Концепция и стандарты", where: "Океан", edition: "20 ноября 2026", hero: { b64: JPG.toString("base64"), cap: "Зал" },
      parts: [{ where: "Вся сеть", blocks: [{ label: "Ценности", title: "Во что мы верим", body: "Главная мысль раздела в одном предложении для крупного шрифта.\n\n**Что важно**\n• Гость первым\n✅ Улыбаемся\n🚫 Не спорим\n1️⃣ Поздоровайся\n📌 Вывод\n«Добрый вечер!»", photos: [{ b64: JPG.toString("base64"), cap: "Команда" }] }] },
        { where: "Океан", blocks: [{ label: "", title: "Музыка", body: "Джаз по пятницам.", photos: [] }] }] };
    const s = Buffer.from(conceptPdf(model)).toString("latin1");
    expect(s.startsWith("%PDF-1.7")).toBe(true);
    expect((s.match(/\/Type \/Page\b/g) || []).length).toBe(3);   // обложка, содержание, блоки
    expect((s.match(/\/Subtype \/Image/g) || []).length).toBe(1);   // одно и то же фото — один раз
    const a = Buffer.from(acksPdf({ title: "Два моря", where: "Океан", edition: "20 ноября 2026", rows: [{ name: "Анна Смирнова", pos: "Официант", at: "21.11.2026" }] })).toString("latin1");
    expect((a.match(/\/Type \/Page\b/g) || []).length).toBe(1);
    expect(conceptFileName({ where: "Два моря, Океан" })).toBe("О нас, Два моря, Океан.pdf");
    expect(acksFileName({ title: "«Наш» ресторан" })).toBe("Лист ознакомления, Наш ресторан.pdf");
    // в документе для холдинга нет примет приложения
    expect(rd("lib/concept-pdf.js")).not.toMatch(/Service Academy"|SERVICE ACADEMY/);
  });
  it("/api/report: билет «О нас» и листа — PDF с понятным именем", async () => {
    const send = async (kind, payload) => {
      globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, kind, payload }) });
      const out = { status: 0, headers: {}, body: null };
      const res = { status(c) { out.status = c; return res; }, setHeader(k, v) { out.headers[k] = v; }, send(b) { out.body = b; return res; } };
      await reportHandler({ method: "GET", query: { t: "a".repeat(64) } }, res);
      return out;
    };
    const c = await send("concept_pdf", { title: "Два моря", where: "Океан", parts: [{ where: "Вся сеть", blocks: [{ title: "Кто мы", body: "Текст." }] }] });
    expect([c.status, c.headers["Content-Type"], c.body.slice(0, 5).toString()]).toEqual([200, "application/pdf", "%PDF-"]);
    expect(c.headers["Content-Disposition"]).toContain('filename="o-nas.pdf"');
    expect(c.headers["Content-Disposition"]).toContain(encodeURIComponent("О нас, Океан.pdf"));
    const a = await send("concept_acks_pdf", { title: "Два моря", where: "Океан", rows: [] });
    expect([a.status, a.headers["Content-Disposition"].includes('filename="list-oznakomleniya.pdf"')]).toEqual([200, true]);
  });
});

describe("v192 · новичку в первый день «Знакомство с компанией» (lib/newbie.js)", () => {
  const NB = newbieModel({ newbie: true, emp: "e1", name: "Ксения", day: "2026-11-23", started: "2026-11-23", checked: {}, confirm: {}, focus: [] });
  const cn = conceptModules(normConcept(RAW()), "seasonal", "#C8A96E", () => "book")[0];
  it("шаг d1e — второй в первом дне; с разделом «О нас» ведёт в него и отмечается сам после «Ознакомлен(а)»", () => {
    expect(NB_PLAN[0].steps.map((s) => s.id)).toEqual(["d1a", "d1e", "d1b", "d1c", "d1d"]);
    expect(NB_STEP_IDS.length).toBe(11);
    const st = (opts) => planOf(NB, { track: "seasonal", modules: [cn], ...opts }).sections[0].steps.find((s) => s.id === "d1e");
    expect(st({ cnAck: { has: true, need: true } })).toMatchObject({ text: "Знакомство с компанией", module: cn.id, auto: false, done: false, sub: "Раздел «Наш ресторан»: прочитай и отметь «Ознакомлен(а)» в конце" });
    expect(st({ cnAck: { has: true, need: false } })).toMatchObject({ auto: true, done: true });
    expect(planOf(newbieModel({ ...NB, checked: { d1e: "x" } }), { modules: [cn], cnAck: { has: true, need: true } }).sections[0].steps[1].done).toBe(true);
    // раздела нет — обычный шаг: расскажет наставник
    expect(planOf(NB, { modules: [] }).sections[0].steps[1]).toMatchObject({ auto: false, done: false, sub: "История, концепция и ценности: расскажет наставник" });
    expect([doneCount(newbieModel({ ...NB, checked: { d1e: "x" } })), totalCount(NB)]).toEqual([1, 11]);
  });
  it("экран новичка получает отметку и все темы (и «для ознакомления»): App", () => {
    const app = rd("App.jsx");
    expect(app).toContain("track={role} modules={programAllMods} completed={completed} quizDone={quizDone} cnAck={conceptAck(concept)} onBack={() => goBack(\"shift\")}");
    expect(app).toContain("onOpenModule={(id) => { const m = (programAllMods || []).find((x) => x.id === id); if (m) { setActiveModule(m); navigate(\"module\"); } }}");
    expect(rd("ui/newbie.jsx")).toContain("const plan = nb ? planOf(nb, { track, modules, completed, quizDone, cnAck }) : null;");
  });
});

describe("v192 · сервер демо — как этап 58", () => {
  const P = (id, name, surname, restaurant, position, x = {}) => ({ id, name, surname, restaurant, position, is_admin: false, ...x });
  const people = [P("m", "Мария", "Ким", "Океан", "manager"), P("a", "Анна", "Смирнова", "Океан", "waiter"), P("o", "Ольга", "Ли", "Океан", "hostess")];
  let t = Date.parse("2026-11-23T05:00:00Z");
  const clock = () => (t += 60000);
  const pings = [];
  const srv = makeServer({ today: "2026-11-23", rest: "Океан", people, tok: { tm: "m", ta: "a", to: "o" }, sstaff: [], cfg: { shifts: [] }, plan: {}, menu: [], tgLinked: ["a"], clock,
    concept: { net: [{ kind: "idea", title: "Сеть", body: "Мы у моря." }], venues: { "Океан": [{ kind: "setting", title: "Сервировка", body: "• Тарелка\n• Вилка слева" }, { kind: "check", title: "Чек", body: "2 800 ₽" }] } },
    ping: (to, text) => pings.push({ to, text }) });
  const get = (tk) => srv.rpc("concept_get", { p_token: tk });
  it("«Ознакомлен(а)»: дата — первая отметка редакции; повтор не двигает", () => {
    const r1 = srv.rpc("concept_read", { p_token: "ta", p_scope: "Океан" }), r2 = srv.rpc("concept_read", { p_token: "ta", p_scope: "Океан" });
    srv.rpc("concept_read", { p_token: "ta", p_scope: "" });
    expect([!!r1.at, r1.at === r2.at]).toEqual([true, true]);
    const g = get("ta");
    expect([g.read.venue === g.venue.ver, g.read_at.venue === r1.at, !!g.venue.at, g.changes]).toEqual([true, true, true, { net: null, venue: null }]);
  });
  it("правка — версия в истории; changes у Анны: что видела, новый, убранный; отметила — пусто", () => {
    const g = get("tm"), set = g.venue.blocks.find((b) => b.kind === "setting"), chk = g.venue.blocks.find((b) => b.kind === "check");
    srv.rpc("concept_save", { p_token: "tm", p_block: { ...set, body: "• Тарелка\n• Вилка слева\n• Свеча" } });
    srv.rpc("concept_save", { p_token: "tm", p_block: { scope: "Океан", kind: "own", title: "Музыка", body: "Джаз" } });
    srv.rpc("concept_order", { p_token: "tm", p_scope: "Океан", p_ids: [chk.id, set.id] });
    srv.rpc("concept_delete", { p_token: "tm", p_id: chk.id });
    const ch = get("ta").changes.venue;
    expect(ch.was).toEqual([{ id: set.id, kind: "setting", title: "Сервировка", body: "• Тарелка\n• Вилка слева", photos: [], tracks: [] }]);
    expect(ch.fresh.length).toBe(1);
    expect(ch.gone.map((x) => x.title)).toEqual(["Чек"]);
    const h = srv.rpc("concept_history", { p_token: "tm", p_id: set.id });
    expect([h.ok, h.versions.length, h.versions[0].gone_name]).toEqual([true, 1, "Мария Ким"]);   // порядок — не версия
    expect(srv.rpc("concept_history", { p_token: "ta", p_id: set.id }).error).toBe("forbidden");
    srv.rpc("concept_read", { p_token: "ta", p_scope: "Океан" });
    expect(get("ta").changes.venue).toBe(null);
  });
  it("«Вернуть»: версию — прежний текст, нынешний в историю; удалённый блок — тот же номер", () => {
    const g = get("tm"), set = g.venue.blocks.find((b) => b.kind === "setting");
    const h = srv.rpc("concept_history", { p_token: "tm", p_id: set.id }).versions[0];
    const r = srv.rpc("concept_revert", { p_token: "tm", p_hid: h.hid });
    expect([r.ok, r.block.body, srv.rpc("concept_history", { p_token: "tm", p_id: set.id }).versions.length]).toEqual([true, "• Тарелка\n• Вилка слева", 2]);
    const gone = srv.rpc("concept_history", { p_token: "tm", p_scope: "Океан" }).gone;
    expect(gone.map((x) => x.title)).toEqual(["Чек"]);
    const r2 = srv.rpc("concept_revert", { p_token: "tm", p_hid: gone[0].hid });
    expect([r2.ok, r2.block.id, srv.rpc("concept_history", { p_token: "tm", p_scope: "Океан" }).gone.length]).toEqual([true, gone[0].id, 0]);
  });
  it("лист: сам руководитель (me), дата у отметивших, прошлая отметка (was), даты редакций; бот просит «Ознакомлен(а)»", () => {
    const r = srv.rpc("concept_reads", { p_token: "tm" });
    const by = Object.fromEntries(r.rows.map((x) => [x.id, x]));
    expect([by.m.me, by.a.me, !!by.a.was, by.a.at, by.o.at, by.o.was, !!r.venue_at]).toEqual([true, false, true, null, null, null, true]);   // редакция после отметки Анны сменилась
    srv.rpc("concept_read", { p_token: "ta", p_scope: "Океан" });
    expect(!!srv.rpc("concept_reads", { p_token: "tm" }).rows.find((x) => x.id === "a").at).toBe(true);
    srv.rpc("concept_notify", { p_token: "tm", p_scope: "Океан" });
    expect(pings[pings.length - 1].text).toBe("Обновили «О нас»: концепция и стандарты «Океан».\nПосмотри, что изменилось, и отметь «Ознакомлен(а)».");
  });
  it("билет на файл: «О нас» — любому, лист — руководителю", () => {
    expect(srv.rpc("concept_ticket", { p_token: "ta", p_kind: "concept_pdf", p_payload: { a: 1 } }).ticket).toMatch(/^.{64}$/);
    expect(srv.rpc("concept_ticket", { p_token: "ta", p_kind: "concept_acks_pdf", p_payload: { a: 1 } }).error).toBe("forbidden");
    expect(srv.rpc("concept_ticket", { p_token: "tm", p_kind: "team_pdf", p_payload: {} }).error).toBe("kind");
  });
  it("без этапа 58 — функций нет, концепция как раньше", () => {
    const s2 = makeServer({ today: "2026-11-23", rest: "Океан", people, tok: { tm: "m" }, sstaff: [], cfg: { shifts: [] }, plan: {}, menu: [], noStage58: true, concept: { net: [{ kind: "idea", title: "Сеть", body: "x" }] } });
    expect(s2.rpc("concept_history", { p_token: "tm", p_scope: "" }).code).toBe("PGRST202");
    const g = s2.rpc("concept_get", { p_token: "tm" });
    expect([g.read_at, g.changes, g.net.at]).toEqual([undefined, undefined, undefined]);
  });
});

describe("v192 · этап 58 (supabase-stage58-concept-acks.sql)", () => {
  const sql = rd("supabase/supabase-stage58-concept-acks.sql");
  it("нужны этапы 49 и 57; история — триггером; дата отметки не двигается; changes; лист; вернуть; билет; новичок", () => {
    for (const x of ["raise exception 'Сначала этап 49", "raise exception 'Сначала этап 57", "create table if not exists sa_concept_hist",
      "create trigger sa_concept_blocks_hist before update or delete on sa_concept_blocks", "is not distinct from (new.kind, new.title, new.body, new.photos, new.tracks, new.questions)",
      "read_at = case when sa_concept_reads.ver = excluded.ver then sa_concept_reads.read_at else now() end",
      "'read_at', jsonb_build_object('net', an, 'venue', av)", "_sa_cn_changes('', an)", "'me', e.id::text = c->>'id'", "'was', greatest(rn.read_at, rv.read_at)",
      "create or replace function concept_history(p_token text, p_scope text default '', p_id bigint default null)", "create or replace function concept_revert(p_token text, p_hid bigint)",
      "p_kind not in ('concept_pdf', 'concept_acks_pdf')", "'d1a', 'd1b', 'd1c', 'd1d', 'd1e', 'd2a', 'd2b', 'd2d', 'd3a'", "отметь «Ознакомлен(а)»",
      "perform set_config('sa.cn_by'", "not exists (select 1 from sa_concept_hist o, jsonb_array_elements(o.photos) y where o.scope = sc"]) expect(sql, x).toContain(x);
    expect(sql).toContain("concept_ticket(text, text, jsonb) to anon, authenticated");
    expect(sql).not.toMatch(/drop function if exists concept_read/);   // подпись concept_read прежняя: повтор этапа 49 не создаст второй
  });
});

describe("v192 · экран (ui/concept-more.jsx, ui/concept-foot.jsx, ui/concept-pitch.jsx)", () => {
  const c = { line: "#333", chip: "#222", soft: "#999", warn: "#E4B36A", ok: "#8AD8AF", field: "#111" };
  const n = normConcept(RAW());
  it("обложка: фото, название, где ты сейчас, оглавление с пометкой изменённых", () => {
    const ack = conceptAck(n), chg = conceptChanges(n, "seasonal");
    const html = R(h(ConceptCover, { T, a11y: false, c, sec: { title: "Marin", sub: "Кто мы" }, where: "Океан", hero: { id: 9 }, ack, chg, toc: conceptToc(n, "seasonal"), female: true, onJump: () => {} }));
    expect(html).toContain('data-cn-cover="photo"');
    expect(html).toContain("Marin");
    expect(html).toContain('data-cn-status="changed"');
    expect(html).toContain("Изменилось после твоей отметки: 4. Посмотри и отметь внизу.");
    expect((html.match(/data-cn-toc="/g) || []).length).toBe(5);
    expect((html.match(/aria-label="(новый|изменён)"/g) || []).length).toBe(3);
    const okHtml = R(h(ConceptCover, { T, a11y: false, c, sec: { title: "Marin", sub: "" }, where: "", hero: null, ack: { has: true, need: false, at: "2026-11-23T02:00:00Z" }, chg: { items: [] }, toc: [], female: false, onJump: () => {} }));
    expect(okHtml).toContain('data-cn-cover="text"');
    expect(okHtml).toMatch(/Ознакомлен 23 ноября 2026\./);
  });
  it("«Что изменилось»: изменён и новый — кнопки к блоку, убрали — зачёркнуто без кнопки", () => {
    const html = R(h(ChangesCard, { T, c, chg: conceptChanges(n, "seasonal"), onJump: () => {} }));
    expect(html).toContain('data-cn-changes="4"');
    expect((html.match(/<button[^>]*data-lens-row=""[^>]*data-cn-chg="(edit|new)"/g) || []).length).toBe(3);
    expect(html).toContain('<div data-cn-chg="gone"');
    expect(html).toContain("После твоей отметки 10 ноября 2026.");
  });
  it("что поменялось в блоке: строки и слова, свёрнутые без изменений, заголовок и фото", () => {
    const html = R(h(DiffView, { T, c, was: { title: "Форма", body: "Главное.\n• Чёрный верх\n• Белый фартук\n• Обувь", photos: [{ id: 1 }] }, now: { title: "Дресс-код", body: "Главное.\n• Чёрный верх и брюки\n• Обувь\n• Волосы собраны", photos: [{ id: 2 }] } }));
    expect(html).toContain('data-cn-diff="1/1/1"');
    expect(html).toContain("data-cn-diff-title");
    expect(html).toMatch(/<ins[^>]*> и брюки<\/ins>/);
    expect(html).toContain("data-cn-diff-del");
    expect(html).toContain('data-cn-diff-photos="1/1"');
  });
  it("отметка: «Прочитала раздел?» и «Ознакомлена»; отмечено — дата и редакция; слово по имени", () => {
    expect([ackWord(true), ackWord(false), ackWord(null)]).toEqual(["Ознакомлена", "Ознакомлен", "Ознакомлен(а)"]);
    const need = R(h(AckCard, { T, c, ack: { has: true, need: true }, busy: false, onAck: () => {}, female: true, main: {}, onPrint: () => {} }));
    expect(need).toContain("Прочитала раздел?");
    expect(need).toMatch(/data-lens-btn="main" data-cn-read=""[^>]*>Ознакомлена</);
    expect(need).toContain('data-cn-print=""');
    const ok = R(h(AckCard, { T, c, ack: { has: true, need: false, at: "2026-11-23T02:00:00Z", edition: "2026-11-22T05:00:00Z" }, busy: false, onAck: () => {}, female: null, main: {} }));
    expect(ok).toContain("Ознакомлен(а) 23 ноября 2026");
    expect(ok).toContain("Редакция от 22 ноября 2026. Обновят, придёт сообщение.");
    expect(R(h(AckCard, { T, c, ack: { has: false } }))).toBe("");
  });
  it("внизу раздела в треке: ждёт уроков, потом «Ознакомлена»; тренажёр; без App — ничего", () => {
    const mod = conceptModules(n, "seasonal", "#C8A96E", () => "book")[0];
    const ctx = (x = {}) => ({ concept: n, word: "Ознакомлена", busy: false, onAck() {}, onAbout() {}, onPitch() {}, ...x });
    const wrap = (value, completed = {}) => R(h(ConceptCtx.Provider, { value }, h(ConceptFoot, { mod, completed })));
    const w = wrap(ctx());
    expect(w).toContain('data-cn-foot="need"');
    expect(w).toContain('data-cn-footack="wait"');
    expect(w).toMatch(/после уроков: осталось \d+/);
    expect(w).toContain("data-cn-footpitch");
    expect(w).toContain("Или прочитай весь раздел одной страницей");
    const all = Object.fromEntries(mod.lessons.map((l) => [l.id, true]));
    expect(wrap(ctx(), all)).toContain('data-cn-footack="go"');
    const ok = wrap(ctx({ concept: normConcept(RAW({ read: { net: "n2", venue: "v2" }, read_at: { net: "2026-11-23T01:00:00Z", venue: "2026-11-23T02:00:00Z" }, changes: null })) }));
    expect(ok).toContain('data-cn-foot="ok"');
    expect(ok).toContain("23 ноября 2026");
    expect(R(h(ConceptFoot, { mod, completed: {} }))).toBe("");
    expect(wrap(ctx(), {}).length > 0 && R(h(ConceptCtx.Provider, { value: ctx() }, h(ConceptFoot, { mod: { ...mod, concept: false } })))).toBe("");
  });
  it("тренажёр: без образца — объяснение; с образцом — вопрос гостя и «Начать»", () => {
    expect(R(h(PitchScreen, { T, a11y: false, concept: normConcept(RAW({ venue: null })), track: "seasonal", onBack() {} }))).toContain('data-pitch="none"');
    const html = R(h(PitchScreen, { T, a11y: false, concept: n, track: "seasonal", onBack() {} }));
    expect(html).toContain('data-pitch="intro"');
    expect(html).toContain("Что у вас за место?");
    expect(html).toContain("data-pitch-start");
  });
  it("«О нас» сотруднику: обложка, «Что изменилось», пометки блоков, «Потренироваться», отметка", () => {
    const html = R(h(AboutScreen, { T, a11y: false, profile: { name: "Анна", surname: "Смирнова", position: "waiter", restaurant: "Океан" }, role: "seasonal", concept: n, onBack() {}, onPitch() {} }));
    for (const x of ['data-cn-cover="photo"', 'data-cn-changes="4"', 'data-cn-badge="edit"', 'data-cn-badge="new"', "data-cn-pitch", 'data-cn-ack="need"', "Прочитала раздел?"]) expect(html, x).toContain(x);
  });
  it("связи: меню раздела рисует низ «О нас», App даёт ConceptCtx и экран тренажёра", () => {
    expect(rd("ui/module-menu.jsx")).toContain("{mod.concept ? <ConceptFoot mod={mod} completed={completed} passive={passive} /> : null}");
    const app = rd("App.jsx");
    expect(app).toContain("<ConceptCtx.Provider value={cnCtx}>");
    expect(app).toContain("</ConceptCtx.Provider>");
    expect(app).toContain('{screen === "pitch" && profile && <div className="sa-tabpad"><Suspense fallback={<ScreenLoader T={T} />}><PitchScreen T={T} a11y={a11y} concept={concept} track={pitchTrack || role} onBack={() => goBack("about")} /></Suspense></div>}');
  });
  it("тексты: без тире-ритма и эмодзи; у каждой кнопки — метка «Линзы»; мелкого текста нет", () => {
    for (const f of ["ui/concept-more.jsx", "ui/concept-foot.jsx", "ui/concept-pitch.jsx", "ui/concept-print.js", "ui/concept.jsx", "lib/concept.js", "lib/text-diff.js", "lib/concept-pdf.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(/\p{Extended_Pictographic}/u.test(code(rd(f))), f).toBe(false);
    }
    for (const f of ["ui/concept-more.jsx", "ui/concept-pitch.jsx"]) {
      const attrs = rd(f).split("<button").slice(1).map((x) => x.slice(0, x.indexOf("onClick")));
      expect(attrs.filter((x) => !/data-lens/.test(x)), f).toEqual([]);
      expect(rd(f), f).not.toMatch(/fontSize:\s*(8|8\.5|9|9\.5|10)(?=\s*[,}\s])/);
    }
  });
});
