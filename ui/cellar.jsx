// ui/cellar.jsx — v31: «Погреб тем».
//
// Все темы трека одним списком: свежесть каждой (бокал — полный, к донышку, «обновлено»),
// золото раунда мастера, зачёт на опыт, что ещё не пройдено. Сверху — «Освежить всё
// выдохшееся» (одним заходом, 2–3 темы) и «Проверка по треку» для тех, кто пришёл с опытом.
// Прогресс здесь не меняется — только показывает и ведёт к нужному действию.
import React from "react";
import { GOLD, goldText } from "./tokens";
import { vibrate, onActivate } from "../lib/utils";
import { topicFreshness, freshLabel, wineLevel, moduleDone } from "../lib/freshness";
import { canRefresh, canGold, canCredit } from "../lib/marks";
import { useHintOnce, HintBubble } from "./widgets";
import { hintsFor } from "../data/hints";

const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b; return c; };
const labelOf = (m, i, customNo) => { const d = String((m && m.tag) || "").match(/\d+/); if (d) return d[0]; if (m && m.custom) return customNo > 1 ? "✦" : "✦"; return String(i + 1); };

// бокал со «свежестью»: level — от 0 до 1, null — тема не пройдена (пустой контур)
export function WineGlass({ level, size = 26, color = GOLD, gold = false, updated = false, a11y = false }) {
  const fill = gold ? (a11y ? "#B8902E" : "#E8C56A") : updated ? (a11y ? "#2F5A86" : "#8FB0D6") : color;
  const h = level == null ? 0 : Math.max(0.08, Math.min(1, level));
  const top = 3, bowl = 13;   // чаша от y=3 до y=16
  const y = top + bowl * (1 - h);
  const id = React.useMemo(() => "wg" + Math.random().toString(36).slice(2, 8), []);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs><clipPath id={id}><path d="M6 3h12c0 6-2 11-6 13-4-2-6-7-6-13z" /></clipPath></defs>
      {level != null ? <rect x="4" y={y} width="16" height={20 - y} fill={fill} opacity={gold ? 0.95 : 0.85} clipPath={`url(#${id})`} /> : null}
      <path d="M6 3h12c0 6-2 11-6 13-4-2-6-7-6-13z" fill="none" stroke={gold ? fill : color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 16v5M8.5 21h7" fill="none" stroke={gold ? fill : color} strokeWidth="1.4" strokeLinecap="round" />
      {gold ? <path d="M18.5 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill={fill} /> : null}
    </svg>
  );
}

export function CellarScreen({ T, a11y, modules = [], completed = {}, quizDone = {}, marks = { fresh: {}, credit: {}, gold: {} }, tried = () => false,
  onBack, onOpenTopic, onRefresh, onGold, onCredit, onFreshAll, onProbe, probeCount = 0 }) {
  const [filter, setFilterRaw] = React.useState(() => { try { return localStorage.getItem("sa_cellar_filter") || "all"; } catch (e) { return "all"; } });
  const setFilter = (v) => { vibrate("light"); setFilterRaw(v); try { localStorage.setItem("sa_cellar_filter", v); } catch (e) {} };
  const [hint, hintDone] = useHintOnce("cellar");
  const [hstep, setHstep] = React.useState(0);
  const hsteps = hintsFor("cellar");
  const gold = goldText(a11y);
  const text = T.modTitle.color, sub = T.modSub.color;
  const customN = modules.filter((m) => m && m.custom).length;
  const rows = React.useMemo(() => modules.map((m, i) => {
    const steps = (m.lessons || []).filter((l) => l && l.type !== "result");
    const dn = steps.filter((l) => (l.type === "quiz" ? !!quizDone[l.id] : !!completed[l.id])).length;
    const done = moduleDone(m, completed, quizDone);
    const fr = canRefresh(m);
    const f = done && fr ? topicFreshness(m, marks.fresh, completed, quizDone) : null;
    const g = (marks.gold || {})[m.id] || null;
    const cr = (marks.credit || {})[m.id] || null;
    return { m, i, label: labelOf(m, i, customN), steps: steps.length, dn, done, f, gold: g, credit: cr, canGold: canGold(m), canCredit: canCredit(m), fr };
  }), [modules, completed, quizDone, marks, customN]);
  const doneN = rows.filter((r) => r.done).length;
  const goldN = rows.filter((r) => r.gold).length;
  const goldMax = rows.filter((r) => r.canGold).length;
  const fading = rows.filter((r) => r.f && r.f.level !== "fresh").sort((a, b) => (a.f.k - b.f.k) || (b.f.days - a.f.days));
  const freshN = rows.filter((r) => r.f && r.f.level === "fresh").length;
  const creditN = rows.filter((r) => r.credit).length;
  const list = filter === "fade" ? fading : filter === "gold" ? rows.filter((r) => r.done && r.canGold).sort((a, b) => (b.gold ? 1 : 0) - (a.gold ? 1 : 0)) : rows;
  const card = { background: a11y ? "rgba(250,242,222,0.55)" : "rgba(226,186,116,0.06)", border: `1px solid ${GOLD}44`, borderRadius: 14, padding: "12px 14px", marginBottom: 12 };
  const btn = (primary) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: primary ? "11px 16px" : "8px 12px", borderRadius: 999, cursor: "pointer",
    border: primary ? 0 : `1px solid ${GOLD}88`, background: primary ? "linear-gradient(180deg,#E4C88C,#C8A96E)" : "transparent",
    color: primary ? "#1A1008" : (a11y ? "#5A4119" : "#D9B87C"), font: (primary ? "700 14.5px" : "700 12.5px") + " Georgia, serif", whiteSpace: "nowrap" });
  const status = (r) => {
    if (!r.done) return r.dn ? "пройдено " + r.dn + " из " + r.steps : "ещё не начата";
    const parts = [];
    if (r.f) parts.push(freshLabel(r.f)); else parts.push("пройдена");
    if (r.gold) parts.push("золото ✦"); if (r.credit) parts.push("по опыту");
    return parts.join(" · ");
  };
  const action = (r) => {
    if (r.done && r.f && r.f.level !== "fresh" && onRefresh) return { label: "Освежить", go: () => onRefresh(r.m), primary: true };
    if (r.done && r.canGold && !r.gold && onGold) return { label: "Раунд мастера ✦", go: () => onGold(r.m) };
    if (!r.done && r.canCredit && onCredit && !tried(r.m.id)) return { label: "Зачёт на опыт", go: () => onCredit(r.m) };
    return null;
  };
  return (
    <div style={T.screen} className="sa-screen">
      <div style={{ ...T.lessHead, justifyContent: "space-between" }}>
        <button style={T.backBtn2} onClick={onBack} aria-label="Назад">‹</button>
        <div style={{ ...T.lessHeadTitle, display: "flex", alignItems: "center", gap: 8 }}><WineGlass level={0.7} size={20} a11y={a11y} /><span>Погреб тем</span></div>
        <div style={{ width: 24 }} />
      </div>
      <div style={{ padding: "12px 16px 100px" }}>
        {hint && hsteps.length ? <HintBubble a11y={!!a11y} text={hsteps[hstep]} arrow="up" step={hstep + 1} total={hsteps.length}
          onNext={hstep >= hsteps.length - 1 ? null : () => setHstep((v) => v + 1)} onClose={hintDone} /> : null}
        <div style={card} role="group" aria-label="Сводка">
          <div style={{ fontSize: 11, letterSpacing: 1.6, color: gold, fontFamily: "monospace" }}>ТВОЙ ПОГРЕБ · {doneN} {plural(doneN, "ТЕМА", "ТЕМЫ", "ТЕМ").toUpperCase()} ИЗ {rows.length}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
            {[[freshN, "свежих", 1], [fading.length, plural(fading.length, "выдыхается", "выдыхаются", "выдыхаются"), 0.35], [goldN + (goldMax ? "/" + goldMax : ""), "золото ✦", null]].map(([v, l, lv], k) => (
              <div key={k} style={{ textAlign: "center", padding: "8px 4px", borderRadius: 12, border: `1px solid ${GOLD}33` }}>
                <div style={{ display: "flex", justifyContent: "center" }}><WineGlass level={lv == null ? 1 : lv} gold={lv == null} size={22} a11y={a11y} /></div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: "bold", color: text, lineHeight: 1.1, marginTop: 2 }}>{v}</div>
                <div style={{ fontSize: 11.5, color: sub }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: sub, marginTop: 10, lineHeight: 1.45 }}>Пройденная тема выдыхается, как открытое вино: бокал под номером темы пустеет. Освежил — снова полный, а следующий повтор позже{creditN ? ". По опыту засчитано: " + creditN : ""}.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {fading.length && onFreshAll ? <button type="button" style={btn(true)} onClick={onFreshAll}>Освежить всё выдохшееся · {Math.min(3, fading.length) === 1 ? "1 мин" : "≈ 3 мин"}</button> : null}
            {probeCount >= 2 && onProbe ? <button type="button" style={btn(false)} onClick={onProbe}>Проверка по треку · {probeCount * 2} {plural(probeCount * 2, "задание", "задания", "заданий")}</button> : null}
          </div>
        </div>
        <div role="group" aria-label="Какие темы показать" style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[["all", "Все"], ["fade", "Освежить" + (fading.length ? " · " + fading.length : "")], ["gold", "Золото"]].map(([id, l]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
              style={{ padding: "7px 13px", borderRadius: 999, cursor: "pointer", font: "700 12.5px Georgia, serif", border: `1px solid ${filter === id ? GOLD + "AA" : GOLD + "33"}`,
                background: filter === id ? (a11y ? "rgba(255,255,255,0.6)" : "rgba(226,186,116,0.12)") : "transparent", color: filter === id ? text : sub }}>{l}</button>
          ))}
        </div>
        {list.length === 0 ? <div style={{ color: sub, fontSize: 13.5, padding: "14px 2px" }}>{filter === "fade" ? "Всё свежее — освежать нечего ✦" : filter === "gold" ? "Пройди тему — и раунд мастера откроется." : "Тем пока нет."}</div> : null}
        <div role="list" aria-label="Темы трека">
          {list.map((r) => {
            const a = action(r);
            const open = () => { vibrate("light"); onOpenTopic && onOpenTopic(r.m); };
            return (
              <div key={r.m.id} role="listitem" className="sa-card" style={{ ...T.modCard, marginBottom: 8, gap: 10, alignItems: "center" }}>
                <div role="button" tabIndex={0} onClick={open} {...onActivate(open)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, cursor: "pointer" }}
                  aria-label={"Тема " + r.label + ": " + r.m.title + " — " + status(r)}>
                  <div style={{ position: "relative", width: 34, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <WineGlass level={r.done ? (r.f ? wineLevel(r.f) : 1) : null} gold={!!r.gold} updated={!!(r.f && r.f.updated)} size={26} color={a11y ? "#8B6A30" : GOLD} a11y={a11y} />
                    <span style={{ fontFamily: "Georgia, serif", fontSize: 11, color: sub, marginTop: -1 }}>{r.label}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...T.modTitle, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.m.title}</div>
                    <div style={{ color: r.f && r.f.level === "faded" ? (a11y ? "#8A4B1E" : "#E0A070") : sub, fontSize: 12.5 }}>{status(r)}</div>
                  </div>
                </div>
                {a ? <button type="button" style={btn(a.primary)} onClick={() => { vibrate("light"); a.go(); }}>{a.label}</button> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CellarScreen;
