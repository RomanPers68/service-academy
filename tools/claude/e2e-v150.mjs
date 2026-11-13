// e2e v150 (Доп. 474): визуал без кардинальных изменений. Сайт — демо целиком (tools/claude/demo-app/build.mjs: сервер
// в странице, люди демо; экран открывает window.__saNav, урок — window.__saLesson).
// Разделы: HUBS (у заголовков «Смена» и «Команда» — значок вкладки в линзе 44 px, у «Я» — инициалы; логотипа 44×36 нет),
// TILES (плитки модуля «Я это умею» и др. и «Погреб тем» — шрифтом текста, с засечками), BULLETS (список «•»: перенесённая
// строка — под текстом, а не под точкой; урок и «О нас»), TIES (тире не начинает строку, «3 см» не разрывается: в тексте
// урока и «О нас» перед «—» и после коротких слов — неразрывный пробел), SEARCH (на странице трека одна лупа — в верхней
// панели; подпись трека видна целиком), LIGHT («Для чтения»: «Выйти с этого устройства» и зелёные числа «Меню» — контраст
// от 4,5), STAMPS (пустые печати «Книги отзывов» в тёмной — с тонким золотым кольцом, размер 13 px), NARROW (320 px).
// Запуск: E2E_SITE=<демо> E2E_PORT=<порт> E2E_OUT=<папка снимков> node e2e-v150.mjs [разделы]
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = process.env.E2E_SITE || "/home/claude/preview/demo", PORT = Number(process.env.E2E_PORT) || 5350, OUT = process.env.E2E_OUT || "/home/claude/preview/shots-v150";
mkdirSync(OUT, { recursive: true });
const ONLY = new Set(process.argv.slice(2));
const want = (k) => !ONLY.size || ONLY.has(k);
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

const boot = async (page, errs) => {
  await page.waitForFunction(() => !document.getElementById("sa-splash"), null, { timeout: 25000 }).catch(() => errs.push("заставка не ушла"));
  await page.waitForTimeout(1500);
  await page.evaluate(() => localStorage.setItem("sa_lesson_cards", "0"));
  await page.evaluate(() => { setInterval(() => { const b = document.querySelector("[data-ms-moment] [data-sa-back], .ms-toast [data-lens-x]"); if (b) b.click();
    const g = [...document.querySelectorAll("#demo-tgchat button, #demo-tgchat [role=button]")].find((x) => /Готово/.test(x.textContent)); if (g) g.click(); }, 150); });
  await page.addStyleTag({ content: "#demo-tg{display:none!important}" });
};
async function open({ who = "anna", light = false, width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: "dark", timezoneId: "Asia/Kamchatka" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL0, { waitUntil: "load" });
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem("__demo_who", w); }, who);
  await page.goto(URL0, { waitUntil: "load" });
  await boot(page, errs);
  if (light) { await page.getByText("Для чтения").first().click().catch(() => errs.push("нет «Для чтения»")); await page.waitForTimeout(1200); }
  return { ctx, page, errs };
}
const nav = async (page, s, ms = 1600) => { await page.evaluate((n) => window.__saNav && window.__saNav(n), s); await page.waitForTimeout(ms);
  await page.evaluate(() => { const r = document.getElementById("root"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); }); await page.waitForTimeout(250); };
const lesson = async (page, id, ms = 2200) => { await page.evaluate((x) => window.__saLesson && window.__saLesson(x), id); await page.waitForTimeout(ms); };
const overflowX = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);

