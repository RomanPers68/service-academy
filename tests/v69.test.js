// v69 (Доп. 382): полноэкранный режим Telegram на телефоне, линза светлее, карточка без мерцания.
// Владелец (22.10, записи экрана): шапку Telegram — «в цвет приложения»; «закрепить приложение, чтобы его нельзя
// было смахнуть вниз, добавив кнопку «свернуть»» (пример — другое мини-приложение в полноэкранном режиме);
// про линзу на «Приглашении» — «не кажется, что она слишком тёмная? И обрати внимание на мерцание».
// Вид в браузере (заглушка Telegram с полноэкранным режимом) — tools/claude/e2e-v69.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: () => null, length: 0 };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { tgFullscreenWanted, tgTopInset, startTgScreen, TG_PHONES } from "../lib/tg-screen.js";
import { NowInvitation } from "../ui/now-hero";

const rd = (f) => readFileSync(f, "utf8");
const noop = () => {};
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const T4 = { screen: {}, modTitle: { color: "#fff" }, modSub: { color: "#aaa" }, modCard: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, progBar: { background: "#333" }, lessCard: {}, lessTitle: {}, a11y: false,
  roleHeader: {}, roleSubtitle: {}, roleList: {}, roleCard: {}, roleAccent: {}, roleIcon: {}, roleInfo: {}, roleLabel: {}, roleSublabel: {}, roleDesc: {} };

// заглушка Telegram: полноэкранный режим Bot API 8.0
const fakeTg = ({ platform = "ios", version = "9.6", safe = { top: 62 }, content = { top: 46 } } = {}) => {
  const ev = {};
  const W = {
    platform, version, isFullscreen: false, safeAreaInset: { top: 0 }, contentSafeAreaInset: { top: 0 }, calls: { fs: 0, swipes: 0 },
    isVersionAtLeast(v) { const a = String(this.version).split(".").map(Number), b = String(v).split(".").map(Number); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); } return true; },
    onEvent(n, f) { (ev[n] = ev[n] || []).push(f); }, offEvent(n, f) { ev[n] = (ev[n] || []).filter((g) => g !== f); }, handlers: (n) => (ev[n] || []).length,
    fire(n) { (ev[n] || []).forEach((f) => f.call(W)); },
    disableVerticalSwipes() { W.calls.swipes++; },
    requestFullscreen() { W.calls.fs++; },
    enter() { W.isFullscreen = true; W.safeAreaInset = { ...safe }; W.contentSafeAreaInset = { ...content }; W.fire("fullscreenChanged"); },
    exit() { W.isFullscreen = false; W.safeAreaInset = { top: 0 }; W.contentSafeAreaInset = { top: 0 }; W.fire("fullscreenChanged"); },
  };
  return W;
};
const fakeRoot = () => { const cls = new Set(), vars = {}; return { cls, vars,
  classList: { toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); } },
  style: { setProperty: (k, v) => { vars[k] = v; }, removeProperty: (k) => { delete vars[k]; } } }; };

