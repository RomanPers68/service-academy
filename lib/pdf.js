// lib/pdf.js — Доп. 309: PDF без сторонних библиотек (для карточки сотрудника).
// Шрифт TrueType встраивается целиком (у нас он уже урезан до латиницы и кириллицы):
// Type0 + CIDFontType2, кодировка Identity-H, ToUnicode — текст в PDF ищется и копируется.
// Умеет: текст (ширина по метрикам шрифта, перенос строк), прямоугольники (в том числе
// скруглённые), линии, круги, цвета. Страница A4. Работает и в браузере, и в Node.

const enc = new TextEncoder();
export const A4 = { w: 595.28, h: 841.89 };

function b64ToBytes(b64) {
  if (typeof atob === "function") {
    const s = atob(b64); const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  // eslint-disable-next-line no-undef
  return new Uint8Array(Buffer.from(b64, "base64"));
}

// ── TrueType: метрики и карта символов ───────────────────────────────────────
export function parseTTF(input) {
  const bytes = typeof input === "string" ? b64ToBytes(input) : input;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = dv.getUint16(4);
  const t = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    const tag = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    t[tag] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) };
  }
  const h = t.head.off;
  const upm = dv.getUint16(h + 18);
  const bbox = [dv.getInt16(h + 36), dv.getInt16(h + 38), dv.getInt16(h + 40), dv.getInt16(h + 42)];
  const hh = t.hhea.off;
  const ascent = dv.getInt16(hh + 4), descent = dv.getInt16(hh + 6);
  const numHM = dv.getUint16(hh + 34);
  const numGlyphs = dv.getUint16(t.maxp.off + 4);
  const adv = new Uint16Array(numGlyphs);
  for (let g = 0; g < numGlyphs; g++) adv[g] = g < numHM ? dv.getUint16(t.hmtx.off + g * 4) : adv[numHM - 1];
  let capHeight = Math.round(ascent * 0.7);
  const os2 = t["OS/2"];
  if (os2 && dv.getUint16(os2.off) >= 2 && os2.len >= 90) capHeight = dv.getInt16(os2.off + 88);
  let italicAngle = 0;
  if (t.post) italicAngle = dv.getInt16(t.post.off + 4) + dv.getUint16(t.post.off + 6) / 65536;
  const map = new Map();
  const c0 = t.cmap.off;
  const nSub = dv.getUint16(c0 + 2);
  const subs = [];
  for (let i = 0; i < nSub; i++) subs.push({ pid: dv.getUint16(c0 + 4 + i * 8), eid: dv.getUint16(c0 + 6 + i * 8), off: dv.getUint32(c0 + 8 + i * 8) });
  // формат 12 (полный Юникод) лучше, затем формат 4
  const pick = (fmt) => subs.find((s) => dv.getUint16(c0 + s.off) === fmt && (s.pid === 3 || s.pid === 0));
  const s12 = pick(12), s4 = pick(4);
  if (s12) {
    const st = c0 + s12.off; const n = dv.getUint32(st + 12);
    for (let j = 0; j < n; j++) {
      const a = dv.getUint32(st + 16 + j * 12), b = dv.getUint32(st + 20 + j * 12), g0 = dv.getUint32(st + 24 + j * 12);
      for (let c = a; c <= b && c - a < 65536; c++) map.set(c, g0 + (c - a));
    }
  } else if (s4) {
    const st = c0 + s4.off;
    const segX2 = dv.getUint16(st + 6), seg = segX2 / 2;
    const endO = st + 14, startO = st + 16 + segX2, deltaO = st + 16 + 2 * segX2, roO = st + 16 + 3 * segX2;
    for (let i = 0; i < seg; i++) {
      const end = dv.getUint16(endO + i * 2), start = dv.getUint16(startO + i * 2), delta = dv.getInt16(deltaO + i * 2), ro = dv.getUint16(roO + i * 2);
      for (let c = start; c <= end && c !== 0xFFFF; c++) {
        let g;
        if (ro === 0) g = (c + delta) & 0xFFFF;
        else { g = dv.getUint16(roO + i * 2 + ro + 2 * (c - start)); if (g) g = (g + delta) & 0xFFFF; }
        if (g) map.set(c, g);
      }
    }
  }
  return { bytes, upm, bbox, ascent, descent, capHeight, italicAngle, adv, map, numGlyphs };
}

