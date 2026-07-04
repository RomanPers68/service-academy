// ui/today.jsx
// «Сегодня» — главный экран-лента: приложение само говорит, что сделать сейчас.
// Плюс RefHubScreen — хаб «Справочник»: всё, что нужно в зале, за 2 тапа.
// Дизайн 1:1 в стиле приложения: стеклянные плашки, золото, Georgia + monospace.
// Ничего не удалено — все старые экраны живы, сюда ведут только новые «двери».

import React from "react";
import { GOLD } from "./tokens";
import { onActivate } from "../lib/utils";
import { StreakCard, MoodCheckCard, TeamMoodCard, moodPalette } from "./mood-cards";
import { ReferenceSection } from "./ReferenceSection";
import { RESTAURANT_MENUS } from "../data/menu";

// Оценка времени урока — та же формула, что в HomeScreen
const estMins = (l) => Math.max(1, Math.round((((l.content || "").length) + ((l.questions || []).length * 250) + ((l.situations || []).length * 300)) / 900));

// Новые позиции меню ресторана (isNew, младше 30 дней) — базовые + добавленные менеджером
const countNewDishes = (restaurant) => {
  if (!restaurant) return 0;
  let custom = [];
  try { custom = (JSON.parse(localStorage.getItem("sa_menu_custom") || "{}")[restaurant]) || []; } catch (e) {}
  const base = RESTAURANT_MENUS[restaurant] || [];
  return [...base, ...custom].filter(d => d.isNew && d.addedAt && Date.now() - d.addedAt < 30 * 864e5).length;
};

