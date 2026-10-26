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

// ── v88 (Доп. 401): залы, стены, бар, вход ──────────────────────────────────────
// Схема v2: { v: 2, zones: [{ id, name }], tables: [{ …, z }], items: [...] }. Стена — линия по узлам сетки
// { kind: "wall", x, y, x2, y2 } (0…8 по ширине, 0…30 в глубину, только по горизонтали или вертикали) — клеток не
// занимает; бар { kind: "bar", x, y, w, h } — клетки; вход { kind: "door", x, y } — клетка. Старая схема (v1, без залов)
// — один зал «Зал»: стол без z — в первом зале. Сервер — этап 37 (floor_save проверяет то же).
export const MAX_ZONES = 6, MAX_ITEMS = 60, ZONE_NAME_MAX = 24;
export const ZONE1 = { id: "z1", name: "Зал" };
export const ITEM_KINDS = { wall: "Стена", bar: "Бар", door: "Вход" };
const itemsOf = (plan) => (plan && Array.isArray(plan.items) ? plan.items.filter((i) => i && i.id && ITEM_KINDS[i.kind]) : []);
/** Залы схемы; у старой схемы — один «Зал». */
export function zonesOf(plan) {
  const zs = plan && Array.isArray(plan.zones) ? plan.zones.filter((z) => z && z.id) : [];
  return zs.length ? zs.map((z) => ({ id: String(z.id), name: String(z.name || "").trim() || ZONE1.name })) : [ZONE1];
}
export const zone1 = (plan) => zonesOf(plan)[0].id;
/** Зал стола или предмета: свой (если такой зал есть), иначе первый. */
export function zoneOfX(plan, x) {
  const zs = zonesOf(plan);
  return x && x.z && zs.some((z) => z.id === x.z) ? x.z : zs[0].id;
}
export const zoneTables = (plan, z) => tablesOf(plan).filter((t) => zoneOfX(plan, t) === z);
export const zoneItems = (plan, z) => itemsOf(plan).filter((i) => zoneOfX(plan, i) === z);
/** Клетки, которые занимает предмет: бар — прямоугольник, вход — клетка, стена — ничего. */
export function itemCells(it) {
  if (!it) return [];
  if (it.kind === "door") return [[it.x, it.y]];
  if (it.kind !== "bar") return [];
  const out = [];
  for (let dy = 0; dy < (it.h || 1); dy++) for (let dx = 0; dx < (it.w || 1); dx++) out.push([it.x + dx, it.y + dy]);
  return out;
}

