// e2e v163 (Доп. 488): строка роли под приветствием, фото раздела в билете «Начать» и незаметная подгрузка фото разделов.
// Сайт — демо целиком (tools/claude/demo-app/build.mjs: сервер в странице, его состояние переживает перезагрузку).
// В демо фото стоят у уроков cms-l-cn-idea («Наш ресторан»), s0-1, s3-1 и c4-3; сценарий сам ставит обложки разделам
// «Справочника» («Кофе», «Сервировка»), разделу трека s1 и главе srv-basics — запросом к серверу в странице.
// Билет о треке в демо у Романа (владелец, смен нет); у Анны и Марии в рабочий день билет о смене.
// Что страница делает с фото, пишет «хроника» (каждые 30 мс: слои фото, их вид и прозрачность, заставка, запросы).
// Флаги сценария лежат в sessionStorage (демо при смене человека чистит localStorage):
//   __e2e_slow = "700,1800" — задержка ответов с превью и целым фото, мс; __e2e_no51 — сервер без этапа 51;
//   __e2e_auto — сервер не помнит трек (трек по должности); __e2e_lean — телефон просит экономить трафик.
// Разделы:
//   ROLE    — строка роли своей строкой во всю ширину: роль слева, «по должности · сменить» справа, в одну строку на 440,
//             393 и 320 px; подпись роли целиком или никак; «хорошей смены» справа; «Для чтения»;
//   TICKET  — билет «Начать» у Романа: фото раздела в правой половине, текст и кнопка поверх и читаются; нажатие
//             открывает урок; билет о смене — без фото; «Для чтения» — с v164 тоже с фото (e2e-v164.mjs); 320 px;
//   FIRST   — первый запуск на медленной сети: билет сначала прежний, фото проявляется (а не встаёт разом), целое —
//             поверх превью; раздел трека и «Справочник» сразу после запуска: подложка, проявление, никакого мерцания;
//   AHEAD   — человек постоял на главной: фото готовы; раздел трека, соседние страницы, «Справочник» и главы открываются
//             уже с фото (ни одного слоя «в пути»); номера первых фото запомнены;
//   AGAIN   — повторный запуск: ни одного запроса за фото, билет с фото уже в первом кадре после заставки; раздел и
//             «Справочник» сразу с целыми фото, даже если уйти с главной в первые полсекунды;
//   LOST    — телефон не сберёг фото: заранее второй раз ничего не качается (каждое фото заранее берётся один раз),
//             по показу фото приезжают, как раньше; идёт после AHEAD в том же окне;
//   LEAN    — экономия трафика: заранее идут только превью;
//   NO51    — сервер без этапа 51: билет, раздел и «Справочник» как раньше, ошибок нет;
//   EDIT    — руководитель меняет обложку раздела: новое фото проявляется поверх прежнего; лист говорит про билет;
//   LOOK    — «Для чтения», «меньше движения», 320 px: фото на месте, ничего не вылезает.
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v163.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5630, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v163";
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
      now: d.querySelector("[data-now-cover]") ? layers(d, "[data-now-cover] img") : null, scrim: d.querySelectorAll("[data-now-scrim]").length,
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
    scrim: c.querySelectorAll("[data-now-scrim]").length, stub: R(stub), cta: cta ? cta.textContent.trim() : "", ctaR: R(cta), title: ttl ? ttl.textContent.trim() : "", titleR: R(ttl), shadow: stub ? getComputedStyle(stub).textShadow : "" }; });

