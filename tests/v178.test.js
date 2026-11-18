// v178 (Доп. 503): видео-знакомство — сброс прогресса стирает выбор, без чёрного экрана, ролик заранее надёжнее.
// Владелец (18.11) с записью экрана: «Когда нажимаю на урок, видео не стартует сразу, как раньше», и следом: «Я понял в чем
// причина. Видимо он засчитывает только первы вход <…> я просто сделал сброс своего прогресса, а ролик остался
// просмотренным, поэтому и не запустился сразу».
//   • App.jsx — wipeLocalProgress стирает и sa_intro_seen (что выбрал в видео-знакомстве);
//   • ui/intro-video.jsx — кадр обложки на месте ролика, пока тот не показал первый кадр; обложка берёт ролик без очереди;
//   • lib/intro-warm.js — начатое скачивание доводится до конца; экран, которому ждать нечего, сокращает очередь.
// Сервер не меняется. Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v178.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { INTRO_VIDEOS } from "../data/intro-videos.js";
import { INTRO_SEEN_KEY, introSeenOf, markIntroSeen, introFirst } from "../lib/intro-video";
import { warmIntro, introSrc, introWarmState, resetIntroWarm, warmKey, VIDEO_CACHE } from "../lib/intro-warm";

const rd = (p) => readFileSync(p, "utf8");
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const V = () => rd("ui/intro-video.jsx");
const playerSrc = () => { const s = V(); return s.slice(s.indexOf("export function IntroPlayer(")); };

describe("v178 · версия и журнал", () => {
  it("сборка v178, Дополнение 503, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(178);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 503 — .*\(v178\)/);
    const part = c.slice(c.indexOf("# Дополнение 503")).replace(/\s+/g, " ");
    for (const w of ["Когда нажимаю на урок, видео не стартует сразу, как раньше", "я просто сделал сброс своего прогресса, а ролик остался просмотренным",
      "Бывает такое, что видео долго грузится", "продолжается без озвучки"])
      expect(part, w).toContain(w);
    for (const line of c.slice(c.indexOf("# Дополнение 503")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v178.mjs");
  });
});

describe("v178 · сброс прогресса — ролик снова первым экраном", () => {
  const app = rd("App.jsx");
  const list = app.slice(app.indexOf("const wipeLocalProgress = useCallback"), app.indexOf("wipeLocalProgressRef.current = wipeLocalProgress"));
  const keys = [...list.slice(0, list.indexOf(".forEach(")).matchAll(/"(sa_[a-z0-9_]+)"/g)].map((m) => m[1]);
  it("в списке стираемого при сбросе — выбор в видео-знакомстве; версия очистки не поднята (иначе стёрся бы прогресс после давних сбросов)", () => {
    expect(keys).toContain(INTRO_SEEN_KEY);
    expect(INTRO_SEEN_KEY).toBe("sa_intro_seen");
    expect(list).toContain(".forEach(k => { try { localStorage.removeItem(k + uk); localStorage.removeItem(k); } catch (e) {} });");
    expect(app).toMatch(/const WIPE_VERSION = 3;/);
  });
  it("выбрал «текстом» — урок текстом; сброс (тот же список) — ролик снова первым экраном, у другого человека выбор цел", () => {
    const m = {};
    globalThis.localStorage = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } };
    try {
      markIntroSeen("s0-1", "text", "_Анна_Смирнова");
      markIntroSeen("m0-1", "end", "_Мария_Ким");
      expect(introFirst("s0-1", true, "_Анна_Смирнова")).toBe(false);
      for (const k of keys) { localStorage.removeItem(k + "_Анна_Смирнова"); localStorage.removeItem(k); }   // как wipeLocalProgress(uk)
      expect(introSeenOf("s0-1", "_Анна_Смирнова")).toBe("");
      expect(introFirst("s0-1", true, "_Анна_Смирнова")).toBe(true);
      expect(introSeenOf("m0-1", "_Мария_Ким")).toBe("end");
    } finally { delete globalThis.localStorage; }
  });
  it("сброс самого себя стирает телефон сразу (wipeTraces → wipeLocalProgress)", () => {
    expect(app).toContain("try { wipeLocalProgressRef.current(`_${profile.name}_${profile.surname || \"\"}`); } catch (e) {}");
  });
});

