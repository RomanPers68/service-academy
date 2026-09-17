// ui/screens-exam.jsx
// Экзамен роли и сертификаты.
// Вынесено из ui/screens.jsx БЕЗ изменения кода (barrel-разбиение);
// публичный API остался в ui/screens.jsx — App.jsx не менялся.

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import React from "react";
import { createPortal } from "react-dom";
import { SUPABASE_URL, SUPABASE_KEY, rpc, saToken, rpcSync, flushQueue, supabase } from "../api/supabase";
import { MODULES } from "../data/modules";
import { ROLES, RESTAURANTS } from "../data/roles";
import { GLOSSARY } from "../data/glossary";
import { DIALOGUES_DATA, MOOD_EMOJI_D, MOOD_COLORS_D, loadDialogues } from "../data/dialogues-lazy";
import { LOGO_SRC, LOGO_SRC_DARK } from "../assets/logo";
import { normSurname, shuffleArray, dedupeBestScores, pickRandom, shuffleSituationOptions, vibrate, onActivate, shuffleQuizOptions, encodeStartParam, decodeStartParam } from "../lib/utils";
import { MM, Mm, ROLE_SVG, UI_SVG, POS_SVG, MOD_SVG, MARKER_RE, GAME_SVG, NAV_ICONS } from "./icons";
import { S, A, ACCENT_SERIF } from "./styles";
import { referenceDailyTask } from "./reference-daily";
import { bookStats, countNewDishes } from "../data/reviews";
import { countUnreadPages } from "./guestbook-lite";
import { Confetti, TimerBar, SayAloud, LiquidSegment } from "./widgets";
import { crownIcon, flameIcon, trophyIcon, faceIcon } from "./icons-extra";
import { StreakCard, MoodCheckCard, TeamMoodCard, moodPalette } from "./mood-cards";
import { BROWN, BROWN_GOLD, CREAM, GOLD, GOLD_SOFT, GREEN, GREEN_DARK, INK, MUTED_2, RED, RED_DARK } from "./tokens";

const EXAM_PASS = 0.8;   // порог сдачи — 80%
const EXAM_COUNT = 10;   // вопросов в одной попытке (или меньше, если их мало)
const _CERT_ROLE_ORDER = ["spg", "bar", "seasonal", "core", "manager", "service_manager"];

// Собрать все вопросы квизов роли
function collectRoleQuestions(roleId) {
  const mods = MODULES[roleId];
  if (!Array.isArray(mods)) return [];
  const out = [];
  mods.forEach(m => {
    (m && Array.isArray(m.lessons) ? m.lessons : []).forEach(l => {
      if (l && l.type === "quiz" && Array.isArray(l.questions)) {
        l.questions.forEach(q => {
          if (q && q.q && Array.isArray(q.options) && q.options.length > 1 && typeof q.correct === "number") {
            out.push({ q: q.q, options: q.options, correct: q.correct, explanation: q.explanation || "" });
          }
        });
      }
    });
  });
  return out;
}

