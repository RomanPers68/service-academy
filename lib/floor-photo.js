// lib/floor-photo.js — v179 (Доп. 504): фото плана зала на телефоне — подложка под сеткой редактора схемы.
//
// • Своё фото у каждого зала: ключ «<заведение>|<зал>». Лежит в IndexedDB (база «sa_floor»), а не в localStorage: там
//   ~5 МБ на всё приложение, а фото плана — до полумегабайта. Схему зала видит вся смена, фото — только тот, кто рисует.
// • Фото сжимается на телефоне: длинная сторона — до 1600 точек (план с мелкими подписями остаётся читаемым).
// • Для ИИ — копия до 1568 точек (больше Claude не смотрит, уменьшает сам) с сеткой поверх: линии через каждые 10%
//   ширины и высоты с подписями — по ним модель точнее называет, где стоит стол.
// • После распознавания подложка обрезается по залу и, если надо, поворачивается — как столы легли на сетку.
import { decodePhoto } from "./chat-photo";

export const BG_SIDE = 1600, AI_SIDE = 1568, BG_OPACITY = 0.5;
const DB_NAME = "sa_floor", STORE = "bg";

// ── хранилище ───────────────────────────────────────────────────────────────────────
let dbP = null;
function openDb() {
  if (dbP) return dbP;
  dbP = new Promise((res) => {
    try {
      const idb = typeof indexedDB !== "undefined" ? indexedDB : null;
      if (!idb) { res(null); return; }
      const rq = idb.open(DB_NAME, 1);
      rq.onupgradeneeded = () => { const d = rq.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE); };
      rq.onsuccess = () => { const d = rq.result; d.onversionchange = () => { try { d.close(); } catch (e) { /* */ } dbP = null; }; res(d); };
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
  return dbP;
}
const run = (mode, work, none) => openDb().then((db) => (db ? new Promise((res) => {
  let out = none;
  try {
    const t = db.transaction(STORE, mode);
    t.oncomplete = () => res(out);
    t.onerror = () => res(none);
    t.onabort = () => res(none);
    work(t.objectStore(STORE), (v) => { out = v; });
  } catch (e) { res(none); }
}) : none)).catch(() => none);
const idbBackend = {
  get: (k) => run("readonly", (os, set) => { const r = os.get(k); r.onsuccess = () => set(r.result || null); }, null),
  put: (k, v) => run("readwrite", (os, set) => { os.put(v, k); set(true); }, false),
  del: (k) => run("readwrite", (os, set) => { os.delete(k); set(true); }, false),
};
/** Хранилище в памяти — для проверок и для телефона без IndexedDB (фото живёт до закрытия приложения) */
export function memoryBgBackend() {
  const m = new Map();
  return { get: (k) => Promise.resolve(m.get(k) || null), put: (k, v) => { m.set(k, v); return Promise.resolve(true); }, del: (k) => Promise.resolve(m.delete(k)), size: () => m.size };
}
let backend = idbBackend;
const mem = memoryBgBackend();
/** Подменить хранилище (проверки). null — вернуть настоящее */
export function setBgBackend(b) { backend = b || idbBackend; }

export const bgKey = (rest, z) => String(rest || "") + "|" + String(z || "z1");
/** Запись подложки годится: фото data: URL, размеры, прозрачность 0,15–0,85 */
export function okBg(r) {
  return !!r && typeof r.data === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(r.data) && r.data.length < 4000000
    && Number(r.w) > 0 && Number(r.h) > 0;
}
/** Где фото лежит на сетке после распознавания: [x, y, ширина] в клетках (столы встали точно на фото); нет — во всю ширину */
export const okAt = (a) => Array.isArray(a) && a.length === 3 && a.every((v) => typeof v === "number" && Number.isFinite(v)) && a[2] >= 1 && a[2] <= 16 && Math.abs(a[0]) <= 16 && Math.abs(a[1]) <= 30;
const norm = (r) => ({ data: r.data, w: Math.round(Number(r.w)), h: Math.round(Number(r.h)), op: Math.max(0.15, Math.min(0.85, Number(r.op) || BG_OPACITY)), ...(okAt(r.at) ? { at: r.at.slice() } : {}) });
/** Подложка зала или null */
export function bgGet(rest, z) {
  const k = bgKey(rest, z);
  return Promise.resolve().then(() => backend.get(k)).then((r) => (okBg(r) ? norm(r) : mem.get(k))).then((r) => (okBg(r) ? norm(r) : null)).catch(() => null);
}
/** Положить подложку. Не легло в IndexedDB (нет места, закрытый режим) — держим в памяти до закрытия приложения */
export function bgPut(rest, z, rec) {
  if (!okBg(rec)) return Promise.resolve(false);
  const k = bgKey(rest, z), v = { ...norm(rec), t: Date.now() };
  return Promise.resolve().then(() => backend.put(k, v)).then((ok) => { if (!ok) mem.put(k, v); return true; }).catch(() => { mem.put(k, v); return true; });
}
export function bgDrop(rest, z) {
  const k = bgKey(rest, z);
  mem.del(k);
  return Promise.resolve().then(() => backend.del(k)).then((x) => !!x).catch(() => false);
}

// ── фото ────────────────────────────────────────────────────────────────────────────
const imgOf = (src) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => rej(new Error("decode"));
  img.src = src;
});
const fit = (w, h, side) => { const k = Math.min(1, side / Math.max(w, h)); return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; };
const jpeg = (c, qs, max) => { let d = ""; for (const q of qs) { d = c.toDataURL("image/jpeg", q); if (d.length <= max) break; } return d; };
const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); if (!g) throw new Error("canvas"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; return [c, g]; };

