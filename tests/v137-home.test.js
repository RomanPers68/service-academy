// v137 (Доп. 452): приложение с экрана «Домой» на iPhone. Владелец (05.11, снимки): «Плейс и всё, что с ним связано,
// обрезается нижней частью экрана» (строка «Сообщение» с колокольчиком и микрофоном — под скруглением и полоской «Домой»)
// и «выделенная часть становится мутнее» («SA», лупа и «Для чтения» — в размытии iOS 26 под часами).
// index.html (navigator.standalone → класс sa-pwa и viewport-fit=cover), lib/tg-screen.js (--sa-st по вырезу сверху),
// ui/css.js (body под часами, верхняя строка ниже размытия, отступ под панелью вкладок), ui/loophole.jsx;
// вид в браузере с вырезами iPhone — tools/claude/e2e-v137.mjs, раздел HOME.
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { startTgScreen, pwaOn, tgTopInset } from "../lib/tg-screen.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;

// <html>: класс sa-pwa ставит index.html; переменные и классы — как у заглушки в tests/v69.test.js
const fakeRoot = (pwa) => {
  const cls = new Set(pwa ? ["sa-pwa"] : []), vars = {};
  return { cls, vars,
    classList: { toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); }, contains: (c) => cls.has(c), remove: (c) => cls.delete(c) },
    style: { setProperty: (k, v) => { vars[k] = v; }, removeProperty: (k) => { delete vars[k]; } } };
};
// Telegram с полноэкранным режимом (как в tests/v69.test.js)
const fakeTg = () => {
  const ev = {};
  const W = { platform: "ios", version: "9.6", isFullscreen: false, safeAreaInset: { top: 0 }, contentSafeAreaInset: { top: 0 },
    isVersionAtLeast: () => true, onEvent(n, f) { (ev[n] = ev[n] || []).push(f); }, offEvent(n, f) { ev[n] = (ev[n] || []).filter((g) => g !== f); },
    fire(n) { (ev[n] || []).forEach((f) => f.call(W)); }, disableVerticalSwipes() {}, requestFullscreen() {},
    enter() { W.isFullscreen = true; W.safeAreaInset = { top: 62 }; W.contentSafeAreaInset = { top: 46 }; W.fire("fullscreenChanged"); },
    exit() { W.isFullscreen = false; W.safeAreaInset = { top: 0 }; W.contentSafeAreaInset = { top: 0 }; W.fire("fullscreenChanged"); } };
  return W;
};

// скрипт из index.html — в заглушке страницы: что он делает с <html> и viewport
const headScript = () => {
  const html = rd("index.html");
  const at = html.indexOf("if (navigator.standalone !== true) return;");
  const from = html.lastIndexOf("(function () {", at), to = html.indexOf("})();", at) + 5;
  return html.slice(from, to);
};
const runHead = (standalone, content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no") => {
  const cls = new Set(), meta = { c: content, getAttribute: () => meta.c, setAttribute: (k, v) => { if (k === "content") meta.c = v; } };
  const document = { documentElement: { classList: { add: (c) => cls.add(c) } }, querySelector: (q) => (q === 'meta[name="viewport"]' ? meta : null) };
  const navigator = standalone === undefined ? {} : { standalone };
  new Function("navigator", "document", headScript())(navigator, document);
  return { cls, content: meta.c };
};

const realWindow = globalThis.window;
afterEach(() => { globalThis.window = realWindow; });

describe("v137 (Доп. 452): index.html — экран «Домой» на iPhone узнаём сразу, до первого кадра", () => {
  it("navigator.standalone: класс sa-pwa и viewport-fit=cover к прежнему viewport (иначе вырезы экрана — 0)", () => {
    const r = runHead(true);
    expect([...r.cls]).toEqual(["sa-pwa"]);
    expect(r.content).toBe("width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover");
    expect(runHead(true, "width=device-width, viewport-fit=cover").content).toBe("width=device-width, viewport-fit=cover");   // второй раз не дописываем
  });
  it("Safari, Telegram, Android (standalone нет или false) — ничего не меняется", () => {
    for (const s of [undefined, false]) {
      const r = runHead(s);
      expect(r.cls.size).toBe(0);
      expect(r.content).toBe("width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");
    }
  });
  it("порядок: после meta viewport, до скрипта Telegram; сам viewport в разметке — прежний", () => {
    const html = rd("index.html"), at = html.indexOf("if (navigator.standalone !== true) return;");
    expect(at).toBeGreaterThan(html.indexOf('<meta name="viewport"'));
    expect(at).toBeLessThan(html.indexOf("telegram-web-app.js"));
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');   // у установленных iOS помнит стиль с установки
  });
});