export function ExamScreen({ T, a11y, roleObj, roleId, onFinish, onExit }) {
  const color = roleObj?.color || GOLD;
  const pool = useMemo(() => collectRoleQuestions(roleId), [roleId]);
  const [attempt, setAttempt] = React.useState(0);
  const questions = useMemo(() => shuffleArray([...pool]).slice(0, Math.min(EXAM_COUNT, pool.length)).map(shuffleQuizOptions), [pool, attempt]);
  const [step, setStep] = React.useState(0);
  const [picked, setPicked] = React.useState(null);
  const [correctCount, setCorrectCount] = React.useState(0);
  const [phase, setPhase] = React.useState("quiz");

  if (!questions.length) {
    return (
      <div style={T.screen}>
        <div style={T.lessHead}>
          <button style={T.backBtn2} onClick={onExit}>‹</button>
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
        <div style={{ ...T.lessBody, padding:"48px 24px", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:18 }}>
          <div style={{ fontSize:64 }}>{passed ? "🎓" : "📚"}</div>
          <div style={{ color: passed ? color : (a11y ? "#8B3020" : "#E07878"), fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:24 }}>
            {passed ? "Экзамен сдан!" : "Почти получилось"}
          </div>
          <div style={{ ...T.para, fontSize:18 }}>Результат: <b style={{ color }}>{score}%</b> ({correctCount} из {total})</div>
          <div style={{ ...T.para, opacity:0.7, fontSize:14, maxWidth:300 }}>
            {passed ? "Сертификат уже в твоём профиле." : `Нужно ${Math.round(EXAM_PASS*100)}% и выше. Повтори материал и попробуй ещё раз.`}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:320, marginTop:6 }}>
            {passed
              ? <button onClick={onExit} className="sa-btn" style={{ padding:"14px", borderRadius:14, border:"none", background:color, color:"#1A1008", fontWeight:"bold", fontFamily:"Georgia, serif", fontSize:15, cursor:"pointer" }}>К сертификату</button>
              : <>
                  <button onClick={() => { setAttempt(a => a + 1); setStep(0); setPicked(null); setCorrectCount(0); setPhase("quiz"); }} className="sa-btn" style={{ padding:"14px", borderRadius:14, border:"none", background:color, color:"#1A1008", fontWeight:"bold", fontFamily:"Georgia, serif", fontSize:15, cursor:"pointer" }}>Пересдать</button>
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
        <button style={T.backBtn2} onClick={onExit}>‹</button>
        <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}><span>Экзамен · {roleObj?.label || ""}</span></div>
      </div>
      <div style={{ ...T.lessBody, padding:"14px 16px 40px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <div style={{ flex:1, height:6, borderRadius:3, background:"rgba(255,255,255,0.08)", overflow:"hidden" }}>
            <div style={{ width:`${(step/total)*100}%`, height:"100%", background:color, transition:"width 0.3s" }} />
          </div>
          <div style={{ ...T.para, fontSize:13, opacity:0.7, whiteSpace:"nowrap" }}>{step+1} / {total}</div>
        </div>
        <div key={step} className="sa-cardpage-r" style={{ ...T.modCard, padding:"16px", borderRadius:16, flexDirection:"column", alignItems:"flex-start", gap:14 }}>
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
            <div style={{ ...T.para, fontSize:13, opacity:0.85, lineHeight:1.55, borderLeft:`2px solid ${color}`, paddingLeft:12 }}>{cur.explanation}</div>
          )}
        </div>
        {answered && (
          <button onClick={next} className="sa-btn" style={{ width:"100%", marginTop:16, padding:"14px", borderRadius:14, border:"none", background:color, color:"#1A1008", fontWeight:"bold", fontFamily:"Georgia, serif", fontSize:15, cursor:"pointer" }}>
            {isLast ? "Завершить" : "Далее"}
          </button>
        )}
      </div>
    </div>
  );
}

