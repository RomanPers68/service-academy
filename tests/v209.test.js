// v209 (Доп. 535): винная и барная карта из Word (.docx) и текста — как меню (v208): читаем на телефоне, шлём текстом.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { fileKind, fileText, DOC_ACCEPT, DOC_TEXT_MAX } from "../lib/file-kind.js";
import { menuFileKind, MENU_FILE_ACCEPT, MENU_TEXT_MAX } from "../lib/menu-import.js";
import handler, { DOC_HEAD, DOC_MAX } from "../api/wine-import.js";

const rd = (f) => readFileSync(f, "utf8");

// ── маленький ZIP (как .docx) руками — как в tests/v191 ──
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
  const b = Buffer.concat([...parts, cd, end]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}
const P = (t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const ROW = (a, b, c) => `<w:tr><w:tc>${P(a)}</w:tc><w:tc>${P(b)}</w:tc><w:tc>${P(c)}</w:tc></w:tr>`;
const CARD_XML = `<?xml version="1.0"?><w:document><w:body>${P("Винная карта")}<w:tbl>${ROW("Бароло, Пио Чезаре 2018", "Пьемонт", "9 800 ₽")}`
  + `${ROW("Шабли, Домен Ларош 2021", "Бургундия", "6 400 ₽")}</w:tbl></w:body></w:document>`;
const asFile = (name, buf, type = "") => ({ name, type, arrayBuffer: async () => buf, text: async () => new TextDecoder().decode(buf) });

describe("v209 · версия и журнал", () => {
  it("сборка v209, Дополнение 535 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(209);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 535 — .*\(v209\)/);
    const part = c.slice(c.indexOf("# Дополнение 535"));
    for (const w of ["«Да, давай😉»", "PDF или Word", "lib/file-kind.js", "mode \"doc\"", "app-api", "tools/claude/e2e-v209.mjs"]) expect(part, w).toContain(w);
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v209 · файл: какой и как прочитать (общее для меню и карты)", () => {
  it("fileKind — тот же, что у меню; принимаем PDF, Word и текст", () => {
    expect(menuFileKind).toBe(fileKind);
    expect(MENU_FILE_ACCEPT).toBe(DOC_ACCEPT);
    expect(MENU_TEXT_MAX).toBe(DOC_TEXT_MAX);
    expect(DOC_TEXT_MAX).toBe(DOC_MAX);
    expect(fileKind({ name: "Карта.DOCX" })).toBe("docx");
    expect(fileKind({ name: "карта.doc" })).toBe("doc");
    expect(fileKind({ name: "x.pdf" })).toBe("pdf");
  });
  it("fileText: Word — текст с таблицей; .txt — как есть, без пробелов по краям", async () => {
    const t = await fileText(asFile("карта.docx", zip([["word/document.xml", CARD_XML]])));
    expect(t).toContain("Бароло, Пио Чезаре 2018");
    expect(t).toContain("Шабли, Домен Ларош 2021");
    expect(t).toContain("9 800 ₽");
    const txt = new TextEncoder().encode("  Риоха Резерва 2017 — 7 200 ₽\n");
    expect(await fileText(asFile("карта.txt", txt.buffer))).toBe("Риоха Резерва 2017 — 7 200 ₽");
    await expect(fileText(asFile("не-word.docx", new TextEncoder().encode("просто текст").buffer))).rejects.toThrow("zip");
  });
});

describe("v209 · сервер: mode \"doc\" — карта текстом (api/wine-import.js, он же в app-api)", () => {
  let bodies;
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    bodies = [];
    globalThis.fetch = async (url, init = {}) => {
      if (String(url).includes("whoami")) return { ok: true, status: 200, json: async () => ({ ok: true, employee: { name: "М", position: "manager" } }) };
      bodies.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content: '[{"name":"Бароло","producer":"Пио Чезаре","vintage":"2018"}]' }, finish_reason: "stop" }] }) };
    };
  });
  const mkRes = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
  const call = async (b) => { const res = mkRes(); await handler({ method: "POST", body: { token: "tok-" + Math.random(), ...b } }, res); return res; };

  it("вино: подсказка листа и текст карты с пояснением, как у PDF — 16 000 токенов, вина на проверку", async () => {
    const r = await call({ mode: "doc", text: "Бароло, Пио Чезаре 2018 — 9 800 ₽", after: "Шабли" });
    expect(r.code).toBe(200);
    expect(r.body.wines.map((w) => w.name)).toEqual(["Бароло"]);
    expect(r.body.cut).toBe(false);
    const c = bodies[0].messages[0].content;
    expect(c.map((p) => p.type)).toEqual(["text", "text"]);
    expect(c[0].text).toMatch(/На листе — винная карта ресторана/);
    expect(c[0].text).toContain("«Шабли»");
    expect(c[1].text).toBe(DOC_HEAD + "Бароло, Пио Чезаре 2018 — 9 800 ₽");
    expect(bodies[0].max_tokens).toBe(16000);
  });

  it("крепкое — своя подсказка; пусто — 400; слишком длинно — 413 словами", async () => {
    await call({ mode: "doc", kind: "spirit", text: "Лагавулин 16 — 1 200 ₽ / 40 мл" });
    expect(bodies[0].messages[0].content[0].text).toMatch(/барная карта ресторана/);
    expect((await call({ mode: "doc", text: "   " })).code).toBe(400);
    const big = await call({ mode: "doc", text: "а".repeat(DOC_MAX + 1) });
    expect(big.code).toBe(413);
    expect(big.body.error).toBe("Текст карты слишком длинный: раздели файл на части");
  });
});

describe("v209 · редактор карты и демо", () => {
  const E = rd("ui/wine-editor.jsx");
  it("кнопка «PDF или Word», выбор файла — PDF, Word и текст; Word — текстом с телефона, режим doc", () => {
    expect(E).toContain("<b>PDF или Word</b>");
    expect(E).toContain("accept={DOC_ACCEPT}");
    expect(E).toContain("if (f) onCardFile(f);");
    expect(E).toContain('if (k === "docx" || k === "txt") { runSheets([f], "doc", k); return; }');
    expect(E).toContain('kind === "doc" ? { mode: "doc", text: b, after }');
    expect(E).toContain("Старый формат Word (.doc) не открыть. Сохрани карту как .docx или PDF.");
    expect(E).toMatch(/kind === "doc" \? \(sub === "txt" \? "Читаю текст" : "Читаю Word"\)/);
  });
  it("демо помнит, что ушло к AI карты (режим, текст, PDF)", () => {
    expect(rd("tools/claude/demo-app/boot.js")).toContain("window.__demoWineCalls");
  });
});
