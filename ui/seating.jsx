// ui/seating.jsx — v85 (Доп. 398): рассадка для хостес.
//
// SeatingScreen — «Смена» → «Рассадка»: схема зала и состояние столов на сегодня, общее для всей смены (обновляется само
// раз в 15 секунд): свободен, бронь (время, на кого, сколько), гости (сколько, официант, сколько сидят), уборка.
// «Посадить компанию» подсвечивает подходящие свободные столы. Нажатие на стол — карточка стола, в ней сразу выбрано
// обычное следующее действие (свободный — посадить, с гостями — на уборку, после уборки — свободен). Под схемой — у кого
// из официантов какие столы и кто в графике без столов. Руководителю — «Схема зала»: столы на сетке (номер, места, форма),
// и «Очистить доску». Сервер — этап 35; без него экран говорит, что этапа нет.
// v86 (Доп. 399): статус «Счёт» (этап 36) — гости попросили счёт, стол скоро освободится: на схеме — терракотой,
// в подборе компании — «Скоро освободится».
// v88 (Доп. 401): залы (вкладки над схемой: «Основной», «Веранда»…), стены, бар и вход на схеме (этап 37); в редакторе
// стол можно перетащить пальцем.
import React from "react";
import { LineArt } from "./line-art";   // v87: рисунок золотой линией
import { createPortal } from "react-dom";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { briefRoster } from "../lib/briefing";
import { GRID_W, MAX_TABLES, STATUS, SHAPES, PARTY, NEXT, isBusy, soonFree, boardMap, stateOf, summary, suggest, minutesSince, sinceLabel, tableSub, defaultCnt, reservations,
  onShiftToday, waiterList, initials, shortName, waiterLoad, addTable, moveTable, updateTable, removeTable, planProblem, gridRows, emptyPlan,
  MAX_ZONES, MAX_ITEMS, ITEM_KINDS, zonesOf, zone1, zoneOfX, zoneTables, zoneItems, fits, withZones, addZone, renameZone, removeZone, addWall, addBar, addDoor, removeItem, planV1 } from "../lib/seating";

const POLL_MS = 15000;
const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const C = (a11y) => ({
  gold: a11y ? "#7A5D2A" : "#D2A85A",
  text: a11y ? "#2A1F0E" : "#EFE4C8",
  sub: a11y ? "#6B5B40" : "#A99A7C",
  line: a11y ? "rgba(139,106,48,0.28)" : "rgba(214,178,102,0.22)",
  red: a11y ? "#A0412F" : "#E08A7A",
  field: a11y ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.25)",
  // состояния стола: свободен — контур, бронь — синеватый, гости — тёплое золото, уборка — серый пунктир
  st: {
    free: { bg: "transparent", bd: a11y ? "rgba(139,106,48,0.55)" : "rgba(214,178,102,0.55)", fg: a11y ? "#2A1F0E" : "#EFE4C8", dash: false },
    res: { bg: a11y ? "rgba(60,110,160,0.16)" : "rgba(126,180,220,0.18)", bd: a11y ? "#3C6E9F" : "#8FBCE0", fg: a11y ? "#1E4E70" : "#CFE6F5", dash: false },
    seat: { bg: a11y ? "rgba(139,106,48,0.30)" : "rgba(210,168,90,0.42)", bd: a11y ? "#8B6A30" : "#E4C88C", fg: a11y ? "#2A1F0E" : "#FFF4DC", dash: false },
    // v86: «Счёт» — терракота: стол скоро освободится
    bill: { bg: a11y ? "rgba(160,65,47,0.18)" : "rgba(224,138,122,0.32)", bd: a11y ? "#A0412F" : "#EBA595", fg: a11y ? "#5A1E12" : "#FFE9E2", dash: false },
    clean: { bg: a11y ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)", bd: a11y ? "rgba(90,70,40,0.45)" : "rgba(200,190,170,0.45)", fg: a11y ? "#6B5B40" : "#A99A7C", dash: true },
  },
  frost: {
    background: a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.09)",
    border: a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)",
    boxShadow: a11y ? "inset 0 0 26px rgba(255,255,255,0.55), 0 6px 18px rgba(120,85,25,0.14)" : "inset 0 0 26px rgba(255,248,230,0.07), 0 8px 24px rgba(0,0,0,0.45)",
    borderRadius: 18,
  },
});
const portal = (el) => (typeof document !== "undefined" && document.body && document.body.nodeType === 1 ? createPortal(el, document.body) : el);
const chip = (c, on, a11y) => ({ padding: "7px 12px", borderRadius: 999, border: `1px solid ${on ? c.gold : c.line}`, background: on ? (a11y ? "rgba(139,106,48,0.18)" : "rgba(200,169,110,0.22)") : "transparent",
  color: on ? c.text : c.sub, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer" });
const btn = (c, main) => ({ padding: "12px 14px", borderRadius: 16, fontFamily: "Georgia, serif", fontSize: 15, cursor: "pointer",
  ...(main ? { border: 0, background: c.gold, color: "#1A1008", fontWeight: "bold" } : { border: `1px solid ${c.gold}`, background: "transparent", color: c.text }) });

// ── Сетка столов ────────────────────────────────────────────────────────────────
function useWidth() {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(360);
  React.useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const upd = () => setW(Math.max(240, Math.min(560, el.clientWidth || 360)));
    upd();
    let ro = null;
    try { ro = new ResizeObserver(upd); ro.observe(el); } catch (e) { window.addEventListener("resize", upd); }
    return () => { if (ro) ro.disconnect(); else window.removeEventListener("resize", upd); };
  }, []);
  return [ref, w];
}

