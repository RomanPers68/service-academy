// lib/speech.js — v32 (Доп. 336): голос телефона надёжнее (радио, «Послушать ситуацию»,
// «А теперь — вслух», живой гость).
//
// 1) Беззвучный режим iPhone глушит голос телефона: для iOS это «системный» звук, а не медиа.
//    Обход: пока телефон читает, играет беззвучная дорожка через <audio> — это уже медиа, и
//    iOS переводит звук приложения в режим воспроизведения, как у видео. Плюс
//    navigator.audioSession.type = "playback" там, где он есть (Safari 16.4+). Кончили читать —
//    всё возвращаем (иначе звуки приложения звучали бы и в беззвучном режиме).
// 2) Фраза держится в памяти, пока не дочитана: Safari иногда «собирает» объект фразы раньше
//    времени — тогда конец фразы не приходит и чтение «зависает» на первой фразе.
// 3) Подстраховка: фраза не закончилась за разумное время — считаем её дочитанной.

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";

export function isAppleMobile() {
  try {
    const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.platform;
    if (tg === "ios") return true;
    const ua = navigator.userAgent || "";
    return /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
  } catch (e) { return false; }
}

// Беззвучный WAV на секунду (8 кГц, 8 бит): нули — это 128
let silent = null;
export function silentLoopUrl() {
  if (silent !== null) return silent;
  try {
    const n = 8000, buf = new Uint8Array(44 + n), dv = new DataView(buf.buffer);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
    w(0, "RIFF"); dv.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt ");
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    w(36, "data"); dv.setUint32(40, n, true); buf.fill(128, 44);
    silent = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  } catch (e) { silent = ""; }
  return silent;
}

let keep = null;        // <audio> с беззвучной дорожкой
let wanted = false;     // дорожка должна играть
let sleepT = 0;
let sessionSet = false;

function setSession(type) {
  try {
    const s = typeof navigator !== "undefined" ? navigator.audioSession : null;
    if (s && "type" in s) { s.type = type; sessionSet = type !== "auto"; }
  } catch (e) {}
}

// Вызывать прямо по нажатию («Слушать», «Послушать»): iOS разрешает звук только так.
export function audioWake() {
  clearTimeout(sleepT);
  wanted = true;
  setSession("playback");
  if (!isAppleMobile()) return;
  try {
    if (!keep && typeof window.Audio === "function") {
      keep = new window.Audio();
      keep.loop = true; keep.preload = "auto";
      try { keep.setAttribute("playsinline", ""); keep.setAttribute("webkit-playsinline", ""); } catch (e) {}
      // чтение могло «перебить» дорожку — пока она нужна, возвращаем её
      keep.addEventListener("pause", () => { if (wanted && keep) setTimeout(() => { if (wanted && keep && keep.paused) { const p = keep.play(); if (p && p.catch) p.catch(() => {}); } }, 60); });
    }
    if (!keep) return;
    const url = silentLoopUrl();
    if (url && keep.src !== url) keep.src = url;
    if (keep.paused) { const p = keep.play(); if (p && p.catch) p.catch(() => {}); }
  } catch (e) {}
}

// Чтение кончилось — дорожку и режим звука возвращаем (с паузой: между фразами не дёргаем)
export function audioSleep(delay = 1500) {
  clearTimeout(sleepT);
  sleepT = setTimeout(() => {
    wanted = false;
    try { if (keep && !keep.paused) keep.pause(); } catch (e) {}
    if (sessionSet) setSession("auto");
  }, Math.max(0, delay));
}

export function audioAwake() { return wanted; }

// Фразы, которые ещё читаются, — держим ссылки (иначе Safari их «теряет»)
const live = new Set();

// Прочитать фразу. Возвращает { cancel } (отменяет только подстраховку и обработчики этой фразы).
export function speakText(text, opts = {}) {
  const { lang = "ru-RU", rate = 1, pitch = 1, voice = null, volume, onstart, onend, onerror, cancelBefore = false, guard = true } = opts;
  if (!canSpeak() || !text) { if (onerror) setTimeout(() => onerror(new Error("no_tts")), 0); return { cancel() {} }; }
  let done = false, started = false, guardT = 0;
  const u = new window.SpeechSynthesisUtterance(String(text));
  u.lang = lang; u.rate = rate; u.pitch = pitch;
  if (voice) u.voice = voice;
  if (typeof volume === "number") u.volume = volume;
  // страховка: никто больше не читает — через 4 с дорожку «усыпляем» сами (если её забыли выключить)
  const finish = (fn, arg) => { if (done) return; done = true; clearTimeout(guardT); live.delete(u); if (!live.size && wanted) audioSleep(4000); if (fn) fn(arg); };
  u.onstart = () => { started = true; if (onstart) onstart(); };
  u.onend = () => finish(onend);
  u.onerror = (e) => finish(e && (e.error === "interrupted" || e.error === "canceled") ? null : onerror, e);
  live.add(u);
  if (wanted) clearTimeout(sleepT);   // следующая фраза — дорожка нужна дальше
  try {
    if (cancelBefore) window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) { finish(onerror, e); return { cancel() {} }; }
  // подстраховка: ~13 знаков в секунду при обычной скорости, с большим запасом
  if (guard) {
    const ms = Math.max(4000, (String(text).length / 13) * 1000 / Math.max(0.5, rate) * 2.2 + 2500);
    guardT = setTimeout(() => {
      let speaking = false; try { speaking = !!window.speechSynthesis.speaking; } catch (e) {}
      // всё ещё «говорит» без начала — зависло; началось и давно идёт — считаем дочитанной
      if (!started || !speaking) finish(started ? onend : onerror, new Error(started ? "late_end" : "stalled"));
      else finish(onend);
    }, ms);
  }
  return { cancel() { done = true; clearTimeout(guardT); live.delete(u); } };
}

export function stopSpeech() {
  try { if (canSpeak()) window.speechSynthesis.cancel(); } catch (e) {}
  live.clear();
  if (wanted) audioSleep(800);
}

export function _resetSpeech() { try { if (keep) keep.pause(); } catch (e) {} keep = null; wanted = false; clearTimeout(sleepT); live.clear(); }
