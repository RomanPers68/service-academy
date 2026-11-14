// lib/menu-stops.js — v159 (Доп. 484): сколько блюд сегодня в стопе. Число на значке «Меню» на главной и строка
// «Сегодня нет» в самом «Меню». Владелец (на совет Google «значки с бейджами»): «Давай все 4».
//
// Считаем по копии меню на телефоне — тем же правилом, что экран «Меню» (lib/menu-dishes.js: menuDishes + mergeStops):
// свои блюда без архива (стоп из чата новее своей копии — берём его) + меню команды без карты бара, коктейлей, вин,
// крепкого, удалённого и архива. У заготовок-примеров стопа не бывает (пример, которому поставили стоп, становится
// «своим»), поэтому файл заготовок (data/menu.js, 53 КБ) сюда не тянем: модуль лёгкий и живёт в стартовом наборе, как
// countNewDishes в data/reviews.js (v79). Равенство со «взрослым» правилом сверяет tests/v159.test.js.
//
// Свежесть. Стоп-лист меняют в течение смены, а копия меню на телефоне обновлялась раз в день (lib/tip-sync.js) и при
// заходе в «Меню». Число, которое врёт, хуже, чем никакого. Поэтому, пока главная на виду, копию сверяем с сервером
// (тем же menu_get, что и экран «Меню»): не чаще раза в пять минут, не раньше шести секунд после запуска, и сразу —
// когда в открытом чате появилась карточка стоп-листа или «Снова в меню» (noteStopCards). Экран погашен или открыт
// другой раздел — запросов нет. Нет связи — минуту не спрашиваем; нет функции на сервере — до перезапуска.
import { rpc, rpcMissing } from "../api/supabase";
import { menuTouchedAt, menuDirty } from "./menu-fresh.js";

export const STOPS_FRESH_MS = 5 * 60e3;   // свежая копия — не старше пяти минут
export const STOPS_RETRY_MS = 60e3;       // после неудачи — минуту не спрашиваем
export const STOPS_BOOT_MS = 6000;        // после запуска — не раньше: старт остаётся лёгким
export const STOPS_MOUNT_MS = 700;        // вернулись на главную — даём экрану открыться
export const STOPS_MAX = 99;
const BARCARD_ID = "__barcard__";         // как в lib/deck-extras.js (сверяет тест)

const loadJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } };
const arr = (v) => (Array.isArray(v) ? v : []);
const isDrink = (d) => d.kind === "cocktail" || d.kind === "wine" || d.kind === "spirit";

/**
 * Блюда «сегодня нет»: [{ id, name }] в порядке меню. custom — свои блюда заведения (sa_menu_custom[заведение]),
 * shared — меню команды (sa_menu_shared[заведение]), deleted — удалённые до публикации (sa_menu_deleted[заведение]).
 */
export function stopsOf({ custom = [], shared = [], deleted = [] } = {}) {
  const own = arr(custom), team = arr(shared);
  const srv = new Map(team.filter((d) => d && d.id != null).map((d) => [String(d.id), d]));
  const ownIds = new Set(own.map((d) => d && d.id));
  const del = new Set(arr(deleted));
  const out = [];
  for (const d of own) {
    if (!d || !d.name || d.archived) continue;
    const s = srv.get(String(d.id));
    // стоп из чата смены (на сервере) новее своей копии — он и действует (как mergeStops в lib/menu-dishes.js)
    const stop = s && Number(s.stopAt) > (Number(d.stopAt) || 0) ? s.stop : d.stop;
    if (stop) out.push({ id: String(d.id), name: String(d.name).trim() });
  }
  for (const d of team) {
    if (!d || !d.id || !d.name || d.id === BARCARD_ID || isDrink(d) || d.archived || ownIds.has(d.id) || del.has(d.id)) continue;
    if (d.stop) out.push({ id: String(d.id), name: String(d.name).trim() });
  }
  return out;
}

