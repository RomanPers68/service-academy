import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import React from "react";

// ── Вынесенные модули ──────────────────────────────────────────────
import { SUPABASE_URL, SUPABASE_KEY, rpc, saToken, rpcSync, flushQueue, supabase } from "./api/supabase";
import { MODULES } from "./data/modules";
import { ROLES, RESTAURANTS } from "./data/roles";
import { GLOSSARY } from "./data/glossary";
import { DIALOGUES_DATA, MOOD_EMOJI_D, MOOD_COLORS_D } from "./data/dialogues";
import { LOGO_SRC, LOGO_SRC_DARK } from "./assets/logo";
import { normSurname, shuffleArray, dedupeBestScores, pickRandom, shuffleSituationOptions, vibrate } from "./lib/utils";
import { injectStyles } from "./ui/css";
import { MM, Mm, ROLE_SVG, UI_SVG, POS_SVG, MOD_SVG, MARKER_RE, GAME_SVG, NAV_ICONS } from "./ui/icons";
import { S, A } from "./ui/styles";













injectStyles();



function AchievementPopup({ ach, a11y, onClose }) {
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

  const color = ach.color || "#C8A96E";
  const popupBg = a11y ? "rgba(220,200,165,0.55)" : "rgba(20,14,6,0.45)";
  const labelColor = a11y ? "rgba(120,85,30,0.55)" : "rgba(200,160,80,0.6)";
  const titleColor = a11y ? "#6B4A10" : color;

  return (
    <div onClick={handleClose}
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
        <div onClick={handleClose}
          style={{ textAlign:"center", color, fontSize:13, opacity:0.6, cursor:"pointer", fontFamily:"Georgia, serif" }}>
          Закрыть ✕
        </div>
      </div>
    </div>
  );
}

