// v171 (Доп. 496): строка «Из документа» видна с любого устройства. Владелец (16.11), на «Если нужно, чтобы строка была
// видна и с других устройств, скажи»: «Давай что бы была видна везде». В v170 номера глав, написанных ассистентом, помнил
// телефон, и строка с кнопкой «Показать все» была только на нём.
//   • lib/ref-edit.js — REF_FRESH: пометка «из документа, ещё не показана» в строке самой главы на сервере (поле sub: у глав
//     оно больше ничем не занято); refFresh — глава ждёт показа; chapterRow сохраняет пометку при правке текста и переносе;
//   • ui/ref-editor.jsx — ассистент ставит пометку (addHiddenChapter), показ снимает её («Показать все» и кнопка в главе);
//   • ui/ref-split.jsx — строка считает главы по пометке; память телефона больше не пополняется, прежняя читается.
// Этапа SQL нет: этап 53 хранит sub у любой строки. Разметки JSX в файле нет (Доп. 482). Вид в браузере — tools/claude/e2e-v171.mjs.
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

import { RefSplitNew, makeSplitJob, SPLIT_NEW, splitHiddenNew } from "../ui/ref-split";
import { addHiddenChapter, showChapterRows, RE_BASE } from "../ui/ref-editor";
import { REF_FRESH, refFresh, chapterRow, refRow, reorderPut, refEditTree, saveRefBook } from "../lib/ref-edit";
import { loadRefBook, refItemsNow, normRefItems, _resetRefBook, RB_CACHE } from "../lib/ref-book";
import { _resetLessonPhotos } from "../lib/lesson-photo";
import { setPhotoBackend, memoryBackend } from "../lib/photo-store";
import { tones, glass } from "../ui/analytics-kit";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html) => html.replace(/<[^>]+>/g, "");
const noop = () => {};
const uiOf = (a11y) => { const dark = !a11y; return { input: { fontSize: 14 }, primary: { fontSize: 15 }, G: (x) => glass(null, a11y, x), txt: dark ? "#EFE4C8" : "#2A2113", muted: "#BFAE8A", gold: "#C8A96E", brd: "rgba(214,178,102,0.30)", TN: tones(a11y) }; };
const wipe = () => { for (const k of Object.keys(store0)) delete store0[k]; };
// глава из дерева редактора: it — её строка на сервере
const node = (id, it = {}, more = {}) => ({ id, title: "Глава " + id, content: "Текст", own: true, hidden: it.hidden !== false, sec: "rs-1", home: "rs-1",
  it: { id, kind: "ch", parent: "rs-1", title: "Глава " + id, sub: null, body: "Текст", hidden: true, sort: null, ...it }, nat: null, ...more });

describe("v171 · версия и журнал", () => {
  it("сборка v171, Дополнение 496, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(171);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 496 — .*\(v171\)/);
    const part = c.slice(c.indexOf("# Дополнение 496"));
    expect(part.replace(/\s+/g, " ")).toContain("Давай что бы была видна везде");
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v171.mjs");
  });
});

