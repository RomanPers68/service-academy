// v205 (Доп. 531): порядок в папке api — сетевой слой Supabase переехал в lib/, спящая заготовка наставника удалена.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(d + "/" + e.name) : [d + "/" + e.name]));

describe("v205 · версия и журнал", () => {
  it("сборка v205, Дополнение 531 со словами владельца, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(205);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 531 — .*\(v205\)/);
    const part = c.slice(c.indexOf("# Дополнение 531"));
    for (const w of ["В vercel-е нужно порядок наводить", "Да, делаем", "lib/supabase.js", "api/assistant.js", "ai-chat"]) expect(part, w).toContain(w);
    for (const l of part.split("\n")) expect(l.length, l).toBeLessThanOrEqual(120);
  });
});

describe("v205 · в api/ только сервер", () => {
  it("каждый файл api/ без «_» — серверная функция с export default", () => {
    const fns = readdirSync("api").filter((f) => f.endsWith(".js") && !f.startsWith("_")).sort();
    expect(fns).toEqual(["backup.js", "cal.js", "lesson-assist.js", "menu-import.js", "report.js", "web-answer.js", "wine-import.js"]);
    for (const f of fns) expect(rd("api/" + f), f).toMatch(/^export default async function handler\(req, res\)/m);
  });

  it("сетевой слой — lib/supabase.js; из api/supabase никто не импортирует", () => {
    expect(existsSync("api/supabase.js")).toBe(false);
    const sb = rd("lib/supabase.js");
    for (const x of ["export const rpc =", "export const saToken =", "export const startBoot ="]) expect(sb, x).toContain(x);
    expect(sb).toContain("переехал из api/ в lib/");
    const src = [...walk("ui"), ...walk("lib"), "App.jsx", ...walk("tests")].filter((f) => /\.(m?js|jsx)$/.test(f));
    for (const f of src) expect(rd(f), f).not.toMatch(/from ["'][./]*api\/supabase/);
    expect(rd("App.jsx")).toContain('from "./lib/supabase";');
    expect(rd("lib/chat-ai.js")).toMatch(/from "\.\/supabase"/);
    expect(rd("ui/menu-trainer.jsx")).toMatch(/from "\.\.\/lib\/supabase"/);
    expect(rd("index.html")).toContain("lib/supabase.js");
  });

  it("спящей заготовки наставника нет; Наставник — через ai-chat; _auth.js называет тех, кто его зовёт", () => {
    expect(existsSync("api/assistant.js")).toBe(false);
    expect(rd("ui/assistant.jsx")).toContain("/functions/v1/ai-chat");
    const users = readdirSync("api").filter((f) => !f.startsWith("_") && rd("api/" + f).includes("./_auth.js"));
    expect(users.length).toBe(4);
    const head = rd("api/_auth.js").split("\n").slice(0, 3).join(" ");
    for (const f of users) expect(head, f).toContain("/api/" + f.replace(/\.js$/, ""));
    expect(head).not.toMatch(/\(\/api\/assistant,/);
    const up = rd("docs/UPGRADE_NOTES.md");
    expect(up).toContain("## AI-наставник");
    expect(up).not.toContain("Корни под AI-ассистента");
  });
});
