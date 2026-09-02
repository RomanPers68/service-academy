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
          const blob = new Blob(chunks, { type: mr.mimeType || mime || "audio/mp4" });
          const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
          const fmt = /mp4|m4a|aac/.test(blob.type) ? "m4a" : /ogg/.test(blob.type) ? "ogg" : /webm/.test(blob.type) ? "webm" : "wav";
          const r = await fetch(sttUrl, { method: "POST", headers: { "Content-Type": "application/json", ...(headers || {}) }, body: JSON.stringify({ audio: b64, format: fmt }) });
          const j = await r.json();
          if (j && j.text) onText(String(j.text).trim());
          else onError(j && j.error === "not_deployed" ? "Распознавание не подключено на сервере — надиктуй микрофоном клавиатуры" : "Не удалось распознать — попробуй ещё раз или микрофон клавиатуры");
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
