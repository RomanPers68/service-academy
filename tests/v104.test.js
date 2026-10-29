// v104 (Доп. 417): линзы в листах чата. Владелец (29.10, запись из Telegram): «по настройкам, в чате… тоже можем
// линзы сделать, особенно кнопки подтверждения, ну и всё остальное?». e2e — tools/claude/e2e-v104.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const CSS = rd("ui/home-look.jsx");
const end = CSS.indexOf("/* ── v105"), V104 = CSS.slice(CSS.indexOf("/* ── v104"), end > 0 ? end : undefined);   // v105: только свой раздел

describe("v104: листы чата — стили под html.sa-lens", () => {
  it("кнопка подтверждения (.ch-main) — стеклянная плашка: свет сверху, ободок, кольцо снаружи, надпись золотом", () => {
    expect(V104).toContain("html.sa-lens .ch-main{position:relative;color:var(--lk-hi)!important;");
    expect(V104).toContain("background:radial-gradient(120% 160% at 50% 0%,rgba(232,201,131,0.24),rgba(200,169,110,0.12) 62%)!important;");
    expect(V104).toContain('html.sa-lens .ch-main::after{content:"";position:absolute;inset:-3.5px;border-radius:999px;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(V104).toContain("html.sa-lens.sa-light .ch-main{background:radial-gradient(120% 160% at 50% 0%,rgba(255,255,255,0.85),rgba(176,138,70,0.22) 70%)!important;");
  });
  it("«отправить», «закрыть» листа и значки строк выбора — линзы; значок — круг, фото — в круге", () => {
    expect(V104).toContain("html.sa-lens .ch-send,html.sa-lens .ch-x,html.sa-lens .ch-opt-i{position:relative;background:var(--lk-glass)!important;");
    expect(V104).toContain('html.sa-lens .ch-send::after,html.sa-lens .ch-x::after,html.sa-lens .ch-opt-i::after{content:"";position:absolute;inset:-3.5px;border-radius:50%;');
    expect(V104).toContain("html.sa-lens .ch-x{width:32px;height:32px;margin:2px}");
    expect(V104).toContain("html.sa-lens .ch-opt-i{border-radius:50%!important;overflow:visible!important}");
    expect(V104).toContain("html.sa-lens .ch-opt-i img{border-radius:50%}");
  });
  it("бледная кнопка, пока не выбрано, — прежняя (opacity из ui/chat.jsx); выбранная строка, чипы, поля — без линзы", () => {
    expect(rd("ui/chat.jsx")).toContain(".ch-main:disabled{opacity:.55}");
    expect(V104).not.toMatch(/\.ch-chip|\.ch-field|\.ch-opt\{|\.ch-opt\[|\.ch-cbtn|\.ch-po\b/);
  });
  it("классы листов, на которые опирается линза, на месте", () => {
    const chat = rd("ui/chat.jsx"), cards = rd("ui/chat-cards.jsx");
    expect(chat).toMatch(/\.ch-main\{display:block;width:100%;margin-top:12px;min-height:50px;border-radius:999px;/);
    expect(cards).toMatch(/\.ch-opt-i\{width:38px;height:38px;flex:0 0 auto;border-radius:11px;/);
    expect(chat).toMatch(/\.ch-x\{width:36px;height:36px;/);
    expect(chat).toContain('className="ch-send" data-chat-send=""');
  });
});
