// lib/floor-scan.js — v179 (Доп. 504): схема зала по фото плана.
//
// Владелец (20.11): «Из неудобного, как мне показалось, это само составление столов. Может добавим добавление плана зала
// по фото или что-то вроде этого?»
//   • Фото плана (чертёж, план эвакуации, схема из программы броней, рисунок от руки) ложится под сетку редактора —
//     столы ставятся поверх. Фото у каждого зала своё и лежит только на этом телефоне (lib/floor-photo.js).
//   • «Расставить столы по фото»: фото уходит в функцию floor-scan (ИИ, который видит фото). Она отвечает столами —
//     рамка стола в процентах фото, форма, сколько мест и номер, если подписан; ещё бар, входы и рамка зала.
//   • Здесь ответ ложится на сетку 8 клеток: фото обрезается по залу, вытянутое в ширину — поворачивается, если так
//     столам хватает места; стол встаёт в свою клетку, занята — в ближайшую свободную; номера — подписанные на плане,
//     остальным — следующие по порядку. Всё одним шагом: «Шаг назад» в редакторе возвращает как было.
import { GRID_W, GRID_H, MAX_TABLES, zoneOfX, zoneItems, fits, newId, inZone, nearestSpot, addBar, addDoor, emptyPlan, busyCells } from "./seating";

export const SCAN_FN = "floor-scan";
const tablesOf = (plan) => (plan && Array.isArray(plan.tables) ? plan.tables : []);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN);
const pct = (v) => Math.max(0, Math.min(100, v));

/** Как фото ложится под сетку: ширина в клетках (до 8; очень вытянутое вверх — уже, чтобы влезло в 30 рядов), отступ
 *  слева (по центру) и высота в рядах. */
export function fitBg(w, h) {
  const W = Number(w) > 0 ? Number(w) : 1, H = Number(h) > 0 ? Number(h) : 1;
  const wc = Math.min(GRID_W, (GRID_H * W) / H);
  return { wc, x0: (GRID_W - wc) / 2, rows: Math.min(GRID_H, (wc * H) / W) };
}

