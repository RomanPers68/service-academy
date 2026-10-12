// lib/day-mode.js — «Ежедневные пять» и режим дня (из lib/deck-extras.js).
// Отдельно, чтобы главный экран не тащил на старт всю базу коктейлей (~80 КБ):
// режиму дня нужны только даты и список режимов.
import { report as reportAchievement } from "./achievements";
import { emitActivity } from "./activity";
// ── Ежедневные пять и режим дня
export const dayKey = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const D5 = (uk) => "sa_daily5" + (uk || "");
export function dailyCount(uk) { try { const j = JSON.parse(localStorage.getItem(D5(uk)) || "{}"); return j.day === dayKey() ? (j.n || 0) : 0; } catch (e) { return 0; } }
export function bumpDaily(uk) { try { const j = JSON.parse(localStorage.getItem(D5(uk)) || "{}"); const n = (j.day === dayKey() ? (j.n || 0) : 0) + 1; const streak = j.day === dayKey() ? (j.streak || 0) : (j.last === dayKey(new Date(Date.now() - 86400000)) ? (j.streak || 0) + 1 : 1); localStorage.setItem(D5(uk), JSON.stringify({ day: dayKey(), n, streak, last: n >= 5 ? dayKey() : j.last })); if (n === 5) { try { reportAchievement(uk, "streak", streak); } catch (e) {} } if (n === 5 || n === 20) emitActivity("trainer"); return n; } catch (e) { return 0; } }
export function dailyStreak(uk) { try { const j = JSON.parse(localStorage.getItem(D5(uk)) || "{}"); return j.streak || 0; } catch (e) { return 0; } }
export const MODES = [
  { key: "allergens", title: "Аллергены на скорость", sub: "30 секунд, свайп «есть / нет»", go: "menu" },
  { key: "reverse-menu", title: "Наоборот: угадай блюдо", sub: "Состав и фото без названия", go: "menu" },
  { key: "know-bar", title: "Знаю? · Колода бармена", sub: "Пять карточек на повтор", go: "cocktails" },
  { key: "reverse-bar", title: "Наоборот: угадай коктейль", sub: "Спек без названия", go: "cocktails" },
  { key: "rush", title: "Час пик", sub: "Три заказа на время", go: "barLab" },
  { key: "know-menu", title: "Знаю? · Колода меню", sub: "Пять карточек на повтор", go: "menu" },
];
export function modeOfDay(d = new Date(), role) {
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const pool = role === "bar" ? MODES : MODES.filter(m => !/bar|rush/.test(m.key)); // официантам — без барных
  return pool[day % pool.length];
}