describe("v178 · без чёрного экрана: кадр обложки, пока ролик грузится", () => {
  it("на месте ролика — кадр обложки (тот же файл), касания — к видео под ним; проявляется вместе с видео", () => {
    const P = playerSrc();
    expect(P).toContain('<div aria-hidden="true" className="sa-fadein" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>');
    expect(P).toContain('<img ref={posterRef} data-intro-poster={framed ? "off" : "on"} src={video.poster} alt="" draggable={false}');
    expect(P).toContain('opacity: framed ? 0 : 1, transition: "opacity .25s ease"');
    // слой — после видео (выше него) и до кнопок (под стеклом)
    expect(P.indexOf("data-intro-stage")).toBeLessThan(P.indexOf("data-intro-poster="));
    expect(P.indexOf("data-intro-poster=")).toBeLessThan(P.indexOf('data-intro-top=""'));
  });
  it("тот же размер и место, что у видео (fillSize), и при повороте тоже", () => {
    const P = playerSrc();
    expect(P).toContain("Object.assign(el.style, box);\n      if (posterRef.current) Object.assign(posterRef.current.style, box);");
    expect(P).toContain('window.addEventListener("resize", fit);');
  });
  it("кадр тает, когда ролик идёт и показал кадр: по кадру (requestVideoFrameCallback), где нет — по времени ролика", () => {
    const P = playerSrc();
    expect(P).toContain('if (typeof el.requestVideoFrameCallback !== "function") return;');
    expect(P).toContain("if (!el.paused && ((meta && meta.mediaTime > 0) || el.currentTime > 0)) framedNow(); else if (live) wantFrame();");
    expect(P).toContain("const onTime = () => { if (!el.paused && (el.currentTime || 0) > 0.04) framedNow(); };");
    expect(P).toContain('el.removeEventListener("timeupdate", onTime);');
    expect(P).toContain('if (vfc && typeof el.cancelVideoFrameCallback === "function") el.cancelVideoFrameCallback(vfc);');
  });
});