// стены, бар, вход — цвета в тон схемы
const ITEM_C = (a11y) => ({
  wall: a11y ? "#5A4628" : "rgba(226,214,186,0.85)",
  bar: { bg: a11y ? "rgba(139,106,48,0.16)" : "rgba(210,168,90,0.14)", bd: a11y ? "#8B6A30" : "rgba(214,178,102,0.62)", fg: a11y ? "#5A4628" : "#E9D7A8" },
  door: { bd: a11y ? "#8B6A30" : "rgba(214,178,102,0.7)", fg: a11y ? "#5A4628" : "#E9D7A8" },
});
const DoorIcon = ({ s, color }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M5 21V4h9v17" /><path d="M14 4l5 2v15l-5-2" /><path d="M11 12.5h.01" /><path d="M3 21h18" /></svg>);

export function Floor({ a11y, c = C(a11y), plan, zone, map, now, hi = [], sel, selItem, edit = false, tool = "table", pend = null, onTable, onCell, onNode, onItem, onDrop }) {
  const [ref, w] = useWidth();
  const cell = w / GRID_W;
  const z = zone || zone1(plan);
  const rows = Math.max(3, gridRows(plan, edit ? 3 : 1, z));
  const ts = zoneTables(plan, z);
  const its = zoneItems(plan, z);
  const walls = its.filter((i) => i.kind === "wall"), blocks = its.filter((i) => i.kind !== "wall");
  const ic = ITEM_C(a11y);
  // v88: перетаскивание стола пальцем (редактор, «Столы»): тень показывает, встанет ли стол
  const drag = React.useRef(null), skipClick = React.useRef(false);
  const [ghost, setGhost] = React.useState(null);
  const cellAt = (e) => { const r = ref.current.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / cell), Math.floor((e.clientY - r.top) / cell)]; };
  const canDrag = edit && tool === "table" && !!onDrop;
  const down = (t) => (e) => {
    if (!canDrag || (e.button != null && e.button > 0)) return;
    const [cx] = cellAt(e);
    drag.current = { t, dx: Math.max(0, Math.min(cx - t.x, t.shape === "long" ? 1 : 0)), sx: e.clientX, sy: e.clientY, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_e) { /* */ }
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8) return;
    d.moved = true;
    const [cx, cy] = cellAt(e), x = cx - d.dx, y = cy;
    setGhost((g) => (g && g.x === x && g.y === y ? g : { t: d.t, x, y, ok: fits(plan, d.t, x, y) }));
  };
  const up = (e) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d || !d.moved) return;
    skipClick.current = true; setTimeout(() => { skipClick.current = false; }, 450);
    const [cx, cy] = cellAt(e), x = cx - d.dx, y = cy;
    if (x !== d.t.x || y !== d.t.y) onDrop(d.t, x, y);
  };
  const cancel = () => { drag.current = null; setGhost(null); };
  const cellsOn = edit && (tool === "table" || tool === "bar" || tool === "door");
  return (
    <div ref={ref} data-floor="" data-zone={z} style={{ position: "relative", width: "100%", maxWidth: 560, margin: "0 auto", height: rows * cell,
      backgroundImage: edit ? `radial-gradient(${c.line} 1.2px, transparent 1.3px)` : "none", backgroundSize: cell + "px " + cell + "px", backgroundPosition: (cell / 2) + "px " + (cell / 2) + "px" }}>
      {cellsOn ? Array.from({ length: rows * GRID_W }, (_, i) => {
        const x = i % GRID_W, y = Math.floor(i / GRID_W), p = pend && tool === "bar" && pend.x === x && pend.y === y;
        return <button key={"c" + i} type="button" aria-label={"Клетка " + (x + 1) + ", ряд " + (y + 1)} data-cell={x + ":" + y} onClick={() => onCell && onCell(x, y)}
          style={{ position: "absolute", left: x * cell, top: y * cell, width: cell, height: cell, border: p ? `2px dashed ${c.gold}` : 0, borderRadius: 8, boxSizing: "border-box", background: "transparent", padding: 0, cursor: "pointer" }} />;
      }) : null}
      {blocks.map((i) => {
        const isBar = i.kind === "bar", W = (isBar ? i.w : 1) * cell, H = (isBar ? i.h : 1) * cell, on = selItem === i.id, k = ic[i.kind];
        const act = edit && onItem ? () => { vibrate("light"); onItem(i); } : null;
        return (
          <div key={i.id} data-item={i.id} data-kind={i.kind} {...(act ? { role: "button", tabIndex: 0, "aria-label": ITEM_KINDS[i.kind], onClick: act,
              onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } } } : { "aria-hidden": "true" })}
            style={{ position: "absolute", left: i.x * cell + 3, top: i.y * cell + 3, width: W - 6, height: H - 6, boxSizing: "border-box", borderRadius: Math.max(5, cell * 0.14),
              border: `${on ? 2 : 1.2}px ${isBar ? "solid" : "dashed"} ${on ? c.gold : k.bd}`, background: isBar ? `${k.bg} repeating-linear-gradient(90deg, transparent 0 9px, rgba(255,255,255,0.035) 9px 10px)` : "transparent",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, color: k.fg, fontFamily: "Georgia, serif", fontStyle: "italic",
              fontSize: Math.max(9, cell * 0.22), cursor: act ? "pointer" : "default", pointerEvents: act ? "auto" : "none", overflow: "hidden" }}>
            {isBar ? <span>Бар</span> : <><DoorIcon s={Math.max(12, cell * 0.36)} color={k.fg} />{cell >= 34 ? <span style={{ fontSize: Math.max(8, cell * 0.18) }}>вход</span> : null}</>}
          </div>);
      })}
      {walls.length ? (
        <svg data-walls="" width={w} height={rows * cell} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} aria-hidden="true" focusable="false">
          {walls.map((i) => (
            <g key={i.id} data-item={i.id} data-kind="wall">
              <line x1={i.x * cell} y1={i.y * cell} x2={i.x2 * cell} y2={i.y2 * cell} stroke={selItem === i.id ? c.gold : ic.wall} strokeWidth={Math.max(3, cell * 0.09)} strokeLinecap="round" />
              {edit && tool === "wall" && onItem ? <line x1={i.x * cell} y1={i.y * cell} x2={i.x2 * cell} y2={i.y2 * cell} stroke="transparent" strokeWidth={Math.max(18, cell * 0.42)}
                style={{ pointerEvents: "stroke", cursor: "pointer" }} onClick={() => { vibrate("light"); onItem(i); }} /> : null}
            </g>))}
        </svg>) : null}
      {ts.map((t) => {
        const r = stateOf(map, t.id), s = c.st[r.status] || c.st.free, wide = t.shape === "long" ? 2 : 1;
        const pad = Math.max(2, cell * 0.08), on = hi.includes(t.id), isSel = sel === t.id;
        const sub = tableSub(t, r, now);
        // подпись влезает в стол: длинную — мельче; «уборка» на маленьком столе — значком-веником (пунктир и легенда рядом)
        const w0 = wide * cell - 2 * pad, avail = (t.shape === "rd" ? w0 * 0.88 : w0) - 6;
        const fs0 = Math.max(9, cell * 0.22), need = sub.length * 0.6 * fs0;
        const broom = r.status === "clean" && need > avail;
        const fs = need > avail ? Math.max(7.5, avail / (sub.length * 0.6)) : fs0;
        const dim = edit && tool !== "table";
        return (
          <button key={t.id} type="button" data-table={t.id} data-status={r.status} data-hi={on ? "1" : "0"} tabIndex={dim ? -1 : undefined} className={canDrag ? "sa-drag" : undefined}
            onClick={() => { if (skipClick.current) { skipClick.current = false; return; } if (!dim && onTable) onTable(t); }}
            onPointerDown={canDrag ? down(t) : undefined} onPointerMove={canDrag ? move : undefined} onPointerUp={canDrag ? up : undefined} onPointerCancel={canDrag ? cancel : undefined}
            aria-label={"Стол " + t.n + ", " + t.seats + " " + pl(t.seats, "место", "места", "мест") + ": " + STATUS[r.status].toLowerCase() + (isBusy(r) ? ", гостей " + (r.cnt || 0) : r.status === "res" && r.rtime ? ", на " + r.rtime : "")}
            style={{ position: "absolute", left: t.x * cell + pad, top: t.y * cell + pad, width: wide * cell - 2 * pad, height: cell - 2 * pad, boxSizing: "border-box",
              borderRadius: t.shape === "rd" ? "50%" : Math.max(4, cell * 0.16), border: `${isSel || on ? 2 : 1.2}px ${s.dash ? "dashed" : "solid"} ${isSel ? (a11y ? "#2A1F0E" : "#FFF4DC") : on ? c.gold : s.bd}`,
              background: s.bg, color: s.fg, cursor: dim ? "default" : canDrag ? "grab" : "pointer", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              boxShadow: on ? `0 0 0 3px ${a11y ? "rgba(139,106,48,0.25)" : "rgba(210,168,90,0.35)"}` : "none", fontFamily: "Georgia, serif", lineHeight: 1.05, overflow: "hidden",
              opacity: dim ? 0.45 : ghost && ghost.t.id === t.id ? 0.5 : 1, pointerEvents: dim ? "none" : "auto" }}>
            <span style={{ fontSize: Math.max(11, cell * 0.36), fontWeight: "bold" }}>{t.n}</span>
            {cell < 26 ? null : broom ? (
              <svg data-broom="" width={Math.round(fs0 * 1.5)} height={Math.round(fs0 * 1.5)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginTop: 1, opacity: 0.9 }}>
                <path d="M15 2l-3.5 9" /><path d="M7 11h9l2 10H5z" /><path d="M9.5 15v6M13.5 15v6" /></svg>
            ) : <span style={{ fontSize: fs, opacity: 0.9, whiteSpace: "nowrap" }}>{sub}</span>}
            {r.status === "seat" && r.waiter_name && cell >= 56 ? <span data-table-waiter="" style={{ fontSize: cell * 0.17, opacity: 0.85, whiteSpace: "nowrap" }}>{initials(r.waiter_name)}</span> : null}
          </button>);
      })}
      {ghost ? <div data-drag-ghost={ghost.ok ? "ok" : "no"} aria-hidden="true" style={{ position: "absolute", left: ghost.x * cell + 2, top: ghost.y * cell + 2, width: (ghost.t.shape === "long" ? 2 : 1) * cell - 4, height: cell - 4,
        boxSizing: "border-box", borderRadius: ghost.t.shape === "rd" ? "50%" : Math.max(4, cell * 0.16), border: `2px dashed ${ghost.ok ? c.gold : c.red}`, background: ghost.ok ? "rgba(210,168,90,0.12)" : "rgba(224,138,122,0.12)", pointerEvents: "none" }} /> : null}
      {edit && tool === "wall" && onNode ? Array.from({ length: (GRID_W + 1) * (rows + 1) }, (_, i) => {
        const x = i % (GRID_W + 1), y = Math.floor(i / (GRID_W + 1)), p = pend && pend.x === x && pend.y === y, hit = Math.min(30, cell * 0.7);
        return <button key={"n" + i} type="button" data-node={x + ":" + y} aria-label={"Точка " + (x + 1) + ", " + (y + 1)} aria-pressed={!!p} onClick={() => onNode(x, y)}
          style={{ position: "absolute", left: x * cell - hit / 2, top: y * cell - hit / 2, width: hit, height: hit, border: 0, padding: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ width: p ? 14 : 7, height: p ? 14 : 7, borderRadius: "50%", background: p ? c.gold : c.sub, opacity: p ? 1 : 0.7, boxShadow: p ? `0 0 0 4px ${a11y ? "rgba(139,106,48,0.25)" : "rgba(210,168,90,0.3)"}` : "none" }} />
        </button>;
      }) : null}
    </div>
  );
}

