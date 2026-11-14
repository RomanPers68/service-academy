// lib/photo-store.js — v158 (Доп. 483): фото лежат на телефоне, а не только в памяти открытого приложения.
//
// Владелец (14.11) на «что ещё заметил»: «Давай все пять». Второе из пяти: фото уроков, обложки разделов (а теперь и
// фото сотрудников) жили в памяти до закрытия приложения — при каждом новом запуске обложки подгружались заново и
// появлялись с задержкой, а в зале со слабой связью могли не появиться вовсе. Теперь фото, раз скачанное, остаётся на
// телефоне: ключ — «<вид>:<номер>|<версия>», сменили фото — версия другая, старое вычищается.
//   • IndexedDB, база «sa_photos»: хранилище «t» — превью (маленькие, читаются все разом при запуске),
//     «f» — фото целиком (читаются по одному, когда нужны; держим не больше FULL_KEEP последних). Запись — { v, t }:
//     само фото и когда им пользовались; по t есть указатель, поэтому уборка читает только ключи и время, не фото.
//   • В localStorage фото не кладём: там ~5 МБ на всё приложение, а одно фото целиком — до полумегабайта.
//   • Нет IndexedDB (старый телефон, закрытый режим) или переполнено — всё работает как раньше, из памяти и с сервера.
// Кто пользуется: lib/lesson-photo.js (вид «lp»), lib/staff-photo.js (вид «sp»).
const DB_NAME = "sa_photos";
export const FULL_KEEP = 48;       // фото целиком на телефоне: не больше стольких, самые давние уходят
const names = (full) => (full ? "f" : "t");

