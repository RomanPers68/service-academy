// e2e v203 (Доп. 528): новинки меню первыми и точка «новинки» у всех. Демо целиком (tools/claude/demo-app/build.mjs).
// Мария (руководитель) публикует меню с тремя зимними блюдами (isNew, добавлены час назад) — тем же menu_set, что «Меню»;
// стоп-лист снят: число «в стопе» важнее точки (v159), при нём точки нет.
//   DOT     — у Анны (сотрудник, своих блюд нет) золотая точка «новинки» на значке «Меню»; «Выучил новинки ✓» (волна
//             запомнена) — точки нет; у Марии точка тоже есть; блюдо в стопе — на значке число, не точка;
//   LCMENU  — Мария, живая проверка Анны: «Новинок в меню: 3, спрошу о них первыми»; первые три вопроса — о зимних блюдах,
//             у вопроса «· новинка»;
//   BRIEF   — «Проверка на брифинге»: вопрос о блюде — о зимнем, «Меню · … · новинка».
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v203.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5712, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v203";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  const buf = readFileSync(f);
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream", "Content-Length": buf.length }); res.end(buf);
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(typeof extra === "string" ? extra : JSON.stringify(extra)).slice(0, 600) : "")); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const R0 = "Два моря, Океан";
const WINTER = [
  { id: "zm1", name: "Утка с брусникой", cat: "Горячее", ingredients: ["Утиная грудка", "Брусничный соус", "Печёная тыква"], allergens: ["Горчица"], desc: "Сочная утиная грудка с брусничным соусом. Подаём с тыквой." },
  { id: "zm2", name: "Суп из белых грибов", cat: "Супы", ingredients: ["Белые грибы", "Сливки", "Гренки"], allergens: ["Молоко", "Глютен"], desc: "Густой суп из лесных грибов. Согревает в мороз." },
  { id: "zm3", name: "Пельмени с олениной", cat: "Горячее", ingredients: ["Оленина", "Тесто", "Сметана"], allergens: ["Глютен", "Молоко", "Яйца"], desc: "Лепим вручную из оленины. Подаём со сметаной." },
];

async function prep(page) {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => {});
  await sleep(1300);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg,#demo-strip,#demo-tgchat,#demo-push{display:none!important}" });
}
async function open(who) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("__demo_who", w); localStorage.setItem("sa_lesson_cards", "1"); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await prep(page);
  return { ctx, page, errs };
}
async function become(page, who) {
  await page.evaluate((w) => localStorage.setItem("__demo_who", w), who);
  await page.goto(URL0, { waitUntil: "load" });
  await prep(page);
}
const nav = async (page, s, wait = 1500) => { await page.evaluate((x) => window.__saNav(x), s); await sleep(wait); };
const until = async (fn, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch (e) { /* */ } await sleep(200); } return null; };
const texts = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((x) => x.textContent.replace(/\s+/g, " ").trim()), sel);
const attrs = (page, sel, a) => page.evaluate(([s, k]) => [...document.querySelectorAll(s)].map((x) => x.getAttribute(k)), [sel, a]);
const click = async (page, sel, wait = 500) => { await page.locator(sel).first().click(); await sleep(wait); };
const count = (page, sel) => page.locator(sel).count();
const shot = (page, name) => page.screenshot({ path: OUT + "/" + name + ".png" });
const view = (page) => page.evaluate(() => { const e = document.querySelector("[data-lc]"); return e ? e.getAttribute("data-lc") : null; });
const run = async (key, fn) => { if (!want(key)) return; try { await fn(); } catch (e) { ok(key + ": сценарий дошёл до конца", false, String(e && e.message || e).split("\n")[0]); } };
// RPC демо — тот же путь, что у приложения
const rpcCall = (page, fn, body) => page.evaluate(async ([f, b]) => {
  const r = await fetch("https://demo.supabase.co/rest/v1/rpc/" + f, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_token: localStorage.getItem("sa_session_token"), ...b }) });
  return r.json();
}, [fn, body]);

const { ctx, page, errs } = await open("maria");
// Мария публикует меню: всё, что было, и три зимних блюда — новинки (добавлены час назад)
const menu0 = await rpcCall(page, "menu_get", { p_restaurant: R0 });
const now = await page.evaluate(() => Date.now());
const winter = WINTER.map((d) => ({ img: "", pairing: "", note: "", ...d, isNew: true, addedAt: now - 3600e3 }));
const unstop = (d) => { const x = { ...d }; delete x.stop; delete x.stopAt; return x; };
const pub = await rpcCall(page, "menu_set", { p_restaurant: R0, p_dishes: JSON.stringify([...winter, ...(Array.isArray(menu0) ? menu0 : []).map(unstop)]) });
ok("Мария опубликовала меню с тремя зимними новинками", pub && pub.ok === true && Array.isArray(menu0) && menu0.length > 4, pub);
const dot = (p) => p.evaluate(() => { const d = document.querySelector('[data-menu-dot]'); return d ? d.getAttribute("data-menu-dot") : null; });