// ── Карточка стола ──────────────────────────────────────────────────────────────
export function TableSheet({ a11y, c = C(a11y), t, zoneName = "", row, staff, shiftMap = {}, load = {}, party = 0, now, onSave, onClose }) {
  const [st, setSt] = React.useState(NEXT[row.status] || "seat");
  const [cnt, setCnt] = React.useState(() => defaultCnt(t, row, party));
  const [name, setName] = React.useState(row.name || "");
  const [rtime, setRtime] = React.useState(row.rtime || "");
  const [waiter, setWaiter] = React.useState(row.waiter_id || "");
  const [all, setAll] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  // официанты: сначала кто сегодня в графике; остальные — по «Ещё» (в большой команде список длинный)
  const list = waiterList(staff, shiftMap);
  const anyOn = list.some((e) => shiftMap[e.id]);
  const first = anyOn ? list.filter((e) => shiftMap[e.id] || e.id === row.waiter_id) : list;   // выбранный раньше — сразу виден
  const rest = anyOn ? list.filter((e) => !first.includes(e)) : [];
  const wChip = (e) => (
    <button key={e.id} type="button" data-waiter={e.id} onClick={() => { vibrate("light"); setWaiter(e.id); }} style={chip(c, waiter === e.id, a11y)}>
      {shortName(e.name + " " + (e.surname || ""))}{load[e.id] ? " · " + load[e.id] : ""}</button>);
  const save = (status) => {
    if (busy) return;
    if (status === "res" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(rtime)) { setErr("Укажи время брони, например 19:30"); return; }
    setBusy(true); setErr("");
    onSave(t, { status, cnt: status === "seat" || status === "bill" || status === "res" ? cnt : 0, name: status === "res" ? name.trim() : "", rtime: status === "res" ? rtime : "",
      waiter: status === "seat" || status === "bill" ? waiter || null : null })
      .then((ok) => { setBusy(false); if (ok !== true) setErr(ok === "need36" ? "Статус «Счёт» появится, когда на сервер добавят этап 36." : "Не сохранилось. Проверь связь."); });
  };
  const min = isBusy(row) ? minutesSince(row.since, now) : 0;
  return portal(
    <div className="sa-layer" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: a11y ? "rgba(70,52,24,0.35)" : "rgba(8,6,3,0.62)", display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: "Georgia, serif" }}>
      <div data-table-sheet={t.id} role="dialog" aria-modal="true" aria-label={"Стол " + t.n} onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box", padding: "16px 18px calc(18px + env(safe-area-inset-bottom, 0px))",
          borderRadius: "22px 22px 0 0", background: a11y ? "#F3EADA" : "#1F170C", borderTop: `1px solid ${c.line}`, boxShadow: "0 -10px 30px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 21, color: c.text }}>Стол {t.n}{zoneName ? <span style={{ fontSize: 14, color: c.sub }}> · {zoneName}</span> : null}</div>
            <div style={{ fontSize: 13, color: c.sub }}>{t.seats} {pl(t.seats, "место", "места", "мест")} · сейчас: {STATUS[row.status].toLowerCase()}{isBusy(row) ? ", " + (row.cnt || 0) + " " + pl(row.cnt || 0, "гость", "гостя", "гостей") + ", " + sinceLabel(min) : ""}{row.status === "res" && row.rtime ? " на " + row.rtime : ""}</div>
          </div>
          <button type="button" data-sa-back="" aria-label="Закрыть" onClick={onClose} style={{ border: 0, background: "none", color: c.sub, fontSize: 26, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div role="radiogroup" aria-label="Что со столом" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 14px" }}>
          {[["seat", "Гости"], ["bill", "Счёт"], ["clean", "Уборка"], ["free", "Свободен"], ["res", "Бронь"]].map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={st === k} data-sheet-status={k} onClick={() => { vibrate("light"); setErr(""); setSt(k); }} style={chip(c, st === k, a11y)}>{l}</button>))}
        </div>
        {st === "seat" || st === "res" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ ...labelStyle(13.5), color: c.gold, flex: 1 }}>{st === "seat" ? "Гостей" : "Гостей в брони"}</span>
            <button type="button" aria-label="Меньше" data-cnt-minus="" onClick={() => setCnt((n) => Math.max(1, n - 1))} style={{ ...chip(c, false, a11y), width: 40, padding: "6px 0", fontSize: 18 }}>−</button>
            <span data-cnt="" style={{ minWidth: 28, textAlign: "center", fontSize: 22, color: c.text }}>{cnt}</span>
            <button type="button" aria-label="Больше" data-cnt-plus="" onClick={() => setCnt((n) => Math.min(40, n + 1))} style={{ ...chip(c, false, a11y), width: 40, padding: "6px 0", fontSize: 18 }}>+</button>
          </div>) : null}
        {st === "res" ? (
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <label style={{ flex: 1 }}><span style={{ ...labelStyle(13), color: c.gold, display: "block", marginBottom: 4 }}>Время</span>
              <input type="time" value={rtime} data-res-time="" onChange={(e) => { setErr(""); setRtime(e.target.value); }} style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 12, border: `1px solid ${c.line}`, background: c.field, color: c.text, fontFamily: "Georgia, serif", fontSize: 15 }} /></label>
            <label style={{ flex: 1.6 }}><span style={{ ...labelStyle(13), color: c.gold, display: "block", marginBottom: 4 }}>На кого</span>
              <input value={name} maxLength={60} data-res-name="" placeholder="Фамилия или имя" onChange={(e) => setName(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 12, border: `1px solid ${c.line}`, background: c.field, color: c.text, fontFamily: "Georgia, serif", fontSize: 15 }} /></label>
          </div>) : null}
        {st === "seat" ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ ...labelStyle(13.5), color: c.gold, marginBottom: 6 }}>Официант</div>
            <div data-waiters-pick="" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" data-waiter="" onClick={() => setWaiter("")} style={chip(c, !waiter, a11y)}>Не назначен</button>
              {first.map(wChip)}
              {rest.length && !all ? <button type="button" data-waiter-more="" onClick={() => { vibrate("light"); setAll(true); }} style={{ ...chip(c, false, a11y), borderStyle: "dashed" }}>Ещё {rest.length}</button> : null}
            </div>
            {rest.length && all ? <>
              <div style={{ fontSize: 12, color: c.sub, margin: "10px 2px 6px" }}>Сегодня не в графике</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{rest.map(wChip)}</div>
            </> : null}
            <div style={{ fontSize: 11.5, color: c.sub, marginTop: 8, lineHeight: 1.45 }}>{anyOn ? "Сначала те, кто сегодня в графике. " : ""}Число после имени: столы с гостями у официанта сейчас. Если у официанта подключён бот, он получит сообщение.</div>
          </div>) : null}
        {err ? <div role="alert" style={{ fontSize: 13, color: c.red, marginBottom: 10 }}>{err}</div> : null}
        <button type="button" data-sheet-save="" onClick={() => save(st)} disabled={busy} style={{ ...btn(c, true), width: "100%", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Сохраняю…" : st === "seat" ? (isBusy(row) ? "Сохранить" : "Посадить") : st === "bill" ? "Попросили счёт" : st === "res" ? (row.status === "res" ? "Сохранить бронь" : "Забронировать") : st === "clean" ? "На уборку" : "Освободить стол"}</button>
      </div>
    </div>
  );
}

