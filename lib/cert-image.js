// lib/cert-image.js — v162 (Доп. 487): сертификат об экзамене картинкой (PNG 1080×1350 — как «Сертификат мастера»).
//
// Тот же бумажный лист, что на экране «Сертификат» (ui/screens-exam.jsx): двойная рамка, знак академии, имя крупно,
// «Экзамен на роль … сдан на 92%», дата и срок действия, сургучная печать с шапочкой. Отдаём Blob — экран решает:
// «Поделиться» файлом, а где нельзя — просмотр со «Скачать». drawCert — чистая отрисовка: её проверяют на поддельном
// ctx (tests/v162.test.js). Слова на листе и на картинке — из одного места (certView), чтобы они не разошлись.

import { dateWords } from "./dates.js";

export const CERT_W = 1080, CERT_H = 1350;
export const CERT_MONTHS = 12;   // сертификат действует год — как в списке «Сертификаты»
const SERIF = "'Piazzolla', Georgia, 'Times New Roman', serif";   // заголовок, имя, роль, процент — полужирным (в приложении у Piazzolla только 700)
const BODY = "Georgia, 'Times New Roman', serif";                 // подписи, курсив и процент («Georgia» в приложении — Georgia или PT Serif)
const INK = "#2A1F0E", SUB = "#735F44", RULE = "#8B6A30";

/**
 * Слова сертификата: одно и то же на экране и на картинке.
 * profile — { name, surname, restaurant }, roleLabel — название роли, result — { score, date } из результатов экзамена.
 * → { name, role, score (число или null), done («сдан на 92%» / «сдан»), date, until, expired, restaurant }
 */