// заголовок хаба: значок и надпись
const hubHead = (page) => page.evaluate(() => {
  const m = document.querySelector("[data-hub-mark]");
  if (!m) return { mark: null, img: !!document.querySelector("img[src*='logo']") };
  const r = m.getBoundingClientRect(), cs = getComputedStyle(m);
  const row = m.parentElement, img = row ? row.querySelector("img") : null;
  return { mark: m.getAttribute("data-hub-mark"), w: Math.round(r.width), h: Math.round(r.height), left: r.left, right: r.right, round: cs.borderRadius, svg: !!m.querySelector("svg"),
    text: m.textContent.trim(), img: !!img, lens: m.getAttribute("data-lens"), ink: m.firstElementChild ? getComputedStyle(m.firstElementChild).color : null,
    stroke: m.querySelector("svg") ? m.querySelector("svg").getAttribute("stroke") : null };
});
// кружок сотрудника («Аккаунт», карточка сотрудника): линза, буквы или корона — золотом
const avatarOf = (page, sel) => page.evaluate((s) => {
  const m = document.querySelector(s);
  if (!m) return null;
  const r = m.getBoundingClientRect(), cs = getComputedStyle(m), svg = m.querySelector("svg");
  return { lens: m.getAttribute("data-lens"), w: Math.round(r.width), h: Math.round(r.height), text: m.textContent.trim(), ink: m.firstElementChild ? getComputedStyle(m.firstElementChild).color : null,
    stroke: svg ? svg.getAttribute("stroke") : null, grad: /gradient/.test(cs.backgroundImage) && !document.documentElement.classList.contains("sa-lens") };
}, sel);
// список «•»: где начинается перенесённая строка — под текстом или под точкой
const bulletGeo = (page, scope) => page.evaluate((sc) => {
  const root = document.querySelector(sc) || document;
  const els = [...root.querySelectorAll("div")].filter((d) => /^•/.test((d.textContent || "").trim()) && parseFloat(getComputedStyle(d).textIndent) < 0);
  const out = [];
  for (const el of els) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const chars = []; let n;
    while ((n = w.nextNode())) for (let i = 0; i < n.textContent.length; i++) chars.push([n, i]);
    const txt = chars.map(([nn, i]) => nn.textContent[i]).join("");
    const rectAt = (k) => { const r = document.createRange(); r.setStart(chars[k][0], chars[k][1]); r.setEnd(chars[k][0], chars[k][1] + 1); const rs = r.getClientRects(); return rs.length ? rs[0] : r.getBoundingClientRect(); };
    const kb = txt.indexOf("•"); if (kb < 0) continue;
    let k0 = kb + 1; while (k0 < txt.length && /\s/.test(txt[k0])) k0++;
    if (k0 >= txt.length) continue;
    const rb = rectAt(kb), r0 = rectAt(k0);
    let k1 = -1; for (let k = k0 + 1; k < chars.length; k++) { if (/\s/.test(txt[k])) continue; const r = rectAt(k); if (r.top > r0.top + r0.height * 0.6) { k1 = k; break; } }
    out.push({ t: txt.slice(0, 50), wrapped: k1 >= 0, bulletX: Math.round(rb.left * 10) / 10, textX: Math.round(r0.left * 10) / 10, line2X: k1 >= 0 ? Math.round(rectAt(k1).left * 10) / 10 : null });
  }
  return out;
}, scope);
// тире: перед ним в тексте — неразрывный пробел; на экране — не первое в строке
const dashGeo = (page, scope) => page.evaluate((sc) => {
  const roots = [...document.querySelectorAll(sc)];
  let plain = 0, nbsp = 0, lineStart = 0; const bad = [];
  for (const root of roots) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const chars = []; let n;
    while ((n = w.nextNode())) { if (n.parentElement && n.parentElement.closest("[data-lesson-tip], button, svg")) continue; for (let i = 0; i < n.textContent.length; i++) chars.push([n, i]); }
    const txt = chars.map(([nn, i]) => nn.textContent[i]).join("");
    const rectAt = (k) => { const r = document.createRange(); r.setStart(chars[k][0], chars[k][1]); r.setEnd(chars[k][0], chars[k][1] + 1); const rs = r.getClientRects(); return rs.length ? rs[0] : r.getBoundingClientRect(); };
    for (let k = 1; k < txt.length; k++) {
      if (txt[k] !== "—") continue;
      if (txt[k - 1] === " ") { plain++; bad.push(txt.slice(Math.max(0, k - 18), k + 10)); }
      if (txt[k - 1] === " ") {
        nbsp++;
        let p = k - 2; while (p >= 0 && /\s/.test(txt[p])) p--;
        if (p >= 0) { const a = rectAt(p), b = rectAt(k); if (b.top > a.top + a.height * 0.6) { lineStart++; bad.push("строка с тире: " + txt.slice(Math.max(0, k - 18), k + 10)); } }
      }
    }
  }
  return { plain, nbsp, lineStart, bad: bad.slice(0, 6) };
}, scope);
// контраст текста с учётом полупрозрачных подложек (как contrast-scan)
const contrastOf = (page, sel, textRe) => page.evaluate(([s, re]) => {
  const parse = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(",").map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const light = document.documentElement.classList.contains("sa-light");
  const base = light ? { r: 224, g: 209, b: 188, a: 1 } : { r: 24, g: 19, b: 12, a: 1 };   // светлая: самый тёмный фон у кнопок «Аккаунта» на снимке
  const bgOf = (el) => { const layers = []; let e = el; while (e && e !== document.documentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 0.99) break; } e = e.parentElement; } let bg = base; for (let i = layers.length - 1; i >= 0; i--) bg = blend(layers[i], bg); return bg; };
  const rx = new RegExp(re);
  const el = [...document.querySelectorAll(s)].find((x) => rx.test(x.textContent || ""));
  if (!el) return null;
  const fg = parse(getComputedStyle(el).color), bg = bgOf(el);
  return { color: getComputedStyle(el).color, ratio: Math.round(ratio(blend(fg, bg), bg) * 100) / 100 };
}, [sel, textRe.source]);

