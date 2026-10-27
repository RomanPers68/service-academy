// v95 (Доп. 408): клавиатура на iPhone, когда окно сжимается без события. На записи владельца (v94) строка ввода ехала
// вверх вместе с клавиатурой, а через 0,4 с, когда Telegram сжимал окно, подпрыгивала ещё на высоту клавиатуры к шапке:
// события resize не было, и отступ оставался. Теперь размер слоя смотрит ResizeObserver (ui/keyboard.js), а после
// сообщения Telegram о высоте замер повторяется через 0,5 и 1 с. Вид — tools/claude/e2e-v95.mjs (окно меняется «молча»).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");

describe("v95: окно сжалось без события (ui/keyboard.js)", () => {
  it("размер слоя смотрит ResizeObserver: рамка слоя, пересчёт до отрисовки; при закрытии — отключается", () => {
    const src = rd("ui/keyboard.js");
    for (const s of ["ro = new ResizeObserver(() => measure());",
      'try { ro.observe(el, { box: "border-box" }); } catch (e) { ro.observe(el); }',
      "if (ro) { try { ro.disconnect(); } catch (e) { /* */ } }",
      "// v95: слой стал ниже или выше (окно сжалось, клавиатура ушла) — пересчёт до отрисовки этого кадра, без событий окна"])
      expect([s, src.includes(s)]).toEqual([s, true]);
  });
  it("после высоты от Telegram — замер сразу и ещё через 0,5 и 1 с; таймеры снимаются", () => {
    const src = rd("ui/keyboard.js");
    expect(src).toContain("const onTg = () => { measure(); late.forEach(clearTimeout); late = [500, 1000].map((ms) => setTimeout(measure, ms)); };");
    expect(src).toContain('try { if (tg && tg.offEvent) tg.offEvent("viewportChanged", onTg); } catch (e) { /* */ }');
    expect(src).toContain("alive = false; clearTimeout(timer); clearTimeout(settle); late.forEach(clearTimeout); if (raf) cancelAnimationFrame(raf);");
  });
  it("расчёт прежний: окно сжалось, высота от Telegram та же — низ у клавиатуры, отступ 0", async () => {
    const { kbBottom } = await import("../ui/keyboard.js");
    expect(kbBottom({ ios: true, bottom: 516, layerH: 516, baseH: 852, tgH: 516, typing: true, vvTop: 0, vvH: 516 })).toBe(516);
    expect(kbBottom({ ios: true, bottom: 852, layerH: 852, baseH: 852, tgH: 852, typing: false, vvTop: 0, vvH: 852 })).toBe(852);
  });
});

describe("v95: вырез снизу — тем же ходом и по тем же часам, что низ", () => {
  it("хук ведёт --kbs (1 — клавиатуры нет, 0 — есть) вместе с --kb; часы — performance.now, а не метка кадра", () => {
    const src = rd("ui/keyboard.js");
    for (const s of ['if (s !== putS) { putS = s; el.style.setProperty("--kbs", String(s)); }',
      "const t = now(), k = KB_MS > 0 ? (t - t0) / KB_MS : 1, ku = KB_MS > 0 ? (t - ut0) / KB_MS : 1;",
      "if (upT !== uto) { ufrom = us; uto = upT; ut0 = tn; }",
      'if (el) { el.setAttribute("data-kbup", next.up ? "1" : "0"); if (cls) el.classList.toggle(cls, next.up); }'])
      expect([s, src.includes(s)]).toEqual([s, true]);
  });
  it("в разметке: строка ввода, «Новый чат», список коллег и листы — calc(… var(--sa-sb) * var(--kbs,1)), без класса kb и переходов", () => {
    const chat = rd("ui/chat.jsx");
    expect(chat).toContain('const kb = useKeyboardLift(rootRef, { cls: "kb" });');
    expect((chat.match(/var\(--sa-sb,env\(safe-area-inset-bottom,0px\)\) \* var\(--kbs,1\)/g) || []).length).toBe(4);
    expect(chat).not.toContain(".sa-dlg.ch.kb ");
    expect(chat).not.toContain("transition:padding-bottom");
    expect(rd("ui/assistant.jsx")).toContain('<div className="sa-ai-bar" style={{ padding: "6px 10px calc(10px + env(safe-area-inset-bottom, 0px) * var(--kbs, 1))" }}>');
  });
});

describe("v95: меню слева — круги Наставника и чата одного размера", () => {
  it("лёжа на телефоне оба 44 px (было 46 и 42 — высота меню та же), на большом экране 50", async () => {
    const { RAIL_DISC } = await import("../ui/tabbar.jsx");
    expect([RAIL_DISC(true), RAIL_DISC(false)]).toEqual([44, 50]);
    const src = rd("ui/tabbar.jsx");
    expect(src).toContain('style={{ position:"relative", zIndex:2, width: RAIL_DISC(compact), height: RAIL_DISC(compact), borderRadius:"50%", margin:"2px auto",');
    expect(src).toContain("<ChatDisc a11y={a11y} size={RAIL_DISC(compact)} label={chat.label} glass={false} />");
    expect(src).not.toContain("compact ? 46 : 50");
    expect(src).not.toContain("size={compact ? 42 : 50}");
  });
});

describe("v95: документы", () => {
  it("README: e2e-v95; CHANGES: Дополнение 408; «сборка v95»", () => {
    expect(rd("tools/claude/README.md")).toContain("`e2e-v95.mjs` — v95 (Доп. 408)");
    expect(rd("CHANGES.md")).toContain("# Дополнение 408 — Клавиатура на iPhone: строка ввода не подпрыгивает к шапке; круги в меню слева одного размера (v95)");
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(9[5-9]|\d{3,})<\/span>/);
  });
});
