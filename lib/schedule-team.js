// lib/schedule-team.js — v220 (Доп. 546): состав смены и честный график.
//
// Четвёртое и пятое из пяти предложений по графику («И все 5 по предложениям»):
//   • в каждой смене есть опытный, новичок никогда не один: у сотрудника в графике отметка «Новичок» (staff[].newbie);
//     новичок «один», если в его часы рядом нет опытного той же должности (rules.newbieAlone, по умолчанию включено);
//   • пиковые дни (обычно пятница и суббота) поровну: доля пиковых смен у всех примерно одна (rules.peakFair);
//   • выходные парами: выходной одним днём между сменами — реже (rules.pairOff).
// Здесь — расчёты для генератора (lib/schedule-gen.js), «Проверки», листа дня и «Требует внимания».
// «.js» в путях — модуль читают и тесты в Node.

const span = (q) => [q.from, q.to <= q.from ? q.to + 24 : q.to];
/** Пересекаются ли смены по часам. */
export const overlap = (a, b) => { if (!a || !b) return false; const [a1, a2] = span(a), [b1, b2] = span(b); return a1 < b2 && b1 < a2; };

/** Правило включено: по умолчанию все три — да. */
export const ruleOn = (R, key) => !R || R[key] !== false;

/**
 * Новичок один в день d: стоит в смене, а опытного той же должности в его часы нет. plan — { id: { день: буква } },
 * shiftOf — буква → смена; смены «вручную» (кейтеринг) не в счёт. → [{ id, name, pos, k }]
 */
export function aloneOn(d, { staff, plan, shiftOf }) {
  const out = [];
  staff.forEach((s) => {
    if (!s.newbie) return;
    const k = plan[s.id] && plan[s.id][d], q = shiftOf(k);
    if (!q || q.extra) return;
    const buddy = staff.some((o) => o.id !== s.id && !o.newbie && o.pos === s.pos && (() => { const z = shiftOf(plan[o.id] && plan[o.id][d]); return z && !z.extra && overlap(z, q); })());
    if (!buddy) out.push({ id: s.id, name: s.name, pos: s.pos, k });
  });
  return out;
}
/** Все дни месяца, где новичок один: [{ id, name, pos, k, d }] по дням. */
export function aloneDays(days, ctx) {
  const out = [];
  days.forEach((d) => aloneOn(d, ctx).forEach((x) => out.push({ ...x, d })));
  return out;
}

/** Сколько смен и пиковых смен у каждого (кто отработал хотя бы 4 смены): [{ id, name, pos, work, peak }]. */
export function peakCounts({ staff, plan, shiftOf, lvlOf, DAYS }) {
  const out = [];
  staff.forEach((s) => {
    let work = 0, peak = 0;
    for (let d = 1; d <= DAYS; d++) {
      const q = shiftOf(plan[s.id] && plan[s.id][d]);
      if (!q || q.extra) continue;
      work++; if (lvlOf(d) === 3) peak++;
    }
    if (work >= 4) out.push({ id: s.id, name: s.name, pos: s.pos, work, peak });
  });
  return out;
}
/**
 * Пиковые дни неровно: внутри должности у одного доля пиковых смен заметно больше, чем у другого. Ждём у каждого
 * свою долю от пиковых смен должности по числу его смен; разошлось больше чем на 1,5 смены — неровно.
 * → [{ pos, most: { name, peak }, least: { name, peak } }]
 */
export function peakUneven(ctx) {
  const by = {};
  peakCounts(ctx).forEach((x) => { (by[x.pos] = by[x.pos] || []).push(x); });
  const out = [];
  Object.entries(by).forEach(([pos, arr]) => {
    if (arr.length < 2) return;
    const W = arr.reduce((a, x) => a + x.work, 0), P = arr.reduce((a, x) => a + x.peak, 0);
    if (!P) return;
    const dev = arr.map((x) => ({ ...x, dev: x.peak - P * x.work / W }));
    const hi = dev.reduce((a, x) => (x.dev > a.dev ? x : a)), lo = dev.reduce((a, x) => (x.dev < a.dev ? x : a));
    if (hi.dev - lo.dev > 1.5) out.push({ pos, most: { name: hi.name, peak: hi.peak }, least: { name: lo.name, peak: lo.peak } });
  });
  return out;
}

/**
 * Выходные одним днём: день без смены между двумя днями со сменой (смены «вручную» — тоже работа). Отпуск и дни, когда
 * заведение закрыто, не в счёт: их не выбирают. → число таких дней у человека.
 */
export function singleOffs(s, { plan, shiftOf, DAYS, skip = () => false }) {
  const on = (d) => !!shiftOf(plan[s.id] && plan[s.id][d]);
  let n = 0;
  for (let d = 2; d < DAYS; d++) if (!on(d) && on(d - 1) && on(d + 1) && !skip(s, d)) n++;
  return n;
}
