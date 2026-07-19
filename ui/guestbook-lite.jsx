// ui/guestbook-lite.jsx
// Лёгкая часть «Книги отзывов», нужная на главных экранах: счётчик
// непрочитанных страниц и баннер «новая страница». Вынесена отдельно,
// чтобы сама книга (тяжёлый интерфейс) подгружалась лениво.
import React from "react";
import { GOLD } from "./tokens";
import { onActivate, vibrate } from "../lib/utils";
import { MODULES } from "../data/modules";
import { MODULE_REVIEWS, LEGEND_REVIEWS, moduleDone } from "../data/reviews";

const GOLD_SOFT = "#D4A85A";
const MONO = { fontFamily: "ui-monospace, Menlo, monospace" };
const loadRead = () => { try { return JSON.parse(localStorage.getItem("sa_book_read") || "[]"); } catch (e) { return []; } };

// Сколько заработанных, но ещё не прочитанных страниц (для бейджа на плитке «Книга»)
export function countUnreadPages(completed, quizDone, examResults) {
  const read = loadRead();
  let n = 0;
  for (const [rid, mods] of Object.entries(MODULES)) {
    for (const m of (mods || [])) if (MODULE_REVIEWS[m.id] && moduleDone(m, completed, quizDone) && !read.includes(m.id)) n++;
    if (LEGEND_REVIEWS[rid] && examResults?.[rid]?.passed && !read.includes("lg_" + rid)) n++;
  }
  return n;
}

// ── Баннер «В твоей книге новая страница» (на экране модуля) ──
export function NewPageBanner({ T, mod, completed, quizDone, onOpen }) {
  const [hidden, setHidden] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false); // плавный уход при скрытии
  if (hidden || !mod || !MODULE_REVIEWS[mod.id] || !moduleDone(mod, completed, quizDone)) return null;
  let read = [];
  // Баннер живёт, пока страница реально не прочитана в книге (см. markRead в GuestBookScreen)
  try { read = JSON.parse(localStorage.getItem("sa_book_read") || "[]"); } catch (e) {}
  if (read.includes(mod.id)) return null;
  // ✕ скрывает баннер только до следующего захода — навсегда гасит лишь реальное прочтение
  const dismiss = () => { vibrate("light"); setLeaving(true); setTimeout(() => setHidden(true), 380); };
  const open = () => { vibrate("medium"); onOpen && onOpen(); };
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
