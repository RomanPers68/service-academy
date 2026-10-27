// v98 (Доп. 411): клавиатура на iPhone без подскока и без обгона — по записи владельца с v96 (60 кадров в секунду).
// На записи: после нажатия Telegram ~0,1 с ничего не рисует, а строка ввода (ход считался с нажатия) в первом же кадре
// оказывалась почти наверху и ждала клавиатуру; через 0,12 с после сообщения Telegram вырез снизу у приложения
// становился 0 (Telegram, пока клавиатура на экране, сообщает safeAreaInset.bottom = 0) — строка проседала на 16–20 px
// и в конце подпрыгивала на 20 px; при закрытии строка убегала вниз раньше клавиатуры и подскакивала посреди пути.
// Теперь вырез снизу держит ui/viewport.js, ход — с сообщения Telegram (kbOpenAt) и с ухода фокуса (kbCloseAt), а конец
// хода и смену высоты окна страхует доезд (KB_FIX). Вид по кадрам — tools/claude/e2e-v98.mjs (там та же модель Telegram).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");

describe("v98: вырез снизу от клавиатуры не меняется (ui/viewport.js)", () => {
  it("наибольший вырез снизу для положения телефона и режима Telegram: клавиатура (0) его не убирает", async () => {
    const { keepSafeBottom, safeBottomKey } = await import("../ui/viewport.js");
    const mem = {};
    expect(keepSafeBottom("port:full", 21, mem)).toBe(21);
    expect(keepSafeBottom("port:full", 0, mem)).toBe(21);    // клавиатура на экране — Telegram сказал 0
    expect(keepSafeBottom("port:full", 21, mem)).toBe(21);
    expect(keepSafeBottom("land:full", 0, mem)).toBe(0);     // лёжа — свой замер
    expect(keepSafeBottom("land:full", 14, mem)).toBe(14);
    expect(keepSafeBottom("port", "x", mem)).toBe(0);
    expect(mem).toEqual({ "port:full": 21, "land:full": 14, port: 0 });
    expect([safeBottomKey(393, 852, true), safeBottomKey(852, 393, true), safeBottomKey(393, 516, false)]).toEqual(["port:full", "land:full", "port"]);
  });
  it("safeInsets: больший из env() и Telegram (как в v51), потом — наибольший за работу приложения", () => {
    const src = rd("ui/viewport.js");
    expect(src).toContain("const r = { t: Math.max(e.t, g.t), r: Math.max(e.r, g.r), b: Math.max(e.b, g.b), l: Math.max(e.l, g.l) };");
    expect(src).toContain("r.b = keepSafeBottom(safeBottomKey(window.innerWidth, window.innerHeight, !!(tg && tg.isFullscreen)), r.b);");
  });
});

