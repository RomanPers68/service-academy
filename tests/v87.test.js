// v87 (Доп. 400): красивее — рисунки золотой линией для пустых мест, «Как было у нас» плашкой с подписью рассказчика,
// страница гостя в кремово-золотых тонах с сердцем, которое рисуется линией, картинки для печати (карточка, домик на
// стол, вкладыш в папку для счёта, наклейка) и «Смена» под роль. Вид — tools/claude/e2e-v87.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
if (!globalThis.localStorage) globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k of Object.keys(store)) delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { casesToSits, caseWhy, caseNote } from "../lib/cases.js";
import { mistakeFromSituation } from "../lib/practice-mistake.js";
import { HEART_PATH } from "../lib/guest-thanks.js";
import { qrMatrix } from "../lib/qr.js";
import { shiftRoleOf, hallOf, hallHead, hallParts, hallLine, nextRes, resLine, myTablesList, tableChip, roleCard } from "../lib/shift-role.js";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

describe("v87: рисунки золотой линией", () => {
  it("шесть рисунков, только украшение (aria-hidden), неизвестный — ничего", async () => {
    const { LineArt, LINE_ARTS } = await import("../ui/line-art.jsx");
    expect(LINE_ARTS).toEqual(["bell", "tray", "heart", "table", "mic", "say"]);
    for (const k of LINE_ARTS) {
      const html = R(h(LineArt, { kind: k }));
      expect(html).toContain('data-line-art="' + k + '"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('stroke="#D2A85A"');
    }
    expect(R(h(LineArt, { kind: "nope" }))).toBe("");
    expect(R(h(LineArt, { kind: "heart", color: "#7A5D2A", size: 100 }))).toContain('width="100" height="69"');
  });
  it("стоят там, где пусто: брифинг, случаи, спасибо, рассадка, голоса, «Как произносить»", () => {
    const want = { "ui/briefing.jsx": "bell", "ui/cases.jsx": "tray", "ui/thanks.jsx": "heart", "ui/seating.jsx": "table", "ui/voice-note.jsx": "mic", "ui/pronounce.jsx": "say" };
    for (const [f, k] of Object.entries(want)) {
      const src = rd(f);
      expect(src, f).toContain('import { LineArt } from "./line-art";');
      expect(src, f).toContain('<LineArt kind="' + k + '"');
    }
  });
});

describe("v87: «Как было у нас» — плашкой с подписью рассказчика", () => {
  const SIT = { scene: "Гость за баром просит коктейль не из карты.", question: "Как поступить?", options: ["Предложить похожий из карты", "Сказать, что такого нет"], correct: 0,
    why: "Гость пришёл за вкусом, а не за названием", real: "Предложили «Апероль шприц»", show_author: true };
  const item = { id: 31, author: "Илья Бармен", sit: SIT };
  it("у «стола» разбор — только «почему так», а «как было у нас» и автор — отдельно (с точкой в конце)", () => {
    expect(caseWhy(item)).toBe("Гость пришёл за вкусом, а не за названием.");
    const [s] = casesToSits([item]);
    expect(s.win).toBe("Гость пришёл за вкусом, а не за названием.");
    expect(s.fail).toBe(s.win);
    expect(s._real).toBe("Предложили «Апероль шприц».");
    expect(s._author).toBe("Илья Бармен");
    // без разбора (старые данные) — как раньше: абзац целиком, плашки нет (история не повторяется дважды)
    const [s2] = casesToSits([{ id: 32, author: "Илья Бармен", sit: { ...SIT, why: "" } }]);
    expect(s2.win).toBe("Как было у нас: Предложили «Апероль шприц». Случай рассказал(а) Илья Бармен.");
    expect([s2._real, s2._author]).toEqual(["", ""]);
    expect(caseNote(item)).toBe("Гость пришёл за вкусом, а не за названием. Как было у нас: Предложили «Апероль шприц». Случай рассказал(а) Илья Бармен.");
  });
  it("в «Работе над ошибками» история не теряется: «Как было у нас: …» в конце разбора", () => {
    const [s] = casesToSits([item]);
    const m = mistakeFromSituation(s, { id: "case-31", title: "Случаи из нашего зала" });
    expect(m.explanation).toBe("Гость пришёл за вкусом, а не за названием. Как было у нас: Предложили «Апероль шприц».");
    expect(mistakeFromSituation({ ...s, _real: "Пересадили к окну" }, null).explanation).toBe("Гость пришёл за вкусом, а не за названием. Как было у нас: Пересадили к окну.");
    // обычная практика — без изменений
    expect(mistakeFromSituation({ options: ["а", "б"], correct: 1, win: "Так лучше.", scene: "Сцена" }, null).explanation).toBe("Так лучше.");
  });
  it("«стол»: плашка на записке после ответа (в практике и в проверке), стили плашки и подпись рукописным", () => {
    const src = rd("ui/table.jsx"), css = rd("ui/table-css-lesson.js");
    expect(src).toContain('<div className="tb-real" data-case-real="">');
    expect(src).toContain('{sit._real ? <><span className="rh">Как было у нас</span><p>{stripEm(sit._real)}</p></> : null}');
    expect(src).toContain('{sit._author ? <span className="by">рассказал(а) {sit._author}</span> : null}');
    expect(src.split("<RealPlaque sit={sit} />").length - 1).toBe(2);
    expect(css).toContain(".tb-note .tb-real{");
    expect(css).toContain(".tb-note .tb-real .by{display:block;font-family:var(--font-hand)");
  });
  it("брифинг: в блоке «Случай из зала» после «Показать ответ» — та же плашка; до ответа — только кто рассказал", async () => {
    const src = rd("ui/briefing.jsx");
    expect(src).toContain('<div data-brief-real=""');
    expect(src).toContain("{b.real ? <RealPlaque real={b.real} author={b.author} c={c} small={small} /> : null}");
    expect(src).toContain("{b.author && !(reveal && b.real) ? <div");
    expect(src).toContain('import { ensureTableCss } from "./table-css";');
    const { BriefView } = await import("../ui/briefing.jsx");
    const { buildBrief } = await import("../lib/briefing.js");
    const data = buildBrief({ caseTop: item, note: "x", now: new Date(2026, 9, 26) });
    const html = R(h(BriefView, { a11y: false, brief: { data, author: "Мария" }, onClose: () => {} }));
    expect(html).toContain("Рассказал(а) Илья Бармен");
    expect(html).not.toContain("data-brief-real");
  });
});

describe("v87: страница гостя — кремово-золотая, сердце рисуется линией", () => {
  it("цвета бумаги: текст читается (не меньше 4,5:1), кнопка — тёмным по золоту", async () => {
    const { GUEST_PAPER } = await import("../ui/guest-thanks.jsx");
    for (const bg of ["#FFFCF5", "#FBF4E4"]) {
      expect(contrast(GUEST_PAPER.ink, bg)).toBeGreaterThan(12);
      expect(contrast(GUEST_PAPER.sub, bg)).toBeGreaterThan(5.5);
      expect(contrast(GUEST_PAPER.gold, bg)).toBeGreaterThan(5.5);
    }
    expect(contrast("#1F1608", "#C29545")).toBeGreaterThan(4.5);
    expect(contrast("#1F1608", "#DDBA6C")).toBeGreaterThan(4.5);
  });
  it("до ответа сервера — «Минуту…» на бумаге; стили: рамка карточки, сердце, анимация и её выключение", async () => {
    const { GuestThanksPage } = await import("../ui/guest-thanks.jsx");
    const html = R(h(GuestThanksPage, { code: "8457ea0e0b" }));
    expect(html).toContain("Минуту…");
    expect(html).toContain('class="gt-card"');
    expect(html).toContain("@media (prefers-reduced-motion: reduce)");
    expect(html).toContain(".gt-draw,.gt-draw2{animation:none;stroke-dashoffset:0}");
    expect(html).toContain("font-size:16px");   // поле ввода: iPhone не увеличивает страницу
    const src = rd("ui/guest-thanks.jsx");
    expect(src).toContain('<path className="gt-draw" d={HEART} pathLength="1"');
    expect(src).toContain("const HEART = HEART_PATH;");
    expect(src).toContain('animationDelay: Math.max(0, 1500 - (Date.now() - doneAt.current)) + "ms"');
    expect(src).toContain('document.documentElement.style.colorScheme = "light"');
    expect(HEART_PATH).toMatch(/^M66 100C/);
  });
  it("тёмной вспышки нет: заставка светлая по ссылке ?thanks=, фон страницы — кремовый", () => {
    expect(rd("index.html")).toContain('try{if(/[?&]thanks=/.test(location.search))document.getElementById("sa-splash").className="light"}catch(e){}');
    expect(code(rd("main.jsx"))).toContain('document.body.style.background = "#F4EAD5";');
  });
});

// ── картинки для печати: canvas-заглушка записывает, что и где нарисовано ──
function fakeCanvas() {
  const calls = [];
  const ctx = {
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "10px serif", textAlign: "start", textBaseline: "alphabetic", globalAlpha: 1, shadowColor: "", shadowBlur: 0, shadowOffsetY: 0, lineJoin: "", lineCap: "",
    _rot: 0, _stack: [],
    measureText(t) { const px = Number((/(\d+)px/.exec(this.font) || [0, 10])[1]); return { width: String(t).length * px * 0.52 }; },
    fillText(t, x, y) { calls.push({ op: "text", t, x, y, font: this.font, color: this.fillStyle, rot: this._rot }); },
    fillRect(x, y, w, hh) { calls.push({ op: "rect", x, y, w, h: hh, color: this.fillStyle, rot: this._rot }); },
    strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {}, fill() {}, stroke() {},
    save() { this._stack.push(this._rot); }, restore() { this._rot = this._stack.length ? this._stack.pop() : 0; },
    translate() {}, scale() {}, rotate(a) { this._rot = a; calls.push({ op: "rotate", a }); },
    setLineDash(d) { calls.push({ op: "dash", d }); },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  return { width: 0, height: 0, getContext: () => ctx, calls };
}

describe("v87: картинки для печати", () => {
  const D = { url: "https://service-academy.vercel.app/?thanks=8457ea0e0b", name: "Анна", pos: "Официант", restaurant: "Два моря, Океан" };
  const dark = qrMatrix(D.url, { ecl: "M" }).modules.flat().filter(Boolean).length;
  it("четыре вида, в этом порядке; размеры и имена файлов", async () => {
    const { PRINT_LAYOUTS, PRINT_ORDER } = await import("../ui/thanks-print.js");
    expect(PRINT_ORDER).toEqual(["card", "tent", "insert", "sticker"]);
    expect(PRINT_ORDER.map((k) => [PRINT_LAYOUTS[k].w, PRINT_LAYOUTS[k].h, PRINT_LAYOUTS[k].file])).toEqual([
      [1080, 1440, "spasibo-kartochka.png"], [1240, 1754, "spasibo-domik-a4.png"], [1000, 2000, "spasibo-vkladysh.png"], [1000, 1000, "spasibo-nakleyka.png"]]);
    expect(PRINT_LAYOUTS.tent.done).toBe("Сохранено. Распечатай на A4 без полей, согни по пунктиру и поставь на стол: код виден с двух сторон.");
  });
  it("каждый вид: размер холста, QR целиком (все тёмные модули, модуль — целые пиксели), слова на месте", async () => {
    const { drawThanksPrint, PRINT_LAYOUTS } = await import("../ui/thanks-print.js");
    for (const k of ["card", "tent", "insert", "sticker"]) {
      const cv = fakeCanvas();
      drawThanksPrint(cv, k, D);
      expect([cv.width, cv.height], k).toEqual([PRINT_LAYOUTS[k].w, PRINT_LAYOUTS[k].h]);
      const mods = cv.calls.filter((c) => c.op === "rect" && c.color === "#22170A");
      expect(mods.length, k).toBe(dark * (k === "tent" ? 2 : 1));
      expect(mods.every((m) => Number.isInteger(m.w) && m.w === m.h && m.w >= 13), k).toBe(true);
      const words = cv.calls.filter((c) => c.op === "text").map((c) => c.t);
      expect(words, k).toContain(k === "insert" ? "Скажите спасибо лично" : "Скажите спасибо");
      expect(words, k).toContain("Анна");
      expect(words, k).toContain("Официант");
    }
  });
  it("домик: верх перевёрнут (код и слова с двух сторон стола), по пунктиру — сгиб", async () => {
    const { drawThanksPrint } = await import("../ui/thanks-print.js");
    const cv = fakeCanvas();
    drawThanksPrint(cv, "tent", D);
    expect(cv.calls.filter((c) => c.op === "rotate").map((c) => c.a)).toEqual([Math.PI]);
    const t = cv.calls.filter((c) => c.op === "text" && c.t === "Скажите спасибо");
    expect(t.map((c) => c.rot)).toEqual([Math.PI, 0]);
    expect(cv.calls.some((c) => c.op === "dash" && c.d.join() === "16,12")).toBe(true);
  });
  it("вкладыш в папку для счёта — свои слова; наклейка — пунктир для ножниц и без заведения", async () => {
    const { drawThanksPrint } = await import("../ui/thanks-print.js");
    const a = fakeCanvas(); drawThanksPrint(a, "insert", D);
    const w = a.calls.filter((c) => c.op === "text").map((c) => c.t);
    expect(w).toEqual(expect.arrayContaining(["Два моря, Океан", "Понравилось, как вас", "обслужили?", "Скажите спасибо лично", "Наведите камеру телефона на код", "Будем рады видеть вас снова"]));
    const s = fakeCanvas(); drawThanksPrint(s, "sticker", D);
    expect(s.calls.filter((c) => c.op === "text").map((c) => c.t)).toEqual(["Скажите спасибо", "Анна", "Официант"]);
    expect(s.calls.some((c) => c.op === "dash" && c.d.join() === "14,10")).toBe(true);
  });
  it("длинное имя: в карточке — мельче в одну строку, в узкой колонке домика и во вкладыше — в две строки", async () => {
    const { drawThanksPrint } = await import("../ui/thanks-print.js");
    const L = { ...D, name: "Александра Константинопольская" };
    const card = fakeCanvas(); drawThanksPrint(card, "card", L);
    const n = card.calls.find((c) => c.op === "text" && c.t === L.name);
    const px = Number(/(\d+)px/.exec(n.font)[1]);
    expect(px).toBeLessThan(72);
    expect(L.name.length * px * 0.52).toBeLessThanOrEqual(900);
    for (const k of ["tent", "insert"]) {
      const cv = fakeCanvas(); drawThanksPrint(cv, k, L);
      const t = cv.calls.filter((c) => c.op === "text" && c.rot === 0).map((c) => c.t);
      expect(t, k).toContain("Александра");
      expect(t, k).toContain("Константинопольская");
      expect(t, k).not.toContain(L.name);
      // строки ниже имени сдвинулись: должность — под второй строкой
      const rows = cv.calls.filter((c) => c.op === "text" && c.rot === 0);
      const y2 = rows.find((c) => c.t === "Константинопольская").y, yp = rows.find((c) => c.t === "Официант").y;
      expect(yp, k).toBeGreaterThan(y2);
    }
  });
  it("экран: «Картинка для печати» открывает выбор вида с предпросмотром, сохраняет — «Сохранить картинку»", () => {
    const src = rd("ui/thanks.jsx");
    expect(src).toContain('<div data-thanks-layouts={kind}');
    expect(src).toContain('role="radiogroup" aria-label="Вид картинки для печати"');
    expect(src).toContain('<button key={k} type="button" role="radio" aria-checked={on} data-thanks-layout={k}');
    expect(src).toContain('data-thanks-save="" onClick={save} disabled={!prev}');
    expect(src).toContain("printFontsReady().then(() => {");
    expect(src).toContain('{print ? <LayoutPicker c={c} a11y={a11y} url={url} name={st.name} pos={pos} restaurant={st.restaurant} onMsg={setMsg} /> : null}');
    expect(src).toContain("export const drawThanksCard = (canvas, d) => drawThanksPrint(canvas, \"card\", d);");
  });
});

describe("v87: «Смена» под роль", () => {
  const PLAN = { v: 1, tables: [{ id: "t1", n: "1", seats: 4, x: 0, y: 0 }, { id: "t2", n: "2", seats: 4, x: 2, y: 0 }, { id: "t5", n: "5", seats: 6, shape: "long", x: 2, y: 2 },
    { id: "t3", n: "3", seats: 2, x: 4, y: 0 }, { id: "t7", n: "7", seats: 4, x: 6, y: 0 }, { id: "t8", n: "8", seats: 4, x: 0, y: 4 }] };
  const NOW = "2026-10-26T08:00:00Z";
  const ago = (m) => new Date(Date.parse(NOW) - m * 60000).toISOString();
  const ROWS = [
    { tid: "t1", status: "seat", cnt: 3, since: ago(25), waiter_id: "e-anna" },
    { tid: "t5", status: "bill", cnt: 2, since: ago(65), waiter_id: "e-anna" },
    { tid: "t2", status: "seat", cnt: 4, since: ago(10), waiter_id: "e-petr" },
    { tid: "t3", status: "clean" },
    { tid: "t7", status: "res", cnt: 4, rtime: "19:30", name: "Иванов" },
    { tid: "t8", status: "res", cnt: 2, rtime: "12:00", name: "" },
  ];
  const BOARD = { ok: true, now: NOW, plan: PLAN, tables: ROWS };
  it("роль: руководитель и старший, хостес, остальные", () => {
    expect([shiftRoleOf({ position: "manager" }), shiftRoleOf({ position: "senior" }), shiftRoleOf({ is_admin: true, position: "waiter" }),
      shiftRoleOf({ position: "hostess" }), shiftRoleOf({ position: "waiter" }), shiftRoleOf({ position: "bartender" }), shiftRoleOf(null)]).toEqual(["lead", "lead", "lead", "host", "staff", "staff", "staff"]);
  });
  it("зал: свободно, гости, счёт, уборка, брони; строка руководителю", () => {
    const hall = hallOf(BOARD);
    expect(hall).toEqual({ total: 6, free: 0, seat: 2, bill: 1, clean: 1, res: 2, guests: 9 });
    expect(hallHead(hall)).toBe("Свободно 0 из 6");
    expect(hallParts(hall).map((p) => p.k + p.n).join()).toBe("seat2,bill1,clean1,res2");
    expect(hallLine(hall)).toBe("Зал: свободно 0 из 6 · 9 гостей · счёт: 1");
    expect(hallOf({ ok: true, plan: { v: 1, tables: [] }, tables: [] })).toBe(null);
    expect(hallOf({ ok: false })).toBe(null);
  });
  it("ближайшая бронь: не раньше, чем 15 минут назад; без времени — после всех", () => {
    const at = (hh, mm) => new Date(2026, 9, 26, hh, mm);
    expect(resLine(nextRes(BOARD, at(11, 0)))).toBe("12:00 · Без имени · 2 гостя · стол 8");
    expect(resLine(nextRes(BOARD, at(12, 10)))).toBe("12:00 · Без имени · 2 гостя · стол 8");
    expect(resLine(nextRes(BOARD, at(12, 20)))).toBe("19:30 · Иванов · 4 гостя · стол 7");
    expect(nextRes(BOARD, at(20, 0))).toBe(null);
    expect(resLine(nextRes({ ...BOARD, tables: [{ tid: "t7", status: "res", cnt: 0, name: "Банкет" }] }, at(20, 0)))).toBe("Банкет · стол 7");
  });
  it("столы официанта: по номеру, гости или счёт и сколько сидят", () => {
    const mine = myTablesList(BOARD, "e-anna");
    expect(mine.map((t) => t.n + ":" + tableChip(t))).toEqual(["1:3 гостя · 25 мин", "5:счёт · 1 ч 05 мин"]);
    expect(myTablesList(BOARD, "e-ilya")).toEqual([]);
    expect(myTablesList(BOARD, "")).toEqual([]);
  });
  it("что показать: руководителю — брифинг не отправлен (кроме выходного) и зал; хостес — зал; официанту — только свои столы", () => {
    const L = (o) => roleCard({ role: "lead", board: BOARD, briefKnown: true, briefSent: false, ...o });
    expect(L({}).brief).toBe("none");
    expect(L({ briefSent: true }).brief).toBe("");
    expect(L({ dayOff: true }).brief).toBe("");
    expect(L({ briefKnown: false }).brief).toBe("");   // сервер ещё не ответил или нет этапа 32
    expect(L({ briefSent: true, board: null })).toBe(null);
    expect(L({ board: null })).toEqual({ role: "lead", brief: "none", hall: null });
    expect(roleCard({ role: "host", board: BOARD, now: new Date(2026, 9, 26, 13, 0) }).res.name).toBe("Иванов");
    expect(roleCard({ role: "host", board: null })).toBe(null);
    expect(roleCard({ role: "staff", board: BOARD, empId: "e-anna" }).mine.length).toBe(2);
    expect(roleCard({ role: "staff", board: BOARD, empId: "e-ilya" })).toBe(null);
  });
  it("карточка: хостес — полоса и легенда цветами схемы и бронь; руководитель — «Собрать»; официант — кружки столов", async () => {
    const { ShiftRoleCard } = await import("../ui/shift-role.jsx");
    const host = R(h(ShiftRoleCard, { a11y: false, card: roleCard({ role: "host", board: BOARD, now: new Date(2026, 9, 26, 13, 0) }) }));
    expect(host).toContain('data-shift-role="host"');
    expect(host).toMatch(/Зал сейчас.*Свободно 0 из 6.* · 9 гостей/);
    expect(host).toContain('data-part="bill"');
    expect(host).toMatch(/Ближайшая бронь:<\/span> 19:30 · Иванов · 4 гостя · стол 7/);
    const lead = R(h(ShiftRoleCard, { a11y: true, card: roleCard({ role: "lead", board: BOARD, briefKnown: true }) }));
    expect(lead).toMatch(/Руководителю смены.*Брифинг на сегодня ещё не отправлен.*Собрать.*Зал: свободно 0 из 6 · 9 гостей · счёт: 1/);
    const staff = R(h(ShiftRoleCard, { a11y: false, card: roleCard({ role: "staff", board: BOARD, empId: "e-anna" }) }));
    expect(staff).toMatch(/Твои столы.*data-my-table="1" data-status="seat".*3 гостя · 25 мин.*data-my-table="5" data-status="bill".*счёт · 1 ч 05 мин/);
    expect(R(h(ShiftRoleCard, { a11y: false, card: null }))).toBe("");
  });
  it("в «Смене»: под сменой дня, по той же доске, что спрашивается раз в минуту; брифинг «известен» после ответа сервера", () => {
    const app = rd("App.jsx");
    expect(app).toContain('<ShiftRoleCard a11y={a11y} card={shiftRole} onSeat={() => navigate("seat")} onBrief={() => navigate("brief")} />');
    expect(app.indexOf("<ShiftRoleCard")).toBeGreaterThan(app.indexOf('hero={<><ShiftHero'));
    expect(app).toContain("if (r && r.ok) setSeatBoard(r);");
    expect(app).toContain("setTeamBrief(b); setBriefKnown(true);");
    expect(app).toContain("board: seatOn ? seatBoard : null");
  });
});

describe("v87: тексты", () => {
  it("новые файлы — без эмодзи и без «слово — слово» в строках интерфейса", () => {
    for (const f of ["ui/line-art.jsx", "ui/thanks-print.js", "ui/shift-role.jsx", "lib/shift-role.js", "ui/guest-thanks.jsx", "ui/thanks.jsx"]) {
      const s = code(rd(f));
      expect(s, f).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s.match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g), f).toBe(null);
    }
  });
  it("справка: печать видами, «Смена» под роль, плашка «Как было у нас», брифинг наверху «Смены»", () => {
    const g = rd("ui/guide.jsx");
    expect(g).toContain("«Картинка для печати» предлагает карточку на стойку, домик на стол (лист A4, код с двух сторон), вкладыш в папку для счёта и наклейку, с предпросмотром.");
    expect(g).toContain("Официант видит свои столы наверху «Смены» (номер, сколько гостей и сколько сидят, у кого счёт), хостес там же видит зал сейчас и ближайшую бронь.");
    expect(g).toContain("после ответа видит плашку «Как было у нас» с подписью рассказчика.");
    expect(g).toContain("Пока брифинг на сегодня не отправлен, руководитель видит это наверху «Смены».");
  });
});