export function CertificateScreen({ T, a11y, profile, roleObj, result, onExit, onShare }) {
  const color = roleObj?.color || GOLD;
  const name = profile ? `${profile.name} ${profile.surname || ""}`.trim() : "—";
  let dateStr = "";
  try { dateStr = new Date(result?.date || Date.now()).toLocaleDateString("ru-RU", { day:"numeric", month:"long", year:"numeric" }); } catch(e) {}
  return (
    <div style={T.screen}>
      <div style={T.lessHead}>
        <button style={T.backBtn2} onClick={onExit}>‹</button>
        <div style={{ ...T.lessHeadTitle }}>Сертификат</div>
      </div>
      <div style={{ ...T.lessBody, padding:"24px 20px 40px", display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
        <div style={{ width:"100%", maxWidth:380, borderRadius:20, padding:"28px 22px",
          background: a11y ? "rgba(245,238,220,0.7)" : "linear-gradient(160deg, rgba(58,42,16,0.5) 0%, rgba(30,22,10,0.6) 100%)",
          border:`2px solid ${color}`, boxShadow:`0 8px 30px ${color}22, inset 0 1px 0 ${color}33`,
          display:"flex", flexDirection:"column", alignItems:"center", gap:14, textAlign:"center" }}>
          <div style={{ fontSize:46 }}>🎓</div>
          <div style={{ letterSpacing:3, fontSize:11, color, fontFamily:"Georgia, serif", textTransform:"uppercase" }}>Service Academy</div>
          <div style={{ width:40, height:2, background:color, borderRadius:2 }} />
          <div style={{ fontSize:13, color: T.para?.color || "#C8B898", fontFamily:"Georgia, serif", opacity:0.8 }}>Настоящим подтверждается, что</div>
          <div style={{ fontSize:22, color: T.modTitle?.color || "#F0E8D8", fontFamily:"Georgia, serif", fontWeight:"bold", lineHeight:1.3 }}>{name}</div>
          <div style={{ fontSize:13, color: T.para?.color || "#C8B898", fontFamily:"Georgia, serif", opacity:0.8 }}>успешно сдал(а) экзамен на роль</div>
          <div style={{ fontSize:18, color, fontFamily:"Georgia, serif", fontWeight:"bold" }}>{roleObj?.label || ""}</div>
          {typeof result?.score === "number" && (
            <div style={{ fontSize:13, color: T.para?.color || "#C8B898", fontFamily:"Georgia, serif" }}>Результат: {result.score}%</div>
          )}
          <div style={{ width:40, height:2, background:`${color}66`, borderRadius:2, marginTop:4 }} />
          <div style={{ fontSize:12, color: T.para?.color || "#A89878", fontFamily:"Georgia, serif", opacity:0.7 }}>{dateStr}</div>
        </div>
        <button onClick={onShare} className="sa-btn" style={{ width:"100%", maxWidth:380, padding:"14px", borderRadius:14, border:"none", background:color, color:"#1A1008", fontWeight:"bold", fontFamily:"Georgia, serif", fontSize:15, cursor:"pointer" }}>Поделиться</button>
        <button onClick={onExit} style={{ width:"100%", maxWidth:380, padding:"12px", borderRadius:14, border:`1px solid ${color}55`, background:"transparent", color: T.para?.color || "#C8B898", fontFamily:"Georgia, serif", fontSize:14, cursor:"pointer" }}>Готово</button>
      </div>
    </div>
  );
}

export function CertificatesScreen({ T, a11y, profile, completedRoles = new Set(), examResults = {}, completed = {}, quizDone = {}, onExam, onCertificate, onExit }) {
  // Роль считается пройденной, если она в completedRoles ИЛИ все её уроки фактически пройдены
  // (страховка для прогресса, сохранённого до появления флага роли)
  const roleAllDone = (id) => {
    const ls = (MODULES[id] || []).flatMap(m => (m && m.lessons) || []).filter(l => l.type !== "result");
    return ls.length > 0 && ls.every(l => (l.type === "quiz" ? quizDone[l.id] : completed[l.id]));
  };
  return (
    <div style={T.screen}>
      <div style={T.lessHead}>
        <button style={T.backBtn2} onClick={onExit}>‹</button>
        <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>{UI_SVG.gradcap(a11y ? "#8B6A30" : GOLD, 19)}<span>Сертификаты</span></div>
      </div>
      <div style={{ ...T.lessBody, padding:"14px 16px 40px", display:"flex", flexDirection:"column", gap:12 }}>
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
          const amber = a11y ? "#8B6A30" : "#E0B060";
          const redC = a11y ? "#A03828" : "#E07878";
          const statusLine = !passed
            ? (eligible ? "Доступен экзамен" : "Сначала пройди роль")
            : expired ? `Сдано · ${res.score}% · срок истёк — пересдай`
            : expiring ? `Сдано · ${res.score}% · до ${untilStr} — скоро переаттестация`
            : untilStr ? `Сдано · ${res.score}% · действует до ${untilStr}`
            : `Сдано · ${res.score}%`;
          return (
            <div key={id} style={{ ...T.modCard, padding:"14px 16px", borderRadius:16, flexDirection:"column", alignItems:"flex-start", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, width:"100%" }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:`${color}22`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18 }}>{passed ? UI_SVG.gradcap(color, 19) : (ROLE_SVG[r.id] ? ROLE_SVG[r.id](color, 19) : r.icon)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color, fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:15 }}>{r.label}</div>
                  <div style={{ ...T.modSub, fontSize:12, color: passed && expired ? redC : passed && expiring ? amber : T.modSub.color }}>{statusLine}</div>
                </div>
              </div>
              {passed && expired && hasQuestions
                ? <button onClick={() => onExam && onExam(id)} {...onActivate(() => onExam && onExam(id))} className="sa-btn" style={{ alignSelf:"stretch", padding:"10px", borderRadius:12, border:"none", background:redC, color:"#1A1008", fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:14, cursor:"pointer" }}>Пересдать экзамен</button>
                : passed
                ? <button onClick={() => onCertificate && onCertificate(id)} {...onActivate(() => onCertificate && onCertificate(id))} style={{ alignSelf:"stretch", padding:"10px", borderRadius:12, border:`1px solid ${color}`, background:"transparent", color, fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:14, cursor:"pointer" }}>Открыть сертификат</button>
                : (eligible && hasQuestions)
                  ? <button onClick={() => onExam && onExam(id)} {...onActivate(() => onExam && onExam(id))} className="sa-btn" style={{ alignSelf:"stretch", padding:"10px", borderRadius:12, border:"none", background:color, color:"#1A1008", fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:14, cursor:"pointer" }}>Сдать экзамен</button>
                  : null
              }
            </div>
          );
        })}
        <div style={{ ...T.para, textAlign:"center", opacity:0.5, fontSize:13, marginTop:8 }}>Сдай экзамен на роль, чтобы получить сертификат.</div>
      </div>
    </div>
  );
}