// Знаки, которых нет в шрифте, — понятной заменой
const SUBST = { "✓": "+", "✔": "+", "✦": "*", "★": "*", "☆": "*", "→": "›", "←": "‹", "↩": "‹", "≥": ">=", "≤": "<=", " ": " ", "\t": " " };

const num = (v) => { const r = Math.round(v * 100) / 100; return String(r).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1"); };
const col = (c) => {
  if (!c) return [0, 0, 0];
  if (Array.isArray(c)) return c;
  const s = String(c).replace("#", "");
  return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255];
};
const rgb = (c) => col(c).map((v) => num(v)).join(" ");
const hex4 = (n) => n.toString(16).toUpperCase().padStart(4, "0");
function utf16hex(s) {
  let out = "FEFF";
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    if (cp > 0xFFFF) { const v = cp - 0x10000; out += hex4(0xD800 + (v >> 10)) + hex4(0xDC00 + (v & 0x3FF)); }
    else out += hex4(cp);
  }
  return "<" + out + ">";
}

export class PdfDoc {
  constructor({ fonts, title = "", author = "Service Academy" } = {}) {
    this.fonts = {};
    let k = 1;
    Object.keys(fonts || {}).forEach((name) => {
      const f = parseTTF(fonts[name]);
      this.fonts[name] = { ...f, ref: "F" + k++, used: new Map() };
    });
    this.pages = [];
    this.title = title; this.author = author;
    this.W = A4.w; this.H = A4.h;
  }
  font(name) { return this.fonts[name] || this.fonts[Object.keys(this.fonts)[0]]; }
  clean(text) { return String(text == null ? "" : text).replace(/[\r\n]+/g, " ").replace(/[✓✔✦★☆→←↩≥≤ \t]/g, (c) => SUBST[c] || " "); }
  measure(text, size, fontName) {
    const f = this.font(fontName);
    let w = 0;
    for (const ch of this.clean(text)) { const g = f.map.get(ch.codePointAt(0)) || 0; w += f.adv[g] || 0; }
    return (w / f.upm) * size;
  }
  // перенос по словам; слишком длинное слово режется по буквам
  wrap(text, width, size, fontName) {
    const words = this.clean(text).split(/\s+/).filter(Boolean);
    const lines = []; let cur = "";
    const push = () => { if (cur) lines.push(cur); cur = ""; };
    for (const w of words) {
      const cand = cur ? cur + " " + w : w;
      if (this.measure(cand, size, fontName) <= width) { cur = cand; continue; }
      push();
      if (this.measure(w, size, fontName) <= width) { cur = w; continue; }
      let part = "";
      for (const ch of w) { if (this.measure(part + ch, size, fontName) > width && part) { lines.push(part); part = ch; } else part += ch; }
      cur = part;
    }
    push();
    return lines.length ? lines : [""];
  }
  // обрезать с многоточием по ширине
  fit(text, width, size, fontName) {
    let s = this.clean(text);
    if (this.measure(s, size, fontName) <= width) return s;
    while (s.length > 1 && this.measure(s + "…", size, fontName) > width) s = s.slice(0, -1);
    return s.replace(/\s+$/, "") + "…";
  }
  addPage() { const p = { ops: [] }; this.pages.push(p); return p; }
  _enc(text, f) {
    let out = "";
    for (const ch of this.clean(text)) {
      const cp = ch.codePointAt(0);
      const g = f.map.get(cp) || 0;
      if (g && !f.used.has(g)) f.used.set(g, cp);
      out += hex4(g);
    }
    return out;
  }
  // y — базовая линия, отсчёт сверху страницы
  text(p, str, x, y, { size = 10, font = "regular", color = "#000000", align = "left", width = 0, spacing = 0 } = {}) {
    const f = this.font(font);
    const s = this.clean(str);
    if (!s) return 0;
    let w = this.measure(s, size, font) + (spacing ? spacing * Math.max(0, [...s].length - 1) : 0);
    let xx = x;
    if (align === "right") xx = x + (width || 0) - w;
    else if (align === "center") xx = x + ((width || 0) - w) / 2;
    p.ops.push(`BT /${f.ref} ${num(size)} Tf ${rgb(color)} rg ${num(spacing || 0)} Tc 1 0 0 1 ${num(xx)} ${num(this.H - y)} Tm <${this._enc(s, f)}> Tj ET`);
    return w;
  }
  rect(p, x, y, w, h, { fill = null, stroke = null, lw = 0.6, r = 0 } = {}) {
    const X = x, Y = this.H - y - h;
    let path;
    if (r > 0) {
      const rr = Math.min(r, w / 2, h / 2), k = 0.5523 * rr;
      const x0 = X, y0 = Y, x1 = X + w, y1 = Y + h;
      path = `${num(x0 + rr)} ${num(y0)} m ${num(x1 - rr)} ${num(y0)} l ${num(x1 - rr + k)} ${num(y0)} ${num(x1)} ${num(y0 + rr - k)} ${num(x1)} ${num(y0 + rr)} c `
        + `${num(x1)} ${num(y1 - rr)} l ${num(x1)} ${num(y1 - rr + k)} ${num(x1 - rr + k)} ${num(y1)} ${num(x1 - rr)} ${num(y1)} c `
        + `${num(x0 + rr)} ${num(y1)} l ${num(x0 + rr - k)} ${num(y1)} ${num(x0)} ${num(y1 - rr + k)} ${num(x0)} ${num(y1 - rr)} c `
        + `${num(x0)} ${num(y0 + rr)} l ${num(x0)} ${num(y0 + rr - k)} ${num(x0 + rr - k)} ${num(y0)} ${num(x0 + rr)} ${num(y0)} c h`;
    } else path = `${num(X)} ${num(Y)} ${num(w)} ${num(h)} re`;
    const op = fill && stroke ? "B" : fill ? "f" : "S";
    p.ops.push(`q ${fill ? rgb(fill) + " rg " : ""}${stroke ? rgb(stroke) + " RG " + num(lw) + " w " : ""}${path} ${op} Q`);
  }
  line(p, x1, y1, x2, y2, { color = "#000000", lw = 0.6, dash = null } = {}) {
    p.ops.push(`q ${rgb(color)} RG ${num(lw)} w ${dash ? "[" + dash.map(num).join(" ") + "] 0 d " : ""}${num(x1)} ${num(this.H - y1)} m ${num(x2)} ${num(this.H - y2)} l S Q`);
  }
  circle(p, cx, cy, r, { fill = null, stroke = null, lw = 0.6 } = {}) {
    const k = 0.5523 * r, X = cx, Y = this.H - cy;
    const path = `${num(X + r)} ${num(Y)} m ${num(X + r)} ${num(Y + k)} ${num(X + k)} ${num(Y + r)} ${num(X)} ${num(Y + r)} c `
      + `${num(X - k)} ${num(Y + r)} ${num(X - r)} ${num(Y + k)} ${num(X - r)} ${num(Y)} c `
      + `${num(X - r)} ${num(Y - k)} ${num(X - k)} ${num(Y - r)} ${num(X)} ${num(Y - r)} c `
      + `${num(X + k)} ${num(Y - r)} ${num(X + r)} ${num(Y - k)} ${num(X + r)} ${num(Y)} c h`;
    const op = fill && stroke ? "B" : fill ? "f" : "S";
    p.ops.push(`q ${fill ? rgb(fill) + " rg " : ""}${stroke ? rgb(stroke) + " RG " + num(lw) + " w " : ""}${path} ${op} Q`);
  }
  // галочка рисунком (в шрифте её нет)
  check(p, x, y, s, color = "#3E8E5E", lw = 1.4) {
    const H = this.H;
    p.ops.push(`q ${rgb(color)} RG ${num(lw)} w 1 J 1 j ${num(x)} ${num(H - (y - s * 0.45))} m ${num(x + s * 0.38)} ${num(H - y)} l ${num(x + s)} ${num(H - (y - s))} l S Q`);
  }

