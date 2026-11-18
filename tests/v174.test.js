// v174 (Доп. 499): видео-знакомство в первом уроке каждой роли. Владелец (18.11) про ролики с титрами: «Да прекрасно.
// Но интересно, как это будет выглядеть в приложении».
//   • data/intro-videos.js — шесть первых уроков, файлы в public/video, длительность;
//   • ui/intro-video.jsx — обложка на месте фото урока (первая карточка, лентой — сверху) и плеер на весь экран;
//   • public/sw.js — ролики мимо воркера; vercel.json — /video/ кэшируется на сутки.
// Сервер не меняется. Разметки JSX в файле нет (Доп. 482). Вид и плеер в браузере: tools/claude/e2e-v174.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";

if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { INTRO_VIDEOS, introVideoOf, fmtDur, durWords } from "../data/intro-videos.js";
import { ROLES } from "../data/roles.js";
import { MODULES_INDEX } from "../data/modules-index.js";
import { IntroVideoCover, makeIntroVideoEl } from "../ui/intro-video";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

// длительность mp4 по заголовку mvhd (секунды)
function mp4Duration(buf) {
  const i = buf.indexOf(Buffer.from("mvhd"));
  if (i < 0) return -1;
  const v = buf[i + 4];
  if (v === 1) return Number(buf.readBigUInt64BE(i + 4 + 4 + 16 + 4)) / buf.readUInt32BE(i + 4 + 4 + 16);
  const ts = buf.readUInt32BE(i + 4 + 4 + 8), dur = buf.readUInt32BE(i + 4 + 4 + 8 + 4);
  return dur / ts;
}
// размер кадра JPEG (ширина, высота)
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return [0, 0];
}

describe("v174 · версия и журнал", () => {
  it("сборка v174, Дополнение 499, слова владельца, сценарий в браузере", () => {
    const n = /· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx")).slice(1).map(Number);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n[0]).toBe(max);
    expect(max).toBeGreaterThanOrEqual(174);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 499 — .*\(v174\)/);
    const part = c.slice(c.indexOf("# Дополнение 499")).replace(/\s+/g, " ");
    for (const w of ["Да прекрасно", "интересно, как это будет выглядеть в приложении"]) expect(part, w).toContain(w);
    for (const line of c.slice(c.indexOf("# Дополнение 499")).split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
    expect(rd("tools/claude/README.md")).toContain("e2e-v174.mjs");
  });
});

describe("v174 · ролики", () => {
  it("по ролику на первый урок каждой роли", () => {
    const first = Object.fromEntries(ROLES.map((r) => [r.id, MODULES_INDEX[r.id][0].lessons[0]]));
    expect(Object.keys(INTRO_VIDEOS).sort()).toEqual(Object.values(first).map((l) => l.id).sort());
    for (const [role, l] of Object.entries(first)) {
      expect(l.type, l.id).toBe("lesson");
      expect(INTRO_VIDEOS[l.id].role, l.id).toBe(role);
    }
  });
  it("файлы на месте: ролик 720×1280 не больше 8 МБ, обложка того же размера, длительность совпадает", () => {
    for (const [id, v] of Object.entries(INTRO_VIDEOS)) {
      expect(v.src, id).toBe("/video/intro-" + v.role + ".mp4");
      expect(v.poster, id).toBe("/video/intro-" + v.role + ".jpg");
      const mp4 = readFileSync("public" + v.src), jpg = readFileSync("public" + v.poster);
      expect(mp4.length, id).toBeGreaterThan(1000000);
      expect(mp4.length, id).toBeLessThan(8 * 1024 * 1024);
      expect(jpg.length, id).toBeLessThan(200 * 1024);
      expect(jpegSize(jpg), id).toEqual([720, 1280]);
      expect(Math.abs(mp4Duration(mp4) - v.dur), id).toBeLessThan(0.6);
      // moov в начале файла (faststart): ролик начинает играть до того, как скачан целиком
      expect(mp4.indexOf(Buffer.from("moov")), id).toBeLessThan(mp4.indexOf(Buffer.from("mdat")));
    }
  });
  it("в public/video только эти ролики и обложки", () => {
    const want = Object.values(INTRO_VIDEOS).flatMap((v) => [v.src, v.poster].map((p) => p.replace("/video/", ""))).sort();
    expect(readdirSync("public/video").sort()).toEqual(want);
  });
  it("introVideoOf: только свои уроки", () => {
    expect(introVideoOf("spg-0-1").role).toBe("spg");
    expect(introVideoOf("bar0-1").dur).toBe(48);
    for (const x of ["spg-0-2", "", null, undefined, "toString", "__proto__", 5]) expect(introVideoOf(x), String(x)).toBe(null);
  });
  it("длительность: «0:54», словами «54 секунды»", () => {
    expect(fmtDur(54)).toBe("0:54");
    expect(fmtDur(47.4)).toBe("0:47");
    expect(fmtDur(61)).toBe("1:01");
    expect(fmtDur(0)).toBe("0:00");
    expect(durWords(54)).toBe("54 секунды");
    expect(durWords(47)).toBe("47 секунд");
    expect(durWords(51)).toBe("51 секунда");
    expect(durWords(61)).toBe("1 минута 1 секунда");
    expect(durWords(120)).toBe("2 минуты");
    expect(durWords(0)).toBe("0 секунд");
  });
});

