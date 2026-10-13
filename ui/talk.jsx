// ui/talk.jsx — «Разговор голосом» прямо в чате.
// v34 (Доп. 343): кнопка-волна рядом с микрофоном (как в Claude) — на месте «Отправить», пока поле пустое.
// v35 (Доп. 344): разговор идёт в самой переписке, без отдельного экрана (выбор владельца): вместо
// поля ввода — полоса разговора: что сейчас происходит, живая волна (твой голос — светлая, ответ —
// золотая), «Пауза» и «Стоп». Реплики ложатся в чат (его ведёт экран); пока ты говоришь — в чате
// пузырь с точками, пока звучит ответ — у него значок звука. Движок — lib/talk.js.
import React from "react";
import { createTalk, primeTalk } from "../lib/talk";
import { voiceSupported } from "../lib/voice";
import { vibrate } from "../lib/utils";
import { SUPABASE_URL, SUPABASE_KEY, saToken } from "../api/supabase";

const CSS = `
.tkb{--tkb-bg:rgba(28,21,9,.55);--tkb-edge:rgba(200,160,80,.30);--tkb-text:#EFE4C8;--tkb-sub:#B4A584;--tkb-me:rgba(244,232,206,.92);--tkb-them:#D7B06A;
  --tkb-dim:rgba(214,178,102,.26);--tkb-btn:rgba(250,240,215,.08);--tkb-btn-edge:rgba(200,160,80,.35);--tkb-gold:#D2A85A;--tkb-drop:rgba(0,0,0,.38);
  display:flex;flex-direction:column;gap:6px;width:100%}
html.sa-light .tkb{--tkb-bg:rgba(255,252,244,.62);--tkb-edge:rgba(139,106,48,.38);--tkb-text:#3A2E1C;--tkb-sub:#6B5B40;--tkb-me:rgba(84,64,30,.82);--tkb-them:#9A7430;
  --tkb-dim:rgba(139,106,48,.24);--tkb-btn:rgba(139,106,48,.08);--tkb-btn-edge:rgba(139,106,48,.4);--tkb-gold:#7A5D2A;--tkb-drop:rgba(120,85,25,.12)}
.tkb-note{margin:0 10px;font-size:12.5px;line-height:1.4;font-style:italic;color:var(--tkb-sub);text-align:center;animation:tkbIn .35s ease-out}
.tkb-cap{display:flex;align-items:center;gap:8px;padding:6px;border-radius:28px;background:var(--tkb-bg);border:1px solid var(--tkb-edge);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 6px 22px var(--tkb-drop);transition:border-color .3s,box-shadow .3s}
.tkb.hearing .tkb-cap{border-color:var(--tkb-me);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 0 3px rgba(244,232,206,.07),0 6px 22px var(--tkb-drop)}
.tkb.speaking .tkb-cap{border-color:var(--tkb-them)}
.tkb-btn{flex:0 0 auto;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;padding:0;cursor:pointer;color:var(--tkb-text);background:var(--tkb-btn);border:1px solid var(--tkb-btn-edge)}
.tkb-mid{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:6px;height:44px;padding:0 4px;border:0;background:transparent;cursor:pointer;text-align:left;color:inherit;font:inherit;-webkit-tap-highlight-color:transparent}
.tkb-st{display:flex;align-items:center;gap:7px;font-family:Georgia,'Times New Roman',serif;font-size:12.5px;line-height:1.1;color:var(--tkb-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tkb.speaking .tkb-st{color:var(--tkb-gold)}
.tkb-dot{flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:var(--tkb-me)}
.tkb.speaking .tkb-dot,.tkb.thinking .tkb-dot{background:var(--tkb-them)}
.tkb.hearing .tkb-dot,.tkb.speaking .tkb-dot,.tkb.opening .tkb-dot{animation:tkbBlink 1s ease-in-out infinite}
.tkb.paused .tkb-dot{opacity:.4}
.tkb-wave{display:flex;align-items:center;justify-content:flex-end;gap:2px;height:22px;overflow:hidden}
.tkb-bar{flex:0 0 3px;height:3px;border-radius:2px;background:var(--tkb-dim);transition:height .09s linear}
.tkb.listening .tkb-bar,.tkb.hearing .tkb-bar{background:var(--tkb-me)}
.tkb.speaking .tkb-bar{background:var(--tkb-them)}
.tkb.thinking .tkb-bar,.tkb.recognizing .tkb-bar{height:3px!important;animation:tkbShim 1.3s ease-in-out infinite;animation-delay:calc(var(--k) * 36ms)}
.tkb.opening .tkb-bar,.tkb.paused .tkb-bar,.tkb.idle .tkb-bar{height:3px!important}
.tkb-stop{flex:0 0 auto;display:flex;align-items:center;gap:7px;height:42px;padding:0 16px 0 14px;border-radius:21px;border:0;cursor:pointer;color:#2A1C08;
  font:700 13.5px/1 Georgia,'Times New Roman',serif;background:linear-gradient(180deg,#F0D9A4 0%,#C8A96E 100%);box-shadow:0 4px 14px rgba(200,160,80,.3),inset 0 1px 0 rgba(255,255,255,.5)}
.tkb-btn:focus-visible,.tkb-mid:focus-visible,.tkb-stop:focus-visible{outline:2px solid var(--tkb-gold);outline-offset:2px}
@keyframes tkbBlink{50%{opacity:.3}}
@keyframes tkbShim{0%,100%{background:var(--tkb-dim)}50%{background:var(--tkb-them)}}
@keyframes tkbIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.tkb-dots{display:inline-flex;gap:4px;align-items:center;height:12px}
.tkb-dots i{display:block;width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.3;animation:tkbDot 1.2s ease-in-out infinite}
.tkb-dots i:nth-child(2){animation-delay:.18s}
.tkb-dots i:nth-child(3){animation-delay:.36s}
@keyframes tkbDot{0%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
.tkb-says{display:inline-flex;align-items:flex-end;gap:2px;height:11px;vertical-align:-1px}
.tkb-says i{display:block;width:3px;height:11px;border-radius:1px;background:currentColor;transform-origin:50% 100%;animation:tkbSay .8s ease-in-out infinite alternate}
.tkb-says i:nth-child(1){animation-delay:-.3s}
.tkb-says i:nth-child(3){animation-delay:-.55s}
@keyframes tkbSay{from{transform:scaleY(.35)}to{transform:scaleY(1)}}
@media (prefers-reduced-motion: reduce){.tkb *,.tkb-dots i,.tkb-says i{animation:none!important;transition:none!important}}
`;
let cssDone = false;
function ensureCss() {
  if (cssDone || typeof document === "undefined" || !document.head) return;
  cssDone = true;
  const st = document.createElement("style"); st.id = "sa-talk-css"; st.textContent = CSS; document.head.appendChild(st);
}

