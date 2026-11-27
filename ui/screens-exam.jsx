// ui/screens-exam.jsx
// Экзамен роли и сертификаты.
// Вынесено из ui/screens.jsx БЕЗ изменения кода (barrel-разбиение);
// публичный API остался в ui/screens.jsx — App.jsx не менялся.

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import React from "react";
import { createPortal } from "react-dom";
import { useWide, useColumn } from "./viewport";   // v52 (Доп. 365): сертификаты — карточками в две колонки на широком экране
import { SUPABASE_URL, SUPABASE_KEY, rpc, saToken, rpcSync, flushQueue, supabase } from "../lib/supabase";
import { MODULES, programOf } from "../data/modules";
import { ROLES, RESTAURANTS } from "../data/roles";
import { GLOSSARY } from "../data/glossary";
import { DIALOGUES_DATA, MOOD_EMOJI_D, MOOD_COLORS_D, loadDialogues } from "../data/dialogues-lazy";
import { LOGO_SRC, LOGO_SRC_DARK } from "../assets/logo";
import { normSurname, shuffleArray, dedupeBestScores, pickRandom, shuffleSituationOptions, vibrate, onActivate, shuffleQuizOptions, encodeStartParam, decodeStartParam, cleanQuizQ } from "../lib/utils";   // v195: cleanQuizQ
import { MM, Mm, ROLE_SVG, UI_SVG, POS_SVG, MOD_SVG, MARKER_RE, GAME_SVG, NAV_ICONS } from "./icons";
import { S, A, ACCENT_SERIF } from "./styles";
import { referenceDailyTask } from "./reference-daily";
import { bookStats, countNewDishes } from "../data/reviews";
import { countUnreadPages } from "./guestbook-lite";
import { Confetti, TimerBar, SayAloud, LiquidSegment, useHintOnce, HintBubble } from "./widgets";
import { hintsFor } from "../data/hints";
import { crownIcon, flameIcon, trophyIcon, faceIcon } from "./icons-extra";
import { StreakCard, MoodCheckCard, TeamMoodCard, moodPalette } from "./mood-cards";
import { BROWN, BROWN_GOLD, CREAM, GOLD, GOLD_SOFT, GREEN, GREEN_DARK, INK, MUTED_2, RED, RED_DARK } from "./tokens";
import { WaxSeal } from "./now-hero";   // v162 (Доп. 487): сургучная печать на сертификате
import { certView, certImage, certShareText } from "../lib/cert-image";   // v162: слова сертификата и он же картинкой

const EXAM_PASS = 0.8;   // порог сдачи — 80%
const EXAM_COUNT = 10;   // вопросов в одной попытке (или меньше, если их мало)
const _CERT_ROLE_ORDER = ["spg", "bar", "seasonal", "core", "manager", "service_manager"];

// Собрать все вопросы квизов роли
function collectRoleQuestions(roleId) {
  if (!Array.isArray(MODULES[roleId])) return [];
  const mods = MODULES[roleId].filter((m) => m && !m.info);   // v144 (Доп. 465): самопроверка тем для ознакомления — не в экзамене
  const out = [];
  mods.forEach(m => {
    (m && Array.isArray(m.lessons) ? m.lessons : []).forEach(l => {
      if (l && l.type === "quiz" && Array.isArray(l.questions)) {
        l.questions.forEach(q => {
          const c = cleanQuizQ(q);   // v195 (Доп. 520): варианты без повторов, номер верного — числом
          if (c) out.push({ q: c.q, options: c.options, correct: c.correct, explanation: c.explanation || "" });
        });
      }
    });
  });
  return out;
}