  save() {
    const objs = [];   // [номер] = строка/байты тела объекта
    const add = (body) => { objs.push(body); return objs.length; };
    const catalogN = add(null), pagesN = add(null);
    // шрифты
    const fontRefs = {};
    Object.keys(this.fonts).forEach((name) => {
      const f = this.fonts[name];
      const psName = "SAREPT+SAReportSerif-" + (name === "bold" ? "Bold" : "Regular");
      const fileN = add({ stream: f.bytes, dict: `/Length1 ${f.bytes.length}` });
      const sc = 1000 / f.upm;
      const descN = add(`<< /Type /FontDescriptor /FontName /${psName} /Flags 32 /FontBBox [${f.bbox.map((v) => Math.round(v * sc)).join(" ")}] /ItalicAngle ${num(f.italicAngle)} /Ascent ${Math.round(f.ascent * sc)} /Descent ${Math.round(f.descent * sc)} /CapHeight ${Math.round(f.capHeight * sc)} /StemV ${name === "bold" ? 140 : 80} /FontFile2 ${fileN} 0 R >>`);
      const gids = [...f.used.keys()].sort((a, b) => a - b);
      let W = "", i = 0;
      while (i < gids.length) {
        let j = i; const run = [Math.round(f.adv[gids[i]] * sc)];
        while (j + 1 < gids.length && gids[j + 1] === gids[j] + 1) { j++; run.push(Math.round(f.adv[gids[j]] * sc)); }
        W += `${gids[i]} [${run.join(" ")}] `; i = j + 1;
      }
      const cidN = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${psName} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descN} 0 R /DW ${Math.round(f.adv[0] * sc) || 500} /W [${W.trim()}] /CIDToGIDMap /Identity >>`);
      let cm = "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n";
      for (let a = 0; a < gids.length; a += 100) {
        const chunk = gids.slice(a, a + 100);
        cm += `${chunk.length} beginbfchar\n` + chunk.map((g) => { const cp = f.used.get(g); const u = cp > 0xFFFF ? hex4(0xD800 + ((cp - 0x10000) >> 10)) + hex4(0xDC00 + ((cp - 0x10000) & 0x3FF)) : hex4(cp); return `<${hex4(g)}> <${u}>`; }).join("\n") + "\nendbfchar\n";
      }
      cm += "endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend";
      const tuN = add({ stream: enc.encode(cm), dict: "" });
      fontRefs[f.ref] = add(`<< /Type /Font /Subtype /Type0 /BaseFont /${psName} /Encoding /Identity-H /DescendantFonts [${cidN} 0 R] /ToUnicode ${tuN} 0 R >>`);
    });
    const fontDict = "<< " + Object.keys(fontRefs).map((r) => `/${r} ${fontRefs[r]} 0 R`).join(" ") + " >>";
    const pageNs = this.pages.map((p) => {
      const contentN = add({ stream: enc.encode(p.ops.join("\n")), dict: "" });
      return add(`<< /Type /Page /Parent ${pagesN} 0 R /MediaBox [0 0 ${num(this.W)} ${num(this.H)}] /Resources << /Font ${fontDict} /ProcSet [/PDF /Text] >> /Contents ${contentN} 0 R >>`);
    });
    objs[pagesN - 1] = `<< /Type /Pages /Kids [${pageNs.map((n) => n + " 0 R").join(" ")}] /Count ${pageNs.length} >>`;
    objs[catalogN - 1] = `<< /Type /Catalog /Pages ${pagesN} 0 R /ViewerPreferences << /DisplayDocTitle true >> >>`;
    const d = new Date(); const pad = (n) => String(n).padStart(2, "0");
    const stamp = `D:${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
    const infoN = add(`<< /Title ${utf16hex(this.title)} /Author ${utf16hex(this.author)} /Producer (Service Academy) /CreationDate (${stamp}) >>`);

    const chunks = []; let len = 0;
    const push = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; chunks.push(b); len += b.length; };
    push("%PDF-1.7\n");
    push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));   // двоичная метка: файл не текстовый
    const offsets = [];
    objs.forEach((o, i) => {
      offsets[i] = len;
      push(`${i + 1} 0 obj\n`);
      if (o && typeof o === "object" && o.stream) {
        push(`<< /Length ${o.stream.length}${o.dict ? " " + o.dict : ""} >>\nstream\n`);
        push(o.stream);
        push("\nendstream\nendobj\n");
      } else push(`${o}\nendobj\n`);
    });
    const xref = len;
    let x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((o) => { x += String(o).padStart(10, "0") + " 00000 n \n"; });
    x += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogN} 0 R /Info ${infoN} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    push(x);
    const out = new Uint8Array(len); let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
}

export const PDF_MIME = "application/pdf";
