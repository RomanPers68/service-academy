// v163 (Доп. 488): главная и фото разделов. Владелец (15.11) прислал снимок главной со своего телефона и спросил, что
// можно улучшить; из трёх предложений и наброска взял два: «Да, кайф, берем эту идею, и из предыдущей первую» —
//   1. Фото раздела в билете «Начать» (ui/now-hero.jsx): только в тёмной теме, только когда билет зовёт в урок трека.
//   2. Строка роли под приветствием своей строкой во всю ширину (ui/screens-roleselect.jsx).
// И попросил: «добавленные фото разделов подгружаются, это выглядит не очень… мы можем эту подгрузку сделать менее
// заметной?» —
//   3. Фото готовятся заранее (lib/lesson-photo.js: aheadPlan, aheadLessonPhotos, LP_HOT; заставка ждёт фото с телефона).
//   4. Что приехало позже, проявляется слоем, а не выскакивает (ui/lesson-photo.jsx: CoverPhoto, PhotoWait).
// Сервер не меняется (этап 51). Без этапа 51 всё как раньше. Разметки JSX в файле нет (Доп. 482).
// Вид в браузере (медленная сеть, первый и повторный запуск, обе темы, ширины) — tools/claude/e2e-v163.mjs.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store0 = {};
const phone = { getItem: (k) => (k in store0 ? store0[k] : null), setItem: (k, v) => { store0[k] = String(v); }, removeItem: (k) => { delete store0[k]; } };
globalThis.localStorage = phone;
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { setPhotoBackend, memoryBackend } from "../lib/photo-store";
import {
  loadLessonPhotos, lessonPhotoUrl, lessonPhotoCached, warmLessonPhotos, photoOf, moduleCover, _resetLessonPhotos,
  aheadPlan, aheadLessonPhotos, liftLessonPhotos, leanNet, LP_HOT, LP_GOT, HOT_MAX, AHEAD_FULL, AHEAD_THUMBS, WARM_HOLD, REF_COVER_IDS, REF_COVER_DEFAULT,
} from "../lib/lesson-photo";
import { CoverPhoto, PhotoWait, PhotosAhead, useCover, LessonCover, LessonPhotoSheet, warmAppCovers, PHOTO_FADE, AHEAD_WAIT } from "../ui/lesson-photo";
import { NowInvitation } from "../ui/now-hero";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html) => html.replace(/<[^>]+>/g, "");
const count = (s, part) => s.split(part).length - 1;
const noop = () => {};
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

// ── сервер в памяти (тот же, что в демо) и «телефон» ────────────────────────────────────────────────────────
const R0 = "Два моря, Океан";
const PEOPLE = [
  { id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
];
const TOK = { tr: "u-roman", ta: "e-anna" };
const pic = (s, n) => s.repeat(n);
const url = (x) => "data:image/jpeg;base64," + x;
const P = (i) => ({ full: pic("QUJD", 20 + i), thumb: pic("REVG", 6 + i), w: 900, h: 600, by: "Роман" });
const mk = (lessonPhotos) => makeServer({ today: "2026-11-15", rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, lessonPhotos });
const realFetch = globalThis.fetch;
let calls = [], failOn = null, SRV = null;
const useServer = (srv) => {
  globalThis.fetch = async (u, init = {}) => {
    const fn = String(u).split("/rpc/")[1], body = JSON.parse(init.body || "{}");
    calls.push([fn, body]);
    if (failOn && failOn(fn, body)) throw new Error("нет связи");
    return { ok: true, status: 200, json: async () => srv.rpc(fn, body) };
  };
};
const login = (tok) => phone.setItem("sa_session_token", tok);
const photoCalls = (full) => calls.filter((c) => c[0] === "lesson_photo" && (full === undefined || !!c[1].p_full === full));
const fresh = (lessonPhotos, tok = "ta") => {
  for (const k of Object.keys(store0)) delete store0[k];
  const mb = memoryBackend(); setPhotoBackend(mb); _resetLessonPhotos(); calls = []; failOn = null;
  SRV = mk(lessonPhotos); useServer(SRV); login(tok);
  return mb;
};
// приложение закрыли и открыли: память пуста, телефон прежний; при запуске фото с телефона поднимаются в память (App.jsx)
const restart = async () => { _resetLessonPhotos(); calls = []; return warmLessonPhotos(); };
// лист «Фото раздела» рисуется поверх экрана (портал); на сервере портала нет — рисуем без документа, как в tests/v157
const noDoc = (fn) => { const d = globalThis.document; delete globalThis.document; try { return fn(); } finally { globalThis.document = d; } };
const noPreload = (html) => html.replace(/<link rel="preload"[^>]*\/>/g, "");   // React 19 (песочница) добавляет подсказку загрузки, React 18 (GitHub) — нет

// трек из трёх разделов и «Справочник»
const M1 = { id: "m1", title: "Первый", lessons: [{ id: "m1-1", title: "Урок 1" }, { id: "m1-2", title: "Урок 2" }] };
const M2 = { id: "m2", title: "Второй", lessons: [{ id: "m2-1", title: "Урок 3" }, { id: "m2-2", title: "Урок 4" }] };
const M3 = { id: "m3", title: "Третий", lessons: [{ id: "m3-1", title: "Урок 5" }] };
const SEED = { "mod:m1|": P(1), "m2-1|": P(2), "mod:m3|": P(3), "m2-2|": P(4), "ref:coffee|": P(5), "other-1|": P(6), "m1-2|": P(7) };

afterAll(() => { globalThis.fetch = realFetch; setPhotoBackend(null); _resetLessonPhotos(); });

describe("v163: метка, журнал, памятка", () => {
  it("«сборка v163» — по старшему tests/vN; CHANGES — Дополнение 488 со словами владельца; e2e-v163 в памятке", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(163);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 488 — .*\(v163\)/);
    const flat = c.slice(c.indexOf("# Дополнение 488")).replace(/\s+/g, " ");   // слова владельца могут переноситься на новую строку
    expect(flat).toContain("берем эту идею, и из предыдущей первую");
    expect(flat).toContain("мы можем эту подгрузку сделать менее заметной?");
    for (const line of c.slice(c.indexOf("# Дополнение 488")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v163.mjs");
  });
});

// ── 1. строка роли ────────────────────────────────────────────────────────────────────────────────────────────
const T4 = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false,
  roleHeader: {}, roleSubtitle: {}, roleList: {}, roleCard: {}, roleAccent: {}, roleIcon: {}, roleInfo: {}, roleLabel: {}, roleSublabel: {}, roleDesc: {} };
