// v138 (Доп. 453): приложение с экрана «Домой» на iPhone снова в прежнем окне. Владелец (05.11, запись экрана v137):
// «Навбар почему-то вверх уехал, и в чате теперь вверх мутный», «Это в веб версии. В телеге все норм», «Плейс так же
// взлетел. Хотя его на пару пикселей нужно было поднять, чтобы он не выглядел обрезанным».
// index.html (без viewport-fit=cover), lib/tg-screen.js (как в v136), ui/css.js (без отступа у body и под панелью вкладок),
// ui/viewport.js (homeBarPx: вырез снизу 20 px на iPhone с полоской «Домой»); вид — tools/claude/e2e-v138.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { homeBarPx, HOME_BAR } from "../ui/viewport.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;

const root = (pwa) => ({ classList: { contains: (c) => pwa && c === "sa-pwa" } });
const IPH = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" };
const IPAD = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15" };
const IPAD_OLD = { userAgent: "Mozilla/5.0 (iPad; CPU OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" };
const ANDROID = { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36" };

describe("v138 (Доп. 453): homeBarPx — вырез под полоской «Домой» берём сами", () => {
  it("20 px, как сообщает Telegram на том же телефоне (строка ввода там на 28 px от низа)", () => {
    expect(HOME_BAR).toBe(20);
  });
  it("экран «Домой», iPhone с полоской: 16 Pro Max, 16 Pro, 13 mini; лёжа тоже (screen у iPhone не поворачивается, но и так, и так)", () => {
    for (const s of [{ width: 440, height: 956 }, { width: 402, height: 874 }, { width: 375, height: 812 }, { width: 956, height: 440 }, { width: 390, height: 844 }]) {
      expect([s, homeBarPx(IPH, s, root(true))]).toEqual([s, 20]);
    }
  });
  it("iPhone с кнопкой «Домой» (SE, 8 Plus, SE в увеличенном виде) — 0, как было", () => {
    for (const s of [{ width: 375, height: 667 }, { width: 414, height: 736 }, { width: 320, height: 568 }]) expect([s, homeBarPx(IPH, s, root(true))]).toEqual([s, 0]);
  });
  it("не экран «Домой» (Safari, Telegram) — 0: там вырез сообщает Telegram, а Safari держит низ сам", () => {
    expect(homeBarPx(IPH, { width: 440, height: 956 }, root(false))).toBe(0);
  });
  it("iPad (называет себя Mac или iPad) и Android — 0, как было", () => {
    for (const n of [IPAD, IPAD_OLD, ANDROID]) expect(homeBarPx(n, { width: 820, height: 1180 }, root(true))).toBe(0);
  });
  it("заглушки без classList.contains, пустой screen, ошибки — 0, без исключений", () => {
    expect(homeBarPx(IPH, { width: 440, height: 956 }, { classList: {} })).toBe(0);
    expect(homeBarPx(IPH, {}, root(true))).toBe(0);
    expect(homeBarPx(IPH, null, root(true))).toBe(0);   // screen в тестах нет
    expect(homeBarPx({ get userAgent() { throw new Error("x"); } }, { width: 440, height: 956 }, root(true))).toBe(0);
    expect(typeof homeBarPx()).toBe("number");
  });
});

describe("v138 (Доп. 453): safeInsets — вырез снизу: больший из env(), Telegram и полоски «Домой»", () => {
  const vp = rd("ui/viewport.js");
  it("homeBarPx — до запоминания наибольшего (keepSafeBottom), после замеров env() и Telegram", () => {
    const a = vp.indexOf("const r = { t: Math.max(e.t, g.t)"), b = vp.indexOf("r.b = Math.max(r.b, homeBarPx());"), c = vp.indexOf("r.b = keepSafeBottom(");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
  it("App кладёт его в --sa-sb, а его берут строка ввода чата, список, листы и подписи фото", () => {
    expect(rd("App.jsx")).toContain('el.style.setProperty("--sa-sb", vp.safe.b + "px");');
    const chat = rd("ui/chat.jsx");
    expect(chat).toContain(".ch-bar{flex:0 0 auto;position:relative;z-index:3;padding:8px 8px calc(8px + var(--sa-sb,env(safe-area-inset-bottom,0px)) * var(--kbs,1));");
    expect((chat.match(/var\(--sa-sb,env\(safe-area-inset-bottom,0px\)\)/g) || []).length).toBeGreaterThanOrEqual(7);
  });
  it("панель вкладок считает от env(): на экране «Домой» — на прежнем месте, 16 px от низа", () => {
    expect(rd("ui/tabbar.jsx")).toContain('bottom:"calc(max(env(safe-area-inset-bottom, 0px), 8px) + 8px)"');
    expect(rd("ui/css.js")).not.toContain("html.sa-pwa.sa-navon");
  });
});

describe("v138 (Доп. 453): окно как было", () => {
  it("index.html: только класс sa-pwa, viewport-fit=cover больше нет (и в комментарии объяснено почему)", () => {
    const html = rd("index.html");
    expect(html).toContain('try { if (navigator.standalone === true) document.documentElement.classList.add("sa-pwa"); } catch (e) {}');
    expect(html.replace(/<!--[\s\S]*?-->/g, "")).not.toMatch(/viewport-fit/);
    expect(html).toContain("v138 (Доп. 453)");
  });
  it("lib/tg-screen.js — как в v136: только Telegram", () => {
    const src = code(rd("lib/tg-screen.js"));
    expect(src).not.toContain("sa-pwa");
    expect(src).not.toContain("envTopPx");
    expect(src).toContain("export function startTgScreen(tg, root) {");
  });
  it("ui/css.js: у body на экране «Домой» отступа нет; верхняя строка — ниже размытия iOS 26 (36 px стоя)", () => {
    const css = rd("ui/css.js");
    expect(css).not.toContain("html.sa-pwa body");
    expect(css).toContain("@media (orientation: portrait) { html.sa-pwa { --sa-pwab: 36px; } }");
    expect(css).toContain("html.sa-pwa [data-sa-topbar] { padding-top: calc(8px + var(--sa-pwab, 0px)) !important; }");
  });
});

describe("v138 (Доп. 453): проверки и записи", () => {
  it("e2e-v138: HOME, MINI, SE, LAND, SAFARI, TG, IPAD; окно 440 × 894 при экране 440 × 956", () => {
    const e = rd("tools/claude/e2e-v138.mjs");
    for (const s of ["HOME", "MINI", "SE", "LAND", "SAFARI", "TG", "IPAD"]) expect([s, e.includes(`await run("${s}", async () => {`)]).toEqual([s, true]);
    expect(e).toContain("w: 440, h: 894, scr: { width: 440, height: 956 }");
    expect(e).toContain("c.input.b === 866");
    expect(e).not.toContain("setSafeAreaInsetsOverride");   // env() — 0, как у iPhone без cover
  });
  it("CHANGES: Дополнение 453; README проверок — e2e-v138; тексты без тире-ритма и эмодзи", () => {
    expect(rd("CHANGES.md")).toContain("# Дополнение 453");
    expect(rd("tools/claude/README.md")).toContain("`e2e-v138.mjs`");
    for (const f of ["ui/viewport.js", "lib/tg-screen.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(/\p{Extended_Pictographic}/u.test(code(rd(f))), f).toBe(false);
    }
  });
});
