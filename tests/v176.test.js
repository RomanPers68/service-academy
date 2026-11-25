// v176 (Доп. 501): видео-знакомство — новые ролики и плеер по образцу iPhone. Владелец (18.11): «Я тебе скинул
// обновленные видео, которые нужно вставить. <…> Вместо «рассыпалось», «работает как часы». Обновишь титры?» — и со
// снимком плеера iPhone: «Давай сделаем линзы без дополнительного обруча, более прозрачными. И что бы видео было на весь
// экран, и после начала, все элементы изчезали, с аккуратной анимацией. И так же мне нравился первый твой вариант кнопки
// запуска и подписи видео. <…> И да, с дополнительной кнопкой динамика, что бы человек при желании выключил звук».
//   • public/video, data/intro-videos.js — шесть новых роликов: длительность, начала фраз; tools/video — новая реплика;
//   • lib/intro-video.js — fillSize: видео на весь экран, но вшитые титры целиком;
//   • ui/intro-video.jsx — стекло без колец, кнопки гаснут, динамик; обложка в уроке — как в v174.
// Сервер не меняется. Разметки JSX в файле нет (Доп. 482). Плеер в браузере: tools/claude/e2e-v176.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync, existsSync } from "node:fs";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { INTRO_VIDEOS } from "../data/intro-videos.js";
import { fillSize, FILL_SAFE } from "../lib/intro-video";
import { IntroVideoCover, GLASS, GLASS_T, HIDE_MS } from "../ui/intro-video";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const IDS = Object.keys(INTRO_VIDEOS);
// длительность mp4 по заголовку mvhd (секунды)
function mp4Duration(buf) {
  const i = buf.indexOf(Buffer.from("mvhd"));
  if (i < 0) return -1;
  const v = buf[i + 4];
  if (v === 1) return Number(buf.readBigUInt64BE(i + 4 + 4 + 16 + 4)) / buf.readUInt32BE(i + 4 + 4 + 16);
  return buf.readUInt32BE(i + 4 + 4 + 8 + 4) / buf.readUInt32BE(i + 4 + 4 + 8);
}