describe("v171 · 1: пометка «из документа» в строке главы (lib/ref-edit.js)", () => {
  it("пометка — слово в поле sub; глава ждёт показа, пока она своя, скрыта и с пометкой", () => {
    expect(REF_FRESH).toBe("doc");
    expect(refFresh(node("rc-a", { sub: REF_FRESH }))).toBe(true);
    expect(refFresh(node("rc-a", { sub: REF_FRESH, hidden: false }))).toBe(false);          // уже показана
    expect(refFresh(node("rc-a", { sub: null }))).toBe(false);                               // скрыта владельцем
    expect(refFresh(node("rc-a", { sub: "подзаголовок" }))).toBe(false);                      // чужое слово в поле — не пометка
    expect(refFresh(node("srv-base", { sub: REF_FRESH }, { own: false }))).toBe(false);      // штатную главу ассистент не пишет
    expect(refFresh({ id: "rc-a", own: true, hidden: true, it: null })).toBe(false);
    for (const bad of [null, undefined, {}, "rc-a"]) expect(refFresh(bad)).toBe(false);
  });
  it("правка текста и перенос в другой раздел пометку сохраняют, пока глава скрыта", () => {
    const fresh = node("rc-a", { sub: REF_FRESH, sort: 20 });
    expect(chapterRow(fresh, { title: "Подача вина", body: "Новый текст", parent: "rs-1" }))
      .toEqual({ id: "rc-a", kind: "ch", parent: "rs-1", title: "Подача вина", sub: "doc", body: "Новый текст", hidden: true, sort: 20 });
    expect(chapterRow(fresh, { title: "Подача вина", body: "Новый текст", parent: "coffee" }).sub).toBe("doc");
    expect(chapterRow(fresh, { title: "Подача вина", body: "Новый текст", parent: "coffee" }).parent).toBe("coffee");
  });
  it("у показанной главы, у главы владельца, у новой и у штатной пометки нет", () => {
    const d = { title: "Глава", body: "Текст", parent: "rs-1" };
    expect(chapterRow(node("rc-a", { sub: REF_FRESH, hidden: false }), d).sub).toBeNull();   // пометка осталась от старой сборки — снимается
    expect(chapterRow(node("rc-a", { sub: null }), d).sub).toBeNull();
    expect(chapterRow(node("rc-a", { sub: "подзаголовок" }), d).sub).toBeNull();
    expect(chapterRow({ id: "rc-new", own: true, sec: "rs-1" }, d)).toEqual({ id: "rc-new", kind: "ch", parent: "rs-1", title: "Глава", sub: null, body: "Текст", hidden: false, sort: null });
    const base = { id: "srv-base", own: false, sec: "serving", home: "serving", baseTitle: "Глава", baseContent: "Текст", it: { parent: "", title: null, sub: REF_FRESH, body: null, hidden: true, sort: null } };
    expect(chapterRow(base, { title: "Глава", body: "Текст", parent: "serving" }).sub).toBeNull();
  });
  it("перестановка глав пометку не трогает: строка главы пишется как есть", () => {
    const a = node("rc-a", { sub: REF_FRESH, sort: 10 }), b = node("rc-b", { sub: null, sort: 20 }), c = node("rc-c", { sub: REF_FRESH, sort: 30 });
    expect(refRow(a, "ch").sub).toBe("doc");
    const put = reorderPut([a, b, c], ["rc-c", "rc-a", "rc-b"], "ch");
    expect(put.map((r) => [r.id, r.sub, r.sort, r.hidden])).toEqual([["rc-c", "doc", 10, true], ["rc-a", "doc", 20, true], ["rc-b", null, 30, true]]);
  });
  it("сервер хранит sub у любой строки, телефон его читает: этап SQL не нужен", () => {
    const sql = rd("supabase/supabase-stage53-ref-book.sql");
    expect(sql).toContain("nullif(it->>'title', ''), nullif(it->>'sub', ''), it->>'body'");
    expect(sql).toContain("title = excluded.title, sub = excluded.sub, body = excluded.body");
    expect(sql).toContain("'title', i.title, 'sub', i.sub,");
    expect(sql).toContain("length(coalesce(it->>'sub', '')) > 240");
    expect(sql).not.toMatch(/kind\s*=\s*'ch'[^\n]*sub/);   // от вида строки поле не зависит
    expect(normRefItems([{ id: "rc-a", kind: "ch", parent: "rs-1", title: "Глава", sub: "doc", body: "Текст", hidden: true, sort: 10 }])[0].sub).toBe("doc");
  });
});

