// v34 (Доп. 343): «Разговор голосом» — конец фразы по тишине (vadStep), текст для голоса (speechText),
// нарезка ответа на куски для озвучки (speechChunks). Весь цикл в браузере (поддельный микрофон,
// поддельный сервер) проверяет tools/claude/e2e-v34.mjs.
import { describe, it, expect } from "vitest";
import { vadStep, VAD, speechText, speechChunks } from "../lib/talk";

// прогнать уровень rms в течение ms шагами по 50 мс; вернуть события
function feed(st, rms, ms, out) {
  let s = st;
  for (let t = 0; t < ms; t += 50) { const r = vadStep(s, typeof rms === "function" ? rms(t) : rms, 50); s = r.st; if (r.ev) out.push(r.ev); }
  return s;
}

describe("конец фразы по тишине", () => {
  it("тишина → речь → пауза: «заговорил» и «договорил»", () => {
    const ev = [];
    let s = feed(null, 0.004, 800, ev);
    expect(ev).toEqual([]);
    s = feed(s, 0.2, 1200, ev);
    expect(ev).toEqual(["start"]);
    s = feed(s, 0.006, 600, ev);       // короткая пауза между словами — ещё не конец
    expect(ev).toEqual(["start"]);
    s = feed(s, 0.18, 400, ev);
    s = feed(s, 0.006, 1300, ev);      // замолчал больше секунды — конец
    expect(ev).toEqual(["start", "end"]);
  });
  it("щелчок короче 160 мс — не речь", () => {
    const ev = [];
    let s = feed(null, 0.004, 400, ev);
    s = feed(s, 0.4, 100, ev);
    s = feed(s, 0.004, 600, ev);
    expect(ev).toEqual([]);
  });
  it("шумный зал: фон 0,06 — не речь, голос поверх фона — речь, фон после голоса — конец", () => {
    const ev = [];
    let s = feed(null, 0.06, 2000, ev);
    expect(ev).toEqual([]);
    expect(s.thr).toBeGreaterThan(0.12);
    s = feed(s, 0.32, 900, ev);
    expect(ev).toEqual(["start"]);
    s = feed(s, 0.06, 1300, ev);
    expect(ev).toEqual(["start", "end"]);
  });
  it("заговорил сразу, во время замера фона, — голос фоном не стал (тихий голос всё равно слышен)", () => {
    const ev = [];
    let s = feed(null, (t) => (t === 0 ? 0.004 : 0.12), 300, ev);   // один тихий миг, дальше — речь
    expect(s.thr).toBeLessThan(0.05);
    s = feed(s, 0.12, 400, ev);
    expect(ev).toEqual(["start"]);
  });
  it("тихий голос чуть ниже порога 3 с — фон растёт медленно, следующая фраза слышна", () => {
    const ev = [];
    let s = feed(null, 0.01, 300, ev);
    s = feed(s, 0.03, 3000, ev);        // бормочет чуть тише порога
    expect(ev).toEqual([]);
    expect(s.thr).toBeLessThan(0.045);
    s = feed(s, 0.05, 400, ev);
    expect(ev).toEqual(["start"]);
  });
  it("молчит 12 с — «не слышу»", () => {
    const ev = [];
    feed(null, 0.004, VAD.waitMs + 100, ev);
    expect(ev[0]).toBe("timeout");
  });
  it("говорит без пауз 25 с — фраза всё равно заканчивается", () => {
    const ev = [];
    let s = feed(null, 0.004, 400, ev);
    feed(s, 0.25, VAD.maxSpeechMs + 400, ev);
    expect(ev).toEqual(["start", "end"]);
  });
});

describe("текст для голоса", () => {
  it("без разметки, ссылок и эмодзи; жирное слово остаётся", () => {
    const t = speechText("**Главное** — улыбка 😊.\n- Подойди к столу\n- Назови себя\nСм. [урок](https://x.y/z) и https://example.com");
    expect(t).not.toMatch(/[*#`]|https?:|😊/);
    expect(t).toMatch(/Главное — улыбка/);
    expect(t).toMatch(/Подойди к столу\. Назови себя/);
    expect(t).toMatch(/урок/);
  });
  it("гость: *действия* не читаем", () => {
    expect(speechText("*откладывает меню* Добрый вечер! *улыбается*", { actions: true })).toBe("Добрый вечер!");
    expect(speechText("*откладывает меню* Добрый вечер!")).toMatch(/откладывает меню/);   // Наставнику — читаем
  });
});

describe("нарезка ответа на куски", () => {
  it("короткий ответ — один кусок", () => {
    expect(speechChunks("Добрый вечер! Вам как обычно?")).toEqual(["Добрый вечер! Вам как обычно?"]);
  });
  it("длинный — по предложениям: первый кусок короче, остальные до ~240 знаков, ничего не теряется", () => {
    const s = Array.from({ length: 12 }, (_, i) => "Это предложение номер " + (i + 1) + ", в нём есть немного слов для проверки.").join(" ");
    const parts = speechChunks(s);
    expect(parts.length).toBeGreaterThan(2);
    expect(parts[0].length).toBeLessThanOrEqual(220);
    parts.slice(1).forEach((p) => expect(p.length).toBeLessThanOrEqual(300));
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(s.replace(/\s+/g, " "));
  });
  it("очень длинное предложение без точек — режется по запятым/пробелам", () => {
    const s = Array.from({ length: 60 }, (_, i) => "слово" + i).join(", ");
    const parts = speechChunks(s);
    expect(parts.length).toBeGreaterThan(2);
    parts.forEach((p) => expect(p.length).toBeLessThanOrEqual(300));
    expect(parts.join(" ").replace(/\s+/g, " ").replace(/ ,/g, ",")).toBe(s);
  });
});

describe("кнопки и метки ответа не читаем", () => {
  it("[[go:…]], [[lesson:…]], [[mood:…]] — вон из голоса", () => {
    const t = speechText("Загляни в погреб тем. [[go:cellar|Погреб тем]] [[lesson:x1|Урок]] [[mood:4]]");
    expect(t).toBe("Загляни в погреб тем.");
  });
});
