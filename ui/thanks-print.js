// ui/thanks-print.js — v87 (Доп. 400): «Картинка для печати» — четыре вида QR «Сказать спасибо» для зала.
//
//   card    — карточка 3:4 на стойку или в рамку (как в v84, в кремово-золотом оформлении страницы гостя);
//   tent    — домик на стол: лист A4, верхняя половина перевёрнута, по пунктиру сгиб — код виден с двух сторон стола;
//   insert  — узкий вкладыш в папку для счёта: «Понравилось, как вас обслужили? Скажите спасибо лично»;
//   sticker — квадратная наклейка на бейдж, кассу или стойку бара, по пунктиру вырезать.
// Рисуется на canvas (PNG): QR — тёмным по белому с полем в 4 модуля, размер модуля целый (чёткие края на печати).
// Проверка: tools/claude/qr-check.py читает код с каждой картинки (у домика — с обеих половин), tests/v87.test.js.
import { qrMatrix } from "../lib/qr";
import { HEART_PATH } from "../lib/guest-thanks";

export const PRINT_LAYOUTS = {
  card: { t: "Карточка", s: "на стойку или в рамку", w: 1080, h: 1440, file: "spasibo-kartochka.png",
    done: "Картинка сохранена: распечатай и поставь на стойку или в рамку." },
  tent: { t: "Домик на стол", s: "лист A4, согнуть пополам", w: 1240, h: 1754, file: "spasibo-domik-a4.png",
    done: "Сохранено. Распечатай на A4 без полей, согни по пунктиру и поставь на стол: код виден с двух сторон." },
  insert: { t: "В папку для счёта", s: "узкий вкладыш", w: 1000, h: 2000, file: "spasibo-vkladysh.png",
    done: "Сохранено. Распечатай, отрежь по рамке и вложи в папку для счёта." },
  sticker: { t: "Наклейка", s: "на бейдж, кассу или бар", w: 1000, h: 1000, file: "spasibo-nakleyka.png",
    done: "Сохранено. Распечатай на бумаге для наклеек и вырежи по пунктиру." },
};
export const PRINT_ORDER = ["card", "tent", "insert", "sticker"];

const INK = "#22170A", GOLD_INK = "#8B6A30", SUB = "#5A4628", LINE = "#B8924A";

/** Шрифты для рисунка: PT Serif с нашего сервера (кириллица «Georgia»). Ждём не дольше 1,5 с, иначе рисуем тем, что есть. */
export function printFontsReady() {
  try {
    const f = typeof document !== "undefined" && document.fonts;
    if (!f || !f.load) return Promise.resolve();
    const all = Promise.all(["44px Georgia", "italic 44px Georgia", "bold 44px Georgia"].map((s) => f.load(s, "Скажите спасибо").catch(() => null)));
    return Promise.race([all, new Promise((r) => setTimeout(r, 1500))]).then(() => {}, () => {});
  } catch (e) { return Promise.resolve(); }
}

