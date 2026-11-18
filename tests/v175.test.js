// v175 (Доп. 500): видео-знакомство — кнопки линзами, ▶ по центру, видео первым экраном урока, перемотка по фразам и
// полоской, кадр видео обложкой раздела. Владелец (18.11) на снимках с телефона отметил кнопки плеера и нижнюю строку
// обложки: сделать их линзами, «да и все выделенное. Иконку плей нужно отцентровать. Видео мы можем сделать титульным?»;
// «нужно добавить возможность перемотки видео, вдруг что-то не услышал»; «в последнем скрине не видно фото заглавной
// видео».
//   • lib/intro-video.js — правила без интерфейса: фразы, что человек выбрал, где на обложке лицо, кадр раздела;
//   • ui/intro-video.jsx — обложка и плеер; ui/module-menu.jsx — раздел; ui/screens-learning.jsx — когда видео первым.
// Сервер не меняется. Разметки JSX в файле нет (Доп. 482). Плеер в браузере: tools/claude/e2e-v175.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };
const store = {};
const phone = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.localStorage = phone;
const fresh = () => { globalThis.localStorage = phone; for (const k of Object.keys(store)) delete store[k]; };

import { INTRO_VIDEOS, introVideoOf } from "../data/intro-videos.js";
import { SEASONAL_MODULES } from "../data/modules-seasonal";
import { cueIndex, cueBack, cueNext, soundFrom, introSeenOf, markIntroSeen, introFirst, introOfModule, sectionIntro, INTRO_SEEN_KEY,
  posterY, coverPos, sectionPos, COVER_BOX, SECTION_BOX } from "../lib/intro-video";
import { IntroVideoCover, PlayIcon, LENS } from "../ui/intro-video";
import { ModuleMenu } from "../ui/module-menu";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const noop = () => {};
const IDS = Object.keys(INTRO_VIDEOS);
const S0 = SEASONAL_MODULES.find((m) => m.id === "s0"), S1 = SEASONAL_MODULES.find((m) => m.id === "s1");
const pct = (pos) => parseFloat(String(pos).split(" ")[1]) / 100;
// где окажется доля кадра frac в окне w × h при object-position «50% p%» (кадр 9:16 по ширине окна)
const yOf = (frac, w, h, pos) => { const hs = w * 16 / 9; return frac * hs - pct(pos) * (hs - h); };

