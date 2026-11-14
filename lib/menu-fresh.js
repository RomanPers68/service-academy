// lib/menu-fresh.js — v159 (Доп. 484): насколько свежа копия меню команды на телефоне (sa_menu_shared) и кому сказать,
// что её обновили или что она устарела. Нужно числу «в стопе» на значке «Меню» на главной (lib/menu-stops.js):
// стоп-лист меняют в течение смены, а копия меню на телефоне обновлялась раз в день и при заходе в «Меню».
// Без зависимостей: модуль зовут и lib/reference-context.js (rememberSharedMenu — тяжёлый, грузится по требованию), и
// lib/menu-stops.js (лёгкий, в стартовом наборе).
const at = new Map();        // заведение → когда копию сверяли с сервером (в памяти: после запуска — «ещё ни разу»)
const subs = new Set();
const tell = (restaurant, why) => { for (const fn of [...subs]) { try { fn(restaurant, why); } catch (e) {} } };

/** Копию меню только что записали с сервера: подписчики пересчитывают своё (why = "fresh"). */
export function menuTouched(restaurant, now = Date.now()) {
  const r = String(restaurant || "");
  if (!r) return;
  at.set(r, Number(now) || Date.now());
  tell(r, "fresh");
}

/** Когда копию сверяли в последний раз; 0 — в этом запуске ещё нет. */
export const menuTouchedAt = (restaurant) => at.get(String(restaurant || "")) || 0;

/** Копия устарела (в чате поставили или сняли стоп). Без заведения — у всех: подписчики спрашивают сервер (why = "dirty"). */
export function menuDirty(restaurant) {
  const r = String(restaurant || "");
  if (r) at.delete(r); else at.clear();
  tell(r, "dirty");
}

/** fn(заведение | "", "fresh" | "dirty") → функция отписки */
export function menuSubscribe(fn) {
  if (typeof fn !== "function") return () => {};
  subs.add(fn);
  return () => { subs.delete(fn); };
}

export function _resetMenuFresh() { at.clear(); subs.clear(); }
