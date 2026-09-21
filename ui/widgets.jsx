// ui/widgets.jsx
// Небольшие самостоятельные виджеты, вынесенные из App.jsx (поведение и код без изменений).

import React from "react";
import { createPortal } from "react-dom";
import { MOD_SVG } from "./icons";
import { CREAM, GOLD, GOLD_SOFT, GREEN, RED } from "./tokens";
import { vibrate } from "../lib/utils";
import { HINTS_VERSION } from "../data/hints";

/** Пустое состояние — один язык на всё приложение.
 *  Было вразнобой: где-то голый текст «Смена не найдена» (читается как
 *  поломка), где-то бумажная карточка с печатью (читается как обещание).
 *  Один и тот же тип экрана вызывал противоположное чувство.
 *  Пунктирная рамка здесь не украшение: она говорит «пока пусто», тогда как
 *  сплошная выглядит законченным блоком, в котором чего-то не хватает.
 *  Формулировка тоже часть приёма — «сегодня смен нет» вместо «не найдена». */
export function EmptyState({ a11y, icon, title, hint, action, onAction }) {
  const text = a11y ? "#2A2113" : "#EFE4C8";
  const sub  = a11y ? "#6E5C3C" : "#8F7B57";
  const gold = a11y ? "#8B6A30" : GOLD;
  return (
    <div style={{ textAlign:"center", padding:"18px 14px", borderRadius:14,
      border:`1px dashed ${a11y ? "rgba(150,112,40,0.38)" : "rgba(145,108,40,0.38)"}`,
      boxShadow: a11y ? "inset 0 0 18px rgba(255,255,255,0.45)" : "inset 0 0 18px rgba(255,248,230,0.03)" }}>
      {icon ? (
        <div style={{ width:38, height:38, borderRadius:"50%", margin:"0 auto 10px",
          display:"grid", placeItems:"center",
          border:`1px solid ${a11y ? "rgba(150,112,40,0.3)" : "rgba(200,169,110,0.32)"}` }}>{icon}</div>
      ) : null}
      <div style={{ fontFamily:"Georgia, serif", fontSize:16, color:text, lineHeight:1.3 }}>{title}</div>
      {hint ? <div style={{ fontSize:12, color:sub, marginTop:6, lineHeight:1.45 }}>{hint}</div> : null}
      {action && onAction ? (
        <div onClick={(e) => { e.stopPropagation(); onAction(); }}
          style={{ display:"inline-block", marginTop:12, padding:"8px 18px", borderRadius:999,
            cursor:"pointer", fontFamily:"Georgia, serif", fontSize:12.5, color:gold,
            border:`1px solid ${gold}73` }}>{action}</div>
      ) : null}
    </div>
  );
}

/** Контекстная подсказка: появляется при первом входе в раздел, подсвечивает
 *  кнопку пульсацией и показывает стрелку в её сторону.
 *
 *  Почему так, а не карточками при первом запуске: обучать двадцати разделам
 *  до того, как человек увидел хоть один экран, бессмысленно — он не запомнит.
 *  Подсказка приходит в момент, когда вопрос уже возник.
 *
 *  Роли разведены флагами (`sa_hint_sched_staff` против `…_admin`): сотрудник
 *  и руководитель решают в графике разные задачи, и менеджер, начинавший
 *  стажёром, иначе не увидел бы своей подсказки вовсе.
 *
 *  Пульсация — класс `.sa-pulse`, тот же, что в уроках; он уже погашен
 *  в системном «спокойном режиме», так что ничего добавлять не нужно.
 */
export function useHintOnce(key, ready = true) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    if (!ready) return;
    try { if (localStorage.getItem("sa_hint_v" + HINTS_VERSION + "_" + key) !== "1") setOn(true); } catch (e) {}
  }, [key, ready]);
  const close = React.useCallback(() => {
    setOn(false);
    try { localStorage.setItem("sa_hint_v" + HINTS_VERSION + "_" + key, "1"); } catch (e) {}
  }, [key]);
  return [on, close];
}

/** Шаг подсказки: одна строка — иконка, текст с полосками шагов, кнопка.
 *  Крестик вместо слова «скрыть»: жест закрытия привычен и не требует слов.
 *  Стрелка — ромб БЕЗ собственных граней: со своими на стыке с пузырём
 *  проступала лишняя линия, и он выглядел наклейкой, а не продолжением стекла. */
/** Подсказка с привязкой к элементу.
 *
 *  Раньше пузырь просто стоял сверху раздела и пульсировала кнопка — связь
 *  приходилось додумывать. Теперь цель обводится светом, всё остальное
 *  притемняется, и вопрос «что именно мне объясняют» не возникает.
 *
 *  `anchorRef` — ссылка на объясняемый элемент. Без неё компонент работает
 *  по-старому: обычный пузырь в потоке (так сделаны разделы, где объясняется
 *  экран целиком, а не отдельная кнопка).
 *
 *  Положение пересчитывается при прокрутке, повороте и смене шага. Если под
 *  целью не помещается — пузырь встаёт над ней. По горизонтали прижимается
 *  к краям экрана, чтобы не уезжать за них на узких телефонах.
 */
