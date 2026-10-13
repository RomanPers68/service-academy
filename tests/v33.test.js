// v33 (Доп. 340–341): голос телефона — без «тихой дорожки»; отмена перед новой фразой — только
// если телефон и правда читает (и тогда новая фраза чуть позже); фраза с задержкой отменяется.
// Лента трека и обложки радио возвращаются кадрами — это проверяет tools/claude/e2e-v33.mjs.
import { describe, it, expect } from "vitest";
import { speakText, stopSpeech, cancelSpeech, _resetSpeech } from "../lib/speech";

// поддельный голос телефона: speaking/pending задаём сами, cancel() считаем
function fakeSynth({ speaking = false, pending = false } = {}) {
  const said = [];
  const ss = { speaking, pending, cancels: 0, speak(u) { said.push(u); this.speaking = true; }, cancel() { this.cancels++; said.splice(0).forEach((u) => u.onerror && u.onerror({ error: "canceled" })); this.speaking = false; this.pending = false; }, getVoices: () => [] };
  global.window = { speechSynthesis: ss, SpeechSynthesisUtterance: function U(t) { this.text = t; } };
  return { ss, said };
}
// таймеры: короткие (задержка фразы) копим и запускаем сами; подстраховку (≥4 с) — не трогаем
function withTimers(fn) {
  const real = global.setTimeout; const short = [];
  global.setTimeout = (f, ms) => { if (ms < 4000) { short.push({ f, ms }); return short.length; } return 0; };
  try { return fn(short); } finally { global.setTimeout = real; }
}

describe("голос телефона v33", () => {
  it("телефон молчит — читаем сразу, без cancel() (первая фраза уходит прямо по нажатию)", () => {
    _resetSpeech();
    const { ss, said } = fakeSynth();
    withTimers(() => { speakText("Добрый вечер", { cancelBefore: true }); });
    expect(ss.cancels).toBe(0);
    expect(said.length).toBe(1);
  });
  it("телефон читает — отменяем и новую фразу даём через ~90 мс", () => {
    _resetSpeech();
    const { ss, said } = fakeSynth({ speaking: true });
    withTimers((short) => {
      speakText("Следующая фраза", { cancelBefore: true });
      expect(ss.cancels).toBe(1);
      expect(said.length).toBe(0);
      expect(short.length).toBe(1);
      expect(short[0].ms).toBeGreaterThanOrEqual(90);
      short[0].f();
    });
    expect(said.length).toBe(1);
    expect(said[0].text).toBe("Следующая фраза");
  });
  it("задержка по просьбе (delay) и отмена до начала — фраза не прозвучит", () => {
    _resetSpeech();
    const { said } = fakeSynth();
    let ends = 0, errs = 0;
    withTimers((short) => {
      const h = speakText("Фраза", { delay: 90, onend: () => ends++, onerror: () => errs++ });
      expect(said.length).toBe(0);
      h.cancel();
      short.forEach((t) => t.f());
    });
    expect(said.length).toBe(0);
    expect(ends + errs).toBe(0);
  });
  it("после отмены (стоп, свайп выпуска) следующая фраза тоже ждёт паузу; «Стоп» отменяет и ждущую", () => {
    _resetSpeech();
    const { ss, said } = fakeSynth({ speaking: true });
    withTimers((short) => {
      expect(cancelSpeech()).toBe(true);           // радио: stop() → отмена
      speakText("Новый выпуск", {});              // через миг — новый выпуск, без cancelBefore
      expect(said.length).toBe(0);
      expect(short.length).toBe(1);
      stopSpeech();                                // и тут же «Стоп»
      short.forEach((t) => t.f());
    });
    expect(said.length).toBe(0);
    expect(ss.cancels).toBeGreaterThanOrEqual(1);
  });
  it("телефон молчит — cancelSpeech ничего не отменяет и паузы не будет", () => {
    _resetSpeech();
    const { ss, said } = fakeSynth();
    expect(cancelSpeech()).toBe(false);
    expect(ss.cancels).toBe(0);
    withTimers(() => { speakText("Сразу", {}); });
    expect(said.length).toBe(1);
  });
  it("ошибка телефона доходит до экрана с кодом, отмена — нет", () => {
    _resetSpeech();
    const { said } = fakeSynth();
    const got = [];
    withTimers(() => { speakText("Раз", { onerror: (e) => got.push(e && e.error) }); });
    said[0].onerror({ error: "audio-busy" });
    expect(got).toEqual(["audio-busy"]);
    withTimers(() => { speakText("Два", { onerror: (e) => got.push(e && e.error) }); });
    stopSpeech();
    expect(got).toEqual(["audio-busy"]);
  });
});
