// lib/staff-photo.js — v158 (Доп. 483): фото сотрудников в кружках. Без интерфейса: список с сервера, чьё фото у строки
// графика, память и телефон, превью пачкой, кадр и сжатие, загрузка и снятие, тексты ошибок.
//
// Владелец (14.11) на «что ещё заметил»: «Давай все пять». Четвёртое из пяти — «Фото сотрудников в кружках вместо букв:
// „Смена“, „График“, „Команда“. Самое тёплое, но и самое большое: нужен новый шаг на сервере».
//   • Сервер — этап 52 (supabase/supabase-stage52-staff-photos.sql): у сотрудника одно фото — квадратный JPEG 512 точек
//     (до 150 КБ) и превью 160 точек (до 30 КБ) в base64, как фото уроков. Своё фото ставит и убирает сам сотрудник;
//     руководитель может убрать фото у своих (владелец и руководящий состав — у любого).
//   • staff_photos — у кого есть фото (номер, имя, фамилия, заведение, версия), кто я и что мне можно; staff_photo — сами
//     фото: до 24 превью одним запросом (в графике два десятка человек — один запрос, а не двадцать) или одно целиком;
//     staff_photo_set, staff_photo_del — поставить и убрать.
//   • Нет этапа 52 — всё как раньше, буквы в кружках; владельцу в листе «Моё фото» — как обновить сервер.
//   • Фото, раз скачанное, лежит на телефоне (lib/photo-store.js, вид «sp»): кружки встают сразу и без сети.
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { photoGet, photoPut, photoAll, photoPrune } from "./photo-store";

export const SP_CACHE = "sa_staff_photos_v1";   // список (сотрудник → версия) на телефоне: кружки не мигают при входе
export const SP_LIMITS = { full: 200000, thumb: 40000 };   // знаков base64 — как проверяет сервер
export const SP_SIDE = { full: 512, thumb: 160 };
export const SP_BYTES = { full: 140 * 1024, thumb: 26 * 1024 };
export const SP_BATCH = 24;

// ── имена: строку графика заводит руководитель руками («Ким Мария», «Мария Ким», «Ким Мария Олеговна») ────────────
/** Имя для сравнения: без регистра, «ё» как «е», без точек и лишних пробелов */
export const normName = (s) => String(s == null ? "" : s).toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
const tokensOf = (...parts) => normName(parts.filter(Boolean).join(" ")).split(" ").filter(Boolean);

/**
 * Ответ staff_photos → { me, restaurant, can: { lead, network }, items: [{ id, name, surname, restaurant, ver, tok }],
 * byId: { номер: запись } } или null.
 */
export function normStaffPhotos(r) {
  if (!r || r.ok !== true) return null;
  const items = [], byId = {};
  for (const it of Array.isArray(r.items) ? r.items : []) {
    const id = it && it.id != null ? String(it.id) : "";
    if (!id || !it.ver || byId[id]) continue;
    const one = { id, name: String(it.name || ""), surname: String(it.surname || ""), restaurant: String(it.restaurant || ""), ver: String(it.ver), tok: tokensOf(it.name, it.surname) };
    items.push(one); byId[id] = one;
  }
  return { me: r.me != null ? String(r.me) : "", restaurant: r.restaurant ? String(r.restaurant) : "",
    can: { lead: !!(r.can && r.can.lead), network: !!(r.can && r.can.network) }, items, byId };
}

/**
 * Чьё это фото. who: { id } — номер сотрудника известен (свой профиль, чат): только по нему.
 * who: { full | name, surname, restaurant } — номера нет (строки графика, рейтинг): по имени и фамилии внутри заведения,
 * в любом порядке; лишнее слово в строке (отчество) не мешает. Тёзки в одном заведении — фото не показываем никому
 * из них: лучше буквы, чем чужое лицо. → запись списка или null.
 */
export function staffPhotoOf(list, who) {
  if (!list || list === "missing" || !Array.isArray(list.items) || !list.items.length || !who) return null;
  const id = who.id != null && who.id !== "" ? String(who.id) : "";
  if (id) return (list.byId && list.byId[id]) || null;
  const t = tokensOf(who.full, who.name, who.surname);
  if (!t.length) return null;
  const rest = String(who.restaurant || list.restaurant || "");
  const set = new Set(t);
  let hit = null;
  for (const x of list.items) {
    if (rest && x.restaurant && x.restaurant !== rest) continue;
    const tk = Array.isArray(x.tok) ? x.tok : [];
    if (!tk.length || !tk.every((w) => set.has(w))) continue;
    if (tk.length < 2 && t.length !== 1) continue;      // у записи только имя — совпадает лишь со строкой из одного имени
    if (hit) return null;                                // второй подходящий — тёзки
    hit = x;
  }
  return hit;
}