// ════════ ROLE ════════
if (want("ROLE")) {
  const line = (page) => page.evaluate(() => { const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: Math.round(r.left * 10) / 10, t: Math.round(r.top * 10) / 10, r: Math.round(r.right * 10) / 10, b: Math.round(r.bottom * 10) / 10, w: Math.round(r.width), h: Math.round(r.height) }; };
    const ln = document.querySelector("[data-role-line]"); if (!ln) return null;
    const main = ln.querySelector("[data-role-main]"), sub = ln.querySelector("[data-role-sub]"), auto = ln.querySelector("[data-role-auto]"), btn = ln.querySelector("[data-role-change]"), wish = document.querySelector("[data-shift-wish]");
    const name = main ? main.firstElementChild : null;
    const greet = ln.previousElementSibling, rest = greet ? greet.lastElementChild.firstElementChild : null;
    const mid = (r) => (r ? (r.t + r.b) / 2 : 0);
    const subR = R(sub), mainR = R(main);
    return { tag: ln.tagName, w: innerWidth, line: R(ln), greet: R(greet), rest: R(rest), restT: rest ? rest.textContent.trim() : "", main: mainR, name: R(name), nameT: name ? name.textContent.trim() : "", sub: subR, subT: sub ? sub.textContent.trim() : "",
      subIn: subR && mainR ? (subR.t >= mainR.b - 1 ? "скрыта" : (subR.r <= mainR.r + 0.5 && subR.b <= mainR.b + 1 ? "видна" : "обрезана")) : "нет",
      auto: R(auto), autoT: auto ? auto.textContent.replace(/\s+/g, " ").trim() : "", btn: R(btn), wish: R(wish), wishIn: wish ? !!wish.closest("[data-role-line]") : null, wishT: wish ? wish.textContent.trim() : "",
      mids: [mid(R(name)), mid(R(auto) || R(wish))], hit: btn ? (() => { const r = btn.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el === btn || btn.contains(el); })() : null,
      now: R(document.querySelector("[data-now-card]")), strip: R(document.querySelector("[data-day-chips]")) }; });
  // ── трек по должности: «по должности · сменить» справа, в одну строку ──
  for (const [width, height, tag] of [[440, 956, "440"], [393, 852, "393"], [320, 640, "320"]]) {
    const { ctx, page, errs } = await open({ who: "anna", width, height, hour: 12, flags: { __e2e_auto: "1" }, wait: 300 });
    // сервер трек не помнит, на телефоне его тоже нет — трек встаёт по должности
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^sa_last_role/.test(k)) localStorage.removeItem(k); });
    await relaunch(page, errs, { wait: 1500 }); await top(page);
    const g = await line(page);
    ok(`ROLE ${tag}: трек подставлен по должности — в строке роли «по должности · сменить»`, !!g && g.autoT === "по должности · сменить" && g.nameT === "Новичок", g && [g.autoT, g.nameT]);
    if (g) {
      ok(`ROLE ${tag}: строка роли — отдельной строкой под приветствием, во всю ширину (поля 20 px), до билета`, g.tag === "DIV" && g.line.t >= g.greet.b - 0.5 && Math.abs(g.line.w - g.greet.w) < 1 && Math.abs(g.main.l - g.line.l - 20) < 1 && Math.abs(g.line.r - g.auto.r - 20) < 1 && g.line.b <= (g.strip || g.now).t + 1, [g.line, g.greet, g.main.l, g.auto.r]);
      ok(`ROLE ${tag}: роль и «по должности · сменить» на одной строке, ничего не перенеслось`, Math.abs(g.mids[0] - g.mids[1]) <= 2.5 && g.auto.h <= 22 && g.name.h <= 18 && g.auto.l >= g.name.r + 8, [g.mids, g.auto, g.name]);
      ok(`ROLE ${tag}: «по должности · сменить» стоит под названием заведения (правые края совпадают)`, g.restT === REST && Math.abs(g.auto.r - g.rest.r) < 1.5 && g.auto.t > g.rest.t, [g.auto.r, g.rest]);
      ok(`ROLE ${tag}: подпись роли — целиком или никак (не обрезана и не уехала на вторую строку)`, g.subT === "Сезонный сотрудник" && (g.subIn === "видна" || g.subIn === "скрыта") && g.main.h === 16, [g.subIn, g.sub, g.main]);
      if (tag === "440") ok("ROLE 440: на широком телефоне подпись роли видна, между ней и «по должности» есть воздух", g.subIn === "видна" && g.auto.l - g.sub.r >= 10, [g.subIn, g.auto.l, g.sub && g.sub.r]);
      if (tag === "320") ok("ROLE 320: на узком подпись роли скрыта — место отдано роли и «сменить»", g.subIn === "скрыта", g.subIn);
      ok(`ROLE ${tag}: «сменить» нажимается (ничем не перекрыта)`, g.hit === true && g.btn.h >= 18, g.btn);
      ok(`ROLE ${tag}: вбок ничего не вылезло`, (await overflowX(page)) <= 0);
    }
    if (tag === "440") {
      await shot(page, "role-auto-440");
      await page.locator("[data-role-change]").click(); await page.waitForTimeout(900);
      const opened = await page.evaluate(() => ({ list: document.querySelectorAll("[data-track-row], [data-track-card], [data-tracks-list] > *").length, t: (document.body.innerText || "").replace(/\s+/g, " ") }));
      ok("ROLE 440: «сменить» по-прежнему открывает выбор трека", opened.list > 1 || /Хостес[\s\S]*Ядро[\s\S]*Менеджер/.test(opened.t), opened.list);
    }
    if (tag === "393") await shot(page, "role-auto-393");
    ok(`ROLE ${tag}: без ошибок страницы`, !errs.length, errs.join(" | "));
    await ctx.close();
  }
  // ── трек выбран самим: роль с подписью; «хорошей смены» в день смены — справа в строке роли ──
  { const { ctx, page, errs } = await open({ who: "anna", width: 393, height: 852, hour: 12 }); await top(page);
    const g = await line(page);
    ok("ROLE свой трек: «по должности» нет, роль с подписью «Сезонный сотрудник» видна целиком", !!g && !g.auto && g.nameT === "Новичок" && g.subIn === "видна", g && [g.autoT, g.subIn]);
    if (g && g.wish) ok("ROLE свой трек: в день смены «хорошей смены» — справа в строке роли, под заведением", g.wishIn === true && g.wishT === "хорошей смены" && Math.abs(g.wish.r - g.rest.r) < 1.5 && Math.abs(g.mids[0] - g.mids[1]) <= 2.5, [g.wish, g.rest, g.mids]);
    else ok("ROLE свой трек: сегодня у Анны выходной — пожелания нет (в день смены оно встаёт справа в строке роли)", !!g && !g.wish);
    await shot(page, "role-own-393");
    ok("ROLE свой трек: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  // ── «Для чтения» ──
  { const { ctx, page, errs } = await open({ who: "anna", width: 393, height: 852, hour: 12, light: true }); await top(page);
    const g = await line(page);
    ok("ROLE light: в «Для чтения» строка роли так же отдельной строкой, роль и подпись на месте", !!g && g.tag === "DIV" && g.line.t >= g.greet.b - 0.5 && g.nameT === "Новичок" && (g.subIn === "видна" || g.subIn === "скрыта"), g && [g.line, g.subIn]);
    await shot(page, "role-light-393");
    ok("ROLE light: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
}

// ════════ TICKET ════════
if (want("TICKET")) {
  { const { ctx, page, errs } = await roman({ width: 440, height: 956, wait: 2600 }); await top(page);
    const t = await ticket(page);
    ok("TICKET: у Романа билет зовёт в урок трека, на нём фото раздела (обложка — фото урока раздела)", !!t && t.mode === "track" && t.cover === "lesson" && !!t.img && t.img.nw > 0, t && [t.mode, t.cover, t.img]);
    if (t && t.img) {
      ok("TICKET: фото занимает правую часть билета (47%), от верха до низа, заполняет её без искажений", Math.abs(t.cov.w - t.card.w * 0.47) < 1.5 && Math.abs(t.cov.r - t.card.r) < 1 && Math.abs(t.cov.t - t.card.t) < 1 && Math.abs(t.cov.b - t.card.b) < 1 && t.img.fit === "cover" && Math.abs(t.img.r.w - t.cov.w) < 1, [t.cov, t.card]);
      // v164 (Доп. 489): фото приглушает слой поверх него (data-now-tone), а не CSS filter — подробно в e2e-v164.mjs (DARK)
      const tone = await page.evaluate(() => { const x = document.querySelector("[data-now-tone]"); return x ? getComputedStyle(x).backgroundColor : ""; });
      ok("TICKET: слева фото тает в карту (маска), приглушено и не ловит нажатия", /linear-gradient/.test(t.mask) && t.filter === "none" && tone === "rgba(26, 18, 7, 0.42)" && t.pe === "none", [t.mask.slice(0, 60), t.filter, tone, t.pe]);
      ok("TICKET: под кнопкой затемнение, слово «Начать» или «Дальше» и название на месте", t.scrim === 1 && /^(Начать|Дальше)$/.test(t.cta) && t.title.length > 5 && t.ctaR.l >= t.cov.l && t.titleR.l < t.cov.l, [t.scrim, t.cta, t.title]);
      ok("TICKET: фото стоит одним слоем (превью заменено целым)", t.layers === 1 && t.img.st === "set" && t.img.nw >= 590, [t.layers, t.img]);
      // название читается: под его началом фото почти прозрачно (маска), яркость фона под текстом близка к билету без фото
      const lum = await page.evaluate(async () => { const c = document.querySelector("[data-now-cover]"); const r = c.getBoundingClientRect(); return { x0: r.left, w: r.width, top: r.top, h: r.height }; });
      const png = await page.screenshot({ clip: { x: Math.round(lum.x0), y: Math.round(lum.top + 6), width: Math.round(lum.w), height: Math.round(lum.h - 12) } });
      const px = await page.evaluate(async (b64) => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode(); const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const g = cv.getContext("2d"); g.drawImage(im, 0, 0);
        const col = (fx) => { const d = g.getImageData(Math.round(im.width * fx), 0, 2, im.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); };
        return { left: col(0.03), mid: col(0.5), right: col(0.9) }; }, png.toString("base64"));
      ok("TICKET: у левого края фото тёмное, как сам билет, правее светлее — фото не лезет под текст", px.left < 70 && px.mid > px.left, px);
    }
    await shot(page, "ticket-440");
    // нажатие по билету открывает урок, как раньше
    await page.locator("[data-now-card]").click(); await page.waitForTimeout(2200);
    const les = await page.evaluate(() => ({ home: !!document.querySelector("[data-now-card]"), t: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 300) }));
    ok("TICKET: нажатие по билету с фото открывает урок (фото нажатию не мешает)", !les.home && t && les.t.toLowerCase().includes(t.title.replace(/^(Урок|Практика|Тест) «|»$/g, "").slice(0, 12).toLowerCase()), les.t.slice(0, 160));
    ok("TICKET: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  // 320 px и 393 px
  for (const [width, height] of [[320, 640], [393, 852]]) { const { ctx, page, errs } = await roman({ width, height, wait: 2600 }); await top(page);
    const t = await ticket(page);
    ok(`TICKET ${width}: фото на месте, в пределах билета, название и кнопка видны, вбок ничего не вылезло`, !!t && !!t.img && t.img.nw > 0 && t.cov.r <= t.card.r + 0.5 && t.cov.l >= t.card.l && t.title.length > 5 && t.stub.w >= 90 && (await overflowX(page)) <= 0, t && [t.cov, t.card, t.stub]);
    await shot(page, "ticket-" + width);
    ok(`TICKET ${width}: без ошибок страницы`, !errs.length, errs.join(" | "));
    await ctx.close(); }
  // «Для чтения»: в v163 бумажный билет был без фото; v164 (Доп. 489) — фото и там (подробно — e2e-v164.mjs, LIGHT)
  { const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 2200, light: true }); await top(page);
    const t = await ticket(page);
    ok("TICKET light: в «Для чтения» билет бумажный и тоже с фото раздела (v164)", !!t && t.mode === "track" && t.hero === "paper" && t.cover === "lesson" && !!t.img && t.img.nw > 0 && t.scrim === 1, t && [t.hero, t.cover, t.img, t.scrim]);
    await shot(page, "ticket-light");
    ok("TICKET light: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  // билет о смене — без фото
  { const { ctx, page, errs } = await open({ who: "maria", width: 393, height: 852, hour: 12, wait: 2200 }); await top(page);
    const t = await ticket(page);
    if (t && t.mode !== "track") ok("TICKET смена: билет о смене («" + t.title + "») — без фото", t.cover === null && t.scrim === 0, [t.mode, t.cover]);
    else ok("TICKET смена: сегодня у Марии билет о треке — фото допустимо (билет о смене проверяется в рабочий день)", !!t, t && t.mode);
    ok("TICKET смена: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
}

// ════════ FIRST: первый запуск, сеть медленная ════════
if (want("FIRST")) {
  { const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 0, flags: { __e2e_slow: "700,1700" } });
    // на главной: сначала билет прежний, потом превью проявляется, потом целое — поверх
    const t0 = await ticket(page);
    ok("FIRST: сразу после заставки билет прежний — фото ещё едет, картинки и затемнения нет", !!t0 && t0.mode === "track" && t0.cover === "lesson" && t0.layers === 0 && t0.scrim === 0, t0 && [t0.cover, t0.layers, t0.scrim]);
    await shot(page, "first-0");
    const got = await waitFor(page, () => { const i = document.querySelectorAll("[data-now-cover] img"); return i.length === 1 && i[0].getAttribute("data-photo-layer") === "set" && i[0].naturalWidth >= 590; }, 9000);
    const log = await takeLog(page);
    const f = fadeOf(log, (r) => r.now);
    ok("FIRST: целое фото в билете встало (одним слоем)", got, log.slice(-3));
    ok("FIRST: фото в билете проявилось — было видно полупрозрачным, а не встало разом", f.seen && f.late && f.soft && !f.popped, f);
    ok("FIRST: целое фото проявлялось поверх превью — превью под ним оставалось на месте (два слоя, нижний непрозрачен)", f.max === 2 && f.base, f);
    ok("FIRST: затемнение под кнопкой появилось вместе с фото", log.some((r) => r.scrim === 1) && log.findIndex((r) => r.scrim === 1) >= log.findIndex((r) => r.now && r.now.length > 0), null);
    ok("FIRST: мерцающей заглушки на месте фото не было ни разу", log.every((r) => r.skel === 0), log.find((r) => r.skel));
    await shot(page, "first-1");
    ok("FIRST: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  // раздел трека сразу после запуска: подложка, потом фото проявляется
  { const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 0, flags: { __e2e_slow: "900,2000" } });
    await takeLog(page);
    await nav(page, "home", 450);
    const m0 = await page.evaluate(() => { const m = document.querySelector(".tbp-cur .tbm-menu"), c = m && m.querySelector(".tbm-cover"); return m ? { cover: m.getAttribute("data-mod-cover"), imgs: c ? c.querySelectorAll("img").length : -1, wait: c ? c.querySelectorAll("[data-photo-wait]").length : -1, skel: c ? c.querySelectorAll(".sa-skel").length : -1,
      pad: getComputedStyle(m.querySelector(".tbm-head")).paddingTop, title: (m.querySelector(".tbm-title") || {}).textContent } : null; });
    ok("FIRST трек: раздел открыт до фото — место под обложку есть, на нём тихая подложка, а не мерцание", !!m0 && !!m0.cover && m0.imgs === 0 && m0.wait === 1 && m0.skel === 0 && parseFloat(m0.pad) >= 60, m0);
    const waitCss = await page.evaluate(() => { const w = document.querySelector(".tbp-cur .tbm-cover [data-photo-wait]"); if (!w) return null; const cs = getComputedStyle(w); return { name: cs.animationName, dur: cs.animationDuration, delay: cs.animationDelay, pos: cs.position }; });
    ok("FIRST трек: подложка — медленный перелив, который появляется через полсекунды (быстрое фото её не покажет)", !!waitCss && /saShimmer/.test(waitCss.name) && /saPhotoWait/.test(waitCss.name) && /2\.6s/.test(waitCss.dur) && /0\.5s/.test(waitCss.delay) && waitCss.pos === "absolute", waitCss);
    await shot(page, "first-track-wait");
    const got = await waitFor(page, () => { const i = document.querySelectorAll(".tbp-cur .tbm-cover img"); return i.length === 1 && i[0].getAttribute("data-photo-layer") === "set" && i[0].naturalWidth >= 590 && !document.querySelector(".tbp-cur .tbm-cover [data-photo-wait]"); }, 12000);
    const log = await takeLog(page);
    const f = fadeOf(log, (r) => r.mod);
    ok("FIRST трек: фото раздела встало, подложка убрана", got, log.slice(-2));
    ok("FIRST трек: превью проявилось из подложки, целое — поверх превью; ничто не встало разом", f.seen && f.late && f.soft && !f.popped && f.max === 2 && f.base, f);
    ok("FIRST трек: шапка раздела не прыгала — отступ под обложку тот же, что до фото", (await page.evaluate(() => getComputedStyle(document.querySelector(".tbp-cur .tbm-head")).paddingTop)) === m0.pad);
    await shot(page, "first-track-done");
    ok("FIRST трек: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  // «Справочник» сразу после запуска
  { const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 0, flags: { __e2e_slow: "900,2000" } });
    await takeLog(page);
    await nav(page, "reference", 100);
    await waitFor(page, () => document.querySelectorAll("[data-ref-card]").length >= 4, 6000);
    const c0 = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-ref-card]")].map((c) => [c.getAttribute("data-ref-card"), { cover: c.getAttribute("data-ref-cover"), own: c.querySelectorAll("img[data-ref-photo]").length, under: c.querySelectorAll("img[data-ref-under]").length, wait: c.querySelectorAll("[data-photo-wait]").length, art: !!c.querySelector("svg:not([width='16'])") && !c.querySelector("img") }])));
    ok("FIRST справочник: «Кофе» (своё фото едет, снимка из приложения нет) — карточка уже «с фото», на месте фото подложка", c0.coffee && c0.coffee.cover === "wait" && c0.coffee.own === 0 && c0.coffee.wait === 1, c0.coffee);
    ok("FIRST справочник: «Сервировка» — пока своё фото едет, стоит снимок из приложения", c0.serving && c0.serving.cover === "app" && c0.serving.under === 1 && c0.serving.own === 0, c0.serving);
    ok("FIRST справочник: «Вина» — снимок из приложения, как раньше", c0.wine && c0.wine.cover === "app" && c0.wine.own === 1 && c0.wine.under === 0, c0.wine);
    await shot(page, "first-ref-wait");
    const got = await waitFor(page, () => ["coffee", "serving"].every((id) => { const c = document.querySelector('[data-ref-card="' + id + '"]'); const i = c ? c.querySelectorAll("img") : []; return c && c.getAttribute("data-ref-cover") === "own" && i.length === 1 && i[0].getAttribute("data-photo-layer") === "set" && i[0].naturalWidth >= 590; }), 14000);
    const log = await takeLog(page);
    ok("FIRST справочник: свои фото встали на «Кофе» и «Сервировку», под ними ничего не осталось", got, log.slice(-1).map((r) => r.refs));
    const fc = fadeOf(log, (r) => (r.refs.coffee ? r.refs.coffee.l : null)), fs = fadeOf(log, (r) => (r.refs.serving ? r.refs.serving.l.filter((l) => !l[3]) : null));
    ok("FIRST справочник: фото «Кофе» проявилось, а не встало разом", fc.seen && fc.late && fc.soft && !fc.popped, fc);
    ok("FIRST справочник: своё фото «Сервировки» проявилось поверх снимка из приложения", fs.seen && fs.late && fs.soft && !fs.popped && log.some((r) => r.refs.serving && r.refs.serving.l.some((l) => l[3] === 1 && l[1] >= 0.9) && r.refs.serving.l.some((l) => l[0] === "in")), fs);
    ok("FIRST справочник: мерцающих заглушек нет", log.every((r) => r.skel === 0));
    await shot(page, "first-ref-done");
    // глава со своим фото: плитка в списке глав
    await page.locator('[data-ref-card="serving"]').click(); await page.waitForTimeout(700);
    const tile = await waitFor(page, () => { const t = document.querySelector('[data-ref-chapter="srv-basics"] [data-ref-tile="own"] img'); return !!t && t.getAttribute("data-photo-layer") === "set" && t.naturalWidth > 0; }, 9000);
    const tl = await takeLog(page);
    ok("FIRST справочник: плитка главы со своим фото — фото встало, заглушки нет", tile && tl.every((r) => r.skel === 0), tl.slice(-1).map((r) => r.tiles));
    ok("FIRST справочник: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  // урок с фото, открытый сразу после запуска (урок другого трека: заранее его фото целиком не готовят)
  { const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 0, flags: { __e2e_slow: "900,2000" } });
    await takeLog(page);
    const opened = await page.evaluate(() => window.__saLesson("c4-3"));
    const there = await waitFor(page, () => !!document.querySelector("[data-lp-cover]"), 6000);
    const c0 = await page.evaluate(() => { const c = document.querySelector("[data-lp-cover]"); return c ? { imgs: c.querySelectorAll("img").length, wait: c.querySelectorAll("[data-photo-wait]").length, skel: c.querySelectorAll(".sa-skel").length, h: Math.round(c.getBoundingClientRect().height) } : null; });
    ok("FIRST урок: место под фото урока есть сразу — с подложкой или уже с превью, без мерцающей заглушки", opened && there && !!c0 && c0.skel === 0 && c0.h >= 150 && (c0.imgs > 0 || c0.wait === 1), c0);
    await shot(page, "first-lesson-wait");
    const got = await waitFor(page, () => { const i = document.querySelectorAll("[data-lp-cover] img"); return i.length === 1 && i[0].getAttribute("data-photo-layer") === "set" && i[0].naturalWidth >= 590; }, 12000);
    const log = await takeLog(page);
    const f = fadeOf(log, (r) => r.lp);
    const h1 = await page.evaluate(() => Math.round(document.querySelector("[data-lp-cover]").getBoundingClientRect().height));
    ok("FIRST урок: фото урока проявилось, а не встало разом; место под него не прыгнуло", got && f.late && f.soft && !f.popped && f.base && !!c0 && h1 === c0.h, [f, h1, c0]);
    await shot(page, "first-lesson-done");
    ok("FIRST урок: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
}

// ════════ AHEAD: постоял на главной — фото готовы ════════
if (want("AHEAD") || want("AGAIN") || want("LOST")) {
  const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 0, flags: { __e2e_slow: "60,120" } });
  // ждём, пока приложение приготовит фото: запросы перестают расти
  let calls = null, calm = 0;
  for (let i = 0; i < 60 && calm < 4; i++) { await page.waitForTimeout(500); const c = await lpCalls(page); calm = calls && c.thumb === calls.thumb && c.full === calls.full && c.thumb > 0 ? calm + 1 : 0; calls = c; }
  const hot = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^sa_lesson_photos_hot_v1:/.test(x)); return k ? JSON.parse(localStorage.getItem(k)) : null; });
  const list = await page.evaluate(() => { const d = window.__demo, r = d.srv.rpc("lesson_photos", { p_token: localStorage.getItem("sa_session_token") }); return r.items.map((x) => x.lesson + (x.scope ? "@" : "")); });
  if (want("AHEAD")) {
    ok("AHEAD: пока человек на главной, приложение само запросило превью всех фото из списка — по одному разу", !!calls && calls.thumb === new Set(list.map((x) => x.replace("@", ""))).size, [calls, list]);
    ok("AHEAD: и целые фото обложек: раздел из билета, разделы трека, «Справочник» — но не всё подряд", !!calls && calls.full >= 5 && calls.full < calls.thumb + 1 && calls.full <= 14, calls);
    ok("AHEAD: номера первых фото запомнены на телефоне (до четырёх) — следующий запуск поднимет их сразу", Array.isArray(hot) && hot.length >= 3 && hot.length <= 4 && hot.every((x) => /\|[0-9a-f]{6,}$/.test(x)), hot);
    await takeLog(page);
    // раздел трека: открылся уже с фото
    await nav(page, "home", 1400);
    let log = await takeLog(page);
    const m = allSet(log, (r) => r.mod);
    ok("AHEAD трек: раздел открылся уже с целым фото — ни подложки, ни проявления", m.n > 0 && !m.bad && log.filter((r) => r.mod).every((r) => r.wait === 0 && r.mod.length === 1 && r.mod[0][2] >= 590), m.bad || log.filter((r) => r.mod).slice(0, 2));
    const side = await page.evaluate(() => [...document.querySelectorAll(".tbm-menu")].filter((x) => !x.closest(".tbp-cur")).map((x) => ({ t: (x.querySelector(".tbm-title") || {}).textContent, c: x.getAttribute("data-mod-cover"), l: [...x.querySelectorAll(".tbm-cover img")].map((i) => [i.getAttribute("data-photo-layer"), i.naturalWidth]) })));
    ok("AHEAD трек: соседняя страница с обложкой тоже стоит с целым фото (когда станет текущей, резкость не сменится)", side.filter((s) => s.c).length >= 1 && side.filter((s) => s.c).every((s) => s.l.length === 1 && s.l[0][0] === "set" && s.l[0][1] >= 590), side);
    const before = await lpCalls(page);
    await shot(page, "ahead-track");
    // «Справочник»: свои обложки и снимки из приложения стоят сразу
    await nav(page, "reference", 1500);
    log = await takeLog(page);
    const withCards = log.filter((r) => Object.keys(r.refs).length >= 4);
    const refBad = withCards.flatMap((r) => ["coffee", "serving", "wine"].map((id) => ({ id, c: r.refs[id] })).filter((x) => !x.c || x.c.l.length !== 1 || x.c.l[0][0] !== "set" || x.c.l[0][1] < 0.9)).slice(0, 2);
    ok("AHEAD справочник: карточки с первого кадра с фото — свои на «Кофе» и «Сервировке» (целые), снимок на «Винах»; ничего не проявлялось и не менялось", withCards.length > 0 && !refBad.length && withCards.every((r) => r.refs.coffee.cover === "own" && r.refs.serving.cover === "own" && r.refs.coffee.l[0][2] >= 590 && r.wait === 0), refBad.length ? refBad : withCards.slice(0, 1).map((r) => r.refs));
    await shot(page, "ahead-ref");
    await page.locator('[data-ref-card="serving"]').click(); await page.waitForTimeout(1100);
    log = await takeLog(page);
    const tl = allSet(log, (r) => (r.tiles.length ? r.tiles[0] : null));
    ok("AHEAD справочник: плитка главы со своим фото стоит сразу", tl.n > 0 && !tl.bad, tl.bad || "нет плитки");
    const after = await lpCalls(page);
    ok("AHEAD: на эти экраны не ушло ни одного нового запроса за фото", after.thumb === before.thumb && after.full === before.full, [before, after]);
    ok("AHEAD: без ошибок страницы", !errs.length, errs.join(" | "));
  }
  // ════════ AGAIN: приложение закрыли и открыли ════════
  if (want("AGAIN")) {
    await relaunch(page, errs, { flags: { __e2e_slow: null }, wait: 400 });   // хроника успевает записать кадры после заставки
    const log = await takeLog(page);
    const firstHome = log.findIndex((r) => !r.splash && r.home);
    const atHome = log.slice(Math.max(0, firstHome));
    const now = allSet(atHome, (r) => r.now);
    ok("AGAIN: повторный запуск — билет с фото уже в первом кадре после заставки (целое, без проявления)", firstHome >= 0 && now.n > 0 && !now.bad && atHome[0].now && atHome[0].now.length === 1 && atHome[0].now[0][2] >= 590 && atHome[0].scrim === 1, now.bad || atHome.slice(0, 2));
    // и пока заставка уходила, под ней фото уже стояло
    const under = log.filter((r) => r.splash && r.home && r.now);
    ok("AGAIN: фото встало ещё под заставкой (заставка ждёт фото с телефона)", under.length === 0 || under.every((r) => r.now.length === 0 || r.now.every((l) => l[0] === "set")) , under.slice(0, 2));
    await page.waitForTimeout(2300);
    const c = await lpCalls(page);
    ok("AGAIN: за фото на сервер не ушло ни одного запроса — всё с телефона (список фото — один запрос)", c.thumb === 0 && c.full === 0 && c.list >= 1, c);
    await takeLog(page);
    await nav(page, "home", 1300);
    const tlog = await takeLog(page);
    const m = allSet(tlog, (r) => r.mod);
    ok("AGAIN: раздел трека открывается сразу с целым фото", m.n > 0 && !m.bad && tlog.filter((r) => r.mod).every((r) => r.mod.length === 1 && r.mod[0][2] >= 590), m.bad || tlog.filter((r) => r.mod).slice(0, 2));
    await nav(page, "reference", 1400);
    const rlog = (await takeLog(page)).filter((r) => Object.keys(r.refs).length >= 4);
    ok("AGAIN: «Справочник» — свои обложки стоят с первого кадра", rlog.length > 0 && rlog.every((r) => r.refs.coffee.cover === "own" && r.refs.coffee.l.length === 1 && r.refs.coffee.l[0][0] === "set" && r.refs.serving.cover === "own" && r.refs.serving.l.every((l) => l[0] === "set")), rlog.slice(0, 1).map((r) => r.refs));
    const c2 = await lpCalls(page);
    ok("AGAIN: и на этих экранах запросов за фото нет", c2.thumb === 0 && c2.full === 0, c2);
    // и не выжидая на главной: что уже на телефоне, поднимается в память сразу, как она открылась (сеть ещё не трогаем)
    await relaunch(page, errs, { wait: 400 });
    await takeLog(page);
    await nav(page, "reference", 1300);
    const qlog = (await takeLog(page)).filter((r) => Object.keys(r.refs).length >= 4);
    ok("AGAIN: «Справочник», открытый в первые полсекунды после запуска, тоже сразу с целыми своими фото", qlog.length > 0 && qlog.every((r) => ["coffee", "serving"].every((id) => r.refs[id].cover === "own" && r.refs[id].l.length === 1 && r.refs[id].l[0][0] === "set" && r.refs[id].l[0][2] >= 590)), qlog.slice(0, 1).map((r) => r.refs));
    const c3 = await lpCalls(page);
    ok("AGAIN: и тоже без единого запроса за фото", c3.thumb === 0 && c3.full === 0, c3);
    ok("AGAIN: без ошибок страницы", !errs.length, errs.join(" | "));
  }
  // ════════ LOST: телефон не сберёг фото (хранилище почистили или оно не работает) ════════
  if (want("LOST")) {
    await page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase("sa_photos"); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
    await relaunch(page, errs, { flags: { __e2e_slow: null }, wait: 4500 });
    const left = await page.evaluate(() => new Promise((res) => { const rq = indexedDB.open("sa_photos"); rq.onerror = () => res(-1);
      rq.onsuccess = () => { const db = rq.result; if (!db.objectStoreNames.contains("f")) { db.close(); res(0); return; } const r = db.transaction("f").objectStore("f").count(); r.onsuccess = () => { db.close(); res(r.result); }; }; }));
    const c = await lpCalls(page);
    ok("LOST: фото с телефона пропали — заранее заново ничего не качается: ушли только запросы за фото билета, который на виду", left >= 0 && left <= 1 && c.thumb <= 1 && c.full <= 1 && c.thumb + c.full >= 1, [left, c]);
    const t = await ticket(page);
    ok("LOST: билет при этом с фото — оно приехало по показу", !!t && !!t.img && t.img.nw >= 590, t && t.img);
    await nav(page, "home", 2000);
    const c2 = await lpCalls(page);
    const m = await page.evaluate(() => { const i = document.querySelector(".tbp-cur .tbm-cover img"); return i ? i.naturalWidth : 0; });
    ok("LOST: открыл раздел трека — его фото приезжает по показу, как раньше", m >= 590 && c2.full >= c.full, [m, c, c2]);
    ok("LOST: без ошибок страницы", !errs.length, errs.join(" | "));
  }
  await ctx.close();
}

