// lib/topic-tint.js — Доп. 308: у каждой темы трека свой оттенок.
// Темы одного трека делили один цвет (цвет трека). Теперь цвет плавно «путешествует»
// от первой темы к последней: тон поворачивается по кругу в пределах ±40° от цвета
// трека, насыщенность и светлота остаются как у трека — все оттенки из одной семьи.
// Оттенок только для украшений (ленточка, значок, отметка шага, свечение фона,
// закладки, точки в оглавлении); текст остаётся цвета трека — читаемость прежняя.

const hex2rgb = (hex) => {
  const s = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
};

const rgb2hsl = ([r, g, b]) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
};

const hsl2hex = (h, s, l) => {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return ("#" + to(f(0)) + to(f(8)) + to(f(4))).toUpperCase();
};

// Оттенок темы i из n: первая тема — на 40° «раньше» цвета трека, последняя — на 40° «позже».
export function topicShade(base, i, n, spread = 80) {
  const rgb = hex2rgb(base);
  if (!rgb || !(n > 1)) return base;
  const [h, s, l] = rgb2hsl(rgb);
  const t = Math.max(0, Math.min(1, i / (n - 1)));
  const hue = (((h + (-spread / 2 + spread * t)) % 360) + 360) % 360;
  return hsl2hex(hue, s, l);
}

// Цифра на цветной закладке: тёмная или белая — что контрастнее на этом цвете.
export function inkOnColor(hex) {
  const rgb = hex2rgb(hex);
  if (!rgb) return "#FFFFFF";
  const lin = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  const dark = 0.0045;   // #140D05
  return (L + 0.05) / (dark + 0.05) >= 1.05 / (L + 0.05) ? "#140D05" : "#FFFFFF";
}
