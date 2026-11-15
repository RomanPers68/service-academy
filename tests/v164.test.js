// v164 (Доп. 489): фото раздела в билете «Начать» — и в «Для чтения». Владелец (15.11) спросил: «А ты сделал фото только в
// темной теме?» — и на «могу добавить и в «Для чтения»: показать набросок или сразу сделать?» ответил: «Давай сразу добавим».
//   1. В «Для чтения» билет бумажный, и фото на нём — как отпечаток: правая часть, слева тает в бумагу, поверх бумажная
//      вуаль, под кнопкой вуаль плотнее; название и «Начать» читаются на любом снимке.
//   2. Фото в билете больше не трогает CSS filter (в v163 им приглушалось фото в тёмной теме): в v69 на iPhone владельца
//      карточка с filter под маской мигала после анимации появления. Фото приглушает слой поверх него (data-now-tone).
//   3. Подсказка в листе «Фото раздела» — без оговорки про «Для чтения».
// Сервер не меняется (этап 51). Разметки JSX в файле нет (Доп. 482).
// Вид в браузере (обе темы, оба вида главной, ширины, медленная сеть) — tools/claude/e2e-v164.mjs.
import { describe, it, expect, beforeEach, afterAll } from "vitest";
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
import { loadLessonPhotos, lessonPhotoUrl, photoOf, _resetLessonPhotos } from "../lib/lesson-photo";
import { NowInvitation } from "../ui/now-hero";
import { LessonPhotoSheet } from "../ui/lesson-photo";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html) => html.replace(/<[^>]+>/g, "");
const count = (s, part) => s.split(part).length - 1;
const noop = () => {};
const noDoc = (fn) => { const d = globalThis.document; delete globalThis.document; try { return fn(); } finally { globalThis.document = d; } };

// ── сервер в памяти (тот же, что в демо) и «телефон» ────────────────────────────────────────────────────────
const R0 = "Два моря, Океан";
const PEOPLE = [{ id: "u-roman", name: "Роман", surname: "", restaurant: R0, position: "owner", is_admin: true }, { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false }];
const pic = (s, n) => s.repeat(n);
const url = (x) => "data:image/jpeg;base64," + x;
const SEED = { "mod:m1|": { full: pic("QUJD", 21), thumb: pic("REVG", 7), w: 900, h: 600, by: "Роман" }, "m2-1|": { full: pic("QUJD", 22), thumb: pic("REVG", 8), w: 900, h: 600, by: "Роман" } };
const M1 = { id: "m1", title: "Первый", lessons: [{ id: "m1-1", title: "Урок 1" }] };
const M2 = { id: "m2", title: "Второй", lessons: [{ id: "m2-1", title: "Урок 3" }] };
const realFetch = globalThis.fetch;
let list;
const ver = (id) => photoOf(list, id).ver;
const fresh = async (lessonPhotos = SEED) => {
  for (const k of Object.keys(store0)) delete store0[k];
  setPhotoBackend(memoryBackend()); _resetLessonPhotos();
  const srv = makeServer({ today: "2026-11-15", rest: R0, people: PEOPLE, tok: { tr: "u-roman", ta: "e-anna" }, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, lessonPhotos });
  globalThis.fetch = async (u, init = {}) => ({ ok: true, status: 200, json: async () => srv.rpc(String(u).split("/rpc/")[1], JSON.parse(init.body || "{}")) });
  phone.setItem("sa_session_token", "ta");
  list = await loadLessonPhotos();
};
afterAll(() => { globalThis.fetch = realFetch; setPhotoBackend(null); _resetLessonPhotos(); });

const CARD = { mode: "track", action: "go", cta: "Начать", glyph: "cloche", lead: "Новичок · первый шаг", title: "Урок «Встреча гостя»", sub: "начни здесь" };
const ticket = (extra = {}) => R(h(NowInvitation, { ctx: CARD, a11y: false, rows: [], on: { go: noop }, lens: true, ...extra }));
// открывающий тег с этой отметкой (стиль читаем из него)
const tag = (html, attr) => { const i = html.indexOf(attr); if (i < 0) return ""; const a = html.lastIndexOf("<", i); return html.slice(a, html.indexOf(">", i) + 1); };
const PAPER_FADE = "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.10) 24%, rgba(0,0,0,0.45) 48%, rgba(0,0,0,0.85) 70%)";
const DARK_FADE = "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.20) 22%, rgba(0,0,0,0.70) 46%, rgba(0,0,0,0.90) 60%)";

