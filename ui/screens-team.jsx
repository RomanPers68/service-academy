// ui/screens-team.jsx
// Команда (админка), вход по коду, аккаунт.
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
import { APP_SHARE_URL, POS_LABELS } from "./screens-gamification";

export function TeamScreen({ T, profile, a11y, onCandidate }) {
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
    // Ссылка ведёт в мини-приложение в Telegram; код зашит в startapp и подставится сам.
    // Код дублируем текстом — на случай входа с другого устройства.
    const text = `Service Academy — твой код входа: ${code}\n\nОткрой по ссылке — приложение запустится в Telegram, код подставится сам:\n${APP_SHARE_URL}?startapp=${encodeStartParam(code)}`;
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

  const [editNS, setEditNS] = React.useState({ name: "", surname: "" }); // форма «Изменить имя»

  const doRename = async () => {
    if (busy || !selected) return;
    const nm = editNS.name.trim(), sn = editNS.surname.trim();
    if (nm.length < 2) return;
    if (isDemo) {
      vibrate("success");
      setSelected({ ...selected, name: nm, surname: sn });
      setList(l => (l || []).map(e => e.id === selected.id ? { ...e, name: nm, surname: sn } : e));
      setConfirm(null);
      return;
    }
    setBusy(true); setActionError(null);
    try {
      const res = await rpc("admin_update_employee", { p_token: token, p_employee_id: selected.id, p_name: nm, p_surname: sn });
      if (res && res.ok) {
        vibrate("success");
        setSelected({ ...selected, name: nm, surname: sn });
        setConfirm(null); loadList();
      } else { vibrate("error"); setActionError("Не получилось. Проверь, что на сервере добавлена функция admin_update_employee."); }
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
      // Полная зачистка одной кнопкой: сначала результаты (как «Сбросить»
      // в Управлении данными), затем доступ. Сбой зачистки не блокирует.
      try { await rpc("admin_reset_player", { p_token: token, p_name: selected.name, p_surname: selected.surname || "" }); } catch (e2) {}
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
          <div style={{ color:T.modTitle.color, fontSize:18, fontWeight:"bold", fontFamily:ACCENT_SERIF, textAlign:"center" }}>
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
          ) : confirm === "edit" ? (
            <div className="sa-fast">
              <div style={{ color:T.para.color, fontSize:13, lineHeight:1.7, textAlign:"center", marginBottom:12 }}>
                Как правильно зовут сотрудника? Имя показывается в приветствии, рейтинге и книге отзывов.
              </div>
              <div style={{ display:"flex", gap:10, marginBottom:12 }}>
                <input style={{ ...inputStyle, flex:1 }} placeholder="Имя" value={editNS.name} onChange={e => setEditNS(s => ({ ...s, name: e.target.value }))} />
                <input style={{ ...inputStyle, flex:1 }} placeholder="Фамилия" value={editNS.surname} onChange={e => setEditNS(s => ({ ...s, surname: e.target.value }))} />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="sa-btn" style={{ ...ghostBtn, flex:1 }} onClick={() => setConfirm(null)}>Отмена</button>
                <button className="sa-btn" disabled={busy} onClick={doRename}
                  style={{ flex:1, padding:"13px", borderRadius:14, border:"none", fontSize:14, fontFamily:"Georgia, serif", fontWeight:"bold", cursor:"pointer", background:GOLD, color:"#1A1008", opacity: editNS.name.trim().length < 2 ? 0.5 : 1 }}>
                  {busy ? "..." : "Сохранить"}
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
              <button className="sa-btn" style={ghostBtn} onClick={() => { setEditNS({ name: selected.name || "", surname: selected.surname || "" }); setConfirm("edit"); }}>
                Изменить имя и фамилию
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

        {onCandidate && (
          <button className="sa-btn" onClick={() => { vibrate("light"); onCandidate(); }}
            style={{ width:"100%", marginBottom:14, padding:"13px 16px", borderRadius:14, cursor:"pointer",
              border:"1px solid rgba(200,160,80,0.35)", background:"rgba(200,169,110,0.08)",
              fontFamily:"Georgia, serif", fontSize:14, fontWeight:"bold", textAlign:"left", color:GOLD,
              display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ display:"flex", flexShrink:0 }}>{UI_SVG.dialog(GOLD, 17)}</span>
            <span style={{ flex:1 }}>Собеседование кандидата</span>
            <span style={{ color:"#9A8C74", fontWeight:"normal", fontSize:11.5 }}>тест до разговора</span>
          </button>
        )}

        {summary && (
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            {[
              { n: summary.act,   label:"активных", c:GREEN },
              { n: summary.wait,  label:"ждут код", c:"#D9C75B" },
              { n: summary.sleep, label:"спят 7д+", c:"#9A8C74" },
            ].map((s, i) => (
              <div key={i} style={{ flex:1, minWidth:88, textAlign:"center", padding:"10px 6px", borderRadius:14,
                background:"rgba(200,169,110,0.07)", border:"1px solid rgba(200,160,80,0.2)" }}>
                <div style={{ color:s.c, fontSize:20, fontWeight:"bold", fontFamily:ACCENT_SERIF }}>{s.n}</div>
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

  // Если открыто по ссылке-приглашению (t.me/...?startapp=КОД) — код подставляется сам
  React.useEffect(() => {
    try {
      const sp = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
      if (sp) {
        const dec = decodeStartParam(sp);
        if (dec) { setCode(format(dec)); vibrate("light"); }
      }
    } catch (e) {}
  }, []);

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
      <div style={{ color:CREAM, fontSize:21, fontWeight:"bold", fontFamily:ACCENT_SERIF, marginBottom:8, textAlign:"center" }}>
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

// ═══ PIN наставника: руководящий состав задаёт себе 4–6 цифр, которыми заверяет
//     допуски сотрудников (проверка на сервере — supabase-stage6-mentor-pin.sql).
//     Пока stage 6 не применён, честно сообщаем об этом. ═══
function MentorPinBlock({ T, gold }) {
  const [pin, setPin] = React.useState("");
  const [state, setState] = React.useState(null); // null | "saving" | "ok" | "err:<msg>"
  const canSave = /^[0-9]{4,6}$/.test(pin) && state !== "saving";
  const savePin = async () => {
    if (!canSave) return;
    setState("saving");
    try {
      const resp = await rpc("set_mentor_pin", { p_token: saToken(), p_pin: pin });
      if (resp && resp.ok) { setState("ok"); setPin(""); vibrate("success"); }
      else setState("err:" + (resp?.error === "not_mentor" ? "PIN доступен только руководящему составу." : resp?.error === "auth" ? "Сессия устарела — перезайди по коду." : "Не получилось. Попробуй ещё раз."));
    } catch (e) {
      setState("err:Функция появится после обновления сервера (stage 6).");
    }
  };
  return (
    <div style={{ ...T.modCard, flexDirection:"column", alignItems:"stretch", gap:10, marginBottom:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v2.5"/></svg>
        <span style={{ color: T.modTitle.color, fontSize:14, fontWeight:"bold" }}>PIN наставника</span>
      </div>
      <div style={{ color: T.modSub.color, fontSize:12, lineHeight:1.55 }}>
        Этим PIN ты заверяешь допуски сотрудников — вводи его только сам(а) и никому не сообщай. 4–6 цифр.
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <input value={pin}
          onChange={e => { setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6)); setState(null); }}
          inputMode="numeric" pattern="[0-9]*" type="password" autoComplete="new-password" placeholder="••••"
          style={{ flex:1, minWidth:0, boxSizing:"border-box", padding:"11px 13px", borderRadius:12, border:`1px solid ${gold}66`, background:"rgba(0,0,0,0.12)", color: T.modTitle.color, fontSize:16, letterSpacing:5, textAlign:"center", fontFamily:"monospace", outline:"none" }} />
        <button className="sa-btn" onClick={savePin} {...onActivate(savePin)}
          style={{ flexShrink:0, padding:"11px 16px", borderRadius:12, border:"none", background: canSave ? gold : gold+"44", color:"#1A1008", fontWeight:"bold", fontSize:13, cursor: canSave ? "pointer" : "default" }}>
          {state === "saving" ? "…" : "Сохранить"}
        </button>
      </div>
      {state === "ok" && <div style={{ color:"#5DBB8A", fontSize:12 }}>✓ PIN сохранён. Старый PIN больше не действует.</div>}
      {typeof state === "string" && state.startsWith("err:") && <div style={{ color:"#E07878", fontSize:12 }}>{state.slice(4)}</div>}
    </div>
  );
}

export function AccountScreen({ profile, T, onBack, onLogout, onTrainingCard }) {
  const [confirmOut, setConfirmOut] = React.useState(false);
  const posLabel = { waiter:"Официант", hostess:"Хостес", bartender:"Бармен", senior_bartender:"Старший бармен", manager:"Менеджер", senior:"Руководящий состав" }[profile?.position] || profile?.position;
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

        {/* ═══ PIN наставника — только руководящий состав. Этим PIN заверяются допуски. ═══ */}
        {(["manager","senior"].includes(profile?.position) || profile?.is_admin) && (() => {
          const gold = GOLD;
          return <MentorPinBlock T={T} gold={gold} />;
        })()}

        {/* ═══ Карта обучения — печатный документ для личного дела ═══ */}
        {onTrainingCard && (
          <div className="sa-card" style={{ ...T.modCard, marginBottom:20, cursor:"pointer" }}
            onClick={onTrainingCard} {...onActivate(onTrainingCard)}>
            <div style={{ ...T.modBar, background: GOLD }} />
            <div style={{ width:34, height:34, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(200,169,110,0.13)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h10v6H7z"/><path d="M5 9h14a2 2 0 0 1 2 2v6h-4v4H7v-4H3v-6a2 2 0 0 1 2-2z"/><path d="M7 15h10"/></svg>
            </div>
            <div style={{ flex:1, minWidth:0, paddingLeft:6 }}>
              <div style={T.modTitle}>Карта обучения</div>
              <div style={{ ...T.modSub, whiteSpace:"normal" }}>Печатный документ для личного дела: треки, экзамены, допуски</div>
            </div>
            <div style={T.modArrow}>›</div>
          </div>
        )}

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
