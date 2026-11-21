// ui/lesson-look.jsx — v191 (Доп. 516): текст блока «О нас» так, как его покажет урок.
//
// Владелец (21.11): «давай сделаем так, что бы он красиво составлял текст, по типу того, что у нас уже собранно в
// уроках. А то выглядит инородно».
// Те же строки, что рисует экран урока (ui/screens-learning.jsx): первая мысль крупно (lib/lesson-photo.js, lessonLead),
// **подзаголовок**, «• » список, ☑ чек-лист, ✅ как надо, 🚫 и ❌ нельзя, 📌 вывод в рамке, 1️⃣ шаги кружком, цветные
// точки, 🔹, «ёлочки» — фраза гостю, строка-значок — разделитель. Без словаря терминов и диалогов: это просмотр.
// Где: «О нас» (текст блоков), правка блока («Как в уроке»), «Из документа» (что получится) и «Оформить как в уроках».
// cards — показать, где экран урока начнёт новую карточку (lib/lesson-cards.js).
import React from "react";
import { UI_SVG, MARKER_RE } from "./icons";
import { SitIcon } from "./table-bits";
import { iconForEmoji, LEAD_EMOJI_RE, ONE_EMOJI_RE } from "../lib/situation-icons";
import { lessonLead } from "../lib/lesson-photo";
import { lessonCards } from "../lib/lesson-cards";
import { lineKind } from "../lib/lesson-look";
import { typo } from "../lib/typo";
import { GOLD, GREEN, RED } from "./tokens";
import { ACCENT_SERIF } from "./styles";

const EMOJI_ONLY = /^[\p{Extended_Pictographic}\s\uFE0F\u200D]+$/u;
const LEVEL = { blue: "#5B8DD9", green: GREEN, yellow: "#D9C75B", orange: "#E0975B", red: RED };

// жирное внутри строки: «**Ликёры** — сладкие настойки»
function inline(text, st) {
  const t = typo(text);
  if (!t.includes("**")) return t;
  return t.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p, k) => (p.startsWith("**") && p.endsWith("**")
    ? <b key={k} style={{ color: st && st.color, fontWeight: "bold" }}>{p.slice(2, -2)}</b> : <React.Fragment key={k}>{p}</React.Fragment>));
}

