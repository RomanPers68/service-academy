// v158 (Доп. 483): владелец (14.11) на «что ещё заметил» — «Давай все пять»: строка под кнопкой после «Урок пройден»,
// фото остаются на телефоне, плитки у глав Справочника (и своё фото главы), буквы в кружках — имя, потом фамилия, фото
// сотрудников в кружках (этап 52). Разметки JSX в файле нет: тесты на GitHub читают .js как обычный код (Доп. 482).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import React from "react";
import { renderToString } from "react-dom/server";
import { doneNote } from "../lib/lesson-done";
import { DoneNote } from "../ui/lesson-done";
import { photoGet, photoPut, photoAll, photoDrop, photoPrune, setPhotoBackend, memoryBackend, FULL_KEEP } from "../lib/photo-store";
import {
  lessonPhotoUrl, lessonPhotoCached, loadLessonPhotos, warmLessonPhotos, saveLessonPhoto, removeLessonPhoto, photoOf, _resetLessonPhotos,
} from "../lib/lesson-photo";
import { chapterImages, chapterThumb } from "../lib/reference-thumb";
import { ILL_MINI, hasIllMini, renderIllMini } from "../ui/reference-illustrations";
import { REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE } from "../data/reference";
import { REFERENCE_PHOTOS } from "../data/reference-photos";
import {
  normStaffPhotos, staffPhotoOf, normName, initialsOfPerson, loadStaffPhotos, staffPhotoListNow, staffThumbUrl, staffThumbCached, staffFullUrl,
  saveStaffPhoto, removeStaffPhoto, staffPhotosToModerate, staffPhotoErr, warmStaffPhotos, cropInit, cropClamp, cropMove, cropZoom, cropRect,
  cropSide, CROP_MAX_ZOOM, SP_LIMITS, SP_BATCH, SP_CACHE, _resetStaffPhotos,
} from "../lib/staff-photo";
import { FaceImg, MyFaceLayer, StaffPhotoSheet } from "../ui/staff-photo";
import { LessonCover, LessonPhotoSheet } from "../ui/lesson-photo";
import { rowsSurnameFirst, mateName } from "../lib/shift-mates";
import { STAGES } from "../lib/server-check";
import { GUIDE } from "../ui/guide";
import { ShiftHero, TeamHero, HubScreen } from "../ui/home-hubs";
import { S } from "../ui/styles";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const sp = (s) => String(s).replace(/ /g, " ");
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// ── сервер в памяти (тот же, что в демо) и «телефон» ────────────────────────────────────────────────
const R0 = "Два моря, Океан", R1 = "Порт";
const PEOPLE = [
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-darya", name: "Дарья", surname: "Лебедева", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ivan", name: "Иван", surname: "Петров", restaurant: R1, position: "waiter", is_admin: false },
  { id: "e-irina", name: "Ирина", surname: "Портова", restaurant: R1, position: "manager", is_admin: false },
  { id: "e-oleg", name: "Олег", surname: "Ушедший", restaurant: R0, position: "waiter", is_admin: false, status: "fired" },
];
const TOK = { tr: "u-roman", tm: "u-maria", ta: "e-anna", td: "e-darya", ti: "e-ivan", tp: "e-irina", to: "e-oleg" };
const b64 = (s, n) => s.repeat(n);
const F1 = b64("QUJD", 40), T1 = b64("REVG", 12), F2 = b64("R0hJ", 44), T2 = b64("SktM", 12), F3 = b64("TU5P", 48), T3 = b64("UFFS", 12);
const url = (x) => "data:image/jpeg;base64," + x;
const mk = (x = {}) => makeServer({ today: "2026-11-14", rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, ...x });

const realFetch = globalThis.fetch, realLS = globalThis.localStorage;
let calls = [];
const useServer = (srv) => {
  globalThis.fetch = async (u, init = {}) => {
    const fn = String(u).split("/rpc/")[1], body = JSON.parse(init.body || "{}");
    calls.push([fn, body]);
    return { ok: true, status: 200, json: async () => srv.rpc(fn, body) };
  };
};
const phone = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; };
const login = (tok) => globalThis.localStorage.setItem("sa_session_token", tok);
const fnCalls = (fn) => calls.filter((c) => c[0] === fn);
const T = S;

describe("v158: метка сборки, журнал и памятки", () => {
  it("«сборка v158» и новее; CHANGES — Дополнение 483 со словами владельца; проверки названы в памятке", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    expect(n[0]).toBeGreaterThanOrEqual(158);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 483 — .*\(v158\)/);
    expect(c).toContain("Давай все пять");
    expect(c).toContain("Может ты что-то еще заметил, что можно улучшить?");
    const tools = rd("tools/claude/README.md");
    expect(tools).toContain("e2e-v158.mjs");
    expect(tools).toContain("test52.sh");
  });
  it("гид: «Моё фото» во вкладке «Я»", () => {
    const me = GUIDE.find((g) => g.tab === "Я").items.find((x) => x.key === "myphoto");
    expect(me.title).toBe("Моё фото");
    expect(me.go).toBe("me");
    expect(me.text).toContain("«Я» → кружок рядом с именем");
    expect(me.text).toContain("«Фото команды»");
    expect(me.text).not.toMatch(/ — /);
  });
});

describe("v158 · 1: после «Урок пройден» — бокал цели дня и остаток раздела (lib/lesson-done.js)", () => {
  it("слова: цель ещё впереди, цель есть, раздел пройден; склонения шагов", () => {
    const a = doneNote({ steps: 1, goal: 2 }, 3);
    expect(a.goal).toMatchObject({ reached: false, steps: 1, of: 2, pct: 0.5, from: 0, text: "Цель дня: 1 из 2" });
    expect(sp(a.left.text)).toBe("До конца раздела 3 шага");
    expect(a.left.text).toContain("3 шага");   // число не отрывается от слова
    const b = doneNote({ steps: 2, goal: 2 }, 0);
    expect(b.goal).toMatchObject({ reached: true, pct: 1, from: 0.5, text: "Цель дня есть" });
    expect(b.left).toEqual({ n: 0, text: "Раздел пройден" });
    const c = doneNote({ steps: 5, goal: 2 }, null);
    expect(c.goal).toMatchObject({ reached: true, steps: 2, pct: 1, from: 1 });
    expect(c.left).toBe(null);
    for (const [n, w] of [[1, "шаг"], [2, "шага"], [4, "шага"], [5, "шагов"], [11, "шагов"], [21, "шаг"], [22, "шага"]]) expect(sp(doneNote(null, n).left.text)).toBe("До конца раздела " + n + " " + w);
  });
  it("сказать нечего — ничего и не рисуем; мусор на входе не роняет", () => {
    expect(doneNote(null, null)).toBe(null);
    expect(doneNote({ steps: 3, goal: 0 }, undefined)).toBe(null);
    expect(doneNote({ steps: "x", goal: "2" }, "").goal.text).toBe("Цель дня: 0 из 2");
    expect(doneNote({}, "3.9").left.n).toBe(3);
    expect(doneNote({}, -4).left.n).toBe(0);
    expect(doneNote({}, "abc")).toBe(null);
    expect(R(h(DoneNote, { goal: null, left: null }))).toBe("");
  });
  it("строка: бокал сначала такой, каким был до урока (доливается на глазах), слова — рядом; в обеих темах", () => {
    const html = R(h(DoneNote, { goal: { steps: 1, goal: 2 }, left: 3 }));
    expect(html).toContain('data-done-note=""');
    expect(html).toContain('role="status"');
    expect(html).toContain('data-done-goal="going"');
    expect(html).toContain('data-emb="wine" data-pct="0"');
    expect(html).toContain("Цель дня: 1 из 2");
    expect(html).toContain('data-done-left="3"');
    const done = R(h(DoneNote, { goal: { steps: 2, goal: 2 }, left: 0, a11y: true, sub: "#6B5B40" }));
    expect(done).toContain('data-done-goal="reached"');
    expect(done).toContain('data-emb="wine" data-pct="50"');
    expect(done).toContain("Цель дня есть");
    expect(done).toContain("Раздел пройден");
    expect(done).toContain("color:#6B5B40");
    expect(html).not.toMatch(/data-lens/);   // тихая строка, не кнопка и не карточка
  });
  it("урок: строка стоит под кнопкой «Далее», кнопка не сдвигается; App считает остаток раздела; шторок нет", () => {
    const L = rd("ui/screens-learning.jsx");
    const next = L.indexOf('{next === null ? "Дальше ›" : "К модулю ›"}</button>'), note = L.indexOf("<DoneNote goal={goal} left={modLeft}"), toMod = L.indexOf("<div onClick={onToModule}");
    expect(next).toBeGreaterThan(0);
    expect(note).toBeGreaterThan(next);
    expect(toMod).toBeGreaterThan(note);
    expect(L).toContain("goal = null, modLeft = null, onAskMentor");
    const A = rd("App.jsx");
    expect(A).toContain("const left = modSteps.length ? modSteps.filter((l) => !isDone(l)).length : null;");
    expect(A).toContain("modLeft={lessonDone ? lessonDone.left : null}");
    expect(rd("ui/lesson-done.jsx")).not.toMatch(/position:\s*"fixed"|backdrop|veil/);
  });
});

