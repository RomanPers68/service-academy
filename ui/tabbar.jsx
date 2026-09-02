import React, { useRef, useState, useEffect } from "react";
import { NAV_ICONS } from "./icons";
import { GOLD } from "./tokens";
import { vibrate } from "../lib/utils";

// Дополнение 136: нижняя навигация вынесена из App.jsx (чистый перенос, логика не менялась).
// ── НИЖНЯЯ НАВИГАЦИЯ: «ЖИДКОЕ СТЕКЛО» ───────────────────────────────
// Плавающий пилл + прозрачная стеклянная «линза» в размер бара.
// Линзу можно тянуть пальцем — она следует за пальцем и с пружиной
// прилипает к ближайшей вкладке. При нажатии вкладка под линзой плавно
// увеличивается (без слоя-копии — ничего не двоится).
export function LiquidTabBar({ tabs, activeId, onTab, a11y }) {
  const n = tabs.length;
  const activeIdx = tabs.findIndex(t => t.id === activeId);
  const lastIdxRef = useRef(activeIdx >= 0 ? activeIdx : 0);
  if (activeIdx >= 0) lastIdxRef.current = activeIdx;
  const restIdx = activeIdx >= 0 ? activeIdx : lastIdxRef.current;

  const barRef = useRef(null);
  const [barW, setBarW] = useState(0);
  useEffect(() => {
    const m = () => { if (barRef.current) setBarW(barRef.current.clientWidth); };
    m();
    window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, []);

  const [dragX, setDragX] = useState(null); // x центра линзы, пока её тянут пальцем
  const [pressed, setPressed] = useState(false); // палец на баре
  const drag = useRef(null);

  const BAR_H = 58;
  const cellW = barW > 0 ? barW / n : 0;
  const lensW = cellW ? Math.max(44, cellW - 6) : 0; // компактнее ячейки
  const rawC = dragX !== null ? dragX : (restIdx + 0.5) * cellW;
  const cx = cellW ? Math.max(lensW / 2 + 4, Math.min(barW - lensW / 2 - 4, rawC)) : 0;
  const litIdx = dragX !== null
    ? Math.max(0, Math.min(n - 1, Math.floor(dragX / cellW)))
    : activeIdx; // -1 — ничего не подсвечено (экран вне вкладок)
  const lensVisible = cellW > 0 && (dragX !== null || activeIdx >= 0);

  const accent = a11y ? "#6B4E1A" : GOLD;
  const dim = a11y ? "#5C3D10" : "#9A8060";
  const spring = "cubic-bezier(0.3,1.3,0.45,1)";

  const evX = (e) => {
    const r = barRef.current ? barRef.current.getBoundingClientRect() : { left: 0 };
    return (e.clientX != null ? e.clientX : 0) - r.left;
  };
  const onDown = (e) => {
    if (!cellW) return;
    setPressed(true);
    drag.current = { x0: evX(e), moved: false, last: null };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const x = evX(e);
    if (!drag.current.moved && Math.abs(x - drag.current.x0) < 6) return;
    drag.current.moved = true;
    setDragX(x);
    const hi = Math.max(0, Math.min(n - 1, Math.floor(x / cellW)));
    if (drag.current.last !== null && drag.current.last !== hi) vibrate("light");
    drag.current.last = hi;
  };
  const onUp = (e) => {
    if (!drag.current) return;
    const x = evX(e);
    drag.current = null;
    setDragX(null);
    setPressed(false);
    const i = Math.max(0, Math.min(n - 1, Math.floor(x / cellW)));
    if (tabs[i]) onTab(tabs[i].id);
  };
  const onCancel = () => { drag.current = null; setDragX(null); setPressed(false); };

  return (
    <div style={{ position:"fixed", left:10, right:10, zIndex:200,
      bottom:"calc(max(env(safe-area-inset-bottom, 0px), 8px) + 8px)" }}>
      {/* Разрешаем горизонтальный жест на баре: обходим глобальные touch-action и JS-блокировку свайпов */}
      <style>{`.sa-lensbar.sa-hscroll, .sa-lensbar.sa-hscroll * { touch-action: none !important; }`}</style>
      {/* Плавающий пилл */}
      <div ref={barRef} className="sa-lensbar sa-hscroll"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
        style={{ position:"relative", height:BAR_H, borderRadius:999, display:"flex", alignItems:"stretch",
          background: a11y ? "rgba(255,252,244,0.22)" : "rgba(255,250,238,0.05)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: a11y ? "1px solid rgba(139,106,48,0.32)" : "1px solid rgba(255,255,255,0.13)",
          boxShadow: a11y
            ? "inset 0 0 22px rgba(255,255,255,0.5), inset 0 1px 0 rgba(255,255,255,0.85), 0 6px 20px rgba(120,90,30,0.14)"
            : "inset 0 0 24px rgba(255,248,230,0.06), inset 0 1px 0 rgba(255,255,255,0.12), 0 10px 30px rgba(0,0,0,0.55)",

          userSelect:"none", WebkitUserSelect:"none" }}>
        {tabs.map((tab, i) => {
          const lit = i === litIdx;
          return (
            <div key={tab.id} role="button" tabIndex={0} aria-label={tab.label}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTab(tab.id); } }}
              style={{ flex:1, minWidth:0, height:"100%", display:"flex", alignItems:"center",
                justifyContent:"center", cursor:"pointer", outline:"none" }}>
              {/* при нажатии вкладка под линзой плавно растёт */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, maxWidth:"100%",
                transform: (pressed && lit) ? "scale(1.16)" : "scale(1)",
                transition:`transform 0.3s ${spring}` }}>
                <div style={{ height:24, display:"flex", alignItems:"center", justifyContent:"center",
                  opacity: lit ? 1 : 0.62, transition:"opacity 0.25s ease" }}>
                  {NAV_ICONS[tab.icon](lit ? accent : dim)}
                </div>
                <div style={{ fontSize:9.5, fontFamily:"Georgia, serif", letterSpacing:0.3, fontWeight:"bold",
                  whiteSpace:"nowrap", overflow:"hidden", maxWidth:"100%", textOverflow:"ellipsis",
                  color: lit ? accent : dim, opacity: lit ? 1 : 0.72,
                  transition:"color 0.25s ease, opacity 0.25s ease" }}>{tab.label}</div>
              </div>
            </div>
          );
        })}
        {/* Прозрачная линза в размер бара — те же стили, что в сегментах */}
        {lensVisible && (
          <div aria-hidden style={{
            position:"absolute", top:5, left: cx - lensW/2, width: lensW, height:BAR_H - 10,
            zIndex:2, pointerEvents:"none",
            transition: dragX !== null ? "none" : `left 0.5s ${spring}`,
          }}>
            <div style={{
              position:"relative", width:"100%", height:"100%", borderRadius:999, overflow:"hidden",
              transform: pressed ? "scale(1.04)" : "scale(1)",
              transition:"transform 0.25s ease",
              background: a11y
                ? "linear-gradient(180deg, rgba(139,106,48,0.15), rgba(139,106,48,0.07))"
                : "linear-gradient(180deg, rgba(200,169,110,0.14), rgba(200,169,110,0.08))",
              // Капелька в стиле кнопки AI: золотое кольцо + изморозь + блик
              boxShadow: a11y
                ? "inset 0 0 0 1px rgba(139,106,48,0.5), inset 0 0 18px rgba(255,255,255,0.45), inset 0 1.5px 0 rgba(255,255,255,0.9), 0 3px 10px rgba(70,50,15,0.15)"
                : "inset 0 0 0 1px rgba(214,178,102,0.40), inset 0 0 18px rgba(255,230,170,0.10), inset 0 1.5px 0 rgba(255,255,255,0.18), 0 3px 10px rgba(0,0,0,0.25)",
            }}>
              {/* хроматическая (радужная) кромка */}
              <div style={{
                position:"absolute", inset:0, borderRadius:999, padding:1.5, opacity: a11y ? 0.4 : 0.3,
                background:"conic-gradient(from 210deg, rgba(214,178,102,0.6), rgba(255,230,170,0.35), rgba(214,178,102,0.6), rgba(255,230,170,0.35), rgba(214,178,102,0.6))",
                WebkitMask:"linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite:"xor", maskComposite:"exclude",
                filter:"blur(0.6px)",
              }} />
              {/* тонкая световая кромка сверху */}
              <div style={{ position:"absolute", top:1, left:"12%", right:"12%", height:1.5, borderRadius:999,
                background:`linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,${a11y ? 0.4 : 0.18}), rgba(255,255,255,0))` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