// ── мелочи рисования ──
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function paper(ctx, x, y, w, h, r = 0) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "#FCF8EE"); g.addColorStop(1, "#F3E8CF");
  ctx.fillStyle = g;
  if (r) { rrect(ctx, x, y, w, h, r); ctx.fill(); } else ctx.fillRect(x, y, w, h);
}
// двойная рамка: золотая линия и тонкая внутри
function frame(ctx, x, y, w, h, k = 1, r = 0) {
  ctx.save(); ctx.strokeStyle = LINE;
  ctx.lineWidth = 4 * k; if (r) { rrect(ctx, x, y, w, h, r); ctx.stroke(); } else ctx.strokeRect(x, y, w, h);
  const d = 14 * k; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5 * k;
  if (r) { rrect(ctx, x + d, y + d, w - 2 * d, h - 2 * d, Math.max(2, r - d)); ctx.stroke(); } else ctx.strokeRect(x + d, y + d, w - 2 * d, h - 2 * d);
  ctx.restore();
}
// линия — ромбик — линия
function rule(ctx, cx, y, half, k = 1) {
  ctx.save(); ctx.strokeStyle = LINE; ctx.lineWidth = 1.5 * k; ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx - 12 * k, y); ctx.moveTo(cx + 12 * k, y); ctx.lineTo(cx + half, y); ctx.stroke();
  ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(cx, y - 6 * k); ctx.lineTo(cx + 6 * k, y); ctx.lineTo(cx, y + 6 * k); ctx.lineTo(cx - 6 * k, y); ctx.closePath();
  ctx.fillStyle = "#FBF0D6"; ctx.fill(); ctx.stroke(); ctx.restore();
}
// сердце золотой линией — то же, что видит гость после «Спасибо передано» (рисунок 132×114)
function heart(ctx, cx, cy, wpx) {
  if (typeof Path2D === "undefined") return;
  const s = wpx / 132;
  ctx.save(); ctx.translate(cx - 66 * s, cy - 59 * s); ctx.scale(s, s);
  const p = new Path2D(HEART_PATH);
  ctx.fillStyle = "rgba(210,168,90,0.16)"; ctx.fill(p);
  ctx.strokeStyle = LINE; ctx.lineWidth = 2.4; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(p);
  ctx.restore();
}
// текст в одну строку: шрифт уменьшается, пока не влезет в ширину
function fit(ctx, text, x, y, maxW, px, style = "", color = INK, min = 18) {
  const t = String(text || "");
  if (!t) return;
  let s = px;
  for (; s > min; s -= 2) { ctx.font = (style ? style + " " : "") + s + "px Georgia, serif"; if (ctx.measureText(t).width <= maxW) break; }
  ctx.font = (style ? style + " " : "") + s + "px Georgia, serif";
  ctx.fillStyle = color; ctx.fillText(t, x, y);
}
// имя в узкой колонке: в одну строку, если влезает хотя бы на 80% размера, иначе в две (по пробелу, строки поровну).
// Возвращает, на сколько ниже ушёл текст: следующие строки сдвигаются на столько же.
function nameLines(ctx, text, x, y, maxW, px, color = INK) {
  const t = String(text || "").trim();
  if (!t) return 0;
  const words = t.split(/\s+/);
  ctx.font = Math.round(px * 0.8) + "px Georgia, serif";
  if (words.length < 2 || ctx.measureText(t).width <= maxW) { fit(ctx, t, x, y, maxW, px, "", color); return 0; }
  ctx.font = px + "px Georgia, serif";
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (!best || w < best.w) best = { a, b, w };
  }
  const s = Math.max(18, Math.floor(Math.min(px * 0.85, (px * maxW) / best.w)));
  const lh = Math.round(s * 1.15);
  fit(ctx, best.a, x, y, maxW, s, "", color);
  fit(ctx, best.b, x, y + lh, maxW, s, "", color);
  return lh;
}
// QR: белая подложка со скруглением и мягкой тенью, модуль — целое число пикселей
function qrBox(ctx, qr, cx, y0, box) {
  const Q = 4, n = qr.size + 2 * Q, s = Math.max(1, Math.floor(box / n)), side = s * n, x0 = Math.round(cx - side / 2);
  ctx.save(); ctx.shadowColor = "rgba(120,85,25,0.18)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#FFFFFF"; rrect(ctx, x0 - 10, y0 - 10, side + 20, side + 20, 18); ctx.fill(); ctx.restore();
  ctx.fillStyle = INK;
  qr.modules.forEach((row, y) => row.forEach((d, x) => { if (d) ctx.fillRect(x0 + (x + Q) * s, y0 + (y + Q) * s, s, s); }));
  return side;
}