describe("v87: «Кто сегодня» в брифинге — по тем же правилам, что таблица графика", () => {
  // Сообщение из зала: «в брифинге вторая хостес, хотя в графике одна». ✕ у сотрудника закрывает его прошлым месяцем
  // (till), а его смены этого месяца остаются в плане: таблица его не показывает, а брифинг показывал.
  const staff = [
    { id: 1, name: "Токарева Ангелина", pos: "host" },
    { id: 2, name: "Дутова Анна", pos: "host", till: "2026-09" },         // удалена в октябре: закрыта сентябрём
    { id: 3, name: "Новикова Ольга", pos: "host", since: "2026-11" },     // заведена заранее, с ноября
    { id: 4, name: "Блеклов Дмитрий", pos: "bar", till: "2026-10" },      // последний месяц — октябрь: ещё в графике
    { id: 5, name: "Лучко Екатерина", pos: "manager", since: "2026-10" }, // первый месяц — октябрь: уже в графике
  ];
  const sched = { ok: true, venues: [{ venue_key: "main", config: { staff, shifts: [{ k: "Д", name: "День", from: 11, to: 24 }] } }],
    months: [{ venue_key: "main", payload: { plan: { 1: { 25: "Д", 26: "Д" }, 2: { 25: "Д", 26: "Д" }, 3: { 26: "Д" }, 4: { 26: "Д" }, 5: { 26: "Д" } } } }] };
  it("удалённая из графика и ещё не принятая со сменами в плане — не в «Кто сегодня»; последний и первый месяц — в нём", async () => {
    const { briefRoster } = await import("../lib/briefing.js");
    const r = briefRoster(sched, new Date(2026, 9, 26, 10));
    expect(r).toEqual([{ k: "Д", name: "День", from: 11, to: 24, people: ["Лучко Екатерина", "Токарева Ангелина", "Блеклов Дмитрий"],
      groups: [{ t: "Менеджер", names: ["Лучко Екатерина"] }, { t: "Хостес", names: ["Токарева Ангелина"] }, { t: "Бар", names: ["Блеклов Дмитрий"] }] }]);
    // в ноябре: Блеклов уже не в графике, Новикова — уже в нём
    const nov = { ...sched, months: [{ venue_key: "main", payload: { plan: { 3: { 2: "Д" }, 4: { 2: "Д" } } } }] };
    expect(briefRoster(nov, new Date(2026, 10, 2, 10))[0].people).toEqual(["Новикова Ольга"]);
  });
  it("правило одно на всех: таблица графика, генератор и брифинг", async () => {
    const { inMonth } = await import("../lib/schedule-sync.js");
    expect([1, 2, 3, 4, 5].map((id) => inMonth(staff.find((s) => s.id === id), "2026-10"))).toEqual([true, false, false, true, true]);
    expect(inMonth(null, "2026-10")).toBe(false);
    expect(rd("ui/schedule.jsx")).toContain("const staff = staffAll.filter(q => (!q.till || mkey <= q.till) && (!q.since || mkey >= q.since));");
    expect(rd("lib/schedule-gen.js")).toContain("const staff = (cfg.staff || []).filter(q => (!q.till || mkey <= q.till) && (!q.since || mkey >= q.since));");
    expect(rd("lib/briefing.js")).toContain("const staff = (Array.isArray(cfg.staff) ? cfg.staff : []).filter((s) => inMonth(s, mkey));");
  });
});

describe("v87: метка и журнал", () => {
  it("«сборка v87», «Дополнение 400»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(8[7-9]|9\d|\d{3,})<\/span>/);   // v87 и дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 400 — красивее: рисунки золотой линией, «Как было у нас» плашкой, страница гостя, печать QR, «Смена» под роль (v87)");
  });
});
