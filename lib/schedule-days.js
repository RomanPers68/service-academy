// lib/schedule-days.js — v214 (Доп. 540): закрытые дни заведения и тип дня на дату.
//
// Закрыто бывает каждую неделю — rules.closedDows (дни недели с понедельника: 0 — пн … 6 — вс, их ставят в «Часах
// работы») — и отдельной датой: пометка дня месяца days[d].closed. true закрывает дату (санитарный день, 1 января),
// false открывает день, который по неделе выходной (банкет в понедельник). Закрытый день — уровень 0: потребности нет,
// генератор туда никого не ставит, «Проверка» и полоска месяца не ищут там дыр.
//
// Ручной тип дня days[d].lvl (1 обычный, 2 высокий, 3 пиковый) был в данных и раньше, его читали и экран, и утренняя
// сводка на сервере, но выставить его было негде. Теперь — в листе дня, тапом по числу в шапке таблицы.
//
// v216 (Доп. 542): «Особые дни» — config.dates заведения: { "ГГГГ-ММ-ДД": { closed, hours: [с, до], lvl, need, note } }.
// Владелец: «ресторан не работает только 31 декабря и 1-го января. А 2-го не с 11, а с 16 ти работает». Даты живут в
// настройках, а не в месяце: их ставят на год вперёд, не листая месяцы. Лист дня пишет туда же. Порядок: «Особые дни»
// главнее пометки дня в месяце (v214), та — главнее дней недели. ctx.iso(d) — дата дня месяца «ГГГГ-ММ-ДД».
// Сколько людей нужно: по уровню дня (как раньше) или по дням недели (rules.needMode = "dows", config.needDow —
// { должность: [пн … вс] }); need особого дня — поверх, по должностям.

export const DOW_EVERY = ["каждый понедельник", "каждый вторник", "каждую среду", "каждый четверг", "каждую пятницу", "каждую субботу", "каждое воскресенье"];

/** Закрыто ли заведение по неделе в этот день недели. */
export const closedByRule = (rules, w) => Array.isArray(rules && rules.closedDows) && rules.closedDows.includes(w);

/** Запись «Особых дней» для дня месяца (или null). */
export const dateOf = (ctx, d) => {
  const ds = ctx.dates, k = ctx.iso ? ctx.iso(d) : null;
  const o = ds && k && typeof ds === "object" ? ds[k] : null;
  return o && typeof o === "object" ? o : null;
};

/** ctx: { rules, days, dates, iso, dow, holName, levels } — то же, чем считал уровень дня экран графика. */
export function isClosed(ctx, d) {
  const x = dateOf(ctx, d);
  if (x && typeof x.closed === "boolean") return x.closed;
  const o = ctx.days && ctx.days[d];
  if (o && typeof o.closed === "boolean") return o.closed;
  return closedByRule(ctx.rules, ctx.dow(d));
}

/** Тип дня по правилам, без пометок даты: праздник, пиковые и высокие дни недели. */
export function ruleLevel(ctx, d) {
  const R = ctx.rules || {};
  if (ctx.holName && ctx.holName(d) && R.holidayPeak) return 3;
  const w = ctx.dow(d);
  if ((R.peakDows || []).includes(w)) return 3;
  if (ctx.levels === 3 && (R.highDows || []).includes(w)) return 2;
  return 1;
}

const lvlFix = (ctx, l) => ((l === 2 && ctx.levels === 2) ? 3 : l);

/** Тип дня целиком: 0 — закрыто, дальше 1–3. Пометка «высокий» при двух уровнях читается как пик. */
export function dayLevel(ctx, d) {
  if (isClosed(ctx, d)) return 0;
  const x = dateOf(ctx, d);
  if (x && x.lvl) return lvlFix(ctx, x.lvl);
  const o = ctx.days && ctx.days[d];
  if (o && o.lvl) return lvlFix(ctx, o.lvl);
  return ruleLevel(ctx, d);
}

/** Есть ли у даты своя пометка типа (в «Особых днях» или старая пометка месяца). */
export const dayMarked = (days, d, ctx = null) => {
  const x = ctx ? dateOf(ctx, d) : null;
  if (x && (typeof x.closed === "boolean" || x.lvl)) return true;
  const o = days && days[d];
  return !!(o && (typeof o.closed === "boolean" || o.lvl));
};

/**
 * Запись «Особых дней» после выбора в листе дня. t: 1 | 2 | 3 | "closed" | null (как в правилах). Совпало с тем, каким
 * день был бы без неё, — пометку не храним. Часы, люди и подпись даты остаются. → новая запись или null.
 * Без ctx.iso — как в v214: пометка месяца days[d]. Старую пометку месяца лист дня снимает (v216), поэтому «каким был
 * бы день» считаем и без неё: иначе выбор «пик» на дне со старым «пиком» не оставлял бы ничего, и день становился
 * обычным.
 */