function Line({ line, i, T, color, lead }) {
  const t = line.trim();
  if (!t) return <div style={{ height: 10 }} />;
  if (EMOJI_ONLY.test(t) && t.length <= 12) {
    const one = (t.match(ONE_EMOJI_RE) || [t])[0], ic = iconForEmoji(one);
    return (
      <div data-look="div" style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 6px" }}>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${color}55)` }} />
        <span style={{ display: "inline-flex", color }} aria-hidden="true">{ic ? <SitIcon name={ic} s={24} /> : <span style={{ width: 7, height: 7, margin: "0 3px", transform: "rotate(45deg)", background: color, opacity: 0.75, display: "inline-block" }} />}</span>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${color}55)` }} />
      </div>);
  }
  if (t.startsWith("**") && t.endsWith("**") && t.length > 4) return <div data-look="head" style={T.bold}>{typo(t.replace(/\*\*/g, ""))}</div>;
  if (t.startsWith("•")) return <div data-look="dot" style={T.bullet}>{inline(t, T.bullet)}</div>;
  const marker = (style, icon, kind) => (
    <div data-look={kind} style={{ ...style, display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, marginTop: 2, display: "inline-flex" }}>{icon}</span>
      <span style={{ flex: 1 }}>{typo(t.replace(MARKER_RE, "").replace(/\*\*/g, ""))}</span>
    </div>);
  const mk = lineKind(t);   // значок в начале строки (lib/lesson-look.js)
  if (mk) {
    if (mk.k === "check") return marker(T.check, UI_SVG.checkSquare(GOLD, 14), "check");
    if (mk.k === "ban") return marker(T.forbidden, UI_SVG.ban(RED, 14), "ban");
    if (mk.k === "good") return marker(T.good, UI_SVG.checkCircle(GREEN, 14), "good");
    if (mk.k === "bad") return marker(T.bad, UI_SVG.xCircle(RED, 14), "bad");
    if (mk.k === "pin") return marker(T.note, UI_SVG.pin(color, 14), "pin");
    if (mk.k === "step") return marker(T.principle, <span style={{ width: 19, height: 19, borderRadius: 9, border: `1.5px solid ${color}`, color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold", fontFamily: "Georgia, serif" }}>{mk.n}</span>, "step");
    if (mk.k === "level") { const dot = LEVEL[mk.level]; return marker(T.principle, <span style={{ width: 9, height: 9, borderRadius: 6, background: dot, marginTop: 2, boxShadow: `0 0 8px ${dot}55`, display: "inline-block" }} />, "level"); }
    if (mk.k === "star") return marker(T.principle, <svg width="14" height="14" viewBox="0 0 24 24" fill={GOLD} stroke={GOLD} strokeWidth="1" strokeLinejoin="round" style={{ marginTop: 2 }}><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8z" /></svg>, "star");
    if (mk.k === "diamond") return marker(T.principle, <span style={{ width: 8, height: 8, background: "#5B8DD9", transform: "rotate(45deg)", borderRadius: 3, marginTop: 4, boxShadow: "0 0 6px #5B8DD955", display: "inline-block" }} />, "diamond");
  }
  const lm = t.match(LEAD_EMOJI_RE);
  if (lm) {
    const ic = iconForEmoji(lm[1]);
    return (
      <div data-look="lead-emoji" style={{ ...T.para, display: "flex", gap: 8, alignItems: "flex-start" }}>
        {ic ? <span style={{ flexShrink: 0, marginTop: 3, display: "inline-flex", color }}><SitIcon name={ic} s={15} /></span> : null}
        <span style={{ flex: 1 }}>{inline(t.slice(lm[0].length), T.para)}</span>
      </div>);
  }
  if (t.startsWith("«") && t.includes("»")) return <div data-look="quote" style={{ ...T.quote, borderLeftColor: color }}>{typo(t)}</div>;
  if (lead && line === lead.line) {
    const hi = T.a11y ? "#7A5A1E" : "#E8C983";
    const big = lead.lead.includes("**") ? lead.lead.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p, k) => (p.startsWith("**") && p.endsWith("**")
      ? <span key={k} style={{ color: hi }}>{typo(p.slice(2, -2))}</span> : <React.Fragment key={k}>{typo(p)}</React.Fragment>)) : typo(lead.lead);
    return (
      <>
        <div data-look="lead" style={{ ...T.para, fontFamily: ACCENT_SERIF, fontWeight: 700, fontSize: T.a11y ? 21.5 : 19.5, lineHeight: 1.36, letterSpacing: -0.1,
          color: T.a11y ? "#2A1F0E" : "#F2E8D2", margin: "0 0 12px" }}>{big}</div>
        {lead.rest ? <div style={T.para}>{inline(lead.rest, T.para)}</div> : null}
      </>);
  }
  return <div data-look="para" style={T.para}>{inline(t, T.para)}</div>;
}

/**
 * Текст «как в уроке»: стеклянная карточка урока, title — заголовок урока над ней (по желанию). bare — только строки,
 * без карточки (внутри своей карточки, как в «О нас»).
 */
export function LessonLook({ text, T, color = GOLD, title = "", cards = false, compact = false, bare = false }) {
  const src = String(text || "");
  const lead = React.useMemo(() => lessonLead(src), [src]);
  const parts = React.useMemo(() => (cards ? lessonCards(src) : [src.split("\n")]), [src, cards]);
  const glass = T.lessGlass || {};
  if (bare) return <div data-lesson-look="bare">{src.split("\n").map((ln, i) => <Line key={i} line={ln} i={i} T={T} color={color} lead={lead} />)}</div>;
  return (
    <div data-lesson-look={parts.length}>
      {title ? <div style={{ fontFamily: ACCENT_SERIF, fontSize: compact ? 17 : 19, fontWeight: 700, color: T.modTitle && T.modTitle.color, lineHeight: 1.3, margin: "2px 2px 8px" }}>{typo(title)}</div> : null}
      <div data-lens-card="" style={{ background: glass.bg || "rgba(255,250,238,0.05)", border: glass.border || "1px solid rgba(150,112,42,0.38)",
        borderTop: glass.borderTop || "1px solid rgba(215,170,68,0.46)", borderRadius: compact ? 18 : 22, boxShadow: glass.shadow || "none",
        padding: compact ? "14px 14px" : "18px 16px", position: "relative" }}>
        {parts.map((lines, ci) => (
          <div key={ci} data-look-card={ci + 1}>
            {ci ? <div aria-hidden="true" data-look-cut="" style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 10px", color: T.modSub ? T.modSub.color : "#A89B80", fontSize: 11.5, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
              <div style={{ flex: 1, borderTop: "1px dashed " + color + "55" }} /><span>карточка {ci + 1}</span><div style={{ flex: 1, borderTop: "1px dashed " + color + "55" }} /></div> : null}
            {lines.map((ln, i) => <Line key={i} line={ln} i={i} T={T} color={color} lead={ci === 0 ? lead : null} />)}
          </div>))}
      </div>
    </div>);
}
