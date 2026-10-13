// lib/speech.js — v32 (Доп. 336): голос телефона надёжнее (радио, «Послушать ситуацию»,
// «А теперь — вслух», живой гость).
//
// 1) Фраза держится в памяти, пока не дочитана: Safari иногда «собирает» объект фразы раньше
//    времени — тогда конец фразы не приходит и чтение «зависает» на первой фразе.
// 2) Подстраховка: фраза не закончилась за разумное время — считаем её дочитанной.
// 3) v33 (Доп. 341): «тихая дорожка» и Audio Session больше НЕ включаются. В v32 на время чтения
//    играла беззвучная медиадорожка (чтобы голос был слышен и в беззвучном режиме iPhone), но в
//    Telegram на iPhone она перебивала сам голос: фраза начиналась и через долю секунды
//    обрывалась, выпуск останавливался. Голос телефона снова звучит сам по себе, как в v31;
//    беззвучный режим iPhone его глушит — об этом подсказка в радио. audioWake / audioSleep
//    остались (их зовут экраны), но только помечают, что звук нужен.

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

let keep = null;        // v32: <audio> с беззвучной дорожкой (v33: больше не создаётся)
let wanted = false;     // звук нужен (идёт чтение)
let sleepT = 0;

// Вызывать прямо по нажатию («Слушать», «Послушать»). v33: только помечает, что звук нужен, —
// беззвучная дорожка и Audio Session «playback» мешали голосу телефона в Telegram на iPhone.
export function audioWake() {
  clearTimeout(sleepT);
  wanted = true;
}

// Чтение кончилось (с паузой: между фразами не дёргаем)
export function audioSleep(delay = 1500) {
  clearTimeout(sleepT);
  sleepT = setTimeout(() => {
    wanted = false;
    try { if (keep && !keep.paused) keep.pause(); } catch (e) {}
  }, Math.max(0, delay));
}

export function audioAwake() { return wanted; }

// Фразы, которые ещё читаются, — держим ссылки (иначе Safari их «теряет»): фраза → её ручка
const live = new Map();
// v33 (ревью): фразы, которые ждут запуска (пауза после отмены), — чтобы «Стоп» отменял и их
const waiting = new Set();
let lastCancelAt = 0;
const nowMs = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
const PAUSE_AFTER_CANCEL = 90;

// v33: единая отмена голоса телефона. Отменяем, только если он и правда читает (или наша фраза
// ещё не закончилась), — и запоминаем время: следующая фраза уйдёт не раньше чем через 90 мс
// (сразу после cancel() телефон иногда «глотает» следующую). Возвращает, была ли отмена.
export function cancelSpeech() {
  if (!canSpeak()) return false;
  let busy = live.size > 0;
  try { const ss = window.speechSynthesis; busy = busy || !!(ss.speaking || ss.pending); if (busy) ss.cancel(); } catch (e) {}
  // отменённые фразы — молча (без «конца» и «ошибки» потом от подстраховки)
  if (busy) { [...live.values()].forEach((h) => h.cancel()); lastCancelAt = nowMs(); }
  return busy;
}

// Прочитать фразу. Возвращает { cancel } (отменяет подстраховку, обработчики и ещё не начавшийся запуск этой фразы).
export function speakText(text, opts = {}) {
  const { lang = "ru-RU", rate = 1, pitch = 1, voice = null, volume, onstart, onend, onerror, cancelBefore = false, guard = true, delay = 0 } = opts;
  if (!canSpeak() || !text) { if (onerror) setTimeout(() => onerror(new Error("no_tts")), 0); return { cancel() {} }; }
  let done = false, started = false, guardT = 0, startT = 0;
  const u = new window.SpeechSynthesisUtterance(String(text));
  u.lang = lang; u.rate = rate; u.pitch = pitch;
  if (voice) u.voice = voice;
  if (typeof volume === "number") u.volume = volume;
  const handle = { cancel() { done = true; clearTimeout(guardT); clearTimeout(startT); startT = 0; live.delete(u); waiting.delete(handle.cancel); } };
  // страховка: никто больше не читает — через 4 с звук «усыпляем» сами (если его забыли выключить)
  const finish = (fn, arg) => { if (done) return; done = true; clearTimeout(guardT); live.delete(u); waiting.delete(handle.cancel); if (!live.size && wanted) audioSleep(4000); if (fn) fn(arg); };
  u.onstart = () => { started = true; if (onstart) onstart(); };
  u.onend = () => finish(onend);
  u.onerror = (e) => finish(e && (e.error === "interrupted" || e.error === "canceled") ? null : onerror, e);
  if (wanted) clearTimeout(sleepT);   // следующая фраза — звук нужен дальше
  const go = () => {
    startT = 0; waiting.delete(handle.cancel);
    if (done) return;
    try { window.speechSynthesis.speak(u); } catch (e) { finish(onerror, e); return; }
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
  };
  let wait = Math.max(0, Number(delay) || 0);
  if (cancelBefore) {
    // v33 (Доп. 341): прежние фразы (и те, что ждут запуска) — отменяем, только если телефон и правда
    // читает. Телефон молчал — читаем сразу: на iPhone первая фраза должна уйти прямо по нажатию
    [...waiting].forEach((c) => c());
    cancelSpeech();
  }
  const since = nowMs() - lastCancelAt;
  if (lastCancelAt && since >= 0 && since < PAUSE_AFTER_CANCEL) wait = Math.max(wait, Math.ceil(PAUSE_AFTER_CANCEL - since));
  live.set(u, handle);
  if (wait) { waiting.add(handle.cancel); startT = setTimeout(go, wait); } else go();
  return handle;
}

export function stopSpeech() {
  [...waiting].forEach((c) => c());
  cancelSpeech();
  live.clear();
  if (wanted) audioSleep(800);
}

export function _resetSpeech() { try { if (keep) keep.pause(); } catch (e) {} keep = null; wanted = false; clearTimeout(sleepT); live.clear(); waiting.clear(); lastCancelAt = 0; }
