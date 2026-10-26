// lib/voice-note.js — v80 (Доп. 393): голос шефа и сомелье — запись, звук для всех телефонов, загрузка.
//
// Запись — MediaRecorder, как у голосового ввода (lib/voice.js). iPhone пишет AAC в mp4 — его играют все.
// Android пишет webm/opus, а iPhone его может не сыграть, поэтому такую запись телефон сам переводит в WAV
// 16 кГц (blobToWav16k — тот же перевод, что для распознавания речи): чуть тяжелее, зато звучит везде.
// Загрузка — функция voice-upload (этап 30, корзина menu-voice); ссылка ложится в карточку блюда.
import { SUPABASE_URL, SUPABASE_KEY, saToken } from "../api/supabase";
import { blobToWav16k } from "./voice";

export const VOICE_MAX_SEC = 60;
export const VOICE_KINDS = {
  chef: { label: "Шеф", title: "Шеф о блюде", hint: "Как рассказать гостю: вкус, подача, история. До минуты" },
  som: { label: "Сомелье", title: "Сомелье: что налить", hint: "Что предложить к блюду и почему. До минуты" },
};

export function canRecord() {
  try { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== "undefined"); } catch (e) { return false; }
}

const ua = () => { try { return navigator.userAgent || ""; } catch (e) { return ""; } };
// Safari (iPhone, iPad, Mac) пишет AAC; Chrome на Android к «audio/mp4» может положить и opus — его переводим
const isSafari = () => /iP(hone|ad|od)/.test(ua()) || (/Safari/.test(ua()) && !/Chrome|Chromium|Android|CriOS|FxiOS|EdgiOS/.test(ua()));
export const keepAsIs = (type) => /mp4a|aac/i.test(type || "") || (/mp4/i.test(type || "") && isSafari());

/** Звук, который сыграет любой телефон: AAC оставляем, остальное — в WAV 16 кГц. */
export async function playableClip(blob) {
  const type = (blob && blob.type) || "";
  if (keepAsIs(type)) return { blob, mime: "audio/mp4" };
  const wav = await blobToWav16k(blob);
  return { blob: wav, mime: "audio/wav" };
}

/**
 * Запись голоса. Возвращает { stop(), cancel() }.
 * onState("rec" | "done" | "idle"), onTick(сек), onLevel(0..1), onDone({ blob, sec }), onError(текст).
 */
export function recordClip({ maxSec = VOICE_MAX_SEC, onState, onTick, onLevel, onDone, onError }) {
  // время записи — по монотонным часам: Date могут перевести (или заморозить в проверках)
  const clock = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
  let mr = null, stream = null, chunks = [], t0 = 0, tick = 0, raf = 0, ac = null, cancelled = false, stopped = false;
  // уборка может прийти дважды (остановили запись, потом закрыли экран): AudioContext закрываем один раз —
  // повторный close() отклоняет обещание, и это всплывало ошибкой страницы
  const cleanup = () => {
    clearInterval(tick); cancelAnimationFrame(raf);
    const a = ac; ac = null;
    if (a) { try { const p = a.close(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    try { stream && stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
    onLevel && onLevel(0);
  };
  if (!canRecord()) { onError && onError("Этот телефон не умеет записывать звук в приложении"); return { stop() {}, cancel() {} }; }
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then((st) => {
    stream = st;
    if (stopped || cancelled) { cleanup(); onState && onState("idle"); return; }
    const mime = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]
      .find((m) => { try { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || "";
    mr = new MediaRecorder(st, mime ? { mimeType: mime } : undefined);
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      const sec = Math.max(0, Math.round((clock() - t0) / 100) / 10);
      cleanup();
      if (cancelled) { onState && onState("idle"); return; }
      if (!chunks.length || sec < 1.5) { onState && onState("idle"); onError && onError("Слишком коротко. Нажми и говори хотя бы пару секунд"); return; }
      onState && onState("done");
      onDone && onDone({ blob: new Blob(chunks, { type: mr.mimeType || mime || "audio/mp4" }), sec: Math.min(maxSec, Math.round(sec)) });
    };
    // уровень громкости — чтобы было видно, что микрофон слышит
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaStreamSource(st), an = ac.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const loop = () => { an.getByteTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        onLevel && onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3.2)); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    } catch (e) {}
    t0 = clock();
    tick = setInterval(() => {
      const s = (clock() - t0) / 1000;
      onTick && onTick(Math.min(maxSec, Math.floor(s)));
      if (s >= maxSec) { try { if (mr.state !== "inactive") mr.stop(); } catch (e) {} }
    }, 250);
    mr.start(250); onState && onState("rec");
  }).catch(() => { cleanup(); onState && onState("idle"); onError && onError("Нет доступа к микрофону. Разреши его в настройках Telegram или браузера"); });
  return {
    stop() { stopped = true; try { if (mr && mr.state !== "inactive") mr.stop(); else cleanup(); } catch (e) { cleanup(); } },
    cancel() { cancelled = true; try { if (mr && mr.state !== "inactive") mr.stop(); else cleanup(); } catch (e) { cleanup(); } },
  };
}

const toDataUrl = (blob, mime) => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => { const s = String(fr.result); res(mime ? s.replace(/^data:[^;,]*/, "data:" + mime) : s); };
  fr.onerror = rej; fr.readAsDataURL(blob);
});

// Ответ сервера → понятная причина (как у фото блюда)
export function voiceErrorText(status, j) {
  if (status === 404 || (j && /not found/i.test(String(j.message || j.msg || "")))) return "функция voice-upload не развёрнута в Supabase (Edge Functions → Deploy a new function → Via Editor → имя voice-upload)";
  if (j && j.error === "auth") return "сервер не подтвердил вход — выйди и войди по коду заново";
  if (j && j.error === "forbidden") return "записывать голос к блюдам может менеджер, старший или владелец";
  if (j && j.error === "storage") return "хранилище: " + (j.detail || "ошибка") + (/bucket not found/i.test(String(j.detail || "")) ? ". Нет корзины menu-voice — запусти этап 30 (supabase-stage30-voice.sql)" : "");
  if (j && j.error === "too_large") return "запись больше 3 МБ — сделай короче";
  if (j && j.error === "too_short") return "запись слишком короткая";
  if (j && j.error === "bad_type") return "телефон записал звук в незнакомом формате (" + (j.detail || "?") + ")";
  if (j && (j.error || j.detail)) return String(j.error || "") + (j.detail ? ": " + j.detail : "");
  return "HTTP " + status;
}

const call = (body) => fetch(`${SUPABASE_URL}/functions/v1/voice-upload`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
  body: JSON.stringify({ token: saToken(), ...body }),
});

