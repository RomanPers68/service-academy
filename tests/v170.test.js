// v170 (Доп. 495): «Показать все» для глав из документа. Владелец (16.11), на «если нужна кнопка „показать все“, скажи»:
// «Да, давай сделаем „показать все“». Главы, которые ассистент разложил из документа, ложатся в раздел скрытыми (v169);
// показывать их приходилось по одной.
//   • ui/ref-split.jsx — номера написанных ассистентом глав запоминаются на телефоне (SPLIT_NEW); RefSplitNew — строка
//     «Из документа: N глав ещё скрыто» и «Показать все (N)» над списком глав раздела, второе нажатие подтверждает;
//   • ui/ref-editor.jsx — showChapterRows и запись одной правкой; скрытое владельцем вручную не трогается.
// Сервер менять не нужно. Разметки JSX в файле нет (Доп. 482). Вид в браузере — tools/claude/e2e-v170.mjs.
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

import { RefSplit, RefSplitNew, makeSplitJob, SPLIT_NEW, splitNewIds, splitRemember, splitForget, splitPrune, splitHiddenNew } from "../ui/ref-split";
import { addHiddenChapter, showChapterRows, RE_BASE } from "../ui/ref-editor";
import { refEditTree, saveRefBook } from "../lib/ref-edit";
import { loadRefBook, refItemsNow, _resetRefBook } from "../lib/ref-book";
import { _resetLessonPhotos } from "../lib/lesson-photo";
import { setPhotoBackend, memoryBackend } from "../lib/photo-store";
import { tones, glass } from "../ui/analytics-kit";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";
import { REFERENCE_APP_COURSE } from "../data/reference";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html) => html.replace(/<[^>]+>/g, "");
const noop = () => {};
const uiOf = (a11y) => { const dark = !a11y; return { input: { fontSize: 14 }, primary: { fontSize: 15 }, G: (x) => glass(null, a11y, x), txt: dark ? "#EFE4C8" : "#2A2113", muted: "#BFAE8A", gold: "#C8A96E", brd: "rgba(214,178,102,0.30)", TN: tones(a11y) }; };
const wipe = () => { for (const k of Object.keys(store0)) delete store0[k]; };
const ch = (id, more = {}) => ({ id, title: "Глава " + id, own: true, hidden: true, ...more });

describe("v170 · версия и журнал", () => {
  it("сборка v170, Дополнение 495, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(170);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 495 — .*\(v170\)/);
    const part = c.slice(c.indexOf("# Дополнение 495"));
    expect(part.replace(/\s+/g, " ")).toContain("Да, давай сделаем");
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v170.mjs");
  });
});