/** Буквы для кружка: имя, потом фамилия («Мария Ким» → «МК»), как в чате, «Смене» и «Команде» */
export const initialsOfPerson = (name, surname) => (String(name || "").trim().slice(0, 1) + String(surname || "").trim().slice(0, 1)).toUpperCase() || "?";

// ── память и подписка ───────────────────────────────────────────────────────────────────
let LIST = undefined;            // нормализованный список; null — нет входа; "missing" — нет этапа 52
let LIST_P = null;
let LIST_TOK = null;             // чей список: вошёл другой человек — «кто я» и права заново
let failAt = 0;                  // когда список не пришёл (нет связи, вход устарел): минуту не дёргаем сервер из каждого кружка
export const SP_RETRY_MS = 60000;
const tokNow = () => { try { return saToken() || ""; } catch (e) { return ""; } };
const sameUser = () => { const t = tokNow(); if (LIST_TOK !== t) { LIST_TOK = t; LIST = undefined; LIST_P = null; failAt = 0; } return t; };
const cacheKey = () => SP_CACHE + ":" + tokNow().slice(-12);
const TH = new Map();            // "сотрудник|версия" → data: URL превью или обещание
const FH = new Map();            // то же — фото целиком
const subs = new Set();
const emit = () => { for (const f of subs) { try { f(LIST); } catch (e) { /* */ } } };
export const staffPhotoSubscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

const readCache = () => { try { const v = JSON.parse(localStorage.getItem(cacheKey()) || "null"); return v && Array.isArray(v.items) && v.byId ? v : null; } catch (e) { return null; } };
const writeCache = (v) => { try { if (v && Array.isArray(v.items)) localStorage.setItem(cacheKey(), JSON.stringify(v)); } catch (e) { /* */ } };

/** То, что уже известно, без запроса: из памяти или с телефона */
export function staffPhotoListNow() {
  sameUser();
  if (LIST !== undefined) return LIST;
  return readCache() || null;
}

/** Список с сервера (раз за заход; force — заново). Обещание: список, "missing" или null */
export function loadStaffPhotos(force = false, now = Date.now()) {
  sameUser();
  if (!force && LIST !== undefined && LIST !== null) return Promise.resolve(LIST);
  if (LIST_P && !force) return LIST_P;
  const tok = saToken();
  if (!tok) return Promise.resolve(null);
  if (!force && failAt && now - failAt < SP_RETRY_MS) return Promise.resolve(staffPhotoListNow());
  const p = rpc("staff_photos", { p_token: tok }).then((raw) => {
    if (tok !== tokNow()) return staffPhotoListNow();   // пока ехал ответ, вошёл другой человек
    if (rpcMissing(raw)) { LIST = "missing"; failAt = 0; emit(); return LIST; }
    const n = normStaffPhotos(raw);
    if (n) { LIST = n; failAt = 0; writeCache(n); emit(); pruneStaffPhotos(n); } else failAt = Date.now();
    return n || staffPhotoListNow();
  }).catch(() => { failAt = Date.now(); return staffPhotoListNow(); }).finally(() => { if (LIST_P === p) LIST_P = null; });
  LIST_P = p;
  return p;
}

// ── фото на телефоне (lib/photo-store.js): ключ «sp:<сотрудник>|<версия>» ──────────────────────────────────────
const storeKey = (id, ver) => "sp:" + id + "|" + ver;
let warmP = null;
/** Превью с телефона — в память, разом (зовётся при запуске): кружки с фото встают сразу. → сколько подняли */
export function warmStaffPhotos() {
  if (warmP) return warmP;
  warmP = photoAll(false).then((rows) => {
    let n = 0;
    for (const [key, url] of rows) {
      if (!key.startsWith("sp:")) continue;
      const k = key.slice(3);
      if (!TH.has(k)) { TH.set(k, url); n++; }
    }
    return n;
  }).catch(() => 0);
  return warmP;
}
/** Пришёл свежий список — прежние версии и снятые фото с телефона убираем */
export function pruneStaffPhotos(list) {
  if (!list || list === "missing" || !Array.isArray(list.items)) return Promise.resolve(0);
  const live = new Set(list.items.map((x) => storeKey(x.id, x.ver)));
  return photoPrune("sp", (key) => live.has(key));
}

