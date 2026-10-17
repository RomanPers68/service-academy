// shoot.mjs — открыть собранное приложение в Chromium как телефон и пройти сценарий.
// Запуск: node shoot.mjs scenario.json
// Сеть наружу закрыта: приложение уходит в офлайн-режим с кэшем профиля —
// так же, как в Telegram без связи. Ошибки страницы собираются и печатаются.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const G = "/home/claude/.npm-global/lib/node_modules";
const { chromium } = require(G + "/playwright");

const SITE = "/home/claude/preview/site";
const PORT = +(process.env.PORT || 5178);   // разные порты — можно гонять темы параллельно
const OUT = "/home/claude/preview/shots";
mkdirSync(OUT, { recursive: true });
const list = JSON.parse(readFileSync(process.argv[2], "utf8"));
const scenarios = Array.isArray(list) ? list : [list];
const SRC = process.env.SRC || "/home/claude/work/service-academy";
const { HINTS, HINTS_VERSION } = await import(SRC + "/data/hints.js");

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(PORT, r));

const PROFILES = {
  staff: { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false },
  admin: { id: "u-admin", name: "Роман", surname: "Петров", restaurant: "Два моря, Океан", position: "manager", is_admin: true },
};

const browser = await chromium.launch();
let failed = 0;
for (const sc of scenarios) {
  const prof = PROFILES[sc.who || "staff"];
  const uk = `_${prof.name}_${prof.surname}`;
  const seed = {
    sa_session_token: "preview",
    sa_profile: JSON.stringify(prof),
    sa_a11y: sc.theme === "light" ? "1" : "0",
    sa_welcome_seen_v11: "1",
    sa_last_role: JSON.stringify(sc.role || "seasonal"),
    sa_hint_mistakes: "1",
  };
  // Все подсказки — «уже видел», кроме тех, что проверяем
  const keep = new Set(sc.hints || []);
  for (const k of Object.keys(HINTS)) if (!keep.has(k)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
  for (const [k, v] of Object.entries(sc.storage || {})) seed[k.replace("{uk}", uk)] = typeof v === "string" ? v : JSON.stringify(v);

  const ctx = await browser.newContext({ viewport: { width: sc.w || 390, height: sc.h || 844 }, deviceScaleFactor: 2, isMobile: true,
    hasTouch: true, serviceWorkers: "block", locale: "ru-RU", timezoneId: "Europe/Moscow",
    reducedMotion: sc.reducedMotion ? "reduce" : "no-preference",
    ...(sc.video ? { recordVideo: { dir: OUT + "/video", size: { width: sc.w || 390, height: sc.h || 844 } } } : {}) });
  // sc.mock: { имяФункции: ответ } — подставной ответ сервера для макета на примерных данных
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (sc.mockUrl) for (const [part, body] of Object.entries(sc.mockUrl))   // подмена — раньше пропуска на локальный сервер, иначе /api/… отдаёт страницу
      if (u.includes(part)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (u.startsWith("http://localhost:" + PORT)) return route.continue();
    const m = u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (m && sc.mock && sc.mock[m[1]] !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sc.mock[m[1]]) });
    return route.abort();
  });
  await ctx.addInitScript((seed) => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::|xMidYEnd/.test(m.text())) errors.push("console: " + m.text().slice(0, 300)); });

  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 15000 }).catch(() => errors.push("заставка не ушла за 15 с"));
  await page.waitForTimeout(600);
  console.log(`\n▶ ${sc.name}`);
  for (const st of sc.steps || []) {
    try {
      if (st.fill) { await page.fill(st.fill[0], st.fill[1]); }
      else if (st.waitFor) { await page.waitForSelector(st.waitFor, { timeout: 10000 }); }
      else if (st.tap) { await page.locator(st.tap).first().tap({ timeout: 5000 }); await page.waitForTimeout(st.after ?? 700); }
      else if (st.click) { await page.locator(st.click).first().click({ timeout: 5000 }); await page.waitForTimeout(st.after ?? 700); }
      else if (st.wait) await page.waitForTimeout(st.wait);
      else if (st.eval) { const r = await page.evaluate(st.eval); if (r !== undefined) console.log("  eval:", JSON.stringify(r)); }
      else if (st.shot) { const f = join(OUT, `${sc.name}-${st.shot}.png`); await page.screenshot({ path: f, fullPage: !!st.full }); console.log("  снимок:", f); }
      else if (st.nav) { await page.evaluate((to) => window.__saNav(to), st.nav); await page.waitForTimeout(st.after ?? 1200); }
      else if (st.expectHint !== undefined) {
        const n = await page.evaluate(() => document.querySelectorAll(".sa-hintglow").length);
        const anchored = await page.evaluate(() => [...document.querySelectorAll(".sa-hintglow")].some(el => getComputedStyle(el.parentElement).position === "fixed"));
        const txt = await page.evaluate(() => { const e = document.querySelector(".sa-hintglow"); return e ? e.innerText.replace(/\s+/g, " ").slice(0, 90) : ""; });
        console.log(`  подсказка: ${n ? (anchored ? "есть, с подсветкой" : "есть, страничная") : "НЕТ"}${txt ? " — " + txt : ""}`);
        if (!!n !== !!st.expectHint) errors.push(st.expectHint ? "подсказка не появилась" : "подсказка есть, а не должна");
      }
      else if (st.align) {
        // Рамка подсветки против настоящего положения цели сейчас, когда всё доехало
        const r = await page.evaluate(() => {
          const frame = [...document.querySelectorAll("div")].find(d => d.style.position === "fixed" && /9999px/.test(d.style.boxShadow));
          if (!frame) return null;
          const f = frame.getBoundingClientRect();
          const want = { top: f.top + 6, left: f.left + 6, w: f.width - 12, h: f.height - 12 };
          const portal = frame.parentElement;
          let best = null, bestD = 1e9;
          for (const el of document.querySelectorAll("body *")) {
            if (portal.contains(el)) continue;
            const b = el.getBoundingClientRect();
            if (b.width < 4 || b.height < 4) continue;
            const d = Math.abs(b.top - want.top) + Math.abs(b.left - want.left) + Math.abs(b.width - want.w) + Math.abs(b.height - want.h);
            if (d < bestD) { bestD = d; best = { dTop: Math.round((want.top - b.top) * 10) / 10, dLeft: Math.round((want.left - b.left) * 10) / 10, dW: Math.round(want.w - b.width), dH: Math.round(want.h - b.height), tag: el.tagName, txt: (el.innerText || "").replace(/\s+/g, " ").slice(0, 40) }; }
          }
          return best;
        });
        console.log("  рамка:", r ? `сдвиг по вертикали ${r.dTop} px, по горизонтали ${r.dLeft} px, размер ±${r.dW}/${r.dH} — цель <${r.tag}> «${r.txt}»` : "не найдена");
        if (r && (Math.abs(r.dTop) > 1.5 || Math.abs(r.dLeft) > 1.5)) errors.push(`рамка мимо цели: ${r.dTop}/${r.dLeft} px`);
      }
      else if (st.scroll !== undefined) { await page.evaluate((y) => window.scrollTo(0, y), st.scroll); await page.waitForTimeout(300); }
    } catch (e) { errors.push(`шаг ${JSON.stringify(st)}: ${e.message.split("\n")[0]}`); }
  }
  if (errors.length) { failed++; console.log("  ОШИБКИ:"); for (const e of errors) console.log("   ", e); }
  else console.log("  ошибок нет");
  const vid = sc.video ? page.video() : null;
  await ctx.close();
  if (vid) { const { renameSync } = await import("node:fs"); try { renameSync(await vid.path(), join(OUT, sc.name + ".webm")); console.log("  видео:", sc.name + ".webm"); } catch (e) {} }
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
