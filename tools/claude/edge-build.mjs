// tools/claude/edge-build.mjs — v207 (Доп. 533): собрать функцию Supabase app-api в один файл.
//
//   node tools/claude/edge-build.mjs           → supabase/functions/app-api/index.ts (собранный, руками не правят)
//   node tools/claude/edge-build.mjs --check   → только проверить, что собранный файл свежий (код выхода 1 — нет)
//
// Источник — supabase/functions/app-api/entry.js: переходник Supabase → обработчики api/wine-import.js,
// api/lesson-assist.js, api/web-answer.js и всё, что они подключают (api/_auth.js, api/_web.js, lib/…). В шапке
// собранного файла — список этих файлов и их отпечаток (sha256): tests/v207.test.js сверяет его с файлами в
// репозитории, поэтому правка обработчика без пересборки не пройдёт проверки. После пересборки функцию нужно
// развернуть заново (supabase functions deploy app-api или из чата).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, resolve } from "node:path";

const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const esbuild = (() => {
  for (const p of ["esbuild", G + "/tsx/node_modules/esbuild", "/opt/npm-tools/node_modules/esbuild", G + "/esbuild"]) { try { return require(p); } catch (e) { /* дальше */ } }
  throw new Error("esbuild не найден");
})();

const PRJ = resolve(process.argv.find((a, i) => i > 1 && !a.startsWith("--")) || ".");
const ENTRY = join(PRJ, "supabase/functions/app-api/entry.js");
const OUT = join(PRJ, "supabase/functions/app-api/index.ts");

/** Отпечаток источников: по порядку списка — путь, перевод строки, содержимое. Тот же расчёт — в tests/v207.test.js. */
export const sourcesHash = (root, files) => {
  const h = createHash("sha256");
  for (const f of files) { h.update(f + "\n"); h.update(readFileSync(join(root, f), "utf8")); }
  return h.digest("hex");
};

const r = await esbuild.build({
  entryPoints: [ENTRY], bundle: true, write: false, metafile: true, format: "esm", platform: "neutral", target: "es2022",
  external: ["node:*"], charset: "utf8", legalComments: "none", logLevel: "silent",
  define: { "import.meta.env": "{}" },
});
const files = Object.keys(r.metafile.inputs).filter((p) => !p.startsWith("<")).map((p) => relative(PRJ, resolve(PRJ, p)).replace(/\\/g, "/")).sort();
const hash = sourcesHash(PRJ, files);
const head = [
  "// @ts-nocheck",
  "// supabase/functions/app-api/index.ts — СОБРАНО: node tools/claude/edge-build.mjs (руками не править).",
  "// Источник — supabase/functions/app-api/entry.js и всё, что он подключает:",
  ...files.map((f) => "//   " + f),
  "// sources-sha256: " + hash,
  "",
].join("\n");
const code = head + r.outputFiles[0].text;

// --stub <коммит>: что разворачивать в Supabase из чата — короткий index.ts, который при развёртывании берёт собранный
// файл этого коммита с GitHub (репозиторий открытый). Так не нужно пересылать 100+ КБ кода в каждом развёртывании,
// а развёрнуто ровно то, что лежит в репозитории на этом коммите.
const si = process.argv.indexOf("--stub");
if (si > 0) {
  const sha = String(process.argv[si + 1] || "");
  if (!/^[0-9a-f]{40}$/.test(sha)) { console.error("нужен полный хеш коммита: --stub <40 знаков>"); process.exit(1); }
  console.log("// app-api — развёрнуто из GitHub: собранный файл коммита " + sha.slice(0, 7) + " (tools/claude/edge-build.mjs --stub).\n"
    + "import \"https://raw.githubusercontent.com/RomanPers68/service-academy/" + sha + "/supabase/functions/app-api/index.ts\";");
  process.exit(0);
}

if (process.argv.includes("--check")) {
  const old = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  const ok = old.includes("// sources-sha256: " + hash);
  console.log(ok ? "app-api: собранный файл свежий" : "app-api: собранный файл устарел — node tools/claude/edge-build.mjs");
  process.exit(ok ? 0 : 1);
}
writeFileSync(OUT, code);
console.log("app-api: " + files.length + " файлов → " + relative(PRJ, OUT) + " (" + Math.round(code.length / 1024) + " КБ), sha256 " + hash.slice(0, 12));
