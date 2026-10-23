// lib/master-image.js — v40: «Сертификат мастера» картинкой (PNG 1080×1350, как пост или сторис).
//
// Рисуем на canvas в стиле приложения (как lib/recap-image.js): тёплая темнота, двойная золотая рамка,
// засечки; золотая печать мастера, имя, роль, заведение и дата, до шести лучших значков кругами
// цвета металла. Отдаём Blob — компонент решает: «Поделиться» файлом, а где нельзя — просмотр
// со «Скачать». drawMaster — чистая отрисовка: её проверяют на поддельном ctx (tests/v40-ui.test.js).

export const MASTER_W = 1080, MASTER_H = 1350;
import { MONTH_GEN } from "./dates.js";
const SERIF = "'Piazzolla', Georgia, 'Times New Roman', serif";
const LABEL = "Georgia, serif";   // v73 (Доп. 386): подписи — курсивом с засечками в обычном регистре (был моноширинный капс)
const GOLD = "#E8C56A", CREAM = "#FFF6E2", SOFT = "rgba(243,233,210,0.84)", DIM = "rgba(243,233,210,0.55)";
const MONTHS = MONTH_GEN;   // v59: один словарь дат (lib/dates.js)
const METAL = [null,
  { hi: "#F4CDA6", mid: "#C98B5F", lo: "#8A5230", rim: "#663719", ink: "#371A08", word: "бронза" },
  { hi: "#FCFDFF", mid: "#C9CED6", lo: "#8A93A0", rim: "#565E6A", ink: "#20252D", word: "серебро" },
  { hi: "#FFF2BE", mid: "#E8C56A", lo: "#AE8428", rim: "#765610", ink: "#362403", word: "золото" }];

// «Роль пройдена, 5 золотых тем, серия 14 дней и 10 значков» — то же, что на сертификате
export const MASTER_PARTS = "Роль пройдена · 5 золотых тем · серия 14 дней · 10 значков";

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

// до двух строк по словам, вторая — с многоточием
function wrap2(ctx, text, max) {
  // короткие предлоги и союзы держатся за следующее слово: «Практика / у стола», а не «Практика у / стола»
  const words = String(text || "").replace(/(^|\s)([А-Яа-яЁё]{1,2})\s+(?=\S)/g, "$1$2\u00A0").split(/[ \t\n]+/).filter(Boolean);
  if (!words.length) return [];
  let a = words[0], i = 1;
  while (i < words.length && ctx.measureText(a + " " + words[i]).width <= max) { a += " " + words[i]; i++; }
  if (i >= words.length) return [fit(ctx, a, max)];
  return [fit(ctx, a, max), fit(ctx, words.slice(i).join(" "), max)];
}

