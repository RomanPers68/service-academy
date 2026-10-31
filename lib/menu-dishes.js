// lib/menu-dishes.js — v71: одно меню для поиска — то же, что видит «Колода меню».
// Аудит v70: глобальный поиск брал блюда только из примеров и из «своих» на телефоне (sa_menu_custom), а меню,
// которое руководитель опубликовал команде (menu_get → кэш sa_menu_shared), не видел: у официанта на «орех»
// находились примеры, а не настоящие блюда заведения; у заведений без примеров — ничего. Наставник (Доп. 129)
// меню команды знал, поиск — нет. Теперь правило одно — как в тренажёре меню (ui/menu-trainer.jsx, dishes):
// свои (без архива) + меню команды (без карты бара, коктейлей, удалённых до публикации и архива; своя правка
// важнее серверной) + примеры, пока у команды нет своего меню (или если их включили вручную), без скрытых.
import { RESTAURANT_MENUS } from "../data/menu";
import { isBarcard, readBarcard, houseCocktails } from "./deck-extras";
import { COCKTAILS } from "../data/cocktails";

const loadJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } };

export function menuDishes({ restaurant, custom = {}, shared = [], hideSamples = {}, hiddenIds = {}, deleted = {}, samples = RESTAURANT_MENUS } = {}) {
  if (!restaurant) return [];
  const ownAll = custom[restaurant] || [];
  const ownIds = new Set(ownAll.map((d) => d && d.id));
  const own = ownAll.filter((d) => d && d.name && !d.archived);
  const del = new Set(deleted[restaurant] || []);
  const team = (shared || []).filter((d) => d && d.id && d.name && !isBarcard(d) && d.kind !== "cocktail" && d.kind !== "wine" && !ownIds.has(d.id) && !del.has(d.id) && !d.archived);
  const hs = hideSamples[restaurant];
  const showSamples = hs === false ? true : hs === true ? false : (shared || []).length === 0;
  const hid = new Set(hiddenIds[restaurant] || []);
  const smp = showSamples ? ((samples || {})[restaurant] || []).filter((d) => !ownIds.has(d.id) && !hid.has(d.id)) : [];
  return [...own, ...team, ...smp];
}

export function sharedOf(restaurant) {
  const all = loadJson("sa_menu_shared");
  return Array.isArray(all[restaurant]) ? all[restaurant] : [];
}

// Меню заведения с телефона: те же ключи, что пишет тренажёр меню
export function menuDishesFromStorage(restaurant) {
  return menuDishes({ restaurant, custom: loadJson("sa_menu_custom"), shared: sharedOf(restaurant), hideSamples: loadJson("sa_menu_hide_samples"),
    hiddenIds: loadJson("sa_menu_hidden_samples"), deleted: loadJson("sa_menu_deleted") });
}

/**
 * v93 (Доп. 406): стоп-лист из чата смены ставится на сервере (chat_stop_set, этап 38) — у блюда stop и stopAt (когда
 * меняли). Своя копия блюда у руководителя (sa_menu_custom) важнее серверной, и следующая публикация меню стёрла бы
 * стоп из чата. Поэтому при загрузке меню стоп берётся с сервера, если там он новее своего (stopAt). Ничего не
 * поменялось — тот же массив.
 */
export function mergeStops(own, shared) {
  const by = new Map((shared || []).filter((d) => d && d.id != null).map((d) => [String(d.id), d]));
  let changed = false;
  const out = (own || []).map((d) => {
    const s = d && by.get(String(d.id));
    if (!s || !(Number(s.stopAt) > (Number(d.stopAt) || 0))) return d;
    changed = true;
    return { ...d, stop: s.stop || null, stopAt: Number(s.stopAt) };
  });
  return changed ? out : own;
}

// Коктейли карты бара — как в «Колоде бармена»: свои из меню команды + базовые; если карта бара настроена — только из неё
export function barCocktails(shared) {
  const house = houseCocktails(shared || []);
  const card = readBarcard(shared || []);
  const base = card ? COCKTAILS.filter((c) => card.includes(c.id)) : COCKTAILS;
  return [...house, ...base];
}