await run("DOT", async () => {
  await become(page, "anna");
  const d = await until(async () => (await dot(page)) === "new", 15000);
  ok("DOT: у Анны (своих блюд нет) — точка «новинки» на значке «Меню»", d === true, await dot(page));
  ok("DOT: копия меню у Анны — меню команды с новинками", await page.evaluate(([r]) => { try { const v = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}")[r] || []; return v.filter((x) => x.isNew).length === 3
    && !Object.keys(JSON.parse(localStorage.getItem("sa_menu_custom") || "{}")).length; } catch (e) { return false; } }, [R0]));
  await shot(page, "1-anna-dot");
  // «Выучил новинки ✓» в «Меню» запоминает волну — самую позднюю новинку
  await page.evaluate(([r, w]) => localStorage.setItem("sa_menu_learned_" + r, w), [R0, String(now - 3600e3)]);
  await nav(page, "glossary", 900);
  await nav(page, "roleSelect", 2000);
  ok("DOT: волна новинок выучена — точки «новинки» нет", (await until(async () => (await dot(page)) !== "new", 6000)) === true, await dot(page));
  await become(page, "maria");
  ok("DOT: у Марии точка тоже есть", (await until(async () => (await dot(page)) === "new", 15000)) === true, await dot(page));
  // блюдо в стопе: на значке число «в стопе» — оно важнее точки
  const m1 = await rpcCall(page, "menu_get", { p_restaurant: R0 });
  await rpcCall(page, "menu_set", { p_restaurant: R0, p_dishes: JSON.stringify(m1.map((d, i) => (i === 5 ? { ...d, stop: true, stopAt: Date.now() } : d))) });
  await become(page, "anna");
  const st = await until(async () => (await attrs(page, "[data-stop-badge]", "data-stop-badge"))[0] || null, 15000);
  ok("DOT: блюдо в стопе — на значке «1», точки нет", st === "1" && (await dot(page)) === null, [st, await dot(page)]);
  await rpcCall(page, "menu_set", { p_restaurant: R0, p_dishes: JSON.stringify(m1) });
  await become(page, "maria");
});

await run("LCMENU", async () => {
  await nav(page, "liveCheck", 2500);
  await click(page, '[data-lc-person="e-anna"]', 2200);
  const n = await until(async () => (await attrs(page, "[data-lc-menu-new]", "data-lc-menu-new"))[0] || null);
  ok("LCMENU: «Новинок в меню: 3, спрошу о них первыми»", n === "3" && (await texts(page, "[data-lc-menu-new]"))[0] === "Новинок в меню: 3, спрошу о них первыми", await texts(page, "[data-lc-menu-new]"));
  await shot(page, "2-lc-menu-card");
  await click(page, "[data-lc-menu-start]", 800);
  const keys = [], metas = [];
  for (let i = 0; i < 4; i++) {
    keys.push((await attrs(page, "[data-lc-key]", "data-lc-key"))[0]);
    metas.push(((await texts(page, "[data-lc-q] > div")).find((t) => /^Вопрос \d из 4/.test(t))) || "");
    if (i === 0) await shot(page, "3-lc-menu-q");
    await click(page, "[data-lc-reveal]", 200);
    await click(page, "[data-lc-all]", 150);
    await click(page, "[data-lc-next-q]", 300);
  }
  ok("LCMENU: первые три вопроса — о зимних блюдах, четвёртый — о другом", keys.slice(0, 3).every((k) => /^menu#zm[123]$/.test(k)) && new Set(keys.slice(0, 3)).size === 3 && !/^menu#zm/.test(keys[3] || ""), keys);
  ok("LCMENU: у вопроса о новинке — «· новинка», у другого — нет", metas.slice(0, 3).every((t) => t.includes("· новинка")) && !metas[3].includes("новинка"), metas);
  await click(page, "[data-lc-save]", 1500);
  ok("LCMENU: итог сохранён", (await count(page, "[data-lc-result]")) === 1);
  await click(page, "[data-lc-tomods]", 900);
  await page.locator("[data-lens=back]").first().click(); await sleep(1200);
});

await run("BRIEF", async () => {
  await nav(page, "brief", 3500);
  const ks = await until(async () => { const a = await attrs(page, "[data-brief-lc-key]", "data-brief-lc-key"); return a.length ? a : null; }, 12000);
  const menuK = (ks || []).filter((k) => /^menu#/.test(k));
  ok("BRIEF: вопрос о блюде — о зимней новинке", menuK.length === 1 && /^menu#zm[123]$/.test(menuK[0]), ks);
  const where = await page.evaluate(() => { const el = [...document.querySelectorAll("[data-brief-lc]")].find((x) => /^menu#/.test(x.getAttribute("data-brief-lc-key") || "")); return el ? el.textContent : ""; });
  ok("BRIEF: подпись «Меню · … · новинка»", /Меню · [^·]+ · новинка/.test(where), where);
  await page.locator('[data-brief-block="lc"]').scrollIntoViewIfNeeded();
  await shot(page, "4-brief-new");
});

ok("без ошибок страницы", errs.length === 0, errs);
await ctx.close();
await browser.close();
server.close();
console.log(`\nпроверок: ${pass + fail}, ✓ ${pass}, ✗ ${fail}`);
process.exit(fail ? 1 : 0);
