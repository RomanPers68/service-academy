// v114 (Доп. 427): «Наставник» — список бесед и «Очистить переписку?» в полноэкранном Telegram уезжали под кнопки Telegram.
// Владелец (30.10, запись экрана): «Я нашёл у ассистента баг: когда нажимаешь на выбор чата». Экран Наставника сверху
// отступает на высоту кнопок Telegram (--sa-st, v69), а обе панели отсчитывали 62 px от самого верха экрана: теперь —
// 62 px плюс этот отступ, то есть сразу под шапкой и там, и в обычном окне. И (запись экрана того же вечера: «некрасивая
// анимация появления кнопок… как будто подгружается») — карточки вкладок-хабов въезжают все разом. e2e — tools/claude/e2e-v114.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const A = rd("ui/assistant.jsx");

describe("v114: панели Наставника — под шапкой и в полноэкранном Telegram", () => {
  it("экран отступает сверху на --sa-st; обе панели — 62 px плюс тот же отступ", () => {
    expect(A).toContain('paddingTop: "var(--sa-st, 0px)",');
    expect(A).toContain('<div className="sa-pagein" style={{ position: "absolute", top: "calc(62px + var(--sa-st, 0px))", left: 12, right: 12, zIndex: 6,');
    expect(A).toContain('<div className="sa-pagein sa-dlgscroll" style={{ position: "absolute", top: "calc(62px + var(--sa-st, 0px))", left: 12, right: 12, zIndex: 6,');
    expect(A).not.toMatch(/position: "absolute", top: 62,/);
  });
  it("подложка под панелями — по-прежнему на весь экран (тап мимо закрывает)", () => {
    expect(A).toContain('style={{ position: "absolute", inset: 0, zIndex: 5 }} />');
  });
  it("вкладки «Смена», «Команда», «Я»: экран без общего въезда, карточки въезжают все разом (без очереди по 45 мс)", () => {
    const app = rd("App.jsx"), hubs = rd("ui/home-hubs.jsx"), css = rd("ui/css.js");
    expect(app).toContain('const HUB_TABS = ["shift", "teamHub", "me"];');
    expect(app).toContain('className={HUB_TABS.includes(screen) ? undefined : "sa-pagein"}>');
    expect(hubs).not.toContain("animationDelay");
    expect(hubs).toContain('<div style={T.screen} className="sa-screen sa-hubscreen">');
    // строки внутри карточки хаба не въезжают по очереди (каскад .sa-pagein > div:nth-child)
    expect(css).toContain(".sa-hubscreen .sa-pagein > div { animation: none; }");
    expect(css.indexOf(".sa-hubscreen .sa-pagein > div { animation: none; }")).toBeGreaterThan(css.indexOf(".sa-pagein > div:nth-child(6)"));
  });
  it("метка — v114", () => {
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v114</span>");
  });
});