describe("v170 · 1: какие главы написал ассистент (ui/ref-split.jsx, память телефона)", () => {
  beforeEach(wipe);
  it("запомнить и забыть: по разделам, без повторов; пусто — записи на телефоне нет", () => {
    expect(SPLIT_NEW).toBe("sa_ref_split_new_v1");
    expect(splitNewIds("rs-1")).toEqual([]);
    splitRemember("rs-1", "rc-a"); splitRemember("rs-1", "rc-b"); splitRemember("rs-1", "rc-a"); splitRemember("coffee", "rc-c");
    splitRemember("", "rc-x"); splitRemember("rs-1", "");
    expect(JSON.parse(phone.getItem(SPLIT_NEW))).toEqual({ "rs-1": ["rc-a", "rc-b"], coffee: ["rc-c"] });
    expect(splitNewIds("rs-1")).toEqual(["rc-a", "rc-b"]);
    splitForget("rs-1", ["rc-a", "rc-нет"]);
    expect(splitNewIds("rs-1")).toEqual(["rc-b"]);
    splitForget("rs-1", ["rc-b"]);
    expect(JSON.parse(phone.getItem(SPLIT_NEW))).toEqual({ coffee: ["rc-c"] });
    splitForget("coffee", ["rc-c"]);
    expect(phone.getItem(SPLIT_NEW)).toBeNull();
    splitForget("coffee", null);   // нечего забывать — не падает
    expect(phone.getItem(SPLIT_NEW)).toBeNull();
  });
  it("на раздел помнится не больше шестидесяти глав: самые давние забываются; мусор на телефоне не мешает", () => {
    for (let i = 0; i < 65; i++) splitRemember("rs-1", "rc-" + i);
    const ids = splitNewIds("rs-1");
    expect([ids.length, ids[0], ids[59]]).toEqual([60, "rc-5", "rc-64"]);
    for (const junk of ["не JSON", "[1,2]", "null", '{"rs-1":"строка"}', '{"rs-1":[1,null,"rc-a",""]}']) {
      phone.setItem(SPLIT_NEW, junk);
      expect(splitNewIds("rs-1"), junk).toEqual(junk.includes("rc-a") ? ["rc-a"] : []);
    }
    phone.setItem(SPLIT_NEW, "не JSON");
    splitRemember("rs-1", "rc-b");
    expect(splitNewIds("rs-1")).toEqual(["rc-b"]);
  });
  it("ещё скрытые главы из документа: свои, скрытые и из запомненных; остальное не в счёт", () => {
    splitRemember("rs-1", "rc-a"); splitRemember("rs-1", "rc-b"); splitRemember("rs-1", "rc-shown"); splitRemember("rs-1", "rc-gone"); splitRemember("rs-1", "srv-base");
    const sec = { id: "rs-1", title: "Стандарты", lessons: [ch("rc-old", { hidden: false }), ch("rc-mine"), ch("rc-a"), ch("rc-shown", { hidden: false }), ch("srv-base", { own: false }), ch("rc-b"), null] };
    expect(splitHiddenNew(sec).map((l) => l.id)).toEqual(["rc-a", "rc-b"]);   // «rc-mine» владелец скрыл сам: её не трогаем
    expect(splitHiddenNew({ ...sec, id: "coffee" })).toEqual([]);              // память — по разделам
    expect(splitHiddenNew(sec, ["rc-mine"]).map((l) => l.id)).toEqual(["rc-mine"]);
    for (const bad of [null, undefined, {}, { id: "rs-1" }, { id: "rs-1", lessons: "нет" }]) expect(splitHiddenNew(bad)).toEqual([]);
  });
  it("уборка памяти: показанные, удалённые и перенесённые главы забываются; ещё скрытые — помнятся", () => {
    for (const id of ["rc-a", "rc-shown", "rc-gone", "rc-b"]) splitRemember("rs-1", id);
    splitRemember("coffee", "rc-c");
    splitPrune("rs-1", [ch("rc-a"), ch("rc-shown", { hidden: false }), ch("rc-b"), ch("rc-mine"), null]);
    expect(splitNewIds("rs-1")).toEqual(["rc-a", "rc-b"]);
    expect(splitNewIds("coffee")).toEqual(["rc-c"]);   // другой раздел не тронут
    splitPrune("rs-1", [ch("rc-a", { hidden: false }), ch("rc-b", { hidden: false })]);
    expect(splitNewIds("rs-1")).toEqual([]);
    splitPrune("coffee", null);   // раздела больше нет
    expect(phone.getItem(SPLIT_NEW)).toBeNull();
  });
});