export function HintBubble({ a11y, text, arrow = "up", at = "center", anchorRef,
                             step = 1, total = 1, onNext, onClose, style }) {
  const txt  = a11y ? "#2A2113" : "#EFE4C8";
  const sub  = a11y ? "#6E5C3C" : "#8F7B57";
  const gold = a11y ? "#8B6A30" : GOLD;
  const fill = a11y ? "rgba(246,238,220,0.99)" : "rgba(40,31,16,0.99)";
  const edge = a11y ? "rgba(150,112,40,0.4)" : "rgba(214,178,102,0.4)";

  const [box, setBox] = React.useState(null);
  React.useLayoutEffect(() => {
    const el = anchorRef && anchorRef.current;
    if (!el) { setBox(null); return; }
    const measure = () => {
      try {
        const r = el.getBoundingClientRect();
        setBox({ top: r.top, left: r.left, w: r.width, h: r.height });
      } catch (e) {}
    };
    measure();
    // Цель могла остаться за экраном — подводим к ней, иначе подсветка
    // окажется там, куда человек не смотрит.
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
    const t = setTimeout(measure, 380);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [anchorRef, step]);

  const body = (
    <div className="sa-hintglow" style={{ position:"relative", display:"flex", alignItems:"center", gap:10,
      padding:"10px 12px", borderRadius:16, background:fill,
      border:`1px solid ${edge}`,
      boxShadow: a11y
        ? "inset 0 0 22px rgba(255,255,255,0.5), inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 28px rgba(60,42,10,0.28)"
        : "inset 0 0 22px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.11), 0 10px 28px rgba(0,0,0,0.6)" }}>
      <span style={{ width:24, height:24, borderRadius:"50%", flexShrink:0, display:"grid",
        placeItems:"center", background:`${gold}2E`, border:`1px solid ${gold}66` }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={gold}
          strokeWidth="2" strokeLinecap="round"><path d="M12 17v.01"/>
          <path d="M12 14c0-2 3-2.5 3-5a3 3 0 0 0-6 0"/></svg>
      </span>
      <span style={{ flex:1, minWidth:0 }}>
        <span style={{ display:"block", fontFamily:"monospace", fontSize:8,
          letterSpacing:1.8, textTransform:"uppercase", color:gold, marginBottom:3 }}>подсказка</span>
        <span style={{ display:"block", fontFamily:"Georgia, serif", fontSize:12.5,
          lineHeight:1.45, color:txt }}>{text}</span>
        {total > 1 ? (
          <span style={{ display:"flex", gap:4, marginTop:6 }}>
            {Array.from({ length: total }, (_, i) => (
              <i key={i} style={{ display:"block", height:2.5, borderRadius:2,
                width: i === step - 1 ? 13 : 5,
                background: i === step - 1 ? gold : `${gold}47`,
                transition:"width .3s ease" }} />
            ))}
          </span>
        ) : null}
      </span>
      <span onClick={onNext || onClose} style={{ flexShrink:0, fontFamily:"Georgia, serif",
        fontSize:11.5, fontWeight:"bold", color:"#1A1008", cursor:"pointer",
        background:`linear-gradient(180deg,#E4C88C,${GOLD})`,
        padding:"6px 13px", borderRadius:999 }}>{onNext ? "Дальше" : "Понятно"}</span>
      <span onClick={onClose} title="Больше не показывать"
        style={{ position:"absolute", top:5, right:6, width:18, height:18, borderRadius:"50%",
          display:"grid", placeItems:"center", fontSize:10, color:sub, cursor:"pointer",
          border:`1px solid ${edge}` }}>✕</span>
    </div>
  );

  const nub = (dir, off) => (
    <span style={{ display:"block", width:11, height:11,
      marginLeft: off === "left" ? 26 : "auto", marginRight: off === "right" ? 26 : "auto",
      marginBottom: dir === "up" ? -6 : 0, marginTop: dir === "down" ? -6 : 0,
      transform:"rotate(45deg)", background:fill,
      borderLeft: dir === "up" ? `1px solid ${edge}` : "none",
      borderTop: dir === "up" ? `1px solid ${edge}` : "none",
      borderRight: dir === "down" ? `1px solid ${edge}` : "none",
      borderBottom: dir === "down" ? `1px solid ${edge}` : "none",
      position:"relative", zIndex: dir === "up" ? 1 : 0 }} />
  );

  // Без привязки — прежнее поведение: пузырь в потоке страницы
  if (!box) {
    return (
      <div className="sa-hintin" style={{ margin:"7px 14px", ...style }}>
        {arrow === "up" ? nub("up", at) : null}
        {body}
        {arrow === "down" ? nub("down", at) : null}
      </div>
    );
  }

  const vw = window.innerWidth, vh = window.innerHeight;
  const pad = 12, W = Math.min(vw - pad * 2, 380);
  const below = box.top + box.h + 150 < vh;          // помещается ли под целью
  const left = Math.max(pad, Math.min(box.left + box.w / 2 - W / 2, vw - W - pad));
  const cx = box.left + box.w / 2 - left;            // центр цели внутри пузыря
  const tail = (
    <span style={{ display:"block", width:12, height:12, transform:"rotate(45deg)",
      background:fill, position:"absolute", left: Math.max(14, Math.min(cx - 6, W - 26)),
      [below ? "top" : "bottom"]: -6,
      borderLeft: below ? `1px solid ${edge}` : "none",
      borderTop: below ? `1px solid ${edge}` : "none",
      borderRight: below ? "none" : `1px solid ${edge}`,
      borderBottom: below ? "none" : `1px solid ${edge}` }} />
  );

  return createPortal(
    <div style={{ position:"fixed", inset:0, zIndex:4000 }}>
      {/* Притемнение всего, кроме цели. Дыра сделана огромной тенью вокруг
          рамки — так не нужны SVG-маски и это работает везде. */}
      <div onClick={onClose} style={{ position:"fixed", inset:0 }} />
      <div style={{ position:"fixed", pointerEvents:"none",
        top: box.top - 6, left: box.left - 6, width: box.w + 12, height: box.h + 12,
        borderRadius:16, border:`1.5px solid ${gold}`,
        boxShadow:`0 0 0 9999px ${a11y ? "rgba(40,30,10,0.42)" : "rgba(0,0,0,0.62)"}, 0 0 22px ${gold}66`,
        transition:"top .25s ease, left .25s ease, width .25s ease, height .25s ease" }} />
      <div className="sa-hintin" style={{ position:"fixed", width:W, left,
        [below ? "top" : "bottom"]: below ? box.top + box.h + 14 : vh - box.top + 14 }}>
        {tail}{body}
      </div>
    </div>,
    document.body
  );
}

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
        <span style={{ color:barColor, fontSize:11, fontFamily:"monospace", fontWeight:"bold", display:"inline-flex", alignItems:"center", gap:4 }}>{MOD_SVG["⚡"](barColor, 12)}БЫСТРЫЙ ВЫБОР</span>
        <span style={{ color:barColor, fontSize:12.5, fontWeight:"bold" }}>{timeLeft}с</span>
      </div>
      <div style={{ height:4, background:"rgba(255,255,255,0.1)", borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:3, transition:"width 1s linear, background 0.3s" }} />
      </div>
    </div>
  );
}

