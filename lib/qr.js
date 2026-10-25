// lib/qr.js — v84 (Доп. 397): QR-код без сторонних библиотек (для «Спасибо от гостей»).
//
// Стандарт ISO/IEC 18004: байтовый режим (UTF-8), версии 1–10, уровни коррекции L, M, Q, H; маска — с наименьшим
// штрафом по четырём правилам стандарта. Устройство — как в известной открытой реализации Nayuki (MIT): Рида — Соломона
// над GF(256) (x⁸ + x⁴ + x³ + x² + 1), чередование блоков, зигзаг по столбцам, служебные биты формата и версии.
// Ссылка вида https://…vercel.app/?thanks=<код> (около 55 байт) — это версия 4, модуль крупный, камера читает издалека.
// Проверка — tests/v84.test.js (эталонные коды) и tools/claude/qr-check.py (OpenCV читает сгенерированные коды).

const ECL = { L: 0, M: 1, Q: 2, H: 3 };
const ECL_FORMAT = [1, 0, 3, 2];   // биты уровня в поле формата: L=01, M=00, Q=11, H=10
// для версий 1–10 (индекс 0 не используется)
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
];
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
];
export const QR_MAX_VERSION = 10;

const bit = (x, i) => ((x >>> i) & 1) !== 0;

function rawModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
export const dataCodewords = (ver, e) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[e][ver] * NUM_BLOCKS[e][ver];

function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
  return z & 0xff;
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0); r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    root = gfMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data, div) {
  const r = div.map(() => 0);
  for (const b of data) {
    const f = b ^ r.shift();
    r.push(0);
    div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
  }
  return r;
}

function utf8(s) {
  if (typeof TextEncoder !== "undefined") return Array.from(new TextEncoder().encode(s));
  return Array.from(unescape(encodeURIComponent(s)), (c) => c.charCodeAt(0));
}

/** Кодовые слова данных: режим «байты», длина, данные, терминатор и заполнители. */
function dataBits(bytes, ver, e) {
  const bits = [];
  const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(4, 4);
  put(bytes.length, ver <= 9 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const cap = dataCodewords(ver, e) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  return out;
}

function interleave(data, ver, e) {
  const nb = NUM_BLOCKS[e][ver], eccLen = ECC_PER_BLOCK[e][ver];
  const raw = Math.floor(rawModules(ver) / 8);
  const nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb);
  const div = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) out.push(b[i]); });
  return out;
}

function alignPositions(ver, size) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let pos = size - 7; r.length < n; pos -= step) r.splice(1, 0, pos);
  return r;
}

function build(ver, e, codewords, mask) {
  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = alignPositions(ver, size), na = al.length;
  for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const format = (msk) => {
    const d = (ECL_FORMAT[e] << 3) | msk;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = ((d << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(b, i));
    set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(b, i));
    set(8, size - 8, true);
  };
  format(0);   // место под формат — до раскладки данных
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const b = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) { const c = bit(b, i), a = size - 11 + (i % 3), bb = Math.floor(i / 3); set(a, bb, c); set(bb, a, c); }
  }
  // данные зигзагом
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
      if (!fn[y][x] && k < codewords.length * 8) { m[y][x] = bit(codewords[k >>> 3], 7 - (k & 7)); k++; }
    }
  }
  // маска
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (fn[y][x]) continue;
    const inv = [(x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      ((x * y) % 2) + ((x * y) % 3) === 0, (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][mask];
    if (inv) m[y][x] = !m[y][x];
  }
  format(mask);
  return m;
}

// штраф по правилам стандарта: серии, квадраты 2×2, «как искатель», доля тёмных
function penalty(m) {
  const n = m.length;
  let p = 0, dark = 0;
  const line = (get) => {
    let s = 0, run = 1;
    for (let i = 1; i < n; i++) { if (get(i) === get(i - 1)) { run++; if (run === 5) s += 3; else if (run > 5) s += 1; } else run = 1; }
    const pat = [true, false, true, true, true, false, true];
    for (let i = 0; i + 6 < n; i++) {
      if (!pat.every((v, j) => get(i + j) === v)) continue;
      const before = i >= 4 && [1, 2, 3, 4].every((j) => !get(i - j));
      const after = i + 10 < n && [7, 8, 9, 10].every((j) => !get(i + j));
      if (before || after) s += 40;
    }
    return s;
  };
  for (let y = 0; y < n; y++) p += line((i) => m[y][i]);
  for (let x = 0; x < n; x++) p += line((i) => m[i][x]);
  for (let y = 0; y + 1 < n; y++) for (let x = 0; x + 1 < n; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) dark++;
  p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  return p;
}

/** QR-код текста: { version, size, modules[y][x] } (true — тёмный модуль). Не влезло в версию 10 — null. */
export function qrMatrix(text, { ecl = "M", mask = null } = {}) {
  const e = ECL[ecl] != null ? ECL[ecl] : 1;
  const bytes = utf8(String(text == null ? "" : text));
  let ver = 1;
  for (; ver <= QR_MAX_VERSION; ver++) {
    const need = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
    if (need <= dataCodewords(ver, e) * 8) break;
  }
  if (ver > QR_MAX_VERSION) return null;
  const cw = interleave(dataBits(bytes, ver, e), ver, e);
  let best = null, bestP = Infinity;
  for (let k = 0; k < 8; k++) {
    if (mask != null && k !== mask) continue;
    const mm = build(ver, e, cw, k), pp = penalty(mm);
    if (pp < bestP) { bestP = pp; best = mm; }
  }
  return { version: ver, size: best.length, modules: best };
}

/** Путь SVG тёмных модулей (по строкам, соседние — одним прямоугольником), с полем quiet модулей вокруг. */
export function qrPath(qr, quiet = 4) {
  if (!qr) return "";
  const parts = [];
  qr.modules.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let w = 1;
      while (x + w < row.length && row[x + w]) w++;
      parts.push("M" + (x + quiet) + " " + (y + quiet) + "h" + w + "v1h-" + w + "z");
      x += w - 1;
    }
  });
  return parts.join("");
}
