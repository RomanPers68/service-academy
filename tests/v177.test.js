// v177 (Доп. 502): видео-знакомство — кнопки без подмигивания, ровные цифры, ролик заранее. Владелец (18.11) с записью
// экрана: «Обрати внимание, когда нажимаешь на экран, элементы управления подмигивают. Давай это исправим😉 И в скрине,
// цифры стоят не ровно, относительно окантовки цифр. И ещё, я так понимаю видео вшиты в само приложение? Из-за чего оно
// выросло по размеру. Так вот вопрос😉 Мы можем сделать загрузку видео бесшовной, что бы оно грузилось сразу?»
//   • ui/intro-video.jsx — Glass: прозрачность только у заливки и значка, стекло «запотевает» размытием; плеер не
//     проявляется прозрачностью целиком; цифры — Piazzolla (DIGITS); IntroWarm и ролик из памяти в makeIntroVideoEl;
//   • lib/intro-warm.js — ролик заранее (память + Cache Storage), rev в data/intro-videos.js; public/sw.js не стирает;
//   • главная (ui/screens-roleselect.jsx) и раздел (ui/module-menu.jsx) — IntroWarm.
// Сервер не меняется. Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v177.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { brotliDecompressSync } from "node:zlib";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { INTRO_VIDEOS } from "../data/intro-videos.js";
import { MODULES_INDEX } from "../data/modules-index.js";
import { introUk, introLessonOfModule } from "../lib/intro-video";
import { warmIntro, introSrc, introWarmState, introWarmFailed, resetIntroWarm, warmKey, VIDEO_CACHE, WARM_WAIT } from "../lib/intro-warm";
import { IntroVideoCover, IntroWarm, Glass, GLASS, GLASS_T, DIGITS } from "../ui/intro-video";
import { ACCENT_SERIF } from "../ui/styles";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const IDS = Object.keys(INTRO_VIDEOS);
const V = () => rd("ui/intro-video.jsx");
const playerSrc = () => { const s = V(); return s.slice(s.indexOf("export function IntroPlayer(")); };
const styleOf = (html, attr) => { const m = new RegExp("<[a-z]+ [^>]*" + attr + "[^>]*style=\"([^\"]*)\"").exec(html); return m ? m[1] : ""; };
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe("v177 · версия и журнал", () => {
  it("сборка v177, Дополнение 502, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(177);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 502 — .*\(v177\)/);
    const part = c.slice(c.indexOf("# Дополнение 502")).replace(/\s+/g, " ");
    for (const w of ["элементы управления подмигивают", "цифры стоят не ровно, относительно окантовки цифр", "видео вшиты в само приложение",
      "Мы можем сделать загрузку видео бесшовной, что бы оно грузилось сразу?"]) expect(part, w).toContain(w);
    for (const line of c.slice(c.indexOf("# Дополнение 502")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v177.mjs");
  });
});

describe("v177 · кнопки без подмигивания", () => {
  it("погасшая кнопка: размытие 0, заливка и значок прозрачные, касания мимо, чуть сдвинута; у самой кнопки прозрачности нет", () => {
    const html = R(h(Glass, { on: false, away: "translateY(-10px)", type: "button", "data-intro-x": "close" }, "×"));
    const btn = styleOf(html, 'data-glass="dark"');
    expect(btn).toContain("backdrop-filter:blur(0px) saturate(100%)");
    expect(btn).toContain("-webkit-backdrop-filter:blur(0px) saturate(100%)");
    expect(btn).toContain("pointer-events:none");
    expect(btn).toContain("transform:translateY(-10px)");
    expect(btn).toContain("background:transparent");
    expect(btn).not.toMatch(/opacity/);
    expect(html).toMatch(/data-glass-on="0"/);
    expect(styleOf(html, "data-glass-skin")).toMatch(/opacity:0;transition:opacity \.35s ease/);
    expect(styleOf(html, "data-glass-face")).toMatch(/opacity:0;transition:opacity \.35s ease/);
  });
  it("на экране: стекло 16 px, заливка с кромкой и значок видны, без сдвига; переход — размытие и сдвиг за 0,35 с", () => {
    const html = R(h(Glass, { on: true, kind: "bubble", away: "scale(0.94)", type: "button" }, "▶"));
    const btn = styleOf(html, 'data-glass="bubble"');
    expect(btn).toContain("backdrop-filter:blur(16px) saturate(180%)");
    expect(btn).toContain("pointer-events:auto");
    expect(btn).not.toMatch(/transform:/);
    expect(btn).toContain("transition:-webkit-backdrop-filter .35s ease, backdrop-filter .35s ease, transform .35s cubic-bezier(.2,.7,.3,1)");
    expect(btn).not.toMatch(/opacity/);
    const skin = styleOf(html, "data-glass-skin");
    expect(skin).toContain("background:" + GLASS.bubble.background);
    expect(skin).toContain("box-shadow:" + GLASS.bubble.boxShadow);
    expect(skin).toMatch(/opacity:1/);
    expect(styleOf(html, "data-glass-face")).toMatch(/opacity:1/);
  });
  it("«уменьшить движение»: без сдвига и без перехода transform, 0,3 с", () => {
    const html = R(h(Glass, { on: false, calm: true, away: "translateY(12px)", as: "div" }, "x"));
    const box = styleOf(html, 'data-glass="dark"');
    expect(box).not.toMatch(/transform/);
    expect(box).toMatch(/transition:-webkit-backdrop-filter \.3s ease, backdrop-filter \.3s ease$/);
    expect(styleOf(html, "data-glass-face")).toContain("transition:opacity .3s ease");
    expect(GLASS_T).toEqual({ show: ".35s ease", calm: ".3s ease", move: ".35s cubic-bezier(.2,.7,.3,1)" });
  });
  it("у плеера нигде нет прозрачности: ни у кнопок, ни у обёрток, ни у самого плеера — только внутри Glass", () => {
    const P = playerSrc();
    expect(P).not.toMatch(/opacity/);
    expect(P).not.toContain("const fade = ");
    expect(P).not.toMatch(/\.\.\.GLASS\./);
    // все кнопки и капсула — Glass
    for (const a of ['data-intro-x="text"', 'data-intro-x="close"', 'data-intro-mute=""', 'data-intro-sound=""', 'data-intro-back=""', 'data-intro-toggle=""', 'data-intro-next=""',
      'data-intro-again=""', 'data-intro-done=""', 'data-intro-controls=""']) {
      const i = P.indexOf(a), at = P.lastIndexOf("<Glass", i);
      expect(i, a).toBeGreaterThan(0);
      expect(at, a).toBeGreaterThan(P.lastIndexOf("</Glass>", i));
      expect(P.slice(at, i), a).not.toMatch(/<(button|div|span)\b/);
    }
  });
  it("плеер открывается: проявляются чёрная подложка и видео, а не весь плеер; кнопки — через кадр своим стеклом", () => {
    const P = playerSrc();
    expect(P).toContain('data-lens-dark="" role="dialog" aria-modal="true" aria-label="Видео-знакомство"\n      onClick={keep}');
    expect(P).not.toMatch(/aria-label="Видео-знакомство" className="sa-fadein"/);
    expect(P).toContain('<div aria-hidden="true" data-intro-bg="" className="sa-fadein" style={{ position: "absolute", inset: 0, background: "#000" }} />');
    expect(P).toContain('data-intro-stage="" className="sa-fadein"');
    expect(P).toContain("const [shown, setShown] = React.useState(false);");
    expect(P).toContain("const vis = ui && shown;");
    expect(P).toContain("const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(true)); });");
    expect(P).toContain("const glass = (away) => ({ on: vis, calm, away });");
  });
});

describe("v177 · цифры ровно", () => {
  // woff2: таблицы head, hhea, OS/2 (они без преобразования) — из сжатого brotli потока
  const TAGS = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE",
    "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort",
    "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"];
  function metrics(file) {
    const b = readFileSync(file); let o = 48;
    const num = b.readUInt16BE(12), packed = b.readUInt32BE(20);
    const b128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const c = b[o++]; v = (v << 7) | (c & 0x7f); if (!(c & 0x80)) return v; } return v; };
    const dir = [];
    for (let i = 0; i < num; i++) {
      const f = b[o++]; let tag = TAGS[f & 63]; if ((f & 63) === 63) { tag = b.toString("latin1", o, o + 4); o += 4; }
      const tv = f >> 6; let len = b128();
      if ((tag === "glyf" || tag === "loca") ? tv === 0 : tv !== 0) len = b128();
      dir.push({ tag, len });
    }
    const data = brotliDecompressSync(b.subarray(o, o + packed));
    let p = 0; const T = {}; for (const d of dir) { T[d.tag] = data.subarray(p, p + d.len); p += d.len; }
    const os2 = T["OS/2"], hh = T.hhea;
    return { upm: T.head.readUInt16BE(18), asc: hh.readInt16BE(4), desc: hh.readInt16BE(6), gap: hh.readInt16BE(8), tAsc: os2.readInt16BE(68), tDesc: os2.readInt16BE(70),
      useTypo: !!(os2.readUInt16BE(62) & 128), cap: os2.readInt16BE(88) };
  }
  it("цифры — Piazzolla: ровные (lining) и одной ширины (tabular), как цифры во всём приложении", () => {
    expect(DIGITS).toEqual({ fontFamily: ACCENT_SERIF, fontWeight: 700, fontVariantNumeric: "lining-nums tabular-nums" });
    expect(ACCENT_SERIF).toMatch(/^'Piazzolla'/);
    expect(rd("index.html")).toContain('font-family:"Piazzolla";font-style:normal;font-weight:700');
  });
  it("«0:55» на обложке: Piazzolla, строка 18 px, сверху 2 px, снизу 4 px — середина цифр по середине рамки", () => {
    const html = R(h(IntroVideoCover, { lessonId: "spg-0-1" }));
    const st = styleOf(html, "data-intro-dur");
    expect(st).toContain("font-family:'Piazzolla', Georgia, serif;font-weight:700;font-variant-numeric:lining-nums tabular-nums;font-size:13px;line-height:18px");
    expect(st).toContain("padding:2px 9px 4px");
    expect(html).toMatch(/data-intro-dur="" style="[^"]*">0:55</);
  });
  it("подъём на 1 px — по размерам шрифта: середина цифр Piazzolla в строке 18 px на 1 px ниже середины строки", () => {
    const m = metrics("public/assets/fonts/piazzolla-latin-700-normal.woff2");
    // одинаково на iPhone и в Chrome: hhea = typo, USE_TYPO_METRICS
    expect(m).toMatchObject({ upm: 1000, asc: 1110, desc: -310, gap: 0, tAsc: 1110, tDesc: -310, useTypo: true });
    const fs = 13, lh = 18, half = (lh - fs * (m.asc - m.desc) / m.upm) / 2, base = half + fs * m.asc / m.upm;
    const mid = base - fs * (m.cap / m.upm) / 2;   // цифры Piazzolla — почти высотой с заглавную
    const off = mid - lh / 2;
    expect(off).toBeGreaterThan(0.75);
    expect(off).toBeLessThan(1.25);
    expect(Math.abs(off - (4 - 2) / 2)).toBeLessThanOrEqual(0.25);   // padding 2 / 4 возвращает цифры на середину
  });
  it("время в плеере — тоже Piazzolla, ровно по середине капсулы", () => {
    const P = playerSrc();
    expect(P).toContain('const time = { flexShrink: 0, ...DIGITS, fontSize: 13, lineHeight: "18px", paddingBottom: 2 };');
    expect(P).toContain('<span ref={nowRef} data-intro-now="" style={{ ...time, minWidth: 30, color: INK }}>0:00</span>');
    expect(P).toContain('<span ref={leftRef} data-intro-left="" style={{ ...time, minWidth: 34, textAlign: "right", color: "rgba(255,255,255,0.78)" }}>');
    expect(P).not.toMatch(/data-intro-(now|left)="" style=\{\{[^}]*fontFamily: SERIF/);
  });
});

