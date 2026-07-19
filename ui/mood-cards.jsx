// ui/mood-cards.jsx
// Карточки настроения/серии и их хелперы. Вынесены из App.jsx без изменений кода.

import React from "react";
import { faceIcon, flameIcon, trophyIcon } from "./icons-extra";
import { rpc, saToken } from "../api/supabase";
import { vibrate } from "../lib/utils";
import { BROWN, GOLD, GREEN, GREEN_DARK, INK } from "./tokens";

export function moodPalette(a11y) {
  return a11y
    ? { cardBg:"rgba(235,222,195,0.70)", border:"rgba(175,140,65,0.18)", top:"rgba(255,240,200,0.62)", shadow:"0 3px 12px rgba(120,90,30,0.10), 0 1px 0 rgba(255,248,230,0.68) inset", text:INK, muted:BROWN, dim:"#9A8060", gold:"#8B6A30", green:GREEN_DARK, barTop:GOLD, barBot:"#8B6A30" }
    : { cardBg:"linear-gradient(150deg,#332510 0%,#231908 100%)", border:"rgba(140,106,38,0.34)", top:"rgba(208,166,62,0.42)", shadow:"0 5px 18px rgba(0,0,0,0.48), 0 2px 0 rgba(190,152,56,0.15) inset, 0 -2px 3px rgba(0,0,0,0.32) inset", text:"#E9DEC9", muted:"#9A8C74", dim:"#6E6354", gold:GOLD, green:GREEN, barTop:"#E8C87A", barBot:GOLD };
}

export const MOOD_FACES = [{lvl:1,l:"Тяжело"},{lvl:2,l:"Так себе"},{lvl:3,l:"Норм"},{lvl:4,l:"Хорошо"},{lvl:5,l:"Отлично"}];

export const _moodYmd = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };

export const _moodBase = (C, a11y) => ({ background:C.cardBg, border:`1px solid ${C.border}`, borderTop:`1px solid ${C.top}`, boxShadow:C.shadow, borderRadius:18, padding:"15px 16px", margin:"0 14px 14px", backdropFilter:a11y?"blur(18px) saturate(128%)":"none", WebkitBackdropFilter:a11y?"blur(18px) saturate(128%)":"none" });

