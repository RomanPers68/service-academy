// ui/widgets.jsx
// Небольшие самостоятельные виджеты, вынесенные из App.jsx (поведение и код без изменений).

import React from "react";
import { MOD_SVG } from "./icons";
import { CREAM, GOLD, GOLD_SOFT, GREEN, RED } from "./tokens";
import { vibrate } from "../lib/utils";

export function Confetti() {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: [GOLD,GREEN,RED,"#8B7BAB","#7B8FAB",CREAM,GOLD_SOFT][Math.floor(Math.random()*7)],
      rot: Math.random() * Math.PI * 2,
      vx: Math.random() * 2 - 1,
      vy: Math.random() * 3 + 2,
      vrot: (Math.random() - 0.5) * 0.15,
      opacity: 1,
    }));
    let frame;
    let tick = 0;
    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        if (tick > 120) p.opacity = Math.max(0, p.opacity - 0.008);
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
      });
      if (pieces.some(p => p.opacity > 0)) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={canvasRef} style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:999 }} />;
}

export function TimerBar({ duration, color, onExpire }) {
  const [timeLeft, setTimeLeft] = React.useState(duration);
  React.useEffect(() => {
    if (timeLeft <= 0) { onExpire(); return; }
    const t = setTimeout(() => setTimeLeft(t => t-1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);
  const pct = (timeLeft/duration)*100;
  const barColor = pct>60?GREEN:pct>30?GOLD_SOFT:RED;
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ color:barColor, fontSize:11, fontFamily:"monospace", fontWeight:"bold", display:"inline-flex", alignItems:"center", gap:5 }}>{MOD_SVG["⚡"](barColor, 12)}БЫСТРЫЙ ВЫБОР</span>
        <span style={{ color:barColor, fontSize:13, fontWeight:"bold" }}>{timeLeft}с</span>
      </div>
      <div style={{ height:4, background:"rgba(255,255,255,0.1)", borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:2, transition:"width 1s linear, background 0.3s" }} />
      </div>
    </div>
  );
}