// ── превью: сначала память, потом телефон, потом сервер — пачкой ──────────────────────────────────────────
let queue = new Map();           // сотрудник → { ver, done: [resolve] } — ждут одного общего запроса
let timer = null;
const urlOf = (it) => "data:" + (it.mime || "image/jpeg") + ";base64," + it.data;
function flush() {
  timer = null;
  const batch = queue; queue = new Map();
  const ids = [...batch.keys()];
  const tok = saToken();
  const fail = (part) => { for (const id of part) { const q = batch.get(id); TH.delete(id + "|" + q.ver); for (const r of q.done) r(null); } };
  if (!tok || !ids.length) { fail(ids); return; }
  for (let i = 0; i < ids.length; i += SP_BATCH) {
    const part = ids.slice(i, i + SP_BATCH);
    rpc("staff_photo", { p_token: tok, p_ids: part, p_full: false }).then((r) => {
      if (rpcMissing(r)) { LIST = "missing"; emit(); }
      const got = new Map();
      for (const it of r && r.ok === true && Array.isArray(r.items) ? r.items : []) if (it && it.id != null && it.data) got.set(String(it.id), it);
      for (const id of part) {
        const q = batch.get(id), it = got.get(id), k = id + "|" + q.ver;
        if (!it) { TH.delete(k); for (const res of q.done) res(null); continue; }
        const url = urlOf(it);
        TH.set(k, url);
        // на телефон — только если сервер отдал именно ту версию, что в списке (фото могли сменить минуту назад)
        if (!it.ver || String(it.ver) === String(q.ver)) photoPut(false, storeKey(id, q.ver), url);
        for (const res of q.done) res(url);
      }
    }).catch(() => fail(part));
  }
}
const fromServer = (id, ver) => new Promise((res) => {
  const q = queue.get(id);
  if (q && q.ver === ver) q.done.push(res);
  else { if (q) for (const r of q.done) r(null); queue.set(id, { ver, done: [res] }); }   // версию успели сменить — прежним ждущим пусто
  if (!timer) timer = setTimeout(flush, 40);
});

/** Уже загруженное превью (без запроса) или null */
export const staffThumbCached = (id, ver) => { const v = TH.get(id + "|" + ver); return typeof v === "string" ? v : null; };
/** Превью сотрудника как data: URL. Без входа, без сети и без фото — null */
export function staffThumbUrl(id, ver) {
  if (!id || !ver) return Promise.resolve(null);
  const k = id + "|" + ver;
  const have = TH.get(k);
  if (have) return typeof have === "string" ? Promise.resolve(have) : have;
  if (!saToken()) return Promise.resolve(null);
  const p = photoGet(false, storeKey(id, ver)).then((saved) => {
    if (saved) { TH.set(k, saved); return saved; }
    return fromServer(String(id), String(ver));
  }).catch(() => { TH.delete(k); return null; });
  TH.set(k, p);
  return p;
}
/** Фото сотрудника целиком (512 точек) — для листа «Моё фото» */
export function staffFullUrl(id, ver) {
  if (!id || !ver) return Promise.resolve(null);
  const k = id + "|" + ver;
  const have = FH.get(k);
  if (have) return typeof have === "string" ? Promise.resolve(have) : have;
  const tok = saToken();
  if (!tok) return Promise.resolve(null);
  const p = photoGet(true, storeKey(id, ver)).then((saved) => {
    if (saved) { FH.set(k, saved); return saved; }
    return rpc("staff_photo", { p_token: tok, p_ids: [String(id)], p_full: true }).then((r) => {
      const it = r && r.ok === true && Array.isArray(r.items) ? r.items[0] : null;
      if (!it || !it.data) { FH.delete(k); return null; }
      const url = urlOf(it);
      FH.set(k, url);
      if (!it.ver || String(it.ver) === String(ver)) photoPut(true, storeKey(id, ver), url);
      return url;
    });
  }).catch(() => { FH.delete(k); return null; });
  FH.set(k, p);
  return p;
}