describe("v175 · версия и журнал", () => {
  it("сборка v175, Дополнение 500, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(175);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 500 — .*\(v175\)/);
    const part = c.slice(c.indexOf("# Дополнение 500")).replace(/\s+/g, " ");
    for (const w of ["да и все выделенное", "Иконку плей нужно отцентровать", "Видео мы можем сделать титульным", "возможность перемотки видео",
      "вдруг что-то не услышал", "не видно фото заглавной видео"]) expect(part, w).toContain(w);
    for (const line of c.slice(c.indexOf("# Дополнение 500")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v175.mjs");
  });
});

describe("v175 · фразы", () => {
  it("у каждого ролика — начала фраз: по порядку, внутри ролика, не меньше дюжины", () => {
    for (const id of IDS) {
      const { cues, dur } = INTRO_VIDEOS[id];
      expect(Array.isArray(cues), id).toBe(true);
      expect(cues.length, id).toBeGreaterThanOrEqual(12);
      cues.forEach((x, i) => { expect(x, id).toBeGreaterThan(0.5); expect(x, id).toBeLessThan(dur); if (i) expect(x, id).toBeGreaterThan(cues[i - 1] + 0.5); });
    }
  });
  it("«назад на фразу»: к началу звучащей; только началась (до 1,2 с) — к предыдущей; до первой — с начала", () => {
    const c = [1, 5, 10];
    expect(cueIndex(c, 0.5)).toBe(-1);
    expect(cueIndex(c, 5)).toBe(1);
    expect(cueIndex(c, 4.96)).toBe(1);   // на границе — уже новая фраза
    expect(cueBack(c, 7)).toBe(4.85);    // чуть раньше начала слова: первый звук не срезается
    expect(cueBack(c, 5.5)).toBe(0.85);
    expect(cueBack(c, 12)).toBe(9.85);
    expect(cueBack(c, 1.3)).toBe(0);
    expect(cueBack(c, 0.4)).toBe(0);
    expect(cueBack([], 7)).toBe(0);
    expect(cueBack(c, 7, 0)).toBe(4.85);
  });
  it("«вперёд на фразу»: к следующей; следующая вот-вот (0,3 с) — через одну; последней нет — null", () => {
    const c = [1, 5, 10];
    expect(cueNext(c, 0)).toBe(0.85);
    expect(cueNext(c, 2)).toBe(4.85);
    expect(cueNext(c, 4.8)).toBe(9.85);
    expect(cueNext(c, 10)).toBe(null);
    expect(cueNext([], 3)).toBe(null);
  });
  it("мусор во входе не ломает: не числа, отрицательные, не по порядку", () => {
    expect(cueBack([10, "x", 5, -1, NaN, null], 7)).toBe(4.85);
    expect(cueNext([10, 5, Infinity], 6)).toBe(9.85);
    expect(cueBack(null, 3)).toBe(0);
    expect(cueBack([1, 5], "abc")).toBe(0);
  });
  it("на настоящем ролике: посреди фразы — к её началу, только началась — к предыдущей", () => {
    const { cues } = INTRO_VIDEOS["s0-1"];
    expect(cueBack(cues, cues[5] + 2)).toBe(Math.round((cues[5] - 0.15) * 100) / 100);
    expect(cueBack(cues, cues[5] + 0.5)).toBe(Math.round((cues[4] - 0.15) * 100) / 100);
    expect(cueNext(cues, cues[5] + 0.5)).toBe(Math.round((cues[6] - 0.15) * 100) / 100);
  });
  it("звук включили посреди ролика: в первые 6 с — с начала («Привет!»), дальше — с начала звучащей фразы", () => {
    const c = [1, 5, 10];
    expect(soundFrom(c, 3)).toBe(0);
    expect(soundFrom(c, 5.9)).toBe(0);
    expect(soundFrom(c, 7)).toBe(4.85);
    expect(soundFrom(c, 10.2)).toBe(9.85);   // без «только началась»: звучит эта фраза — с её начала
  });
});

describe("v175 · видео первым экраном", () => {
  beforeEach(fresh);
  it("урок с роликом открыли с начала, ролик не досмотрен и текст не выбран — видео первым", () => {
    expect(introFirst("s0-1", true, "_Анна_Смирнова")).toBe(true);
    expect(introFirst("s0-1", false, "_Анна_Смирнова")).toBe(false);   // открыли с середины урока
    expect(introFirst("s0-2", true, "_Анна_Смирнова")).toBe(false);    // урок без ролика
    expect(introFirst("nope", true)).toBe(false);
  });
  it("«Читать текстом» и «досмотрел» запоминаются у каждого человека свои", () => {
    expect(markIntroSeen("s0-1", "text", "_Анна_Смирнова")).toBe(true);
    expect(introSeenOf("s0-1", "_Анна_Смирнова")).toBe("text");
    expect(introFirst("s0-1", true, "_Анна_Смирнова")).toBe(false);
    expect(introFirst("s0-1", true, "_Мария_Ким")).toBe(true);   // тот же телефон, другой человек
    expect(JSON.parse(store[INTRO_SEEN_KEY + "_Анна_Смирнова"])).toEqual({ "s0-1": "text" });
    expect(markIntroSeen("m0-1", "end", "_Мария_Ким")).toBe(true);
    expect(introSeenOf("m0-1", "_Мария_Ким")).toBe("end");
    expect(introSeenOf("m0-1", "_Анна_Смирнова")).toBe("");
  });
  it("«досмотрел» не перезаписывается «текстом»; «текст» → «досмотрел» — да", () => {
    markIntroSeen("c0-1", "end", "_А_Б");
    expect(markIntroSeen("c0-1", "text", "_А_Б")).toBe(false);
    expect(introSeenOf("c0-1", "_А_Б")).toBe("end");
    markIntroSeen("bar0-1", "text", "_А_Б");
    expect(markIntroSeen("bar0-1", "end", "_А_Б")).toBe(true);
    expect(introSeenOf("bar0-1", "_А_Б")).toBe("end");
  });
  it("чужое не пишется: урок без ролика, «закрыл» с обложки, испорченная запись", () => {
    expect(markIntroSeen("s0-2", "text", "_А_Б")).toBe(false);
    expect(markIntroSeen("s0-1", "close", "_А_Б")).toBe(false);
    expect(store[INTRO_SEEN_KEY + "_А_Б"]).toBe(undefined);
    store[INTRO_SEEN_KEY + "_В_Г"] = "{битый";
    expect(introSeenOf("s0-1", "_В_Г")).toBe("");
    expect(introFirst("s0-1", true, "_В_Г")).toBe(true);
    store[INTRO_SEEN_KEY + "_В_Г"] = JSON.stringify({ "s0-1": "что-то" });
    expect(introSeenOf("s0-1", "_В_Г")).toBe("");
    expect(markIntroSeen("s0-1", "text", "_В_Г")).toBe(true);
    expect(introSeenOf("s0-1", "_В_Г")).toBe("text");
  });
  it("экран урока: видео первым — только если урок открыт с начала (лентой — всегда с начала)", () => {
    const S = rd("ui/screens-learning.jsx");
    expect(S).toContain("<IntroVideoCover lessonId={lesson.id} a11y={!!T.a11y} autoOpen={!cardMode || resumeFrom === 0} uk={posUk} />");
    const V = rd("ui/intro-video.jsx");
    expect(V).toContain("if (!video || !introFirst(lessonId, autoOpen, uk) || !ensureEl()) return;");
    expect(V).toContain('setMode("title");');
    // досмотрел или ушёл к тексту — запомнить; закрыл ролик с обложки — нет
    expect(V).toContain('if (how === "end" || how === "text") markIntroSeen(lessonId, how, uk);');
    expect(V).toContain('onCloseRef.current(endedOnce.current ? "end" : how);');
  });
  it("первым экраном: со звуком; не дали — без звука и «Включить звук»; не дали и так — ▶", () => {
    const V = rd("ui/intro-video.jsx");
    expect(V).toContain("try { el.muted = false; } catch (e) { /* */ }\n      tryPlay(el).catch(() => { if (!live) return; try { el.muted = true; } catch (e) { /* */ } tryPlay(el).catch(() => {}).then(sync); });");
    expect(V).toMatch(/data-intro-sound=""[\s\S]{0,260}<SoundIcon \/>Включить звук/);
    expect(V).toContain("seekTo(soundFrom(video.cues, el.currentTime || 0));");
    // касание по видео без звука — включить звук, а не пауза
    expect(V).toContain("if (st.muted) unmute(); else toggle();");
  });
  it("сверху первым экраном — «Читать текстом» для «Назад» Telegram и Escape; с обложки — крестик", () => {
    const V = rd("ui/intro-video.jsx");
    expect(V).toMatch(/data-sa-back="" data-intro-x="text" aria-label="Читать текстом" onClick=\{\(e\) => \{ e\.stopPropagation\(\); close\("text"\); \}\}/);
    expect(V).toMatch(/data-sa-back="" data-intro-x="close" aria-label="Закрыть" onClick=\{\(e\) => \{ e\.stopPropagation\(\); close\("close"\); \}\}/);
    expect(V).toContain('close(title ? "text" : "close");');
    expect(V).toContain("К тексту урока");
  });
  it("на сервере (проверки) видео первым экраном не встаёт — только обложка", () => {
    const html = R(h(IntroVideoCover, { lessonId: "s0-1", autoOpen: true, uk: "_Анна_Смирнова" }));
    expect(html).toContain('data-intro-cover="seasonal"');
    expect(html).not.toContain("data-intro-player");
  });
});

describe("v175 · перемотка в плеере", () => {
  it("капсула внизу: назад на фразу, ▶ / ❚❚, вперёд на фразу, полоска с рисками фраз и время под ней", () => {
    const V = rd("ui/intro-video.jsx");
    expect(V).toContain('data-intro-back="" aria-label="Назад на фразу" onClick={phrase(-1)}');
    expect(V).toContain('data-intro-next="" aria-label="Вперёд на фразу" onClick={phrase(1)}');
    expect(V).toContain('data-intro-toggle="" aria-label={st.playing ? "Пауза" : "Смотреть"} onClick={toggle}');
    expect(V).toContain('<div ref={seekRef} data-intro-seek="" role="slider" tabIndex={0} aria-label="Перемотка" aria-valuemin={0} aria-valuemax={Math.round(video.dur || 1)}');
    expect(V).toContain("onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onSeekKey}");
    expect(V).toContain('touchAction: "none"');   // тянуть пальцем, а не листать страницу
    expect(V).toContain("const cues = (video.cues || []).filter((x) => x > 0.5 && x < (video.dur || 1) - 0.5);");
    expect(V).toContain('const to = dir < 0 ? cueBack(video.cues, t) : cueNext(video.cues, t);');
    expect(V).toContain('if (e.key === "ArrowLeft") { e.preventDefault(); seekTo((el.currentTime || 0) - 5); }');
    // пока тянут — перематываем не чаще раза в 60 мс, отпустили — точно туда
    expect(V).toContain("if (now - drag.current.last < 60) return;");
    expect(V).toContain("seekTo(at(e.clientX));");
  });
});

// путь значка: только конечные точки команд (M, L, l, v, c) — по ним углы треугольника
function pathPoints(d) {
  const out = []; let x = 0, y = 0;
  const re = /([MLlvc])([^MLlvcz]*)/g; let m;
  while ((m = re.exec(d))) {
    const n = (m[2].match(/-?\d*\.?\d+/g) || []).map(Number);
    if (m[1] === "M" || m[1] === "L") { x = n[0]; y = n[1]; out.push([x, y]); }
    else if (m[1] === "l") { x += n[0]; y += n[1]; out.push([x, y]); }
    else if (m[1] === "v") { y += n[0]; out.push([x, y]); }
    else if (m[1] === "c") for (let i = 0; i + 5 < n.length; i += 6) { x += n[i + 4]; y += n[i + 5]; out.push([x, y]); }
  }
  return out;
}

describe("v175 · линзы и ▶ по центру", () => {
  it("▶: центр тяжести треугольника — в центре значка (12, 12), без сдвига отступом", () => {
    const html = R(h(PlayIcon, {}));
    const d = /<path d="([^"]+)"/.exec(html)[1];
    expect(d).toBe("M8.6 6.9v10.2c0 .7.8 1.1 1.4.7l8.2-5.1c.6-.4.6-1.2 0-1.6L10 6.2c-.6-.4-1.4 0-1.4.7z");
    const p = pathPoints(d), xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    expect(Math.abs((2 * left + right) / 3 - 12)).toBeLessThan(0.3);   // центр тяжести по горизонтали
    expect(Math.abs((top + bottom) / 2 - 12)).toBeLessThan(0.05);
    expect(rd("ui/intro-video.jsx")).not.toMatch(/paddingLeft|padding: "0 0 0/);
  });
  it("нижняя строка обложки — стеклянная капсула: ▶ — золотая линза с кольцом, подпись, длительность", () => {
    const html = R(h(IntroVideoCover, { lessonId: "spg-0-1" }));
    const bar = /<div aria-hidden="true" data-intro-bar="" style="([^"]+)"/.exec(html);
    expect(bar).not.toBe(null);
    expect(bar[1]).toMatch(/border-radius:999px/);
    expect(bar[1]).toMatch(/backdrop-filter:blur\(12px\)/);
    expect(bar[1]).toMatch(/box-shadow:inset 0 0 0 1px rgba\(214,178,102,0\.34\)/);
    const play = /<span data-intro-play="" style="([^"]+)">([\s\S]*?)<\/span><div/.exec(html);
    expect(play[1]).toMatch(/radial-gradient\(circle at 50% 28%, rgba\(240,214,150,0\.42\)/);
    expect(play[1]).not.toMatch(/padding/);
    expect(play[2]).toContain("data-play-ic");
    expect(play[2]).toContain('data-lens-ring=""');
    expect(html).toMatch(/data-intro-dur="" style="[^"]*box-shadow:inset 0 0 0 1px rgba\(214,178,102,0\.45\)[^"]*">0:54</);
    expect(html).toContain(">Видео-знакомство<");
    expect(html).toContain(">С чего начинается роль<");
  });
  it("линзы плеера: стекло на тёмной подложке, золотой ободок, свет сверху, размытие; у каждой кнопки — кольцо", () => {
    for (const k of ["disc", "play", "main", "soft", "panel"]) {
      expect(LENS[k].background, k).toMatch(/gradient/);
      expect(LENS[k].boxShadow, k).toMatch(/^inset 0 0 0 1px rgba\(2\d\d,\d+,\d+,0\.\d+\)/);   // золотой ободок
      expect(LENS[k].boxShadow, k).toMatch(/inset 0 1\.5px 0 rgba\(255,255,255,0\.\d+\)/);
      expect(LENS[k].backdropFilter, k).toMatch(/^blur\(\d+px\)$/);
      expect(LENS[k].WebkitBackdropFilter, k).toBe(LENS[k].backdropFilter);
    }
    const V = rd("ui/intro-video.jsx");
    for (const [sel, lens] of [['data-intro-x="close"', "disc"], ['data-intro-x="text"', "soft"], ["data-intro-resume", "play"], ["data-intro-sound", "main"], ["data-intro-again", "soft"],
      ["data-intro-done", "main"], ["data-intro-back", "disc"], ["data-intro-toggle", "play"], ["data-intro-next", "disc"]]) {
      const i = V.indexOf(sel);
      expect(i, sel).toBeGreaterThan(0);
      const tail = V.slice(i, V.indexOf("</button>", i));
      expect(tail, sel).toContain("...LENS." + lens);
      expect(tail, sel).toContain("<Ring");
    }
    expect(V).toMatch(/data-intro-controls=""[\s\S]{0,300}\.\.\.LENS\.panel/);
  });
});

