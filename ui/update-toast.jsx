// ui/update-toast.jsx — v59 (Доп. 372): «Готова новая версия · Обновить».
// Раньше свежая сборка перезагружала страницу сама — и могла сделать это посреди теста (новый сервис-воркер
// или возврат из другого приложения). Теперь main.jsx только сообщает (событие sa-update-ready), а этот тост
// предлагает обновиться; перезагрузка — по кнопке. «Позже» прячет тост до следующего сигнала.
import React from "react";
import { vibrate } from "../lib/utils";

export function UpdateToast({ a11y = false }) {
  const [on, setOn] = React.useState(() => { try { return !!window.__saUpdateReady; } catch (e) { return false; } });
  React.useEffect(() => {
    const h = () => setOn(true);
    window.addEventListener("sa-update-ready", h);
    return () => window.removeEventListener("sa-update-ready", h);
  }, []);
  if (!on) return null;
  const gold = a11y ? "#7A5D2A" : "#C8A96E";
  const reload = () => { vibrate("light"); try { window.location.reload(); } catch (e) {} };
  const later = () => { vibrate("light"); setOn(false); try { window.__saUpdateReady = false; } catch (e) {} };
  return (
    <div role="status" data-update-toast="" data-lens-card="" data-lens-float="" className="sa-fadein" style={{ position: "fixed", left: 14, right: 14, zIndex: 360,
      bottom: "calc(max(env(safe-area-inset-bottom, 0px), 8px) + 84px)", display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px 10px 14px", borderRadius: 16,
      background: a11y ? "rgba(255,252,244,0.92)" : "rgba(30,24,14,0.94)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      border: `1px solid ${a11y ? "rgba(139,106,48,0.35)" : "rgba(214,178,102,0.35)"}`,
      boxShadow: a11y ? "0 6px 20px rgba(120,90,30,0.14)" : "0 8px 26px rgba(0,0,0,0.5)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", color: a11y ? "#2A1F0E" : "#F0E8D8" }}>Готова новая версия</div>
        <div style={{ fontSize: 12, color: a11y ? "#6B5B40" : "#A29679", marginTop: 1 }}>Обновление займёт пару секунд, прогресс не потеряется</div>
      </div>
      <button type="button" data-update-later="" onClick={later} style={{ background: "none", border: "none", color: a11y ? "#6B5B40" : "#A29679", fontSize: 12.5, fontFamily: "Georgia, serif", padding: "8px 6px", cursor: "pointer" }}>Позже</button>
      <button type="button" data-update-now="" data-lens-btn="main" onClick={reload} style={{ border: "none", borderRadius: 999, padding: "9px 14px", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 13.5, fontWeight: "bold",
        color: "#1A1008", background: `linear-gradient(180deg,#E4C88C,${gold})` }}>Обновить</button>
    </div>
  );
}
