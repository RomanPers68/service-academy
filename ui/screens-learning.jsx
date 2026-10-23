// ui/screens-learning.jsx
// Дом роли, модуль, урок, глоссарий, работа над ошибками.
// Вынесено из ui/screens.jsx БЕЗ изменения кода (barrel-разбиение);
// публичный API остался в ui/screens.jsx — App.jsx не менялся.

import { inkOf } from "../lib/tracks";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import React from "react";
import { createPortal, flushSync } from "react-dom";
import { SUPABASE_URL, SUPABASE_KEY, rpc, saToken, rpcSync, flushQueue, supabase } from "../api/supabase";
import { MODULES } from "../data/modules";
import { ROLES, RESTAURANTS } from "../data/roles";
import { GLOSSARY } from "../data/glossary";
import { DIALOGUES_DATA, MOOD_EMOJI_D, MOOD_COLORS_D, loadDialogues } from "../data/dialogues-lazy";
import { LOGO_SRC, LOGO_SRC_DARK } from "../assets/logo";
import { normSurname, shuffleArray, dedupeBestScores, pickRandom, shuffleSituationOptions, vibrate, onActivate, shuffleQuizOptions, encodeStartParam, decodeStartParam } from "../lib/utils";
import { sfx } from "../lib/sfx";   // v57 (Доп. 370): звуки ответов
import { MM, Mm, ROLE_SVG, UI_SVG, POS_SVG, MOD_SVG, MARKER_RE, GAME_SVG, NAV_ICONS } from "./icons";
import { Sign, TopicNo, topicNoText } from "./signs";   // v75 (Доп. 388): свои значки вместо эмодзи и ✦
import { S, A, ACCENT_SERIF } from "./styles";
import { referenceDailyTask } from "./reference-daily";
import { bookStats, countNewDishes } from "../data/reviews";
import { countUnreadPages, NewPageBanner } from "./guestbook-lite";
import { Confetti, TimerBar, SayAloud, LiquidSegment } from "./widgets";
import { crownIcon, flameIcon, trophyIcon, faceIcon } from "./icons-extra";
import { MoodCheckCard, TeamMoodCard, moodPalette } from "./mood-cards";
import { useHintOnce, HintBubble } from "./widgets";
import { hintsFor } from "../data/hints";
import { frostOf } from "./home-hubs";
import { BROWN, BROWN_GOLD, CREAM, GOLD, GOLD_SOFT, GREEN, GREEN_DARK, INK, MUTED_2, RED, RED_DARK, labelStyle } from "./tokens";
// v73 (Доп. 386): подписи и бейджи — курсивом, обычными буквами (labelStyle); счётчики «3 / 12» — моноширинным
import { LiveDialogue } from "./screens-dialogue";
import { practiceRound } from "../lib/practice-round";
import { lessonCards } from "../lib/lesson-cards";
import { missText } from "../lib/practice-mistake";
import { SitIcon } from "./table-bits";
import { iconForSituation, iconForEmoji, LEAD_EMOJI_RE as LEAD_EM_RE, ONE_EMOJI_RE as ONE_EM_RE } from "../lib/situation-icons";
// v75 (Доп. 388): эмодзи в начале реакции («🎯 Верно…», «💡 …») — не показываем, как формат «у стола»
const stripEm = (t) => String(t || "").replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "").trim();
import { ensureTableCss } from "./table-css";
import { ModuleMenu } from "./module-menu";
import { topInsetPx } from "../lib/tg-screen";   // v69 (Доп. 382): верх экрана в полноэкранном Telegram — под его кнопками
import { Flame, Wine } from "./day-emblems";   // v43: вместо свечи и стакана из ./table-bits
import { useWide, useColumn, splitAt } from "./viewport";   // v52 (Доп. 365): трек шире, глоссарий в две колонки на широком экране
import { ymd } from "../lib/streak";
import { topicShade, inkOnColor } from "../lib/topic-tint";
import { topicFreshness, freshLabel, wineLevel } from "../lib/freshness";
import { canCredit, canGold, canRefresh } from "../lib/marks";
import { QuizPlates, QuizBeads, QuizMeta, QuizRuleNote, OptLetter, quizTopic, ensureQuizCss } from "./quiz-bits";   // v71: тест с правилами на виду

// Доп. 289–292: формат «у стола» (практика, проверка после урока) — отдельный
// модуль, грузится фоном. Пока не приехал (или без сети не загрузился) —
// работает классический вид, ничего не ломается.
let tableMod = null;
let tablePromise = null;
export function loadTable() {
  if (tableMod) return Promise.resolve(tableMod);
  if (!tablePromise) tablePromise = import("./table").then((m) => (tableMod = m)).catch(() => { tablePromise = null; return null; });
  return tablePromise;
}
function useTable() {
  const [m, setM] = React.useState(tableMod);
  React.useEffect(() => {
    if (m) return undefined;
    let alive = true;
    loadTable().then((x) => { if (alive && x) setM(x); });
    return () => { alive = false; };
  }, [m]);
  return m;
}
// Доп. 298: тот же модуль «у стола» нужен App (разминка до смены, чек недели).
export const useTableModule = useTable;
const TABLE_VIEW_KEY = "sa_table_view";   // "0" — классический вид практики
const readTableView = () => { try { return localStorage.getItem(TABLE_VIEW_KEY) !== "0"; } catch (e) { return true; } };
// Доп. 310: «у стола» есть и в треках без практики — из вопросов тестов раздела
const hasPracticePool = (mod) => !!(mod && (mod.lessons || []).some((l) => l && ((l.type === "practice" && (l.situations || []).length)
  || (l.type === "quiz" && (l.questions || []).some((q) => q && !q.kind && Array.isArray(q.options) && q.options.length > 1)))));
// Доп. 293: на какой карточке остановился в уроке (по сотруднику, последние 60 уроков)
const CARD_POS_KEY = "sa_card_pos";
function readCardPos(uk, id) {
  try { const m = JSON.parse(localStorage.getItem(CARD_POS_KEY + uk) || "{}") || {}; const v = m[id] | 0; return v > 0 ? v : 0; } catch (e) { return 0; }
}
function writeCardPos(uk, id, v) {
  try {
    const k = CARD_POS_KEY + uk;
    const m = JSON.parse(localStorage.getItem(k) || "{}") || {};
    if ((m[id] | 0) === (v | 0) || (!m[id] && !(v > 0))) return;
    if (v > 0) { delete m[id]; m[id] = v; } else delete m[id];
    const keys = Object.keys(m);
    while (keys.length > 60) delete m[keys.shift()];
    localStorage.setItem(k, JSON.stringify(m));
  } catch (e) {}
}

// v59 (Доп. 372): склонение по числу — «1 вопрос», «2 вопроса», «5 вопросов»
const plural3 = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
export function MistakesScreen({ T, a11y, mistakeBank = [], onResolve, onFail, onBack, noTests = false }) {
  const gold = a11y ? "#7A5D2A" : GOLD;
  const [mkHint, mkHintDone] = useHintOnce("mistakes");
  const [mkStep, setMkStep] = React.useState(0);
  const mkSteps = hintsFor("mistakes");
  // Подсветка: шаг 1 — текст вопроса (вот что сюда попадает), шаг 2 —
  // строка «этап закрепления N из 5» (вот как работают интервалы). Не вся
  // карточка: она тянется до низа экрана, подсветка такой цели ничего не
  // выделяет, а пузырю над ней не хватает места.
  // Ссылки объявлены здесь, до раннего return, — правило хуков.
  const mkRefQ = React.useRef(null);
  const mkRefStage = React.useRef(null);
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

  const Head = (<div style={T.lessHead}><button className="sa-hit" style={T.backBtn2} aria-label="Вернуться" onClick={onBack}>‹</button><div style={T.lessHeadTitle}>Работа над ошибками</div></div>);

  if (bank.length === 0) {
    const nextDue = mistakeBank.reduce((min, m) => (m.due && m.due > nowTs && (!min || m.due < min)) ? m.due : min, null);
    const nextStr = nextDue ? new Date(nextDue).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : null;
    // v58 (Доп. 371): тестов ещё не было — не праздник «Ошибок нет» с конфетти, а что сюда попадёт
    if (noTests && waiting === 0) return (
      <div style={T.screen}>
        {Head}
        <div data-mistakes-empty="new" style={{ textAlign: "center", padding: "60px 24px", color: T.modSub.color }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, display: "flex", alignItems: "center", justifyContent: "center",
              background: a11y ? "rgba(139,106,48,0.10)" : "rgba(200,169,110,0.10)", border: `1px solid ${gold}55` }}>{UI_SVG.target(gold, 30)}</div>
          </div>
          <div style={{ ...T.bold, marginBottom: 6 }}>Пока пусто</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>
            Сюда попадут вопросы, где ошибёшься в тестах. Они вернутся через день, три и неделю, пока не запомнятся.
          </div>
        </div>
      </div>
    );
    return (
      <div style={T.screen}>
        {Head}
        <div style={{ textAlign: "center", padding: "60px 24px", color: T.modSub.color }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>{UI_SVG.checkCircle(GREEN, 44)}</div>
          <div style={{ ...T.bold, marginBottom: 6 }}>{waiting > 0 ? "Всё повторено по расписанию" : "Ошибок нет"}</div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            {waiting > 0
              ? `${waiting} ${plural3(waiting, "вопрос закрепляется", "вопроса закрепляются", "вопросов закрепляются")} по интервалам 1 → 3 → 7 → 30 дней. Следующее повторение: ${nextStr}.`   // v59: склонение по числу
              : "Вопросы, заваленные в тестах, будут попадать сюда. Прорешаешь их ещё раз и закрепишь."}
          </div>
        </div>
      </div>
    );
  }

  const answer = (i) => { if (pick !== null) return; setPick(i); vibrate(i === q.correct ? "light" : "error"); sfx(i === q.correct ? "ok" : "bad"); };   // v57: и звук
  const next = () => {
    const wasCorrect = pick === q.correct;
    setPick(null);
    if (wasCorrect) onResolve(q.q);
    else { if (onFail) onFail(q.q); setIdx(i => (i + 1) % bank.length); }
  };

  return (
    <div style={T.screen}>
      {Head}
        {mkHint && mkSteps.length ? (
          <HintBubble a11y={a11y} text={mkSteps[mkStep]} arrow="up"
            anchorRef={mkStep === 0 ? mkRefQ : mkRefStage}
            step={mkStep + 1} total={mkSteps.length}
            onNext={mkStep >= mkSteps.length - 1 ? null : () => setMkStep(v => v + 1)}
            onClose={mkHintDone} />
        ) : null}
      <div style={{ padding: "10px 18px 0" }}>
        <div style={{ ...T.secTitle, padding: "0 0 8px" }}>Слабые темы</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
          {weak.slice(0, 6).map(([name, n]) => (
            <div key={name} style={{ ...T.modSub, fontSize: 12.5, padding: "5px 10px", borderRadius: 9, border: `1px solid ${gold}55`, display: "flex", alignItems: "center", gap: 6 }}>
              <span>{name}</span><b style={{ color: gold }}>{n}</b>
            </div>
          ))}
        </div>
      </div>
      <div key={q.q} className="sa-cardpage-r" style={T.quizWrap}>
        <div ref={mkRefStage} style={T.quizProgress}>Сейчас на повторе: {bank.length} · этап закрепления {(q.stage || 0) + 1} из {5}{waiting > 0 ? ` · ${waiting} ждут своего дня` : ""}</div>
        {q.img && <img src={q.img} alt="" loading="lazy" decoding="async" style={{ width: "100%", maxHeight: 210, objectFit: "cover", borderRadius: 14, display: "block", margin: "0 0 14px" }} />}
        <div ref={mkRefQ} style={T.quizQ}>{q.q}</div>
        {q.options.map((opt, i) => {
          let st = { ...T.quizOpt, cursor: pick === null ? "pointer" : "default" };
          if (pick !== null) {
            // v57: и верхняя кромка — иначе у ответа оставалась светлая полоска сверху (React предупреждал о border + borderTop)
            if (i === q.correct) st = { ...st, background: "rgba(93,187,138,0.15)", border: "1px solid #5DBB8A", borderTop: "1px solid #5DBB8A" };
            else if (i === pick) st = { ...st, background: "rgba(224,120,120,0.15)", border: "1px solid #E07878", borderTop: "1px solid #E07878" };
            else st = { ...st, opacity: 0.5 };
          }
          return <div key={i} className="sa-opt" style={st} onClick={() => answer(i)} {...onActivate(() => answer(i))}>{opt}</div>;
        })}
        {pick !== null && q.explanation && <div style={{ ...T.note, fontStyle: "normal", borderLeft: `2px solid ${gold}`, paddingLeft: 10, marginTop: 12 }}>{q.explanation}</div>}
        {pick !== null && <button className="sa-btn" style={{ ...T.doneBtn, background: gold, width: "100%", marginTop: 12 }} onClick={next}>{pick === q.correct ? "Верно, убрать ✓" : "Дальше →"}</button>}
      </div>
    </div>
  );
}

// Этап 1 — оценка времени: ~900 знаков в минуту чтения + надбавка за вопросы и практику
export const _estMins = (l) => Math.max(1, Math.round((((l.content || "").length) + ((l.questions || []).length * 250) + ((l.situations || []).length * 300)) / 900));
export const _fmtMins = (mins) => mins < 60 ? `${mins} мин` : `${Math.floor(mins / 60)} ч ${mins % 60 ? (mins % 60) + " мин" : ""}`.trim();

// Доп. 307: какую тему трека смотрел последней (на время сессии, по ролям)
const TRACK_PAGE = new Map();
const TRACK_VIEW_KEY = "sa_track_view";   // "list" — прежний список тем
// v32 (Доп. 333): у соседних страниц те же кнопки темы, что у текущей, — только без действия
const NOOP = () => {};
const PASSIVE_ACTS = { onRefresh: NOOP, onCredit: NOOP, onGold: NOOP, onCellar: NOOP };