// ── поставить и убрать ──────────────────────────────────────────────────────────────────
const setList = (next) => { LIST = next; writeCache(next); emit(); pruneStaffPhotos(next); };
/**
 * Поставить фото. photo — что вернул squarePhoto: { full, thumb, fullUrl, thumbUrl }. person — чьё: { id, name, surname,
 * restaurant } (своё — из профиля; id пустой — сервер поставит тому, кто вошёл).
 * Ответ: { ok: true, id, ver } или { ok: false, error } (missing, auth, forbidden, not_found, bad_photo, net)
 */
export async function saveStaffPhoto(photo, person = null) {
  if (!photo || !photo.full || !photo.thumb) return { ok: false, error: "bad_request" };
  if (photo.full.length > SP_LIMITS.full || photo.thumb.length > SP_LIMITS.thumb) return { ok: false, error: "big" };
  let r;
  try { r = await rpc("staff_photo_set", { p_token: saToken(), p_emp: person && person.id ? String(person.id) : null, p_full: photo.full, p_thumb: photo.thumb }); } catch (e) { return { ok: false, error: "net" }; }
  if (rpcMissing(r)) { LIST = "missing"; emit(); return { ok: false, error: "missing" }; }
  if (!r || r.ok !== true || !r.ver || !r.id) return { ok: false, error: (r && r.error) || "net" };
  const id = String(r.id), ver = String(r.ver), k = id + "|" + ver;
  if (photo.thumbUrl) { TH.set(k, photo.thumbUrl); photoPut(false, storeKey(id, ver), photo.thumbUrl); }
  if (photo.fullUrl) { FH.set(k, photo.fullUrl); photoPut(true, storeKey(id, ver), photo.fullUrl); }
  const base = LIST && LIST !== "missing" ? LIST : { me: "", restaurant: "", can: { lead: false, network: false }, items: [], byId: {} };
  const old = base.byId[id];
  const one = { id, name: String((person && person.name) || (old && old.name) || ""), surname: String((person && person.surname) || (old && old.surname) || ""),
    restaurant: String((person && person.restaurant) || (old && old.restaurant) || base.restaurant || ""), ver, tok: [] };
  one.tok = tokensOf(one.name, one.surname);
  const items = base.items.filter((x) => x.id !== id).concat([one]);
  setList({ ...base, items, byId: { ...base.byId, [id]: one } });
  return { ok: true, id, ver };
}

/** Убрать фото: своё (empId пустой) или чужое — кому можно (руководитель у своих) */
export async function removeStaffPhoto(empId = null) {
  let r;
  try { r = await rpc("staff_photo_del", { p_token: saToken(), p_emp: empId ? String(empId) : null }); } catch (e) { return { ok: false, error: "net" }; }
  if (rpcMissing(r)) { LIST = "missing"; emit(); return { ok: false, error: "missing" }; }
  if (!r || r.ok !== true) return { ok: false, error: (r && r.error) || "net" };
  const id = String(r.id || empId || "");
  if (LIST && LIST !== "missing" && id) {
    const byId = { ...LIST.byId }; delete byId[id];
    setList({ ...LIST, items: LIST.items.filter((x) => x.id !== id), byId });
  }
  return { ok: true, id };
}

/** Чьи фото может убрать руководитель: своего заведения, а владелец и руководящий состав — все. Себя в списке нет */
export function staffPhotosToModerate(list) {
  if (!list || list === "missing" || !list.can || !(list.can.lead || list.can.network)) return [];
  return list.items.filter((x) => x.id !== list.me && (list.can.network || (!!list.restaurant && x.restaurant === list.restaurant)));
}

/** Текст ошибки для листа «Моё фото» */
export function staffPhotoErr(code, owner = false) {
  switch (code) {
    case "missing": return owner
      ? "На сервере нет этапа 52. Supabase → SQL Editor → файл supabase-stage52-staff-photos.sql → Run, и фото заработают."
      : "Фото сотрудников заработают, когда владелец обновит сервер (этап 52).";
    case "forbidden": return "Убрать чужое фото может руководитель заведения.";
    case "not_found": return "Этого сотрудника уже нет в списке.";
    case "auth": return "Вход устарел. Открой приложение заново.";
    case "bad_photo": return "Фото не подошло. Попробуй другое (JPEG или PNG).";
    case "type": return "Это не картинка. Выбери фото.";
    case "decode": return "Телефон не смог открыть это фото. Попробуй другое.";
    case "big": return "Фото слишком большое даже после сжатия. Попробуй другое.";
    default: return "Не получилось: нет связи с сервером. Попробуй ещё раз.";
  }
}