export function certView({ profile = null, roleLabel = "", result = null, now = Date.now() } = {}) {
  const p = profile || {}, r = result || {};
  const name = [p.name, p.surname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  const score = typeof r.score === "number" && Number.isFinite(r.score) ? Math.round(r.score) : null;
  const at = r.date ? new Date(r.date) : null;
  const ok = !!at && !isNaN(at.getTime());
  let until = "", expired = false;
  if (ok) { const u = new Date(at); u.setMonth(u.getMonth() + CERT_MONTHS); until = dateWords(u, true); expired = u.getTime() < now; }
  return { name: name || "Сотрудник", role: String(roleLabel || "").trim(), score, done: score != null ? "сдан на " + score + "%" : "сдан",
    date: ok ? dateWords(at, true) : "", until, expired, restaurant: String(p.restaurant || "").trim() };
}

/** «Экзамен на роль «Ядро» в Service Academy сдан на 92%.» и подпись — для «Поделиться текстом» */
export function certShareText(v = {}) {
  const lines = ["Экзамен на роль " + (v.role ? "«" + v.role + "» " : "") + "в Service Academy " + (v.done || "сдан") + "."];
  const sign = [v.name && v.name !== "Сотрудник" ? v.name : "", v.restaurant].filter(Boolean).join(" · ");
  if (sign) lines.push(sign);
  return lines.join("\n");
}

async function fontsReady() {
  try {
    if (typeof document !== "undefined" && document.fonts && document.fonts.load) {
      await Promise.race([
        // второй аргумент — образец текста: у шрифтов приложения кириллица и латиница лежат в разных файлах
        Promise.all([document.fonts.load("700 108px Piazzolla", "Сертификат Ab"), document.fonts.load("400 36px Georgia", "я 12"),
          document.fonts.load("italic 400 40px Georgia", "сдан на"), document.fonts.load("700 42px Georgia", "92%")]),
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

// разрядка по центру: где есть ctx.letterSpacing — им, иначе по буквам
function spacedCenter(ctx, text, cx, y, sp) {
  const t = String(text || "");
  if ("letterSpacing" in ctx) {
    ctx.letterSpacing = sp + "px"; ctx.textAlign = "center";
    ctx.fillText(t, cx + sp / 2, y);
    ctx.letterSpacing = "0px"; ctx.textAlign = "left";
    return;
  }
  const chars = [...t];
  const ws = chars.map((ch) => ctx.measureText(ch).width);
  let x = cx - (ws.reduce((a, b) => a + b, 0) + sp * Math.max(0, chars.length - 1)) / 2;
  ctx.textAlign = "left";
  chars.forEach((ch, i) => { ctx.fillText(ch, x, y); x += ws[i] + sp; });
}

function fit(ctx, text, max) {
  let t = String(text || "");
  if (ctx.measureText(t).width <= max) return t;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t.replace(/\s+$/, "") + "…";
}

function rhomb(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
}

// цвет роли для ромбика: только #RRGGBB, иначе золото рамки
const roleInk = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || "")) ? String(c) : RULE);

// сургучная печать с шапочкой: тот же сургуч, что на листе в приложении (ui/now-hero.jsx, WaxSeal), неровный край
function seal(ctx, cx, cy, R) {
  const edge = (t) => R * (1 + 0.034 * Math.sin(3 * t + 0.7) + 0.022 * Math.sin(5 * t + 2.2) + 0.012 * Math.sin(8 * t + 4.1));
  const blob = (dx, dy) => {
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2, r = edge(t), x = cx + dx + r * Math.cos(t), y = cy + dy + r * Math.sin(t);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  };
  ctx.fillStyle = "rgba(60,20,8,0.28)"; blob(3, 9); ctx.fill();   // тень на бумаге
  const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.05, cx, cy, R * 1.08);
  g.addColorStop(0, "#C9583A"); g.addColorStop(0.45, "#9A3520"); g.addColorStop(0.8, "#702415"); g.addColorStop(1, "#541809");
  ctx.fillStyle = g; blob(0, 0); ctx.fill();
  ctx.strokeStyle = "rgba(58,12,4,0.7)"; ctx.lineWidth = R * 0.085;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.66, 0, Math.PI * 2); ctx.stroke();
  // блик слева сверху
  ctx.fillStyle = "rgba(255,235,210,0.24)";
  ctx.beginPath();
  if (ctx.ellipse) ctx.ellipse(cx - R * 0.3, cy - R * 0.5, R * 0.27, R * 0.13, -0.5, 0, Math.PI * 2); else ctx.arc(cx - R * 0.3, cy - R * 0.5, R * 0.16, 0, Math.PI * 2);
  ctx.fill();
  // шапочка: та же линия, что у значка в приложении (ui/icons.jsx, gradcap), в масштабе
  const s = (R * 0.96) / 24, ox = cx - 12 * s, oy = cy - 11.4 * s;
  const X = (x) => ox + x * s, Y = (y) => oy + y * s;
  ctx.strokeStyle = "#F4DDBC"; ctx.lineWidth = 1.7 * s; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(X(12), Y(4)); ctx.lineTo(X(2.5), Y(9)); ctx.lineTo(X(12), Y(14)); ctx.lineTo(X(21.5), Y(9)); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(6.5), Y(11.4)); ctx.lineTo(X(6.5), Y(15.8));
  ctx.bezierCurveTo(X(6.5), Y(17.4), X(9), Y(18.8), X(12), Y(18.8));
  ctx.bezierCurveTo(X(15), Y(18.8), X(17.5), Y(17.4), X(17.5), Y(15.8));
  ctx.lineTo(X(17.5), Y(11.4)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(21.5), Y(9.2)); ctx.lineTo(X(21.5), Y(14)); ctx.stroke();
}