/** Загрузить запись к блюду. → { ok, url } или { ok:false, why } */
export async function uploadClip({ restaurant, dishId, kind, blob }) {
  try {
    const { blob: b, mime } = await playableClip(blob);
    const audio = await toDataUrl(b, mime);
    const r = await call({ restaurant, dishId, kind, audio });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (j && j.ok && j.url) return { ok: true, url: j.url };
    return { ok: false, why: voiceErrorText(r.status, j) };
  } catch (e) {
    return { ok: false, why: /decode|audio/i.test(String(e && e.message)) ? "не получилось обработать запись — попробуй ещё раз" : "нет связи с сервером" };
  }
}

/** После публикации меню: сервер убирает файлы, на которые меню больше не ссылается (старше 14 дней).
 *  Перезаписанную или убранную запись сразу не удаляем — блюдо с ней могло остаться на другом телефоне. */
export function sweepVoices(restaurant) {
  if (!restaurant) return Promise.resolve(false);
  return call({ restaurant, sweep: true }).then((r) => r.ok).catch(() => false);
}

/** «0:42» */
export const clipTime = (sec) => { const s = Math.max(0, Math.round(Number(sec) || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

/** Записи блюда, которые можно слушать: [{ kind, url, sec, name, at }] — шеф, потом сомелье. */
export function dishVoices(d) {
  const v = (d && d.voice) || {};
  return Object.keys(VOICE_KINDS).filter((k) => v[k] && v[k].url).map((k) => ({ kind: k, ...v[k] }));
}

// ── v86 (Доп. 399): скорость и «прослушано» — на этом телефоне ───────────────────
const RATE_KEY = "sa_voice_rate", HEARD_KEY = "sa_voice_heard", HEARD_MAX = 400;
const store = (ls) => ls || (typeof localStorage !== "undefined" ? localStorage : null);
export const VOICE_RATES = [1, 1.5];
/** Скорость записей шефа и сомелье: 1 или 1,5 (как выбрал человек в плеере). */
export function voiceRate(ls) { try { const v = Number(store(ls).getItem(RATE_KEY)); return VOICE_RATES.includes(v) ? v : 1; } catch (e) { return 1; } }
export function setVoiceRate(r, ls) { try { store(ls).setItem(RATE_KEY, String(VOICE_RATES.includes(r) ? r : 1)); } catch (e) {} }
export const nextRate = (r) => (r === 1 ? 1.5 : 1);
export const rateLabel = (r) => (r === 1.5 ? "1,5×" : "1×");
/** Ключ записи — её ссылка: перезаписали — новая ссылка, «прослушано» снимается само. */
export const heardKey = (v) => String((v && v.url) || "").replace(/^[a-z]+:\/\/[^/]+/i, "").replace(/\?.*$/, "").slice(-160);
export function heardSet(ls) { try { const o = JSON.parse(store(ls).getItem(HEARD_KEY) || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
export const isHeard = (v, set) => { const k = heardKey(v); return !!(k && set && set[k]); };
export function markHeard(v, ls) {
  const k = heardKey(v);
  if (!k) return;
  const o = heardSet(ls);
  o[k] = Date.now();
  const keys = Object.keys(o);
  if (keys.length > HEARD_MAX) keys.sort((a, b) => o[a] - o[b]).slice(0, keys.length - HEARD_MAX).forEach((x) => delete o[x]);
  try { store(ls).setItem(HEARD_KEY, JSON.stringify(o)); } catch (e) {}
}