describe("v171 · 2: ассистент ставит пометку, и её видно с любого устройства (сервер в странице)", () => {
  let srv;
  const lessons = (sec) => { const s = refEditTree(RE_BASE, refItemsNow()).find((x) => x.id === sec); return s ? s.lessons : []; };
  const secOf = (id) => ({ id, lessons: lessons(id) });
  const onServer = () => Object.values(srv.S.rb.items).filter((x) => x.kind === "ch").sort((p, q) => (p.parent < q.parent ? -1 : p.parent > q.parent ? 1 : 0) || p.sort - q.sort).map((x) => [x.title, x.parent, x.hidden, x.sub]);
  // другое устройство: в памяти телефона пусто, справочник приходит с сервера
  const otherDevice = async () => { wipe(); phone.setItem("sa_session_token", "tr"); _resetRefBook(); await loadRefBook(true); };
  beforeEach(async () => {
    wipe();
    setPhotoBackend(memoryBackend()); _resetLessonPhotos(); _resetRefBook();
    srv = makeServer({ today: "2026-11-16", rest: "Два моря, Океан", people: [{ id: "u-roman", name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "owner", is_admin: true }], tok: { tr: "u-roman" }, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false });
    globalThis.fetch = async (u, init = {}) => ({ ok: true, status: 200, json: async () => srv.rpc(String(u).split("/rpc/")[1], JSON.parse(init.body || "{}")) });
    phone.setItem("sa_session_token", "tr");
    srv.rpc("ref_book_save", { p_token: "tr", p_del: [], p_items: [{ id: "rs-1", kind: "sec", parent: "", title: "Стандарты", sub: "Как мы работаем", body: null, hidden: false, sort: null },
      { id: "rs-2", kind: "sec", parent: "", title: "Бар", sub: null, body: null, hidden: false, sort: null },
      { id: "rc-mine", kind: "ch", parent: "rs-1", title: "Черновик владельца", sub: null, body: "Текст, который владелец скрыл сам.", hidden: true, sort: 10 }] });
    await loadRefBook(true);
  });
  it("глава ассистента ложится скрытой и с пометкой; соседки при вставке в середину пометку не теряют", async () => {
    const a = await addHiddenChapter({ title: "Расчёт", content: "Текст про расчёт." }, "rs-1");
    const b = await addHiddenChapter({ title: "Подача вина", content: "Текст про вино.", before: a.id }, "rs-1");   // дописана позже, встаёт перед «Расчётом»
    expect(a.ok && b.ok).toBe(true);
    expect(onServer()).toEqual([["Черновик владельца", "rs-1", true, null], ["Подача вина", "rs-1", true, "doc"], ["Расчёт", "rs-1", true, "doc"]]);
    expect(rd("ui/ref-editor.jsx")).toContain("hidden: true, sub: REF_FRESH };");
    expect(phone.getItem(SPLIT_NEW)).toBeNull();   // телефон ничего не запоминал
  });
  it("на другом устройстве строка считает те же главы: память телефона пуста, пометка пришла с сервера", async () => {
    await addHiddenChapter({ title: "Подача вина", content: "Текст про вино." }, "rs-1");
    await addHiddenChapter({ title: "Расчёт", content: "Текст про расчёт." }, "rs-1");
    await otherDevice();
    expect(phone.getItem(SPLIT_NEW)).toBeNull();
    expect(splitHiddenNew(secOf("rs-1")).map((l) => l.title)).toEqual(["Подача вина", "Расчёт"]);   // «Черновик владельца» — не в счёт
    const html = R(h(RefSplitNew, { sec: secOf("rs-1"), busy: false, onShow: noop, ui: uiOf(false) }));
    expect(html).toContain('data-rs-new="2"');
    expect(text(html)).toBe("Из документа: 2 главы ещё скрыты.Проверил? Покажи команде одной кнопкой.Показать все (2)");
    expect(splitHiddenNew(secOf("rs-2"))).toEqual([]);
  });
  it("копия справочника на телефоне пометку тоже хранит: строка есть и до ответа сервера", async () => {
    await addHiddenChapter({ title: "Подача вина", content: "Текст про вино." }, "rs-1");
    expect(JSON.parse(phone.getItem(RB_CACHE)).items.find((x) => x.title === "Подача вина").sub).toBe("doc");
    _resetRefBook();   // приложение открыли заново: сервер ещё не ответил, справочник — из копии
    expect(splitHiddenNew(secOf("rs-1")).map((l) => l.title)).toEqual(["Подача вина"]);
  });
  it("«Показать все» снимает пометку; глава, которую потом скрыли вручную, в счёт не возвращается ни на одном устройстве", async () => {
    await addHiddenChapter({ title: "Подача вина", content: "Текст про вино." }, "rs-1");
    await addHiddenChapter({ title: "Расчёт", content: "Текст про расчёт." }, "rs-1");
    const put = showChapterRows(splitHiddenNew(secOf("rs-1")));
    expect(put.map((r) => [r.title, r.hidden, r.sub, r.body.length > 5])).toEqual([["Подача вина", false, null, true], ["Расчёт", false, null, true]]);
    expect((await saveRefBook(put, [])).ok).toBe(true);
    expect(onServer()).toEqual([["Черновик владельца", "rs-1", true, null], ["Подача вина", "rs-1", false, null], ["Расчёт", "rs-1", false, null]]);
    // владелец скрыл показанную главу кнопкой в главе: запись та же, что делает hideCh
    const wine = lessons("rs-1").find((l) => l.title === "Подача вина");
    expect((await saveRefBook([{ ...refRow(wine, "ch"), hidden: true, sub: null }], [])).ok).toBe(true);
    expect(splitHiddenNew(secOf("rs-1"))).toEqual([]);
    await otherDevice();
    expect(splitHiddenNew(secOf("rs-1"))).toEqual([]);
    expect(lessons("rs-1").filter((l) => l.hidden).map((l) => l.title)).toEqual(["Черновик владельца", "Подача вина"]);
  });
  it("кнопка в главе («Показать главу» и «Скрыть главу») снимает пометку той же записью", () => {
    const src = rd("ui/ref-editor.jsx");
    expect(src).toContain('const row = { ...refRow(chNode, "ch"), hidden: !chNode.hidden, sub: null }, say = chNode.hidden ? "Глава снова видна команде." : "Глава скрыта от команды.", at = chNode.sec, id = chNode.id;');
    expect(src).toContain("export const showChapterRows = (list) => (Array.isArray(list) ? list : []).map((l) => ({ ...refRow(l, \"ch\"), hidden: false, sub: null }));");
    expect(src).toContain("refFmt, refInsertLine, refPhotoLine, sameText, REF_FRESH,");
  });
  it("владелец поправил текст новой главы — она по-прежнему ждёт показа; перенёс в другой раздел — строка там", async () => {
    await addHiddenChapter({ title: "Подача вина", content: "Текст про вино." }, "rs-1");
    let wine = lessons("rs-1").find((l) => l.title === "Подача вина");
    expect((await saveRefBook([chapterRow(wine, { title: "Подача вина и игристого", body: "Исправленный текст.", parent: "rs-1" })], [])).ok).toBe(true);
    expect(splitHiddenNew(secOf("rs-1")).map((l) => [l.title, l.content])).toEqual([["Подача вина и игристого", "Исправленный текст."]]);
    wine = lessons("rs-1").find((l) => l.title === "Подача вина и игристого");
    expect((await saveRefBook([chapterRow(wine, { title: wine.title, body: wine.content, parent: "rs-2" })], [])).ok).toBe(true);
    await otherDevice();
    expect(splitHiddenNew(secOf("rs-1"))).toEqual([]);
    expect(splitHiddenNew(secOf("rs-2")).map((l) => l.title)).toEqual(["Подача вина и игристого"]);   // в v170 память была по разделам, и глава терялась из счёта
    expect(onServer().find((x) => x[0] === "Подача вина и игристого")).toEqual(["Подача вина и игристого", "rs-2", true, "doc"]);
  });
});

