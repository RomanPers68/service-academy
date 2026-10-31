// lib/wine-sync.js — v126 (Доп. 439): выученное до v125 — на сервер.
//
// Владелец (31.10): «Да, давай» — кто нажал «Выучил новые вина ✓» до обновления (v123, v124), запомнил это только на
// телефоне: кнопки у него больше нет, а в «Кто выучил новые вина» (этап 44) он «учит». Теперь телефон сам досылает
// выученную волну и счёт «Знаю?»: через 8 секунд после входа в приложение и при открытии винной карты. Что ушло, помнит
// (sa_wine_sync_<заведение>): второй раз не шлёт, и дата «выучены» у руководителя не сдвигается. На телефоне, где входили
// и другие люди, не шлёт: «Выучил» на телефоне общий для заведения, чьё оно, не узнать. Без вин в карте не шлёт.
import { rpcSync, saToken } from "../api/supabase";
import { wineRecords } from "./wine.js";
import { learnedKey, srKey, wineStats, syncKey, catchUpPlan, sentAfter, otherUsers } from "./wine-train.js";

const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const keys = () => { try { const out = []; for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); return out; } catch (e) { return []; } };
// вина из меню команды, сохранённого на телефоне (его же показывает винная карта, пока сервер не ответил)
const cachedWines = (restaurant) => { const all = load("sa_menu_shared", {}); return wineRecords(all && Array.isArray(all[restaurant]) ? all[restaurant] : []); };

/** Сообщение ушло (или стоит в очереди до сети): запомнить сразу, чтобы досылка его не повторила. Вернёт «отменить» —
 *  для ответа "drop" (нет этапа 44, отказ): тогда дошлётся в другой раз. */
export function markSent(restaurant, kind, ids) {
  const k = syncKey(restaurant), prev = load(k, {});
  save(k, sentAfter(prev, kind, ids));
  return () => save(k, prev);
}

const tried = new Set();   // заведения, по которым в этом запуске уже досылали
/** Дослать выученное до v125. wines — вина карты (нет — из меню на телефоне). Вернёт, что ушло: "passed", "stats" или null. */
export function wineCatchUp({ restaurant, uk, wines = null } = {}) {
  try {
    if (!restaurant || !saToken() || tried.has(restaurant)) return Promise.resolve(null);
    const sr = load(srKey(restaurant), {});
    const plan = catchUpPlan(load(learnedKey(restaurant), []), sr, load(syncKey(restaurant), {}));
    if (!plan || otherUsers(uk, keys()).length) return Promise.resolve(null);
    const stats = wineStats(wines && wines.length ? wines : cachedWines(restaurant), sr);
    if (!stats.total) return Promise.resolve(null);
    tried.add(restaurant);
    const undo = markSent(restaurant, plan.kind, plan.ids);
    const p_data = plan.kind === "passed" ? { ids: plan.ids, stats } : { stats };
    return rpcSync("wine_progress_set", { p_token: saToken(), p_kind: plan.kind, p_data })
      .then((res) => { if (res === "drop") { undo(); return null; } return plan.kind; })
      .catch(() => { undo(); return null; });
  } catch (e) { return Promise.resolve(null); }
}
