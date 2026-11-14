// e2e v157 (Доп. 481): «чтобы было приятно зайти и хотелось остаться» — фото на обложках, полка значков, кто сегодня со мной,
// вечерний свет. Сайт — демо целиком (tools/claude/demo-app/build.mjs: сервер в странице, люди демо; экран открывает
// window.__saNav). Час в демо — смещением часов (__demo_t, как в demo-app/boot.js).
// Разделы: REF («Справочник»: «Сервировка» и «Вина» — карточки с фото из приложения, «Кофе» и «Барная карта» — рисунок;
// высота одна; у официанта фотоаппарата нет, у менеджера есть; тап по фотоаппарату — лист «Фото раздела», раздел не
// открывается; своё фото встаёт на карточку и снимается обратно; «Для чтения»), MOD (раздел трека: обложка — фото первого
// урока с фото, шапка раздела ниже фото, ленточка поверх; у раздела без фото обложки нет; менеджер ставит своё фото
// раздела), ME («Я»: полка — пять значков, полученный первым, «1 из 14», неделя с понедельника, тап — «Путь мастера»),
// SHIFT («Смена»: кружки коллег, имена и кто старший; у менеджера — «ты за старшего»; смены нет — прежний вид; копии
// графика нет — прежняя строка), EVE (19:30 — огни вокруг логотипа, фон приложения тот же, что днём, логотип и приветствие
// над огнями; ночью огней меньше; днём и в «Для чтения» — нет; «меньше движения» — огни стоят), NARROW (320 px).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v157.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5570, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v157";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
const PHOTO = readFileSync(fileURLToPath(new URL("../../public/reference/wine_present.jpg", import.meta.url)));
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  res.writeHead(200, { "Content-Type": mime[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const URL0 = "http://localhost:" + PORT + "/index.html";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("✓ " + name); } else { fail++; console.log("✗ " + name + (extra ? " — " + String(extra).slice(0, 500) : "")); } };
const browser = await chromium.launch();

async function open({ who = "anna", light = false, width = 390, height = 844, hour = null, minute = 0, reduced = false, noSched = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka", reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  if (hour !== null) await page.evaluate(([h, m]) => { const real = performance.timeOrigin + performance.now(); const d = new Date();
    localStorage.setItem("__demo_t", JSON.stringify({ off: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0).getTime() - real, at: real })); }, [hour, minute]);
  await page.goto(URL0, { waitUntil: "load" });
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
  if (noSched) await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^sa_sched_(cache|bg)_/.test(k)) localStorage.removeItem(k); });
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
const nav = async (page, s, ms = 1800) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms);
  await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); await page.waitForTimeout(250); };
const overflowX = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
const txt = (page) => page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " "));
const refCards = (page) => page.evaluate(() => [...document.querySelectorAll("[data-ref-card]")].map((c) => { const r = c.getBoundingClientRect(), img = c.querySelector("[data-ref-photo]");
  const t = [...c.querySelectorAll("div")].find((d) => d.children.length === 0 && (d.textContent || "").trim() === c.getAttribute("aria-label"));
  return { id: c.getAttribute("data-ref-card"), cover: c.getAttribute("data-ref-cover"), h: Math.round(r.height), w: Math.round(r.width), img: img ? { ok: img.complete && img.naturalWidth > 0, src: (img.getAttribute("src") || "").slice(0, 40), w: Math.round(img.getBoundingClientRect().width) } : null,
    art: !!c.querySelector("[data-ref-art]"), cam: !!c.querySelector("[data-cover-edit]"), title: t ? { size: getComputedStyle(t).fontSize, color: getComputedStyle(t).color } : null }; }));
const waitFor = async (page, fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (e) { return false; } };

