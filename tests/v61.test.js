// v61 (Доп. 374): ряд треков под свёрнутым списком на главной — узлы по ширине экрана, тап раскрывает карточку
// трека на месте ряда, первый заход встречает раскрытой карточкой своего трека. Вид в браузере — tools/claude/e2e-v61.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { lockedHint } from "../ui/tracks-row.jsx";
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
    expect(row).toContain("const D = Math.max(40, Math.floor((rowW - GAP * 5) / 6));");   // v64: без «ушка» AI — вся ширина ряду
    expect(row).toContain("new ResizeObserver(upd)");
    expect(row).toContain('backdropFilter: "blur(10px)"');
    expect(row).not.toMatch(/radial-gradient\(circle at 3\d% 2\d%/);   // блика, делающего кружок выпуклым, нет
    expect(row).toContain('strokeDasharray={x.open ? undefined : "2.5 3.5"}');   // закрытые — пунктирное кольцо
    expect(row).toContain("const badge = x.open && x.pct > 0 ? `${x.pct}%` : null;");
    expect(row).not.toMatch(/"СЕЙЧАС"|«сейчас»\s*<\/span>/);
    expect(row).toContain('data-track-locked={x.open ? undefined : ""}');
  });
  it("тап: «×», тап по панели — в трек; закрытый — без перехода (v64: ряд стоит, панель — под ним, а не на месте ряда)", () => {
    expect(row).not.toContain('flex: "0 0 100%", order: -1');   // v61 ставил карточку на место ряда — владелец: «будет путать»
    expect(row).toContain('data-track-panel=""');
    expect(row).toContain('data-track-close=""');
    expect(row).toContain("if (ex.open) { vibrate(\"light\"); onSelect(ex.r.id); }");
    expect(row).toContain("lockedHint(x.r.id)");
  });
  it("движение: Web Animations, в «спокойном режиме» — без него (v64: по высоте панели вместо FLIP ряда)", () => {
    expect(row).toContain("prefers-reduced-motion: reduce");
    expect(row).not.toContain("translate(${dx}px, ${dy}px)");
    expect(row).toContain("el.animate(from ? [{ height: from + \"px\" }, { height: to + \"px\" }]");
  });
  it("v62–v63: первый заход — не раскрытая карточка, а ярлычок «Твоя роль. Тапни 😉» над своим кружком, сразу за туром главной", () => {
    expect(HINTS.track_orb).toEqual(["Твоя роль. Тапни 😉"]);
    expect(row).toContain("React.useState(null)");
    expect(row).not.toContain("firstMeet");
    expect(row).toContain('id={"sa-orb-" + x.r.id}');
    expect(row).toContain("if (onPick) onPick(id);");
    // v63: ярлычок вместо системного пузыря — над кружком, с хвостиком, кружок дышит; тап по ярлычку = тап по кружку
    expect(row).toContain('data-track-nudge="tag"');
    expect(row).toContain("onClick={() => pick(role)}");
    expect(row).toContain('className={nudgeOn && x.cur ? "sa-orb-nudge" : undefined}');
    expect(row).toContain("paddingTop: nudgeOn ? LANE : 0");
    expect(row).not.toContain("HintBubble");
    expect(rs).toContain('useHintOnce("track_orb", !!role && hintsReady && !homeHint && !wideCols, true)');
    expect(rs).toContain("nudge={orbHint && hintsReady}");
    expect(rs).toContain("onPick={orbHint ? orbHintDone : null}");
    expect(rs).not.toContain('anchorId={"sa-orb-" + role}');
    expect(rs).toContain('performance.now() - orbShownAt.current > 4000');   // ушёл с главной, не тапнув, — больше не навязываемся
    const w = rd("ui/widgets.jsx");
    expect(w).toContain("export function useHintOnce(key, ready = true, chain = false)");
    expect(w).toContain("if (!chain && !hintBudgetFree(key)) return;");
    const css = rd("ui/css.js");
    expect(css).toContain(".sa-orb-nudge { animation: saOrbNudge 2s ease-in-out infinite !important; }");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .sa-orb-nudge { animation: none !important; } }");
  });
  it("v62 → v64: кнопка AI больше не над рядом (переехала в нижнее меню) — «ушко» и уступка ряда убраны", () => {
    expect(row).not.toContain("sa-fab-shy");
    expect(row).not.toContain("SHY_PX");
    expect(row).not.toContain("setAvoid(");
    const css = rd("ui/css.js");
    expect(css).not.toContain("html.sa-fab-shy .sa-fab:not(.hid)");
    expect(rd("App.jsx")).toContain("const fabOn = false;");
  });
  it("метка сборки; CHANGES — «Дополнение 374», «375», «376»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2}<\/span>/);
    expect(rd("CHANGES.md")).toContain("# Дополнение 374");
    expect(rd("CHANGES.md")).toContain("# Дополнение 375");
    expect(rd("CHANGES.md")).toContain("# Дополнение 376");
  });
});
