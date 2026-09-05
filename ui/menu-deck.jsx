import React from "react";
import { onActivate, vibrate } from "../lib/utils";
import { GOLD } from "./tokens";
import { groupByCat, dishMatches, normCat } from "../lib/menu-sections";

// ── Дополнение 161: Колода меню — та же механика, что у Колоды бармена ────────
// Свайп 1:1 с продолжением движения, тап — переворот, поиск и разделы за лупой,
// список-указатель за иконкой, режим «Знаю?» с интервальным повторением
// (1 → 3 → 7 → 30 дней), прогресс — на телефоне, по ресторану.
// DishPhoto / DishBack / glass приходят из тренажёра меню пропсами — без циклов импорта.

const SR_DAYS = [1, 3, 7, 30];
const srKey = (restaurant) => "sa_menu_sr_" + (restaurant || "x");
const loadSR = (restaurant) => { try { return JSON.parse(localStorage.getItem(srKey(restaurant)) || "{}"); } catch (e) { return {}; } };

export function MenuDeck({ T, a11y, gold = GOLD, green, red, dishes, restaurant, Head, DishPhoto, DishBack, glass, onLearned, startId }) {
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("");
  const [filters, setFilters] = React.useState(false);
  const [mode, setMode] = React.useState("deck");  // deck | quiz
  const [view, setView] = React.useState("cards"); // cards | index
  const [idx, setIdx] = React.useState(0);
  const [flip, setFlip] = React.useState(false);
  const [sr, setSr] = React.useState(() => loadSR(restaurant));
  const [doneQuiz, setDoneQuiz] = React.useState(0); // сколько «Знал» подряд в этой сессии

  const due = React.useMemo(() => dishes.filter(d => !d.stop && (() => { const r = sr[d.id]; return !r || !r.due || r.due <= Date.now(); })()), [dishes, sr]); // Доп. 166: стоп не повторяем
  // Доп. 172: порядок Колоды = порядок меню (разделы по канону, внутри раздела — как расставил менеджер)
  const pool = React.useMemo(() => groupByCat(dishes.filter(d => dishMatches(d, q) && (!cat || normCat(d.cat) === cat))).flatMap(g => g.items), [dishes, q, cat]);
  const list = mode === "quiz" ? due.filter(d => pool.includes(d)) : pool;
  const d = list[Math.min(idx, Math.max(0, list.length - 1))];
  const total = list.length;
  React.useEffect(() => { const i = startId ? pool.findIndex(x => String(x.id) === String(startId)) : -1; setIdx(i >= 0 ? i : 0); setFlip(false); }, [q, cat, mode]);
  // Доп. 181: искать блюдо в том списке, который реально листается (pool — по разделам), а не в исходном
  React.useEffect(() => {
    if (!startId) return;
    const i = pool.findIndex(x => String(x.id) === String(startId));
    if (i >= 0) { setMode("deck"); setIdx(i); setFlip(false); }
  }, [startId, pool]);

  // ── свайп: ведём через ref, без ререндера карточки на каждом движении
  const wrapRef = React.useRef(null);
  const touch = React.useRef(null);
  const busy = React.useRef(false);
  const snapRef = React.useRef(false);
  const moved = React.useRef(false);
  const setWrap = (transform, transition, opacity) => {
    const el = wrapRef.current; if (!el) return;
    el.style.transition = transition || "none";
    el.style.transform = transform || "none";
    el.style.opacity = opacity == null ? 1 : opacity;
  };
  const OUT_MS = 260, IN_MS = 420;
  const go = (dir) => {
    if (!total || busy.current) return;
    busy.current = true; vibrate("light");
    const sign = dir > 0 ? -1 : 1;
    setWrap(`translateX(${sign * 120}%) rotate(${sign * 9}deg) scale(.96)`, `transform ${OUT_MS}ms cubic-bezier(.3,.6,.4,1), opacity ${OUT_MS}ms ease-out`, 0);
    setTimeout(() => {
      snapRef.current = true; setFlip(false); setIdx(i => (i + dir + total) % total);
      setWrap(`translateX(${-sign * 70}%) rotate(${-sign * 5}deg) scale(.94)`, "none", 0);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setWrap("none", `transform ${IN_MS}ms cubic-bezier(.16,1.1,.3,1), opacity ${IN_MS * 0.6}ms ease-out`, 1);
        snapRef.current = false;
        setTimeout(() => { busy.current = false; }, IN_MS);
      }));
    }, OUT_MS);
  };
  const onTS = (e) => {
    if (busy.current) { touch.current = null; return; }
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, axis: null, dx: 0, vx: 0, lx: t.clientX, lt: Date.now() };
    moved.current = false;
  };
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

  // ── «Знаю?»: интервальное повторение
  const mark = (ok) => {
    if (!d) return;
    const cur = sr[d.id] || { stage: 0 };
    const stage = ok ? Math.min(cur.stage + 1, SR_DAYS.length) : 0;
    const next = { ...sr, [d.id]: { stage, due: Date.now() + (ok ? SR_DAYS[stage - 1] * 86400000 : 0) } };
    setSr(next); try { localStorage.setItem(srKey(restaurant), JSON.stringify(next)); } catch (e) {}
    vibrate(ok ? "success" : "error");
    setFlip(false);
    if (ok) setDoneQuiz(n => n + 1);
    setIdx(i => Math.min(i, Math.max(0, (mode === "quiz" ? due.length - 1 : total) - 1)));
  };

  const text = T.modTitle.color, sub = T.modSub.color;
  const bd = a11y ? "rgba(139,106,48,0.35)" : "rgba(214,178,102,0.35)";
  const bg = a11y ? "rgba(255,255,255,0.45)" : "rgba(255,248,230,0.05)";
  const pill = (on) => ({ padding: "5px 11px", borderRadius: 999, fontSize: 12, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
    border: `1px solid ${on ? gold : bd}`, background: on ? `linear-gradient(180deg,#E4C88C,${gold})` : "transparent",
    color: on ? "#1a160f" : sub, fontWeight: on ? "bold" : "normal" });
  const iconBtn = (on) => ({ width: 34, height: 34, borderRadius: 17, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
    border: `1px solid ${on ? gold + "AA" : bd}`, background: on ? "rgba(214,178,102,0.16)" : bg });
  const ic = (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={p}/></svg>;
  const open = filters || !!q || !!cat;
  const groups = React.useMemo(() => groupByCat(dishes.filter(x => dishMatches(x, q))), [dishes, q]);

  return (
    <div style={T.screen} className="sa-screen">
      {Head("Колода меню")}
      <div style={{ padding: "6px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ display: "flex", border: `1px solid ${bd}`, borderRadius: 999, padding: 3, background: bg, gap: 2 }}>
            <span style={{ ...pill(mode === "deck"), border: "none", padding: "6px 14px" }} onClick={() => { setMode("deck"); setIdx(0); setFlip(false); }}>Колода · {dishes.length}</span>
            <span style={{ ...pill(mode === "quiz"), border: "none", padding: "6px 14px" }} onClick={() => { setMode("quiz"); setIdx(0); setFlip(false); }}>Знаю? · {due.length}</span>
          </div>
          <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, color: sub }}>{total ? (idx % total) + 1 : 0} / {total}</span>
          <span style={iconBtn(open)} onClick={() => setFilters(f => !f)} {...onActivate(() => setFilters(f => !f))} aria-label="Поиск и разделы">{ic("M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4")}</span>
          <span style={iconBtn(view === "index")} onClick={() => setView(v => v === "index" ? "cards" : "index")} {...onActivate(() => setView(v => v === "index" ? "cards" : "index"))} aria-label={view === "index" ? "Карточки" : "Список"}>{ic("M4 6h16M4 12h16M4 18h10")}</span>
        </div>
        {open && (
          <div className="sa-fadein" style={{ marginBottom: 12 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Блюдо, ингредиент, аллерген…" autoFocus={filters && !q}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 12, border: `1px solid ${bd}`, background: bg, color: text, fontFamily: "Georgia, serif", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
            <div className="sa-hscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
              <span style={{ ...pill(!cat), padding: "4px 10px", fontSize: 11 }} onClick={() => setCat("")}>Все · {dishes.filter(x => dishMatches(x, q)).length}</span>
              {groups.map(g => <span key={g.cat} style={{ ...pill(cat === g.cat), padding: "4px 10px", fontSize: 11 }} onClick={() => setCat(cat === g.cat ? "" : g.cat)}>{g.cat} · {g.items.length}</span>)}
            </div>
          </div>
        )}
      </div>

      {view === "index" ? (
        <div style={{ padding: "0 16px 100px" }}>
          {groupByCat(pool).map(g => (
            <div key={g.cat} style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", margin: "0 2px 6px" }}>{g.cat.toUpperCase()} · {g.items.length}</div>
              {g.items.map(x => {
                const r = sr[x.id]; const known = r && r.stage > 0 && r.due > Date.now();
                return (
                  <div key={x.id} className="sa-card" onClick={() => { const i = list.indexOf(x); if (i >= 0) { setIdx(i); setFlip(false); setView("cards"); vibrate("light"); } else { setMode("deck"); setTimeout(() => { setIdx(pool.indexOf(x)); setView("cards"); }, 0); } }}
                    {...onActivate(() => { const i = list.indexOf(x); if (i >= 0) { setIdx(i); setView("cards"); } })}
                    style={{ ...glass(T), display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 6, cursor: "pointer" }}>
                    {x.img ? <img src={x.img} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} /> : <div style={{ width: 40, height: 40, borderRadius: 10, border: `1px dashed ${bd}`, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.name}</div>
                    <span style={{ fontSize: 11, color: x.stop ? (red || "#B8352A") : known ? (green || "#5DBB8A") : sub }}>{x.stop ? "в стопе" : known ? "знаю ✓" : "к повтору"}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : !d ? (
        <div style={{ textAlign: "center", padding: "50px 24px 100px" }}>
          <div style={{ ...T.bold, marginBottom: 8 }}>{mode === "quiz" ? "Всё повторено ✓" : "Ничего не нашлось"}</div>
          <div style={{ color: sub, fontSize: 14, marginBottom: 20 }}>{mode === "quiz" ? "Карточки вернутся по интервалам: через день, три, неделю, месяц." : "Попробуй другое слово или сними раздел"}</div>
          {mode === "quiz" && onLearned && <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background: green || gold, width: "100%" }} onClick={onLearned}>Выучил новинки ✓</button>}
        </div>
      ) : (
        <>
          <div style={{ padding: "0 16px" }}>
            <div className="sa-ck-wrap" ref={wrapRef}
              onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} onTouchCancel={onTE}
              onClick={() => { if (moved.current || busy.current) return; setFlip(f => !f); vibrate("light"); }}
              style={{ cursor: "pointer", willChange: "transform, opacity", touchAction: "pan-y" }}>
              <div className="sa-ck-inner" style={{ transform: flip ? "rotateY(180deg)" : "none", transition: snapRef.current ? "none" : undefined }}>
                <div className="sa-ck-face" style={{ ...glass(T), padding: "18px 18px 16px", boxSizing: "border-box" }}>
                  {d.stop && <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: "inherit" }}><div style={{ position: "absolute", top: 16, right: -36, transform: "rotate(35deg)", background: red || "#B8352A", color: "#fff", fontSize: 10, letterSpacing: 1.5, padding: "4px 42px" }}>СЕГОДНЯ НЕТ</div></div>}
                  <DishPhoto src={d.img} h={190} />
                  <div style={{ fontSize: 11, letterSpacing: 2, color: gold, fontFamily: "monospace", marginBottom: 6 }}>{(d.cat || "БЛЮДО").toUpperCase()}</div>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: text, lineHeight: 1.2 }}>{d.name}</div>
                  <div style={{ color: sub, fontSize: 13, lineHeight: 1.55, marginTop: 10 }}>Вспомни состав, аллергены и как описать гостю — потом переверни и сверься.</div>
                  <div style={{ marginTop: 14, fontSize: 11.5, color: gold, fontStyle: "italic", textAlign: "center" }}>тапни — состав ✦</div>
                </div>
                <div className="sa-ck-face sa-ck-back" style={{ ...glass(T), padding: "16px 18px", boxSizing: "border-box" }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: gold, fontFamily: "monospace", marginBottom: 4 }}>{(d.cat || "БЛЮДО").toUpperCase()}</div>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 19, color: text, marginBottom: 8 }}>{d.name}{d.stop ? <span style={{ color: red || "#B8352A", fontSize: 11, marginLeft: 8, letterSpacing: 1 }}>В СТОПЕ</span> : null}</div>
                  {d.desc && <div style={{ fontSize: 13.5, color: T.para?.color || text, lineHeight: 1.55, fontStyle: "italic", marginBottom: 8 }}>{d.desc}</div>}
                  <DishBack d={d} T={T} gold={gold} />
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: "12px 16px 100px" }}>
            {mode === "quiz" ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button className="sa-btn" onClick={() => mark(false)} style={{ ...pill(false), flex: 1, padding: "12px", textAlign: "center", color: red || "#D96A5E", borderColor: (red || "#D96A5E") + "66", fontSize: 13 }}>Повторить</button>
                <button className="sa-btn" onClick={() => mark(true)} style={{ ...pill(true), flex: 1, padding: "12px", textAlign: "center", fontSize: 13 }}>Знал ✦</button>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button className="sa-btn" onClick={() => go(-1)} style={{ ...pill(false), padding: "10px 18px", fontSize: 13 }}>‹ назад</button>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 9.5, color: sub, letterSpacing: 1.5, whiteSpace: "nowrap" }}>СВАЙП · ЛИСТАТЬ</span>
                <button className="sa-btn" onClick={() => go(1)} style={{ ...pill(false), padding: "10px 18px", fontSize: 13 }}>дальше ›</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
