// v208 (Доп. 534): меню из Word (.docx) и текста — кнопка «Из файла»; Word читается на телефоне, на сервер уходит текст.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { docxText } from "../lib/docx-text.js";
import { menuFileKind, runMenuImport, MENU_FILE_ACCEPT, MENU_TEXT_MAX, MENU_FILE_WHY, menuImportWhy } from "../lib/menu-import.js";
import * as api from "../api/menu-import.js";

const rd = (f) => readFileSync(f, "utf8");

// ── маленький ZIP (как .docx) руками — как в tests/v191 ──
function zip(files) {
  const parts = [], dir = []; let off = 0;
  for (const [name, text, method] of files) {
    const nb = Buffer.from(name, "utf8"), raw = Buffer.from(text, "utf8"), data = method === 8 ? deflateRawSync(raw) : raw;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(method, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nb, data); dir.push(Buffer.concat([ch, nb])); off += 30 + nb.length + data.length;
  }
  const cd = Buffer.concat(dir), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  const b = Buffer.concat([...parts, cd, end]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}
const P = (t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const ROW = (a, b) => `<w:tr><w:tc>${P(a)}</w:tc><w:tc>${P(b)}</w:tc></w:tr>`;
const MENU_XML = `<?xml version="1.0"?><w:document><w:body>${P("Зимнее меню")}${P("Паштет из лося — 120 г, брусника, бриошь")}`
  + `<w:tbl>${ROW("Борщ с уткой", "350 г")}${ROW("Глинтвейн «Иней»", "200 мл")}</w:tbl></w:body></w:document>`;

// ── функция Supabase menu-import на стенде ──
const ENV = {};
globalThis.Deno = { serve() {}, env: { get: (k) => ENV[k] } };
const fn = await import("../supabase/functions/menu-import/index.ts");
let NET;
const send = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith("/rest/v1/rpc/whoami")) return send({ ok: true, employee: { id: "e1" } });
  if (u === "https://openrouter.ai/api/v1/chat/completions") {
    const body = JSON.parse(init.body);
    NET.bodies.push(body);
    return send({ model: body.model, choices: [{ message: { content: NET.replies.length ? NET.replies.shift() : "[]" } }] });
  }
  return send(null, 404);
};

