// lib/schedule-attn.js — «Требует внимания» в графике руководителя (v46, Доп. 359).
// Раньше дыры и замечания жили в свёрнутой секции «Проверка и зарплата» в самом низу, а недобор в таблице —
// цифрами «0/1» среди «1/1». Теперь наверху одна карточка: где не хватает людей в ближайшие дни, кто
// отметил «не смогу выйти», а смена стоит, и какие обмены ждут решения. Здесь — чистые расчёты для неё
// и для плашки «Сохранить» (сколько клеток изменено с последнего сохранения).

// Окно карточки: текущий месяц — сегодня и шесть дней вперёд (в пределах месяца), будущий — весь месяц,
// прошлый — ничего (его уже не поправить)
export function attnDays({ Y, M, DAYS, now = new Date() }) {
  const cur = new Date(now.getFullYear(), now.getMonth()), view = new Date(Y, M);
  if (view < cur) return [];
  const from = view > cur ? 1 : now.getDate(), to = view > cur ? DAYS : Math.min(DAYS, now.getDate() + 6);
  const out = [];
  for (let d = from; d <= to; d++) out.push(d);
  return out;
}

// Сколько людей позиции стоит в смене (дополнительные смены вроде кейтеринга не в счёт — как в таблице)
const haveOf = (d, pos, { staff, plan, shiftOf }) =>
  staff.filter((s) => { const sh = s.pos === pos && shiftOf(plan[s.id] && plan[s.id][d]); return sh && !sh.extra; }).length;

// Недобор по позициям: [{ pos, title, days: [{ d, miss }] }] — в порядке позиций, дни по возрастанию
export function holesIn(days, { staff, plan, POS, needOf, shiftOf }) {
  const out = [];
  POS.forEach(({ id: pos, t }) => {
    const list = [];
    days.forEach((d) => { const n = (needOf(d) || {})[pos] || 0; if (!n) return; const h = haveOf(d, pos, { staff, plan, shiftOf }); if (h < n) list.push({ d, miss: n - h }); });
    if (list.length) out.push({ pos, title: t, days: list });
  });
  return out;
}

// «Не смогу выйти», а смена стоит: [{ id, name, d, k }]
export function conflictsIn(days, { staff, plan, hardOff, shiftOf }) {
  const out = [];
  staff.forEach((s) => (hardOff[s.id] || []).forEach((d) => {
    if (!days.includes(d)) return;
    const k = plan[s.id] && plan[s.id][d];
    if (shiftOf(k)) out.push({ id: s.id, name: s.name, d, k });
  }));
  return out.sort((a, b) => a.d - b.d);
}

// Какую смену ставить в дыру: сначала по разбивке позиции (сколько человек какой смены ждали в этот день),
// остаток — основная смена. Так же раскладывает дыры карточка «Сегодня» и генератор.
export function holeShiftOf({ d, pos, cfg, lvlOf, staff, plan, shiftOf }) {
  const auto = (cfg.shifts || []).filter((z) => !z.extra);
  if (!auto.length) return null;
  const base = (cfg.dayShift && auto.find((z) => z.k === cfg.dayShift)) || auto[0];
  const sp = (cfg.split || {})[pos];
  const map = sp ? (Object.keys(sp).some((k) => /^[0-9]+$/.test(k)) ? (sp[String(lvlOf(d))] || {}) : sp) : {};
  for (const z of auto) {
    const want = map[z.k] || 0; if (!want) continue;
    const have = staff.filter((q) => q.pos === pos && plan[q.id] && plan[q.id][d] === z.k).length;
    if (have < want) return z;
  }
  return base;
}

// Сколько клеток расстановки отличается от сохранённой; пометки дней и факт часов — тоже по штуке
export function planChanges(saved, cur, DAYS) {
  if (!saved) return 0;
  let n = 0;
  const ids = new Set([...Object.keys(saved.plan || {}), ...Object.keys(cur.plan || {})]);
  ids.forEach((id) => { const a = (saved.plan || {})[id] || {}, b = (cur.plan || {})[id] || {}; for (let d = 1; d <= DAYS; d++) if ((a[d] || "") !== (b[d] || "")) n++; });
  const fIds = new Set([...Object.keys(saved.facts || {}), ...Object.keys(cur.facts || {})]);
  fIds.forEach((id) => { const a = (saved.facts || {})[id] || {}, b = (cur.facts || {})[id] || {}; for (let d = 1; d <= DAYS; d++) if (a[d] !== b[d]) n++; });
  for (let d = 1; d <= DAYS; d++) if (JSON.stringify((saved.days || {})[d] || null) !== JSON.stringify((cur.days || {})[d] || null)) n++;
  return n;
}

// «3 изменения не сохранены»
export function changesText(n) {
  if (!(n > 0)) return "Есть несохранённые изменения";
  const m10 = n % 10, m100 = n % 100;
  const w = m10 === 1 && m100 !== 11 ? ["изменение", "не сохранено"] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? ["изменения", "не сохранены"] : ["изменений", "не сохранено"];
  return `${n} ${w[0]} ${w[1]}`;
}