// ── ответ функции ───────────────────────────────────────────────────────────────────
/** Рамка [лево, верх, право, низ] в процентах: числа, по порядку, не нулевая; иначе null */
export function box4(a) {
  if (!Array.isArray(a) || a.length < 4) return null;
  const v = a.slice(0, 4).map(num);
  if (v.some((x) => !Number.isFinite(x))) return null;
  let [x1, y1, x2, y2] = v.map(pct);
  if (x2 < x1) [x1, x2] = [x2, x1];
  if (y2 < y1) [y1, y2] = [y2, y1];
  return x2 - x1 < 0.3 || y2 - y1 < 0.3 ? null : [x1, y1, x2, y2];
}
const point = (a) => {
  if (!Array.isArray(a) || a.length < 2) return null;
  const x = num(a[0]), y = num(a[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? [pct(x), pct(y)] : null;
};
/** Номер стола с плана: «№5», «Стол 5», «В3» → «5», «5», «В3»; длиннее шести знаков — нет номера */
export function tableNo(v) {
  const s = String(v == null ? "" : v).replace(/^\s*(№|n°|#|стол|table)\s*/i, "").replace(/\s+/g, "").trim();
  return s.length >= 1 && s.length <= 6 ? s : "";
}
/** Ответ функции (или модели) → { plan, box, tables: [{ b, shape, seats, n }], bars, doors, note }; мусор — null */
export function cleanScan(r) {
  if (!r || typeof r !== "object") return null;
  const tables = (Array.isArray(r.tables) ? r.tables : []).slice(0, 150).map((t) => {
    const b = box4(t && t.b);
    if (!b) return null;
    const sh = String((t && t.shape) || "").toLowerCase();
    const shape = /round|circle|oval|кругл|овал/.test(sh) ? "round" : /rect|long|прямоуг|длин/.test(sh) ? "rect" : "square";
    const s = Math.round(num(t.seats));
    return { b, shape, seats: s >= 1 && s <= 20 ? s : 0, n: tableNo(t.n) };
  }).filter(Boolean);
  const bars = (Array.isArray(r.bars) ? r.bars : []).map(box4).filter(Boolean).slice(0, 4);
  const doors = (Array.isArray(r.doors) ? r.doors : []).map(point).filter(Boolean).slice(0, 4);
  return { plan: r.plan !== false, box: box4(r.box), tables, bars, doors, note: String(r.note || "").replace(/\s+/g, " ").trim().slice(0, 200) };
}

// ── ответ на сетку ──────────────────────────────────────────────────────────────────
const cellKey = (t) => {
  const ws = t.shape === "long" ? 2 : 1, hs = t.shape === "tall" ? 2 : 1;
  return { x: Math.max(0, Math.min(GRID_W - ws, t.x)), y: Math.max(0, Math.min(GRID_H - hs, t.y)) };
};
/** Стол с плана (рамка в клетках) → форма и клетка: вытянутый в ширину — длинный (на две клетки), вытянутый вверх —
 *  вертикальный длинный (v180, если сервер его знает — tall; иначе квадратный, upright: true). res — насколько центр
 *  стола на плане не совпал с центром его клеток. */
export function snap(t, [x1, y1, x2, y2], tall = false) {
  const w = x2 - x1, h = y2 - y1, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const longish = t.shape === "rect" || t.seats >= 7;
  const up = t.shape !== "round" && longish && h >= 1.35 * w && h >= 1.2;
  const shape = t.shape === "round" ? "rd" : longish && w >= 1.35 * h && w >= 1.2 ? "long" : up && tall ? "tall" : "sq";
  const x = shape === "long" ? Math.round(cx - 1) : Math.floor(cx), y = shape === "tall" ? Math.round(cy - 1) : Math.floor(cy);
  const ex = shape === "long" ? cx - (x + 1) : cx - (x + 0.5), ey = shape === "tall" ? cy - (y + 1) : cy - (y + 0.5);
  return { shape, x, y, cx, cy, res: ex * ex + ey * ey, upright: up && !tall };
}
/**
 * Как положить план на сетку: масштаб f (0,7–1,05 от «во всю ширину»; мельче — только если иначе столы налезают друг
 * на друга или на занятое busy) и сдвиг (ox, oy) в клетках — чтобы столы стояли как можно ближе к центрам клеток, а фото
 * целиком было в сетке по ширине (frame — [левый край, ширина] фото в клетках при f = 1). boxes — [{ t, b }], рамки
 * в клетках при f = 1.
 * → { f, ox, oy, cost }; не влезает никак — f = 1 без сдвига (дальше столы ищут свободное рядом).
 */
export function bestFit(boxes, busy = new Set(), frame = [0, GRID_W], tall = false) {
  if (!boxes.length) return { f: 1, ox: 0, oy: 0, cost: 0 };
  let best = { f: 1, ox: 0, oy: 0, cost: Infinity };
  const N = boxes.length, [fx0, fw] = frame;
  for (let i = 0; i <= 14; i++) {
    const f = 0.7 + i * 0.025;
    let minY = Infinity;
    for (const q of boxes) minY = Math.min(minY, q.b[1] * f);
    const mid = (GRID_W - fw * f) / 2 - fx0 * f;   // сдвиг, при котором фото по центру по ширине
    for (let a = 0; a < 10; a++) for (let c = 0; c < 10; c++) {
      const fx = a / 10, fy = c / 10, ox = fx + Math.round(mid - fx), oy = fy + Math.max(0, Math.ceil(-(minY + fy)));
      if (fx0 * f + ox < -0.5 || (fx0 + fw) * f + ox > GRID_W + 0.5) continue;   // фото не вылезает за сетку (до полклетки)
      // мельче — только чтобы развести столы: сетка грубая, в уменьшенном плане пропадают проходы между столами
      let cost = N * (f < 1 ? 2 * (1 - f) : 0.5 * (f - 1)), out = false;
      const used = new Map();
      for (const q of boxes) {
        const s = snap(q.t, [q.b[0] * f + ox, q.b[1] * f + oy, q.b[2] * f + ox, q.b[3] * f + oy], tall);
        const ws = s.shape === "long" ? 2 : 1, hs = s.shape === "tall" ? 2 : 1;
        if (s.x < 0 || s.x + ws > GRID_W || s.y < 0 || s.y + hs > GRID_H) { out = true; break; }
        cost += s.res;
        for (let d = 0; d < ws * hs; d++) { const k = (s.x + (ws > 1 ? d : 0)) + ":" + (s.y + (hs > 1 ? d : 0)), n = (used.get(k) || 0) + 1; used.set(k, n); if (n > 1 || busy.has(k)) cost += 1000; }
        if (cost >= best.cost) break;
      }
      if (!out && cost < best.cost) best = { f, ox, oy, cost };
    }
  }
  return best.cost < Infinity ? best : { f: 1, ox: 0, oy: 0, cost: Infinity };
}
/** Столы, бар и входы (в клетках сетки, toCells переводит рамку из процентов фото) — в зал z схемы plan. */
function place(plan, z, s, toCells, { mode, items, tall }) {
  let p = plan || emptyPlan();
  if (mode === "replace") p = { ...p, tables: tablesOf(p).filter((t) => zoneOfX(p, t) !== z) };
  const list = s.tables.map((t) => ({ t, ...snap(t, toCells(t.b), tall) })).sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  let skipped = 0, moved = 0, upright = 0;
  const placed = [];
  for (const it of list) {
    if (tablesOf(p).length >= MAX_TABLES) { skipped++; continue; }
    const seats = it.t.seats || (it.shape === "long" ? 6 : 4);
    let t = inZone(p, { id: newId(p), n: "", seats, shape: it.shape, x: 0, y: 0 }, z);
    let { x, y } = cellKey({ ...t, x: it.x, y: it.y });
    let spot = fits(p, t, x, y) ? [x, y] : nearestSpot(p, t, x, y, 2);
    if (!spot && (t.shape === "long" || t.shape === "tall")) {   // длинному рядом места нет — пробуем квадратным
      t = { ...t, shape: "sq" };
      ({ x, y } = cellKey({ ...t, x: Math.floor(it.cx), y: Math.floor(it.cy) }));
      spot = fits(p, t, x, y) ? [x, y] : nearestSpot(p, t, x, y, 2);
    }
    if (!spot) { skipped++; continue; }
    if (it.upright) upright++;
    if (spot[0] !== x || spot[1] !== y) moved++;
    t = { ...t, x: spot[0], y: spot[1] };
    p = { ...p, v: p.v || 1, tables: [...tablesOf(p), t] };
    placed.push({ id: t.id, n: it.t.n });
  }
  // номера: подписанные на плане (если не повторяются), остальным — следующие по порядку
  const used = new Set(tablesOf(p).filter((t) => t.n).map((t) => String(t.n).trim().toLowerCase()));
  const nums = new Map();
  for (const q of placed) if (q.n && !used.has(q.n.toLowerCase())) { used.add(q.n.toLowerCase()); nums.set(q.id, q.n); }
  let next = Math.max(0, ...[...used].map((n) => parseInt(n, 10)).filter(Number.isFinite)) + 1;
  for (const q of placed) if (!nums.has(q.id)) { while (used.has(String(next))) next++; nums.set(q.id, String(next)); used.add(String(next)); next++; }
  p = { ...p, tables: tablesOf(p).map((t) => (nums.has(t.id) ? { ...t, n: nums.get(t.id) } : t)) };
  // бар и вход — только у схемы с залами (этап 37) и если в зале их ещё нет
  let bars = 0, doors = 0;
  if (items) {
    const has = (k) => zoneItems(p, z).some((i) => i.kind === k);
    if (!has("bar")) for (const b of s.bars.slice(0, 2)) {
      const [x1, y1, x2, y2] = toCells(b);
      const bx1 = Math.max(0, Math.min(GRID_W - 1, Math.floor(x1 + 0.25))), by1 = Math.max(0, Math.min(GRID_H - 1, Math.floor(y1 + 0.25)));
      const bx2 = Math.max(bx1, Math.min(GRID_W - 1, Math.ceil(x2 - 0.25) - 1)), by2 = Math.max(by1, Math.min(GRID_H - 1, Math.ceil(y2 - 0.25) - 1));
      const q = addBar(p, z, bx1, by1, bx2, by2);
      if (q !== p) { p = q; bars++; }
    }
    if (!has("door")) for (const d of s.doors.slice(0, 2)) {
      const [x, y] = toCells([d[0], d[1], d[0], d[1]]);
      const cx = Math.max(0, Math.min(GRID_W - 1, Math.floor(x))), cy = Math.max(0, Math.min(GRID_H - 1, Math.floor(y)));
      const q = addDoor(p, z, cx, cy);
      if (q !== p) { p = q; doors++; }
    }
  }
  return { plan: p, added: placed.length, skipped, moved, bars, doors, upright };
}

/**
 * Ответ функции → схема. img — { w, h } фото, которое видел ИИ (те же пропорции, что у подложки); z — зал;
 * mode: "add" — к столам зала, "replace" — вместо них; items — ставить ли бар и вход (сервер с этапом 37); tall —
 * ставить ли длинные столы вертикально (сервер с этапом 54; без него такие столы — квадратные, их число — upright).
 * → { plan, added, skipped, moved, bars, doors, rot (0 или 90 — повернуть фото по часовой), crop [x1, y1, x2, y2] в
 *   процентах фото (так обрезать подложку), at [x, y, w] — где лежит обрезанная подложка на сетке (в клетках) } или
 *   { empty: true, plan } — столов нет, { notPlan: true } — на фото не план.
 */
export function layoutScan(scan, img, plan, z, { mode = "add", items = true, tall = false } = {}) {
  const s = cleanScan(scan);
  if (s && s.plan === false) return { notPlan: true, plan, added: 0 };
  if (!s || !s.tables.length) return { empty: true, plan, added: 0 };
  const W0 = Number(img && img.w) > 0 ? Number(img.w) : 1000, H0 = Number(img && img.h) > 0 ? Number(img.h) : 1000;
  // обрезка: рамка зала, расширенная так, чтобы вошли все столы, бар и входы, и поля вокруг
  let [x1, y1, x2, y2] = s.box || [100, 100, 0, 0];
  for (const [a, b, c, d] of [...s.tables.map((t) => t.b), ...s.bars, ...s.doors.map(([x, y]) => [x, y, x, y])]) {
    x1 = Math.min(x1, a); y1 = Math.min(y1, b); x2 = Math.max(x2, c); y2 = Math.max(y2, d);
  }
  const m = s.box ? 1.5 : 4;
  x1 = Math.max(0, x1 - m); y1 = Math.max(0, y1 - m); x2 = Math.min(100, x2 + m); y2 = Math.min(100, y2 + m);
  if (x2 - x1 < 5) { x1 = Math.max(0, x1 - 5); x2 = Math.min(100, x2 + 5); }
  if (y2 - y1 < 5) { y1 = Math.max(0, y1 - 5); y2 = Math.min(100, y2 + 5); }
  const crop = [x1, y1, x2, y2].map((v) => Math.round(v * 100) / 100);
  const cw = ((crop[2] - crop[0]) / 100) * W0, ch = ((crop[3] - crop[1]) / 100) * H0;
  const px = ([a, b, c, d]) => [((a - crop[0]) / 100) * W0, ((b - crop[1]) / 100) * H0, ((c - crop[0]) / 100) * W0, ((d - crop[1]) / 100) * H0];
  // занятое в зале: при «Добавить» — столы и предметы, при «Вместо них» — только бар и вход
  const p0 = plan || emptyPlan();
  const busy = busyCells(mode === "replace" ? { ...p0, tables: tablesOf(p0).filter((t) => zoneOfX(p0, t) !== z) } : p0, null, z);
  const run = (rot) => {
    const W = rot ? ch : cw, H = rot ? cw : ch;
    const { wc, x0 } = fitBg(W, H), k = W / wc;   // точек фото в клетке
    const turn = (q) => (rot ? [ch - q[3], q[0], ch - q[1], q[2]] : q);   // поворот на 90° по часовой
    const base = (b) => { const [a, bb, c, d] = turn(px(b)); return [a / k + x0, bb / k, c / k + x0, d / k]; };
    const fit = bestFit(s.tables.map((t) => ({ t, b: base(t.b) })), busy, [x0, wc], tall);
    const toCells = (b) => { const q = base(b); return [q[0] * fit.f + fit.ox, q[1] * fit.f + fit.oy, q[2] * fit.f + fit.ox, q[3] * fit.f + fit.oy]; };
    const r = place(plan, z, s, toCells, { mode, items, tall });
    return { ...r, rot, fit, at: [x0 * fit.f + fit.ox, fit.oy, wc * fit.f].map((v) => Math.round(v * 1000) / 1000) };
  };
  const r0 = run(0);
  // вытянутое в ширину фото на узком экране: повёрнутым столам часто просторнее — берём, если так меньше потерь и сдвигов
  const r1 = cw > ch * 1.15 ? run(90) : null;
  const bad = (r) => r.skipped * 1000 + r.moved * 10;
  return { ...(r1 && bad(r1) < bad(r0) ? r1 : r0), crop };
}

// ── запрос к функции ────────────────────────────────────────────────────────────────
/** Отправить фото (data: URL с сеткой) в floor-scan. Ответ функции как есть или { ok: false, error }:
 *  no_function — функции нет (404), timeout, network — нет связи (или функция не развёрнута: тогда браузер тоже
 *  не получает ответа). */
export async function scanFloor(image, { url, key, token, timeoutMs = 120000, fetchImpl } = {}) {
  const f = fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!f) return { ok: false, error: "network" };
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const tm = ctl ? setTimeout(() => { try { ctl.abort(); } catch (e) { /* */ } }, timeoutMs) : null;
  try {
    const r = await f(String(url || "").replace(/\/+$/, "") + "/functions/v1/" + SCAN_FN, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: key, Authorization: "Bearer " + key },
      body: JSON.stringify({ token, image }), ...(ctl ? { signal: ctl.signal } : {}),
    });
    let j = null;
    try { j = await r.json(); } catch (e) { /* не JSON */ }
    if (j && typeof j === "object" && (j.ok === true || j.error)) return j;
    if (r.status === 404) return { ok: false, error: "no_function" };
    return { ok: false, error: r.ok ? "bad_reply" : "http" };
  } catch (e) {
    return { ok: false, error: e && e.name === "AbortError" ? "timeout" : "network" };
  } finally { if (tm) clearTimeout(tm); }
}

const SETUP = "Руководителю: supabase/README.md, раздел «v179». Пока можно расставить столы поверх фото вручную.";
/** Почему не вышло — по-человечески */
export function scanErrorText(err) {
  switch (err) {
    case "auth": return "Вход устарел: закрой и открой приложение.";
    case "forbidden": return "Расставлять столы по фото может руководитель или старший.";
    case "daily_limit": return "На сегодня распознаваний больше нет. Завтра можно снова, а пока расставь столы поверх фото вручную.";
    case "not_configured": return "ИИ на сервере не настроен: нет ключа OpenRouter. " + SETUP;
    case "no_vision": return "Модель ИИ на сервере не принимает фото. Руководителю: в секрете FLOOR_MODEL (или OPENROUTER_MODEL) нужна модель с фото, например anthropic/claude-haiku-5.5.";
    case "too_large": return "Фото слишком большое. Сними план ещё раз.";
    case "no_function": return "На сервере ещё нет функции floor-scan. " + SETUP;
    case "timeout": return "ИИ думал слишком долго. Попробуй ещё раз или сними план крупнее.";
    case "network": return "Сервер не ответил: нет связи или на нём ещё нет функции floor-scan. " + SETUP;
    case "not_plan": return "Это не похоже на план зала. Сфотографируй схему сверху: чертёж, план эвакуации или рисунок от руки.";
    case "empty": return "Столов на фото не нашёл. Сними план ровнее и крупнее или расставь столы вручную.";
    case "rate_limit": return "ИИ сейчас занят. Попробуй через минуту.";
    default: return "ИИ не справился с этим фото. Попробуй ещё раз или расставь столы поверх фото вручную.";
  }
}
/** Итог раскладки одной строкой: «Расставил 12 столов по фото, 2 сдвинул на соседнюю клетку…» */
export function scanSummary(r) {
  const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
  const parts = ["Расставил " + r.added + " " + pl(r.added, "стол", "стола", "столов") + " по фото"];
  if (r.bars || r.doors) parts.push([r.bars ? "бар" : "", r.doors ? (r.doors > 1 ? "входы" : "вход") : ""].filter(Boolean).join(" и "));
  let s = parts.join(", ") + ".";
  if (r.moved) s += " " + r.moved + " " + pl(r.moved, "стол встал", "стола встали", "столов встали") + " на соседнюю клетку: рядом было занято.";
  if (r.skipped) s += " " + r.skipped + " не " + pl(r.skipped, "поместился", "поместились", "поместились") + " на сетке: поставь вручную.";
  if (r.upright) s += " " + r.upright + " " + pl(r.upright, "длинный стол стоит", "длинных стола стоят", "длинных столов стоят") + " на плане вертикально: поставил квадратными, вертикальные появятся с этапом 54 на сервере.";
  return s + " Проверь номера и места. Если не так, нажми «Шаг назад».";
}
