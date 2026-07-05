// ui/screens.jsx
// Экраны приложения и их константы, вынесены из App.jsx без изменений кода.
// Зависимости — только листовые модули (без обратного импорта из App.jsx).

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import React from "react";
import { SUPABASE_URL, SUPABASE_KEY, rpc, saToken, rpcSync, flushQueue, supabase } from "../api/supabase";
import { MODULES } from "../data/modules";
import { ROLES, RESTAURANTS } from "../data/roles";
import { GLOSSARY } from "../data/glossary";
import { DIALOGUES_DATA, MOOD_EMOJI_D, MOOD_COLORS_D } from "../data/dialogues";
import { LOGO_SRC, LOGO_SRC_DARK } from "../assets/logo";
import { normSurname, shuffleArray, dedupeBestScores, pickRandom, shuffleSituationOptions, vibrate, onActivate } from "../lib/utils";
import { MM, Mm, ROLE_SVG, UI_SVG, POS_SVG, MOD_SVG, MARKER_RE, GAME_SVG, NAV_ICONS } from "./icons";
import { S, A } from "./styles";
import { ReferenceSection } from "./ReferenceSection";
import { bookStats, countNewDishes } from "../data/reviews";
import { Confetti, TimerBar, SayAloud } from "./widgets";
import { crownIcon, flameIcon, trophyIcon, faceIcon } from "./icons-extra";
import { StreakCard, MoodCheckCard, TeamMoodCard, moodPalette } from "./mood-cards";
import { BROWN, BROWN_GOLD, CREAM, GOLD, GOLD_SOFT, GREEN, GREEN_DARK, INK, MUTED_2, RED, RED_DARK } from "./tokens";

export function AchievementPopup({ ach, a11y, onClose }) {
  const [visible, setVisible] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    setTimeout(() => setVisible(true), 20);
    const t = setTimeout(() => handleClose(), 4000);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setLeaving(true);
    setTimeout(() => onClose(), 380);
  };

  const color = ach.color || GOLD;
  const popupBg = a11y ? "rgba(220,200,165,0.55)" : "rgba(20,14,6,0.45)";
  const labelColor = a11y ? "rgba(120,85,30,0.55)" : "rgba(200,160,80,0.6)";
  const titleColor = a11y ? BROWN_GOLD : color;

  return (
    <div onClick={handleClose} {...onActivate(handleClose)}
      style={{ position:"fixed", inset:0, background:"transparent", zIndex:999, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 16px 50px" }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: popupBg,
          backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)",
          border:`1px solid ${color}55`, borderTop:`1px solid ${color}77`,
          borderRadius:22, padding:"24px 22px 20px",
          maxWidth:440, width:"100%",
          boxShadow:`0 8px 32px rgba(0,0,0,0.4), 0 2px 0 rgba(200,160,60,0.15) inset`,
          transform: leaving ? "translateY(120%) scale(0.95)" : visible ? "translateY(0) scale(1)" : "translateY(120%) scale(0.95)",
          opacity: leaving ? 0 : visible ? 1 : 0,
          transition: leaving
            ? "transform 0.45s cubic-bezier(0.4,0,1,1), opacity 0.35s ease"
            : "transform 0.65s cubic-bezier(0.16,1,0.3,1), opacity 0.5s ease",
        }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
          <div style={{
            width:64, height:64, borderRadius:18, flexShrink:0,
            background:`linear-gradient(145deg, ${color}30, ${color}10)`,
            border:`1px solid ${color}45`, borderTop:`1px solid ${color}66`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:32,
            boxShadow:`0 0 24px ${color}40, inset 0 1px 0 rgba(255,255,255,0.1)`,
            animation:"achIconPulse 2s ease-in-out infinite",
          }}>{ach.icon}</div>
          <div>
            <div style={{ color:labelColor, fontSize:11, letterSpacing:2, fontFamily:"monospace", marginBottom:5 }}>✦ НОВАЯ АЧИВКА</div>
            <div style={{ color:titleColor, fontSize:20, fontWeight:"bold", fontFamily:"Georgia, serif" }}>{ach.label}</div>
          </div>
        </div>
        <div onClick={handleClose} {...onActivate(handleClose)}
          style={{ textAlign:"center", color, fontSize:13, opacity:0.6, cursor:"pointer", fontFamily:"Georgia, serif" }}>
          Закрыть ✕
        </div>
      </div>
    </div>
  );
}

