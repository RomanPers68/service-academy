// lib/docx-text.js — v191 (Доп. 516): текст из документа Word (.docx) прямо на телефоне — для «О нас» → «Из документа».
//
// Владелец (21.11): «давай сделаем удобнее добавление концепции и стандарты». Концепцию холдинга обычно держат в Word;
// раньше её приходилось сохранять в PDF или копировать текст руками. DOCX — это ZIP-архив, текст лежит в
// word/document.xml. Архив читаем сами: оглавление в конце файла, сжатие deflate снимает DecompressionStream браузера
// (iOS 16.4+, Android Chrome 80+), библиотек не нужно. Заголовки Word → **Заголовок**, пункты списков → «• », строки
// таблиц → «• ячейка — ячейка», остальное — абзацы через пустую строку. Дальше текст можно поправить в поле и отдать
// помощнику, как вставленный руками.

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unent = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === "#"
  ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] || m));

// текст одного абзаца <w:p>: прогоны <w:t>, табуляция и перенос строки
function paraText(p) {
  let out = "";
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>|<w:cr\/>/g;
  let m;
  while ((m = re.exec(p))) out += m[1] != null ? unent(m[1]) : m[0].startsWith("<w:tab") ? " " : "\n";
  return out.replace(/[  ]+/g, " ").trim();
}
// заголовок: стиль Heading/Title/«Заголовок» (в русском Word у «Заголовок 1» номер стиля «1») или весь абзац жирный и короткий
function isHeading(p, text) {
  const st = (p.match(/<w:pStyle\s+w:val="([^"]+)"/) || [])[1] || "";
  if (/^(heading|title|subtitle|заголовок|подзаголовок)/i.test(st) || /^[1-6]$/.test(st)) return true;
  if (text.length > 80 || /[.!?;]$/.test(text)) return false;
  const runs = p.match(/<w:r[\s>][\s\S]*?<\/w:r>/g) || [];
  const withText = runs.filter((r) => /<w:t[\s>]/.test(r));
  return withText.length > 0 && withText.every((r) => /<w:b(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(r));
}

/** word/document.xml → текст с разметкой уроков (до lessonize): заголовки, пункты, строки таблиц, абзацы. */
export function docxXmlToText(xml) {
  const body = String(xml || "").replace(/<w:del\b[\s\S]*?<\/w:del>/g, "");   // удалённое в режиме правки — не текст
  const out = [];
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g;
  let m;
  while ((m = re.exec(body))) {
    const x = m[0];
    if (x.startsWith("<w:tbl")) {
      for (const tr of x.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) || []) {
        const cells = (tr.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || []).map((tc) => (tc.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || []).map(paraText).filter(Boolean).join(" ")).filter(Boolean);
        if (cells.length) out.push("• " + cells.join(" — "));
      }
      out.push("");
      continue;
    }
    const t = paraText(x);
    if (!t) { out.push(""); continue; }
    if (/<w:numPr[\s/>]/.test(x)) { out.push("• " + t); continue; }
    if (isHeading(x, t)) { out.push(""); out.push("**" + t.replace(/\*\*/g, "") + "**"); continue; }
    out.push(""); out.push(t);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Файл name из ZIP-архива (Uint8Array) → Uint8Array или null. Сжатие — без сжатия или deflate. */
export async function unzipEntry(u8, name) {
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (u32(u8, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("zip");
  const count = u16(u8, eocd + 10);
  let p = u32(u8, eocd + 16);
  const dec = new TextDecoder();
  for (let k = 0; k < count && p + 46 <= u8.length; k++) {
    if (u32(u8, p) !== 0x02014b50) throw new Error("zip");
    const method = u16(u8, p + 10), csize = u32(u8, p + 20), nlen = u16(u8, p + 28), elen = u16(u8, p + 30), clen = u16(u8, p + 32), off = u32(u8, p + 42);
    const fname = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    if (fname === name) {
      if (u32(u8, off) !== 0x04034b50) throw new Error("zip");
      const start = off + 30 + u16(u8, off + 26) + u16(u8, off + 28);
      const data = u8.subarray(start, start + csize);
      if (method === 0) return data.slice();
      if (method !== 8) throw new Error("zip-method");
      if (typeof DecompressionStream === "undefined") throw new Error("no-inflate");
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    p += 46 + nlen + elen + clen;
  }
  return null;
}

/** Документ Word (.docx, ArrayBuffer) → текст. Ошибки: "zip" — не документ Word, "no-inflate" — телефон не умеет. */
export async function docxText(buf) {
  const u8 = new Uint8Array(buf);
  if (u8.length < 22 || u32(u8, 0) !== 0x04034b50) throw new Error("zip");
  const xml = await unzipEntry(u8, "word/document.xml");
  if (!xml) throw new Error("zip");
  return docxXmlToText(new TextDecoder().decode(xml));
}

/** Подпись ошибки чтения файла для экрана. */
export function docErr(e) {
  const m = e && e.message;
  return m === "no-inflate" ? "Этот телефон не умеет открывать Word. Сохрани документ в PDF или вставь текст."
    : m === "zip" || m === "zip-method" ? "Не получилось открыть файл как документ Word (.docx). Сохрани его в PDF или вставь текст."
    : "Не получилось прочитать файл. Попробуй PDF или вставь текст.";
}