describe("v158 · 2: фото остаются на телефоне (lib/photo-store.js)", () => {
  let mb;
  beforeEach(() => { mb = memoryBackend(); setPhotoBackend(mb); });
  afterAll(() => setPhotoBackend(null));
  it("положить, взять, всё разом; превью и целое лежат отдельно", async () => {
    expect(await photoPut(false, "lp:a|v1", url(T1))).toBe(true);
    expect(await photoPut(true, "lp:a|v1", url(F1))).toBe(true);
    expect(await photoGet(false, "lp:a|v1")).toBe(url(T1));
    expect(await photoGet(true, "lp:a|v1")).toBe(url(F1));
    expect(await photoGet(false, "lp:нет|v1")).toBe(null);
    expect(await photoAll(false)).toEqual([["lp:a|v1", url(T1)]]);
    expect(await photoAll(true)).toEqual([["lp:a|v1", url(F1)]]);
  });
  it("не фото и кривой ключ на телефон не попадают", async () => {
    expect(await photoPut(false, "x", url(T1))).toBe(false);
    expect(await photoPut(false, "lp:a|v1", "https://example.com/a.jpg")).toBe(false);
    expect(await photoPut(false, "lp:a|v1", "data:text/html;base64,AAAA")).toBe(false);
    expect(await photoPut(false, "lp:a|v1", null)).toBe(false);
    expect(mb.size("t")).toBe(0);
    expect(await photoGet(false, null)).toBe(null);
  });
  it("уборка: у своего вида остаются только живые версии, чужой вид не трогаем", async () => {
    for (const k of ["lp:a|v1", "lp:a|v2", "lp:b|v1", "sp:x|v1"]) { await photoPut(false, k, url(T1)); await photoPut(true, k, url(F1)); }
    const gone = await photoPrune("lp", (k) => k === "lp:a|v2");
    expect(gone).toBe(4);
    expect((await photoAll(false)).map((x) => x[0]).sort()).toEqual(["lp:a|v2", "sp:x|v1"]);
    expect((await photoAll(true)).map((x) => x[0]).sort()).toEqual(["lp:a|v2", "sp:x|v1"]);
    expect(await photoDrop(["sp:x|v1"])).toBe(2);
    expect(mb.size("t") + mb.size("f")).toBe(2);
  });
  it("целых фото — не больше предела: уходят самые давние; превью предел не касается", async () => {
    for (let i = 1; i <= 5; i++) { await photoPut(true, "lp:p" + i + "|v", url(F1), i * 1000); await photoPut(false, "lp:p" + i + "|v", url(T1), i * 1000); }
    expect(await photoPrune("zz", () => true, 3)).toBe(2);
    expect((await photoAll(true)).map((x) => x[0]).sort()).toEqual(["lp:p3|v", "lp:p4|v", "lp:p5|v"]);
    expect(mb.size("t")).toBe(5);
    expect(FULL_KEEP).toBeGreaterThanOrEqual(24);
  });
  it("целым фото пользуются до сих пор — время обновляется (не чаще раза в сутки), и уборка его не трогает", async () => {
    await photoPut(true, "lp:old|v", url(F1), 1000);
    await photoPut(true, "lp:new|v", url(F2), 5000);
    expect(await photoGet(true, "lp:old|v", 1000 + 3600e3)).toBe(url(F1));
    await tick();
    expect((await mb.keys("f")).find((x) => x[0] === "lp:old|v")[1]).toBe(1000);          // час спустя — время прежнее
    expect(await photoGet(true, "lp:old|v", 1000 + 2 * 86400e3)).toBe(url(F1));
    await tick();
    expect((await mb.keys("f")).find((x) => x[0] === "lp:old|v")[1]).toBe(1000 + 2 * 86400e3);
    expect(await photoPrune("zz", () => true, 1)).toBe(1);
    expect((await photoAll(true)).map((x) => x[0])).toEqual(["lp:old|v"]);
  });
  it("нет IndexedDB (старый телефон, проверки без браузера) — тихо работает без телефона", async () => {
    setPhotoBackend(null);
    expect(await photoPut(false, "lp:a|v1", url(T1))).toBe(false);
    expect(await photoGet(false, "lp:a|v1")).toBe(null);
    expect(await photoAll(false)).toEqual([]);
    expect(await photoPrune("lp", () => false)).toBe(0);
  });
  it("хранилище: IndexedDB «sa_photos», в localStorage фото не кладём; уборка читает ключи, а не сами фото", () => {
    const src = rd("lib/photo-store.js");
    expect(src).toContain('const DB_NAME = "sa_photos"');
    expect(src).toContain('createObjectStore(n).createIndex("t", "t")');
    expect(src).toContain('os.index("t").openKeyCursor()');
    expect(src).not.toMatch(/localStorage\.(setItem|getItem)/);
    const prune = src.slice(src.indexOf("export async function photoPrune"));
    expect(prune).toContain("backend.keys(store)");
    expect(prune).not.toContain("backend.all(");
  });
});

