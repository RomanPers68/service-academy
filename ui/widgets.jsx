// ui/widgets.jsx
// Небольшие самостоятельные виджеты, вынесенные из App.jsx (поведение и код без изменений).

import React from "react";
import { MOD_SVG } from "./icons";

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
      color: ["#C8A96E","#5DBB8A","#E07878","#8B7BAB","#7B8FAB","#F0E8D8","#D4A85A"][Math.floor(Math.random()*7)],
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
  const barColor = pct>60?"#5DBB8A":pct>30?"#D4A85A":"#E07878";
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
  const gold = "#C8A96E";
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
        <div style={{ color:done==="ok"?"#5DBB8A":gold, fontSize:13, fontWeight:"bold", lineHeight:1.5 }}>
          {done==="ok" ? "🔥 Отлично! Звучит уверенно." : "💪 Ещё пара повторов — и пойдёт на автомате."}
        </div>
      )}
    </div>
  );
}
