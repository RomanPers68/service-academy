// lib/chat-photo.js — v90 (Доп. 403): фото в чат смены сжимается на телефоне до отправки. Длинная сторона — до 1280
// точек (JPEG), превью для ленты — до 360. Фото с камеры весит 3–5 МБ, после сжатия — 100–300 КБ: быстро уходит по
// мобильной связи и не съедает место на сервере. Расчёт размеров — fitSize в lib/chat.js.
import { fitSize } from "./chat";

export const PHOTO_SIDE = 1280;
export const THUMB_SIDE = 360;
export const PHOTO_MAX_BYTES = 300 * 1024;
export const THUMB_MAX_BYTES = 48 * 1024;

const blobOf = (canvas, q) => new Promise((res) => { try { canvas.toBlob((b) => res(b), "image/jpeg", q); } catch (e) { res(null); } });
const dataUrlOf = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result || ""));
  r.onerror = () => rej(r.error || new Error("read"));
  r.readAsDataURL(blob);
});
// картинка из файла: сначала createImageBitmap (поворот по EXIF), иначе через <img>
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { /* ниже */ }
  }
  return await new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 0); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("decode")); };
    img.src = url;
  });
}
// рисуем в нужный размер и подбираем качество, пока не влезет в предел
async function draw(src, sw, sh, side, maxBytes, qs) {
  const { w, h } = fitSize(sw, sh, side);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);   // прозрачный PNG — на белом
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, w, h);
  for (const q of qs) { const b = await blobOf(c, q); if (b && b.size <= maxBytes) return { blob: b, w, h }; }
  return null;
}

/**
 * Сжать фото для чата. Возвращает { full, thumb } — base64 без префикса (для сервера), fullUrl и thumbUrl — для показа
 * сразу, w и h — размер сжатого фото. Ошибки: "type" (не картинка), "decode" (телефон не открыл), "big" (не сжалось).
 */
export async function compressPhoto(file) {
  if (!file || (file.type && !/^image\//.test(file.type))) throw new Error("type");
  const src = await decode(file);
  const sw = src.width || src.naturalWidth || 0, sh = src.height || src.naturalHeight || 0;
  if (!sw || !sh) throw new Error("decode");
  let full = await draw(src, sw, sh, PHOTO_SIDE, PHOTO_MAX_BYTES, [0.82, 0.72, 0.62, 0.52]);
  if (!full) full = await draw(src, sw, sh, 960, PHOTO_MAX_BYTES, [0.7, 0.55, 0.45]);
  const thumb = await draw(src, sw, sh, THUMB_SIDE, THUMB_MAX_BYTES, [0.72, 0.6, 0.5, 0.4]);
  try { if (typeof src.close === "function") src.close(); } catch (e) { /* */ }
  if (!full || !thumb) throw new Error("big");
  const [fullUrl, thumbUrl] = await Promise.all([dataUrlOf(full.blob), dataUrlOf(thumb.blob)]);
  return { full: fullUrl.slice(fullUrl.indexOf(",") + 1), thumb: thumbUrl.slice(thumbUrl.indexOf(",") + 1), fullUrl, thumbUrl, w: full.w, h: full.h, bytes: full.blob.size + thumb.blob.size };
}
