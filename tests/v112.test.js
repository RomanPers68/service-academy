// v112 (Доп. 425): «Радио в дорогу» в линзах. Владелец (30.10, снимок радио): «Давай ещё радио в линзы». Оболочка урока у
// радио — со своим классом .tb-radio: правила линзы (ui/home-look.jsx, раздел v112) не задевают «Живого гостя» и урок у стола;
// всё — под html.sa-lens, вид «как сейчас» прежний. e2e — tools/claude/e2e-v112.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const LOOK = rd("ui/home-look.jsx");
const V112 = LOOK.slice(LOOK.indexOf("/* ── v112"), LOOK.indexOf("/* ── v113") > 0 ? LOOK.indexOf("/* ── v113") : LOOK.lastIndexOf("`;"));   // v113: дальше — свой раздел
const sels = code(V112).split("}").map((r) => r.split("{")[0].trim()).filter(Boolean).flatMap((s) => s.split(",").map((x) => x.trim()));

describe("v112: оболочка радио со своим классом", () => {
  it("shell(children, vars, inline, cls): у радио — tb-radio (оба экрана), у «Живого гостя» и урока у стола — без класса", () => {
    const T = rd("ui/table.jsx");
    expect(T).toContain('function shell(children, vars, inline, cls = "") {\n  const el = <div className={"tb" + (cls ? " " + cls : "")} style={vars}>{children}</div>;');
    const R = rd("ui/radio.jsx");
    expect((R.match(/, vars, inline, "tb-radio"\);/g) || []).length).toBe(2);
    expect(R).not.toMatch(/, vars, inline\);/);
    for (const f of ["ui/live-guest.jsx", "ui/table.jsx"]) expect(code(rd(f)), f).not.toContain("tb-radio");
  });
  it("разметка: корень — class=\"tb tb-radio\"; без класса — прежний \"tb\"", async () => {
    const { tableShell } = await import("../ui/table.jsx");
    expect(renderToString(tableShell(React.createElement("i"), {}, true, "tb-radio"))).toMatch(/^<div class="tb tb-radio"/);
    expect(renderToString(tableShell(React.createElement("i"), {}, true))).toMatch(/^<div class="tb"/);
  });
});