const mod = { id: "cms-m-1", title: "Свой раздел", lessons: [{ id: "cms-l-1", type: "lesson", title: "Урок: встреча гостя", content: "Текст" }] };
const profile = { name: "Роман", surname: "Смирнов", restaurant: R0, position: "waiter" };
const home = async (extra = {}) => {
  const { RoleSelect } = await import("../ui/screens-roleselect");
  return R(h(RoleSelect, { T: T4, a11y: false, profile, role: "seasonal", onSelect: noop, onContinueLesson: noop, onGuestBook: noop, onSchedule: noop, customByRole: { seasonal: [mod] }, ...extra }));
};
const shiftToday = (label) => { store0.sa_today_shift = JSON.stringify({ date: ymd(new Date()), label }); };
const roleLine = (html) => { const a = html.indexOf("<div data-role-line"); return a < 0 ? "" : html.slice(a, html.indexOf("</div>", a) + 6); };

describe("v163 · 1: строка роли — своей строкой под приветствием (ui/screens-roleselect.jsx)", () => {
  beforeAll(() => { fresh({}); });
  it("под приветствием и заведением, до билета; роль с подписью слева", async () => {
    const html = await home();
    expect(count(html, 'data-role-line=""')).toBe(1);
    const at = html.indexOf("data-role-line");
    expect(at).toBeGreaterThan(html.indexOf(R0));
    expect(at).toBeLessThan(html.indexOf("data-now-card"));
    const line = roleLine(html);
    expect(line).toMatch(/^<div data-role-line="" style="display:flex;align-items:center;gap:10px;padding:3px 20px \d+px;font-family:Georgia, serif;font-size:12px;line-height:16px;color:#[0-9A-Fa-f]{6}/);
    expect(text(line)).toBe("НовичокСезонный сотрудник");
    // подпись — целиком или никак: строка высотой 16 px, перенос спрятан; многоточия нет
    expect(line).toContain('<span data-role-main="" style="flex:1 1 0;min-width:0;height:16px;overflow:hidden;display:flex;flex-wrap:wrap;align-items:center;column-gap:6px">');
    expect(line).toContain('<span data-role-sub="" style="color:#aaa;font-size:11px;white-space:nowrap">Сезонный сотрудник</span>');
    expect(line).not.toContain("ellipsis");
    // приветствие над ней — без нижнего поля: поле теперь у строки роли
    expect(html).toContain('<div style="padding:2px 20px 0;display:flex;align-items:baseline;justify-content:space-between;gap:10px');
  });
  it("трек по должности: «по должности · сменить» — справа в той же строке, не переносится", async () => {
    const line = roleLine(await home({ roleAuto: true }));
    expect(text(line)).toBe("НовичокСезонный сотрудникпо должности · сменить");
    expect(line.indexOf("data-role-auto")).toBeGreaterThan(line.indexOf("data-role-sub"));
    expect(line).toContain('<span data-role-auto="" style="flex-shrink:0;color:#aaa;font-size:11px;white-space:nowrap">');
    expect(line).toContain('<button type="button" data-role-change=""');
  });
  it("смена сегодня: «хорошей смены» — справа в строке роли; при «по должности» — под заведением, как было", async () => {
    shiftToday("Вечер · 17:00–24:00");
    try {
      const html = await home();
      expect(count(html, 'data-shift-wish=""')).toBe(1);
      expect(roleLine(html)).toContain('<span data-shift-wish="" style="flex-shrink:0;font-size:11px;color:#aaa;font-style:italic;white-space:nowrap">хорошей смены</span>');
      const auto = await home({ roleAuto: true });
      expect(count(auto, 'data-shift-wish=""')).toBe(1);
      expect(roleLine(auto)).not.toContain("data-shift-wish");
      expect(auto.indexOf('<div data-shift-wish=""')).toBeGreaterThan(auto.indexOf(R0));
      expect(auto.indexOf('<div data-shift-wish=""')).toBeLessThan(auto.indexOf("data-role-line"));
      shiftToday("выходной");
      expect(await home()).not.toContain("data-shift-wish");
    } finally { delete store0.sa_today_shift; }
  });
  it("без трека строки нет, приветствие — с прежним нижним полем; поля — из подгонки главной", async () => {
    const html = await home({ role: null });
    expect(html).not.toContain("data-role-line");
    expect(html.replace('gap:10px;position:relative">', 'gap:10px">')).toContain('<div style="padding:2px 20px 8px;display:flex;align-items:baseline;justify-content:space-between;gap:10px">');
    const src = rd("ui/screens-roleselect.jsx");
    expect(src).toContain('padding: roleObj ? "2px 20px 0" : "2px 20px " + F.greetPb + "px"');
    expect(src).toContain('padding:"3px 20px " + F.greetPb + "px"');
    expect(src).toContain("const wishLow = wish && !roleAuto && !!roleObj;");
  });
  it("невыбранные предложения в сборку не попали: ряд значков, точка, риска на «Графике», кружок своего трека — прежние", () => {
    const src = rd("ui/screens-roleselect.jsx");
    expect(src).not.toContain("dockSpread");
    expect(src).not.toContain("data-tool-dot");
    expect(rd("lib/dock-fit.js")).not.toContain("DOCK_GAP_MAX");
    expect(rd("ui/schedule-tile.jsx")).toContain("{sh && (sh.a || sh.off) ? <DayThread sh={sh.a ? sh : null} h={h} p={p} a11y={a11y} /> : null}");
    expect(rd("ui/look-v146.js")).not.toContain("[data-track-cur]:not([data-track-locked]):not(#sa-v146) [data-orb-glass]");
  });
});

// ── 2. фото готовы заранее ────────────────────────────────────────────────────────────────────────────────────
describe("v163 · 3: что готовить заранее — aheadPlan (lib/lesson-photo.js)", () => {
  let list;
  beforeAll(async () => { fresh(SEED); list = await loadLessonPhotos(); });
  it("целиком: раздел из билета, его урок, разделы трека начиная с него, потом те, что до него, потом «Справочник»", () => {
    const plan = aheadPlan(list, { first: M2, lesson: M2.lessons[1], mods: [M1, M2, M3] });
    // у M2 своей обложки нет — берётся фото его первого урока с фото (как в треке, v157)
    expect(moduleCover(list, M2).id).toBe("m2-1");
    expect(plan.full).toEqual(["m2-1", "m2-2", "mod:m3", "mod:m1", "ref:coffee"]);
    // превью: всё то же, дальше уроки своего трека в том же порядке, дальше остальное из списка
    expect(plan.thumbs.slice(0, 5)).toEqual(plan.full);
    expect(plan.thumbs.slice(5)).toEqual(["m1-2", "other-1"]);
    expect(new Set(plan.thumbs).size).toBe(plan.thumbs.length);
  });
  it("без билета — разделы трека по порядку; без трека — только «Справочник»; лишнего не просит", () => {
    expect(aheadPlan(list, { mods: [M1, M2, M3] }).full).toEqual(["mod:m1", "m2-1", "mod:m3", "ref:coffee"]);
    expect(aheadPlan(list, { first: M1, lesson: M1.lessons[0], mods: [M1, M2, M3] }).full).toEqual(["mod:m1", "m2-1", "mod:m3", "ref:coffee"]);   // у урока m1-1 фото нет
    expect(aheadPlan(list, {}).full).toEqual(["ref:coffee"]);
    expect(aheadPlan(list, {}).thumbs.length).toBe(Object.keys(list.map).length);
    expect(aheadPlan(list, { first: { id: "нет", lessons: [] }, mods: [null, { id: "x" }] }).full).toEqual(["ref:coffee"]);
  });
  it("нет списка, нет этапа 51 — пустой план; мера: целых не больше AHEAD_FULL, превью не больше AHEAD_THUMBS", () => {
    for (const bad of [null, undefined, "missing", {}]) expect(aheadPlan(bad, { mods: [M1] })).toEqual({ full: [], thumbs: [] });
    const map = {}, mods = [];
    for (let i = 0; i < 100; i++) { map["mod:big" + i] = { best: { ver: "v" + i } }; map["big" + i + "-1"] = { best: { ver: "w" + i } }; mods.push({ id: "big" + i, lessons: [{ id: "big" + i + "-1" }] }); }
    const plan = aheadPlan({ map }, { mods });
    expect([AHEAD_FULL, AHEAD_THUMBS, HOT_MAX]).toEqual([14, 72, 4]);
    expect(plan.full.length).toBe(AHEAD_FULL);
    expect(plan.thumbs.length).toBe(AHEAD_THUMBS);
    expect(plan.full[0]).toBe("mod:big0");
  });
  it("разделы «Справочника» в плане — те же, что на его экране", () => {
    const hub = rd("ui/ReferenceSection.jsx");
    const ids = [...hub.slice(hub.indexOf("const cards = ["), hub.indexOf("return (<div style={T.screen}>", hub.indexOf("const cards = ["))).matchAll(/\{ id: "([a-z]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(5);
    for (const id of ids) expect(REF_COVER_IDS, id).toContain(id);
    for (const id of Object.keys(REF_COVER_DEFAULT)) expect(REF_COVER_IDS).toContain(id);
  });
});

describe("v163 · 3: фото готовятся заранее и остаются на телефоне — aheadLessonPhotos (lib/lesson-photo.js)", () => {
  let mb, list, plan;
  const ver = (id) => photoOf(list, id).ver;
  beforeEach(async () => {
    mb = fresh(SEED); list = await loadLessonPhotos(); calls = [];
    plan = aheadPlan(list, { first: M2, lesson: M2.lessons[1], mods: [M1, M2, M3] });
  });
  it("первый раз: превью всего списка и целые фото по плану — с сервера, по одному; всё ложится на телефон", async () => {
    const out = await aheadLessonPhotos(list, plan);
    expect(out).toEqual({ thumbs: 7, full: 5 });
    expect(photoCalls(false).length).toBe(7);
    expect(photoCalls(true).length).toBe(5);
    // порядок: первые HOT_MAX — превью, потом они же целиком; потом остальные превью; потом остальные целиком
    const order = photoCalls().map((c) => c[1].p_lesson + (c[1].p_full ? "*" : ""));
    expect(order).toEqual(["m2-1", "m2-2", "mod:m3", "mod:m1", "m2-1*", "m2-2*", "mod:m3*", "mod:m1*", "ref:coffee", "m1-2", "other-1", "ref:coffee*"]);
    for (const id of plan.thumbs) expect(lessonPhotoCached(id, ver(id), false), id).toBe(url(SEED[id + "|"].thumb));
    for (const id of plan.full) expect(lessonPhotoCached(id, ver(id), true), id).toBe(url(SEED[id + "|"].full));
    expect(lessonPhotoCached("other-1", ver("other-1"), true)).toBe(null);   // целое — только то, что в плане
    await tick();
    expect((await mb.keys("t")).length).toBe(7);
    expect((await mb.keys("f")).length).toBe(5);
  });
  it("тот же план второй раз не идёт; после нового запуска всё берётся с телефона, без сервера", async () => {
    const p1 = aheadLessonPhotos(list, plan);
    expect(aheadLessonPhotos(list, plan)).toBe(p1);
    await p1; await tick();
    const n = calls.length;
    expect(await aheadLessonPhotos(list, plan)).toEqual({ thumbs: 7, full: 5 });   // то же обещание, а не новый заход
    expect(calls.length).toBe(n);
    await restart();
    list = await loadLessonPhotos(); calls = [];
    expect(await aheadLessonPhotos(list, plan)).toEqual({ thumbs: 0, full: 1 });   // превью и первые целые поднял запуск, пятое — этот заход
    expect(calls.length).toBe(0);
    for (const id of plan.full) expect(lessonPhotoCached(id, ver(id), true), id).toBe(url(SEED[id + "|"].full));
  });
  it("что уже на телефоне, поднимается сразу и без сервера (liftLessonPhotos); чего на телефоне нет — не трогает", async () => {
    expect(await liftLessonPhotos(list, plan)).toBe(0);                        // на телефоне ещё ничего нет
    expect(calls.length).toBe(0);
    await aheadLessonPhotos(list, plan); await tick();
    _resetLessonPhotos(); calls = [];
    for (const k of Object.keys(store0)) if (k.startsWith(LP_HOT)) delete store0[k];   // без запомненных номеров: всё поднимает сам заход
    list = await loadLessonPhotos(); calls = [];
    expect(lessonPhotoCached("ref:coffee", ver("ref:coffee"), true)).toBe(null);
    expect(await liftLessonPhotos(list, plan)).toBe(5);
    for (const id of plan.full) expect(lessonPhotoCached(id, ver(id), true), id).toBe(url(SEED[id + "|"].full));
    for (const id of plan.thumbs) expect(lessonPhotoCached(id, ver(id), false), id).toBe(url(SEED[id + "|"].thumb));   // превью поднял запуск
    expect(calls.length).toBe(0);
    expect(await liftLessonPhotos(list, plan)).toBe(0);                        // второй раз поднимать нечего
    for (const bad of [null, "missing", {}]) expect(await liftLessonPhotos(bad, plan)).toBe(0);
    expect(await liftLessonPhotos(list, null)).toBe(0);
    expect(rd("ui/lesson-photo.jsx")).toContain("if (plan.full.length) liftLessonPhotos(list, plan);");
  });
  it("каждое фото заранее берётся с сервера один раз (LP_GOT): телефон его не сберёг — второй раз заранее не качаем", async () => {
    await aheadLessonPhotos(list, plan); await tick();
    const keys = (ids) => ids.map((id) => id + "|" + ver(id)).sort();
    const got = JSON.parse(store0[LP_GOT + ":ta"]);
    expect(got.t.sort()).toEqual(keys(plan.thumbs));
    expect(got.f.sort()).toEqual(keys(plan.full));
    // телефон потерял фото (хранилище не работает или его почистили), приложение открыли заново
    setPhotoBackend(memoryBackend());
    expect(await restart()).toBe(0);
    list = await loadLessonPhotos(); calls = [];
    expect(await liftLessonPhotos(list, plan)).toBe(0);
    expect(await aheadLessonPhotos(list, plan)).toEqual({ thumbs: 0, full: 0 });
    expect(photoCalls().length).toBe(0);                                        // заранее — ни одного запроса: иначе каждый запуск тянул бы всё заново
    // человек открыл экран — фото приезжает, как раньше
    expect(await lessonPhotoUrl("mod:m3", ver("mod:m3"), true)).toBe(url(SEED["mod:m3|"].full));
    expect(photoCalls(true).length).toBe(1);
    // фото сменили — новая версия готовится заранее, как любое новое фото (и только она)
    const old = ver("mod:m3");
    expect(SRV.rpc("lesson_photo_set", { p_token: "tr", p_lesson: "mod:m3", p_scope: "", p_full: pic("WFla", 30), p_thumb: pic("WFla", 8), p_w: 900, p_h: 600 }).ok).toBe(true);
    list = await loadLessonPhotos(true); calls = [];
    expect(ver("mod:m3")).not.toBe(old);
    expect(await aheadLessonPhotos(list, plan)).toEqual({ thumbs: 1, full: 1 });
    expect(photoCalls().map((c) => c[1].p_lesson + (c[1].p_full ? "*" : ""))).toEqual(["mod:m3", "mod:m3*"]);
    const got2 = JSON.parse(store0[LP_GOT + ":ta"]);
    expect(got2.f).toContain("mod:m3|" + ver("mod:m3"));
    expect(got2.f).not.toContain("mod:m3|" + old);                              // прежняя версия из записи ушла
    expect(got2.t.length).toBe(plan.thumbs.length);
  });
  it("экономия трафика в запись LP_GOT целые фото не заносит: появится обычная связь — они приедут", async () => {
    await aheadLessonPhotos(list, plan, { lean: true }); await tick();
    const got = JSON.parse(store0[LP_GOT + ":ta"]);
    expect(got.f).toEqual([]);
    expect(got.t.length).toBe(plan.thumbs.length);
    calls = [];
    expect(await aheadLessonPhotos(list, plan)).toEqual({ thumbs: 0, full: 5 });
    expect(photoCalls(true).length).toBe(5);
  });
  it("номера первых фото запоминаются (LP_HOT): при следующем запуске они в памяти целиком ещё до главной", async () => {
    await aheadLessonPhotos(list, plan); await tick();
    const key = Object.keys(store0).find((k) => k.startsWith(LP_HOT + ":"));
    expect(key).toBe(LP_HOT + ":ta");
    expect(JSON.parse(store0[key])).toEqual(plan.full.slice(0, HOT_MAX).map((id) => id + "|" + ver(id)));
    _resetLessonPhotos(); calls = [];
    expect(lessonPhotoCached("m2-1", ver("m2-1"), true)).toBe(null);
    expect(await warmLessonPhotos()).toBe(7);                                  // превью — как в v158
    for (const id of plan.full.slice(0, HOT_MAX)) expect(lessonPhotoCached(id, ver(id), true), id).toBe(url(SEED[id + "|"].full));
    expect(lessonPhotoCached("ref:coffee", ver("ref:coffee"), true)).toBe(null);   // пятое — не «первое»: в память при запуске не идёт
    expect(calls.length).toBe(0);
    // у другого человека на том же телефоне — свой список первых фото
    login("tr");
    expect(store0[LP_HOT + ":tr"]).toBe(undefined);
  });
  it("телефон просит экономить трафик (lean): целые фото с сервера не качаем, берём только то, что уже на телефоне", async () => {
    await lessonPhotoUrl("mod:m3", ver("mod:m3"), true); await tick();   // одно целое фото человек уже открывал
    expect(await restart()).toBe(0);                                      // превью на телефоне ещё нет
    list = await loadLessonPhotos(); calls = [];
    const out = await aheadLessonPhotos(list, plan, { lean: true });
    expect(photoCalls(true).length).toBe(0);
    expect(photoCalls(false).length).toBe(7);
    expect(out).toEqual({ thumbs: 7, full: 1 });
    expect(lessonPhotoCached("mod:m3", ver("mod:m3"), true)).toBe(url(SEED["mod:m3|"].full));
    expect(lessonPhotoCached("m2-1", ver("m2-1"), true)).toBe(null);
  });
  it("фото не приехало (нет связи) — остальные готовятся, а план пойдёт заново, когда попросят снова", async () => {
    failOn = (fn, b) => fn === "lesson_photo" && b.p_lesson === "mod:m3";
    const out = await aheadLessonPhotos(list, plan);
    expect(out).toEqual({ thumbs: 6, full: 4 });
    expect(lessonPhotoCached("mod:m3", ver("mod:m3"), false)).toBe(null);
    failOn = null; calls = [];
    expect(await aheadLessonPhotos(list, plan)).toEqual({ thumbs: 1, full: 1 });
    expect(photoCalls().map((c) => c[1].p_lesson + (c[1].p_full ? "*" : ""))).toEqual(["mod:m3", "mod:m3*"]);
  });
  it("нет входа, нет этапа 51, нет плана — ничего не делает; вошёл другой человек — заход останавливается", async () => {
    expect(await aheadLessonPhotos("missing", plan)).toEqual({ thumbs: 0, full: 0 });
    expect(await aheadLessonPhotos(null, plan)).toEqual({ thumbs: 0, full: 0 });
    expect(await aheadLessonPhotos(list, null)).toEqual({ thumbs: 0, full: 0 });
    expect(calls.length).toBe(0);
    const p = aheadLessonPhotos(list, plan);
    login("tr");                                   // пока шёл первый запрос, вошёл другой
    const out = await p;
    expect(out.thumbs + out.full).toBeLessThanOrEqual(1);
    expect(photoCalls().length).toBeLessThanOrEqual(1);
    phone.removeItem("sa_session_token");
    expect(await aheadLessonPhotos(list, plan)).toEqual({ thumbs: 0, full: 0 });
  });
  it("leanNet: экономия трафика или 2G — да; обычная связь или телефон не сообщает — нет", () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const set = (connection) => Object.defineProperty(globalThis, "navigator", { value: { userAgent: "node", connection }, configurable: true, writable: true });
    try {
      set({ saveData: true, effectiveType: "4g" }); expect(leanNet()).toBe(true);
      set({ saveData: false, effectiveType: "2g" }); expect(leanNet()).toBe(true);
      set({ effectiveType: "slow-2g" }); expect(leanNet()).toBe(true);
      set({ effectiveType: "3g" }); expect(leanNet()).toBe(false);
      set({ effectiveType: "4g" }); expect(leanNet()).toBe(false);
      set(undefined); expect(leanNet()).toBe(false);
    } finally { if (real) Object.defineProperty(globalThis, "navigator", real); else delete globalThis.navigator; }
  });
  it("заставка ждёт фото с телефона, но не дольше WARM_HOLD; готовить начинаем после главной (AHEAD_WAIT)", () => {
    expect(WARM_HOLD).toBe(300);
    expect(AHEAD_WAIT).toBe(1200);
    const app = rd("App.jsx");
    const at = app.indexOf("try { await Promise.race([warmLessonPhotos(), new Promise((r) => setTimeout(r, WARM_HOLD))]); } catch (e) {}");
    expect(at).toBeGreaterThan(0);
    expect(app.slice(at, at + 260)).toMatch(/clearTimeout\(fallback\);\n\s*setStorageLoaded\(true\);/);
    expect(app).toContain('import { warmLessonPhotos, WARM_HOLD } from "./lib/lesson-photo";');
    expect(app).toContain("useEffect(() => { warmLessonPhotos(); warmStaffPhotos(); }, []);");
    const rs = rd("ui/screens-roleselect.jsx");
    expect(rs).toContain("<PhotosAhead first={next ? next.mod : null} lesson={next ? next.lesson : null} mods={[...(MODULES[role] || []), ...(customByRole[role] || [])]} />");
    expect(rs).toContain("{profile && !(role && onContinueLesson) ? <PhotosAhead /> : null}");
    expect(R(h(PhotosAhead, { first: M1, mods: [M1, M2] }))).toBe("");   // сам ничего не рисует
  });
  it("снимки из приложения для «Справочника» тоже грузятся заранее; раздел со своим фото — пропускается", () => {
    const real = globalThis.Image, made = [];
    expect(warmAppCovers(null)).toBe(typeof real === "undefined" ? 0 : warmAppCovers(null));   // без Image (сервер) — ничего
    globalThis.Image = class { set src(v) { made.push(v); } };
    try {
      const own = { map: { "ref:serving": { best: { ver: "x" } } } };
      expect(warmAppCovers(own)).toBe(1);
      expect(made).toEqual([REF_COVER_DEFAULT.wine.src]);
      expect(warmAppCovers("missing")).toBe(1);                   // без этапа 51 своих фото нет — снимок нужен
      expect(made).toEqual([REF_COVER_DEFAULT.wine.src, REF_COVER_DEFAULT.serving.src]);
      expect(warmAppCovers(null)).toBe(0);                         // второй раз те же снимки не просим
    } finally { if (real === undefined) delete globalThis.Image; else globalThis.Image = real; }
  });
});

// ── 3. фото проявляется ───────────────────────────────────────────────────────────────────────────────────────
const IMG_ST = { position: "absolute", inset: 0 };
const Probe = ({ id, ver, mode }) => { const c = useCover(id, ver, mode); return h("i", { "data-gone": String(c.gone) }, c.src || "нет"); };

describe("v163 · 4: фото проявляется, а не выскакивает — CoverPhoto, PhotoWait (ui/lesson-photo.jsx)", () => {
  let list;
  const ver = (id) => photoOf(list, id).ver;
  beforeEach(async () => { fresh(SEED); list = await loadLessonPhotos(); });
  it("фото известно при первом рисовании — стоит сразу: без проявления и без подложки", () => {
    const html = R(h(CoverPhoto, { src: url("QUJD"), style: IMG_ST, wait: h(PhotoWait) }));
    expect(html).toBe('<img src="data:image/jpeg;base64,QUJD" alt="" draggable="false" data-photo-layer="set" style="position:absolute;inset:0"/>');
    expect(R(h(CoverPhoto, { src: url("QUJD"), attrs: { "data-ref-photo": "" }, className: "x" }))).toBe('<img src="data:image/jpeg;base64,QUJD" alt="" draggable="false" data-ref-photo="" data-photo-layer="set" class="x"/>');
  });
  it("фото ещё нет — на его месте тихая подложка; адрес вместо фото — слой ждёт загрузки невидимым", () => {
    const wait = '<span class="sa-photo-wait" aria-hidden="true" data-photo-wait="" style="position:absolute;inset:0"></span>';
    expect(R(h(PhotoWait))).toBe(wait);
    expect(R(h(CoverPhoto, { src: null, style: IMG_ST, wait: h(PhotoWait) }))).toBe(wait);
    expect(R(h(CoverPhoto, { src: null }))).toBe("");
    const byUrl = noPreload(R(h(CoverPhoto, { src: "/reference/wine_pour.jpg", style: IMG_ST, wait: h(PhotoWait) })));
    expect(byUrl).toBe(wait + '<img src="/reference/wine_pour.jpg" alt="" draggable="false" data-photo-layer="wait" style="position:absolute;inset:0;opacity:0"/>');
  });
  it("слой: ждёт, пока телефон разберёт фото (decode), проявляется анимацией и остаётся стоять; прежний слой уходит после", () => {
    const src = rd("ui/lesson-photo.jsx");
    expect(PHOTO_FADE).toBe(450);
    expect(src).toContain('const [st, setSt] = React.useState(soft ? "wait" : "set");');
    expect(src).toContain('if (soft === "url" && ready()) { setSt("set"); onShown(k); return undefined; }');
    expect(src).toContain('if (el && typeof el.decode === "function") el.decode().then(go, () => { if (isData(src) || ready()) go(); });');
    expect(src).toContain('setSt("in"); done = setTimeout(() => { if (live) { setSt("set"); onShown(k); } }, PHOTO_FADE + 60);');
    expect(src).toContain("const guard = isData(src) ? setTimeout(go, 1200) : 0;");
    expect(src).toContain('className={[className, st === "in" ? "sa-photo-in" : ""].filter(Boolean).join(" ") || undefined} style={st === "wait" ? { ...style, opacity: 0 } : style}');
    expect(src).toContain("setLayers((ls) => (s ? [...ls, { k: ++seq.current, src: s, soft: true, done: false }] : []));");
    expect(src).toContain("{!layers.length || !layers[0].done ? wait : null}");
    const css = rd("ui/css.js");
    expect(css).toContain("@keyframes saPhotoIn { from { opacity:0; } }");
    expect(css).toContain(".sa-photo-in { animation: saPhotoIn .45s ease-out backwards; }");
    expect(css).toMatch(/\.sa-photo-wait \{ opacity:0; background: linear-gradient\([^;]+; background-size:200% 100%;\s+animation: saShimmer 2\.6s linear infinite, saPhotoWait \.6s ease \.5s forwards; \}/);
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .sa-photo-in { animation:none; } .sa-photo-wait { animation:none; opacity:1; } }");
  });
  it("useCover: что в памяти, то и при первом рисовании; соседней странице (ready) — целое, если оно уже есть", async () => {
    const v = ver("mod:m1");
    expect(R(h(Probe, { id: "mod:m1", ver: v, mode: true }))).toBe('<i data-gone="false">нет</i>');
    await lessonPhotoUrl("mod:m1", v, false);
    for (const mode of [true, false, "ready"]) expect(R(h(Probe, { id: "mod:m1", ver: v, mode }))).toBe('<i data-gone="false">' + url(SEED["mod:m1|"].thumb) + "</i>");
    await lessonPhotoUrl("mod:m1", v, true);
    expect(R(h(Probe, { id: "mod:m1", ver: v, mode: true }))).toContain(url(SEED["mod:m1|"].full));
    expect(R(h(Probe, { id: "mod:m1", ver: v, mode: "ready" }))).toContain(url(SEED["mod:m1|"].full));
    expect(R(h(Probe, { id: "mod:m1", ver: v, mode: false }))).toContain(url(SEED["mod:m1|"].thumb) + "<");   // плитке — превью
    expect(R(h(Probe, { id: null, ver: "", mode: true }))).toBe('<i data-gone="false">нет</i>');
    const src = rd("ui/lesson-photo.jsx");
    expect(src).toContain("const pull = wantFull === true;   // тянуть ли целое с телефона и сервера");
    expect(src).toContain("const b = pull ? lessonPhotoUrl(id, ver, true).then(");
  });
  it("раздел трека, «Справочник», плитка главы, обложка урока — слоями; мерцающей заглушки на месте фото больше нет", async () => {
    const mm = rd("ui/module-menu.jsx"), ref = rd("ui/ReferenceSection.jsx"), lp = rd("ui/lesson-photo.jsx");
    expect(mm).toContain('<div className="tbm-cover" aria-hidden="true"><CoverPhoto src={covSrc} wait={<PhotoWait />} /></div>');
    expect(mm).toContain('useCover(cov ? cov.id : null, cov ? cov.info.ver : "", passive ? "ready" : true);');
    expect(ref).toContain('{ownOn ? <CoverPhoto src={ownSrc} style={imgSt("50% 50%")} attrs={REF_PHOTO} wait={defImg || <PhotoWait />} /> : defImg}');
    expect(ref).toContain("const defImg = def ? <CoverPhoto key={def.src} src={def.src} style={imgSt(def.pos)} attrs={ownOn ? REF_UNDER : REF_PHOTO} /> : null;");
    expect(ref).toContain('const { src: ownSrc, gone } = useCover(own ? id : null, own ? own.ver : "");');
    expect(ref).toContain('const { src: ownSrc, gone } = useCover(own ? id : null, own ? own.ver : "", false);');   // плитка главы: превью (v158)
    expect(ref).toMatch(/\{kind === "own"\n\s+\? <CoverPhoto src=\{photo\} style=\{\{[^}]+\}\} wait=\{<PhotoWait \/>\} \/>/);
    expect(lp).toContain('<CoverPhoto src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} wait={<PhotoWait />} />');
    for (const s of [mm, ref, lp]) expect(s).not.toContain("sa-skel");
    // обложка урока: фото в памяти — стоит сразу; фото ещё едет — подложка
    const boss = PEOPLE[0];
    const wait = R(h(LessonCover, { lessonId: "m2-1", lessonTitle: "Урок 3", profile: boss, a11y: false }));
    expect(wait).toContain('data-lp-cover="net"');
    expect(wait).toContain("data-photo-wait");
    expect(wait).not.toContain("<img");
    await lessonPhotoUrl("m2-1", ver("m2-1"), true);
    const set = R(h(LessonCover, { lessonId: "m2-1", lessonTitle: "Урок 3", profile: boss, a11y: false }));
    expect(set).toContain('<img src="' + url(SEED["m2-1|"].full) + '" alt="" draggable="false" data-photo-layer="set"');
    expect(set).not.toContain("data-photo-wait");
  });
  it("лист «Фото раздела» у раздела трека говорит, что фото видно и в билете на главной", () => {
    const also = "Это же фото видно на главной, в билете «Начать», пока сотрудник проходит раздел. В виде «Для чтения» билет без фото.";
    expect(rd("ui/module-menu.jsx")).toContain('also="' + also + '"');
    const sheet = noDoc(() => R(h(LessonPhotoSheet, { kind: "section", lessonId: "mod:m1", lessonTitle: "Первый", profile: PEOPLE[0], a11y: false, list, onClose() {}, also })));
    expect(sheet).toContain('<div data-lp-also=""');
    expect(text(sheet)).toContain(also);
    expect(also).not.toMatch(/ [—–-] /);                                           // без тире между словами (Доп. 74)
    expect(noDoc(() => R(h(LessonPhotoSheet, { kind: "section", lessonId: "ref:coffee", lessonTitle: "Кофе", profile: PEOPLE[0], a11y: false, list, onClose() {} })))).not.toContain("data-lp-also");
  });
});

// ── 4. билет с фото раздела ───────────────────────────────────────────────────────────────────────────────────
const CARD = { mode: "track", action: "go", cta: "Начать", glyph: "cloche", lead: "Новичок · первый шаг", title: "Урок «Встреча гостя»", sub: "начни здесь" };
const ticket = (extra = {}) => R(h(NowInvitation, { ctx: CARD, a11y: false, rows: [], on: { go: noop }, lens: true, ...extra }));

describe("v163 · 2: фото раздела в билете «Начать» (ui/now-hero.jsx)", () => {
  let list;
  const ver = (id) => photoOf(list, id).ver;
  beforeEach(async () => { fresh(SEED); list = await loadLessonPhotos(); });
  it("фото в памяти — билет открывается уже с ним: правая половина, приглушено, слева тает; под кнопкой затемнение", async () => {
    await lessonPhotoUrl("mod:m1", ver("mod:m1"), true);
    const html = ticket({ coverMod: M1 });
    expect(html).toContain('<span aria-hidden="true" data-now-cover="own" style="position:absolute;top:0;bottom:0;right:0;width:47%;pointer-events:none;opacity:0.9;filter:brightness(0.62) saturate(0.9) sepia(0.18);');
    expect(html).toContain('<img src="' + url(SEED["mod:m1|"].full) + '" alt="" draggable="false" data-photo-layer="set" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%;display:block"/>');
    expect(html).toMatch(/mask-image:linear-gradient\(90deg, transparent 0%, rgba\(0,0,0,0\.22\) 22%, rgba\(0,0,0,0\.78\) 46%, #000 60%\)/);
    expect(count(html, "data-now-scrim")).toBe(1);
    expect(html).not.toContain("sa-fadein");                       // фото было сразу — затемнение тоже стоит сразу
    expect(html).toMatch(/data-now-stub="" style="[^"]*text-shadow:0 1px 4px rgba\(0,0,0,0\.85\)/);
    // фото лежит под текстом, линзой и словом «Начать»
    expect(html.indexOf("data-now-cover")).toBeLessThan(html.indexOf("data-now-tag"));
    expect(html.indexOf("data-now-scrim")).toBeLessThan(html.indexOf("data-now-stub"));
    expect(html).toContain(">Начать</span>");
  });
  it("у раздела нет своей обложки — фото первого урока с фото, как в треке; в памяти только превью — оно и стоит", async () => {
    await lessonPhotoUrl("m2-1", ver("m2-1"), false);
    const html = ticket({ coverMod: M2 });
    expect(html).toContain('data-now-cover="lesson"');
    expect(html).toContain('<img src="' + url(SEED["m2-1|"].thumb) + '"');
  });
  it("фото ещё едет — билет прежний (ни картинки, ни затемнения), место под фото готово: оно проявится", () => {
    const html = ticket({ coverMod: M1 });
    expect(count(html, "data-now-cover")).toBe(1);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("data-now-scrim");
    expect(html).not.toContain("text-shadow");
    const src = rd("ui/now-hero.jsx");
    expect(src).toContain("const covLate = React.useRef(!covSrc);");
    expect(src).toContain('className={covLate.current ? "sa-fadein" : undefined}');
  });
  it("«Для чтения», билет о смене, раздел без фото, сервер без этапа 51 — билет в точности прежний", async () => {
    await lessonPhotoUrl("mod:m1", ver("mod:m1"), true);
    const plain = ticket();
    expect(plain).not.toContain("data-now-cover");
    expect(ticket({ coverMod: { id: "без-фото", lessons: [{ id: "нет" }] } })).toBe(plain);
    expect(ticket({ coverMod: null })).toBe(plain);
    const paper = ticket({ a11y: true });
    expect(ticket({ a11y: true, coverMod: M1 })).toBe(paper);        // «Для чтения»: бумажный билет без фото
    expect(paper).not.toContain("data-now-cover");
    const rs = rd("ui/screens-roleselect.jsx");
    expect(rs).toContain("onReplyDone={() => setMoodReply(null)} coverMod={!ctx && next ? next.mod : null} />");   // билет о смене (ctx) — без фото
    expect(rd("ui/now-hero.jsx")).toContain("const cov = coverMod && dark ? moduleCover(photos, coverMod) : null;");
    // сервер без этапа 51
    for (const k of Object.keys(store0)) delete store0[k];
    setPhotoBackend(memoryBackend()); _resetLessonPhotos(); calls = [];
    globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({ code: "PGRST202", message: "Could not find the function" }) });
    login("ta");
    expect(await loadLessonPhotos()).toBe("missing");
    expect(ticket({ coverMod: M1 })).toBe(plain);
    expect(aheadPlan("missing", { first: M1, mods: [M1] })).toEqual({ full: [], thumbs: [] });
  });
});
