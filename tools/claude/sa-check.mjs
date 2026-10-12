// sa-check.mjs — проверки Service Academy после каждой правки.
// Запуск: node /home/claude/checks/sa-check.mjs <корень проекта>
//
// Те же шесть проверок, что описаны в передаче дел, но на настоящем разборе
// JSX (TypeScript AST) и настоящем сборщике (esbuild), а не на регулярках:
//   build     — полная сборка от main.jsx (ловит синтаксис, битые импорты/экспорты)
//   check     — синтаксис каждого файла отдельно (замена подсчёта скобок)
//   jsxlint   — «{» сразу после «&& (», «? (», «=> (» на новой строке
//   flexhint  — <HintBubble> прямо внутри флекс-РЯДА
//   scope     — необъявленные имена (tsc, как tests/scope-check.sh)
//   dupimport — повтор имени в импортах файла
//   refcheck  — ссылка ушла в anchorRef, но не прицеплена через ref={…}
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync, writeFileSync, rmSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const ts = require(G + "/typescript");
const esbuild = (() => { for (const p of [G + "/tsx/node_modules/esbuild", "/opt/npm-tools/node_modules/esbuild", G + "/esbuild"]) { try { return require(p); } catch (e) {} } throw new Error("esbuild не найден"); })();

const ROOT = process.argv[2] || process.cwd();
const only = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
const want = (k) => !only || only.has(k);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n === "node_modules" || n.startsWith(".")) continue;
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if ([".js", ".jsx"].includes(extname(n))) out.push(p);
  }
  return out;
}
const files = [
  ...["App.jsx", "main.jsx"].map(f => join(ROOT, f)),
  ...walk(join(ROOT, "ui")), ...walk(join(ROOT, "lib")), ...walk(join(ROOT, "data")),
];
const rel = (p) => relative(ROOT, p);
let problems = 0;
const report = (name, lines) => {
  if (!lines.length) { console.log(`✓ ${name}`); return; }
  problems += lines.length;
  console.log(`✗ ${name} — ${lines.length}`);
  for (const l of lines) console.log("    " + l);
};

// ── build ──────────────────────────────────────────────────────────────────
if (want("build")) {
  const lines = [];
  try {
    const r = await esbuild.build({
      entryPoints: [join(ROOT, "main.jsx")], bundle: true, write: false, format: "esm",
      splitting: true, outdir: "/tmp/sa-build-check", jsx: "automatic", logLevel: "silent",
      nodePaths: [G], platform: "browser", target: "es2020",
    });
    for (const w of r.warnings) {
      // Предупреждения показываем, но сборку они не валят
      if (w.location) console.log(`    · предупреждение ${rel(w.location.file)}:${w.location.line}: ${w.text}`);
    }
  } catch (e) {
    for (const er of e.errors || [{ text: String(e) }]) {
      lines.push(er.location ? `${er.location.file}:${er.location.line}:${er.location.column} ${er.text}` : er.text);
    }
  }
  report("build (esbuild, от main.jsx)", lines);
}

// ── check: синтаксис каждого файла ─────────────────────────────────────────
const sources = new Map();
for (const f of files) sources.set(f, readFileSync(f, "utf8"));
if (want("check")) {
  const lines = [];
  for (const [f, src] of sources) {
    try { esbuild.transformSync(src, { loader: f.endsWith(".jsx") ? "jsx" : "js", jsx: "automatic" }); }
    catch (e) { for (const er of e.errors || []) lines.push(`${rel(f)}:${er.location?.line} ${er.text}`); }
  }
  report("check (синтаксис по файлам)", lines);
}

