// v196 (Доп. 521): ещё один новый ролик сервис-менеджера. Владелец (25.11): «И вот опять на замену видео😉».
// Темп спокойнее: 54 с вместо 52. Новые rev, dur и начала фраз; обложка и лицо — как прежде. Текст ролика с v194 новый —
// титры по нему в v197 (Доп. 522), отсюда rev и сотые в началах фраз.
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v174.mjs (обложка 0:54, ролик идёт), e2e-v176.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { INTRO_VIDEOS } from "../data/intro-videos.js";

const rd = (f) => readFileSync(f, "utf8");
// длительность mp4 по заголовку mvhd (секунды) — как в v174
function mp4Duration(buf) {
  const i = buf.indexOf(Buffer.from("mvhd"));
  if (i < 0) return -1;
  if (buf[i + 4] === 1) return Number(buf.readBigUInt64BE(i + 4 + 4 + 16 + 4)) / buf.readUInt32BE(i + 4 + 4 + 16);
  return buf.readUInt32BE(i + 4 + 4 + 8 + 4) / buf.readUInt32BE(i + 4 + 4 + 8);
}

describe("v196 · версия и журнал", () => {
  it("сборка v196, Дополнение 521 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(196);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 521 — .*\(v196\)/);
    const part = c.slice(c.indexOf("# Дополнение 521"));
    expect(part).toContain("«И вот опять на замену видео😉»");
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v196 · ролик сервис-менеджера", () => {
  const v = INTRO_VIDEOS["sm0-1"];
  const buf = readFileSync("public" + v.src);
  it("новый файл: rev от него (не v176 и не v194), 54 с, сжат как остальные", () => {
    expect(v.rev).toBe(createHash("sha256").update(buf).digest("hex").slice(0, 8));
    expect(["1ca5d8a5", "d92d2c7f", "9c528d71"]).not.toContain(v.rev);   // v197: титры по новому тексту
    expect(v.dur).toBe(54);
    expect(Math.abs(mp4Duration(buf) - v.dur)).toBeLessThan(0.6);
    expect(buf.length).toBeLessThan(3.6e6);
  });
  it("начала фраз — по его звуку: «Привет!» около секунды, «Начнём!» за 1–2,5 с до конца, 19 фраз", () => {
    expect(v.cues).toEqual([1.06, 1.84, 5.0, 6.61, 8.6, 12.27, 18.89, 22.76, 26.89, 30.79, 33.18, 36.53, 39.01, 41.2, 43.8, 45.34, 47.75, 50.49, 52.89]);   // v197: привязка по верному тексту
    const end = mp4Duration(buf) - v.cues[v.cues.length - 1];
    expect(end).toBeGreaterThan(1); expect(end).toBeLessThan(2.5);
    for (let i = 1; i < v.cues.length; i++) expect(v.cues[i] - v.cues[i - 1]).toBeGreaterThan(0.5);
  });
  it("обложка и лицо — как прежде; как вставляли — в README видео и в комментарии к ролику", () => {
    expect(v.face).toEqual({ top: 0.06, eyes: 0.19, chin: 0.31 });
    expect(existsSync("public" + v.poster)).toBe(true);
    expect(rd("data/intro-videos.js")).toContain("v196 (Доп. 521): и ещё раз (25.11, второй за день)");
    expect(rd("tools/video/README.md")).toContain("Через пару часов (v196, Доп. 521) пришёл ещё один вариант того же ролика");
    expect(rd("tools/claude/e2e-v174.mjs")).toContain('service_manager: ["sm0-1", "0:54"]');
    expect(existsSync("tools/video/__pycache__")).toBe(false);
  });
});
