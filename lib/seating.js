// lib/seating.js — v85 (Доп. 398): рассадка для хостес.
//
// Схема зала — столы на сетке 8 клеток в ширину (на телефоне клетка около 42 px: по столу легко попасть пальцем):
// { v: 1, tables: [{ id, n, seats, shape, x, y }] }; форма sq — квадрат, rd — круглый, long — длинный (две клетки
// в ширину). Доска на сегодня — по столу: свободен, бронь (время, на кого, сколько), гости (сколько, официант, с какого
// времени), уборка. Здесь только расчёт: экран — ui/seating.jsx, сервер — этап 35 (floor_save / seat_board / seat_set /
// seat_clear).
import { findMe } from "./schedule-sync";

export const GRID_W = 8, GRID_H = 30, MAX_TABLES = 80;
export const STATUS = { free: "Свободен", res: "Бронь", seat: "Гости", bill: "Счёт", clean: "Уборка" };   // v86: + «Счёт» (этап 36)
export const SHAPES = [["sq", "Квадрат"], ["rd", "Круглый"], ["long", "Длинный"]];
export const PARTY = [[2, "1–2"], [4, "3–4"], [6, "5–6"], [8, "7+"]];
/** Что обычно дальше со столом: свободный и с бронью — сажают, с гостями — счёт (v86), после счёта — уборка, после
 *  уборки — свободен. */
export const NEXT = { free: "seat", res: "seat", seat: "bill", bill: "clean", clean: "free" };
/** Стол занят гостями: сидят или уже попросили счёт. */
export const isBusy = (r) => !!r && (r.status === "seat" || r.status === "bill");
const plw = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
export const guestsWord = (n) => n + " " + plw(n, "гость", "гостя", "гостей");

export const cellsOf = (t) => (t.shape === "long" ? [[t.x, t.y], [t.x + 1, t.y]] : [[t.x, t.y]]);
const key = (x, y) => x + ":" + y;
const tablesOf = (plan) => (plan && Array.isArray(plan.tables) ? plan.tables : []);

/** Занятые клетки (кроме стола skipId). */
export function busyCells(plan, skipId) {
  const s = new Set();
  tablesOf(plan).forEach((t) => { if (t.id !== skipId) cellsOf(t).forEach(([x, y]) => s.add(key(x, y))); });
  return s;
}
/** Встанет ли стол (с этой формой) в клетку x, y: в сетке и не на другом столе. */
export function fits(plan, t, x, y) {
  const probe = { ...t, x, y };
  const busy = busyCells(plan, t.id);
  return cellsOf(probe).every(([cx, cy]) => cx >= 0 && cx < GRID_W && cy >= 0 && cy < GRID_H && !busy.has(key(cx, cy)));
}
/** Следующий номер: наибольший числовой + 1. */
export function nextNumber(plan) {
  const nums = tablesOf(plan).map((t) => parseInt(String(t.n), 10)).filter((n) => Number.isFinite(n));
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}
export function newId(plan) {
  const ids = new Set(tablesOf(plan).map((t) => t.id));
  for (let i = tablesOf(plan).length + 1; ; i++) { const id = "t" + i.toString(36); if (!ids.has(id)) return id; }
}
export const emptyPlan = () => ({ v: 1, tables: [] });
/** Добавить стол в клетку (4 места, квадрат); не встаёт — план как был. */
export function addTable(plan, x, y) {
  const p = plan || emptyPlan();
  if (tablesOf(p).length >= MAX_TABLES) return p;
  const t = { id: newId(p), n: nextNumber(p), seats: 4, shape: "sq", x, y };
  return fits(p, t, x, y) ? { ...p, v: 1, tables: [...tablesOf(p), t] } : p;
}
export function moveTable(plan, id, x, y) {
  const t = tablesOf(plan).find((q) => q.id === id);
  if (!t || !fits(plan, t, x, y)) return plan;
  return { ...plan, tables: tablesOf(plan).map((q) => (q.id === id ? { ...q, x, y } : q)) };
}
/** Правка стола: номер, места, форма; длинный, которому не хватает места справа, не меняется. */
export function updateTable(plan, id, patch) {
  const t = tablesOf(plan).find((q) => q.id === id);
  if (!t) return plan;
  const nt = { ...t, ...patch };
  if (nt.seats != null) nt.seats = Math.max(1, Math.min(20, Math.round(Number(nt.seats) || 1)));
  if (patch.shape && !fits(plan, nt, nt.x, nt.y)) return plan;
  return { ...plan, tables: tablesOf(plan).map((q) => (q.id === id ? nt : q)) };
}
export const removeTable = (plan, id) => ({ ...plan, tables: tablesOf(plan).filter((q) => q.id !== id) });