// ── настоящее хранилище ─────────────────────────────────────────────────────────────────
let dbP = null;
function openDb() {
  if (dbP) return dbP;
  dbP = new Promise((res) => {
    try {
      const idb = typeof indexedDB !== "undefined" ? indexedDB : null;
      if (!idb) { res(null); return; }
      const rq = idb.open(DB_NAME, 1);
      rq.onupgradeneeded = () => {
        const d = rq.result;
        for (const n of ["t", "f"]) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n).createIndex("t", "t");
      };
      rq.onsuccess = () => { const d = rq.result; d.onversionchange = () => { try { d.close(); } catch (e) { /* */ } dbP = null; }; res(d); };
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
  return dbP;
}
// одна операция: work(хранилище, set) — что передали в set, то и вернётся, когда запись на диск завершена
const run = (store, mode, work, none) => openDb().then((db) => (db ? new Promise((res) => {
  let out = none;
  try {
    const t = db.transaction(store, mode);
    t.oncomplete = () => res(out);
    t.onerror = () => res(none);
    t.onabort = () => res(none);
    work(t.objectStore(store), (v) => { out = v; });
  } catch (e) { res(none); }
}) : none)).catch(() => none);

const idbBackend = {
  get: (store, key) => run(store, "readonly", (os, set) => { const r = os.get(key); r.onsuccess = () => set(r.result && r.result.v ? r.result : null); }, null),
  put: (store, key, rec) => run(store, "readwrite", (os, set) => { os.put(rec, key); set(true); }, false),
  all: (store) => run(store, "readonly", (os, set) => {
    const rows = []; set(rows);
    const c = os.openCursor();
    c.onsuccess = () => { const cur = c.result; if (!cur) return; rows.push([String(cur.key), cur.value]); cur.continue(); };
  }, []),
  // ключи и время без самих фото (по указателю «t»): [[ключ, когда]]
  keys: (store) => run(store, "readonly", (os, set) => {
    const rows = []; set(rows);
    const c = os.index("t").openKeyCursor();
    c.onsuccess = () => { const cur = c.result; if (!cur) return; rows.push([String(cur.primaryKey), Number(cur.key) || 0]); cur.continue(); };
  }, []),
  del: (store, keys) => run(store, "readwrite", (os, set) => { for (const k of keys) os.delete(k); set(keys.length); }, 0),
};

/** Хранилище в памяти: для проверок и для страницы без IndexedDB (то же поведение, только до закрытия) */
export function memoryBackend() {
  const m = { t: new Map(), f: new Map() };
  return {
    get: (s, k) => Promise.resolve(m[s].get(k) || null),
    put: (s, k, rec) => { m[s].set(k, rec); return Promise.resolve(true); },
    all: (s) => Promise.resolve([...m[s].entries()]),
    keys: (s) => Promise.resolve([...m[s].entries()].map(([k, rec]) => [k, Number(rec && rec.t) || 0])),
    del: (s, keys) => { let n = 0; for (const k of keys) if (m[s].delete(k)) n++; return Promise.resolve(n); },
    size: (s) => m[s].size,
  };
}
let backend = idbBackend;
/** Подменить хранилище (проверки). null — вернуть настоящее */
export function setPhotoBackend(b) { backend = b || idbBackend; }

const okKey = (k) => typeof k === "string" && k.length > 3 && k.length < 200;
const okUrl = (u) => typeof u === "string" && u.startsWith("data:image/") && u.length < 1200000;

const DAY = 86400000;
/** Фото с телефона (data: URL) или null */
export function photoGet(full, key, now = Date.now()) {
  if (!okKey(key)) return Promise.resolve(null);
  return Promise.resolve().then(() => backend.get(names(full), key)).then((r) => {
    if (!r || !okUrl(r.v)) return null;
    // целым фото пользуются до сих пор — отмечаем (не чаще раза в сутки), чтобы уборка не сочла его давним
    if (full && now - (Number(r.t) || 0) > DAY) Promise.resolve().then(() => backend.put("f", key, { v: r.v, t: now })).catch(() => {});
    return r.v;
  }).catch(() => null);
}
/** Положить фото на телефон. Не вышло (нет места, нет хранилища) — не страшно: останется в памяти */
export function photoPut(full, key, url, now = Date.now()) {
  if (!okKey(key) || !okUrl(url)) return Promise.resolve(false);
  return Promise.resolve().then(() => backend.put(names(full), key, { v: url, t: now })).then((x) => !!x).catch(() => false);
}
/** Все превью (или все фото целиком) с телефона: [[ключ, data: URL]] */
export function photoAll(full = false) {
  return Promise.resolve().then(() => backend.all(names(full)))
    .then((rows) => (Array.isArray(rows) ? rows : []).filter((x) => x && okKey(x[0]) && x[1] && okUrl(x[1].v)).map((x) => [x[0], x[1].v]))
    .catch(() => []);
}
/** Убрать фото с телефона по ключам (и превью, и целое) */
export function photoDrop(keys) {
  const ks = (Array.isArray(keys) ? keys : []).filter(okKey);
  if (!ks.length) return Promise.resolve(0);
  return Promise.all([backend.del("t", ks), backend.del("f", ks)]).then((a) => (Number(a[0]) || 0) + (Number(a[1]) || 0)).catch(() => 0);
}
/**
 * Прибраться: у вида kind («lp», «sp») оставить только ключи, для которых keep(ключ) — правда (остальные — старые
 * версии и снятые фото), а фото целиком — не больше FULL_KEEP самых свежих на всех. → сколько убрано.
 */
export async function photoPrune(kind, keep, maxFull = FULL_KEEP) {
  const pre = String(kind || "") + ":";
  let gone = 0;
  try {
    for (const store of ["t", "f"]) {
      const rows = await backend.keys(store);
      const list = (Array.isArray(rows) ? rows : []).filter((x) => x && okKey(x[0]));
      const dead = list.filter((x) => x[0].startsWith(pre) && !keep(x[0])).map((x) => x[0]);
      if (store === "f") {
        const gone1 = new Set(dead);
        const alive = list.filter((x) => !gone1.has(x[0])).sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
        for (const x of alive.slice(Math.max(0, maxFull))) dead.push(x[0]);
      }
      if (dead.length) gone += Number(await backend.del(store, dead)) || 0;
    }
  } catch (e) { /* не прибрались — приберёмся в следующий раз */ }
  return gone;
}