export function StreakCard({ streak, a11y }) {
  const C = a11y
    ? { gold:"#8B6A30", num:"#9A6B1E", text:INK, muted:BROWN, dim:"#9A8060",
        cardBg:"rgba(235,222,195,0.70)", border:"rgba(175,140,65,0.18)", top:"rgba(255,240,200,0.62)", shadow:"0 3px 12px rgba(120,90,30,0.10), 0 1px 0 rgba(255,248,230,0.68) inset",
        glow:"radial-gradient(circle, rgba(200,150,50,0.16) 0%, transparent 70%)",
        flameGlow:"radial-gradient(circle at 40% 35%, rgba(216,160,60,0.22), rgba(180,130,40,0.05) 70%)",
        done:"radial-gradient(circle at 35% 30%, #E8C173, #C2912F 72%)", check:"#3a2c10",
        miss:"rgba(140,105,40,0.28)", future:"rgba(140,105,40,0.2)", div:"rgba(140,105,40,0.25)" }
    : { gold:GOLD, num:"#EBCF8E", text:"#E9DEC9", muted:"#9A8C74", dim:"#6E6354",
        cardBg:"linear-gradient(150deg,#332510 0%,#231908 100%)", border:"rgba(140,106,38,0.34)", top:"rgba(208,166,62,0.42)", shadow:"0 5px 18px rgba(0,0,0,0.48), 0 2px 0 rgba(190,152,56,0.15) inset, 0 -2px 3px rgba(0,0,0,0.32) inset",
        glow:"radial-gradient(circle, rgba(200,169,110,0.16) 0%, transparent 70%)",
        flameGlow:"radial-gradient(circle at 40% 35%, rgba(235,207,142,0.28), rgba(200,169,110,0.06) 70%)",
        done:"radial-gradient(circle at 35% 30%, #EBCF8E, #C8A96E 70%)", check:"#3a2c10",
        miss:"rgba(160,120,60,0.18)", future:"rgba(160,120,60,0.16)", div:"rgba(160,120,60,0.2)" };
  const serif = "'Spectral', Georgia, 'Times New Roman', serif";
  const ymd = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
  const set = new Set(streak.days || []);
  const today = new Date(); const todayStr = ymd(today);
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today); monday.setDate(today.getDate() - dow);
  const labels = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  const week = labels.map((lbl, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); const ds = ymd(d);
    const active = set.has(ds);
    const st = ds === todayStr ? (active ? "done" : "today") : active ? "done" : (d < today ? "miss" : "future");
    return { lbl, st, isToday: ds === todayStr };
  });
  const count = streak.count || 0;
  const activeToday = streak.last === todayStr;
  const sub = count === 0 ? "Пройди урок, чтобы начать серию"
    : activeToday ? "Серия идёт — так держать!" : "Загляни сегодня, чтобы не прервать серию";
  const dot = (st) => {
    const base = { width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:"bold", margin:"0 auto" };
    if (st === "done") return { ...base, background:C.done, color:C.check };
    if (st === "today") return { ...base, color:C.gold, border:`2px solid ${C.gold}` };
    if (st === "miss") return { ...base, color:C.dim, border:`2px solid ${C.miss}` };
    return { ...base, border:`2px dashed ${C.future}` };
  };
  return (
    <div style={{ background:C.cardBg, border:`1px solid ${C.border}`, borderTop:`1px solid ${C.top}`, boxShadow:C.shadow,
      borderRadius:18, padding:"12px 14px", margin:"0 14px 12px", position:"relative", overflow:"hidden",
      backdropFilter:a11y?"blur(18px) saturate(128%)":"none", WebkitBackdropFilter:a11y?"blur(18px) saturate(128%)":"none" }}>
      <div style={{ position:"absolute", top:-50, right:-40, width:150, height:150, borderRadius:"50%", background:C.glow, pointerEvents:"none" }} />
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:C.flameGlow }}>
          {flameIcon("#E0913A", 26)}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontFamily:serif, fontSize:26, fontWeight:"bold", color:C.num, lineHeight:1 }}>{count}</span>
            <span style={{ color:C.muted, fontSize:13 }}>дней подряд</span>
          </div>
          <div style={{ color:C.muted, fontSize:11.5, marginTop:3, lineHeight:1.35 }}>{sub}</div>
        </div>
        {(streak.best || 0) > 0 && (
          <div style={{ flexShrink:0, textAlign:"center", paddingLeft:10 }}>
            <div style={{ display:"flex", justifyContent:"center" }}>{trophyIcon(C.gold, 18)}</div>
            <div style={{ color:C.gold, fontSize:13, fontWeight:"bold", fontFamily:serif }}>{streak.best}</div>
          </div>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginTop:11 }}>
        {week.map((d, i) => (
          <div key={i} style={{ textAlign:"center" }}>
            <div style={dot(d.st)}>{d.st === "done" ? "✓" : d.st === "today" ? "•" : ""}</div>
            <div style={{ marginTop:4, fontSize:10, color:d.isToday?C.gold:C.dim, fontWeight:d.isToday?"bold":"normal" }}>{d.lbl}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MoodCheckCard({ a11y }) {
  const C = moodPalette(a11y);
  const serif = "'Spectral', Georgia, 'Times New Roman', serif";
  const today = _moodYmd(new Date());
  const key = "sa_mood_" + today;
  const [picked, setPicked] = React.useState(() => { try { return localStorage.getItem(key); } catch(e) { return null; } });
  const choose = (m) => {
    setPicked(String(m));
    try { localStorage.setItem(key, String(m)); } catch(e) {}
    try { rpc("save_mood", { p_token: saToken(), p_mood: m, p_day: today }); } catch(e) {}
    try { navigator.vibrate && navigator.vibrate(14); } catch(e) {}
  };
  if (picked) {
    const f = MOOD_FACES[(parseInt(picked,10)||3)-1] || MOOD_FACES[2];
    return (
      <div style={_moodBase(C, a11y)}>
        <div style={{ display:"flex", alignItems:"center", gap:11 }}>
          {faceIcon(f.lvl, C.gold, 28)}
          <div>
            <div style={{ color:C.text, fontFamily:serif, fontSize:15, fontWeight:"bold" }}>Настрой записан</div>
            <div style={{ color:C.muted, fontSize:12, marginTop:1 }}>Спасибо! Ответ анонимный — можно поменять завтра.</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={_moodBase(C, a11y)}>
      <div style={{ color:C.text, fontFamily:serif, fontSize:16, fontWeight:"bold", textAlign:"center" }}>Как настрой сегодня?</div>
      <div style={{ color:C.muted, fontSize:11.5, textAlign:"center", marginTop:3, marginBottom:14 }}>один тап · анонимно для команды</div>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        {MOOD_FACES.map((m, i) => (
          <div key={i} onClick={() => choose(i+1)} style={{ flex:1, textAlign:"center", cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
            <div style={{ display:"flex", justifyContent:"center" }}>{faceIcon(m.lvl, C.gold, 31)}</div>
            <div style={{ marginTop:6, fontSize:10, color:C.dim }}>{m.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamMoodCard({ a11y }) {
  const C = moodPalette(a11y);
  const serif = "'Spectral', Georgia, 'Times New Roman', serif";
  const [data, setData] = React.useState(null);
  const [hide, setHide] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    const today = _moodYmd(new Date());
    rpc("mood_summary", { p_token: saToken(), p_today: today })
      .then(d => { if (!live) return; if (d && d.ok) setData(d); else setHide(true); })
      .catch(() => { if (live) setHide(true); });
    return () => { live = false; };
  }, []);
  if (hide || !data) return null;
  const total = data.today_total || 0;
  const dist = data.today_dist || {};
  const maxD = Math.max(1, ...MOOD_FACES.map((_, i) => dist[String(i+1)] || 0));
  const avg = data.today_avg ? Number(data.today_avg) : 0;
  const avgFace = MOOD_FACES[Math.min(4, Math.max(0, Math.round(avg) - 1))] || MOOD_FACES[2];
  const trend = Array.isArray(data.trend) ? data.trend : [];
  const spark = () => {
    if (trend.length < 2) return null;
    const vals = trend.map(t => Number(t.avg));
    const n = vals.length, w = 100, h = 26;
    const pts = vals.map((v, i) => `${(i/(n-1))*w},${h-2-((v-1)/4)*(h-4)}`).join(" ");
    return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width:"100%", height:34, marginTop:8 }}><polyline points={pts} fill="none" stroke={C.gold} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  };
  return (
    <div style={_moodBase(C, a11y)}>
      <div style={{ color:C.gold, fontSize:10.5, letterSpacing:1.5, fontWeight:"bold", fontFamily:"monospace", marginBottom:10 }}>📊 ПУЛЬС КОМАНДЫ · СЕГОДНЯ</div>
      {total === 0 ? (
        <div style={{ color:C.muted, fontSize:13, lineHeight:1.5 }}>Сегодня ещё нет ответов. Команда отметит настрой в течение дня.</div>
      ) : (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {faceIcon(avgFace.lvl, C.gold, 34)}
            <div>
              <div style={{ color:C.text, fontFamily:serif, fontSize:16, fontWeight:"bold" }}>В целом {avgFace.l.toLowerCase()}</div>
              <div style={{ color:C.muted, fontSize:12 }}>ответили {total}</div>
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", gap:6, marginTop:14, height:64 }}>
            {MOOD_FACES.map((m, i) => { const c = dist[String(i+1)] || 0; return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", height:"100%" }}>
                <div style={{ color:C.muted, fontSize:10.5, fontWeight:"bold", marginBottom:3 }}>{c}</div>
                <div style={{ width:"64%", maxWidth:22, height:`${Math.max(5,(c/maxD)*42)}px`, borderRadius:4, background:`linear-gradient(180deg,${C.barTop},${C.barBot})`, opacity:c===0?0.25:1 }} />
                <div style={{ marginTop:4, display:"flex", justifyContent:"center" }}>{faceIcon(m.lvl, C.muted, 18)}</div>
              </div>
            ); })}
          </div>
          {spark()}
        </>
      )}
      <div style={{ color:C.dim, fontSize:11, marginTop:12, paddingTop:9, borderTop:`1px solid ${C.border}` }}>🔒 ответы анонимны — только общая картина</div>
    </div>
  );
}
