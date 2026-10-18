// Сборка «как в проде» для замеров скорости: production React, минификация, без карт исходников.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const esbuild = (() => { for (const p of [G + "/tsx/node_modules/esbuild", "/opt/npm-tools/node_modules/esbuild", G + "/esbuild"]) { try { return require(p); } catch (e) {} } throw new Error("esbuild не найден"); })();
const SRC = process.argv[2];
const OUT = process.env.PREVIEW_OUT || "/home/claude/preview/site-prod";   // v40: параллельные сборки — каждая в свою папку
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT + "/dist", { recursive: true });
cpSync(SRC + "/public", OUT, { recursive: true });
rmSync(OUT + "/sw.js", { force: true });           // сервис-воркер в просмотре не нужен
// Доп. 296: рукописный шрифт лежит в assets/fonts (Vite кладёт его в /assets/ по new URL(…, import.meta.url))
try { cpSync(SRC + "/assets/fonts", OUT + "/assets/fonts", { recursive: true }); } catch (e) {}
const result = await esbuild.build({ metafile: true,
  entryPoints: [SRC + "/main.jsx"], bundle: true, format: "esm", splitting: true,
  outdir: OUT + "/dist", jsx: "automatic", nodePaths: [G], platform: "browser", target: "es2020",
  define: { "process.env.NODE_ENV": '"production"' }, minify: true, sourcemap: false, logLevel: "warning",
  entryNames: "index",
  plugins: [{
    // Только для просмотра: открыть navigate() наружу, чтобы переходить на экран
    // напрямую. В файлы проекта это не попадает.
    name: "preview-nav",
    setup(b) {
      b.onLoad({ filter: /App\.jsx$/ }, (args) => {
        let src = readFileSync(args.path, "utf8");
        const anchor = '  const goBack = useCallback((fallback = "roleSelect") => {';
        if (!src.includes(anchor)) throw new Error("preview-nav: якорь не найден");
        src = src.replace(anchor, '  if (typeof window !== "undefined") window.__saNav = navigate;\n' + anchor);
        return { contents: src, loader: "jsx" };
      });
    },
  }],
});
let html = readFileSync(SRC + "/index.html", "utf8");
html = html.replace(/<script src="https:\/\/telegram\.org[^<]*<\/script>/, "")
           .replace(/<script type="module" src="[^"]*"><\/script>/, '<script type="module" src="/dist/index.js"></script>');
if (!html.includes("/dist/index.js")) html = html.replace("</body>", '<script type="module" src="/dist/index.js"></script></body>');
writeFileSync(OUT + "/index.html", html);
writeFileSync(OUT + "/meta.json", JSON.stringify(result.metafile));
console.log("готово:", OUT);
