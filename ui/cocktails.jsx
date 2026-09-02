import React from "react";
import { COCKTAILS } from "../data/cocktails";
import { CocktailArt } from "./cocktail-art";
import { COCKTAIL_STORIES } from "../data/cocktail-stories";
import { vibrate, onActivate } from "../lib/utils";
import { GOLD, INK_DEEP } from "./tokens";

// Колода бармена: свайп — листать, тап — перевернуть (рецепт), режим
// «Знаю?» — интервальное повторение (1·3·7·30 дней), как у банка ошибок.
const SR_DAYS = [1, 3, 7, 30];
const KEY = "sa_cocktail_sr";
const loadSR = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };

const GLASS_RU = { rocks:"Олд фэшн", highball:"Хайбол", martini:"Бокал для мартини", hurricane:"Харрикейн", red:"Бокал для красного вина",
  white:"Бокал для белого вина", irish:"Бокал для айриш-кофе", flute:"Флюте", margarita:"Бокал «Маргарита»", shot:"Шот", sour:"Бокал сауэр" };
const dots = (n) => "●".repeat(n) + "○".repeat(4 - n);
// Навигация по колоде: база напитка (по первому ингредиенту), поиск
const BASES = ["Джин", "Водка", "Ром", "Текила", "Виски", "Бренди", "Другое"];
const baseOf = (c) => {
  const f = (c.ing[0] && c.ing[0][0] || "").toLowerCase();
  if (f.includes("джин")) return "Джин";
  if (f.includes("водк")) return "Водка";
  if (f.includes("ром")) return "Ром";
  if (f.includes("текил")) return "Текила";
  if (f.includes("виски") || f.includes("бурбон") || f.includes("скотч")) return "Виски";
  if (f.includes("коньяк") || f.includes("бренди")) return "Бренди";
  return "Другое";
};
const norm = (x) => String(x || "").toLowerCase().replace(/ё/g, "е");
const matches = (c, q) => {
  if (!q) return true;
  const n = norm(q);
  return norm(c.name).includes(n) || c.ing.some(i => norm(i[0]).includes(n)) || norm(GLASS_RU[c.glass]).includes(n);
};

