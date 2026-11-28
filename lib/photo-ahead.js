// lib/photo-ahead.js — v224 (Доп. 550): фото меню заранее.
//
// Владелец (28.11): «Когда заходишь в приложение по закреплённой ссылке на главном экране (на iPhone), то многие фото, да
// и всё остальное (кроме справочника и приветственных видео) грузит очень долго, а должно быть бесшовно». Справочник и
// ролики лежат на самом сайте и приходят из ближайшего узла Vercel, а фото блюд, вин и коктейлей — в хранилище базы (Цюрих):
// каждое фото, которое человек ещё не видел, едет оттуда, когда экран уже открыт.
// Теперь, пока человек на главной, приложение тихо, по три, кладёт в память телефона фото своего меню (из копии меню на
// телефоне: sa_menu_shared и sa_menu_custom). Сервис-воркер хранит их под своими адресами и второй раз не качает
// (public/sw.js, fixed), без воркера (Telegram на iPhone) их держит кэш браузера (vercel.json: сутки). Колода, карта вин и
// меню открываются уже с фото. Что уже брали заранее за последнюю неделю — не берём (AHEAD_KEY). Бережная сеть — не качаем.
import { sbIn } from "./supabase";
import { leanNet } from "./lesson-photo";

export const AHEAD_KEY = "sa_photo_ahead_v1";   // { адрес: когда брали, мс }
export const AHEAD_MAX = 150;                    // фото за заход, не больше
export const AHEAD_PAR = 3;                      // столько сразу
export const AHEAD_AGAIN = 7 * 24 * 3600 * 1000; // взятое заранее — снова не раньше чем через неделю
export const AHEAD_DELAY = 7000;                 // после запуска: сначала то, что на экране

const STORE_RE = /\/storage\/v1\/object\/public\//;
const loadJson = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };

/** Адреса фото меню заведения restaurant: блюда, вина, коктейли — только файлы хранилища (без data:), без повторов */
export function menuPhotoUrls(shared, custom, restaurant, max = AHEAD_MAX) {
  const out = [], seen = new Set();
  for (const list of [custom && custom[restaurant], shared && shared[restaurant]]) {
    for (const d of Array.isArray(list) ? list : []) {
      const raw = d && typeof d.img === "string" ? d.img : "";
      if (!STORE_RE.test(raw) || !(/^https:\/\//.test(raw) || raw.startsWith("/storage/v1/object/public/"))) continue;   // v225: и путь хранилища
      const u = sbIn(raw);
      if (seen.has(u)) continue;
      seen.add(u); out.push(u);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** Что брать сейчас: адреса без тех, что брали заранее меньше недели назад */
export function aheadTodo(urls, done, now = Date.now()) {
  return urls.filter((u) => !(done && typeof done[u] === "number" && now - done[u] < AHEAD_AGAIN));
}

/** Скачать адреса по par сразу; done — отметки (пишем после каждого удачного). → сколько скачали */
export async function photosAhead(urls, { fetchFn, par = AHEAD_PAR, done = {}, save = () => {}, now = () => Date.now(), alive = () => true } = {}) {
  const f = fetchFn || ((u) => fetch(u, { credentials: "omit" }));
  let i = 0, got = 0;
  const next = async () => {
    while (i < urls.length && alive()) {
      const u = urls[i++];
      try { const r = await f(u); if (r && r.ok) { if (typeof r.arrayBuffer === "function") await r.arrayBuffer(); done[u] = now(); got++; save(done); } } catch (e) { /* нет связи — возьмёт экран */ }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(par, urls.length)) }, next));
  return got;
}

const readDone = () => { const d = loadJson(AHEAD_KEY); const out = {}; for (const k of Object.keys(d).slice(-300)) if (typeof d[k] === "number") out[k] = d[k]; return out; };
const writeDone = (d) => { try { const keys = Object.keys(d).slice(-300); const o = {}; for (const k of keys) o[k] = d[k]; localStorage.setItem(AHEAD_KEY, JSON.stringify(o)); } catch (e) { /* */ } };

let running = null;
/** Запуск с главной: фото меню своего заведения — в память телефона. → обещание: сколько скачали */
export function menuPhotosAhead(restaurant) {
  if (running) return running;
  if (!restaurant || leanNet()) return Promise.resolve(0);
  try { if (typeof document !== "undefined" && document.visibilityState === "hidden") return Promise.resolve(0); } catch (e) { /* */ }
  const done = readDone();
  const urls = aheadTodo(menuPhotoUrls(loadJson("sa_menu_shared"), loadJson("sa_menu_custom"), restaurant), done);
  if (!urls.length) return Promise.resolve(0);
  const alive = () => { try { return typeof document === "undefined" || document.visibilityState !== "hidden"; } catch (e) { return true; } };
  running = photosAhead(urls, { done, save: writeDone, alive }).finally(() => { running = null; });
  return running;
}
