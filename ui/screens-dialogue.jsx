// ui/screens-dialogue.jsx
// Живой диалог с гостем.
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

const dlgLastByTerm = {};
export function LiveDialogue({ dialogueId, T, onClose, color, pro }) {
  const initial = DIALOGUES_DATA.find(d => d.id === dialogueId);
  // Группа = все сценарии одной темы (один termKey). Позволяет ротацию вариантов.
  const group = React.useMemo(
    () => initial ? DIALOGUES_DATA.filter(d => d.termKey === initial.termKey) : [],
    [initial]
  );
  // Страховка: диалоги грузятся лениво. Если сценария ещё нет (чанк едет
  // по медленной сети или не загрузился) — дотягиваем и перерисовываемся.
  const [, dataTick] = React.useState(0);
  React.useEffect(() => {
    if (initial) return;
    let alive = true;
    loadDialogues().then(() => { if (alive) dataTick(x => x + 1); }).catch(() => {});
    return () => { alive = false; };
  }, [initial]);
  // При каждом открытии — случайный сценарий из группы (пока вариант один — он же и откроется)
  const [currentId, setCurrentId] = React.useState(() => {
    if (!initial) return dialogueId;
    const grp = DIALOGUES_DATA.filter(d => d.termKey === initial.termKey);
    if (!grp.length) return dialogueId;
    let pick = grp[Math.floor(Math.random() * grp.length)].id;
    if (grp.length > 1 && pick === dlgLastByTerm[initial.termKey]) {
      const others = grp.filter(d => d.id !== dlgLastByTerm[initial.termKey]);
      pick = others[Math.floor(Math.random() * others.length)].id;
    }
    dlgLastByTerm[initial.termKey] = pick;
    return pick;
  });
  // Перемешивание вариантов: правильный ответ больше не стоит первым.
  // Пересобирается при каждом запуске сценария и при «Ещё раз» (shuffleKey).
  const [shuffleKey, setShuffleKey] = React.useState(0);
  const dialogue = React.useMemo(() => {
    const base = group.find(d => d.id === currentId) || initial;
    if (!base) return base;
    return { ...base, steps: base.steps.map(s =>
      (s.type === "choice" && Array.isArray(s.options)) ? { ...s, options: shuffleArray([...s.options]) } : s
    )};
  }, [group, currentId, initial, shuffleKey]);
  const idxOf = (sid) => sid === "result" ? dialogue.steps.findIndex(s => s.type === "result") : dialogue.steps.findIndex(s => s.id === sid);
  const [visible, setVisible] = React.useState(false);
  const [messages, setMessages] = React.useState([]);

  React.useEffect(() => {
    // Двойной requestAnimationFrame вместо setTimeout(20): гарантирует, что
    // браузер успел отрисовать стартовое положение шторки (translateY(120%))
    // до переключения на translateY(0) — иначе на занятом главном потоке
    // (открытие из списка уроков: монтируется целый экран) transition
    // стартует с середины пути, и вход выглядит телепортом.
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setVisible(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);
  const [stepIdx, setStepIdx] = React.useState(0);
  const [chosen, setChosen] = React.useState(null);
  const [picked, setPicked] = React.useState(null); // выбранный вариант в фазе плавного ухода остальных
  const [score, setScore] = React.useState(0);
  const [choicesFaced, setChoicesFaced] = React.useState(0);
  const [mood, setMood] = React.useState(dialogue?.guest.mood || 3);
  const [typing, setTyping] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [walkedOut, setWalkedOut] = React.useState(false);
  const bottomRef = React.useRef(null);
  const scrollRef = React.useRef(null);

  // Telegram: пока открыт диалог, глушим жест «потяни вниз — сверни приложение».
  // Иначе вертикальные свайпы по шторке (шапка, варианты, края) утекают
  // в Telegram, и он дёргает всё мини-приложение вниз-вверх — тот самый «нырок».
  // При закрытии диалога жест возвращается как был.
  React.useEffect(() => {
    // Жесты Telegram настраиваются глобально при старте (index.html):
    // expand + disableVerticalSwipes. Локально не переключаем, чтобы уход
    // с экрана не возвращал жест сворачивания.
  }, []);
  const recapRef = React.useRef(null); // история диалога на финальном экране
  const optsRef = React.useRef(null); // блок вариантов — для плавного схлопывания после выбора
  const runningRef = React.useRef(false);

  // Плавный автоскролл к низу ленты
  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight; // старые WebView без smooth
    }
  }, []);

  // Срабатывает на всё, что меняет высоту ленты: сообщения, «печатает…»,
  // появление вариантов ответа (stepIdx/chosen). Двойной rAF ждёт, пока
  // новый элемент реально отрисуется и получит высоту.
  React.useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(scrollToBottom);
    });
    const t = setTimeout(scrollToBottom, 380); // страховка после анимации появления
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(t); };
  }, [messages, typing, stepIdx, chosen, done, scrollToBottom]);

  // Финальный экран: плавно прокручиваем историю к последним репликам,
  // чтобы был виден финал диалога, а не его начало.
  React.useEffect(() => {
    if (!done) return;
    vibrate(walkedOut ? "error" : (mood >= 4 ? "success" : "light")); // тактильный аккорд финала
    const t = setTimeout(() => {
      const el = recapRef.current;
      if (!el) return;
      if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      else el.scrollTop = el.scrollHeight;
    }, 350); // даём экрану итога появиться, затем «проматываем» историю к концу
    return () => clearTimeout(t);
  }, [done]);

  const addMsg = (msg) => new Promise(r => {
    setMessages(prev => [...prev, msg]);
    setTimeout(r, 100);
  });

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  React.useEffect(() => {
    if (!dialogue || runningRef.current) return;
    const step = dialogue.steps[stepIdx];
    if (!step || step.type === "choice" || step.type === "result") return;

    runningRef.current = true;
    const run = async () => {
      if (step.type === "guest") {
        setTyping(true);
        await sleep(900);
        setTyping(false);
      }
      await sleep(200);
      await addMsg({ ...step });
      await sleep(350);
      runningRef.current = false;
      const nxt = step.next ? idxOf(step.next) : stepIdx + 1;
      if (step.type !== "result") { if (dialogue.steps[nxt] && dialogue.steps[nxt].type === "result") setDone(true); else setStepIdx(nxt); }
    };
    run();
  }, [stepIdx]);

  const choose = async (optIdx) => {
    if (chosen !== null || picked !== null) return;
    const step = dialogue.steps[stepIdx];
    const opt = step.options[optIdx];
    // Фаза 1: выбранный вариант подсвечивается, остальные плавно тают
    setPicked(optIdx);
    vibrate(opt.correct ? "light" : "error");
    await sleep(360);
    // Фаза 2: блок вариантов плавно складывается по высоте — лента не дёргается
    const box = optsRef.current;
    if (box) {
      box.style.height = box.scrollHeight + "px";
      box.style.overflow = "hidden";
      box.style.transition = "height 0.34s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease, margin 0.34s ease";
      void box.offsetHeight; // фиксируем стартовую высоту перед анимацией
      box.style.height = "0px";
      box.style.opacity = "0";
      box.style.marginTop = "0px";
      await sleep(340);
    }
    // Фаза 3: варианты уходят из DOM (уже невидимы и без высоты), ответ въезжает в чат
    setChosen(optIdx);
    setPicked(null);
    if (opt.correct) setScore(s => s + 1);
    setChoicesFaced(c => c + 1);
    const nm = Math.max(1, Math.min(5, mood + opt.moodDelta));
    setMood(nm);
    await addMsg({ type: "waiter", text: opt.text, correct: opt.correct });
    await sleep(500);
    await addMsg({ type: "feedback", text: opt.feedback, correct: opt.correct });
    await sleep(700);
    if (pro && !opt.correct) {
      const best = step.options.find(o => o.correct);
      if (best) { await addMsg({ type: "hint", text: best.text }); await sleep(600); }
    }
    if (opt.reaction) {
      setTyping(true);
      await sleep(800);
      setTyping(false);
      await addMsg({ type: "guest", text: opt.reaction });
      await sleep(950); // реплика гостя успевает доехать и прочитаться до смены экрана
    }
    if (pro && nm <= 1 && !opt.correct && !opt.goto) {
      await addMsg({ type: "action", text: dialogue.guest.name + " не выдержал и уходит, не дождавшись хорошего приёма." });
      setWalkedOut(true); setChosen(null); setDone(true); return;
    }
    setChosen(null);
    const next = opt.goto ? idxOf(opt.goto) : stepIdx + 1;
    if (next < 0 || dialogue.steps[next]?.type === "result") { setDone(true); return; }
    runningRef.current = false;
    setStepIdx(next);
  };

  if (!dialogue) return null;
  const moodC = Math.max(1, Math.min(5, mood));
  const totalChoices = dialogue.steps.filter(s => s.type === "choice").length;
  const dColor = dialogue.color;

  if (!initial) return (
    <div className="sa-dlg" style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center",
        background:"rgba(0,0,0,0.35)", padding:20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:T.termPopupBg || "rgba(20,14,6,0.85)", border:"1px solid rgba(200,160,60,0.45)",
          borderRadius:18, padding:"18px 20px", textAlign:"center", maxWidth:300 }}>
        <div className="sa-pulse" style={{ color:"#C8A96E", fontFamily:"Georgia, serif", fontWeight:"bold", marginBottom:6 }}>Диалог загружается…</div>
        <div style={{ color:"#9A8C74", fontSize:12.5, lineHeight:1.55, marginBottom:12 }}>
          Подтягиваем сценарий. Если сеть медленная — секунду-другую.
        </div>
        <button className="sa-btn" onClick={onClose}
          style={{ padding:"10px 18px", borderRadius:12, cursor:"pointer", border:"1px solid rgba(200,160,80,0.4)",
            background:"transparent", color:"#C8A96E", fontFamily:"Georgia, serif", fontSize:13, fontWeight:"bold" }}>
          Закрыть
        </button>
      </div>
    </div>
  );
  return (
    <div className="sa-dlg" style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", flexDirection:"column", justifyContent:"flex-end",
      background: visible ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0)",
      transition:"background 0.8s ease" }}>
      <div className="sa-dlgpath" style={{ background: T.a11y ? "rgba(250,242,222,0.92)" : "rgba(28,20,8,0.92)", backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)", borderRadius:24, height:"82vh", maxHeight:"82vh", display:"flex", flexDirection:"column", border: T.a11y ? "1px solid rgba(139,106,48,0.38)" : "1px solid rgba(255,255,255,0.16)", boxShadow: T.a11y ? "inset 0 0 26px rgba(255,250,235,0.6), inset 0 1px 0 rgba(255,252,240,0.9), 0 8px 32px rgba(70,50,15,0.3)" : "inset 0 0 26px rgba(255,248,230,0.08), inset 0 1px 0 rgba(255,255,255,0.14), 0 8px 32px rgba(0,0,0,0.5)", margin:"0 16px calc(72px + env(safe-area-inset-bottom, 0px))",
        transform: visible ? "translateY(0)" : "translateY(120%)",
        transition:"transform 1.1s cubic-bezier(0.16,1,0.3,1)" }}>
      {/* Header */}
      <div style={{ padding:"12px 14px 10px", background:`linear-gradient(135deg, ${dColor}18, transparent)`, borderBottom:`1px solid ${dColor}22` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <button onClick={() => onClose(done && !walkedOut)} style={{ background:"none", border:"none", color:BROWN, fontSize:22, cursor:"pointer", padding:0 }}>✕</button>
          <div style={{ width:34, height:34, borderRadius:"50%", flexShrink:0, background:`${dColor}1e`, border:`1px solid ${dColor}55`, display:"flex", alignItems:"center", justifyContent:"center", color:dColor, fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:15 }}>{(dialogue.guest.name || "?").trim()[0].toUpperCase()}</div>
          <div style={{ flex:1 }}>
            <div style={{ color: T.modTitle?.color || CREAM, fontSize: T.modTitle?.fontSize || 15, fontWeight:"bold" }}>{dialogue.guest.name}</div>
            <div style={{ color: T.modSub?.color || "#9A8060", fontSize: T.modSub?.fontSize ? T.modSub.fontSize - 2 : 12 }}>{dialogue.title}</div>
          </div>
          <div style={{ color: T.modTitle?.color || BROWN, fontSize: T.modSub?.fontSize || 13 }}>{score}/{totalChoices} ✓</div>
        </div>
        {/* Mood bar */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ fontSize:15, transition:"all 0.5s" }}>{MOOD_EMOJI_D[moodC-1]}</div>
          <div style={{ flex:1, height:3, background:"rgba(255,255,255,0.08)", borderRadius:2 }}>
            <div style={{ height:3, width:`${(moodC/5)*100}%`, background:MOOD_COLORS_D[moodC-1], borderRadius:2, transition:"width 0.6s cubic-bezier(0.34,1.56,0.64,1), background 0.5s" }} />
          </div>
          <div style={{ fontSize: T.modSub?.fontSize ? T.modSub.fontSize - 2 : 11, color:MOOD_COLORS_D[moodC-1], fontFamily:"monospace" }}>настроение</div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ height:3, margin:"0 14px", borderRadius:2, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${(stepIdx/(dialogue.steps.length-1))*100}%`, background:dColor, opacity:0.55, borderRadius:2, transition:"width 0.4s ease" }} />
      </div>

      {/* Messages */}
      {!done && <div ref={scrollRef} className="sa-dlgscroll" style={{ flex:1, overflowY:"auto", padding:"14px 14px 8px", display:"flex", flexDirection:"column", gap:8, WebkitOverflowScrolling:"touch", overscrollBehavior:"contain" }}>
        {messages.map((msg, i) => {
          if (msg.type === "action") return (
            <div key={i} className="dlg-in" style={{ textAlign:"center", color: T.para?.color || "#C8A870", fontSize: T.modSub?.fontSize || 13, fontStyle:"italic", padding:"4px 0" }}>— {msg.text} —</div>
          );
          if (msg.type === "guest") return (
            <div key={i} className="dlg-in dlg-in-left" style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
              <div style={{ fontSize: T.modSub?.fontSize ? T.modSub.fontSize - 1 : 13, color: T.modSub?.color || "#6A5535", marginBottom:2, paddingLeft:4 }}>{dialogue.guest.name}</div>
              <div style={{ maxWidth:"78%", padding:"9px 13px", borderRadius:14, borderBottomLeftRadius:4, background: T.a11y ? "rgba(250,242,222,0.75)" : "rgba(255,250,238,0.05)", border: T.a11y ? "1px solid rgba(139,106,48,0.35)" : "1px solid rgba(255,255,255,0.13)", boxShadow: T.a11y ? "inset 0 0 18px rgba(255,250,235,0.5), inset 0 1px 0 rgba(255,252,240,0.9)" : "inset 0 0 18px rgba(255,248,230,0.06), inset 0 1px 0 rgba(255,255,255,0.20)", color: T.a11y ? "#2E2412" : (T.modTitle?.color || "#C8B898"), fontSize: T.para?.fontSize || 14, lineHeight:1.6 }}>{msg.text}</div>
            </div>
          );
          if (msg.type === "waiter") return (
            <div key={i} className="dlg-in dlg-in-right" style={{ display:"flex", flexDirection:"column", alignItems:"flex-end" }}>
              <div style={{ fontSize: T.modSub?.fontSize ? T.modSub.fontSize - 1 : 13, color: T.modSub?.color || "#6A5535", marginBottom:2, paddingRight:4 }}>Ты</div>
              <div style={{ maxWidth:"78%", padding:"9px 13px", borderRadius:14, borderBottomRightRadius:4, background: msg.correct ? `${dColor}28` : "rgba(224,120,120,0.15)", border:`1px solid ${msg.correct ? dColor+"44" : "rgba(224,120,120,0.3)"}`, color: T.modTitle?.color || CREAM, fontSize: T.para?.fontSize || 14, lineHeight:1.6 }}>{msg.text}</div>
            </div>
          );
          if (msg.type === "feedback") return (
            <div key={i} className="dlg-in" style={{ padding:"8px 12px", borderRadius:10, background: msg.correct ? "rgba(93,187,138,0.08)" : "rgba(224,120,120,0.08)", border:`1px solid ${msg.correct ? "rgba(93,187,138,0.2)" : "rgba(224,120,120,0.2)"}`, color: msg.correct ? "#2DBB6A" : "#E05858", fontSize: T.modSub?.fontSize || 12, fontWeight:"bold", lineHeight:1.6 }}>
              {msg.correct ? "✓ " : "✗ "}{msg.text}
            </div>
          );
          if (msg.type === "hint") return (
            <div key={i} className="dlg-in" style={{ padding:"7px 12px", borderRadius:10, background: dColor+"14", border:"1px solid "+dColor+"33", color:dColor, fontSize: T.modSub?.fontSize || 12, lineHeight:1.55 }}>
              💡 Лучше: {msg.text}
            </div>
          );
          return null;
        })}

        {typing && (
          <div className="dlg-in dlg-in-left" style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
            <div style={{ fontSize: T.modSub?.fontSize ? T.modSub.fontSize - 1 : 13, color: T.modSub?.color || "#6A5535", marginBottom:2, paddingLeft:4 }}>{dialogue.guest.name}</div>
            <div style={{ padding:"10px 14px", borderRadius:14, borderBottomLeftRadius:4, background: T.a11y ? "rgba(250,242,222,0.75)" : "rgba(255,250,238,0.05)", border: T.a11y ? "1px solid rgba(139,106,48,0.35)" : "1px solid rgba(255,255,255,0.13)", boxShadow: T.a11y ? "inset 0 0 18px rgba(255,250,235,0.5)" : "inset 0 0 18px rgba(255,248,230,0.06)", display:"flex", gap:5, alignItems:"center" }}>
              {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:BROWN, animation:`dlgPulse 1s ${i*0.2}s infinite` }} />)}
            </div>
          </div>
        )}

        {dialogue.steps[stepIdx]?.type === "choice" && !typing && messages.length > 0 && chosen === null && !done && (
          <div ref={optsRef} style={{ marginTop:8 }}>
            <div className="dlg-in" style={{ color: T.modSub?.color || "#9A8060", fontSize: T.modSub?.fontSize || 13, marginBottom:8, fontStyle:"italic", display:"flex", alignItems:"flex-start", gap:6 }}><span style={{ flexShrink:0, marginTop:2 }}>{MOD_SVG["💬"](T.modSub?.color || "#9A8060", 13)}</span><span>{dialogue.steps[stepIdx].prompt}</span></div>
            {dialogue.steps[stepIdx].options.map((opt, oi) => {
              const isPicked = picked === oi;
              const isFading = picked !== null && !isPicked;
              return (
              <div key={oi}
                className={(picked === null ? "dlg-in " : "") + "dlg-opt" + (isFading ? " dlg-opt-out" : "") + (isPicked ? " dlg-opt-picked" : "")}
                onClick={() => choose(oi)} {...onActivate(() => choose(oi))}
                style={{ padding:"11px 14px", borderRadius:12, marginBottom:6,
                  background: isPicked ? `${dColor}26` : "rgba(255,255,255,0.04)",
                  border:`1px solid ${isPicked ? dColor + "AA" : dColor + "33"}`,
                  color: T.modTitle?.color || "#C8B898", fontSize: T.para?.fontSize || 14, lineHeight:1.6,
                  cursor: picked === null ? "pointer" : "default",
                  transition:"transform 0.3s cubic-bezier(0.22,1,0.36,1), background 0.25s ease, border-color 0.25s ease, opacity 0.3s ease",
                  animationDelay: picked === null ? `${0.12 + oi * 0.09}s` : "0s" }}>{opt.text}</div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} style={{ height:8 }} />
      </div>}



      {/* Result */}
      {done && (
        <div className="dlg-fade" style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>
          {/* Итог */}
          <div className="dlg-in" style={{ padding:"12px 14px 8px", borderTop:`1px solid ${dColor}22`, textAlign:"center", flexShrink:0 }}>
            <div style={{ fontSize:32, marginBottom:4 }}>{walkedOut ? "🚪" : MOOD_EMOJI_D[moodC-1]}</div>
            <div style={{ color: walkedOut ? "#E05858" : MOOD_COLORS_D[moodC-1], fontSize:15, fontWeight:"bold", marginBottom:2 }}>
              {walkedOut ? `${dialogue.guest.name} ушёл` : moodC>=4 ? `${dialogue.guest.name} в восторге` : moodC===3 ? `${dialogue.guest.name} в порядке` : `${dialogue.guest.name} не в духе`}
            </div>
            {pro && (() => { const den = choicesFaced || totalChoices; const stars = walkedOut ? 0 : (score===den && moodC>=4) ? 3 : (score>=Math.ceil(den*0.6) && moodC>=3) ? 2 : (score>0 ? 1 : 0); return (
              <div style={{ fontSize:17, letterSpacing:3, marginBottom:3 }}><span style={{ color:dColor }}>{"★".repeat(stars)}</span><span style={{ color:"rgba(255,255,255,0.15)" }}>{"★".repeat(3-stars)}</span></div>
            ); })()}
            <div style={{ color: T.modSub?.color || BROWN, fontSize:12, marginBottom:6 }}>{score} из {choicesFaced || totalChoices} правильных ответов</div>
            <div style={{ color:dColor, fontSize: T.modSub?.fontSize || 12, lineHeight:1.5, marginBottom:8, fontStyle:"italic" }}>
              ✦ {dialogue.steps.find(s=>s.type==="result")?.tip}
            </div>
          </div>
          {/* История диалога */}
          <div ref={recapRef} className="sa-dlgscroll" style={{ flex:1, overflowY:"auto", padding:"8px 14px 8px", display:"flex", flexDirection:"column", gap:6, borderTop:`1px solid ${dColor}11`, WebkitOverflowScrolling:"touch", overscrollBehavior:"contain" }}>
            {messages.map((msg, i) => {
              const dl = { animationDelay: `${Math.min(0.1 + i * 0.05, 0.7)}s` };
              if (msg.type === "action") return <div key={i} className="dlg-in" style={{ ...dl, textAlign:"center", color: T.para?.color || "#C8A870", fontSize:11, fontStyle:"italic", padding:"2px 0" }}>— {msg.text} —</div>;
              if (msg.type === "guest") return <div key={i} className="dlg-in dlg-in-left" style={{ ...dl, alignSelf:"flex-start", maxWidth:"80%", padding:"7px 11px", borderRadius:12, borderBottomLeftRadius:3, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color: T.para?.color || "#C8B898", fontSize:13, lineHeight:1.5 }}>{msg.text}</div>;
              if (msg.type === "waiter") return <div key={i} className="dlg-in dlg-in-right" style={{ ...dl, alignSelf:"flex-end", maxWidth:"80%", padding:"7px 11px", borderRadius:12, borderBottomRightRadius:3, background: msg.correct ? `${dColor}25` : "rgba(224,120,120,0.15)", border:`1px solid ${msg.correct ? dColor+"44" : "rgba(224,120,120,0.3)"}`, color: T.para?.color || CREAM, fontSize:13, lineHeight:1.5 }}>{msg.text}</div>;
              if (msg.type === "feedback") return <div key={i} className="dlg-in" style={{ ...dl, padding:"5px 10px", borderRadius:8, background: msg.correct ? "rgba(93,187,138,0.08)" : "rgba(224,120,120,0.08)", color: msg.correct ? "#2DBB6A" : "#E05858", fontSize:11, fontWeight:"bold", lineHeight:1.5 }}>{msg.correct ? "✓ " : "✗ "}{msg.text}</div>;
              if (msg.type === "hint") return <div key={i} className="dlg-in" style={{ ...dl, padding:"5px 10px", borderRadius:8, background: dColor+"12", color:dColor, fontSize:11, lineHeight:1.5 }}>💡 Лучше: {msg.text}</div>;
              return null;
            })}
          </div>
          {/* Кнопки */}
          <div style={{ padding:"10px 14px 14px", display:"flex", gap:10, flexShrink:0, borderTop:`1px solid ${dColor}22` }}>
            <button onClick={() => {
                let nextId = currentId;
                if (group.length > 1) {
                  const others = group.filter(d => d.id !== currentId);
                  nextId = others[Math.floor(Math.random() * others.length)].id;
                }
                const next = group.find(d => d.id === nextId) || dialogue;
                setCurrentId(nextId); dlgLastByTerm[dialogue.termKey] = nextId;
                setMessages([]); setStepIdx(0); setChosen(null); setPicked(null); setShuffleKey(k => k + 1); setScore(0); setChoicesFaced(0); setMood(next?.guest.mood || 3); setDone(false); setWalkedOut(false); runningRef.current=false;
              }}
              style={{ flex:1, padding:"12px", borderRadius:12, background:"transparent", border:`1px solid ${dColor}55`, color:dColor, fontSize:14, fontFamily:"Georgia, serif", cursor:"pointer" }}>
              ↺ Ещё раз
            </button>
            <button onClick={() => onClose(!walkedOut)}
              style={{ flex:1, padding:"12px", borderRadius:12, background:dColor, border:"none", color:"#fff", fontSize:14, fontFamily:"Georgia, serif", cursor:"pointer", fontWeight:"bold" }}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes achIconPulse { 0%,100%{box-shadow:0 0 24px rgba(200,160,80,0.4)} 50%{box-shadow:0 0 40px rgba(200,160,80,0.7)} }
    @keyframes dlgPulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
    @keyframes dlgOverlayIn { from{opacity:0} to{opacity:1;transition-duration:0.8s} }
    @keyframes dlgSheetIn { from{transform:translateY(100%)} to{transform:translateY(0)} }
    @keyframes dlgMsgIn { from{opacity:0; transform:translateY(12px) scale(0.97)} to{opacity:1; transform:translateY(0) scale(1)} }
    @keyframes dlgFadeIn { from{opacity:0} to{opacity:1} }
    .dlg-fade { animation: dlgFadeIn 0.5s ease both; }
    @keyframes dlgMsgInL { from{opacity:0; transform:translateX(-14px) translateY(6px)} to{opacity:1; transform:translateX(0) translateY(0)} }
    @keyframes dlgMsgInR { from{opacity:0; transform:translateX(14px) translateY(6px)} to{opacity:1; transform:translateX(0) translateY(0)} }
    .dlg-in { animation: dlgMsgIn 0.4s cubic-bezier(0.22,1,0.36,1) both; will-change: transform, opacity; }
    .dlg-in-left { animation-name: dlgMsgInL; }
    .dlg-in-right { animation-name: dlgMsgInR; }
    .dlg-opt:active { transform: scale(0.975); background: rgba(255,255,255,0.08) !important; }
    .dlg-opt-out { opacity: 0; transform: translateY(-6px) scale(0.97); pointer-events: none; }
    .dlg-opt-picked { transform: scale(1.02); pointer-events: none; }
    @media (prefers-reduced-motion: reduce) { .dlg-in { animation-duration: 0.01s; } }`}</style>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// #2 — Экзамен на роль и сертификат.
// Вопросы собираются прямо из квизов уроков роли (MODULES), поэтому новый
// контент автоматически попадает в экзамен — ничего захардкоженного.
// ─────────────────────────────────────────────────────────────────────────────
