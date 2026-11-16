// v172 (Доп. 497): «Бар» — в ленте главной, рядом с «Меню»; в «Справочнике» остаются основы. Владелец (16.11): «Может бар из
// справочника рядом с меню вставим? Так как раз место для одного есть», «В справочнике можем оставить основу», «С колоды
// основы можем убрать, оставить их только в справочнике. А карточка в справочнике пусть будет «Бар: Основы»».
//   • ui/screens-roleselect.jsx, App.jsx, ui/tokens.js — значок «Бар» в ленте: открывает «Барную карту», «назад» — на главную;
//   • ui/ReferenceSection.jsx, data/reference.js — карточки «Барная карта» в Справочнике нет, на её месте раздел «Бар: Основы»;
//   • ui/cocktails.jsx — в колоде бармена больше нет «Основы ›»; ui/bar-card.jsx, ui/wine-list.jsx — шапка без «Справочник ·»;
//   • lib/lesson-photo.js — обложка, поставленная «Барной карте», достаётся разделу «Бар: Основы» (refCoverPick);
//   • тексты: тур главной, «Гид», подсказка Наставнику, где искать карту.
// Сервер не меняется. Разметки JSX в файле нет (Доп. 482). Вид в браузере — tools/claude/e2e-v172.mjs.
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

import { dockFit, DOCK_MIN } from "../lib/dock-fit.js";
import { HINTS, HINTS_VERSION } from "../data/hints.js";
import { TOOL_COLOR, toolColor } from "../ui/tokens";
import { REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE, REFERENCE_APP_COURSE } from "../data/reference";
import { REFERENCE_DAILY_INDEX } from "../data/reference-index";
import { ReferenceSection, hubCards, REF_OFF_HUB } from "../ui/ReferenceSection";
import { RefEditorScreen } from "../ui/ref-editor";
import { loadRefBook, mergeRefBook, _resetRefBook } from "../lib/ref-book";
import { refCoverId, refCoverPick, REF_COVER_IDS, aheadPlan, loadLessonPhotos, _resetLessonPhotos } from "../lib/lesson-photo";
import { setPhotoBackend, memoryBackend } from "../lib/photo-store";
import { S } from "../ui/styles";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html) => html.replace(/<[^>]+>/g, "");
const count = (s, part) => s.split(part).length - 1;
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const noop = () => {};
const noDoc = (fn) => { const d = globalThis.document; delete globalThis.document; try { return fn(); } finally { globalThis.document = d; } };
const wipe = () => { for (const k of Object.keys(store0)) delete store0[k]; };

const OCEAN = "Два моря, Океан";
const RS = rd("ui/screens-roleselect.jsx"), APP = rd("App.jsx"), REF = rd("ui/ReferenceSection.jsx");

describe("v172 · версия и журнал", () => {
  it("сборка v172, Дополнение 497, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(172);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 497 — .*\(v172\)/);
    const part = c.slice(c.indexOf("# Дополнение 497")).replace(/\s+/g, " ");
    for (const w of ["Может бар из справочника рядом с меню вставим? Так как раз место для одного есть", "В справочнике можем оставить основу", "пусть будет «Бар: Основы»"]) expect(part, w).toContain(w);
    for (const line of c.slice(c.indexOf("# Дополнение 497")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v172.mjs");
  });
});

// ───────────────────────── 1. Лента главной ─────────────────────────
const T4 = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false,
  roleHeader: {}, roleSubtitle: {}, roleList: {}, roleCard: {}, roleAccent: {}, roleIcon: {}, roleInfo: {}, roleLabel: {}, roleSublabel: {}, roleDesc: {} };