const STT_URL = () => `${SUPABASE_URL}/functions/v1/stt`;
const TTS_URL = () => `${SUPABASE_URL}/functions/v1/radio-tts`;
const HEADERS = () => ({ apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY });

// разговор голосом возможен: есть микрофон с записью (распознаёт сервер)
export const canTalk = () => { try { return voiceSupported() && typeof MediaRecorder !== "undefined" && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); } catch (e) { return false; } };

// Кнопка-волна (как в Claude): стоит на месте «Отправить», пока поле пустое.
// Касание сразу «будит» звук (primeTalk): на iPhone иначе ответ собеседника не зазвучит. Сначала —
// onClick экрана (он гасит прежнее чтение и клавиатуру), потом «будим»: иначе он погасил бы и это.
export function TalkButton({ size = 44, onClick, disabled, label = "Разговор голосом" }) {
  const tap = (e) => { if (disabled) return; if (onClick) onClick(e); try { primeTalk(); } catch (x) {} };
  return (
    <button type="button" className="sa-btn" data-talk-open="" onClick={tap} disabled={disabled} aria-label={label} title={label}
      style={{ width: size, height: size, borderRadius: size / 2, border: "none", cursor: disabled ? "default" : "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center", color: "#2A1C08", opacity: disabled ? 0.5 : 1,
        background: "linear-gradient(180deg,#F0D9A4 0%,#C8A96E 100%)", boxShadow: "0 4px 14px rgba(200,160,80,0.32), inset 0 1px 0 rgba(255,255,255,0.5)" }}>
      <svg width={Math.round(size * 0.48)} height={Math.round(size * 0.48)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
        <path d="M3.5 10.5v3M7.5 7.5v9M12 4v16M16.5 7.5v9M20.5 10.5v3" />
      </svg>
    </button>
  );
}

// В чате: «ты говоришь» — три точки в твоём пузыре; «звучит» — значок у реплики, которую читают
export function TalkDots() { ensureCss(); return <span className="tkb-dots" aria-hidden="true"><i /><i /><i /></span>; }
export function TalkSpeaking({ style }) { ensureCss(); return <span className="tkb-says" style={style} aria-hidden="true" data-talk-speaking=""><i /><i /><i /></span>; }

// что сейчас происходит — в строке над волной
const STATUS = {
  idle: "",
  opening: "Включаю микрофон…",
  listening: "Слушаю — говори",
  hearing: "Слышу — договори и помолчи",
  recognizing: "Разбираю…",
  thinking: "Думает…",
  speaking: "Отвечает — можно перебить",
  paused: "Пауза — коснись волны",
};
const N = 36;   // столбиков в волне

// Полоса разговора — на месте поля ввода. ask(text) → Promise<{ text, end }> (экран кладёт реплики в
// чат сам); voice — живой голос (mentor | guest | guest_f), phone — { pitch, rate } для голоса телефона,
// first — реплика собеседника в начале, actions — не читать *действия*, who — для демо и проверок,
// onState(state) — экрану: пузырь «ты говоришь» и значок «звучит»; onClose(why) — разговор окончен.
// v36: maxSpeak — вслух не больше стольких знаков ответа (длинный ответ Наставника — начало и «Остальное —
// в чате»; весь ответ — в переписке)
export function TalkBar({ who = "mentor", name, voice = "mentor", phone, first, actions = false, maxSpeak = 0, ask, onClose, onState }) {
  ensureCss();
  const [state, setState] = React.useState("idle");
  const [note, setNote] = React.useState("");
  const askRef = React.useRef(ask); askRef.current = ask;
  const closeRef = React.useRef(onClose); closeRef.current = onClose;
  const stateRef = React.useRef(onState); stateRef.current = onState;
  const talkRef = React.useRef(null);
  const stRef = React.useRef("idle");
  const bars = React.useRef([]);
  const lv = React.useRef(new Array(N).fill(0));
  // волна бежит справа налево: новый уровень — справа (как запись голосового)
  const push = (v) => {
    const a = lv.current; a.shift(); a.push(Math.max(0, Math.min(1, v || 0)));
    const els = bars.current;
    for (let k = 0; k < N; k++) { const el = els[k]; if (el) el.style.height = (3 + Math.round(a[k] * 19)) + "px"; }
  };
  const flat = () => { lv.current.fill(0); bars.current.forEach((el) => { if (el) el.style.height = ""; }); };
  React.useEffect(() => {
    // ответ звучит — волна «играет» сама (звук ответа не разбираем: на iPhone это мешало бы звуку)
    if (state === "speaking") {
      let t = 0;
      const iv = setInterval(() => { t += 1; push(0.22 + 0.55 * Math.abs(Math.sin(t * 0.55) * Math.sin(t * 0.21 + 1.3)) + Math.random() * 0.2); }, 70);
      return () => clearInterval(iv);
    }
    if (state !== "listening" && state !== "hearing") flat();
    return undefined;
  }, [state]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const t = createTalk({
      ask: (text) => askRef.current(text), first, voice, phone, actions, maxSpeak,
      sttUrl: STT_URL(), ttsUrl: TTS_URL(), headers: HEADERS(), token: saToken(),
      // строка-подсказка живёт, пока человек не заговорил (или не коснулся в паузе): «Не расслышал»,
      // «отвечает голос телефона» должны успеть прочитаться
      onState: (s) => {
        const was = stRef.current; stRef.current = s;
        setState(s);
        if (s === "hearing" || (was === "paused" && s !== "paused")) setNote("");
        if (s === "listening") vibrate("light");
        try { stateRef.current && stateRef.current(s); } catch (e) {}
      },
      onNote: (x) => setNote(x),
      onLevel: (v) => { const s = stRef.current; if (s === "listening" || s === "hearing") push(v); },
      onEnd: (why) => { if (why === "end") setTimeout(() => { try { closeRef.current && closeRef.current("end"); } catch (e) {} }, 500); },
    });
    talkRef.current = t;
    t.start();   // звук уже «разбужен» касанием кнопки-волны (primeTalk) — движок его заберёт
    return () => { try { t.stop(); } catch (e) {} talkRef.current = null; try { stateRef.current && stateRef.current("idle"); } catch (e) {} };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const stop = () => { try { talkRef.current && talkRef.current.stop(); } catch (e) {} vibrate("light"); if (onClose) onClose("stop"); };
  const tap = () => { const t = talkRef.current; if (!t) return; vibrate("light"); t.tap(); };
  const pauseOrGo = () => { const t = talkRef.current; if (!t) return; vibrate("light"); if (state === "paused") t.tap(); else t.pause(); };
  const midLabel = state === "speaking" ? "Перебить" : state === "hearing" ? "Закончить фразу" : state === "paused" ? "Слушать снова" : state === "recognizing" ? "Сказать заново" : "Разговор голосом";
  return (
    <div className={"tkb " + state} data-talk="" data-talk-who={who} role="group" aria-label={"Разговор голосом" + (name ? " · " + name : "")}>
      {note ? <p className="tkb-note" role="status" data-talk-note="">{note}</p> : null}
      <div className="tkb-cap">
        <button type="button" className="tkb-btn" onClick={pauseOrGo} aria-label={state === "paused" ? "Слушать снова" : "Пауза"} data-talk-pause="">
          {state === "paused"
            ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.3" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.3" /></svg>}
        </button>
        <button type="button" className="tkb-mid" onClick={tap} aria-label={midLabel} data-talk-wave={state}>
          <span className="tkb-st" aria-live="polite" data-talk-state={state}><span className="tkb-dot" aria-hidden="true" />{STATUS[state] || ""}</span>
          <span className="tkb-wave" aria-hidden="true">
            {Array.from({ length: N }, (_, k) => <span key={k} className="tkb-bar" style={{ "--k": k }} ref={(el) => { bars.current[k] = el; }} />)}
          </span>
        </button>
        <button type="button" className="tkb-stop" onClick={stop} data-sa-back="" data-talk-stop="" aria-label="Закончить разговор голосом">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /></svg>
          Стоп
        </button>
      </div>
    </div>
  );
}