describe("v158 · 2: фото уроков и обложки — с телефона, а не с сервера (lib/lesson-photo.js)", () => {
  let srv, mb;
  beforeAll(() => { globalThis.localStorage = phone(); });
  afterAll(() => { globalThis.fetch = realFetch; globalThis.localStorage = realLS; setPhotoBackend(null); _resetLessonPhotos(); });
  beforeEach(() => {
    mb = memoryBackend(); setPhotoBackend(mb); _resetLessonPhotos(); calls = [];
    srv = mk({ lessonPhotos: { "s0-1|": { full: F1, thumb: T1, w: 900, h: 600, by: "Роман" }, "mod:m1|": { full: F2, thumb: T2 } } });
    useServer(srv); login("ta");
  });
  it("первый раз — с сервера и на телефон; после нового запуска — с телефона, без запроса", async () => {
    const list = await loadLessonPhotos();
    const ver = photoOf(list, "s0-1").ver;
    expect(await lessonPhotoUrl("s0-1", ver, false)).toBe(url(T1));
    expect(await lessonPhotoUrl("s0-1", ver, true)).toBe(url(F1));
    expect(fnCalls("lesson_photo").length).toBe(2);
    await tick();
    expect((await mb.keys("t")).map((x) => x[0])).toEqual(["lp:s0-1|" + ver]);
    expect((await mb.keys("f")).map((x) => x[0])).toEqual(["lp:s0-1|" + ver]);
    _resetLessonPhotos(); calls = [];                       // приложение закрыли и открыли
    expect(lessonPhotoCached("s0-1", ver, false)).toBe(null);
    expect(await lessonPhotoUrl("s0-1", ver, false)).toBe(url(T1));
    expect(await lessonPhotoUrl("s0-1", ver, true)).toBe(url(F1));
    expect(fnCalls("lesson_photo").length).toBe(0);
  });
  it("при запуске превью поднимаются в память разом: обложка есть сразу, без ожидания", async () => {
    const list = await loadLessonPhotos();
    const v1 = photoOf(list, "s0-1").ver, v2 = photoOf(list, "mod:m1").ver;
    await lessonPhotoUrl("s0-1", v1, false); await lessonPhotoUrl("mod:m1", v2, false); await lessonPhotoUrl("s0-1", v1, true);
    await tick();
    _resetLessonPhotos(); calls = [];
    expect(await warmLessonPhotos()).toBe(2);
    expect(lessonPhotoCached("s0-1", v1, false)).toBe(url(T1));
    expect(lessonPhotoCached("mod:m1", v2, false)).toBe(url(T2));
    expect(lessonPhotoCached("s0-1", v1, true)).toBe(null);   // целые фото заранее в память не тянем
    expect(calls.length).toBe(0);
    expect(rd("App.jsx")).toContain("useEffect(() => { warmLessonPhotos(); warmStaffPhotos(); }, []);");
  });
  it("фото сменили или сняли — прежняя версия с телефона уходит", async () => {
    login("tr");
    const list = await loadLessonPhotos();
    const old = photoOf(list, "s0-1").ver;
    await lessonPhotoUrl("s0-1", old, false); await lessonPhotoUrl("s0-1", old, true);
    const r = await saveLessonPhoto("s0-1", "", { full: F3, thumb: T3, fullUrl: url(F3), thumbUrl: url(T3), w: 800, h: 600 }, "Роман");
    expect(r.ok).toBe(true);
    await tick(5);
    expect((await mb.keys("t")).map((x) => x[0]).sort()).toEqual(["lp:s0-1|" + r.ver]);
    expect((await mb.keys("f")).map((x) => x[0]).sort()).toEqual(["lp:s0-1|" + r.ver]);
    expect((await removeLessonPhoto("s0-1", "")).ok).toBe(true);
    await tick(5);
    expect(mb.size("t") + mb.size("f")).toBe(0);
  });
  it("сервер отдал другую версию (фото сменили минуту назад) — показываем, но на телефон под старым ключом не кладём", async () => {
    const list = await loadLessonPhotos();
    const ver = photoOf(list, "s0-1").ver;
    srv.rpc("lesson_photo_set", { p_token: "tr", p_lesson: "s0-1", p_scope: "", p_full: F3, p_thumb: T3 });
    expect(await lessonPhotoUrl("s0-1", ver, false)).toBe(url(T3));
    await tick();
    expect(mb.size("t")).toBe(0);
  });
});

describe("v158 · 3: плитка главы Справочника (lib/reference-thumb.js)", () => {
  const COURSES = [REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE];
  const chapters = COURSES.flatMap((c) => c.lessons.filter((l) => l.type === "lesson"));
  it("картинки главы — из строк [img:…], по порядку", () => {
    expect(chapterImages({ content: "текст\n[img:a, b]\n ещё\n  [img:c]  \nв строке [img:d] не считается" })).toEqual(["a", "b", "c"]);
    expect(chapterImages(null)).toEqual([]);
    expect(chapterImages({ content: "" })).toEqual([]);
  });
  it("фото важнее рисунка; нет миниатюры рисунка — следующий рисунок; нет ничего — номер", () => {
    const ph = Object.keys(REFERENCE_PHOTOS)[0];
    expect(chapterThumb({ content: "[img:preset_table]\n[img:" + ph + "]" })).toEqual({ kind: "photo", key: ph, src: REFERENCE_PHOTOS[ph] });
    expect(chapterThumb({ content: "[img:нет_такого]\n[img:glass_red]" }, hasIllMini)).toEqual({ kind: "art", key: "glass_red" });
    expect(chapterThumb({ content: "[img:glass_red]" }, () => false)).toBe(null);
    expect(chapterThumb({ content: "просто текст" }, hasIllMini)).toBe(null);
  });
  it("в приложении: 4 главы с фото, 12 с рисунком, 11 с номером — и для каждого рисунка есть миниатюра", () => {
    const kinds = chapters.map((l) => { const t = chapterThumb(l, hasIllMini); return t ? t.kind : "num"; });
    expect(chapters.length).toBe(27);
    expect(kinds.filter((k) => k === "photo").length).toBe(4);
    expect(kinds.filter((k) => k === "art").length).toBe(12);
    expect(kinds.filter((k) => k === "num").length).toBe(11);
    expect(chapters.filter((l) => chapterThumb(l, hasIllMini) && chapterThumb(l, hasIllMini).kind === "photo").map((l) => l.id).sort()).toEqual(["srv-schools", "win-etiquette", "win-serving", "win-sparkling"]);
    // рисунок, стоящий в главе первым, должен уметь уменьшаться — иначе глава молча осталась бы с номером
    for (const l of chapters) { const first = chapterImages(l).find((k) => !REFERENCE_PHOTOS[k]); if (first && !chapterImages(l).some((k) => REFERENCE_PHOTOS[k])) expect(hasIllMini(first), l.id + " → " + first).toBe(true); }
  });
  it("миниатюры — настоящие рисунки, а не уменьшенная сцена; линия одной толщины", () => {
    for (const k of Object.keys(ILL_MINI)) { const html = R(renderIllMini(k, "#C8A96E", true)); expect(html, k).toContain("<svg"); expect(html.length, k).toBeLessThan(6000); }
    expect(renderIllMini("нет", "#000", true)).toBe(null);
    expect(rd("ui/css.js")).toContain(".ref-mini svg * { vector-effect: non-scaling-stroke; stroke-width: 1.3px; }");
  });
  it("список глав: плитка 52 px вместо номера, с картинкой номер уходит в подпись; своё фото главы — из списка фото уроков", () => {
    const src = rd("ui/ReferenceSection.jsx");
    expect(src).toContain("function ChapterTile({ lesson, n, isQuiz, photos, T, gold, dark })");
    expect(src).toContain('const kind = isQuiz ? "quiz" : own && !gone ? "own" : th ? th.kind : "num";');
    expect(src).toContain("<ChapterTile lesson={l} n={i + 1} isQuiz={isQuiz} photos={photos} T={T} gold={gold} dark={dark} />");
    expect(src).toContain('{isQuiz ? "Фото-тест" : pic ? "Глава " + (i + 1) : "Глава"}');
    expect(src).toContain("const { src: ownSrc, gone } = useCover(own ? id : null, own ? own.ver : \"\", false);");   // превью, целое фото для плитки не тянем
    expect(src).toContain('loading="lazy"');
  });
});