/** Что не так со схемой (первая причина) или "". */
export function planProblem(plan) {
  const ts = tablesOf(plan);
  if (ts.length > MAX_TABLES) return "Столов больше " + MAX_TABLES;
  const nums = new Set();
  for (const t of ts) {
    const n = String(t.n || "").trim();
    if (!n || n.length > 6) return "У стола нет номера";
    if (nums.has(n.toLowerCase())) return "Номер " + n + " повторяется";
    nums.add(n.toLowerCase());
    if (!fits(plan, t, t.x, t.y)) return "Стол " + n + " наезжает на другой или выходит за край";
  }
  return "";
}
/** Высота сетки в клетках: до нижнего стола + запас строка (для редактора — ещё две). */
export const gridRows = (plan, extra = 1) => Math.min(GRID_H, tablesOf(plan).reduce((m, t) => Math.max(m, t.y + 1), 0) + extra);

/** Состояние столов: tid → { status, … }; стола нет в доске — свободен. */
export function boardMap(rows) {
  const m = {};
  (rows || []).forEach((r) => { if (r && r.tid) m[r.tid] = r; });
  return m;
}
export const stateOf = (map, tid) => map[tid] || { tid, status: "free", cnt: 0 };

/** Сводка: свободно, занято (и гостей), брони, уборка. */
export function summary(plan, rows) {
  const map = boardMap(rows), s = { total: 0, free: 0, seat: 0, guests: 0, res: 0, clean: 0 };
  tablesOf(plan).forEach((t) => { const r = stateOf(map, t.id); s.total++; s[r.status] = (s[r.status] || 0) + 1; if (isBusy(r)) s.guests += Number(r.cnt) || 0; });
  return s;
}

/** Куда посадить компанию: свободные столы, где хватает мест, сначала с наименьшим запасом; до трёх. */
export function suggest(plan, rows, party) {
  const map = boardMap(rows), need = Math.max(1, Number(party) || 1);
  return tablesOf(plan).filter((t) => stateOf(map, t.id).status === "free" && t.seats >= need)
    .sort((a, b) => (a.seats - need) - (b.seats - need) || a.y - b.y || a.x - b.x).slice(0, 3).map((t) => t.id);
}
/** v86: скоро освободятся — столы со «Счётом», где хватает мест; дольше сидят — первыми; до двух. */
export function soonFree(plan, rows, party) {
  const map = boardMap(rows), need = Math.max(1, Number(party) || 1);
  return tablesOf(plan).filter((t) => stateOf(map, t.id).status === "bill" && t.seats >= need)
    .sort((a, b) => String(stateOf(map, a.id).since || "").localeCompare(String(stateOf(map, b.id).since || "")) || a.y - b.y || a.x - b.x).slice(0, 2).map((t) => t.id);
}

/** Сколько минут сидят (по времени сервера). */
export function minutesSince(since, now) {
  const a = Date.parse(since || ""), b = typeof now === "number" ? now : Date.parse(now || "");
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.floor((b - a) / 60000)) : 0;
}
export const sinceLabel = (min) => (min < 60 ? min + " мин" : Math.floor(min / 60) + " ч " + String(min % 60).padStart(2, "0") + " мин");
/** Подпись на столе: гости — «4·25м» (сколько и сколько сидят), бронь — время, уборка, свободный — места. */
export function tableSub(t, r, now) {
  if (r.status === "seat") { const m = minutesSince(r.since, now); return (Number(r.cnt) || 0) + "·" + (m < 60 ? m + "м" : Math.floor(m / 60) + "ч" + String(m % 60).padStart(2, "0")); }
  if (r.status === "res") return r.rtime || "бронь";
  if (r.status === "bill") return "счёт";
  if (r.status === "clean") return "уборка";
  return t.seats + " м.";
}
/** Сколько гостей в карточке стола: как было за столом или в брони; иначе — выбранная компания или двое (не больше мест). */
export const defaultCnt = (t, row, party) => (row && Number(row.cnt) > 0 ? Number(row.cnt) : Math.max(1, Math.min(party || 2, Number(t.seats) || 1)));

