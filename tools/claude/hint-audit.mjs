// hint-audit.mjs — аудит подсказок по шагам.
// PORT=5195 node hint-audit.mjs list.json
// list: [{ key, screen, who, role, theme, w, h }]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const { chromium } = require(G + "/playwright");
const sharp = require(G + "/sharp");
const SITE = "/home/claude/preview/site", OUT = "/home/claude/haudit", PORT = +(process.env.PORT || 5195);
mkdirSync(OUT + "/shots", { recursive: true }); mkdirSync(OUT + "/res", { recursive: true });
const list = JSON.parse(readFileSync(process.argv[2], "utf8"));
const SRC = process.env.SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split("?")[0]); let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const PROFILES = {
  staff: { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false },
  admin: { id: "u-admin", name: "Роман", surname: "Петров", restaurant: "Два моря, Океан", position: "manager", is_admin: true },
};
const MISTAKES = [
  { q: "Гость говорит об аллергии на орехи. Что делаешь первым?", options: ["Советую блюдо без орехов по памяти", "Уточняю у кухни состав и отмечаю в заказе", "Предлагаю десерт", "Прошу гостя выбрать самому"], correct: 1, explanation: "", lessonTitle: "Аллергены", stage: 1, due: 0 },
  { q: "Через сколько после подачи основного подходят к столу?", options: ["Сразу", "2 минуты или два укуса", "10 минут", "Когда позовут"], correct: 1, explanation: "", lessonTitle: "Стандарты", stage: 0, due: 0 }];
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const parseC = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(",").map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; };

// Всё про текущий шаг: пузырь, рамка, цель, строки, надписи внутри
const PROBE = () => {
  const glow = document.querySelector(".sa-hintglow"); if (!glow) return null;
  const vw = innerWidth, vh = innerHeight;
  const b = glow.getBoundingClientRect();
  const fixed = getComputedStyle(glow.parentElement).position === "fixed";
  const frame = [...document.querySelectorAll("div")].find(d => d.style.position === "fixed" && /9999px/.test(d.style.boxShadow));
  let align = null;
  if (frame) {
    const f = frame.getBoundingClientRect(); const want = { top: f.top + 6, left: f.left + 6, w: f.width - 12, h: f.height - 12 };
    let best = 1e9; for (const el of document.querySelectorAll("body *")) { if (frame.parentElement.contains(el)) continue; const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
      const d = Math.abs(r.top - want.top) + Math.abs(r.left - want.left); if (d < best) best = d; }
    align = Math.round(best * 10) / 10;
  }
  const tx = glow.querySelectorAll("span")[2]; // иконка, колонка, текст
  const textEl = [...glow.querySelectorAll("span")].find(s => s.style.fontFamily && /Georgia/.test(s.style.fontFamily) && s.style.fontSize === "12.5px");
  const lines = textEl ? Math.round(textEl.getBoundingClientRect().height / (parseFloat(getComputedStyle(textEl).lineHeight) || 18)) : null;
  const texts = [];
  const tw = document.createTreeWalker(glow, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { const t = n.nodeValue.trim(); if (!t) continue; const el = n.parentElement; const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect();
    const cs = getComputedStyle(el); texts.push({ t: t.slice(0, 24), color: cs.color, fs: parseFloat(cs.fontSize), fw: parseInt(cs.fontWeight) || 400, r: { x: r.left, y: r.top, w: r.width, h: r.height } }); }
  return { fixed, bubble: { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height) },
    out: fixed && (b.top < 0 || b.bottom > vh || b.left < 0 || b.right > vw), align, lines, texts, vh };
};