const mod = { id: "cms-m-1", title: "Свой раздел", lessons: [{ id: "cms-l-1", type: "lesson", title: "Урок: встреча гостя", content: "Текст" }] };
const waiter = { name: "Анна", surname: "Смирнова", restaurant: OCEAN, position: "waiter" };
const boss = { name: "Роман", surname: "", restaurant: OCEAN, position: "manager", is_admin: true };
const TOOLS = { onReference: noop, onMenuTrainer: noop, onBarCard: noop, onGlossary: noop, onChecklist: noop, onSOS: noop };
const home = async (extra = {}) => {
  const { RoleSelect } = await import("../ui/screens-roleselect");
  return R(h(RoleSelect, { learnOnly: true, T: T4, a11y: false, profile: waiter, role: "seasonal", onSelect: noop, onContinueLesson: noop, onGuestBook: noop, onSchedule: noop, customByRole: { seasonal: [mod] }, ...TOOLS, ...extra }));
};
// подписи инструментов в ленте, по порядку (SOS — отдельным кругом, за чертой)
const row = (html) => { const a = html.indexOf('data-tools-row=""'), b = html.indexOf("data-sos-disc", a); return a < 0 ? null : [...html.slice(a, b < 0 ? undefined : b).matchAll(/ title="([^"]+)"/g)].map((m) => m[1]); };

describe("v172 · 1: значок «Бар» в ленте главной, рядом с «Меню»", () => {
  beforeEach(wipe);
  it("у руководителя шесть значков, у сотрудника пять: «Бар» сразу за «Меню»", async () => {
    expect(row(await home({ profile: boss, onCandidate: noop }))).toEqual(["Справочник", "Меню", "Бар", "Глоссарий", "Чек-листы", "AI-интервью"]);
    expect(row(await home({ completed: { "cms-l-1": true } }))).toEqual(["Справочник", "Меню", "Бар", "Глоссарий", "Чек-листы"]);
    expect(RS).toContain('const ORDER = ["sp", "ob", "menu", "bar", "gl", "cl", "hire"];');
    expect(RS).toContain('const learn = new Set(["sp", "sos", "menu", "bar", "cl", ...(role === "seasonal" && newbie ? ["ob"] : []), ...(isStaff && onCandidate ? ["hire"] : [])]);');
  });
  it("новичку до первого урока «Бар» не показан, как и «Меню»; без обработчика значка нет", async () => {
    const newbie = row(await home());
    expect(newbie).toEqual(["Справочник"]);
    expect(text(await home())).toContain("Остальные инструменты откроются после первого урока");
    expect(row(await home({ completed: { "cms-l-1": true }, onBarCard: null }))).toEqual(["Справочник", "Меню", "Глоссарий", "Чек-листы"]);
    expect(RS).toContain("onMenuTrainer, onBarCard = null, onMentor,");
  });
  it("значок — бокал, тот же, что был у карточки «Барная карта» в Справочнике; подпись «Бар»; цвет — медь трека «Бар»", async () => {
    expect(RS).toContain('if (onBarCard) tiles.push({ key:"bar", label:"Бар", onClick:onBarCard, icon:(');
    const glass = '<path d="M5 4h14l-7 8.5z"/><path d="M12 12.5V20"/><path d="M8 20h8"/><path d="M8.5 7h7"/>';
    expect(RS).toContain(glass + "</svg>");
    expect(rd("ui/reference-illustrations.jsx").replace(/ \/>/g, "/>")).toContain('cocktail: (c, s = 26) => (<svg {...sv(c, s, 1.7)}>' + glass + "</svg>),");
    const html = await home({ profile: boss });
    const at = html.indexOf(' title="Бар"');
    expect(at).toBeGreaterThan(0);
    expect(html.slice(at, at + 1400)).toContain("M5 4h14l-7 8.5z");
    expect(html.slice(at, html.indexOf(' title="Глоссарий"'))).toMatch(/data-tool-label=""[^>]*>Бар<\/span>/);
    expect(Object.keys(TOOL_COLOR)).toEqual(["sp", "menu", "gl", "bar"]);
    expect([toolColor("bar", false), toolColor("bar", true)]).toEqual(["#D2875A", "#93500F"]);
    expect(rd("lib/tracks.js")).toContain('{ id: "bar",             label: "Бар",             color: "#D2875A", ink: "#93500F" },');   // та же пара, что у трека
    expect(html.slice(at, at + 600)).toContain("--tint:#D2875A55");
  });
  it("кружки и подписи с шестым значком: 402 и 393 — подписи ездят, 375 и уже у руководителя — только значки; ряд не растёт", () => {
    // ширина ряда без SOS — замер в браузере: 402 → 293, 393 → 282…284, 375 → 268…270, 360 → 253…255, 320 → 213…215;
    // самая длинная подпись: у руководителя «AI-интервью» ≈ 64 px, у сотрудника «Справочник» ≈ 60…61 px
    expect(dockFit(293, 64, 6, 36)).toEqual({ ring: 30, labels: true });
    expect(dockFit(282, 64, 6, 36)).toEqual({ ring: 29, labels: true });
    expect(dockFit(268, 64, 6, 34)).toEqual({ ring: 34, labels: false });
    expect(dockFit(253, 64, 6, 34)).toEqual({ ring: 34, labels: false });
    expect(dockFit(213, 64, 6, 34)).toEqual({ ring: 29, labels: false });
    // сотрудник (пять значков): на 393 кружки прежние, 36 px; подписи остаются до 360; на 320 — значки
    expect(dockFit(282, 61, 5, 36)).toEqual({ ring: 36, labels: true });
    expect(dockFit(268, 61, 5, 34)).toEqual({ ring: 33, labels: true });
    expect(dockFit(253, 61, 5, 34)).toEqual({ ring: 30, labels: true });
    expect(dockFit(213, 61, 5, 34).labels).toBe(false);
    expect(DOCK_MIN).toBe(28);   // правило то же: подпись влезает при кружке не меньше 28 px, иначе только значки
    // шесть кружков без подписей помещаются в ряд на любом телефоне от 320 px
    for (const w of [213, 253, 268, 282, 293]) { const { ring } = dockFit(w, 64, 6, 36); expect(6 * (ring + 4) + 5 * 2, String(w)).toBeLessThanOrEqual(w); }
  });
  it("App: значок открывает «Барную карту» заново (без чужой вкладки и карточки); «назад» из неё — туда, откуда пришёл", () => {
    expect(APP).toContain('onBarCard={() => { setBarBack(null); setBarNote(""); setWineStart(null); setBarTab(null); setBarSom(false); setBarOpenN((n) => n + 1); navigate("wines"); }}');
    expect(APP).toContain(' note={barNote} onBack={() => goBack()}');
    expect(APP).not.toContain('note={barNote} onBack={() => goBack("reference")}');
    // прежние входы в карту остались: из «Меню», из чата, из совета, из поиска Справочника
    for (const s of ['onWines={() => { setWineStart("@train"); setBarTab("wine"); navigate("wines"); }}', 'onBarItem={(kind, id) => { setRefStart(null); setWineStart(id); setBarTab(kind); navigate("wines"); }}']) expect(APP, s).toContain(s);
  });
  it("тур главной и «Гид» — про бар; версия подсказок та же (заново их не показываем)", () => {
    expect(HINTS.home_staff[1]).toBe("В этой ленте справочник и SOS на случай, если растерялся в смене. После первого урока здесь появятся меню, бар, глоссарий и чек-листы.");
    expect(HINTS.home_admin[1]).toBe("Эта лента всегда под рукой: справочник, меню, бар, глоссарий, чек-листы и AI-интервью для кандидатов. Красный круг справа открывает SOS, когда всё горит.");
    expect(HINTS_VERSION).toBe(5);
    const G = rd("ui/guide.jsx");
    const line = G.split("\n").find((l) => l.includes('key: "barhome"'));
    expect(line).toContain('title: "Бар на главной", text: "Значок «Бар» в ленте на главной, рядом с «Меню», открывает «Барную карту»: коктейли, вина и крепкое вашего бара, а из неё «Колоду бармена». В Справочнике остался раздел «Бар: Основы»: истории классики и техника.", go: "wines" }');
    expect(line).not.toMatch(/ — | · /);
    expect(G).toContain('{ key: "barprint", title: "Барная карта: печать и в чат", text: "«Бар» на главной → «Печать» в строке под вкладками:');
    expect(G).toContain('{ key: "sommelier", title: "Сомелье", text: "«Бар» на главной → «Сомелье» под вкладками.');
    expect(G).toContain("Кофе с пропорциями и историями, «Бар: Основы» с историями классики.");
    expect(G).not.toContain("Справочник → «Барная карта»");
    expect(rd("lib/reference-context.js")).toContain('let head = "— В «Барной карте» (значок «Бар» в ленте на главной): "');
  });
});

// ───────────────────────── 2. Справочник ─────────────────────────
const PEOPLE = [{ id: "u-roman", name: "Роман", surname: "", restaurant: OCEAN, position: "owner", is_admin: true }, { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: OCEAN, position: "waiter", is_admin: false }];
const ROMAN = PEOPLE[0], ANNA = PEOPLE[1];
const PH = { full: "QUJD".repeat(40), thumb: "REVG".repeat(8), w: 900, h: 600, by: "Роман" };
const BASE = [REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE, REFERENCE_APP_COURSE];
const book = async (more = {}) => {
  wipe(); setPhotoBackend(memoryBackend()); _resetLessonPhotos(); _resetRefBook();
  const srv = makeServer({ today: "2026-11-16", rest: OCEAN, people: PEOPLE, tok: { tr: "u-roman", ta: "e-anna" }, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, refBook: [], ...more });
  globalThis.fetch = async (u, init = {}) => ({ ok: true, status: 200, json: async () => srv.rpc(String(u).split("/rpc/")[1], JSON.parse(init.body || "{}")) });
  phone.setItem("sa_session_token", "tr");
  await loadRefBook(); await loadLessonPhotos();
  return srv;
};
const refScreen = (p = {}) => R(h(ReferenceSection, { T: S, a11y: false, onExit: noop, profile: ANNA, ...p }));
const cardIds = (html) => [...html.matchAll(/data-ref-card="([^"]+)"/g)].map((m) => m[1]);

describe("v172 · 2: в «Справочнике» вместо карточки «Барная карта» — раздел «Бар: Основы»", () => {
  it("раздел называется «Бар: Основы»: шесть глав, первая — «Классика как язык бара»; указатель глав пересобран", () => {
    expect(REFERENCE_BAR_COURSE.title).toBe("Бар: Основы");
    expect(REFERENCE_BAR_COURSE.id).toBe("bar");
    expect(REFERENCE_BAR_COURSE.lessons.map((l) => l.id)).toEqual(["brc-canon", "brc-aperitif", "brc-sour", "brc-strong", "brc-zero", "brc-story"]);
    expect(REFERENCE_BAR_COURSE.lessons[0].title).toBe("Классика как язык бара");
    const idx = REFERENCE_DAILY_INDEX.filter((e) => e.cid === "bar");
    expect(idx.length).toBe(6);
    expect([...new Set(idx.map((e) => e.course))]).toEqual(["Бар: Основы"]);
    expect(rd("data/reference.js")).not.toContain('title: "Бар: истории и техника"');
    expect(rd("data/reference-index.js")).not.toContain("Бар: истории и техника");
    expect(REFERENCE_APP_COURSE.lessons.find((l) => l.id === "app-ref").content).toContain("• **Бар: Основы** — истории классики и готовые фразы «Гостю: …». Сама «Барная карта» открывается с главной, значком «Бар».");
  });
  it("карточки хаба: «Сервировка», «Вина», «Кофе», «Бар: Основы» (витраж с бокалом), свои разделы — за ними; карточек вне разделов нет", () => {
    expect(REF_OFF_HUB).toEqual(["app"]);
    const cards = hubCards(BASE);
    expect(cards.map((c) => [c.id, c.t, c.s, c.art])).toEqual([["serving", "Сервировка", "6 глав с фото", undefined], ["wine", "Вина", "8 глав", undefined], ["coffee", "Кофе", "7 глав со схемами", undefined], ["bar", "Бар: Основы", "6 глав", "cocktails"]]);
    const own = hubCards(mergeRefBook(BASE, [{ id: "rs-a", kind: "sec", parent: "", title: "Стандарты заведения", sub: null, body: null, hidden: false, sort: null }, { id: "rc-1", kind: "ch", parent: "rs-a", title: "Встреча гостя", sub: null, body: "Текст", hidden: false, sort: null }]));
    expect(own.map((c) => c.id)).toEqual(["serving", "wine", "coffee", "bar", "rs-a"]);
    const src = code(REF);
    expect(src).toContain("const cards = hubCards(sections);");
    expect(src).toContain("onGo={() => openCourse(c.id)} />");
    for (const gone of ['id: "barcard"', 'id: "cocktails"', "barLine(", "onWines", "onCocktails", "Бар: коктейли"]) expect(src, gone).not.toContain(gone);
    expect(src).toContain('bar: { icon: Ico.cocktail, tail: "", art: "cocktails" } };');
  });
  it("на экране: четыре карточки, «Барной карты» нет; раздел открывается, глава читается", async () => {
    await book();
    const html = refScreen();
    expect(cardIds(html)).toEqual(["serving", "wine", "coffee", "bar"]);
    const t = text(html);
    expect(t).toContain("Бар: Основы");
    expect(t).toContain("6 глав");
    expect(t).not.toContain("Барная карта");
    expect(html).toMatch(/data-ref-card="bar" data-ref-cover="art"/);
    const ch = text(refScreen({ startLessonId: "brc-canon" }));
    expect(ch).toContain("Классика как язык бара");
    expect(ch).toContain("Классический коктейль");
  });
  it("порядок: без правок «Бар: Основы» четвёртым; разделы переставляли раньше — он встаёт за ними, перед своими разделами", async () => {
    await book({ refBook: [{ id: "coffee", kind: "sec", parent: "", title: null, sub: null, body: null, hidden: false, sort: 10 }, { id: "serving", kind: "sec", parent: "", title: null, sub: null, body: null, hidden: false, sort: 20 },
      { id: "wine", kind: "sec", parent: "", title: null, sub: null, body: null, hidden: false, sort: 30 }, { id: "rs-a", kind: "sec", parent: "", title: "Стандарты заведения", sub: null, body: null, hidden: false, sort: 40 },
      { id: "rc-1", kind: "ch", parent: "rs-a", title: "Встреча гостя", sub: null, body: "Текст", hidden: false, sort: null }] });
    expect(cardIds(refScreen())).toEqual(["coffee", "serving", "wine", "bar", "rs-a"]);
  });
  it("колода бармена: ссылки «Основы ›» больше нет, главы живут только в Справочнике", () => {
    const C = rd("ui/cocktails.jsx"), src = code(C);
    expect(src).not.toContain("Основы ›");
    expect(src).not.toContain("onBasics");
    expect(code(APP)).not.toContain("onBasics");
    expect(C).toContain("export function CocktailsScreen({ T, a11y, onBack, startId, onBuild,");
    for (const s of ["Свои ›</span>", "Сборка ›</span>"]) expect(C, s).toContain(s);
    // совет в уроке по-прежнему ведёт в главу Справочника
    expect(rd("data/lesson-tips.js")).toContain('{ ref: "brc-canon" }');
  });
  it("шапка «Барной карты»: над названием — заведение, слова «Справочник» больше нет", () => {
    expect(rd("ui/bar-card.jsx")).toContain('{head(restaurant || "Бар", "Барная карта", onBack,');
    expect(rd("ui/wine-list.jsx")).toContain('{head(listTitle, onBack, restaurant || "Бар")}');
    for (const f of ["ui/bar-card.jsx", "ui/wine-list.jsx"]) expect(code(rd(f)), f).not.toContain('"Справочник · "');
  });
});

// ───────────────────────── 3. Обложка и редактор ─────────────────────────
describe("v172 · 3: обложка прежней «Барной карты» и редактор справочника", () => {
  const list = (ids) => ({ map: Object.fromEntries(ids.map((id) => [id, { best: { ver: "v-" + id } }])) });
  it("обложка: у «Бар: Основы» своя, а пока её нет — та, что ставили «Барной карте»; у остальных разделов — только своя", () => {
    const bar = refCoverId("bar"), old = refCoverId("barcard");
    expect([bar, old]).toEqual(["ref:bar", "ref:barcard"]);
    expect(refCoverPick(list([old]), "bar")).toBe(old);
    expect(refCoverPick(list([old, bar]), "bar")).toBe(bar);
    expect(refCoverPick(list([]), "bar")).toBe(bar);
    for (const none of [null, undefined, "missing", {}]) expect(refCoverPick(none, "bar")).toBe(bar);
    expect(refCoverPick(list([old]), "coffee")).toBe("ref:coffee");
    expect(refCoverPick(list([old]), "rs-a")).toBe("ref:rs-a");
    expect(REF_COVER_IDS).toEqual(["serving", "wine", "coffee", "bar", "barcard"]);
    const plan = aheadPlan(list([old, "ref:coffee"]), {});
    expect(plan.full).toEqual(["ref:coffee", "ref:barcard"]);   // прежняя обложка готовится заранее, как остальные
    expect(REF).toContain("const id = refCoverPick(photos, c.id);");
    expect(rd("ui/ref-editor.jsx")).toContain("const coverId = onHub ? refCoverPick(photos, sec.id) : null;");
  });
  it("на экране: фото «Барной карты» стоит на карточке «Бар: Основы», фотоаппарат владельца правит его же", async () => {
    await book({ lessonPhotos: { "ref:barcard|": PH } });
    const html = refScreen({ profile: ROMAN });
    expect(html).toMatch(/data-ref-card="bar" data-ref-cover="(own|wait)"/);
    expect(html).toContain('data-cover-edit="ref:barcard"');
    expect(html).not.toContain('data-cover-edit="ref:bar"');
    await book({ lessonPhotos: { "ref:barcard|": PH, "ref:bar|": PH } });
    expect(refScreen({ profile: ROMAN })).toContain('data-cover-edit="ref:bar"');
    await book();
    const plain = refScreen({ profile: ROMAN });
    expect(plain).toMatch(/data-ref-card="bar" data-ref-cover="art"/);
    expect(plain).toContain('data-cover-edit="ref:bar"');
  });
  it("редактор: «Бар: Основы» — в общем списке разделов, со стрелками; блока «Отдельно» больше нет", async () => {
    await book();
    const html = noDoc(() => R(h(RefEditorScreen, { T: S, a11y: false, profile: ROMAN, onBack: noop })));
    expect([...html.matchAll(/data-re-sec="([^"]+)"/g)].map((m) => m[1])).toEqual(["serving", "wine", "coffee", "bar"]);
    const t = text(html);
    expect(t).toContain("Бар: Основы");
    expect(t).toContain("4 раздела");
    for (const gone of ["Отдельно", "из колоды бармена"]) expect(t, gone).not.toContain(gone);
    expect(count(html, 'data-re-up=""')).toBe(4);
    const E = code(rd("ui/ref-editor.jsx"));
    expect(E).not.toContain("offSecs");
    expect(E).toContain("const hubSecs = tree.filter((s) => !REF_OFF_HUB.includes(s.id));");
  });
});
