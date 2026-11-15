// e2e v164 (Доп. 489): фото раздела в билете «Начать» — и в «Для чтения»; фото в билете без CSS filter.
// Сайт — демо целиком (tools/claude/demo-app/build.mjs). Билет о треке в демо у Романа (владелец, смен нет); обложка его
// раздела — фото урока s0-1. Голова сценария (сервер, флаги в sessionStorage, хроника слоёв, запуск заново) — как в
// e2e-v163.mjs: __e2e_slow = "700,1800" — задержка ответов с превью и целым фото; __e2e_no51 — сервер без этапа 51.
// Разделы:
//   LIGHT  — «Для чтения»: бумажный билет с фото в правой части (440, 393, 320 px), слева фото тает в бумагу, поверх
//            бумажная вуаль, под кнопкой вуаль плотнее; название и «Начать» читаются (яркость точек снимка экрана);
//            нажатие открывает урок; вид «Как сейчас» — сургучная печать на фото; билет о смене и сервер без этапа 51 —
//            без фото;
//   LATE   — «Для чтения», медленная сеть: билет сначала прежний, фото проявляется, тон и вуаль приходят вместе с ним;
//   DARK   — тёмная тема: у фото и всего билета нет CSS filter (v69: на iPhone под маской он мигал), поверх фото тёмный
//            тон; на вид билет тот же, что в v163 (яркость фото в прежних пределах);
//   SHEET  — лист «Фото раздела»: подсказка про билет без оговорки о «Для чтения».
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v164.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5640, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v164";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 1200) : "")); } };
const browser = await chromium.launch();
const REST = "Два моря, Океан";