describe("v69: полноэкранный режим Telegram — только на телефоне", () => {
  it("просим на iOS и Android с Bot API 8.0+; на компьютере, в старом Telegram и без метода — нет", () => {
    expect(TG_PHONES).toEqual(["ios", "android", "android_x"]);
    expect(tgFullscreenWanted(fakeTg())).toBe(true);
    expect(tgFullscreenWanted(fakeTg({ platform: "android" }))).toBe(true);
    expect(tgFullscreenWanted(fakeTg({ platform: "android_x", version: "8.0" }))).toBe(true);
    expect(tgFullscreenWanted(fakeTg({ platform: "tdesktop" }))).toBe(false);
    expect(tgFullscreenWanted(fakeTg({ platform: "macos" }))).toBe(false);
    expect(tgFullscreenWanted(fakeTg({ platform: "weba" }))).toBe(false);
    expect(tgFullscreenWanted(fakeTg({ version: "7.10" }))).toBe(false);
    expect(tgFullscreenWanted({ ...fakeTg(), requestFullscreen: undefined })).toBe(false);
    expect(tgFullscreenWanted(null)).toBe(false);
  });
  it("отступ сверху: строка состояния + строка кнопок Telegram; не в полноэкранном режиме — 0", () => {
    const tg = fakeTg();
    expect(tgTopInset(tg)).toBe(0);
    tg.enter();
    expect(tgTopInset(tg)).toBe(108);
    expect(tgTopInset({ isFullscreen: true, safeAreaInset: { top: "мусор" }, contentSafeAreaInset: null })).toBe(0);
    expect(tgTopInset({ isFullscreen: true, safeAreaInset: { top: 24.4 }, contentSafeAreaInset: { top: 48 } })).toBe(72);
  });
  it("startTgScreen: смахивание выключено, просьба одна, класс и --sa-st — по событию Telegram; выход — убраны; отписка", () => {
    const tg = fakeTg(), root = fakeRoot();
    const stop = startTgScreen(tg, root);
    expect(tg.calls).toEqual({ fs: 1, swipes: 1 });
    expect(root.cls.has("sa-tgfs")).toBe(false);
    expect(root.vars["--sa-st"]).toBeUndefined();
    tg.enter();
    expect(root.cls.has("sa-tgfs")).toBe(true);
    expect(root.vars["--sa-st"]).toBe("108px");
    tg.exit();
    expect(root.cls.has("sa-tgfs")).toBe(false);
    expect(root.vars["--sa-st"]).toBeUndefined();
    for (const n of ["fullscreenChanged", "safeAreaChanged", "contentSafeAreaChanged", "viewportChanged"]) expect(tg.handlers(n)).toBe(1);
    stop();
    for (const n of ["fullscreenChanged", "safeAreaChanged", "contentSafeAreaChanged", "viewportChanged"]) expect(tg.handlers(n)).toBe(0);
  });
  it("уже в полноэкранном режиме — второй раз не просим; компьютер — не просим, смахивание всё равно выключено; без Telegram — ничего", () => {
    const on = fakeTg(); on.isFullscreen = true; on.safeAreaInset = { top: 62 }; on.contentSafeAreaInset = { top: 46 };
    const r1 = fakeRoot(); startTgScreen(on, r1);
    expect(on.calls.fs).toBe(0);
    expect(r1.vars["--sa-st"]).toBe("108px");
    const desk = fakeTg({ platform: "tdesktop" }), r2 = fakeRoot(); startTgScreen(desk, r2);
    expect(desk.calls).toEqual({ fs: 0, swipes: 1 });
    expect(typeof startTgScreen(null)).toBe("function");
  });
  it("index.html: просьба сразу при запуске (пока заставка) — только на телефоне; цвет шапки — под тему; смахивание выключено", () => {
    const html = rd("index.html");
    expect(html).toContain("if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();");
    expect(html).toContain('if (tg.requestFullscreen && (p === "ios" || p === "android" || p === "android_x") && tg.isVersionAtLeast && tg.isVersionAtLeast("8.0") && !tg.isFullscreen) tg.requestFullscreen();');
    expect(html).toContain('if (tg.setHeaderColor) tg.setHeaderColor(light ? "#E8DEC8" : "#14110A");');
    expect(html.indexOf("tg.ready();")).toBeLessThan(html.indexOf("tg.requestFullscreen();"));
  });
  it("App: слежение за режимом с запуска; шапка Telegram — цвет темы (по нему Telegram красит строку состояния и кнопки)", () => {
    const app = rd("App.jsx");
    expect(app).toContain('import { startTgScreen } from "./lib/tg-screen";');
    expect(app).toContain("React.useEffect(() => startTgScreen(window.Telegram && window.Telegram.WebApp), []);");
    expect(app).toContain("tg.setHeaderColor?.(bg);");
    expect(app).toContain('padding:"calc(6px + var(--sa-st, env(safe-area-inset-top, 0px))) 12px 6px"');   // «Без сети» — отступ сверху
  });
});

