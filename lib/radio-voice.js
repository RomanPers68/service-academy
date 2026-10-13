// lib/radio-voice.js — v31: «живые голоса» для «Радио в дорогу».
//
// Голоса озвучивает функция radio-tts (OpenAI TTS по ключу на сервере, каждая фраза — один раз,
// дальше из кэша в Storage). Нет функции или ключа — приложение читает голосом телефона, как раньше.
// Здесь: проверка «есть ли живые голоса» (раз за сессию), ссылки на фразы с кэшем и беззвучный
// WAV — им звук «будится» по касанию (iOS даёт играть звук только по нажатию).
import { SUPABASE_URL, SUPABASE_KEY, saToken } from "../api/supabase";

const PREF = "sa_radio_live";
const OK_KEY = "sa_radio_live_ok";
let probe = null;            // Promise<boolean>
const urls = new Map();      // who|text → Promise<string>

export function liveVoicePref() { try { return localStorage.getItem(PREF) !== "0"; } catch (e) { return true; } }
export function setLiveVoicePref(on) { try { localStorage.setItem(PREF, on ? "1" : "0"); } catch (e) {} }

const call = (body) => fetch(`${SUPABASE_URL}/functions/v1/radio-tts`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
  body: JSON.stringify({ token: saToken(), ...body }),
}).then((r) => r.json());

// Есть ли живые голоса: функция развёрнута и ключ задан. Ясный ответ («есть» / «не подключены»)
// помним до конца сессии. v36: сбой связи, входа или сервера больше НЕ запоминаем — раньше один
// такой сбой (или проверка до того, как функцию развернули) выключал живые голоса до перезапуска.
export function liveVoiceAvailable() {
  if (!probe) {
    try { const c = sessionStorage.getItem(OK_KEY); if (c === "1" || c === "0") probe = Promise.resolve(c === "1"); } catch (e) {}
  }
  if (!probe) {
    const p = call({ probe: true }).then((j) => {
      // transient (v36): функция есть, но хранилище не ответило — это не «живых голосов нет»
      const sure = !!(j && ((j.ok === true && !j.transient) || j.error === "not_configured"));
      const ok = !!(j && j.ok && j.configured);
      if (sure) { try { sessionStorage.setItem(OK_KEY, ok ? "1" : "0"); } catch (e) {} }
      else if (probe === p) probe = null;   // спросим снова, когда радио откроют ещё раз
      return ok;
    }, () => { if (probe === p) probe = null; return false; });
    probe = p;
  }
  return probe;
}

// Ссылка на mp3 фразы. Ошибка — с кодом: not_configured | daily_limit | auth | provider | сеть;
// v36: и с причиной от функции (detail — что ответил OpenRouter), её радио показывает в скобках
export function voiceUrl(who, text) {
  const k = who + "|" + text;
  if (!urls.has(k)) {
    const p = call({ who, text }).then((j) => {
      if (j && j.ok && j.url) return j.url;
      const code = (j && j.error) || "tts";
      if (code === "not_configured") { probe = Promise.resolve(false); try { sessionStorage.setItem(OK_KEY, "0"); } catch (e) {} }
      const err = new Error(code); err.code = code; err.detail = (j && j.detail) || ""; throw err;
    });
    p.catch(() => urls.delete(k));
    urls.set(k, p);
  }
  return urls.get(k);
}

// v36 (Доп. 347): почему живые голоса не ответили — коротко, в скобках (по скриншоту видно причину:
// модель, ключ, кредиты, счётчик). Длинную причину обрезаем; «tts» и «media» — без скобок
export function liveWhy(code, detail) {
  const d = String(detail || "").replace(/\s+/g, " ").trim();
  if (d) return " (" + (d.length > 72 ? d.slice(0, 71) + "…" : d) + ")";
  return code && !/^(tts|media)$/.test(String(code)) ? " (" + String(code).slice(0, 24) + ")" : "";
}

// Беззвучный WAV на 0,1 с: играем его прямо по нажатию «Слушать» — дальше тот же
// элемент <audio> может играть фразы, которые приходят с сервера позже
let silent = null;
export function silentUrl() {
  if (silent !== null) return silent;
  try {
    const n = 800, buf = new Uint8Array(44 + n), dv = new DataView(buf.buffer);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
    w(0, "RIFF"); dv.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt ");
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    w(36, "data"); dv.setUint32(40, n, true); buf.fill(128, 44);
    silent = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  } catch (e) { silent = ""; }
  return silent;
}

export function _resetRadioVoice() { probe = null; urls.clear(); }