describe("v178 · ролик заранее надёжнее", () => {
  const v = INTRO_VIDEOS["s0-1"];
  let calls, store, fetchImpl;
  const abs = (k) => new URL(k, "http://localhost/").href;
  const okBody = () => new Response(new Blob([new Uint8Array(2048)], { type: "video/mp4" }), { status: 200, headers: { "Content-Type": "video/mp4" } });
  beforeEach(() => {
    resetIntroWarm();
    calls = { fetch: [], put: [], del: [] };
    store = new Map();
    fetchImpl = async () => okBody();
    globalThis.fetch = (url, opts) => { calls.fetch.push({ url, opts, t: Date.now() }); return fetchImpl(url, opts); };
    globalThis.caches = { open: async () => ({
      match: async (k) => (store.has(abs(k)) ? store.get(abs(k)).clone() : undefined),
      put: async (k, r) => { calls.put.push(abs(k)); store.set(abs(k), r); },
      delete: async (k) => { const u = typeof k === "string" ? abs(k) : k.url; calls.del.push(u); return store.delete(u); },
      keys: async () => [...store.keys()].map((url) => ({ url })) }) };
    try { Object.defineProperty(globalThis.navigator, "connection", { configurable: true, value: undefined }); } catch (e) { /* */ }
  });
  const settle = async (n = 6) => { for (let k = 0; k < n; k++) await tick(5); };

  it("ушёл с экрана, когда ролик уже качался, — скачивание доводим, ролик в телефоне", async () => {
    let finish;
    fetchImpl = () => new Promise((res) => { finish = () => res(okBody()); });
    const off = warmIntro(v, { wait: 0 });
    await settle();
    expect(introWarmState(v)).toBe("net");
    off();
    expect(introWarmState(v)).toBe("net");   // v177 здесь бросал
    finish();
    await settle();
    expect(introWarmState(v)).toBe("ready");
    expect(calls.put).toEqual([abs(warmKey(v))]);
    expect(introSrc(v)).toMatch(/^blob:/);
  });
  it("ушёл, пока ролик ещё искали в телефоне, а там его нет, — из сети не качаем", async () => {
    const off = warmIntro(v, { wait: 0 });
    off();
    await settle(8);
    expect(calls.fetch.length).toBe(0);
    expect(introWarmState(v)).toBe("");
  });
  it("ушёл, пока ролик ждал очереди, — не качаем (как в v177)", async () => {
    const off = warmIntro(v, { wait: 60 });
    await settle(2);
    expect(introWarmState(v)).toBe("wait");
    off();
    await tick(100); await settle();
    expect(calls.fetch.length).toBe(0);
  });
  it("экран, которому ждать нечего (обложка в уроке), сокращает очередь главной", async () => {
    const t0 = Date.now();
    const home = warmIntro(v, { wait: 400 });
    await settle(2);
    expect(introWarmState(v)).toBe("wait");
    const coverOff = warmIntro(v, { wait: 0 });
    await settle(4);
    expect(calls.fetch.length).toBe(1);
    expect(calls.fetch[0].t - t0).toBeLessThan(300);
    home(); coverOff();
    await tick(450); await settle();
    expect(calls.fetch.length).toBe(1);   // ожидание главной не запустило второе скачивание
    expect(introWarmState(v)).toBe("ready");
  });
  it("пока ролик ищут в телефоне, обложка тоже сокращает будущую очередь", async () => {
    const home = warmIntro(v, { wait: 500 });
    const coverOff = warmIntro(v, { wait: 0 });
    await settle(4);
    expect(calls.fetch.length).toBe(1);
    home(); coverOff();
  });
  it("плеер открыли, пока ролик качается, — скачивание обрываем (как в v177): связь — плееру", async () => {
    let aborted = false;
    fetchImpl = (url, opts) => new Promise((res, rej) => { opts.signal.addEventListener("abort", () => { aborted = true; rej(new DOMException("aborted", "AbortError")); }); });
    const off = warmIntro(v, { wait: 0 });
    await settle();
    off();
    expect(introSrc(v)).toBe(v.src);
    await settle();
    expect(aborted).toBe(true);
    expect(introWarmState(v)).toBe("");
    expect(VIDEO_CACHE).toBe("sa-video-v1");
  });
});