// ── jsxlint ────────────────────────────────────────────────────────────────
if (want("jsxlint")) {
  const lines = [];
  const re = /(&&|\?|=>)\s*\(\s*\n\s*\{/g;
  for (const [f, src] of sources) {
    if (!f.endsWith(".jsx")) continue;
    let m; while ((m = re.exec(src))) {
      const line = src.slice(0, m.index).split("\n").length;
      lines.push(`${rel(f)}:${line} «{» сразу после «${m[1]} (»`);
    }
  }
  report("jsxlint", lines);
}

// ── AST ────────────────────────────────────────────────────────────────────
const asts = new Map();
const ast = (f) => {
  if (!asts.has(f)) asts.set(f, ts.createSourceFile(f, sources.get(f), ts.ScriptTarget.Latest, true,
    f.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.JS));
  return asts.get(f);
};
const visit = (node, fn) => { fn(node); ts.forEachChild(node, (c) => visit(c, fn)); };
const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
const tagName = (n) => (ts.isJsxElement(n) ? n.openingElement : n).tagName.getText();
const attrs = (n) => (ts.isJsxElement(n) ? n.openingElement : n).attributes.properties;
const attr = (n, name) => attrs(n).find(a => ts.isJsxAttribute(a) && a.name.getText() === name);

// Литеральный объект style={{…}}: ключ → строковое значение
function styleProps(el) {
  const a = attr(el, "style");
  if (!a || !a.initializer || !ts.isJsxExpression(a.initializer)) return null;
  const e = a.initializer.expression;
  if (!e || !ts.isObjectLiteralExpression(e)) return { unknown: true };
  const out = {};
  for (const p of e.properties) {
    if (ts.isPropertyAssignment(p)) {
      const v = p.initializer;
      out[p.name.getText().replace(/["']/g, "")] = ts.isStringLiteral(v) ? v.text : v.getText();
    } else if (ts.isSpreadAssignment(p)) out.__spread = true;
  }
  return out;
}

if (want("flexhint")) {
  const lines = [];
  for (const f of files) {
    if (!f.endsWith(".jsx")) continue;
    const sf = ast(f);
    visit(sf, (n) => {
      if (!(ts.isJsxSelfClosingElement(n) || ts.isJsxElement(n)) || tagName(n) !== "HintBubble") return;
      let p = n.parent;
      while (p && !ts.isJsxElement(p)) p = p.parent;
      if (!p) return;
      const st = styleProps(p);
      if (!st || st.unknown) return;
      const dir = st.flexDirection || "";
      if (/flex/.test(st.display || "") && !/column/.test(dir)) {
        lines.push(`${rel(f)}:${lineOf(sf, n)} HintBubble внутри <${tagName(p)}> с display:flex (ряд), строка ${lineOf(sf, p)}`);
      }
    });
  }
  report("flexhint", lines);
}

if (want("dupimport")) {
  const lines = [];
  for (const f of files) {
    const sf = ast(f);
    const seen = new Map();
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) || !st.importClause) continue;
      const names = [];
      if (st.importClause.name) names.push(st.importClause.name.text);
      const nb = st.importClause.namedBindings;
      if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) names.push(el.name.text);
      if (nb && ts.isNamespaceImport(nb)) names.push(nb.name.text);
      for (const nm of names) {
        if (seen.has(nm)) lines.push(`${rel(f)}:${lineOf(sf, st)} «${nm}» уже импортирован (строка ${seen.get(nm)})`);
        else seen.set(nm, lineOf(sf, st));
      }
    }
  }
  report("dupimport", lines);
}

if (want("refcheck")) {
  const lines = [];
  const idsIn = (e, out = []) => {
    if (!e) return out;
    if (ts.isIdentifier(e)) out.push(e.text);
    else ts.forEachChild(e, (c) => {
      // в условных выражениях берём только ветки, не условие
      idsIn(c, out);
    });
    return out;
  };
  for (const f of files) {
    if (!f.endsWith(".jsx")) continue;
    const sf = ast(f);
    // ближайшая функция-компонент (с заглавной буквы) для узла
    const compOf = (n) => {
      for (let p = n; p; p = p.parent) {
        if (ts.isFunctionDeclaration(p) && p.name && /^[A-Z]/.test(p.name.text)) return p;
        if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent)
            && /^[A-Z]/.test(p.parent.name.getText())) return p;
      }
      return sf;
    };
    const attached = new Map();   // component → Set(имён в ref={…})
    const used = [];
    visit(sf, (n) => {
      if (ts.isPropertyAssignment(n) && n.name.getText() === "ref") {
        const c = compOf(n);
        if (!attached.has(c)) attached.set(c, new Set());
        for (const id of idsIn(n.initializer)) attached.get(c).add(id);
        return;
      }
      if (!ts.isJsxAttribute(n) || !n.initializer || !ts.isJsxExpression(n.initializer)) return;
      const nm = n.name.getText(), ex = n.initializer.expression;
      if (nm === "ref") {
        const c = compOf(n);
        if (!attached.has(c)) attached.set(c, new Set());
        for (const id of idsIn(ex)) attached.get(c).add(id);
      }
      if (nm === "anchorRef") {
        let e = ex;
        const refs = [];
        const collect = (x) => {
          if (!x) return;
          if (ts.isParenthesizedExpression(x)) return collect(x.expression);
          if (ts.isConditionalExpression(x)) { collect(x.whenTrue); collect(x.whenFalse); return; }
          if (ts.isBinaryExpression(x)) { collect(x.left); collect(x.right); return; }
          if (ts.isIdentifier(x) && x.text !== "undefined") refs.push(x.text);
        };
        collect(e);
        for (const r of refs) used.push({ r, node: n, comp: compOf(n) });
      }
    });
    for (const { r, node, comp } of used) {
      if (r === "null") continue;
      const set = attached.get(comp);
      if (!set || !set.has(r)) lines.push(`${rel(f)}:${lineOf(sf, node)} «${r}» передан в anchorRef, но в этом компоненте нет ref={${r}}`);
    }
  }
  report("refcheck", lines);
}

// ── scope: tsc, как в tests/scope-check.sh ─────────────────────────────────
if (want("scope")) {
  const cfg = join(ROOT, "tsconfig.scope.json");
  writeFileSync(cfg, JSON.stringify({ compilerOptions: { allowJs: true, checkJs: true, noEmit: true, jsx: "react-jsx",
    target: "es2022", module: "esnext", moduleResolution: "bundler", strict: false, skipLibCheck: true, types: [],
    allowSyntheticDefaultImports: true },
    include: ["App.jsx", "main.jsx", "ui/**/*.jsx", "ui/**/*.js", "lib/**/*.js", "data/**/*.js"] }));
  let out = "";
  try { out = execSync(`${G}/typescript/bin/tsc -p ${cfg}`, { cwd: ROOT, encoding: "utf8", maxBuffer: 64e6 }); }
  catch (e) { out = (e.stdout || "") + (e.stderr || ""); }
  rmSync(cfg, { force: true });
  const lines = out.split("\n").filter(l => /error TS(2304|2552|2448|2454|2451)/.test(l))
    .filter(l => !/name '(process|Deno|Telegram|global)'/.test(l));
  report("scope (tsc: необъявленные имена)", lines);
}

console.log(problems ? `\nИТОГО: ${problems} замечаний` : "\nВсё чисто.");
process.exit(problems ? 1 : 0);
