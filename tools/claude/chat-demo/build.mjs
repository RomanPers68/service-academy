// Сборка демо чата в одну страницу: node tools/claude/chat-demo/build.mjs <выход.html> [--local]
// React — с cdnjs (UMD), всё остальное — внутри страницы, со снимками главной (home-dark.webp, home-light.webp: настоящая
// сборка v91, 393 × 852, без числа на круге чата — число рисует демо). --local — React внутри страницы (из глобальных
// пакетов): для проверки в Chromium без сети (cdnjs из песочницы не открывается).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const esbuild = (() => { for (const p of [G + "/tsx/node_modules/esbuild", "/opt/npm-tools/node_modules/esbuild", G + "/esbuild"]) { try { return require(p); } catch (e) { /* */ } } throw new Error("esbuild не найден"); })();
const HERE = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || join(HERE, "chat-demo.html");
const local = process.argv.includes("--local");
// где на снимке круг чата (v91: рядом с нижним меню, в обеих темах на одном месте; число — ярлык на кромке круга)
const HOME_BOX = { dark: { x: 325, y: 777, w: 58, h: 58, round: true }, light: { x: 325, y: 777, w: 58, h: 58, round: true } };
const img = (f) => (existsSync(join(HERE, f)) ? "data:image/webp;base64," + readFileSync(join(HERE, f)).toString("base64") : "");
const home = img("home-dark.webp") && img("home-light.webp")
  ? { w: 393, h: 852, dark: { src: img("home-dark.webp"), box: HOME_BOX.dark }, light: { src: img("home-light.webp"), box: HOME_BOX.light } } : null;
const globals = { name: "globals", setup(b) {
  b.onResolve({ filter: /^react(-dom)?(\/client)?$/ }, (a) => ({ path: a.path, namespace: "g" }));
  b.onLoad({ filter: /.*/, namespace: "g" }, (a) => ({ contents: "module.exports = window." + (a.path.startsWith("react-dom") ? "ReactDOM" : "React") + ";", loader: "js" }));
  b.onResolve({ filter: /^\.\/mic$/ }, () => ({ path: join(HERE, "mic-stub.jsx") }));
  b.onResolve({ filter: /\/chat-app$/ }, () => ({ path: join(HERE, "chat-app-stub.js") }));   // v93: у демо свой «app» (entry.jsx)
} };
const r = await esbuild.build({ entryPoints: [join(HERE, "entry.jsx")], bundle: true, write: false, format: "iife", minify: true, target: "es2018",
  jsx: "transform", jsxFactory: "React.createElement", jsxFragment: "React.Fragment", loader: { ".js": "jsx" },
  define: { "process.env.NODE_ENV": '"production"', __HOME__: JSON.stringify(home) },
  nodePaths: [G], plugins: local ? [{ name: "mic", setup(b) { b.onResolve({ filter: /^\.\/mic$/ }, () => ({ path: join(HERE, "mic-stub.jsx") })); b.onResolve({ filter: /\/chat-app$/ }, () => ({ path: join(HERE, "chat-app-stub.js") })); } }] : [globals], logLevel: "warning" });
const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
let shell = readFileSync(join(HERE, "shell.html"), "utf8");
if (local) shell = shell.replace(/<script src="https:\/\/cdnjs[^>]*><\/script>\n/g, "");
writeFileSync(out, shell.replace("/*__APP__*/", () => js));
console.log("готово:", out, Math.round(js.length / 1024) + " КБ");