/** То же — по тому, что лежит на телефоне. */
export function stopsOnPhone(restaurant) {
  const r = String(restaurant || "");
  if (!r) return [];
  return stopsOf({ custom: loadJson("sa_menu_custom")[r], shared: loadJson("sa_menu_shared")[r], deleted: loadJson("sa_menu_deleted")[r] });
}
export const stopCount = (restaurant) => stopsOnPhone(restaurant).length;

/** Число на значке: «3», «12», «99+»; нуля нет. */
export const stopBadge = (n) => { const x = Math.floor(Number(n) || 0); return x > STOPS_MAX ? STOPS_MAX + "+" : x > 0 ? String(x) : ""; };
const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
/** Для экранного диктора и подсказки: «Меню. В стопе 3 блюда» */
export const stopsLabel = (n) => { const x = Math.floor(Number(n) || 0); return x > 0 ? "Меню. В стопе " + x + " " + pl(x, "блюдо", "блюда", "блюд") : "Меню"; };

// ── свежесть копии ──
const st = { busy: new Map(), failAt: new Map(), off: false, seen: new Set() };

/** Пора ли сверить копию с сервером. */
export function stopsStale(restaurant, now = Date.now()) {
  const r = String(restaurant || "");
  if (!r || st.off) return false;
  return now - menuTouchedAt(r) > STOPS_FRESH_MS;
}

// запомнить меню команды на телефоне: тот же путь, что у экрана «Меню» (там же пересчитывается сводка для советов).
// Модуль тяжёлый (тянет заготовки меню) — грузим его, только когда ответ уже пришёл.
const rememberLazy = (restaurant, dishes) => import("./reference-context.js").then((m) => m.rememberSharedMenu(restaurant, dishes));

/**
 * Сверить копию меню с сервером. → Promise<true>, если копию обновили. force — не смотреть на «пять минут» (в чате
 * только что поменяли стоп). Одновременно — один запрос на заведение.
 */
export function refreshStops(restaurant, { force = false, now = Date.now(), ask = rpc, remember = rememberLazy, isMissing = rpcMissing } = {}) {
  const r = String(restaurant || "");
  if (!r || st.off) return Promise.resolve(false);
  if (st.busy.has(r)) return st.busy.get(r);
  if (!force && !stopsStale(r, now)) return Promise.resolve(false);
  if (now - (st.failAt.get(r) || 0) < STOPS_RETRY_MS) return Promise.resolve(false);
  const fail = () => { st.failAt.set(r, now); return false; };
  const p = Promise.resolve().then(() => ask("menu_get", { p_restaurant: r })).then((res) => {
    if (res && typeof res === "object" && !Array.isArray(res) && isMissing(res)) { st.off = true; return false; }   // нет меню на сервере
    let list = null;
    try { list = typeof res === "string" ? JSON.parse(res) : res; } catch (e) { list = null; }
    if (!Array.isArray(list)) return fail();
    return Promise.resolve(remember(r, list)).then(() => true);   // там же menuTouched: подписчики пересчитают число
  }).catch(fail).then((ok) => { st.busy.delete(r); return ok; });
  st.busy.set(r, p);
  return p;
}

/**
 * Чат: в ленту пришли сообщения. Новая карточка стоп-листа или её смена на «Снова в меню» — копия меню устарела
 * (главная под чатом сверит её сразу). Карточку помним по номеру и состоянию, а не по времени: часы телефона и
 * сервера могут расходиться. → true, если нашлось новое.
 */
export function noteStopCards(list) {
  let fresh = false;
  for (const m of arr(list)) {
    const c = m && m.card;
    if (!c || c.t !== "stop" || m.id == null) continue;
    const k = String(m.id) + "|" + (c.st === "off" ? "off" : "on");
    if (st.seen.has(k)) continue;
    if (st.seen.size > 400) st.seen.clear();
    st.seen.add(k); fresh = true;
  }
  if (fresh) menuDirty();
  return fresh;
}

export function _resetStops() { st.busy.clear(); st.failAt.clear(); st.seen.clear(); st.off = false; }
