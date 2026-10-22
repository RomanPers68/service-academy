// v70 (Доп. 383): «Приглашение» в тон плиток, пламя в строке напарника.
// Владелец (22.10): «может всё-таки эту кнопку сделаем чуть светлее, теплее? В тон других кнопок?» → из показанного —
// «тон, как у соседних плиток, но контуры и текстура как есть сейчас»; «свечка некрасивая, в обеих темах одинаковая
// палитра» → «давай пламя». Свободное место внизу главной — «оставим как есть».
// Вид в браузере — tools/claude/e2e-v70.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: () => null, length: 0 };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), head: { appendChild() {} }, getElementById: () => null };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { NowInvitation } from "../ui/now-hero";
import { Flame } from "../ui/day-emblems";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const before = { mode: "before", mins: 26, from: 11, to: 24, title: "Разминка перед сменой", sub: "3 вопроса · 2 мин — освежишь главное", cta: "Начать", action: "warmup", icon: "clock" };
const TONE = "linear-gradient(160deg, rgba(226,186,116,0.18) 0%, rgba(226,186,116,0.10) 58%, rgba(226,186,116,0.15) 100%)";
const masked = (html) => { const at = html.indexOf("mask:radial-gradient"); return html.slice(html.lastIndexOf("<div", at), html.indexOf(">", at)); };

describe("v70: «Приглашение» — тон плиток, контуры и текстура прежние", () => {
  it("тёмная: фон — тёплое стекло плиток диагональю и свет из угла; чёрного фона нет", () => {
    const html = R(h(NowInvitation, { ctx: before, a11y: false, on: {} }));
    const card = masked(html);
    expect(card).toContain("radial-gradient(120% 90% at 20% 0%, rgba(214,178,102,0.10), transparent 60%), " + TONE);
    expect(card).not.toContain("#0D0904");
    expect(rd("ui/now-hero.jsx")).not.toContain("linear-gradient(160deg,#211809 0%,#0D0904 58%,#171009 100%)");
  });
  it("тон — тот же, что у плиток главной (saInner: rgba(226,186,116,0.11)), в среднем по диагонали — около 0,14", () => {
    expect(rd("ui/screens-roleselect.jsx")).toContain(': "rgba(226,186,116,0.11)";');
    const a = [...TONE.matchAll(/rgba\(226,186,116,([0-9.]+)\)/g)].map((m) => Number(m[1]));
    expect(a).toEqual([0.18, 0.1, 0.15]);
    expect((a[0] + a[1] + a[2]) / 3).toBeGreaterThan(0.11);
    expect((a[0] + a[1] + a[2]) / 3).toBeLessThan(0.16);
  });
  it("контуры — как были: золотая кромка, кольца у вырезов, рамка внутри, перфорация, тень", () => {
    const html = R(h(NowInvitation, { ctx: before, a11y: false, on: {} }));
    expect(masked(html)).toContain("box-shadow:inset 0 0 0 1px rgba(214,178,102,0.38)");
    expect(masked(html)).toContain("radial-gradient(circle at calc(100% - 100px) 0%, transparent 9.1px, rgba(214,178,102,0.38) 9.6px");
    expect(html).toContain("border:1px solid rgba(214,178,102,0.42)");
    expect(html).toContain("border-left:2px dotted rgba(214,178,102,0.45)");
    expect(html).toContain("box-shadow:0 10px 16px rgba(0,0,0,0.6)");
  });
  it("линза — стекло кнопки AI прямо поверх карточки (без подложки); светлая тема — бумага и сургуч, как были", () => {
    const html = R(h(NowInvitation, { ctx: before, a11y: false, on: {} }));
    const at = html.indexOf("data-now-lens"), lens = html.slice(at, html.indexOf(">", at));
    expect(lens).toContain("background:rgba(200,169,110,0.12)");
    expect(lens).toContain("box-shadow:inset 0 0 0 1px rgba(214,178,102,0.45), inset 0 0 18px rgba(255,230,170,0.12), inset 0 1.5px 0 rgba(255,255,255,0.18)");
    const light = R(h(NowInvitation, { ctx: before, a11y: true, on: {} }));
    expect(light).toContain("#FFFDF8");
    expect(light).toContain("data-now-seal");
    expect(masked(light)).not.toContain("226,186,116");
  });
});

describe("v70: строка напарника — пламя, как у серии на табличке", () => {
  it("вместо свечи без цветов темы — пламя (ui/day-emblems.jsx Flame), горит", () => {
    const app = rd("App.jsx");
    expect(app).toContain('import { Flame } from "./ui/day-emblems";');
    expect(app).not.toContain("<Candle s={16} lit />");
    expect(app).not.toContain('from "./ui/table-bits"');
    const line = app.slice(app.indexOf('className="sa-pairline"'), app.indexOf("{pairLine.text}"));
    expect(line).toContain("<Flame lit s={18} a11y={a11y} />");
  });
  it("пламя — в цветах своей темы: тёмная и «Для чтения» — разные", () => {
    const dark = R(h(Flame, { lit: true, s: 18, a11y: false })), light = R(h(Flame, { lit: true, s: 18, a11y: true }));
    expect(dark).toContain('data-emb="flame" data-lit="1"');
    expect(dark).toContain("#FFE9AE");
    expect(light).toContain("#FFD27A");
    expect(dark).not.toBe(light);
  });
});

describe("v70: метка и журнал", () => {
  it("«сборка v70», «Дополнение 383»", () => {
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v70</span>");
    expect(rd("CHANGES.md")).toContain("# Дополнение 383 — «Приглашение» в тон плиток, пламя в строке напарника (v70)");
  });
});
