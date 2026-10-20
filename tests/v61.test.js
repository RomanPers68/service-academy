// v61 (Доп. 374): ряд треков под свёрнутым списком на главной — узлы по ширине экрана, тап раскрывает карточку
// трека на месте ряда, первый заход встречает раскрытой карточкой своего трека. Вид в браузере — tools/claude/e2e-v61.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { lockedHint, SHY_PX } from "../ui/tracks-row.jsx";
import { HINTS } from "../data/hints.js";

const rd = (f) => readFileSync(f, "utf8");
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };

describe("v61–v62: подсказки закрытых и первый заход", () => {
  it("lockedHint: ступени зала — «Пройди «предыдущая», чтобы открыть»; у первой ступени и остальных — «Откроется позже»", () => {
    expect(lockedHint("core")).toBe("Пройди «Новичок», чтобы открыть");
    expect(lockedHint("manager")).toBe("Пройди «Ядро», чтобы открыть");
    expect(lockedHint("service_manager")).toBe("Пройди «Менеджер», чтобы открыть");
    expect(lockedHint("seasonal")).toBe("Откроется позже");
    expect(lockedHint("spg")).toBe("Откроется позже");
  });
});

describe("v61: ряд треков в коде", () => {
  const row = rd("ui/tracks-row.jsx");
  const rs = rd("ui/screens-roleselect.jsx");
  it("главная: ряд TracksRow вместо фишек v60; строка над рядом — «подробнее», без «ещё 5»", () => {
    expect(rs).toContain('import { TracksRow } from "./tracks-row"');
    expect(rs).toMatch(/\{!wideCols && role && !listOpen \? \(\s*<TracksRow /);
    expect(rs).not.toContain("data-tracks-chips");
    expect(rs).not.toContain("tracks-compact");
    expect(rs).toContain('{listOpen ? "Свернуть" : "подробнее"}');
    expect(existsSync("ui/tracks-compact.jsx")).toBe(false);
  });
  it("узлы: шесть в ряд по ширине (размер от ширины ряда), плоское стекло без блика, кольцо прогресса, плашка «%» и замок — без слова «сейчас»", () => {
    expect(row).toContain("const D = Math.max(40, Math.floor(((w || 365) - avoid - GAP * 5) / 6));");
    expect(row).toContain("new ResizeObserver(upd)");
    expect(row).toContain('backdropFilter: "blur(10px)"');
    expect(row).not.toMatch(/radial-gradient\(circle at 3\d% 2\d%/);   // блика, делающего кружок выпуклым, нет
    expect(row).toContain('strokeDasharray={x.open ? undefined : "2.5 3.5"}');   // закрытые — пунктирное кольцо
    expect(row).toContain("const badge = x.open && x.pct > 0 ? `${x.pct}%` : null;");
    expect(row).not.toMatch(/"СЕЙЧАС"|«сейчас»\s*<\/span>/);
    expect(row).toContain('data-track-locked={x.open ? undefined : ""}');
  });
  it("тап: карточка трека на месте ряда (order: -1, во всю ширину), «×», тап по карточке — в трек; закрытый — без перехода", () => {
    expect(row).toContain('flex: "0 0 100%", order: -1');
    expect(row).toContain('data-track-close=""');
    expect(row).toContain("if (ex.open) { vibrate(\"light\"); onSelect(ex.r.id); }");
    expect(row).toContain("lockedHint(ex.r.id)");
  });
  it("движение: FLIP по Web Animations, в «спокойном режиме» — без него", () => {
    expect(row).toContain("prefers-reduced-motion: reduce");
    expect(row).toContain("el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: \"none\" }]");
    expect(row).toContain("card.animate(");
  });
  it("v62: первый заход — не раскрытая карточка, а подсказка «Твоя роль. Тапни 😉» у своего кружка, сразу за туром главной; тап сквозь подсказку", () => {
    expect(HINTS.track_orb).toEqual(["Твоя роль. Тапни 😉"]);
    expect(row).toContain("React.useState(null)");
    expect(row).not.toContain("firstMeet");
    expect(row).toContain('id={"sa-orb-" + x.r.id}');
    expect(row).toContain("if (onPick) onPick(id);");
    expect(rs).toContain('useHintOnce("track_orb", !!role && hintsReady && !homeHint && !wideCols, true)');
    expect(rs).toContain('anchorId={"sa-orb-" + role} onClose={orbHintDone} round passTap');
    expect(rs).toContain("onPick={orbHint ? orbHintDone : null}");
    const w = rd("ui/widgets.jsx");
    expect(w).toContain("export function useHintOnce(key, ready = true, chain = false)");
    expect(w).toContain("if (!chain && !hintBudgetFree(key)) return;");
    expect(w).toContain('borderRadius: round ? "50%" : 16');
    expect(w).toContain('pointerEvents: passTap ? "none" : "auto"');
  });
  it("v62: кнопка AI не закрывает ряд — уходит к краю ушком, ряд уступает ровно под ушко", () => {
    expect(SHY_PX).toBe(42);
    expect(row).toContain('html.classList.toggle("sa-fab-shy", hit)');
    expect(row).toContain("setAvoid(hit ? Math.max(0, Math.ceil(r.right - (f.left + SHY_PX) + 6)) : 0)");
    expect(row).toContain("const D = Math.max(40, Math.floor(((w || 365) - avoid - GAP * 5) / 6));");
    expect(row).toContain('document.addEventListener("scroll", later, { capture: true, passive: true })');
    const css = rd("ui/css.js");
    expect(css).toContain("html.sa-fab-shy .sa-fab:not(.hid) { transform: translateX(42px); }");
    expect(css).toContain("html.sa-fab-shy [data-tracks-title] { padding-right: 34px !important; }");
  });
  it("метка сборки; CHANGES — «Дополнение 374» и «Дополнение 375»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2}<\/span>/);
    expect(rd("CHANGES.md")).toContain("# Дополнение 374");
    expect(rd("CHANGES.md")).toContain("# Дополнение 375");
  });
});