export function CocktailsScreen({ T, a11y, onBack, onBasics, startId }) {
  const [sr, setSr] = React.useState(loadSR);
  const [mode, setMode] = React.useState("deck");     // deck | quiz
  const [q, setQ] = React.useState("");                 // поиск
  const [base, setBase] = React.useState("");           // фильтр по базе
  const [view, setView] = React.useState("cards");      // cards | index (оглавление)
  const [idx, setIdx] = React.useState(0);
  const [flip, setFlip] = React.useState(false);
  // Дополнение 128: плавное перелистывание. Во время свайпа карточка следует
  // за пальцем через ref (без setState — тяжёлая карточка с витражом не
  // перерисовывается на каждом движении), а отпущенная — продолжает движение
  // с той же точки, а не прыгает в центр перед вылетом.
  const wrapRef = React.useRef(null);
  const touch = React.useRef(null);        // { x, y, t, axis, dx, vx }
  const busy = React.useRef(false);        // идёт анимация перелистывания
  const snapRef = React.useRef(false);     // при смене карточки переворот сбрасывается мгновенно, а не за 0.6с
  const [anim] = React.useState(null);     // совместимость: класс анимации больше не используется
  const moved = React.useRef(false);
  const setWrap = (transform, transition, opacity) => {
    const el = wrapRef.current; if (!el) return;
    el.style.transition = transition || "none";
    el.style.transform = transform || "none";
    el.style.opacity = opacity == null ? 1 : opacity;
  };

  const due = React.useMemo(() => COCKTAILS.filter(c => { const r = sr[c.id]; return !r || !r.due || r.due <= Date.now(); }), [sr]);
  const pool = React.useMemo(() => COCKTAILS.filter(c => matches(c, q) && (!base || baseOf(c) === base)), [q, base]);
  const list = mode === "quiz" ? due.filter(c => pool.includes(c)) : pool;
  const c = list[Math.min(idx, Math.max(0, list.length - 1))];
  const total = list.length;
  React.useEffect(() => { setIdx(0); setFlip(false); }, [q, base, mode]);
  // Доп. 130: открыть колоду сразу на нужном коктейле (карточка из ответа ассистента)
  React.useEffect(() => {
    if (!startId) return;
    const i = COCKTAILS.findIndex(c => c.id === startId);
    if (i >= 0) { setIdx(i); setFlip(false); }
  }, [startId]);

  const OUT_MS = 260, IN_MS = 420;
  const go = (d) => {
    if (!total || busy.current) return;
    busy.current = true;
    vibrate("light");
    const sign = d > 0 ? -1 : 1; // вперёд — улетает влево
    setWrap(`translateX(${sign * 120}%) rotate(${sign * 9}deg) scale(.96)`,
      `transform ${OUT_MS}ms cubic-bezier(.3,.6,.4,1), opacity ${OUT_MS}ms ease-out`, 0);
    setTimeout(() => {
      snapRef.current = true; setFlip(false); setIdx(i => (i + d + total) % total);
      // новая карточка ставится за кадром с противоположной стороны без анимации…
      setWrap(`translateX(${-sign * 70}%) rotate(${-sign * 5}deg) scale(.94)`, "none", 0);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        // …и въезжает с мягким доездом (overshoot ~2%)
        setWrap("none", `transform ${IN_MS}ms cubic-bezier(.16,1.1,.3,1), opacity ${IN_MS * 0.6}ms ease-out`, 1);
        snapRef.current = false;
        setTimeout(() => { busy.current = false; }, IN_MS);
      }));
    }, OUT_MS);
  };
  const mark = (ok) => {
    const cur = sr[c.id] || { stage: 0 };
    const stage = ok ? Math.min(cur.stage + 1, SR_DAYS.length) : 0;
    const next = { ...sr, [c.id]: { stage, due: Date.now() + (ok ? SR_DAYS[stage - 1] * 86400000 : 0) } };
    setSr(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {}
    vibrate(ok ? "success" : "error");
    setFlip(false);
    setIdx(i => Math.min(i, Math.max(0, (mode === "quiz" ? due.length - 1 : total) - 1)));
  };
  const onTS = (e) => {
    if (busy.current) { touch.current = null; return; }
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now(), axis: null, dx: 0, vx: 0, lx: t.clientX, lt: Date.now() };
    moved.current = false;
  };
  const onTM = (e) => {
    const s = touch.current; if (!s) return;
    const t = e.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (!s.axis) { if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
    if (s.axis !== "x") return; // вертикальный жест — это скролл состава, не листание
    moved.current = true;
    const now = Date.now(); if (now > s.lt) { s.vx = (t.clientX - s.lx) / (now - s.lt); s.lx = t.clientX; s.lt = now; }
    s.dx = dx;
    const fade = Math.max(0.55, 1 - Math.abs(dx) / 700);
    setWrap(`translateX(${dx * 0.9}px) rotate(${dx * 0.03}deg)`, "none", fade);
  };
  const onTE = () => {
    const s = touch.current; touch.current = null;
    if (!s || s.axis !== "x") return;
    const flick = Math.abs(s.vx) > 0.45 && Math.sign(s.vx) === Math.sign(s.dx);
    if (Math.abs(s.dx) > 70 || (flick && Math.abs(s.dx) > 24)) go(s.dx < 0 ? 1 : -1);
    else setWrap("none", "transform .38s cubic-bezier(.16,1.1,.3,1), opacity .25s ease-out", 1); // не дотянул — пружиной назад
  };

  const glass = a11y ? { bg:"rgba(250,242,222,0.7)", bd:"rgba(150,112,40,0.35)", tx:"#3A2E1C", sub:"#6B5A3A" }
                     : { bg:"rgba(255,250,238,0.035)", bd:"rgba(145,108,40,0.3)", tx:"#EFE4C8", sub:"#9C8760" };
  const card = { borderRadius:20, background:glass.bg, border:`1px solid ${glass.bd}`, borderTop:`1px solid ${a11y ? "rgba(175,135,50,0.45)" : "rgba(210,168,65,0.35)"}`,
    boxShadow: a11y ? "inset 0 0 22px rgba(255,255,255,0.5)" : "inset 0 0 22px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.1), 0 14px 40px rgba(0,0,0,0.45)" };
  const pill = (on) => ({ padding:"6px 13px", borderRadius:999, fontSize:12, cursor:"pointer", fontFamily:"Georgia, serif",
    color: on ? INK_DEEP : glass.sub, background: on ? `linear-gradient(180deg,#E4C88C,${GOLD})` : "transparent",
    border: `1px solid ${on ? "transparent" : glass.bd}` });

  return (
    <div style={{ padding:"8px 14px 100px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        <span onClick={onBack} {...onActivate(onBack)} style={{ color:GOLD, fontSize:22, cursor:"pointer", padding:"0 6px" }}>‹</span>
        <div style={{ fontFamily:"Georgia, serif", fontSize:19, color:glass.tx, flex:1 }}>Колода бармена</div>
        <span style={{ fontFamily:"ui-monospace, Menlo, monospace", fontSize:10, color:glass.sub }}>{total ? (idx % total) + 1 : 0} / {total}</span>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <span style={pill(mode === "deck")} onClick={() => { setMode("deck"); setIdx(0); setFlip(false); }}>Колода · 50</span>
        <span style={pill(mode === "quiz")} onClick={() => { setMode("quiz"); setIdx(0); setFlip(false); }}>Знаю? · {due.length}</span>
        {onBasics ? <span style={{ ...pill(false), marginLeft:"auto" }} onClick={() => onBasics("brc-canon")}>Основы ›</span> : null}
      </div>
      {/* Поиск + база + оглавление: 50 карточек — нужна навигация */}
      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Название, ингредиент или бокал…"
          style={{ flex:1, padding:"9px 12px", borderRadius:12, border:`1px solid ${glass.bd}`, background:glass.bg, color:glass.tx,
            fontFamily:"Georgia, serif", fontSize:13, outline:"none", boxSizing:"border-box" }} />
        <span style={pill(view === "index")} onClick={() => setView(v => v === "index" ? "cards" : "index")}>{view === "index" ? "Карточки" : "Список"}</span>
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
        <span style={{ ...pill(!base), padding:"4px 10px", fontSize:11 }} onClick={() => setBase("")}>Все · {COCKTAILS.filter(c => matches(c, q)).length}</span>
        {BASES.map(b => {
          const n = COCKTAILS.filter(c => matches(c, q) && baseOf(c) === b).length;
          if (!n) return null;
          return <span key={b} style={{ ...pill(base === b), padding:"4px 10px", fontSize:11 }} onClick={() => setBase(base === b ? "" : b)}>{b} · {n}</span>;
        })}
      </div>
      {view === "index" ? (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {pool.map((x, i) => (
            <div key={x.id} onClick={() => { setIdx(i); setFlip(false); setView("cards"); vibrate("light"); }}
              style={{ ...card, padding:"10px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ width:14, height:14, borderRadius:7, flexShrink:0, background:`linear-gradient(180deg,${x.color[0]},${x.color[1]})`, boxShadow:"inset 0 1px 0 rgba(255,255,255,0.25)" }} />
              <span style={{ minWidth:0 }}>
                <div style={{ fontFamily:"Georgia, serif", fontSize:13, color:glass.tx, lineHeight:1.2 }}>{x.name}</div>
                <div style={{ fontFamily:"ui-monospace, Menlo, monospace", fontSize:9, color:glass.sub, letterSpacing:0.8 }}>{GLASS_RU[x.glass]}</div>
              </span>
            </div>
          ))}
          {!pool.length ? <div style={{ gridColumn:"1 / -1", color:glass.sub, fontFamily:"Georgia, serif", textAlign:"center", padding:20 }}>Ничего не нашлось — попробуй другое слово</div> : null}
        </div>
      ) : null}
      <div style={{ display: view === "index" ? "none" : "block" }}>

      {!c ? (
        <div style={{ ...card, padding:28, textAlign:"center", color:glass.sub, fontFamily:"Georgia, serif" }}>
          Всё повторено ✦ Карточки вернутся по кривой памяти — через день, три, неделю, месяц.
        </div>
      ) : (
        <div className="sa-ck-wrap" ref={wrapRef}
          onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} onTouchCancel={onTE}
          onClick={() => { if (moved.current || busy.current) return; setFlip(f => !f); vibrate("light"); }}
          style={{ cursor:"pointer", willChange:"transform, opacity", touchAction:"pan-y" }}>
          <div className="sa-ck-inner" style={{ transform: flip ? "rotateY(180deg)" : "none", transition: snapRef.current ? "none" : undefined }}>
            <div className="sa-ck-face sa-ck-front" style={{ ...card, padding:16 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"Georgia, serif", fontSize:24, color:glass.tx, letterSpacing:1.5, textTransform:"uppercase", lineHeight:1.2, marginTop:4 }}>{c.name}</div>
              <div style={{ fontFamily:"ui-monospace, Menlo, monospace", fontSize:9.5, color:glass.sub, letterSpacing:1.5, marginTop:6 }}>
                {mode === "quiz" ? "ВСПОМНИ СПЕК · ТАПНИ, ЧТОБЫ ПРОВЕРИТЬ" : c.ing.map(i => i[0]).join(" · ").toUpperCase()}
              </div>
              <div style={{ display:"flex", justifyContent:"center", margin:"6px 0 2px" }}><CocktailArt c={c} w={200} light={a11y} /></div>
              <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                <span style={{ ...pill(false), fontFamily:"ui-monospace, Menlo, monospace", fontSize:9.5, letterSpacing:1.2, color:GOLD }}>КРЕПОСТЬ {dots(c.strength)}</span>
                <span style={{ ...pill(false), fontFamily:"ui-monospace, Menlo, monospace", fontSize:9.5, letterSpacing:1.2, color:GOLD }}>СЛАДОСТЬ {dots(c.sweet)}</span>
              </div>
              <div style={{ fontFamily:"Georgia, serif", fontStyle:"italic", fontSize:12, color:glass.sub, marginTop:10 }}>тапни — рецепт ✦</div>
            </div>
            </div>
            <div className="sa-ck-face sa-ck-back" style={{ ...card, padding:16 }}>
            <div style={{ fontFamily:"Georgia, serif", color:glass.tx, fontSize:14, lineHeight:1.55 }}>
              <div style={{ fontSize:20, letterSpacing:1, textTransform:"uppercase", marginBottom:2 }}>{c.name}</div>
              <div style={{ fontFamily:"ui-monospace, Menlo, monospace", fontSize:9.5, color:GOLD, letterSpacing:1.5, marginBottom:10 }}>{GLASS_RU[c.glass]} · {c.method.toUpperCase()}</div>
              {c.ing.map((i, k) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", borderBottom:`1px dashed ${glass.bd}`, padding:"3px 0" }}>
                  <span>{i[0]}</span><span style={{ fontFamily:"ui-monospace, Menlo, monospace", color:GOLD }}>{i[1]} {i[2] || "мл"}</span>
                </div>
              ))}
              <ol style={{ margin:"10px 0 8px", paddingLeft:20, color:glass.tx }}>{c.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>
              <div style={{ color:glass.sub, fontStyle:"italic", fontSize:12.5 }}>{c.tip}</div>
              <div style={{ color:glass.sub, fontSize:12.5, marginTop:6 }}>К столу: {c.pair}</div>
              {COCKTAIL_STORIES[c.id] ? (
                <div style={{ marginTop:12, paddingTop:10, borderTop:`1px solid ${glass.bd}` }}>
                  <div style={{ fontFamily:"ui-monospace, Menlo, monospace", fontSize:9.5, color:GOLD, letterSpacing:1.5, marginBottom:4 }}>ИСТОРИЯ</div>
                  <div style={{ fontSize:13, lineHeight:1.55 }}>{COCKTAIL_STORIES[c.id].story}</div>
                  {COCKTAIL_STORIES[c.id].guest ? (
                    <div style={{ marginTop:8, fontStyle:"italic", color:glass.sub, fontSize:12.5 }}>Гостю: «{COCKTAIL_STORIES[c.id].guest}»</div>
                  ) : null}
                </div>
              ) : null}
              {c.house ? <div style={{ color:GOLD, fontSize:11, marginTop:8 }}>✦ без канона — спек по карточке заведения</div> : null}
            </div>
            </div>
          </div>
        </div>

      )}

      {c && mode === "quiz" && flip ? (
        <div style={{ display:"flex", gap:10, marginTop:12 }}>
          <button className="sa-btn" onClick={() => mark(false)} style={{ ...pill(false), flex:1, padding:"12px", textAlign:"center", color:"#D96A5E", borderColor:"#D96A5E66" }}>Повторить</button>
          <button className="sa-btn" onClick={() => mark(true)} style={{ ...pill(true), flex:1, padding:"12px", textAlign:"center" }}>Знал ✦</button>
        </div>
      ) : c ? (
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:12 }}>
          <button className="sa-btn" onClick={() => go(-1)} style={{ ...pill(false), padding:"10px 18px" }}>‹ назад</button>
          <span style={{ alignSelf:"center", fontFamily:"ui-monospace, Menlo, monospace", fontSize:9.5, color:glass.sub, letterSpacing:1.5 }}>СВАЙП · ЛИСТАТЬ</span>
          <button className="sa-btn" onClick={() => go(1)} style={{ ...pill(false), padding:"10px 18px" }}>дальше ›</button>
        </div>
      ) : null}
      </div>
    </div>
  );
}