// ── то, что ставится в страницу до её кода: флаги сценария и хроника ─────────────────────────────────────────
function inPage() {
  const flag = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const slow = (flag("__e2e_slow") || "").split(",").map(Number);
  window.__lp = { thumb: 0, full: 0, list: 0 };
  // запросы за фото: считаем и, если просили, задерживаем (демо отвечает сразу, а в зале сеть бывает медленной)
  let cur = window.fetch;
  const wrap = (f) => function (input, init) {
    const u = typeof input === "string" ? input : (input && input.url) || "";
    const m = /\/rpc\/(lesson_photos?)(\?|$)/.exec(u);
    if (!m) return f.apply(this, arguments);
    if (m[1] === "lesson_photos") { window.__lp.list++; return f.apply(this, arguments); }
    let full = false; try { full = !!JSON.parse((init && init.body) || "{}").p_full; } catch (e) { /* */ }
    window.__lp[full ? "full" : "thumb"]++;
    const ms = full ? slow[1] : slow[0];
    if (!ms) return f.apply(this, arguments);
    return new Promise((res, rej) => setTimeout(() => { f.call(window, input, init).then(res, rej); }, ms));
  };
  try { Object.defineProperty(window, "fetch", { configurable: true, get() { return cur; }, set(v) { cur = wrap(v); } }); } catch (e) { /* */ }
  // сервер демо: без этапа 51 или без запомненного трека
  if (flag("__e2e_no51") || flag("__e2e_auto")) {
    let demo;
    try { Object.defineProperty(window, "__demo", { configurable: true, get() { return demo; }, set(v) { demo = v;
      const rpc = v.srv.rpc;
      v.srv.rpc = function (fn, b) {
        if (flag("__e2e_no51") && /^lesson_photo/.test(fn)) return { code: "PGRST202", message: "Could not find the function" };
        const r = rpc.apply(this, arguments);
        if (flag("__e2e_auto") && fn === "my_state" && r && r.ok) return { ...r, last_role: null };
        return r;
      }; } }); } catch (e) { /* */ }
  }
  if (flag("__e2e_lean")) { try { Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }); } catch (e) { /* */ } }
  // хроника: слои фото по местам, заставка, подложки, мерцающие заглушки на месте фото
  window.__log = []; const t0 = performance.now();
  const layers = (root, sel) => [...root.querySelectorAll(sel)].map((i) => [i.getAttribute("data-photo-layer") || "img", Math.round(Number(getComputedStyle(i).opacity) * 100) / 100, i.naturalWidth || 0, i.hasAttribute("data-ref-under") ? 1 : 0]);
  setInterval(() => {
    const d = document;
    const refs = {}; d.querySelectorAll("[data-ref-card]").forEach((c) => { refs[c.getAttribute("data-ref-card")] = { cover: c.getAttribute("data-ref-cover"), l: layers(c, "img") }; });
    const row = { splash: !!d.getElementById("sa-splash"), home: !!d.querySelector("[data-now-card]"),
      now: d.querySelector("[data-now-cover]") ? layers(d, "[data-now-cover] img") : null, scrim: d.querySelectorAll("[data-now-scrim]").length, tone: d.querySelectorAll("[data-now-tone]").length,
      mod: d.querySelector(".tbp-cur .tbm-cover") ? layers(d, ".tbp-cur .tbm-cover img") : null,
      side: [...d.querySelectorAll(".tbm-cover")].filter((c) => !c.closest(".tbp-cur")).map((c) => layers(c, "img")),
      refs, tiles: [...d.querySelectorAll("[data-ref-tile=own]")].map((c) => layers(c, "img")), lp: d.querySelector("[data-lp-cover]") ? layers(d, "[data-lp-cover] img") : null,
      wait: d.querySelectorAll("[data-photo-wait]").length, skel: d.querySelectorAll(".tbm-cover .sa-skel, [data-lp-cover] .sa-skel, [data-ref-tile] .sa-skel, [data-ref-card] .sa-skel, [data-now-card] .sa-skel").length };
    const s = JSON.stringify(row), L = window.__log;
    if (!L.length || L[L.length - 1].s !== s) L.push({ t: Math.round(performance.now() - t0), s });
  }, 30);
}
const takeLog = async (page) => (await page.evaluate(() => { const L = window.__log; window.__log = []; return L; })).map((x) => ({ t: x.t, ...JSON.parse(x.s) }));
const lpCalls = (page) => page.evaluate(() => ({ ...window.__lp }));
// слой впервые виден «в пути» (wait или in) и до полной непрозрачности прошёл через промежуточную — значит проявился
// pick(row) → список слоёв места. Ответ: { seen, late, soft, popped, base }:
//   seen — фото было; late — хоть один слой пришёл позже первого кадра места; soft — такой слой был виден полупрозрачным;
//   popped — слой, пришедший позже, сразу встал непрозрачным; base — пока верхний проявлялся, нижний оставался на месте
function fadeOf(log, pick) {
  let seen = false, late = false, soft = false, popped = false, base = true, max = 0;
  const first = new Map();   // «ширина:порядок» → первый увиденный вид
  for (const row of log) {
    const ls = pick(row); if (!ls) continue;
    max = Math.max(max, ls.length);
    ls.forEach((l, i) => {
      if (l[2] > 0 || l[0] !== "img") seen = true;
      const key = l[2] + ":" + l[3];
      if (!first.has(key)) { first.set(key, l[0]); if (l[0] !== "set") late = true; if (l[0] === "in" && l[1] > 0.9) popped = true; }
      if (l[0] === "in" && l[1] > 0.04 && l[1] < 0.96) soft = true;
      if (i === 0 && ls.length > 1 && l[1] < 0.9 && l[0] === "set") base = false;
    });
  }
  return { seen, late, soft, popped, base, max };
}
const allSet = (log, pick) => { let n = 0, bad = null; for (const row of log) { const ls = pick(row); if (!ls) continue; if (!ls.length) { bad = bad || { t: row.t, why: "пусто" }; continue; } n++; for (const l of ls) if (l[0] !== "set" || l[1] < 0.9) bad = bad || { t: row.t, l }; } return { n, bad }; };