describe("v176 · версия и журнал", () => {
  it("сборка v176, Дополнение 501, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(176);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 501 — .*\(v176\)/);
    const part = c.slice(c.indexOf("# Дополнение 501")).replace(/\s+/g, " ");
    for (const w of ["обновленные видео, которые нужно вставить", "Вместо «рассыпалось», «работает как часы»", "линзы без дополнительного обруча, более прозрачными",
      "что бы видео было на весь экран", "все элементы изчезали, с аккуратной анимацией", "первый твой вариант кнопки запуска и подписи видео",
      "с дополнительной кнопкой динамика"]) expect(part, w).toContain(w);
    for (const line of c.slice(c.indexOf("# Дополнение 501")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v176.mjs");
  });
});

describe("v176 · новые ролики", () => {
  it("длительности новых роликов — в данных", () => {
    expect(Object.fromEntries(IDS.map((id) => [INTRO_VIDEOS[id].role, INTRO_VIDEOS[id].dur])))
      .toEqual({ spg: 55, seasonal: 48, core: 50, manager: 53, service_manager: 54, bar: 49 });   // v194: новый ролик сервис-менеджера — 52 с (был 55); v196: ещё новее — 54 с
  });
  it("«Начнём!» — за 1–2,5 с до конца ролика: после него пауза, ролик не обрывается на слове", () => {
    for (const id of IDS) {
      const v = INTRO_VIDEOS[id];
      const d = mp4Duration(readFileSync("public" + v.src));
      const last = v.cues[v.cues.length - 1];
      expect(d - last, id).toBeGreaterThan(1);
      expect(d - last, id).toBeLessThan(2.5);
    }
  });
  it("до «Начнём!» начала фраз — прежние (звук там тот же); у сервис-менеджера новый конец", () => {
    const old = {   // v175
      "spg-0-1": [1.05, 2.12, 4.82, 9.09, 11.99, 17.99, 20.64, 22.13, 24.06, 26.61, 30.8, 36.21, 38.6, 45.62, 46.93, 50.03],
      "bar0-1": [1.05, 1.94, 4.44, 6.25, 11.07, 18.01, 19.75, 23.53, 27.75, 31.72, 39, 42.94],
      // v194 (Доп. 519): ролик сервис-менеджера заменён целиком (темп быстрее) — его начала фраз сверяет v194.test.js
    };
    for (const [id, c] of Object.entries(old)) expect(INTRO_VIDEOS[id].cues.slice(0, c.length), id).toEqual(c);
    expect(INTRO_VIDEOS["sm0-1"].cues.slice(-3)).toEqual([47.75, 50.49, 52.88]);   // «Ты в отпуске…», «Значит…», «Начнём!» (v196)
  });
  it("реплика сервис-менеджера: «а всё работает как часы» — в титрах и сценарии", () => {
    const ch = rd("tools/video/chunks/service_manager_chunks.txt");
    expect(ch).toContain("Ты в отпуске,\nа всё работает как часы.\n!Значит, система работает.");
    expect(ch).not.toContain("рассыпалось");
    const sc = rd("tools/video/scripts.md");
    expect(sc).toContain("Ты в отпуске, а всё работает как часы. Значит, система работает.");
    expect(sc).toContain("Хостес v5, Новичок v4, Ядро v6, Менеджер v4, Сервис-менеджер v6");
  });
  it("tools/video: compare.py — что поменялось после пересъёмки; как вставить пересъёмку — в README", () => {
    expect(existsSync("tools/video/compare.py")).toBe(true);
    const c = rd("tools/video/compare.py");
    expect(c).toContain("def dtw(A, B, band=250):");
    expect(c).toContain("import fa");
    const r = rd("tools/video/README.md");
    expect(r).toContain("| `compare.py` |");
    expect(r).toContain("## Ролик пересняли (v176, Доп. 501)");
    expect(existsSync("tools/video/__pycache__")).toBe(false);
  });
});

describe("v176 · видео на весь экран", () => {
  const visible = (W, H) => { const { w, h } = fillSize(W, H); return { w, h, fw: Math.min(1, W / w), fh: Math.min(1, H / h) }; };
  it("iPhone, Telegram на весь экран (393×852): по ширине без полей, сверху и снизу — по 38 px, титры целиком", () => {
    const s = visible(393, 852);
    expect(s.w).toBeCloseTo(436.7, 1);
    expect(s.h).toBeCloseTo(776.3, 1);
    expect((852 - s.h) / 2).toBeLessThan(40);
    expect(s.fw).toBeGreaterThanOrEqual(FILL_SAFE.w - 1e-3);
  });
  it("с шапкой Telegram (393×760) и на iPhone SE (375×667) — кадр закрывает весь экран", () => {
    for (const [W, H] of [[393, 760], [375, 667]]) {
      const { w, h } = fillSize(W, H);
      expect(w, W + "×" + H).toBeGreaterThanOrEqual(W - 0.05);
      expect(h, W + "×" + H).toBeGreaterThanOrEqual(H - 0.05);
    }
  });
  it("повёрнутый телефон: почти весь кадр — обрезано не больше 8 % высоты", () => {
    const s = visible(852, 393);
    expect(s.fh).toBeGreaterThanOrEqual(FILL_SAFE.h - 1e-3);
    expect(s.w).toBeLessThan(852);
  });
  it("никогда не меньше «вписать целиком» и не больше, чем позволяют титры", () => {
    for (const [W, H] of [[320, 568], [360, 800], [390, 844], [430, 932], [768, 1024], [1280, 720], [100, 100]]) {
      const { w, h } = fillSize(W, H);
      const contain = Math.min(W / 720, H / 1280);
      expect(w / 720, W + "×" + H).toBeGreaterThanOrEqual(contain - 1e-3);
      expect(W / w, W + "×" + H).toBeGreaterThanOrEqual(FILL_SAFE.w - 1e-3);
      expect(H / h, W + "×" + H).toBeGreaterThanOrEqual(Math.min(1, FILL_SAFE.h) - 1e-3);
      expect(Math.abs(w / h - 720 / 1280), W + "×" + H).toBeLessThan(0.002);
    }
    expect(fillSize(0, 800)).toEqual({ w: 0, h: 0 });
    expect(fillSize(390, NaN)).toEqual({ w: 0, h: 0 });
  });
  it("плеер ставит кадр по fillSize и пересчитывает при повороте и когда узнал размер ролика", () => {
    const V = rd("ui/intro-video.jsx");
    expect(V).toContain("const { w, h } = fillSize(stage.clientWidth, stage.clientHeight, el.videoWidth || 720, el.videoHeight || 1280);");
    expect(V).toContain('el.addEventListener("loadedmetadata", fit);');
    expect(V).toContain('window.addEventListener("resize", fit);');
    // v177 (Доп. 502): видео проявляется само (sa-fadein), а не весь плеер
    expect(V).toContain('<div ref={stageRef} data-intro-stage="" className="sa-fadein" onClick={stageTap} style={{ position: "absolute", inset: 0, overflow: "hidden" }} />');
  });
});

describe("v176 · кнопки гаснут", () => {
  it("первый раз — через 3,2 с (успеть увидеть «Читать текстом»), потом — через 2,6 с", () => {
    expect(HIDE_MS).toEqual({ first: 3200, next: 2600 });
  });
  it("плавно: прозрачность и лёгкий сдвиг к краю за 0,35 с; «уменьшить движение» — одной прозрачностью", () => {
    const V = rd("ui/intro-video.jsx");
    // v177 (Доп. 502): гаснут не прозрачностью обёртки, а своим стеклом (Glass): размытие, заливка и значок — за те же
    // 0,35 с («уменьшить движение» — 0,3 с, без сдвига), сдвиг — тот же
    expect(GLASS_T).toEqual({ show: ".35s ease", calm: ".3s ease", move: ".35s cubic-bezier(.2,.7,.3,1)" });
    expect(V).toContain('transition: "-webkit-backdrop-filter " + t + ", backdrop-filter " + t + (calm || !away ? "" : ", transform " + GLASS_T.move),');
    expect(V).toContain("const glass = (away) => ({ on: vis, calm, away });");
    expect(V).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    // сверху — вверх, полоска — вниз, середина — чуть меньше
    expect(V).toContain('glass("translateY(-10px)")');
    expect(V).toContain('glass("translateY(12px)")');
    expect(V).toContain('glass("scale(0.94)")');
  });
  it("когда гаснут: пока ролик идёт; на паузе, в конце и при ошибке — на экране; пока ждёт загрузки — не выскакивают", () => {
    const V = rd("ui/intro-video.jsx");
    expect(V).toContain("if (!st.playing) { clearTimeout(hideT.current); setUi(true); return; }");
    expect(V).toContain("if (!st.waiting) { arm(firstHide.current ? HIDE_MS.first : HIDE_MS.next); firstHide.current = false; }");
    expect(V).toContain('{state === "waiting" && !vis ? (');   // v177: vis — кнопки на экране (и уже проявились)
  });
  it("касание по видео: показать или спрятать; без звука от телефона — включить звук; тянут полоску — на экране", () => {
    const V = rd("ui/intro-video.jsx");
    expect(V).toContain("if (forced && st.muted && st.playing) { unmute(); return; }");
    expect(V).toContain("if (ui) { clearTimeout(hideT.current); setUi(false); } else poke();");
    expect(V).toContain("hideT.current = setTimeout(() => { if (!drag.current) setUi(false); }, ms || HIDE_MS.next);");
    expect(V).toMatch(/const onDown = \(e\) => \{[\s\S]{0,200}clearTimeout\(hideT\.current\);\n\s+setUi\(true\);/);
    // спрятанные кнопки — под касанием видео, а клавиатура (фокус) их показывает
    expect(V).toContain('onFocus={() => { if (!ui) poke(); }}');
    expect(V).toContain('data-intro-ui={vis ? "on" : "off"}');   // v177: vis = ui и плеер уже проявил кнопки
  });
});

describe("v176 · стекло, раскладка, динамик", () => {
  it("стекло как у iPhone: прозрачный пузырь посередине, дымчатое — по краям; без колец и золотого ободка", () => {
    expect(GLASS.bubble.background).toMatch(/^radial-gradient\(120% 120% at 50% 0%, rgba\(255,255,255,0\.22\) 0%/);
    expect(GLASS.dark.background).toMatch(/rgba\(58,54,48,0\.42\)/);
    for (const k of ["bubble", "dark"]) {
      expect(GLASS[k].color, k).toBe("#FFFFFF");
      expect(GLASS[k].boxShadow, k).not.toMatch(/214,178,102|232,201,131/);
      const alphas = [...GLASS[k].background.matchAll(/rgba\(\d+,\d+,\d+,([\d.]+)\)/g)].map((x) => Number(x[1]));
      expect(alphas.length, k).toBeGreaterThanOrEqual(2);
      expect(Math.max(...alphas), k).toBeLessThanOrEqual(0.42);
    }
    const V = rd("ui/intro-video.jsx");
    expect(V).not.toContain("<Ring");
    expect(V).not.toContain("LENS.");
  });
  it("посередине — назад на фразу (58), ▶ / ❚❚ (82), вперёд на фразу (58); внизу — время, полоска и сколько осталось", () => {
    const V = rd("ui/intro-video.jsx");
    // v177 (Доп. 502): кнопки — <Glass kind="bubble">, без прозрачной обёртки
    expect(V).toContain('<div style={{ display: "flex", alignItems: "center", gap: 30 }}>');
    expect(V).toContain('<Glass kind="bubble" {...glass("scale(0.94)")} type="button" data-intro-back="" aria-label="Назад на фразу" onClick={phrase(-1)} style={disc(58)}>');
    expect(V).toContain('<Glass kind="bubble" {...glass("scale(0.94)")} type="button" data-intro-toggle="" aria-label={st.playing ? "Пауза" : "Смотреть"} onClick={toggle} style={disc(82)}>');
    expect(V).toContain('<Glass kind="bubble" {...glass("scale(0.94)")} type="button" data-intro-next="" aria-label="Вперёд на фразу" onClick={phrase(1)} style={disc(58)}>');
    expect(V).toContain('if (leftRef.current) leftRef.current.textContent = "−" + fmtDur(Math.max(0, Math.round(dur() - (el.currentTime || 0))));');
    expect(V).not.toContain("data-intro-resume");
    expect(V).not.toContain("data-intro-total");
  });
  it("динамик сверху справа: выключить звук по желанию и включить; звук выключил телефон — с начала фразы", () => {
    const V = rd("ui/intro-video.jsx");
    // v177 (Доп. 502): кнопка — <Glass>
    expect(V).toContain('<Glass {...glass("translateY(-10px)")} type="button" data-intro-mute="" aria-label={st.muted ? "Включить звук" : "Выключить звук"} aria-pressed={st.muted ? "true" : "false"} onClick={toggleMute}');
    expect(V).toContain("<SpeakerIcon off={st.muted} />");
    expect(V).toContain("if (el.muted) { if (forced) unmute(); else { try { el.muted = false; } catch (err) { /* */ } } }");
    expect(V).toContain("else { try { el.muted = true; } catch (err) { /* */ } setForced(false); }");
    // «Включить звук» посередине — только когда звук выключил телефон, и не гаснет вместе с кнопками
    expect(V).toContain('{forced && st.muted && state === "playing" ? (');
  });
  it("в конце — «Ещё раз» и «К тексту урока» посередине вместо ▶; при ошибке — и сообщение", () => {
    const V = rd("ui/intro-video.jsx");
    expect(V).toContain('{state !== "ended" && state !== "failed" ? (');
    expect(V).toMatch(/data-intro-end=\{state\} onClick=\{keep\}\n\s+style=\{\{ \.\.\.center, transform: "translate\(-50%, -50%\)"/);
  });
});

describe("v176 · обложка в уроке — как в v174", () => {
  it("▶ 48 px в тёмном кружке с золотой кромкой и ореолом, подпись, длительность; ▶ — по центру", () => {
    const html = R(h(IntroVideoCover, { lessonId: "sm0-1" }));
    expect(html).toMatch(/<span data-intro-play="" style="[^"]*width:48px;height:48px;border-radius:50%[^"]*background:rgba\(20,15,8,0\.55\)/);
    expect(html).toMatch(/data-intro-play="" style="[^"]*box-shadow:inset 0 0 0 1\.5px rgba\(232,201,131,0\.8\), 0 0 0 5px rgba\(232,201,131,0\.12\)/);
    expect(html).toMatch(/data-intro-play="" style="[^"]*"><svg[^>]*data-play-ic=""/);
    expect(html).toMatch(/text-transform:uppercase;color:#E8C983;opacity:0\.92">Видео-знакомство</);
    expect(html).toMatch(/font-weight:bold;line-height:1\.2;color:#F4E9CF;margin-top:2px;text-shadow:0 1px 6px rgba\(0,0,0,0\.55\)">С чего начинается роль</);
    expect(html).toMatch(/data-intro-dur="" style="[^"]*align-self:flex-end[^"]*">0:54</);   // v194: новый ролик — 52 с; v196: ещё новее — 54 с
    expect(html).toContain("height:52%");
  });
});