describe("v177 · ролик заранее: данные", () => {
  it("rev ролика — первые 8 знаков SHA-256 файла: заменили ролик — поменяйте rev", () => {
    for (const id of IDS) {
      const v = INTRO_VIDEOS[id];
      expect(v.rev, id).toBe(createHash("sha256").update(readFileSync("public" + v.src)).digest("hex").slice(0, 8));
      expect(warmKey(v), id).toBe(v.src + "?rev=" + v.rev);
    }
    expect(new Set(IDS.map((id) => INTRO_VIDEOS[id].rev)).size).toBe(IDS.length);
  });
  it("сервис-воркер не стирает ролики, взятые заранее, и по-прежнему пропускает ролики мимо себя", () => {
    const W = rd("public/sw.js");
    expect(W).toContain('const VIDEO = "' + VIDEO_CACHE + '";');
    expect(W).toContain("const keep = new Set([SHELL, ASSETS, IMAGES, VIDEO]);");
    expect(W).toContain('if (u.origin === self.location.origin && u.pathname.startsWith("/video/") && !isImage(u)) return;');
    expect(W).toContain('const VERSION = "sa-sw-v1";');
    expect(WARM_WAIT).toBe(1200);
  });
  it("чей телефон — как место в уроке; урок раздела с роликом", () => {
    expect(introUk({ name: "Анна", surname: "Смирнова" })).toBe("_Анна_Смирнова");
    expect(introUk({ name: "Роман" })).toBe("_Роман_");
    expect(introUk(null)).toBe("");
    expect(rd("ui/screens-learning.jsx")).toContain('const posUk = profile ? "_" + profile.name + "_" + (profile.surname || "") : "";');
    const first = Object.fromEntries(Object.entries(MODULES_INDEX).map(([role, mods]) => [role, introLessonOfModule(mods[0])]));
    expect(first).toEqual({ bar: "bar0-1", seasonal: "s0-1", core: "c0-1", manager: "m0-1", service_manager: "sm0-1", spg: "spg-0-1" });
    expect(introLessonOfModule(MODULES_INDEX.seasonal[1])).toBe("");
    expect(introLessonOfModule(null)).toBe("");
  });
});

