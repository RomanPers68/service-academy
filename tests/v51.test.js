// v51 (Доп. 364): по записи владельца — лёжа меню слева уходило под Dynamic Island, а после поворота обратно
// линза нижней панели становилась в две вкладки (на «Я» её не было видно вовсе).
//
// «Переворачивая, нав бар прячется под динамик-айленд (возможно, это только на айфоне), и переворачивая обратно,
// линза начинает себя вести плохо». Вид в браузере (Telegram на iPhone лёжа с вырезами из WebApp.safeAreaInset,
// запас без них, компьютер и SE без запаса, линза после «поздней» ширины и после поворота) — tools/claude/e2e-v51.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

import { notchedFullWidth } from "../ui/viewport";

const rd = (f) => readFileSync(f, "utf8");
const IPH = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" };

describe("v51: вырезы экрана — из Telegram и запасом на iPhone", () => {
  const vp = rd("ui/viewport.js");
  it("вырезы: больший из env() и Telegram WebApp.safeAreaInset; о вырезе никто не сказал — запас 50 px с обеих сторон", () => {
    expect(vp).toContain("const s = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.safeAreaInset;");
    expect(vp).toContain("const r = { t: Math.max(e.t, g.t), r: Math.max(e.r, g.r), b: Math.max(e.b, g.b), l: Math.max(e.l, g.l) };");
    expect(vp).toContain("if (!r.l && !r.r && notchedFullWidth()) { r.l = 50; r.r = 50; }");
  });
  it("запас — только iPhone с вырезом, лёжа, окно во всю длину экрана (Telegram); не SE, не Safari, не компьютер", () => {
    expect(notchedFullWidth(IPH, { width: 440, height: 956 }, 956, 390)).toBe(true);    // Telegram на 16 Pro Max лёжа
    expect(notchedFullWidth(IPH, { width: 393, height: 852 }, 852, 393)).toBe(true);    // 15 Pro
    expect(notchedFullWidth(IPH, { width: 440, height: 956 }, 440, 956)).toBe(false);   // стоя
    expect(notchedFullWidth(IPH, { width: 430, height: 932 }, 814, 390)).toBe(false);   // Safari: вырезы уже вне окна
    expect(notchedFullWidth(IPH, { width: 375, height: 667 }, 667, 375)).toBe(false);   // SE — выреза нет
    expect(notchedFullWidth({ userAgent: "Mozilla/5.0 (Linux; Android 14)" }, { width: 412, height: 915 }, 915, 412)).toBe(false);
  });
  it("Telegram сообщает вырезы событием — раскладка перечитывается (safeAreaChanged, contentSafeAreaChanged, viewportChanged)", () => {
    expect(vp).toContain('const TG_EV = ["safeAreaChanged", "contentSafeAreaChanged", "viewportChanged"];');
    expect(vp).toContain("try { if (tg && tg.onEvent) TG_EV.forEach((ev) => tg.onEvent(ev, on)); } catch (er) {}");
    expect(vp).toContain("try { if (tg && tg.offEvent) TG_EV.forEach((ev) => tg.offEvent(ev, on)); } catch (er) {}");
  });
  it("App кладёт вырезы в --sa-sl / --sa-sr / --sa-sb, правый край меню --sa-rail — в px с вырезом", () => {
    const app = rd("App.jsx");
    expect(app).toContain('el.style.setProperty("--sa-sl", vp.safe.l + "px"); el.style.setProperty("--sa-sr", vp.safe.r + "px");');
    expect(app).toContain('el.style.setProperty("--sa-rail", (railOn ? RAIL_W + vp.safe.l : vp.safe.l) + "px");');
    expect(app).toContain("}, [vp.wide, vp.short, vp.desk, railOn, colW, vp.safe.l, vp.safe.r, vp.safe.b]);");
  });
  it("меню слева, колонка, график, диалог лёжа, слои во весь экран и «Сборка» — от вырезов", () => {
    expect(rd("ui/tabbar.jsx")).toContain('left:"calc(12px + var(--sa-sl, env(safe-area-inset-left, 0px)))"');
    const css = rd("ui/css.js");
    expect(css).toContain("calc(100vw - var(--sa-rail, 0px) - var(--sa-sr, env(safe-area-inset-right, 0px)) - 24px)");
    expect(css).toContain("html.sa-wide .sa-schedwrap, html.sa-wide .sa-safex { padding-left: var(--sa-sl, 0px) !important; padding-right: var(--sa-sr, 0px) !important; box-sizing: border-box; }");
    expect(css).toContain("html.sa-wide .sa-schedcol { width: min(var(--sa-schedw, 680px), calc(100% - 24px));");
    expect(css).toContain("@media (max-width: 899.98px) {\n      html.sa-wide .sa-layer { padding-left: var(--sa-sl, 0px) !important; padding-right: var(--sa-sr, 0px) !important; }");
    expect(rd("ui/build.jsx")).toContain('<div className="sa-bld-buildwrap sa-safex" style={{');
    const d = rd("ui/screens-dialogue.jsx");
    expect(d).toContain(".sa-dlg.dc .dc-feed{padding-left:max(12px,var(--sa-sl,env(safe-area-inset-left,0px)))}");
    expect(d).toContain("padding:10px max(12px,var(--sa-sr,env(safe-area-inset-right,0px))) calc(10px + var(--sa-sb,env(safe-area-inset-bottom,0px))) 12px;");
  });
});

describe("v51: линза нижней панели после поворота", () => {
  const tb = rd("ui/tabbar.jsx");
  it("панель перемеряет себя сама: ResizeObserver, ещё раз через 0,3 и 0,9 с, и на касании", () => {
    expect(tb).toContain("ro = new ResizeObserver(m); ro.observe(barRef.current);");
    expect(tb).toContain("const t1 = setTimeout(m, 300), t2 = setTimeout(m, 900);");
    expect(tb).toContain("return () => { window.removeEventListener(\"resize\", m); if (ro) ro.disconnect(); clearTimeout(t1); clearTimeout(t2); };");
    expect(tb).toContain("if (barRef.current && barRef.current.clientWidth !== barW) setBarW(barRef.current.clientWidth);   // v51");
  });
  it("метка сборки — v51; CHANGES — «Дополнение 364»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2}<\/span>/);   // v52 — следующая метка
    expect(rd("CHANGES.md")).toContain("# Дополнение 364 — лёжа меню не под Dynamic Island, линза после поворота на месте (v51)");
  });
});