describe("v171 · 3: строка «Из документа» — по пометке и по прежней памяти телефона (ui/ref-split.jsx)", () => {
  beforeEach(wipe);
  it("считаются главы с пометкой и те, что запомнила сборка v170; дважды одна глава не считается", () => {
    phone.setItem(SPLIT_NEW, JSON.stringify({ "rs-1": ["rc-old170", "rc-both", "rc-shown"] }));
    const sec = { id: "rs-1", lessons: [node("rc-mine"), node("rc-new", { sub: REF_FRESH }), node("rc-old170"), node("rc-both", { sub: REF_FRESH }), node("rc-shown", { hidden: false }), node("rc-seen", { sub: REF_FRESH, hidden: false })] };
    expect(splitHiddenNew(sec).map((l) => l.id)).toEqual(["rc-new", "rc-old170", "rc-both"]);
    wipe();
    expect(splitHiddenNew(sec).map((l) => l.id)).toEqual(["rc-new", "rc-both"]);   // на другом устройстве — только то, что с пометкой
    const src = rd("ui/ref-split.jsx");
    expect(src).toContain("(sec && Array.isArray(sec.lessons) ? sec.lessons : []).filter((l) => l && l.own && l.hidden && (refFresh(l) || ids.includes(l.id)));");
    expect(src).toContain('import { refFresh } from "../lib/ref-edit";');
  });
  it("строка по одной пометке, без памяти телефона: счёт, подсказка и кнопка те же, что в v170", () => {
    const sec = { id: "rs-1", lessons: [node("rc-mine"), node("rc-a", { sub: REF_FRESH }), node("rc-b", { sub: REF_FRESH }), node("rc-c", { sub: REF_FRESH })] };
    const html = R(h(RefSplitNew, { sec, busy: false, onShow: noop, ui: uiOf(false) }));
    expect(html).toContain('data-rs-new="3"');
    expect(text(html)).toBe("Из документа: 3 главы ещё скрыты.Проверил? Покажи команде одной кнопкой.Показать все (3)");
    expect(R(h(RefSplitNew, { sec: { id: "rs-1", lessons: [node("rc-mine")] }, busy: false, onShow: noop, ui: uiOf(true) }))).toBe("");
  });
  it("ассистент пишет главы — телефон ничего не запоминает", async () => {
    phone.setItem("sa_session_token", "owner");
    const PLAN = [{ title: "Подача вина", about: "Порядок подачи." }, { title: "Расчёт", about: "Счёт и сдача." }];
    globalThis.fetch = async (url, init = {}) => { const b = JSON.parse(init.body); return { ok: true, status: 200, json: async () => (b.mode === "ref_plan" ? { ok: true, chapters: PLAN } : { ok: true, title: b.title, content: "Текст главы «" + b.title + "»." }) }; };
    const saved = [];
    const j = makeSplitJob(async (c, sec) => { saved.push([c.title, sec]); return { ok: true, id: "rc-" + saved.length }; });
    j.open({ id: "rs-1", title: "Стандарты" });
    j.patch({ text: "Подача вина\nБутылку показываем гостю этикеткой.\nПробу наливаем тому, кто заказал.\n\nРасчёт\nСчёт приносим в течение трёх минут.\nСдачу отдаём до копейки.\n\n" + "Правило сервиса. ".repeat(20) });
    await j.plan();
    await j.run();
    expect(saved).toEqual([["Подача вина", "rs-1"], ["Расчёт", "rs-1"]]);
    expect(phone.getItem(SPLIT_NEW)).toBeNull();
    j.dispose();
  });
});
