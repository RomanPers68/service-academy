import React from "react";
import { LOGO_SRC_DARK } from "../assets/logo";
import { onActivate, vibrate } from "../lib/utils";

// ── Дополнение 133: вкладки «Смена», «Команда», «Я» ───────────────────────────
// Один компонент-хаб: заголовок с малым фирменным знаком, подзаголовок и список
// карточек-разделов в стиле «Морозный след» — иней без блюра: мягкое внутреннее
// свечение по всей площади, светящаяся кромка. Работает в тёмной и светлой темах.
// Ничего нового не делает — только ведёт в существующие экраны.

const ICON = {
  schedule: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
  checklist: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 9l2 2 4-4M8 16h8"/></svg>,
  guest: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  book: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7M8 11h5"/></svg>,
  onboarding: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M5 12v5c0 1.5 3 3 7 3s7-1.5 7-3v-5"/></svg>,
  daily: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>,
  trophy: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6"/></svg>,
  stats: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>,
  mentor: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6M15 11l2 2 4-4"/><path d="M14 20c0-2.5 2-4.5 5-4.5"/></svg>,
  analytics: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 4"/></svg>,
  team: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 19c0-2.5 2-4.5 4.5-4.5S23 16.5 23 19"/></svg>,
  hire: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>,
  edit: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1z"/><path d="M14.5 6.5l3 3"/></svg>,
  profile: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>,
  cert: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M9 12.8L8 22l4-2.2L16 22l-1-9.2"/></svg>,
  roles: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h10M4 18h7"/></svg>,
  mistakes: (c) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>,
};

export function HubScreen({ T, a11y, title, subtitle, items = [], footer }) {
  const gold = a11y ? "#8B6A30" : "#D2A85A";
  const text = T.modTitle?.color || (a11y ? "#2A1F0E" : "#EFE4C8");
  const sub = T.modSub?.color || (a11y ? "#6B5A3E" : "#9C8760");
  // «Морозный след»: иней без блюра
  const frost = {
    background: a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.09)",
    border: a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)",
    boxShadow: a11y
      ? "inset 0 0 26px rgba(255,255,255,0.55), inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 18px rgba(120,85,25,0.14)"
      : "inset 0 0 26px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.45)",
  };
  return (
    <div style={T.screen} className="sa-screen">
      <div style={{ padding: "18px 16px 8px", display: "flex", alignItems: "center", gap: 12 }}>
        <img src={LOGO_SRC_DARK} alt="" aria-hidden="true" style={{ width: 44, height: 36, objectFit: "contain", filter: a11y ? "none" : "brightness(0) saturate(100%) invert(95%) sepia(10%) saturate(400%) hue-rotate(340deg) brightness(98%)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 24, color: text, lineHeight: 1.15 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12.5, color: sub, marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: "6px 16px 100px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.filter(Boolean).map(it => {
          const c = it.red ? (a11y ? "#A0402E" : "#E07A6E") : gold;
          const go = () => { vibrate("light"); it.onClick && it.onClick(); };
          return (
            <div key={it.key} className="sa-card" onClick={go} {...onActivate(go)} aria-label={it.label}
              style={{ ...frost, borderRadius: 18, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13, cursor: "pointer", position: "relative", overflow: "hidden", WebkitTapHighlightColor: "transparent" }}>
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `linear-gradient(118deg, transparent 30%, ${a11y ? "rgba(255,255,255,0.22)" : "rgba(255,245,220,0.05)"} 44%, transparent 58%)` }} />
              <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: a11y ? "rgba(139,106,48,0.10)" : "rgba(214,178,102,0.10)", border: `1px solid ${c}44` }}>
                {(ICON[it.icon] || ICON.book)(c)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 16.5, color: it.red ? c : text, lineHeight: 1.25 }}>{it.label}</div>
                {it.sub && <div style={{ fontSize: 12.5, color: sub, marginTop: 3, lineHeight: 1.4 }}>{it.sub}</div>}
              </div>
              {it.badge ? <span style={{ minWidth: 22, height: 22, padding: "0 7px", borderRadius: 11, background: c, color: a11y ? "#fff" : "#1a160f", fontSize: 12, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{it.badge}</span>
                : <span style={{ color: c, fontSize: 20, opacity: 0.7, flexShrink: 0 }}>›</span>}
            </div>
          );
        })}
        {footer}
      </div>
    </div>
  );
}