// v75 (Доп. 388): ромбик и точка вместо четырёхлучевой звёздочки ✦ — разделитель, углы рамки, камень над короной
function rhomb(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.62, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.62, y);
  ctx.closePath();
  ctx.fill();
}
function dot(ctx, x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function divider(ctx, cx, y, half) {
  ctx.strokeStyle = "rgba(232,197,106,0.5)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx - 26, y); ctx.moveTo(cx + 26, y); ctx.lineTo(cx + half, y); ctx.stroke();
  ctx.fillStyle = GOLD; rhomb(ctx, cx, y, 10);
}

function metalFill(ctx, cx, cy, r, m, reverse) {
  const g = ctx.createLinearGradient(cx - r * (reverse ? -0.8 : 0.8), cy - r * (reverse ? -0.9 : 0.9), cx + r * (reverse ? -0.8 : 0.8), cy + r * (reverse ? -0.9 : 0.9));
  g.addColorStop(0, m.hi); g.addColorStop(0.5, m.mid); g.addColorStop(1, m.lo);
  return g;
}

// золотая печать мастера: фестончатый край, корона с камнем
function seal(ctx, cx, cy, R) {
  const m = METAL[3];
  const glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.75);
  glow.addColorStop(0, "rgba(243,210,122,0.34)"); glow.addColorStop(1, "rgba(243,210,122,0)");
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.75, 0, Math.PI * 2); ctx.fill();
  const n = 20, N = n * 8, a = R * 0.05;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2, r = R - a + a * Math.cos(n * t);
    const x = cx + r * Math.sin(t), y = cy - r * Math.cos(t);
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = metalFill(ctx, cx, cy, R, m, false); ctx.fill();
  ctx.strokeStyle = m.rim; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = metalFill(ctx, cx, cy, R * 0.8, m, true);
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = "rgba(118,86,16,0.45)"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.76, 0, Math.PI * 2); ctx.stroke();
  // корона: та же линия, что у значка в приложении (ui/mastery-card.jsx, masterIn), в масштабе
  const s = (R * 1.5) / 24, ox = cx - 12 * s, oy = cy - 12 * s + R * 0.06;
  const P = (x, y) => [ox + x * s, oy + y * s];
  ctx.strokeStyle = m.ink; ctx.lineWidth = 1.8 * s; ctx.lineJoin = "round"; ctx.lineCap = "round";
  const crown = [[4.8, 16.2], [5.9, 8.8], [9.8, 12.1], [12, 7.4], [14.2, 12.1], [18.1, 8.8], [19.2, 16.2]];
  ctx.beginPath(); crown.forEach((p, i) => { const q = P(p[0], p[1]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.stroke();
  const b1 = P(5.2, 19.4), b2 = P(18.8, 19.4);
  ctx.beginPath(); ctx.moveTo(b1[0], b1[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
  const st = P(12, 3.6);
  ctx.fillStyle = m.ink; dot(ctx, st[0], st[1], 1.35 * s);
}

// значок: круг цвета металла, тёмная точка по центру (как монета)
function medal(ctx, cx, cy, r, tier) {
  const m = METAL[Math.max(1, Math.min(3, tier | 0))];
  ctx.fillStyle = metalFill(ctx, cx, cy, r, m, false);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = m.rim; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.fillStyle = metalFill(ctx, cx, cy, r * 0.8, m, true);
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = m.ink; dot(ctx, cx, cy, r * 0.2);
}

export function masterDate(d) {
  const s = d instanceof Date ? d : /^\d{4}-\d{2}-\d{2}/.test(String(d || "")) ? (() => { const [y, mo, dd] = String(d).slice(0, 10).split("-").map(Number); return new Date(y, mo - 1, dd, 12); })() : null;
  if (!s || isNaN(s.getTime())) return d ? String(d) : "";
  return s.getDate() + " " + MONTHS[s.getMonth()] + " " + s.getFullYear();
}

export function drawMaster(ctx, d = {}) {
  const W = MASTER_W, H = MASTER_H, cx = W / 2;
  const bg = ctx.createRadialGradient(cx, H * 0.06, 0, cx, H * 0.06, H * 1.05);
  bg.addColorStop(0, "#5E4119"); bg.addColorStop(0.56, "#1E150A"); bg.addColorStop(1, "#110B05");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // двойная золотая рамка и ромбики по углам
  ctx.strokeStyle = "rgba(232,197,106,0.62)"; ctx.lineWidth = 3;
  rrect(ctx, 40, 40, W - 80, H - 80, 34); ctx.stroke();
  ctx.strokeStyle = "rgba(232,197,106,0.3)"; ctx.lineWidth = 1.5;
  rrect(ctx, 60, 60, W - 120, H - 120, 22); ctx.stroke();
  ctx.fillStyle = "rgba(232,197,106,0.7)";
  [[88, 88], [W - 88, 88], [88, H - 88], [W - 88, H - 88]].forEach(([x, y]) => rhomb(ctx, x, y, 11));
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";

  // шапка — знак, как на логотипе: прописные с засечками вразрядку (v73: без ✦ по краям и без моноширинного)
  ctx.fillStyle = GOLD; ctx.font = "30px " + SERIF;
  spacedCenter(ctx, "SERVICE ACADEMY", cx, 170, 6);
  ctx.fillStyle = CREAM; ctx.font = "700 56px " + SERIF;
  spacedCenter(ctx, "СЕРТИФИКАТ МАСТЕРА", cx, 256, 4);
  divider(ctx, cx, 300, 190);

  seal(ctx, cx, 452, 106);

  // имя: одной строкой от 88 до 60 px; не влезает — двумя (имя / фамилия), тогда без «настоящим…»
  const MAXW = W - 240;
  const full = [d.name, d.surname].filter(Boolean).join(" ") || "Сотрудник";
  const setF = (px) => { ctx.font = "700 " + px + "px " + SERIF; };
  let lines = [full], fs = 88;
  setF(fs);
  while (fs > 60 && ctx.measureText(full).width > MAXW) { fs -= 4; setF(fs); }
  if (ctx.measureText(full).width > MAXW && d.name && d.surname) {
    lines = [String(d.name), String(d.surname)]; fs = 66; setF(fs);
    while (fs > 46 && Math.max(...lines.map((l) => ctx.measureText(l).width)) > MAXW) { fs -= 4; setF(fs); }
  }
  ctx.textAlign = "center";
  let y = 622;
  if (lines.length === 1) {
    ctx.fillStyle = DIM; ctx.font = "italic 34px " + SERIF;
    ctx.fillText("настоящим подтверждается, что", cx, y);
    y += 94;
  } else y = 650;
  ctx.fillStyle = CREAM; setF(fs);
  lines.forEach((ln, i) => ctx.fillText(fit(ctx, ln, MAXW), cx, y + i * (fs + 6)));
  y += (lines.length - 1) * (fs + 6) + 76;
  ctx.fillStyle = GOLD; ctx.font = "48px " + SERIF;
  ctx.fillText(fit(ctx, "мастер роли" + (d.roleLabel ? " «" + d.roleLabel + "»" : ""), W - 220), cx, y);
  const where = [d.restaurant, masterDate(d.date)].filter(Boolean).join(" · ");
  y += 58;
  if (where) { ctx.fillStyle = SOFT; ctx.font = "34px " + SERIF; ctx.fillText(fit(ctx, where, MAXW), cx, y); }

  // до шести лучших значков
  const list = (Array.isArray(d.badges) ? d.badges : []).filter((b) => b && (b.tier | 0) >= 1).slice(0, 6);
  y += 80;
  if (list.length) {
    const slot = Math.min(150, (W - 220) / list.length), x0 = cx - (slot * list.length) / 2 + slot / 2;
    list.forEach((b, i) => {
      const x = x0 + i * slot;
      medal(ctx, x, y + 46, 42, b.tier);
      ctx.fillStyle = SOFT; ctx.font = "24px " + SERIF; ctx.textAlign = "center";
      wrap2(ctx, b.title, slot - 12).forEach((ln, k) => ctx.fillText(ln, x, y + 124 + k * 29));
      ctx.fillStyle = (METAL[Math.min(3, b.tier | 0)] || METAL[1]).mid; ctx.font = "italic 18px " + LABEL;
      ctx.fillText(METAL[Math.min(3, b.tier | 0)].word, x, y + 186);
    });
    y += 242;
  } else y += 40;

  // итог: что сделано ради «Мастера роли» (знак академии — уже в шапке)
  ctx.textAlign = "center";
  divider(ctx, cx, y, 300);
  let pf = 31;
  ctx.font = pf + "px " + SERIF;
  while (pf > 24 && ctx.measureText(MASTER_PARTS).width > W - 170) { pf -= 1; ctx.font = pf + "px " + SERIF; }
  ctx.fillStyle = SOFT;
  ctx.fillText(fit(ctx, MASTER_PARTS, W - 170), cx, y + 60);
  ctx.textAlign = "left";
}

// PNG Blob (или null, если canvas недоступен)
export async function masterImage(data = {}) {
  if (typeof document === "undefined" || !document.createElement) return null;
  await fontsReady();
  const c = document.createElement("canvas");
  if (!c || !c.getContext) return null;
  c.width = MASTER_W; c.height = MASTER_H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  try { drawMaster(ctx, data || {}); } catch (e) { return null; }
  return new Promise((res) => {
    try { c.toBlob((b) => res(b || null), "image/png"); } catch (e) { res(null); }
  });
}

// «✦ Я — мастер роли «Ядро» в Service Academy! …» — для «Поделиться текстом»
export function masterShareText({ name, roleLabel, restaurant } = {}) {
  const lines = ["Я — мастер роли " + (roleLabel ? "«" + roleLabel + "» " : "") + "в Service Academy!", "Роль пройдена, 5 золотых тем, серия 14 дней и 10 значков."];
  const sign = [name, restaurant].filter(Boolean).join(" · ");
  if (sign) lines.push(sign);
  return lines.join("\n");
}
