// ui/stop-badge.jsx — v159 (Доп. 484): число «в стопе» на значке «Меню» на главной (lib/menu-stops.js).
// Рубиновый жетон с цифрой в правом верхнем углу кружка: рубин на главной уже значит «внимание» (SOS), золотая
// точка на том же месте — «новинки» и «режим дня». Стоп важнее точки: при нём точки нет.
import React from "react";
import { stopCount, stopBadge, refreshStops, STOPS_BOOT_MS, STOPS_MOUNT_MS } from "../lib/menu-stops";
import { menuSubscribe } from "../lib/menu-fresh";

const BOOT_AT = Date.now();

/**
 * Сколько блюд в стопе у заведения. Сразу — по копии меню на телефоне; пока экран на виду, копия сверяется с
 * сервером (не чаще раза в пять минут и сразу после карточки стоп-листа в чате). on = false — не считаем и не
 * спрашиваем (новичку значок «Меню» ещё не показан).
 */
export function useStopCount(restaurant, on = true) {
  const [n, setN] = React.useState(() => (on && restaurant ? stopCount(restaurant) : 0));
  React.useEffect(() => {
    if (!on || !restaurant) { setN(0); return undefined; }
    let alive = true;
    const read = () => { if (alive) setN(stopCount(restaurant)); };
    const seen = () => typeof document === "undefined" || !document.hidden;
    const ask = (force) => { if (alive && seen()) refreshStops(restaurant, { force: !!force }); };
    read();
    const off = menuSubscribe((r, why) => { if (r && r !== restaurant) return; if (why === "dirty") ask(true); else read(); });
    const first = setTimeout(() => ask(false), Math.max(STOPS_MOUNT_MS, STOPS_BOOT_MS - (Date.now() - BOOT_AT)));
    const tick = setInterval(() => ask(false), 60e3);
    const vis = () => ask(false);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", vis);
    return () => { alive = false; off(); clearTimeout(first); clearInterval(tick); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", vis); };
  }, [restaurant, on]);
  return n;
}

/** Жетон с числом; edge — цвет фона под кружком (тонкий кант отделяет жетон от кружка). Стоит в position: relative. */
export function StopBadge({ n, a11y = false, edge }) {
  const t = stopBadge(n);
  if (!t) return null;
  return (
    <span data-stop-badge={t} aria-hidden="true" style={{ position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, padding: "0 3.5px", boxSizing: "border-box",
      borderRadius: 8, display: "grid", placeItems: "center", fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", fontSize: 10.5, fontWeight: 700, lineHeight: 1,
      fontVariantNumeric: "tabular-nums", color: "#FFF6EE", background: a11y ? "linear-gradient(180deg, #B4432F, #8E2C1C)" : "linear-gradient(180deg, #C8553C, #9A3322)",
      border: `1.5px solid ${edge || (a11y ? "#F7F0E0" : "#1A1409")}`, boxShadow: a11y ? "0 1px 3px rgba(120,40,20,0.3)" : "0 1px 4px rgba(0,0,0,0.5)", pointerEvents: "none" }}>{t}</span>
  );
}
