// ui/screens-roleselect.jsx
// Главный экран выбора роли и жетоны.
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
import { _estMins, _fmtMins } from "./screens-learning";

const _WAX_BLOB = "M12 1.9c2.3-.3 4.5.7 6.1 2.2 1.6 1.5 2.9 3.5 3.5 5.6.6 2.2.2 4.6-1 6.5-1.1 1.9-3 3.5-5.1 4.4-2.1.9-4.6 1-6.7.1-2.1-.8-3.9-2.5-5-4.5-1.1-2-1.5-4.4-.9-6.6C3.5 7.4 5 5.4 6.9 4 8.4 2.9 10.2 2.1 12 1.9Z";
const WaxSealMini = ({ size = 15, rot = 0 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${rot}deg)`, filter: "drop-shadow(0 1.2px 1.2px rgba(0,0,0,0.4))", flexShrink: 0 }}>
    <defs><radialGradient id="saWax" cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor="#C25538"/><stop offset="45%" stopColor="#96331F"/><stop offset="80%" stopColor="#6E2314"/><stop offset="100%" stopColor="#521708"/></radialGradient></defs>
    <path d={_WAX_BLOB} fill="url(#saWax)" /><circle cx="12" cy="12" r="7.2" fill="none" stroke="rgba(60,12,4,0.75)" strokeWidth="1.4" />
    <path d="M12 8.4l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="#F2D7B8" opacity="0.9" />
    <ellipse cx="8.6" cy="6.6" rx="3" ry="1.7" fill="rgba(255,235,210,0.28)" transform="rotate(-28 8.6 6.6)" />
  </svg>
);
const EmptySealSlot = ({ a11y }) => (
  <div style={{ width: 13, height: 13, borderRadius: "50%", flexShrink: 0, background: a11y ? "rgba(120,90,40,0.18)" : "rgba(0,0,0,0.28)", boxShadow: "inset 0 1.5px 3px rgba(0,0,0,0.35)" }} />
);
const TokenEyelet = () => (
  <div style={{ position: "absolute", top: 3, left: "50%", transform: "translateX(-50%)", width: 9, height: 9, borderRadius: "50%", zIndex: 2, background: "radial-gradient(circle at 35% 30%, #E8C87A, #8B6A30 70%)", boxShadow: "0 1px 2px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "rgba(20,14,6,0.8)", boxShadow: "inset 0 1px 1.5px rgba(0,0,0,0.8)" }} />
  </div>
);
// Оправы (проба золота): full — герой, mid — рабочие элементы
// «Морозный лёд»: оправа — светящаяся золотисто-белая кромка,
// уровень full — ярче (парадные витрины), mid — деликатнее (жетоны)
const saFrame = (a11y, level = "mid") => {
  // Демо-кромка .ice: ровная, один цвет для всех кнопок главной
  const k = level === "full" ? 1 : 0.85;
  return a11y ? `rgba(139,106,48,${0.30 * k})` : `rgba(255,255,255,${0.13 * k})`;
};
const saInner = (a11y) => a11y
  ? "rgba(250,242,222,0.60)"
  : "rgba(226,186,116,0.11)";
// Первый непройденный урок роли — для карточки «Твой трек»
const nextLessonOf = (mods = [], completed = {}, quizDone = {}) => {
  for (const m of mods) for (const l of (m.lessons || [])) {
    if (l.type === "result") continue;
    if (!(l.type === "quiz" ? quizDone[l.id] : completed[l.id])) return { lesson: l, mod: m };
  }
  return null;
};

// Профессии на главной: несколько ступеней одной профессии живут под одной плиткой.
// Роли, которых здесь нет (хостес, бар), показываются как раньше — отдельными карточками.
export const TRACK_GROUPS = [
  { id: "g-waiter",  label: "Официант", sublabel: "Зал и гости",      color: "#7C9E87", icon: "cloche",
    desc: "От базовых стандартов до роли наставника",   members: ["seasonal", "core"] },
  { id: "g-manager", label: "Менеджмент", sublabel: "Зал и команда", color: "#8B7BAB", icon: "target",
    desc: "От управления сменой до архитектуры сервиса", members: ["manager", "service_manager"] },
];

export function RoleSelect({ onSelect, T, a11y, onSchedule, onLeaderboard, onProfile, onStats, onDaily, onGlossary, role, profile, completedRoles = new Set(), onChecklist, onOnboarding, onAnalytics, onReference, onContentEditor, onCertificates, onMenuTrainer, onMentor, onGuestBook, onSOS, onAssistant, onCandidate, completed = {}, quizDone = {}, examResults = {}, mistakeBank = [], onContinueLesson, onMistakes }) {
  const isAdmin = !!profile?.is_admin;
  const [openGroup, setOpenGroup] = React.useState(null);
  const initials = profile ? `${profile.name[0]}${(profile.surname||"")[0]||""}`.toUpperCase() : "?";
  const ROLE_ORDER = ["seasonal", "core", "manager", "service_manager"];
  const position = profile?.position || "waiter";

  // Роли доступные сразу по должности (без прохождения)
  const baseUnlocked = new Set(["seasonal", "spg", "bar"]);
  if (isAdmin || position === "senior") {
    ROLE_ORDER.forEach(r => baseUnlocked.add(r));
  } else if (position === "manager") {
    baseUnlocked.add("core");
    baseUnlocked.add("manager");
  }

  // Добавляем разблокированные через прохождение
  const effectiveUnlocked = new Set([...baseUnlocked, ...completedRoles]);
  return (
    <div style={T.screen} className="sa-screen">
      <div style={{ ...T.roleHeader, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-60, left:-40, width:200, height:200, borderRadius:"50%", background:"radial-gradient(circle, #C8A96E22 0%, transparent 70%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:100, right:-60, width:180, height:180, borderRadius:"50%", background:"radial-gradient(circle, #7C9E8722 0%, transparent 70%)", pointerEvents:"none" }} />
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"20px 24px 10px" }}>
          <img src={LOGO_SRC_DARK /* тёмная версия читается на обеих темах;
                    если для светлой захочется LOGO_SRC — менять здесь */} alt="Service Academy" style={{ width:198, height:158, objectFit:"contain", display:"block", filter: a11y ? "none" : "brightness(0) saturate(100%) invert(95%) sepia(10%) saturate(400%) hue-rotate(340deg) brightness(98%)" }} />
        </div>
        {/* ═══ Приветствие по часам (профиль-карточка переехала в «Профиль») ═══ */}
        {profile && (() => {
          const h = new Date().getHours();
          const hello = h < 6 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
          return (
            <div style={{ padding:"2px 20px 12px", display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:10 }}>
              <div style={{ color: T.modTitle.color, fontSize:19, fontFamily:ACCENT_SERIF, minWidth:0 }}>
                {hello}, <span style={{ color: GOLD }}>{profile.name}</span>
                {onProfile && <span onClick={onProfile} {...onActivate(onProfile)} style={{ display:"inline-flex", verticalAlign:"-2px", marginLeft:8, cursor:"pointer", opacity:0.65 }}>{UI_SVG.pencil(T.modSub.color, 14)}</span>}
              </div>
              <div style={{ fontFamily:"monospace", color: T.modSub.color, fontSize:9, letterSpacing:1.5, textTransform:"uppercase", whiteSpace:"nowrap", flexShrink:0 }}>{profile.restaurant}</div>
            </div>
          );
        })()}

        {/* ═══ Карточка «Твой трек»: урок → ошибки → гость недели ═══ */}
        {role && onContinueLesson && (() => {
          const roleObj = ROLES.find(r => r.id === role);
          const mods = MODULES[role] || [];
          const next = nextLessonOf(mods, completed, quizDone);
          const dueM = mistakeBank.filter(m => !m.due || m.due <= Date.now()).length;
          const done = mods.reduce((a, m) => a + m.lessons.filter(l => l.type !== "result" && (l.type === "quiz" ? quizDone[l.id] : completed[l.id])).length, 0);
          const total = mods.reduce((a, m) => a + m.lessons.filter(l => l.type !== "result").length, 0);
          const prog = total ? Math.round((done / total) * 100) : 0;
          const RC = roleObj?.color || (a11y ? "#4E7A58" : "#8FB890"); // цвет роли
          const GRN = RC, GRN2 = RC;
          let title, sub, cta, go, gold = false;
          if (next && done === 0) {
            // ═══ Первый заход: «Начни здесь» + честная карта времени всего пути ═══
            const totalMins = mods.reduce((a, m) => a + (m.lessons || []).filter(l => l.type !== "result").reduce((s, l) => s + _estMins(l), 0), 0);
            title = "Начни здесь";
            sub = `«${next.lesson.title}» · весь путь ≈ ${_fmtMins(totalMins)}`;
            cta = "НАЧАТЬ"; go = () => onContinueLesson(next.lesson, next.mod);
          }
          else if (next) { title = `Твой трек · ${roleObj?.label || ""}`; sub = `Следующий: «${next.lesson.title}» · ≈ ${_estMins(next.lesson)} мин`; cta = "ДАЛЬШЕ"; go = () => onContinueLesson(next.lesson, next.mod); }
          else if (dueM > 0 && onMistakes) { const _d10 = dueM % 10, _d100 = dueM % 100; const _q = (_d10 === 1 && _d100 !== 11) ? "вопрос вернулся" : (_d10 >= 2 && _d10 <= 4 && (_d100 < 12 || _d100 > 14)) ? "вопроса вернулись" : "вопросов вернулись"; title = "Трек пройден · закрепи"; sub = `${dueM} ${_q} на повторение`; cta = "ОТВЕТИТЬ"; go = onMistakes; }
          else { title = "Путь пройден · держи форму"; sub = "Гость недели уже за столиком — испытание ждёт"; cta = "ПРИНЯТЬ"; go = onGuestBook; gold = true; }
          return (
            <div style={{ padding:"0 14px 9px" }}>
              <div onClick={go} {...onActivate(go)} style={{ borderRadius:16, background: saInner(a11y), border: `1px solid ${saFrame(a11y, "mid")}`, boxShadow: a11y ? "inset 0 0 22px rgba(255,255,255,0.5), 0 4px 12px rgba(120,85,25,0.18)" : "inset 0 0 22px rgba(255,248,230,0.07), 0 5px 16px rgba(0,0,0,0.45)", cursor:"pointer" }}>
                <div style={{ borderRadius:14.5, padding:"12px 13px", background: "transparent" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                    <div style={{ width:40, height:40, borderRadius:"50%", background: gold ? "rgba(200,169,110,0.13)" : `${RC}26`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {gold
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round"><path d="M7 11V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6"/><path d="M5.5 11h13a1.5 1.5 0 0 1 0 3h-13a1.5 1.5 0 0 1 0-3z"/><path d="M6.5 14v7M17.5 14v7"/></svg>
                        : (ROLE_SVG[role] ? ROLE_SVG[role](RC, 20) : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={RC} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21V9"/><path d="M12 9c0-3 2.5-5 6-5 0 3-2.5 5-6 5z"/><path d="M12 13c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/></svg>)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color: gold ? GOLD : GRN, fontSize:16, fontWeight:"bold", fontFamily:"Georgia, serif" }}>{title}</div>
                      <div style={{ color: T.modSub.color, fontSize:11.5, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sub}</div>
                    </div>
                    <div style={{ fontFamily:"monospace", flexShrink:0, fontSize:9, letterSpacing:1, color: "#14100A", background: gold ? `linear-gradient(135deg, ${GOLD_SOFT}, #8B6A30)` : RC, borderRadius:12, padding:"6px 11px" }}>{cta} ›</div>
                  </div>
                  {next && (
                    <div style={{ height:3.5, borderRadius:2, background: a11y ? "rgba(120,90,40,0.15)" : "rgba(255,255,255,0.07)", marginTop:9 }}>
                      <div style={{ width:`${prog}%`, height:"100%", borderRadius:2, background:`linear-gradient(90deg, ${GRN}, ${GRN2})` }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ Карточка «График»: ближайшая смена или где горит ═══ */}
        {(() => {
          const mgr = !!profile?.is_admin;
          return (
            <div style={{ padding: "0 14px 9px" }}>
            <div className="sa-card sa-glass" onClick={() => onSchedule && onSchedule()}
              {...onActivate(() => onSchedule && onSchedule())}
              style={{
                borderRadius: 16, padding: "12px 13px", cursor: "pointer",
                background: saInner(a11y), border: `1px solid ${saFrame(a11y, "mid")}`,
                boxShadow: a11y
                  ? "inset 0 0 22px rgba(255,255,255,0.5), 0 4px 12px rgba(120,85,25,0.18)"
                  : "inset 0 0 22px rgba(255,248,230,0.07), 0 5px 16px rgba(0,0,0,0.45)",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(200,169,110,0.13)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {UI_SVG.calendar ? UI_SVG.calendar(GOLD, 20) : <span style={{ fontSize: 17 }}>🗓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: a11y ? "#2A1F0E" : CREAM }}>
                    {mgr ? "График смен" : "Мой график"}
                  </div>
                  <div style={{ fontSize: 11.5, color: a11y ? "#6B5B40" : "#A2907A", marginTop: 1 }}>
                    {mgr ? "Составить, проверить и опубликовать" : "Смены, время и старший смены"}
                  </div>
                </div>
                <div style={{ fontFamily: "monospace", flexShrink: 0, fontSize: 9, letterSpacing: 1.4,
                  color: "#14100A", background: GOLD, borderRadius: 12, padding: "6px 11px" }}>ОТКРЫТЬ ›</div>
              </div>
            </div>
            </div>
          );
        })()}

        {/* ═══ Книга отзывов — слим-витрина: монограмма, печати, золотая нить ═══ */}
        {onGuestBook && profile && (() => {
          const bs = bookStats(MODULES, completed, quizDone, examResults);
          const unread = countUnreadPages(completed, quizDone, examResults);
          return (
            <div style={{ padding:"0 14px 9px" }}>
              <div onClick={onGuestBook} {...onActivate(onGuestBook)} style={{ position:"relative", borderRadius:15, background: saInner(a11y), border: `1px solid ${saFrame(a11y, "full")}`, boxShadow: a11y ? "inset 0 0 22px rgba(255,255,255,0.5), 0 4px 14px rgba(120,85,25,0.2)" : "inset 0 0 22px rgba(255,248,230,0.07), 0 6px 18px rgba(0,0,0,0.45)", cursor:"pointer" }}>
                {unread > 0 && (
                  <div style={{ position:"absolute", top:-6, right:10, zIndex:2, minWidth:18, height:18, borderRadius:9, padding:"0 5px",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background:"linear-gradient(135deg, #E8C983 0%, #C8A96E 55%, #8B6A30 100%)",
                    color:"#14100A", fontSize:10, fontWeight:"bold", fontFamily:"Georgia, serif", lineHeight:1,
                    border: a11y ? "1.5px solid #FBF5E8" : "1.5px solid #14100A",
                    boxShadow:"0 2px 8px rgba(0,0,0,0.35), 0 0 10px rgba(200,169,110,0.45)" }}>{unread}</div>
                )}
                <div style={{ overflow:"hidden", position:"relative", background: "transparent", borderRadius:13.5 }}>
                  {/* ляссе */}
                  <div style={{ position:"absolute", right:16, top:0, width:7, height:20, background:"linear-gradient(180deg, #8B3020, #5E1F12)", clipPath:"polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)" }} />
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px 8px" }}>
                    <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0, border:`1.2px solid ${GOLD}88`, background: a11y ? "rgba(139,106,48,0.10)" : "rgba(200,169,110,0.10)", display:"flex", alignItems:"center", justifyContent:"center", color: a11y ? "#8B6A30" : GOLD, fontSize:14, fontFamily:"Georgia, serif" }}>{(profile.name || "?")[0]}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"baseline", gap:7 }}>
                        <span style={{ color: T.modTitle.color, fontSize:14, fontWeight:"bold", fontFamily:"Georgia, serif", whiteSpace:"nowrap" }}>Книга отзывов</span>
                        <span style={{ fontFamily:"monospace", color: T.modSub.color, fontSize:8 }}>{bs.pages}/{bs.total}</span>
                      </div>
                      <div style={{ fontFamily:"monospace", color: T.modSub.color, fontSize:7.5, letterSpacing:2, marginTop:1, textTransform:"uppercase", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>ЛИЧНАЯ · {profile.name} · {bs.rank.label}</div>
                    </div>
                    <div style={{ display:"flex", gap:3.5, alignItems:"center", paddingRight:10, flexShrink:0 }}>
                      {Array.from({ length: bs.sealTotal || 5 }, (_, i) => i < bs.seals ? <WaxSealMini key={i} rot={[-8,6,-4,9,-6,4][i % 6]} /> : <EmptySealSlot key={i} a11y={a11y} />)}
                    </div>
                  </div>
                  <div style={{ height:2.5, background: a11y ? "rgba(120,90,40,0.18)" : "rgba(0,0,0,0.45)" }}>
                    <div style={{ width:`${bs.total ? Math.round((bs.pages / bs.total) * 100) : 0}%`, height:"100%", background:`linear-gradient(90deg, ${GOLD_SOFT}, ${GOLD})`, boxShadow:`0 0 6px ${GOLD}88` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {(() => {
          const Cc = moodPalette(a11y);
          const sosR = a11y ? "#A03828" : "#E07878";
          const tiles = [];
          // Плитки «Ассистент» больше нет: плавающая AI-кнопка и так на каждом
          // экране — два одинаковых входа на главной путали (замечание владельца)
          // Справочник — первым и с золотой оправой: раньше прятался седьмым
          // за горизонтом скролла, а он для всей команды
          if (onReference) tiles.push({ key:"sp", label:"Справочник", accent:true, onClick:onReference, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h6v17H6a2 2 0 0 0-2 2z"/><path d="M20 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 1 2 2z"/></svg>
          )});
          if (onCandidate) tiles.push({ key:"hire", label:"Собеседование", onClick:onCandidate, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M16 3.5a4 4 0 0 1 0 7"/><path d="M19 8h4M21 6v4"/></svg>
          )});
          if (onSOS) tiles.push({ key:"sos", label:"SOS", red:true, onClick:onSOS, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={sosR} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"/><path d="M12 8.5v4"/><path d="M12 15.6v.1"/></svg>
          )});
          if (onChecklist) tiles.push({ key:"cl", label:"Чек-листы", onClick:onChecklist, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v2H9z"/><path d="M8.5 12l2 2 3.5-3.5"/></svg>
          )});
          if (onOnboarding && (role === "seasonal" || ["manager","senior"].includes(profile?.position) || profile?.is_admin)) tiles.push({ key:"ob", label: role === "seasonal" ? "Первая неделя" : "Новички", onClick:onOnboarding, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-4 9 4-9 4-9-4z"/><path d="M7 11v4c0 1.4 2.5 2.4 5 2.4s5-1 5-2.4v-4"/></svg>
          )});
          if (onAnalytics && (["manager","senior"].includes(profile?.position) || profile?.is_admin)) tiles.push({ key:"an", label:"Аналитика", onClick:onAnalytics, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5v14h16"/><path d="M8 15l3-4 3 2 4-6"/></svg>
          )});
          if (onMenuTrainer) tiles.push({ key:"menu", label:"Меню", onClick:onMenuTrainer, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v7a2 2 0 0 0 2 2h0V3"/><path d="M11 3v18"/><path d="M7 12v9"/><path d="M17 3c-1.7 0-3 2.2-3 5s1.3 5 3 5v8"/></svg>
          )});
          if (onMentor && role) tiles.push({ key:"skill", label:"Допуск", onClick:onMentor, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z"/><path d="M9.5 12l1.8 1.8 3.2-3.3"/></svg>
          )});
          if (onCertificates) tiles.push({ key:"cert", label:"Сертификаты", onClick:onCertificates, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M9 12.8L8 22l4-2.2L16 22l-1-9.2"/></svg>
          )});
          if (onContentEditor && (["manager","senior"].includes(profile?.position) || profile?.is_admin)) tiles.push({ key:"ce", label:"Редактор", onClick:onContentEditor, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1z"/><path d="M14.5 6.5l3 3"/></svg>
          )});
          if (!tiles.length) return null;
          // ═══ Прогрессивное раскрытие: новичку без прогресса — только самое нужное.
          //     Остальные жетоны появляются после первого пройденного урока.
          //     Менеджеров, старших и админов это не касается. ═══
          const isStaff = ["manager", "senior"].includes(profile?.position) || profile?.is_admin;
          const anyDone = Object.keys(completed || {}).length > 0 || Object.keys(quizDone || {}).length > 0;
          const newbie = !isStaff && !anyDone;
          const visibleTiles = newbie ? tiles.filter(t => ["sos", "ob", "sp"].includes(t.key)) : tiles;
          // Бейджи-события: новинки меню (реальные данные)
          const menuNew = countNewDishes(profile?.restaurant);
          return (
            /* Инструменты — жетоны в золотой оправе с люверсами.
               Неполный последний ряд центрируется. */
            <>
            <div className="sa-hscroll sa-tilesrow" style={{ display:"flex", gap:7, padding:"0 16px 12px", overflowX:"auto",
                WebkitOverflowScrolling:"touch", scrollSnapType:"x proximity", scrollPaddingLeft:16, scrollPaddingRight:16, overscrollBehaviorX:"contain" }}>
              {visibleTiles.map(t => {
                const badge = t.key === "menu" && menuNew > 0 ? String(menuNew) : null;
                return (
                  <div key={t.key} onClick={t.onClick} {...onActivate(t.onClick)} style={{ flex:"0 0 auto", width:88, scrollSnapAlign:"start", boxSizing:"border-box", position:"relative", borderRadius:13, cursor:"pointer", WebkitTapHighlightColor:"transparent", background: saInner(a11y), border: t.accent ? `1.4px solid ${Cc.gold}` : `1px solid ${saFrame(a11y, "mid")}`, boxShadow: a11y ? "inset 0 0 18px rgba(255,255,255,0.45), 0 4px 12px rgba(120,85,25,0.18)" : "inset 0 0 18px rgba(255,248,230,0.06), 0 5px 16px rgba(0,0,0,0.45)" }}>
                    <div style={{ position:"relative", borderRadius:11.5, padding:"10px 2px 6px", display:"flex", flexDirection:"column", alignItems:"center", gap:4, overflow:"hidden", background: "transparent" }}>
                      <div style={{ position:"absolute", inset:0, background:`linear-gradient(118deg, transparent 30%, ${a11y ? "rgba(255,255,255,0.20)" : "rgba(255,245,220,0.05)"} 44%, transparent 58%)`, pointerEvents:"none" }} />
                      <TokenEyelet />
                      <div style={{ marginTop:4, position:"relative", display:"inline-flex" }}>{React.cloneElement(t.icon, { width:16, height:16 })}</div>
                      <span style={{ position:"relative", fontSize:8.5, color: t.red ? sosR : Cc.text, fontWeight:"bold", textAlign:"center", lineHeight:1.1, maxWidth:"100%", overflowWrap:"break-word", letterSpacing: t.red ? 1 : 0 }}>{t.label}</span>
                    </div>
                    {badge && <div style={{ position:"absolute", top:-5, right:-3, zIndex:3, background:`linear-gradient(135deg, ${GOLD_SOFT}, #8B6A30)`, color:"#1C1204", fontSize:8, fontWeight:"bold", fontFamily:"monospace", borderRadius:9, padding:"2px 6px", boxShadow:"0 2px 6px rgba(0,0,0,0.4)" }}>{badge}</div>}
                  </div>
                );
              })}
            </div>
            {newbie && (
              <div style={{ textAlign:"center", padding:"0 24px 12px", marginTop:-4 }}>
                <span style={{ color: T.modSub.color, fontSize:10.5, fontStyle:"italic" }}>✨ Остальные инструменты откроются после первого урока</span>
              </div>
            )}
            </>
          );
        })()}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0 20px 10px" }}>
          <div style={{ flex:1, height:"1px", background:"linear-gradient(to right, transparent, #D4A85A55, transparent)" }} />
          <span style={{ color:GOLD_SOFT, fontSize:14 }}>✦</span>
          <div style={{ flex:1, height:"1px", background:"linear-gradient(to left, transparent, #D4A85A55, transparent)" }} />
        </div>



        <div style={{ padding:"0 14px 8px", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ ...T.roleSubtitle }}>{role ? "Треки обучения" : "Выбери свою роль"}</div>
        </div>
      </div>

      <div style={T.roleList} className="sa-stagger">
        {(() => {
          // Профессия = одна плитка. Ступени раскрываются на месте, без нового экрана.
          const listGap = (T.roleList && T.roleList.gap) || 8;
          const groupOf = {};
          TRACK_GROUPS.forEach(g => g.members.forEach(m => { groupOf[m] = g; }));

          // Ступень внутри профессии: компактная строка на нити с номером.
          // Отличается от самостоятельного трека и высотой, и формой.
          const roleProgress = (rid) => {
            const mods = MODULES[rid] || [];
            const all = mods.flatMap(m => (m.lessons || []).filter(l => l.type !== "result"));
            if (!all.length) return 0;
            const done = all.filter(l => l.type === "quiz" ? quizDone[l.id] : completed[l.id]).length;
            return Math.round((done / all.length) * 100);
          };

          const renderStep = (r, nth) => {
            const isUnlocked = effectiveUnlocked.has(r.id);
            const pct = isUnlocked ? roleProgress(r.id) : 0;
            const cls = "sa-step" + (isUnlocked ? "" : " locked") + (pct === 100 ? " done" : "");
            const go = () => isUnlocked && onSelect(r.id);
            return (
              <div key={r.id} className={cls} onClick={go} {...onActivate(go)}>
                <span className="sa-stepnum">{pct === 100 ? "✓" : nth}</span>
                <span className="sa-steptext">
                  <b style={{ color: isUnlocked ? r.color : T.modSub.color }}>{r.label}</b>
                  <span>{isUnlocked ? r.sublabel : "Откроется после предыдущей ступени"}</span>
                </span>
                {isUnlocked
                  ? <span className="sa-steppct">{pct}%</span>
                  : <span style={{ display: "flex", alignItems: "center" }}>{ROLE_SVG.lock("rgba(255,255,255,0.28)", 15)}</span>}
              </div>
            );
          };

          const renderRole = (r, sub) => {
            const idx = ROLES.findIndex(x => x.id === r.id);
            const isUnlocked = effectiveUnlocked.has(r.id);
            const prevRole = ROLE_ORDER[idx - 1];
            const isNextUp = !isUnlocked && (idx === 0 || effectiveUnlocked.has(prevRole));
            return (
              <div key={r.id}
                className={isUnlocked ? "sa-card sa-glass" : "sa-card"}
                style={{
                  ...T.roleCard,
                  background: T.roleCard.background,
                  borderColor: isUnlocked ? r.color+"44" : "rgba(255,255,255,0.06)",
                  opacity: isUnlocked ? 1 : 0.45,
                  cursor: isUnlocked ? "pointer" : "default",
                  position: "relative", overflow:"hidden",
                  ...(sub ? { marginLeft: 22, borderRadius: 18 } : null),
                }}
                onClick={() => isUnlocked && onSelect(r.id)} {...onActivate(() => isUnlocked && onSelect(r.id))}
              >
                {isUnlocked && <div style={{ ...T.roleAccent, background: r.color }} />}
                <div style={{ ...T.roleIcon, background: isUnlocked ? r.color+"28" : "rgba(255,255,255,0.05)", borderRadius:"50%", boxShadow: isUnlocked ? `0 2px 8px ${r.color}44` : "none", filter: isUnlocked ? "none" : "grayscale(1)" }}>
                  {isUnlocked ? (ROLE_SVG[r.id] ? ROLE_SVG[r.id](r.color, 30) : r.icon) : ROLE_SVG.lock("#8A8070", 25)}
                </div>
                <div style={T.roleInfo}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <div style={{ ...T.roleLabel, color: isUnlocked ? r.color : T.modSub.color }}>{r.label}</div>
                    {r.beta && <span style={{ fontFamily:"monospace", fontSize:8.5, letterSpacing:1.6, padding:"2px 6px", borderRadius:999, color: isUnlocked ? r.color : T.modSub.color, border:`1px solid ${isUnlocked ? r.color : T.modSub.color}66`, opacity:0.85, lineHeight:1.4 }}>BETA</span>}
                  </div>
                  <div style={T.roleSublabel}>{r.sublabel}</div>
                  {isUnlocked
                    ? <div style={T.roleDesc}>{r.desc}</div>
                    : <div style={{ ...T.roleDesc, color: T.modSub.color, fontStyle:"italic" }}>
                        {isNextUp && idx > 0 ? `Пройди «${ROLES[idx-1].label}» чтобы открыть` : "Заблокировано"}
                      </div>
                  }
                </div>
                {isUnlocked
                  ? <div style={{ fontSize:20, color: r.color+"99", fontWeight:"bold" }}>›</div>
                  : <div style={{ display:"flex", alignItems:"center" }}>{ROLE_SVG.lock("rgba(255,255,255,0.28)", 17)}</div>
                }
              </div>
            );
          };

          const renderGroup = (g, members) => {
            const open = openGroup === g.id;
            const anyUnlocked = members.some(r => effectiveUnlocked.has(r.id));
            const ico = (UI_SVG[g.icon] || ROLE_SVG.manager);
            return (
              <div key={g.id}
                className={anyUnlocked ? "sa-card sa-glass" : "sa-card"}
                style={{
                  ...T.roleCard,
                  background: T.roleCard.background,
                  borderColor: anyUnlocked ? g.color+"44" : "rgba(255,255,255,0.06)",
                  opacity: anyUnlocked ? 1 : 0.45,
                  cursor: "pointer", position: "relative", overflow:"hidden",
                }}
                onClick={() => setOpenGroup(open ? null : g.id)} {...onActivate(() => setOpenGroup(open ? null : g.id))}
              >
                {anyUnlocked && <div style={{ ...T.roleAccent, background: g.color }} />}
                <div style={{ ...T.roleIcon, background: anyUnlocked ? g.color+"28" : "rgba(255,255,255,0.05)", borderRadius:"50%", boxShadow: anyUnlocked ? `0 2px 8px ${g.color}44` : "none", filter: anyUnlocked ? "none" : "grayscale(1)" }}>
                  {ico(anyUnlocked ? g.color : "#8A8070", 30)}
                </div>
                <div style={T.roleInfo}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <div style={{ ...T.roleLabel, color: anyUnlocked ? g.color : T.modSub.color }}>{g.label}</div>
                  </div>
                  <div style={T.roleSublabel}>{g.sublabel} · {members.length} ступени</div>
                  <div style={T.roleDesc}>{g.desc}</div>
                </div>
                <div style={{ fontSize:20, color: (anyUnlocked ? g.color : "#8A8070")+"99", fontWeight:"bold",
                  transition:"transform 0.62s cubic-bezier(0.25,0.8,0.25,1)", transform: open ? "rotate(90deg)" : "none" }}>›</div>
              </div>
            );
          };

          const out = [];
          const usedGroups = new Set();
          ROLES.forEach(r => {
            const g = groupOf[r.id];
            if (!g) { out.push(renderRole(r, false)); return; }
            if (usedGroups.has(g.id)) return;
            usedGroups.add(g.id);
            const members = g.members.map(id => ROLES.find(x => x.id === id)).filter(Boolean);
            out.push(renderGroup(g, members));
            // Контейнер есть всегда: при закрытой группе он нулевой высоты и
            // компенсирует gap списка отрицательным отступом.
            const open = openGroup === g.id;
            out.push(
              <div key={g.id + "-steps"} className={"sa-tracksub sa-branch" + (open ? " open" : "")}
                style={{ marginBottom: open ? 0 : -listGap }}>
                {members.map((m, k) => renderStep(m, k + 1))}
              </div>
            );
          });
          return out;
        })()}
      </div>

      {/* ═══ На подходе — анонсы новых треков и функций, стиль заблокированных ролей ═══ */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px 8px" }}>
        <div style={{ ...T.roleSubtitle }}>На подходе</div>
        <div style={{ flex:1, height:"1px", background:"linear-gradient(to right, #D4A85A33, transparent)" }} />
      </div>
      <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:8 }}>
        {[
          { key:"kitchen", label:"Кухня", sub:"Заготовки, техника, санитария, работа на раздаче", icon:(c)=>(
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 9a4 4 0 0 1 1-7.5A4.5 4.5 0 0 1 12 3a4.5 4.5 0 0 1 4-1.5A4 4 0 0 1 17 9v9H7V9z"/><path d="M7 15h10"/><path d="M7 18v3h10v-3"/></svg>
          )},
          { key:"audio", label:"Аудио-уроки", sub:"Слушай по дороге на смену", icon:(c)=>(
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4v-6z"/><path d="M20 14h-2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2v-6z"/></svg>
          )},
        ].map(s => {
          // Механизм «НОВОЕ» спит: когда следующий трек (например, Кухня) станет
          // рабочим, поставь сюда его key — плитка станет кликабельной с бейджем
          // НОВОЕ, как в своё время запускался «Бар». Сейчас все анонсы — «СКОРО».
          const active = false;
          return (
          <div key={s.key}
            onClick={active ? () => onSelect(s.key) : undefined}
            {...(active ? onActivate(() => onSelect(s.key)) : {})}
            style={{
            display:"flex", alignItems:"center", gap:12, padding:"11px 13px",
            borderRadius:15, opacity: active ? 1 : 0.5, position:"relative", overflow:"hidden",
            cursor: active ? "pointer" : "default",
            background: T.roleCard?.background, border: active ? "1px solid rgba(212,168,90,0.35)" : "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ width:38, height:38, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background: a11y ? "rgba(120,90,30,0.08)" : "rgba(255,255,255,0.05)", filter: active ? "none" : "grayscale(0.6)" }}>
              {s.icon(active ? (a11y ? "#8B6A30" : "#D4A85A") : (a11y ? "#8B6A30" : "#8A8070"))}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color: T.modSub.color, fontSize:13.5, fontWeight:"bold" }}>{s.label}</div>
              <div style={{ color: T.modSub.color, fontSize:11, fontStyle:"italic", marginTop:1, opacity:0.85 }}>{s.sub}</div>
            </div>
            {active ? (
              <div style={{ flexShrink:0, fontFamily:"monospace", fontSize:8, letterSpacing:2, color: a11y ? "#8B6A30" : "#D4A85A", border:`1px solid ${a11y ? "rgba(139,106,48,0.5)" : "rgba(212,168,90,0.55)"}`, borderRadius:8, padding:"3px 8px" }}>НОВОЕ</div>
            ) : (
              <div style={{ flexShrink:0, fontFamily:"monospace", fontSize:8, letterSpacing:2, color: a11y ? "#8B6A30" : GOLD_SOFT, border:`1px solid ${a11y ? "rgba(139,106,48,0.4)" : "rgba(212,168,90,0.4)"}`, borderRadius:8, padding:"3px 8px", transform:"rotate(-4deg)" }}>СКОРО</div>
            )}
          </div>
          );
        })}
      </div>

      <div style={{ margin:"4px 16px 12px", padding:"8px 14px", borderLeft:"2px solid #D4A85A44" }}>
        <span style={{ color:"#7A6C58", fontSize:12, fontStyle:"italic", lineHeight:1.6 }}>
          «Сервис — это не обслуживание, а забота»
        </span>
      </div>

      <div style={{ padding:"0 14px 20px", display:"flex", flexDirection:"column", gap:8 }}>

      </div>
    </div>
  );
}
