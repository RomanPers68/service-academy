// ui/screens-admin.jsx
// Чек-листы смен, онбординг, аналитика, редактор контента.
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

  const itemCard = { background:C.cardBg, border:`1px solid ${C.border}`, borderTop:`1px solid ${C.top}`, boxShadow:C.shadow, borderRadius:14, marginBottom:8 };
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
        <LiquidSegment a11y={a11y} equal
          items={CL_KINDS.map(([k,label]) => ({ id:k, label }))}
          activeId={tab}
          onSelect={(k)=>{ setTab(k); setEdit(false); }} />
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
  const card = { background:C.cardBg, border:`1px solid ${C.border}`, borderTop:`1px solid ${C.top}`, boxShadow:C.shadow, borderRadius:14 };

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
  const [hardQ, setHardQ] = React.useState(null); // null=не грузили | "loading" | "off" | []
  React.useEffect(() => {
    if (view !== "questions" || hardQ !== null) return;
    setHardQ("loading");
    rpc("quiz_hard_questions", { p_token: saToken() })
      .then(rows => setHardQ(Array.isArray(rows) ? rows : []))
      .catch(() => setHardQ("off")); // stage 7 ещё не применён
  }, [view, hardQ]);
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
  const cardBase = { background:C.cardBg, border:`1px solid ${C.border}`, borderTop:`1px solid ${C.top}`, boxShadow:C.shadow, borderRadius:14 };

  return (
    <div style={{ minHeight:"100%", paddingBottom:24, color:C.text }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 14px 4px" }}>
        <div onClick={onBack} {...onActivate(onBack)} style={{ cursor:"pointer", color:C.gold, fontSize:26, lineHeight:1, padding:"0 6px" }}>‹</div>
        <div style={{ flex:1, color:C.text, fontFamily:serif, fontSize:19, fontWeight:"bold" }}>Аналитика</div>
      </div>
      <div style={{ padding:"0 16px 10px", color:C.muted, fontSize:12 }}>Охват: {scopeLabel}</div>

      <div style={{ padding:"0 14px", marginBottom:14 }}>
        <LiquidSegment a11y={a11y} equal
          items={[["weak","Темы"],["questions","Вопросы"],["digest","Сводка"]].map(([k,l]) => ({ id:k, label:l }))}
          activeId={view}
          onSelect={setView} />
      </div>

      <div style={{ padding:"0 14px" }}>
        {view === "questions" ? (
          <>
            <div style={{ color:C.muted, fontSize:12, marginBottom:10, lineHeight:1.5 }}>Вопросы, которые команда чаще всего заваливает (за 30 дней). Каждый — готовая тема для брифинга.</div>
            {hardQ === "loading" && <div style={{ color:C.muted, fontSize:13, padding:"8px 2px" }}>Загружаю…</div>}
            {hardQ === "off" && <div style={{ color:C.muted, fontSize:13, padding:"8px 2px", lineHeight:1.5 }}>Серверная часть ещё не включена — примени supabase-stage7-quiz-analytics.sql, и здесь появятся вопросы с наибольшим процентом ошибок.</div>}
            {Array.isArray(hardQ) && hardQ.length === 0 && <div style={{ color:C.muted, fontSize:13, padding:"8px 2px", lineHeight:1.5 }}>Пока нет трудных вопросов — либо данных мало (нужно минимум 3 ответа на вопрос), либо команда отвечает без ошибок. 🎉</div>}
            {Array.isArray(hardQ) && hardQ.map((q,i)=>{ const col=q.fail_pct>=50?"#D9764A":q.fail_pct>=25?"#D6A33A":"#4FB07A"; return (
              <div key={i} style={{ ...cardBase, padding:"12px 14px", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8 }}>
                  <span style={{ color:C.text, fontSize:13.5, fontWeight:"bold", flex:1, minWidth:0, lineHeight:1.4 }}>{q.question}</span>
                  <span style={{ color:col, fontFamily:serif, fontSize:16, fontWeight:"bold", flexShrink:0 }}>{q.fail_pct}%</span>
                </div>
                <div style={{ height:6, borderRadius:4, background:trackBg, overflow:"hidden", margin:"8px 0 4px" }}>
                  <div style={{ width:`${q.fail_pct}%`, height:"100%", background:col }} />
                </div>
                <div style={{ color:C.dim, fontSize:11 }}>{q.fails} из {q.total} ответов — мимо{titleById[q.lesson_id] ? ` · ${titleById[q.lesson_id]}` : ""}</div>
              </div>
            );})}
          </>
        ) : scoped.length === 0 ? (
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
  const ROLES = [{ id: "seasonal", label: "Новичок" }, { id: "core", label: "Ядро" }, { id: "manager", label: "Менеджер" }, { id: "service_manager", label: "Сервис-менеджер" }, { id: "bar", label: "Бар" }];
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
            {q.img ? <img src={q.img} alt="" loading="lazy" decoding="async" style={{ width: "100%", maxHeight: 150, objectFit: "cover", borderRadius: 10, marginTop: 10, display: "block" }} /> : null}
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