async function ready(page, errs) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.evaluate(() => { if (window.__e2eTidy) return; window.__e2eTidy = setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    document.querySelectorAll("[data-badge-new] [data-lens-x], [data-shelf-new] button[aria-label='Закрыть']").forEach((x) => x.click());
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" }).catch(() => {});
}
// flags — флаги сценария (sessionStorage); wait — сколько подождать после заставки; phone: "new" — фото на телефоне нет
async function open({ who = "roman", light = false, width = 390, height = 844, hour = 12, minute = 30, flags = {}, wait = 1300, reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka", reducedMotion: reduce ? "reduce" : "no-preference" });
  await ctx.addInitScript(inPage);
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate(([w, h, m, fl]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__demo_who", w);
    const real = performance.timeOrigin + performance.now(); const d = new Date();
    localStorage.setItem("__demo_t", JSON.stringify({ off: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0).getTime() - real, at: real }));
    for (const k of Object.keys(fl)) sessionStorage.setItem(k, fl[k]); }, [who, hour, minute, flags]);
  await page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase("sa_photos"); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
  await page.goto(URL0, { waitUntil: "load" });
  await ready(page, errs); await page.waitForTimeout(wait);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
// приложение закрыли и открыли на том же телефоне: память пуста, телефон (IndexedDB, localStorage) прежний
const relaunch = async (page, errs, { flags = null, wait = 0 } = {}) => {
  if (flags) await page.evaluate((fl) => { for (const k of Object.keys(fl)) { if (fl[k] === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, fl[k]); } }, flags);
  await page.goto(URL0, { waitUntil: "commit" });
  await page.waitForFunction(() => !document.getElementById("sa-splash") && (!!document.querySelector("[data-now-card]") || !!document.querySelector("[data-home-logo]")), null, { timeout: 25000 }).catch(() => errs.push("главная не открылась"));
  await ready(page, errs); if (wait) await page.waitForTimeout(wait);
};
// фото «с нуля»: забыть то, что лежит на телефоне (и номера первых фото), память приложения очистит перезапуск
const wipePhone = (page) => page.evaluate(() => new Promise((r) => { for (const k of Object.keys(localStorage)) if (/^sa_lesson_photos_hot_v1/.test(k)) localStorage.removeItem(k);
  const q = indexedDB.deleteDatabase("sa_photos"); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
const nav = async (page, s, ms = 1800) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms); };
const top = (page) => page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); });
const overflowX = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
const shot = (page, name) => page.screenshot({ path: join(OUT, name + ".png") });
const waitFor = async (page, fn, ms = 9000, arg) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (e) { return false; } };
// обложки, которых в демо нет: ставим запросом к серверу в странице (от имени вошедшего; у владельца — для всей сети)
const seedCovers = (page, pairs) => page.evaluate((ps) => { const d = window.__demo, tok = localStorage.getItem("sa_session_token"), out = {};
  for (const [id, from] of ps) { const f = d.srv.rpc("lesson_photo", { p_token: tok, p_lesson: from, p_full: true }), t = d.srv.rpc("lesson_photo", { p_token: tok, p_lesson: from, p_full: false });
    out[id] = !!(f && f.ok && t && t.ok) && d.srv.rpc("lesson_photo_set", { p_token: tok, p_lesson: id, p_scope: "", p_full: f.data, p_thumb: t.data, p_w: f.w, p_h: f.h }).ok === true; }
  d.save(); return out; }, pairs);
const COVERS = [["ref:coffee", "s3-1"], ["ref:serving", "s0-1"], ["mod:s1", "c4-3"], ["srv-basics", "s3-1"]];
// Роман с обложками сценария: фото на телефоне ещё нет
async function roman(o = {}) {
  const r = await open({ who: "roman", ...o, flags: {}, light: false, wait: 600 });
  const done = await seedCovers(r.page, COVERS);
  if (!Object.values(done).every(Boolean)) r.errs.push("обложки не встали: " + JSON.stringify(done));
  await wipePhone(r.page);
  await relaunch(r.page, r.errs, { flags: o.flags || {}, wait: o.wait === undefined ? 1300 : o.wait });
  if (o.light) { await r.page.getByText("Для чтения").first().click().catch(() => r.errs.push("нет «Для чтения»")); await r.page.waitForTimeout(1200); }
  return r;
}
const ticket = (page) => page.evaluate(() => { const c = document.querySelector("[data-now-card]"); if (!c) return null; const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const cov = c.querySelector("[data-now-cover]"), img = cov && cov.querySelector("img"), cs = cov ? getComputedStyle(cov) : null, stub = c.querySelector("[data-now-stub]"), cta = c.querySelector("[data-now-cta]"), ttl = c.querySelector("[data-now-title]");
  const inner = cov ? cov.parentElement : c;
  return { mode: c.getAttribute("data-now-card"), hero: c.getAttribute("data-hero"), card: R(inner), cover: cov ? cov.getAttribute("data-now-cover") : null, cov: R(cov), img: img ? { st: img.getAttribute("data-photo-layer"), nw: img.naturalWidth, fit: getComputedStyle(img).objectFit, r: R(img) } : null,
    layers: cov ? cov.querySelectorAll("img").length : 0, mask: cs ? (cs.webkitMaskImage || cs.maskImage || "") : "", filter: cs ? cs.filter : "", op: cs ? cs.opacity : "", pe: cs ? cs.pointerEvents : "",
    tone: (() => { const t = c.querySelector("[data-now-tone]"); return t ? getComputedStyle(t).backgroundColor : ""; })(), scrimBg: (() => { const s = c.querySelector("[data-now-scrim]"); return s ? getComputedStyle(s).backgroundImage : ""; })(),
    imgFilter: img ? getComputedStyle(img).filter : "", filters: [...c.querySelectorAll("*")].filter((el) => getComputedStyle(el).filter !== "none").map((el) => el.tagName + (el.getAttribute("data-now-cover") !== null ? "[cover]" : "")),
    seal: stub ? (stub.querySelector("svg path[fill^='url(#nhw']") ? "wax" : stub.querySelector("span[style*='border-radius: 50%']") ? "lens" : "") : "", ink: ttl ? getComputedStyle(ttl).color : "",
    scrim: c.querySelectorAll("[data-now-scrim]").length, stub: R(stub), cta: cta ? cta.textContent.trim() : "", ctaR: R(cta), title: ttl ? ttl.textContent.trim() : "", titleR: R(ttl), shadow: stub ? getComputedStyle(stub).textShadow : "" }; });