describe("v158 · 3: своё фото главы — тот же лист и тот же этап 51, слова про главу (ui/lesson-photo.jsx)", () => {
  beforeAll(() => { globalThis.localStorage = phone(); });
  afterAll(() => { globalThis.fetch = realFetch; globalThis.localStorage = realLS; setPhotoBackend(null); _resetLessonPhotos(); });
  beforeEach(() => { setPhotoBackend(memoryBackend()); _resetLessonPhotos(); calls = []; useServer(mk({ lessonPhotos: { "win-temp|": { full: F1, thumb: T1, w: 900, h: 600 } } })); });
  it("руководителю в главе без фото — «Добавить фото к главе»; сотруднику — ничего", async () => {
    login("tr"); await loadLessonPhotos();
    const boss = R(h(LessonCover, { kind: "chapter", lessonId: "srv-basics", lessonTitle: "Основы сервировки", profile: PEOPLE[0], a11y: false, color: "#C8A96E" }));
    expect(boss).toContain('data-lp-add=""');
    expect(boss).toContain("Добавить фото к главе");
    expect(boss).not.toContain("Добавить фото к уроку");
    _resetLessonPhotos(); login("ta"); await loadLessonPhotos();
    expect(R(h(LessonCover, { kind: "chapter", lessonId: "srv-basics", lessonTitle: "Основы сервировки", profile: PEOPLE[2], a11y: false }))).toBe("");
    expect(R(h(LessonCover, { kind: "chapter", lessonId: "", lessonTitle: "x", profile: PEOPLE[0] }))).toBe("");
  });
  it("у главы с фото — обложка и кнопка «Сменить фото главы»; урок говорит по-прежнему про урок", async () => {
    login("tr"); const list = await loadLessonPhotos();
    await lessonPhotoUrl("win-temp", photoOf(list, "win-temp").ver, false);
    const html = R(h(LessonCover, { kind: "chapter", lessonId: "win-temp", lessonTitle: "Температура подачи", profile: PEOPLE[0], a11y: false }));
    expect(html).toContain('data-lp-cover="net"');
    expect(html).toContain('aria-label="Сменить фото главы"');
    expect(html).toContain(url(T1));
    const lesson = R(h(LessonCover, { lessonId: "win-temp", lessonTitle: "x", profile: PEOPLE[0], a11y: false }));
    expect(lesson).toContain('aria-label="Сменить фото урока"');
  });
  it("лист: «Фото главы», «Да, убрать фото у главы», подсказка про плитку в списке глав", async () => {
    login("tr"); const list = await loadLessonPhotos();
    const html = R(h(LessonPhotoSheet, { kind: "chapter", lessonId: "win-temp", lessonTitle: "Температура подачи", profile: PEOPLE[0], a11y: false, list, onClose: () => {} }));
    expect(html).toContain('aria-label="Фото главы"');
    expect(html).toContain('data-lp-kind="chapter"');
    expect(html).toContain("фото встанет над текстом главы и плиткой в списке глав у всей сети.");
    expect(rd("ui/lesson-photo.jsx")).toContain('drop: "Да, убрать фото у главы"');
    expect(rd("ui/ReferenceSection.jsx")).toContain('<LessonCover kind="chapter" lessonId={lessonPhotoId(lesson.id) || ""} lessonTitle={lesson.title} profile={profile} a11y={a11y} color={gold} />');
  });
});

describe("v158 · 4: чьё это фото (lib/staff-photo.js)", () => {
  const raw = { ok: true, me: "e-anna", restaurant: R0, can: { lead: false, network: false }, items: [
    { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, ver: "aaa" }, { id: "e-darya", name: "Дарья", surname: "Лебедева", restaurant: R0, ver: "bbb" },
    { id: "e-ivan", name: "Иван", surname: "Петров", restaurant: R1, ver: "ccc" }, { id: "u-roman", name: "Роман", surname: "", restaurant: R0, ver: "ddd" },
    { id: "", name: "Без", surname: "Номера", restaurant: R0, ver: "x" }, { id: "e-nover", name: "Без", surname: "Версии", restaurant: R0 }, { id: "u-maria", name: "Дубль", surname: "", restaurant: R0, ver: "zzz" },
  ] };
  const list = normStaffPhotos(raw);
  it("разбор ответа: без номера, без версии и дубли отброшены; права и «кто я» на месте", () => {
    expect(list.items.map((x) => x.id)).toEqual(["u-maria", "e-darya", "e-ivan", "u-roman"]);
    expect(list.me).toBe("e-anna");
    expect(list.restaurant).toBe(R0);
    expect(list.can).toEqual({ lead: false, network: false });
    expect(list.byId["u-maria"].tok).toEqual(["мария", "ким"]);
    expect(normStaffPhotos({ ok: false })).toBe(null);
    expect(normStaffPhotos(null)).toBe(null);
    expect(JSON.parse(JSON.stringify(list))).toEqual(list);   // список ложится в память телефона как есть
  });
  it("по номеру сотрудника — только по нему", () => {
    expect(staffPhotoOf(list, { id: "e-darya" }).ver).toBe("bbb");
    expect(staffPhotoOf(list, { id: "e-anna" })).toBe(null);
    expect(staffPhotoOf(list, { id: "нет", full: "Ким Мария" })).toBe(null);   // номер известен и фото у него нет — по имени не гадаем
  });
  it("по строке графика: «Фамилия Имя», «Имя Фамилия», с отчеством, в любом регистре, «ё» как «е»", () => {
    for (const full of ["Ким Мария", "Мария Ким", "ким  мария", "Ким Мария Олеговна", "Ким, Мария"]) expect(staffPhotoOf(list, { full }).id, full).toBe("u-maria");
    expect(staffPhotoOf(list, { name: "Дарья", surname: "Лебедева" }).id).toBe("e-darya");
    expect(staffPhotoOf(list, { full: "Лебедёва Дарья" }).id).toBe("e-darya");   // «ё» и «е» — одно и то же
    expect(normName("  Пётр   ОРЛОВ. ")).toBe("петр орлов");
    expect(normName("Әлия Нұрланқызы")).toBe("әлия нұрланқызы");   // буквы других алфавитов не выбрасываются
  });
  it("чужое заведение не подходит; у записи только имя — совпадает лишь строка из одного имени", () => {
    expect(staffPhotoOf(list, { full: "Петров Иван" })).toBe(null);                    // Иван из «Порта», а график — «Океана»
    expect(staffPhotoOf(list, { full: "Петров Иван", restaurant: R1 }).id).toBe("e-ivan");
    expect(staffPhotoOf(list, { full: "Роман" }).id).toBe("u-roman");
    expect(staffPhotoOf(list, { full: "Роман Владелец" })).toBe(null);
    expect(staffPhotoOf(list, { full: "Мария" })).toBe(null);                          // одного имени мало: Марий может быть две
    expect(staffPhotoOf(list, { full: "Ким М." })).toBe(null);
    expect(staffPhotoOf(list, { full: "" })).toBe(null);
  });
  it("тёзки в одном заведении — фото не показываем никому из них", () => {
    const two = normStaffPhotos({ ...raw, items: [...raw.items.slice(0, 2), { id: "e-maria2", name: "Мария", surname: "Ким", restaurant: R0, ver: "eee" }] });
    expect(staffPhotoOf(two, { full: "Ким Мария" })).toBe(null);
    expect(staffPhotoOf(two, { id: "e-maria2" }).ver).toBe("eee");
    const far = normStaffPhotos({ ...raw, items: [...raw.items.slice(0, 2), { id: "e-maria2", name: "Мария", surname: "Ким", restaurant: R1, ver: "eee" }] });
    expect(staffPhotoOf(far, { full: "Ким Мария" }).id).toBe("u-maria");            // тёзка в другом заведении не мешает
  });
  it("нет списка, нет этапа, пусто — null; буквы для кружка — имя, потом фамилия", () => {
    for (const l of [null, undefined, "missing", { items: [] }, {}]) expect(staffPhotoOf(l, { full: "Ким Мария" })).toBe(null);
    expect(staffPhotoOf(list, null)).toBe(null);
    expect(initialsOfPerson("Мария", "Ким")).toBe("МК");
    expect(initialsOfPerson("роман", "")).toBe("Р");
    expect(initialsOfPerson("", "")).toBe("?");
  });
  it("кого может убрать руководитель: своё заведение без себя; сеть — всех без себя; сотрудник — никого", () => {
    expect(staffPhotosToModerate(list)).toEqual([]);
    const lead = normStaffPhotos({ ...raw, me: "u-maria", can: { lead: true, network: false } });
    expect(staffPhotosToModerate(lead).map((x) => x.id)).toEqual(["e-darya", "u-roman"]);
    const net = normStaffPhotos({ ...raw, me: "u-roman", can: { lead: true, network: true } });
    expect(staffPhotosToModerate(net).map((x) => x.id)).toEqual(["u-maria", "e-darya", "e-ivan"]);
    expect(staffPhotosToModerate("missing")).toEqual([]);
  });
  it("тексты ошибок: владельцу — какой файл запустить, сотруднику — что ждать", () => {
    expect(staffPhotoErr("missing", true)).toContain("supabase-stage52-staff-photos.sql");
    expect(staffPhotoErr("missing", false)).toBe("Фото сотрудников заработают, когда владелец обновит сервер (этап 52).");
    for (const c of ["forbidden", "not_found", "auth", "bad_photo", "type", "decode", "big", "net", "что-то"]) { const t = staffPhotoErr(c); expect(t.length, c).toBeGreaterThan(10); expect(t, c).not.toMatch(/ — /); }
  });
});

