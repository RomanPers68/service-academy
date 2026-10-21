// v36 (Доп. 345–347): лента трека и обложки радио — всегда шириной в пять мест (у краёв — пустые места,
// иначе на iPhone слой ленты «перескакивал» между порогами WebKit и меню пропадало); радио с голосом
// телефона — без Media Session (WebKit сам нажимал «пауза», когда телефон начинал читать); почему живой
// голос не ответил — в скобках; длинный ответ Наставника вслух — начало и «Остальное — в чате».
// В браузере всё это проверяет tools/claude/e2e-v36.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { clipSpeech, MORE_IN_CHAT, speechText, speechChunks, whyNot } from "../lib/talk";

// lib/radio-voice: поддельные sessionStorage / localStorage / fetch (ответы функции — по очереди)
const store = {};
global.sessionStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
global.localStorage = { getItem: () => "tok-test", setItem() {}, removeItem() {} };
const answers = [];
let fetches = 0;
global.fetch = async () => { fetches++; const a = answers.shift(); if (a instanceof Error) throw a; return { json: async () => a }; };
const RV = await import("../lib/radio-voice");
const reset = () => { RV._resetRadioVoice(); for (const k of Object.keys(store)) delete store[k]; answers.length = 0; fetches = 0; };

describe("разговор голосом: длинный ответ — вслух начало и «Остальное — в чате» (Доп. 347)", () => {
  it("короткий ответ — как есть", () => {
    const t = "Предложи десерт, когда уносишь тарелки. Назови один — свой любимый.";
    expect(clipSpeech(t, 600)).toBe(t);
    expect(clipSpeech(t, 0)).toBe(t);
  });
  it("длинный — по концу предложения, не длиннее предела, и «Остальное — в чате.»", () => {
    const s = "Приди за двадцать минут до смены и посмотри график столов. ";
    const t = s.repeat(20).trim();
    const c = clipSpeech(t, 600);
    expect(c.endsWith(" " + MORE_IN_CHAT)).toBe(true);
    const head = c.slice(0, -(MORE_IN_CHAT.length + 1));
    expect(head.length).toBeLessThanOrEqual(600);
    expect(head.length).toBeGreaterThan(500);
    expect(/столов\.$/.test(head)).toBe(true);
    // и это нарезается на куски для озвучки, как обычный ответ
    expect(speechChunks(c).join(" ")).toBe(c);
  });
  it("точка внутри «18.00» на самой границе — не конец предложения (ревью)", () => {
    const pre = "Начни смену спокойно и без спешки. ".repeat(4);   // 4 × 35 = 140 знаков
    const t = (pre + "Приходи в 18.00 и сразу проверь свой стол и приборы.").trim();
    const at = t.indexOf("18.00") + 2;   // точка «18.» — ровно на пределе
    const c = clipSpeech(t, at + 1);
    expect(c).not.toMatch(/в 18\. Остальное/);
    expect(c).toBe(pre.trim() + " " + MORE_IN_CHAT);
  });
  it("одно огромное предложение — по слову, с «…»", () => {
    const t = ("очень длинная мысль без точки " ).repeat(40).trim();
    const c = clipSpeech(t, 300);
    expect(c).toMatch(/… Остальное — в чате\.$/);
    expect(c.length).toBeLessThan(300 + 25);
  });
  it("заголовок с двоеточием и список: «помогает:. Приди» больше не получается", () => {
    const t = speechText("**Вот что реально помогает:**\n\n1. Приди за 20 минут до смены\n2. Пройди разминку");
    expect(t).toBe("Вот что реально помогает: Приди за 20 минут до смены. Пройди разминку");
  });
});

describe("почему живой голос не ответил — в скобках (Доп. 347)", () => {
  it("причина от функции (что ответил OpenRouter)", () => {
    const e = new Error("provider"); e.code = "provider"; e.detail = "OpenRouter 404: No endpoints found matching your data policy";
    expect(whyNot(e)).toBe(" (OpenRouter 404: No endpoints found matching your data policy)");
  });
  it("длинная причина — обрезана", () => {
    const e = new Error("provider"); e.code = "provider"; e.detail = "x".repeat(200);
    expect(whyNot(e).length).toBeLessThanOrEqual(75);
    expect(whyNot(e)).toMatch(/…\)$/);
  });
  it("долго нет ответа, нет связи, код без причины, без кода", () => {
    const t = new Error("timeout"); t.code = "timeout";
    expect(whyNot(t)).toBe(" (долго нет ответа)");
    expect(whyNot(new TypeError("Load failed"))).toBe(" (нет связи)");
    const p = new Error("auth"); p.code = "auth";
    expect(whyNot(p)).toBe(" (auth)");
    const x = new Error("tts"); x.code = "tts";
    expect(whyNot(x)).toBe("");
  });
  it("радио: та же причина в строке «Живые голоса не отвечают (…)»", () => {
    expect(RV.liveWhy("provider", "OpenRouter: закончились кредиты (402)")).toBe(" (OpenRouter: закончились кредиты (402))");
    expect(RV.liveWhy("server", "")).toBe(" (server)");
    expect(RV.liveWhy("media", "")).toBe("");
    expect(RV.liveWhy(undefined, "")).toBe("");
  });
});

