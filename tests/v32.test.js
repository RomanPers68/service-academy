// v32 (Доп. 331–338): голос телефона через lib/speech (фраза держится до конца, подстраховка,
// беззвучная дорожка на iPhone). «Управление данными» — версия владельца (правки 182–188),
// её проверяет tools/claude/e2e-admin.mjs.
import { describe, it, expect } from "vitest";
import { speakText, stopSpeech, canSpeak, isAppleMobile, audioWake, audioSleep, audioAwake, silentLoopUrl, _resetSpeech } from "../lib/speech";


// в Node 22 navigator — только для чтения: подменяем через defineProperty
const setNav = (v) => Object.defineProperty(globalThis, "navigator", { value: v, configurable: true, writable: true });

// поддельный голос телефона: фразы «говорят», когда скажем
function fakeSynth() {
  const said = [];
  const ss = { speaking: false, speak(u) { said.push(u); this.speaking = true; }, cancel() { said.splice(0).forEach((u) => u.onerror && u.onerror({ error: "canceled" })); this.speaking = false; }, getVoices: () => [] };
  global.window = { speechSynthesis: ss, SpeechSynthesisUtterance: function U(t) { this.text = t; } };
  return { ss, said };
}

describe("голос телефона (lib/speech)", () => {
  it("фраза держится до конца, конец приходит один раз", () => {
    const { said } = fakeSynth();
    expect(canSpeak()).toBe(true);
    let ends = 0;
    speakText("Добрый вечер", { rate: 1.1, pitch: 0.9, onend: () => ends++ });
    expect(said.length).toBe(1);
    expect(said[0].lang).toBe("ru-RU"); expect(said[0].rate).toBe(1.1); expect(said[0].pitch).toBe(0.9);
    said[0].onstart(); said[0].onend(); said[0].onend();
    expect(ends).toBe(1);
  });
  it("отмена — без ошибки для того, кто слушает", () => {
    const { said } = fakeSynth();
    let errs = 0, ends = 0;
    speakText("Раз", { onend: () => ends++, onerror: () => errs++ });
    stopSpeech();
    expect(errs).toBe(0); expect(ends).toBe(0);
    expect(said.length).toBe(0);
  });
  it("подстраховка: конец не пришёл — фраза считается дочитанной", async () => {
    const { said } = fakeSynth();
    const real = global.setTimeout; let fire = null;
    global.setTimeout = (fn, ms) => { if (ms >= 4000) { fire = fn; return 1; } return real(fn, ms); };
    let ends = 0, errs = 0;
    try { speakText("Короткая фраза", { onend: () => ends++, onerror: () => errs++ }); } finally { global.setTimeout = real; }
    said[0].onstart();
    window.speechSynthesis.speaking = false;
    fire();
    expect(ends).toBe(1); expect(errs).toBe(0);
  });
  it("не начала читать и молчит — ошибка (экран покажет текст)", () => {
    fakeSynth();
    const real = global.setTimeout; let fire = null;
    global.setTimeout = (fn, ms) => { if (ms >= 4000) { fire = fn; return 1; } return real(fn, ms); };
    let errs = 0;
    try { speakText("Фраза", { onerror: () => errs++ }); } finally { global.setTimeout = real; }
    window.speechSynthesis.speaking = false;
    fire();
    expect(errs).toBe(1);
  });
  it("iPhone узнаём по Telegram и по устройству", () => {
    global.window = { Telegram: { WebApp: { platform: "ios" } } };
    setNav({ userAgent: "Mozilla/5.0 (Linux; Android 14)", platform: "Linux", maxTouchPoints: 5 });
    expect(isAppleMobile()).toBe(true);
    global.window = {};
    expect(isAppleMobile()).toBe(false);
    setNav({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 });
    expect(isAppleMobile()).toBe(true);
    setNav({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 });
    expect(isAppleMobile()).toBe(true);   // iPad в режиме «как компьютер»
  });
  it("«разбудить» звук: режим воспроизведения и тихая дорожка на iPhone; потом всё назад", () => {
    _resetSpeech();
    const played = [];
    const session = { type: "auto" };
    setNav({ userAgent: "iPhone", platform: "iPhone", maxTouchPoints: 5, audioSession: session });
    global.URL = { createObjectURL: () => "blob:silence" };
    global.Blob = function B() {};
    global.window = { Telegram: { WebApp: { platform: "ios" } }, Audio: function A() { this.paused = true; this.play = () => { this.paused = false; played.push(this.src); return Promise.resolve(); }; this.pause = () => { this.paused = true; }; this.setAttribute = () => {}; this.addEventListener = () => {}; } };
    const real = global.setTimeout; const later = [];
    global.setTimeout = (fn, ms) => { later.push(fn); return later.length; };
    try {
      audioWake();
      expect(session.type).toBe("playback");
      expect(played).toEqual(["blob:silence"]);
      expect(audioAwake()).toBe(true);
      audioSleep(0);
      later.forEach((f) => f());
      expect(session.type).toBe("auto");
      expect(audioAwake()).toBe(false);
    } finally { global.setTimeout = real; _resetSpeech(); }
  });
  it("беззвучный WAV — одна секунда тишины", () => {
    expect(typeof silentLoopUrl()).toBe("string");
  });
});
