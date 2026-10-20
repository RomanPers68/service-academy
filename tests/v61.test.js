// v61 (Доп. 374): ряд треков под свёрнутым списком на главной — узлы по ширине экрана, тап раскрывает карточку
// трека на месте ряда, первый заход встречает раскрытой карточкой своего трека. Вид в браузере — tools/claude/e2e-v61.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { firstMeet, lockedHint, MET_KEY } from "../ui/tracks-row.jsx";

const rd = (f) => readFileSync(f, "utf8");
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };

describe("v61: первый заход и подсказки закрытых", () => {
  it("firstMeet: первый раз — «да» и отметка sa_tracks_met<uk>; дальше — «нет»; без ключа или памяти — «нет»", () => {
    const st = mem();
    expect(firstMeet("_Анна_Новикова", st)).toBe(true);
    expect(st.getItem(MET_KEY + "_Анна_Новикова")).toBe("1");
    expect(firstMeet("_Анна_Новикова", st)).toBe(false);
    expect(firstMeet("_Лена_Иванова", st)).toBe(true);   // другой человек на том же телефоне — своя отметка
    expect(firstMeet("", st)).toBe(false);
    expect(firstMeet("_Анна_Новикова", null)).toBe(false);
    const broken = { getItem: () => { throw new Error("quota"); }, setItem: () => {} };
    expect(firstMeet("_x", broken)).toBe(false);
  });
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
    expect(row).toContain("const D = Math.max(40, Math.floor(((w || 365) - GAP * 5) / 6));");
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
  it("первый заход: openId = свой трек, когда firstMeet(uk) впервые", () => {
    expect(row).toContain("React.useState(() => (role && firstMeet(uk) ? role : null))");
    expect(rs).toContain("uk={profile ? `_${profile.name}_${profile.surname || \"\"}` : \"\"}");
  });
  it("метка сборки — v61; CHANGES — «Дополнение 374»", () => {
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v61</span>");
    expect(rd("CHANGES.md")).toContain("# Дополнение 374");
  });
});
