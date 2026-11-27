// lib/api-fetch.js — v207 (Доп. 533): AI-функции приложения — через Supabase, а не через Vercel.
//
// Владелец (27.11): после v206 импорт меню через Supabase заработал, на «Перенести остальные?» — «Да, давай исправим».
// У него Vercel не раз останавливал запросы кодом 403 до наших функций (поиск в интернете — v155, импорт меню — v206).
// apiFetch(путь, init) — замена fetch для /api/wine-import, /api/lesson-assist и /api/web-answer: запрос уходит в функцию
// Supabase app-api (там те же обработчики, supabase/functions/app-api) с ключом, как у Наставника. Функции нет (404 от
// Supabase) — с этого места и до перезапуска приложения всё идёт по-старому, в /api/<имя> на Vercel. Нет связи — ошибка,
// как у обычного fetch: на Vercel не уходим (там как раз 403). Остальные адреса — обычный fetch.
import { SUPABASE_URL, SUPABASE_KEY } from "./supabase";

export const EDGE_API = ["wine-import", "lesson-assist", "web-answer"];

/** Имя функции из «/api/wine-import?…» — если она переехала в Supabase, иначе "". */
export const edgeName = (path) => {
  const m = /^\/api\/([a-z-]+)(?:[?#]|$)/.exec(String(path || ""));
  return m && EDGE_API.includes(m[1]) ? m[1] : "";
};

/** Ответ 404 — это «функции нет в Supabase», а не ответ самой функции? Смотрим тело (копию ответа). */
async function edgeMissing(r) {
  if (!r || r.status !== 404) return false;
  try {
    const j = await r.clone().json();
    return !j || j.code === "NOT_FOUND" || /not found|Нет такой функции/i.test(String(j.message || j.msg || j.error || ""));
  } catch (e) { return true; }   // не JSON — точно не наш ответ
}

/** fetch для приложения: supabaseUrl/supabaseKey — куда и с каким ключом; fetchFn — для проверок. */
export function makeApiFetch({ supabaseUrl = "", supabaseKey = "", fetchFn } = {}) {
  const f = fetchFn || ((u, o) => fetch(u, o));
  const base = String(supabaseUrl || "").replace(/\/+$/, "");
  const auth = /^eyJ/.test(supabaseKey) ? { apikey: supabaseKey, Authorization: "Bearer " + supabaseKey } : { apikey: supabaseKey };
  let edgeOff = !base;   // функции app-api нет — дальше всё в Vercel
  return async (path, init = {}) => {
    const name = edgeName(path);
    if (!name || edgeOff) return f(path, init);
    const q = String(path).indexOf("?");
    const url = base + "/functions/v1/app-api/" + name + (q >= 0 ? String(path).slice(q) : "");
    const r = await f(url, { ...init, headers: { ...(init.headers || {}), ...auth } });
    if (!(await edgeMissing(r))) return r;
    edgeOff = true;
    return f(path, init);
  };
}

export const apiFetch = makeApiFetch({ supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY });
