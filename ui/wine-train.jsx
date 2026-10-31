// ui/wine-train.jsx — v123 (Доп. 436): тренировка по винной карте.
//
// Владелец (31.10): «Вин будет достаточно и, к большому сожалению, их учить очень сложно, особенно для новичка. Может,
// сделаем как в меню, с тренировками, викторинами и т. д.?». Как в тренажёре меню: «Колода вин» (свайп, переворот,
// «Знаю?» с повтором через 1, 3, 7, 30 дней и «Наоборот»: вино по описанию гостя), «Викторина по винам» (вопросы по своей
// карте, lib/wine-train.js), «Новые вина» (добавленные за 30 дней) и путь новичка: сначала вина бокалом. В тренировку
// идут только проверенные вина: новичок не должен учить то, что AI мог перепутать. Прогресс — на телефоне, по ресторану.
// v124 (Доп. 437): «Вино к блюду» (гость заказал блюдо — что предложить), «Опиши за 60 секунд» (вслух и сверка с
// карточкой), «Как произносить» — на обороте карточки (слова словаря в названии, сорте, регионе) и словарь в тренировке.
import React from "react";
import { labelStyle } from "./tokens";
import { onActivate, vibrate } from "../lib/utils";
import { bumpDaily } from "../lib/deck-extras";
import { GAME_SVG, UI_SVG, BUILD_SVG } from "./icons";
import { COLOR_GROUP, groupByColor, findWines, wineTitle, wineLine, winePrice, unchecked } from "../lib/wine";
import { trainable, newWines, learnedKey, allLearned, srKey, srMark, srDue, srKnown, glassPath, reverseClues, reversible, makeQuiz, quizScore,
  dishPairs, pairQuiz, describePoints, describePick } from "../lib/wine-train";
import { findPronounce, stressText } from "../lib/pronounce";   // v124: «Как произносить» на обороте карточки
import { SayButton } from "./pronounce";

const SERIF = "Georgia, 'Times New Roman', serif";
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const winesN = (n) => n + " " + plural(n, "вино", "вина", "вин");
const load = (k, dflt) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? dflt : v; } catch (e) { return dflt; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// «стеклянная» плашка карточек — те же токены, что у Колоды меню (обе темы)
export const glass = (T) => ({
  background: (T.lessGlass && T.lessGlass.bg) || "rgba(255,250,238,0.05)",
  border: (T.lessGlass && T.lessGlass.border) || "1px solid rgba(150,112,42,0.38)",
  borderTop: (T.lessGlass && T.lessGlass.borderTop) || "1px solid rgba(215,170,68,0.46)",
  boxShadow: (T.lessGlass && T.lessGlass.shadow) || "0 6px 22px rgba(0,0,0,0.50), 0 2px 0 rgba(200,160,60,0.18) inset, 0 -2px 4px rgba(0,0,0,0.38) inset",
  backdropFilter: (T.lessGlass && T.lessGlass.blur) || "none",
  WebkitBackdropFilter: (T.lessGlass && T.lessGlass.blur) || "none",
  borderRadius: 18,
});

// бутылка с вином нужного цвета — на карточке без фото и в «Наоборот» (на фото этикетка, а на ней ответ)
const TINT = { sparkling: "#E8D9A4", white: "#E6CF7E", rose: "#E7A2A6", orange: "#DE9A55", red: "#8E2A3C", dessert: "#C98B2F", fortified: "#7B3A2B" };
export const WineArt = ({ color, gold, h = 150 }) => {
  const c = TINT[color] || gold, id = "sa-wa-" + (color || "x");
  return (
    <svg width={Math.round(h * 0.42)} height={h} viewBox="0 0 60 150" aria-hidden="true" data-wine-art={color || ""} style={{ display: "block" }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} stopOpacity="0.5" /><stop offset="1" stopColor={c} stopOpacity="0.92" /></linearGradient></defs>
      <path d="M11 78h38v62a5 5 0 0 1-5 5H16a5 5 0 0 1-5-5z" fill={`url(#${id})`} />
      <path d="M24 4h12v34c0 6 14 12 14 26v76a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6V64c0-14 14-20 14-26z" fill="none" stroke={gold} strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="15" y="92" width="30" height="30" rx="3" fill="none" stroke={gold} strokeOpacity="0.7" strokeWidth="1.2" />
      {color === "sparkling" ? [[28, 30], [32, 22], [29, 13]].map(([x, y]) => <circle key={y} cx={x} cy={y} r="1.6" fill="none" stroke={gold} strokeWidth="1" />) : null}
    </svg>);
};

/** v124: «Как произносить» — слова словаря (data/pronounce) в названии, сорте и регионе вина: ударение, послушать,
 *  оригинал. Касание строки не переворачивает карточку. */
export function WineSay({ w, gold, text, sub, a11y }) {
  // сначала слова из названия, потом сорт, потом регион; не больше трёх
  const items = React.useMemo(() => {
    if (!w) return [];
    const out = [];
    for (const [t, n] of [[w.name, 2], [(w.grapes || []).join(" "), 2], [w.region, 1]]) for (const e of t ? findPronounce(t, n) : []) if (!out.some((x) => x.w === e.w)) out.push(e);
    return out.slice(0, 3);
  }, [w]);
  if (!items.length) return null;
  return (
    <div data-wine-say={items.length} onClick={(e) => e.stopPropagation()} style={{ marginTop: 12 }}>
      <div style={{ ...labelStyle(13.5), color: gold, marginBottom: 6 }}>Как произносить</div>
      {items.map((e) => (
        <div key={e.w} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontFamily: SERIF, fontSize: 16, color: text }}>{stressText(e.w)}</span>
          <SayButton w={e.w} gold={gold} sub={sub} a11y={a11y} size={28} />
          {e.o ? <span style={{ fontSize: 12, color: sub, fontStyle: "italic" }}>{e.o}</span> : null}
          {e.o ? <SayButton w={e.w} o={e.o} lang={e.lang} orig gold={gold} sub={sub} a11y={a11y} size={28} label="ориг." /> : null}
        </div>))}
    </div>);
}

