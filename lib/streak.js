// lib/streak.js — серия дней, которая знает график (Доп. 288).
// Выходной по графику серию не сжигает: если между прошлым занятием и сегодня
// только выходные по графику — серия продолжается, а сами выходные отмечаются
// «замороженными». График берём из офлайн-копии, которую сохраняет экран графика
// (sa_sched_cache_<заведение>_<ГГГГ-ММ>). Нет копии — ведём себя как раньше.

export const ymd = (d) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

// prev — { count, best, last, days, frozen? }; now — Date; isOff(Date) → true | false | null
export function nextStreak(prev, now, isOff) {
  const p = prev || { count: 0, best: 0, last: "", days: [] };
  const today = ymd(now);
  if (p.last === today) return p;
  let count = 1;
  const frozen = [];
  if (p.last) {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() - 1);
    // назад от вчера: выходные по графику пропускаем, но не дольше недели
    for (let i = 0; i < 8; i++) {
      const key = ymd(d);
      if (key === p.last) { count = (p.count || 0) + 1; break; }
      if (key < p.last) break;
      let off = null;
      try { off = isOff ? isOff(new Date(d.getTime())) : null; } catch (e) { off = null; }
      if (off !== true) break;
      frozen.push(key);
      d.setDate(d.getDate() - 1);
    }
  }
  const best = Math.max(p.best || 0, count);
  const days = [...new Set([...(p.days || []), today])].slice(-21);
  // серия оборвалась — прежние «замороженные» дни ей больше не принадлежат
  const fr = count > 1 ? [...new Set([...(p.frozen || []), ...frozen])].slice(-21) : [];
  return { count, best, last: today, days, frozen: fr };
}

const nrm = (x) => String(x || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const tokens = (x) => new Set(nrm(x).split(" ").filter(Boolean));
const allIn = (A, B) => [...A].every((w) => B.has(w));

// Смена сотрудника в этот день по сохранённому графику (офлайн-копия экрана «График»
// или тихая подгрузка из lib/schedule-sync.js — берётся самая свежая копия).
// null — неизвестно (графика на месяц нет или себя в нём не нашли);
// { off: true } — выходной; { off: false, key, name, from, to } — смена (часы местные).
// Сотрудник ищется по имени так же, как в экране графика (ui/schedule.jsx).
const SCHED_PREFIXES = ["sa_sched_cache_", "sa_sched_bg_"];
export function myShiftOn(profile, date, storage) {
  try {
    const ls = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!profile || !ls) return null;
    const mkey = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
    const ptk = tokens(((profile.name || "") + " " + (profile.surname || "")).trim());
    if (!ptk.size) return null;
    const copies = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k || !SCHED_PREFIXES.some((p) => k.indexOf(p) === 0) || k.slice(-(mkey.length + 1)) !== "_" + mkey) continue;
      let c = null;
      try { c = JSON.parse(ls.getItem(k) || "null"); } catch (e) { c = null; }
      if (c && c.cfg) copies.push({ c, ts: Number(c.ts) || 0, i });
    }
    copies.sort((a, b) => (b.ts - a.ts) || (a.i - b.i));
    for (const { c } of copies) {
      const cands = (c.cfg.staff || []).filter((st) => {
        const et = tokens(st.name);
        return et.size && (allIn(et, ptk) || allIn(ptk, et));
      });
      const me = cands.find((st) => tokens(st.name).size === ptk.size && allIn(tokens(st.name), ptk)) || (cands.length === 1 ? cands[0] : null);
      if (!me) continue;
      const my = (c.plan || {})[me.id] || {};
      if (!Object.keys(my).length) return null;            // на этот месяц меня в графике нет
      const v = my[date.getDate()];
      const sh = v ? (c.cfg.shifts || []).find((q) => q.k === v) : null;
      if (!sh) return { off: true };
      return { off: false, key: sh.k, name: sh.name || "", from: typeof sh.from === "number" ? sh.from : null, to: typeof sh.to === "number" ? sh.to : null };
    }
  } catch (e) {}
  return null;
}

// Выходной ли у сотрудника этот день по сохранённому графику.
// true — выходной, false — смена, null — неизвестно (графика на этот месяц нет).
export function dayOffFromSchedule(profile, date, storage) {
  const s = myShiftOn(profile, date, storage);
  return s ? !!s.off : null;
}

// Подпись смены: «День · 12:00–20:00»
export function shiftLabel(s) {
  if (!s || s.off) return "";
  const h = (x) => (x === 24 ? "24" : String(x).padStart(2, "0")) + ":00";
  return (s.name || "Смена") + (s.from != null && s.to != null ? " · " + h(s.from) + "–" + h(s.to % 24 === 0 && s.to !== 0 ? 24 : s.to) : "");
}
