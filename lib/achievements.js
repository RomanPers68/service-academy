// lib/achievements.js — ачивки и рекорды команды (Дополнение 216). Без React.
// Рекорд уходит на сервер (achievement_set) только если побит; локально хранится последнее известное.
import { rpcSync, saToken } from "../api/supabase";

export const KEYS = {
  sprint_best: { title: "Аллергены на скорость", unit: "верных за 30 с", better: "max", fmt: (v) => `${v}` },
  rush_best:   { title: "Час пик",              unit: "секунд на 3 заказа", better: "min", fmt: (v) => `${v} с` },
  stamps:      { title: "Печати Сборки",         unit: "коктейлей по памяти", better: "max", fmt: (v) => `${v}` },
  streak:      { title: "Серия дней",            unit: "дней подряд по пять карточек", better: "max", fmt: (v) => `${v} дн` },
};
// Ачивки — пороги по ключам. Название, знак, порог.
export const BADGES = [
  { key: "sprint_best", at: 10, title: "Снайпер",           sign: "◎", desc: "10 верных за 30 секунд" },
  { key: "sprint_best", at: 20, title: "Аллерген-снайпер",  sign: "◎", desc: "20 верных за 30 секунд" },
  { key: "sprint_best", at: 30, title: "Легенда зала",      sign: "✦", desc: "30 верных — рефлекс" },
  { key: "rush_best",   at: 120, title: "Час пик",          sign: "⏱", desc: "три заказа быстрее двух минут", min: true },
  { key: "rush_best",   at: 90,  title: "Скорость",         sign: "⏱", desc: "три заказа быстрее 90 секунд", min: true },
  { key: "rush_best",   at: 60,  title: "Молния",           sign: "⚡", desc: "три заказа быстрее минуты", min: true },
  { key: "stamps",      at: 5,  title: "Первые печати",     sign: "✦", desc: "пять коктейлей по памяти" },
  { key: "stamps",      at: 15, title: "Мастер стойки",     sign: "✦", desc: "пятнадцать коктейлей по памяти" },
  { key: "stamps",      at: 30, title: "Хранитель карты",   sign: "✦", desc: "тридцать коктейлей по памяти" },
  { key: "streak",      at: 3,  title: "Три дня",           sign: "●", desc: "по пять карточек три дня подряд" },
  { key: "streak",      at: 7,  title: "Неделя",            sign: "●", desc: "семь дней подряд" },
  { key: "streak",      at: 30, title: "Месяц",             sign: "✦", desc: "тридцать дней подряд" },
];
const LKEY = (uk) => "sa_achv" + (uk || "");
export function loadLocal(uk) { try { return JSON.parse(localStorage.getItem(LKEY(uk)) || "{}"); } catch (e) { return {}; } }
export function report(uk, key, value) {
  const k = KEYS[key]; if (!k || value == null || !isFinite(value)) return false;
  const cur = loadLocal(uk); const old = cur[key];
  const better = old == null || (k.better === "min" ? value < old : value > old);
  if (better) { cur[key] = value; try { localStorage.setItem(LKEY(uk), JSON.stringify(cur)); } catch (e) {} }
  if (saToken()) rpcSync("achievement_set", { p_token: saToken(), p_key: key, p_value: value, p_better: k.better });
  return better;
}
export function badgesFor(stats) {
  return BADGES.filter(b => { const v = stats[b.key]; if (v == null) return false; return b.min ? v <= b.at : v >= b.at; });
}
/** Рекорды команды из achievements_list: лучший по каждому ключу + топ-3 */
export function teamRecords(rows) {
  const out = {};
  for (const key of Object.keys(KEYS)) {
    const list = (rows || []).filter(r => r.key === key).map(r => ({ ...r, value: Number(r.value) }));
    list.sort((a, b) => KEYS[key].better === "min" ? a.value - b.value : b.value - a.value);
    out[key] = list.slice(0, 3);
  }
  return out;
}