describe("v177 · ролик заранее: как берём", () => {
  const v = INTRO_VIDEOS["s0-1"];
  let calls, store, fetchImpl;
  const abs = (k) => new URL(k, "http://localhost/").href;
  const okBody = () => new Response(new Blob([new Uint8Array(2048)], { type: "video/mp4" }), { status: 200, headers: { "Content-Type": "video/mp4" } });
  beforeEach(() => {
    resetIntroWarm();
    calls = { fetch: [], put: [], del: [] };
    store = new Map();
    fetchImpl = async () => okBody();
    globalThis.fetch = (url, opts) => { calls.fetch.push({ url, opts }); return fetchImpl(url, opts); };
    globalThis.caches = { open: async (name) => { calls.open = name; return {
      match: async (k) => (store.has(abs(k)) ? store.get(abs(k)).clone() : undefined),
      put: async (k, r) => { calls.put.push(abs(k)); store.set(abs(k), r); },
      delete: async (k) => { const u = typeof k === "string" ? abs(k) : k.url; calls.del.push(u); return store.delete(u); },
      keys: async () => [...store.keys()].map((url) => ({ url })) }; } };
    try { Object.defineProperty(globalThis.navigator, "connection", { configurable: true, value: undefined }); } catch (e) { /* */ }
  });
  const settle = async (n = 6) => { for (let k = 0; k < n; k++) await tick(5); };

  it("нет в телефоне — ждём своей очереди, качаем один раз целиком (no-cache), кладём в телефон, плеер берёт из памяти", async () => {
    const off = warmIntro(v, { wait: 30 });
    expect(introWarmState(v)).toBe("cache");
    await settle(2);
    expect(introWarmState(v)).toBe("wait");
    expect(calls.fetch.length).toBe(0);
    await tick(60); await settle();
    expect(calls.fetch.length).toBe(1);
    expect(calls.fetch[0].url).toBe(v.src);
    expect(calls.fetch[0].opts.cache).toBe("no-cache");
    expect(introWarmState(v)).toBe("ready");
    expect(introSrc(v)).toMatch(/^blob:/);
    expect(calls.open).toBe(VIDEO_CACHE);
    expect(calls.put).toEqual([abs(warmKey(v))]);
    warmIntro(v, { wait: 0 })();
    off();
    expect(introWarmState(v)).toBe("ready");   // готовое остаётся, когда экран ушёл
    expect(calls.fetch.length).toBe(1);
  });
  it("есть в телефоне — сразу из него, без сети", async () => {
    store.set(abs(warmKey(v)), okBody());
    warmIntro(v, { wait: 0 });
    await settle();
    expect(introWarmState(v)).toBe("ready");
    expect(calls.fetch.length).toBe(0);
    expect(introSrc(v)).toMatch(/^blob:/);
  });
  it("в телефоне прежняя версия ролика (другой rev) — не берём её и стираем", async () => {
    store.set(abs(v.src + "?rev=00000000"), okBody());
    warmIntro(v, { wait: 0 });
    await settle(8);
    expect(calls.del).toContain(abs(v.src + "?rev=00000000"));
    expect(calls.fetch.length).toBe(1);
    expect([...store.keys()]).toEqual([abs(warmKey(v))]);
  });
  it("экономия трафика (Save-Data, 2G) — не берём", async () => {
    Object.defineProperty(globalThis.navigator, "connection", { configurable: true, value: { saveData: true } });
    warmIntro(v, { wait: 0 });
    await settle();
    expect(introWarmState(v)).toBe("off");
    expect(calls.fetch.length).toBe(0);
    expect(introSrc(v)).toBe(v.src);
    resetIntroWarm();
    Object.defineProperty(globalThis.navigator, "connection", { configurable: true, value: { effectiveType: "slow-2g" } });
    warmIntro(v, { wait: 0 });
    await settle();
    expect(calls.fetch.length).toBe(0);
  });
  it("экран ушёл до очереди (или в билете уже другой урок) — не качаем; вернулся — берём снова", async () => {
    const off = warmIntro(v, { wait: 40 });
    await settle(2);
    off();
    await tick(70); await settle();
    expect(calls.fetch.length).toBe(0);
    expect(introWarmState(v)).toBe("");
    warmIntro(v, { wait: 0 });
    await settle();
    expect(calls.fetch.length).toBe(1);
    expect(introWarmState(v)).toBe("ready");
  });
  it("два экрана ждут один ролик — бросаем, только когда ушли оба", async () => {
    const a = warmIntro(v, { wait: 40 }), b = warmIntro(v, { wait: 40 });
    await settle(2);
    a();
    expect(introWarmState(v)).toBe("wait");
    b();
    expect(introWarmState(v)).toBe("");
  });
  it("открыли, пока качается, — плеер из сети, скачивание обрываем (дважды не качаем)", async () => {
    let aborted = false;
    fetchImpl = (url, opts) => new Promise((res, rej) => { opts.signal.addEventListener("abort", () => { aborted = true; rej(new DOMException("aborted", "AbortError")); }); });
    warmIntro(v, { wait: 0 });
    await settle();
    expect(introWarmState(v)).toBe("net");
    expect(introSrc(v)).toBe(v.src);
    await settle();
    expect(aborted).toBe(true);
    expect(introWarmState(v)).toBe("");
    expect(calls.put.length).toBe(0);
  });
  it("сервер не отдал ролик — в этот запуск не берём, плеер из сети", async () => {
    fetchImpl = async () => new Response("нет", { status: 404 });
    warmIntro(v, { wait: 0 });
    await settle();
    expect(introWarmState(v)).toBe("off");
    expect(introSrc(v)).toBe(v.src);
    warmIntro(v, { wait: 0 });
    await settle();
    expect(calls.fetch.length).toBe(1);
  });
  it("телефон не смог играть заготовку — дальше из сети, копию в телефоне стираем", async () => {
    warmIntro(v, { wait: 0 });
    await settle();
    expect(introSrc(v)).toMatch(/^blob:/);
    introWarmFailed(v);
    await settle(3);
    expect(introWarmState(v)).toBe("off");
    expect(introSrc(v)).toBe(v.src);
    expect(calls.del).toContain(abs(warmKey(v)));
  });
  it("без fetch и Blob (старый телефон, сервер) — ничего не делаем", () => {
    const f = globalThis.fetch;
    globalThis.fetch = undefined;
    try { const off = warmIntro(v); expect(typeof off).toBe("function"); off(); expect(introWarmState(v)).toBe(""); expect(introSrc(v)).toBe(v.src); }
    finally { globalThis.fetch = f; }
    expect(introSrc(null)).toBe("");
  });
});

