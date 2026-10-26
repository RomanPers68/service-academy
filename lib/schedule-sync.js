// lib/schedule-sync.js — тихая подгрузка своего графика (Доп. 301).
// Раз в день (и при смене месяца) приложение берёт график ресторана тем же запросом,
// что экран «График» (schedule_load), и оставляет на телефоне только свою строку:
// какие смены у меня в этом месяце. Отсюда «Разминка до смены» и серия, которая не
// сгорает в выходной, знают график, даже если экран «График» в этом месяце не открывали.
// Снимок экрана «График» (sa_sched_cache_…) не трогаем: по нему экран показывает
// «График обновился». Своя копия — sa_sched_bg_main_<ГГГГ-ММ>.
import { ymd, myShiftOn } from "./streak";

// Как DEFAULT_CONFIG.shifts в ui/schedule.jsx (проверяется тестом tests/schedule-sync.test.js)
export const DEFAULT_SHIFTS = [
  { k: "У", name: "Утро", from: 10, to: 18 },
  { k: "Д", name: "День", from: 12, to: 20 },
  { k: "В", name: "Вечер", from: 16, to: 24 },
  { k: "К", name: "Кейтеринг", from: 10, to: 22, extra: 1 },
];
export const BG_KEY = "sa_sched_bg_main_";
const FLAG_KEY = "sa_sched_sync";
const VENUE = "main";   // одно заведение на ресторан — как в ui/schedule.jsx

const nrm = (x) => String(x || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const tokens = (x) => new Set(nrm(x).split(" ").filter(Boolean));
const allIn = (A, B) => [...A].every((w) => B.has(w));
const monthKey = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");

/** Сотрудник в графике этого месяца — как таблица графика и генератор: till — последний рабочий месяц (✕ у сотрудника
 *  закрывает его прошлым месяцем), since — первый. Старые смены удалённого в плане остаются, но в месяце его нет. */
export const inMonth = (st, mkey) => !!st && (!st.till || mkey <= st.till) && (!st.since || mkey >= st.since);

// Найти себя в списке сотрудников графика — тем же правилом, что экран «График»
export function findMe(staff, profile) {
  const ptk = tokens(((profile && profile.name) || "") + " " + ((profile && profile.surname) || ""));
  if (!ptk.size) return null;
  const cands = (staff || []).filter((st) => { const et = tokens(st && st.name); return et.size && (allIn(et, ptk) || allIn(ptk, et)); });
  return cands.find((st) => tokens(st.name).size === ptk.size && allIn(tokens(st.name), ptk)) || (cands.length === 1 ? cands[0] : null);
}

// Подпись для сводки «моя смена сегодня» — как пишет экран графика
export function todayLabel(sh) {
  if (!sh) return null;
  return sh.name + " · " + sh.from + ":00–" + (sh.to === 24 ? "24" : sh.to) + ":00";
}

// → true, если своя копия графика обновилась
export async function syncMySchedule(rpcFn, token, profile, now = new Date(), storage) {
  const ls = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!ls || !rpcFn || !token || !profile || !profile.restaurant) return false;
  const mkey = monthKey(now);
  const flag = ymd(now) + "|" + (profile.restaurant || "") + "|" + (profile.name || "") + " " + (profile.surname || "");
  try { if (ls.getItem(FLAG_KEY) === flag) return false; } catch (e) { return false; }
  let r = null;
  try { r = await rpcFn("schedule_load", { p_token: token, p_restaurant: profile.restaurant || "", p_month: mkey }); } catch (e) { return false; }
  if (!r || r.ok !== true) return false;
  try { ls.setItem(FLAG_KEY, flag); } catch (e) {}
  const v = (r.venues || []).find((x) => x && x.venue_key === VENUE);
  const m = (r.months || []).find((x) => x && x.venue_key === VENUE);
  const cfg = (v && v.config) || {};
  const shifts = Array.isArray(cfg.shifts) && cfg.shifts.length ? cfg.shifts : DEFAULT_SHIFTS;
  const me = findMe(cfg.staff, profile);
  const plan = (m && m.payload && m.payload.plan) || {};
  if (!me) { try { ls.removeItem(BG_KEY + mkey); } catch (e) {} return false; }
  const mine = plan[me.id] || {};
  const snap = { cfg: { staff: [{ id: me.id, name: me.name }], shifts: shifts.map((q) => ({ k: q.k, name: q.name, from: q.from, to: q.to })) }, plan: { [me.id]: mine }, ts: Date.now() };
  try { ls.setItem(BG_KEY + mkey, JSON.stringify(snap)); } catch (e) { return false; }
  // сводка «моя смена сегодня» — для главной, «Смены» и Наставника (как в экране графика)
  try {
    const s = myShiftOn(profile, now, ls);
    const k0 = mine[now.getDate()];
    const sh0 = k0 ? shifts.find((q) => q.k === k0) : null;
    if (s || Object.keys(mine).length) {
      ls.setItem("sa_today_shift", JSON.stringify({ date: ymd(now), label: sh0 ? todayLabel(sh0) : "выходной" }));
    }
  } catch (e) {}
  return true;
}