export function markDayType(ctx, d, t) {
  const legacy = !ctx.iso;
  const cur = (legacy ? ctx.days && ctx.days[d] : dateOf(ctx, d)) || {};
  const rest = { ...cur }; delete rest.closed; delete rest.lvl;
  const days = stripMarks(ctx.days, d);
  const bare = legacy ? { ...ctx, days } : { ...ctx, days, dates: { ...(ctx.dates || {}), [ctx.iso(d)]: rest } };
  const baseClosed = isClosed(bare, d), baseLvl = dayLevel({ ...bare, rules: { ...(ctx.rules || {}), closedDows: [] } }, d);
  const out = { ...rest };
  if (t === "closed") { if (!baseClosed) out.closed = true; }
  else if (t === 1 || t === 2 || t === 3) {
    if (baseClosed) out.closed = false;
    if (lvlFix(ctx, t) !== baseLvl) out.lvl = t;
  }
  return Object.keys(out).length ? out : null;
}
const stripMarks = (days, d) => { if (!days || !days[d]) return days; const o = { ...days[d] }; delete o.closed; delete o.lvl; return { ...days, [d]: o }; };

/** Откуда тип дня, одной строкой для листа дня. */
export function dayTypeWhy(ctx, d) {
  const w = ctx.dow(d), every = DOW_EVERY[w] || "";
  const x = dateOf(ctx, d);
  if (x && (typeof x.closed === "boolean" || x.lvl)) {
    if (x.closed === true) return "Закрыто в эту дату: так в «Особых днях»";
    if (x.closed === false && !x.lvl) return "Открыты в эту дату, хотя " + every + " закрыто";
    return "Своя пометка на эту дату";
  }
  const o = ctx.days && ctx.days[d];
  if (o && (typeof o.closed === "boolean" || o.lvl)) {
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

/** Свои часы даты из «Особых дней» ([с, до], до может быть 25–30: после полуночи) или null. */
export function dayHours(ctx, d) {
  const x = dateOf(ctx, d), h = x && x.hours;
  if (!Array.isArray(h) || h.length !== 2) return null;
  const a = Number(h[0]), b = Number(h[1]);
  return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && a <= 23 && b >= 1 && b <= 30 && a !== b ? [a, b] : null;
}
/** Часы дня: свои из «Особых дней» или по дню недели. */
export const hoursOn = (ctx, d, weekHours) => dayHours(ctx, d) || (Array.isArray(weekHours) && weekHours[ctx.dow(d)]) || [12, 24];

/**
 * Подходит ли смена под свои часы даты: приходят не раньше чем за час до открытия и до закрытия. Открываемся в 16 —
 * «Вечер» с 16 подходит, «День» с 12 — нет (владелец: «2-го не с 11, а с 16»). Обычные дни не трогаем: там смены
 * давно подобраны под часы, и «Утро» с 10 при открытии в 12 — обычная подготовка зала.
 */
export function shiftFits(hours, sh) {
  if (!hours || !sh) return true;
  const [o, c0] = hours, c = c0 <= o ? c0 + 24 : c0;
  return sh.from >= o - 1 && sh.from < c;
}

/**
 * Сколько людей нужно в день d по должностям. cfg — настройки заведения. Закрыто — {}. По уровню дня (как раньше) или
 * по дням недели (rules.needMode = "dows"); need из «Особых дней» — поверх, по должностям.
 */
export function dayNeed(ctx, cfg, d) {
  const lv = dayLevel(ctx, d);
  if (!lv) return {};
  let base;
  const R = (cfg && cfg.rules) || {};
  if (R.needMode === "dows" && cfg.needDow && typeof cfg.needDow === "object") {
    base = {};
    const w = ctx.dow(d);
    for (const [pos, arr] of Object.entries(cfg.needDow)) if (Array.isArray(arr)) { const n = Number(arr[w]); if (n > 0) base[pos] = n; }
  } else base = { ...(((cfg && cfg.need) || {})[lv] || {}) };
  const x = dateOf(ctx, d);
  if (x && x.need && typeof x.need === "object") for (const [pos, n] of Object.entries(x.need)) { const v = Number(n); if (v >= 0) base[pos] = v; }
  return base;
}

/** needDow из потребности по уровням: сколько было бы в каждый день недели (для перехода «по дням недели»). */
export function needDowFrom(ctx, cfg, posIds) {
  const out = {};
  for (const pos of posIds) out[pos] = [0, 1, 2, 3, 4, 5, 6].map((w) => {
    const R = ctx.rules || {};
    const lv = closedByRule(R, w) ? 1 : (R.peakDows || []).includes(w) ? 3 : (ctx.levels === 3 && (R.highDows || []).includes(w)) ? 2 : 1;
    return Number((((cfg && cfg.need) || {})[lv] || {})[pos]) || 0;
  });
  return out;
}

/** Особые дни по порядку, начиная с fromIso: [{ iso, ...запись }]. */
export function datesList(dates, fromIso = "") {
  return Object.entries(dates && typeof dates === "object" ? dates : {})
    .filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && v && typeof v === "object" && k >= fromIso)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([iso, v]) => ({ iso, ...v }));
}
