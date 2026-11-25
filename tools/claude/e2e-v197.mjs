// e2e v197 (Доп. 522): ролик сервис-менеджера с титрами по новому тексту. Демо целиком (tools/claude/demo-app/build.mjs),
// урок по id — window.__saLesson; сервер с Range и открытие телефона — как в e2e-v176.mjs.
//   FILE — демо отдаёт новый файл: первые 8 знаков SHA-256 = rev в data/intro-videos.js; обложка на месте;
//   PLAY — урок sm0-1: ролик идёт сам, 54 с, 19 отметок фраз; перемотка на «Менеджер зала держит смену» (7,5 с),
//          «которая держит все смены» (11 с) и «Значит, система выстроена» (51,7 с) — ролик там играет, снимки для
//          владельца; без ошибок страницы.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> E2E_SRC=<исходники> node e2e-v197.mjs [FILE PLAY]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5697, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v197";
const SRC = resolve(process.env.E2E_SRC || new URL("../..", import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const { INTRO_VIDEOS } = await import(pathToFileURL(join(SRC, "data/intro-videos.js")).href);
const V = INTRO_VIDEOS["sm0-1"];
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  const type = mime[extname(f)] || "application/octet-stream";
  const buf = readFileSync(f);
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (m) {
    const a = m[1] ? Number(m[1]) : 0, b = m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
    res.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${a}-${b}/${buf.length}`, "Content-Length": b - a + 1 });
    res.end(buf.subarray(a, b + 1));
    return;
  }
  res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": buf.length }); res.end(buf);
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 600) : "")); } };
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

const boot = async (page, errs) => {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1300);
  await page.evaluate(() => localStorage.setItem("sa_lesson_cards", "1"));
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
};
async function open({ dsf = 2 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("__demo_who", "anna"); });
  await page.goto(URL0, { waitUntil: "load" });
  await boot(page, errs);
  return { ctx, page, errs };
}
const lesson = async (page, id, ms = 1600) => { const r = await page.evaluate((x) => (window.__saLesson ? window.__saLesson(x) : false), id); await page.waitForTimeout(ms); return r; };
const player = (page) => page.evaluate(() => {
  const p = document.querySelector("[data-intro-player]");
  if (!p) return null;
  const v = p.querySelector("video[data-intro-el]");
  return { role: p.getAttribute("data-intro-player"), state: p.getAttribute("data-intro-state"), ui: p.getAttribute("data-intro-ui"),
    src: v ? v.getAttribute("data-intro-src") : "", t: v ? v.currentTime : -1, paused: v ? v.paused : null, dur: v ? v.duration : 0,
    ticks: p.querySelectorAll("[data-intro-cue]").length };
});
const waitFor = async (page, fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await page.waitForTimeout(120); } return v; };
const waitPlayer = async (page, test, ms = 8000) => (await waitFor(page, async () => { const p = await player(page); return p && test(p) ? p : null; }, ms)) || player(page);
const seek = (page, t) => page.evaluate((x) => new Promise((r) => { const v = document.querySelector("video[data-intro-el]"); const done = () => r(v.currentTime); v.addEventListener("seeked", done, { once: true }); v.currentTime = x; setTimeout(done, 1500); }), t);
const run = async (keys, fn) => { if (!keys.some(want)) return; try { await fn(); } catch (e) { ok(keys.join("/") + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };

// ── FILE: в демо новый файл ──────────────────────────────────────────────────────────────────────────────────
await run(["FILE"], async () => {
  const { ctx, page, errs } = await open();
  const got = await page.evaluate(async ([src, poster]) => {
    const r = await fetch(src);
    const b = await r.arrayBuffer();
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", b));
    const p = await fetch(poster);
    return { status: r.status, size: b.byteLength, rev: [...h.slice(0, 4)].map((x) => x.toString(16).padStart(2, "0")).join(""), poster: p.status };
  }, [V.src, V.poster]);
  ok("FILE: ролик отдаётся, первые 8 знаков SHA-256 = rev " + V.rev, got.status === 200 && got.rev === V.rev, got);
  ok("FILE: не прежний ролик (9c528d71 — титры со старым текстом)", got.rev !== "9c528d71", got);
  ok("FILE: обложка на месте", got.poster === 200, got);
  ok("FILE: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── PLAY: урок, ролик, три места с новым текстом ─────────────────────────────────────────────────────────────
await run(["PLAY"], async () => {
  const { ctx, page, errs } = await open({ dsf: 3 });
  await lesson(page, "sm0-1", 300);
  const p0 = await waitPlayer(page, (p) => p.state === "playing" && p.dur > 0);
  ok("PLAY: ролик сервис-менеджера пошёл сам", !!p0 && p0.role === "service_manager" && p0.state === "playing", p0);
  // демо кладёт ролики рядом со страницей: адрес без «/» в начале
  ok("PLAY: файл " + V.src + ", длительность около 54 с", !!p0 && p0.src.replace(/^\//, "") === V.src.replace(/^\//, "") && Math.abs(p0.dur - V.dur) < 0.6, p0);
  ok("PLAY: 19 отметок фраз на полоске", !!p0 && p0.ticks === V.cues.length && V.cues.length === 19, p0);
  // кнопки гаснут через 3,2 с — снимки без них
  await waitPlayer(page, (p) => p.ui === "off", 6000);
  await page.addStyleTag({ content: "#demo-strip,#demo-tgchat,#demo-push{display:none!important}" });
  for (const [t, name, what] of [[7.45, "owner-1-smenu", "«Менеджер зала держит смену»"], [10.9, "owner-2-vse-smeny", "«которая держит все смены»"],
    [51.7, "owner-3-vystroena", "«Значит, система выстроена»"]]) {
    await seek(page, t); await page.waitForTimeout(350);
    const p = await player(page);
    await page.screenshot({ path: OUT + "/" + name + ".png" });
    ok("PLAY: " + what + " — ролик там и играет (" + (p ? p.t.toFixed(2) : "?") + " с)", !!p && p.t >= t - 0.05 && p.t < t + 1.2 && !p.paused, p);
  }
  ok("PLAY: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
