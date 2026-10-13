// lib/talk.js — v34 (Доп. 343): «Разговор голосом» — как кнопка-волна в Claude, только пошагово.
//
// Цикл: включаю микрофон → слушаю (конец фразы — по тишине) → распознаю (функция stt, OpenRouter) →
// думаю (ask — Наставник или живой гость) → говорю (живой голос: функция radio-tts в режиме talk,
// тот же ключ OpenRouter; нет его — голос телефона) → снова слушаю. Без кнопок между репликами.
//
// • Микрофон закрыт, пока собеседник говорит: на iPhone открытый микрофон уводит звук в тихий
//   «телефонный» динамик, а собеседник слышал бы сам себя. Перебить — касанием (tap).
// • Касание кнопки-волны «будит» звук (primeTalk): <audio> (потом играет ответы), AudioContext
//   (разбор тишины) и голос телефона — iPhone разрешает их запускать только по касанию.
// • Долго молчишь, дважды не расслышал, ушёл из приложения — пауза (микрофон закрыт), касание —
//   слушаю снова. Голос телефона молчит — ответ в чате, пауза до касания.
// Всё, что зависит от браузера, — внутри createTalk; разбор тишины (vadStep), текст для озвучки
// (speechText) и нарезка на фразы (speechChunks) — чистые функции, их проверяют тесты.

import { blobToWav16k, sttErrorText } from "./voice";
import { speakText, stopSpeech, canSpeak } from "./speech";

// ── Тишина и речь: шаг разбора уровня микрофона ────────────────────────────────────────────
// st — состояние (null в начале), rms — уровень 0..1, dt — мс с прошлого шага.
// Событие: "start" — заговорил, "end" — договорил (тишина после речи), "timeout" — так и молчит.
// Первые calMs — замер фона (в зале шумно): фон — по самому тихому моменту окна (заговорил сразу —
// голос фоном не станет); порог речи — фон × k, но не ниже minThr. Дальше фон следим: тише —
// быстро вниз, громче — медленно вверх (тихий голос чуть ниже порога не «станет» фоном).
export const VAD = { minThr: 0.035, k: 2.6, calMs: 300, nfMax: 0.08, startMs: 160, silenceMs: 1100, maxSpeechMs: 25000, waitMs: 12000 };
export function vadStep(st, rms, dt, opt = VAD) {
  const s = st ? { ...st } : { nf: 0.012, cal: 0, lo: 1, above: 0, quiet: 0, speech: false, t: 0, idle: 0, done: false };
  let ev = null;
  if (s.done) return { st: s, ev };   // событие конца — один раз
  const r = Math.min(Math.max(0, rms), 0.3);
  if (s.cal < opt.calMs) {
    s.cal += dt; s.idle += dt; s.lo = Math.min(s.lo, r);
    if (s.cal >= opt.calMs) s.nf = Math.max(0.008, Math.min(opt.nfMax, s.lo));
    s.thr = Math.max(opt.minThr, s.nf * opt.k);
    return { st: s, ev };
  }
  const thr = Math.max(opt.minThr, s.nf * opt.k);
  if (!s.speech) {
    s.idle += dt;
    if (rms > thr) { s.above += dt; if (s.above >= opt.startMs) { s.speech = true; s.t = 0; s.quiet = 0; ev = "start"; } }
    else {
      s.above = Math.max(0, s.above - dt);
      s.nf = r < s.nf ? Math.max(0.008, s.nf * 0.8 + r * 0.2) : Math.min(opt.nfMax, s.nf * 0.995 + r * 0.005);
    }
    if (!ev && s.idle >= opt.waitMs) ev = "timeout";
  } else {
    s.t += dt;
    if (rms < thr * 0.75) s.quiet += dt; else s.quiet = 0;
    if (s.quiet >= opt.silenceMs || s.t >= opt.maxSpeechMs) ev = "end";
  }
  if (ev === "end" || ev === "timeout") s.done = true;
  s.thr = thr;
  return { st: s, ev };
}

