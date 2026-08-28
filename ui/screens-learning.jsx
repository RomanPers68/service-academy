// ui/screens-learning.jsx
// Дом роли, модуль, урок, глоссарий, работа над ошибками.
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
import { LiveDialogue } from "./screens-dialogue";

export function MistakesScreen({ T, a11y, mistakeBank = [], onResolve, onFail, onBack }) {
  const gold = a11y ? "#8B6A30" : GOLD;
  const [idx, setIdx] = React.useState(0);
  const [pick, setPick] = React.useState(null);
  // Интервальное повторение: показываем только вопросы, у которых подошёл срок (due <= сейчас)
  const [nowTs] = React.useState(() => Date.now());
  const bank = React.useMemo(() => mistakeBank.filter(m => !m.due || m.due <= nowTs), [mistakeBank, nowTs]);
  const waiting = mistakeBank.length - bank.length; // закреплённые, ждут следующего интервала
  const weak = React.useMemo(() => {
    const m = {};
    bank.forEach(qq => { const k = qq.lessonTitle || "Без темы"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [bank]);

  // Перемешиваем варианты при каждом показе — чтобы не запоминалась позиция ответа.
  // Хук стоит до условных return (правила хуков); на пустом банке вернёт undefined — ниже не используется.
  const q = React.useMemo(() => shuffleQuizOptions(bank[Math.min(idx, bank.length - 1)]), [bank, idx]);

  const Head = (<div style={T.lessHead}><button style={T.backBtn2} onClick={onBack}>‹</button><div style={T.lessHeadTitle}>Работа над ошибками</div></div>);

  if (bank.length === 0) {
    const nextDue = mistakeBank.reduce((min, m) => (m.due && m.due > nowTs && (!min || m.due < min)) ? m.due : min, null);
    const nextStr = nextDue ? new Date(nextDue).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : null;
    return (
      <div style={T.screen}>
        {Head}
        <div style={{ textAlign: "center", padding: "60px 24px", color: T.modSub.color }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🎉</div>
          <div style={{ ...T.bold, marginBottom: 6 }}>{waiting > 0 ? "Всё повторено по расписанию" : "Ошибок нет"}</div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            {waiting > 0
              ? `${waiting} вопрос(ов) закрепляются по интервалам 1 → 3 → 7 → 30 дней. Следующее повторение — ${nextStr}.`
              : "Заваленные в тестах вопросы будут попадать сюда — прорешаешь их ещё раз и закрепишь."}
          </div>
        </div>
      </div>
    );
  }

  const answer = (i) => { if (pick !== null) return; setPick(i); vibrate(i === q.correct ? "light" : "error"); };
  const next = () => {
    const wasCorrect = pick === q.correct;
    setPick(null);
    if (wasCorrect) onResolve(q.q);
    else { if (onFail) onFail(q.q); setIdx(i => (i + 1) % bank.length); }
  };

  return (
    <div style={T.screen}>
      {Head}
      <div style={{ padding: "10px 18px 0" }}>
        <div style={{ ...T.secTitle, padding: "0 0 8px" }}>СЛАБЫЕ ТЕМЫ</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
          {weak.slice(0, 6).map(([name, n]) => (
            <div key={name} style={{ ...T.modSub, fontSize: 12, padding: "5px 10px", borderRadius: 10, border: `1px solid ${gold}55`, display: "flex", alignItems: "center", gap: 6 }}>
              <span>{name}</span><b style={{ color: gold }}>{n}</b>
            </div>
          ))}
        </div>
      </div>
      <div key={q.q} className="sa-cardpage-r" style={T.quizWrap}>
        <div style={T.quizProgress}>Сейчас на повторе: {bank.length} · этап закрепления {(q.stage || 0) + 1} из {5}{waiting > 0 ? ` · ${waiting} ждут своего дня` : ""}</div>
        {q.img && <img src={q.img} alt="" loading="lazy" decoding="async" style={{ width: "100%", maxHeight: 210, objectFit: "cover", borderRadius: 14, display: "block", margin: "0 0 14px" }} />}
        <div style={T.quizQ}>{q.q}</div>
        {q.options.map((opt, i) => {
          let st = { ...T.quizOpt, cursor: pick === null ? "pointer" : "default" };
          if (pick !== null) {
            if (i === q.correct) st = { ...st, background: "rgba(93,187,138,0.15)", border: "1px solid #5DBB8A" };
            else if (i === pick) st = { ...st, background: "rgba(224,120,120,0.15)", border: "1px solid #E07878" };
            else st = { ...st, opacity: 0.5 };
          }
          return <div key={i} className="sa-opt" style={st} onClick={() => answer(i)} {...onActivate(() => answer(i))}>{opt}</div>;
        })}
        {pick !== null && q.explanation && <div style={{ ...T.note, fontStyle: "normal", borderLeft: `2px solid ${gold}`, paddingLeft: 10, marginTop: 12 }}>{q.explanation}</div>}
        {pick !== null && <button className="sa-btn" style={{ ...T.doneBtn, background: gold, width: "100%", marginTop: 14 }} onClick={next}>{pick === q.correct ? "Верно — убрать ✓" : "Дальше →"}</button>}
      </div>
    </div>
  );
}

// Этап 1 — оценка времени: ~900 знаков в минуту чтения + надбавка за вопросы и практику
export const _estMins = (l) => Math.max(1, Math.round((((l.content || "").length) + ((l.questions || []).length * 250) + ((l.situations || []).length * 300)) / 900));
export const _fmtMins = (mins) => mins < 60 ? `${mins} мин` : `${Math.floor(mins / 60)} ч ${mins % 60 ? (mins % 60) + " мин" : ""}`.trim();

export function HomeScreen({ role, modules, completed, quizDone = {}, progress, doneCount, totalLessons, onModule, onChangeRole, T, streak = { count: 0, best: 0, last: "", days: [] }, a11y, profile, onChecklist, onOnboarding, onAnalytics, mistakeBank = [], onMistakes, customModules = [], onSearch }) {
  // Сколько минут осталось до конца программы (по незавершённым разделам)
  const leftMins = React.useMemo(() =>
    [...modules, ...customModules].reduce((s, m) =>
      s + (m.lessons || []).filter(l => l.type !== "result").reduce((a, l) =>
        a + ((l.type === "quiz" ? quizDone[l.id] : completed[l.id]) ? 0 : _estMins(l)), 0), 0),
    [modules, customModules, completed, quizDone]);
  return (
    <div style={T.screen} className="sa-screen">
      <div style={T.homeHead}>
        <div style={T.homeTopRow}>
          <div style={T.logoRow}><span style={{ color:role.color, fontSize:20 }}>✦</span><span style={T.logoText}>SERVICE ACADEMY</span></div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {onSearch && <button style={{ ...T.changeRoleBtn, display:"inline-flex", alignItems:"center", justifyContent:"center" }} onClick={onSearch} aria-label="Поиск">{GAME_SVG.search(a11y ? "#5a4a35" : "#c8b898", 15)}</button>}
            <button style={T.changeRoleBtn} onClick={onChangeRole}>Сменить</button>
          </div>
        </div>
        <div style={{ ...T.homeRoleBadge, background:role.color+"22", borderColor:role.color+"66" }}>
          <span style={{ display:"inline-flex", alignItems:"center" }}>{ROLE_SVG[role.id] ? ROLE_SVG[role.id](role.color, 18) : role.icon}</span>
          <span style={{ color:role.color, fontSize:15, fontWeight:"bold" }}>{role.label}</span>
          <span style={{ color:"#c8b898", fontSize:12 }}>{role.sublabel}</span>
          {role.beta && <span style={{ fontFamily:"monospace", fontSize:8.5, letterSpacing:1.6, padding:"2px 6px", borderRadius:999, color:role.color, border:`1px solid ${role.color}66`, opacity:0.85, lineHeight:1.4 }}>BETA</span>}
        </div>
      </div>
      <div style={T.progCard}>
        <div style={T.progTop}><span style={T.progLabel}>Прогресс</span><span style={{ ...T.progPct, color:role.color }}>{progress}%</span></div>
        <div style={T.progBar}><div style={{ ...T.progFill, width:`${progress}%`, background:role.color }} /></div>
        <div style={T.progSub}>{doneCount} из {totalLessons} разделов завершено{leftMins > 0 ? ` · осталось ≈ ${_fmtMins(leftMins)}` : " · программа пройдена 🎓"}</div>
      </div>
      <StreakCard streak={streak} a11y={a11y} />
      {mistakeBank.filter(m => !m.due || m.due <= Date.now()).length > 0 && onMistakes && (() => {
        const _g = a11y ? "#8B6A30" : GOLD;
        const _n = mistakeBank.filter(m => !m.due || m.due <= Date.now()).length;
        const _w = _n === 1 ? "вопрос" : (_n % 10 >= 2 && _n % 10 <= 4 && (_n % 100 < 10 || _n % 100 >= 20)) ? "вопроса" : "вопросов";
        return (
          <div onClick={onMistakes} {...onActivate(onMistakes)} style={{ ...T.modCard, margin:"0 14px 12px" }}>
            <div style={{ ...T.modBar, background:_g }} />
            <div style={T.modIcon}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={_g} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={T.modTitle}>Работа над ошибками</div>
              <div style={T.modSub}>{_n} {_w} на повтор</div>
            </div>
            <div style={T.modArrow}>{"\u203a"}</div>
          </div>
        );
      })()}
      <MoodCheckCard a11y={a11y} />
      {(["manager","senior"].includes(profile?.position) || profile?.is_admin) && <TeamMoodCard a11y={a11y} />}
      <div style={T.secTitle}>Программа обучения</div>
      <div style={T.modList} className="sa-stagger">
        {[...modules, ...customModules].map((m) => {
          const lessonsDone = m.lessons.filter(l => l.type !== "quiz" && l.type !== "result" && completed[l.id]).length;
          const quizzesDone = m.lessons.filter(l => l.type === "quiz" && quizDone[l.id]).length;
          const done = lessonsDone + quizzesDone;
          const total = m.lessons.filter(l => l.type !== "result").length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <div key={m.id} className="sa-card sa-glass" style={T.modCard} onClick={() => onModule(m)} {...onActivate(() => onModule(m))}>
              <div style={{ ...T.modBar, background:m.color }} />
              <div style={{ ...T.modIcon, display:"flex", alignItems:"center", justifyContent:"center" }}>{MOD_SVG[m.icon] ? MOD_SVG[m.icon](m.color, 28) : m.icon}</div>
              <div style={T.modInfo}>
                <div style={{ ...T.modTag, color:m.color }}>{m.tag} · ≈ {_fmtMins((m.lessons || []).filter(l => l.type !== "result").reduce((a, l) => a + _estMins(l), 0))}</div>
                <div style={T.modTitle}>{m.title}</div>
                <div style={T.modSub}>{m.subtitle}</div>
              </div>
              <div style={T.modRight}>
                <div style={{ color:pct===100?"#4CAF50":m.color, fontSize:13, fontWeight:"bold" }}>{pct===100?"✓":`${pct}%`}</div>
                <div style={T.modArrow}>›</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ModuleScreen({ mod, completed, quizDone = {}, onBack, onLesson, T }) {
  return (
    <div style={T.screen} className="sa-slide-r">
      <div style={{ ...T.modHead, background:`linear-gradient(160deg, ${mod.color}99 0%, rgba(44,33,22,0.95) 100%)` }}>
        <button style={T.backBtn} onClick={onBack}>‹ Назад</button>
        <div style={{ marginBottom:10, display:"flex" }}>{MOD_SVG[mod.icon] ? MOD_SVG[mod.icon](mod.color, 38) : mod.icon}</div>
        <div style={{ fontSize:11, letterSpacing:3, color:"rgba(255,255,255,0.6)", marginBottom:4, fontFamily:"monospace" }}>{mod.tag}</div>
        <div style={{ fontSize:23, fontWeight:"bold", color:"#fff", marginBottom:4 }}>{mod.title}</div>
        <div style={{ fontSize:14, color:"rgba(255,255,255,0.6)" }}>{mod.subtitle}</div>
      </div>
      <div style={T.lessList} className="sa-stagger">
        {mod.lessons.map((l,i) => {
          const done = l.type === "quiz" ? quizDone[l.id] : completed[l.id];
          const typeMap = { lesson:"Урок", quiz:"Тест", practice:"Практика" };
          const typeColor = { lesson:"#7C9E87", quiz:GOLD, practice:"#8B7BAB" };
          return (
            <div key={l.id} className="sa-card sa-glass" style={{ ...T.lessCard, opacity: 1 }} onClick={() => onLesson(l)} {...onActivate(() => onLesson(l))}>
              <div style={{ ...T.lessNum, background: done ? mod.color : "transparent", color: done ? "#fff" : l.type==="practice" ? "#A090C8" : l.type==="quiz" ? GOLD : l.type==="dialogue" ? "#7FB0A0" : l.type==="build" ? "#C89A6E" : (T.lessNumColor || "#C8B898"), fontSize: (l.type==="practice"||l.type==="quiz"||l.type==="dialogue"||l.type==="build") ? 16 : 13, fontWeight: T.lessNumColor ? "bold" : "normal", border: done ? "none" : l.type==="practice" ? "1.5px solid rgba(139,123,171,0.5)" : l.type==="quiz" ? "1.5px solid rgba(200,169,110,0.5)" : l.type==="dialogue" ? "1.5px solid rgba(127,176,160,0.5)" : l.type==="build" ? "1.5px solid rgba(200,154,110,0.5)" : (T.lessNumBorder || "1.5px solid rgba(200,185,152,0.35)") }}>
                {done ? "✓" : l.type==="practice" ? UI_SVG.gamepad("#A090C8", 15) : l.type==="quiz" ? UI_SVG.quiz(GOLD, 15) : l.type==="dialogue" ? UI_SVG.dialog("#7FB0A0", 15) : l.type==="build" ? UI_SVG.shaker("#C89A6E", 15) : i+1}
              </div>
              <div style={{ ...T.lessInfo, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                <div style={{ ...T.lessTitle, marginBottom:0, color: l.type==="practice" ? "#A090C8" : l.type==="quiz" ? GOLD : l.type==="dialogue" ? "#7FB0A0" : l.type==="build" ? "#C89A6E" : T.lessTitle.color }}>
                  {l.title}
                </div>
                {l.type === "lesson" && <div style={{ fontSize:10, letterSpacing:1, fontFamily:"monospace", color:typeColor[l.type], marginTop:2 }}>{typeMap[l.type]}</div>}
              </div>
              <div style={T.lessArrow}>{l.type==="quiz" && quizDone[l.id] ? UI_SVG.trophy(GOLD, 16) : l.type==="quiz" && completed[l.id] ? "✓" : "›"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Позиционирует всплывающее окошко у точки тапа: сначала пытается встать
// под словом, при нехватке места — над ним, и всегда остаётся в пределах
// экрана (отступ 16px). Без координат (клавиатура) — центр экрана.
function TapAnchored({ x, y, T, children }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ top: -9999, left: 16, ready: false, below: true, tailLeft: 24 });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = el.getBoundingClientRect();
    const hasTap = typeof x === "number" && typeof y === "number";
    const tapX = hasTap ? x : vw / 2;
    const tapY = hasTap ? y : vh / 2 - r.height / 2;
    let left = Math.min(Math.max(16, tapX - r.width / 2), Math.max(16, vw - r.width - 16));
    let below = true;
    let top = tapY + 16;                                        // под словом (+ место хвостику)
    if (top + r.height > vh - 16) { below = false; top = tapY - r.height - 16; } // над словом
    top = Math.min(Math.max(16, top), Math.max(16, vh - r.height - 16));
    // хвостик по горизонтали — ровно под точкой тапа, но не на скруглении карточки
    const tailLeft = Math.min(Math.max(18, tapX - left - 6), r.width - 32);
    setPos({ top, left, ready: true, below, tailLeft, hasTap });
  }, [x, y]);
  // Ромбик той же фактуры, что карточка; чуть плотнее фон — иначе на стыке
  // двоится блюр и виден шов. Две грани без рамки смотрят внутрь карточки.
  const a11y = !!T?.a11y;
  const tail = {
    position: "absolute", width: 13, height: 13, left: pos.tailLeft, zIndex: 1,
    clipPath: "polygon(0 0, 100% 0, 0 100%)", // только остриё, без внутренней половины
    background: a11y ? "rgba(255,252,244,0.85)" : "rgba(45,34,16,0.85)",
    border: `1px solid ${a11y ? "rgba(139,106,48,0.4)" : "rgba(200,169,110,0.35)"}`,
    borderRight: "none", borderBottom: "none",
    ...(pos.below
      ? { top: -7, transform: "rotate(45deg)", borderTopColor: a11y ? "rgba(139,106,48,0.55)" : "rgba(200,169,110,0.5)" }
      : { bottom: -7, transform: "rotate(225deg)" }),
  };
  return (
    <div ref={ref} style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1000,
      maxWidth: 440, width: "calc(100vw - 32px)",
      opacity: pos.ready ? 1 : 0 }}>
      {children}
      {pos.hasTap && <div style={tail} />}
    </div>
  );
}

export function LessonScreen({ lesson, color="#C8A96E", onBack, onComplete, quizState, onQuiz, practiceState, setPracticeState, onPracticeChoice, onPracticeNext, T }) {
  const nextBtnRef = React.useRef(null);
  const bodyRef = React.useRef(null);
  const [scrollPct, setScrollPct] = React.useState(0);
  const [termPopup, setTermPopup] = React.useState(null);
  const [dialogueScreen, setDialogueScreen] = React.useState(null); // dialogue id to show
  // ── Этап 3 — режим карточек: урок листается «экранами» вместо длинной ленты ──
  const [cardMode, setCardMode] = React.useState(() => { try { return localStorage.getItem("sa_lesson_cards") !== "0"; } catch (e) { return true; } });
  // Одноразовая подсказка про переключатель «карточки ↔ лента»
  const [modeHint, setModeHint] = React.useState(() => { try { return !localStorage.getItem("sa_mode_hint"); } catch (e) { return false; } });
  const dismissModeHint = React.useCallback(() => { setModeHint(false); try { localStorage.setItem("sa_mode_hint", "1"); } catch (e) {} }, []);
  React.useEffect(() => { if (!modeHint) return; const t = setTimeout(dismissModeHint, 7000); return () => clearTimeout(t); }, [modeHint, dismissModeHint]);
  const [cardIdx, setCardIdx] = React.useState(0);
  // Мгновенная обратная связь в тесте — по образцу «Работы над ошибками»:
  // выбранный вариант подсвечивается (и правильный тоже), затем автопереход.
  // Раньше тап молча перекидывал на следующий вопрос — тест был «слепым».
  const [reveal, setReveal] = React.useState(null);
  const revealTimer = React.useRef(null);
  React.useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);
  React.useEffect(() => { setReveal(null); }, [lesson.id]);
  const [cardDir, setCardDir] = React.useState("r"); // направление перелистывания для анимации
  const touchRef = React.useRef(null);
  React.useEffect(() => { setCardIdx(0); }, [lesson.id]);
  // Делим контент на смысловые карточки: новые начинаются на заголовках/стикерах,
  // лимит ~700 знаков, а короткие «хвосты» приклеиваются к предыдущей — мысль не обрывается
  const cards = React.useMemo(() => {
    const lines = (lesson.content || "").split("\n");
    const blocks = []; let cur = [];
    for (const ln of lines) { if (!ln.trim()) { if (cur.length) { blocks.push(cur); cur = []; } } else cur.push(ln); }
    if (cur.length) blocks.push(cur);
    const blockLen = (b) => b.join(" ").length;
    const isHeader = (b) => {
      const t = (b[0] || "").trim();
      if (t.startsWith("**") && t.endsWith("**")) return true;
      if (t.startsWith("[mm:")) return true;
      return /^[\p{Extended_Pictographic}\s\uFE0F\u200D]+$/u.test(t) && t.length <= 12;
    };
    const out = []; let acc = []; let len = 0;
    for (const b of blocks) {
      const L = blockLen(b);
      if (acc.length && (len + L > 700 || (isHeader(b) && len > 250))) { out.push(acc); acc = []; len = 0; }
      acc = acc.concat(acc.length ? [""] : [], b); len += L;
    }
    if (acc.length) out.push(acc);
    for (let i = out.length - 1; i > 0; i--) {
      if (out[i].join(" ").length < 140) { out[i - 1] = out[i - 1].concat([""], out[i]); out.splice(i, 1); }
    }
    if (out.length > 1 && out[0].join(" ").length < 140) { out[1] = out[0].concat([""], out[1]); out.splice(0, 1); }
    return out.length ? out : [lines];
  }, [lesson.content]);
  const goCard = React.useCallback((d) => {
    const n = Math.max(0, Math.min(cards.length - 1, cardIdx + d));
    if (n === cardIdx) return; // край — не дёргаемся и не вибрируем
    setCardDir(d > 0 ? "r" : "l");
    setCardIdx(n);
    vibrate("light");
  }, [cards.length, cardIdx]);
  const onCardTouchStart = (e) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onCardTouchEnd = (e) => {
    if (!cardMode || !touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    touchRef.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goCard(dx < 0 ? 1 : -1);
  };
  const handleScroll = React.useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const pct = el.scrollHeight <= el.clientHeight ? 100 : Math.min(100, Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100));
    setScrollPct(pct);
  }, []);

  // Предварительно разбиваем ВЕСЬ текст урока на строки с подсветкой — один раз
  // Это делается в useMemo и не пересчитывается при открытии попапа
  const processedLines = React.useMemo(() => {
    if (!lesson.content) return [];
    const terms = GLOSSARY.map(g => g.term);
    // Прод-находка владельца: «краш» (лёд из бара) подсвечивался ВНУТРИ
    // «Украшения» — \b не знает кириллицы. Границы слов вручную:
    // слева и справа не должно быть буквы (lookbehind/lookahead).
    const pattern = new RegExp(`(?<![а-яёa-z])(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![а-яёa-z])`, "gi");
    const seenTerms = new Set();
    return lesson.content.split("\n").map((line, lineIdx) => {
      // Нормализуем строку — убираем ** для bold и прочие маркеры чтобы совпадало с тем что рендерится
      const stripped = line.replace(MARKER_RE, "");
      const normalizedLine = stripped.startsWith("**") && stripped.endsWith("**") ? stripped.replace(/\*\*/g,"") : stripped;
      const parts = normalizedLine.split(pattern);
      if (parts.length === 1) return { lineIdx, parts: [{ text: normalizedLine, isPlain: true }] };
      return {
        lineIdx,
        parts: parts.map((part, partIdx) => {
          const g = GLOSSARY.find(g => g.term.toLowerCase() === part.toLowerCase());
          if (g) {
            const key = g.term.toLowerCase();
            if (seenTerms.has(key)) return { text: part, isPlain: true };
            seenTerms.add(key);
            return { text: part, isPlain: false, term: g };
          }
          return { text: part, isPlain: true };
        })
      };
    });
  }, [lesson.id]);

  // Рендер строки с подсветкой из предвычисленных данных
  const highlightTerms = React.useCallback((text) => {
    if (!text || typeof text !== "string") return <span>{text}</span>;
    // Ищем предвычисленную строку
    const lineData = processedLines.find(l =>
      l.parts.map(p => p.text).join("") === text
    );
    if (!lineData) return <span>{text}</span>;
    return (
      <span>
        {lineData.parts.map((part, idx) => {
          if (part.isPlain) return <span key={idx}>{part.text}</span>;
          return (
            <span key={idx}
              onClick={e => { e.stopPropagation(); setTermPopup({ term: part.term.term, def: part.term.def, x: e.clientX, y: e.clientY }); }}
              style={{ color, borderBottom:`1.5px dotted ${color}`, cursor:"pointer", fontWeight:"bold" }}>
              {part.text}
            </span>
          );
        })}
      </span>
    );
  }, [processedLines, color]);
  const wrappedPracticeChoice = React.useCallback((idx) => {
    onPracticeChoice(idx);
    setTimeout(() => { if (nextBtnRef.current) nextBtnRef.current.scrollIntoView({ behavior: "smooth", block: "end" }); }, 150);
  }, [onPracticeChoice]);
  if (lesson.type === "lesson") {
    return (
      <div style={{ ...T.screen, position: "relative" }}>
        <div style={T.lessHead}><button style={T.backBtn2} onClick={onBack}>‹</button><div style={T.lessHeadTitle}>{lesson.title}</div><button onClick={() => { dismissModeHint(); setCardIdx(0); setCardMode(v => { try { localStorage.setItem("sa_lesson_cards", v ? "0" : "1"); } catch (e) {} return !v; }); }} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px 10px", flexShrink: 0, display: "inline-flex", alignItems: "center", borderRadius: 12, animation: modeHint ? "pulse 2s infinite" : "none" }} aria-label={cardMode ? "Читать лентой" : "Читать карточками"}>{cardMode
          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
          : GAME_SVG.cards(color, 17)}</button></div>
        <div style={{ height:3, background: T.progBar?.background || "rgba(255,255,255,0.08)" }}><div style={{ height:3, width:`${cardMode ? Math.round(((cardIdx + 1) / cards.length) * 100) : scrollPct}%`, background:color, transition:"width 0.2s", borderRadius:2 }} /></div>
        {modeHint && (
          <div onClick={dismissModeHint} style={{ position: "absolute", top: 92, right: 10, zIndex: 30, maxWidth: 230, cursor: "pointer" }}>
            <div style={{ position: "absolute", top: -5, right: 16, width: 10, height: 10, transform: "rotate(45deg)", background: "rgba(46,34,14,0.97)", borderLeft: `1px solid ${GOLD}66`, borderTop: `1px solid ${GOLD}66` }} />
            <div style={{ background: "rgba(46,34,14,0.97)", border: `1px solid ${GOLD}66`, borderRadius: 12, padding: "9px 12px", boxShadow: "0 8px 22px rgba(0,0,0,0.5)" }}>
              <div style={{ color: GOLD, fontSize: 12, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>Карточки ↔ лента</div>
              <div style={{ color: "#BDB09A", fontSize: 11.5, lineHeight: 1.5, marginTop: 2 }}>Эта кнопка меняет вид урока. Твой выбор запомнится.</div>
            </div>
          </div>
        )}
        <div ref={bodyRef} key={cardMode ? "card" + cardIdx : "feed"} className={cardMode ? (cardDir === "l" ? "sa-cardpage-l" : "sa-cardpage-r") : undefined} onScroll={handleScroll} onTouchStart={onCardTouchStart} onTouchEnd={onCardTouchEnd} style={{ ...T.lessBody, padding:"12px 14px 44px" }}>
          {/* Стеклянная подложка для текста урока */}
          <div style={{
            background: T.lessGlass?.bg || "rgba(255,250,238,0.05)",
            border: T.lessGlass?.border || "1px solid rgba(150,112,42,0.38)",
            borderTop: T.lessGlass?.borderTop || "1px solid rgba(215,170,68,0.46)",
            borderRadius: 22,
            boxShadow: T.lessGlass?.shadow || "0 6px 22px rgba(0,0,0,0.50), 0 2px 0 rgba(200,160,60,0.18) inset, 0 -2px 4px rgba(0,0,0,0.38) inset",
            padding: "20px 18px",
            marginBottom: 16,
            position: "relative",
            backdropFilter: T.lessGlass?.blur || "none",
            WebkitBackdropFilter: T.lessGlass?.blur || "none",
          }}>
            {/* Верхний блик */}
            <div style={{ position:"absolute", top:0, left:0, right:0, height:"35%", borderRadius:"22px 22px 50% 50%", background: T.lessGlass?.glare || "linear-gradient(180deg, rgba(200,160,70,0.07) 0%, transparent 100%)", pointerEvents:"none" }} />
            {/* Левая грань */}
            <div style={{ position:"absolute", top:0, left:0, width:1, bottom:0, background: T.lessGlass?.edgeLeft || "linear-gradient(180deg, rgba(200,160,60,0.15) 0%, transparent 60%)", pointerEvents:"none" }} />
            {/* Нижняя тень */}
            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"20%", borderRadius:"0 0 22px 22px", background:"linear-gradient(0deg, rgba(0,0,0,0.12) 0%, transparent 100%)", pointerEvents:"none" }} />
            <div style={{ position:"relative", zIndex:1 }}>
          {/* Баннер живого диалога — если в уроке есть термин с диалогом */}
          {processedLines.some(l => l.parts.some(p => !p.isPlain && DIALOGUES_DATA.find(d => d.termKey === p.term?.term?.toLowerCase()))) && (
            <div style={{ background: T.modCard?.background || "rgba(255,250,238,0.05)", border:`1px solid ${color||GOLD}44`, borderTop:`1px solid ${color||GOLD}66`, borderRadius:18, padding:"14px 16px", marginBottom:18, boxShadow:`0 6px 22px rgba(0,0,0,0.45), 0 2px 0 ${color||GOLD}18 inset` }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                <div style={{ fontSize:28 }}>💬</div>
                <div style={{ flex:1 }}>
                  <div style={{ color: color || GOLD, fontSize: T.para?.fontSize || 15, fontWeight:"bold", fontFamily:"Georgia, serif" }}>В этом уроке есть живой диалог</div>
                </div>
              </div>
              <div style={{ color: T.modSub?.color || BROWN, fontSize: T.modSub?.fontSize || 13, lineHeight:1.6, fontFamily:"Georgia, serif" }}>
                Нажми на <span style={{ color: color||GOLD, borderBottom:`1.5px dotted ${color||GOLD}`, fontWeight:"bold" }}>выделенное слово</span> в тексте — и отработай навык в живом диалоге с гостем
              </div>
            </div>
          )}
          {(cardMode ? (cards[Math.min(cardIdx, cards.length - 1)] || []) : lesson.content.split("\n")).map((line,i) => {
            if (!line.trim()) return <div key={i} style={{ height:10 }} />;
            // Тег мимодзи [mm:name] — крупная иллюстрация по центру
            if (line.trim().startsWith("[mm:") && line.trim().endsWith("]")) {
              const id = line.trim().slice(4,-1);
              return <div key={i} style={{ textAlign:"center", margin:"16px 0 8px" }}><Mm id={id} size={130}/></div>;
            }
            // Строка только из эмодзи — отображается как крупный стикер
            if (/^[\p{Extended_Pictographic}\s\uFE0F\u200D]+$/u.test(line.trim()) && line.trim().length <= 12) {
              const one = (line.trim().match(/^\p{Extended_Pictographic}\uFE0F?/u) || [line.trim()])[0];
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12, margin:"14px 0 6px" }}>
                  <div style={{ flex:1, height:1, background:`linear-gradient(to right, transparent, ${color}55)` }} />
                  <span style={{ fontSize:24, lineHeight:1 }}>{one}</span>
                  <div style={{ flex:1, height:1, background:`linear-gradient(to left, transparent, ${color}55)` }} />
                </div>
              );
            }
            if (line.startsWith("**") && line.endsWith("**")) return <div key={i} style={T.bold}>{highlightTerms(line.replace(/\*\*/g,""))}</div>;
            if (line.startsWith("•")) return <div key={i} style={T.bullet}>{highlightTerms(line, T.bullet)}</div>;
            const markerRow = (style, iconEl) => (
              <div key={i} style={{ ...style, display:"flex", gap:9, alignItems:"flex-start" }}>
                <span style={{ flexShrink:0, marginTop:3, display:"inline-flex" }}>{iconEl}</span>
                <span style={{ flex:1 }}>{highlightTerms(line.replace(MARKER_RE, "").replace(/\*\*/g, ""))}</span>
              </div>
            );
            if (line.startsWith("☑")) return markerRow(T.check, UI_SVG.checkSquare(GOLD, 14));
            if (line.startsWith("🚫")) return markerRow(T.forbidden, UI_SVG.ban(RED, 14));
            if (line.startsWith("✅")) return markerRow(T.good, UI_SVG.checkCircle(GREEN, 14));
            if (line.startsWith("❌")) return markerRow(T.bad, UI_SVG.xCircle(RED, 14));
            if (line.startsWith("📌")) return markerRow(T.note, UI_SVG.pin(color, 14));
            const keycap = line.match(/^([1-9])️⃣/);
            if (keycap) return markerRow(T.principle,
              <span style={{ width:19, height:19, borderRadius:10, border:`1.5px solid ${color}`, color, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:10.5, fontWeight:"bold", fontFamily:"Georgia, serif" }}>{keycap[1]}</span>);
            const dotColor = { "🔵":"#5B8DD9", "🟢":GREEN, "🟡":"#D9C75B", "🟠":"#E0975B", "🔴":RED }[[...line][0]];
            if (dotColor) return markerRow(T.principle,
              <span style={{ width:9, height:9, borderRadius:5, background:dotColor, marginTop:3, boxShadow:`0 0 8px ${dotColor}55`, display:"inline-block" }} />);
            if (line.startsWith("🌟")) return markerRow(T.principle,
              <svg width="14" height="14" viewBox="0 0 24 24" fill={GOLD} stroke={GOLD} strokeWidth="1" strokeLinejoin="round" style={{ marginTop:1 }}><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8z"/></svg>);
            if (line.startsWith("🔹")) return markerRow(T.principle,
              <span style={{ width:8, height:8, background:"#5B8DD9", transform:"rotate(45deg)", borderRadius:1, marginTop:4, boxShadow:"0 0 6px #5B8DD955", display:"inline-block" }} />);
            if (line.startsWith("«") && line.includes("»")) return <div key={i} style={{ ...T.quote, borderLeftColor:color }}>{highlightTerms(line, T.quote)}</div>;
            return <div key={i} style={T.para}>{highlightTerms(line, T.para)}</div>;
          })}
            </div>{/* конец zIndex:1 */}
          </div>{/* конец стеклянной подложки */}
          {cardMode ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "0 0 6px", userSelect: "none" }}>
                <span onClick={() => goCard(-1)} {...onActivate(() => goCard(-1))} style={{ color, opacity: cardIdx === 0 ? 0.22 : 0.8, fontSize: 24, lineHeight: 1, padding: "2px 10px", cursor: "pointer" }}>‹</span>
                {cards.length <= 10
                  ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}>{cards.map((_, i) => (
                      <span key={i} style={{ width: i === cardIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === cardIdx ? color : color + "44", transition: "all .25s" }} />
                    ))}</div>
                  : <span style={{ color, fontSize: 12.5, fontFamily: "monospace", letterSpacing: 1 }}>{cardIdx + 1} / {cards.length}</span>}
                <span onClick={() => goCard(1)} {...onActivate(() => goCard(1))} style={{ color, opacity: cardIdx === cards.length - 1 ? 0.22 : 0.8, fontSize: 24, lineHeight: 1, padding: "2px 10px", cursor: "pointer" }}>›</span>
              </div>
              {cardIdx === 0 && cards.length > 1 && (
                <div style={{ textAlign: "center", color: T.modSub.color, fontSize: 12, fontStyle: "italic", opacity: 0.75, marginBottom: 8 }}>листай свайпом ← →</div>
              )}
              {cardIdx === cards.length - 1 && (
                <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background: color, width: "100%", marginTop: 6 }} onClick={onComplete}>Урок пройден ✓</button>
              )}
            </div>
          ) : (
            <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background:color }} onClick={onComplete}>Урок пройден ✓</button>
          )}
        </div>
        {/* Живой диалог — полноэкранный «экран» с автопрокруткой: он должен жить
            внутри контейнера приложения (в body его скролл гоняет всю страницу).
            Портал в body — только у поппапа термина ниже: ему нужен настоящий
            viewport из-за transform свайп-страниц. */}
        {dialogueScreen && createPortal(
          <LiveDialogue dialogueId={dialogueScreen} T={T} onClose={() => setDialogueScreen(null)} color={color} />
        , document.body)}
        {termPopup && createPortal(
          <div onClick={() => setTermPopup(null)} {...onActivate(() => setTermPopup(null))}
            style={{ position:"fixed", inset:0, background:"transparent", zIndex:999 }}>
            <TapAnchored x={termPopup.x} y={termPopup.y} T={T}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: T.termPopupBg || "rgba(20,14,6,0.45)", borderRadius:20, padding:"20px 20px 24px", width:"100%", boxSizing:"border-box",
                border:`1px solid ${color}55`, borderTop:`1px solid ${color}77`,
                backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)",
                boxShadow:`inset 0 0 20px ${T.a11y ? "rgba(255,255,255,0.5)" : "rgba(255,248,230,0.07)"}, inset 0 1px 0 ${T.a11y ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.12)"}, 0 8px 32px rgba(0,0,0,0.4)` }}>
              <div style={{ color, fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:17, marginBottom:10 }}>
                <span style={{ display:"inline-flex", verticalAlign:"-2px", marginRight:7 }}>{UI_SVG.book(color, 16)}</span>{termPopup.term}
              </div>
              <div style={{ color: T.a11y ? "#3A2E1C" : "#E8DCC4", fontSize:15, lineHeight:1.7, fontFamily:"Georgia, serif" }}>
                {termPopup.def}
              </div>
              {DIALOGUES_DATA.find(d => d.termKey === termPopup.term.toLowerCase()) && (
                <div onClick={() => { setDialogueScreen(DIALOGUES_DATA.find(d => d.termKey === termPopup.term.toLowerCase()).id); setTermPopup(null); }} {...onActivate(() => { setDialogueScreen(DIALOGUES_DATA.find(d => d.termKey === termPopup.term.toLowerCase()).id); setTermPopup(null); })}
                  style={{ marginTop:14, padding:"11px 16px", borderRadius:12, background:color, cursor:"pointer",
                    textAlign:"center", color:"#fff", fontSize:14, fontFamily:"Georgia, serif", fontWeight:"bold" }}>
                  Отработать на практике →
                </div>
              )}
              <div onClick={() => setTermPopup(null)} {...onActivate(() => setTermPopup(null))}
                style={{ marginTop:10, textAlign:"center", color, fontSize:13, opacity:0.6, cursor:"pointer", fontFamily:"Georgia, serif" }}>
                Закрыть ✕
              </div>
            </div>
            </TapAnchored>
          </div>
        , document.body)}
      </div>
    );
  }

  if (lesson.type === "practice") {
    const situations = practiceState.situations.length > 0
      ? practiceState.situations
      : pickRandom(lesson.situations || [], 6);

    // ── ФИНАЛЬНЫЙ ЭКРАН ──────────────────────────────────────
    if (practiceState.done) {
      const correct = practiceState.results.filter(Boolean).length;
      const total = situations.length;
      const stars = practiceState.score >= 60 ? 3 : practiceState.score >= 30 ? 2 : 1;
      const restartGame = () => {
        const pool = lesson.situations || [];
        // Берём ключи уже показанных сценариев
        const shownKeys = new Set(practiceState.usedIds || []);
        // Сначала берём те что ещё не показывали
        const fresh = pool.filter(s => {
          const k = s.scene || s.statement || s.question || JSON.stringify(s).slice(0,60);
          return !shownKeys.has(k);
        });
        // Если свежих хватает — берём только их, иначе добираем из показанных
        const sourcePool = fresh.length >= 6 ? fresh : pool;
        const shuffled = pickRandom([...sourcePool], 6).map(shuffleSituationOptions);
        // Запоминаем новые показанные ключи
        const newUsedIds = [...shownKeys];
        shuffled.forEach(s => {
          const k = s.scene || s.statement || s.question || JSON.stringify(s).slice(0,60);
          if (!newUsedIds.includes(k)) newUsedIds.push(k);
        });
        // Если показали уже всё — сбрасываем историю
        const finalUsedIds = newUsedIds.length >= pool.length ? [] : newUsedIds;
        setPracticeState({ step:0, choice:null, results:[], done:false, lives:3, score:0, combo:0, situations:shuffled, flash:null, timerActive:false, timeLeft:10, inputVal:"", usedIds:finalUsedIds });
        setGameKey(k => k+1);
      };
      return (
        <div style={T.screen} className="sa-screen">
          <div style={T.lessHead}>
            <button style={T.backBtn2} onClick={onBack}>‹</button>
            <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>{UI_SVG.gamepad(color, 18)}<span>Результат раунда</span></div>
          </div>
          <div style={{ flex:1, padding:"20px 18px 40px", overflowY:"auto" }}>
            <div style={{ textAlign:"center", marginBottom:20 }} className="sa-pop">
              <div style={{ fontSize:56, marginBottom:6, letterSpacing:6 }}>
                {[1,2,3].map(s => <span key={s} style={{ opacity:s<=stars?1:0.2, filter:s<=stars?"none":"grayscale(1)", transition:"opacity 0.3s, filter 0.3s" }}>⭐</span>)}
              </div>
              <div style={{ color:color, fontSize:40, fontWeight:"bold", marginBottom:4 }}>{practiceState.score}</div>
              <div style={{ color:T.modSub.color, fontSize:13, marginBottom:4 }}>очков</div>
              <div style={{ color:T.para.color, fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                {stars===3 ? UI_SVG.trophy(GOLD, 16) : stars===2 ? ROLE_SVG.core(GOLD, 16) : UI_SVG.book(GOLD, 16)}
                <span>{stars===3?"Мастер сервиса!":stars===2?"Хороший результат!":"Тренируйся ещё!"}</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {[{l:"Правильно",v:`${correct}/${total}`,c:GREEN},{l:"Жизни",v:`${practiceState.lives}❤️`,c:RED},{l:"Очков",v:practiceState.score,c:color}].map((s,i)=>(
                <div key={i} style={{ flex:1, background:T.simOpt.background, borderRadius:14, padding:"10px 6px", textAlign:"center", border:`2px solid ${T.simOpt.border}` }}>
                  <div style={{ color:s.c, fontSize:18, fontWeight:"bold" }}>{s.v}</div>
                  <div style={{ color:T.modSub.color, fontSize:10, marginTop:2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:14 }}>
              {situations.map((s,i) => practiceState.results[i]!==undefined && (
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 12px", background:practiceState.results[i]?"rgba(93,187,138,0.1)":"rgba(224,120,120,0.1)", borderRadius:12, marginBottom:6, border:`1px solid ${practiceState.results[i]?"#5DBB8A44":"#E0787844"}` }}>
                  <div style={{ flexShrink:0, display:"flex", marginTop:1 }}>{practiceState.results[i] ? UI_SVG.checkCircle(GREEN, 16) : UI_SVG.xCircle(RED, 16)}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:T.modTitle.color, fontSize:12 }}>{s.emoji} {((t)=>t.length>45?t.slice(0,45)+"…":t)(s.scene||s.statement||"")}</div>
                    <div style={{ color:practiceState.results[i]?GREEN:RED, fontSize:11, marginTop:1 }}>{((t)=>t.length>55?t.slice(0,55)+"…":t)((practiceState.results[i]?s.win:s.fail)||"")}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)", color:T.para.color, marginTop:0, marginBottom:10 }} onClick={restartGame}>
              🔄 Сыграть ещё раз
            </button>
            <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background:color, marginTop:0 }} onClick={onComplete}>
              Продолжить →
            </button>
          </div>
        </div>
      );
    }

    // ── ИГРОВОЙ ЭКРАН ────────────────────────────────────────
    const sit = situations[practiceState.step] || situations[0];
    if (!sit) return null;
    const answered = practiceState.isAnswered === true;
    const isCorrectAnswer = answered && practiceState.choice === sit.correct;
    const neutralBC = T.simOpt.border ? (T.simOpt.border.split(" ").pop()) : "#4A3525";
    const genre = sit.genre || sit.type || "action";

    // Метаданные жанра
    const genreMeta = {
      action:   { label:"ЧТО ДЕЛАЕШЬ?",   gicon:"clap",   color:GREEN },
      find:     { label:"НАЙДИ ОШИБКУ",   gicon:"search", color:GOLD_SOFT },
      timer:    { label:"БЫСТРЫЙ ВЫБОР",  gicon:"bolt",   color:RED },
      truefalse:{ label:"ВЕРНО / НЕВЕРНО", gicon:"cards",  color:"#8B7BAB" },
      complete: { label:"СОБЕРИ ПРАВИЛО",  gicon:"link",   color:"#7B8FAB" },
      empathy:  { label:"РОЛЬ ГОСТЯ",     gicon:"mask",   color:GOLD },
    };
    const gm = genreMeta[genre] || genreMeta.action;
    const sayPhrase = sit.say || ((genre === "action" || genre === "empathy") && sit.options ? sit.options[sit.correct] : null);

    return (
      <div style={{ ...T.screen }} className="sa-screen">
        {/* ── ШАПКа ── */}
        <div style={{ padding:"44px 18px 10px", background:"transparent" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <button style={T.backBtn2} onClick={onBack}>‹</button>
            <div style={{ display:"flex", gap:3 }}>
              {[1,2,3].map(h=><span key={h} style={{ fontSize:16, opacity:h<=practiceState.lives?1:0.2, transition:"opacity 0.3s" }}>❤️</span>)}
            </div>
            <div style={{ background:"rgba(212,168,90,0.2)", borderRadius:20, padding:"4px 12px", border:"1px solid rgba(212,168,90,0.4)" }}>
              <span style={{ color:GOLD_SOFT, fontSize:13, fontWeight:"bold" }}>⭐ {practiceState.score}</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:3 }}>
            {situations.map((_,i)=>(
              <div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<practiceState.step?GREEN:i===practiceState.step?color:"rgba(200,169,110,0.18)", transition:"background 0.3s" }} />
            ))}
          </div>
        </div>

        <div id="practice-scroll" key={practiceState.step} style={{ flex:1, padding:"10px 18px 32px", overflowY:"auto" }}>
          {/* Комбо */}
          {practiceState.combo>=2 && (
            <div style={{ textAlign:"center", marginBottom:8 }} className="sa-fast">
              <span style={{ background:`linear-gradient(135deg,#D4A85A,#E8C070)`, borderRadius:20, padding:"3px 14px", fontSize:11, fontWeight:"bold", color:"#fff" }}>
                🔥 КОМБО x{practiceState.combo}! +20
              </span>
            </div>
          )}

          {/* Жанр-бейдж */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <span style={{ background:`${gm.color}22`, borderRadius:20, padding:"3px 12px", fontSize:10, fontFamily:"monospace", letterSpacing:1, color:gm.color, border:`1px solid ${gm.color}44`, display:"inline-flex", alignItems:"center", gap:5 }}>
              {gm.gicon === "bolt" ? MOD_SVG["⚡"](gm.color, 11) : gm.gicon === "link" ? MOD_SVG["🔗"](gm.color, 11) : GAME_SVG[gm.gicon] ? GAME_SVG[gm.gicon](gm.color, 11) : null}{gm.label}
            </span>
            <span style={{ color:T.modSub.color, fontSize:11, fontFamily:"monospace" }}>{practiceState.step+1}/{situations.length}</span>
          </div>

          {/* Эмодзи */}
          <div style={{ fontSize:42, textAlign:"center", marginBottom:10 }} className="sa-pop">{sit.emoji}</div>

          {/* ── ЖАНР: TRUE/FALSE ── */}
          {genre==="truefalse" && (
            <>
              <div style={{ background: T.a11y ? "rgba(250,242,222,0.55)" : "rgba(255,250,238,0.05)", borderRadius:16, padding:"16px", marginBottom:14, border: T.a11y ? "1px solid rgba(139,106,48,0.3)" : "1px solid rgba(255,255,255,0.13)", boxShadow: T.a11y ? "inset 0 0 18px rgba(255,250,235,0.5)" : "inset 0 0 18px rgba(255,248,230,0.06), inset 0 1px 0 rgba(255,255,255,0.1)" }}>
                <div style={{ color:T.modSub.color, fontSize:10, letterSpacing:2, fontFamily:"monospace", marginBottom:6 }}>УТВЕРЖДЕНИЕ</div>
                <div style={{ color:T.para.color, fontSize:15, lineHeight:1.7, fontStyle:"italic" }}>«{sit.statement}»</div>
              </div>
              <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                {[{label:"Верно",gicon:"check",val:true,bg:"rgba(93,187,138,0.15)",bc:GREEN},{label:"Неверно",gicon:"x",val:false,bg:"rgba(224,120,120,0.15)",bc:RED}].map((btn,i)=>{
                  const chosen = answered && practiceState.choice===i;
                  const isRight = (btn.val===sit.isTrue) === (i===sit.correct);
                  const userWrong = answered && practiceState.choice!==sit.correct;
                  let bg = answered?(chosen&&i===sit.correct?"rgba(93,187,138,0.25)":chosen&&i!==sit.correct?"rgba(224,120,120,0.25)":!chosen&&i===sit.correct&&userWrong?"rgba(93,187,138,0.12)":T.simOpt.background):T.simOpt.background;
                  let bc = answered?(chosen&&i===sit.correct?GREEN:chosen&&i!==sit.correct?RED:!chosen&&i===sit.correct&&userWrong?GREEN:neutralBC):neutralBC;
                  return (
                    <div key={i} className="sa-opt" onClick={()=>!answered&&wrappedPracticeChoice(i)} {...onActivate(()=>!answered&&wrappedPracticeChoice(i))}
                      style={{ flex:1, background:bg, border:`2px solid ${bc}`, borderRadius:16, padding:"16px 10px", textAlign:"center", color:T.para.color, fontSize:16, fontWeight:"bold", cursor:answered?"default":"pointer", transition:"background 0.2s, border-color 0.2s, color 0.2s" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7 }}>{btn.gicon === "check" ? UI_SVG.checkCircle(btn.bc, 16) : UI_SVG.xCircle(btn.bc, 16)}{btn.label}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── ЖАНР: COMPLETE (собери правило) ── */}
          {genre==="complete" && (
            <>
              <div style={{ ...T.simScen, borderRadius:16, padding:"14px", marginBottom:14 }}>
                <div style={{ color:T.modSub.color, fontSize:10, letterSpacing:2, fontFamily:"monospace", marginBottom:6 }}>НАЧАЛО ПРАВИЛА</div>
                <div style={{ color:T.para.color, fontSize:15, lineHeight:1.7 }}>{sit.start} <span style={{ color:gm.color }}>___?</span></div>
              </div>
              <div style={{ color:T.bold.color, fontSize:14, fontWeight:"bold", marginBottom:10 }}>Выбери правильное продолжение:</div>
              {sit.options.map((opt,i)=>{
                const chosen = practiceState.choice===i;
                const isCorr = i===sit.correct;
                let bg = T.simOpt.background;
                let bc = neutralBC;
                let tc = T.simOpt.color;
                if(answered){if(chosen&&isCorr){bg="rgba(93,187,138,0.2)";bc="#5DBB8A";tc="#5DBB8A";}else if(chosen&&!isCorr){bg="rgba(224,120,120,0.2)";bc="#E07878";tc="#E07878";}else if(!chosen&&isCorr&&practiceState.choice!==sit.correct){bg="rgba(93,187,138,0.1)";bc="#5DBB8A";tc="#5DBB8A";}}
                return <div key={i} className="sa-opt" onClick={()=>!answered&&wrappedPracticeChoice(i)} {...onActivate(()=>!answered&&wrappedPracticeChoice(i))} style={{ ...T.simOpt, background:bg, border:`2px solid ${bc}`, borderRadius:13, padding:"12px 14px", marginBottom:8, color:tc, lineHeight:1.6, cursor:answered?"default":"pointer", transition:"background 0.2s, border-color 0.2s, color 0.2s" }}>{opt}</div>;
              })}
            </>
          )}

          {/* ── ЖАНР: EMPATHY (роль гостя) ── */}
          {genre==="empathy" && (
            <>
              <div className="sa-fast" style={{ ...T.simScen, background:"rgba(200,169,110,0.12)", borderRadius:16, padding:"14px", marginBottom:6, border:"1px solid rgba(200,169,110,0.25)" }}>
                <div style={{ color:GOLD_SOFT, fontSize:10, letterSpacing:2, fontFamily:"monospace", marginBottom:6, display:"flex", alignItems:"center", gap:6 }}>{GAME_SVG.thought(GOLD_SOFT, 13)}<span>МЫСЛИ ГОСТЯ</span></div>
                <div style={{ color:T.para.color, fontSize:14, lineHeight:1.7, fontStyle:"italic" }}>«{sit.guestThought}»</div>
              </div>
              <div className="sa-fast" style={{ ...T.simScen, borderRadius:14, padding:"12px", marginBottom:14, animationDelay:"0.08s" }}>
                <div style={{ color:T.modSub.color, fontSize:10, letterSpacing:2, fontFamily:"monospace", marginBottom:4 }}>СИТУАЦИЯ</div>
                <div style={{ color:T.para.color, fontSize:13, lineHeight:1.65 }}>{sit.scene}</div>
              </div>
              <div className="sa-fast" style={{ color:T.bold.color, fontSize:14, fontWeight:"bold", marginBottom:10, animationDelay:"0.14s" }}>{sit.question}</div>
              {sit.options.map((opt,i)=>{
                const chosen = practiceState.choice===i;
                const isCorr = i===sit.correct;
                let bg=T.simOpt.background,bc=neutralBC,tc=T.simOpt.color;
                if(answered){if(chosen&&isCorr){bg="rgba(93,187,138,0.2)";bc="#5DBB8A";tc="#5DBB8A";}else if(chosen&&!isCorr){bg="rgba(224,120,120,0.2)";bc="#E07878";tc="#E07878";}else if(!chosen&&isCorr&&practiceState.choice!==sit.correct){bg="rgba(93,187,138,0.1)";bc="#5DBB8A";tc="#5DBB8A";}}
                return <div key={i} className="sa-opt" onClick={()=>!answered&&wrappedPracticeChoice(i)} {...onActivate(()=>!answered&&wrappedPracticeChoice(i))} style={{ ...T.simOpt, background:bg, border:`2px solid ${bc}`, borderRadius:13, padding:"12px 14px", marginBottom:8, color:tc, lineHeight:1.6, cursor:answered?"default":"pointer", transition:"background 0.2s, border-color 0.2s, color 0.2s" }}>{opt}</div>;
              })}
            </>
          )}

          {/* ── ЖАНРЫ: ACTION / FIND / TIMER ── */}
          {(genre==="action"||genre==="find"||genre==="timer") && (
            <>
              <div className="sa-fast" style={{ ...T.simScen, borderRadius:16, padding:"14px", marginBottom:12 }}>
                {genre==="timer" && !answered && (
                  <TimerBar key={`timer-${practiceState.step}`} duration={12} color={color} onExpire={()=>wrappedPracticeChoice(-1)} />
                )}
                <div style={{ color:T.para.color, fontSize:14, lineHeight:1.75 }}>{sit.scene}</div>
              </div>
              <div className="sa-fast" style={{ color:T.bold.color, fontSize:15, fontWeight:"bold", marginBottom:12, animationDelay:"0.1s" }}>{sit.question}</div>
              {sit.options.map((opt,i)=>{
                const chosen = practiceState.choice===i;
                const isCorr = i===sit.correct;
                let bg=T.simOpt.background,bc=neutralBC,tc=T.simOpt.color,prefix="";
                if(answered){if(chosen&&isCorr){bg="rgba(93,187,138,0.2)";bc="#5DBB8A";tc="#5DBB8A";prefix="✅ ";}else if(chosen&&!isCorr){bg="rgba(224,120,120,0.2)";bc="#E07878";tc="#E07878";prefix="❌ ";}else if(!chosen&&isCorr&&practiceState.choice!==sit.correct){bg="rgba(93,187,138,0.1)";bc="#5DBB8A";tc="#5DBB8A";prefix="✅ ";}}
                return <div key={i} className="sa-opt" onClick={()=>!answered&&wrappedPracticeChoice(i)} {...onActivate(()=>!answered&&wrappedPracticeChoice(i))} style={{ ...T.simOpt, background:bg, border:`2px solid ${bc}`, borderRadius:13, padding:"12px 14px", marginBottom:8, color:tc, lineHeight:1.6, cursor:answered?"default":"pointer", transition:"background 0.2s, border-color 0.2s, color 0.2s", boxShadow:answered&&chosen&&isCorr?"0 0 12px rgba(93,187,138,0.25)":"none" }}>{prefix}{opt}</div>;
              })}
            </>
          )}

          {/* ── ФИДБЭК ── */}
          
          {answered && (
            <div className="sa-fast" style={{ marginTop:10 }}>
              <div style={{ background:isCorrectAnswer?"rgba(93,187,138,0.15)":"rgba(224,120,120,0.15)", border:`1.5px solid ${isCorrectAnswer?GREEN:RED}`, borderRadius:14, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ fontSize:18, marginBottom:4 }}>
                  {practiceState.choice===-1 ? <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>{GAME_SVG.clock(RED, 15)}Время вышло!</span> : isCorrectAnswer ? `🎉 +${practiceState.combo>=2?20:10} очков!` : `😬 −1 ❤️ (осталось ${practiceState.lives})`}
                </div>
                <div style={{ color:isCorrectAnswer?GREEN:RED, fontSize:13, lineHeight:1.6 }}>
                  {isCorrectAnswer ? sit.win : sit.fail||"Попробуй ещё раз в следующем раунде!"}
                </div>
              </div>
              {sayPhrase && <SayAloud phrase={sayPhrase} T={T} color={color} />}
              <button ref={nextBtnRef} className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background:color, marginTop:0 }} onClick={onPracticeNext}>
                {practiceState.step+1<situations.length?"Дальше →":<span style={{ display:"inline-flex", alignItems:"center", gap:7 }}>Финиш {GAME_SVG.flag("currentColor", 14)}</span>}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (lesson.type === "quiz") {
    if (quizState.done) {
      const score = quizState.answers.filter(a=>a.isCorrect).length;
      const qBank = lesson.questions || [];
      const allAnswers = quizState.answers.map((a,i) => ({ ...a, question:qBank[i] }));
      const wrongAnswers = allAnswers.filter(a=>!a.isCorrect);
      return (
        <div style={T.screen}>
          <div style={T.lessHead}><button style={T.backBtn2} onClick={onBack}>‹</button><div style={T.lessHeadTitle}>Результат теста</div></div>
          <div style={{ ...T.quizWrap, paddingBottom:40 }}>
            <div style={T.resultWrap}>
              <div className="sa-pop" style={{ ...T.resultCircle, borderColor:color }}>
                <span style={{ ...T.resultScore, color }}>{score}/{lesson.questions.length}</span>
                <span style={{ color:"#a09080", fontSize:12 }}>правильно</span>
              </div>
              <div style={T.resultTxt}>
                {quizState.blocked?"Тест завершён — много ошибок. Перечитай уроки и попробуй снова!":
                  score===lesson.questions.length?<span><Mm id="star_eyes" size={24} style={{marginRight:4}}/>Отлично! Всё верно</span>:
                  score>=lesson.questions.length*0.7?<span><Mm id="thumbs_up" size={24} style={{marginRight:4}}/>Хорошо! Есть над чем поработать</span>:<span><Mm id="pensive" size={24} style={{marginRight:4}}/>Нужно повторить материал</span>}
              </div>
            </div>
            {wrongAnswers.length > 0 && (
              <div>
                <div style={{ color, fontSize:14, fontWeight:"bold", letterSpacing:1, fontFamily:"monospace", marginBottom:12 }}>РАЗБОР ОШИБОК</div>
                {wrongAnswers.map((a,i) => (
                  <div key={i} style={{ background:T.progCard.background, borderRadius:14, padding:"14px 16px", marginBottom:12, border:`1px solid ${color}44` }}>
                    <div style={{ ...T.para, fontWeight:"bold", marginBottom:8 }}>{a.question.q}</div>
                    {a.question.img && <img src={a.question.img} alt="" loading="lazy" decoding="async" style={{ width:"100%", maxHeight:150, objectFit:"cover", borderRadius:10, display:"block", marginBottom:8 }} />}
                    <div style={{ ...T.bad, marginBottom:6, display:"flex", alignItems:"center", gap:8 }}><Mm id="thumbs_down" size={36}/> Твой ответ: {a.question.options[a.idx]}</div>
                    <div style={{ ...T.good, marginBottom:8, display:"flex", alignItems:"center", gap:8 }}><Mm id="thumbs_up" size={36}/> Правильно: {a.question.options[a.question.correct]}</div>
                    <div style={{ ...T.note, fontStyle:"normal", borderLeft:`2px solid ${color}`, paddingLeft:10 }}>{a.question.explanation}</div>
                  </div>
                ))}
              </div>
            )}
            {score >= lesson.questions.length * 0.7 && !quizState.blocked
              ? <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background:color, width:"100%", marginTop:8 }} onClick={onComplete}>Продолжить ✓</button>
              : <button className="sa-btn" style={{ ...T.doneBtn, background:"#555", width:"100%", marginTop:8 }} onClick={onBack}>← Вернуться к урокам</button>
            }
          </div>
        </div>
      );
    }
    const qBank2 = lesson.questions || [];
    const q = qBank2[quizState.step];
    const answered = quizState.answers[quizState.step];
    return (
      <div style={T.screen}>
        <div style={T.lessHead}><button style={T.backBtn2} onClick={onBack}>‹</button><div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="12" height="18" rx="2"/><path d="M8 8h4.5M8 12h3.5"/><path d="M13.2 17.4l6.2-6.2 2.2 2.2-6.2 6.2-2.7.5z"/></svg>
          <span>Тест</span></div></div>
        <div key={quizState.step} className="sa-cardpage-r" style={T.quizWrap}>
          <div style={T.quizProgress}>{quizState.step+1} / {lesson.questions.length}</div>
          {q.img && <img src={q.img} alt="" loading="lazy" decoding="async" style={{ width:"100%", maxHeight:210, objectFit:"cover", borderRadius:14, display:"block", margin:"0 0 14px" }} />}
          <div style={T.quizQ}>{q.q}</div>
          {q.options.map((opt,i) => {
            // Подсветка ровно как в «Работе над ошибками» — единый язык ответов
            let st = { ...T.quizOpt, cursor: reveal === null ? "pointer" : "default", transition:"background 0.2s, opacity 0.2s" };
            if (reveal !== null) {
              if (i === q.correct) st = { ...st, background:"rgba(93,187,138,0.15)", border:"1px solid #5DBB8A" };
              else if (i === reveal) st = { ...st, background:"rgba(224,120,120,0.15)", border:"1px solid #E07878" };
              else st = { ...st, opacity: 0.5 };
            }
            const pickIt = () => {
              if (reveal !== null) return;
              const ok = i === q.correct;
              setReveal(i);
              vibrate(ok ? "light" : "error");
              // Верный — короткая пауза держит темп; неверный — длиннее,
              // чтобы глаз успел увидеть правильный вариант.
              revealTimer.current = setTimeout(() => { setReveal(null); onQuiz(i); }, ok ? 600 : 1400);
            };
            return <div key={i} className="sa-opt" style={st} onClick={pickIt} {...onActivate(pickIt)}>{opt}</div>;
          })}
        </div>
      </div>
    );
  }
  return null;
}

export function GlossaryScreen({ T, onBack, color = "#C8A96E", a11y, saved = {}, onToggleFav = () => {}, onSetNote = () => {} }) {
  const [search, setSearch] = React.useState("");
  const [favOnly, setFavOnly] = React.useState(false);
  const [cat, setCat] = React.useState("Все"); // фильтр по разделу глоссария
  const [editingNote, setEditingNote] = React.useState(null); // ключ термина, чья заметка сейчас редактируется
  const cats = React.useMemo(() => ["Все", ...new Set(GLOSSARY.map(g => g.cat).filter(Boolean))], []);
  const isSaved = (term) => { const e = saved[term.toLowerCase()]; return !!(e && (e.fav || e.note)); };
  const filtered = GLOSSARY.filter(g => {
    const matchText = g.term.toLowerCase().includes(search.toLowerCase()) ||
      g.def.toLowerCase().includes(search.toLowerCase());
    return matchText && (!favOnly || isSaved(g.term)) && (cat === "Все" || g.cat === cat);
  });
  return (
    <div style={T.screen}>
      <div style={T.lessHead}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>{UI_SVG.book(color || GOLD, 18)}<span>Глоссарий</span></div>
      </div>
      <div style={{ ...T.lessBody, padding:"14px 16px 40px" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск термина..."
          style={{ width:"100%", padding:"10px 14px", borderRadius:12, border:`1px solid ${color}44`,
            background: T.modCard?.background || "rgba(255,255,255,0.05)",
            color: T.para?.color || CREAM, fontSize:15, fontFamily:"Georgia, serif",
            outline:"none", boxSizing:"border-box", marginBottom:12 }}
        />
        <div style={{ marginBottom:10 }}>
          <LiquidSegment a11y={a11y} equal={false} scroll accent={color}
            itemStyle={{ fontSize:12, padding:"7px 12px" }}
            items={cats.map(c => ({ id:c, label:c }))}
            activeId={cat}
            onSelect={setCat} />
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          <button onClick={() => setFavOnly(v => !v)} aria-pressed={favOnly}
            style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:20, cursor:"pointer",
              border:`1px solid ${color}${favOnly ? "" : "55"}`,
              background: favOnly ? color : "transparent",
              color: favOnly ? "#1A1008" : (T.para?.color || "#C8B898"),
              fontSize:13, fontFamily:"Georgia, serif", fontWeight:"bold", transition:"all 0.15s" }}>
            {favOnly ? "★" : "☆"} Только избранное
          </button>
        </div>
        {filtered.length === 0 && (
          <div style={{ ...T.para, textAlign:"center", opacity:0.5 }}>Ничего не найдено</div>
        )}
        {filtered.map((g, i) => {
          // Заголовок раздела — перед первым термином каждой категории
          const showCat = g.cat && (i === 0 || filtered[i - 1].cat !== g.cat);
          const catHeader = showCat && (
            <div key={"cat_" + g.cat} style={{ fontFamily:"monospace", color: color || GOLD, fontSize:10, letterSpacing:2.5, textTransform:"uppercase", margin: i === 0 ? "2px 2px 10px" : "22px 2px 10px", opacity:0.85, display:"flex", alignItems:"center", gap:8 }}>
              <span>{g.cat}</span>
              <span style={{ flex:1, height:1, background:`${color || GOLD}33` }} />
            </div>
          );
          const k = g.term.toLowerCase();
          const entry = saved[k] || {};
          const fav = !!entry.fav;
          const note = entry.note || "";
          return (
          <React.Fragment key={i}>
          {catHeader}
          <div style={{ ...T.modCard, marginBottom:10, padding:"12px 14px", borderRadius:14, flexDirection:"column", alignItems:"flex-start", gap:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, width:"100%" }}>
              <div style={{ color: a11y ? BROWN_GOLD : "#E8C87A", fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:15, flex:1 }}>{g.term}</div>
              <button onClick={() => onToggleFav(k)} aria-label={fav ? "Убрать из избранного" : "В избранное"} title={fav ? "Убрать из избранного" : "В избранное"}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, lineHeight:1, padding:"0 2px", color: fav ? color : (a11y ? "#9A8A6A" : "#6B5E48") }}>
                {fav ? "★" : "☆"}
              </button>
            </div>
            <div style={{ ...T.modSub, color: a11y ? "#3A2A0E" : "#C8B898", fontSize:14, lineHeight:1.6 }}>{g.def}</div>
            {/* Заметка: не обязательна — появляется только по кнопке */}
            {editingNote === k ? (
              <div style={{ width:"100%" }}>
                <textarea autoFocus value={note} onChange={e => onSetNote(k, e.target.value)} placeholder="Моя заметка..." rows={2}
                  style={{ width:"100%", marginTop:4, padding:"8px 10px", borderRadius:10, border:`1px solid ${color}55`,
                    background: T.modCard?.background || "rgba(255,255,255,0.04)", color: T.para?.color || "#F0E8D8",
                    fontSize:16, fontFamily:"Georgia, serif", lineHeight:1.5, outline:"none", boxSizing:"border-box", resize:"vertical" }} />
                <div style={{ display:"flex", justifyContent:"flex-end", gap:14, marginTop:6, width:"100%" }}>
                  {note && (
                    <button onClick={() => { onSetNote(k, ""); setEditingNote(null); }}
                      style={{ background:"none", border:"none", cursor:"pointer", color: a11y ? "#8A5A3A" : "#B07A6A", fontSize:13, fontFamily:"Georgia, serif", padding:"4px 2px" }}>
                      Удалить
                    </button>
                  )}
                  <button onClick={() => setEditingNote(null)}
                    style={{ background:"none", border:"none", cursor:"pointer", color: color || GOLD, fontSize:13, fontFamily:"Georgia, serif", fontWeight:"bold", padding:"4px 2px" }}>
                    Готово
                  </button>
                </div>
              </div>
            ) : note ? (
              <div onClick={() => setEditingNote(k)} {...onActivate(() => setEditingNote(k))}
                style={{ width:"100%", marginTop:4, padding:"8px 10px", borderRadius:10, border:`1px dashed ${color}44`,
                  color: T.para?.color || "#F0E8D8", fontSize:14, fontFamily:"Georgia, serif", lineHeight:1.5, cursor:"pointer", whiteSpace:"pre-wrap", boxSizing:"border-box" }}>
                <span style={{ display:"block", fontSize:10, letterSpacing:1, opacity:0.55, marginBottom:3 }}>✎ МОЯ ЗАМЕТКА</span>
                {note}
              </div>
            ) : (
              <button onClick={() => setEditingNote(k)}
                style={{ background:"none", border:"none", cursor:"pointer", color: `${color || GOLD}99`, fontSize:12.5, fontFamily:"Georgia, serif", padding:"2px 0", marginTop:2 }}>
                + Добавить заметку
              </button>
            )}
          </div>
          </React.Fragment>
          );
        })}
        <div style={{ ...T.para, textAlign:"center", opacity:0.4, fontSize:12, marginTop:8 }}>{GLOSSARY.length} терминов</div>
      </div>
    </div>
  );
}