describe("v158 · 4: кадр — квадрат, который попадёт в кружок", () => {
  it("начало: по центру; у вертикального фото — чуть выше середины; кадр не выходит за края", () => {
    expect(cropInit(1600, 1000)).toEqual({ cx: 800, cy: 500, z: 1 });
    const p = cropInit(1200, 1600);
    expect(p.cx).toBe(600);
    expect(p.cy).toBe(672);
    expect(cropSide(1200, 1600, 1)).toBe(1200);
    expect(cropRect(p, 1200, 1600)).toEqual({ sx: 0, sy: 72, side: 1200 });
    expect(cropInit(1000, 1000)).toEqual({ cx: 500, cy: 500, z: 1 });
  });
  it("фото едет за пальцем и упирается в край; приближение — от 1 до предела", () => {
    let c = cropInit(1600, 1000);
    c = cropMove(c, 50, 0, 1600, 1000, 250);       // палец вправо на 50 точек экрана — фото вправо, кадр влево (в 4 раза: 1000 / 250)
    expect(c.cx).toBe(600);
    c = cropMove(c, 9999, 9999, 1600, 1000, 250);
    expect([c.cx, c.cy]).toEqual([500, 500]);
    c = cropMove(c, -9999, -9999, 1600, 1000, 250);
    expect([c.cx, c.cy]).toEqual([1100, 500]);
    const z = cropZoom(cropInit(1000, 1000), 2, 1000, 1000);
    expect(cropRect(z, 1000, 1000)).toEqual({ sx: 250, sy: 250, side: 500 });
    expect(cropZoom(z, 99, 1000, 1000).z).toBe(CROP_MAX_ZOOM);
    expect(cropZoom(z, 0.1, 1000, 1000).z).toBe(1);
    expect(cropClamp({ cx: NaN, cy: -5, z: "x" }, 800, 600)).toEqual({ cx: 300, cy: 300, z: 1 });
    // приблизили у края и отдалили — кадр возвращается внутрь фото
    const edge = cropMove(cropZoom(cropInit(1000, 1000), 4, 1000, 1000), -9999, -9999, 1000, 1000, 250);
    expect(cropRect(cropZoom(edge, 1, 1000, 1000), 1000, 1000)).toEqual({ sx: 0, sy: 0, side: 1000 });
  });
});

describe("v158 · 4: сервер в памяти повторяет этап 52 (tools/claude/demo-app/fake-server.js)", () => {
  const seed = { "u-maria": { full: F1, thumb: T1 }, "e-ivan": { full: F2, thumb: T2 }, "e-oleg": { full: F3, thumb: T3 } };
  it("список на всю сеть, без уволенных; кто я и что мне можно", () => {
    const s = mk({ staffPhotos: seed });
    const a = s.rpc("staff_photos", { p_token: "ta" });
    expect(a).toMatchObject({ ok: true, me: "e-anna", restaurant: R0, can: { network: false, lead: false } });
    expect(a.items.map((x) => x.id).sort()).toEqual(["e-ivan", "u-maria"]);
    expect(a.items.find((x) => x.id === "u-maria")).toMatchObject({ name: "Мария", surname: "Ким", restaurant: R0 });
    expect(s.rpc("staff_photos", { p_token: "tm" }).can).toEqual({ network: false, lead: true });
    expect(s.rpc("staff_photos", { p_token: "tr" }).can).toEqual({ network: true, lead: true });
    expect(s.rpc("staff_photos", { p_token: "нет" })).toEqual({ ok: false, error: "auth" });
  });
  it("превью пачкой до 24, целиком — одно; уволенного и того, у кого фото нет, в ответе нет", () => {
    const s = mk({ staffPhotos: seed });
    const two = s.rpc("staff_photo", { p_token: "ta", p_ids: ["u-maria", "e-ivan", "e-oleg", "e-anna", "u-maria"] });
    expect(two.items.map((x) => [x.id, x.data])).toEqual([["e-ivan", T2], ["u-maria", T1]]);
    const one = s.rpc("staff_photo", { p_token: "ta", p_ids: ["u-maria", "e-ivan"], p_full: true });
    expect(one.items.map((x) => [x.id, x.data])).toEqual([["u-maria", F1]]);
    const many = Array.from({ length: 24 }, (_, i) => "x" + i);
    expect(s.rpc("staff_photo", { p_token: "ta", p_ids: [...many, "u-maria"] }).items).toEqual([]);
    expect(s.rpc("staff_photo", { p_token: "ta", p_ids: ["u-maria", ...many] }).items.length).toBe(1);
    expect(s.rpc("staff_photo", { p_token: "ta", p_ids: null }).items).toEqual([]);
  });
  it("своё — сам; чужое — руководитель у своих, сеть у любого; проверка фото — как в SQL", () => {
    const s = mk({ staffPhotos: seed });
    const own = s.rpc("staff_photo_set", { p_token: "ta", p_emp: null, p_full: F3, p_thumb: T3 });
    expect(own).toMatchObject({ ok: true, id: "e-anna" });
    expect(own.ver).toMatch(/^[0-9a-f]{12}$/);
    expect(s.rpc("staff_photo_set", { p_token: "ta", p_emp: "e-darya", p_full: F3, p_thumb: T3 }).error).toBe("forbidden");
    expect(s.rpc("staff_photo_del", { p_token: "ta", p_emp: "u-maria" }).error).toBe("forbidden");
    expect(s.rpc("staff_photo_set", { p_token: "tm", p_emp: "e-darya", p_full: F3, p_thumb: T3 }).ok).toBe(true);
    expect(s.rpc("staff_photo_set", { p_token: "tm", p_emp: "e-ivan", p_full: F3, p_thumb: T3 }).error).toBe("forbidden");
    expect(s.rpc("staff_photo_del", { p_token: "tp", p_emp: "e-anna" }).error).toBe("forbidden");
    expect(s.rpc("staff_photo_set", { p_token: "tr", p_emp: "e-ivan", p_full: F3, p_thumb: T3 }).ok).toBe(true);
    expect(s.rpc("staff_photo_set", { p_token: "tr", p_emp: "нет", p_full: F3, p_thumb: T3 }).error).toBe("not_found");
    expect(s.rpc("staff_photo_set", { p_token: "tr", p_emp: "e-oleg", p_full: F3, p_thumb: T3 }).error).toBe("not_found");
    for (const [f, t] of [["не base64 " + F1, T1], ["QUJD", T1], ["QUJD".repeat(50001), T1], [F1, "QUJD".repeat(10001)], [F1, ""]]) expect(s.rpc("staff_photo_set", { p_token: "ta", p_emp: "", p_full: f, p_thumb: t }).error).toBe("bad_photo");
    expect(s.rpc("staff_photo_set", { p_token: "ta", p_emp: "", p_full: "QUJD".repeat(50000), p_thumb: "QUJD".repeat(10000) }).ok).toBe(true);
    expect(s.rpc("staff_photo_del", { p_token: "ta" })).toMatchObject({ ok: true, id: "e-anna", removed: 1 });
    expect(s.rpc("staff_photo_del", { p_token: "ta", p_emp: "" }).removed).toBe(0);
    // фото уволенного убирает только сеть
    expect(s.rpc("staff_photo_del", { p_token: "tm", p_emp: "e-oleg" }).error).toBe("forbidden");
    expect(s.rpc("staff_photo_del", { p_token: "tr", p_emp: "e-oleg" }).removed).toBe(1);
  });
  it("нет этапа 52 — сервер отвечает «нет такой функции», остальное работает", () => {
    const s = mk({ noStage52: true });
    for (const fn of ["staff_photos", "staff_photo", "staff_photo_set", "staff_photo_del"]) expect(s.rpc(fn, { p_token: "ta" }).code).toBe("PGRST202");
    expect(s.rpc("lesson_photos", { p_token: "ta" }).ok).toBe(true);
  });
  it("файл этапа: четыре функции, таблица закрыта, права — этапа 21; этапы 51 и 52 есть в списке владельца и в памятке сервера", () => {
    const q = rd("supabase/supabase-stage52-staff-photos.sql");
    for (const fn of ["staff_photos(p_token text)", "staff_photo(p_token text, p_ids text[], p_full boolean default false)", "staff_photo_set(p_token text, p_emp text, p_full text, p_thumb text)", "staff_photo_del(p_token text, p_emp text default null)"]) expect(q, fn).toContain("create or replace function " + fn);
    expect(q).toContain("alter table sa_staff_photos enable row level security;");
    expect(q).toContain("_sa_may_touch(c, t)");
    expect(q).toContain("length(p_full) > 200000 or length(p_thumb) > 40000");
    expect(q).toContain("revoke all on function _sa_sp_person(text) from public, anon, authenticated;");
    expect(q).not.toMatch(/drop table|truncate/i);                                   // повторный запуск фото не стирает
    expect(SP_LIMITS).toEqual({ full: 200000, thumb: 40000 });
    expect(SP_BATCH).toBe(24);
    expect(STAGES.find((x) => x.n === "51")).toMatchObject({ file: "supabase-stage51-lesson-photos.sql", fn: "lesson_photos" });
    expect(STAGES.find((x) => x.n === "52")).toEqual({ n: "52", file: "supabase-stage52-staff-photos.sql", what: "Фото сотрудников", fn: "staff_photos" });
    const rm = rd("supabase/README.md");
    expect(rm).toContain("| 61 | `supabase-stage52-staff-photos.sql` | **Фото сотрудников** (v158)");
    expect(rm).toContain("### Этап 52 (v158) — фото сотрудников");
    expect(existsSync("tools/claude/sql/test52.sh")).toBe(true);
  });
});