// ── REF ───────────────────────────────────────────────────────────────────────────────────────────────────
if (want("REF")) {
  { const { ctx, page, errs } = await open({ who: "anna" });
    await nav(page, "reference"); await page.waitForTimeout(600);
    const c = await refCards(page); const by = Object.fromEntries(c.map((x) => [x.id, x]));
    ok("REF: четыре раздела — «Сервировка», «Вина», «Кофе», «Барная карта»", c.map((x) => x.id).join() === "serving,wine,coffee,barcard", JSON.stringify(c.map((x) => x.id)));
    ok("REF: «Сервировка» и «Вина» — с фото из приложения, фото загрузилось и во всю карточку", ["serving", "wine"].every((k) => by[k] && by[k].cover === "app" && by[k].img && by[k].img.ok && by[k].img.w >= by[k].w - 4), JSON.stringify([by.serving, by.wine]));
    ok("REF: «Кофе» и «Барная карта» — прежний рисунок, без фото", ["coffee", "barcard"].every((k) => by[k] && by[k].cover === "art" && !by[k].img && by[k].art), JSON.stringify([by.coffee, by.barcard]));
    ok("REF: карточки одной высоты — 112 px и выше", c.every((x) => x.h >= 112 && x.h === c[0].h), c.map((x) => x.h).join());
    ok("REF: название раздела крупнее прежнего (19 px)", c.every((x) => x.title && x.title.size === "19px"), JSON.stringify(c.map((x) => x.title)));
    ok("REF: у официанта фотоаппарата нет", c.every((x) => !x.cam));
    await page.screenshot({ path: join(OUT, "ref-anna.png") });
    await page.locator('[data-ref-card="serving"]').click(); await page.waitForTimeout(1200);
    ok("REF: тап по карточке открывает раздел", /Основы сервировки/.test(await txt(page)));
    ok("REF: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  { const { ctx, page, errs } = await open({ who: "maria" });
    await nav(page, "reference"); await page.waitForTimeout(600);
    let c = await refCards(page);
    ok("REF менеджер: фотоаппарат на каждой карточке", c.length === 4 && c.every((x) => x.cam), JSON.stringify(c.map((x) => x.cam)));
    await page.locator('[data-cover-edit="ref:coffee"]').click(); await page.waitForTimeout(700);
    const sheet = await page.evaluate(() => { const d = document.querySelector("[data-lp-sheet] [role=dialog]"); return d ? { kind: d.getAttribute("data-lp-kind"), label: d.getAttribute("aria-label"), t: (d.innerText || "").replace(/\s+/g, " ") } : null; });
    ok("REF менеджер: тап по фотоаппарату — лист «Фото раздела», раздел не открылся", !!sheet && sheet.kind === "section" && sheet.label === "Фото раздела" && /Кофе/.test(sheet.t) && /Справочник/.test(await txt(page)) && !/Программа/.test(await txt(page)), JSON.stringify(sheet));
    // менеджер заведения ставит фото только своему заведению (права — как у фото уроков), поэтому выбора «сеть или заведение» нет
    ok("REF менеджер: в листе — «Выбрать фото» и слова про обложку раздела у своего заведения", !!sheet && !/Вся сеть/.test(sheet.t) && /Выбрать фото/.test(sheet.t) && /фото встанет обложкой раздела у «Два моря, Океан»\./.test(sheet.t), sheet && sheet.t);
    await page.screenshot({ path: join(OUT, "ref-sheet.png") });
    await page.locator("[data-lp-pick] input[type=file]").setInputFiles({ name: "hall.jpg", mimeType: "image/jpeg", buffer: PHOTO });
    const own = await waitFor(page, () => { const c2 = document.querySelector('[data-ref-card="coffee"]'); const i = c2 && c2.querySelector("[data-ref-photo]"); return !!c2 && c2.getAttribute("data-ref-cover") === "own" && !!i && i.complete && i.naturalWidth > 0; });
    c = await refCards(page);
    ok("REF менеджер: своё фото встало на «Кофе» (рисунок ушёл), лист закрылся", own && !(await page.locator("[data-lp-sheet]").count()) && !c.find((x) => x.id === "coffee").art, JSON.stringify(c.find((x) => x.id === "coffee")));
    ok("REF менеджер: после выбора фото раздел не открылся", /Познавательные курсы/.test(await txt(page)));
    await page.screenshot({ path: join(OUT, "ref-own.png") });
    await page.locator('[data-cover-edit="ref:serving"]').click(); await page.waitForTimeout(700);
    ok("REF менеджер: у «Сервировки» лист говорит, что сейчас снимок из справочника", /Сейчас на обложке снимок из справочника\. Своё фото встанет вместо него\./.test(await page.locator("[data-lp-sheet]").innerText()));
    await page.locator("[data-lp-sheet] [data-lens-x]").click(); await page.waitForTimeout(400);
    ok("REF менеджер: крестик закрывает лист, раздел не открылся", !(await page.locator("[data-lp-sheet]").count()) && /Познавательные курсы/.test(await txt(page)));
    await page.locator('[data-cover-edit="ref:coffee"]').click(); await page.waitForTimeout(700);
    await page.locator("[data-lp-drop]").click(); await page.waitForTimeout(300);
    ok("REF менеджер: «Убрать фото» — во второе касание «Да, убрать фото у раздела»", /Да, убрать фото у раздела/.test(await page.locator("[data-lp-drop]").innerText()));
    await page.locator("[data-lp-drop]").click();
    const back = await waitFor(page, () => { const c2 = document.querySelector('[data-ref-card="coffee"]'); return !!c2 && c2.getAttribute("data-ref-cover") === "art"; });
    ok("REF менеджер: фото снято — у «Кофе» снова рисунок", back);
    ok("REF менеджер: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  { const { ctx, page } = await open({ who: "roman" });
    await nav(page, "reference"); await page.waitForTimeout(600);
    await page.locator('[data-cover-edit="ref:barcard"]').click(); await page.waitForTimeout(700);
    const t = (await page.locator("[data-lp-sheet]").innerText()).replace(/\s+/g, " ");
    ok("REF владелец: в листе выбор — «Вся сеть» или своё заведение; по умолчанию сеть", /Вся сеть/.test(t) && /«Два моря, Океан»/.test(t) && /фото встанет обложкой раздела у всей сети\./.test(t), t);
    await page.locator("[data-lp-pick] input[type=file]").setInputFiles({ name: "bar.jpg", mimeType: "image/jpeg", buffer: PHOTO });
    ok("REF владелец: фото для всей сети встало на «Барную карту»", await waitFor(page, () => { const c2 = document.querySelector('[data-ref-card="barcard"]'); return !!c2 && c2.getAttribute("data-ref-cover") === "own"; }));
    await page.screenshot({ path: join(OUT, "ref-owner.png") });
    await ctx.close(); }
  { const { ctx, page } = await open({ who: "anna", light: true });
    await nav(page, "reference"); await page.waitForTimeout(600);
    const c = await refCards(page);
    ok("REF «Для чтения»: фото на месте, название тёмным по светлому", c.filter((x) => x.cover === "app").length === 2 && c.every((x) => x.title && x.title.size === "20px") && /rgb\(42, 31, 14\)/.test(c[0].title.color), JSON.stringify(c.map((x) => x.title)));
    await page.screenshot({ path: join(OUT, "ref-light.png") });
    await ctx.close(); }
}

// ── MOD ───────────────────────────────────────────────────────────────────────────────────────────────────
const modGeo = (page) => page.evaluate(() => { const m = document.querySelector(".tbp-cur .tbm-menu"); if (!m) return null;
  const cov = m.querySelector(".tbm-cover"), img = cov && cov.querySelector("img"), head = m.querySelector(".tbm-head"), ttl = m.querySelector(".tbm-title"), las = m.querySelector(".tbm-lasse"), cam = m.querySelector("[data-cover-edit]");
  const r = (e) => { const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) }; };
  const top = (e) => { const b = e.getBoundingClientRect(); const x = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(8, b.height / 2)); return !!x && (x === e || e.contains(x)); };
  return { cover: m.getAttribute("data-mod-cover"), title: ttl ? ttl.textContent.trim() : "", menu: r(m), cov: cov ? r(cov) : null, img: img ? img.complete && img.naturalWidth > 0 : null, ttl: ttl ? r(ttl) : null, head: head ? getComputedStyle(head).paddingTop : null,
    lasse: las ? { ...r(las), z: getComputedStyle(las).position } : null, cam: cam ? { id: cam.getAttribute("data-cover-edit"), ...r(cam), hit: top(cam) } : null }; });