describe("v164: метка, журнал, памятка", () => {
  it("«сборка v164» — по старшему tests/vN; CHANGES — Дополнение 489 со словами владельца; e2e-v164 в памятке", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(164);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 489 — .*\(v164\)/);
    const part = c.slice(c.indexOf("# Дополнение 489"));
    const flat = part.replace(/\s+/g, " ");
    expect(flat).toContain("А ты сделал фото только в темной теме?");
    expect(flat).toContain("Давай сразу добавим");
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v164.mjs");
  });
});

describe("v164 · 1: фото раздела в билете — и в «Для чтения» (ui/now-hero.jsx)", () => {
  beforeEach(async () => { await fresh(); await lessonPhotoUrl("mod:m1", ver("mod:m1"), true); });
  it("бумажный билет с фото: правая часть, слева тает в бумагу, поверх бумажная вуаль, под кнопкой вуаль плотнее", () => {
    const html = ticket({ a11y: true, coverMod: M1 });
    expect(html).toContain('data-hero="paper"');
    const cov = tag(html, "data-now-cover");
    expect(cov).toContain('data-now-cover="own"');
    expect(cov).toContain("position:absolute;top:0;bottom:0;right:0;width:47%;pointer-events:none;");
    expect(cov).toContain("mask-image:" + PAPER_FADE);
    expect(html).toContain('<img src="' + url(SEED["mod:m1|"].full) + '" alt="" draggable="false" data-photo-layer="set" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%;display:block"/>');
    expect(tag(html, "data-now-tone")).toBe('<span data-now-tone="" style="position:absolute;inset:0;background:rgba(255,249,236,0.34)">');
    const scrim = tag(html, "data-now-scrim");
    expect(scrim).toContain("background:linear-gradient(180deg, rgba(255,251,240,0.10) 0%, rgba(255,251,240,0.52) 45%, rgba(255,251,240,0.86) 100%)");
    expect(scrim).not.toContain("sa-fadein");                    // фото было сразу — вуаль тоже стоит сразу
    expect(tag(html, "data-now-stub")).toContain("text-shadow:0 1px 3px rgba(255,252,244,0.95), 0 0 8px rgba(255,252,244,0.8)");
    // порядок слоёв: фото и тон — под рамкой, названием и кнопкой
    expect(html.indexOf("data-now-cover")).toBeLessThan(html.indexOf("data-now-tone"));
    expect(html.indexOf("data-now-tone")).toBeLessThan(html.indexOf("data-now-scrim"));
    expect(html.indexOf("data-now-scrim")).toBeLessThan(html.indexOf("data-now-tag"));
    expect(html.indexOf("data-now-tag")).toBeLessThan(html.indexOf("data-now-stub"));
    // буквы названия — те же тёмные чернила, что без фото
    expect(tag(html, "data-now-title")).toContain("color:#2A1F0E");
    expect(text(html)).toContain("Урок «Встреча гостя»");
    expect(html).toContain(">Начать</span>");
  });
  it("оба вида главной: в «Линзе» — светлая линза, в «Как сейчас» — сургучная печать; фото стоит в обоих", () => {
    const lens = ticket({ a11y: true, coverMod: M1, lens: true }), wax = ticket({ a11y: true, coverMod: M1, lens: false });
    for (const html of [lens, wax]) { expect(count(html, "data-now-cover")).toBe(1); expect(count(html, "data-now-tone")).toBe(1); expect(count(html, "data-now-scrim")).toBe(1); }
    expect(lens).not.toBe(wax);
    // билет без фото в этих видах — в точности прежний
    const seal = (html) => html.replace(/nhw\d+/g, "nhw");   // у сургучной печати свой номер градиента на каждый рисунок
    for (const lensOn of [true, false]) {
      const plain = ticket({ a11y: true, lens: lensOn });
      expect(plain).not.toContain("data-now-cover");
      expect(plain).not.toContain("text-shadow");
      expect(seal(ticket({ a11y: true, lens: lensOn, coverMod: { id: "без-фото", lessons: [] } }))).toBe(seal(plain));
    }
    expect(wax).toContain("nhw");
    expect(lens).not.toContain("nhw");
  });
  it("у раздела нет своей обложки — фото урока; фото ещё едет — бумажный билет прежний, место под фото готово", async () => {
    await lessonPhotoUrl("m2-1", ver("m2-1"), false);
    const les = ticket({ a11y: true, coverMod: M2 });
    expect(les).toContain('data-now-cover="lesson"');
    expect(les).toContain('<img src="' + url(SEED["m2-1|"].thumb) + '"');
    _resetLessonPhotos(); list = await loadLessonPhotos();          // приложение открыли заново: фото в памяти нет
    const wait = ticket({ a11y: true, coverMod: M1 });
    expect(count(wait, "data-now-cover")).toBe(1);
    expect(wait).not.toContain("<img");
    expect(wait).not.toContain("data-now-tone");
    expect(wait).not.toContain("data-now-scrim");
    expect(wait).not.toContain("text-shadow");
    const src = rd("ui/now-hero.jsx");
    expect(count(src, 'className={covLate.current ? "sa-fadein" : undefined}')).toBe(2);   // тон и вуаль проявятся вместе с фото
    expect(src).toContain("const cov = coverMod ? moduleCover(photos, coverMod) : null;");
    expect(src).toContain("const C = dark ? COVER_DARK : COVER_PAPER;");
  });
});

