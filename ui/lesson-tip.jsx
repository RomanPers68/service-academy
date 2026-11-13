// ui/lesson-tip.jsx — v148 (Доп. 472): совет в конце урока (что показать — lib/lesson-tips.js, тексты — data/lesson-tips.js).
// Тихая карточка над «Закрепить у стола» / «Урок пройден»: значок функции в линзе, «Совет · <функция>», две фразы,
// кнопка, которая сразу открывает функцию, и «Не сейчас». Без всплывающих окон и звуков; цвет — цвет трека урока.
import React from "react";
import { UI_SVG, GAME_SVG, NAV_ICONS } from "./icons";
import { labelStyle } from "./tokens";
import { FamIcon, msTie } from "./mastery-card";   // у инструментов «Пути мастера» — их же значок; предлоги — с неразрывным пробелом

const ICON = (name) => {
  if (UI_SVG[name]) return (c, s) => UI_SVG[name](c, s);
  if (GAME_SVG[name]) return (c, s) => GAME_SVG[name](c, s);
  if (NAV_ICONS[name]) return (c) => NAV_ICONS[name](c);
  if (name === "guest") return (c) => NAV_ICONS.team(c);
  return (c, s) => UI_SVG.bulb(c, s);
};

// тире не начинает строку, короткие слова не висят в конце строки
const tie = (t) => msTie(t).replace(/ —/g, "\u00A0—");

export function LessonTip({ tip, T, color = "#C8A96E", a11y = false, onGo, onLater, onShown }) {
  // показ считается, когда карточку увидели (половина на экране), а не когда урок открыли: не дочитал — совет дня не потрачен
  const box = React.useRef(null);
  React.useEffect(() => {
    if (!tip || !onShown) return undefined;
    let fired = false;
    const fire = () => { if (!fired) { fired = true; onShown(tip); } };
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") { fire(); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) { fire(); io.disconnect(); } }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [tip && tip.id, tip && tip.lesson]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!tip) return null;
  const ink = (T && T.modTitle && T.modTitle.color) || (a11y ? "#2A1F0E" : "#F2E8D2");
  const sub = (T && T.modSub && T.modSub.color) || (a11y ? "#6D5A40" : "#B9AE96");
  const hl = a11y ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.12)";
  const icon = tip.fam ? (c, sz) => <FamIcon id={tip.fam} size={sz} color={c} /> : ICON(tip.icon);
  const go = (e) => { if (e) e.stopPropagation(); if (onGo) onGo(tip); };
  const later = (e) => { if (e) e.stopPropagation(); if (onLater) onLater(tip); };
  return (
    <div ref={box} data-lesson-tip={tip.id} className="sa-fadein" style={{ display: "flex", gap: 12, alignItems: "flex-start", margin: "0 0 14px", padding: "13px 14px 12px",
      borderRadius: 16, textAlign: "left", background: color + (a11y ? "12" : "16"), boxShadow: `inset 0 0 0 1px ${color}${a11y ? "66" : "59"}, inset 0 1.5px 0 ${hl}` }}>
      <span aria-hidden="true" data-tip-icon="" style={{ flex: "0 0 38px", width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center",
        background: color + (a11y ? "1A" : "24"), boxShadow: `inset 0 0 0 1px ${color}${a11y ? "8C" : "80"}, inset 0 1.5px 0 ${hl}` }}>{icon(color, 20)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div data-tip-label="" style={{ ...labelStyle(a11y ? 13.5 : 12.5), color: sub }}>Совет · {tip.name}</div>
        <div data-tip-text="" style={{ fontFamily: "Georgia, 'PT Serif', serif", fontSize: a11y ? 16 : 14.5, lineHeight: 1.42, color: ink, marginTop: 3 }}>{tie(tip.text)}</div>
        <div style={{ display: "flex", alignItems: "center", columnGap: 14, rowGap: 2, marginTop: 10, flexWrap: "wrap" }}>   {/* v149: на узком экране «Не сейчас» уходит под кнопку — без лишнего зазора */}
          <button type="button" data-tip-go="" data-lens-btn="soft" data-lens-ink="" onClick={go}
            style={{ fontFamily: "Georgia, 'PT Serif', serif", fontWeight: "bold", fontSize: a11y ? 15 : 13.5, color: ink, padding: "6px 14px", borderRadius: 999, cursor: "pointer",
              background: color + (a11y ? "1F" : "26"), border: `1px solid ${color}${a11y ? "8C" : "80"}`, WebkitTapHighlightColor: "transparent" }}>{tip.cta}</button>
          <button type="button" data-tip-later="" onClick={later}
            style={{ fontFamily: "Georgia, 'PT Serif', serif", fontSize: a11y ? 14.5 : 13, color: sub, padding: "6px 2px", background: "none", border: "none", cursor: "pointer",
              WebkitTapHighlightColor: "transparent" }}>Не сейчас</button>
        </div>
      </div>
    </div>
  );
}
