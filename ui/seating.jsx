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
// v179 (Доп. 504): стол нарисован сверху — столешница и стулья, у стола с гостями закрашено столько стульев, сколько
// гостей (ui/table-art.jsx). Редактор: вид стола (на 2–8 мест, квадрат, круг, длинный) и нажатия по клеткам, «Ещё такой»,
// «Шаг назад», «Пронумеровать по порядку», переспрос при выходе без сохранения; фото плана под сеткой и «Расставить
// столы по фото» — ИИ, функция floor-scan (ui/floor-tools.jsx, lib/floor-scan.js, lib/floor-photo.js).
// v180 (Доп. 505): длинный стол и вертикально (этап 54, seat_board отдаёт tall: true): в выборе вида, «Повернуть» у
// длинного стола, ИИ ставит вертикальные столы с плана вертикально.
// v181 (Доп. 506): между соседними столами проход (рисунок стола чуть меньше клетки); по фото — второй проход: стулья
// у каждого стола крупно.
import React from "react";
import { LineArt } from "./line-art";   // v87: рисунок золотой линией
import { createPortal } from "react-dom";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { rpc, saToken, rpcMissing, SUPABASE_URL, SUPABASE_KEY } from "../api/supabase";
import { briefRoster } from "../lib/briefing";
import { rememberSeatPlan } from "../lib/tip-avail";   // v149 (Доп. 473)
import { GRID_W, MAX_TABLES, STATUS, SHAPES, PARTY, NEXT, isBusy, soonFree, boardMap, stateOf, summary, suggest, minutesSince, sinceLabel, tableSub, defaultCnt, reservations,
  onShiftToday, waiterList, initials, shortName, waiterLoad, addTable, moveTable, updateTable, removeTable, planProblem, gridRows, emptyPlan,
  MAX_ZONES, MAX_ITEMS, ITEM_KINDS, zonesOf, zone1, zoneOfX, zoneTables, zoneItems, fits, withZones, addZone, renameZone, removeZone, addWall, addBar, addDoor, removeItem, planV1,
  kindOf, copyTable, renumber, canRenumber, spanOf, rotateTable, sidesOf, sideStep, toggleSofa, resetSides, takeNumbers, crossDupes, dropDupes, isCrossDup,
  sitProgress, WAITER_COLORS, waiterColorIndex, waiterTids, SIT_NORM, SIT_WARN,
  mainOf, joinedOf, groupOf, groupLabel, groupSeats, groupFill, isFreeT, freeNear, joinSuggest, mergeRows, seat2Error, guestsWord } from "../lib/seating";
import { tableGeom, filledChairs, okSides } from "../lib/floor-art";   // v179; v183 — стулья по сторонам
import { TableArt, labelBox } from "./table-art";
import { KindPalette, EditorActions, StartCard, PhotoCard, CopyBtn, RenumberBtn, CameraIcon, TurnBtn, ChairSides, TakeNumbers, DropDupes } from "./floor-tools";
import { fitBg, layoutScan, scanFloor, scanErrorText, scanSummary, seatBoxes, seatMasks, scanSeatsFull, mergeSeats, takeHint, takeSummary, dropLabel, dropHint, dropSummary } from "../lib/floor-scan";
import { bgGet, bgPut, bgDrop, loadPlanPhoto, cropRotate, aiImage, tableCrops } from "../lib/floor-photo";
import { PickBanner, JoinChips, SheetMore, WaitList } from "./seat-more";   // v187: объединить, пересадить, лист ожидания