describe("v170 · 2: ассистент запоминает написанное (makeSplitJob)", () => {
  let bad, saveBad;
  const DOC = "Встреча гостя\nВстречаем гостя у входа за десять секунд.\nЗдороваемся и называем заведение.\n\nПодача вина\nБутылку показываем гостю этикеткой.\nПробу наливаем тому, кто заказал.\n\nРасчёт\nСчёт приносим в течение трёх минут.\nСдачу отдаём до копейки.";
  const PLAN = [{ title: "Встреча гостя", about: "Как встречаем." }, { title: "Подача вина", about: "Порядок подачи." }, { title: "Расчёт", about: "Счёт и сдача." }];
  const save = async (c) => (saveBad.has(c.title) ? { ok: false, error: "Не записалось: нет связи. Попробуй ещё раз." } : { ok: true, id: "rc-" + c.title });
  beforeEach(() => {
    wipe(); phone.setItem("sa_session_token", "owner"); bad = new Set(); saveBad = new Set();
    globalThis.fetch = async (url, init = {}) => { const b = JSON.parse(init.body);
      const r = b.mode === "ref_plan" ? { ok: true, chapters: PLAN } : bad.has(b.title) ? { ok: false, error: "Ассистент не ответил. Попробуй ещё раз." } : { ok: true, title: b.title, content: "Текст главы «" + b.title + "»." };
      return { ok: true, status: 200, json: async () => r }; };
  });
  it("записанная глава запоминается сразу; не написанная и не записавшаяся — нет; дописали — запомнилась", async () => {
    const j = makeSplitJob(save);
    j.open({ id: "rs-1", title: "Стандарты" }); j.patch({ text: DOC });
    await j.plan();
    bad.add("Подача вина"); saveBad.add("Расчёт");
    await j.run();
    expect(splitNewIds("rs-1")).toEqual(["rc-Встреча гостя"]);
    bad.clear(); saveBad.clear();
    await j.run();
    expect(splitNewIds("rs-1")).toEqual(["rc-Встреча гостя", "rc-Подача вина", "rc-Расчёт"]);
    j.close();   // «Готово» памяти не стирает: главы ещё скрыты
    expect(splitNewIds("rs-1").length).toBe(3);
    expect(splitNewIds("rs-2")).toEqual([]);
    expect(rd("ui/ref-split.jsx")).toContain("if (w && w.ok) { splitRemember(s.sec, w.id); row(i, { state: \"done\", content: \"\", err: \"\", id: w.id || \"\" }); fails = 0; continue; }");
  });
});

describe("v170 · 3: строка «Из документа» и «Показать все» (RefSplitNew)", () => {
  beforeEach(wipe);
  const secOf = (lessons, id = "rs-1") => ({ id, title: "Стандарты", lessons });
  const view = (sec, p = {}, a11y = false) => R(h(RefSplitNew, { sec, busy: false, onShow: noop, ui: uiOf(a11y), ...p }));
  it("ассистент ничего не писал или всё уже показано — строки нет, даже если в разделе есть скрытые главы", () => {
    expect(view(secOf([ch("rc-mine"), ch("rc-old", { hidden: false })]))).toBe("");
    splitRemember("rs-1", "rc-a");
    expect(view(secOf([ch("rc-a", { hidden: false }), ch("rc-mine")]))).toBe("");
    expect(view(secOf([]))).toBe("");
  });
  it("три главы ещё скрыты: сколько их, подсказка и «Показать все (3)»; считаются только главы ассистента", () => {
    for (const id of ["rc-a", "rc-b", "rc-c"]) splitRemember("rs-1", id);
    const html = view(secOf([ch("rc-old", { hidden: false }), ch("rc-mine"), ch("rc-a"), ch("rc-b"), ch("rc-c")]));
    expect(html).toContain('data-rs-new="3"');
    expect(text(html)).toBe("Из документа: 3 главы ещё скрыты.Проверил? Покажи команде одной кнопкой.Показать все (3)");
    expect(html).toMatch(/data-rs-show-all=""[^>]*data-lens-btn="soft"/);
    expect(html).not.toMatch(/data-rs-show-all=""[^>]*disabled=""/);
    expect(view(secOf([ch("rc-a"), ch("rc-b"), ch("rc-c")]), { busy: true })).toMatch(/data-rs-show-all=""[^>]*disabled=""/);   // экран что-то записывает
    expect(view(secOf([ch("rc-a"), ch("rc-b"), ch("rc-c")]), {}, true)).toContain('data-rs-new="3"');                              // светлая тема
  });
  it("счёт склоняется; одна глава — «Показать главу»", () => {
    for (let i = 0; i < 6; i++) splitRemember("rs-1", "rc-" + i);
    const of = (n) => text(view(secOf(Array.from({ length: n }, (_, i) => ch("rc-" + i)))));
    expect(of(1)).toBe("Из документа: 1 глава ещё скрыта.Проверил? Покажи команде одной кнопкой.Показать главу");
    expect(of(2)).toContain("Из документа: 2 главы ещё скрыты.");
    expect(of(5)).toContain("Из документа: 5 глав ещё скрыто.");
    expect(of(5)).toContain("Показать все (5)");
  });
  it("первое нажатие спрашивает, второе показывает; другой раздел или другой счёт — вопрос заново", () => {
    const src = rd("ui/ref-split.jsx");
    expect(src).toContain("onClick={() => { if (!sure) { setSure(true); vibrate(\"light\"); return; } onShow(fresh); }}");
    expect(src).toContain('{sure ? "Да, показать " + counted(n, "главу", "главы", "глав") : n === 1 ? "Показать главу" : "Показать все (" + n + ")"}');
    expect(src).toContain('{sure ? (n === 1 ? "Её" : "Их") + " сразу увидят все заведения." : "Проверил? Покажи команде одной кнопкой."}');   // одна глава — «её»
    expect(src).toContain("React.useEffect(() => { setSure(false); }, [sec && sec.id, n]);");
    expect(src.indexOf("const [sure, setSure] = React.useState(false);")).toBeLessThan(src.indexOf("if (!n) return null;"));   // правило хуков
  });
  it("о кнопке сказано в главе «Инструменты руководителя»", () => {
    const leader = REFERENCE_APP_COURSE.lessons.find((l) => l.id === "app-leader").content;
    expect(leader).toContain("они ложатся в раздел скрытыми, пока владелец не проверит. Показать их команде можно все разом, одной кнопкой. Факты ассистент ищет");
  });
  it("в итоге раскладки сказано про кнопку над списком глав", () => {
    const row = (title) => ({ title, about: "", on: true, dup: false, state: "done", err: "", content: "", id: "rc-" + title });
    const st = { sec: "rs-1", secTitle: "Стандарты", phase: "done", text: "", pdf: null, err: "", rows: [row("Подача вина"), row("Расчёт")], stopped: false, halting: false };
    const html = R(h(RefSplit, { a11y: false, job: { st, open: noop, close: noop, patch: noop, pickPdf: noop, plan: noop, setRow: noop, run: noop, halt: noop }, sec: secOf([]), ui: uiOf(false) }));
    expect(text(html)).toContain("Новые главы скрыты: команда их не видит. Открой каждую, проверь и нажми в ней «Показать главу». Или покажи все разом кнопкой над списком глав.");
  });
});

