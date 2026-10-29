// tools/claude/demo-app/build.mjs — v97 (Доп. 410): демо приложения целиком (сервер в странице, boot.js) — папка, которую
// можно открыть с любого адреса: пути относительные (menu/…, reference/…, assets/fonts/…), без сервис-воркера и Telegram.
// Запуск: node tools/claude/demo-app/build.mjs <исходники> <папка>
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const esbuild = (() => { for (const p of [G + "/tsx/node_modules/esbuild", "/opt/npm-tools/node_modules/esbuild", G + "/esbuild"]) { try { return require(p); } catch (e) {} } throw new Error("esbuild не найден"); })();
const SRC = process.argv[2], OUT = process.argv[3];
if (!SRC || !OUT) throw new Error("node build.mjs <исходники> <папка>");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT + "/dist", { recursive: true });
for (const d of ["menu", "reference", "icons", "assets"]) { try { cpSync(join(SRC, "public", d), join(OUT, d), { recursive: true }); } catch (e) {} }
try { cpSync(SRC + "/assets/fonts", OUT + "/assets/fonts", { recursive: true }); } catch (e) {}
// пути от корня сайта → от страницы: демо открывается не из корня
const rel = (s) => s.replace(/(["'`(])\/(menu|reference|icons|assets)\//g, "$1$2/");
const demoPlugin = {
  name: "demo-paths",
  setup(b) {
    b.onLoad({ filter: /\.(js|jsx)$/ }, (args) => {
      if (args.path.includes("node_modules")) return undefined;
      let src = readFileSync(args.path, "utf8");
      if (/[\\/]App\.jsx$/.test(args.path)) {
        const anchor = '  const goBack = useCallback((fallback = "roleSelect") => {';
        if (src.includes(anchor)) src = src.replace(anchor, '  if (typeof window !== "undefined") window.__saNav = navigate;\n' + anchor);
        // v109: месяц «Что дало обучение» для кнопки «Открыть итог» в сообщении бота (в приложении — ссылка ?go=gain_<месяц>)
        const gm = '  const [gainMonth, setGainMonth] = useState("");';
        if (src.includes(gm)) src = src.replace(gm, gm + '\n  if (typeof window !== "undefined") window.__saGainMonth = setGainMonth;');
      }
      if (/[\\/]main\.jsx$/.test(args.path)) src = src.replace('"serviceWorker" in navigator', "false");
      return { contents: rel(src), loader: args.path.endsWith(".jsx") ? "jsx" : "js" };
    });
  },
};
await esbuild.build({
  entryPoints: [SRC + "/main.jsx"], bundle: true, format: "esm", splitting: true, outdir: OUT + "/dist", jsx: "automatic", nodePaths: [G],
  platform: "browser", target: "es2020", define: { "process.env.NODE_ENV": '"production"' }, minify: true, sourcemap: false, logLevel: "warning",
  entryNames: "index", chunkNames: "c-[hash]", plugins: [demoPlugin],
});
await esbuild.build({
  entryPoints: [SRC + "/tools/claude/demo-app/boot.js"], bundle: true, format: "iife", outfile: OUT + "/dist/demo-boot.js", nodePaths: [G],
  platform: "browser", target: "es2020", minify: true, sourcemap: false, logLevel: "warning", plugins: [demoPlugin],
});
let html = readFileSync(SRC + "/index.html", "utf8");
html = html.replace(/<script src="https:\/\/telegram\.org[^<]*<\/script>/, "")
  .replace(/<link rel="(preconnect|dns-prefetch|manifest|apple-touch-icon)"[^>]*>\s*/g, "")
  .replace(/<title>[^<]*<\/title>/, "<title>Service Academy · демо</title>")
  .replace(/url\(\/assets\//g, "url(assets/")
  .replace(/<script type="module" src="[^"]*"><\/script>/, "");
html = html.replace("</head>", '    <script src="dist/demo-boot.js"></script>\n  </head>');
html = html.replace("</body>", '    <script type="module" src="dist/index.js"></script>\n  </body>');
writeFileSync(OUT + "/index.html", html);
console.log("готово:", OUT);