export function HomeScreen({ role, modules = [], completed, quizDone = {}, progress, doneCount, totalLessons, onModule, onChangeRole, T, streak = { count: 0, best: 0, last: "", days: [] }, a11y, profile, onChecklist, onOnboarding, onAnalytics, mistakeBank = [], onMistakes, customModules = [], onSearch, dayGoal = null,
  focusId = null, onPage, onLesson, nextFor, onNext, finish, onBookPage, pagerOnly = false, marks = null, topicActs = null }) {
  ensureTableCss();   // стили свечи серии (Доп. 288) и листаемого трека (Доп. 307)
  // v52 (Доп. 365): на широком экране трек шире (на компьютере и шрифт меню крупнее — ui/css.js),
  // список тем — карточками в две колонки
  const wideScr = useWide();
  useColumn(wideScr ? 820 : 0);
  // Сколько минут осталось до конца программы (по незавершённым разделам)
  const leftMins = React.useMemo(() =>
    [...modules, ...customModules].reduce((s, m) =>
      s + (m.lessons || []).filter(l => l.type !== "result").reduce((a, l) =>
        a + ((l.type === "quiz" ? quizDone[l.id] : completed[l.id]) ? 0 : _estMins(l)), 0), 0),
    [modules, customModules, completed, quizDone]);
  // ── Доп. 307: трек — меню тем, листаются свайпом; номера тем — оглавление ──
  const pages = React.useMemo(() => [...modules, ...customModules], [modules, customModules]);
  // Доп. 310: свои разделы ресторана в оглавлении — номером по порядку. v75 (Доп. 388): домик и номер вместо «✦1», «✦2»:
  // labelOf отдаёт «own2» (или «own», если свой раздел один), рисует TopicNo, словами — topicNoText («свой раздел 2»)
  const customNo = React.useMemo(() => { const map = {}; let k = 0; pages.forEach((m) => { if (m && m.custom) map[m.id] = ++k; }); return { map, n: k }; }, [pages]);
  const labelOf = (m, i) => { const d = String((m && m.tag) || "").match(/\d+/); if (d) return d[0]; if (m && m.custom) return customNo.n > 1 ? "own" + customNo.map[m.id] : "own"; return String(i + 1); };
  const isDoneL = (l) => (l.type === "quiz" ? !!quizDone[l.id] : !!completed[l.id]);
  const stepsOf = (m) => ((m && m.lessons) || []).filter((l) => l && l.type !== "result");
  const idxOf = (id) => (id ? pages.findIndex((m) => m.id === id) : -1);
  const curIdx = pages.findIndex((m) => stepsOf(m).some((l) => !isDoneL(l)));
  const [view, setView] = React.useState(() => { try { return localStorage.getItem(TRACK_VIEW_KEY) === "list" ? "list" : "pager"; } catch (e) { return "pager"; } });
  // из урока («3 из 6») и после теста — сначала меню темы, даже если выбран список
  const [forcePager, setForcePager] = React.useState(!!pagerOnly);
  const switchView = (v) => { setForcePager(false); setView(v); try { localStorage.setItem(TRACK_VIEW_KEY, v); } catch (e) {} };
  const shown = forcePager ? "pager" : view;
  const [page, setPage] = React.useState(() => {
    let i = idxOf(focusId);
    if (i < 0) i = idxOf(TRACK_PAGE.get(role.id));
    if (i < 0) i = curIdx;
    return Math.max(0, i);
  });
  const pg = Math.max(0, Math.min(page, pages.length - 1));
  const pageMod = pages[pg] || null;
  const prevMod = pg > 0 ? pages[pg - 1] : null;
  const nextMod = pg < pages.length - 1 ? pages[pg + 1] : null;
  // Страницы листаются за пальцем: текущая, а соседние видны краем (как стопка меню).
  // Палец ведёт ленту напрямую (без перерисовки на каждое движение), отпустил —
  // лента доезжает до соседней страницы или возвращается. Дальний номер — мягкое появление.
  const PEEK = 22;
  const vpRef = React.useRef(null);
  const trackRef = React.useRef(null);
  const stripRef = React.useRef(null);
  const gest = React.useRef(null);
  const settleRef = React.useRef(0);
  const [fadeId, setFadeId] = React.useState(null);
  const [swiped, setSwiped] = React.useState(() => { try { return localStorage.getItem("sa_track_swiped") === "1"; } catch (e) { return false; } });
  const [stripOver, setStripOver] = React.useState(false);
  const calmMotion = () => { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
  // ── Доп. 308: у каждой темы свой оттенок цвета трека — цвет «путешествует» от первой темы к последней ──
  const shades = React.useMemo(() => pages.map((m, i) => topicShade((m && m.color) || role.color, i, pages.length)), [pages, role.color]);
  const shadeAt = (i) => shades[i] || role.color;
  const glowOf = (c) => "radial-gradient(120% 460px at 50% -80px, " + c + (a11y ? "3D" : "52") + " 0%, " + c + "00 76%)";
  const tintARef = React.useRef(null);   // свечение текущей темы
  const tintBRef = React.useRef(null);   // свечение соседней — проявляется вместе с пальцем
  const nudgeRef = React.useRef(null);   // разовое «покачивание» ленты: подсказка, что темы листаются
  const settleT = React.useRef(0);
  const stopNudge = () => { const a = nudgeRef.current; nudgeRef.current = null; if (a) { try { a.cancel(); } catch (e) {} } };
  // ── v32 (Доп. 332): «монета» текущей темы в ленте номеров. Едет за пальцем вместе со
  //    страницей; внутри неё — копия номеров тёмными цифрами (видна только в монете), поэтому
  //    номер под монетой читается всегда, даже на полпути между темами ──
  const EASE = "cubic-bezier(.22,.8,.24,1)";
  const indMain = React.useRef(null), indMainRow = React.useRef(null);
  const indPin = React.useRef(null), indPinRow = React.useRef(null);
  const geoOf = (row) => {
    if (!row) return null;
    const btns = row.querySelectorAll(".tbp-num");
    const key = row.clientWidth + ":" + row.scrollWidth + ":" + btns.length;
    if (row.__saGeo && row.__saGeo.key === key) return row.__saGeo;
    const cells = [];
    btns.forEach((b) => { const n = b.querySelector(".n"); cells.push({ cx: b.offsetLeft + b.offsetWidth / 2, w: b.offsetWidth, lw: n ? n.offsetWidth : 10 }); });
    row.__saGeo = { key, cells };
    return row.__saGeo;
  };
  const pillW = (c) => Math.round(Math.min(c.w + 4, Math.max(24, c.lw + 12)));
  const placeInd = (pin, x, w, anim) => {
    const ind = (pin ? indPin : indMain).current, cr = (pin ? indPinRow : indMainRow).current;
    if (!ind) return;
    ind.style.transition = anim ? "transform .32s " + EASE + ",width .32s " + EASE : "none";
    ind.style.transform = "translate3d(" + x + "px,0,0)"; ind.style.width = w + "px"; ind.style.opacity = "1";
    if (cr) { cr.style.transition = anim ? "transform .32s " + EASE : "none"; cr.style.transform = "translate3d(" + (-x) + "px,0,0)"; }
  };
  const indAt = (pin, from, to, p, anim) => {
    const row = pin ? pinNumsRef.current : stripRef.current;
    const g = geoOf(row); if (!g || !g.cells.length) return;
    const lim = (i) => Math.max(0, Math.min(g.cells.length - 1, i));
    const a = g.cells[lim(from)], b = g.cells[lim(to)] || a;
    const wa = pillW(a), wb = pillW(b), w = wa + (wb - wa) * p, cx = a.cx + (b.cx - a.cx) * p;
    const maxX = Math.max(0, (row.scrollWidth || 0) - w);
    placeInd(pin, Math.max(0, Math.min(maxX, cx - w / 2)), w, anim);
  };
  // тёмные цифры внутри монеты — точно над своими номерами
  const syncCopy = (pin) => {
    const row = pin ? pinNumsRef.current : stripRef.current, cr = (pin ? indPinRow : indMainRow).current;
    const g = geoOf(row); if (!g || !cr) return;
    [...cr.children].forEach((s, i) => { const c = g.cells[i]; if (c) s.style.left = c.cx + "px"; });
  };
  // v33 (Доп. 340): где лента сейчас и кадр её возврата на место
  const xRef = React.useRef(0);
  const backRef = React.useRef(0);
  const stopBack = () => { if (backRef.current) { try { cancelAnimationFrame(backRef.current); } catch (e) {} backRef.current = 0; } };
  const setX = (x, animate, skipInd) => {
    const el = trackRef.current; if (!el) return;
    xRef.current = x;
    el.style.transition = animate ? "transform .32s " + EASE : "none";
    el.style.transform = x ? "translate3d(" + x + "px,0,0)" : "";
    // монета — к соседней теме ровно на ту же долю, на какую сдвинута страница
    if (!skipInd) {
      const nI = x < 0 && nextMod ? pg + 1 : x > 0 && prevMod ? pg - 1 : pg;
      const pI = nI !== pg ? Math.min(1, Math.abs(x) / dist()) : 0;
      indAt(false, pg, nI, pI, animate); indAt(true, pg, nI, pI, animate);
    }
    // закладки соседних тем проявляются и гаснут вместе с движением (без вспышек после свайпа)
    try {
      el.querySelectorAll(".tbp-tab[data-k]").forEach((b) => {
        const pos = Number(b.getAttribute("data-k")) + x / dist();
        const o = b.getAttribute("data-side") === "next" ? Math.max(0, Math.min(1, pos)) : Math.max(0, Math.min(1, -pos));
        b.style.transition = animate ? "opacity .32s " + EASE : "none";
        b.style.opacity = String(o);
      });
    } catch (e) {}
    // свечение цвета темы перетекает в цвет соседней — ровно на столько, на сколько сдвинута страница
    const ta = tintARef.current, tb = tintBRef.current;
    if (ta && tb) {
      const ni = x < 0 && nextMod ? pg + 1 : x > 0 && prevMod ? pg - 1 : -1;
      const p = ni >= 0 ? Math.min(1, Math.abs(x) / dist()) : 0;
      const tr = animate ? "opacity .32s cubic-bezier(.22,.8,.24,1)" : "none";
      ta.style.transition = tr; tb.style.transition = tr;
      if (ni >= 0) { const g = glowOf(shadeAt(ni)); if (tb.getAttribute("data-g") !== g) { tb.style.background = g; tb.setAttribute("data-g", g); } }
      tb.style.opacity = String(p); ta.style.opacity = String(1 - p);
    }
  };
  const dist = () => Math.max(1, ((vpRef.current && vpRef.current.offsetWidth) || 360) - PEEK);
  const setXRef = React.useRef(null); setXRef.current = setX;   // свежий setX после flushSync
  // v33 (Доп. 340): лента возвращается на место кадрами — так же, как её ведёт палец. Раньше —
  // CSS-переходом к «без сдвига», и на iPhone страница на это время пропадала (оставались только
  // кружки шагов): потянул последнюю тему дальше конца — меню исчезло и вернулось через полсекунды
  const settleBack = () => {
    stopBack();
    const x0 = xRef.current;
    if (!x0 || Math.abs(x0) < 0.5 || calmMotion() || typeof requestAnimationFrame !== "function") { setX(0, false); return; }
    const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
    const t0 = now(), D = Math.min(320, 200 + Math.abs(x0) * 0.5);
    const step = () => {
      const p = Math.min(1, (now() - t0) / D);
      if (p < 1) { setX(x0 * Math.pow(1 - p, 3), false); backRef.current = requestAnimationFrame(step); }
      else { backRef.current = 0; setX(0, false); }
    };
    backRef.current = requestAnimationFrame(step);
  };
  // высота прежней страницы — чтобы новая (короче или длиннее) не дёргала всё, что ниже, а плавно подстроилась
  const holdRef = React.useRef(0);
  const hTimer = React.useRef(0);
  const holdH = () => { try { holdRef.current = (vpRef.current && vpRef.current.offsetHeight) || 0; } catch (e) { holdRef.current = 0; } };
  const commitStep = (d) => { clearTimeout(settleT.current); settleRef.current = 0; setFadeId(null); holdH(); setPage(Math.max(0, Math.min(pages.length - 1, pg + d))); };
  // новая текущая страница уже стоит там, где закончилась анимация, — ленту в ноль до отрисовки
  const farRef = React.useRef(false);   // v32: дальний переход (тап по номеру) — монета едет плавно
  React.useLayoutEffect(() => {
    stopBack();
    setX(0, false, true);
    syncCopy(false); syncCopy(true);
    const far = farRef.current && !calmMotion(); farRef.current = false;
    indAt(false, pg, pg, 0, far); indAt(true, pg, pg, 0, far);
    const vp = vpRef.current, from = holdRef.current;
    holdRef.current = 0;
    if (!vp || !from || calmMotion()) return;
    clearTimeout(hTimer.current);
    vp.style.transition = "none"; vp.style.height = "";
    const to = vp.offsetHeight;   // естественная высота новой страницы (с полями меню)
    if (Math.abs(from - to) < 8) { vp.style.transition = ""; return; }
    vp.style.height = from + "px";
    void vp.offsetHeight;   // зафиксировать старую высоту и только потом ехать к новой
    vp.style.transition = "height .3s cubic-bezier(.22,.8,.24,1)"; vp.style.height = to + "px";
    hTimer.current = setTimeout(() => { const v = vpRef.current; if (v) { v.style.height = ""; v.style.transition = ""; } }, 360);
  }, [pg]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => () => { clearTimeout(hTimer.current); clearTimeout(settleT.current); stopBack(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const slide = (d) => {
    stopNudge();
    stopBack();
    if ((d > 0 && !nextMod) || (d < 0 && !prevMod)) { settleBack(); return; }
    if (calmMotion()) { commitStep(d); return; }
    settleRef.current = d;
    setX(-d * dist(), true);
    // страховка: если конец анимации не пришёл (вкладка в фоне и т. п.) — всё равно перейти
    clearTimeout(settleT.current);
    settleT.current = setTimeout(() => { if (settleRef.current === d) commitStep(d); }, 460);
  };
  const onTrackEnd = (e) => {
    if (e.target !== trackRef.current || e.propertyName !== "transform") return;
    if (settleRef.current) commitStep(settleRef.current);
  };
  const markSwiped = () => { if (!swiped) { setSwiped(true); try { localStorage.setItem("sa_track_swiped", "1"); } catch (e) {} } };
  React.useEffect(() => { const i = idxOf(focusId); if (i >= 0 && i !== pg) { farRef.current = true; setFadeId(pages[i].id); setPage(i); } }, [focusId, pages]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!pageMod) return;
    TRACK_PAGE.set(role.id, pageMod.id);
    if (onPage && pageMod.id !== focusId) onPage(pageMod);
    // номер темы — в поле зрения ленты номеров (только по горизонтали, страницу не дёргаем)
    try {
      const st = stripRef.current, el = st && st.children[pg];
      if (st && el && st.scrollWidth > st.clientWidth + 1) st.scrollTo({ left: Math.max(0, el.offsetLeft - st.clientWidth / 2 + el.offsetWidth / 2), behavior: calmMotion() ? "auto" : "smooth" });
    } catch (e) {}
    // листал внизу длинного меню — подняться к началу новой темы (номера тем снова на своём месте)
    try {
      const vp = vpRef.current, sw = stripWrapRef.current; if (!vp) return;
      const inset = topInsetPx();
      if (vp.getBoundingClientRect().top < inset) {
        const top = (sw ? sw.getBoundingClientRect().top - 8 : vp.getBoundingClientRect().top - 12) - inset;
        scrollerOf(vp).scrollBy({ top, behavior: calmMotion() ? "auto" : "smooth" });
      }
    } catch (e) {}
  }, [pg, pageMod && pageMod.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const st = stripRef.current; if (!st) return undefined;
    // v32: ширина поменялась — монета и тёмные цифры заново встают над своими номерами
    const check = () => { setStripOver(st.scrollWidth > st.clientWidth + 1); requestAnimationFrame(() => { syncCopy(false); syncCopy(true); if (!settleRef.current && !gest.current && !backRef.current) { indAt(false, pg, pg, 0, false); indAt(true, pg, pg, 0, false); } }); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [pages.length, shown, stripOver, pg]);   // eslint-disable-line react-hooks/exhaustive-deps
  const goTo = (i) => {
    const n = Math.max(0, Math.min(pages.length - 1, i));
    if (n === pg || settleRef.current) return;
    vibrate("light");
    stopNudge();
    if (Math.abs(n - pg) === 1) { slide(n - pg); return; }
    farRef.current = true;
    setFadeId(pages[n].id); holdH(); setPage(n);
  };
  const openPage = (i) => { setFadeId(null); setPage(i); switchView("pager"); vibrate("light"); };
  const onTouchStart = (e) => {
    stopNudge();
    const t = e.touches && e.touches[0];
    // второй палец: жест бросаем — и сдвинутая лента возвращается на место (v33, ревью)
    if (!t || e.touches.length !== 1) { const had = gest.current; gest.current = null; if (had && !settleRef.current) settleBack(); return; }
    let base = 0, b0 = 0;   // base — откуда считать палец; b0 — где лента на экране в начале жеста
    if (backRef.current) {
      // v33: лента ещё возвращается на место — ловим её там, где она сейчас (у края лента
      // «упирается» втрое, поэтому и отсчёт — в тех же единицах, без рывка)
      stopBack();
      const cur = xRef.current;
      if (Math.abs(cur) < 1) setX(0, false);
      else { b0 = cur; base = (cur < 0 && !nextMod) || (cur > 0 && !prevMod) ? cur / 0.3 : cur; }
    } else if (settleRef.current) {
      // v32: листают дальше, пока страница ещё доезжает, — не ждём конца анимации: переход
      // фиксируем сразу и продолжаем жест с того места, где лента сейчас (без рывка)
      const d = settleRef.current, el = trackRef.current;
      let cur = -d * dist();
      try { const st = getComputedStyle(el).transform; if (st && st !== "none") cur = new DOMMatrixReadOnly(st).m41; } catch (err) {}
      try { flushSync(() => commitStep(d)); } catch (err) { commitStep(d); }
      base = cur + d * dist();
      if (Math.abs(base) < 1) base = 0;
      if (base) (setXRef.current || setX)(base, false);   // v33 (ревью): setX уже новой страницы (соседи, монета)
      b0 = base;
    }
    gest.current = { x: t.clientX, y: t.clientY, t: Date.now(), axis: null, dx: b0, base, b0 };
  };
  const onTouchMove = (e) => {
    const g = gest.current, t = e.touches && e.touches[0];
    if (!g || !t) return;
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) g.axis = "x";
      else if (Math.abs(dy) > 10) { g.axis = "y"; if (g.base) { g.base = 0; settleBack(); } }
      else return;
    }
    if (g.axis !== "x") return;
    const raw = g.base + dx;
    g.dx = (raw > 0 && !prevMod) || (raw < 0 && !nextMod) ? raw * 0.3 : raw;   // у края — упругое сопротивление
    setX(g.dx, false);
  };
  const onTouchEnd = () => {
    const g = gest.current; gest.current = null;
    if (!g) return;
    if (g.axis !== "x") { if (g.base) settleBack(); return; }   // перехватили на лету и отпустили — доехать
    const moved = g.dx - (g.b0 || 0);   // сколько прошла лента за этот жест (на экране)
    const v = moved / Math.max(1, Date.now() - g.t);
    // далеко потянул — или быстро смахнул (но не случайное подрагивание пальца); у смахивания
    // направление — по движению пальца (v32: и когда страницу перехватили на лету)
    const fling = Math.abs(v) > 0.45 && Math.abs(moved) > 28;
    const dir = fling ? (v < 0 ? 1 : -1) : Math.abs(g.dx) > dist() * 0.22 ? (g.dx < 0 ? 1 : -1) : 0;
    if (dir === 1 && nextMod) { vibrate("light"); markSwiped(); slide(1); }
    else if (dir === -1 && prevMod) { vibrate("light"); markSwiped(); slide(-1); }
    else settleBack();
  };
  // Telegram на компьютере: два пальца по тачпаду влево/вправо — тоже листают (одна тема за жест);
  // стрелки ← → (и Home/End) на номерах — соседняя тема, как во вкладках
  const wheelRef = React.useRef(null);
  wheelRef.current = (d) => {
    if (settleRef.current || (d > 0 && !nextMod) || (d < 0 && !prevMod)) return;
    markSwiped(); slide(d);
  };
  React.useEffect(() => {
    const el = vpRef.current; if (!el) return undefined;
    let acc = 0, lock = false, idle = 0;
    const onWheel = (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();   // и браузер не уходит «назад» жестом
      clearTimeout(idle); idle = setTimeout(() => { acc = 0; lock = false; }, 220);
      if (lock) return;
      acc += e.deltaMode === 1 ? e.deltaX * 16 : e.deltaMode === 2 ? e.deltaX * 400 : e.deltaX;
      if (Math.abs(acc) > 60) { lock = true; const d = acc > 0 ? 1 : -1; acc = 0; if (wheelRef.current) wheelRef.current(d); }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { el.removeEventListener("wheel", onWheel); clearTimeout(idle); };
  }, [shown, !!pageMod]);   // eslint-disable-line react-hooks/exhaustive-deps
  const onNumsKey = (e) => {
    const k = e.key;
    const n = k === "ArrowRight" ? pg + 1 : k === "ArrowLeft" ? pg - 1 : k === "Home" ? 0 : k === "End" ? pages.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const i = Math.max(0, Math.min(pages.length - 1, n));
    goTo(i);
    try { const b = stripRef.current && stripRef.current.children[i]; if (b) b.focus(); } catch (err) {}
  };
  // ── Доп. 308: номера прилипают сверху тонкой полосой с названием темы, когда меню прокручено ──
  const stripWrapRef = React.useRef(null);
  // слои поверх страницы (прилипшие номера, «К уроку») — только в браузере, после первой отрисовки
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  const pinRef = React.useRef(null);
  const pinNumsRef = React.useRef(null);
  const [pinned, setPinned] = React.useState(false);
  // прилипшая полоса появилась — её монета сразу на своём номере
  React.useLayoutEffect(() => { if (pinned) { syncCopy(true); indAt(true, pg, pg, 0, false); } }, [pinned]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const el = stripWrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setPinned(false); return undefined; }
    const io = new IntersectionObserver((ents) => {
      const en = ents[ents.length - 1];
      if (en) setPinned(!en.isIntersecting && en.boundingClientRect.bottom <= topInsetPx() + 1);   // v69: верх — под кнопками Telegram
    }, { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, !!pageMod]);   // eslint-disable-line react-hooks/exhaustive-deps
  const scrollerOf = (el) => {
    let sc = el && el.parentElement;
    while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    return sc && sc !== document.body ? sc : (document.scrollingElement || document.documentElement);
  };
  const toTop = () => { try { scrollerOf(vpRef.current).scrollTo({ top: 0, behavior: calmMotion() ? "auto" : "smooth" }); } catch (e) {} };
  // в прилипшей полосе текущий номер тоже на виду (если номера не помещаются)
  React.useEffect(() => {
    const st = pinNumsRef.current, el = st && st.children[pg];
    try { if (st && el && st.scrollWidth > st.clientWidth + 1) st.scrollLeft = Math.max(0, el.offsetLeft - st.clientWidth / 2 + el.offsetWidth / 2); } catch (e) {}
  }, [pinned, pg]);   // eslint-disable-line react-hooks/exhaustive-deps
  // ── Доп. 308: название темы по долгому нажатию на номер (палец можно вести по номерам);
  //    на компьютере — при наведении, с клавиатуры — при фокусе ──
  const [peek, setPeek] = React.useState(null);   // { i, pinned, soft }
  const peekRef = React.useRef(null);
  const peekT = React.useRef(0);
  const peekG = React.useRef(null);
  const hoverT = React.useRef(0);
  const noClickUntil = React.useRef(0);
  const numClick = (i) => { if (Date.now() < noClickUntil.current) return; setPeek(null); goTo(i); };
  const peekStart = (e, i, pin) => {
    clearTimeout(peekT.current);
    const t = e.touches && e.touches[0];
    if (!t || e.touches.length > 1) { peekG.current = null; return; }
    const row = pin ? pinNumsRef.current : stripRef.current;
    peekG.current = { x: t.clientX, y: t.clientY, i, pin, on: false, out: false, drag: false, sl: row ? row.scrollLeft : 0 };
    peekT.current = setTimeout(() => {
      const g = peekG.current; if (!g) return;
      g.on = true; vibrate("light"); setPeek({ i: g.i, pinned: g.pin });
    }, 380);
  };
  const peekCancel = () => { clearTimeout(peekT.current); const g = peekG.current; peekG.current = null; if (g && g.on) setPeek(null); };
  const peekEnd = (e) => {
    clearTimeout(peekT.current);
    const g = peekG.current; peekG.current = null;
    if (g && g.drag) { noClickUntil.current = Date.now() + 400; return; }   // ленту номеров прокрутили пальцем
    if (!g || !g.on) return;   // обычный тап — дальше сработает нажатие
    if (e.cancelable) e.preventDefault();
    noClickUntil.current = Date.now() + 700;
    setPeek(null);
    if (!g.out) goTo(g.i);   // отпустил на номере — туда и перешли; увёл палец с номеров — передумал
  };
  React.useEffect(() => {
    const els = [stripRef.current, pinNumsRef.current].filter(Boolean);
    if (!els.length) return undefined;
    const move = (e) => {
      const g = peekG.current, t = e.touches && e.touches[0];
      if (!g || !t) return;
      if (!g.on) {
        // номера не помещаются — ленту прокручиваем пальцем сами (в приложении жесты вбок отданы нам)
        const dx = t.clientX - g.x, dy = t.clientY - g.y;
        const r0 = g.pin ? pinNumsRef.current : stripRef.current;
        if (!g.drag && r0 && r0.scrollWidth > r0.clientWidth + 1 && Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy)) { g.drag = true; clearTimeout(peekT.current); }
        if (g.drag) { if (e.cancelable) e.preventDefault(); if (r0) r0.scrollLeft = g.sl - dx; return; }
        if (Math.abs(dx) > 9 || Math.abs(dy) > 9) { clearTimeout(peekT.current); peekG.current = null; }
        return;
      }
      if (e.cancelable) e.preventDefault();   // ведёт по номерам — страница стоит
      const hit = document.elementFromPoint(t.clientX, t.clientY);
      const b = hit && hit.closest ? hit.closest(".tbp-num") : null;
      const row = g.pin ? pinNumsRef.current : stripRef.current;
      const i = b && b.parentElement === row ? Number(b.getAttribute("data-i")) : -1;
      if (i >= 0 && (i !== g.i || g.out)) { if (i !== g.i) vibrate("light"); g.i = i; g.out = false; setPeek({ i, pinned: g.pin }); }
      else if (i < 0 && !g.out) { g.out = true; setPeek(null); }
    };
    els.forEach((el) => el.addEventListener("touchmove", move, { passive: false }));
    return () => els.forEach((el) => el.removeEventListener("touchmove", move));
  }, [shown, pinned, !!pageMod]);   // eslint-disable-line react-hooks/exhaustive-deps
  const canHover = () => { try { return window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) { return false; } };
  const hoverIn = (i, pin) => { if (!canHover()) return; clearTimeout(hoverT.current); hoverT.current = setTimeout(() => setPeek({ i, pinned: pin, soft: true }), 260); };
  const hoverOut = () => { clearTimeout(hoverT.current); setPeek((p) => (p && p.soft ? null : p)); };
  const focusIn = (e, i) => { try { if (e.target.matches(":focus-visible")) setPeek({ i, pinned: false, soft: true }); } catch (err) {} };
  React.useEffect(() => () => { clearTimeout(peekT.current); clearTimeout(hoverT.current); }, []);
  // подпись ставим над своим номером и не даём ей вылезти за край
  React.useLayoutEffect(() => {
    const bub = peekRef.current; if (!peek || !bub) return;
    const host = peek.pinned ? pinRef.current : stripWrapRef.current;
    const row = peek.pinned ? pinNumsRef.current : stripRef.current;
    const btn = row && row.querySelector('.tbp-num[data-i="' + peek.i + '"]');
    if (!host || !btn) return;
    const hr = host.getBoundingClientRect(), br = btn.getBoundingClientRect();
    const c = br.left + br.width / 2 - hr.left;
    const w = bub.offsetWidth;
    const x = Math.max(4, Math.min(hr.width - w - 4, c - w / 2));
    bub.style.left = x + "px";
    const ar = bub.querySelector(".ar"); if (ar) ar.style.left = (c - x) + "px";
  }, [peek, pinned]);   // eslint-disable-line react-hooks/exhaustive-deps
  const stepsWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? "шаг" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? "шага" : "шагов");
  // v30 (Доп. 313, 315, 316): свежесть, зачёт на опыт и золото темы
  const topicOf = (m) => {
    if (!marks || !m) return null;
    const fr = canRefresh(m);
    const f = fr ? topicFreshness(m, marks.fresh, completed, quizDone) : null;
    return { f, credit: (marks.credit || {})[m.id] || null, gold: (marks.gold || {})[m.id] || null,
      canCredit: canCredit(m), canGold: canGold(m), canRefresh: fr, tried: !!(topicActs && topicActs.tried && topicActs.tried(m.id)) };
  };
  const statOf = (m) => {
    const st = stepsOf(m); const dn = st.filter(isDoneL).length;
    if (!st.length) return "";
    if (dn >= st.length) { const tp = topicOf(m); return tp && tp.gold ? "золотая тема" : tp && tp.f && tp.f.level !== "fresh" ? freshLabel(tp.f) : "тема пройдена ✓"; }
    const left = st.filter((l) => !isDoneL(l)).reduce((a, l) => a + _estMins(l), 0);
    return (dn ? "пройдено " + dn + " из " + st.length : st.length + " " + stepsWord(st.length)) + " · ≈ " + _fmtMins(left);
  };
  const peekBubble = (pin) => {
    if (!peek || !!peek.pinned !== !!pin) return null;
    const m = pages[peek.i]; if (!m) return null;
    const line = statOf(m);
    return (
      <div className="tbp-peek" ref={peekRef} role="tooltip">
        <i className="ar" aria-hidden="true" />
        <b><TopicNo label={labelOf(m, peek.i)} />{" · " + m.title}</b>
        {line ? <span>{line}</span> : null}
      </div>
    );
  };
  // ── Доп. 308: разовое «покачивание» ленты вместо подписи «листай свайпом» (пока ни разу не листал, до 3 раз) ──
  React.useEffect(() => {
    if (shown !== "pager" || swiped || pages.length < 2 || calmMotion()) return undefined;
    let n = 0; try { n = Number(localStorage.getItem("sa_track_nudge") || 0) || 0; } catch (e) {}
    if (n >= 3) return undefined;
    const t = setTimeout(() => {
      const el = trackRef.current;
      if (!el || typeof el.animate !== "function" || settleRef.current || gest.current || backRef.current) return;
      const d = pg < pages.length - 1 ? -1 : 1;
      try { localStorage.setItem("sa_track_nudge", String(n + 1)); } catch (e) {}
      try {
        nudgeRef.current = el.animate([{ transform: "translate3d(0,0,0)" }, { transform: "translate3d(" + (d * 34) + "px,0,0)", offset: 0.42 }, { transform: "translate3d(0,0,0)" }],
          { duration: 1000, easing: "cubic-bezier(.3,.6,.3,1)" });
        nudgeRef.current.onfinish = () => { nudgeRef.current = null; };
      } catch (e) {}
    }, 1200);
    return () => clearTimeout(t);
  }, [shown]);   // eslint-disable-line react-hooks/exhaustive-deps
  // ── Доп. 308: «К уроку» — ушёл смотреть другие темы, одно касание возвращает туда, где остановился ──
  const GO_WORD = { lesson: "К уроку", quiz: "К тесту", practice: "К практике", dialogue: "К диалогу", build: "К сборке" };
  const curMod = curIdx >= 0 ? pages[curIdx] : null;
  const curStep = curMod ? stepsOf(curMod).find((l) => !isDoneL(l)) || null : null;
  const showGo = shown === "pager" && !!pageMod && !!curStep && pg !== curIdx && !!onLesson;
  const goWord = curStep ? (GO_WORD[curStep.type] || "К уроку") : "";
  const goCur = () => { vibrate("light"); if (onLesson && curStep) onLesson(curStep, curMod); };
  // соседние страницы — только картинка: ни фокуса, ни нажатий (атрибут inert ставим напрямую)
  const inertRef = (el) => { if (el) { try { el.setAttribute("inert", ""); } catch (e) {} } };
  const liveRef = (el) => { if (el) { try { el.removeAttribute("inert"); el.removeAttribute("aria-hidden"); } catch (e) {} } };
  // тема пройдена и дальше — другая тема, или пройдена вся программа: под меню карточка «Дальше»/экзамен
  const nextCardFor = (m) => {
    if (!nextFor || !m) return false;
    const nx = nextFor(m); const st = stepsOf(m);
    return !nx || (st.length > 0 && st.every(isDoneL) && !!nx.mod && nx.mod.id !== m.id);
  };
  const menuFor = (m, passive) => {
    const i = pages.indexOf(m);
    const nx = i >= 0 && i < pages.length - 1 ? pages[i + 1] : null;
    return (
      <>
        {/* v32 (Доп. 333): соседняя страница рисуется тем же составом, что и текущая (кнопки
            «Освежить», «Я это умею — зачёт на опыт», «Раунд мастера» — те же, только не нажимаются),
            поэтому после свайпа ничего не появляется и не сдвигается */}
        <ModuleMenu embedded passive={passive} mod={m} tint={i >= 0 ? shadeAt(i) : null} completed={completed} quizDone={quizDone} a11y={a11y} estMins={_estMins} fmtMins={_fmtMins}
          onLesson={passive ? () => {} : (l) => (onLesson ? onLesson(l, m) : onModule && onModule(m))}
          topic={topicOf(m)} acts={topicActs ? (passive ? PASSIVE_ACTS : { onRefresh: () => topicActs.refresh(m), onCredit: () => topicActs.credit(m), onGold: () => topicActs.gold(m), onCellar: topicActs.cellar }) : null} />
        {/* Доп. 308: в конце меню — тихая ссылка на следующую тему (для тех, кто листает вниз, а не вбок) */}
        {nx && !nextCardFor(m) ? (
          <button type="button" className="tbp-nextlink" tabIndex={passive ? -1 : undefined} onClick={passive ? undefined : () => goTo(i + 1)}>
            <span>Дальше:</span><b><TopicNo label={labelOf(nx, i + 1)} />{" · " + nx.title}</b><span className="ar" aria-hidden="true">›</span>
          </button>
        ) : null}
      </>
    );
  };
  const listIcon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>;
  // ряд номеров: в странице (оглавление, доступное с клавиатуры) и копия в прилипшей полосе.
  // v32 (Доп. 332): ряд — в стеклянной капсуле, текущая тема — под золотой «монетой» (последний
  // ребёнок ряда, поверх номеров; внутри — те же номера тёмными цифрами)
  const numsRow = (pin) => (
    <div className="tbp-cap">
    <div className={"tbp-nums" + (stripOver ? " over" : "")} ref={pin ? pinNumsRef : stripRef} role={pin ? undefined : "tablist"} aria-label={pin ? undefined : "Темы трека"}
      onKeyDown={pin ? undefined : onNumsKey} onTouchEnd={peekEnd} onTouchCancel={peekCancel}>
      {pages.map((m, i) => {
        const st = stepsOf(m); const dn = st.filter(isDoneL).length;
        const tp = st.length && dn >= st.length ? topicOf(m) : null;
        const fz = tp && tp.f ? (tp.f.updated ? " upd" : tp.f.level === "faded" ? " fade2" : tp.f.level === "fading" ? " fade1" : "") : "";
        const cls = "tbp-num" + (i === pg ? " on" : "") + (st.length && dn >= st.length ? " done" : dn > 0 ? " part" : "") + (i === curIdx ? " cur" : "") + (tp && tp.gold ? " gold" : fz);
        return (
          <button key={m.id} type="button" role={pin ? undefined : "tab"} aria-selected={pin ? undefined : i === pg} tabIndex={pin ? -1 : (i === pg ? 0 : -1)} className={cls} data-i={i}
            style={{ "--dot": shadeAt(i) }} onClick={() => numClick(i)} onTouchStart={(e) => peekStart(e, i, pin)} onContextMenu={(e) => e.preventDefault()}
            onMouseEnter={() => hoverIn(i, pin)} onMouseLeave={hoverOut} onFocus={pin ? undefined : (e) => focusIn(e, i)} onBlur={pin ? undefined : hoverOut}
            aria-label={pin ? undefined : (m.tag ? m.tag + " · " : "") + m.title + " · пройдено " + dn + " из " + st.length + (i === curIdx ? " · ты здесь" : "") + (tp && tp.gold ? " · золотая тема" : tp && tp.f && tp.f.level !== "fresh" ? " · " + freshLabel(tp.f) : "")}>
            <span className="n"><TopicNo label={labelOf(m, i)} /></span>
            {tp && tp.f && !tp.gold && !tp.f.updated
              ? <i className="wl" aria-hidden="true"><b style={{ height: Math.round(wineLevel(tp.f) * 100) + "%" }} /></i>
              : <i className="st" aria-hidden="true" />}
          </button>
        );
      })}
      <i className="tbp-ind" ref={pin ? indPin : indMain} aria-hidden="true">
        <span className="tbp-ind-row" ref={pin ? indPinRow : indMainRow}>{pages.map((m, i) => { const lb = labelOf(m, i), own = lb.startsWith("own"); return <span key={m.id} data-n={own ? lb.slice(3) : lb} data-own={own ? "" : undefined} />; })}</span>
      </i>
    </div>
    </div>
  );
  const dueN = mistakeBank.filter(m => !m.due || m.due <= Date.now()).length;
  const sub = a11y ? "#6E5C3C" : "#9A865F";
  const gold = a11y ? "#7A5D2A" : GOLD;
  const chip = { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, color: gold, flexShrink: 0 };
  const pageNext = pageMod && nextFor ? nextFor(pageMod) : null;
  // v32 (Доп. 333): окно страниц трека — k = −2…2 от текущей
  const win = [];
  for (let k = -2; k <= 2; k++) { const i = pg + k; if (i >= 0 && i < pages.length) win.push({ m: pages[i], k, i }); }
  const pageDone = !!pageMod && stepsOf(pageMod).length > 0 && stepsOf(pageMod).every(isDoneL);
  const showNext = !!nextFor && !!pageMod && (!pageNext || (pageDone && pageNext.mod && pageNext.mod.id !== pageMod.id));
  return (
    <div style={T.screen} className="sa-screen tbp-root">
      {/* Шапка: роль (и «Сменить»), поиск; под ней — прогресс трека, пламя серии и бокал цели (v43; было — свеча и стакан) */}
      <div style={{ padding: "34px 14px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ ...T.homeRoleBadge, background: role.color + "22", borderColor: role.color + "66", minWidth: 0, flex: "0 1 auto", overflow: "hidden" }}>
            <span style={{ display:"inline-flex", alignItems:"center", flexShrink: 0 }}>{ROLE_SVG[role.id] ? ROLE_SVG[role.id](role.color, 18) : role.icon}</span>
            <span style={{ color: inkOf(role.color, a11y), fontSize:14, fontWeight:"bold", flexShrink: 0 }}>{role.label}</span>
            <span style={{ color: a11y ? "#665337" : "#c8b898", fontSize:12.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{role.sublabel}</span>
            {role.beta && <span style={{ ...labelStyle(12.5), padding:"1px 6px", borderRadius:999, color:role.color, border:`1px solid ${role.color}66`, opacity:0.85, lineHeight:1.4, flexShrink: 0 }}>бета</span>}
          </div>
          <span style={{ flex: 1 }} />
          {onSearch && <button style={{ ...T.changeRoleBtn, display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink: 0 }} onClick={onSearch} aria-label="Поиск">{GAME_SVG.search(a11y ? "#5a4a35" : "#c8b898", 15)}</button>}
          <button style={{ ...T.changeRoleBtn, flexShrink: 0 }} onClick={onChangeRole}>Сменить</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9 }}>
          <span style={{ fontSize: 11.5, color: sub, flexShrink: 0 }}>{doneCount} из {totalLessons} · {leftMins > 0 ? `≈ ${_fmtMins(leftMins)}` : "пройдено"}</span>
          <span style={{ flex: 1, height: 3, borderRadius: 999, overflow: "hidden", background: a11y ? "rgba(120,90,30,0.14)" : "rgba(255,255,255,0.07)" }}>
            <i style={{ display: "block", height: "100%", borderRadius: 999, width: `${Math.max(progress, progress > 0 ? 2 : 0)}%`, background: role.color }} />
          </span>
          {streak && streak.count > 0 ? (
            // Доп. 288: свеча серии — горит, когда сегодня уже занимался; выходной по графику её не гасит
            <span className="tbv" title={streak.last === ymd(new Date()) ? "Сегодня занимался, свеча горит" : "Пройди урок, и свеча загорится"} style={chip}>
              {/* v43 (Доп. 356): пламя и бокал — как в табличке на главной */}
              <Flame s={16} lit={streak.last === ymd(new Date())} a11y={a11y} />{streak.count}
            </span>
          ) : null}
          {dayGoal && dayGoal.goal ? (
            // Доп. 298: стакан «цель дня» — сколько шагов сегодня из цели
            <span className="tbv" title={"Цель дня: " + Math.min(dayGoal.steps || 0, dayGoal.goal) + " из " + dayGoal.goal} style={chip}>
              <Wine s={16} pct={Math.min(1, (dayGoal.steps || 0) / dayGoal.goal)} a11y={a11y} />{Math.min(dayGoal.steps || 0, dayGoal.goal)}/{dayGoal.goal}
            </span>
          ) : null}
        </div>
      </div>

      {shown === "pager" && pageMod ? (
        <>
          {/* Доп. 308: мягкое свечение цвета темы за шапкой — при листании перетекает в цвет соседней */}
          <div className="tbp-tint" aria-hidden="true">
            <i key={fadeId === pageMod.id ? "f" + pageMod.id : "a"} ref={tintARef} className={"a" + (fadeId === pageMod.id ? " in" : "")} style={{ background: glowOf(shadeAt(pg)) }} />
            <i ref={tintBRef} className="b" />
          </div>
          {/* Оглавление — номера тем, как страницы меню: золотой номер — где ты сейчас, точка под
              номером (цвета темы) — пройдена (залита) или начата (кружок). Тап — сразу к теме;
              долгое нажатие — название темы (Доп. 308) */}
          <div className="tbp-strip" ref={stripWrapRef} style={{ "--role": role.color, "--role-ink": inkOf(role.color, a11y) }}>
            {numsRow(false)}
            <button type="button" className="tbp-view" onClick={() => switchView("list")} aria-label="Все темы списком">{listIcon}</button>
            {peekBubble(false)}
          </div>
          {dueN > 0 && onMistakes ? (
            <div role="button" tabIndex={0} onClick={onMistakes} {...onActivate(onMistakes)} className="tbp-mist">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
              <span style={{ flex: 1, minWidth: 0 }}>Работа над ошибками · {dueN} {dueN % 10 === 1 && dueN % 100 !== 11 ? "вопрос" : (dueN % 10 >= 2 && dueN % 10 <= 4 && (dueN % 100 < 10 || dueN % 100 >= 20)) ? "вопроса" : "вопросов"} на повтор</span>
              <span aria-hidden="true">›</span>
            </div>
          ) : null}
          {onBookPage ? <NewPageBanner T={T} mod={pageMod} completed={completed} quizDone={quizDone} onOpen={() => onBookPage(pageMod)} /> : null}
          <div className="tbp-vp" ref={vpRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
            <div className="tbp-track" ref={trackRef} onTransitionEnd={onTrackEnd}>
              {/* v32 (Доп. 333): окно из пяти страниц — текущая, соседние (видны краем) и ещё по
                  одной за ними: после свайпа новая соседняя уже нарисована и не «выпрыгивает» */}
              {win.map(({ m, k }) => (
                <div key={m.id} data-k={k} className={k === 0 ? "tbp-cur" + (fadeId === m.id ? " tbp-fade" : "") : "tbp-side" + (k === -1 ? " prev" : k === 1 ? " next" : " far")}
                  style={k ? { "--k": k } : undefined} aria-hidden={k ? "true" : undefined} ref={k ? inertRef : liveRef}>{menuFor(m, k !== 0)}</div>
              ))}
              {/* v36 (Доп. 345): у первой и последней темы — пустые места окна, чтобы лента всегда была
                  шириной в пять страниц, как посреди трека. Окно из трёх страниц (≈1250 px) — ровно между
                  порогами WebKit на iPhone (1024 и 1280 px — смотря сколько свободной памяти): пока лента
                  едет, слой то и дело менялся на «плиточный» и обратно — и меню пропадало до остановки */}
              {[-2, -1, 1, 2].filter((k) => !win.some((w) => w.k === k)).map((k) => (
                <div key={"gap" + k} className="tbp-side tbp-gap" data-gap={k} style={{ "--k": k }} aria-hidden="true" ref={inertRef} />
              ))}
              {/* Доп. 308: закладки соседних тем — их номера на видимом крае, цветом темы; тап — листнуть.
                  v32: у каждой страницы окна своя пара закладок — при листании одна гаснет, другая
                  проявляется вместе с движением страницы (раньше менялись рывком после свайпа) */}
              {win.flatMap(({ m, k, i }) => ["prev", "next"].map((side) => {
                const on = (side === "next" && k === 1) || (side === "prev" && k === -1);
                const op = side === "next" ? Math.max(0, Math.min(1, k)) : Math.max(0, Math.min(1, -k));
                return (
                  <button key={"tab-" + side + "-" + m.id} type="button" data-k={k} data-side={side}
                    className={"tbp-tab " + (side === "prev" ? "pv" : "nx") + (on ? " " + side : "")}
                    onClick={on ? () => goTo(i) : undefined} tabIndex={on ? undefined : -1} aria-hidden={on ? undefined : "true"}
                    aria-label={on ? (side === "prev" ? "Предыдущая тема: " : "Следующая тема: ") + topicNoText(labelOf(m, i)) + " · " + m.title : undefined}
                    style={{ "--k": k, opacity: op, pointerEvents: on ? "auto" : "none", background: shadeAt(i), color: inkOnColor(shadeAt(i)) }}><TopicNo label={labelOf(m, i)} /></button>
                );
              }))}
            </div>
          </div>
          {showNext ? <ModuleNextCard mod={pageMod} next={pageNext} onNext={onNext} finish={finish} T={T} a11y={a11y} /> : null}
          {/* Доп. 308: номера прилипают сверху, когда меню прокручено; название темы — тап к началу */}
          {pinned && mounted ? createPortal(
            <div className="tbp-pin" ref={pinRef} aria-hidden="true" style={{ "--role": role.color, "--role-ink": inkOf(role.color, a11y) }}>
              <div className="tbp-strip">
                {numsRow(true)}
                <button type="button" className="tbp-view" tabIndex={-1} onClick={() => switchView("list")}>{listIcon}</button>
              </div>
              <button type="button" className="tbp-pin-t" tabIndex={-1} onClick={toTop}><b><TopicNo label={labelOf(pageMod, pg)} />{" · " + pageMod.title}</b>{statOf(pageMod) ? " · " + statOf(pageMod) : ""}</button>
              {peekBubble(true)}
            </div>, document.body) : null}
          {/* Доп. 308: смотришь другую тему — «К уроку: …» над нижним меню, одно касание — туда, где остановился */}
          {showGo && mounted ? createPortal(
            <button type="button" className="tbp-go" onClick={goCur} aria-label={goWord + ": " + curStep.title}>
              <span className="ic" aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg></span>
              <span className="k">{goWord + ":"}</span><span className="t">{curStep.title}</span>
            </button>, document.body) : null}
        </>
      ) : (
        <>
      {/* ── Точка входа ──────────────────────────────────────────────────
          Тот же вид, что у карточки трека на экране роли, — чтобы два главных
          экрана говорили на одном языке. Первая версия была с кнопкой во всю
          ширину: карточка раздувалась и съедала воздух. Здесь иконка с кольцом
          прогресса, значок типа шага и кнопка сбоку по размеру задачи. */}
      {(() => {
        const all = [...modules, ...customModules];
        const nx = all.find(m => {
          const tot = m.lessons.filter(l => l.type !== "result").length;
          const dn = m.lessons.filter(l => l.type !== "result" && (l.type === "quiz" ? quizDone[l.id] : completed[l.id])).length;
          return tot > 0 && dn < tot;
        });
        if (!nx) return null;
        const lessons = (nx.lessons || []).filter(l => l.type !== "result");
        const step = lessons.find(l => !(l.type === "quiz" ? quizDone[l.id] : completed[l.id])) || lessons[0];
        const dn = lessons.filter(l => (l.type === "quiz" ? quizDone[l.id] : completed[l.id])).length;
        const pct = lessons.length ? Math.round(dn / lessons.length * 100) : 0;
        const started = dn > 0;
        // Что за шаг: тест, практика или урок. Приставку из названия убираем —
        // её говорит значок, и в одной строке они спорили.
        const kind = !step ? null : step.type === "quiz" ? "тест"
          : (step.situations && step.situations.length) ? "практика" : "урок";
        const title = String(step?.title || nx.title).replace(/^(Тест|Практика|Урок)\s*[:·—-]\s*/i, "")
          .replace(/^./, c => c.toUpperCase());
        const qn = (step?.questions || []).length;
        const meta = [qn ? `${qn} ${qn === 1 ? "вопрос" : qn < 5 ? "вопроса" : "вопросов"}` : null,
          step ? `≈ ${_estMins(step)} мин` : null,
          started ? `пройдено ${pct}%` : null].filter(Boolean).join(" · ");
        const RC = inkOf(nx.color || role.color, a11y);   // читаемо и в светлой теме (правка 170)
        const go = () => onModule(nx);
        return (
          <div onClick={go} {...onActivate(go)} className="sa-card"
            style={{ margin:"6px 14px 10px", padding:"12px 13px", borderRadius:18, cursor:"pointer",
              display:"flex", alignItems:"center", gap:12,
              background: a11y
                ? "linear-gradient(180deg,rgba(236,214,166,0.5),rgba(250,242,222,0.72))"
                : "linear-gradient(180deg,rgba(214,178,102,0.17),rgba(214,178,102,0.05))",
              border:`1px solid ${a11y ? "rgba(150,112,40,0.42)" : "rgba(214,178,102,0.4)"}`,
              borderTop:`1px solid ${a11y ? "rgba(175,135,50,0.58)" : "rgba(226,190,120,0.46)"}`,
              boxShadow: a11y
                ? "inset 0 0 22px rgba(255,255,255,0.6), inset 0 1px 0 rgba(255,255,255,0.95)"
                : "inset 0 0 22px rgba(255,240,205,0.08), inset 0 1px 0 rgba(255,255,255,0.13)" }}>
            <div style={{ position:"relative", width:48, height:48, flexShrink:0, display:"grid", placeItems:"center" }}>
              <svg width="48" height="48" viewBox="0 0 48 48" style={{ position:"absolute", inset:0 }}>
                <circle cx="24" cy="24" r="22" fill="none" strokeWidth="2.5"
                  stroke={a11y ? "rgba(120,90,30,0.2)" : "rgba(200,169,110,0.2)"} />
                <circle cx="24" cy="24" r="22" fill="none" stroke={RC} strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray={(2 * Math.PI * 22 * pct / 100) + " " + (2 * Math.PI * 22)}
                  transform="rotate(-90 24 24)" />
              </svg>
              <span style={{ position:"relative", display:"inline-flex" }}>
                {MOD_SVG[nx.icon] ? MOD_SVG[nx.icon](RC, 21) : null}
              </span>
              {kind ? (
                <span style={{ position:"absolute", bottom:-4, left:"50%", transform:"translateX(-50%)",
                  ...labelStyle(12.5), whiteSpace:"nowrap",
                  color:RC, padding:"1px 6px", borderRadius:999,
                  background: a11y ? "#F7F0E0" : "#1A1409", border:`1px solid ${RC}66` }}>{kind}</span>
              ) : null}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"Georgia, serif", fontSize:16, lineHeight:1.25,
                color: a11y ? "#2A2113" : "#EFE4C8", overflow:"hidden",
                display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{title}</div>
              <div style={{ fontSize:11.5, color: a11y ? "#6E5C3C" : "#9C8760", marginTop:3, lineHeight:1.4 }}>{meta}</div>
            </div>
            <div style={{ flexShrink:0, padding:"9px 15px", borderRadius:999,
              fontFamily:"Georgia, serif", fontSize:13, fontWeight:"bold", color:"#1A1008",
              background:`linear-gradient(180deg,#E4C88C,${GOLD})` }}>
              {started ? "Дальше" : "Начать"}
            </div>
          </div>
        );
      })()}

      {mistakeBank.filter(m => !m.due || m.due <= Date.now()).length > 0 && onMistakes && (() => {
        const _g = a11y ? "#7A5D2A" : GOLD;
        const _n = mistakeBank.filter(m => !m.due || m.due <= Date.now()).length;
        const _w = _n === 1 ? "вопрос" : (_n % 10 >= 2 && _n % 10 <= 4 && (_n % 100 < 10 || _n % 100 >= 20)) ? "вопроса" : "вопросов";
        return (
          <div onClick={onMistakes} {...onActivate(onMistakes)} style={{ ...T.modCard, margin:"0 14px 12px" }}>
            {/* v73 (Доп. 386): цветная полоска слева убрана — золото и так у значка */}
            <div style={T.modIcon}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={_g} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={T.modTitle}>Работа над ошибками</div>
              <div style={T.modSub}>{_n} {_w} на повтор</div>
            </div>
            <div style={T.modArrow}>{"\u203a"}</div>
          </div>
        );
      })()}
      <div style={{ ...T.secTitle, display: "flex", alignItems: "center", gap: 8 }}><span style={{ flex: 1 }}>Программа обучения</span>
        <button type="button" className="sa-btn" onClick={() => switchView("pager")} aria-label="Листать темы по одной" style={{ textTransform: "none", letterSpacing: 0.4, fontFamily: "Georgia, serif", fontSize: 12, padding: "4px 10px", borderRadius: 999, cursor: "pointer", background: "transparent", border: `1px solid ${role.color}77`, color: inkOf(role.color, a11y) }}>листать ›</button></div>
      <div style={T.modList} className="sa-stagger sa-g2">
        {pages.map((m, mi) => {
          const lessonsDone = m.lessons.filter(l => l.type !== "quiz" && l.type !== "result" && completed[l.id]).length;
          const quizzesDone = m.lessons.filter(l => l.type === "quiz" && quizDone[l.id]).length;
          const done = lessonsDone + quizzesDone;
          const total = m.lessons.filter(l => l.type !== "result").length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <div key={m.id} className="sa-card sa-glass" style={T.modCard} onClick={() => openPage(mi)} {...onActivate(() => openPage(mi))}>
              {/* v73 (Доп. 386): цветная полоска слева убрана — цвет темы и так у значка, подписи и процента */}
              <div style={{ ...T.modIcon, display:"flex", alignItems:"center", justifyContent:"center" }}>{(MOD_SVG[m.icon] || UI_SVG.book)(m.color, 28)}</div>
              <div style={T.modInfo}>
                <div style={{ ...T.modTag, color: inkOf(m.color, a11y) }}>{m.tag} · ≈ {_fmtMins((m.lessons || []).filter(l => l.type !== "result").reduce((a, l) => a + _estMins(l), 0))}</div>
                <div style={T.modTitle}>{m.title}</div>
                <div style={T.modSub}>{m.subtitle}</div>
              </div>
              <div style={T.modRight}>
                <div style={{ color: pct===100 ? "#4CAF50" : inkOf(m.color, a11y), fontSize:12.5, fontWeight:"bold" }}>{pct===100?"✓":`${pct}%`}</div>
                <div style={T.modArrow}>›</div>
              </div>
            </div>
          );
        })}
      </div>
        </>
      )}
      {/* Настроение и пульс команды — под списком. Штука приятная, но не то,
          ради чего открывают приложение: наверху она отодвигала урок за сгиб. */}
      <MoodCheckCard a11y={a11y} />
      {(["manager","senior"].includes(profile?.position) || profile?.is_admin) && <TeamMoodCard a11y={a11y} />}
      {/* Доп. 308: место под плавающей «К уроку», чтобы она не закрывала низ страницы */}
      {showGo && mounted ? <div aria-hidden="true" style={{ height: 52, flexShrink: 0 }} /> : null}
    </div>
  );
}

// Доп. 196–197: карточка под меню раздела — следующий шаг (не искать глазами, куда идти
// дальше) или, когда программа роли пройдена, экзамен → сертификат → следующая ступень.
// Доп. 307: вынесена из ModuleScreen без изменений — её же показывает листаемый трек.
export function ModuleNextCard({ mod, next, onNext, finish, T, a11y = false }) {
  const frost = frostOf(a11y);
  const goldA = a11y ? "#7A5D2A" : GOLD;
  if (!next) {
    // Доп. 197: конец программы роли — не подпись, а действие: экзамен → сертификат → следующая ступень
    const f = finish || {};
    const go = () => f.onGo && f.onGo();
    return (
      <div className="sa-card" style={{ ...frost, margin: "10px 16px 96px", padding: "14px 16px", borderRadius: 18 }}>
        <div style={{ ...labelStyle(13.5), color: goldA, marginBottom: 4 }}>{f.eyebrow || "Программа роли пройдена"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: T.modTitle.color, lineHeight: 1.25 }}>{f.title || "Все уроки пройдены"}</div>
            {f.sub && <div style={{ fontSize: 12.5, color: T.modSub.color, marginTop: 2, lineHeight: 1.45 }}>{f.sub}</div>}
          </div>
        </div>
        {f.cta && <button className="sa-btn" onClick={go} style={{ marginTop: 12, width: "100%", border: "none", cursor: "pointer", padding: "12px 16px", borderRadius: 999, background: `linear-gradient(180deg,#E4C88C,${GOLD})`, color: "#1a160f", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", boxShadow: "0 6px 18px rgba(214,178,102,0.32)" }}>{f.cta}</button>}
        {f.secondary && <div onClick={(e) => { e.stopPropagation(); f.secondary.onGo && f.secondary.onGo(); }} style={{ marginTop: 10, fontSize: 12.5, color: goldA, cursor: "pointer" }}>{f.secondary.label} ›</div>}
      </div>
    );
  }
  const same = next.mod && mod && next.mod.id === mod.id;
  const go = () => onNext && onNext(next);
  const lessons = (next.mod && next.mod.lessons ? next.mod.lessons : []).filter(l => l.type !== "result");
  const pos = lessons.findIndex(l => l.id === next.lesson.id) + 1;
  const kind = next.lesson.type === "quiz" ? "Тест" : next.lesson.type === "dialogue" ? "Живой диалог" : next.lesson.type === "practice" ? "Практика" : next.lesson.type === "build" ? "Сборка" : "Урок";
  // Доп. 202: кнопка на всю ширину под названием — не прячется под кнопкой Наставника;
  // снизу воздух, чтобы кнопка Наставника висела над пустотой, а не над карточкой
  // Доп. 203: компактно — одна строка: номер · название с подписью · капсула
  return (
    <div className="sa-card" onClick={go} {...onActivate(go)} style={{ ...frost, margin: "10px 16px 96px", padding: "10px 12px 10px 12px", borderRadius: 18, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, border: `1px solid ${goldA}66`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", fontSize: 14, color: goldA }}>{pos || "→"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...labelStyle(13), color: goldA, marginBottom: 2 }}>{same ? "Следующий шаг" : `Дальше · ${(next.mod && next.mod.title) || ""}`}</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 14, color: T.modTitle.color, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{next.lesson.title}</div>
        <div style={{ fontSize: 11, color: T.modSub.color, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kind}{next.lesson.minutes ? ` · ${next.lesson.minutes} мин` : ""}{pos && lessons.length ? ` · ${pos} из ${lessons.length}` : ""}</div>
      </div>
      <span style={{ padding: "9px 14px", borderRadius: 999, flexShrink: 0, background: `linear-gradient(180deg,#E4C88C,${GOLD})`, color: "#1a160f", fontFamily: "Georgia, serif", fontSize: 12.5, fontWeight: "bold", whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(214,178,102,0.32)" }}>Перейти ›</span>
    </div>
  );

}

export function ModuleScreen({ mod, completed, quizDone = {}, onBack, onLesson, T, next, onNext, finish, a11y = false }) {
  // Доп. 292: модуль (раздел) — «меню раздела»: строки с отточием, «пройден» от руки,
  // тест под сургучом, текущий шаг — карточка. Прежняя информация вся на месте
  // (см. ui/module-menu.jsx); код формата «у стола» начинает грузиться фоном уже здесь.
  React.useEffect(() => { loadTable(); }, []);
  useColumn(useWide() ? 820 : 0);   // v52 (Доп. 365): меню раздела — как страница трека
  return (
    <div style={T.screen} className="sa-slide-r">
      <ModuleMenu mod={mod} completed={completed} quizDone={quizDone} onLesson={onLesson} onBack={onBack} a11y={a11y} estMins={_estMins} fmtMins={_fmtMins} />
      {/* Доп. 196: следующий шаг — не искать глазами, куда идти дальше */}
      <ModuleNextCard mod={mod} next={next} onNext={onNext} finish={finish} T={T} a11y={a11y} />
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

export function LessonScreen({ lesson, color="#C8A96E", onBack, onComplete, quizState, onQuiz, practiceState, setPracticeState, onPracticeChoice, onPracticeNext, T, done, next, onNext, onToModule, skipped, onSkipped,
  mod = null, profile = null, streak = null, mistakeBank = [], onMistakes, onResolveMistake, onFailMistake, wasCompleted = false,
  modules = null, mentorName = "", goal = null, onAskMentor, onActivity, onContents }) {
  // Доп. 299–303: повтор пройденного — меньше нажатий (автопереход), шпаргалка из уроков
  // раздела, подпись настоящего наставника, стакан «цель дня» в чеке, вопрос Наставнику.
  const replay = !!wasCompleted;
  // Доп. 306: где я в разделе — «2 из 6»; тап открывает содержание раздела
  const stepInfo = React.useMemo(() => {
    const ls = ((mod && mod.lessons) || []).filter((l) => l && l.type !== "result");
    const i = ls.findIndex((l) => l.id === lesson.id);
    return i >= 0 ? { i: i + 1, n: ls.length } : null;
  }, [mod, lesson.id]);
  // Доп. 289–293: формат «у стола» — практика и «закрепить у стола» после урока
  const tb = useTable();
  const tbAtMount = React.useRef(!!tableMod).current;
  const [tableView, setTableView] = React.useState(readTableView);
  const startedTable = React.useRef(false);
  const [checkOpen, setCheckOpen] = React.useState(false);
  const switchView = (v) => { setTableView(v); startedTable.current = v; try { localStorage.setItem(TABLE_VIEW_KEY, v ? "1" : "0"); } catch (e) {} };
  // Доп. 293: урок открывается на той карточке, где остановился (официанта отвлекают)
  const posUk = profile ? "_" + profile.name + "_" + (profile.surname || "") : "";
  // пройденный урок (и раньше, и сейчас) открывается с начала и место не запоминает
  const posOff = lesson.type !== "lesson" || !!done || !!wasCompleted;
  const [resumeFrom, setResumeFrom] = React.useState(() => (posOff ? 0 : readCardPos(posUk, lesson.id)));
  // Доп. 205: после «Урок пройден ✓» кнопка становится «Далее: …» — без шторок и затемнений
  const DoneNext = () => {
    if (!done) return null;
    const kind = next ? (next.lesson.type === "quiz" ? "Тест" : next.lesson.type === "dialogue" ? "Живой диалог" : next.lesson.type === "practice" ? "Практика" : next.lesson.type === "build" ? "Сборка" : "Урок") : "";
    return (
      <div className="sa-fadein" style={{ marginTop: 12 }}>
        {next ? (
          <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background: color, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px" }} onClick={onNext}>
            <span style={{ textAlign: "left", minWidth: 0 }}>
              <span style={{ ...labelStyle(13), display: "block", opacity: 0.85 }}>Пройдено ✓ · {next.other ? `дальше · ${next.mod.title}` : "далее"}</span>
              <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70vw" }}>{next.lesson.title}{next.done ? " ✓" : ""}</span>
            </span>
            <span style={{ fontSize: 21, flexShrink: 0 }}>›</span>
          </button>
        ) : (
          <button className="sa-btn" style={{ ...T.doneBtn, background: color, width: "100%" }} onClick={onNext}>{next === null ? "Дальше ›" : "К модулю ›"}</button>
        )}
        <div onClick={onToModule} {...onActivate(onToModule)} style={{ textAlign: "center", fontSize: 12.5, color: T.modSub.color, marginTop: 10, cursor: "pointer" }}>К модулю{next ? ` · ${kind}${next.lesson.minutes ? " · " + next.lesson.minutes + " мин" : ""}` : ""}</div>
        {skipped && (
          <div onClick={onSkipped} {...onActivate(onSkipped)} style={{ marginTop: 12, padding: "10px 12px", borderRadius: 14, border: `1px solid ${color}44`, background: `${color}12`, cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ color, flexShrink: 0, display: "inline-flex" }}><Sign n="flag" s={15} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ ...labelStyle(13.5), display: "block", color }}>{skipped.count > 1 ? `Позади ${skipped.count} непройденных` : "Позади остался"}</span>
              <span style={{ display: "block", fontSize: 14, color: T.modTitle.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{skipped.lesson.title}</span>
            </span>
            <span style={{ padding: "7px 12px", borderRadius: 999, border: `1px solid ${color}88`, color, fontSize: 12.5, fontWeight: "bold", whiteSpace: "nowrap", flexShrink: 0 }}>Пройти ›</span>
          </div>
        )}
      </div>
    );
  };
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
  const [cardIdx, setCardIdx] = React.useState(resumeFrom);
  // Мгновенная обратная связь в тесте — по образцу «Работы над ошибками»:
  // выбранный вариант подсвечивается (и правильный тоже), затем автопереход.
  // Раньше тап молча перекидывал на следующий вопрос — тест был «слепым».
  const [reveal, setReveal] = React.useState(null);
  const revealTimer = React.useRef(null);
  // Ответ, который уже подсвечен, но ещё не засчитан: засчитывается через 0,6 с (верный)
  // или 1,4 с (неверный — чтобы увидеть правильный). Раньше выход в это окно ответ просто
  // терял, а верный вариант к тому моменту был уже показан — так и работала лазейка
  // «ошибся → увидел верный → „‹“»: ни в тест, ни на сервер ошибка не попадала.
  // Теперь при выходе подсвеченный ответ засчитывается сразу — до onBack.
  const pendingPick = React.useRef(null);
  const onQuizRef = React.useRef(onQuiz); onQuizRef.current = onQuiz;
  const commitPending = () => {
    if (pendingPick.current === null) return;
    const i = pendingPick.current; pendingPick.current = null;
    if (revealTimer.current) { clearTimeout(revealTimer.current); revealTimer.current = null; }
    try { if (onQuizRef.current) onQuizRef.current(i); } catch (e) {}
  };
  // и при любом другом уходе с экрана (вкладка внизу и т. п.)
  React.useEffect(() => () => { commitPending(); }, []);
  React.useEffect(() => { setReveal(null); }, [lesson.id]);
  const [cardDir, setCardDir] = React.useState("r"); // направление перелистывания для анимации
  const touchRef = React.useRef(null);
  const firstLessonId = React.useRef(lesson.id);
  React.useEffect(() => {
    if (firstLessonId.current === lesson.id) return;   // первый показ — позиция уже взята при создании
    firstLessonId.current = lesson.id;
    const p = posOff ? 0 : readCardPos(posUk, lesson.id);
    setCardIdx(p); setResumeFrom(p);
  }, [lesson.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (lesson.type !== "lesson") return;
    writeCardPos(posUk, lesson.id, posOff ? 0 : cardIdx);   // пройден — в следующий раз с начала
  }, [cardIdx, posOff, lesson.id, lesson.type, posUk]);
  // Делим контент на смысловые карточки: новые начинаются на заголовках/стикерах,
  // лимит ~700 знаков, а короткие «хвосты» приклеиваются к предыдущей — мысль не обрывается
  // деление на карточки — lib/lesson-cards.js (Доп. 299: общее с «Подсмотреть в уроке»)
  const cards = React.useMemo(() => lessonCards(lesson.content), [lesson.content]);
  // сохранённая позиция могла пережить правку урока — не дальше последней карточки
  React.useEffect(() => { if (cardIdx > cards.length - 1) { setCardIdx(Math.max(0, cards.length - 1)); setResumeFrom(0); } }, [cards.length, cardIdx]);
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
      const stripped = line.replace(MARKER_RE, "").replace(LEAD_EM_RE, "");   // v75: и прочие эмодзи в начале строки
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
  // Доп. 289: конец урока — «Закрепить у стола» (две ситуации из практики раздела по теме
  // урока + повтор ошибки, если подошёл срок) или, как раньше, «Урок пройден ✓».
  const canCheck = !!tb && lesson.type === "lesson" && hasPracticePool(mod);
  const dueN = canCheck ? (mistakeBank || []).filter((m) => m && (!m.due || m.due <= Date.now())).length : 0;
  const FinishLesson = ({ mt }) => {
    if (!canCheck) return <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background: color, width: "100%", marginTop: mt }} onClick={onComplete}>Урок пройден ✓</button>;
    return (
      <div style={{ marginTop: mt }}>
        <button className="sa-btn sa-btn-pulse" data-tb-check="" style={{ ...T.doneBtn, background: color, width: "100%", marginTop: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }} onClick={() => { vibrate("light"); setCheckOpen(true); }}>
          <span>Закрепить у стола</span><span style={{ ...labelStyle(13), opacity: 0.85 }}>· 2 ситуации{dueN ? " + повтор" : ""}</span>
        </button>
        <button className="sa-btn" style={{ ...T.doneBtn, width: "100%", marginTop: 10, background: "transparent", color: T.modTitle?.color || "#F0E8D8", border: `1px solid ${color}88`, boxShadow: "none" }} onClick={onComplete}>Урок пройден ✓</button>
        <div style={{ textAlign: "center", fontSize: 12, color: T.modSub.color, marginTop: 8, lineHeight: 1.45 }}>Ситуации берутся из практики этого раздела, по теме урока. Можно пропустить.</div>
      </div>
    );
  };
  const resumeBanner = cardMode && resumeFrom > 0 && cardIdx === resumeFrom && !done ? (
    <div className="sa-fadein" style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 10px", padding: "8px 12px", borderRadius: 12, border: `1px dashed ${color}77`, fontSize: 12.5, color: T.modSub.color }}>
      <span style={{ flex: 1, minWidth: 0 }}>Продолжаем с того же места: карточка {Math.min(cardIdx, cards.length - 1) + 1} из {cards.length}</span>
      <span role="button" tabIndex={0} onClick={() => { setCardDir("l"); setCardIdx(0); setResumeFrom(0); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCardDir("l"); setCardIdx(0); setResumeFrom(0); } }} style={{ color: inkOf(color, !!T.a11y), fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap" }}>С начала</span>
    </div>
  ) : null;
  // v57 (Доп. 370): тест сдан — тихий колокольчик и отдача (выключатели — «Аккаунт» → «Настройки»)
  const quizPassed = lesson.type === "quiz" && quizState && quizState.done && !quizState.blocked
    && (quizState.answers || []).filter((a) => a.isCorrect).length >= (lesson.questions || []).length * 0.7;
  React.useEffect(() => { if (quizPassed) { sfx("done"); vibrate("success"); } }, [quizPassed]);
  const checkLayer = checkOpen && tb ? (
    <tb.TableCheck lesson={lesson} mod={mod} modules={modules} color={color} a11y={!!T.a11y} profile={profile} streak={streak} next={next} mistakeBank={mistakeBank}
      replay={replay} mentorName={mentorName} goal={goal} onAskMentor={onAskMentor} onActivity={onActivity}
      onComplete={onComplete} onNext={onNext} onClose={() => setCheckOpen(false)} onMistakes={onMistakes} onResolveMistake={onResolveMistake} onFailMistake={onFailMistake} />
  ) : null;
  if (lesson.type === "lesson") {
    return (
      <div style={{ ...T.screen, position: "relative" }}>
        <div style={T.lessHead}><button className="sa-hit" style={T.backBtn2} aria-label="Вернуться" onClick={onBack}>‹</button><div style={T.lessHeadTitle}>{lesson.title}</div>{onContents && stepInfo ? (
          <button onClick={onContents} aria-label={"Содержание раздела: шаг " + stepInfo.i + " из " + stepInfo.n} data-sa-contents=""
            style={{ flexShrink: 0, background: "transparent", border: `1px solid ${color}77`, borderRadius: 999, padding: "4px 10px", color: inkOf(color, !!T.a11y), fontFamily: "monospace", fontSize: 11, letterSpacing: 0.5, cursor: "pointer", whiteSpace: "nowrap" }}>{stepInfo.i} из {stepInfo.n}</button>
        ) : null}<button onClick={() => { dismissModeHint(); setCardIdx(0); setCardMode(v => { try { localStorage.setItem("sa_lesson_cards", v ? "0" : "1"); } catch (e) {} return !v; }); }} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px 10px", flexShrink: 0, display: "inline-flex", alignItems: "center", borderRadius: 12, animation: modeHint ? "pulse 2s infinite" : "none" }} aria-label={cardMode ? "Читать лентой" : "Читать карточками"}>{cardMode
          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
          : GAME_SVG.cards(color, 17)}</button></div>
        <div style={{ height:3, background: T.progBar?.background || "rgba(255,255,255,0.08)" }}><div style={{ height:3, width:`${cardMode ? Math.round(((cardIdx + 1) / cards.length) * 100) : scrollPct}%`, background:color, transition:"width 0.2s", borderRadius:3 }} /></div>
        {modeHint && (
          <div onClick={dismissModeHint} style={{ position: "absolute", top: 92, right: 10, zIndex: 30, maxWidth: 230, cursor: "pointer" }}>
            <div style={{ position: "absolute", top: -5, right: 16, width: 10, height: 10, transform: "rotate(45deg)", background: "rgba(46,34,14,0.97)", borderLeft: `1px solid ${GOLD}66`, borderTop: `1px solid ${GOLD}66` }} />
            <div style={{ background: "rgba(46,34,14,0.97)", border: `1px solid ${GOLD}66`, borderRadius: 12, padding: "9px 12px", boxShadow: "0 8px 22px rgba(0,0,0,0.5)" }}>
              <div style={{ color: GOLD, fontSize: 12.5, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>Карточки ↔ лента</div>
              <div style={{ color: "#BDB09A", fontSize: 11, lineHeight: 1.5, marginTop: 2 }}>Эта кнопка меняет вид урока. Твой выбор запомнится.</div>
            </div>
          </div>
        )}
        <div ref={bodyRef} key={cardMode ? "card" + cardIdx : "feed"} className={cardMode ? (cardDir === "l" ? "sa-cardpage-l" : "sa-cardpage-r") : undefined} onScroll={handleScroll} onTouchStart={onCardTouchStart} onTouchEnd={onCardTouchEnd} style={{ ...T.lessBody, padding:"12px 14px 44px" }}>
          {resumeBanner}
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
            <div style={{ background: T.modCard?.background || "rgba(255,250,238,0.05)", border:`1px solid ${color||GOLD}44`, borderTop:`1px solid ${color||GOLD}66`, borderRadius:18, padding:"14px 16px", marginBottom:16, boxShadow:`0 6px 22px rgba(0,0,0,0.45), 0 2px 0 ${color||GOLD}18 inset` }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                <div style={{ display:"flex", color: color || GOLD }}><Sign n="dialog" s={30} /></div>
                <div style={{ flex:1 }}>
                  <div style={{ color: color || GOLD, fontSize: T.para?.fontSize || 15, fontWeight:"bold", fontFamily:"Georgia, serif" }}>В этом уроке есть живой диалог</div>
                </div>
              </div>
              <div style={{ color: T.modSub?.color || BROWN, fontSize: T.modSub?.fontSize || 13, lineHeight:1.6, fontFamily:"Georgia, serif" }}>
                Нажми на <span style={{ color: color||GOLD, borderBottom:`1.5px dotted ${color||GOLD}`, fontWeight:"bold" }}>выделенное слово</span> в тексте и отработай навык в живом диалоге с гостем
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
            // Строка только из эмодзи — разделитель со значком по центру. v75 (Доп. 388): значок в стиле приложения
            // (lib/situation-icons.js); эмодзи, для которого значка нет, — ромбик
            if (/^[\p{Extended_Pictographic}\s\uFE0F\u200D]+$/u.test(line.trim()) && line.trim().length <= 12) {
              const one = (line.trim().match(ONE_EM_RE) || [line.trim()])[0];
              const ic = iconForEmoji(one);
              return (
                <div key={i} data-lesson-sticker={ic || ""} style={{ display:"flex", alignItems:"center", gap:12, margin:"14px 0 6px" }}>
                  <div style={{ flex:1, height:1, background:`linear-gradient(to right, transparent, ${color}55)` }} />
                  <span style={{ display:"inline-flex", color }} aria-hidden="true">{ic ? <SitIcon name={ic} s={24} /> : <span style={{ width:7, height:7, margin:"0 3px", transform:"rotate(45deg)", background:color, opacity:0.75, display:"inline-block" }} />}</span>
                  <div style={{ flex:1, height:1, background:`linear-gradient(to left, transparent, ${color}55)` }} />
                </div>
              );
            }
            if (line.startsWith("**") && line.endsWith("**")) return <div key={i} style={T.bold}>{highlightTerms(line.replace(/\*\*/g,""))}</div>;
            // Доп. 199: жирное внутри строки — «**Ликёры** — сладкие настойки…» (раньше звёздочки печатались как есть)
            const inline = (text, st) => {
              if (!text.includes("**")) return highlightTerms(text, st);
              return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, k) =>
                part.startsWith("**") && part.endsWith("**")
                  ? <b key={k} style={{ color: T.bold?.color, fontWeight: "bold" }}>{highlightTerms(part.slice(2, -2), st)}</b>
                  : <React.Fragment key={k}>{highlightTerms(part, st)}</React.Fragment>);
            };
            if (line.startsWith("•")) return <div key={i} style={T.bullet}>{inline(line, T.bullet)}</div>;
            const markerRow = (style, iconEl) => (
              <div key={i} style={{ ...style, display:"flex", gap:8, alignItems:"flex-start" }}>
                <span style={{ flexShrink:0, marginTop:2, display:"inline-flex" }}>{iconEl}</span>
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
              <span style={{ width:19, height:19, borderRadius:9, border:`1.5px solid ${color}`, color, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:"bold", fontFamily:"Georgia, serif" }}>{keycap[1]}</span>);
            const dotColor = { "🔵":"#5B8DD9", "🟢":GREEN, "🟡":"#D9C75B", "🟠":"#E0975B", "🔴":RED }[[...line][0]];
            if (dotColor) return markerRow(T.principle,
              <span style={{ width:9, height:9, borderRadius:6, background:dotColor, marginTop:2, boxShadow:`0 0 8px ${dotColor}55`, display:"inline-block" }} />);
            if (line.startsWith("🌟")) return markerRow(T.principle,
              <svg width="14" height="14" viewBox="0 0 24 24" fill={GOLD} stroke={GOLD} strokeWidth="1" strokeLinejoin="round" style={{ marginTop:2 }}><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8z"/></svg>);
            if (line.startsWith("🔹")) return markerRow(T.principle,
              <span style={{ width:8, height:8, background:"#5B8DD9", transform:"rotate(45deg)", borderRadius:3, marginTop:4, boxShadow:"0 0 6px #5B8DD955", display:"inline-block" }} />);
            // v75 (Доп. 388): прочие эмодзи в начале строки («🦶 1. Встреча…», «🌱 **Новичок**») — значком, как маркеры выше;
            // если значка для эмодзи нет — строка без него
            const lead = line.match(LEAD_EM_RE);
            if (lead) {
              const ic = iconForEmoji(lead[1]);
              return (
                <div key={i} data-lesson-lead={ic || ""} style={{ ...T.para, display:"flex", gap:8, alignItems:"flex-start" }}>
                  {ic ? <span style={{ flexShrink:0, marginTop:3, display:"inline-flex", color }}><SitIcon name={ic} s={15} /></span> : null}
                  <span style={{ flex:1 }}>{inline(line.slice(lead[0].length), T.para)}</span>
                </div>
              );
            }
            if (line.startsWith("«") && line.includes("»")) return <div key={i} style={{ ...T.quote, borderLeftColor:color }}>{highlightTerms(line, T.quote)}</div>;
            return <div key={i} style={T.para}>{inline(line, T.para)}</div>;
          })}
            </div>{/* конец zIndex:1 */}
          </div>{/* конец стеклянной подложки */}
          {cardMode ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "0 0 6px", userSelect: "none" }}>
                <span className="sa-hit" role="button" aria-label="Предыдущая карточка" onClick={() => goCard(-1)} {...onActivate(() => goCard(-1))} style={{ color, opacity: cardIdx === 0 ? 0.22 : 0.8, fontSize: 25, lineHeight: 1, padding: "2px 10px", cursor: "pointer" }}>‹</span>
                {cards.length <= 10
                  ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}>{cards.map((_, i) => (
                      <span key={i} style={{ width: i === cardIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === cardIdx ? color : color + "44", transition: "all .25s" }} />
                    ))}</div>
                  : <span style={{ color, fontSize: 12.5, fontFamily: "monospace", letterSpacing: 1 }}>{cardIdx + 1} / {cards.length}</span>}
                <span className="sa-hit" role="button" aria-label="Следующая карточка" onClick={() => goCard(1)} {...onActivate(() => goCard(1))} style={{ color, opacity: cardIdx === cards.length - 1 ? 0.22 : 0.8, fontSize: 25, lineHeight: 1, padding: "2px 10px", cursor: "pointer" }}>›</span>
              </div>
              {cardIdx === 0 && cards.length > 1 && (
                <div style={{ textAlign: "center", color: T.modSub.color, fontSize: 12.5, fontStyle: "italic", opacity: 0.75, marginBottom: 8 }}>листай свайпом ← →</div>
              )}
              {cardIdx === cards.length - 1 && (done
                ? <DoneNext />
                : <FinishLesson mt={6} />
              )}
            </div>
          ) : (
            done ? <DoneNext /> : <FinishLesson mt={24} />
          )}
        </div>
        {/* Живой диалог — полноэкранный «экран» с автопрокруткой: он должен жить
            внутри контейнера приложения (в body его скролл гоняет всю страницу).
            Портал в body — только у поппапа термина ниже: ему нужен настоящий
            viewport из-за transform свайп-страниц. */}
        {dialogueScreen && createPortal(
          <LiveDialogue dialogueId={dialogueScreen} T={T} onClose={() => setDialogueScreen(null)} color={color} />
        , document.body)}
        {checkLayer}
        {termPopup && createPortal(
          <div onClick={() => setTermPopup(null)} {...onActivate(() => setTermPopup(null))}
            style={{ position:"fixed", inset:0, background:"transparent", zIndex:999 }}>
            <TapAnchored x={termPopup.x} y={termPopup.y} T={T}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: T.termPopupBg || "rgba(20,14,6,0.45)", borderRadius:18, padding:"20px 20px 24px", width:"100%", boxSizing:"border-box",
                border:`1px solid ${color}55`, borderTop:`1px solid ${color}77`,
                backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)",
                boxShadow:`inset 0 0 20px ${T.a11y ? "rgba(255,255,255,0.5)" : "rgba(255,248,230,0.07)"}, inset 0 1px 0 ${T.a11y ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.12)"}, 0 8px 32px rgba(0,0,0,0.4)` }}>
              <div style={{ color, fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:16, marginBottom:10 }}>
                <span style={{ display:"inline-flex", verticalAlign:"-2px", marginRight:7 }}>{UI_SVG.book(color, 16)}</span>{termPopup.term}
              </div>
              <div style={{ color: T.a11y ? "#3A2E1C" : "#E8DEC8", fontSize:14, lineHeight:1.7, fontFamily:"Georgia, serif" }}>
                {termPopup.def}
              </div>
              {DIALOGUES_DATA.find(d => d.termKey === termPopup.term.toLowerCase()) && (
                <div onClick={() => { setDialogueScreen(DIALOGUES_DATA.find(d => d.termKey === termPopup.term.toLowerCase()).id); setTermPopup(null); }} {...onActivate(() => { setDialogueScreen(DIALOGUES_DATA.find(d => d.termKey === termPopup.term.toLowerCase()).id); setTermPopup(null); })}
                  style={{ marginTop:12, padding:"11px 16px", borderRadius:12, background:color, cursor:"pointer",
                    textAlign:"center", color:"#fff", fontSize:14, fontFamily:"Georgia, serif", fontWeight:"bold" }}>
                  Отработать на практике →
                </div>
              )}
              <div onClick={() => setTermPopup(null)} {...onActivate(() => setTermPopup(null))}
                style={{ marginTop:10, textAlign:"center", color, fontSize:12.5, opacity:0.6, cursor:"pointer", fontFamily:"Georgia, serif" }}>
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
    // Доп. 290: практика «у стола». Тот же practiceState, те же очки, жизни (тарелки), звёзды.
    // Модуль ещё не приехал или выбран классический вид — работает прежний экран ниже.
    const freshRound = !practiceState.isAnswered && practiceState.step === 0 && !practiceState.done;
    if (tb && tableView && (tbAtMount || startedTable.current || freshRound)) {
      startedTable.current = true;
      return <tb.TablePractice lesson={lesson} color={color} a11y={!!T.a11y} practiceState={practiceState} setPracticeState={setPracticeState}
        onPracticeChoice={onPracticeChoice} onPracticeNext={onPracticeNext} onBack={onBack} onComplete={onComplete}
        onClassic={() => switchView(false)} streak={streak} profile={profile}
        mod={mod} replay={replay} mentorName={mentorName} goal={goal} onAskMentor={onAskMentor} />;
    }
    const situations = practiceState.situations.length > 0
      ? practiceState.situations
      : pickRandom(lesson.situations || [], 6);

    // ── ФИНАЛЬНЫЙ ЭКРАН ──────────────────────────────────────
    if (practiceState.done) {
      const correct = practiceState.results.filter(Boolean).length;
      const total = situations.length;
      const stars = practiceState.score >= 60 ? 3 : practiceState.score >= 30 ? 2 : 1;
      const restartGame = () => {
        // Сначала ситуации, которых ещё не было; показали всё — история с нуля.
        // Доп. 290: логика вынесена в lib/practice-round.js (общая с видом «у стола»), не менялась.
        setPracticeState(practiceRound(lesson.situations || [], practiceState.usedIds));
        // Доп. 232: setGameKey здесь не существует (состояние App) — сброс practiceState выше уже перезапускает игру
      };
      return (
        <div style={T.screen} className="sa-screen">
          <div style={T.lessHead}>
            <button className="sa-hit" style={T.backBtn2} aria-label="Вернуться" onClick={onBack}>‹</button>
            <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>{UI_SVG.gamepad(color, 18)}<span>Результат раунда</span></div>
          </div>
          <div style={{ flex:1, padding:"20px 18px 40px", overflowY:"auto" }}>
            <div style={{ textAlign:"center", marginBottom:20 }} className="sa-pop">
              <div style={{ display:"flex", justifyContent:"center", gap:10, marginBottom:6, color:GOLD }}>
                {[1,2,3].map(s => <span key={s} style={{ display:"inline-flex", opacity:s<=stars?1:0.22, transition:"opacity 0.3s" }}><Sign n={s<=stars ? "star" : "starLine"} s={46} /></span>)}
              </div>
              <div style={{ color:color, fontSize:36, fontWeight:"bold", marginBottom:4 }}>{practiceState.score}</div>
              <div style={{ color:T.modSub.color, fontSize:12.5, marginBottom:4 }}>очков</div>
              <div style={{ color:T.para.color, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                {stars===3 ? UI_SVG.trophy(GOLD, 16) : stars===2 ? ROLE_SVG.core(GOLD, 16) : UI_SVG.book(GOLD, 16)}
                <span>{stars===3?"Раунд без потерь":stars===2?"Хороший раунд":"Есть что повторить"}</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {[{l:"Правильно",v:`${correct}/${total}`,c:GREEN},{l:"Жизни",v:practiceState.lives,c:RED},{l:"Очков",v:practiceState.score,c:color}].map((s,i)=>(
                <div key={i} style={{ flex:1, background:T.simOpt.background, borderRadius:14, padding:"10px 6px", textAlign:"center", border:`2px solid ${T.simOpt.border}` }}>
                  <div style={{ color:s.c, fontSize:18, fontWeight:"bold" }}>{s.v}</div>
                  <div style={{ color:T.modSub.color, fontSize:10.5, marginTop:2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:12 }}>
              {situations.map((s,i) => practiceState.results[i]!==undefined && (
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 12px", background:practiceState.results[i]?"rgba(93,187,138,0.1)":"rgba(224,120,120,0.1)", borderRadius:12, marginBottom:6, border:`1px solid ${practiceState.results[i]?"#5DBB8A44":"#E0787844"}` }}>
                  <div style={{ flexShrink:0, display:"flex", marginTop:2 }}>{practiceState.results[i] ? UI_SVG.checkCircle(GREEN, 16) : UI_SVG.xCircle(RED, 16)}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:T.modTitle.color, fontSize:12.5 }}>{((t)=>t.length>45?t.slice(0,45)+"…":t)(s.scene||s.statement||"")}</div>
                    <div style={{ color:practiceState.results[i]?GREEN:RED, fontSize:11, marginTop:2 }}>{((t)=>t.length>55?t.slice(0,55)+"…":t)(stripEm(practiceState.results[i]?s.win:s.fail))}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)", color:T.para.color, marginTop:2, marginBottom:10 }} onClick={restartGame}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}><Sign n="refresh" s={16} />Сыграть ещё раз</span>
            </button>
            <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background:color, marginTop:2 }} onClick={onComplete}>
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
      // v73: бейдж жанра — курсивом, строчными
      action:   { label:"что делаешь?",   gicon:"clap",   color:GREEN },
      find:     { label:"найди ошибку",   gicon:"search", color:GOLD_SOFT },
      timer:    { label:"быстрый выбор",  gicon:"bolt",   color:RED },
      truefalse:{ label:"верно / неверно", gicon:"cards",  color:"#8B7BAB" },
      complete: { label:"собери правило",  gicon:"link",   color:"#7B8FAB" },
      empathy:  { label:"роль гостя",     gicon:"mask",   color:GOLD },
    };
    const gm = genreMeta[genre] || genreMeta.action;
    const sayPhrase = sit.say || ((genre === "action" || genre === "empathy") && sit.options ? sit.options[sit.correct] : null);

    return (
      <div style={{ ...T.screen }} className="sa-screen">
        {/* ── ШАПКа ── */}
        <div className="sa-tophead" style={{ padding:"44px 18px 10px", background:"transparent" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <button className="sa-hit" style={T.backBtn2} aria-label="Вернуться" onClick={onBack}>‹</button>
            <div style={{ display:"flex", gap:2 }} data-practice-lives={practiceState.lives} role="img" aria-label={"Жизни: " + practiceState.lives + " из 3"}>
              {[1,2,3].map(h=><span key={h} style={{ display:"inline-flex", color:RED, opacity:h<=practiceState.lives?1:0.25, transition:"opacity 0.3s" }}><Sign n="heartFull" s={17} /></span>)}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ background:"rgba(212,168,90,0.2)", borderRadius:18, padding:"4px 12px", border:"1px solid rgba(212,168,90,0.4)" }}>
                <span style={{ color:GOLD_SOFT, fontSize:12.5, fontWeight:"bold", display:"inline-flex", alignItems:"center", gap:4 }}><Sign n="star" s={13} />{practiceState.score}</span>
              </div>
              {tb ? <button className="sa-btn" onClick={() => switchView(true)} aria-label="Вид «у стола»" style={{ background:"transparent", border:`1px solid ${color}88`, borderRadius:18, padding:"4px 10px", color: T.modSub.color, fontSize:11.5, cursor:"pointer", fontFamily:"Georgia, serif" }}>у стола</button> : null}
            </div>
          </div>
          <div style={{ display:"flex", gap:2 }}>
            {situations.map((_,i)=>(
              <div key={i} style={{ flex:1, height:3, borderRadius:3, background:i<practiceState.step?GREEN:i===practiceState.step?color:"rgba(200,169,110,0.18)", transition:"background 0.3s" }} />
            ))}
          </div>
        </div>

        <div id="practice-scroll" key={practiceState.step} style={{ flex:1, padding:"10px 18px 32px", overflowY:"auto" }}>
          {/* Комбо */}
          {practiceState.combo>=2 && (
            <div style={{ textAlign:"center", marginBottom:8 }} className="sa-fast">
              <span style={{ background:`linear-gradient(135deg,#D2A85A,#E8C56A)`, borderRadius:18, padding:"3px 14px", fontSize:11, fontWeight:"bold", color:"#fff" }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><Sign n="flame" s={12} sw={2} />Комбо ×{practiceState.combo} · +20</span>
              </span>
            </div>
          )}

          {/* Жанр-бейдж */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <span style={{ ...labelStyle(13), background:`${gm.color}22`, borderRadius:18, padding:"2px 12px", color:gm.color, border:`1px solid ${gm.color}44`, display:"inline-flex", alignItems:"center", gap:4 }}>
              {gm.gicon === "bolt" ? MOD_SVG["⚡"](gm.color, 11) : gm.gicon === "link" ? MOD_SVG["🔗"](gm.color, 11) : GAME_SVG[gm.gicon] ? GAME_SVG[gm.gicon](gm.color, 11) : null}{gm.label}
            </span>
            <span style={{ color:T.modSub.color, fontSize:11, fontFamily:"monospace" }}>{practiceState.step+1}/{situations.length}</span>
          </div>

          {/* Эмодзи */}
          <div style={{ display:"flex", justifyContent:"center", marginBottom:10, color }} className="sa-pop"><SitIcon name={iconForSituation(sit)} s={44} /></div>

          {/* ── ЖАНР: TRUE/FALSE ── */}
          {genre==="truefalse" && (
            <>
              <div style={{ background: T.a11y ? "rgba(250,242,222,0.55)" : "rgba(255,250,238,0.05)", borderRadius:14, padding:"16px", marginBottom:12, border: T.a11y ? "1px solid rgba(139,106,48,0.3)" : "1px solid rgba(255,255,255,0.13)", boxShadow: T.a11y ? "inset 0 0 18px rgba(255,250,235,0.5)" : "inset 0 0 18px rgba(255,248,230,0.06), inset 0 1px 0 rgba(255,255,255,0.1)" }}>
                <div style={{ ...labelStyle(13), color:T.modSub.color, marginBottom:6 }}>Утверждение</div>
                <div style={{ color:T.para.color, fontSize:14, lineHeight:1.7, fontStyle:"italic" }}>«{sit.statement}»</div>
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
                      style={{ flex:1, background:bg, border:`2px solid ${bc}`, borderRadius:14, padding:"16px 10px", textAlign:"center", color:T.para.color, fontSize:16, fontWeight:"bold", cursor:answered?"default":"pointer", transition:"background 0.2s, border-color 0.2s, color 0.2s" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6 }}>{btn.gicon === "check" ? UI_SVG.checkCircle(btn.bc, 16) : UI_SVG.xCircle(btn.bc, 16)}{btn.label}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── ЖАНР: COMPLETE (собери правило) ── */}
          {genre==="complete" && (
            <>
              <div style={{ ...T.simScen, borderRadius:14, padding:"14px", marginBottom:12 }}>
                <div style={{ ...labelStyle(13), color:T.modSub.color, marginBottom:6 }}>Начало правила</div>
                <div style={{ color:T.para.color, fontSize:14, lineHeight:1.7 }}>{sit.start} <span style={{ color:gm.color }}>___?</span></div>
              </div>
              <div style={{ color:T.bold.color, fontSize:14, fontWeight:"bold", marginBottom:10 }}>Выбери правильное продолжение:</div>
              {sit.options.map((opt,i)=>{
                const chosen = practiceState.choice===i;
                const isCorr = i===sit.correct;
                let bg = T.simOpt.background;
                let bc = neutralBC;
                let tc = T.simOpt.color;
                if(answered){if(chosen&&isCorr){bg="rgba(93,187,138,0.2)";bc="#5DBB8A";tc="#5DBB8A";}else if(chosen&&!isCorr){bg="rgba(224,120,120,0.2)";bc="#E07878";tc="#E07878";}else if(!chosen&&isCorr&&practiceState.choice!==sit.correct){bg="rgba(93,187,138,0.1)";bc="#5DBB8A";tc="#5DBB8A";}}
                return <div key={i} className="sa-opt" onClick={()=>!answered&&wrappedPracticeChoice(i)} {...onActivate(()=>!answered&&wrappedPracticeChoice(i))} style={{ ...T.simOpt, background:bg, border:`2px solid ${bc}`, borderTop: bc !== neutralBC ? `2px solid ${bc}` : T.simOpt.borderTop, borderRadius:12, padding:"12px 14px", marginBottom:8, color:tc, lineHeight:1.6, cursor:answered?"default":"pointer", transition:"background 0.2s, border-color 0.2s, color 0.2s" }}>{opt}</div>;
              })}
            </>
          )}

          {/* ── ЖАНР: EMPATHY (роль гостя) ── */}
          {genre==="empathy" && (
            <>
              <div className="sa-fast" style={{ ...T.simScen, background:"rgba(200,169,110,0.12)", borderRadius:14, padding:"14px", marginBottom:6, border:"1px solid rgba(200,169,110,0.25)" }}>
                <div style={{ ...labelStyle(13), color:GOLD_SOFT, marginBottom:6, display:"flex", alignItems:"center", gap:6 }}>{GAME_SVG.thought(GOLD_SOFT, 13)}<span>Мысли гостя</span></div>
                <div style={{ color:T.para.color, fontSize:14, lineHeight:1.7, fontStyle:"italic" }}>«{sit.guestThought}»</div>
              </div>
              <div className="sa-fast" style={{ ...T.simScen, borderRadius:14, padding:"12px", marginBottom:12, animationDelay:"0.08s" }}>
                <div style={{ ...labelStyle(13), color:T.modSub.color, marginBottom:4 }}>Ситуация</div>
                <div style={{ color:T.para.color, fontSize:12.5, lineHeight:1.65 }}>{sit.scene}</div>
              </div>
              <div className="sa-fast" style={{ color:T.bold.color, fontSize:14, fontWeight:"bold", marginBottom:10, animationDelay:"0.14s" }}>{sit.question}</div>
              {sit.options.map((opt,i)=>{
                const chosen = practiceState.choice===i;
                const isCorr = i===sit.correct;
                let bg=T.simOpt.background,bc=neutralBC,tc=T.simOpt.color;
                if(answered){if(chosen&&isCorr){bg="rgba(93,187,138,0.2)";bc="#5DBB8A";tc="#5DBB8A";}else if(chosen&&!isCorr){bg="rgba(224,120,120,0.2)";bc="#E07878";tc="#E07878";}else if(!chosen&&isCorr&&practiceState.choice!==sit.correct){bg="rgba(93,187,138,0.1)";bc="#5DBB8A";tc="#5DBB8A";}}
                return <div key={i} className="sa-opt" onClick={()=>!answered&&wrappedPracticeChoice(i)} {...onActivate(()=>!answered&&wrappedPracticeChoice(i))} style={{ ...T.simOpt, background:bg, border:`2px solid ${bc}`, borderTop: bc !== neutralBC ? `2px solid ${bc}` : T.simOpt.borderTop, borderRadius:12, padding:"12px 14px", marginBottom:8, color:tc, lineHeight:1.6, cursor:answered?"default":"pointer", transition:"background 0.2s, border-color 0.2s, color 0.2s" }}>{opt}</div>;
              })}
            </>
          )}

          {/* ── ЖАНРЫ: ACTION / FIND / TIMER ── */}
          {(genre==="action"||genre==="find"||genre==="timer") && (
            <>
              <div className="sa-fast" style={{ ...T.simScen, borderRadius:14, padding:"14px", marginBottom:12 }}>
                {genre==="timer" && !answered && (
                  <TimerBar key={`timer-${practiceState.step}`} duration={12} color={color} onExpire={()=>wrappedPracticeChoice(-1)} />
                )}
                <div style={{ color:T.para.color, fontSize:14, lineHeight:1.75 }}>{sit.scene}</div>
              </div>
              <div className="sa-fast" style={{ color:T.bold.color, fontSize:14, fontWeight:"bold", marginBottom:12, animationDelay:"0.1s" }}>{sit.question}</div>
              {sit.options.map((opt,i)=>{
                const chosen = practiceState.choice===i;
                const isCorr = i===sit.correct;
                let bg=T.simOpt.background,bc=neutralBC,tc=T.simOpt.color,prefix="";
                if(answered){if(chosen&&isCorr){bg="rgba(93,187,138,0.2)";bc="#5DBB8A";tc="#5DBB8A";prefix="ok";}else if(chosen&&!isCorr){bg="rgba(224,120,120,0.2)";bc="#E07878";tc="#E07878";prefix="bad";}else if(!chosen&&isCorr&&practiceState.choice!==sit.correct){bg="rgba(93,187,138,0.1)";bc="#5DBB8A";tc="#5DBB8A";prefix="ok";}}
                return <div key={i} className="sa-opt" onClick={()=>!answered&&wrappedPracticeChoice(i)} {...onActivate(()=>!answered&&wrappedPracticeChoice(i))} style={{ ...T.simOpt, background:bg, border:`2px solid ${bc}`, borderTop: bc !== neutralBC ? `2px solid ${bc}` : T.simOpt.borderTop, borderRadius:12, padding:"12px 14px", marginBottom:8, color:tc, lineHeight:1.6, cursor:answered?"default":"pointer", transition:"background 0.2s, border-color 0.2s, color 0.2s", boxShadow:answered&&chosen&&isCorr?"0 0 12px rgba(93,187,138,0.25)":"none" }}>{prefix ? <Sign n={prefix === "ok" ? "checkC" : "xC"} s={16} style={{ marginRight: 6, verticalAlign: "-3px" }} /> : null}{opt}</div>;
              })}
            </>
          )}

          {/* ── ФИДБЭК ── */}
          
          {answered && (
            <div className="sa-fast" style={{ marginTop:10 }}>
              <div style={{ background:isCorrectAnswer?"rgba(93,187,138,0.15)":"rgba(224,120,120,0.15)", border:`1.5px solid ${isCorrectAnswer?GREEN:RED}`, borderRadius:14, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ fontSize:18, marginBottom:4 }}>
                  {practiceState.choice===-1 ? <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>{GAME_SVG.clock(RED, 15)}Время вышло</span> : isCorrectAnswer ? `+${practiceState.combo>=2?20:10} очков` : `Минус жизнь, осталось ${practiceState.lives}`}
                </div>
                <div style={{ color:isCorrectAnswer?GREEN:RED, fontSize:12.5, lineHeight:1.6 }}>
                  {isCorrectAnswer ? stripEm(sit.win) : missText(sit, practiceState.choice >= 0 ? (sit.options || [])[practiceState.choice] : "")||"Попробуй ещё раз в следующем раунде"}
                </div>
              </div>
              {sayPhrase && <SayAloud phrase={sayPhrase} T={T} color={color} />}
              <button ref={nextBtnRef} className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background:color, marginTop:2 }} onClick={onPracticeNext}>
                {practiceState.step+1<situations.length?"Дальше →":<span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>Финиш {GAME_SVG.flag("currentColor", 14)}</span>}
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
          <div style={T.lessHead}><button className="sa-hit" style={T.backBtn2} aria-label="Вернуться" onClick={onBack}>‹</button><div style={T.lessHeadTitle}>Результат теста</div></div>
          <div style={{ ...T.quizWrap, paddingBottom:40 }}>
            <div style={T.resultWrap}>
              <div className="sa-pop" style={{ ...T.resultCircle, borderColor:color }}>
                <span style={{ ...T.resultScore, color }}>{score}/{lesson.questions.length}</span>
                <span style={{ color:"#a09080", fontSize:12.5 }}>правильно</span>
              </div>
              <div style={T.resultTxt}>
                {quizState.blocked?"Это третья ошибка, тест закончился. Посмотри разбор ниже и попробуй снова: пересдать можно сразу.":
                  score===lesson.questions.length?<span style={{ display:"inline-flex", alignItems:"center", gap:6 }}><Sign n="checkC" s={20} c={GREEN} />Всё верно</span>:
                  score>=lesson.questions.length*0.7?<span style={{ display:"inline-flex", alignItems:"center", gap:6 }}><Sign n="check" s={20} c={GREEN} />Тест сдан, ошибки разобраны ниже</span>:<span style={{ display:"inline-flex", alignItems:"center", gap:6 }}><Sign n="book" s={20} c={color} />Стоит перечитать урок</span>}
              </div>
            </div>
            {wrongAnswers.length > 0 && (
              <div>
                <div style={{ ...labelStyle(16), color, marginBottom:12 }}>Разбор ошибок</div>
                {wrongAnswers.map((a,i) => (
                  <div key={i} style={{ background:T.progCard.background, borderRadius:14, padding:"14px 16px", marginBottom:12, border:`1px solid ${color}44` }}>
                    <div style={{ ...T.para, fontWeight:"bold", marginBottom:8 }}>{a.question.q}</div>
                    {a.question.img && <img src={a.question.img} alt="" loading="lazy" decoding="async" style={{ width:"100%", maxHeight:150, objectFit:"cover", borderRadius:9, display:"block", marginBottom:8 }} />}
                    <div style={{ ...T.bad, marginBottom:6, display:"flex", alignItems:"center", gap:8 }}><Sign n="xC" s={20} />Твой ответ: {a.question.options[a.idx]}</div>
                    <div style={{ ...T.good, marginBottom:8, display:"flex", alignItems:"center", gap:8 }}><Sign n="checkC" s={20} />Правильно: {a.question.options[a.question.correct]}</div>
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
    // v71: правила на виду — тема в шапке, три тарелки, бусины, правило словами на первом вопросе, буквы у ответов
    ensureQuizCss();
    const light = !!T.a11y;
    const nQ = qBank2.length;
    const pendingBad = reveal !== null && reveal !== q.correct;
    const mistakesNow = quizState.answers.filter((a) => !a.isCorrect).length + (pendingBad ? 1 : 0);
    return (
      <div style={T.screen}>
        <div style={{ ...T.lessHead, gap: 8 }}><button className="sa-hit" style={T.backBtn2} aria-label="Вернуться" onClick={() => { commitPending(); onBack(); }}>‹</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div data-quiz-kind style={{ ...labelStyle(light ? 14.5 : 13), color: light ? "#7A5A1E" : GOLD, marginBottom: 2 }}>Тест · {nQ} {nQ % 10 === 1 && nQ % 100 !== 11 ? "вопрос" : (nQ % 10 >= 2 && nQ % 10 <= 4 && (nQ % 100 < 10 || nQ % 100 >= 20)) ? "вопроса" : "вопросов"}</div>
            <div data-quiz-title style={{ ...T.lessHeadTitle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{quizTopic(lesson.title)}</div>
          </div>
          <QuizPlates mistakes={mistakesNow} light={light} justBroke={pendingBad} />
        </div>
        <div key={quizState.step} className="sa-cardpage-r" style={T.quizWrap}>
          <QuizMeta n={nQ} step={quizState.step} light={light} />
          <QuizBeads n={nQ} step={quizState.step} answers={quizState.answers} pending={reveal !== null ? { isCorrect: !pendingBad } : null} light={light} />
          {quizState.step === 0 && !quizState.answers.length ? <QuizRuleNote n={nQ} light={light} /> : null}
          <div style={{ height: 14 }} />
          {q.img && <img src={q.img} alt="" loading="lazy" decoding="async" style={{ width:"100%", maxHeight:210, objectFit:"cover", borderRadius:14, display:"block", margin:"0 0 14px" }} />}
          <div style={{ ...T.quizQ, fontSize: light ? 19 : 17, lineHeight: light ? 1.6 : 1.55 }}>{q.q}</div>
          {q.options.map((opt,i) => {
            // Подсветка ровно как в «Работе над ошибками» — единый язык ответов
            let st = { ...T.quizOpt, cursor: reveal === null ? "pointer" : "default", transition:"background 0.2s, opacity 0.2s", display:"flex", alignItems:"center", gap:12, minHeight:52, marginBottom:9, padding: light ? "12px 14px" : "11px 13px" };
            if (reveal !== null) {
              // v57: и верхняя кромка — иначе у ответа оставалась светлая полоска сверху (border + borderTop)
              if (i === q.correct) st = { ...st, background:"rgba(93,187,138,0.15)", border:"1px solid #5DBB8A", borderTop:"1px solid #5DBB8A" };
              else if (i === reveal) st = { ...st, background:"rgba(224,120,120,0.15)", border:"1px solid #E07878", borderTop:"1px solid #E07878" };
              else st = { ...st, opacity: 0.5 };
            }
            const pickIt = () => {
              if (reveal !== null) return;
              const ok = i === q.correct;
              setReveal(i);
              pendingPick.current = i;
              vibrate(ok ? "light" : "error");
              sfx(ok ? "ok" : "bad");   // v57 (Доп. 370): тихий звук ответа, как в практике (выключатель — «Аккаунт» → «Настройки»)
              // Верный — короткая пауза держит темп; неверный — длиннее,
              // чтобы глаз успел увидеть правильный вариант.
              revealTimer.current = setTimeout(() => { pendingPick.current = null; revealTimer.current = null; setReveal(null); onQuiz(i); }, ok ? 600 : 1400);
            };
            const mark = reveal === null ? null : i === q.correct ? "ok" : i === reveal ? "bad" : null;
            return <div key={i} className="sa-opt" data-quiz-opt={i} style={st} onClick={pickIt} {...onActivate(pickIt)}><OptLetter i={i} state={mark} light={light} /><span style={{ flex: 1, minWidth: 0 }}>{opt}</span></div>;
          })}
        </div>
      </div>
    );
  }
  return null;
}

export function GlossaryScreen({ T, onBack, color = "#C8A96E", a11y, saved = {}, onToggleFav = () => {}, onSetNote = () => {} }) {
  const [search, setSearch] = React.useState("");
  // Подсказка одна на всех: содержание глоссария от роли не зависит.
  const [gHint, gHintDone] = useHintOnce("glossary");
  const [gStep, setGStep] = React.useState(0);
  const gSteps = hintsFor("glossary");
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
  // v52: широкий экран — колонка до 980 px, термины раздела — двумя независимыми колонками, заголовок раздела — во всю ширину
  const wide = useWide();
  useColumn(wide ? 980 : 0);
  return (
    <div style={T.screen}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} aria-label="Вернуться" onClick={onBack}>‹</button>
        <div style={{ ...T.lessHeadTitle, display:"flex", alignItems:"center", gap:8 }}>{UI_SVG.book(color || GOLD, 18)}<span>Глоссарий</span></div>
      </div>
      {/* ПОСЛЕ шапки, а не внутри: lessHead — флекс-ряд, и пузырь
          становился его элементом и сжимался в узкую колонку. */}
      {gHint && gSteps.length ? (
        <HintBubble a11y={a11y} text={gSteps[gStep]} arrow="up"
          step={gStep + 1} total={gSteps.length}
          onNext={gStep >= gSteps.length - 1 ? null : () => setGStep(v => v + 1)}
          onClose={gHintDone} />
      ) : null}

      <div style={{ ...T.lessBody, padding:"14px 16px 40px" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск термина..."
          style={{ width:"100%", padding:"10px 14px", borderRadius:12, border:`1px solid ${color}44`,
            background: T.modCard?.background || "rgba(255,255,255,0.05)",
            color: T.para?.color || CREAM, fontSize:14, fontFamily:"Georgia, serif",
            outline:"none", boxSizing:"border-box", marginBottom:12 }}
        />
        <div style={{ marginBottom:10 }}>
          <LiquidSegment a11y={a11y} equal={false} scroll accent={color}
            itemStyle={{ fontSize:12.5, padding:"7px 12px" }}
            items={cats.map(c => ({ id:c, label:c }))}
            activeId={cat}
            onSelect={setCat} />
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          <button onClick={() => setFavOnly(v => !v)} aria-pressed={favOnly}
            style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:18, cursor:"pointer",
              border:`1px solid ${color}${favOnly ? "" : "55"}`,
              background: favOnly ? color : "transparent",
              color: favOnly ? "#1A1008" : (T.para?.color || "#C8B898"),
              fontSize:12.5, fontFamily:"Georgia, serif", fontWeight:"bold", transition:"all 0.15s" }}>
            {favOnly ? "★" : "☆"} Только избранное
          </button>
        </div>
        {filtered.length === 0 && (
          <div style={{ ...T.para, textAlign:"center", opacity:0.5 }}>Ничего не найдено</div>
        )}
        {(() => { const list = filtered.map((g, i) => {
          // Заголовок раздела — перед первым термином каждой категории
          const showCat = g.cat && (i === 0 || filtered[i - 1].cat !== g.cat);
          const catHeader = showCat && (
            <div key={"cat_" + g.cat} style={{ ...labelStyle(13), color: color || GOLD, margin: i === 0 ? "2px 2px 10px" : "22px 2px 10px", opacity:0.85, display:"flex", alignItems:"center", gap:8 }}>
              <span>{g.cat}</span>
              <span style={{ flex:1, height:1, background:`${color || GOLD}33` }} />
            </div>
          );
          const k = g.term.toLowerCase();
          const entry = saved[k] || {};
          const fav = !!entry.fav;
          const note = entry.note || "";
          const card = (
          <div key={"t" + i} style={{ ...T.modCard, marginBottom:10, padding:"12px 14px", borderRadius:14, flexDirection:"column", alignItems:"flex-start", gap:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, width:"100%" }}>
              <div style={{ color: a11y ? BROWN_GOLD : "#E8C87A", fontFamily:"Georgia, serif", fontWeight:"bold", fontSize:14, flex:1 }}>{g.term}</div>
              <button onClick={() => onToggleFav(k)} aria-label={fav ? "Убрать из избранного" : "В избранное"} title={fav ? "Убрать из избранного" : "В избранное"}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:21, lineHeight:1, padding:"0 2px", color: fav ? color : (a11y ? "#9A8A6A" : "#6B5E48") }}>
                {fav ? "★" : "☆"}
              </button>
            </div>
            <div style={{ ...T.modSub, color: a11y ? "#3A2C10" : "#C8B898", fontSize:14, lineHeight:1.6 }}>{g.def}</div>
            {/* Заметка: не обязательна — появляется только по кнопке */}
            {editingNote === k ? (
              <div style={{ width:"100%" }}>
                <textarea autoFocus value={note} onChange={e => onSetNote(k, e.target.value)} placeholder="Моя заметка..." rows={2}
                  style={{ width:"100%", marginTop:4, padding:"8px 10px", borderRadius:9, border:`1px solid ${color}55`,
                    background: T.modCard?.background || "rgba(255,255,255,0.04)", color: T.para?.color || "#F0E8D8",
                    fontSize:16, fontFamily:"Georgia, serif", lineHeight:1.5, outline:"none", boxSizing:"border-box", resize:"vertical" }} />
                <div style={{ display:"flex", justifyContent:"flex-end", gap:12, marginTop:6, width:"100%" }}>
                  {note && (
                    <button onClick={() => { onSetNote(k, ""); setEditingNote(null); }}
                      style={{ background:"none", border:"none", cursor:"pointer", color: a11y ? "#8A5A3A" : "#B07A6A", fontSize:12.5, fontFamily:"Georgia, serif", padding:"4px 2px" }}>
                      Удалить
                    </button>
                  )}
                  <button onClick={() => setEditingNote(null)}
                    style={{ background:"none", border:"none", cursor:"pointer", color: color || GOLD, fontSize:12.5, fontFamily:"Georgia, serif", fontWeight:"bold", padding:"4px 2px" }}>
                    Готово
                  </button>
                </div>
              </div>
            ) : note ? (
              <div onClick={() => setEditingNote(k)} {...onActivate(() => setEditingNote(k))}
                style={{ width:"100%", marginTop:4, padding:"8px 10px", borderRadius:9, border:`1px dashed ${color}44`,
                  color: T.para?.color || "#F0E8D8", fontSize:14, fontFamily:"Georgia, serif", lineHeight:1.5, cursor:"pointer", whiteSpace:"pre-wrap", boxSizing:"border-box" }}>
                <span style={{ display:"block", fontSize:10.5, letterSpacing:1, opacity:0.55, marginBottom:2 }}>✎ МОЯ ЗАМЕТКА</span>
                {note}
              </div>
            ) : (
              <button onClick={() => setEditingNote(k)}
                style={{ background:"none", border:"none", cursor:"pointer", color: `${color || GOLD}99`, fontSize:12.5, fontFamily:"Georgia, serif", padding:"2px 0", marginTop:2 }}>
                + Добавить заметку
              </button>
            )}
          </div>
          );
          // прикидка высоты карточки — чтобы колонки на широком экране вышли ровными. Заметки не учитываем:
          // иначе, пока печатаешь заметку, разрез мог сдвинуться и карточка перепрыгнула бы в другую колонку
          return { i, header: catHeader || null, card, w: 84 + String(g.def || "").length * 0.5 };
        });
          if (!wide) return list.map((x) => <React.Fragment key={x.i}>{x.header}{x.card}</React.Fragment>);
          // широкий экран: заголовок раздела — во всю ширину, термины раздела — в две независимые колонки
          // (раскрыл заметку — растёт только своя колонка, карточки не перепрыгивают)
          const groups = [];
          list.forEach((x) => { if (x.header || !groups.length) groups.push({ header: x.header, items: [] }); groups[groups.length - 1].items.push(x); });
          return <div data-gloss-cols="">{groups.map((gr, gi) => { const h = splitAt(gr.items.map((x) => x.w)); return (
            <React.Fragment key={gi}>{gr.header}
              <div className="sa-2c"><div>{gr.items.slice(0, h).map((x) => x.card)}</div><div>{gr.items.slice(h).map((x) => x.card)}</div></div>
            </React.Fragment>); })}</div>;
        })()}
        <div style={{ ...T.para, textAlign:"center", opacity:0.4, fontSize:12.5, marginTop:8 }}>{GLOSSARY.length} терминов</div>
      </div>
    </div>
  );
}