export function RoleCompleteScreen({ role, nextRole, T, onNext }) {
  const [showConfetti, setShowConfetti] = React.useState(true);
  const [phase, setPhase] = React.useState(0); // 0=celebrate, 1=next unlock

  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2000);
    const t2 = setTimeout(() => setShowConfetti(false), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const isLast = !nextRole;
  const achivements = {
    seasonal: { icon:"🌱", title:"Новичок пройден!", badge:"Стажёр сервиса", desc:"Ты освоил базовые стандарты и готов к реальным сменам. Это только начало пути!", color:"#7C9E87" },
    core:     { icon:"⭐", title:"Ядро пройдено!", badge:"Опора команды", desc:"Ты стал частью постоянной команды. Твои стандарты — пример для новичков.", color:GOLD },
    manager:  { icon:"🎯", title:"Менеджер пройден!", badge:"Лидер зала", desc:"Управление командой, разрешение конфликтов, финансы — ты готов к большему.", color:"#8B7BAB" },
    service_manager: { icon:"🏛️", title:"Мастер сервиса!", badge:"Архитектор сервиса", desc:"Ты прошёл весь путь. Теперь ты строишь культуру сервиса для других.", color:"#7B8FAB" },
    spg: { icon:"🛎️", title:"Хостес пройдена!", badge:"Лицо ресторана", desc:"Ты — первое и последнее впечатление гостя. Встреча, поток и атмосфера у входа теперь твоя стихия.", color:"#C8917A" },
  };
  const ach = achivements[role?.id] || achivements.seasonal;

  return (
    <div style={{ ...T.screen, background:"#0A0806", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px", overflowY:"auto" }} className="sa-screen">
      {showConfetti && <Confetti />}

      {/* Главная анимация — медаль */}
      <div className="sa-pop" style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ marginBottom:10, filter:"drop-shadow(0 0 30px rgba(212,168,90,0.6))", lineHeight:1, display:"flex", justifyContent:"center" }}>
          {ROLE_SVG[role?.id] ? ROLE_SVG[role.id](ach.color, 72) : ach.icon}
        </div>
        <div style={{ fontSize:11, letterSpacing:4, color:"#C8A870", fontFamily:"monospace", marginBottom:12 }}>
          ДОСТИЖЕНИЕ РАЗБЛОКИРОВАНО
        </div>
        <div style={{ display:"inline-block", background:"linear-gradient(135deg, rgba(212,168,90,0.25) 0%, rgba(212,168,90,0.05) 100%)", border:"1px solid rgba(212,168,90,0.5)", borderRadius:30, padding:"6px 20px", marginBottom:16 }}>
          <span style={{ color:GOLD_SOFT, fontSize:13, fontWeight:"bold", fontFamily:"Georgia, serif" }}>
            ✦ {ach.badge}
          </span>
        </div>
        <div style={{ color:CREAM, fontSize:26, fontWeight:"bold", fontFamily:"Georgia, serif", marginBottom:8, letterSpacing:0.3 }}>
          {ach.title}
        </div>
        <div style={{ color:"#8A7A6A", fontSize:14, lineHeight:1.7, maxWidth:300, margin:"0 auto" }}>
          {ach.desc}
        </div>
      </div>

      {/* Звёзды */}
      <div className="sa-fast" style={{ display:"flex", gap:8, marginBottom:28, animationDelay:"0.3s" }}>
        {[1,2,3].map(s => (
          <div key={s} style={{ fontSize:32, filter:`drop-shadow(0 0 8px #C8A96E)`, animationDelay:`${s*0.15}s` }} className="sa-pop">⭐</div>
        ))}
      </div>

      {/* Разблокировка следующей роли */}
      {phase >= 1 && !isLast && (
        <div className="sa-pop" style={{ width:"100%", maxWidth:340, marginBottom:24 }}>
          <div style={{ background:"linear-gradient(135deg, rgba(93,187,138,0.12) 0%, rgba(0,0,0,0.2) 100%)", border:"1px solid rgba(93,187,138,0.3)", borderRadius:20, padding:"16px 20px", textAlign:"center" }}>
            <div style={{ fontSize:11, letterSpacing:3, color:GREEN, fontFamily:"monospace", marginBottom:8 }}>✦ РАЗБЛОКИРОВАНО</div>
            <div style={{ marginBottom:6, display:"flex", justifyContent:"center" }}>{ROLE_SVG[nextRole.id] ? ROLE_SVG[nextRole.id](nextRole.color, 30) : nextRole.icon}</div>
            <div style={{ color:CREAM, fontSize:16, fontWeight:"bold", fontFamily:"Georgia, serif", marginBottom:4 }}>{nextRole.label}</div>
            <div style={{ color:"#8A7A6A", fontSize:12 }}>{nextRole.desc}</div>
          </div>
        </div>
      )}

      {isLast && phase >= 1 && role?.id !== "spg" && (
        <div className="sa-pop" style={{ width:"100%", maxWidth:340, marginBottom:24 }}>
          <div style={{ background:"linear-gradient(135deg, rgba(212,168,90,0.15) 0%, rgba(0,0,0,0.2) 100%)", border:"1px solid rgba(212,168,90,0.4)", borderRadius:20, padding:"16px 20px", textAlign:"center" }}>
            <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}>{crownIcon(GOLD_SOFT, 32)}</div>
            <div style={{ color:GOLD_SOFT, fontSize:15, fontWeight:"bold", fontFamily:"Georgia, serif", marginBottom:4 }}>Мастер сервиса</div>
            <div style={{ color:"#8A7A6A", fontSize:12, lineHeight:1.6 }}>Ты прошёл весь путь Service Academy. Теперь ты — архитектор сервиса.</div>
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        className="sa-btn sa-btn-pulse"
        style={{ width:"100%", maxWidth:340, padding:"16px", borderRadius:18, border:"1px solid rgba(200,160,80,0.4)", background:"linear-gradient(135deg, rgba(200,160,80,0.2) 0%, rgba(200,160,80,0.08) 100%)", color:CREAM, fontSize:16, fontWeight:"bold", cursor:"pointer", fontFamily:"Georgia, serif", letterSpacing:0.3 }}
      >
        {isLast ? "К списку ролей →" : `Перейти к «${nextRole?.label}» →`}
      </button>
    </div>
  );
}

export function WeekStar({ weekly, T }) {
  const gold = GOLD;
  const wrap = { background:`linear-gradient(150deg, ${gold}1f, ${gold}08)`, border:`1px solid ${gold}55`, borderRadius:16, padding:"14px 16px", marginBottom:14, boxShadow:"0 4px 14px rgba(0,0,0,0.18)" };
  if (!weekly || weekly.length === 0) {
    return (
      <div style={wrap}>
        <div style={{ color:gold, fontSize:11, letterSpacing:1.5, fontWeight:"bold", fontFamily:"monospace", marginBottom:6, display:"flex", alignItems:"center", gap:6 }}>{crownIcon(gold,13)} СОТРУДНИК НЕДЕЛИ</div>
        <div style={{ color:T.modSub.color, fontSize:13, lineHeight:1.5 }}>На этой неделе пока нет активности — самое время вырваться вперёд!</div>
      </div>
    );
  }
  const top = weekly[0]; const rest = weekly.slice(1);
  return (
    <div style={wrap}>
      <div style={{ color:gold, fontSize:11, letterSpacing:1.5, fontWeight:"bold", fontFamily:"monospace", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>{crownIcon(gold,13)} СОТРУДНИК НЕДЕЛИ</div>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:46, height:46, borderRadius:"50%", flexShrink:0, background:`linear-gradient(135deg, ${gold}, #8B6A30)`, display:"flex", alignItems:"center", justifyContent:"center" }}>{crownIcon("#fff8ec", 24)}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ ...T.modTitle, fontSize:16 }}>{top.name} {top.surname}</div>
          <div style={{ color:T.modSub.color, fontSize:12 }}>{top.restaurant || ""}</div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ color:gold, fontFamily:"Georgia, serif", fontSize:22, fontWeight:"bold", lineHeight:1 }}>{top.pts}</div>
          <div style={{ color:T.modSub.color, fontSize:10 }}>очков</div>
        </div>
      </div>
      {rest.length > 0 && (
        <div style={{ display:"flex", gap:14, marginTop:12, paddingTop:10, borderTop:`1px solid ${gold}22`, flexWrap:"wrap" }}>
          {rest.map((p, i) => (
            <div key={i} style={{ color:T.modSub.color, fontSize:12 }}>
              <span style={{ marginRight:4 }}>{i===0?"🥈":"🥉"}</span>{p.name} {p.surname ? p.surname[0]+"." : ""} <span style={{ color:gold, fontWeight:"bold" }}>{p.pts}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LeaderboardScreen({ T, leaderboard, scores, profile, practiceStars = {}, onBack }) {
  const myPosition = profile?.position || "waiter";
  const isAdmin = !!profile?.is_admin;
  // Доступные вкладки по должности
  const allTabs = [
    { id:"waiter",  label:"Официанты", icon:"🍽️", color:"#7C9E87" },
    { id:"hostess", label:"Хостес", icon:"🛎️", color:"#C8917A" },
    { id:"manager", label:"Менеджеры", icon:"🎯", color:"#8B7BAB" },
    { id:"senior",  label:"Руководство", icon:"🏛️", color:GOLD },
  ];
  const visibleTabs = (isAdmin || myPosition === "senior") ? allTabs : allTabs.filter(t => {
    if (myPosition === "waiter")  return t.id === "waiter";
    if (myPosition === "hostess") return t.id === "hostess";
    if (myPosition === "manager") return t.id === "waiter" || t.id === "manager";
    return true;
  });

  const [tab, setTab] = React.useState(visibleTabs[0]?.id || "waiter");
  const [detailTab, setDetailTab] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const roleLabel = { seasonal:"Новичок", core:"Ядро", spg:"Хостес", manager:"Менеджер", service_manager:"Сервис-менеджер" };
  const roleColor = { seasonal:"#7C9E87", core:GOLD, spg:"#C8917A", manager:"#8B7BAB", service_manager:"#7B8FAB" };
  const medals = ["🥇","🥈","🥉"];

  const getAchievements = (player, allPlayers, allScores) => {
    const achievements = [];
    const key = `${player.name}|${player.surname}`;
    const playerScores = allScores.filter(s => s.name === player.name && s.surname === player.surname);

    // 🌟 Бог сервиса — все 4 роли + все тесты 100%
    const rolesWithScores = new Set(playerScores.map(s => s.role));
    const allRolesCovered = ["seasonal","core","manager","service_manager"].every(r => rolesWithScores.has(r));
    if (allRolesCovered && playerScores.length > 0 && playerScores.every(s => s.pct === 100)) {
      achievements.push({ icon:"🌟", label:"Бог сервиса" });
    }

    // 🏆 Мастер практики — больше всех звёздочек практики
    const myStars = Object.values(practiceStars[key] || {}).reduce((a, b) => a + b, 0);
    const maxStars = Math.max(...allPlayers.map(p => Object.values(practiceStars[`${p.name}|${p.surname}`] || {}).reduce((a, b) => a + b, 0)), 0);
    if (myStars > 0 && myStars === maxStars && allPlayers.length > 1) {
      achievements.push({ icon:"🏆", label:"Мастер практики" });
    }

    // ⭐ Ядро команды — лучший средний % в роли core
    const coreScores = allScores.filter(s => s.role === "core");
    if (coreScores.length > 0) {
      const getAvg = (p) => { const ps = coreScores.filter(s => s.name === p.name && s.surname === p.surname); return ps.length > 0 ? ps.reduce((sum, s) => sum + s.pct, 0) / ps.length : 0; };
      const myAvg = getAvg(player);
      const maxAvg = Math.max(...allPlayers.map(getAvg), 0);
      if (myAvg > 0 && myAvg === maxAvg && allPlayers.length > 1) {
        achievements.push({ icon:"⭐", label:"Ядро команды" });
      }
    }

    // 🛎️ Лучший хостес — лучший средний % в роли spg (Хостес)
    const spgScores = allScores.filter(s => s.role === "spg");
    if (spgScores.length > 0) {
      const getAvgS = (p) => { const ps = spgScores.filter(s => s.name === p.name && s.surname === p.surname); return ps.length > 0 ? ps.reduce((sum, s) => sum + s.pct, 0) / ps.length : 0; };
      const myAvgS = getAvgS(player);
      const maxAvgS = Math.max(...allPlayers.map(getAvgS), 0);
      if (myAvgS > 0 && myAvgS === maxAvgS && allPlayers.length > 1) {
        achievements.push({ icon:"🛎️", label:"Лучший хостес" });
      }
    }

    // 🚀 Первопроходец — первый кто появился в системе
    if (playerScores.length > 0 && allScores.length > 0) {
      const myEarliest = playerScores.map(s => s.date).sort()[0];
      const globalEarliest = allScores.map(s => s.date).sort()[0];
      if (myEarliest === globalEarliest && allPlayers.length > 1) {
        achievements.push({ icon:"🚀", label:"Первопроходец" });
      }
    }

    return achievements;
  };

  const currentTab = allTabs.find(t => t.id === tab);
  const filtered = leaderboard.filter(p => (p.position || "waiter") === tab);
  const detail = selected ? scores.filter(s => s.name === selected.name && s.surname === selected.surname) : [];

  // Сотрудник недели: сумма очков за текущую неделю (Пн–Вс) в рамках вкладки
  const weekStar = React.useMemo(() => {
    const d = new Date(); const dow = (d.getDay()+6)%7; d.setHours(0,0,0,0); d.setDate(d.getDate()-dow);
    const weekStart = d.getTime();
    const map = {};
    scores.forEach(s => {
      if (!s.updated_at || new Date(s.updated_at).getTime() < weekStart) return;
      if ((s.position || "waiter") !== tab) return;
      const k = `${s.name}|${s.surname||""}`;
      if (!map[k]) map[k] = { name:s.name, surname:s.surname||"", restaurant:s.restaurant, pts:0 };
      map[k].pts += (s.score || 0);
    });
    return Object.values(map).filter(p => p.pts > 0).sort((a,b) => b.pts - a.pts).slice(0,3);
  }, [scores, tab]);

  return (
    <div style={T.screen}>
      <div style={{ ...T.lessHead, justifyContent:"space-between" }}>
        <button style={T.backBtn2} onClick={detailTab ? () => { setDetailTab(false); setSelected(null); } : onBack}>‹</button>
        <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/></svg>
          <span>Рейтинг сотрудников</span></div>
        <div style={{ width:24 }} />
      </div>

      {/* Вкладки категорий */}
      {!detailTab && (
        <div style={{ display:"flex", margin:"12px 16px 0", gap:6 }}>
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:"9px 4px", borderRadius:12, border: tab === t.id ? `1px solid ${t.color}55` : "1px solid transparent", borderTop: tab === t.id ? `1px solid ${t.color}88` : "1px solid transparent", cursor:"pointer", fontFamily:"Georgia, serif", fontSize:12, fontWeight:"bold", transition:"all 0.25s ease",
              background: tab === t.id
                ? `linear-gradient(155deg, ${t.color}28, ${t.color}10)`
                : T.modCard.background,
              color: tab === t.id ? t.color : T.progLabel.color,
              boxShadow: tab === t.id ? `0 4px 14px rgba(0,0,0,0.3), 0 1px 0 ${t.color}22 inset` : "none" }}>
              <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:5 }}>{POS_SVG[t.id] ? POS_SVG[t.id](tab === t.id ? t.color : T.progLabel.color, 13) : null}{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {!detailTab ? (
        <div style={{ flex:1, padding:"12px 16px", overflowY:"auto" }}>
          <WeekStar weekly={weekStar} T={T} />
          {filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 0", color:T.modSub.color, fontSize:14 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
              <div>Пока нет результатов</div>
            </div>
          ) : filtered.map((p, i) => {
            const ach = getAchievements(p, leaderboard, scores);
            return (
            <div key={i} onClick={() => { setSelected(p); setDetailTab(true); }} {...onActivate(() => { setSelected(p); setDetailTab(true); })}
              style={{ ...T.modCard, marginBottom:10, cursor:"pointer", gap:12 }}>
              <div style={{ flexShrink:0, minWidth:28, display:"flex", alignItems:"center", justifyContent:"center" }}>{(() => { const med = [["#F0CE72","rgba(232,196,106,0.20)"],["#D2D7DE","rgba(200,205,212,0.16)"],["#D6A06A","rgba(214,160,106,0.18)"]][i]; const fg = med ? med[0] : (T.modTitle?.color||GOLD); const bg = med ? med[1] : (T.modSub?.color||"#9A8C74")+"22"; const bd = med ? med[0]+"99" : (T.modTitle?.color||GOLD)+"44"; return <div style={{ width:27, height:27, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background:bg, border:`1.5px solid ${bd}`, color:fg, fontSize:13, fontWeight:"bold" }}>{i+1}</div>; })()}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2, flexWrap:"wrap" }}>
                  <div style={{ ...T.modTitle }}>{p.name} {p.surname}</div>
                  {ach.map((a, ai) => <span key={ai} title={a.label} style={{ fontSize:15 }}>{a.icon}</span>)}
                </div>
                <div style={{ color:T.modSub.color, fontSize:12, marginBottom:6 }}>{p.restaurant}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ flex:1, height:4, background:T.progBar.background, borderRadius:2, overflow:"hidden" }}>
                    <div style={{ width:`${p.avg}%`, height:"100%", background:roleColor[p.role]||GOLD, borderRadius:2 }} />
                  </div>
                  <div style={{ color:roleColor[p.role]||GOLD, fontSize:13, fontWeight:"bold", flexShrink:0 }}>{p.avg}%</div>
                </div>
              </div>
              <div style={{ color:T.modSub.color, fontSize:11, textAlign:"right", flexShrink:0 }}>
                {p.position !== "senior" && <div style={{ color:roleColor[p.role]||GOLD, marginBottom:2 }}>{roleLabel[p.role]||p.role}</div>}
                <div>{p.total} тест{p.total>4?"ов":p.total>1?"а":""}</div>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div style={{ flex:1, padding:"12px 16px", overflowY:"auto" }}>
          {(() => { const selAch = selected ? getAchievements(selected, leaderboard, scores) : []; return (
          <div style={{ ...T.modCard, marginBottom:16, flexDirection:"column", alignItems:"flex-start", gap:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, width:"100%" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:`${roleColor[selected?.role]||GOLD}22`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18, fontWeight:"bold", color:roleColor[selected?.role]||GOLD, fontFamily:"Georgia, serif" }}>
                {selected?.name?.[0]}{selected?.surname?.[0]}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ ...T.modTitle }}>{selected?.name} {selected?.surname}</div>
                <div style={{ color:T.modSub.color, fontSize:12 }}>{selected?.restaurant}</div>
              </div>
            </div>
            {selAch.length > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:2 }}>
                {selAch.map((a, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20, background:"rgba(200,160,80,0.1)", border:"1px solid rgba(200,160,80,0.3)" }}>
                    <span style={{ fontSize:14 }}>{a.icon}</span>
                    <span style={{ color:GOLD, fontSize:11, fontFamily:"Georgia, serif" }}>{a.label}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:20, marginTop:4 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ color:GOLD, fontSize:22, fontWeight:"bold" }}>{selected?.avg}%</div>
                <div style={{ color:T.modSub.color, fontSize:11 }}>средний балл</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ color:GOLD, fontSize:22, fontWeight:"bold" }}>{selected?.total}</div>
                <div style={{ color:T.modSub.color, fontSize: T.modSub?.fontSize || 13 }}>тестов</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ color:roleColor[selected?.role]||GOLD, fontSize:14, fontWeight:"bold", marginTop:4 }}>{selected?.position !== "senior" ? (roleLabel[selected?.role]||"") : ""}</div>
                <div style={{ color:T.modSub.color, fontSize:11 }}>{selected?.position !== "senior" ? "роль" : ""}</div>
              </div>
            </div>
          </div>); })()}
          {detail.map((d, i) => (
            <div key={i} style={{ ...T.lessCard, marginBottom:8, flexDirection:"column", alignItems:"flex-start", gap:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", width:"100%" }}>
                <div style={{ ...T.lessTitle, fontSize:13, flex:1, marginRight:8 }}>{d.quizTitle}</div>
                <div style={{ color: d.pct>=80?"#81C784":d.pct>=50?GOLD:"#e57373", fontWeight:"bold", flexShrink:0 }}>{d.pct}%</div>
              </div>
              <div style={{ color:T.modSub.color, fontSize:12 }}>{d.score} из {d.total} верно · {d.date}</div>
              <div style={{ width:"100%", height:3, background:T.progBar.background, borderRadius:2, overflow:"hidden" }}>
                <div style={{ width:`${d.pct}%`, height:"100%", background: d.pct>=80?"#81C784":d.pct>=50?GOLD:"#e57373" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DailyScreen({ T, profile, completed, quizDone, role, modules, onBack, onLesson, onReferenceLesson }) {
  const today = new Date().toLocaleDateString("ru-RU");
  const seed = today.split(".").reduce((a, v) => a + parseInt(v), 0);
  const refTask = ReferenceSection.dailyTask(seed);

  // Генерируем 3 задания на сегодня из непройденных уроков
  const allLessons = React.useMemo(() => {
    if (!modules) return [];
    return modules.flatMap(m => m.lessons.map(l => ({ ...l, mod: m })));
  }, [modules]);

  const tasks = React.useMemo(() => {
    if (!allLessons.length) return [];
    // Сначала непройденные
    const undone = allLessons.filter(l => !completed[l.id] && (l.type !== "quiz" || !quizDone[l.id]));
    const done = allLessons.filter(l => completed[l.id]);
    // Берём 3: приоритет непройденным
    const pool = [...undone, ...done];
    const picked = [];
    let s = seed;
    const used = new Set();
    while (picked.length < 3 && picked.length < pool.length) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const idx = s % pool.length;
      if (!used.has(idx)) { used.add(idx); picked.push(pool[idx]); }
    }
    return picked;
  }, [allLessons, completed, quizDone, seed]);

  const taskTypeIcon = { lesson:"book", quiz:"quiz", practice:"gamepad" };
  const taskTypeLabel = { lesson:"Урок", quiz:"Тест", practice:"Практика" };

  if (!role) return (
    <div style={T.screen}>
      <div style={{ ...T.lessHead, justifyContent:"space-between" }}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>🎯 Задания дня</div>
        <div style={{ width:24 }} />
      </div>
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, gap:12 }}>
        <div style={{ fontSize:48 }}>🎯</div>
        <div style={{ color:T.modTitle.color, fontSize:16, fontFamily:"Georgia, serif", textAlign:"center" }}>Сначала выбери роль</div>
        <div style={{ color:T.modSub.color, fontSize:13, textAlign:"center" }}>Вернись и выбери роль — тогда появятся ежедневные задания</div>
      </div>
    </div>
  );

  return (
    <div style={T.screen}>
      <div style={{ ...T.lessHead, justifyContent:"space-between" }}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>🎯 Задания дня</div>
        <div style={{ width:24 }} />
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>

        {/* Дата */}
        <div style={{ textAlign:"center", marginBottom:16 }}>
          <div style={{ color:GOLD, fontSize:12, letterSpacing:2, fontFamily:"monospace" }}>{today}</div>
          <div style={{ color:T.modSub.color, fontSize:12, marginTop:4 }}>3 задания обновляются каждый день</div>
        </div>

        {onReferenceLesson && refTask && (
          <div onClick={() => onReferenceLesson(refTask.id)} {...onActivate(() => onReferenceLesson(refTask.id))} style={{ ...T.modCard, marginBottom:12, gap:12, cursor:"pointer", border:"1px solid rgba(200,160,80,0.15)" }}>
            <div style={{ flexShrink:0, display:"flex", alignItems:"center" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h6v17H6a2 2 0 0 0-2 2z"/><path d="M20 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <div style={{ color:"rgba(200,160,80,0.6)", fontSize:10, letterSpacing:2, fontFamily:"monospace" }}>СПРАВОЧНИК · {refTask.type === "quiz" ? "ФОТО-ТЕСТ" : "ГЛАВА"}</div>
              </div>
              <div style={{ ...T.modTitle, fontSize:15 }}>{refTask.title}</div>
              <div style={{ color:T.modSub.color, fontSize:12, marginTop:2 }}>Курс: Сервировка</div>
            </div>
            <div style={{ color:GOLD, fontSize:18, flexShrink:0 }}>›</div>
          </div>
        )}

        {/* Задания */}
        {tasks.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:T.modSub.color }}>
            <div style={{ fontSize:48, marginBottom:8 }}>🏆</div>
            <div style={{ fontSize:16, color:T.modTitle.color, fontFamily:"Georgia, serif" }}>Все уроки пройдены!</div>
            <div style={{ fontSize:12, marginTop:4 }}>Ты настоящий мастер сервиса</div>
          </div>
        ) : tasks.map((task, i) => {
          const isDone = task.type === "quiz" ? quizDone[task.id] : completed[task.id];
          return (
            <div key={i} onClick={() => !isDone && onLesson(task, task.mod)} {...onActivate(() => !isDone && onLesson(task, task.mod))}
              style={{ ...T.modCard, marginBottom:12, gap:12, opacity: isDone ? 0.6 : 1,
                cursor: isDone ? "default" : "pointer",
                border: isDone ? "1px solid rgba(93,187,138,0.3)" : "1px solid rgba(200,160,80,0.15)" }}>
              <div style={{ flexShrink:0, display:"flex", alignItems:"center" }}>{isDone ? UI_SVG.checkCircle(GREEN, 26) : UI_SVG[taskTypeIcon[task.type]](GOLD, 26)}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  <div style={{ color:"rgba(200,160,80,0.6)", fontSize:10, letterSpacing:2, fontFamily:"monospace" }}>ЗАДАНИЕ {i+1} · {taskTypeLabel[task.type]}</div>
                </div>
                <div style={{ ...T.modTitle, fontSize:15 }}>{task.title}</div>
                <div style={{ color:T.modSub.color, fontSize:12, marginTop:2 }}>{task.mod?.title}</div>
              </div>
              {!isDone && <div style={{ color:GOLD, fontSize:18, flexShrink:0 }}>›</div>}
            </div>
          );
        })}

        {/* Мотивация */}
        <div style={{ ...T.modCard, marginTop:8, flexDirection:"column", alignItems:"center", gap:6, padding:"14px", background:"rgba(200,160,80,0.05)" }}>
          <div style={{ fontSize:24 }}>💡</div>
          <div style={{ color:T.modSub.color, fontSize:12, textAlign:"center", lineHeight:1.6 }}>
            Выполняй задания каждый день — маленькие шаги формируют большой результат
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayerDetailScreen({ player, T, onBack }) {
  const [progress, setProgress] = React.useState([]);
  const [scores, setScores] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const [quizDonePlayer, setQuizDonePlayer] = React.useState([]);

  React.useEffect(() => {
    const h = { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY };
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/progress?name=eq.${encodeURIComponent(player.name)}&surname=eq.${encodeURIComponent(player.surname||"")}`, { headers: h }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/scores?name=eq.${encodeURIComponent(player.name)}&surname=eq.${encodeURIComponent(player.surname||"")}&order=updated_at.desc`, { headers: h }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/quiz_done?name=eq.${encodeURIComponent(player.name)}&surname=eq.${encodeURIComponent(player.surname||"")}`, { headers: h }).then(r => r.json()),
    ]).then(([prog, sc, qd]) => {
      setProgress(Array.isArray(prog) ? prog : []);
      setScores(Array.isArray(sc) ? sc : []);
      setQuizDonePlayer(Array.isArray(qd) ? qd : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [player.name, player.surname]);

  const roleNames = { seasonal: "Новичок", spg: "СПГ", core: "Ядро", manager: "Менеджер", service_manager: "Сервис-менеджер" };
  const roleColors = { seasonal: "#7C9E87", spg: "#C8917A", core: GOLD, manager: "#8B7BAB", service_manager: "#5B8FA8" };

  // Группируем прогресс по ролям — уроки + практики (без квизов)
  const byRole = {};
  const seenLessons = new Set();
  progress.forEach(p => {
    const key = `${p.role}|${p.lesson_id}`;
    if (seenLessons.has(key)) return;
    seenLessons.add(key);
    const roleQuizIds = new Set((MODULES[p.role] || []).flatMap(m => m.lessons.filter(l => l.type === "quiz").map(l => l.id)));
    if (roleQuizIds.has(p.lesson_id)) return; // квизы считаем отдельно
    const roleLessons = (MODULES[p.role] || []).flatMap(m => m.lessons.filter(l => l.type !== "quiz" && l.type !== "result").map(l => l.id));
    if (!roleLessons.includes(p.lesson_id)) return;
    if (!byRole[p.role]) byRole[p.role] = 0;
    byRole[p.role]++;
  });

  // Квизы пройденные игроком по ролям
  const quizByRole = {};
  const seenQuizzes = new Set();
  quizDonePlayer.forEach(q => {
    if (seenQuizzes.has(q.quiz_id)) return;
    seenQuizzes.add(q.quiz_id);
    for (const [roleId, modules] of Object.entries(MODULES)) {
      const quizIds = modules.flatMap(m => m.lessons.filter(l => l.type === "quiz").map(l => l.id));
      if (quizIds.includes(q.quiz_id)) {
        if (!quizByRole[roleId]) quizByRole[roleId] = 0;
        quizByRole[roleId]++;
        break;
      }
    }
  });

  // Дедуплицируем тесты — по quiz_id берём лучший результат, если нет quiz_id — по роли
  const uniqueScores = Object.values(
    scores.reduce((acc, s) => {
      const key = s.quiz_id ? `${s.role}|${s.quiz_id}` : `${s.role}`;
      if (!acc[key] || (s.score / s.total) > (acc[key].score / acc[key].total)) {
        acc[key] = s;
      }
      return acc;
    }, {})
  );

  // Честное число пройденных уроков (без дублей и устаревших)
  const validLessonIds = new Set(
    Object.values(MODULES).flatMap(modules =>
      modules.flatMap(m => m.lessons.filter(l => l.type !== "quiz" && l.type !== "result").map(l => l.id))
    )
  );
  const seenForCount = new Set();
  const uniqueLessonCount = progress.filter(p => {
    if (!validLessonIds.has(p.lesson_id)) return false;
    if (seenForCount.has(p.lesson_id)) return false;
    seenForCount.add(p.lesson_id);
    return true;
  }).length;

  const avgScore = uniqueScores.length > 0
    ? Math.round(uniqueScores.reduce((a, s) => a + (s.score / s.total * 100), 0) / uniqueScores.length)
    : 0;

  return (
    <div style={T.screen}>
      <div style={T.lessHead}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>📊 {player.name} {player.surname}</div>
      </div>
      <div style={{ ...T.lessBody, padding:"14px 16px 80px" }}>
        {loading ? (
          <div style={{ textAlign:"center", color: T.modSub?.color || BROWN, padding:"40px 0" }}>Загрузка...</div>
        ) : (
          <>
            {/* Общая сводка */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              {[
                { icon:"book", value: uniqueLessonCount, label:"Уроков пройдено" },
                { icon:"quiz", value: uniqueScores.length, label:"Тестов сдано" },
                { icon:"target", value: avgScore+"%", label:"Средний балл" },
                { icon:"diamond", value: uniqueScores.filter(s=>s.score===s.total).length, label:"На 100%" },
              ].map((s, i) => (
                <div key={i} style={{ ...T.modCard, flexDirection:"column", alignItems:"center", padding:"12px", gap:4 }}>
                  <div style={{ display:"flex", alignItems:"center", height:24 }}>{UI_SVG[s.icon] ? UI_SVG[s.icon](GOLD, 22) : s.icon}</div>
                  <div style={{ color: T.modTitle?.color || CREAM, fontSize:20, fontWeight:"bold" }}>{s.value}</div>
                  <div style={{ color: T.modSub?.color || BROWN, fontSize:11, textAlign:"center" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Прогресс по ролям */}
            <div style={{ color: T.secTitle?.color || "#9A8060", fontSize:11, letterSpacing:3, marginBottom:10, fontFamily:"monospace" }}>ПРОГРЕСС ПО РОЛЯМ</div>
            {Object.entries(roleNames).map(([roleId, roleName]) => {
              const lessonCount = byRole[roleId] || 0;
              const quizCount = quizByRole[roleId] || 0;
              const count = lessonCount + quizCount;
              const lessonTotal = (MODULES[roleId] || []).flatMap(m => m.lessons.filter(l => l.type !== "quiz" && l.type !== "result")).length;
              const quizTotal = (MODULES[roleId] || []).flatMap(m => m.lessons.filter(l => l.type === "quiz")).length;
              const total = lessonTotal + quizTotal;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const color = roleColors[roleId] || GOLD;
              return (
                <div key={roleId} style={{ ...T.modCard, flexDirection:"column", gap:8, marginBottom:8, padding:"12px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ color: T.modTitle?.color || CREAM, fontSize:14, fontWeight:"bold" }}>{roleName}</div>
                    <div style={{ color, fontSize:14, fontWeight:"bold" }}>{pct}%</div>
                  </div>
                  <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3 }}>
                    <div style={{ height:6, width:`${pct}%`, background:color, borderRadius:3, transition:"width 0.5s ease" }} />
                  </div>
                  <div style={{ color: T.modSub?.color || BROWN, fontSize:12 }}>{count} из {total} уроков</div>
                </div>
              );
            })}

            {/* Последние тесты */}
            {scores.length > 0 && (
              <>
                <div style={{ color: T.secTitle?.color || "#9A8060", fontSize:11, letterSpacing:3, margin:"16px 0 10px", fontFamily:"monospace" }}>ПОСЛЕДНИЕ ТЕСТЫ</div>
                {uniqueScores.sort((a,b) => (b.score/b.total) - (a.score/a.total)).map((s, i) => {
                  const pct = Math.round(s.score / s.total * 100);
                  return (
                    <div key={i} style={{ ...T.modCard, marginBottom:8, padding:"10px 14px", flexDirection:"column", gap:4 }}>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <div style={{ color: T.modTitle?.color || CREAM, fontSize:13, fontWeight:"bold", flex:1 }}>{s.role ? roleNames[s.role] || s.role : ""}</div>
                        <div style={{ color: pct === 100 ? GREEN : pct >= 70 ? GOLD : RED, fontSize:14, fontWeight:"bold" }}>{pct}%</div>
                      </div>
                      <div style={{ color: T.modSub?.color || BROWN, fontSize:11 }}>{s.score} из {s.total} верно · {new Date(s.updated_at).toLocaleDateString("ru-RU")}</div>
                      <div style={{ height:3, background:"rgba(255,255,255,0.08)", borderRadius:2, marginTop:2 }}>
                        <div style={{ height:3, width:`${pct}%`, background: pct === 100 ? GREEN : pct >= 70 ? GOLD : RED, borderRadius:2 }} />
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {uniqueLessonCount === 0 && uniqueScores.length === 0 && (
              <div style={{ textAlign:"center", color: T.modSub?.color || BROWN, padding:"30px 0", fontSize:14 }}>
                📭 Пока нет данных
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function PlayerResetCard({ p, T, onResetPlayer, onUnlockQuiz, onViewPlayer }) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  return (
    <div style={{ ...T.modCard, marginBottom:8, gap:12, flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ ...T.modTitle, fontSize:13 }}>{p.name} {p.surname}</div>
          <div style={{ color:T.modSub.color, fontSize:11 }}>{p.restaurant}</div>
        </div>
        <div onClick={() => onViewPlayer && onViewPlayer(p)} {...onActivate(() => onViewPlayer && onViewPlayer(p))}
          style={{ padding:"6px 12px", borderRadius:10, cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif",
            background:"rgba(200,169,110,0.12)", border:"1px solid rgba(200,169,110,0.3)", color:GOLD }}>
          📊
        </div>
        <div onClick={() => setShowConfirm(s => !s)} {...onActivate(() => setShowConfirm(s => !s))}
          style={{ padding:"6px 12px", borderRadius:10, cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif",
            background:"rgba(220,80,80,0.12)", border:"1px solid rgba(220,80,80,0.3)", color:"#e57373" }}>
          🗑 Сбросить
        </div>
      </div>
      {showConfirm && (
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ color:"#e57373", fontSize:12, flex:1 }}>Удалить все результаты?</div>
          <div onClick={() => { onResetPlayer(p.name, p.surname); setShowConfirm(false); }} {...onActivate(() => { onResetPlayer(p.name, p.surname); setShowConfirm(false); })}
            style={{ padding:"6px 14px", borderRadius:10, cursor:"pointer", fontSize:12,
              background:"rgba(220,80,80,0.25)", border:"1px solid rgba(220,80,80,0.5)", color:"#e57373", fontWeight:"bold" }}>
            Да
          </div>
          <div onClick={() => setShowConfirm(false)} {...onActivate(() => setShowConfirm(false))}
            style={{ padding:"6px 14px", borderRadius:10, cursor:"pointer", fontSize:12,
              background:T.modCard.background, border:"1px solid rgba(255,255,255,0.08)", color:T.modSub.color }}>
            Нет
          </div>
        </div>
      )}
      {onUnlockQuiz && (
        <div onClick={() => onUnlockQuiz(p.name, p.surname)} {...onActivate(() => onUnlockQuiz(p.name, p.surname))}
          style={{ padding:"6px 12px", borderRadius:10, cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif",
            background:"rgba(80,160,80,0.12)", border:"1px solid rgba(80,160,80,0.3)", color:"#81C784", alignSelf:"flex-start" }}>
          🔓 Разблокировать тесты
        </div>
      )}
    </div>
  );
}

export function StatsScreen({ T, profile, scores, completedRoles, completed, quizDone = {}, examResults = {}, practiceStars, allProfiles = [], onBack, onResetPlayer, onUnlockQuiz, onViewPlayer }) {
  const ROLE_ORDER = ["seasonal", "core", "manager", "service_manager"];
  const roleLabel = { seasonal:"Новичок", core:"Ядро", spg:"Хостес", manager:"Менеджер", service_manager:"Сервис-менеджер" };
  const roleColor = { seasonal:"#7C9E87", core:GOLD, spg:"#C8917A", manager:"#8B7BAB", service_manager:"#7B8FAB" };
  const roleIcon  = { seasonal:"🌱", core:"⭐", manager:"🎯", service_manager:"🏛️" };

  const myScores = scores.filter(s => s.name === profile?.name && s.surname === profile?.surname);
  const totalTests = myScores.length;
  const avgScore = totalTests > 0 ? Math.round(myScores.reduce((s, x) => s + x.pct, 0) / totalTests) : 0;
  const perfect = myScores.filter(s => s.pct === 100).length;
  const myStars = Object.values(practiceStars[`${profile?.name}|${profile?.surname}`] || {}).reduce((a, b) => a + b, 0);
  const rolesCompleted = ROLE_ORDER.filter(r => completedRoles.has(r)).length;

  const completedLessons = Object.keys(completed || {}).length;

  return (
    <div style={T.screen}>
      <div style={{ ...T.lessHead, justifyContent:"space-between" }}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>📈 Моя статистика</div>
        <div style={{ width:24 }} />
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>

        {/* Профиль */}
        <div style={{ ...T.modCard, marginBottom:12, gap:12 }}>
          <div style={{ width:48, height:48, borderRadius:"50%", background:"rgba(200,160,80,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:"bold", color:GOLD, fontFamily:"Georgia, serif", flexShrink:0 }}>
            {profile?.is_admin ? UI_SVG.crown(GOLD, 24) : `${profile?.name?.[0]}${(profile?.surname||"")[0]||""}`.toUpperCase()}
          </div>
          <div>
            <div style={{ ...T.modTitle }}>{`${profile?.name || ""} ${profile?.surname || ""}`}</div>
            <div style={{ color:T.modSub.color, fontSize:12 }}>{profile?.restaurant}</div>
            {/* Звание из Книги отзывов */}
            {(() => { const bs = bookStats(MODULES, completed, quizDone, examResults); return (
              <div style={{ display:"inline-flex", alignItems:"center", gap:5, marginTop:5, border:`1px solid ${GOLD}55`, background:"rgba(200,169,110,0.08)", borderRadius:12, padding:"3px 9px" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.6 7.6"/><circle cx="11" cy="11" r="1.6"/></svg>
                <span style={{ color:GOLD, fontSize:11, fontWeight:"bold" }}>{bs.rank.label}</span>
                <span style={{ color:T.modSub.color, fontSize:10 }}>· {bs.pages} стр.</span>
              </div>
            ); })()}
          </div>
        </div>

        {/* Ключевые цифры */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
          {[
            { label:"Средний балл", value:`${avgScore}%`, icon:"target", color:GOLD },
            { label:"Тестов пройдено", value:totalTests, icon:"quiz", color:"#7C9E87" },
            { label:"На 100%", value:perfect, icon:"diamond", color:"#8B7BAB" },
            { label:"Звёзды практики", value:`⭐ ${myStars}`, icon:"trophy", color:"#E8A020" },
            { label:"Уроков пройдено", value:completedLessons, icon:"book", color:"#7B8FAB" },
            { label:"Ролей завершено", value:`${rolesCompleted}/4`, icon:"gradcap", color:GOLD },
          ].map((s, i) => (
            <div key={i} style={{ ...T.modCard, flexDirection:"column", gap:4, padding:"12px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", height:24 }}>{UI_SVG[s.icon] ? UI_SVG[s.icon](s.color, 22) : s.icon}</div>
              <div style={{ color:s.color, fontSize: T.modSub?.fontSize ? T.modSub.fontSize + 10 : 20, fontWeight:"bold", fontFamily:"Georgia, serif" }}>{s.value}</div>
              <div style={{ color:T.modSub.color, fontSize: T.modSub?.fontSize || 15 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Прогресс по ролям */}
        <div style={{ color:T.modSub.color, fontSize:10, letterSpacing:3, fontFamily:"monospace", marginBottom:8 }}>ПРОГРЕСС ПО РОЛЯМ</div>
        {ROLE_ORDER.map(r => {
          const roleScores = myScores.filter(s => s.role === r);
          const avg = roleScores.length > 0 ? Math.round(roleScores.reduce((s, x) => s + x.pct, 0) / roleScores.length) : 0;
          const done = completedRoles.has(r) && roleScores.length > 0;
          const roleAllIds = new Set((MODULES[r] || []).flatMap(m => m.lessons.filter(l => l.type !== "result").map(l => l.id)));
          const roleQuizIds = new Set((MODULES[r] || []).flatMap(m => m.lessons.filter(l => l.type === "quiz").map(l => l.id)));
          const lessonDone = Object.keys(completed).filter(k => completed[k] && roleAllIds.has(k) && !roleQuizIds.has(k)).length;
          const quizzesDone = Object.keys(quizDone).filter(k => quizDone[k] && roleQuizIds.has(k)).length;
          const totalDone = lessonDone + quizzesDone;
          const lessonTotal = roleAllIds.size;
          const lessonPct = lessonTotal > 0 ? Math.round((totalDone / lessonTotal) * 100) : 0;
          const displayPct = lessonPct;
          const hasAnyProgress = totalDone > 0;
          return (
            <div key={r} style={{ ...T.modCard, marginBottom:8, gap:12, opacity: done || hasAnyProgress ? 1 : 0.4 }}>
              <div style={{ flexShrink:0, display:"flex", alignItems:"center" }}>{ROLE_SVG[r] ? ROLE_SVG[r](roleColor[r], 24) : roleIcon[r]}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <div style={{ ...T.modTitle, fontSize: T.modTitle?.fontSize || 17 }}>{roleLabel[r]}</div>
                  <div style={{ color:roleColor[r], fontSize: T.modSub?.fontSize || 15, fontWeight:"bold" }}>
                    {done ? "✓ Завершено" : hasAnyProgress ? `${displayPct}%` : "Не начато"}
                  </div>
                </div>
                <div style={{ height:4, background:T.progBar.background, borderRadius:2, overflow:"hidden" }}>
                  <div style={{ width:`${displayPct}%`, height:"100%", background:roleColor[r], borderRadius:2, transition:"width 0.5s" }} />
                </div>
                <div style={{ color:T.modSub.color, fontSize: T.modSub?.fontSize || 15, marginTop:4 }}>{totalDone} из {lessonTotal} · {roleScores.length} тест{roleScores.length === 1 ? "" : roleScores.length < 5 ? "а" : "ов"} пройдено</div>
              </div>
            </div>
          );
        })}

        {/* Последние результаты */}
        {myScores.length > 0 && (
          <>
            <div style={{ color:T.modSub.color, fontSize:10, letterSpacing:3, fontFamily:"monospace", margin:"12px 0 8px" }}>ПОСЛЕДНИЕ ТЕСТЫ</div>
            {[...myScores].reverse().slice(0, 5).map((s, i) => (
              <div key={i} style={{ ...T.lessCard, marginBottom:8, flexDirection:"column", gap:4 }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <div style={{ ...T.lessTitle, fontSize:13, flex:1, marginRight:8 }}>{s.quizTitle}</div>
                  <div style={{ color: s.pct>=80?"#81C784":s.pct>=50?GOLD:"#e57373", fontWeight:"bold" }}>{s.pct}%</div>
                </div>
                <div style={{ color:T.modSub.color, fontSize:11 }}>{roleLabel[s.role]} · {s.date}</div>
                <div style={{ height:3, background:T.progBar.background, borderRadius:2, overflow:"hidden" }}>
                  <div style={{ width:`${s.pct}%`, height:"100%", background: s.pct>=80?"#81C784":s.pct>=50?GOLD:"#e57373" }} />
                </div>
              </div>
            ))}
          </>
        )}

        {myScores.length === 0 && (
          <div style={{ textAlign:"center", padding:"32px 0", color:T.modSub.color }}>
            <div style={{ fontSize:40, marginBottom:8 }}>📭</div>
            <div>Пока нет результатов</div>
            <div style={{ fontSize:12, marginTop:4 }}>Пройди первый тест!</div>
          </div>
        )}

        {/* Сброс статистики — только для админа */}
        {onResetPlayer && (() => {
          const profilePlayers = allProfiles.map(p => ({ name: p.name, surname: p.surname || "", restaurant: p.restaurant || "", position: p.position || "waiter" }));
          const scorePlayers = [...new Map(scores.map(s => [`${s.name}|${s.surname}`, s])).values()];
          const allKeys = new Set([...profilePlayers.map(p => `${p.name}|${p.surname}`), ...scorePlayers.map(p => `${p.name}|${p.surname}`)]);
          const players = [...allKeys].map(key => scorePlayers.find(p => `${p.name}|${p.surname}` === key) || profilePlayers.find(p => `${p.name}|${p.surname}` === key)).filter(Boolean);
          return players.length > 0 ? (
            <>
              <div style={{ color:T.modSub.color, fontSize:10, letterSpacing:3, fontFamily:"monospace", margin:"16px 0 8px" }}>УПРАВЛЕНИЕ ДАННЫМИ</div>
              {players.map((p, i) => (
                <PlayerResetCard key={i} p={p} T={T} onResetPlayer={onResetPlayer} onUnlockQuiz={onUnlockQuiz} onViewPlayer={onViewPlayer} />
              ))}
            </>
          ) : null;
        })()}
      </div>
    </div>
  );
}

export const PS = {
  fieldBase: { width:"100%", padding:"14px 16px", borderRadius:14, color:"#EEE4CC", fontSize:15, fontFamily:"Georgia, serif", outline:"none", boxSizing:"border-box", transition:"all 0.25s ease" },
  fieldNormal: { border:"1px solid rgba(180,138,55,0.45)", borderTop:"1px solid rgba(210,165,65,0.38)", background:"linear-gradient(155deg, rgba(55,40,16,0.65) 0%, rgba(38,26,10,0.55) 100%)", boxShadow:"0 4px 14px rgba(0,0,0,0.3), 0 1px 0 rgba(200,160,60,0.14) inset" },
  fieldFocus:  { border:"1px solid rgba(200,160,80,0.6)", borderTop:"1px solid rgba(220,175,75,0.7)", background:"linear-gradient(155deg, rgba(58,42,16,0.7) 0%, rgba(40,28,8,0.6) 100%)", boxShadow:"0 0 0 3px rgba(200,160,80,0.1), 0 4px 14px rgba(0,0,0,0.3), 0 1px 0 rgba(200,160,60,0.15) inset" },
  lblEmpty:  { color:"#8A7055",             fontSize:10, letterSpacing:2.5, fontFamily:"monospace", textTransform:"uppercase", marginBottom:7, display:"block" },
  lblFilled: { color:"rgba(220,175,80,1.0)", fontSize:10, letterSpacing:2.5, fontFamily:"monospace", textTransform:"uppercase", marginBottom:7, display:"block" },
};

export function ProfileScreen({ onDone, T }) {
  const [name, setName] = React.useState("");
  const [surname, setSurname] = React.useState("");
  const [restaurant, setRestaurant] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [showPositionSheet, setShowPositionSheet] = React.useState(false);
  const positionRef = React.useRef(null);
  const [saving, setSaving] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [focusedField, setFocusedField] = React.useState(null);

  const isAdminLogin = name.trim() === "RomanPersAdmin";
  const isValid = name.trim().length >= 2 && (isAdminLogin || surname.trim().length >= 2) && restaurant.trim().length >= 2 && position !== "";

  const handleSave = React.useCallback(async () => {
    if (!isValid || saving) return;
    setSaving(true);
    const p = { name: name.trim(), surname: name.trim() === "RomanPersAdmin" ? "" : surname.trim(), restaurant: restaurant.trim(), position };
    try { localStorage.setItem("sa_profile", JSON.stringify(p)); } catch(e) {}
    // Сохраняем профиль в Supabase при регистрации
    fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ name: p.name, surname: p.surname, restaurant: p.restaurant, position: p.position, updated_at: new Date().toISOString() })
    }).catch(() => {});
    setDone(true);
    setTimeout(() => onDone(p), 900);
  }, [isValid, saving, name, surname, restaurant, position, onDone]);

  // Стабильные колбэки — не пересоздаются при вводе текста
  const onFocusName       = React.useCallback(() => setFocusedField("name"),       []);
  const onFocusSurname    = React.useCallback(() => setFocusedField("surname"),    []);
  const onFocusRestaurant = React.useCallback(() => setFocusedField("restaurant"), []);
  const onBlurAll         = React.useCallback(() => setFocusedField(null),         []);
  const onChangeName       = React.useCallback(e => setName(e.target.value),       []);
  const onChangeSurname    = React.useCallback(e => setSurname(e.target.value),    []);
  const onChangeRestaurant = React.useCallback(e => setRestaurant(e.target.value), []);

  const fName       = { ...PS.fieldBase, ...(focusedField==="name"       ? PS.fieldFocus : PS.fieldNormal) };
  const fSurname    = { ...PS.fieldBase, ...(focusedField==="surname"    ? PS.fieldFocus : PS.fieldNormal) };
  const fRestaurant = { ...PS.fieldBase, ...(focusedField==="restaurant" ? PS.fieldFocus : PS.fieldNormal) };

  return (
    <div style={{ ...T.screen, background:"linear-gradient(160deg, #14100A 0%, #1C1509 50%, #14110A 100%)" }} className="sa-screen">

      {/* Фоновые декоративные огни */}
      <div style={{ position:"absolute", top:-80, left:-60, width:280, height:280, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(200,160,80,0.08) 0%, transparent 70%)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:-60, right:-40, width:220, height:220, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(93,187,138,0.06) 0%, transparent 70%)", pointerEvents:"none" }} />

      <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh", display:"flex", flexDirection:"column", overflowY:"auto" }}>

        {/* Шапка */}
        <div style={{ padding:"32px 28px 20px", textAlign:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
            <div style={{ flex:1, height:1, background:"linear-gradient(to right, transparent, rgba(200,160,80,0.3))" }} />
            <div style={{ color:"rgba(200,160,80,0.6)", fontSize:10, letterSpacing:4, fontFamily:"monospace" }}>SERVICE ACADEMY</div>
            <div style={{ flex:1, height:1, background:"linear-gradient(to left, transparent, rgba(200,160,80,0.3))" }} />
          </div>

          <div style={{ display:"flex", justifyContent:"center", margin:"0 auto 20px" }}>
            <img src={LOGO_SRC_DARK} alt="Service Academy" style={{ width:130, height:104, objectFit:"contain", display:"block", filter:"brightness(0) saturate(100%) invert(95%) sepia(10%) saturate(400%) hue-rotate(340deg) brightness(98%)" }} />
          </div>

          <div style={{ color:CREAM, fontSize:24, fontWeight:"bold", marginBottom:8, letterSpacing:0.3 }}>
            Добро пожаловать
          </div>
          <div style={{ color:MUTED_2, fontSize:13, lineHeight:1.7 }}>
            Заполните данные — результаты тестов<br/>попадут в общий рейтинг команды
          </div>
        </div>

        {/* Форма */}
        <div style={{ flex:1, padding:"0 24px 40px" }}>

          <div style={{ background:"linear-gradient(155deg, #382810 0%, #281C08 100%)", borderRadius:22, padding:"24px 20px",
            border:"1px solid rgba(150,112,42,0.38)", borderTop:"1px solid rgba(215,170,68,0.46)",
            boxShadow:"0 8px 28px rgba(0,0,0,0.55), 0 2px 0 rgba(200,160,60,0.18) inset, 0 -2px 4px rgba(0,0,0,0.38) inset", marginBottom:16 }}>

            {/* Имя */}
            <div style={{ marginBottom:18 }}>
              <label style={name.length > 0 ? PS.lblFilled : PS.lblEmpty}>Имя</label>
              <input style={fName} value={name} onChange={onChangeName} onFocus={onFocusName} onBlur={onBlurAll} maxLength={30} />
            </div>

            {/* Фамилия */}
            <div style={{ marginBottom:18 }}>
              <label style={surname.length > 0 ? PS.lblFilled : PS.lblEmpty}>Фамилия</label>
              <input style={fSurname} value={surname} onChange={onChangeSurname} onFocus={onFocusSurname} onBlur={onBlurAll} maxLength={30} />
            </div>

            <div style={{ height:1, background:"rgba(255,220,140,0.07)", margin:"4px 0 18px" }} />

            {/* Ресторан */}
            <div style={{ marginBottom:18 }}>
              <label style={restaurant.length > 0 ? PS.lblFilled : PS.lblEmpty}>Ресторан</label>
              <input style={fRestaurant} value={restaurant} onChange={onChangeRestaurant} onFocus={onFocusRestaurant} onBlur={onBlurAll} maxLength={40} />
            </div>

            <div style={{ height:1, background:"rgba(255,220,140,0.07)", margin:"4px 0 18px" }} />

            {/* Должность — inline раскрывающийся список */}
            <div ref={positionRef}>
              <label style={position ? PS.lblFilled : PS.lblEmpty}>Должность</label>
              <div onClick={() => {
                  const next = !showPositionSheet;
                  setShowPositionSheet(next);
                  if (next) setTimeout(() => positionRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 50);
                }} {...onActivate(() => {
                  const next = !showPositionSheet;
                  setShowPositionSheet(next);
                  if (next) setTimeout(() => positionRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 50);
                })}
                style={{ ...PS.fieldBase, ...(position ? PS.fieldFocus : PS.fieldNormal),
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  cursor:"pointer", userSelect:"none" }}>
                <span style={{ color: position ? CREAM : "#9A8060", fontSize:15 }}>
                  {position ? <span style={{ display:"inline-flex", alignItems:"center", gap:7 }}>{POS_SVG[position] && POS_SVG[position](GOLD, 16)}{({waiter:"Официант", hostess:"Хостес", manager:"Менеджер", senior:"Руководящий состав"})[position]}</span> : "Выбери должность"}
                </span>
                <span style={{ color:"#C8A870", fontSize:14, transition:"transform 0.2s", display:"inline-block", transform: showPositionSheet ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
              </div>
              {showPositionSheet && (
                <div className="sa-fast" style={{ marginTop:8, display:"flex", flexDirection:"column", gap:6 }}>
                  {[
                    { id:"waiter",  icon:"🍽️", label:"Официант",           sub:"Обслуживание гостей" },
                    { id:"hostess", icon:"🛎️", label:"Хостес",             sub:"Служба приёма гостей" },
                    { id:"manager", icon:"🎯", label:"Менеджер",            sub:"Управление залом и командой" },
                    { id:"senior",  icon:"🏛️", label:"Руководящий состав", sub:"Управляющий, Директор" },
                  ].map(pos => (
                    <div key={pos.id} onClick={() => { setPosition(pos.id); setShowPositionSheet(false); }} {...onActivate(() => { setPosition(pos.id); setShowPositionSheet(false); })}
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 14px", borderRadius:13, cursor:"pointer",
                        background: position === pos.id ? "linear-gradient(155deg, rgba(58,42,16,0.8), rgba(40,28,8,0.7))" : "linear-gradient(155deg, rgba(40,28,10,0.5), rgba(28,18,6,0.4))",
                        border: position === pos.id ? "1px solid rgba(200,160,80,0.45)" : "1px solid rgba(150,112,42,0.20)",
                        borderTop: position === pos.id ? "1px solid rgba(220,175,75,0.55)" : "1px solid rgba(180,140,50,0.15)",
                        boxShadow: position === pos.id ? "0 4px 14px rgba(0,0,0,0.35), 0 1px 0 rgba(200,160,60,0.15) inset" : "0 2px 8px rgba(0,0,0,0.25)" }}>
                      <div style={{ display:"flex", alignItems:"center" }}>{POS_SVG[pos.id] ? POS_SVG[pos.id](position === pos.id ? GOLD : "#9A8060", 22) : pos.icon}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ color: position === pos.id ? CREAM : "#A89880", fontSize:14, fontWeight:"bold", fontFamily:"Georgia, serif" }}>{pos.label}</div>
                        <div style={{ color:MUTED_2, fontSize:11, marginTop:1 }}>{pos.sub}</div>
                      </div>
                      {position === pos.id && <div style={{ color:GOLD, fontSize:16 }}>✓</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Индикатор заполнения */}
          <div style={{ display:"flex", gap:6, marginBottom:20, padding:"0 4px" }}>
            {[name, surname, restaurant, position].map((v, i) => (
              <div key={i} style={{ flex:1, height:3, borderRadius:2,
                background: v.trim().length >= 1 ? "rgba(200,160,80,0.7)" : "rgba(255,255,255,0.08)",
                transition:"background 0.3s ease" }} />
            ))}
          </div>

          {/* Кнопка */}
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className={isValid ? "sa-btn sa-btn-pulse" : ""}
            style={{
              width:"100%", padding:"16px", borderRadius:18,
              border: isValid ? "1px solid rgba(200,160,80,0.3)" : "1px solid rgba(255,255,255,0.05)",
              background: done ? "linear-gradient(155deg, rgba(60,140,80,0.5), rgba(40,100,60,0.4))" : isValid ? "linear-gradient(155deg, #3A2A10 0%, #2A1E0A 100%)" : "rgba(255,255,255,0.03)",
              color: done ? GREEN : isValid ? CREAM : "#3C3428",
              fontSize:15, fontWeight:"bold", cursor: isValid ? "pointer" : "default",
              fontFamily:"Georgia, serif", letterSpacing:0.3, transition:"all 0.3s ease",
              boxShadow: isValid && !done ? "0 6px 22px rgba(0,0,0,0.4), 0 2px 0 rgba(210,170,70,0.22) inset, 0 -2px 4px rgba(0,0,0,0.38) inset" : "none",
              borderTop: isValid && !done ? "1px solid rgba(220,175,75,0.50)" : "1px solid rgba(255,255,255,0.05)",
            }}>
            {done ? "✓ Добро пожаловать!" : saving ? "Сохраняем..." : "Начать обучение →"}
          </button>

          <div style={{ textAlign:"center", marginTop:20, color:"#6A5840", fontSize:11, lineHeight:1.6 }}>
            Данные хранятся локально на устройстве<br/>и в общем рейтинге команды
          </div>
        </div>
      </div>
    </div>
  );
}

export const APP_SHARE_URL = "https://service-academy-16te.vercel.app";

export const POS_LABELS = { waiter:"Официант", hostess:"Хостес", manager:"Менеджер", senior:"Руководящий состав" };

export function TeamScreen({ T, profile, a11y }) {
  const [view, setView] = React.useState("list");        // list | add | card | code
  const [list, setList] = React.useState(null);           // null = загрузка
  const [loadError, setLoadError] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState(null);
  const [form, setForm] = React.useState({ name:"", surname:"", restaurant:RESTAURANTS[0], position:"waiter" });
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState(null);
  const [issued, setIssued] = React.useState(null);        // { code, emp }
  const [confirm, setConfirm] = React.useState(null);      // "reset" | "toggle" | null
  const [copied, setCopied] = React.useState(false);

  const token = (() => { try { return localStorage.getItem("sa_session_token"); } catch(e) { return null; } })();
  const isDemo = !token || token === "demo" || profile?.id === "demo";

  const loadList = React.useCallback(async () => {
    setLoadError(false);
    if (isDemo) {
      const d = (days) => new Date(Date.now() - days*86400000).toISOString();
      setList([
        { id:"demo",  name:"Роман",  surname:"(демо)",   restaurant:RESTAURANTS[0], position:"senior", is_admin:true,  status:"active",   last_seen_at:d(0),  has_pending_code:false, has_session:true },
        { id:"d2",    name:"Иван",   surname:"Петров",   restaurant:RESTAURANTS[0], position:"waiter", is_admin:false, status:"active",   last_seen_at:d(0.3),has_pending_code:false, has_session:true },
        { id:"d3",    name:"Мария",  surname:"Соколова", restaurant:RESTAURANTS[0], position:"manager",is_admin:false, status:"active",   last_seen_at:d(1.5),has_pending_code:false, has_session:true },
        { id:"d4",    name:"Алексей",surname:"Новиков",  restaurant:RESTAURANTS[1], position:"waiter", is_admin:false, status:"active",   last_seen_at:null,  has_pending_code:true,  has_session:false },
        { id:"d5",    name:"Дарья",  surname:"Ким",      restaurant:RESTAURANTS[1], position:"waiter", is_admin:false, status:"active",   last_seen_at:d(12), has_pending_code:false, has_session:true },
        { id:"d6",    name:"Сергей", surname:"Волков",   restaurant:RESTAURANTS[3], position:"waiter", is_admin:false, status:"disabled", last_seen_at:d(30), has_pending_code:false, has_session:false },
      ]);
      return;
    }
    try {
      const res = await rpc("admin_list_employees", { p_token: token });
      if (Array.isArray(res)) setList(res);
      else { setList([]); setLoadError(true); }
    } catch(e) { setList([]); setLoadError(true); }
  }, [token, isDemo]);

  React.useEffect(() => { loadList(); }, [loadList]);

  const ago = (iso) => {
    if (!iso) return "ещё не заходил";
    const days = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (days < 1) return "сегодня";
    if (days < 2) return "вчера";
    return `${Math.floor(days)} дн. назад`;
  };

  const statusOf = (e) => {
    if (e.status === "disabled") return { color:RED, label:"Отключён" };
    if (e.has_pending_code && !e.has_session) return { color:"#D9C75B", label:"Ждёт код" };
    if (!e.last_seen_at || (Date.now() - new Date(e.last_seen_at).getTime()) > 7*86400000)
      return { color:"#9A8C74", label:"Неактивен" };
    return { color:GREEN, label:"Активен" };
  };

  const shareCode = async (code, emp) => {
    const text = `Service Academy — твой код входа: ${code}\n\nОткрой приложение и введи его один раз:\n${APP_SHARE_URL}`;
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch(e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch(e) {}
  };

  const copyCode = async (code) => {
    try { await navigator.clipboard.writeText(code); vibrate("light"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch(e) {}
  };

  const submitAdd = async () => {
    if (busy || form.name.trim().length < 2) return;
    if (isDemo) {
      vibrate("heavy");
      setIssued({ code: "МАРС-" + String(Math.floor(Math.random()*10000)).padStart(4, "0"), emp: { ...form } });
      setForm({ name:"", surname:"", restaurant:form.restaurant, position:"waiter" });
      setView("code");
      return;
    }
    setBusy(true); setActionError(null); vibrate("light");
    try {
      const res = await rpc("admin_create_employee", {
        p_token: token, p_name: form.name, p_surname: form.surname,
        p_restaurant: form.restaurant, p_position: form.position });
      if (res && res.ok) {
        vibrate("heavy");
        setIssued({ code: res.code, emp: { ...form } });
        setForm({ name:"", surname:"", restaurant:form.restaurant, position:"waiter" });
        setView("code");
        loadList();
      } else { vibrate("error"); setActionError("Не получилось создать. Проверь связь и попробуй ещё раз."); }
    } catch(e) { vibrate("error"); setActionError("Нет связи. Попробуй ещё раз."); }
    setBusy(false);
  };

  const doReset = async () => {
    if (busy || !selected) return;
    if (isDemo) {
      vibrate("heavy");
      setIssued({ code: "ВЕГА-" + String(Math.floor(Math.random()*10000)).padStart(4, "0"), emp: selected });
      setConfirm(null); setView("code");
      return;
    }
    setBusy(true); setActionError(null);
    try {
      const res = await rpc("admin_reset_code", { p_token: token, p_employee_id: selected.id });
      if (res && res.ok) {
        vibrate("heavy");
        setIssued({ code: res.code, emp: selected });
        setConfirm(null); setView("code"); loadList();
      } else { vibrate("error"); setActionError("Не получилось. Попробуй ещё раз."); }
    } catch(e) { vibrate("error"); setActionError("Нет связи. Попробуй ещё раз."); }
    setBusy(false);
  };

  const doToggle = async () => {
    if (busy || !selected) return;
    const next = selected.status === "disabled" ? "active" : "disabled";
    if (isDemo) {
      vibrate("success");
      setSelected({ ...selected, status: next });
      setList(l => (l || []).map(e => e.id === selected.id ? { ...e, status: next } : e));
      setConfirm(null);
      return;
    }
    setBusy(true); setActionError(null);
    try {
      const res = await rpc("admin_set_status", { p_token: token, p_employee_id: selected.id, p_status: next });
      if (res && res.ok) {
        vibrate("success");
        setSelected({ ...selected, status: next });
        setConfirm(null); loadList();
      } else { vibrate("error"); setActionError("Не получилось. Попробуй ещё раз."); }
    } catch(e) { vibrate("error"); setActionError("Нет связи. Попробуй ещё раз."); }
    setBusy(false);
  };

  const doDelete = async () => {
    if (busy || !selected) return;
    if (isDemo) {
      vibrate("success");
      setList(l => (l || []).filter(e => e.id !== selected.id));
      setConfirm(null); setSelected(null); setView("list");
      return;
    }
    setBusy(true); setActionError(null);
    try {
      const res = await rpc("admin_delete_employee", { p_token: token, p_employee_id: selected.id });
      if (res && res.ok) {
        vibrate("success");
        setConfirm(null); setSelected(null); setView("list"); loadList();
      } else { vibrate("error"); setActionError("Не получилось удалить. Попробуй ещё раз."); }
    } catch(e) { vibrate("error"); setActionError("Нет связи. Попробуй ещё раз."); }
    setBusy(false);
  };

  const inputStyle = {
    width:"100%", padding:"13px 14px", borderRadius:12, fontSize:15,
    fontFamily:"Georgia, serif",
    background: a11y ? "rgba(255,255,255,0.7)" : "rgba(20,14,6,0.5)",
    color: a11y ? "#3A2E1C" : CREAM,
    border: a11y ? "1px solid rgba(160,120,60,0.45)" : "1px solid rgba(200,160,80,0.35)",
    outline:"none", boxSizing:"border-box"
  };
  const chip = (active) => ({
    padding:"8px 13px", borderRadius:20, fontSize:12.5, fontFamily:"Georgia, serif", cursor:"pointer",
    border: active ? (a11y ? "1.5px solid #8B6A30" : "1px solid #C8A96E") : (a11y ? "1px solid rgba(160,120,60,0.4)" : "1px solid rgba(200,160,80,0.3)"),
    background: active ? (a11y ? "rgba(139,106,48,0.14)" : "rgba(200,169,110,0.18)") : "transparent",
    color: active ? (a11y ? "#6B4E1A" : "#E8D9B8") : (a11y ? "#7A6A50" : "#9A8C74"),
    fontWeight: active ? "bold" : "normal",
    transition:"all 0.2s ease"
  });
  const goldBtn = {
    padding:"14px", borderRadius:14, border:"none", width:"100%",
    fontSize:16, fontFamily:"Georgia, serif", fontWeight:"bold", cursor:"pointer",
    color:"#fff", background:"linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)",
    boxShadow:"0 4px 18px rgba(200,160,80,0.25)"
  };
  const ghostBtn = {
    padding:"13px", borderRadius:14, width:"100%", cursor:"pointer",
    border: a11y ? "1px solid rgba(139,106,48,0.55)" : "1px solid rgba(200,160,80,0.4)",
    background:"transparent",
    color: a11y ? "#8B6A30" : GOLD, fontSize:14, fontFamily:"Georgia, serif"
  };

  // ── Сводка ──
  const summary = React.useMemo(() => {
    if (!list) return null;
    const act = list.filter(e => statusOf(e).label === "Активен").length;
    const wait = list.filter(e => statusOf(e).label === "Ждёт код").length;
    const sleep = list.filter(e => statusOf(e).label === "Неактивен").length;
    return { act, wait, sleep, total: list.length };
  }, [list]);

  // ── Группировка по ресторанам + поиск ──
  const groups = React.useMemo(() => {
    if (!list) return [];
    const q = search.trim().toLowerCase();
    const filtered = q ? list.filter(e =>
      `${e.name} ${e.surname} ${e.restaurant}`.toLowerCase().includes(q)) : list;
    const map = new Map();
    filtered.forEach(e => {
      if (!map.has(e.restaurant)) map.set(e.restaurant, []);
      map.get(e.restaurant).push(e);
    });
    return [...map.entries()];
  }, [list, search]);

  // ════════ ЭКРАН: КОД ВЫДАН ════════
  if (view === "code" && issued) {
    return (
      <div style={T.screen} className="sa-screen">
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"30px 24px 100px" }}>
          <div style={{ marginBottom:14 }}>{UI_SVG.checkCircle(GREEN, 40)}</div>
          <div style={{ color:T.modTitle.color, fontSize:18, fontWeight:"bold", fontFamily:"Georgia, serif", textAlign:"center" }}>
            {issued.emp.name} {issued.emp.surname}
          </div>
          <div style={{ color:T.modSub.color, fontSize:12.5, marginTop:4, marginBottom:24 }}>{issued.emp.restaurant}</div>

          <div style={{ color:"#9A8C74", fontSize:10.5, letterSpacing:2, fontFamily:"monospace", marginBottom:10 }}>КОД ДОСТУПА</div>
          <div onClick={() => copyCode(issued.code)} {...onActivate(() => copyCode(issued.code))} style={{
            fontSize:34, fontWeight:"bold", fontFamily:"Georgia, serif", letterSpacing:5, color: a11y ? "#4A3A20" : CREAM,
            padding:"18px 28px", borderRadius:18, cursor:"pointer",
            background:"rgba(200,169,110,0.12)", border:"1.5px solid rgba(200,160,80,0.5)",
            boxShadow:"0 6px 24px rgba(200,160,80,0.18)" }}>
            {issued.code}
          </div>
          <div style={{ color: copied ? GREEN : MUTED_2, fontSize:11.5, marginTop:10, transition:"color 0.3s" }}>
            {copied ? "✓ Скопировано" : "Нажми на код, чтобы скопировать"}
          </div>

          <div style={{ color:"#B8956A", fontSize:12.5, lineHeight:1.7, textAlign:"center", maxWidth:300, margin:"22px 0" }}>
            Код показывается <b>только сейчас</b> — отправь его сразу. Вводится один раз на одном устройстве.
          </div>

          <button className="sa-btn" style={{ ...goldBtn, maxWidth:300 }} onClick={() => shareCode(issued.code, issued.emp)}>
            Поделиться кодом
          </button>
          <button className="sa-btn" style={{ ...ghostBtn, maxWidth:300, marginTop:10 }}
            onClick={() => { setIssued(null); setSelected(null); setView("list"); }}>
            Готово
          </button>
        </div>
      </div>
    );
  }

  // ════════ ЭКРАН: ДОБАВЛЕНИЕ ════════
  if (view === "add") {
    return (
      <div style={T.screen} className="sa-screen">
        <div style={T.lessHead}>
          <button style={T.backBtn2} onClick={() => setView("list")}>‹</button>
          <div style={T.lessHeadTitle}>Новый сотрудник</div>
        </div>
        <div style={{ flex:1, padding:"18px 18px 110px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <input style={inputStyle} placeholder="Имя" value={form.name}
              onChange={e => setForm({ ...form, name:e.target.value })} />
            <input style={inputStyle} placeholder="Фамилия" value={form.surname}
              onChange={e => setForm({ ...form, surname:e.target.value })} />
          </div>

          <div style={{ color:"#9A8C74", fontSize:10.5, letterSpacing:2, fontFamily:"monospace", margin:"20px 0 10px" }}>РЕСТОРАН</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {RESTAURANTS.map(r => (
              <div key={r} className={"sa-btn" + (form.restaurant === r ? " sa-chip-on" : "")}
                style={chip(form.restaurant === r)}
                onClick={() => { vibrate("light"); setForm({ ...form, restaurant:r }); }} {...onActivate(() => { vibrate("light"); setForm({ ...form, restaurant:r }); })}>{r}</div>
            ))}
          </div>

          <div style={{ color:"#9A8C74", fontSize:10.5, letterSpacing:2, fontFamily:"monospace", margin:"20px 0 10px" }}>ДОЛЖНОСТЬ</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {Object.entries(POS_LABELS).map(([id, label]) => (
              <div key={id} className={"sa-btn" + (form.position === id ? " sa-chip-on" : "")}
                style={chip(form.position === id)}
                onClick={() => { vibrate("light"); setForm({ ...form, position:id }); }} {...onActivate(() => { vibrate("light"); setForm({ ...form, position:id }); })}>{label}</div>
            ))}
          </div>

          {actionError && <div className="sa-fast" style={{ color:RED, fontSize:13, marginTop:16 }}>{actionError}</div>}

          <button className="sa-btn" style={{ ...goldBtn, marginTop:24, opacity: form.name.trim().length < 2 ? 0.5 : 1 }}
            disabled={busy} onClick={submitAdd}>
            {busy ? "Создаём..." : "Создать и получить код"}
          </button>
        </div>
      </div>
    );
  }

  // ════════ ЭКРАН: КАРТОЧКА СОТРУДНИКА ════════
  if (view === "card" && selected) {
    const st = statusOf(selected);
    const isSelf = selected.id === profile?.id;
    return (
      <div style={T.screen} className="sa-screen">
        <div style={T.lessHead}>
          <button style={T.backBtn2} onClick={() => { setSelected(null); setConfirm(null); setActionError(null); setView("list"); }}>‹</button>
          <div style={T.lessHeadTitle}>Сотрудник</div>
        </div>
        <div style={{ flex:1, padding:"18px 18px 110px" }}>
          <div style={{ ...T.modCard, gap:14, marginBottom:14 }}>
            <div style={{ width:50, height:50, borderRadius:"50%", flexShrink:0,
              background:"linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ color:"#fff", fontSize:16, fontWeight:"bold", fontFamily:"Georgia, serif", display:"inline-flex", alignItems:"center" }}>
                {selected.is_admin ? UI_SVG.crown("#fff", 22) : `${selected.name?.[0] || ""}${(selected.surname||"")[0]||""}`.toUpperCase()}
              </span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:T.modTitle.color, fontSize:16.5, fontWeight:"bold", fontFamily:"Georgia, serif" }}>
                {selected.name} {selected.surname}
                {isSelf && <span style={{ marginLeft:8, fontSize:9, letterSpacing:1.5, color:GOLD, border:"1px solid rgba(200,169,110,0.45)", borderRadius:8, padding:"2px 7px", verticalAlign:"2px", fontFamily:"monospace" }}>ЭТО ТЫ</span>}
              </div>
              <div style={{ color:"#C8A870", fontSize:12.5, marginTop:3 }}>{selected.restaurant} · {POS_LABELS[selected.position] || selected.position}</div>
            </div>
          </div>

          <div style={{ ...T.modCard, flexDirection:"column", alignItems:"stretch", gap:10, marginBottom:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ color:T.modSub.color, fontSize:13 }}>Статус</span>
              <span style={{ display:"inline-flex", alignItems:"center", gap:7, color:st.color, fontSize:13.5, fontWeight:"bold" }}>
                <span style={{ width:8, height:8, borderRadius:4, background:st.color, boxShadow:`0 0 8px ${st.color}66` }} />{st.label}
              </span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:T.modSub.color, fontSize:13 }}>Был в приложении</span>
              <span style={{ color:T.para.color, fontSize:13.5 }}>{ago(selected.last_seen_at)}</span>
            </div>
            {selected.has_pending_code && (
              <div style={{ color:"#D9C75B", fontSize:12, lineHeight:1.6 }}>
                Выдан код, ещё не активирован.
              </div>
            )}
          </div>

          {actionError && <div className="sa-fast" style={{ color:RED, fontSize:13, marginBottom:14 }}>{actionError}</div>}

          {isSelf ? (
            <div style={{ color:T.modSub.color, fontSize:12.5, lineHeight:1.7, textAlign:"center", padding:"0 10px" }}>
              Свою запись изменить нельзя — чтобы случайно не закрыть себе вход. 😉 Новый код себе можно выдать через SQL.
            </div>
          ) : confirm === "reset" ? (
            <div className="sa-fast">
              <div style={{ color:T.para.color, fontSize:13, lineHeight:1.7, textAlign:"center", marginBottom:12 }}>
                Старый код и все входы на устройствах перестанут работать. Выдать новый код?
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="sa-btn" style={{ ...ghostBtn, flex:1 }} onClick={() => setConfirm(null)}>Отмена</button>
                <button className="sa-btn" style={{ ...goldBtn, flex:1 }} disabled={busy} onClick={doReset}>{busy ? "..." : "Выдать"}</button>
              </div>
            </div>
          ) : confirm === "toggle" ? (
            <div className="sa-fast">
              <div style={{ color:T.para.color, fontSize:13, lineHeight:1.7, textAlign:"center", marginBottom:12 }}>
                {selected.status === "disabled"
                  ? "Вернуть доступ? Для входа понадобится выдать новый код."
                  : "Закрыть доступ? Человек выйдет из приложения, но вся его история сохранится."}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="sa-btn" style={{ ...ghostBtn, flex:1 }} onClick={() => setConfirm(null)}>Отмена</button>
                <button className="sa-btn" disabled={busy} onClick={doToggle}
                  style={{ flex:1, padding:"13px", borderRadius:14, border:"none", fontSize:14, fontFamily:"Georgia, serif", fontWeight:"bold", cursor:"pointer",
                    background: selected.status === "disabled" ? GREEN : RED, color:"#fff" }}>
                  {busy ? "..." : selected.status === "disabled" ? "Включить" : "Отключить"}
                </button>
              </div>
            </div>
          ) : confirm === "delete" ? (
            <div className="sa-fast">
              <div style={{ color:T.para.color, fontSize:13, lineHeight:1.7, textAlign:"center", marginBottom:12 }}>
                Удалить <b>{selected.name} {selected.surname}</b> из команды? Профиль, прогресс, результаты и код входа будут стёрты безвозвратно.
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="sa-btn" style={{ ...ghostBtn, flex:1 }} onClick={() => setConfirm(null)}>Отмена</button>
                <button className="sa-btn" disabled={busy} onClick={doDelete}
                  style={{ flex:1, padding:"13px", borderRadius:14, border:"none", fontSize:14, fontFamily:"Georgia, serif", fontWeight:"bold", cursor:"pointer", background:RED, color:"#fff" }}>
                  {busy ? "..." : "Удалить"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <button className="sa-btn" style={goldBtn} onClick={() => setConfirm("reset")}>
                Сбросить код (новое устройство)
              </button>
              <button className="sa-btn" onClick={() => setConfirm("toggle")}
                style={{ ...ghostBtn,
                  border: selected.status === "disabled" ? "1px solid rgba(93,187,138,0.5)" : "1px solid rgba(224,120,120,0.45)",
                  color: selected.status === "disabled" ? GREEN : RED }}>
                {selected.status === "disabled" ? "Включить доступ" : "Отключить доступ"}
              </button>
              <button className="sa-btn" onClick={() => setConfirm("delete")}
                style={{ ...ghostBtn, border:"1px solid rgba(224,120,120,0.55)", color:RED, marginTop:2 }}>
                Удалить из команды
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════ ЭКРАН: СПИСОК ════════
  return (
    <div style={T.screen} className="sa-screen">
      <div style={{ padding:"18px 18px 110px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>
            {NAV_ICONS.team(GOLD)}<span>Команда</span>
          </div>
          <button className="sa-btn" onClick={() => { setActionError(null); setView("add"); }}
            style={{ padding:"9px 16px", borderRadius:20, border:"none", fontSize:13.5, fontFamily:"Georgia, serif", fontWeight:"bold", cursor:"pointer",
              color:"#fff", background:"linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)", boxShadow:"0 3px 12px rgba(200,160,80,0.3)" }}>
            + Добавить
          </button>
        </div>

        {summary && (
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            {[
              { n: summary.act,   label:"активных", c:GREEN },
              { n: summary.wait,  label:"ждут код", c:"#D9C75B" },
              { n: summary.sleep, label:"спят 7д+", c:"#9A8C74" },
            ].map((s, i) => (
              <div key={i} style={{ flex:1, minWidth:88, textAlign:"center", padding:"10px 6px", borderRadius:14,
                background:"rgba(200,169,110,0.07)", border:"1px solid rgba(200,160,80,0.2)" }}>
                <div style={{ color:s.c, fontSize:20, fontWeight:"bold", fontFamily:"Georgia, serif" }}>{s.n}</div>
                <div style={{ color:T.modSub.color, fontSize:10.5, marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <input style={{ ...inputStyle, marginBottom:16 }} placeholder="Поиск по имени или ресторану..."
          value={search} onChange={e => setSearch(e.target.value)} />

        {list === null && <div style={{ color:T.modSub.color, fontSize:13, textAlign:"center", padding:"30px 0" }}>Загружаем команду...</div>}

        {loadError && (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ color:RED, fontSize:13, marginBottom:12 }}>Не получилось загрузить список.</div>
            <button className="sa-btn" style={{ ...ghostBtn, width:"auto", padding:"10px 24px" }} onClick={() => { setList(null); loadList(); }}>Повторить</button>
          </div>
        )}

        {list !== null && !loadError && groups.length === 0 && (
          <div style={{ color:T.modSub.color, fontSize:13, textAlign:"center", padding:"30px 10px", lineHeight:1.7 }}>
            {search ? "Никого не нашлось по такому запросу." : "Пока только ты. Нажми «+ Добавить» — и выдай первый код. 🚀"}
          </div>
        )}

        {groups.map(([rest, emps]) => (
          <div key={rest} style={{ marginBottom:18 }}>
            <div style={{ color:"#9A8C74", fontSize:10.5, letterSpacing:2, fontFamily:"monospace", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
              {UI_SVG.building("#9A8C74", 11)}<span>{rest.toUpperCase()}</span>
              <span style={{ opacity:0.6 }}>· {emps.length}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {emps.map(e => {
                const st = statusOf(e);
                return (
                  <div key={e.id} className="sa-btn" onClick={() => { vibrate("light"); setSelected(e); setConfirm(null); setActionError(null); setView("card"); }} {...onActivate(() => { vibrate("light"); setSelected(e); setConfirm(null); setActionError(null); setView("card"); })}
                    style={{ ...T.modCard, gap:12, cursor:"pointer", padding:"13px 14px" }}>
                    <span style={{ width:9, height:9, borderRadius:5, flexShrink:0, background:st.color, boxShadow:`0 0 8px ${st.color}55` }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:T.modTitle.color, fontSize:14.5, fontWeight:"bold", fontFamily:"Georgia, serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {e.name} {e.surname}
                        {e.is_admin && <span style={{ marginLeft:6, fontSize:8, letterSpacing:1, color:GOLD, border:"1px solid rgba(200,169,110,0.4)", borderRadius:6, padding:"1px 5px", verticalAlign:"2px", fontFamily:"monospace" }}>АДМИН</span>}
                      </div>
                      <div style={{ color:T.modSub.color, fontSize:11.5, marginTop:2 }}>
                        {POS_LABELS[e.position] || e.position} · {ago(e.last_seen_at)}
                      </div>
                    </div>
                    <span style={{ color:st.color, fontSize:10.5, fontFamily:"monospace", flexShrink:0 }}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CodeLoginScreen({ T, onSuccess }) {
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Умное поле: верхний регистр, дефис подставляется сам
  const format = (raw) => {
    let v = (raw || "").toUpperCase().replace(/[\s-]+/g, "").replace(/[^А-ЯЁA-Z0-9]/g, "");
    const m = v.match(/^([А-ЯЁA-Z]+)(\d{0,4})/);
    if (m && m[2].length > 0) v = m[1] + "-" + m[2];
    return v.slice(0, 12);
  };

  const submit = async () => {
    if (busy || code.replace("-", "").length < 6) return;
    // Демо-режим для предпросмотра: не работает на боевом домене
    if (code === "ДЕМО-0000" && !/vercel\.app$/i.test(window.location.hostname)) {
      vibrate("heavy");
      onSuccess(null, { id:"demo", name:"Роман", surname:"(демо)", restaurant:RESTAURANTS[0], position:"senior", is_admin:true });
      return;
    }
    setBusy(true); setError(null); vibrate("light");
    try {
      const res = await rpc("redeem_code", { p_code: code });
      if (res && res.ok) {
        vibrate("heavy");
        onSuccess(res.token, res.employee);
      } else {
        vibrate("error");
        setError(res && res.error === "disabled"
          ? "Доступ отключён. Обратись к администратору."
          : "Код не подходит или уже использован. Проверь и попробуй ещё раз.");
      }
    } catch(e) {
      vibrate("error");
      setError("Нет связи. Проверь интернет и попробуй снова.");
    }
    setBusy(false);
  };

  return (
    <div style={{ ...T.screen, justifyContent:"center", alignItems:"center", padding:"32px 24px",
      background:"linear-gradient(160deg, #241A0C 0%, #14100A 55%, #1C1509 100%)", minHeight:"100vh" }} className="sa-screen">
      <img src={LOGO_SRC_DARK} alt="Service Academy" style={{ width:180, marginBottom:8, filter:"brightness(0) saturate(100%) invert(95%) sepia(10%) saturate(400%) hue-rotate(340deg) brightness(98%)" }} />
      <div style={{ color:CREAM, fontSize:21, fontWeight:"bold", fontFamily:"Georgia, serif", marginBottom:8, textAlign:"center" }}>
        Вход по приглашению
      </div>
      <div style={{ color:"#9A8C74", fontSize:13, lineHeight:1.7, textAlign:"center", maxWidth:300, marginBottom:26 }}>
        Введи код доступа — его выдаёт администратор. Код вводится один раз, дальше вход автоматический.
      </div>
      <input
        value={code}
        onChange={e => { setCode(format(e.target.value)); setError(null); }}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        placeholder="Введите код"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        style={{ width:"100%", maxWidth:280, padding:"16px 18px", borderRadius:16, textAlign:"center",
          fontSize:22, letterSpacing:4, fontFamily:"Georgia, serif", fontWeight:"bold",
          background:"rgba(20,14,6,0.6)", color:CREAM, outline:"none",
          border: error ? "1.5px solid #E07878" : "1.5px solid rgba(200,160,80,0.45)",
          boxShadow:"0 4px 18px rgba(0,0,0,0.35) inset" }}
      />
      {error && (
        <div className="sa-fast" style={{ color:RED, fontSize:13, lineHeight:1.6, textAlign:"center", maxWidth:300, marginTop:12 }}>
          {error}
        </div>
      )}
      <button className="sa-btn sa-btn-pulse" onClick={submit}
        disabled={busy}
        style={{ marginTop:20, width:"100%", maxWidth:280, padding:"15px", borderRadius:16, border:"none",
          fontSize:17, fontFamily:"Georgia, serif", fontWeight:"bold", cursor: busy ? "default" : "pointer",
          color:"#fff", background: busy ? "rgba(200,169,110,0.4)" : "linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)",
          boxShadow:"0 4px 18px rgba(200,160,80,0.3)" }}>
        {busy ? "Проверяем..." : "Войти"}
      </button>
      <div style={{ color:MUTED_2, fontSize:11, marginTop:22, textAlign:"center", lineHeight:1.7 }}>
        Нет кода? Спроси у администратора —<br/>он создаст тебя в системе за минуту.
      </div>
    </div>
  );
}

export function AccountScreen({ profile, T, onBack, onLogout }) {
  const [confirmOut, setConfirmOut] = React.useState(false);
  const posLabel = { waiter:"Официант", hostess:"Хостес", manager:"Менеджер", senior:"Руководящий состав" }[profile?.position] || profile?.position;
  return (
    <div style={T.screen} className="sa-screen">
      <div style={T.lessHead}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Аккаунт</div>
      </div>
      <div style={{ flex:1, padding:"20px 18px 40px" }}>
        <div style={{ ...T.modCard, gap:14, marginBottom:14 }}>
          <div style={{ width:54, height:54, borderRadius:"50%", background:"linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 2px 10px rgba(200,160,80,0.3)" }}>
            <span style={{ color:"#fff", fontSize:18, fontWeight:"bold", fontFamily:"Georgia, serif", display:"inline-flex", alignItems:"center" }}>
              {profile?.is_admin ? UI_SVG.crown("#fff", 24) : `${profile?.name?.[0] || ""}${(profile?.surname||"")[0]||""}`.toUpperCase()}
            </span>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:T.modTitle.color, fontSize:17, fontWeight:"bold", fontFamily:"Georgia, serif" }}>
              {profile?.name} {profile?.surname}
              {profile?.is_admin && <span style={{ marginLeft:8, fontSize:9, letterSpacing:1.5, color:GOLD, border:"1px solid rgba(200,169,110,0.45)", borderRadius:8, padding:"2px 7px", verticalAlign:"2px", fontFamily:"monospace" }}>АДМИН</span>}
            </div>
            <div style={{ color:"#C8A870", fontSize:13, marginTop:4, display:"flex", alignItems:"center", gap:5 }}>
              {UI_SVG.building("#C8A870", 12)}<span>{profile?.restaurant}</span>
            </div>
            <div style={{ color:T.modSub.color, fontSize:12, marginTop:2 }}>{posLabel}</div>
          </div>
        </div>

        <div style={{ color:T.modSub.color, fontSize:12, lineHeight:1.7, padding:"0 4px", marginBottom:20 }}>
          Данные профиля привязаны к твоему коду доступа. Если что-то указано неверно — обратись к администратору.
        </div>

        {!confirmOut ? (
          <button className="sa-btn" onClick={() => setConfirmOut(true)}
            style={{ width:"100%", padding:"14px", borderRadius:14, border:"1px solid rgba(224,120,120,0.45)", background:"rgba(224,120,120,0.10)", color:RED, fontSize:15, fontFamily:"Georgia, serif", cursor:"pointer" }}>
            Выйти с этого устройства
          </button>
        ) : (
          <div className="sa-fast">
            <div style={{ color:T.para.color, fontSize:13, lineHeight:1.7, textAlign:"center", marginBottom:12 }}>
              Для повторного входа понадобится код доступа. Точно выйти?
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="sa-btn" onClick={() => setConfirmOut(false)}
                style={{ flex:1, padding:"13px", borderRadius:14, border:"1px solid rgba(200,160,80,0.4)", background:"transparent", color:GOLD, fontSize:14, fontFamily:"Georgia, serif", cursor:"pointer" }}>
                Остаться
              </button>
              <button className="sa-btn" onClick={onLogout}
                style={{ flex:1, padding:"13px", borderRadius:14, border:"none", background:RED, color:"#fff", fontSize:14, fontFamily:"Georgia, serif", fontWeight:"bold", cursor:"pointer" }}>
                Выйти
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ═══ Детали фирменного стиля главной: сургуч, люверс, оправа ═══
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
const saFrame = (a11y, level = "mid") => {
  const al = level === "full" ? 1 : 0.75;
  return a11y
    ? `linear-gradient(160deg, rgba(217,179,104,${al}) 0%, rgba(139,106,48,${al}) 45%, rgba(190,148,64,${al}) 100%)`
    : `linear-gradient(160deg, rgba(224,188,114,${al}) 0%, rgba(139,106,48,${al}) 45%, rgba(200,160,80,${al}) 100%)`;
};
const saInner = (a11y) => a11y
  ? "linear-gradient(155deg, rgba(252,246,232,0.92) 0%, rgba(243,232,208,0.94) 100%)"
  : "linear-gradient(155deg, rgba(48,35,14,0.93) 0%, rgba(30,21,8,0.95) 100%)";
// Первый непройденный урок роли — для карточки «Твой трек»
const nextLessonOf = (mods = [], completed = {}, quizDone = {}) => {
  for (const m of mods) for (const l of (m.lessons || [])) {
    if (l.type === "result") continue;
    if (!(l.type === "quiz" ? quizDone[l.id] : completed[l.id])) return { lesson: l, mod: m };
  }
  return null;
};

export function RoleSelect({ onSelect, T, a11y, onLeaderboard, onProfile, onStats, onDaily, onGlossary, role, profile, completedRoles = new Set(), onChecklist, onOnboarding, onAnalytics, onReference, onContentEditor, onCertificates, onMenuTrainer, onMentor, onGuestBook, completed = {}, quizDone = {}, examResults = {}, mistakeBank = [], onContinueLesson, onMistakes }) {
  const isAdmin = !!profile?.is_admin;
  const initials = profile ? `${profile.name[0]}${(profile.surname||"")[0]||""}`.toUpperCase() : "?";
  const ROLE_ORDER = ["seasonal", "core", "manager", "service_manager"];
  const position = profile?.position || "waiter";

  // Роли доступные сразу по должности (без прохождения)
  const baseUnlocked = new Set(["seasonal", "spg"]);
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
          <img src={a11y ? LOGO_SRC_DARK : LOGO_SRC_DARK} alt="Service Academy" style={{ width:198, height:158, objectFit:"contain", display:"block", filter: a11y ? "none" : "brightness(0) saturate(100%) invert(95%) sepia(10%) saturate(400%) hue-rotate(340deg) brightness(98%)" }} />
        </div>
        {/* ═══ Приветствие по часам (профиль-карточка переехала в «Профиль») ═══ */}
        {profile && (() => {
          const h = new Date().getHours();
          const hello = h < 6 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
          return (
            <div style={{ padding:"2px 20px 12px", display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:10 }}>
              <div style={{ color: T.modTitle.color, fontSize:19, fontFamily:"Georgia, serif", minWidth:0 }}>
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
          const GRN = a11y ? "#4E7A58" : "#8FB890", GRN2 = a11y ? "#5E8A66" : "#7C9E87";
          let title, sub, cta, go, gold = false;
          if (next) { title = `Твой трек · ${roleObj?.label || ""}`; sub = `Следующий: «${next.lesson.title}» · ≈ ${_estMins(next.lesson)} мин`; cta = "ДАЛЬШЕ"; go = () => onContinueLesson(next.lesson, next.mod); }
          else if (dueM > 0 && onMistakes) { title = "Трек пройден · закрепи"; sub = `${dueM} вопрос${dueM === 1 ? "" : dueM < 5 ? "а" : "ов"} вернулись на повторение`; cta = "ОТВЕТИТЬ"; go = onMistakes; }
          else { title = "Путь пройден · держи форму"; sub = "Гость недели уже за столиком — испытание ждёт"; cta = "ПРИНЯТЬ"; go = onGuestBook; gold = true; }
          return (
            <div style={{ padding:"0 14px 9px" }}>
              <div onClick={go} {...onActivate(go)} style={{ borderRadius:16, padding:1.5, background: saFrame(a11y, "mid"), boxShadow: a11y ? "0 4px 12px rgba(120,85,25,0.28)" : "0 5px 16px rgba(0,0,0,0.5)", cursor:"pointer" }}>
                <div style={{ borderRadius:14.5, padding:"12px 13px", background: saInner(a11y) }}>
                  <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                    <div style={{ width:40, height:40, borderRadius:"50%", background: gold ? "rgba(200,169,110,0.13)" : (a11y ? "rgba(94,138,102,.14)" : "rgba(124,158,135,.15)"), display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {gold
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round"><path d="M7 11V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6"/><path d="M5.5 11h13a1.5 1.5 0 0 1 0 3h-13a1.5 1.5 0 0 1 0-3z"/><path d="M6.5 14v7M17.5 14v7"/></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21V9"/><path d="M12 9c0-3 2.5-5 6-5 0 3-2.5 5-6 5z"/><path d="M12 13c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/></svg>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color: gold ? GOLD : GRN, fontSize:16, fontWeight:"bold", fontFamily:"Georgia, serif" }}>{title}</div>
                      <div style={{ color: T.modSub.color, fontSize:11.5, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sub}</div>
                    </div>
                    <div style={{ fontFamily:"monospace", flexShrink:0, fontSize:9, letterSpacing:1, color: a11y ? "#FFF8EC" : "#14100A", background: gold ? `linear-gradient(135deg, ${GOLD_SOFT}, #8B6A30)` : `linear-gradient(135deg, ${GRN}, ${GRN2})`, borderRadius:12, padding:"6px 11px" }}>{cta} ›</div>
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

        {/* ═══ Книга отзывов — слим-витрина: монограмма, печати, золотая нить ═══ */}
        {onGuestBook && profile && (() => {
          const bs = bookStats(MODULES, completed, quizDone, examResults);
          return (
            <div style={{ padding:"0 14px 9px" }}>
              <div onClick={onGuestBook} {...onActivate(onGuestBook)} style={{ borderRadius:15, padding:1.5, background: saFrame(a11y, "full"), boxShadow: a11y ? "0 4px 14px rgba(120,85,25,0.3)" : "0 6px 18px rgba(0,0,0,0.5)", cursor:"pointer" }}>
                <div style={{ overflow:"hidden", position:"relative", background: saInner(a11y), borderRadius:13.5 }}>
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
                      {[0,1,2,3,4].map(i => i < bs.seals ? <WaxSealMini key={i} rot={[-8,6,-4,9,-6][i]} /> : <EmptySealSlot key={i} a11y={a11y} />)}
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
          const tiles = [];
          if (onChecklist) tiles.push({ key:"cl", label:"Чек-листы", onClick:onChecklist, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v2H9z"/><path d="M8.5 12l2 2 3.5-3.5"/></svg>
          )});
          if (onOnboarding && (role === "seasonal" || ["manager","senior"].includes(profile?.position) || profile?.is_admin)) tiles.push({ key:"ob", label: role === "seasonal" ? "Первая неделя" : "Новички", onClick:onOnboarding, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-4 9 4-9 4-9-4z"/><path d="M7 11v4c0 1.4 2.5 2.4 5 2.4s5-1 5-2.4v-4"/></svg>
          )});
          if (onAnalytics && (["manager","senior"].includes(profile?.position) || profile?.is_admin)) tiles.push({ key:"an", label:"Аналитика", onClick:onAnalytics, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5v14h16"/><path d="M8 15l3-4 3 2 4-6"/></svg>
          )});
          if (onReference) tiles.push({ key:"sp", label:"Справочник", onClick:onReference, icon:(
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Cc.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h6v17H6a2 2 0 0 0-2 2z"/><path d="M20 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 1 2 2z"/></svg>
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
          // Бейджи-события: новинки меню (реальные данные)
          const menuNew = countNewDishes(profile?.restaurant);
          return (
            /* Инструменты — жетоны в золотой оправе с люверсами.
               Неполный последний ряд центрируется. */
            <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:7, padding:"0 14px 12px" }}>
              {tiles.map(t => {
                const badge = t.key === "menu" && menuNew > 0 ? String(menuNew) : null;
                return (
                  <div key={t.key} onClick={t.onClick} {...onActivate(t.onClick)} style={{ width:"calc(25% - 5.25px)", position:"relative", borderRadius:13, padding:1.5, cursor:"pointer", WebkitTapHighlightColor:"transparent", background: saFrame(a11y, "mid"), boxShadow: a11y ? "0 4px 12px rgba(120,85,25,0.28)" : "0 5px 16px rgba(0,0,0,0.5)" }}>
                    <div style={{ position:"relative", borderRadius:11.5, padding:"10px 2px 6px", display:"flex", flexDirection:"column", alignItems:"center", gap:4, overflow:"hidden", background: saInner(a11y) }}>
                      <div style={{ position:"absolute", inset:0, background:`linear-gradient(118deg, transparent 30%, ${a11y ? "rgba(255,255,255,0.5)" : "rgba(255,245,220,0.09)"} 44%, transparent 58%)`, pointerEvents:"none" }} />
                      <TokenEyelet />
                      <div style={{ marginTop:4, position:"relative", display:"inline-flex" }}>{React.cloneElement(t.icon, { width:16, height:16 })}</div>
                      <span style={{ position:"relative", fontSize:8.5, color: Cc.text, fontWeight:"bold", textAlign:"center", lineHeight:1.1, maxWidth:"100%", overflowWrap:"break-word" }}>{t.label}</span>
                    </div>
                    {badge && <div style={{ position:"absolute", top:-5, right:-3, zIndex:3, background:`linear-gradient(135deg, ${GOLD_SOFT}, #8B6A30)`, color:"#1C1204", fontSize:8, fontWeight:"bold", fontFamily:"monospace", borderRadius:9, padding:"2px 6px", boxShadow:"0 2px 6px rgba(0,0,0,0.4)" }}>{badge}</div>}
                  </div>
                );
              })}
            </div>
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
        {ROLES.map((r, idx) => {
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
              }}
              onClick={() => isUnlocked && onSelect(r.id)} {...onActivate(() => isUnlocked && onSelect(r.id))}
            >
              {isUnlocked && <div style={{ ...T.roleAccent, background: r.color }} />}
              <div style={{ ...T.roleIcon, background: isUnlocked ? r.color+"28" : "rgba(255,255,255,0.05)", borderRadius:"50%", boxShadow: isUnlocked ? `0 2px 8px ${r.color}44` : "none", filter: isUnlocked ? "none" : "grayscale(1)" }}>
                {isUnlocked ? (ROLE_SVG[r.id] ? ROLE_SVG[r.id](r.color, 30) : r.icon) : ROLE_SVG.lock("#8A8070", 25)}
              </div>
              <div style={T.roleInfo}>
                <div style={{ ...T.roleLabel, color: isUnlocked ? r.color : T.modSub.color }}>{r.label}</div>
                <div style={T.roleSublabel}>{r.sublabel}</div>
                {isUnlocked
                  ? <div style={T.roleDesc}>{r.desc}</div>
                  : <div style={{ ...T.roleDesc, color: T.modSub.color, fontStyle:"italic" }}>
                      {isNextUp ? `Пройди «${ROLES[idx-1].label}» чтобы открыть` : "Заблокировано"}
                    </div>
                }
              </div>
              {isUnlocked
                ? <div style={{ fontSize:20, color: r.color+"99", fontWeight:"bold" }}>›</div>
                : <div style={{ display:"flex", alignItems:"center" }}>{ROLE_SVG.lock("rgba(255,255,255,0.28)", 17)}</div>
              }
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

export const DEFAULT_CHECKLISTS = {
  open: [
    { id:"o1", text:"Свет, музыка, климат включены" },
    { id:"o2", text:"Столы протёрты и сервированы" },
    { id:"o3", text:"Зал и санзона проверены" },
    { id:"o4", text:"Меню и спецпредложения на местах" },
    { id:"o5", text:"Кофемашина и бар готовы" },
    { id:"o6", text:"Касса открыта, разменка есть" },
  ],
  preshift: [
    { id:"p1", text:"Стоп-лист озвучен команде" },
    { id:"p2", text:"Спецпредложения дня названы" },
    { id:"p3", text:"Брони и крупные столы разобраны" },
    { id:"p4", text:"Зоны распределены" },
    { id:"p5", text:"Внешний вид команды проверен" },
  ],
  close: [
    { id:"c1", text:"Столы убраны, зал готов на завтра" },
    { id:"c2", text:"Касса сведена" },
    { id:"c3", text:"Техника и свет выключены" },
    { id:"c4", text:"Стоп-лист обновлён" },
    { id:"c5", text:"Уборка завершена" },
    { id:"c6", text:"Закрытие и сигнализация" },
  ],
};

export const CL_KINDS = [["open","Открытие"],["preshift","Предсменка"],["close","Закрытие"]];

export const _clYmd = (d) => { const z = new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };

export const _clId = () => Math.random().toString(36).slice(2,8);

export function ChecklistScreen({ T, a11y, profile, onBack }) {
  const C = moodPalette(a11y);
  const serif = "Georgia, 'Times New Roman', serif";
  const today = _clYmd(new Date());
  const canEdit = !!(profile && (profile.is_admin || ["manager","senior"].includes(profile.position)));
  const [tab, setTab] = React.useState("open");
  const [tpls, setTpls] = React.useState({});
  const [todayLog, setTodayLog] = React.useState({});
  const [edit, setEdit] = React.useState(false);
  const [draft, setDraft] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState("");

  React.useEffect(() => {
    let live = true;
    rpc("checklist_get", { p_token: saToken(), p_day: today })
      .then(d => { if (!live || !d || !d.ok) return; setTpls(d.templates || {}); setTodayLog(d.today || {}); })
      .catch(()=>{});
    return () => { live = false; };
  }, []);

  const itemsFor = (kind) => { const t = tpls[kind]; return (Array.isArray(t) && t.length) ? t : DEFAULT_CHECKLISTS[kind]; };
  const items = itemsFor(tab);
  const log = todayLog[tab] || {};
  const checked = Array.isArray(log.checked) ? log.checked : [];
  const doneCount = checked.filter(id => items.some(it => it.id === id)).length;
  const allDone = items.length > 0 && doneCount === items.length;
  const doneInfo = log.done_at
    ? `Завершено в ${new Date(log.done_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}${log.by_name?` · ${log.by_name}`:""}`
    : "отмечено · время фиксируется";

  const toggle = (id) => {
    const cur = checked.includes(id) ? checked.filter(x=>x!==id) : [...checked, id];
    setTodayLog(prev => ({ ...prev, [tab]: { ...(prev[tab]||{}), checked: cur } }));
    rpc("checklist_check", { p_token: saToken(), p_kind: tab, p_checked: cur, p_total: items.length, p_day: today })
      .then(d => { if (d && d.ok && d.done_at) setTodayLog(prev => ({ ...prev, [tab]: { ...(prev[tab]||{}), checked: cur, done_at: d.done_at } })); })
      .catch(()=>{});
    try { navigator.vibrate && navigator.vibrate(10); } catch(e){}
  };

  const startEdit = () => { setDraft(itemsFor(tab).map(x => ({...x}))); setEdit(true); };
  const dEdit = (i,v) => setDraft(d => d.map((x,j)=> j===i?{...x,text:v}:x));
  const dDel = (i) => setDraft(d => d.filter((_,j)=>j!==i));
  const dAdd = () => setDraft(d => [...d, { id:_clId(), text:"" }]);
  const dMove = (i,dir) => setDraft(d => { const j=i+dir; if(j<0||j>=d.length) return d; const c=[...d]; const t=c[i]; c[i]=c[j]; c[j]=t; return c; });
  const saveEdit = () => {
    const clean = draft.map(x=>({ id:x.id||_clId(), text:(x.text||"").trim() })).filter(x=>x.text);
    setSaving(true);
    rpc("checklist_save", { p_token: saToken(), p_kind: tab, p_items: clean })
      .then(d => { setSaving(false); if (d && d.ok) { setTpls(prev=>({...prev,[tab]:clean})); setEdit(false); setToast("Чек-лист сохранён"); } else { setToast("Не удалось сохранить"); } setTimeout(()=>setToast(""),1800); })
      .catch(()=>{ setSaving(false); setToast("Нет сети"); setTimeout(()=>setToast(""),1800); });
  };

  const itemCard = { background:C.cardBg, border:`1px solid ${C.border}`, borderTop:`1px solid ${C.top}`, boxShadow:C.shadow, borderRadius:14, marginBottom:8, backdropFilter:a11y?"blur(18px) saturate(128%)":"none", WebkitBackdropFilter:a11y?"blur(18px) saturate(128%)":"none" };
  const iconBtn = { width:26, height:18, border:"none", background:"transparent", cursor:"pointer", color:C.muted, fontSize:12, lineHeight:1, padding:0 };
  const trackBg = a11y ? "rgba(140,105,40,0.16)" : "rgba(160,120,60,0.2)";

  return (
    <div style={{ minHeight:"100%", paddingBottom:24, color:C.text }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 14px 8px" }}>
        <div onClick={onBack} {...onActivate(onBack)} style={{ cursor:"pointer", color:C.gold, fontSize:26, lineHeight:1, padding:"0 6px" }}>‹</div>
        <div style={{ flex:1, color:C.text, fontFamily:serif, fontSize:19, fontWeight:"bold" }}>Чек-листы смены</div>
        {canEdit && !edit && <div onClick={startEdit} {...onActivate(startEdit)} style={{ cursor:"pointer", color:C.gold, fontSize:13, fontWeight:"bold", border:`1px solid ${C.gold}55`, borderRadius:20, padding:"5px 12px" }}>✎ Править</div>}
        {edit && <div onClick={()=>setEdit(false)} {...onActivate(()=>setEdit(false))} style={{ cursor:"pointer", color:C.muted, fontSize:13, padding:"5px 10px" }}>Отмена</div>}
      </div>

      <div style={{ padding:"0 14px", marginBottom:14 }}>
        <div style={{ display:"flex", gap:4, padding:4, borderRadius:12, background:a11y?"rgba(140,105,40,0.12)":"rgba(160,120,60,0.14)" }}>
          {CL_KINDS.map(([k,label]) => (
            <button key={k} onClick={()=>{ setTab(k); setEdit(false); }} style={{ flex:1, padding:"8px 0", borderRadius:10, border:"none", fontFamily:serif, fontSize:13, fontWeight:"bold", cursor:"pointer", background: tab===k ? "linear-gradient(135deg,#C8A96E,#8B6A30)" : "transparent", color: tab===k ? "#fff" : C.muted }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"0 14px" }}>
        {edit ? (
          <>
            <div style={{ color:C.muted, fontSize:12, marginBottom:12, lineHeight:1.5 }}>Правишь под своё заведение{profile?.restaurant?` · ${profile.restaurant}`:""}. Изменения применятся только к твоему ресторану.</div>
            {draft.map((it,i)=>(
              <div key={it.id} style={{ ...itemCard, padding:"8px 8px 8px 12px", display:"flex", alignItems:"center", gap:6 }}>
                <input value={it.text} onChange={e=>dEdit(i,e.target.value)} placeholder="Текст пункта…" style={{ flex:1, minWidth:0, background:a11y?"rgba(255,250,238,0.7)":"rgba(30,24,14,0.6)", border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 11px", color:C.text, fontSize:14, fontFamily:"-apple-system, sans-serif" }} />
                <div style={{ display:"flex", flexDirection:"column" }}>
                  <button onClick={()=>dMove(i,-1)} style={{ ...iconBtn, opacity:i===0?0.3:1 }}>▲</button>
                  <button onClick={()=>dMove(i,1)} style={{ ...iconBtn, opacity:i===draft.length-1?0.3:1 }}>▼</button>
                </div>
                <button onClick={()=>dDel(i)} style={{ ...iconBtn, width:26, height:26, color:"#B5683A", fontSize:14 }}>✕</button>
              </div>
            ))}
            <button onClick={dAdd} style={{ width:"100%", padding:"12px", borderRadius:13, border:`1.5px dashed ${C.gold}`, background:"transparent", color:C.gold, fontFamily:serif, fontSize:14, fontWeight:"bold", cursor:"pointer", marginTop:2 }}>+ Добавить пункт</button>
            <button onClick={saveEdit} disabled={saving} style={{ width:"100%", marginTop:14, padding:"14px", borderRadius:16, border:"none", background:"linear-gradient(135deg,#C8A96E,#8B6A30)", color:"#fff", fontFamily:serif, fontSize:15, fontWeight:"bold", cursor:"pointer", opacity:saving?0.6:1 }}>{saving?"Сохраняю…":"Сохранить чек-лист"}</button>
          </>
        ) : (
          <>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{ flex:1, height:6, borderRadius:4, background:trackBg, overflow:"hidden" }}>
                <div style={{ width:`${items.length?(doneCount/items.length)*100:0}%`, height:"100%", background:C.green, transition:"width .3s" }} />
              </div>
              <span style={{ color:C.muted, fontSize:12, fontWeight:"bold" }}>{doneCount}/{items.length}</span>
            </div>
            {items.map(it=>{ const on=checked.includes(it.id); return (
              <div key={it.id} onClick={()=>toggle(it.id)} {...onActivate(()=>toggle(it.id))} style={{ ...itemCard, padding:"13px 14px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
                <div style={{ width:23, height:23, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:on?"radial-gradient(circle at 35% 30%, #4FB484, #2A6B45 72%)":"transparent", border:on?"none":`2px solid ${trackBg}`, color:"#fff", fontSize:13, fontWeight:"bold" }}>{on?"✓":""}</div>
                <span style={{ flex:1, color:on?C.muted:C.text, fontSize:14.5, lineHeight:1.4, textDecoration:on?"line-through":"none" }}>{it.text}</span>
              </div>
            ); })}
            {allDone && (
              <div style={{ marginTop:6, padding:"14px 16px", borderRadius:14, background:a11y?"rgba(42,107,69,0.14)":"rgba(93,187,138,0.16)", border:`1px solid ${C.green}`, display:"flex", alignItems:"center", gap:11 }}>
                <span style={{ fontSize:20 }}>✓</span>
                <div>
                  <div style={{ color:C.green, fontFamily:serif, fontSize:15, fontWeight:"bold" }}>«{(CL_KINDS.find(k=>k[0]===tab)||["","смена"])[1]}» — всё готово</div>
                  <div style={{ color:C.muted, fontSize:12, marginTop:1 }}>{doneInfo}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {toast && <div style={{ position:"fixed", bottom:100, left:"50%", transform:"translateX(-50%)", background:"linear-gradient(135deg,#C8A96E,#8B6A30)", color:"#fff", padding:"11px 20px", borderRadius:14, fontWeight:"bold", fontFamily:serif, fontSize:13.5, zIndex:60 }}>{toast}</div>}
    </div>
  );
}

export const DEFAULT_ONBOARDING = [
  { day:"ДЕНЬ 1", steps:[
    { id:"d1a", text:"Познакомиться с командой и наставником" },
    { id:"d1b", text:"Изучить меню и сегодняшний стоп-лист" },
    { id:"d1c", text:"Внешний вид по стандарту" },
    { id:"d1d", text:"Урок «Добро пожаловать»" },
  ]},
  { day:"ДНИ 2–3", steps:[
    { id:"d2a", text:"Сервировка стола по стандарту" },
    { id:"d2b", text:"Работа с подносом" },
    { id:"d2c", text:"5 столов под присмотром наставника" },
    { id:"d2d", text:"Глоссарий: первые 10 терминов" },
  ]},
  { day:"К КОНЦУ НЕДЕЛИ", steps:[
    { id:"d3a", text:"Пройти тест роли «Новичок»" },
    { id:"d3b", text:"Отработать смену самостоятельно" },
  ]},
];

export const ONB_TOTAL = DEFAULT_ONBOARDING.reduce((n,p)=>n+p.steps.length,0);

export function OnboardingScreen({ T, a11y, profile, role, onBack }) {
  const C = moodPalette(a11y);
  const serif = "Georgia, 'Times New Roman', serif";
  const isLeader = !!(profile && (profile.is_admin || ["manager","senior"].includes(profile.position)));
  const isNew = role === "seasonal";
  const [view, setView] = React.useState(isNew ? "me" : "mentor");
  const [checked, setChecked] = React.useState([]);
  const [doneAt, setDoneAt] = React.useState(false);
  const [list, setList] = React.useState(null);

  React.useEffect(() => {
    let live = true;
    rpc("onboarding_get", { p_token: saToken() }).then(d => { if (!live || !d || !d.ok) return; setChecked(Array.isArray(d.checked)?d.checked:[]); setDoneAt(!!d.done_at); }).catch(()=>{});
    if (isLeader) rpc("onboarding_list", { p_token: saToken() }).then(d => { if (!live) return; setList(d && d.ok ? (d.list||[]) : []); }).catch(()=>{ if(live) setList([]); });
    return () => { live = false; };
  }, []);

  const total = ONB_TOTAL;
  const doneCount = checked.length;
  const pct = Math.round((doneCount/total)*100);
  const toggle = (id) => {
    const cur = checked.includes(id) ? checked.filter(x=>x!==id) : [...checked, id];
    setChecked(cur);
    rpc("onboarding_check", { p_token: saToken(), p_checked: cur, p_total: total }).then(d => { if (d && d.ok) setDoneAt(!!d.done_at); }).catch(()=>{});
    try { navigator.vibrate && navigator.vibrate(10); } catch(e){}
  };

  const trackBg = a11y ? "rgba(140,105,40,0.16)" : "rgba(160,120,60,0.2)";
  const card = { background:C.cardBg, border:`1px solid ${C.border}`, borderTop:`1px solid ${C.top}`, boxShadow:C.shadow, borderRadius:14, backdropFilter:a11y?"blur(18px) saturate(128%)":"none", WebkitBackdropFilter:a11y?"blur(18px) saturate(128%)":"none" };

  return (
    <div style={{ minHeight:"100%", paddingBottom:24, color:C.text }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 14px 8px" }}>
        <div onClick={onBack} {...onActivate(onBack)} style={{ cursor:"pointer", color:C.gold, fontSize:26, lineHeight:1, padding:"0 6px" }}>‹</div>
        <div style={{ flex:1, color:C.text, fontFamily:serif, fontSize:19, fontWeight:"bold" }}>{isNew && view==="me" ? "Первая неделя" : "Новички на онбординге"}</div>
      </div>

      {isNew && isLeader && (
        <div style={{ padding:"0 14px", marginBottom:14 }}>
          <div style={{ display:"flex", gap:4, padding:4, borderRadius:12, background:a11y?"rgba(140,105,40,0.12)":"rgba(160,120,60,0.14)" }}>
            {[["me","Мой путь"],["mentor","Новички"]].map(([k,label])=>(
              <button key={k} onClick={()=>setView(k)} style={{ flex:1, padding:"8px 0", borderRadius:10, border:"none", fontFamily:serif, fontSize:13, fontWeight:"bold", cursor:"pointer", background:view===k?"linear-gradient(135deg,#C8A96E,#8B6A30)":"transparent", color:view===k?"#fff":C.muted }}>{label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding:"0 14px" }}>
        {view === "me" ? (
          <>
            <div style={{ ...card, padding:"14px 16px", marginBottom:14 }}>
              <div style={{ color:C.text, fontFamily:serif, fontSize:16, fontWeight:"bold" }}>Добро пожаловать в команду 👋</div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:12 }}>
                <div style={{ flex:1, height:8, borderRadius:5, background:trackBg, overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", borderRadius:5, background:"linear-gradient(90deg,#C8A96E,#8B6A30)", transition:"width .3s" }} />
                </div>
                <span style={{ color:C.gold, fontFamily:serif, fontSize:14, fontWeight:"bold" }}>{pct}%</span>
              </div>
            </div>
            {DEFAULT_ONBOARDING.map((ph)=>(
              <div key={ph.day} style={{ marginBottom:14 }}>
                <div style={{ color:C.gold, fontSize:10.5, letterSpacing:2, fontWeight:"bold", marginBottom:8, paddingLeft:2 }}>{ph.day}</div>
                {ph.steps.map((s)=>{ const on=checked.includes(s.id); return (
                  <div key={s.id} onClick={()=>toggle(s.id)} {...onActivate(()=>toggle(s.id))} style={{ ...card, padding:"12px 14px", display:"flex", alignItems:"center", gap:12, marginBottom:8, cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
                    <div style={{ width:23, height:23, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:on?"radial-gradient(circle at 35% 30%, #4FB484, #2A6B45 72%)":"transparent", border:on?"none":`2px solid ${trackBg}`, color:"#fff", fontSize:13, fontWeight:"bold" }}>{on?"✓":""}</div>
                    <span style={{ flex:1, color:on?C.muted:C.text, fontSize:14, lineHeight:1.4, textDecoration:on?"line-through":"none" }}>{s.text}</span>
                  </div>
                ); })}
              </div>
            ))}
            {pct===100 && (
              <div style={{ padding:"16px", borderRadius:14, background:a11y?"rgba(42,107,69,0.14)":"rgba(93,187,138,0.16)", border:`1px solid ${C.green}`, textAlign:"center" }}>
                <div style={{ color:C.green, fontFamily:serif, fontSize:16, fontWeight:"bold" }}>🎉 Онбординг пройден!</div>
                <div style={{ color:C.muted, fontSize:12.5, marginTop:4 }}>Добро пожаловать в команду. Открыт путь к роли «Ядро».</div>
              </div>
            )}
          </>
        ) : (
          <>
            {list === null ? (
              <div style={{ color:C.muted, fontSize:13, padding:"8px 2px" }}>Загружаю…</div>
            ) : list.length === 0 ? (
              <div style={{ color:C.muted, fontSize:13, padding:"8px 2px", lineHeight:1.5 }}>Сейчас на онбординге никого нет. Когда новичок начнёт путь — он появится здесь.</div>
            ) : list.map((h,i)=>{ const tot=h.total||ONB_TOTAL; const p=Math.round(((h.checked||0)/tot)*100); const ini=((h.name||"?")[0]||"")+((h.surname||"")[0]||""); return (
              <div key={i} style={{ ...card, padding:"14px 16px", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", flexShrink:0, background:"linear-gradient(135deg,#C8A96E,#8B6A30)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontFamily:serif, fontWeight:"bold", fontSize:15 }}>{ini.toUpperCase()}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:C.text, fontFamily:serif, fontSize:15, fontWeight:"bold" }}>{h.name} {h.surname||""}</div>
                    <div style={{ color:C.muted, fontSize:12 }}>{h.restaurant||""}</div>
                  </div>
                  <span style={{ color:C.gold, fontFamily:serif, fontSize:15, fontWeight:"bold" }}>{p}%</span>
                </div>
                <div style={{ height:6, borderRadius:4, background:trackBg, overflow:"hidden", marginTop:11 }}>
                  <div style={{ width:`${p}%`, height:"100%", background:"linear-gradient(90deg,#C8A96E,#8B6A30)" }} />
                </div>
              </div>
            ); })}
          </>
        )}
      </div>
    </div>
  );
}

export function AnalyticsScreen({ T, a11y, profile, scores = [], onBack }) {
  const C = moodPalette(a11y);
  const serif = "Georgia, 'Times New Roman', serif";
  const [view, setView] = React.useState("weak");
  const allScope = !!(profile && (profile.is_admin || profile.position === "senior"));
  const scoped = React.useMemo(() => (scores||[]).filter(s => allScope || s.restaurant === profile?.restaurant), [scores, allScope, profile]);
  const titleById = React.useMemo(() => { const m={}; try { Object.values(MODULES).forEach(mods=>(mods||[]).forEach(md=>((md.lessons||md.items||[])).forEach(l=>{ if(l&&l.id) m[l.id]=l.title||l.name||l.id; }))); } catch(e){} return m; }, []);

  const weak = React.useMemo(() => {
    const by={}; scoped.forEach(s=>{ const k=s.quiz_id||"—"; if(!by[k]) by[k]={id:k,sum:0,n:0}; by[k].sum+=(s.pct||0); by[k].n++; });
    return Object.values(by).map(q=>({ title:titleById[q.id]||q.id, avg:Math.round(q.sum/q.n), n:q.n })).sort((a,b)=>a.avg-b.avg).slice(0,6);
  }, [scoped, titleById]);

  const dg = React.useMemo(() => {
    const d=new Date(); const dow=(d.getDay()+6)%7; d.setHours(0,0,0,0); d.setDate(d.getDate()-dow); const ws=d.getTime();
    const recent=scoped.filter(s=>s.updated_at && new Date(s.updated_at).getTime()>=ws);
    const active=new Set(recent.map(s=>`${s.name}|${s.surname}`)).size;
    const avg=recent.length?Math.round(recent.reduce((a,s)=>a+(s.pct||0),0)/recent.length):0;
    const last={}; scoped.forEach(s=>{ const k=`${s.name}|${s.surname}`; const t=s.updated_at?new Date(s.updated_at).getTime():0; if(!last[k]||t>last[k].t) last[k]={t,name:s.name,surname:s.surname}; });
    const wa=Date.now()-7*864e5; const asleep=Object.values(last).filter(p=>p.t&&p.t<wa);
    return { active, lessons:recent.length, avg, weak:weak[0], asleep };
  }, [scoped, weak]);

  const scopeLabel = allScope ? "все рестораны" : (profile?.restaurant || "ваш ресторан");
  const trackBg = a11y ? "rgba(140,105,40,0.16)" : "rgba(160,120,60,0.2)";
  const cardBase = { background:C.cardBg, border:`1px solid ${C.border}`, borderTop:`1px solid ${C.top}`, boxShadow:C.shadow, borderRadius:14, backdropFilter:a11y?"blur(18px) saturate(128%)":"none", WebkitBackdropFilter:a11y?"blur(18px) saturate(128%)":"none" };

  return (
    <div style={{ minHeight:"100%", paddingBottom:24, color:C.text }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 14px 4px" }}>
        <div onClick={onBack} {...onActivate(onBack)} style={{ cursor:"pointer", color:C.gold, fontSize:26, lineHeight:1, padding:"0 6px" }}>‹</div>
        <div style={{ flex:1, color:C.text, fontFamily:serif, fontSize:19, fontWeight:"bold" }}>Аналитика</div>
      </div>
      <div style={{ padding:"0 16px 10px", color:C.muted, fontSize:12 }}>Охват: {scopeLabel}</div>

      <div style={{ padding:"0 14px", marginBottom:14 }}>
        <div style={{ display:"flex", gap:4, padding:4, borderRadius:12, background:a11y?"rgba(140,105,40,0.12)":"rgba(160,120,60,0.14)" }}>
          {[["weak","Слабые места"],["digest","Сводка недели"]].map(([k,l])=>(
            <button key={k} onClick={()=>setView(k)} style={{ flex:1, padding:"8px 0", borderRadius:10, border:"none", fontFamily:serif, fontSize:13, fontWeight:"bold", cursor:"pointer", background:view===k?"linear-gradient(135deg,#C8A96E,#8B6A30)":"transparent", color:view===k?"#fff":C.muted }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"0 14px" }}>
        {scoped.length === 0 ? (
          <div style={{ color:C.muted, fontSize:13, padding:"8px 2px", lineHeight:1.5 }}>Пока нет данных по тестам{allScope?"":" в вашем ресторане"}. Аналитика появится, когда команда начнёт проходить тесты.</div>
        ) : view === "weak" ? (
          <>
            <div style={{ color:C.muted, fontSize:12, marginBottom:10, lineHeight:1.5 }}>Темы с самым низким средним результатом — над ними стоит поработать.</div>
            {weak.map((q,i)=>{ const col=q.avg<60?"#D9764A":q.avg<75?"#D6A33A":"#4FB07A"; return (
              <div key={i} style={{ ...cardBase, padding:"12px 14px", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8 }}>
                  <span style={{ color:C.text, fontSize:14, fontWeight:"bold", flex:1, minWidth:0 }}>{q.title}</span>
                  <span style={{ color:col, fontFamily:serif, fontSize:16, fontWeight:"bold" }}>{q.avg}%</span>
                </div>
                <div style={{ height:6, borderRadius:4, background:trackBg, overflow:"hidden", margin:"8px 0 4px" }}>
                  <div style={{ width:`${q.avg}%`, height:"100%", background:col }} />
                </div>
                <div style={{ color:C.dim, fontSize:11 }}>{q.n} {q.n===1?"ответ":"ответов"}</div>
              </div>
            ); })}
          </>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              {[["Активных за неделю", dg.active],["Пройдено за неделю", dg.lessons],["Средний тест", dg.avg+"%"]].map(([l,v],i)=>(
                <div key={i} style={{ ...cardBase, padding:"13px 14px" }}>
                  <div style={{ color:C.dim, fontSize:11.5 }}>{l}</div>
                  <div style={{ color:C.text, fontFamily:serif, fontSize:24, fontWeight:"bold", marginTop:3 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ ...cardBase, padding:"14px 16px", marginBottom:10 }}>
              <div style={{ color:"#D6A33A", fontSize:10.5, letterSpacing:1.5, fontWeight:"bold", marginBottom:7 }}>СЛАБОЕ МЕСТО</div>
              {dg.weak ? <div style={{ color:C.text, fontSize:14 }}>{dg.weak.title} — <b style={{color:"#D9764A"}}>{dg.weak.avg}%</b></div> : <div style={{ color:C.muted, fontSize:13 }}>Достаточно данных пока нет</div>}
            </div>
            <div style={{ ...cardBase, padding:"14px 16px" }}>
              <div style={{ color:"#D6A33A", fontSize:10.5, letterSpacing:1.5, fontWeight:"bold", marginBottom:7 }}>УСНУЛИ · 7+ дней без активности</div>
              {dg.asleep.length===0 ? <div style={{ color:C.green, fontSize:13 }}>Все активны 👍</div> : (
                <div style={{ color:C.text, fontSize:13, lineHeight:1.6 }}>{dg.asleep.length} чел.: {dg.asleep.slice(0,5).map(p=>`${p.name} ${(p.surname||"")[0]||""}`.trim()).join(", ")}{dg.asleep.length>5?" и др.":""}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ContentEditorScreen({ T, a11y, onBack }) {
  const dark = !a11y;
  const gold = dark ? GOLD : "#8B6A30";
  const green = dark ? GREEN : GREEN_DARK;
  const red = dark ? RED : RED_DARK;
  const txt = dark ? CREAM : INK;
  const brd = dark ? "rgba(150,112,42,0.45)" : "rgba(180,145,70,0.35)";
  const SERIF = "Georgia, 'Times New Roman', serif";
  const ROLES = [{ id: "seasonal", label: "Новичок" }, { id: "core", label: "Ядро" }, { id: "manager", label: "Менеджер" }, { id: "service_manager", label: "Сервис-менеджер" }];
  const token = (() => { try { return localStorage.getItem("sa_session_token"); } catch (e) { return null; } })();
  const uid = () => Math.random().toString(36).slice(2, 9);
  const blankQ = () => ({ id: uid(), q: "", options: ["", ""], correct: 0, explanation: "", img: "" });
  const blankLesson = () => ({ id: "", role: "seasonal", module: "", title: "", content: "", questions: [], sort: 0 });

  const ico = {
    book: (c) => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.2C10.2 4.7 7.8 4.2 5 4.2v14.6c2.8 0 5.2.5 7 2 1.8-1.5 4.2-2 7-2V4.2c-2.8 0-5.2.5-7 2z" /><path d="M12 6.2v14.6" /></svg>),
    pencil: (c) => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1z" /><path d="M14.5 6.5l3 3" /></svg>),
    trash: (c, s) => (<svg width={s || 17} height={s || 17} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>),
    plus: (c, s) => (<svg width={s || 18} height={s || 18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>),
    photo: (c) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>),
  };

  const [lessons, setLessons] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadErr, setLoadErr] = React.useState(false);
  const [view, setView] = React.useState("list");
  const [draft, setDraft] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true); setLoadErr(false);
    try {
      const res = await rpc("cms_list_lessons", { p_token: token });
      if (Array.isArray(res)) setLessons(res); else { setLessons([]); setLoadErr(true); }
    } catch (e) { setLessons([]); setLoadErr(true); }
    setLoading(false);
  }, [token]);
  React.useEffect(() => { load(); }, [load]);

  const startNew = () => { setErr(null); setDraft(blankLesson()); setView("edit"); };
  const startEdit = (l) => { setErr(null); setDraft(JSON.parse(JSON.stringify({ ...blankLesson(), ...l, questions: Array.isArray(l.questions) ? l.questions.map(q => ({ id: uid(), ...q })) : [] }))); setView("edit"); };
  const patch = (f) => setDraft(d => ({ ...d, ...f }));
  const setQ = (qid, f) => setDraft(d => ({ ...d, questions: d.questions.map(q => q.id === qid ? { ...q, ...f } : q) }));
  const addQ = () => setDraft(d => ({ ...d, questions: [...d.questions, blankQ()] }));
  const delQ = (qid) => setDraft(d => ({ ...d, questions: d.questions.filter(q => q.id !== qid) }));

  const save = async () => {
    if (busy || !draft.title.trim()) return;
    setBusy(true); setErr(null);
    const payload = { ...draft, questions: draft.questions.map(({ id, ...q }) => q) };
    try {
      const res = await rpc("cms_save_lesson", { p_token: token, p_lesson: payload });
      if (res && res.ok) { await load(); setView("list"); setDraft(null); }
      else setErr(res && res.error === "forbidden" ? "Недостаточно прав." : "Не удалось сохранить.");
    } catch (e) { setErr("Нет связи. Попробуй ещё раз."); }
    setBusy(false);
  };
  const remove = async (id) => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await rpc("cms_delete_lesson", { p_token: token, p_id: id });
      if (res && res.ok) setLessons(ls => ls.filter(l => l.id !== id)); else setErr("Не удалось удалить.");
    } catch (e) { setErr("Нет связи."); }
    setBusy(false);
  };

  const input = { width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px", fontFamily: SERIF, fontSize: 15, outline: "none", background: dark ? "rgba(20,14,6,0.55)" : "rgba(255,255,255,0.6)", border: `1px solid ${brd}`, color: txt };
  const iconBtn = { background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", flexShrink: 0 };
  const ghostBtn = { background: "transparent", color: T.modSub.color, border: `1px solid ${brd}`, borderRadius: 16, padding: "14px", fontSize: 15, fontFamily: SERIF, cursor: "pointer", width: "100%" };
  const glass = { background: T.lessGlass.bg, border: T.lessGlass.border, borderTop: T.lessGlass.borderTop, borderRadius: 16, boxShadow: T.lessGlass.shadow };
  const label = { ...T.secTitle, padding: "0 0 7px" };

  if (view === "list") {
    return (
      <div style={T.screen}>
        <div style={T.lessHead}><button style={T.backBtn2} onClick={onBack}>‹</button><div style={T.lessHeadTitle}>Редактор контента</div></div>
        <div style={{ ...T.lessBody, flex: 1, overflowY: "auto", padding: "12px 16px 44px" }}>
          <div style={{ ...T.modSub, lineHeight: 1.5, marginBottom: 16 }}>Свои уроки под твой ресторан — их увидят сотрудники твоего заведения.</div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: T.modSub.color }}>Загрузка…</div>
          ) : loadErr ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: T.modSub.color }}>Не удалось загрузить. <span onClick={load} style={{ color: gold, cursor: "pointer" }}>Повторить</span></div>
          ) : lessons.length === 0 ? (
            <div style={{ ...glass, padding: "36px 24px", textAlign: "center" }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>{ico.book(gold)}</div>
              <div style={{ ...T.bold, marginBottom: 6 }}>Пока ни одного своего урока</div>
              <div style={{ ...T.modSub, lineHeight: 1.5 }}>Добавь первый — он появится у сотрудников рядом со штатными.</div>
            </div>
          ) : lessons.map(l => {
            const roleLabel = (ROLES.find(r => r.id === l.role) || {}).label || l.role;
            const nq = Array.isArray(l.questions) ? l.questions.length : 0;
            return (
              <div key={l.id} style={{ ...T.modCard, margin: "0 0 12px" }}>
                <div style={{ ...T.modBar, background: gold }} />
                <div style={T.modIcon}>{ico.book(gold)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...T.modTag, color: gold }}>{roleLabel}{l.module ? ` · ${l.module}` : ""}</div>
                  <div style={T.modTitle}>{l.title || "Без названия"}</div>
                  <div style={T.modSub}>{nq} вопр.</div>
                </div>
                <button onClick={() => startEdit(l)} style={iconBtn}>{ico.pencil(T.modSub.color)}</button>
                <button onClick={() => remove(l.id)} disabled={busy} style={iconBtn}>{ico.trash(red)}</button>
              </div>
            );
          })}
          {err && <div style={{ color: red, fontSize: 13, margin: "4px 0 10px", textAlign: "center" }}>{err}</div>}
          {!loading && !loadErr && (
            <button onClick={startNew} style={{ ...T.doneBtn, background: gold, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{ico.plus(dark ? "#1a1304" : "#fff")} Добавить урок</button>
          )}
        </div>
      </div>
    );
  }

  const canSave = draft.title.trim().length > 0;
  const editing = !!draft.id;
  return (
    <div style={T.screen}>
      <div style={T.lessHead}><button style={T.backBtn2} onClick={() => { setView("list"); setDraft(null); }}>‹</button><div style={T.lessHeadTitle}>{editing ? "Изменить урок" : "Новый урок"}</div></div>
      <div style={{ ...T.lessBody, flex: 1, overflowY: "auto", padding: "14px 16px 44px" }}>
        <div style={label}>Для кого</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {ROLES.map(r => { const on = draft.role === r.id; return (
            <button key={r.id} onClick={() => patch({ role: r.id })} style={{ padding: "8px 13px", borderRadius: 11, fontFamily: SERIF, fontSize: 13.5, cursor: "pointer", background: on ? gold : "transparent", color: on ? (dark ? "#1a1304" : "#fff") : T.modSub.color, border: `1px solid ${on ? gold : brd}`, fontWeight: on ? "bold" : "normal" }}>{r.label}</button>
          ); })}
        </div>
        <div style={label}>Раздел</div>
        <input style={{ ...input, marginBottom: 18 }} value={draft.module} onChange={e => patch({ module: e.target.value })} placeholder="Напр. «Наше вино»" />
        <div style={label}>Название урока</div>
        <input style={{ ...input, marginBottom: 18 }} value={draft.title} onChange={e => patch({ title: e.target.value })} placeholder="Напр. «Базовые сорта белого»" />
        <div style={label}>Текст урока</div>
        <textarea style={{ ...input, minHeight: 120, resize: "vertical", lineHeight: 1.6 }} value={draft.content} onChange={e => patch({ content: e.target.value })} placeholder={"**жирный заголовок**\n• пункт списка"} />
        <div style={{ ...T.modSub, fontSize: 11.5, margin: "6px 0 22px", lineHeight: 1.5 }}>Форматирование как в штатных уроках: <b style={{ color: gold }}>**жирный**</b> и <b style={{ color: gold }}>• списки</b>.</div>

        <div style={{ ...label, paddingBottom: 10 }}>Вопросы теста ({draft.questions.length})</div>
        {draft.questions.map((q, qi) => (
          <div key={q.id} style={{ ...glass, padding: "14px 14px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ ...T.modTag, color: gold }}>Вопрос {qi + 1}</span>
              <button onClick={() => delQ(q.id)} style={iconBtn}>{ico.trash(red)}</button>
            </div>
            <input style={{ ...input, marginBottom: 10 }} value={q.q} onChange={e => setQ(q.id, { q: e.target.value })} placeholder="Текст вопроса" />
            {q.options.map((opt, oi) => { const right = q.correct === oi; return (
              <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <button onClick={() => setQ(q.id, { correct: oi })} style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: `2px solid ${right ? green : brd}`, background: right ? green : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>{right && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={dark ? "#14110a" : "#fff"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}</button>
                <input style={{ ...input, padding: "10px 12px", fontSize: 14 }} value={opt} onChange={e => setQ(q.id, { options: q.options.map((o, k) => k === oi ? e.target.value : o) })} placeholder={`Вариант ${oi + 1}`} />
                {q.options.length > 2 && <button onClick={() => setQ(q.id, { options: q.options.filter((_, k) => k !== oi), correct: q.correct >= q.options.length - 1 ? 0 : q.correct })} style={iconBtn}>{ico.trash(T.modSub.color, 15)}</button>}
              </div>
            ); })}
            {q.options.length < 4 && <button onClick={() => setQ(q.id, { options: [...q.options, ""] })} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: gold, fontFamily: SERIF, fontSize: 13, cursor: "pointer", padding: "2px 0", marginBottom: 8 }}>{ico.plus(gold, 15)} вариант</button>}
            <div style={{ ...T.modSub, fontSize: 11, marginBottom: 4 }}>Зелёная галочка — верный ответ.</div>
            <input style={{ ...input, marginTop: 10, fontSize: 14 }} value={q.explanation} onChange={e => setQ(q.id, { explanation: e.target.value })} placeholder="Пояснение «почему»" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ flexShrink: 0 }}>{ico.photo(T.modSub.color)}</span>
              <input style={{ ...input, padding: "10px 12px", fontSize: 13 }} value={q.img} onChange={e => setQ(q.id, { img: e.target.value })} placeholder="Ссылка на фото (необязательно)" />
            </div>
            {q.img ? <img src={q.img} alt="" style={{ width: "100%", maxHeight: 150, objectFit: "cover", borderRadius: 10, marginTop: 10, display: "block" }} /> : null}
          </div>
        ))}
        <button onClick={addQ} style={{ ...ghostBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 22 }}>{ico.plus(gold)} Добавить вопрос</button>

        {err && <div style={{ color: red, fontSize: 13, marginBottom: 10, textAlign: "center" }}>{err}</div>}
        <button onClick={save} disabled={!canSave || busy} style={{ ...T.doneBtn, background: gold, opacity: (canSave && !busy) ? 1 : 0.45, cursor: (canSave && !busy) ? "pointer" : "default", marginBottom: 10 }}>{busy ? "Сохраняю…" : "Сохранить урок"}</button>
        <button onClick={() => { setView("list"); setDraft(null); }} style={ghostBtn}>Отменить</button>
        {!canSave && <div style={{ ...T.modSub, fontSize: 12, textAlign: "center", marginTop: 10 }}>Заполни хотя бы название урока.</div>}
      </div>
    </div>
  );
}

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

  const q = bank[Math.min(idx, bank.length - 1)];
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
      <div key={q.q} style={T.quizWrap}>
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
const _estMins = (l) => Math.max(1, Math.round((((l.content || "").length) + ((l.questions || []).length * 250) + ((l.situations || []).length * 300)) / 900));
const _fmtMins = (mins) => mins < 60 ? `${mins} мин` : `${Math.floor(mins / 60)} ч ${mins % 60 ? (mins % 60) + " мин" : ""}`.trim();

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
              <div style={{ ...T.lessNum, background: done ? mod.color : "transparent", color: done ? "#fff" : l.type==="practice" ? "#A090C8" : l.type==="quiz" ? GOLD : l.type==="dialogue" ? "#7FB0A0" : (T.lessNumColor || "#C8B898"), fontSize: (l.type==="practice"||l.type==="quiz"||l.type==="dialogue") ? 16 : 13, fontWeight: T.lessNumColor ? "bold" : "normal", border: done ? "none" : l.type==="practice" ? "1.5px solid rgba(139,123,171,0.5)" : l.type==="quiz" ? "1.5px solid rgba(200,169,110,0.5)" : l.type==="dialogue" ? "1.5px solid rgba(127,176,160,0.5)" : (T.lessNumBorder || "1.5px solid rgba(200,185,152,0.35)") }}>
                {done ? "✓" : l.type==="practice" ? UI_SVG.gamepad("#A090C8", 15) : l.type==="quiz" ? UI_SVG.quiz(GOLD, 15) : l.type==="dialogue" ? UI_SVG.dialog("#7FB0A0", 15) : i+1}
              </div>
              <div style={{ ...T.lessInfo, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                <div style={{ ...T.lessTitle, marginBottom:0, color: l.type==="practice" ? "#A090C8" : l.type==="quiz" ? GOLD : l.type==="dialogue" ? "#7FB0A0" : T.lessTitle.color }}>
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
    setCardIdx(i => Math.max(0, Math.min(cards.length - 1, i + d)));
    vibrate("light");
    try { if (bodyRef.current) bodyRef.current.scrollTop = 0; } catch (e) {}
  }, [cards.length]);
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
    const pattern = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
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
              onClick={e => { e.stopPropagation(); setTermPopup({ term: part.term.term, def: part.term.def }); }}
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
        <div ref={bodyRef} onScroll={handleScroll} onTouchStart={onCardTouchStart} onTouchEnd={onCardTouchEnd} style={{ ...T.lessBody, padding:"12px 14px 44px" }}>
          {/* Стеклянная подложка для текста урока */}
          <div style={{
            background: T.lessGlass?.bg || "linear-gradient(155deg, #382810 0%, #281C08 100%)",
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
            <div style={{ background: T.modCard?.background || "linear-gradient(155deg, #382810 0%, #281C08 100%)", border:`1px solid ${color||GOLD}44`, borderTop:`1px solid ${color||GOLD}66`, borderRadius:18, padding:"14px 16px", marginBottom:18, boxShadow:`0 6px 22px rgba(0,0,0,0.45), 0 2px 0 ${color||GOLD}18 inset` }}>
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
        {dialogueScreen && (
          <LiveDialogue dialogueId={dialogueScreen} T={T} onClose={() => setDialogueScreen(null)} color={color} />
        )}
        {termPopup && (
          <div onClick={() => setTermPopup(null)} {...onActivate(() => setTermPopup(null))}
            style={{ position:"fixed", inset:0, background:"transparent", zIndex:999, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 0 40px" }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: T.termPopupBg || "rgba(20,14,6,0.45)", borderRadius:20, padding:"20px 20px 24px", margin:"0 16px", maxWidth:440, width:"100%",
                border:`1px solid ${color}55`, borderTop:`1px solid ${color}77`,
                backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)",
                boxShadow:`0 8px 32px rgba(0,0,0,0.5), 0 2px 0 rgba(200,160,60,0.18) inset, 0 -2px 4px rgba(0,0,0,0.38) inset` }}>
              <div style={{ color, fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:17, marginBottom:10 }}>
                <span style={{ display:"inline-flex", verticalAlign:"-2px", marginRight:7 }}>{UI_SVG.book(color, 16)}</span>{termPopup.term}
              </div>
              <div style={{ color: T.modSub?.color || "#C8B898", fontSize:15, lineHeight:1.7, fontFamily:"Georgia, serif" }}>
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
          </div>
        )}
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
                    <div style={{ color:T.modTitle.color, fontSize:12 }}>{s.emoji} {(s.scene||s.statement||"").substring(0,45)}...</div>
                    <div style={{ color:practiceState.results[i]?GREEN:RED, fontSize:11, marginTop:1 }}>{(practiceState.results[i]?s.win:s.fail||"").substring(0,55)}...</div>
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
        <div style={{ padding:"44px 18px 10px", background:"rgba(0,0,0,0.15)", backdropFilter:"blur(10px)" }}>
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
              <div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<practiceState.step?GREEN:i===practiceState.step?color:"rgba(255,255,255,0.12)", transition:"background 0.3s" }} />
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
              <div style={{ background:"rgba(255,255,255,0.09)", borderRadius:16, padding:"16px", marginBottom:14, border:"1px solid rgba(255,255,255,0.15)", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.1)" }}>
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
                  score===lesson.questions.length?<span><Mm id="star_eyes" size={24} style={{marginRight:4}}/>Отлично! Все верно</span>:
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
        <div style={T.lessHead}><button style={T.backBtn2} onClick={onBack}>‹</button><div style={T.lessHeadTitle}>📝 Тест</div></div>
        <div key={quizState.step} style={T.quizWrap}>
          <div style={T.quizProgress}>{quizState.step+1} / {lesson.questions.length}</div>
          {q.img && <img src={q.img} alt="" loading="lazy" decoding="async" style={{ width:"100%", maxHeight:210, objectFit:"cover", borderRadius:14, display:"block", margin:"0 0 14px" }} />}
          <div style={T.quizQ}>{q.q}</div>
          {q.options.map((opt,i) => {
            return <div key={i} className="sa-opt" style={{ ...T.quizOpt, cursor:"pointer" }} onClick={()=>onQuiz(i)} {...onActivate(()=>onQuiz(i))}>{opt}</div>;
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
  const isSaved = (term) => { const e = saved[term.toLowerCase()]; return !!(e && (e.fav || e.note)); };
  const filtered = GLOSSARY.filter(g => {
    const matchText = g.term.toLowerCase().includes(search.toLowerCase()) ||
      g.def.toLowerCase().includes(search.toLowerCase());
    return matchText && (!favOnly || isSaved(g.term));
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
            outline:"none", boxSizing:"border-box", marginBottom:14 }}
        />
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
          const k = g.term.toLowerCase();
          const entry = saved[k] || {};
          const fav = !!entry.fav;
          const note = entry.note || "";
          return (
          <div key={i} style={{ ...T.modCard, marginBottom:10, padding:"12px 14px", borderRadius:14, flexDirection:"column", alignItems:"flex-start", gap:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, width:"100%" }}>
              <div style={{ color: a11y ? BROWN_GOLD : "#E8C87A", fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:15, flex:1 }}>{g.term}</div>
              <button onClick={() => onToggleFav(k)} aria-label={fav ? "Убрать из избранного" : "В избранное"} title={fav ? "Убрать из избранного" : "В избранное"}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, lineHeight:1, padding:"0 2px", color: fav ? color : (a11y ? "#9A8A6A" : "#6B5E48") }}>
                {fav ? "★" : "☆"}
              </button>
            </div>
            <div style={{ ...T.modSub, color: a11y ? "#3A2A0E" : "#C8B898", fontSize:14, lineHeight:1.6 }}>{g.def}</div>
            {(fav || note) && (
              <textarea value={note} onChange={e => onSetNote(k, e.target.value)} placeholder="Моя заметка..." rows={2}
                style={{ width:"100%", marginTop:4, padding:"8px 10px", borderRadius:10, border:`1px solid ${color}33`,
                  background: T.modCard?.background || "rgba(255,255,255,0.04)", color: T.para?.color || "#F0E8D8",
                  fontSize:13, fontFamily:"Georgia, serif", lineHeight:1.5, outline:"none", boxSizing:"border-box", resize:"vertical" }} />
            )}
          </div>
          );
        })}
        <div style={{ ...T.para, textAlign:"center", opacity:0.4, fontSize:12, marginTop:8 }}>{GLOSSARY.length} терминов</div>
      </div>
    </div>
  );
}

const dlgLastByTerm = {};
export function LiveDialogue({ dialogueId, T, onClose, color, pro }) {
  const initial = DIALOGUES_DATA.find(d => d.id === dialogueId);
  // Группа = все сценарии одной темы (один termKey). Позволяет ротацию вариантов.
  const group = React.useMemo(
    () => initial ? DIALOGUES_DATA.filter(d => d.termKey === initial.termKey) : [],
    [initial]
  );
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
  const dialogue = group.find(d => d.id === currentId) || initial;
  const idxOf = (sid) => sid === "result" ? dialogue.steps.findIndex(s => s.type === "result") : dialogue.steps.findIndex(s => s.id === sid);
  const [visible, setVisible] = React.useState(false);
  const [messages, setMessages] = React.useState([]);

  React.useEffect(() => {
    setTimeout(() => setVisible(true), 20);
  }, []);
  const [stepIdx, setStepIdx] = React.useState(0);
  const [chosen, setChosen] = React.useState(null);
  const [score, setScore] = React.useState(0);
  const [choicesFaced, setChoicesFaced] = React.useState(0);
  const [mood, setMood] = React.useState(dialogue?.guest.mood || 3);
  const [typing, setTyping] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [walkedOut, setWalkedOut] = React.useState(false);
  const bottomRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const runningRef = React.useRef(false);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    const t = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 300);
    return () => clearTimeout(t);
  }, [messages, typing]);

  const addMsg = (msg) => new Promise(r => {
    setMessages(prev => [...prev, msg]);
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight + 999; }, 50);
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
    if (chosen !== null) return;
    const step = dialogue.steps[stepIdx];
    const opt = step.options[optIdx];
    setChosen(optIdx);
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
      await sleep(450);
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

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", flexDirection:"column", justifyContent:"flex-end",
      background: visible ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0)",
      transition:"background 0.8s ease" }}>
      <div style={{ background: T.termPopupBg || "rgba(20,14,6,0.45)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", borderRadius:24, maxHeight:"82vh", display:"flex", flexDirection:"column", border:"1px solid rgba(200,160,60,0.45)", borderTop:"1px solid rgba(210,170,70,0.55)", boxShadow:"0 8px 32px rgba(0,0,0,0.5), 0 2px 0 rgba(200,160,60,0.18) inset", margin:"0 16px 40px",
        transform: visible ? "translateY(0)" : "translateY(120%)",
        transition:"transform 1.1s cubic-bezier(0.16,1,0.3,1)" }}>
      {/* Header */}
      <div style={{ padding:"12px 14px 10px", background:`linear-gradient(135deg, ${dColor}18, transparent)`, borderBottom:`1px solid ${dColor}22` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <button onClick={onClose} style={{ background:"none", border:"none", color:BROWN, fontSize:22, cursor:"pointer", padding:0 }}>✕</button>
          <div style={{ fontSize:20 }}>{dialogue.guest.avatar}</div>
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
      <div style={{ height:2, background:"rgba(255,255,255,0.05)" }}>
        <div style={{ height:2, width:`${(stepIdx/(dialogue.steps.length-1))*100}%`, background:dColor, transition:"width 0.4s ease" }} />
      </div>

      {/* Messages */}
      {!done && <div ref={scrollRef} style={{ flex:1, overflowY:"auto", padding:"14px 14px 8px", display:"flex", flexDirection:"column", gap:8 }}>
        {messages.map((msg, i) => {
          if (msg.type === "action") return (
            <div key={i} style={{ textAlign:"center", color: T.para?.color || "#C8A870", fontSize: T.modSub?.fontSize || 13, fontStyle:"italic", padding:"4px 0" }}>— {msg.text} —</div>
          );
          if (msg.type === "guest") return (
            <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
              <div style={{ fontSize: T.modSub?.fontSize ? T.modSub.fontSize - 1 : 13, color: T.modSub?.color || "#6A5535", marginBottom:2, paddingLeft:4 }}>{dialogue.guest.name}</div>
              <div style={{ maxWidth:"78%", padding:"9px 13px", borderRadius:14, borderBottomLeftRadius:4, background: T.a11y ? "rgba(180,145,70,0.12)" : "rgba(200,160,80,0.10)", border: T.a11y ? "1px solid rgba(160,120,50,0.25)" : "1px solid rgba(200,160,80,0.20)", color: T.modTitle?.color || "#C8B898", fontSize: T.para?.fontSize || 14, lineHeight:1.6 }}>{msg.text}</div>
            </div>
          );
          if (msg.type === "waiter") return (
            <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"flex-end" }}>
              <div style={{ fontSize: T.modSub?.fontSize ? T.modSub.fontSize - 1 : 13, color: T.modSub?.color || "#6A5535", marginBottom:2, paddingRight:4 }}>Ты</div>
              <div style={{ maxWidth:"78%", padding:"9px 13px", borderRadius:14, borderBottomRightRadius:4, background: msg.correct ? `${dColor}28` : "rgba(224,120,120,0.15)", border:`1px solid ${msg.correct ? dColor+"44" : "rgba(224,120,120,0.3)"}`, color: T.modTitle?.color || CREAM, fontSize: T.para?.fontSize || 14, lineHeight:1.6 }}>{msg.text}</div>
            </div>
          );
          if (msg.type === "feedback") return (
            <div key={i} style={{ padding:"8px 12px", borderRadius:10, background: msg.correct ? "rgba(93,187,138,0.08)" : "rgba(224,120,120,0.08)", border:`1px solid ${msg.correct ? "rgba(93,187,138,0.2)" : "rgba(224,120,120,0.2)"}`, color: msg.correct ? "#2DBB6A" : "#E05858", fontSize: T.modSub?.fontSize || 12, fontWeight:"bold", lineHeight:1.6 }}>
              {msg.correct ? "✓ " : "✗ "}{msg.text}
            </div>
          );
          if (msg.type === "hint") return (
            <div key={i} style={{ padding:"7px 12px", borderRadius:10, background: dColor+"14", border:"1px solid "+dColor+"33", color:dColor, fontSize: T.modSub?.fontSize || 12, lineHeight:1.55 }}>
              💡 Лучше: {msg.text}
            </div>
          );
          return null;
        })}

        {typing && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
            <div style={{ fontSize: T.modSub?.fontSize ? T.modSub.fontSize - 1 : 13, color: T.modSub?.color || "#6A5535", marginBottom:2, paddingLeft:4 }}>{dialogue.guest.name}</div>
            <div style={{ padding:"10px 14px", borderRadius:14, borderBottomLeftRadius:4, background: T.a11y ? "rgba(180,145,70,0.12)" : "rgba(200,160,80,0.10)", border: T.a11y ? "1px solid rgba(160,120,50,0.25)" : "1px solid rgba(200,160,80,0.20)", display:"flex", gap:5, alignItems:"center" }}>
              {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:BROWN, animation:`dlgPulse 1s ${i*0.2}s infinite` }} />)}
            </div>
          </div>
        )}

        {dialogue.steps[stepIdx]?.type === "choice" && !typing && messages.length > 0 && chosen === null && !done && (
          <div style={{ marginTop:8 }}>
            <div style={{ color: T.modSub?.color || "#9A8060", fontSize: T.modSub?.fontSize || 13, marginBottom:8, fontStyle:"italic", display:"flex", alignItems:"flex-start", gap:6 }}><span style={{ flexShrink:0, marginTop:2 }}>{MOD_SVG["💬"](T.modSub?.color || "#9A8060", 13)}</span><span>{dialogue.steps[stepIdx].prompt}</span></div>
            {dialogue.steps[stepIdx].options.map((opt, oi) => (
              <div key={oi} onClick={() => choose(oi)} {...onActivate(() => choose(oi))} style={{ padding:"11px 14px", borderRadius:12, marginBottom:6, background:"rgba(255,255,255,0.04)", border:`1px solid ${dColor}33`, color: T.modTitle?.color || "#C8B898", fontSize: T.para?.fontSize || 14, lineHeight:1.6, cursor:"pointer", transition:"all 0.15s" }}>{opt.text}</div>
            ))}
          </div>
        )}
        <div ref={bottomRef} style={{ height:8 }} />
      </div>}



      {/* Result */}
      {done && (
        <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>
          {/* Итог */}
          <div style={{ padding:"12px 14px 8px", borderTop:`1px solid ${dColor}22`, textAlign:"center", flexShrink:0 }}>
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
          <div style={{ flex:1, overflowY:"auto", padding:"8px 14px 8px", display:"flex", flexDirection:"column", gap:6, borderTop:`1px solid ${dColor}11` }}>
            {messages.map((msg, i) => {
              if (msg.type === "action") return <div key={i} style={{ textAlign:"center", color: T.para?.color || "#C8A870", fontSize:11, fontStyle:"italic", padding:"2px 0" }}>— {msg.text} —</div>;
              if (msg.type === "guest") return <div key={i} style={{ alignSelf:"flex-start", maxWidth:"80%", padding:"7px 11px", borderRadius:12, borderBottomLeftRadius:3, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color: T.para?.color || "#C8B898", fontSize:13, lineHeight:1.5 }}>{msg.text}</div>;
              if (msg.type === "waiter") return <div key={i} style={{ alignSelf:"flex-end", maxWidth:"80%", padding:"7px 11px", borderRadius:12, borderBottomRightRadius:3, background: msg.correct ? `${dColor}25` : "rgba(224,120,120,0.15)", border:`1px solid ${msg.correct ? dColor+"44" : "rgba(224,120,120,0.3)"}`, color: T.para?.color || CREAM, fontSize:13, lineHeight:1.5 }}>{msg.text}</div>;
              if (msg.type === "feedback") return <div key={i} style={{ padding:"5px 10px", borderRadius:8, background: msg.correct ? "rgba(93,187,138,0.08)" : "rgba(224,120,120,0.08)", color: msg.correct ? "#2DBB6A" : "#E05858", fontSize:11, fontWeight:"bold", lineHeight:1.5 }}>{msg.correct ? "✓ " : "✗ "}{msg.text}</div>;
              if (msg.type === "hint") return <div key={i} style={{ padding:"5px 10px", borderRadius:8, background: dColor+"12", color:dColor, fontSize:11, lineHeight:1.5 }}>💡 Лучше: {msg.text}</div>;
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
                setMessages([]); setStepIdx(0); setChosen(null); setScore(0); setChoicesFaced(0); setMood(next?.guest.mood || 3); setDone(false); setWalkedOut(false); runningRef.current=false;
              }}
              style={{ flex:1, padding:"12px", borderRadius:12, background:"transparent", border:`1px solid ${dColor}55`, color:dColor, fontSize:14, fontFamily:"Georgia, serif", cursor:"pointer" }}>
              ↺ Ещё раз
            </button>
            <button onClick={onClose}
              style={{ flex:1, padding:"12px", borderRadius:12, background:dColor, border:"none", color:"#fff", fontSize:14, fontFamily:"Georgia, serif", cursor:"pointer", fontWeight:"bold" }}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes achIconPulse { 0%,100%{box-shadow:0 0 24px rgba(200,160,80,0.4)} 50%{box-shadow:0 0 40px rgba(200,160,80,0.7)} }
    @keyframes dlgPulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
    @keyframes dlgOverlayIn { from{opacity:0} to{opacity:1;transition-duration:0.8s} }
    @keyframes dlgSheetIn { from{transform:translateY(100%)} to{transform:translateY(0)} }`}</style>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// #2 — Экзамен на роль и сертификат.
// Вопросы собираются прямо из квизов уроков роли (MODULES), поэтому новый
// контент автоматически попадает в экзамен — ничего захардкоженного.
// ─────────────────────────────────────────────────────────────────────────────

const EXAM_PASS = 0.8;   // порог сдачи — 80%
const EXAM_COUNT = 10;   // вопросов в одной попытке (или меньше, если их мало)
const _CERT_ROLE_ORDER = ["seasonal", "core", "manager", "service_manager"];

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
  const questions = useMemo(() => shuffleArray([...pool]).slice(0, Math.min(EXAM_COUNT, pool.length)), [pool, attempt]);
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
    if (i === cur.correct) setCorrectCount(c => c + 1);
  };
  const next = () => {
    if (isLast) {
      const finalCorrect = correctCount;
      const passed = (finalCorrect / total) >= EXAM_PASS;
      const score = Math.round((finalCorrect / total) * 100);
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
        <div style={{ ...T.modCard, padding:"16px", borderRadius:16, flexDirection:"column", alignItems:"flex-start", gap:14 }}>
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

export function CertificatesScreen({ T, a11y, profile, completedRoles = new Set(), examResults = {}, onExam, onCertificate, onExit }) {
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
          const eligible = completedRoles && completedRoles.has ? completedRoles.has(id) : false;
          const hasQuestions = collectRoleQuestions(id).length > 0;
          return (
            <div key={id} style={{ ...T.modCard, padding:"14px 16px", borderRadius:16, flexDirection:"column", alignItems:"flex-start", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, width:"100%" }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:`${color}22`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18 }}>{passed ? UI_SVG.gradcap(color, 19) : (ROLE_SVG[r.id] ? ROLE_SVG[r.id](color, 19) : r.icon)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color, fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:15 }}>{r.label}</div>
                  <div style={{ ...T.modSub, fontSize:12 }}>{passed ? `Сдано · ${res.score}%` : eligible ? "Доступен экзамен" : "Сначала пройди роль"}</div>
                </div>
              </div>
              {passed
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