// ── кадр: квадрат на фото, который попадёт в кружок ─────────────────────────────────────────────────────
export const CROP_MAX_ZOOM = 4;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/** Сторона кадра в точках фото при увеличении z (1 — весь короткий край) */
export const cropSide = (iw, ih, z) => Math.min(iw, ih) / clamp(Number(z) || 1, 1, CROP_MAX_ZOOM);
/** Кадр не выходит за края фото: { cx, cy, z } — центр кадра в точках фото и увеличение */
export function cropClamp(c, iw, ih) {
  const z = clamp(Number(c && c.z) || 1, 1, CROP_MAX_ZOOM), h = cropSide(iw, ih, z) / 2;
  return { cx: clamp(Number(c && c.cx) || 0, h, Math.max(h, iw - h)), cy: clamp(Number(c && c.cy) || 0, h, Math.max(h, ih - h)), z };
}
/** С чего начать: по центру; у вертикального фото — чуть выше середины (лицо обычно там) */
export const cropInit = (iw, ih) => cropClamp({ cx: iw / 2, cy: ih > iw * 1.15 ? ih * 0.42 : ih / 2, z: 1 }, iw, ih);
/** Сдвиг пальцем на dx, dy точек экрана при окне size точек: фото едет за пальцем */
export function cropMove(c, dx, dy, iw, ih, size) {
  const k = cropSide(iw, ih, c.z) / Math.max(1, size);
  return cropClamp({ cx: c.cx - dx * k, cy: c.cy - dy * k, z: c.z }, iw, ih);
}
/** Новое увеличение (центр кадра на месте, если влезает) */
export const cropZoom = (c, z, iw, ih) => cropClamp({ cx: c.cx, cy: c.cy, z }, iw, ih);
/** Квадрат в точках фото: { sx, sy, side } */
export function cropRect(c, iw, ih) {
  const k = cropClamp(c, iw, ih), side = cropSide(iw, ih, k.z);
  return { sx: Math.max(0, k.cx - side / 2), sy: Math.max(0, k.cy - side / 2), side };
}

const blobOf = (canvas, q) => new Promise((res) => { try { canvas.toBlob((b) => res(b), "image/jpeg", q); } catch (e) { res(null); } });
const dataUrlOf = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result || ""));
  r.onerror = () => rej(r.error || new Error("read"));
  r.readAsDataURL(blob);
});
async function drawSquare(src, rect, side, maxBytes, qs) {
  const c = document.createElement("canvas");
  c.width = side; c.height = side;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#fff"; g.fillRect(0, 0, side, side);   // прозрачный PNG — на белом
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(src, rect.sx, rect.sy, rect.side, rect.side, 0, 0, side, side);
  for (const q of qs) { const b = await blobOf(c, q); if (b && b.size <= maxBytes) return b; }
  return null;
}
/**
 * Вырезать кадр и сжать: src — картинка (canvas, ImageBitmap или <img>), rect — cropRect.
 * → { full, thumb } — base64 без префикса (для сервера), fullUrl и thumbUrl — для показа сразу. Ошибка: "big".
 */
export async function squarePhoto(src, rect) {
  const side = Math.round(Math.min(SP_SIDE.full, Math.max(SP_SIDE.thumb, rect.side)));   // маленькое фото не раздуваем
  const full = await drawSquare(src, rect, side, SP_BYTES.full, [0.86, 0.78, 0.68, 0.56]);
  const thumb = await drawSquare(src, rect, SP_SIDE.thumb, SP_BYTES.thumb, [0.82, 0.72, 0.6, 0.48]);
  if (!full || !thumb) throw new Error("big");
  const [fullUrl, thumbUrl] = await Promise.all([dataUrlOf(full), dataUrlOf(thumb)]);
  return { full: fullUrl.slice(fullUrl.indexOf(",") + 1), thumb: thumbUrl.slice(thumbUrl.indexOf(",") + 1), fullUrl, thumbUrl, bytes: full.size + thumb.size };
}

/** Для проверок: забыть всё, что в памяти */
export function _resetStaffPhotos() { LIST = undefined; LIST_P = null; LIST_TOK = null; failAt = 0; TH.clear(); FH.clear(); queue = new Map(); if (timer) { clearTimeout(timer); timer = null; } warmP = null; }
