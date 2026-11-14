// tools/claude/run-tests.mjs — v157: юнит-тесты проекта без vitest (в песочнице пакеты не ставятся).
// Запуск: node tools/claude/run-tests.mjs <проект> [имена файлов…]
// Каждый tests/*.test.js собирается esbuild (vitest → shim.mjs) и идёт в своём процессе node из корня проекта.
import { createRequire } from "node:module";
import { readdirSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { cpus } from "node:os";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const esbuild = (() => { for (const p of [G + "/tsx/node_modules/esbuild", "/opt/npm-tools/node_modules/esbuild", G + "/esbuild"]) { try { return require(p); } catch (e) {} } throw new Error("esbuild не найден"); })();
const PRJ = resolve(process.argv[2] || "."), only = process.argv.slice(3);
const SHIM = resolve(new URL("./vitest-shim.mjs", import.meta.url).pathname);
const TMP = "/tmp/vt-" + process.pid; mkdirSync(TMP, { recursive: true });
const files = readdirSync(join(PRJ, "tests")).filter((f) => /\.test\.jsx?$/.test(f) && (!only.length || only.includes(f))).sort();
const t0 = Date.now(); let pass = 0, fail = 0; const bad = [];
async function one(f) {
  const out = join(TMP, f.replace(/[^\w.-]/g, "_") + ".mjs");
  try {
    await esbuild.build({ entryPoints: [join(PRJ, "tests", f)], bundle: true, format: "esm", platform: "node", target: "node20", outfile: out, jsx: "automatic", nodePaths: [G], logLevel: "silent",
      alias: { vitest: SHIM }, loader: { ".js": "jsx", ".woff": "dataurl", ".woff2": "dataurl", ".webp": "dataurl", ".png": "dataurl", ".jpg": "dataurl" },
      define: { "import.meta.env": JSON.stringify({ MODE: "test", DEV: false, PROD: false }) },
      banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
      footer: { js: "\nconst __r = await globalThis.__vt_run(); process.stdout.write('\\n__VT__' + JSON.stringify(__r) + '\\n'); process.exit(0);" } });
  } catch (e) { fail++; bad.push({ f, fails: [{ name: "сборка", msg: String(e.message).slice(0, 900) }] }); return; }
  await new Promise((done) => {
    const p = spawn(process.execPath, [out], { cwd: PRJ, env: { ...process.env, TZ: process.env.TZ || "UTC" } }); let so = "", se = "";
    p.stdout.on("data", (d) => (so += d)); p.stderr.on("data", (d) => (se += d));
    const kill = setTimeout(() => { try { p.kill("SIGKILL"); } catch (e) {} }, 180000);
    p.on("close", () => { clearTimeout(kill);
      const m = so.match(/__VT__(\{.*\})\s*$/s);
      if (!m) { fail++; bad.push({ f, fails: [{ name: "запуск", msg: (se || so).slice(-900) }] }); return done(); }
      const r = JSON.parse(m[1]); pass += r.pass; fail += r.fail; if (r.fail) bad.push({ f, fails: r.fails }); done(); });
  });
}
const queue = [...files]; const N = Math.max(2, Math.min(6, cpus().length));
await Promise.all(Array.from({ length: N }, async () => { while (queue.length) await one(queue.shift()); }));
for (const b of bad) { console.log("✗ " + b.f); for (const x of b.fails.slice(0, 12)) console.log("   · " + x.name + "\n     " + x.msg.replace(/\n/g, "\n     ")); }
console.log(`файлов ${files.length}, тестов прошло ${pass}, упало ${fail}, ${((Date.now() - t0) / 1000).toFixed(1)} с`);
rmSync(TMP, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
