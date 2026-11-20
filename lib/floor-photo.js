// lib/floor-photo.js — v179 (Доп. 504): фото плана зала на телефоне — подложка под сеткой редактора схемы.
//
// • Своё фото у каждого зала: ключ «<заведение>|<зал>». Лежит в IndexedDB (база «sa_floor»), а не в localStorage: там
//   ~5 МБ на всё приложение, а фото плана — до полумегабайта. Схему зала видит вся смена, фото — только тот, кто рисует.
// • Фото сжимается на телефоне: длинная сторона — до 1600 точек (план с мелкими подписями остаётся читаемым).
// • Для ИИ — копия до 1568 точек (больше Claude не смотрит, уменьшает сам) с сеткой поверх: линии через каждые 10%
//   ширины и высоты с подписями — по ним модель точнее называет, где стоит стол.
// • После распознавания подложка обрезается по залу и, если надо, поворачивается — как столы легли на сетку.
// • v181: для второго прохода (стулья у каждого стола) столы вырезаются из фото крупно — tableCrops.
// • v182: номера на столах в этих картинках закрыты пятном цвета стола (maskOf) — модель считает стулья, а не читает
//   номер: на плане из кассы у стола 15 выходило 15 мест.
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

/** v181 (Доп. 506): где вырезать стол для второго прохода — рамка стола (проценты фото) с запасом под стулья:
 *  по краям — половина меньшей стороны стола, не меньше 2% фото. → [x1, y1, x2, y2] в процентах, в пределах фото */
export function cropOf(b) {
  const bw = b[2] - b[0], bh = b[3] - b[1], p = Math.max(0.5 * Math.min(bw, bh), 2);
  return [Math.max(0, b[0] - p), Math.max(0, b[1] - p), Math.min(100, b[2] + p), Math.min(100, b[3] + p)];
}
/** v182 (Доп. 507): чем закрыть номер на столе в картинке второго прохода. b — рамка столешницы (проценты фото),
 *  round — круглый стол. → { pts — 8 точек столешницы вокруг надписи (по ним берётся цвет стола), e: [cx, cy, rx, ry] —
 *  эллипс у круглого или r: [x1, y1, x2, y2] — прямоугольник у прочих }. Пятно — середина столешницы: у круглого 76%
 *  поперечника, у прочих — без 14% с каждого края. Номер и время под ним закрыты; край стола и стулья видны. */
export function maskOf(b, round = false) {
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, w = b[2] - b[0], h = b[3] - b[1];
  // точки — между пятном и краем стола: по осям 0,42 от середины, по диагоналям у круглого 0,3 (иначе мимо круга)
  const q = round ? 0.3 : 0.42;
  const pts = [[0.42, 0], [-0.42, 0], [0, 0.42], [0, -0.42], [q, q], [-q, q], [q, -q], [-q, -q]].map(([a, d]) => [cx + a * w, cy + d * h]);
  return round ? { pts, e: [cx, cy, 0.38 * w, 0.38 * h] } : { pts, r: [b[0] + 0.14 * w, b[1] + 0.14 * h, b[2] - 0.14 * w, b[3] - 0.14 * h] };
}
const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
/** Закрыть номера на столах в картинке: цвет — средний (медиана) по точкам столешницы до закраски. at(x, y) — точка
 *  фото (проценты) → точка картинки. Стол почти весь за краем картинки (меньше трёх точек внутри) не трогаем. */
function hideNumbers(c, g, masks, at) {
  if (!masks.length) return;
  let px;
  try { px = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { return; }
  const inside = ([x, y]) => x >= 0 && y >= 0 && x < c.width && y < c.height;
  for (const t of masks) {
    const m = maskOf(t.b, t.round), pts = m.pts.map(([x, y]) => at(x, y)).filter(inside);
    if (pts.length < 3) continue;
    const col = [0, 1, 2].map((ch) => pts.map(([x, y]) => px[(Math.floor(y) * c.width + Math.floor(x)) * 4 + ch]).sort((a, b) => a - b)[pts.length >> 1]);
    g.fillStyle = "rgb(" + col.join(",") + ")";
    g.beginPath();
    if (m.e) {
      const [cx, cy] = at(m.e[0], m.e[1]), [ex, ey] = at(m.e[0] + m.e[2], m.e[1] + m.e[3]);
      g.ellipse(cx, cy, Math.max(0.5, Math.abs(ex - cx)), Math.max(0.5, Math.abs(ey - cy)), 0, 0, Math.PI * 2);
    } else {
      const [ax, ay] = at(m.r[0], m.r[1]), [bx, by] = at(m.r[2], m.r[3]);
      g.rect(ax, ay, bx - ax, by - ay);
    }
    g.fill();
  }
}
/** v181: каждый стол крупно, отдельной картинкой (длинная сторона — 224 точки, мелкие увеличиваются) → [data: URL].
 *  v182: masks — все столы плана [{ b, round }]: номера тех, что попали в картинку (свой и соседние), закрыты. */
export async function tableCrops(rec, boxes, side = 224, masks = []) {
  const img = await imgOf(rec.data);
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const all = (Array.isArray(masks) ? masks : []).filter((m) => m && Array.isArray(m.b) && m.b.length === 4);
  return boxes.map((b) => {
    const area = cropOf(b), [x1, y1, x2, y2] = area;
    const sx = (x1 / 100) * W, sy = (y1 / 100) * H, sw = Math.max(1, ((x2 - x1) / 100) * W), sh = Math.max(1, ((y2 - y1) / 100) * H);
    const k = side / Math.max(sw, sh), [c, g] = canvas(Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k)));
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    hideNumbers(c, g, all.filter((m) => overlaps(m.b, area)), (x, y) => [((x / 100) * W - sx) * k, ((y / 100) * H - sy) * k]);
    return jpeg(c, [0.85, 0.75], 300000);
  });
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