describe("v112: правила линзы радио (ui/home-look.jsx)", () => {
  it("раздел v112 после v111; каждое правило — только под html.sa-lens и только в .tb-radio", () => {
    expect(LOOK.indexOf("/* ── v112")).toBeGreaterThan(LOOK.indexOf("/* ── v111"));
    expect(sels.length).toBeGreaterThan(20);
    for (const s of sels) expect(s, s).toMatch(/^html\.sa-lens(\.sa-light)? \.tb-radio /);
  });
  it("«закрыть», значок радио, «назад / вперёд», скорость — линзы: стекло, ободок, блик, значок золотом, кольцо снаружи", () => {
    expect(V112).toContain("html.sa-lens .tb-radio .tb-x,html.sa-lens .tb-radio .tb-av,html.sa-lens .tb-radio .rd-ctl button:not(.play){position:relative;background:var(--lk-glass);border-color:transparent;color:var(--lk-gold);");
    expect(V112).toContain('html.sa-lens .tb-radio .tb-x::after,html.sa-lens .tb-radio .tb-av::after,html.sa-lens .tb-radio .rd-ctl button::after{content:"";position:absolute;inset:-3.5px;border-radius:999px;border:1px solid var(--lk-ring);pointer-events:none}');
    // «Для чтения»: «1×» на светлом стекле — темнее золото, контраст 4,5 (e2e-v30 K: с #7A5D2A было 4,16)
    expect(V112).toContain("html.sa-lens.sa-light .tb-radio .rd-ctl button:not(.play){color:#6B4E1A;box-shadow:");
  });
  it("«Слушать» — золотая линза: свет, золотой ободок, кольцо шире; идёт выпуск — светится; в «Для чтения» — тёмное золото", () => {
    expect(V112).toContain("html.sa-lens .tb-radio .rd-ctl button.play{position:relative;color:var(--lk-hi);background:radial-gradient(circle at 50% 28%,rgba(240,214,150,0.38),rgba(200,169,110,0.16) 62%,rgba(200,169,110,0.10));");
    expect(V112).toMatch(/html\.sa-lens \.tb-radio \.rd-ctl button\.play\.on\{[^}]*0 0 26px rgba\(232,197,106,0\.35\)\}/);
    expect(V112).toContain("html.sa-lens .tb-radio .rd-ctl button.play::after{inset:-5px;border-color:rgba(214,178,102,0.55)}");
    expect(V112).toContain("html.sa-lens.sa-light .tb-radio .rd-ctl button.play{background:radial-gradient(circle at 50% 28%,rgba(255,255,255,0.95),rgba(176,138,70,0.24) 72%);");
  });
  it("пластинка — в тонком кольце (на блике, не на самой пластинке: у неё ::after — дырочка)", () => {
    expect(V112).toContain('html.sa-lens .tb-radio .rd-sheen::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(rd("ui/radio.jsx")).toContain('.rd-disc::after{content:"";position:absolute;left:50%;top:50%;width:7px;height:7px;');
    expect(sels.some((s) => /\.rd-disc/.test(s))).toBe(false);
  });
  it("вкладки выпусков — капсула с ободком и кольцом (не у ленты с прокруткой), выбранный — плашка с золотым ободком", () => {
    expect(V112).toContain("html.sa-lens .tb-radio .rd-seg{border-color:transparent;box-shadow:inset 0 0 0 1px var(--lk-rim),inset 0 0 18px var(--inner),inset 0 1.5px 0 var(--lk-hl)}");
    expect(V112).toContain('html.sa-lens .tb-radio .rd-seg:not(.many)::after{content:"";position:absolute;inset:-3.5px;border-radius:19.5px;');
    expect(V112).toContain("html.sa-lens .tb-radio .rd-pill{box-shadow:inset 0 0 0 1px rgba(232,201,131,0.62),");
  });
  it("обложка и переключатели — кромка и блик, фон прежний (без своего света: подписи остаются 4,5)", () => {
    expect(V112).toContain("html.sa-lens .tb-radio .rd-air,html.sa-lens .tb-radio .rd-sw{border-color:var(--lk-edge)}");
    const card = sels.filter((s) => /\.rd-(air|sw)$/.test(s));
    expect(card.length).toBeGreaterThan(0);
    for (const r of code(V112).split("}").filter((x) => /\.rd-(air|sw)\{/.test(x))) expect(r, r).not.toMatch(/background/);
  });
  it("«К вопросам» и другие главные — плашки с кольцом, бледная (disabled) — прежняя; ответы и «Слушать» в плейлисте — стекло", () => {
    expect(V112).toContain("html.sa-lens .tb-radio .tb-main:not(:disabled){position:relative;overflow:visible;color:var(--lk-hi);background:radial-gradient(120% 160% at 50% 0%,rgba(232,201,131,0.24),rgba(200,169,110,0.12) 62%);");
    expect(V112).toContain('html.sa-lens .tb-radio .tb-main:not(:disabled)::after{content:"";position:absolute;inset:-3.5px;border-radius:999px;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(V112).toContain("html.sa-lens .tb-radio .rd-q button:not(.ok):not(.bad),html.sa-lens .tb-radio .rd-next li button{background:var(--lk-glass);border-color:transparent;");
  });
  it("прежние: деления фраз, точки выпусков, переключатель, верный и неверный ответ", () => {
    for (const s of sels) {
      expect(s, s).not.toMatch(/\.rd-segs|\.rd-dots|\.rd-sw \.k|button\.ok(?!\))|button\.bad(?!\))/);
    }
  });
});

describe("v112: тексты и метка", () => {
  it("без тире-ритма и эмодзи в радио и правилах; метка — v112", () => {
    for (const f of ["ui/radio.jsx", "ui/home-look.jsx"]) {
      // радио убирает «🎯» в начале разбора вопроса (данные уроков) — это шаблон, не текст на экране
      expect(code(rd(f)).replace("/^🎯\\s*/u", ""), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(dashes(rd("ui/radio.jsx"))).toBe(0);
    expect(dashes(rd("ui/home-look.jsx"))).toBe(0);
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(11[2-9]|1[2-9]\d|[2-9]\d\d)<\/span>/);   // v112 и позже
  });
});
