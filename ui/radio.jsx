// ui/radio.jsx — Доп. 319: «Радио в дорогу».
//
// Три выпуска на сегодня (следующий урок, выдохшаяся тема, повтор) — ведущий, сценка у стола
// разными голосами и два вопроса на закрепление. Читает телефон (speechSynthesis), по фразе:
// длинные куски браузеры обрывают. Не умеет читать вслух — тот же выпуск текстом.
// v31: вкладки с названием урока (не «Повтор / Повтор»); экран не гаснет, пока идёт выпуск
// (Wake Lock); название и кнопки на экране блокировки (Media Session); «Вся дорога» — выпуски
// подряд, вопросы в конце; после выпуска — что дальше в плейлисте; «живые голоса» с сервера
// (функция radio-tts, по ключу; нет её — голос телефона, как раньше).
import React from "react";
import { tableShell, tableVars } from "./table";
import { Ic } from "./table-bits";
import { voiceFor, radioCounted, markRadio } from "../lib/radio";
import { liveVoiceAvailable, liveVoicePref, setLiveVoicePref, voiceUrl, silentUrl } from "../lib/radio-voice";
import { shuffleQuizOptions, vibrate } from "../lib/utils";
import { ymd } from "../lib/streak";

const CSS = `
.rd-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:2px 0 12px}
.rd-tabs::-webkit-scrollbar{display:none}
.rd-tab{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-start;gap:1px;max-width:190px;padding:7px 12px;border-radius:14px;border:1px solid var(--edge);background:transparent;color:var(--sub);font:700 12.5px var(--font-body);cursor:pointer;text-align:left}
.rd-tab small{font-family:var(--font-mono);font-size:9.5px;letter-spacing:.8px;color:var(--gold-ink);font-weight:400}
.rd-tab span{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-tab.on{border-color:var(--edge-gold);background:var(--glass-2);color:var(--text)}
.rd-tab i{font-style:normal;color:var(--ok-ink,#5DBB8A);margin-left:4px}
.rd-air{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;padding:18px 14px 16px;border-radius:20px;border:1px solid var(--edge);background:var(--glass);box-shadow:inset 0 0 22px var(--inner)}
.rd-disc{position:relative;width:118px;height:118px;border-radius:50%;display:grid;place-items:center;
  background:radial-gradient(circle,#2A2014 0 18%,#C8A96E 19% 22%,#16110A 23% 100%);box-shadow:0 10px 26px rgba(0,0,0,.45),inset 0 0 0 2px rgba(214,178,102,.25)}
.rd-disc::before{content:"";position:absolute;inset:8px;border-radius:50%;background:repeating-radial-gradient(circle,rgba(255,255,255,.05) 0 1px,transparent 1px 5px)}
.rd-disc.on{animation:rdSpin 6s linear infinite}
@keyframes rdSpin{to{transform:rotate(360deg)}}
.rd-bars{display:flex;align-items:flex-end;justify-content:center;gap:3px;height:22px;margin:14px 0 4px}
.rd-bars i{width:4px;height:6px;border-radius:2px;background:#C8A96E;opacity:.55}
.rd-bars.on i{animation:rdBar .9s ease-in-out infinite;opacity:1}
.rd-bars.on i:nth-child(2){animation-delay:.12s}.rd-bars.on i:nth-child(3){animation-delay:.24s}.rd-bars.on i:nth-child(4){animation-delay:.36s}.rd-bars.on i:nth-child(5){animation-delay:.48s}
@keyframes rdBar{0%,100%{height:6px}50%{height:22px}}
.rd-who{font-family:var(--font-mono);font-size:10.5px;letter-spacing:2px;color:var(--gold-ink);margin-top:6px}
.rd-now{font-family:var(--font-display);font-size:19px;line-height:1.35;margin:6px 0 0;min-height:52px;text-wrap:balance}
.rd-ttl{font-family:var(--font-display);font-size:16px;margin-top:12px}
.rd-sub{font-size:12.5px;color:var(--sub);margin-top:2px}
.rd-ctl{display:flex;align-items:center;justify-content:center;gap:16px;margin:16px 0 4px}
.rd-ctl button{border:1px solid var(--edge);background:transparent;color:var(--text);width:46px;height:46px;border-radius:50%;display:grid;place-items:center;cursor:pointer}
.rd-ctl button.play{width:64px;height:64px;border:0;color:var(--on-gold);background:linear-gradient(180deg,#E4C88C,#C8A96E);box-shadow:0 6px 16px rgba(0,0,0,.35)}
.rd-ctl button.sp{width:auto;padding:0 12px;border-radius:999px;font:700 13px var(--font-body)}
.rd-prog{width:100%;height:4px;border-radius:99px;background:var(--glass-2);overflow:hidden;margin-top:12px}
.rd-prog b{display:block;height:100%;background:linear-gradient(90deg,#C8A96E,#E8C56A);transition:width .4s}
.rd-txt{margin:14px 0 0;padding:0;list-style:none}
.rd-txt li{padding:6px 2px;font-size:14px;line-height:1.45;color:var(--sub);border-bottom:1px dashed var(--edge)}
.rd-txt li.cur{color:var(--text)}
.rd-txt li b{font-family:var(--font-mono);font-size:10px;letter-spacing:1.4px;margin-right:6px;color:var(--gold-ink)}
.rd-note{font-size:12.5px;line-height:1.45;color:var(--sub);margin:10px 2px 0}
.rd-q{margin:6px 0 14px}
.rd-q h3{font-family:var(--font-display);font-size:17px;line-height:1.35;margin:0 0 10px}
.rd-q button{display:block;width:100%;text-align:left;margin:0 0 8px;padding:12px 14px;border-radius:14px;border:1px solid var(--edge);background:var(--glass);color:var(--text);font:15px/1.4 var(--font-body);cursor:pointer}
.rd-q button.ok{border-color:var(--ok-edge);background:rgba(93,187,138,.14)}
.rd-q button.bad{border-color:var(--bad-edge);background:var(--bad-wash)}
.rd-q p{margin:4px 2px 0;font-size:13.5px;line-height:1.45;color:var(--sub)}
.rd-opts{display:flex;flex-direction:column;gap:8px;margin:12px 0 0}
.rd-sw{display:flex;align-items:center;gap:12px;width:100%;padding:11px 13px;border-radius:14px;border:1px solid var(--edge);background:transparent;color:var(--text);font:14px/1.35 var(--font-body);cursor:pointer;text-align:left}
.rd-sw b{display:block;font-weight:700}
.rd-sw small{display:block;color:var(--sub);font-size:12.5px;margin-top:1px}
.rd-sw .k{flex:0 0 auto;position:relative;width:40px;height:24px;border-radius:12px;background:var(--glass-2);border:1px solid var(--edge);transition:background .2s}
.rd-sw .k::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:var(--sub);transition:transform .2s,background .2s}
.rd-sw[aria-checked="true"] .k{background:rgba(200,169,110,.35);border-color:var(--edge-gold)}
.rd-sw[aria-checked="true"] .k::after{transform:translateX(16px);background:#E4C88C}
.rd-sw .tx{flex:1;min-width:0}
.rd-next{margin:14px 0 0}
.rd-next ul{margin:0;padding:0;list-style:none}
.rd-next h4{margin:0 0 8px;font-family:var(--font-mono);font-size:10.5px;letter-spacing:2px;color:var(--gold-ink);font-weight:400;text-transform:uppercase}
.rd-next li{display:flex;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px dashed var(--edge)}
.rd-next li .tx{flex:1;min-width:0}
.rd-next li .tx b{display:block;font-family:var(--font-display);font-size:15px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-next li .tx small{display:block;font-size:12px;color:var(--sub)}
.rd-next li button{flex:0 0 auto;padding:8px 13px;border-radius:999px;border:1px solid var(--edge-gold);background:transparent;color:var(--gold-ink);font:700 12.5px var(--font-body);cursor:pointer}
.rd-next li .dn{flex:0 0 auto;font-size:12.5px;color:var(--ok-ink,#5DBB8A)}
@media (prefers-reduced-motion: reduce){.rd-disc.on,.rd-bars.on i{animation:none!important}.rd-sw .k,.rd-sw .k::after{transition:none}}
`;
let cssOn = false;
function ensureCss() { if (cssOn || typeof document === "undefined" || !document.head || !document.createElement) return; cssOn = true; const st = document.createElement("style"); st.id = "sa-radio-css"; st.textContent = CSS; document.head.appendChild(st); }
const WHO = { host: "ВЕДУЩИЙ", guest: "ГОСТЬ", staff: "КАК СКАЗАТЬ" };
const KIND = { next: "Дальше по треку", fresh: "Освежить", repeat: "Повтор" };
const ROAD_KEY = "sa_radio_road";
const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
const canWake = () => typeof navigator !== "undefined" && !!navigator.wakeLock && typeof navigator.wakeLock.request === "function";
const readRoad = () => { try { return localStorage.getItem(ROAD_KEY) === "1"; } catch (e) { return false; } };
const LIVE_ERR = { daily_limit: "Живые голоса на сегодня закончились — дальше читает телефон.", not_configured: "", auth: "Живые голоса недоступны — дальше читает телефон." };