const POLL_MS = 15000;
const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const C = (a11y) => ({
  gold: a11y ? "#7A5D2A" : "#D2A85A",
  text: a11y ? "#2A1F0E" : "#EFE4C8",
  sub: a11y ? "#6B5B40" : "#A99A7C",
  line: a11y ? "rgba(139,106,48,0.28)" : "rgba(214,178,102,0.22)",
  red: a11y ? "#A0412F" : "#E08A7A",
  field: a11y ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.25)",
  // v186: полоска времени за столом — дольше часа и дольше полутора
  warn: a11y ? "#A86A0C" : "#F2B84B",
  late: a11y ? "#B3362A" : "#FF7A66",
  fresh: a11y ? "#2A1F0E" : "#FFF8E8",   // полоска первый час — светлее контура (в светлой теме — темнее)
  casing: a11y ? "rgba(251,247,238,0.95)" : "rgba(22,17,10,0.9)",   // подложка под полоской
  // состояния стола: свободен — контур, бронь — синеватый, гости — тёплое золото, уборка — серый пунктир
  st: {
    free: { bg: "transparent", bd: a11y ? "rgba(139,106,48,0.55)" : "rgba(214,178,102,0.55)", fg: a11y ? "#2A1F0E" : "#EFE4C8", dash: false },
    res: { bg: a11y ? "rgba(60,110,160,0.16)" : "rgba(126,180,220,0.18)", bd: a11y ? "#3C6E9F" : "#8FBCE0", fg: a11y ? "#1E4E70" : "#CFE6F5", dash: false },
    seat: { bg: a11y ? "rgba(139,106,48,0.30)" : "rgba(210,168,90,0.42)", bd: a11y ? "#8B6A30" : "#E4C88C", fg: a11y ? "#2A1F0E" : "#FFF4DC", dash: false },
    // v86: «Счёт» — терракота: стол скоро освободится
    bill: { bg: a11y ? "rgba(160,65,47,0.18)" : "rgba(224,138,122,0.32)", bd: a11y ? "#A0412F" : "#EBA595", fg: a11y ? "#5A1E12" : "#FFE9E2", dash: false },
    clean: { bg: a11y ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)", bd: a11y ? "rgba(90,70,40,0.45)" : "rgba(200,190,170,0.45)", fg: a11y ? "#6B5B40" : "#A99A7C", dash: true },
  },
  // v179: стол сверху — столешница свободного стола (над фото плана — плотнее, чтобы номер читался), стулья, обводка
  // выбранного, подсветка подходящего компании
  top: a11y ? "rgba(255,255,255,0.55)" : "rgba(214,178,102,0.08)",
  topSolid: a11y ? "rgba(255,252,245,0.95)" : "rgba(30,22,11,0.92)",
  chair: a11y ? "rgba(255,255,255,0.6)" : "rgba(214,178,102,0.07)",
  selRing: a11y ? "#2A1F0E" : "#FFF4DC",
  glow: { fill: a11y ? "rgba(139,106,48,0.13)" : "rgba(210,168,90,0.17)", stroke: a11y ? "rgba(139,106,48,0.6)" : "rgba(226,190,120,0.75)" },
  halo: a11y ? "0 0 3px #FFFFFF, 0 0 2px #FFFFFF" : "0 0 3px #000000, 0 0 2px #000000",
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

export function Floor({ a11y, c = C(a11y), plan, zone, map, now, hi = [], sel, selItem, edit = false, tool = "table", pend = null, bg = null, onTable, onCell, onNode, onItem, onDrop, wcolor = null }) {
  const [ref, w] = useWidth();
  const cell = w / GRID_W;
  const z = zone || zone1(plan);
  // v179: фото плана под сеткой (только в редакторе) — сетка не короче фото; после распознавания фото лежит там, где
  // его столы встали на сетку (bg.at — [x, y, ширина] в клетках), иначе во всю ширину
  const fb = edit && bg ? (bg.at ? { x0: bg.at[0], y0: bg.at[1], wc: bg.at[2] } : { ...fitBg(bg.w, bg.h), y0: 0 }) : null;
  const rows = Math.max(3, gridRows(plan, edit ? 3 : 1, z), fb ? Math.min(30, Math.ceil(fb.y0 + (fb.wc * bg.h) / bg.w - 0.05)) : 0);
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
    const [cx, cy] = cellAt(e);
    drag.current = { t, dx: Math.max(0, Math.min(cx - t.x, t.shape === "long" ? 1 : 0)), dy: Math.max(0, Math.min(cy - t.y, t.shape === "tall" ? 1 : 0)), sx: e.clientX, sy: e.clientY, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_e) { /* */ }
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8) return;
    d.moved = true;
    const [cx, cy] = cellAt(e), x = cx - d.dx, y = cy - d.dy;
    setGhost((g) => (g && g.x === x && g.y === y ? g : { t: d.t, x, y, ok: fits(plan, d.t, x, y) }));
  };
  const up = (e) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d || !d.moved) return;
    skipClick.current = true; setTimeout(() => { skipClick.current = false; }, 450);
    const [cx, cy] = cellAt(e), x = cx - d.dx, y = cy - d.dy;
    if (x !== d.t.x || y !== d.t.y) onDrop(d.t, x, y);
  };
  const cancel = () => { drag.current = null; setGhost(null); };
  const cellsOn = edit && (tool === "table" || tool === "bar" || tool === "door");
  // v187: компания за несколькими столами — перемычка от главного к приставленным (под столами; только на доске)
  // перемычка — между столешницами (поверх стульев, которые между ними), как у сдвинутых столов; по диагонали — от угла к углу
  const links = edit ? [] : ts.flatMap((t) => joinedOf(map[t.id]).map((j) => [t, ts.find((q) => q.id === j && mainOf(map[q.id]) === t.id)]).filter((x) => x[1]));
  const topBox = (t) => {
    const [a, b] = spanOf(t), pd = Math.max(1, cell * 0.03), gp = Math.max(1.5, cell * 0.07) * (t.shape === "rd" ? 0.6 : 1);
    const g = tableGeom(t.shape, t.seats, a * cell - 2 * pd - 2 * gp, b * cell - 2 * pd - 2 * gp, t.sides), x0 = t.x * cell + pd + gp, y0 = t.y * cell + pd + gp, q = g.top;
    return q.kind === "circle" ? { x0: x0 + q.cx - q.r, y0: y0 + q.cy - q.r, x1: x0 + q.cx + q.r, y1: y0 + q.cy + q.r } : { x0: x0 + q.x, y0: y0 + q.y, x1: x0 + q.x + q.w, y1: y0 + q.y + q.h };
  };
  const bridge = (a, b) => {
    const A = topBox(a), Q = topBox(b), th = Math.max(4, cell * 0.2);
    const oy = Math.min(A.y1, Q.y1) - Math.max(A.y0, Q.y0), ox = Math.min(A.x1, Q.x1) - Math.max(A.x0, Q.x0);
    if (oy > 2) { const y = (Math.max(A.y0, Q.y0) + Math.min(A.y1, Q.y1)) / 2, [l, r] = A.x1 <= Q.x0 ? [A, Q] : [Q, A]; return { x1: l.x1 - 1, y1: y, x2: r.x0 + 1, y2: y, th: Math.min(th, oy * 0.6) }; }
    if (ox > 2) { const x = (Math.max(A.x0, Q.x0) + Math.min(A.x1, Q.x1)) / 2, [u, d] = A.y1 <= Q.y0 ? [A, Q] : [Q, A]; return { x1: x, y1: u.y1 - 1, x2: x, y2: d.y0 + 1, th: Math.min(th, ox * 0.6) }; }
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), ca = [(A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2], cq = [(Q.x0 + Q.x1) / 2, (Q.y0 + Q.y1) / 2];
    return { x1: cl(cq[0], A.x0, A.x1), y1: cl(cq[1], A.y0, A.y1), x2: cl(ca[0], Q.x0, Q.x1), y2: cl(ca[1], Q.y0, Q.y1), th: th * 0.7 };
  };
  const byN = (id) => { const q = (plan && plan.tables || []).find((x) => x.id === id); return q ? String(q.n) : ""; };
  return (
    <div ref={ref} data-floor="" data-zone={z} style={{ position: "relative", width: "100%", maxWidth: 560, margin: "0 auto", height: rows * cell,
      backgroundImage: edit ? `radial-gradient(${c.line} 1.2px, transparent 1.3px)` : "none", backgroundSize: cell + "px " + cell + "px", backgroundPosition: (cell / 2) + "px " + (cell / 2) + "px" }}>
      {fb ? (
        <div data-floor-bg="" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: rows * cell, overflow: "hidden", pointerEvents: "none", borderRadius: 6 }}>
          <img src={bg.data} alt="" draggable={false} style={{ position: "absolute", left: fb.x0 * cell, top: fb.y0 * cell, width: fb.wc * cell, height: (fb.wc * cell * bg.h) / bg.w, opacity: bg.op, maxWidth: "none",
            filter: a11y ? "none" : "saturate(0.55) brightness(0.92)", userSelect: "none" }} />
        </div>) : null}
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
        const r = stateOf(map, t.id), s = c.st[r.status] || c.st.free, [wide, high] = spanOf(t);
        const pad = Math.max(1, cell * 0.03), on = hi.includes(t.id), isSel = sel === t.id;
        const W = wide * cell - 2 * pad, H = high * cell - 2 * pad;
        // v179: стол сверху — столешница и стулья; номер и подпись — на столешнице. v181: рисунок чуть меньше своих
        // клеток — между соседними столами проход, как на плане (кнопка — по-прежнему вся клетка, попасть легко).
        // У круглого отступ меньше: углы клетки у него и так свободны, а столешнице нужно место под подпись
        const gap = Math.max(1.5, cell * 0.07) * (t.shape === "rd" ? 0.6 : 1), aw = W - 2 * gap, ah = H - 2 * gap;
        // v183: свои стулья по сторонам и диваны (sides), если расставлены вручную
        const g = tableGeom(t.shape, t.seats, aw, ah, t.sides), lb0 = labelBox(g), lb = { ...lb0, x: lb0.x + gap, y: lb0.y + gap };
        // v187: приставленный стол — «к 3»; гости компании садятся по местам: главный, потом приставленные
        const mainN = !edit && mainOf(r) ? byN(mainOf(r)) : "", grouped = !edit && (mainN || joinedOf(r).length);
        const sub = tableSub(t, r, now, mainN);
        // подпись влезает в стол: длинную — мельче; «уборка» на маленьком столе — значком-веником (пунктир и легенда рядом)
        const avail = lb.w - 2, fsN = Math.max(10.5, Math.min(lb.h * 0.5, cell * 0.32));
        const fs0 = Math.max(7.5, Math.min(lb.h * 0.36, cell * 0.21)), need = sub.length * 0.58 * fs0;
        const broom = r.status === "clean" && need > avail;
        const fs = need > avail ? Math.max(6.5, avail / (sub.length * 0.58)) : fs0;
        const dim = edit && tool !== "table";
        const top = r.status === "free" ? (fb ? c.topSolid : c.top) : s.bg;
        // v186: время за столом — полоской по контуру; официант — рамкой своего цвета (только на доске смены)
        const sit = edit || mainN ? null : sitProgress(r, now);
        const mark = !edit && wcolor && isBusy(r) && r.waiter_id ? wcolor(r.waiter_id) : null;
        return (
          <button key={t.id} type="button" data-table={t.id} data-status={r.status} data-hi={on ? "1" : "0"} tabIndex={dim ? -1 : undefined} className={canDrag ? "sa-drag" : undefined}
            onClick={() => { if (skipClick.current) { skipClick.current = false; return; } if (!dim && onTable) onTable(t); }}
            onPointerDown={canDrag ? down(t) : undefined} onPointerMove={canDrag ? move : undefined} onPointerUp={canDrag ? up : undefined} onPointerCancel={canDrag ? cancel : undefined}
            aria-label={"Стол " + t.n + ", " + t.seats + " " + pl(t.seats, "место", "места", "мест") + ": " + (mainN ? "приставлен к столу " + mainN + ", " + STATUS[r.status].toLowerCase()
              : STATUS[r.status].toLowerCase() + (isBusy(r) ? ", гостей " + (r.cnt || 0) : r.status === "res" && r.rtime ? ", на " + r.rtime : "")
              + (sit ? ", сидят " + sinceLabel(sit.min) : "") + (isBusy(r) && r.waiter_name ? ", официант " + shortName(r.waiter_name) : "")
              + (grouped ? ", вместе со " + (joinedOf(r).length === 1 ? "столом " : "столами ") + joinedOf(r).map(byN).join(", ") : ""))}
            style={{ position: "absolute", left: t.x * cell + pad, top: t.y * cell + pad, width: W, height: H, boxSizing: "border-box", border: 0, background: "transparent",
              borderRadius: t.shape === "rd" ? "50%" : Math.max(4, cell * 0.2), color: s.fg, cursor: dim ? "default" : canDrag ? "grab" : "pointer", padding: 0, fontFamily: "Georgia, serif", lineHeight: 1.05,
              opacity: dim ? 0.45 : ghost && ghost.t.id === t.id ? 0.5 : 1, pointerEvents: dim ? "none" : "auto" }}>
            <TableArt g={g} W={aw} H={ah} at={gap} top={top} stroke={s.bd} chair={{ fill: c.chair, stroke: s.bd }} chairOn={s.bd} filled={grouped ? groupFill(plan, map, t.id)[t.id] || 0 : filledChairs(r.status, r.cnt, g.chairs.length)} dash={s.dash}
              ring={isSel ? c.selRing : on ? c.gold : null} glow={on ? c.glow : null}
              progress={sit ? { p: sit.p, level: sit.level, color: sit.level === 2 ? c.late : sit.level === 1 ? c.warn : c.fresh, casing: c.casing } : null} mark={mark} />
            <span style={{ position: "absolute", left: lb.x, top: lb.y, width: lb.w, height: lb.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              overflow: "hidden", pointerEvents: "none", textShadow: fb ? c.halo : "none" }}>
              <span style={{ fontSize: fsN, fontWeight: "bold" }}>{t.n}</span>
              {lb.h < 16 ? null : broom ? (
                <svg data-broom="" width={Math.round(fs0 * 1.5)} height={Math.round(fs0 * 1.5)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginTop: 1, opacity: 0.9 }}>
                  <path d="M15 2l-3.5 9" /><path d="M7 11h9l2 10H5z" /><path d="M9.5 15v6M13.5 15v6" /></svg>
              ) : <span style={{ fontSize: fs, opacity: 0.9, whiteSpace: "nowrap" }}>{sub}</span>}
              {r.status === "seat" && r.waiter_name && cell >= 56 ? <span data-table-waiter="" style={{ fontSize: cell * 0.15, opacity: 0.85, whiteSpace: "nowrap" }}>{initials(r.waiter_name)}</span> : null}
            </span>
          </button>);
      })}
      {links.length ? (
        <svg data-links="" width={w} height={rows * cell} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} aria-hidden="true" focusable="false">
          {links.map(([a, b]) => {
            const k = bridge(a, b), s = c.st[stateOf(map, a.id).status] || c.st.free;
            return <line key={a.id + ":" + b.id} data-link={a.id + ":" + b.id} x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2} stroke={s.bd} strokeWidth={k.th} strokeLinecap="butt" opacity={0.8} />;
          })}
        </svg>) : null}
      {ghost ? <div data-drag-ghost={ghost.ok ? "ok" : "no"} aria-hidden="true" style={{ position: "absolute", left: ghost.x * cell + 2, top: ghost.y * cell + 2, width: spanOf(ghost.t)[0] * cell - 4, height: spanOf(ghost.t)[1] * cell - 4,
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
export function TableSheet({ a11y, c = C(a11y), t, zoneName = "", row, staff, shiftMap = {}, load = {}, party = 0, now, onSave, onClose, wcolor = null,
  seat2 = false, group = [], joinWith = null, fromWait = null, cnt0 = 0, onMove, onJoin, onUnjoin }) {
  const [st, setSt] = React.useState(NEXT[row.status] || "seat");
  // v187: сколько гостей — из листа ожидания или под объединённые столы (не урезаем до мест одного стола)
  const [cnt, setCnt] = React.useState(() => (cnt0 > 0 ? Math.min(40, cnt0) : defaultCnt(t, row, party)));
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
    <button key={e.id} type="button" data-waiter={e.id} onClick={() => { vibrate("light"); setWaiter(e.id); }} data-lens-btn={waiter === e.id ? "tab" : "soft"} data-lens-ink="" style={chip(c, waiter === e.id, a11y)}>
      {wcolor && wcolor(e.id) ? <span data-waiter-dot="" aria-hidden="true" style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, border: `2px solid ${wcolor(e.id)}`, marginRight: 6, verticalAlign: "-1px" }} /> : null}
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
  const seatsW = (ts) => { const n = ts.reduce((a, q) => a + (Number(q.seats) || 0), 0); return n + " " + pl(n, "место", "места", "мест"); };
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
        {group.length || (joinWith && joinWith.length) || fromWait ? (
          <div data-sheet-note="" style={{ fontSize: 13, color: c.gold, margin: "2px 0 4px", lineHeight: 1.45 }}>
            {fromWait ? "Из листа ожидания: " + ((fromWait.name || "").trim() || "без имени") + ", " + guestsWord(Number(fromWait.cnt) || 0) + ". " : ""}
            {joinWith && joinWith.length ? "Посадим за столы " + [t, ...joinWith].map((q) => q.n).join(" и ") + ": всего " + seatsW([t, ...joinWith]) + ". Столы приставим."
              : group.length ? "Вместе " + (group.length === 1 ? "со столом " : "со столами ") + group.map((q) => q.n).join(", ") + ": всего " + seatsW([t, ...group]) + "." : ""}
          </div>) : null}
        <div role="radiogroup" aria-label="Что со столом" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 14px" }}>
          {[["seat", "Гости"], ["bill", "Счёт"], ["clean", "Уборка"], ["free", "Свободен"], ["res", "Бронь"]].map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={st === k} data-sheet-status={k} onClick={() => { vibrate("light"); setErr(""); setSt(k); }} data-lens-btn={st === k ? "tab" : "soft"} data-lens-ink="" style={chip(c, st === k, a11y)}>{l}</button>))}
        </div>
        {st === "seat" || st === "res" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ ...labelStyle(13.5), color: c.gold, flex: 1 }}>{st === "seat" ? "Гостей" : "Гостей в брони"}</span>
            <button type="button" aria-label="Меньше" data-cnt-minus="" onClick={() => setCnt((n) => Math.max(1, n - 1))} data-lens-btn="soft" data-lens-ink="" style={{ ...chip(c, false, a11y), width: 40, padding: "6px 0", fontSize: 18 }}>−</button>
            <span data-cnt="" style={{ minWidth: 28, textAlign: "center", fontSize: 22, color: c.text }}>{cnt}</span>
            <button type="button" aria-label="Больше" data-cnt-plus="" onClick={() => setCnt((n) => Math.min(40, n + 1))} data-lens-btn="soft" data-lens-ink="" style={{ ...chip(c, false, a11y), width: 40, padding: "6px 0", fontSize: 18 }}>+</button>
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
              <button type="button" data-waiter="" onClick={() => setWaiter("")} data-lens-btn={!waiter ? "tab" : "soft"} data-lens-ink="" style={chip(c, !waiter, a11y)}>Не назначен</button>
              {first.map(wChip)}
              {rest.length && !all ? <button type="button" data-waiter-more="" onClick={() => { vibrate("light"); setAll(true); }} data-lens-btn="soft" data-lens-ink="" style={{ ...chip(c, false, a11y), borderStyle: "dashed" }}>Ещё {rest.length}</button> : null}
            </div>
            {rest.length && all ? <>
              <div style={{ fontSize: 12, color: c.sub, margin: "10px 2px 6px" }}>Сегодня не в графике</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{rest.map(wChip)}</div>
            </> : null}
            <div style={{ fontSize: 11.5, color: c.sub, marginTop: 8, lineHeight: 1.45 }}>{anyOn ? "Сначала те, кто сегодня в графике. " : ""}Число после имени: столы с гостями у официанта сейчас. Если у официанта подключён бот, он получит сообщение.</div>
          </div>) : null}
        {err ? <div role="alert" style={{ fontSize: 13, color: c.red, marginBottom: 10 }}>{err}</div> : null}
        <button type="button" data-sheet-save="" onClick={() => save(st)} disabled={busy} data-lens-btn="main" style={{ ...btn(c, true), width: "100%", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Сохраняю…" : st === "seat" ? (isBusy(row) ? "Сохранить" : "Посадить") : st === "bill" ? "Попросили счёт" : st === "res" ? (row.status === "res" ? "Сохранить бронь" : "Забронировать") : st === "clean" ? "На уборку" : "Освободить стол"}</button>
        {seat2 && (isBusy(row) || row.status === "res") && onMove ? <SheetMore c={c} a11y={a11y} row={row} group={group} onMove={onMove} onJoin={onJoin} onUnjoin={onUnjoin} /> : null}
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
function FloorEditor({ c, a11y, plan0, floor2 = false, tall = false, restaurant = "", photo0 = null, guard = null, onSaved, onCancel, sidesOn = false }) {
  const [plan, setPlan] = React.useState(() => plan0 || emptyPlan());
  const planRef = React.useRef(plan);
  planRef.current = plan;
  // v179: «Шаг назад» — прежние состояния схемы (до 50); подряд идущие правки одного поля (номер, места, название зала) —
  // один шаг
  const [hist, setHist] = React.useState([]);
  const lastKey = React.useRef(null);
  const commit = (next, key) => {
    const cur = planRef.current;
    if (!next || next === cur) return false;
    if (!key || key !== lastKey.current) setHist((h) => [...h.slice(-49), cur]);
    lastKey.current = key || null;
    planRef.current = next;
    setPlan(next);
    return true;
  };
  const zs = zonesOf(plan);
  const [zone, setZone] = React.useState(() => zs[0].id);
  const z = zs.some((q) => q.id === zone) ? zone : zs[0].id;
  const zObj = zs.find((q) => q.id === z) || zs[0];
  const [zname, setZname] = React.useState(zObj.name);
  React.useEffect(() => { setZname(zObj.name); }, [z, zObj.name]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [tool, setTool] = React.useState("table");
  const [pend, setPend] = React.useState(null);
  const [sel, setSel] = React.useState(null);
  const [selItem, setSelItem] = React.useState(null);
  const [moving, setMoving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [note, setNote] = React.useState("");
  // v185: номера с фото были заняты — { at: схема сразу после распознавания, z, pairs }; кнопка видна, пока схема та же
  const [take, setTake] = React.useState(null);
  // v179: какой стол ставить — телефон помнит
  const [kind, setKind] = React.useState(() => { try { return kindOf(localStorage.getItem("sa_floor_kind") || "").k; } catch (e) { return kindOf("").k; } });
  const pickKind = (k) => { vibrate("light"); setKind(k); setErr(""); try { localStorage.setItem("sa_floor_kind", k); } catch (e) {} };
  const t = (plan.tables || []).find((q) => q.id === sel) || null;
  const it = zoneItems(plan, z).find((q) => q.id === selItem) || null;
  const reset = () => { setSel(null); setSelItem(null); setPend(null); setMoving(false); setErr(""); };
  const pickTool = (k) => { vibrate("light"); reset(); setTool(k); };
  const pickZone = (id) => { vibrate("light"); reset(); setNote(""); setTake(null); setAsk(false); setZone(id); };
  // пустая клетка: «Столы» — новый стол выбранного вида (или «Передвинуть» — стол встаёт сюда); «Бар» — два угла; «Вход» — клетка
  const cell = (x, y) => {
    setErr("");
    if (tool === "bar") {
      if (!pend) { vibrate("light"); setPend({ x, y }); return; }
      const p = addBar(plan, z, pend.x, pend.y, x, y);
      setPend(null);
      if (p === plan) setErr("Бар не встаёт: на пути стол или вход."); else { vibrate("light"); commit(p); }
      return;
    }
    if (tool === "door") {
      const p = addDoor(plan, z, x, y);
      if (p === plan) setErr("Сюда вход не встаёт."); else { vibrate("light"); commit(p); }
      return;
    }
    if (t && moving) { const p = moveTable(plan, t.id, x, y); if (p === plan) setErr("Сюда стол не встаёт"); else { vibrate("light"); commit(p); setMoving(false); } return; }
    const kd = kindOf(kind, tall), p = addTable(plan, x, y, z, kd);
    if (p !== plan) { vibrate("light"); commit(p); setSelItem(null); setSel(p.tables[p.tables.length - 1].id); }
    else if ((plan.tables || []).length >= MAX_TABLES) setErr("Столов не больше " + MAX_TABLES);
    else if (kd.shape === "long" || kd.shape === "tall") setErr("Длинному столу нужны две свободные клетки рядом.");
  };
  const node = (x, y) => {
    setErr("");
    if (!pend) { vibrate("light"); setPend({ x, y }); return; }
    if (pend.x === x && pend.y === y) { setPend(null); return; }
    if (pend.x !== x && pend.y !== y) { setPend({ x, y }); setErr("Стена идёт по прямой: вторую точку выбери в той же строке или в том же столбце."); return; }
    const p = addWall(plan, z, pend.x, pend.y, x, y);
    setPend(null);
    if (p !== plan) { vibrate("light"); commit(p); } else if ((plan.items || []).length >= MAX_ITEMS) setErr("Стен, баров и входов не больше " + MAX_ITEMS);
  };
  const drop = (q, x, y) => { const p = moveTable(plan, q.id, x, y); if (p === plan) setErr("Сюда стол не встаёт"); else { vibrate("light"); setErr(""); commit(p); setSel(q.id); setSelItem(null); } };
  const seats = (d) => commit(updateTable(planRef.current, t.id, { seats: t.seats + d }), "s:" + t.id);
  // v179: «Ещё такой» — копия рядом, она и выбрана: так быстро получается ряд одинаковых столов
  const copy = () => {
    const r = copyTable(planRef.current, t.id);
    if (!r) { setErr((planRef.current.tables || []).length >= MAX_TABLES ? "Столов не больше " + MAX_TABLES : "Рядом нет места для такого стола."); return; }
    vibrate("light"); setErr(""); commit(r.plan); setSel(r.id); setMoving(false);
  };
  // v180: «Повернуть» длинный стол — горизонтальный ↔ вертикальный
  const turn = () => {
    const p = rotateTable(planRef.current, t.id);
    if (p === planRef.current) { setErr("Повернуть некуда: рядом занято."); return; }
    vibrate("light"); setErr(""); commit(p);
  };
  // «Длинный» у квадратного или круглого стола: горизонтально, а не влезает — вертикально (если сервер знает такие)
  const toLong = () => {
    let p = updateTable(planRef.current, t.id, { shape: "long" });
    if (p === planRef.current && tall) p = updateTable(planRef.current, t.id, { shape: "tall" });
    if (p === planRef.current) { setErr(tall ? "Рядом нет места для длинного стола" : "Справа нет места для длинного стола"); return; }
    setErr(""); commit(p);
  };
  const newZone = () => {
    const r = addZone(plan);
    if (!r) { setErr("Залов не больше " + MAX_ZONES); return; }
    vibrate("light"); reset(); setNote(""); commit(r.plan); setZone(r.id); setTool("table");
  };
  const nameZone = (v) => {
    setZname(v); setErr("");
    const p = renameZone(plan, z, v);
    if (p === plan && v.trim() !== zObj.name) setErr(v.trim() ? "Зал с таким названием уже есть" : "У зала нужно название");
    else commit(p, "zn:" + z);
  };
  const dropZone = () => {
    const p = removeZone(plan, z);
    if (p === plan) { setErr("Убрать можно только пустой зал: сначала убери из него столы, стены, бар и вход."); return; }
    vibrate("light"); reset(); setNote(""); commit(p); setZone(zonesOf(p)[0].id);
  };
  // v179: «Шаг назад»
  const undo = () => {
    if (!hist.length) return;
    vibrate("light");
    const prev = hist[hist.length - 1];
    setHist(hist.slice(0, -1));
    lastKey.current = null;
    planRef.current = prev; setPlan(prev);
    setSel((s) => ((prev.tables || []).some((q) => q.id === s) ? s : null));
    setSelItem((s) => ((prev.items || []).some((q) => q.id === s) ? s : null));
    setMoving(false); setPend(null); setErr(""); setNote("");
  };
  // v179: «Пронумеровать по порядку» — второе нажатие в течение 4 секунд
  const [sureRenum, setSureRenum] = React.useState(false);
  React.useEffect(() => { if (!sureRenum) return undefined; const tm = setTimeout(() => setSureRenum(false), 4000); return () => clearTimeout(tm); }, [sureRenum]);
  const renum = () => {
    if (!sureRenum) { vibrate("light"); setSureRenum(true); return; }
    setSureRenum(false); vibrate("light"); setErr(""); commit(renumber(planRef.current)); setNote("Столы пронумерованы по порядку: по залам, в зале по рядам.");
  };
  // v179: выход без сохранения — переспросить (стрелка «‹» в шапке и «Отмена»)
  const dirty = hist.length > 0;
  const [sureLeave, setSureLeave] = React.useState(false);
  React.useEffect(() => { if (!sureLeave) return undefined; const tm = setTimeout(() => setSureLeave(false), 6000); return () => clearTimeout(tm); }, [sureLeave]);
  const tryLeave = () => { if (!dirty || sureLeave) return true; vibrate("light"); setSureLeave(true); return false; };
  React.useEffect(() => { if (guard) guard.current = tryLeave; });
  React.useEffect(() => () => { if (guard) guard.current = null; }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── v179: фото плана под сеткой и «Расставить столы по фото» ──
  const [bg, setBg] = React.useState(null);   // { z, rec, fresh }
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [scanBusy, setScanBusy] = React.useState(false);
  const [scanStage, setScanStage] = React.useState("");   // v181: "plan" — ищу столы, "seats" — считаю стулья
  const [ask, setAsk] = React.useState(false);
  const [rotating, setRotating] = React.useState(false);
  const fileRef = React.useRef(null), opTimer = React.useRef(null), live = React.useRef(true);
  React.useEffect(() => { live.current = true; return () => { live.current = false; clearTimeout(opTimer.current); }; }, []);
  React.useEffect(() => {
    let on = true;
    bgGet(restaurant, z).then((r) => { if (on && live.current) setBg((cur) => (cur && cur.z === z && cur.fresh ? cur : r ? { z, rec: r } : null)); });
    return () => { on = false; };
  }, [restaurant, z]);
  const rec = bg && bg.z === z ? bg.rec : null;
  const putBg = (zz, r) => { setBg(r ? { z: zz, rec: r, fresh: true } : { z: zz, rec: null, fresh: true }); if (r) bgPut(restaurant, zz, r); else bgDrop(restaurant, zz); };
  const pickPhoto = (file) => {
    if (!file) return;
    const zz = z;
    setPhotoBusy(true); setErr(""); setNote(""); setAsk(false);
    loadPlanPhoto(file).then((r) => {
      if (!live.current) return;
      putBg(zz, r);
      setNote("Фото плана под сеткой. Расставь столы поверх него или нажми «Расставить столы по фото».");
    }).catch(() => { if (live.current) setErr("Не получилось открыть фото. Попробуй другое."); })
      .then(() => { if (live.current) setPhotoBusy(false); });
  };
  const took0 = React.useRef(false);
  React.useEffect(() => { if (photo0 && !took0.current) { took0.current = true; pickPhoto(photo0); } }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const openPicker = () => { vibrate("light"); setErr(""); try { if (fileRef.current) fileRef.current.click(); } catch (e) {} };
  const setOp = (op) => {
    if (!rec) return;
    const zz = z, r = { ...rec, op };
    setBg({ z: zz, rec: r, fresh: true });
    clearTimeout(opTimer.current);
    opTimer.current = setTimeout(() => bgPut(restaurant, zz, r), 500);
  };
  const rotate = () => {
    if (!rec || rotating) return;
    const zz = z;
    vibrate("light"); setRotating(true);
    cropRotate(rec, [0, 0, 100, 100], 90).then((r) => { if (live.current) putBg(zz, r); }).catch(() => {}).then(() => { if (live.current) setRotating(false); });
  };
  const dropBg = () => { vibrate("light"); putBg(z, null); setAsk(false); setNote(""); };
  const runScan = (mode) => {
    setAsk(false);
    if (!mode || !rec || scanBusy) return;
    const zz = z, r0 = rec, opts = { url: SUPABASE_URL, key: SUPABASE_KEY, token: saToken() };
    setScanBusy(true); setScanStage("plan"); setErr(""); setNote(""); setTake(null);
    aiImage(r0).then((ai) => scanFloor(ai.data, opts).then((res) => ({ res, ai })))
      .then(async ({ res, ai }) => {
        if (!live.current) return;
        if (!res || res.ok !== true) { setErr(scanErrorText(res && res.error)); return; }
        // v181: второй проход — каждый стол крупно, функция считает стулья у него одного (функция версии 2)
        let scan = res, seatsNote = "";
        const boxes = Number(res.v) >= 2 && res.plan !== false ? seatBoxes(res) : [];
        if (boxes.length) {
          setScanStage("seats");
          // v182: номера на столах в картинках закрыты — модель считает стулья, а не читает номер.
          // v184: и стулья по сторонам с диванами — как на фото (их хранит сервер с этапом 55)
          const full = await tableCrops(r0, boxes, 224, seatMasks(res)).then((crops) => scanSeatsFull(crops, opts)).catch(() => null);
          if (!live.current) return;
          // v185: стороны — всегда (по ним места: диван — сколько стульев напротив); на схему — только с этапом 55
          if (full) scan = mergeSeats(res, full.seats, full.sides).scan;
          else seatsNote = " Места посчитаны по общему плану: пересчитать у каждого стола не вышло.";
        }
        const out = layoutScan(scan, ai, planRef.current, zz, { mode, items: floor2, tall, sides: sidesOn });
        if (out.notPlan) { setErr(scanErrorText("not_plan")); return; }
        if (out.empty || !out.added) { setErr(scanErrorText("empty")); return; }
        commit(out.plan);
        vibrate("success");
        setSel(null); setSelItem(null); setMoving(false); setPend(null); setTool("table");
        setNote(scanSummary(out) + seatsNote);
        setTake(out.renamed && out.renamed.length ? { at: out.plan, z: zz, pairs: out.renamed } : null);
        // подложка — как легли столы: обрезана по залу, повёрнута и лежит там, где её столы (at)
        const whole = out.crop[0] <= 0.5 && out.crop[1] <= 0.5 && out.crop[2] >= 99.5 && out.crop[3] >= 99.5;
        if (out.rot || !whole) cropRotate(r0, out.crop, out.rot).then((nb) => { if (live.current) putBg(zz, { ...nb, at: out.at }); }).catch(() => {});
        else putBg(zz, { ...r0, at: out.at });
      })
      .catch(() => { if (live.current) setErr(scanErrorText("")); })
      .then(() => { if (live.current) { setScanBusy(false); setScanStage(""); } });
  };
  // v185: «Взять номера с фото» — распознанные столы получают номера с плана, те же номера в других залах убираются
  const takeInfo = take && take.at === plan ? takeNumbers(plan, take.z, take.pairs) : null;
  const takeNow = () => {
    if (!take) return;
    const r = takeNumbers(planRef.current, take.z, take.pairs);
    setTake(null);
    if (!r.taken) return;
    vibrate("success"); setErr(""); commit(r.plan); setNote(takeSummary(r));
  };
  // v185: не сохраняется — номера этого зала есть и в другом: «Убрать повторы из …» (столы этого зала остаются)
  const dropInfo = isCrossDup(err) && crossDupes(plan, z).length ? dropDupes(plan, z) : null;
  const [fixNote, setFixNote] = React.useState("");
  const dropNow = () => {
    const r = dropDupes(planRef.current, z);
    if (!r.removed.length) return;
    vibrate("success"); setErr(""); commit(r.plan); setFixNote(dropSummary(r));
  };
  const startScan = () => {
    if (!rec || scanBusy) return;
    vibrate("light"); setErr(""); setNote("");
    if (zoneTables(planRef.current, z).length) { setAsk(true); return; }
    runScan("add");
  };

  const save = () => {
    const pr = planProblem(plan);
    setFixNote("");
    if (pr) { setErr(pr); return; }
    if (!tall && (plan.tables || []).some((q) => q.shape === "tall")) { setErr("Вертикальные длинные столы сохранятся, когда на сервер добавят этап 54 (supabase-stage54-tall-tables.sql)."); return; }
    const body = floor2 ? withZones(plan) : planV1(plan);
    if (!body) { setErr("Залы, стены, бар и вход сохранятся, когда на сервер добавят этап 37 (supabase-stage37-halls-qday.sql)."); return; }
    // v183: приложение знает стулья по сторонам — сервер (этап 55) берёт их как есть: стол без sides — «как по местам»
    const sent = sidesOn ? { ...body, sides: true } : body;
    setBusy(true); setErr(""); setSureLeave(false);
    rpc("floor_save", { p_token: saToken(), p_plan: sent }).then((r) => {
      setBusy(false);
      if (r && r.ok) { vibrate("success"); onSaved(sent); }
      else if (r && r.error === "duplicate") setErr("Номера столов или названия залов повторяются.");
      else if (r && r.error === "overlap") setErr("Стол стоит на баре или входе.");
      else if (r && r.error === "old_app") setErr("На сервере схема новее: обнови приложение.");
      else if (r && r.error === "forbidden") setErr("Схему меняет руководитель или старший.");
      else if (r && r.error === "bad_plan") setErr("Сервер не принял схему. Обнови приложение; если не поможет, проверь этапы на сервере.");
      else if (rpcMissing(r)) setErr("На сервере ещё нет этапа 35 (supabase-stage35-seating.sql).");
      else setErr("Не сохранилось. Проверь связь.");
    }).catch(() => { setBusy(false); setErr("Нет связи. Схема останется здесь, сохранишь позже."); });
  };
  const hint = tool !== "table" ? TOOL_HINT[tool]
    : t && moving ? "Нажми на пустую клетку: туда встанет стол " + t.n + "."
    : t ? "Стол " + t.n + ": номер, места и форма ниже. Стол можно перетащить пальцем, «Ещё такой» поставит рядом такой же."
    : "Выбери стол и нажимай на пустые клетки: каждый раз встанет такой стол. Стол можно перетащить пальцем, нажатие его выбирает.";
  const field = { padding: "7px 10px", borderRadius: 10, border: `1px solid ${c.line}`, background: c.field, color: c.text, fontFamily: "Georgia, serif", fontSize: 15 };
  // пустой зал без фото: сначала — «Быстрее всего по фото» (подсказка про клетки — в ней же)
  const startCard = tool === "table" && !rec && !zoneTables(plan, z).length && !zoneItems(plan, z).length;
  return (
    <div data-floor-editor="">
      {floor2 ? (
        <div data-zone-tabs="" role="tablist" aria-label="Залы" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {zs.map((q) => <button key={q.id} type="button" role="tab" aria-selected={q.id === z} data-zone-tab={q.id} onClick={() => pickZone(q.id)} data-lens-btn={q.id === z ? "tab" : "soft"} data-lens-ink="" style={chip(c, q.id === z, a11y)}>{q.name}</button>)}
          {zs.length < MAX_ZONES ? <button type="button" data-zone-add="" onClick={newZone} data-lens-btn="soft" data-lens-ink="" style={{ ...chip(c, false, a11y), borderStyle: "dashed" }}>＋ Зал</button> : null}
        </div>) : null}
      {floor2 && zs.length > 1 ? (
        <div data-zone-edit={z} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <input value={zname} maxLength={24} data-zone-name="" aria-label="Название зала" onChange={(e) => nameZone(e.target.value)} style={{ ...field, flex: 1, minWidth: 0 }} />
          <button type="button" data-zone-remove="" onClick={dropZone} style={{ border: 0, background: "none", color: c.red, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" }}>Убрать зал</button>
        </div>) : null}
      <EditorActions c={c} a11y={a11y} canUndo={dirty} onUndo={undo} hasPhoto={!!rec} photoBusy={photoBusy} onPhoto={openPicker} />
      {startCard ? <StartCard c={c} busy={photoBusy} onPhoto={openPicker} /> : null}
      {floor2 ? (
        <div data-tools="" role="radiogroup" aria-label="Что ставить" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {TOOLS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={tool === k} data-tool={k} onClick={() => pickTool(k)} data-lens-btn={tool === k ? "tab" : "soft"} data-lens-ink="" style={chip(c, tool === k, a11y)}>{l}</button>)}
        </div>
      ) : <div data-need37="" style={{ fontSize: 12.5, color: c.sub, lineHeight: 1.5, marginBottom: 8 }}>Залы, стены, бар и вход появятся, когда на сервер добавят этап 37 (supabase-stage37-halls-qday.sql).</div>}
      {tool === "table" ? <KindPalette c={c} a11y={a11y} kind={kindOf(kind, tall).k} tall={tall} onKind={pickKind} /> : null}
      {tool === "table" && floor2 && !tall ? <div data-need54="" style={{ fontSize: 12, color: c.sub, lineHeight: 1.45, margin: "-4px 2px 10px" }}>Длинные столы вертикально появятся, когда на сервер добавят этап 54 (supabase-stage54-tall-tables.sql).</div> : null}
      {startCard ? null : <div data-editor-hint="" style={{ fontSize: 13, color: c.sub, lineHeight: 1.5, marginBottom: 10 }}>{hint}</div>}
      <div data-lens-card="" style={{ ...c.frost, padding: 10, marginBottom: 12 }}>
        <Floor c={c} a11y={a11y} plan={plan} zone={z} map={{}} now={Date.now()} sel={sel} selItem={selItem} edit tool={tool} pend={pend} bg={rec}
          onCell={cell} onNode={node} onDrop={drop}
          onItem={(i) => { setErr(""); setSel(null); setMoving(false); setSelItem(selItem === i.id ? null : i.id); }}
          onTable={(q) => { vibrate("light"); setErr(""); setMoving(false); setSelItem(null); setSel(sel === q.id ? null : q.id); }} />
      </div>
      {note ? <div role="status" data-editor-note="" style={{ fontSize: 13.5, color: c.text, lineHeight: 1.5, margin: "0 2px 12px" }}>{note}</div> : null}
      {takeInfo && takeInfo.taken ? <TakeNumbers c={c} a11y={a11y} hint={takeHint(takeInfo)} onTake={takeNow} /> : null}
      {rec ? <PhotoCard c={c} a11y={a11y} rec={rec} scanBusy={scanBusy} scanStage={scanStage} ask={ask} nTables={zoneTables(plan, z).length} rotating={rotating}
        onOp={setOp} onScan={startScan} onAnswer={runScan} onRotate={rotate} onDrop={dropBg} onPhoto={openPicker} /> : null}
      {floor2 && zoneItems(plan, z).length ? (
        <div data-items="" role="group" aria-label="Стены, бар и вход" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {zoneItems(plan, z).map((q, i) => <button key={q.id} type="button" data-item-chip={q.id} aria-pressed={selItem === q.id} onClick={() => { vibrate("light"); setErr(""); setSel(null); setSelItem(selItem === q.id ? null : q.id); }}
            data-lens-btn={selItem === q.id ? "tab" : "soft"} data-lens-ink="" style={{ ...chip(c, selItem === q.id, a11y), fontSize: 12.5, padding: "5px 10px" }}>{ITEM_KINDS[q.kind]}{q.kind === "wall" ? " " + (zoneItems(plan, z).filter((x) => x.kind === "wall").indexOf(q) + 1) : ""}</button>)}
        </div>) : null}
      {it ? (
        <div data-item-edit={it.id} data-lens-card="" style={{ ...c.frost, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 14, color: c.text }}>{ITEM_KINDS[it.kind]}{it.kind === "bar" ? " · " + it.w + " × " + it.h : it.kind === "wall" ? " · " + (Math.abs(it.x2 - it.x) + Math.abs(it.y2 - it.y)) + " " + pl(Math.abs(it.x2 - it.x) + Math.abs(it.y2 - it.y), "клетка", "клетки", "клеток") : ""}</span>
          <button type="button" data-item-remove="" onClick={() => { vibrate("light"); commit(removeItem(planRef.current, it.id)); setSelItem(null); }} style={{ border: 0, background: "none", color: c.red, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer" }}>Убрать</button>
        </div>) : null}
      {t && tool === "table" ? (
        <div data-table-edit={t.id} data-lens-card="" style={{ ...c.frost, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <span style={{ ...labelStyle(13.5), color: c.gold }}>Номер</span>
            <input value={t.n} maxLength={6} data-edit-n="" aria-label="Номер стола" onChange={(e) => { setErr(""); commit(updateTable(planRef.current, t.id, { n: e.target.value }), "n:" + t.id); }}
              style={{ ...field, width: 80 }} />
            <span style={{ flex: 1 }} />
            <button type="button" data-edit-move="" aria-pressed={moving} onClick={() => { vibrate("light"); setErr(""); setMoving(!moving); }} data-lens-btn={moving ? "tab" : "soft"} data-lens-ink="" style={chip(c, moving, a11y)}>Передвинуть</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }} role="group" aria-label="Мест">
            <span style={{ ...labelStyle(13.5), color: c.gold, flex: 1 }}>Мест</span>
            <button type="button" aria-label="Меньше мест" data-seats-minus="" onClick={() => seats(-1)} data-lens-btn="soft" data-lens-ink="" style={{ ...chip(c, false, a11y), width: 40, padding: "6px 0", fontSize: 18 }}>−</button>
            <span data-seats="" style={{ minWidth: 28, textAlign: "center", fontSize: 20, color: c.text }}>{t.seats}</span>
            <button type="button" aria-label="Больше мест" data-seats-plus="" onClick={() => seats(1)} data-lens-btn="soft" data-lens-ink="" style={{ ...chip(c, false, a11y), width: 40, padding: "6px 0", fontSize: 18 }}>+</button>
          </div>
          {sidesOn && t.shape !== "rd" ? <ChairSides c={c} a11y={a11y} t={t} sides={sidesOf(t)} own={!!okSides(t.shape, t.sides)}
            onStep={(i, d) => { vibrate("light"); setErr(""); commit(sideStep(planRef.current, t.id, i, d), "sd:" + t.id + ":" + i); }}
            onSofa={(i) => { vibrate("light"); setErr(""); commit(toggleSofa(planRef.current, t.id, i)); }}
            onReset={() => { vibrate("light"); setErr(""); commit(resetSides(planRef.current, t.id)); }} /> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }} role="group" aria-label="Форма">
            {SHAPES.map(([k, l]) => <button key={k} type="button" data-edit-shape={k} onClick={() => { if (t.shape === k || (k === "long" && t.shape === "tall")) return; if (k === "long") { toLong(); return; } setErr(""); commit(updateTable(plan, t.id, { shape: k })); }} data-lens-btn={t.shape === k || (k === "long" && t.shape === "tall") ? "tab" : "soft"} data-lens-ink="" style={chip(c, t.shape === k || (k === "long" && t.shape === "tall"), a11y)}>{l}</button>)}
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <CopyBtn c={c} onClick={copy} />
            {tall && (t.shape === "long" || t.shape === "tall") ? <TurnBtn c={c} onClick={turn} /> : null}
            <span style={{ flex: 1 }} />
            <button type="button" data-edit-remove="" onClick={() => { vibrate("light"); commit(removeTable(planRef.current, t.id)); setSel(null); setMoving(false); }} style={{ border: 0, background: "none", color: c.red, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer", padding: "4px 2px" }}>Убрать стол</button>
          </div>
        </div>) : null}
      {canRenumber(plan) || sureRenum ? <div style={{ margin: "0 0 10px" }}><RenumberBtn c={c} sure={sureRenum} onClick={renum} /></div> : null}
      {err ? <div role="alert" style={{ fontSize: 13, color: c.red, margin: "0 2px 10px" }}>{err}</div> : null}
      {dropInfo ? <DropDupes c={c} a11y={a11y} label={dropLabel(dropInfo)} hint={dropHint(dropInfo)} onDrop={dropNow} /> : null}
      {fixNote && !err ? <div role="status" data-fix-note="" style={{ fontSize: 13, color: c.text, lineHeight: 1.5, margin: "0 2px 10px" }}>{fixNote}</div> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={() => { if (tryLeave()) onCancel(); }} data-lens-btn="soft" style={{ ...btn(c), flex: 1 }}>Отмена</button>
        <button type="button" data-floor-save="" onClick={save} disabled={busy} data-lens-btn="main" style={{ ...btn(c, true), flex: 1.4, opacity: busy ? 0.6 : 1 }}>{busy ? "Сохраняю…" : "Сохранить схему"}</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" data-floor-file="" tabIndex={-1} aria-hidden="true"
        onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; pickPhoto(f); }}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }} />
      {sureLeave ? portal(
        <div data-leave-ask="" role="alertdialog" aria-label="Схема не сохранена" data-lens-card=""
          style={{ ...c.frost, position: "fixed", left: 12, right: 12, bottom: "calc(18px + env(safe-area-inset-bottom, 0px))", zIndex: 950, maxWidth: 536, margin: "0 auto", padding: "12px 14px",
            background: a11y ? "#F3EADA" : "#1F170C", boxShadow: "0 10px 30px rgba(0,0,0,0.45)", fontFamily: "Georgia, serif" }}>
          <div style={{ fontSize: 14, color: c.text, lineHeight: 1.45, marginBottom: 10 }}>Схема не сохранена. Сохранить или выйти без изменений?</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" data-leave-save="" onClick={save} disabled={busy} data-lens-btn="main" style={{ ...btn(c, true), flex: 1, padding: "10px 12px", fontSize: 14 }}>Сохранить</button>
            <button type="button" data-leave-drop="" onClick={() => { setSureLeave(false); onCancel(); }} data-lens-btn="soft" style={{ ...btn(c), flex: 1, padding: "10px 12px", fontSize: 14 }}>Выйти без них</button>
          </div>
        </div>) : null}
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
  const [wsel, setWsel] = React.useState(null);   // v186: официант, чьи столы подсвечены
  const [pick, setPick] = React.useState(null);   // v187: выбрать стол на схеме: { kind: "move" | "join" | "wait", tid, w }
  const [pend, setPend] = React.useState(null);   // v187: карточка стола с продолжением: { main, with, cnt } или { wait, cnt }
  const [waitForm, setWaitForm] = React.useState(false);
  const restaurant = (profile && profile.restaurant) || "";
  // v179: редактор спрашивает перед выходом без сохранения; «По фото плана» с пустой доски — сразу в редактор с фото
  const guard = React.useRef(null);
  const [photo0, setPhoto0] = React.useState(null);
  const openEditor = (file) => { vibrate("light"); setMsg(""); setPhoto0(file || null); setEdit(true); };
  const load = React.useCallback(() => rpc("seat_board", { p_token: saToken() }).then((r) => {
    if (rpcMissing(r)) { setSt({ status: "missing" }); rememberSeatPlan(restaurant, null, undefined, true); if (onMissing) onMissing(); }
    else if (r && r.ok) { setSt({ status: "ok", ...r, at: Date.now() }); rememberSeatPlan(restaurant, r); }   // v149: есть ли схема — для советов в уроках
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
  // v186: официант цветом — рамка стола и кружок у имени; нажать на имя — подсветить его столы
  const wIdx = React.useMemo(() => waiterColorIndex(st.staff || [], shiftMap, ok ? st.tables : []), [st, shiftMap]);   // eslint-disable-line react-hooks/exhaustive-deps
  const wPal = WAITER_COLORS[a11y ? "light" : "dark"];
  const wcolor = (id) => (id && id in wIdx ? wPal[wIdx[id] % wPal.length] : null);
  const wOn = wsel && !party && team.busy.some((x) => x.id === wsel) ? wsel : null;   // ушёл со столов — подсветки нет
  const hiW = wOn ? waiterTids(ok ? st.tables : [], wOn) : [];
  // v187 (этап 56): объединить столы, пересадить гостей, лист ожидания
  const seat2 = ok && st.seat2 === true;
  const rows = ok ? st.tables || [] : [];
  const waits = seat2 && Array.isArray(st.wait) ? st.wait : [];
  React.useEffect(() => { if (!sel) setPend(null); }, [sel]);   // карточку закрыли — продолжение не нужно
  const selT = plan && sel ? (plan.tables || []).find((q) => q.id === sel) : null;
  const saveTable = (t, f) => rpc("seat_set", { p_token: saToken(), p_tid: t.id, p_status: f.status, p_cnt: f.cnt, p_name: f.name, p_rtime: f.rtime, p_waiter: f.waiter }).then((r) => {
    if (r && r.ok && r.table) {
      vibrate("success");
      const p = pend;
      setSt((s) => ({ ...s, tables: mergeRows(s.tables, r.tables || [r.table]) }));   // v187: и приставленные
      setSel(null); setParty(0);
      setMsg(f.status === "seat" ? "Стол " + t.n + ": посадили." : f.status === "bill" ? "Стол " + t.n + ": попросили счёт." : f.status === "res" ? "Стол " + t.n + ": бронь на " + f.rtime + "." : f.status === "clean" ? "Стол " + t.n + ": на уборку." : "Стол " + t.n + " свободен.");
      // v187: посадили за объединённые — приставить; из листа ожидания — отметить «посадили»
      if (p && p.main === t.id && p.with && p.with.length && (f.status === "seat" || f.status === "res")) doJoin(t.id, p.with, "Стол " + t.n + ": " + (f.status === "res" ? "бронь на " + f.rtime : "посадили") + ". ");
      if (p && p.wait && f.status === "seat") {
        rpc("wait_done", { p_token: saToken(), p_id: p.wait.id, p_how: "seat", p_tid: t.id })
          .then((x) => { if (x && (x.ok || x.error === "not_found")) setSt((s) => ({ ...s, wait: (s.wait || []).filter((w) => w.id !== p.wait.id) })); }).catch(() => {});
      }
      return true;
    }
    return r && r.error === "bad_request" && f.status === "bill" ? "need36" : false;   // этап 35 без 36 «Счёт» не знает
  }).catch(() => false);
  // v187: пересадить, приставить, отделить; выбор стола на схеме
  const apply = (r) => setSt((s) => ({ ...s, tables: mergeRows(s.tables, r.tables || (r.table ? [r.table] : [])) }));
  const tnum = (id) => tById(id).n;
  const listN = (ids) => ids.map(tnum).join(", ");
  const failed = (r) => { vibrate("error"); setMsg(seat2Error(r, tnum)); if (r && (r.error === "not_busy" || r.error === "busy" || r.error === "joined")) load(); };
  const offline = () => setMsg("Не сохранилось. Проверь связь.");
  const doMove = (from, to) => {
    const g = groupOf(map, from), wasRes = stateOf(map, g[0]).status === "res";
    return rpc("seat_move", { p_token: saToken(), p_from: from, p_to: to }).then((r) => {
      if (!r || !r.ok) { failed(r); return; }
      vibrate("success"); apply(r); setPick(null);
      setMsg(wasRes ? "Бронь " + (g.length > 1 ? "со столов " : "со стола ") + listN(g) + " перенесли на стол " + tnum(to) + "."
        : "Гостей " + (g.length > 1 ? "со столов " : "со стола ") + listN(g) + " пересадили за стол " + tnum(to) + ". " + (g.length > 1 ? "Столы " + listN(g) + " на уборке." : "Стол " + listN(g) + " на уборке."));
    }).catch(offline);
  };
  const doJoin = (main, ids, pre = "") => rpc("seat_join", { p_token: saToken(), p_tid: main, p_with: ids }).then((r) => {
    if (!r || !r.ok) { failed(r); return; }
    vibrate("success"); apply(r); setPick(null);
    const n = groupSeats(plan, boardMap(mergeRows(rows, r.tables)), main);
    setMsg(pre + (ids.length === 1 ? "Стол " + tnum(ids[0]) : "Столы " + listN(ids)) + " приставили к столу " + tnum(main) + ": вместе " + n + " " + pl(n, "место", "места", "мест") + ".");
  }).catch(offline);
  const doUnjoin = (tid) => {
    const wasBusy = isBusy(stateOf(map, tid));
    return rpc("seat_unjoin", { p_token: saToken(), p_tid: tid }).then((r) => {
      if (!r || !r.ok) { failed(r); return; }
      vibrate("success"); apply(r); setMsg("Стол " + tnum(tid) + " отделили, " + (wasBusy ? "он на уборке." : "он свободен."));
    }).catch(offline);
  };
  const pickT = (t) => {
    if (pick.tid && groupOf(map, pick.tid).includes(t.id)) { setMsg("Это стол той же компании. Выбери другой."); return; }
    if (!isFreeT(map, t.id)) { setMsg("Стол " + t.n + " занят. Выбери свободный."); return; }
    if (pick.kind === "move") { doMove(pick.tid, t.id); return; }
    if (pick.kind === "join") {
      if (zoneOfX(plan, t) !== zoneOfX(plan, tById(pick.tid))) { setMsg("Приставить можно стол того же зала."); return; }
      doJoin(pick.tid, [t.id]); return;
    }
    // из листа ожидания — карточка стола: сколько гостей, официант
    setPend({ wait: pick.w, cnt: Number(pick.w.cnt) || 2 }); setPick(null); setSel(t.id);
  };
  const onTable = (t) => {
    vibrate("light"); setMsg("");
    if (pick) { pickT(t); return; }
    const r = stateOf(map, t.id);
    setSel(r.main && map[r.main] ? r.main : t.id);   // приставленный — карточка главного
  };
  const pickHi = !pick ? [] : pick.kind === "join" ? freeNear(plan, rows, pick.tid)
    : pick.kind === "wait" ? suggest(plan, rows, Number(pick.w.cnt) || 1)
    : zoneTables(plan, z).filter((q) => isFreeT(map, q.id) && !groupOf(map, pick.tid).includes(q.id)).map((q) => q.id);
  const who = (w) => ((w && w.name) || "").trim() || "без имени";
  const pickText = !pick ? "" : pick.kind === "wait"
    ? "Куда посадить: " + who(pick.w) + ", " + guestsWord(Number(pick.w.cnt) || 0) + "? " + (pickHi.length ? "Подходящие столы подсвечены." : "Подходящих свободных нет, можно выбрать любой свободный.")
    : pick.kind === "join" ? "Какой стол приставить к столу " + tnum(pick.tid) + "? " + (pickHi.length ? "Свободные рядом подсвечены." : "Рядом свободных нет, можно выбрать любой свободный в этом зале.")
    : (stateOf(map, pick.tid).status === "res" ? "Куда перенести бронь со стола " : "Куда пересадить гостей со стола ") + groupLabel(plan, map, pick.tid) + "? Нажми на свободный стол" + (multi ? ", можно в другом зале." : ".");
  // одного стола на компанию нет — какие соседние можно объединить
  const joins = seat2 && party && !hi.length ? joinSuggest(plan, rows, party, z) : [];
  const pickJoin = (j) => { if (j.z !== z) pickZone(j.z); setMsg(""); setPend({ main: j.main, with: j.with, cnt: party }); setSel(j.main); };
  // лист ожидания
  const addWait = (x) => rpc("wait_add", { p_token: saToken(), p_name: x.name, p_cnt: x.cnt, p_note: x.note }).then((r) => {
    if (!r || !r.ok || !r.item) return seat2Error(r);
    vibrate("success"); setSt((s) => ({ ...s, wait: [...(s.wait || []), r.item] })); setWaitForm(false);
    setMsg("Записали в лист ожидания: " + who(x) + ", " + guestsWord(x.cnt) + ".");
    return true;
  }).catch(() => "Не сохранилось. Проверь связь.");
  const leftWait = (w) => rpc("wait_done", { p_token: saToken(), p_id: w.id, p_how: "left", p_tid: null }).then((r) => {
    if (!r || !(r.ok || r.error === "not_found")) { setMsg(seat2Error(r)); return; }
    setSt((s) => ({ ...s, wait: (s.wait || []).filter((q) => q.id !== w.id) })); setMsg("Убрали из листа: " + who(w) + ", ушли.");
  }).catch(offline);
  const seatWait = (w) => { setParty(0); setWsel(null); setSel(null); setMsg(""); setPick({ kind: "wait", w }); };
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
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={() => { if (edit) { if (!guard.current || guard.current()) setEdit(false); } else onBack(); }}>‹</button>
        <div style={T.lessHeadTitle}>{edit ? "Схема зала" : "Рассадка"}</div>
      </div>
      <div style={{ padding: "4px 16px 110px" }}>
        {st.status === "loading" ? <div style={{ fontSize: 13, color: c.sub, padding: "6px 2px" }}>Загружаю зал…</div> : null}
        {st.status === "missing" ? <div data-lens-card="" style={{ ...c.frost, padding: "12px 14px", fontSize: 13.5, color: c.text, lineHeight: 1.5 }}>На сервере ещё нет этапа 35 (supabase-stage35-seating.sql). Когда руководитель его добавит, здесь будет схема зала и рассадка.</div> : null}
        {st.status === "norest" ? <div data-lens-card="" style={{ ...c.frost, padding: "12px 14px", fontSize: 13.5, color: c.text }}>В профиле не указано заведение.</div> : null}
        {st.status === "offline" || st.status === "error" ? <div data-lens-card="" style={{ ...c.frost, padding: "12px 14px", fontSize: 13.5, color: c.text }}>Зал не загрузился. Проверь связь.
          <button type="button" onClick={() => { setSt({ status: "loading" }); load(); }} data-lens-btn="soft" style={{ ...btn(c), display: "block", marginTop: 10, padding: "9px 14px" }}>Ещё раз</button></div> : null}
        {ok && edit ? <FloorEditor c={c} a11y={a11y} plan0={plan} floor2={st.floor === 2} restaurant={restaurant} photo0={photo0} guard={guard} tall={!!st.tall} sidesOn={!!st.sides} onCancel={() => setEdit(false)} onSaved={(p) => { setEdit(false); setSt((s) => ({ ...s, plan: p })); rememberSeatPlan(restaurant, { ok: true, plan: p }); setMsg("Схема сохранена: её видит вся смена."); }} /> : null}
        {ok && !edit ? <>
          {msg ? <div role="status" style={{ fontSize: 13.5, color: c.text, margin: "2px 2px 10px" }}>{msg}</div> : null}
          {st.offline ? <div style={{ fontSize: 12.5, color: c.red, margin: "0 2px 8px" }}>Нет связи: показано последнее, что пришло.</div> : null}
          {!plan || !(plan.tables || []).length ? (
            <div data-lens-card="" style={{ ...c.frost, padding: "14px 16px", lineHeight: 1.5 }} data-floor-empty="">
              <LineArt kind="table" color={c.gold} size={140} style={{ margin: "4px auto 12px" }} />
              <div style={{ fontSize: 14.5, color: c.text }}>{st.lead ? "Схемы зала ещё нет. Нарисуй её: где какие столы и сколько за ними мест. Её увидит вся смена." : "Руководитель ещё не нарисовал схему зала."}</div>
              {st.lead ? <div style={{ fontSize: 13, color: c.sub, marginTop: 8 }}>Есть план зала на бумаге или в программе броней? Сфотографируй его, и ИИ расставит столы сам.</div> : null}
              {st.lead ? <button type="button" data-floor-edit="" onClick={() => openEditor(null)} data-lens-btn="main" style={{ ...btn(c, true), width: "100%", marginTop: 12 }}>Нарисовать схему</button> : null}
              {st.lead ? (
                <label data-floor-photo-board="" data-lens-btn="soft" style={{ ...btn(c), width: "100%", marginTop: 10, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, position: "relative" }}>
                  <CameraIcon s={18} color={c.gold} />По фото плана
                  <input type="file" accept="image/*" data-floor-file-board="" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) openEditor(f); }}
                    style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }} />
                </label>) : null}
            </div>
          ) : <>
            {multi ? (
              <div data-board-zones="" role="tablist" aria-label="Залы" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "2px 0 10px" }}>
                {zs.map((q) => <button key={q.id} type="button" role="tab" aria-selected={q.id === z} data-board-zone={q.id} onClick={() => pickZone(q.id)} data-lens-btn={q.id === z ? "tab" : "soft"} data-lens-ink="" style={{ ...chip(c, q.id === z, a11y), display: "inline-flex", alignItems: "center", gap: 6 }}>
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
              {waits.length ? <><span>·</span><span data-wait-sum="">Ждут <b style={{ color: c.text }}>{waits.length}</b></span></> : null}
            </div>
            {pick ? <PickBanner c={c} text={pickText} onCancel={() => { setPick(null); setMsg(""); }} /> : <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }} role="group" aria-label="Посадить компанию">
              <span style={{ ...labelStyle(13), color: c.gold }}>Посадить:</span>
              {PARTY.map(([n, l]) => <button key={n} type="button" data-party={n} onClick={() => { vibrate("light"); setWsel(null); setParty(party === n ? 0 : n); }} data-lens-btn={party === n ? "tab" : "soft"} data-lens-ink="" style={chip(c, party === n, a11y)}>{l}</button>)}
            </div>
            {party ? <div data-suggest="" style={{ fontSize: 13, color: hi.length || soon.length ? c.text : c.red, margin: "0 2px 10px", lineHeight: 1.45 }}>
              {suggestLine(hi, tn0, multi ? (id) => zoneOfX(plan, tById(id)) : null, z, zName)}
              {soon.length ? <span data-soon=""> Скоро освободится: {soon.map(tn).join(", ")} (попросили счёт).</span> : null}</div> : null}
            <JoinChips c={c} a11y={a11y} list={joins} zName={multi ? zName : null} here={z} onPick={pickJoin} />
            </>}
            <div data-lens-card="" style={{ ...c.frost, padding: 10 }}>
              <Floor c={c} a11y={a11y} plan={plan} zone={z} map={map} now={now} hi={pick ? pickHi : party ? hi : hiW} sel={sel} wcolor={wcolor} onTable={onTable} />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "10px 2px 0", fontSize: 12, color: c.sub }}>
              {["free", "res", "seat", "bill", "clean"].map((k) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: c.st[k].bg, border: `1.2px ${c.st[k].dash ? "dashed" : "solid"} ${c.st[k].bd}` }} />{STATUS[k].toLowerCase()}</span>)}
            </div>
            {sum.seat || sum.bill ? <div data-board-hint="" style={{ fontSize: 12, color: c.sub, margin: "6px 2px 0", lineHeight: 1.45 }}>
              Полоска по краю стола: сколько сидят гости, через час она <span style={{ color: c.warn }}>жёлтая</span>, через полтора <span style={{ color: c.late }}>красная</span>. Рамка вокруг стола цветом официанта.</div> : null}
            {seat2 ? <WaitList c={c} a11y={a11y} plan={plan} rows={rows} waits={waits} now={now} form={waitForm} onForm={setWaitForm} onAdd={addWait} onSeat={seatWait} onLeft={leftWait} /> : null}
            {team.busy.length || team.idle.length ? <div data-waiters="" style={{ marginTop: 16 }}>
              <div style={{ ...labelStyle(15), color: c.gold, margin: "0 2px 6px" }}>Официанты</div>
              <div data-lens-card="" style={{ ...c.frost, padding: "10px 14px", fontSize: 13.5, color: c.sub, lineHeight: 1.6 }}>
                {team.busy.map((x) => { const on = wOn === x.id, col = wcolor(x.id); return (
                  <button key={x.id} type="button" data-waiter-row={x.id} aria-pressed={on} onClick={() => { vibrate("light"); setParty(0); setWsel(on ? null : x.id); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "calc(100% + 12px)", textAlign: "left", border: 0, borderRadius: 10, padding: "2px 6px", margin: "0 -6px",
                      background: on ? (a11y ? "rgba(139,106,48,0.13)" : "rgba(210,168,90,0.13)") : "transparent", color: c.sub, fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.6, cursor: "pointer" }}>
                    <span data-waiter-dot="" aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 5, flex: "none", border: `2px solid ${col || c.sub}` }} />
                    <span><span style={{ color: c.text }}>{x.name}</span>: {x.tables.length === 1 ? "стол " : "столы "}{x.tables.join(", ")} · {x.guests} {pl(x.guests, "гость", "гостя", "гостей")}</span>
                  </button>); })}
                {team.idle.length ? <div>В графике, без столов: <span style={{ color: c.text }}>{team.idle.join(", ")}</span></div> : null}
                {team.busy.length ? <div style={{ fontSize: 12, marginTop: 4 }}>{wOn ? "Столы официанта подсвечены. Нажми на имя ещё раз, чтобы снять." : "Нажми на имя: подсветятся столы официанта."}</div> : null}
              </div>
            </div> : null}
            {res.length ? <div data-res-list="" style={{ marginTop: 16 }}>
              <div style={{ ...labelStyle(15), color: c.gold, margin: "0 2px 8px" }}>Брони сегодня</div>
              {res.map((x) => <div key={x.tid} role="button" tabIndex={0} data-lens-card="" onClick={() => setSel(x.tid)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(x.tid); } }} style={{ ...c.frost, padding: "10px 14px", marginBottom: 8, display: "flex", gap: 10, cursor: "pointer" }}>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 16, color: c.text, minWidth: 52 }}>{x.rtime}</span>
                <span style={{ flex: 1, fontSize: 14, color: c.text }}>{x.name || "Без имени"} · {x.cnt} {pl(x.cnt, "гость", "гостя", "гостей")}</span>
                <span style={{ fontSize: 13, color: c.sub }}>стол {x.n}{multi ? " · " + zName(zoneOfX(plan, tById(x.tid))) : ""}</span>
              </div>)}
            </div> : null}
            {st.lead ? <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
              <button type="button" data-floor-edit="" onClick={() => openEditor(null)} style={{ border: 0, background: "none", color: c.gold, fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer", padding: "4px 2px" }}>Схема зала ›</button>
              <button type="button" data-seat-clear="" onClick={clear} style={{ border: 0, background: "none", color: sure ? c.red : c.sub, fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer", padding: "4px 2px" }}>{sure ? "Все столы станут свободными. Нажми ещё раз" : "Очистить доску"}</button>
            </div> : null}
            {st.lead && !seat2 ? <div data-seat2-hint="" style={{ fontSize: 12, color: c.sub, margin: "8px 2px 0", lineHeight: 1.45 }}>
              Объединять столы, пересаживать гостей и вести лист ожидания можно будет, когда на сервер добавят этап 56 (supabase-stage56-join-move-wait.sql).</div> : null}
            <LineArt kind="table" color={c.gold} size={130} style={{ margin: "30px auto 0", opacity: 0.35 }} />
          </>}
        </> : null}
      </div>
      {selT ? <TableSheet key={selT.id} c={c} a11y={a11y} t={selT} zoneName={multi ? zName(zoneOfX(plan, selT)) : ""} row={stateOf(map, selT.id)} staff={st.staff || []} shiftMap={shiftMap} load={team.count} party={party}
        seat2={seat2} group={groupOf(map, selT.id).slice(1).map(tById).filter((q) => q.id)} joinWith={pend && pend.main === selT.id && pend.with ? pend.with.map(tById).filter((q) => q.id) : null}
        fromWait={pend && pend.wait ? pend.wait : null} cnt0={pend ? pend.cnt || 0 : 0} onUnjoin={doUnjoin}
        onMove={() => { setSel(null); setPick({ kind: "move", tid: selT.id }); }} onJoin={() => { setSel(null); setPick({ kind: "join", tid: selT.id }); }}
        now={now} onSave={saveTable} onClose={() => setSel(null)} wcolor={wcolor} /> : null}
    </div>
  );
}