describe("v137 (Доп. 452): lib/tg-screen.js — верх под часами, как под кнопками Telegram", () => {
  it("pwaOn: только с классом sa-pwa; заглушка без contains и пусто — нет", () => {
    expect(pwaOn(fakeRoot(true))).toBe(true);
    expect(pwaOn(fakeRoot(false))).toBe(false);
    expect(pwaOn({ classList: { toggle() {} } })).toBe(false);
    expect(pwaOn(null)).toBe(false);
  });
  it("без Telegram (скрипт не загрузился): экран «Домой» — --sa-st = вырез сверху, класса sa-tgfs нет; вне его — ничего", () => {
    const r = fakeRoot(true);
    const stop = startTgScreen(null, r, () => 62);
    expect(r.vars["--sa-st"]).toBe("62px");
    expect(r.cls.has("sa-tgfs")).toBe(false);
    stop();
    const r2 = fakeRoot(false);
    expect(typeof startTgScreen(null, r2, () => 62)).toBe("function");
    expect(r2.vars["--sa-st"]).toBeUndefined();
  });
  it("iOS сама держит полосу под часами (вырез сверху 0) — переменной нет, верх как был", () => {
    const r = fakeRoot(true);
    startTgScreen(null, r, () => 0);
    expect(r.vars["--sa-st"]).toBeUndefined();
  });
  it("Telegram в полноэкранном режиме главнее выреза экрана «Домой» (его кнопки ниже часов); вышел — снова вырез", () => {
    const tg = fakeTg(), r = fakeRoot(true);
    startTgScreen(tg, r, () => 62);
    expect(r.vars["--sa-st"]).toBe("62px");
    tg.enter();
    expect(tgTopInset(tg)).toBe(108);
    expect(r.vars["--sa-st"]).toBe("108px");
    expect(r.cls.has("sa-tgfs")).toBe(true);
    tg.exit();
    expect(r.vars["--sa-st"]).toBe("62px");
    expect(r.cls.has("sa-tgfs")).toBe(false);
  });
  it("поворот: лёжа часов нет — переменная снята (resize и orientationchange); отписка снимает слушателей", () => {
    const L = {};
    globalThis.window = { addEventListener: (n, f) => { (L[n] = L[n] || []).push(f); }, removeEventListener: (n, f) => { L[n] = (L[n] || []).filter((g) => g !== f); } };
    let top = 62;
    const r = fakeRoot(true);
    const stop = startTgScreen(null, r, () => top);
    expect(r.vars["--sa-st"]).toBe("62px");
    expect(L.resize.length).toBe(1);
    expect(L.orientationchange.length).toBe(1);
    top = 0; L.resize[0]();
    expect(r.vars["--sa-st"]).toBeUndefined();
    top = 62; L.orientationchange[0]();
    expect(r.vars["--sa-st"]).toBe("62px");
    stop();
    expect(L.resize.length).toBe(0);
    expect(L.orientationchange.length).toBe(0);
  });
  it("вне экрана «Домой» на resize не подписываемся (Telegram следит своими событиями)", () => {
    const L = [];
    globalThis.window = { addEventListener: (n) => L.push(n), removeEventListener() {} };
    startTgScreen(fakeTg(), fakeRoot(false), () => 62);
    expect(L).toEqual([]);
  });
});

describe("v137 (Доп. 452): ui/css.js — низ над полоской «Домой», верхняя строка ниже размытия iOS 26", () => {
  const css = rd("ui/css.js");
  it("body под часами (--sa-st); правило Telegram — прежнее", () => {
    expect(css).toContain("html.sa-pwa body { padding-top: var(--sa-st, 0px); box-sizing: border-box; }");
    expect(css).toContain("html.sa-tgfs body { padding-top: var(--sa-st, 0px); box-sizing: border-box; }");
  });
  it("отступ под размытие 36 px — только стоя (лёжа часов нет); верхняя строка: 8 px + отступ", () => {
    expect(css).toContain("@media (orientation: portrait) { html.sa-pwa { --sa-pwab: 36px; } }");
    expect(css).toContain("html.sa-pwa [data-sa-topbar] { padding-top: calc(8px + var(--sa-pwab, 0px)) !important; }");
    expect(rd("App.jsx")).toContain('<div style={T.a11yBar} ref={saBarRef} data-sa-topbar="">');   // её высоту App меряет в --sa-top
  });
  it("панель вкладок стоит над полоской «Домой» (env снизу) — отступ под ней на столько же больше; без панели и широкий — как было", () => {
    expect(css).toContain("html.sa-pwa.sa-navon:not(.sa-wide) .sa-tabpad:not(.sa-tabpad-w) { padding-bottom: calc(80px + max(env(safe-area-inset-bottom, 0px), 8px));");
    expect(css).toContain("--sa-padb: calc(80px + max(env(safe-area-inset-bottom, 0px), 8px)); }");
    expect(css).toContain(".sa-tabpad { padding-bottom: 88px; --sa-padb: 88px; }");
    expect(rd("ui/tabbar.jsx")).toContain('bottom:"calc(max(env(safe-area-inset-bottom, 0px), 8px) + 8px)"');
  });
  it("строка ввода чата — над полоской: вырез снизу (--sa-sb из замера env(), ui/viewport.js); всплывашка «лазейки» — под опущенной строкой", () => {
    expect(rd("ui/chat.jsx")).toContain(".ch-bar{flex:0 0 auto;position:relative;z-index:3;padding:8px 8px calc(8px + var(--sa-sb,env(safe-area-inset-bottom,0px)) * var(--kbs,1));");
    expect(rd("ui/viewport.js")).toContain("padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)");
    expect(rd("App.jsx")).toContain('el.style.setProperty("--sa-sb", vp.safe.b + "px");');
    expect(rd("ui/loophole.jsx")).toContain('top: "calc(62px + var(--sa-st, env(safe-area-inset-top, 0px)) + var(--sa-pwab, 0px))"');
  });
});

describe("v137 (Доп. 452): проверки и записи", () => {
  it("e2e HOME: iPhone 402 × 874 с вырезами 62/34 и полосой от iOS 812; Safari и Telegram — как было", () => {
    const e = rd("tools/claude/e2e-v137.mjs");
    expect(e).toContain('await run("HOME", async () => {');
    expect(e).toContain('cdp.send("Emulation.setSafeAreaInsetsOverride"');
    expect(e).toContain('safe: { top: 62, bottom: 34 }');
    expect(e).toContain('safe: { top: 0, bottom: 34 }');
  });
  it("CHANGES: Дополнение 452; тексты без тире-ритма", () => {
    expect(rd("CHANGES.md")).toContain("Дополнение 452");
    for (const f of ["lib/tg-screen.js", "ui/loophole.jsx"]) expect(dashes(rd(f)), f).toBe(0);
  });
});