// ── Схема зала (руководителю) ───────────────────────────────────────────────────
// v88 (Доп. 401): залы (вкладки, «＋ Зал», название, убрать пустой), инструменты «Столы · Стены · Бар · Вход», стол можно
// перетащить пальцем. Без этапа 37 на сервере — только столы одного зала (как в v85).
const TOOLS = [["table", "Столы"], ["wall", "Стены"], ["bar", "Бар"], ["door", "Вход"]];
const TOOL_HINT = {
  wall: "Нажми на точку, где стена начинается, потом на точку, где она кончается: по прямой, по горизонтали или вертикали.",
  bar: "Нажми на клетку, где бар начинается, потом на клетку, где он кончается.",
  door: "Нажми на клетку, где вход.",
};
function FloorEditor({ c, a11y, plan0, floor2 = false, onSaved, onCancel }) {
  const [plan, setPlan] = React.useState(() => plan0 || emptyPlan());
  const zs = zonesOf(plan);
  const [zone, setZone] = React.useState(() => zs[0].id);
  const z = zs.some((q) => q.id === zone) ? zone : zs[0].id;
  const zObj = zs.find((q) => q.id === z) || zs[0];
  const [zname, setZname] = React.useState(zObj.name);
  React.useEffect(() => { setZname(zObj.name); }, [z]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [tool, setTool] = React.useState("table");
  const [pend, setPend] = React.useState(null);
  const [sel, setSel] = React.useState(null);
  const [selItem, setSelItem] = React.useState(null);
  const [moving, setMoving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const t = (plan.tables || []).find((q) => q.id === sel) || null;
  const it = zoneItems(plan, z).find((q) => q.id === selItem) || null;
  const reset = () => { setSel(null); setSelItem(null); setPend(null); setMoving(false); setErr(""); };
  const pickTool = (k) => { vibrate("light"); reset(); setTool(k); };
  const pickZone = (id) => { vibrate("light"); reset(); setZone(id); };
  // пустая клетка: «Столы» — новый стол (или «Передвинуть» — стол встаёт сюда); «Бар» — два угла; «Вход» — клетка
  const cell = (x, y) => {
    setErr("");
    if (tool === "bar") {
      if (!pend) { vibrate("light"); setPend({ x, y }); return; }
      const p = addBar(plan, z, pend.x, pend.y, x, y);
      setPend(null);
      if (p === plan) setErr("Бар не встаёт: на пути стол или вход."); else { vibrate("light"); setPlan(p); }
      return;
    }
    if (tool === "door") {
      const p = addDoor(plan, z, x, y);
      if (p === plan) setErr("Сюда вход не встаёт."); else { vibrate("light"); setPlan(p); }
      return;
    }
    if (t && moving) { const p = moveTable(plan, t.id, x, y); if (p === plan) setErr("Сюда стол не встаёт"); else { vibrate("light"); setPlan(p); setMoving(false); } return; }
    const p = addTable(plan, x, y, z);
    if (p !== plan) { vibrate("light"); setPlan(p); setSelItem(null); setSel(p.tables[p.tables.length - 1].id); }
    else if ((plan.tables || []).length >= MAX_TABLES) setErr("Столов не больше " + MAX_TABLES);
  };
  const node = (x, y) => {
    setErr("");
    if (!pend) { vibrate("light"); setPend({ x, y }); return; }
    if (pend.x === x && pend.y === y) { setPend(null); return; }
    if (pend.x !== x && pend.y !== y) { setPend({ x, y }); setErr("Стена идёт по прямой: вторую точку выбери в той же строке или в том же столбце."); return; }
    const p = addWall(plan, z, pend.x, pend.y, x, y);
    setPend(null);
    if (p !== plan) { vibrate("light"); setPlan(p); } else if ((plan.items || []).length >= MAX_ITEMS) setErr("Стен, баров и входов не больше " + MAX_ITEMS);
  };
  const drop = (q, x, y) => { const p = moveTable(plan, q.id, x, y); if (p === plan) setErr("Сюда стол не встаёт"); else { vibrate("light"); setErr(""); setPlan(p); setSel(q.id); setSelItem(null); } };
  const seats = (d) => setPlan((p) => updateTable(p, t.id, { seats: t.seats + d }));
  const newZone = () => {
    const r = addZone(plan);
    if (!r) { setErr("Залов не больше " + MAX_ZONES); return; }
    vibrate("light"); reset(); setPlan(r.plan); setZone(r.id); setTool("table");
  };
  const nameZone = (v) => {
    setZname(v); setErr("");
    const p = renameZone(plan, z, v);
    if (p === plan && v.trim() !== zObj.name) setErr(v.trim() ? "Зал с таким названием уже есть" : "У зала нужно название");
    else setPlan(p);
  };
  const dropZone = () => {
    const p = removeZone(plan, z);
    if (p === plan) { setErr("Убрать можно только пустой зал: сначала убери из него столы, стены, бар и вход."); return; }
    vibrate("light"); reset(); setPlan(p); setZone(zonesOf(p)[0].id);
  };
  const save = () => {
    const pr = planProblem(plan);
    if (pr) { setErr(pr); return; }
    const body = floor2 ? withZones(plan) : planV1(plan);
    if (!body) { setErr("Залы, стены, бар и вход сохранятся, когда на сервер добавят этап 37 (supabase-stage37-halls-qday.sql)."); return; }
    setBusy(true); setErr("");
    rpc("floor_save", { p_token: saToken(), p_plan: body }).then((r) => {
      setBusy(false);
      if (r && r.ok) { vibrate("success"); onSaved(body); }
      else if (r && r.error === "duplicate") setErr("Номера столов или названия залов повторяются.");
      else if (r && r.error === "overlap") setErr("Стол стоит на баре или входе.");
      else if (r && r.error === "old_app") setErr("На сервере схема новее: обнови приложение.");
      else if (r && r.error === "forbidden") setErr("Схему меняет руководитель или старший.");
      else if (rpcMissing(r)) setErr("На сервере ещё нет этапа 35 (supabase-stage35-seating.sql).");
      else setErr("Не сохранилось. Проверь связь.");
    }).catch(() => { setBusy(false); setErr("Нет связи. Схема останется здесь, сохранишь позже."); });
  };
  const hint = tool !== "table" ? TOOL_HINT[tool]
    : t && moving ? "Нажми на пустую клетку: туда встанет стол " + t.n + "."
    : t ? "Стол " + t.n + ": номер, места и форма ниже. Стол можно перетащить пальцем."
    : "Нажми на пустую клетку, чтобы поставить стол. Стол можно перетащить пальцем, нажатие его выбирает.";
  const field = { padding: "7px 10px", borderRadius: 10, border: `1px solid ${c.line}`, background: c.field, color: c.text, fontFamily: "Georgia, serif", fontSize: 15 };
  return (
    <div data-floor-editor="">
      {floor2 ? (
        <div data-zone-tabs="" role="tablist" aria-label="Залы" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {zs.map((q) => <button key={q.id} type="button" role="tab" aria-selected={q.id === z} data-zone-tab={q.id} onClick={() => pickZone(q.id)} style={chip(c, q.id === z, a11y)}>{q.name}</button>)}
          {zs.length < MAX_ZONES ? <button type="button" data-zone-add="" onClick={newZone} style={{ ...chip(c, false, a11y), borderStyle: "dashed" }}>＋ Зал</button> : null}
        </div>) : null}
      {floor2 && zs.length > 1 ? (
        <div data-zone-edit={z} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <input value={zname} maxLength={24} data-zone-name="" aria-label="Название зала" onChange={(e) => nameZone(e.target.value)} style={{ ...field, flex: 1, minWidth: 0 }} />
          <button type="button" data-zone-remove="" onClick={dropZone} style={{ border: 0, background: "none", color: c.red, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" }}>Убрать зал</button>
        </div>) : null}
      {floor2 ? (
        <div data-tools="" role="radiogroup" aria-label="Что ставить" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {TOOLS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={tool === k} data-tool={k} onClick={() => pickTool(k)} style={chip(c, tool === k, a11y)}>{l}</button>)}
        </div>
      ) : <div data-need37="" style={{ fontSize: 12.5, color: c.sub, lineHeight: 1.5, marginBottom: 8 }}>Залы, стены, бар и вход появятся, когда на сервер добавят этап 37 (supabase-stage37-halls-qday.sql).</div>}
      <div data-editor-hint="" style={{ fontSize: 13, color: c.sub, lineHeight: 1.5, marginBottom: 10 }}>{hint}</div>
      <div style={{ ...c.frost, padding: 10, marginBottom: 12 }}>
        <Floor c={c} a11y={a11y} plan={plan} zone={z} map={{}} now={Date.now()} sel={sel} selItem={selItem} edit tool={tool} pend={pend}
          onCell={cell} onNode={node} onDrop={drop}
          onItem={(i) => { setErr(""); setSel(null); setMoving(false); setSelItem(selItem === i.id ? null : i.id); }}
          onTable={(q) => { vibrate("light"); setErr(""); setMoving(false); setSelItem(null); setSel(sel === q.id ? null : q.id); }} />
      </div>
      {floor2 && zoneItems(plan, z).length ? (
        <div data-items="" role="group" aria-label="Стены, бар и вход" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {zoneItems(plan, z).map((q, i) => <button key={q.id} type="button" data-item-chip={q.id} aria-pressed={selItem === q.id} onClick={() => { vibrate("light"); setErr(""); setSel(null); setSelItem(selItem === q.id ? null : q.id); }}
            style={{ ...chip(c, selItem === q.id, a11y), fontSize: 12.5, padding: "5px 10px" }}>{ITEM_KINDS[q.kind]}{q.kind === "wall" ? " " + (zoneItems(plan, z).filter((x) => x.kind === "wall").indexOf(q) + 1) : ""}</button>)}
        </div>) : null}
      {it ? (
        <div data-item-edit={it.id} style={{ ...c.frost, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 14, color: c.text }}>{ITEM_KINDS[it.kind]}{it.kind === "bar" ? " · " + it.w + " × " + it.h : it.kind === "wall" ? " · " + (Math.abs(it.x2 - it.x) + Math.abs(it.y2 - it.y)) + " " + pl(Math.abs(it.x2 - it.x) + Math.abs(it.y2 - it.y), "клетка", "клетки", "клеток") : ""}</span>
          <button type="button" data-item-remove="" onClick={() => { vibrate("light"); setPlan((p) => removeItem(p, it.id)); setSelItem(null); }} style={{ border: 0, background: "none", color: c.red, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer" }}>Убрать</button>
        </div>) : null}
      {t && tool === "table" ? (
        <div data-table-edit={t.id} style={{ ...c.frost, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <span style={{ ...labelStyle(13.5), color: c.gold }}>Номер</span>
            <input value={t.n} maxLength={6} data-edit-n="" aria-label="Номер стола" onChange={(e) => { setErr(""); setPlan((p) => updateTable(p, t.id, { n: e.target.value })); }}
              style={{ ...field, width: 80 }} />
            <span style={{ flex: 1 }} />
            <button type="button" data-edit-move="" aria-pressed={moving} onClick={() => { vibrate("light"); setErr(""); setMoving(!moving); }} style={chip(c, moving, a11y)}>Передвинуть</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }} role="group" aria-label="Мест">
            <span style={{ ...labelStyle(13.5), color: c.gold, flex: 1 }}>Мест</span>
            <button type="button" aria-label="Меньше мест" data-seats-minus="" onClick={() => seats(-1)} style={{ ...chip(c, false, a11y), width: 40, padding: "6px 0", fontSize: 18 }}>−</button>
            <span data-seats="" style={{ minWidth: 28, textAlign: "center", fontSize: 20, color: c.text }}>{t.seats}</span>
            <button type="button" aria-label="Больше мест" data-seats-plus="" onClick={() => seats(1)} style={{ ...chip(c, false, a11y), width: 40, padding: "6px 0", fontSize: 18 }}>+</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label="Форма">
            {SHAPES.map(([k, l]) => <button key={k} type="button" data-edit-shape={k} onClick={() => { const p = updateTable(plan, t.id, { shape: k }); if (p === plan && k === "long") setErr("Справа нет места для длинного стола"); else { setErr(""); setPlan(p); } }} style={chip(c, t.shape === k, a11y)}>{l}</button>)}
            <span style={{ flex: 1 }} />
            <button type="button" data-edit-remove="" onClick={() => { vibrate("light"); setPlan((p) => removeTable(p, t.id)); setSel(null); setMoving(false); }} style={{ border: 0, background: "none", color: c.red, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer" }}>Убрать стол</button>
          </div>
        </div>) : null}
      {err ? <div role="alert" style={{ fontSize: 13, color: c.red, margin: "0 2px 10px" }}>{err}</div> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={onCancel} style={{ ...btn(c), flex: 1 }}>Отмена</button>
        <button type="button" data-floor-save="" onClick={save} disabled={busy} style={{ ...btn(c, true), flex: 1.4, opacity: busy ? 0.6 : 1 }}>{busy ? "Сохраняю…" : "Сохранить схему"}</button>
      </div>
    </div>
  );
}

// v88: подбор компании по залам — «Подойдут: стол 5. Ещё в зале «Веранда»: стол В2.»; zoneOf — у схемы с залами
export function suggestLine(hi, tn, zoneOf, z, zName) {
  if (!hi.length) return "Свободных столов на столько гостей нет.";
  if (!zoneOf) return "Подойдут: " + hi.map(tn).join(", ") + ". Они подсвечены.";
  const here = hi.filter((id) => zoneOf(id) === z), other = hi.filter((id) => zoneOf(id) !== z);
  const others = [...new Set(other.map(zoneOf))].map((zid) => "в зале «" + zName(zid) + "»: " + other.filter((id) => zoneOf(id) === zid).map(tn).join(", "));
  return (here.length ? "Подойдут: " + here.map(tn).join(", ") + ". Они подсвечены." : "В этом зале подходящих нет.") + (others.length ? " Ещё " + others.join("; ") + "." : "");
}

// ── Экран ───────────────────────────────────────────────────────────────────────
export function SeatingScreen({ T, a11y, profile, onBack, onMissing }) {
  const c = C(a11y);
  const [st, setSt] = React.useState({ status: "loading" });
  const [sel, setSel] = React.useState(null);
  const [party, setParty] = React.useState(0);
  const [edit, setEdit] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [sched, setSched] = React.useState(null);
  const [sure, setSure] = React.useState(false);
  const [zone, setZone] = React.useState(() => { try { return localStorage.getItem("sa_seat_zone") || ""; } catch (e) { return ""; } });   // v88: зал на доске
  const restaurant = (profile && profile.restaurant) || "";
  const load = React.useCallback(() => rpc("seat_board", { p_token: saToken() }).then((r) => {
    if (rpcMissing(r)) { setSt({ status: "missing" }); if (onMissing) onMissing(); }
    else if (r && r.ok) setSt({ status: "ok", ...r, at: Date.now() });
    else setSt((s) => (s.status === "ok" ? s : { status: r && r.error === "no_restaurant" ? "norest" : "error" }));
  }).catch(() => setSt((s) => (s.status === "ok" ? { ...s, offline: true } : { status: "offline" }))), []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    load();
    const t = setInterval(() => { if (typeof document === "undefined" || !document.hidden) load(); }, POLL_MS);
    const vis = () => { if (!document.hidden) load(); };
    try { document.addEventListener("visibilitychange", vis); } catch (e) {}
    // кто сегодня в графике — первыми в выборе официанта
    const d = new Date(), mkey = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    rpc("schedule_load", { p_token: saToken(), p_restaurant: restaurant, p_month: mkey }).then((r) => setSched(r || null)).catch(() => {});
    return () => { clearInterval(t); try { document.removeEventListener("visibilitychange", vis); } catch (e) {} };
  }, [load, restaurant]);
  const shiftMap = React.useMemo(() => (st.staff ? onShiftToday(st.staff, briefRoster(sched) || []) : {}), [st.staff, sched]);
  const ok = st.status === "ok";
  const plan = ok ? st.plan : null;
  const map = React.useMemo(() => boardMap(ok ? st.tables : []), [st]);   // eslint-disable-line react-hooks/exhaustive-deps
  // «сейчас» — по часам сервера: телефон может спешить
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  const now = ok ? Date.parse(st.now) + (Date.now() - st.at) : Date.now();
  // v88: залы — вкладки над схемой; сводка — по выбранному залу, подбор компании — по всем (другие залы — строкой)
  const zs = zonesOf(plan), multi = zs.length > 1;
  const z = zs.some((q) => q.id === zone) ? zone : zs[0].id;
  const zName = (id) => (zs.find((q) => q.id === id) || zs[0]).name;
  const pickZone = (id) => { vibrate("light"); setZone(id); setSel(null); try { localStorage.setItem("sa_seat_zone", id); } catch (e) {} };
  const sum = summary({ tables: zoneTables(plan, z) }, ok ? st.tables : []);
  const hi = party ? suggest(plan, ok ? st.tables : [], party) : [];
  const soon = party ? soonFree(plan, ok ? st.tables : [], party) : [];
  const tById = (id) => ((plan && plan.tables) || []).find((q) => q.id === id) || {};
  const tn0 = (id) => "стол " + tById(id).n;
  // стол другого зала — с названием зала в скобках
  const tn = (id) => tn0(id) + (multi && zoneOfX(plan, tById(id)) !== z ? " (" + zName(zoneOfX(plan, tById(id))) + ")" : "");
  const zoneFree = (id) => summary({ tables: zoneTables(plan, id) }, ok ? st.tables : []).free;
  const zoneHi = (id) => hi.some((tid) => zoneOfX(plan, tById(tid)) === id);
  const res = reservations(plan, ok ? st.tables : []);
  const team = waiterLoad(plan, ok ? st.tables : [], st.staff || [], shiftMap);
  const selT = plan && sel ? (plan.tables || []).find((q) => q.id === sel) : null;
  const saveTable = (t, f) => rpc("seat_set", { p_token: saToken(), p_tid: t.id, p_status: f.status, p_cnt: f.cnt, p_name: f.name, p_rtime: f.rtime, p_waiter: f.waiter }).then((r) => {
    if (r && r.ok && r.table) {
      vibrate("success");
      setSt((s) => ({ ...s, tables: [...(s.tables || []).filter((x) => x.tid !== t.id), r.table] }));
      setSel(null); setParty(0);
      setMsg(f.status === "seat" ? "Стол " + t.n + ": посадили." : f.status === "bill" ? "Стол " + t.n + ": попросили счёт." : f.status === "res" ? "Стол " + t.n + ": бронь на " + f.rtime + "." : f.status === "clean" ? "Стол " + t.n + ": на уборку." : "Стол " + t.n + " свободен.");
      return true;
    }
    return r && r.error === "bad_request" && f.status === "bill" ? "need36" : false;   // этап 35 без 36 «Счёт» не знает
  }).catch(() => false);
  // «Очистить доску»: второе нажатие в течение 4 секунд, потом кнопка снова обычная
  React.useEffect(() => { if (!sure) return undefined; const t = setTimeout(() => setSure(false), 4000); return () => clearTimeout(t); }, [sure]);
  const clear = () => {
    if (!sure) { vibrate("light"); setSure(true); return; }
    setSure(false);
    rpc("seat_clear", { p_token: saToken() }).then((r) => { if (r && r.ok) { setMsg("Доска очищена."); load(); } }).catch(() => {});
  };
  void tick;
  return (
    <div style={T.screen} className="sa-screen">
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} aria-label="Вернуться" onClick={() => { if (edit) setEdit(false); else onBack(); }}>‹</button>
        <div style={T.lessHeadTitle}>{edit ? "Схема зала" : "Рассадка"}</div>
      </div>
      <div style={{ padding: "4px 16px 110px" }}>
        {st.status === "loading" ? <div style={{ fontSize: 13, color: c.sub, padding: "6px 2px" }}>Загружаю зал…</div> : null}
        {st.status === "missing" ? <div style={{ ...c.frost, padding: "12px 14px", fontSize: 13.5, color: c.text, lineHeight: 1.5 }}>На сервере ещё нет этапа 35 (supabase-stage35-seating.sql). Когда руководитель его добавит, здесь будет схема зала и рассадка.</div> : null}
        {st.status === "norest" ? <div style={{ ...c.frost, padding: "12px 14px", fontSize: 13.5, color: c.text }}>В профиле не указано заведение.</div> : null}
        {st.status === "offline" || st.status === "error" ? <div style={{ ...c.frost, padding: "12px 14px", fontSize: 13.5, color: c.text }}>Зал не загрузился. Проверь связь.
          <button type="button" onClick={() => { setSt({ status: "loading" }); load(); }} style={{ ...btn(c), display: "block", marginTop: 10, padding: "9px 14px" }}>Ещё раз</button></div> : null}
        {ok && edit ? <FloorEditor c={c} a11y={a11y} plan0={plan} floor2={st.floor === 2} onCancel={() => setEdit(false)} onSaved={(p) => { setEdit(false); setSt((s) => ({ ...s, plan: p })); setMsg("Схема сохранена: её видит вся смена."); }} /> : null}
        {ok && !edit ? <>
          {msg ? <div role="status" style={{ fontSize: 13.5, color: c.text, margin: "2px 2px 10px" }}>{msg}</div> : null}
          {st.offline ? <div style={{ fontSize: 12.5, color: c.red, margin: "0 2px 8px" }}>Нет связи: показано последнее, что пришло.</div> : null}
          {!plan || !(plan.tables || []).length ? (
            <div style={{ ...c.frost, padding: "14px 16px", lineHeight: 1.5 }} data-floor-empty="">
              <LineArt kind="table" color={c.gold} size={140} style={{ margin: "4px auto 12px" }} />
              <div style={{ fontSize: 14.5, color: c.text }}>{st.lead ? "Схемы зала ещё нет. Нарисуй её: где какие столы и сколько за ними мест. Её увидит вся смена." : "Руководитель ещё не нарисовал схему зала."}</div>
              {st.lead ? <button type="button" data-floor-edit="" onClick={() => { vibrate("light"); setMsg(""); setEdit(true); }} style={{ ...btn(c, true), width: "100%", marginTop: 12 }}>Нарисовать схему</button> : null}
            </div>
          ) : <>
            {multi ? (
              <div data-board-zones="" role="tablist" aria-label="Залы" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "2px 0 10px" }}>
                {zs.map((q) => <button key={q.id} type="button" role="tab" aria-selected={q.id === z} data-board-zone={q.id} onClick={() => pickZone(q.id)} style={{ ...chip(c, q.id === z, a11y), display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {q.name}<span aria-label={"свободно " + zoneFree(q.id)} style={{ fontSize: 12, color: q.id === z ? c.gold : c.sub }}>{zoneFree(q.id)}</span>
                  {zoneHi(q.id) && q.id !== z ? <span data-zone-hi="" aria-label="есть подходящий стол" style={{ width: 7, height: 7, borderRadius: 4, background: c.gold }} /> : null}</button>)}
              </div>) : null}
            <div data-seat-summary="" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "2px 0 10px", fontSize: 13, color: c.sub }}>
              <span>Свободно <b style={{ color: c.text }}>{sum.free}</b> из {sum.total}</span><span>·</span>
              <span>Занято <b style={{ color: c.text }}>{(sum.seat || 0) + (sum.bill || 0)}</b></span><span>·</span>
              <span>Гостей <b style={{ color: c.text }}>{sum.guests}</b></span>
              {sum.bill ? <><span>·</span><span>Счёт <b style={{ color: c.text }}>{sum.bill}</b></span></> : null}
              {sum.res ? <><span>·</span><span>Брони <b style={{ color: c.text }}>{sum.res}</b></span></> : null}
              {sum.clean ? <><span>·</span><span>Уборка <b style={{ color: c.text }}>{sum.clean}</b></span></> : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }} role="group" aria-label="Посадить компанию">
              <span style={{ ...labelStyle(13), color: c.gold }}>Посадить:</span>
              {PARTY.map(([n, l]) => <button key={n} type="button" data-party={n} onClick={() => { vibrate("light"); setParty(party === n ? 0 : n); }} style={chip(c, party === n, a11y)}>{l}</button>)}
            </div>
            {party ? <div data-suggest="" style={{ fontSize: 13, color: hi.length || soon.length ? c.text : c.red, margin: "0 2px 10px", lineHeight: 1.45 }}>
              {suggestLine(hi, tn0, multi ? (id) => zoneOfX(plan, tById(id)) : null, z, zName)}
              {soon.length ? <span data-soon=""> Скоро освободится: {soon.map(tn).join(", ")} (попросили счёт).</span> : null}</div> : null}
            <div style={{ ...c.frost, padding: 10 }}>
              <Floor c={c} a11y={a11y} plan={plan} zone={z} map={map} now={now} hi={hi} sel={sel} onTable={(t) => { vibrate("light"); setMsg(""); setSel(t.id); }} />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "10px 2px 0", fontSize: 12, color: c.sub }}>
              {["free", "res", "seat", "bill", "clean"].map((k) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: c.st[k].bg, border: `1.2px ${c.st[k].dash ? "dashed" : "solid"} ${c.st[k].bd}` }} />{STATUS[k].toLowerCase()}</span>)}
            </div>
            {team.busy.length || team.idle.length ? <div data-waiters="" style={{ marginTop: 16 }}>
              <div style={{ ...labelStyle(15), color: c.gold, margin: "0 2px 6px" }}>Официанты</div>
              <div style={{ ...c.frost, padding: "10px 14px", fontSize: 13.5, color: c.sub, lineHeight: 1.6 }}>
                {team.busy.map((x) => <div key={x.id}><span style={{ color: c.text }}>{x.name}</span>: {x.tables.length === 1 ? "стол " : "столы "}{x.tables.join(", ")} · {x.guests} {pl(x.guests, "гость", "гостя", "гостей")}</div>)}
                {team.idle.length ? <div>В графике, без столов: <span style={{ color: c.text }}>{team.idle.join(", ")}</span></div> : null}
              </div>
            </div> : null}
            {res.length ? <div data-res-list="" style={{ marginTop: 16 }}>
              <div style={{ ...labelStyle(15), color: c.gold, margin: "0 2px 8px" }}>Брони сегодня</div>
              {res.map((x) => <div key={x.tid} role="button" tabIndex={0} onClick={() => setSel(x.tid)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(x.tid); } }} style={{ ...c.frost, padding: "10px 14px", marginBottom: 8, display: "flex", gap: 10, cursor: "pointer" }}>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 16, color: c.text, minWidth: 52 }}>{x.rtime}</span>
                <span style={{ flex: 1, fontSize: 14, color: c.text }}>{x.name || "Без имени"} · {x.cnt} {pl(x.cnt, "гость", "гостя", "гостей")}</span>
                <span style={{ fontSize: 13, color: c.sub }}>стол {x.n}{multi ? " · " + zName(zoneOfX(plan, tById(x.tid))) : ""}</span>
              </div>)}
            </div> : null}
            {st.lead ? <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
              <button type="button" data-floor-edit="" onClick={() => { vibrate("light"); setMsg(""); setEdit(true); }} style={{ border: 0, background: "none", color: c.gold, fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer", padding: "4px 2px" }}>Схема зала ›</button>
              <button type="button" data-seat-clear="" onClick={clear} style={{ border: 0, background: "none", color: sure ? c.red : c.sub, fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer", padding: "4px 2px" }}>{sure ? "Все столы станут свободными. Нажми ещё раз" : "Очистить доску"}</button>
            </div> : null}
            <LineArt kind="table" color={c.gold} size={130} style={{ margin: "30px auto 0", opacity: 0.35 }} />
          </>}
        </> : null}
      </div>
      {selT ? <TableSheet key={selT.id} c={c} a11y={a11y} t={selT} zoneName={multi ? zName(zoneOfX(plan, selT)) : ""} row={stateOf(map, selT.id)} staff={st.staff || []} shiftMap={shiftMap} load={team.count} party={party}
        now={now} onSave={saveTable} onClose={() => setSel(null)} /> : null}
    </div>
  );
}