describe("v174 · обложка в уроке", () => {
  it("кадр, ▶, «Видео-знакомство», длительность и подпись для диктора", () => {
    const s = R(h(IntroVideoCover, { lessonId: "spg-0-1" }));
    expect(s).toContain('data-intro-cover="spg"');
    expect(s).toContain('role="button"');
    expect(s).toContain('aria-label="Смотреть видео-знакомство, 54 секунды"');
    expect(s).toContain('src="/video/intro-spg.jpg"');
    expect(s).toContain("data-intro-play");
    expect(s).toContain("Видео-знакомство");
    expect(s).toContain("С чего начинается роль");
    expect(s).toMatch(/data-intro-dur=""[^>]*>0:54</);
    // к краям стеклянной карточки, как фото урока
    expect(s).toContain("margin:-20px -18px 16px");
    // до касания ролика нет: ни <video>, ни плеера
    expect(s).not.toContain("<video");
    expect(s).not.toContain("data-intro-player");
  });
  it("урок без ролика — ничего", () => {
    expect(R(h(IntroVideoCover, { lessonId: "spg-0-2" }))).toBe("");
    expect(R(h(IntroVideoCover, { lessonId: "" }))).toBe("");
  });
  it("у каждой роли своя обложка и длительность", () => {
    for (const [id, v] of Object.entries(INTRO_VIDEOS)) {
      const s = R(h(IntroVideoCover, { lessonId: id, a11y: true }));
      expect(s, id).toContain('data-intro-cover="' + v.role + '"');
      expect(s, id).toContain(">" + fmtDur(v.dur) + "<");
      expect(s, id).toContain(v.poster);
    }
  });
  it("экран урока: обложка на первой карточке (лентой — сверху), фото урока в этих уроках не ставится", () => {
    const S = rd("ui/screens-learning.jsx");
    expect(S).toContain('import { IntroVideoCover } from "./intro-video";');
    expect(S).toContain('import { introVideoOf } from "../data/intro-videos";');
    expect(S).toContain("{(!cardMode || cardIdx === 0) && introVideoOf(lesson.id)\n            ? <IntroVideoCover lessonId={lesson.id} a11y={!!T.a11y} /> : null}");
    expect(S).toContain("{(!cardMode || cardIdx === 0) && lessonPhotoId(lesson.id) && !introVideoOf(lesson.id)");
    // обложка видео стоит раньше фото урока и живого диалога
    expect(S.indexOf("<IntroVideoCover")).toBeLessThan(S.indexOf("<LessonCover lessonId={lesson.id}"));
    expect(S.indexOf("<IntroVideoCover")).toBeLessThan(S.indexOf("В этом уроке есть живой диалог"));
  });
});