export function SayAloud({ phrase, T, color }) {
  const [done, setDone] = React.useState(null);
  const gold = GOLD;
  return (
    <div style={{ background:"rgba(200,169,110,0.1)", border:"1.5px solid rgba(200,169,110,0.4)", borderRadius:14, padding:"13px 14px", marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
        <span style={{ fontSize:16 }}>🗣</span>
        <span style={{ color:gold, fontSize:10.5, letterSpacing:1.5, fontFamily:"monospace", fontWeight:"bold" }}>А ТЕПЕРЬ — ВСЛУХ</span>
      </div>
      <div style={{ color:T.para.color, fontSize:14, lineHeight:1.6, fontStyle:"italic", marginBottom:done===null?12:10 }}>«{phrase}»</div>
      {done===null ? (
        <>
          <div style={{ color:T.modSub.color, fontSize:12, marginBottom:10, lineHeight:1.5 }}>Проговори фразу вслух — как живому гостю. Получилось?</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setDone("ok")} style={{ flex:1, padding:"9px", borderRadius:11, border:"none", background:gold, color:"#241a0a", fontSize:13, fontWeight:"bold", cursor:"pointer" }}>Получилось</button>
            <button onClick={()=>setDone("again")} style={{ flex:1, padding:"9px", borderRadius:11, border:`1.5px solid ${gold}`, background:"transparent", color:gold, fontSize:13, fontWeight:"bold", cursor:"pointer" }}>Ещё разок</button>
          </div>
        </>
      ) : (
        <div style={{ color:done==="ok"?GREEN:gold, fontSize:13, fontWeight:"bold", lineHeight:1.5 }}>
          {done==="ok" ? "🔥 Отлично! Звучит уверенно." : "💪 Ещё пара повторов — и пойдёт на автомате."}
        </div>
      )}
    </div>
  );
}

// ── «Жидкое стекло»: сегмент-переключатель с плавающей линзой ────────
// Плоская стеклянная «линза» скользит к активному пункту с пружиной.
// equal=true — пункты одинаковой ширины (flex:1): линзу можно тянуть пальцем,
// она следует за пальцем и прилипает к ближайшему пункту (как в навбаре).
// equal=false + scroll — чипсы своей ширины в горизонтальной ленте:
// жест отдан прокрутке, выбор — тапом, линза перелетает сама.
export function LiquidSegment({
  items, activeId, onSelect, a11y = false,
  equal = true, scroll = false,
  accent, muted,
  trackStyle = {}, itemStyle = {},
}) {
  const trackRef = React.useRef(null);
  const itemRefs = React.useRef({});
  const [rect, setRect] = React.useState(null);
  const [dragX, setDragX] = React.useState(null); // x центра линзы при перетаскивании
  const drag = React.useRef(null);
  const dragEndAt = React.useRef(0);
  const acc = accent || (a11y ? "#6B4E1A" : GOLD);
  const dim = muted || (a11y ? "#5C3D10" : "#9A8060");
  const canDrag = !scroll; // в скролл-лентах горизонтальный жест — это прокрутка

  const measure = React.useCallback(() => {
    const el = itemRefs.current[activeId];
    if (!el) { setRect(null); return; }
    setRect({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
  }, [activeId]);
  React.useLayoutEffect(() => { measure(); }, [measure, items.length]);
  React.useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const centers = () => items.map(it => {
    const el = itemRefs.current[it.id];
    return el ? el.offsetLeft + el.offsetWidth / 2 : 0;
  });
  const nearestIdx = (x) => {
    let best = 0, bd = Infinity;
    centers().forEach((c, i) => { const d = Math.abs(c - x); if (d < bd) { bd = d; best = i; } });
    return best;
  };

  const evX = (e) => {
    const r = trackRef.current ? trackRef.current.getBoundingClientRect() : { left: 0 };
    return (e.clientX != null ? e.clientX : 0) - r.left + (trackRef.current ? trackRef.current.scrollLeft : 0);
  };
  const onDown = (e) => {
    drag.current = { x0: evX(e), moved: false, last: null };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const x = evX(e);
    if (!drag.current.moved && Math.abs(x - drag.current.x0) < 7) return;
    drag.current.moved = true;
    setDragX(x);
    const hi = nearestIdx(x);
    if (drag.current.last !== null && drag.current.last !== hi) vibrate("light");
    drag.current.last = hi;
  };
  const onUp = (e) => {
    if (!drag.current) return;
    const info = drag.current; drag.current = null;
    if (!info.moved) return; // обычный тап обработает onClick кнопки
    dragEndAt.current = Date.now();
    setDragX(null);
    const it = items[nearestIdx(evX(e))];
    if (it && it.id !== activeId) onSelect(it.id);
  };
  const onCancel = () => { drag.current = null; setDragX(null); };

  const litId = dragX !== null && items.length ? items[nearestIdx(dragX)].id : activeId;
  const lens = (dragX !== null && rect) ? { ...rect, left: dragX - rect.width / 2 } : rect;
  const spring = "cubic-bezier(0.3,1.3,0.45,1)";

  return (
    <div ref={trackRef}
      className={(scroll || canDrag) ? "sa-hscroll" : undefined}
      onPointerDown={canDrag ? onDown : undefined}
      onPointerMove={canDrag ? onMove : undefined}
      onPointerUp={canDrag ? onUp : undefined}
      onPointerCancel={canDrag ? onCancel : undefined}
      style={{
        position:"relative", display:"flex", gap:4, padding:4, borderRadius:16,
        background: a11y ? "rgba(140,105,40,0.12)" : "rgba(160,120,60,0.14)",
        overflowX: scroll ? "auto" : "visible",
        WebkitOverflowScrolling:"touch", scrollbarWidth:"none",
        userSelect:"none", WebkitUserSelect:"none",
        ...trackStyle,
      }}>
      <style>{`@keyframes saLensStretch{0%{transform:scaleX(1) scaleY(1)}35%{transform:scaleX(1.22) scaleY(0.86)}68%{transform:scaleX(0.96) scaleY(1.03)}100%{transform:scaleX(1) scaleY(1)}}`}</style>
      {lens && (
        <div aria-hidden style={{
          position:"absolute", zIndex:0, pointerEvents:"none",
          left:lens.left, top:lens.top, width:lens.width, height:lens.height,
          transition: dragX !== null ? "none"
            : `left 0.5s ${spring}, width 0.5s ${spring}, top 0.35s ease, height 0.35s ease`,
        }}>
          <div key={dragX !== null ? "__drag" : activeId} style={{
            position:"relative", width:"100%", height:"100%", borderRadius:999, overflow:"hidden",
            animation: dragX !== null ? "none" : "saLensStretch 0.5s cubic-bezier(0.33,1,0.68,1)",
            background: a11y
              ? "linear-gradient(180deg, rgba(107,78,26,0.10), rgba(107,78,26,0.05))"
              : "rgba(250,240,215,0.09)",
            boxShadow: a11y
              ? "inset 0 1px 1px rgba(255,255,255,0.40), 0 2px 6px rgba(0,0,0,0.08), 0 0 0 1px rgba(107,78,26,0.15)"
              : "inset 0 0 0 1px rgba(255,255,255,0.12), 0 2px 6px rgba(0,0,0,0.18)",
          }}>
            {/* хроматическая (радужная) кромка */}
            <div style={{
              position:"absolute", inset:0, borderRadius:999, padding:1.2, opacity: a11y ? 0.4 : 0.28,
              background:"conic-gradient(from 210deg, rgba(255,90,90,0.6), rgba(255,205,70,0.55), rgba(120,235,160,0.5), rgba(95,175,255,0.6), rgba(200,125,255,0.55), rgba(255,90,90,0.6))",
              WebkitMask:"linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite:"xor", maskComposite:"exclude",
              filter:"blur(0.5px)",
            }} />
            {/* тонкая световая кромка сверху — плоское стекло */}
            <div style={{ position:"absolute", top:1, left:"12%", right:"12%", height:1.5, borderRadius:999,
              background:`linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,${a11y ? 0.4 : 0.18}), rgba(255,255,255,0))` }} />
          </div>
        </div>
      )}
      {items.map(it => {
        const active = it.id === litId;
        return (
          <button key={it.id} ref={el => { itemRefs.current[it.id] = el; }}
            onClick={() => {
              if (Date.now() - dragEndAt.current < 300) return; // клик-«хвост» после перетаскивания
              if (it.id !== activeId) onSelect(it.id);
            }}
            style={{
              position:"relative", zIndex:1, border:"none", background:"transparent", cursor:"pointer",
              flex: equal ? 1 : "0 0 auto", whiteSpace: equal ? undefined : "nowrap",
              padding:"8px 12px", borderRadius:999,
              fontFamily:"'Spectral', Georgia, serif", fontSize:13, fontWeight:"bold",
              color: active ? acc : dim,
              opacity: active ? 1 : 0.75,
              transform: active ? "scale(1.05)" : "scale(1)",
              transition:"color 0.3s ease, opacity 0.3s ease, transform 0.45s cubic-bezier(0.34,1.56,0.64,1)",
              ...itemStyle,
            }}>
            {it.render ? it.render(active) : it.label}
          </button>
        );
      })}
    </div>
  );
}