export function ExamScreen({ T, a11y, roleObj, roleId, onFinish, onExit, extraQuestions = [] }) {
  const color = roleObj?.color || GOLD;
  // вопросы своих тестов роли — в том же наборе (правка 165); набор запоминается в App
  // v195 (Доп. 520): свои вопросы — тоже только целые: вопрос, разные варианты, верный (как штатные)
  const pool = useMemo(() => [...collectRoleQuestions(roleId), ...(extraQuestions || []).map(cleanQuizQ).filter(Boolean)
    .map((q) => ({ q: q.q, options: q.options, correct: q.correct, explanation: q.explanation || "" }))], [roleId, extraQuestions]);
  const draw = () => shuffleArray([...pool]).slice(0, Math.min(EXAM_COUNT, pool.length)).map(shuffleQuizOptions);
  // v195 (Доп. 520): набор вопросов попытки не меняется, пока она идёт. Раньше свои тесты, догрузившиеся после открытия
  // экзамена, пересобирали вопросы посреди попытки: на экране менялся вопрос под уже выбранным ответом, и верный ответ
  // мог подсветиться ошибкой. Новый набор — только до первого ответа и на пересдаче.
  const [questions, setQuestions] = React.useState(draw);
  const [step, setStep] = React.useState(0);
  const [picked, setPicked] = React.useState(null);
  const [correctCount, setCorrectCount] = React.useState(0);
  const [phase, setPhase] = React.useState("quiz");
  const poolRef = React.useRef(pool);
  React.useEffect(() => {
    if (poolRef.current === pool) return;
    poolRef.current = pool;
    if (phase === "quiz" && step === 0 && picked === null) setQuestions(draw());
  }, [pool]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!questions.length) {
    return (
      <div style={T.screen}>
        <div style={T.lessHead}>
          <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onExit}>‹</button>
          <div style={{ ...T.lessHeadTitle }}>Экзамен</div>
        </div>
        <div style={{ ...T.lessBody, padding:"40px 24px", textAlign:"center" }}>
          <div style={{ ...T.para, opacity:0.7 }}>Для этой роли пока нет вопросов для экзамена.</div>
        </div>
      </div>
    );
  }

  const total = questions.length;
  const cur = questions[step];
  const answered = picked !== null;
  const isLast = step >= total - 1;

  const choose = (i) => {
    if (answered) return;
    setPicked(i);
    vibrate(i === cur.correct ? "light" : "error");
    if (i === cur.correct) setCorrectCount(c => c + 1);
  };
  const next = () => {
    if (isLast) {
      const finalCorrect = correctCount;
      const passed = (finalCorrect / total) >= EXAM_PASS;
      const score = Math.round((finalCorrect / total) * 100);
      vibrate(passed ? "success" : "error"); // тактильный вердикт экзамена
      setPhase("done");
      onFinish && onFinish(roleId, { passed, score, correct: finalCorrect, total, date: new Date().toISOString() });
    } else {
      setStep(s => s + 1);
      setPicked(null);
    }
  };

  if (phase === "done") {
    const score = Math.round((correctCount / total) * 100);
    const passed = (correctCount / total) >= EXAM_PASS;
    return (
      <div style={T.screen}>
        <div style={{ ...T.lessBody, padding:"48px 24px", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
          <div style={{ display:"flex", color }}>{passed ? UI_SVG.gradcap(color, 56) : UI_SVG.book(a11y ? "#8B3020" : "#E07878", 52)}</div>
          <div style={{ color: passed ? color : (a11y ? "#8B3020" : "#E07878"), fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:25 }}>
            {passed ? "Экзамен сдан" : "Почти получилось"}
          </div>
          <div style={{ ...T.para, fontSize:18 }}>Результат: <b style={{ color }}>{score}%</b> ({correctCount} из {total})</div>
          <div style={{ ...T.para, opacity:0.7, fontSize:14, maxWidth:300 }}>
            {passed ? "Сертификат уже в твоём профиле." : `Нужно ${Math.round(EXAM_PASS*100)}% и выше. Повтори материал и попробуй ещё раз.`}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:320, marginTop:6 }}>
            {passed
              ? <button onClick={onExit} className="sa-btn" style={{ padding:"14px", borderRadius:14, border:"none", background:color, color:"#1A1008", fontWeight:"bold", fontFamily:"Georgia, serif", fontSize:14, cursor:"pointer" }}>К сертификату</button>
              : <>
                  <button onClick={() => { setQuestions(draw()); setStep(0); setPicked(null); setCorrectCount(0); setPhase("quiz"); }} className="sa-btn" style={{ padding:"14px", borderRadius:14, border:"none", background:color, color:"#1A1008", fontWeight:"bold", fontFamily:"Georgia, serif", fontSize:14, cursor:"pointer" }}>Пересдать</button>
                  <button onClick={onExit} style={{ padding:"12px", borderRadius:14, border:`1px solid ${color}55`, background:"transparent", color: T.para?.color || "#C8B898", fontFamily:"Georgia, serif", fontSize:14, cursor:"pointer" }}>Позже</button>
                </>
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={T.screen}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onExit}>‹</button>
        <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}><span>Экзамен · {roleObj?.label || ""}</span></div>
      </div>
      <div style={{ ...T.lessBody, padding:"14px 16px 40px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <div style={{ flex:1, height:6, borderRadius:3, background:"rgba(255,255,255,0.08)", overflow:"hidden" }}>
            <div style={{ width:`${(step/total)*100}%`, height:"100%", background:color, transition:"width 0.3s" }} />
          </div>
          <div style={{ ...T.para, fontSize:12.5, opacity:0.7, whiteSpace:"nowrap" }}>{step+1} / {total}</div>
        </div>
        <div key={step} className="sa-cardpage-r" style={{ ...T.modCard, padding:"16px", borderRadius:14, flexDirection:"column", alignItems:"flex-start", gap:12 }}>
          <div style={{ color: T.modTitle?.color || "#F0E8D8", fontFamily:"Georgia, serif", fontSize:16, lineHeight:1.5 }}>{cur.q}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, width:"100%" }}>
            {cur.options.map((opt, i) => {
              const isCorrect = i === cur.correct;
              const isPicked = i === picked;
              let bg = "rgba(255,255,255,0.04)", bd = `${color}22`, col = T.para?.color || "#D8CCB4";
              if (answered) {
                if (isCorrect) { bg = a11y ? "rgba(45,107,69,0.18)" : "rgba(93,187,138,0.16)"; bd = "#5DBB8A"; col = a11y ? "#2A6B45" : "#9EE0BE"; }
                else if (isPicked) { bg = a11y ? "rgba(139,48,32,0.15)" : "rgba(224,120,120,0.14)"; bd = "#E07878"; col = a11y ? "#8B3020" : "#F0B0B0"; }
              }
              return (
                <button key={i} onClick={() => choose(i)} disabled={answered}
                  style={{ textAlign:"left", padding:"12px 14px", borderRadius:12, border:`1px solid ${bd}`, background:bg, color:col,
                    fontSize:14, fontFamily:"Georgia, serif", lineHeight:1.45, cursor: answered ? "default" : "pointer", transition:"all 0.15s" }}>
                  {opt}
                </button>
              );
            })}
          </div>
          {answered && cur.explanation && (
            <div style={{ ...T.para, fontSize:12.5, opacity:0.85, lineHeight:1.55, borderLeft:`2px solid ${color}`, paddingLeft:12 }}>{cur.explanation}</div>
          )}
        </div>
        {answered && (
          <button onClick={next} className="sa-btn" style={{ width:"100%", marginTop:16, padding:"14px", borderRadius:14, border:"none", background:color, color:"#1A1008", fontWeight:"bold", fontFamily:"Georgia, serif", fontSize:14, cursor:"pointer" }}>
            {isLast ? "Завершить" : "Далее"}
          </button>
        )}
      </div>
    </div>
  );
}

