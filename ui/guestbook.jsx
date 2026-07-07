// ui/guestbook.jsx
// «Книга отзывов» — каждый пройденный модуль превращается в живой отзыв гостя.
// Экзамен роли — легендарная страница с сургучной печатью. Раз в неделю —
// «гость недели»: испытание на живом диалоге. Только победы: провал не
// оставляет плохих страниц — «гость просто ушёл без отзыва и вернётся».

import React from "react";
import { GOLD } from "./tokens";
import { onActivate } from "../lib/utils";
import { MODULES } from "../data/modules";
import { ROLES } from "../data/roles";
import {
  MODULE_REVIEWS, LEGEND_REVIEWS, WEEKLY_REVIEW, RANKS,
  moduleDone, bookStats, weeklyLessonId, weeklyDialogueId, countNewDishes,
} from "../data/reviews";

const GOLD_SOFT = "#D4A85A", PAPER = "#FBF5E8", PAPER_DIM = "#EFE6D2",
  INK = "#2A1F0E", BROWN = "#7A6548", WAX = "#8B3020";
const MONO = { fontFamily: "ui-monospace, Menlo, monospace" };
const SCRIPT = { fontFamily: "'Marck Script', 'Caveat', 'Segoe Script', cursive" };

const BOOK_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Marck+Script&family=Caveat:wght@500&display=swap');
  @keyframes gbPageR { from { opacity:0; transform:translateX(24px) rotate(.5deg);} to { opacity:1; transform:none;} }
  @keyframes gbPageL { from { opacity:0; transform:translateX(-24px) rotate(-.5deg);} to { opacity:1; transform:none;} }
  @keyframes gbSeal { 0% { transform:scale(0) rotate(-18deg);} 70% { transform:scale(1.12) rotate(3deg);} 100% { transform:scale(1);} }
  .gb-page-r { animation: gbPageR .38s cubic-bezier(.16,1,.3,1) both; }
  .gb-page-l { animation: gbPageL .38s cubic-bezier(.16,1,.3,1) both; }
  .gb-seal { animation: gbSeal .5s cubic-bezier(.34,1.56,.64,1) .2s both; }
  @media (prefers-reduced-motion: reduce) { .gb-page-r,.gb-page-l,.gb-seal { animation:none; } }
