// ui/screens-admin.jsx
// Чек-листы смен, онбординг, аналитика, редактор контента.
// Вынесено из ui/screens.jsx БЕЗ изменения кода (barrel-разбиение);
// публичный API остался в ui/screens.jsx — App.jsx не менялся.

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import React from "react";
import { createPortal } from "react-dom";
import { SUPABASE_URL, SUPABASE_KEY, rpc, saToken, rpcSync, flushQueue, supabase } from "../api/supabase";
import { MODULES, MODULES_INDEX } from "../data/modules";
import { tones, toneOfFail, toneOfScore, glass, Avatar, Chip, Ring, Bar, ExitTrack, MissPlate, SectionLabel, Icon, Spark } from "./analytics-kit";
import { useContentVersion } from "../lib/use-content";
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
import { Confetti, TimerBar, SayAloud, LiquidSegment, useHintOnce, HintBubble } from "./widgets";
import { hintsFor, hintKey } from "../data/hints";
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
  // Подсказка при первом входе. Роли разведены ключами: руководителю важны
  // фиксация времени и «Править», сотруднику — что отметки живут один день.
  const clKey = hintKey("checklist", canEdit);
  const [clHint, clHintDone] = useHintOnce(clKey);
  const [clStep, setClStep] = React.useState(0);
  const clSteps = hintsFor(clKey);
  const clRefTabs = React.useRef(null);   // три списка
  const clRefBar = React.useRef(null);    // полоска «сделано N из M»
  const clRefEdit = React.useRef(null);   // «✎ Править»

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
  const iconBtn = { width:26, height:18, border:"none", background:"transparent", cursor:"pointer", color:C.muted, fontSize:12.5, lineHeight:1, padding:0 };
  const trackBg = a11y ? "rgba(140,105,40,0.16)" : "rgba(160,120,60,0.2)";

  return (
    <div style={{ minHeight:"100%", paddingBottom:24, color:C.text }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 14px 8px" }}>
        <div onClick={onBack} {...onActivate(onBack)} style={{ cursor:"pointer", color:C.gold, fontSize:25, lineHeight:1, padding:"0 6px" }}>‹</div>
        <div style={{ flex:1, color:C.text, fontFamily:serif, fontSize:18, fontWeight:"bold" }}>Чек-листы смены</div>
        {canEdit && !edit && <div ref={clRefEdit} onClick={startEdit} {...onActivate(startEdit)} style={{ cursor:"pointer", color:C.gold, fontSize:12.5, fontWeight:"bold", border:`1px solid ${C.gold}55`, borderRadius:18, padding:"5px 12px" }}>✎ Править</div>}
        {edit && <div onClick={()=>setEdit(false)} {...onActivate(()=>setEdit(false))} style={{ cursor:"pointer", color:C.muted, fontSize:12.5, padding:"5px 10px" }}>Отмена</div>}
      </div>

      {/* Под шапкой, а не внутри неё: шапка — флекс-ряд, пузырь там сжимается.
          В режиме правки не показываем — подсвечивать там нечего. */}
      {clHint && clSteps.length && !edit ? (
        <HintBubble a11y={a11y} text={clSteps[clStep]} arrow="up"
          anchorRef={canEdit ? (clStep === 0 ? clRefBar : clRefEdit) : (clStep === 0 ? clRefTabs : clRefBar)}
          step={clStep + 1} total={clSteps.length}
          onNext={clStep >= clSteps.length - 1 ? null : () => setClStep(v => v + 1)}
          onClose={clHintDone} />
      ) : null}

      <div ref={clRefTabs} style={{ padding:"0 14px", marginBottom:12 }}>
        <LiquidSegment a11y={a11y} equal
          items={CL_KINDS.map(([k,label]) => ({ id:k, label }))}
          activeId={tab}
          onSelect={(k)=>{ setTab(k); setEdit(false); }} />
      </div>

      <div style={{ padding:"0 14px" }}>
        {edit ? (
          <>
            <div style={{ color:C.muted, fontSize:12.5, marginBottom:12, lineHeight:1.5 }}>Правишь под своё заведение{profile?.restaurant?` · ${profile.restaurant}`:""}. Изменения применятся только к твоему ресторану.</div>
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
            <button onClick={dAdd} style={{ width:"100%", padding:"12px", borderRadius:12, border:`1.5px dashed ${C.gold}`, background:"transparent", color:C.gold, fontFamily:serif, fontSize:14, fontWeight:"bold", cursor:"pointer", marginTop:2 }}>+ Добавить пункт</button>
            <button onClick={saveEdit} disabled={saving} style={{ width:"100%", marginTop:12, padding:"14px", borderRadius:14, border:"none", background:"linear-gradient(135deg,#C8A96E,#8B6A30)", color:"#fff", fontFamily:serif, fontSize:14, fontWeight:"bold", cursor:"pointer", opacity:saving?0.6:1 }}>{saving?"Сохраняю…":"Сохранить чек-лист"}</button>
          </>
        ) : (
          <>
            <div ref={clRefBar} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{ flex:1, height:6, borderRadius:3, background:trackBg, overflow:"hidden" }}>
                <div style={{ width:`${items.length?(doneCount/items.length)*100:0}%`, height:"100%", background:C.green, transition:"width .3s" }} />
              </div>
              <span style={{ color:C.muted, fontSize:12.5, fontWeight:"bold" }}>{doneCount}/{items.length}</span>
            </div>
            {items.map(it=>{ const on=checked.includes(it.id); return (
              <div key={it.id} onClick={()=>toggle(it.id)} {...onActivate(()=>toggle(it.id))} style={{ ...itemCard, padding:"13px 14px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
                <div style={{ width:23, height:23, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:on?"radial-gradient(circle at 35% 30%, #4FB484, #2A6B45 72%)":"transparent", border:on?"none":`2px solid ${trackBg}`, color:"#fff", fontSize:12.5, fontWeight:"bold" }}>{on?"✓":""}</div>
                <span style={{ flex:1, color:on?C.muted:C.text, fontSize:14, lineHeight:1.4, textDecoration:on?"line-through":"none" }}>{it.text}</span>
              </div>
            ); })}
            {allDone && (
              <div style={{ marginTop:6, padding:"14px 16px", borderRadius:14, background:a11y?"rgba(42,107,69,0.14)":"rgba(93,187,138,0.16)", border:`1px solid ${C.green}`, display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:21 }}>✓</span>
                <div>
                  <div style={{ color:C.green, fontFamily:serif, fontSize:14, fontWeight:"bold" }}>«{(CL_KINDS.find(k=>k[0]===tab)||["","смена"])[1]}» — всё готово</div>
                  <div style={{ color:C.muted, fontSize:12.5, marginTop:2 }}>{doneInfo}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {toast && <div style={{ position:"fixed", bottom:100, left:"50%", transform:"translateX(-50%)", background:"linear-gradient(135deg,#C8A96E,#8B6A30)", color:"#fff", padding:"11px 20px", borderRadius:14, fontWeight:"bold", fontFamily:serif, fontSize:14, zIndex:60 }}>{toast}</div>}
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
        <div onClick={onBack} {...onActivate(onBack)} style={{ cursor:"pointer", color:C.gold, fontSize:25, lineHeight:1, padding:"0 6px" }}>‹</div>
        <div style={{ flex:1, color:C.text, fontFamily:serif, fontSize:18, fontWeight:"bold" }}>{isNew && view==="me" ? "Первая неделя" : "Новички на онбординге"}</div>
      </div>

      {isNew && isLeader && (
        <div style={{ padding:"0 14px", marginBottom:12 }}>
          <div style={{ display:"flex", gap:4, padding:4, borderRadius:12, background:a11y?"rgba(140,105,40,0.12)":"rgba(160,120,60,0.14)" }}>
            {[["me","Мой путь"],["mentor","Новички"]].map(([k,label])=>(
              <button key={k} onClick={()=>setView(k)} style={{ flex:1, padding:"8px 0", borderRadius:9, border:"none", fontFamily:serif, fontSize:12.5, fontWeight:"bold", cursor:"pointer", background:view===k?"linear-gradient(135deg,#C8A96E,#8B6A30)":"transparent", color:view===k?"#fff":C.muted }}>{label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding:"0 14px" }}>
        {view === "me" ? (
          <>
            <div style={{ ...card, padding:"14px 16px", marginBottom:12 }}>
              <div style={{ color:C.text, fontFamily:serif, fontSize:16, fontWeight:"bold" }}>Добро пожаловать в команду 👋</div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:12 }}>
                <div style={{ flex:1, height:8, borderRadius:6, background:trackBg, overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", borderRadius:6, background:"linear-gradient(90deg,#C8A96E,#8B6A30)", transition:"width .3s" }} />
                </div>
                <span style={{ color:C.gold, fontFamily:serif, fontSize:14, fontWeight:"bold" }}>{pct}%</span>
              </div>
            </div>
            {DEFAULT_ONBOARDING.map((ph)=>(
              <div key={ph.day} style={{ marginBottom:12 }}>
                <div style={{ color:C.gold, fontSize:11, letterSpacing:2, fontWeight:"bold", marginBottom:8, paddingLeft:2 }}>{ph.day}</div>
                {ph.steps.map((s)=>{ const on=checked.includes(s.id); return (
                  <div key={s.id} onClick={()=>toggle(s.id)} {...onActivate(()=>toggle(s.id))} style={{ ...card, padding:"12px 14px", display:"flex", alignItems:"center", gap:12, marginBottom:8, cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
                    <div style={{ width:23, height:23, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:on?"radial-gradient(circle at 35% 30%, #4FB484, #2A6B45 72%)":"transparent", border:on?"none":`2px solid ${trackBg}`, color:"#fff", fontSize:12.5, fontWeight:"bold" }}>{on?"✓":""}</div>
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
              <div style={{ color:C.muted, fontSize:12.5, padding:"8px 2px" }}>Загружаю…</div>
            ) : list.length === 0 ? (
              <div style={{ color:C.muted, fontSize:12.5, padding:"8px 2px", lineHeight:1.5 }}>Сейчас на онбординге никого нет. Когда новичок начнёт путь — он появится здесь.</div>
            ) : list.map((h,i)=>{ const tot=h.total||ONB_TOTAL; const p=Math.round(((h.checked||0)/tot)*100); const ini=((h.name||"?")[0]||"")+((h.surname||"")[0]||""); return (
              <div key={i} style={{ ...card, padding:"14px 16px", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", flexShrink:0, background:"linear-gradient(135deg,#C8A96E,#8B6A30)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontFamily:serif, fontWeight:"bold", fontSize:14 }}>{ini.toUpperCase()}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:C.text, fontFamily:serif, fontSize:14, fontWeight:"bold" }}>{h.name} {h.surname||""}</div>
                    <div style={{ color:C.muted, fontSize:12.5 }}>{h.restaurant||""}</div>
                  </div>
                  <span style={{ color:C.gold, fontFamily:serif, fontSize:14, fontWeight:"bold" }}>{p}%</span>
                </div>
                <div style={{ height:6, borderRadius:3, background:trackBg, overflow:"hidden", marginTop:10 }}>
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

// ── Дополнение 125: резервная копия базы одним тапом (только владелец) ─────────
// Free-план Supabase бэкапов не делает. Билет (backup_ticket, 3 минуты, одно
// скачивание) → /api/backup?t=… → JSON со всеми таблицами. В Telegram файл
// уходит через downloadFile (с подтверждением), в браузере — обычной загрузкой.
function BackupCard({ C, cardBase, serif }) {
  const [st, setSt] = React.useState("idle"); // idle | working | sent | error
  const [msg, setMsg] = React.useState("");
  const [last, setLast] = React.useState(() => { try { return localStorage.getItem("sa_backup_last") || ""; } catch (e) { return ""; } });
  const run = () => {
    if (st === "working") return;
    setSt("working"); setMsg("");
    rpc("backup_ticket", { p_token: saToken() }).then(j => {
      if (!j || !j.ok || !j.ticket) {
        const why = j && j.error === "forbidden" ? "Копию может скачать только владелец" : j && j.error === "auth" ? "Сессия не найдена — войди заново" : "Сервер не выдал билет — применён ли supabase-stage10-backup.sql?";
        setSt("error"); setMsg(why); return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const fname = `service-academy-backup-${stamp}.json`;
      const url = `${window.location.origin}/api/backup?t=${j.ticket}`;
      const tg = window.Telegram && window.Telegram.WebApp;
      const inTg = !!(tg && tg.initData);
      if (inTg && typeof tg.downloadFile === "function") {
        tg.downloadFile({ url, file_name: fname }, (ok) => { setSt(ok ? "sent" : "idle"); if (!ok) setMsg("Скачивание отменено"); });
      } else if (inTg && typeof tg.openLink === "function") {
        tg.openLink(url); setSt("sent");
      } else {
        const a = document.createElement("a"); a.href = url; a.download = fname; a.rel = "noopener";
        document.body.appendChild(a); a.click(); a.remove(); setSt("sent");
      }
      const when = new Date().toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
      setLast(when); try { localStorage.setItem("sa_backup_last", when); } catch (e) {}
      vibrate("success");
    }).catch(() => { setSt("error"); setMsg("Нет связи с сервером — попробуй ещё раз"); });
  };
  return (
    <div style={{ ...cardBase, padding: "14px 16px", marginTop: 12 }}>
      <div style={{ color: "#D6A33A", fontSize: 11, letterSpacing: 1.5, fontWeight: "bold", marginBottom: 6 }}>РЕЗЕРВНАЯ КОПИЯ</div>
      <div style={{ color: C.text, fontSize: 14, lineHeight: 1.5 }}>Все таблицы базы одним файлом JSON: сотрудники, меню, графики, результаты. Раз в неделю — и спокоен.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <button className="sa-btn" onClick={run} disabled={st === "working"} {...onActivate(run)}
          style={{ padding: "10px 16px", borderRadius: 12, border: `1px solid ${C.gold}88`, background: "transparent", color: C.gold,
            fontFamily: serif, fontSize: 14, fontWeight: "bold", cursor: "pointer", opacity: st === "working" ? 0.6 : 1 }}>
          {st === "working" ? "Собираю…" : "Скачать копию"}
        </button>
        <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.45, flex: 1 }}>
          {st === "error" ? <span style={{ color: "#D9764A" }}>{msg}</span>
            : st === "sent" ? "Файл уходит на телефон — подтверди сохранение, если Telegram спросит"
            : last ? `Последняя копия: ${last}` : "Копий ещё не было"}
        </div>
      </div>
      <div style={{ color: C.dim, fontSize: 11, marginTop: 10, lineHeight: 1.45 }}>Файл содержит всё, включая коды входа сотрудников — храни его как пароль. Восстановление: пришли файл разработчику.</div>
    </div>
  );
}

export function AnalyticsScreen({ T, a11y, profile, scores = [], onBack }) {
  const C = moodPalette(a11y);
  const serif = "Georgia, 'Times New Roman', serif";
  const [view, setView] = React.useState("people");   // «Люди» — первыми: кто, где и как ошибается
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
  const contentVerA = useContentVersion(); // Доп. 132
  const titleById = React.useMemo(() => { const m={}; try { Object.values(MODULES).forEach(mods=>(mods||[]).forEach(md=>((md.lessons||md.items||[])).forEach(l=>{ if(l&&l.id) m[l.id]=l.title||l.name||l.id; }))); } catch(e){} return m; }, [contentVerA]);

  // ── «Лазейки» (этап 15): кто вышел из теста до его официального конца ──
  // Выход фиксирует приложение (ui/loophole.jsx) — только оно отличает лазейку от
  // честной пересдачи после провала. Сотрудник видит свою ачивку у себя, здесь —
  // все; рядовым сервер отчёт не отдаёт. Не наказание: первая попытка — пробелы.
  const [retries, setRetries] = React.useState(null); // null | "loading" | "off" | []
  React.useEffect(() => {
    if (view !== "retries" || retries !== null) return;
    setRetries("loading");
    rpc("quiz_skips_list", { p_token: saToken() })
      .then(rows => { if (Array.isArray(rows)) setRetries(rows); else { setSrvErr(rows); setRetries("off"); } })
      .catch(() => setRetries("off"));
  }, [view, retries]);
  // Названия тестов — из индекса всех ролей: уроки чужой роли у руководителя не загружены
  const indexTitle = React.useMemo(() => { const m = {}; try { Object.values(MODULES_INDEX).forEach(mods => (mods || []).forEach(md => (md.lessons || []).forEach(l => { if (l && l.id) m[l.id] = l.title; }))); } catch (e) {} return m; }, []);
  const retryPeople = React.useMemo(() => {
    if (!Array.isArray(retries)) return [];
    const best = {};
    (scores || []).forEach(s => { const k = `${`${s.name || ""} ${s.surname || ""}`.trim()}|${s.quiz_id}`; if (!best[k] || (s.pct || 0) > best[k].pct) best[k] = { pct: s.pct || 0, total: s.total || 0 }; });
    // строки — отдельные выходы; сводим: человек → тест → сколько выходов и ПЕРВЫЙ из них
    const by = {};
    retries.forEach(r => {
      const who = (r.employee || "").trim(); if (!who) return;
      if (!by[who]) by[who] = { who, restaurant: r.restaurant, tests: {}, last: 0 };
      const t = r.ts ? new Date(r.ts).getTime() : 0;
      const cur = by[who].tests[r.lesson_id];
      if (!cur) by[who].tests[r.lesson_id] = { lesson_id: r.lesson_id, skips: 1, first: r, firstT: t, all: [r] };
      else { cur.skips++; cur.all.push(r); if (t < cur.firstT) { cur.first = r; cur.firstT = t; } }
      if (t > by[who].last) by[who].last = t;
    });
    return Object.values(by).map(p => ({ ...p, tests: Object.values(p.tests).map(x => ({
      ...x, title: indexTitle[x.lesson_id] || titleById[x.lesson_id] || "Тест", done: best[`${p.who}|${x.lesson_id}`] || null,
      answered: x.first.answered, total: x.first.total,
      // ошибки всех выходов, по времени, без повторов
      first_wrong: (() => { const seen = new Set(), out = []; x.all.slice().sort((a, b) => new Date(a.ts) - new Date(b.ts))
        .forEach(r => (Array.isArray(r.wrong) ? r.wrong : []).forEach(w => { if (w && !seen.has(w.q)) { seen.add(w.q); out.push(w); } })); return out; })() })) }))
      .map(p => ({ ...p, keys: p.tests.filter(t => t.done).length }))   // ключ = тест, сданный после выхода
      .sort((a, b) => (b.keys - a.keys) || (b.last - a.last));
  }, [retries, scores, indexTitle, titleById]);
  // ── «Люди» (этап 15): кто, где и как ошибается. Кого видно — решает сервер по лестнице:
  // менеджер — линейный персонал своего ресторана, руководящий состав — ещё и менеджеров
  // всех ресторанов, админ — всех.
  const [people, setPeople] = React.useState(null); // null | "loading" | "off" | []
  // Почему сервер не отдал отчёт. PGRST202 — функция в базе есть, а сервер API её
  // ещё не видит (не перечитал список): лечится одной строкой в SQL Editor.
  const [srvErr, setSrvErr] = React.useState(null);
  const offText = (what) => {
    const code = srvErr && srvErr.code;
    if (code === "PGRST202") return "Сервер ещё не видит новые функции. В Supabase → SQL Editor выполни одну строку: notify pgrst, 'reload schema'; — и открой этот экран заново.";
    if (srvErr && srvErr.message) return `Сервер ответил ошибкой: ${srvErr.message}${code ? ` (${code})` : ""}. Пришли этот текст разработчику.`;
    return `Серверная часть ещё не включена — примени supabase-stage15-quiz-retries.sql, и здесь появятся ${what}.`;
  };
  const [openWho, setOpenWho] = React.useState(null);
  React.useEffect(() => {
    if (view !== "people" || people !== null) return;
    setPeople("loading");
    rpc("quiz_people", { p_token: saToken() })
      .then(rows => { if (Array.isArray(rows)) setPeople(rows); else { setSrvErr(rows); setPeople("off"); } })
      .catch(() => setPeople("off"));
    if (retries === null) {   // ключик «нашёл лазейку» у имени — из того же отчёта, что и вкладка
      setRetries("loading");
      rpc("quiz_skips_list", { p_token: saToken() })
        .then(rows => setRetries(Array.isArray(rows) ? rows : "off")).catch(() => setRetries("off"));
    }
  }, [view, people, retries]);
  const viewerRank = profile?.is_admin ? 3 : profile?.position === "senior" ? 2 : profile?.position === "manager" ? 1 : 0;
  const peopleScope = viewerRank === 3 ? "все сотрудники всех ресторанов"
    : viewerRank === 2 ? "линейный персонал и менеджеры всех ресторанов"
    : "официанты, хостес и бармены вашего ресторана";
  // Подписи должностей — те же, что POS_LABELS в screens-gamification.jsx (не импортирую,
  // чтобы не связывать файлы по кругу)
  const POS = { waiter:"Официант", hostess:"Хостес", bartender:"Бармен", senior_bartender:"Старший бармен", manager:"Менеджер", senior:"Руководящий состав" };
  const loopWho = React.useMemo(() => new Set(Array.isArray(retries) ? retries.map(r => (r.employee || "").trim()) : []), [retries]);
  const peopleList = React.useMemo(() => {
    if (!Array.isArray(people)) return [];
    const by = {};
    people.forEach(r => {
      const who = (r.employee || "").trim(); if (!who) return;
      const p = by[who] || (by[who] = { who, restaurant: r.restaurant, pos: r.emp_position, fails: 0, tests: {} });
      const t = p.tests[r.lesson_id] || (p.tests[r.lesson_id] = { id: r.lesson_id, title: indexTitle[r.lesson_id] || titleById[r.lesson_id] || "Тест", fails: 0, qs: [] });
      t.fails += r.fails || 0; p.fails += r.fails || 0; t.qs.push(r);
    });
    return Object.values(by).map(p => ({ ...p, tests: Object.values(p.tests).map(t => ({ ...t, qs: t.qs.sort((a, b) => (b.fails || 0) - (a.fails || 0)) }))
      .sort((a, b) => b.fails - a.fails) })).sort((a, b) => b.fails - a.fails);
  }, [people, indexTitle, titleById]);
  const oshibok = (n) => { const d = n % 10, h = n % 100; return (d === 1 && h !== 11) ? "ошибка" : (d >= 2 && d <= 4 && (h < 12 || h > 14)) ? "ошибки" : "ошибок"; };
  const vTeste = (n) => (n % 10 === 1 && n % 100 !== 11) ? "тесте" : "тестах";
  const raz = (n) => { const d = n % 10, h = n % 100; return (d >= 2 && d <= 4 && (h < 12 || h > 14)) ? "раза" : "раз"; };
  // Лидер тайного зачёта — свой в каждом заведении (зачёт идёт внутри заведения)
  const keyLeader = React.useMemo(() => { const m = {}; retryPeople.forEach(p => { if (p.keys > (m[p.restaurant] || 0)) m[p.restaurant] = p.keys; }); return m; }, [retryPeople]);
  const missC = a11y ? "#A4452A" : "#E08A62";   // ошибка: светлый вариант — для контраста на креме
  const keyIcon = (c, s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 19 4M16 7l2.5 2.5M14 9l2 2" />
    </svg>
  );

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

  // ── Отрисовка — «морозный лёд», как у ачивки (кирпичики — ui/analytics-kit.jsx) ──
  const TN = tones(a11y);
  const G = (extra) => glass(C, a11y, extra);
  const muted = a11y ? "#5E4E30" : "#BFAE8A";
  const note = (t) => <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.5, padding: "6px 2px" }}>{t}</div>;
  const personTone = (fails) => fails >= 6 ? "bad" : fails >= 3 ? "mid" : "good";
  // Динамика: средний результат по неделям (6 недель, с понедельника) и рестораны
  const weeks = React.useMemo(() => {
    const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dow);
    const out = [];
    for (let w = 5; w >= 0; w--) {
      const st = d.getTime() - w * 7 * 864e5, en = st + 7 * 864e5;
      const xs = scoped.filter(x => x.updated_at && (+new Date(x.updated_at)) >= st && (+new Date(x.updated_at)) < en);
      const dd = new Date(st);
      out.push({ v: xs.length ? Math.round(xs.reduce((acc, x) => acc + (x.pct || 0), 0) / xs.length) : null, label: `${dd.getDate()}.${String(dd.getMonth() + 1).padStart(2, "0")}` });
    }
    return out;
  }, [scoped]);
  const wkv = weeks.filter(w => w.v != null);
  const delta = weeks[5].v != null && wkv.length >= 2 ? wkv[wkv.length - 1].v - wkv[wkv.length - 2].v : null;
  const rests = React.useMemo(() => {
    const by = {}; scoped.forEach(x => { const k = x.restaurant || "—"; (by[k] = by[k] || { name: k, sum: 0, n: 0 }); by[k].sum += x.pct || 0; by[k].n++; });
    return Object.values(by).map(r => ({ ...r, avg: Math.round(r.sum / r.n) })).sort((x, y) => y.avg - x.avg);
  }, [scoped]);

  return (
    <div style={{ minHeight:"100%", paddingBottom:24, color:C.text }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"14px 14px 2px" }}>
        <div onClick={onBack} {...onActivate(onBack)} style={{ cursor:"pointer", color:C.gold, fontSize:25, lineHeight:1, padding:"0 6px" }}>‹</div>
        <div style={{ flex:1 }}>
          <div style={{ color:C.text, fontFamily:serif, fontSize:20, fontWeight:"bold" }}>Аналитика</div>
          <div style={{ color:muted, fontSize:12 }}>Охват: {scopeLabel}</div>
        </div>
      </div>

      {/* Динамика (выбор владельца из трёх вариантов): кольцо недели, изменение к прошлой,
          график среднего результата за 6 недель — видно на любой вкладке */}
      <div style={G({ margin:"10px 14px 10px", padding:"14px 14px 8px" })}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <Ring pct={dg.avg} size={64} tone={dg.lessons ? toneOfScore(dg.avg) : "gold"} a11y={a11y} label={dg.lessons ? `${dg.avg}%` : "—"} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:TN.gold, fontFamily:"monospace", fontSize:9.5, letterSpacing:1.8, fontWeight:"bold" }}>СРЕДНИЙ РЕЗУЛЬТАТ · НЕДЕЛЯ</div>
            {delta != null ? (
              // Разница в пунктах, не в процентах: было 68%, стало 77% — это +9
              <div style={{ fontFamily:serif, fontSize:19, fontWeight:"bold", marginTop:4, color: delta > 0 ? TN.good : delta < 0 ? TN.bad : C.text }}>
                {delta === 0 ? <>= <span style={{ fontSize:13, fontWeight:"normal", color:muted }}>без изменений к прошлой неделе</span></>
                  : <>{delta > 0 ? "▲ +" : "▼ −"}{Math.abs(delta)} <span style={{ fontSize:13, fontWeight:"normal", color:muted }}>к прошлой неделе</span></>}
              </div>
            ) : <div style={{ color:muted, fontSize:12.5, marginTop:4 }}>{weeks[5].v == null ? "на этой неделе тестов ещё нет" : "сравнение появится через неделю"}</div>}
            <div style={{ color:muted, fontSize:11.5, marginTop:2 }}>активны <b style={{ color:C.text }}>{dg.active}</b> · тестов <b style={{ color:C.text }}>{dg.lessons}</b> · уснули <b style={{ color: dg.asleep.length ? TN.mid : C.text }}>{dg.asleep.length}</b></div>
          </div>
        </div>
        <div style={{ marginTop:10 }}><Spark points={weeks} a11y={a11y} /></div>
      </div>
      {/* Рестораны — тем, кто видит больше одного (админ, руководящий состав) */}
      {allScope && rests.length > 1 ? (
        <div style={G({ margin:"0 14px 12px", padding:"12px 14px" })}>
          <div style={{ color:TN.gold, fontFamily:"monospace", fontSize:9.5, letterSpacing:1.8, fontWeight:"bold", marginBottom:8 }}>РЕСТОРАНЫ · СРЕДНИЙ РЕЗУЛЬТАТ</div>
          {rests.map((r, i) => (
            <div key={i} style={{ marginBottom: i < rests.length - 1 ? 9 : 0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8 }}>
                <span style={{ color:C.text, fontFamily:serif, fontSize:13.5, fontWeight: i === 0 ? "bold" : "normal" }}>{i === 0 ? "★ " : ""}{r.name}</span>
                <span style={{ color:TN[toneOfScore(r.avg)], fontFamily:serif, fontWeight:"bold", fontSize:14 }}>{r.avg}%</span>
              </div>
              <div style={{ marginTop:4 }}><Bar pct={r.avg} tone={toneOfScore(r.avg)} a11y={a11y} h={5} /></div>
            </div>))}
        </div>) : null}

      <div style={{ padding:"0 14px", marginBottom:4 }}>
        <LiquidSegment a11y={a11y} equal
          items={[["people","Люди"],["questions","Вопросы"],["retries","Лазейки"],["digest","Сводка"]].map(([k,l]) => ({ id:k, label:l }))}
          activeId={view}
          onSelect={setView} />
      </div>

      <div style={{ padding:"0 14px" }}>
        {view === "people" ? (<>
          <SectionLabel a11y={a11y} right="90 дней">КТО И ГДЕ ОШИБАЕТСЯ</SectionLabel>
          <div style={{ color:muted, fontSize:12, margin:"-2px 2px 8px", lineHeight:1.45 }}>Видны: {peopleScope}. Нажми на человека — раскроются вопросы.</div>
          {people === "loading" && note("Загружаю…")}
          {people === "off" && note(offText("сотрудники и их ошибки"))}
          {Array.isArray(people) && peopleList.length === 0 && note("Ошибок за 90 дней нет — или команда ещё не проходила тесты.")}
          {peopleList.map((p, i) => {
            const open = openWho === p.who; const toggle = () => setOpenWho(open ? null : p.who);
            const tone = personTone(p.fails);
            return (
              <div key={i} style={G({ padding:"12px 12px", marginBottom:8 })}>
                <div onClick={toggle} {...onActivate(toggle)} style={{ cursor:"pointer", display:"flex", gap:11, alignItems:"center" }}>
                  <Avatar who={p.who} tone={tone} a11y={a11y} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ color:C.text, fontFamily:serif, fontSize:15, fontWeight:"bold", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.who}</span>
                      {loopWho.has(p.who) ? Icon.key(TN.gold, 14) : null}
                    </div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:4 }}>
                      {POS[p.pos] ? <Chip a11y={a11y}>{POS[p.pos]}</Chip> : null}
                      {viewerRank >= 2 && p.restaurant ? <Chip a11y={a11y}>{p.restaurant}</Chip> : null}
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ color:TN[tone], fontFamily:serif, fontSize:21, fontWeight:"bold", lineHeight:1 }}>{p.fails}</div>
                    <div style={{ color:muted, fontSize:10.5 }}>{oshibok(p.fails)}</div>
                  </div>
                  {Icon.chev(muted, open)}
                </div>
                {/* где сосредоточены ошибки: полоса по тестам, самый тяжёлый — цветом */}
                <div style={{ display:"flex", gap:3, marginTop:10, height:6 }}>
                  {p.tests.map((t, j) => <span key={j} style={{ flex: t.fails, borderRadius:3,
                    background: j === 0 ? TN[tone] : (a11y ? "rgba(107,78,20,0.28)" : "rgba(214,178,102,0.32)") }} />)}
                </div>
                <div style={{ color:muted, fontSize:11.5, marginTop:5 }}>{p.tests.length} {vTeste(p.tests.length)} · больше всего — «{p.tests[0] ? p.tests[0].title : ""}»</div>
                {open ? p.tests.map((t, j) => (
                  <div key={j} style={{ marginTop:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                      <span style={{ color:C.text, fontFamily:serif, fontSize:13.5, fontWeight:"bold", minWidth:0 }}>{t.title}</span>
                      <Chip a11y={a11y} tone={personTone(t.fails)}>{t.fails} {oshibok(t.fails)}</Chip>
                    </div>
                    {t.qs.slice(0, 5).map((w, k) => <MissPlate key={k} q={w.question} picked={w.last_answer} right={w.right_answer} times={w.fails} a11y={a11y} />)}
                    {t.qs.length > 5 ? <div style={{ color:muted, fontSize:11.5, marginTop:6 }}>и ещё {t.qs.length - 5}</div> : null}
                  </div>)) : null}
              </div>);
          })}
        </>) : view === "retries" ? (<>
          <div style={{ ...G({ padding:"14px 14px", marginTop:8 }), display:"flex", gap:12, alignItems:"center" }}>
            <span style={{ width:48, height:48, borderRadius:"50%", flexShrink:0, display:"grid", placeItems:"center",
              background:"conic-gradient(from 200deg, #F4E2AE, #A67C3A, #E9CF8E, #8B6A30, #F4E2AE)", boxShadow: a11y ? "none" : "0 0 18px rgba(214,178,102,0.25)" }}>
              <span style={{ width:41, height:41, borderRadius:"50%", display:"grid", placeItems:"center",
                background: a11y ? "radial-gradient(circle at 35% 30%, #FFF8E8, #EADBB8)" : "radial-gradient(circle at 35% 30%, #4A3A20, #1E160A)" }}>{Icon.key(TN.gold, 21)}</span>
            </span>
            <div style={{ minWidth:0 }}>
              <div style={{ color:TN.gold, fontFamily:"monospace", fontSize:9.5, letterSpacing:1.8, fontWeight:"bold" }}>СЕКРЕТНАЯ АЧИВКА</div>
              <div style={{ color:C.text, fontFamily:serif, fontSize:16.5, fontWeight:"bold" }}>«Находчивая жопка»</div>
              <div style={{ color:muted, fontSize:12, lineHeight:1.45, marginTop:2 }}>Вышел до конца теста, чтобы стереть ошибки. Сам получает ачивку с разбором, коллеги её не видят.</div>
            </div>
          </div>
          {retries === "loading" && note("Загружаю…")}
          {retries === "off" && note(offText("те, кто нашёл лазейку"))}
          {Array.isArray(retries) && retryPeople.length === 0 && note("Пока никто не нашёл лазейку — все сдают тесты с первого захода.")}
          {retryPeople.some(p => p.keys) ? (<>
            <SectionLabel a11y={a11y}>ТАЙНЫЙ ЗАЧЁТ КЛЮЧЕЙ</SectionLabel>
            {Object.entries(retryPeople.filter(p => p.keys).reduce((m, p) => { (m[p.restaurant] = m[p.restaurant] || []).push(p); return m; }, {})).map(([rest, list], i) => (
              <div key={i} style={G({ padding:"10px 12px", marginBottom:8 })}>
                {allScope ? <div style={{ color:muted, fontSize:11, marginBottom:4 }}>{rest}</div> : null}
                {list.slice(0, 5).map((p, j) => (
                  <div key={j} style={{ display:"flex", alignItems:"center", gap:10, padding:"5px 0", borderTop: j ? `1px solid ${a11y ? "rgba(107,78,20,0.10)" : "rgba(214,178,102,0.08)"}` : "none" }}>
                    <span style={{ width:18, textAlign:"center", fontFamily:serif, fontWeight:"bold", fontSize:14, color: j === 0 ? TN.gold : muted }}>{j + 1}</span>
                    <Avatar who={p.who} size={30} a11y={a11y} />
                    <span style={{ flex:1, minWidth:0, color:C.text, fontFamily:serif, fontSize:14, fontWeight: j === 0 ? "bold" : "normal" }}>{p.who}</span>
                    <span style={{ display:"flex", gap:2, alignItems:"center" }}>
                      {Array.from({ length: Math.min(p.keys, 6) }).map((_, k) => <span key={k}>{Icon.key(TN.gold, 14)}</span>)}
                      {p.keys > 6 ? <span style={{ color:TN.gold, fontSize:11.5, marginLeft:3 }}>+{p.keys - 6}</span> : null}
                    </span>
                  </div>))}
              </div>))}
          </>) : null}
          {retryPeople.length ? <SectionLabel a11y={a11y}>КТО И ЧТО СТЁР</SectionLabel> : null}
          {retryPeople.map((p, i) => (
            <div key={i} style={G({ padding:"12px 12px", marginBottom:8 })}>
              <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                <Avatar who={p.who} a11y={a11y} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:C.text, fontFamily:serif, fontSize:15, fontWeight:"bold" }}>{p.who}</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:4 }}>
                    {p.keys && p.keys === keyLeader[p.restaurant] ? <Chip a11y={a11y} tone="mid" strong>лидер зачёта</Chip> : null}
                    {allScope && p.restaurant ? <Chip a11y={a11y}>{p.restaurant}</Chip> : null}
                  </div>
                </div>
                {p.keys ? <div style={{ display:"flex", alignItems:"center", gap:4, color:TN.gold, fontFamily:serif, fontWeight:"bold", fontSize:17 }}>{Icon.key(TN.gold, 16)}{p.keys}</div> : null}
              </div>
              {p.tests.map((t, j) => {
                const wrong = Array.isArray(t.first_wrong) ? t.first_wrong : [];
                return (
                  <div key={j} style={{ marginTop:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                      <span style={{ color:C.text, fontFamily:serif, fontSize:13.5, fontWeight:"bold", minWidth:0 }}>{t.title}</span>
                      {t.done ? <Chip a11y={a11y} tone="good">сдал · {t.done.pct}%</Chip> : <Chip a11y={a11y} tone="mid">пока не сдал</Chip>}
                    </div>
                    <div style={{ margin:"8px 0 2px" }}><ExitTrack answered={t.answered} total={t.total || (t.done && t.done.total) || 0} a11y={a11y} /></div>
                    <div style={{ color:muted, fontSize:11 }}>{t.skips > 1 ? `выходил ${t.skips} ${raz(t.skips)} · красным — где впервые` : "красным — где вышел"}</div>
                    {wrong.slice(0, 5).map((w, k) => <MissPlate key={k} q={w.q} picked={w.a} right={w.r} a11y={a11y} />)}
                    {wrong.length > 5 ? <div style={{ color:muted, fontSize:11.5, marginTop:6 }}>и ещё {wrong.length - 5}</div> : null}
                  </div>);
              })}
            </div>))}
        </>) : view === "questions" ? (<>
          <SectionLabel a11y={a11y} right="30 дней">ЧАЩЕ ВСЕГО МИМО</SectionLabel>
          <div style={{ color:muted, fontSize:12, margin:"-2px 2px 8px" }}>Каждый вопрос — готовая тема для брифинга.</div>
          {hardQ === "loading" && note("Загружаю…")}
          {hardQ === "off" && note("Серверная часть ещё не включена — примени supabase-stage7-quiz-analytics.sql, и здесь появятся вопросы с наибольшим процентом ошибок.")}
          {Array.isArray(hardQ) && hardQ.length === 0 && note("Пока нет трудных вопросов — данных мало (нужно минимум 3 ответа на вопрос) или команда отвечает без ошибок.")}
          {Array.isArray(hardQ) && hardQ.map((q, i) => { const tone = toneOfFail(q.fail_pct); const tt = indexTitle[q.lesson_id] || titleById[q.lesson_id]; return (
            <div key={i} style={G({ padding:"12px 12px", marginBottom:8 })}>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ width:24, height:24, borderRadius:"50%", flexShrink:0, display:"grid", placeItems:"center", fontFamily:serif, fontWeight:"bold", fontSize:12,
                  color: i < 3 ? "#1F160A" : muted, background: i < 3 ? "linear-gradient(135deg, #F1DFA8, #B8914A)" : "transparent", border: i < 3 ? "none" : `1px solid ${muted}55` }}>{i + 1}</span>
                <span style={{ flex:1, minWidth:0, color:C.text, fontFamily:serif, fontSize:14, fontWeight:"bold", lineHeight:1.4 }}>{q.question}</span>
                <span style={{ color:TN[tone], fontFamily:serif, fontSize:18, fontWeight:"bold", flexShrink:0 }}>{q.fail_pct}%</span>
              </div>
              <div style={{ margin:"9px 0 7px 34px" }}><Bar pct={q.fail_pct} tone={tone} a11y={a11y} /></div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginLeft:34 }}>
                <Chip a11y={a11y}>{q.fails} из {q.total} мимо</Chip>
                {tt ? <Chip a11y={a11y}>{tt}</Chip> : null}
              </div>
            </div>); })}
        </>) : scoped.length === 0 ? (
          note(`Пока нет данных по тестам${allScope ? "" : " в вашем ресторане"}. Сводка появится, когда команда начнёт проходить тесты.`)
        ) : (<>
          <SectionLabel a11y={a11y}>СЛАБОЕ МЕСТО</SectionLabel>
          {dg.weak ? (
            <div style={{ ...G({ padding:"14px 14px" }), display:"flex", alignItems:"center", gap:14 }}>
              <Ring pct={dg.weak.avg} size={62} tone={toneOfScore(dg.weak.avg)} a11y={a11y} />
              <div style={{ minWidth:0 }}>
                <div style={{ color:C.text, fontFamily:serif, fontSize:15.5, fontWeight:"bold", lineHeight:1.3 }}>{dg.weak.title}</div>
                <div style={{ color:muted, fontSize:12, marginTop:3 }}>самый низкий средний результат · {dg.weak.n} {dg.weak.n === 1 ? "ответ" : "ответов"}</div>
              </div>
            </div>) : note("Для слабого места пока мало данных.")}
          <SectionLabel a11y={a11y} right="7+ дней">УСНУЛИ</SectionLabel>
          <div style={G({ padding:"12px 12px" })}>
            {dg.asleep.length === 0 ? (
              <div style={{ display:"flex", alignItems:"center", gap:8, color:TN.good, fontSize:13 }}>{Icon.check(TN.good, 17)} Все активны</div>
            ) : (
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {dg.asleep.slice(0, 8).map((p, i) => (
                  <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px 3px 3px", borderRadius:999, border:`1px solid ${TN.mid}44`, background:`${TN.mid}10` }}>
                    <Avatar who={`${p.name} ${p.surname || ""}`} size={24} tone="mid" a11y={a11y} />
                    <span style={{ color:C.text, fontSize:12.5 }}>{p.name} {(p.surname || "")[0] || ""}</span>
                  </span>))}
                {dg.asleep.length > 8 ? <span style={{ color:muted, fontSize:12, alignSelf:"center" }}>и ещё {dg.asleep.length - 8}</span> : null}
              </div>)}
          </div>
          <SectionLabel a11y={a11y}>ТЕМЫ С САМЫМ НИЗКИМ РЕЗУЛЬТАТОМ</SectionLabel>
          {weak.map((q, i) => { const tone = toneOfScore(q.avg); return (
            <div key={i} style={G({ padding:"11px 12px", marginBottom:7 })}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8 }}>
                <span style={{ color:C.text, fontFamily:serif, fontSize:14, fontWeight:"bold", flex:1, minWidth:0 }}>{q.title}</span>
                <span style={{ color:TN[tone], fontFamily:serif, fontSize:17, fontWeight:"bold" }}>{q.avg}%</span>
              </div>
              <div style={{ margin:"8px 0 4px" }}><Bar pct={q.avg} tone={tone} a11y={a11y} /></div>
              <div style={{ color:muted, fontSize:11 }}>{q.n} {q.n === 1 ? "ответ" : "ответов"}</div>
            </div>); })}
        </>)}
        {profile?.is_admin && <div style={{ marginTop:14 }}><BackupCard C={C} cardBase={cardBase} serif={serif} /></div>}
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

  const input = { width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px", fontFamily: SERIF, fontSize: 14, outline: "none", background: dark ? "rgba(20,14,6,0.55)" : "rgba(255,255,255,0.6)", border: `1px solid ${brd}`, color: txt };
  const iconBtn = { background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", flexShrink: 0 };
  const ghostBtn = { background: "transparent", color: T.modSub.color, border: `1px solid ${brd}`, borderRadius: 14, padding: "14px", fontSize: 14, fontFamily: SERIF, cursor: "pointer", width: "100%" };
  const glass = { background: T.lessGlass.bg, border: T.lessGlass.border, borderTop: T.lessGlass.borderTop, borderRadius: 14, boxShadow: T.lessGlass.shadow };
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
          {err && <div style={{ color: red, fontSize: 12.5, margin: "4px 0 10px", textAlign: "center" }}>{err}</div>}
          {!loading && !loadErr && (
            <button onClick={startNew} style={{ ...T.doneBtn, background: gold, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{ico.plus(dark ? "#1A1008" : "#fff")} Добавить урок</button>
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {ROLES.map(r => { const on = draft.role === r.id; return (
            <button key={r.id} onClick={() => patch({ role: r.id })} style={{ padding: "8px 13px", borderRadius: 12, fontFamily: SERIF, fontSize: 14, cursor: "pointer", background: on ? gold : "transparent", color: on ? (dark ? "#1A1008" : "#fff") : T.modSub.color, border: `1px solid ${on ? gold : brd}`, fontWeight: on ? "bold" : "normal" }}>{r.label}</button>
          ); })}
        </div>
        <div style={label}>Раздел</div>
        <input style={{ ...input, marginBottom: 16 }} value={draft.module} onChange={e => patch({ module: e.target.value })} placeholder="Напр. «Наше вино»" />
        <div style={label}>Название урока</div>
        <input style={{ ...input, marginBottom: 16 }} value={draft.title} onChange={e => patch({ title: e.target.value })} placeholder="Напр. «Базовые сорта белого»" />
        <div style={label}>Текст урока</div>
        <textarea style={{ ...input, minHeight: 120, resize: "vertical", lineHeight: 1.6 }} value={draft.content} onChange={e => patch({ content: e.target.value })} placeholder={"**жирный заголовок**\n• пункт списка"} />
        <div style={{ ...T.modSub, fontSize: 11, margin: "6px 0 22px", lineHeight: 1.5 }}>Форматирование как в штатных уроках: <b style={{ color: gold }}>**жирный**</b> и <b style={{ color: gold }}>• списки</b>.</div>

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
                <button onClick={() => setQ(q.id, { correct: oi })} style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: `2px solid ${right ? green : brd}`, background: right ? green : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>{right && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={dark ? "#1A1008" : "#fff"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}</button>
                <input style={{ ...input, padding: "10px 12px", fontSize: 14 }} value={opt} onChange={e => setQ(q.id, { options: q.options.map((o, k) => k === oi ? e.target.value : o) })} placeholder={`Вариант ${oi + 1}`} />
                {q.options.length > 2 && <button onClick={() => setQ(q.id, { options: q.options.filter((_, k) => k !== oi), correct: q.correct >= q.options.length - 1 ? 0 : q.correct })} style={iconBtn}>{ico.trash(T.modSub.color, 15)}</button>}
              </div>
            ); })}
            {q.options.length < 4 && <button onClick={() => setQ(q.id, { options: [...q.options, ""] })} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: gold, fontFamily: SERIF, fontSize: 12.5, cursor: "pointer", padding: "2px 0", marginBottom: 8 }}>{ico.plus(gold, 15)} вариант</button>}
            <div style={{ ...T.modSub, fontSize: 11, marginBottom: 4 }}>Зелёная галочка — верный ответ.</div>
            <input style={{ ...input, marginTop: 10, fontSize: 14 }} value={q.explanation} onChange={e => setQ(q.id, { explanation: e.target.value })} placeholder="Пояснение «почему»" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ flexShrink: 0 }}>{ico.photo(T.modSub.color)}</span>
              <input style={{ ...input, padding: "10px 12px", fontSize: 12.5 }} value={q.img} onChange={e => setQ(q.id, { img: e.target.value })} placeholder="Ссылка на фото (необязательно)" />
            </div>
            {q.img ? <img src={q.img} alt="" loading="lazy" decoding="async" style={{ width: "100%", maxHeight: 150, objectFit: "cover", borderRadius: 9, marginTop: 10, display: "block" }} /> : null}
          </div>
        ))}
        <button onClick={addQ} style={{ ...ghostBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>{ico.plus(gold)} Добавить вопрос</button>

        {err && <div style={{ color: red, fontSize: 12.5, marginBottom: 10, textAlign: "center" }}>{err}</div>}
        <button onClick={save} disabled={!canSave || busy} style={{ ...T.doneBtn, background: gold, opacity: (canSave && !busy) ? 1 : 0.45, cursor: (canSave && !busy) ? "pointer" : "default", marginBottom: 10 }}>{busy ? "Сохраняю…" : "Сохранить урок"}</button>
        <button onClick={() => { setView("list"); setDraft(null); }} style={ghostBtn}>Отменить</button>
        {!canSave && <div style={{ ...T.modSub, fontSize: 12.5, textAlign: "center", marginTop: 10 }}>Заполни хотя бы название урока.</div>}
      </div>
    </div>
  );
}