/** Брони на сегодня по времени: стол, время, на кого, сколько. */
export function reservations(plan, rows) {
  const byId = Object.fromEntries(tablesOf(plan).map((t) => [t.id, t]));
  return (rows || []).filter((r) => r && r.status === "res" && byId[r.tid])
    .map((r) => ({ tid: r.tid, n: byId[r.tid].n, rtime: r.rtime || "", name: r.name || "", cnt: Number(r.cnt) || 0 }))
    .sort((a, b) => (a.rtime || "99").localeCompare(b.rtime || "99") || String(a.n).localeCompare(String(b.n), "ru", { numeric: true }));
}

/** Кто из сотрудников сегодня в графике (по именам, как экран «График» находит себя): id → true. */
export function onShiftToday(staff, roster) {
  const names = [];
  (roster || []).forEach((s) => (s.people || []).forEach((p) => names.push({ name: p })));
  const out = {};
  (staff || []).forEach((e) => { if (e && e.id && findMe(names, { name: e.name, surname: e.surname })) out[e.id] = true; });
  return out;
}
/** Официанты для выбора: сначала кто в графике, потом остальные; по имени и фамилии. */
export function waiterList(staff, shiftMap) {
  const on = shiftMap || {};
  return (staff || []).filter((e) => e && e.id).slice()
    .sort((a, b) => (on[b.id] ? 1 : 0) - (on[a.id] ? 1 : 0) || String(a.name).localeCompare(String(b.name), "ru") || String(a.surname || "").localeCompare(String(b.surname || ""), "ru"));
}
export const initials = (nm) => String(nm || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
/** «Анна Смирнова» → «Анна С.». */
export const shortName = (full) => { const w = String(full || "").trim().split(/\s+/).filter(Boolean); return w.length ? w[0] + (w[1] ? " " + w[1][0].toUpperCase() + "." : "") : ""; };
/** Нагрузка официантов: у кого какие столы с гостями и сколько гостей (по имени); кто сегодня в графике, но без столов;
 *  count — id → сколько столов (для карточки стола). */
export function waiterLoad(plan, rows, staff, shiftMap) {
  const byId = Object.fromEntries(tablesOf(plan).map((t) => [t.id, t]));
  const m = {};
  (rows || []).forEach((r) => {
    if (!isBusy(r) || !r.waiter_id || !byId[r.tid]) return;
    const x = m[r.waiter_id] || (m[r.waiter_id] = { id: r.waiter_id, name: shortName(r.waiter_name) || "Без имени", tables: [], guests: 0 });
    x.tables.push(String(byId[r.tid].n)); x.guests += Number(r.cnt) || 0;
  });
  const busy = Object.values(m).map((x) => ({ ...x, tables: x.tables.sort((a, b) => a.localeCompare(b, "ru", { numeric: true })) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const on = shiftMap || {};
  const idle = (staff || []).filter((e) => e && e.id && on[e.id] && !m[e.id]).map((e) => shortName(e.name + " " + (e.surname || ""))).sort((a, b) => a.localeCompare(b, "ru"));
  return { busy, idle, count: Object.fromEntries(busy.map((x) => [x.id, x.tables.length])) };
}

/** v86: столы официанта с гостями (и со «Счётом») по доске seat_board: { n: ["4", "7"], guests, bill }; нет доски — null. */
export function myTablesOf(board, empId) {
  if (!board || board.ok !== true || !board.plan || empId == null || empId === "") return null;
  const byId = Object.fromEntries(tablesOf(board.plan).map((t) => [t.id, t]));
  const me = String(empId);
  const rows = (board.tables || []).filter((r) => isBusy(r) && String(r.waiter_id || "") === me && byId[r.tid]);
  return { n: rows.map((r) => String(byId[r.tid].n)).sort((a, b) => a.localeCompare(b, "ru", { numeric: true })),
    guests: rows.reduce((s, r) => s + (Number(r.cnt) || 0), 0), bill: rows.filter((r) => r.status === "bill").length };
}
/** Подпись пункта «Рассадка» официанту: «Твои столы: 4, 7 · 9 гостей · счёт: 1»; столов нет — "". */
export const myTablesSub = (m) => (m && m.n && m.n.length
  ? (m.n.length === 1 ? "Твой стол: " : "Твои столы: ") + m.n.join(", ") + " · " + guestsWord(m.guests) + (m.bill ? " · счёт: " + m.bill : "") : "");
