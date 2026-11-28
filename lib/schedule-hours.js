// lib/schedule-hours.js — v219 (Доп. 545): сколько людей нужно по часам, «Часы пик».
//
// Третье из пяти предложений по графику. Потребность была на день целиком: «6 официантов», а какие у них смены — решала
// разбивка («Д:5, В:1»), которую считали в уме. Но людей нужно не «в день», а в часы: с 12 до 15 обед, с 19 до 22 зал
// полный. Теперь у должности есть строки «с 19 до 22 не меньше 6» (на нужные дни недели), и приложение само считает, кого
// в какую смену ставить, чтобы в каждый такой час людей хватало, с наименьшим числом часов.
//
// config.hourNeed = { должность: [{ from, to, n, dows }] }: from и to — часы (после полуночи — 25, 26), n — сколько
// человек нужно в эти часы, dows — дни недели с понедельника (0–6), пусто — все дни.
// Число людей дня — не меньше потребности дня (по типу дня или по дням недели) и не меньше того, что нужно для часов пик.
// Если в какой-то час пик не выходит ни одна смена (зал с 12, а час пик с 10), этот час не в счёт: ok = false.
// «.js» в путях — модуль читают и тесты в Node.
import { dayLevel, dayNeed, dayHours, hoursOn, shiftFits } from "./schedule-days.js";

/** Часы смены или строки с переходом через полночь: [с, до], до > с (до 2:00 ночи — 26). */
export const span = (from, to) => [from, to <= from ? to + 24 : to];
/** Смена выходит на час h (h — от полуночи дня; 25 — час ночи). */
export const covers = (sh, h) => { const [f, t] = span(sh.from, sh.to); return h >= f && h < t; };

const okHour = (v) => Number.isInteger(v) && v >= 0 && v <= 30;
/** Строки «Часов пик» должности на день недели w (0 — пн), годные: [{ from, to, n }]. */
export function hourRows(cfg, pos, w) {
  const list = cfg && cfg.hourNeed && Array.isArray(cfg.hourNeed[pos]) ? cfg.hourNeed[pos] : [];
  return list.filter((r) => r && okHour(r.from) && okHour(r.to) && r.from !== r.to && Number.isInteger(r.n) && r.n > 0
      && (!Array.isArray(r.dows) || !r.dows.length || r.dows.includes(w)))
    .map((r) => ({ from: r.from, to: r.to, n: r.n }));
}

const CACHE = new Map();
/**
 * Кого в какую смену поставить, чтобы в часы пик хватало людей: { total, by: { буква: сколько }, ok }.
 * shifts — смены дня (без «вручную»), rows — строки часов пик, base — сколько людей нужно в день и так, dflt — как их
 * ставят без часов пик ({ буква: сколько }: разбивка или все в основную), dayK — основная смена, open — часы работы дня
 * [с, до] (часы пик вне них не в счёт). Нет строк — null.
 * Перебор: людей от наибольшего из (base, самый большой час пик) и вверх, пока не закроются все часы; среди вариантов с
 * этим числом людей — ближе всего к обычной расстановке (часы пик только поправляют её), потом меньше часов.
 */
export function hourCover({ shifts, rows, base = 0, dayK = null, open = null, dflt = null }) {
  if (!Array.isArray(rows) || !rows.length || !Array.isArray(shifts) || !shifts.length) return null;
  const def = dflt || (dayK ? { [dayK]: base } : {});
  const key = JSON.stringify([shifts.map((s) => [s.k, s.from, s.to]), rows, base, dayK, open, def]);
  if (CACHE.has(key)) return CACHE.get(key);
  // сколько людей нужно в каждый час
  const want = {};
  const [o, c] = open ? span(open[0], open[1]) : [0, 48];
  rows.forEach((r) => { const [f, t] = span(r.from, r.to); for (let h = Math.max(f, o); h < Math.min(t, c); h++) want[h] = Math.max(want[h] || 0, r.n); });
  let ok = true;
  const hours = Object.keys(want).map(Number).filter((h) => { const any = shifts.some((s) => covers(s, h)); if (!any) ok = false; return any; });
  const len = (s) => span(s.from, s.to)[1] - s.from;
  const S = shifts.length, top = hours.reduce((m, h) => Math.max(m, want[h]), 0);
  let best = null;
  if (!hours.length) best = { total: base, by: {} };
  const cnt = new Array(S).fill(0);
  const tryT = (T) => {
    let found = null;
    const rec = (i, left) => {
      if (i === S - 1) {
        cnt[i] = left;
        for (const h of hours) { let n = 0; for (let j = 0; j < S; j++) if (cnt[j] && covers(shifts[j], h)) n += cnt[j]; if (n < want[h]) return; }
        let hrs = 0, dev = 0;
        for (let j = 0; j < S; j++) { hrs += cnt[j] * len(shifts[j]); dev += Math.abs(cnt[j] - (def[shifts[j].k] || 0)); }
        if (!found || dev < found.dev || (dev === found.dev && hrs < found.hrs)) found = { hrs, dev, c: cnt.slice() };
        return;
      }
      for (let x = left; x >= 0; x--) { cnt[i] = x; rec(i + 1, left - x); }
    };
    rec(0, T);
    return found;
  };
  for (let T = Math.max(base, top); !best && T <= Math.max(base, top) + 24; T++) {
    const f = tryT(T);
    if (f) { const by = {}; f.c.forEach((n, j) => { if (n) by[shifts[j].k] = n; }); best = { total: T, by }; }
  }
  const out = best ? { ...best, ok } : { total: base, by: {}, ok: false };
  if (CACHE.size > 500) CACHE.clear();
  CACHE.set(key, out);
  return out;
}