// ════════ LEAN: телефон просит экономить трафик ════════
if (want("LEAN")) {
  const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 0, flags: { __e2e_lean: "1", __e2e_slow: "40,80" } });
  let calls = null, calm = 0;
  for (let i = 0; i < 50 && calm < 4; i++) { await page.waitForTimeout(500); const c = await lpCalls(page); calm = calls && c.thumb === calls.thumb && c.full === calls.full && c.thumb > 0 ? calm + 1 : 0; calls = c; }
  ok("LEAN: телефон сообщил об экономии трафика", await page.evaluate(() => !!(navigator.connection && navigator.connection.saveData)));
  ok("LEAN: заранее идут только превью; целое — одно, для билета, который человек уже видит", !!calls && calls.thumb >= 6 && calls.full === 1, calls);
  const t = await ticket(page);
  ok("LEAN: билет с фото при этом как у всех", !!t && !!t.img && t.img.nw >= 590, t && t.img);
  ok("LEAN: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ════════ NO51: сервер без этапа 51 ════════
if (want("NO51")) {
  const { ctx, page, errs } = await open({ who: "roman", width: 393, height: 852, flags: { __e2e_no51: "1" }, wait: 2600 }); await top(page);
  const t = await ticket(page);
  ok("NO51: без этапа 51 билет прежний — без фото, без затемнения", !!t && t.mode === "track" && t.cover === null && t.scrim === 0 && t.shadow === "none", t && [t.cover, t.scrim, t.shadow]);
  const c = await lpCalls(page);
  ok("NO51: за самими фото приложение не ходит (спросило список — и всё)", c.thumb === 0 && c.full === 0 && c.list >= 1, c);
  await nav(page, "home", 1500);
  const m = await page.evaluate(() => { const x = document.querySelector(".tbp-cur .tbm-menu"); return x ? { cover: x.getAttribute("data-mod-cover"), has: !!x.querySelector(".tbm-cover"), wait: document.querySelectorAll("[data-photo-wait]").length } : null; });
  ok("NO51: раздел трека — без обложки и без места под неё, как раньше", !!m && m.cover === null && !m.has && m.wait === 0, m);
  await nav(page, "reference", 1500);
  const r = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-ref-card]")].map((x) => [x.getAttribute("data-ref-card"), { cover: x.getAttribute("data-ref-cover"), img: [...x.querySelectorAll("img")].map((i) => [i.getAttribute("data-photo-layer"), i.naturalWidth > 0]) }])));
  ok("NO51: «Справочник» — снимки из приложения на «Сервировке» и «Винах», рисунок на «Кофе»", r.serving && r.serving.cover === "app" && r.serving.img.length === 1 && r.serving.img[0][1] && r.wine.cover === "app" && r.coffee.cover === "art" && r.coffee.img.length === 0, r);
  ok("NO51: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ════════ EDIT: руководитель меняет обложку ════════
if (want("EDIT")) {
  const PHOTO = await (async () => { const c = await browser.newContext(); const p = await c.newPage(); await p.setContent("<canvas id=c width=900 height=600></canvas>");
    const b64 = await p.evaluate(() => { const cv = document.getElementById("c"), g = cv.getContext("2d"); const gr = g.createLinearGradient(0, 0, 900, 600); gr.addColorStop(0, "#1d4f7a"); gr.addColorStop(1, "#d9a441"); g.fillStyle = gr; g.fillRect(0, 0, 900, 600);
      g.fillStyle = "#f4ead0"; for (let i = 0; i < 9; i++) g.fillRect(60 + i * 95, 380 - (i % 3) * 60, 50, 160); return cv.toDataURL("image/jpeg", 0.9).split(",")[1]; });
    await c.close(); return Buffer.from(b64, "base64"); })();
  const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 2600, flags: { __e2e_slow: "60,120" } });
  await nav(page, "home", 1600);
  const cur = await page.evaluate(() => { const m = document.querySelector(".tbp-cur .tbm-menu"); return m ? { id: (m.querySelector("[data-cover-edit]") || { getAttribute: () => null }).getAttribute("data-cover-edit"), cover: m.getAttribute("data-mod-cover"), nw: (m.querySelector(".tbm-cover img") || {}).naturalWidth || 0 } : null; });
  ok("EDIT: у руководителя на разделе фотоаппарат, на обложке сейчас фото", !!cur && !!cur.id && !!cur.cover && cur.nw > 0, cur);
  await page.locator(".tbp-cur [data-cover-edit]").click(); await page.waitForTimeout(700);
  const sheet = await page.evaluate(() => { const d = document.querySelector("[data-lp-sheet] [role=dialog]"), a = document.querySelector("[data-lp-also]"); return d ? { label: d.getAttribute("aria-label"), also: a ? a.textContent.trim() : "" } : null; });
  ok("EDIT: лист «Фото раздела» говорит, что фото видно и в билете «Начать» на главной", !!sheet && sheet.label === "Фото раздела" && sheet.also === "Это же фото видно на главной, в билете «Начать», пока сотрудник проходит раздел.", sheet);   // v164: без оговорки о «Для чтения»
  await shot(page, "edit-sheet");
  await takeLog(page);
  await page.locator("[data-lp-pick] input[type=file]").setInputFiles({ name: "hall.jpg", mimeType: "image/jpeg", buffer: PHOTO });
  const own = await waitFor(page, () => { const m = document.querySelector(".tbp-cur .tbm-menu"); const i = m ? m.querySelectorAll(".tbm-cover img") : []; return !!m && m.getAttribute("data-mod-cover") === "own" && i.length === 1 && i[0].getAttribute("data-photo-layer") === "set" && i[0].naturalWidth === 900 && !document.querySelector("[data-lp-sheet]"); }, 12000);
  const log = await takeLog(page);
  const f = fadeOf(log, (r) => r.mod);
  ok("EDIT: новое фото встало обложкой раздела, лист закрылся", own, log.slice(-2).map((r) => r.mod));
  ok("EDIT: новое фото проявилось поверх прежнего — прежнее оставалось под ним, пустого кадра не было", f.soft && !f.popped && f.max === 2 && f.base && log.filter((r) => r.mod).every((r) => r.mod.length >= 1), f);
  await shot(page, "edit-done");
  // у раздела «Справочника» про билет не пишем
  await nav(page, "reference", 1500);
  await page.locator('[data-cover-edit="ref:wine"]').click(); await page.waitForTimeout(700);
  ok("EDIT: в листе раздела «Справочника» строки про билет нет", (await page.locator("[data-lp-sheet]").count()) === 1 && (await page.locator("[data-lp-also]").count()) === 0);
  ok("EDIT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ════════ LOOK ════════
if (want("LOOK")) {
  // «Для чтения»: раздел трека и «Справочник» — фото проявляется так же
  { const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 0, light: true, flags: { __e2e_slow: "700,1500" } });
    await takeLog(page);
    await nav(page, "home", 300);
    const got = await waitFor(page, () => { const i = document.querySelectorAll(".tbp-cur .tbm-cover img"); return i.length === 1 && i[0].getAttribute("data-photo-layer") === "set" && i[0].naturalWidth >= 590; }, 12000);
    const log = await takeLog(page);
    const f = fadeOf(log, (r) => r.mod);
    const op = await page.evaluate(() => { const i = document.querySelector(".tbp-cur .tbm-cover img"); return i ? getComputedStyle(i).opacity : ""; });
    ok("LOOK light: в «Для чтения» фото раздела проявилось и встало со своей прозрачностью (.96), а не 1", got && f.soft && !f.popped && op === "0.96", [f, op]);
    ok("LOOK light: вбок ничего не вылезло", (await overflowX(page)) <= 0);
    await shot(page, "look-light-track");
    ok("LOOK light: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  // «меньше движения»: без анимации, но фото на месте
  { const { ctx, page, errs } = await roman({ width: 393, height: 852, wait: 0, reduce: true, flags: { __e2e_slow: "500,1100" } });
    await nav(page, "home", 300);
    const wcss = await page.evaluate(() => { const w = document.querySelector(".tbp-cur .tbm-cover [data-photo-wait]"); return w ? { name: getComputedStyle(w).animationName, op: getComputedStyle(w).opacity } : null; });
    ok("LOOK меньше движения: подложка стоит без перелива", !wcss || (wcss.name === "none" && wcss.op === "1"), wcss);
    await takeLog(page);
    const got = await waitFor(page, () => { const i = document.querySelectorAll(".tbp-cur .tbm-cover img"); return i.length === 1 && i[0].getAttribute("data-photo-layer") === "set" && i[0].naturalWidth >= 590; }, 12000);
    const log = await takeLog(page);
    const anim = log.filter((r) => r.mod).flatMap((r) => r.mod).filter((l) => l[0] === "in" && l[1] > 0.04 && l[1] < 0.96);
    ok("LOOK меньше движения: фото встало без проявления (анимации нет), на месте", got && anim.length === 0, anim.slice(0, 3));
    ok("LOOK меньше движения: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  // 320 px: раздел трека и «Справочник»
  { const { ctx, page, errs } = await roman({ width: 320, height: 640, wait: 2600 });
    await nav(page, "home", 1500);
    const g = await page.evaluate(() => { const m = document.querySelector(".tbp-cur .tbm-menu"), c = m && m.querySelector(".tbm-cover"), i = c && c.querySelector("img"); if (!i) return null; const a = c.getBoundingClientRect(), b = i.getBoundingClientRect(), mm = m.getBoundingClientRect(); return { cw: a.width, iw: b.width, mw: mm.width, h: a.height, nw: i.naturalWidth }; });
    ok("LOOK 320: фото раздела во всю ширину карточки, 178 px высотой", !!g && Math.abs(g.cw - g.iw) < 1 && Math.abs(g.h - 178) < 1 && g.cw <= g.mw + 0.5 && g.nw > 0, g);
    await nav(page, "reference", 1500);
    const r = await page.evaluate(() => [...document.querySelectorAll("[data-ref-card]")].map((c) => { const a = c.getBoundingClientRect(), i = c.querySelector("img[data-ref-photo]"), b = i ? i.getBoundingClientRect() : null; return { id: c.getAttribute("data-ref-card"), w: a.width, iw: b ? b.width : 0, ih: b ? b.height : 0, h: a.height }; }));
    ok("LOOK 320: в «Справочнике» фото на всю карточку, вбок ничего не вылезло", r.filter((x) => x.iw).length >= 3 && r.filter((x) => x.iw).every((x) => Math.abs(x.iw - x.w) < 2.5 && Math.abs(x.ih - x.h) < 2.5) && (await overflowX(page)) <= 0, r);
    await shot(page, "look-320-ref");
    ok("LOOK 320: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
}

await browser.close(); server.close();
console.log("\nитого: " + pass + " ✓, " + fail + " ✗");
process.exit(fail ? 1 : 0);