/** Фото с телефона (повёрнутое по EXIF) → { data, w, h }: до 1600 точек, JPEG. Ошибки: "type", "decode" */
export async function loadPlanPhoto(file) {
  if (!file || (file.type && !/^image\//.test(file.type))) throw new Error("type");
  const src = await decodePhoto(file);
  const sw = src.width || src.naturalWidth || 0, sh = src.height || src.naturalHeight || 0;
  if (!sw || !sh) throw new Error("decode");
  const [w, h] = fit(sw, sh, BG_SIDE);
  const [c, g] = canvas(w, h);
  g.drawImage(src, 0, 0, w, h);
  try { if (typeof src.close === "function") src.close(); } catch (e) { /* */ }
  return { data: jpeg(c, [0.82, 0.72, 0.6], 1100000), w, h, op: BG_OPACITY };
}

/** Обрезать (crop — [x1, y1, x2, y2] в процентах) и повернуть по часовой (rot — 0, 90, 180, 270) → { data, w, h, op } */
export async function cropRotate(rec, crop = [0, 0, 100, 100], rot = 0) {
  const img = await imgOf(rec.data);
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const sx = (crop[0] / 100) * W, sy = (crop[1] / 100) * H, sw = Math.max(1, ((crop[2] - crop[0]) / 100) * W), sh = Math.max(1, ((crop[3] - crop[1]) / 100) * H);
  const [ow, oh] = fit(sw, sh, BG_SIDE);
  const turn = ((Number(rot) || 0) % 360 + 360) % 360, side = turn === 90 || turn === 270;
  const [c, g] = canvas(side ? oh : ow, side ? ow : oh);
  g.translate(c.width / 2, c.height / 2);
  g.rotate((turn * Math.PI) / 180);
  g.drawImage(img, sx, sy, sw, sh, -ow / 2, -oh / 2, ow, oh);
  return { data: jpeg(c, [0.82, 0.72, 0.6], 1100000), w: c.width, h: c.height, op: rec.op };
}

/** Копия для ИИ: до 1568 точек, сетка через 10% с подписями (проценты ширины сверху, высоты слева) → { data, w, h } */
export async function aiImage(rec) {
  const img = await imgOf(rec.data);
  const [w, h] = fit(img.naturalWidth || img.width, img.naturalHeight || img.height, AI_SIDE);
  const [c, g] = canvas(w, h);
  g.drawImage(img, 0, 0, w, h);
  const fs = Math.max(11, Math.round(Math.max(w, h) * 0.016));
  g.lineWidth = Math.max(1, Math.round(fs / 10));
  g.strokeStyle = "rgba(230, 0, 120, 0.45)";
  g.font = "bold " + fs + "px sans-serif";
  g.textBaseline = "top";
  for (let i = 1; i < 10; i++) {
    const x = Math.round((w * i) / 10) + 0.5, y = Math.round((h * i) / 10) + 0.5;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }
  const tag = (t, x, y) => {
    const tw = g.measureText(t).width + 6;
    g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(x, y, tw, fs + 4);
    g.fillStyle = "rgba(200, 0, 100, 0.95)"; g.fillText(t, x + 3, y + 2);
  };
  for (let i = 1; i < 10; i++) { tag(String(i * 10), Math.round((w * i) / 10) + 2, 2); tag(String(i * 10), 2, Math.round((h * i) / 10) + 2); }
  return { data: jpeg(c, [0.85, 0.75, 0.65], 1500000), w, h };
}