/**
 * Часы пик дня d по должностям: { должность: { total, by, ok, rows } }. ctx — как у lib/schedule-days.js (dow, iso,
 * rules, days, dates, levels), cfg — настройки заведения. Закрыто — {}. Смены — только те, что подходят под свои часы
 * «Особого дня» (shiftFits), часы пик вне часов работы дня не в счёт.
 */
export function hourPlan(ctx, cfg, d) {
  if (!cfg || !cfg.hourNeed || !dayLevel(ctx, d)) return {};
  const w = ctx.dow(d), own = dayHours(ctx, d), open = hoursOn(ctx, d, cfg.hours);
  const shifts = (cfg.shifts || []).filter((s) => !s.extra && shiftFits(own, s));
  const base = dayNeed(ctx, cfg, d), out = {}, lv = dayLevel(ctx, d);
  const dayK = (cfg.dayShift && shifts.some((s) => s.k === cfg.dayShift)) ? cfg.dayShift
    : ((shifts.slice().sort((a, b) => (span(b.from, b.to)[1] - b.from) - (span(a.from, a.to)[1] - a.from))[0]) || {}).k || null;
  Object.keys(cfg.hourNeed).forEach((pos) => {
    const rows = hourRows(cfg, pos, w);
    if (!rows.length) return;
    const n = base[pos] || 0;
    const cv = hourCover({ shifts, rows, base: n, dayK, open, dflt: defaultBy(cfg, pos, lv, n, shifts, dayK) });
    if (cv && Object.keys(cv.by).length) out[pos] = { ...cv, rows };
  });
  return out;
}

/** Как ставят людей должности без часов пик: разбивка по сменам (на тип дня или одна на все дни), остаток — в основную
 *  смену; как daySlots в lib/schedule-gen.js. */
export function defaultBy(cfg, pos, lv, n, shifts, dayK) {
  const spRaw = (cfg.split || {})[pos];
  const byLvl = spRaw && Object.keys(spRaw).length > 0 && Object.keys(spRaw).every((k) => k === "1" || k === "2" || k === "3");
  const sp = (byLvl ? (spRaw[String(lv)] || spRaw["1"] || null) : spRaw) || {};
  const ok = Object.entries(sp).filter(([k, v]) => v > 0 && shifts.some((s) => s.k === k));
  const out = {};
  if (ok.length) {
    const mainK = ok.slice().sort((a, b) => b[1] - a[1])[0][0];
    let left = n;
    ok.filter(([k]) => k !== mainK).forEach(([k, v]) => { const t = Math.min(v, left); if (t) out[k] = t; left -= t; });
    if (left > 0) out[mainK] = (out[mainK] || 0) + left;
  } else if (dayK && n) out[dayK] = n;
  return out;
}

/** Сколько людей должности стоит в час h дня d: смены «вручную» (кейтеринг) не в счёт. */
export const haveAt = ({ staff, plan, shiftOf }, d, pos, h) =>
  staff.filter((s) => { const q = s.pos === pos && shiftOf(plan[s.id] && plan[s.id][d]); return q && !q.extra && covers(q, h); }).length;

/** Сколько людей должности стоит в часы строки r дня d — наименьшее за эти часы (часы работы дня — open); null, если
 *  строка целиком вне часов работы. */
export function hourHave(ctx, d, pos, r, open = null) {
  const [f, t] = span(r.from, r.to), [o, c] = open ? span(open[0], open[1]) : [0, 48];
  let have = Infinity;
  for (let h = Math.max(f, o); h < Math.min(t, c); h++) have = Math.min(have, haveAt(ctx, d, pos, h));
  return have === Infinity ? null : have;
}

/** Часы пик дня, где людей меньше нужного: [{ from, to, n, have }] — have — наименьшее за эти часы. */
export function hourGaps(ctx, d, pos, rows, open = null) {
  const out = [];
  (rows || []).forEach((r) => {
    const [f, t] = span(r.from, r.to), [o, c] = open ? span(open[0], open[1]) : [0, 48];
    let have = Infinity;
    for (let h = Math.max(f, o); h < Math.min(t, c); h++) have = Math.min(have, haveAt(ctx, d, pos, h));
    if (have !== Infinity && have < r.n) out.push({ from: r.from, to: r.to, n: r.n, have });
  });
  return out;
}

/** Для «Требует внимания»: [{ pos, days: [{ d, from, to, miss }] }] — где в часы пик не хватает людей. */
export function hourHolesIn(days, { staff, plan, shiftOf, POS, planOf, openOf }) {
  const out = [];
  POS.forEach(({ id: pos, t }) => {
    const list = [];
    days.forEach((d) => {
      const hp = planOf(d)[pos];
      if (!hp) return;
      const g = hourGaps({ staff, plan, shiftOf }, d, pos, hp.rows, openOf ? openOf(d) : null)[0];
      if (g) list.push({ d, from: g.from, to: g.to, miss: g.n - g.have });
    });
    if (list.length) out.push({ pos, title: t, days: list });
  });
  return out;
}

/** «с 19 до 22», после полуночи — «до 2». */
export const hoursLabel = (from, to) => `с ${from > 24 ? from - 24 : from} до ${to > 24 ? to - 24 : to}`;