if (want("MOD")) {
  { const { ctx, page, errs } = await open({ who: "anna" });
    await nav(page, "home", 2400);
    await waitFor(page, () => { const i = document.querySelector(".tbp-cur .tbm-cover img"); return !!i && i.complete && i.naturalWidth > 0; });
    const g = await modGeo(page);
    ok("MOD: у раздела «Наш ресторан» обложка — фото его урока", !!g && g.title === "Наш ресторан" && g.cover === "lesson" && g.img === true, JSON.stringify(g));
    ok("MOD: фото во всю ширину карточки, сверху, 178 px", !!g && !!g.cov && g.cov.h === 178 && Math.abs(g.cov.w - (g.menu.w - 2)) <= 1 && Math.abs(g.cov.t - (g.menu.t + 1)) <= 1, JSON.stringify(g && [g.cov, g.menu]));
    ok("MOD: название раздела — на нижней, тающей части фото (не выше 90 px от верха) и внутри карточки", !!g && g.head === "84px" && g.ttl.t - g.menu.t >= 90 && g.ttl.b < g.cov.b + 30, JSON.stringify(g && [g.ttl, g.cov]));
    ok("MOD: ленточка на месте", !!g && !!g.lasse && g.lasse.h === 30);
    ok("MOD: у официанта фотоаппарата нет", !!g && !g.cam);
    await page.screenshot({ path: join(OUT, "mod-anna.png") });
    // раздел без фото: «Психология первого дня» в демо с фото урока, поэтому ищем первый раздел без обложки среди страниц трека
    const flat = await page.evaluate(() => [...document.querySelectorAll(".tbm-menu")].map((m) => ({ t: (m.querySelector(".tbm-title") || {}).textContent, c: m.getAttribute("data-mod-cover"), cov: !!m.querySelector(".tbm-cover"), pt: getComputedStyle(m.querySelector(".tbm-head")).paddingTop })));
    ok("MOD: раздел без фото — карточка прежняя (без обложки и без отступа под неё)", flat.some((x) => !x.c && !x.cov && x.pt === "0px"), JSON.stringify(flat));
    ok("MOD: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  { const { ctx, page, errs } = await open({ who: "maria" });
    await nav(page, "home", 2400);
    await waitFor(page, () => { const i = document.querySelector(".tbp-cur .tbm-cover img"); return !!i && i.complete && i.naturalWidth > 0; });
    let g = await modGeo(page);
    ok("MOD менеджер: фотоаппарат справа сверху, левее ленточки, нажимается", !!g && !!g.cam && /^mod:/.test(g.cam.id) && g.cam.hit && g.cam.r <= g.lasse.l && g.cam.w === 34, JSON.stringify(g && [g.cam, g.lasse]));
    const id = g.cam.id;
    await page.locator(`.tbp-cur [data-cover-edit="${id}"]`).click(); await page.waitForTimeout(700);
    const t = await page.locator("[data-lp-sheet]").innerText();
    ok("MOD менеджер: лист «Фото раздела» — про раздел и про то, что сейчас стоит фото урока", /Фото раздела/.test(t) && /Наш ресторан/.test(t) && /Сейчас на обложке фото урока «Концепция и история»\. Своё фото раздела встанет вместо него\./.test(t), t.replace(/\s+/g, " "));
    await page.locator("[data-lp-pick] input[type=file]").setInputFiles({ name: "hall.jpg", mimeType: "image/jpeg", buffer: PHOTO });
    const own = await waitFor(page, () => { const m = document.querySelector(".tbp-cur .tbm-menu"); const i = m && m.querySelector(".tbm-cover img"); return !!m && m.getAttribute("data-mod-cover") === "own" && !!i && i.complete && i.naturalWidth > 0; });
    ok("MOD менеджер: своё фото раздела встало вместо фото урока", own);
    await page.screenshot({ path: join(OUT, "mod-own.png") });
    await page.locator(".tbp-cur .tbm-cur").click(); await page.waitForTimeout(2200);
    const les = await page.evaluate(() => { const c = document.querySelector("[data-lp-cover]"); const i = c && c.querySelector("img"); return { cover: c ? c.getAttribute("data-lp-cover") : null, img: !!i && i.complete && i.naturalWidth > 0, t: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 120) }; });
    ok("MOD менеджер: у урока «Концепция и история» фото своё, как было (обложка раздела его не трогает)", /Концепция и история/.test(les.t) && les.cover === "net" && les.img, JSON.stringify(les));
    ok("MOD менеджер: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  { const { ctx, page } = await open({ who: "anna", light: true });
    await nav(page, "home", 2400);
    await waitFor(page, () => { const i = document.querySelector(".tbp-cur .tbm-cover img"); return !!i && i.complete && i.naturalWidth > 0; });
    const g = await modGeo(page);
    const veil = await page.evaluate(() => getComputedStyle(document.querySelector(".tbp-cur .tbm-cover"), "::after").backgroundImage);
    ok("MOD «Для чтения»: обложка есть, фото гаснет в светлое", !!g && g.cover === "lesson" && /248, 241, 226/.test(veil), veil.slice(0, 120));
    await page.screenshot({ path: join(OUT, "mod-light.png") });
    await ctx.close(); }
}

// ── ME ────────────────────────────────────────────────────────────────────────────────────────────────────
const shelf = (page) => page.evaluate(() => { const s = document.querySelector("[data-me-shelf]"); if (!s) return null;
  const r = s.getBoundingClientRect();
  return { t: (s.innerText || "").replace(/\s+/g, " "), top: Math.round(r.top), h: Math.round(r.height), lens: s.hasAttribute("data-lens-card"),
    badges: [...s.querySelectorAll("[data-me-badge]")].map((b) => ({ id: b.getAttribute("data-me-badge"), tier: Number(b.getAttribute("data-me-tier")), w: Math.round(b.querySelector("svg").getBoundingClientRect().width), label: b.querySelector("svg").getAttribute("aria-label") })),
    days: [...s.querySelectorAll("[data-me-day]")].map((d) => d.getAttribute("data-me-day")), dows: [...s.querySelectorAll("[data-me-day]")].map((d) => d.textContent.trim()),
    note: (s.querySelector("[data-me-week-note]") || {}).textContent, noteH: Math.round(s.querySelector("[data-me-week-note]").getBoundingClientRect().height),
    hero: Math.round([...document.querySelectorAll("[data-lens-card]")].find((d) => /уроков/.test(d.innerText || "")).getBoundingClientRect().bottom) }; });
if (want("ME")) {
  { const { ctx, page, errs } = await open({ who: "anna" });
    await nav(page, "me");
    const s = await shelf(page);
    ok("ME: под кольцом прогресса — карточка «Мои значки · 1 из 14»", !!s && s.lens && /Мои значки/.test(s.t) && /1 из 14/.test(s.t) && s.top > s.hero, JSON.stringify(s && [s.t, s.top, s.hero]));
    ok("ME: пять значков, первый — полученная «Свеча» (бронза), остальные — ещё не получены", !!s && s.badges.length === 5 && s.badges[0].id === "streak" && s.badges[0].tier === 1 && /Свеча — бронза/.test(s.badges[0].label) && s.badges.slice(1).every((b) => b.tier === 0 && /ещё не получен/.test(b.label)), JSON.stringify(s && s.badges));
    ok("ME: значки — 52 px", !!s && s.badges.every((b) => b.w === 52));
    ok("ME: неделя с понедельника: ср, чт, пт — отмечены, суббота — сегодня, воскресенье — впереди", !!s && s.dows.join() === "пн,вт,ср,чт,пт,сб,вс" && s.days.join() === "past,past,done,done,done,today,ahead", JSON.stringify(s && [s.dows, s.days]));
    ok("ME: подпись — «сегодня будет 4-й подряд», «4-й подряд» не разорвано", !!s && s.note.replace(/ /g, " ") === "сегодня будет 4-й подряд" && s.noteH <= 32, JSON.stringify(s && [s.note, s.noteH]));
    await page.screenshot({ path: join(OUT, "me-anna.png") });
    await page.locator("[data-me-shelf]").click(); await page.waitForTimeout(1500);
    ok("ME: тап по полке — «Путь мастера»", /Путь мастера/.test(await txt(page)) && /Главная награда/.test(await txt(page)));
    ok("ME: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  { const { ctx, page } = await open({ who: "anna", light: true });
    await nav(page, "me");
    const s = await shelf(page);
    ok("ME «Для чтения»: полка на месте, те же пять значков и неделя", !!s && s.badges.length === 5 && s.days.length === 7);
    await page.screenshot({ path: join(OUT, "me-light.png") });
    await ctx.close(); }
}

// ── SHIFT ─────────────────────────────────────────────────────────────────────────────────────────────────
const crew = (page) => page.evaluate(() => { const hero = [...document.querySelectorAll("[data-lens-card]")].find((d) => /^Сегодня ·/.test((d.innerText || "").trim())); if (!hero) return null;
  const m = hero.querySelector("[data-shift-mates]");
  return { t: (hero.innerText || "").replace(/\s+/g, " "), n: m ? Number(m.getAttribute("data-shift-mates")) : null,
    discs: m ? [...m.querySelectorAll("[data-mate]")].map((d) => ({ k: d.getAttribute("data-mate"), t: d.textContent.trim(), w: Math.round(d.getBoundingClientRect().width), lens: d.getAttribute("data-lens") })) : [],
    names: m ? m.querySelector("[data-shift-mates-names]").textContent.replace(/ /g, " ") : "", note: m ? m.querySelector("[data-shift-mates-note]").textContent.replace(/ /g, " ") : "" }; });
if (want("SHIFT")) {
  { const { ctx, page, errs } = await open({ who: "anna" });
    await nav(page, "shift");
    const c = await crew(page);
    ok("SHIFT: у Анны — кружки коллег и имена: старшая Мария первой", !!c && c.n === 4 && c.discs.map((d) => d.t).join() === "МК,ДЛ,+2" && c.discs[0].k === "lead" && c.names === "Мария, Дарья и ещё 2", JSON.stringify(c));
    ok("SHIFT: подпись — «с тобой сегодня · Мария старшая»; строки «Тап покажет…» нет", !!c && c.note === "с тобой сегодня · Мария старшая" && !/Тап покажет/.test(c.t), c && c.t);
    ok("SHIFT: кружки — линзы 34 и 30 px", !!c && c.discs[0].w === 34 && c.discs[1].w === 30 && c.discs.every((d) => d.lens === "disc"));
    await page.screenshot({ path: join(OUT, "shift-anna.png") });
    await page.locator("[data-shift-mates]").click(); await page.waitForTimeout(1800);
    ok("SHIFT: тап — «График», как раньше", /График/.test(await txt(page)) && /Ноябрь/.test(await txt(page)));
    ok("SHIFT: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  { const { ctx, page } = await open({ who: "maria" });
    await nav(page, "shift");
    const c = await crew(page);
    ok("SHIFT менеджер: «с тобой сегодня · ты за старшего», старшего среди кружков нет", !!c && c.n === 4 && c.note === "с тобой сегодня · ты за старшего" && c.discs.every((d) => d.k !== "lead") && /^Анна, /.test(c.names), JSON.stringify(c));
    await ctx.close(); }
  { const { ctx, page } = await open({ who: "roman" });
    await nav(page, "shift");
    const c = await crew(page);
    ok("SHIFT владелец без смены: «Сегодня смен нет», кружков нет", !!c && c.n === null && /Сегодня смен нет/.test(c.t), c && c.t);
    await ctx.close(); }
  { const { ctx, page } = await open({ who: "anna", noSched: true });
    await nav(page, "shift");
    const c = await crew(page);
    ok("SHIFT: копии графика на телефоне нет — прежняя строка «Тап покажет, кто в смене с тобой и кто старший»", !!c && c.n === null && /Тап покажет, кто в смене с тобой и кто старший/.test(c.t), c && c.t);
    await ctx.close(); }
  { const { ctx, page } = await open({ who: "anna", light: true });
    await nav(page, "shift");
    const c = await crew(page);
    ok("SHIFT «Для чтения»: те же кружки и подписи", !!c && c.n === 4 && c.names === "Мария, Дарья и ещё 2");
    await page.screenshot({ path: join(OUT, "shift-light.png") });
    await ctx.close(); }
}

// ── EVE ───────────────────────────────────────────────────────────────────────────────────────────────────
const eve = (page) => page.evaluate(() => { const l = document.querySelector("[data-eve-lights]"); const logo = document.querySelector("[data-home-logo]");
  const bg = [...document.querySelectorAll("div")].filter((d) => (d.getAttribute("style") || "").includes("130% 80% at 50% -5%")).map((d) => getComputedStyle(d).backgroundImage).join(" | ");
  const out = { mode: l ? l.getAttribute("data-eve-lights") : null, bg, logoPos: logo ? getComputedStyle(logo.parentElement).position : null };
  if (!l) return out;
  const r = l.getBoundingClientRect(), lr = logo.getBoundingClientRect(), strip = document.querySelector("[data-day-chips]").getBoundingClientRect();
  const dots = [...l.children].map((i) => { const b = i.getBoundingClientRect(), cs = getComputedStyle(i); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2), w: Math.round(b.width), anim: cs.animationName, bg: cs.backgroundImage.slice(0, 60) }; });
  // логотип над огнями: в центре логотипа верхний элемент — сам логотип
  const e = document.elementFromPoint(lr.left + lr.width / 2, lr.top + lr.height / 2);
  return { ...out, n: dots.length, dots, bottom: Math.round(r.bottom), strip: Math.round(strip.top), pe: getComputedStyle(l).pointerEvents, hidden: l.getAttribute("aria-hidden"), logoTop: e === logo,
    overLogo: dots.filter((d) => d.x > lr.left + 20 && d.x < lr.right - 20 && d.y > lr.top + 20 && d.y < lr.bottom - 20 && d.w > 16).length, red: dots.filter((d) => !/rgba\(2[34]\d, (19\d|2[0-2]\d), 1[2-7]\d/.test(d.bg)).length }; });
if (want("EVE")) {
  let dayBg = "";
  { const { ctx, page } = await open({ who: "anna" });
    await nav(page, "roleSelect", 1500);
    const e = await eve(page); dayBg = e.bg;
    ok("EVE: днём (11:00) огней нет, логотип стоит как раньше", e.mode === null && e.logoPos === "static", JSON.stringify(e).slice(0, 200));
    await ctx.close(); }
  { const { ctx, page, errs } = await open({ who: "anna", hour: 19, minute: 30 });
    await nav(page, "roleSelect", 1500);
    const e = await eve(page);
    ok("EVE: в 19:30 — огни вокруг логотипа: десять, слой не ловит касания и скрыт от чтения вслух", e.mode === "evening" && e.n === 10 && e.pe === "none" && e.hidden === "true", JSON.stringify(e).slice(0, 300));
    ok("EVE: фон приложения тот же, что днём (рыжего света снизу нет)", !!dayBg && e.bg === dayBg, e.bg.slice(0, 200));
    ok("EVE: огни золотом приложения, не рыжие", e.red === 0, JSON.stringify(e.dots.map((d) => d.bg)));
    ok("EVE: слой кончается у таблички дня — карточек не касается", e.bottom <= e.strip + 12, e.bottom + " / " + e.strip);
    ok("EVE: логотип над огнями; крупных огней поверх фигуры нет", e.logoTop && e.logoPos === "relative" && e.overLogo === 0, JSON.stringify([e.logoTop, e.logoPos, e.overLogo]));
    ok("EVE: огни дышат (анимация saEvl)", e.dots.every((d) => d.anim === "saEvl"));
    ok("EVE: приветствие — «Добрый вечер»", /Добрый вечер, Анна/.test(await txt(page)));
    await page.screenshot({ path: join(OUT, "eve-1930.png") });
    ok("EVE: без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close(); }
  { const { ctx, page } = await open({ who: "anna", hour: 1, minute: 20 });
    await nav(page, "roleSelect", 1500);
    const e = await eve(page);
    ok("EVE: ночью (01:20) огней меньше — четыре", e.mode === "night" && e.n === 4, JSON.stringify([e.mode, e.n]));
    await page.screenshot({ path: join(OUT, "eve-night.png") });
    await ctx.close(); }
  { const { ctx, page } = await open({ who: "anna", hour: 19, minute: 30, light: true });
    await nav(page, "roleSelect", 1500);
    const e = await eve(page);
    ok("EVE «Для чтения»: вечером огней нет", e.mode === null);
    await ctx.close(); }
  { const { ctx, page } = await open({ who: "anna", hour: 19, minute: 30, reduced: true });
    await nav(page, "roleSelect", 1500);
    const e = await eve(page);
    ok("EVE «меньше движения»: огни есть, но стоят", e.mode === "evening" && e.dots.every((d) => d.anim === "none"), JSON.stringify(e.dots.map((d) => d.anim)));
    await ctx.close(); }
}

// ── NARROW ────────────────────────────────────────────────────────────────────────────────────────────────
if (want("NARROW")) {
  const { ctx, page, errs } = await open({ who: "maria", width: 320, height: 640 });
  for (const sc of ["reference", "home", "me", "shift"]) {
    await nav(page, sc, 2200);
    ok("NARROW 320: «" + sc + "» — без прокрутки вбок", (await overflowX(page)) <= 0, String(await overflowX(page)));
    await page.screenshot({ path: join(OUT, "narrow-" + sc + ".png") });
  }
  const c = await page.evaluate(() => { const m = document.querySelector("[data-shift-mates]"); if (!m) return null; const r = m.getBoundingClientRect(), h = m.parentElement.getBoundingClientRect(); return { in: r.right <= h.right + 0.5, n: m.querySelector("[data-shift-mates-names]").getBoundingClientRect().right <= h.right + 0.5 }; });
  ok("NARROW 320: «кто со мной» не выходит за карточку", !!c && c.in && c.n, JSON.stringify(c));
  await nav(page, "me");
  const w = await page.evaluate(() => { const s = document.querySelector("[data-me-shelf]"); const days = [...s.querySelectorAll("[data-me-day]")]; const r = s.getBoundingClientRect(); return { n: days.length, in: days.every((d) => d.getBoundingClientRect().right <= r.right - 8), badges: [...s.querySelectorAll("[data-me-badge]")].every((b) => b.getBoundingClientRect().right <= r.right - 8) }; });
  ok("NARROW 320: полка — значки и семь дней внутри карточки", w.n === 7 && w.in && w.badges, JSON.stringify(w));
  ok("NARROW 320: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log("итог: " + pass + " прошло, " + fail + " упало");
process.exit(fail ? 1 : 0);