// яркость точек снимка: средняя и самая тёмная в прямоугольнике (доли ширины и высоты билета)
const lumOf = async (page, boxes) => {
  const r = await page.evaluate(() => { const c = document.querySelector("[data-now-cover]") ? document.querySelector("[data-now-cover]").parentElement : document.querySelector("[data-now-card]"); const b = c.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  const png = await page.screenshot({ clip: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h) } });
  return page.evaluate(async ([b64, bs]) => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode(); const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
    const out = {}; for (const [name, x0, y0, x1, y1] of bs) { const d = g.getImageData(Math.round(im.width * x0), Math.round(im.height * y0), Math.max(1, Math.round(im.width * (x1 - x0))), Math.max(1, Math.round(im.height * (y1 - y0)))).data;
      let s = 0, mn = 255, n = 0; for (let i = 0; i < d.length; i += 4) { const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += L; if (L < mn) mn = L; n++; } out[name] = { mean: Math.round(s / n), min: Math.round(mn) }; } return out; }, [png.toString("base64"), boxes]);
};
// где на билете название и слово на кнопке (в долях билета)
const boxesOf = (t) => { const f = (r) => [(r.l - t.card.l) / t.card.w, (r.t - t.card.t) / t.card.h, (r.r - t.card.l) / t.card.w, (r.b - t.card.t) / t.card.h];
  return [["title", ...f(t.titleR)], ["cta", ...f(t.ctaR)], ["left", 0.04, 0.1, 0.4, 0.9], ["photo", 0.8, 0.08, 0.97, 0.3]]; };

