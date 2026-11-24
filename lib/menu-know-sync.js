// lib/menu-know-sync.js — v193 (Доп. 518): «Знаю?» меню и ритм блюд — на сервер (этап 59), просьбы руководителя и что бот
// назвал в напоминании — с сервера.
//
// Телефон присылает копию (menu_know_set): «Знаю?» по блюдам своего заведения, ритм и свою очередь блюд — руководитель
// видит «Как команда знает меню», бот за час до смены называет блюда разминки. Не чаще раза в 15 секунд после изменения,
// только когда что-то поменялось (и раз в день — чтобы копия на сервере не устарела). В ответ — просьбы руководителя и
// блюда из сегодняшнего напоминания: копия на телефоне (lib/menu-repeat.js saveFocus). Нет сети или этапа 59 — тихо.
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { saveFocus } from "./menu-repeat";

const SIG_KEY = "sa_menu_know_sig";   // + uk: отпечаток последней копии
let off = false;                      // этапа 59 нет — до перезапуска не спрашиваем
let busy = false;
let timer = 0;

const sigOf = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + ":" + s.length; };
const getS = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
const setS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно */ } };

export const menuKnowOff = () => off;
export function _resetMenuKnow() { off = false; busy = false; clearTimeout(timer); timer = 0; }

/** build() → { uk, restaurant, day, data, warm } или null (меню ещё не загружено, не вошёл). force — без сверки отпечатка. */
export async function pushMenuKnow(build, { force = false } = {}) {
  if (off || busy || !saToken()) return null;
  let p = null;
  try { p = build && build(); } catch (e) { p = null; }
  if (!p || !p.restaurant) return null;
  const sig = sigOf(JSON.stringify([p.restaurant, p.day, p.data, p.warm]));
  if (!force && getS(SIG_KEY + p.uk) === sig) return null;
  busy = true;
  try {
    const r = await rpc("menu_know_set", { p_token: saToken(), p_data: p.data, p_warm: p.warm });
    if (rpcMissing(r)) { off = true; return "missing"; }
    if (r && r.ok) { setS(SIG_KEY + p.uk, sig); saveFocus(p.uk, p.restaurant, r); return r; }
  } catch (e) { /* нет сети — пришлём в другой раз */ } finally { busy = false; }
  return null;
}
export function scheduleMenuKnow(build, delay = 15000) {
  clearTimeout(timer);
  timer = setTimeout(() => { timer = 0; pushMenuKnow(build); }, delay);
}
/** Просьбы руководителя и что бот назвал сегодня — без копии (если менять нечего). */
export async function fetchMenuFocus(uk, restaurant) {
  if (off || !saToken() || !restaurant) return null;
  try {
    const r = await rpc("menu_focus_get", { p_token: saToken() });
    if (rpcMissing(r)) { off = true; return "missing"; }
    if (r && r.ok) { saveFocus(uk, restaurant, r); return r; }
  } catch (e) { /* нет сети */ }
  return null;
}
