// lib/recap-image.js — v31: «Итоги месяца» картинкой (PNG 1080×1350, как пост или сторис).
//
// Рисуем на canvas в стиле приложения: тёплая темнота, золото, засечки. Без личного, кроме
// имени и заведения, которые человек и так показывает команде. Отдаём Blob — дальше
// компонент решает: системное «Поделиться» с файлом, а где его нет — просмотр со «Скачать».
import { plural, recapParts, compareLine } from "./month-recap";

export const RECAP_W = 1080, RECAP_H = 1350;
const SERIF = "'Piazzolla', Georgia, 'Times New Roman', serif";
const LABEL = "Georgia, serif";   // v73 (Доп. 386): подписи — курсивом с засечками в обычном регистре (был моноширинный капс вразрядку)
const GOLD = "#E8C56A", CREAM = "#FFF6E2", SOFT = "rgba(243,233,210,0.82)", DIM = "rgba(243,233,210,0.45)";

async function fontsReady() {
  try {
    if (typeof document !== "undefined" && document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([document.fonts.load("700 120px Piazzolla"), document.fonts.load("400 36px Piazzolla")]),
        new Promise((res) => setTimeout(res, 1200)),
      ]);
    }
  } catch (e) { /* шрифт не догрузился — рисуем запасным */ }
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function spaced(ctx, text, x, y, sp) {
  // разрядка: где есть ctx.letterSpacing — им, иначе по буквам
  if ("letterSpacing" in ctx) { ctx.letterSpacing = sp + "px"; ctx.fillText(text, x, y); ctx.letterSpacing = "0px"; return; }
  let cx = x;
  for (const ch of String(text)) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
}

function fit(ctx, text, max) {
  let t = String(text || "");
  if (ctx.measureText(t).width <= max) return t;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

// маленькое пламя — горящий день в календаре
function flame(ctx, cx, cy, s) {
  const g = ctx.createLinearGradient(cx, cy - s, cx, cy + s * 0.6);
  g.addColorStop(0, "#F8D27A"); g.addColorStop(1, "#E2873A");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.bezierCurveTo(cx + s * 0.75, cy - s * 0.2, cx + s * 0.62, cy + s * 0.6, cx, cy + s * 0.6);
  ctx.bezierCurveTo(cx - s * 0.62, cy + s * 0.6, cx - s * 0.75, cy - s * 0.2, cx, cy - s);
  ctx.fill();
}

// v75 (Доп. 388): снежинка линиями — день заморозки (раньше символ ❄ шрифтом: на телефонах он рисовался эмодзи)
function snow(ctx, cx, cy, r) {
  ctx.strokeStyle = "rgba(170,200,235,0.85)"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = (Math.PI / 3) * k + Math.PI / 2, dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    ctx.moveTo(cx - dx, cy - dy); ctx.lineTo(cx + dx, cy + dy);
  }
  ctx.stroke();
}

