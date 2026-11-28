// ui/concept-pitch.jsx — v192 (Доп. 517): тренажёр «Рассказ гостю за 30 секунд».
//
// Владелец (23.11), про семь идей для «О нас»: «Ты правильно понял. Делаем все 7». Гость впервые у нас и спрашивает,
// что это за место. Сотрудник рассказывает своими словами за 30 секунд: голосом (микрофон, распознавание — функция stt,
// как в «Случаях из зала») или текстом. Помощник сравнивает с образцом из блока «Рассказ гостю за 30 секунд» и фактами
// раздела и отвечает: что получилось, что упущено, один совет и как это могло звучать (/api/lesson-assist, режим
// concept_pitch, lib/concept-pitch.js). Помощник не ответил — разбор по словам образца здесь же. Образец открывается
// после попытки, чтобы не пересказывать его с экрана.
import React from "react";
import { SUPABASE_URL, SUPABASE_KEY, fnUrl } from "../lib/supabase";   // v225: адрес функции — fnUrl
import { vibrate } from "../lib/utils";
import { GOLD, GREEN } from "./tokens";
import { UI_SVG } from "./icons";
import { MicButton } from "./mic";
import { conceptPitch } from "../lib/concept";
import { askAI } from "../lib/concept-ai";
import { PITCH_SECS, PITCH_WORDS, PITCH_LIMITS, pitchLocal, pitchWordCount } from "../lib/concept-pitch";

const SERIF = "Georgia, 'Times New Roman', serif";
const TITLE = "'Piazzolla', Georgia, serif";
const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
const SCORE = ["", "Попробуй ещё раз", "Есть над чем поработать", "Неплохо", "Почти готово для гостя", "Готово для гостя"];
const STT = { url: fnUrl("stt"), headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } };

function Ring({ left, total, over, c, T }) {
  const R = 46, L = 2 * Math.PI * R, k = Math.max(0, Math.min(1, left / total));
  return (
    <div data-pitch-ring={over ? "over" : left} style={{ position: "relative", width: 112, height: 112, margin: "4px auto 10px" }}>
      <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
        <circle cx="56" cy="56" r={R} fill="none" stroke={c.line} strokeWidth="6" />
        <circle cx="56" cy="56" r={R} fill="none" stroke={over ? c.warn : GOLD} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={L} strokeDashoffset={L * (1 - k)} transform="rotate(-90 56 56)" style={{ transition: "stroke-dashoffset .9s linear" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: TITLE, fontWeight: 700, fontSize: 30, color: over ? c.warn : T.modTitle.color, lineHeight: 1 }}>{over ? "+" + over : left}</div>
        <div style={{ fontSize: 11.5, color: c.soft, marginTop: 3 }}>{over ? "сверх" : "секунд"}</div>
      </div>
    </div>);
}