describe("v170 · 4: показать одной записью (ui/ref-editor.jsx)", () => {
  let srv;
  const lessons = (sec) => refEditTree(RE_BASE, refItemsNow()).find((s) => s.id === sec).lessons;
  const onServer = () => Object.values(srv.S.rb.items).filter((x) => x.kind === "ch").sort((p, q) => p.sort - q.sort).map((x) => [x.title, x.hidden]);
  beforeEach(async () => {
    wipe();
    setPhotoBackend(memoryBackend()); _resetLessonPhotos(); _resetRefBook();
    srv = makeServer({ today: "2026-11-16", rest: "Два моря, Океан", people: [{ id: "u-roman", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "owner", is_admin: true }], tok: { tr: "u-roman" }, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false });
    globalThis.fetch = async (u, init = {}) => ({ ok: true, status: 200, json: async () => srv.rpc(String(u).split("/rpc/")[1], JSON.parse(init.body || "{}")) });
    phone.setItem("sa_session_token", "tr");
    srv.rpc("ref_book_save", { p_token: "tr", p_del: [], p_items: [{ id: "rs-1", kind: "sec", parent: "", title: "Стандарты", sub: null, body: null, hidden: false, sort: null },
      { id: "rc-mine", kind: "ch", parent: "rs-1", title: "Черновик владельца", sub: null, body: "Текст, который владелец скрыл сам.", hidden: true, sort: 10 }] });
    await loadRefBook(true);
  });
  it("главы ассистента становятся видны, текст и место те же; скрытое владельцем остаётся скрытым", async () => {
    const a = await addHiddenChapter({ title: "Подача вина", content: "**Подача вина**\n1. Показываем бутылку." }, "rs-1");
    const b = await addHiddenChapter({ title: "Расчёт", content: "Текст про расчёт.", after: a.id }, "rs-1");
    splitRemember("rs-1", a.id); splitRemember("rs-1", b.id);
    expect(onServer()).toEqual([["Черновик владельца", true], ["Подача вина", true], ["Расчёт", true]]);
    const sec = { id: "rs-1", lessons: lessons("rs-1") };
    const fresh = splitHiddenNew(sec);
    expect(fresh.map((l) => l.title)).toEqual(["Подача вина", "Расчёт"]);
    const put = showChapterRows(fresh);
    expect(put).toEqual([{ id: a.id, kind: "ch", parent: "rs-1", title: "Подача вина", sub: null, body: "**Подача вина**\n1. Показываем бутылку.", hidden: false, sort: 20 },
      { id: b.id, kind: "ch", parent: "rs-1", title: "Расчёт", sub: null, body: "Текст про расчёт.", hidden: false, sort: 30 }]);
    expect((await saveRefBook(put, [])).ok).toBe(true);
    expect(onServer()).toEqual([["Черновик владельца", true], ["Подача вина", false], ["Расчёт", false]]);
    expect(lessons("rs-1").map((l) => [l.title, l.hidden, l.content.length > 5])).toEqual([["Черновик владельца", true, true], ["Подача вина", false, true], ["Расчёт", false, true]]);
    expect(splitHiddenNew({ id: "rs-1", lessons: lessons("rs-1") })).toEqual([]);   // показаны — строка «Из документа» уходит
    expect(showChapterRows(null)).toEqual([]);
  });
  it("экран раздела: строка стоит над списком глав; запись одной правкой, потом память чистится", () => {
    const src = rd("ui/ref-editor.jsx");
    expect(src).toContain('import { RefSplit, RefSplitNew, useRefSplit, splitPrune, splitForget } from "./ref-split";');
    expect(src).toContain('<RefSplitNew sec={sec} busy={busy} onShow={showNew} ui={{ G, txt, muted, gold: a11y ? "#7A5D2A" : GOLD, brd, primary }} />');
    expect(src.indexOf("<RefSplitNew ")).toBeGreaterThan(src.indexOf('data-re-empty=""'));
    expect(src.indexOf("<RefSplitNew ")).toBeLessThan(src.indexOf("{sec.lessons.map((l, i) => {"));
    expect(src).toContain("const put = showChapterRows(list);");
    expect(src).toContain('if (!(await run(put, [], "Показано: " + counted(n, "глава", "главы", "глав") + ". Команда увидит " + (n === 1 ? "её" : "их") + ", когда откроет справочник."))) return;');
    expect(src).toContain("splitPrune(sec.id, now ? now.lessons : []);");   // память чистится по живому справочнику
    expect(src).toContain("export const showChapterRows = (list) => (Array.isArray(list) ? list : []).map((l) => ({ ...refRow(l, \"ch\"), hidden: false }));");
  });
  it("показал или скрыл главу сам, кнопкой в главе — она больше не «из документа»: дальше это решение владельца", () => {
    const src = rd("ui/ref-editor.jsx");
    expect(src).toContain("if (await (refRowEmpty(row) ? run([], [id], say) : run([row], [], say))) splitForget(at, [id]);");
    expect(src).toContain('say = chNode.hidden ? "Глава снова видна команде." : "Глава скрыта от команды.", at = chNode.sec, id = chNode.id;');
    // обе кнопки главы (в пометке «Глава скрыта» и внизу) ведут в одно место
    expect(src.split("onClick={hideCh}").length - 1).toBe(2);
    // сама уборка: глава, которую показали и потом скрыли вручную, в счёт не вернётся
    splitRemember("rs-1", "rc-a"); splitRemember("rs-1", "rc-b");
    splitForget("rs-1", ["rc-a"]);
    expect(splitHiddenNew({ id: "rs-1", lessons: [ch("rc-a"), ch("rc-b")] }).map((l) => l.id)).toEqual(["rc-b"]);
    wipe();
  });
});
