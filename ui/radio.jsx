// ui/radio.jsx — Доп. 319: «Радио в дорогу».
//
// Три выпуска на сегодня (следующий урок, выдохшаяся тема, повтор) — ведущий, сценка у стола
// разными голосами и два вопроса на закрепление. Читает телефон (speechSynthesis), по фразе:
// длинные куски браузеры обрывают. Не умеет читать вслух — тот же выпуск текстом.
// v31: вкладки с названием урока (не «Повтор / Повтор»); экран не гаснет, пока идёт выпуск
// (Wake Lock); название и кнопки на экране блокировки (Media Session); «Вся дорога» — выпуски
// подряд, вопросы в конце; после выпуска — что дальше в плейлисте; «живые голоса» с сервера
// (функция radio-tts, по ключу; нет её — голос телефона, как раньше).
// v32 (Доп. 336–337): фраза не «зависает»; выпуски листаются пальцем влево-вправо
// (обложки с пластинкой, соседние видны краем), вкладки — стеклянной капсулой с бегущей
// подсветкой, пластинка с тонармом, кто говорит — цветной меткой, фразы — делениями (тап — туда).
// v33 (Доп. 340–341): «тихая дорожка» v32 для беззвучного режима убрана — в Telegram на iPhone она
// обрывала голос через секунду; телефон отказался читать — радио говорит почему (код ошибки);
// обложка возвращается на место кадрами (без «пропадания» на iPhone).
import React from "react";
import { tableShell, tableVars } from "./table";
import { Ic } from "./table-bits";
import { voiceFor, radioCounted, markRadio } from "../lib/radio";
import { liveVoiceAvailable, liveVoicePref, setLiveVoicePref, voiceUrl, silentUrl, liveWhy } from "../lib/radio-voice";
import { canSpeak as ttsOk, speakText, cancelSpeech, audioWake, audioSleep, isAppleMobile } from "../lib/speech";
import { shuffleQuizOptions, vibrate } from "../lib/utils";
import { ymd } from "../lib/streak";
import { LABEL_CSS } from "./tokens";