export function PitchScreen({ T, a11y, concept, track, onBack }) {
  const c = a11y
    ? { line: "rgba(139,106,48,0.22)", chip: "rgba(139,106,48,0.10)", soft: "#5C4A2A", warn: "#8B5A12", ok: "#2C6B48", field: "rgba(255,250,238,0.75)" }
    : { line: "rgba(214,178,102,0.18)", chip: "rgba(214,178,102,0.10)", soft: "rgba(232,215,180,0.72)", warn: "#E4B36A", ok: "#8AD8AF", field: "rgba(30,24,14,0.6)" };
  const p = React.useMemo(() => conceptPitch(concept, track), [concept, track]);
  const [phase, setPhase] = React.useState("intro");   // intro | talk | wait | result
  const [text, setText] = React.useState("");
  const [t0, setT0] = React.useState(0);
  const [now, setNow] = React.useState(0);
  const [secs, setSecs] = React.useState(0);
  const [res, setRes] = React.useState(null);
  const [peek, setPeek] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const textRef = React.useRef("");
  textRef.current = text;
  React.useEffect(() => {
    if (phase !== "talk") return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase]);
  const gone = phase === "talk" && t0 ? Math.floor((now - t0) / 1000) : 0;
  const left = Math.max(0, PITCH_SECS - gone), over = Math.max(0, gone - PITCH_SECS);
  const words = pitchWordCount(text);
  const head = (
    <div style={T.lessHead}>
      <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onBack}>‹</button>
      <div style={T.lessHeadTitle}>Рассказ гостю</div>
    </div>);
  const main = { width: "100%", padding: "12px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: SERIF, fontSize: 14.5, fontWeight: "bold", color: "#1A1008",
    background: "linear-gradient(180deg,#E4C88C,#C8A96E)" };
  const ghost = { padding: "8px 16px", borderRadius: 999, border: "1px solid " + c.line, background: c.chip, color: T.modTitle.color, fontSize: 13.5, fontFamily: SERIF, cursor: "pointer" };
  const card = { ...T.modCard, display: "block", padding: "14px 16px", marginBottom: 12, cursor: "default" };
  const h = (t) => <div style={{ fontFamily: SERIF, fontWeight: "bold", fontSize: 14.5, color: T.modTitle.color, margin: "0 0 6px" }}>{t}</div>;

  if (!p) {
    return (
      <div style={T.screen} className="sa-screen" data-pitch="none">{head}
        <div style={{ flex: 1, padding: "14px 16px 28px" }}>
          <div data-lens-card="" style={card}><div style={T.para}>В «О нас» пока нет образца рассказа гостю. Его добавляет руководитель: блок «Рассказ гостю за 30 секунд».</div></div>
        </div>
      </div>);
  }

  const start = () => { vibrate("light"); setText(""); setRes(null); setPeek(false); setMsg(""); setT0(Date.now()); setNow(Date.now()); setPhase("talk"); };
  const send = async () => {
    const said = textRef.current.trim();
    if (said.length < 15) { setMsg("Расскажи хотя бы пару предложений."); return; }
    vibrate("light"); setMsg("");
    const s = Math.max(1, Math.round((Date.now() - t0) / 1000));
    setSecs(s); setPhase("wait");
    const r = await askAI("concept_pitch", { title: p.where, src: p.ref, facts: p.facts, text: said.slice(0, PITCH_LIMITS.said), secs: s });
    if (r && r.ok && (r.good || r.missed || r.tip)) setRes({ good: r.good || [], missed: r.missed || [], tip: r.tip || "", better: r.better || "", score: r.score || 0, local: false });
    else setRes(pitchLocal(p.ref, said, s));
    vibrate("success"); setPhase("result");
  };

  return (
    <div style={T.screen} className="sa-screen" data-pitch={phase}>{head}
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>
        {phase === "intro" ? <>
          <div data-lens-card="" style={card}>
            <div style={{ fontFamily: TITLE, fontSize: 20, color: T.modTitle.color, lineHeight: 1.3 }}>Гость впервые у нас и спрашивает: «Что у вас за место?»</div>
            <div style={{ ...T.para, marginTop: 8 }}>Расскажи своими словами за 30 секунд: кто мы, чем отличаемся и что попробовать. Можно голосом или текстом.</div>
            <div style={{ fontSize: 12.5, color: c.soft, lineHeight: 1.5, marginTop: 8 }}>Помощник сравнит с образцом из «О нас» и скажет, что получилось и что упущено. Образец покажу после попытки.</div>
          </div>
          <button type="button" data-lens-btn="main" data-pitch-start="" style={main} onClick={start}>Начать, 30 секунд</button>
        </> : null}

        {phase === "talk" ? <>
          <Ring left={left} total={PITCH_SECS} over={over} c={c} T={T} />
          <div style={{ textAlign: "center", fontSize: 12.5, color: over ? c.warn : c.soft, marginBottom: 10 }}>{over ? "Время вышло. Закончи мысль и жми «Готово»." : "Говори в микрофон или пиши. Время идёт."}</div>
          <div data-lens-card="" style={{ ...card, padding: "10px 12px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <textarea data-lens-field="" data-pitch-text="" rows={6} value={text} maxLength={PITCH_LIMITS.said} onChange={(e) => { setText(e.target.value); if (msg) setMsg(""); }}
                placeholder="Добрый вечер! Мы…" style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: "1px solid " + c.line, background: c.field,
                  color: T.modTitle.color, fontFamily: SERIF, fontSize: 15, lineHeight: 1.5, resize: "vertical", outline: "none" }} />
              <span data-pitch-mic=""><MicButton a11y={a11y} size={46} sttUrl={STT.url} headers={STT.headers}
                onText={(x) => { const a = textRef.current.trim(), b = String(x || "").trim(); setText((a && b ? a + " " + b : a || b).slice(0, PITCH_LIMITS.said)); setMsg(""); }}
                onError={(m) => setMsg(m)} /></span>
            </div>
            <div data-pitch-words={words} style={{ fontSize: 12, color: words && (words < PITCH_WORDS.min || words > PITCH_WORDS.max) ? c.warn : c.soft, marginTop: 6 }}>
              {words ? words + " " + plural(words, "слово", "слова", "слов") + ". " : ""}За 30 секунд спокойно говорят 50–80 слов.</div>
          </div>
          <button type="button" data-lens-btn="main" data-pitch-done="" style={main} onClick={send}>Готово</button>
        </> : null}

        {phase === "wait" ? <div role="status" data-pitch-wait="" style={{ ...T.para, textAlign: "center", padding: "40px 0" }}>Помощник слушает рассказ…</div> : null}

        {phase === "result" && res ? <>
          <div data-lens-card="" data-pitch-score={res.score} style={{ ...card, textAlign: "center" }}>
            <div aria-hidden="true" style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 6 }}>
              {[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: i <= res.score ? GOLD : c.line }} />)}</div>
            <div style={{ fontFamily: TITLE, fontSize: 19, color: T.modTitle.color }}>{SCORE[res.score] || "Разбор готов"}</div>
            <div style={{ fontSize: 12.5, color: c.soft, marginTop: 3 }}>{secs} {plural(secs, "секунда", "секунды", "секунд")}, {words} {plural(words, "слово", "слова", "слов")}</div>
          </div>
          {res.good.length ? <div data-lens-card="" data-pitch-good={res.good.length} style={card}>{h("Получилось")}
            {res.good.map((x, i) => <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", ...T.para, margin: "4px 0" }}><span style={{ flexShrink: 0, marginTop: 3, display: "inline-flex" }}>{UI_SVG.checkCircle(GREEN, 15)}</span><span>{x}</span></div>)}
          </div> : null}
          {res.missed.length ? <div data-lens-card="" data-pitch-missed={res.missed.length} style={card}>{h("Что упущено")}
            {res.missed.map((x, i) => <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", ...T.para, margin: "4px 0" }}><span aria-hidden="true" style={{ flexShrink: 0, width: 7, height: 7, borderRadius: 4, background: GOLD, marginTop: 8 }} /><span>{x}</span></div>)}
          </div> : null}
          {res.tip ? <div data-lens-card="" data-pitch-tip="" style={card}>{h("Совет")}<div style={T.para}>{res.tip}</div></div> : null}
          {res.better ? <div data-lens-card="" data-pitch-better="" style={card}>{h("Как могло звучать")}
            <div style={{ ...T.para, borderLeft: "3px solid " + GOLD, paddingLeft: 10, fontStyle: "italic" }}>{res.better}</div></div> : null}
          {res.local ? <div style={{ fontSize: 12, color: c.soft, lineHeight: 1.45, margin: "-4px 2px 12px" }}>Помощник сейчас не ответил, поэтому разбор по словам образца.</div> : null}
          <div data-lens-card="" style={card}>
            <button type="button" data-lens-row="" data-pitch-peek={peek ? "1" : "0"} aria-expanded={peek} onClick={() => setPeek((x) => !x)}
              style={{ display: "flex", width: "100%", alignItems: "baseline", gap: 8, background: "transparent", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}>
              <span style={{ flex: 1, fontFamily: SERIF, fontWeight: "bold", fontSize: 14.5, color: T.modTitle.color }}>Образец из «О нас»</span>
              <span style={{ fontSize: 12.5, color: GOLD }}>{peek ? "Свернуть" : "Показать"}</span>
            </button>
            {peek ? <div data-pitch-ref="" style={{ ...T.para, marginTop: 8, whiteSpace: "pre-line" }}>{p.ref}</div> : null}
            <div style={{ fontSize: 12.5, color: c.soft, marginTop: 10 }}>Твой рассказ</div>
            <div data-pitch-said="" style={{ ...T.para, marginTop: 2 }}>{text}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" data-lens-btn="main" data-pitch-again="" style={{ ...main, flex: 1 }} onClick={start}>Ещё раз</button>
            <button type="button" data-lens-btn="soft" data-pitch-close="" style={{ ...ghost, padding: "11px 18px" }} onClick={onBack}>Готово</button>
          </div>
        </> : null}
        {msg ? <div role="status" data-pitch-msg="" style={{ fontSize: 12.5, color: c.warn, marginTop: 10, textAlign: "center" }}>{msg}</div> : null}
      </div>
    </div>);
}