describe("v175 · обложка: лицо в кадре", () => {
  it("у каждого ролика — где лицо на кадре: макушка < глаза < подбородок", () => {
    for (const id of IDS) {
      const f = INTRO_VIDEOS[id].face;
      expect(f, id).toBeTruthy();
      expect(f.top, id).toBeGreaterThanOrEqual(0);
      expect(f.top, id).toBeLessThan(f.eyes);
      expect(f.eyes, id).toBeLessThan(f.chin);
      expect(f.chin, id).toBeLessThanOrEqual(0.6);
    }
  });
  it("posterY: точку кадра ставит на нужную высоту; за край кадра не уводит", () => {
    expect(posterY(0.5, 360, 180, 90)).toBe(50);      // 640 × 0,5 − 90 = 230 из 460
    expect(posterY(0.01, 360, 180, 90)).toBe(0);      // выше начала кадра не сдвинуть
    expect(posterY(0.99, 360, 180, 0)).toBe(100);
    expect(posterY(0.5, 100, 400, 10)).toBe(50);      // окно выше кадра — по центру
    expect(posterY(NaN, 360, 180, 10)).toBe(50);
  });
  it("обложка в уроке: подбородок над капсулой, глаза в кадре; у кого голова помещается — целиком", () => {
    const { w, h: hh, bar } = COVER_BOX;
    for (const id of IDS) {
      const v = INTRO_VIDEOS[id], pos = coverPos(v), f = v.face;
      expect(pos, id).toMatch(/^50% \d+%$/);
      expect(yOf(f.chin, w, hh, pos), id).toBeLessThanOrEqual(hh - bar + 3);
      expect(yOf(f.eyes, w, hh, pos), id).toBeGreaterThan(40);
      const head = (f.chin - f.top) * w * 16 / 9;
      if (head <= hh - bar) expect(yOf(f.top, w, hh, pos), id).toBeGreaterThanOrEqual(-3);
    }
    expect(coverPos(null)).toBe("50% 6%");
    expect(coverPos({ face: { top: 0.5, eyes: 0.2, chin: 0.1 } })).toBe("50% 6%");   // нелепые данные — прежний кадр
  });
  it("обложка раздела: глаза — на 50 px от верха, над заголовком раздела (он ниже 84 px)", () => {
    const { w, h: hh, eyes } = SECTION_BOX;
    expect(eyes).toBe(50);
    for (const id of IDS) expect(Math.abs(yOf(INTRO_VIDEOS[id].face.eyes, w, hh, sectionPos(INTRO_VIDEOS[id]))), id).toBeLessThan(eyes + 4);
    for (const id of IDS) expect(yOf(INTRO_VIDEOS[id].face.eyes, w, hh, sectionPos(INTRO_VIDEOS[id])), id).toBeGreaterThan(eyes - 4);
    expect(sectionPos(null)).toBe("50% 20%");
  });
  it("обложка в уроке: кадр стоит по лицу, высота — 72vw", () => {
    for (const id of IDS) {
      const html = R(h(IntroVideoCover, { lessonId: id }));
      expect(html, id).toContain("object-position:" + coverPos(INTRO_VIDEOS[id]));
      expect(html, id).toContain("height:clamp(230px, 72vw, 310px)");
    }
  });
});