// ── Текст для голоса: без разметки, ссылок, эмодзи; *действия* гостя — не читаем ──────────
export function speechText(text, { actions = false } = {}) {
  let t = String(text || "").replace(/\[\[[^\]]*\]\]/g, " ");   // кнопки-переходы и метки [[go:…]] — не читаем
  if (actions) t = t.replace(/\*[^*\n]{1,120}\*/g, " ");
  t = t.replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\((?:https?:)?[^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_`#>]+/g, "")
    .replace(/^\s*[-•·]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\.\s*\./g, ".")
    .replace(/([:;,!?…])\.(\s|$)/g, "$1$2")   // v36: «помогает:. Приди» → «помогает: Приди»
    .replace(/\s{2,}/g, " ")
    .trim();
  return t.replace(/^[.,;:\s]+/, "");
}

// v36 (Доп. 347): длинный ответ в разговоре голосом — вслух только начало (до max знаков, по концу
// предложения) и «Остальное — в чате.»: весь ответ остаётся в переписке, как был
export const MORE_IN_CHAT = "Остальное — в чате.";
export function clipSpeech(text, max) {
  const t = String(text || "").trim();
  if (!max || t.length <= max) return t;
  // конец предложения ищем по всему тексту (после точки — пробел или конец), но не дальше предела:
  // «в 18.00» или «т.е.» на самой границе — не конец предложения (ревью v36)
  let cut = -1;
  const re = /[.!?…]+["»)]*(?=\s|$)/g;
  let m;
  while ((m = re.exec(t)) && m.index + m[0].length <= max) cut = m.index + m[0].length;
  if (cut < max * 0.45) {   // одно огромное предложение — режем по слову
    const head = t.slice(0, max);
    const sp = head.lastIndexOf(" ");
    return head.slice(0, sp > 0 ? sp : max).replace(/[,;:\s—–-]+$/, "") + "… " + MORE_IN_CHAT;
  }
  return t.slice(0, cut).trim() + " " + MORE_IN_CHAT;
}

// ── Нарезка на куски для озвучки: по предложениям, до ~240 знаков (первый — короче: быстрее звук) ─
export function speechChunks(text, max = 240, first = 160) {
  const t = String(text || "").trim();
  if (!t) return [];
  const sents = t.match(/[^.!?…]+(?:[.!?…]+["»)]*\s*|$)/g) || [t];
  const out = [];
  let cur = "";
  const lim = () => (out.length ? max : first);
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
  for (let s of sents) {
    s = s.trim(); if (!s) continue;
    while (s.length > lim() + 60) {   // очень длинное предложение — режем по запятой/пробелу
      let cut = s.lastIndexOf(", ", lim()); if (cut < 40) cut = s.lastIndexOf(" ", lim()); if (cut < 40) cut = lim();
      push(); out.push(s.slice(0, cut + 1).trim()); s = s.slice(cut + 1).trim();
    }
    if ((cur + " " + s).trim().length > lim()) push();
    cur = (cur + " " + s).trim();
  }
  push();
  return out;
}

const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());

// ── Есть ли живые голоса для разговора (radio-tts в режиме talk). Ясный ответ — до конца сессии ──
const TTS_OK = "sa_talk_tts";
let ttsProbe = null;
export function talkVoiceAvailable(ttsUrl, headers, token) {
  if (!ttsProbe) {
    try { const c = sessionStorage.getItem(TTS_OK); if (c === "1" || c === "0") ttsProbe = Promise.resolve(c === "1"); } catch (e) {}
  }
  if (!ttsProbe) {
    const p = fetch(ttsUrl, { method: "POST", headers: { "Content-Type": "application/json", ...(headers || {}) }, body: JSON.stringify({ token, probe: true }) })
      .then((r) => r.json().catch(() => null))
      .then((j) => {
        // запоминаем только ясный ответ («есть» / «не подключены»); сбой связи, входа или сервера —
        // спросим снова в следующем разговоре
        const sure = !!(j && (j.ok === true || j.error === "not_configured"));
        const ok = !!(j && j.ok === true && (j.talk || j.configured));
        if (sure) { try { sessionStorage.setItem(TTS_OK, ok ? "1" : "0"); } catch (e) {} }
        else if (ttsProbe === p) ttsProbe = null;
        return ok;
      }, () => { if (ttsProbe === p) ttsProbe = null; return false; });
    ttsProbe = p;
  }
  return ttsProbe;
}
export function _resetTalk() { ttsProbe = null; primed = null; }

// Беззвучный WAV (0,1 с) — «будим» <audio> по касанию
function silentWav() {
  try {
    const n = 800, buf = new Uint8Array(44 + n), dv = new DataView(buf.buffer);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
    w(0, "RIFF"); dv.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt ");
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    w(36, "data"); dv.setUint32(40, n, true); buf.fill(128, 44);
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  } catch (e) { return ""; }
}

// Звук «будим» прямо в обработчике касания кнопки-волны (до отрисовки экрана разговора):
// iPhone разрешает <audio>, AudioContext и голос телефона запускаться только по касанию.
// <audio> потом играет ответы; AudioContext разбирает тишину (запущенный однажды по касанию, дальше
// он включается и без него), голос телефона — запасной. createTalk().start() заберёт их;
// AudioContext работает только при открытом микрофоне — работающий «вхолостую» звук на iPhone мешал
// голосу телефона (v32).
const newAC = () => { const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext); return AC ? new AC() : null; };
let primed = null;
export function primeTalk() {
  try {
    if (primed && primed.ac) { try { primed.ac.close().catch(() => {}); } catch (e) {} }
    let audio = null, silent = "", ac = null;
    try {
      audio = new Audio(); audio.preload = "auto";
      try { audio.setAttribute("playsinline", ""); } catch (e) {}
      silent = silentWav();
      if (silent) { audio.src = silent; const p = audio.play(); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { audio = null; }
    try { ac = newAC(); if (ac && ac.state !== "running") ac.resume().catch(() => {}); } catch (e) { ac = null; }
    // голос телефона: прежнее чтение (первая фраза гостя) — стоп, и «будим» его беззвучной фразой
    try { if (canSpeak()) { stopSpeech(); speakText(" ", { volume: 0, guard: false }); } } catch (e) {}
    primed = { audio, silent, ac, at: now() };
  } catch (e) { primed = null; }
}
const takePrimed = () => {
  const p = primed; primed = null;
  if (p && now() - p.at < 8000) return p;
  try { if (p && p.ac) p.ac.close().catch(() => {}); } catch (e) {}
  return null;
};

// v36 (Доп. 347): почему живой голос не ответил — коротко, в скобках: что ответил OpenRouter или функция
// (по скриншоту видно, что чинить: ключ, кредиты, модель), «долго нет ответа», «нет связи»
export const whyNot = (e) => {
  const d = String((e && e.detail) || "").replace(/\s+/g, " ").trim();
  if (d) return " (" + (d.length > 72 ? d.slice(0, 71) + "…" : d) + ")";
  const c = String((e && e.code) || "");
  if (c === "timeout") return " (долго нет ответа)";
  if (!c && e && e.name === "TypeError") return " (нет связи)";
  return c && c !== "tts" ? " (" + c.slice(0, 24) + ")" : "";
};
const TTS_NOTE = {
  not_configured: "Живые голоса не подключены — отвечает голос телефона.",
  limit: "Живые голоса на сегодня закончились — дальше голос телефона.",
  daily_limit: "Живые голоса на сегодня закончились — дальше голос телефона.",
  rate_limit: "Живые голоса заняты — эту реплику читает голос телефона.",
};
const NOTE = {
  manual: "Договоришь — коснись волны.",
  phoneMute: "Голос телефона молчит — ответ в чате. Прочитай и коснись волны.",
  noMic: "Нет доступа к микрофону — разреши его в настройках Telegram.",
  silence: "Не слышу тебя — микрофон пока выключен.",
  again: "Не расслышал — скажи ещё раз.",
  againTap: "Не расслышал — коснись волны и скажи ещё раз.",
  away: "Разговор на паузе — коснись волны, чтобы продолжить.",
  noReply: "Ответ не пришёл — коснись волны и скажи ещё раз.",
};
// Сколько ждём сервер: распознавание, ответ собеседника, кусок живого голоса
const T_STT = 30000, T_ASK = 60000, T_TTS = 25000;
const withTimeout = (p, ms) => new Promise((res, rej) => {
  const t = setTimeout(() => { const e = new Error("timeout"); e.code = "timeout"; rej(e); }, ms);
  p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
});
const fetchT = (url, init, ms) => {
  let ctl = null; try { ctl = new AbortController(); } catch (e) {}
  return withTimeout(fetch(url, ctl ? { ...init, signal: ctl.signal } : init), ms)
    .catch((e) => { try { if (ctl && e && e.code === "timeout") ctl.abort(); } catch (x) {} throw e; });
};

// ── Сам разговор ───────────────────────────────────────────────────────────────────────────
// opts: ask(text) → Promise<{ text, end }> · first — реплика собеседника в начале · voice — голос
// (guest | guest_f | mentor) · phone — { pitch, rate } для голоса телефона · actions — не читать *действия* ·
// maxSpeak — v36: вслух не больше стольких знаков (дальше «Остальное — в чате.»; 0 — без предела) ·
// sttUrl, ttsUrl, headers, token · события: onState(state), onHeard(text), onReply(text), onLevel(0..1),
// onNote(text), onEnd(reason). Состояния: idle · opening (включаю микрофон) · listening · hearing ·
// recognizing · thinking · speaking · paused.
export function createTalk(opts) {
  const o = opts || {};
  let state = "idle", alive = false, gen = 0;
  let stream = null, rec = null, chunks = [], ac = null, srcNode = null, iv = 0, audio = null, silent = "";
  let live = null;            // null — ещё не знаем; true/false — живые голоса есть / нет
  let noted = false, cutNow = null, ttsFails = 0, phoneMute = false, muteRetry = false, empties = 0, ending = false;
  let wake = null, wakeAsk = false;

  // экран не гаснет, пока идёт разговор; в паузе — гаснет как обычно
  const takeWake = () => {
    if (wake || wakeAsk) return;
    try {
      if (!navigator.wakeLock || !navigator.wakeLock.request) return;
      wakeAsk = true;
      navigator.wakeLock.request("screen").then((l) => {
        wakeAsk = false;
        if (!alive || state === "paused" || state === "idle") { l.release().catch(() => {}); return; }
        wake = l;
        try { l.addEventListener("release", () => { if (wake === l) wake = null; }); } catch (e) {}
      }, () => { wakeAsk = false; });
    } catch (e) { wakeAsk = false; }
  };
  const dropWake = () => { try { if (wake) wake.release().catch(() => {}); } catch (e) {} wake = null; };
  const set = (s) => {
    state = s;
    if (s === "paused" || s === "idle") dropWake(); else if (alive) takeWake();
    try { o.onState && o.onState(s); } catch (e) {}
  };
  // AudioContext разбора работает только при открытом микрофоне: заработал без него (запуск по
  // касанию доехал позже) — сразу «приглушаем»
  const own = (c) => { try { if (c) c.onstatechange = () => { try { if (c === ac && c.state === "running" && !stream) c.suspend().catch(() => {}); } catch (e) {} }; } catch (e) {} return c; };
  const note = (t) => { try { o.onNote && o.onNote(t); } catch (e) {} };
  const level = (v) => { try { o.onLevel && o.onLevel(v); } catch (e) {} };

  const releaseMic = () => {
    clearInterval(iv); iv = 0; cutNow = null;
    try { if (rec && rec.state !== "inactive") { rec.ondataavailable = null; rec.onstop = null; rec.stop(); } } catch (e) {}
    rec = null;
    try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
    stream = null;
    try { if (srcNode) srcNode.disconnect(); } catch (e) {}
    srcNode = null;
    // AudioContext разбора — «приглушить» до следующего «слушаю» (не закрывать: включить его снова
    // iPhone даст и без касания, а новый — нет)
    try { if (ac && ac.state === "running") ac.suspend().catch(() => {}); } catch (e) {}
    level(0);
  };
  const hush = () => {
    try { if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); } } catch (e) {}
    try { stopSpeech(); } catch (e) {}
  };
  const hold = (text) => { gen++; hush(); releaseMic(); if (text) note(text); set("paused"); };

  // ── слушаю ──
  const listen = async () => {
    const my = ++gen;
    hush(); releaseMic();
    set("opening");   // микрофон включается (на iPhone — до секунды); «говори» — когда включится
    let got = null;
    try {
      got = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      if (my !== gen) return;
      note(NOTE.noMic); set("paused"); return;
    }
    // пока ждали микрофон, разговор ушёл дальше (касание, «Завершить») — этот микрофон не нужен;
    // общий stream не трогаем: он уже может принадлежать новому «слушаю»
    if (my !== gen || !alive) { try { got.getTracks().forEach((t) => t.stop()); } catch (e) {} return; }
    stream = got;
    const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); } catch (e) { note("Этот телефон не умеет записывать голос."); set("paused"); releaseMic(); return; }
    chunks = [];
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    let spoke = false, done = false, manT = 0;
    const finish = (why) => {
      if (done || my !== gen) return;
      done = true; clearInterval(iv); iv = 0; cutNow = null;
      const r = rec;
      if (why === "timeout" || !spoke) { releaseMic(); note(NOTE.silence); set("paused"); return; }
      set("recognizing");
      r.onstop = () => { if (my !== gen) return; const blob = new Blob(chunks, { type: r.mimeType || mime || "audio/mp4" }); releaseMic(); heard(blob, my); };
      try { r.stop(); } catch (e) { releaseMic(); set("paused"); }
    };
    cutNow = () => { if (spoke) finish("tap"); };
    // уровень микрофона → тишина / речь. AudioContext — тот, что разбужен касанием кнопки-волны
    // (включаем его на время микрофона); нет его — новый (во время записи iPhone его тоже включает).
    let an = null, fbuf = null, bbuf = null, vs = null, zero = 0, fresh = false;
    const attach = (renew) => {
      an = null;
      try {
        try { if (srcNode) srcNode.disconnect(); } catch (e) {}
        srcNode = null;
        if (renew || !ac || ac.state === "closed") { try { if (ac) ac.close().catch(() => {}); } catch (e) {} ac = own(newAC()); }
        if (!ac) return;
        if (ac.state !== "running") ac.resume().catch(() => {});
        srcNode = ac.createMediaStreamSource(stream); an = ac.createAnalyser(); an.fftSize = 1024; srcNode.connect(an);
        if (an.getFloatTimeDomainData) { fbuf = new Float32Array(an.fftSize); bbuf = null; } else { bbuf = new Uint8Array(an.fftSize); fbuf = null; }
      } catch (e) { an = null; }
    };
    attach(false);
    // живой микрофон не даёт ровного нуля: 2,5 с нулей до первой речи — разбор не работает. Один раз
    // пробуем новый AudioContext; снова нули — конец фразы касанием (или через 25 с)
    const dead = () => { zero = 0; vs = null; if (!fresh) { fresh = true; attach(true); } else an = null; };
    // запись — как у кнопки-микрофона: одним куском при остановке (нарезка на iPhone даёт
    // «рваный» mp4, который потом не всегда разбирается)
    try { rec.start(); } catch (e) { note("Микрофон не включился — попробуй ещё раз."); set("paused"); releaseMic(); return; }
    set("listening");
    let last = now();
    iv = setInterval(() => {
      if (my !== gen) { clearInterval(iv); return; }
      const t = now(), dt = Math.min(250, t - last); last = t;
      if (!an) {
        // разбора уровня нет — фраза идёт, пока не коснёшься волны (или 25 с)
        if (!spoke) { spoke = true; if (state === "listening") set("hearing"); note(NOTE.manual); }
        manT += dt; level(0.3);
        if (manT >= VAD.maxSpeechMs) finish("end");
        return;
      }
      let rms = 0;
      try {
        let sum = 0;
        if (fbuf) { an.getFloatTimeDomainData(fbuf); for (let i = 0; i < fbuf.length; i++) sum += fbuf[i] * fbuf[i]; rms = Math.sqrt(sum / fbuf.length); }
        else { an.getByteTimeDomainData(bbuf); for (let i = 0; i < bbuf.length; i++) { const v = (bbuf[i] - 128) / 128; sum += v * v; } rms = Math.sqrt(sum / bbuf.length); }
      } catch (e) {}
      zero = rms === 0 ? zero + dt : 0;
      if (!spoke && zero >= 2500) { dead(); return; }
      level(Math.min(1, rms * 3.2));
      const r = vadStep(vs, rms, dt); vs = r.st;
      if (r.ev === "start") { spoke = true; if (state === "listening") set("hearing"); }
      if (r.ev === "end" || r.ev === "timeout") finish(r.ev);
    }, 50);
  };

  // ── распознаю ──
  const heard = async (blob, my) => {
    if (my !== gen || !alive) return;
    let text = "";
    try {
      let b = blob, fmt = "wav";
      try { b = await blobToWav16k(blob); } catch (e) { fmt = /mp4|m4a|aac/.test(blob.type) ? "m4a" : /ogg/.test(blob.type) ? "ogg" : /webm/.test(blob.type) ? "webm" : "wav"; }
      const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(b); });
      if (my !== gen) return;
      const r = await fetchT(o.sttUrl, { method: "POST", headers: { "Content-Type": "application/json", ...(o.headers || {}) }, body: JSON.stringify({ audio: b64, format: fmt }) }, T_STT);
      let j = null; try { j = await r.json(); } catch (e) {}
      if (my !== gen) return;
      if (j && typeof j.text === "string") text = j.text.trim();
      else { note(sttErrorText(r.status, j)); set("paused"); return; }
    } catch (e) {
      if (my === gen && alive) { note(e && e.code === "timeout" ? "Распознавание не ответило — коснись волны и скажи ещё раз." : "Нет связи с распознаванием — коснись волны и попробуй ещё раз."); set("paused"); }
      return;
    }
    if (!text) {
      // дважды подряд пусто (рядом никого, шумно) — пауза, а не круг без конца
      empties += 1;
      if (empties >= 2) { empties = 0; note(NOTE.againTap); set("paused"); return; }
      note(NOTE.again); listen(); return;
    }
    empties = 0;
    try { o.onHeard && o.onHeard(text); } catch (e) {}
    think(text, my);
  };

  // ── думаю ──
  const think = async (text, my) => {
    set("thinking");
    let r = null;
    try { r = await withTimeout(Promise.resolve().then(() => o.ask(text)), T_ASK); }
    catch (e) {
      if (my === gen && alive) {
        const m = e && e.code === "timeout" ? NOTE.noReply : (e && e.message && e.message.length > 3 && e.message.length < 200) ? e.message : NOTE.noReply;
        note(m); set("paused");
      }
      return;
    }
    if (my !== gen || !alive) return;
    const reply = String((r && r.text) || "").trim();
    try { o.onReply && o.onReply(reply); } catch (e) {}
    if (r && r.end) ending = true;   // гость прощается: договорит — и разговор окончен
    if (!reply) { if (ending) end("end"); else listen(); return; }
    say(reply, () => { if (ending) end("end"); else listen(); });
  };

  // ── говорю ──
  const ttsChunk = (text) => fetchT(o.ttsUrl, { method: "POST", headers: { "Content-Type": "application/json", ...(o.headers || {}) }, body: JSON.stringify({ token: o.token, text, who: o.voice || "mentor", talk: true }) }, T_TTS)
    .then((r) => r.json().catch(() => { const e = new Error("http_" + r.status); e.code = "http_" + r.status; throw e; })).then((j) => {
      if (j && j.ok && (j.audio || j.url)) return j.audio || j.url;   // url — ответ функции радио старой версии
      // v36: причина от функции (detail — что ответил OpenRouter / счётчик) — покажем её в скобках
      const e = new Error((j && j.error) || "tts"); e.code = (j && j.error) || "tts"; e.detail = (j && (j.detail || j.message || j.msg)) || ""; throw e;
    });
  // голос телефона молчит (iPhone не дал, нет голосов) — ответ в чате, пауза до касания
  const muted = (my) => { if (my !== gen || !alive) return; phoneMute = true; note(NOTE.phoneMute); set("paused"); };
  const phoneSay = (parts, i, my, next) => {
    if (my !== gen || !alive) return;
    if (i >= parts.length) { next(); return; }
    if (!canSpeak() || phoneMute) { muted(my); return; }
    const p = o.phone || {};
    let started = false, fin = false, guardT = 0;
    const go = (ok) => {
      if (fin) return;
      fin = true; clearTimeout(guardT);
      if (my !== gen || !alive) return;
      if (ok) phoneSay(parts, i + 1, my, next); else muted(my);
    };
    const h = speakText(parts[i], { rate: p.rate || 1, pitch: p.pitch || 1, onstart: () => { started = true; }, onend: () => go(true), onerror: () => go(started) });
    // телефон молча не начал читать — не висим в «говорит»
    guardT = setTimeout(() => {
      let sp = false; try { sp = !!window.speechSynthesis.speaking; } catch (e) {}
      if (!started && !sp) { try { h.cancel(); } catch (e) {} go(false); }
    }, 5000);
  };
  const say = async (text, next) => {
    const my = ++gen;
    releaseMic();
    set("speaking");
    const done = () => { if (my === gen && alive) next(); };
    const parts = speechChunks(clipSpeech(speechText(text, { actions: !!o.actions }), o.maxSpeak || 0));
    if (!parts.length) { next(); return; }
    if (live === null && o.ttsUrl) { try { live = await talkVoiceAvailable(o.ttsUrl, o.headers, o.token); } catch (e) { live = false; } }
    if (my !== gen || !alive) return;
    if (!live || !audio) {
      if (!noted && o.ttsUrl) { noted = true; note(TTS_NOTE.not_configured); }
      phoneSay(parts, 0, my, done);
      return;
    }
    // живой голос: следующий кусок готовим, пока звучит текущий
    let i = 0, pending = ttsChunk(parts[0]);
    pending.catch(() => {});
    const play = async () => {
      if (my !== gen || !alive) return;
      let url = null;
      try { url = await pending; }
      catch (e) {
        if (my !== gen || !alive) return;
        const code = (e && e.code) || "tts";
        if (code === "not_configured") { live = false; try { sessionStorage.setItem(TTS_OK, "0"); } catch (x) {} }
        // лимит на сегодня или живой голос дважды подряд не ответил — до конца разговора читает
        // телефон (не ждём каждый раз заведомо неудачный запрос)
        ttsFails += 1;
        if (code === "limit" || code === "daily_limit" || ttsFails >= 2) live = false;
        noted = true;
        note(TTS_NOTE[code] || "Живой голос не ответил" + whyNot(e) + " — дальше читает голос телефона.");
        phoneSay(parts, i, my, done);
        return;
      }
      if (my !== gen || !alive) return;
      ttsFails = 0;
      const cur = i; i += 1;
      if (i < parts.length) { pending = ttsChunk(parts[i]); pending.catch(() => {}); }
      // звук не сыграл (формат не разобрал, iPhone не дал) — этот кусок и дальше читает телефон;
      // ошибка звука и отказ play() приходят вместе — запасной путь запускаем один раз
      let fell = false;
      const fall = () => {
        if (fell || my !== gen || !alive) return;
        fell = true; live = false; noted = true;
        try { audio.onended = null; audio.onerror = null; } catch (e) {}
        note("Живой голос не сыграл — дальше читает голос телефона.");
        phoneSay(parts, cur, my, done);
      };
      try {
        audio.onended = () => { if (fell || my !== gen || !alive) return; if (i < parts.length) play(); else done(); };
        audio.onerror = () => fall();
        audio.src = url;
        const pr = audio.play();
        if (pr && pr.catch) pr.catch((err) => { if (err && err.name === "AbortError") return; fall(); });
      } catch (e) { fall(); }
    };
    play();
  };

  // ушёл из приложения — разговор на паузе (микрофон и звук выключены); вернулся — экран не гаснет
  const onVis = () => {
    try {
      if (!alive) return;
      if (document.visibilityState === "hidden") { if (state !== "paused") hold(NOTE.away); }
      else if (state !== "paused") takeWake();
    } catch (e) {}
  };

  const end = (reason) => {
    if (!alive) return;
    alive = false; gen++;
    hush(); releaseMic();
    try { if (ac) ac.close().catch(() => {}); } catch (e) {}
    ac = null;
    try { document.removeEventListener("visibilitychange", onVis); } catch (e) {}
    try { if (audio) audio.removeAttribute("src"); } catch (e) {}
    try { if (silent) URL.revokeObjectURL(silent); } catch (e) {}
    audio = null; silent = "";
    set("idle");
    try { o.onEnd && o.onEnd(reason || "stop"); } catch (e) {}
  };

  return {
    get state() { return state; },
    // вызывать сразу после касания кнопки-волны (она «будит» звук — primeTalk)
    start() {
      if (alive) return;
      alive = true; noted = false; ttsFails = 0; phoneMute = false; muteRetry = false; empties = 0; ending = false;
      const pr = takePrimed();   // <audio>, AudioContext и голос телефона, разбуженные касанием
      if (pr) { audio = pr.audio; silent = pr.silent || ""; ac = own(pr.ac || null); }
      else { try { stopSpeech(); } catch (e) {} }
      if (!audio) {
        try {
          audio = new Audio(); audio.preload = "auto";
          try { audio.setAttribute("playsinline", ""); } catch (e) {}
          silent = silent || silentWav();
          if (silent) { audio.src = silent; const p = audio.play(); if (p && p.catch) p.catch(() => {}); }
        } catch (e) { audio = null; }
      }
      if (!ac) { try { ac = own(newAC()); if (ac && ac.state !== "running") ac.resume().catch(() => {}); } catch (e) { ac = null; } }
      try { document.addEventListener("visibilitychange", onVis); } catch (e) {}
      if (o.ttsUrl) talkVoiceAvailable(o.ttsUrl, o.headers, o.token).then((v) => { if (live === null) live = v; }).catch(() => {});
      if (!audio) live = false;
      const first = String(o.first || "").trim();
      if (first) say(first, () => listen()); else listen();
    },
    // касание волны: говорит — перебить и слушать (гость прощается — отпустить); слышит речь —
    // закончить фразу; пауза или распознаёт — слушать заново
    tap() {
      if (!alive) return;
      if (ending && state === "speaking") { end("end"); return; }
      // голос телефона молчал (не «разбудился» касанием кнопки-волны) — это касание тоже касание:
      // будим его ещё раз и даём ему одну попытку
      if (state === "paused" && phoneMute && !muteRetry && canSpeak()) {
        muteRetry = true; phoneMute = false;
        try { stopSpeech(); speakText(" ", { volume: 0, guard: false }); } catch (e) {}
      }
      if (state === "speaking" || state === "paused" || state === "recognizing") { listen(); return; }
      if (state === "hearing" && cutNow) { cutNow(); }
    },
    // v35: «Пауза» в полосе разговора — микрофон и звук выключены, касание — слушаю снова
    pause() { if (alive && state !== "paused" && state !== "idle") hold(""); },
    stop() { end("stop"); },
  };
}