describe("v158 · 4: список, превью пачкой, телефон, поставить и убрать (lib/staff-photo.js с сервером)", () => {
  let srv, mb;
  const seed = { "u-maria": { full: F1, thumb: T1 }, "e-darya": { full: F2, thumb: T2 }, "e-ivan": { full: F3, thumb: T3 } };
  beforeAll(() => { globalThis.localStorage = phone(); });
  afterAll(() => { globalThis.fetch = realFetch; globalThis.localStorage = realLS; setPhotoBackend(null); _resetStaffPhotos(); });
  beforeEach(() => { mb = memoryBackend(); setPhotoBackend(mb); _resetStaffPhotos(); calls = []; srv = mk({ staffPhotos: seed }); useServer(srv); globalThis.localStorage._m.clear(); login("ta"); });
  it("список — один запрос за заход, копия на телефоне (у каждого входа своя)", async () => {
    expect(staffPhotoListNow()).toBe(null);
    const list = await loadStaffPhotos();
    expect(list.items.length).toBe(3);
    expect(list.me).toBe("e-anna");
    await loadStaffPhotos(); await loadStaffPhotos();
    expect(fnCalls("staff_photos").length).toBe(1);
    _resetStaffPhotos();
    expect(staffPhotoListNow().items.length).toBe(3);                       // с телефона, без запроса
    expect([...globalThis.localStorage._m.keys()].filter((k) => k.startsWith(SP_CACHE))).toEqual([SP_CACHE + ":ta"]);
    login("tm");
    expect(staffPhotoListNow()).toBe(null);                                 // вошёл другой человек — чужую копию не берём
  });
  it("два десятка кружков в графике — один запрос за превью, а не двадцать", async () => {
    const list = await loadStaffPhotos();
    const v = (id) => list.byId[id].ver;
    const got = await Promise.all([staffThumbUrl("u-maria", v("u-maria")), staffThumbUrl("e-darya", v("e-darya")), staffThumbUrl("e-ivan", v("e-ivan")), staffThumbUrl("u-maria", v("u-maria"))]);
    expect(got).toEqual([url(T1), url(T2), url(T3), url(T1)]);
    expect(fnCalls("staff_photo").length).toBe(1);
    expect(fnCalls("staff_photo")[0][1].p_ids.sort()).toEqual(["e-darya", "e-ivan", "u-maria"]);
    expect(fnCalls("staff_photo")[0][1].p_full).toBe(false);
    expect(staffThumbCached("e-darya", v("e-darya"))).toBe(url(T2));
    // больше 24 человек — запросов два
    calls = [];
    await Promise.all(Array.from({ length: 30 }, (_, i) => staffThumbUrl("x" + i, "v")));
    expect(fnCalls("staff_photo").map((c) => c[1].p_ids.length)).toEqual([24, 6]);
    expect(staffThumbCached("x1", "v")).toBe(null);                          // фото нет — пусто, и запомнено не «навсегда»
  });
  it("после нового запуска — с телефона: ни одного запроса за фото; превью встают сразу", async () => {
    const list = await loadStaffPhotos();
    const ver = list.byId["u-maria"].ver;
    await staffThumbUrl("u-maria", ver); await staffFullUrl("u-maria", ver);
    await tick();
    expect((await mb.keys("t")).map((x) => x[0])).toEqual(["sp:u-maria|" + ver]);
    expect((await mb.keys("f")).map((x) => x[0])).toEqual(["sp:u-maria|" + ver]);
    _resetStaffPhotos(); calls = [];
    expect(await warmStaffPhotos()).toBe(1);
    expect(staffThumbCached("u-maria", ver)).toBe(url(T1));
    expect(await staffThumbUrl("u-maria", ver)).toBe(url(T1));
    expect(await staffFullUrl("u-maria", ver)).toBe(url(F1));
    expect(fnCalls("staff_photo").length).toBe(0);
  });
  it("поставить своё: сразу в списке и в памяти, прежняя версия с телефона уходит; убрать — из списка", async () => {
    await loadStaffPhotos();
    const ph = { full: F3, thumb: T3, fullUrl: url(F3), thumbUrl: url(T3) };
    const r = await saveStaffPhoto(ph, { id: "", name: "Анна", surname: "Смирнова", restaurant: R0 });
    expect(r).toMatchObject({ ok: true, id: "e-anna" });
    expect(fnCalls("staff_photo_set")[0][1].p_emp).toBe(null);                // сервер сам знает, кто вошёл
    const now = staffPhotoListNow();
    expect(staffPhotoOf(now, { id: "e-anna" }).ver).toBe(r.ver);
    expect(staffPhotoOf(now, { full: "Смирнова Анна" }).id).toBe("e-anna");   // и в графике, по строке
    expect(staffThumbCached("e-anna", r.ver)).toBe(url(T3));
    const r2 = await saveStaffPhoto({ full: F1, thumb: T1, fullUrl: url(F1), thumbUrl: url(T1) }, { id: "", name: "Анна", surname: "Смирнова", restaurant: R0 });
    await tick(5);
    expect((await mb.keys("t")).map((x) => x[0])).toEqual(["sp:e-anna|" + r2.ver]);
    expect(staffPhotoListNow().items.filter((x) => x.id === "e-anna").length).toBe(1);
    expect((await removeStaffPhoto()).ok).toBe(true);
    expect(staffPhotoOf(staffPhotoListNow(), { id: "e-anna" })).toBe(null);
    await tick(5);
    expect(mb.size("t") + mb.size("f")).toBe(0);
    expect(srv.rpc("staff_photos", { p_token: "ta" }).items.some((x) => x.id === "e-anna")).toBe(false);
  });
  it("слишком большое фото до сервера не доходит; сотрудник чужое не уберёт; руководитель у своих — уберёт", async () => {
    await loadStaffPhotos();
    expect(await saveStaffPhoto({ full: "QUJD".repeat(50001), thumb: T1 })).toEqual({ ok: false, error: "big" });
    expect(await saveStaffPhoto(null)).toEqual({ ok: false, error: "bad_request" });
    expect(fnCalls("staff_photo_set").length).toBe(0);
    expect(await removeStaffPhoto("u-maria")).toEqual({ ok: false, error: "forbidden" });
    _resetStaffPhotos(); login("tm");
    const list = await loadStaffPhotos();
    expect(staffPhotosToModerate(list).map((x) => x.id)).toEqual(["e-darya"]);
    expect(await removeStaffPhoto("e-darya")).toEqual({ ok: true, id: "e-darya" });
    expect(staffPhotoListNow().items.map((x) => x.id).sort()).toEqual(["e-ivan", "u-maria"]);
    expect(await removeStaffPhoto("e-ivan")).toEqual({ ok: false, error: "forbidden" });
  });
  it("нет этапа 52 — «missing»: один запрос, фото не спрашиваем", async () => {
    useServer(mk({ noStage52: true }));
    expect(await loadStaffPhotos()).toBe("missing");
    expect(await loadStaffPhotos()).toBe("missing");
    expect(fnCalls("staff_photos").length).toBe(1);
    expect(staffPhotoOf("missing", { id: "u-maria" })).toBe(null);
    expect((await saveStaffPhoto({ full: F1, thumb: T1 })).error).toBe("missing");
  });
  it("список не пришёл (нет связи) — минуту сервер не дёргаем из каждого кружка; потом пробуем снова", async () => {
    globalThis.fetch = async (u) => { calls.push([String(u).split("/rpc/")[1], {}]); throw new Error("сети нет"); };
    expect(await loadStaffPhotos()).toBe(null);
    expect(await loadStaffPhotos()).toBe(null);
    expect(await loadStaffPhotos(false, Date.now() + 30000)).toBe(null);
    expect(fnCalls("staff_photos").length).toBe(1);
    useServer(srv);
    expect((await loadStaffPhotos(false, Date.now() + 61000)).items.length).toBe(3);
    expect(fnCalls("staff_photos").length).toBe(2);
  });
  it("нет входа — ни запросов, ни фото", async () => {
    globalThis.localStorage.removeItem("sa_session_token");
    expect(await loadStaffPhotos()).toBe(null);
    expect(await staffThumbUrl("u-maria", "v")).toBe(null);
    expect(calls.length).toBe(0);
  });
});