describe("v164 · 2: фото в билете без CSS filter — приглушает слой поверх фото", () => {
  beforeEach(async () => { await fresh(); await lessonPhotoUrl("mod:m1", ver("mod:m1"), true); });
  it("тёмная тема: у фото нет ни filter, ни opacity; поверх — тёмный тон; маска тает слева", () => {
    const html = ticket({ coverMod: M1 });
    const cov = tag(html, "data-now-cover");
    expect(cov).toContain("mask-image:" + DARK_FADE);
    expect(cov).not.toContain("filter");
    expect(cov).not.toContain("opacity");
    expect(tag(html, "data-now-tone")).toBe('<span data-now-tone="" style="position:absolute;inset:0;background:rgba(26,18,7,0.42)">');
    expect(tag(html, "data-now-scrim")).toContain("background:linear-gradient(180deg, rgba(16,12,5,0.10) 0%, rgba(16,12,5,0.38) 45%, rgba(16,12,5,0.70) 100%)");
    expect(tag(html, "data-now-stub")).toContain("text-shadow:0 1px 4px rgba(0,0,0,0.85)");
    // во всём билете с фото нет CSS filter (у стекла линзы свой backdrop-filter — он был и раньше)
    for (const a11y of [false, true]) expect(ticket({ a11y, coverMod: M1 }).replace(/backdrop-filter/g, "")).not.toMatch(/[;"]filter:/);
  });
  it("в коде билета фото filter не трогает; причина записана (v69: мигание на iPhone)", () => {
    const src = rd("ui/now-hero.jsx");
    expect(src).not.toMatch(/filter: "brightness/);
    expect(src).toContain('const COVER_DARK = { w: "47%", fade: "' + DARK_FADE + '", tone: "rgba(26,18,7,0.42)",');
    expect(src).toContain('const COVER_PAPER = { w: "47%", fade: "' + PAPER_FADE + '", tone: "rgba(255,249,236,0.34)",');
    expect(src).toContain("в v69 владелец заметил,");
    expect(src).toContain("WebkitMaskImage: C.fade, maskImage: C.fade }}>");
    expect(src).toContain("textShadow: covSrc ? C.glow : undefined }}>");
  });
});

describe("v164 · 3: подсказка в листе «Фото раздела»", () => {
  it("без оговорки про «Для чтения»: фото видно в билете в обеих темах", async () => {
    await fresh();
    const also = "Это же фото видно на главной, в билете «Начать», пока сотрудник проходит раздел.";
    const mm = rd("ui/module-menu.jsx");
    expect(mm).toContain('also="' + also + '" />');
    expect(mm).not.toContain("билет без фото");
    const sheet = noDoc(() => R(h(LessonPhotoSheet, { kind: "section", lessonId: "mod:m1", lessonTitle: "Первый", profile: PEOPLE[0], a11y: true, list, onClose() {}, also })));
    expect(text(sheet)).toContain(also);
    expect(also).not.toMatch(/ [—–-] /);
  });
});
