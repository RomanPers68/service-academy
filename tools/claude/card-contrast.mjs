// card-contrast.mjs — контраст каждой надписи в карточке ачивки против реального фона под ней
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const { chromium } = require(G + "/playwright"); const sharp = require(G + "/sharp");
const SITE = "/home/claude/preview/site", OUT = "/home/claude/preview/shots", PORT = 5230;
const SRC = "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const server = http.createServer((q, r) => { const p = decodeURIComponent(q.url.split("?")[0]); let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  r.writeHead(200, { "Content-Type": { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" }[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const rec = { lessonId: "s0-q", title: "Тест: первый день", answered: 7, total: 20, at: 1789000000000, seen: false, n: 2,
  wrong: [{ q: "Три принципа мышления новичка — правильный набор:", a: "Улыбаться, не грубить, быть вежливым", r: "Не заставлять искать тебя, подходить при сомнении, беречь спокойствие гостя", e: "Три принципа — образ мышления, не список правил." },
          { q: "Гость зашёл, а ты занят с другим столом. Что делаешь?", a: "Заканчиваю и потом подхожу", r: "Встречаю взглядом и киваю: «Сейчас подойду»", e: "Гость не должен чувствовать себя невидимым." }] };
const rank = { ok: true, mine: 3, leader: 5, players: 5, place: 2, tied: false };
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const browser = await chromium.launch();
for (const theme of ["dark", "light"]) for (const [w, h] of [[390, 844], [360, 640]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route("**/*", (route) => { const u = route.request().url(); if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    if (/rpc\/quiz_key_rank/.test(u)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rank) }); return route.abort(); });
  const seed = { sa_session_token: "p", sa_profile: JSON.stringify({ id: "u", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "hostess", is_admin: false }),
    sa_a11y: theme === "light" ? "1" : "0", sa_welcome_seen_v11: "1", sa_last_role: JSON.stringify("spg"), sa_hint_mistakes: "1", ["sa_loopholes_Анна_Смирнова"]: JSON.stringify([rec]) };
  for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  await ctx.addInitScript((s) => { if (localStorage.getItem("__s")) return; localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); localStorage.setItem("__s", "1"); }, seed);
  const page = await ctx.newPage(); await page.goto("http://localhost:" + PORT + "/"); 
  await page.waitForSelector('[aria-label^="Секретная ачивка. Тапни"]', { timeout: 15000 }); await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector('[aria-label^="Секретная ачивка. Тапни"]').click()); await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/frost-card-${theme}-${w}.png` });
  const texts = await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); const out = []; const tw = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { const t = n.nodeValue.trim(); if (!t) continue; const el = n.parentElement, cs = getComputedStyle(el);
      if (cs.color === "rgba(0, 0, 0, 0)" || cs.webkitTextFillColor === "rgba(0, 0, 0, 0)") continue;   // золотое название (текст-заливка) — отдельно
      const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || r.width < 2) continue;
      out.push({ t: t.slice(0, 26), color: cs.color, fs: parseFloat(cs.fontSize), bold: parseInt(cs.fontWeight) >= 600, r: { x: r.left, y: r.top, w: r.width, h: r.height } }); } return out; });
  const h2 = await page.addStyleTag({ content: "[role=dialog] *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}" });
  await page.waitForTimeout(100); const buf = await page.screenshot(); const { data: px, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const low = [];
  for (const t of texts) { const m = t.color.match(/rgba?\(([^)]+)\)/); if (!m) continue; const c = m[1].split(",").map(Number); const a = c[3] ?? 1;
    const cx = Math.round((t.r.x + t.r.w / 2) * 2), cy = Math.round((t.r.y + t.r.h / 2) * 2), s = [];
    for (let dx = -10; dx <= 10; dx += 5) for (let dy = -4; dy <= 4; dy += 4) { const x = Math.min(info.width - 1, Math.max(0, cx + dx)), y = Math.min(info.height - 1, Math.max(0, cy + dy)); const i = (y * info.width + x) * info.channels; s.push([px[i], px[i + 1], px[i + 2]]); }
    s.sort((p, q) => lum(p) - lum(q)); const bg = s[Math.floor(s.length / 2)]; const fg = [0, 1, 2].map(i => c[i] * a + bg[i] * (1 - a)); const cr = ratio(fg, bg);
    const need = (t.fs >= 18 || (t.fs >= 14 && t.bold)) ? 3 : 4.5; if (cr < need) low.push(`${t.t} ${cr.toFixed(2)} (нужно ${need})`); }
  console.log(`${theme} ${w}: надписей ${texts.length}, ниже нормы: ${low.length}${low.length ? " — " + low.join("; ") : ""}`);
  await ctx.close();
}
await browser.close(); server.close();