`;

// Даты получения страниц: фиксируем при первом появлении (раньше не хранились)
const loadDates = () => { try { return JSON.parse(localStorage.getItem("sa_book_dates") || "{}"); } catch (e) { return {}; } };
const ruDate = (ts) => new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

// ── Сборка страниц одной роли ──
function buildRolePages(roleId, completed, quizDone, examResults, dates) {
  const pages = [];
  for (const m of (MODULES[roleId] || [])) {
    const rv = MODULE_REVIEWS[m.id];
    if (!rv) continue;
    if (moduleDone(m, completed, quizDone)) pages.push({ kind: "earned", key: m.id, ...rv, source: `${m.tag.toUpperCase()} · ${m.title.toUpperCase()}`, date: dates[m.id] ? ruDate(dates[m.id]) : "" });
    else pages.push({ kind: "locked", key: m.id, source: `${m.tag.toUpperCase()} · ${m.title.toUpperCase()}`, hint: `Пройди «${m.title}» — и этот разворот займёт гость, для которого ты это сделаешь по-настоящему.` });
  }
  const lg = LEGEND_REVIEWS[roleId];
  if (lg) {
    if (examResults?.[roleId]?.passed) pages.push({ kind: "legend", key: "lg_" + roleId, ...lg, source: "ЭКЗАМЕН РОЛИ · СДАН", date: dates["lg_" + roleId] ? ruDate(dates["lg_" + roleId]) : "" });
    else pages.push({ kind: "locked", key: "lg_" + roleId, legend: true, source: "ЛЕГЕНДАРНАЯ СТРАНИЦА", hint: "Сдай экзамен роли — и её займёт гость, о котором рассказывают истории. С печатью." });
  }
  return pages;
}

// ── Баннер «В твоей книге новая страница» (на экране модуля) ──
export function NewPageBanner({ T, mod, completed, quizDone, onOpen }) {
  const [hidden, setHidden] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false); // плавный уход при скрытии
  if (hidden || !mod || !MODULE_REVIEWS[mod.id] || !moduleDone(mod, completed, quizDone)) return null;
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem("sa_book_seen") || "[]"); } catch (e) {}
  if (seen.includes(mod.id)) return null;
  const remember = () => { try { localStorage.setItem("sa_book_seen", JSON.stringify([...seen, mod.id])); } catch (e) {} };
  const dismiss = () => { remember(); setLeaving(true); setTimeout(() => setHidden(true), 380); };
  const open = () => { remember(); onOpen && onOpen(); };
  const lt = !!T?.a11y; // светлая тема: стекло из светлого «пергамента» вместо тёмного дыма
  return (
    <div className="sa-bookbanner" style={{
      position: "sticky", top: 10, zIndex: 40,
      margin: "12px 16px 0", borderRadius: 18, padding: "12px 14px",
      display: "flex", alignItems: "center", gap: 12,
      background: lt ? "rgba(252,246,232,0.72)" : "rgba(24,17,8,0.55)",
      backdropFilter: "blur(10px) saturate(1.15)", WebkitBackdropFilter: "blur(10px) saturate(1.15)",
      border: lt ? "1px solid rgba(160,120,50,0.45)" : "1px solid rgba(200,160,60,0.5)",
      borderTop: lt ? "1px solid rgba(255,250,235,0.9)" : "1px solid rgba(220,180,95,0.65)",
      boxShadow: lt
        ? "0 12px 28px rgba(120,90,30,0.18), 0 2px 8px rgba(120,90,30,0.10), 0 1px 0 rgba(255,250,235,0.7) inset"
        : "0 14px 34px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.35), 0 1px 0 rgba(220,180,95,0.28) inset",
      transform: leaving ? "translateY(-16px)" : undefined,
      opacity: leaving ? 0 : undefined,
      transition: "transform 0.35s ease, opacity 0.35s ease" }}>
      <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 21,
        background: lt ? "radial-gradient(circle at 35% 30%, rgba(200,160,80,0.25), rgba(200,169,110,0.08))" : "radial-gradient(circle at 35% 30%, rgba(220,180,95,0.28), rgba(200,169,110,0.08))",
        border: lt ? "1px solid rgba(139,106,48,0.4)" : `1px solid ${GOLD}55`,
        boxShadow: lt ? "0 0 14px rgba(180,140,60,0.25)" : `0 0 18px ${GOLD}30` }}>📖</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...MONO, color: lt ? "#8B6A30" : GOLD_SOFT, fontSize: 9, letterSpacing: 2 }}>КНИГА ОТЗЫВОВ</div>
        <div style={{ color: T?.modTitle?.color || "#F0E8D8", fontFamily: "Georgia, serif", fontSize: 14.5, marginTop: 3 }}>Гость оставил тебе новую страницу</div>
      </div>
      <button onClick={open} {...onActivate(open)} style={{ ...MONO, flexShrink: 0, fontSize: 10, letterSpacing: 1.5, color: lt ? "#FFF8EC" : "#14100A",
        background: `linear-gradient(135deg, ${lt ? "#A8823E" : GOLD} 0%, #8B6A30 100%)`, border: "none", borderRadius: 14, padding: "9px 13px",
        cursor: "pointer", boxShadow: lt ? "0 4px 12px rgba(139,106,48,0.3)" : "0 4px 14px rgba(200,160,80,0.35)" }}>ЧИТАТЬ ›</button>
      <button onClick={dismiss} {...onActivate(dismiss)} aria-label="Скрыть"
        style={{ background: "none", border: "none", color: lt ? "rgba(120,90,40,0.6)" : "rgba(200,169,110,0.55)", fontSize: 15, lineHeight: 1, padding: "4px 2px", cursor: "pointer", flexShrink: 0 }}>✕</button>
      <style>{`
        @keyframes saBookIn { from { opacity:0; transform: translateY(-20px) scale(0.97); } to { opacity:1; transform: translateY(0) scale(1); } }
        .sa-bookbanner { animation: saBookIn 0.6s cubic-bezier(0.22,1,0.36,1) both; will-change: transform, opacity; }
        @media (prefers-reduced-motion: reduce) { .sa-bookbanner { animation-duration: 0.01s; } }
      `}</style>
    </div>
  );
}

