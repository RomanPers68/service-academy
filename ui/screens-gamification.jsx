// ui/screens-gamification.jsx
// Ачивки, рейтинг, задания, статистика, профиль игрока.
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
          }}>{UI_SVG[ach.icon] ? UI_SVG[ach.icon](color, 34) : ach.icon}</div>
          <div>
            <div style={{ color:labelColor, fontSize:11, letterSpacing:2, fontFamily:"monospace", marginBottom:5 }}>✦ НОВАЯ АЧИВКА</div>
            <div style={{ color:titleColor, fontSize:20, fontWeight:"bold", fontFamily:ACCENT_SERIF }}>{ach.label}</div>
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

export function RoleCompleteScreen({ role, nextRole, T, onNext, onExam }) {
  const [showConfetti, setShowConfetti] = React.useState(true);
  const [phase, setPhase] = React.useState(0); // 0=celebrate, 1=next unlock

  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2000);
    const t2 = setTimeout(() => setShowConfetti(false), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const isLast = !nextRole;
  const achivements = {
    seasonal: { title:"Новичок пройден!", badge:"Стажёр сервиса", desc:"Ты освоил базовые стандарты и готов к реальным сменам. Это только начало пути!", color:"#7C9E87" },
    core:     { title:"Ядро пройдено!", badge:"Опора команды", desc:"Ты стал частью постоянной команды. Твои стандарты — пример для новичков.", color:GOLD },
    manager:  { title:"Менеджер пройден!", badge:"Лидер зала", desc:"Управление командой, разрешение конфликтов, финансы — ты готов к большему.", color:"#8B7BAB" },
    service_manager: { title:"Мастер сервиса!", badge:"Архитектор сервиса", desc:"Ты прошёл весь путь. Теперь ты строишь культуру сервиса для других.", color:"#7B8FAB" },
    bar: { title:"Бар пройден!", badge:"Мастер стойки", desc:"Станция, техника, продукт и гость за стойкой — всё твоё. Бар держится на таких людях.", color:GOLD },
    spg: { title:"Хостес пройдена!", badge:"Лицо ресторана", desc:"Ты — первое и последнее впечатление гостя. Встреча, поток и атмосфера у входа теперь твоя стихия.", color:"#C8917A" },
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
        <div style={{ color:CREAM, fontSize:26, fontWeight:"bold", fontFamily:ACCENT_SERIF, marginBottom:8, letterSpacing:0.3 }}>
          {ach.title}
        </div>
        <div style={{ color:"#8A7A6A", fontSize:14, lineHeight:1.7, maxWidth:300, margin:"0 auto" }}>
          {ach.desc}
        </div>
      </div>

      {/* Звёзды */}
      <div className="sa-fast" style={{ display:"flex", gap:8, marginBottom:28, animationDelay:"0.3s" }}>
        {[1,2,3].map(s => (
          <div key={s} style={{ fontSize:32, filter:`drop-shadow(0 0 8px #C8A96E)`, animationDelay:`${s*0.15}s` }} className="sa-pop"><span style={{ color:"#E4C88C" }}>✦</span></div>
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

      {onExam && (
        <button
          onClick={onExam}
          className="sa-btn sa-btn-pulse"
          style={{ width:"100%", maxWidth:340, padding:"16px", borderRadius:18, border:"none", background:"linear-gradient(135deg, #D4A85A 0%, #8B6A30 100%)", color:"#1A1008", fontSize:16, fontWeight:"bold", cursor:"pointer", fontFamily:"Georgia, serif", letterSpacing:0.3, marginBottom:12 }}
        >
          🎓 Сдать экзамен роли
        </button>
      )}
      <button
        onClick={onNext}
        className="sa-btn"
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
          <div style={{ color:gold, fontFamily:ACCENT_SERIF, fontSize:22, fontWeight:"bold", lineHeight:1 }}>{top.pts}</div>
          <div style={{ color:T.modSub.color, fontSize:10 }}>очков</div>
        </div>
      </div>
      {rest.length > 0 && (
        <div style={{ display:"flex", gap:14, marginTop:12, paddingTop:10, borderTop:`1px solid ${gold}22`, flexWrap:"wrap" }}>
          {rest.map((p, i) => (
            <div key={i} style={{ color:T.modSub.color, fontSize:12, display:"flex", alignItems:"center" }}>
              {(() => { const mc = i === 0 ? "#AEB4BE" : "#C98B5F"; return (
                <span style={{ marginRight:5, display:"inline-flex" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24">
                    <path d="M8.2 2h3l1.6 5-2.9.8z" fill={mc} opacity="0.5"/>
                    <path d="M15.8 2h-3l-1.6 5 2.9.8z" fill={mc} opacity="0.8"/>
                    <circle cx="12" cy="14.5" r="6" fill="none" stroke={mc} strokeWidth="2"/>
                    <circle cx="12" cy="14.5" r="2.3" fill={mc} opacity="0.55"/>
                  </svg>
                </span>
              ); })()}
              {p.name} {p.surname ? p.surname[0]+"." : ""} <span style={{ color:gold, fontWeight:"bold", marginLeft:4 }}>{p.pts}</span>
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
    { id:"waiter",  label:"Официанты", color:"#7C9E87" },
    { id:"hostess", label:"Хостес", color:"#C8917A" },
    { id:"manager", label:"Менеджеры", color:"#8B7BAB" },
    { id:"bartender", label:"Бар", color:GOLD },
    { id:"senior",  label:"Руководство", color:GOLD },
  ];
  const visibleTabs = (isAdmin || myPosition === "senior") ? allTabs : allTabs.filter(t => {
    if (myPosition === "waiter")  return t.id === "waiter";
    if (myPosition === "hostess") return t.id === "hostess";
    if (myPosition === "bartender") return t.id === "bartender";
    if (myPosition === "senior_bartender") return t.id === "bartender";
    if (myPosition === "manager") return t.id === "waiter" || t.id === "manager";
    return true;
  });

  const [tab, setTab] = React.useState(visibleTabs[0]?.id || "waiter");
  const [detailTab, setDetailTab] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const roleLabel = { seasonal:"Новичок", core:"Ядро", spg:"Хостес", manager:"Менеджер", service_manager:"Сервис-менеджер", bar:"Бар" };
  const roleColor = { seasonal:"#7C9E87", core:GOLD, spg:"#C8917A", manager:"#8B7BAB", service_manager:"#7B8FAB", bar:GOLD };

  const getAchievements = (player, allPlayers, allScores) => {
    const achievements = [];
    const key = `${player.name}|${player.surname}`;
    const playerScores = allScores.filter(s => s.name === player.name && s.surname === player.surname);

    // 🌟 Бог сервиса — все 4 роли + все тесты 100%
    const rolesWithScores = new Set(playerScores.map(s => s.role));
    const allRolesCovered = ["seasonal","core","manager","service_manager"].every(r => rolesWithScores.has(r));
    if (allRolesCovered && playerScores.length > 0 && playerScores.every(s => s.pct === 100)) {
      achievements.push({ icon:"sparkle", label:"Бог сервиса" });
    }

    // 🏆 Мастер практики — больше всех звёздочек практики
    const myStars = Object.values(practiceStars[key] || {}).reduce((a, b) => a + b, 0);
    const maxStars = Math.max(...allPlayers.map(p => Object.values(practiceStars[`${p.name}|${p.surname}`] || {}).reduce((a, b) => a + b, 0)), 0);
    if (myStars > 0 && myStars === maxStars && allPlayers.length > 1) {
      achievements.push({ icon:"trophy", label:"Мастер практики" });
    }

    // ⭐ Ядро команды — лучший средний % в роли core
    const coreScores = allScores.filter(s => s.role === "core");
    if (coreScores.length > 0) {
      const getAvg = (p) => { const ps = coreScores.filter(s => s.name === p.name && s.surname === p.surname); return ps.length > 0 ? ps.reduce((sum, s) => sum + s.pct, 0) / ps.length : 0; };
      const myAvg = getAvg(player);
      const maxAvg = Math.max(...allPlayers.map(getAvg), 0);
      if (myAvg > 0 && myAvg === maxAvg && allPlayers.length > 1) {
        achievements.push({ icon:"star", label:"Ядро команды" });
      }
    }

    // 🛎️ Лучшая хостес — лучший средний % в роли spg (Хостес)
    const spgScores = allScores.filter(s => s.role === "spg");
    if (spgScores.length > 0) {
      const getAvgS = (p) => { const ps = spgScores.filter(s => s.name === p.name && s.surname === p.surname); return ps.length > 0 ? ps.reduce((sum, s) => sum + s.pct, 0) / ps.length : 0; };
      const myAvgS = getAvgS(player);
      const maxAvgS = Math.max(...allPlayers.map(getAvgS), 0);
      if (myAvgS > 0 && myAvgS === maxAvgS && allPlayers.length > 1) {
        achievements.push({ icon:"bell", label:"Лучшая хостес" });
      }
    }

    // 🚀 Первопроходец — первый кто появился в системе
    if (playerScores.length > 0 && allScores.length > 0) {
      const myEarliest = playerScores.map(s => s.date).sort()[0];
      const globalEarliest = allScores.map(s => s.date).sort()[0];
      if (myEarliest === globalEarliest && allPlayers.length > 1) {
        achievements.push({ icon:"rocket", label:"Первопроходец" });
      }
    }

    return achievements;
  };

  const currentTab = allTabs.find(t => t.id === tab);
  // Старший бармен соревнуется во вкладке «Бар» — отдельной вкладки не плодим
  const tabOf = (pos) => pos === "senior_bartender" ? "bartender" : pos;
  const filtered = leaderboard.filter(p => tabOf(p.position || "waiter") === tab);
  // Динамика «↑N за неделю»: место сравнивается со снапшотом 2+ дней
  // давности (на устройстве, по вкладке); снапшот обновляется раз в 7 дней
  const myIdx = filtered.findIndex(p => p.name === profile?.name && p.surname === profile?.surname);
  const rankDelta = (() => {
    if (myIdx < 0) return null;
    try {
      const key = "sa_rank_snap_" + tab;
      const sn = JSON.parse(localStorage.getItem(key) || "null");
      const now = Date.now();
      if (!sn || typeof sn.rank !== "number") {
        localStorage.setItem(key, JSON.stringify({ ts: now, rank: myIdx + 1 }));
        return null;
      }
      const d = now - sn.ts >= 2 * 86400000 ? sn.rank - (myIdx + 1) : null;
      if (now - sn.ts >= 7 * 86400000) localStorage.setItem(key, JSON.stringify({ ts: now, rank: myIdx + 1 }));
      return d;
    } catch (e) { return null; }
  })();
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

      {/* Вкладки категорий — жидкое стекло, как в Книге отзывов.
          Раньше здесь были ручные кнопки с цветом должности (зелёная, лососёвая,
          фиолетовая) — наследие до морозного редизайна. Теперь единый золотой
          акцент; цвет должности остаётся у иконки роли в карточках ниже. */}
      {!detailTab && (
        <div style={{ margin:"12px 16px 0" }}>
          {/* equal={false} + scroll — как вкладки Книги отзывов: линза встаёт
              по реальным координатам вкладок (в equal-режиме она считала
              равные доли и промахивалась, т.к. подписи разной ширины),
              а «Руководство» больше не обрезается — дорожка прокручивается. */}
          <LiquidSegment a11y={!!T.a11y} equal={false} scroll
            itemStyle={{ fontFamily:"Georgia, serif", fontSize:11.5, fontWeight:"bold", padding:"9px 13px", whiteSpace:"nowrap" }}
            items={visibleTabs.map(t => ({ id: t.id, render: (active) => (
              <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:4, whiteSpace:"nowrap", maxWidth:"100%" }}>
                {POS_SVG[t.id] ? POS_SVG[t.id](active ? (T.a11y ? "#6B4E1A" : GOLD) : (T.a11y ? "#5C3D10" : "#9A8060"), 13) : null}{t.label}
              </span>
            ) }))}
            activeId={tab}
            onSelect={setTab} />
        </div>
      )}

      {!detailTab ? (
        <div style={{ flex:1, padding:"12px 16px", overflowY:"auto" }}>
          <WeekStar weekly={weekStar} T={T} />
          {filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 0", color:T.modSub.color, fontSize:14 }}>
              <div style={{ marginBottom:12, display:"flex", justifyContent:"center" }}>{UI_SVG.inbox(GOLD, 40)}</div>
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
                  {i === myIdx && rankDelta != null && rankDelta !== 0 ? (
                    <span style={{ fontSize:10, fontFamily:"ui-monospace, Menlo, monospace", padding:"2px 7px", borderRadius:999,
                      color: rankDelta > 0 ? "#8FB890" : T.modSub.color,
                      background: rankDelta > 0 ? "rgba(124,158,135,0.14)" : "rgba(154,140,116,0.12)",
                      border: `1px solid ${rankDelta > 0 ? "rgba(124,158,135,0.4)" : "rgba(154,140,116,0.3)"}` }}>
                      {rankDelta > 0 ? "↑" + rankDelta : "↓" + Math.abs(rankDelta)} за неделю
                    </span>
                  ) : null}
                  {ach.map((a, ai) => <span key={ai} title={a.label} style={{ display:"inline-flex", alignItems:"center" }}>{UI_SVG[a.icon] ? UI_SVG[a.icon](GOLD, 15) : a.icon}</span>)}
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
                    <span style={{ display:"inline-flex", alignItems:"center" }}>{UI_SVG[a.icon] ? UI_SVG[a.icon](GOLD, 14) : a.icon}</span>
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

export function DailyScreen({ T, profile, completed, quizDone, role, modules, onBack, onLesson, onReferenceLesson, mistakeTopics }) {
  const today = new Date().toLocaleDateString("ru-RU");
  const seed = today.split(".").reduce((a, v) => a + parseInt(v), 0);
  const refTask = referenceDailyTask(seed, mistakeTopics);

  // Генерируем 3 задания на сегодня из непройденных уроков
  const allLessons = React.useMemo(() => {
    if (!modules) return [];
    return modules.flatMap(m => (m.lessons || []).filter(l => l.type !== "result").map(l => ({ ...l, mod: m })));
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
    // Генератор самодельный и на малых пулах может зациклиться на одних и тех же
    // индексах (умножение выходит за точность JS-чисел). Ограничиваем число
    // попыток: для рабочих размеров пула три индекса находятся за единицы шагов.
    let guard = 0;
    while (picked.length < 3 && picked.length < pool.length && guard < 5000) {
      guard++;
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const idx = s % pool.length;
      if (!used.has(idx)) { used.add(idx); picked.push(pool[idx]); }
    }
    // Если генератор так и не набрал три — добираем по порядку. Результат
    // остаётся стабильным в течение дня, экран не зависает.
    for (let i = 0; picked.length < 3 && i < pool.length; i++) {
      if (!used.has(i)) { used.add(i); picked.push(pool[i]); }
    }
    return picked;
  }, [allLessons, completed, quizDone, seed]);

  const taskTypeIcon = { lesson:"book", quiz:"quiz", practice:"gamepad", dialogue:"dialog", build:"shaker" };
  const taskTypeLabel = { lesson:"Урок", quiz:"Тест", practice:"Практика", dialogue:"Диалог" };

  if (!role) return (
    <div style={T.screen}>
      <div style={{ ...T.lessHead, justifyContent:"space-between" }}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>{UI_SVG.target(GOLD, 19)} Задания дня</div>
        <div style={{ width:24 }} />
      </div>
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, gap:12 }}>
        <div style={{ display:"flex", justifyContent:"center" }}>{UI_SVG.target(GOLD, 48)}</div>
        <div style={{ color:T.modTitle.color, fontSize:16, fontFamily:"Georgia, serif", textAlign:"center" }}>Сначала выбери роль</div>
        <div style={{ color:T.modSub.color, fontSize:13, textAlign:"center" }}>Вернись и выбери роль — тогда появятся ежедневные задания</div>
      </div>
    </div>
  );

  return (
    <div style={T.screen}>
      <div style={{ ...T.lessHead, justifyContent:"space-between" }}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>{UI_SVG.target(GOLD, 19)} Задания дня</div>
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
              <div style={{ flexShrink:0, display:"flex", alignItems:"center" }}>{isDone ? UI_SVG.checkCircle(GREEN, 26) : (UI_SVG[taskTypeIcon[task.type]] || UI_SVG.book)(GOLD, 26)}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  <div style={{ color:"rgba(200,160,80,0.6)", fontSize:10, letterSpacing:2, fontFamily:"monospace" }}>ЗАДАНИЕ {i+1} · {taskTypeLabel[task.type] || "Урок"}</div>
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
          <div style={{ display:"flex", justifyContent:"center" }}>{UI_SVG.bulb(GOLD, 24)}</div>
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

  const roleNames = { seasonal: "Новичок", spg: "СПГ", core: "Ядро", manager: "Менеджер", service_manager: "Сервис-менеджер", bar: "Бар" };
  const roleColors = { seasonal: "#7C9E87", spg: "#C8917A", core: GOLD, manager: "#8B7BAB", service_manager: "#5B8FA8", bar: GOLD };

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
        <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>{UI_SVG.barChart(GOLD, 18)} {player.name} {player.surname}</div>
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
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, color: T.modSub?.color || BROWN, padding:"30px 0", fontSize:14 }}>
                {UI_SVG.inbox(GOLD, 15)} Пока нет данных
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function PlayerResetCard({ p, T, onResetPlayer, onUnlockQuiz, onViewPlayer, onDeleteEmployee }) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  // Удаление сотрудника (доступ + запись) — отдельный поток с жёстким
  // подтверждением: это навсегда, в отличие от сброса результатов
  const [delAsk, setDelAsk] = React.useState(false);
  const [delBusy, setDelBusy] = React.useState(false);
  const [delDone, setDelDone] = React.useState(null);   // null | текст итога
  const [delErr, setDelErr] = React.useState(null);
  return (
    <div style={{ ...T.modCard, marginBottom:8, gap:12, flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ ...T.modTitle, fontSize:13 }}>{p.name} {p.surname}</div>
          <div style={{ color:T.modSub.color, fontSize:11 }}>{p.restaurant}</div>
        </div>
        <div onClick={() => onViewPlayer && onViewPlayer(p)} {...onActivate(() => onViewPlayer && onViewPlayer(p))}
          style={{ padding:"6px 12px", borderRadius:10, cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif",
            background:"rgba(200,169,110,0.12)", border:"1px solid rgba(200,169,110,0.3)", color:GOLD, display:"flex", alignItems:"center" }}>
          {UI_SVG.barChart(GOLD, 15)}
        </div>
        <div onClick={() => setShowConfirm(s => !s)} {...onActivate(() => setShowConfirm(s => !s))}
          style={{ padding:"6px 12px", borderRadius:10, cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif",
            background:"rgba(220,80,80,0.12)", border:"1px solid rgba(220,80,80,0.3)", color:"#e57373", display:"flex", alignItems:"center", gap:6 }}>
          {UI_SVG.trash("#e57373", 13)} Сбросить
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
            background:"rgba(80,160,80,0.12)", border:"1px solid rgba(80,160,80,0.3)", color:"#81C784", alignSelf:"flex-start", display:"flex", alignItems:"center", gap:6 }}>
          {UI_SVG.lockOpen("#81C784", 13)} Разблокировать тесты
        </div>
      )}
      {onDeleteEmployee && !delDone && (
        <div onClick={() => { setDelAsk(a => !a); setDelErr(null); }} {...onActivate(() => { setDelAsk(a => !a); setDelErr(null); })}
          style={{ padding:"6px 12px", borderRadius:10, cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif",
            background:"rgba(180,50,50,0.10)", border:"1px solid rgba(200,60,60,0.35)", color:"#D96A5E", alignSelf:"flex-start", display:"flex", alignItems:"center", gap:6 }}>
          {UI_SVG.trash("#D96A5E", 13)} Удалить сотрудника
        </div>
      )}
      {delAsk && !delDone && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ color:"#D96A5E", fontSize:12, lineHeight:1.5 }}>
            Удалить {p.name} насовсем? Пропадёт доступ в приложение. Это нельзя отменить.
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <div onClick={async () => {
              if (delBusy) return;
              setDelBusy(true); setDelErr(null);
              const r = await onDeleteEmployee(p.name, p.surname);
              setDelBusy(false);
              if (r && r.ok) { setDelDone(r.note || "Сотрудник удалён: доступ и все результаты стёрты."); setDelAsk(false); }
              else setDelErr((r && r.msg) || "Не получилось удалить");
            }} {...onActivate(() => {})}
              style={{ padding:"7px 14px", borderRadius:10, cursor:"pointer", fontSize:12, fontWeight:"bold",
                background:"rgba(200,60,60,0.28)", border:"1px solid rgba(210,70,70,0.55)", color:"#E88378",
                opacity: delBusy ? 0.6 : 1 }}>
              {delBusy ? "Удаляю…" : "Да, удалить навсегда"}
            </div>
            <div onClick={() => setDelAsk(false)} {...onActivate(() => setDelAsk(false))}
              style={{ padding:"7px 14px", borderRadius:10, cursor:"pointer", fontSize:12,
                background:T.modCard.background, border:"1px solid rgba(255,255,255,0.08)", color:T.modSub.color }}>
              Отмена
            </div>
          </div>
          {delErr ? <div style={{ color:"#D96A5E", fontSize:11 }}>{delErr}</div> : null}
        </div>
      )}
      {delDone && (
        <div style={{ color:T.modSub.color, fontSize:11.5, fontStyle:"italic" }}>
          {delDone}
        </div>
      )}
    </div>
  );
}

export function StatsScreen({ T, profile, scores, completedRoles, completed, quizDone = {}, examResults = {}, practiceStars, allProfiles = [], onBack, onResetPlayer, onUnlockQuiz, onViewPlayer, onDeleteEmployee }) {
  const ROLE_ORDER = ["seasonal", "core", "manager", "service_manager"];
  const STAT_ROLES = ["spg", "bar", ...ROLE_ORDER]; // хостес — параллельный трек, в статистике тоже показываем
  const roleLabel = { seasonal:"Новичок", core:"Ядро", spg:"Хостес", manager:"Менеджер", service_manager:"Сервис-менеджер", bar:"Бар" };
  const roleColor = { seasonal:"#7C9E87", core:GOLD, spg:"#C8917A", manager:"#8B7BAB", service_manager:"#7B8FAB", bar:GOLD };

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
        <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>{UI_SVG.chartLine(GOLD, 18)} Моя статистика</div>
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
            { label:"Звёзды практики", value: myStars, icon:"star", color:"#E8A020" },
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
        {STAT_ROLES.map(r => {
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
              <div style={{ flexShrink:0, display:"flex", alignItems:"center" }}>{ROLE_SVG[r] ? ROLE_SVG[r](roleColor[r], 24) : null}</div>
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
            <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}>{UI_SVG.inbox(GOLD, 40)}</div>
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
                <PlayerResetCard key={i} p={p} T={T} onResetPlayer={onResetPlayer} onUnlockQuiz={onUnlockQuiz} onViewPlayer={onViewPlayer} onDeleteEmployee={onDeleteEmployee} />
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

          <div style={{ background:"rgba(255,250,238,0.05)", borderRadius:22, padding:"24px 20px",
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
                  {position ? <span style={{ display:"inline-flex", alignItems:"center", gap:7 }}>{(() => { const ic = POS_SVG[position === "senior_bartender" ? "bartender" : position]; return ic ? ic(GOLD, 16) : null; })()}{({waiter:"Официант", hostess:"Хостес", bartender:"Бармен", senior_bartender:"Старший бармен", manager:"Менеджер", senior:"Руководящий состав"})[position]}</span> : "Выбери должность"}
                </span>
                <span style={{ color:"#C8A870", fontSize:14, transition:"transform 0.2s", display:"inline-block", transform: showPositionSheet ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
              </div>
              {showPositionSheet && (
                <div className="sa-fast" style={{ marginTop:8, display:"flex", flexDirection:"column", gap:6 }}>
                  {[
                    { id:"waiter",  label:"Официант",           sub:"Обслуживание гостей" },
                    { id:"hostess", label:"Хостес",             sub:"Служба приёма гостей" },
                    { id:"bartender", label:"Бармен",            sub:"Работа за барной стойкой" },
                    { id:"senior_bartender", label:"Старший бармен",  sub:"Бар: смена, качество, наставничество" },
                    { id:"manager", label:"Менеджер",            sub:"Управление залом и командой" },
                    { id:"senior",  label:"Руководящий состав", sub:"Управляющий, Директор" },
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

export const APP_SHARE_URL = "https://t.me/SA_RestaurantBot";

export const POS_LABELS = { waiter:"Официант", hostess:"Хостес", bartender:"Бармен", senior_bartender:"Старший бармен", manager:"Менеджер", senior:"Руководящий состав" };