function ServiceAcademy() {
  const [screen, setScreen] = useState("roleSelect");
  const [prevScreen, setPrevScreen] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = React.useState(null);
  const [profile, setProfile] = useState(null);
  const [scores, setScores] = useState([]);
  const [practiceStars, setPracticeStars] = useState({}); // { "name|surname": { "lesson_id": stars } }
  const [allProfiles, setAllProfiles] = useState([]); // все пользователи из таблицы profiles
  const [newAchievement, setNewAchievement] = useState(null); // { icon, label } для popup
  const [quizDone, setQuizDone] = useState({});
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [role, setRole] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [completed, setCompleted] = useState({});
  const [completedRoles, setCompletedRoles] = useState(new Set());
  const [quizState, setQuizState] = useState({ step: 0, answers: [], done: false, mistakes: 0 });
  const [practiceState, setPracticeState] = useState({ step: 0, choice: null, isAnswered: false, results: [], done: false, lives: 3, score: 0, combo: 0, situations: [], flash: null, usedIds: [] });
  const [gameKey, setGameKey] = useState(0);
  const [a11y, setA11y] = useState(false);
  const [streak, setStreak] = useState({ count: 0, best: 0, last: "", days: [] });

  // Инициализация Telegram WebApp: убираем серые рамки, красим шапку и фон под тему
  React.useEffect(() => {
    try {
      const tg = window.Telegram?.WebApp;
      const bg = a11y ? "#E8DEC8" : "#14100A";
      document.documentElement.style.background = bg;
      document.body.style.background = bg;
      if (!tg) return;
      tg.ready?.();
      tg.expand?.();
      tg.setBackgroundColor?.(bg);
      tg.setHeaderColor?.(bg);
      tg.setBottomBarColor?.(bg);
    } catch (e) {}
  }, [a11y]);
  const isAdmin = !!profile?.is_admin;

  // Офлайн-очередь: досылаем несохранённые записи при старте, возврате сети и раз в минуту
  React.useEffect(() => {
    flushQueue();
    const onOnline = () => flushQueue();
    window.addEventListener("online", onOnline);
    const iv = setInterval(flushQueue, 60000);
    return () => { window.removeEventListener("online", onOnline); clearInterval(iv); };
  }, []);

  // Загрузка из хранилища: сессия → whoami → профиль
  React.useEffect(() => {
    // Таймаут — если что-то зависнет, показываем экран входа
    const fallback = setTimeout(() => {
      setStorageLoaded(true);
      setScreen("login");
    }, 4000);

    const storageGet = (key) => {
      try {
        const val = localStorage.getItem(key);
        return Promise.resolve(val ? { value: val } : null);
      } catch(e) {
        return Promise.resolve(null);
      }
    };

    (async () => {
      let p = null;
      try {
        let token = null;
        try { token = localStorage.getItem("sa_session_token"); } catch(e) {}
        if (!token) { clearTimeout(fallback); setStorageLoaded(true); setScreen("login"); return; }

        let cached = null;
        try { const c = localStorage.getItem("sa_profile"); if (c) cached = JSON.parse(c); } catch(e) {}

        let res = null;
        try { res = await rpc("whoami", { p_token: token }); } catch(e) { res = null; }

        if (res && res.ok) {
          const emp = res.employee;
          const prof = { id: emp.id, name: emp.name, surname: normSurname(emp.surname || ""), restaurant: emp.restaurant, position: emp.position, is_admin: !!emp.is_admin };
          try { localStorage.setItem("sa_profile", JSON.stringify(prof)); } catch(e) {}
          setProfile(prof);
          p = { value: JSON.stringify(prof) };
        } else if (res && res.ok === false) {
          // Сессия отозвана (сброс кода / деактивация) — на вход
          try { localStorage.removeItem("sa_session_token"); } catch(e) {}
          clearTimeout(fallback); setStorageLoaded(true); setScreen("login"); return;
        } else if (cached) {
          // Сеть недоступна — работаем с кэшем профиля (офлайн-режим)
          setProfile(cached);
          p = { value: JSON.stringify(cached) };
        } else { clearTimeout(fallback); setStorageLoaded(true); setScreen("login"); return; }
      } catch(e) { clearTimeout(fallback); setStorageLoaded(true); setScreen("login"); return; }
      try { const s = await storageGet("sa_scores"); if (s) { const saved = JSON.parse(s.value); setScores(prev => { const ids = new Set(saved.map(x => x.id)); return [...prev.filter(x => !ids.has(x.id)), ...saved]; }); } } catch(e) {}
      // quizDone загружается из Supabase ниже
      try { const uk2 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const cr = await storageGet("sa_completed_roles"+uk2) || await storageGet("sa_completed_roles"); if (cr) setCompletedRoles(new Set(JSON.parse(cr.value))); } catch(e) {}
      try { const uk3 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const sc = await storageGet("sa_completed"+uk3) || await storageGet("sa_completed"); if (sc) setCompleted(JSON.parse(sc.value)); } catch(e) {}
      try { const lr = await storageGet("sa_last_role"); if (lr) setRole(JSON.parse(lr.value)); } catch(e) {}
      try { const ps = await storageGet("sa_practice_stars"); if (ps) setPracticeStars(JSON.parse(ps.value)); } catch(e) {}
      try { const uk4 = p ? `_${JSON.parse(p.value).name}_${JSON.parse(p.value).surname||""}` : ""; const st = await storageGet("sa_streak"+uk4); if (st) setStreak(JSON.parse(st.value)); } catch(e) {}
      clearTimeout(fallback);
      setStorageLoaded(true);
    })();
  }, []);

  // Загрузка всех профилей из Supabase
  React.useEffect(() => {
    const h = { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY };
    fetch(`${SUPABASE_URL}/rest/v1/profiles?select=name,surname,restaurant,position,last_role`, { headers: h })
      .then(r => r.json()).then(data => {
        if (Array.isArray(data) && data.length > 0) setAllProfiles(data);
      }).catch(() => {});
  }, []);

  // Загрузка рейтинга из Supabase
  React.useEffect(() => {
    supabase.from("scores").select("*").then(({ data }) => {
      if (data && data.length > 0) {
        const mapped = data.map(s => ({
          id: s.id, name: s.name, surname: s.surname || "",
          restaurant: s.restaurant, role: s.role, position: s.position || "waiter",
          quizTitle: "", quiz_id: s.quiz_id, score: s.score, total: s.total,
          pct: s.total > 0 ? Math.round(s.score / s.total * 100) : 0,
          date: new Date(s.updated_at).toLocaleDateString("ru-RU"),
          updated_at: s.updated_at,
        }));
        setScores(mapped);

        // Проверяем ачивку «Первопроходец» — первый кто появился в системе
        if (profile) {
          const myScores = mapped.filter(s => s.name === profile.name && s.surname === normSurname(profile.surname));
          if (myScores.length > 0) {
            const allDates = mapped.map(s => s.updated_at).sort();
            const myDates = myScores.map(s => s.updated_at).sort();
            const alreadyShown = localStorage.getItem(`sa_ach_pioneer_${profile.name}_${normSurname(profile.surname)}`);
            if (!alreadyShown && myDates[0] === allDates[0] && mapped.length > myScores.length) {
              setTimeout(() => {
                setNewAchievement({ icon: "🚀", label: "Первопроходец" });
                vibrate("heavy");
                try { localStorage.setItem(`sa_ach_pioneer_${profile.name}_${normSurname(profile.surname)}`, "1"); } catch(e) {}
                setTimeout(() => setNewAchievement(null), 3000);
              }, 1500);
            }
          }
        }
      }
    }).catch(() => {});
  }, [profile]);

  // Загрузка progress из Supabase и синхронизация с completed
  React.useEffect(() => {
    if (!profile) return;
    fetch(`${SUPABASE_URL}/rest/v1/progress?user_id=eq.${encodeURIComponent(profile.id)}`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    }).then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return; // ошибка от Supabase — не трогаем state
      if (data.length === 0) return; // пусто — не обнуляем
      {
        // Восстанавливаем completed из Supabase — авторитетный источник
        const allValidIds = new Set(
          Object.values(MODULES).flatMap(modules =>
            modules.flatMap(m => m.lessons.map(l => l.id))
          )
        );
        const seen = new Set();
        const validRows = data.filter(row => {
          if (!allValidIds.has(row.lesson_id)) return false;
          if (seen.has(row.lesson_id)) return false;
          seen.add(row.lesson_id);
          return true;
        });
        const merged = {};
        validRows.forEach(row => { merged[row.lesson_id] = true; });
        setCompleted(merged);
        try { const uk = `_${profile.name}_${profile.surname||""}`; localStorage.setItem("sa_completed"+uk, JSON.stringify(merged)); } catch(e) {}
      }
    }).catch(() => {});
  }, [profile]);

  // Загрузка quizDone из Supabase — авторитетный источник
  React.useEffect(() => {
    if (!profile) return;
    fetch(`${SUPABASE_URL}/rest/v1/quiz_done?user_id=eq.${encodeURIComponent(profile.id)}`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    }).then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return; // ошибка от Supabase — не трогаем state
      if (data.length === 0) return; // пусто — не обнуляем
      const done = {};
      data.forEach(row => { if (row.quiz_id) done[row.quiz_id] = true; });
      setQuizDone(done);
      try { localStorage.setItem("sa_quiz_done", JSON.stringify(done)); } catch(e) {}
    }).catch(() => {});
  }, [profile]);

  // Загрузка last_role из Supabase если localStorage не дал роль
  React.useEffect(() => {
    if (!profile || role) return; // уже есть роль — не нужно
    fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(profile.id)}&select=last_role`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    }).then(r => r.json()).then(data => {
      if (data && data.length > 0 && data[0].last_role) {
        setRole(data[0].last_role);
        try { localStorage.setItem("sa_last_role", JSON.stringify(data[0].last_role)); } catch(e) {}
        setScreen("home");
      }
    }).catch(() => {});
  }, [profile, role]);

  // Загрузка practiceStars из Supabase — авторитетный источник
  React.useEffect(() => {
    if (!profile) return;
    const userKey = `${profile.name}|${profile.surname || ""}`;
    fetch(`${SUPABASE_URL}/rest/v1/practice_stars?user_id=eq.${encodeURIComponent(profile.id)}`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    }).then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return; // ошибка — не трогаем
      if (data.length === 0) return; // пусто — не обнуляем, оставляем как есть
      const starsObj = {};
      data.forEach(row => { starsObj[row.lesson_id] = row.stars; });
      setPracticeStars(prev => {
        const updated = { ...prev, [userKey]: starsObj };
        try { localStorage.setItem("sa_practice_stars", JSON.stringify(updated)); } catch(e) {}
        return updated;
      });
    }).catch(() => {});
  }, [profile]);

  // Загрузка completedRoles из Supabase — авторитетный источник
  React.useEffect(() => {
    if (!profile) return;
    fetch(`${SUPABASE_URL}/rest/v1/completed_roles?user_id=eq.${encodeURIComponent(profile.id)}`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    }).then(r => r.json()).then(data => {
      if (!Array.isArray(data)) return; // ошибка — не трогаем
      if (data.length === 0) return; // пусто — не обнуляем
      const roles = new Set(data.map(row => row.role));
      setCompletedRoles(roles);
      try { const uk = `_${profile.name}_${profile.surname||""}`; localStorage.setItem("sa_completed_roles"+uk, JSON.stringify([...roles])); } catch(e) {}
    }).catch(() => {});
  }, [profile]);

  const modules = useMemo(() => role ? MODULES[role] : [], [role]);
  const totalLessons = useMemo(() => modules.reduce((a, m) => a + m.lessons.filter(l => l.type !== "result").length, 0), [modules]);
  const roleLesonIds = useMemo(() => new Set(modules.flatMap(m => m.lessons.filter(l => l.type !== "result").map(l => l.id))), [modules]);
  const roleQuizIds = useMemo(() => new Set(modules.flatMap(m => m.lessons.filter(l => l.type === "quiz").map(l => l.id))), [modules]);
  const doneCount = useMemo(() => {
    const lessonsDone = Object.keys(completed).filter(k => completed[k] && roleLesonIds.has(k) && !roleQuizIds.has(k)).length;
    const quizzesDone = Object.keys(quizDone).filter(k => quizDone[k] && roleQuizIds.has(k)).length;
    return lessonsDone + quizzesDone;
  }, [completed, quizDone, roleLesonIds, roleQuizIds]);
  const progress = useMemo(() => totalLessons ? Math.round((doneCount / totalLessons) * 100) : 0, [doneCount, totalLessons]);
  const navigate = useCallback((to) => { setScreen(prev => { setPrevScreen(prev); return to; }); }, []);
  const handleLogin = useCallback((token, emp) => {
    const prof = { id: emp.id, name: emp.name, surname: normSurname(emp.surname || ""), restaurant: emp.restaurant, position: emp.position, is_admin: !!emp.is_admin };
    try {
      localStorage.setItem("sa_session_token", token || "demo");
      localStorage.setItem("sa_profile", JSON.stringify(prof));
    } catch(e) {}
    setProfile(prof);
    setScreen("roleSelect");
  }, []);
  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem("sa_session_token");
      localStorage.removeItem("sa_profile");
      localStorage.removeItem("sa_last_role");
    } catch(e) {}
    setProfile(null);
    setRole(null);
    setScreen("login");
  }, []);
  const selectRole = useCallback((r) => {
    setRole(r);
    try { localStorage.setItem("sa_last_role", JSON.stringify(r)); } catch(e) {}
    // Сохраняем выбранную роль в Supabase
    if (profile) {
      rpcSync("save_last_role", { p_token: saToken(), p_role: r });
    }
    setScreen("home");
  }, [profile]);
  const openModule = useCallback((m) => { setActiveModule(m); setScreen("module"); }, []);
  const openLesson = (l) => {
    if (l.type === "quiz" && quizDone[l.id]) return;
    const originalLesson = role ? (MODULES[role] || []).flatMap(m => m.lessons).find(lesson => lesson.id === l.id) || l : l;
    let initQuestions = originalLesson.questions || [];
    let lessonToOpen = originalLesson;
    if (originalLesson.type === "quiz" && initQuestions.length > 0) {
      const SHOW = 12;
      const picked = pickRandom(initQuestions, Math.min(SHOW, initQuestions.length));
      const withShuffled = picked.map(q => {
        const opts = q.options.map((o, i) => ({ text: o, isCorrect: i === q.correct }));
        const shuffledOpts = shuffleArray(opts);
        return { ...q, options: shuffledOpts.map(o => o.text), correct: shuffledOpts.findIndex(o => o.isCorrect) };
      });
      initQuestions = withShuffled;
      lessonToOpen = { ...originalLesson, questions: withShuffled };
    }
    setActiveLesson(lessonToOpen);
    setQuizState({ step: 0, answers: [], done: false, mistakes: 0, blocked: false, questions: initQuestions });
    const pool = l.situations || [];
    const shuffled = pickRandom(pool, 6).map(shuffleSituationOptions);
    const firstUsedIds = shuffled.map(s => s.scene || s.statement || s.question || JSON.stringify(s).slice(0,60));
    setPracticeState({ step: 0, choice: null, isAnswered: false, results: [], done: false, lives: 3, score: 0, combo: 0, situations: shuffled, flash: null, usedIds: firstUsedIds });
    setGameKey(k => k + 1);
    navigate("lesson");
  };
  const ROLE_ORDER = ["seasonal", "core", "manager", "service_manager"];
  const checkAndShowAchievements = useCallback((newScores, newPracticeStars, newCompletedRoles) => {
    if (!profile) return;
    const key = `${profile.name}|${profile.surname}`;
    const myScores = newScores.filter(s => s.name === profile.name && s.surname === profile.surname);
    const myStarsObj = newPracticeStars[key] || {};
    const myStars = Object.values(myStarsObj).reduce((a, b) => a + b, 0);
    const maxStars = Math.max(...Object.keys(newPracticeStars).map(k => Object.values(newPracticeStars[k] || {}).reduce((a, b) => a + b, 0)), 0);

    const achieved = [];

    // 🌟 Бог сервиса — все 4 роли пройдены + все тесты 100%
    const allRolesDone = ROLE_ORDER.every(r => newCompletedRoles.has(r));
    const allPerfect = myScores.length > 0 && myScores.every(s => s.pct === 100);
    if (allRolesDone && allPerfect) achieved.push({ icon:"🌟", label:"Бог сервиса", key:"god" });

    // 🏆 Мастер практики — больше всех звёздочек
    if (myStars > 0 && myStars === maxStars && Object.keys(newPracticeStars).length > 1) {
      achieved.push({ icon:"🏆", label:"Мастер практики", key:"master" });
    }

    // ⭐ Ядро команды — лучший средний % в роли core
    const coreScores = dedupeBestScores(newScores).filter(s => s.role === "core");
    if (coreScores.length > 0) {
      const myCore = coreScores.filter(s => s.name === profile.name && s.surname === profile.surname);
      const myAvg = myCore.length > 0 ? myCore.reduce((sum, s) => sum + s.pct, 0) / myCore.length : 0;
      const allAvgs = [...new Set(newScores.map(s => `${s.name}|${s.surname}`))].map(k => {
        const ps = coreScores.filter(s => `${s.name}|${s.surname}` === k);
        return ps.length > 0 ? ps.reduce((sum, s) => sum + s.pct, 0) / ps.length : 0;
      });
      const maxAvg = Math.max(...allAvgs, 0);
      if (myAvg > 0 && myAvg === maxAvg && allAvgs.filter(a => a > 0).length > 1) {
        achieved.push({ icon:"⭐", label:"Ядро команды", key:"core" });
      }
    }

    // Показываем только те что ещё не показывали
    const toShow = achieved.filter(a => {
      try { return !localStorage.getItem(`sa_ach_${a.key}_${profile.name}_${profile.surname||""}`); } catch(e) { return true; }
    });

    if (toShow.length > 0) {
      toShow.forEach((a, i) => {
        setTimeout(() => {
          setNewAchievement(a);
          vibrate("heavy");
          try { localStorage.setItem(`sa_ach_${a.key}_${profile.name}_${profile.surname||""}`, "1"); } catch(e) {}
        }, i * 3500);
        setTimeout(() => setNewAchievement(null), i * 3500 + 3000);
      });
    }
  }, [profile]);

  const completeLesson = useCallback(() => {
    try {
      if (!activeLesson) { setScreen("module"); return; }
      const uk = profile ? `_${profile.name}_${profile.surname||""}` : "";

      // 1. Урок пройден
      const newCompleted = { ...completed, [activeLesson.id]: true };
      try { localStorage.setItem("sa_completed"+uk, JSON.stringify(newCompleted)); } catch(e) {}
      setCompleted(newCompleted);

      // Стрик: отмечаем активность за сегодня
      try {
        const _ymd = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
        const _today = _ymd(new Date());
        setStreak(prev => {
          if (prev.last === _today) return prev;
          const _y = new Date(); _y.setDate(_y.getDate() - 1);
          const _yest = _ymd(_y);
          const count = prev.last === _yest ? (prev.count || 0) + 1 : 1;
          const best = Math.max(prev.best || 0, count);
          const days = [...new Set([...(prev.days || []), _today])].slice(-21);
          const next = { count, best, last: _today, days };
          try { localStorage.setItem("sa_streak"+uk, JSON.stringify(next)); } catch(e) {}
          return next;
        });
      } catch(e) {}

      // Прогресс урока в Supabase — только при первом прохождении
      if (profile && activeLesson.type !== "quiz" && !completed[activeLesson.id]) {
        rpcSync("save_progress", { p_token: saToken(), p_lesson_id: activeLesson.id, p_role: role });
      }

      // 2. Квиз → результат + отметка о прохождении (считаем свежие значения, чтобы передать их дальше)
      let newScores = scores;
      let newQuizDone = quizDone;
      if (activeLesson.type === "quiz" && profile) {
        const sc = quizState.answers.filter(a => a.isCorrect).length;
        const newScore = {
          id: Date.now(), name: profile.name, surname: normSurname(profile.surname),
          restaurant: profile.restaurant, role, position: profile.position || "waiter",
          quizTitle: activeLesson.title, quiz_id: activeLesson.id, score: sc, total: activeLesson.questions.length,
          pct: Math.round(sc / activeLesson.questions.length * 100),
          date: new Date().toLocaleDateString("ru-RU"),
        };
        rpcSync("save_score", { p_token: saToken(), p_quiz_id: activeLesson.id, p_role: role, p_score: sc, p_total: activeLesson.questions.length });

        newScores = [...scores, newScore];
        try { localStorage.setItem("sa_scores", JSON.stringify(newScores.filter(s => s.id > 900))); } catch(e) {}
        setScores(newScores);

        if (!quizDone[activeLesson.id]) {
          newQuizDone = { ...quizDone, [activeLesson.id]: true };
          try { localStorage.setItem("sa_quiz_done", JSON.stringify(newQuizDone)); } catch(e) {}
          setQuizDone(newQuizDone);
          rpcSync("save_quiz_done", { p_token: saToken(), p_quiz_id: activeLesson.id });
        }
      }

      // 3. Звёздочки практики — лучший результат по каждой практике
      let newPracticeStars = practiceStars;
      if (activeLesson.type === "practice" && profile) {
        const stars = practiceState.score >= 60 ? 3 : practiceState.score >= 30 ? 2 : 1;
        const userKey = `${profile.name}|${profile.surname}`;
        const userStars = practiceStars[userKey] || {};
        const prevBest = userStars[activeLesson.id] || 0;
        if (stars > prevBest) { // обновляем только если результат лучше
          newPracticeStars = { ...practiceStars, [userKey]: { ...userStars, [activeLesson.id]: stars } };
          try { localStorage.setItem("sa_practice_stars", JSON.stringify(newPracticeStars)); } catch(e) {}
          setPracticeStars(newPracticeStars);
          rpcSync("save_practice_stars", { p_token: saToken(), p_lesson_id: activeLesson.id, p_stars: stars });
        }
      }

      // 4. Пройдена ли вся роль? (используем СВЕЖИЕ newCompleted / newQuizDone)
      const allLessons = (MODULES[role] || []).flatMap(m => m.lessons).filter(l => l.type !== "result");
      const allDone = allLessons.every(l => l.type === "quiz" ? newQuizDone[l.id] : newCompleted[l.id]);
      const nextIdx = ROLE_ORDER.indexOf(role) + 1;
      const nextRole = ROLE_ORDER[nextIdx];
      if (allDone && nextRole && !completedRoles.has(nextRole)) { // открываем следующую роль, если она ещё закрыта
        const updatedRoles = new Set([...completedRoles, role]);
        updatedRoles.add(nextRole); // разблокируем следующую
        try { localStorage.setItem("sa_completed_roles"+uk, JSON.stringify([...updatedRoles])); } catch(e) {}
        setCompletedRoles(updatedRoles);
        if (profile) {
          const newRoles = [role, nextRole].filter(Boolean);
          newRoles.forEach(r => {
            rpcSync("save_completed_role", { p_token: saToken(), p_role: r });
          });
        }
        setTimeout(() => checkAndShowAchievements(newScores, newPracticeStars, updatedRoles), 500);
        vibrate("heavy");
        setTimeout(() => setScreen("roleComplete"), 50);
      } else {
        vibrate("success");
        setTimeout(() => setScreen("module"), 50);
      }
    } catch(e) {
      console.error("completeLesson error:", e);
      setScreen("module");
    }
  }, [activeLesson, profile, quizState.answers, role, practiceState, scores, practiceStars, completed, quizDone, completedRoles, checkAndShowAchievements]);
  const handleQuiz = useCallback((idx) => {
    if (quizState.blocked) return;
    const q = activeLesson.questions[quizState.step];
    const isCorrect = idx === q.correct;
    const newMistakes = quizState.mistakes + (isCorrect ? 0 : 1);
    const answers = [...quizState.answers, { idx, isCorrect }];
    const done = quizState.step + 1 >= activeLesson.questions.length;
    if (isCorrect) vibrate("light");
    else vibrate("error");
    if (newMistakes >= 3 && !isCorrect) {
      setQuizState({ step: quizState.step, answers, done: true, mistakes: newMistakes, blocked: true });
      return;
    }
    setQuizState({ step: done ? quizState.step : quizState.step + 1, answers, done, mistakes: newMistakes, blocked: false });
  }, [quizState, activeLesson]);
  const flashTimerRef = useRef(null);
  const handlePracticeChoice = useCallback((idx) => {
    let vibratePattern = null;
    setPracticeState(p => {
      if (p.isAnswered) return p;
      const sit = p.situations[p.step];
      if (!sit) return p;
      const isCorrect = idx === sit.correct;
      const newCombo = isCorrect ? p.combo + 1 : 0;
      const pts = isCorrect ? (newCombo >= 2 ? 20 : 10) : 0;
      vibratePattern = isCorrect ? (newCombo >= 2 ? "medium" : "light") : "error";
      return { ...p, choice: idx, isAnswered: true, lives: isCorrect ? p.lives : p.lives - 1, score: p.score + pts, combo: newCombo, flash: isCorrect ? "win" : "fail" };
    });
    if (vibratePattern) vibrate(vibratePattern);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setPracticeState(p => ({ ...p, flash: null })), 600);
  }, []);
  const handlePracticeNext = useCallback(() => {
    setPracticeState(p => {
      const sit = p.situations[p.step];
      if (!sit) return p;
      const isCorrect = p.choice === sit.correct;
      const results = [...p.results, isCorrect];
      const nextStep = p.step + 1;
      const gameover = p.lives <= 0 && !isCorrect;
      if (nextStep >= p.situations.length || gameover) {
        return { ...p, results, done: true, isAnswered: false };
      }
      return { ...p, step: nextStep, choice: null, isAnswered: false, results, flash: null, timerUrgent: false };
    });
  }, []);

  const leaderboard = useMemo(() => Object.values(
    dedupeBestScores(scores).reduce((acc, s) => {
      const key = `${s.name}|${s.surname}|${s.restaurant}`;
      if (!acc[key]) acc[key] = { name: s.name, surname: s.surname, restaurant: s.restaurant, role: s.role, position: s.position || "waiter", total: 0, sum: 0 };
      acc[key].total++; acc[key].sum += s.pct;
      return acc;
    }, {})
  ).map(p => ({ ...p, avg: Math.round(p.sum / p.total) })).sort((a, b) => b.avg - a.avg), [scores]);

  const T = a11y ? A : S;

  if (!storageLoaded) return (
    <div style={{ ...T.app, alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:18 }}>
        <img src={LOGO_SRC_DARK} alt="" style={{ width:150, animation:'logoPulse 1.6s ease-in-out infinite', filter:"brightness(0) saturate(100%) invert(95%) sepia(10%) saturate(400%) hue-rotate(340deg) brightness(98%)" }} />
        <div style={{ color:'#9A8C74', fontSize:11, fontFamily:'monospace', letterSpacing:3 }}>ЗАГРУЗКА</div>
      </div>
    </div>
  );

  return (
    <div style={T.app}>
      {/* 🏆 Achievement popup */}
      {newAchievement && (
        <AchievementPopup ach={newAchievement} a11y={a11y} onClose={() => setNewAchievement(null)} />
      )}

      <div style={T.phone}>
        {!["profile","login"].includes(screen) && (
          <div style={T.a11yBar}>
            <span style={{ ...T.a11yLabel, color:"#C8A050", fontSize:13, letterSpacing:3, fontFamily:"monospace" }}>✦ SA</span>
            <button style={{ ...T.a11yBtn, background: a11y ? "#7C9E87" : "#E8A020" }} onClick={() => setA11y(!a11y)}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}>{a11y ? UI_SVG.moon("currentColor", 12) : UI_SVG.eye("currentColor", 12)}{a11y ? "Тёмная" : "Для чтения"}</span>
            </button>
          </div>
        )}
        {screen === "login" && <CodeLoginScreen T={S} onSuccess={handleLogin} />}
        {screen === "team" && profile?.is_admin && <TeamScreen T={T} profile={profile} a11y={a11y} />}
        {screen === "checklist" && <div style={{paddingBottom:88}}><ChecklistScreen T={T} a11y={a11y} profile={profile} onBack={() => navigate("roleSelect")} /></div>}
        {screen === "onboarding" && <div style={{paddingBottom:88}}><OnboardingScreen T={T} a11y={a11y} profile={profile} role={role} onBack={() => navigate("roleSelect")} /></div>}
        {screen === "analytics" && <div style={{paddingBottom:88}}><AnalyticsScreen T={T} a11y={a11y} profile={profile} scores={scores} onBack={() => navigate("roleSelect")} /></div>}
        {screen === "profile" && <AccountScreen profile={profile} T={T} onBack={() => navigate(prevScreen || "roleSelect")} onLogout={handleLogout} />}
        {screen === "playerDetail" && selectedPlayer && <PlayerDetailScreen player={selectedPlayer} T={T} onBack={() => navigate("stats")} />}
        {screen === "stats" && <div style={{paddingBottom:88}}><StatsScreen T={T} profile={profile} scores={scores} completedRoles={completedRoles} completed={completed} quizDone={quizDone} practiceStars={practiceStars} allProfiles={allProfiles} onBack={() => navigate("roleSelect")}
          onResetPlayer={isAdmin ? (name, surname) => {
            setScores(prev => prev.filter(s => !(s.name === name && s.surname === surname)));
            if (profile && profile.name === name && profile.surname === surname) {
              setCompleted({});
              setQuizDone({});
              setCompletedRoles(new Set());
              setRole(null);
              try { const uk = `_${name}_${surname||""}`; localStorage.removeItem("sa_completed"+uk); localStorage.removeItem("sa_completed_roles"+uk); localStorage.removeItem("sa_last_role"); } catch(e) {}
              try { localStorage.removeItem("sa_quiz_done"); } catch(e) {}
              try { localStorage.removeItem("sa_scores"); } catch(e) {}
              try { localStorage.removeItem("sa_practice_stars"); } catch(e) {}
            }
            rpc("admin_reset_player", { p_token: saToken(), p_name: name, p_surname: surname || "" }).catch(() => {});
            // Сразу обнуляем звёзды в state и localStorage
            setPracticeStars(prev => { const n = {...prev}; delete n[`${name}|${surname||""}`]; return n; });
            try { localStorage.removeItem("sa_practice_stars"); } catch(e) {}
            // practice_stars / completed_roles / profiles на сервере уже удалены через admin_reset_player выше
            // Очищаем localStorage для любого пользователя
            try { const uk = `_${name}_${surname||""}`; localStorage.removeItem("sa_completed"+uk); localStorage.removeItem("sa_completed_roles"+uk); } catch(e) {}
            // Ачивки тоже сбрасываем
            try { ["god","master","core","pioneer"].forEach(k => localStorage.removeItem(`sa_ach_${k}_${name}_${surname||""}`)); } catch(e) {}
            navigate("roleSelect");
          } : null}
          onUnlockQuiz={isAdmin ? (name, surname) => {
            rpc("admin_unlock_quiz", { p_token: saToken(), p_name: name, p_surname: surname || "" }).then(() => {
              if (profile && profile.name === name && profile.surname === surname) {
                setQuizDone({});
                try { localStorage.removeItem("sa_quiz_done"); } catch(e) {}
              }
              const msg = `Тесты для ${name} ${surname} разблокированы!`;
              if (window.Telegram?.WebApp?.showAlert) window.Telegram.WebApp.showAlert(msg); else alert(msg);
            }).catch(() => {});
          } : null}
          onViewPlayer={(p) => { setSelectedPlayer(p); navigate("playerDetail"); }}
        /></div>}
        {screen === "daily" && <DailyScreen T={T} profile={profile} completed={completed} quizDone={quizDone} role={role} modules={modules} onBack={() => navigate("roleSelect")} onReference={() => navigate("reference")} onLesson={(lesson, mod) => { setActiveLesson(lesson); setActiveModule(mod); navigate("lesson"); }} />}
        {screen === "roleSelect" && <div style={{paddingBottom:88}}><RoleSelect onSelect={selectRole} T={T} a11y={a11y} profile={profile} completedRoles={completedRoles} onLeaderboard={() => navigate("leaderboard")} onProfile={() => navigate("profile")} onStats={() => navigate("stats")} onDaily={() => navigate("daily")} onGlossary={() => navigate("glossary")} role={role} onChecklist={() => navigate("checklist")} onOnboarding={() => navigate("onboarding")} onAnalytics={() => navigate("analytics")} onReference={() => navigate("reference")} /></div>}
        {screen === "glossary" && <div style={{paddingBottom:88}}><GlossaryScreen T={T} a11y={a11y} onBack={() => navigate("roleSelect")} color="#C8A96E" /></div>}
        {screen === "leaderboard" && <div style={{paddingBottom:88}}><LeaderboardScreen T={T} leaderboard={leaderboard} scores={scores} profile={profile} practiceStars={practiceStars} onBack={() => navigate("roleSelect")} /></div>}
        {screen === "home" && <div style={{paddingBottom:88}}><HomeScreen role={ROLES.find(r=>r.id===role)} modules={MODULES[role]} completed={completed} quizDone={quizDone} progress={progress} doneCount={doneCount} totalLessons={totalLessons} onModule={openModule} onChangeRole={() => navigate("roleSelect")} T={T} streak={streak} a11y={a11y} profile={profile} onChecklist={() => navigate("checklist")} onOnboarding={() => navigate("onboarding")} onAnalytics={() => navigate("analytics")} /></div>}
        {screen === "module" && <div style={{paddingBottom:88}}><ModuleScreen mod={activeModule} completed={completed} quizDone={quizDone} onBack={() => navigate("home")} onLesson={openLesson} T={T} /></div>}
        {screen === "lesson" && <LessonScreen key={gameKey} lesson={activeLesson} color={activeModule?.color} onBack={() => navigate("module")} onComplete={completeLesson} quizState={quizState} onQuiz={handleQuiz} practiceState={practiceState} setPracticeState={setPracticeState} onPracticeChoice={handlePracticeChoice} onPracticeNext={handlePracticeNext} T={T} />}
        {screen === "roleComplete" && <RoleCompleteScreen role={ROLES.find(r=>r.id===role)} nextRole={ROLES.find(r=>r.id===ROLE_ORDER[ROLE_ORDER.indexOf(role)+1])} T={T} onNext={() => navigate("roleSelect")} />}
        {screen === "reference" && <ReferenceSection dark={!a11y} onExit={() => navigate("roleSelect")} />}

        {/* Нижняя навигация — только на основных экранах */}
        {["roleSelect","home","module","leaderboard","glossary","stats","daily","playerDetail","team"].includes(screen) && profile && (
          <div style={{
            position:"fixed", bottom:0, left:0, right:0, zIndex:200,
            background: a11y ? "rgba(242,234,216,0.9)" : "linear-gradient(160deg, rgba(58,42,16,0.84) 0%, rgba(42,30,10,0.86) 100%)",
            borderTop: a11y ? "1px solid rgba(160,120,60,0.3)" : "1px solid rgba(210,170,70,0.45)",
            display:"flex", alignItems:"stretch",
            paddingBottom:"max(env(safe-area-inset-bottom, 0px), 14px)",
            backdropFilter:"blur(20px) saturate(160%)",
            WebkitBackdropFilter:"blur(20px) saturate(160%)",
            boxShadow: a11y ? "0 -2px 16px rgba(0,0,0,0.12)" : "0 -4px 24px rgba(0,0,0,0.55), 0 -1px 0 rgba(210,170,70,0.20)",
          }}>
            {[
              { id:"roleSelect", icon:"home",        label:"Главная" },
              { id:"daily",      icon:"daily",       label:"Задания" },
              { id:"glossary",   icon:"glossary",    label:"Глоссарий" },
              { id:"leaderboard",icon:"leaderboard", label:"Рейтинг" },
              ...(profile?.is_admin ? [{ id:"team", icon:"team", label:"Команда" }] : []),
              { id:"stats",      icon:"stats",       label:"Профиль" },
            ].map(tab => {
              const active = screen === tab.id;
              const accentColor = a11y ? "#6B4E1A" : "#C8A96E";
              const inactiveColor = a11y ? "#5C3D10" : "#9A8060";
              return (
                <div key={tab.id} onClick={() => { if (!active) vibrate("light"); navigate(tab.id); }}
                  style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                    justifyContent:"center", padding:"6px 4px 6px", cursor:"pointer" }}>
                  {/* Золотая «таблетка» за активной иконкой */}
                  <div style={{
                    width:46, height:28, borderRadius:14, marginBottom:3,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background: active ? (a11y ? "rgba(107,78,26,0.14)" : "rgba(200,169,110,0.16)") : "transparent",
                    boxShadow: active && !a11y ? "0 0 0 1px rgba(200,169,110,0.22) inset" : "none",
                    transform: active ? "scale(1.08) translateY(-1px)" : "scale(1)",
                    transition:"background 0.3s ease, box-shadow 0.3s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                    opacity: active ? 1 : 0.6,
                  }}>
                    {NAV_ICONS[tab.icon](active ? accentColor : inactiveColor)}
                  </div>
                  <div style={{
                    fontSize:9.5,
                    fontFamily:"Georgia, serif",
                    letterSpacing:0.3,
                    color: active ? accentColor : inactiveColor,
                    fontWeight:"bold",
                    opacity: active ? 1 : 0.72,
                    transition:"color 0.3s ease, opacity 0.3s ease",
                  }}>
                    {tab.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── КОНФЕТТИ ──────────────────────────────────────────────────────────
function Confetti() {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: ["#C8A96E","#5DBB8A","#E07878","#8B7BAB","#7B8FAB","#F0E8D8","#D4A85A"][Math.floor(Math.random()*7)],
      rot: Math.random() * Math.PI * 2,
      vx: Math.random() * 2 - 1,
      vy: Math.random() * 3 + 2,
      vrot: (Math.random() - 0.5) * 0.15,
      opacity: 1,
    }));
    let frame;
    let tick = 0;
    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        if (tick > 120) p.opacity = Math.max(0, p.opacity - 0.008);
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
      });
      if (pieces.some(p => p.opacity > 0)) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={canvasRef} style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:999 }} />;
}

// ── ЭКРАН ЗАВЕРШЕНИЯ РОЛИ ────────────────────────────────────────────
function RoleCompleteScreen({ role, nextRole, T, onNext }) {
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
    core:     { icon:"⭐", title:"Ядро пройдено!", badge:"Опора команды", desc:"Ты стал частью постоянной команды. Твои стандарты — пример для новичков.", color:"#C8A96E" },
    manager:  { icon:"🎯", title:"Менеджер пройден!", badge:"Лидер зала", desc:"Управление командой, разрешение конфликтов, финансы — ты готов к большему.", color:"#8B7BAB" },
    service_manager: { icon:"🏛️", title:"Мастер сервиса!", badge:"Архитектор сервиса", desc:"Ты прошёл весь путь. Теперь ты строишь культуру сервиса для других.", color:"#7B8FAB" },
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
          <span style={{ color:"#D4A85A", fontSize:13, fontWeight:"bold", fontFamily:"Georgia, serif" }}>
            ✦ {ach.badge}
          </span>
        </div>
        <div style={{ color:"#F0E8D8", fontSize:26, fontWeight:"bold", fontFamily:"Georgia, serif", marginBottom:8, letterSpacing:0.3 }}>
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
            <div style={{ fontSize:11, letterSpacing:3, color:"#5DBB8A", fontFamily:"monospace", marginBottom:8 }}>✦ РАЗБЛОКИРОВАНО</div>
            <div style={{ marginBottom:6, display:"flex", justifyContent:"center" }}>{ROLE_SVG[nextRole.id] ? ROLE_SVG[nextRole.id](nextRole.color, 30) : nextRole.icon}</div>
            <div style={{ color:"#F0E8D8", fontSize:16, fontWeight:"bold", fontFamily:"Georgia, serif", marginBottom:4 }}>{nextRole.label}</div>
            <div style={{ color:"#8A7A6A", fontSize:12 }}>{nextRole.desc}</div>
          </div>
        </div>
      )}

      {isLast && phase >= 1 && (
        <div className="sa-pop" style={{ width:"100%", maxWidth:340, marginBottom:24 }}>
          <div style={{ background:"linear-gradient(135deg, rgba(212,168,90,0.15) 0%, rgba(0,0,0,0.2) 100%)", border:"1px solid rgba(212,168,90,0.4)", borderRadius:20, padding:"16px 20px", textAlign:"center" }}>
            <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}>{crownIcon("#D4A85A", 32)}</div>
            <div style={{ color:"#D4A85A", fontSize:15, fontWeight:"bold", fontFamily:"Georgia, serif", marginBottom:4 }}>Мастер сервиса</div>
            <div style={{ color:"#8A7A6A", fontSize:12, lineHeight:1.6 }}>Ты прошёл весь путь Service Academy. Теперь ты — архитектор сервиса.</div>
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        className="sa-btn sa-btn-pulse"
        style={{ width:"100%", maxWidth:340, padding:"16px", borderRadius:18, border:"1px solid rgba(200,160,80,0.4)", background:"linear-gradient(135deg, rgba(200,160,80,0.2) 0%, rgba(200,160,80,0.08) 100%)", color:"#F0E8D8", fontSize:16, fontWeight:"bold", cursor:"pointer", fontFamily:"Georgia, serif", letterSpacing:0.3 }}
      >
        {isLast ? "К списку ролей →" : `Перейти к «${nextRole?.label}» →`}
      </button>
    </div>
  );
}

function WeekStar({ weekly, T }) {
  const gold = "#C8A96E";
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

function LeaderboardScreen({ T, leaderboard, scores, profile, practiceStars = {}, onBack }) {
  const myPosition = profile?.position || "waiter";
  const isAdmin = !!profile?.is_admin;
  // Доступные вкладки по должности
  const allTabs = [
    { id:"waiter",  label:"Официанты", icon:"🍽️", color:"#7C9E87" },
    { id:"manager", label:"Менеджеры", icon:"🎯", color:"#8B7BAB" },
    { id:"senior",  label:"Руководство", icon:"🏛️", color:"#C8A96E" },
  ];
  const visibleTabs = (isAdmin || myPosition === "senior") ? allTabs : allTabs.filter(t => {
    if (myPosition === "waiter")  return t.id === "waiter";
    if (myPosition === "manager") return t.id === "waiter" || t.id === "manager";
    return true;
  });

  const [tab, setTab] = React.useState(visibleTabs[0]?.id || "waiter");
  const [detailTab, setDetailTab] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const roleLabel = { seasonal:"Новичок", core:"Ядро", manager:"Менеджер", service_manager:"Сервис-менеджер" };
  const roleColor = { seasonal:"#7C9E87", core:"#C8A96E", manager:"#8B7BAB", service_manager:"#7B8FAB" };
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
        <div style={T.lessHeadTitle}>📊 Рейтинг сотрудников</div>
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
            <div key={i} onClick={() => { setSelected(p); setDetailTab(true); }}
              style={{ ...T.modCard, marginBottom:10, cursor:"pointer", gap:12 }}>
              <div style={{ flexShrink:0, minWidth:28, display:"flex", alignItems:"center", justifyContent:"center" }}>{(() => { const med = [["#F0CE72","rgba(232,196,106,0.20)"],["#D2D7DE","rgba(200,205,212,0.16)"],["#D6A06A","rgba(214,160,106,0.18)"]][i]; const fg = med ? med[0] : (T.modTitle?.color||"#C8A96E"); const bg = med ? med[1] : (T.modSub?.color||"#9A8C74")+"22"; const bd = med ? med[0]+"99" : (T.modTitle?.color||"#C8A96E")+"44"; return <div style={{ width:27, height:27, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background:bg, border:`1.5px solid ${bd}`, color:fg, fontSize:13, fontWeight:"bold" }}>{i+1}</div>; })()}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2, flexWrap:"wrap" }}>
                  <div style={{ ...T.modTitle }}>{p.name} {p.surname}</div>
                  {ach.map((a, ai) => <span key={ai} title={a.label} style={{ fontSize:15 }}>{a.icon}</span>)}
                </div>
                <div style={{ color:T.modSub.color, fontSize:12, marginBottom:6 }}>{p.restaurant}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ flex:1, height:4, background:T.progBar.background, borderRadius:2, overflow:"hidden" }}>
                    <div style={{ width:`${p.avg}%`, height:"100%", background:roleColor[p.role]||"#C8A96E", borderRadius:2 }} />
                  </div>
                  <div style={{ color:roleColor[p.role]||"#C8A96E", fontSize:13, fontWeight:"bold", flexShrink:0 }}>{p.avg}%</div>
                </div>
              </div>
              <div style={{ color:T.modSub.color, fontSize:11, textAlign:"right", flexShrink:0 }}>
                {p.position !== "senior" && <div style={{ color:roleColor[p.role]||"#C8A96E", marginBottom:2 }}>{roleLabel[p.role]||p.role}</div>}
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
              <div style={{ width:44, height:44, borderRadius:"50%", background:`${roleColor[selected?.role]||"#C8A96E"}22`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18, fontWeight:"bold", color:roleColor[selected?.role]||"#C8A96E", fontFamily:"Georgia, serif" }}>
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
                    <span style={{ color:"#C8A96E", fontSize:11, fontFamily:"Georgia, serif" }}>{a.label}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:20, marginTop:4 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#C8A96E", fontSize:22, fontWeight:"bold" }}>{selected?.avg}%</div>
                <div style={{ color:T.modSub.color, fontSize:11 }}>средний балл</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ color:"#C8A96E", fontSize:22, fontWeight:"bold" }}>{selected?.total}</div>
                <div style={{ color:T.modSub.color, fontSize: T.modSub?.fontSize || 13 }}>тестов</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ color:roleColor[selected?.role]||"#C8A96E", fontSize:14, fontWeight:"bold", marginTop:4 }}>{selected?.position !== "senior" ? (roleLabel[selected?.role]||"") : ""}</div>
                <div style={{ color:T.modSub.color, fontSize:11 }}>{selected?.position !== "senior" ? "роль" : ""}</div>
              </div>
            </div>
          </div>); })()}
          {detail.map((d, i) => (
            <div key={i} style={{ ...T.lessCard, marginBottom:8, flexDirection:"column", alignItems:"flex-start", gap:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", width:"100%" }}>
                <div style={{ ...T.lessTitle, fontSize:13, flex:1, marginRight:8 }}>{d.quizTitle}</div>
                <div style={{ color: d.pct>=80?"#81C784":d.pct>=50?"#C8A96E":"#e57373", fontWeight:"bold", flexShrink:0 }}>{d.pct}%</div>
              </div>
              <div style={{ color:T.modSub.color, fontSize:12 }}>{d.score} из {d.total} верно · {d.date}</div>
              <div style={{ width:"100%", height:3, background:T.progBar.background, borderRadius:2, overflow:"hidden" }}>
                <div style={{ width:`${d.pct}%`, height:"100%", background: d.pct>=80?"#81C784":d.pct>=50?"#C8A96E":"#e57373" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Ежедневные задания ─────────────────────────────────────
function DailyScreen({ T, profile, completed, quizDone, role, modules, onBack, onLesson, onReference }) {
  const today = new Date().toLocaleDateString("ru-RU");
  const seed = today.split(".").reduce((a, v) => a + parseInt(v), 0);

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
          <div style={{ color:"#C8A96E", fontSize:12, letterSpacing:2, fontFamily:"monospace" }}>{today}</div>
          <div style={{ color:T.modSub.color, fontSize:12, marginTop:4 }}>3 задания обновляются каждый день</div>
        </div>

        {onReference && (
          <div onClick={onReference} style={{ position:"relative", display:"flex", alignItems:"center", gap:13, background:"rgba(200,169,110,0.08)", border:"1px solid rgba(200,169,110,0.45)", borderRadius:18, padding:"14px 15px", marginBottom:16, cursor:"pointer", overflow:"hidden", boxShadow:"0 0 0 3px rgba(200,169,110,0.10)" }}>
            <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:"#C8A96E" }} />
            <div style={{ width:46, height:46, borderRadius:13, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(200,169,110,0.14)" }}>
              <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#C8A96E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h6v17H6a2 2 0 0 0-2 2z"/><path d="M20 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
                <span style={{ color:"#C8A96E", fontSize:10, letterSpacing:2, fontFamily:"monospace" }}>РАЗДЕЛ</span>
                <span style={{ fontSize:9, fontWeight:"bold", letterSpacing:1, color:"#C8A96E", background:"rgba(200,169,110,0.14)", border:"1px solid rgba(200,169,110,0.45)", borderRadius:6, padding:"1px 5px" }}>НОВОЕ</span>
              </div>
              <div style={{ ...T.modTitle, fontSize:16 }}>Справочник</div>
              <div style={{ color:T.modSub.color, fontSize:12, marginTop:2 }}>Сервировка: посуда, приборы, бокалы</div>
            </div>
            <div style={{ color:"#C8A96E", fontSize:18 }}>›</div>
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
            <div key={i} onClick={() => !isDone && onLesson(task, task.mod)}
              style={{ ...T.modCard, marginBottom:12, gap:12, opacity: isDone ? 0.6 : 1,
                cursor: isDone ? "default" : "pointer",
                border: isDone ? "1px solid rgba(93,187,138,0.3)" : "1px solid rgba(200,160,80,0.15)" }}>
              <div style={{ flexShrink:0, display:"flex", alignItems:"center" }}>{isDone ? UI_SVG.checkCircle("#5DBB8A", 26) : UI_SVG[taskTypeIcon[task.type]]("#C8A96E", 26)}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  <div style={{ color:"rgba(200,160,80,0.6)", fontSize:10, letterSpacing:2, fontFamily:"monospace" }}>ЗАДАНИЕ {i+1} · {taskTypeLabel[task.type]}</div>
                </div>
                <div style={{ ...T.modTitle, fontSize:15 }}>{task.title}</div>
                <div style={{ color:T.modSub.color, fontSize:12, marginTop:2 }}>{task.mod?.title}</div>
              </div>
              {!isDone && <div style={{ color:"#C8A96E", fontSize:18, flexShrink:0 }}>›</div>}
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

// ── Личная статистика ──────────────────────────────────────

// ── Детальная статистика сотрудника ───────────────────────
function PlayerDetailScreen({ player, T, onBack }) {
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

  const roleNames = { seasonal: "Новичок", core: "Ядро", manager: "Менеджер", service_manager: "Сервис-менеджер" };
  const roleColors = { seasonal: "#7C9E87", core: "#C8A96E", manager: "#8B7BAB", service_manager: "#5B8FA8" };

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
          <div style={{ textAlign:"center", color: T.modSub?.color || "#7A6548", padding:"40px 0" }}>Загрузка...</div>
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
                  <div style={{ display:"flex", alignItems:"center", height:24 }}>{UI_SVG[s.icon] ? UI_SVG[s.icon]("#C8A96E", 22) : s.icon}</div>
                  <div style={{ color: T.modTitle?.color || "#F0E8D8", fontSize:20, fontWeight:"bold" }}>{s.value}</div>
                  <div style={{ color: T.modSub?.color || "#7A6548", fontSize:11, textAlign:"center" }}>{s.label}</div>
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
              const color = roleColors[roleId] || "#C8A96E";
              return (
                <div key={roleId} style={{ ...T.modCard, flexDirection:"column", gap:8, marginBottom:8, padding:"12px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ color: T.modTitle?.color || "#F0E8D8", fontSize:14, fontWeight:"bold" }}>{roleName}</div>
                    <div style={{ color, fontSize:14, fontWeight:"bold" }}>{pct}%</div>
                  </div>
                  <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3 }}>
                    <div style={{ height:6, width:`${pct}%`, background:color, borderRadius:3, transition:"width 0.5s ease" }} />
                  </div>
                  <div style={{ color: T.modSub?.color || "#7A6548", fontSize:12 }}>{count} из {total} уроков</div>
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
                        <div style={{ color: T.modTitle?.color || "#F0E8D8", fontSize:13, fontWeight:"bold", flex:1 }}>{s.role ? roleNames[s.role] || s.role : ""}</div>
                        <div style={{ color: pct === 100 ? "#5DBB8A" : pct >= 70 ? "#C8A96E" : "#E07878", fontSize:14, fontWeight:"bold" }}>{pct}%</div>
                      </div>
                      <div style={{ color: T.modSub?.color || "#7A6548", fontSize:11 }}>{s.score} из {s.total} верно · {new Date(s.updated_at).toLocaleDateString("ru-RU")}</div>
                      <div style={{ height:3, background:"rgba(255,255,255,0.08)", borderRadius:2, marginTop:2 }}>
                        <div style={{ height:3, width:`${pct}%`, background: pct === 100 ? "#5DBB8A" : pct >= 70 ? "#C8A96E" : "#E07878", borderRadius:2 }} />
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {uniqueLessonCount === 0 && uniqueScores.length === 0 && (
              <div style={{ textAlign:"center", color: T.modSub?.color || "#7A6548", padding:"30px 0", fontSize:14 }}>
                📭 Пока нет данных
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PlayerResetCard({ p, T, onResetPlayer, onUnlockQuiz, onViewPlayer }) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  return (
    <div style={{ ...T.modCard, marginBottom:8, gap:12, flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ ...T.modTitle, fontSize:13 }}>{p.name} {p.surname}</div>
          <div style={{ color:T.modSub.color, fontSize:11 }}>{p.restaurant}</div>
        </div>
        <div onClick={() => onViewPlayer && onViewPlayer(p)}
          style={{ padding:"6px 12px", borderRadius:10, cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif",
            background:"rgba(200,169,110,0.12)", border:"1px solid rgba(200,169,110,0.3)", color:"#C8A96E" }}>
          📊
        </div>
        <div onClick={() => setShowConfirm(s => !s)}
          style={{ padding:"6px 12px", borderRadius:10, cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif",
            background:"rgba(220,80,80,0.12)", border:"1px solid rgba(220,80,80,0.3)", color:"#e57373" }}>
          🗑 Сбросить
        </div>
      </div>
      {showConfirm && (
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ color:"#e57373", fontSize:12, flex:1 }}>Удалить все результаты?</div>
          <div onClick={() => { onResetPlayer(p.name, p.surname); setShowConfirm(false); }}
            style={{ padding:"6px 14px", borderRadius:10, cursor:"pointer", fontSize:12,
              background:"rgba(220,80,80,0.25)", border:"1px solid rgba(220,80,80,0.5)", color:"#e57373", fontWeight:"bold" }}>
            Да
          </div>
          <div onClick={() => setShowConfirm(false)}
            style={{ padding:"6px 14px", borderRadius:10, cursor:"pointer", fontSize:12,
              background:T.modCard.background, border:"1px solid rgba(255,255,255,0.08)", color:T.modSub.color }}>
            Нет
          </div>
        </div>
      )}
      {onUnlockQuiz && (
        <div onClick={() => onUnlockQuiz(p.name, p.surname)}
          style={{ padding:"6px 12px", borderRadius:10, cursor:"pointer", fontSize:12, fontFamily:"Georgia, serif",
            background:"rgba(80,160,80,0.12)", border:"1px solid rgba(80,160,80,0.3)", color:"#81C784", alignSelf:"flex-start" }}>
          🔓 Разблокировать тесты
        </div>
      )}
    </div>
  );
}

function StatsScreen({ T, profile, scores, completedRoles, completed, quizDone = {}, practiceStars, allProfiles = [], onBack, onResetPlayer, onUnlockQuiz, onViewPlayer }) {
  const ROLE_ORDER = ["seasonal", "core", "manager", "service_manager"];
  const roleLabel = { seasonal:"Новичок", core:"Ядро", manager:"Менеджер", service_manager:"Сервис-менеджер" };
  const roleColor = { seasonal:"#7C9E87", core:"#C8A96E", manager:"#8B7BAB", service_manager:"#7B8FAB" };
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
          <div style={{ width:48, height:48, borderRadius:"50%", background:"rgba(200,160,80,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:"bold", color:"#C8A96E", fontFamily:"Georgia, serif", flexShrink:0 }}>
            {profile?.is_admin ? UI_SVG.crown("#C8A96E", 24) : `${profile?.name?.[0]}${(profile?.surname||"")[0]||""}`.toUpperCase()}
          </div>
          <div>
            <div style={{ ...T.modTitle }}>{`${profile?.name || ""} ${profile?.surname || ""}`}</div>
            <div style={{ color:T.modSub.color, fontSize:12 }}>{profile?.restaurant}</div>
          </div>
        </div>

        {/* Ключевые цифры */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
          {[
            { label:"Средний балл", value:`${avgScore}%`, icon:"target", color:"#C8A96E" },
            { label:"Тестов пройдено", value:totalTests, icon:"quiz", color:"#7C9E87" },
            { label:"На 100%", value:perfect, icon:"diamond", color:"#8B7BAB" },
            { label:"Звёзды практики", value:`⭐ ${myStars}`, icon:"trophy", color:"#E8A020" },
            { label:"Уроков пройдено", value:completedLessons, icon:"book", color:"#7B8FAB" },
            { label:"Ролей завершено", value:`${rolesCompleted}/4`, icon:"gradcap", color:"#C8A96E" },
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
                  <div style={{ color: s.pct>=80?"#81C784":s.pct>=50?"#C8A96E":"#e57373", fontWeight:"bold" }}>{s.pct}%</div>
                </div>
                <div style={{ color:T.modSub.color, fontSize:11 }}>{roleLabel[s.role]} · {s.date}</div>
                <div style={{ height:3, background:T.progBar.background, borderRadius:2, overflow:"hidden" }}>
                  <div style={{ width:`${s.pct}%`, height:"100%", background: s.pct>=80?"#81C784":s.pct>=50?"#C8A96E":"#e57373" }} />
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

// ── Страница регистрации ───────────────────────────────────
// Статичные объекты стилей вне компонента — не пересоздаются при каждом рендере
const PS = {
  fieldBase: { width:"100%", padding:"14px 16px", borderRadius:14, color:"#EEE4CC", fontSize:15, fontFamily:"Georgia, serif", outline:"none", boxSizing:"border-box", transition:"all 0.25s ease" },
  fieldNormal: { border:"1px solid rgba(180,138,55,0.45)", borderTop:"1px solid rgba(210,165,65,0.38)", background:"linear-gradient(155deg, rgba(55,40,16,0.65) 0%, rgba(38,26,10,0.55) 100%)", boxShadow:"0 4px 14px rgba(0,0,0,0.3), 0 1px 0 rgba(200,160,60,0.14) inset" },
  fieldFocus:  { border:"1px solid rgba(200,160,80,0.6)", borderTop:"1px solid rgba(220,175,75,0.7)", background:"linear-gradient(155deg, rgba(58,42,16,0.7) 0%, rgba(40,28,8,0.6) 100%)", boxShadow:"0 0 0 3px rgba(200,160,80,0.1), 0 4px 14px rgba(0,0,0,0.3), 0 1px 0 rgba(200,160,60,0.15) inset" },
  lblEmpty:  { color:"#8A7055",             fontSize:10, letterSpacing:2.5, fontFamily:"monospace", textTransform:"uppercase", marginBottom:7, display:"block" },
  lblFilled: { color:"rgba(220,175,80,1.0)", fontSize:10, letterSpacing:2.5, fontFamily:"monospace", textTransform:"uppercase", marginBottom:7, display:"block" },
};

function ProfileScreen({ onDone, T }) {
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

          <div style={{ color:"#F0E8D8", fontSize:24, fontWeight:"bold", marginBottom:8, letterSpacing:0.3 }}>
            Добро пожаловать
          </div>
          <div style={{ color:"#756A58", fontSize:13, lineHeight:1.7 }}>
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
                }}
                style={{ ...PS.fieldBase, ...(position ? PS.fieldFocus : PS.fieldNormal),
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  cursor:"pointer", userSelect:"none" }}>
                <span style={{ color: position ? "#F0E8D8" : "#9A8060", fontSize:15 }}>
                  {position ? <span style={{ display:"inline-flex", alignItems:"center", gap:7 }}>{POS_SVG[position] && POS_SVG[position]("#C8A96E", 16)}{({waiter:"Официант", manager:"Менеджер", senior:"Руководящий состав"})[position]}</span> : "Выбери должность"}
                </span>
                <span style={{ color:"#C8A870", fontSize:14, transition:"transform 0.2s", display:"inline-block", transform: showPositionSheet ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
              </div>
              {showPositionSheet && (
                <div className="sa-fast" style={{ marginTop:8, display:"flex", flexDirection:"column", gap:6 }}>
                  {[
                    { id:"waiter",  icon:"🍽️", label:"Официант",           sub:"Обслуживание гостей" },
                    { id:"manager", icon:"🎯", label:"Менеджер",            sub:"Управление залом и командой" },
                    { id:"senior",  icon:"🏛️", label:"Руководящий состав", sub:"Управляющий, Директор" },
                  ].map(pos => (
                    <div key={pos.id} onClick={() => { setPosition(pos.id); setShowPositionSheet(false); }}
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 14px", borderRadius:13, cursor:"pointer",
                        background: position === pos.id ? "linear-gradient(155deg, rgba(58,42,16,0.8), rgba(40,28,8,0.7))" : "linear-gradient(155deg, rgba(40,28,10,0.5), rgba(28,18,6,0.4))",
                        border: position === pos.id ? "1px solid rgba(200,160,80,0.45)" : "1px solid rgba(150,112,42,0.20)",
                        borderTop: position === pos.id ? "1px solid rgba(220,175,75,0.55)" : "1px solid rgba(180,140,50,0.15)",
                        boxShadow: position === pos.id ? "0 4px 14px rgba(0,0,0,0.35), 0 1px 0 rgba(200,160,60,0.15) inset" : "0 2px 8px rgba(0,0,0,0.25)" }}>
                      <div style={{ display:"flex", alignItems:"center" }}>{POS_SVG[pos.id] ? POS_SVG[pos.id](position === pos.id ? "#C8A96E" : "#9A8060", 22) : pos.icon}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ color: position === pos.id ? "#F0E8D8" : "#A89880", fontSize:14, fontWeight:"bold", fontFamily:"Georgia, serif" }}>{pos.label}</div>
                        <div style={{ color:"#756A58", fontSize:11, marginTop:1 }}>{pos.sub}</div>
                      </div>
                      {position === pos.id && <div style={{ color:"#C8A96E", fontSize:16 }}>✓</div>}
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
              color: done ? "#5DBB8A" : isValid ? "#F0E8D8" : "#3C3428",
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



// ── Команда: админка управления сотрудниками ─────────────────
const APP_SHARE_URL = "https://service-academy-16te.vercel.app";
const POS_LABELS = { waiter:"Официант", manager:"Менеджер", senior:"Руководящий состав" };

function TeamScreen({ T, profile, a11y }) {
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
    if (e.status === "disabled") return { color:"#E07878", label:"Отключён" };
    if (e.has_pending_code && !e.has_session) return { color:"#D9C75B", label:"Ждёт код" };
    if (!e.last_seen_at || (Date.now() - new Date(e.last_seen_at).getTime()) > 7*86400000)
      return { color:"#9A8C74", label:"Неактивен" };
    return { color:"#5DBB8A", label:"Активен" };
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
    color: a11y ? "#3A2E1C" : "#F0E8D8",
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
    color: a11y ? "#8B6A30" : "#C8A96E", fontSize:14, fontFamily:"Georgia, serif"
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
          <div style={{ marginBottom:14 }}>{UI_SVG.checkCircle("#5DBB8A", 40)}</div>
          <div style={{ color:T.modTitle.color, fontSize:18, fontWeight:"bold", fontFamily:"Georgia, serif", textAlign:"center" }}>
            {issued.emp.name} {issued.emp.surname}
          </div>
          <div style={{ color:T.modSub.color, fontSize:12.5, marginTop:4, marginBottom:24 }}>{issued.emp.restaurant}</div>

          <div style={{ color:"#9A8C74", fontSize:10.5, letterSpacing:2, fontFamily:"monospace", marginBottom:10 }}>КОД ДОСТУПА</div>
          <div onClick={() => copyCode(issued.code)} style={{
            fontSize:34, fontWeight:"bold", fontFamily:"Georgia, serif", letterSpacing:5, color: a11y ? "#4A3A20" : "#F0E8D8",
            padding:"18px 28px", borderRadius:18, cursor:"pointer",
            background:"rgba(200,169,110,0.12)", border:"1.5px solid rgba(200,160,80,0.5)",
            boxShadow:"0 6px 24px rgba(200,160,80,0.18)" }}>
            {issued.code}
          </div>
          <div style={{ color: copied ? "#5DBB8A" : "#756A58", fontSize:11.5, marginTop:10, transition:"color 0.3s" }}>
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
                onClick={() => { vibrate("light"); setForm({ ...form, restaurant:r }); }}>{r}</div>
            ))}
          </div>

          <div style={{ color:"#9A8C74", fontSize:10.5, letterSpacing:2, fontFamily:"monospace", margin:"20px 0 10px" }}>ДОЛЖНОСТЬ</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {Object.entries(POS_LABELS).map(([id, label]) => (
              <div key={id} className={"sa-btn" + (form.position === id ? " sa-chip-on" : "")}
                style={chip(form.position === id)}
                onClick={() => { vibrate("light"); setForm({ ...form, position:id }); }}>{label}</div>
            ))}
          </div>

          {actionError && <div className="sa-fast" style={{ color:"#E07878", fontSize:13, marginTop:16 }}>{actionError}</div>}

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
                {isSelf && <span style={{ marginLeft:8, fontSize:9, letterSpacing:1.5, color:"#C8A96E", border:"1px solid rgba(200,169,110,0.45)", borderRadius:8, padding:"2px 7px", verticalAlign:"2px", fontFamily:"monospace" }}>ЭТО ТЫ</span>}
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

          {actionError && <div className="sa-fast" style={{ color:"#E07878", fontSize:13, marginBottom:14 }}>{actionError}</div>}

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
                    background: selected.status === "disabled" ? "#5DBB8A" : "#E07878", color:"#fff" }}>
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
                  style={{ flex:1, padding:"13px", borderRadius:14, border:"none", fontSize:14, fontFamily:"Georgia, serif", fontWeight:"bold", cursor:"pointer", background:"#E07878", color:"#fff" }}>
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
                  color: selected.status === "disabled" ? "#5DBB8A" : "#E07878" }}>
                {selected.status === "disabled" ? "Включить доступ" : "Отключить доступ"}
              </button>
              <button className="sa-btn" onClick={() => setConfirm("delete")}
                style={{ ...ghostBtn, border:"1px solid rgba(224,120,120,0.55)", color:"#E07878", marginTop:2 }}>
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
            {NAV_ICONS.team("#C8A96E")}<span>Команда</span>
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
              { n: summary.act,   label:"активных", c:"#5DBB8A" },
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
            <div style={{ color:"#E07878", fontSize:13, marginBottom:12 }}>Не получилось загрузить список.</div>
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
                  <div key={e.id} className="sa-btn" onClick={() => { vibrate("light"); setSelected(e); setConfirm(null); setActionError(null); setView("card"); }}
                    style={{ ...T.modCard, gap:12, cursor:"pointer", padding:"13px 14px" }}>
                    <span style={{ width:9, height:9, borderRadius:5, flexShrink:0, background:st.color, boxShadow:`0 0 8px ${st.color}55` }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:T.modTitle.color, fontSize:14.5, fontWeight:"bold", fontFamily:"Georgia, serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {e.name} {e.surname}
                        {e.is_admin && <span style={{ marginLeft:6, fontSize:8, letterSpacing:1, color:"#C8A96E", border:"1px solid rgba(200,169,110,0.4)", borderRadius:6, padding:"1px 5px", verticalAlign:"2px", fontFamily:"monospace" }}>АДМИН</span>}
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

// ── Вход по коду-приглашению ─────────────────────────────────
function CodeLoginScreen({ T, onSuccess }) {
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
      <div style={{ color:"#F0E8D8", fontSize:21, fontWeight:"bold", fontFamily:"Georgia, serif", marginBottom:8, textAlign:"center" }}>
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
          background:"rgba(20,14,6,0.6)", color:"#F0E8D8", outline:"none",
          border: error ? "1.5px solid #E07878" : "1.5px solid rgba(200,160,80,0.45)",
          boxShadow:"0 4px 18px rgba(0,0,0,0.35) inset" }}
      />
      {error && (
        <div className="sa-fast" style={{ color:"#E07878", fontSize:13, lineHeight:1.6, textAlign:"center", maxWidth:300, marginTop:12 }}>
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
      <div style={{ color:"#756A58", fontSize:11, marginTop:22, textAlign:"center", lineHeight:1.7 }}>
        Нет кода? Спроси у администратора —<br/>он создаст тебя в системе за минуту.
      </div>
    </div>
  );
}

// ── Аккаунт: кто я + выход ───────────────────────────────────
function AccountScreen({ profile, T, onBack, onLogout }) {
  const [confirmOut, setConfirmOut] = React.useState(false);
  const posLabel = { waiter:"Официант", manager:"Менеджер", senior:"Руководящий состав" }[profile?.position] || profile?.position;
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
              {profile?.is_admin && <span style={{ marginLeft:8, fontSize:9, letterSpacing:1.5, color:"#C8A96E", border:"1px solid rgba(200,169,110,0.45)", borderRadius:8, padding:"2px 7px", verticalAlign:"2px", fontFamily:"monospace" }}>АДМИН</span>}
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
            style={{ width:"100%", padding:"14px", borderRadius:14, border:"1px solid rgba(224,120,120,0.45)", background:"rgba(224,120,120,0.10)", color:"#E07878", fontSize:15, fontFamily:"Georgia, serif", cursor:"pointer" }}>
            Выйти с этого устройства
          </button>
        ) : (
          <div className="sa-fast">
            <div style={{ color:T.para.color, fontSize:13, lineHeight:1.7, textAlign:"center", marginBottom:12 }}>
              Для повторного входа понадобится код доступа. Точно выйти?
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="sa-btn" onClick={() => setConfirmOut(false)}
                style={{ flex:1, padding:"13px", borderRadius:14, border:"1px solid rgba(200,160,80,0.4)", background:"transparent", color:"#C8A96E", fontSize:14, fontFamily:"Georgia, serif", cursor:"pointer" }}>
                Остаться
              </button>
              <button className="sa-btn" onClick={onLogout}
                style={{ flex:1, padding:"13px", borderRadius:14, border:"none", background:"#E07878", color:"#fff", fontSize:14, fontFamily:"Georgia, serif", fontWeight:"bold", cursor:"pointer" }}>
                Выйти
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleSelect({ onSelect, T, a11y, onLeaderboard, onProfile, onStats, onDaily, onGlossary, role, profile, completedRoles = new Set(), onChecklist, onOnboarding, onAnalytics, onReference }) {
  const isAdmin = !!profile?.is_admin;
  const initials = profile ? `${profile.name[0]}${(profile.surname||"")[0]||""}`.toUpperCase() : "?";
  const ROLE_ORDER = ["seasonal", "core", "manager", "service_manager"];
  const position = profile?.position || "waiter";

  // Роли доступные сразу по должности (без прохождения)
  const baseUnlocked = new Set(["seasonal"]);
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
        {profile && (
          <div style={{ margin:"0 14px 14px", padding:"12px 16px", borderRadius:16, background: T.modCard.background, border:"1px solid rgba(160,120,60,0.12)", boxShadow: T.modCard.boxShadow, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 2px 10px rgba(200,160,80,0.3)" }}>
              <span style={{ color:"#fff", fontSize:16, fontWeight:"bold", fontFamily:"Georgia, serif", display:"inline-flex", alignItems:"center" }}>{isAdmin ? UI_SVG.crown("#fff", 22) : initials}</span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color: T.modTitle.color, fontSize:15, fontWeight:"bold", fontFamily:"Georgia, serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {`${profile.name} ${profile.surname}`}{isAdmin && <span style={{ marginLeft:8, fontSize:9, letterSpacing:1.5, color:"#C8A96E", border:"1px solid rgba(200,169,110,0.45)", borderRadius:8, padding:"2px 7px", verticalAlign:"2px", fontFamily:"monospace" }}>АДМИН</span>}
              </div>
              <div style={{ color:"#C8A870", fontSize:12, marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                <span style={{ display:"inline-flex", verticalAlign:"-2px", marginRight:5 }}>{UI_SVG.building("#C8A870", 12)}</span>{profile.restaurant}{profile.position ? ` · ${{waiter:"Официант", manager:"Менеджер", senior:"Руководящий состав"}[profile.position] || ""}` : ""}
              </div>
            </div>
            <div style={{ display:"flex", gap:4, flexShrink:0 }}>
              {onProfile && (
                <div onClick={onProfile} style={{ display:"flex", alignItems:"center", cursor:"pointer", padding:"4px 6px" }}>{UI_SVG.pencil(T.modSub.color, 17)}</div>
              )}
            </div>
          </div>
        )}
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
          if (!tiles.length) return null;
          return (
            <div style={{ display:"flex", gap:10, padding:"0 14px 14px" }}>
              {tiles.map(t => (
                <div key={t.key} onClick={t.onClick} style={{ flex:1, background:Cc.cardBg, border:`1px solid ${Cc.border}`, borderTop:`1px solid ${Cc.top}`, boxShadow:Cc.shadow, borderRadius:16, padding:"12px 6px 10px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, cursor:"pointer", WebkitTapHighlightColor:"transparent", backdropFilter:a11y?"blur(18px) saturate(128%)":"none", WebkitBackdropFilter:a11y?"blur(18px) saturate(128%)":"none" }}>
                  <div style={{ width:38, height:38, borderRadius:11, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:a11y?"rgba(200,150,50,0.14)":"rgba(200,169,110,0.13)" }}>{t.icon}</div>
                  <div style={{ fontSize:11, color:Cc.text, fontWeight:"bold", textAlign:"center", lineHeight:1.1 }}>{t.label}</div>
                </div>
              ))}
            </div>
          );
        })()}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0 20px 10px" }}>
          <div style={{ flex:1, height:"1px", background:"linear-gradient(to right, transparent, #D4A85A55, transparent)" }} />
          <span style={{ color:"#D4A85A", fontSize:14 }}>✦</span>
          <div style={{ flex:1, height:"1px", background:"linear-gradient(to left, transparent, #D4A85A55, transparent)" }} />
        </div>



        <div style={{ padding:"0 14px 8px", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ ...T.roleSubtitle }}>Выбери свою роль</div>
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
              onClick={() => isUnlocked && onSelect(r.id)}
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

function crownIcon(color, size=22){
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 16L3.4 7.8l4.8 3.4L12 5.5l3.8 5.7 4.8-3.4L19 16z"/><path d="M5 19h14"/></svg>);
}
function flameIcon(color, size=24){
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2c0 3-2 4-2 7 0 1 .6 1.7 1.5 1.7S14 9.8 14 9c1 1.2 2 2.7 2 4.5a5 5 0 0 1-10 0C6 9 10 6 13 2z"/></svg>);
}
function trophyIcon(color, size=18){
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H5a2 2 0 0 0 2 4"/><path d="M17 6h2a2 2 0 0 1-2 4"/><path d="M12 14v3"/><path d="M9.5 20h5l-.6-3h-3.8z"/></svg>);
}
function faceIcon(level, color, size=28){
  const m={1:"M8.5 16.2 Q12 13.4 15.5 16.2",2:"M8.7 15.5 Q12 14.2 15.3 15.5",3:"M9 15 H15",4:"M8.7 14.6 Q12 16.4 15.3 14.6",5:"M8 14 Q12 17.8 16 14"};
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="0.7" fill={color} stroke="none"/><circle cx="15" cy="10" r="0.7" fill={color} stroke="none"/><path d={m[level]||m[3]}/></svg>);
}
function StreakCard({ streak, a11y }) {
  const C = a11y
    ? { gold:"#8B6A30", num:"#9A6B1E", text:"#2A1F0E", muted:"#7A6548", dim:"#9A8060",
        cardBg:"rgba(235,222,195,0.70)", border:"rgba(175,140,65,0.18)", top:"rgba(255,240,200,0.62)", shadow:"0 3px 12px rgba(120,90,30,0.10), 0 1px 0 rgba(255,248,230,0.68) inset",
        glow:"radial-gradient(circle, rgba(200,150,50,0.16) 0%, transparent 70%)",
        flameGlow:"radial-gradient(circle at 40% 35%, rgba(216,160,60,0.22), rgba(180,130,40,0.05) 70%)",
        done:"radial-gradient(circle at 35% 30%, #E8C173, #C2912F 72%)", check:"#3a2c10",
        miss:"rgba(140,105,40,0.28)", future:"rgba(140,105,40,0.2)", div:"rgba(140,105,40,0.25)" }
    : { gold:"#C8A96E", num:"#EBCF8E", text:"#E9DEC9", muted:"#9A8C74", dim:"#6E6354",
        cardBg:"linear-gradient(150deg,#332510 0%,#231908 100%)", border:"rgba(140,106,38,0.34)", top:"rgba(208,166,62,0.42)", shadow:"0 5px 18px rgba(0,0,0,0.48), 0 2px 0 rgba(190,152,56,0.15) inset, 0 -2px 3px rgba(0,0,0,0.32) inset",
        glow:"radial-gradient(circle, rgba(200,169,110,0.16) 0%, transparent 70%)",
        flameGlow:"radial-gradient(circle at 40% 35%, rgba(235,207,142,0.28), rgba(200,169,110,0.06) 70%)",
        done:"radial-gradient(circle at 35% 30%, #EBCF8E, #C8A96E 70%)", check:"#3a2c10",
        miss:"rgba(160,120,60,0.18)", future:"rgba(160,120,60,0.16)", div:"rgba(160,120,60,0.2)" };
  const serif = "Georgia, 'Times New Roman', serif";
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

function moodPalette(a11y) {
  return a11y
    ? { cardBg:"rgba(235,222,195,0.70)", border:"rgba(175,140,65,0.18)", top:"rgba(255,240,200,0.62)", shadow:"0 3px 12px rgba(120,90,30,0.10), 0 1px 0 rgba(255,248,230,0.68) inset", text:"#2A1F0E", muted:"#7A6548", dim:"#9A8060", gold:"#8B6A30", green:"#2A6B45", barTop:"#C8A96E", barBot:"#8B6A30" }
    : { cardBg:"linear-gradient(150deg,#332510 0%,#231908 100%)", border:"rgba(140,106,38,0.34)", top:"rgba(208,166,62,0.42)", shadow:"0 5px 18px rgba(0,0,0,0.48), 0 2px 0 rgba(190,152,56,0.15) inset, 0 -2px 3px rgba(0,0,0,0.32) inset", text:"#E9DEC9", muted:"#9A8C74", dim:"#6E6354", gold:"#C8A96E", green:"#5DBB8A", barTop:"#E8C87A", barBot:"#C8A96E" };
}
const MOOD_FACES = [{lvl:1,l:"Тяжело"},{lvl:2,l:"Так себе"},{lvl:3,l:"Норм"},{lvl:4,l:"Хорошо"},{lvl:5,l:"Отлично"}];
const _moodYmd = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
const _moodBase = (C, a11y) => ({ background:C.cardBg, border:`1px solid ${C.border}`, borderTop:`1px solid ${C.top}`, boxShadow:C.shadow, borderRadius:18, padding:"15px 16px", margin:"0 14px 14px", backdropFilter:a11y?"blur(18px) saturate(128%)":"none", WebkitBackdropFilter:a11y?"blur(18px) saturate(128%)":"none" });

function MoodCheckCard({ a11y }) {
  const C = moodPalette(a11y);
  const serif = "Georgia, 'Times New Roman', serif";
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

function TeamMoodCard({ a11y }) {
  const C = moodPalette(a11y);
  const serif = "Georgia, 'Times New Roman', serif";
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

const DEFAULT_CHECKLISTS = {
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
const CL_KINDS = [["open","Открытие"],["preshift","Предсменка"],["close","Закрытие"]];
const _clYmd = (d) => { const z = new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
const _clId = () => Math.random().toString(36).slice(2,8);

function ChecklistScreen({ T, a11y, profile, onBack }) {
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
        <div onClick={onBack} style={{ cursor:"pointer", color:C.gold, fontSize:26, lineHeight:1, padding:"0 6px" }}>‹</div>
        <div style={{ flex:1, color:C.text, fontFamily:serif, fontSize:19, fontWeight:"bold" }}>Чек-листы смены</div>
        {canEdit && !edit && <div onClick={startEdit} style={{ cursor:"pointer", color:C.gold, fontSize:13, fontWeight:"bold", border:`1px solid ${C.gold}55`, borderRadius:20, padding:"5px 12px" }}>✎ Править</div>}
        {edit && <div onClick={()=>setEdit(false)} style={{ cursor:"pointer", color:C.muted, fontSize:13, padding:"5px 10px" }}>Отмена</div>}
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
              <div key={it.id} onClick={()=>toggle(it.id)} style={{ ...itemCard, padding:"13px 14px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
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

const DEFAULT_ONBOARDING = [
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
const ONB_TOTAL = DEFAULT_ONBOARDING.reduce((n,p)=>n+p.steps.length,0);

function OnboardingScreen({ T, a11y, profile, role, onBack }) {
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
        <div onClick={onBack} style={{ cursor:"pointer", color:C.gold, fontSize:26, lineHeight:1, padding:"0 6px" }}>‹</div>
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
                  <div key={s.id} onClick={()=>toggle(s.id)} style={{ ...card, padding:"12px 14px", display:"flex", alignItems:"center", gap:12, marginBottom:8, cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
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

function AnalyticsScreen({ T, a11y, profile, scores = [], onBack }) {
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
        <div onClick={onBack} style={{ cursor:"pointer", color:C.gold, fontSize:26, lineHeight:1, padding:"0 6px" }}>‹</div>
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

function HomeScreen({ role, modules, completed, quizDone = {}, progress, doneCount, totalLessons, onModule, onChangeRole, T, streak = { count: 0, best: 0, last: "", days: [] }, a11y, profile, onChecklist, onOnboarding, onAnalytics }) {
  return (
    <div style={T.screen} className="sa-screen">
      <div style={T.homeHead}>
        <div style={T.homeTopRow}>
          <div style={T.logoRow}><span style={{ color:role.color, fontSize:20 }}>✦</span><span style={T.logoText}>SERVICE ACADEMY</span></div>
          <button style={T.changeRoleBtn} onClick={onChangeRole}>Сменить</button>
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
        <div style={T.progSub}>{doneCount} из {totalLessons} разделов завершено</div>
      </div>
      <StreakCard streak={streak} a11y={a11y} />
      <MoodCheckCard a11y={a11y} />
      {(["manager","senior"].includes(profile?.position) || profile?.is_admin) && <TeamMoodCard a11y={a11y} />}
      <div style={T.secTitle}>Программа обучения</div>
      <div style={T.modList} className="sa-stagger">
        {modules.map((m) => {
          const lessonsDone = m.lessons.filter(l => l.type !== "quiz" && l.type !== "result" && completed[l.id]).length;
          const quizzesDone = m.lessons.filter(l => l.type === "quiz" && quizDone[l.id]).length;
          const done = lessonsDone + quizzesDone;
          const total = m.lessons.filter(l => l.type !== "result").length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <div key={m.id} className="sa-card sa-glass" style={T.modCard} onClick={() => onModule(m)}>
              <div style={{ ...T.modBar, background:m.color }} />
              <div style={{ ...T.modIcon, display:"flex", alignItems:"center", justifyContent:"center" }}>{MOD_SVG[m.icon] ? MOD_SVG[m.icon](m.color, 28) : m.icon}</div>
              <div style={T.modInfo}>
                <div style={{ ...T.modTag, color:m.color }}>{m.tag}</div>
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

function ModuleScreen({ mod, completed, quizDone = {}, onBack, onLesson, T }) {
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
          const typeColor = { lesson:"#7C9E87", quiz:"#C8A96E", practice:"#8B7BAB" };
          return (
            <div key={l.id} className="sa-card sa-glass" style={{ ...T.lessCard, opacity: 1 }} onClick={() => onLesson(l)}>
              <div style={{ ...T.lessNum, background: done ? mod.color : "transparent", color: done ? "#fff" : l.type==="practice" ? "#A090C8" : l.type==="quiz" ? "#C8A96E" : (T.lessNumColor || "#C8B898"), fontSize: (l.type==="practice"||l.type==="quiz") ? 16 : 13, fontWeight: T.lessNumColor ? "bold" : "normal", border: done ? "none" : l.type==="practice" ? "1.5px solid rgba(139,123,171,0.5)" : l.type==="quiz" ? "1.5px solid rgba(200,169,110,0.5)" : (T.lessNumBorder || "1.5px solid rgba(200,185,152,0.35)") }}>
                {done ? "✓" : l.type==="practice" ? UI_SVG.gamepad("#A090C8", 15) : l.type==="quiz" ? UI_SVG.quiz("#C8A96E", 15) : i+1}
              </div>
              <div style={{ ...T.lessInfo, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                <div style={{ ...T.lessTitle, marginBottom:0, color: l.type==="practice" ? "#A090C8" : l.type==="quiz" ? "#C8A96E" : T.lessTitle.color }}>
                  {l.title}
                </div>
                {l.type === "lesson" && <div style={{ fontSize:10, letterSpacing:1, fontFamily:"monospace", color:typeColor[l.type], marginTop:2 }}>{typeMap[l.type]}</div>}
              </div>
              <div style={T.lessArrow}>{l.type==="quiz" && quizDone[l.id] ? UI_SVG.trophy("#C8A96E", 16) : l.type==="quiz" && completed[l.id] ? "✓" : "›"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function TimerBar({ duration, color, onExpire }) {
  const [timeLeft, setTimeLeft] = React.useState(duration);
  React.useEffect(() => {
    if (timeLeft <= 0) { onExpire(); return; }
    const t = setTimeout(() => setTimeLeft(t => t-1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);
  const pct = (timeLeft/duration)*100;
  const barColor = pct>60?"#5DBB8A":pct>30?"#D4A85A":"#E07878";
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ color:barColor, fontSize:11, fontFamily:"monospace", fontWeight:"bold", display:"inline-flex", alignItems:"center", gap:5 }}>{MOD_SVG["⚡"](barColor, 12)}БЫСТРЫЙ ВЫБОР</span>
        <span style={{ color:barColor, fontSize:13, fontWeight:"bold" }}>{timeLeft}с</span>
      </div>
      <div style={{ height:4, background:"rgba(255,255,255,0.1)", borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:2, transition:"width 1s linear, background 0.3s" }} />
      </div>
    </div>
  );
}

function SayAloud({ phrase, T, color }) {
  const [done, setDone] = React.useState(null);
  const gold = "#C8A96E";
  return (
    <div style={{ background:"rgba(200,169,110,0.1)", border:"1.5px solid rgba(200,169,110,0.4)", borderRadius:14, padding:"13px 14px", marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
        <span style={{ fontSize:16 }}>🗣</span>
        <span style={{ color:gold, fontSize:10.5, letterSpacing:1.5, fontFamily:"monospace", fontWeight:"bold" }}>А ТЕПЕРЬ — ВСЛУХ</span>
      </div>
      <div style={{ color:T.para.color, fontSize:14, lineHeight:1.6, fontStyle:"italic", marginBottom:done===null?12:10 }}>«{phrase}»</div>
      {done===null ? (
        <>
          <div style={{ color:T.modSub.color, fontSize:12, marginBottom:10, lineHeight:1.5 }}>Проговори фразу вслух — как живому гостю. Получилось?</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setDone("ok")} style={{ flex:1, padding:"9px", borderRadius:11, border:"none", background:gold, color:"#241a0a", fontSize:13, fontWeight:"bold", cursor:"pointer" }}>Получилось</button>
            <button onClick={()=>setDone("again")} style={{ flex:1, padding:"9px", borderRadius:11, border:`1.5px solid ${gold}`, background:"transparent", color:gold, fontSize:13, fontWeight:"bold", cursor:"pointer" }}>Ещё разок</button>
          </div>
        </>
      ) : (
        <div style={{ color:done==="ok"?"#5DBB8A":gold, fontSize:13, fontWeight:"bold", lineHeight:1.5 }}>
          {done==="ok" ? "🔥 Отлично! Звучит уверенно." : "💪 Ещё пара повторов — и пойдёт на автомате."}
        </div>
      )}
    </div>
  );
}

function LessonScreen({ lesson, color="#C8A96E", onBack, onComplete, quizState, onQuiz, practiceState, setPracticeState, onPracticeChoice, onPracticeNext, T }) {
  const nextBtnRef = React.useRef(null);
  const bodyRef = React.useRef(null);
  const [scrollPct, setScrollPct] = React.useState(0);
  const [termPopup, setTermPopup] = React.useState(null);
  const [dialogueScreen, setDialogueScreen] = React.useState(null); // dialogue id to show
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
      <div style={T.screen}>
        <div style={T.lessHead}><button style={T.backBtn2} onClick={onBack}>‹</button><div style={T.lessHeadTitle}>{lesson.title}</div></div>
        <div style={{ height:3, background: T.progBar?.background || "rgba(255,255,255,0.08)" }}><div style={{ height:3, width:`${scrollPct}%`, background:color, transition:"width 0.2s", borderRadius:2 }} /></div>
        <div ref={bodyRef} onScroll={handleScroll} style={{ ...T.lessBody, padding:"12px 14px 44px" }}>
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
            <div style={{ background: T.modCard?.background || "linear-gradient(155deg, #382810 0%, #281C08 100%)", border:`1px solid ${color||"#C8A96E"}44`, borderTop:`1px solid ${color||"#C8A96E"}66`, borderRadius:18, padding:"14px 16px", marginBottom:18, boxShadow:`0 6px 22px rgba(0,0,0,0.45), 0 2px 0 ${color||"#C8A96E"}18 inset` }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                <div style={{ fontSize:28 }}>💬</div>
                <div style={{ flex:1 }}>
                  <div style={{ color: color || "#C8A96E", fontSize: T.para?.fontSize || 15, fontWeight:"bold", fontFamily:"Georgia, serif" }}>В этом уроке есть живой диалог</div>
                </div>
              </div>
              <div style={{ color: T.modSub?.color || "#7A6548", fontSize: T.modSub?.fontSize || 13, lineHeight:1.6, fontFamily:"Georgia, serif" }}>
                Нажми на <span style={{ color: color||"#C8A96E", borderBottom:`1.5px dotted ${color||"#C8A96E"}`, fontWeight:"bold" }}>выделенное слово</span> в тексте — и отработай навык в живом диалоге с гостем
              </div>
            </div>
          )}
          {lesson.content.split("\n").map((line,i) => {
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
            if (line.startsWith("☑")) return markerRow(T.check, UI_SVG.checkSquare("#C8A96E", 14));
            if (line.startsWith("🚫")) return markerRow(T.forbidden, UI_SVG.ban("#E07878", 14));
            if (line.startsWith("✅")) return markerRow(T.good, UI_SVG.checkCircle("#5DBB8A", 14));
            if (line.startsWith("❌")) return markerRow(T.bad, UI_SVG.xCircle("#E07878", 14));
            if (line.startsWith("📌")) return markerRow(T.note, UI_SVG.pin(color, 14));
            const keycap = line.match(/^([1-9])️⃣/);
            if (keycap) return markerRow(T.principle,
              <span style={{ width:19, height:19, borderRadius:10, border:`1.5px solid ${color}`, color, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:10.5, fontWeight:"bold", fontFamily:"Georgia, serif" }}>{keycap[1]}</span>);
            const dotColor = { "🔵":"#5B8DD9", "🟢":"#5DBB8A", "🟡":"#D9C75B", "🟠":"#E0975B", "🔴":"#E07878" }[[...line][0]];
            if (dotColor) return markerRow(T.principle,
              <span style={{ width:9, height:9, borderRadius:5, background:dotColor, marginTop:3, boxShadow:`0 0 8px ${dotColor}55`, display:"inline-block" }} />);
            if (line.startsWith("«") && line.includes("»")) return <div key={i} style={{ ...T.quote, borderLeftColor:color }}>{highlightTerms(line, T.quote)}</div>;
            return <div key={i} style={T.para}>{highlightTerms(line, T.para)}</div>;
          })}
            </div>{/* конец zIndex:1 */}
          </div>{/* конец стеклянной подложки */}
          <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background:color }} onClick={onComplete}>Урок пройден ✓</button>
        </div>
        {dialogueScreen && (
          <LiveDialogue dialogueId={dialogueScreen} T={T} onClose={() => setDialogueScreen(null)} color={color} />
        )}
        {termPopup && (
          <div onClick={() => setTermPopup(null)}
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
                <div onClick={() => { setDialogueScreen(DIALOGUES_DATA.find(d => d.termKey === termPopup.term.toLowerCase()).id); setTermPopup(null); }}
                  style={{ marginTop:14, padding:"11px 16px", borderRadius:12, background:color, cursor:"pointer",
                    textAlign:"center", color:"#fff", fontSize:14, fontFamily:"Georgia, serif", fontWeight:"bold" }}>
                  Отработать на практике →
                </div>
              )}
              <div onClick={() => setTermPopup(null)}
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
                {stars===3 ? UI_SVG.trophy("#C8A96E", 16) : stars===2 ? ROLE_SVG.core("#C8A96E", 16) : UI_SVG.book("#C8A96E", 16)}
                <span>{stars===3?"Мастер сервиса!":stars===2?"Хороший результат!":"Тренируйся ещё!"}</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {[{l:"Правильно",v:`${correct}/${total}`,c:"#5DBB8A"},{l:"Жизни",v:`${practiceState.lives}❤️`,c:"#E07878"},{l:"Очков",v:practiceState.score,c:color}].map((s,i)=>(
                <div key={i} style={{ flex:1, background:T.simOpt.background, borderRadius:14, padding:"10px 6px", textAlign:"center", border:`2px solid ${T.simOpt.border}` }}>
                  <div style={{ color:s.c, fontSize:18, fontWeight:"bold" }}>{s.v}</div>
                  <div style={{ color:T.modSub.color, fontSize:10, marginTop:2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:14 }}>
              {situations.map((s,i) => practiceState.results[i]!==undefined && (
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 12px", background:practiceState.results[i]?"rgba(93,187,138,0.1)":"rgba(224,120,120,0.1)", borderRadius:12, marginBottom:6, border:`1px solid ${practiceState.results[i]?"#5DBB8A44":"#E0787844"}` }}>
                  <div style={{ flexShrink:0, display:"flex", marginTop:1 }}>{practiceState.results[i] ? UI_SVG.checkCircle("#5DBB8A", 16) : UI_SVG.xCircle("#E07878", 16)}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:T.modTitle.color, fontSize:12 }}>{s.emoji} {(s.scene||s.statement||"").substring(0,45)}...</div>
                    <div style={{ color:practiceState.results[i]?"#5DBB8A":"#E07878", fontSize:11, marginTop:1 }}>{(practiceState.results[i]?s.win:s.fail||"").substring(0,55)}...</div>
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
      action:   { label:"ЧТО ДЕЛАЕШЬ?",   gicon:"clap",   color:"#5DBB8A" },
      find:     { label:"НАЙДИ ОШИБКУ",   gicon:"search", color:"#D4A85A" },
      timer:    { label:"БЫСТРЫЙ ВЫБОР",  gicon:"bolt",   color:"#E07878" },
      truefalse:{ label:"ВЕРНО / НЕВЕРНО", gicon:"cards",  color:"#8B7BAB" },
      complete: { label:"СОБЕРИ ПРАВИЛО",  gicon:"link",   color:"#7B8FAB" },
      empathy:  { label:"РОЛЬ ГОСТЯ",     gicon:"mask",   color:"#C8A96E" },
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
              <span style={{ color:"#D4A85A", fontSize:13, fontWeight:"bold" }}>⭐ {practiceState.score}</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:3 }}>
            {situations.map((_,i)=>(
              <div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<practiceState.step?"#5DBB8A":i===practiceState.step?color:"rgba(255,255,255,0.12)", transition:"background 0.3s" }} />
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
                {[{label:"Верно",gicon:"check",val:true,bg:"rgba(93,187,138,0.15)",bc:"#5DBB8A"},{label:"Неверно",gicon:"x",val:false,bg:"rgba(224,120,120,0.15)",bc:"#E07878"}].map((btn,i)=>{
                  const chosen = answered && practiceState.choice===i;
                  const isRight = (btn.val===sit.isTrue) === (i===sit.correct);
                  const userWrong = answered && practiceState.choice!==sit.correct;
                  let bg = answered?(chosen&&i===sit.correct?"rgba(93,187,138,0.25)":chosen&&i!==sit.correct?"rgba(224,120,120,0.25)":!chosen&&i===sit.correct&&userWrong?"rgba(93,187,138,0.12)":T.simOpt.background):T.simOpt.background;
                  let bc = answered?(chosen&&i===sit.correct?"#5DBB8A":chosen&&i!==sit.correct?"#E07878":!chosen&&i===sit.correct&&userWrong?"#5DBB8A":neutralBC):neutralBC;
                  return (
                    <div key={i} className="sa-opt" onClick={()=>!answered&&wrappedPracticeChoice(i)}
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
                return <div key={i} className="sa-opt" onClick={()=>!answered&&wrappedPracticeChoice(i)} style={{ ...T.simOpt, background:bg, border:`2px solid ${bc}`, borderRadius:13, padding:"12px 14px", marginBottom:8, color:tc, lineHeight:1.6, cursor:answered?"default":"pointer", transition:"background 0.2s, border-color 0.2s, color 0.2s" }}>{opt}</div>;
              })}
            </>
          )}

          {/* ── ЖАНР: EMPATHY (роль гостя) ── */}
          {genre==="empathy" && (
            <>
              <div className="sa-fast" style={{ ...T.simScen, background:"rgba(200,169,110,0.12)", borderRadius:16, padding:"14px", marginBottom:6, border:"1px solid rgba(200,169,110,0.25)" }}>
                <div style={{ color:"#D4A85A", fontSize:10, letterSpacing:2, fontFamily:"monospace", marginBottom:6, display:"flex", alignItems:"center", gap:6 }}>{GAME_SVG.thought("#D4A85A", 13)}<span>МЫСЛИ ГОСТЯ</span></div>
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
                return <div key={i} className="sa-opt" onClick={()=>!answered&&wrappedPracticeChoice(i)} style={{ ...T.simOpt, background:bg, border:`2px solid ${bc}`, borderRadius:13, padding:"12px 14px", marginBottom:8, color:tc, lineHeight:1.6, cursor:answered?"default":"pointer", transition:"background 0.2s, border-color 0.2s, color 0.2s" }}>{opt}</div>;
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
                return <div key={i} className="sa-opt" onClick={()=>!answered&&wrappedPracticeChoice(i)} style={{ ...T.simOpt, background:bg, border:`2px solid ${bc}`, borderRadius:13, padding:"12px 14px", marginBottom:8, color:tc, lineHeight:1.6, cursor:answered?"default":"pointer", transition:"background 0.2s, border-color 0.2s, color 0.2s", boxShadow:answered&&chosen&&isCorr?"0 0 12px rgba(93,187,138,0.25)":"none" }}>{prefix}{opt}</div>;
              })}
            </>
          )}

          {/* ── ФИДБЭК ── */}
          
          {answered && (
            <div className="sa-fast" style={{ marginTop:10 }}>
              <div style={{ background:isCorrectAnswer?"rgba(93,187,138,0.15)":"rgba(224,120,120,0.15)", border:`1.5px solid ${isCorrectAnswer?"#5DBB8A":"#E07878"}`, borderRadius:14, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ fontSize:18, marginBottom:4 }}>
                  {practiceState.choice===-1 ? <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>{GAME_SVG.clock("#E07878", 15)}Время вышло!</span> : isCorrectAnswer ? `🎉 +${practiceState.combo>=2?20:10} очков!` : `😬 −1 ❤️ (осталось ${practiceState.lives})`}
                </div>
                <div style={{ color:isCorrectAnswer?"#5DBB8A":"#E07878", fontSize:13, lineHeight:1.6 }}>
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
          <div style={T.quizQ}>{q.q}</div>
          {q.options.map((opt,i) => {
            return <div key={i} className="sa-opt" style={{ ...T.quizOpt, cursor:"pointer" }} onClick={()=>onQuiz(i)}>{opt}</div>;
          })}
        </div>
      </div>
    );
  }
  return null;
}


// ─── ПАЛИТРА (ТЁПЛАЯ) ──────────────────────────────────────
// BG:     #1C1510  тёмный тёплый — обожжённое дерево
// Card:   #251C14  немного светлее
// Lift:   #2F2318  карточки
// Gold:   #D4A85A  акцент
// Text:   #F0EAE0  тёплый белый
// Sub:    #8A7E70  вторичный текст
// Green:  #5DBB8A  успех
// Red:    #E07070  ошибка
// ────────────────────────────────────────────────────────────

// ── Глоссарий терминов ────────────────────────────────────

function GlossaryScreen({ T, onBack, color, a11y }) {
  const [search, setSearch] = React.useState("");
  const filtered = GLOSSARY.filter(g =>
    g.term.toLowerCase().includes(search.toLowerCase()) ||
    g.def.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div style={T.screen}>
      <div style={T.lessHead}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>{UI_SVG.book(color || "#C8A96E", 18)}<span>Глоссарий</span></div>
      </div>
      <div style={{ ...T.lessBody, padding:"14px 16px 40px" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск термина..."
          style={{ width:"100%", padding:"10px 14px", borderRadius:12, border:`1px solid ${color}44`,
            background: T.modCard?.background || "rgba(255,255,255,0.05)",
            color: T.para?.color || "#F0E8D8", fontSize:15, fontFamily:"Georgia, serif",
            outline:"none", boxSizing:"border-box", marginBottom:14 }}
        />
        {filtered.length === 0 && (
          <div style={{ ...T.para, textAlign:"center", opacity:0.5 }}>Ничего не найдено</div>
        )}
        {filtered.map((g, i) => (
          <div key={i} style={{ ...T.modCard, marginBottom:10, padding:"12px 14px", borderRadius:14, flexDirection:"column", alignItems:"flex-start", gap:6 }}>
            <div style={{ color: a11y ? "#6B4A10" : "#E8C87A", fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:15 }}>{g.term}</div>
            <div style={{ ...T.modSub, color: a11y ? "#3A2A0E" : "#C8B898", fontSize:14, lineHeight:1.6 }}>{g.def}</div>
          </div>
        ))}
        <div style={{ ...T.para, textAlign:"center", opacity:0.4, fontSize:12, marginTop:8 }}>{GLOSSARY.length} терминов</div>
      </div>
    </div>
  );
}


// ── Данные живых диалогов ─────────────────────────────────


function LiveDialogue({ dialogueId, T, onClose, color }) {
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
    return grp.length ? grp[Math.floor(Math.random() * grp.length)].id : dialogueId;
  });
  const dialogue = group.find(d => d.id === currentId) || initial;
  const [visible, setVisible] = React.useState(false);
  const [messages, setMessages] = React.useState([]);

  React.useEffect(() => {
    setTimeout(() => setVisible(true), 20);
  }, []);
  const [stepIdx, setStepIdx] = React.useState(0);
  const [chosen, setChosen] = React.useState(null);
  const [score, setScore] = React.useState(0);
  const [mood, setMood] = React.useState(dialogue?.guest.mood || 3);
  const [typing, setTyping] = React.useState(false);
  const [done, setDone] = React.useState(false);
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
      if (step.type !== "result") setStepIdx(i => i + 1);
    };
    run();
  }, [stepIdx]);

  const choose = async (optIdx) => {
    if (chosen !== null) return;
    const step = dialogue.steps[stepIdx];
    const opt = step.options[optIdx];
    setChosen(optIdx);
    if (opt.correct) setScore(s => s + 1);
    setMood(m => Math.max(1, Math.min(5, m + opt.moodDelta)));
    await addMsg({ type: "waiter", text: opt.text, correct: opt.correct });
    await sleep(500);
    await addMsg({ type: "feedback", text: opt.feedback, correct: opt.correct });
    await sleep(700);
    if (opt.reaction) {
      setTyping(true);
      await sleep(800);
      setTyping(false);
      await addMsg({ type: "guest", text: opt.reaction });
      await sleep(450);
    }
    setChosen(null);
    const next = stepIdx + 1;
    if (dialogue.steps[next]?.type === "result") { setDone(true); return; }
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
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#7A6548", fontSize:22, cursor:"pointer", padding:0 }}>✕</button>
          <div style={{ fontSize:20 }}>{dialogue.guest.avatar}</div>
          <div style={{ flex:1 }}>
            <div style={{ color: T.modTitle?.color || "#F0E8D8", fontSize: T.modTitle?.fontSize || 15, fontWeight:"bold" }}>{dialogue.guest.name}</div>
            <div style={{ color: T.modSub?.color || "#9A8060", fontSize: T.modSub?.fontSize ? T.modSub.fontSize - 2 : 12 }}>{dialogue.title}</div>
          </div>
          <div style={{ color: T.modTitle?.color || "#7A6548", fontSize: T.modSub?.fontSize || 13 }}>{score}/{totalChoices} ✓</div>
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
              <div style={{ maxWidth:"78%", padding:"9px 13px", borderRadius:14, borderBottomRightRadius:4, background: msg.correct ? `${dColor}28` : "rgba(224,120,120,0.15)", border:`1px solid ${msg.correct ? dColor+"44" : "rgba(224,120,120,0.3)"}`, color: T.modTitle?.color || "#F0E8D8", fontSize: T.para?.fontSize || 14, lineHeight:1.6 }}>{msg.text}</div>
            </div>
          );
          if (msg.type === "feedback") return (
            <div key={i} style={{ padding:"8px 12px", borderRadius:10, background: msg.correct ? "rgba(93,187,138,0.08)" : "rgba(224,120,120,0.08)", border:`1px solid ${msg.correct ? "rgba(93,187,138,0.2)" : "rgba(224,120,120,0.2)"}`, color: msg.correct ? "#2DBB6A" : "#E05858", fontSize: T.modSub?.fontSize || 12, fontWeight:"bold", lineHeight:1.6 }}>
              {msg.correct ? "✓ " : "✗ "}{msg.text}
            </div>
          );
          return null;
        })}

        {typing && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
            <div style={{ fontSize: T.modSub?.fontSize ? T.modSub.fontSize - 1 : 13, color: T.modSub?.color || "#6A5535", marginBottom:2, paddingLeft:4 }}>{dialogue.guest.name}</div>
            <div style={{ padding:"10px 14px", borderRadius:14, borderBottomLeftRadius:4, background: T.a11y ? "rgba(180,145,70,0.12)" : "rgba(200,160,80,0.10)", border: T.a11y ? "1px solid rgba(160,120,50,0.25)" : "1px solid rgba(200,160,80,0.20)", display:"flex", gap:5, alignItems:"center" }}>
              {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"#7A6548", animation:`dlgPulse 1s ${i*0.2}s infinite` }} />)}
            </div>
          </div>
        )}

        {dialogue.steps[stepIdx]?.type === "choice" && !typing && messages.length > 0 && chosen === null && !done && (
          <div style={{ marginTop:8 }}>
            <div style={{ color: T.modSub?.color || "#9A8060", fontSize: T.modSub?.fontSize || 13, marginBottom:8, fontStyle:"italic", display:"flex", alignItems:"flex-start", gap:6 }}><span style={{ flexShrink:0, marginTop:2 }}>{MOD_SVG["💬"](T.modSub?.color || "#9A8060", 13)}</span><span>{dialogue.steps[stepIdx].prompt}</span></div>
            {dialogue.steps[stepIdx].options.map((opt, oi) => (
              <div key={oi} onClick={() => choose(oi)} style={{ padding:"11px 14px", borderRadius:12, marginBottom:6, background:"rgba(255,255,255,0.04)", border:`1px solid ${dColor}33`, color: T.modTitle?.color || "#C8B898", fontSize: T.para?.fontSize || 14, lineHeight:1.6, cursor:"pointer", transition:"all 0.15s" }}>{opt.text}</div>
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
            <div style={{ fontSize:32, marginBottom:4 }}>{MOOD_EMOJI_D[moodC-1]}</div>
            <div style={{ color:MOOD_COLORS_D[moodC-1], fontSize:15, fontWeight:"bold", marginBottom:2 }}>
              {moodC>=4 ? `${dialogue.guest.name} в восторге` : moodC===3 ? `${dialogue.guest.name} в порядке` : `${dialogue.guest.name} не в духе`}
            </div>
            <div style={{ color: T.modSub?.color || "#7A6548", fontSize:12, marginBottom:6 }}>{score} из {totalChoices} правильных ответов</div>
            <div style={{ color:dColor, fontSize: T.modSub?.fontSize || 12, lineHeight:1.5, marginBottom:8, fontStyle:"italic" }}>
              ✦ {dialogue.steps.find(s=>s.type==="result")?.tip}
            </div>
          </div>
          {/* История диалога */}
          <div style={{ flex:1, overflowY:"auto", padding:"8px 14px 8px", display:"flex", flexDirection:"column", gap:6, borderTop:`1px solid ${dColor}11` }}>
            {messages.map((msg, i) => {
              if (msg.type === "action") return <div key={i} style={{ textAlign:"center", color: T.para?.color || "#C8A870", fontSize:11, fontStyle:"italic", padding:"2px 0" }}>— {msg.text} —</div>;
              if (msg.type === "guest") return <div key={i} style={{ alignSelf:"flex-start", maxWidth:"80%", padding:"7px 11px", borderRadius:12, borderBottomLeftRadius:3, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color: T.para?.color || "#C8B898", fontSize:13, lineHeight:1.5 }}>{msg.text}</div>;
              if (msg.type === "waiter") return <div key={i} style={{ alignSelf:"flex-end", maxWidth:"80%", padding:"7px 11px", borderRadius:12, borderBottomRightRadius:3, background: msg.correct ? `${dColor}25` : "rgba(224,120,120,0.15)", border:`1px solid ${msg.correct ? dColor+"44" : "rgba(224,120,120,0.3)"}`, color: T.para?.color || "#F0E8D8", fontSize:13, lineHeight:1.5 }}>{msg.text}</div>;
              if (msg.type === "feedback") return <div key={i} style={{ padding:"5px 10px", borderRadius:8, background: msg.correct ? "rgba(93,187,138,0.08)" : "rgba(224,120,120,0.08)", color: msg.correct ? "#2DBB6A" : "#E05858", fontSize:11, fontWeight:"bold", lineHeight:1.5 }}>{msg.correct ? "✓ " : "✗ "}{msg.text}</div>;
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
                setCurrentId(nextId);
                setMessages([]); setStepIdx(0); setChosen(null); setScore(0); setMood(next?.guest.mood || 3); setDone(false); runningRef.current=false;
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

// Тёмная тема: глубокий антрацит + тёплые золотые акценты
// BG:     #18181C  (почти чёрный, чуть тёплый)
// Card:   #222228  (чуть светлее BG)
// Lift:   #2A2A32  (карточки, поднятые элементы)
// Gold:   #D4A85A  (основной акцент)
// GoldS:  #B8903E  (приглушённое золото)
// Text:   #F0EBE0  (тёплый белый)
// Sub:    #9A9080  (подписи, вторичный текст)
// Green:  #5DBB8A  (успех)
// Red:    #E07070  (ошибка/запрет)
// ────────────────────────────────────────────────────────────



// ── Error Boundary — ловит любые ошибки рендера и показывает дружелюбный экран ──
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("ServiceAcademy crashed:", error, info);
  }
  handleReload = () => {
    try { window.location.reload(); } catch (e) { this.setState({ hasError: false }); }
  };
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", background: "linear-gradient(160deg, #14100A 0%, #1C1509 50%, #14110A 100%)", fontFamily: "'Georgia', serif" }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🍷</div>
          <div style={{ color: "#F0E8D8", fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>Что-то пошло не так</div>
          <div style={{ color: "#9A8060", fontSize: 14, lineHeight: 1.7, maxWidth: 320, marginBottom: 24 }}>
            Произошёл сбой при загрузке экрана. Ваш прогресс сохранён — просто перезагрузите приложение.
          </div>
          <button onClick={this.handleReload} style={{ background: "linear-gradient(135deg, #C8A96E 0%, #8B6A30 100%)", color: "#fff", border: "none", borderRadius: 14, padding: "14px 28px", fontSize: 16, fontFamily: "'Georgia', serif", cursor: "pointer", boxShadow: "0 4px 18px rgba(200,160,80,0.3)" }}>
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ServiceAcademy />
    </ErrorBoundary>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// РАЗДЕЛ «СПРАВОЧНИК» (самодостаточный блок). Внутренняя навигация: хаб → курс →
// глава/тест. Иллюстрации — линейные SVG. Тема берётся из пропа dark (= !a11y).
// ═════════════════════════════════════════════════════════════════════════════
const ReferenceSection = (() => {
  const R = React;
  const SERIF = "Georgia, 'Times New Roman', serif";
  const TH = {
    dark: { bgTop: "#16130d", bgBot: "#0c0a07", card: "linear-gradient(145deg,#1d1810,#15110a)", text: "#E9DEC9", muted: "#9A8C74", dim: "#6E6354", gold: "#C8A96E", goldSoft: "#EBCF8E", green: "#5DBB8A", red: "#E07878", border: "rgba(200,169,110,0.16)", borderTop: "rgba(215,180,110,0.28)", frame: "rgba(255,255,255,0.025)", frameBorder: "rgba(200,169,110,0.22)", optBg: "rgba(255,255,255,0.04)", optBorder: "rgba(200,169,110,0.18)", iconBg: "rgba(200,169,110,0.13)", blur: "none" },
    light: { bgTop: "#F2EAD8", bgBot: "#E8DEC8", card: "rgba(238,225,198,0.72)", text: "#2A1F0E", muted: "#7A6548", dim: "#9A8060", gold: "#8B6A30", goldSoft: "#9A6B1E", green: "#2A6B45", red: "#B5482F", border: "rgba(180,145,70,0.22)", borderTop: "rgba(255,240,200,0.7)", frame: "rgba(255,250,235,0.55)", frameBorder: "rgba(180,145,70,0.28)", optBg: "rgba(255,250,235,0.5)", optBorder: "rgba(180,145,70,0.28)", iconBg: "rgba(200,150,50,0.14)", blur: "blur(16px) saturate(125%)" },
  };
  const sv = (c, s, w = 2) => ({ width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" });
  const Ico = {
    back: (c, s = 22) => (<svg {...sv(c, s)}><path d="M15 18l-6-6 6-6" /></svg>),
    cam: (c, s = 12) => (<svg {...sv(c, s)}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>),
    check: (c, s = 18) => (<svg {...sv(c, s, 2.2)}><circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" /></svg>),
    x: (c, s = 18) => (<svg {...sv(c, s, 2.2)}><circle cx="12" cy="12" r="10" /><path d="M9 9l6 6M15 9l-6 6" /></svg>),
    arrow: (c, s = 18) => (<svg {...sv(c, s, 2.2)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>),
    lock: (c, s = 14) => (<svg {...sv(c, s)}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>),
    serving: (c, s = 26) => (<svg {...sv(c, s, 1.7)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.4" /><path d="M3.5 12H1M23 12h-2.5" /></svg>),
    wine: (c, s = 26) => (<svg {...sv(c, s, 1.7)}><path d="M8 3h8M9 3c0 5 1.5 7 3 7s3-2 3-7M12 10v8M8 21h8" /></svg>),
    coffee: (c, s = 26) => (<svg {...sv(c, s, 1.7)}><path d="M4 8h13v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M17 9h2a2 2 0 0 1 0 4h-2" /><path d="M7 2.5c0 1.2-1 1.2-1 2.5M11 2.5c0 1.2-1 1.2-1 2.5" /></svg>),
    bar: (c, s = 26) => (<svg {...sv(c, s, 1.7)}><path d="M5 4h14l-7 8zM12 12v6M8 21h8" /></svg>),
  };

  // ── Бокалы (полные) ──
  const GLASS = {
    water: { bowl: "M19 16 Q19 64 40 73 Q61 64 61 16", rim: "M19 16 Q40 27 61 16", liquid: "M24 42 Q24 60 40 68 Q56 60 56 42 Q40 49 24 42", stemY: 73, fill: { d: "rgba(120,170,200,0.28)", l: "rgba(90,140,180,0.30)" } },
    white: { bowl: "M26 16 Q26 58 40 66 Q54 58 54 16", rim: "M26 16 Q40 24 54 16", liquid: "M30 40 Q30 54 40 60 Q50 54 50 40 Q40 46 30 40", stemY: 66, fill: { d: "rgba(225,205,125,0.40)", l: "rgba(190,160,70,0.38)" } },
    red: { bowl: "M17 15 Q17 64 40 74 Q63 64 63 15", rim: "M17 15 Q40 28 63 15", liquid: "M23 38 Q23 60 40 69 Q57 60 57 38 Q40 47 23 38", stemY: 74, fill: { d: "rgba(150,40,48,0.52)", l: "rgba(150,45,45,0.46)" } },
    flute: { bowl: "M33 8 Q33 72 40 80 Q47 72 47 8", rim: "M33 8 Q40 12 47 8", liquid: "M35 34 Q35 70 40 76 Q45 70 45 34 Q40 38 35 34", stemY: 80, fill: { d: "rgba(232,205,130,0.42)", l: "rgba(200,170,80,0.42)" }, bubbles: true },
  };
  function Glass({ type = "red", c, dark, size = 76 }) {
    const g = GLASS[type]; const liq = dark ? g.fill.d : g.fill.l; const baseY = 128;
    return (<svg width={size} height={size * 1.85} viewBox="0 0 80 150" fill="none">
      <path d={g.liquid} fill={liq} />
      {g.bubbles && [0, 1, 2, 3].map(i => <circle key={i} cx={38 + (i % 2) * 4} cy={68 - i * 8} r={1.1} fill={dark ? "#EBCF8E" : "#9A6B1E"} />)}
      <path d={g.bowl} stroke={c} strokeWidth="2.1" strokeLinecap="round" fill="none" />
      <path d={g.rim} stroke={c} strokeWidth="2.1" strokeLinecap="round" fill="none" />
      <line x1="40" y1={g.stemY} x2="40" y2={baseY} stroke={c} strokeWidth="2.1" strokeLinecap="round" />
      <path d={`M24 ${baseY + 3} Q40 ${baseY - 3} 56 ${baseY + 3}`} stroke={c} strokeWidth="2.1" fill="none" strokeLinecap="round" />
      <ellipse cx="40" cy={baseY + 4} rx="17" ry="3.4" stroke={c} strokeWidth="2.1" fill="none" />
    </svg>);
  }
  function Snifter({ c, dark, size = 64 }) {
    const liq = dark ? "rgba(175,95,42,0.45)" : "rgba(160,90,40,0.42)";
    return (<svg width={size} height={size * 1.7} viewBox="0 0 80 130" fill="none">
      <path d="M24 56 Q24 72 40 78 Q56 72 56 56 Q40 62 24 56" fill={liq} />
      <path d="M18 44 Q18 74 40 82 Q62 74 62 44 Q40 34 18 44 Z" stroke={c} strokeWidth="2.1" fill="none" />
      <line x1="40" y1="82" x2="40" y2="104" stroke={c} strokeWidth="2.1" strokeLinecap="round" />
      <ellipse cx="40" cy="106" rx="17" ry="3.2" stroke={c} strokeWidth="2.1" fill="none" />
    </svg>);
  }
  function Rocks({ c, dark, size = 56 }) {
    const liq = dark ? "rgba(180,110,40,0.42)" : "rgba(160,95,35,0.40)";
    return (<svg width={size} height={size * 1.6} viewBox="0 0 80 120" fill="none">
      <path d="M26 78 L28 108 Q40 112 52 108 L54 78 Q40 84 26 78" fill={liq} />
      <path d="M24 50 L28 108 Q40 113 52 108 L56 50" stroke={c} strokeWidth="2.1" fill="none" strokeLinejoin="round" />
      <ellipse cx="40" cy="50" rx="16" ry="4" stroke={c} strokeWidth="2.1" fill="none" />
      <rect x="33" y="64" width="13" height="13" rx="2" transform="rotate(12 39 70)" stroke={c} strokeWidth="1.6" fill="none" opacity="0.7" />
    </svg>);
  }

  // ── Приборы ──
  const HANDLE = (y) => `M19.5 ${y} L20 144 Q20 150 22 150 Q24 150 24 144 L24.5 ${y}`;
  function Util({ kind, c, size = 44 }) {
    const cm = { stroke: c, strokeWidth: 2.2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
    let b = null;
    if (kind === "fork") b = (<>{[14.5, 19.5, 24.5, 29.5].map((x, i) => <line key={i} x1={x} y1={12} x2={x} y2={42} {...cm} />)}<path d="M14.5 42 Q14 54 19.5 62 M29.5 42 Q30 54 24.5 62" {...cm} /><path d={HANDLE(62)} {...cm} /></>);
    else if (kind === "knife") b = (<><path d="M22 14 L24.5 24 L24.5 64 L20 66 Q15 50 16 36 Q17.5 22 22 14 Z" {...cm} /><path d={HANDLE(66)} {...cm} /></>);
    else if (kind === "steak") { let p = "M22 15 L24.5 24 L24.5 62 L20 64"; let y = 61, t = true; while (y > 21) { p += ` L${t ? 15.8 : 18} ${y}`; y -= 3; t = !t; } p += " Z"; b = (<><path d={p} {...cm} /><path d={HANDLE(64)} {...cm} /></>); }
    else if (kind === "fish") b = (<><path d="M20 12 Q13 28 13 46 Q14 58 19 64 L25 64 Q28 56 29 44 L24 40 L29 36 Q28 22 20 12 Z" {...cm} /><path d={HANDLE(64)} {...cm} /></>);
    else if (kind === "butter") b = (<><path d="M16 30 Q16 17 22 16 Q28 17 28 30 L26 51 Q26 56 22 56 Q18 56 18 51 Z" {...cm} /><path d={HANDLE(55)} {...cm} /></>);
    else if (kind === "spoon") b = (<><ellipse cx="22" cy="30" rx="11" ry="16.5" {...cm} /><path d={HANDLE(47)} {...cm} /></>);
    else if (kind === "oyster") b = (<>{[16, 22, 28].map((x, i) => <line key={i} x1={x} y1={40} x2={x} y2={66} {...cm} />)}<path d="M16 66 Q16 74 19.5 80 M28 66 Q28 74 24.5 80" {...cm} /><path d="M19.5 80 L20 142 Q20 148 22 148 Q24 148 24 142 L24.5 80" {...cm} /></>);
    return <svg width={size} height={size * 3.55} viewBox="0 0 44 156">{b}</svg>;
  }
  function Plate({ kind, c, size = 90 }) {
    const cm = { stroke: c, strokeWidth: 2.2, fill: "none" }; let b = null;
    if (kind === "charger") b = (<><circle cx="60" cy="60" r="52" {...cm} /><circle cx="60" cy="60" r="44" {...cm} opacity="0.85" /><circle cx="60" cy="60" r="30" {...cm} opacity="0.5" /></>);
    else if (kind === "dinner") b = (<><circle cx="60" cy="60" r="50" {...cm} /><circle cx="60" cy="60" r="36" {...cm} opacity="0.55" /></>);
    else if (kind === "bread") b = (<><circle cx="60" cy="60" r="40" {...cm} /><circle cx="60" cy="60" r="28" {...cm} opacity="0.5" /></>);
    else if (kind === "sizes") b = [52, 42, 32, 22].map((r, i) => <circle key={i} cx="60" cy="60" r={r} {...cm} opacity={1 - i * 0.18} />);
    return <svg width={size} height={size} viewBox="0 0 120 120">{b}</svg>;
  }
  function MiniGlass({ type, c, size = 26 }) {
    const G = { water: "M5 4 Q5 17 11 19 Q17 17 17 4", red: "M4 3 Q4 18 11 20 Q18 18 18 3", white: "M6 4 Q6 16 11 18 Q16 16 16 4", flute: "M9 2 Q9 18 11 20 Q13 18 13 2" }[type];
    const sy = { water: 19, red: 20, white: 18, flute: 20 }[type];
    return (<svg width={size} height={size * 1.8} viewBox="0 0 22 40" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><path d={G} /><line x1="11" y1={sy} x2="11" y2="34" /><line x1="6" y1="35" x2="16" y2="35" /></svg>);
  }
  function Napkin({ c, size = 40 }) {
    const cm = { stroke: c, strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
    return (<svg width={size} height={size * 1.15} viewBox="0 0 60 70" fill="none"><path d="M30 60 L8 18 Q30 7 52 18 Z" {...cm} />{[[15, 13], [23, 10], [30, 9], [37, 10], [45, 13]].map((p, i) => <line key={i} x1="30" y1="60" x2={p[0]} y2={p[1]} stroke={c} strokeWidth="1.3" opacity="0.7" strokeLinecap="round" />)}</svg>);
  }
  function Oyster({ c, x, y }) { return (<g stroke={c} strokeWidth="1.6" fill="none"><ellipse cx={x} cy={y} rx="9" ry="11" /><path d={`M${x - 6} ${y - 3} Q${x} ${y - 8} ${x + 6} ${y - 3}`} opacity="0.6" /><ellipse cx={x} cy={y + 1} rx="4" ry="5" fill={c} fillOpacity="0.25" stroke="none" /></g>); }
  function PlateStack({ c, size = 110 }) {
    const cm = { stroke: c, strokeWidth: 2, fill: "none" };
    return (<svg width={size} height={size * 0.75} viewBox="0 0 120 90">{[0, 1, 2, 3, 4].map(i => <ellipse key={i} cx="60" cy={28 + i * 11} rx="40" ry="9" {...cm} opacity={0.55 + i * 0.11} />)}<path d="M20 28 L20 72" {...cm} /><path d="M100 28 L100 72" {...cm} /></svg>);
  }
  const P = (o) => ({ position: "absolute", ...o });

  // ── Сцены ──
  function SceneBase({ c }) {
    return (<div style={{ position: "relative", width: "100%", height: 200 }}>
      <div style={P({ left: "50%", top: 64, transform: "translateX(-50%)" })}><Plate kind="dinner" c={c} size={108} /></div>
      <div style={P({ left: "50%", top: 80, transform: "translateX(-50%)" })}><Napkin c={c} size={40} /></div>
      <div style={P({ left: "28%", top: 70 })}><Util kind="fork" c={c} size={20} /></div>
      <div style={P({ right: "28%", top: 70 })}><Util kind="knife" c={c} size={20} /></div>
      <div style={P({ right: "24%", top: 22 })}><MiniGlass type="water" c={c} size={26} /></div>
    </div>);
  }
  function SceneFull({ c }) {
    return (<div style={{ position: "relative", width: "100%", height: 210 }}>
      <div style={P({ left: "50%", top: 78, transform: "translateX(-50%)" })}><Plate kind="charger" c={c} size={100} /></div>
      <div style={P({ left: "16%", top: 76 })}><Util kind="fork" c={c} size={17} /></div>
      <div style={P({ left: "23%", top: 78 })}><Util kind="fork" c={c} size={17} /></div>
      <div style={P({ left: "30%", top: 80 })}><Util kind="fork" c={c} size={16} /></div>
      <div style={P({ right: "30%", top: 80 })}><Util kind="fish" c={c} size={16} /></div>
      <div style={P({ right: "23%", top: 78 })}><Util kind="knife" c={c} size={17} /></div>
      <div style={P({ right: "16%", top: 76 })}><Util kind="spoon" c={c} size={17} /></div>
      <div style={P({ left: "50%", top: 56, transform: "translateX(-50%) rotate(-90deg)" })}><Util kind="spoon" c={c} size={13} /></div>
      <div style={P({ left: "7%", top: 18 })}><Plate kind="bread" c={c} size={58} /></div>
      <div style={P({ right: "6%", top: 16, display: "flex", alignItems: "flex-end", gap: 1 })}><MiniGlass type="water" c={c} size={22} /><MiniGlass type="red" c={c} size={24} /><MiniGlass type="white" c={c} size={20} /><MiniGlass type="flute" c={c} size={18} /></div>
    </div>);
  }
  function Cover({ c, left }) {
    return (<div style={P({ left, top: 30, width: 80, transform: "translateX(-50%)" })}><div style={{ position: "relative", height: 130 }}>
      <div style={P({ left: "50%", top: 34, transform: "translateX(-50%)" })}><Plate kind="dinner" c={c} size={66} /></div>
      <div style={P({ left: -2, top: 38 })}><Util kind="fork" c={c} size={13} /></div>
      <div style={P({ right: -2, top: 38 })}><Util kind="knife" c={c} size={13} /></div>
      <div style={P({ left: "50%", top: 0, transform: "translateX(-50%)" })}><MiniGlass type="red" c={c} size={18} /></div>
    </div></div>);
  }
  function SceneBanquet({ c }) { return (<div style={{ position: "relative", width: "100%", height: 175 }}><Cover c={c} left="18%" /><Cover c={c} left="50%" /><Cover c={c} left="82%" /></div>); }
  function SceneBuffet({ c }) {
    return (<div style={{ position: "relative", width: "100%", height: 185, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 8px" }}>
      <PlateStack c={c} size={108} />
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}><MiniGlass type="water" c={c} size={26} /><MiniGlass type="red" c={c} size={28} /><MiniGlass type="flute" c={c} size={22} /></div>
      <div style={{ display: "flex", gap: 2 }}><Util kind="fork" c={c} size={20} /><Util kind="knife" c={c} size={20} /></div>
    </div>);
  }
  function SceneOyster({ c }) {
    const oy = []; for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 2; oy.push([60 + 30 * Math.cos(a), 60 + 30 * Math.sin(a)]); }
    return (<div style={{ position: "relative", width: "100%", height: 185 }}>
      <div style={P({ left: "50%", top: 30, transform: "translateX(-50%)" })}><svg width="120" height="120" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="54" stroke={c} strokeWidth="2.2" /><circle cx="60" cy="60" r="46" stroke={c} strokeWidth="2.2" opacity="0.5" strokeDasharray="3 4" />
        {oy.map(([x, y], i) => <Oyster key={i} c={c} x={x} y={y} />)}
        <g stroke={c} strokeWidth="1.6" fill="none"><path d="M53 60 L67 60 L60 50 Z" /><path d="M60 50 L60 60 M55 57 L60 60 M65 57 L60 60" opacity="0.6" /></g>
      </svg></div>
      <div style={P({ right: "16%", top: 28 })}><Util kind="oyster" c={c} size={18} /></div>
    </div>);
  }
  function SceneJapan({ c }) {
    const cm = { stroke: c, strokeWidth: 2.1, fill: "none", strokeLinecap: "round" };
    return (<div style={{ position: "relative", width: "100%", height: 170 }}>
      <div style={P({ left: "42%", top: 54, transform: "translateX(-50%)" })}><svg width="96" height="60" viewBox="0 0 96 60" fill="none"><ellipse cx="48" cy="14" rx="34" ry="8" {...cm} /><path d="M14 14 Q48 56 82 14" {...cm} /><path d="M26 16 Q48 30 70 16" {...cm} opacity="0.5" /></svg></div>
      <div style={P({ right: "12%", top: 36 })}><svg width="60" height="80" viewBox="0 0 60 80" fill="none"><line x1="6" y1="74" x2="40" y2="6" {...cm} /><line x1="16" y1="76" x2="50" y2="8" {...cm} /></svg></div>
      <div style={P({ left: "14%", top: 22 })}><svg width="48" height="30" viewBox="0 0 48 30" fill="none"><ellipse cx="24" cy="12" rx="20" ry="6" {...cm} /><path d="M6 12 Q24 28 42 12" {...cm} /></svg></div>
      <div style={P({ left: "22%", top: 96 })}><svg width="40" height="26" viewBox="0 0 40 26" fill="none"><ellipse cx="20" cy="10" rx="16" ry="5" {...cm} /><path d="M5 10 Q20 24 35 10" {...cm} /></svg></div>
    </div>);
  }
  function SceneChina({ c }) {
    const cm = { stroke: c, strokeWidth: 2.1, fill: "none" };
    const dish = []; for (let i = 0; i < 4; i++) { const a = (Math.PI / 2) * i; dish.push([60 + 30 * Math.cos(a), 60 + 30 * Math.sin(a)]); }
    return (<div style={{ position: "relative", width: "100%", height: 175 }}>
      <div style={P({ left: "50%", top: 18, transform: "translateX(-50%)" })}><svg width="140" height="140" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="54" {...cm} /><circle cx="60" cy="60" r="20" {...cm} opacity="0.7" />
        {dish.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="11" {...cm} opacity="0.85" />)}
        <line x1="60" y1="40" x2="60" y2="80" {...cm} opacity="0.3" /><line x1="40" y1="60" x2="80" y2="60" {...cm} opacity="0.3" />
      </svg></div>
    </div>);
  }
  function SceneMeze({ c }) {
    const cm = { stroke: c, strokeWidth: 2.1, fill: "none" };
    const dish = []; for (let i = 0; i < 5; i++) { const a = (2 * Math.PI / 5) * i - Math.PI / 2; dish.push([60 + 32 * Math.cos(a), 60 + 32 * Math.sin(a)]); }
    return (<div style={{ position: "relative", width: "100%", height: 165 }}>
      <div style={P({ left: "50%", top: 14, transform: "translateX(-50%)" })}><svg width="140" height="140" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="56" {...cm} opacity="0.5" />
        <circle cx="60" cy="60" r="13" {...cm} />
        {dish.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="13" {...cm} opacity="0.9" />)}
      </svg></div>
    </div>);
  }

  // ── Маленькие наборные иллюстрации ──
  function Frame({ T, children, cap, big }) {
    return (<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ background: T.frame, border: `1px solid ${T.frameBorder}`, borderRadius: 16, padding: big ? "14px 8px 8px" : "10px 6px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 96 }}>{children}</div>
      {cap && <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, color: T.dim, fontSize: 10.5 }}>{Ico.cam(T.dim, 11)}<span>{cap}</span></div>}
    </div>);
  }
  function Row({ children }) { return <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 14, padding: "6px 0" }}>{children}</div>; }

  // ── Реестр иллюстраций ──
  const ILL = {
    preset_table: (c, d) => <SceneBase c={c} />,
    oyster_service: (c, d) => <SceneOyster c={c} />,
    fine_dining_full: (c, d) => <SceneFull c={c} />,
    banquet: (c, d) => <SceneBanquet c={c} />,
    buffet: (c, d) => <SceneBuffet c={c} />,
    cutlery_layout_diagram: (c, d) => <SceneFull c={c} />,
    bread_plate_butter: (c, d) => (<div style={{ position: "relative", width: 100, height: 100 }}><Plate kind="bread" c={c} size={100} /><div style={{ position: "absolute", left: 44, top: 8, transform: "rotate(42deg)" }}><Util kind="butter" c={c} size={20} /></div></div>),
    plates_sizes: (c, d) => <Plate kind="sizes" c={c} size={104} />,
    charger_plate: (c, d) => <Plate kind="charger" c={c} size={104} />,
    basic_flatware: (c, d) => <Row><Util kind="fork" c={c} size={26} /><Util kind="knife" c={c} size={26} /><Util kind="spoon" c={c} size={26} /></Row>,
    fish_steak_cutlery: (c, d) => <Row><Util kind="steak" c={c} size={26} /><Util kind="fish" c={c} size={26} /><Util kind="oyster" c={c} size={22} /></Row>,
    wine_glasses_chart: (c, d) => <Row><Glass type="water" c={c} dark={d} size={40} /><Glass type="white" c={c} dark={d} size={40} /><Glass type="red" c={c} dark={d} size={40} /><Glass type="flute" c={c} dark={d} size={40} /></Row>,
    snifter_rocks: (c, d) => <Row><Snifter c={c} dark={d} size={56} /><Rocks c={c} dark={d} size={48} /></Row>,
    glass_red: (c, d) => <Glass type="red" c={c} dark={d} size={88} />,
    glass_flute: (c, d) => <Glass type="flute" c={c} dark={d} size={88} />,
    school_french: (c, d) => <SceneFull c={c} />,
    school_english: (c, d) => <SceneFull c={c} />,
    school_american: (c, d) => <SceneBase c={c} />,
    school_italian: (c, d) => <SceneBase c={c} />,
    school_japanese: (c, d) => <SceneJapan c={c} />,
    school_chinese: (c, d) => <SceneChina c={c} />,
    school_middle_east: (c, d) => <SceneMeze c={c} />,
    school_russian: (c, d) => <SceneFull c={c} />,
  };
  const renderIll = (key, T, dark) => (ILL[key] ? ILL[key](T.gold, dark) : null);

  // ── Контент ──
  function inlineBold(s, T) {
    return s.split("**").map((p, i) => i % 2 ? <b key={i} style={{ color: T.goldSoft }}>{p}</b> : <R.Fragment key={i}>{p}</R.Fragment>);
  }
  function Content({ text, T }) {
    const lines = text.split("\n");
    return (<div>{lines.map((ln, i) => {
      const t = ln.trim();
      if (!t) return <div key={i} style={{ height: 8 }} />;
      if (t.startsWith("• ")) return (<div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}><span style={{ color: T.gold }}>•</span><div style={{ flex: 1, color: T.text, fontSize: 14.5, lineHeight: 1.55, fontFamily: SERIF }}>{inlineBold(t.slice(2), T)}</div></div>);
      const num = t.match(/^(\d+)\.\s+(.*)/);
      if (num) return (<div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}><span style={{ color: T.gold, fontWeight: "bold", fontFamily: SERIF }}>{num[1]}.</span><div style={{ flex: 1, color: T.text, fontSize: 14.5, lineHeight: 1.55, fontFamily: SERIF }}>{inlineBold(num[2], T)}</div></div>);
      return <div key={i} style={{ color: T.text, fontSize: 14.5, lineHeight: 1.6, marginBottom: 6, fontFamily: SERIF }}>{inlineBold(t, T)}</div>;
    })}</div>);
  }

  // ── Данные ──
  const COURSE = {
    id: "serving", title: "Сервировка", subtitle: "Наглядно: посуда, приборы, бокалы, школы сервиса",
    lessons: [
      { id: "srv-1", title: "Что такое сервировка", type: "lesson", content: `Сервировка — это подготовка стола к приёму гостя согласно концепции заведения, формату обслуживания и меню.\n\n**Основные задачи:**\n• комфорт гостя\n• скорость обслуживания\n• эстетика\n• увеличение среднего чека\n• создание атмосферы\n\n📌 **Главное правило:** гость не должен задумываться, каким прибором пользоваться и где находится нужный предмет.` },
      { id: "srv-2", title: "Виды сервировки", type: "lesson", images: ["preset_table", "oyster_service", "fine_dining_full", "banquet", "buffet"], content: `**Предварительная (Pre-set)** — стол готовится до прихода гостей: сервировочная тарелка, базовые приборы, бокалы, салфетка.\n\n**Дополнительная** — после заказа. Пример: гость заказал устрицы → добавляют устричную вилку, лимонницу, специальную тарелку.\n\n**Полная** — Fine Dining. Заранее весь комплект: закусочные, рыбные, основные, десертные приборы, несколько бокалов.\n\n**Банкетная** — много гостей, единая схема, высокая скорость.\n\n**Фуршетная** — без закреплённых мест, маленькие тарелки, минимум приборов.` },
      { id: "srv-3", title: "Расположение приборов", type: "lesson", images: ["cutlery_layout_diagram", "bread_plate_butter"], content: `Международный стандарт — от внешнего прибора к внутреннему (в порядке подачи блюд).\n\n**Слева:** закусочная вилка → рыбная вилка → столовая вилка.\n\n**Справа:** закусочный нож → рыбный нож → столовый нож → ложка. Лезвие всегда направлено к тарелке.\n\n**Сверху:** десертная ложка и десертная вилка.\n\n**Слева сверху:** пирожковая тарелка и нож для масла.` },
      { id: "srv-q-layout", title: "Фото-вопросы: расположение", type: "quiz", questions: [
        { q: "С какой стороны от тарелки кладут вилки?", img: "cutlery_layout_diagram", options: ["Справа", "Слева", "Сверху", "Снизу"], correct: 1, explanation: "Вилки — слева, ножи и ложка — справа. От внешнего к внутреннему по порядку подачи." },
        { q: "Куда направлено лезвие ножа?", img: "cutlery_layout_diagram", options: ["От тарелки", "К тарелке", "Вверх", "Без разницы"], correct: 1, explanation: "Лезвие всегда направлено к тарелке — это стандарт и безопасность." },
        { q: "Где находится пирожковая тарелка?", img: "bread_plate_butter", options: ["Справа сверху", "Слева сверху", "По центру", "Справа внизу"], correct: 1, explanation: "Пирожковая тарелка и нож для масла — слева сверху." },
      ] },
      { id: "srv-4", title: "Виды тарелок", type: "lesson", images: ["plates_sizes", "charger_plate"], content: `**Сервировочная (Charger Plate)** — основа сервировки, убирается перед подачей основного блюда.\n\n**Столовая** — для горячих блюд, диаметр 26–32 см.\n\n**Закусочная** — для холодных закусок, 18–22 см.\n\n**Десертная** — для десертов, 16–20 см.\n\n**Пирожковая** — для хлеба и масла.` },
      { id: "srv-q-plates", title: "Фото-вопросы: тарелки", type: "quiz", questions: [
        { q: "Какая тарелка убирается перед подачей основного блюда?", img: "charger_plate", options: ["Столовая", "Сервировочная (Charger)", "Десертная", "Пирожковая"], correct: 1, explanation: "Сервировочная (Charger Plate) — декоративная основа, её убирают перед горячим." },
        { q: "Для горячих блюд используют тарелку диаметром:", options: ["16–20 см", "18–22 см", "26–32 см", "10–14 см"], correct: 2, explanation: "Столовая тарелка для горячего — 26–32 см." },
      ] },
      { id: "srv-5", title: "Виды приборов", type: "lesson", images: ["basic_flatware", "fish_steak_cutlery"], content: `**Базовые:** столовая вилка, столовый нож, столовая ложка.\n\n**Специализированные:**\n• **Рыбные** — особая форма для отделения костей.\n• **Стейковые** — зубчатое лезвие.\n• **Устричные** — маленькая трезубая вилка.\n• **Для лобстера** — длинные узкие приборы.\n• **Десертные** — уменьшенный размер.` },
      { id: "srv-q-cutlery", title: "Фото-вопросы: приборы", type: "quiz", questions: [
        { q: "У какого ножа зубчатое лезвие?", img: "fish_steak_cutlery", options: ["Рыбный", "Стейковый", "Десертный", "Закусочный"], correct: 1, explanation: "Зубчатое лезвие — у стейкового ножа, чтобы резать мясо." },
        { q: "Маленькая трезубая вилка — для чего?", options: ["Десерт", "Рыба", "Устрицы", "Лобстер"], correct: 2, explanation: "Трезубая устричная вилка — для морепродуктов в раковине." },
      ] },
      { id: "srv-6", title: "Виды бокалов", type: "lesson", images: ["wine_glasses_chart", "snifter_rocks"], content: `**Вода** — самый крупный бокал.\n\n**Белое вино** — меньше объём, сохраняет температуру.\n\n**Красное вино** — большая чаша, вино раскрывается.\n\n**Игристое** — флюте или тюльпан.\n\n**Коньяк** — снифтер.\n\n**Виски** — рокс.` },
      { id: "srv-q-glasses", title: "Фото-вопросы: бокалы", type: "quiz", questions: [
        { q: "Какой это бокал?", img: "glass_red", options: ["Вода", "Белое вино", "Красное вино", "Игристое"], correct: 2, explanation: "Большая чаша — для красного: вино «дышит» и раскрывает аромат." },
        { q: "Какой это бокал?", img: "glass_flute", options: ["Игристое (флюте)", "Красное вино", "Вода", "Коньяк"], correct: 0, explanation: "Узкий флюте сохраняет пузырьки игристого." },
        { q: "В каком бокале подают коньяк?", img: "snifter_rocks", options: ["Флюте", "Снифтер", "Рокс", "Бокал для воды"], correct: 1, explanation: "Снифтер — широкая чаша, согревается в ладони, раскрывает аромат." },
      ] },
      { id: "srv-7", title: "Французская школа", type: "lesson", images: ["school_french"], content: `🇫🇷 Основа современной ресторанной сервировки.\n\n• большое количество приборов\n• несколько бокалов\n• строгая симметрия\n• сервировочная тарелка обязательна\n\n**Принцип:** всё должно выглядеть идеально ещё до появления гостя.` },
      { id: "srv-8", title: "Английская школа", type: "lesson", images: ["school_english"], content: `🇬🇧 Консервативность и этикет.\n\n• большое значение этикету\n• серебряные приборы\n• сервировка под каждый курс\n\nИспользуется во многих исторических отелях.` },
      { id: "srv-9", title: "Американская школа", type: "lesson", images: ["school_american"], content: `🇺🇸 Практичность и скорость.\n\n• меньше приборов\n• акцент на скорость обслуживания\n\nОчень популярна в сетевых ресторанах.` },
      { id: "srv-10", title: "Итальянская школа", type: "lesson", images: ["school_italian"], content: `🇮🇹 Меньше формальностей.\n\n• акцент на еде\n• часто минималистичная сервировка\n\nДаже дорогие рестораны нередко используют упрощённую схему.` },
      { id: "srv-11", title: "Японская сервировка", type: "lesson", images: ["school_japanese"], content: `🇯🇵 Полностью отличается от европейской.\n\n• палочки вместо приборов\n• много маленьких тарелок\n• асимметрия считается красивой\n• важна сезонность посуды\n\nВ ресторанах кайсэки сервировка может меняться каждый сезон.` },
      { id: "srv-12", title: "Китайская сервировка", type: "lesson", images: ["school_chinese"], content: `🇨🇳 Стол для общего стола.\n\n• вращающийся центр стола\n• блюда для общего потребления\n• палочки\n• фарфоровая ложка\n\n**Главная идея:** еда принадлежит столу, а не конкретному гостю.` },
      { id: "srv-13", title: "Ближневосточная сервировка", type: "lesson", images: ["school_middle_east"], content: `🕌 Гостеприимство и общие блюда.\n\n• большое количество общих блюд\n• мезе\n• коллективное потребление пищи\n• акцент на гостеприимство` },
      { id: "srv-14", title: "Русская школа сервиса", type: "lesson", images: ["school_russian"], content: `🇷🇺 Исторически одна из самых сложных.\n\n• блюда подаются по очереди\n• большое количество смен посуды\n• активная работа официанта возле гостя\n\nМногие элементы современного Fine Dining пришли именно из русской подачи XIX века.` },
      { id: "srv-15", title: "Стандарт Michelin", type: "lesson", content: `Ни один гид не требует конкретной сервировки. Но практически все рестораны уровня Michelin соблюдают:\n\n1. Идеальную чистоту.\n2. Абсолютную симметрию.\n3. Сервировку под конкретное меню.\n4. Безупречное состояние бокалов.\n5. Отсутствие лишних предметов.\n6. Единообразие на всех столах.` },
      { id: "srv-final", title: "Итоговый тест", type: "quiz", questions: [
        { q: "Главное правило сервировки:", options: ["Чем больше приборов, тем лучше", "Гость не должен думать, чем пользоваться", "Всё симметрично", "Минимум посуды"], correct: 1, explanation: "Сервировка должна быть интуитивной для гостя." },
        { q: "Pre-set сервировка — это:", options: ["После заказа", "До прихода гостей", "Только на банкетах", "Только фуршет"], correct: 1, explanation: "Предварительная — стол накрыт заранее." },
        { q: "Какая школа — основа современной сервировки?", options: ["Английская", "Французская", "Американская", "Японская"], correct: 1, explanation: "Французская школа — фундамент современного сервиса." },
        { q: "Вращающийся центр стола характерен для:", options: ["Японской", "Русской", "Китайской", "Французской"], correct: 2, explanation: "Lazy Susan — китайская традиция общего стола." },
      ] },
    ],
  };
  const lessonTypeLabel = (l) => l.type === "quiz" ? "Фото-тест" : "Глава";

  // ── Шапка ──
  function Head({ T, title, onBack }) {
    return (<div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 12px 10px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>{Ico.back(T.gold)}</button>
      <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: "bold", color: T.text }}>{title}</div>
    </div>);
  }

  // ── Экран: Хаб ──
  function Hub({ T, dark, openCourse, onExit }) {
    const cards = [
      { id: "serving", t: "Сервировка", s: `${COURSE.lessons.filter(l => l.type === "lesson").length} глав · фото-тесты`, icon: Ico.serving, on: true },
      { id: "wine", t: "Вина", s: "скоро", icon: Ico.wine },
      { id: "coffee", t: "Кофе", s: "скоро", icon: Ico.coffee },
      { id: "bar", t: "Бар и коктейли", s: "скоро", icon: Ico.bar },
    ];
    return (<div style={{ padding: "16px 16px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <button onClick={onExit} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", marginLeft: -4 }}>{Ico.back(T.gold)}</button>
        <div style={{ color: T.muted, fontSize: 12, letterSpacing: 2, fontFamily: "monospace" }}>РАЗДЕЛ</div>
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: "bold", color: T.text }}>Справочник</div>
      <div style={{ color: T.muted, fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>Познавательные курсы для всей команды. Пополняется со временем.</div>
      <div style={{ marginTop: 18 }}>
        {cards.map(c => (
          <div key={c.id} onClick={c.on ? openCourse : undefined} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 15px", marginBottom: 11, borderRadius: 18, background: T.card, border: `1px solid ${c.on ? T.gold + "55" : T.border}`, borderTop: `1px solid ${T.borderTop}`, cursor: c.on ? "pointer" : "default", opacity: c.on ? 1 : 0.6, backdropFilter: T.blur, WebkitBackdropFilter: T.blur }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.frameBorder}`, background: T.frame }}>{c.icon(T.gold, 26)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: "bold", color: T.text }}>{c.t}</div>
              <div style={{ color: c.on ? T.muted : T.dim, fontSize: 12.5, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>{!c.on && Ico.lock(T.dim, 12)}{c.s}</div>
            </div>
            {c.on && Ico.arrow(T.gold, 18)}
          </div>
        ))}
      </div>
    </div>);
  }

  // ── Экран: Курс ──
  function Course({ T, dark, openLesson, onBack }) {
    return (<div>
      <Head T={T} title="Справочник" onBack={onBack} />
      <div style={{ padding: "4px 16px 28px" }}>
        <div style={{ fontFamily: SERIF, fontSize: 25, fontWeight: "bold", color: T.text }}>{COURSE.title}</div>
        <div style={{ color: T.muted, fontSize: 13, marginTop: 5, lineHeight: 1.5 }}>{COURSE.subtitle}</div>
        <div style={{ marginTop: 16, marginBottom: 8, color: T.gold, fontSize: 12, letterSpacing: 1.5, fontFamily: "monospace" }}>ПРОГРАММА</div>
        {COURSE.lessons.map((l, i) => (
          <div key={l.id} onClick={() => openLesson(l)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", marginBottom: 8, borderRadius: 14, background: T.card, border: `1px solid ${T.border}`, borderTop: `1px solid ${T.borderTop}`, cursor: "pointer", backdropFilter: T.blur, WebkitBackdropFilter: T.blur }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.frameBorder}`, color: T.gold, fontSize: 12, fontWeight: "bold", fontFamily: SERIF }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: T.text, fontSize: 14, fontFamily: SERIF }}>{l.title}</div>
              <div style={{ color: T.dim, fontSize: 11, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>{l.images && Ico.cam(T.dim, 10)}<span>{lessonTypeLabel(l)}</span></div>
            </div>
            {Ico.arrow(T.gold, 15)}
          </div>
        ))}
      </div>
    </div>);
  }

  // ── Экран: Глава ──
  function Lesson({ T, dark, lesson, onBack, onNext, nextLabel }) {
    return (<div>
      <Head T={T} title={lesson.title} onBack={onBack} />
      <div style={{ padding: "8px 16px 28px" }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderTop: `1px solid ${T.borderTop}`, borderRadius: 20, padding: "16px", backdropFilter: T.blur, WebkitBackdropFilter: T.blur }}>
          {lesson.images && lesson.images.map((key, i) => (
            <div key={i} style={{ marginBottom: 14 }}><Frame T={T}>{renderIll(key, T, dark)}</Frame></div>
          ))}
          <Content text={lesson.content} T={T} />
        </div>
        {onNext && (
          <button onClick={onNext} style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 14, border: "none", background: T.gold, color: dark ? "#1b140a" : "#fff", fontSize: 15, fontWeight: "bold", fontFamily: SERIF, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>{nextLabel} {Ico.arrow(dark ? "#1b140a" : "#fff", 17)}</button>
        )}
      </div>
    </div>);
  }

  // ── Экран: Фото-тест ──
  function Quiz({ T, dark, lesson, onBack, onNext, nextLabel }) {
    const [step, setStep] = R.useState(0);
    const [pick, setPick] = R.useState(null);
    const [score, setScore] = R.useState(0);
    const [done, setDone] = R.useState(false);
    const qs = lesson.questions; const q = qs[step]; const last = step === qs.length - 1;
    if (done) return (<div>
      <Head T={T} title={lesson.title} onBack={onBack} />
      <div style={{ padding: "26px 18px", textAlign: "center" }}>
        <div style={{ margin: "0 auto 8px", width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${T.green}` }}>{Ico.check(T.green, 30)}</div>
        <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: "bold", color: T.text }}>{score} / {qs.length}</div>
        <div style={{ color: T.muted, fontSize: 14, marginTop: 6 }}>{score === qs.length ? "Отлично! Все верно" : "Неплохо — повтори главу"}</div>
        <button onClick={onNext || onBack} style={{ marginTop: 22, padding: "13px 26px", borderRadius: 14, border: "none", background: T.gold, color: dark ? "#1b140a" : "#fff", fontSize: 14.5, fontWeight: "bold", fontFamily: SERIF, cursor: "pointer" }}>{onNext ? nextLabel : "К программе курса"}</button>
      </div>
    </div>);
    return (<div>
      <Head T={T} title={lesson.title} onBack={onBack} />
      <div style={{ padding: "8px 16px 28px" }}>
        <div style={{ color: T.muted, fontSize: 12.5, fontFamily: "monospace", marginBottom: 12 }}>{step + 1} / {qs.length}</div>
        {q.img && <Frame T={T} big cap="Узнай по картинке">{renderIll(q.img, T, dark)}</Frame>}
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: "bold", color: T.text, margin: "16px 0 14px" }}>{q.q}</div>
        {q.options.map((opt, i) => {
          let bg = T.optBg, bd = T.optBorder, col = T.text, ic = null;
          if (pick !== null) { if (i === q.correct) { bg = T.green + "22"; bd = T.green; ic = Ico.check(T.green, 17); } else if (i === pick) { bg = T.red + "22"; bd = T.red; ic = Ico.x(T.red, 17); } else col = T.dim; }
          return (<div key={i} onClick={() => { if (pick === null) { setPick(i); if (i === q.correct) setScore(s => s + 1); } }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "13px 15px", marginBottom: 9, borderRadius: 13, background: bg, border: `1px solid ${bd}`, color: col, fontSize: 14.5, fontFamily: SERIF, cursor: pick === null ? "pointer" : "default" }}><span>{opt}</span>{ic}</div>);
        })}
        {pick !== null && (<div style={{ marginTop: 6, padding: "13px 15px", borderRadius: 13, background: T.frame, borderLeft: `3px solid ${T.gold}` }}>
          <div style={{ color: T.gold, fontSize: 12, fontWeight: "bold", letterSpacing: 1, fontFamily: "monospace", marginBottom: 5 }}>ПОЧЕМУ</div>
          <div style={{ color: T.muted, fontSize: 13.5, lineHeight: 1.6 }}>{q.explanation}</div>
          <button onClick={() => { if (last) setDone(true); else { setStep(s => s + 1); setPick(null); } }} style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 12, border: "none", background: T.gold, color: dark ? "#1b140a" : "#fff", fontSize: 14.5, fontWeight: "bold", fontFamily: SERIF, cursor: "pointer" }}>{last ? "Завершить" : "Дальше →"}</button>
        </div>)}
      </div>
    </div>);
  }

  // ── Корень раздела ──
  return function ReferenceSection({ dark, onExit }) {
    const T = dark ? TH.dark : TH.light;
    const [view, setView] = R.useState("hub");
    const [idx, setIdx] = R.useState(0);
    const lessons = COURSE.lessons;
    const lesson = lessons[idx];
    const openLesson = (l) => { setIdx(lessons.indexOf(l)); setView("read"); };
    const next = idx < lessons.length - 1 ? lessons[idx + 1] : null;
    const goNext = next ? () => { setIdx(idx + 1); setView("read"); } : null;
    const nextLabel = next ? (next.type === "quiz" ? "К фото-вопросам" : "Дальше") : null;

    const root = { minHeight: "calc(100vh - 130px)", background: `linear-gradient(180deg, ${T.bgTop}, ${T.bgBot})`, fontFamily: SERIF };
    if (view === "hub") return <div style={root}><Hub T={T} dark={dark} onExit={onExit} openCourse={() => setView("course")} /></div>;
    if (view === "course") return <div style={root}><Course T={T} dark={dark} openLesson={openLesson} onBack={() => setView("hub")} /></div>;
    const back = () => setView("course");
    if (lesson.type === "quiz") return <div style={root}><Quiz T={T} dark={dark} lesson={lesson} onBack={back} onNext={goNext} nextLabel={nextLabel} /></div>;
    return <div style={root}><Lesson T={T} dark={dark} lesson={lesson} onBack={back} onNext={goNext} nextLabel={nextLabel} /></div>;
  };
})();