describe("v175 · кадр видео — обложкой раздела", () => {
  beforeEach(fresh);
  it("чей кадр: ролик раздела, пока у раздела нет своего фото; фото урока кадр заменяет", () => {
    expect(introOfModule(S0)).toBe(INTRO_VIDEOS["s0-1"]);
    expect(introOfModule(S1)).toBe(null);
    expect(introOfModule(null)).toBe(null);
    expect(introOfModule({ lessons: [null, { id: "x" }, { id: "c0-1" }] })).toBe(INTRO_VIDEOS["c0-1"]);
    expect(sectionIntro(S0, null)).toBe(INTRO_VIDEOS["s0-1"]);
    expect(sectionIntro(S0, { own: false, lesson: "Первый день: нормально бояться" })).toBe(INTRO_VIDEOS["s0-1"]);
    expect(sectionIntro(S0, { own: true, lesson: "" })).toBe(null);   // своё фото раздела — главнее
    expect(sectionIntro(S1, null)).toBe(null);
  });
  it("раздел «Психология первого дня»: обложка — кадр видео, лицо над заголовком; раздел без ролика — как был", () => {
    const html = R(h(ModuleMenu, { mod: S0, onLesson: noop, embedded: true }));
    expect(html).toMatch(/class="tbm-menu covered" data-mod-cover="video"/);
    expect(html).toMatch(new RegExp('<div class="tbm-cover" aria-hidden="true"><img src="/video/intro-seasonal\\.jpg"[^>]*style="object-position:' + sectionPos(INTRO_VIDEOS["s0-1"])));
    const plain = R(h(ModuleMenu, { mod: S1, onLesson: noop, embedded: true }));
    expect(plain).not.toContain('data-mod-cover="video"');
    expect(plain).not.toContain("tbm-cover");
  });
  it("в разделе — та же подсказка у кнопки фото, что и с фото урока: своё фото встанет вместо кадра", () => {
    const M = rd("ui/module-menu.jsx");
    expect(M).toContain('note={poster ? "Сейчас на обложке кадр из видео-знакомства. Своё фото раздела встанет вместо него."');
    expect(M).toContain("const intro = sectionIntro(mod, cov0);");
  });
  it("билет «Начать» на главной кадр видео не берёт: там справа кнопка, лицо оказалось бы под ней", () => {
    expect(rd("ui/now-hero.jsx")).not.toContain("intro-video");
  });
  it("кадры — в приложении: для всех шести роликов есть файл", () => {
    const files = readdirSync("public/video");
    for (const id of IDS) expect(files, id).toContain(INTRO_VIDEOS[id].poster.replace("/video/", ""));
    expect(introVideoOf("s0-1").poster).toBe("/video/intro-seasonal.jpg");
  });
});