export function RadioScreen({ a11y, uk, color, episodes = [], onMistakes, onActivity, onTouch, onClose, inline = false }) {
  ensureCss();
  const [ep, setEp] = React.useState(0);
  const [seg, setSeg] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [rate, setRate] = React.useState(1);
  const [phase, setPhase] = React.useState("air");   // air | quiz | done
  const [answers, setAnswers] = React.useState({});
  const [showText, setShowText] = React.useState(!canSpeak());
  const [road, setRoad] = React.useState(readRoad);     // v31: «Вся дорога»
  const [later, setLater] = React.useState([]);         // выпуски, чьи вопросы отложены до конца дороги
  const [heard, setHeard] = React.useState([]);         // дослушанные сегодня в этом радио
  const [liveOk, setLiveOk] = React.useState(null);     // null — ещё не знаем; true — живые голоса есть
  const [live, setLive] = React.useState(liveVoicePref);
  const [liveErr, setLiveErr] = React.useState("");
  const [wake, setWake] = React.useState(false);
  const voices = React.useRef([]);
  const gen = React.useRef(0);
  const audio = React.useRef(null);
  const wakeRef = React.useRef(null);
  const roadRef = React.useRef(road); roadRef.current = road;
  const rateRef = React.useRef(rate); rateRef.current = rate;
  const liveRef = React.useRef(false);
  liveRef.current = live && liveOk === true && !liveErr;
  const e = episodes[ep] || null;
  const quiz = React.useMemo(() => (e ? e.quiz.map((q) => shuffleQuizOptions({ q: q.question, options: q.options, correct: q.correct, explanation: String(q.win || "").replace(/^🎯\s*/u, ""), _q: q })) : []), [e]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    let dead = false;
    liveVoiceAvailable().then((ok) => { if (!dead) setLiveOk(!!ok); }, () => { if (!dead) setLiveOk(false); });
    if (!canSpeak()) return () => { dead = true; gen.current++; try { if (audio.current) audio.current.pause(); } catch (x) {} };
    const load = () => { try { voices.current = window.speechSynthesis.getVoices() || []; } catch (x) {} };
    load();
    try { window.speechSynthesis.onvoiceschanged = load; } catch (x) {}
    return () => { dead = true; gen.current++; try { window.speechSynthesis.cancel(); window.speechSynthesis.onvoiceschanged = null; } catch (x) {} try { if (audio.current) audio.current.pause(); } catch (x) {} };
  }, []);
  const hush = () => {
    try { if (canSpeak()) window.speechSynthesis.cancel(); } catch (x) {}
    try { const a = audio.current; if (a) { a.onended = null; a.onerror = null; a.pause(); } } catch (x) {}
  };
  const stop = () => { gen.current++; hush(); setPlaying(false); };
  const audioEl = () => {
    if (!audio.current && typeof window !== "undefined" && typeof window.Audio === "function") { audio.current = new window.Audio(); audio.current.preload = "auto"; }
    return audio.current;
  };
  // «разбудить» звук по нажатию: дальше тот же <audio> играет фразы, пришедшие с сервера
  const unlock = () => {
    const a = audioEl(); const s = silentUrl();
    if (!a || !s) return;
    try { a.src = s; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (x) {}
  };
  const countFor = (E) => {
    if (!E) return;
    const day = ymd(new Date());
    if (!radioCounted(uk, E.id, day)) { markRadio(uk, E.id, day); try { onActivity && onActivity("radio"); onTouch && onTouch(); } catch (x) {} }
  };
  // выпуск кончился: «Вся дорога» — сразу следующий (вопросы — в конце), иначе вопросы
  const epEnd = (i, my) => {
    const E = episodes[i];
    setHeard((h) => (h.includes(i) ? h : [...h, i]));
    const hasQ = !!(E && E.quiz && E.quiz.length);
    if (roadRef.current && i + 1 < episodes.length) {
      if (hasQ) setLater((l) => (l.includes(i) ? l : [...l, i])); else countFor(E);
      setEp(i + 1); setSeg(0); setAnswers({}); setPhase("air");
      setTimeout(() => { if (gen.current === my) speakEp(i + 1, 0); }, 900);
      return;
    }
    setPlaying(false); setSeg(E ? E.segs.length : 0); setPhase(hasQ ? "quiz" : "done");
  };
  const speakEp = (i, from, r = rateRef.current, synthOnly = false) => {
    const E = episodes[i];
    if (!E) return;
    const useLive = !synthOnly && liveRef.current && !!audioEl();
    if (!useLive && !canSpeak()) return;
    const my = ++gen.current;
    hush();
    const fallback = (k, code) => {
      if (gen.current !== my) return;
      setLiveErr(LIVE_ERR[code] != null ? LIVE_ERR[code] || "Живые голоса недоступны — дальше читает телефон." : "Живые голоса не отвечают — дальше читает телефон.");
      if (code === "not_configured") setLiveOk(false);
      liveRef.current = false;
      if (canSpeak()) speakEp(i, k, r, true); else setPlaying(false);
    };
    const run = (k) => {
      if (gen.current !== my) return;
      const s = E.segs[k];
      if (!s) { epEnd(i, my); return; }
      setSeg(k);
      if (useLive) {
        const cur = voiceUrl(s.who, s.text);   // сначала текущая фраза, потом — две следующих впрок
        [k + 1, k + 2].forEach((j) => { const n = E.segs[j]; if (n) voiceUrl(n.who, n.text).catch(() => {}); });
        cur.then((url) => {
          if (gen.current !== my) return;
          const a = audioEl();
          a.onended = () => { if (gen.current === my) setTimeout(() => run(k + 1), s.head ? 300 : 120); };
          a.onerror = () => fallback(k, "media");
          a.src = url;
          try { a.playbackRate = r; } catch (x) {}
          const p = a.play();
          if (p && p.catch) p.catch((err) => { if (!(err && err.name === "AbortError")) fallback(k, "media"); });
        }, (err) => fallback(k, err && err.code));
        return;
      }
      try {
        const u = new window.SpeechSynthesisUtterance(s.text);
        const v = voiceFor(s.who, voices.current);
        u.lang = "ru-RU"; if (v.voice) u.voice = v.voice; u.pitch = v.pitch; u.rate = v.rate * r;
        let alive = false;
        u.onstart = () => { alive = true; };
        u.onend = () => { alive = true; if (gen.current === my) setTimeout(() => run(k + 1), s.head ? 380 : 180); };
        u.onerror = () => { alive = true; if (gen.current === my) setPlaying(false); };
        window.speechSynthesis.speak(u);
        // v31 (ревью): телефон молча не начал читать (так бывает на iPhone без касания) — не висим
        setTimeout(() => {
          let speaking = false; try { speaking = !!window.speechSynthesis.speaking; } catch (x) {}
          if (!alive && !speaking && gen.current === my) { stop(); setLiveErr("Телефон не начал читать вслух — нажми «Слушать» ещё раз или открой «Текст выпуска»."); }
        }, 6000);
      } catch (x) { setPlaying(false); }
    };
    if (useLive) {
      unlock();
      // голос телефона — запасной: «будим» и его по этому же касанию, чтобы он смог подхватить
      try { if (canSpeak()) { const z = new window.SpeechSynthesisUtterance(" "); z.volume = 0; window.speechSynthesis.speak(z); } } catch (x) {}
    }
    setPlaying(true);
    run(from);
  };
  const speakFrom = (k, r = rate) => speakEp(ep, k, r);
  const toggle = () => { vibrate("light"); if (playing) stop(); else speakFrom(seg >= (e ? e.segs.length : 0) ? 0 : seg); };
  const jump = (d) => { if (!e) return; const k = Math.max(0, Math.min(e.segs.length - 1, seg + d)); if (playing) speakFrom(k); else setSeg(k); };
  const speed = () => { const r = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : 1; setRate(r); if (playing) speakFrom(seg, r); };
  const pickEp = (i) => { stop(); setEp(i); setSeg(0); setPhase("air"); setAnswers({}); };
  const openQuiz = (i) => { stop(); setEp(i); setAnswers({}); setPhase("quiz"); };
  const playEp = (i) => { vibrate("light"); pickEp(i); setTimeout(() => speakEp(i, 0), 0); };
  const toggleRoad = () => { const v = !road; setRoad(v); roadRef.current = v; try { localStorage.setItem(ROAD_KEY, v ? "1" : "0"); } catch (x) {} vibrate("light"); };
  const toggleLive = () => {
    const v = !live; setLive(v); setLiveVoicePref(v); setLiveErr(""); vibrate("light");
    if (playing) { liveRef.current = v && liveOk === true; speakFrom(seg); }
  };
  const answer = (qi, oi) => {
    if (answers[qi] != null) return;
    const q = quiz[qi]; const ok = oi === q.correct;
    vibrate(ok ? "light" : "error");
    const next = { ...answers, [qi]: oi };
    setAnswers(next);
    if (!ok && onMistakes) onMistakes([{ q: q.q, options: q.options, correct: q.correct, explanation: q.explanation || "", img: null, lessonTitle: e.title, lessonId: q._q._from || e.id, stage: 0, due: Date.now(), from: "radio" }]);
    if (Object.keys(next).length >= quiz.length) {
      countEp();
      setLater((l) => l.filter((x) => x !== ep));
      setHeard((h) => (h.includes(ep) ? h : [...h, ep]));
      setTimeout(() => setPhase("done"), 600);
    }
  };
  // выпуск засчитывается раз в день: с вопросами — когда ответил на все, без вопросов — когда
  // дослушан до конца (хотя бы на 60%) или прочитан текстом (ревью v30: раньше такие не считались)
  const countEp = () => countFor(e);
  React.useEffect(() => {
    if (phase !== "done" || !e || quiz.length) return;
    if (seg >= Math.ceil(e.segs.length * 0.6) || showText || !canSpeak()) countEp();
  }, [phase, ep]);   // eslint-disable-line react-hooks/exhaustive-deps
  // v31: пока идёт выпуск — экран не гаснет (Wake Lock; вернулся в приложение — берём снова)
  React.useEffect(() => {
    if (!playing || !canWake()) return undefined;
    let dead = false;
    const take = () => {
      if (dead || wakeRef.current || (typeof document !== "undefined" && document.visibilityState !== "visible")) return;
      navigator.wakeLock.request("screen").then((l) => {
        if (dead) { l.release().catch(() => {}); return; }
        wakeRef.current = l; setWake(true);
        try { l.addEventListener("release", () => { if (wakeRef.current === l) { wakeRef.current = null; setWake(false); } }); } catch (x) {}
      }).catch(() => {});
    };
    take();
    const vis = () => take();
    document.addEventListener("visibilitychange", vis);
    return () => {
      dead = true; document.removeEventListener("visibilitychange", vis);
      const l = wakeRef.current; wakeRef.current = null; setWake(false);
      if (l) l.release().catch(() => {});
    };
  }, [playing]);
  // v31: название выпуска и кнопки — на экране блокировки и в шторке (Media Session)
  const ctl = React.useRef({});
  ctl.current = { toggle, jump, playing };
  React.useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : null;
    if (!ms || !e) return undefined;
    try {
      if (typeof window.MediaMetadata === "function") ms.metadata = new window.MediaMetadata({ title: e.title, artist: "Радио в дорогу", album: e.topic, artwork: [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }] });
    } catch (x) {}
    const set = (a, h) => { try { ms.setActionHandler(a, h); } catch (x) {} };
    set("play", () => { if (!ctl.current.playing) ctl.current.toggle(); });
    set("pause", () => { if (ctl.current.playing) ctl.current.toggle(); });
    set("nexttrack", () => ctl.current.jump(1));
    set("previoustrack", () => ctl.current.jump(-1));
    return () => { ["play", "pause", "nexttrack", "previoustrack"].forEach((a) => set(a, null)); };
  }, [ep]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { try { if (navigator.mediaSession) navigator.mediaSession.playbackState = playing ? "playing" : "paused"; } catch (x) {} }, [playing]);
  const vars = tableVars(color, a11y);
  if (!e) {
    return tableShell(
      <>
        <div className="tb-head"><div className="tb-col tb-top">
          <button type="button" className="tb-x" data-sa-back="" aria-label="Закрыть" onClick={onClose}><Ic n="x" s={18} /></button>
          <div className="tb-host"><span className="tb-av" aria-hidden="true"><Ic n="speaker" s={18} /></span><span className="tb-host-t"><b>Радио в дорогу</b><span>выпусков пока нет</span></span></div>
        </div></div>
        <div className="tb-body"><div className="tb-col"><p className="rd-note">Выпуски собираются из текстовых уроков трека — открой трек, и радио появится.</p></div></div>
      </>, vars, inline);
  }
  const pct = Math.round((Math.min(seg, e.segs.length) / e.segs.length) * 100);
  const cur = e.segs[Math.min(seg, e.segs.length - 1)];
  const right = quiz.filter((q, i) => answers[i] === q.correct).length;
  const sound = canSpeak() || liveOk === true;
  const nextUnheard = episodes.findIndex((x, i) => i !== ep && !heard.includes(i));
  const laterNext = later.find((i) => i !== ep);
  const rest = episodes.map((x, i) => ({ x, i })).filter(({ i }) => i !== ep);
  return tableShell(
    <>
      <div className="tb-head"><div className="tb-col tb-top">
        <button type="button" className="tb-x" data-sa-back="" aria-label="Закрыть" onClick={() => { stop(); onClose(); }}><Ic n="x" s={18} /></button>
        <div className="tb-host"><span className="tb-av" aria-hidden="true"><Ic n="speaker" s={18} /></span>
          <span className="tb-host-t"><b>Радио в дорогу</b><span>{KIND[e.kind] || "Выпуск"} · ≈ {e.mins} мин{road && episodes.length > 1 ? " · вся дорога" : ""}</span></span></div>
      </div></div>
      <div className="tb-body"><div className="tb-col">
        {episodes.length > 1 ? (
          <div className="rd-tabs" role="tablist" aria-label="Выпуски">
            {episodes.map((x, i) => (
              <button key={x.id} type="button" role="tab" aria-selected={i === ep} className={"rd-tab" + (i === ep ? " on" : "")} onClick={() => pickEp(i)}
                aria-label={(KIND[x.kind] || "Выпуск") + ": " + x.title + (heard.includes(i) ? ", дослушан" : "")}>
                <small>{KIND[x.kind] || "Выпуск"}</small><span>{x.title}{heard.includes(i) ? <i aria-hidden="true">✓</i> : null}</span>
              </button>
            ))}
          </div>
        ) : null}
        {phase === "air" ? (
          <>
            <div className="rd-air">
              <div className={"rd-disc" + (playing ? " on" : "")} aria-hidden="true" />
              <div className={"rd-bars" + (playing ? " on" : "")} aria-hidden="true"><i /><i /><i /><i /><i /></div>
              <div className="rd-who">{WHO[cur.who] || "ВЕДУЩИЙ"}</div>
              <p className="rd-now" aria-live="polite">{cur.text}</p>
              <div className="rd-ttl">«{e.title}»</div>
              <div className="rd-sub">{e.topic}</div>
              <div className="rd-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Сколько прослушано"><b style={{ width: pct + "%" }} /></div>
              {sound ? (
                <div className="rd-ctl">
                  <button type="button" onClick={() => jump(-1)} aria-label="Назад на фразу" style={{ transform: "rotate(180deg)" }}><Ic n="chev" s={18} /></button>
                  <button type="button" className="play" onClick={toggle} aria-label={playing ? "Пауза" : "Слушать"}>
                    {playing ? <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /></svg>
                      : <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" /></svg>}
                  </button>
                  <button type="button" onClick={() => jump(1)} aria-label="Дальше на фразу"><Ic n="chev" s={18} /></button>
                  <button type="button" className="sp" onClick={speed} aria-label={"Скорость " + rate}>{String(rate).replace(".", ",")}×</button>
                </div>
              ) : null}
            </div>
            {sound ? (
              <div className="rd-opts">
                {episodes.length > 1 ? (
                  <button type="button" className="rd-sw" role="switch" aria-checked={road} onClick={toggleRoad} data-radio-road="">
                    <span className="tx"><b>Вся дорога</b><small>Выпуски подряд, вопросы — в конце</small></span><span className="k" aria-hidden="true" />
                  </button>
                ) : null}
                {liveOk === true ? (
                  <button type="button" className="rd-sw" role="switch" aria-checked={live} onClick={toggleLive} data-radio-live="">
                    <span className="tx"><b>Живые голоса</b><small>Ведущий, гость и официант — разными голосами</small></span><span className="k" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}
            {liveErr ? <p className="rd-note" role="status">{liveErr}</p> : null}
            {sound ? <p className="rd-note">{playing && wake ? "Экран не погаснет, пока идёт выпуск." : canWake() ? "Пока идёт выпуск, экран не гаснет — телефон можно не трогать." : "Держи экран включённым — с погасшим экраном телефон перестаёт читать."}</p>
              : <p className="rd-note">Этот телефон не умеет читать вслух — выпуск можно прочитать, а вопросы — в конце.</p>}
            <button type="button" className="tb-ghost" onClick={() => setShowText((v) => !v)} aria-expanded={showText}>{showText ? "Скрыть текст" : "Текст выпуска"}</button>
            {showText ? (
              <ul className="rd-txt">{e.segs.map((s, i) => <li key={i} className={i === seg ? "cur" : undefined}><b>{WHO[s.who]}</b>{s.text}</li>)}</ul>
            ) : null}
          </>
        ) : phase === "quiz" ? (
          <>
            {later.includes(ep) ? <p className="rd-note" style={{ marginTop: 0 }}>Вопросы к «{e.title}» — выпуск из дороги</p> : null}
            {quiz.map((q, qi) => (
              <div key={qi} className="rd-q" role="group" aria-label={"Вопрос " + (qi + 1)}>
                <h3>{qi + 1}. {q.q}</h3>
                {q.options.map((o, oi) => {
                  const a = answers[qi];
                  const cls = a == null ? "" : oi === q.correct ? "ok" : oi === a ? "bad" : "";
                  return <button key={oi} type="button" className={cls || undefined} disabled={a != null} onClick={() => answer(qi, oi)}>{o}</button>;
                })}
                {answers[qi] != null && q.explanation ? <p>{q.explanation}</p> : null}
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="rd-air">
              <div className="rd-disc" aria-hidden="true" />
              <div className="rd-ttl">Выпуск дослушан ✦</div>
              <div className="rd-sub">{quiz.length ? "Верно " + right + " из " + quiz.length + (right < quiz.length ? " — ошибка ушла в «Работу над ошибками»" : "") : "«" + e.title + "»"}</div>
            </div>
            {/* v31: что дальше — вместо пустоты после выпуска */}
            {rest.length ? (
              <div className="rd-next">
                <h4>Дальше в плейлисте</h4>
                <ul aria-label="Дальше в плейлисте">
                {rest.map(({ x, i }) => (
                  <li key={x.id}>
                    <span className="tx"><b>{x.title}</b><small>{KIND[x.kind] || "Выпуск"} · ≈ {x.mins} мин</small></span>
                    {later.includes(i) ? <button type="button" onClick={() => openQuiz(i)}>Вопросы</button>
                      : heard.includes(i) ? <span className="dn">дослушан ✓</span>
                      : sound ? <button type="button" onClick={() => playEp(i)}>Слушать</button>
                      : <button type="button" onClick={() => pickEp(i)}>Открыть</button>}
                  </li>
                ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div></div>
      <div className="tb-foot"><div className="tb-col">
        {phase === "air" ? (
          <button type="button" className="tb-main" onClick={() => { stop(); setPhase(quiz.length ? "quiz" : "done"); }}>{quiz.length ? "К вопросам" : "Выпуск дослушан"}</button>
        ) : phase === "done" ? (
          laterNext != null ? <button type="button" className="tb-main" onClick={() => openQuiz(laterNext)}>Вопросы к «{(episodes[laterNext] || {}).title}»</button>
            : ep + 1 < episodes.length && !heard.includes(ep + 1) ? <button type="button" className="tb-main" onClick={() => pickEp(ep + 1)}>Следующий выпуск</button>
            : nextUnheard >= 0 ? <button type="button" className="tb-main" onClick={() => pickEp(nextUnheard)}>Следующий выпуск</button>
            : <button type="button" className="tb-main" onClick={onClose}>Готово</button>
        ) : null}
        {phase !== "air" ? <button type="button" className="tb-ghost" onClick={onClose}>Закрыть радио</button> : null}
      </div></div>
    </>, vars, inline);
}

export default RadioScreen;
