// lib/tip-sync.js — v149 (Доп. 473): тихая подгрузка раз в день для советов в уроках (lib/tip-avail.js).
// Меню команды (menu_get → кэш sa_menu_shared и сводка sa_tip_avail) и схема зала (seat_board → sa_seat_plan) —
// теми же запросами, что экраны «Меню», «Барная карта» и «Рассадка». Так совет знает, есть ли записи шефа, вина в
// карте и схема зала, даже если человек туда ещё не заходил. И есть ли на сервере этапы «Случаев» (case_list, только
// числа) и «Спасибо от гостей» (thanks_team: сотруднику отвечает «forbidden», но этап есть — свой QR при этом не
// создаётся, как создал бы my_thanks). Грузится отдельно (import() из App) через 5 с после старта;
// раз в день на заведение (как график, lib/schedule-sync.js). Нет связи — сводка считается по тому, что уже на телефоне.
import { rememberSharedMenu, refreshAvail } from "./reference-context.js";
import { rememberSeatPlan, rememberStage } from "./tip-avail.js";
import { rpcMissing } from "../api/supabase";

export const SYNC_KEY = "sa_tip_sync";
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

// → true, если что-то запомнили (App перечитывает совет)
export async function syncTipData(rpcFn, token, profile, now = new Date(), storage, isMissing = rpcMissing) {
  const ls = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  const restaurant = (profile && profile.restaurant) || "";
  if (!ls || !rpcFn || !token || !restaurant) return false;
  const flag = ymd(now) + "|" + restaurant;
  try { if (ls.getItem(SYNC_KEY) === flag) return false; } catch (e) { return false; }
  const ask = (fn, args) => Promise.resolve().then(() => rpcFn(fn, args)).catch(() => null);
  const [menu, board, cases, thanks] = await Promise.all([
    ask("menu_get", { p_restaurant: restaurant }),
    ask("seat_board", { p_token: token }),
    ask("case_list", { p_token: token, p_mode: "counts", p_since: null }),
    ask("thanks_team", { p_token: token }),
  ]);
  // этап есть, если сервер ответил чем угодно, кроме «функции нет» (сотруднику thanks_team — «forbidden»)
  const stage = (name, r) => { if (r && typeof r === "object") rememberStage(name, !isMissing(r), ls); };
  stage("cases", cases); stage("thanks", thanks);
  let arr = null;
  try { arr = typeof menu === "string" ? JSON.parse(menu) : menu; } catch (e) { arr = null; }
  if (Array.isArray(arr)) rememberSharedMenu(restaurant, arr);   // сводка пересчитается там же
  else refreshAvail(restaurant);                                  // без связи — по кэшу и примерам
  if (board && isMissing(board)) rememberSeatPlan(restaurant, null, ls, true);
  else if (board && board.ok === true) rememberSeatPlan(restaurant, board, ls);
  // отметку дня ставим, только если сервер ответил (иначе попробуем при следующем запуске)
  if (Array.isArray(arr) || (board && (board.ok === true || isMissing(board)))) { try { ls.setItem(SYNC_KEY, flag); } catch (e) {} }
  return true;
}