// v73 (Доп. 386): подписи (вид выпуска, кто говорит, «фраза 3 из 12», «Дальше в плейлисте») — курсивом, обычными
// буквами; капсулы — строчными. Моноширинный — только «≈ 3 мин». Звёздочка в центре пластинки убрана.
const CSS = `
/* выпуски — стеклянная капсула, подсветка едет за пальцем (v32) */
.rd-seg{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;margin:2px 0 12px;padding:3px;border-radius:16px;
  background:var(--glass);border:1px solid var(--edge);box-shadow:inset 0 0 18px var(--inner),inset 0 1px 0 var(--hi)}
.rd-seg.many{display:flex;overflow-x:auto;scrollbar-width:none}
.rd-seg.many::-webkit-scrollbar{display:none}
.rd-seg.many .rd-tab{flex:0 0 auto;max-width:180px}
.rd-pill{position:absolute;left:0;top:3px;bottom:3px;width:0;border-radius:13px;pointer-events:none;opacity:0;
  background:linear-gradient(180deg,rgba(232,197,106,.30),rgba(200,169,110,.14));box-shadow:inset 0 0 0 1px rgba(214,178,102,.55),inset 0 1px 0 rgba(255,240,205,.25),0 3px 10px rgba(0,0,0,.25)}
html.sa-light .rd-pill{background:linear-gradient(180deg,rgba(255,252,244,.98),rgba(246,234,206,.95));box-shadow:inset 0 0 0 1px rgba(139,106,48,.45),0 3px 8px rgba(120,85,25,.16)}
.rd-tab{position:relative;z-index:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:6px 9px 7px;border-radius:13px;border:0;background:transparent;
  color:var(--sub);font:700 12.5px var(--font-body);cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent;transition:color .2s}
.rd-tab small{${LABEL_CSS};font-size:12.5px;color:var(--kc,var(--gold-ink));white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.rd-tab span{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-tab.on{color:var(--text)}
.rd-tab i{font-style:normal;color:var(--ok-ink,#5DBB8A);margin-left:4px}
.rd-tab:focus-visible{outline:2px solid #D9B87C;outline-offset:-2px}
/* обложки — листаются; текущая в потоке, соседние видны краем */
.rd-stage{position:relative;overflow:hidden;margin:0 -14px;padding:0 0 4px;touch-action:pan-y}
.rd-strack{position:relative;will-change:transform}
.rd-air{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;box-sizing:border-box;padding:12px 14px 14px;border-radius:22px;
  border:1px solid var(--edge);background:linear-gradient(180deg,var(--glass-2),var(--glass) 46%);box-shadow:inset 0 0 22px var(--inner),inset 0 1px 0 var(--hi),0 8px 22px var(--drop)}
.rd-card{width:calc(100% - 44px);margin:0 22px}
.rd-card.side{position:absolute;top:0;margin:0;left:calc(22px + var(--k) * (100% - 38px));pointer-events:none}
.rd-card.side .rd-tap{visibility:hidden}
/* v36: пустое место ленты обложек — невидимое (держит ширину ленты в пять обложек) */
.rd-gap{position:absolute;top:0;bottom:0;min-height:1px;left:calc(22px + var(--k) * (100% - 38px));width:calc(100% - 44px);pointer-events:none}
.rd-top{display:flex;align-items:center;gap:8px;width:100%;min-height:22px}
.rd-kind{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;${LABEL_CSS};font-size:13px;line-height:1.3;text-transform:lowercase;
  color:var(--kc);border:1px solid var(--edge-gold);border-color:color-mix(in srgb,var(--kc) 55%,transparent);background:var(--glass);background:color-mix(in srgb,var(--kc) 12%,transparent);white-space:nowrap}
.rd-mins{font:11px var(--font-mono);letter-spacing:.6px;color:var(--sub);white-space:nowrap}
.rd-heard{margin-left:auto;font:700 11px var(--font-body);color:var(--ok-ink,#5DBB8A);white-space:nowrap}
.rd-deck{position:relative;width:176px;height:146px;margin:6px 0 0;flex:0 0 auto}
.rd-disc{position:absolute;left:14px;top:4px;width:138px;height:138px;border-radius:50%;
  background:radial-gradient(circle at 50% 50%,var(--kc) 0 19%,rgba(0,0,0,.6) 19.6% 21%,transparent 21.5%),
    repeating-radial-gradient(circle at 50% 50%,#17120B 0 1.6px,#211A10 1.6px 3.2px),#15100A;
  box-shadow:0 12px 28px rgba(0,0,0,.5),inset 0 0 0 2px rgba(214,178,102,.2),inset 0 0 0 9px rgba(0,0,0,.25)}
.rd-disc::after{content:"";position:absolute;left:50%;top:50%;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;background:#0E0A05;box-shadow:0 0 0 1.5px rgba(255,255,255,.22)}
.rd-disc.on{animation:rdSpin 4.2s linear infinite}
.rd-sheen{position:absolute;left:14px;top:4px;width:138px;height:138px;border-radius:50%;pointer-events:none;
  background:conic-gradient(from 25deg,transparent 0 9%,rgba(255,255,255,.13) 13%,transparent 19% 59%,rgba(255,255,255,.08) 63%,transparent 69%)}
.rd-arm{position:absolute;right:2px;top:-2px;width:46px;height:110px;transform-origin:34px 12px;transform:rotate(-24deg);transition:transform .7s cubic-bezier(.3,1.2,.4,1);filter:drop-shadow(0 3px 4px rgba(0,0,0,.45))}
.rd-arm.on{transform:rotate(0deg)}
@keyframes rdSpin{to{transform:rotate(360deg)}}
.rd-bars{display:flex;align-items:flex-end;justify-content:center;gap:3px;height:18px;margin:8px 0 2px}
.rd-bars i{width:4px;height:5px;border-radius:2px;background:var(--wc,#C8A96E);opacity:.5}
.rd-bars.on i{animation:rdBar .9s ease-in-out infinite;opacity:1}
.rd-bars.on i:nth-child(2){animation-delay:.12s}.rd-bars.on i:nth-child(3){animation-delay:.24s}.rd-bars.on i:nth-child(4){animation-delay:.36s}.rd-bars.on i:nth-child(5){animation-delay:.48s}
@keyframes rdBar{0%,100%{height:5px}50%{height:18px}}
.rd-who{display:inline-flex;align-items:center;gap:6px;margin-top:4px;padding:2px 10px 2px 8px;border-radius:999px;${LABEL_CSS};font-size:13px;line-height:1.3;
  color:var(--wc);border:1px solid var(--edge-gold);border-color:color-mix(in srgb,var(--wc) 50%,transparent);background:var(--glass);background:color-mix(in srgb,var(--wc) 11%,transparent)}
.rd-who svg{flex:0 0 auto}
.rd-now{font-family:var(--font-display);font-size:18.5px;line-height:1.36;margin:8px 0 0;min-height:76px;text-wrap:balance;display:flex;align-items:center;justify-content:center}
.rd-segs{display:flex;gap:2px;width:100%;margin:10px 0 0}
.rd-segs button{flex:1 1 0;min-width:0;height:14px;padding:5px 0;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.rd-segs button i{display:block;height:4px;border-radius:2px;background:var(--track);transition:background .3s}
.rd-segs button.past i{background:var(--kc);opacity:.6}
.rd-segs button.now i{background:var(--kc);box-shadow:0 0 8px var(--kc)}
.rd-segs button:focus-visible{outline:2px solid #D9B87C;outline-offset:1px}
.rd-pos{margin-top:4px;${LABEL_CSS};font-size:13px;color:var(--sub)}
.rd-ttl{font-family:var(--font-display);font-size:16px;margin-top:10px}
.rd-sub{font-size:12.5px;color:var(--sub);margin-top:2px}
.rd-ctl{display:flex;align-items:center;justify-content:center;gap:18px;margin:12px 0 4px}
.rd-ctl button{border:1px solid var(--edge);background:var(--glass);color:var(--text);width:46px;height:46px;border-radius:50%;display:grid;place-items:center;cursor:pointer;
  box-shadow:inset 0 1px 0 var(--hi),0 4px 12px var(--drop);-webkit-tap-highlight-color:transparent}
.rd-ctl button.play{width:68px;height:68px;border:0;color:var(--on-gold);background:radial-gradient(circle at 35% 30%,#F3DFAD,#D9B87C 48%,#B8925A 100%);
  box-shadow:0 8px 20px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,250,232,.8),0 0 0 6px rgba(217,184,124,.14)}
.rd-ctl button.play.on{box-shadow:0 8px 20px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,250,232,.8),0 0 0 6px rgba(217,184,124,.22),0 0 26px rgba(232,197,106,.35)}
.rd-ctl button.sp{width:auto;min-width:46px;padding:0 12px;border-radius:999px;font:700 13px var(--font-body)}
.rd-ctl button:active{transform:scale(.96)}
.rd-ctl button:focus-visible{outline:2px solid #D9B87C;outline-offset:2px}
.rd-dots{display:flex;justify-content:center;gap:6px;margin:2px 0 0}
.rd-dots i{width:6px;height:6px;border-radius:50%;background:var(--track);transition:background .25s,transform .25s}
.rd-dots i.on{background:var(--gold);transform:scale(1.25)}
.rd-prog{width:100%;height:4px;border-radius:99px;background:var(--glass-2);overflow:hidden;margin-top:12px}
.rd-prog b{display:block;height:100%;background:linear-gradient(90deg,#C8A96E,#E8C56A);transition:width .4s}
.rd-txt{margin:14px 0 0;padding:0;list-style:none}
.rd-txt li{padding:6px 2px;font-size:14px;line-height:1.45;color:var(--sub);border-bottom:1px dashed var(--edge)}
.rd-txt li.cur{color:var(--text)}
.rd-txt li b{${LABEL_CSS};font-size:13px;margin-right:6px;color:var(--gold-ink)}
.rd-note{font-size:12.5px;line-height:1.45;color:var(--sub);margin:10px 2px 0}
.rd-tip{display:flex;gap:8px;align-items:flex-start;margin:8px 0 0;padding:8px 11px;border-radius:12px;border:1px dashed var(--edge-gold);font-size:12.5px;line-height:1.4;color:var(--sub)}
/* v33: голос телефона не включился — заметно, но спокойно (под кнопками, как подсказка) */
.rd-tip.rd-err{color:var(--text)}
.rd-q{margin:6px 0 14px}
.rd-q h3{font-family:var(--font-display);font-size:17px;line-height:1.35;margin:0 0 10px}
.rd-q button{display:block;width:100%;text-align:left;margin:0 0 8px;padding:12px 14px;border-radius:14px;border:1px solid var(--edge);background:var(--glass);color:var(--text);font:15px/1.4 var(--font-body);cursor:pointer}
.rd-q button.ok{border-color:var(--ok-edge);background:rgba(93,187,138,.14)}
.rd-q button.bad{border-color:var(--bad-edge);background:var(--bad-wash)}
.rd-q p{margin:4px 2px 0;font-size:13.5px;line-height:1.45;color:var(--sub)}
.rd-opts{display:flex;flex-direction:column;gap:8px;margin:12px 0 0}
.rd-sw{display:flex;align-items:center;gap:12px;width:100%;padding:11px 13px;border-radius:14px;border:1px solid var(--edge);background:var(--glass);color:var(--text);font:14px/1.35 var(--font-body);cursor:pointer;text-align:left;
  box-shadow:inset 0 0 18px var(--inner),inset 0 1px 0 var(--hi)}
.rd-sw b{display:block;font-weight:700}
.rd-sw small{display:block;color:var(--sub);font-size:12.5px;margin-top:1px}
.rd-sw .k{flex:0 0 auto;position:relative;width:40px;height:24px;border-radius:12px;background:var(--glass-2);border:1px solid var(--edge);transition:background .2s}
.rd-sw .k::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:var(--sub);transition:transform .2s,background .2s}
.rd-sw[aria-checked="true"] .k{background:rgba(200,169,110,.35);border-color:var(--edge-gold)}
.rd-sw[aria-checked="true"] .k::after{transform:translateX(16px);background:#E4C88C}
.rd-sw .tx{flex:1;min-width:0}
.rd-next{margin:14px 0 0}
.rd-next ul{margin:0;padding:0;list-style:none}
.rd-next h4{margin:0 0 8px;${LABEL_CSS};font-size:13px;color:var(--gold-ink)}
.rd-next li{display:flex;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px dashed var(--edge)}
.rd-next li .tx{flex:1;min-width:0}
.rd-next li .tx b{display:block;font-family:var(--font-display);font-size:15px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-next li .tx small{display:block;font-size:12px;color:var(--sub)}
.rd-next li button{flex:0 0 auto;padding:8px 13px;border-radius:999px;border:1px solid var(--edge-gold);background:transparent;color:var(--gold-ink);font:700 12.5px var(--font-body);cursor:pointer}
.rd-next li .dn{flex:0 0 auto;font-size:12.5px;color:var(--ok-ink,#5DBB8A)}
@media (prefers-reduced-motion: reduce){.rd-disc.on,.rd-bars.on i{animation:none!important}.rd-sw .k,.rd-sw .k::after,.rd-arm,.rd-pill{transition:none!important}}
`;
let cssOn = false;
function ensureCss() { if (cssOn || typeof document === "undefined" || !document.head || !document.createElement) return; cssOn = true; const st = document.createElement("style"); st.id = "sa-radio-css"; st.textContent = CSS; document.head.appendChild(st); }
const WHO = { host: "ведущий", guest: "гость", staff: "как сказать" };
const KIND = { next: "Дальше по треку", fresh: "Освежить", repeat: "Повтор" };
// v32: у каждого вида выпуска и у каждого голоса — свой цвет (тёмная / светлая тема)
const KIND_C = { next: ["#D9B87C", "#6B4E0E"], fresh: ["#E0956B", "#8A3F1E"], repeat: ["#8FBF9F", "#245536"] };   // светлая — контраст ≥ 4,5
const WHO_C = { host: ["#D9B87C", "#6B4E0E"], guest: ["#E39A86", "#8F3A22"], staff: ["#8FCB9B", "#245536"] };
const WHO_IC = {
  host: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>,
  guest: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>,
  staff: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z" /></svg>,
};
const ROAD_KEY = "sa_radio_road";
const canSpeak = ttsOk;
const canWake = () => typeof navigator !== "undefined" && !!navigator.wakeLock && typeof navigator.wakeLock.request === "function";
const readRoad = () => { try { return localStorage.getItem(ROAD_KEY) === "1"; } catch (e) { return false; } };
const calm = () => { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
const LIVE_ERR = { daily_limit: "Живые голоса на сегодня закончились — дальше читает телефон.", not_configured: "", auth: "Живые голоса недоступны — дальше читает телефон." };
const EASE = "cubic-bezier(.22,.8,.24,1)";

// тонарм пластинки: лежит на пластинке, пока идёт выпуск
const Arm = ({ on }) => (
  <svg className={"rd-arm" + (on ? " on" : "")} viewBox="0 0 46 110" aria-hidden="true">
    <circle cx="34" cy="12" r="9" fill="#2A2116" stroke="#C8A96E" strokeWidth="1.6" />
    <circle cx="34" cy="12" r="3.2" fill="#C8A96E" />
    <path d="M34 12 L30 84 L18 100" fill="none" stroke="#D9C49A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="9" y="96" width="14" height="9" rx="2" transform="rotate(-38 16 100)" fill="#C8A96E" />
  </svg>
);

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
  const [phoneVoice, setPhoneVoice] = React.useState(false);   // v32: сейчас читает голос телефона (для подсказки на iPhone)
  const [ttsErr, setTtsErr] = React.useState("");               // v33: голос телефона не включился — почему
  const [sysPause, setSysPause] = React.useState(false);        // v36: живой голос поставила на паузу система (звонок, экран блокировки)
  const voices = React.useRef([]);
  const gen = React.useRef(0);
  const audio = React.useRef(null);
  const wakeRef = React.useRef(null);
  const utter = React.useRef(null);                     // v32: текущая фраза голоса телефона (держим, чтобы не «потерялась»)
  const roadRef = React.useRef(road); roadRef.current = road;
  const rateRef = React.useRef(rate); rateRef.current = rate;
  const liveRef = React.useRef(false);
  liveRef.current = live && liveOk === true && !liveErr;
  const e = episodes[ep] || null;
  const quiz = React.useMemo(() => (e ? e.quiz.map((q) => shuffleQuizOptions({ q: q.question, options: q.options, correct: q.correct, explanation: String(q.win || "").replace(/^🎯\s*/u, ""), _q: q })) : []), [e]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    let dead = false;
    liveVoiceAvailable().then((ok) => { if (!dead) setLiveOk(!!ok); }, () => { if (!dead) setLiveOk(false); });
    if (!canSpeak()) return () => { dead = true; gen.current++; try { if (audio.current) audio.current.pause(); } catch (x) {} audioSleep(0); };
    const load = () => { try { voices.current = window.speechSynthesis.getVoices() || []; } catch (x) {} };
    load();
    try { window.speechSynthesis.onvoiceschanged = load; } catch (x) {}
    return () => { dead = true; gen.current++; try { if (utter.current) { utter.current.cancel(); utter.current = null; } } catch (x) {} cancelSpeech(); try { window.speechSynthesis.onvoiceschanged = null; } catch (x) {} try { if (audio.current) { audio.current.onpause = null; audio.current.pause(); } } catch (x) {} audioSleep(0); };
  }, []);
  // v33 (Доп. 341): голос телефона отменяем, только если он и правда читает (возвращает «отменили»)
  const hush = () => {
    const was = cancelSpeech();
    try { if (utter.current) { utter.current.cancel(); utter.current = null; } } catch (x) {}
    try { const a = audio.current; if (a) { a.onended = null; a.onerror = null; a.onpause = null; a.pause(); } } catch (x) {}
    return was;
  };
  const stop = () => { gen.current++; hush(); setPlaying(false); audioSleep(); };
  // v33 (Доп. 341): что сказать, если телефон отказался читать (код ошибки — чтобы было понятно почему)
  const ttsMsg = (err) => {
    const code = String((err && (err.error || err.message)) || "").trim().slice(0, 40);
    return "Голос телефона не включился" + (code ? " (" + code + ")" : "") + " — нажми «Слушать» ещё раз или открой «Текст выпуска»." +
      (isAppleMobile() ? " На iPhone в беззвучном режиме голос телефона не звучит." : "");
  };
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
    audioSleep();
  };
  const speakEp = (i, from, r = rateRef.current, synthOnly = false) => {
    const E = episodes[i];
    if (!E) return;
    const useLive = !synthOnly && liveRef.current && !!audioEl();
    if (!useLive && !canSpeak()) return;
    const my = ++gen.current;
    // v33: телефон читал — новую фразу даём чуть позже (сразу после отмены он её иногда «глотает»)
    let lag = hush() ? 90 : 0;
    audioWake();
    setPhoneVoice(!useLive);
    setTtsErr("");
    setSysPause(false);
    const fallback = (k, code, detail) => {
      if (gen.current !== my) return;
      // v36: почему живые голоса не ответили — коротко, в скобках (чтобы по скриншоту было видно причину)
      const why = liveWhy(code, detail);
      setLiveErr(LIVE_ERR[code] != null ? LIVE_ERR[code] || "Живые голоса недоступны — дальше читает телефон." : "Живые голоса не отвечают" + why + " — дальше читает телефон.");
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
          // v36 (Доп. 346): звук остановила система (звонок, другое приложение, экран блокировки) —
          // выпуск встаёт на паузу и говорит об этом, а не «играет» в тишине. Конец фразы тоже
          // приходит «паузой» — его не считаем
          a.onpause = () => { if (gen.current === my && !a.ended) { stop(); setSysPause(true); } };
          a.src = url;
          try { a.playbackRate = r; } catch (x) {}
          const p = a.play();
          if (p && p.catch) p.catch((err) => { if (!(err && err.name === "AbortError")) fallback(k, "media"); });
        }, (err) => fallback(k, err && err.code, err && err.detail));
        return;
      }
      const v = voiceFor(s.who, voices.current);
      let alive = false;
      const dl = lag; lag = 0;
      utter.current = speakText(s.text, {
        voice: v.voice, pitch: v.pitch, rate: v.rate * r, delay: dl,
        onstart: () => { alive = true; },
        onend: () => { alive = true; if (gen.current === my) setTimeout(() => run(k + 1), s.head ? 380 : 180); },
        // v33 (Доп. 341): телефон отказался читать — говорим об этом и пишем причину (раньше
        // выпуск молча останавливался)
        onerror: (err) => { alive = true; if (gen.current === my) { stop(); setTtsErr(ttsMsg(err)); } },
      });
      // v31 (ревью): телефон молча не начал читать (так бывает на iPhone без касания) — не висим
      setTimeout(() => {
        let speaking = false; try { speaking = !!window.speechSynthesis.speaking; } catch (x) {}
        if (!alive && !speaking && gen.current === my) { stop(); setTtsErr("Телефон не начал читать вслух — нажми «Слушать» ещё раз или открой «Текст выпуска»."); }
      }, 6000 + dl);
    };
    if (useLive) {
      unlock();
      // v36 (Доп. 346): голос телефона больше НЕ «будим» беззвучной фразой по этому касанию: на iPhone
      // он через долю секунды забирал звук у живого голоса — <audio> вставал на паузу, радио
      // останавливалось. Понадобится запасной голос, а телефон без касания молчит — радио скажет
      // «нажми «Слушать» ещё раз» (через 6 с), и следующее касание запустит голос телефона
    }
    setPlaying(true);
    run(from);
  };
  const speakFrom = (k, r = rate) => speakEp(ep, k, r);
  const toggle = () => { vibrate("light"); if (playing) stop(); else speakFrom(seg >= (e ? e.segs.length : 0) ? 0 : seg); };
  const jump = (d) => { if (!e) return; const k = Math.max(0, Math.min(e.segs.length - 1, seg + d)); if (playing) speakFrom(k); else setSeg(k); };
  const goSeg = (k) => { if (!e) return; vibrate("light"); if (playing) speakFrom(k); else setSeg(k); };
  const speed = () => { const r = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : 1; setRate(r); if (playing) speakFrom(seg, r); };
  const pickEp = (i) => { stop(); setTtsErr(""); setSysPause(false); setEp(i); setSeg(0); setPhase("air"); setAnswers({}); };
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
  // v31: название выпуска и кнопки — на экране блокировки и в шторке (Media Session).
  // v36 (Доп. 346): только когда звучат живые голоса (<audio>). С голосом телефона Media Session больше
  // не включаем: «играет» (playbackState) включает в WebKit звуковой сеанс страницы, а голос телефона на
  // iPhone через ~секунду этот сеанс прерывает — и WebKit сам нажимал «пауза» (как с экрана блокировки):
  // радио молча останавливалось на первой фразе (v32–v35). Голос телефона экран блокировки и так не показывал.
  const msOn = liveRef.current && !(playing && phoneVoice);
  const ctl = React.useRef({});
  ctl.current = { toggle, jump, playing, sys: () => { stop(); setSysPause(true); } };
  React.useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : null;
    if (!ms) return undefined;
    const set = (a, h) => { try { ms.setActionHandler(a, h); } catch (x) {} };
    const off = () => { ["play", "pause", "nexttrack", "previoustrack"].forEach((a) => set(a, null)); };
    if (!msOn || !e) {
      off();
      try { ms.metadata = null; } catch (x) {}
      try { ms.playbackState = "none"; } catch (x) {}
      return undefined;
    }
    try {
      if (typeof window.MediaMetadata === "function") ms.metadata = new window.MediaMetadata({ title: e.title, artist: "Радио в дорогу", album: e.topic, artwork: [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }] });
    } catch (x) {}
    set("play", () => { if (!ctl.current.playing) ctl.current.toggle(); });
    set("pause", () => { if (ctl.current.playing) ctl.current.sys(); });
    set("nexttrack", () => ctl.current.jump(1));
    set("previoustrack", () => ctl.current.jump(-1));
    return off;
  }, [ep, msOn]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { try { const ms = navigator.mediaSession; if (ms) ms.playbackState = msOn && e ? (playing ? "playing" : "paused") : "none"; } catch (x) {} }, [playing, msOn, !!e]);   // eslint-disable-line react-hooks/exhaustive-deps
  // закрыли радио — Media Session выключаем совсем
  React.useEffect(() => () => { try { const ms = navigator.mediaSession; if (ms) { ms.playbackState = "none"; ms.metadata = null; } } catch (x) {} }, []);

  // ── v32 (Доп. 337): выпуски листаются пальцем; подсветка вкладки едет вместе с обложкой ──
  const stageRef = React.useRef(null), trackRef = React.useRef(null), segRef = React.useRef(null), pillRef = React.useRef(null);
  const gest = React.useRef(null), settle = React.useRef(0), settleT = React.useRef(0);
  const stepW = () => Math.max(1, ((stageRef.current && stageRef.current.offsetWidth) || 360) - 38);
  const pillAt = (from, to, p, anim) => {
    const row = segRef.current, pill = pillRef.current; if (!row || !pill) return;
    const tabs = row.querySelectorAll(".rd-tab"); const a = tabs[from], b = tabs[to] || a; if (!a) return;
    const x = a.offsetLeft + (b.offsetLeft - a.offsetLeft) * p, w = a.offsetWidth + (b.offsetWidth - a.offsetWidth) * p;
    pill.style.transition = anim ? "transform .32s " + EASE + ",width .32s " + EASE : "none";
    pill.style.transform = "translate3d(" + x + "px,0,0)"; pill.style.width = w + "px"; pill.style.opacity = "1";
  };
  const xRef = React.useRef(0), backRef = React.useRef(0);   // v33: где лента сейчас и кадр её возврата
  const stopBack = () => { if (backRef.current) { try { cancelAnimationFrame(backRef.current); } catch (x) {} backRef.current = 0; } };
  const setX = (x, anim) => {
    const tr = trackRef.current;
    xRef.current = x;
    if (tr) { tr.style.transition = anim ? "transform .32s " + EASE : "none"; tr.style.transform = x ? "translate3d(" + x + "px,0,0)" : ""; }
    const n = x < 0 && ep + 1 < episodes.length ? ep + 1 : x > 0 && ep > 0 ? ep - 1 : ep;
    pillAt(ep, n, n !== ep ? Math.min(1, Math.abs(x) / stepW()) : 0, anim);
  };
  // v33 (Доп. 340): обложка возвращается на место кадрами, как её ведёт палец (на iPhone CSS-переход
  // к «без сдвига» мог стереть обложку до конца анимации — как было в треке)
  const settleBack = () => {
    stopBack();
    const x0 = xRef.current;
    if (!x0 || Math.abs(x0) < 0.5 || calm() || typeof requestAnimationFrame !== "function") { setX(0, false); return; }
    const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
    const t0 = now(), D = Math.min(320, 200 + Math.abs(x0) * 0.5);
    const step = () => {
      const p = Math.min(1, (now() - t0) / D);
      if (p < 1) { setX(x0 * Math.pow(1 - p, 3), false); backRef.current = requestAnimationFrame(step); }
      else { backRef.current = 0; setX(0, false); }
    };
    backRef.current = requestAnimationFrame(step);
  };
  React.useLayoutEffect(() => {
    stopBack();
    clearTimeout(settleT.current); settle.current = 0;   // v33 (ревью): тап по вкладке во время свайпа
    setX(0, false);
    // активная вкладка — в поле зрения (если вкладок больше, чем помещается)
    try { const row = segRef.current, t = row && row.querySelectorAll(".rd-tab")[ep]; if (row && t && row.scrollWidth > row.clientWidth + 1) row.scrollTo({ left: Math.max(0, t.offsetLeft - row.clientWidth / 2 + t.offsetWidth / 2), behavior: calm() ? "auto" : "smooth" }); } catch (x) {}
  }, [ep, phase, episodes.length]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { const h = () => { stopBack(); setX(0, false); }; window.addEventListener("resize", h); return () => { window.removeEventListener("resize", h); clearTimeout(settleT.current); stopBack(); }; }, [ep]);   // eslint-disable-line react-hooks/exhaustive-deps
  // соседний выпуск: играло — продолжаем уже его (по тому же касанию: iOS разрешает звук только так)
  const commitTo = (i, wasPlaying) => {
    clearTimeout(settleT.current); settle.current = 0;
    pickEp(i);
    if (wasPlaying) setTimeout(() => speakEp(i, 0), 0);
  };
  const slideTo = (d) => {
    stopBack();
    const i = ep + d; if (i < 0 || i >= episodes.length) { settleBack(); return; }
    vibrate("light");
    const wasPlaying = playing;
    if (wasPlaying) { stop(); audioWake(); }   // звук держим «разбуженным» до нового выпуска
    if (calm()) { commitTo(i, wasPlaying); return; }
    settle.current = d;
    setX(-d * stepW(), true);
    settleT.current = setTimeout(() => { if (settle.current === d) commitTo(i, wasPlaying); }, 340);
  };
  const edge = (x) => (x > 0 && ep === 0) || (x < 0 && ep >= episodes.length - 1);   // у края — упругое сопротивление
  const onTS = (ev) => {
    const t = ev.touches && ev.touches[0];
    if (!t || ev.touches.length !== 1 || settle.current || episodes.length < 2) { const had = gest.current; gest.current = null; if (had && !settle.current) settleBack(); return; }
    // v33: обложка ещё возвращается — ловим её там, где она сейчас (без рывка)
    let b0 = 0;
    if (backRef.current) { stopBack(); b0 = Math.abs(xRef.current) < 1 ? 0 : xRef.current; if (!b0) setX(0, false); }
    gest.current = { x: t.clientX, y: t.clientY, t: Date.now(), axis: null, dx: b0, b0, base: edge(b0) ? b0 / 0.3 : b0 };
  };
  const onTM = (ev) => {
    const g = gest.current, t = ev.touches && ev.touches[0]; if (!g || !t) return;
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.axis) { if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) g.axis = "x"; else if (Math.abs(dy) > 10) { g.axis = "y"; if (g.b0) { g.b0 = 0; settleBack(); } } else return; }
    if (g.axis !== "x") return;
    const raw = g.base + dx;
    g.dx = edge(raw) ? raw * 0.3 : raw;
    setX(g.dx, false);
  };
  const onTE = () => {
    const g = gest.current; gest.current = null;
    if (!g) return;
    if (g.axis !== "x") { if (g.b0) settleBack(); return; }
    const moved = g.dx - g.b0;
    const v = moved / Math.max(1, Date.now() - g.t);
    const far = Math.abs(g.dx) > stepW() * 0.22 || (Math.abs(v) > 0.45 && Math.abs(moved) > 28);
    const dir = far ? (Math.abs(v) > 0.45 && Math.abs(moved) > 28 ? (v < 0 ? 1 : -1) : g.dx < 0 ? 1 : -1) : 0;
    if (dir === 1 && ep + 1 < episodes.length) slideTo(1);
    else if (dir === -1 && ep > 0) slideTo(-1);
    else settleBack();
  };
  const tabKey = (ev) => {
    const k = ev.key; const n = k === "ArrowRight" ? ep + 1 : k === "ArrowLeft" ? ep - 1 : null;
    if (n === null || n < 0 || n >= episodes.length) return;
    ev.preventDefault(); pickEp(n);
    try { const b = segRef.current.querySelectorAll(".rd-tab")[n]; if (b) b.focus(); } catch (x) {}
  };

  const vars = tableVars(color, a11y);
  const kc = (k) => (KIND_C[k] || KIND_C.next)[a11y ? 1 : 0];
  const wc = (w) => (WHO_C[w] || WHO_C.host)[a11y ? 1 : 0];
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
  const right = quiz.filter((q, i) => answers[i] === q.correct).length;
  const sound = canSpeak() || liveOk === true;
  const nextUnheard = episodes.findIndex((x, i) => i !== ep && !heard.includes(i));
  const laterNext = later.find((i) => i !== ep);
  const rest = episodes.map((x, i) => ({ x, i })).filter(({ i }) => i !== ep);
  // обложка выпуска: у текущей — фраза, которая звучит, и деления фраз; у соседних — начало выпуска
  const cover = (x, i) => {
    const isCur = i === ep;
    const k = isCur ? Math.min(seg, x.segs.length - 1) : 0;
    const s = x.segs[k] || x.segs[0] || { who: "host", text: "" };
    const on = isCur && playing;
    return (
      <div key={x.id} className={"rd-air rd-card" + (isCur ? " cur" : " side")} style={{ "--kc": kc(x.kind), "--wc": wc(s.who), ...(isCur ? {} : { "--k": i - ep }) }}
        aria-hidden={isCur ? undefined : "true"} data-ep={i}>
        <div className="rd-top">
          <span className="rd-kind">{KIND[x.kind] || "Выпуск"}</span>
          <span className="rd-mins">≈ {x.mins} мин</span>
          {heard.includes(i) ? <span className="rd-heard">дослушан ✓</span> : null}
        </div>
        <div className="rd-deck" aria-hidden="true">
          <div className={"rd-disc" + (on ? " on" : "")} />
          <div className="rd-sheen" />
          <Arm on={on} />
        </div>
        <div className={"rd-bars" + (on ? " on" : "")} aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className="rd-who">{WHO_IC[s.who] || WHO_IC.host}{WHO[s.who] || "ведущий"}</div>
        <p className="rd-now" aria-live={isCur ? "polite" : undefined}>{s.text}</p>
        {x.segs.length > 1 ? (
          <div className="rd-segs rd-tap" role="group" aria-label="Фразы выпуска">
            {x.segs.map((z, j) => (
              <button key={j} type="button" tabIndex={isCur ? undefined : -1} className={j < k ? "past" : j === k && isCur ? "now" : undefined}
                onClick={isCur ? () => goSeg(j) : undefined} aria-label={"Фраза " + (j + 1) + " из " + x.segs.length}><i /></button>
            ))}
          </div>
        ) : null}
        <div className="rd-pos">{isCur ? "фраза " + (k + 1) + " из " + x.segs.length : x.segs.length + " фраз"}</div>
        <div className="rd-ttl">«{x.title}»</div>
        <div className="rd-sub">{x.topic}</div>
      </div>
    );
  };
  return tableShell(
    <>
      <div className="tb-head"><div className="tb-col tb-top">
        <button type="button" className="tb-x" data-sa-back="" aria-label="Закрыть" onClick={() => { stop(); onClose(); }}><Ic n="x" s={18} /></button>
        <div className="tb-host"><span className="tb-av" aria-hidden="true"><Ic n="speaker" s={18} /></span>
          <span className="tb-host-t"><b>Радио в дорогу</b><span>{KIND[e.kind] || "Выпуск"} · ≈ {e.mins} мин{road && episodes.length > 1 ? " · вся дорога" : ""}</span></span></div>
      </div></div>
      <div className="tb-body"><div className="tb-col">
        {episodes.length > 1 ? (
          <div className={"rd-seg" + (episodes.length > 3 ? " many sa-hscroll" : "")} ref={segRef} role="tablist" aria-label="Выпуски" onKeyDown={tabKey}>
            <i className="rd-pill" ref={pillRef} aria-hidden="true" />
            {episodes.map((x, i) => (
              <button key={x.id} type="button" role="tab" aria-selected={i === ep} tabIndex={i === ep ? 0 : -1} className={"rd-tab" + (i === ep ? " on" : "")} style={{ "--kc": kc(x.kind) }} onClick={() => { if (i !== ep) { vibrate("light"); pickEp(i); } }}
                aria-label={(KIND[x.kind] || "Выпуск") + ": " + x.title + (heard.includes(i) ? ", дослушан" : "")}>
                <small>{KIND[x.kind] || "Выпуск"}</small><span>{x.title}{heard.includes(i) ? <i aria-hidden="true">✓</i> : null}</span>
              </button>
            ))}
          </div>
        ) : null}
        {phase === "air" ? (
          <>
            <div className="rd-stage" ref={stageRef} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} onTouchCancel={onTE}>
              <div className="rd-strack" ref={trackRef}>
                {episodes.map((x, i) => (Math.abs(i - ep) <= 1 ? cover(x, i) : null))}
                {/* v36 (Доп. 345): пустые места по краям — лента всегда шириной в пять обложек (как трек):
                    три обложки (≈1200 px) — между порогами WebKit на iPhone, и обложка могла пропасть на ходу */}
                {[-2, -1, 1, 2].filter((k) => Math.abs(k) === 2 || !episodes[ep + k]).map((k) => (
                  <i key={"gap" + k} className="rd-gap" data-gap={k} style={{ "--k": k }} aria-hidden="true" />
                ))}
              </div>
            </div>
            {episodes.length > 1 ? <div className="rd-dots" aria-hidden="true">{episodes.map((x, i) => <i key={x.id} className={i === ep ? "on" : undefined} />)}</div> : null}
            {sound ? (
              <div className="rd-ctl">
                <button type="button" onClick={() => jump(-1)} aria-label="Назад на фразу" style={{ transform: "rotate(180deg)" }}><Ic n="chev" s={18} /></button>
                <button type="button" className={"play" + (playing ? " on" : "")} onClick={toggle} aria-label={playing ? "Пауза" : "Слушать"}>
                  {playing ? <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /></svg>
                    : <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" /></svg>}
                </button>
                <button type="button" onClick={() => jump(1)} aria-label="Дальше на фразу"><Ic n="chev" s={18} /></button>
                <button type="button" className="sp" onClick={speed} aria-label={"Скорость " + rate}>{String(rate).replace(".", ",")}×</button>
              </div>
            ) : null}
            {sound && playing && phoneVoice && isAppleMobile() ? (
              <p className="rd-tip" role="note" data-radio-tip="">Не слышно? На iPhone проверь громкость и беззвучный режим — голос телефона он может глушить.</p>
            ) : null}
            {/* v33 (Доп. 341): телефон отказался читать — сразу под кнопками, чтобы было видно */}
            {ttsErr && !playing ? <p className="rd-tip rd-err" role="status" data-radio-err="">{ttsErr}</p> : null}
            {/* v36 (Доп. 346): живой голос остановила система — говорим об этом, а не молчим */}
            {sysPause && !playing && !ttsErr ? <p className="rd-tip" role="status" data-radio-paused="">Выпуск на паузе — звук прервал звонок, другое приложение или экран блокировки. Нажми «Слушать», чтобы продолжить.</p> : null}
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
            {sound ? <p className="rd-note">{playing && wake ? "Экран не погаснет, пока идёт выпуск." : canWake() ? "Пока идёт выпуск, экран не гаснет — телефон можно не трогать." : "Держи экран включённым — с погасшим экраном телефон перестаёт читать."}{episodes.length > 1 ? " Выпуски листаются пальцем." : ""}</p>
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
            <div className="rd-air" style={{ "--kc": kc(e.kind), "--wc": wc("host") }}>
              <div className="rd-deck" aria-hidden="true"><div className="rd-disc" /><div className="rd-sheen" /><Arm on={false} /></div>
              <div className="rd-ttl">Выпуск дослушан</div>
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