describe("v178 · ролики легче для слабой связи", () => {
  // mp4: дорожки (trak) — ключевые кадры (stss), число каналов звука (mp4a), длительность (mvhd)
  const box = (b, name, from = 0, to = b.length) => { for (let i = from; i + 8 <= to;) { const n = b.readUInt32BE(i), t = b.toString("latin1", i + 4, i + 8); if (t === name) return { at: i, end: i + n }; if (n < 8) return null; i += n; } return null; };
  const inside = (b, path) => { let from = 0, to = b.length, r = null; for (const name of path) { r = box(b, name, from, to); if (!r) return null; from = r.at + 8; to = r.end; } return r; };
  function info(file) {
    const b = readFileSync(file), moov = box(b, "moov");
    const mv = box(b, "mvhd", moov.at + 8, moov.end), ver = b[mv.at + 8];
    const dur = ver === 1 ? Number(b.readBigUInt64BE(mv.at + 8 + 4 + 16 + 4)) / b.readUInt32BE(mv.at + 8 + 4 + 16) : b.readUInt32BE(mv.at + 8 + 4 + 8 + 4) / b.readUInt32BE(mv.at + 8 + 4 + 8);
    const out = { dur, size: b.length, gap: 0, channels: 0 };
    for (let i = moov.at + 8; i < moov.end;) {
      const tr = box(b, "trak", i, moov.end); if (!tr) break;
      const stbl = (() => { let r = box(b, "mdia", tr.at + 8, tr.end); r = r && box(b, "minf", r.at + 8, r.end); return r && box(b, "stbl", r.at + 8, r.end); })();
      const stss = stbl && box(b, "stss", stbl.at + 8, stbl.end);
      if (stss) { const n = b.readUInt32BE(stss.at + 12); let prev = 0; for (let k = 0; k < n; k++) { const s = b.readUInt32BE(stss.at + 16 + 4 * k); if (k) out.gap = Math.max(out.gap, s - prev); prev = s; } out.last = prev; }
      const stsd = stbl && box(b, "stsd", stbl.at + 8, stbl.end);
      if (stsd && b.toString("latin1", stsd.at + 20, stsd.at + 24) === "mp4a") out.channels = b.readUInt16BE(stsd.at + 16 + 8 + 16);
      i = tr.end;
    }
    return out;
  }
  it("каждый ролик — не больше 0,65 Мбит/с в среднем (было до 1,04), ключевой кадр не реже раза в 4 с, звук моно", () => {
    for (const id of Object.keys(INTRO_VIDEOS)) {
      const v = INTRO_VIDEOS[id], m = info("public" + v.src);
      expect(m.size * 8 / m.dur / 1000, id).toBeLessThanOrEqual(650);
      expect(m.gap, id).toBeGreaterThan(0);
      expect(m.gap, id).toBeLessThanOrEqual(100);   // 25 кадров/с → не реже раза в 4 с
      expect(m.channels, id).toBe(1);
      expect(Math.abs(m.dur - v.dur), id).toBeLessThan(0.6);
    }
    const total = Object.values(INTRO_VIDEOS).reduce((a, v) => a + statSync("public" + v.src).size, 0);
    expect(total / 1e6).toBeLessThan(21);
  });
  it("как сжимать — в tools/video/README.md; в данных — заметка про v178", () => {
    const R = rd("tools/video/README.md");
    expect(R).toContain("-c:v libx264 -preset slow -crf 30 \\\n  -maxrate 550k -bufsize 1100k -g 100 -keyint_min 25 -pix_fmt yuv420p -profile:v high \\\n  -c:a aac -b:a 64k -ac 1 -movflags +faststart");
    expect(rd("data/intro-videos.js")).toContain("v178 (Доп. 503): ролики пережаты легче для слабой связи");
  });
  it("первым экраном звук выключается, только когда телефон его не дал — не когда загрузку прервали", () => {
    const S = V();
    expect(S).toContain('tryPlay(el).catch((err) => {\n        if (!live) return;');
    expect(S).toContain('if (!err || err.name !== "NotAllowedError") { sync(); return; }');
    // и только здесь плеер сам выключает звук (ещё — динамик, по касанию человека)
    expect(S.match(/el\.muted = true/g).length).toBe(2);
  });
});

describe("v178 · обложка в уроке", () => {
  it("берёт ролик без очереди, пока ролик не досмотрен; пока открыт плеер — нет; закрыли, не досмотрев, — снова", () => {
    const S = V();
    expect(S).toContain("const warm = !!video && !introFirst(lessonId, autoOpen, uk) && !introSeenOf(lessonId, uk);");
    expect(S).toContain("{warm && !mode ? <IntroWarm lessonId={lessonId} uk={uk} wait={0} /> : null}");
    expect(S).toContain("export function IntroWarm({ lessonId, uk = \"\", wait = null }) {");
    expect(S).toContain("}, [lessonId, uk, wait]);");
  });
  it("правило первого экрана — прежнее (v175): пока не досмотрел и не выбрал текст", () => {
    expect(rd("lib/intro-video.js")).toContain("export const introFirst = (lessonId, fromStart, uk = \"\") => !!introVideoOf(lessonId) && !!fromStart && !introSeenOf(lessonId, uk);");
  });
});
