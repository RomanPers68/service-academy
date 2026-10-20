// perf v64 (из v60/v55b): + «стартовые данные приехали» (последний ответ функций главной) и число запросов до тишины. холодный и тёплый старт «как на телефоне», без перехвата запросов Playwright (он отключает кэш).
// Сборка «как в проде» (build-prod.mjs) копируется во временную папку; адрес Supabase в ней заменяется на
// локальный /sb — его отвечает этот же сервер, с задержкой «как у сервера». Сеть и процессор — через CDP.
// Запуск: PERF_SITE=<сборка-прод> PERF_PORT=<порт> node perf-v55b.mjs [повторов]
import { createRequire } from "node:module";
import http from "node:http";
import zlib from "node:zlib";
import { readFileSync, writeFileSync, statSync, mkdirSync, rmSync, cpSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SRC = process.env.PERF_SITE || "/home/claude/preview/site-v54-prod", PORT = Number(process.env.PERF_PORT) || 5700;
const RUNS = Number(process.argv[2]) || 3;
const SITE = (process.env.PERF_TMP || "/tmp/claude-0/-home-claude/897b4d6e-caa4-57a9-a67a-0f93a5eec2f8/scratchpad/perfsite") + "-" + PORT;
rmSync(SITE, { recursive: true, force: true }); cpSync(SRC, SITE, { recursive: true });
const SB = "https://gvxhgdynjuaisswplroh.supabase.co", LOCAL = "http://localhost:" + PORT + "/sb";
for (const f of readdirSync(join(SITE, "dist"))) {
  const p = join(SITE, "dist", f); const s = readFileSync(p, "utf8");
  if (s.includes(SB)) writeFileSync(p, s.split(SB).join(LOCAL));
}
{
  const p = join(SITE, "index.html"); let s = readFileSync(p, "utf8");
  s = s.split(SB).join(LOCAL).replace(/https:\/\/cdn\.jsdelivr\.net[^"]*/g, "/font.css").replace(/https:\/\/fonts\.googleapis\.com[^"']*/g, "/font.css");
  writeFileSync(p, s);
}
writeFileSync(join(SITE, "font.css"), "/* шрифт в замере не нужен */");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".css": "text/css", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf" };
const prof = { id: "u-staff", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false };
let NET = null; const rpcLog = []; const doneLog = [];
const BOOT = new Set(["app_bootstrap", "whoami", "my_state", "my_reset_at", "my_mentors", "quiz_key_rank", "team_profiles", "team_scores", "pair_status", "day_brief", "cms_list_lessons"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gz = new Map();
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  if (p.startsWith("/sb/")) {
    const m = p.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/); const fn = m ? m[1] : "rest";
    // задержка сервера сверх эмулированной сети: whoami на холодном соединении — DNS, TCP, TLS (+ предзапрос CORS)
    const cold = rpcLog.length === 0;   // первый запрос страницы платит за DNS, TCP, TLS (+ предзапрос CORS) — кто бы он ни был
    rpcLog.push([fn, Date.now()]);
    await sleep(Math.max(0, (cold ? NET.whoami : NET.rpc) - 2 * NET.latency) + (fn === "app_bootstrap" ? 150 : 0));
    const mock = { whoami: { ok: true, employee: prof }, my_reset_at: { ok: true, reset_at: null }, cms_list_lessons: [],
      my_state: { ok: true, v: 2, quiz: [], lessons: [], stars: {}, roles: [], last_role: "seasonal" },
      team_scores: { ok: true, rows: [] }, team_profiles: { ok: true, rows: [], scope: "none" }, my_mentors: { ok: true, rows: [] },
      schedule_load: { ok: false, error: "auth" }, menu_get: [],
      // как отвечает настоящий сервер (не null): иначе бутстрап отдаёт пустую часть и приложение дозапрашивает её
      quiz_key_rank: { ok: true, rank: 2, total: 9 }, pair_status: { ok: true, pair: null }, day_brief: { ok: true, quest: { ok: false } } };
    // v60: app_bootstrap собирает ответы стартовых функций в один JSON (этап 27)
    mock.app_bootstrap = { ok: true, v: 1, at: new Date().toISOString(), parts: Object.fromEntries(["whoami", "my_state", "my_reset_at", "my_mentors", "quiz_key_rank", "team_profiles", "team_scores", "pair_status", "day_brief", "cms_list_lessons"].map((k) => [k, mock[k] !== undefined ? mock[k] : null])) };
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    doneLog.push([fn, Date.now()]);
    res.end(JSON.stringify(m ? (mock[fn] !== undefined ? mock[fn] : null) : []));
    return;
  }
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  const type = mime[extname(f)] || "application/octet-stream";
  const immutable = /\/dist\/.+\.js$/.test(f);   // у Vite и вход, и куски — с хэшем в имени
  const head = { "Content-Type": type, "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache" };
  if (/text|javascript|json|svg|manifest/.test(type)) {
    if (!gz.has(f)) gz.set(f, zlib.gzipSync(readFileSync(f), { level: 6 }));
    res.writeHead(200, { ...head, "Content-Encoding": "gzip" }); res.end(gz.get(f));
  } else { res.writeHead(200, head); res.end(readFileSync(f)); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();

const NETS = {
  "4G": { latency: 70, down: 9e6, up: 3e6, whoami: 450, rpc: 250 },
  "3G": { latency: 300, down: 1.6e6, up: 0.75e6, whoami: 1500, rpc: 800 },
};

async function run(netName, warm) {
  NET = NETS[netName];
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
  const seed = { sa_session_token: "tok-preview", sa_profile: JSON.stringify(prof), sa_a11y: "0", sa_welcome_seen_v11: "1", sa_last_role: JSON.stringify("seasonal"), ["sa_last_role_" + prof.name + "_" + prof.surname]: JSON.stringify("seasonal"), sa_sfx: "0", sa_hint_mistakes: "1", sa_mode_hint: "1" };
  await ctx.addInitScript((seed) => {
    if (!localStorage.getItem("sa_session_token")) for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    for (let i = 0; i < 60; i++) for (const k of ["track", "home", "shift", "team", "me", "mistakes"]) localStorage.setItem("sa_hint_v" + i + "_" + k, "1");
    window.__perf = {};
    const mark = (k) => { if (window.__perf[k] == null) window.__perf[k] = performance.now(); };
    new MutationObserver(() => {
      const sp = document.getElementById("sa-splash");
      if (sp) window.__perf.splashSeen = 1;
      if ((sp && sp.style.opacity === "0") || (!sp && window.__perf.splashSeen)) mark("splashOff");
      const t = document.body ? document.body.innerText : "";
      if (/Добр(ое|ый|ой) /.test(t)) mark("greet");
      if (/Первый день|Дальше|Начать/.test(t)) mark("track");
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  }, seed);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: NET.latency, downloadThroughput: NET.down / 8, uploadThroughput: NET.up / 8 });
  if (warm) {
    await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
    await page.waitForFunction(() => window.__perf && window.__perf.greet, null, { timeout: 60000 }).catch(() => {});
    await sleep(4000);   // фоновые подгрузки после старта дойдут до кэша
  }
  rpcLog.length = 0; doneLog.length = 0; const t0 = Date.now();
  await page.goto("http://localhost:" + PORT + "/", { waitUntil: "load" });
  await page.waitForFunction(() => window.__perf && window.__perf.greet && window.__perf.splashOff, null, { timeout: 60000 }).catch(() => {});
  await sleep(300);
  // дожидаемся тишины в сети: 1,5 с без новых запросов (не дольше 20 с) — «все данные старта приехали»
  for (let i = 0; i < 40; i++) { const last = rpcLog.length ? rpcLog[rpcLog.length - 1][1] : t0; if (Date.now() - last > 1500) break; await sleep(500); }
  const settle = rpcLog.length ? rpcLog[rpcLog.length - 1][1] - t0 : 0, rpcAll = rpcLog.length;
  const bootDone = doneLog.filter(([f]) => BOOT.has(f)).map(([, t]) => t - t0);
  const dataReady = bootDone.length ? Math.max(...bootDone) + NET.latency : null;   // + путь ответа до телефона
  const bootN = rpcLog.filter(([f]) => BOOT.has(f)).length;
  if (process.env.PERF_DUMP) console.log("   ", netName, warm ? "тёплый" : "холодный", "запросы:", rpcLog.map(([f, t]) => f + "@" + (t - t0)).join(" "));
  const r = await page.evaluate(() => {
    const paint = performance.getEntriesByType("paint").find((e) => e.name === "first-contentful-paint");
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource");
    const before = res.filter((e) => e.responseEnd <= (window.__perf.splashOff || 1e9));
    const js = before.filter((e) => /\.js$/.test(e.name.split("?")[0]));
    const rpcs = before.filter((e) => /\/sb\//.test(e.name)).map((e) => e.name.split("/").pop());
    return { fcp: paint ? Math.round(paint.startTime) : null, dcl: Math.round(nav.domContentLoadedEventEnd), splashOff: Math.round(window.__perf.splashOff || -1), greet: Math.round(window.__perf.greet || -1),
      track: window.__perf.track ? Math.round(window.__perf.track) : null,
      jsN: js.length, jsKB: Math.round(js.reduce((s, e) => s + (e.transferSize || 0), 0) / 1024), cached: js.filter((e) => e.transferSize === 0).length, rpcs: rpcs.join(","),
      jsList: js.map((e) => e.name.split("/").pop() + ":" + Math.round((e.transferSize || 0) / 1024)).join(" ") };
  });
  if (process.env.PERF_JS) console.log("    JS:", r.jsList);
  await ctx.close();
  return { ...r, settle, rpcAll, dataReady, bootN };
}

const out = {};
// PERF_ONLY="4G холодный,3G тёплый" — только эти замеры
const ONLY = (process.env.PERF_ONLY || "").split(",").map((x) => x.trim()).filter(Boolean);
for (const netName of Object.keys(NETS)) {
  for (const warm of [false, true]) {
    if (ONLY.length && !ONLY.includes(netName + (warm ? " тёплый" : " холодный"))) continue;
    const rows = [];
    for (let i = 0; i < RUNS; i++) rows.push(await run(netName, warm));
    const med = (k) => { const v = rows.map((x) => x[k]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
    const key = netName + (warm ? " тёплый" : " холодный");
    out[key] = { fcp: med("fcp"), dcl: med("dcl"), splashOff: med("splashOff"), greet: med("greet"), track: med("track"), jsN: med("jsN"), jsKB: med("jsKB"), cached: med("cached"), settle: med("settle"), rpcAll: med("rpcAll"), dataReady: med("dataReady"), bootN: med("bootN") };
    console.log(`${key}: FCP ${med("fcp")} · DCL ${med("dcl")} · заставка гаснет ${med("splashOff")} · приветствие ${med("greet")} · трек ${med("track")} · JS до показа ${med("jsN")} файлов ${med("jsKB")} КБ (из кэша ${med("cached")}) · запросы до показа: ${rows[0].rpcs || "—"} · всего запросов ${med("rpcAll")} (стартовых ${med("bootN")}), стартовые данные приехали через ${med("dataReady")} мс`);
  }
}
writeFileSync(SITE + ".json", JSON.stringify(out, null, 1));
await browser.close(); server.close();