describe("v69: страница и слои — под кнопками Telegram", () => {
  it("страница начинается под ними (отступ у body), фон сцены — до самого верха; экраны не листаются на высоту отступа", () => {
    const css = rd("ui/css.js"), st = rd("ui/styles.js");
    expect(css).toContain("html.sa-tgfs body { padding-top: var(--sa-st, 0px); box-sizing: border-box; }");
    expect(st).toContain('minHeight:"calc(100vh - var(--sa-st, 0px))"');
    expect(st).toContain('minHeight:"calc(100vh - var(--sa-st, 0px) - var(--sa-top, 0px) - var(--sa-padb, 0px) - var(--sa-fab, 0px))"');
    expect(rd("App.jsx")).toContain('sc.style.cssText = "position:fixed;inset:0;z-index:-1;pointer-events:none;";');   // сцена — от самого верха
  });
  it("вырез сверху везде через --sa-st (с прежним env() без Telegram) — кроме замера в viewport.js", () => {
    const files = ["App.jsx", ...readdirSync("ui").filter((f) => /\.(jsx?|js)$/.test(f)).map((f) => "ui/" + f)];
    const bare = [];
    for (const f of files) {
      const s = rd(f).replace(/var\(--sa-st,\s*env\(safe-area-inset-top,\s*0px\)\)/g, "");
      // свои исключения: замер выреза (viewport.js) и шапка таблицы графика — она липнет внутри слоя, а слой уже под кнопками
      const rest = s.replace(".sa-schedgrid.sa-wk tr:first-child th{top:env(safe-area-inset-top,0px)}", "");
      if (/env\(safe-area-inset-top/.test(rest) && f !== "ui/viewport.js") bare.push(f);
    }
    expect(bare).toEqual([]);
    expect(rd("ui/table-css-lesson.js")).toContain(".tb-head{padding:max(44px,var(--sa-st,env(safe-area-inset-top,0px))) 16px 8px}");
    expect(rd("ui/screens-dialogue.jsx")).toContain("padding:max(6px,var(--sa-st,env(safe-area-inset-top,0px))) 8px 6px");
  });
  it("слои: график и «Сборка» — от кнопок Telegram, без двойного отступа; Наставник; меню слева лёжа; окна по центру", () => {
    const sch = rd("ui/schedule.jsx"), bld = rd("ui/build.jsx");
    expect(sch).toContain('position:"fixed", inset:0, top:"var(--sa-st, 0px)", zIndex:1000');
    expect(sch).toContain('"max(14px, calc(44px - var(--sa-st, 0px))) 18px 4px"');
    expect(bld).toContain('position: "fixed", inset: 0, top: "var(--sa-st, 0px)", zIndex: 1000');
    expect(bld).toContain('padding: "max(14px, calc(44px - var(--sa-st, 0px))) 18px 4px"');
    expect(rd("ui/assistant.jsx")).toContain('paddingTop: "var(--sa-st, 0px)"');
    const tab = rd("ui/tabbar.jsx");
    expect(tab).toContain('top:"calc(50% + var(--sa-st, 0px) / 2)"');
    expect(tab).toContain('maxHeight:"calc(100vh - 16px - var(--sa-st, 0px))"');
    expect(rd("ui/mastery-card.jsx")).toContain(".ms-modal{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:max(20px,var(--sa-st,0px)) 20px 20px;");
    expect(rd("ui/menu-trainer.jsx")).toContain('paddingTop: "max(18px, var(--sa-st, 0px))"');
  });
  it("прокрутка и подсказки считают верх экрана под кнопками: прилипшие номера тем, полоска редактора, подсказка сбоку", () => {
    const sl = rd("ui/screens-learning.jsx");
    expect(sl).toContain("setPinned(!en.isIntersecting && en.boundingClientRect.bottom <= topInsetPx() + 1)");
    expect(sl).toMatch(/const inset = topInsetPx\(\);\n\s*if \(vp\.getBoundingClientRect\(\)\.top < inset\) \{/);
    expect(rd("ui/content-editor.jsx")).toContain("const up = en.isIntersecting ? en.intersectionRect.top > b.top + 0.5 : b.top < topInsetPx();");
    expect(rd("ui/widgets.jsx")).toContain("const sTop = Math.max(pad + topInsetPx(), Math.min(cyT - 60, vh - 230));");
  });
});

describe("v69: «Приглашение» — линза светлее, без мерцания", () => {
  const before = { mode: "before", mins: 26, from: 11, to: 24, title: "Разминка перед сменой", sub: "3 вопроса · 2 мин — освежишь главное", cta: "Начать", action: "warmup", icon: "clock" };
  const lensStyle = (html) => { const at = html.indexOf("data-now-lens"); return html.slice(at, html.indexOf(">", at)); };
  it("линза: стекло кнопки AI (v70: карточка сама в тон плиток — стекло прямо поверх неё, подложки нет)", () => {
    const html = R(h(NowInvitation, { ctx: before, a11y: false, on: {} }));
    expect(lensStyle(html)).toContain("background:rgba(200,169,110,0.12)");
    expect(lensStyle(html)).not.toContain("#221E16");
    expect(lensStyle(html)).toContain("inset 0 0 0 1px rgba(214,178,102,0.45)");
  });
  it("без CSS filter: тень — у подложки, кромка — inset и кольца вокруг вырезов (тёмная); светлая — тень без кромки", () => {
    const dark = R(h(NowInvitation, { ctx: before, a11y: false, on: {} })), light = R(h(NowInvitation, { ctx: before, a11y: true, on: {} }));
    for (const html of [dark, light]) {
      const at = html.indexOf("data-now-card");
      expect(html.slice(at, html.indexOf(">", at))).not.toContain("filter");
      expect(html).toContain('data-now-shadow=""');
    }
    expect(rd("ui/now-hero.jsx")).not.toMatch(/filter: P\.shadow|drop-shadow\(0 10px 16px/);
    expect(dark).toContain("box-shadow:0 10px 16px rgba(0,0,0,0.6)");
    expect(dark).toContain("box-shadow:inset 0 0 0 1px rgba(214,178,102,0.38)");
    expect(dark).toContain("radial-gradient(circle at calc(100% - 100px) 0%, transparent 9.1px, rgba(214,178,102,0.38) 9.6px");
    expect(light).toContain("box-shadow:0 5px 12px rgba(120,85,25,0.20)");
    expect(light).not.toContain("inset 0 0 0 1px rgba(214,178,102");
  });
  it("появление: по умолчанию — без своей анимации; fade — мягко (смена состояния на открытом экране)", () => {
    const plain = R(h(NowInvitation, { ctx: before, a11y: false, on: {} })), soft = R(h(NowInvitation, { ctx: before, a11y: false, on: {}, fade: true }));
    const cls = (html) => { const at = html.indexOf("data-now-card"); return html.slice(at, html.indexOf(">", at)); };
    expect(cls(plain)).not.toContain("sa-fadein");
    expect(cls(soft)).toContain('class="sa-fadein"');
  });
  it("главная: карточка открывается без проявления; проявляется только при смене состояния", async () => {
    const src = rd("ui/screens-roleselect.jsx");
    expect(src).toContain("const nowModeRef = React.useRef(null);");
    expect(src).toContain("fade={(() => { if (nowModeRef.current === null) nowModeRef.current = card.mode; return card.mode !== nowModeRef.current; })()}");
    const { RoleSelect } = await import("../ui/screens-roleselect");
    const mod = { id: "cms-m-1", title: "Свой раздел", lessons: [{ id: "cms-l-1", type: "lesson", title: "Урок: встреча гостя", content: "Текст" }] };
    const html = R(h(RoleSelect, { T: T4, a11y: false, profile: { name: "Роман", surname: "", restaurant: "Два моря, Океан", position: "waiter" }, role: "seasonal", onSelect: noop, onContinueLesson: noop,
      onGuestBook: noop, onSchedule: noop, onMistakes: noop, customByRole: { seasonal: [mod] }, nowCard: before, nowOn: { warmup: noop } }));
    const at = html.indexOf("data-now-card");
    expect(at).toBeGreaterThan(0);
    expect(html.slice(at, html.indexOf(">", at))).not.toContain("sa-fadein");
  });
});

describe("v69: метка и журнал", () => {
  it("«сборка v69», «Дополнение 382»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2}<\/span>/);   // v70: метка дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 382 — полноэкранный режим в Telegram, линза светлее, карточка без мерцания (v69)");
  });
});