// ════════ LIGHT ════════
if (want("LIGHT")) {
  for (const [width, height] of [[440, 956], [393, 852], [320, 640]]) {
    const { ctx, page, errs } = await roman({ width, height, wait: 2600, light: true }); await top(page);
    const t = await ticket(page);
    ok(`LIGHT ${width}: в «Для чтения» билет бумажный и с фото раздела`, !!t && t.mode === "track" && t.hero === "paper" && t.cover === "lesson" && !!t.img && t.img.nw >= 590 && t.layers === 1, t && [t.hero, t.cover, t.img, t.layers]);
    if (t && t.img) {
      ok(`LIGHT ${width}: фото — правая часть билета (47%), от верха до низа, в его пределах`, Math.abs(t.cov.w - t.card.w * 0.47) < 1.5 && Math.abs(t.cov.r - t.card.r) < 1 && Math.abs(t.cov.t - t.card.t) < 1 && Math.abs(t.cov.b - t.card.b) < 1 && t.img.fit === "cover", [t.cov, t.card]);
      ok(`LIGHT ${width}: слева фото тает в бумагу (маска), поверх бумажная вуаль, под кнопкой вуаль плотнее; CSS filter нет`, /linear-gradient/.test(t.mask) && t.tone === "rgba(255, 249, 236, 0.34)" && t.scrim === 1 && /rgba\(255, 251, 240, 0\.86\)/.test(t.scrimBg) && t.filter === "none" && t.imgFilter === "none" && t.filters.length === 0 && t.pe === "none", [t.mask.slice(0, 50), t.tone, t.scrimBg.slice(0, 80), t.filter, t.filters]);
      ok(`LIGHT ${width}: название — тёмными чернилами, слово на кнопке со светлым ореолом`, t.ink === "rgb(42, 31, 14)" && /rgba\(255, 252, 244/.test(t.shadow) && /^(Начать|Дальше)$/.test(t.cta) && t.seal === "lens", [t.ink, t.shadow, t.cta, t.seal]);
      const L = await lumOf(page, boxesOf(t));
      // под названием — бумага (светло), буквы на ней тёмные; под словом на кнопке тоже светло, слово тёмное; фото на бумаге
      // бледное (в демо снимок светлый: в среднем как бумага), но есть: в его углу видны места темнее чистой бумаги
      ok(`LIGHT ${width}: название читается — под ним светлая бумага, буквы тёмные`, L.title.mean >= 185 && L.title.min <= 80 && L.left.mean >= 205, L);
      ok(`LIGHT ${width}: слово на кнопке читается — под ним светло (вуаль), буквы тёмные`, L.cta.mean >= 150 && L.cta.min <= 110, L.cta);
      ok(`LIGHT ${width}: фото видно, но не спорит с бумагой — бледное: есть места темнее бумаги, но не чернильные`, L.photo.mean >= 120 && L.photo.min <= 205 && L.photo.min >= 60, [L.photo, L.left]);
      ok(`LIGHT ${width}: вбок ничего не вылезло`, (await overflowX(page)) <= 0);
    }
    await shot(page, "light-" + width);
    if (width === 440) {
      await page.locator("[data-now-card]").click(); await page.waitForTimeout(2200);
      ok("LIGHT 440: нажатие по билету с фото открывает урок", !(await page.locator("[data-now-card]").count()));
    }
    ok(`LIGHT ${width}: без ошибок страницы`, !errs.length, errs.join(" | "));
    await ctx.close();
  }
  // вид «Как сейчас»: вместо линзы сургучная печать
  { const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 600 });
    await page.evaluate(() => localStorage.setItem("sa_home_look", "now"));
    await relaunch(page, errs, { wait: 2400 });
    await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1500); await top(page);
    const t = await ticket(page);
    ok("LIGHT «Как сейчас»: бумажный билет с фото, на фото сургучная печать и слово кнопки", !!t && t.hero === "paper" && !!t.img && t.img.nw > 0 && t.seal === "wax" && /^(Начать|Дальше)$/.test(t.cta) && t.scrim === 1, t && [t.hero, t.img, t.seal, t.cta]);
    if (t && t.img) { const L = await lumOf(page, boxesOf(t)); ok("LIGHT «Как сейчас»: название и слово на кнопке читаются", L.title.mean >= 185 && L.title.min <= 80 && L.cta.mean >= 150 && L.cta.min <= 110, L); }
    await shot(page, "light-now-look");
    ok("LIGHT «Как сейчас»: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  // билет о смене — без фото
  { const { ctx, page, errs } = await open({ who: "maria", width: 393, height: 852, hour: 12, wait: 2200, light: true }); await top(page);
    const t = await ticket(page);
    if (t && t.mode !== "track") ok("LIGHT смена: бумажный билет о смене («" + t.title + "») — без фото", t.hero === "paper" && t.cover === null && t.scrim === 0 && t.shadow === "none", [t.mode, t.cover]);
    else ok("LIGHT смена: сегодня у Марии билет о треке — фото допустимо (билет о смене проверяется в рабочий день)", !!t, t && t.mode);
    ok("LIGHT смена: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  // сервер без этапа 51
  { const { ctx, page, errs } = await open({ who: "roman", width: 393, height: 852, flags: { __e2e_no51: "1" }, wait: 2400, light: true }); await top(page);
    const t = await ticket(page);
    ok("LIGHT без этапа 51: бумажный билет прежний — без фото, вуали и ореола", !!t && t.hero === "paper" && t.cover === null && t.scrim === 0 && t.tone === "" && t.shadow === "none", t && [t.cover, t.scrim, t.tone, t.shadow]);
    ok("LIGHT без этапа 51: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
}

// ════════ LATE: «Для чтения», сеть медленная ════════
if (want("LATE")) {
  const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 0, light: true, flags: { __e2e_slow: "900,1900" } });
  // «Для чтения» включается касанием уже после запуска — запускаем заново в светлой теме, с пустым телефоном
  await wipePhone(page);
  await relaunch(page, errs, { wait: 0 });
  const t0 = await ticket(page);
  ok("LATE: сразу после заставки бумажный билет прежний — фото ещё едет: ни картинки, ни вуали, ни ореола", !!t0 && t0.hero === "paper" && t0.cover === "lesson" && t0.layers === 0 && t0.scrim === 0 && t0.tone === "" && t0.shadow === "none", t0 && [t0.hero, t0.cover, t0.layers, t0.scrim, t0.tone, t0.shadow]);
  await shot(page, "late-0");
  const got = await waitFor(page, () => { const i = document.querySelectorAll("[data-now-cover] img"); return i.length === 1 && i[0].getAttribute("data-photo-layer") === "set" && i[0].naturalWidth >= 590; }, 10000);
  const log = await takeLog(page);
  const f = fadeOf(log, (r) => r.now);
  ok("LATE: фото на бумажном билете проявилось, а не встало разом; целое — поверх превью", got && f.seen && f.late && f.soft && !f.popped && f.max === 2 && f.base, f);
  const iPhoto = log.findIndex((r) => r.now && r.now.length > 0), iTone = log.findIndex((r) => r.tone === 1), iScrim = log.findIndex((r) => r.scrim === 1);
  ok("LATE: бумажная вуаль поверх фото и под кнопкой пришли вместе с фото, не раньше", iPhoto >= 0 && iTone >= iPhoto && iScrim >= iPhoto && log.slice(0, iPhoto).every((r) => r.tone === 0 && r.scrim === 0), [iPhoto, iTone, iScrim]);
  const anim = await page.evaluate(() => { const t = document.querySelector("[data-now-tone]"), s = document.querySelector("[data-now-scrim]"); return [t && t.className, s && s.className]; });
  ok("LATE: вуаль появлялась плавно (класс проявления у тона и у вуали)", anim[0] === "sa-fadein" && anim[1] === "sa-fadein", anim);
  await shot(page, "late-1");
  ok("LATE: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ════════ DARK ════════
if (want("DARK")) {
  const { ctx, page, errs } = await roman({ width: 440, height: 956, wait: 2600 }); await top(page);
  const t = await ticket(page);
  ok("DARK: тёмный билет с фото раздела, как в v163", !!t && t.hero === "black" && t.cover === "lesson" && !!t.img && t.img.nw >= 590 && t.scrim === 1, t && [t.hero, t.cover, t.img]);
  if (t && t.img) {
    ok("DARK: у фото и во всём билете нет CSS filter; прозрачность фото задаёт только маска", t.filter === "none" && t.imgFilter === "none" && t.filters.length === 0 && t.op === "1" && /linear-gradient/.test(t.mask), [t.filter, t.imgFilter, t.filters, t.op]);
    ok("DARK: фото приглушает тёмный тон поверх него", t.tone === "rgba(26, 18, 7, 0.42)" && /rgba\(16, 12, 5, 0\.7\)/.test(t.scrimBg) && t.shadow !== "none", [t.tone, t.scrimBg.slice(0, 90), t.shadow]);
    const L = await lumOf(page, [["photo", 0.64, 0.12, 0.93, 0.88], ["left", 0.04, 0.1, 0.4, 0.9], ...boxesOf(t).slice(0, 2)]);
    // в v163 (с filter) средняя яркость этой части фото в демо была 80; без filter — 79
    ok("DARK: на вид фото то же, что в v163: приглушено (яркость в прежних пределах), слева билет тёмный", L.photo.mean >= 62 && L.photo.mean <= 98 && L.left.mean <= 70, L);
    ok("DARK: название и слово на кнопке светлые на тёмном", L.title.mean <= 110 && L.cta.mean <= 150, [L.title, L.cta]);
  }
  await shot(page, "dark-440");
  ok("DARK: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ════════ SHEET ════════
if (want("SHEET")) {
  const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 2200, light: true });
  await nav(page, "home", 1600);
  await page.locator(".tbp-cur [data-cover-edit]").click(); await page.waitForTimeout(700);
  const also = await page.evaluate(() => { const a = document.querySelector("[data-lp-also]"); return a ? a.textContent.trim() : null; });
  ok("SHEET: лист «Фото раздела» — «Это же фото видно на главной, в билете «Начать»…», без оговорки о «Для чтения»", also === "Это же фото видно на главной, в билете «Начать», пока сотрудник проходит раздел.", also);
  await shot(page, "sheet-light");
  ok("SHEET: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log("\nитого: " + pass + " ✓, " + fail + " ✗");
process.exit(fail ? 1 : 0);
