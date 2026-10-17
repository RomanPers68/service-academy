// ui/table.jsx — формат «обслужи стол» в приложении (Доп. 289–292).
//
// Не копия «вопрос → ответ → зелёная плашка»: ситуация разыгрывается у стола.
// Выбор — реплика или действие, зал реагирует (настроение на лице), разбор пишет
// наставник от руки на бумаге, после промаха можно «спасти ситуацию» — второй шанс.
// Итог печатается чеком. Ничего не выдумываем: ситуации, объяснения, очки, звёзды,
// жизни — те же данные и та же логика, что в классической практике.
//
//   TablePractice — практика раздела (тот же practiceState, что и в классике);
//   TableCheck    — «закрепить у стола» после текстового урока: две ситуации
//                   из практики этого же раздела, ближайшие к теме урока;
//                   mode="warmup" — «Разминка до смены» (Доп. 301);
//   WeekReceipt   — «Чек недели» с отправкой команде (Доп. 305).
// Доп. 299–300: «Подсмотреть в уроке», «Послушать», автопереход при повторе,
// «Разобрать с Наставником», «вслух» с микрофоном, подпись наставника ресторана.
// v40: TablePractice preview — проба из редактора контента (ui/content-editor.jsx): те же экраны,
// но ничего не обещает записать (practiceExitText, PREVIEW_NOTE), без Наставника и микрофона.
//
// Модуль ленивый: грузится фоном, без него работает классический вид.

import React from "react";
import { createPortal } from "react-dom";
import { ensureTableCss } from "./table-css";
import { ensureLessonCss } from "./table-css-lesson";
import { Ic, Candle, SitIcon, plural } from "./table-bits";
// v43 (Доп. 356): в строках «Серия» и «Цель дня» — пламя и бокал, как на главной; чек — бумага, палитра светлая
import { Flame, Wine } from "./day-emblems";
import { MicButton } from "./mic";
import { voiceSupported } from "../lib/voice";
import { SUPABASE_URL, SUPABASE_KEY } from "../api/supabase";
import { peekFor } from "../lib/peek";
import { checkSaid } from "../lib/say-check";
import { iconForSituation } from "../lib/situation-icons";
import { sfx, sfxOn, setSfx } from "../lib/sfx";
import { vibrate, shuffleSituationOptions, shuffleQuizOptions } from "../lib/utils";
import { pickForLesson, practicePool, tablePool } from "../lib/table-pick";
import { practiceRound, sitKey } from "../lib/practice-round";
import { dayOffFromSchedule, ymd } from "../lib/streak";
import { inkOf } from "../lib/tracks";
import { mistakeFromSituation, tfLabel, missText } from "../lib/practice-mistake";
import { weekShareText } from "../lib/activity";
import { creditPassed, goldPassed, CREDIT_PASS, CREDIT_N, GOLD_MAX_WRONG } from "../lib/marks";
import { speakText, stopSpeech, audioWake, audioSleep } from "../lib/speech";   // v32 (Доп. 336)

ensureTableCss();
ensureLessonCss();

const genreOf = (s) => (s && (s.genre || s.type)) || "action";
const CHOICE = { action: 1, find: 1, timer: 1, empathy: 1, quiz: 1 };
const PLACE = { action: "в зале", find: "найди ошибку", timer: "быстрое решение", truefalse: "правда или миф", complete: "собери правило", empathy: "глазами гостя", quiz: "вопрос из теста" };
const MOUTH = { 1: "M8.6 16.8Q12 13.4 15.4 16.8", 2: "M8.8 16.3Q12 14.9 15.2 16.3", 3: "M9 15.7H15", 4: "M8.7 14.8Q12 17.6 15.3 14.8", 5: "M8.3 14.2Q12 19.2 15.7 14.2" };
const MOOD_WORD = { 1: "раздражён", 2: "недоволен", 3: "спокоен", 4: "доволен", 5: "в восторге" };
const OKW = ["Так и надо", "Верно", "В точку", "Именно так", "Как по стандарту"];
const TIMER_S = 12;   // как TimerBar в классической практике
const AUTO_MS = 2600; // Доп. 299: автопереход после верного ответа при повторе