describe("v158 · 4: фото в кружках и лист «Моё фото» (ui/staff-photo.jsx)", () => {
  let list;
  const seed = { "u-maria": { full: F1, thumb: T1 }, "e-darya": { full: F2, thumb: T2 } };
  const ANNA = PEOPLE[2], MARIA = PEOPLE[1], ROMAN = PEOPLE[0];
  beforeAll(async () => {
    globalThis.localStorage = phone(); setPhotoBackend(memoryBackend()); _resetStaffPhotos(); calls = [];
    useServer(mk({ staffPhotos: seed })); login("ta");
    list = await loadStaffPhotos();
    await Promise.all(list.items.map((x) => staffThumbUrl(x.id, x.ver)));
  });
  afterAll(() => { globalThis.fetch = realFetch; globalThis.localStorage = realLS; setPhotoBackend(null); _resetStaffPhotos(); });
  it("FaceImg: фото поверх букв — по номеру и по строке графика; нет фото — ничего (остаются буквы)", () => {
    const byId = R(h(FaceImg, { who: { id: "u-maria" } }));
    expect(byId).toContain('<img data-face="u-maria" src="' + url(T1) + '"');
    expect(byId).toContain("position:absolute");
    expect(byId).toContain("border-radius:inherit");
    expect(byId).toContain("pointer-events:none");
    expect(R(h(FaceImg, { who: { full: "Лебедева Дарья" } }))).toContain('data-face="e-darya"');
    expect(R(h(FaceImg, { who: { full: "Смирнова Анна" } }))).toBe("");
    expect(R(h(FaceImg, { who: null }))).toBe("");
  });
  it("«Смена»: в кружках коллег — фото, буквы под ним остаются; у «+2» фото нет", () => {
    const crew = { mates: [{ id: 1, full: "Ким Мария", first: "Мария", ini: "МК", lead: true, same: true }, { id: 6, full: "Лебедева Дарья", first: "Дарья", ini: "ДЛ", lead: false, same: true },
      { id: 8, full: "Миронова Ксения", first: "Ксения", ini: "КМ", lead: false, same: true }, { id: 4, full: "Орлов Пётр", first: "Пётр", ini: "ПО", lead: false, same: false }], lead: "Мария", leadF: true, leadMe: false };
    const html = R(h(ShiftHero, { a11y: false, shift: { off: false, label: "День · 12:00–20:00" }, mates: crew }));
    expect((html.match(/data-face="/g) || []).length).toBe(2);
    expect(html).toMatch(/data-mate="lead"[^>]*>МК<img data-face="u-maria"/);
    expect(html).toMatch(/data-mate="one"[^>]*>ДЛ<img data-face="e-darya"/);
    expect(html).toMatch(/data-mate="more"[^>]*>\+2<\/span>/);
    const three = R(h(ShiftHero, { a11y: false, shift: { off: false, label: "День" }, mates: { ...crew, mates: crew.mates.slice(1) } }));
    expect(three).toMatch(/>КМ<\/span>/);                                         // у Ксении фото нет — буквы
  });
  it("«Команда»: у лидера с фото оно в медальоне; «График»: фото в пяти кружках, старший — тоже", () => {
    const lb = [{ name: "Мария", surname: "Ким", restaurant: R0, avg: 100 }, { name: "Анна", surname: "Смирнова", restaurant: R0, avg: 92 }, { name: "Дарья", surname: "Лебедева", restaurant: R0, avg: 83 }];
    const html = R(h(TeamHero, { a11y: false, leaderboard: lb, profile: ANNA, onOpen: () => {} }));
    expect((html.match(/data-face="/g) || []).length).toBe(2);
    expect(html).toMatch(/>МК<img data-face="u-maria"/);
    expect(html).toMatch(/>АС<\/div>/);
    const sc = rd("ui/schedule.jsx");
    expect((sc.match(/<FaceImg who=\{\{ full: /g) || []).length).toBe(5);
    expect(sc).toContain("leadIni={lead ? initialsOf(lead.name) : \"\"} leadFace={lead ? <FaceImg who={{ full: lead.name }} /> : null}");
    const hero = rd("ui/schedule-hero.jsx");
    expect(hero).toContain("{leadIni || String(lead).trim()");
    expect(hero).toContain("{leadFace}");
  });
  it("«Я»: фото ещё нет — на кружке маленький фотоаппарат и кнопка «Добавить своё фото»; есть — фото и «сменить»", () => {
    const add = R(h(MyFaceLayer, { profile: ANNA, a11y: false }));
    expect(add).toContain('data-my-face="add"');
    expect(add).toContain('aria-label="Добавить своё фото"');
    expect(add).toContain('data-my-face-badge=""');
    expect(add).not.toContain("<img");
    const hub = R(h(HubScreen, { T, a11y: false, title: "Анна", items: [], hubId: "me", avatar: { initials: "АС", admin: false }, avatarLayer: h(MyFaceLayer, { profile: ANNA, a11y: false }) }));
    expect(hub).toMatch(/data-hub-mark="avatar" data-lens="disc" style="[^"]*position:relative"><span[^>]*>АС<\/span><button type="button" data-my-face="add"/);
    expect(hub).not.toMatch(/data-hub-mark="avatar" data-lens="disc" aria-hidden/);   // внутри кнопка — от чтения с экрана не прячем
    // без слоя шапка «Я» — как раньше (tests/v150)
    expect(R(h(HubScreen, { T, a11y: false, title: "Анна", items: [], hubId: "me", avatar: { initials: "АС", admin: false } }))).toContain('data-lens="disc" aria-hidden="true" style="width:44px;height:44px;');
    expect(rd("App.jsx")).toContain("avatarLayer={<MyFaceLayer profile={profile} a11y={a11y} />}");
  });
  it("лист «Моё фото»: слова, кто увидит, кнопки; руководителю — «Фото команды»; чужое фото сотрудник не видит в списке", async () => {
    const mine = R(h(StaffPhotoSheet, { profile: ANNA, a11y: false, list, onClose: () => {} }));
    expect(mine).toContain('aria-label="Моё фото"');
    expect(mine).toContain('data-sp-sheet="me"');
    expect(mine).toContain("Анна Смирнова");
    expect(mine).toContain('data-sp-now="none"');
    expect(mine).toContain("Фото увидят коллеги по сети: в смене, графике и команде. Лучше портрет, где хорошо видно лицо.");
    expect(mine).toContain("Выбрать фото");
    expect(mine).toContain('accept="image/*"');
    expect(mine).not.toContain("capture=");                                       // и камера, и галерея
    expect(mine).not.toContain("Убрать фото");
    expect(mine).not.toContain("data-sp-team");
    _resetStaffPhotos(); login("tm");
    const ml = await loadStaffPhotos();
    await Promise.all(ml.items.map((x) => staffThumbUrl(x.id, x.ver)));
    const boss = R(h(StaffPhotoSheet, { profile: MARIA, a11y: true, list: ml, onClose: () => {} }));
    expect(boss).toContain('data-sp-now="photo"');
    expect(boss).toContain("Сменить фото");
    expect(boss).toContain(">Убрать фото</button>");
    expect(boss).toContain('data-sp-team="1"');
    expect(boss).toContain("Фото команды");
    const me = R(h(MyFaceLayer, { profile: MARIA, a11y: false }));
    expect(me).toContain('data-my-face="photo"');
    expect(me).toContain('aria-label="Моё фото: сменить"');
    expect(me).toContain('<img data-face="u-maria"');
    expect(me).not.toContain("data-my-face-badge");
  });
  it("нет этапа 52: сотруднику — как раньше (кружок не нажимается), владельцу — лист с подсказкой, какой файл запустить", () => {
    expect(R(h(MyFaceLayer, { profile: ANNA, a11y: false }))).not.toBe("");
    const src = rd("ui/staff-photo.jsx");
    expect(src).toContain("if (!profile || !list || (missing && !isOwner(profile))) return null;");
    const sheet = R(h(StaffPhotoSheet, { profile: ROMAN, a11y: false, list: "missing", onClose: () => {} }));
    expect(sheet).toContain("supabase-stage52-staff-photos.sql");
    expect(sheet).not.toContain("Выбрать фото");
    const staff = R(h(StaffPhotoSheet, { profile: ANNA, a11y: false, list: "missing", onClose: () => {} }));
    expect(staff).toContain("Фото сотрудников заработают, когда владелец обновит сервер (этап 52).");
  });
  it("новые слова интерфейса — без тире между словами (Доп. 74) и без капса", () => {
    for (const f of ["ui/staff-photo.jsx", "ui/lesson-done.jsx", "lib/lesson-done.js"]) {
      const code = rd(f).split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n").replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      expect(code, f).not.toMatch(/[А-Яа-яё»] — [А-Яа-яё«]/);
      expect(code, f).not.toMatch(/textTransform:\s*"uppercase"/);
    }
  });
});

describe("v158 · 5: буквы в кружках одинаковые везде — имя, потом фамилия", () => {
  const STAFF = [{ id: 1, name: "Ким Мария" }, { id: 3, name: "Смирнова Анна" }, { id: 8, name: "Миронова Ксения" }];
  it("порядок слов в строках графика узнаём по своей строке; не узнали — фамилия первой", () => {
    expect(rowsSurnameFirst(STAFF, { name: "Анна", surname: "Смирнова" })).toBe(true);
    expect(rowsSurnameFirst([{ id: 1, name: "Мария Ким" }, { id: 3, name: "Анна Смирнова" }], { name: "Анна", surname: "Смирнова" })).toBe(false);
    expect(rowsSurnameFirst(STAFF, { name: "Роман", surname: "" })).toBe(true);        // владельца в графике нет
    // владельца в графике нет, но известен коллега (у него есть фото) — порядок слов узнаём по его строке
    const NAME_FIRST = [{ id: 1, name: "Мария Ким" }, { id: 3, name: "Анна Смирнова" }];
    expect(rowsSurnameFirst(NAME_FIRST, { name: "Роман", surname: "" })).toBe(true);
    expect(rowsSurnameFirst(NAME_FIRST, { name: "Роман", surname: "" }, [{ name: "Мария", surname: "Ким" }])).toBe(false);
    expect(rowsSurnameFirst(STAFF, { name: "Роман", surname: "" }, [{ name: "Нет", surname: "Такого" }, { name: "Мария", surname: "Ким" }])).toBe(true);
    expect(rowsSurnameFirst(NAME_FIRST, null, [{ name: "Анна", surname: "Смирнова" }])).toBe(false);
    expect(rowsSurnameFirst(STAFF, null)).toBe(true);
    expect(rowsSurnameFirst(null, { name: "Анна", surname: "Смирнова" })).toBe(true);
    expect(rowsSurnameFirst([{ id: 3, name: "Анна" }], { name: "Анна", surname: "Смирнова" })).toBe(true);
    // тёзка по имени с другой фамилией — не моя строка
    expect(rowsSurnameFirst([{ id: 2, name: "Анна Ким" }, { id: 3, name: "Смирнова Анна" }], { name: "Анна", surname: "Смирнова" })).toBe(true);
  });
  it("«Ким Мария» в графике — «МК», как в «Смене», «Команде» и чате (было «КМ»)", () => {
    expect(mateName("Ким Мария", true).ini).toBe("МК");
    expect(mateName("Мария Ким", false).ini).toBe("МК");
    const sc = rd("ui/schedule.jsx");
    expect(sc).toContain("let SUR_FIRST = true;");
    expect(sc).toContain("const initialsOf = (full) => mateName(full, SUR_FIRST).ini.toUpperCase();");
    expect(sc).toContain("SUR_FIRST = rowsSurnameFirst(staffAll, profile, knownPeople");
    expect(sc).not.toContain("return (p[0][0] + (p[1] ? p[1][0] : \"\")).toUpperCase();");
    expect((sc.match(/initialsOf\(/g) || []).length).toBeGreaterThanOrEqual(6);   // кружки, лист сотрудника, картинка графика
  });
});
