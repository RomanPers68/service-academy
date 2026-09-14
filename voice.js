// Голосовой ввод: три слоя надёжности.
//  1) встроенное распознавание браузера (Android-Telegram часто умеет);
//  2) запись микрофона → серверная функция stt (OpenRouter слушает аудио) —
//     путь для iPhone, где WebView распознавать не умеет;
//  3) ничего не доступно → подсказка про микрофон клавиатуры.
// startVoice возвращает stop(); onState: "listening" | "processing" | "idle".
export function voiceSupported() {
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const rec = typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== "undefined";
  return !!(SR || rec);
}

// Дополнение 124: запись браузера (webm/opus на Android, mp4/aac на iPhone) →
// WAV 16 кГц моно прямо на телефоне. WAV — единственный формат, который
// одинаково понимают все модели распознавания; webm Gemini не принимает.
async function blobToWav16k(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const raw = await blob.arrayBuffer();
  const ac = new AC();
  let audio;
  try {
    audio = await new Promise((res, rej) => {
      const p = ac.decodeAudioData(raw.slice(0), res, rej);
      if (p && p.then) p.then(res, rej);
    });
  } finally { try { ac.close(); } catch (e) {} }
  const ch = audio.numberOfChannels, len = audio.length, mono = new Float32Array(len);
  for (let c = 0; c < ch; c++) { const d = audio.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += d[i] / ch; }
  const srcRate = audio.sampleRate, dstRate = 16000;
  const outLen = Math.max(1, Math.round(len * dstRate / srcRate));
  const bytes = new ArrayBuffer(44 + outLen * 2), v = new DataView(bytes);
  const tag = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  tag(0, "RIFF"); v.setUint32(4, 36 + outLen * 2, true); tag(8, "WAVE");
  tag(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, dstRate, true); v.setUint32(28, dstRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  tag(36, "data"); v.setUint32(40, outLen * 2, true);
  for (let i = 0; i < outLen; i++) {
    const pos = i * srcRate / dstRate, i0 = Math.floor(pos), i1 = Math.min(i0 + 1, len - 1), t = pos - i0;
    const s = Math.max(-1, Math.min(1, mono[i0] * (1 - t) + mono[i1] * t));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}

// Ответ сервера → понятная человеку причина (раньше любая беда звучала одинаково)
function sttErrorText(status, j) {
  if (status === 404) return "Функция stt не развёрнута в Supabase — см. CHANGES.md, Дополнение 124";
  if (j && j.error === "no_key") return "На сервере нет ключа OpenRouter (секрет OPENROUTER_API_KEY)";
  if (j && j.error === "provider") return "Распознавание: " + String(j.detail || "ошибка провайдера").slice(0, 140);
  if (j && j.error === "not_deployed") return "Распознавание не подключено на сервере — надиктуй микрофоном клавиатуры";
  return "Не удалось распознать — попробуй ещё раз или микрофон клавиатуры";
}

export function startVoice({ onText, onState, onError, onLevel, sttUrl, headers, maxMs = 30000 }) {
  // Слой 1 — запись + сервер stt: единственный путь, который работает и в iOS-,
  // и в Android-Telegram (встроенное распознавание в WebView часто «есть, но мертво»)
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== "undefined" && sttUrl) {
    let mr = null, chunks = [], stream = null, stopped = false;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(st => {
      if (stopped) { st.getTracks().forEach(t => t.stop()); return; }
      stream = st;
      const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
      mr = new MediaRecorder(st, mime ? { mimeType: mime } : undefined);
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        st.getTracks().forEach(t => t.stop());
        if (!chunks.length) { onState("idle"); return; }
        onState("processing");
        try {
          const recorded = new Blob(chunks, { type: mr.mimeType || mime || "audio/mp4" });
          let blob = recorded, fmt;
          try { blob = await blobToWav16k(recorded); fmt = "wav"; }
          catch (e) { fmt = /mp4|m4a|aac/.test(recorded.type) ? "m4a" : /ogg/.test(recorded.type) ? "ogg" : /webm/.test(recorded.type) ? "webm" : "wav"; }
          const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
          const r = await fetch(sttUrl, { method: "POST", headers: { "Content-Type": "application/json", ...(headers || {}) }, body: JSON.stringify({ audio: b64, format: fmt }) });
          let j = null; try { j = await r.json(); } catch (e) {}
          if (j && j.text) onText(String(j.text).trim());
          else if (j && r.ok && j.text === "") onError("Речи не услышал — скажи ближе к микрофону");
          else onError(sttErrorText(r.status, j));
        } catch (e) { onError("Нет связи с распознаванием — надиктуй микрофоном клавиатуры"); }
        onState("idle");
      };
      // Кнопка «слышит»: RMS с микрофона → onLevel(0..1)
      let ac = null, raf = 0;
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const src = ac.createMediaStreamSource(st), an = ac.createAnalyser(); an.fftSize = 512; src.connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const tick = () => { an.getByteTimeDomainData(buf); let sum = 0;
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
          onLevel && onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3.2)); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      } catch (e) {}
      const cleanup = () => { cancelAnimationFrame(raf); try { ac && ac.close(); } catch (e) {} onLevel && onLevel(0); };
      mr.addEventListener("stop", cleanup, { once: true });
      const timer = setTimeout(() => { try { if (mr.state !== "inactive") mr.stop(); } catch (e) {} }, maxMs);
      mr.addEventListener("stop", () => clearTimeout(timer), { once: true });
      mr.start(); onState("listening");
    }).catch(() => { onState("idle"); onError("Нет доступа к микрофону — разреши в настройках Telegram"); });
    return () => { stopped = true; try { if (mr && mr.state !== "inactive") mr.stop(); else if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {} };
  }
  // Слой 2 — распознавание браузера (если сервер недоступен)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    try {
      const r = new SR();
      r.lang = "ru-RU"; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false;
      let done = false;
      r.onresult = (e) => { done = true; const t = Array.from(e.results).map(x => x[0] && x[0].transcript).filter(Boolean).join(" ").trim(); if (t) onText(t); onState("idle"); };
      r.onerror = (e) => { done = true; onState("idle"); if (e && e.error === "not-allowed") onError("Нет доступа к микрофону — разреши в настройках Telegram"); else onError("Не расслышал — попробуй ещё раз"); };
      r.onend = () => { if (!done) onState("idle"); };
      r.start(); onState("listening");
      return () => { try { r.stop(); } catch (e) {} };
    } catch (e) { /* падаем на слой 2 */ }
  }
  onError("В этом Telegram голосовой ввод недоступен — используй микрофон на клавиатуре");
  return () => {};
}