// ── HUBS ───────────────────────────────────────────────────────────────────────────────────────
if (want("HUBS")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await nav(page, "shift");
  const sh = await hubHead(page);
  ok("HUBS: «Смена» — значок вкладки в линзе 44 px вместо логотипа", sh.mark === "shift" && sh.lens === "disc" && sh.w === 44 && sh.h === 44 && sh.svg && !sh.img, JSON.stringify(sh));
  await page.screenshot({ path: join(OUT, "hub-shift.png"), clip: { x: 0, y: 0, width: 390, height: 200 } });
  await nav(page, "teamHub");
  const tm = await hubHead(page);
  ok("HUBS: «Команда» — значок вкладки в линзе", tm.mark === "team" && tm.lens === "disc" && tm.svg && !tm.img, JSON.stringify(tm));
  await nav(page, "me");
  const me = await hubHead(page);
  ok("HUBS: «Я» — инициалы «АС» золотом в такой же линзе 44 px, как «Смена» и «Команда»", me.mark === "avatar" && me.lens === "disc" && me.text === "АС" && me.w === 44 && me.h === 44 && /210, 168, 90/.test(String(me.ink)) && !me.img, JSON.stringify(me));
  await page.screenshot({ path: join(OUT, "hub-me.png"), clip: { x: 0, y: 0, width: 390, height: 200 } });
  await nav(page, "profile", 1800);
  const acc = await avatarOf(page, "[data-account-avatar]");
  ok("HUBS: «Аккаунт» — тоже линза 54 px, «АС» золотом (был золотой круг с белыми буквами)", !!acc && acc.lens === "disc" && acc.w === 54 && acc.h === 54 && acc.text === "АС" && /210, 168, 90/.test(String(acc.ink)), JSON.stringify(acc));
  await page.screenshot({ path: join(OUT, "account-avatar.png"), clip: { x: 0, y: 0, width: 390, height: 260 } });
  ok("HUBS: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
  // владелец: корона, как в «Аккаунте»
  const o = await open({ who: "roman" });
  await nav(o.page, "me");
  const ro = await hubHead(o.page);
  const adm = await o.page.evaluate(() => { try { const k = Object.keys(localStorage).find((x) => /profile/.test(x)); return k ? JSON.parse(localStorage.getItem(k)) : null; } catch (e) { return null; } });
  ok("HUBS: «Я» у Романа — знак в линзе (у владельца — золотая корона, иначе инициалы)", ro.mark === "avatar" && ro.lens === "disc" && ((ro.svg && ro.stroke === "#D2A85A") || /^[А-ЯЁA-Z]{1,2}$/.test(ro.text)), JSON.stringify({ ro, adm: adm && adm.is_admin }));
  await nav(o.page, "profile", 1800);
  const racc = await avatarOf(o.page, "[data-account-avatar]");
  ok("HUBS: «Аккаунт» владельца — линза с золотой короной", !!racc && racc.lens === "disc" && racc.stroke === "#D2A85A", JSON.stringify(racc));
  // карточка сотрудника у руководителя (владелец: «Команда» → «Сотрудники» → Анна)
  await nav(o.page, "team", 2500);
  await o.page.evaluate(() => { const r = [...document.querySelectorAll(".sa-btn[data-lens-card]")].find((x) => /Анна Смирнова/.test(x.textContent)); if (r) r.click(); });
  await o.page.waitForTimeout(1200);
  const st = await avatarOf(o.page, '[data-lens-card] > [data-lens="disc"]');
  ok("HUBS: карточка сотрудника — линза 50 px, «АС» золотом", !!st && st.lens === "disc" && st.w === 50 && st.text === "АС" && /210, 168, 90/.test(String(st.ink)), JSON.stringify(st));
  await o.page.screenshot({ path: join(OUT, "staff-card.png"), clip: { x: 0, y: 0, width: 390, height: 300 } });
  ok("HUBS: Роман — без ошибок страницы", !o.errs.length, o.errs.join(" | "));
  await o.ctx.close();
}

// ── TILES ──────────────────────────────────────────────────────────────────────────────────────
if (want("TILES")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await nav(page, "home", 2500);
  const f = await page.evaluate(() => {
    const acts = [...document.querySelectorAll(".tbm-act")].map((b) => getComputedStyle(b).fontFamily);
    const cellar = document.querySelector(".tbm-cellar");
    const css = [...document.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    return { acts, cellar: cellar ? getComputedStyle(cellar).fontFamily : null,
      cellarRule: /\.tbm-cellar\{[^}]*font:600 14px\/1\.2 var\(--font-body\)/.test(css), actRule: /\.tbm-act\{[^}]*font-family:var\(--font-body\)/.test(css),
      peekRule: /\.tbp-peek span\{[^}]*font:italic 12\.5px\/1\.3 Georgia/.test(css) };
  });
  ok("TILES: плитки «Я это умею» на странице трека — Georgia (были системным шрифтом)", f.acts.length > 0 && f.acts.every((x) => /Georgia/.test(x)), JSON.stringify(f.acts));
  ok("TILES: правила: .tbm-act и «Погреб тем» — var(--font-body), подсказка к теме — курсив с засечками", f.actRule && f.cellarRule && f.peekRule && (!f.cellar || /Georgia/.test(f.cellar)), JSON.stringify(f));
  await page.evaluate(() => { const a = document.querySelector(".tbm-actrow, .tbm-act"); if (a) a.scrollIntoView({ block: "center" }); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "tiles.png") });
  ok("TILES: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── BULLETS и TIES ─────────────────────────────────────────────────────────────────────────────
if (want("BULLETS") || want("TIES")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await lesson(page, "s0-1");
  const bl = await bulletGeo(page, "[data-lesson-glass]");
  const wr = bl.filter((x) => x.wrapped);
  if (want("BULLETS")) {
    ok("BULLETS: в уроке «Первый день» есть пункты «•» в две строки", wr.length >= 2, JSON.stringify(bl.slice(0, 4)));
    ok("BULLETS: урок — перенесённая строка начинается под текстом пункта, не под точкой", wr.length > 0 && wr.every((x) => Math.abs(x.line2X - x.textX) <= 3 && x.line2X > x.bulletX + 3), JSON.stringify(wr));
  }
  if (want("TIES")) {
    const d = await dashGeo(page, "[data-lesson-glass]");
    ok("TIES: урок — перед тире неразрывный пробел, тире не начинает строку («тебя — временно»)", d.plain === 0 && d.nbsp > 3 && d.lineStart === 0, JSON.stringify(d));
    const tx = await page.evaluate(() => (document.querySelector("[data-lesson-glass]") || {}).textContent || "");
    ok("TIES: урок — «тебя — временно» и «В голове»", tx.includes("тебя — временно") && /В голове/.test(tx), JSON.stringify(tx.slice(tx.indexOf("тебя") - 5, tx.indexOf("тебя") + 30)));
    // термины урока (подсветка) по-прежнему находятся: строки ищутся по исходному тексту
    await lesson(page, "s5-2");
    const terms = await page.evaluate(() => [...document.querySelectorAll("[data-lesson-glass] span")].filter((s) => /dotted/.test(getComputedStyle(s).borderBottomStyle + getComputedStyle(s).borderBottom)).map((s) => s.textContent).slice(0, 5));
    ok("TIES: термины в уроке по-прежнему подсвечены («целиакия»)", terms.some((t) => /целиак/i.test(t)), JSON.stringify(terms));
    const tx2 = await page.evaluate(() => (document.querySelector("[data-lesson-glass]") || {}).textContent || "");
    ok("TIES: «и подтверждённые» — короткое слово не висит в конце строки", tx2.includes("и подтверждённые"), "");
  }
  await page.screenshot({ path: join(OUT, "lesson-s5-2.png") });
  // «О нас»
  await nav(page, "about", 2200);
  const ab = await bulletGeo(page, "#root");
  const awr = ab.filter((x) => x.wrapped);
  if (want("BULLETS")) ok("BULLETS: «О нас» — перенесённая строка под текстом пункта", awr.length >= 2 && awr.every((x) => Math.abs(x.line2X - x.textX) <= 3 && x.line2X > x.bulletX + 3), JSON.stringify(awr.slice(0, 4)));
  if (want("TIES")) {
    const d2 = await dashGeo(page, "[data-cn-block]");
    const t3 = await page.evaluate(() => [...document.querySelectorAll("[data-cn-block]")].map((b) => b.textContent).join("\n"));
    ok("TIES: «О нас» — «3 см» вместе, тире не начинает строку", t3.includes("3 см") && !/3 см/.test(t3) && d2.plain === 0 && d2.lineStart === 0, JSON.stringify(d2));
  }
  await page.evaluate(() => { const el = [...document.querySelectorAll("[data-cn-block]")].find((b) => /каблука/.test(b.textContent)); if (el) el.scrollIntoView({ block: "center" }); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "about-bullets.png") });
  ok("BULLETS/TIES: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── SEARCH ─────────────────────────────────────────────────────────────────────────────────────
if (want("SEARCH")) {
  const { ctx, page, errs } = await open({ who: "anna" });
  await nav(page, "home", 2500);
  const s = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
    const btns = [...new Set([...document.querySelectorAll('[data-top-search], button[aria-label="Поиск"]')])].filter(vis);
    const chip = [...document.querySelectorAll("span")].find((x) => x.textContent === "Сезонный сотрудник");
    return { n: btns.length, top: btns.filter((b) => b.hasAttribute("data-top-search")).length, chip: chip ? { sw: chip.scrollWidth, cw: chip.clientWidth } : null };
  });
  ok("SEARCH: на странице трека одна лупа — в верхней панели (было две рядом)", s.n === 1 && s.top === 1, JSON.stringify(s));
  ok("SEARCH: подпись трека «Сезонный сотрудник» видна целиком (без многоточия)", !!s.chip && s.chip.sw <= s.chip.cw + 1, JSON.stringify(s.chip));
  await page.locator("[data-top-search]").first().click();
  await page.waitForTimeout(1200);
  const inSearch = await page.evaluate(() => !!document.querySelector('input[placeholder="Блюдо, аллерген, вино, коктейль…"]'));
  ok("SEARCH: лупа верхней панели открывает поиск", inSearch);
  await page.screenshot({ path: join(OUT, "track-head.png"), clip: { x: 0, y: 0, width: 390, height: 260 } });
  ok("SEARCH: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

// ── LIGHT ──────────────────────────────────────────────────────────────────────────────────────
if (want("LIGHT")) {
  const { ctx, page, errs } = await open({ who: "anna", light: true });
  await nav(page, "profile", 2000);
  const out = await contrastOf(page, "button", /^\s*Выйти с этого устройства\s*$/);
  ok("LIGHT: «Выйти с этого устройства» — тёмно-красный, контраст от 4,5", !!out && out.ratio >= 4.5 && /139, 48, 32/.test(out.color), JSON.stringify(out));
  await page.getByText("Выйти с этого устройства").first().click();
  await page.waitForTimeout(500);
  const yes = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /^\s*Выйти\s*$/.test(x.textContent)); return b ? getComputedStyle(b).backgroundColor : null; });
  ok("LIGHT: «Выйти» в подтверждении — на тёмно-красном (белый текст читается)", /139, 48, 32/.test(String(yes)), String(yes));
  await page.screenshot({ path: join(OUT, "logout-light.png") });
  await nav(page, "menuTrainer", 2200);
  const g1 = await contrastOf(page, "b", /^\d+$/);
  const greens = await page.evaluate(() => [...document.querySelectorAll("b")].filter((b) => /^\d+$/.test(b.textContent)).map((b) => getComputedStyle(b).color));
  ok("LIGHT: «Меню» — зелёные числа (с сервера команды, пищевая ценность) тёмно-зелёные", greens.filter((c) => /42, 107, 69/.test(c)).length >= 2 && !greens.some((c) => /93, 187, 138/.test(c)), JSON.stringify(greens));
  const g2 = await page.evaluate(() => { const b = [...document.querySelectorAll("b")].find((x) => /^\d+$/.test(x.textContent) && /42, 107, 69/.test(getComputedStyle(x).color)); if (!b) return null; b.setAttribute("data-e2e-green", ""); return true; });
  const gc = g2 ? await contrastOf(page, "[data-e2e-green]", /\d/) : null;
  ok("LIGHT: контраст зелёных чисел от 4,5 (было ≈1,8)", !!gc && gc.ratio >= 4.5, JSON.stringify({ g1, gc }));
  await page.screenshot({ path: join(OUT, "menu-light.png"), clip: { x: 0, y: 0, width: 390, height: 300 } });
  await nav(page, "me", 1800);
  const ml = await hubHead(page);
  ok("LIGHT: «Я» — линза, инициалы тёмным золотом (#7A5D2A)", ml.mark === "avatar" && ml.lens === "disc" && /122, 93, 42/.test(String(ml.ink)), JSON.stringify(ml));
  await page.screenshot({ path: join(OUT, "hub-me-light.png"), clip: { x: 0, y: 0, width: 390, height: 200 } });
  await nav(page, "profile", 1800);
  const la = await avatarOf(page, "[data-account-avatar]");
  ok("LIGHT: «Аккаунт» — линза, «АС» тёмным золотом", !!la && la.lens === "disc" && /122, 93, 42/.test(String(la.ink)), JSON.stringify(la));
  ok("LIGHT: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
  // тёмная — как была
  const d = await open({ who: "anna" });
  await nav(d.page, "profile", 2000);
  const dk = await d.page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Выйти с этого устройства/.test(x.textContent)); return b ? getComputedStyle(b).color : null; });
  ok("LIGHT: в тёмной «Выйти» — прежний красный", /224, 120, 120/.test(String(dk)), String(dk));
  await nav(d.page, "menuTrainer", 2000);
  const dg = await d.page.evaluate(() => [...document.querySelectorAll("b")].filter((b) => /^\d+$/.test(b.textContent)).map((b) => getComputedStyle(b).color));
  ok("LIGHT: в тёмной числа «Меню» — прежний зелёный", dg.some((c) => /93, 187, 138/.test(c)), JSON.stringify(dg));
  ok("LIGHT: тёмная — без ошибок страницы", !d.errs.length, d.errs.join(" | "));
  await d.ctx.close();
}

