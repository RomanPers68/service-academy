// v137 (Доп. 452): приложение с экрана «Домой» на iPhone. Владелец (05.11, снимки): «Плейс и всё, что с ним связано,
// обрезается нижней частью экрана» (строка «Сообщение» с колокольчиком и микрофоном — под скруглением и полоской «Домой»)
// и «выделенная часть становится мутнее» («SA», лупа и «Для чтения» — в размытии iOS 26 под часами).
// v138 (Доп. 453): viewport-fit=cover из v137 убран (iOS 26 с ним держит окно на 62 точки короче экрана: панель вкладок
// и строка ввода висели над краем, шапку переписки размывало — запись владельца 05.11), --sa-st на экране «Домой» больше
// не ставится. Остались: класс sa-pwa (index.html), верхняя строка ниже размытия (ui/css.js), «лазейка» под ней
// (ui/loophole.jsx). Вырез под полоской «Домой» — ui/viewport.js (homeBarPx), проверки — tests/v138.test.js;
// вид в браузере — tools/claude/e2e-v138.mjs, раздел HOME.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { startTgScreen } from "../lib/tg-screen.js";

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

// скрипт из index.html — в заглушке страницы: что он делает с <html> и viewport
const headScript = () => {
  const html = rd("index.html");
  const at = html.indexOf("if (navigator.standalone === true)");
  const from = html.lastIndexOf("(function () {", at), to = html.indexOf("})();", at) + 5;
  return html.slice(from, to);
};
const VP = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
const runHead = (standalone) => {
  const cls = new Set(), meta = { c: VP, getAttribute: () => meta.c, setAttribute: (k, v) => { if (k === "content") meta.c = v; } };
  const document = { documentElement: { classList: { add: (c) => cls.add(c) } }, querySelector: (q) => (q === 'meta[name="viewport"]' ? meta : null) };
  const navigator = standalone === undefined ? {} : { standalone };
  new Function("navigator", "document", headScript())(navigator, document);
  return { cls, content: meta.c };
};

describe("v137 (Доп. 452), v138: index.html — экран «Домой» на iPhone узнаём сразу, до первого кадра", () => {
  it("navigator.standalone: класс sa-pwa; viewport прежний, без viewport-fit=cover (v138)", () => {
    const r = runHead(true);
    expect([...r.cls]).toEqual(["sa-pwa"]);
    expect(r.content).toBe(VP);
    expect(rd("index.html").replace(/<!--[\s\S]*?-->/g, "")).not.toMatch(/viewport-fit/);
  });
  it("Safari, Telegram, Android (standalone нет или false) — ничего не меняется", () => {
    for (const s of [undefined, false]) {
      const r = runHead(s);
      expect(r.cls.size).toBe(0);
      expect(r.content).toBe(VP);
    }
  });
  it("порядок: после meta viewport, до скрипта Telegram; сам viewport в разметке — прежний", () => {
    const html = rd("index.html"), at = html.indexOf("if (navigator.standalone === true)");
    expect(at).toBeGreaterThan(html.indexOf('<meta name="viewport"'));
    expect(at).toBeLessThan(html.indexOf("telegram-web-app.js"));
    expect(html).toContain(`<meta name="viewport" content="${VP}" />`);
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');   // у установленных iOS помнит стиль с установки
  });
});

describe("v138 (Доп. 453): lib/tg-screen.js — снова только Telegram, как в v136", () => {
  it("без Telegram ничего не делает, и на экране «Домой» тоже (--sa-st не ставится)", () => {
    const r = fakeRoot(true);
    const stop = startTgScreen(null, r);
    expect(typeof stop).toBe("function");
    expect(r.vars["--sa-st"]).toBeUndefined();
    expect(r.cls.has("sa-tgfs")).toBe(false);
    const src = code(rd("lib/tg-screen.js"));
    for (const s of ["sa-pwa", "envTop", "safe-area-inset-top", "addEventListener"]) expect([s, src.includes(s)]).toEqual([s, false]);
    expect(src).toContain("export function startTgScreen(tg, root) {\n  if (!tg) return () => {};");
  });
});

describe("v137 (Доп. 452), v138: ui/css.js — верхняя строка ниже размытия iOS 26, низ как в Telegram", () => {
  const css = rd("ui/css.js");
  it("у body на экране «Домой» отступа нет (v138); правило Telegram — прежнее", () => {
    expect(css).not.toContain("html.sa-pwa body");
    expect(css).toContain("html.sa-tgfs body { padding-top: var(--sa-st, 0px); box-sizing: border-box; }");
  });
  it("отступ под размытие 36 px — только стоя (лёжа часов нет); верхняя строка: 8 px + отступ", () => {
    expect(css).toContain("@media (orientation: portrait) { html.sa-pwa { --sa-pwab: 36px; } }");
    expect(css).toContain("html.sa-pwa [data-sa-topbar] { padding-top: calc(8px + var(--sa-pwab, 0px)) !important; }");
    expect(rd("App.jsx")).toContain('<div style={T.a11yBar} ref={saBarRef} data-sa-topbar="">');   // её высоту App меряет в --sa-top
  });
  it("панель вкладок — на прежнем месте (env(), 16 px от низа), отступ под ней — прежние 88 px (v138)", () => {
    expect(css).not.toContain("html.sa-pwa.sa-navon");
    expect(css).toContain(".sa-tabpad { padding-bottom: 88px; --sa-padb: 88px; }");
    expect(rd("ui/tabbar.jsx")).toContain('bottom:"calc(max(env(safe-area-inset-bottom, 0px), 8px) + 8px)"');
  });
  it("строка ввода чата — над полоской: вырез снизу --sa-sb (ui/viewport.js); всплывашка «лазейки» — под опущенной строкой", () => {
    expect(rd("ui/chat.jsx")).toContain(".ch-bar{flex:0 0 auto;position:relative;z-index:3;padding:8px 8px calc(8px + var(--sa-sb,env(safe-area-inset-bottom,0px)) * var(--kbs,1));");
    expect(rd("ui/viewport.js")).toContain("r.b = Math.max(r.b, homeBarPx());");
    expect(rd("App.jsx")).toContain('el.style.setProperty("--sa-sb", vp.safe.b + "px");');
    expect(rd("ui/loophole.jsx")).toContain('top: "calc(62px + var(--sa-st, env(safe-area-inset-top, 0px)) + var(--sa-pwab, 0px))"');
  });
});

describe("v137 (Доп. 452): проверки и записи", () => {
  it("e2e HOME — в e2e-v138 (v138 поменял вид); в e2e-v137 раздела больше нет", () => {
    expect(rd("tools/claude/e2e-v137.mjs")).not.toContain('await run("HOME", async () => {');
    expect(rd("tools/claude/e2e-v138.mjs")).toContain('await run("HOME", async () => {');
  });
  it("CHANGES: Дополнения 452 и 453; тексты без тире-ритма", () => {
    expect(rd("CHANGES.md")).toContain("Дополнение 452");
    expect(rd("CHANGES.md")).toContain("Дополнение 453");
    for (const f of ["lib/tg-screen.js", "ui/loophole.jsx", "ui/viewport.js"]) expect(dashes(rd(f)), f).toBe(0);
  });
});