// v162 (Доп. 487): сертификат — бумажный документ, как «Карта обучения» и страницы «Книги отзывов»: лист с двойной
// рамкой, имя крупно, сургучная печать с шапочкой, дата и срок действия. Лист один в обоих видах приложения — это
// документ. Раньше карточка на телефоне была шире экрана (width:100% + поля и рамка без border-box): рамку срезало
// по обоим краям. Слова — из lib/cert-image.js (certView): без «сдал(а)», «Экзамен на роль … сдан на 92%».
// «Поделиться картинкой» отправляет сам лист (PNG, lib/cert-image.js) — как «Сертификат мастера» (ui/mastery.jsx):
// файл в системное «Поделиться», а где файлом нельзя — просмотр со «Скачать». «Поделиться текстом» — строка в чат
// Telegram или в буфер. Раньше «Поделиться» отправляло только строку «Я сдал(а) экзамен…».
const CertShareIc = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4" /></svg>;
export function CertificateScreen({ T, a11y, profile, roleObj, result, onExit, shareUrl = "" }) {
  const color = roleObj?.color || GOLD;
  const v = certView({ profile, roleLabel: roleObj?.label || "", result });
  const data = { ...v, color };
  const picName = "certificate-" + (roleObj?.id || "role") + ".png";
  const [sent, setSent] = useState("");
  const [pic, setPic] = useState(null);
  const [pv, setPv] = useState(null);
  const [busy, setBusy] = useState(false);
  // картинку рисуем сразу: системное «Поделиться» с файлом работает только по свежему нажатию
  useEffect(() => {
    let dead = false;
    certImage(data).then((b) => { if (!dead && b) setPic(b); }).catch(() => {});
    return () => { dead = true; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (pv && pv.url) { try { URL.revokeObjectURL(pv.url); } catch (e) {} } }, [pv]);
  const preview = (blob) => { try { setPv({ url: URL.createObjectURL(blob) }); } catch (e) { setSent("Картинка не открылась. Поделись текстом"); } };
  const sharePic = () => {
    if (busy) return;
    setSent("");
    const send = (blob) => {
      let file = null;
      try { file = new File([blob], picName, { type: "image/png" }); } catch (e) {}
      let can = false;
      try { can = !!(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) {}
      if (!can) { preview(blob); return; }
      navigator.share({ files: [file], title: "Сертификат" }).then(() => setSent("Отправлено"), (e) => { if (!(e && e.name === "AbortError")) preview(blob); });
    };
    if (pic) { vibrate("light"); send(pic); return; }
    setBusy(true);
    certImage(data).then((blob) => {
      setBusy(false);
      if (!blob) { setSent("Картинка не получилась. Поделись текстом"); return; }
      setPic(blob);
      preview(blob);   // время нажатия ушло — сразу просмотр, оттуда «Скачать» или «Поделиться»
    }, () => { setBusy(false); setSent("Картинка не получилась. Поделись текстом"); });
  };
  const shareText = () => {
    vibrate("light");
    const text = certShareText(v);
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.initData && typeof tg.openTelegramLink === "function") { tg.openTelegramLink("https://t.me/share/url?url=" + encodeURIComponent(shareUrl || "") + "&text=" + encodeURIComponent(text)); setSent("Выбери чат в Telegram"); return; }
    } catch (e) {}
    const full = text + (shareUrl ? "\n" + shareUrl : "");
    const copy = () => { try { navigator.clipboard.writeText(full).then(() => setSent("Текст скопирован"), () => setSent("Не получилось скопировать. Сделай снимок экрана")); } catch (e) { setSent("Не получилось скопировать. Сделай снимок экрана"); } };
    try { if (navigator.share) { navigator.share({ text: full }).then(() => setSent("Отправлено"), (e) => { if (!(e && e.name === "AbortError")) copy(); }); return; } } catch (e) {}
    copy();
  };
  const pvShare = () => {
    if (!pic) return;
    let file = null;
    try { file = new File([pic], picName, { type: "image/png" }); } catch (e) {}
    try { if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file] }).catch(() => {}); } catch (e) {}
  };
  const canFiles = (() => { try { return !!(typeof navigator !== "undefined" && navigator.canShare && typeof File !== "undefined" && navigator.canShare({ files: [new File([""], "a.png", { type: "image/png" })] })); } catch (e) { return false; } })();
  const RULE = "#8B6A30", P_INK = "#2A1F0E", P_SUB = "#735F44";
  const wide = { width:"100%", maxWidth:380, boxSizing:"border-box" };
  const pvEl = pv ? (
    <div role="dialog" aria-modal="true" aria-label="Сертификат картинкой" data-cert-preview=""
      style={{ position:"fixed", inset:0, zIndex:1002, background:"#0D0905", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, boxSizing:"border-box", overflowY:"auto",
        padding:"max(18px, var(--sa-st, env(safe-area-inset-top, 0px))) 18px calc(18px + env(safe-area-inset-bottom, 0px))" }}>
      <img src={pv.url} alt={"Сертификат: экзамен на роль " + (v.role ? "«" + v.role + "» " : "") + v.done}
        style={{ maxWidth:"100%", maxHeight:"62vh", borderRadius:10, boxShadow:"0 18px 50px rgba(0,0,0,.55)", WebkitTouchCallout:"default", userSelect:"auto", WebkitUserSelect:"auto" }} />
      {/* слой просмотра всегда тёмный (и в виде «Для чтения»), поэтому кнопки здесь — своё стекло с золотыми буквами, без отметки линзы: её стили зависят от темы */}
      <a href={pv.url} download={picName} className="sa-btn" data-cert-save=""
        style={{ ...wide, maxWidth:360, minHeight:52, display:"inline-flex", alignItems:"center", justifyContent:"center", borderRadius:999, border:"1px solid rgba(214,178,102,0.65)",
          background:"linear-gradient(180deg, rgba(214,178,102,0.20), rgba(214,178,102,0.08))", boxShadow:"inset 0 1px 0 rgba(255,236,196,0.22)", color:"#F0D9A0", fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:16, textDecoration:"none" }}>Скачать картинку</a>
      {canFiles ? <button type="button" className="sa-btn" data-cert-pvshare="" onClick={pvShare}
        style={{ ...wide, maxWidth:360, minHeight:46, borderRadius:999, border:"1px solid rgba(214,178,102,0.4)", background:"transparent", color:"#F3E9D2", fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:14, cursor:"pointer" }}>Поделиться…</button> : null}
      <p style={{ margin:0, textAlign:"center", font:"13.5px/1.45 Georgia, serif", color:"rgba(243,233,210,.84)", maxWidth:360 }}>Или нажми и удерживай картинку, затем «Сохранить» или «Поделиться». В Telegram её можно отправить из галереи.</p>
      <button type="button" data-sa-back="" onClick={() => setPv(null)} style={{ minHeight:46, padding:"0 20px", border:0, background:"none", cursor:"pointer", color:"rgba(243,233,210,0.84)", fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:15 }}>Готово</button>
    </div>
  ) : null;
  return (
    <div style={T.screen}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onExit}>‹</button>
        <div style={{ ...T.lessHeadTitle }}>Сертификат</div>
      </div>
      <div style={{ ...T.lessBody, padding:"22px 20px 40px", display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
        <div data-cert="" style={{ ...wide, padding:9, borderRadius:8, marginBottom:6,
          background:"linear-gradient(168deg, #FCF8EE 0%, #F4ECD9 100%)",
          boxShadow: a11y ? "0 10px 26px rgba(90,64,20,0.20), 0 0 0 1px rgba(139,106,48,0.35)" : "0 18px 44px rgba(0,0,0,0.6), 0 0 0 1px rgba(214,178,102,0.4)" }}>
          <div style={{ border:`1.5px solid ${RULE}`, borderRadius:4, padding:3 }}>
            <div style={{ border:"1px solid rgba(139,106,48,0.45)", borderRadius:2, padding:"24px 16px 16px", display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", color:P_INK, fontFamily:"Georgia, serif" }}>
              <div style={{ letterSpacing:3, fontSize:10.5, textTransform:"uppercase", color:RULE }}>Service Academy</div>
              <div style={{ fontFamily:ACCENT_SERIF, fontWeight:700, fontSize:29, letterSpacing:0.5, lineHeight:1.1, marginTop:8 }}>Сертификат</div>
              <div aria-hidden="true" style={{ display:"flex", alignItems:"center", gap:8, marginTop:12 }}>
                <span style={{ width:46, height:1, background:RULE, opacity:0.7 }} /><span style={{ width:6, height:6, transform:"rotate(45deg)", background:color }} /><span style={{ width:46, height:1, background:RULE, opacity:0.7 }} />
              </div>
              <div data-cert-name="" style={{ fontFamily:ACCENT_SERIF, fontWeight:700, fontSize:26, lineHeight:1.2, marginTop:20, overflowWrap:"anywhere" }}>{v.name}</div>
              <div aria-hidden="true" style={{ width:"74%", height:1, background:"rgba(139,106,48,0.45)", marginTop:8 }} />
              <div style={{ fontSize:13, fontStyle:"italic", color:P_SUB, marginTop:14 }}>Экзамен на роль</div>
              <div data-cert-role="" style={{ fontFamily:ACCENT_SERIF, fontWeight:700, fontSize:21, lineHeight:1.2, marginTop:3 }}>{v.role}</div>
              <div data-cert-done="" style={{ fontSize:13, fontStyle:"italic", color:P_SUB, marginTop:3 }}>{v.score != null ? <>сдан на <b style={{ fontStyle:"normal", color:P_INK }}>{v.score}%</b></> : "сдан"}</div>
              <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:10, width:"100%", marginTop:22 }}>
                <div style={{ textAlign:"left", minWidth:0, lineHeight:1.45 }}>
                  {v.date ? <div data-cert-date="" style={{ fontSize:12.5 }}>{v.date}</div> : null}
                  {v.until ? <div data-cert-until="" style={{ fontSize:11, color: v.expired ? "#8B3020" : P_SUB }}>{v.expired ? "срок истёк " : "действует до "}{v.until}</div> : null}
                  {v.restaurant ? <div style={{ fontSize:11, color:P_SUB }}>{v.restaurant}</div> : null}
                </div>
                <WaxSeal size={62} icon="gradcap" />
              </div>
            </div>
          </div>
        </div>
        <button type="button" onClick={sharePic} disabled={busy} className="sa-btn" data-lens-btn="main" data-cert-sharepic=""
          style={{ ...wide, minHeight:50, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8, padding:"0 14px", borderRadius:14, border:"none", background:color, color:"#1A1008", fontWeight:"bold", fontFamily:"Georgia, serif", fontSize:15, cursor: busy ? "default" : "pointer", opacity: busy ? 0.65 : 1 }}>
          <CertShareIc />{busy ? "Рисуем картинку…" : "Поделиться картинкой"}
        </button>
        <button type="button" onClick={shareText} className="sa-btn" data-lens-btn="soft" data-cert-sharetext=""
          style={{ ...wide, minHeight:46, padding:"0 14px", borderRadius:14, border:`1px solid ${color}55`, background:"transparent", color: T.para?.color || "#C8B898", fontWeight:"bold", fontFamily:"Georgia, serif", fontSize:14, cursor:"pointer" }}>Поделиться текстом</button>
        {sent ? <p role="status" data-cert-sent="" style={{ margin:0, textAlign:"center", fontFamily:"Georgia, serif", fontSize: a11y ? 14 : 13.5, color: T.para?.color || "#C8B898" }}>{sent}</p> : null}
        <button type="button" onClick={onExit} className="sa-btn" data-cert-done-btn=""
          style={{ minHeight:44, padding:"0 24px", border:0, background:"none", cursor:"pointer", color: a11y ? "#5E4E30" : "rgba(243,233,210,0.8)", fontFamily:"Georgia, serif", fontWeight:"bold", fontSize: a11y ? 15.5 : 15 }}>Готово</button>
      </div>
      {pvEl && typeof document !== "undefined" && document.body ? createPortal(pvEl, document.body) : pvEl}
    </div>
  );
}