// ── STAMPS ─────────────────────────────────────────────────────────────────────────────────────
if (want("STAMPS")) {
  for (const light of [false, true]) {
    const { ctx, page, errs } = await open({ who: "anna", light });
    await nav(page, "roleSelect", 2200);
    const st = await page.evaluate(() => [...document.querySelectorAll("[data-seal-empty]")].map((e) => { const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), bw: cs.borderTopWidth, bc: cs.borderTopColor, bs: cs.borderTopStyle }; }));
    if (!light) ok("STAMPS: тёмная — пустые печати с тонким золотым кольцом, 13 px", st.length >= 3 && st.every((x) => x.w === 13 && x.h === 13 && x.bw === "1px" && x.bs === "solid" && /200, 169, 110/.test(x.bc)), JSON.stringify(st.slice(0, 2)));
    else ok("STAMPS: светлая — пустые печати как были (без кольца), 13 px", st.length >= 3 && st.every((x) => x.w === 13 && x.bs === "none"), JSON.stringify(st.slice(0, 2)));
    const tile = await page.evaluate(() => { const el = [...document.querySelectorAll("[data-seal-empty]")][0]; const c = el && el.closest("[data-lens-card], .sa-card, div"); const r = el ? el.parentElement.getBoundingClientRect() : null; return r ? { x: r.left - 160, y: r.top - 40 } : null; });
    if (tile) await page.screenshot({ path: join(OUT, "stamps-" + (light ? "light" : "dark") + ".png"), clip: { x: Math.max(0, tile.x), y: Math.max(0, tile.y), width: 220, height: 90 } });
    ok("STAMPS: " + (light ? "светлая" : "тёмная") + " — без ошибок страницы", !errs.length, errs.join(" | "));
    await ctx.close();
  }
}