// ── Экран книги ──
export function GuestBookScreen({ T, a11y, profile, role, completed = {}, quizDone = {}, examResults = {}, onBack, onWeekly, focusId }) {
  const [tab, setTab] = React.useState(role && MODULES[role] ? role : "seasonal");
  const [idx, setIdx] = React.useState(0);
  const [dir, setDir] = React.useState("r");

  // Открытие по уведомлению: листаем к заработанной странице
  React.useEffect(() => {
    if (!focusId) return;
    for (const [rid, mods] of Object.entries(MODULES)) {
      if ((mods || []).some(m => m.id === focusId)) {
        const p = buildRolePages(rid, completed, quizDone, examResults, loadDates());
        const i = p.findIndex(pg => pg.key === focusId);
        if (i >= 0) { setTab(rid); setIdx(i); setDir("r"); }
        return;
      }
    }
  }, [focusId]);

  // Свайп по листу: влево — вперёд, вправо — назад
  const touchRef = React.useRef(null);
  const onSwipeStart = (e) => { const t = e.touches && e.touches[0]; if (t) touchRef.current = { x: t.clientX, y: t.clientY }; };
  const onSwipeEnd = (e) => {
    const st = touchRef.current; touchRef.current = null;
    const t = e.changedTouches && e.changedTouches[0];
    if (!st || !t) return;
    const dx = t.clientX - st.x, dy = t.clientY - st.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
  };

  // Даты: фиксируем момент первого появления заработанных страниц
  const dates = React.useMemo(() => {
    const d = loadDates(); let changed = false;
    for (const [rid, mods] of Object.entries(MODULES)) {
      for (const m of mods) if (MODULE_REVIEWS[m.id] && moduleDone(m, completed, quizDone) && !d[m.id]) { d[m.id] = Date.now(); changed = true; }
      if (examResults?.[rid]?.passed && !d["lg_" + rid]) { d["lg_" + rid] = Date.now(); changed = true; }
    }
    if (completed[weeklyLessonId()] && !d[weeklyLessonId()]) { d[weeklyLessonId()] = Date.now(); changed = true; }
    if (changed) try { localStorage.setItem("sa_book_dates", JSON.stringify(d)); } catch (e) {}
    return d;
  }, [completed, quizDone, examResults]);

  const stats = React.useMemo(() => bookStats(MODULES, completed, quizDone, examResults), [completed, quizDone, examResults]);

  // Страницы текущей вкладки
  const wid = weeklyLessonId();
  const pages = React.useMemo(() => {
    if (tab === "weekly") {
      return completed[wid]
        ? [{ kind: "legend", key: wid, ...WEEKLY_REVIEW, seal: "ВЫИГРАН", source: "ГОСТЬ НЕДЕЛИ · ПРОЙДЕН", date: dates[wid] ? ruDate(dates[wid]) : "" }]
        : [{ kind: "challenge", key: wid }];
    }
    return buildRolePages(tab, completed, quizDone, examResults, dates);
  }, [tab, completed, quizDone, examResults, dates, wid]);

  const page = pages[Math.min(idx, pages.length - 1)] || pages[0];
  const go = (d) => { setDir(d > 0 ? "r" : "l"); setIdx(i => Math.min(pages.length - 1, Math.max(0, i + d))); };
  const setTabSafe = (t) => { setTab(t); setIdx(0); setDir("r"); };

  const chips = [...ROLES.filter(r => MODULES[r.id] && (MODULES[r.id] || []).some(m => MODULE_REVIEWS[m.id])).map(r => ({ id: r.id, label: r.shortLabel || r.label })), { id: "weekly", label: "✦ Гость недели" }];
  const earnedInTab = pages.filter(p => p.kind !== "locked" && p.kind !== "challenge").length;

  return (
    <div style={T.screen} className="sa-screen">
      <style>{BOOK_CSS}</style>

      {/* Шапка */}
      <div style={{ ...T.lessHead, justifyContent: "space-between" }}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={{ ...T.lessHeadTitle, display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h6v17H6a2 2 0 0 0-2 2z" /><path d="M20 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 1 2 2z" /><path d="M15 8h2M15 11h2" /></svg>
          <span>Книга отзывов</span></div>
        <div style={{ width: 24 }} />
      </div>

      {/* Звание и прогресс */}
      <div style={{ padding: "10px 16px 0" }}>
        <div style={{ ...T.modCard, alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${GOLD}66`, background: "rgba(200,169,110,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.6 7.6"/><circle cx="11" cy="11" r="1.6"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...T.modTitle, fontSize: 16 }}>{stats.rank.label}</div>
            <div style={{ ...T.modSub, marginTop: 2 }}>
              {stats.pages} стр. · {stats.seals} {stats.seals === 1 ? "печать" : stats.seals >= 2 && stats.seals <= 4 ? "печати" : "печатей"}
              {stats.next ? ` · до «${stats.next.label}» — ${stats.next.min - stats.score}` : " · высшее звание"}
            </div>
          </div>
          <div style={{ ...MONO, color: GOLD, fontSize: 10, letterSpacing: 1, flexShrink: 0 }}>{stats.pages}/{stats.total}</div>
        </div>
      </div>

      {/* Разделы книги */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "12px 16px 2px", WebkitOverflowScrolling: "touch" }}>
        {chips.map(c => (
          <button key={c.id} onClick={() => setTabSafe(c.id)}
            style={{ ...MONO, flexShrink: 0, fontSize: 10, letterSpacing: .5, padding: "7px 12px", borderRadius: 20, cursor: "pointer", border: `1px solid ${tab === c.id ? GOLD : (a11y ? "rgba(140,105,40,.35)" : "#3A2E1E")}`, background: tab === c.id ? "rgba(200,169,110,.15)" : "transparent", color: tab === c.id ? GOLD : T.modSub.color }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Книга */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "12px 16px 6px" }}>
        <div style={{ position: "relative" }} onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
          {/* стопка страниц позади */}
          <div style={{ position: "absolute", inset: "8px -5px -7px -5px", borderRadius: 14, background: "#E8DCC2", transform: "rotate(-1.1deg)", opacity: .45 }} />
          <div style={{ position: "absolute", inset: "5px -3px -4px -3px", borderRadius: 14, background: "#F2E8D0", transform: "rotate(.7deg)", opacity: .65 }} />

          <div key={tab + ":" + idx} className={dir === "r" ? "gb-page-r" : "gb-page-l"}
            style={{ position: "relative", borderRadius: 14, minHeight: 348, padding: "20px 18px 16px", background: page.kind === "locked" ? PAPER_DIM : PAPER, border: page.kind === "legend" ? `1.5px solid ${GOLD_SOFT}` : "1px solid rgba(140,110,50,.25)", boxShadow: "0 12px 30px rgba(0,0,0,.45), inset 0 1px 0 #fff", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* фактура: линейки + прошивка */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, rgba(122,101,72,.10) 28px)", backgroundPosition: "0 78px", pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: 8, top: 12, bottom: 12, width: 1, borderLeft: "1px dashed rgba(122,101,72,.35)", pointerEvents: "none" }} />

            {page.kind === "challenge" ? (
              <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 11 }}>
                <div style={{ ...MONO, color: BROWN, fontSize: 9, letterSpacing: 3 }}>НОВОЕ ИСПЫТАНИЕ КАЖДУЮ НЕДЕЛЮ</div>
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke={BROWN} strokeWidth="1.3" strokeLinecap="round"><path d="M7 11V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6" /><path d="M5.5 11h13a1.5 1.5 0 0 1 0 3h-13a1.5 1.5 0 0 1 0-3z" /><path d="M6.5 14v7M17.5 14v7M7 17.5h10" /></svg>
                <div style={{ ...SCRIPT, color: INK, fontSize: 25, lineHeight: 1.2 }}>Гость недели уже за столиком…</div>
                <div style={{ color: BROWN, fontSize: 13.5, lineHeight: 1.65, maxWidth: 258 }}>Сложный живой диалог. Проведи его достойно — и получи страницу с печатью. Не получится — гость уйдёт без отзыва, но вернётся: попробуешь снова.</div>
                <button onClick={onWeekly} {...onActivate(onWeekly)} style={{ ...MONO, marginTop: 4, fontSize: 11, letterSpacing: 2, color: PAPER, background: `linear-gradient(135deg, ${GOLD_SOFT}, #8B6A30)`, border: "none", borderRadius: 16, padding: "10px 22px", boxShadow: "0 4px 14px rgba(139,106,48,.4)", cursor: "pointer" }}>ПРИНЯТЬ СТОЛ ›</button>
              </div>
            ) : page.kind === "locked" ? (
              <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 11, opacity: .88 }}>
                {page.legend
                  ? <div style={{ width: 52, height: 52, borderRadius: "50%", border: `1.5px dashed ${BROWN}`, display: "flex", alignItems: "center", justifyContent: "center", color: BROWN, fontSize: 20 }}>✦</div>
                  : <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={BROWN} strokeWidth="1.4" strokeLinecap="round"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>}
                <div style={{ ...SCRIPT, color: BROWN, fontSize: 24 }}>Здесь появится отзыв</div>
                <div style={{ color: BROWN, fontSize: 13.5, lineHeight: 1.65, maxWidth: 250 }}>{page.hint}</div>
                <div style={{ ...MONO, color: "#9A855C", fontSize: 9, letterSpacing: 2, border: "1px solid rgba(122,101,72,.3)", borderRadius: 10, padding: "5px 12px" }}>{page.source}</div>
              </div>
            ) : (
              <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ ...MONO, color: "#9A855C", fontSize: 9, letterSpacing: 2 }}>{(page.date ? page.date + " · " : "") + page.table.toUpperCase()}</div>
                  <div style={{ color: GOLD_SOFT, fontSize: 13, letterSpacing: 2 }}>★★★★★</div>
                </div>
                <div style={{ ...SCRIPT, color: INK, fontSize: 20.5, lineHeight: "28px", marginTop: 14, flex: 1 }}>{page.text}</div>
                <div style={{ ...SCRIPT, color: BROWN, fontSize: 20, textAlign: "right", marginTop: 6 }}>— {page.guest}</div>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ ...MONO, color: "#9A855C", fontSize: 8.5, letterSpacing: 1.5, border: "1px solid rgba(122,101,72,.35)", borderRadius: 8, padding: "5px 10px", transform: "rotate(-2deg)" }}>✓ {page.source}</div>
                  {page.kind === "legend" && (
                    <div className="gb-seal" style={{ width: 58, height: 58, borderRadius: "50%", flexShrink: 0, background: `radial-gradient(circle at 34% 30%, #B0492F, ${WAX} 62%, #5E1F12)`, boxShadow: "0 4px 10px rgba(94,31,18,.45), inset 0 2px 4px rgba(255,255,255,.22), inset 0 -3px 6px rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 43, height: 43, borderRadius: "50%", border: "1px solid rgba(255,220,190,.4)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                        <span style={{ fontSize: 12 }}>✦</span>
                        <span style={{ ...MONO, color: "#F5DFC8", fontSize: 5.5, letterSpacing: 1 }}>{page.seal}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Листание */}
        {pages.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "0 4px" }}>
            <button onClick={() => go(-1)} disabled={idx === 0} style={{ background: "transparent", border: `1px solid ${idx === 0 ? "rgba(120,100,60,.25)" : GOLD + "66"}`, color: idx === 0 ? "rgba(120,100,60,.4)" : GOLD, borderRadius: 20, padding: "6px 15px", fontSize: 15, cursor: idx === 0 ? "default" : "pointer", fontFamily: "Georgia, serif" }}>‹</button>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center", maxWidth: 220 }}>
              {pages.map((p, i) => (
                <div key={p.key} onClick={() => { setDir(i > idx ? "r" : "l"); setIdx(i); }}
                  style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 3, cursor: "pointer", transition: "all .25s ease", background: i === idx ? GOLD : p.kind === "locked" ? (a11y ? "rgba(120,100,60,.3)" : "#3A2E1E") : p.kind === "legend" ? WAX : "rgba(200,169,110,.45)" }} />
              ))}
            </div>
            <button onClick={() => go(1)} disabled={idx === pages.length - 1} style={{ background: "transparent", border: `1px solid ${idx === pages.length - 1 ? "rgba(120,100,60,.25)" : GOLD + "66"}`, color: idx === pages.length - 1 ? "rgba(120,100,60,.4)" : GOLD, borderRadius: 20, padding: "6px 15px", fontSize: 15, cursor: idx === pages.length - 1 ? "default" : "pointer", fontFamily: "Georgia, serif" }}>›</button>
          </div>
        )}
        <div style={{ ...MONO, color: T.modSub.color, fontSize: 9, letterSpacing: 1, textAlign: "center", marginTop: 10, opacity: .8 }}>
          {tab === "weekly" ? "НОВЫЙ ГОСТЬ — КАЖДЫЙ ПОНЕДЕЛЬНИК" : `ЗАПОЛНЕНО В РАЗДЕЛЕ: ${earnedInTab} ИЗ ${pages.length}`}
        </div>
        <div style={{ height: 10 }} />
      </div>
    </div>
  );
}

// Пропуск веса: звание для профиля считается через bookStats из data/reviews.
export { bookStats, weeklyDialogueId, weeklyLessonId };
