// lib/xlsx.js — Доп. 309: Excel-файл (.xlsx) без сторонних библиотек.
// Книга из листов: текст, числа, проценты; жирная шапка с заливкой, закреплённая первая
// строка, автофильтр, ширина колонок, перенос длинного текста, подсветка «внимание».
// Упаковка — обычный ZIP без сжатия: Excel, Numbers, Google Таблицы и LibreOffice
// открывают его как родной. Работает и в браузере, и на сервере (Node).

const enc = new TextEncoder();

let CRC_T = null;
export function crc32(buf) {
  if (!CRC_T) {
    CRC_T = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function concat(chunks) {
  const len = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// ZIP без сжатия: [{ name, data: Uint8Array | string }]
export function zipStore(files, when = new Date()) {
  const dosTime = ((when.getHours() & 31) << 11) | ((when.getMinutes() & 63) << 5) | ((Math.floor(when.getSeconds() / 2)) & 31);
  const dosDate = (((when.getFullYear() - 1980) & 127) << 9) | (((when.getMonth() + 1) & 15) << 5) | (when.getDate() & 31);
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
  end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
  return concat([...parts, ...central, new Uint8Array(end.buffer)]);
}

// XML: экранирование и только допустимые символы
const xml = (s) => String(s == null ? "" : s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function colName(i) {
  let s = ""; let n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Стили (номера — порядок cellXfs ниже)
const STYLE = { text: 0, head: 1, wrap: 2, pct: 3, int: 4, bold: 5, warn: 6, good: 7, title: 8, muted: 9, num1: 10 };

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts>
<fonts count="5">
<font><sz val="11"/><color rgb="FF2A1F0E"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF2A1F0E"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><color rgb="FF2A1F0E"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="10"/><color rgb="FF6B5B40"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF1A1008"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="5">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8D5A8"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF8DDD3"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDCEBDD"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFB59A62"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const sheetName = (s, i, used) => {
  let n = String(s || "Лист " + (i + 1)).replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Лист " + (i + 1);
  let k = n, j = 2;
  while (used.has(k.toLowerCase())) { k = n.slice(0, 28) + " " + j++; }
  used.add(k.toLowerCase());
  return k;
};

function cellXml(ref, cell, colStyle) {
  if (cell == null || cell === "") return "";
  let v = cell, s = colStyle;
  if (typeof cell === "object" && !(cell instanceof Date)) { v = cell.v; if (cell.s) s = cell.s; }
  if (v == null || v === "") return s && s !== "text" ? `<c r="${ref}" s="${STYLE[s] || 0}"/>` : "";
  const si = STYLE[s] != null ? STYLE[s] : 0;
  if (typeof v === "number" && isFinite(v)) return `<c r="${ref}" s="${si}"><v>${v}</v></c>`;
  if (typeof v === "boolean") return `<c r="${ref}" s="${si}" t="b"><v>${v ? 1 : 0}</v></c>`;
  const str = String(v);
  const keep = /^\s|\s$|\n/.test(str) ? ' xml:space="preserve"' : "";
  return `<c r="${ref}" s="${si}" t="inlineStr"><is><t${keep}>${xml(str)}</t></is></c>`;
}

function sheetXml(sh) {
  const cols = sh.columns || [];
  const rows = sh.rows || [];
  const hasHead = cols.some((c) => c && c.header != null);
  const all = hasHead ? [cols.map((c) => ({ v: c.header, s: "head" })), ...rows] : rows;
  const width = Math.max(cols.length, ...all.map((r) => (r || []).length), 1);
  const last = colName(width - 1) + Math.max(all.length, 1);
  let x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`;
  if (sh.tab) x += `<sheetPr><tabColor rgb="FF${String(sh.tab).replace("#", "").toUpperCase()}"/></sheetPr>`;
  x += `<dimension ref="A1:${last}"/>`;
  x += `<sheetViews><sheetView workbookViewId="0"${sh.selected ? ' tabSelected="1"' : ""}>`;
  if (hasHead && sh.freeze !== false && all.length > 1) x += `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>`;
  x += `</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>`;
  if (cols.length) x += "<cols>" + cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(4, Math.min(90, Number(c && c.width) || 12))}" customWidth="1"/>`).join("") + "</cols>";
  x += "<sheetData>";
  all.forEach((r, ri) => {
    const cells = (r || []).map((cell, ci) => cellXml(colName(ci) + (ri + 1), cell, ri === 0 && hasHead ? "head" : (cols[ci] && cols[ci].style) || "text")).join("");
    const ht = ri === 0 && hasHead ? ' ht="30" customHeight="1"' : "";
    x += `<row r="${ri + 1}"${ht}>${cells}</row>`;
  });
  x += "</sheetData>";
  if (hasHead && sh.filter !== false && all.length > 1) x += `<autoFilter ref="A1:${last}"/>`;
  x += `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>`;
  x += `<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>`;
  x += "</worksheet>";
  return x;
}

// sheets: [{ name, columns: [{ header, width, style }], rows: [[cell]], tab, freeze, filter }]
// ячейка: строка | число | { v, s: "pct"|"int"|"bold"|"warn"|"good"|"muted"|"wrap"|"title"|"num1" }
export function buildXlsx(sheets, meta = {}) {
  const used = new Set();
  const list = (sheets && sheets.length ? sheets : [{ name: "Лист 1", rows: [] }]).map((s, i) => ({ ...s, name: sheetName(s.name, i, used), selected: i === 0 }));
  const now = new Date();
  const iso = now.toISOString().replace(/\.\d+Z$/, "Z");
  const files = [];
  files.push({ name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${list.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` });
  files.push({ name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` });
  files.push({ name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(meta.title || "Отчёт")}</dc:title><dc:creator>${xml(meta.author || "Service Academy")}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>` });
  files.push({ name: "docProps/app.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Service Academy</Application></Properties>` });
  files.push({ name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${list.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` });
  files.push({ name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
  files.push({ name: "xl/styles.xml", data: STYLES_XML });
  list.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) }));
  return zipStore(files, now);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
