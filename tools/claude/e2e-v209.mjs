// e2e v209 (Доп. 535): винная карта из Word и текста. Демо целиком, Мария — руководитель, «Редактор вин» → «Импорт».
//   BTN  — в импорте кнопка «PDF или Word» с подписью «…PDF, Word (.docx) или текст»; выбор файла принимает .docx;
//   WORD — настоящий .docx (таблица: вино, регион, цена): к AI уходит текст (mode doc, в нём вина из документа),
//          PDF не уходит; на проверку — список вин;
//   TXT  — .txt: тоже mode doc;
//   DOC  — старый .doc: сразу «Старый формат Word (.doc)… Сохрани карту как .docx или PDF.», запросов нет;
//   PDF  — PDF как раньше: mode pdf, файлом.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v209.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { deflateRawSync } from "node:zlib";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5719, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v209";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  const buf = readFileSync(f);
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream", "Content-Length": buf.length }); res.end(buf);
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(extra).slice(0, 300) : "")); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── .docx руками: ZIP с word/document.xml (сжатие deflate, как у Word) ──
function zip(files) {
  const parts = [], dir = []; let off = 0;
  for (const [name, text] of files) {
    const nb = Buffer.from(name, "utf8"), raw = Buffer.from(text, "utf8"), data = deflateRawSync(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nb, data); dir.push(Buffer.concat([ch, nb])); off += 30 + nb.length + data.length;
  }
  const cd = Buffer.concat(dir), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
const P = (t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const ROW3 = (x, y, z) => `<w:tr><w:tc>${P(x)}</w:tc><w:tc>${P(y)}</w:tc><w:tc>${P(z)}</w:tc></w:tr>`;
const DOCX = zip([["[Content_Types].xml", "<Types/>"], ["word/document.xml", `<?xml version="1.0"?><w:document><w:body>${P("Винная карта")}`
  + `<w:tbl>${ROW3("Бароло, Пио Чезаре 2018", "Пьемонт", "9 800 ₽")}${ROW3("Шабли, Домен Ларош 2021", "Бургундия", "6 400 ₽")}</w:tbl>`
  + `</w:body></w:document>`]]);
const EMPTY = zip([["word/document.xml", `<?xml version="1.0"?><w:document><w:body><w:p/></w:body></w:document>`]]);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const browser = await chromium.launch();
async function prep(page) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => {});
  await sleep(1300);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg,#demo-strip,#demo-tgchat,#demo-push{display:none!important}" });
}
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
await page.goto(URL0, { waitUntil: "load" });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__demo_who", "maria"); localStorage.setItem("sa_lesson_cards", "1"); });
await page.goto(URL0, { waitUntil: "load" });
await prep(page);

const until = async (fn, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch (e) { /* */ } await sleep(120); } return null; };
const body = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const calls = () => page.evaluate(() => (window.__demoWineCalls || []).slice());
const shot = (name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const run = async (key, fn) => { if (!want(key)) return; try { await fn(); } catch (e) { ok(key + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };
const reset = () => page.evaluate(() => { window.__demoWineCalls = []; });
const shown = (sel) => page.locator(sel).count().then((n) => n > 0);
const openImport = async () => {
  if (await shown('[aria-label="Закрыть импорт"]')) { await page.locator('[aria-label="Закрыть импорт"]').first().click(); await sleep(300); }
  await page.locator("[data-wine-import-open]").first().click(); await sleep(400);
};
const pick = (file) => page.setInputFiles('input[type="file"][accept*=".docx"] >> nth=0', file);

await page.evaluate(() => window.__saNav("wineEditor")); await sleep(2200);

await run("BTN", async () => {
  await openImport();
  const t = await page.locator('[data-wine-imp="pdf"]').first().innerText();
  ok("BTN: в импорте — «PDF или Word», подпись про Word и текст", /PDF или Word/.test(t) && /PDF, Word \(\.docx\) или текст/.test(t), t);
  const acc = await page.evaluate(() => [...document.querySelectorAll("input[type=file]")].map((i) => i.accept).find((a) => /\.docx/.test(a)) || "");
  ok("BTN: выбор файла принимает .docx и .txt", /\.docx/.test(acc) && /\.txt/.test(acc), acc);
  await shot("btn");
});

await run("WORD", async () => {
  await reset(); await openImport();
  await pick({ name: "Винная карта.docx", mimeType: DOCX_MIME, buffer: DOCX });
  const got = await until(() => shown('[data-wine-import="review"]'), 15000);
  const c = await calls();
  const doc = c.filter((x) => x.mode === "doc");
  ok("WORD: на проверку — список вин", !!got);
  ok("WORD: к AI — текстом (mode doc), PDF не уходит", doc.length >= 1 && c.every((x) => !x.pdf), JSON.stringify(c.map((x) => x.mode)));
  ok("WORD: в тексте — вина из таблицы документа", /Бароло, Пио Чезаре 2018/.test(doc[0] && doc[0].text) && /Шабли, Домен Ларош 2021/.test(doc[0].text) && /9 800 ₽/.test(doc[0].text), doc[0] && doc[0].text);
  await shot("word");
});

await run("TXT", async () => {
  await reset(); await openImport();
  await pick({ name: "carta.txt", mimeType: "text/plain", buffer: Buffer.from("Риоха Резерва 2017 — 7 200 ₽\nГави ди Гави 2022 — 820 ₽ бокал", "utf8") });
  const got = await until(() => shown('[data-wine-import="review"]'), 15000);
  const c = await calls();
  ok("TXT: тоже текстом (mode doc)", !!got && c.some((x) => x.mode === "doc" && /Риоха Резерва 2017/.test(x.text)), JSON.stringify(c.map((x) => x.mode)));
});

await run("DOC", async () => {
  await reset(); await openImport();
  await pick({ name: "старая карта.doc", mimeType: "application/msword", buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) });
  const msg = await until(async () => /Старый формат Word \(\.doc\) не открыть\. Сохрани карту как \.docx или PDF\./.test(await body()), 5000);
  ok("DOC: сразу понятные слова, запросов нет", !!msg && (await calls()).length === 0, JSON.stringify(await calls()));
  await shot("doc");
});

await run("PDF", async () => {
  await reset(); await openImport();
  await pick({ name: "carta.pdf", mimeType: "application/pdf", buffer: PDF });
  const got = await until(() => shown('[data-wine-import="review"]'), 15000);
  const c = await calls();
  ok("PDF: как раньше — файлом (mode pdf)", !!got && c.some((x) => x.mode === "pdf" && x.pdf) && !c.some((x) => x.mode === "doc"), JSON.stringify(c.map((x) => x.mode)));
});

ok("без ошибок страницы", errs.length === 0, errs.join(" | "));
console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