const browser = await chromium.launch();
for (const sc of list) {
  if (existsSync(join(OUT, "res", `${sc.theme}-${sc.w}-${sc.key}.json`))) continue;   // уже сделан
  const prof = PROFILES[sc.who]; const uk = `_${prof.name}_${prof.surname}`;
  const seed = { sa_session_token: "preview", sa_profile: JSON.stringify(prof), sa_a11y: sc.theme === "light" ? "1" : "0", sa_welcome_seen_v11: "1",
    sa_last_role: JSON.stringify(sc.role), sa_hint_mistakes: "1", ["sa_mistakes" + uk]: JSON.stringify(MISTAKES) };
  for (const k of Object.keys(HINTS)) if (k !== sc.key) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  const ctx = await browser.newContext({ viewport: { width: sc.w, height: sc.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Europe/Moscow" });
  await ctx.route("**/*", (route) => route.request().url().startsWith("http://localhost:" + PORT) ? route.continue() : route.abort());
  await ctx.addInitScript((seed) => { if (localStorage.getItem("__seeded")) return; localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); localStorage.setItem("__seeded", "1"); }, seed);
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/.test(m.text())) errors.push("console: " + m.text().replace(/\s+/g, " ").slice(0, 160)); });
  const res = { ...sc, errors, steps: [], persisted: null, reappeared: null };
  const open = async () => { await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
    await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400); await page.evaluate((to) => window.__saNav(to), sc.screen); await page.waitForTimeout(1700); };
  try {
    await open();
    const total = (HINTS[sc.key] || []).length;
    for (let s = 0; s < total; s++) {
      const pr = await page.evaluate(PROBE);
      if (!pr) { res.steps.push({ step: s + 1, missing: true }); break; }
      const shot = join(OUT, "shots", `${sc.theme}-${sc.w}-${sc.key}-${s + 1}.png`);
      await page.screenshot({ path: shot });
      let low = [];
      if (sc.w === 390) {   // контраст внутри пузыря: снимок с прозрачным текстом
        const h = await page.addStyleTag({ content: ".sa-hintglow *{color:transparent!important;-webkit-text-fill-color:transparent!important}" });
        await page.waitForTimeout(80); const buf = await page.screenshot(); await h.evaluate(e => e.remove());
        const { data: px, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
        for (const t of pr.texts) { const c = parseC(t.color); if (!c) continue;
          const cx = Math.round((t.r.x + t.r.w / 2) * 2), cy = Math.round((t.r.y + t.r.h / 2) * 2), samp = [];
          for (let dx = -8; dx <= 8; dx += 4) for (let dy = -4; dy <= 4; dy += 4) { const x = Math.min(info.width - 1, Math.max(0, cx + dx)), y = Math.min(info.height - 1, Math.max(0, cy + dy)); const i = (y * info.width + x) * info.channels; samp.push([px[i], px[i + 1], px[i + 2]]); }
          samp.sort((a, b) => lum(a) - lum(b)); const bg = samp[Math.floor(samp.length / 2)];
          const fg = [0, 1, 2].map(i => c[i] * c[3] + bg[i] * (1 - c[3])); const cr = ratio(fg, bg);
          if (cr < 4.5) low.push({ t: t.t, cr: Math.round(cr * 100) / 100, fs: t.fs }); }
      }
      res.steps.push({ step: s + 1, fixed: pr.fixed, out: pr.out, bubble: pr.bubble, align: pr.align, lines: pr.lines, low, shot });
      const btn = page.locator(".sa-hintglow >> text=/^(Дальше|Понятно)$/").first();
      await btn.click({ timeout: 3000 }).catch(e => errors.push(`шаг ${s + 1}: кнопка не нажалась`));
      await page.waitForTimeout(800);
    }
    res.persisted = await page.evaluate(([v, k]) => localStorage.getItem(`sa_hint_v${v}_${k}`), [HINTS_VERSION, sc.key]);
    if (sc.w === 390) await open();   // повторный показ проверяем на основном размере
    if (sc.w === 390) res.reappeared = !!(await page.evaluate(() => document.querySelector(".sa-hintglow")));
  } catch (e) { errors.push("сбой: " + e.message.split("\n")[0]); }
  writeFileSync(join(OUT, "res", `${sc.theme}-${sc.w}-${sc.key}.json`), JSON.stringify(res));
  console.log(`${sc.theme}-${sc.w}-${sc.key}: шагов ${res.steps.length}, вне экрана ${res.steps.filter(s => s.out).length}, ошибок ${errors.length}, повтор ${res.reappeared}`);
  await ctx.close();
}
await browser.close(); server.close();
