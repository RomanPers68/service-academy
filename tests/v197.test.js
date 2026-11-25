// v197 (Доп. 522): титры ролика сервис-менеджера — по тексту, который звучит. Владелец (25.11): «Реплика сменилась,
// а вот титры нет 🤦‍♂️». С v194 в ролике «Менеджер зала держит смену. Сервис-менеджер строит систему, которая держит
// все смены» и «Значит, система выстроена», а плашки показывали прежнее «тушит пожары… пожаров не возникает» и
// «система работает».
//   1. tools/video/chunks/service_manager_chunks.txt — по сценарию из HeyGen; слова привязаны заново, ролик пережат:
//      новый rev и сотые в cues (data/intro-videos.js);
//   2. tools/video/scripts.md — все шесть сценариев как в HeyGen (с паузами); тест сверяет их с плашками слово в слово;
//   3. tools/video/check_text.py — сверка сценария с плашками перед привязкой; README — «Сначала текст из HeyGen».
// Разметки JSX в файле нет (Доп. 482). В браузере: tools/claude/e2e-v197.mjs (в демо новый файл, снимки на этих фразах).
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
// плашки — как их читает make_captions.load_chunks: строки с «#» пропускаются, «!» золотой плашки не считается
const chunkWords = (t) => t.split("\n").filter((l) => l.trim() && !l.trimStart().startsWith("#"))
  .flatMap((l) => (l.startsWith("!") ? l.slice(1) : l).trim().split(/\s+/));
// сценарий — паузы <break …/> не считаются
const scriptWords = (t) => t.replace(/<break[^>]*\/>/g, " ").split(/\s+/).filter(Boolean);
// раздел роли в scripts.md: от «## <роль> (…)» до следующего «## »
function scriptOf(md, role) {
  const i = md.indexOf("\n## " + role + " ");
  if (i < 0) return null;
  const body = md.slice(md.indexOf("\n", i + 1) + 1);
  const j = body.indexOf("\n## ");
  return (j < 0 ? body : body.slice(0, j)).trim();
}
const ROLES = ["spg", "seasonal", "core", "manager", "service_manager", "bar"];

describe("v197 · версия и журнал", () => {
  it("сборка v197, Дополнение 522 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(197);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 522 — .*\(v197\)/);
    const part = c.slice(c.indexOf("# Дополнение 522"));
    expect(part).toContain("«Реплика сменилась, а вот титры нет 🤦‍♂️»");
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v197 · титры сервис-менеджера — по тексту ролика", () => {
  const ch = rd("tools/video/chunks/service_manager_chunks.txt");
  it("новые фразы на своих плашках, главная мысль — на золотой", () => {
    expect(ch).toContain("Это не просто старший менеджер.\nМенеджер зала держит смену.\nСервис-менеджер строит систему,\n"
      + "!которая держит все смены.\nТвой главный вопрос звучит так:");
    expect(ch).toContain("а всё работает как часы.\n!Значит, система выстроена.\n!Начнём!");
  });
  it("прежнего текста в титрах нет", () => {
    for (const w of ["тушит", "пожар", "возникает", "система работает."]) expect(ch, w).not.toContain(w);
  });
});

describe("v197 · сценарии и плашки — слово в слово, все шесть ролей", () => {
  const md = rd("tools/video/scripts.md");
  for (const role of ROLES) {
    it(role, () => {
      const s = scriptOf(md, role);
      expect(s, role).toBeTruthy();
      expect(scriptWords(s)).toEqual(chunkWords(rd(`tools/video/chunks/${role}_chunks.txt`)));
    });
  }
  it("паузы как в HeyGen: 0,7 с до «Привет!» и 0,6 после; 0,8 с до «Начнём!» и 0,5 после", () => {
    for (const role of ROLES) {
      const s = scriptOf(md, role);
      expect(s, role).toMatch(/^<break time='0\.7s'\/> Привет! <break time='0\.6s'\/>\s/);
      expect(s, role).toMatch(/\s<break time='0\.8s'\/> Начнём! <break time='0\.5s'\/>$/);
    }
    expect(md).toContain("v197 (25.11): тексты ниже сверены со сценариями в HeyGen");
  });
});

describe("v197 · ролик пережат с новыми титрами", () => {
  const v = INTRO_VIDEOS["sm0-1"];
  const buf = readFileSync("public" + v.src);
  it("rev от нового файла (не прежние), 54 с, сжат как остальные", () => {
    expect(v.rev).toBe(createHash("sha256").update(buf).digest("hex").slice(0, 8));
    expect(["1ca5d8a5", "d92d2c7f", "9c528d71"]).not.toContain(v.rev);
    expect(v.dur).toBe(54);
    expect(Math.abs(mp4Duration(buf) - v.dur)).toBeLessThan(0.6);
    expect(buf.length).toBeLessThan(3.6e6);
  });
  it("начала фраз по привязке с верным текстом: 19 фраз, «Менеджер зала…» 6,61 с, «Сервис-менеджер…» 8,6, «Значит…» 50,49", () => {
    expect(v.cues.length).toBe(19);
    expect([v.cues[3], v.cues[4], v.cues[17]]).toEqual([6.61, 8.6, 50.49]);
    for (let i = 1; i < v.cues.length; i++) expect(v.cues[i] - v.cues[i - 1]).toBeGreaterThan(0.5);
  });
});

describe("v197 · текст сверяем до привязки", () => {
  it("check_text.py читает плашки как make_captions, паузы не считает, при расхождении — код 1", () => {
    const c = rd("tools/video/check_text.py");
    expect(c).toContain("import make_captions");
    expect(c).toContain('re.sub(r"<break[^>]*/>", " ", text)');
    expect(c).toContain("return 1");
    expect(existsSync("tools/video/__pycache__")).toBe(false);
  });
  it("README видео: «Сначала текст из HeyGen»; в комментарии к ролику — что было не так", () => {
    const r = rd("tools/video/README.md");
    expect(r).toContain("## Сначала текст из HeyGen (v197, Доп. 522)");
    expect(r).toContain("| `check_text.py` |");
    expect(r).toContain("`get_video_scenes`");
    const d = rd("data/intro-videos.js");
    expect(d).toContain("v197 (Доп. 522): с v194 в ролике новый текст, а титры были прежние");
    expect(d).not.toContain("тот же текст");
    expect(existsSync("tools/claude/e2e-v197.mjs")).toBe(true);
  });
});
