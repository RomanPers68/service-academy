// e2e v177 (Доп. 502): видео-знакомство — кнопки без подмигивания, ровные цифры, ролик заранее. Владелец (18.11) с записью
// экрана: «когда нажимаешь на экран, элементы управления подмигивают. <…> цифры стоят не ровно, относительно окантовки
// цифр. <…> Мы можем сделать загрузку видео бесшовной, что бы оно грузилось сразу?» Демо целиком
// (tools/claude/demo-app/build.mjs), урок по id — window.__saLesson; голова сценария — как в e2e-v176.mjs.
//   BLINK  — кнопки проявляются и гаснут без рывка стекла: переходы «замораживаем» (getAnimations) на долях 0…1 и
//            сравниваем кадры. В v176 последние 3 % проявления давали до 2/3 всей перемены (стекло включалось рывком),
//            а в начале угасания стекло пропадало сразу; теперь — не больше 12 %. Ни у кнопки, ни у её обёрток нет
//            прозрачности; то же с «уменьшить движение»;
//   OPEN   — плеер открывается без прозрачности целиком: проявляются подложка и видео, кнопки — своим стеклом;
//   DIGITS — «0:55» на обложке и время в плеере — Piazzolla, цифры ровные и одной ширины, по середине рамки;
//   WARM   — ролик заранее: новичок на главной (первый урок — с видео-знакомством) — ролик качается один раз целиком и
//            ложится в телефон; «Начать» — ролик идёт из памяти, без сети; после перезапуска — из телефона, без сети;
//            не берём: досмотрен, экономия трафика; открыл раньше, чем скачалось, — из сети, заготовка брошена;
//            заготовка испорчена — плеер сам переходит на сеть; обложка в уроке (вернулся на первую карточку) — тоже берёт;
//   SHOTS  — снимки для владельца.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> E2E_SRC=<исходники> node e2e-v177.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5677, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v177";
const SRC = resolve(process.env.E2E_SRC || new URL("../..", import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const { INTRO_VIDEOS } = await import(pathToFileURL(join(SRC, "data/intro-videos.js")).href);
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
// сервер с Range; mp4 — в журнал (с Range — это плеер, без — заготовка); SLOW — заготовку держим столько мс
const NET = [];
let SLOW = 0;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  const type = mime[extname(f)] || "application/octet-stream";
  const buf = readFileSync(f);
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (p.endsWith(".mp4")) NET.push({ p: p.replace(/^.*\//, ""), range: !!m, t: Date.now() });
  if (m) {
    const a = m[1] ? Number(m[1]) : 0, b = m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
    res.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${a}-${b}/${buf.length}`, "Content-Length": b - a + 1 });
    res.end(buf.subarray(a, b + 1));
    return;
  }
  const send = () => { try { res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": buf.length }); res.end(buf); } catch (e) { /* */ } };
  if (SLOW && p.endsWith(".mp4")) setTimeout(send, SLOW); else send();
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 600) : "")); } };
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

const ANNA = "_Анна_Смирнова", KSENIA = "_Ксения_Миронова";
const SEEN_KEY = "sa_intro_seen";
const FIRST = Object.keys(INTRO_VIDEOS);
const allText = () => Object.fromEntries(FIRST.map((id) => [id, "text"]));

const boot = async (page, errs, cards = true) => {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1300);
  await page.evaluate((c) => localStorage.setItem("sa_lesson_cards", c ? "1" : "0"), cards);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
};
async function open({ who = "anna", cards = true, width = 393, height = 852, dsf = 2, seen = null, pos = null, reduce = false, init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka",
    reducedMotion: reduce ? "reduce" : "no-preference" });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await boot(page, errs, cards);
  const uk = who === "ksenia" ? KSENIA : ANNA;
  await page.evaluate(([s, p, k, u]) => { if (s) localStorage.setItem(k + u, JSON.stringify(s)); if (p) localStorage.setItem("sa_card_pos" + u, JSON.stringify(p)); }, [seen, pos, SEEN_KEY, uk]);
  return { ctx, page, errs };
}
// новичок: у Ксении в демо пройден первый урок — делаем её «первый день»: прогресс на сервере и в телефоне пуст
async function newbie({ seen = null, init = null, slow = 0, broken = false } = {}) {
  const o = await open({ who: "ksenia", init });
  // сервер демо живёт в странице и сохраняется после каждого запроса — правим его самого (window.__demo, boot.js)
  await o.page.evaluate(([s, k]) => {
    const d = window.__demo;
    d.srv.S.progress["e-ksenia"] = [];
    if (d.srv.S.quizzes) d.srv.S.quizzes["e-ksenia"] = [];
    d.save();
    localStorage.setItem("sa_completed_Ксения_Миронова", "{}");
    localStorage.removeItem(k);
    if (s) localStorage.setItem(k, JSON.stringify(s));
  }, [seen, SEEN_KEY + KSENIA]);
  if (broken) await o.page.evaluate(async (key) => { const c = await caches.open("sa-video-v1"); await c.put(key, new Response(new Blob([new Uint8Array(4096)], { type: "video/mp4" }), { headers: { "Content-Type": "video/mp4" } })); },
    INTRO_VIDEOS["s0-1"].src.replace(/^\//, "") + "?rev=" + INTRO_VIDEOS["s0-1"].rev);
  SLOW = slow;
  NET.length = 0;
  const t0 = Date.now();
  await o.page.reload({ waitUntil: "load" });
  await o.page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => o.errs.push("заставка не ушла"));
  await o.page.addStyleTag({ content: "#demo-tg{display:none!important}" });
  return { ...o, t0 };
}
const lesson = async (page, id, ms = 1600) => { const r = await page.evaluate((x) => (window.__saLesson ? window.__saLesson(x) : false), id); await page.waitForTimeout(ms); return r; };
const player = (page) => page.evaluate(() => {
  const p = document.querySelector("[data-intro-player]");
  if (!p) return null;
  const v = p.querySelector("video[data-intro-el]");
  return { role: p.getAttribute("data-intro-player"), mode: p.getAttribute("data-intro-mode"), state: p.getAttribute("data-intro-state"), ui: p.getAttribute("data-intro-ui"),
    from: v ? v.getAttribute("data-intro-from") : "", file: v ? v.getAttribute("data-intro-src") : "", src: v ? v.currentSrc || v.src : "", t: v ? v.currentTime : -1, err: v && v.error ? v.error.code : 0 };
});
const waitFor = async (page, fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await page.waitForTimeout(100); } return v; };
const waitState = async (page, want, ms = 8000) => (await waitFor(page, async () => { const p = await player(page); return p && (want instanceof RegExp ? want.test(p.state) : p.state === want) ? p : null; }, ms)) || player(page);
const waitUi = async (page, want, ms = 6000) => waitFor(page, async () => (await page.evaluate(() => (document.querySelector("[data-intro-player]") || { getAttribute: () => "" }).getAttribute("data-intro-ui"))) === want, ms);
const cacheKeys = (page) => page.evaluate(async () => { try { const c = await caches.open("sa-video-v1"); return (await c.keys()).map((r) => r.url.replace(/^.*\/video\//, "")); } catch (e) { return ["err:" + e]; } });
const run = async (keys, fn) => { if (!keys.some(want)) return; try { await fn(); } catch (e) { ok(keys.join("/") + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };

// ── кадры для BLINK ──────────────────────────────────────────────────────────────────────────────────────────
// PNG → средняя разница по пикселям (0…255): декодер PNG здесь же (zlib), без лишних пакетов
import { inflateSync } from "node:zlib";
function png(buf) {
  let o = 8, w = 0, h = 0, ct = 0; const parts = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), t = buf.toString("latin1", o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (t === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    if (t === "IDAT") parts.push(d);
    o += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(parts)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = px.subarray(y * stride, (y + 1) * stride), prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev ? prev[i] : 0, c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
  }
  return { w, h, bpp, px };
}
const diff = (A, B) => { const a = png(A), b = png(B); let s = 0, n = 0; for (let i = 0; i < a.px.length; i += a.bpp) { for (let k = 0; k < 3; k++) s += Math.abs(a.px[i + k] - b.px[i + k]); n += 3; } return s / n; };
// у стекла и его обёрток до <body> нет прозрачности и фильтра (иначе телефон выключает стекло — v176)
const clearPath = (page) => page.evaluate(() => {
  const bad = [];
  for (const g of document.querySelectorAll("[data-intro-player] [data-glass]")) {
    for (let w = g; w && w !== document.body; w = w.parentElement) {
      const cs = getComputedStyle(w);
      if (Number(cs.opacity) < 1 || cs.filter !== "none" || (w !== g && cs.backdropFilter && cs.backdropFilter !== "none")) { bad.push((g.getAttribute("data-intro-x") !== null ? "x" : [...g.attributes].map((a) => a.name).find((n) => n.startsWith("data-intro"))) + "←" + (w.getAttribute("data-intro-player") !== null ? "player" : w.tagName) + ":" + cs.opacity); break; }
    }
  }
  return bad;
});

async function fadeCheck(reduce) {
  const tag = reduce ? " («уменьшить движение»)" : "";
  const { ctx, page, errs } = await open({ seen: allText(), dsf: 2, reduce });
  await page.addStyleTag({ content: "#demo-strip,#demo-tgchat,#demo-push{display:none!important}" });
  await lesson(page, "spg-0-1", 1200);
  await page.locator("[data-intro-cover]").first().tap();
  await waitState(page, "playing");
  // кадр почти стоит (0,0625×), кнопки погасли сами
  await page.evaluate(() => { const v = document.querySelector("video[data-intro-el]"); v.currentTime = 20; v.playbackRate = 0.0625; });
  await waitUi(page, "off", 9000);
  await page.waitForTimeout(700);
  await page.clock.install();   // таймеры страницы стоят: пока снимаем, кнопки сами не погаснут
  const R = await page.evaluate(() => { const g = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left - 6, r.top - 6, r.width + 12, r.height + 12]; };
    return { toggle: g("[data-intro-toggle]"), x: g("[data-intro-x]"), bar: g("[data-intro-controls]") }; });
  const snap = async () => { const o = {}; for (const [k, r] of Object.entries(R)) o[k] = await page.screenshot({ clip: { x: r[0], y: r[1], width: r[2], height: r[3] } }); return o; };
  const P = [0, 0.03, 0.5, 0.97, 1];
  const sweep = async () => {
    const n = await page.evaluate(async () => {
      const p = document.querySelector("[data-intro-player]");
      p.querySelector("[data-intro-stage]").click();
      for (let k = 0; k < 3; k++) await Promise.resolve();
      window.__fz = document.getAnimations().filter((x) => x.effect && x.effect.target && p.contains(x.effect.target) && x.constructor.name === "CSSTransition");
      window.__fz.forEach((x) => x.pause());
      return window.__fz.length;
    });
    const F = {}, paths = [];
    for (const q of P) {
      await page.evaluate((q) => window.__fz.forEach((x) => { const d = x.effect.getComputedTiming().duration; x.currentTime = Math.min(d, q * d); if (q >= 1) x.finish(); }), q);
      await page.waitForTimeout(60);
      F[q] = await snap();
      paths.push(...(await clearPath(page)));
    }
    await page.evaluate(() => window.__fz.forEach((x) => { try { x.finish(); } catch (e) { /* */ } }));
    await page.waitForTimeout(300);
    return { n, F, paths };
  };
  const I = await sweep();
  const shown = await snap();
  const O = await sweep();
  ok("BLINK" + tag + ": касание — кнопки проявляются переходами (стекло, заливка, значок)", I.n >= 12 && O.n >= 12, { in: I.n, out: O.n });
  for (const k of ["toggle", "x", "bar"]) {
    const total = diff(I.F[0][k], I.F[1][k]), end = diff(I.F[0.97][k], I.F[1][k]);
    ok("BLINK" + tag + ": " + k + " — проявление без рывка в конце (последние 3 % — " + (100 * end / total).toFixed(1) + " % перемены)", total > 2 && end / total <= 0.12, { total, end });
    const all = diff(shown[k], O.F[1][k]), jump = diff(shown[k], O.F[0][k]);
    ok("BLINK" + tag + ": " + k + " — угасание без рывка в начале (" + (100 * jump / all).toFixed(1) + " % сразу)", all > 2 && jump / all <= 0.12, { all, jump });
    const mid = diff(I.F[0.5][k], I.F[1][k]);
    ok("BLINK" + tag + ": " + k + " — на середине проявления перемена тоже на середине пути", mid / total >= 0.08 && mid / total <= 0.8, { mid, total });
  }
  ok("BLINK" + tag + ": ни у кнопки, ни у её обёрток нет прозрачности — стекло не выключается", I.paths.length === 0 && O.paths.length === 0, [...I.paths, ...O.paths].slice(0, 6));
  const st = await page.evaluate(() => [...document.querySelectorAll("[data-intro-player] [data-glass]")].map((g) => ({ on: g.getAttribute("data-glass-on"), bf: getComputedStyle(g).backdropFilter,
    skin: getComputedStyle(g.querySelector(":scope > [data-glass-skin]")).opacity, face: getComputedStyle(g.querySelector(":scope > [data-glass-face]")).opacity, pe: getComputedStyle(g).pointerEvents })));
  ok("BLINK" + tag + ": погасшие — размытие 0, заливка и значок прозрачные, касания проходят к видео",
    st.length >= 6 && st.every((g) => g.on === "0" && /blur\(0px\)/.test(g.bf) && g.skin === "0" && g.face === "0" && g.pe === "none"), st);
  ok("BLINK" + tag + ": без ошибок страницы", errs.length === 0, errs);
  if (!reduce) for (const q of [0, 0.5, 1]) writeFileSync(OUT + "/blink-in-" + Math.round(q * 100) + ".png", I.F[q].toggle);
  await ctx.close();
}

// ── BLINK ───────────────────────────────────────────────────────────────────────────────────────────────────
await run(["BLINK"], async () => { await fadeCheck(false); await fadeCheck(true); });

// ── OPEN: плеер открывается — проявляются подложка и видео, кнопки — своим стеклом ─────────────────────────────
await run(["OPEN"], async () => {
  const { ctx, page, errs } = await open({ seen: allText() });
  await lesson(page, "c0-1", 1200);
  await page.locator("[data-intro-cover]").first().tap();
  const seq = [];
  for (let k = 0; k < 8; k++) {
    seq.push(await page.evaluate(() => { const p = document.querySelector("[data-intro-player]"); if (!p) return null; const cs = getComputedStyle(p);
      return { root: cs.animationName + "/" + cs.opacity, bg: getComputedStyle(p.querySelector("[data-intro-bg]")).animationName, stage: getComputedStyle(p.querySelector("[data-intro-stage]")).animationName,
        on: [...p.querySelectorAll("[data-glass]")].map((g) => g.getAttribute("data-glass-on")).join("") }; }));
    seq[seq.length - 1] && (seq[seq.length - 1].bad = await clearPath(page));
    await page.waitForTimeout(60);
  }
  const s = seq.filter(Boolean);
  ok("OPEN: сам плеер не проявляется прозрачностью — проявляются подложка и видео", s.length > 0 && s.every((x) => x.root === "none/1" && x.bg === "saFadeIn" && x.stage === "saFadeIn"), s.slice(0, 2));
  ok("OPEN: пока открывается, у стекла кнопок нет прозрачных обёрток", s.every((x) => x.bad.length === 0), s.map((x) => x.bad).flat().slice(0, 4));
  ok("OPEN: кнопки встают погасшими и проявляются своим стеклом", s.some((x) => /0/.test(x.on)) && /^1+$/.test(s[s.length - 1].on), s.map((x) => x.on));
  ok("OPEN: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── DIGITS: «0:55» и время в плеере — ровные цифры по середине рамки ───────────────────────────────────────────
// чернила цифр (светлые точки) в снимке ×4: поля сверху и снизу, слева и справа (в CSS-пикселях)
const ink = (buf, thr) => { const a = png(buf); let t = 1e9, b = -1, l = 1e9, r = -1; const row = a.w * a.bpp;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) { const i = y * row + x * a.bpp, v = (a.px[i] * 0.3 + a.px[i + 1] * 0.59 + a.px[i + 2] * 0.11); if (v > thr) { t = Math.min(t, y); b = Math.max(b, y); l = Math.min(l, x); r = Math.max(r, x); } }
  return { top: t / 4, bottom: (a.h - 1 - b) / 4, left: l / 4, right: (a.w - 1 - r) / 4, h: a.h / 4, w: a.w / 4 }; };
await run(["DIGITS"], async () => {
  const { ctx, page, errs } = await open({ seen: allText(), dsf: 4 });
  await lesson(page, "spg-0-1", 1500);
  const f = await page.evaluate(() => { const d = document.querySelector("[data-intro-dur]"), cs = getComputedStyle(d), r = d.getBoundingClientRect();
    return { ff: cs.fontFamily, fw: cs.fontWeight, fvn: cs.fontVariantNumeric, text: d.textContent, loaded: document.fonts.check("700 13px Piazzolla"), box: [r.left, r.top, r.width, r.height] }; });
  ok("DIGITS: длительность на обложке — Piazzolla, ровные цифры одной ширины", /^"?Piazzolla/.test(f.ff) && f.fw === "700" && /lining-nums/.test(f.fvn) && /tabular-nums/.test(f.fvn) && f.loaded && f.text === "0:55", f);
  // внутри рамки — без кромки (1 px) и тёмного фона: светлее 170 только цифры
  const shotPill = await page.screenshot({ clip: { x: f.box[0] + 1.5, y: f.box[1] + 1.5, width: f.box[2] - 3, height: f.box[3] - 3 } });
  const p = ink(shotPill, 170);
  ok("DIGITS: «0:55» по середине рамки — сверху и снизу поровну (±0,75 px)", Math.abs(p.top - p.bottom) <= 0.75, p);
  ok("DIGITS: «0:55» по середине рамки — слева и справа поровну (±0,75 px)", Math.abs(p.left - p.right) <= 0.75, p);
  writeFileSync(OUT + "/digits-pill.png", shotPill);
  await page.locator("[data-intro-cover]").first().tap();
  await waitState(page, "playing");
  await page.evaluate(() => { const v = document.querySelector("video[data-intro-el]"); v.pause(); v.currentTime = 31; });
  await page.waitForTimeout(800);
  const c = await page.evaluate(() => { const g = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }; const cs = getComputedStyle(document.querySelector("[data-intro-now]"));
    return { cap: g("[data-intro-controls]"), now: g("[data-intro-now]"), left: g("[data-intro-left]"), ff: cs.fontFamily, fvn: cs.fontVariantNumeric, t: [document.querySelector("[data-intro-now]").textContent, document.querySelector("[data-intro-left]").textContent] }; });
  ok("DIGITS: время в плеере — Piazzolla, цифры одной ширины", /^"?Piazzolla/.test(c.ff) && /tabular-nums/.test(c.fvn), c);
  const mids = [];
  for (const k of ["now", "left"]) {
    const s = await page.screenshot({ clip: { x: c[k][0], y: c.cap[1] + 3, width: c[k][2], height: c.cap[3] - 6 } });
    const q = ink(s, 150);
    mids.push({ k, off: +(((q.top + (q.h - q.bottom)) / 2) - q.h / 2).toFixed(2), q });
  }
  ok("DIGITS: «" + c.t.join("» и «") + "» — по середине капсулы (±0,75 px)", mids.every((m) => Math.abs(m.off) <= 0.75), mids);
  ok("DIGITS: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

// ── WARM: ролик заранее ──────────────────────────────────────────────────────────────────────────────────────
const S01 = INTRO_VIDEOS["s0-1"];
const KEY01 = "intro-seasonal.mp4?rev=" + S01.rev;
const fulls = (since = 0, name = "intro-seasonal.mp4") => NET.filter((x) => x.p === name && !x.range && x.t >= since).length;
const anyMp4 = (since) => NET.filter((x) => x.t >= since).length;
await run(["WARM"], async () => {
  // новичок на главной: первый урок — с видео-знакомством
  let o = await newbie();
  const home = await waitFor(o.page, () => o.page.evaluate(() => { const c = document.querySelector("[data-now-card]"); return c ? c.innerText.replace(/\s+/g, " ") : null; }), 8000);
  ok("WARM: у новичка на главной — первый урок «Первый день: нормально бояться»", /нормально бояться/.test(home || ""), home);
  const got = await waitFor(o.page, async () => fulls(o.t0) > 0 && (await cacheKeys(o.page)).includes(KEY01), 9000);
  ok("WARM: пока он на главной — ролик скачан один раз целиком и лежит в телефоне (адрес с rev)", !!got && fulls(o.t0) === 1 && NET.filter((x) => x.range).length === 0, { net: NET.slice(0, 4), keys: await cacheKeys(o.page) });
  // «Начать» — урок первым экраном, ролик из памяти
  const t1 = Date.now();
  // в первый день карточка — сам урок; если в карточке «сейчас» (смена) — урок строкой «Дальше»
  if (await o.page.$("[data-now-card] [data-now-next]")) await o.page.locator("[data-now-card] [data-now-next]").first().click();
  else await o.page.locator("[data-now-card]").first().click();
  const p = await waitState(o.page, "playing", 6000);
  const dt = Date.now() - t1;
  ok("WARM: «Начать» — ролик первым экраном из памяти телефона (blob:)", !!p && p.mode === "title" && p.from === "warm" && /^blob:/.test(p.src) && /intro-seasonal\.mp4$/.test(p.file), p);
  ok("WARM: пошёл сразу — " + dt + " мс от касания", dt < 2500, dt);
  await o.page.waitForTimeout(1800);
  ok("WARM: пока идёт — ни одного запроса ролика в сеть", anyMp4(t1) === 0, NET.filter((x) => x.t >= t1));
  ok("WARM: без ошибок страницы", o.errs.length === 0, o.errs);
  // перезапуск: тот же телефон — ролик берётся из телефона, сеть не нужна
  await o.page.evaluate(() => localStorage.removeItem("sa_intro_seen_Ксения_Миронова"));
  const t2 = Date.now();
  await o.page.reload({ waitUntil: "load" });
  await o.page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => {});
  await o.page.waitForTimeout(3000);
  await lesson(o.page, "s0-1", 300);
  const p2 = await waitState(o.page, "playing", 6000);
  ok("WARM: после перезапуска — ролик из телефона, без сети", !!p2 && p2.from === "warm" && anyMp4(t2) === 0, { p2, net: NET.filter((x) => x.t >= t2) });
  await o.ctx.close();

  // досмотрен (или выбран текст) — не берём
  o = await newbie({ seen: { "s0-1": "text" } });
  await o.page.waitForTimeout(4000);
  ok("WARM: ролик уже досмотрен — заранее не качаем", fulls(o.t0) === 0, NET.slice(0, 3));
  await o.ctx.close();

  // экономия трафика (Android: Save-Data) — не берём; урок — из сети, как раньше
  o = await newbie({ init: () => { try { Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }); } catch (e) { /* */ } } });
  await o.page.waitForTimeout(4000);
  ok("WARM: экономия трафика — заранее не качаем", fulls(o.t0) === 0, NET.slice(0, 3));
  await lesson(o.page, "s0-1", 300);
  const p3 = await waitState(o.page, "playing", 8000);
  ok("WARM: экономия трафика — ролик идёт из сети, как раньше", !!p3 && p3.from === "net" && /intro-seasonal\.mp4$/.test(p3.src), p3);
  await o.ctx.close();

  // открыл раньше, чем скачалось, — из сети, заготовку бросаем (не качаем дважды)
  o = await newbie({ slow: 6000 });
  const aborted = [];
  o.page.on("requestfailed", (r) => { if (/\.mp4/.test(r.url())) aborted.push(r.failure() ? r.failure().errorText : "?"); });
  const started = await waitFor(o.page, async () => fulls(o.t0) > 0, 6000);
  await lesson(o.page, "s0-1", 300);
  const p4 = await waitState(o.page, "playing", 8000);
  await o.page.waitForTimeout(600);
  ok("WARM: открыл раньше, чем скачалось, — ролик из сети, без ожидания заготовки", !!started && !!p4 && p4.from === "net" && /intro-seasonal\.mp4$/.test(p4.src), { started, p4 });
  ok("WARM: недокачанную заготовку бросили — дважды не качаем", aborted.length >= 1 && (await cacheKeys(o.page)).length === 0, { aborted, keys: await cacheKeys(o.page) });
  SLOW = 0;
  await o.ctx.close();

  // заготовка испорчена (в телефоне не ролик) — плеер сам переходит на сеть, испорченное стирает
  o = await newbie({ broken: true });
  await o.page.waitForTimeout(2500);
  await lesson(o.page, "s0-1", 300);
  const p5 = await waitState(o.page, "playing", 10000);
  ok("WARM: заготовка испорчена — плеер сам перешёл на сеть и играет", !!p5 && p5.from === "net" && /intro-seasonal\.mp4$/.test(p5.src) && p5.state === "playing", p5);
  const k5 = await waitFor(o.page, async () => !(await cacheKeys(o.page)).includes(KEY01), 3000);
  ok("WARM: испорченную копию из телефона стёрли", !!k5, await cacheKeys(o.page));
  ok("WARM: без ошибок страницы (испорчена)", o.errs.length === 0, o.errs);
  await o.ctx.close();

  // обложка в уроке: вернулся на первую карточку, ролик ещё не смотрел — берём, касание — из памяти
  const a = await open({ pos: { "spg-0-1": 1 } });
  await lesson(a.page, "spg-0-1", 900);
  await a.page.locator("[aria-label='Предыдущая карточка']").first().click().catch(() => {});
  const t6 = Date.now();
  const got6 = await waitFor(a.page, async () => fulls(t6, "intro-spg.mp4") > 0 && (await cacheKeys(a.page)).includes("intro-spg.mp4?rev=" + INTRO_VIDEOS["spg-0-1"].rev), 7000);
  ok("WARM: обложка в уроке — ролик берём заранее", !!got6, NET.filter((x) => x.t >= t6));
  await a.page.locator("[data-intro-cover]").first().tap();
  const p6 = await waitState(a.page, "playing", 6000);
  ok("WARM: касание обложки — ролик из памяти", !!p6 && p6.mode === "view" && p6.from === "warm", p6);
  ok("WARM: без ошибок страницы (обложка)", a.errs.length === 0, a.errs);
  await a.ctx.close();
});

// ── SHOTS: для владельца ─────────────────────────────────────────────────────────────────────────────────────
await run(["SHOTS"], async () => {
  const { ctx, page, errs } = await open({ seen: allText(), dsf: 3 });
  const clean = async () => { await page.addStyleTag({ content: "#demo-strip,#demo-tgchat,#demo-push{display:none!important}" }); await page.evaluate(() => document.documentElement.style.setProperty("--sa-st", "54px")); };
  await lesson(page, "spg-0-1", 1500);
  await clean();
  const r = await page.evaluate(() => { const c = document.querySelector("[data-intro-cover]").getBoundingClientRect(); return [c.left, c.top, c.width, c.height]; });
  await page.screenshot({ path: OUT + "/owner-cover.png", clip: { x: r[0], y: r[1], width: r[2], height: r[3] } });
  await page.locator("[data-intro-cover]").first().tap();
  await waitState(page, "playing");
  await page.evaluate(() => { const v = document.querySelector("video[data-intro-el]"); v.currentTime = 12.2; v.pause(); });
  await page.waitForTimeout(700);
  await clean();
  await page.screenshot({ path: OUT + "/owner-player.png" });
  ok("SHOTS: снимки сделаны", true);
  ok("SHOTS: без ошибок страницы", errs.length === 0, errs);
  await ctx.close();
});

console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