/** Лист сертификата на canvas. d — certView(...) и color (цвет роли, #RRGGBB) */
export function drawCert(ctx, d = {}) {
  const W = CERT_W, H = CERT_H, cx = W / 2;
  const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
  bg.addColorStop(0, "#FCF8EE"); bg.addColorStop(1, "#F2E8D3");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // двойная рамка, как у листа в приложении
  ctx.strokeStyle = RULE; ctx.lineWidth = 4;
  rrect(ctx, 46, 46, W - 92, H - 92, 12); ctx.stroke();
  ctx.strokeStyle = "rgba(139,106,48,0.5)"; ctx.lineWidth = 1.5;
  rrect(ctx, 62, 62, W - 124, H - 124, 6); ctx.stroke();
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";

  // шапка — знак, как на логотипе: прописные с засечками вразрядку
  ctx.fillStyle = RULE; ctx.font = "30px " + BODY;
  spacedCenter(ctx, "SERVICE ACADEMY", cx, 214, 9);
  ctx.fillStyle = INK; ctx.font = "700 112px " + SERIF; ctx.textAlign = "center";
  ctx.fillText("Сертификат", cx, 340);
  ctx.strokeStyle = "rgba(139,106,48,0.7)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 168, 398); ctx.lineTo(cx - 30, 398); ctx.moveTo(cx + 30, 398); ctx.lineTo(cx + 168, 398); ctx.stroke();
  ctx.fillStyle = roleInk(d.color); rhomb(ctx, cx, 398, 11);

  // имя: одной строкой от 92 до 60 px; не влезает — двумя (имя / фамилия)
  const MAXW = W - 220;
  const full = String(d.name || "Сотрудник");
  const setF = (px) => { ctx.font = "700 " + px + "px " + SERIF; };
  let lines = [full], fs = 92;
  setF(fs);
  while (fs > 60 && ctx.measureText(full).width > MAXW) { fs -= 4; setF(fs); }
  if (ctx.measureText(full).width > MAXW && full.indexOf(" ") > 0) {
    const i = full.indexOf(" ");
    lines = [full.slice(0, i), full.slice(i + 1)]; fs = 76; setF(fs);
    while (fs > 46 && Math.max(...lines.map((l) => ctx.measureText(l).width)) > MAXW) { fs -= 4; setF(fs); }
  }
  ctx.fillStyle = INK; ctx.textAlign = "center";
  let y = lines.length === 1 ? 628 : 590;
  lines.forEach((ln, i) => ctx.fillText(fit(ctx, ln, MAXW), cx, y + i * (fs + 8)));
  y += (lines.length - 1) * (fs + 8) + 40;
  ctx.strokeStyle = "rgba(139,106,48,0.5)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 330, y); ctx.lineTo(cx + 330, y); ctx.stroke();

  // «Экзамен на роль / Ядро / сдан на 92%»
  y += 96;
  ctx.fillStyle = SUB; ctx.font = "italic 40px " + BODY;
  ctx.fillText("Экзамен на роль", cx, y);
  y += 86;
  let rf = 72;
  ctx.font = "700 " + rf + "px " + SERIF;
  while (rf > 48 && ctx.measureText(String(d.role || "")).width > MAXW) { rf -= 4; ctx.font = "700 " + rf + "px " + SERIF; }
  ctx.fillStyle = INK;
  if (d.role) ctx.fillText(fit(ctx, d.role, MAXW), cx, y); else y -= 70;
  y += 66;
  if (d.score != null) {
    // «сдан на» курсивом, число — прямым жирным: по ширине двух кусков, по центру
    const a = "сдан на ", b = d.score + "%";
    ctx.font = "italic 40px " + BODY; const wa = ctx.measureText(a).width;
    ctx.font = "700 42px " + BODY; const wb = ctx.measureText(b).width;
    const x0 = cx - (wa + wb) / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = SUB; ctx.font = "italic 40px " + BODY; ctx.fillText(a, x0, y);
    ctx.fillStyle = INK; ctx.font = "700 42px " + BODY; ctx.fillText(b, x0 + wa, y);
    ctx.textAlign = "center";
  } else { ctx.fillStyle = SUB; ctx.font = "italic 40px " + BODY; ctx.fillText("сдан", cx, y); }

  // низ листа: дата, срок, заведение — слева; печать — справа
  const LX = 124, SEAL_R = 92, SEAL_X = W - 124 - SEAL_R, room = SEAL_X - SEAL_R - 30 - LX;
  const low = [];
  if (d.date) low.push({ t: d.date, f: "36px " + BODY, c: INK, h: 50 });
  if (d.until) low.push({ t: (d.expired ? "срок истёк " : "действует до ") + d.until, f: "30px " + BODY, c: d.expired ? "#8B3020" : SUB, h: 42 });
  if (d.restaurant) low.push({ t: d.restaurant, f: "30px " + BODY, c: SUB, h: 42 });
  const baseY = H - 150;
  let ly = baseY - low.slice(1).reduce((a, b) => a + b.h, 0);
  ctx.textAlign = "left";
  low.forEach((ln, i) => { if (i) ly += ln.h; ctx.fillStyle = ln.c; ctx.font = ln.f; ctx.fillText(fit(ctx, ln.t, room), LX, ly); });
  seal(ctx, SEAL_X, H - 124 - SEAL_R, SEAL_R);
  ctx.textAlign = "left";
}

// PNG Blob (или null, если canvas недоступен)
export async function certImage(data = {}) {
  if (typeof document === "undefined" || !document.createElement) return null;
  await fontsReady();
  const c = document.createElement("canvas");
  if (!c || !c.getContext) return null;
  c.width = CERT_W; c.height = CERT_H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  try { drawCert(ctx, data || {}); } catch (e) { return null; }
  return new Promise((res) => {
    try { c.toBlob((b) => res(b || null), "image/png"); } catch (e) { res(null); }
  });
}