const stripEm = (t) => String(t || "").replace(/^[\p{Extended_Pictographic}️‍\s]+/u, "").trim();
const unquote = (t) => String(t || "").trim().replace(/^[«"“]\s*/, "").replace(/\s*[»"”]$/, "");
const allSpeech = (opts) => (opts || []).length > 0 && opts.every((o) => /^[«"“]/.test(String(o).trim()));
const reducedMotion = () => { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
const pad2 = (x) => String(x).padStart(2, "0");
const stampNow = () => { const d = new Date(); return pad2(d.getDate()) + "." + pad2(d.getMonth() + 1) + " · " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); };
const hashOf = (s) => { let h = 0; for (const ch of String(s || "")) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };

// Ситуация → вопрос «Работы над ошибками»: lib/practice-mistake.js (общая с уборкой банка в App)
export { mistakeFromSituation };
// v30: части стола для «Живого гостя» (ui/live-guest.jsx) — тот же вид, та же бумага чека
export { MoodFace as TableMood, Line as TableLine, Edge as TableEdge, shell as tableShell, roleVars as tableVars, SoundBtn as TableSound, MOOD_WORD as TABLE_MOOD_WORD };

// ── мелкие части ─────────────────────────────────────────────────────
function MoodFace({ m, fx, hall }) {
  return (
    <span key={m + (fx || "")} className={"tb-mood m" + m + (fx ? " " + fx : "")} role="img" aria-label={"Настроение " + (hall ? "зала" : "гостя") + ": " + MOOD_WORD[m]}>
      <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="mf" cx="12" cy="12" r="9.6" />
        <circle cx="9" cy="10" r="1.15" fill="currentColor" /><circle cx="15" cy="10" r="1.15" fill="currentColor" />
        {m <= 1 ? <path className="mf" d="M7.4 7.4l2.6 1.2M16.6 7.4L14 8.6" /> : null}
        <path className="mf" d={MOUTH[m]} />
      </svg>
    </span>
  );
}

function Plate({ ok, just }) {
  return (
    <svg className={"tb-plate" + (ok ? "" : " broken") + (just ? " just" : "")} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="p1" cx="12" cy="12" r="9.6" /><circle className="p2" cx="12" cy="12" r="5.6" />
      {ok ? null : <path className="crack" d="M12.6 2.6l-1.9 4.6 2.4 2.3-2.6 3.4 1.7 3.1-1 5.2" />}
    </svg>
  );
}
function Plates({ lives, justBroke }) {
  const n = Math.max(0, lives);
  return (
    <span className="tb-plates" role="img" aria-label={"Тарелки: можно ошибиться ещё " + n + " " + plural(n, "раз", "раза", "раз")}>
      {[0, 1, 2].map((i) => <Plate key={i} ok={i < n} just={justBroke && i === n} />)}
    </span>
  );
}

function Beads({ n, pos, marks, curDone }) {
  const items = [];
  for (let k = 0; k < n; k++) {
    const cls = k < pos || (k === pos && curDone) ? (marks[k] === "bad" ? "bad" : "on") : k === pos ? "cur" : "";
    items.push(<i key={k} className={cls} />);
  }
  const done = pos + (curDone ? 1 : 0);
  const fpos = Math.min(n - 1, done > pos ? pos + 1 : pos);
  const frac = n > 1 ? fpos / (n - 1) : 1;
  return <div className="tb-beads"><span className="bf" style={{ width: "calc((100% - 8px) * " + frac.toFixed(4) + ")" }} /><span className="bi">{items}</span></div>;
}

function Note({ ok, title, sign, children }) {
  return (
    <div className="tb-note tb-new" role="status">
      <div className={"nt " + (ok ? "ok" : "bad")}>{title}</div>
      {children}
      <div className="sign">— {sign}</div>
    </div>
  );
}

// «А теперь — вслух». Доп. 300: если телефон умеет записывать голос — слушаем
// микрофон и сверяем ключевые слова фразы; нет — как раньше, «получилось / ещё разок».
function SayAloud({ phrase, onVoice, a11y }) {
  const [res, setRes] = React.useState(null);
  const [heard, setHeard] = React.useState(null);
  const [err, setErr] = React.useState("");
  const canTts = typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
  const canMic = (() => { try { return voiceSupported(); } catch (e) { return false; } })();
  // v32 (Доп. 336): через lib/speech — фраза не «теряется» (v33: без «тихой дорожки»)
  const speak = () => {
    try { audioWake(); speakText(phrase, { rate: 0.95, cancelBefore: true, onend: () => audioSleep(), onerror: () => audioSleep() }); } catch (e) {}
  };
  const chk = heard != null ? checkSaid(phrase, heard) : null;
  React.useEffect(() => { if (chk) { sfx(chk.ok ? "ok" : "bad"); if (onVoice) onVoice(chk); } }, [heard]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="tb-say tb-new">
      <span className="tb-who">А теперь — вслух</span>
      <div className="ph">
        {canTts ? <button type="button" className="tb-spk" onClick={speak} aria-label="Прослушать фразу"><Ic n="speaker" s={18} /></button> : null}
        {chk ? (
          <p className="tb-said">«{chk.words.map((w, i) => <span key={i} className={w.hit === true ? "w-ok" : w.hit === false ? "w-no" : undefined}>{w.text}</span>)}»</p>
        ) : <p>«{phrase}»</p>}
      </div>
      {chk ? (
        <>
          <p className="tb-heard">Услышал: «{heard}»</p>
          <div className={"res" + (chk.ok ? "" : " again")}>{chk.ok ? "Звучит уверенно — все главные слова на месте." : "Почти. Подчёркнутые слова не прозвучали — попробуй ещё раз."}</div>
          <div className="mic-row" style={{ marginTop: 10 }}>
            <MicButton a11y={false} size={40} sttUrl={`${SUPABASE_URL}/functions/v1/stt`} headers={{ apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }}
              onText={(t) => { setErr(""); setHeard(String(t || "")); }} onError={(m) => setErr(String(m || "Не расслышал"))} />
            <span>Ещё раз — нажми и скажи</span>
          </div>
        </>
      ) : res === null ? (
        <>
          {canMic ? (
            <div className="mic-row">
              <MicButton a11y={false} size={44} sttUrl={`${SUPABASE_URL}/functions/v1/stt`} headers={{ apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }}
                onText={(t) => { setErr(""); setHeard(String(t || "")); }} onError={(m) => setErr(String(m || "Не расслышал"))} />
              <span>Нажми и скажи фразу — как живому гостю. Сверю главные слова.</span>
            </div>
          ) : (
            // v40: размер — как в CSS: в светлой теме («Для чтения», a11y) 13 px — то же, что правило
            // html.sa-light .tb-say>div:not([class]) в ui/table-css-lesson.js; в тёмной — 12,5 px, как было
            <div style={{ fontSize: a11y ? 13 : 12.5, color: "var(--sub)", margin: "0 0 10px", lineHeight: 1.45 }}>Проговори фразу вслух — как живому гостю. Получилось?</div>
          )}
          {err ? <p className="tb-heard">{err}</p> : null}
          <div className="row">
            <button type="button" className="yes" onClick={() => setRes("ok")}>{canMic ? "Сказал без проверки" : "Получилось"}</button>
            <button type="button" onClick={() => setRes("again")}>Ещё разок</button>
          </div>
        </>
      ) : (
        <div className={"res" + (res === "again" ? " again" : "")}>{res === "ok" ? "Отлично! Звучит уверенно." : "Ещё пара повторов — и пойдёт на автомате."}</div>
      )}
    </div>
  );
}

function ExitSheet({ title, text, onStay, onLeave }) {
  return (
    <div className="tb-scrim" onClick={onStay}>
      <div className="tb-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{text}</p>
        <button type="button" className="tb-main" data-sa-back="" onClick={onStay}>Остаться</button>
        <button type="button" className="tb-ghost" onClick={onLeave}>Выйти</button>
      </div>
    </div>
  );
}

function SoundBtn() {
  const [on, setOn] = React.useState(sfxOn);
  return (
    <button type="button" className="tb-tool" onClick={() => { const v = !on; setSfx(v); setOn(v); if (v) sfx("tap"); }} aria-label={on ? "Выключить звук" : "Включить звук"} aria-pressed={on}>
      <Ic n={on ? "speaker" : "mute"} s={17} />
    </button>
  );
}

// Ситуация у стола: место, сцена, вопрос, варианты. После ответа варианты
// уходят — остаётся то, что ты сделал, и реакция (children).
function Situation({ sit, asking, pick, removed = [], second, timer, timerKey = 0, timerPaused = false, onPick, children }) {
  const g = genreOf(sit);
  const opts = (sit.options || []).map((_, i) => i).filter((i) => removed.indexOf(i) < 0);
  const where = <div className="tb-scene-row"><span className="tb-where role">{PLACE[g] || "в зале"}</span></div>;
  if (g === "truefalse") {
    const fb = !asking;
    return (
      <>
        {where}
        <div className="tb-claim"><span className="na">Наставник спрашивает: правда или миф?</span>«{String(sit.statement || "").replace(/^«|»$/g, "")}»</div>
        {timer && asking ? <div className={"tb-timer" + (timerPaused ? " stop" : "")} role="timer" aria-label={"На решение " + timer + " секунд"}><i key={timerKey} style={{ animationDuration: timer + "s" }} /></div> : null}
        <div className="tb-myth">
          {(sit.options || []).map((o, i) => {
            const L = tfLabel(o);
            const cls = fb ? (i === sit.correct ? "right" : i === pick ? "wrong" : "dim") : "";
            return <button type="button" key={i} className={cls || undefined} disabled={fb} onClick={() => onPick(i)}>{L.t}<small>{L.s}</small></button>;
          })}
        </div>
        {children}
      </>
    );
  }
  if (g === "complete") {
    const fb = !asking;
    return (
      <>
        {where}
        <div className="tb-note cloze">
          <div className="nt">Собери правило</div>
          <p>{sit.start} <span className={"tb-blank" + (fb ? (pick === sit.correct ? " right" : " wrong") : "")}>{fb && pick >= 0 ? sit.options[pick] : " "}</span></p>
        </div>
        {asking ? (
          <>
            <h3 className="tb-q">{sit.question || "Выбери продолжение"}</h3>
            {timer ? <div className={"tb-timer" + (timerPaused ? " stop" : "")} role="timer" aria-label={"На решение " + timer + " секунд"}><i key={timerKey} style={{ animationDuration: timer + "s" }} /></div> : null}
            <div className="tb-chips">{opts.map((i) => <button type="button" key={i} className="tb-chip2" onClick={() => onPick(i)}>{sit.options[i]}</button>)}</div>
          </>
        ) : null}
        {children}
      </>
    );
  }
  const speech = allSpeech(sit.options);
  return (
    <>
      {where}
      {g === "empathy" && sit.guestThought ? <div className="tb-thought"><span className="tb-who">Мысли гостя</span>{sit.guestThought}</div> : null}
      {sit.scene ? <div className="tb-scene"><span className="em" aria-hidden="true"><SitIcon name={iconForSituation(sit)} s={20} /></span><p>{sit.scene}</p></div> : null}
      {asking ? (
        <>
          {second ? <div className="tb-second"><Ic n="refresh" s={16} /><span>Второй шанс: гость ещё ждёт. Как исправишь?</span></div> : null}
          <h3 className="tb-q">{sit.question}</h3>
          {timer ? <div className={"tb-timer" + (timerPaused ? " stop" : "")} role="timer" aria-label={"На решение " + timer + " секунд"}><i key={timerKey} style={{ animationDuration: timer + "s" }} /></div> : null}
          {speech ? (
            <div className="tb-replies">{opts.map((i) => <button type="button" key={i} className="tb-reply" onClick={() => onPick(i)} aria-label={"Сказать: " + sit.options[i]}><span>{sit.options[i]}</span><Ic n="send" s={16} /></button>)}</div>
          ) : (
            <div className="tb-acts">{opts.map((i) => <button type="button" key={i} className="tb-actc" onClick={() => onPick(i)}><span>{sit.options[i]}</span><Ic n="chev" s={16} /></button>)}</div>
          )}
        </>
      ) : null}
      {children}
    </>
  );
}

function Edge() {
  let d = "M0 0";
  for (let x = 0; x < 300; x += 10) d += "L" + (x + 5) + " 8L" + (x + 10) + " 0";
  return <svg className="tb-edge" viewBox="0 0 300 9" preserveAspectRatio="none" aria-hidden="true"><path d={d + "Z"} /></svg>;
}

function Line({ icon, label, value }) {
  return <li><span>{icon}{label}</span><i /><b>{value}</b></li>;
}

function useScrollBody(dep) {
  const ref = React.useRef(null);
  const toTop = React.useCallback(() => { const el = ref.current; if (el) el.scrollTop = 0; }, []);
  const toEnd = React.useCallback(() => {
    const el = ref.current; if (!el) return;
    const go = () => { const top = Math.max(0, el.scrollHeight - el.clientHeight); if (el.scrollTo && !reducedMotion()) el.scrollTo({ top, behavior: "smooth" }); else el.scrollTop = top; };
    requestAnimationFrame(go);
  }, []);
  React.useEffect(() => { toTop(); }, [dep, toTop]);
  return [ref, toEnd];
}

// inline — без портала (дымовой тест на сервере, встраивание); обычно — слой поверх приложения
function shell(children, vars, inline) {
  const el = <div className="tb" style={vars}>{children}</div>;
  return inline ? el : createPortal(el, document.body);
}
function roleVars(color, a11y) {
  const c = color || "#C8A96E";
  const ink = inkOf(c, a11y);
  return { "--role": c, "--role-ink": ink, "--role-edge": c + "88", "--role-fill": c, "--role-wash": c + "40" };
}

// ── Доп. 299: подсмотреть, послушать, автопереход, наставник ─────────
// Текст ситуации для озвучки
function sitSpeech(sit) {
  if (!sit) return "";
  const g = genreOf(sit);
  const parts = [];
  if (g === "truefalse") parts.push("Правда или миф: " + String(sit.statement || "").replace(/[«»]/g, ""));
  else if (g === "complete") parts.push("Собери правило: " + (sit.start || "") + " …");
  else {
    if (sit.guestThought) parts.push("Мысли гостя: " + sit.guestThought);
    if (sit.scene) parts.push(sit.scene);
    if (sit.question) parts.push(sit.question);
  }
  if (g !== "truefalse") (sit.options || []).forEach((o, i) => parts.push((i + 1) + ". " + String(o).replace(/[«»]/g, "")));
  return parts.join(". ").replace(/\.\s*\./g, ".");
}
function ListenBtn({ text }) {
  const can = typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
  const [on, setOn] = React.useState(false);
  React.useEffect(() => () => { try { if (can) stopSpeech(); } catch (e) {} }, [text, can]);
  if (!can) return null;
  // v32 (Доп. 336): «Послушать ситуацию» — через lib/speech («зависание» фразы)
  const toggle = () => {
    try {
      if (on) { stopSpeech(); setOn(false); audioSleep(); return; }
      audioWake();
      speakText(text, { rate: 0.97, cancelBefore: true, onend: () => { setOn(false); audioSleep(); }, onerror: () => { setOn(false); audioSleep(); } });
      setOn(true);
    } catch (e) { setOn(false); }
  };
  return <button type="button" className={"tb-tool" + (on ? " on" : "")} onClick={toggle} aria-label={on ? "Остановить чтение" : "Послушать ситуацию"} aria-pressed={on}><Ic n={on ? "stop" : "headphones"} s={17} /></button>;
}
function PeekBtn({ onClick, used }) {
  return <button type="button" className={"tb-tool" + (used ? " on" : "")} onClick={onClick} aria-label="Подсмотреть в уроке"><Ic n="book" s={17} /></button>;
}
function renderCardLines(lines) {
  return (lines || []).map((ln, i) => {
    const t = String(ln || "").trim();
    if (!t || /^\[mm:/.test(t) || /^[\p{Extended_Pictographic}\s️‍]+$/u.test(t)) return null;
    const clean = t.replace(/^[☑✅❌🚫📌🔴🟢🟡🟠🔵🌟🔹]️?\s*/u, "").replace(/^([1-9])️?⃣\s*/u, "$1. ");
    if (/^\*\*.*\*\*$/.test(clean)) return <p key={i} className="b">{clean.replace(/\*\*/g, "")}</p>;
    if (clean.startsWith("•")) return <p key={i} className="li">{clean.replace(/^•\s*/, "").replace(/\*\*/g, "")}</p>;
    return <p key={i}>{clean.replace(/\*\*/g, "")}</p>;
  });
}
function PeekSheet({ data, onClose }) {
  return (
    <div className="tb-scrim" onClick={onClose}>
      <div className="tb-sheet" role="dialog" aria-modal="true" aria-label="Подсмотреть в уроке" onClick={(e) => e.stopPropagation()}>
        {data && data.lesson ? (
          <div className="tb-peek">
            <div className="ey">Из урока · карточка {data.index + 1} из {data.total}</div>
            <h4>{data.lesson.title}</h4>
            {renderCardLines(data.lines)}
          </div>
        ) : <p>Подходящей карточки в уроках раздела не нашлось — ответь по опыту, разбор будет сразу после.</p>}
        <button type="button" className="tb-main" data-sa-back="" onClick={onClose}>Понятно, к ситуации</button>
      </div>
    </div>
  );
}
// Главная кнопка: при автопереходе по ней «бежит» заливка; нажатие — сразу дальше
function MainBtn({ label, onClick, auto }) {
  return (
    <button type="button" className="tb-main" onClick={onClick}>
      {auto ? <span className="auto" style={{ animationDuration: AUTO_MS + "ms" }} aria-hidden="true" /> : null}
      <span className="lbl">{label}</span>
    </button>
  );
}
// Вопрос для AI-наставника — с ситуацией и ответом человека
function askText(sit, chosenIdx) {
  if (!sit) return "";
  const g = genreOf(sit);
  const scene = g === "truefalse" ? "Утверждение: «" + String(sit.statement || "").replace(/^«|»$/g, "") + "»"
    : g === "complete" ? "Правило: «" + (sit.start || "") + " …»"
    : "Ситуация: «" + [sit.guestThought ? "мысли гостя — " + sit.guestThought : "", sit.scene || ""].filter(Boolean).join("; ") + "»" + (sit.question ? " Вопрос: " + sit.question : "");
  const lab = (i) => (g === "truefalse" ? tfLabel(sit.options[i]).t : String(sit.options[i] || ""));
  const mine = chosenIdx >= 0 ? "Я ответил(а): «" + lab(chosenIdx) + "»." : "Я не успел(а) ответить.";
  return "Разбери со мной ситуацию из практики. " + scene + " " + mine + " Правильно: «" + lab(sit.correct) + "». Объясни, почему так, и как это сказать или сделать с гостем своими словами.";
}
function MentorLink({ onAsk, sit, pick }) {
  if (!onAsk || !sit) return null;
  return <button type="button" className="tb-link" onClick={() => onAsk(askText(sit, pick))}><Ic n="mentor" s={15} />Разобрать с Наставником ›</button>;
}
const signOf = (name) => (name ? name + ", наставник" : "наставник");
function GoalLine({ goal }) {
  if (!goal || !goal.goal) return null;
  const st = Math.max(0, goal.steps || 0);
  return <Line icon={<Wine pct={Math.min(1, st / goal.goal)} s={19} a11y />} label="Цель дня" value={Math.min(st, goal.goal) + " / " + goal.goal + (st >= goal.goal ? " ✓" : "")} />;
}
// какие текстовые уроки смотреть для «Подсмотреть»: свой урок, раздел ситуации или раздел практики
function peekLessons(sit, { lesson, mod, modules }) {
  if (lesson && lesson.type === "lesson") return [lesson];
  const m = (sit && sit._mod && (modules || []).find((x) => x.id === sit._mod)) || mod;
  return (m && m.lessons) || [];
}

// v40: проба из редактора контента (TablePractice preview) — те же экраны, что у сотрудника, но без
// обещаний записи: выход не «ждёт 12 часов», в чеке нет серии, цели дня и «Работы над ошибками» —
// вместо них PREVIEW_NOTE; нет «Разобрать с Наставником», «вслух» с микрофоном (запрос к серверу)
// и переключателя на классический вид; «Продолжить» закрывает пробу (onBack), а не засчитывает практику
export const PREVIEW_NOTE = "Проба — результат не записывается";
export function practiceExitText(preview = false) {
  return preview
    ? { title: "Выйти из пробы?", text: "Ничего не сохраняется." }
    : { title: "Выйти из практики?", text: "Раунд подождёт: вернёшься в течение 12 часов — продолжишь с этой же ситуации." };
}

// ════════════════════════════════════════════════════════════════════
// ПРАКТИКА «у стола» — на том же состоянии, что классическая практика
// ════════════════════════════════════════════════════════════════════
export function TablePractice({ lesson, mod, color, a11y, practiceState: ps, setPracticeState, onPracticeChoice, onPracticeNext, onBack, onComplete, onClassic, streak, profile,
  replay = false, mentorName = "", goal = null, onAskMentor, inline = false, preview = false }) {
  const situations = ps.situations && ps.situations.length ? ps.situations : (lesson.situations || []).slice(0, 6);
  const n = situations.length;
  const step = Math.min(ps.step, Math.max(0, n - 1));
  const sit = situations[step];
  const answered = ps.isAnswered === true;
  const ok = answered && sit && ps.choice === sit.correct;
  const g = genreOf(sit);
  const [sheet, setSheet] = React.useState(false);
  const [peek, setPeek] = React.useState(null);
  const [peeks, setPeeks] = React.useState(0);
  const [peekedStep, setPeekedStep] = React.useState(-1);
  const [bodyRef, toEnd] = useScrollBody(ps.done ? "done" : step);
  const timerRef = React.useRef(null);
  const [tRun, setTRun] = React.useState(0);
  const [autoOn, setAutoOn] = React.useState(false);
  const autoRef = React.useRef(null);
  const sayPhrase = sit ? (sit.say || ((g === "action" || g === "empathy" || g === "timer") && sit.options && /^[«"“]/.test(String(sit.options[sit.correct]).trim()) ? unquote(sit.options[sit.correct]) : null)) : null;
  const last = step + 1 >= n || (answered && !ok && ps.lives <= 0);

  // Быстрый выбор: 12 секунд, потом «время вышло» — как TimerBar в классике.
  // Пока открыт вопрос «Выйти?» или шпаргалка, время стоит; потом отсчёт заново.
  React.useEffect(() => {
    if (ps.done || answered || !sit || g !== "timer" || sheet || peek) return undefined;
    setTRun((x) => x + 1);
    timerRef.current = setTimeout(() => { sfx("bad"); onPracticeChoice(-1); }, TIMER_S * 1000);
    return () => { clearTimeout(timerRef.current); timerRef.current = null; };
  }, [step, answered, ps.done, g, sheet, peek]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Промах в «Работу над ошибками» записывает App (handlePracticeChoice) — для обоих видов

  // Доп. 299: при повторной практике после верного ответа — дальше само (если не трогать экран)
  React.useEffect(() => {
    if (!replay || !answered || !ok || ps.done || sheet || peek || sayPhrase) { setAutoOn(false); return undefined; }
    setAutoOn(true);
    autoRef.current = setTimeout(() => { autoRef.current = null; setAutoOn(false); onPracticeNext(); }, AUTO_MS);
    return () => { if (autoRef.current) { clearTimeout(autoRef.current); autoRef.current = null; } };
  }, [replay, answered, ok, step, ps.done, sheet, peek, sayPhrase]);   // eslint-disable-line react-hooks/exhaustive-deps
  const cancelAuto = () => { if (autoRef.current) { clearTimeout(autoRef.current); autoRef.current = null; } if (autoOn) setAutoOn(false); };

  React.useEffect(() => { if (answered) toEnd(); }, [answered, toEnd]);
  React.useEffect(() => { if (ps.done) sfx("done"); }, [ps.done]);

  const pick = (i) => {
    if (answered || ps.done || !sit) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    sfx(i === sit.correct ? "ok" : "bad");
    onPracticeChoice(i);
  };
  const openPeek = () => {
    cancelAuto();
    if (!answered && peekedStep !== step) { setPeeks((x) => x + 1); setPeekedStep(step); }
    setPeek(peekFor(sit, peekLessons(sit, { mod })) || { empty: true });
  };
  const restart = () => { setPeeks(0); setPeekedStep(-1); setPracticeState(practiceRound(lesson.situations || [], ps.usedIds)); };
  const exit = () => { if (!ps.done && (step > 0 || answered)) setSheet(true); else onBack(); };
  const vars = roleVars(color, a11y);

  if (!sit) {
    return shell(
      <>
        <div className="tb-head"><div className="tb-col tb-top"><button type="button" className="tb-x" data-sa-back="" aria-label="Назад" onClick={onBack}><Ic n="x" s={18} /></button><div className="tb-host"><span className="tb-host-t"><b>{lesson.title}</b><span>практика</span></span></div></div></div>
        <div className="tb-body"><div className="tb-col"><p className="tb-hint">В этой практике пока нет ситуаций.</p></div></div>
      </>, vars, inline);
  }

  // ── итог раунда: чек ──
  if (ps.done) {
    const results = ps.results || [];
    const correct = results.filter(Boolean).length;
    const stars = ps.score >= 60 ? 3 : ps.score >= 30 ? 2 : 1;
    let run = 0, best = 0;
    results.forEach((r) => { run = r ? run + 1 : 0; best = Math.max(best, run); });
    const wrong = results.filter((r) => r === false).length;
    const st = streak || { count: 0, last: "" };   // серию App отмечает, когда раунд доигран
    const verdict = stars === 3 ? "Мастер сервиса!" : stars === 2 ? "Хороший результат!" : "Тренируйся ещё!";
    return shell(
      <>
        <div className="tb-head"><div className="tb-col tb-top">
          <button type="button" className="tb-x" data-sa-back="" aria-label="Назад" onClick={onBack}><Ic n="x" s={18} /></button>
          <div className="tb-host"><span className="tb-av" aria-hidden="true"><Ic n="tray" s={18} /></span><span className="tb-host-t"><b>Результат раунда</b><span>{lesson.title}</span></span></div>
          <SoundBtn />
        </div></div>
        <div className="tb-body" ref={bodyRef}><div className="tb-col">
          <div className="tb-res">
            <div className="tb-stars" role="img" aria-label={"Звёзды: " + stars + " из 3"}>
              {[1, 2, 3].map((s) => <span key={s} className={"s" + s + (s <= stars ? "" : " off")}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.4l-5.4 3 1.2-6.1-4.5-4.2 6.1-.7z" /></svg></span>)}
            </div>
            <div className="tb-rslot"><div className="tb-rslot-in">
              <div className="tb-receipt" role="group" aria-label={"Чек: " + (ps.lives > 0 ? "практика пройдена" : "раунд окончен")}>
                <div className="r-brand">✦ SERVICE ACADEMY ✦</div>
                <div className="r-place">{(profile && profile.restaurant) || "Service Academy"} · {stampNow()}</div>
                <div className="r-cut" />
                <h2 className="r-title">{ps.lives > 0 ? "Практика пройдена" : "Раунд окончен"}</h2>
                <div className="r-name">{lesson.title}</div>
                {preview ? <div className="r-meta">звёзды {stars} из 3</div> : <div className="r-meta">звёзды {stars} из 3 · в зачёт идёт лучший раунд</div>}
                <div className="r-cut" />
                <ul className="r-lines">
                  <Line label="Правильно" value={correct + "/" + n} />
                  <Line label="Лучшая серия ответов" value={best} />
                  <Line label="Тарелки" value={Math.max(0, ps.lives) + " из 3"} />
                  {peeks ? <Line label="Подсмотрено в уроке" value={peeks} /> : null}
                </ul>
                <div className="r-total"><span>ОЧКИ</span><b>{ps.score}</b></div>
                <div className="r-cut" />
                {preview ? (
                  <p className="r-note" data-preview=""><Ic n="eye" s={14} /><span>{PREVIEW_NOTE}</span></p>
                ) : (
                  <ul className="r-lines">
                    <Line icon={<Flame s={19} lit={st.last === ymd(new Date())} a11y />} label="Серия" value={(st.count || 0) + " " + plural(st.count || 0, "день", "дня", "дней")} />
                    <GoalLine goal={goal} />
                    {wrong ? <Line icon={<Ic n="refresh" s={15} />} label="В «Работу над ошибками»" value={wrong} /> : null}
                  </ul>
                )}
                <div className="r-thanks">{verdict}</div>
                <Edge />
              </div>
            </div></div>
            <div className="tb-recap">
              <h4>Разбор раунда</h4>
              <ul>
                {situations.map((s, i) => results[i] === undefined ? null : (
                  <li key={i} className={results[i] ? "" : "no"}>
                    <span style={{ flex: "0 0 auto", marginTop: 1, color: results[i] ? "var(--ok-ink)" : "var(--bad-ink)" }}><Ic n={results[i] ? "checkC" : "xC"} s={16} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="t" style={{ display: "block" }}>{s.scene || s.statement || s.start || s.question || ""}</span>
                      <span className="s" style={{ display: "block" }}>{stripEm(results[i] ? s.win : s.fail)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div></div>
        <div className="tb-foot"><div className="tb-col">
          <button type="button" className="tb-main" onClick={preview && onBack ? onBack : onComplete}>Продолжить</button>
          <button type="button" className="tb-ghost" onClick={restart}>Сыграть ещё раз</button>
        </div></div>
      </>, vars, inline);
  }

  // ── игра ──
  const marks = {};
  (ps.results || []).forEach((r, i) => { if (r === false) marks[i] = "bad"; });
  if (answered && !ok) marks[step] = "bad";
  const pts = ok ? (ps.combo >= 2 ? 20 : 10) : 0;
  const noteTitle = ps.choice === -1 ? "Время вышло" : ok ? OKW[hashOf(sitKey(sit)) % OKW.length] : "Не совсем";
  const exitTx = practiceExitText(preview);
  return shell(
    <>
      <div className="tb-head"><div className="tb-col">
        <div className="tb-top">
          <button type="button" className="tb-x" data-sa-back={sheet || peek ? undefined : ""} aria-label="Выйти из практики" onClick={exit}><Ic n="x" s={18} /></button>
          <div className="tb-host">
            <span className="tb-av" aria-hidden="true"><Ic n="tray" s={18} /></span>
            <span className="tb-host-t"><b>{lesson.title}</b><span>{n} {plural(n, "ситуация", "ситуации", "ситуаций")} у стола{replay ? " · повтор" : ""}</span></span>
          </div>
          <Plates lives={ps.lives} justBroke={answered && !ok} />
        </div>
        <div className="tb-row2">
          <div className="tb-prog" role="progressbar" aria-label="Ситуации раунда" aria-valuemin={0} aria-valuemax={n} aria-valuenow={step + (answered ? 1 : 0)}>
            <div className="tb-k"><b>Ситуация {step + 1} из {n}</b><span>{PLACE[g] || ""}</span></div>
            <Beads n={n} pos={step} marks={marks} curDone={answered} />
          </div>
          {ps.combo >= 2 ? <span className="tb-chip hot" aria-label={"Комбо: " + ps.combo + " подряд"}>×{ps.combo}</span> : null}
          <span className="tb-chip" aria-label={"Очки: " + ps.score}>★ {ps.score}</span>
        </div>
        <div className="tb-row2" style={{ justifyContent: "flex-end", marginTop: 6 }}>
          <ListenBtn text={sitSpeech(sit)} />
          <PeekBtn onClick={openPeek} used={peekedStep === step} />
          <SoundBtn />
          {onClassic && !preview ? <button type="button" className="tb-tool" onClick={onClassic} aria-label="Классический вид практики"><Ic n="list" s={17} /></button> : null}
        </div>
      </div></div>
      <div className="tb-body" ref={bodyRef} onPointerDown={cancelAuto} onWheel={cancelAuto}><div className="tb-col" key={"s" + step}>
        <Situation sit={sit} asking={!answered} pick={ps.choice} timer={g === "timer" && !answered ? TIMER_S : 0} timerKey={tRun} timerPaused={sheet || !!peek} onPick={pick}>
          {answered ? (
            <>
              {CHOICE[g] ? (
                <div className="tb-chat">
                  {ps.choice === -1
                    ? <div className="tb-actl tb-new">Ты не успел решить — время вышло</div>
                    : <div className={"tb-mine tb-new " + (ok ? "good" : "bad")}>{sit.options[ps.choice]}</div>}
                </div>
              ) : null}
              <Note ok={ok} title={noteTitle} sign={signOf(mentorName)}>
                {!ok ? <><span className="na">{g === "truefalse" ? "Ответ" : "Лучше так"}</span><p className="nb">{g === "truefalse" ? tfLabel(sit.options[sit.correct]).t : sit.options[sit.correct]}</p></> : null}
                <p>{stripEm(ok ? sit.win : (missText(sit, ps.choice >= 0 ? sit.options[ps.choice] : "") || "Попробуй ещё раз в следующем раунде!"))}</p>
                <p className="pts">{ok ? "+" + pts + " очков" + (ps.combo >= 2 ? " · комбо ×" + ps.combo : "") : "−1 тарелка · осталось " + Math.max(0, ps.lives)}</p>
                {!ok && !preview ? <MentorLink onAsk={onAskMentor} sit={sit} pick={ps.choice} /> : null}
              </Note>
              {!ok && ps.lives <= 0 ? <p className="tb-hint">Три тарелки разбиты — раунд окончен. Следующий раунд перемешает ситуации.</p> : null}
              {sayPhrase && !preview ? <SayAloud phrase={unquote(sayPhrase)} a11y={a11y} /> : null}
            </>
          ) : null}
        </Situation>
      </div></div>
      <div className="tb-foot">{answered ? (
        <div className="tb-col">
          <MainBtn label={last ? "К итогам" : "Дальше"} onClick={() => { cancelAuto(); onPracticeNext(); }} auto={autoOn} />
          {autoOn ? <p className="tb-autohint">Повтор: дальше само — коснись экрана, чтобы задержаться</p> : null}
        </div>
      ) : null}</div>
      {peek ? <PeekSheet data={peek.empty ? null : peek} onClose={() => setPeek(null)} /> : null}
      {sheet ? <ExitSheet title={exitTx.title} text={exitTx.text} onStay={() => setSheet(false)} onLeave={() => { setSheet(false); onBack(); }} /> : null}
    </>, vars, inline);
}

// ════════════════════════════════════════════════════════════════════
// «ЗАКРЕПИТЬ У СТОЛА» после текстового урока · «РАЗМИНКА ДО СМЕНЫ»
// ════════════════════════════════════════════════════════════════════
const RUNS_KEY = "sa_tb_runs";
const readRuns = () => { try { return JSON.parse(localStorage.getItem(RUNS_KEY) || "{}") || {}; } catch (e) { return {}; } };
const bumpRun = (id) => { try { const r = readRuns(); r[id] = (r[id] || 0) + 1; localStorage.setItem(RUNS_KEY, JSON.stringify(r)); } catch (e) {} };
const REACT_OK = ["Гость кивает", "За столом довольны", "Гость улыбается", "Гость благодарит взглядом"];
const REACT_BAD = ["Гость хмурится", "За столом повисла пауза", "Гость переглядывается со спутником", "Гость вздыхает"];
const REVIEWS_HI = ["Обслужили как в хорошем ресторане — вернёмся.", "Всё чётко и по-человечески. Спасибо!", "Видно, что здесь знают своё дело.", "Было спокойно и внимательно — то, что нужно."];
// v42 (Доп. 355): гость по сценарию у входа и у менеджера — свои слова: хостес гостя не рассчитывает
const REVIEWS_PLACE = {
  door: ["Встретили тепло и быстро нашли нам стол — приятно.", "Сразу почувствовали, что нам здесь рады. Спасибо!", "Всё объяснили честно и без суеты — вернёмся."],
  manager: ["Разобрались спокойно и по-человечески. Спасибо!", "Вопрос решили быстро и без споров — вернёмся.", "Видно, что здесь умеют признавать ошибки."],
};
const GUEST_MODE_PLACE = {
  door: { done: "Встреча окончена", exitT: "Гость уйдёт без помощи — можно встретить нового." },
  manager: { done: "Разговор окончен", exitT: "Гость останется без решения — можно встретить нового." },
};
const SR_DAYS = [1, 3, 7, 30];   // как в App: 1 → 3 → 7 → 30 дней

export function checkSituations(lesson, mod) {
  const runs = readRuns();
  return pickForLesson(lesson, tablePool(mod), 2, runs[lesson && lesson.id] || 0);   // Доп. 310: без практики — вопросы тестов
}

// Доп. 293: один вопрос из «Работы над ошибками», у которого подошёл срок, —
// сначала по этому разделу, потом самый давний. Повтор без отдельного похода.
export function dueMistake(bank, mod, now = Date.now()) {
  const due = (bank || []).filter((m) => m && m.q && Array.isArray(m.options) && m.options.length > 1 && typeof m.correct === "number" && (!m.due || m.due <= now));
  if (!due.length) return null;
  const ids = new Set(((mod && mod.lessons) || []).map((l) => l.id));
  const mine = due.filter((m) => ids.has(m.lessonId));
  const pool = mine.length ? mine : due;
  return pool.slice().sort((a, b) => (a.due || 0) - (b.due || 0))[0];
}

// v30: режимы того же «стола» — refresh (освежить тему, Доп. 313), credit (зачёт на опыт, Доп. 315),
// gold (раунд мастера, Доп. 316), guest («Живой гость» по сценарию, когда ИИ не подключён, Доп. 312).
// В зачёте и раунде мастера — без подсказок и второго шанса; в раунде мастера — время на каждое задание.
const MODE = {
  refresh: { title: "Освежить тему", icon: "refresh", done: "Тема освежена", exitQ: "Выйти?", exitT: "Тема останется как была — освежить можно в любой момент." },
  credit: { title: "Зачёт на опыт", icon: "check", done: "Зачёт", exitQ: "Выйти из зачёта?", exitT: "Попытка на сегодня будет потрачена: зачёт по теме — раз в день." },
  gold: { title: "Раунд мастера", icon: "star", done: "Раунд мастера", exitQ: "Выйти из раунда?", exitT: "Раунд можно начать заново в любой момент." },
  guest: { title: "Живой гость", icon: "guest", done: "Гость рассчитался", exitQ: "Оставить гостя?", exitT: "Гость уйдёт без расчёта — можно встретить нового." },
  // v31: «Освежить всё выдохшееся» (2–3 темы за один заход) и «Проверка по треку» для опытных
  freshall: { title: "Освежить всё", icon: "refresh", done: "Темы освежены", exitQ: "Выйти?", exitT: "Темы останутся как были — освежить можно в любой момент." },
  probe: { title: "Проверка по треку", icon: "check", done: "Проверка", exitQ: "Выйти из проверки?", exitT: "Проверку можно пройти в любой момент — ничего не теряется." },
};
const fmtSec = (x) => Math.floor(x / 60) + ":" + String(Math.round(x) % 60).padStart(2, "0");
export function TableCheck({ mode = "check", lesson = null, mod = null, situations = null, modules = null, shift = "",
  color, a11y, profile, streak, next, mistakeBank, mentorName = "", replay = false, goal = null, timer = 0, guest = null, verdict = null,
  intro = null, record = null, extra = null, onBegin = null,
  onComplete, onNext, onClose, onMistakes, onResolveMistake, onFailMistake, onFinish, onActivity, onAskMentor, onAgain, inline = false }) {
  // v31: intro — правила перед стартом (зачёт, раунд мастера, проверка по треку); onBegin — с первого
  // ответа (попытка зачёта тратится только тогда); record — рекорды раунда мастера; extra(stat) —
  // свой блок в чеке (какие темы освежены, какие можно сдать на опыт)
  const [started, setStarted] = React.useState(!intro);
  const begunRef = React.useRef(false);
  const warm = mode === "warmup";
  const M = mode === "guest" && guest && GUEST_MODE_PLACE[guest.place] ? { ...MODE.guest, ...GUEST_MODE_PLACE[guest.place] } : MODE[mode] || null;
  const listMode = warm || !!M;                      // задания приходят готовым списком
  const strict = mode === "credit" || mode === "gold" || mode === "probe";
  const keyId = listMode ? mode + ":" + ((mod && mod.id) || "") : (lesson && lesson.id) || "";
  const steps = React.useMemo(() => {
    const bankItem = strict || mode === "guest" ? null : dueMistake(mistakeBank, warm ? null : mod);
    const cap = warm || mode === "refresh" ? 3 : (situations || []).length;
    const base = listMode ? (situations || []).slice(0, bankItem ? Math.max(1, cap - 1) : cap) : checkSituations(lesson, mod);
    const out = base.map((s) => ({ kind: "sit", sit: shuffleSituationOptions(s) }));
    if (out.length && bankItem) out.push({ kind: "bank", orig: bankItem, q: shuffleQuizOptions(bankItem) });
    return out;
  }, [keyId]);   // eslint-disable-line react-hooks/exhaustive-deps
  const n = steps.length;
  const [pos, setPos] = React.useState(0);
  const [c, setC] = React.useState({ phase: "ask", pick: null, ok: null, tries: 0, removed: [], typing: false, react: null });
  const [mood, setMood] = React.useState(3);
  const [fx, setFx] = React.useState("");
  const [marks, setMarks] = React.useState({});
  const [stat, setStat] = React.useState({ firstOk: 0, hinted: 0, rescued: 0, wrong: [], bank: null, okMods: [] });
  const [result, setResult] = React.useState(false);
  const [sheet, setSheet] = React.useState(false);
  const [peek, setPeek] = React.useState(null);
  const [peekedPos, setPeekedPos] = React.useState(-1);
  const [autoOn, setAutoOn] = React.useState(false);
  const autoRef = React.useRef(null);
  const t0 = React.useRef(Date.now());
  const gen = React.useRef(0);
  const timerRef = React.useRef(null);
  const completedRef = React.useRef(false);
  const [bodyRef, toEnd] = useScrollBody(result ? "r" : pos + ":" + c.tries);
  const stp = steps[pos] || null;
  const isBank = !!stp && stp.kind === "bank";
  const sit = stp && stp.kind === "sit" ? stp.sit : null;
  const g = sit ? genreOf(sit) : "bank";
  const atTable = !!CHOICE[g];
  const sitCount = steps.filter((x) => x.kind === "sit").length;
  const sayPhrase = sit && atTable && sit.options && /^[«"“]/.test(String(sit.options[sit.correct]).trim()) ? unquote(sit.options[sit.correct]) : null;

  React.useEffect(() => () => { gen.current++; if (timerRef.current) clearTimeout(timerRef.current); if (autoRef.current) clearTimeout(autoRef.current); }, []);

  const settle = React.useCallback((i) => {
    if (!stp || c.phase !== "ask") return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const right = isBank ? stp.q.correct : sit.correct;
    const good = i === right;
    const first = c.tries === 0;
    const hinted = peekedPos === pos;
    const my = ++gen.current;
    if (!begunRef.current) { begunRef.current = true; try { onBegin && onBegin(); } catch (e) {} }
    sfx(good ? "ok" : "bad");
    vibrate(good ? "light" : "error");
    try { if (first && onActivity) onActivity("sit"); } catch (e) {}
    if (isBank) {
      // повтор ошибки: верно — следующий интервал, неверно — прогресс сгорает (как в «Работе над ошибками»)
      try { if (good) { onResolveMistake && onResolveMistake(stp.orig.q); } else { onFailMistake && onFailMistake(stp.orig.q); } } catch (e) {}
      setStat((s) => ({ ...s, bank: good ? "ok" : "bad" }));
      if (!good) setMarks((m) => ({ ...m, [pos]: "bad" }));
    } else if (first) {
      if (good && !hinted) setStat((s) => ({ ...s, firstOk: s.firstOk + 1, okMods: sit && sit._mod ? [...s.okMods, sit._mod] : s.okMods }));
      else if (good) setStat((s) => ({ ...s, hinted: s.hinted + 1 }));
      else { setStat((s) => ({ ...s, wrong: [...s.wrong, sit] })); setMarks((m) => ({ ...m, [pos]: "bad" })); }
    } else if (good) setStat((s) => ({ ...s, rescued: s.rescued + 1 }));
    const fast = reducedMotion();
    const line = atTable ? (i < 0 ? "Гость так и не дождался" : (good ? REACT_OK : REACT_BAD)[(hashOf(sitKey(sit)) + pos) % 4]) : null;
    setC((x) => ({ ...x, phase: "wait", pick: i, ok: good, typing: !!line && !fast }));
    const applyMood = () => {
      if (!atTable) return;
      setMood((m) => { const v = Math.max(1, Math.min(5, m + (good ? 1 : -1))); if (v !== m) setFx(good ? "up" : "down"); return v; });
    };
    setTimeout(() => {
      if (gen.current !== my) return;
      setC((x) => ({ ...x, typing: false, react: line }));
      applyMood();
      setTimeout(() => { if (gen.current !== my) return; setC((x) => ({ ...x, phase: "done" })); }, fast ? 0 : 420);
    }, fast ? 0 : (line ? 650 : 200));
  }, [stp, sit, isBank, c.phase, c.tries, pos, atTable, peekedPos, onResolveMistake, onFailMistake, onActivity, onBegin]);

  // таймер «быстрого решения»: стоит, пока открыт вопрос «Выйти?» или шпаргалка; в раунде мастера — на каждом задании
  const tSecs = sit ? (timer > 0 ? timer : g === "timer" ? TIMER_S : 0) : 0;
  const [tRun, setTRun] = React.useState(0);
  React.useEffect(() => {
    if (!started || result || !sit || !tSecs || c.phase !== "ask" || sheet || peek) return undefined;
    setTRun((x) => x + 1);
    timerRef.current = setTimeout(() => settle(-1), tSecs * 1000);
    // v31: последние 5 секунд раунда мастера — тихий тик и лёгкая вибрация
    const ticks = timer > 0 && tSecs > 6 ? [5, 4, 3, 2, 1].map((k) => setTimeout(() => { sfx("tick"); vibrate("light"); }, (tSecs - k) * 1000)) : [];
    return () => { ticks.forEach(clearTimeout); if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  }, [pos, c.tries, c.phase, result, sheet, peek, started]);   // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { if (c.phase !== "ask") toEnd(); }, [c.phase, c.react, toEnd]);

  const canRescue = !strict && !!sit && atTable && c.phase === "done" && c.ok === false && c.tries === 0 && (sit.options.length - c.removed.length - (c.pick >= 0 ? 1 : 0)) >= 2;
  const rescue = () => { sfx("tap"); setC((x) => ({ phase: "ask", pick: null, ok: null, tries: x.tries + 1, removed: x.pick >= 0 ? [...x.removed, x.pick] : x.removed, typing: false, react: null })); };
  const finish = () => {
    setResult(true);
    sfx("done");
    if (!completedRef.current) {
      completedRef.current = true;
      if (!listMode && lesson) bumpRun(lesson.id);
      const items = stat.wrong.map((s) => mistakeFromSituation(s, listMode ? { id: s._from || "", title: s._fromTitle || (M ? M.title : "Разминка до смены") } : lesson)).filter(Boolean);
      if (items.length && onMistakes) onMistakes(items);
      if (listMode) { try { onFinish && onFinish({ firstOk: stat.firstOk, total: sitCount, wrongN: stat.wrong.length, secs: Math.max(1, Math.round((Date.now() - t0.current) / 1000)), okMods: stat.okMods, mood }); } catch (e) {} }
      else { try { onComplete && onComplete(); } catch (e) {} }
    }
  };
  const go = () => {
    if (autoRef.current) { clearTimeout(autoRef.current); autoRef.current = null; }
    setAutoOn(false);
    if (pos + 1 >= n) { finish(); return; }
    gen.current++;
    setPos(pos + 1);
    setC({ phase: "ask", pick: null, ok: null, tries: 0, removed: [], typing: false, react: null });
  };
  // Доп. 299: разминка и повторная проверка — после верного ответа с первого раза дальше само
  // (v30: и «освежить тему», и раунд мастера — темп; зачёт и гость — без спешки)
  React.useEffect(() => {
    const autoMode = warm || replay || mode === "refresh" || mode === "gold";
    if (!autoMode || result || c.phase !== "done" || !c.ok || c.tries > 0 || sheet || peek || sayPhrase) { setAutoOn(false); return undefined; }
    setAutoOn(true);
    autoRef.current = setTimeout(() => { autoRef.current = null; go(); }, AUTO_MS);
    return () => { if (autoRef.current) { clearTimeout(autoRef.current); autoRef.current = null; } };
  }, [c.phase, c.ok, pos, result, sheet, peek]);   // eslint-disable-line react-hooks/exhaustive-deps
  const cancelAuto = () => { if (autoRef.current) { clearTimeout(autoRef.current); autoRef.current = null; } if (autoOn) setAutoOn(false); };
  const openPeek = () => {
    cancelAuto();
    if (!sit || strict) return;
    if (c.phase === "ask") setPeekedPos(pos);
    setPeek(peekFor(sit, peekLessons(sit, { lesson: warm ? null : lesson, mod, modules })) || { empty: true });
  };
  const exit = () => { if (result) { onClose(); return; } if (pos > 0 || c.phase !== "ask") setSheet(true); else onClose(); };
  const vars = roleVars(color, a11y);
  const sign = signOf(mentorName);

  if (!n) return null;

  // ── v30: итог освежения, зачёта, раунда мастера и гостя по сценарию ──
  if (result && M) {
    const secs = Math.max(1, Math.round((Date.now() - t0.current) / 1000));
    const ok = stat.firstOk, total = sitCount, wrongN = stat.wrong.length;
    const passed = mode === "credit" ? creditPassed(ok, total) : mode === "gold" ? goldPassed(ok, total) : mode === "refresh" ? ok >= Math.min(2, total)
      : mode === "freshall" ? ok >= Math.ceil(total / 2) : true;
    const bankStep = steps.find((x) => x.kind === "bank");
    const stage = stat.bank === "ok" && bankStep ? ((bankStep.orig.stage || 0) + 1) : 0;
    const bankLine = stat.bank === "ok" ? (stage > SR_DAYS.length ? "закреплён ✓" : "через " + SR_DAYS[stage - 1] + " " + plural(SR_DAYS[stage - 1], "день", "дня", "дней")) : stat.bank === "bad" ? "ещё раз" : null;
    const title = mode === "credit" ? (passed ? "Зачёт сдан" : "Не в этот раз")
      : mode === "gold" ? (passed ? "Золотая тема" : "Почти золото")
      : mode === "refresh" ? (passed ? "Тема освежена" : "Освежим ещё раз")
      : mode === "freshall" ? (passed ? "Темы освежены" : "Освежим ещё раз")
      : mode === "probe" ? "Твой уровень" : M.done;
    const name = mode === "guest" ? ((guest && guest.name) || "Гость") + (guest && guest.table ? " · стол " + guest.table : "")
      : mode === "freshall" || mode === "probe" ? (verdict && verdict.name) || "" : (mod && mod.title) || "";
    const sitsUsed = steps.filter((x) => x.kind === "sit").map((x) => x.sit);
    const pb = mode === "gold" && record && record.mine && record.mine.sec ? record.mine : null;
    const best = mode === "gold" && record && record.best && record.best.sec ? record.best : null;
    const note = verdict && (passed ? verdict.ok : verdict.bad);
    const revs = (guest && REVIEWS_PLACE[guest.place]) || REVIEWS_HI;
    const review = mode === "guest" && mood >= 4 ? revs[hashOf(name) % revs.length] : null;
    return shell(
      <>
        <div className="tb-head"><div className="tb-col tb-top">
          <button type="button" className="tb-x" data-sa-back="" aria-label="Закрыть" onClick={onClose}><Ic n="x" s={18} /></button>
          <div className="tb-host"><span className="tb-av" aria-hidden="true"><Ic n={M.icon} s={18} /></span><span className="tb-host-t"><b>{M.title}</b><span>{name}</span></span></div>
          <MoodFace m={mood} hall />
        </div></div>
        <div className="tb-body" ref={bodyRef}><div className="tb-col">
          <div className="tb-res">
            <div className="tb-rslot"><div className="tb-rslot-in">
              <div className={"tb-receipt" + (mode === "gold" && passed ? " gold" : "")} role="group" aria-label={"Чек: " + title}>
                <div className="r-brand">✦ SERVICE ACADEMY ✦</div>
                <div className="r-place">{(profile && profile.restaurant) || "Service Academy"} · {stampNow()}</div>
                <div className="r-cut" />
                <h2 className="r-title">{title}</h2>
                <div className="r-name">{name}</div>
                <div className="r-meta">время {Math.floor(secs / 60)}:{pad2(secs % 60)}{mode === "guest" ? " · гость " + MOOD_WORD[mood] : ""}</div>
                <div className="r-cut" />
                <ul className="r-lines">
                  <Line label={mode === "guest" ? "Решений с первого раза" : "Верно с первого раза"} value={ok + " из " + total} />
                  {mode === "credit" ? <Line label="Нужно для зачёта" value={Math.ceil(total * CREDIT_PASS / CREDIT_N) + " из " + total} /> : null}
                  {mode === "gold" ? <Line label="Ошибок" value={wrongN + (wrongN <= GOLD_MAX_WRONG ? " ✓" : " — можно не больше " + GOLD_MAX_WRONG)} /> : null}
                  {mode === "gold" && passed && pb ? <Line label="Твой рекорд" value={fmtSec(Math.min(pb.sec, secs)) + (secs < pb.sec ? " — новый ✦" : "")} /> : null}
                  {best ? <Line label="Рекорд заведения" value={fmtSec(best.sec) + " · " + (best.me ? "твой" : best.name + (best.initial ? " " + best.initial + "." : ""))} /> : null}
                  {stat.hinted ? <Line label="С подсказкой из урока" value={stat.hinted} /> : null}
                  {stat.rescued ? <Line label="Спасено ситуаций" value={stat.rescued} /> : null}
                  {bankLine ? <Line label="Повтор ошибки" value={bankLine} /> : null}
                  {wrongN ? <Line icon={<Ic n="refresh" s={15} />} label="В «Работу над ошибками»" value={wrongN} /> : null}
                  <GoalLine goal={goal} />
                </ul>
                {typeof extra === "function" ? extra({ okMods: stat.okMods, sits: sitsUsed, wrong: stat.wrong }) : null}
                {note ? <p className="r-note"><Ic n={passed ? "checkC" : "book"} s={14} /><span>{note}</span></p> : null}
                {review ? <><div className="r-review">«{review}»</div><div className="r-by">— {(guest && guest.name) || "гость"}{guest && guest.table ? ", стол " + guest.table : ""}</div></>
                  : <div className="r-thanks">{mode === "probe" ? "Учёба — с того, что ещё нужно" : passed ? (mode === "gold" ? "Мастер ✦" : "Так держать!") : "Ещё подход — и получится"}</div>}
                {mode === "gold" && passed ? <span className="r-goldseal" aria-hidden="true"><span>✦</span><small>ЗОЛОТО</small></span> : null}
                <Edge />
              </div>
            </div></div>
          </div>
        </div></div>
        <div className="tb-foot"><div className="tb-col">
          {!passed && onAgain && mode !== "credit" && mode !== "probe" ? (
            <>
              <button type="button" className="tb-main" onClick={onAgain}>Ещё раз</button>
              <button type="button" className="tb-ghost" onClick={onClose}>Закрыть</button>
            </>
          ) : (
            <button type="button" className="tb-main" onClick={onClose}>{passed && mode === "credit" ? "Тема засчитана ✓" : "Готово"}</button>
          )}
        </div></div>
      </>, vars, inline);
  }

  if (result) {
    const secs = Math.max(1, Math.round((Date.now() - t0.current) / 1000));
    const st = streak || { count: 0, last: "" };
    const today = ymd(new Date());
    const y = new Date(); y.setDate(y.getDate() - 1);
    const frozeYesterday = (st.frozen || []).indexOf(ymd(y)) >= 0 && st.last === today;
    const tm = new Date(); tm.setDate(tm.getDate() + 1);
    const offTomorrow = dayOffFromSchedule(profile, tm) === true;
    const review = !warm && mood >= 4 ? REVIEWS_HI[hashOf(keyId) % REVIEWS_HI.length] : null;
    const table = 2 + (hashOf(keyId) % 11);
    const wrongN = stat.wrong.length;
    const bankStep = steps.find((x) => x.kind === "bank");
    const stage = stat.bank === "ok" && bankStep ? ((bankStep.orig.stage || 0) + 1) : 0;
    const bankLine = stat.bank === "ok" ? (stage > SR_DAYS.length ? "закреплён ✓" : "через " + SR_DAYS[stage - 1] + " " + plural(SR_DAYS[stage - 1], "день", "дня", "дней")) : stat.bank === "bad" ? "ещё раз" : null;
    const nextTitle = next && next.lesson && next.lesson.title ? (next.lesson.title.length > 26 ? next.lesson.title.slice(0, 25) + "…" : next.lesson.title) : "";
    return shell(
      <>
        <div className="tb-head"><div className="tb-col tb-top">
          <button type="button" className="tb-x" data-sa-back="" aria-label={warm ? "Закрыть" : "Вернуться к уроку"} onClick={onClose}><Ic n="x" s={18} /></button>
          <div className="tb-host"><span className="tb-av" aria-hidden="true"><Ic n={warm ? "clock" : "guest"} s={18} /></span><span className="tb-host-t"><b>{warm ? "Разминка" : "У стола"}</b><span>{warm ? (shift ? "смена · " + shift : "перед сменой") : lesson.title}</span></span></div>
          <MoodFace m={mood} hall />
        </div></div>
        <div className="tb-body" ref={bodyRef}><div className="tb-col">
          <div className="tb-res">
            <div className="tb-rslot"><div className="tb-rslot-in">
              <div className="tb-receipt" role="group" aria-label={warm ? "Чек: разминка готова" : "Чек: урок пройден"}>
                <div className="r-brand">✦ SERVICE ACADEMY ✦</div>
                <div className="r-place">{(profile && profile.restaurant) || "Service Academy"} · {stampNow()}</div>
                <div className="r-cut" />
                <h2 className="r-title">{warm ? "Разминка готова" : "Урок пройден"}</h2>
                <div className="r-name">{warm ? (shift ? "смена · " + shift : "перед сменой") : lesson.title}</div>
                <div className="r-meta">время {Math.floor(secs / 60)}:{pad2(secs % 60)} · зал {MOOD_WORD[mood]}</div>
                <div className="r-cut" />
                <ul className="r-lines">
                  {!warm ? <Line label="Урок" value="прочитан" /> : null}
                  <Line label={warm ? "Ситуации с первого раза" : "У стола с первого раза"} value={stat.firstOk + " из " + sitCount} />
                  {stat.hinted ? <Line label="С подсказкой из урока" value={stat.hinted} /> : null}
                  {stat.rescued ? <Line label="Спасено ситуаций" value={stat.rescued} /> : null}
                  {bankLine ? <Line label="Повтор ошибки" value={bankLine} /> : null}
                </ul>
                <div className="r-cut" />
                <ul className="r-lines">
                  <Line icon={<Flame s={19} lit={st.last === today} a11y />} label="Серия" value={(st.count || 0) + " " + plural(st.count || 0, "день", "дня", "дней")} />
                  <GoalLine goal={goal} />
                  {wrongN ? <Line icon={<Ic n="refresh" s={15} />} label="В «Работу над ошибками»" value={wrongN} /> : null}
                </ul>
                {frozeYesterday ? <p className="r-note"><Ic n="snow" s={14} /><span>Вчера был выходной по графику — серия не сгорела.</span></p> : null}
                {offTomorrow ? <p className="r-note"><Ic n="snow" s={14} /><span>Завтра выходной по графику — серия под защитой, можно отдыхать.</span></p> : null}
                {warm ? (
                  <div className="r-thanks">Хорошей смены!</div>
                ) : review ? (
                  <><div className="r-review">«{review}»</div><div className="r-by">— гость, стол {table}</div></>
                ) : mood <= 2 ? (
                  <p className="r-note"><Ic n="guest" s={14} /><span>Гость ушёл без отзыва. Не страшно: ошибки уже ждут в «Работе над ошибками» — повтор закрепит.</span></p>
                ) : (
                  <div className="r-thanks">Так держать!</div>
                )}
                <Edge />
              </div>
            </div></div>
          </div>
        </div></div>
        <div className="tb-foot"><div className="tb-col">
          {warm ? (
            <button type="button" className="tb-main" onClick={onClose}>На смену!</button>
          ) : (
            <>
              <button type="button" className="tb-main" onClick={() => { onClose(); onNext && onNext(); }}>{nextTitle ? "Дальше: " + nextTitle : "Дальше"}</button>
              <button type="button" className="tb-ghost" onClick={onClose}>Вернуться к уроку</button>
            </>
          )}
        </div></div>
      </>, vars, inline);
  }

  const okTitle = isBank ? "Закреплено" : OKW[(hashOf(sitKey(sit)) + pos) % OKW.length];
  const noteTitle = c.pick === -1 ? "Время вышло" : c.ok ? (c.tries > 0 ? "Спасено" : (peekedPos === pos && !isBank ? "Верно, с подсказкой" : okTitle)) : "Не совсем";
  const place = isBank ? "повтор ошибки" : (PLACE[g] || "");
  let bankBody = null;
  if (isBank) {
    const q = stp.q;
    const fb = c.phase !== "ask";
    const st0 = (stp.orig.stage || 0) + 1;
    bankBody = (
      <>
        <div className="tb-scene-row"><span className="tb-where">{place}</span></div>
        <div className="tb-claim"><span className="na">Из «Работы над ошибками»{stp.orig.lessonTitle ? " · " + stp.orig.lessonTitle : ""}</span>
          {q.img ? <img src={q.img} alt="" loading="lazy" decoding="async" style={{ width: "100%", maxHeight: 190, objectFit: "cover", borderRadius: 12, display: "block", margin: "4px 0 10px" }} /> : null}
          <span style={{ fontStyle: "normal" }}>{q.q}</span></div>
        {!fb ? (
          <div className="tb-chips">{q.options.map((o, i) => <button type="button" key={i} className="tb-chip2" onClick={() => settle(i)}>{o}</button>)}</div>
        ) : (
          <>
            <div className="tb-chat"><div className={"tb-mine tb-new " + (c.ok ? "good" : "bad")}>{q.options[c.pick]}</div></div>
            {c.phase === "done" ? (
              <Note ok={!!c.ok} title={noteTitle} sign={sign}>
                {!c.ok ? <><span className="na">Правильно</span><p className="nb">{q.options[q.correct]}</p></> : null}
                {q.explanation ? <p>{q.explanation}</p> : null}
                <p className="pts">{c.ok ? (st0 > SR_DAYS.length ? "вопрос закреплён — больше не вернётся" : "следующий повтор через " + SR_DAYS[st0 - 1] + " " + plural(SR_DAYS[st0 - 1], "день", "дня", "дней")) : "вопрос остаётся на повторе"}</p>
              </Note>
            ) : null}
          </>
        )}
      </>
    );
  }
  // v31: правила перед стартом — зачёт, раунд мастера, проверка по треку
  if (!started && intro) {
    return shell(
      <>
        <div className="tb-head"><div className="tb-col tb-top">
          <button type="button" className="tb-x" data-sa-back="" aria-label="Закрыть" onClick={onClose}><Ic n="x" s={18} /></button>
          <div className="tb-host"><span className="tb-av" aria-hidden="true"><Ic n={M ? M.icon : "check"} s={18} /></span>
            <span className="tb-host-t"><b>{M ? M.title : "Перед стартом"}</b><span>{intro.sub || (mod && mod.title) || ""}</span></span></div>
          <SoundBtn />
        </div></div>
        <div className="tb-body"><div className="tb-col">
          <div className="tb-intro" role="group" aria-label="Правила">
            <div className="tb-intro-t">{intro.title || "Правила"}</div>
            <ul>{(intro.lines || []).map((x, i) => <li key={i}><span aria-hidden="true">{intro.icons && intro.icons[i] ? intro.icons[i] : "✦"}</span><span>{x}</span></li>)}</ul>
            {intro.note ? <p className="tb-intro-n">{intro.note}</p> : null}
          </div>
        </div></div>
        <div className="tb-foot"><div className="tb-col">
          <button type="button" className="tb-main" onClick={() => { sfx("tap"); vibrate("light"); t0.current = Date.now(); setStarted(true); }}>{intro.cta || "Начать"}</button>
          <button type="button" className="tb-ghost" onClick={onClose}>Не сейчас</button>
        </div></div>
      </>, vars, inline);
  }

  return shell(
    <>
      <div className="tb-head"><div className="tb-col">
        <div className="tb-top">
          <button type="button" className="tb-x" data-sa-back={sheet || peek ? undefined : ""} aria-label={M ? "Выйти: " + M.title : warm ? "Выйти из разминки" : "Выйти из проверки"} onClick={exit}><Ic n="x" s={18} /></button>
          <div className="tb-host">
            <span className="tb-av" aria-hidden="true"><Ic n={M ? M.icon : warm ? "clock" : "guest"} s={18} /></span>
            <span className="tb-host-t"><b>{M ? M.title : warm ? "Разминка до смены" : "У стола"}</b><span>{M
              ? (mode === "guest" ? ((guest && guest.line) || "гость за столом") : ((mod && mod.title) || "") + (mode === "credit" ? " · без подсказок" : mode === "gold" ? " · на время" : ""))
              : warm ? (shift ? "смена · " + shift : "2 минуты · " + n + " " + plural(n, "шаг", "шага", "шагов")) : "закрепляем: " + lesson.title}</span></span>
          </div>
          <MoodFace m={mood} fx={fx} hall />
        </div>
        <div className="tb-row2">
          <div className="tb-prog" role="progressbar" aria-label="Шаги" aria-valuemin={0} aria-valuemax={n} aria-valuenow={pos + (c.phase === "done" ? 1 : 0)}>
            <div className="tb-k"><b>{isBank ? "Напоследок" : (strict ? "Задание " : "Ситуация ") + (pos + 1) + " из " + sitCount}</b><span>{place}</span>
              {mode === "gold" ? <span className={"tb-spare" + (stat.wrong.length ? " out" : "")} role="img" aria-label={stat.wrong.length ? (stat.wrong.length > GOLD_MAX_WRONG ? "Ошибок больше одной — на золото не хватит" : "Запасная ошибка потрачена") : "Можно одну ошибку"}><Candle s={14} lit={!stat.wrong.length} /><small>{stat.wrong.length ? (stat.wrong.length > GOLD_MAX_WRONG ? "без золота" : "запас потрачен") : "запас"}</small></span> : null}
            </div>
            <Beads n={n} pos={pos} marks={marks} curDone={c.phase === "done"} />
          </div>
          {sit ? <ListenBtn text={sitSpeech(sit)} /> : null}
          {sit && !strict ? <PeekBtn onClick={openPeek} used={peekedPos === pos} /> : null}
          <SoundBtn />
        </div>
      </div></div>
      <div className="tb-body" ref={bodyRef} onPointerDown={cancelAuto} onWheel={cancelAuto}><div className="tb-col" key={"c" + pos}>
        {isBank ? bankBody : (
          <Situation sit={sit} asking={c.phase === "ask"} pick={c.pick} removed={c.removed} second={c.tries > 0} timer={tSecs && c.phase === "ask" ? tSecs : 0} timerKey={tRun} timerPaused={sheet || !!peek} onPick={settle}>
            {c.phase !== "ask" ? (
              <>
                <div className="tb-chat" aria-live="polite">
                  {CHOICE[g] ? (c.pick === -1
                    ? <div className="tb-actl tb-new">Ты не успел решить — время вышло</div>
                    : <div className={"tb-mine tb-new " + (c.ok ? "good" : "bad")}>{sit.options[c.pick]}</div>) : null}
                  {c.typing ? <div className="tb-typing tb-new" aria-label="Гость реагирует"><i /><i /><i /></div> : null}
                  {c.react ? <div className="tb-actl tb-new">{c.react}</div> : null}
                </div>
                {c.phase === "done" ? (
                  <Note ok={!!c.ok} title={noteTitle} sign={sign}>
                    {c.ok && c.tries > 0 ? <p>Исправил — и гость доволен даже больше: так работает парадокс восстановления.</p> : null}
                    {!c.ok ? <><span className="na">{g === "truefalse" ? "Ответ" : "Лучше так"}</span><p className="nb">{g === "truefalse" ? tfLabel(sit.options[sit.correct]).t : sit.options[sit.correct]}</p></> : null}
                    <p>{stripEm(c.ok ? sit.win : missText(sit, c.pick >= 0 ? sit.options[c.pick] : ""))}</p>
                    {!c.ok && !strict ? <MentorLink onAsk={onAskMentor} sit={sit} pick={c.pick} /> : null}
                  </Note>
                ) : null}
                {c.phase === "done" && c.ok && sayPhrase ? <SayAloud phrase={sayPhrase} a11y={a11y} /> : null}
              </>
            ) : null}
          </Situation>
        )}
      </div></div>
      <div className="tb-foot">{c.phase === "done" ? (
        <div className="tb-col">
          {canRescue ? (
            <>
              <button type="button" className="tb-main" onClick={rescue}>Спасти ситуацию</button>
              <button type="button" className="tb-ghost" onClick={go}>Дальше без этого</button>
            </>
          ) : (
            <>
              <MainBtn label={pos + 1 >= n ? "К итогам" : "Дальше"} onClick={go} auto={autoOn} />
              {autoOn ? <p className="tb-autohint">Дальше само — коснись экрана, чтобы задержаться</p> : null}
            </>
          )}
        </div>
      ) : null}</div>
      {peek ? <PeekSheet data={peek.empty ? null : peek} onClose={() => setPeek(null)} /> : null}
      {sheet ? <ExitSheet title={M ? M.exitQ : warm ? "Выйти из разминки?" : "Выйти из проверки?"} text={M ? M.exitT : warm ? "Разминку можно начать заново в любой момент до конца дня." : "Урок останется непройденным — отметить его можно кнопкой «Урок пройден ✓» в конце урока."} onStay={() => setSheet(false)} onLeave={() => { setSheet(false); onClose(); }} /> : null}
    </>, vars, inline);
}

// ════════════════════════════════════════════════════════════════════
// ЧЕК НЕДЕЛИ (Доп. 305): что сделано за 7 дней — свечи по дням, шаги,
// цель дня; «Отправить команде» — в Telegram (выбор чата), иначе системное
// «Поделиться» или копия текста.
// ════════════════════════════════════════════════════════════════════
const DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const dm = (key) => { const p = String(key || "").split("-"); return p.length === 3 ? p[2] + "." + p[1] : ""; };
export function WeekReceipt({ a11y, profile, streak, summary, goal = 2, prev = false, shareUrl = "", quests = [], onClose, inline = false }) {
  const [sent, setSent] = React.useState("");
  const sum = summary || { days: [], totals: {}, activeDays: 0, from: "", to: "" };
  const t = sum.totals || {};
  const st = streak || { count: 0, last: "" };
  const goalDays = (sum.days || []).filter((d) => d.steps >= goal).length;
  const questN = (quests || []).filter((d) => d >= (sum.from || "") && d <= (sum.to || "")).length;
  const name = profile ? [profile.name, profile.surname].filter(Boolean).join(" ") : "";
  const verdict = sum.activeDays >= 5 ? "Сильная неделя!" : sum.activeDays >= 3 ? "Хороший ритм" : sum.activeDays >= 1 ? "Начало положено" : "Неделя отдыха";
  const rows = [
    ["Уроки", t.l], ["Практики", t.p], ["Ситуации у стола", t.s], ["Разминки до смены", t.w],
    ["Тесты", t.q], ["Живые диалоги", t.d], ["Сборки", t.b], ["Тренажёры", t.m], ["Экзамены", t.x], ["Ошибок исправлено", t.f],
    // v30
    ["Живой гость", t.g], ["Радио в дорогу", t.r], ["Темы освежены", t.u], ["Золотые темы", t.o], ["Зачёты на опыт", t.k],
  ].filter((r) => r[1] > 0);
  const share = () => {
    sfx("tap");
    const text = weekShareText(sum, st, profile && profile.name);
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.initData && typeof tg.openTelegramLink === "function") {
        tg.openTelegramLink("https://t.me/share/url?url=" + encodeURIComponent(shareUrl || "") + "&text=" + encodeURIComponent(text));
        setSent("Выбери чат команды в Telegram");
        return;
      }
    } catch (e) {}
    const full = text + (shareUrl ? "\n" + shareUrl : "");
    const copy = () => {
      try {
        navigator.clipboard.writeText(full).then(() => setSent("Текст скопирован — вставь его в чат команды"), () => setSent("Не получилось скопировать — сделай снимок экрана чека"));
      } catch (e) { setSent("Не получилось скопировать — сделай снимок экрана чека"); }
    };
    try {
      // системное «Поделиться»; отказ (не отмена человеком) — копируем текст
      if (navigator.share) { navigator.share({ text: full }).then(() => setSent("Отправлено"), (e) => { if (!(e && e.name === "AbortError")) copy(); }); return; }
    } catch (e) {}
    copy();
  };
  return shell(
    <>
      <div className="tb-head"><div className="tb-col tb-top">
        <button type="button" className="tb-x" data-sa-back="" aria-label="Закрыть" onClick={onClose}><Ic n="x" s={18} /></button>
        <div className="tb-host"><span className="tb-av" aria-hidden="true"><Ic n="bill" s={18} /></span><span className="tb-host-t"><b>Чек недели</b><span>{prev ? "прошлая неделя" : "последние 7 дней"} · {dm(sum.from)}–{dm(sum.to)}</span></span></div>
        <SoundBtn />
      </div></div>
      <div className="tb-body"><div className="tb-col">
        <div className="tb-res">
          <div className="tb-rslot"><div className="tb-rslot-in">
            <div className="tb-receipt" role="group" aria-label="Чек недели">
              <div className="r-brand">✦ SERVICE ACADEMY ✦</div>
              <div className="r-place">{(profile && profile.restaurant) || "Service Academy"} · {dm(sum.from)}–{dm(sum.to)}</div>
              <div className="r-cut" />
              <h2 className="r-title">Чек недели</h2>
              {name ? <div className="r-name">{name}</div> : null}
              <div className="r-week" role="list" aria-label={"Дней в деле: " + sum.activeDays + " из 7"}>
                {(sum.days || []).map((d) => (
                  <span key={d.key} role="listitem" className={d.active ? "on" : d.frozen ? "fr" : undefined}
                    aria-label={DOW[d.dow] + ": " + (d.active ? "в деле" + (d.steps ? ", шагов " + d.steps : "") : d.frozen ? "выходной по графику" : "пропуск")}>
                    <small>{DOW[d.dow]}</small>
                    {d.active ? <Candle s={18} lit /> : d.frozen ? <Ic n="snow" s={16} /> : <i />}
                    <b>{d.steps || ""}</b>
                  </span>
                ))}
              </div>
              <div className="r-cut" />
              <ul className="r-lines">
                {rows.length ? rows.map((r) => <Line key={r[0]} label={r[0]} value={r[1]} />) : <Line label="Шагов за неделю" value="0" />}
              </ul>
              <div className="r-total"><span>ДНЕЙ В ДЕЛЕ</span><b>{sum.activeDays} / 7</b></div>
              <div className="r-cut" />
              <ul className="r-lines">
                <Line icon={<Flame s={19} lit={st.last === ymd(new Date())} a11y />} label="Серия" value={(st.count || 0) + " " + plural(st.count || 0, "день", "дня", "дней")} />
                <Line icon={<Wine s={19} pct={goalDays / 7} a11y />} label={"Цель дня (" + goal + " " + plural(goal, "шаг", "шага", "шагов") + ")"} value={goalDays + " из 7"} />
                {/* v30 (Доп. 314): дни, когда смена закрыла квест */}
                {questN ? <Line icon={<Ic n="team" s={16} />} label="Квест смены закрыт" value={questN + " " + plural(questN, "раз", "раза", "раз")} /> : null}
              </ul>
              {questN ? <div className="r-stamp" aria-hidden="true">✦ СМЕНА ОТРАБОТАНА ✦</div> : null}
              <div className="r-thanks">{verdict}</div>
              <Edge />
            </div>
          </div></div>
        </div>
      </div></div>
      <div className="tb-foot"><div className="tb-col">
        <button type="button" className="tb-main" onClick={share}><span className="lbl" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Ic n="share" s={17} />Отправить команде</span></button>
        {sent ? <p className="tb-autohint" role="status">{sent}</p> : null}
        <button type="button" className="tb-ghost" onClick={onClose}>Закрыть</button>
      </div></div>
    </>, roleVars("#C8A96E", a11y), inline);
}