/** Занятые клетки зала (по умолчанию — первого): столы (кроме skipId), бар и вход. */
export function busyCells(plan, skipId, z) {
  const zz = z || zone1(plan), s = new Set();
  tablesOf(plan).forEach((t) => { if (t.id !== skipId && zoneOfX(plan, t) === zz) cellsOf(t).forEach(([x, y]) => s.add(key(x, y))); });
  itemsOf(plan).forEach((i) => { if (zoneOfX(plan, i) === zz) itemCells(i).forEach(([x, y]) => s.add(key(x, y))); });
  return s;
}
/** Встанет ли стол (с этой формой) в клетку x, y своего зала: в сетке и не на другом столе, баре или входе. */
export function fits(plan, t, x, y) {
  const probe = { ...t, x, y };
  const busy = busyCells(plan, t.id, zoneOfX(plan, t));
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
/** Добавить стол в клетку (4 места, квадрат); не встаёт — план как был. z — зал (у схемы с залами). */
export function addTable(plan, x, y, z) {
  const p = plan || emptyPlan();
  if (tablesOf(p).length >= MAX_TABLES) return p;
  const t = { id: newId(p), n: nextNumber(p), seats: 4, shape: "sq", x, y };
  if (z && zonesOf(p).some((q) => q.id === z) && (Array.isArray(p.zones) || z !== ZONE1.id)) t.z = z;
  return fits(p, t, x, y) ? { ...p, v: p.v || 1, tables: [...tablesOf(p), t] } : p;
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

// ── залы ──
/** Схема с залами (v2): у старой появляется зал «Зал», столы остаются в нём. */
export function withZones(plan) {
  const p = plan || emptyPlan();
  return { ...p, v: 2, zones: zonesOf(p), items: itemsOf(p), tables: tablesOf(p).map((t) => ({ ...t, z: zoneOfX(p, t) })) };
}
const zoneNameOk = (plan, name, skipId) => {
  const n = String(name || "").trim();
  return n.length >= 1 && n.length <= ZONE_NAME_MAX && !zonesOf(plan).some((z) => z.id !== skipId && z.name.toLowerCase() === n.toLowerCase());
};
export function newZoneId(plan) {
  const ids = new Set(zonesOf(plan).map((z) => z.id));
  for (let i = 2; ; i++) { const id = "z" + i.toString(36); if (!ids.has(id)) return id; }
}
/** Новый зал: имя «Зал 2», «Зал 3»… (или своё); залов не больше шести. Возвращает { plan, id } или null. */
export function addZone(plan, name) {
  const p = withZones(plan);
  if (p.zones.length >= MAX_ZONES) return null;
  let nm = String(name || "").trim();
  if (!nm) for (let i = p.zones.length + 1; ; i++) { nm = "Зал " + i; if (zoneNameOk(p, nm)) break; }
  if (!zoneNameOk(p, nm)) return null;
  const id = newZoneId(p);
  return { plan: { ...p, zones: [...p.zones, { id, name: nm }] }, id };
}
/** Переименовать зал: пустое и повторяющееся имя — план как был. */
export function renameZone(plan, id, name) {
  const p = withZones(plan);
  if (!p.zones.some((z) => z.id === id) || !zoneNameOk(p, name, id)) return plan;
  return { ...p, zones: p.zones.map((z) => (z.id === id ? { ...z, name: String(name).trim() } : z)) };
}
/** Убрать зал: только пустой (без столов и предметов) и не последний. */
export function removeZone(plan, id) {
  const p = withZones(plan);
  if (p.zones.length < 2 || zoneTables(p, id).length || zoneItems(p, id).length) return plan;
  return { ...p, zones: p.zones.filter((z) => z.id !== id) };
}

// ── стены, бар, вход ──
export function newItemId(plan) {
  const ids = new Set(itemsOf(plan).map((i) => i.id));
  for (let i = itemsOf(plan).length + 1; ; i++) { const id = "i" + i.toString(36); if (!ids.has(id)) return id; }
}
/** Стена по узлам сетки: по горизонтали или вертикали, не нулевой длины, в пределах сетки. */
export const wallOk = (x, y, x2, y2) => [x, y, x2, y2].every(Number.isInteger) && x >= 0 && x2 >= 0 && x <= GRID_W && x2 <= GRID_W && y >= 0 && y2 >= 0 && y <= GRID_H && y2 <= GRID_H
  && (x === x2) !== (y === y2);
const addItem = (plan, it) => {
  const p = withZones(plan);
  if (itemsOf(p).length >= MAX_ITEMS) return plan;
  return { ...p, items: [...itemsOf(p), { id: newItemId(p), ...it }] };
};
/** Стена в зале z от узла (x, y) до узла (x2, y2); такая уже есть — план как был. */
export function addWall(plan, z, x, y, x2, y2) {
  if (!wallOk(x, y, x2, y2)) return plan;
  const [a, b, c, d] = x === x2 ? [x, Math.min(y, y2), x2, Math.max(y, y2)] : [Math.min(x, x2), y, Math.max(x, x2), y2];
  if (itemsOf(plan).some((i) => i.kind === "wall" && zoneOfX(plan, i) === z && i.x === a && i.y === b && i.x2 === c && i.y2 === d)) return plan;
  return addItem(plan, { kind: "wall", x: a, y: b, x2: c, y2: d, z });
}
/** Бар — прямоугольник между двумя клетками; не встаёт на столы, другой бар и вход. */
export function addBar(plan, z, x, y, x2, y2) {
  const bx = Math.min(x, x2), by = Math.min(y, y2), w = Math.abs(x2 - x) + 1, h = Math.abs(y2 - y) + 1;
  if (![bx, by, w, h].every(Number.isInteger) || bx < 0 || by < 0 || bx + w > GRID_W || by + h > GRID_H) return plan;
  const busy = busyCells(plan, null, z);
  if (itemCells({ kind: "bar", x: bx, y: by, w, h }).some(([cx, cy]) => busy.has(key(cx, cy)))) return plan;
  return addItem(plan, { kind: "bar", x: bx, y: by, w, h, z });
}
/** Вход — свободная клетка. */
export function addDoor(plan, z, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= GRID_W || y >= GRID_H || busyCells(plan, null, z).has(key(x, y))) return plan;
  return addItem(plan, { kind: "door", x, y, z });
}
export const removeItem = (plan, id) => ({ ...plan, items: itemsOf(plan).filter((i) => i.id !== id) });
/** Для сервера без этапа 37 (схема v1): только если зал один и стен, бара и входа нет; иначе null. */
export function planV1(plan) {
  if (zonesOf(plan).length > 1 || itemsOf(plan).length) return null;
  return { v: 1, tables: tablesOf(plan).map(({ z, ...t }) => t) };   // eslint-disable-line no-unused-vars
}

/** Что не так со схемой (первая причина) или "". */
export function planProblem(plan) {
  const ts = tablesOf(plan), zs = zonesOf(plan);
  if (ts.length > MAX_TABLES) return "Столов больше " + MAX_TABLES;
  if (zs.length > MAX_ZONES) return "Залов больше " + MAX_ZONES;
  const names = new Set();
  for (const z of zs) {
    if (!z.name || z.name.length > ZONE_NAME_MAX) return "У зала нет названия";
    if (names.has(z.name.toLowerCase())) return "Зал «" + z.name + "» повторяется";
    names.add(z.name.toLowerCase());
  }
  if (itemsOf(plan).length > MAX_ITEMS) return "Стен, баров и входов больше " + MAX_ITEMS;
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
/** Высота сетки в клетках: до нижнего стола (и предмета) + запас строка (для редактора — ещё две). z — только этот зал. */
export function gridRows(plan, extra = 1, z) {
  const ts = z ? zoneTables(plan, z) : tablesOf(plan), its = z ? zoneItems(plan, z) : itemsOf(plan);
  const bottom = Math.max(ts.reduce((m, t) => Math.max(m, t.y + 1), 0),
    its.reduce((m, i) => Math.max(m, i.kind === "wall" ? Math.max(i.y, i.y2) : i.kind === "bar" ? i.y + (i.h || 1) : i.y + 1), 0));
  return Math.min(GRID_H, bottom + extra);
}

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