// ── NARROW ─────────────────────────────────────────────────────────────────────────────────────
if (want("NARROW")) {
  const { ctx, page, errs } = await open({ who: "anna", width: 320, height: 700 });
  for (const s of ["shift", "teamHub", "me"]) {
    await nav(page, s);
    const hh = await hubHead(page);
    const ov = await overflowX(page);
    ok("NARROW: 320 px — «" + s + "»: знак у заголовка в экране, без прокрутки вбок", !!hh.mark && hh.left >= 0 && hh.right <= 320 && ov <= 1, JSON.stringify({ hh, ov }));
  }
  await nav(page, "home", 2500);
  const ov = await overflowX(page);
  const head = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Сменить" && !x.closest("#demo-strip, #demo-box")); const r = b ? b.getBoundingClientRect() : null; return r ? { right: r.right } : null; });
  ok("NARROW: 320 px — страница трека: «Сменить» в экране, без прокрутки вбок", ov <= 1 && !!head && head.right <= 320, JSON.stringify({ ov, head }));
  await lesson(page, "s0-1");
  const bl = (await bulletGeo(page, "[data-lesson-glass]")).filter((x) => x.wrapped);
  ok("NARROW: 320 px — пункты «•» урока переносятся под текст", bl.length >= 2 && bl.every((x) => Math.abs(x.line2X - x.textX) <= 3), JSON.stringify(bl.slice(0, 3)));
  const ov2 = await overflowX(page);
  ok("NARROW: 320 px — урок без прокрутки вбок (неразрывные цепочки не распирают строку)", ov2 <= 1, String(ov2));
  await page.screenshot({ path: join(OUT, "lesson-320.png") });
  ok("NARROW: без ошибок страницы", !errs.length, errs.join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`итог: ${pass} ✓, ${fail} ✗`);
process.exit(fail ? 1 : 0);
