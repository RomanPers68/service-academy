// contrast-audit.mjs — контраст текста на экранах (норма WCAG AA: 4.5 для обычного,
// 3.0 для крупного — от 18.66px или от 14px жирного).
//   node tools/claude/contrast-audit.mjs            — все экраны, обе темы
//   node tools/claude/contrast-audit.mjs assistant  — только эти экраны
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = "/home/claude/preview/site", PORT = 5240;
const { HINTS, HINTS_VERSION } = await import("/home/claude/work/service-academy/data/hints.js");

const SCREENS = ["roleSelect", "home", "assistant", "shift", "daily", "checklist", "guestbook", "stats", "leaderboard", "mistakes", "me", "guide"];
const want = process.argv.slice(2);
const list = want.length ? SCREENS.filter(s => want.includes(s)) : SCREENS;

const server = http.createServer((q, r) => { const p = decodeURIComponent(q.url.split("?")[0]); let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  r.writeHead(200, { "Content-Type": { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" }[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));

const AUDIT = () => {
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const parse = (c) => { const m = String(c).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const hex = (c) => "#" + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  const pageBg = parse(getComputedStyle(document.body).backgroundColor) || { r: 23, g: 18, b: 8, a: 1 };
  const base = pageBg.a === 0 ? { r: 23, g: 18, b: 8, a: 1 } : pageBg;
  // Фон под текстом: складываем непрозрачные слои вверх по дереву. Если встретился
  // градиент (фон-картинка) — измерить нельзя, такой текст пропускаем (иначе тёмная
  // надпись на золотой кнопке выглядит как нарушение).
  let grad = false;
  const bgOf = (el) => { let cur = el, acc = null;
    grad = false;
    const stack = [];
    while (cur && cur !== document.documentElement) {
      const st = getComputedStyle(cur);
      const isBase = cur === document.body || cur.id === "root" || cur.id === "sa-scene";
      if (!isBase && st.backgroundImage && st.backgroundImage !== "none" && !/^url\(/.test(st.backgroundImage)) grad = true;   // градиент карточки/кнопки
      const c = parse(st.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 0.99) break; }
      cur = cur.parentElement;
    }
    acc = { ...base };
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc; };
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    if (el.children.length) continue;
    const txt = (el.textContent || "").trim();
    if (txt.length < 2) continue;
    if (el.offsetParent === null) continue;
    const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
    const st = getComputedStyle(el);
    if (+st.opacity < 0.95) continue;             // намеренно приглушённое/гаснущее
    const fgRaw = parse(st.color); if (!fgRaw) continue;
    const bg = bgOf(el); const fg = over(fgRaw, bg);
    // тёмный текст на градиентной кнопке (золотая «Начать») — фон не измерить, пропускаем
    if (grad && lum(fgRaw.r, fgRaw.g, fgRaw.b) < 0.08) continue;
    const L1 = lum(fg.r, fg.g, fg.b), L2 = lum(bg.r, bg.g, bg.b);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(st.fontSize), bold = +st.fontWeight >= 700 || st.fontWeight === "bold";
    const need = (size >= 18.66 || (bold && size >= 14)) ? 3 : 4.5;
    if (ratio < need) out.push({ text: txt.slice(0, 40), color: hex(fgRaw), bg: hex(bg), size, bold, ratio: Math.round(ratio * 100) / 100, need });
  }
  return out;
};

const browser = await chromium.launch();
const rows = [];
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route("**/*", (route) => { const u = route.request().url();
    if (u.startsWith(`http://localhost:${PORT}`)) return route.continue();
    if (u.includes("/rpc/")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    return route.abort(); });
  const seed = { sa_session_token: "p", sa_a11y: theme === "light" ? "1" : "0", sa_welcome_seen_v11: "1", sa_last_role: JSON.stringify("seasonal"),
    sa_profile: JSON.stringify({ id: "u", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter" }) };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  await ctx.addInitScript((s) => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(1800);
  for (const scr of list) {
    await page.evaluate((s) => window.__saNav && window.__saNav(s), scr);
    await page.waitForTimeout(1100);
    const bad = await page.evaluate(AUDIT);
    bad.forEach(b => rows.push({ theme, screen: scr, ...b }));
  }
  await ctx.close();
}
await browser.close(); server.close();

const byColor = new Map();
rows.forEach(r => { const k = `${r.theme} ${r.color} на ${r.bg}`; const v = byColor.get(k) || { n: 0, min: 9, ex: "", screens: new Set(), size: r.size };
  v.n++; v.min = Math.min(v.min, r.ratio); v.ex = v.ex || r.text; v.screens.add(r.screen); byColor.set(k, v); });
console.log(`нарушений: ${rows.length} · цветов: ${byColor.size}`);
[...byColor.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) =>
  console.log(`  ${k} · ${v.n} шт · худший ${v.min} · ${v.size}px · ${[...v.screens].join(",")} · «${v.ex}»`));