describe("радио: есть ли живые голоса — сбой не запоминаем (Доп. 347)", () => {
  it("нет связи — «нет», но в следующий раз спросим снова; ответ «есть» — запомнили", async () => {
    reset();
    answers.push(new Error("net"));
    expect(await RV.liveVoiceAvailable()).toBe(false);
    expect(store.sa_radio_live_ok).toBe(undefined);
    answers.push({ ok: true, configured: true, talk: true });
    expect(await RV.liveVoiceAvailable()).toBe(true);
    expect(store.sa_radio_live_ok).toBe("1");
    expect(fetches).toBe(2);
    expect(await RV.liveVoiceAvailable()).toBe(true);
    expect(fetches).toBe(2);
  });
  it("вход не подтвердился — не запоминаем; «не подключены» — запоминаем", async () => {
    reset();
    answers.push({ ok: false, error: "auth" });
    expect(await RV.liveVoiceAvailable()).toBe(false);
    expect(store.sa_radio_live_ok).toBe(undefined);
    answers.push({ ok: false, error: "not_configured" });
    expect(await RV.liveVoiceAvailable()).toBe(false);
    expect(store.sa_radio_live_ok).toBe("0");
    expect(await RV.liveVoiceAvailable()).toBe(false);
    expect(fetches).toBe(2);
  });
  it("функция есть, но хранилище не ответило (transient) — не запоминаем", async () => {
    reset();
    answers.push({ ok: true, configured: false, talk: true, transient: true });
    expect(await RV.liveVoiceAvailable()).toBe(false);
    expect(store.sa_radio_live_ok).toBe(undefined);
    answers.push({ ok: true, configured: true, talk: true });
    expect(await RV.liveVoiceAvailable()).toBe(true);
    expect(fetches).toBe(2);
  });
  it("фраза не озвучилась — ошибка с кодом и причиной", async () => {
    reset();
    answers.push({ ok: false, error: "provider", detail: "OpenRouter 404: model not found" });
    let err = null;
    try { await RV.voiceUrl("host", "Радио в дорогу."); } catch (e) { err = e; }
    expect(err && err.code).toBe("provider");
    expect(err && err.detail).toBe("OpenRouter 404: model not found");
  });
});

describe("исходники v36", () => {
  const radio = readFileSync("ui/radio.jsx", "utf8");
  const track = readFileSync("ui/screens-learning.jsx", "utf8");
  const css = readFileSync("ui/table-css.js", "utf8");
  const tts = readFileSync("supabase/functions/radio-tts/index.ts", "utf8");
  const chat = readFileSync("supabase/functions/ai-chat/index.ts", "utf8");
  const asst = readFileSync("ui/assistant.jsx", "utf8");
  it("трек: пустые места окна — невидимые, без нажатий, на всю высоту ленты", () => {
    expect(track).toMatch(/\[-2, -1, 1, 2\]\.filter\(\(k\) => !win\.some\(\(w\) => w\.k === k\)\)/);
    expect(track).toContain('className="tbp-side tbp-gap"');
    expect(css).toContain(".tbp-gap{bottom:0;min-height:1px}");
  });
  it("радио: пустые места ленты обложек", () => {
    expect(radio).toContain('className="rd-gap"');
    expect(radio).toMatch(/\.rd-gap\{position:absolute;top:0;bottom:0;[^}]*pointer-events:none\}/);
  });
  it("радио: Media Session — только с живыми голосами; голос телефона не «будим» беззвучной фразой", () => {
    expect(radio).toContain("const msOn = liveRef.current && !(playing && phoneVoice);");
    expect(radio).toMatch(/ms\.playbackState = msOn && e \? \(playing \? "playing" : "paused"\) : "none"/);
    expect(radio).not.toMatch(/speakText\(" ", \{ volume: 0/);
    expect(radio).toContain("a.onpause = () => { if (gen.current === my && !a.ended)");
    expect(radio).toContain("data-radio-paused");
  });
  it("radio-tts: без неверного короткого id модели; причина — от основной модели", () => {
    expect(tts).not.toMatch(/"openai\/gpt-4o-mini-tts"[,\]]/);
    expect(tts).toContain('"openai/gpt-4o-mini-tts-2025-12-15"]');
    expect(tts).toContain("if (!first) first = f;");
  });
  it("ai-chat: разговор голосом — короткий ответ (voice)", () => {
    expect(chat).toMatch(/const \{ token, messages, mode, guest: guestIn, finish, stream, voice \}/);
    // v67: подсказка Наставника из двух частей (кэш), лимит — через genOpts (у Claude 5.x ×1,35)
    expect(chat).toContain("const tail = parts.personal + (voice ? VOICE_MODE : \"\");");
    expect(chat).toContain('...genOpts(m, voice ? 280 : 520, 0.6, voice ? "off" : "low")');   // голосом — без размышлений
    expect(asst).toContain("messages: sent, voice: true");
    expect(asst).toContain("maxSpeak={VOICE_MAX}");
  });
});