describe("v98: когда и как едет строка ввода (ui/keyboard.js)", () => {
  it("появляется — с сообщения Telegram, на 20 мс раньше, но не раньше фокуса; уходит — с ухода фокуса", async () => {
    const K = await import("../ui/keyboard.js");
    expect([K.KB_LAG_OPEN, K.KB_LAG_CLOSE, K.KB_CATCH, K.KB_CATCH_CLOSE]).toEqual([20, 30, 20, 50]);
    expect(K.kbOpenAt(1100, 1000)).toBe(1080);    // пауза Telegram: сообщение через 0,1 с после фокуса
    expect(K.kbOpenAt(1010, 1000)).toBe(1000);    // сообщение сразу — не раньше фокуса
    expect(K.kbCloseAt(1040, 1000)).toBe(1000);   // окно выросло через 40 мс — клавиатура пошла с фокусом
    expect(K.kbCloseAt(2000, 1000)).toBe(1970);   // фокус давно ушёл (клавиатуру убрала система) — по росту окна
  });
  it("доезд KB_FIX: 0,12 с, только вперёд, мягко к концу; держать ниже раскладки — до 60 px (за клавиатурой — до 160)", async () => {
    const { KB_FIX, KB_HOLD_MAX, KB_HOLD_RUN, kbPath, kbCurve } = await import("../ui/keyboard.js");
    expect([KB_FIX[0], KB_FIX[KB_FIX.length - 1]]).toEqual([[0, 0], [120, 1]]);
    for (let i = 1; i < KB_FIX.length; i++) expect(KB_FIX[i][1] > KB_FIX[i - 1][1]).toBe(true);
    expect(kbCurve(KB_FIX, 16)).toBeLessThanOrEqual(0.3);   // 20 px — не больше 6 px в первом кадре
    expect([KB_HOLD_MAX, KB_HOLD_RUN]).toEqual([60, 160]);
    const p = kbPath(KB_FIX, { y0: 536, y1: 516, k0: 0, s: 0, ys: 536 });
    expect([p[0].y, p[p.length - 1]]).toEqual([536, { t: 120, y: 516 }]);
    for (let i = 1; i < p.length; i++) expect(p[i].y <= p[i - 1].y).toBe(true);
  });
  it("хук: высоты «с прошлого раза» нет; окно сменило высоту — держим и доезжаем; конец хода не совпал — доезд", () => {
    const src = rd("ui/keyboard.js");
    for (const s of [
      'const path = kbPath(pts, { ...ref0, s: t0, catchMs: dir === "down" ? KB_CATCH_CLOSE : KB_CATCH });',
      "const onIn = (e) => { if (textInput(e && e.target)) kOpen = now(); later(); };",
      "const target = kbBottom(p);",
      "const nb = yLay(r, sp), hold = yS - nb;",
      "if (Math.abs(hold) < 0.5 || hold > (rising ? KB_HOLD_RUN : KB_HOLD_MAX)) { yIdle = goal; return; }",
      "} else if (rising) start(\"fix\", nb, { y0: prev.y0, y1: goal, k0: prev.k0, ys: yS }, KB_OPEN, Lg, St, goal);   // дальше за клавиатурой",
      "else start(\"fix\", nb, { y0: yS, y1: goal, k0: tn, ys: yS }, KB_FIX, Lg, St, goal);",
      "const up = rn.dir === \"up\", a0 = up ? anchorTop() : null;",
      "if (a1 != null && Math.abs(a0 - a1) > 1 && Math.abs(a0 - a1) <= KB_HOLD_MAX && animOk() && !calm())",
      "const a = all(\"[data-kbm-at]\").find((x) => { try { return x.getClientRects().length > 0; } catch (e) { return false; } });",
    ]) expect([s, src.includes(s)]).toEqual([s, true]);
    for (const s of ["pred", "predT", "kbRemember", "told", "if (run && resized) { snap(); return; }"]) expect([s, src.includes(s)]).toEqual([s, false]);
  });
  it("по чему сверяем строку на экране (data-kbm-at): строка ввода чата и Наставника, низ «Нового чата» и «Добавить»", () => {
    const chat = rd("ui/chat.jsx"), as = rd("ui/assistant.jsx");
    expect((chat.match(/data-kbm-at=""/g) || []).length).toBe(3);
    expect(chat).toContain('<div className="ch-bar" data-kbm="" data-kbm-at="">');
    expect((as.match(/data-kbm-at=""/g) || []).length).toBe(1);
    expect(as).toContain('<div className="sa-ai-bar" data-kbm="" data-kbm-at="" style=');
  });
});

describe("v98: документы", () => {
  it("README: e2e-v98, e2e-v96 под новое начало хода; CHANGES: Дополнение 411; «сборка v98»", () => {
    const readme = rd("tools/claude/README.md");
    expect(readme).toContain("`e2e-v98.mjs` — v98 (Доп. 411)");
    expect(rd("tools/claude/e2e-v96.mjs")).toContain("// v98 (Доп. 411): строка трогается не с фокуса, а с сообщения Telegram о высоте");
    expect(rd("CHANGES.md")).toContain("# Дополнение 411 — Клавиатура на iPhone: строка ввода без подскока и не обгоняет клавиатуру (v98)");
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(9[8-9]|\d{3,})<\/span>/);
  });
});