/** «Знаю?»: прогресс колоды на телефоне, по ресторану. */
export function useWineSR(restaurant) {
  const [sr, setSr] = React.useState(() => load(srKey(restaurant), {}));
  const mark = (id, ok) => setSr((cur) => { const next = srMark(cur, id, ok); save(srKey(restaurant), next); return next; });
  return [sr, mark];
}
/** «Выучил новые вина»: какие вина были в выученной волне. */
export function useLearned(restaurant) {
  const [ids, setIds] = React.useState(() => load(learnedKey(restaurant), []));
  const learn = (list) => { const next = (list || []).map((w) => w.id); save(learnedKey(restaurant), next); setIds(next); };
  return [ids, learn];
}

// ─────────────────────────────── КОЛОДА ВИН
// Механика — как у Колоды меню (ui/menu-deck.jsx): свайп 1:1 с продолжением, тап — переворот, после переворота карточка
// «садится» плоской (WebKit плохо прокручивает повёрнутое). only: all | glass | new | focus | цвет.
export function WineDeck({ T, a11y, gold, green, red, wines, dishes = [], restaurant, uk, Head, title = "Колода вин", initialMode = "deck", initialOnly = "all",
  newIds = [], focusIds = [], onLearned = null }) {
  const text = T.modTitle.color, sub = T.modSub.color;
  const [sr, markSr] = useWineSR(restaurant);
  const [mode, setMode] = React.useState(initialMode);   // deck | quiz («Знаю?»)
  const [only, setOnly] = React.useState(initialOnly);
  const [reverse, setReverse] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [filters, setFilters] = React.useState(false);
  const [idx, setIdx] = React.useState(0);
  const [flip, setFlip] = React.useState(false);
  const [settled, setSettled] = React.useState(false);
  React.useEffect(() => { if (!flip) { setSettled(false); return undefined; } const tm = setTimeout(() => setSettled(true), 640); return () => clearTimeout(tm); }, [flip]);
  const toggleFlip = () => { if (flip && settled) { setSettled(false); requestAnimationFrame(() => setFlip(false)); } else setFlip((f) => !f); };

  // порядок колоды — порядок карты: по цвету, внутри — по алфавиту
  const base = React.useMemo(() => groupByColor(trainable(wines)).flatMap(([, ws]) => ws), [wines]);
  const fits = (w, k) => (k === "all" ? true : k === "glass" ? w.byGlass : k === "new" ? newIds.includes(w.id) : k === "focus" ? focusIds.includes(w.id) : w.color === k);
  const found = React.useMemo(() => findWines(base, q).filter((w) => !reverse || reversible(w)), [base, q, reverse]);
  const pool = found.filter((w) => fits(w, only));
  const due = pool.filter((w) => !w.stop && srDue(sr, w.id));   // «сегодня нет» в повтор не идёт, как у меню
  const list = mode === "quiz" ? due : pool;
  const total = list.length;
  const w = list[Math.min(idx, Math.max(0, total - 1))];
  const liveN = pool.filter((x) => !x.stop).length, known = pool.filter((x) => !x.stop && srKnown(sr, x.id)).length;
  React.useEffect(() => { setIdx(0); setFlip(false); }, [q, only, mode, reverse]);
  const dishName = (id) => ((dishes || []).find((d) => d && d.id === id) || {}).name || "";

  // ── свайп: через ref, без ререндера карточки на каждом движении
  const wrapRef = React.useRef(null), touch = React.useRef(null), busy = React.useRef(false), snapRef = React.useRef(false), moved = React.useRef(false);
  const setWrap = (transform, transition, opacity) => { const el = wrapRef.current; if (!el) return; el.style.transition = transition || "none"; el.style.transform = transform || "none"; el.style.opacity = opacity == null ? 1 : opacity; };
  const OUT_MS = 260, IN_MS = 420;
  const go = (dir) => {
    if (!total || busy.current) return;
    busy.current = true; vibrate("light");
    const sign = dir > 0 ? -1 : 1;
    setWrap(`translateX(${sign * 120}%) rotate(${sign * 9}deg) scale(.96)`, `transform ${OUT_MS}ms cubic-bezier(.3,.6,.4,1), opacity ${OUT_MS}ms ease-out`, 0);
    setTimeout(() => {
      snapRef.current = true; setFlip(false); setIdx((i) => (i + dir + total) % total);
      setWrap(`translateX(${-sign * 70}%) rotate(${-sign * 5}deg) scale(.94)`, "none", 0);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setWrap("none", `transform ${IN_MS}ms cubic-bezier(.16,1.1,.3,1), opacity ${IN_MS * 0.6}ms ease-out`, 1);
        snapRef.current = false;
        setTimeout(() => { busy.current = false; }, IN_MS);
      }));
    }, OUT_MS);
  };
  const onTS = (e) => { if (busy.current) { touch.current = null; return; } const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY, axis: null, dx: 0, vx: 0, lx: t.clientX, lt: Date.now() }; moved.current = false; };
  const onTM = (e) => {
    const s = touch.current; if (!s) return;
    const t = e.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (!s.axis) { if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
    if (s.axis !== "x") return;
    moved.current = true;
    const now = Date.now(); if (now > s.lt) { s.vx = (t.clientX - s.lx) / (now - s.lt); s.lx = t.clientX; s.lt = now; }
    s.dx = dx;
    setWrap(`translateX(${dx * 0.9}px) rotate(${dx * 0.03}deg)`, "none", Math.max(0.55, 1 - Math.abs(dx) / 700));
  };
  const onTE = () => {
    const s = touch.current; touch.current = null;
    if (!s || s.axis !== "x") return;
    const flick = Math.abs(s.vx) > 0.45 && Math.sign(s.vx) === Math.sign(s.dx);
    if (Math.abs(s.dx) > 70 || (flick && Math.abs(s.dx) > 24)) go(s.dx < 0 ? 1 : -1);
    else setWrap("none", "transform .38s cubic-bezier(.16,1.1,.3,1), opacity .25s ease-out", 1);
  };

  // «Знал» — вино уходит из повтора (вернётся через день, три, неделю, месяц); «Повторить» — дальше, оно вернётся в этом круге
  const mark = (ok) => {
    if (!w) return;
    markSr(w.id, ok); bumpDaily(uk); vibrate(ok ? "success" : "error"); setFlip(false);
    setIdx((i) => (ok ? Math.min(i, Math.max(0, total - 2)) : total > 1 ? (i + 1) % total : 0));
  };

  const bd = a11y ? "rgba(139,106,48,0.35)" : "rgba(214,178,102,0.35)", bg = a11y ? "rgba(255,255,255,0.45)" : "rgba(255,248,230,0.05)";
  const pill = (on) => ({ padding: "5px 11px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
    border: `1px solid ${on ? gold : bd}`, background: on ? `linear-gradient(180deg,#E4C88C,${gold})` : "transparent", color: on ? "#1a160f" : sub, fontWeight: on ? "bold" : "normal" });
  const iconBtn = (on) => ({ width: 34, height: 34, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, border: `1px solid ${on ? gold + "AA" : bd}`, background: on ? "rgba(214,178,102,0.16)" : bg });
  const tag = (t) => <span key={t} data-lens-tag="" style={{ padding: "3px 9px", borderRadius: 999, fontSize: 12, border: `1px solid ${gold}44`, color: text, whiteSpace: "nowrap" }}>{t}</span>;
  const sec = (t) => <div style={{ ...labelStyle(13.5), color: gold, margin: "12px 0 5px" }}>{t}</div>;
  const open = filters || !!q || only !== initialOnly;
  const chips = [["all", "Все", base.length], ...(base.some((x) => x.byGlass) ? [["glass", "Бокалом", base.filter((x) => x.byGlass).length]] : []),
    ...(newIds.length ? [["new", "Новые", base.filter((x) => newIds.includes(x.id)).length]] : []), ...(focusIds.length ? [["focus", "Ошибки", base.filter((x) => focusIds.includes(x.id)).length]] : []),
    ...groupByColor(base).filter(([k]) => k !== "other").map(([k, ws]) => [k, COLOR_GROUP[k], ws.length])];

  return (
    <div style={T.screen} className="sa-screen" data-wine-deck={mode} data-wine-deck-only={only}>
      {Head(title)}
      <div style={{ padding: "6px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div data-lens-seg="flat" style={{ display: "flex", border: `1px solid ${bd}`, borderRadius: 999, padding: 3, background: bg, gap: 2 }}>
            <span role="button" tabIndex={0} data-wine-deck-mode="deck" style={{ ...pill(mode === "deck"), border: "none", padding: "6px 12px" }} data-lens-btn={mode === "deck" ? "tab" : undefined} onClick={() => setMode("deck")} {...onActivate(() => setMode("deck"))}>Колода</span>
            <span role="button" tabIndex={0} data-wine-deck-mode="quiz" style={{ ...pill(mode === "quiz"), border: "none", padding: "6px 12px" }} data-lens-btn={mode === "quiz" ? "tab" : undefined} onClick={() => setMode("quiz")} {...onActivate(() => setMode("quiz"))}>Знаю?{due.length ? ` · ${due.length}` : ""}</span>
          </div>
          <span data-wine-deck-count="" style={{ marginLeft: "auto", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, color: sub, whiteSpace: "nowrap" }}>{total ? (Math.min(idx, total - 1) % total) + 1 : 0}/{total}{reverse ? " ↺" : ""}</span>
          <span role="button" tabIndex={0} style={iconBtn(open)} data-lens={open ? undefined : "disc"} data-wine-deck-find="" onClick={() => setFilters((f) => !f)} {...onActivate(() => setFilters((f) => !f))} aria-label="Поиск и фильтры">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" /></svg></span>
        </div>
        {open ? (
          <div className="sa-fadein" style={{ marginBottom: 12 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Вино, регион, сорт, нота…" data-lens-field="" aria-label="Найти вино в колоде"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 12, border: `1px solid ${bd}`, background: bg, color: text, fontFamily: SERIF, fontSize: 12.5, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
            <div className="sa-hscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
              <span role="button" tabIndex={0} data-wine-deck-reverse={reverse ? "on" : ""} style={{ ...pill(reverse), padding: "4px 10px", fontSize: 11 }} data-lens-btn={reverse ? "tab" : "soft"} data-lens-ink="" onClick={() => { setReverse((r) => !r); vibrate("light"); }} {...onActivate(() => setReverse((r) => !r))}>{reverse ? "Наоборот ✓" : "Наоборот"}</span>
              {chips.map(([k, t, n]) => <span key={k} role="button" tabIndex={0} data-wine-deck-chip={k} style={{ ...pill(only === k), padding: "4px 10px", fontSize: 11 }} data-lens-btn={only === k ? "tab" : "soft"} data-lens-ink="" onClick={() => { setOnly(k); vibrate("light"); }} {...onActivate(() => setOnly(k))}>{t} · {n}</span>)}
            </div>
          </div>) : null}
        {mode === "quiz" && liveN ? (
          <div data-wine-deck-known={known + "/" + liveN} style={{ display: "flex", alignItems: "center", gap: 10, margin: "-2px 2px 10px" }}>
            <div style={{ flex: 1, height: 4, borderRadius: 3, background: a11y ? "rgba(139,106,48,0.18)" : "rgba(214,178,102,0.16)", overflow: "hidden" }}><div style={{ width: Math.round((known / liveN) * 100) + "%", height: "100%", background: known >= liveN ? green : gold, transition: "width .3s" }} /></div>
            <span style={{ fontSize: 12, color: sub, whiteSpace: "nowrap" }}>выучено {known} из {liveN}</span>
          </div>) : null}
      </div>

      {!w ? (
        <div data-wine-deck-empty={mode} style={{ textAlign: "center", padding: "44px 24px 100px" }}>
          <div style={{ ...T.bold, marginBottom: 8 }}>{mode === "quiz" ? (pool.length ? "Всё повторено ✓" : "Здесь пусто") : "Ничего не нашлось"}</div>
          <div style={{ color: sub, fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>{mode === "quiz" && pool.length ? "Карточки вернутся по интервалам: через день, три, неделю, месяц." : reverse && !pool.length ? "Для «Наоборот» у вина нужны хотя бы две подсказки: регион, сорт, стиль или ноты." : "Попробуй другое слово или сними фильтр."}</div>
          {mode === "quiz" && pool.length && only === "new" && onLearned ? <button type="button" className="sa-btn sa-btn-pulse" data-lens-btn="main" data-wine-learned="" style={{ ...T.doneBtn, background: green || gold, width: "100%" }} onClick={onLearned}>Выучил новые вина ✓</button> : null}
          {mode === "quiz" && pool.length && only !== "all" && !(only === "new" && onLearned) ? <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-wine-deck-all="" style={{ ...T.doneBtn, background: "transparent", border: `1px solid ${gold}88`, color: text, width: "100%" }} onClick={() => setOnly("all")}>Дальше: вся карта</button> : null}
        </div>
      ) : (
        <>
          <div style={{ padding: "0 16px" }}>
            <div className="sa-ck-wrap" ref={wrapRef} data-wine-deck-card={w.id}
              onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} onTouchCancel={onTE}
              onClick={() => { if (moved.current || busy.current) return; toggleFlip(); vibrate("light"); }}
              style={{ cursor: "pointer", willChange: "transform, opacity", touchAction: "pan-y" }}>
              <div className={"sa-ck-inner" + (settled ? " sa-ck-settled" : "")} data-wine-flip={flip ? "back" : "front"} style={{ transform: flip ? "rotateY(180deg)" : "none", transition: snapRef.current ? "none" : undefined }}>
                {/* лицевая — без display в style: после переворота её прячет .sa-ck-settled (display: none), строчный стиль бы перебил */}
                <div className="sa-ck-face sa-ck-front" data-lens-edge="" style={{ ...glass(T), padding: "18px 18px 16px", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
                  {w.stop ? <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: "inherit" }}><div style={{ position: "absolute", top: 16, right: -36, transform: "rotate(35deg)", background: red, color: "#fff", fontSize: 10.5, letterSpacing: 1.5, padding: "4px 42px" }}>СЕГОДНЯ НЕТ</div></div> : null}
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: reverse ? 150 : 200, margin: "2px 0 14px" }}>
                    {w.img && !reverse ? <img src={w.img} alt="" decoding="async" data-wine-deck-photo="" style={{ display: "block", maxWidth: "100%", maxHeight: a11y ? 230 : 210, objectFit: "contain", borderRadius: 12 }} />
                      : <WineArt color={w.color} gold={gold} h={reverse ? 140 : 170} />}
                  </div>
                  <div style={{ ...labelStyle(13.5), color: gold, marginBottom: 6 }}>{reverse ? "Что за вино? · " : ""}{COLOR_GROUP[w.color] || COLOR_GROUP.other}{w.byGlass ? " · бокалом" : ""}</div>
                  {reverse ? (
                    <div data-wine-clues="" style={{ fontFamily: SERIF, fontSize: 16, color: text, lineHeight: 1.45 }}>{reverseClues(w).map((c) => <div key={c}>{c}</div>)}</div>
                  ) : (<>
                    <div style={{ fontFamily: SERIF, fontSize: 21, color: text, lineHeight: 1.2 }}>{wineTitle(w)}</div>
                    {w.producer && !String(w.name).toLowerCase().includes(String(w.producer).toLowerCase()) ? <div style={{ fontSize: 13, color: sub, marginTop: 4 }}>{w.producer}</div> : null}
                  </>)}
                  <div style={{ color: sub, fontSize: 12.5, lineHeight: 1.55, marginTop: 10 }}>{reverse ? "Так гость и описывает, что хочет. Вспомни, какое это вино в карте, и переверни." : "Вспомни, откуда оно, сорт, стиль и как описать гостю. Потом переверни и сверься."}</div>
                  <div style={{ marginTop: "auto", paddingTop: 10, fontSize: 11, color: gold, fontStyle: "italic", textAlign: "center" }}>{reverse ? "название по тапу" : "ответ по тапу"}</div>
                  </div>
                </div>
                <div className="sa-ck-face sa-ck-back" data-lens-edge="" style={{ ...glass(T), padding: "16px 18px", boxSizing: "border-box" }}>
                  <div style={{ ...labelStyle(13.5), color: gold, marginBottom: 4 }}>{COLOR_GROUP[w.color] || COLOR_GROUP.other}{w.byGlass ? " · бокалом" : ""}</div>
                  <div data-wine-back-title="" style={{ fontFamily: SERIF, fontSize: 19, color: text, lineHeight: 1.25 }}>{wineTitle(w)}</div>
                  {w.producer ? <div style={{ fontSize: 13, color: sub, marginTop: 2 }}>{w.producer}</div> : null}
                  {wineLine(w) ? <div style={{ fontSize: 14, color: text, lineHeight: 1.45, marginTop: 8 }}>{wineLine(w)}</div> : null}
                  {winePrice(w) ? <div style={{ fontSize: 13, color: sub, marginTop: 4 }}>{winePrice(w)}</div> : null}
                  {flip ? <WineSay w={w} gold={gold} text={text} sub={sub} a11y={a11y} /> : null}
                  {w.short ? <>{sec("Одной фразой гостю")}<div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 15, lineHeight: 1.5, color: text }}>«{w.short}»</div></> : null}
                  {(w.notes || []).length ? <>{sec("Ноты")}<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{w.notes.map(tag)}</div></> : null}
                  {w.temp || w.glass ? <>{sec("Подача")}<div style={{ fontSize: 14, color: text, lineHeight: 1.5 }}>{[w.temp, w.glass ? "бокал «" + w.glass + "»" : ""].filter(Boolean).join(" · ")}</div></> : null}
                  {(w.pair || []).map(dishName).filter(Boolean).length ? <>{sec("К блюдам")}<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(w.pair || []).map(dishName).filter(Boolean).map(tag)}</div></> : null}
                  {w.pairNote ? <div style={{ fontSize: 13, color: sub, lineHeight: 1.5, marginTop: 6 }}>{w.pairNote}</div> : null}
                  {w.story ? <>{sec("О вине")}<div style={{ fontSize: 13.5, color: text, lineHeight: 1.6 }}>{w.story}</div></> : null}
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: "12px 16px 100px" }}>
            {mode === "quiz" ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="sa-btn" data-wine-mark="again" onClick={() => mark(false)} style={{ ...pill(false), flex: 1, padding: "12px", textAlign: "center", color: red, borderColor: red + "66", fontSize: 12.5 }}>Повторить</button>
                <button type="button" className="sa-btn" data-lens-btn="main" data-wine-mark="ok" onClick={() => mark(true)} style={{ ...pill(true), flex: 1, padding: "12px", textAlign: "center", fontSize: 12.5 }}>Знал</button>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-wine-go="-1" onClick={() => go(-1)} style={{ ...pill(false), padding: "10px 18px", fontSize: 12.5 }}>‹ назад</button>
                <span style={{ ...labelStyle(13), color: sub, whiteSpace: "nowrap" }}>Свайп · листать</span>
                <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-wine-go="1" onClick={() => go(1)} style={{ ...pill(false), padding: "10px 18px", fontSize: 12.5 }}>дальше ›</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────── ВИКТОРИНА ПО ВИНАМ
// 10 вопросов по своей карте (lib/wine-train.js: makeQuiz). Вопросы собираются один раз на заход: если меню команды
// обновится с сервера посреди викторины, вопросы не сменятся. Ошибки в конце — к повтору в «Знаю?».
export function WineQuiz({ T, a11y, gold, green, red, wines, dishes = [], restaurant, uk, Head, onRepeat }) {
  const sub = T.modSub.color, text = T.modTitle.color;
  const [questions, setQuestions] = React.useState(() => makeQuiz(wines, dishes, { n: 10 }));
  const [step, setStep] = React.useState(0);
  const [picks, setPicks] = React.useState([]);
  const [, markSr] = useWineSR(restaurant);
  const done = questions.length > 0 && step >= questions.length;
  const res = done ? quizScore(questions, picks) : null;
  const doneRef = React.useRef(false);
  React.useEffect(() => {
    if (!done || doneRef.current) return;
    doneRef.current = true;
    res.wrong.forEach((id) => markSr(id, false));   // вино с ошибкой — снова к повтору
    bumpDaily(uk);
  }, [done]);   // eslint-disable-line react-hooks/exhaustive-deps
  const again = () => { doneRef.current = false; setQuestions(makeQuiz(wines, dishes, { n: 10 })); setStep(0); setPicks([]); vibrate("light"); };
  const nameOf = (id) => wineTitle(trainable(wines).find((x) => x.id === id));

  if (!questions.length) return (
    <div style={T.screen} className="sa-screen" data-wine-quiz="none">{Head("Викторина по винам")}
      <div style={{ textAlign: "center", padding: "50px 24px", color: sub, fontSize: 14, lineHeight: 1.5 }}>Для викторины нужно хотя бы два проверенных вина с регионом, сортом или стилем.</div>
    </div>);

  if (done) {
    const pct = Math.round((res.right / res.total) * 100), c = pct >= 80 ? gold : pct >= 50 ? green : red;
    return (
      <div style={T.screen} className="sa-screen" data-wine-quiz="done" data-wine-quiz-score={res.right + "/" + res.total}>
        {Head("Викторина по винам")}
        <div style={{ textAlign: "center", padding: "44px 24px 100px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ width: 76, height: 76, borderRadius: "50%", background: c + "1F", border: `1px solid ${c}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {pct >= 80 ? UI_SVG.trophy(gold, 38) : pct >= 50 ? UI_SVG.target(green, 36) : UI_SVG.book(red, 36)}</div>
          </div>
          <div style={{ ...T.bold, fontSize: 21, marginBottom: 8 }}>{res.right} из {res.total}</div>
          <div style={{ color: sub, fontSize: 14, lineHeight: 1.5, marginBottom: res.wrong.length ? 12 : 20 }}>{pct >= 80 ? "Карту знаешь хорошо." : pct >= 50 ? "Неплохо. Вина с ошибками вернулись в «Знаю?»." : "Пройди колоду и возвращайся. Вина с ошибками уже в «Знаю?»."}</div>
          {res.wrong.length ? (
            <div data-wine-quiz-wrong={res.wrong.length} style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 18 }}>
              {res.wrong.map((id) => <span key={id} data-lens-tag="" style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12.5, border: `1px solid ${gold}55`, color: text }}>{nameOf(id)}</span>)}
            </div>) : null}
          {/* ошибки есть — главное действие: повторить их в «Знаю?»; заново — второе */}
          <div style={{ display: "grid", gap: 10 }}>
            {res.wrong.length && onRepeat ? <button type="button" className="sa-btn" data-lens-btn="main" data-wine-quiz-repeat="" style={{ ...T.doneBtn, width: "100%", margin: 0, background: gold }} onClick={() => onRepeat(res.wrong)}>Повторить ошибки</button> : null}
            <button type="button" className="sa-btn" data-lens-btn={res.wrong.length && onRepeat ? "soft" : "main"} data-wine-quiz-again="" style={{ ...T.doneBtn, width: "100%", margin: 0, ...(res.wrong.length && onRepeat ? { background: "transparent", border: `1px solid ${gold}88`, color: text } : { background: gold }) }} onClick={again}>Ещё раз</button>
          </div>
        </div>
      </div>);
  }

  const qq = questions[step], pick = picks[step];
  const answer = (i) => { if (pick != null) return; setPicks((p) => { const n = p.slice(); n[step] = i; return n; }); vibrate(i === qq.answer ? "light" : "error"); };
  return (
    <div style={T.screen} className="sa-screen" data-wine-quiz={step} data-wine-quiz-kind={qq.kind}>
      {Head("Викторина по винам")}
      <div key={step} className="sa-cardpage-r" style={T.quizWrap}>
        <div style={{ ...T.quizProgress, ...labelStyle(T.a11y ? 16 : 13) }}>Вопрос {step + 1} из {questions.length} · {restaurant}</div>
        <div style={T.quizQ}>{qq.q}</div>
        {qq.options.map((opt, i) => {
          let st = { ...T.quizOpt, cursor: pick == null ? "pointer" : "default" };
          if (pick != null) {
            // рамка — и border, и borderTop (в T.quizOpt оба): иначе React ругается на смешение сокращённого и полного свойства
            if (i === qq.answer) st = { ...st, background: "rgba(93,187,138,0.15)", border: `1px solid ${green}`, borderTop: `1px solid ${green}` };
            else if (i === pick) st = { ...st, background: "rgba(224,120,120,0.15)", border: `1px solid ${red}`, borderTop: `1px solid ${red}` };
            else st = { ...st, opacity: 0.5 };
          }
          return <div key={i} role="button" tabIndex={0} className="sa-opt" data-wine-opt={i} data-lens-opt={pick == null ? "" : i === qq.answer ? "ok" : i === pick ? "bad" : ""} style={st} onClick={() => answer(i)} {...onActivate(() => answer(i))}>{opt}</div>;
        })}
        {/* фото бутылки — после ответа, рядом с пояснением: до ответа этикетка подсказала бы регион или сорт */}
        {pick != null && qq.why ? (
          <div data-wine-why="" style={{ ...T.note, fontStyle: "normal", borderLeft: `2px solid ${gold}`, paddingLeft: 10, marginTop: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
            {qq.img ? <img src={qq.img} alt="" data-wine-quiz-photo="" style={{ display: "block", width: 44, height: 60, objectFit: "cover", borderRadius: 7, flexShrink: 0, border: `1px solid ${gold}44` }} /> : null}
            <span style={{ flex: 1, minWidth: 0 }}>{qq.why}</span>
          </div>) : null}
        {pick != null ? <button type="button" className="sa-btn" data-lens-btn="main" data-wine-quiz-next="" style={{ ...T.doneBtn, background: gold, width: "100%", marginTop: 12 }} onClick={() => setStep((s) => s + 1)}>{step + 1 >= questions.length ? "Итог →" : "Дальше →"}</button> : null}
      </div>
    </div>);
}

// ─────────────────────────────── v124: ВИНО К БЛЮДУ
// Блюдо меню (с фото) → какое вино предложить. Пары — из поля «к блюдам» у вин (lib/wine-train.js: pairQuiz).
export function WinePairQuiz({ T, a11y, gold, green, red, wines, dishes = [], restaurant, uk, Head }) {
  const sub = T.modSub.color;
  const [questions, setQuestions] = React.useState(() => pairQuiz(wines, dishes, { n: 8 }));
  const [step, setStep] = React.useState(0);
  const [picks, setPicks] = React.useState([]);
  const done = questions.length > 0 && step >= questions.length;
  const right = questions.filter((q, i) => picks[i] === q.answer).length;
  const doneRef = React.useRef(false);
  React.useEffect(() => { if (done && !doneRef.current) { doneRef.current = true; bumpDaily(uk); } }, [done]);   // eslint-disable-line react-hooks/exhaustive-deps
  const again = () => { doneRef.current = false; setQuestions(pairQuiz(wines, dishes, { n: 8 })); setStep(0); setPicks([]); vibrate("light"); };
  if (!questions.length) return (
    <div style={T.screen} className="sa-screen" data-wine-pairq="none">{Head("Вино к блюду")}
      <div style={{ textAlign: "center", padding: "50px 24px", color: sub, fontSize: 14, lineHeight: 1.5 }}>Нужны хотя бы два блюда, к которым в карте отмечены вина. Отмечают в «Редакторе вин», раздел «К блюдам».</div>
    </div>);
  if (done) {
    const pct = Math.round((right / questions.length) * 100), c = pct >= 80 ? gold : pct >= 50 ? green : red;
    return (
      <div style={T.screen} className="sa-screen" data-wine-pairq="done" data-wine-pairq-score={right + "/" + questions.length}>
        {Head("Вино к блюду")}
        <div style={{ textAlign: "center", padding: "44px 24px 100px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ width: 76, height: 76, borderRadius: "50%", background: c + "1F", border: `1px solid ${c}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {pct >= 80 ? UI_SVG.trophy(gold, 38) : pct >= 50 ? UI_SVG.target(green, 36) : UI_SVG.book(red, 36)}</div>
          </div>
          <div style={{ ...T.bold, fontSize: 21, marginBottom: 8 }}>{right} из {questions.length}</div>
          <div style={{ color: sub, fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>{pct >= 80 ? "Пары из карты знаешь." : "Повтори пары: на обороте карточки вина есть «К блюдам»."}</div>
          <button type="button" className="sa-btn" data-lens-btn="main" data-wine-pairq-again="" style={{ ...T.doneBtn, width: "100%", margin: 0, background: gold }} onClick={again}>Ещё раз</button>
        </div>
      </div>);
  }
  const qq = questions[step], pick = picks[step];
  const answer = (i) => { if (pick != null) return; setPicks((p) => { const n = p.slice(); n[step] = i; return n; }); vibrate(i === qq.answer ? "light" : "error"); };
  return (
    <div style={T.screen} className="sa-screen" data-wine-pairq={step}>
      {Head("Вино к блюду")}
      <div key={step} className="sa-cardpage-r" style={T.quizWrap}>
        <div style={{ ...T.quizProgress, ...labelStyle(T.a11y ? 16 : 13) }}>Блюдо {step + 1} из {questions.length} · {restaurant}</div>
        {qq.img ? <img src={qq.img} alt="" data-wine-pairq-photo="" style={{ display: "block", width: "100%", height: 150, objectFit: "cover", borderRadius: 14, marginBottom: 12 }} /> : null}
        <div style={T.quizQ}>{qq.q}</div>
        {qq.options.map((opt, i) => {
          let st = { ...T.quizOpt, cursor: pick == null ? "pointer" : "default" };
          if (pick != null) {
            if (i === qq.answer) st = { ...st, background: "rgba(93,187,138,0.15)", border: `1px solid ${green}`, borderTop: `1px solid ${green}` };
            else if (i === pick) st = { ...st, background: "rgba(224,120,120,0.15)", border: `1px solid ${red}`, borderTop: `1px solid ${red}` };
            else st = { ...st, opacity: 0.5 };
          }
          return <div key={i} role="button" tabIndex={0} className="sa-opt" data-wine-popt={i} data-lens-opt={pick == null ? "" : i === qq.answer ? "ok" : i === pick ? "bad" : ""} style={st} onClick={() => answer(i)} {...onActivate(() => answer(i))}>{opt}</div>;
        })}
        {pick != null ? <div data-wine-pwhy="" style={{ ...T.note, fontStyle: "normal", borderLeft: `2px solid ${gold}`, paddingLeft: 10, marginTop: 12 }}>{qq.why}</div> : null}
        {pick != null ? <button type="button" className="sa-btn" data-lens-btn="main" data-wine-pairq-next="" style={{ ...T.doneBtn, background: gold, width: "100%", marginTop: 12 }} onClick={() => setStep((x) => x + 1)}>{step + 1 >= questions.length ? "Итог →" : "Дальше →"}</button> : null}
      </div>
    </div>);
}

// ─────────────────────────────── v124: ОПИШИ ЗА 60 СЕКУНД
// Как у меню: вино на экране, минута рассказать вслух, потом сверка с карточкой — что назвал, отмечаешь сам.
function Countdown({ sec, gold, red, sub, onEnd }) {
  const [left, setLeft] = React.useState(sec);
  React.useEffect(() => { if (left <= 0) { onEnd(); return undefined; } const t = setTimeout(() => setLeft((x) => x - 1), 1000); return () => clearTimeout(t); }, [left]);   // eslint-disable-line react-hooks/exhaustive-deps
  const c = left <= 10 ? red : gold;
  return (
    <div data-wine-timer={left} style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ ...labelStyle(13.5), color: c }}>Говори вслух, как в зале</span>
        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 17, color: c }}>{left} с</span>
      </div>
      <div style={{ height: 4, borderRadius: 3, background: gold + "26", overflow: "hidden" }}><div style={{ width: (left / sec) * 100 + "%", height: "100%", background: c, transition: "width 1s linear" }} /></div>
    </div>);
}
export function WineDescribe60({ T, a11y, gold, green, red, wines, dishes = [], restaurant, uk, Head }) {
  const text = T.modTitle.color, sub = T.modSub.color;
  const [w, setW] = React.useState(() => describePick(wines, dishes));
  const [phase, setPhase] = React.useState("ready");   // ready | speak | compare
  const [said, setSaid] = React.useState([]);
  React.useEffect(() => { if (phase === "compare") bumpDaily(uk); }, [phase]);   // eslint-disable-line react-hooks/exhaustive-deps
  const next = () => { setW((cur) => describePick(wines, dishes, cur ? cur.id : "") || cur); setPhase("ready"); setSaid([]); vibrate("light"); };
  if (!w) return (
    <div style={T.screen} className="sa-screen" data-wine-say60="none">{Head("Опиши за 60 секунд")}
      <div style={{ textAlign: "center", padding: "50px 24px", color: sub, fontSize: 14, lineHeight: 1.5 }}>Нужны проверенные вина, где в карточке есть хотя бы регион, сорт и стиль.</div>
    </div>);
  const points = describePoints(w, dishes);
  const toggle = (k) => { setSaid((s0) => (s0.includes(k) ? s0.filter((x) => x !== k) : [...s0, k])); vibrate("light"); };
  return (
    <div style={T.screen} className="sa-screen" data-wine-say60={phase} data-wine-say60-wine={w.id}>
      {Head("Опиши за 60 секунд")}
      <div style={{ padding: "6px 16px 100px" }}>
        <div key={w.id} className="sa-cardpage-r" data-lens-card="" style={{ ...glass(T), padding: "18px 18px 16px" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {w.img ? <img src={w.img} alt="" style={{ width: 62, height: 84, objectFit: "cover", borderRadius: 10, flexShrink: 0, border: `1px solid ${gold}44` }} /> : <WineArt color={w.color} gold={gold} h={84} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...labelStyle(13.5), color: gold }}>{COLOR_GROUP[w.color] || COLOR_GROUP.other}{w.byGlass ? " · бокалом" : ""}</div>
              <div style={{ fontFamily: SERIF, fontSize: 20, color: text, lineHeight: 1.2, marginTop: 2 }}>{wineTitle(w)}</div>
            </div>
          </div>
          {phase === "ready" ? <div style={{ color: (T.para && T.para.color) || text, fontSize: 14, lineHeight: 1.6, marginTop: 14 }}>
            Гость спрашивает: «а что это за вино?». У тебя минута. Расскажи вслух, как в зале: откуда оно, из какого винограда, какое на вкус, к чему подать. И закончи фразой, после которой хочется заказать.</div> : null}
          {phase === "speak" ? <div style={{ marginTop: 14 }}><Countdown sec={60} gold={gold} red={red} sub={sub} onEnd={() => setPhase("compare")} /></div> : null}
          {phase === "compare" ? (
            <div style={{ marginTop: 14 }} data-wine-say60-points={points.length}>
              <div style={{ ...labelStyle(13), color: green, marginBottom: 8 }}>Сверься с карточкой: что назвал, отметь</div>
              {points.map((p) => { const on = said.includes(p.key); return (
                <div key={p.key} role="button" tabIndex={0} data-wine-point={p.key} aria-pressed={on} onClick={() => toggle(p.key)} {...onActivate(() => toggle(p.key))}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: `1px solid ${gold}22`, cursor: "pointer" }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, border: `1px solid ${on ? green : gold + "77"}`, background: on ? green : "transparent", display: "grid", placeItems: "center" }}>
                    {on ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg> : null}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", ...labelStyle(12.5), color: gold }}>{p.label}</span>
                    <span style={{ display: "block", fontSize: 14, color: text, lineHeight: 1.45 }}>{p.value}</span>
                  </span>
                </div>); })}
              <div data-wine-say60-said={said.length + "/" + points.length} style={{ fontSize: 13, color: sub, marginTop: 8, lineHeight: 1.5 }}>
                {said.length >= points.length ? "Назвал всё из карточки." : "Назвал " + said.length + " из " + points.length + ". Чего не хватило, то и запомни."}</div>
            </div>) : null}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          {phase === "ready" ? <button type="button" className="sa-btn" data-lens-btn="main" data-wine-say60-go="" style={{ ...T.doneBtn, margin: 0, background: gold, flex: 1 }} onClick={() => { setPhase("speak"); vibrate("medium"); }}>Старт ›</button> : null}
          {phase === "speak" ? <button type="button" className="sa-btn" data-lens-btn="main" data-wine-say60-stop="" style={{ ...T.doneBtn, margin: 0, background: gold, flex: 1 }} onClick={() => setPhase("compare")}>Я закончил(а)</button> : null}
          {phase === "compare" ? <button type="button" className="sa-btn" data-lens-btn="main" data-wine-say60-next="" style={{ ...T.doneBtn, margin: 0, background: gold, flex: 1 }} onClick={next}>Следующее вино →</button> : null}
        </div>
      </div>
    </div>);
}

// ─────────────────────────────── ТРЕНИРОВКА: ГЛАВНАЯ
// Как главная тренажёра меню: «Новые вина» (если есть), путь новичка «С чего начать: вина бокалом», колода, викторина.
// Не проверенные вина — не в тренировке: руководителю — «Проверить подряд», остальным — сколько ждут проверки.
export function WineTrainHub({ T, a11y, gold, green, wines, dishes = [], restaurant, edit, onOpen, onReview }) {
  const text = T.modTitle.color, sub = T.modSub.color;
  const pairsN = dishPairs(wines, dishes).length;   // v124: «Вино к блюду» — от двух блюд с отмеченными винами
  const [sr] = useWineSR(restaurant);
  const [learnedIds] = useLearned(restaurant);
  const train = trainable(wines), fresh = newWines(wines), learned = allLearned(fresh, learnedIds);
  const gp = glassPath(wines, sr), known = train.filter((w) => srKnown(sr, w.id)).length;
  const uncheckedN = (wines || []).filter((w) => w && !w.archived && unchecked(w)).length;
  const iconBox = { width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: a11y ? "rgba(200,150,50,0.14)" : "rgba(200,169,110,0.13)", marginRight: 4 };
  const bar = (k, n, c) => <div style={{ height: 4, borderRadius: 3, background: a11y ? "rgba(139,106,48,0.18)" : "rgba(214,178,102,0.16)", overflow: "hidden", marginTop: 7 }}><div style={{ width: Math.round((k / Math.max(1, n)) * 100) + "%", height: "100%", background: c }} /></div>;
  const row = (key, icon, title, subText, extra, hi) => {
    const go = () => { vibrate("light"); onOpen(key); };
    return (
      <div key={key} className="sa-card" role="button" tabIndex={0} data-wine-train={key} data-lens-card={hi || ""} onClick={go} {...onActivate(go)}
        style={{ ...T.modCard, margin: "0 0 10px", ...(hi === "hi" ? { border: `1px solid ${gold}AA` } : hi === "ok" ? { border: `1px solid ${green}77` } : {}) }}>
        <div style={{ ...iconBox, ...(hi === "ok" ? { background: "rgba(93,187,138,0.14)" } : {}) }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...T.modTitle, display: "flex", alignItems: "center", gap: 8 }}>{title}{hi === "hi" ? <span style={{ ...labelStyle(13), color: "#1A1008", background: gold, borderRadius: 6, padding: "1px 6px" }}>новое</span> : null}</div>
          <div style={{ ...T.modSub, whiteSpace: "normal" }}>{subText}</div>
          {extra}
        </div>
        <div style={T.modArrow}>›</div>
      </div>);
  };
  const glassDone = gp.total && gp.known >= gp.total;
  return (
    <div style={{ padding: "4px 16px 140px" }} data-wine-hub={train.length}>
      <div style={{ fontSize: 13.5, color: sub, margin: "2px 2px 12px", lineHeight: 1.5 }} data-wine-hub-sum="">
        {train.length ? "В тренировке " + winesN(train.length) + (known ? " · выучено " + known : "") : "Проверенных вин пока нет."}</div>
      {train.length >= 2 ? <>
        {fresh.length ? row("new", learned ? UI_SVG.checkCircle(green, 20) : GAME_SVG.cards(gold, 20), "Новые вина",
          learned ? "Выучено ✓ · " + winesN(fresh.length) + ". Можно повторить" : winesN(fresh.length) + " за последний месяц. Выучи к смене", null, learned ? "ok" : "hi") : null}
        {gp.total ? row("glass", BUILD_SVG.wineglass(glassDone ? green : gold, 20), "С чего начать: вина бокалом",
          glassDone ? "Бокалом выучены все " + gp.total + ". Дальше: вся карта в колоде" : "Их спрашивают чаще всего. Выучено " + gp.known + " из " + gp.total, bar(gp.known, gp.total, glassDone ? green : gold)) : null}
        {row("deck", GAME_SVG.cards(gold, 20), "Колода вин", "Карточки с поиском и фильтрами, режимы «Знаю?» и «Наоборот»: вино по описанию гостя")}
        {row("quiz", UI_SVG.quiz(gold, 20), "Викторина по винам", "10 вопросов по своей карте: откуда, сорт, стиль, бокалом или нет, к какому блюду")}
        {pairsN >= 2 ? row("pair", UI_SVG.cloche(gold, 20), "Вино к блюду", "Гость заказал блюдо: что предложить? По парам из своей карты") : null}
        {row("say60", GAME_SVG.clock(gold, 20), "Опиши за 60 секунд", "Расскажи о вине вслух за минуту и сверься с карточкой")}
        {row("pron", <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>,
          "Как произносить", "Вина, сорта и регионы: ударение, по слогам, послушать в оригинале")}
        {pairsN < 2 && edit ? <div data-wine-hub-pairs={pairsN} style={{ fontSize: 12.5, color: sub, lineHeight: 1.5, margin: "0 2px 10px" }}>«Вино к блюду» появится, когда хотя бы у двух блюд будут отмечены вина: «Редактор вин», раздел «К блюдам».</div> : null}
      </> : <div data-lens-card="" style={{ ...T.modCard, display: "block", cursor: "default", padding: "14px 16px", fontSize: 14, color: text, lineHeight: 1.5 }}>
        Для тренировки нужно хотя бы два проверенных вина.{edit ? " Проверь, что дописал AI, и вина появятся здесь." : " Руководитель добавит и проверит карту."}</div>}
      {uncheckedN ? (edit ? (
        <div data-lens-card="warn" data-wine-hub-check={uncheckedN} style={{ ...T.modCard, display: "block", cursor: "default", padding: "12px 14px", marginTop: 6 }}>
          <div style={{ fontSize: 13.5, color: text, lineHeight: 1.5 }}>Не проверено: {winesN(uncheckedN)}. В тренировку они попадут после проверки: новичок не должен учить то, что AI мог перепутать.</div>
          <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-wine-review-open="" onClick={() => { vibrate("light"); onReview(); }}
            style={{ marginTop: 10, padding: "8px 14px", borderRadius: 999, border: `1px solid ${gold}77`, background: "transparent", color: gold, fontFamily: SERIF, fontSize: 13.5, cursor: "pointer" }}>Проверить подряд</button>
        </div>) : (
        <div data-wine-hub-wait={uncheckedN} style={{ fontSize: 12.5, color: sub, lineHeight: 1.5, margin: "6px 2px 0" }}>Ещё {winesN(uncheckedN)} ждут проверки руководителем: в тренировку попадут после неё.</div>)) : null}
    </div>);
}