export function SayAloud({ phrase, T, color }) {
  const [done, setDone] = React.useState(null);
  const gold = GOLD;
  return (
    <div style={{ background:"rgba(200,169,110,0.1)", border:"1.5px solid rgba(200,169,110,0.4)", borderRadius:14, padding:"13px 14px", marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
        <span style={{ fontSize:16 }}>🗣</span>
        <span style={{ color:gold, fontSize:11, letterSpacing:1.5, fontFamily:"monospace", fontWeight:"bold" }}>А ТЕПЕРЬ — ВСЛУХ</span>
      </div>
      <div style={{ color:T.para.color, fontSize:14, lineHeight:1.6, fontStyle:"italic", marginBottom:done===null?12:10 }}>«{phrase}»</div>
      {done===null ? (
        <>
          <div style={{ color:T.modSub.color, fontSize:12.5, marginBottom:10, lineHeight:1.5 }}>Проговори фразу вслух — как живому гостю. Получилось?</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setDone("ok")} style={{ flex:1, padding:"9px", borderRadius:12, border:"none", background:gold, color:"#2A1F0E", fontSize:12.5, fontWeight:"bold", cursor:"pointer" }}>Получилось</button>
            <button onClick={()=>setDone("again")} style={{ flex:1, padding:"9px", borderRadius:12, border:`1.5px solid ${gold}`, background:"transparent", color:gold, fontSize:12.5, fontWeight:"bold", cursor:"pointer" }}>Ещё разок</button>
          </div>
        </>
      ) : (
        <div style={{ color:done==="ok"?GREEN:gold, fontSize:12.5, fontWeight:"bold", lineHeight:1.5 }}>
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
        position:"relative", display:"flex", gap:4, padding:4, borderRadius:14,
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
              ? "inset 0 0 0 1px rgba(139,106,48,0.5), inset 0 0 18px rgba(255,255,255,0.45), inset 0 1.5px 0 rgba(255,255,255,0.9), 0 3px 10px rgba(70,50,15,0.15)"
              : "inset 0 0 0 1px rgba(214,178,102,0.40), inset 0 0 18px rgba(255,230,170,0.10), inset 0 1.5px 0 rgba(255,255,255,0.18), 0 3px 10px rgba(0,0,0,0.25)",
          }}>
            {/* хроматическая (радужная) кромка */}
            <div style={{
              position:"absolute", inset:0, borderRadius:999, padding:1.2, opacity: a11y ? 0.4 : 0.28,
              background:"conic-gradient(from 210deg, rgba(214,178,102,0.6), rgba(255,230,170,0.35), rgba(214,178,102,0.6), rgba(255,230,170,0.35), rgba(214,178,102,0.6))",
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
              fontFamily:"Georgia, serif", fontSize:12.5, fontWeight:"bold",
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