describe("v177 · ролик заранее: где берём", () => {
  it("главная: следующий урок с роликом — IntroWarm рядом с фото заранее", () => {
    const S = rd("ui/screens-roleselect.jsx");
    expect(S).toContain('import { IntroWarm } from "./intro-video";');
    expect(S).toMatch(/<PhotosAhead first=\{next \? next\.mod : null\}[^\n]*\/>\n[\s\S]{0,400}\{next \? <IntroWarm lessonId=\{next\.lesson\.id\} uk=\{introUk\(profile\)\} \/> : null\}/);
  });
  it("раздел с видео-знакомством (текущая страница трека) — IntroWarm", () => {
    const M = rd("ui/module-menu.jsx");
    expect(M).toContain("{!passive && introLessonOfModule(mod) ? <IntroWarm lessonId={introLessonOfModule(mod)} uk={introUk(profile)} /> : null}");
  });
  it("обложка в уроке: ролик ещё не смотрел и не первым экраном — IntroWarm; досмотрел — нет", () => {
    const S = V();
    expect(S).toContain("const warm = !!video && !introFirst(lessonId, autoOpen, uk) && !introSeenOf(lessonId, uk);");
    expect(S).toContain("{warm && !mode ? <IntroWarm lessonId={lessonId} uk={uk} /> : null}");
    expect(R(h(IntroWarm, { lessonId: "s0-1", uk: "_t" }))).toBe("");   // ничего не рисует
    expect(R(h(IntroVideoCover, { lessonId: "s0-1", uk: "_t" }))).toContain('data-intro-cover="seasonal"');
  });
  it("IntroWarm: экран ушёл — отпускает ролик (недокачанное бросаем)", () => {
    const S = V();
    expect(S).toContain("if (!v || introSeenOf(lessonId, uk)) return undefined;\n    return warmIntro(v);");
  });
  it("плеер: ролик из памяти (data-intro-from=\"warm\"), нет — из сети; заготовка не пошла — сам переходит на сеть", () => {
    const S = V();
    expect(S).toContain("const src = introSrc(video) || video.src;");
    expect(S).toContain('v.setAttribute("data-intro-src", video.src);');
    expect(S).toContain('v.setAttribute("data-intro-from", src === video.src ? "net" : "warm");');
    expect(S).toContain('if (el.error && el.getAttribute("data-intro-from") === "warm") { fromNet(); return; }');
    expect(S).toMatch(/const fromNet = \(\) => \{\n\s+const at = el\.currentTime \|\| 0;\n\s+introWarmFailed\(video\);/);
  });
});