export function CertificatesScreen({ T, a11y, profile, completedRoles = new Set(), examResults = {}, completed = {}, quizDone = {}, onExam, onCertificate, onExit }) {
  // Роль считается пройденной, если она в completedRoles ИЛИ все её уроки фактически пройдены
  // (страховка для прогресса, сохранённого до появления флага роли)
  const roleAllDone = (id) => {
    const ls = programOf(id).flatMap(m => (m && m.lessons) || []).filter(l => l.type !== "result");   // и свои разделы (правка 173)
    return ls.length > 0 && ls.every(l => (l.type === "quiz" ? quizDone[l.id] : completed[l.id]));
  };
  // Страничная подсказка: правило про весь экран, а не про одну кнопку
  const [ceHint, ceHintDone] = useHintOnce("certificates");
  const ceSteps = hintsFor("certificates");
  const wide = useWide();
  useColumn(wide ? 900 : 0);
  return (
    <div style={T.screen}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onExit}>‹</button>
        <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>{UI_SVG.gradcap(a11y ? "#7A5D2A" : GOLD, 19)}<span>Сертификаты</span></div>
      </div>
      {ceHint && ceSteps.length ? (
        <HintBubble a11y={a11y} text={ceSteps[0]} arrow="up" step={1} total={1} onClose={ceHintDone} />
      ) : null}
      <div className="sa-g2" style={{ ...T.lessBody, padding:"14px 16px 40px", display:"flex", flexDirection:"column", gap:12 }}>
        {_CERT_ROLE_ORDER.map(id => {
          const r = ROLES.find(x => x.id === id);
          if (!r) return null;
          const color = r.color || GOLD;
          const res = examResults[id];
          const passed = !!(res && res.passed);
          const eligible = (completedRoles && completedRoles.has ? completedRoles.has(id) : false) || roleAllDone(id);
          const hasQuestions = collectRoleQuestions(id).length > 0;
          // ═══ Переаттестация: сертификат «живёт» 12 месяцев ═══
          const VALID_MONTHS = 12;
          let validUntil = null, expired = false, expiring = false;
          if (passed && res.date) {
            const d = new Date(res.date);
            if (!isNaN(d)) {
              validUntil = new Date(d); validUntil.setMonth(validUntil.getMonth() + VALID_MONTHS);
              const leftDays = Math.floor((validUntil - Date.now()) / 86400000);
              expired = leftDays < 0;
              expiring = !expired && leftDays <= 30;
            }
          }
          const untilStr = validUntil ? validUntil.toLocaleDateString("ru-RU") : null;
          const amber = a11y ? "#7A5D2A" : "#E0B060";
          const redC = a11y ? "#A33A2A" : "#E07878";
          const statusLine = !passed
            ? (eligible ? "Доступен экзамен" : "Сначала пройди роль")
            : expired ? `Сдано · ${res.score}% · срок истёк, пересдай`
            : expiring ? `Сдано · ${res.score}% · до ${untilStr}, скоро переаттестация`
            : untilStr ? `Сдано · ${res.score}% · действует до ${untilStr}`
            : `Сдано · ${res.score}%`;
          return (
            <div key={id} data-lens-card="" style={{ ...T.modCard, padding:"14px 16px", borderRadius:14, flexDirection:"column", alignItems:"flex-start", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, width:"100%" }}>
                <div data-lens="disc" style={{ width:36, height:36, borderRadius:"50%", background:`${color}22`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18, "--tint": color + "55" }}>{passed ? UI_SVG.gradcap(color, 19) : (ROLE_SVG[r.id] ? ROLE_SVG[r.id](color, 19) : r.icon)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color, fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:14 }}>{r.label}</div>
                  <div style={{ ...T.modSub, fontSize:12.5, color: passed && expired ? redC : passed && expiring ? amber : T.modSub.color }}>{statusLine}</div>
                </div>
              </div>
              {passed && expired && hasQuestions
                ? <button onClick={() => onExam && onExam(id)} {...onActivate(() => onExam && onExam(id))} className="sa-btn" data-lens-btn="danger" style={{ alignSelf:"stretch", padding:"10px", borderRadius:12, border:"none", background:redC, color:"#1A1008", fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:14, cursor:"pointer" }}>Пересдать экзамен</button>
                : passed
                ? <button onClick={() => onCertificate && onCertificate(id)} {...onActivate(() => onCertificate && onCertificate(id))} data-lens-btn="soft" style={{ alignSelf:"stretch", padding:"10px", borderRadius:12, border:`1px solid ${color}`, background:"transparent", color, fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:14, cursor:"pointer" }}>Открыть сертификат</button>
                : (eligible && hasQuestions)
                  ? <button onClick={() => onExam && onExam(id)} {...onActivate(() => onExam && onExam(id))} className="sa-btn" data-lens-btn="main" style={{ alignSelf:"stretch", padding:"10px", borderRadius:12, border:"none", background:color, color:"#1A1008", fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:14, cursor:"pointer" }}>Сдать экзамен</button>
                  : null
              }
            </div>
          );
        })}
        <div data-span="" style={{ ...T.para, textAlign:"center", opacity:0.5, fontSize:12.5, marginTop:8 }}>Сдай экзамен на роль, чтобы получить сертификат.</div>
      </div>
    </div>
  );
}