// ── четыре вида ──
function drawCard(ctx, qr, d, W, H) {
  paper(ctx, 0, 0, W, H); frame(ctx, 36, 36, W - 72, H - 72);
  ctx.textAlign = "center";
  heart(ctx, W / 2, 112, 74);
  fit(ctx, d.restaurant || "Service Academy", W / 2, 215, 860, 44, "italic", GOLD_INK);
  fit(ctx, "Скажите спасибо", W / 2, 305, 900, 80);
  if (qr) qrBox(ctx, qr, W / 2, 360, 660);
  fit(ctx, d.name, W / 2, 1135, 900, 72);
  if (d.pos) fit(ctx, d.pos, W / 2, 1195, 860, 42, "italic", GOLD_INK);
  rule(ctx, W / 2, 1245, 170);
  fit(ctx, "Наведите камеру телефона на код", W / 2, 1312, 900, 38, "", SUB);
  fit(ctx, "Без регистрации, за пару секунд", W / 2, 1362, 900, 30, "italic", SUB);
}
// половина домика (альбомная 1240×877): код слева, слова справа
function tentHalf(ctx, qr, d, W, H) {
  paper(ctx, 0, 0, W, H); frame(ctx, 34, 34, W - 68, H - 68);
  if (qr) qrBox(ctx, qr, 92 + 270, (H - 540) / 2, 540);
  const cx = 905, mw = 440;
  ctx.textAlign = "center";
  heart(ctx, cx, 190, 64);
  fit(ctx, d.restaurant || "Service Academy", cx, 290, mw, 36, "italic", GOLD_INK);
  fit(ctx, "Скажите спасибо", cx, 375, mw, 60);
  const e = nameLines(ctx, d.name, cx, 500, mw, 56);
  if (d.pos) fit(ctx, d.pos, cx, 552 + e, mw, 34, "italic", GOLD_INK);
  rule(ctx, cx, 600 + e, 120);
  fit(ctx, "Наведите камеру", cx, 665 + e, mw, 32, "", SUB);
  fit(ctx, "телефона на код", cx, 707 + e, mw, 32, "", SUB);
}
function drawTent(ctx, qr, d, W, H) {
  const h = H / 2;
  ctx.save(); ctx.translate(W, h); ctx.rotate(Math.PI); tentHalf(ctx, qr, d, W, h); ctx.restore();   // верх — вверх ногами
  ctx.save(); ctx.translate(0, h); tentHalf(ctx, qr, d, W, h); ctx.restore();
  ctx.save(); ctx.strokeStyle = "rgba(139,106,48,0.55)"; ctx.lineWidth = 2; ctx.setLineDash([16, 12]);   // сгиб
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(W, h); ctx.stroke(); ctx.restore();
}
function drawInsert(ctx, qr, d, W, H) {
  paper(ctx, 0, 0, W, H); frame(ctx, 34, 34, W - 68, H - 68);
  ctx.textAlign = "center";
  fit(ctx, d.restaurant || "Service Academy", W / 2, 165, 820, 44, "italic", GOLD_INK);
  heart(ctx, W / 2, 245, 70);
  fit(ctx, "Понравилось, как вас", W / 2, 370, 840, 60);
  fit(ctx, "обслужили?", W / 2, 442, 840, 60);
  fit(ctx, "Скажите спасибо лично", W / 2, 522, 840, 46, "italic", GOLD_INK);
  if (qr) qrBox(ctx, qr, W / 2, 590, 700);
  const e = nameLines(ctx, d.name, W / 2, 1400, 840, 72);
  if (d.pos) fit(ctx, d.pos, W / 2, 1462 + e, 820, 42, "italic", GOLD_INK);
  rule(ctx, W / 2, 1515 + e, 160);
  fit(ctx, "Наведите камеру телефона на код", W / 2, 1590 + e, 860, 36, "", SUB);
  fit(ctx, "Без регистрации, за пару секунд", W / 2, 1642 + e, 860, 30, "italic", SUB);
  fit(ctx, "Будем рады видеть вас снова", W / 2, 1830, 840, 40, "italic", GOLD_INK);
}
function drawSticker(ctx, qr, d, W, H) {
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.strokeStyle = "rgba(139,106,48,0.5)"; ctx.lineWidth = 2; ctx.setLineDash([14, 10]);   // по пунктиру — вырезать
  rrect(ctx, 12, 12, W - 24, H - 24, 92); ctx.stroke(); ctx.restore();
  paper(ctx, 28, 28, W - 56, H - 56, 78); frame(ctx, 48, 48, W - 96, H - 96, 1, 60);
  ctx.textAlign = "center";
  fit(ctx, "Скажите спасибо", W / 2, 150, 760, 56);
  if (qr) qrBox(ctx, qr, W / 2, 196, 600);
  fit(ctx, d.name, W / 2, 870, 760, 54);
  if (d.pos) fit(ctx, d.pos, W / 2, 918, 700, 32, "italic", GOLD_INK);
}
const DRAW = { card: drawCard, tent: drawTent, insert: drawInsert, sticker: drawSticker };

/** Рисует выбранный вид на canvas и возвращает его. kind — card | tent | insert | sticker. */
export function drawThanksPrint(canvas, kind, { url, name, pos, restaurant } = {}) {
  const L = PRINT_LAYOUTS[kind] || PRINT_LAYOUTS.card, draw = DRAW[kind] || drawCard;
  canvas.width = L.w; canvas.height = L.h;
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "alphabetic";
  draw(ctx, qrMatrix(url, { ecl: "M" }), { name: String(name || "").trim(), pos: String(pos || "").trim(), restaurant: String(restaurant || "").trim() }, L.w, L.h);
  return canvas;
}