describe("v174 · плеер", () => {
  it("<video> внутри страницы: playsinline, без своих кнопок, ролик и обложка", () => {
    const attrs = {};
    const el = { style: {}, setAttribute(k, v) { attrs[k] = v; } };
    const prev = globalThis.document;
    globalThis.document = { createElement: (t) => { attrs.tag = t; return el; } };
    try {
      const v = makeIntroVideoEl(INTRO_VIDEOS["m0-1"]);
      expect(v).toBe(el);
      expect(attrs.tag).toBe("video");
      expect(attrs.playsinline).toBe("");
      expect(attrs["webkit-playsinline"]).toBe("");
      expect(attrs.preload).toBe("auto");
      expect(attrs["data-intro-el"]).toBe("manager");
      expect(attrs.controls).toBe(undefined);
      expect(v.playsInline).toBe(true);
      expect(v.src).toBe("/video/intro-manager.mp4");
      expect(v.poster).toBe("/video/intro-manager.jpg");
      expect(v.style.objectFit).toBe("contain");
    } finally { globalThis.document = prev; }
    expect(makeIntroVideoEl(null)).toBe(null);
  });
  it("по исходнику: звук из касания, «Назад» Telegram закрывает видео, касания не уходят в урок", () => {
    const S = rd("ui/intro-video.jsx");
    // плеер ставится прямо в касании, play() — там же
    expect(S).toContain("flushSync(() => setOpen(true));");
    expect(S.indexOf("flushSync(() => setOpen(true));")).toBeLessThan(S.indexOf("playSafe(v);"));
    // крестик — первый data-sa-back поверх приложения (lib/utils.js, clickScreenBack)
    expect(S).toMatch(/data-sa-back="" data-intro-x="" aria-label="Закрыть"/);
    expect(S).toContain("createPortal(body, document.body)");
    expect(S).toContain("onClick={keep} onTouchStart={keep} onTouchEnd={keep}");
    expect(S).toContain('if (ev.key === "Escape")');
    // ушли из урока — загрузка обрывается
    expect(S).toContain('v.removeAttribute("src"); v.load();');
    expect(S).toMatch(/Ещё раз/);
    expect(S).toMatch(/К уроку/);
    expect(S).toContain("Видео не загрузилось. Проверь связь и попробуй ещё раз.");
  });
});

describe("v174 · сеть и кэш", () => {
  it("сервис-воркер: ролики мимо него, обложки — как картинки", () => {
    const W = rd("public/sw.js");
    expect(W).toContain('if (u.origin === self.location.origin && u.pathname.startsWith("/video/") && !isImage(u)) return;');
    expect(W.indexOf('u.pathname.startsWith("/video/")')).toBeLessThan(W.indexOf('if (req.mode === "navigate")'));
    expect(W).toMatch(/const isImage = \(u\) => \/\\\.\(png\|jpe\?g/);
  });
  it("vercel.json: /video/ — на сутки, после общего «no-store»", () => {
    const V = JSON.parse(rd("vercel.json"));
    const src = V.headers.map((x) => x.source);
    const i = src.indexOf("/video/(.*)");
    expect(i).toBeGreaterThan(src.indexOf("/(.*)"));
    expect(V.headers[i].headers).toEqual([{ key: "Cache-Control", value: "public, max-age=86400" }]);
  });
  it("демо собирается с роликами", () => {
    const B = rd("tools/claude/demo-app/build.mjs");
    expect(B).toContain('["menu", "reference", "icons", "assets", "video"]');
    expect(B).toContain("(menu|reference|icons|assets|video)");
    expect(statSync("tools/claude/e2e-v174.mjs").size).toBeGreaterThan(5000);
    // чем сделаны титры — рядом, для следующих роликов
    for (const f of ["README.md", "fa.py", "make_captions.py", "scripts.md"]) expect(statSync("tools/video/" + f).size, f).toBeGreaterThan(1000);
    for (const v of Object.values(INTRO_VIDEOS)) expect(statSync("tools/video/chunks/" + v.role + "_chunks.txt").size, v.role).toBeGreaterThan(500);
  });
});