// ── Мини-иконки шагов (стиль как в RoleSelect: stroke-иконки золотом) ──
const STEP_SVG = {
  redo: (c, s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>),
  book: (c, s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h6v17H6a2 2 0 0 0-2 2z" /><path d="M20 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 1 2 2z" /></svg>),
  dish: (c, s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6"><circle cx="12" cy="13" r="7.5" /><circle cx="12" cy="13" r="3.2" /><path d="M2.5 13h2M19.5 13h2" strokeLinecap="round" /></svg>),
  target: (c, s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill={c} /></svg>),
  list: (c, s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v2H9z" /><path d="M8.5 12l2 2 3.5-3.5" /></svg>),
  compass: (c, s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>),
  grad: (c, s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-4 9 4-9 4-9-4z" /><path d="M7 11v4c0 1.4 2.5 2.4 5 2.4s5-1 5-2.4v-4" /></svg>),
};

const MONO = "monospace";
const SERIF = "Georgia, 'Times New Roman', serif";

// ── Экран «Сегодня» ─────────────────────────────────────────────────
export function TodayScreen({
  T, a11y, profile, role, roleObj, modules = [], completed = {}, quizDone = {},
  mistakeBank = [], streak,
  onLesson, onMistakes, onMenuTrainer, onChecklist, onDaily, onGoLearn, onReferenceLesson,
}) {
  const C = moodPalette(a11y);
  const isLeader = !!(profile && (profile.is_admin || ["manager", "senior"].includes(profile.position)));
  const hour = new Date().getHours();
  const hello = hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
  const today = new Date().toLocaleDateString("ru-RU");
  const seed = today.split(".").reduce((a, v) => a + parseInt(v), 0);

  // ── Сборка шагов дня (максимум 3) из уже существующих данных ──
  const dueMistakes = mistakeBank.filter(m => !m.due || m.due <= Date.now()).length;
  const newDishes = React.useMemo(() => countNewDishes(profile?.restaurant), [profile?.restaurant]);

  const nextLesson = React.useMemo(() => {
    for (const m of modules) {
      for (const l of (m.lessons || [])) {
        if (l.type === "result") continue;
        const done = l.type === "quiz" ? quizDone[l.id] : completed[l.id];
        if (!done) return { lesson: l, mod: m };
      }
    }
    return null;
  }, [modules, completed, quizDone]);

  const steps = React.useMemo(() => {
    const out = [];
    if (dueMistakes > 0 && onMistakes) {
      const w = dueMistakes === 1 ? "вопрос" : (dueMistakes % 10 >= 2 && dueMistakes % 10 <= 4 && (dueMistakes % 100 < 10 || dueMistakes % 100 >= 20)) ? "вопроса" : "вопросов";
      out.push({ key: "mist", icon: "redo", tag: `РАБОТА НАД ОШИБКАМИ · ${dueMistakes} ${w.toUpperCase()}`, title: "Повтори, где ошибался", sub: "Вопросы вернулись по интервалу повторения — закрепи, и они закроются", cta: "Ответить", go: onMistakes });
    }
    if (nextLesson && onLesson) {
      const tl = { lesson: "УРОК", quiz: "ТЕСТ", practice: "ПРАКТИКА", dialogue: "ДИАЛОГ" }[nextLesson.lesson.type] || "УРОК";
      out.push({ key: "les", icon: "book", tag: `${tl} ДНЯ · ≈ ${estMins(nextLesson.lesson)} МИН`, title: nextLesson.lesson.title, sub: nextLesson.mod.title, cta: "Начать", go: () => onLesson(nextLesson.lesson, nextLesson.mod) });
    }
    if (newDishes > 0 && onMenuTrainer) {
      out.push({ key: "new", icon: "dish", tag: `НОВИНКИ МЕНЮ · ${newDishes} · NEW`, title: "Новые позиции от шефа", sub: "Выучи карточки новинок — гости уже спрашивают", cta: "Учить", go: onMenuTrainer });
    } else if (onReferenceLesson) {
      const refTask = ReferenceSection.dailyTask ? ReferenceSection.dailyTask(seed) : null;
      if (refTask) out.push({ key: "ref", icon: "compass", tag: `СПРАВОЧНИК · ${refTask.type === "quiz" ? "ФОТО-ТЕСТ" : "ГЛАВА"}`, title: refTask.title, sub: "Курс «Сервировка» — маленький шаг вглубь профессии", cta: "Открыть", go: () => onReferenceLesson(refTask.id) });
    }
    return out.slice(0, 3);
  }, [dueMistakes, nextLesson, newDishes, seed, onMistakes, onLesson, onMenuTrainer, onReferenceLesson]);

  const gold = a11y ? "#8B6A30" : GOLD;
  const card = { background: C.cardBg, border: `1px solid ${C.border}`, borderTop: `1px solid ${C.top}`, boxShadow: C.shadow, borderRadius: 18, backdropFilter: a11y ? "blur(18px) saturate(128%)" : "none", WebkitBackdropFilter: a11y ? "blur(18px) saturate(128%)" : "none" };

  return (
    <div style={T.screen} className="sa-screen">
      {/* ── Шапка-приветствие ── */}
      <div style={{ padding: "18px 20px 4px" }}>
        <div style={{ color: a11y ? "#6B4E1A" : "#C8A050", fontSize: 10, letterSpacing: 4, fontFamily: MONO }}>✦ SERVICE ACADEMY</div>
        <div style={{ color: T.modTitle.color, fontSize: 23, fontFamily: SERIF, marginTop: 10, lineHeight: 1.3 }}>
          {hello}{profile ? `, ${profile.name}` : ""}.<br />
          <span style={{ color: gold }}>{steps.length === 0 ? "План на сегодня закрыт ✨" : steps.length === 1 ? "Один шаг на сегодня." : `${steps.length === 2 ? "Два шага" : "Три шага"} на сегодня.`}</span>
        </div>
        <div style={{ color: T.modSub.color, fontSize: 10.5, letterSpacing: 1.5, fontFamily: MONO, marginTop: 7, textTransform: "uppercase" }}>
          {today}{roleObj ? ` · ${roleObj.label}` : ""}{profile?.restaurant ? ` · ${profile.restaurant}` : ""}
        </div>
      </div>

      {/* ── Карточка менеджера: чек-лист смены — всегда над нитью ── */}
      {isLeader && onChecklist && (
        <div onClick={onChecklist} {...onActivate(onChecklist)} className="sa-card"
          style={{ ...card, margin: "14px 14px 0", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", border: `1px solid ${a11y ? "rgba(160,110,40,0.35)" : "rgba(210,170,70,0.4)"}` }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: a11y ? "rgba(200,150,50,0.14)" : "rgba(200,169,110,0.13)" }}>{STEP_SVG.list(gold)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: a11y ? "#7A5A20" : "rgba(200,160,80,0.7)", fontSize: 9, letterSpacing: 2, fontFamily: MONO }}>СМЕНА · ОТКРЫТИЕ / ПРЕДСМЕНКА / ЗАКРЫТИЕ</div>
            <div style={{ ...T.modTitle, fontSize: 15, marginTop: 3 }}>Чек-лист смены</div>
          </div>
          <div style={{ color: gold, fontSize: 18, flexShrink: 0 }}>›</div>
        </div>
      )}

      {/* ── Нить смены: план дня ── */}
      <div style={{ padding: "18px 14px 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 6px 12px" }}>
          <span style={{ color: T.modSub.color, fontSize: 9, letterSpacing: 3.5, fontFamily: MONO, textTransform: "uppercase" }}>Твой план на сегодня</span>
          {role && <span style={{ color: gold, fontSize: 9, letterSpacing: 2, fontFamily: MONO }}>{steps.length === 0 ? "✓ ГОТОВО" : `${steps.length} ШАГ${steps.length === 1 ? "" : "А"}`}</span>}
        </div>

        {!role ? (
          /* Роль не выбрана — одна дверь в Учёбу */
          <div onClick={onGoLearn} {...onActivate(onGoLearn)} className="sa-card sa-glass"
            style={{ ...card, padding: "18px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: a11y ? "rgba(200,150,50,0.14)" : "rgba(200,169,110,0.15)", animation: "pulse 2.4s infinite" }}>{STEP_SVG.grad(gold, 24)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ ...T.modTitle, fontSize: 16 }}>Выбери свой трек обучения</div>
              <div style={{ ...T.modSub, marginTop: 3, lineHeight: 1.5 }}>Новичок, хостес, ядро или менеджер — и здесь появится твой план на каждый день</div>
            </div>
            <div style={{ color: gold, fontSize: 20 }}>›</div>
          </div>
        ) : steps.length === 0 ? (
          <div className="sa-card" style={{ ...card, padding: "22px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>🏆</div>
            <div style={{ ...T.modTitle, fontSize: 16, marginTop: 8 }}>Всё на сегодня сделано</div>
            <div style={{ ...T.modSub, marginTop: 4, lineHeight: 1.5 }}>Хочешь больше — загляни в «Учёбу» или в «Задания дня» ниже</div>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* вертикальная нить с золотым заполнением сверху к активному шагу */}
            <div style={{ position: "absolute", left: 20, top: 20, bottom: 30, width: 2, borderRadius: 2, background: a11y ? "rgba(140,105,40,0.22)" : "rgba(210,170,70,0.16)" }} />
            {steps.map((s, i) => {
              const isNext = i === 0;
              return (
                <div key={s.key} className="sa-card" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  {/* узел на нити */}
                  <div style={{ width: 42, display: "flex", justifyContent: "center", paddingTop: 16, flexShrink: 0, zIndex: 1 }}>
                    <div style={{ width: 27, height: 27, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isNext ? (a11y ? "rgba(200,150,50,0.18)" : "rgba(200,169,110,0.18)") : (a11y ? "rgba(240,232,214,0.7)" : "#1E1810"), border: `1.5px solid ${isNext ? gold : (a11y ? "rgba(140,105,40,0.35)" : "rgba(210,170,70,0.3)")}`, animation: isNext ? "pulse 2.4s infinite" : "none" }}>
                      <span style={{ color: isNext ? gold : T.modSub.color, fontSize: 12, fontFamily: MONO }}>{i + 1}</span>
                    </div>
                  </div>
                  {/* карточка шага — стеклянная плашка modCard */}
                  <div onClick={s.go} {...onActivate(s.go)}
                    style={{ ...card, flex: 1, minWidth: 0, padding: "13px 14px", cursor: "pointer", border: isNext ? `1px solid ${a11y ? "rgba(160,110,40,0.45)" : "rgba(210,170,70,0.5)"}` : card.border }}
                    className={isNext ? "sa-glass" : undefined}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "inline-flex", flexShrink: 0 }}>{STEP_SVG[s.icon](gold, 17)}</span>
                      <span style={{ color: a11y ? "#7A5A20" : "rgba(200,160,80,0.7)", fontSize: 8.5, letterSpacing: 2, fontFamily: MONO }}>{s.tag}</span>
                    </div>
                    <div style={{ ...T.modTitle, fontSize: 16, marginTop: 7, lineHeight: 1.3 }}>{s.title}</div>
                    <div style={{ ...T.modSub, marginTop: 4, lineHeight: 1.5 }}>{s.sub}</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 10, letterSpacing: 1.5, fontFamily: MONO, color: isNext ? (a11y ? "#FFF8EC" : "#14100A") : gold, background: isNext ? gold : "transparent", border: `1px solid ${gold}`, borderRadius: 14, padding: "5px 13px" }}>
                      {s.cta.toUpperCase()} ›
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Тихий подвал: стрик, настроение, задания дня ── */}
      <div style={{ marginTop: 10 }}>
        {streak && <StreakCard streak={streak} a11y={a11y} />}
        <MoodCheckCard a11y={a11y} />
        {isLeader && <TeamMoodCard a11y={a11y} />}
        {role && onDaily && (
          <div onClick={onDaily} {...onActivate(onDaily)}
            style={{ margin: "0 14px 20px", padding: "11px 14px", borderRadius: 16, border: `1px dashed ${a11y ? "rgba(140,105,40,0.4)" : "rgba(210,170,70,0.35)"}`, display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}>
            <span style={{ display: "inline-flex", flexShrink: 0 }}>{STEP_SVG.target(T.modSub.color, 18)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: T.modSub.color, fontSize: 8.5, letterSpacing: 2, fontFamily: MONO }}>ХОЧЕШЬ ЕЩЁ · 3 ЗАДАНИЯ ДНЯ</div>
              <div style={{ color: T.modTitle.color, fontSize: 13, marginTop: 3, fontFamily: SERIF }}>Случайные задания для закрепления</div>
            </div>
            <span style={{ color: gold, fontSize: 10, fontFamily: MONO, flexShrink: 0 }}>ОТКРЫТЬ ›</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Хаб «Справочник»: всё для зала и роста — за 2 тапа ──────────────
export function RefHubScreen({
  T, a11y, profile, role,
  onGlossary, onReference, onMenuTrainer, onChecklist, onMentor,
  onCertificates, onLeaderboard, onOnboarding, onAnalytics, onContentEditor, onSearch,
}) {
  const C = moodPalette(a11y);
  const gold = a11y ? "#8B6A30" : GOLD;
  const isLeader = !!(profile && (profile.is_admin || ["manager", "senior"].includes(profile.position)));

  const Tile = ({ label, sub, icon, onClick }) => (
    <div onClick={onClick} {...onActivate(onClick)} className="sa-card"
      style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderTop: `1px solid ${C.top}`, boxShadow: C.shadow, borderRadius: 16, padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", backdropFilter: a11y ? "blur(18px) saturate(128%)" : "none", WebkitBackdropFilter: a11y ? "blur(18px) saturate(128%)" : "none" }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: a11y ? "rgba(200,150,50,0.14)" : "rgba(200,169,110,0.13)" }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...T.modTitle, fontSize: 15 }}>{label}</div>
        {sub && <div style={{ ...T.modSub, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ color: gold, fontSize: 18, flexShrink: 0 }}>›</div>
    </div>
  );
  const Sec = ({ children }) => (
    <div style={{ color: T.modSub.color, fontSize: 9, letterSpacing: 3.5, fontFamily: "monospace", textTransform: "uppercase", padding: "16px 20px 8px" }}>{children}</div>
  );
  const sw = (d) => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>);

  return (
    <div style={T.screen} className="sa-screen">
      <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: a11y ? "#6B4E1A" : "#C8A050", fontSize: 10, letterSpacing: 4, fontFamily: "monospace" }}>✦ SERVICE ACADEMY</div>
          <div style={{ color: T.modTitle.color, fontSize: 23, fontFamily: "Georgia, serif", marginTop: 8 }}>Справочник</div>
          <div style={{ ...T.modSub, marginTop: 3 }}>Всё, что нужно здесь и сейчас — в зале</div>
        </div>
        {onSearch && <button style={{ ...T.changeRoleBtn, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={onSearch}>🔍</button>}
      </div>

      <Sec>В зале сегодня</Sec>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 14px" }}>
        <Tile label="Глоссарий" sub="Термины сервиса с живыми диалогами" onClick={onGlossary}
          icon={sw(<><circle cx="12" cy="12" r="9" /><path d="M8.5 15.5v-6l3.5 4 3.5-4v6" /></>)} />
        <Tile label="Меню ресторана" sub="Карточки блюд, аллергены, тренажёр" onClick={onMenuTrainer}
          icon={sw(<><path d="M7 3v7a2 2 0 0 0 2 2h0V3" /><path d="M11 3v18" /><path d="M7 12v9" /><path d="M17 3c-1.7 0-3 2.2-3 5s1.3 5 3 5v8" /></>)} />
        <Tile label="Чек-листы смены" sub="Открытие · предсменка · закрытие" onClick={onChecklist}
          icon={sw(<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v2H9z" /><path d="M8.5 12l2 2 3.5-3.5" /></>)} />
      </div>

      <Sec>Библиотека</Sec>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 14px" }}>
        <Tile label="Справочник сервиса" sub="Сервировка, вино, школы кухонь — с фото" onClick={onReference}
          icon={sw(<><path d="M4 5a2 2 0 0 1 2-2h6v17H6a2 2 0 0 0-2 2z" /><path d="M20 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 1 2 2z" /></>)} />
      </div>

      <Sec>Твой рост</Sec>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 14px" }}>
        {onMentor && role && <Tile label="Допуск наставника" sub="Навыки, подтверждённые вживую" onClick={onMentor}
          icon={sw(<><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z" /><path d="M9.5 12l1.8 1.8 3.2-3.3" /></>)} />}
        {onCertificates && <Tile label="Экзамен и сертификаты" sub="Подтверди уровень — получи сертификат" onClick={onCertificates}
          icon={sw(<><circle cx="12" cy="8" r="5" /><path d="M9 12.8L8 22l4-2.2L16 22l-1-9.2" /></>)} />}
        {onLeaderboard && <Tile label="Рейтинг" sub="Твоё место в команде" onClick={onLeaderboard}
          icon={sw(<><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v4a5 5 0 0 1-10 0z" /><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /></>)} />}
        {onOnboarding && (role === "seasonal" || isLeader) && <Tile label={role === "seasonal" ? "Первая неделя" : "Новички: первая неделя"} sub={role === "seasonal" ? "Твой план адаптации по дням" : "Прогресс адаптации новичков"} onClick={onOnboarding}
          icon={sw(<><path d="M3 9l9-4 9 4-9 4-9-4z" /><path d="M7 11v4c0 1.4 2.5 2.4 5 2.4s5-1 5-2.4v-4" /></>)} />}
      </div>

      {isLeader && (onAnalytics || onContentEditor) && (<>
        <Sec>Менеджеру</Sec>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 14px 8px" }}>
          {onAnalytics && <Tile label="Аналитика" sub="Прогресс и результаты команды" onClick={onAnalytics}
            icon={sw(<><path d="M4 5v14h16" /><path d="M8 15l3-4 3 2 4-6" /></>)} />}
          {onContentEditor && <Tile label="Редактор контента" sub="Свои уроки и тесты для ресторана" onClick={onContentEditor}
            icon={sw(<><path d="M4 20l1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1z" /><path d="M14.5 6.5l3 3" /></>)} />}
        </div>
      </>)}

      <div style={{ height: 20 }} />
    </div>
  );
}