export function drawRecap(ctx, r, who = {}) {
  const W = RECAP_W, H = RECAP_H, L = 92;
  const bg = ctx.createRadialGradient(W * 0.2, H * 0.08, 0, W * 0.2, H * 0.08, H * 1.05);
  bg.addColorStop(0, "#5A3E18"); bg.addColorStop(0.58, "#1E150A"); bg.addColorStop(1, "#110B05");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(232,197,106,0.34)"; ctx.lineWidth = 2;
  rrect(ctx, 40, 40, W - 80, H - 80, 34); ctx.stroke();
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";

  // шапка
  ctx.fillStyle = GOLD; ctx.font = "italic 30px " + LABEL;
  ctx.fillText("Итоги · " + String(r.title || "").toLowerCase() + " " + (r.year || ""), L, 150);
  const name = [who.name, who.surname].filter(Boolean).join(" ");
  ctx.fillStyle = SOFT; ctx.font = "38px " + SERIF;
  ctx.fillText(fit(ctx, [name, who.restaurant].filter(Boolean).join(" · "), W - 2 * L), L, 212);

  // главное число — дни в деле
  ctx.fillStyle = CREAM; ctx.font = "700 230px " + SERIF;
  ctx.fillText(String(r.active || 0), L - 8, 440);
  const bigW = ctx.measureText(String(r.active || 0)).width;
  ctx.fillStyle = SOFT; ctx.font = "44px " + SERIF;
  ctx.fillText(plural(r.active || 0, "день", "дня", "дней") + " в деле", L + bigW + 18, 360);
  ctx.fillStyle = DIM; ctx.font = "34px " + SERIF;
  ctx.fillText("из " + (r.current ? r.upto + " прошедших" : r.daysIn), L + bigW + 18, 412);

  // календарь свечей
  const top = 480, cw = 114, ch = 58, gap = 12;
  const first = (new Date(r.year, r.month - 1, 1).getDay() + 6) % 7;
  (r.calendar || []).forEach((c, i) => {
    const k = first + i, col = k % 7, row = Math.floor(k / 7);
    const x = L + col * (cw + gap) - 6, y = top + row * (ch + gap);
    ctx.fillStyle = c.state === 2 ? "rgba(232,197,106,0.18)" : c.state === 1 ? "rgba(143,176,214,0.16)" : "rgba(255,255,255,0.05)";
    rrect(ctx, x, y, cw, ch, 14); ctx.fill();
    if (c.state === 2) flame(ctx, x + 30, y + ch / 2 + 2, 17);
    if (c.state === 1) snow(ctx, x + 30, y + ch / 2, 12);
    ctx.fillStyle = c.state == null ? "rgba(243,233,210,0.22)" : c.state === 2 ? CREAM : DIM;
    ctx.font = (c.state === 2 ? "700 " : "") + "28px " + SERIF; ctx.textAlign = "right";
    ctx.fillText(String(c.d), x + cw - 14, y + ch / 2 + 10); ctx.textAlign = "left";
  });
  const rows = Math.ceil((first + (r.calendar || []).length) / 7);
  let y = top + rows * (ch + gap) + 60;

  // шаги и из чего они
  const t = r.totals || {};
  ctx.fillStyle = CREAM; ctx.font = "700 54px " + SERIF;
  const stLine = (t.st || 0) + " " + plural(t.st || 0, "шаг", "шага", "шагов");
  ctx.fillText(stLine, L, y);
  const stW = ctx.measureText(stLine).width;
  ctx.fillStyle = SOFT; ctx.font = "36px " + SERIF;
  ctx.fillText("· " + (r.points || 0) + " " + plural(r.points || 0, "очко", "очка", "очков") + " лиги", L + stW + 18, y);
  y += 30;
  const parts = recapParts(t).slice(0, 6);
  let x = L; ctx.font = "32px " + SERIF;
  let line = 0;
  parts.forEach((p) => {
    const label = p.n + " " + p.word;
    const w = ctx.measureText(label).width + 44;
    if (x + w > W - L) { x = L; line++; }
    if (line > 1) return;
    const yy = y + line * 70 + 14;
    ctx.strokeStyle = "rgba(243,233,210,0.28)"; ctx.lineWidth = 2;
    rrect(ctx, x, yy, w, 54, 27); ctx.stroke();
    ctx.fillStyle = GOLD; ctx.font = "700 32px " + SERIF;
    const nw = ctx.measureText(String(p.n)).width;
    ctx.fillText(String(p.n), x + 22, yy + 38);
    ctx.fillStyle = CREAM; ctx.font = "32px " + SERIF;
    ctx.fillText(" " + p.word, x + 22 + nw, yy + 38);
    x += w + 14;
  });
  y += (parts.length ? (line >= 1 ? 2 : 1) * 70 : 0) + 56;

  // лучшее и сравнение
  const notes = [];
  if (r.best) notes.push("лучший день: " + r.best.label + " (" + r.best.steps + " " + plural(r.best.steps, "шаг", "шага", "шагов") + ")");
  if (r.longest > 1) notes.push("серия " + r.longest + " " + plural(r.longest, "день", "дня", "дней") + " подряд");
  const cmp = compareLine(r);
  if (cmp && cmp.share) notes.push(cmp.share);
  if (r.guests && r.guests.n) notes.push(r.guests.n + " " + plural(r.guests.n, "живой гость", "живых гостя", "живых гостей"));
  ctx.font = "34px " + SERIF;
  notes.slice(0, 3).forEach((n) => {
    if (y > H - 140) return;
    ctx.fillStyle = SOFT; ctx.fillText(fit(ctx, n, W - 2 * L), L, y);
    y += 54;
  });

  // подпись
  // подпись — как на логотипе: прописные с засечками вразрядку (знак, а не подпись-метка; моноширинного больше нет)
  ctx.fillStyle = "rgba(232,197,106,0.75)"; ctx.font = "26px " + SERIF;
  spaced(ctx, "SERVICE ACADEMY", L, H - 96, 6);
  flame(ctx, W - L - 14, H - 112, 18);
}

// PNG Blob (или null, если canvas недоступен)
export async function recapImage(r, who) {
  if (typeof document === "undefined") return null;
  await fontsReady();
  const c = document.createElement("canvas");
  c.width = RECAP_W; c.height = RECAP_H;
  const ctx = c.getContext && c.getContext("2d");
  if (!ctx) return null;
  drawRecap(ctx, r, who || {});
  return new Promise((res) => {
    try { c.toBlob((b) => res(b || null), "image/png"); } catch (e) { res(null); }
  });
}
