// v72 (Доп. 385): верхняя строка «SA · поиск · тема» снова под кнопками Telegram.
// Владелец (23.10, снимок и запись с iPhone): «Не видно поиск и переключение режима для чтения» — «появляются ненадолго,
// когда разворачиваешь свернутое приложение». В v71 строка стояла в середине строки кнопок Telegram; на iPhone Telegram
// накрывает эту полосу своей подложкой, как только показывает «Закрыть» и «⌄ ⋯». Вид в браузере — tools/claude/e2e-v71.mjs TG.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { startTgScreen } from "../lib/tg-screen";

const rd = (f) => readFileSync(f, "utf8");

describe("v72: строка под кнопками Telegram", () => {
  it("CSS не ставит строку в строку кнопок Telegram; tg-screen не ставит sa-tgrow и снимает след v71", () => {
    expect(rd("ui/css.js")).not.toMatch(/sa-tgrow \[data-sa-topbar\]/);
    expect(rd("lib/tg-screen.js")).not.toContain("tgButtonsRow");
    const ev = {};
    const tg = { platform: "ios", isFullscreen: true, safeAreaInset: { top: 59 }, contentSafeAreaInset: { top: 46 }, isVersionAtLeast: () => true, requestFullscreen() {}, disableVerticalSwipes() {},
      onEvent(n, f) { (ev[n] = ev[n] || []).push(f); }, offEvent() {} };
    const cls = new Set(["sa-tgrow"]), vars = { "--sa-tgrow": "46px" };
    const root = { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), remove: (c) => cls.delete(c) }, style: { setProperty: (k, v) => { vars[k] = v; }, removeProperty: (k) => { delete vars[k]; } } };
    startTgScreen(tg, root);
    expect(cls.has("sa-tgfs")).toBe(true);
    expect(vars["--sa-st"]).toBe("105px");          // строка состояния + кнопки Telegram, как в v69
    expect(cls.has("sa-tgrow")).toBe(false);         // след v71 снят
    expect(vars["--sa-tgrow"]).toBeUndefined();
  });
  it("лупа в строке осталась; строка в потоке меряется в --sa-top", () => {
    const app = rd("App.jsx");
    expect(app).toContain("data-top-search");
    expect(app).toContain('<div style={T.a11yBar} ref={saBarRef} data-sa-topbar="">');
    expect(app).toContain('root.style.setProperty("--sa-top", h + "px");');
  });
  it("метка «сборка v72», «Дополнение 385»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2,}<\/span>/);   // v73 — следующая метка
    expect(rd("CHANGES.md")).toContain("# Дополнение 385 — верхняя строка снова под кнопками Telegram: на iPhone он накрывает свою полосу (v72)");
  });
});
