// lib/schedule-days.js — v214 (Доп. 540): закрытые дни заведения и тип дня на дату.
//
// Закрыто бывает каждую неделю — rules.closedDows (дни недели с понедельника: 0 — пн … 6 — вс, их ставят в «Часах
// работы») — и отдельной датой: пометка дня месяца days[d].closed. true закрывает дату (санитарный день, 1 января),
// false открывает день, который по неделе выходной (банкет в понедельник). Закрытый день — уровень 0: потребности нет,
// генератор туда никого не ставит, «Проверка» и полоска месяца не ищут там дыр.
//
// Ручной тип дня days[d].lvl (1 обычный, 2 высокий, 3 пиковый) был в данных и раньше, его читали и экран, и утренняя
// сводка на сервере, но выставить его было негде. Теперь — в листе дня, тапом по числу в шапке таблицы.

export const DOW_EVERY = ["каждый понедельник", "каждый вторник", "каждую среду", "каждый четверг", "каждую пятницу", "каждую субботу", "каждое воскресенье"];

/** Закрыто ли заведение по неделе в этот день недели. */
export const closedByRule = (rules, w) => Array.isArray(rules && rules.closedDows) && rules.closedDows.includes(w);

/** ctx: { rules, days, dow, holName, levels } — то же, чем считал уровень дня экран графика. */
export function isClosed(ctx, d) {
  const o = ctx.days && ctx.days[d];
  if (o && typeof o.closed === "boolean") return o.closed;
  return closedByRule(ctx.rules, ctx.dow(d));
}

/** Тип дня по правилам, без пометки даты: праздник, пиковые и высокие дни недели. */
export function ruleLevel(ctx, d) {
  const R = ctx.rules || {};
  if (ctx.holName && ctx.holName(d) && R.holidayPeak) return 3;
  const w = ctx.dow(d);
  if ((R.peakDows || []).includes(w)) return 3;
  if (ctx.levels === 3 && (R.highDows || []).includes(w)) return 2;
  return 1;
}

/** Тип дня целиком: 0 — закрыто, дальше 1–3. Пометка «высокий» при двух уровнях читается как пик. */
export function dayLevel(ctx, d) {
  if (isClosed(ctx, d)) return 0;
  const o = ctx.days && ctx.days[d];
  if (o && o.lvl) return (o.lvl === 2 && ctx.levels === 2) ? 3 : o.lvl;
  return ruleLevel(ctx, d);
}

/** Есть ли у даты своя пометка типа (закрыто, открыто, уровень). */
export const dayMarked = (days, d) => { const o = days && days[d]; return !!(o && (typeof o.closed === "boolean" || o.lvl)); };

/**
 * Пометка дня после выбора в листе дня. t: 1 | 2 | 3 | "closed" | null (как в правилах). Совпало с правилами —
 * пометку не храним: поменяют правила, и день пойдёт за ними. Заметка ко дню и прочие поля остаются.
 * → новый объект дня или null, если в нём ничего не осталось.
 */
export function markDayType(ctx, d, t) {
  const o = { ...((ctx.days && ctx.days[d]) || {}) };
  delete o.closed; delete o.lvl;
  const rc = closedByRule(ctx.rules, ctx.dow(d));
  if (t === "closed") { if (!rc) o.closed = true; }
  else if (t === 1 || t === 2 || t === 3) {
    if (rc) o.closed = false;
    if (t !== ruleLevel(ctx, d)) o.lvl = t;
  }
  return Object.keys(o).length ? o : null;
}

/** Откуда тип дня, одной строкой для листа дня. */
export function dayTypeWhy(ctx, d) {
  const w = ctx.dow(d), every = DOW_EVERY[w] || "";
  if (dayMarked(ctx.days, d)) {
    const o = ctx.days[d];
    if (o.closed === true) return "Закрыто только в эту дату";
    if (o.closed === false && !o.lvl) return "Открыты в эту дату, хотя " + every + " закрыто";
    return "Своя пометка на эту дату";
  }
  if (closedByRule(ctx.rules, w)) return "Закрыто " + every + ": так в «Часах работы»";
  const R = ctx.rules || {};
  if (ctx.holName && ctx.holName(d) && R.holidayPeak) return "Праздник: по правилам это пик";
  const lv = ruleLevel(ctx, d);
  if (lv === 3) return "Пик по правилам: " + every;
  if (lv === 2) return "Высокий по правилам: " + every;
  return "";
}

/** Сколько дней месяца заведение открыто. */
export function openDays(ctx, DAYS) {
  let n = 0;
  for (let d = 1; d <= DAYS; d++) if (!isClosed(ctx, d)) n++;
  return n;
}