describe("v208 · версия и журнал", () => {
  it("сборка v208, Дополнение 534 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(208);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 534 — .*\(v208\)/);
    const part = c.slice(c.indexOf("# Дополнение 534"));
    for (const w of ["может следующим мы добавим загрузку не только PDF, но и Word файл", "«Из файла»", "lib/docx-text.js",
      "menu-import", "tools/claude/e2e-v208.mjs"]) expect(part, w).toContain(w);
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v208 · какой файл и что уходит на сервер", () => {
  it("menuFileKind: PDF, Word, текст, старый .doc, остальное", () => {
    expect(menuFileKind({ name: "Зимнее меню.PDF" })).toBe("pdf");
    expect(menuFileKind({ name: "x", type: "application/pdf" })).toBe("pdf");
    expect(menuFileKind({ name: "меню.docx" })).toBe("docx");
    expect(menuFileKind({ name: "x", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })).toBe("docx");
    expect(menuFileKind({ name: "меню.txt" })).toBe("txt");
    expect(menuFileKind({ name: "меню.doc" })).toBe("doc");
    expect(menuFileKind({ name: "фото.jpg", type: "image/jpeg" })).toBe("");
    expect(MENU_FILE_ACCEPT).toContain(".docx");
    expect(MENU_FILE_WHY.doc).toMatch(/Сохрани меню как \.docx или PDF/);
    expect(menuImportWhy(413)).toMatch(/^Файл слишком большой/);
  });

  it("Word на телефоне → текст меню: абзацы и строки таблицы", async () => {
    const t = await docxText(zip([["[Content_Types].xml", "<Types/>", 0], ["word/document.xml", MENU_XML, 8]]));
    expect(t).toContain("Паштет из лося — 120 г, брусника, бриошь");
    expect(t).toContain("Борщ с уткой");
    expect(t).toContain("Глинтвейн «Иней»");
  });

  it("импорт текстом: и список, и подробности — с text, без pdfBase64", async () => {
    const sent = [];
    const post = async (b) => {
      sent.push(b);
      if (b.mode === "names") return { ok: true, status: 200, j: { names: [{ name: "Борщ с уткой" }, { name: "Глинтвейн «Иней»" }] } };
      return { ok: true, status: 200, j: { dishes: b.names.map((n) => ({ name: n, ask: n, desc: "д" })) } };
    };
    const r = await runMenuImport({ text: "Борщ с уткой\nГлинтвейн «Иней»", post });
    expect(r.dishes.map((d) => d.name)).toEqual(["Борщ с уткой", "Глинтвейн «Иней»"]);
    expect(sent.map((b) => [b.mode, "text" in b, "pdfBase64" in b])).toEqual([["names", true, false], ["details", true, false]]);
  });
});

describe("v208 · сервер: текст вместо PDF (функция Supabase и запасной /api)", () => {
  beforeEach(() => {
    for (const k of Object.keys(ENV)) delete ENV[k];
    Object.assign(ENV, { SUPABASE_URL: "https://sb.test", SUPABASE_SERVICE_ROLE_KEY: "eyJsvc", OPENROUTER_API_KEY: "sk-or-test" });
    NET = { bodies: [], replies: [] };
  });
  const call = async (payload) => {
    const res = await fn.handle(new Request("https://fn.test/menu-import", { method: "POST", body: JSON.stringify({ token: "t", ...payload }) }));
    return { status: res.status, j: await res.json() };
  };

  it("Supabase: text — модели текст с пояснением, файла нет; журнал помечает text", async () => {
    NET.replies.push('[{"name":"Борщ с уткой","cat":"Супы"}]');
    const lines = [], was = console.log;
    console.log = (...a) => lines.push(a.join(" "));
    let r; try { r = await call({ mode: "names", text: "Зимнее меню\nБорщ с уткой — 350 г" }); } finally { console.log = was; }
    expect(r).toMatchObject({ status: 200, j: { names: [{ name: "Борщ с уткой", cat: "Супы" }] } });
    const parts = NET.bodies[0].messages[0].content;
    expect(parts.map((p) => p.type)).toEqual(["text", "text"]);
    expect(parts[0].text).toBe(fn.NAMES_PROMPT);
    expect(parts[1].text).toBe(fn.TEXT_HEAD + "Зимнее меню\nБорщ с уткой — 350 г");
    expect(lines.some((l) => l.startsWith("menu-import names/text 200 "))).toBe(true);
  });

  it("Supabase: слишком длинный текст — 413 словами; ни файла, ни текста — 400", async () => {
    expect(await call({ mode: "names", text: "а".repeat(fn.MAX_TEXT + 1) })).toMatchObject({ status: 413, j: { error: "Текст меню слишком длинный: раздели файл на части" } });
    expect((await call({ mode: "names" })).status).toBe(400);
    expect(NET.bodies.length).toBe(0);
  });

  it("копии совпадают: пояснение, предел и части запроса у функции Supabase и у /api", () => {
    expect(fn.TEXT_HEAD).toBe(api.TEXT_HEAD);
    expect(fn.MAX_TEXT).toBe(api.MAX_TEXT);
    expect(fn.MAX_TEXT).toBe(MENU_TEXT_MAX);
    for (const src of [{ text: "Борщ" }, { pdf: "JVBE" }]) expect(fn.menuParts("П", src)).toEqual(api.menuParts("П", src));
    expect(api.menuParts("П", { pdf: "JVBE" })[1]).toEqual({ type: "file", file: { filename: "menu.pdf", file_data: "data:application/pdf;base64,JVBE" } });
  });

  it("/api/menu-import (запасной): text — те же части запроса", async () => {
    const was = globalThis.fetch, bodies = [];
    process.env.OPENROUTER_API_KEY = "sk-or-test";   // /api берёт ключ из process.env
    globalThis.fetch = async (url, init = {}) => {
      if (String(url).includes("whoami")) return send({ ok: true, employee: { name: "Т" } });
      bodies.push(JSON.parse(init.body));
      return send({ model: "m", choices: [{ message: { content: '[{"name":"Борщ"}]' } }] });
    };
    try {
      const res = { code: 0, body: null, status(c) { res.code = c; return res; }, json(b) { res.body = b; return res; } };
      await api.default({ method: "POST", body: { mode: "names", text: "Борщ — 300 г", token: "v208" } }, res);
      expect(res.code).toBe(200);
      expect(bodies[0].messages[0].content).toEqual(api.menuParts(api.NAMES_PROMPT, { text: "Борщ — 300 г" }));
    } finally { globalThis.fetch = was; }
  });
});

describe("v208 · редактор меню и демо", () => {
  const src = rd("ui/menu-trainer.jsx");
  it("кнопка «Из файла»: PDF, Word и текст; Word — текстом с телефона; подсказка под кнопками", () => {
    expect(src).toContain('{importLabel("Из файла")}');
    expect(src).toContain("<input type=\"file\" accept={MENU_FILE_ACCEPT} onChange={onPdf}");
    expect(src).not.toContain('accept="application/pdf"');
    expect(src).toContain('import { docxText, docErr } from "../lib/docx-text";');
    expect(src).toContain("runMenuImport({ text, post, onProgress: setImportStep })");
    expect(src).toContain("runMenuImport({ pdfBase64, post, onProgress: setImportStep })");
    expect(src).toContain("{MENU_FILE_HINT}");
    expect(src).toMatch(/Читаю \$\{importKind === "docx" \? "Word" : "текст"\}…/);
  });
  it("демо помнит, откуда меню: PDF или текст", () => {
    expect(rd("tools/claude/demo-app/boot.js")).toContain('src: b.text ? "text" : "pdf"');
  });
});
