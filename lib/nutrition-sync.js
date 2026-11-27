// lib/nutrition-sync.js — v211 (Доп. 537): ведомость КБЖУ заведения — с сервера (этап 67), копия на телефоне.
// В коде приложения таблицы больше нет: у каждого заведения своя ведомость в базе. Здесь её берут
// (nutrition_get) и кладут в lib/nutrition.js (setNutrition), а копию — в localStorage, чтобы КБЖУ было
// сразу при открытии и без сети. Ведомости нет — КБЖУ только свои, из карточки блюда. Этапа 67 на сервере
// нет — до перезапуска не спрашиваем. Вход «Демо» на сервер не ходит.
import { rpc, saToken, rpcMissing } from "./supabase";
import { setNutrition, nutritionVenue } from "./nutrition";

export const NUTRITION_KEY = "sa_nutrition";   // { заведение: { rows, alias, tails } }
let off = false;
const inflight = new Map();

const readAll = () => {
  try { const j = JSON.parse(localStorage.getItem(NUTRITION_KEY) || "{}"); return j && typeof j === "object" && !Array.isArray(j) ? j : {}; }
  catch (e) { return {}; }
};
const writeAll = (all) => { try { localStorage.setItem(NUTRITION_KEY, JSON.stringify(all)); } catch (e) { /* места нет — обойдёмся без копии */ } };
const clean = (j) => ({
  rows: Array.isArray(j && j.rows) ? j.rows : [],
  alias: j && j.alias && typeof j.alias === "object" && !Array.isArray(j.alias) ? j.alias : {},
  tails: Array.isArray(j && j.tails) ? j.tails : [],
});

/** Сразу, без сети: ведомость заведения из копии на телефоне (нет копии — пусто). true — что-то есть */
export function pickNutrition(restaurant) {
  if (!restaurant) return false;
  const t = readAll()[restaurant];
  setNutrition(t ? clean(t) : null, restaurant);
  return !!(t && Array.isArray(t.rows) && t.rows.length);
}

/**
 * С сервера: обновляет копию и, если сейчас открыто это же заведение, — таблицу.
 * @returns {Promise<boolean>} true — пришёл ответ сервера (даже пустой)
 */
export function loadNutrition(restaurant) {
  if (!restaurant) return Promise.resolve(false);
  if (nutritionVenue() !== restaurant) pickNutrition(restaurant);
  const tok = saToken();
  if (off || !tok || tok === "demo") return Promise.resolve(false);
  if (inflight.has(restaurant)) return inflight.get(restaurant);
  const p = Promise.resolve().then(() => rpc("nutrition_get", { p_token: tok, p_restaurant: restaurant })).then((res) => {
    if (rpcMissing(res)) { off = true; return false; }
    const j = typeof res === "string" ? JSON.parse(res) : res;
    if (!j || j.ok !== true) return false;
    const t = clean(j);
    const all = readAll();
    if (t.rows.length) all[restaurant] = t; else delete all[restaurant];
    writeAll(all);
    if (nutritionVenue() === restaurant) setNutrition(t.rows.length ? t : null, restaurant);
    return true;
  }).catch(() => false).finally(() => { inflight.delete(restaurant); });
  inflight.set(restaurant, p);
  return p;
}

/** Для проверок: снова спрашивать сервер */
export const _resetNutritionSync = () => { off = false; inflight.clear(); };
